// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   6.3 Deadlock Avoidance
   Original teaching material. Small helpers shared by several steps live
   inside this IIFE (no globals). Every number a student is told comes out
   of the same safety() and request() functions that drive the visuals.
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file
  // The running example: 4 processes (P1..P4) and 3 resource types (R1..R3).
  const RN = ['R1', 'R2', 'R3'];  // RN: the display names of the three resource types, used in table headings and in every explanation
  const EX = {  // EX: the running example state used by most steps: R (totals), C (claims) and A (allocations)
    R: [9, 4, 8],  // R: the system owns 9 units of R1, 4 of R2 and 8 of R3
    C: [[6, 2, 4], [2, 1, 2], [6, 3, 1], [4, 2, 5]],  // C: the claim matrix, one row per process (P1 to P4): the most of each type that process declared it may need
    A: [[0, 1, 1], [1, 0, 2], [3, 0, 1], [3, 2, 1]],  // A: the allocation matrix, one row per process: what each process holds right now
  };  // closes the EX example state
  // Vector helpers (one number per resource type).
  const add = (x, y) => x.map((v, j) => v + y[j]);  // add(x, y): adds two vectors entry by entry, e.g. work plus the units a finishing process returns
  const sub = (x, y) => x.map((v, j) => v - y[j]);  // sub(x, y): subtracts two vectors entry by entry, e.g. claim minus allocation gives the need
  const leq = (x, y) => x.every((v, j) => v <= y[j]);  // leq(x, y): true only if every entry of x is at most the matching entry of y (the "fits in every column" test)
  const vs = (x) => '(' + x.join(', ') + ')';  // vs(x): writes a vector as text in brackets, e.g. [2, 1, 3] becomes "(2, 1, 3)", for captions and tables
  const pn = (i) => 'P' + (i + 1);  // pn(i): turns a process index counted from 0 into its display name, so 0 becomes "P1"
  const clone = (st) => ({ R: st.R.slice(), C: st.C.map((r) => r.slice()), A: st.A.map((r) => r.slice()), gone: st.gone ? st.gone.slice() : null });  // clone(st): makes an independent copy of a state, so a tentative grant can be tried without touching the real one
  // V[j] = R[j] minus everything allocated in column j.
  function availOf(st) { return st.R.map((r, j) => r - st.A.reduce((s, row) => s + row[j], 0)); }  // availOf(st): the available vector V; for each type, the total minus the column sum of the allocation matrix
  // Need = C - A, row by row.
  function needOf(st) { return st.C.map((row, i) => sub(row, st.A[i])); }  // needOf(st): the need matrix; each process's claim row minus its allocation row

  // The safety test, exactly as taught: work = V; repeatedly find a process in rest
  // whose need fits in work (scanning rest from the front), pretend it finishes and
  // returns its allocation. Records one frame per check so a player can replay it.
  function safety(st) {  // safety(st): runs the safety test on a state and returns the verdict, the safe order found, and a frame for every check
    const need = needOf(st);  // need: each process's remaining need (claim minus allocation), worked out once before the search starts
    let work = availOf(st);  // work: the running count of units the test can rely on; it starts as a copy of the free units V
    const rest = st.C.map((_, i) => i).filter((i) => !(st.gone && st.gone[i]));  // finished processes have left
    const seq = [];  // seq: the safe order found so far, as a list of process indexes
    const frames = [{ type: 'start', work: work.slice(), rest: rest.slice(), seq: [] }];  // frames: the replay record; the first frame is the start, with work equal to V and nobody placed
    while (rest.length) {  // keeps searching as long as some process has not yet been placed in the order
      let found = -1;  // found: the process picked on this pass, or -1 while none has been found
      for (const k of rest) {  // scans the processes still in rest, from the front
        const ok = leq(need[k], work);  // ok: true if this process's whole need fits in work, column by column
        frames.push({ type: 'check', k, ok, short: need[k].map((v, j) => v > work[j]), work: work.slice(), rest: rest.slice(), seq: seq.slice() });  // records a "check" frame; short marks each column where the need is bigger than work, so the table can colour it red
        if (ok) { found = k; break; }  // the first process that fits is taken, and the scan stops
      }  // ends the scan over rest
      if (found < 0) { frames.push({ type: 'stuck', work: work.slice(), rest: rest.slice(), seq: seq.slice() }); break; }  // if nobody fits, records a "stuck" frame and stops the search: the state cannot be shown safe
      const before = work.slice();  // before: keeps a copy of work as it was, so the caption can show the addition
      work = add(work, st.A[found]);  // pretend the chosen process takes its need, finishes and hands everything back: the net gain to work is its allocation
      rest.splice(rest.indexOf(found), 1);  // removes the finished process from rest
      seq.push(found);  // and puts it next in the safe order
      frames.push({ type: 'release', k: found, before, work: work.slice(), rest: rest.slice(), seq: seq.slice() });  // records a "release" frame showing work before and after the process gives its units back
    }  // ends the search loop
    const safe = rest.length === 0;  // safe: the state is safe only if every process was placed, leaving rest empty
    frames.push({ type: 'end', safe, work: work.slice(), rest: rest.slice(), seq: seq.slice() });  // records the final "end" frame with the verdict
    return { safe, seq, rest, work, frames };  // returns the verdict, the order, anyone left over, the final work and every frame for the step 5 player
  }  // closes safety

  // Banker's request handling for process i asking for vector q.
  // verdict: 'error' (over its claim), 'wait' (not enough free), 'unsafe' (refused), 'grant'.
  function request(st, i, q) {  // request(st, i, q): applies the banker's three tests to process i asking for vector q, without changing st
    const need = sub(st.C[i], st.A[i]);  // need: how much more process i may still ask for (its claim minus what it holds)
    const V = availOf(st);  // V: the units free right now
    if (!leq(q, need)) return { verdict: 'error', need, V, bad: q.map((v, j) => v > need[j]) };  // test 1: a request bigger than the remaining need breaks the declared claim, so it is an error; bad marks the offending columns
    if (!leq(q, V)) return { verdict: 'wait', need, V, bad: q.map((v, j) => v > V[j]) };  // test 2: a request bigger than the free units cannot be met yet, so the process must wait; bad marks the short columns
    const tent = clone(st);  // tent: a copy of the state for the tentative grant, made on paper only
    tent.A[i] = add(tent.A[i], q);  // adds the request to process i's row of the copy, which also lowers the free units worked out from it
    const res = safety(tent);  // runs the safety test on the tentative state
    return { verdict: res.safe ? 'grant' : 'unsafe', need, V, tent, res };  // keeps the grant if that state is safe, otherwise reports unsafe; the copy and the test result go back for the captions
  }  // closes request

  // The banker's three tests in words, for process i asking for q in state st.
  // Returns { v: 'grant' | 'wait' | 'error', unsafe, lines (request-code lines on the path), cls, html, r }.
  function judge(st, i, q) {  // judge(st, i, q): turns the result of request into a verdict, the pseudo-code lines to light up, and a written explanation
    const r = request(st, i, q), V = availOf(st), sumA = add(st.A[i], q);  // r: the raw result of the three tests; V: the free units; sumA: what process i would hold if the request were granted
    const s1 = `<b>Test 1.</b> A + req = ${vs(st.A[i])} + ${vs(q)} = ${vs(sumA)}, against the claim ${vs(st.C[i])}`;  // s1: the sentence for test 1, comparing the allocation plus the request with the claim
    if (r.verdict === 'error') {  // the over-claim case
      const j = r.bad.indexOf(true);  // j: the first resource type where the total goes past the claim
      return { v: 'error', lines: [1, 2], cls: 'bad', r, html: `${s1}: <b>too big</b> in ${RN[j]} (${sumA[j]} > ${st.C[i][j]}). ${pn(i)} asked for more than it declared, so this is an <b>error</b>, not a wait.` };  // returns an error verdict that lights code lines 1-2 in red and names the type and numbers that broke the claim
    }  // ends the error case
    const s2 = `<b>Test 2.</b> req ${vs(q)} against V ${vs(V)}`;  // s2: the sentence for test 2, comparing the request with the free units
    if (r.verdict === 'wait') {  // the not-enough-free case
      const j = r.bad.indexOf(true);  // j: the first resource type with too few free units
      return { v: 'wait', lines: [1, 3, 4], cls: 'cur', r, html: `${s1}: fine. ${s2}: only ${V[j]} of ${RN[j]} ${V[j] === 1 ? 'is' : 'are'} free, ${q[j]} wanted. Not enough units right now, so ${pn(i)} <b>waits</b>; no safety test is needed.` };  // returns a wait verdict that lights lines 1, 3 and 4 and says how many units are free against how many are wanted
    }  // ends the not-enough-free case
    const s3 = `<b>Test 3.</b> On paper: A[${pn(i)}] = ${vs(r.tent.A[i])}, V = ${vs(availOf(r.tent))}. Safety test: `;  // s3: the start of the test 3 sentence: the tentative allocation and free units, written out on paper
    if (r.verdict === 'grant') return { v: 'grant', lines: [5, 6, 7, 8, 9], cls: 'ok', r, html: `${s1}: fine. ${s2}: fine. ${s3}the order <b>${r.res.seq.map(pn).join(' → ')}</b> lets everyone finish. Safe, so the request is <b>granted</b>.` };  // safe case: a grant verdict that lights lines 5-9 in green and shows the safe order the test found
    const stuck = r.res.frames.find((f) => f.type === 'stuck');  // unsafe case: finds the frame where the safety test got stuck, so the explanation can quote work at that moment
    return { v: 'wait', unsafe: true, lines: [5, 6, 7, 8, 10, 11, 12, 13], cls: 'bad', r, html: `${s1}: fine. ${s2}: fine, the units are there. ${s3}${r.res.seq.length ? r.res.seq.map(pn).join(' → ') + ' could finish, then ' : ''}work is ${vs(stuck.work)} and no remaining need fits. <b>Unsafe</b>, so the grant is undone and ${pn(i)} <b>waits</b>, even though the units were free.` };  // returns a wait verdict marked unsafe, lighting the undo lines 10-13 in red, and lists who could finish before the test got stuck
  }  // closes judge

  // Single-resource version used by the bank analogy: loans and limits are plain numbers.
  function safety1(total, loan, limit, done) {  // safety1(total, loan, limit, done): the safety test for one resource type, used by the bank vault in step 2
    let cash = total - loan.reduce((s, x) => s + x, 0);  // cash: coins left in the vault, the total minus every loan
    const rest = loan.map((_, i) => i).filter((i) => !(done && done[i]));  // rest: the customers who have not finished yet
    const steps = [];  // steps: the safe order found so far, with the numbers each step uses
    while (rest.length) {  // keeps looking while some customer has not been placed
      const t = rest.findIndex((i) => limit[i] - loan[i] <= cash);  // t: the position in rest of the first customer whose remaining need (limit minus loan) fits in the cash
      if (t < 0) return { safe: false, steps, rest, cash };  // if nobody fits, the state is unsafe; returns what was found so far and who is left
      const i = rest.splice(t, 1)[0];  // takes that customer out of rest
      steps.push({ i, need: limit[i] - loan[i], before: cash, after: cash + loan[i] });  // records the step: who, how much it still needed, and the cash before and after it repays its loan
      cash += loan[i];  // the customer takes its need and then repays its whole limit, so the vault's net gain is the loan it already held
    }  // ends the search loop
    return { safe: true, steps, rest, cash };  // everyone was placed, so the state is safe; returns the full order
  }  // closes safety1

  Guide.section({  // registers this section with the guide; the object below holds everything the section shows
    id: '6.3',  // the section number, used in links, the progress list and saved progress
    title: 'Deadlock Avoidance',  // the full title shown at the top of every step
    short: 'Avoidance',  // the short name used in the side menu and progress list
    summary: 'Grant a request only if every process can still finish afterwards: safe states and the banker’s algorithm.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Explain how deadlock avoidance differs from prevention and detection, and what it must know in advance.',  // objective 1: how avoidance differs from prevention and detection, and what it needs to know ahead of time
      'Apply process initiation denial and explain why it admits far fewer processes than it could.',  // objective 2: process initiation denial and why it is so cautious
      'Run the safety test on a state with several resource types and give a safe sequence when one exists.',  // objective 3: running the safety test with several resource types
      'Handle a request with the banker’s algorithm: report an error, make the process wait, or grant it.',  // objective 4: the three possible outcomes of the banker's algorithm for one request
      'State what avoidance gains over the other strategies and the four restrictions on its use.',  // objective 5: the benefits of avoidance and its four restrictions
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Deadlock avoidance', 'A strategy that lets processes ask for resources freely but checks each decision against the future: a request is granted only if, afterwards, every process can still be guaranteed to finish.'],  // glossary entry: deadlock avoidance, checking each decision against the future
      ['Deadlock prevention', 'Designing the system so that one of the conditions for deadlock can never hold. Deadlock becomes impossible, but resources are often used poorly.'],  // glossary entry: deadlock prevention, ruling out one of the deadlock conditions by design
      ['Deadlock detection', 'Granting requests whenever units are free, then searching from time to time for processes that are deadlocked and breaking any deadlock that is found.'],  // glossary entry: deadlock detection, granting freely and searching for deadlocks later
      ['Maximum claim', 'The most units of each resource type that a process may ever hold at one time. The process declares it before it starts and may never go beyond it.'],  // glossary entry: maximum claim, the declared upper limit per resource type
      ['Process initiation denial', 'An avoidance rule used when a process asks to start: it is admitted only if its claim plus the claims of every process already running fit within the system’s total, for every resource type.'],  // glossary entry: process initiation denial, the admission rule applied when a process starts
      ['Resource allocation denial', 'An avoidance rule used on every request while processes run: a request is refused for now if granting it would leave the system in an unsafe state.'],  // glossary entry: resource allocation denial, the rule applied to every request while processes run
      ['Banker’s algorithm', 'Dijkstra’s resource allocation denial method. It grants a request on paper, runs the safety test on the result, and keeps the grant only if the result is safe.'],  // glossary entry: the banker's algorithm and its grant-on-paper-then-test approach
      ['Safe state', 'A state in which there is at least one order in which every process can be given everything it may still need, run to completion and give its resources back.'],  // glossary entry: safe state, at least one order lets everyone finish
      ['Unsafe state', 'A state with no safe sequence: no order is guaranteed to let every process finish. It is not necessarily deadlocked (it may already be, or everyone may still finish), but the system can no longer promise that a deadlock will not happen.'],  // glossary entry: unsafe state, and why it does not have to mean deadlock (though it can)
      ['Safe sequence', 'An order of the processes in which each one can be satisfied from the units free at that moment plus the units returned by every process earlier in the order.'],  // glossary entry: safe sequence, the order that proves a state safe
      ['Resource vector (R)', 'One number per resource type: the total number of units of that type the system owns.'],  // glossary entry: the resource vector R (totals)
      ['Available vector (V)', 'One number per resource type: the units of that type that no process holds right now.'],  // glossary entry: the available vector V (free units)
      ['Claim matrix (C)', 'One row per process, one column per resource type. C[i][j] is the most units of type j that process i declared it may need.'],  // glossary entry: the claim matrix C
      ['Allocation matrix (A)', 'One row per process, one column per resource type. A[i][j] is the number of units of type j that process i holds right now.'],  // glossary entry: the allocation matrix A
      ['Need matrix (C − A)', 'The claim matrix minus the allocation matrix: how many more units of each type each process may still ask for before it reaches its maximum claim.'],  // glossary entry: the need matrix C minus A
      ['Safety test (safety algorithm)', 'The check inside the banker’s algorithm: start from the free units, repeatedly find a process whose remaining need fits, pretend it finishes and returns what it holds, and call the state safe only if every process is placed.'],  // glossary entry: the safety test, step by step in words
      ['Work vector', 'The safety test’s running count of units it can rely on. It starts as a copy of V and grows each time a process is assumed to finish and hand back its allocation.'],  // glossary entry: the work vector the safety test keeps
      ['Tentative allocation', 'Granting a request on paper only (adding it to A and taking it out of V) so that the safety test can judge the result. It is undone if the result is unsafe.'],  // glossary entry: tentative allocation, a grant made on paper and undone if unsafe
    ],  // closes the glossary list
    css: ` /* styles used only by this section; every rule starts with .sec-6-3 so it affects this section's slides and nothing else */
      .sec-6-3 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; } /* narration box (narr): a pale panel with a thick left bar in the chapter colour, used for running commentary and verdicts */
      .sec-6-3 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* narration in the ok tone: green bar and green tint, for a safe state or a granted request */
      .sec-6-3 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* narration in the bad tone: red bar and red tint, for an unsafe state, a refusal or an error */
      .sec-6-3 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); } /* narration in the warn tone: amber bar and amber tint, for a process that has to wait */
      .sec-6-3 .grid-2 > *, .sec-6-3 .mw0 > * { min-width: 0; } /* lets the children of two-column grids shrink below their content width, so long text cannot stretch the layout */
      .sec-6-3 table.mx { border-collapse: separate; border-spacing: 0; width: 100%; font-variant-numeric: tabular-nums; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--panel); } /* mx: the matrix tables (claim, allocation, need); rounded border, full width, and digits of equal width so columns line up */
      .sec-6-3 table.mx th, .sec-6-3 table.mx td { text-align: center; padding: 4px 6px; font-size: 15px; border-bottom: 1px solid var(--line); } /* every heading and cell in a matrix table is centred, small and padded, with a thin line under it */
      .sec-6-3 table.mx tr:last-child td { border-bottom: 0; } /* no line under the last row, so it does not double up with the table's own border */
      .sec-6-3 table.mx th { background: var(--panel-3); font-size: 13px; color: var(--ink-2); font-weight: 800; } /* heading cells get a tinted background and smaller, bolder grey text, so they stand apart from the numbers */
      .sec-6-3 table.mx th.gC, .sec-6-3 table.mx td.gC { background: var(--os-bg); } /* claim (C) columns get a pale purple background */
      .sec-6-3 table.mx th.gA, .sec-6-3 table.mx td.gA { background: var(--proc-bg); } /* allocation (A) columns get a pale teal background */
      .sec-6-3 table.mx th.gN, .sec-6-3 table.mx td.gN { background: var(--warn-bg); } /* need (C minus A) columns get a pale amber background, so the three matrices are easy to tell apart */
      .sec-6-3 table.mx th.gC { color: var(--os); } .sec-6-3 table.mx th.gA { color: var(--proc); } .sec-6-3 table.mx th.gN { color: var(--warn); } /* the group headings for C, A and need are written in the strong version of their colour */
      .sec-6-3 table.mx .lft { border-left: 2px solid var(--line-2); } /* lft: a thicker line on the left of the first column of each group, separating the matrices */
      .sec-6-3 table.mx td.pname { font-weight: 900; text-align: left; padding-left: 10px; white-space: nowrap; } /* pname: the process-name cell at the start of each row, bold, left-aligned and kept on one line */
      .sec-6-3 table.mx.roomy th, .sec-6-3 table.mx.roomy td { padding: 7px 6px; font-size: 16.5px; } /* roomy: a larger version of the table with more padding and bigger numbers, used on desktop screens */
      .sec-6-3 table.mx.roomy th { font-size: 13.5px; } /* roomy heading cells get slightly larger text as well */
      .sec-6-3 table.mx td.fit { background: var(--ok-bg); color: var(--ok); font-weight: 900; box-shadow: inset 0 0 0 2px var(--ok); } /* fit: a need cell that fits in work during the safety test, outlined and filled in green */
      .sec-6-3 table.mx td.miss { background: var(--bad-bg); color: var(--bad); font-weight: 900; box-shadow: inset 0 0 0 2px var(--bad); } /* miss: a need cell that is bigger than work, outlined and filled in red */
      .sec-6-3 table.mx td.hot { box-shadow: inset 0 0 0 3px var(--accent); background: var(--accent-bg); font-weight: 900; } /* hot: the cell the student clicked (or the allocation being returned), with a thick accent outline */
      .sec-6-3 table.mx td.sum { box-shadow: inset 0 0 0 2px var(--accent); } /* sum: cells that feed into the clicked value, such as the column added up for V, get a thin accent outline */
      .sec-6-3 table.mx tr.cand td { border-top: 2px solid var(--accent); border-bottom: 2px solid var(--accent); } /* cand: the row of the process being checked now, marked by accent lines above and below it */
      .sec-6-3 table.mx tr.done td { opacity: .5; } /* done: rows of processes already placed in the safe order fade to half strength */
      .sec-6-3 table.mx td.clk { cursor: pointer; } /* clk: clickable cells show a pointing-hand cursor */
      .sec-6-3 table.mx td.clk:hover { background: var(--accent-bg); } /* a clickable cell lights up when the mouse is over it */
      .sec-6-3 table.mx td.clk:focus-visible { outline: 3px solid var(--accent); outline-offset: -3px; } /* a clickable cell reached with the keyboard gets a clear accent outline drawn just inside its edge */
      .sec-6-3 table.mx.slim th, .sec-6-3 table.mx.slim td { padding: 3px 2px; font-size: 13px; } /* slim: a compact version of the table for phone-width screens, with less padding and smaller text */
      .sec-6-3 table.mx.slim td.pname { padding-left: 4px; } /* in the slim table the process names sit closer to the left edge */
      .sec-6-3 table.mx.tight th, .sec-6-3 table.mx.tight td { padding: 3px 6px; } /* tight: a table with less vertical padding, used where space is short */
      .sec-6-3 table.mx td.mono { white-space: nowrap; } /* cells written in the fixed-width typeface, such as vectors, are kept on one line */
      .sec-6-3 .rule { display: flex; gap: 8px; align-items: baseline; font-size: 14.5px; line-height: 1.4; } /* rule: one of the "three facts" lines, with its tick mark beside the text */
      .sec-6-3 .rule .ok { color: var(--ok); font-weight: 900; } /* the tick mark in a rule line is bold and green */
      .sec-6-3 .ok-card { background: var(--ok-bg); border-color: color-mix(in srgb, var(--ok) 35%, transparent); } /* ok-card: a green-tinted card with a soft green border, used for the "What it buys" box */
      .sec-6-3 .vec { display: inline-flex; gap: 4px; font-family: var(--mono); font-weight: 800; } /* vec: a vector drawn as a row of small boxes, one per resource type, in the fixed-width typeface */
      .sec-6-3 .vec > span { min-width: 30px; text-align: center; padding: 2px 6px; border-radius: 7px; background: var(--panel-3); border: 1px solid var(--line); } /* each box of a vector is at least 30 pixels wide, centred, rounded and lightly filled */
      .sec-6-3 .vec.ok > span { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); } /* a vector in the ok tone (work in the safety test) has green boxes */
      .sec-6-3 .vec .miss { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); } /* a box marked miss shows, in red, the column where a need is bigger than work */
      .sec-6-3 .lbl { font-size: 13px; font-weight: 800; color: var(--ink-2); letter-spacing: .03em; } /* lbl: small bold grey labels such as WORK, VAULT and REST, slightly spaced out */
      .sec-6-3 pre.code .ln { cursor: default; } /* lines of a code listing show the ordinary arrow cursor, since they are not clickable here */
      .sec-6-3 pre.code.wrap .ln { white-space: pre-wrap; padding-left: 2.6em; text-indent: -2.6em; } /* wrap: lets long code lines wrap on small screens, with a hanging indent so the wrapped part lines up after the line number */
      .sec-6-3 pre.code.clk .ln { cursor: pointer; } /* for listings whose lines can be clicked: a pointing-hand cursor */
      .sec-6-3 pre.code.clk .ln:hover { background: var(--accent-bg); } /* and the line under the mouse lights up */
      .sec-6-3 .brow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 34px; } /* brow: one borrower row in the bank vault: name, unit boxes, a status note and buttons, wrapping on small screens */
      .sec-6-3 .brow .bname { font-weight: 900; width: 54px; } /* bname: the borrower's name, bold, in a fixed-width column so the rows line up */
      .sec-6-3 .cells { display: flex; gap: 3px; width: 190px; } /* cells: the row of boxes showing a borrower's credit limit, in a fixed width so every row starts its boxes at the same place */
      .sec-6-3 .cell { width: 21px; height: 21px; border-radius: 5px; border: 2px solid var(--proc); background: var(--proc-bg); } /* cell: one coin the borrower already holds, a small filled teal square */
      .sec-6-3 .cell.need { border: 2px dashed var(--warn); background: transparent; } /* cell.need: a coin the borrower may still ask for, drawn as an empty dashed amber square */
      .sec-6-3 .cell.done { border-color: var(--ok); background: var(--ok-bg); } /* cell.done: the boxes of a borrower that has finished turn green */
      .sec-6-3 .brow .binfo { width: 156px; font-size: 13.5px; color: var(--ink-2); white-space: nowrap; } /* binfo: the "holds 3 of 8 · needs 5" note, in a fixed width, small grey text kept on one line */
      .sec-6-3 .brow .btn { min-width: 0; } /* lets the buttons in a borrower row shrink so the row fits */
      .sec-6-3 .coins { display: flex; flex-wrap: wrap; gap: 4px; } /* coins: the coins in the vault, laid out in a row that wraps if needed */
      .sec-6-3 .coin { width: 17px; height: 17px; border-radius: 50%; border: 2px solid var(--ok); background: var(--ok-bg); } /* coin: one coin still in the vault, a small green circle */
      .sec-6-3 .coin.out { border: 2px dashed var(--line-2); background: transparent; } /* coin.out: a coin that is lent out, an empty dashed circle, so the vault shows what is missing */
      .sec-6-3 .flip-face.front { font-size: 18px; } /* the front of each recap card uses slightly larger text than the default */
      .sec-6-3 .flip-face.back { font-size: 15px; line-height: 1.42; } /* the back of each recap card uses 15-pixel text with comfortable line spacing, so the longer answers stay readable */
    `,  // end of the section's styles
    steps: [  // steps: the list of slides in this section, in order
      /* ---------------- 1. Big picture ---------------- */
      {  // step 1 starts here
        title: 'Look before you lend',  // step 1 title: the "look before you lend" idea
        kind: 'story',  // kind story: shown with the Big Picture label above the title
        html: `${/* the fixed page content of step 1, written as HTML text inside backticks */''}
          <div class="split fill">${/* a two-column layout that fills the step: the explanation on the left, the strategy timeline on the right */''}
            <div class="stack" style="gap:10px">${/* left column: a stack of paragraphs with 10 pixels between them */''}
              <p class="lead m0">Prevention bans one of the conditions for <span class="t">deadlock</span>. Avoidance keeps every policy in place and instead refuses any single move that could trap the system later.</p>${/* opening sentence: prevention bans a condition, while avoidance refuses single risky moves */''}
              <p class="m0">Recall the four conditions. The first three (mutual exclusion, hold and wait, no preemption) are rules the system chooses to allow. The fourth, circular wait, is what can <i>happen</i> when the wrong requests are granted in the wrong order. <span class="t">Deadlock avoidance</span> keeps all three rules and steers around the fourth: before each decision it asks, <b>“If I do this, can every process still finish?”</b></p>${/* paragraph: the four deadlock conditions, and how avoidance keeps the first three but steers around circular wait */''}
              <div class="callout analogy m0" data-label="Analogy">A small bank gives each customer a credit limit. Added up, the limits are far more than the vault holds, because customers seldom need their whole limit at once. Before handing over cash, a careful banker checks that even if everyone later asked for the full limit, there would still be <i>some order</i> in which every customer could be served, finish and repay.</div>${/* analogy box: a careful banker who lends only if some repayment order still works for everyone */''}
              <div class="row gap-s small"><span class="chip ok">lend from a vault</span><span class="chip os">read the four tables</span><span class="chip proc">run the safety test</span><span class="chip warn">be the banker</span></div>${/* row of coloured tags previewing the section's activities: the vault, the tables, the safety test and the banker lab */''}
            </div>${/* ends the left column */''}
            <div class="card stack" style="gap:8px">${/* right column: a card holding the strategy comparison */''}
              <h4 class="m0">Where avoidance fits</h4>${/* card heading: where avoidance fits among the strategies */''}
              <p class="small muted m0">Three ways to handle deadlock. Click one: when does it act?</p>${/* instruction: click a strategy to see when it acts */''}
              <div class="row gap-s strat-btns"></div>${/* empty row where render() puts the three strategy buttons */''}
              <div class="card white tight strat-svg" style="padding:6px 8px"></div>${/* empty white box where render() draws the timeline picture */''}
              <div class="strat-detail stack" style="gap:6px"></div>${/* empty box where render() writes what the chosen strategy does and what it costs */''}
              <div class="callout why m0" data-label="The price and the payoff">To look ahead, the OS must know each process’s <span class="t">maximum claim</span> in advance. In return, avoidance lets more processes hold resources at the same time than <span class="t">deadlock prevention</span> does.</div>${/* why box: avoidance needs maximum claims in advance, and in return lets more processes hold resources than prevention */''}
            </div>${/* ends the right-hand card */''}
          </div>`,  // ends the two-column layout and the HTML text of step 1
        render(el, ctx) {  // render(el, ctx): runs when step 1 opens; el is the step's box, ctx the guide's toolbox of helpers
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const ST = [  // ST: the three strategies, each with a name, a colour, the timeline stations where it acts and its explanation
            { name: 'Prevention', cls: 'intr', at: [0], term: 'deadlock prevention',  // Prevention, in red, acts at station 0 (design rules); term names its glossary entry
              what: 'Make deadlock impossible by design: forbid one of the four conditions, for example by making processes request resources in a fixed order.',  // what prevention does: forbids one condition by design
              cost: 'Simple to reason about, but resources often sit idle and programmers must follow awkward rules.' },  // what prevention costs: idle resources and awkward rules
            { name: 'Avoidance', cls: 'ok', at: [1, 2], term: 'deadlock avoidance',  // Avoidance, in green, acts at stations 1 and 2 (process start and each request)
              what: 'Allow the three policy conditions, but look ahead before each decision. Two flavours: <b>process initiation denial</b> refuses to <i>start</i> a process whose claims might cause trouble; <b>resource allocation denial</b>, the <span class="t">banker’s algorithm</span> (due to Dijkstra), refuses a single <i>request</i> that might.',  // what avoidance does: looks ahead, in its two flavours, initiation denial and the banker's algorithm
              cost: 'Needs every maximum claim in advance and a check on every request, but never takes resources away.' },  // what avoidance costs: claims in advance and a check per request, but nothing is ever taken away
            { name: 'Detection', cls: 'warn', at: [3], term: 'deadlock detection',  // Detection, in amber, acts at station 3 (a periodic check)
              what: 'Grant whatever is free. Every so often, search for a set of processes that are stuck waiting on each other, and break the deadlock if one is found.',  // what detection does: grants freely and searches for deadlocks from time to time
              cost: 'Most freedom while running, but recovery means aborting processes or taking resources back.' },  // what detection costs: recovery means aborting processes or taking resources back
          ];  // closes the ST list
          const stations = ['Design rules', 'Process starts', 'Each request', 'Periodic check'];  // stations: the four labelled points on the timeline, from system design to run time
          const btnBox = ctx.$('.strat-btns'), svgBox = ctx.$('.strat-svg'), detail = ctx.$('.strat-detail');  // finds the three empty boxes from the HTML above: the button row, the drawing box and the detail box
          // Small screens get a vertical timeline (about 300 units wide) so labels stay readable.
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 300 200' : '0 0 500 104', width: '100%' });  // creates the SVG drawing (the browser's drawing format); viewBox sets its own coordinates, tall on phone-width screens and wide otherwise
          svgBox.append(svg);  // puts the drawing into its box
          const btns = ST.map((st, i) => h('button', { class: 'btn sm ' + st.cls, type: 'button', onclick: () => show(i) }, st.name));  // one button per strategy, coloured to match it; a click calls show for that strategy
          btnBox.append(...btns);  // puts the three buttons into their row
          function show(i) {  // show(i): selects strategy i, redraws the timeline and rewrites the explanation under it
            const st = ST[i];  // st: the chosen strategy's record
            btns.forEach((b, j) => b.classList.toggle('on', i === j));  // highlights the chosen button and switches the others off
            if (ctx.narrow) drawTall(st); else drawWide(st);  // draws the vertical timeline on phone-width screens (ctx's layout flag) and the horizontal one on desktop
            detail.innerHTML = '';  // empties the detail box
            detail.append(  // then fills it with two paragraphs
              h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: `<b><span class="t" data-t="${st.term}">${st.name}</span>.</b> ${st.what}` }),  // the strategy name, as a dotted glossary term, followed by what it does
              h('p', { class: 'small m0', html: `<b>Cost:</b> ${st.cost}` }));  // a smaller paragraph with what the strategy costs
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');  // restarts the fade-in animation: removing the class, reading offsetWidth (which forces a layout pass) and adding it again replays it
          }  // ends show
          // The timeline drawn left to right (desktop).
          function drawWide(st) {  // drawWide(st): draws the timeline left to right, with the chosen strategy's stations enlarged and coloured
            const X = (k) => 62 + k * 125;  // X(k): the horizontal position of station k, spaced 125 units apart
            const kids = [s('line', { x1: 20, y1: 40, x2: 482, y2: 40, class: 's-line', 'marker-end': 'url(#arr)' }),  // kids starts with the timeline itself: a line across the drawing ending in an arrowhead (the shared arr marker)
              s('text', { x: 20, y: 16, class: 's-sub', 'font-size': 13 }, 'From system design to run time: where does the strategy step in?')];  // and a small grey heading over the line asking where the strategy steps in
            stations.forEach((lab, k) => {  // adds three shapes for each station
              const on = st.at.includes(k);  // on: true if the chosen strategy acts at this station
              kids.push(s('circle', { cx: X(k), cy: 40, r: on ? 13 : 8, class: on ? 's-' + st.cls : 's-panel', 'stroke-width': 2 }));  // the station dot: larger and in the strategy's colour if it acts here, otherwise small and neutral
              kids.push(s('text', { x: X(k), y: 74, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': on ? 800 : 500 }, lab));  // the station name under the dot, bold if the strategy acts here
              if (on) kids.push(s('text', { x: X(k), y: 94, 'text-anchor': 'middle', 'font-size': 13, style: 'fill:var(--' + st.cls + ')', 'font-weight': 700 }, st.name.toLowerCase() + ' acts'));  // under an active station, a coloured note such as "avoidance acts"
            });  // ends the loop over stations
            svg.replaceChildren(...kids);  // swaps everything in the drawing for the new shapes in one go
          }  // ends drawWide
          // The same timeline drawn top to bottom for small screens: station on the left, "acts" note on the right.
          function drawTall(st) {  // drawTall(st): the same timeline drawn top to bottom for small screens
            const Y = (k) => 62 + k * 36;  // Y(k): the vertical position of station k, spaced 36 units apart
            const kids = [s('line', { x1: 22, y1: 46, x2: 22, y2: 192, class: 's-line', 'marker-end': 'url(#arr)' }),  // kids starts with a downward line ending in an arrowhead
              s('text', { x: 6, y: 16, class: 's-sub', 'font-size': 13 }, 'From system design to run time:'),  // first half of the heading, split over two lines so it fits the small drawing
              s('text', { x: 6, y: 33, class: 's-sub', 'font-size': 13 }, 'where does the strategy step in?')];  // second half of the heading
            stations.forEach((lab, k) => {  // adds three shapes for each station
              const on = st.at.includes(k);  // on: true if the chosen strategy acts at this station
              kids.push(s('circle', { cx: 22, cy: Y(k), r: on ? 11 : 7, class: on ? 's-' + st.cls : 's-panel', 'stroke-width': 2 }));  // the station dot on the line: larger and coloured if the strategy acts here
              kids.push(s('text', { x: 44, y: Y(k) + 5, 'font-size': 14, 'font-weight': on ? 800 : 500 }, lab));  // the station name to the right of the dot, bold if active
              if (on) kids.push(s('text', { x: 294, y: Y(k) + 5, 'text-anchor': 'end', 'font-size': 13, style: 'fill:var(--' + st.cls + ')', 'font-weight': 700 }, st.name.toLowerCase() + ' acts'));  // at the right edge, the coloured "acts" note, lined up to end there (text-anchor end)
            });  // ends the loop over stations
            svg.replaceChildren(...kids);  // replaces the drawing's contents with the new shapes
          }  // ends drawTall
          show(1);  // shows Avoidance first, since it is the topic of this section
        },  // ends render() for step 1
      },  // ends step 1

      /* ---------------- 2. One resource type: the bank ---------------- */
      {  // step 2 starts here
        title: 'One vault, four borrowers',  // step 2 title: one vault, four borrowers
        kind: 'explore',  // kind explore: shown with the Explore label above the title
        html: `${/* the fixed page content of step 2, written as HTML text inside backticks */''}
          <div class="split l fill">${/* a two-column layout, smaller column on the left: explanation on the left, the interactive vault on the right */''}
            <div class="stack" style="gap:10px">${/* left column: a stack of paragraphs with 10 pixels between them */''}
              <p class="lead m0">Start with a single kind of resource: coins in a vault.</p>${/* opening sentence: start with one resource type, coins in a vault */''}
              <p class="m0">The vault holds <b>12 coins</b>. Four customers, all small firms, each have a credit limit: its <span class="t">maximum claim</span>. A customer borrows one coin at a time and, once it holds its whole limit, finishes its project and repays every coin.</p>${/* paragraph: the vault's 12 coins, the four customers and their credit limits (maximum claims) */''}
              <p class="m0">The banker calls the situation a <span class="t">safe state</span> if there is <b>at least one order</b> in which every customer can be topped up to its limit, finish and repay. Such an order is a <span class="t">safe sequence</span>. If no such order exists, the state is an <span class="t">unsafe state</span>.</p>${/* paragraph: defines safe state, safe sequence and unsafe state for the vault */''}
              <div class="callout tip m0" data-label="Rule of thumb">The vault must always hold enough to finish <i>some</i> customer. Once that customer repays, the vault must hold enough to finish another one, and so on down the line.</div>${/* tip box: the vault must always be able to finish some customer, then the next, and so on */''}
              <div class="callout warn m0" data-label="Common mistake">“There are coins left, so the loan is fine.” A loan can be affordable today and still leave no order in which everyone can finish.</div>${/* warning box: coins being left over does not make a loan safe */''}
            </div>${/* ends the left column */''}
            <div class="stack bank-tabs" style="min-height:0"></div>${/* empty right column where render() puts the two tabs */''}
          </div>`,  // ends the layout and the HTML text of step 2
        render(el, ctx) {  // render(el, ctx): runs when step 2 opens and builds the interactive vault
          const { h } = ctx;  // takes the HTML builder h out of the toolbox
          const TOTAL = 12, NAMES = ['Alder', 'Birch', 'Cedar', 'Dune'], LIMIT = [8, 4, 7, 5], START = [3, 2, 2, 2];  // the vault's fixed data: 12 coins in total, the customer names, their credit limits and the loans they start with
          const cashOf = (loan) => TOTAL - loan.reduce((a, b) => a + b, 0);  // cashOf(loan): the coins still in the vault, the total minus every loan
          function rowsEl(loan, done, wait, buttons) {  // rowsEl(loan, done, wait, buttons): builds one row per customer showing loans as boxes, a status note and optional buttons
            return h('div', { class: 'stack', style: { gap: '4px' } }, ...NAMES.map((n, i) => {  // returns a stack with one row for each customer name
              const cells = [];  // cells: the boxes for this customer, one per coin of its credit limit
              for (let u = 0; u < LIMIT[i]; u++) cells.push(h('span', { class: 'cell' + (done[i] ? ' done' : u < loan[i] ? '' : ' need') }));  // each box is held (filled), still needed (dashed) or done (green) depending on the loan and whether the customer finished
              const info = done[i] ? 'finished, repaid' : `holds ${loan[i]} of ${LIMIT[i]} · ${wait && wait[i] ? 'waiting' : 'needs ' + (LIMIT[i] - loan[i])}`;  // info: the status note, "finished, repaid" or "holds 3 of 8 · needs 5" (or "waiting" when the customer is blocked)
              return h('div', { class: 'brow' }, h('span', { class: 'bname' }, n), h('div', { class: 'cells' }, ...cells),  // the row: the name, then the boxes
                h('span', { class: 'binfo', style: wait && wait[i] ? { color: 'var(--bad)', fontWeight: 800 } : null }, info), ...(buttons ? buttons(i) : []));  // then the status note (red and bold when waiting) and, if given, the row's buttons
            }));  // closes the row builder and the list of rows
          }  // ends rowsEl
          function vaultEl(cash) {  // vaultEl(cash): builds the vault display: the label, the number of coins left and one circle per coin
            const coins = [];  // coins: the circles, one for each of the 12 coins
            for (let k = 0; k < TOTAL; k++) coins.push(h('span', { class: 'coin' + (k < cash ? '' : ' out') }));  // the first cash circles are full coins still in the vault; the rest are dashed outlines for coins lent out
            return h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'lbl' }, 'VAULT'),  // the row: a VAULT label, then the count of coins in large digits
              h('span', { class: 'big', style: { fontSize: '30px', minWidth: '36px' } }, String(cash)), h('div', { class: 'coins' }, ...coins));  // the count is 30 pixels high with room for two digits, followed by the circles
          }  // ends vaultEl
          // Plain-language verdict computed by safety1 (the single-resource safety test).
          function verdict(loan, done) {  // verdict(loan, done): works out in plain words whether the vault is safe right now, plus the tone to colour the box
            if (done.every(Boolean)) return ['ok', `<b>Everyone has finished.</b> All ${TOTAL} coins are back in the vault.`];  // if every customer has finished, says so: all coins are back and there is nothing left to judge
            const r = safety1(TOTAL, loan, LIMIT, done);  // r: the single-resource safety test run on the current loans
            const chain = r.steps.map((st) => `${NAMES[st.i]} (needs ${st.need} ≤ ${st.before}; vault then ${st.after})`).join(' → ');  // chain: the order the test found, each step with the need, the cash before and the cash after, joined by arrows
            if (r.safe) return ['ok', `<b>Safe.</b> One order that lets everyone finish: ${chain}.`];  // safe: reports the order that lets everyone finish, in green
            const left = r.rest.map((i) => `${NAMES[i]} ${LIMIT[i] - loan[i]}`).join(', ');  // left: the customers the test could not place, each with how many coins it still needs
            return ['bad', `<b>Unsafe.</b> ${chain ? 'Even after ' + chain + ', the' : 'The'} vault holds ${r.cash}, but the remaining needs are ${left}. None fits, so no order is guaranteed. If those customers now insist on their full limits, none can be served: deadlock.`];  // unsafe: in red, shows how far the test got, the coins left, the needs that do not fit, and how this could end in deadlock
          }  // ends verdict

          /* Tab 1: the student lends coins. */
          function lendTab(p) {  // lendTab(p): fills tab 1, where the student lends coins one at a time; p is the tab's panel
            let loan, done, careful = false;  // loan: coins each customer holds; done: who has finished; careful: whether the banker checks safety before lending
            const act = h('div', { class: 'small', style: { minHeight: '22px' } });  // act: a one-line message describing the last action
            const stat = h('div', { class: 'narr', style: { minHeight: '68px' } });  // stat: the narration box with the safe or unsafe verdict
            const vBox = h('div'), rBox = h('div');  // vBox and rBox: holders for the vault and the customer rows, redrawn after every change
            function paint() {  // paint(): redraws the vault, the customer rows and the verdict from the current loans
              vBox.replaceChildren(vaultEl(cashOf(loan)));  // redraws the vault with the coins left
              rBox.replaceChildren(rowsEl(loan, done, null, (i) => [  // redraws the rows, giving each customer two buttons
                h('button', { class: 'btn sm', type: 'button', disabled: done[i] || loan[i] >= LIMIT[i], onclick: () => lend(i) }, 'Lend 1'),  // Lend 1: lends this customer one coin; greyed out once it has finished or reached its limit
                h('button', { class: 'btn sm ok', type: 'button', disabled: done[i] || loan[i] < LIMIT[i], onclick: () => repay(i) }, 'Finish')]));  // Finish: lets the customer finish and repay; only active once it holds its whole limit
              const [tone, txt] = verdict(loan, done);  // asks verdict for the tone and text that describe the current state
              stat.className = 'narr ' + tone; stat.innerHTML = txt;  // colours the narration box by that tone and writes the verdict in it
            }  // ends paint
            function lend(i) {  // lend(i): runs when Lend 1 is clicked for customer i
              const cash = cashOf(loan);  // cash: coins in the vault before this loan
              if (cash === 0) { act.innerHTML = `${NAMES[i]} asks for a coin, but the vault is empty. ${NAMES[i]} must wait.`; return; }  // with an empty vault there is nothing to lend, so the customer must wait
              const trial = loan.slice(); trial[i] += 1;  // trial: the loans as they would be after this one coin is lent
              if (careful && !safety1(TOTAL, loan, LIMIT, done).safe) {  // careful banker: if the state is already unsafe (reached earlier in careless mode), no further loan is allowed
                act.innerHTML = `<b style="color:var(--warn)">Refused.</b> The state is already unsafe (careless lending got it here), and another loan cannot fix that. A careful banker never gets here: press Reset.`;  // explains the refusal and suggests Reset, since a careful banker never reaches an unsafe state
                return;  // stops without lending
              }  // ends the already-unsafe case
              if (careful && !safety1(TOTAL, trial, LIMIT, done).safe) {  // careful banker: refuses the loan if it would leave the vault in an unsafe state
                act.innerHTML = `<b style="color:var(--warn)">Refused.</b> Lending ${NAMES[i]} a coin is affordable (${cash} in the vault) but would leave an unsafe state, so ${NAMES[i]} waits for now.`;  // explains that the coin is affordable but the result would be unsafe, so the customer waits
                return;  // stops without lending
              }  // ends the would-be-unsafe case
              loan = trial;  // the loan is allowed, so the trial loans become the real ones
              act.innerHTML = `${NAMES[i]} borrows 1 coin. The vault goes from ${cash} to ${cash - 1}.`;  // reports the loan and how the vault count changes
              paint();  // redraws everything with the new loan
            }  // ends lend
            function repay(i) {  // repay(i): runs when Finish is clicked; the customer holds its whole limit, finishes and repays it
              act.innerHTML = `${NAMES[i]} reached its limit of ${LIMIT[i]}, finishes and repays all ${LIMIT[i]} coins.`;  // reports that the customer finished and repaid its full limit
              loan[i] = 0; done[i] = true; paint();  // clears its loan, marks it finished and redraws
            }  // ends repay
            function reset() { loan = START.slice(); done = [false, false, false, false]; act.innerHTML = 'Lend coins one at a time and watch the verdict below.'; paint(); }  // reset(): puts back the starting loans, marks nobody finished, shows the opening hint and redraws
            const mode = ctx.ui.seg([{ value: 'careless', label: 'Lend whenever cash is there' }, { value: 'careful', label: 'Lend only if still safe' }], 'careless', (v) => {  // mode: a two-button switch between careless lending (any loan the vault can cover) and careful lending (only if still safe)
              careful = v === 'careful';  // careful is true when the second button is chosen
              act.innerHTML = careful ? 'Careful banker: a loan that would make the state unsafe is refused, even if the vault has the coin.' : 'Careless banker: any loan the vault can cover is granted.';  // explains the chosen banker's rule in the action line
            });  // ends the mode switch
            p.append(h('div', { class: 'stack', style: { gap: '8px' } },  // builds the tab: a stack of everything, 8 pixels apart
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, mode, h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Reset')),  // top row: the mode switch on the left and a Reset button on the right
              vBox, rBox, act, stat,  // then the vault, the customer rows, the action line and the verdict box
              h('p', { class: 'xs muted m0' }, 'Try: lend Cedar two coins in a row. Then reset, switch to “only if still safe”, and try again.')));  // a small suggestion of what to try: lend Cedar twice, then repeat in careful mode
            reset();  // starts the tab from the starting loans
          }  // ends lendTab

          /* Tab 2: the same unsafe state, two different futures. */
          function futureTab(p) {  // futureTab(p): fills tab 2, which plays two possible futures from the same unsafe state
            let which = 'insist';  // which: the chosen future, insist (everyone wants its full limit) or early (Birch needs less)
            const U = [3, 2, 4, 2];  // U: the unsafe starting loans, the start of tab 1 after Cedar borrowed two more coins
            function frames() {  // frames(): builds the list of animation frames for the chosen future
              const loan = U.slice(), done = [false, false, false, false], wait = [false, false, false, false], out = [];  // fresh copies of the loans plus who has finished and who is waiting; out collects the frames
              const snap = (cap, tone) => out.push({ loan: loan.slice(), done: done.slice(), wait: wait.slice(), cap, tone });  // snap(cap, tone): saves a snapshot of the loans, finished and waiting flags with its caption and tone
              const needs = () => NAMES.map((n, i) => (done[i] ? null : `${n} ${LIMIT[i] - loan[i]}`)).filter(Boolean).join(', ');  // needs(): lists each unfinished customer with how many coins it still needs, for the captions
              snap(`<b>Start.</b> ${NAMES[2]} has just borrowed two more coins. The vault holds ${cashOf(loan)}; the remaining needs are ${needs()}. No need fits, so the state is <b>unsafe</b>. Nobody is stuck yet.`, 'bad');  // frame 1: the unsafe start; the vault and the needs show that no need fits, though nobody is stuck yet
              if (which === 'insist') {  // future 1: every customer insists on its full limit
                loan[3] += 1;  // Dune borrows the last coin
                snap(`${NAMES[3]} asks for one more coin and gets the last one. The vault holds ${cashOf(loan)}; ${NAMES[3]} still needs ${LIMIT[3] - loan[3]}.`, 'warn');  // frame: the vault is now empty and Dune still needs more
                [0, 1, 2, 3].forEach((i) => {  // then each customer in turn asks for another coin
                  wait[i] = true;  // marks that customer as waiting
                  const all = wait.every(Boolean);  // all: true once every customer is waiting
                  snap(all ? `${NAMES[i]} asks too and waits. Now <b>every</b> customer waits for coins that only another waiting customer could repay. Nobody ever repays: <b>deadlock</b>.`  // when all are waiting, the caption names the deadlock: nobody can repay
                    : `${NAMES[i]} asks for another coin. The vault is empty, so ${NAMES[i]} <b>waits</b>.`, all ? 'bad' : 'warn');  // otherwise the caption says this customer waits because the vault is empty; the tone turns red only at deadlock
                });  // ends the loop over customers
              } else {  // future 2: Birch turns out to need less than its limit
                const back = loan[1]; loan[1] = 0; done[1] = true;  // back: Birch's loan; Birch repays it and finishes early
                snap(`${NAMES[1]}’s project turns out to need only the ${back} coins it already holds. ${NAMES[1]} finishes early and repays ${back}. The vault holds ${cashOf(loan)}, and ${NAMES[2]}’s need of ${LIMIT[2] - loan[2]} now fits: the state is <b>safe</b> again.`, 'ok');  // frame: Birch repays, the vault grows, and Cedar's need now fits, so the state is safe again
                [2, 0, 3].forEach((i) => {  // then Cedar, Alder and Dune finish in that order
                  const need = LIMIT[i] - loan[i], before = cashOf(loan);  // need: what this customer still needs; before: the vault count before its last coins
                  loan[i] = 0; done[i] = true;  // the customer gets its last coins, finishes and repays, so its loan becomes 0
                  snap(`${NAMES[i]} gets its last ${need} (vault ${before} → ${before - need}), finishes and repays ${LIMIT[i]}. Vault: <b>${cashOf(loan)}</b>.`, 'ok');  // frame: the coins it took, the vault before and after, and the vault once it repays
                });  // ends the loop over the remaining customers
                snap(`<b>Everyone finished.</b> The unsafe state did not turn into a deadlock, because ${NAMES[1]} did not use its whole limit. Unsafe means the banker can no longer <i>guarantee</i> success; it does not mean failure is certain.`, 'ok');  // final frame: everyone finished, so unsafe meant "not guaranteed", not "certain to fail"
              }  // ends the choice of future
              return out;  // returns the finished frame list
            }  // ends frames
            let fr = frames();  // fr: the frames for the future chosen now
            const vBox = h('div'), rBox = h('div');  // holders for the vault and the customer rows inside this tab
            const player = ctx.ui.player({ count: fr.length, interval: 2200, render: (i) => {  // player: the animation player with one frame per snapshot, moving on every 2.2 seconds when playing
              const f = fr[i];  // f: the snapshot for frame i
              vBox.replaceChildren(vaultEl(cashOf(f.loan)));  // redraws the vault from that frame's loans
              rBox.replaceChildren(rowsEl(f.loan, f.done, f.wait));  // redraws the customer rows, showing who has finished and who is waiting
              return `<span class="chip ${f.tone}" style="margin-right:6px">${f.tone === 'ok' ? 'safe' : f.tone === 'bad' && f.wait.every(Boolean) ? 'deadlock' : 'unsafe'}</span>` + f.cap;  // returns the caption: a tag saying safe, deadlock (red with everyone waiting) or unsafe, followed by the frame's text
            } });  // closes the render function and the player settings
            const seg = ctx.ui.seg([{ value: 'insist', label: 'Future 1: everyone insists' }, { value: 'early', label: 'Future 2: Birch needs less' }], which, (v) => { which = v; fr = frames(); player.setCount(fr.length); });  // switch between the two futures; choosing one rebuilds the frames and restarts the player with the new frame count
            p.append(h('div', { class: 'stack', style: { gap: '8px' } }, seg, vBox, rBox, player.el));  // builds the tab: the future switch, the vault, the customer rows and the player, stacked 8 pixels apart
            return () => player.stop();  // returns a tidy-up function so the animation stops when the student switches to the other tab
          }  // ends futureTab

          const tabs = ctx.ui.tabs([  // tabs: the two-tab widget for the vault
            { label: 'You are the lender', render: lendTab },  // tab 1: the student lends coins and sees the verdict
            { label: 'Unsafe: two futures', render: futureTab },  // tab 2: the same unsafe state played forward two ways
          ]);  // closes the tab list
          ctx.$('.bank-tabs').append(tabs);  // puts the tabs into the empty right column from the HTML
        },  // ends render() for step 2
      },  // ends step 2

      /* ---------------- 3. The notation ---------------- */
      {  // step 3 starts here
        title: 'The bookkeeping: R, V, C, A and C − A',  // step 3 title: the bookkeeping vectors and matrices
        kind: 'learn',  // kind learn: shown with the Learn label above the title
        render(el, ctx) {  // render(el, ctx): runs when step 3 opens and builds the clickable tables and the find-the-cell quiz
          const { h } = ctx;  // takes the HTML builder h out of the toolbox
          const st = EX, V = availOf(st), N = needOf(st);  // st: the running example; V: its free units; N: its need matrix
          const cells = {};  // cells: every clickable table cell, stored by its id so it can be outlined later
          // One clickable cell; id like 'A-2-0' (matrix, process, resource) or 'V-1' (vector, resource).
          function cell(id, val, cls) {  // cell(id, val, cls): builds one clickable table cell that explains itself when picked
            const td = h('td', { class: 'clk ' + (cls || ''), tabindex: 0, role: 'button', 'aria-label': id, onclick: () => pick(id),  // the cell can be reached with Tab, is announced as a button, and calls pick with its id when clicked
              onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); } } }, String(val));  // Enter or Space also pick it from the keyboard; preventDefault stops Space from scrolling the page; the cell shows the value
            cells[id] = td;  // remembers the cell under its id
            return td;  // hands the cell back
          }  // ends cell
          const slim = ctx.narrow ? ' slim' : '';  // slim: on phone-width screens the tables use the compact style
          const grp = (lab, cls) => h('th', { colspan: 3, class: cls + ' lft' }, lab);  // grp(lab, cls): a heading cell spanning three columns, naming one matrix (claim, allocation or need)
          const sub3 = (cls) => RN.map((r, j) => h('th', { class: cls + (j === 0 ? ' lft' : '') }, r));  // sub3(cls): the three column headings R1, R2 and R3 for one matrix, with a dividing line before the first
          const main = h('table', { class: 'mx' + (slim || ' roomy') },  // main: the large table with the claim, allocation and need matrices side by side (roomy on desktop)
            h('thead', {}, h('tr', {}, h('th', {}, ''), grp('Claim C', 'gC'), grp('Allocation A', 'gA'), grp('Need C − A', 'gN')),  // first heading row: an empty corner, then the three matrix names
              h('tr', {}, h('th', {}, 'Process'), ...sub3('gC'), ...sub3('gA'), ...sub3('gN'))),  // second heading row: the word Process, then R1 to R3 under each matrix
            h('tbody', {}, ...st.C.map((row, i) => h('tr', {}, h('td', { class: 'pname' }, pn(i)),  // one body row per process, starting with its name
              ...row.map((v, j) => cell(`C-${i}-${j}`, v, 'gC' + (j === 0 ? ' lft' : ''))),  // the process's claim row, each value a clickable cell with an id like C-0-2
              ...st.A[i].map((v, j) => cell(`A-${i}-${j}`, v, 'gA' + (j === 0 ? ' lft' : ''))),  // its allocation row, ids like A-0-2
              ...N[i].map((v, j) => cell(`N-${i}-${j}`, v, 'gN' + (j === 0 ? ' lft' : '')))))));  // its need row, ids like N-0-2, which closes the row, the body and the table
          const vec = h('table', { class: 'mx' + slim, style: { width: 'auto', flex: '0 0 auto' } },  // vec: the small table for the two vectors, only as wide as its content
            h('thead', {}, h('tr', {}, h('th', {}, 'Vector'), ...RN.map((r) => h('th', {}, r)))),  // its heading row: Vector, then R1 to R3
            h('tbody', {}, h('tr', {}, h('td', { class: 'pname' }, 'R (total)'), ...st.R.map((v, j) => cell(`R-${j}`, v))),  // row R (total), each value a clickable cell with an id like R-0
              h('tr', {}, h('td', { class: 'pname' }, 'V (free)'), ...V.map((v, j) => cell(`V-${j}`, v)))));  // row V (free), ids like V-0, which closes the vector table
          // The three relationships, checked on the live numbers.
          const colSum = (j) => st.A.map((r) => r[j]);  // colSum(j): the allocation values in column j, one per process
          const r1 = RN.map((r, j) => `${r}: ${st.R[j]} = ${V[j]} + (${colSum(j).join(' + ')})`).join('<br>');  // r1: for each resource type, the total written as free plus every allocation, e.g. "R1: 9 = 2 + (0 + 1 + 3 + 3)"
          const okC = st.C.every((row) => row.every((c, j) => c <= st.R[j]));  // okC: checks that no claim is bigger than the system's total for that type
          const okA = st.A.every((row, i) => row.every((a, j) => a <= st.C[i][j]));  // okA: checks that no allocation is bigger than the matching claim
          const mark = (b) => h('span', { class: b ? 'ok' : '', style: b ? null : { color: 'var(--bad)', fontWeight: 900 } }, b ? '✓' : '✗');  // mark(b): a green tick if the fact holds, a red cross if not
          const rules = h('div', { class: 'card tight stack', style: { gap: '4px', flex: ctx.narrow ? '1 1 100%' : '1 1 0', minWidth: 0 } }, h('div', { class: 'lbl' }, 'THREE FACTS THAT ALWAYS HOLD'),  // rules: the card listing the three facts; it takes the full width on phone-width screens, otherwise shares the row
            h('div', { class: 'rule' }, mark(true), h('span', { html: `<b>R = V + column sums of A.</b> Every unit is either free or held.<div class="mono xs" style="margin-top:2px">${r1}</div>` })),  // fact 1: R equals V plus the column sums of A, with the worked sums for each type underneath
            h('div', { class: 'rule' }, mark(okC), h('span', { html: '<b>C[i][j] ≤ R[j].</b> Nobody may claim more than the system owns.' })),  // fact 2: no claim exceeds the system's total, ticked if okC holds
            h('div', { class: 'rule' }, mark(okA), h('span', { html: '<b>A[i][j] ≤ C[i][j].</b> Nobody may hold more than it claimed.' })));  // fact 3: no allocation exceeds its claim, ticked if okA holds

          // Right side: explanation of the picked cell, or the find-the-cell challenge.
          const title = h('div', { class: 'row gap-s' });  // title: the tag naming the clicked cell, e.g. "V[R1] = 2"
          const say = h('p', { class: 'm0', style: { fontSize: '16px' } });  // say: the sentence explaining what the clicked number means
          const calc = h('div', { class: 'mono small', style: { minHeight: '22px' } });  // calc: the calculation behind the number, in fixed-width type, when there is one
          const QS = [  // QS: the find-the-cell questions, each paired with the id of the correct cell
            ['How many units of R1 does the system own in total?', 'R-0'],  // question: a total in R
            ['How many units of R2 are free right now?', 'V-1'],  // question: a free count in V
            ['What is the most R3 that P1 may ever hold at once?', 'C-0-2'],  // question: a claim in C
            ['How many units of R1 does P3 hold right now?', 'A-2-0'],  // question: an allocation in A
            ['How many more units of R2 may P3 still ask for?', 'N-2-1'],  // question: a need for P3
            ['How many more units of R3 may P4 still ask for?', 'N-3-2'],  // question: a need for P4
          ];  // closes the question list
          let mode = 'explore', qi = 0, right = 0, tried = 0, answered = false;  // mode: explore or quiz; qi: the current question; right and tried: the score; answered: whether this question is done
          const prompt = h('div', { class: 'narr', style: { minHeight: '60px' } });  // prompt: the narration box that shows the current question and the result
          const score = h('span', { class: 'chip accent' });  // score: the "right of tried" tag
          const nextBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { qi = (qi + 1) % QS.length; askQ(); } }, 'Next question');  // Next question: moves to the following question, wrapping back to the first after the last
          const quizBox = h('div', { class: 'stack', style: { gap: '8px', display: 'none' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, 'Find the cell'), score), prompt, h('div', {}, nextBtn));  // quizBox: the quiz area, hidden until quiz mode: a heading with the score, the prompt and the Next button
          function explain(id) {  // explain(id): returns the tag text, its colour, the explanation, the calculation and the related cells for one cell id
            const [m, a, b] = id.split('-').map((x, k) => (k ? Number(x) : x));  // splits the id into its letter (which table) and its numbers (process and resource type)
            if (m === 'R') return [`R[${RN[a]}] = ${st.R[a]}`, 'os', `The system owns <b>${st.R[a]}</b> units of ${RN[a]} in total. This number never changes while the banker runs.`, '', []];  // R: the system's total for a type, which never changes
            if (m === 'V') return [`V[${RN[a]}] = ${V[a]}`, 'ok', `<b>${V[a]}</b> unit${V[a] === 1 ? '' : 's'} of ${RN[a]} ${V[a] === 1 ? 'is' : 'are'} free right now: the total minus everything that processes hold.`, `${st.R[a]} − (${colSum(a).join(' + ')}) = ${V[a]}`, [`R-${a}`, ...st.A.map((_, i) => `A-${i}-${a}`)]];  // V: the free count, with the subtraction that gives it and the R and allocation cells that feed it
            if (m === 'C') return [`C[${pn(a)}][${RN[b]}] = ${st.C[a][b]}`, 'os', `${pn(a)} declared, before it started, that it may need up to <b>${st.C[a][b]}</b> units of ${RN[b]} at the same time. The banker plans for this worst case.`, '', []];  // C: a claim, the most a process declared it may hold at once
            if (m === 'A') return [`A[${pn(a)}][${RN[b]}] = ${st.A[a][b]}`, 'proc', `${pn(a)} holds <b>${st.A[a][b]}</b> unit${st.A[a][b] === 1 ? '' : 's'} of ${RN[b]} right now.`, '', []];  // A: how many units a process holds right now
            return [`Need[${pn(a)}][${RN[b]}] = ${N[a][b]}`, 'warn', `${pn(a)} may still ask for <b>${N[a][b]}</b> more unit${N[a][b] === 1 ? '' : 's'} of ${RN[b]} before it reaches its claim.`, `claim ${st.C[a][b]} − allocation ${st.A[a][b]} = ${N[a][b]}`, [`C-${a}-${b}`, `A-${a}-${b}`]];  // need: how many more units the process may ask for, worked out as claim minus allocation, with those two cells outlined
          }  // ends explain
          function light(id, extra) {  // light(id, extra): outlines the chosen cell strongly and the cells that feed into it lightly
            Object.entries(cells).forEach(([k, td]) => { td.classList.toggle('hot', k === id); td.classList.toggle('sum', extra.includes(k)); });  // goes through every clickable cell, adding hot to the chosen one and sum to the related ones, and clearing both elsewhere
          }  // ends light
          function pick(id) {  // pick(id): runs when a cell is clicked or chosen with the keyboard
            const [t, cls, txt, c, extra] = explain(id);  // gets the cell's explanation
            light(id, extra);  // outlines the cell and the cells it depends on
            title.innerHTML = `<span class="chip ${cls}" style="font-size:15px">${t}</span>`;  // shows the cell's tag in its matrix colour
            say.innerHTML = txt; calc.textContent = c;  // writes the explanation and the calculation
            if (mode === 'quiz' && !answered) {  // in quiz mode, the first pick for a question is marked
              const want = QS[qi][1], good = id === want;  // want: the correct cell; good: whether the student picked it
              tried++; if (good) right++; answered = true;  // counts the attempt and, if right, the point; the question is now answered
              prompt.className = 'narr ' + (good ? 'ok' : 'bad');  // colours the prompt green or red
              prompt.innerHTML = (good ? '<b>Yes.</b> ' : `<b>Not that one.</b> The right cell is ${explain(want)[0]}, now outlined. `) + QS[qi][0];  // says Yes, or names the right cell; then repeats the question
              if (!good) light(want, explain(want)[4]);  // after a wrong pick, outlines the right cell and the cells behind it instead
              score.textContent = `${right} of ${tried}`;  // updates the score tag
            }  // ends the quiz case
          }  // ends pick
          function askQ() { answered = false; prompt.className = 'narr'; prompt.innerHTML = QS[qi][0] + ' <span class="muted">Click the cell.</span>'; light(null, []); title.innerHTML = ''; say.innerHTML = '<span class="muted">The cell you click is explained here.</span>'; calc.textContent = ''; }  // askQ(): shows the current question, clears all outlines and empties the explanation area until a cell is picked
          const seg = ctx.ui.seg([{ value: 'explore', label: 'Explain a cell' }, { value: 'quiz', label: 'Find the cell' }], mode, (v) => {  // switch between explaining cells and the find-the-cell quiz
            mode = v; quizBox.style.display = v === 'quiz' ? '' : 'none';  // records the mode and shows the quiz area only in quiz mode
            ctx.$('.names-tip').style.display = v === 'quiz' ? 'none' : '';  // hides the "Reading the names" tip in quiz mode, since it would give hints, and shows it again when exploring
            if (v === 'quiz') { score.textContent = `${right} of ${tried}`; askQ(); }  // on entering quiz mode, shows the score so far and asks the current question
          });  // ends the mode switch
          el.append(h('div', { class: 'split r fill' },  // builds the step: two columns, the wider one on the left
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the intro, the tables and the three facts, stacked 10 pixels apart
              h('p', { class: 'm0', html: 'With several resource types, the banker keeps two vectors and two matrices and works out one more matrix. Here are four processes and three resource types (R1, R2, R3). <b>Click any number.</b>' }),  // intro sentence: the banker's two vectors and two matrices, plus the need matrix it works out; click any number
              main, h('div', { class: 'row', style: { gap: '12px', alignItems: 'flex-start', flexWrap: ctx.narrow ? 'wrap' : 'nowrap' } }, vec, rules)),  // the big matrix table, then a row with the vector table and the three-facts card (wrapping on phone-width screens)
            h('div', { class: 'stack', style: { gap: '10px' } }, seg,  // right column: the mode switch first
              h('div', { class: 'card white stack', style: { gap: '8px', minHeight: '150px' } }, title, say, calc),  // a white card holding the clicked cell's tag, explanation and calculation
              quizBox,  // the quiz area (hidden unless in quiz mode)
              h('div', { class: 'callout why small m0', 'data-label': 'Why the need matrix matters', html: 'The safety test compares each row of C − A with the units that are free. A process can surely finish only if its <i>whole</i> row fits, column by column.' }),  // why box: the safety test compares whole rows of the need matrix with the free units
              h('div', { class: 'callout tip small m0 names-tip', 'data-label': 'Reading the names', html: 'A <span class="t" data-t="resource vector">vector</span> has one number per resource type; a matrix has one row per process and one column per resource type. <span class="t" data-t="claim matrix">C</span> is declared in advance, <span class="t" data-t="allocation matrix">A</span> is held now, <span class="t" data-t="available vector">V</span> is free now, and the <span class="t" data-t="need matrix">need</span> C − A is what may still be asked for.' }))));  // tip box: how to read vector, matrix, C, A, V and need, each a dotted glossary term; hidden in quiz mode
          pick('V-0');  // starts by explaining the free units of R1, so the right column is never empty
        },  // ends render() for step 3
      },  // ends step 3

      /* ---------------- 4. Process initiation denial vs the banker ---------------- */
      {  // step 4 starts here
        title: 'Approach 1: refuse to start a process',  // step 4 title: refusing to start a process (process initiation denial)
        kind: 'compare',  // kind compare: shown with the Compare label above the title
        html: `${/* the fixed page content of step 4, written as HTML text inside backticks */''}
          <div class="split l fill">${/* a two-column layout, smaller on the left: the rule on the left, the interactive comparison on the right */''}
            <div class="stack" style="gap:10px">${/* left column: a stack of paragraphs with 10 pixels between them */''}
              <p class="lead m0">The bluntest kind of avoidance acts only at the door, when a process asks to start.</p>${/* opening sentence: this kind of avoidance acts only when a process asks to start */''}
              <p class="m0"><span class="t">Process initiation denial</span> admits a new process P<sub>n+1</sub> only if, for <b>every</b> resource type j,</p>${/* paragraph introducing the admission rule, which must hold for every resource type */''}
              <div class="card white center mono" style="font-size:17px;padding:10px">R[j] ≥ C[n+1][j] + Σ<sub>i=1..n</sub> C[i][j]</div>${/* the admission formula in a white box: the total must cover the newcomer's claim plus all running claims */''}
              <p class="m0">In words: the newcomer’s claim plus the claims of everyone already running must fit inside the total. Only claims are added; what processes hold right now does not matter.</p>${/* the formula in words: only claims are added; current holdings do not matter */''}
              <div class="callout why m0" data-label="Why it is far from optimal">The rule assumes the worst possible moment: every process demanding its whole claim at once. That is rare, so most of the reserved capacity sits idle while processes that could have run safely are kept out.</div>${/* why box: the rule plans for everyone needing their full claim at once, so capacity sits idle */''}
            </div>${/* ends the left column */''}
            <div class="stack init-box" style="gap:8px;min-height:0"></div>${/* empty right column where render() puts the switch, buttons, drawing and narration */''}
          </div>`,  // ends the layout and the HTML text of step 4
        render(el, ctx) {  // render(el, ctx): runs when step 4 opens and builds the start-a-process experiment
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const st = EX, n = st.C.length;  // st: the running example; n: the number of processes (4)
          if (ctx.narrow) el.querySelector('.card.white.mono').style.fontSize = '14px';  // keeps the formula on one line on small screens
          let mode = 'deny', on = [false, false, false, false];  // mode: deny (initiation denial) or bank (banker's algorithm); on: which processes are running
          const sumClaims = (set) => RN.map((_, j) => set.reduce((t, i) => t + st.C[i][j], 0));  // sumClaims(set): adds up the claims of a group of processes, one total per resource type
          const fits = (set) => leq(sumClaims(set), st.R);  // fits(set): true if the group's claims fit inside the totals R in every column
          // Best case under initiation denial, found by trying every subset.
          let best = 0; const bestSets = [];  // best: the largest group that fits; bestSets: every group of that size, written like "P1 + P2"
          for (let m = 1; m < 1 << n; m++) {  // tries every group of processes; m is a bit pattern where bit i set means process i is in the group (1 to 15)
            const set = [...Array(n).keys()].filter((i) => m & (1 << i));  // set: the processes in this group, read from the bits of m
            if (!fits(set)) continue;  // skips groups whose claims do not fit
            if (set.length > best) { best = set.length; bestSets.length = 0; }  // a bigger group that fits becomes the new best, and the list of best groups starts again
            if (set.length === best) bestSets.push(set.map(pn).join(' + '));  // a group as large as the best is added to the list
          }  // ends the search over groups
          // Small screens get a tighter drawing (about 330 units wide, smaller units) so its text stays readable.
          const G = ctx.narrow ? { W: 330, H: 178, U: 16, X0: 34, pitch: 56, bar: 26, pFont: 11, labX: 4 } : { W: 640, H: 196, U: 26, X0: 62, pitch: 62, bar: 32, pFont: 13, labX: 62 };  // G: the drawing's measurements: overall size, pixels per unit, left margin, row spacing, bar height, label size and position
          const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%' });  // creates the SVG drawing at that size, scaled to the full width of its box
          const narr = h('div', { class: 'narr', style: { minHeight: '58px' } });  // narr: the narration box under the drawing, explaining each admission or refusal
          const count = h('span', { class: 'chip accent' });  // count: the tag showing how many processes are running
          const btnRow = h('div', { class: 'grid-4', style: { gap: '8px' } });  // btnRow: four buttons in a grid, one per process
          const U = G.U, X0 = G.X0;  // U: the width of one unit in the drawing; X0: where the bars start
          function draw() {  // draw(): redraws the bars, the running count and the buttons from the current state
            const set = on.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);  // set: the indexes of the processes running now
            const kids = [];  // kids: the shapes of the new drawing
            RN.forEach((r, j) => {  // one bar per resource type
              const y = 10 + j * G.pitch, bh = G.bar - 6;  // y: the top of this type's bar; bh: the height of a claim block inside it
              kids.push(s('text', { x: ctx.narrow ? 4 : 6, y: y + G.bar / 2 + 6, 'font-weight': 800, 'font-size': 16 }, r));  // the resource name (R1, R2 or R3) at the left of its bar
              kids.push(s('rect', { x: X0, y, width: st.R[j] * U, height: G.bar, rx: 6, class: 's-panel', 'stroke-dasharray': '5 4' }));  // a dashed outline as long as the system's total of this type: the space claims must fit in
              let x = X0, used = 0;  // x: where the next claim block starts; used: units claimed so far in this type
              set.forEach((i) => {  // for each running process, draws its claim in this type
                const c = st.C[i][j], overCls = mode === 'deny' ? 's-bad' : 's-warn';  // c: the process's claim of this type; overCls: the colour for any part beyond the total, red under denial, amber under the banker
                if (ctx.narrow && c) {  // on phone-width screens, each claim is drawn as one block instead of one box per unit
                  // Small screens: one block per process (split where it passes the total), easier to read than tiny unit boxes.
                  const inside = Math.max(0, Math.min(c, st.R[j] - used));  // inside: how much of this claim still fits within the total
                  if (inside) kids.push(s('rect', { x: x + 1, y: y + 3, width: inside * U - 2, height: bh, rx: 4, class: 's-os', 'stroke-width': 1.5 }));  // the part that fits, in purple
                  if (c > inside) kids.push(s('rect', { x: x + inside * U + 1, y: y + 3, width: (c - inside) * U - 2, height: bh, rx: 4, class: overCls, 'stroke-width': 1.5 }));  // the part beyond the total, if any, in red or amber
                } else for (let u = 0; u < c; u++) {  // on desktop, one small box per unit of the claim
                  const over = used + u >= st.R[j];  // over: true for units past the system's total
                  kids.push(s('rect', { x: x + u * U + 1, y: y + 3, width: U - 2, height: bh, rx: 4, class: over ? overCls : 's-os', 'stroke-width': 1.5 }));  // draws the unit box, purple if inside the total, red or amber if past it
                }  // ends the unit loop
                if (c) kids.push(s('text', { x: x + (c * U) / 2, y: y + G.bar / 2 + 5, 'text-anchor': 'middle', 'font-size': G.pFont, 'font-weight': 800 }, pn(i)));  // writes the process name in the middle of its claim
                x += c * U; used += c;  // moves along by the width of this claim and adds it to the units used
              });  // ends the loop over running processes
              const cx = X0 + st.R[j] * U;  // cx: the position where the system's total ends
              kids.push(s('line', { x1: cx, y1: y - 5, x2: cx, y2: y + G.bar + 5, class: 's-line' }));  // draws a vertical line there, so it is clear where the claims overflow
              // Claims beyond R are forbidden under initiation denial but normal under the banker.
              const extra = used - st.R[j], tone = extra > 0 ? (mode === 'deny' ? 'bad' : 'warn') : '';  // extra: how many units the claims go past the total; tone: red under denial, amber under the banker, none if they fit
              kids.push(s('text', { x: G.labX, y: y + G.bar + 17, 'font-size': 13, style: tone ? 'fill:var(--' + tone + ')' : '', 'font-weight': 700 }, `${used} claimed, ${st.R[j]} exist${extra > 0 ? (mode === 'deny' ? ' (over by ' + extra + ')' : ctx.narrow ? ` (${extra} extra: allowed)` : ` (${extra} more than exist: allowed)`) : ''}`));  // the label under the bar: units claimed against units that exist, noting any overflow (forbidden or allowed)
            });  // ends the loop over resource types
            svg.replaceChildren(...kids);  // replaces the drawing's contents with the new shapes
            count.textContent = `${set.length} of ${n} running`;  // updates the running count
            btnRow.replaceChildren(...st.C.map((c, i) => h('button', { class: 'btn sm' + (on[i] ? ' on' : ''), type: 'button', 'aria-pressed': on[i], onclick: () => toggle(i), style: { height: 'auto', padding: '5px 6px', flexDirection: 'column' } },  // rebuilds the four buttons; each shows Start or Stop, is highlighted while running, and calls toggle when clicked
              h('b', {}, (on[i] ? 'Stop ' : 'Start ') + pn(i)), h('span', { class: 'mono xs' }, 'claim ' + vs(c)))));  // each button shows its action and process name in bold, with the process's claim underneath in small type
          }  // ends draw
          function toggle(i) {  // toggle(i): runs when a process's button is clicked: stops a running process or tries to start a new one
            const set = on.map((b, k) => (b ? k : -1)).filter((k) => k >= 0);  // set: the processes running before this click
            if (on[i]) { on[i] = false; narr.className = 'narr'; narr.innerHTML = `${pn(i)} finishes and leaves. Its claim no longer counts.`; draw(); return; }  // a running process finishes and leaves; its claim stops counting, and the drawing is redrawn
            const after = sumClaims([...set, i]);  // after: the claim totals if this process were added
            const bad = RN.filter((_, j) => after[j] > st.R[j]);  // bad: the resource types where those totals would exceed what exists
            if (mode === 'deny' && bad.length) {  // under initiation denial, any overflow means the process is refused
              const j = RN.indexOf(bad[0]);  // j: the first resource type that overflows
              narr.className = 'narr bad';  // colours the narration red
              narr.innerHTML = `<b>Refused.</b> ${pn(i)} must wait outside. In ${bad[0]} the claims would total ${[...set, i].map((k) => st.C[k][j]).join(' + ')} = ${after[j]}, more than the ${st.R[j]} units that exist${bad.length > 1 ? `; ${bad.slice(1).join(' and ')} would overflow too` : ''}.${set.length >= best ? ` No larger group fits: this rule never lets more than ${best} of these processes run together.` : ''}`;  // explains the refusal with the sum that overflows, any other overflowing types, and, if relevant, that no larger group fits
              return;  // stops without starting the process
            }  // ends the refusal case
            on[i] = true;  // the process starts
            narr.className = 'narr ok';  // colours the narration green
            narr.innerHTML = mode === 'deny' ? `<b>Admitted.</b> Claims now total ${vs(after)}, within the totals ${vs(st.R)} in every column.`  // under denial, reports the new claim totals and that they fit in every column
              : `<b>Admitted.</b> The banker only checks that ${pn(i)}’s own claim ${vs(st.C[i])} fits within ${vs(st.R)}. Claims may add up to more than exists, because every later <i>request</i> will be checked.`;  // under the banker, explains that only the process's own claim is checked at the start, since every later request is checked
            draw();  // redraws the bars and buttons with the new process running
          }  // ends toggle
          function setMode(v) {  // setMode(v): switches between the two policies and starts again with no process running
            mode = v; on = [false, false, false, false];  // records the policy and stops every process
            narr.className = 'narr';  // clears the narration colour
            narr.innerHTML = v === 'deny' ? 'Start processes one by one. A newcomer is admitted only if all the claims still fit. Can you get three running at once?' : 'Under the banker’s algorithm, any process whose own claim fits in the totals may start. Start all four.';  // gives the instruction for the chosen policy: a challenge to run three under denial, or to start all four under the banker
            draw();  // redraws the empty bars
          }  // ends setMode
          const seg = ctx.ui.seg([{ value: 'deny', label: 'Initiation denial' }, { value: 'bank', label: 'Banker’s algorithm' }], mode, setMode);  // the switch between initiation denial and the banker's algorithm; choosing one calls setMode
          const note = h('div', { class: 'small', html: `<b>Same four processes, two policies.</b> Under initiation denial at most <b>${best}</b> can run together (${bestSets.join(', ')}). The banker lets all ${n} run at once: the example state from the previous step has all four holding resources, and the next steps show it is safe.` });  // note: the hidden summary: the most processes denial allows (and which groups), against all four under the banker
          ctx.$('.init-box').append(  // fills the empty right column from the HTML
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, count), btnRow,  // top row: the policy switch on the left and the running count on the right, then the process buttons
            h('div', { class: 'card white tight' }, svg), narr,  // the drawing in a white card, then the narration box
            ctx.ui.reveal('Compare the two policies', note));  // a button that reveals the comparison note when clicked
          setMode('deny');  // starts in initiation-denial mode
        },  // ends render() for step 4
      },  // ends step 4

      /* ---------------- 5. The safety test, step by step ---------------- */
      {  // step 5 starts here
        title: 'The safety test, line by line',  // step 5 title: the safety test, line by line
        kind: 'explore',  // kind explore: shown with the Explore label above the title
        core: true,  // core: this step is part of the shorter core path through the course
        render(el, ctx) {  // render(el, ctx): runs when step 5 opens and builds the step-through safety test
          const { h } = ctx;  // takes the HTML builder h out of the toolbox
          // Three states to test: the example, and two tentative grants made on paper.
          const bump = (i, q) => { const t = clone(EX); t.A[i] = add(t.A[i], q); return t; };  // bump(i, q): a copy of the example in which process i holds q more units, a grant made on paper
          const PRESETS = {  // PRESETS: the three states the student can test
            ex: { label: 'Example state', st: EX },  // the example state itself (safe)
            r2: { label: 'If P1 held one more R2', st: bump(0, [0, 1, 0]) },  // the example after giving P1 one more unit of R2 (unsafe)
            r3: { label: 'If P1 held two more R3', st: bump(0, [0, 0, 2]) },  // the example after giving P1 two more units of R3
          };  // closes PRESETS
          const SRC = `${/* SRC: the safety-test pseudo-code shown to the student, one statement per line with its own short comment */''}
work = V;                       // what is free now${/* shown code, line 1: work starts as the free units */''}
rest = {P1, P2, P3, P4};        // nobody placed yet${/* shown code, line 2: every process starts in rest, unplaced */''}
while (rest not empty) {        // someone is still left${/* shown code, line 3: the loop runs while anyone is unplaced */''}
  find Pk in rest with          // scan rest, front first${/* shown code, line 4: scan rest from the front for a process */''}
    C[k] - A[k] <= work;        // whole need fits in work${/* shown code, line 5: whose whole need fits in work */''}
  if (none found) break;        // stuck: stop searching${/* shown code, line 6: if none fits, the search stops */''}
  work = work + A[k];           // Pk ends, returns A[k]${/* shown code, line 7: the chosen process finishes and returns what it holds */''}
  remove Pk from rest;          // Pk is next in the order${/* shown code, line 8: it is removed from rest and becomes next in the order */''}
}                               // go round and search again${/* shown code, line 9: the end of the loop, which goes round to search again */''}
safe = (rest is empty);         // safe if all were placed`;  // shown code, line 10: the state is safe only if rest ended up empty; ends the listing
          const code = ctx.ui.code(ctx.narrow ? SRC.replace(/ {2,}\/\//g, '  //') : SRC, { lang: 'c', fontSize: 13.5 });  // builds the numbered code listing; on phone-width screens the long gaps before each comment shrink to two spaces so lines are shorter
          if (ctx.narrow) code.classList.add('wrap');  // on phone-width screens the listing also wraps long lines
          let key = 'ex', st, res, need, V;  // key: the chosen state; st, res, need and V: that state, its safety-test result, its need matrix and its free units
          const tblBox = h('div'), workBox = h('div', { class: 'stack', style: { gap: '6px' } });  // tblBox: the holder for the table; workBox: the box showing work, rest and the order so far
          const vecEl = (v, cls, missCols) => h('span', { class: 'vec ' + (cls || '') }, ...v.map((x, j) => h('span', { class: missCols && missCols[j] ? 'miss' : '' }, String(x))));  // vecEl(v, cls, missCols): draws a vector as a row of boxes, marking in red the columns listed in missCols
          function load(k) {  // load(k): switches to preset k and runs the safety test on it, keeping every frame for the player
            key = k; st = PRESETS[k].st; res = safety(st); need = needOf(st); V = availOf(st);  // stores the state, runs the test, and works out the need matrix and free units for the captions
          }  // ends load
          function table(f) {  // table(f): builds the need and allocation table as it looks at frame f of the safety test
            const slim = ctx.narrow ? ' slim' : ' roomy';  // slim on phone-width screens, roomy on desktop
            const head = h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', { colspan: 3, class: 'gN lft' }, 'Need C − A'), h('th', { colspan: 3, class: 'gA lft' }, 'Allocation A'), h('th', { class: 'lft' }, 'Place')),  // first heading row: the need and allocation groups and a Place column
              h('tr', {}, h('th', {}, 'Process'), ...RN.map((r, j) => h('th', { class: 'gN' + (j ? '' : ' lft') }, r)), ...RN.map((r, j) => h('th', { class: 'gA' + (j ? '' : ' lft') }, r)), h('th', { class: 'lft' }, 'in order')));  // second heading row: Process, R1 to R3 under each group, and "in order"
            const rows = st.C.map((_, i) => {  // one row per process
              const placed = f.seq.indexOf(i), isCand = (f.type === 'check' || f.type === 'release') && f.k === i;  // placed: the process's position in the order (or -1); isCand: whether it is the process being checked or released now
              const needCls = (j) => 'gN' + (j ? '' : ' lft') + (f.type === 'check' && f.k === i ? (f.short[j] ? ' miss' : ' fit') : '');  // needCls(j): the need cell's class; while it is checked, each column is green if it fits and red if it does not
              const aCls = (j) => 'gA' + (j ? '' : ' lft') + (f.type === 'release' && f.k === i ? ' hot' : '');  // aCls(j): the allocation cell's class; while the process releases its units, its allocation is outlined
              const place = placed >= 0 ? h('span', { class: 'chip ok' }, '#' + (placed + 1)) : (f.type === 'stuck' || (f.type === 'end' && !f.safe)) ? h('span', { class: 'chip bad' }, 'stuck') : h('span', { class: 'muted' }, '–');  // place: a green #1, #2... once placed, a red "stuck" tag if the test got stuck, otherwise a dash
              return h('tr', { class: (isCand ? 'cand' : '') + (placed >= 0 && !(f.type === 'release' && f.k === i) ? ' done' : '') }, h('td', { class: 'pname' }, pn(i)),  // the row: outlined if it is the candidate, faded once placed (except while it is releasing); then the process name
                ...need[i].map((v, j) => h('td', { class: needCls(j) }, String(v))), ...st.A[i].map((v, j) => h('td', { class: aCls(j) }, String(v))), h('td', { class: 'lft' }, place));  // then its need cells, its allocation cells and its place in the order
            });  // ends the row builder
            return h('table', { class: 'mx' + slim }, head, h('tbody', {}, ...rows));  // returns the finished table
          }  // ends table
          function render(i) {  // render(i): the player calls this for frame i; it redraws the table, the work box and the code highlight, and returns the caption
            const f = res.frames[i];  // f: the frame recorded by the safety test
            tblBox.replaceChildren(table(f));  // redraws the table for this frame
            const restTxt = f.rest.length ? f.rest.map(pn).join(', ') : 'empty';  // restTxt: the processes still in rest, or "empty"
            const seqTxt = f.seq.length ? f.seq.map(pn).join(' → ') : 'none yet';  // seqTxt: the order found so far, joined by arrows, or "none yet"
            workBox.replaceChildren(  // refills the work box with three rows
              h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'lbl', style: { width: '64px' } }, 'WORK'), vecEl(f.work, 'ok', f.type === 'check' ? f.short : null),  // WORK: the work vector as boxes, with short columns marked red during a check
                f.type === 'release' ? h('span', { class: 'small mono' }, `= ${vs(f.before)} + ${vs(st.A[f.k])}`) : null),  // during a release, the addition that produced the new work is written beside it
              h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'lbl', style: { width: '64px' } }, 'REST'), h('span', { class: 'mono b' }, restTxt)),  // REST: the processes not yet placed
              h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'lbl', style: { width: '64px' } }, 'ORDER'), h('span', { class: 'mono b' }, seqTxt)));  // ORDER: the safe order so far
            code.clear();  // removes all highlights from the code
            if (f.type === 'start') { code.mark([1, 2]); return `<b>Start.</b> work = V = ${vs(f.work)}, the units free right now. rest holds all four processes. ${key === 'ex' ? '' : `(This state is the example with ${PRESETS[key].label.slice(3).replace('held', 'holding')}, so V is ${vs(V)}.)`}`; }  // start frame: lights lines 1-2 and says work equals the free units; for the other presets, names the change made on paper
            if (f.type === 'check') {  // check frame: a process is being tested
              code.mark([4, 5], f.ok ? 'ok' : 'cur');  // lights lines 4-5, green if its need fits and plain if not
              if (f.ok) return `Check <b>${pn(f.k)}</b>: is its need ${vs(need[f.k])} ≤ work ${vs(f.work)}? <b>Yes</b>, in every column. ${pn(f.k)} could be given everything it may still ask for.`;  // if it fits, says yes in every column
              const j = f.short.indexOf(true);  // j: the first column where the need is bigger than work
              return `Check <b>${pn(f.k)}</b>: is its need ${vs(need[f.k])} ≤ work ${vs(f.work)}? <b>No</b>: it may still want ${need[f.k][j]} of ${RN[j]}, but work has only ${f.work[j]}. ${pn(f.k)} stays in rest; try the next one.`;  // if not, names that column and the numbers, and says the scan moves to the next process
            }  // ends the check case
            if (f.type === 'release') { code.mark([7, 8]); return `Pretend ${pn(f.k)} is given its remaining need, runs to completion and returns everything. The net gain to work is what ${pn(f.k)} held: work = ${vs(f.before)} + ${vs(st.A[f.k])} = <b>${vs(f.work)}</b>. ${pn(f.k)} takes place ${f.seq.length} in the order${f.rest.length ? ', and the scan starts again at the front of rest' : ''}.`; }  // release frame: lights lines 7-8 and shows work growing by what the finished process held
            if (f.type === 'stuck') { code.mark(6, 'bad'); return `Nobody left in rest (${restTxt}) has a need that fits in work ${vs(f.work)}. The search is <b>stuck</b> and stops.`; }  // stuck frame: lights line 6 in red and says nobody left in rest fits
            code.mark(10, f.safe ? 'ok' : 'bad');  // end frame: lights line 10, green if safe and red if not
            return f.safe ? `<b>rest is empty, so the state is SAFE.</b> One safe sequence: ${seqTxt}. Other orders might also work; finding one is enough.`  // safe: rest is empty; gives the safe order and notes that other orders may also work
              : `<b>rest still holds ${restTxt}, so the state is UNSAFE.</b> ${f.seq.length ? `Only ${seqTxt} could be placed. ` : ''}No order is guaranteed to finish everyone. It need not be a deadlock, but the banker never steps into such a state on purpose.`;  // unsafe: names who is left over and stresses that unsafe does not have to mean deadlock
          }  // ends render
          load(key);  // loads the example state first
          const player = ctx.ui.player({ count: res.frames.length, render, interval: 1900 });  // player: the animation player with one frame per step of the safety test, moving on every 1.9 seconds when playing
          const seg = ctx.ui.seg(Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })), key, (v) => { load(v); player.setCount(res.frames.length); });  // the switch between the three states; choosing one reruns the test and restarts the player with the new frame count
          const whyAdd = h('div', { class: 'callout tip small m0', 'data-label': 'Why add A[k] and not C[k]?', html: 'P<sub>k</sub> first takes its remaining need out of work, then hands back everything it then holds, which is its whole claim C[k] = A[k] + need. The net change to work is + A[k].' });  // whyAdd: a tip box explaining why work grows by A[k] and not by the whole claim
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the step: a stack that fills the step height
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'State to test'), seg),  // top row: the label "State to test" and the state switch
            h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 11fr) minmax(0, 10fr)', gap: '18px' } },  // below it two columns, the left slightly wider
              h('div', { class: 'stack', style: { gap: '10px' } }, tblBox, h('div', { class: 'card tight' }, workBox), ctx.narrow ? null : whyAdd),  // left column: the table, the work box in a card and, on desktop, the A[k] tip
              h('div', { class: 'stack', style: { gap: '10px' } }, code, player.el,  // right column: the code listing and the player
                h('div', { class: 'callout why small m0', 'data-label': 'Why taking the first fit is enough', html: 'Letting a process finish only ever <i>adds</i> units to work. So picking any process that fits can never spoil an order that exists. If the scan gets stuck, no order at all would have worked.' }),  // why box: taking the first process that fits is always enough, since finishing only adds units to work
                ctx.narrow ? whyAdd : null))));  // on phone-width screens the A[k] tip goes here, at the bottom, instead; this closes both columns and the layout
        },  // ends render() for step 5
      },  // ends step 5

      /* ---------------- 6. Handling one request ---------------- */
      {  // step 6 starts here
        title: 'Approach 2: the banker checks every request',  // step 6 title: the banker checks every request (resource allocation denial)
        kind: 'predict',  // kind predict: shown with the Predict label above the title
        render(el, ctx) {  // render(el, ctx): runs when step 6 opens and builds the predict-then-check exercise
          const { h } = ctx;  // takes the HTML builder h out of the toolbox
          const SRC = `${/* SRC: the request-handling pseudo-code shown to the student, one statement per line with its own short comment */''}
if (A[i] + req > C[i])        // beyond its claim?${/* shown code, line 1: test 1, is the request plus what Pi holds beyond its claim? */''}
  error();                    // Pi broke its promise${/* shown code, line 2: if so, it is an error */''}
else if (req > V)             // more than is free?${/* shown code, line 3: test 2, is the request bigger than the free units? */''}
  suspend Pi;                 // wait for units${/* shown code, line 4: if so, Pi is suspended until units come back */''}
else {                        // affordable: try it${/* shown code, line 5: otherwise the request is affordable and is tried */''}
  A[i] = A[i] + req;          // tentative grant,${/* shown code, line 6: the tentative grant adds the request to Pi's allocation */''}
  V = V - req;                //   on paper only${/* shown code, line 7: and takes it out of the free units, on paper only */''}
  if (safe())                 // run the safety test${/* shown code, line 8: test 3, the safety test on the new state */''}
    carry out allocation;     // safe: keep it${/* shown code, line 9: safe, so the grant is kept */''}
  else {                      // unsafe: undo it${/* shown code, line 10: unsafe, so the grant is undone */''}
    A[i] = A[i] - req;        // take units back${/* shown code, line 11: the units are taken back from Pi's allocation */''}
    V = V + req;              // free them again${/* shown code, line 12: and returned to the free units */''}
    suspend Pi;               // Pi waits for now${/* shown code, line 13: and Pi waits for now */''}
  }                           // end of unsafe case${/* shown code, line 14: end of the unsafe case */''}
}                             // end of affordable case`;  // shown code, line 15: end of the affordable case; ends the listing
          const code = ctx.ui.code(ctx.narrow ? SRC.replace(/ {2,}\/\//g, '  //') : SRC, { lang: 'c', fontSize: 13.5 });  // builds the numbered code listing; on phone-width screens the long gaps before each comment shrink to two spaces
          if (ctx.narrow) code.classList.add('wrap');  // on phone-width screens the listing also wraps long lines
          const st = EX, V0 = availOf(st), N0 = needOf(st);  // st: the example state; V0: its free units; N0: its need matrix, for the small table
          const REQS = [[3, [1, 0, 1]], [0, [0, 1, 0]], [2, [0, 0, 1]], [0, [3, 0, 0]]];  // REQS: the four requests to predict, each [process index, request vector]: one is granted, two wait (for different reasons), one is an error
          const CH = [['grant', 'Grant it'], ['wait', 'Make it wait'], ['error', 'Error']];  // CH: the three possible answers, each [value, button text]
          const guess = {};  // guess: the student's prediction for each request, stored by request number
          let cur = 0;  // cur: the request being looked at now
          const reqBtns = h('div', { class: 'grid-4', style: { gap: '6px' } });  // reqBtns: a grid of four buttons, one per request
          const choiceRow = h('div', { class: 'row gap-s' });  // choiceRow: the row with the prediction buttons, or the result once predicted
          const out = h('div', { class: 'narr', style: { minHeight: '108px' } });  // out: the narration box for the banker's three tests
          const tiny = h('table', { class: 'mx' + (ctx.narrow ? ' slim' : ' tight') });  // tiny: the small table of the example state (compact on phone-width screens)
          const vt = ctx.narrow ? (x) => '(' + x.join(',') + ')' : vs;  // vt(x): writes a vector without spaces on phone-width screens to save room, otherwise the usual way
          tiny.append(h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', { class: 'gN lft' }, 'Need C − A'), h('th', { class: 'gA lft' }, 'Holds A'), h('th', { class: 'gC lft' }, 'Claim C'))),  // table heading: the need, holdings and claim columns
            h('tbody', {}, ...st.C.map((c, i) => h('tr', {}, h('td', { class: 'pname' }, pn(i)), h('td', { class: 'gN lft mono' }, vt(N0[i])), h('td', { class: 'gA lft mono' }, vt(st.A[i])), h('td', { class: 'gC lft mono' }, vt(c)))),  // one row per process: its name, need, holdings and claim
              h('tr', {}, h('td', { class: 'pname' }, 'Free V'), h('td', { class: 'lft mono b', colspan: 3, style: { textAlign: 'left', paddingLeft: '12px' } }, vs(V0)))));  // a final row with the free units V across the three columns, which closes the table
          const label = (k) => `${pn(REQS[k][0])} asks for ${vs(REQS[k][1])}`;  // label(k): the sentence "P4 asks for (1, 0, 1)" for request k
          const explain = (k) => { const j = judge(st, REQS[k][0], REQS[k][1]); return [j.v, j.lines, j.cls, j.html]; };  // explain(k): runs judge on request k and returns the verdict, the code lines to light, their colour and the explanation
          function paint() {  // paint(): redraws the request buttons, the choice row, the code highlights and the narration
            reqBtns.replaceChildren(...REQS.map((r, k) => h('button', { class: 'btn sm' + (k === cur ? ' on' : ''), type: 'button', onclick: () => { cur = k; paint(); }, style: { height: 'auto', padding: '5px 6px', flexDirection: 'column' } },  // one button per request; the current one is highlighted, and clicking another makes it current and redraws
              h('b', {}, `${pn(r[0])} asks`), h('span', { class: 'mono xs' }, vs(r[1])), guess[k] ? h('span', { class: 'xs', style: { color: guess[k] === explain(k)[0] ? 'var(--ok)' : 'var(--bad)' } }, guess[k] === explain(k)[0] ? '✓ predicted' : '✗ predicted') : null)));  // each shows who asks and the request; once predicted, a green or red note says whether the prediction was right
            code.clear();  // removes every highlight from the code
            if (!guess[cur]) {  // if the current request has not been predicted yet
              choiceRow.replaceChildren(h('span', { class: 'small b' }, `${label(cur)}. Your call:`), ...CH.map(([v, t]) => h('button', { class: 'btn sm', type: 'button', onclick: () => { guess[cur] = v; paint(); } }, t)));  // shows the request and three buttons to predict it; a click stores the guess and redraws
              out.className = 'narr';  // clears the narration colour
              out.innerHTML = 'Predict first, using the table above. Then the banker’s three tests appear here and the code lights up along the path taken.';  // asks for a prediction first, before any answer is shown
              return;  // stops here until the student predicts
            }  // ends the not-yet-predicted case
            const [v, lines, cls, txt] = explain(cur);  // gets the banker's verdict, the path through the code, its colour and the explanation for the current request
            choiceRow.replaceChildren(h('span', { class: 'small b' }, `${label(cur)}.`), h('span', { class: 'chip ' + (guess[cur] === v ? 'ok' : 'bad') }, guess[cur] === v ? 'Your prediction was right' : `You said “${CH.find((c) => c[0] === guess[cur])[1]}”`),  // shows the request and a tag saying whether the prediction was right (or what the student said)
              h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { delete guess[cur]; paint(); } }, 'Predict again'));  // a Predict again button that forgets the guess for this request and redraws
            code.mark(lines, cls);  // lights the code lines along the path the banker took
            out.className = 'narr ' + (v === 'grant' ? 'ok' : v === 'error' ? 'bad' : 'warn');  // colours the narration: green for grant, red for error, amber for wait
            out.innerHTML = txt;  // writes the banker's three tests in words
          }  // ends paint
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 10fr) minmax(0, 11fr)', gap: '20px' } },  // builds the step: two columns, the right one slightly wider
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: the intro, the code and the key to the outcomes
              h('p', { class: 'm0', html: '<span class="t">Resource allocation denial</span>: when P<sub>i</sub> asks for a vector <code>req</code>, the <span class="t">banker’s algorithm</span> runs three tests in order.' }),  // intro: resource allocation denial runs three tests in order on each request
              code,  // the code listing
              h('p', { class: 'xs muted m0' }, 'Vector comparisons work column by column: “req > V” means bigger in at least one column.'),  // small note: comparing vectors works column by column
              h('div', { class: 'card tight small stack', style: { gap: '4px' } },  // a small card explaining the three outcomes
                h('div', { html: '<span class="chip bad">error</span> The process lied about its claim: a bug, not a normal wait.' }),  // error tag: the process asked beyond its claim, a bug rather than a normal wait
                h('div', { html: '<span class="chip warn">wait</span> Not enough units free, <i>or</i> enough but the result would be unsafe.' }),  // wait tag: not enough units free, or enough but the result would be unsafe
                h('div', { html: '<span class="chip ok">grant</span> Affordable, and the new state is still safe.' }))),  // grant tag: affordable and still safe; closes the card and the left column
            h('div', { class: 'stack', style: { gap: '8px' } }, tiny, reqBtns, choiceRow, out,  // right column: the small table, the request buttons, the prediction row and the narration
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Granting a request just because the units are free. Passing tests 1 and 2 is not enough: the <span class="t">tentative allocation</span> must also leave a safe state, not an <span class="t">unsafe state</span>.' }))));  // warning box: units being free is not enough; the tentative allocation must also leave a safe state
          paint();  // draws everything for the first request
        },  // ends render() for step 6
      },  // ends step 6

      /* ---------------- 7. Lab: you are the banker ---------------- */
      {  // step 7 starts here
        title: 'Lab: you are the banker',  // step 7 title: the banker lab
        kind: 'lab',  // kind lab: shown with the Hands-on Lab label above the title
        core: true,  // core: this step is part of the shorter core path through the course
        render(el, ctx) {  // render(el, ctx): runs when step 7 opens and builds the banker lab
          const { h } = ctx;  // takes the HTML builder h out of the toolbox
          // The queue: requests (i asks q) and completions (fin: i). A process finishes only
          // after it holds its whole claim. A process that was made to wait is blocked, so its
          // next event is always the same request asked again (again: true), after a release.
          // The state always follows the banker's real decision.
          const EVENTS = [  // EVENTS: the queue the student works through, in order
            { i: 3, q: [1, 0, 1] }, { i: 2, q: [0, 1, 0] }, { i: 1, q: [1, 1, 0] }, { i: 1, q: [0, 0, 1] },  // events 1-4: P4 asks (granted), P3 asks (unsafe, so it waits), P2 asks for the rest of its claim, then P2 asks beyond it (error)
            { i: 3, q: [0, 0, 3] }, { i: 0, q: [0, 0, 2] }, { fin: 1 }, { i: 3, q: [0, 0, 3], again: true },  // events 5-8: P4 asks for more than is free, P1's request would be unsafe, P2 finishes, then P4 asks again
            { fin: 3 }, { i: 2, q: [0, 1, 0], again: true }, { i: 0, q: [0, 0, 2], again: true },  // events 9-11: P4 finishes, then the waiting P3 and P1 ask again
          ];  // closes the EVENTS queue
          const TOTAL = EVENTS.filter((e) => e.q).length;  // TOTAL: how many events are requests (finishes are not scored)
          const CH = [['grant', 'Grant it'], ['wait', 'Make it wait'], ['error', 'Error: over its claim']];  // CH: the three answers the student can give, each [value, button text]
          let st, status, k, right, asked, ans;  // st: the current state; status: each process's status; k: the current event; right and asked: the score; ans: the latest answer
          const tblBox = h('div'), head = h('div', { class: 'row', style: { justifyContent: 'space-between' } });  // tblBox: holder for the table; head: the row with the event number and the score
          const card = h('div', { class: 'stack', style: { gap: '8px' } });  // card: the area for the current event and its buttons
          const log = h('div', { class: 'log grow', style: { minHeight: '70px' } });  // log: a scrolling record of every decision, newest on top
          function table() {  // table(): builds the state table, with the process in the current event outlined
            const V = availOf(st), N = needOf(st), ev = EVENTS[k], who = ev ? (ev.q ? ev.i : ev.fin) : -1;  // V: the free units; N: the needs; ev: the current event; who: the process it concerns, or -1 when the queue is finished
            const vt = ctx.narrow ? (x) => '(' + x.join(',') + ')' : vs;  // vt(x): writes a vector without spaces on phone-width screens to save room, otherwise the usual way
            const stChip = (i) => h('span', { class: 'chip ' + { running: 'proc', waiting: 'warn', finished: 'ok' }[status[i]] }, status[i]);  // stChip(i): a tag with process i's status, teal for running, amber for waiting, green for finished
            return h('table', { class: 'mx' + (ctx.narrow ? ' slim' : ' roomy') },  // returns the table, compact on phone-width screens and roomy on desktop
              h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', { class: 'gC lft' }, 'Claim C'), h('th', { class: 'gA lft' }, 'Holds A'), h('th', { class: 'gN lft' }, 'Need C − A'), h('th', { class: 'lft' }, 'Status'))),  // heading row: claim, holdings, need and status columns
              h('tbody', {}, ...st.C.map((c, i) => h('tr', { class: i === who ? 'cand' : '' }, h('td', { class: 'pname' }, pn(i)),  // one row per process, outlined if it is the one in the current event, starting with its name
                h('td', { class: 'gC lft mono' }, vt(c)), h('td', { class: 'gA lft mono' }, st.gone[i] ? '—' : vt(st.A[i])), h('td', { class: 'gN lft mono' }, st.gone[i] ? '—' : vt(N[i])), h('td', { class: 'lft' }, stChip(i)))),  // its claim, then its holdings and need (a dash once it has finished), then its status tag
                h('tr', {}, h('td', { class: 'pname' }, 'Free V'), h('td', { class: 'lft mono b', colspan: 4, style: { textAlign: 'left', paddingLeft: '12px' } }, `${vs(V)}   of R = ${vs(st.R)}`))));  // a final row with the free units V and, for comparison, the totals R; this closes the table
          }  // ends table
          function addLog(txt) { log.prepend(h('div', { html: txt })); }  // addLog(txt): adds a line to the top of the log, so the newest decision is always visible
          function paint() {  // paint(): redraws the table, the heading and the event card for the current event
            tblBox.replaceChildren(table());  // redraws the state table
            head.replaceChildren(h('b', {}, k < EVENTS.length ? `Event ${k + 1} of ${EVENTS.length}` : 'Queue finished'), h('span', { class: 'chip accent' }, `${right} of ${asked} calls match the banker`));  // the heading: "Event 3 of 11" (or "Queue finished") and how many calls matched the banker so far
            const ev = EVENTS[k];  // ev: the current event, or nothing once the queue is used up
            if (!ev) {  // the queue is finished
              card.replaceChildren(h('div', { class: 'narr ok', html: `<b>All ${TOTAL} requests handled.</b> You matched the banker on <b>${right}</b> of ${TOTAL}. Every state the banker allowed was safe, so a deadlock was never possible, and nothing ever had to be taken back from a process.` }),  // shows the final score and points out that every state the banker allowed was safe, so nothing was ever taken back
                h('div', {}, h('button', { class: 'btn sm primary', type: 'button', onclick: reset }, 'Play again')));  // with a Play again button that starts the lab over
              return;  // stops here
            }  // ends the finished case
            if (ev.fin != null) {  // a finish event: a process holds its whole claim and can run to the end
              const i = ev.fin, V = availOf(st), after = add(V, st.A[i]);  // i: the finishing process; V: the free units now; after: the free units once it releases what it holds
              card.replaceChildren(h('div', { class: 'narr', html: `<b>${pn(i)} holds its whole claim ${vs(st.C[i])}</b>, so it can run to completion. When it ends it releases everything: V goes from ${vs(V)} to <b>${vs(after)}</b>. Waiting processes may now have better luck.` }),  // explains that the process can complete and how much V grows when it releases everything
                h('div', {}, h('button', { class: 'btn sm primary', type: 'button', onclick: () => {  // a Continue button; clicking it carries out the finish
                  st.A[i] = [0, 0, 0]; st.gone[i] = true; status[i] = 'finished';  // the process now holds nothing, is marked as gone so the safety test skips it, and shows as finished
                  addLog(`${pn(i)} finished and released its units → V = ${vs(after)}`);  // records the release and the new free units in the log
                  k++; ans = null; paint();  // moves on to the next event and redraws
                } }, 'Continue')));  // closes the click handler and the Continue button
              return;  // stops here; no prediction is needed for a finish
            }  // ends the finish case
            const big = h('div', { class: 'card white center', style: { fontSize: '20px', fontWeight: 800, padding: '10px' } }, `${pn(ev.i)} asks for ${vs(ev.q)}`, ev.again ? h('div', { class: 'xs muted' }, 'the same request again, after units were released') : null);  // big: a large card naming the request, with a small note when it is the same request asked again
            if (!ans) {  // if the student has not answered this request yet
              card.replaceChildren(big, h('div', { class: 'row gap-s' }, ...CH.map(([v, t]) => h('button', { class: 'btn sm', type: 'button', onclick: () => decide(v) }, t))),  // shows the request and one button per answer; a click calls decide with that answer
                h('p', { class: 'small muted m0' }, 'Use the table: test the claim, then the free units, then (in your head) the safety test.'));  // a reminder of the order in which to test: claim, free units, then safety
              return;  // stops until the student answers
            }  // ends the unanswered case
            const j = ans.j, good = ans.choice === j.v;  // j: the banker's real verdict; good: whether the student matched it
            card.replaceChildren(big,  // shows the request again
              h('div', { class: 'narr ' + (j.v === 'grant' ? 'ok' : j.v === 'error' ? 'bad' : 'warn'), html: `${good ? '<b style="color:var(--ok)">Same call as the banker.</b> ' : `<b style="color:var(--bad)">The banker decides differently: ${CH.find((c) => c[0] === j.v)[1].toLowerCase()}.</b> `}${j.html}` }),  // then the verdict, coloured by outcome, saying whether the student matched the banker, followed by the banker's three tests
              h('div', {}, h('button', { class: 'btn sm primary', type: 'button', onclick: () => { k++; ans = null; paint(); } }, 'Next event')));  // and a Next event button that moves on and redraws
          }  // ends paint
          function decide(choice) {  // decide(choice): runs when the student answers; the banker's real decision is always the one carried out
            const ev = EVENTS[k], j = judge(st, ev.i, ev.q);  // ev: the current request; j: the banker's verdict on it
            ans = { choice, j }; asked++; if (choice === j.v) right++;  // stores the answer, counts the attempt and, if it matched, the point
            if (j.v === 'grant') { st = j.r.tent; status[ev.i] = 'running'; }  // a granted request makes the tentative state the real one, and the process keeps running
            else if (j.v === 'wait') status[ev.i] = 'waiting';  // a refused request marks the process as waiting; an error leaves the state unchanged
            addLog(`${pn(ev.i)} asks ${vs(ev.q)} → ${j.v === 'grant' ? 'granted' : j.v === 'error' ? 'error' : j.unsafe ? 'wait (unsafe)' : 'wait (not enough free)'}${choice === j.v ? '  ✓' : '  ✗ you said ' + choice}`);  // logs the request, what the banker did (and why it waited), and a tick or what the student said instead
            paint();  // redraws with the result showing
          }  // ends decide
          function reset() {  // reset(): starts the lab over from the example state
            st = clone(EX); st.gone = [false, false, false, false];  // a fresh copy of the example, with no process finished yet
            status = ['running', 'running', 'running', 'running'];  // every process starts out running
            k = 0; right = 0; asked = 0; ans = null; log.innerHTML = '';  // back to the first event, a zero score, no answer and an empty log
            addLog('start: the example state, V = ' + vs(availOf(st)));  // the first log line shows the starting free units
            paint();  // draws everything
          }  // ends reset
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 11fr) minmax(0, 10fr)', gap: '20px' } },  // builds the step: two columns, the left slightly wider
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the instructions, the table and the log
              h('p', { class: 'm0', html: 'Requests arrive one at a time. For each, decide what the <span class="t">banker’s algorithm</span> would do. Whatever you choose, the system then follows the banker’s real decision, so the table always shows the true state. A process made to wait stays blocked until it asks again.' }),  // instructions: decide what the banker would do; the system always follows the banker's real decision
              tblBox, log),  // the state table and the log under it, closing the left column
            h('div', { class: 'stack', style: { gap: '10px' } }, head, card,  // right column: the event heading and the event card
              h('div', { class: 'card tight small stack', style: { gap: '5px', marginTop: 'auto' } }, h('div', { class: 'lbl' }, 'THE BANKER’S CHECKLIST'),  // the banker's checklist, a small card pushed to the bottom of the column
                h('div', { html: '<b>1.</b> Is A + req ≤ C, column by column? If not: <span class="chip bad">error</span>' }),  // checklist step 1: an allocation plus request beyond the claim is an error
                h('div', { html: '<b>2.</b> Is req ≤ V? If not: <span class="chip warn">wait</span>' }),  // checklist step 2: a request beyond the free units waits
                h('div', { html: '<b>3.</b> Grant it on paper and run the safety test. Safe: <span class="chip ok">grant</span>. Unsafe: undo it and <span class="chip warn">wait</span>.' })),  // checklist step 3: grant on paper, run the safety test, keep it if safe, otherwise undo and wait
              h('div', {}, h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Start over')))));  // a Start over button that calls reset; closes the right column and the layout
          reset();  // starts the lab
        },  // ends render() for step 7
      },  // ends step 7

      /* ---------------- 8. Strengths and restrictions ---------------- */
      {  // step 8 starts here
        title: 'What avoidance buys, and what it demands',  // step 8 title: what avoidance buys and what it demands
        kind: 'compare',  // kind compare: shown with the Compare label above the title
        html: `${/* the fixed page content of step 8, written as HTML text inside backticks */''}
          <div class="split l fill">${/* a two-column layout, smaller on the left: the lists on the left, the sorting exercise on the right */''}
            <div class="stack" style="gap:10px">${/* left column: two cards stacked 10 pixels apart */''}
              <div class="card ok-card stack" style="gap:6px">${/* a green card for the benefits */''}
                <h4 class="m0">What it buys</h4>${/* card heading: what avoidance buys */''}
                <p class="m0" style="font-size:15.5px"><b>No preemption, no rollback.</b> Unlike <span class="t">deadlock detection</span>, it never has to take resources away from a process or wind a process back to an earlier point.</p>${/* benefit: no resources are ever taken away and no process is rolled back, unlike detection */''}
                <p class="m0" style="font-size:15.5px"><b>Fewer rules than prevention.</b> Processes may hold some resources while asking for more, in any order they like, and more of them can run at once.</p>${/* benefit: fewer rules than prevention, so more processes can run at once */''}
              </div>${/* ends the benefits card */''}
              <div class="card stack" style="gap:6px">${/* a plain card for the requirements */''}
                <h4 class="m0">What it demands</h4>${/* card heading: what avoidance demands */''}
                <ol class="m0" style="padding-left:20px;line-height:1.45;font-size:15.5px">${/* a numbered list of the four restrictions */''}
                  <li><b>Claims in advance.</b> Each process must state its <span class="t">maximum claim</span> for every resource type before it starts.</li>${/* restriction 1: maximum claims must be stated in advance */''}
                  <li><b>Independent processes.</b> Their order of execution must not be tied down by synchronization, or a safe sequence on paper might be impossible to run.</li>${/* restriction 2: processes must be independent, with no synchronization fixing their order */''}
                  <li><b>A fixed number of resources.</b> The test trusts R; units that vanish break its promises.</li>${/* restriction 3: the number of resources must stay fixed */''}
                  <li><b>No exit while holding.</b> Every process must hand back what it holds, because the test counts on those units returning.</li>${/* restriction 4: no process may exit while still holding resources */''}
                </ol>${/* ends the numbered list */''}
              </div>${/* ends the requirements card */''}
            </div>${/* ends the left column */''}
            <div class="stack sorter" style="gap:8px;min-height:0"></div>${/* empty right column where render() puts the scenario sorter */''}
          </div>`,  // ends the layout and the HTML text of step 8
        render(el, ctx) {  // render(el, ctx): runs when step 8 opens and builds the "can the banker protect this system?" sorter
          const { h } = ctx;  // takes the HTML builder h out of the toolbox
          const OPTS = ['Yes: the banker works here', 'No: claims not known in advance', 'No: processes are not independent', 'No: the resources can change', 'No: a process can exit holding units'];  // OPTS: the five possible answers: the banker works, or which restriction is broken
          const SC = [  // SC: the scenarios, each [description, index of the right answer in OPTS, explanation]
            ['A batch system with a fixed set of tape drives and memory blocks. Each job states, when it is submitted, the most of each it will ever use. Jobs run independently and release everything when they end.', 0, 'All four conditions hold, so every request can be checked against the claims.'],  // scenario: a batch system that meets all four conditions, so the banker works
            ['A web service where each request discovers, as it runs, how many database connections it needs. Nobody can say beforehand what the most will be.', 1, 'Without a maximum claim there is no C matrix, so there is no need C − A to test against the free units.'],  // scenario: a web service with no known maximum, which breaks the claims-in-advance rule
            ['Two stages of a pipeline. Stage B cannot go on until stage A sends it a message.', 2, 'The safety test may decide that B should finish first, but B cannot finish before A has run. Synchronization ties down the order, so a safe sequence on paper may be impossible in practice.'],  // scenario: a two-stage pipeline where one stage waits for the other, which breaks independence
            ['A disk array in which drives can fail and drop out of the pool at any moment.', 3, 'The banker’s promises are worked out from R. If units disappear, a state that was safe can become unsafe without any request at all.'],  // scenario: a disk array whose drives can fail, so the number of resources changes
            ['A program that can be killed while it still holds two scanners, which are then never given back to the pool.', 4, 'The safety test assumes each process returns its allocation when it finishes. Units that leave with a process break that arithmetic.'],  // scenario: a program killed while holding scanners, which breaks the no-exit-while-holding rule
            ['A print server. Every job declares its maximum number of printers, jobs never wait for each other, and the number of printers never changes.', 0, 'Claims are known, jobs are independent, the pool is fixed and every job releases its printers: the banker’s algorithm fits.'],  // scenario: a print server that meets all four conditions, so the banker works
          ];  // closes the scenario list
          let k = 0, right = 0, done = 0, picked = null;  // k: the current scenario; right: correct answers; done: scenarios answered; picked: the answer chosen for this one, or null
          const box = ctx.$('.sorter');  // box: the empty right column from the HTML, where the sorter is drawn
          function paint() {  // paint(): redraws the sorter for the current scenario, or the final result once all are sorted
            box.innerHTML = '';  // empties the box before redrawing
            if (k >= SC.length) {  // all scenarios have been sorted
              box.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Can the banker protect this system?'), h('span', { class: 'chip accent' }, `${right} of ${done} right`)),  // the heading with the final score tag
                h('div', { class: 'narr ok', html: `<b>All ${SC.length} scenarios sorted.</b> You got ${right} right. Notice how often real systems break at least one condition: that is the main reason general-purpose operating systems rarely run the banker’s algorithm for all their resources.` }),  // a green summary: the score, and why general-purpose systems rarely run the banker for every resource
                h('div', {}, h('button', { class: 'btn sm primary', type: 'button', onclick: () => { k = 0; right = 0; done = 0; picked = null; paint(); } }, 'Sort them again')));  // a Sort them again button that resets the score and starts from the first scenario
              return;  // stops here
            }  // ends the finished case
            const [txt, ans, why] = SC[k];  // txt: the scenario text; ans: the index of the right answer; why: the explanation
            box.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Can the banker protect this system?'), h('span', { class: 'chip accent' }, `${right} of ${done} right`)),  // the heading with the running score
              h('div', { class: 'card white', style: { fontSize: '16.5px', minHeight: '86px' } }, h('div', { class: 'xs muted b' }, `SCENARIO ${k + 1} OF ${SC.length}`), txt),  // a white card with "SCENARIO 2 OF 6" above the scenario text
              h('div', { class: 'stack', style: { gap: '6px' } }, ...OPTS.map((o, j) => h('button', {  // a stack of answer buttons, one per option
                class: 'btn' + (picked == null ? '' : j === ans ? ' ok on' : j === picked ? ' intr' : ''), type: 'button', disabled: picked != null && j !== ans && j !== picked,  // after a pick: the right answer turns green, a wrong pick turns red, and every other button is greyed out
                style: { justifyContent: 'flex-start' }, onclick: () => { if (picked != null) return; picked = j; done++; if (j === ans) right++; paint(); } }, (picked != null && j === ans ? '✓ ' : picked === j ? '✗ ' : '') + o))));  // buttons are left-aligned; a click records the first pick, counts it, scores it and redraws; ticks and crosses mark the result
            if (picked != null) {  // once the student has picked
              box.append(h('div', { class: 'narr ' + (picked === ans ? 'ok' : 'bad'), html: `${picked === ans ? '<b>Right.</b> ' : `<b>Not quite: ${OPTS[ans].replace(/^(Yes|No): /, '').toLowerCase()}.</b> `}${why}` }),  // a narration box: Right, or the correct answer written out, followed by the explanation
                h('div', {}, h('button', { class: 'btn sm primary', type: 'button', onclick: () => { k++; picked = null; paint(); } }, k + 1 < SC.length ? 'Next scenario' : 'See the result')));  // a button to the next scenario, or "See the result" after the last one
            }  // ends the picked case
          }  // ends paint
          paint();  // draws the first scenario
        },  // ends render() for step 8
      },  // ends step 8

      /* ---------------- 9. Recap ---------------- */
      {  // step 9 starts here
        title: 'Recap: the banker in eight cards',  // step 9 title: the recap in eight cards
        kind: 'recap',  // kind recap: shown with the Recap label above the title
        render(el, ctx) {  // render(el, ctx): runs when step 9 opens and builds the recap cards
          const { h } = ctx;  // takes the HTML builder h out of the toolbox
          // The worked example's key numbers, computed by the same helpers the steps use.
          const res = safety(EX), j1 = judge(EX, 0, [0, 1, 0]), j2 = judge(EX, 3, [1, 0, 1]);  // res: the safety test on the example; j1 and j2: the banker's verdicts on two sample requests, P1 (0, 1, 0) and P4 (1, 0, 1)
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // builds the step: a stack that fills the step height
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // instruction: say each answer before flipping the card
            ctx.ui.flipcards([  // the flip cards, each [front, back]
              ['Avoidance in one sentence', 'Grant a request only if, afterwards, there is still an order in which every process can finish. It needs every maximum claim in advance.'],  // card: avoidance in one sentence
              ['Safe vs unsafe', 'Safe: at least one safe sequence exists. Unsafe: none does. Unsafe is <b>not necessarily</b> deadlocked: it may already be, or everyone may still finish; deadlock just can no longer be ruled out.'],  // card: the difference between safe and unsafe, and why unsafe does not have to mean deadlock
              ['The bookkeeping', 'R total, V free, C declared maxima, A held now, need = C − A. Always R = V + column sums of A, C ≤ R and A ≤ C.'],  // card: the bookkeeping symbols and the three facts that always hold
              ['Initiation denial', 'Start a new process only if, in every column, its claim plus all running claims ≤ R. It plans for everyone maxing out at once, so it admits too few.'],  // card: the initiation denial rule and why it admits too few
              ['The safety test', 'work = V. Repeatedly find a process in rest whose need ≤ work, add its A to work and remove it. Safe if rest ends up empty.'],  // card: the safety test in brief
              ['Handling a request', 'A + req > C: error. req > V: wait. Otherwise grant on paper and run the safety test: safe, keep it; unsafe, undo it and wait.'],  // card: the three outcomes of handling a request
              ['What it buys', 'No preemption and no rollback, unlike detection. Fewer restrictions than prevention, so more processes can run at once.'],  // card: what avoidance buys
              ['What it demands', 'Claims stated in advance; independent processes; a fixed number of resources; no process exits while holding resources.'],  // card: the four restrictions avoidance demands
            ], { cols: ctx.narrow ? 2 : 4, height: 170 }),  // the grid has 2 columns on phone-width screens and 4 on desktop, each card at least 170 pixels tall
            h('div', { class: 'callout tip m0', 'data-label': 'The running example in numbers', html: `R = ${vs(EX.R)}, V = ${vs(availOf(EX))}. The safety test finds ${res.seq.map(pn).join(' → ')}, so the state is ${res.safe ? 'safe' : 'unsafe'}. P1 asking for (0, 1, 0) gets <b>${j1.v}${j1.unsafe ? ' (unsafe)' : ''}</b> although the unit is free; P4 asking for (1, 0, 1) gets <b>${j2.v}</b>.` })));  // tip box with the running example's numbers: R, V, the safe order, and the verdicts on the two sample requests, all computed live
        },  // ends render() for step 9
      },  // ends step 9

      /* ---------------- 10. Quiz ---------------- */
      {  // step 10 starts here: the quiz
        title: 'Check yourself',  // step 10 title
        kind: 'check',  // kind check: shown with the Check Yourself label above the title
        quiz: [  // quiz: the questions; the guide's quiz engine shows them one at a time and checks each answer
          { q: 'What must deadlock avoidance know in advance that deadlock detection does not need?',  // question 1 (multiple choice): what avoidance must know in advance
            choices: ['The set of processes that are already deadlocked when each request arrives', 'The maximum units of each resource type that each process may ever need', 'A fixed numbering of resource types that all requests must follow in order', 'Exactly how long each process will run before it releases what it holds'], answer: 1,  // choices: deadlocked processes, maximum claims (right, answer 1), a fixed numbering, running times
            feedback: ['Avoidance never lets a deadlock form, so there is nothing to find; searching for deadlocked processes is what detection does.', null, 'A fixed numbering of resource types is a prevention rule against circular wait.', 'Running time is not part of the safety test; only claims, holdings and free units are.'],  // feedback for each wrong choice: why it belongs to detection or prevention, or is not used at all
            why: 'The safety test compares each process’s remaining need, claim minus allocation, with the free units. Without declared maximum claims there is no need to compare.' },  // explanation: the safety test needs claims to work out each remaining need
          { type: 'tf', q: 'An unsafe state is the same as a deadlocked state.', answer: false,  // question 2 (true or false): unsafe is the same as deadlocked (false)
            why: 'In an unsafe state no order is <i>guaranteed</i> to let everyone finish, but processes may still release resources early or ask for less than their claim, so deadlock may never happen. Unsafe only means it can no longer be ruled out.' },  // explanation: unsafe only means deadlock can no longer be ruled out
          { type: 'tf', q: 'Every deadlocked state is an unsafe state.', answer: true,  // question 3 (true or false): every deadlocked state is unsafe (true)
            why: 'The deadlocked processes can never finish, so no order exists in which every process finishes. A state with no safe sequence is unsafe by definition.' },  // explanation: deadlocked processes can never finish, so no safe sequence exists
          { type: 'num', q: 'A system owns R = (8, 5, 6). Three processes hold (2, 1, 0), (1, 2, 3) and (3, 0, 1). How many units of the <b>second</b> resource type are available?', answer: 2, tol: 0, unit: 'units',  // question 4 (calculate): the available units of the second type, given R and three allocations; answer 2, no tolerance
            hint: 'V[j] = R[j] minus the sum of column j of the allocation matrix.',  // hint: V is the total minus the column sum of the allocations
            why: 'Add up the second column of the allocations: 1 + 2 + 0 = 3. Then V for that type = 5 − 3 = 2. Every unit is either free or held by someone.' },  // explanation: the worked subtraction for the second column
          { type: 'num', q: 'During the safety test, work = (1, 2, 0). The test finds that process Q, which holds (3, 0, 2) and still needs (1, 1, 0), can finish. After Q is assumed to finish, how many units of the <b>third</b> resource type does work hold?', answer: 2, tol: 0, unit: 'units',  // question 5 (calculate): work's third entry after process Q finishes; answer 2
            hint: 'A finishing process gives back everything it holds.',  // hint: a finishing process gives back everything it holds
            why: 'work becomes work + A[Q] = (1, 2, 0) + (3, 0, 2) = (4, 2, 2). Q takes its need and then returns its whole claim, so the net change is exactly what it held.' },  // explanation: work grows by exactly what Q held
          { q: 'R = (6, 4). Two running processes have claims (2, 1) and (3, 2). A new process with claim (2, 1) asks to start. What does process initiation denial do?',  // question 6 (multiple choice): does initiation denial admit a new process?
            choices: ['Admits it: the second column of claims totals 4, which just fits', 'Admits it, provided enough units of each type are free right now', 'Refuses it: the second column of claims would total more than 4', 'Refuses it: the first column of claims would total 7, more than 6'], answer: 3,  // choices: two admits and two refusals for different reasons; the right one names the first column (answer 3)
            feedback: ['Every column must fit, not just one. The first column fails.', 'Initiation denial looks only at claims, never at the units free at the moment.', 'The second column totals 1 + 2 + 1 = 4, which fits exactly; the first column is the problem.', null],  // feedback for each wrong choice: every column must fit, current free units do not matter, the second column fits
            why: 'Claims add up to (2+3+2, 1+2+1) = (7, 4). Since 7 > 6, the newcomer is refused, even though the processes might never all reach their claims at once.' },  // explanation: the claim totals, where 7 is more than 6
          { q: 'Process P has claim (3, 2), holds (1, 1) and requests (2, 0). Available V = (1, 3). What does the banker’s algorithm do?',  // question 7 (multiple choice): what the banker does with a request that is within the claim but not free
            choices: ['Make P wait: not enough units are free', 'Report an error: the request exceeds its claim', 'Grant on paper and run the safety test', 'Grant at once, because its claim covers the request'], answer: 0,  // choices: wait (right, answer 0), error, grant on paper, grant at once
            feedback: [null, 'A + req = (3, 1), which is within the claim (3, 2), so this is not an error.', 'The safety test is only reached when the request is affordable, and it is not.', 'Being within the claim is necessary but not enough: the units must be free and the result must be safe.'],  // feedback for each wrong choice: not over the claim, the safety test is never reached, being within the claim is not enough
            why: 'Test 1 passes: (1, 1) + (2, 0) = (3, 1) ≤ (3, 2). Test 2 fails: P wants 2 units of the first type and only 1 is free, so P waits.' },  // explanation: test 1 passes and test 2 fails, so P waits
          { q: 'A system owns R = (5, 4). Claims: P1 (3, 2), P2 (2, 3), P3 (4, 1). Allocations: P1 (1, 1), P2 (1, 2), P3 (2, 0). Which of these is a safe sequence?',  // question 8 (multiple choice): which order is a safe sequence for a two-type state
            choices: ['P1 → P2 → P3', 'P3 → P2 → P1', 'P2 → P1 → P3', 'None: the state is unsafe'], answer: 2,  // choices: three orders and "unsafe"; the right one starts with P2 (answer 2)
            feedback: ['V = (1, 1) and P1 still needs (2, 1), so P1 cannot go first.', 'P3 still needs (2, 1) as well, which does not fit in (1, 1).', null, 'P2 needs (1, 1), which fits, so a safe sequence exists.'],  // feedback for each wrong choice: why P1 or P3 cannot go first, and that a safe order exists
            why: 'V = (1, 1). Needs: P1 (2, 1), P2 (1, 1), P3 (2, 1). Only P2 fits; it returns (1, 2), making work (2, 3). Now P1 fits, work becomes (3, 4), and then P3 fits.' },  // explanation: only P2 fits at first, then P1, then P3
          { type: 'order', q: 'Put the banker’s handling of one request in order.',  // question 9 (put in order): the steps of handling one request
            items: ['Check that A[i] + req does not exceed the claim C[i]', 'Check that req does not exceed the available vector V', 'Tentatively grant: A[i] = A[i] + req and V = V − req', 'Run the safety test on the new state', 'Keep the grant if safe; otherwise undo it and make the process wait'],  // the five steps in their correct order: claim check, free check, tentative grant, safety test, keep or undo
            why: 'An over-claim is an error, so it is caught first. Then the units must actually be free. Only then does the banker grant on paper, test, and keep or undo.' },  // explanation: why the over-claim check comes first and the safety test last
          { type: 'multi', q: 'Which are requirements for using the banker’s algorithm?',  // question 10 (select all that apply): the requirements for using the banker's algorithm
            choices: ['Each process declares its maximum claim in advance', 'Processes are independent: no synchronization fixes their order', 'The number of resources to allocate is fixed', 'No process exits while holding resources', 'Resources are numbered and must be requested in increasing order', 'Each process requests all its resources at once'], answer: [0, 1, 2, 3],  // choices: the four real restrictions (answers 0-3) plus two prevention rules as distractors
            why: 'The first four are the restrictions on avoidance. Numbered ordering and all-at-once requests are prevention rules; avoidance needs neither.' },  // explanation: the last two are prevention rules that avoidance does not need
          { type: 'match', q: 'Match each symbol of the banker’s bookkeeping with its meaning.',  // question 11 (match the pairs): each bookkeeping symbol with its meaning
            pairs: [['R', 'Total units of each type the system owns'], ['V', 'Units of each type free right now'], ['C', 'Most units each process declared it may need'], ['A', 'Units each process holds right now'], ['C − A', 'Units each process may still ask for']],  // pairs: R, V, C, A and C minus A, each with its meaning
            why: 'R and V are vectors (one number per type). C, A and C − A are matrices (one row per process). Always R = V + the column sums of A.' },  // explanation: which symbols are vectors and which are matrices, and the fact that ties them together
          { type: 'bucket', q: 'Which strategy does each statement describe?', buckets: ['Prevention', 'Avoidance', 'Detection'],  // question 12 (sort into groups): which strategy each statement describes: prevention, avoidance or detection
            items: [['Resources must be requested in a fixed numeric order', 0], ['A request whose tentative result is unsafe is refused', 1], ['Every so often, search for processes stuck waiting on each other', 2], ['Maximum claims must be declared before a process starts', 1], ['Processes may be aborted to break a deadlock', 2], ['A process must request all its resources at once', 0]],  // six statements, each with the index of its correct group
            why: 'Prevention bans a condition by rule. Avoidance looks ahead at each decision using declared claims. Detection lets deadlocks happen, finds them, and recovers.' },  // explanation: how the three strategies differ
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the list of steps
    notes: `${/* notes: the reading notes for this section, written as HTML text; the guide shows them in its Notes panel */''}
<h3>What deadlock avoidance is</h3>${/* notes heading: what deadlock avoidance is */''}
<p>Deadlock needs four conditions: mutual exclusion, hold and wait, no preemption and circular wait. <b>Prevention</b> designs one away. <b>Avoidance</b> allows the first three (policies the system chooses) and decides carefully so that deadlock never becomes unavoidable. Before each decision it asks: “If I do this, can every process still finish?”</p>${/* notes paragraph: the four conditions, and what prevention and avoidance each do about them */''}
<ul>${/* start of a bullet list of avoidance's key facts */''}
<li>It must know, in advance, each process’s <b>maximum claim</b>: the most units of each resource type the process may ever hold at once.</li>${/* bullet: avoidance needs each process's maximum claim in advance */''}
<li>It allows more concurrency than prevention.</li>${/* bullet: avoidance allows more concurrency than prevention */''}
<li>Two approaches: <b>process initiation denial</b> (do not start a process whose claims might lead to deadlock) and <b>resource allocation denial</b> (do not grant a request that might lead to deadlock), which is Dijkstra’s <b>banker’s algorithm</b>.</li>${/* bullet: the two approaches, initiation denial and allocation denial (the banker's algorithm) */''}
</ul>${/* end of the bullet list */''}
<p>Prevention acts when the rules are designed; avoidance when a process starts or requests; detection grants freely, looks for deadlocks later, and may have to abort processes or take resources back.</p>${/* notes paragraph: when each of the three strategies acts */''}

<h3>The idea with one resource type: a bank vault</h3>${/* notes heading: the single-resource bank vault */''}
<p>A vault holds 12 coins. Four firms with credit limits Alder 8, Birch 4, Cedar 7, Dune 5 have borrowed 3, 2, 2 and 2, so the vault holds 3. A customer who reaches its limit finishes and repays everything.</p>${/* notes paragraph: the vault's starting loans and limits, leaving 3 coins */''}
<ul>${/* start of the safe and unsafe list */''}
<li><b>Safe</b>: at least one order (a <b>safe sequence</b>) lets every customer be topped up, finish and repay. Here: Birch needs 2 ≤ 3 (vault then 5), Alder 5 ≤ 5 (then 8), Cedar 5 ≤ 8 (then 10), Dune 3 ≤ 10 (then 12).</li>${/* bullet: defines safe and walks through the vault's safe order step by step */''}
<li><b>Unsafe</b>: no such order. Lend Cedar two more coins: the vault holds 1, the needs are 5, 2, 3 and 3, none fits, so it is unsafe although a coin is left.</li>${/* bullet: lending Cedar two more coins makes the state unsafe even though a coin is left */''}
</ul>${/* end of the list */''}
<h4>Unsafe is not the same as deadlocked</h4>${/* notes subheading: unsafe is not the same as deadlocked */''}
<p>From that unsafe state, if every customer insists on its full limit, everyone ends up waiting forever: deadlock. But if Birch needs only the 2 coins it holds and repays early, the vault holds 3 and everyone can finish. Unsafe means deadlock can no longer be <i>ruled out</i>. Every deadlocked state is unsafe, but not every unsafe state leads to deadlock. Avoidance simply never enters unsafe states.</p>${/* notes paragraph: the two futures from the unsafe state, deadlock or everyone finishing */''}

<h3>The bookkeeping for n processes and m resource types</h3>${/* notes heading: the vectors and matrices for many processes and resource types */''}
<table>${/* start of the bookkeeping table */''}
<tr><th>Name</th><th>Meaning</th></tr>${/* table heading row: name and meaning */''}
<tr><td>Resource vector R</td><td>R[j] = total units of type j the system owns</td></tr>${/* table row: the resource vector R */''}
<tr><td>Available vector V</td><td>V[j] = units of type j not allocated to anyone</td></tr>${/* table row: the available vector V */''}
<tr><td>Claim matrix C</td><td>C[i][j] = most units of type j process i may need (declared in advance)</td></tr>${/* table row: the claim matrix C */''}
<tr><td>Allocation matrix A</td><td>A[i][j] = units of type j process i holds now</td></tr>${/* table row: the allocation matrix A */''}
<tr><td>Need matrix C − A</td><td>how many more units each process may still request</td></tr>${/* table row: the need matrix C minus A */''}
</table>${/* end of the bookkeeping table */''}
<p>Three facts always hold: for every j, <b>R[j] = V[j] + Σ<sub>i</sub> A[i][j]</b> (every unit is free or held); <b>C[i][j] ≤ R[j]</b> (nobody claims more than exists); <b>A[i][j] ≤ C[i][j]</b> (nobody holds more than it claimed). For vectors, x ≤ y means every entry of x is at most the matching entry of y.</p>${/* notes paragraph: the three facts that always hold, and what x ≤ y means for vectors */''}
<p><b>Running example</b> (4 processes, 3 types), R = (9, 4, 8):</p>${/* notes paragraph introducing the running example and its totals R */''}
<table>${/* start of the running example table */''}
<tr><th>Process</th><th>Claim C</th><th>Allocation A</th><th>Need C − A</th></tr>${/* table heading row: process, claim, allocation and need */''}
<tr><td>P1</td><td>(6, 2, 4)</td><td>(0, 1, 1)</td><td>(6, 1, 3)</td></tr>${/* table row: P1's claim, allocation and need */''}
<tr><td>P2</td><td>(2, 1, 2)</td><td>(1, 0, 2)</td><td>(1, 1, 0)</td></tr>${/* table row: P2's claim, allocation and need */''}
<tr><td>P3</td><td>(6, 3, 1)</td><td>(3, 0, 1)</td><td>(3, 3, 0)</td></tr>${/* table row: P3's claim, allocation and need */''}
<tr><td>P4</td><td>(4, 2, 5)</td><td>(3, 2, 1)</td><td>(1, 0, 4)</td></tr>${/* table row: P4's claim, allocation and need */''}
</table>${/* end of the running example table */''}
<p>Column sums of A are (7, 3, 5), so V = (2, 1, 3).</p>${/* notes paragraph: the column sums of A and the resulting free units V */''}

<h3>Approach 1: process initiation denial</h3>${/* notes heading: process initiation denial */''}
<p>Start a new process P<sub>n+1</sub> only if, for every resource type j: <b>R[j] ≥ C[n+1][j] + Σ<sub>i=1..n</sub> C[i][j]</b>. Only claims are added; current allocations do not matter.</p>${/* notes paragraph: the admission formula; only claims count */''}
<p>Example: P1 then P2 gives claim totals (8, 3, 6), which fit in (9, 4, 8). Adding P3 makes (14, 6, 7), so P3 is refused. At most two of the four can run together (P1 + P2, P2 + P3 or P2 + P4), yet the banker runs all four at once in a safe state.</p>${/* notes paragraph: the example worked through; at most two of the four processes fit under this rule */''}
<p>It is far from optimal because it assumes every process makes its maximum claim at the same moment. That rarely happens, so reserved capacity sits idle and processes that could run safely are kept out.</p>${/* notes paragraph: why the rule wastes capacity */''}
<h3>The safety test</h3>${/* notes heading: the safety test */''}
<p>A <b>safe state</b> has at least one order in which every process can get its remaining need, finish and release everything. The <b>safety test</b> searches for one:</p>${/* notes paragraph: defines a safe state and introduces the pseudo-code below */''}
<pre>work = V;                    // units free right now${/* notes code, line 1: work starts as the free units */''}
rest = all processes;        // nobody placed yet${/* notes code, line 2: every process starts unplaced */''}
while (rest not empty) {     // someone is still left${/* notes code, line 3: the loop runs while anyone is left */''}
  find Pk in rest with       // scan rest from the front${/* notes code, line 4: scan rest from the front */''}
    C[k] - A[k] &lt;= work;     // its whole need fits, every column${/* notes code, line 5: for a process whose whole need fits in work (&lt; is how HTML writes the less-than sign) */''}
  if (none found) break;     // stuck: stop${/* notes code, line 6: if none fits, stop */''}
  work = work + A[k];        // Pk finishes and returns what it holds${/* notes code, line 7: the process finishes and returns what it holds */''}
  remove Pk from rest;       // Pk is next in the safe sequence${/* notes code, line 8: it becomes next in the safe sequence */''}
}                            // search again${/* notes code, line 9: the end of the loop */''}
safe = (rest is empty);      // safe only if everyone was placed</pre>${/* notes code, line 10: safe only if everyone was placed; ends the code box */''}
<ul>${/* start of a list explaining two details of the test */''}
<li><b>Why add A[k]?</b> Pk takes its need from work, then returns its whole claim C[k] = A[k] + need: a net gain of A[k].</li>${/* bullet: why work grows by A[k] and not by the whole claim */''}
<li><b>Why the first fit is enough:</b> a finishing process only adds units to work, so picking any fitting process never spoils an order that exists. If the scan gets stuck, no order works.</li>${/* bullet: why taking the first process that fits is always enough */''}
</ul>${/* end of the list */''}
<p><b>Worked example:</b> work = (2, 1, 3). P1 (6, 1, 3) is short in R1; P2 (1, 1, 0) fits, so work = (2, 1, 3) + (1, 0, 2) = (3, 1, 5). Scan again: P1 short in R1, P3 (3, 3, 0) short in R2, P4 (1, 0, 4) fits: work = (6, 3, 6). P1 fits: (6, 4, 7). P3 fits: (9, 4, 8) = R. <b>Safe sequence P2 → P4 → P1 → P3.</b></p>${/* notes paragraph: the safety test worked through on the running example, ending with the safe sequence */''}

<h3>Approach 2: the banker’s algorithm (resource allocation denial)</h3>${/* notes heading: the banker's algorithm */''}
<p>When process i requests a vector req:</p>${/* notes paragraph introducing the steps for a request */''}
<ol>${/* start of the numbered steps */''}
<li>If A[i] + req &gt; C[i] in any column: <b>error</b> (more than it declared).</li>${/* step: a request beyond the claim is an error (&gt; is how HTML writes the greater-than sign) */''}
<li>Else if req &gt; V in any column: <b>wait</b> (the units are not free).</li>${/* step: a request beyond the free units waits */''}
<li>Else make a <b>tentative allocation</b>: A[i] = A[i] + req and V = V − req, then run the safety test.</li>${/* step: otherwise grant on paper and run the safety test */''}
<li>If the new state is safe, keep the allocation. If it is unsafe, undo it (A[i] = A[i] − req, V = V + req) and make the process <b>wait</b>.</li>${/* step: keep the grant if safe, otherwise undo it and wait */''}
</ol>${/* end of the numbered steps */''}
<p>Requests against the example state, each judged on its own:</p>${/* notes paragraph introducing four sample requests on the example state */''}
<table>${/* start of the sample requests table */''}
<tr><th>Request</th><th>What happens</th></tr>${/* table heading row: request and outcome */''}
<tr><td>P4 asks (1, 0, 1)</td><td>Within its claim and free. On paper A[P4] = (4, 2, 2), V = (1, 1, 2). Safety test: P2 → P4 → P1 → P3, so <b>granted</b>.</td></tr>${/* table row: P4's request is granted, with its safe order */''}
<tr><td>P1 asks (0, 1, 0)</td><td>Within its claim and free. On paper A[P1] = (0, 2, 1), V = (2, 0, 3). Needs P1 (6, 0, 3), P2 (1, 1, 0), P3 (3, 3, 0), P4 (1, 0, 4): none fits. Unsafe, so it is undone and P1 <b>waits</b> although the unit was free.</td></tr>${/* table row: P1's request is affordable but unsafe, so P1 waits */''}
<tr><td>P3 asks (0, 0, 1)</td><td>A + req = (3, 0, 2) exceeds the claim (6, 3, 1) in R3: <b>error</b>.</td></tr>${/* table row: P3's request goes beyond its claim in R3, an error */''}
<tr><td>P1 asks (3, 0, 0)</td><td>Within its claim, but only 2 units of R1 are free: P1 <b>waits</b>, no safety test needed.</td></tr>${/* table row: P1's large request waits because too few units are free */''}
</table>${/* end of the sample requests table */''}
<p>A waiting process may succeed later, once other processes finish and release their units.</p>${/* notes paragraph: a waiting process may succeed later */''}

<h3>What avoidance buys and what it demands</h3>${/* notes heading: what avoidance buys and demands */''}
<ul>${/* start of the summary list */''}
<li><b>Advantages:</b> no preemption or rollback (which detection and recovery may need), and fewer restrictions than prevention, so more processes run at once.</li>${/* bullet: the advantages over detection and prevention */''}
<li><b>Restrictions:</b> (1) maximum claims stated in advance; (2) independent processes, whose order of execution is not constrained by synchronization; (3) a fixed number of resources to allocate; (4) no process may exit while holding resources.</li>${/* bullet: the four restrictions */''}
</ul>${/* end of the summary list */''}
<p>Each restriction protects an assumption of the safety test: it needs C, assumes any finishing order is possible, trusts R, and counts on every allocation coming back. Real systems often break one, so general-purpose operating systems rarely use the banker’s algorithm for all their resources.</p>${/* notes paragraph: which assumption of the safety test each restriction protects, and why real systems rarely use it */''}
`,  // end of the notes text
  });  // closes the section object and the call that registers it
})();  // closes and immediately runs the wrapping function
