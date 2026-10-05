// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   6.6 Dining Philosophers Problem
   Original teaching material. One shared engine (semaphore strategies and
   the monitor) drives every table on the page, so every number a student
   sees is computed by the same code that runs the simulation.
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  /* ---------------------------------------------------------------- engine
     Philosopher i sits at seat i. Its LEFT fork is fork i and its RIGHT fork
     is fork (i + 1) mod 5, so fork k lies between philosophers k - 1 and k.
     Semaphore index 5 is the room semaphore (when a strategy uses one).
     cfg: { kind: 'sem', room: 0 | n, right: [5 flags: picks up right first] }
          { kind: 'mon' }  (the monitor with cwait / csignal handoff)        */
  const N = 5;  // N: the number of philosophers around the table, which is also the number of forks
  const LF = (i) => i;  // LF(i): philosopher i's left fork, which has the same number as its seat
  const RF = (i) => (i + 1) % N;  // RF(i): philosopher i's right fork; % N (remainder after dividing by 5) wraps P4's right fork around to fork 0
  const ALL = [0, 1, 2, 3, 4];  // ALL: the seat numbers 0-4, used whenever the code does something for every philosopher or every fork

  // The list of operations one philosopher runs, in order, forever.
  function semProg(i, cfg) {  // semProg(i, cfg): builds philosopher i's list of operations for the semaphore strategy described by cfg
    const rf = !!(cfg.right && cfg.right[i]);  // rf is true when this strategy makes philosopher i reach for its right fork first; !! turns the value into plain true or false
    const first = rf ? RF(i) : LF(i), second = rf ? LF(i) : RF(i);  // first and second: which fork philosopher i waits for first and which second, swapped when rf is true
    const p = [{ k: 'T' }];  // p starts with the think step; in each entry k names the kind of operation (T think, W semWait, E eat, S semSignal)
    if (cfg.room) p.push({ k: 'W', s: 5 });  // with a room semaphore, the philosopher first waits on semaphore 5 to get a seat at the table
    p.push({ k: 'W', s: first }, { k: 'W', s: second }, { k: 'E' }, { k: 'S', s: second }, { k: 'S', s: first });  // then waits on its first fork and its second, eats, and signals the two forks back in reverse order
    if (cfg.room) p.push({ k: 'S', s: 5 });  // with a room semaphore, the philosopher signals it last, giving its seat back as it leaves the table
    return p;  // hands back the finished list of operations
  }  // ends semProg
  function newSim(cfg) {  // newSim(cfg): creates a fresh simulation in which everyone is thinking and every fork is on the table
    const st = { cfg, mon: cfg.kind === 'mon', moves: 0, meals: [0, 0, 0, 0, 0], since: [0, 0, 0, 0, 0], longest: [0, 0, 0, 0, 0], holder: [-1, -1, -1, -1, -1] };  // st is the whole state: strategy, monitor flag, move count, per-philosopher meals, hunger start and longest wait, and holder[k] = who holds fork k (-1 = table)
    if (st.mon) {  // the monitor version keeps its own state fields
      st.ph = [0, 0, 0, 0, 0];           // 0 thinking, 1 hungry, 2 cwait left, 3 cwait right, 4 eating, 5 done eating
      st.fk = [true, true, true, true, true];  // fk[k] is true while fork k lies free on the table, matching the fork[ ] array in the monitor code
      st.q = [[], [], [], [], []];       // ForkReady[k] condition queues
    } else {  // otherwise this is a semaphore strategy
      st.progs = ALL.map((i) => semProg(i, cfg));  // progs: each philosopher's list of operations, built by semProg
      st.pc = [0, 0, 0, 0, 0];           // index of the operation each philosopher runs next
      st.blk = [-1, -1, -1, -1, -1];     // semaphore it is blocked on, or -1
      st.val = [1, 1, 1, 1, 1, cfg.room || 0];  // val: the semaphore values, 1 for each fork (on the table) and, at index 5, the number of seats in the room (0 when unused)
      st.q = [[], [], [], [], [], []];   // semaphore queues (strong: first in, first out)
    }  // ends the semaphore branch
    return st;  // returns the new state object
  }  // ends newSim
  function clone(st) {  // clone(st): makes an independent copy of a state so the search can try a move without changing the original
    const c = Object.assign({}, st);  // starts with a shallow copy: plain values are copied, but the arrays inside are still shared with the original
    ['meals', 'since', 'longest', 'holder', 'ph', 'fk', 'pc', 'blk', 'val'].forEach((k) => { if (st[k]) c[k] = st[k].slice(); });  // gives the copy its own copy of every array the state has, so changing one never changes the other
    c.q = st.q.map((a) => a.slice());  // copies each wait queue as well, because q is a list of lists
    return c;  // returns the independent copy
  }  // ends clone
  // Everything that matters for the future (not the meal counters).
  const keyOf = (st) => (st.mon ? st.ph.join('') + st.q.map((a) => a.join('')).join('/') + st.holder.join(',')  // keyOf(st): a text fingerprint of a state, so the search can tell states apart; for the monitor it joins phases, queues and fork holders
    : st.pc.join('') + st.blk.join(',') + st.val.join(',') + st.q.map((a) => a.join('')).join('/'));  // for semaphores it joins each philosopher's next operation, who is blocked where, the semaphore values and the queues
  const canAct = (st, i) => (st.mon ? st.ph[i] !== 2 && st.ph[i] !== 3 : st.blk[i] < 0);  // canAct(st, i): true when philosopher i can take a step, which means it is not stuck waiting in a queue
  const stuck = (st) => ALL.every((i) => !canAct(st, i));  // stuck(st): true when nobody can take a step, which is exactly what a deadlock is
  function startMeal(st, i) { st.meals[i]++; st.longest[i] = Math.max(st.longest[i], st.moves - st.since[i]); }  // startMeal(st, i): counts a meal for philosopher i and keeps the longest it has waited, in moves, between getting hungry and eating
  function grant(st, i, s) { if (s < 5) st.holder[s] = i; st.pc[i]++; if (st.progs[i][st.pc[i]].k === 'E') startMeal(st, i); }  // grant(st, i, s): philosopher i's semWait on s succeeds, so it takes the fork, moves to its next operation, and starts a meal if that is eating

  // One move by philosopher i. Returns a small event record for narration.
  function act(st, i) {  // act(st, i): philosopher i takes its next step, changing st; the buttons, the scripted demos and the search all use it
    st.moves++;  // counts the move; waiting times in the statistics are measured in moves
    if (st.mon) {  // the monitor version follows the get_forks and release_forks procedures
      const L = LF(i), R = RF(i), ev = { who: i, mon: true, handed: [] };  // L and R are this philosopher's left and right forks; ev collects what happened so it can be described in words
      const tryRight = (w) => {  // tryRight(w): philosopher w, already holding its left fork, tries to take its right fork as well
        const r = RF(w);  // r is w's right fork
        if (!st.fk[r]) { st.q[r].push(w); st.ph[w] = 3; return 'waitR'; }  // if the right fork is in use, w waits in that fork's ForkReady queue (phase 3) while still holding its left fork
        st.fk[r] = false; st.holder[r] = w; st.ph[w] = 4; startMeal(st, w); return 'eat';  // otherwise w takes the right fork, is recorded as its holder and starts eating
      };  // ends tryRight
      if (st.ph[i] === 0) { st.ph[i] = 1; st.since[i] = st.moves; ev.k = 'hungry'; }  // thinking (phase 0) becomes hungry (phase 1); since remembers the move when the hunger started
      else if (st.ph[i] === 1) {  // a hungry philosopher calls get_forks
        if (!st.fk[L]) { st.q[L].push(i); st.ph[i] = 2; ev.k = 'waitL'; }  // if its left fork is in use, it waits in that fork's ForkReady queue (phase 2) holding no fork at all
        else { st.fk[L] = false; st.holder[L] = i; ev.k = tryRight(i); }  // otherwise it takes the left fork and, in the same visit to the monitor, tries for the right one
      } else if (st.ph[i] === 4) { st.ph[i] = 5; ev.k = 'full'; }  // an eating philosopher (phase 4) finishes its meal (phase 5)
      else if (st.ph[i] === 5) {  // a philosopher that has finished eating calls release_forks
        ev.k = 'release';  // records the kind of move for the narration
        [L, R].forEach((f) => {  // handles the left fork first, then the right fork
          st.holder[f] = -1;  // the fork leaves this philosopher's hand
          if (!st.q[f].length) { st.fk[f] = true; return; }  // if nobody is waiting for it, it goes back on the table (fk true) and this fork is done
          const w = st.q[f].shift();  // otherwise w is the first philosopher waiting for it; shift removes the front of the queue
          st.holder[f] = w;  // csignal hands the fork straight to w, so it never lies on the table where someone else could grab it
          const res = st.ph[w] === 2 ? tryRight(w) : (st.ph[w] = 4, startMeal(st, w), 'eat');  // w waiting for its left fork now tries for its right; w waiting for its right fork now has both and starts eating
          ev.handed.push({ f, w, res });  // records the handoff (which fork, to whom, and what happened next) for the narration
        });  // ends the loop over the two forks
        st.ph[i] = 0;  // the philosopher goes back to thinking
      }  // ends the release branch
      return ev;  // returns the event record for this monitor move
    }  // ends the monitor version
    const op = st.progs[i][st.pc[i]], ev = { who: i, op };  // semaphore version: op is philosopher i's next operation; ev starts the event record
    if (op.k === 'T') { st.pc[i]++; st.since[i] = st.moves; ev.k = 'hungry'; }  // think step: the philosopher gets hungry and moves on to its first semWait
    else if (op.k === 'W') {  // a semWait operation (W)
      ev.before = st.val[op.s];  // remembers the value before the change so the narration can show it as "before → after"
      st.val[op.s]--;  // semWait always subtracts 1 from the semaphore
      if (st.val[op.s] < 0) { st.q[op.s].push(i); st.blk[i] = op.s; ev.k = 'block'; }  // a negative result means nothing was available, so the philosopher joins the semaphore's queue and blocks
      else { grant(st, i, op.s); ev.k = 'got'; ev.eats = st.progs[i][st.pc[i]].k === 'E'; }  // otherwise the wait succeeds; eats is true when the philosopher can now start eating
    } else if (op.k === 'E') { st.pc[i]++; ev.k = 'full'; }  // eat step: the meal ends and the philosopher moves on to signalling its forks back
    else {  // otherwise the operation is a semSignal (S)
      ev.before = st.val[op.s];  // remembers the value before the change for the narration
      st.val[op.s]++;  // semSignal always adds 1 to the semaphore
      if (op.s < 5) st.holder[op.s] = -1;  // for a fork semaphore (not the room), the fork leaves the philosopher's hand
      if (st.val[op.s] <= 0) {  // a result of 0 or below means somebody is waiting in this semaphore's queue
        const w = st.q[op.s].shift();  // w is the first philosopher in that queue: a strong semaphore wakes waiters first in, first out
        st.blk[w] = -1; grant(st, w, op.s);  // the woken philosopher is no longer blocked, and its semWait now succeeds: it gets the fork and moves on
        ev.woke = w; ev.wokeEats = st.progs[w][st.pc[w]].k === 'E';  // records who woke up, and whether it can start eating right away, for the narration
      }  // ends the wake-up branch
      st.pc[i]++;  // the signalling philosopher moves on to its next operation
      ev.k = 'put';  // records the kind of move as putting something down
    }  // ends the semSignal branch
    if (st.pc[i] >= st.progs[i].length) st.pc[i] = 0;  // after the last operation the program starts over at the think step, so each philosopher cycles forever
    return ev;  // returns the event record for this semaphore move
  }  // ends act

  // What a philosopher is doing right now, for colours and labels.
  function phase(st, i) {  // phase(st, i): one word for what philosopher i is doing now (think, hungry, blocked, eat, done), used for colours and labels
    if (st.mon) return ['think', 'hungry', 'blocked', 'blocked', 'eat', 'done'][st.ph[i]];  // monitor: looks the phase number up in a list; both waiting phases (2 and 3) show as blocked
    if (st.blk[i] >= 0) return 'blocked';  // semaphores: anyone stuck in a queue is blocked
    const p = st.progs[i], e = p.findIndex((o) => o.k === 'E');  // p is the philosopher's list of operations; e is the position of its eat step
    if (st.pc[i] === 0) return 'think';  // at the very start of its list the philosopher is still thinking
    if (st.pc[i] < e) return 'hungry';  // past thinking but not yet at the eat step: it is hungry and collecting what it needs
    return st.pc[i] === e ? 'eat' : 'done';  // at the eat step it is eating; after it, it is done and putting things back
  }  // ends phase
  const waitsFor = (st, i) => (st.mon ? (st.ph[i] === 2 ? LF(i) : st.ph[i] === 3 ? RF(i) : -1) : st.blk[i]);  // waitsFor(st, i): the fork (or 5 for the room) philosopher i is waiting for, or -1 when it is not waiting
  const eatingCount = (st) => ALL.filter((i) => phase(st, i) === 'eat').length;  // eatingCount(st): how many philosophers are eating at this moment

  /* Model checking: breadth-first search over every reachable state (every
     possible order of moves). Reports whether some state has nobody able to
     move, the shortest list of moves that reaches it, the number of states
     explored and the most philosophers ever eating at the same moment.   */
  const searchCache = new Map();  // searchCache remembers each finished search by strategy, so the slow full search runs only once per strategy
  function search(cfg) {  // search(cfg): explores every order in which the philosophers could move under strategy cfg (breadth-first: all 1-move states, then 2-move, and so on)
    const ck = JSON.stringify(cfg);  // ck: the strategy written out as text, used as the cache key
    if (searchCache.has(ck)) return searchCache.get(ck);  // a strategy that was already searched returns its saved answer at once
    const start = newSim(cfg), seen = new Map([[keyOf(start), null]]), queue = [start];  // start is the opening state; seen maps each state key to how it was reached (null for the start); queue holds states still to explore
    let head = 0, maxEat = 0, res = null;  // head points at the next state to explore; maxEat is the most diners at once so far; res is set if a deadlock turns up
    while (head < queue.length && !res) {  // keeps exploring until every reachable state is done or a deadlock has been found
      const st = queue[head++], k0 = keyOf(st);  // takes the next state off the front of the queue; k0 is its key
      maxEat = Math.max(maxEat, eatingCount(st));  // keeps the largest number of philosophers seen eating at the same time
      if (stuck(st)) {  // a state where nobody can move is a deadlock
        const path = [];  // path will list, in order, the philosophers whose moves lead from the start to this deadlock
        let k = k0;  // k starts at the deadlocked state's key
        while (seen.get(k)) { path.unshift(seen.get(k)[1]); k = seen.get(k)[0]; }  // walks back to the start through the seen records, putting each move at the front of the path
        res = { deadlock: true, path };  // records the deadlock; breadth-first order means this path is the shortest possible one
        break;  // stops the search
      }  // ends the deadlock check
      for (const i of ALL) {  // tries every philosopher as the next mover
        if (!canAct(st, i)) continue;  // skips philosophers who cannot move in this state
        const n = clone(st);  // n is a copy of the state, so the original stays as it was for the other choices
        act(n, i);  // makes philosopher i's move on the copy
        const k = keyOf(n);  // k is the key of the state that move leads to
        if (!seen.has(k)) { seen.set(k, [k0, i]); queue.push(n); }  // a state never seen before is recorded with how it was reached (state k0, mover i) and queued to be explored
      }  // ends the loop over movers
    }  // ends the search loop
    const out = Object.assign({ deadlock: false, path: null }, res, { states: seen.size, maxEat });  // out: the answer, by default no deadlock, replaced by the deadlock result if one was found, plus the states explored and maxEat
    searchCache.set(ck, out);  // saves the answer in the cache for next time
    return out;  // returns the answer
  }  // ends search

  // A seeded random scheduler: each move, one philosopher that is able to move.
  function rng(seed) {  // rng(seed): a small seeded random-number generator; the same seed always gives the same sequence, so a demo run can be repeated exactly
    let a = seed >>> 0;  // a is the generator's hidden number, started from the seed and kept as a whole 32-bit value by >>> 0
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };  // each call advances a and scrambles its bits into a fraction from 0 up to (not including) 1
  }  // ends rng
  function pickMover(st, rnd) {  // pickMover(st, rnd): the random scheduler; chooses one philosopher who is able to move
    const ok = ALL.filter((i) => canAct(st, i));  // ok lists every philosopher who can move right now
    return ok.length ? ok[Math.floor(rnd() * ok.length)] : -1;  // picks one of them at random, or returns -1 when nobody can move
  }  // ends pickMover

  /* ---------------------------------------------------------------- the table
     Seats go anticlockwise on screen so that, for a philosopher facing the
     table, fork i is on its left hand and fork (i + 1) mod 5 on its right.  */
  const CX = 220, CY = 200, RP = 156, RT = 110;  // sizes for the drawing: CX, CY is the centre of the table, RP the distance from the centre to each philosopher, RT the table's radius
  const rad = (d) => (d * Math.PI) / 180;  // rad(d): converts degrees to radians, the angle unit the math functions use
  const seatAng = (i) => -90 - 72 * i;  // seatAng(i): the angle of seat i; P0 is at the top (-90 degrees), and each next seat is 72 degrees further anticlockwise
  const forkAng = (k) => seatAng(k) + 36;  // forkAng(k): fork k sits halfway (36 degrees) between seat k and seat k - 1
  const at = (r, a) => [CX + r * Math.cos(rad(a)), CY + r * Math.sin(rad(a))];  // at(r, a): the x, y point at distance r and angle a from the table's centre
  const STATE_WORD = { think: 'thinking', hungry: 'hungry', blocked: 'blocked', eat: 'eating', done: 'done' };  // STATE_WORD: the word written under each philosopher for each phase
  const STATE_CLS = { think: 's-panel', hungry: 's-warn', blocked: 's-bad', eat: 's-ok', done: 's-ok' };  // STATE_CLS: the colour class for each phase's circle (grey thinking, amber hungry, red blocked, green eating)
  const STATE_INK = { think: 'var(--ink-2)', hungry: 'var(--warn)', blocked: 'var(--bad)', eat: 'var(--ok)', done: 'var(--ok)' };  // STATE_INK: the text colour for each phase, matching the circle colours

  /* makeTable(ctx, { onPick }) → { svg, update(view) }.
     view = { ph: [{ phase, word, dashed, badge }], holder: [5], arrows: [[from, to]],
              hlPh: [], hlFk: [], sel, dimFk: [] }                            */
  function makeTable(ctx, o = {}) {  // makeTable(ctx, o): draws the round table with its plates, forks and philosophers and returns update() to redraw it for any state
    const { s } = ctx;  // takes the SVG builder s from the step's ctx (the toolbox the guide hands to each step)
    const svg = s('svg', { viewBox: '0 0 440 372', width: '100%', class: 'dp-table' });  // svg: the drawing area, 440 by 372 drawing units, stretched to the full width of its box
    const ring = s('g'), arrows = s('g'), forkLayer = s('g'), phLayer = s('g');  // four layer groups: ring (highlight rings), arrows (who waits for whom), forks and philosophers; later ones are drawn on top
    svg.append(  // adds everything to the drawing, in drawing order
      s('circle', { cx: CX, cy: CY, r: RT, class: 's-panel', 'stroke-width': 2 }),  // the round table top in the middle of the drawing
      ...ALL.map((i) => { const [x, y] = at(84, seatAng(i)); return s('circle', { cx: x, cy: y, r: 15, class: 's-panel', 'stroke-width': 1.5 }); }),  // one plate in front of each seat, closer to the centre than the philosopher
      s('circle', { cx: CX, cy: CY, r: 36, class: 's-io', 'stroke-width': 2 }),  // the bowl in the centre of the table
      s('text', { x: CX, y: CY + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'spaghetti'),  // the word "spaghetti" inside the bowl
      ring, arrows, forkLayer, phLayer);  // then the four layers, philosophers last so they sit above everything; this closes the append
    const forks = ALL.map((k) => {  // forks: builds the five fork figures
      const glyph = s('path', { d: 'M0 14 V-1 M-5 -1 H5 M-5 -1 V-13 M0 -1 V-13 M5 -1 V-13', fill: 'none', 'stroke-width': 2.6, 'stroke-linecap': 'round', class: 'dp-tines' });  // glyph: the fork shape, a handle with a crossbar and three tines, drawn pointing up around its own centre
      const rot = s('g', { class: 'dp-rot' }, glyph);  // rot: a group that turns the fork to face the right way; CSS animates the turn
      const [lx, ly] = at(97, forkAng(k));  // lx, ly: where fork k's label goes, just outside its resting place
      ring.before(s('text', { x: lx, y: ly + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'f' + k));  // adds this fork's label (f0 to f4), inserted just before the layers so it is drawn underneath them
      const g = s('g', { class: 'dp-fork' }, rot);  // g: the outer group that slides the fork to its current position; CSS animates the slide
      forkLayer.append(g);  // puts the fork into the fork layer
      return { g, rot, glyph };  // keeps the three pieces so update() can move, turn and colour this fork
    });  // ends the forks list
    const phs = ALL.map((i) => {  // phs: builds the five philosopher figures
      const [x, y] = at(RP, seatAng(i));  // x, y: where philosopher i sits, on the outer ring at its seat's angle
      const c = s('circle', { cx: x, cy: y, r: 33, 'stroke-width': 2.5 });  // c: the philosopher's circle; update() colours it by phase
      const name = s('text', { x, y: y - 3, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 800 }, 'P' + i);  // name: the bold label P0 to P4, just above the circle's centre
      const word = s('text', { x, y: y + 15, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600 });  // word: the phase word under the name, filled in by update()
      const badgeC = s('circle', { cx: x + 28, cy: y - 26, r: 12, class: 's-accent', 'stroke-width': 1.5 });  // badgeC: a small accent-coloured circle at the philosopher's top right, used as a badge
      const badgeT = s('text', { x: x + 28, y: y - 21.5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 });  // badgeT: the badge's text, centred in that circle
      const badge = s('g', {}, badgeC, badgeT);  // badge: groups the badge circle and text so they can be shown or hidden together
      const g = s('g', { class: 'dp-ph', role: o.onPick ? 'button' : null, tabindex: o.onPick ? 0 : null, 'aria-label': 'Philosopher P' + i }, c, name, word, badge);  // g: the philosopher's group; a clickable table makes it a keyboard-reachable button with a spoken name (null leaves those attributes off)
      if (o.onPick) {  // only when the caller passed onPick, the function to run when a philosopher is chosen
        g.addEventListener('click', () => o.onPick(i));  // a click on the philosopher calls onPick with its seat number
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.onPick(i); } });  // Enter or Space does the same from the keyboard; preventDefault stops Space from scrolling the page
      }  // ends the onPick setup
      phLayer.append(g);  // puts the philosopher into the top layer
      return { g, c, word, badge, badgeT, x, y };  // keeps the pieces update() changes, plus the centre point used by highlights and arrows
    });  // ends the philosophers list
    function update(v) {  // update(v): redraws the table for view v (phases, fork holders, arrows, highlights); runs after every move
      const hlPh = new Set(v.hlPh || []), hlFk = new Set(v.hlFk || []);  // hlPh and hlFk: the philosophers and forks to highlight, as Sets (lists without repeats that are quick to check)
      ring.replaceChildren(  // clears the highlight layer and refills it
        ...[...hlPh].map((i) => s('circle', { cx: phs[i].x, cy: phs[i].y, r: 40, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-dasharray': '6 4' })),  // a dashed accent ring around each highlighted philosopher
        ...[...hlFk].map((k) => { const [x, y] = forkPos(k, v.holder[k]); return s('circle', { cx: x, cy: y, r: 19, class: 's-accent', 'stroke-width': 2 }); }));  // an accent circle behind each highlighted fork, wherever that fork is right now; closes the refill
      ALL.forEach((i) => {  // for each philosopher
        const p = v.ph[i], P = phs[i];  // p is its entry in the view; P is its figure on the table
        P.c.setAttribute('class', STATE_CLS[p.phase]);  // colours its circle for its phase
        P.c.setAttribute('stroke-dasharray', p.dashed ? '6 5' : '');  // a dashed outline when the view marks it as away from the table (used by the room strategy)
        P.c.setAttribute('fill-opacity', p.dashed ? 0.45 : 1);  // a philosopher away from the table is also drawn faded
        P.word.textContent = p.word || STATE_WORD[p.phase];  // the word under the name: the view's own word if it gave one, otherwise the usual word for the phase
        P.word.setAttribute('style', 'fill:' + STATE_INK[p.phase]);  // colours that word to match the phase
        P.badge.style.display = p.badge ? '' : 'none';  // shows the badge only when the view gives one
        P.badgeT.textContent = p.badge || '';  // writes the badge text (for example the L or R habit in the asymmetric step)
        P.g.classList.toggle('sel', v.sel === i);  // marks the selected philosopher with the sel class, which CSS draws with a thicker outline
      });  // ends the loop over philosophers
      ALL.forEach((k) => {  // for each fork
        const h = v.holder[k], F = forks[k];  // h is who holds it (-1 for nobody); F is its figure
        const [x, y] = forkPos(k, h);  // x, y: where the fork should be now, on the table or in its holder's hand
        const a = h < 0 ? forkAng(k) : seatAng(h) + (h === k ? 17 : -17);  // a: the angle the fork should face; a held fork sits 17 degrees to the left-hand or right-hand side of its holder's seat
        F.g.style.transform = `translate(${x}px, ${y}px)`;  // slides the fork to x, y; CSS animates the move so students see it travel
        F.rot.style.transform = `rotate(${a + 90}deg)`;  // turns the fork so its tines point outward along angle a (the drawing points up, hence the extra 90 degrees)
        F.glyph.setAttribute('style', 'stroke:' + (h < 0 ? 'var(--ink-2)' : STATE_INK[v.ph[h].phase]));  // a fork on the table is grey; a held fork takes its holder's colour, so a blocked holder's fork shows red
        F.g.style.opacity = (v.dimFk || []).includes(k) ? 0.35 : 1;  // forks the view lists as dimmed are faded to 35%
      });  // ends the loop over forks
      arrows.replaceChildren(...(v.arrows || []).map(([a, b]) => {  // redraws the wait-for arrows: one curved red arrow from each waiting philosopher to the one holding what it needs
        const A = phs[a], B = phs[b];  // A is the waiting philosopher, B the one it waits for
        const mid = (seatAng(a) + seatAng(b)) / 2 + (Math.abs(seatAng(a) - seatAng(b)) > 180 ? 180 : 0);  // mid: the angle halfway between the two seats, taking the short way round when they straddle the top of the circle
        const [qx, qy] = at(196, mid);  // qx, qy: the point the arrow bends toward, outside the ring of philosophers so it curves around the edge
        const trim = (P, Q) => { const dx = Q[0] - P.x, dy = Q[1] - P.y, d = Math.hypot(dx, dy); return [P.x + (dx / d) * 37, P.y + (dy / d) * 37]; };  // trim(P, Q): moves the arrow's end from philosopher P's centre to just past the edge of its circle, in the direction of Q
        const p1 = trim(A, [qx, qy]), p2 = trim(B, [qx, qy]);  // p1 and p2: where the arrow starts (A's edge) and ends (B's edge)
        return s('path', { d: `M${p1[0]} ${p1[1]} Q${qx} ${qy} ${p2[0]} ${p2[1]}`, fill: 'none', stroke: 'var(--bad)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-bad)' });  // a curved path (Q is a quadratic curve) in red with the guide's shared red arrowhead at its end
      }));  // ends the arrow list
    }  // ends update
    function forkPos(k, h) {  // forkPos(k, h): where fork k is drawn when held by h
      if (h < 0) return at(72, forkAng(k));  // a fork nobody holds rests on the table, near the bowl, at its own angle
      return at(117, seatAng(h) + (h === k ? 17 : -17));  // a held fork sits between the table edge and its holder, on the side of the hand that holds it
    }  // ends forkPos
    return { svg, update };  // hands back the drawing and its update function
  }  // ends makeTable

  // The table view of an engine state (optionally with the wait-for arrows).
  function viewOf(st, extra = {}) {  // viewOf(st, extra): turns an engine state into a view for update(); extra adds or overrides fields such as the selected philosopher
    const holder = st.holder.slice();  // holder: a copy of who holds each fork
    const ph = ALL.map((i) => {  // ph: one entry per philosopher
      const p = { phase: phase(st, i) };  // starts each entry with the philosopher's phase
      if (!st.mon && st.cfg.room && p.phase !== 'think') {  // with the room strategy, a philosopher who is not thinking may still be outside the room
        const seated = st.pc[i] > 1 && !(st.blk[i] === 5);  // seated: it has got past semWait(room) (operation 1, counting from 0) and is not blocked on the room semaphore
        if (!seated) { p.dashed = true; p.word = st.blk[i] === 5 ? 'no seat' : 'hungry'; }  // not seated yet: drawn dashed, with "no seat" if it is waiting at the door, otherwise "hungry"
      }  // ends the room check
      return p;  // returns this philosopher's entry
    });  // ends the entries
    if (!st.mon && st.cfg.room) ALL.forEach((i) => { if (ph[i].phase === 'think') ph[i].dashed = true; });  // with the room strategy, thinking philosophers are also away from the table, so they are drawn dashed too
    const arrows = [];  // arrows: the wait-for arrows to draw
    if (extra.arrows !== false) ALL.forEach((i) => { const f = waitsFor(st, i); if (f >= 0 && f < 5 && holder[f] >= 0) arrows.push([i, holder[f]]); });  // unless extra.arrows is false, adds an arrow from each philosopher waiting for a fork to whoever holds that fork
    return Object.assign({ ph, holder, arrows }, extra);  // returns the view with extra's fields laid on top
  }  // ends viewOf

  // On a phone, long code lines wrap with a hanging indent instead of hiding their comments off to the right.
  const fitCode = (ctx, code) => { if (ctx.narrow) code.classList.add('wrap'); return code; };  // fitCode(ctx, code): on phone-width screens adds the wrap class to a code box, then returns the box
  // ...and the column of spaces that lines the comments up is squeezed to two, so lines wrap naturally.
  const tidy = (ctx, src) => (ctx.narrow ? src.replace(/ {3,}\/\//g, '  //') : src);  // tidy(ctx, src): on phone-width screens shrinks any run of 3 or more spaces before // to two spaces
  const LEGEND = '<span class="chip">thinking</span><span class="chip warn">hungry</span><span class="chip ok">eating</span><span class="chip bad">blocked</span>';  // LEGEND: HTML for the colour key (thinking, hungry, eating, blocked) shown beside several tables

  /* ---------------------------------------------------------------- narration */
  const semName = (s) => (s === 5 ? 'room' : `fork[${s}]`);  // semName(s): a semaphore's name as written in the code: room for 5, otherwise fork[s]
  const held = (st, i) => ALL.filter((k) => st.holder[k] === i);  // held(st, i): the forks philosopher i is holding right now
  // The label on a philosopher's button: what its next move will do.
  function nextLabel(st, i) {  // nextLabel(st, i): the label on philosopher i's button, saying what its next click will do
    if (st.mon) return ['stop thinking', 'get_forks(' + i + ')', 'waiting', 'waiting', 'finish eating', 'release_forks(' + i + ')'][st.ph[i]];  // monitor: a label for each phase, such as get_forks(2) when hungry and waiting when it is stuck in a queue
    if (st.blk[i] >= 0) return 'blocked on ' + (st.blk[i] === 5 ? 'room' : 'f' + st.blk[i]);  // semaphores: a blocked philosopher's button says what it is blocked on
    const op = st.progs[i][st.pc[i]];  // op is the philosopher's next operation
    return op.k === 'T' ? 'stop thinking' : op.k === 'E' ? 'finish eating' : (op.k === 'W' ? 'semWait(' : 'semSignal(') + (op.s === 5 ? 'room' : 'f' + op.s) + ')';  // think step, eat step, or the exact semWait or semSignal call with its fork or the room
  }  // ends nextLabel
  function semNarr(st, ev) {  // semNarr(st, ev): writes the sentence (as HTML) that explains the semaphore move just made
    const i = ev.who, P = `<b>P${i}</b>`, op = ev.op;  // i is who moved, P its name in bold, op the operation it ran
    if (ev.k === 'hungry') { const nx = st.progs[i][st.pc[i]]; return `${P} stops thinking and gets hungry. Its next line is <code>semWait(${semName(nx.s)})</code>.`; }  // after a think step: the philosopher is hungry, and the sentence names the semWait it will call next
    if (ev.k === 'full') return `${P} finishes eating. Next it puts its forks down, one <code>semSignal</code> at a time.`;  // after the eat step: it will now put its forks down one by one
    const v = `${semName(op.s)}: ${ev.before} → ${ev.k === 'put' ? ev.before + 1 : ev.before - 1}`;  // v: the semaphore's change written as "name: before → after"
    if (ev.k === 'got' && op.s === 5) return `${P} calls <code>semWait(room)</code> (${v}). A seat is free, so ${P} sits down at the table.`;  // semWait(room) succeeded: there was a free seat
    if (ev.k === 'got') {  // semWait on a fork succeeded
      const h = held(st, i);  // h lists the forks it now holds
      return `${P} calls <code>semWait(fork[${op.s}])</code> (${v}). Fork f${op.s} was on the table, so ${P} picks it up. ` + (ev.eats ? `Holding f${h[0]} and f${h[1]}, it <b>starts eating</b>.` : 'It holds one fork and reaches for the other next.');  // it picks the fork up; then either it holds both and starts eating, or it reaches for the other one next
    }  // ends the successful-pick-up case
    if (ev.k === 'block' && op.s === 5) return `${P} calls <code>semWait(room)</code> (${v}). Every seat is taken, so ${P} <b>waits at the door</b> in the room queue.`;  // semWait(room) blocked: every seat is taken, so the philosopher waits at the door
    if (ev.k === 'block') {  // semWait on a fork blocked
      const h = held(st, i);  // h lists the forks it is holding while it waits
      return `${P} calls <code>semWait(fork[${op.s}])</code> (${v}). The value is negative: f${op.s} is in P${st.holder[op.s]}’s hand, so ${P} <b>blocks</b>` + (h.length ? `, still holding f${h[0]}.` : '.');  // the value went negative because a neighbour holds the fork, so the philosopher blocks, still holding any fork it already had
    }  // ends the blocked case
    let msg = `${P} calls <code>semSignal(${semName(op.s)})</code> (${v})` + (op.s === 5 ? ' and leaves the table.' : ` and puts f${op.s} down.`);  // otherwise it was a semSignal: it gives back the seat or puts the fork down
    if (ev.woke != null) msg += op.s === 5 ? ` P${ev.woke} was waiting at the door, so it sits down.` : ` P${ev.woke} was blocked waiting for f${op.s}, so its <code>semWait</code> completes and it picks the fork up` + (ev.wokeEats ? ' and <b>starts eating</b>.' : '.');  // if the signal woke someone, adds who it was and whether that philosopher now starts eating
    if (st.pc[i] === 0) msg += ` ${P} goes back to thinking.`;  // if this was its last operation, adds that the philosopher goes back to thinking
    return msg;  // returns the finished sentence
  }  // ends semNarr
  function monNarr(st, ev) {  // monNarr(st, ev): writes the sentence (as HTML) that explains the monitor move just made
    const i = ev.who, P = `<b>P${i}</b>`, L = LF(i), R = RF(i);  // i is who moved, P its name in bold, L and R its left and right forks
    if (ev.k === 'hungry') return `${P} stops thinking and gets hungry. Next it calls <code>get_forks(${i})</code>.`;  // after thinking: it is hungry and will call get_forks next
    if (ev.k === 'full') return `${P} finishes eating. Next it calls <code>release_forks(${i})</code>.`;  // after eating: it will call release_forks next
    if (ev.k === 'waitL') return `${P} enters the monitor. Its left fork f${L} is in use (fork[${L}] is false), so it calls <code>cwait(ForkReady[${L}])</code> holding <b>nothing</b>. Waiting releases the monitor, so others can come in.`;  // left fork busy: it waits in that fork's queue holding nothing, and waiting lets others into the monitor
    if (ev.k === 'waitR') return `${P} enters the monitor and takes its left fork f${L}. Its right fork f${R} is in use, so it calls <code>cwait(ForkReady[${R}])</code>, holding f${L}. Note the order: P${R} picked up f${R} <b>before</b> P${i} took f${L}.`;  // right fork busy: it waits holding its left fork, and the sentence points out why this cannot close a circle
    if (ev.k === 'eat') return `${P} enters the monitor. Fork f${L} is free, so it takes it; in the <b>same visit</b> it finds f${R} free too and takes it. No one could slip in between. ${P} <b>starts eating</b>.`;  // both forks free: it takes them in one visit to the monitor, so no one can grab one in between
    let msg = `${P} calls <code>release_forks(${i})</code>.`;  // otherwise it was release_forks; the sentence goes on fork by fork
    [L, R].forEach((f) => {  // for the left fork, then the right fork
      const hd = ev.handed.find((x) => x.f === f);  // hd is the handoff record for this fork, if someone was waiting for it
      if (!hd) { msg += ` Nobody waits in ForkReady[${f}], so f${f} goes back on the table.`; return; }  // nobody waiting: the fork goes back on the table
      msg += ` P${hd.w} waits in ForkReady[${f}], so <code>csignal</code> <b>hands f${f} straight to P${hd.w}</b>` + (hd.res === 'eat' ? ', which starts eating.' : `, which then finds f${RF(hd.w)} busy and waits for it.`);  // someone waiting: csignal hands the fork to that philosopher, who then either eats or waits for its other fork
    });  // ends the loop over the two forks
    return msg;  // returns the finished sentence
  }  // ends monNarr
  // If nobody can move, a sentence that names every link in the circle.
  function deadlockText(st) {  // deadlockText(st): the message shown when nobody can move, naming who waits for whom all the way round
    const links = ALL.map((i) => { const f = waitsFor(st, i); return f === 5 ? `P${i} for a seat` : `P${i} for P${st.holder[f]} (f${f})`; });  // links: one phrase per philosopher, such as "P1 for P2 (f2)", or "P1 for a seat" when it waits on the room
    return '<b>Deadlock.</b> All five are blocked in a circle: ' + links.join(', ') + '. Each waits for a neighbour who is waiting too, so no fork will ever be put down.';  // puts the links together into one red message
  }  // ends deadlockText

  /* makeHand(ctx, o): a table the student drives by hand.
     o = { cfg, code (ui.code element), lineOf(st, i), onMove(st, ev), onPaint(st, sel), intro }  */
  function makeHand(ctx, o) {  // makeHand(ctx, o): builds a table with one button per philosopher, used by every hands-on step of this section
    const { h } = ctx;  // takes the HTML builder h from ctx
    let st, sel = -1, gen = 0;  // st is the simulation state; sel the philosopher who moved last (-1 for none); gen counts actions so a running demo knows it was interrupted
    const table = makeTable(ctx, { onPick: (i) => { gen++; move(i); } });  // the table drawing; clicking a philosopher on it stops any demo and makes that philosopher move
    const btns = h('div', { class: 'pbtns' });  // btns: the row of five philosopher buttons under the table
    if (ctx.narrow) btns.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';  // on phone-width screens the buttons go three to a row so their labels still fit
    const narr = h('div', { class: 'narr' });  // narr: the box where each move is explained in words
    const semRow = h('div', { class: 'semrow' });  // semRow: the row of chips showing the current semaphore values (or the monitor's fork[ ] array)
    function say(html, tone) { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; }  // say(html, tone): writes a message in narr; tone (ok, warn or bad) colours its border and background
    function paint() {  // paint(): redraws everything (table, buttons, value chips, code highlight) from the current state
      const v = viewOf(st, { sel });  // v: the table view for this state, with the last mover selected
      if (o.decorate) o.decorate(v, st);  // lets the step add extra marks (such as the L and R badges) before drawing
      table.update(v);  // redraws the table
      btns.replaceChildren(...ALL.map((i) => {  // rebuilds the five buttons
        const ok = canAct(st, i), ph = phase(st, i);  // ok: whether this philosopher can move; ph: its phase
        const cls = 'btn sm ' + (ph === 'eat' || ph === 'done' ? 'mem' : ph === 'blocked' ? '' : ph === 'hungry' ? 'io' : 'proc');  // button colour by phase: green eating or done, plain blocked, orange hungry, teal thinking
        return h('button', { class: cls + (sel === i ? ' on' : ''), type: 'button', disabled: !ok, 'aria-label': `P${i}: ${nextLabel(st, i)}`, onclick: () => { gen++; move(i); } },  // the button: highlighted if it just moved, greyed out when it cannot move, and its click stops any demo and makes the move
          h('b', {}, 'P' + i), h('span', {}, nextLabel(st, i)));  // inside it: the philosopher's name in bold and what its next step will do
      }));  // ends the buttons
      if (st.mon) {  // for the monitor, the chips show the fork[ ] array
        semRow.replaceChildren(h('span', { class: 'small b' }, 'fork[ ]:'), ...ALL.map((k) => h('span', { class: 'chip ' + (st.fk[k] ? 'ok' : 'warn') }, `${k}: ${st.fk[k] ? 'true' : 'false'}`)));  // one chip per fork, green "true" when it is on the table, amber "false" when in a hand
      } else {  // for semaphores, the chips show the semaphore values
        const chips = ALL.map((k) => h('span', { class: 'chip ' + (st.val[k] > 0 ? 'ok' : st.val[k] < 0 ? 'bad' : 'warn'), title: 'semaphore fork[' + k + ']' }, `f${k} = ${st.val[k]}`));  // one chip per fork semaphore: green above 0, amber at 0, red below 0 (someone is waiting)
        if (st.cfg.room) chips.push(h('span', { class: 'chip os' }, `room = ${st.val[5]}`));  // with a room semaphore, adds a purple chip with the number of free seats
        semRow.replaceChildren(...(st.cfg.room || o.semLabel === false ? [] : [h('span', { class: 'small b' }, 'Semaphores:')]), ...chips);  // puts the chips in the row, with a "Semaphores:" label unless the room is shown or the step turned the label off
      }  // ends the chips
      if (o.code) {  // when the step shows a code listing next to the table
        o.code.clear();  // removes the old line highlight
        if (sel >= 0) o.code.mark([o.lineOf(st, sel)], { blocked: 'bad', eat: 'ok' }[phase(st, sel)] || 'cur');  // highlights the line the last mover is at: red if it is blocked, green if it is eating, otherwise the usual colour
      }  // ends the code highlight
      if (o.onPaint) o.onPaint(st, sel);  // lets the step update its own extras after each repaint
    }  // ends paint
    function move(i) {  // move(i): philosopher i takes one step, and the page explains and redraws it
      if (!canAct(st, i)) return;  // does nothing if that philosopher cannot move, for example a blocked one clicked on the table drawing
      sel = i;  // selects it as the last mover
      const ev = act(st, i);  // makes the move in the engine and keeps the event record
      if (stuck(st)) say(deadlockText(st), 'bad');  // if the table is now frozen, shows the deadlock message in red
      else say(st.mon ? monNarr(st, ev) : semNarr(st, ev), ev.k === 'block' || ev.k === 'waitL' || ev.k === 'waitR' ? 'warn' : (ev.k === 'got' && ev.eats) || ev.k === 'eat' ? 'ok' : '');  // otherwise explains the move, amber for blocking or waiting, green for starting to eat, plain for anything else
      paint();  // redraws everything
      if (o.onMove) o.onMove(st, ev);  // lets the step react to the move (counters, checks, and so on)
    }  // ends move
    function reset(cfg, msg) {  // reset(cfg, msg): starts the table over, with a new strategy if cfg is given, and shows msg or the opening message
      gen++;  // stops any demo that is running
      st = newSim(cfg || st.cfg);  // a fresh simulation with the new strategy, or the same one as before
      sel = -1;  // nobody is selected
      say(msg || o.intro || 'Everyone is thinking. Click a philosopher (on the table or below) to make it take its next step.');  // the step's own opening message, or a general one telling the student how to start
      paint();  // redraws everything
    }  // ends reset
    // Plays a list of moves with a pause between them; a click, Reset or leaving the step cancels it.
    async function script(list, ms, msg) {  // script(list, ms, msg): plays a demo; each item in list is one philosopher, or a list of philosophers who move together
      reset(null, msg);  // starts from a fresh table
      const g = ++gen;  // g remembers this demo's number; any click or reset changes gen and so cancels it
      for (const step of list) {  // for each item in the demo
        await ctx.sleep(ms);  // waits ms milliseconds between moves so students can follow along
        if (!ctx.alive || g !== gen) return false;  // quits, reporting false, if the student left the step or did something else in the meantime
        [].concat(step).forEach((i) => move(i));  // makes the move, or each of the moves when the item is a list
      }  // ends the loop over the demo
      return true;  // reports true: the demo played to the end
    }  // ends script
    st = newSim(o.cfg);  // creates the starting state for the strategy the step asked for
    return { table, btns, narr, semRow, say, reset, move, script, paint, get st() { return st; }, get sel() { return sel; }, cancel: () => { gen++; } };  // hands back the pieces and controls; st and sel are getters so callers always read the current values; cancel() stops a demo
  }  // ends makeHand

  Guide.section({  // registers this section with the guide; the object below holds everything the section shows
    id: '6.6',  // the section number, used in links, the progress list and saved progress
    title: 'Dining Philosophers Problem',  // the full title shown at the top of every step
    short: 'Dining philosophers',  // the short name used in the side menu and progress list
    summary: 'Five diners share five forks: watch the obvious solution deadlock, then fix it three different ways.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Describe the dining philosophers setup and the three things any solution must guarantee.',  // objective 1: describe the setup and the three requirements a solution must meet
      'Trace the one-semaphore-per-fork solution and show exactly how it deadlocks, pointing to all four deadlock conditions at the frozen table.',  // objective 2: trace the one-semaphore-per-fork solution into deadlock and spot all four conditions
      'Explain why a room semaphore that admits four diners, or an asymmetric pick-up order, makes deadlock impossible.',  // objective 3: explain the two semaphore fixes, the room of four and the reversed pick-up order
      'Follow the monitor solution with cwait and csignal and explain why its circle of waiting can never close.',  // objective 4: follow the monitor solution and explain why its waiting can never form a circle
      'Tell deadlock freedom apart from starvation freedom using a concrete schedule.',  // objective 5: tell deadlock freedom from starvation freedom with a concrete schedule
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Dining philosophers problem', 'A classic coordination puzzle: five philosophers around a round table share five forks, one between each pair of neighbours, and each needs both of its neighbouring forks to eat. A solution must keep every fork exclusive and be free of deadlock and starvation.'],  // glossary entry: the dining philosophers problem itself and what a solution must guarantee
      ['Hold and wait', 'A deadlock condition: a process keeps the resources it already has while it waits for more.'],  // glossary entry: hold and wait, one of the deadlock conditions
      ['No preemption', 'A deadlock condition: a resource cannot be taken away from the process that holds it; it is only ever handed back voluntarily.'],  // glossary entry: no preemption, the condition that a held resource cannot be taken away
      ['Circular wait', 'A deadlock condition: a closed chain of processes in which each one waits for a resource held by the next one in the chain.'],  // glossary entry: circular wait, a closed chain of processes each waiting on the next
      ['Wait-for graph', 'A drawing with one node per process and an arrow from each blocked process to the process it is waiting for. With single-unit resources, a cycle in it means deadlock.'],  // glossary entry: the wait-for graph and what a cycle in it means
      ['Room semaphore', 'In the dining philosophers solution, a counting semaphore that starts at 4 and limits how many philosophers may sit at the table at once, so a full circle of waiting can never form.'],  // glossary entry: the room semaphore that lets at most four diners sit
      ['Pigeonhole principle', 'If more items than boxes are shared out, some box must get at least two. If all five forks were in the hands of four seated diners, one diner would hold two forks and could eat.'],  // glossary entry: the pigeonhole principle, and how it shows a seated diner must hold two forks
      ['Resource ordering', 'A deadlock-prevention rule: number the resources and make every process request them in increasing order, so no chain of waits can loop back to its start.'],  // glossary entry: resource ordering as a way to prevent deadlock
      ['Asymmetric solution', 'A dining philosophers fix in which at least one philosopher picks up its forks in the opposite order from the others, which breaks the circle of waiting.'],  // glossary entry: the asymmetric solution, where some philosopher reaches the other way first
      ['Handoff', 'Passing a released resource straight to a process that is waiting for it, instead of putting it back where anyone could grab it first.'],  // glossary entry: handoff, passing a released resource straight to a waiter
      ['Deadlock freedom', 'The guarantee that the system never reaches a state where a group of processes waits forever for each other: some process can always make progress.'],  // glossary entry: deadlock freedom
      ['Starvation freedom', 'The stronger guarantee that every process that wants to proceed eventually does. A deadlock-free scheme can still starve one unlucky process.'],  // glossary entry: starvation freedom, the stronger guarantee
      ['Model checking', 'Letting a computer try every possible order of moves from a starting state to prove a property, such as “no deadlock is ever reachable”.'],  // glossary entry: model checking, trying every order of moves to prove a property
    ],  // closes the glossary list
    css: ` /* styles used only by this section; each rule starts with .sec-6-6 so it cannot affect other sections */
      .sec-6-6 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; } /* the narration box: a soft panel with a thick left border in the chapter colour, in easy-to-read text */
      .sec-6-6 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* a red narration box, used for the deadlock message */
      .sec-6-6 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* a green narration box, used when someone starts eating */
      .sec-6-6 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); } /* an amber narration box, used when someone blocks or waits */
      .sec-6-6 .dp-table { display: block; flex: none; } /* the table drawing is a block of fixed size, so a flexible column around it cannot stretch or squash it */
      .sec-6-6 .dp-fork, .sec-6-6 .dp-rot { transition: transform .35s ease, opacity .3s; } /* forks slide and turn smoothly over about a third of a second, so students can see them move between hands */
      .sec-6-6 .dp-ph[role="button"] { cursor: pointer; } /* a clickable philosopher shows the pointing-hand cursor */
      .sec-6-6 .dp-ph[role="button"]:hover circle:first-child, .sec-6-6 .dp-ph.sel circle:first-child { stroke-width: 4; } /* hovering a clickable philosopher, or selecting it, thickens its circle's outline */
      .sec-6-6 .dp-ph:focus { outline: none; } /* removes the browser's default focus box around a philosopher... */
      .sec-6-6 .dp-ph:focus-visible circle:first-child { stroke: var(--accent); stroke-width: 4; } /* ...and instead, when focus came from the keyboard, outlines its circle in the accent colour */
      .sec-6-6 .pbtns { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; } /* the five philosopher buttons sit in five equal columns */
      .sec-6-6 .pbtns .btn { height: auto; min-height: 44px; padding: 3px 4px; flex-direction: column; gap: 0; white-space: normal; line-height: 1.15; font-size: 13px; } /* each button is at least 44px tall (easy to tap), with its name above its next-step label, and lets the text wrap */
      .sec-6-6 .pbtns .btn b { font-size: 14.5px; } /* the philosopher's name on its button is a little larger */
      .sec-6-6 .pbtns .btn span { font-family: var(--mono); font-size: 12.5px; font-weight: 600; } /* the next-step label on each button is in the code font, since it names a code call */
      .sec-6-6 .semrow { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; } /* the semaphore value chips sit in a row that wraps when it runs out of room */
      .sec-6-6 .semrow .chip { font-family: var(--mono); font-size: 13px; } /* each value chip uses the code font */
      .sec-6-6 pre.code { line-height: 1.5; } /* code listings in this section get a little more space between lines */
      .sec-6-6 pre.code.wrap .ln { white-space: pre-wrap; padding-left: 3.4em; text-indent: -3.4em; } /* a wrapping listing (phone-width screens) gives continuation lines a hanging indent, so each code line still reads as one */
      .sec-6-6 .g3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; } /* .g3: three equal columns with small gaps */
      .sec-6-6 pre.code .ln.cur { background: var(--accent-bg); border-left-color: var(--accent); } /* the current line in a listing is highlighted in the accent colour */
      .sec-6-6 .grid-2 > *, .sec-6-6 .mw0 > * { min-width: 0; } /* lets grid children shrink below their content's width, so a long line cannot push the layout off screen */
      .sec-6-6 .grid-5x { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; } /* .grid-5x: five equal columns, one per philosopher */
      .sec-6-6 .grid-5x .btn { padding: 0 4px; } /* buttons in a five-column grid get less side padding so they fit */
      .sec-6-6 .btn.cond.broken { text-decoration: line-through; border-color: var(--ok); color: var(--ok); background: var(--ok-bg); } /* a deadlock-condition button that has been broken is crossed out and turned green */
      .sec-6-6 .grid-3 .btn, .sec-6-6 .grid-4 .btn { white-space: normal; height: auto; min-height: 34px; line-height: 1.2; } /* buttons inside three- and four-column grids may wrap their text onto two lines */
    `,  // end of the section's styles
    steps: [  // the list of steps (pages) in this section
      /* ---------------- 1. Big picture: the table and the rules ---------------- */
      {  // step 1 starts here
        title: 'Five thinkers, five forks, one bowl',  // step 1 title
        kind: 'story',  // kind "story": shown as Big Picture, the overview at the start of a section
        html: `${/* the fixed HTML for step 1 */''}
          <div class="split fill" style="grid-template-columns: minmax(0, 1fr) minmax(0, 470px)">${/* two columns: flexible text on the left, the table on the right at most 470px wide */''}
            <div class="stack" style="gap:10px">${/* the left column stacks the text with small gaps */''}
              <p class="lead m0">Five philosophers share a round table. Each one spends its whole life doing two things, over and over: <b>thinking</b> and <b>eating</b>.</p>${/* opening sentence: the philosophers only think and eat */''}
              <p class="m0">A bowl of spaghetti sits in the middle, a plate in front of each seat, and one fork between each pair of neighbours: five forks in all. The spaghetti is so tangled that a philosopher needs <b>two</b> forks to eat, the one on its left and the one on its right. A fork can be in only one hand at a time, so neighbours compete for the fork they share. This is the <span class="t">dining philosophers problem</span>.</p>${/* paragraph: the table, the five shared forks, the two-fork rule, and the name of the problem */''}
              <div class="card tight stack" style="gap:6px">${/* a card listing what a correct solution has to guarantee */''}
                <b>Your job: invent a ritual every philosopher follows, so that</b>${/* the card's heading: the student's job is to design the ritual */''}
                <div class="row nw gap-s"><span class="chip ok">1</span><span><b>Mutual exclusion:</b> no fork is ever held by two philosophers at once.</span></div>${/* requirement 1: mutual exclusion, a fork in only one hand at a time */''}
                <div class="row nw gap-s"><span class="chip ok">2</span><span><b>No <span class="t">deadlock</span>:</b> the table never freezes with everyone waiting.</span></div>${/* requirement 2: no deadlock */''}
                <div class="row nw gap-s"><span class="chip ok">3</span><span><b>No <span class="t">starvation</span>:</b> every hungry philosopher eats sooner or later.</span></div>${/* requirement 3: no starvation */''}
              </div>${/* ends the requirements card */''}
              <div class="callout why m0" data-label="Why it matters">Swap philosophers for <span class="t">threads</span> and forks for locks. A thread that must lock two bank accounts to move money between them, or two files to copy one into the other, is a philosopher reaching for two forks. Get the ritual wrong and the program freezes.</div>${/* "Why it matters" callout: philosophers stand for threads and forks for locks, as in a two-account money transfer */''}
            </div>${/* ends the left column */''}
            <div class="card white stack" style="gap:6px">${/* the right column: a white card holding the interactive table */''}
              <div class="row" style="justify-content:space-between"><h4 class="m0">The table</h4><span class="xs muted">left and right are from each diner’s own seat</span></div>${/* card header: the title plus a reminder that left and right are seen from each diner's own seat */''}
              <div class="dp-host" style="display:grid;place-items:center"></div>${/* empty box where render() puts the table drawing, centred */''}
              <div class="dp-info small" style="min-height:66px"></div>${/* box under the table for the click explanations; its minimum height stops the layout jumping as the text changes */''}
            </div>${/* ends the table card */''}
          </div>`,  // ends the two columns and the step 1 HTML
        render(el, ctx) {  // render(el, ctx): runs when step 1 opens; lets the student click philosophers and forks to see who shares what
          const host = ctx.$('.dp-host'), info = ctx.$('.dp-info');  // host and info: the two empty boxes from the HTML above
          const st = newSim({ kind: 'sem' });  // st: a fresh state with everyone thinking and every fork on the table; nothing moves in this step
          const t = makeTable(ctx, { onPick: (i) => pickPh(i) });  // t: the table drawing; clicking a philosopher calls pickPh
          t.svg.style.maxHeight = '372px';  // caps the drawing's height so it fits beside the text
          host.append(t.svg);  // puts the drawing into its box
          // Clicking a fork: the two philosophers who share it light up.
          t.svg.querySelectorAll('.dp-fork').forEach((g, k) => {  // for each fork figure on the table (k is the fork number)
            g.setAttribute('role', 'button'); g.setAttribute('tabindex', '0'); g.setAttribute('aria-label', 'Fork f' + k);  // makes the fork act as a button: screen readers announce it, and Tab can reach it
            g.style.cursor = 'pointer';  // shows the pointing-hand cursor over the fork
            const go = () => pickFork(k);  // go: what choosing this fork does
            g.addEventListener('click', go);  // a mouse click chooses it
            g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });  // so do Enter and Space; preventDefault stops Space from scrolling the page
          });  // ends the loop over forks
          function pickPh(i) {  // pickPh(i): highlights philosopher i and its two forks and explains them
            const l = LF(i), r = RF(i), ln = (i + 4) % 5, rn = RF(i);  // l and r: its two forks; ln: the neighbour sharing its left fork (i - 1, wrapping round); rn: the neighbour sharing its right fork
            t.update(viewOf(st, { hlPh: [i], hlFk: [l, r], sel: i }));  // redraws with philosopher i ringed and selected and its two forks circled
            info.innerHTML = `<b>P${i}</b> needs fork <b>f${l}</b> (its left) and fork <b>f${r}</b> (its right). It competes with <b>P${ln}</b> for f${l} and with <b>P${rn}</b> for f${r}. Its two neighbours can never eat while P${i} eats.`;  // explains which two forks it needs, which neighbour it competes with for each, and that both neighbours wait while it eats
          }  // ends pickPh
          function pickFork(k) {  // pickFork(k): highlights fork k and the two philosophers who share it
            const a = (k + 4) % 5, b = k;  // a: the philosopher on one side of fork k (k - 1, wrapping round); b: philosopher k on the other side
            t.update(viewOf(st, { hlPh: [a, b], hlFk: [k] }));  // redraws with both philosophers ringed and the fork circled
            info.innerHTML = `Fork <b>f${k}</b> is the <b>right</b> fork of P${a} and the <b>left</b> fork of P${b}. Only one of them can hold it at a time. With five forks and two per meal, at most two philosophers can eat at the same moment.`;  // explains that this fork is one diner's right fork and the other's left, and why at most two can eat at once
          }  // ends pickFork
          t.update(viewOf(st));  // draws the table in its starting state when the step opens
          info.innerHTML = '<span class="muted">Click a philosopher to see which forks it needs and who it competes with. Click a fork to see who shares it.</span>';  // starting hint in the info box: what to click
        },  // ends render for step 1
      },  // ends step 1

      /* ---------------- 2. The obvious solution, driven by hand ---------------- */
      {  // step 2 starts here
        title: 'First attempt: one semaphore per fork',  // step 2 title
        kind: 'explore',  // kind "explore": a hands-on step where the student drives the table
        core: true,  // core: a key step that counts toward finishing the section
        render(el, ctx) {  // render(el, ctx): runs when step 2 opens; builds the code listing, the clickable table and the demo button
          const { h } = ctx;  // takes the HTML builder h from ctx
          const code = ctx.ui.code(tidy(ctx, `${/* code: a numbered, coloured listing of the one-semaphore-per-fork code; tidy() first squeezes its comment spacing on phone-width screens */''}
semaphore fork[5] = {1, 1, 1, 1, 1}; // 1 = on the table${/* shown code, line 1: five fork semaphores, each starting at 1 (fork on the table) */''}
void philosopher(int i) {        // seat i runs this${/* shown code, line 2: the procedure every philosopher runs, given its seat number */''}
  while (true) {                 // forever:${/* shown code, line 3: the endless loop */''}
    think();                     // uses no fork at all${/* shown code, line 4: thinking, which needs no fork */''}
    semWait(fork[i]);            // take left fork (may block)${/* shown code, line 5: wait for the left fork */''}
    semWait(fork[(i + 1) % 5]);  // take right fork (may block)${/* shown code, line 6: wait for the right fork, the line where the deadlock strikes */''}
    eat();                       // holding both forks${/* shown code, line 7: eating while holding both forks */''}
    semSignal(fork[(i + 1) % 5]); // put right fork back${/* shown code, line 8: put the right fork back */''}
    semSignal(fork[i]);          // put left fork back${/* shown code, line 9: put the left fork back */''}
  }                              // and think again${/* shown code, line 10: end of the loop body */''}
}                                // end of the ritual`), { lang: 'c', fontSize: 13.5 });  // shown code, line 11: end of the procedure; then the listing options (C-style colouring, 13.5px text)
          fitCode(ctx, code);  // on phone-width screens lets the listing's long lines wrap
          const where = h('div', { class: 'xs muted', style: { minHeight: '17px' } });  // where: a small grey line under the code saying which line the last-moved philosopher has reached; its fixed height stops jumps
          const sim = makeHand(ctx, {  // sim: the hand-driven table for this step
            cfg: { kind: 'sem' }, code, lineOf: (st, i) => st.pc[i] + 4,  // uses the plain strategy and this listing; lineOf turns a philosopher's operation number into its code line (think is line 4)
            intro: 'Everyone is thinking and every fork semaphore is 1. Click philosophers to move them one line at a time, or press <b>Everyone grabs left</b>.',  // opening message telling the student how to start
            onPaint: (st, sel) => { where.innerHTML = sel < 0 ? 'The highlighted line will show where the philosopher you last moved is in its code.' : `Highlighted: where <b>P${sel}</b> is now (line ${st.pc[sel] + 4}${phase(st, sel) === 'blocked' ? ', blocked inside semWait' : ''}).`; },  // after each redraw, writes the "where" line: the line number, and whether the philosopher is stuck inside semWait
          });  // ends the options for makeHand
          sim.table.svg.style.maxHeight = ctx.narrow ? '' : '326px';  // caps the drawing's height on larger screens; phone-width screens let it size itself
          // All five get hungry together and each picks up its left fork, then each reaches right.
          const allLeft = () => sim.script([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], 0, 1, 2, 3, 4], 650,  // allLeft(): the demo; each pair like [0, 0] moves one philosopher twice in one beat (hungry, then left fork), then each reaches right
            'Watch: all five get hungry at the same moment, and the scheduler lets each one run just far enough to pick up its <b>left</b> fork…');  // the message shown as the demo starts, 650 ms between beats
          sim.reset();  // starts the table in its opening state
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 440px) minmax(0, 1fr)', gap: '20px' } },  // builds the step: two columns, the table side at most 440px wide and the code side flexible
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: legend, table, buttons and a warning
              h('div', { class: 'row gap-s xs', html: LEGEND }),  // the colour key for the philosopher states
              sim.table.svg, sim.btns,  // the table drawing and the five philosopher buttons
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake' }, 'Believing that correct locking means a correct program. Every fork here is perfectly protected, yet the whole table can still stop forever.')),  // "Common mistake" callout: protecting every fork perfectly still does not stop the whole table from freezing
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: explanation, code, values and narration
              h('p', { class: 'm0', html: 'Give every fork its own <span class="t">semaphore</span> starting at 1. Picking up a fork is <span class="t">semWait</span>; putting it down is <span class="t">semSignal</span>. <code>(i + 1) % 5</code> means “the next seat, wrapping 4 back to 0”.' }),  // paragraph: one semaphore per fork, semWait to pick up, semSignal to put down, and what (i + 1) % 5 means
              code, where, sim.semRow, sim.narr,  // the code listing, the "where" line, the semaphore value chips and the narration box
              h('div', { class: 'row gap-s' },  // a row of controls
                h('button', { class: 'btn sm primary', type: 'button', onclick: allLeft }, '▶ Everyone grabs left'),  // main button: plays the everyone-grabs-left demo
                h('button', { class: 'btn sm', type: 'button', onclick: () => sim.reset() }, 'Reset'),  // Reset button: starts the table over
                h('span', { class: 'small muted' }, 'Neighbours can never eat together. But can the table freeze?')))));  // a teaser question beside the buttons; closes the row, both columns and the layout
        },  // ends render for step 2
      },  // ends step 2

      /* ---------------- 3. The four conditions at the frozen table, and the fixes ---------------- */
      {  // step 3 starts here
        title: 'Why the table froze, and the ways out',  // step 3 title
        kind: 'compare',  // kind "compare": the student compares the four conditions and the possible fixes
        render(el, ctx) {  // render(el, ctx): runs when step 3 opens; shows the frozen table with condition and fix buttons
          const { h } = ctx;  // takes the HTML builder h from ctx
          // Rebuild the frozen table with the engine: everyone takes the left fork, then reaches right.
          const st = newSim({ kind: 'sem' });  // st: a fresh state using the plain one-semaphore-per-fork strategy
          [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 0, 1, 2, 3, 4].forEach((i) => act(st, i));  // plays the deadlock: each philosopher gets hungry and takes its left fork, then each reaches right and blocks
          const cycle = ALL.map((i) => 'P' + i).join(' → ') + ' → P0';  // cycle: the loop written out, "P0 → P1 → P2 → P3 → P4 → P0", for the circular wait text
          const t = makeTable(ctx);  // t: the table drawing, not clickable in this step
          t.svg.style.maxHeight = ctx.narrow ? '' : '330px';  // caps its height on larger screens
          const CONDS = [  // CONDS: the four deadlock conditions, each with what to highlight, how it shows at this table, and how it could be broken
            { name: 'Mutual exclusion', term: 'mutual exclusion', hl: { hlFk: ALL },  // condition 1, mutual exclusion: highlights every fork
              here: 'Each fork is in exactly one hand. A semaphore that starts at 1 lets only one philosopher hold fork k.',  // how it shows here: each fork is in exactly one hand
              fix: 'You cannot drop this one: two people really cannot eat with one fork at the same time. Exclusive use is what keeps the data safe.' },  // why it cannot be given up: sharing a fork at the same moment is impossible
            { name: 'Hold and wait', term: 'hold and wait', hl: { hlPh: ALL },  // condition 2, hold and wait: highlights every philosopher
              here: 'Every philosopher is <b>holding</b> its left fork while it <b>waits</b> for its right one.',  // how it shows here: everyone holds its left fork while waiting for its right one
              fix: 'Make a philosopher take both forks in one step or none at all, or need only one fork. Then nobody holds a fork while waiting.' },  // how to break it: take both forks at once or none, or need only one
            { name: 'No preemption', term: 'no preemption', hl: { hlFk: ALL, hlPh: ALL },  // condition 3, no preemption: highlights every fork and philosopher
              here: 'Nobody may pull a fork out of a neighbour’s hand. A fork comes back only when its holder calls semSignal.',  // how it shows here: a fork can only be given back, never taken
              fix: 'Let a philosopher who cannot get its right fork put the left one back and try later. Danger: if all five do it in step, they pick up and put down forever, busy but never eating. That is <span class="t">livelock</span>.' },  // how to break it: put the left fork back and retry, with the warning that this can turn into livelock
            { name: 'Circular wait', term: 'circular wait', hl: { hlPh: ALL },  // condition 4, circular wait: highlights every philosopher
              here: `The red arrows of the <span class="t">wait-for graph</span> close a loop: ${cycle}. Each one waits for the next.`,  // how it shows here: the red arrows close a loop, written out using cycle
              fix: 'Make the loop impossible: let at most four sit down, or have one philosopher reach for its forks in the opposite order, or check both forks inside one monitor visit.' },  // how to break it: the three loop-breaking fixes
          ];  // closes CONDS
          const FIXES = [  // FIXES: six ways out; breaks is the number of the condition each one breaks (-1: it removes the sharing instead)
            { name: 'More forks', breaks: -1, what: 'Buy five more forks so every philosopher owns a pair. Nothing is shared, so nobody ever waits.', price: 'It dodges the problem instead of solving it. A computer often has exactly one printer, one copy of a record, one lock.' },  // fix: more forks, which sidesteps the problem; its price is that real systems often have only one of a resource
            { name: 'Eat with one fork', breaks: 1, what: 'Change the meal so a single fork is enough. A philosopher needs one resource, so it never holds one while waiting for another.', price: 'It changes the job. Moving money between two accounts genuinely needs both.' },  // fix: eat with one fork, which breaks hold and wait; its price is that it changes the job
            { name: 'Both or neither', breaks: 1, what: 'Pick up both forks in one indivisible step, and only when both are free. Nobody ever holds one fork and waits.', price: 'No deadlock, but an unlucky philosopher can <b>starve</b> if its two neighbours’ meals keep overlapping (a later step shows it).' },  // fix: both or neither, which breaks hold and wait; its price is that a philosopher can starve
            { name: 'Room for four', breaks: 3, what: 'A <span class="t">room semaphore</span> lets at most four philosophers sit down. A circle of waiting needs all five, so it cannot close.', price: 'One more semaphore, and a fifth diner may wait at the door even when a fork is free.' },  // fix: room for four, which breaks circular wait; its price is an extra semaphore and some waiting at the door
            { name: 'One reaches right first', breaks: 3, what: 'At least one philosopher picks up its <b>right</b> fork first (the <span class="t">asymmetric solution</span>). The arrows can no longer all point the same way round.', price: 'Everybody must follow the agreed order, which is <span class="t">resource ordering</span> in disguise.' },  // fix: one philosopher reaches right first, which breaks circular wait; its price is that everyone must keep the agreed order
            { name: 'A monitor', breaks: 3, what: 'Inside a <span class="t">monitor</span>, taking the left fork and checking the right one happen in the same visit, so the all-left pattern cannot form.', price: 'Needs language support for monitors; all fork logic lives in one place, which is also a plus.' },  // fix: a monitor, which breaks circular wait; its price is needing language support
          ];  // closes FIXES
          const detail = h('div', { class: 'card white grow stack', style: { gap: '6px', minHeight: '150px' } });  // detail: the card where the chosen condition or fix is explained
          const condBtns = CONDS.map((c, k) => h('button', { class: 'btn sm cond', type: 'button', onclick: () => showCond(k) }, c.name));  // condBtns: one button per condition, each showing that condition
          const fixBtns = FIXES.map((f, k) => h('button', { class: 'btn sm', type: 'button', onclick: () => showFix(k) }, f.name));  // fixBtns: one button per fix, each showing that fix
          function light(onC, onF) {  // light(onC, onF): switches on the chosen condition button and fix button (-1 for none) and switches off the rest
            condBtns.forEach((b, k) => b.classList.toggle('on', k === onC));  // condition buttons: only number onC stays on
            fixBtns.forEach((b, k) => b.classList.toggle('on', k === onF));  // fix buttons: only number onF stays on
          }  // ends light
          function showCond(k) {  // showCond(k): shows condition k on the frozen table and explains it
            const c = CONDS[k];  // c is the chosen condition
            light(k, -1);  // switches on its button and no fix button
            condBtns.forEach((b) => b.classList.remove('broken'));  // removes any crossed-out marks a fix left on the condition buttons
            t.update(viewOf(st, c.hl));  // redraws the frozen table with this condition's highlights
            detail.innerHTML = `<div class="row gap-s"><span class="chip intr">condition ${k + 1} of 4</span><b style="font-size:18px"><span class="t" data-t="${c.term}">${c.name}</span></b></div>${/* card heading: a red "condition k of 4" chip and the condition's name as a glossary term */''}
              <p class="m0"><b>At this table:</b> ${c.here}</p><p class="m0 small"><b>To break it:</b> ${c.fix}</p>`;  // then how it shows at this table and how to break it; closes the card text
          }  // ends showCond
          function showFix(k) {  // showFix(k): explains fix k and crosses out the condition it breaks
            const f = FIXES[k];  // f is the chosen fix
            light(-1, k);  // switches on its button and no condition button
            condBtns.forEach((b, j) => b.classList.toggle('broken', j === f.breaks));  // crosses out (in green) the condition button this fix breaks, and clears the mark from the others
            t.update(viewOf(st));  // redraws the frozen table without highlights
            const br = f.breaks < 0 ? '<span class="chip warn">nothing is shared any more</span>' : `<span class="chip ok">breaks: ${CONDS[f.breaks].name.toLowerCase()}</span>`;  // br: a chip naming the condition the fix breaks, or saying that nothing is shared any more
            detail.innerHTML = `<div class="row gap-s"><span class="chip accent">fix</span><b style="font-size:18px">${f.name}</b>${br}</div>${/* card heading: a "fix" chip, the fix's name and that chip */''}
              <p class="m0">${f.what}</p><p class="m0 small"><b>The price:</b> ${f.price}</p>`;  // then what the fix does and what it costs; closes the card text
          }  // ends showFix
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 420px) minmax(0, 1fr)', gap: '22px' } },  // builds the step: two columns, the table card at most 420px wide and the controls flexible
            h('div', { class: 'card white stack', style: { gap: '6px' } },  // left column: a white card holding the frozen table
              h('h4', { class: 'm0' }, 'The frozen table from the last step'),  // card heading: this is the table that froze in step 2
              t.svg,  // the table drawing
              h('p', { class: 'small m0', html: `Computed state: every fork semaphore is ${[...new Set(st.val.slice(0, 5))].map((v) => String(v).replace('-', '−')).join(' or ')}, all five are blocked, and the wait-for arrows form one loop: <b>${cycle}</b>.` })),  // a line computed from the engine: the fork semaphore values (with a proper minus sign) and the loop of waiting; closes the card
            h('div', { class: 'stack', style: { gap: '9px' } },  // right column: the explanation and the buttons
              h('p', { class: 'm0', html: 'A <span class="t">deadlock</span> needs all four classic conditions at once. All four are sitting at this table. Click each one, then click a fix to see which condition it removes.' }),  // paragraph: a deadlock needs all four conditions at once, and how to use the buttons
              h('div', { class: 'grid-4', style: { gap: '6px' } }, ...condBtns),  // the four condition buttons in four columns
              h('h4', { class: 'm0', style: { marginTop: '4px' } }, 'Ways out'),  // heading over the fix buttons
              h('div', { class: 'grid-3', style: { gap: '6px' } }, ...fixBtns),  // the six fix buttons in three columns
              detail,  // the card where the chosen condition or fix is explained
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake' }, 'Blaming one philosopher. Every diner here follows the ritual perfectly; the deadlock comes only from the timing, which is why such bugs can hide for months and then strike.'))));  // "Common mistake" callout: no single philosopher is to blame, only the timing; closes the columns and the layout
          showCond(3);  // opens on condition 4, circular wait, with its arrows showing
        },  // ends render for step 3
      },  // ends step 3

      /* ---------------- 4. Predict, then try: the room semaphore ---------------- */
      {  // step 4 starts here
        title: 'Only four at the table: predict, then try',  // step 4 title
        kind: 'predict',  // kind "predict": the student commits to an answer before trying it
        core: true,  // core: a key step that counts toward finishing the section
        render(el, ctx) {  // render(el, ctx): runs when step 4 opens; builds the prediction, the room slider, the table and the model check
          const { h } = ctx;  // takes the HTML builder h from ctx
          let room = 4;  // room: how many seats the room semaphore starts with; the slider changes it
          const code = ctx.ui.code(tidy(ctx, `${/* code: the listing of the room version, squeezed by tidy() on phone-width screens */''}
semaphore fork[5] = {1, 1, 1, 1, 1}; // one per fork${/* shown code, line 1: the five fork semaphores, as before */''}
semaphore room = 4;              // seats at the table${/* shown code, line 2: the room semaphore, starting at 4 seats */''}
void philosopher(int i) {        // seat i runs this${/* shown code, line 3: the procedure every philosopher runs */''}
  while (true) {                 // forever:${/* shown code, line 4: the endless loop */''}
    think();                     // away from the table${/* shown code, line 5: thinking, away from the table */''}
    semWait(room);               // sit down (wait if no seat)${/* shown code, line 6: wait for a seat */''}
    semWait(fork[i]);            // take left fork${/* shown code, line 7: wait for the left fork */''}
    semWait(fork[(i + 1) % 5]);  // take right fork${/* shown code, line 8: wait for the right fork */''}
    eat();                       // holding both forks${/* shown code, line 9: eating */''}
    semSignal(fork[(i + 1) % 5]); // right fork back${/* shown code, line 10: put the right fork back */''}
    semSignal(fork[i]);          // left fork back${/* shown code, line 11: put the left fork back */''}
    semSignal(room);             // stand up, free the seat${/* shown code, line 12: give up the seat */''}
  }                              // and think again${/* shown code, line 13: end of the loop body */''}
}                                // end of the ritual`), { lang: 'c', fontSize: 13 });  // shown code, line 14: end of the procedure; then the listing options (C-style colouring, 13px text)
          fitCode(ctx, code);  // on phone-width screens lets the listing's long lines wrap
          code.style.lineHeight = '1.42';   // 14 lines must still fit once the prediction feedback opens above them
          const roomLine = () => { const ln = code.line(2); if (ln) ln.innerHTML = ln.innerHTML.replace(/(<span class="tk-num">)\d(<\/span>)/, `$1${room}$2`); };  // roomLine(): rewrites the number on code line 2 so the listing always shows the slider's current room value
          const sim = makeHand(ctx, {  // sim: the hand-driven table for this step
            cfg: { kind: 'sem', room }, code, lineOf: (st, i) => st.pc[i] + 5,  // uses the room strategy and this listing; lineOf turns an operation number into its code line (think is line 5)
            intro: 'Dashed outline = not seated. Press <b>Everyone grabs left</b>, or move philosophers by hand and try to freeze the table.',  // opening message: what the dashed outline means and how to start
          });  // ends the options for makeHand
          sim.table.svg.style.maxHeight = ctx.narrow ? '' : '286px';  // caps the drawing's height on larger screens so the whole step fits
          const check = h('div', { class: 'narr', style: { minHeight: '62px' } });  // check: a box for the model checker's verdict
          let route = null;  // route: the shortest list of moves to deadlock, kept so it can be replayed (null when there is none)
          function runCheck() {  // runCheck(): runs the model checker for the current room value and shows the verdict
            const r = search({ kind: 'sem', room });  // r: the search result for this room value
            route = r.deadlock ? r.path : null;  // keeps the route only when a deadlock was found
            check.className = 'narr ' + (r.deadlock ? 'bad' : 'ok');  // red box for a deadlock, green box for none
            check.innerHTML = r.deadlock  // the verdict text depends on the result
              ? `<span class="t" data-t="model checking">Model check</span>, room = ${room}: a deadlock <b>is</b> reachable; the shortest route takes ${r.path.length} moves. Five seats let everyone in, so this is the first attempt again.`  // deadlock reachable: how long the shortest route is, and why five seats is no fix at all
              : `<span class="t" data-t="model checking">Model check</span>, room = ${room}: every possible order of moves tried (${ctx.util.fmt(r.states, 0)} states). <b>No deadlock</b> is reachable; at most ${r.maxEat} eat at once.`;  // no deadlock: how many states were tried (with thousands commas) and the most diners ever eating at once
            routeBtn.disabled = !route;  // the replay button works only when there is a route to replay
          }  // ends runCheck
          const routeBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => route && sim.script(route, 380, 'Playing the shortest route to deadlock that the model checker found…') }, 'Play the route to deadlock');  // routeBtn: replays the model checker's route to deadlock, one move every 380 ms
          const slider = ctx.ui.slider({ label: 'room starts at', min: 1, max: 5, value: room, onInput: (v) => { room = v; roomLine(); sim.reset({ kind: 'sem', room }); runCheck(); } });  // slider for room (1 to 5): moving it updates code line 2, restarts the table with the new value and re-runs the check
          const allLeft = () => sim.script(room >= 5 ? [[0, 0, 0], [1, 1, 1], [2, 2, 2], [3, 3, 3], [4, 4, 4], 0, 1, 2, 3, 4]  // allLeft(): the demo; with five seats each philosopher sits and takes its left fork, then each reaches right
            : [...ALL.map((i) => (i < room ? [i, i, i] : [i, i])), ...ALL.slice(0, room)], 650,  // with fewer seats, the first room philosophers sit and take their left fork, the rest block at the door, then the seated ones reach right
          `All five get hungry at once. Each one tries to sit down and grab its left fork, with room = ${room}…`);  // the message shown as the demo starts, 650 ms between beats
          // The prediction: commit first, then the explanation appears.
          const fb = h('div', { class: 'small', style: { display: 'none' } });  // fb: the feedback under the prediction, hidden until the student answers
          const choose = (yes) => {  // choose(yes): records the student's answer and shows the explanation
            pBtns.forEach((b, k) => { b.disabled = true; b.classList.toggle('on', k === (yes ? 0 : 1)); });  // locks both answer buttons and marks the one the student picked
            fb.style.display = '';  // shows the feedback
            fb.innerHTML = (yes ? '<b style="color:var(--bad)">Not quite: it can never freeze.</b> ' : '<b style="color:var(--ok)">Right.</b> ')  // a red "Not quite" or a green "Right", depending on the answer
              + 'Five forks, four seated diners: if every fork were taken, someone would hold two and be eating (the <span class="t">pigeonhole principle</span>). And the diner whose right-hand neighbour is not seated never waits for its right fork. Someone can always eat, so no deadlock; with first-in-first-out semaphores nobody starves either.';  // the explanation: the pigeonhole argument, why some diner can always eat, and why first-in-first-out semaphores prevent starvation
            ctx.refit();  // re-checks that the step still fits now that the feedback is showing
          };  // ends choose
          const pBtns = [h('button', { class: 'btn sm', type: 'button', onclick: () => choose(true) }, 'Yes, it can still freeze'), h('button', { class: 'btn sm', type: 'button', onclick: () => choose(false) }, 'No, never')];  // pBtns: the two answer buttons, "can still freeze" and "never"
          sim.reset();  // starts the table in its opening state
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 440px) minmax(0, 1fr)', gap: '20px' } },  // builds the step: two columns, the table side at most 440px wide and the rest flexible
            h('div', { class: 'stack', style: { gap: '7px' } },  // left column: key, table, buttons, values and narration
              h('div', { class: 'row gap-s xs', style: { gap: '6px' }, html: LEGEND + '<span class="chip">dashed = not seated</span>' }),  // the colour key plus a chip explaining the dashed outline
              sim.table.svg, sim.btns, sim.semRow, sim.narr),  // the table drawing, the buttons, the semaphore value chips and the narration; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: prediction, code and controls
              h('div', { class: 'card tight stack', style: { gap: '4px' } },  // the prediction card
                h('div', { class: 'row gap-s' }, h('b', { html: 'Predict: <span class="t" data-t="room semaphore">room</span> = 4. Can the table still deadlock?' }), ...pBtns),  // the question with its two answer buttons
                fb),  // the feedback box; closes the card
              code,  // the code listing
              h('div', { class: 'row gap-s' }, h('div', { style: { flex: '1', minWidth: '200px' } }, slider),  // a row of controls, starting with the room slider in a flexible box
                h('button', { class: 'btn sm primary', type: 'button', onclick: allLeft }, '▶ Everyone grabs left'),  // main button: plays the everyone-grabs-left demo with the current room value
                h('button', { class: 'btn sm', type: 'button', onclick: () => sim.reset() }, 'Reset')),  // Reset button; closes the row
              h('div', { class: 'row gap-s' }, h('div', { style: { flex: '1 1 300px', minWidth: 0 } }, check), routeBtn))));  // a row with the model check verdict and the replay button; closes the columns and the layout
          check.innerHTML = 'Model checking…';  // placeholder text while the model check has not run yet
          ctx.after(30, runCheck);  // runs the check 30 ms later, so the step appears first and the search does not hold it up
        },  // ends render for step 4
      },  // ends step 4

      /* ---------------- 5. Asymmetric order = resource ordering ---------------- */
      {  // step 5 starts here
        title: 'Break the circle: someone reaches right first',  // step 5 title
        kind: 'explore',  // kind "explore": a hands-on step where the student sets each philosopher's habit
        render(el, ctx) {  // render(el, ctx): runs when step 5 opens; builds the habit toggles, presets, table and model check
          const { h } = ctx;  // takes the HTML builder h from ctx
          let right = [0, 0, 0, 0, 1];  // right: one flag per philosopher, 1 = reaches right first; it starts with only P4 reaching right
          const code = ctx.ui.code(tidy(ctx, `${/* code: the listing of the asymmetric version, squeezed by tidy() on phone-width screens */''}
semaphore fork[5] = {1, 1, 1, 1, 1}; // one per fork${/* shown code, line 1: the five fork semaphores */''}
void philosopher(int i) {        // seat i runs this${/* shown code, line 2: the procedure every philosopher runs */''}
  int first = i, second = (i + 1) % 5; // left, then right,${/* shown code, line 3: the usual order, left fork first, then right */''}
  if (rightFirst[i])             // unless a right-hander:${/* shown code, line 4: the test for a right-hander */''}
    swap(first, second);         // then right first, then left${/* shown code, line 5: a right-hander swaps the order */''}
  while (true) {                 // forever:${/* shown code, line 6: the endless loop */''}
    think();                     // uses no fork${/* shown code, line 7: thinking */''}
    semWait(fork[first]);        // first fork (may block)${/* shown code, line 8: wait for the first fork */''}
    semWait(fork[second]);       // second fork (may block)${/* shown code, line 9: wait for the second fork */''}
    eat();                       // holding both forks${/* shown code, line 10: eating */''}
    semSignal(fork[second]);     // put them back,${/* shown code, line 11: put the second fork back */''}
    semSignal(fork[first]);      // in reverse order${/* shown code, line 12: put the first fork back */''}
  }                              // and think again${/* shown code, line 13: end of the loop body */''}
}                                // end of the ritual`), { lang: 'c', fontSize: 13 });  // shown code, line 14: end of the procedure; then the listing options (C-style colouring, 13px text)
          fitCode(ctx, code);  // on phone-width screens lets the listing's long lines wrap
          const check = h('div', { class: 'narr', style: { minHeight: '62px' } });  // check: a box for the model checker's verdict
          const sim = makeHand(ctx, {  // sim: the hand-driven table for this step
            cfg: { kind: 'sem', right }, code, lineOf: (st, i) => st.pc[i] + 7, semLabel: false,  // uses the arrangement in right; lineOf turns an operation number into its code line (think is line 7); hides the "Semaphores:" label
            intro: 'The badge on each philosopher is its habit: <b>L</b> reaches left first, <b>R</b> reaches right first. Press <b>All grab first fork</b>.',  // opening message: what the L and R badges mean and how to start the demo
            decorate: (v) => ALL.forEach((i) => { v.ph[i].badge = right[i] ? 'R' : 'L'; }),  // before each redraw, puts an L or R badge on every philosopher to show its habit
          });  // ends the options for makeHand
          sim.table.svg.style.maxHeight = ctx.narrow ? '' : '300px';  // caps the drawing's height on larger screens so the step fits
          const toggles = h('div', { class: 'grid-5x' });  // toggles: the five habit buttons, one per philosopher
          function setRight(r, why) {  // setRight(r, why): switches to habit arrangement r, restarts the table (showing why, if given) and re-runs the model check
            right = r.slice();  // copies the arrangement so later changes cannot alter the caller's list
            sim.reset({ kind: 'sem', right }, why);  // restarts the table with the new arrangement
            toggles.replaceChildren(...ALL.map((i) => h('button', { class: 'btn sm ' + (right[i] ? 'on' : ''), type: 'button', 'aria-pressed': String(!!right[i]), onclick: () => { const n = right.slice(); n[i] = n[i] ? 0 : 1; setRight(n); } }, `P${i}: ${right[i] ? 'R' : 'L'} first`)));  // rebuilds the toggles; each shows "P2: L first" or "R first", reports its state to screen readers, and flips that habit when clicked
            const r2 = search({ kind: 'sem', right });  // r2: the model check for this arrangement
            const nR = right.filter(Boolean).length;  // nR: how many philosophers reach right first
            check.className = 'narr ' + (r2.deadlock ? 'bad' : 'ok');  // red box for a deadlock, green box for none
            check.innerHTML = r2.deadlock  // the verdict text depends on the result
              ? `<span class="t" data-t="model checking">Model check</span>: a deadlock <b>is</b> reachable (shortest route ${r2.path.length} moves). All five reach the ${nR ? 'right' : 'left'} way first, so the circle can close.`  // deadlock reachable: everyone reaches the same way, so the circle can still close
              : `<span class="t" data-t="model checking">Model check</span>: every order of moves tried (${ctx.util.fmt(r2.states, 0)} states), <b>no deadlock</b>. With ${nR} right-hander${nR === 1 ? '' : 's'} and ${5 - nR} left-hander${5 - nR === 1 ? '' : 's'}, the waits cannot all point the same way round.`;  // no deadlock: how many states were tried and how many right-handers and left-handers there are, with correct singular or plural
          }  // ends setRight
          const presets = [  // presets: two ready-made arrangements, each as [button label, habits, explanation]
            ['Fork-number order', [0, 0, 0, 0, 1], 'Lower-numbered fork first. For P0 to P3 that is the left fork; for P4 it is f0, its <b>right</b> fork. That single rule makes P4 the only right-hander.'],  // preset: take the lower-numbered fork first, which makes only P4 a right-hander
            ['Odd seats right', [0, 1, 0, 1, 0], 'P1 and P3 reach right first. P1 and P2 now both reach for f2 <b>first</b> (and P3 and P4 for f4), so the loser holds nothing while it waits.'],  // preset: the odd seats reach right, so pairs of neighbours compete for the same first fork
          ];  // ends presets
          const firstGrab = () => sim.script([...ALL.map((i) => [i, i]), ...ALL], 650, 'All five get hungry together, and each reaches for its <b>first</b> fork…');  // firstGrab(): the demo; each philosopher gets hungry and takes its first fork, then each reaches for its second
          setRight(right);  // applies the starting arrangement: builds the toggles, the table and the first verdict
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 440px) minmax(0, 1fr)', gap: '20px' } },  // builds the step: two columns, the table side at most 440px wide and the rest flexible
            h('div', { class: 'stack', style: { gap: '7px' } },  // left column: key, table, buttons, values and narration
              h('div', { class: 'row gap-s xs', style: { gap: '6px' }, html: LEGEND + '<span class="chip accent">L / R badge</span>' }),  // the colour key plus a chip explaining the L and R badges
              sim.table.svg, sim.btns, sim.semRow, sim.narr),  // the table drawing, the buttons, the value chips and the narration; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: explanation, code and controls
              h('p', { class: 'm0 small', html: 'The deadlock needed every arrow to point the same way round. Let at least one philosopher reach <b>right</b> first (the <span class="t">asymmetric solution</span>). It is <span class="t">resource ordering</span>: number the forks, take the lower number first.' }),  // paragraph: why one right-hander breaks the circle, and how this is resource ordering in disguise
              code,  // the code listing
              toggles,  // the five habit toggles
              h('div', { class: 'row gap-s' },  // a row of controls
                h('button', { class: 'btn sm primary', type: 'button', onclick: firstGrab }, '▶ All grab first fork'),  // main button: plays the all-grab-first-fork demo
                h('button', { class: 'btn sm', type: 'button', onclick: () => sim.reset() }, 'Reset'),  // Reset button
                h('span', { class: 'small muted', style: { marginLeft: 'auto' } }, 'Presets:'),  // a label pushed to the right edge, in front of the preset buttons
                ...presets.map(([lab, r, why]) => h('button', { class: 'btn sm', type: 'button', onclick: () => setRight(r, why) }, lab))),  // one button per preset, each applying its habits and showing its explanation; closes the row
              check)));  // the model check verdict; closes the columns and the layout
        },  // ends render for step 5
      },  // ends step 5

      /* ---------------- 6. The monitor solution with cwait / csignal ---------------- */
      {  // step 6 starts here
        title: 'A monitor that checks both forks in one visit',  // step 6 title
        kind: 'learn',  // kind "learn": a step that teaches new material
        render(el, ctx) {  // render(el, ctx): runs when step 6 opens; builds the three monitor listings, the table and its controls
          const { h } = ctx;  // takes the HTML builder h from ctx
          const C = {  // C: the three code listings of the monitor solution, each squeezed by tidy() on phone-width screens
            get: ctx.ui.code(tidy(ctx, `${/* get: the get_forks listing */''}
monitor dining_controller;       // one philosopher inside at a time${/* shown code, line 1: the monitor, which lets in one philosopher at a time */''}
cond ForkReady[5];               // a waiting line for each fork${/* shown code, line 2: one condition variable (waiting line) per fork */''}
boolean fork[5];                 // true = on the table (all start true)${/* shown code, line 3: the fork[ ] array saying which forks are on the table */''}
void get_forks(int pid) {        // a hungry philosopher calls this${/* shown code, line 4: get_forks, called by a hungry philosopher */''}
  int left = pid;                // my left fork has my number${/* shown code, line 5: the left fork has the philosopher's own number */''}
  int right = (pid + 1) % 5;     // my right fork: the next number${/* shown code, line 6: the right fork is the next number, wrapping round */''}
  if (!fork[left])               // left fork in use?${/* shown code, line 7: tests whether the left fork is in use */''}
    cwait(ForkReady[left]);      // wait in its line, holding nothing${/* shown code, line 8: if so, waits in that fork's line holding nothing */''}
  fork[left] = false;            // take the left fork${/* shown code, line 9: takes the left fork */''}
  if (!fork[right])              // right fork in use?${/* shown code, line 10: tests whether the right fork is in use */''}
    cwait(ForkReady[right]);     // wait for it, holding the left${/* shown code, line 11: if so, waits for it while holding the left fork */''}
  fork[right] = false;           // take the right fork${/* shown code, line 12: takes the right fork */''}
}                                // leave the monitor and eat`), { lang: 'c', fontSize: 13 }),  // shown code, line 13: leaves the monitor to eat; then the listing options (C-style colouring, 13px text)
            rel: ctx.ui.code(tidy(ctx, `${/* rel: the release_forks listing */''}
void release_forks(int pid) {    // called after eating${/* shown code, line 1: release_forks, called after eating */''}
  int left = pid;                // the same two forks${/* shown code, line 2: the left fork, as in get_forks */''}
  int right = (pid + 1) % 5;     // as in get_forks${/* shown code, line 3: the right fork, as in get_forks */''}
  if (empty(ForkReady[left]))    // nobody waiting for my left?${/* shown code, line 4: tests whether anyone waits for the left fork */''}
    fork[left] = true;           // put it back on the table${/* shown code, line 5: if not, the left fork goes back on the table */''}
  else                           // somebody is waiting:${/* shown code, line 6: otherwise... */''}
    csignal(ForkReady[left]);    // hand it straight to them${/* shown code, line 7: ...csignal hands the left fork straight to the waiter */''}
  if (empty(ForkReady[right]))   // the same for the right fork:${/* shown code, line 8: the same test for the right fork */''}
    fork[right] = true;          // back on the table,${/* shown code, line 9: back on the table if nobody waits */''}
  else                           // or${/* shown code, line 10: otherwise... */''}
    csignal(ForkReady[right]);   // handed to its waiter${/* shown code, line 11: ...handed straight to its waiter */''}
}                                // leave the monitor`), { lang: 'c', fontSize: 13 }),  // shown code, line 12: leaves the monitor; then the listing options
            phil: ctx.ui.code(tidy(ctx, `${/* phil: the listing of the philosopher's own loop */''}
void philosopher(int k) {        // seat k runs this${/* shown code, line 1: the procedure every philosopher runs */''}
  while (true) {                 // forever:${/* shown code, line 2: the endless loop */''}
    think();                     // no forks needed${/* shown code, line 3: thinking, with no forks */''}
    get_forks(k);                // one monitor visit for both forks${/* shown code, line 4: one monitor visit takes both forks */''}
    eat();                       // holding both forks${/* shown code, line 5: eating */''}
    release_forks(k);            // one more visit to give them back${/* shown code, line 6: one more visit gives both forks back */''}
  }                              // and think again${/* shown code, line 7: end of the loop body */''}
}                                // end of the ritual`), { lang: 'c', fontSize: 13 }),  // shown code, line 8: end of the procedure; then the listing options (C-style colouring, 13px text)
          };  // closes the C table of listings
          const KEYS = ['get', 'rel', 'phil'];  // KEYS: the names of the three listings, in the same order as their tabs
          KEYS.forEach((k) => fitCode(ctx, C[k]));  // on phone-width screens lets each listing's long lines wrap
          const tabs = ctx.ui.tabs([  // tabs: a row of tabs so the three listings and the explanation share one space
            { label: 'get_forks', render: (p) => { p.append(C.get); } },  // tab 1: the get_forks listing
            { label: 'release_forks', render: (p) => { p.append(C.rel); } },  // tab 2: the release_forks listing
            { label: 'philosopher', render: (p) => { p.append(C.phil); } },  // tab 3: the philosopher loop listing
            { label: 'Why no circle?', html: `<div class="stack small" style="gap:8px;line-height:1.45">${/* tab 4: the argument for why no circle of waiting can form, as fixed HTML */''}
              <p class="m0">Suppose all five held their left fork and waited for the right one. Look at whoever took its left fork <b>first</b>. At that moment its right fork was still on the table, because the neighbour who holds it now took it later. And it checked the right fork in the <b>same monitor visit</b>, with nobody able to slip in between, so it would have taken that fork too and eaten. Contradiction: the circle can never form.</p>${/* paragraph: suppose a full circle formed; whoever took its left fork first would have found its right fork free in the same visit */''}
              <p class="m0">The handoff matters too: when somebody waits for a released fork, <span class="t">csignal</span> passes it straight to that waiter (in the classic monitor the woken process runs at once), so no neighbour can snatch it first. Only two philosophers share a fork, so a ForkReady queue never holds more than one waiter, and that waiter gets the fork at its next release. As long as every meal ends, nobody <span class="t" data-t="starvation">starves</span>.</p>${/* paragraph: how the csignal handoff stops a neighbour snatching a released fork, and why that rules out starvation */''}
              <div class="callout warn small m0" data-label="Common mistake">Thinking nobody here holds a fork while waiting. A philosopher can wait in ForkReady[right] holding its left fork: the monitor removes the circle, not the holding.</div></div>` },  // "Common mistake" callout: philosophers can still hold a fork while waiting; the monitor removes the circle, not the holding
          ], { initial: 2 });  // closes the tab list; the philosopher loop tab (number 2, counting from 0) is open at the start
          // Highlight the lines an event actually ran, in the tab where they live.
          function show(key, marks) {  // show(key, marks): opens the tab for listing key and highlights the lines a move just ran
            KEYS.forEach((k) => C[k].clear());  // removes old highlights from all three listings
            tabs.show(KEYS.indexOf(key));  // switches to the tab that holds this listing
            marks.forEach(([lines, cls]) => C[key].mark(lines, cls));  // highlights each group of lines with its colour class (ok green, bad red, cur the usual highlight)
          }  // ends show
          const qRow = h('div');  // qRow: a box for the small table of the monitor's fork[ ] array and ForkReady queues
          const sim = makeHand(ctx, {  // sim: the hand-driven table for this step, using the monitor
            cfg: { kind: 'mon' },  // the monitor strategy
            intro: 'Everyone is thinking and every fork[k] is true. Click philosophers to move them, or play a scenario.',  // opening message telling the student how to start
            onPaint: (st, sel) => {  // onPaint: after each redraw, rebuilds the fork[ ] and ForkReady table
              const fkCell = (k) => h('td', { class: 'center', style: { color: st.fk[k] ? 'var(--ok)' : 'var(--warn)' } }, String(st.fk[k]));  // fkCell(k): a table cell showing fork[k], green when true and amber when false
              const qCell = (k) => h('td', { class: 'center', style: { color: st.q[k].length ? 'var(--warn)' : 'var(--muted)' } }, st.q[k].length ? st.q[k].map((w) => 'P' + w).join(' ') : 'empty');  // qCell(k): a table cell listing who waits in ForkReady[k], or "empty" in grey
              // A phone gets one row per fork (three slim columns) so the table never scrolls sideways.
              qRow.replaceChildren(ctx.narrow  // on phone-width screens...
                ? h('table', { class: 'tbl compact mono', style: { display: 'table', width: '100%' } },  // ...a table with one row per fork...
                  h('tr', {}, ...['k', 'fork[k]', 'ForkReady[k]'].map((x) => h('th', { style: { textAlign: 'center' } }, x))),  // ...whose header row names the three columns...
                  ...ALL.map((k) => h('tr', {}, h('td', { class: 'center' }, String(k)), fkCell(k), qCell(k))))  // ...and one row per fork: its number, fork[k] and its queue
                : h('table', { class: 'tbl compact mono' },  // on larger screens, a table with one column per fork
                  h('tr', {}, h('th', {}, 'k'), ...ALL.map((k) => h('th', { style: { textAlign: 'center' } }, String(k)))),  // header row: the fork numbers
                  h('tr', {}, h('td', {}, 'fork[k]'), ...ALL.map(fkCell)),  // second row: fork[k] for every fork
                  h('tr', {}, h('td', {}, 'ForkReady[k]'), ...ALL.map(qCell))));  // third row: the ForkReady queue for every fork; closes the table and the choice
              // After a reset only the highlights go; the student stays on the tab they are reading.
              if (sel < 0) KEYS.forEach((k) => C[k].clear());  // after a reset (nobody selected), removes the old line highlights
            },  // ends onPaint
            onMove: (st, ev) => {  // onMove: after each move, highlights the code lines that move actually ran
              if (ev.k === 'hungry') show('phil', [[[4], 'cur']]);  // getting hungry: the get_forks call in the philosopher loop is next
              else if (ev.k === 'full') show('phil', [[[6], 'cur']]);  // finishing the meal: the release_forks call is next
              else if (ev.k === 'waitL') show('get', [[[8], 'bad']]);  // left fork busy: the cwait on the left fork's line, in red
              else if (ev.k === 'waitR') show('get', [[[7, 9, 10], 'ok'], [[11], 'bad']]);  // right fork busy: the lines that ran, in green, and the cwait on the right fork, in red
              else if (ev.k === 'eat') show('get', [[[7, 9, 10, 12], 'ok']]);  // both forks taken: all the lines that ran, in green
              else if (ev.k === 'release') {  // a release
                const hd = (f) => ev.handed.some((x) => x.f === f);  // hd(f): whether fork f was handed to a waiter
                show('rel', [[[hd(LF(ev.who)) ? 7 : 5, hd(RF(ev.who)) ? 11 : 9], 'ok']]);  // for each fork, the line that ran: the csignal line if it was handed on, otherwise the line that puts it back on the table
              }  // ends the release case
            },  // ends onMove
          });  // ends the options for makeHand
          sim.table.svg.style.maxHeight = ctx.narrow ? '' : '316px';  // caps the drawing's height on larger screens so the step fits
          const play = (order, msg) => sim.script(order.map((i) => [i, i]), 750, msg);  // play(order, msg): a demo in which each philosopher in order gets hungry and calls get_forks in one beat, 750 ms apart
          sim.reset();  // starts the table in its opening state
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 440px) minmax(0, 1fr)', gap: '20px' } },  // builds the step: two columns, the table side at most 440px wide and the rest flexible
            h('div', { class: 'stack', style: { gap: '7px' } },  // left column: key, table, buttons and narration
              h('div', { class: 'row gap-s xs', style: { gap: '6px' }, html: LEGEND }),  // the colour key for the philosopher states
              sim.table.svg, sim.btns, sim.narr),  // the table drawing, the buttons and the narration; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: explanation, listings and controls
              h('p', { class: 'm0 small', html: 'All fork logic lives in a <span class="t">monitor</span>, so one philosopher at a time runs it. <code>get_forks</code> checks the right fork in the <b>same visit</b> that takes the left; <code>release_forks</code> uses <span class="t">csignal</span> to hand a fork to a waiter (a <span class="t">handoff</span>).' }),  // paragraph: what the monitor does, the same-visit check of the right fork, and the csignal handoff
              h('div', { style: { height: ctx.narrow ? 'auto' : '322px', display: 'flex', flexDirection: 'column' } }, tabs),  // the tabs, in a box of fixed height on larger screens so switching tabs does not move the controls below
              qRow,  // the fork[ ] and ForkReady table
              h('div', { class: 'row gap-s' },  // a row of controls
                h('button', { class: 'btn sm primary', type: 'button', onclick: () => play(ALL, 'All five get hungry and call get_forks, P0 first…') }, '▶ All hungry, P0 first'),  // demo button: everyone gets hungry, P0 first
                h('button', { class: 'btn sm primary', type: 'button', onclick: () => play([4, 3, 2, 1, 0], 'All five get hungry and call get_forks, P4 first, then P3, P2, P1, P0…') }, '▶ All hungry, P4 first'),  // demo button: everyone gets hungry, P4 first and then down the seats
                h('button', { class: 'btn sm', type: 'button', onclick: () => sim.reset() }, 'Reset')))));  // Reset button; closes the row, the columns and the layout
        },  // ends render for step 6
      },  // ends step 6

      /* ---------------- 7. Deadlock-free is not starvation-free ---------------- */
      {  // step 7 starts here
        title: 'No deadlock is not the same as no starvation',  // step 7 title
        kind: 'explore',  // kind "explore": a hands-on step comparing two schedules
        render(el, ctx) {  // render(el, ctx): runs when step 7 opens; builds the timeline chart, its controls and the tick-by-tick log
          const { h, s } = ctx;  // takes the HTML and SVG builders from ctx
          const T = 24, EAT = 4;  // T: how many ticks (time steps) the run lasts; EAT: how many ticks one meal takes
          /* A tick-by-tick run of the "both or neither" rule for P1, P2 and P3
             (P0 and P4 keep thinking). Every meal lasts 4 ticks and is followed
             by 1 tick of thinking. fair = a philosopher may not start eating
             while a neighbour that needs one of its forks has been hungry longer. */
          function run(fair) {  // run(fair): plays the whole tick-by-tick run, with or without the fairness rule, and returns what happened
            const P = { 1: { st: 'T', until: 1 }, 2: { st: 'T', until: 2 }, 3: { st: 'T', until: 3 } };  // P: the state of P1, P2 and P3; each starts thinking ('T') until tick 1, 2 or 3, so they get hungry one after another
            Object.values(P).forEach((p) => Object.assign(p, { since: -1, meals: 0 }));  // adds since (when the hunger started, -1 for not hungry) and a meal count to each
            const fork = { 1: 0, 2: 0, 3: 0, 4: 0 };  // fork: who holds forks f1 to f4 (0 = on the table), the only forks P1 to P3 use
            const need = (i) => [i, i + 1];  // need(i): the two forks philosopher i needs, fi and fi+1
            const ticks = [];  // ticks: one record per tick, for the chart and the log
            let idle = 0;  // idle: a running count used for the starving philosopher's wait
            for (let t = 0; t < T; t++) {  // for each tick t, from 0 to T - 1
              const ev = [];  // ev: the sentences describing this tick
              [1, 2, 3].forEach((i) => { const p = P[i]; if (p.st === 'E' && p.until === t) { need(i).forEach((f) => (fork[f] = 0)); p.st = 'T'; p.until = t + 1; ev.push(`P${i} finishes and puts f${i}, f${i + 1} down.`); } });  // first, any meal that ends now: both forks go down and the philosopher thinks for one tick
              [1, 2, 3].forEach((i) => { const p = P[i]; if (p.st === 'T' && p.until === t) { p.st = 'H'; p.since = t; ev.push(`P${i} gets hungry.`); } });  // next, any thinking that ends now: the philosopher gets hungry, and since records when
              [1, 2, 3].filter((i) => P[i].st === 'H').sort((a, b) => P[a].since - P[b].since || a - b).forEach((i) => {  // then the hungry ones, longest-hungry first (ties go to the lower seat), each try to eat
                const busy = need(i).filter((f) => fork[f]);  // busy: the forks it needs that are in someone's hand
                const elder = fair ? [i - 1, i + 1].find((j) => P[j] && P[j].st === 'H' && P[j].since < P[i].since) : undefined;  // elder: with the fairness rule, a neighbour that has been hungry longer and so goes first; without it, nobody
                if (!busy.length && elder === undefined) { need(i).forEach((f) => (fork[f] = i)); P[i].st = 'E'; P[i].until = t + EAT; P[i].meals++; ev.push(`<b>P${i} takes f${i} and f${i + 1} together and eats.</b>`); }  // both forks free and no elder: it takes both together and eats for EAT ticks
                else if (busy.length) ev.push(`P${i} waits: ${busy.map((f) => `f${f} is in P${fork[f]}’s hand`).join(' and ')}.`);  // otherwise, if a fork is busy, says who holds it
                else { idle++; ev.push(`P${i}’s forks are both free, but P${elder} has been hungry longer, so <b>P${i} lets P${elder} go first</b>.`); }  // both forks free but an older-hungry neighbour goes first: counts a tick where forks sat idle, and says who stepped back
              });  // ends the loop over hungry philosophers
              ticks.push({ st: [1, 2, 3].map((i) => P[i].st), f2: fork[2], f3: fork[3], meals: [1, 2, 3].map((i) => P[i].meals), since2: P[2].st === 'H' ? P[2].since : -1, ev, idle });  // saves this tick: the three states, who holds f2 and f3, meal counts, when P2's current hunger began (-1 if not hungry), the sentences and the idle count
            }  // ends the loop over ticks
            return ticks;  // returns the list of tick records
          }  // ends run
          const RUNS = { a: run(false), b: run(true) };  // RUNS: both runs computed once when the step opens, a without the fairness rule (Rule A) and b with it (Rule B)
          let mode = 'a';  // mode: which run is on screen, 'a' or 'b'
          // A phone shows a sliding window of 10 ticks with bigger cells; a wide screen shows all 24.
          const NT = ctx.narrow ? 10 : T, X0 = ctx.narrow ? 66 : 82, CW = ctx.narrow ? 26 : 22, RH = 30;  // chart sizes: NT ticks shown at once (10 on phone-width screens, all 24 otherwise), X0 the left margin for labels, CW the cell width, RH the row height
          const W = X0 + NT * CW + 6;  // W: the chart's total width in drawing units
          const svg = s('svg', { viewBox: `0 0 ${W} 252`, width: '100%' });  // svg: the timeline chart, stretched to the full width of its box
          const rows = [['P1', 30], ['P2', 68], ['P3', 106], ['fork f2', 170], ['fork f3', 208]];  // rows: each row's label and top position: three philosopher rows, then, after a gap, the rows for forks f2 and f3
          const CLS = { T: 's-panel', H: 's-warn', E: 's-ok' };  // CLS: the cell colour for each state: grey thinking, amber hungry, green eating
          const stats = h('div', { class: 'g3' });  // stats: three cards with each philosopher's meal count
          function draw(t) {  // draw(t): draws the chart up to tick t and returns that tick's caption; the player calls it for every frame
            const R = RUNS[mode], kids = [], k0 = Math.max(0, Math.min(t - NT + 1, T - NT));  // R: the run on screen; kids: the shapes to draw; k0: the first tick shown, so the window slides to keep t in view without passing the end
            const xOf = (k) => X0 + (k - k0) * CW;  // xOf(k): the left edge of tick k's column
            for (let k = k0; k < k0 + NT; k++) if (k % (ctx.narrow ? 2 : 4) === 0) kids.push(s('text', { x: xOf(k) + CW / 2, y: 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 't=' + k));  // a "t=" label over every 4th tick (every 2nd on phone-width screens)
            rows.forEach(([lab, y]) => kids.push(s('text', { x: 4, y: y + 20, 'font-size': 14, 'font-weight': 700 }, lab)));  // the row labels down the left side
            kids.push(s('line', { x1: 4, y1: 152, x2: W - 4, y2: 152, class: 's-muted', 'stroke-dasharray': '4 4' }));  // a dashed line that separates the philosopher rows from the fork rows
            for (let k = k0; k < k0 + NT; k++) {  // for every tick in the visible window
              const x = xOf(k), d = R[k], past = k <= t;  // x: its column; d: its record; past: whether the playback has reached it yet
              [0, 1, 2].forEach((r) => kids.push(s('rect', { x: x + 1, y: rows[r][1], width: CW - 2, height: RH, rx: 3, class: past ? CLS[d.st[r]] : 's-muted', 'stroke-width': 1, 'stroke-dasharray': past ? null : '2 3' })));  // one cell per philosopher, coloured by its state for played ticks and an empty dashed outline for ticks still to come
              [['f2', 3], ['f3', 4]].forEach(([f, r]) => {  // the two fork rows
                const who = d[f];  // who: the philosopher holding that fork at that tick (0 = on the table)
                kids.push(s('rect', { x: x + 1, y: rows[r][1], width: CW - 2, height: RH, rx: 3, class: !past ? 's-muted' : who ? (who === 2 ? 's-ok' : 's-proc') : 's-panel', 'stroke-width': 1, 'stroke-dasharray': past ? null : '2 3' }));  // a fork cell: green when P2 holds it, teal when another philosopher does, grey when free, dashed outline for ticks still to come
                if (past && who) kids.push(s('text', { x: x + CW / 2, y: rows[r][1] + 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, String(who)));  // writes the holder's number in the cell
              });  // ends the fork rows
            }  // ends the loop over ticks
            kids.push(s('rect', { x: xOf(t) - 1, y: 24, width: CW + 2, height: 220, rx: 4, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.5 }));  // an accent frame around the current tick's column
            svg.replaceChildren(...kids);  // replaces the chart's contents with the new shapes
            const d = R[t], wait = d.since2 >= 0 ? t - d.since2 + 1 : 0;  // d: the current tick's record; wait: how many ticks P2 has been hungry so far (0 when it is not hungry)
            stats.replaceChildren(...[1, 2, 3].map((i, r) => h('div', { class: 'card tight center' + (i === 2 ? (mode === 'a' ? ' intr' : ' mem') : '') },  // one card each for P1, P2 and P3; P2's card is red under Rule A and green under Rule B
              h('div', { class: 'xs muted b' }, `P${i} meals so far`), h('div', { class: 'big', style: { fontSize: '30px' } }, String(d.meals[r])),  // the card's label and its meal count in large digits
              i === 2 ? h('div', { class: 'xs' }, wait ? `hungry for ${wait} tick${wait === 1 ? '' : 's'}` : 'not waiting') : h('div', { class: 'xs muted' }, 'eats 4 ticks, thinks 1'))));  // P2's card adds how long it has been hungry; the others note their routine of eating 4 ticks and thinking 1
            return `<b>t = ${t}.</b> ${d.ev.length ? d.ev.join(' ') : 'Nothing changes this tick.'}` + (t === T - 1 ? (mode === 'a' ? ` <b>End: P2 never ate.</b> f2 and f3 were each free at times, but never at the same time.` : ` <b>End: everyone ate.</b> Fairness cost ${d.idle} tick${d.idle === 1 ? '' : 's'} where forks lay free while their philosopher deferred.`) : '');  // the caption: the tick number and what happened; on the last tick, the conclusion for the chosen rule
          }  // ends draw
          const player = ctx.ui.player({ count: T, render: draw, interval: 900 });  // player: steps through the 24 ticks with Play, Next and Back, 900 ms per tick at normal speed, calling draw for each
          const ruleText = h('p', { class: 'small m0' });  // ruleText: the paragraph that describes the chosen rule
          const insight = h('div', { class: 'callout small m0' });  // insight: a callout with what to notice under the chosen rule
          // Computed from the Rule A run: the moments f2 and f3 were each free while P2 was hungry.
          const freeAt = (f) => RUNS.a.map((d, t) => (d.since2 >= 0 && !d[f] ? t : -1)).filter((t) => t >= 0);  // freeAt(f): the ticks in the Rule A run at which P2 was hungry and fork f was free
          const seg = ctx.ui.seg([{ value: 'a', label: 'Rule A: both or neither' }, { value: 'b', label: 'Rule B: …and oldest first' }], 'a', (v) => { mode = v; setRule(); player.reset(); });  // seg: a two-button switch between Rule A and Rule B; switching rewrites the texts and restarts the player
          function setRule() {  // setRule(): rewrites the rule text and the insight for the chosen rule
            const idle = RUNS.b[T - 1].idle;  // idle: how many ticks forks lay free under Rule B because a philosopher stepped back
            insight.className = 'callout small m0 ' + (mode === 'a' ? 'bad' : 'warn');  // a red callout for Rule A, an amber one for Rule B
            insight.setAttribute('data-label', mode === 'a' ? 'Look closely' : 'The price of fairness');  // the callout's label: "Look closely" or "The price of fairness"
            insight.innerHTML = mode === 'a'  // the insight depends on the rule
              ? `While P2 is hungry, f2 is free at t = ${freeAt('f2').join(', ')} and f3 at t = ${freeAt('f3').join(', ')}. Never at the same tick, so “both or neither” never lets P2 eat. P1 and P3 overlap their meals, so one of them always holds a fork P2 needs.`  // Rule A: lists, computed from the run, when f2 and f3 were each free, and shows they never were at the same tick
              : `In ${idle} tick${idle === 1 ? '' : 's'} a philosopher’s forks were both free, yet it stood back for an older neighbour. Fairness can leave a resource idle for a moment; that is the trade for a guarantee.`;  // Rule B: how many ticks fairness left forks idle, and why that is worth it
            ruleText.innerHTML = mode === 'a'  // the rule text depends on the rule too
              ? 'A hungry philosopher picks up <b>both</b> forks in one indivisible step, and only when both are free. Nobody ever holds a fork while waiting, so there is no <span class="t">hold and wait</span> and <b>no deadlock</b>. But watch P2.'  // Rule A: both forks in one indivisible step, so no hold and wait and no deadlock, but watch P2
              : 'Same as Rule A, plus one fairness rule: you may not start eating while a neighbour who needs one of your forks has been hungry longer than you. Real systems get the same effect with first-in-first-out queues.';  // Rule B: the extra fairness rule, and how real systems get it with first-in-first-out queues
          }  // ends setRule
          setRule();  // fills in the texts for Rule A when the step opens
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 650px) minmax(0, 1fr)', gap: '20px' } },  // builds the step: two columns, the chart side at most 650px wide and the rest flexible
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: key, chart, player and a warning
              h('div', { class: 'row gap-s xs' }, h('span', { class: 'chip' }, 'thinking'), h('span', { class: 'chip warn' }, 'hungry'), h('span', { class: 'chip ok' }, 'eating'), h('span', { class: 'chip proc' }, 'fork held (number = holder)'), h('span', { class: 'muted' }, 'P0 and P4 keep thinking')),  // the chart's key: the state colours, the fork-held colour, and a note that P0 and P4 keep thinking
              h('div', { class: 'card white tight' }, svg),  // the chart in a white card
              player.el,  // the player's controls and caption
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake' }, 'Stopping once a solution is deadlock-free. Always ask a second question: can one particular process be overtaken forever?')),  // "Common mistake" callout: deadlock-free is not the end, ask whether one process can be overtaken forever; closes the left column
            h('div', { class: 'stack', style: { gap: '9px' } },  // right column: rule switch and results
              seg, ruleText, stats, insight,  // the rule switch, the rule text, the meal cards and the insight
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters' }, h('span', { html: '<span class="t">Deadlock freedom</span> promises that <i>someone</i> can always move. <span class="t">Starvation freedom</span> promises that <i>everyone</i> eventually does. A scheme can keep the first promise and break the second.' })))));  // "Why it matters" callout: deadlock freedom says someone moves, starvation freedom says everyone does; closes the layout
        },  // ends render for step 7
      },  // ends step 7

      /* ---------------- 8. Lab: race the strategies under a random scheduler ---------------- */
      {  // step 8 starts here
        title: 'Lab: race four strategies under a random scheduler',  // step 8 title
        kind: 'lab',  // kind "lab": shown as Hands-on Lab
        render(el, ctx) {  // render(el, ctx): runs when step 8 opens; builds the strategy race with its controls, counters and batch test
          const { h } = ctx;  // takes the HTML builder h from ctx
          const STRATS = [  // STRATS: the four strategies to race; cycle is how many moves one philosopher needs for one full round of its ritual
            { value: 'naive', label: 'Semaphore per fork', cfg: { kind: 'sem' }, cycle: 6 },  // strategy: one semaphore per fork, 6 moves per round
            { value: 'room', label: 'Room of 4', cfg: { kind: 'sem', room: 4 }, cycle: 8 },  // strategy: a room semaphore of 4 seats, 8 moves per round
            { value: 'asym', label: 'P4 right first', cfg: { kind: 'sem', right: [0, 0, 0, 0, 1] }, cycle: 6 },  // strategy: P4 reaches right first, 6 moves per round
            { value: 'mon', label: 'Monitor', cfg: { kind: 'mon' }, cycle: 4 },  // strategy: the monitor, 4 moves per round
          ];  // closes STRATS
          const byKey = (k) => STRATS.find((x) => x.value === k);  // byKey(k): finds a strategy by its value
          let key = 'naive', seed = 19, speed = 300, gen = 0, timer = null, resumeAfter = false, rnd, st, bank;  // lab state: chosen strategy, scheduler seed, ms per move, demo counter, run timer, resume-after-deadlock flag, random source, state, and totals
          const table = makeTable(ctx);  // table: the table drawing, not clickable in this step
          table.svg.style.maxHeight = ctx.narrow ? '' : '300px';  // caps the drawing's height on larger screens so the step fits
          const narr = h('div', { class: 'narr', style: { minHeight: '88px' } });  // narr: the box where each move is explained, tall enough for most messages
          const mealRow = h('div', { class: 'grid-5x' });  // mealRow: one card per philosopher with its meal count
          const counters = h('div', { class: 'g3' });  // counters: cards for moves, deadlocks and longest wait
          const say = (html, tone) => { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; };  // say(html, tone): writes a message in narr; tone colours it
          // Waits still in progress count too, so a starving philosopher shows up before it eats.
          const waitNow = () => Math.max(bank.longest, ...ALL.map((i) => (['hungry', 'blocked'].includes(phase(st, i)) ? st.moves - st.since[i] : st.longest[i])));  // waitNow(): the longest wait so far in moves, counting waits still going on and waits from runs before a restart
          function paint() {  // paint(): redraws the table and all the counters
            table.update(viewOf(st));  // redraws the table for the current state
            const meals = ALL.map((i) => bank.meals[i] + st.meals[i]);  // meals: each philosopher's meals in this run plus earlier runs
            mealRow.replaceChildren(...ALL.map((i) => h('div', { class: 'card tight center', style: { padding: '4px' } }, h('div', { class: 'xs muted b' }, `P${i} meals`), h('div', { class: 'b', style: { fontSize: '20px' } }, String(meals[i])))));  // one small card per philosopher with its meal count
            const box = (lab, v, cls) => h('div', { class: 'card tight center' + (cls ? ' ' + cls : ''), style: { padding: '5px 8px' } }, h('div', { class: 'xs muted b' }, lab), h('div', { class: 'big', style: { fontSize: '24px' } }, String(v)));  // box(lab, v, cls): a small card with a label and a big number
            counters.replaceChildren(box('moves', bank.moves + st.moves), box('deadlocks', bank.dead, bank.dead ? 'intr' : ''), box('longest wait (moves)', waitNow()));  // the three counters: total moves, deadlocks (red once there is one) and longest wait
          }  // ends paint
          function fresh() { st = newSim(byKey(key).cfg); }  // fresh(): starts a new simulation of the chosen strategy
          function bankRun() { ALL.forEach((i) => { bank.meals[i] += st.meals[i]; }); bank.longest = waitNow(); bank.moves += st.moves; }  // bankRun(): before a restart, adds this run's meals, longest wait and moves to the totals so nothing is lost
          function stop() { if (timer) clearInterval(timer); timer = null; resumeAfter = false; runBtn.innerHTML = '▶ Run'; }  // stop(): stops automatic running, cancels any planned resume and puts the Run label back on the button
          function reset() {  // reset(): starts the lab over with the chosen strategy and seed; runs when the step opens and whenever a setting changes
            gen++; stop();  // cancels any pending restart and stops automatic running
            rnd = rng(seed); bank = { meals: [0, 0, 0, 0, 0], longest: 0, moves: 0, dead: 0 };  // rnd: a fresh random source from the seed, so the same seed replays the same schedule; bank: the totals start at zero
            fresh(); paint();  // starts a new simulation and redraws
            say(`<b>${byKey(key).label}</b>, schedule seed ${seed}. Each move, the scheduler picks one philosopher that is able to move, at random. Press <b>Run</b> or <b>Step</b>.`);  // opening message: the strategy, the seed, how the random scheduler chooses, and what to press
          }  // ends reset
          // After a deadlock: bank the meals, restart all five, keep the same random schedule.
          function recover(going) { gen++; bankRun(); fresh(); paint(); say('Restarted after the deadlock, on the same random schedule. ' + (going ? 'Continuing…' : 'Press <b>Run</b> or <b>Step</b> to go on.')); }  // recover(going): after a deadlock, saves the totals, restarts all five and says whether running continues
          function step() {  // step(): one move chosen by the random scheduler; Run calls it on a timer and the Step button calls it once
            if (stuck(st)) { recover(!!timer); return; }  // if the table is still frozen from the last move, restarts it first (continuing if Run is on)
            const i = pickMover(st, rnd);  // i: the philosopher the scheduler picks among those able to move
            const ev = act(st, i);  // makes that move and keeps the event record
            if (stuck(st)) {  // if this move froze the table
              bank.dead++;  // counts the deadlock
              const g = ++gen;  // g: a number for this freeze, so a later Reset or setting change can cancel the planned restart
              resumeAfter = !!timer;  // remembers whether the lab was running, so it can carry on after the restart
              if (timer) { clearInterval(timer); timer = null; }  // stops the timer while the frozen table is on show
              paint();  // redraws the frozen table
              say(deadlockText(st) + ' <b>Recovery:</b> the OS aborts all five and restarts them; meals already eaten still count.', 'bad');  // shows the deadlock message in red and explains the recovery: abort all five and restart, keeping the meals already eaten
              // Pause pressed during these two seconds clears resumeAfter, so the table restarts but waits.
              ctx.after(2000, () => { if (g !== gen) return; const go = resumeAfter; recover(go); if (go) { resumeAfter = false; start(); } });  // after two seconds, unless something else happened, restarts the table and starts running again if it was running before
              return;  // leaves step early, since the move is already explained
            }  // ends the deadlock case
            say(st.mon ? monNarr(st, ev) : semNarr(st, ev));  // explains the move with the semaphore or monitor narration
            paint();  // redraws everything
          }  // ends step
          function start() { if (timer) return; timer = ctx.every(speed, step); runBtn.innerHTML = 'Pause'; }  // start(): runs step() every speed milliseconds while the step is open, and turns the button into Pause
          const runBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => (timer || resumeAfter ? stop() : start()) }, '▶ Run');  // runBtn: Run or Pause; while running, or waiting to resume after a deadlock, it pauses, otherwise it starts
          const stratSeg = ctx.ui.seg(STRATS.map(({ value, label }) => ({ value, label })), key, (v) => { key = v; reset(); });  // stratSeg: a switch for the four strategies; choosing one starts the lab over
          const seedSl = ctx.ui.slider({ label: 'Seed', min: 1, max: 60, value: seed, onInput: (v) => { seed = v; reset(); } });  // seedSl: a slider for the seed (1 to 60); a new seed means a different random schedule, so the lab starts over
          const speedSeg = ctx.ui.seg([{ value: 700, label: 'Slow' }, { value: 300, label: 'Normal' }, { value: 90, label: 'Fast' }], speed, (v) => { speed = v; if (timer) { stop(); start(); } });  // speedSeg: a switch for Slow, Normal or Fast (700, 300 or 90 ms per move); a running lab restarts its timer at the new speed
          // Batch test: the same 100 random schedules of 300 moves for every strategy.
          const results = h('div', { class: 'card tight small muted', html: 'Predict first: which strategies will ever freeze? Then press the button to run all four on the same 100 random schedules.' });  // results: the box for the batch test, which first asks the student to predict
          function batch() {  // batch(): runs every strategy on the same 100 random schedules of 300 moves and fills in a results table
            results.className = '';  // removes the box's card styling so the table takes its place
            const rows = STRATS.map((S) => {  // rows: one result per strategy
              let dead = 0, meals = 0, fewest = Infinity, longest = 0;  // counters for this strategy: runs that froze, total meals, fewest meals any philosopher got, longest wait
              for (let sd = 1; sd <= 100; sd++) {  // for each of the 100 seeds
                const r = rng(sd), x = newSim(S.cfg);  // r: a random source from that seed; x: a fresh simulation of this strategy
                let froze = false;  // froze: whether this run deadlocked
                for (let m = 0; m < 300; m++) { act(x, pickMover(x, r)); if (stuck(x)) { froze = true; break; } }  // makes up to 300 random moves, stopping early if the table freezes
                if (froze) dead++;  // counts the frozen run
                meals += x.meals.reduce((a, b) => a + b, 0);  // adds up all the meals in this run
                fewest = Math.min(fewest, ...x.meals);  // keeps the fewest meals any one philosopher got in any run
                longest = froze ? Infinity : Math.max(longest, ...ALL.map((i) => (['hungry', 'blocked'].includes(phase(x, i)) ? x.moves - x.since[i] : x.longest[i])));  // longest wait: endless if the run froze, otherwise the longest wait in moves, counting waits still in progress
              }  // ends the loop over seeds
              return { S, dead, meals: meals / 100, fewest, longest, proof: search(S.cfg).deadlock };  // the strategy's result: average meals per run, and the model checker's verdict as the proof
            });  // ends the results
            const wait = (r) => (r.longest === Infinity ? '∞' : String(r.longest));  // wait(r): the longest wait as text, with the infinity sign for a run that froze
            // A phone keeps three columns and tucks meals, fewest and max wait under the strategy name.
            const slim = ctx.narrow;  // slim: whether the phone-width version of the table is needed
            results.replaceChildren(h('table', { class: 'tbl compact', style: slim ? { display: 'table' } : {} },  // builds the results table
              h('tr', {}, ...(slim ? ['Strategy', 'Froze', 'Proof'] : ['Strategy', 'Froze', 'Meals', 'Fewest', 'Max wait', 'Proof']).map((x) => h('th', {}, x))),  // header row: three columns on phone-width screens, six otherwise
              ...rows.map((r) => h('tr', { class: r.S.value === key ? 'on' : '' },  // one row per strategy, highlighted when it is the strategy chosen above
                h('td', { class: 'b', style: { whiteSpace: slim ? 'normal' : 'nowrap' } }, r.S.label,  // the strategy's name in bold
                  slim ? h('div', { class: 'xs muted', style: { fontWeight: 400 } }, `meals ${ctx.util.fmt(r.meals, 1)} · fewest ${r.fewest} · max wait ${wait(r)}`) : null),  // on phone-width screens, a small grey line under the name with meals, fewest and max wait
                h('td', { style: { color: r.dead ? 'var(--bad)' : 'var(--ok)', whiteSpace: 'nowrap' } }, `${r.dead} / 100`),  // how many of the 100 runs froze, in red if any did
                slim ? null : h('td', {}, ctx.util.fmt(r.meals, 1)),  // average meals per run (wide screens only)
                slim ? null : h('td', {}, String(r.fewest)),  // fewest meals for one philosopher (wide screens only)
                slim ? null : h('td', {}, wait(r)),  // longest wait (wide screens only)
                h('td', { class: 'b', style: { color: r.proof ? 'var(--bad)' : 'var(--ok)', whiteSpace: 'nowrap' } }, r.proof ? 'can freeze' : 'never')))),  // the proof column: "can freeze" in red or "never" in green, from the exhaustive model check; closes the table
            h('p', { class: 'xs muted m0', style: { margin: '4px 0 8px' } }, `Meals: average per run (a cycle takes ${STRATS.map((x) => x.cycle).join(', ')} moves, so not a speed contest). Fewest: least any one philosopher ate. Max wait: in moves. Proof: the exhaustive model check.`),  // footnote explaining each column, and why meal counts are not a speed contest
            h('div', { class: 'callout why small m0', 'data-label': 'Testing is not proof' }, `Only the first strategy froze (${rows[0].dead} of 100 runs), and the exhaustive model check agrees it is the only one that can. Random testing can reveal a deadlock; only checking every possible order can prove there is none.`));  // "Testing is not proof" callout: random runs can find a deadlock, only checking every order can rule one out
          }  // ends batch
          reset();  // sets the lab up when the step opens
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 430px) minmax(0, 1fr)', gap: '20px' } },  // builds the step: two columns, the table side at most 430px wide and the controls flexible
            h('div', { class: 'stack', style: { gap: '7px' } },  // left column: key, table, meal cards and narration
              h('div', { class: 'row gap-s xs', html: LEGEND }), table.svg, mealRow, narr),  // the colour key, the table drawing, the meal cards and the narration box; closes the left column
            h('div', { class: 'stack', style: { gap: '9px' } },  // right column: settings, controls and results
              stratSeg,  // the strategy switch
              h('div', { class: 'row gap-s' }, h('div', { style: { flex: '1', minWidth: '160px' } }, seedSl), speedSeg),  // a row with the seed slider in a flexible box and the speed switch
              h('div', { class: 'row gap-s' }, runBtn,  // a row of controls, starting with Run
                h('button', { class: 'btn sm', type: 'button', onclick: () => { stop(); step(); } }, 'Step'),  // Step button: stops automatic running and makes exactly one move
                h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Reset'),  // Reset button
                h('span', { class: 'small muted' }, 'Tip: seed 19 freezes the first strategy quickly.')),  // a tip naming a seed that freezes the first strategy quickly
              counters,  // the three counters
              h('div', { class: 'row gap-s' }, h('button', { class: 'btn sm os', type: 'button', onclick: batch }, 'Test all four on 100 schedules'), h('span', { class: 'small muted' }, '300 moves each, same seeds for every strategy')),  // a row with the batch test button (in purple) and a note on how it runs
              results)));  // the batch results box; closes the columns and the layout
        },  // ends render for step 8
      },  // ends step 8

      /* ---------------- 9. Recap ---------------- */
      {  // step 9 starts here
        title: 'Recap: what to remember about the philosophers',  // step 9 title
        kind: 'recap',  // kind "recap": the summary at the end of a section
        render(el, ctx) {  // render(el, ctx): runs when step 9 opens; builds the flip cards and the comparison table
          const { h } = ctx;  // takes the HTML builder h from ctx
          const cards = ctx.ui.flipcards([  // cards: a grid of flip cards, question on the front and answer on the back
            ['The problem in one breath', 'Five philosophers, five forks, two forks per meal. Any ritual must give <b>mutual exclusion</b> on forks, <b>no deadlock</b> and <b>no starvation</b>.'],  // card: the problem and the three requirements in one sentence
            ['Why does one semaphore per fork freeze?', 'All five take the left fork, then wait for the right one. Every fork semaphore ends at −1 and the waits form one circle.'],  // card: why one semaphore per fork freezes
            ['Why does a room of 4 work?', 'Five forks, four diners: if every fork is taken, someone holds two and eats. And the diner whose right-hand neighbour is not seated never waits for its right fork.'],  // card: why a room of four works
            ['Why does one right-hander work?', 'The waits can no longer all point the same way round. It is resource ordering: lower-numbered fork first.'],  // card: why one right-hander works
            ['What does the monitor do?', '<code>get_forks</code> takes the left fork and checks the right one in one visit; <code>release_forks</code> hands a fork to a waiter with <code>csignal</code>.'],  // card: what the monitor's two procedures do
            ['Deadlock-free, so done?', 'No. “Both or neither” never deadlocks, yet a philosopher whose two neighbours’ meals keep overlapping can starve. Letting the longest-hungry go first fixes it.'],  // card: deadlock-free is not the end, and how starvation is fixed
          ], { cols: 3, height: 136 });  // closes the card list; three cards per row, 136px tall
          // [strategy, condition it breaks, deadlock?, starvation?, price]
          const rows = [  // rows: the comparison table, one row per strategy
            ['One semaphore per fork', '—', 'can freeze', 'yes, once frozen', 'simplest code'],  // row: one semaphore per fork, which breaks nothing and can freeze
            ['Room semaphore = 4', 'circular wait', 'never', 'no (FIFO queues)', 'a diner may wait at the door'],  // row: the room semaphore, which breaks circular wait
            ['One philosopher reaches right first', 'circular wait', 'never', 'no (FIFO queues)', 'everyone must follow the agreed order'],  // row: one right-hander, which also breaks circular wait
            ['Monitor with csignal handoff', 'circular wait', 'never', 'no (one waiter per fork)', 'needs language support for monitors'],  // row: the monitor with its csignal handoff, which breaks circular wait
            ['Both forks or neither', 'hold and wait', 'never', 'possible', 'a fair version leaves forks idle at times'],  // row: both forks or neither, which breaks hold and wait but can starve someone
          ];  // closes the rows
          const tone = (v) => ({ color: v === 'never' || v.startsWith('no') ? 'var(--ok)' : 'var(--bad)', fontWeight: 700 });  // tone(v): bold green for good answers ("never", or anything starting with "no"), bold red otherwise
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the step: everything stacked in one column
            h('p', { class: 'm0', html: 'Say each answer out loud before you flip the card. Then check the strategy table below it.' }),  // instruction: answer each card aloud before flipping it
            cards,  // the flip cards
            h('table', { class: 'tbl compact' },  // the comparison table
              h('tr', {}, ...['Strategy', 'Condition it breaks', 'Deadlock?', ...(ctx.narrow ? [] : ['Starvation?', 'The price'])].map((x) => h('th', {}, x))),  // header row: five columns on larger screens, only the first three on phone-width screens
              ...rows.map((r) => h('tr', {},  // one row per strategy
                h('td', {}, h('b', {}, r[0]), ctx.narrow ? h('div', { class: 'xs muted' }, 'Price: ' + r[4]) : null),  // the strategy's name in bold; on phone-width screens its price goes in small grey text underneath
                h('td', {}, r[1]),  // the condition it breaks
                h('td', { style: tone(r[2]) }, r[2], ctx.narrow ? h('div', { class: 'xs', style: tone(r[3]) }, 'starve: ' + r[3]) : null),  // whether it can deadlock, coloured; on phone-width screens the starvation answer goes underneath
                ctx.narrow ? null : h('td', { style: tone(r[3]) }, r[3]),  // whether it can starve someone, coloured (larger screens only)
                ctx.narrow ? null : h('td', {}, r[4]))))));  // its price (larger screens only); closes the table and the layout
        },  // ends render for step 9
      },  // ends step 9

      /* ---------------- 10. Check yourself ---------------- */
      {  // step 10 starts here
        title: 'Check yourself',  // step 10 title
        kind: 'check',  // kind "check": shown as Check Yourself, the section's quiz
        quiz: [  // quiz: the questions, which the guide's quiz engine shows and marks
          { q: 'Each philosopher runs <code>semWait(fork[i]); semWait(fork[(i + 1) mod 5]);</code> before eating, with every fork semaphore starting at 1. Which timing produces a deadlock?',  // quiz question 1 (multiple choice): which timing makes the one-semaphore-per-fork code deadlock
            choices: ['Two neighbours become hungry at the same moment and reach for their shared fork', 'A philosopher finishes eating and puts its right fork down before its left one', 'All five pick up their left fork before any of them reaches for the right one', 'One philosopher thinks for a very long time while its neighbours keep eating'],  // the choices: two neighbours racing, the put-down order, everyone grabbing left first, a long thinker
            answer: 2,  // answer 2 means the third choice, since counting starts at 0: all five take their left fork first
            feedback: ['One of the two gets the shared fork first and the other simply blocks until it is put down. The eater finishes, so nobody waits forever.', 'The order in which forks are put down does not matter: putting a fork down never makes anyone wait.', null, 'A thinking philosopher holds no fork, so it cannot block anyone.'],  // feedback for each wrong choice, showing why each of those timings is harmless (null for the right one)
            why: 'If all five hold their left fork, every right fork is in a neighbour’s hand. Each philosopher waits for the next one around the table: a circular wait, and none of them will ever let go.' },  // explanation shown after answering: every right fork is in a neighbour's hand, a circular wait
          { type: 'num', q: 'In the dining philosophers problem, five forks lie on the table and every meal needs two forks. What is the largest number of philosophers that can be eating at the same moment?', answer: 2, tol: 0, unit: 'philosophers',  // quiz question 2 (calculate): the most philosophers who can eat at once; the answer is 2, exactly
            why: 'Each eater uses two forks, so three eaters would need six. With five forks at most two can eat at once, and they must not be neighbours.' },  // explanation: three eaters would need six forks
          { type: 'num', q: 'In the one-semaphore-per-fork solution, all five philosophers pick up their left fork and then each calls semWait on its right fork. What value does each fork semaphore end with?', answer: -1, tol: 0,  // quiz question 3 (calculate): the value each fork semaphore ends with in the deadlock; the answer is -1
            why: 'Fork k drops from 1 to 0 when philosopher k takes it as its left fork, then to −1 when the other neighbour, philosopher k − 1, blocks on it as its right fork. A value of −1 means exactly one process waits in that semaphore’s queue.' },  // explanation: the value drops once when the fork is taken and again when the other neighbour blocks on it
          { type: 'num', q: 'In the dining philosophers solution with a room semaphore, room starts at 4. All five philosophers get hungry and call semWait(room) before anyone leaves the table. What is the value of room afterwards?', answer: -1, tol: 0,  // quiz question 4 (calculate): the room semaphore's value after all five call semWait(room); the answer is -1
            why: 'Five semWait calls take the value from 4 down to −1. Four philosophers sit down; the fifth sees a negative value and waits in the room queue.' },  // explanation: five waits from 4 give -1, so four sit and one waits at the door
          { type: 'tf', q: 'If the room semaphore starts at 5 instead of 4, the dining philosophers solution is still free of deadlock.', answer: false,  // quiz question 5 (true or false): a room of 5 would still be deadlock-free; the answer is false
            why: 'A room of 5 admits everybody, so nothing stops all five from holding a left fork at once. It behaves exactly like the first attempt and can freeze.' },  // explanation: a room of 5 seats everyone, so it behaves like the first attempt
          { type: 'tf', q: 'In the monitor solution to the dining philosophers problem, a philosopher can be waiting in ForkReady[right] while it still holds its left fork.', answer: true,  // quiz question 6 (true or false): in the monitor, a philosopher can wait while holding its left fork; the answer is true
            why: 'get_forks takes the left fork and then waits on the right one if it is busy. What the monitor prevents is the circle: the right fork’s holder took it earlier, so the waits can never loop all the way round.' },  // explanation: the monitor prevents the circle, not the holding
          { type: 'multi', q: 'Which of these make the five dining philosophers deadlock-free?', choices: ['A room semaphore that starts at 4', 'Making philosopher 4 pick up its right fork first', 'Making every philosopher pick up its right fork first', 'A room semaphore that starts at 5', 'A monitor whose get_forks checks the right fork in the same visit that takes the left'], answer: [0, 1, 4],  // quiz question 7 (select all): which arrangements are deadlock-free; the answers are the room of 4, P4 reaching right, and the monitor
            why: 'A room of 4 and a single right-hander both break circular wait, and so does the monitor. Everyone reaching right first is the mirror image of the first attempt, and a room of 5 seats everyone, so both can still freeze.' },  // explanation: why those three break circular wait, and why everyone reaching right or a room of 5 can still freeze
          { type: 'match', q: 'Match each deadlock condition with how it shows up at the frozen table.', pairs: [['Mutual exclusion', 'Each fork is in exactly one hand'], ['Hold and wait', 'A philosopher keeps its left fork while waiting for the right'], ['No preemption', 'Nobody may pull a fork out of a neighbour’s hand'], ['Circular wait', 'P0 waits for P1, P1 for P2, … and P4 waits for P0']],  // quiz question 8 (match the pairs): each deadlock condition with how it shows at the frozen table
            why: 'All four conditions hold at once at the frozen table. Remove any one of them and the deadlock cannot happen.' },  // explanation: all four hold together, and removing any one prevents the deadlock
          { type: 'order', q: 'In the one-semaphore-per-fork dining philosophers solution, put one pass of philosopher i’s loop in order.', items: ['think()', 'semWait(fork[i])', 'semWait(fork[(i + 1) mod 5])', 'eat()', 'semSignal(fork[(i + 1) mod 5])', 'semSignal(fork[i])'],  // quiz question 9 (put in order): the six lines of one pass of the first attempt's loop
            why: 'Think, take the left fork, take the right fork, eat, then put the right fork and the left fork back.' },  // explanation: think, left, right, eat, right back, left back
          { type: 'bucket', q: 'Which deadlock condition does each fix remove?', buckets: ['Hold and wait', 'Circular wait'], items: [['Let at most four philosophers sit down', 1], ['Pick up both forks in one step, or neither', 0], ['Have one philosopher pick up its right fork first', 1], ['Change the meal so one fork is enough', 0], ['Number the forks and always take the lower number first', 1]],  // quiz question 10 (sort into groups): which condition each of five fixes removes, hold and wait or circular wait
            why: 'A fix that stops anyone from holding one fork while waiting for another removes hold and wait. A fix that keeps the waits from closing into a loop (a seat limit, a different pick-up order) removes circular wait.' },  // explanation: how to tell which condition a fix removes
          { q: 'In the dining philosophers monitor solution, a philosopher calls <code>release_forks</code> while a neighbour is waiting in <code>ForkReady[left]</code>. What does <code>csignal(ForkReady[left])</code> do?',  // quiz question 11 (multiple choice): what csignal does when a neighbour is waiting for the released fork
            choices: ['Sets fork[left] to true and lets every hungry philosopher race to grab it', 'Hands the fork straight to the waiting neighbour, which resumes and uses it', 'Wakes every philosopher waiting in the monitor, in every condition queue', 'Blocks the releasing philosopher until the neighbour hands the fork back'],  // the choices: back on the table for a race, a direct handoff, waking everyone, or blocking the releaser
            answer: 1,  // the right answer is the second choice: the handoff
            feedback: ['That branch runs only when nobody is waiting. With a waiter, fork[left] stays false and the fork passes directly to it.', null, 'csignal resumes one process from one condition queue, not everyone.', 'The releaser never waits for the fork to come back. In a classic monitor it pauses only while the woken neighbour runs, then finishes release_forks.'],  // feedback for each wrong choice (null for the right one)
            why: 'csignal performs a handoff: the waiter resumes and the fork never lies on the table, so no other philosopher can take it first.' },  // explanation: the fork goes straight to the waiter and never lies on the table
          { q: 'A scheme lets a hungry philosopher pick up its two forks only in a single step, and only when both are free. Which statement is true?',  // quiz question 12 (multiple choice): what is true of the both-or-neither scheme
            choices: ['It can deadlock, because each philosopher may hold one fork while waiting for its second', 'It cannot starve anyone, because nobody ever holds one fork while waiting for another', 'It needs a room semaphore that seats at most four philosophers to avoid deadlock', 'It cannot deadlock, but a philosopher whose two neighbours’ meals keep overlapping can starve'],  // the choices: it can deadlock, it cannot starve anyone, it needs a room semaphore, or it cannot deadlock but can starve
            answer: 3,  // the right answer is the fourth choice: deadlock-free but able to starve
            feedback: ['Under this rule nobody holds one fork while waiting, so hold and wait is gone and deadlock is impossible.', 'Freedom from hold and wait prevents deadlock, not starvation: the two forks may never be free at the same moment.', 'It is already deadlock-free on its own, because no philosopher ever holds one fork while waiting for another.', null],  // feedback for each wrong choice (null for the right one)
            why: 'Deadlock freedom says someone can always make progress; starvation freedom says everyone eventually does. This scheme gives the first but not the second unless a fairness rule is added.' },  // explanation: deadlock freedom and starvation freedom are different promises
        ],  // closes the quiz
      },  // ends step 10
    ],  // closes the list of steps
    notes: `${/* notes: the reading text for this section, shown in the Notes panel, written as HTML */''}
      <h3>The dining philosophers problem</h3>${/* notes heading: the dining philosophers problem */''}
      <p>Five philosophers sit at a round table and alternate between thinking and eating. There is a bowl of spaghetti in the middle, a plate at each seat and <b>one fork between each pair of neighbours</b>, five forks in total. To eat, a philosopher needs <b>both</b> neighbouring forks: the one on its left and the one on its right (from its own seat). A fork can be held by only one philosopher at a time, so neighbours compete for the fork they share.</p>${/* notes paragraph: the table, the shared forks and the two-fork rule */''}
      <p>Number the seats 0 to 4. Philosopher i’s left fork is fork i and its right fork is fork (i + 1) mod 5, so fork k is shared by philosophers k − 1 and k. Each meal uses two of the five forks, so <b>at most two philosophers can eat at once</b>, and never two neighbours.</p>${/* notes paragraph: how seats and forks are numbered, and why at most two can eat at once */''}
      <p>A solution is a ritual every philosopher follows. It must guarantee:</p>${/* lead-in to the three requirements */''}
      <ol>${/* start of the numbered list of requirements */''}
        <li><b>Mutual exclusion:</b> no fork is used by two philosophers at the same time.</li>${/* requirement: mutual exclusion on forks */''}
        <li><b>No deadlock:</b> the table never reaches a state where everyone waits forever.</li>${/* requirement: no deadlock */''}
        <li><b>No starvation:</b> every hungry philosopher eventually eats.</li>${/* requirement: no starvation */''}
      </ol>${/* ends the list */''}
      <p><b>Why it matters:</b> the philosophers are threads and the forks are locks. Any thread that needs two shared resources at once (two bank accounts for a transfer, two files for a copy) faces the same danger.</p>${/* notes paragraph: why it matters, with philosophers as threads and forks as locks */''}

      <h4>First attempt: one semaphore per fork</h4>${/* notes heading: the first attempt, one semaphore per fork */''}
      <pre>semaphore fork[5] = {1, 1, 1, 1, 1};   // 1 means "on the table"${/* shown code in the notes, line 1: the five fork semaphores */''}
void philosopher(int i) {${/* shown code in the notes, line 2: the philosopher procedure */''}
  while (true) {${/* shown code in the notes, line 3: the endless loop */''}
    think();${/* shown code in the notes, line 4: thinking */''}
    semWait(fork[i]);                 // left fork${/* shown code in the notes, line 5: wait for the left fork */''}
    semWait(fork[(i + 1) % 5]);       // right fork${/* shown code in the notes, line 6: wait for the right fork */''}
    eat();${/* shown code in the notes, line 7: eating */''}
    semSignal(fork[(i + 1) % 5]);     // right fork back${/* shown code in the notes, line 8: right fork back */''}
    semSignal(fork[i]);               // left fork back${/* shown code in the notes, line 9: left fork back */''}
  }${/* shown code in the notes, line 10: end of the loop */''}
}</pre>${/* shown code in the notes, line 11: end of the procedure, and the end of the code block */''}
      <p>Each fork semaphore starts at 1, so only one philosopher can hold a fork: mutual exclusion holds. But if all five become hungry together and each picks up its left fork, every right fork is already in a neighbour’s hand. Each philosopher blocks on its right fork while holding its left one, and every fork semaphore ends at −1 (one waiter each). P0 waits for P1, P1 for P2, P2 for P3, P3 for P4 and P4 for P0: <b>deadlock</b>. Nobody broke the rules; the timing alone caused it.</p>${/* notes paragraph: how all five grabbing left leads to deadlock, with every semaphore at -1 */''}

      <h4>The four deadlock conditions at the frozen table</h4>${/* notes heading: the four deadlock conditions at the frozen table */''}
      <table>${/* start of the conditions table */''}
        <tr><th>Condition</th><th>How it appears</th><th>How it could be broken</th></tr>${/* header row: condition, how it appears, how it could be broken */''}
        <tr><td>Mutual exclusion</td><td>Each fork is in exactly one hand.</td><td>Cannot be dropped: two people cannot share one fork.</td></tr>${/* table row: mutual exclusion */''}
        <tr><td>Hold and wait</td><td>Everyone holds its left fork while waiting for the right one.</td><td>Take both forks in one step or none; or need only one fork.</td></tr>${/* table row: hold and wait */''}
        <tr><td>No preemption</td><td>Nobody may take a fork out of a neighbour’s hand.</td><td>Put the left fork back if the right one is busy, and retry. Danger: livelock, all five picking up and putting down in step forever.</td></tr>${/* table row: no preemption, with the livelock danger */''}
        <tr><td>Circular wait</td><td>The wait-for graph is a loop P0 → P1 → P2 → P3 → P4 → P0.</td><td>Room semaphore, asymmetric order, or a monitor.</td></tr>${/* table row: circular wait */''}
      </table>${/* ends the table */''}
      <p>Two quick fixes change the problem rather than solve it: <b>more forks</b> (everyone owns a pair, so nothing is shared; real systems often have only one copy of a resource) and <b>eat with one fork</b> (no hold and wait, but the job changes).</p>${/* notes paragraph: the two quick fixes that change the problem instead of solving it */''}

      <h4>The standard fix: a room semaphore of 4</h4>${/* notes heading: the room semaphore fix */''}
      <pre>semaphore fork[5] = {1, 1, 1, 1, 1};${/* shown code in the notes, line 1: the five fork semaphores */''}
semaphore room = 4;    // at most four seated${/* shown code in the notes, line 2: the room semaphore of 4 */''}
void philosopher(int i) {${/* shown code in the notes, line 3: the philosopher procedure */''}
  while (true) {${/* shown code in the notes, line 4: the endless loop */''}
    think();${/* shown code in the notes, line 5: thinking */''}
    semWait(room);     // sit down${/* shown code in the notes, line 6: wait for a seat */''}
    semWait(fork[i]);${/* shown code in the notes, line 7: wait for the left fork */''}
    semWait(fork[(i + 1) % 5]);${/* shown code in the notes, line 8: wait for the right fork */''}
    eat();${/* shown code in the notes, line 9: eating */''}
    semSignal(fork[(i + 1) % 5]);${/* shown code in the notes, line 10: right fork back */''}
    semSignal(fork[i]);${/* shown code in the notes, line 11: left fork back */''}
    semSignal(room);   // stand up${/* shown code in the notes, line 12: give up the seat */''}
  }${/* shown code in the notes, line 13: end of the loop */''}
}</pre>${/* shown code in the notes, line 14: end of the procedure, and the end of the code block */''}
      <p>Why it works (the <b>pigeonhole principle</b>): at most four philosophers sit at the table, but there are five forks. If every fork were taken, one of the four would hold two forks and be eating, so it will finish and release them. And the seated philosopher whose right-hand neighbour is not seated never waits for its right fork, because nobody else can be holding it. Someone can always make progress, so a full circle of waiting cannot form: <b>no deadlock</b>. With first-in-first-out (strong) semaphores every waiter is served in turn, so there is <b>no starvation</b> either. If all five call semWait(room) before anyone leaves, room goes 4 → −1: four sit, one waits at the door. A room of 5 admits everybody and brings the deadlock back; smaller values also avoid deadlock but allow less parallelism (a room of 1 lets only one philosopher eat at a time). A model check of every order of moves confirms: rooms 1 to 4 never freeze; 5 can.</p>${/* notes paragraph: why the room of 4 works (pigeonhole principle), why FIFO semaphores stop starvation, and what other room sizes do */''}

      <h4>Asymmetric order (resource ordering)</h4>${/* notes heading: the asymmetric order, which is resource ordering */''}
      <p>Let at least one philosopher pick up its <b>right</b> fork first. The classic version: number the forks and always pick up the lower-numbered fork first. For philosophers 0 to 3 the lower number is the left fork; for philosopher 4 (forks 4 and 0) it is the right fork, fork 0. A right-hander and its right-hand neighbour (a left-hander) now reach first for the same fork, so the loser holds nothing while it waits, and the waits cannot all point the same way round the table. This is <b>resource ordering</b> from deadlock prevention: it breaks circular wait. Any mix of left- and right-first philosophers works; all left or all right can freeze.</p>${/* notes paragraph: lower-numbered fork first makes P4 a right-hander, and any mix of left and right habits breaks circular wait */''}

      <h4>The monitor solution</h4>${/* notes heading: the monitor solution */''}
      <pre>monitor dining_controller;${/* shown code in the notes: the monitor's name */''}
cond ForkReady[5];                    // a waiting line per fork${/* shown code in the notes: one waiting line per fork */''}
boolean fork[5];                      // true = on the table (all start true)${/* shown code in the notes: the fork[ ] array, true while a fork is on the table */''}
void get_forks(int pid) {${/* shown code in the notes: get_forks begins */''}
  int left = pid, right = (pid + 1) % 5;${/* shown code in the notes: the left and right fork numbers */''}
  if (!fork[left]) cwait(ForkReady[left]);    // wait, holding nothing${/* shown code in the notes: wait for the left fork, holding nothing */''}
  fork[left] = false;${/* shown code in the notes: take the left fork */''}
  if (!fork[right]) cwait(ForkReady[right]);  // wait, holding left${/* shown code in the notes: wait for the right fork, holding the left */''}
  fork[right] = false;${/* shown code in the notes: take the right fork */''}
}${/* shown code in the notes: end of get_forks */''}
void release_forks(int pid) {${/* shown code in the notes: release_forks begins */''}
  int left = pid, right = (pid + 1) % 5;${/* shown code in the notes: the same two fork numbers */''}
  if (empty(ForkReady[left])) fork[left] = true;   // back on the table${/* shown code in the notes: left fork back on the table if nobody waits for it... */''}
  else csignal(ForkReady[left]);                   // hand it to the waiter${/* shown code in the notes: ...otherwise handed straight to the waiter */''}
  if (empty(ForkReady[right])) fork[right] = true;${/* shown code in the notes: the same for the right fork, back on the table... */''}
  else csignal(ForkReady[right]);${/* shown code in the notes: ...or handed to its waiter */''}
}${/* shown code in the notes: end of release_forks */''}
void philosopher(int k) {${/* shown code in the notes: the philosopher procedure */''}
  while (true) { think(); get_forks(k); eat(); release_forks(k); }${/* shown code in the notes: the whole loop on one line: think, get the forks, eat, release them */''}
}</pre>${/* shown code in the notes: end of the procedure, and the end of the code block */''}
      <p>Only one philosopher is active inside the monitor at a time, so taking the left fork and checking the right one happen in one visit with nobody slipping in between. A philosopher may still wait in ForkReady[right] while holding its left fork, but the circle cannot close: in an all-left state, whoever took its left fork first would have found its right fork free and taken it too. csignal performs a <b>handoff</b>: the waiter resumes at once (classic monitor semantics) and gets the fork directly, so no neighbour can grab it first. Only two philosophers share a fork, so each ForkReady queue holds at most one waiter, served at that fork’s next release: as long as meals end, <b>nobody starves</b>.</p>${/* notes paragraph: why the monitor's circle cannot close, and how the csignal handoff prevents starvation */''}

      <h4>Deadlock freedom is not starvation freedom</h4>${/* notes heading: deadlock freedom versus starvation freedom */''}
      <p><b>Deadlock freedom</b>: some process can always make progress. <b>Starvation freedom</b>: every process eventually does. The rule “pick up both forks in one step, only when both are free” never deadlocks (nobody holds and waits), but if P1 and P3 overlap their meals, f2 and f3 are each free at times and never at the same time, so P2 can wait forever. Adding fairness (defer to a neighbour that has been hungry longer, much as a FIFO queue would) lets P2 eat, at the price of forks sometimes lying idle.</p>${/* notes paragraph: how the both-or-neither rule starves P2, and how a fairness rule fixes it at a cost */''}
      <p><b>Testing is not proof:</b> random schedules reveal the first attempt’s deadlock only sometimes (16 of 100 runs of 300 moves in this guide’s lab), while an exhaustive model check proves the room, asymmetric and monitor solutions can never freeze.</p>`,  // notes paragraph: random testing finds the first attempt's deadlock only sometimes, while the model check proves the fixes; end of the notes
  });  // closes the section object and the Guide.section call
})();  // ends and immediately runs the wrapping function
