// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   5.1  Mutual Exclusion: Software Approaches
   Two processes, shared memory, no special instructions, no OS help.
   Dekker's four flawed attempts, Dekker's algorithm, Peterson's algorithm.
   Helpers live in this IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file
  /* ---------------- small shared helpers ---------------- */
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));  // esc(x): replaces the characters & < > " with safe codes so program text can be shown inside HTML without being read as tags
  const TV = (b) => `<span class="tv ${b ? 'T' : 'F'}">${b ? 'true' : 'false'}</span>`;  // TV(b): draws a true/false value as a coloured word (green for true, grey for false) for tables and memory cells
  const TOK = (p) => `<span class="tok p${p}">P${p}</span>`;  // TOK(p): draws a small round badge reading P0 or P1 in that process's colour, used in the critical-section box
  const PN = (p) => `<b class="c${p}">P${p}</b>`;  // PN(p): writes P0 or P1 in bold in that process's colour, used inside captions and log lines

  /* ---------------- the six algorithms, written for process i (j = the other) ----------------
     Every line: c = code shown, k = kind (entry | cs | exit | rem | brace),
     x = plain-language "what this line does next", run(s) = effect when it executes.
     run returns { to: next line index, turn?: new turn, flag?: new value of flag[i], m: narration }. */
  const L = (c, k, x, run) => ({ c, k, x, run });  // L(c, k, x, run): packs one line of an algorithm: shown code, its kind, the "what it does next" hint, and what running it changes
  const CSL = (i, to) => L('/* critical section */', 'cs', `P${i} is inside its critical section, using the shared data. Its next step leaves it.`, () => ({ to, m: 'finishes its critical section and leaves it' }));  // CSL(i, to): builds the critical-section line for process i; running it moves on to line index "to"
  const REM = (i) => L('/* remainder section */', 'rem', `P${i} is doing unrelated work. Its next step means it wants to enter again.`, () => ({ to: 0, m: 'finishes its other work and wants to enter again' }));  // REM(i): builds the remainder-section line; running it jumps back to line 0, meaning the process wants to enter again
  const RAISE = (i, to, x) => L(`flag[${i}] = true;`, 'entry', x || 'Raise its flag: “I want to go in.”', () => ({ to, flag: true, m: `sets flag[${i}] = true: it wants in` }));  // RAISE(i, to, x): builds the line flag[i] = true; running it raises this process's flag and moves on to line "to"
  const LOWER = (i, to) => L(`flag[${i}] = false;`, 'exit', 'Lower its flag: “I have left.”', () => ({ to, flag: false, m: `sets flag[${i}] = false: it is out` }));  // LOWER(i, to): builds the line flag[i] = false; running it lowers this process's flag when the process leaves
  const PROG = {  // PROG: the six algorithms as runnable line lists; each entry is a function of i (this process) and j (the other one)
    a1: (i, j) => [  // Attempt 1 (a1): a single shared turn variable decides who may go in
      L(`while (turn != ${i}) ;`, 'entry', `Wait until turn is ${i}. While it is ${j}, test again (busy wait).`,  // line 0 of Attempt 1: the busy-wait loop "while (turn != i)" with its hint for the Next box
        (s) => (s.turn !== i ? { to: 0, m: `reads turn = ${j}: not its turn, so it keeps waiting` } : { to: 1, m: `reads turn = ${i}: its turn, so it enters its critical section` })),  // running line 0: stay on line 0 if turn names the other process, otherwise move on to the critical section
      CSL(i, 2),  // line 1 of Attempt 1: the critical section; afterwards go to line 2
      L(`turn = ${j};`, 'exit', `Hand the turn to P${j}.`, () => ({ to: 3, turn: j, m: `sets turn = ${j}: now it is P${j}’s turn` })),  // line 2 of Attempt 1: hand the turn to the other process (turn = j) on the way out
      REM(i),  // line 3 of Attempt 1: the remainder section, which loops back to line 0
    ],  // ends the Attempt 1 line list
    a2: (i, j) => [  // Attempt 2 (a2): look at the other's flag first, then raise your own
      L(`while (flag[${j}]) ;`, 'entry', `Look at P${j}’s flag. While it is up, keep looking (busy wait).`,  // line 0 of Attempt 2: wait while the other process's flag is up
        (s) => (s.flag[j] ? { to: 0, m: `reads flag[${j}] = true, so it keeps waiting` } : { to: 1, m: `reads flag[${j}] = false, so it stops waiting (its own flag is still down)` })),  // running line 0: keep looping while flag[j] is true; once it is false, move on without having raised its own flag yet
      L(`flag[${i}] = true;`, 'entry', 'Raise its own flag, then walk straight into the critical section.', () => ({ to: 2, flag: true, m: `sets flag[${i}] = true and enters its critical section` })),  // line 1 of Attempt 2: raise its own flag and go straight into the critical section
      CSL(i, 3), LOWER(i, 4), REM(i),  // lines 2-4 of Attempt 2: critical section, lower the flag, remainder section
    ],  // ends the Attempt 2 line list
    a3: (i, j) => [  // Attempt 3 (a3): raise your own flag first, then look at the other's
      RAISE(i, 1, 'Raise its flag first: “I want to go in.”'),  // line 0 of Attempt 3: raise the flag, with a hint that stresses "first"
      L(`while (flag[${j}]) ;`, 'entry', `Then look at P${j}’s flag. While it is up, keep looking (busy wait).`,  // line 1 of Attempt 3: wait while the other process's flag is up
        (s) => (s.flag[j] ? { to: 1, m: `reads flag[${j}] = true, so it keeps waiting` } : { to: 2, m: `reads flag[${j}] = false, so it enters its critical section` })),  // running line 1: keep looping while flag[j] is true, otherwise enter the critical section at line 2
      CSL(i, 3), LOWER(i, 4), REM(i),  // lines 2-4 of Attempt 3: critical section, lower the flag, remainder section
    ],  // ends the Attempt 3 line list
    a4: (i, j) => [  // Attempt 4 (a4): raise your flag, and if the other also wants in, politely back off and try again
      RAISE(i, 1),  // line 0 of Attempt 4: raise the flag
      L(`while (flag[${j}]) {`, 'entry', `Does P${j} want in too? If so, run the polite back-off loop. If not, enter.`,  // line 1 of Attempt 4: the top of the back-off loop, "while (flag[j]) {"
        (s) => (s.flag[j] ? { to: 2, m: `reads flag[${j}] = true, so it starts to back off` } : { to: 6, m: `reads flag[${j}] = false, so it enters its critical section` })),  // running line 1: if the other's flag is up, go to the back-off lines; if not, jump to the critical section at line 6
      L(`    flag[${i}] = false;`, 'entry', `Politely lower its flag to let P${j} go first.`, () => ({ to: 3, flag: false, m: `sets flag[${i}] = false: it steps back` })),  // line 2 of Attempt 4: lower its own flag to let the other process go first
      L('    /* delay */', 'entry', 'Wait a moment before trying again.', () => ({ to: 4, m: 'waits a moment' })),  // line 3 of Attempt 4: a short pause before asking again
      L(`    flag[${i}] = true;`, 'entry', `Raise its flag again, then re-check P${j}’s flag.`, () => ({ to: 1, flag: true, m: `sets flag[${i}] = true again: it asks once more` })),  // line 4 of Attempt 4: raise the flag again and jump back to the loop test on line 1
      L('}', 'brace'),  // line 5 of Attempt 4: the closing brace; kind "brace" means the program never stops on it
      CSL(i, 7), LOWER(i, 8), REM(i),  // lines 6-8 of Attempt 4: critical section, lower the flag, remainder section
    ],  // ends the Attempt 4 line list
    dk: (i, j) => [  // Dekker's algorithm (dk): flags plus a turn variable that settles ties
      RAISE(i, 1),  // line 0 of Dekker: raise the flag
      L(`while (flag[${j}]) {`, 'entry', `Does P${j} want in too? If not, enter. If so, settle the tie below.`,  // line 1 of Dekker: the outer loop, "while the other also wants in"
        (s) => (s.flag[j] ? { to: 2, m: `reads flag[${j}] = true: both want in` } : { to: 8, m: `reads flag[${j}] = false, so it enters its critical section` })),  // running line 1: if the other's flag is up, go settle the tie on line 2; if not, jump to the critical section at line 8
      L(`    if (turn == ${j}) {`, 'entry', `Whose tie is it? If turn is ${j}, P${i} must back off. If not, it keeps checking.`,  // line 2 of Dekker: check whose tie it is by reading turn
        (s) => (s.turn === j ? { to: 3, m: `reads turn = ${j}: the tie is P${j}’s, so it must back off` } : { to: 1, m: `reads turn = ${i}: the tie is its own, so it re-checks flag[${j}]` })),  // running line 2: if turn names the other, back off (line 3); if the tie is its own, go back and re-check the flag (line 1)
      L(`        flag[${i}] = false;`, 'entry', `Lower its flag so that P${j} can go in.`, () => ({ to: 4, flag: false, m: `sets flag[${i}] = false: it steps back` })),  // line 3 of Dekker: lower its flag so the other process can go in
      L(`        while (turn == ${j}) ;`, 'entry', `Wait until P${j} hands over the turn (busy wait).`,  // line 4 of Dekker: the inner busy wait until the turn comes back
        (s) => (s.turn === j ? { to: 4, m: `reads turn = ${j}, so it keeps waiting` } : { to: 5, m: `reads turn = ${i}: its turn has come` })),  // running line 4: stay on line 4 while turn names the other, then move on to line 5
      L(`        flag[${i}] = true;`, 'entry', `Raise its flag again, then re-check P${j}’s flag.`, () => ({ to: 1, flag: true, m: `sets flag[${i}] = true again` })),  // line 5 of Dekker: raise the flag again and return to the outer test on line 1
      L('    }', 'brace'), L('}', 'brace'),  // lines 6-7 of Dekker: the two closing braces, never stopped on
      CSL(i, 9),  // line 8 of Dekker: the critical section
      L(`turn = ${j};`, 'exit', `Give the next tie to P${j}.`, () => ({ to: 10, turn: j, m: `sets turn = ${j}: the next tie goes to P${j}` })),  // line 9 of Dekker: on the way out, give the next tie to the other process (turn = j)
      LOWER(i, 11), REM(i),  // lines 10-11 of Dekker: lower the flag, then the remainder section
    ],  // ends the Dekker line list
    pt: (i, j) => [  // Peterson's algorithm (pt): raise your flag, give the turn away, and wait only if both conditions hold
      RAISE(i, 1),  // line 0 of Peterson: raise the flag
      L(`turn = ${j};`, 'entry', `Politely give the turn away: “P${j}, you go first.”`, () => ({ to: 2, turn: j, m: `sets turn = ${j}: it lets P${j} go first` })),  // line 1 of Peterson: politely set turn to the other process's number
      L(`while (flag[${j}] && turn == ${j}) ;`, 'entry', `Wait only while P${j} wants in AND the turn is P${j}’s.`,  // line 2 of Peterson: wait while the other wants in AND the turn is the other's
        (s) => (s.flag[j] && s.turn === j ? { to: 2, m: `reads flag[${j}] = true and turn = ${j}, so it keeps waiting` }  // running line 2: both conditions true means keep waiting on line 2...
          : { to: 3, m: s.flag[j] ? `reads turn = ${i}, so it enters its critical section` : `reads flag[${j}] = false, so it enters its critical section` })),  // ...otherwise enter; the message names whichever condition failed (the turn, or the other's flag)
      CSL(i, 4), LOWER(i, 5), REM(i),  // lines 3-5 of Peterson: critical section, lower the flag, remainder section
    ],  // ends the Peterson line list
  };  // closes the PROG table
  const ALGOS = [  // ALGOS: the six algorithms in menu order, with the settings the lab needs for each
    { id: 'a1', label: 'Attempt 1', name: 'Attempt 1: one turn variable', turn: true, flag: false, turn0: 0 },  // Attempt 1: uses turn but no flags; turn0 is the starting value of turn
    { id: 'a2', label: 'Attempt 2', name: 'Attempt 2: look, then raise your flag', turn: false, flag: true, turn0: 0 },  // Attempt 2: uses flags only, so the turn cell in shared memory is greyed out
    { id: 'a3', label: 'Attempt 3', name: 'Attempt 3: raise your flag, then look', turn: false, flag: true, turn0: 0 },  // Attempt 3: flags only
    { id: 'a4', label: 'Attempt 4', name: 'Attempt 4: flag plus polite back-off', turn: false, flag: true, turn0: 0 },  // Attempt 4: flags only
    { id: 'dk', label: 'Dekker', name: 'Dekker’s algorithm', turn: true, flag: true, turn0: 1 },  // Dekker: uses both flags and turn, and starts with turn = 1 so P1 wins the first tie
    { id: 'pt', label: 'Peterson', name: 'Peterson’s algorithm', turn: true, flag: true, turn0: 0 },  // Peterson: uses both flags and turn, starting with turn = 0
  ];  // closes the ALGOS list
  const ALGO = Object.fromEntries(ALGOS.map((a) => [a.id, a]));  // ALGO: the same six entries looked up by id (ALGO.pt is Peterson), built once when the page loads
  const progsOf = (id) => [PROG[id](0, 1), PROG[id](1, 0)];  // progsOf(id): builds the two line lists for an algorithm, one for P0 (i=0, j=1) and one for P1 (i=1, j=0)
  const fresh = (id) => ({ pc: [0, 0], turn: ALGO[id].turn0, flag: [false, false], halted: [false, false] });  // fresh(id): the starting state: both at line 0, flags down, nobody halted, turn at the algorithm's start value
  const skey = (s) => `${s.pc[0]}.${s.pc[1]}.${s.turn}.${+s.flag[0]}${+s.flag[1]}.${+s.halted[0]}${+s.halted[1]}`;  // skey(s): turns a state into a short text key so identical states can be spotted and stored in a Set
  function exec(P, s, p) {  // exec(P, s, p): runs process p's current line once and returns the new state n plus the message m for the log
    const r = P[p][s.pc[p]].run(s);  // asks the line's run function what happens, given the current state s
    const n = { pc: s.pc.slice(), turn: s.turn, flag: s.flag.slice(), halted: s.halted.slice() };  // copies the state so the old one stays unchanged (undo and the search below rely on that)
    n.pc[p] = r.to;  // moves process p to the line the run function chose
    if (r.turn !== undefined) n.turn = r.turn;  // if the line wrote turn, store the new value
    if (r.flag !== undefined) n.flag[p] = r.flag;  // if the line wrote this process's flag, store the new value
    return { n, m: r.m };  // hands back the new state and the plain-language message
  }  // ends exec()
  /* Could any process in `who` still reach its critical section, under SOME future schedule?
     The state space is tiny (at most a few hundred states), so a breadth-first search is instant. */
  function canEnter(P, s0, who) {  // canEnter(P, s0, who): searches every possible future schedule to see if any process in "who" can still reach its critical section
    const seen = new Set([skey(s0)]);  // seen remembers states already visited so the search never loops forever
    const q = [s0];  // q is the queue of states still to explore, starting with the current one (breadth-first search: nearest states first)
    while (q.length) {  // keeps exploring until no unexplored states are left
      const s = q.shift();  // takes the oldest waiting state off the front of the queue
      if (who.some((p) => P[p][s.pc[p]].k === 'cs')) return true;  // success: in this state some process from "who" is on its critical-section line
      for (const p of [0, 1]) {  // tries both possible next moves: let P0 run one line, or let P1 run one line
        if (s.halted[p]) continue;  // a halted process can never run again, so it offers no move
        const { n } = exec(P, s, p);  // works out the state that this move would produce
        const k = skey(n);  // gets that state's text key
        if (!seen.has(k)) { seen.add(k); q.push(n); }  // if this state is new, remember it and queue it to be explored later
      }  // ends the loop over the two processes
    }  // ends the search loop
    return false;  // every reachable state was checked and nobody in "who" can ever get in: blocked for good
  }  // ends canEnter()

  /* ---------------- the interleaving lab: two code panels, shared memory, a verdict ----------------
     Used by the free lab step and the challenge step. The student (or a replay) is the scheduler. */
  function makeLab(ctx, o) {  // makeLab(ctx, o): builds the interleaving lab (two code panels, shared memory, verdict) and returns its parts and controls
    const { h } = ctx;  // h is the guide's helper that creates an HTML element from a tag name, attributes and children
    let id = o.algo || 'a1';  // id is the algorithm now loaded in the lab; it starts with the one asked for, or Attempt 1
    let P = progsOf(id);  // P holds the two runnable line lists (for P0 and P1) of the current algorithm
    let st, hk, hw, log, cnt, last, status, replaying = false, replayTok = 0, demo = false;  // lab state: st machine state, hk/hw history for the livelock check, log, counters, last step, verdict, replay flags
    const undo = [];  // undo is a stack of saved snapshots, one pushed before every step so Undo can go back
    const mkCell = (nm) => { const v = h('div', { class: 'v' }); return { el: h('div', { class: 'cell' }, h('div', { class: 'nm' }, nm), v), v, prev: null }; };  // mkCell(nm): builds one labelled memory box (name on top, value below) and remembers its last shown value
    const cells = [mkCell('turn'), mkCell('flag[0]'), mkCell('flag[1]')];  // the three shared-memory boxes: turn, flag[0] and flag[1]
    const room = h('div', { class: 'room' });  // room is the "Critical section" box that shows which process badges are inside
    const mem = h('div', { class: 'stack gap-s' }, h('h4', { class: 'm0 center' }, 'Shared memory'), ...cells.map((c) => c.el), room);  // mem is the middle column: a heading, the three memory boxes, and the critical-section box
    const panels = [0, 1].map((p) => {  // builds the two process panels, one for P0 and one for P1
      const chip = h('span', { class: 'chip' });  // chip is the small label that says where this process is (entry protocol, waiting, halted ...)
      const btn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => stepBy(p) }, `Step P${p}`);  // the Step button runs this process's highlighted line when clicked
      const halt = h('button', { class: 'btn sm ghost', type: 'button', title: `Make P${p} stop for good, as if it crashed right here`, onclick: () => haltP(p) }, 'Halt');  // the Halt button stops this process for good, to test what happens if it crashes on that line
      const codeBox = h('div', {});  // codeBox is the empty holder that will receive the process's code listing
      const next = h('div', { class: 'pp-next' });  // next is the box under the code that explains what the highlighted line will do
      const el = h('div', { class: `card white ppanel p${p}` }, h('div', { class: 'pp-head' }, h('span', { class: `tok p${p}` }, `P${p}`), chip, h('span', { class: 'grow' }), halt, btn), codeBox, next);  // el assembles the panel: a header with badge, chip, Halt and Step, then the code, then the Next box
      return { el, chip, btn, halt, codeBox, next, pre: null };  // hands back the panel and its parts; pre will hold the code listing once it is built
    });  // ends the two panels
    const grid = h('div', { class: 'grid-3 labgrid' }, panels[0].el, mem, panels[1].el);  // grid places P0's panel, shared memory and P1's panel side by side in three columns
    const verdict = h('div', { class: 'verdict' });  // verdict is the coloured bar that reports the last step and whether anything went wrong
    const logEl = h('div', { class: 'log grow' });  // logEl is the step log, newest step first
    const stats = h('div', { class: 'small' });  // stats is the scoreboard text: critical-section visits, wasted spins and total steps
    const undoBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => undoStep() }, 'Undo');  // Undo button: takes back the last step
    const resetBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { stopReplay(); reset(); } }, 'Reset');  // Reset button: stops any replay and restarts the current algorithm from its first line

    function buildCode() {  // buildCode(): puts the current algorithm's code into both panels; runs at start and whenever the algorithm changes
      panels.forEach((pn, p) => {  // handles each panel in turn, with p = 0 for P0 and 1 for P1
        pn.pre = ctx.ui.code(P[p].map((l) => l.c).join('\n'), { lang: 'c', fontSize: 13 });  // builds a numbered, coloured C listing from the shown text of every line; mark() and clear() can later highlight lines
        pn.codeBox.replaceChildren(pn.pre);  // swaps the new listing into the panel in place of the old one
      });  // ends the loop over panels
    }  // ends buildCode()
    function snap() { undo.push(JSON.stringify({ st, hk, hw, log, cnt, last })); if (undo.length > 300) undo.shift(); }  // snap(): saves the whole lab state as text on the undo stack before a step, keeping at most 300 snapshots
    function reset() {  // reset(): puts the lab back to the start of the current algorithm
      st = fresh(id); hk = [skey(st)]; hw = []; log = []; cnt = { e: [0, 0], s: [0, 0], n: 0 }; last = null; undo.length = 0; demo = false;  // fresh machine state, history holds only the start state, empty log and counters, no undo steps, not a demo
      cells.forEach((c) => (c.prev = null));  // forgets the last shown values so the memory boxes do not flash on reset
      paint();  // redraws everything to show the fresh state
    }  // ends reset()
    function undoStep() {  // undoStep(): runs when Undo is pressed; restores the most recent snapshot
      if (!undo.length || replaying) return;  // nothing to undo, or a replay is running: ignore the press
      demo = false;  // an undone position is the student's own work, not a demo replay
      ({ st, hk, hw, log, cnt, last } = JSON.parse(undo.pop()));  // pops the latest snapshot and restores every saved variable from it in one go
      paint();  // redraws the lab at the restored position
    }  // ends undoStep()
    function stepBy(p, auto) {  // stepBy(p, auto): runs one line of process p; runs on a Step click, the 0 or 1 key, or a replay (auto = true)
      if ((replaying && !auto) || st.halted[p]) return;  // ignores clicks during a replay, and ignores a halted process
      if (!auto) demo = false;  // a step the student makes by hand means this is no longer a demo replay
      snap();  // saves the current state so this step can be undone
      const ln = P[p][st.pc[p]];  // ln is the line about to run
      const { n, m } = exec(P, st, p);  // runs it: n is the new state and m the sentence describing what happened
      const k = skey(n);  // key of the new state, for the livelock history
      const changed = k !== skey(st);  // changed is true if the step altered anything at all (a line position or a shared variable)
      const entered = P[p][n.pc[p]].k === 'cs' && ln.k !== 'cs';  // entered is true if this step moved the process onto its critical-section line from somewhere else
      // a wasted "spin": a test in the entry protocol that changed no shared variable and looped back
      // (or stayed put) instead of moving forward; this also catches Dekker's tie-holder re-checking flag[j]
      const spin = ln.k === 'entry' && P[p][n.pc[p]].k === 'entry' && n.pc[p] <= st.pc[p] && n.turn === st.turn && n.flag[0] === st.flag[0] && n.flag[1] === st.flag[1];  // spin: an entry-protocol test that went back or stayed put and changed no shared variable
      cnt.n++;  // counts the step in the total
      if (spin) cnt.s[p]++;  // adds a wasted spin for this process
      if (entered) cnt.e[p]++;  // adds a critical-section visit for this process
      st = n;  // the new state becomes the current state
      last = { p, c: ln.c.trim(), m, spin, entered, cyc: 0 };  // last remembers this step for the verdict bar: who ran, which code, the message, and the spin/entry/cycle flags
      if (entered) { hk = [k]; hw = []; } else {  // an entry is real progress, so the livelock history starts over from here; otherwise it is extended
        // livelock check: have we come back to an earlier state, with BOTH processes changing things on the way?
        const at = hk.lastIndexOf(k);  // at: where this state appeared earlier in the history, or -1 if it is new
        const w = hw.concat([{ p, ch: changed }]);  // w adds this step (who ran and whether it changed anything) to the list of steps since the last entry
        if (at >= 0) {  // the state has been seen before, so look at the steps taken since then
          const seg = w.slice(at);  // seg is the list of steps between the earlier visit and now
          if (seg.some((x) => x.p === 0 && x.ch) && seg.some((x) => x.p === 1 && x.ch)) last.cyc = seg.length;  // if both P0 and P1 changed something during that loop, it is a livelock cycle; record its length
        }  // ends the repeated-state check
        hk.push(k); hw = w;  // records the new state and the extended step list
      }  // ends the history update
      log.push({ n: cnt.n, p, c: ln.c.trim(), spin });  // adds the step to the log shown under the scoreboard
      paint();  // redraws the whole lab and updates the verdict
    }  // ends stepBy()
    function haltP(p, auto) {  // haltP(p, auto): stops process p for good, as if it crashed; runs on a Halt click or during a replay
      if ((replaying && !auto) || st.halted[p]) return;  // ignores clicks during a replay and ignores an already halted process
      if (!auto) demo = false;  // a hand-made halt ends demo mode
      snap();  // saves the state so the halt can be undone
      st = JSON.parse(JSON.stringify(st));  // makes a full copy of the state so the saved snapshot is not changed
      st.halted[p] = true;  // marks the process as halted
      hk = [skey(st)]; hw = [];  // a halt changes the situation, so the livelock history starts again from here
      last = { p, halt: true };  // last records that this step was a halt, for the verdict bar
      log.push({ n: cnt.n, p, c: 'HALTED', halt: true });  // adds a HALTED entry to the step log
      paint();  // redraws the lab so the halted panel dims and the verdict updates
    }  // ends haltP()
    function assess() {  // assess(): judges the current state and returns the verdict: level (colour), event name, heading and explanation
      const k = (p) => P[p][st.pc[p]].k;  // k(p): the kind of line process p is on now (entry, cs, exit, rem)
      const inCS = [0, 1].filter((p) => k(p) === 'cs');  // inCS lists the processes that are on their critical-section line right now
      if (!last) return { lv: 'ok', ev: 'start', head: 'Your move', text: 'Both processes want to enter. Press <b>Step P0</b> or <b>Step P1</b> (or the keys 0 and 1) to run the highlighted line of that process.' };  // before any step: a friendly "Your move" message that explains the Step buttons and the 0 and 1 keys
      if (inCS.length === 2) return { lv: 'bad', ev: 'violation', head: 'Mutual exclusion violated', text: 'P0 and P1 are both inside their critical sections at once. Any shared data they touch can now be corrupted.' };  // both processes inside at once: mutual exclusion is broken, the worst outcome, shown in red
      if (st.halted[0] && st.halted[1]) return { lv: 'info', ev: 'halted', head: 'Both halted', text: 'Nothing can run any more. Press Reset (or Undo).' };  // both processes halted: nothing can run, so suggest Reset or Undo
      const waiting = [0, 1].filter((p) => !st.halted[p] && k(p) === 'entry');  // waiting lists the live processes that are still in their entry protocol, trying to get in
      if (waiting.length && !canEnter(P, st, waiting)) {  // if someone is waiting and the search finds that no future schedule can let any of them in, it is stuck for good
        const q = st.halted[0] ? 0 : st.halted[1] ? 1 : -1;  // q is the halted process, if there is one (-1 when neither is halted)
        if (q >= 0) {  // a halt is the cause of the blockage
          const where = { cs: 'inside its critical section', rem: 'in its remainder section, outside its critical section', exit: 'in its exit protocol', entry: 'in its entry protocol' }[k(q)];  // describes in words where the halted process stopped, based on the kind of line it is on
          return { lv: 'bad', ev: k(q) === 'rem' ? 'blocked' : 'blocked-in', head: 'Blocked forever', text: `P${q} halted ${where}. P${1 - q} is waiting for a change that only P${q} could make, so no schedule can ever let it in.` };  // "Blocked forever": the survivor waits for a change only the halted process could make; the event name says if it halted in its remainder
        }  // ends the halted case
        if (waiting.length === 2) return { lv: 'bad', ev: 'deadlock', head: 'Deadlock', text: 'Both processes are waiting, and no future order of steps can ever let either one in. Each waits for the other to lower its flag.' };  // nobody halted and both are waiting with no way out: that is deadlock
      }  // ends the stuck-for-good checks
      if (last.cyc) return { lv: 'warn', ev: 'livelock', head: 'Livelock pattern', text: `Everything is exactly as it was ${last.cyc} steps ago, and nobody got in. Keep this rhythm and it repeats forever; let one process run ahead and it breaks.` };  // the last step brought back an earlier state with both processes busy: report the livelock pattern and its length
      if (last.spin) {  // the last step was a wasted test (a spin)
        const q = 1 - last.p;  // q is the other process, the one that did not just run
        if (!st.halted[q] && k(q) === 'rem' && !inCS.length) return { lv: 'warn', ev: 'alternation', head: 'Forced alternation', text: `The critical section is empty and P${q} is not even trying to enter, yet P${last.p} must wait because the turn belongs to P${q}.` };  // the room is empty and the other process is not even trying, yet this one must wait: forced strict alternation
        return { lv: 'info', ev: 'spin', head: 'Busy waiting', text: `P${last.p} tested again and must keep looping. No shared variable changed, so that CPU step was wasted.` };  // otherwise it is ordinary busy waiting: a test that changed nothing and wasted a CPU step
      }  // ends the spin case
      if (inCS.length) {  // exactly one process is inside its critical section
        const q = 1 - inCS[0];  // q is the process that is not inside
        const extra = st.halted[q] && k(q) === 'rem' ? ` P${q} halted outside its critical section, yet P${inCS[0]} still got in.` : '';  // extra adds a remark if the other process halted outside its critical section and this one still got in
        return { lv: 'ok', ev: 'enter', head: `P${inCS[0]} is in its critical section`, text: `It is alone there, so mutual exclusion holds.${extra}` };  // green verdict: one process is alone inside, so mutual exclusion holds
      }  // ends the one-inside case
      return { lv: 'ok', ev: 'ok', head: 'No problem yet', text: 'Nobody is in a critical section. Choose who runs next.' };  // nothing special happened: nobody is inside, so invite the student to choose who runs next
    }  // ends assess()
    function setCell(c, v) {  // setCell(c, v): shows value v in memory box c, greys out unused boxes, and flashes the box when the value changes
      c.el.classList.toggle('off', v === null);  // dims the box and gives it a dashed border when this algorithm does not use that variable (v is null)
      if (v === null) { c.v.className = 'v'; c.v.textContent = 'not used'; c.prev = null; return; }  // unused variable: shows "not used", clears its colour and forgets its last value, then stops
      const txt = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);  // txt is the value as text: "true"/"false" for flags, a number for turn
      c.v.className = 'v' + (typeof v === 'boolean' ? (v ? ' tv T' : ' tv F') : '');  // true/false values get the green or grey value colouring; numbers stay plain
      c.v.textContent = txt;  // writes the value into the box
      if (c.prev !== null && c.prev !== txt) { c.el.classList.remove('flash'); void c.el.offsetWidth; c.el.classList.add('flash'); }  // if the value differs from the last one, restarts the flash animation (reading offsetWidth makes the browser restart it)
      c.prev = txt;  // remembers this value for the next comparison
    }  // ends setCell()
    function paint() {  // paint(): redraws the whole lab from the current state; runs after every step, undo, halt and reset
      const a = assess();  // a is the verdict for the current state
      status = a;  // keeps the verdict so the challenge step can read it through the returned controls
      panels.forEach((pn, p) => {  // updates each process panel
        const kind = P[p][st.pc[p]].k;  // kind of the line this process is on
        pn.pre.clear();  // removes the old line highlight from this panel's code
        pn.pre.mark(st.pc[p] + 1, st.halted[p] ? 'dim' : kind === 'cs' ? (a.ev === 'violation' ? 'bad' : 'ok') : 'cur');  // highlights the current line: dim if halted, green inside the critical section (red if both are inside), else the normal colour
        const spun = last && !last.halt && last.p === p && last.spin;  // spun is true if this process's last step was a wasted spin
        const [cls, txt] = st.halted[p] ? ['bad', 'halted'] : kind === 'cs' ? ['ok', 'in critical section'] : kind === 'rem' ? ['', 'remainder section']  // picks the chip's colour and wording: halted, in critical section, remainder section...
          : kind === 'exit' ? ['', 'exit protocol'] : spun ? ['warn', 'waiting'] : ['', 'entry protocol'];  // ...exit protocol, waiting (after a spin), or entry protocol
        pn.chip.className = 'chip ' + cls;  // applies the chip colour
        pn.chip.textContent = txt;  // writes the chip wording
        pn.el.classList.toggle('halted', st.halted[p]);  // dims the whole panel when the process is halted
        pn.next.innerHTML = st.halted[p] ? `<b>Halted.</b> P${p} stopped on this line and will never run again.` : `<b>Next:</b> ${P[p][st.pc[p]].x}`;  // fills the Next box: either a halted notice or the plain-language hint for the line about to run
        pn.btn.disabled = st.halted[p] || replaying;  // a halted process cannot be stepped, and the Step buttons are locked during a replay
        pn.halt.disabled = st.halted[p] || replaying;  // the Halt button is locked the same way
      });  // ends the loop over panels
      const A = ALGO[id];  // A is the settings entry of the current algorithm (does it use turn? flags?)
      setCell(cells[0], A.turn ? st.turn : null);  // turn box: shows turn, or "not used" if this algorithm has no turn variable
      setCell(cells[1], A.flag ? st.flag[0] : null);  // flag[0] box: shows P0's flag, or "not used" for Attempt 1
      setCell(cells[2], A.flag ? st.flag[1] : null);  // flag[1] box: shows P1's flag, or "not used" for Attempt 1
      const inside = [0, 1].filter((p) => P[p][st.pc[p]].k === 'cs');  // inside lists the processes on their critical-section line
      room.className = 'room' + (inside.length === 2 ? ' two' : inside.length ? ' one' : '');  // the critical-section box turns green with one process inside and red with two
      room.innerHTML = `<div class="xs">Critical section</div><div class="row" style="justify-content:center;gap:6px">${inside.length ? inside.map(TOK).join('') : '<span class="small muted">empty</span>'}</div>`;  // writes the box's title and the badges of the processes inside, or "empty"
      const lastTxt = !last ? 'No steps yet: both processes are about to run their first line.'  // lastTxt describes the last step: before any step, a note that both are about to run their first line...
        : last.halt ? `${PN(last.p)} was halted, as if it crashed.`  // ...after a halt, a note that the process crashed...
          : `Step ${cnt.n}: ${PN(last.p)} ran <code>${esc(last.c)}</code> and ${last.m}.`;  // ...otherwise the step number, who ran, the code it ran (made HTML-safe) and what that did
      verdict.className = 'verdict ' + a.lv;  // colours the verdict bar by level: ok (green), info, warn (amber) or bad (red)
      verdict.innerHTML = `<div class="last">${lastTxt}</div><div><b>${a.head}.</b> ${a.text}</div>`;  // writes the last-step line and the verdict heading and text into the bar
      stats.innerHTML = `Critical-section visits: ${PN(0)} ${cnt.e[0]} · ${PN(1)} ${cnt.e[1]}<br>Wasted spin steps: ${PN(0)} ${cnt.s[0]} · ${PN(1)} ${cnt.s[1]}<br>Total steps: ${cnt.n}`;  // fills the scoreboard with visits, wasted spins per process and the total step count
      logEl.innerHTML = log.length ? log.slice(-60).reverse().map((e) => e.halt ? `<div class="bad">P${e.p} halted</div>` : `<div${e.spin ? ' class="spin"' : ''}><b>${e.n}</b> ${PN(e.p)} <code>${esc(e.c)}</code>${e.spin ? ' ↻' : ''}</div>`).join('') : '<div class="muted">Steps you schedule appear here, newest first.</div>';  // fills the step log with the latest 60 steps, newest first, marking spins with a loop arrow and halts in red
      undoBtn.disabled = !undo.length || replaying;  // Undo is disabled when there is nothing to undo or a replay is running
      if (o.onEvent) o.onEvent(a.ev, api);  // tells the step that owns the lab (the challenges) what just happened, so it can check for a solved challenge
    }  // ends paint()
    function stopReplay() { if (replaying) { replayTok++; replaying = false; } }  // stopReplay(): cancels a running replay; bumping replayTok makes the pending timer notice and stop
    function play(seq, done) {  // play(seq, done): replays a list of moves automatically, one every 0.7 s, for the Show me button
      stopReplay();  // cancels any replay already running
      reset();  // starts from the algorithm's first line
      replaying = true;  // locks the Step and Halt buttons while the replay runs
      demo = true;  // marks the moves as a demo, so a replay does not count as the student solving a challenge
      paint();  // redraws with the buttons locked
      const tok = ++replayTok;  // tok identifies this replay; if another replay starts or it is cancelled, the numbers stop matching
      let i = 0;  // i is the index of the next move in the list
      const tick = () => {  // tick(): runs one move of the replay, then schedules the next one
        if (tok !== replayTok || !ctx.alive) return;  // stops quietly if this replay was cancelled or the student has left this step
        if (i >= seq.length) { replaying = false; paint(); if (done) done(); return; }  // after the last move: unlock the buttons, redraw, and call the finish function if one was given
        const a = seq[i++];  // takes the next move from the list
        if (a === 'h0' || a === 'h1') haltP(+a[1], true); else stepBy(a, true);  // "h0"/"h1" means halt that process; a number means step that process
        ctx.after(o.speed || 700, tick);  // schedules the next move after the chosen speed (0.7 s unless the step set another); ctx.after cancels itself if the step closes
      };  // ends tick()
      ctx.after(450, tick);  // starts the first move after a short 0.45 s pause so the student sees the reset state first
    }  // ends play()
    function setAlgo(nid) { stopReplay(); id = nid; P = progsOf(id); buildCode(); reset(); }  // setAlgo(nid): switches the lab to another algorithm: stop any replay, load its lines, rebuild the code and reset
    if (o.keys) {  // only when the step asked for keyboard shortcuts
      ctx.on(document, 'keydown', (e) => {  // listens for key presses on the whole page; ctx.on removes the listener when the student leaves the step
        if (e.metaKey || e.ctrlKey || e.altKey) return;  // ignores keys pressed together with Cmd, Ctrl or Alt, so browser shortcuts still work
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;  // ignores keys typed into a text box or menu
        if (e.key === '0') stepBy(0); else if (e.key === '1') stepBy(1);  // the 0 key steps P0 and the 1 key steps P1
      });  // ends the key handler
    }  // ends the keyboard setup
    const api = {  // api: the parts and controls the calling step can use to place and drive the lab
      grid, verdict, logEl, stats, undoBtn, resetBtn, setAlgo, reset, play, stopReplay,  // the page parts (grid, verdict, log, scoreboard, buttons) and the control functions
      get id() { return id; }, get cnt() { return cnt; }, get status() { return status; }, get replaying() { return replaying; }, get demo() { return demo; },  // read-only views of the current algorithm, counters, verdict and replay flags (getters: read like values, always up to date)
    };  // closes the api object
    buildCode();  // fills both code panels with the starting algorithm
    reset();  // puts the lab in its starting state and draws it for the first time
    return api;  // hands the parts and controls back to the step that asked for the lab
  }  // ends makeLab()

  /* ---------------- fine print, tab 1: Peterson's idea for n processes (the filter algorithm) ----------------
     n = 3, levels 1..2. Each process: set (level[i] = L) → vic (victim[L] = i) → test (wait, or climb) → cs → exit → rem.
     Model-checked (dev/scratch-5.1/filtercheck.js): never two in the CS, at most n − L past level L, never stuck. */
  function filterTab(panel, ctx) {  // filterTab(panel, ctx): builds the first "Going deeper" tab, where three processes climb the levels of the filter algorithm
    const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements (SVG is the browser's drawing format)
    const N = 3, LINE = { set: 3, vic: 4, test: 5, cs: 9, exit: 10, rem: 11 };  // N is the number of processes; LINE maps each phase of a process to its line number in the code listing below
    const code = ctx.ui.code(`${/* code: the filter algorithm listing shown on the left, built as a numbered C code block */''}
int level[n] = {0}, victim[n]; // shared; 0 = not trying${/* shown code, line 1: the two shared arrays, level (how far each process has climbed) and victim (latest arrival per level) */''}
for (L = 1; L < n; L++) {  // climb levels 1 .. n-1${/* shown code, line 2: the loop that climbs levels 1 to n-1 */''}
    level[i] = L;          // "I have reached level L"${/* shown code, line 3: record the level this process has reached */''}
    victim[L] = i;         // "I am the latest one here"${/* shown code, line 4: mark itself as the latest arrival at this level */''}
    while (victim[L] == i  // wait while I am the latest${/* shown code, line 5: start of the wait test: am I still the latest arrival here? */''}
      && some other Pk has //   AND someone else is at${/* shown code, line 6: second half of the wait condition: is any other process at this level... */''}
         level[k] >= L) ;  //   level L or above${/* shown code, line 7: ...or above? If both hold, keep waiting (busy wait) */''}
}                          // passed level L: climb on${/* shown code, line 8: end of the climbing loop */''}
/* critical section */     // only one process gets here${/* shown code, line 9: the critical section, reached by only one process at a time */''}
level[i] = 0;              // back to "not trying"${/* shown code, line 10: on the way out, drop back to level 0 (not trying) */''}
/* remainder section */    // other work, then repeat`, { lang: 'c', fontSize: 13 });  // shown code, line 11: the remainder section; then the listing ends and the code block options follow
    let st, last, steps;  // st is the state of the three processes, last the latest narration, steps the step count
    const reset = () => { st = { pc: ['set', 'set', 'set'], L: [1, 1, 1], level: [0, 0, 0], victim: [null, null, null], spin: [false, false, false] }; last = null; steps = 0; code.clear(); paint(); };  // reset(): all three start at phase "set" of level 1, nobody has a level or victim yet; clears the highlight and redraws
    const blocked = (S, i) => S.victim[S.L[i]] === i && S.level.some((v, k) => k !== i && v >= S.L[i]);  // blocked(S, i): process i must wait if it is the latest arrival at its level and some other process is at that level or higher
    const passed = (S, L) => S.pc.filter((p, i) => p === 'cs' || p === 'exit' || (p !== 'rem' && S.L[i] > L)).length;  // passed(S, L): counts processes past level L (inside, leaving, or climbing a higher level), for the safety line under the drawing
    function step(i, quiet) {  // step(i, quiet): runs process i's next line; quiet skips the redraw (used by Random x5 for all but the last step)
      const S = st, L = S.L[i], p = S.pc[i];  // S is the state, L the level process i is working on, p the phase it is in
      S.spin[i] = false;  // a new step clears this process's "waiting" mark until its next test says otherwise
      let m;  // m will hold the sentence that describes this step
      if (p === 'set') { S.level[i] = L; S.pc[i] = 'vic'; m = `writes <code>level[${i}] = ${L}</code>: it has reached level ${L}.`; }  // phase "set": write level[i] = L, then go on to write victim
      else if (p === 'vic') {  // phase "vic": write victim[L] = i
        const old = S.victim[L];  // old is the process that was the latest arrival at this level until now
        const freed = old !== null && old !== i && S.pc[old] === 'test' && S.L[old] === L;  // freed is true if that process is waiting at the same level: a newer arrival releases it
        S.victim[L] = i; S.pc[i] = 'test';  // records this process as the latest arrival, then moves it to the test phase
        m = `writes <code>victim[${L}] = ${i}</code>: it is now the latest arrival at level ${L}.` + (freed ? ` That releases ${PN(old)}: it is no longer the latest, so its next test passes.` : '');  // the narration says so, and mentions the process it just released, if any
      } else if (p === 'test') {  // phase "test": the wait condition of the filter algorithm
        const others = [0, 1, 2].filter((k) => k !== i && S.level[k] >= L);  // others lists the other processes at this level or above
        if (blocked(S, i)) { S.spin[i] = true; m = `tests level ${L}: it is the latest arrival (<code>victim[${L}] = ${i}</code>) and ${others.map(PN).join(' and ')} ${others.length > 1 ? 'are' : 'is'} at level ${L} or above, so it must wait (busy wait).`; }  // blocked: mark it as waiting and explain which processes are holding it back
        else {  // not blocked, so it passes this level
          const why = S.victim[L] !== i ? `<code>victim[${L}]</code> is P${S.victim[L]}, not P${i}` : `no other process is at level ${L} or above`;  // why explains the reason: someone else is now the latest arrival, or nobody else is at this level or above
          if (L < N - 1) { S.L[i] = L + 1; S.pc[i] = 'set'; m = `tests level ${L}: ${why}, so it passes and climbs toward level ${L + 1}.`; }  // below the top level: climb to the next level and start again at "set"
          else { S.pc[i] = 'cs'; m = `tests level ${L}: ${why}, so it passes the top level and <b>enters its critical section</b>.`; }  // at the top level: enter the critical section
        }  // ends the test phase
      } else if (p === 'cs') { S.pc[i] = 'exit'; m = 'finishes its critical section.'; }  // phase "cs": leave the critical section
      else if (p === 'exit') { S.level[i] = 0; S.pc[i] = 'rem'; S.L[i] = 1; m = `writes <code>level[${i}] = 0</code>: it is no longer trying.`; }  // phase "exit": drop back to level 0 and reset its climb to level 1
      else { S.pc[i] = 'set'; m = 'finishes its other work and wants in again.'; }  // phase "rem": finish other work and want in again
      steps++;  // counts the step
      last = `<b>Step ${steps}</b> (line ${LINE[p]}): ${PN(i)} ${m}`;  // last is the narration: step number, code line, which process, what happened
      code.clear(); code.mark(LINE[p]);  // highlights the line that just ran in the code listing
      if (!quiet) paint();  // redraws everything unless this is one of the silent random steps
    }  // ends step()
    const cells = ['level[0]', 'level[1]', 'level[2]', 'victim[1]', 'victim[2]'].map((nm) => { const v = h('div', { class: 'v' }); return { el: h('div', { class: 'cell' }, h('div', { class: 'nm' }, nm), v), v, prev: null }; });  // builds five memory boxes: level[0] to level[2], victim[1] and victim[2]
    const NW = ctx.narrow;  // NW is true when the guide uses its phone-width layout; the drawing then stacks its zones in two rows
    const svg = s('svg', { viewBox: NW ? '0 0 284 398' : '0 0 560 196', width: '100%', role: 'img', 'aria-label': 'Three processes climbing the levels of the filter algorithm' });  // the drawing of the levels; its coordinate box is tall and slim on a phone, wide and short otherwise
    const nar = h('div', { class: 'card tight small', style: { minHeight: '66px' } });  // nar is the narration card below the drawing, kept at least 66 px tall so the page does not jump
    const stat = h('div', { class: 'small' });  // stat is the safety line: how many processes are past each level
    const btns = [0, 1, 2].map((i) => h('button', { class: 'btn sm primary', type: 'button', onclick: () => step(i) }, `Step P${i}`));  // one Step button per process
    const rnd = h('button', { class: 'btn sm', type: 'button', onclick: () => { for (let k = 0; k < 5; k++) step(Math.floor(Math.random() * N), k < 4); } }, 'Random ×5');  // Random x5: runs five steps of randomly chosen processes, redrawing only after the last one
    const rst = h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset');  // Reset button: puts all three processes back at the start
    const ZX = NW ? [6, 144, 6, 144] : [6, 144, 282, 420], ZY = NW ? [0, 0, 202, 202] : [0, 0, 0, 0], ZN = ['not trying', 'level 1', 'level 2', 'critical section'], PC = ['s-proc', 's-accent', 's-thread'], PV = ['--proc', '--accent', '--thread'];  // zone positions (x and y for the four zones), zone titles, and each process's colour class and colour variable
    const T = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 13 }, o), t);  // T(x, y, t, o): makes a centered SVG text label at (x, y), with optional extra attributes
    function paint() {  // paint(): redraws the memory boxes, the level zones, the process boxes, the narration and the safety line
      const S = st;  // S is the current state
      const vals = [S.level[0], S.level[1], S.level[2], S.victim[1], S.victim[2]];  // vals are the five shared values in the same order as the memory boxes
      cells.forEach((c, k) => {  // updates each memory box
        const txt = vals[k] === null ? '–' : (k > 2 ? 'P' : '') + vals[k];  // a dash means no value yet; victim values get a P in front (P2)
        c.v.textContent = txt;  // writes the value into the box
        if (c.prev !== null && c.prev !== txt) { c.el.classList.remove('flash'); void c.el.offsetWidth; c.el.classList.add('flash'); }  // if the value changed, restarts the flash animation so the change catches the eye
        c.prev = txt;  // remembers the value for the next comparison
      });  // ends the memory-box update
      const inCS = S.pc.filter((p) => p === 'cs').length;  // inCS counts how many processes are in the critical section (should never exceed 1)
      const kids = [];  // kids collects every shape of the new drawing
      ZX.forEach((x, z) => {  // draws the four zones: not trying, level 1, level 2 and critical section
        const y0 = ZY[z];  // y0 is the top of this zone (non-zero only in the stacked phone layout)
        kids.push(s('rect', { x, y: y0 + 22, width: 134, height: 172, rx: 10, class: z === 3 ? (inCS > 1 ? 's-bad' : 's-ok') : 's-panel', 'stroke-width': 1.5 }),  // the zone's rounded box; the critical-section zone is green, or red if two processes are inside at once
          T(x + 67, y0 + 15, ZN[z], { 'font-weight': 700 }));  // the zone's title in bold above the box
        if (z === 1 || z === 2) kids.push(T(x + 67, y0 + 186, S.victim[z] === null ? 'latest: none yet' : `latest: P${S.victim[z]}`, { class: 's-sub' }));  // levels 1 and 2 show which process is the latest arrival there
      });  // ends the zone drawing
      const slot = [0, 0, 0, 0];  // slot counts how many process boxes are already stacked in each zone
      [0, 1, 2].forEach((i) => {  // draws each of the three processes
        const p = S.pc[i], z = p === 'cs' || p === 'exit' ? 3 : S.level[i], y = ZY[z] + 30 + slot[z]++ * 50;  // its zone: the critical-section zone while inside or leaving, otherwise the level it has reached; y stacks boxes 50 apart
        const status = { set: `next: level = ${S.L[i]}`, vic: `next: victim[${S.L[i]}] = ${i}`, test: S.spin[i] ? 'waits ↻ (latest)' : `next: test level ${S.L[i]}`, cs: 'inside', exit: 'leaving', rem: 'remainder' }[p];  // status is the short line under the process name, saying what it does next (or that it waits)
        kids.push(s('rect', { x: ZX[z] + 6, y, width: 122, height: 44, rx: 9, class: PC[i], 'stroke-width': S.spin[i] ? 1.5 : 2, 'stroke-dasharray': S.spin[i] ? '5 3' : null }),  // the process's box in its colour; a dashed thinner border means it is busy waiting
          T(ZX[z] + 67, y + 18, 'P' + i, { 'font-weight': 800, 'font-size': 15, style: `fill:var(${PV[i]})` }),  // the process name in bold, in its colour
          T(ZX[z] + 67, y + 36, status, { 'font-size': 13 }));  // the status line under the name
      });  // ends the process drawing
      svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes
      nar.innerHTML = last || 'All three processes want in at once. Step them in any order and watch who is held back at each level. Try: <b>Step P0, P1, P2</b>, then all three again, then keep going.';  // shows the last step's narration, or the opening instructions before any step
      stat.innerHTML = `In the critical section: <b>${inCS}</b> · past level 1: <b>${passed(S, 1)}</b> (never more than 2) · past level 2: <b>${passed(S, 2)}</b> (never more than 1)`;  // the safety line: processes in the critical section and past each level, with the limits the algorithm guarantees
    }  // ends paint()
    const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the idea, the code and the reason it is safe
      h('p', { class: 'small m0', html: '<b>Idea:</b> run Peterson’s contest <i>n</i> − 1 times, like the rounds of a tournament. <code>level[i]</code> plays the flag and <code>victim[L]</code> plays <code>turn</code>: at each level, the <b>latest arrival waits</b> while anyone else is at that level or above.' }),  // idea paragraph: the filter algorithm repeats Peterson's contest once per level, like tournament rounds
      code,  // places the code listing
      h('div', { class: 'callout why small m0', 'data-label': 'Why only one gets through', html: 'Each level holds back its latest arrival, so at most <i>n</i> − L processes get past level L. With <i>n</i> = 3: at most 2 pass level 1 and at most 1 passes level 2, the last door before the critical section. No deadlock and no starvation either. With <i>n</i> = 2 there is one level, and this is exactly Peterson’s algorithm.' }));  // callout: why at most n - L processes get past level L, and why n = 2 is Peterson's algorithm
    const right = h('div', { class: 'stack', style: { gap: '8px' } },  // right column: controls, memory boxes, drawing, narration and safety line
      h('div', { class: 'row' }, ...btns, rnd, rst),  // a row with the three Step buttons, Random x5 and Reset
      h('div', { class: 'cells fcells' }, ...cells.map((c) => c.el)), svg, nar, stat);  // a row of the five memory boxes (wrapping onto two lines if needed), then the drawing, narration and safety line
    reset();  // sets up the starting state and draws it
    panel.append(h('div', { class: 'split fill' }, left, right));  // places the two columns side by side inside the tab's panel
  }  // ends filterTab()

  /* ---------------- fine print, tab 2: what busy waiting costs ----------------
     Two CPUs: P0 spins only while P1 finishes (cs µs). One CPU: P1 was preempted inside its CS, so P0 spins its whole slice. */
  function spinTab(panel, ctx) {  // spinTab(panel, ctx): builds the second "Going deeper" tab, which measures how much CPU time busy waiting wastes
    const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
    let cpus = 2, cs = 3, test = 6, slice = 10;  // the four settings the student can change: number of CPUs, P1's remaining time in its CS (µs), time per test (ns), time slice (ms)
    // a count of tests, rounded; eq() gives '=' or '≈' so the arithmetic shown is always honest
    const fmtN = (x) => (x >= 1e6 ? (x / 1e6).toFixed(2).replace(/\.?0+$/, '') + ' million' : Math.round(x).toLocaleString('en-US'));  // fmtN(x): writes a test count for people: millions as "1.67 million", smaller counts rounded with thousands commas
    const eq = (x) => (Number.isInteger(x) ? '=' : '≈');  // eq(x): gives "=" when the division came out whole and "≈" (about equal) when it was rounded
    const tile = (label) => { const v = h('div', { class: 'b', style: { fontSize: '24px', lineHeight: '1.2' } }); return { el: h('div', { class: 'card tight center' }, h('div', { class: 'xs muted b' }, label), v), v }; };  // tile(label): builds one result tile with a small label on top and a big value below that draw() fills in
    const tiles = [tile('Tests wasted'), tile('CPU time wasted'), tile('P0 waits at least')];  // the three result tiles: tests wasted, CPU time wasted, and how long P0 waits at least
    const svg = s('svg', { viewBox: '0 0 560 112', width: '100%', role: 'img', 'aria-label': 'Timeline of a process that busy-waits (not to scale)' });  // the timeline drawing; its label reminds screen-reader users it is not to scale
    const cap = h('div', { class: 'card tight small', style: { minHeight: '84px' } });  // cap is the caption card under the timeline that shows the arithmetic in words
    const T = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 13 }, o), t);  // T(x, y, t, o): makes a centered SVG text label, with optional extra attributes
    const box = (x, y, w, cls, t, o = {}) => [s('rect', Object.assign({ x, y, width: w, height: 34, rx: 7, class: cls, 'stroke-width': 1.5 }, o)), T(x + w / 2, y + 22, t, { 'font-weight': 600 })];  // box(x, y, w, cls, t, o): draws one labelled bar of the timeline (a coloured rectangle with text in the middle)
    function draw() {  // draw(): recomputes the numbers and redraws the timeline; runs at start and whenever a setting changes
      const one = cpus === 1;  // one is true for the single-CPU case
      const spinNs = one ? slice * 1e6 : cs * 1000;  // spinNs: how long P0 spins, in nanoseconds: its whole time slice on one CPU, only P1's remaining CS time on two
      tiles[0].v.textContent = (eq(spinNs / test) === '≈' && spinNs / test < 1e6 ? '≈ ' : '') + fmtN(spinNs / test);  // tile 1: tests wasted = spin time divided by time per test, with "≈" in front when the result was rounded
      tiles[1].v.textContent = one ? `${slice} ms` : `${cs} µs`;  // tile 2: the CPU time thrown away while spinning
      tiles[2].v.textContent = one ? `${slice} ms + ${cs} µs` : `${cs} µs`;  // tile 3: how long P0 must wait before it can get in
      const lane = (y, t) => T(8, y + 22, t, { 'text-anchor': 'start', 'font-weight': 800 });  // lane(y, t): writes a row label (CPU A, CPU B, P1) at the left edge of the timeline
      const kids = [];  // kids collects the shapes of the new timeline
      if (!one) {  // two CPUs: each process has its own CPU
        kids.push(lane(14, 'CPU A'), lane(62, 'CPU B'),  // row labels for the two CPUs
          ...box(66, 14, 240, 's-ok', `P1 finishes its CS · ${cs} µs`), ...box(310, 14, 244, 's-panel', 'P1: remainder section'),  // CPU A: P1 finishes its critical section, then moves on to its remainder section
          ...box(66, 62, 240, 's-warn', `P0 spins ↻ · ${eq(spinNs / test) === '≈' ? '≈ ' : ''}${fmtN(spinNs / test)} tests`), ...box(310, 62, 244, 's-ok', 'P0 enters its CS'),  // CPU B: P0 spins for the same time, with the number of tests, then enters its critical section
          s('line', { x1: 308, y1: 4, x2: 308, y2: 108, class: 's-line', 'stroke-dasharray': '4 3' }));  // a dashed vertical line marks the moment P1 leaves and P0 can go in
      } else {  // the one-CPU case
        kids.push(lane(14, 'CPU'), lane(62, 'P1'),  // row labels: the single CPU, and P1's own row
          ...box(66, 14, 330, 's-warn', `P0 spins ↻ its whole slice · ${slice} ms`), ...box(400, 14, 72, 's-ok', 'P1 CS'), ...box(476, 14, 78, 's-panel', 'later: P0'),  // on the CPU: P0 spins through its whole slice, then P1 finally runs its CS, and later P0 gets in
          ...box(66, 62, 330, 's-panel', 'P1: ready, but has no CPU to run on', { 'stroke-dasharray': '6 4' }),  // P1's row: ready to run but with no CPU, drawn dashed
          s('line', { x1: 398, y1: 4, x2: 398, y2: 108, class: 's-line', 'stroke-dasharray': '4 3' }));  // a dashed vertical line marks the end of P0's time slice
      }  // ends the two cases
      svg.replaceChildren(...kids);  // replaces the old timeline with the new shapes
      cap.innerHTML = one  // the caption depends on the number of CPUs
        ? `<b>One CPU.</b> P1 was switched out <i>inside</i> its critical section, so while P0 spins, P1 cannot run and leave. P0 burns its whole ${slice} ms time slice: ${(slice * 1e6).toLocaleString('en-US')} ns ÷ ${test} ns ${eq(spinNs / test)} <b>${fmtN(spinNs / test)}</b> useless tests. Only then does P1 get the CPU back and finish its last ${cs} µs.`  // one-CPU caption: P1 was switched out inside its CS, so P0 burns its whole slice; shows the division and the result
        : `<b>Two CPUs.</b> P1 keeps running on its own CPU, so P0 spins only until P1 leaves: ${cs} µs = ${(cs * 1000).toLocaleString('en-US')} ns, and ${(cs * 1000).toLocaleString('en-US')} ns ÷ ${test} ns ${eq(spinNs / test)} <b>${fmtN(spinNs / test)}</b> tests. Wasteful, but short. Now switch to one CPU.`;  // two-CPU caption: P0 spins only until P1 leaves; shows the division and the result, then invites switching to one CPU
      sliceSl.style.opacity = one ? '1' : '.45';  // the time-slice slider only matters with one CPU, so it is faded otherwise
      sliceSl.input.disabled = !one;  // and it cannot be moved in the two-CPU case
    }  // ends draw()
    const seg = ctx.ui.seg([{ value: 2, label: 'Two CPUs' }, { value: 1, label: 'One CPU' }], cpus, (v) => { cpus = v; draw(); });  // two-button switch (a segmented control) between Two CPUs and One CPU; choosing one redraws
    const csSl = ctx.ui.slider({ label: 'P1’s time left in its CS', min: 1, max: 20, value: cs, format: (v) => v + ' µs', onInput: (v) => { cs = v; draw(); } });  // slider: how much longer P1 needs in its critical section, 1 to 20 microseconds
    const testSl = ctx.ui.slider({ label: 'Time for one test', min: 2, max: 20, value: test, format: (v) => v + ' ns', onInput: (v) => { test = v; draw(); } });  // slider: how long one test of the flag takes, 2 to 20 nanoseconds
    const sliceSl = ctx.ui.slider({ label: 'P0’s time slice', min: 1, max: 20, value: slice, format: (v) => v + ' ms', onInput: (v) => { slice = v; draw(); } });  // slider: the length of P0's time slice, 1 to 20 milliseconds
    const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column: explanation, formula and callouts
      h('p', { class: 'small m0', html: 'To the OS a spinning process looks busy, so it keeps its CPU while doing nothing useful. How much that wastes depends on <i>where</i> the process it waits for is running.' }),  // intro paragraph: a spinning process looks busy to the OS, and the waste depends on where the other process runs
      h('div', { class: 'card tight center', html: '<div class="xs muted b">THE FORMULA</div><div><b>tests wasted</b> = time spent spinning ÷ time for one test</div><div class="small muted">Example: 3 µs ÷ 6 ns = 3,000 ns ÷ 6 ns = 500 tests</div>' }),  // formula card: tests wasted = time spent spinning divided by time for one test, with a worked example (500 tests)
      h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Thinking a spinning process is idle. It is running: it uses its full share of the CPU, and on a single CPU it even delays the very process it is waiting for.' }),  // callout: the mistake of thinking a spinning process is idle
      h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'Spinning is acceptable only for very short waits on a multiprocessor, where the holder is running and will leave soon (the spinlocks of Section 5.3). For longer waits the process should give up the CPU and sleep until it is woken up. That is what semaphores (Section 5.4) do.' }));  // callout: spinning is fine only for very short waits on a multiprocessor; longer waits should sleep (semaphores, later)
    const right = h('div', { class: 'stack', style: { gap: '8px' } },  // right column: controls, tiles, timeline and caption
      h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, seg, h('span', { class: 'xs muted' }, 'timeline not to scale')),  // top row: the CPU switch on the left and a "not to scale" note on the right
      csSl, testSl, sliceSl,  // the three sliders
      h('div', { class: 'grid-3', style: { gap: '8px' } }, ...tiles.map((t) => t.el)), svg, cap);  // the three result tiles side by side, then the timeline and the caption
    draw();  // draws everything once when the tab opens
    panel.append(h('div', { class: 'split fill' }, left, right));  // places the two columns side by side in the tab's panel
  }  // ends spinTab()

  /* ---------------- fine print, tab 3: Peterson on hardware that reorders memory ----------------
     Frame: [P0 store buffer, P1 store buffer, [flag0, flag1, turn] in memory, P0 status, P1 status, caption]. */
  function orderTab(panel, ctx) {  // orderTab(panel, ctx): builds the third "Going deeper" tab, where store buffers reorder memory and break Peterson
    const { h } = ctx;  // h builds HTML elements
    const T = true, F = false, B0 = ['flag[0] = true', 'turn = 1'], B1 = ['flag[1] = true', 'turn = 0'];  // short names for true and false, plus the two writes each process makes (B0 for P0, B1 for P1) as they appear in a store buffer
    const MODES = {  // MODES: three animated scenarios, each a list of frames (buffers, memory values, process states, caption)
      order: [  // scenario "order": memory works in program order, as every algorithm here assumes
        [[], [], [F, F, 0], '', '', '<b>In-order memory.</b> P0 and P1 run on two CPUs and start Peterson’s entry code together. Every write reaches memory at once, in program order.'],  // frame 1: both processes start Peterson's entry code; every write reaches memory at once
        [[], [], [T, F, 0], '', '', 'P0 writes <code>flag[0] = true</code>. Memory changes immediately.'],  // frame 2: P0 raises flag[0] and memory shows it immediately
        [[], [], [T, F, 1], '', '', 'P0 writes <code>turn = 1</code>.'],  // frame 3: P0 sets turn = 1
        [[], [], [T, T, 1], '', '', 'P1 writes <code>flag[1] = true</code>.'],  // frame 4: P1 raises flag[1]
        [[], [], [T, T, 0], '', '', 'P1 writes <code>turn = 0</code>. P1 wrote <code>turn</code> last.'],  // frame 5: P1 sets turn = 0, so P1 wrote turn last
        [[], [], [T, T, 0], 'in', '', 'P0 tests <code>flag[1] &amp;&amp; turn == 1</code>: true &amp;&amp; false, so P0 enters.'],  // frame 6: P0's test is false, so P0 enters
        [[], [], [T, T, 0], 'in', 'wait', 'P1 tests <code>flag[0] &amp;&amp; turn == 0</code>: true &amp;&amp; true, so P1 waits. <b>One inside, as Peterson promises.</b> Now pick <b>Store buffers</b>.'],  // frame 7: P1's test is true, so P1 waits: one process inside, as promised; invites the next mode
      ],  // ends the "order" frames
      reorder: [  // scenario "reorder": each CPU parks its writes in a private store buffer
        [[], [], [F, F, 0], '', '', '<b>Store buffers.</b> Same code and the same two CPUs, but each CPU parks its writes in a private <b>store buffer</b> and sends them to memory later. Its reads do not wait for them.'],  // frame 1: explains store buffers: writes wait in a buffer, and reads do not wait for them
        [B0, [], [F, F, 0], '', '', 'P0 makes both writes, but they sit in P0’s buffer. Memory has not changed.'],  // frame 2: P0's two writes sit in its buffer; memory has not changed
        [B0, B1, [F, F, 0], '', '', 'P1 does the same. Its writes sit in P1’s buffer.'],  // frame 3: P1's writes sit in its own buffer too
        [B0, B1, [F, F, 0], 'in', '', 'P0 reads <code>flag[1]</code> from memory: still false. Its test fails at once, so P0 enters.'],  // frame 4: P0 reads flag[1] from memory, still false, so it enters
        [B0, B1, [F, F, 0], 'in', 'in', 'P1 reads <code>flag[0]</code> from memory: still false, so P1 enters too. <b>Both are inside: mutual exclusion is broken.</b>'],  // frame 5: P1 reads flag[0], also still false, so it enters too: mutual exclusion is broken
        [[], [], [T, T, 0], 'in', 'in', 'Later the buffers drain and memory shows both flags up, but too late. Each read overtook its own process’s earlier write. Now pick <b>+ barrier</b>.'],  // frame 6: the buffers finally drain, too late; invites the barrier mode
      ],  // ends the "reorder" frames
      fence: [  // scenario "fence": the same buffers, with a memory barrier between the writes and the test
        [[], [], [F, F, 0], '', '', '<b>Store buffers + barrier.</b> Same buffers, but each process now runs a <span class="t">memory barrier</span> between its writes and its test.'],  // frame 1: explains that each process now runs a memory barrier before its test
        [B0, [], [F, F, 0], '', '', 'P0’s two writes go into its store buffer.'],  // frame 2: P0's writes go into its buffer
        [B0, B1, [F, F, 0], '', '', 'P1’s two writes go into its store buffer.'],  // frame 3: P1's writes go into its buffer
        [[], B1, [T, F, 1], 'fence', '', 'P0 reaches its barrier and may not read until its buffer has drained. Memory now holds <code>flag[0] = true</code>, <code>turn = 1</code>.'],  // frame 4: P0 hits its barrier and must wait until its buffer drains into memory
        [[], [], [T, T, 0], 'fence', 'fence', 'P1 reaches its barrier and drains too: <code>flag[1] = true</code>, <code>turn = 0</code>. P1 wrote <code>turn</code> last.'],  // frame 5: P1 hits its barrier and drains too; P1 wrote turn last
        [[], [], [T, T, 0], 'in', 'fence', 'P0 tests <code>flag[1] &amp;&amp; turn == 1</code>: true &amp;&amp; false, so P0 enters.'],  // frame 6: P0's test is false, so P0 enters
        [[], [], [T, T, 0], 'in', 'wait', 'P1 tests <code>flag[0] &amp;&amp; turn == 0</code>: true &amp;&amp; true, so P1 waits. <b>The barrier restored the order the algorithm depends on.</b>'],  // frame 7: P1's test is true, so P1 waits: the barrier restored the order the algorithm needs
      ],  // ends the "fence" frames
    };  // closes the MODES table
    let mode = 'order';  // mode is the scenario being shown; it starts with in-order memory
    const cpu = (p) => {  // cpu(p): builds the panel for one process: a badge, a status chip, its store buffer and what its test read
      const chip = h('span', { class: 'chip' }), buf = h('div', { class: 'sbuf' }), seen = h('div', { class: 'pp-next' });  // the status chip, the store-buffer box, and the line that reports what the test saw
      return { chip, buf, seen, el: h('div', { class: `card white tight ppanel p${p}` }, h('div', { class: 'pp-head' }, h('span', { class: `tok p${p}` }, `P${p}`), h('span', { class: 'grow' }), chip), h('div', { class: 'xs muted b' }, 'STORE BUFFER'), buf, seen) };  // hands back the parts and the assembled card: header with badge and chip, the "STORE BUFFER" label, the buffer and the test line
    };  // ends cpu()
    const cp = [cpu(0), cpu(1)];  // cp holds the two process panels, P0 and P1
    const OK = ['<code>flag[1]</code> true, <code>turn</code> 0: go in', '<code>flag[0]</code> true, <code>turn</code> 0: wait'];  // OK: what each process's test read when memory keeps program order (P0 goes in, P1 waits)
    const SEEN = { order: OK, fence: OK, reorder: ['<code>flag[1]</code> false: go in', '<code>flag[0]</code> false: go in'] };  // SEEN: what each test read in each scenario; with store buffers both read a false flag and go in
    const cells = ['flag[0]', 'flag[1]', 'turn'].map((nm) => { const v = h('div', { class: 'v' }); return { el: h('div', { class: 'cell' }, h('div', { class: 'nm' }, nm), v), v }; });  // the three shared-memory boxes: flag[0], flag[1] and turn
    const room = h('div', { class: 'room' });  // room is the "Critical section" box between the two panels
    const player = ctx.ui.player({  // player: the guide's step-by-step animation player (Play, Pause, Back, Next, a progress bar and a caption)
      count: MODES[mode].length, interval: 2100,  // starts with the frame count of the current scenario and advances every 2.1 seconds while playing
      render: (i) => {  // render(i): draws frame i of the current scenario and returns its caption; the player calls it on every frame change
        const fr = MODES[mode][Math.min(i, MODES[mode].length - 1)];  // fr is the frame to draw; the index is capped in case a shorter scenario was just chosen
        [0, 1].forEach((p) => {  // updates both process panels
          cp[p].buf.innerHTML = fr[p].length ? fr[p].map((w) => `<code>${w}</code>`).join('') : '<span class="xs muted">empty</span>';  // lists the writes waiting in this CPU's store buffer, or "empty"
          const st = fr[3 + p];  // st is this process's status in the frame: in, wait, fence (at the barrier) or blank (still in entry code)
          const [cls, txt] = { in: ['ok', 'in critical section'], wait: ['warn', 'waiting ↻'], fence: ['accent', 'at the barrier'], '': ['', 'entry code'] }[st];  // turns the status into a chip colour and wording
          cp[p].chip.className = 'chip ' + cls; cp[p].chip.textContent = txt;  // applies the chip colour and wording
          cp[p].seen.innerHTML = st === 'in' || st === 'wait' ? `<b>Its test read:</b> ${SEEN[mode][p]}` : '<b>Its test:</b> not run yet';  // once the process has tested, shows what its test read; before that, "not run yet"
        });  // ends the panel update
        fr[2].forEach((v, k) => { cells[k].v.className = 'v' + (k < 2 ? (v ? ' tv T' : ' tv F') : ''); cells[k].v.textContent = String(v); });  // writes flag[0], flag[1] and turn into the memory boxes; the flags get true/false colouring
        const inside = [0, 1].filter((p) => fr[3 + p] === 'in');  // inside lists the processes that are in their critical section in this frame
        room.className = 'room' + (inside.length === 2 ? ' two' : inside.length ? ' one' : '');  // the critical-section box turns green with one inside and red with two
        room.innerHTML = `<div class="xs">Critical section</div><div class="row" style="justify-content:center;gap:6px">${inside.length ? inside.map(TOK).join('') : '<span class="small muted">empty</span>'}</div>`;  // writes the box's title and the badges of the processes inside, or "empty"
        return fr[5];  // gives the caption back to the player, which shows it
      },  // ends render()
    });  // closes the player settings
    const seg = ctx.ui.seg([{ value: 'order', label: 'In-order memory' }, { value: 'reorder', label: 'Store buffers' }, { value: 'fence', label: '+ barrier' }], mode, (v) => { mode = v; player.setCount(MODES[v].length); });  // three-way switch between the scenarios; picking one resets the player to frame 1 with the new frame count
    const code = ctx.ui.code(`${/* code: Peterson's entry code with the added barrier, shown on the left */''}
flag[i] = true;       // I want in${/* shown code, line 1: raise my flag */''}
turn = j;             // you may go first${/* shown code, line 2: give the turn to the other process */''}
memory_barrier();     // finish my writes before I read${/* shown code, line 3: the memory barrier, which pushes my writes out to memory before any later read */''}
while (flag[j] && turn == j)   // now it is safe to look${/* shown code, line 4: only now look at the other process's flag and the turn */''}
    ;                 //   busy wait${/* shown code, line 5: the empty loop body, which is the busy wait */''}
/* critical section */`, { lang: 'c', fontSize: 13.5 });  // shown code, line 6: the critical section; then the options for the code block
    const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column: explanation, code and callouts
      h('p', { class: 'small m0', html: 'Every algorithm here assumes each process’s reads and writes reach memory <b>in program order</b>. Real hardware breaks that promise for speed: rather than stall until a write reaches memory, a CPU parks it in a <b>store buffer</b> and lets later reads run ahead. Compilers may also reorder or cache reads and writes.' }),  // paragraph: why real hardware and compilers break the in-order promise (store buffers let reads run ahead of writes)
      code,  // places the code listing
      h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Trusting code because it passed every test. Hardware reordering bites only when two CPUs race on the same variables, and even then only with unlucky timing, so tests rarely catch it.' }),  // callout: the mistake of trusting code because it passed tests; reordering bugs show up only with unlucky timing
      h('div', { class: 'callout tip small m0', 'data-label': 'The fix', html: 'Put a <span class="t">memory barrier</span> (fence) between the writes and the test, or use atomic variables that include one. Once special instructions are needed anyway, the simpler hardware-supported locks of Section 5.3 are the natural choice.' }));  // callout: the fix is a memory barrier (or atomic variables), and hardware locks come next
    const right = h('div', { class: 'stack', style: { gap: '10px' } }, seg,  // right column: the scenario switch at the top
      h('div', { class: 'grid-3 labgrid' }, cp[0].el, h('div', { class: 'stack gap-s' }, h('h4', { class: 'm0 center' }, 'Shared memory'), ...cells.map((c) => c.el), room), cp[1].el),  // three columns: P0's panel, shared memory with the critical-section box, and P1's panel
      player.el);  // the animation player under the panels
    panel.append(h('div', { class: 'split fill' }, left, right));  // places the two columns side by side in the tab's panel
  }  // ends orderTab()

  Guide.section({  // registers section 5.1 with the guide, which builds its pages, glossary, notes and quiz from this description
    id: '5.1',  // section number, used for page addresses and cross-references
    title: 'Mutual Exclusion: Software Approaches',  // full title shown at the top of every step
    short: 'Software approaches',  // short title for the contents list
    summary: 'Taking turns with plain reads and writes: four flawed attempts, Dekker’s fix, and Peterson’s algorithm.',  // one-line summary shown on the chapter page
    objectives: [  // learning objectives listed for the student
      'Describe the setting for software-only mutual exclusion: two processes, shared variables, a memory arbiter, and no special hardware or OS help.',  // objective 1: describe the setting of software-only mutual exclusion
      'Trace each of the four flawed attempts and find the interleaving that breaks it: strict alternation, violated mutual exclusion, deadlock, livelock.',  // objective 2: trace the four flawed attempts and find what breaks each
      'Explain how Dekker’s algorithm uses a turn variable to settle ties, and why it is correct.',  // objective 3: explain how Dekker's turn variable settles ties
      'Explain why Peterson’s algorithm guarantees mutual exclusion with no deadlock and no starvation, and how its idea extends to n processes.',  // objective 4: explain why Peterson's algorithm is correct and how it extends to n processes
      'Estimate the cost of busy waiting, and explain why these algorithms break on hardware that reorders memory operations unless a memory barrier is added.',  // objective 5: estimate the cost of busy waiting and explain the memory-reordering problem
    ],  // ends the objectives
    terms: [  // glossary terms for this section; dotted words on the page show these definitions when clicked or hovered
      ['Critical section', 'A stretch of code in which a process uses a shared resource, such as shared variables, that must not be used by another process at the same moment.'],  // glossary entry: defines critical section
      ['Mutual exclusion', 'The guarantee that while one process is inside its critical section, no other process is inside its critical section for the same shared resource.'],  // glossary entry: defines mutual exclusion
      ['Entry protocol', 'The code a process runs just before its critical section to get permission to go in.'],  // glossary entry: defines entry protocol
      ['Exit protocol', 'The code a process runs just after its critical section to announce that it has left, so another process may enter.'],  // glossary entry: defines exit protocol
      ['Remainder section', 'Everything else a process does: code that does not touch the shared resource and needs no permission.'],  // glossary entry: defines remainder section
      ['Memory arbiter', 'Hardware that lets only one access touch a given memory location at a time, so two reads or writes of the same word happen one after the other, never blended together.'],  // glossary entry: defines memory arbiter
      ['Atomic', 'Describes an operation that happens as one indivisible step: no other process can see it half-done or slip in between its parts.'],  // glossary entry: defines atomic
      ['Interleaving', 'Running several processes on one processor by switching between them, so their individual steps take turns. Each possible order of those steps is called an interleaving, and a correct solution must work for every one.'],  // glossary entry: defines interleaving
      ['Race condition', 'A bug in which the result depends on the exact timing or order in which processes access shared data.'],  // glossary entry: defines race condition
      ['Busy waiting', 'Waiting by testing a condition over and over in a loop. The waiting process keeps using the CPU while doing no useful work. Also called spinning.'],  // glossary entry: defines busy waiting (spinning)
      ['Turn variable', 'A shared variable that holds the number of the process that has priority, that is, whose turn it is.'],  // glossary entry: defines turn variable
      ['Flag variable', 'A shared true/false variable that a process sets to announce that it wants to enter (or is inside) its critical section.'],  // glossary entry: defines flag variable
      ['Strict alternation', 'A rule that forces processes into their critical sections in a fixed order, P0, P1, P0, P1, and so on, even when one of them does not need to go in.'],  // glossary entry: defines strict alternation
      ['Deadlock', 'A situation in which each process in a group waits for something that only another waiting process can do, so none of them can ever continue.'],  // glossary entry: defines deadlock
      ['Livelock', 'A situation in which processes keep running and reacting to each other, yet none makes progress. Unlike deadlock, a change in their relative timing can end it.'],  // glossary entry: defines livelock and how it differs from deadlock
      ['Starvation', 'A situation in which a process that wants to enter waits indefinitely because others are always allowed to go ahead of it.'],  // glossary entry: defines starvation
      ['Dekker’s algorithm', 'The first known correct software-only solution to mutual exclusion for two processes. It combines one flag per process with a turn variable that decides who backs off when both want in.'],  // glossary entry: defines Dekker's algorithm
      ['Peterson’s algorithm', 'A shorter correct two-process solution: each process raises its flag, then gives the turn to the other, and waits only while the other wants in and holds the turn.'],  // glossary entry: defines Peterson's algorithm
      ['Filter algorithm', 'Peterson’s idea extended to n processes. Each process climbs n − 1 waiting levels; at each level the latest arrival waits while any other process is at that level or higher, so at most one process gets past the top level.'],  // glossary entry: defines the filter algorithm (Peterson for n processes)
      ['Memory barrier', 'An instruction that makes a processor finish all of its earlier memory reads and writes, so other processors can see them, before it performs any later one. Also called a fence.'],  // glossary entry: defines memory barrier (fence)
    ],  // ends the glossary terms
    css: ` /* styles used only by this section; every rule starts with .sec-5-1 so it cannot affect other sections */
      .sec-5-1 .step-eyebrow, .sec-5-1 pre.code { contain: inline-size; } /* step headings and code blocks take their width from the page, so a long code line cannot stretch the layout */
      .sec-5-1 .tscroll { overflow-x: auto; contain: inline-size; } /* wrappers around wide tables scroll sideways instead of pushing the page wider */
      .sec-5-1 .hot { cursor: pointer; } /* clickable parts of the big-picture diagram show a pointing-hand cursor */
      .sec-5-1 .hot:hover rect, .sec-5-1 .hot.sel rect { stroke-width: 3.5; } /* a clickable diagram part gets a thicker outline when the mouse is over it or it is selected */
      .sec-5-1 .hot.sel rect.hbox { stroke: var(--chc); } /* the selected part's outline switches to the highlight colour */
      .sec-5-1 .tok { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 26px; padding: 0 8px; border-radius: 999px; border: 2px solid; font-weight: 800; font-size: 14px; line-height: 1; } /* the round P0/P1 badge: centered bold text in a pill-shaped outline */
      .sec-5-1 .tok.p0 { color: var(--proc); background: var(--proc-bg); border-color: var(--proc); } /* P0's badge uses the process colour */
      .sec-5-1 .tok.p1 { color: var(--accent); background: var(--accent-bg); border-color: var(--accent); } /* P1's badge uses the accent colour */
      .sec-5-1 .c0 { color: var(--proc); } /* text coloured for P0 */
      .sec-5-1 .c1 { color: var(--accent); } /* text coloured for P1 */
      .sec-5-1 .c2 { color: var(--thread); } /* text coloured for P2 (used by the three-process filter tab) */
      .sec-5-1 .sbuf { display: flex; flex-direction: column; gap: 4px; min-height: 58px; border: 2px dashed var(--line-2); border-radius: 8px; padding: 4px; justify-content: center; align-items: center; } /* a store-buffer box: a dashed frame that stacks waiting writes vertically and keeps its height when empty */
      .sec-5-1 .sbuf code { font-size: 13px; background: var(--warn-bg); color: var(--ink); } /* each write inside a store buffer gets a pale amber background, like a note waiting to be delivered */
      .sec-5-1 .log > div.spin { color: var(--muted); } /* spin lines in the step log are greyed, since they changed nothing */
      .sec-5-1 .log > div.bad { color: var(--bad); font-weight: 700; } /* halt lines in the step log are red and bold */
      .sec-5-1 .log code { background: none; padding: 0; } /* code inside the step log has no background box, to keep lines compact */
      .sec-5-1 .cell { border: 2px solid var(--mem); background: var(--mem-bg); border-radius: 10px; padding: 3px 8px; text-align: center; min-width: 0; } /* a memory box: memory-coloured border and background, rounded, text centered */
      .sec-5-1 .cell .nm { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--ink-2); } /* the variable name in a memory box: small monospaced bold text */
      .sec-5-1 .cell .v { font-family: var(--mono); font-size: 20px; font-weight: 800; line-height: 1.25; } /* the value in a memory box: large monospaced bold text */
      .sec-5-1 .cell.off { opacity: .38; border-style: dashed; } /* an unused memory box is faded with a dashed border */
      .sec-5-1 .cell.off .v { font-size: 13px; font-weight: 600; line-height: 26px; } /* the "not used" text in an unused box is smaller and keeps the same height as a real value */
      .sec-5-1 .cells { display: flex; gap: 8px; } /* a row of memory boxes with small gaps */
      .sec-5-1 .cells > .cell { flex: 1; } /* each box in the row takes an equal share of the width */
      .sec-5-1 .cells.fcells { flex-wrap: wrap; } /* the filter tab's five memory boxes may wrap onto a second line when space is short */
      .sec-5-1 .cells.fcells > .cell { flex: 1 1 90px; } /* each of those boxes is at least about 90 px wide and grows to share the row */
      .sec-5-1 .room { border: 2px dashed var(--line-2); border-radius: 12px; padding: 6px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 76px; } /* the "Critical section" box: dashed rounded frame, contents centered in a column, fixed minimum height so it never jumps */
      .sec-5-1 .room .xs { font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); } /* its title is small, bold, spaced-out capitals in grey */
      .sec-5-1 .room.one { border-style: solid; border-color: var(--ok); background: var(--ok-bg); } /* with one process inside, the frame turns solid green */
      .sec-5-1 .room.two { border-style: solid; border-color: var(--bad); background: var(--bad-bg); } /* with two processes inside, the frame turns solid red: mutual exclusion is broken */
      .sec-5-1 .ppanel { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; } /* a process panel stacks its header, code and Next box in a column */
      .sec-5-1 .ppanel.p0 { border-top: 4px solid var(--proc); } /* P0's panel has a thick top border in the process colour */
      .sec-5-1 .ppanel.p1 { border-top: 4px solid var(--accent); } /* P1's panel has a thick top border in the accent colour */
      .sec-5-1 .ppanel.halted pre.code { opacity: .5; } /* a halted process's code is faded to half strength */
      .sec-5-1 .pp-head { display: flex; align-items: center; gap: 6px; } /* the panel header lines up badge, chip and buttons in one row */
      .sec-5-1 .pp-next { font-size: 13.5px; line-height: 1.4; background: var(--panel-3); border-radius: 8px; padding: 5px 8px; min-height: 48px; } /* the Next box: a shaded rounded strip with a minimum height, so the panel does not jump as the text changes */
      .sec-5-1 .labgrid { grid-template-columns: minmax(0, 1fr) 146px minmax(0, 1fr); gap: 10px; } /* the lab's three columns: two flexible code panels with a 146 px shared-memory column between them */
      .sec-5-1 .verdict { border-radius: 12px; padding: 7px 12px; border: 1px solid var(--line); border-left: 5px solid var(--accent); background: var(--panel-2); font-size: 15px; line-height: 1.45; min-height: 76px; } /* the verdict bar: rounded, a thick coloured left edge, and a minimum height so the layout stays still */
      .sec-5-1 .verdict.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* an ok verdict is green */
      .sec-5-1 .verdict.info { border-left-color: var(--warn); } /* an info verdict (busy waiting) gets an amber edge only */
      .sec-5-1 .verdict.warn { border-left-color: var(--warn); background: var(--warn-bg); } /* a warning verdict (livelock, forced alternation) is amber */
      .sec-5-1 .verdict.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* a bad verdict (violation, deadlock, blocked) is red */
      .sec-5-1 .verdict .last { color: var(--ink-2); font-size: 14px; } /* the "last step" line at the top of the verdict is a little smaller and greyer */
      .sec-5-1 pre.code .ln.p0 { background: color-mix(in srgb, var(--proc) 15%, transparent); border-left-color: var(--proc); } /* in Dekker's walkthrough, the line P0 runs next is tinted in P0's colour */
      .sec-5-1 pre.code .ln.p1 { background: color-mix(in srgb, var(--accent) 15%, transparent); border-left-color: var(--accent); } /* and the line P1 runs next is tinted in P1's colour */
      .sec-5-1 pre.code .ln.p0::before { content: 'P0'; color: var(--proc); opacity: 1; font-weight: 800; } /* the line number of P0's next line is replaced by a bold "P0" label in the margin */
      .sec-5-1 pre.code .ln.p1::before { content: 'P1'; color: var(--accent); opacity: 1; font-weight: 800; } /* the line number of P1's next line is replaced by a bold "P1" label */
      .sec-5-1 pre.code .ln.p0.p1::before { content: 'both'; color: var(--ink); font-size: .78em; } /* when both processes are on the same line, the margin says "both" in smaller text */
      .sec-5-1 .tv { font-family: var(--mono); font-weight: 800; } /* true/false words are monospaced and bold */
      .sec-5-1 .tv.T { color: var(--ok); } /* true is green */
      .sec-5-1 .tv.F { color: var(--muted); } /* false is grey */
      .sec-5-1 table.trace td { padding-top: 2px; padding-bottom: 2px; font-size: 14px; line-height: 1.3; } /* rows of the replay tables in step 3 are compact so the whole trace fits */
      .sec-5-1 table.trace th { padding-top: 4px; padding-bottom: 4px; } /* the header cells of those tables are compact too */
      .sec-5-1 table.trace tr.cur td { background: var(--accent-bg); } /* the row that just ran is highlighted */
      .sec-5-1 table.trace tr.bad td { background: var(--bad-bg); } /* the row where things go wrong is red */
      .sec-5-1 table.trace tr.warn td { background: var(--warn-bg); } /* rows that repeat in the livelock replay are amber */
      .sec-5-1 table.trace tr.future td { opacity: .0; } /* rows not reached yet are invisible but keep their space, so the table does not grow during the replay */
      .sec-5-1 .slot { border: 2px dashed var(--line-2); border-radius: 10px; padding: 4px 6px; font-size: 13.5px; text-align: center; min-height: 52px; display: flex; flex-direction: column; justify-content: center; } /* a write slot in Peterson's scheduling game: a dashed box that is empty until a write fills it */
      .sec-5-1 .slot.p0 { border-style: solid; border-color: var(--proc); background: var(--proc-bg); } /* a slot filled by P0 gets a solid border and background in P0's colour */
      .sec-5-1 .slot.p1 { border-style: solid; border-color: var(--accent); background: var(--accent-bg); } /* a slot filled by P1 gets P1's colour */
      .sec-5-1 table.score td { padding: 3px 5px; vertical-align: middle; } /* scorecard cells: small padding, content centered vertically */
      .sec-5-1 table.score th { font-size: 13px; line-height: 1.25; vertical-align: bottom; text-transform: none; letter-spacing: 0; text-align: center; padding: 6px 4px; } /* scorecard column headings: small wrapped text aligned to the bottom and centered, without the usual capitals */
      .sec-5-1 table.score th:first-child { text-align: left; } /* the first heading, "Algorithm", is left-aligned */
      .sec-5-1 .sc-btn { width: 100%; height: 34px; border: 0; background: transparent; font-weight: 800; font-size: 18px; cursor: pointer; border-radius: 7px; color: var(--muted); } /* a scorecard cell button fills its cell and shows a large grey question mark until clicked */
      .sec-5-1 .sc-btn:hover { background: var(--panel-3); } /* a scorecard button gets a light background when the mouse is over it */
      .sec-5-1 .sc-btn.y { color: var(--ok); background: var(--ok-bg); } /* a revealed yes is a green check */
      .sec-5-1 .sc-btn.n { color: var(--bad); background: var(--bad-bg); } /* a revealed no is a red cross */
      .sec-5-1 .sc-btn.sel { outline: 3px solid var(--chc); outline-offset: -3px; } /* the selected cell gets an outline in the highlight colour */
      .sec-5-1 .chal-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px; } /* the challenge list is a grid of two equal columns */
      .sec-5-1 .chal { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 50px; text-align: left; border: 2px solid var(--line); background: var(--panel); border-radius: 10px; padding: 4px 8px; cursor: pointer; font-size: 14px; line-height: 1.25; color: var(--ink); } /* one challenge button: number and title in a row, rounded border, left-aligned text */
      .sec-5-1 .chal:hover { border-color: var(--chc); } /* hovering a challenge button colours its border */
      .sec-5-1 .chal.on { border-color: var(--chc); background: var(--panel-2); } /* the chosen challenge gets a coloured border and shaded background */
      .sec-5-1 .chal.done .n { background: var(--ok); color: var(--panel); } /* a solved challenge's number square turns green */
      .sec-5-1 .chal .n { flex: none; width: 24px; height: 24px; border-radius: 7px; background: var(--panel-3); display: grid; place-items: center; font-weight: 800; font-size: 13px; } /* the small square that holds a challenge's number (or its check mark once solved) */
    `,  // end of the CSS text
    steps: [  // the ordered list of steps (pages) in this section
      /* ---------------- 1. Big picture: the setting, with a clickable diagram ---------------- */
      {  // step 1: the big picture
        title: 'Two processes, one critical section, no locks',  // step title shown at the top of the page
        kind: 'story',  // kind "story": the opening explanation page of the section
        html: `${/* the page's fixed HTML, written directly as text */''}
          <div class="split l fill">${/* two columns: the rules on the left (the smaller column), the clickable diagram on the right */''}
            <div class="stack">${/* left column */''}
              <p class="lead m0">Two processes share memory. Each has a <span class="t">critical section</span>: code that touches the shared data and must never overlap with the other’s. Can they take turns using only ordinary reads and writes?</p>${/* opening paragraph: two processes, a critical section each, and the question of taking turns with plain reads and writes */''}
              <div class="callout tip small m0" style="padding:6px 12px"><b>New to this?</b> The chapter overview’s first steps explain race conditions and critical sections; Section 5.2 gives the full principles.</div>${/* pointer for newcomers to where race conditions and critical sections were introduced */''}
              <div class="card tight">${/* card listing the rules of the puzzle */''}
                <h4>The rules of this puzzle</h4>${/* heading of the rules card */''}
                <ul class="small m0">${/* the list of rules */''}
                  <li><b>✓</b> Processes <b>P0</b> and <b>P1</b> may read and write shared variables.</li>${/* rule: both processes may read and write shared variables */''}
                  <li><b>✓</b> A <span class="t">memory arbiter</span> lets only one access touch a memory location at a time.</li>${/* rule: the memory arbiter lets only one access touch a memory location at a time */''}
                  <li><b>✗</b> No special instructions (Section 5.3) and no OS help.</li>${/* rule: no special instructions and no OS help */''}
                  <li><b>✗</b> No speed assumptions: either process may pause after any step, for any time, so every possible <span class="t">interleaving</span> must work.</li>${/* rule: no speed assumptions, so every interleaving must work */''}
                </ul>${/* ends the list of rules */''}
              </div>${/* ends the rules card */''}
              <div class="callout analogy small m0" data-label="Analogy">Two roommates share a bathroom with no lock and never meet. They can only move magnets on the fridge door, one person at a time, and their rule must work however fast or slow each one is.</div>${/* analogy callout: two roommates share a bathroom with no lock and coordinate only with fridge magnets */''}
            </div>${/* ends the left column */''}
            <div class="stack">${/* right column */''}
              <div class="card white tight bp-fig"></div>${/* empty card that render() fills with the clickable diagram */''}
              <div class="card bp-cap" style="min-height:132px;font-size:16px;line-height:1.5"></div>${/* caption card under the diagram; it shows the explanation of the part the student clicks */''}
              <p class="small muted m0">Your mission: build a correct solution in five tries, find the fatal timing for each broken try yourself, then see why Peterson’s short version works.</p>${/* mission paragraph: what the student will do in this section */''}
            </div>${/* ends the right column */''}
          </div>`,  // ends the two-column layout and the page HTML
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 1; draws the diagram and wires up the clicks
          const { s } = ctx;  // s creates SVG drawing elements
          const cap = ctx.$('.bp-cap');  // cap is the caption card, found inside this step's page
          const INFO = {  // INFO: the explanation for each clickable part of the diagram
            p: '<b>A process (P0 or P1).</b> Each loops forever through four parts: an <span class="t">entry protocol</span> (ask for permission), its critical section, an <span class="t">exit protocol</span> (announce that it is done) and its <span class="t">remainder section</span> (everything else). Our job is to design the entry and exit protocols.',  // explanation for a process: the four parts of its loop, and that our job is the entry and exit protocols
            data: '<b>The shared data.</b> Say both processes update one bank balance. If their updates overlap, one can wipe out the other: a <span class="t">race condition</span>. So only one process may be in its critical section at a time. That rule is <span class="t">mutual exclusion</span>.',  // explanation for the shared data: overlapping updates cause a race condition, so we need mutual exclusion
            arb: '<b>The memory arbiter.</b> If P0 writes <code>turn = 1</code> at the same instant P1 writes <code>turn = 0</code>, one write lands first and the other second, in an order nobody can predict. The result is one of the two values, never a blend. Each single read or write is <span class="t">atomic</span>. We also assume each process’s reads and writes reach memory in the order its code lists them. That is all the hardware promises here.',  // explanation for the memory arbiter: two writes land one after another, never blended, so each access is atomic
            mem: '<b>Shared memory.</b> The only way P0 and P1 can coordinate: variables that both can read and write. We will use a <span class="t" data-t="Turn variable">turn variable</span> and one <span class="t" data-t="Flag variable">flag</span> per process.',  // explanation for shared memory: the only way to coordinate, with a turn variable and one flag per process
            os: '<b>No outside help.</b> The OS will not put a waiting process to sleep for us, and no special instruction can test and set a variable in one step. A process that must wait can only loop and re-check a variable: <span class="t">busy waiting</span>.',  // explanation for the bottom strip: no OS help and no special instructions, so waiting means busy waiting
          };  // closes INFO
          const groups = [];  // groups collects every clickable part so the selection outline can be moved between them
          const pick = (k, g) => { groups.forEach((x) => x.classList.toggle('sel', x === g)); cap.innerHTML = INFO[k]; };  // pick(k, g): marks part g as selected (and no other) and shows its explanation in the caption card
          const hot = (k, label, ...kids) => {  // hot(k, label, ...kids): wraps shapes in a clickable group that shows explanation k
            const g = s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // the group can be reached with Tab and is announced as a button with a name for screen readers
            g.addEventListener('click', () => pick(k, g));  // a mouse click selects this part
            g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(k, g); } });  // Enter or Space selects it too, for keyboard users; preventDefault stops Space from scrolling the page
            groups.push(g);  // adds the group to the list of clickable parts
            return g;  // hands back the finished group
          };  // ends hot()
          const T = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 14 }, o), t);  // T(x, y, t, o): makes a centered SVG text label of size 14, with optional extra attributes
          const proc = (x, n) => {  // proc(x, n): draws the box for process Pn at horizontal position x, with its four-part loop inside
            const parts = [['entry protocol', 's-panel'], ['critical section', 's-warn'], ['exit protocol', 's-panel'], ['remainder', 's-panel']];  // the four parts of the loop and their colours; the critical section is highlighted in amber
            return hot('p', 'Process P' + n,  // the whole process box is one clickable part that shows the "process" explanation
              s('rect', { x, y: 8, width: 170, height: 214, rx: 14, class: 's-proc hbox', 'stroke-width': 2 }),  // the outer rounded box of the process
              T(x + 85, 32, 'P' + n, { 'font-size': 18, 'font-weight': 800 }),  // the process name (P0 or P1) in large bold text at the top
              ...parts.map(([t, c], i) => s('g', {}, s('rect', { x: x + 26, y: 44 + i * 44, width: 132, height: 30, rx: 8, class: c, 'stroke-width': 1.5 }), T(x + 92, 64 + i * 44, t, { 'font-size': 13.5, 'font-weight': 600 }))),  // the four stacked boxes (entry protocol, critical section, exit protocol, remainder), each with its label
              ...[0, 1, 2].map((i) => s('line', { x1: x + 92, y1: 74 + i * 44, x2: x + 92, y2: 86 + i * 44, class: 's-line', 'stroke-width': 1.6, 'marker-end': 'url(#arr)' })),  // three short arrows leading from each part down to the next
              s('path', { d: `M${x + 26},${191} H${x + 14} V${59} H${x + 24}`, class: 's-line', 'stroke-width': 1.6, 'marker-end': 'url(#arr)' }));  // a bent arrow on the left that leads from the remainder back up to the entry protocol: the loop runs forever
          };  // ends proc()
          const svg = s('svg', { viewBox: '0 0 640 282', width: '100%', role: 'img', 'aria-label': 'Two processes share data and memory through a memory arbiter' },  // svg: the whole big-picture diagram, 640 by 282 units, described for screen readers
            proc(8, 0), proc(462, 1),  // the two process boxes, P0 on the left and P1 on the right
            s('line', { x1: 188, y1: 103, x2: 226, y2: 60, class: 's-muted', 'stroke-dasharray': '5 4' }),  // a dashed line from P0 up to the shared data
            s('line', { x1: 452, y1: 103, x2: 414, y2: 60, class: 's-muted', 'stroke-dasharray': '5 4' }),  // a dashed line from P1 up to the shared data
            hot('data', 'Shared data',  // the shared-data box, clickable
              s('rect', { x: 226, y: 12, width: 188, height: 66, rx: 12, class: 's-warn hbox', 'stroke-width': 2 }),  // its amber rounded box
              T(320, 38, 'Shared data', { 'font-weight': 800, 'font-size': 15 }), T(320, 60, 'one user at a time!', { class: 's-sub', 'font-size': 13.5 })),  // its title and the reminder "one user at a time!"
            s('line', { x1: 178, y1: 132, x2: 228, y2: 132, class: 's-line', 'marker-start': 'url(#arr)', 'marker-end': 'url(#arr)' }),  // a two-headed arrow between P0 and the memory arbiter: P0 reads and writes through it
            s('line', { x1: 462, y1: 132, x2: 412, y2: 132, class: 's-line', 'marker-start': 'url(#arr)', 'marker-end': 'url(#arr)' }),  // the same arrow between P1 and the memory arbiter
            T(203, 124, 'r/w', { class: 's-sub', 'font-size': 13 }), T(437, 124, 'r/w', { class: 's-sub', 'font-size': 13 }),  // small "r/w" (read/write) labels above both arrows
            hot('arb', 'Memory arbiter',  // the memory-arbiter box, clickable
              s('rect', { x: 232, y: 116, width: 176, height: 32, rx: 8, class: 's-panel hbox', 'stroke-width': 2 }),  // its rounded box
              T(320, 137, 'memory arbiter', { 'font-weight': 700 })),  // its label
            s('line', { x1: 320, y1: 148, x2: 320, y2: 164, class: 's-line', 'marker-end': 'url(#arr)' }),  // an arrow from the arbiter down to shared memory
            hot('mem', 'Shared memory',  // the shared-memory box, clickable
              s('rect', { x: 226, y: 166, width: 188, height: 58, rx: 12, class: 's-mem hbox', 'stroke-width': 2 }),  // its rounded box in the memory colour
              ...[['turn', 262], ['flag[0]', 320], ['flag[1]', 378]].map(([t, cx]) => s('g', {}, s('rect', { x: cx - 27, y: 180, width: 54, height: 30, rx: 6, class: 's-panel' }), T(cx, 200, t, { class: 's-monot', 'font-size': 13 })))),  // three small boxes inside it for the variables turn, flag[0] and flag[1]
            hot('os', 'No operating system help',  // the dashed strip at the bottom, clickable
              s('rect', { x: 8, y: 238, width: 624, height: 38, rx: 10, class: 's-muted hbox', 'stroke-dasharray': '6 5', 'pointer-events': 'all' }),  // its dashed outline; pointer-events "all" makes the empty inside clickable too, not just the outline
              T(320, 262, 'Operating system help, special instructions: not available', { class: 's-sub', 'font-weight': 600 })));  // its label: OS help and special instructions are not available
          ctx.$('.bp-fig').append(svg);  // puts the finished diagram into the empty card on the right
          cap.innerHTML = 'Click any part of the picture: a process, the shared data, the memory arbiter, shared memory, or the dashed strip at the bottom.';  // starting caption: tells the student which parts can be clicked
        },  // ends render() for step 1
      },  // ends step 1

      /* ---------------- 2. Attempt 1: a single turn variable ---------------- */
      {  // step 2: Attempt 1, a single turn variable
        title: 'Attempt 1: take turns with one shared variable',  // step title
        kind: 'explore',  // kind "explore": an interactive page to experiment with
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 2; builds the code, the timeline and its controls
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
          const code = ctx.ui.code(`${/* code: Attempt 1 as a numbered C listing */''}
int turn = 0;              // shared: who may go in${/* shown code, line 1: the shared variable turn, starting at 0 */''}
// code for process Pi (j is the other one)${/* shown code, line 2: a note that the code is written for process Pi, with j the other process */''}
while (true) {             // each process loops forever${/* shown code, line 3: each process repeats its loop forever */''}
    while (turn != i)      // not my turn yet?${/* shown code, line 4: the busy-wait test: is it my turn yet? */''}
        ;                  //   test again (busy wait)${/* shown code, line 5: the empty loop body, which is the busy wait */''}
    /* critical section */ // only turn's owner is here${/* shown code, line 6: the critical section, where only the process named by turn can be */''}
    turn = j;              // give the turn away${/* shown code, line 7: on the way out, give the turn to the other process */''}
    /* remainder */        // other work, any length${/* shown code, line 8: the remainder section, other work of any length */''}
}                          // ...then want in again`, { lang: 'c', fontSize: 13.5 });  // shown code, line 9: end of the loop; then the options for the code block
          const left = h('div', { class: 'stack' },  // left column: the idea, the code, the results chips and a common mistake
            h('p', { class: 'small m0', html: '<b>Idea:</b> one shared <span class="t" data-t="Turn variable">turn variable</span> names the process that may go in. Wait until it names you; on the way out, hand it to the other process. (Pi is process number i; j is the other number.)' }),  // idea paragraph: one shared turn variable names the process that may go in
            code,  // places the code listing
            h('div', { class: 'row', html: '<span class="chip ok">✓ mutual exclusion</span><span class="chip bad">✗ forced strict alternation</span><span class="chip bad">✗ a halted process can block the other</span>' }),  // chips summarising the result: mutual exclusion holds, but strict alternation and blocking by a halted process are problems
            h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Thinking a crash matters only inside the critical section. If P1 stops in its <span class="t">remainder section</span>, P0 gets one more visit, hands the turn to P1, and then waits forever.' }));  // callout: a halt in the remainder section still blocks the other process

          const T = 20, CW = 23, X0 = 64;  // the timeline covers T = 20 ticks, each column CW = 23 units wide, starting X0 = 64 units from the left
          let r1 = 5, halt = false;  // r1 is P1's remainder length in ticks (slider), halt says whether P1 stops for good after one visit
          const sim = () => {  // sim(): simulates Attempt 1 tick by tick and returns what each process did in each tick
            const R = [1, r1], ph = ['entry', 'entry'], left = [0, 0], row = [[], []], turns = [], e = [0, 0], sp = [0, 0], csAt = [[], []];  // remainder lengths (P0 always 1), phases, ticks of remainder left, per-tick rows, turn history, visits, spins, CS ticks
            let turn = 0;  // turn starts at 0, so P0 goes first
            for (let t = 0; t < T; t++) {  // runs the simulation for each of the 20 ticks
              turns.push(turn);  // records the value of turn at the start of this tick for the top row
              let nt = turn;  // nt is the value turn will have after this tick
              for (const p of [0, 1]) {  // lets both processes act in this tick
                if (ph[p] === 'halt') { row[p].push('halt'); continue; }  // a halted process just shows the halted mark from now on
                if (ph[p] === 'rem') { row[p].push('rem'); if (--left[p] === 0) ph[p] = 'entry'; continue; }  // a process in its remainder section counts down its ticks, and wants in again when they run out
                if (turn === p) {  // the process wants in, and turn names it
                  row[p].push('cs'); e[p]++; csAt[p].push(t); nt = 1 - p;  // it spends this tick in its critical section, counts the visit, and hands the turn to the other process
                  if (p === 1 && halt) ph[p] = 'halt'; else { ph[p] = 'rem'; left[p] = R[p]; }  // after the visit, P1 halts if that option is on; otherwise the process starts its remainder section
                } else { row[p].push('spin'); sp[p]++; }  // not its turn: it spins for this tick, and the spin is counted
              }  // ends the loop over processes
              turn = nt;  // the new value of turn takes effect for the next tick
            }  // ends the tick loop
            return { row, turns, e, sp, csAt };  // hands back the rows, turn history, visit counts, spin counts and visit times
          };  // ends sim()
          const svg = s('svg', { viewBox: `0 0 ${X0 + T * CW + 8} 150`, width: '100%', role: 'img', 'aria-label': 'Timeline of Attempt 1' });  // svg: the timeline drawing, wide enough for all 20 tick columns
          const cap = h('div', { class: 'card small', style: { minHeight: '104px' } });  // cap is the caption card under the timeline, kept at least 104 px tall
          const TX = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 13 }, o), t);  // TX(x, y, t, o): makes a centered SVG text label, with optional extra attributes
          function draw() {  // draw(): runs the simulation and redraws the timeline and caption; runs at start and on every slider or switch change
            const r = sim();  // r holds the simulation result
            const kids = [TX(10, 40, 'turn', { 'text-anchor': 'start', class: 's-monot', 'font-weight': 700 }),  // kids starts with the row labels: "turn" at the top...
              TX(10, 80, 'P0', { 'text-anchor': 'start', 'font-weight': 800, 'font-size': 16, style: 'fill:var(--proc)' }),  // ...then P0 in its colour...
              TX(10, 126, 'P1', { 'text-anchor': 'start', 'font-weight': 800, 'font-size': 16, style: 'fill:var(--accent)' })];  // ...then P1 in its colour
            for (let t = 0; t < T; t++) {  // draws one column per tick
              const x = X0 + t * CW;  // x is the left edge of this tick's column
              if (t % 5 === 0) kids.push(TX(x + CW / 2, 13, 't=' + t, { class: 's-sub' }));  // every fifth tick gets a "t=" label above the column
              kids.push(s('rect', { x: x + 1, y: 24, width: CW - 2, height: 22, rx: 4, class: 's-mem', 'stroke-width': 1 }), TX(x + CW / 2, 40, String(r.turns[t]), { class: 's-monot', 'font-weight': 700 }));  // a small memory-coloured box showing the value of turn at the start of this tick
              [0, 1].forEach((p) => {  // then one box per process for this tick
                const kind = r.row[p][t], y = 58 + p * 46;  // kind is what the process did in this tick; y is the top of its row
                const cls = { cs: 's-ok', spin: 's-warn', rem: 's-panel', halt: 's-bad' }[kind];  // picks the box colour: green for CS, amber for spinning, plain for remainder, red for halted
                kids.push(s('rect', { x: x + 1, y, width: CW - 2, height: 36, rx: 5, class: cls, 'stroke-width': 1.2 }));  // draws the box
                const g = { cs: 'CS', spin: '↻', halt: '✗' }[kind];  // picks the mark written in the box: "CS", a loop arrow for spinning, a cross for halted, none for remainder
                if (g) kids.push(TX(x + CW / 2, y + 23, g, { 'font-size': kind === 'cs' ? 13 : 14, 'font-weight': 800, 'letter-spacing': kind === 'cs' ? '-0.6' : null }));  // writes the mark; "CS" is squeezed a little so it fits the slim box
              });  // ends the loop over processes
            }  // ends the loop over ticks
            svg.replaceChildren(...kids);  // replaces the old timeline with the new shapes
            const alone = Math.floor(T / 2);  // alone: how many visits P0 could make on its own, one every other tick (10 of 20)
            if (halt) {  // the caption depends on the situation; first the halt case
              const lastP0 = r.csAt[0][r.csAt[0].length - 1];  // lastP0 is the tick of P0's final visit
              cap.innerHTML = `<b>P1 visited once (tick ${r.csAt[1][0]}), set turn = 0, then stopped for good in its remainder section.</b> That is outside its critical section, yet P0 got just one more visit (tick ${lastP0}), handed the turn to P1, and has spun ever since: <b>${r.sp[0]} of ${T} ticks</b> wasted, with no end. Only P1 could ever set turn back to 0.`;  // halt caption: P1 visited once and stopped in its remainder; P0 got one more visit, then spins forever
            } else if (!r.sp[0]) {  // next case: P0 never had to spin
              cap.innerHTML = `<b>Equal speeds:</b> each process is ready exactly when its turn arrives, so alternation costs nothing here. P0 entered ${r.e[0]} times and P1 ${r.e[1]} times, with no spinning by P0. Now drag the slider to make P1 slower.`;  // equal-speed caption: alternation costs nothing when both are ready on time; invites the student to slow P1 down
            } else {  // the remaining case: P0 had to spin
              cap.innerHTML = `<b>P0 entered ${r.e[0]} times and spun for ${r.sp[0]} of ${T} ticks.</b> Left alone it could enter ${alone} times (it needs only 1 tick of other work). Turns must strictly alternate, so the fast process is held to the slow one’s pace: P0 ${r.e[0]} visits, P1 ${r.e[1]}. This is <span class="t">strict alternation</span>.`;  // strict-alternation caption: P0's visits and spins compared with what it could do alone
            }  // ends the choice of caption
          }  // ends draw()
          const slider = ctx.ui.slider({ label: 'Set P1’s remainder length', min: 1, max: 8, value: r1, format: (v) => v + (v === 1 ? ' tick' : ' ticks'), onInput: (v) => { r1 = v; draw(); } });  // slider for P1's remainder length, 1 to 8 ticks; moving it reruns the simulation
          const seg = ctx.ui.seg([{ value: false, label: 'P1 keeps running' }, { value: true, label: 'P1 halts after one visit' }], false, (v) => { halt = v; draw(); });  // switch: P1 keeps running, or P1 halts after its first visit
          const legend = h('div', { class: 'row xs', style: { gap: '6px', marginTop: '4px' }, html: '<span class="chip ok">CS = in critical section</span><span class="chip warn">↻ spinning (busy wait)</span><span class="chip">remainder section</span><span class="chip bad">✗ halted</span><span class="chip mem">turn at the start of each tick</span>' });  // legend explaining the timeline's colours and marks
          const right = h('div', { class: 'stack' },  // right column: controls, timeline and caption
            h('div', { class: 'card tight stack gap-s' }, h('div', { class: 'small', html: 'Both processes want in at tick 0. P0 needs 1 tick of other work between visits. The slider sets how much P1 needs.' }), slider, seg),  // controls card: a short explanation of the setup, then the slider and the switch
            h('div', { class: 'card white tight' }, svg, legend),  // a white card holding the timeline and its legend
            cap);  // the caption card under it
          draw();  // draws the timeline once when the step opens
          el.append(h('div', { class: 'split fill' }, left, right));  // places the two columns side by side on the page
        },  // ends render() for step 2
      },  // ends step 2

      /* ---------------- 3. Attempts 2-4: flags, predict then replay ---------------- */
      {  // step 3: Attempts 2 to 4, each in its own tab: predict what goes wrong, then replay it
        title: 'Attempts 2 to 4: flags, and why the order matters',  // step title
        kind: 'predict',  // kind "predict": the student guesses first, then checks
        core: true,  // core: true keeps this step in the shorter core route through the guide
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 3; builds the three tabs
          const { h } = ctx;  // h builds HTML elements
          const T = true, F = false;  // short names for true and false, used in the replay rows
          const HEAD = 'boolean flag[2] = {false, false}; // shared: "Pk wants in"\n// code for process Pi (j is the other one)\n';  // HEAD: the first two lines shared by all three code listings (the flag array and the "process Pi" note)
          const CFG = [  // CFG: the settings of the three tabs, one per attempt
            {  // tab for Attempt 2
              label: 'Attempt 2: look, then flag',  // tab label
              idea: '<b>Idea:</b> give each process its own <span class="t" data-t="Flag variable">flag</span>. Wait while the other’s flag is up; then raise yours and go in. Now a process that is not interested never blocks anyone.',  // idea paragraph: one flag per process; wait while the other's flag is up, then raise yours
              code: HEAD + `while (flag[j])        // is the other one inside?${/* code: the shared first lines plus Attempt 2's body; shown code: wait while the other's flag is up */''}
    ;                  //   yes: test again (busy wait)${/* shown code: the empty loop body, the busy wait */''}
flag[i] = true;        // announce: I am going in${/* shown code: raise my flag and go in */''}
/* critical section */ // use the shared data${/* shown code: the critical section */''}
flag[i] = false;       // announce: I have left${/* shown code: lower my flag on the way out */''}
/* remainder */        // other work`,  // shown code: the remainder section, the last line of the listing
              q: 'Can P0 and P1 ever be inside their critical sections at the same time?',  // prediction question: can both processes be inside at the same time?
              choices: [  // the two answer buttons, each with its feedback
                { label: 'Yes, with unlucky timing', ok: true, fb: 'A process can be paused after its check but before its flag goes up. Replay it on the right.' },  // correct answer: yes, with unlucky timing
                { label: 'No, the check prevents it', ok: false, fb: 'The check and the flag-raise are two separate steps, and a process can be paused between them. Replay it on the right.' },  // wrong answer: the check does not prevent it, because checking and raising are separate steps
              ],  // ends the answer choices
              note: ['Upside', 'A process that halts in its remainder section leaves its flag down, so the other can still get in. Attempt 1 (one shared turn variable) could not survive that. (A halt <i>inside</i> a critical section blocks the other in every attempt; no software rule can fix that.)'],  // note shown after answering: a halt in the remainder section leaves the flag down and blocks no one
              chips: '<span class="chip bad">✗ mutual exclusion</span><span class="chip ok">✓ no deadlock</span><span class="chip ok">✓ a halt outside the CS blocks no one</span>',  // result chips: mutual exclusion fails, no deadlock, a halt outside the CS blocks no one
              rows: [[0, 'tests <code>flag[1]</code>: false, so it stops waiting', F, F], [1, 'tests <code>flag[0]</code>: false, so it stops waiting', F, F],  // replay rows (who runs, what happens, flag[0] and flag[1] afterwards): both test and see false...
                [0, 'sets <code>flag[0] = true</code>, enters its critical section', T, F], [1, 'sets <code>flag[1] = true</code>, enters its critical section', T, T, 'bad']],  // ...then both raise their flags and walk in; the last row is marked bad
              caps: ['<b>Start:</b> both flags are false and both processes want to enter. Suppose the scheduler switches after every single step.',  // captions for the replay, one per frame
                'P0 checks <code>flag[1]</code>. It is false, so P0 leaves its waiting loop. But P0 has <b>not raised its own flag yet</b>.',  // caption for frame 2: P0 passes its check but has not raised its flag yet
                'P1 runs next and checks <code>flag[0]</code>. Still false, so P1 also leaves its loop.',  // caption for frame 3: P1 also passes its check
                'P0 raises its flag and walks into its critical section.',  // caption for frame 4: P0 raises its flag and walks in
                '<b>Both are inside.</b> P1 raises its flag and walks in too. Each process looked before the other had announced itself: the gap between looking and flagging is fatal.'],  // caption for frame 5: P1 walks in too, both are inside; the gap between looking and flagging is fatal
            },  // ends the Attempt 2 tab
            {  // tab for Attempt 3
              label: 'Attempt 3: flag, then look',  // tab label
              idea: '<b>Idea:</b> close Attempt 2’s gap by swapping two lines. Raise your flag <i>first</i>, then wait while the other’s flag is up. Two contenders now always see each other.',  // idea paragraph: swap the two lines, raise your flag first, then look
              code: HEAD + `flag[i] = true;        // first announce: I want in${/* code: the shared first lines plus Attempt 3's body; shown code: raise my flag first */''}
while (flag[j])        // then look: do you want in?${/* shown code: then wait while the other's flag is up */''}
    ;                  //   yes: test again (busy wait)${/* shown code: the busy-wait loop body */''}
/* critical section */ // use the shared data${/* shown code: the critical section */''}
flag[i] = false;       // announce: I have left${/* shown code: lower my flag on the way out */''}
/* remainder */        // other work`,  // shown code: the remainder section, the last line of the listing
              q: 'Mutual exclusion now holds. But can both processes get stuck forever?',  // prediction question: can both processes get stuck forever?
              choices: [  // the two answer buttons
                { label: 'Yes, both can freeze', ok: true, fb: 'If both flags go up before either process looks, each waits for the other forever. Replay it on the right.' },  // correct answer: yes, both can freeze
                { label: 'No, one always gets in', ok: false, fb: 'If both flags go up before either process looks, each waits for the other forever. Replay it on the right.' },  // wrong answer: explains how both can freeze when both flags go up before either looks
              ],  // ends the answer choices
              note: ['Why it is safe', 'Suppose both got in. Each raised its flag <i>before</i> looking, so whichever looked second must have seen the other’s flag up, and waited. Contradiction: two can never be inside together.'],  // note shown after answering: why Attempt 3 is safe, argued by contradiction
              chips: '<span class="chip ok">✓ mutual exclusion</span><span class="chip bad">✗ deadlock possible</span><span class="chip ok">✓ no strict alternation</span>',  // result chips: mutual exclusion holds, deadlock possible, no strict alternation
              rows: [[0, 'sets <code>flag[0] = true</code>', T, F], [1, 'sets <code>flag[1] = true</code>', T, T],  // replay rows: both raise their flags...
                [0, 'tests <code>flag[1]</code>: true, so it keeps waiting', T, T], [1, 'tests <code>flag[0]</code>: true, so it keeps waiting', T, T],  // ...then both test and see the other's flag up...
                [0, 'tests <code>flag[1]</code>: still true…', T, T], [1, 'tests <code>flag[0]</code>: still true… forever', T, T, 'bad']],  // ...and keep waiting forever; the last row is marked bad
              caps: ['<b>Start:</b> both flags are false and both processes want to enter.',  // captions for the replay: frame 1 is the start
                'P0 announces first: it raises <code>flag[0]</code>.',  // caption for frame 2: P0 raises its flag
                'Before P0 can look, P1 raises <code>flag[1]</code>. Both flags are now up.',  // caption for frame 3: P1 raises its flag before P0 looks
                'P0 looks: P1’s flag is up, so P0 waits.',  // caption for frame 4: P0 looks and waits
                'P1 looks: P0’s flag is up, so P1 waits too.',  // caption for frame 5: P1 looks and waits too
                'P0 checks again. Nothing has changed, and nothing can: the only line that lowers a flag comes after the critical section.',  // caption for frame 6: nothing can change, since only the exit lowers a flag
                '<b><span class="t">Deadlock</span>.</b> Each waits for the other to lower its flag, and neither ever will. Safe (never two inside), but frozen forever.'],  // caption for frame 7: deadlock, safe but frozen forever
            },  // ends the Attempt 3 tab
            {  // tab for Attempt 4
              label: 'Attempt 4: flag, then back off',  // tab label
              idea: '<b>Idea:</b> avoid Attempt 3’s freeze with courtesy. If the other also wants in, lower your flag for a moment to let it go first, then ask again.',  // idea paragraph: if the other also wants in, lower your flag for a moment, then ask again
              code: HEAD + `flag[i] = true;            // I want in${/* code: the shared first lines plus Attempt 4's body; shown code: raise my flag */''}
while (flag[j]) {          // do you want in too?${/* shown code: the back-off loop, repeated while the other wants in */''}
    flag[i] = false;       //   be polite: step back${/* shown code: politely lower my flag */''}
    /* delay a moment */   //   give you a chance${/* shown code: wait a moment */''}
    flag[i] = true;        //   then ask again${/* shown code: raise my flag again */''}
}                          // re-check your flag${/* shown code: end of the back-off loop */''}
/* critical section */     // use the shared data${/* shown code: the critical section */''}
flag[i] = false;           // announce: I have left${/* shown code: lower my flag on the way out */''}
/* remainder */            // other work`,  // shown code: the remainder section, the last line of the listing
              q: 'When Attempt 4 goes wrong, are the two processes frozen and idle, as in a deadlock?',  // prediction question: are the processes frozen and idle when Attempt 4 fails?
              choices: [  // the two answer buttons
                { label: 'Yes, frozen like Attempt 3', ok: false, fb: 'They never stop: they keep lowering and raising their flags in step. Unlikely, but possible, and a correct algorithm must survive every interleaving.' },  // wrong answer: they never stop, they keep lowering and raising their flags
                { label: 'No, busy but getting nowhere', ok: true, fb: 'They keep backing off and retrying in step. Unlikely to last, but possible, and a correct algorithm must survive every interleaving.' },  // correct answer: busy but getting nowhere
              ],  // ends the answer choices
              chips: '<span class="chip ok">✓ mutual exclusion</span><span class="chip ok">✓ no deadlock</span><span class="chip bad">✗ livelock possible</span>',  // result chips: mutual exclusion holds, no deadlock, livelock possible
              echo: [1, 9],  // echo: at the end of the replay, rows 2 and 10 are marked amber because they leave the same state
              rows: [[0, 'sets <code>flag[0] = true</code>', T, F], [1, 'sets <code>flag[1] = true</code>', T, T],  // replay rows: both raise their flags...
                [0, 'tests <code>flag[1]</code>: true, so it backs off', T, T], [1, 'tests <code>flag[0]</code>: true, so it backs off', T, T],  // ...both test and start to back off...
                [0, 'sets <code>flag[0] = false</code> (steps back)', F, T], [1, 'sets <code>flag[1] = false</code> (steps back)', F, F],  // ...both lower their flags...
                [0, 'pauses for a moment', F, F], [1, 'pauses for a moment', F, F],  // ...both pause...
                [0, 'sets <code>flag[0] = true</code> (asks again)', T, F], [1, 'sets <code>flag[1] = true</code> (asks again)', T, T]],  // ...both raise their flags again, back where they started
              caps: ['<b>Start:</b> both flags are false and both processes want in. This time the scheduler keeps them in perfect step.',  // captions for the replay: frame 1 is the start, with the processes in perfect step
                'P0 raises its flag.', 'P1 raises its flag. Both want in, exactly the spot where Attempt 3 froze.',  // captions for frames 2 and 3: both raise their flags
                'P0 sees P1’s flag up and starts its polite back-off.', 'P1 sees P0’s flag up and does the same.',  // captions for frames 4 and 5: both see the other's flag and start backing off
                'P0 lowers its flag to let P1 go first…', '…and at the same moment P1 lowers its flag to let P0 go first.',  // captions for frames 6 and 7: both lower their flags at the same moment
                'P0 pauses politely.', 'P1 pauses politely too.', 'P0 raises its flag to ask again.',  // captions for frames 8 to 10: both pause, then P0 asks again
                'P1 raises its flag too. <b>Back to the state after step 2.</b> In this rhythm, steps 3–10 repeat forever: both stay busy, nobody gets in. That is <span class="t">livelock</span>, not deadlock: if either runs slightly ahead, it finds the other’s flag down and enters.'],  // caption for frame 11: P1 asks again, the state repeats forever: livelock, not deadlock
            },  // ends the Attempt 4 tab
          ];  // closes the CFG list
          const chosen = {};  // chosen remembers which answer was picked in each tab, so switching tabs and back keeps the result
          const build = (panel, c, ci) => {  // build(panel, c, ci): fills one tab with its idea, code, prediction question and (after answering) the replay
            const code = ctx.ui.code(c.code, { lang: 'c', fontSize: 13.5 });  // the attempt's code as a numbered C listing
            const fb = h('div', { class: 'small' });  // fb is the feedback line under the answer buttons
            const right = h('div', { class: 'stack fill' },  // right column: before an answer it holds only a placeholder card
              h('div', { class: 'card fill', style: { display: 'grid', placeItems: 'center', textAlign: 'center' }, html: '<div><div class="big muted">?</div><p class="muted m0">Make your prediction on the left.<br>Then replay the timing that decides it.</p></div>' }));  // placeholder: a large question mark asking the student to predict first
            const btns = c.choices.map((ch, k) => h('button', { class: 'btn sm', type: 'button', onclick: () => answer(k) }, ch.label));  // one button per answer choice
            const btnRow = h('div', { class: 'row' }, ...btns);  // the row that holds the answer buttons
            function answer(k) {  // answer(k): runs when an answer button is clicked (or on return to the tab); shows feedback and the replay
              chosen[ci] = k;  // remembers the answer for this tab
              const ch = c.choices[k];  // ch is the chosen answer
              fb.innerHTML = `<b style="color:var(--${ch.ok ? 'ok' : 'bad'})">${ch.ok ? 'Correct' : 'Not quite'}</b>: you said “${ch.label}”. ${ch.fb}`;  // feedback in green ("Correct") or red ("Not quite"), repeating the choice and explaining it
              btnRow.innerHTML = c.chips;  // replaces the answer buttons with the result chips, so the question cannot be answered twice
              const trs = c.rows.map((r, n) => h('tr', { html: `<td class="num">${n + 1}</td><td>${PN(r[0])}</td><td>${r[1]}</td><td class="center">${TV(r[2])}</td><td class="center">${TV(r[3])}</td>` }));  // builds one table row per replay step: step number, who runs, what happens, and both flag values
              const table = h('table', { class: 'tbl compact trace' }, h('thead', { html: '<tr><th>#</th><th>Runs</th><th>What happens</th><th>flag[0]</th><th>flag[1]</th></tr>' }), h('tbody', {}, ...trs));  // the replay table, with its header row
              const player = ctx.ui.player({  // player: animates the replay one row at a time
                count: c.rows.length + 1, interval: 1700,  // one frame per row plus the starting frame, moving every 1.7 seconds while playing
                render: (i) => {  // render(i): shows the first i rows of the table and returns caption i
                  trs.forEach((tr, n) => { tr.className = n >= i ? 'future' : n === i - 1 ? (c.rows[n][4] || 'cur') : ''; });  // hides rows not reached yet, highlights the newest row (or marks it bad), and leaves earlier rows plain
                  if (c.echo && i === c.rows.length) c.echo.forEach((n) => (trs[n].className = 'warn'));  // at the end of the Attempt 4 replay, the rows listed in echo are marked amber to show the repeat
                  return c.caps[i];  // gives the frame's caption to the player
                },  // ends render()
              });  // closes the player settings
              right.replaceChildren(...[h('div', { class: 'tscroll' }, table), player.el, c.note ? h('div', { class: 'callout why m0', 'data-label': c.note[0], html: c.note[1] }) : null].filter(Boolean));  // fills the right column: the table in a sideways-scrolling wrapper, the player, and the note if this attempt has one
            }  // ends answer()
            panel.append(h('div', { class: 'split fill' },  // lays out the tab in two columns
              h('div', { class: 'stack' }, h('p', { class: 'small m0', html: c.idea }), code,  // left: the idea, the code...
                h('div', { class: 'card tight stack gap-s' }, h('div', { class: 'b', html: 'Predict: ' + c.q }), btnRow, fb)),  // ...and the prediction card with the question, the answer buttons and the feedback line
              right));  // right: the placeholder, later the replay
            if (chosen[ci] !== undefined) answer(chosen[ci]);  // if this tab was already answered earlier, shows the answer and replay again right away
          };  // ends build()
          el.append(ctx.ui.tabs(CFG.map((c, ci) => ({ label: c.label, render: (panel) => build(panel, c, ci) }))));  // builds three tabs (Attempt 2, 3, 4); each tab builds its page only when it is opened
        },  // ends render() for step 3
      },  // ends step 3

      /* ---------------- 4. Dekker's algorithm: walk through a tie ---------------- */
      {  // step 4: Dekker's algorithm, walked through a tie
        title: 'Dekker’s algorithm: flags plus a tiebreaker',  // step title
        kind: 'learn',  // kind "learn": a guided explanation
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 4; builds the code, memory boxes and animation
          const { h } = ctx;  // h builds HTML elements
          const code = ctx.ui.code(`${/* code: Dekker's algorithm as a numbered C listing */''}
boolean flag[2] = {false, false}; // who wants in${/* shown code, line 1: one flag per process, both false at the start */''}
int turn = 1;                     // who wins a tie${/* shown code, line 2: turn starts at 1, so P1 wins the first tie */''}
// code for process Pi (j is the other one)${/* shown code, line 3: a note that the code is written for process Pi, with j the other one */''}
flag[i] = true;              // I want in${/* shown code, line 4: raise my flag */''}
while (flag[j]) {            // do you want in too?${/* shown code, line 5: the outer loop, repeated while the other also wants in */''}
    if (turn == j) {         //   and the tie is yours?${/* shown code, line 6: check whether the tie belongs to the other process */''}
        flag[i] = false;     //     then I step back${/* shown code, line 7: if so, lower my flag */''}
        while (turn == j)    //     and wait for the turn${/* shown code, line 8: wait until the turn comes back to me */''}
            ;                //       (busy wait)${/* shown code, line 9: the empty loop body, a busy wait */''}
        flag[i] = true;      //     then I ask again${/* shown code, line 10: raise my flag again */''}
    }                        //   (tie is mine: keep checking)${/* shown code, line 11: end of the tie check; if the tie is mine, keep checking the flag */''}
}                            // leave once your flag is down${/* shown code, line 12: end of the outer loop, left once the other's flag is down */''}
/* critical section */       // only one of us is here${/* shown code, line 13: the critical section */''}
turn = j;                    // the next tie is yours${/* shown code, line 14: on the way out, give the next tie to the other process */''}
flag[i] = false;             // I no longer want in${/* shown code, line 15: lower my flag */''}
/* remainder section */      // other work, then repeat`, { lang: 'c', fontSize: 13 });  // shown code, line 16: the remainder section; then the options for the code block
          const left = h('div', { class: 'stack' },  // left column: the idea, the code and a common mistake
            h('p', { class: 'small m0', html: '<b>Idea:</b> keep Attempt 3’s flags (they make it safe) and add a <span class="t" data-t="Turn variable">turn variable</span> as a tiebreaker. When both flags are up, only the process <i>without</i> the turn backs off, and it waits for the turn instead of retrying blindly.' }),  // idea paragraph: keep Attempt 3's flags and add a turn variable as a tiebreaker
            code,  // places the code listing
            h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Reading <code>turn</code> as “who is inside”. It only matters when <i>both</i> flags are up. If the other process is not interested, you walk straight in, whatever <code>turn</code> says.' }));  // callout: turn does not mean "who is inside"; it only matters when both flags are up
          const ST = { 4: 'about to raise its flag', 5: 'checking the other’s flag', 6: 'checking whose tie it is', 7: 'about to step back', 8: 'waiting for the turn', 10: 'about to ask again', 13: 'in its critical section', 14: 'leaving: hands over the tie', 15: 'leaving: lowers its flag', 16: 'in its remainder section' };  // ST: a short description of what a process does on each code line, keyed by line number
          const T = true, F = false;  // short names for true and false
          // [line P0 runs next, line P1 runs next, flag0, flag1, turn, caption]
          const FR = [  // FR: the frames of the walkthrough, one per step
            [4, 4, F, F, 1, '<b>Start:</b> both processes want in at once. <code>turn</code> is 1, so if they tie, P1 wins and P0 must back off.'],  // frame 1: both want in; turn is 1, so P1 wins a tie
            [5, 4, T, F, 1, 'P0 raises <code>flag[0]</code>.'],  // frame 2: P0 raises its flag
            [5, 5, T, T, 1, 'P1 raises <code>flag[1]</code>. Both flags are up: exactly where Attempt 3 deadlocked. Now the tiebreaker takes over.'],  // frame 3: P1 raises its flag; both are up, where Attempt 3 deadlocked
            [6, 5, T, T, 1, 'P0 sees <code>flag[1]</code> is up, so it enters the loop to settle the tie.'],  // frame 4: P0 sees P1's flag and enters the loop to settle the tie
            [6, 6, T, T, 1, 'P1 sees <code>flag[0]</code> is up and does the same.'],  // frame 5: P1 does the same
            [7, 6, T, T, 1, 'P0 checks <code>turn == 1</code>: true. The tie belongs to P1, so P0 must be the one to yield.'],  // frame 6: P0 finds the tie belongs to P1, so P0 must yield
            [7, 5, T, T, 1, 'P1 checks <code>turn == 0</code>: false. The tie is its own, so P1 does not back off; it goes back to watching <code>flag[0]</code>.'],  // frame 7: P1 finds the tie is its own, so it goes back to watching P0's flag
            [8, 5, F, T, 1, 'P0 lowers its flag. Only one process backs off, so they cannot mirror each other forever as in Attempt 4.'],  // frame 8: P0 lowers its flag; only one process backs off
            [8, 13, F, T, 1, 'P1 sees <code>flag[0]</code> down, leaves the loop and enters its critical section.'],  // frame 9: P1 sees P0's flag down and enters its critical section
            [8, 13, F, T, 1, 'P0 is <span class="t">busy waiting</span>: <code>turn</code> is still 1, so it tests again.'],  // frame 10: P0 busy-waits because turn is still 1
            [8, 14, F, T, 1, 'P1 finishes its critical section.'],  // frame 11: P1 finishes its critical section
            [8, 15, F, T, 0, 'P1 sets <code>turn = 0</code>: the next tie goes to P0.'],  // frame 12: P1 sets turn = 0, giving the next tie to P0
            [8, 16, F, F, 0, 'P1 lowers its flag and goes off to its remainder section.'],  // frame 13: P1 lowers its flag and goes to its remainder section
            [10, 16, F, F, 0, 'P0’s wait ends: <code>turn</code> is now 0.'],  // frame 14: P0's wait ends because turn is now 0
            [5, 16, T, F, 0, 'P0 raises its flag again and goes back to check <code>flag[1]</code>.'],  // frame 15: P0 raises its flag again and re-checks P1's flag
            [13, 16, T, F, 0, '<b>P0 sees <code>flag[1]</code> down and enters.</b> Both got in, one at a time, and the one that backed off was handed the next tie: nobody starves.'],  // frame 16: P0 enters; both got in one at a time, and nobody starves
          ];  // closes the frame list
          const cellH = (nm) => h('div', { class: 'cell' }, h('div', { class: 'nm' }, nm), h('div', { class: 'v' }));  // cellH(nm): builds one memory box with a name and an empty value
          const cells = [cellH('flag[0]'), cellH('flag[1]'), cellH('turn')];  // the three memory boxes: flag[0], flag[1] and turn
          const pc = [0, 1].map((p) => h('div', { class: 'card tight', style: { flex: '1' } }));  // one card per process, showing the line it runs next and what that line does
          const room = h('div', { class: 'room', style: { flex: '1' } });  // the "Critical section" box between the two cards, stretched to fill the space
          let prev = null;  // prev holds the values shown in the previous frame, so changed boxes can flash
          const player = ctx.ui.player({  // player: animates the walkthrough
            count: FR.length, interval: 1900,  // one frame per entry in FR, moving every 1.9 seconds while playing
            render: (i) => {  // render(i): draws frame i of the Dekker walkthrough and returns its caption
              const [l0, l1, f0, f1, t, cap] = FR[i];  // unpacks the frame: next line of P0 and of P1, both flags, turn, and the caption
              [f0, f1, t].forEach((v, k) => {  // updates the three memory boxes
                const vEl = cells[k].lastChild;  // vEl is the value part of this box
                const txt = typeof v === 'boolean' ? String(v) : String(v);  // the value as text
                vEl.className = 'v' + (typeof v === 'boolean' ? (v ? ' tv T' : ' tv F') : '');  // flags get the green/grey true/false colouring; turn stays plain
                if (prev && prev[k] !== txt) { cells[k].classList.remove('flash'); void cells[k].offsetWidth; cells[k].classList.add('flash'); }  // if the value differs from the previous frame, restarts the box's flash animation
                vEl.textContent = txt;  // writes the value
              });  // ends the memory-box update
              prev = [String(f0), String(f1), String(t)];  // remembers this frame's values for the next comparison
              for (let n = 1; n <= 16; n++) code.line(n).classList.remove('p0', 'p1');  // removes the old P0/P1 margin marks from all 16 code lines
              code.line(l0).classList.add('p0');  // marks the line P0 runs next (tinted, with "P0" in the margin)
              code.line(l1).classList.add('p1');  // marks the line P1 runs next
              [l0, l1].forEach((l, p) => { pc[p].innerHTML = `<div class="row" style="gap:6px">${TOK(p)}<span class="small b">next: line ${l}</span></div><div class="small">${ST[l]}</div>`; });  // fills each process card with its badge, "next: line N" and the plain description of that line
              const inside = [l0, l1].map((l, p) => (l === 13 ? p : -1)).filter((p) => p >= 0);  // inside lists the processes whose next line is 13, the critical section
              room.className = 'room' + (inside.length ? ' one' : '');  // the critical-section box turns green when someone is inside
              room.style.flex = '1';  // keeps the box stretched to fill the space between the two cards (repeats the setting made when it was created)
              room.innerHTML = `<div class="xs">Critical section</div><div>${inside.length ? inside.map(TOK).join('') : '<span class="small muted">empty</span>'}</div>`;  // writes the box's title and the badge of the process inside, or "empty"
              return cap;  // gives the caption to the player
            },  // ends render()
          });  // closes the player settings
          const right = h('div', { class: 'stack' },  // right column of step 4
            h('div', { class: 'cells' }, ...cells),  // the row of three memory boxes
            h('div', { class: 'row nw', style: { alignItems: 'stretch' } }, pc[0], room, pc[1]),  // a row with P0's card, the critical-section box and P1's card, all the same height
            player.el,  // the animation player
            h('div', { class: 'callout why small m0', 'data-label': 'Why it works', html: '<b>Safe:</b> as in Attempt 3, a process enters only after raising its flag and then seeing the other’s flag down. Both flags up? <code>turn</code> is 0 or 1, never both, so exactly one process backs off: no <span class="t">deadlock</span>. The one backing off waits for the turn instead of retrying, so no <span class="t">livelock</span>. Every exit hands the next tie to the other, so no <span class="t">starvation</span>.' }),  // callout: why Dekker is safe and free of deadlock, livelock and starvation
            h('p', { class: 'xs muted m0', html: 'Gutter marks <b class="c0">P0</b> and <b class="c1">P1</b> show the line each process runs next. <span class="t">Dekker’s algorithm</span>, by the Dutch mathematician T. J. Dekker, was published by Edsger Dijkstra in the 1960s: the first known correct software-only solution.' }));  // small note: what the margin marks mean, and where the algorithm comes from
          el.append(h('div', { class: 'split fill' }, left, right));  // places the two columns side by side on the page
        },  // ends render() for step 4
      },  // ends step 4

      /* ---------------- 5. Peterson's algorithm: the later writer of turn waits ---------------- */
      {  // step 5: Peterson's algorithm, where the student schedules the four entry writes
        title: 'Peterson’s algorithm: whoever writes turn last waits',  // step title
        kind: 'explore',  // kind "explore": an interactive page to experiment with
        core: true,  // core: true keeps this step in the shorter core route
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 5; builds the code and the write-scheduling game
          const { h } = ctx;  // h builds HTML elements
          const code = ctx.ui.code(`${/* code: Peterson's algorithm as a numbered C listing */''}
boolean flag[2] = {false, false}; // who wants in${/* shown code, line 1: one flag per process, both false at the start */''}
int turn = 0;                     // who waits in a tie${/* shown code, line 2: turn starts at 0 */''}
// code for process Pi (j is the other one)${/* shown code, line 3: a note that the code is written for process Pi, with j the other one */''}
flag[i] = true;              // I want in...${/* shown code, line 4: raise my flag */''}
turn = j;                    // ...but you may go first${/* shown code, line 5: give the turn to the other process */''}
while (flag[j] && turn == j) // wait while you want in${/* shown code, line 6: wait while the other wants in and the turn is the other's */''}
    ;                        //   AND the turn is yours${/* shown code, line 7: the empty loop body, a busy wait */''}
/* critical section */       // at most one of us here${/* shown code, line 8: the critical section */''}
flag[i] = false;             // I am out: your go${/* shown code, line 9: lower my flag on the way out */''}
/* remainder section */      // other work, then repeat`, { lang: 'c', fontSize: 13.5 });  // shown code, line 10: the remainder section; then the options for the code block
          const left = h('div', { class: 'stack' },  // left column: the idea, the code and why it works
            h('p', { class: 'small m0', html: '<b>Idea:</b> <span class="t">Peterson’s algorithm</span> (1981) does the job of <span class="t">Dekker’s algorithm</span> (the first known correct software solution: flags plus a tiebreaking turn) in three lines. Raise your flag, then politely <i>give the turn away</i>, then wait only while the other wants in <i>and</i> holds the turn.' }),  // idea paragraph: Peterson's algorithm does Dekker's job in three lines
            code,  // places the code listing
            h('div', { class: 'callout why small m0', 'data-label': 'Why it works', html: '<b>Safe:</b> if both want in, the later writer of <code>turn</code> waits (schedule all six write orders yourself). <b>No deadlock:</b> both waiting would need <code>turn == 1</code> and <code>turn == 0</code> at once. <b>No starvation:</b> the winner lowers its flag on the way out, so the waiter goes in next; if the winner rushes back, it sets <code>turn</code> to the waiter’s number and waits itself. Nobody waits more than one turn.' }),  // callout: why Peterson is safe, free of deadlock and free of starvation
            h('p', { class: 'xs muted m0', html: 'Peterson’s idea also scales up to <i>n</i> processes (the <span class="t">filter algorithm</span>); you will operate it in the fine-print step near the end.' }));  // small note: the idea scales to n processes, shown later in the "Going deeper" step

          let seq = [];  // seq is the order of writes chosen so far, as a list of process numbers (0 or 1)
          const tried = new Set();  // tried remembers every complete four-write order the student has finished
          const ALL = ['0011', '0101', '0110', '1001', '1010', '1100'];  // ALL: the six possible orders of the four writes (each process writes its flag before turn)
          const W = (p, k) => (k === 0 ? `flag[${p}] = true` : `turn = ${1 - p}`);  // W(p, k): the text of process p's k-th write: first "flag[p] = true", then "turn = " the other's number
          const bt = [0, 1].map((p) => h('button', { class: 'btn sm', type: 'button', onclick: () => write(p) }));  // two buttons, one per process, that make that process's next write
          const again = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { seq = []; paint(); } }, 'Start over');  // Start over button: clears the chosen writes
          const slots = h('div', { class: 'grid-4', style: { gap: '8px' } });  // slots is the row of four write slots
          const cellsEl = h('div', { class: 'cells' });  // cellsEl shows the current values of flag[0], flag[1] and turn
          const res = h('div', { class: 'card', style: { minHeight: '150px' } });  // res is the card that explains the outcome once all four writes are made
          const triedEl = h('div', { class: 'small' });  // triedEl lists the six orders and marks the ones already tried
          const stateOf = () => {  // stateOf(): replays the chosen writes from the start to work out the current values
            const f = [false, false], cnt = [0, 0];  // f holds both flags (false at first); cnt counts how many writes each process has made
            let turn = 0, last = null;  // turn starts at 0; last will be the process that wrote turn most recently
            for (const p of seq) { if (cnt[p] === 0) f[p] = true; else { turn = 1 - p; last = p; } cnt[p]++; }  // a process's first write raises its flag; its second sets turn to the other's number and makes it the latest writer
            return { f, turn, last, cnt };  // hands back the flags, turn, latest writer and write counts
          };  // ends stateOf()
          function write(p) {  // write(p): runs when a process's button is clicked; adds that process's next write
            const S = stateOf();  // current values before this write
            if (S.cnt[p] >= 2 || seq.length >= 4) return;  // ignores the click if this process already made both writes or all four are done
            seq.push(p);  // adds the write to the order
            if (seq.length === 4) tried.add(seq.join(''));  // once all four writes are made, records this order as tried
            paint();  // redraws the game
          }  // ends write()
          function paint() {  // paint(): redraws the buttons, slots, memory values, result card and tried list
            const S = stateOf();  // current values after the writes so far
            bt.forEach((b, p) => { b.disabled = S.cnt[p] >= 2; b.innerHTML = S.cnt[p] >= 2 ? `P${p}: both writes done` : `${PN(p)} writes <code>${W(p, S.cnt[p])}</code>`; });  // each button names the write it will make next, or says both writes are done and is disabled
            const k0 = [0, 0];  // k0 counts, while drawing, how many writes of each process have been placed in the slots
            slots.replaceChildren(...[0, 1, 2, 3].map((n) => {  // builds the four slots
              if (n >= seq.length) return h('div', { class: 'slot', html: `<span class="xs muted">write ${n + 1}</span>` });  // a slot not filled yet just says "write 1" to "write 4"
              const p = seq[n];  // p is the process that made this write
              const txt = W(p, k0[p]++);  // txt is the write's code
              return h('div', { class: 'slot p' + p, html: `<span class="xs b c${p}">write ${n + 1} · P${p}</span><code>${txt}</code>` });  // a filled slot is coloured for its process and shows which write it is and the code
            }));  // ends the slot drawing
            cellsEl.innerHTML = `<div class="cell"><div class="nm">flag[0]</div><div class="v">${TV(S.f[0])}</div></div><div class="cell"><div class="nm">flag[1]</div><div class="v">${TV(S.f[1])}</div></div><div class="cell"><div class="nm">turn</div><div class="v">${S.turn}</div></div>`;  // shows the current values of flag[0], flag[1] and turn
            if (seq.length < 4) {  // fewer than four writes so far
              res.innerHTML = `<p class="small m0"><b>${seq.length} of 4 writes made.</b> Each process must raise its flag and then set <code>turn</code>. When all four writes are done, both processes run their <code>while</code> test and we see who waits.</p><p class="small muted m0 mt">Before you finish: which process do you think will wait?</p>`;  // progress message, with a prompt to predict which process will wait
            } else {  // all four writes made
              const w = S.last;  // w is the process that wrote turn last
              const line = (p) => { const j = 1 - p, a = S.f[j], b = S.turn === j; return `<div>${PN(p)} tests <code>flag[${j}] &amp;&amp; turn == ${j}</code> → ${TV(a)} &amp;&amp; ${TV(b)} → <b style="color:var(--${a && b ? 'warn' : 'ok'})">${a && b ? 'waits' : 'enters'}</b></div>`; };  // line(p): shows process p's while test with its values and the result, waits or enters
              res.innerHTML = `<div class="small">${line(0)}${line(1)}</div><p class="small m0 mt"><b>P${w} wrote <code>turn</code> last, so P${w} waits and P${1 - w} goes in.</b> Each process writes the <i>other’s</i> number, so <code>turn</code> ends up naming P${1 - w}, the rival of the later writer. And P${1 - w}’s flag must already be up, because every process raises its flag <i>before</i> it writes <code>turn</code>. So the later writer’s test is true on both counts.</p>`;  // writes both tests and the explanation: the later writer of turn waits, because turn names its rival and the rival's flag is up
            }  // ends the result card
            const n = ALL.filter((x) => tried.has(x)).length;  // n counts how many of the six orders have been tried
            triedEl.innerHTML = `<div class="row" style="gap:6px"><span class="b">Orders tried: ${n} of 6</span>${ALL.map((x) => `<span class="chip ${tried.has(x) ? 'ok' : ''}">${x.split('').join(' ')}</span>`).join('')}</div>`  // shows "Orders tried: n of 6" and one chip per order, green once tried
              + (n === 6 ? '<div class="mt"><b>All six:</b> every time, exactly one process waits, and it is always the one that wrote <code>turn</code> last.</div>' : '<div class="xs muted">Each chip lists who made writes 1 to 4 (0 = P0, 1 = P1). Try them all.</div>');  // after all six, the conclusion; before that, a note explaining how to read the chips
          }  // ends paint()
          const right = h('div', { class: 'stack' },  // right column of step 5: instructions, buttons, slots, memory values, result and tried list
            h('p', { class: 'small m0', html: '<b>You schedule the writes.</b> Both processes want in at the same moment. Click to choose which process makes its next write (each must raise its flag before it sets <code>turn</code>).' }),  // instruction paragraph: the student chooses which process makes its next write
            h('div', { class: 'row' }, bt[0], bt[1], again),  // a row with the two write buttons and Start over
            slots, cellsEl, res, triedEl);  // the four slots, the memory values, the result card and the list of tried orders
          paint();  // draws the game once when the step opens
          el.append(h('div', { class: 'split fill' }, left, right));  // places the two columns side by side on the page
        },  // ends render() for step 5
      },  // ends step 5

      /* ---------------- 6. The interleaving lab: the student is the scheduler ---------------- */
      {  // step 6: the free interleaving lab, where the student acts as the scheduler
        title: 'Interleaving lab: you are the scheduler',  // step title
        kind: 'lab',  // kind "lab": a hands-on page
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 6; builds the lab and the algorithm switch
          const { h } = ctx;  // h builds HTML elements
          const name = h('span', { class: 'small muted' });  // name shows the full name of the algorithm loaded in the lab
          const lab = makeLab(ctx, { algo: 'a2', keys: true });  // builds the lab, starting with Attempt 2, with the 0 and 1 keys turned on
          const pick = (v) => { lab.setAlgo(v); name.textContent = ALGO[v].name; };  // pick(v): loads another algorithm into the lab and shows its full name
          const seg = ctx.ui.seg(ALGOS.map((a) => ({ value: a.id, label: a.label, title: a.name })), 'a2', pick);  // a switch with one button per algorithm (full name on hover), starting on Attempt 2
          name.textContent = ALGO.a2.name;  // shows Attempt 2's full name at the start
          const main = h('div', { class: 'stack', style: { gap: '10px' } },  // main column: the switch, the lab and a short legend
            h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, seg, name),  // top row: the algorithm switch on the left, its full name on the right
            lab.grid, lab.verdict,  // the three-column lab and the verdict bar
            h('p', { class: 'xs muted m0', html: '<b>Halt</b> = the process crashes for good on its highlighted line. <b>↻</b> in the step log = a spin: a waiting test that changed no shared variable.' }));  // legend: what Halt does and what the loop arrow in the step log means
          const side = h('div', { class: 'stack', style: { gap: '10px' } },  // side column: scoreboard, buttons, suggestions and step log
            h('div', { class: 'card tight' }, h('h4', {}, 'Scoreboard'), lab.stats),  // the scoreboard card
            h('div', { class: 'row' }, lab.undoBtn, lab.resetBtn),  // the Undo and Reset buttons
            h('div', { class: 'card tight small', html: '<h4>Things to try</h4><ul class="m0" style="padding-left:18px"><li>Attempt 2: step P0, P1, P0, P1.</li><li>Attempt 3: raise both flags, then let both look.</li><li>Attempt 1: give each one visit, halt P1 in its remainder, run P0.</li><li>Dekker, Peterson: try anything. Can you break them?</li></ul>' }),  // suggestions of schedules to try with each algorithm
            h('h4', { class: 'm0' }, 'Step log'),  // heading of the step log
            lab.logEl);  // the step log itself
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 1fr) 262px', gap: '18px' } }, main, side));  // places the main column and a fixed 262 px side column next to each other
        },  // ends render() for step 6
      },  // ends step 6

      /* ---------------- 7. Break-it challenges with Show-me replays ---------------- */
      {  // step 7: break-it challenges, each with a Show me replay
        title: 'Break-it challenges: find the fatal interleavings',  // step title
        kind: 'lab',  // kind "lab": a hands-on page
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 7; builds the challenge list and the lab
          const { h } = ctx;  // h builds HTML elements
          const CH = [  // CH: the six challenges; each names its algorithm, the lab event that solves it, and a winning schedule for Show me
            { algo: 'a2', title: 'Both inside at once', ev: 'violation', show: [0, 1, 0, 1],  // challenge 1: Attempt 2, get both processes inside at once; the replay alternates P0, P1, P0, P1
              goal: 'Using <b>Attempt 2</b>, get P0 and P1 into their critical sections at the same time.',  // goal text of challenge 1
              hint: 'Let <i>each</i> process pass its check before either one raises its flag.',  // hint for challenge 1: let each process pass its check before either raises its flag
              lesson: 'Looking and announcing are two separate steps. A process can be paused between them, so both can look before either announces.' },  // lesson for challenge 1: looking and announcing are two separate steps
            { algo: 'a3', title: 'Frozen forever', ev: 'deadlock', show: [0, 1, 0, 1],  // challenge 2: Attempt 3, reach a deadlock
              goal: 'Using <b>Attempt 3</b>, reach a state where neither process can ever get in: a deadlock.',  // goal text of challenge 2
              hint: 'Raise both flags before either process looks.',  // hint for challenge 2: raise both flags before either looks
              lesson: 'Announcing first makes the attempt safe, but if both announce before either looks, each waits for a flag that will never come down.' },  // lesson for challenge 2: announcing first is safe, but both can end up waiting forever
            { algo: 'a4', title: 'Polite forever', ev: 'livelock', show: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],  // challenge 3: Attempt 4, produce the livelock pattern; the replay keeps both in step for ten steps
              goal: 'Using <b>Attempt 4</b>, bring everything back to an earlier state, with both processes busy and nobody in: a livelock pattern.',  // goal text of challenge 3
              hint: 'Keep them in perfect step: P0, P1, P0, P1, … for ten steps.',  // hint for challenge 3: alternate the processes perfectly for ten steps
              lesson: 'Backing off prevents a permanent freeze, but perfectly matched timing can repeat forever. Any small difference in speed ends it: livelock, not deadlock.' },  // lesson for challenge 3: backing off avoids a freeze, but matched timing can repeat forever
            { algo: 'a1', title: 'Waiting at an empty door', ev: 'alternation', show: [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],  // challenge 4: Attempt 1, make P0 wait at an empty critical section (forced alternation)
              goal: 'Using <b>Attempt 1</b>, make P0 wait while the critical section is empty and P1 sits in its remainder section.',  // goal text of challenge 4
              hint: 'Let P0 make one full visit, then P1 one full visit, then bring P0 back and let it test.',  // hint for challenge 4: one full visit each, then bring P0 back
              lesson: 'With a single turn variable a process may enter only on its turn, so a fast process is held back by a slow or uninterested one.' },  // lesson for challenge 4: a single turn variable holds a fast process back
            { algo: 'a1', title: 'Stranded by a halt', ev: 'blocked', show: [0, 0, 0, 1, 1, 1, 'h1', 0, 0, 0, 0, 0],  // challenge 5: Attempt 1, halt P1 in its remainder and strand P0; "h1" in the replay means halt P1
              goal: 'Using <b>Attempt 1</b>, halt P1 in its <i>remainder section</i> (well outside its critical section) and leave P0 blocked forever.',  // goal text of challenge 5
              hint: 'Let P0 and then P1 make one visit each, halt P1 in its remainder section, then keep running P0.',  // hint for challenge 5: one visit each, halt P1 in its remainder, then keep running P0
              lesson: 'P1 stopped outside its critical section, yet it took the turn with it. With flags instead, a halted process leaves its flag down and blocks no one.' },  // lesson for challenge 5: P1 took the turn with it; flags would have avoided this
            { algo: 'pt', title: 'Try to break Peterson', ev: 'fair2', show: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],  // challenge 6: Peterson, get each process in twice and try in vain to break it; "fair2" is a special solved test
              goal: 'Using <b>Peterson’s algorithm</b>, get each process into its critical section twice. On the way, try to trap both inside or freeze them. You will not manage it.',  // goal text of challenge 6
              hint: 'Mix it up: raise both flags, then let both write <code>turn</code> in different orders.',  // hint for challenge 6: raise both flags, then write turn in different orders
              lesson: 'Whatever order you choose, the later writer of <code>turn</code> waits, and a waiting process gets in as soon as the other leaves. No interleaving breaks it.' },  // lesson for challenge 6: the later writer of turn always waits, so no interleaving breaks it
          ];  // closes the challenge list
          const solved = new Set();  // solved remembers which challenges the student has solved during this visit
          let cur = 0, hintOn = false;  // cur is the challenge being shown; hintOn says whether its hint is visible
          const listEl = h('div', { class: 'chal-grid' });  // listEl is the grid of challenge buttons
          const headEl = h('h4', { class: 'm0' });  // headEl is the heading with the solved count
          const goalEl = h('p', { class: 'small m0' });  // goalEl shows the goal of the current challenge
          const hintEl = h('p', { class: 'small m0 muted' });  // hintEl shows its hint once asked for
          const msgEl = h('div', { class: 'small' });  // msgEl is the status line (not solved yet, solved, watch the replay)
          const titleEl = h('div', { class: 'small' });  // titleEl names the challenge and its algorithm above the lab
          const lessonEl = h('div', { class: 'callout tip small m0' });  // lessonEl is the callout under the lab: "How to play" at first, the lesson once solved
          const setLesson = (on) => { const c = CH[cur]; lessonEl.className = 'callout small m0 ' + (on ? 'why' : 'tip'); lessonEl.dataset.label = on ? 'What this shows' : 'How to play'; lessonEl.innerHTML = on ? c.lesson : 'Think before you click: which process should run next to cause the trouble? <b>Undo</b> backs up one step, and the coloured bar above tells you the moment you succeed. Stuck? <b>Show me</b> replays one winning schedule.'; };  // setLesson(on): switches that callout between the lesson (after solving) and the how-to-play text
          const showBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { msgEl.innerHTML = '<span class="muted">Watch the replay. Each step runs one highlighted line.</span>'; lab.play(CH[cur].show); } }, 'Show me');  // Show me button: plays the winning schedule of the current challenge in the lab
          const hintBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { hintOn = true; paintDetail(); } }, 'Hint');  // Hint button: reveals the hint of the current challenge
          const onEvent = (ev, L) => {  // onEvent(ev, L): called by the lab after every redraw with the verdict's event name; checks for a solved challenge
            const c = CH[cur];  // c is the current challenge
            if (!c || L.id !== c.algo) return;  // ignores events while the lab is loaded with a different algorithm (just after switching)
            const hit = c.ev === 'fair2' ? L.cnt.e[0] >= 2 && L.cnt.e[1] >= 2 && ev !== 'violation' : ev === c.ev;  // hit: for Peterson, both processes got in twice with no violation; for the others, the lab reported the target event
            if (!hit) { if (!L.replaying && !solved.has(cur) && ev === 'start') setLesson(false); if (!L.replaying && !solved.has(cur)) msgEl.innerHTML = '<span class="muted">Not solved yet. Keep scheduling.</span>'; return; }  // not hit: at a fresh start show how to play, and while it is not solved say "Not solved yet"; replays are left alone
            setLesson(true);  // the goal was reached, so show the lesson
            if (L.demo) { msgEl.innerHTML = '<b style="color:var(--ok)">That is one winning interleaving.</b> Reset, then do it yourself to claim it.'; return; }  // if it was reached by the Show me replay, say so but do not count it; the student must do it by hand
            solved.add(cur);  // records the challenge as solved
            msgEl.innerHTML = c.ev === 'fair2' ? '<b style="color:var(--ok)">Solved ✓</b> Both got in twice, never together, and nobody froze.' : '<b style="color:var(--ok)">Solved ✓</b> You found the fatal interleaving yourself.';  // success message, with its own wording for the Peterson challenge
            paintList();  // redraws the list so the solved challenge gets a check mark
          };  // ends onEvent()
          const lab = makeLab(ctx, { algo: CH[0].algo, keys: true, onEvent, speed: 650 });  // builds the lab for the first challenge, with keys, the solved check, and replays a little faster (0.65 s per move)
          function paintList() {  // paintList(): redraws the heading and the grid of challenge buttons
            headEl.textContent = `Challenges · ${solved.size} of ${CH.length} solved`;  // heading: "Challenges" with how many are solved
            listEl.replaceChildren(...CH.map((c, i) => h('button', { class: 'chal' + (i === cur ? ' on' : '') + (solved.has(i) ? ' done' : ''), type: 'button', title: ALGO[c.algo].name, onclick: () => choose(i) },  // one button per challenge: highlighted when chosen, marked done when solved; hovering shows the algorithm name
              h('span', { class: 'n' }, solved.has(i) ? '✓' : String(i + 1)), h('span', { class: 'grow' }, c.title))));  // each button shows its number (or a check mark once solved) and the challenge title
          }  // ends paintList()
          function paintDetail() {  // paintDetail(): shows the goal, hint and title of the current challenge
            const c = CH[cur];  // c is the current challenge
            goalEl.innerHTML = `<b>Goal:</b> ${c.goal}`;  // writes the goal
            hintEl.innerHTML = hintOn ? `<b>Hint:</b> ${c.hint}` : '';  // writes the hint only if the student asked for it
            titleEl.innerHTML = `<b>Challenge ${cur + 1}</b> · ${ALGO[c.algo].name}`;  // writes "Challenge N" and the algorithm's full name above the lab
          }  // ends paintDetail()
          function choose(i) {  // choose(i): runs when a challenge button is clicked (and once at the start); switches to challenge i
            cur = i; hintOn = false;  // makes it current and hides the hint again
            paintList(); paintDetail();  // redraws the list and the goal/hint/title
            lab.setAlgo(CH[i].algo);  // loads the challenge's algorithm into the lab, from its first line
            setLesson(solved.has(i));  // shows the lesson if this challenge was already solved, otherwise the how-to-play text
            msgEl.innerHTML = solved.has(i) ? '<b style="color:var(--ok)">Solved ✓</b> Try it again, or pick another challenge.' : '<span class="muted">Not solved yet. You are the scheduler.</span>';  // status line: already solved (try again or pick another) or not solved yet
          }  // ends choose()
          const side = h('div', { class: 'stack', style: { gap: '10px' } },  // side column: the challenge list and the goal card
            headEl, listEl,  // heading and challenge grid
            h('div', { class: 'card tight stack gap-s' }, goalEl, h('div', { class: 'row' }, showBtn, hintBtn), hintEl, msgEl));  // goal card: the goal, the Show me and Hint buttons, the hint and the status line
          const main = h('div', { class: 'stack', style: { gap: '10px' } },  // main column: title, lab, verdict and lesson
            h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, titleEl, h('div', { class: 'row nw' }, lab.undoBtn, lab.resetBtn)),  // top row: the challenge title on the left, Undo and Reset on the right
            lab.grid, lab.verdict, lessonEl);  // the three-column lab, the verdict bar and the lesson callout
          choose(0);  // opens challenge 1 when the step opens
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: '292px minmax(0, 1fr)', gap: '18px' } }, side, main));  // places a fixed 292 px side column next to the main column
        },  // ends render() for step 7
      },  // ends step 7

      /* ---------------- 8. Scorecard: every attempt against every requirement ---------------- */
      {  // step 8: the scorecard that compares every algorithm against every requirement
        title: 'Scorecard: which attempt passes which test?',  // step title
        kind: 'compare',  // kind "compare": a comparison page
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 8; builds the table of hidden answers and the detail card
          const { h } = ctx;  // h builds HTML elements
          const COLS = ['Mutual exclusion', 'No deadlock', 'No livelock', 'No forced alternation', 'Survives a halt in the remainder', 'No busy waiting'];  // COLS: the six requirements, one per table column
          const BW = 'Waiting is still a loop that re-tests a shared variable, burning CPU time.';  // BW: the reason shared by several rows for failing the last column (busy waiting)
          const ROWS = [  // ROWS: one row per algorithm: name, short description, pass (1) or fail (0) per column, and the reason for each cell
            ['Attempt 1', 'turn only', [1, 1, 1, 0, 0, 0], [  // Attempt 1: passes the first three columns, fails alternation, halt and busy waiting
              'Only the process named by <code>turn</code> can leave its waiting loop, and <code>turn</code> holds one value at a time.',  // reason: only the process named by turn can leave its loop, so mutual exclusion holds
              '<code>turn</code> always names someone, and that process can walk straight in.',  // reason: turn always names someone who can walk in, so no deadlock
              'Nobody backs off and retries. A waiting process simply waits for one fixed value.',  // reason: nobody backs off and retries, so no livelock
              'Visits must alternate P0, P1, P0, P1. A process that wants two visits in a row must wait for the other, however slow or uninterested it is.',  // reason: visits must alternate, so it fails the forced-alternation test
              'If P1 halts in its remainder section, P0 gets one more visit, sets <code>turn = 1</code>, and then waits forever for a hand-back that never comes.',  // reason: a halt in the remainder strands the other process
              'The loop <code>while (turn != i)</code> re-reads <code>turn</code> over and over.']],  // reason: the waiting loop keeps re-reading turn, which is busy waiting
            ['Attempt 2', 'look, then flag', [0, 1, 1, 1, 1, 0], [  // Attempt 2: fails mutual exclusion and busy waiting, passes the rest
              'Both can pass their check before either raises its flag, and then both walk in. Checking and announcing are separate steps.',  // reason: both can pass their check before either raises its flag
              'A process waits only while the other’s flag is up, which means the other is inside and will lower its flag on the way out.',  // reason: a process waits only while the other is inside, so no deadlock
              'No backing off and retrying, so no endless dance.',  // reason: no backing off, so no livelock
              'A process that is not interested keeps its flag down, so the other may enter as often as it likes.',  // reason: an uninterested process keeps its flag down, so no forced alternation
              'A process halted in its remainder section has its flag down, so it blocks no one.',  // reason: a process halted in its remainder has its flag down
              BW]],  // reason: the shared busy-waiting explanation
            ['Attempt 3', 'flag, then look', [1, 0, 1, 1, 1, 0], [  // Attempt 3: fails deadlock and busy waiting, passes the rest
              'Each process raises its flag before looking, so of two contenders the one that looks second sees the other’s flag and waits.',  // reason: each raises its flag before looking, so the later looker waits
              'If both raise their flags before either looks, each waits forever for the other to lower its flag.',  // reason: both flags up before either looks leads to deadlock
              'When it fails it freezes (deadlock); nobody keeps retrying.',  // reason: when it fails it freezes, it does not keep retrying
              'An uninterested process has its flag down, so it never holds the other back.',  // reason: an uninterested process has its flag down
              'Halted in its remainder section means its flag is down.',  // reason: a halted process in its remainder has its flag down
              BW]],  // reason: the shared busy-waiting explanation
            ['Attempt 4', 'flag, then back off', [1, 1, 0, 1, 1, 0], [  // Attempt 4: fails livelock and busy waiting, passes the rest
              'A process enters only after seeing the other’s flag down while its own is up, just as in Attempt 3.',  // reason: it enters only after seeing the other's flag down while its own is up
              'Backing off lowers flags, so the two can never stay stuck with both flags up for good.',  // reason: backing off lowers flags, so it cannot stay stuck
              'In perfect step both back off, pause and retry together, forever. Any small change in speed breaks the pattern.',  // reason: in perfect step both back off and retry forever
              'An uninterested process has its flag down.',  // reason: an uninterested process has its flag down
              'Halted in its remainder section means its flag is down.',  // reason: a halted process in its remainder has its flag down
              'The waiting and retrying loop keeps the CPU busy.']],  // reason: the back-off loop keeps the CPU busy
            ['Dekker', 'flags + tiebreak turn', [1, 1, 1, 1, 1, 0], [  // Dekker: passes everything except busy waiting
              'A process enters only when it sees the other’s flag down while its own is up, so two can never be inside together.',  // reason: it enters only after seeing the other's flag down while its own is up
              'With both flags up, <code>turn</code> names exactly one process to back off, so the other gets in.',  // reason: with both flags up, turn names exactly one process to back off
              'Only the process without the turn backs off, and it waits for the turn to change instead of pausing and retrying, so the two cannot mirror each other.',  // reason: the process that backs off waits for the turn instead of retrying, so no mirroring
              'If the other process is not interested its flag is down, and you enter at once, whatever <code>turn</code> says.',  // reason: if the other is not interested, it enters at once whatever turn says
              'A process halted in its remainder section has its flag down, and <code>turn</code> matters only in a tie.',  // reason: a halted process in its remainder has its flag down, and turn matters only in a tie
              'The process that backs off spins on <code>turn</code>, and the outer loop spins on the flag.']],  // reason: both loops spin
            ['Peterson', 'flag, give turn, wait', [1, 1, 1, 1, 1, 0], [  // Peterson: passes everything except busy waiting
              'If both want in, the later writer of <code>turn</code> sees the other’s flag up and the turn pointing at the other, so it waits until the other leaves.',  // reason: the later writer of turn waits until the other leaves
              'Both waiting would need <code>turn</code> to equal 0 and 1 at the same time.',  // reason: both waiting would need turn to be 0 and 1 at once
              'A waiting process just re-tests; nobody lowers and raises flags in a dance.',  // reason: a waiting process only re-tests, with no flag dance
              'An uninterested process has its flag down, so your test fails at once and you enter.',  // reason: an uninterested process has its flag down, so the test fails and you enter
              'A process halted in its remainder section has its flag down, so the other’s test fails at once. (A halt in the entry protocol, with its flag up, can still block the other, as in every flag-based algorithm.)',  // reason: a halted process in its remainder has its flag down (a halt with the flag up still blocks)
              'The <code>while</code> test is simply re-run until it fails: busy waiting.']],  // reason: the while test is re-run until it fails, which is busy waiting
          ];  // closes the ROWS list
          const shown = new Set();  // shown remembers which cells have been revealed, as "row-column" keys
          let sel = null;  // sel is the key of the selected cell, or null
          const btns = [];  // btns collects every cell button with its row and column
          const detail = h('div', { class: 'card white', style: { minHeight: '210px' } });  // detail is the card on the right that explains the selected cell
          const prog = h('div', { class: 'small b' });  // prog shows how many of the 36 cells are revealed
          function paint() {  // paint(): redraws every cell button, the progress count and the detail card
            btns.forEach(({ b, r, c }) => {  // updates each cell button
              const k = r + '-' + c, on = shown.has(k), ok = ROWS[r][2][c];  // k is the cell's key, on says whether it is revealed, ok whether the algorithm passes
              b.className = 'sc-btn' + (on ? (ok ? ' y' : ' n') : '') + (sel === k ? ' sel' : '');  // colours a revealed cell green or red and outlines the selected one
              b.textContent = on ? (ok ? '✓' : '✗') : '?';  // shows a check or a cross once revealed, otherwise a question mark
            });  // ends the cell update
            prog.textContent = `Revealed ${shown.size} of 36`;  // progress text: "Revealed n of 36"
            if (!sel) { detail.innerHTML = '<h3>Predict, then click</h3><p class="small m0">Each <b>?</b> hides whether that algorithm guarantees that property. Say ✓ or ✗ to yourself, then click the cell to check and read the reason.</p>'; return; }  // before any click, the detail card explains how to use the table, and paint stops here
            const [r, c] = sel.split('-').map(Number), ok = ROWS[r][2][c];  // reads the selected cell's row and column and whether it passes
            detail.innerHTML = `<div class="xs muted b">${ROWS[r][0].toUpperCase()} · ${COLS[c].toUpperCase()}</div><div class="big" style="color:var(--${ok ? 'ok' : 'bad'})">${ok ? '✓ yes' : '✗ no'}</div><p class="m0">${ROWS[r][3][c]}</p>`;  // detail card: the algorithm and requirement, a large yes or no, and the reason
          }  // ends paint()
          const table = h('table', { class: 'tbl score' },  // builds the scorecard table
            h('thead', {}, h('tr', {}, h('th', { style: { width: '176px' } }, 'Algorithm'), ...COLS.map((c) => h('th', {}, c)))),  // header row: "Algorithm", then the six requirement names
            h('tbody', {}, ...ROWS.map((row, r) => h('tr', {},  // body: one row per algorithm
              h('td', { html: `<b>${row[0]}</b><div class="xs muted">${row[1]}</div>` }),  // first cell: the algorithm's name in bold with its short description below
              ...COLS.map((_, c) => {  // then one cell per requirement
                const b = h('button', { type: 'button', class: 'sc-btn', 'aria-label': `${row[0]}: ${COLS[c]}`, onclick: () => { shown.add(r + '-' + c); sel = r + '-' + c; paint(); } });  // a hidden-answer button, named for screen readers; clicking reveals and selects that cell
                btns.push({ b, r, c });  // remembers the button so paint() can update it
                return h('td', {}, b);  // puts the button in its table cell
              })))));  // closes the cells, the rows, the body and the table
          const left = h('div', { class: 'stack' }, h('div', { class: 'tscroll' }, table),  // left column: the table in a sideways-scrolling wrapper
            h('div', { class: 'grid-2' },  // two callouts side by side under the table
              h('div', { class: 'callout why small m0', 'data-label': 'The shared cost: busy waiting', html: 'Every row fails the last column. On a single CPU spinning is pure waste: while P0 spins, the process it waits for cannot even run until P0’s time slice ends. The next step measures the cost.' }),  // callout: every row fails the last column, and on one CPU spinning is pure waste
              h('div', { class: 'callout warn small m0', 'data-label': 'A hidden assumption', html: 'All of these assume each read and write reaches memory in program order. Modern CPUs and compilers may reorder them. The next step shows Peterson breaking, and the fix: a memory barrier.' })));  // callout: all of these assume in-order memory; the next step shows Peterson breaking without it
          const right = h('div', { class: 'stack' }, detail,  // right column of step 8: the detail card first
            h('div', { class: 'row' }, prog, h('span', { class: 'grow' }),  // a row with the progress count on the left and, pushed to the right by a spacer...
              h('button', { class: 'btn sm', type: 'button', onclick: () => { btns.forEach(({ r, c }) => shown.add(r + '-' + c)); paint(); } }, 'Reveal all'),  // ...a Reveal all button that uncovers every cell at once
              h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { shown.clear(); sel = null; paint(); } }, 'Hide all')),  // ...and a Hide all button that covers them again and clears the selection
            h('div', { class: 'callout tip small m0', 'data-label': 'Spot the pattern', html: 'Read down the columns: each attempt fixed one problem and exposed another. Only Dekker’s and Peterson’s rows pass all five correctness tests, and nobody passes the last one.' }));  // callout: read down the columns; each attempt fixed one problem and exposed another
          paint();  // draws the table and detail card once when the step opens
          el.append(h('div', { class: 'split r fill', style: { gridTemplateColumns: 'minmax(0, 2.1fr) minmax(0, 1fr)' } }, left, right));  // places the wide table column (2.1 parts) next to the detail column (1 part)
        },  // ends render() for step 8
      },  // ends step 8

      /* ---------------- 9. Fine print: n processes, the cost of spinning, memory order ---------------- */
      {  // step 9: the optional "Going deeper" page with three tabs
        title: 'Going deeper: n processes, spinning, memory order',  // step title
        kind: 'explore',  // kind "explore": an interactive page
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 9; builds the three tabs
          const tabs = ctx.ui.tabs([  // builds the tab strip; each tab builds its content only when opened
            { label: 'Peterson for <i>n</i> processes', render: (panel) => filterTab(panel, ctx) },  // tab 1: the filter algorithm (Peterson for n processes)
            { label: 'The cost of busy waiting', render: (panel) => spinTab(panel, ctx) },  // tab 2: the cost of busy waiting
            { label: 'When memory is reordered', render: (panel) => orderTab(panel, ctx) },  // tab 3: what goes wrong when memory is reordered
          ]);  // closes the tab list
          // label the whole step as optional extension material, at the right end of the tab strip
          const strip = tabs.querySelector('.tabs-strip');  // finds the row of tab buttons inside the tabs just built
          if (strip) strip.append(ctx.h('span', { class: 'grow' }), ctx.h('span', { class: 'row gap-s', style: { alignSelf: 'center' } },  // if found, adds a spacer and, at the far right, a small group...
            ctx.h('span', { class: 'chip accent' }, 'Going deeper (optional)'),  // ...with an accent chip that says this step is optional...
            ctx.h('span', { class: 'xs muted' }, 'beyond the core ideas; fine to skip on a first read')));  // ...and a grey note that it is fine to skip on a first read
          el.append(tabs);  // places the tabs on the page
        },  // ends render() for step 9
      },  // ends step 9

      /* ---------------- 10. Recap ---------------- */
      {  // step 10: the recap flip cards
        title: 'Recap: eight cards to remember',  // step title
        kind: 'recap',  // kind "recap": a summary page
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 10; builds the cards
          el.append(ctx.h('div', { class: 'stack fill' },  // a column that fills the page
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // lead line: say each answer out loud before flipping
            ctx.ui.flipcards([  // the flip cards: the front shows a topic, a click (or Enter/Space) turns the card to show the summary
              ['The rules of the game', 'Only plain reads and writes of shared variables. The memory arbiter makes each single access indivisible. No special instructions, no OS help.'],  // card: the rules of the game (plain reads and writes, the memory arbiter, no help)
              ['Attempt 1: one turn variable', 'Safe, but visits must strictly alternate, and a process that halts, even outside its critical section, can block the other forever.'],  // card: Attempt 1's strict alternation and halt problem
              ['Attempt 2: look, then flag', 'Both can pass the check before either raises its flag, so both get in. Mutual exclusion fails.'],  // card: Attempt 2 lets both in
              ['Attempt 3: flag, then look', 'Safe, but if both raise their flags before looking, each waits forever for the other: deadlock.'],  // card: Attempt 3 can deadlock
              ['Attempt 4: flag, then back off', 'Safe and free of deadlock, but in perfect step both back off and retry forever: livelock.'],  // card: Attempt 4 can livelock
              ['Dekker’s fix', 'Flags plus a turn variable. In a tie, only the process without the turn backs off, and it waits for the turn. Each exit gives the next tie away.'],  // card: Dekker's tiebreaker fix
              ['Peterson in one line', 'Raise your flag, give the turn away, wait while the other wants in and holds the turn. The later writer of turn waits. For n processes, climb n − 1 levels; at each one the latest arrival waits.'],  // card: Peterson in one line, and its n-process version
              ['The fine print', 'All of them busy-wait: on one CPU a spinner can burn its whole time slice. All assume in-order memory; store buffers break Peterson unless a memory barrier is added.'],  // card: the fine print, busy waiting and memory order
            ], { cols: 4, height: 222 })));  // closes the card list; four cards per row, each 222 px tall
        },  // ends render() for step 10
      },  // ends step 10

      /* ---------------- 11. Check yourself ---------------- */
      {  // step 11: the end-of-section quiz
        title: 'Check yourself',  // step title
        kind: 'check',  // kind "check": the guide builds the quiz page from the list below
        quiz: [  // the quiz questions; wrong choices can have their own feedback, and "why" is the explanation shown after answering
          { q: 'Attempt 1 uses only <code>int turn</code>. P0 has just left its critical section (setting <code>turn = 1</code>) and wants to go straight back in, while P1 is busy in a long remainder section. What happens?',  // question 1 (multiple choice): Attempt 1 after P0 leaves while P1 is in a long remainder
            choices: ['P0 re-enters at once, because the critical section is empty', 'P0 must wait until P1 enters and leaves its critical section', 'P0 and P1 both end up inside their critical sections', 'P0 and P1 deadlock'],  // choices for question 1
            answer: 1,  // correct answer: index 1, the second choice (choices are counted from 0): P0 must wait for P1's visit
            feedback: ['An empty critical section is not enough: P0 may enter only when <code>turn</code> is 0, and only P1 sets it back.', null, 'Attempt 1 never breaks mutual exclusion: only the process named by <code>turn</code> can pass its loop.', 'P1 is not waiting for anything, so this is not deadlock. P0 is simply stuck behind the alternation rule.'],  // feedback for each wrong choice (null for the right one)
            why: 'Attempt 1 forces strict alternation. After P0’s visit only P1 can hand the turn back, so the fast process is held to the slow one’s pace.' },  // explanation: Attempt 1 forces strict alternation
          { q: 'Attempt 2 runs <code>while (flag[j]) ;</code> then <code>flag[i] = true;</code> then the critical section. Which interleaving puts both processes inside at once?',  // question 2 (multiple choice): which interleaving puts both inside with Attempt 2
            choices: ['P0 tests, P1 tests, P0 raises its flag, P1 raises its flag', 'P0 tests, P0 raises its flag, P1 tests, P1 raises its flag', 'P1 tests, P1 raises its flag, P0 tests, P0 raises its flag', 'No interleaving can do it'],  // choices for question 2: four different orders of tests and flag raises
            answer: 0,  // correct answer: the first order, both test before either raises its flag
            feedback: [null, 'P1 tests after P0’s flag is up, so P1 waits. This order is safe.', 'P0 tests after P1’s flag is up, so P0 waits. This order is safe.', 'Attempt 2 does fail, because the test and the flag-raise are two separate steps.'],  // feedback for each wrong choice
            why: 'If both test before either raises its flag, both see <code>false</code> and both walk in.' },  // explanation: both see false and both walk in
          { type: 'tf', q: '<b>Going deeper (optional):</b> on a multiprocessor whose CPUs let a later read go ahead of an earlier write that is still waiting in a store buffer, Peterson’s algorithm with no memory barrier can let both processes into their critical sections at once.', answer: true,  // question 3 (true or false, optional material): store buffers can let both into Peterson without a barrier
            why: 'Each process’s write of its own flag can still sit in its store buffer when it reads the other’s flag from memory, so both read false and both enter. A memory barrier between the writes and the test forces the writes out to memory first.' },  // explanation: each write can still sit in its buffer when the other flag is read
          { type: 'num', q: '<b>Going deeper (optional):</b> five processes use Peterson’s idea extended to <i>n</i> processes (the filter algorithm, with levels 1 to 4). At most how many of them can be past level 3 at the same moment?',  // question 4 (calculate, optional material): how many of five processes can be past level 3 of the filter algorithm
            answer: 2, tol: 0, unit: 'processes',  // answer 2 processes, and only exactly 2 is accepted (tolerance 0)
            hint: 'Each level holds back its latest arrival.',  // hint for question 4
            why: 'At most <i>n</i> − L processes get past level L, so 5 − 3 = 2. Past the top level, 4, at most 5 − 4 = 1 gets through: that one is in its critical section.' },  // explanation: n - L = 5 - 3 = 2
          { type: 'match', q: 'Match each attempt with its flaw.',  // question 5 (match the pairs): each attempt with its flaw
            pairs: [['Attempt 1 (turn only)', 'Forces strict alternation'], ['Attempt 2 (look, then flag)', 'Both can be inside at once'], ['Attempt 3 (flag, then look)', 'Can deadlock with both flags up'], ['Attempt 4 (flag, then back off)', 'Can livelock in perfect step']],  // the four attempt-and-flaw pairs
            why: 'Each fix exposed a new problem: alternation, then broken mutual exclusion, then deadlock, then livelock. Dekker’s tiebreaker cures all four.' },  // explanation: each fix exposed a new problem
          { type: 'order', q: 'Put the parts of Peterson’s algorithm for process Pi in order.',  // question 6 (put in order): the parts of Peterson's algorithm
            items: ['<code>flag[i] = true;</code>', '<code>turn = j;</code>', '<code>while (flag[j] &amp;&amp; turn == j) ;</code>', 'critical section', '<code>flag[i] = false;</code>', 'remainder section'],  // the six parts, listed here in the correct order (the quiz shuffles them)
            why: 'Announce interest, give the turn away, wait only while the other wants in and holds the turn, use the resource, withdraw interest, then do other work.' },  // explanation: announce, give the turn away, wait, use, withdraw, other work
          { q: 'Both processes run Peterson’s entry code at about the same time, and both flags are up. P0 executes <code>turn = 1</code> first; P1 executes <code>turn = 0</code> a moment later. Which process enters its critical section first?',  // question 7 (multiple choice): which process enters first when P1 writes turn last
            choices: ['P0', 'P1', 'Neither: they deadlock', 'Both at once'],  // choices for question 7
            answer: 0,  // correct answer: P0
            feedback: [null, 'P1 wrote <code>turn</code> last, leaving it 0, so P1’s test <code>flag[0] &amp;&amp; turn == 0</code> is true and P1 waits.', 'Deadlock would need <code>turn</code> to equal 0 and 1 at once.', 'Peterson’s algorithm guarantees mutual exclusion.'],  // feedback for each wrong choice
            why: 'The later writer of <code>turn</code> waits. P1 wrote last, leaving <code>turn = 0</code>, so P0’s test <code>flag[1] &amp;&amp; turn == 1</code> is false and P0 goes in.' },  // explanation: the later writer of turn waits
          { type: 'multi', q: 'Which statements about Dekker’s algorithm are true?',  // question 8 (select all that apply): true statements about Dekker's algorithm
            choices: ['It uses a flag for each process plus a turn variable', 'When both flags are up, <code>turn</code> decides which process backs off', 'It needs a special test-and-set instruction', 'A process that must wait still busy-waits', 'The process that backs off just pauses and retries, as in Attempt 4'],  // the five statements to judge
            answer: [0, 1, 3],  // correct statements: the first, second and fourth
            why: 'Dekker combines flags with a turn variable as a tiebreaker and needs only ordinary reads and writes. The process that backs off waits for the turn rather than retrying blindly, but waiting is still a busy loop.' },  // explanation: flags plus a turn variable, plain reads and writes, and still busy waiting
          { type: 'bucket', q: 'Which failure does each scenario describe?', buckets: ['Both inside', 'Deadlock', 'Livelock'],  // question 9 (sort into groups): classify each scenario as both inside, deadlock or livelock
            items: [['Both pass their checks, then both flag', 0], ['Both flags up; each waits for the other', 1], ['Flags go down and up in step, forever', 2],  // the scenarios with their correct group numbers...
              ['No schedule can ever let anyone in', 1], ['A small speed change would end it', 2]],  // ...continued
            why: 'Both inside means mutual exclusion is violated. Deadlock means stuck with no possible progress. Livelock means busy but going nowhere, and a change in timing can break it.' },  // explanation: how the three failures differ
          { type: 'num', q: 'P0 and P1 run on two different CPUs. P0 busy-waits on a flag while P1 spends 3 more microseconds in its critical section. One test of the flag takes 6 nanoseconds. About how many times does P0 test the flag before P1 leaves?',  // question 10 (calculate): tests wasted spinning for 3 microseconds at 6 nanoseconds per test
            answer: 500, tol: 5, unit: 'tests',  // answer 500 tests; answers within 5 of it are accepted
            why: '3 µs = 3,000 ns, and 3,000 ns ÷ 6 ns per test = 500 tests, every one of them wasted CPU work. On a single CPU it could be far worse: the spinner would burn its whole time slice while P1 could not run at all.' },  // explanation: 3,000 ns divided by 6 ns = 500
          { q: 'Apart from memory operations happening in program order, what must the hardware guarantee for the software algorithms in this section to work?',  // question 11 (multiple choice): what the hardware must guarantee besides program order
            choices: ['Accesses to the same memory location happen one at a time', 'An instruction that reads and writes a variable in one indivisible step', 'The OS can put a waiting process to sleep', 'Both processes run at the same speed'],  // choices for question 11
            answer: 0,  // correct answer: accesses to one memory location happen one at a time
            feedback: [null, 'That is a special hardware instruction, the topic of Section 5.3. These algorithms do without it.', 'No OS help is assumed: waiting processes spin.', 'The algorithms must work at any relative speed.'],  // feedback for each wrong choice
            why: 'The memory arbiter serializes accesses to one location, so each single read or write is atomic. Everything else is built from that, plus the assumption that reads and writes happen in program order.' },  // explanation: the memory arbiter makes each single read or write atomic
          { type: 'tf', q: 'With Attempt 1, a process that halts in its remainder section (outside its critical section) can leave the other process blocked forever.', answer: true,  // question 12 (true or false): a halt in the remainder with Attempt 1 can block the other forever
            why: 'The halted process never hands the turn back, so once the survivor gives the turn away it waits forever. With flags (Attempts 2 to 4, Dekker, Peterson), a process halted in its remainder section leaves its flag down and blocks no one.' },  // explanation: the turn is never handed back; with flags this cannot happen
        ],  // ends the quiz list
      },  // ends step 11
    ],  // closes the list of steps
    notes: `${/* notes: the written summary of the section, shown in the Notes panel (the N key); it is HTML text */''}
<h3>The setting: only reads and writes</h3>${/* heading for part 1 of the notes: the setting, only reads and writes */''}
<p>Two processes, <b>P0</b> and <b>P1</b>, share memory. Each loops forever through four parts: an <b>entry protocol</b> (asks for permission), its <b>critical section</b> (uses the shared data), an <b>exit protocol</b> (announces it has left) and its <b>remainder section</b> (everything else). The goal is <b>mutual exclusion</b>: never both inside their critical sections at once. Without it, overlapping updates can corrupt shared data, a <b>race condition</b>.</p>${/* notes paragraph: the four parts of each process's loop, mutual exclusion, and race conditions */''}
<ul>${/* starts the list of rules */''}
<li><b>Allowed:</b> ordinary reads and writes. A <b>memory arbiter</b> lets one access at a time touch a memory location, so each single read or write is <b>atomic</b> (two writes to <code>turn</code> land one after the other, in an unpredictable order, never blended). We also assume each process’s reads and writes reach memory in program order.</li>${/* notes rule: ordinary reads and writes are allowed, and the memory arbiter makes each one atomic */''}
<li><b>Not allowed:</b> special instructions (Section 5.3) or OS help. A waiting process can only loop and re-test a variable: <b>busy waiting</b> (spinning).</li>${/* notes rule: no special instructions and no OS help, so waiting means busy waiting */''}
<li><b>No speed assumptions:</b> a process may be paused after any step. One order of steps is an <b>interleaving</b>; a solution must work for all of them.</li>${/* notes rule: no speed assumptions; a solution must work for every interleaving */''}
</ul>${/* ends the list of rules */''}
<p>We want mutual exclusion with no <b>deadlock</b> (all frozen for good), no <b>livelock</b> (all busy, none progressing), no <b>starvation</b>, no <b>strict alternation</b>, and survival of a halt in the remainder section. Section 5.2 lists the full requirements.</p>${/* notes paragraph: the requirements a good solution must meet */''}

<h4>Attempt 1: one turn variable</h4>${/* heading for the Attempt 1 notes */''}
<pre>int turn = 0;${/* shown code, line 1: the shared turn variable */''}
while (turn != i) ;      /* wait for my turn   */${/* shown code, line 2: wait for my turn */''}
/* critical section */${/* shown code, line 3: the critical section */''}
turn = j;                /* hand the turn over */</pre>${/* shown code, line 4: hand the turn over; ends the code box */''}
<p><b>Mutual exclusion holds:</b> only the process named by <code>turn</code> can leave its loop. <b>Flaw 1, strict alternation:</b> visits must go P0, P1, P0, P1, so the pace is set by the slower process. Example: P0 needs 1 tick of other work, P1 needs 5. Over 20 ticks P0 enters only 4 times and spins for 12 ticks, although on its own it could enter 10 times. <b>Flaw 2:</b> if P1 halts, even in its remainder section, P0 gets one more visit, sets <code>turn = 1</code>, and then waits forever.</p>${/* notes paragraph: Attempt 1 is safe but forces alternation (with a worked example) and a halt strands the other */''}

<h4>Attempt 2: look, then raise your flag</h4>${/* heading for the Attempt 2 notes */''}
<pre>boolean flag[2] = {false, false};${/* shown code, line 1: the two flags */''}
while (flag[j]) ;            /* wait while the other is inside */${/* shown code, line 2: wait while the other's flag is up */''}
flag[i] = true;              /* announce, then go in           */${/* shown code, line 3: announce, then go in */''}
/* critical section */${/* shown code, line 4: the critical section */''}
flag[i] = false;</pre>${/* shown code, line 5: lower my flag; ends the code box */''}
<p>An uninterested or halted process keeps its flag down and blocks no one. But <b>mutual exclusion fails</b>: P0 tests (false), P1 tests (false), P0 raises its flag and enters, P1 does the same. Looking and announcing are separate steps.</p>${/* notes paragraph: an idle process blocks no one, but mutual exclusion fails */''}

<h4>Attempt 3: raise your flag, then look</h4>${/* heading for the Attempt 3 notes */''}
<pre>flag[i] = true;              /* announce first      */${/* shown code, line 1: announce first */''}
while (flag[j]) ;            /* then wait if needed */${/* shown code, line 2: then wait if needed */''}
/* critical section */${/* shown code, line 3: the critical section */''}
flag[i] = false;</pre>${/* shown code, line 4: lower my flag; ends the code box */''}
<p><b>Mutual exclusion holds:</b> each raises its flag before looking, so of two contenders the one that looks second sees the other’s flag and waits. But <b>deadlock</b> is possible: both raise their flags, then each waits forever for the other’s to drop.</p>${/* notes paragraph: why Attempt 3 is safe, and how it deadlocks */''}

<h4>Attempt 4: flag, polite back-off, retry</h4>${/* heading for the Attempt 4 notes */''}
<pre>flag[i] = true;${/* shown code, line 1: raise my flag */''}
while (flag[j]) {${/* shown code, line 2: the back-off loop while the other wants in */''}
    flag[i] = false;         /* step back          */${/* shown code, line 3: step back */''}
    /* delay a moment */${/* shown code, line 4: pause a moment */''}
    flag[i] = true;          /* then ask again     */${/* shown code, line 5: ask again */''}
}${/* shown code, line 6: end of the back-off loop */''}
/* critical section */${/* shown code, line 7: the critical section */''}
flag[i] = false;</pre>${/* shown code, line 8: lower my flag; ends the code box */''}
<p>Safe and deadlock-free, but <b>livelock</b> is possible: in perfect step both raise, both see the other’s flag, both lower, pause and raise again, forever. Not deadlock: any change in relative speed lets one process find the other’s flag down and enter.</p>${/* notes paragraph: Attempt 4 can livelock, and why that is not deadlock */''}
<h3>Dekker’s algorithm: flags plus a tiebreaker</h3>${/* heading for part 2 of the notes: Dekker's algorithm */''}
<pre>boolean flag[2] = {false, false};${/* shown code, line 1: the two flags */''}
int turn = 1;${/* shown code, line 2: turn starts at 1 */''}
flag[i] = true;${/* shown code, line 3: raise my flag */''}
while (flag[j]) {            /* both want in?     */${/* shown code, line 4: the outer loop while both want in */''}
    if (turn == j) {         /* tie is the other's */${/* shown code, line 5: check whether the tie is the other's */''}
        flag[i] = false;     /* step back         */${/* shown code, line 6: step back */''}
        while (turn == j) ;  /* wait for the turn */${/* shown code, line 7: wait for the turn */''}
        flag[i] = true;      /* ask again         */${/* shown code, line 8: ask again */''}
    }${/* shown code, line 9: end of the tie check */''}
}${/* shown code, line 10: end of the outer loop */''}
/* critical section */${/* shown code, line 11: the critical section */''}
turn = j;                    /* next tie: other   */${/* shown code, line 12: give the next tie to the other process */''}
flag[i] = false;</pre>${/* shown code, line 13: lower my flag; ends the code box */''}
<p>The first known correct software-only solution for two processes. Flags keep it safe; the <b>turn variable</b> settles ties. With <code>turn = 1</code>: both raise flags; P0 finds <code>turn == 1</code>, lowers its flag and waits on <code>turn</code>; P1 keeps checking, sees P0’s flag down and enters. On exit P1 sets <code>turn = 0</code> and lowers its flag, so P0 raises its flag again and enters.</p>${/* notes paragraph: Dekker's algorithm, with a traced tie */''}
<ul>${/* starts the list of Dekker's guarantees */''}
<li><b>Mutual exclusion:</b> a process enters only after seeing the other’s flag down while its own is up.</li>${/* notes item: why mutual exclusion holds */''}
<li><b>No deadlock:</b> with both flags up, <code>turn</code> is 0 or 1, so exactly one process backs off.</li>${/* notes item: why there is no deadlock */''}
<li><b>No livelock:</b> only the process without the turn backs off, and it waits for the turn rather than retrying blindly.</li>${/* notes item: why there is no livelock */''}
<li><b>No starvation:</b> each exit hands the next tie to the other process.</li>${/* notes item: why there is no starvation */''}
<li><code>turn</code> is not “who is inside”: if the other process is not interested, you enter at once whatever <code>turn</code> says.</li>${/* notes item: turn is not "who is inside" */''}
</ul>${/* ends the list of Dekker's guarantees */''}

<h3>Peterson’s algorithm</h3>${/* heading for part 3 of the notes: Peterson's algorithm */''}
<pre>boolean flag[2] = {false, false};${/* shown code, line 1: the two flags */''}
int turn = 0;${/* shown code, line 2: turn starts at 0 */''}
flag[i] = true;                      /* I want in           */${/* shown code, line 3: I want in */''}
turn = j;                            /* but you go first    */${/* shown code, line 4: but you go first */''}
while (flag[j] &amp;&amp; turn == j) ;   /* you want in AND it is your turn */${/* shown code, line 5: wait while you want in and it is your turn */''}
/* critical section */${/* shown code, line 6: the critical section */''}
flag[i] = false;</pre>${/* shown code, line 7: lower my flag; ends the code box */''}
<p><b>The later writer of <code>turn</code> waits.</b> Each process writes the <i>other’s</i> number, and <code>turn</code> holds one value, so it ends up naming the rival of whoever wrote last. Example: P0 writes <code>turn = 1</code>, then P1 writes <code>turn = 0</code>: P0’s test <code>flag[1] &amp;&amp; turn == 1</code> is false, so P0 enters; P1’s test is true, so P1 waits. This holds in all six orders of the four entry writes.</p>${/* notes paragraph: the later writer of turn waits, with a worked example */''}
<ul>${/* starts the list of Peterson's guarantees */''}
<li><b>Mutual exclusion:</b> if both want in, the later writer of <code>turn</code> finds the other’s flag already up (each process raises its flag before writing <code>turn</code>) and <code>turn</code> naming the other, so it waits until the other lowers its flag.</li>${/* notes item: why mutual exclusion holds */''}
<li><b>No deadlock:</b> both waiting would need <code>turn == 0</code> and <code>turn == 1</code> at once.</li>${/* notes item: why there is no deadlock */''}
<li><b>No starvation:</b> a winner that rushes back sets <code>turn</code> to the waiter’s number, so it waits itself; nobody waits more than one turn.</li>${/* notes item: why there is no starvation */''}
<li>Simpler than Dekker’s and easier to prove.</li>${/* notes item: it is simpler than Dekker's algorithm and easier to prove */''}
</ul>${/* ends the list of Peterson's guarantees */''}
<h3>Scorecard</h3>${/* heading for the scorecard part of the notes */''}
<table>${/* starts the scorecard table */''}
<tr><th>Algorithm</th><th>Mutual exclusion</th><th>No deadlock</th><th>No livelock</th><th>No forced alternation</th><th>Survives halt in remainder</th><th>No busy waiting</th></tr>${/* header row: the algorithm and the six requirements */''}
<tr><td>Attempt 1 (turn only)</td><td>✓</td><td>✓</td><td>✓</td><td>✗</td><td>✗</td><td>✗</td></tr>${/* scorecard row: Attempt 1 */''}
<tr><td>Attempt 2 (look, then flag)</td><td>✗</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✗</td></tr>${/* scorecard row: Attempt 2 */''}
<tr><td>Attempt 3 (flag, then look)</td><td>✓</td><td>✗</td><td>✓</td><td>✓</td><td>✓</td><td>✗</td></tr>${/* scorecard row: Attempt 3 */''}
<tr><td>Attempt 4 (flag, back off)</td><td>✓</td><td>✓</td><td>✗</td><td>✓</td><td>✓</td><td>✗</td></tr>${/* scorecard row: Attempt 4 */''}
<tr><td>Dekker</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✗</td></tr>${/* scorecard row: Dekker */''}
<tr><td>Peterson</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✗</td></tr>${/* scorecard row: Peterson */''}
</table>${/* ends the scorecard table */''}

<h3>Going deeper (optional): the filter algorithm, Peterson for n processes</h3>${/* heading for the optional part of the notes: the filter algorithm */''}
<pre>for (L = 1; L &lt; n; L++) {     /* climb levels 1 .. n-1 */${/* shown code, line 1: climb levels 1 to n-1 */''}
    level[i] = L;             /* like flag             */${/* shown code, line 2: record my level, like a flag */''}
    victim[L] = i;            /* like turn: I came last */${/* shown code, line 3: mark myself as the latest arrival, like turn */''}
    while (victim[L] == i &amp;&amp; some other Pk has level[k] &gt;= L) ;${/* shown code, line 4: wait while I am the latest and someone else is at this level or above */''}
}${/* shown code, line 5: end of the climb loop */''}
/* critical section */${/* shown code, line 6: the critical section */''}
level[i] = 0;</pre>${/* shown code, line 7: drop back to level 0 on the way out; ends the code box */''}
<p>Each level is a Peterson-style contest: the <b>latest arrival</b> (<code>victim[L]</code>) waits while anyone else is at that level or above; a newer arrival releases it. So at most <i>n</i> − L processes get past level L. Example with <i>n</i> = 5: at most 2 get past level 3, and at most 1 past level 4, the last door before the critical section. With <i>n</i> = 2 it is exactly Peterson’s algorithm. It is free of deadlock and starvation, but a process may wait at every level.</p>${/* notes paragraph: how each level holds back its latest arrival, with the n = 5 example */''}

<h3>Going deeper (optional): costs and hidden assumptions</h3>${/* heading for the last optional part of the notes: costs and hidden assumptions */''}
<ul>${/* starts the list of costs and assumptions */''}
<li><b>Busy waiting wastes CPU time:</b> tests wasted = time spinning ÷ time per test. On <b>two CPUs</b> the spinner waits only until the holder leaves: 3 µs in the critical section at 6 ns per test = 3,000 ÷ 6 = 500 useless tests. On <b>one CPU</b> it is far worse: if the holder was switched out inside its critical section, it cannot run while the spinner spins, so the spinner burns its whole time slice (10 ms at 6 ns per test ≈ 1.67 million tests). Short spins are acceptable on multiprocessors; longer waits should block (sleep), as semaphores do (Section 5.4).</li>${/* notes item: busy waiting wastes CPU time, with the two-CPU and one-CPU arithmetic */''}
<li><b>In-order memory is assumed.</b> Real CPUs park writes in a <b>store buffer</b> and let later reads go first; compilers may also reorder. Then in Peterson both processes can write their flags into their buffers, read the other’s flag from memory as false, and both enter. The fix is a <b>memory barrier</b> (fence) between the writes and the test, which forces earlier writes out before any later read, or atomic variables that include one.</li>${/* notes item: store buffers break the in-order assumption, and a memory barrier fixes it */''}
<li><b>A halt inside the critical section</b> (or with a flag up) blocks the other process in every algorithm here; no software rule can prevent that.</li>${/* notes item: a halt inside the critical section blocks the other in every algorithm */''}
</ul>`,  // ends the list and the notes text
  });  // ends the section description passed to Guide.section
})();  // ends the wrapping function and runs it immediately
