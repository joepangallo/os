// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   5.7  Readers/Writers Problem
   One shared data area, many readers, a few writers.
   Helpers (semaphore engine, code tables, drawing) live inside this IIFE
   so nothing leaks into the global scope.
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its helpers stay private to this file
  'use strict';  // turns on strict mode: the browser reports common mistakes as errors instead of silently ignoring them

  /* ---------------------------------------------------------------
     1. The code, written ONCE as tables of [code, comment, operation].
        Both the listings students read and the programs the simulator
        runs are generated from these tables, so a highlighted line is
        always exactly the line that just executed.
     --------------------------------------------------------------- */
  const W_ = (s) => ({ k: 'wait', s });  // W_(s) describes the operation "semWait on semaphore s" for the simulator
  const S_ = (s) => ({ k: 'signal', s });  // S_(s) describes the operation "semSignal on semaphore s"
  const INC = (v) => ({ k: 'inc', v });  // INC(v) describes "add 1 to the shared counter v"
  const DEC = (v) => ({ k: 'dec', v });  // DEC(v) describes "subtract 1 from the shared counter v"
  const WORK = { k: 'work' };  // WORK stands for the reading or writing itself (READUNIT or WRITEUNIT)
  const CODE = {  // CODE: both solutions as tables; each row is [line of code, its on-screen comment, the operation the simulator runs]
    rp: {  // rp: the readers-priority solution
      R: [  // R: the reader's code, nine lines
        ['semWait(x);', 'lock the counter', W_('x')],  // reader line 1: lock the semaphore x that protects readcount
        ['readcount++;', 'one more reader inside', INC('readcount')],  // reader line 2: count one more reader inside
        ['if (readcount == 1) semWait(wsem);', 'first reader bars writers', { k: 'waitIf', v: 'readcount', eq: 1, s: 'wsem' }],  // reader line 3: the first reader in waits on wsem, which keeps writers out for the whole group
        ['semSignal(x);', 'unlock the counter', S_('x')],  // reader line 4: unlock x so other readers can update readcount
        ['READUNIT();', 'read (others may too)', WORK],  // reader line 5: read the data, possibly alongside other readers
        ['semWait(x);', 'lock the counter again', W_('x')],  // reader line 6: lock x again before changing readcount
        ['readcount--;', 'one fewer reader inside', DEC('readcount')],  // reader line 7: count one reader fewer
        ['if (readcount == 0) semSignal(wsem);', 'last out lets writers in', { k: 'signalIf', v: 'readcount', eq: 0, s: 'wsem' }],  // reader line 8: the last reader out signals wsem so a writer may go in
        ['semSignal(x);', 'unlock the counter', S_('x')],  // reader line 9: unlock x
      ],  // closes the reader's code
      W: [  // W: the writer's code, three lines
        ['semWait(wsem);', 'wait until data is free', W_('wsem')],  // writer line 1: wait on wsem until nobody is using the data
        ['WRITEUNIT();', 'write, completely alone', WORK],  // writer line 2: write, with the data to itself
        ['semSignal(wsem);', 'hand the data back', S_('wsem')],  // writer line 3: signal wsem to give the data back
      ],  // closes the writer's code
    },  // closes the readers-priority solution
    wp: {  // wp: the writers-priority solution
      R: [  // R: the reader's code, thirteen lines
        ['semWait(z);', 'readers line up here', W_('z')],  // reader line 1: wait on z, so at most one reader at a time queues on rsem
        ['semWait(rsem);', 'closed while writers wait', W_('rsem')],  // reader line 2: wait on rsem, the reader gate that writers close
        ['semWait(x);', 'lock readcount', W_('x')],  // reader line 3: lock x, which protects readcount
        ['readcount++;', 'one more reader inside', INC('readcount')],  // reader line 4: count one more reader inside
        ['if (readcount == 1) semWait(wsem);', 'first reader bars writers', { k: 'waitIf', v: 'readcount', eq: 1, s: 'wsem' }],  // reader line 5: the first reader in waits on wsem to keep writers out
        ['semSignal(x);', 'unlock readcount', S_('x')],  // reader line 6: unlock x
        ['semSignal(rsem);', 'reopen the reader gate', S_('rsem')],  // reader line 7: reopen the reader gate rsem
        ['semSignal(z);', 'next reader may go on', S_('z')],  // reader line 8: signal z so the next reader may come forward
        ['READUNIT();', 'read (others may too)', WORK],  // reader line 9: read the data
        ['semWait(x);', 'lock readcount', W_('x')],  // reader line 10: lock x again
        ['readcount--;', 'one fewer reader inside', DEC('readcount')],  // reader line 11: count one reader fewer
        ['if (readcount == 0) semSignal(wsem);', 'last out lets writers in', { k: 'signalIf', v: 'readcount', eq: 0, s: 'wsem' }],  // reader line 12: the last reader out signals wsem
        ['semSignal(x);', 'unlock readcount', S_('x')],  // reader line 13: unlock x
      ],  // closes the reader's code
      W: [  // W: the writer's code, eleven lines
        ['semWait(y);', 'lock writecount', W_('y')],  // writer line 1: lock y, which protects writecount
        ['writecount++;', 'one more writer wants in', INC('writecount')],  // writer line 2: count one more writer that wants in
        ['if (writecount == 1) semWait(rsem);', 'first one shuts the gate', { k: 'waitIf', v: 'writecount', eq: 1, s: 'rsem' }],  // writer line 3: the first such writer waits on rsem, closing the gate to new readers
        ['semSignal(y);', 'unlock writecount', S_('y')],  // writer line 4: unlock y
        ['semWait(wsem);', 'then wait for the data', W_('wsem')],  // writer line 5: wait on wsem for the data itself
        ['WRITEUNIT();', 'write, completely alone', WORK],  // writer line 6: write, alone
        ['semSignal(wsem);', 'hand the data back', S_('wsem')],  // writer line 7: signal wsem to give the data back
        ['semWait(y);', 'lock writecount', W_('y')],  // writer line 8: lock y again
        ['writecount--;', 'one fewer writer', DEC('writecount')],  // writer line 9: count one writer fewer
        ['if (writecount == 0) semSignal(rsem);', 'last one reopens the gate', { k: 'signalIf', v: 'writecount', eq: 0, s: 'rsem' }],  // writer line 10: the last writer signals rsem to reopen the gate for readers
        ['semSignal(y);', 'unlock writecount', S_('y')],  // writer line 11: unlock y
      ],  // closes the writer's code
    },  // closes the writers-priority solution
  };  // closes CODE
  const SEMS = { rp: ['x', 'wsem'], wp: ['z', 'rsem', 'x', 'y', 'wsem'] };  // SEMS: which semaphores each solution uses, in the order the drawing lists them
  // aligned comments for the wide listings; compact (no alignment padding) for
  // the printed notes and for phones, where the comment wraps onto its own line
  function listing(rows, compact) {  // listing(rows, compact) turns a code table into the text students read, with each comment after its line
    const pad = compact ? 0 : Math.max(...rows.map((r) => r[0].length)) + 1;  // pad is the column where comments start: one past the longest line of code, or none when compact
    return rows.map((r) => (compact ? r[0] + '  ' : r[0].padEnd(pad)) + '// ' + r[1]).join('\n');  // joins the rows as "code // comment", lined up in a column unless compact
  }  // ends listing()
  function codeBox(ctx, rows) {  // codeBox(ctx, rows) builds a code listing element for one table, with no line numbers
    const pre = ctx.ui.code(listing(rows, ctx.narrow), { nums: false, fontSize: 13, cls: ctx.narrow ? 'r57-wrap' : '' });  // on a phone-width screen the listing is compact and uses the r57-wrap style so comments wrap onto their own lines
    pre.style.flex = 'none';  // stops the listing from stretching or shrinking inside a flexible column
    return pre;  // hands the listing back to the caller
  }  // ends codeBox()
  // lines (1-based) of a listing that mention a word, e.g. linesWith(CODE.wp.R, 'rsem')
  function linesWith(rows, word) {  // linesWith(rows, word) finds the line numbers whose code mentions a word, for highlighting
    const re = new RegExp('\\b' + word + '\\b');  // a regular expression (a text pattern) matching the word as a whole word only
    return rows.map((r, i) => (re.test(r[0]) ? i + 1 : 0)).filter(Boolean);  // keeps the numbers of the matching lines, counting from 1
  }  // ends linesWith()

  /* ---------------------------------------------------------------
     2. A tiny, faithful semaphore machine.
        semWait: value - 1; if the value is now negative the caller
        blocks at the back of that semaphore's FIFO queue.
        semSignal: value + 1; if the value is still <= 0 the process
        at the front of the queue is released (it moves past its wait).
        Every visitor runs its code once: arrive, read or write, leave.
     --------------------------------------------------------------- */
  function engine(pol) {  // engine(pol) builds a semaphore simulator for one solution ('rp' or 'wp'); every step that traces code uses it
    const prog = {};  // prog will hold the runnable program for readers (R) and writers (W)
    ['R', 'W'].forEach((k) => (prog[k] = CODE[pol][k].map((r, i) => Object.assign({ ln: i + 1 }, r[2]))));  // turns each code table into a list of operations, each tagged with its line number (ln)
    const workIdx = { R: prog.R.findIndex((o) => o.k === 'work'), W: prog.W.findIndex((o) => o.k === 'work') };  // workIdx remembers which line is the READUNIT or WRITEUNIT in each program
    const E = { pol, names: SEMS[pol], sem: {}, vars: { readcount: 0, writecount: 0 }, procs: [], t: 0, n: { R: 0, W: 0 },  // E is the simulator's whole state: policy, semaphore names and values, the two counters, the processes, the clock, and id counters
      ran: [], woke: [], done: { R: 0, W: 0 }, maxWait: { R: 0, W: 0 }, workIdx };  // ...plus lines just run, processes just woken, how many of each kind finished, the longest wait of each kind, and workIdx
    E.names.forEach((nm) => (E.sem[nm] = { v: 1, q: [] }));  // every semaphore starts at 1 (open) with an empty waiting queue
    const get = (id) => (typeof id === 'string' ? E.procs.find((p) => p.id === id) : id);  // get(id) finds a process by its name (such as "R2"), or passes a process object straight through
    E.get = get;  // makes get available to the steps outside the engine
    // p.held lists the semaphores p itself acquired and has not yet signalled
    // (used only to label who holds what; the semaphore logic ignores it)
    E.arrive = (kind, dur) => {  // E.arrive(kind, dur) creates a new reader (R) or writer (W) at the first line of its code
      const p = { id: kind + ++E.n[kind], kind, pc: 0, st: 'run', on: null, left: 0, dur: dur || 4, t0: E.t, tIn: null, held: [] };  // a process: name, kind, program counter pc (index of its next line), state, semaphore it waits on, work left, work length, arrival and entry times, semaphores held
      E.procs.push(p);  // adds it to the list of processes
      return p;  // returns the new process to the caller
    };  // ends E.arrive
    function wait(p, nm) {  // wait(p, nm) carries out semWait on semaphore nm for process p
      const sm = E.sem[nm];  // sm is that semaphore's value and queue
      sm.v--;  // semWait always subtracts 1 first
      if (sm.v < 0) { p.st = 'blk'; p.on = nm; sm.q.push(p.id); } else { p.pc++; p.held.push(nm); }  // a negative value means p must block at the back of the queue; otherwise p moves past the wait and now holds nm
    }  // ends wait()
    function signal(nm, by) {  // signal(nm, by) carries out semSignal on semaphore nm, done by process by
      const sm = E.sem[nm];  // sm is that semaphore's value and queue
      sm.v++;  // semSignal always adds 1 first
      if (by && by.held.includes(nm)) by.held.splice(by.held.indexOf(nm), 1);  // the signalling process no longer holds nm (this list is used only for labels)
      if (sm.v <= 0 && sm.q.length) {  // if the value is still 0 or below and someone is waiting, the process at the front of the queue is released
        const w = get(sm.q.shift());  // takes that process off the front of the queue (first in, first out)
        w.st = 'run'; w.on = null; w.pc++; w.held.push(nm);  // it can run again, waits on nothing, moves past its semWait line and now holds nm
        E.woke.push(w.id);  // records that it just woke, so the drawing can highlight it
      }  // ends the release
    }  // ends signal()
    function finish(p) { p.st = 'done'; E.done[p.kind]++; }  // finish(p) marks a process as done and counts it
    // execute exactly one line of p's code
    E.exec = (id) => {  // E.exec(id) runs exactly one line of process id's code; the step-by-step buttons use it
      const p = get(id);  // p is the process
      if (!p || p.st !== 'run') return;  // only a process in the "run" state can execute a line
      const op = prog[p.kind][p.pc];  // op is the operation on its current line
      if (!op) { finish(p); return; }  // past the last line: the process is done
      E.ran.push({ kind: p.kind, ln: op.ln, id: p.id });  // records which line just ran, so the listing can highlight it
      if (op.k === 'wait') wait(p, op.s);  // wait line: do a semWait (p may block here)
      else if (op.k === 'signal') { signal(op.s, p); p.pc++; }  // signal line: do a semSignal and move to the next line
      else if (op.k === 'inc') { E.vars[op.v]++; p.pc++; }  // increment line: add 1 to the counter and move on
      else if (op.k === 'dec') { E.vars[op.v]--; p.pc++; }  // decrement line: subtract 1 from the counter and move on
      else if (op.k === 'waitIf') { if (E.vars[op.v] === op.eq) wait(p, op.s); else p.pc++; }  // conditional wait: do the semWait only if the counter equals the given value (for example readcount == 1)
      else if (op.k === 'signalIf') { if (E.vars[op.v] === op.eq) signal(op.s, p); p.pc++; }  // conditional signal: do the semSignal only if the counter equals the value; move on either way
      else if (op.k === 'work') {  // work line: the process starts reading or writing
        p.st = 'work'; p.left = p.dur; p.tIn = E.t;  // it is now inside the data, with its full work time left; tIn records when it got in
        E.maxWait[p.kind] = Math.max(E.maxWait[p.kind], E.t - p.t0);  // updates the longest time any process of this kind waited before getting in
      }  // ends the work case
      if (p.st === 'run' && p.pc >= prog[p.kind].length) finish(p);  // if that line was the last one and the process can still run, it is done
    };  // ends E.exec
    // run p until it blocks, starts reading/writing, or leaves (or at most n lines)
    E.run = (id, n) => {  // E.run(id, n) runs a process line after line until it blocks, starts reading or writing, or leaves (or for at most n lines)
      const p = get(id);  // p is the process
      for (let k = 0; p && p.st === 'run' && (n == null || k < n); k++) E.exec(p);  // keeps executing lines while p is runnable and the limit n (if given) is not reached
    };  // ends E.run
    E.endWork = (id) => { const p = get(id); if (p && p.st === 'work') { p.st = 'run'; p.pc++; p.left = 0; } };  // E.endWork(id) ends a process's read or write, putting it back to "run" at the line after the work line
    // let every runnable process run (oldest first) until nobody can move
    E.settle = () => {  // E.settle() lets every runnable process run, oldest first, until nobody can move
      for (let g = 0; g < 500; g++) { const p = E.procs.find((q) => q.st === 'run'); if (!p) break; E.run(p); }  // repeatedly picks the first runnable process and runs it; the 500-round limit is a safety stop against an endless loop
    };  // ends E.settle
    E.mark = () => { E.ran = []; E.woke = []; };  // E.mark() clears the "just ran" and "just woke" records before the next step
    // one clock tick of the continuous simulation
    E.tick = (arrivals) => {  // E.tick(arrivals) advances the continuous simulation by one clock tick
      E.t++;  // moves the clock forward
      E.procs.forEach((p) => { if (p.st === 'work' && --p.left <= 0) E.endWork(p); });  // every process that is reading or writing uses one unit of its work time and leaves the data when it runs out
      (arrivals || []).forEach(([k, d]) => E.arrive(k, d));  // creates any new arrivals for this tick, each given as [kind, duration]
      E.settle();  // lets everybody who can move run until they block or get inside
      E.procs = E.procs.filter((p) => p.st !== 'done');  // forgets finished processes
    };  // ends E.tick
    E.waiting = (kind) => E.procs.filter((p) => p.kind === kind && p.tIn == null && p.st !== 'done');  // E.waiting(kind) lists the processes of one kind that have not yet got in to the data
    E.inside = () => E.procs.filter((p) => p.st === 'work');  // E.inside() lists the processes that are reading or writing right now
    // who holds a semaphore right now (for labels only). wsem can belong to the
    // readers as a GROUP (first in took it, last out returns it) and rsem to the
    // writers as a group (first interested writer closed it, last one reopens it).
    E.holder = (nm) => {  // E.holder(nm) returns a short label saying who holds semaphore nm, for the drawing only
      if (E.sem[nm].v > 0) return '';  // an open semaphore (value above 0) is held by nobody
      const hs = E.procs.filter((p) => p.st !== 'done' && p.held.includes(nm));  // hs: the processes that still hold nm themselves
      const w = hs.find((p) => p.kind === 'W'), r = hs.find((p) => p.kind === 'R');  // w and r are the first writer and first reader among them
      if (nm === 'wsem') {  // special case for wsem, which the readers can hold as a group
        if (w) return 'held by ' + w.id;  // a writer holding wsem is named
        if (E.vars.readcount > 0) return 'held by the readers';  // otherwise, if readers are reading, the readers as a group hold it (the first one in may already have left)
      }  // ends the wsem case
      if (nm === 'rsem') {  // special case for rsem, which the writers can hold as a group
        if (r) return 'held by ' + r.id;  // a reader holding rsem (just passing the gate) is named
        if (E.vars.writecount > 0) return 'closed by the writers';  // otherwise, if writers are waiting or writing, they have closed it as a group
      }  // ends the rsem case
      return hs.length ? 'held by ' + hs.map((p) => p.id).join(', ') : 'in use';  // any other case: list the holders by name, or just say "in use"
    };  // ends E.holder
    return E;  // hands the finished simulator back to the step that asked for it
  }  // ends engine()

  /* ---------------------------------------------------------------
     3. Drawing: the shared data "room", then one row per semaphore
        showing its value, who holds it, and its FIFO waiting queue.
     --------------------------------------------------------------- */
  const fmtV = (v) => (v < 0 ? '−' + -v : String(v));  // fmtV(v) writes a semaphore value with a proper minus sign for negative numbers
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);  // plural(n, one, many) writes a count with the right word, such as "1 reader" or "3 readers"
  function tok(s, p, x, y, o = {}) {  // tok(s, p, x, y, o) draws one process as a rounded token with its name, centred at (x, y); o.small draws a smaller one
    const w = o.small ? 42 : 50, hh = o.small ? 24 : 30;  // token width and height: 50 by 30, or 42 by 24 when small
    return s('g', { class: 'tok ' + (p.kind === 'R' ? 'tk-r' : 'tk-w') + (o.cls ? ' ' + o.cls : '') },  // a group (g) styled as a reader or a writer, plus any extra class such as wait, new or bad
      s('rect', { x: x - w / 2, y: y - hh / 2, width: w, height: hh, rx: hh / 2 }),  // the token's pill-shaped outline
      s('text', { x, y: y + 4.5, 'text-anchor': 'middle' }, p.id));  // the process name in the middle of the token
  }  // ends tok()
  function drawRW(s, svg, E, o = {}) {  // drawRW(s, svg, E, o) draws the simulator's state into an SVG: the shared-data "room" on top, then one row per semaphore
    const W = o.W || 560, RH = o.roomH || 88, rowH = o.rowH || 31, top = 24;  // sizes: drawing width W, room height RH, semaphore row height rowH, and the room's top edge (all adjustable through o)
    const compact = W < 450;   // phones: no STATE column, so the queue gets the room
    const headY = top + RH + 22, rowsTop = headY + 7;  // headY is where the column headings go under the room; rowsTop is where the first semaphore row starts
    const H = rowsTop + E.names.length * rowH - 3;  // H is the total height needed for the room and all the semaphore rows
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);  // sets the drawing's coordinate system to fit exactly W by H
    const inside = E.inside(), wr = inside.find((p) => p.kind === 'W');  // inside: everyone reading or writing now; wr is the writer among them, if any
    const K = [];  // K collects the shapes to draw
    K.push(s('text', { x: 2, y: 16, 'font-weight': 800, 'font-size': 15 }, o.title || 'Shared data'));  // title in the top-left corner ("Shared data" unless o.title says otherwise)
    K.push(s('text', { x: W - 2, y: 16, 'text-anchor': 'end', class: 's-monot', 'font-size': 14, 'font-weight': 700 },  // top-right: the current value of readcount...
      'readcount = ' + E.vars.readcount + (E.pol === 'wp' ? (compact ? '  writecount = ' : '   writecount = ') + E.vars.writecount : '')));  // ...and, in the writers-priority solution, writecount as well
    K.push(s('rect', { x: 1, y: top, width: W - 2, height: RH, rx: 14, class: wr ? 's-accent' : inside.length ? 's-proc' : 's-panel', 'stroke-width': 2 }));  // the room: highlight colour while a writer is inside, reader colour while readers are inside, plain when empty
    K.push(s('text', { x: 14, y: top + 21, class: 's-sub', 'font-size': 13.5, 'font-weight': 700 },  // the line of text inside the room...
      wr ? wr.id + ' is writing, alone' : inside.length ? plural(inside.length, 'reader is', 'readers are') + ' reading' : 'Nobody is using the data'));  // ...says who is writing, how many are reading, or that nobody is using the data
    const gap = 58, maxN = Math.max(1, Math.floor((W - 40) / gap));  // tokens sit 58 units apart; maxN is how many fit across the room
    const shown = inside.slice(0, maxN), cx0 = W / 2 - ((shown.length - 1) * gap) / 2, cy = top + RH / 2 + 11;  // shown: the tokens that fit; cx0 centres them as a group; cy is their vertical position
    shown.forEach((p, i) => K.push(tok(s, p, cx0 + i * gap, cy, { cls: E.woke.includes(p.id) ? 'new' : '' })));  // draws a token for each process inside, highlighted if it just got in
    if (inside.length > maxN) K.push(s('text', { x: W - 14, y: top + 21, 'text-anchor': 'end', class: 's-sub', 'font-size': 13.5, 'font-weight': 700 }, '+' + (inside.length - maxN) + ' more'));  // if more are inside than fit, a "+N more" note appears in the corner
    const cVal = 98, cState = 126, cQ = compact ? 132 : o.qx || 280;  // column positions: VALUE, STATE and the WAITING QUEUE (which moves left on phones, where there is no STATE column)
    const maxQ = Math.max(1, Math.floor((W - cQ - 40) / 47));  // maxQ: how many small waiting tokens fit in the queue column
    [['NAME', 2, 'start'], ['VALUE', cVal, 'middle'], compact ? null : ['STATE', cState, 'start'], ['WAITING QUEUE (front first)', cQ, 'start']].filter(Boolean).forEach(([t, x, a]) =>  // the column headings; STATE is left out on phones
      K.push(s('text', { x, y: headY, 'text-anchor': a, class: 's-sub', 'font-size': 12.5, 'font-weight': 700, 'letter-spacing': '.04em' }, t)));  // draws each heading at its column position
    E.names.forEach((nm, i) => {  // draws one row per semaphore
      const sm = E.sem[nm], y = rowsTop + i * rowH, cyR = y + (rowH - 5) / 2;  // sm is the semaphore; y is the row's top and cyR its vertical middle
      if (i) K.push(s('line', { x1: 1, x2: W - 1, y1: y - 3, y2: y - 3, class: 's-muted', 'stroke-width': 1 }));  // a thin line separates each row from the one above
      K.push(s('rect', { x: 1, y, width: 66, height: rowH - 5, rx: 7, class: 's-os', 'stroke-width': 1.5 }));  // a small box in the operating-system colour holds the semaphore's name
      K.push(s('text', { x: 34, y: cyR + 5, 'text-anchor': 'middle', class: 's-monot', 'font-weight': 700, 'font-size': 14 }, nm));  // the semaphore's name inside that box, in code font
      K.push(s('text', { x: cVal, y: cyR + 6, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 17, style: `fill:var(--${sm.v > 0 ? 'ok' : sm.v === 0 ? 'warn' : 'bad'})` }, fmtV(sm.v)));  // its value: green when open (above 0), amber at 0, red when negative (someone is waiting)
      if (!compact) K.push(s('text', { x: cState, y: cyR + 5, 'font-size': 13.5, class: sm.v > 0 ? 's-sub' : '' }, sm.v > 0 ? 'open' : E.holder(nm)));  // STATE column (not on phones): "open", or who holds it
      sm.q.slice(0, maxQ).forEach((id, k) => K.push(tok(s, E.get(id), cQ + 21 + k * 47, cyR, { small: true, cls: 'wait' })));  // the processes waiting on this semaphore, as small dashed tokens, front of the queue first
      if (sm.q.length > maxQ) K.push(s('text', { x: cQ + maxQ * 47 + 4, y: cyR + 5, 'font-size': 13.5, 'font-weight': 700, class: 's-sub' }, '+' + (sm.q.length - maxQ)));  // if more wait than fit, a "+N" count follows the last token
      // phones have no STATE column, so an empty queue row also says who holds the semaphore
      if (!sm.q.length) K.push(s('text', { x: cQ, y: cyR + 5, 'font-size': 13.5, class: 's-sub' }, compact && sm.v <= 0 ? 'empty · ' + E.holder(nm) : 'empty'));  // an empty queue says "empty"; on phones it also says who holds the semaphore, since there is no STATE column
    });  // ends the per-semaphore rows
    svg.replaceChildren(...K);  // replaces the old drawing with the new shapes
    return H;  // returns the height, in case the caller needs it
  }  // ends drawRW()
  // colour a code listing: green = someone is reading/writing on that line,
  // red = someone is blocked there, highlight = the lines that just ran
  function markCode(pre, E, kind) {  // markCode(pre, E, kind) colours one code listing (reader or writer) to match the simulator
    pre.clear();  // clears the old colours
    pre.mark(E.ran.filter((r) => r.kind === kind).map((r) => r.ln), 'cur');  // highlights the lines of this kind that just ran
    pre.mark(E.procs.filter((p) => p.kind === kind && p.st === 'work').map((p) => p.pc + 1), 'ok');  // turns green the line where a process of this kind is reading or writing
    pre.mark(E.procs.filter((p) => p.kind === kind && p.st === 'blk').map((p) => p.pc + 1), 'bad');  // turns red the line where a process of this kind is blocked
  }  // ends markCode()
  const LEGEND = '<span class="chip proc">R = reader</span> <span class="chip accent">W = writer</span>';  // LEGEND: two chips explaining the token letters (R = reader, W = writer), shown near the drawings

  /* ---------------------------------------------------------------
     4. The message-passing controller.
        count starts at 100 (more than the most readers there can be).
        count > 0  : no writer accepted yet; count = 100 − readers inside
                     (a write request may still sit unread in its mailbox)
        count == 0 : the accepted writer is the only one left (or writing)
        count < 0  : a writer is waiting for −count readers to leave
        One controller action happens per clock tick.
     --------------------------------------------------------------- */
  const CTRL = [  // CTRL: the controller process of the message-passing solution, as [code, comment] rows
    ['while (true) {', 'serve requests for ever'],  // controller line 1: loop for ever
    ['  if (count > 0) {', 'no writer accepted yet'],  // controller line 2: count above 0 means no writer has been accepted yet
    ['    if (!empty(finished)) {', '1st: has a reader left?'],  // controller line 3: first choice, has a reader sent "finished"?
    ['      receive(finished, msg); count++;', 'one reader fewer inside'],  // controller line 4: take that message and count one reader fewer inside
    ['    } else if (!empty(writerequest)) {', '2nd: is a writer asking?'],  // controller line 5: second choice, is a writer asking?
    ['      receive(writerequest, msg);', 'take the write request'],  // controller line 6: take the write request
    ['      writer_id = msg.id; count -= 100;', 'count = −(readers inside)'],  // controller line 7: remember the writer and subtract 100, so count becomes minus the readers still inside
    ['    } else if (!empty(readrequest)) {', '3rd: is a reader asking?'],  // controller line 8: third choice, is a reader asking?
    ['      receive(readrequest, msg); count--;', 'one reader more inside'],  // controller line 9: take the read request and count one reader more inside
    ['      send(msg.id, "OK");', 'let that reader start'],  // controller line 10: send that reader an OK so it may start
    ['    }', 'end of the three choices'],  // controller line 11: end of the three choices
    ['  }', 'end of the count > 0 case'],  // controller line 12: end of the count > 0 case
    ['  if (count == 0) {', 'only the writer is left'],  // controller line 13: count exactly 0 means only the accepted writer is left
    ['    send(writer_id, "OK");', 'let the writer start'],  // controller line 14: send the writer its OK
    ['    receive(finished, msg);', 'block until it is done'],  // controller line 15: block until the writer says it is finished
    ['    count = 100;', 'the data is free again'],  // controller line 16: reset count to 100, the data is free again
    ['  }', 'end of the count == 0 case'],  // controller line 17: end of the count == 0 case
    ['  while (count < 0) {', 'readers are still inside'],  // controller line 18: count below 0 means readers are still inside while a writer waits
    ['    receive(finished, msg); count++;', 'wait for each one to leave'],  // controller line 19: wait for each of them to send "finished"
    ['  }', 'end of the waiting loop'],  // controller line 20: end of the waiting loop
    ['}', 'end of the controller loop'],  // controller line 21: end of the controller loop
  ];  // closes CTRL
  const CLIENT = [  // CLIENT: the reader and writer code of the message-passing solution
    ['void reader(int i) {', 'reader number i'],  // reader line 1: reader number i
    ['  send(readrequest, i);', 'ask permission to read'],  // reader line 2: ask the controller for permission to read
    ['  receive(mbox[i], msg);', 'block until "OK" arrives'],  // reader line 3: block until the OK arrives in its own mailbox
    ['  READUNIT();', 'read (others may too)'],  // reader line 4: read, possibly with other readers
    ['  send(finished, i);', 'tell the controller: done'],  // reader line 5: tell the controller it has finished
    ['}', 'real readers repeat this'],  // reader line 6: end of the reader (a real reader would repeat this)
    ['void writer(int j) {', 'writer number j'],  // writer line 1: writer number j
    ['  send(writerequest, j);', 'ask permission to write'],  // writer line 2: ask for permission to write
    ['  receive(mbox[j], msg);', 'block until "OK" arrives'],  // writer line 3: block until the OK arrives
    ['  WRITEUNIT();', 'write, completely alone'],  // writer line 4: write, alone
    ['  send(finished, j);', 'tell the controller: done'],  // writer line 5: tell the controller it has finished
    ['}', 'real writers repeat this'],  // writer line 6: end of the writer (a real writer would repeat this)
  ];  // closes CLIENT
  function mpEngine() {  // mpEngine() builds a simulator of the message-passing controller and its clients
    const M = { count: 100, mb: { readrequest: [], writerequest: [], finished: [] }, cl: [], writer: null, waitW: false, t: 0, n: { R: 0, W: 0 }, lines: [], bad: [] };  // M holds count (starting at 100), the three mailboxes, the clients, the accepted writer, whether the controller waits on a writer, the clock and highlights
    const get = (id) => M.cl.find((c) => c.id === id);  // get(id) finds a client by name
    const go = (id) => { const c = get(id); c.st = 'work'; c.left = c.dur; };  // go(id) lets a client start reading or writing with its full work time
    M.request = (kind, dur) => {  // M.request(kind, dur) creates a client that has just sent a read or write request
      const c = { id: kind + ++M.n[kind], kind, st: 'asked', left: 0, dur: dur || 3 };  // a client: name, kind, state "asked", work left, and work length (3 ticks unless given)
      M.cl.push(c);  // adds it to the list of clients
      M.mb[kind === 'R' ? 'readrequest' : 'writerequest'].push(c.id);  // puts the client's request message in the readrequest or writerequest mailbox
      return c;  // returns the new client
    };  // ends M.request
    M.reading = (dur) => { const c = { id: 'R' + ++M.n.R, kind: 'R', st: 'work', left: dur, dur }; M.cl.push(c); M.count--; return c; };  // M.reading(dur) sets up a reader that is already inside reading (count goes down by 1), for starting scenarios
    M.inside = () => M.cl.filter((c) => c.st === 'work');  // M.inside() lists the clients reading or writing right now
    // one controller action; returns the narration
    M.act = () => {  // M.act() performs one controller action, following the controller code, and returns a sentence describing it
      const mb = M.mb;  // mb is the set of mailboxes
      M.lines = []; M.bad = [];  // clears the line highlights (lines = lines that ran, bad = line where the controller is blocked)
      if (M.waitW) {  // case: the controller has let a writer in and is waiting for it (inside receive(finished))
        if (mb.finished.length) {  // if the writer's finished message has arrived...
          const id = mb.finished.shift();  // ...take it from the mailbox
          M.waitW = false; M.count = 100; M.writer = null; M.lines = [15, 16];  // ...stop waiting, reset count to 100, forget the writer, and highlight lines 15 and 16
          return `${id}’s <b>finished</b> message arrives, so the controller resets count to <b>100</b>: nobody is inside any more.`;  // narration: the finished message arrived and count is back to 100
        }  // ends the message-arrived case
        M.bad = [15];  // otherwise the controller is still blocked on line 15
        return `The controller is blocked in receive(finished) until ${M.writer} finishes writing. Any new request simply waits in its mailbox.`;  // narration: blocked until the writer finishes; new requests wait in their mailboxes
      }  // ends the waiting-for-writer case
      if (M.count > 0) {  // case: count above 0, no writer accepted yet
        if (mb.finished.length) {  // first priority: a reader's finished message
          const id = mb.finished.shift(); M.count++; M.lines = [2, 3, 4];  // take it, count one reader fewer, highlight lines 2 to 4
          return `count > 0 and <b>finished</b> holds ${id}’s message, which is always served first: count++ → <b>${fmtV(M.count)}</b>.`;  // narration: finished is always served first; shows the new count
        }  // ends the finished case
        if (mb.writerequest.length) {  // second priority: a write request
          const id = mb.writerequest.shift(); M.writer = id; M.count -= 100; M.lines = [2, 3, 5, 6, 7];  // take it, remember the writer, subtract 100, highlight lines 2, 3 and 5 to 7
          return `No reader has left, but <b>writerequest</b> holds ${id}’s request, which beats any read request. count −= 100 → <b>${fmtV(M.count)}</b>` +  // narration: the write request beats any read request; shows the new count...
            (M.count < 0 ? `: ${plural(-M.count, 'reader is', 'readers are')} still inside, and ${id} must wait for them.` : ': nobody is inside, so the writer can go next.');  // ...and says whether readers are still inside (the writer must wait) or the writer can go next
        }  // ends the write-request case
        if (mb.readrequest.length) {  // third priority: a read request
          const id = mb.readrequest.shift(); M.count--; go(id); M.lines = [2, 3, 5, 8, 9, 10];  // take it, count one reader more, let the reader start, highlight lines 2, 3, 5 and 8 to 10
          return `No reader has left and no writer is asking, so the controller takes ${id}’s read request: count-- → <b>${fmtV(M.count)}</b>, and it sends ${id} an <b>OK</b>.`;  // narration: the reader gets an OK; shows the new count
        }  // ends the read-request case
        M.lines = [2, 3, 5, 8];  // nothing in any mailbox: highlight the checks that were made
        return 'count > 0 but all three mailboxes are empty, so the controller has nothing to do this tick. Add a request.';  // narration: nothing to do this tick
      }  // ends the count > 0 case
      if (M.count === 0) {  // case: count exactly 0, only the accepted writer is left
        go(M.writer); M.waitW = true; M.lines = [13, 14]; M.bad = [15];  // lets the writer start, marks the controller as waiting for it, highlights lines 13 and 14, and shows line 15 as blocked
        return `count == 0: every reader has left. The controller sends <b>OK</b> to ${M.writer}, which writes alone, and then blocks until it hears back.`;  // narration: every reader has left, so the writer gets its OK and writes alone
      }  // ends the count == 0 case
      if (mb.finished.length) {  // case: count below 0, the controller listens only to finished
        const id = mb.finished.shift(); M.count++; M.lines = [18, 19];  // take the message, count one reader fewer, highlight lines 18 and 19
        return `count &lt; 0, so the controller listens only to <b>finished</b>. ${id} has left: count++ → <b>${fmtV(M.count)}</b>` +  // narration: count goes up by one...
          (M.count === 0 ? '. That was the last reader.' : `; ${plural(-M.count, 'reader is', 'readers are')} still inside.`);  // ...and says whether that was the last reader or how many are still inside
      }  // ends the finished case
      M.bad = [19];  // no finished message yet: the controller is blocked on line 19
      return `count = ${fmtV(M.count)}: blocked in receive(finished) until one of the ${-M.count} reader${M.count === -1 ? '' : 's'} inside leaves. New requests wait in their mailboxes.`;  // narration: blocked until one of the readers inside leaves
    };  // ends M.act
    // one tick: clients that finish send "finished", then the controller acts once
    M.tick = () => {  // M.tick() advances the message-passing simulation by one clock tick
      M.t++;  // moves the clock forward
      M.cl.forEach((c) => { if (c.st === 'work' && --c.left <= 0) { c.st = 'gone'; M.mb.finished.push(c.id); } });  // every client that is working uses one unit of time; one that runs out leaves and sends "finished"
      M.cl = M.cl.filter((c) => c.st !== 'gone');  // forgets the clients that have left
      return M.act();  // then the controller acts once, and its narration is returned
    };  // ends M.tick
    return M;  // hands the finished simulator back to the step that asked for it
  }  // ends mpEngine()


  Guide.section({  // registers section 5.7 with the guide's shell, which builds its slides, glossary and quizzes from this object
    id: '5.7',  // id: the section number used in links, saved progress and the style prefix .sec-5-7
    title: 'Readers/Writers Problem',  // title: the full section name shown at the top of every step
    short: 'Readers/writers',  // short: a shorter name for the table of contents
    summary: 'Let many readers share data while each writer gets it alone: semaphore and message-passing solutions.',  // summary: the one-sentence description shown on the chapter overview page
    objectives: [  // objectives: what a student should be able to do after this section
      'State the three readers/writers rules and explain why this is neither plain mutual exclusion nor producer/consumer.',  // objective 1: state the three rules and explain why this is a different problem
      'Trace the readers-priority semaphore solution line by line and explain why a writer can starve.',  // objective 2: trace the readers-priority solution and explain writer starvation
      'Explain how rsem, y and z give writers priority, and describe the semaphore queues in the four classic situations.',  // objective 3: explain how rsem, y and z give writers priority
      'Trace the message-passing controller and read the meaning of its count variable (above zero, zero, below zero).',  // objective 4: trace the message-passing controller and read its count variable
    ],  // closes the objectives list
    terms: [  // terms: the glossary entries for this section; the shell links matching words in the text to them
      ['Readers/writers problem', 'A classic synchronization problem: several processes share one data area. Readers only look at it, so any number may read together. Writers modify it (a writer may also read it while updating), so a writer must have the data entirely to itself.'],  // glossary entry: defines the readers/writers problem
      ['Reader', 'A process that only reads the shared data and never changes it. Because reading changes nothing, readers may share access with each other.'],  // glossary entry: defines a reader (only reads, so readers may share)
      ['Writer', 'A process that modifies the shared data. It may read the data as part of its update, but because it changes it, it needs exclusive access: no reader and no other writer at the same time.'],  // glossary entry: defines a writer (changes the data, so it needs it alone)
      ['Shared data area', 'Whatever the readers and writers use in common: a file, a block of main memory, or even a bank of processor registers.'],  // glossary entry: defines the shared data area (a file, memory or registers)
      ['Semaphore','A shared integer that processes may change only through atomic operations: semWait subtracts 1 and blocks the caller if the result is negative; semSignal adds 1 and wakes one blocked process if any are waiting.'],  // glossary entry: defines a semaphore and its two atomic operations
      ['readcount', 'A shared counter of how many readers are currently reading. The reader that raises it from 0 to 1 locks writers out; the reader that brings it back to 0 lets them in.'],  // glossary entry: defines readcount and what the first and last readers do
      ['writecount', 'In the writers-priority solution, a shared counter of how many writers are waiting to write or writing.'],  // glossary entry: defines writecount in the writers-priority solution
      ['wsem', 'The semaphore that guards the data itself. Whenever the data is in use, wsem is held either by one writer or by the whole group of current readers.'],  // glossary entry: defines wsem, the semaphore guarding the data itself
      ['rsem', 'In the writers-priority solution, the “reader gate”: the first writer that shows up closes it so no new reader can start, and the last writer to finish opens it again.'],  // glossary entry: defines rsem, the reader gate that writers close
      ['Readers priority', 'A policy in which a newly arriving reader joins the readers already reading, even if a writer is waiting. It maximizes sharing but can starve writers.'],  // glossary entry: defines the readers-priority policy and its risk
      ['Writers priority', 'A policy in which, once a writer has announced that it wants to write, no new reader may start reading until every waiting writer has written.'],  // glossary entry: defines the writers-priority policy
      ['Starvation', 'A situation in which a process waits indefinitely, not because of a deadlock, but because other processes keep being served ahead of it.'],  // glossary entry: defines starvation (waiting for ever while others go first)
      ['Mutual exclusion', 'The guarantee that while one process is using a shared resource in its critical section, no other process can be using that same resource.'],  // glossary entry: defines mutual exclusion
      ['Producer/consumer problem', 'A classic problem in which producers put items into a shared buffer and consumers take them out. Both sides change the buffer and its bookkeeping (a producer adds an item after checking for a free slot, a consumer removes one), so neither side is a read-only reader.'],  // glossary entry: defines the producer/consumer problem and why neither side is read-only
      ['Message passing', 'Cooperation by sending and receiving messages (send and receive operations) instead of sharing variables. A receive can block until a message arrives, so messages also synchronize.'],  // glossary entry: defines message passing (send and receive)
      ['Mailbox', 'A named queue that holds messages until a process receives them. Many processes may send to the same mailbox.'],  // glossary entry: defines a mailbox
      ['Controller process', 'In the message-passing solution, the single process that decides who may use the shared data. Readers and writers ask it for permission and wait for its “OK” reply.'],  // glossary entry: defines the controller process of the message-passing solution
    ],  // closes the terms list

    css: ` /* css: this section's own style rules, written as one text string that the shell adds to the page */
      .sec-5-7 .tok rect { fill: var(--panel); stroke-width: 2.2; } /* a process token is a pill with the panel colour inside and a fairly thick border */
      .sec-5-7 .tok text { font-weight: 800; font-size: 13.5px; } /* the name on a token is bold */
      .sec-5-7 .tk-r rect { stroke: var(--proc); } /* a reader token has a border in the process colour... */
      .sec-5-7 .tk-r text { fill: var(--proc); } /* ...and its name in the same colour */
      .sec-5-7 .tk-w rect { stroke: var(--accent); } /* a writer token has a border in the highlight colour... */
      .sec-5-7 .tk-w text { fill: var(--accent); } /* ...and its name in the same colour */
      .sec-5-7 .tok.wait rect { stroke-dasharray: 4 3; } /* a waiting token (in a semaphore queue) gets a dashed border */
      .sec-5-7 .tok.new rect { stroke-width: 3.5; fill: var(--hl); } /* a token that has just got in gets a thicker border and a highlighted fill so the eye finds it */
      .sec-5-7 .tok.bad rect { stroke: var(--bad); fill: var(--bad-bg); } /* a token breaking a rule turns red */
      .sec-5-7 .tok.bad text { fill: var(--bad); } /* and its name turns red too */
      .sec-5-7 .cap-box { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; font-size: 15px; line-height: 1.45; } /* .cap-box is the pale caption box where the step-through demos explain what just happened */
      .sec-5-7 .cap-box b { color: var(--chc); } /* bold words in a caption take the chapter colour */
      .sec-5-7 .verdict { border-radius: 10px; padding: 9px 12px; font-size: 15.5px; line-height: 1.4; border: 2px solid var(--line); } /* .verdict is the rule tester's result box in step 1, with a neutral border by default */
      .sec-5-7 .verdict.ok { border-color: var(--ok); background: var(--ok-bg); } /* an allowed situation turns the verdict box green */
      .sec-5-7 .verdict.bad { border-color: var(--bad); background: var(--bad-bg); } /* a situation that breaks a rule turns it red */
      .sec-5-7 .verdict .vh { font-weight: 800; display: block; } /* .vh is the verdict's bold first line (such as "Allowed"), on a line of its own */
      .sec-5-7 .verdict.ok .vh { color: var(--ok); } /* that first line is green when allowed */
      .sec-5-7 .verdict.bad .vh { color: var(--bad); } /* and red when not allowed */
      .sec-5-7 .rule { display: grid; grid-template-columns: 30px 1fr; gap: 10px; align-items: start; padding: 7px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel-2); transition: background .2s, border-color .2s; } /* .rule is one of the three rule cards in step 1: a number box on the left, the rule text on the right */
      .sec-5-7 .rule .n { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-weight: 800; background: var(--panel-3); color: var(--ink-2); } /* .n is the rule's number, in a small rounded grey square */
      .sec-5-7 .rule.hit { border-color: var(--bad); background: var(--bad-bg); } /* a rule that is being broken (class hit) turns red */
      .sec-5-7 .rule.hit .n { background: var(--bad); color: var(--panel); } /* its number square fills red with light text */
      .sec-5-7 .rule.okk { border-color: var(--ok); background: var(--ok-bg); } /* a rule that is being demonstrated safely (class okk) turns green */
      .sec-5-7 .rule.okk .n { background: var(--ok); color: var(--panel); } /* its number square fills green with light text */
      .sec-5-7 .sw { padding: 0 5px; border-radius: 3px; border-left: 3px solid; font-weight: 700; } /* .sw is a small colour swatch in the "code colours" key, with a coloured bar on its left */
      .sec-5-7 .sw-cur { background: color-mix(in srgb, var(--chc) 16%, transparent); border-color: var(--chc); } /* swatch for "just ran": a light tint of the chapter colour */
      .sec-5-7 .sw-ok { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); } /* swatch for "reading or writing here": green */
      .sec-5-7 .sw-bad { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); } /* swatch for "blocked here": red */
      .sec-5-7 .r57-now { display: none; color: var(--ok); margin-top: 2px; } /* .r57-now is the "shown now" note in the classic-pictures table, hidden unless its row is active */
      .sec-5-7 tr.r57-hit .r57-now { display: block; } /* the note appears in the table row that matches what the simulator is showing */
      .sec-5-7 table.tbl tr.r57-hit td { background: var(--ok-bg); } /* that row's cells also turn pale green */
      .sec-5-7 pre.code.r57-wrap .ln { white-space: pre-wrap; padding-bottom: 3px; } /* on phones, code listings with the r57-wrap style let long lines wrap instead of scrolling sideways */
      .sec-5-7 pre.code.r57-wrap .tk-com { display: block; padding-left: 1.6em; line-height: 1.3; } /* and each code comment drops onto its own indented line under the code */
      .sec-5-7 .mini-h { font-size: 12.5px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); margin: 0 0 4px; } /* .mini-h is a small uppercase grey heading used above code listings and tables */
    `,  // end of the CSS text

    steps: [  // steps: the list of slides in this section, shown in this order
      /* ---------------- 1. Big picture + rule tester ---------------- */
      {  // step 1 (story): the three readers/writers rules, with a tester to try them
        title: 'Many readers, one writer: the three rules',  // title shown at the top of step 1
        kind: 'story',  // kind 'story' sets the label shown in the step header
        html: `${/* html: the fixed page content for step 1, inserted before render() runs */''}
          <div class="split l fill">${/* two-column layout: reading text on the left, the rule tester on the right */''}
            <div class="stack">${/* left column */''}
              <p class="lead m0">Some data is read far more often than it is changed: a flight departure board, a price list, a settings file.</p>${/* opening line: some data is read far more often than it is changed */''}
              <p class="m0">The <span class="t">readers/writers problem</span> is about one <span class="t">shared data area</span> (a file, a block of main memory, even a bank of processor registers) used by two kinds of processes. <span class="t">Readers</span> only look at the data, so they may share it. <span class="t">Writers</span> modify it (and may read it as they do), so each needs it alone.</p>${/* paragraph: the readers/writers problem, with one shared data area, readers who share and writers who need it alone */''}
              <div class="callout analogy m0" data-label="Analogy">A library keeps one reference ledger on a stand. Any number of visitors can read it side by side. When the librarian corrects an entry, she needs the ledger to herself: nobody should copy a half-corrected line, and two librarians must not edit at once.</div>${/* analogy callout: a library ledger that many can read but only one librarian edits at a time */''}
              <div class="callout why m0" data-label="What you will be able to do">Run two semaphore solutions line by line, watch a writer starve under one of them, see how the other fixes it, and follow a controller process that hands out permission by message.</div>${/* callout: what the student will be able to do after this section */''}
            </div>${/* ends the left column */''}
            <div class="card white stack r57-tester" style="gap:10px"></div>${/* empty card on the right that render() fills with the rule tester */''}
          </div>`,  // ends the layout and the html text
        render(el, ctx) {  // render(el, ctx) builds the rule tester when the student opens step 1
          const { h, s } = ctx;  // h builds page elements and s builds SVG elements (SVG is the browser's format for drawings made of shapes)
          const host = ctx.$('.r57-tester');  // host is the empty card from the html above; ctx.$ finds it inside this step
          let nR = 2, nW = 0;  // nR and nW are how many readers and writers are in the room; it starts with two readers
          const svg = s('svg', { viewBox: '0 0 640 112', width: '100%' });  // the drawing of who is using the data right now
          const verdict = h('div', { class: 'verdict' });  // verdict is the box that says whether the current situation is allowed
          const RULES = [  // RULES: the three readers/writers rules
            'Any number of readers may read the data at the same time.',  // rule 1: any number of readers may read together
            'Only one writer at a time may write.',  // rule 2: only one writer at a time
            'While a writer is writing, no reader may read.',  // rule 3: no reading while a writer writes
          ];  // closes RULES
          const ruleEls = RULES.map((t, i) => h('div', { class: 'rule' }, h('span', { class: 'n' }, String(i + 1)), h('span', { class: 'small', style: { lineHeight: '1.35' } }, t)));  // one card per rule, with its number and text
          const btn = (label, cls, fn) => h('button', { class: 'btn sm ' + cls, type: 'button', onclick: () => { fn(); paint(); } }, label);  // btn(label, cls, fn) makes a small button that runs fn and then repaints
          function paint() {  // paint() redraws the room, the rule cards, the verdict and the buttons; it runs after every button press
            const bad2 = nW >= 2, bad3 = nW >= 1 && nR >= 1;  // bad2: two writers break rule 2; bad3: a writer with any reader breaks rule 3
            const people = [];  // people lists everyone in the room, to be drawn
            for (let i = 1; i <= nR; i++) people.push({ id: 'R' + i, kind: 'R' });  // adds the readers R1, R2, ...
            for (let i = 1; i <= nW; i++) people.push({ id: 'W' + i, kind: 'W' });  // adds the writers W1, W2
            const cls = !people.length ? 's-panel' : bad2 || bad3 ? 's-bad' : 's-ok';  // room colour: plain when empty, red when a rule is broken, green when safe
            const gap = 64, x0 = 320 - ((people.length - 1) * gap) / 2;  // tokens sit 64 units apart, centred in the room
            svg.replaceChildren(  // replaces the drawing
              s('rect', { x: 2, y: 22, width: 636, height: 86, rx: 16, class: cls, 'stroke-width': 2 }),  // the room rectangle in its colour
              s('text', { x: 4, y: 15, 'font-weight': 800, 'font-size': 15 }, 'Who is using the shared data right now?'),  // heading above the room: who is using the shared data right now?
              people.length ? null : s('text', { x: 320, y: 70, 'text-anchor': 'middle', class: 's-sub', 'font-size': 15 }, 'nobody'),  // "nobody" in the middle when the room is empty
              ...people.map((p, i) => tok(s, p, x0 + i * gap, 66, { cls: (p.kind === 'W' && (bad2 || bad3)) ? 'bad' : '' })));  // one token per person; writers that break a rule are drawn in red
            ruleEls.forEach((r) => r.classList.remove('hit', 'okk'));  // clears the red and green marks from all rule cards
            const msgs = [];  // msgs collects an explanation for each broken rule
            if (bad2) { ruleEls[1].classList.add('hit'); msgs.push('<b>Rule 2.</b> Two writers could interleave their updates, each overwriting half of the other’s change.'); }  // two writers: rule 2 turns red, with an explanation of interleaved updates
            if (bad3) { ruleEls[2].classList.add('hit'); msgs.push('<b>Rule 3.</b> A reader could catch the data mid-update. If the board said “09:40, gate B7” and the writer has changed the time to 10:15 but not yet the gate, the reader sees “10:15, gate B7”, which was never true.'); }  // a writer with readers: rule 3 turns red, with the departure-board example of a half-finished update
            if (msgs.length) {  // if any rule is broken...
              verdict.className = 'verdict bad';  // ...the verdict box turns red
              verdict.innerHTML = `<span class="vh">✗ Not allowed: breaks ${msgs.length > 1 ? 'two rules' : 'a rule'}</span>` + msgs.join(' ');  // ...and says which rule or rules were broken, with the explanations
            } else if (!people.length) {  // if the room is empty...
              verdict.className = 'verdict';  // ...the verdict box stays neutral
              verdict.innerHTML = '<span class="vh">Empty</span>Nobody is inside, so nothing can go wrong. Add readers and writers to test the rules.';  // ...and says nothing can go wrong with nobody inside
            } else if (nW === 1) {  // if exactly one writer is alone...
              ruleEls[1].classList.add('okk'); ruleEls[2].classList.add('okk');  // ...rules 2 and 3 are shown as satisfied
              verdict.className = 'verdict ok';  // ...the verdict box turns green
              verdict.innerHTML = '<span class="vh">✓ Allowed</span>One writer with the data entirely to itself can update it safely.';  // ...and says one writer alone can update safely
            } else {  // otherwise only readers are inside...
              ruleEls[0].classList.add('okk');  // ...rule 1 is shown as satisfied
              verdict.className = 'verdict ok';  // ...the verdict box turns green
              verdict.innerHTML = `<span class="vh">✓ Allowed</span>${plural(nR, 'reader', 'readers')} ${nR === 1 ? 'is' : 'share'} the data. Reading changes nothing, so readers cannot disturb each other.`;  // ...and says readers can share because reading changes nothing
            }  // ends the verdict choice
            bRp.disabled = nR >= 5; bRm.disabled = nR <= 0; bWp.disabled = nW >= 2; bWm.disabled = nW <= 0;  // limits: at most 5 readers and 2 writers, and never below 0
          }  // ends paint()
          const bRp = btn('+ Reader', 'proc', () => nR++), bRm = btn('− Reader', '', () => nR--);  // buttons to add or remove a reader
          const bWp = btn('+ Writer', '', () => nW++), bWm = btn('− Writer', '', () => nW--);  // buttons to add or remove a writer
          bWp.style.borderColor = 'var(--accent)'; bWp.style.color = 'var(--accent)';  // gives the add-writer button the writer colour
          host.append(  // fills the tester card
            h('h3', { class: 'm0' }, 'Try the rules'),  // heading "Try the rules"
            h('div', { class: 'row gap-s' }, bRp, bRm, bWp, bWm, btn('Empty the room', 'ghost', () => { nR = 0; nW = 0; })),  // row of buttons, plus one that empties the room
            svg, verdict, h('div', { class: 'stack', style: { gap: '6px' } }, ...ruleEls),  // the drawing, the verdict, and the three rule cards
            h('p', { class: 'small muted m0', style: { marginTop: 'auto' } }, 'Try this: add a writer while two readers are inside, then take the readers out and add a second writer.'));  // suggestion at the bottom: add a writer while two readers are inside, then try two writers
          paint();  // draws the starting situation (two readers) once
        },  // ends render() for step 1
      },  // ends step 1

      /* ---------------- 2. Not plain mutual exclusion, not producer/consumer ---------------- */
      {  // step 2 (compare): why this is neither one plain lock nor producer/consumer
        title: 'Not just a lock, and not producer/consumer',  // title shown at the top of step 2
        kind: 'compare',  // kind 'compare' sets the header label for this step
        render(el, ctx) {  // render(el, ctx) builds step 2 when the student opens it
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          let n = 4;  // n is how many readers want the data at the same moment; the slider changes it
          const READ = 2;  // READ is how long one read takes, in ms
          // wide: row labels on the left; phones: labels above each row so the bars stay large
          const G = ctx.narrow  // G holds the drawing's sizes, chosen by screen width
            ? { VW: 420, VH: 178, X0: 10, U: 25, top: true, r1: 24, r2: 98, bh: 40, ax: 154 }  // phone-width sizes: a smaller drawing with each row's label above it
            : { VW: 1100, VH: 172, X0: 214, U: 48, top: false, r1: 12, r2: 82, bh: 48, ax: 146 };  // wide sizes: row labels on the left and bigger bars
          const { X0, U } = G;  // X0 is where the time axis starts; U is how many units one millisecond takes
          const svg = s('svg', { viewBox: `0 0 ${G.VW} ${G.VH}`, width: '100%' });  // the timeline drawing
          const res = h('p', { class: 'm0' });  // res is the sentence under the drawing that explains the result
          function draw() {  // draw() redraws both timelines and the result sentence; it runs when the slider moves
            const K = [];  // K collects the shapes to draw
            const label = (y, a, b) => G.top  // label(y, a, b) writes a row's title a (and on wide screens its grey subtitle b underneath)
              ? K.push(s('text', { x: 0, y, 'font-weight': 800, 'font-size': 15 }, a))  // phone version: title only
              : K.push(s('text', { x: 0, y, 'font-weight': 800, 'font-size': 16 }, a), s('text', { x: 0, y: y + 19, class: 's-sub', 'font-size': 14 }, b));  // wide version: title plus subtitle
            label(G.top ? G.r1 - 8 : 36, 'One lock for everyone', 'readers must take turns');  // top row: one lock for everyone, so readers take turns
            label(G.top ? G.r2 - 8 : 106, 'Readers/writers rules', 'readers may overlap');  // bottom row: the readers/writers rules, so readers may overlap
            for (let i = 0; i < n; i++) {  // top row: one bar per reader, one after another
              const x = X0 + i * READ * U;  // x is where reader i's turn starts
              K.push(s('rect', { x: x + 1, y: G.r1, width: READ * U - 3, height: G.bh, rx: 8, class: 's-proc', 'stroke-width': 2 }),  // the reader's bar, 2 ms long...
                s('text', { x: x + U, y: G.r1 + G.bh / 2 + 5, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': G.top ? 13.5 : 17, style: 'fill:var(--proc)' }, 'R' + (i + 1)));  // ...with its name in the middle
            }  // ends the top-row loop
            const bh = G.bh / n;  // bottom row: the bar height is split between the readers so they stack in the same 2 ms
            for (let i = 0; i < n; i++) K.push(s('rect', { x: X0 + 1, y: G.r2 + i * bh + 0.5, width: READ * U - 3, height: Math.max(2, bh - 1.5), rx: Math.min(6, bh / 2), class: 's-proc', 'stroke-width': 1.5 }));  // draws each reader as a thin bar in the same time slot, stacked on top of each other
            K.push(s('text', { x: X0 + READ * U + 10, y: G.r2 + G.bh / 2 + 5, 'font-weight': 700, 'font-size': G.top ? 14 : 17, style: 'fill:var(--proc)' }, n === 1 ? 'R1 reads' : `R1 to R${n} all read at the same time`));  // label beside the stack: R1 to Rn all read at the same time
            [[X0 + n * READ * U, G.r1 - 2, G.r1 + G.bh + 2], [X0 + READ * U, G.r2 - 2, G.r2 + G.bh + 2]].forEach(([x, y1, y2]) =>  // dashed lines mark where each row finishes...
              K.push(s('line', { x1: x, x2: x, y1, y2, class: 's-line', 'stroke-dasharray': '4 3' })));  // ...drawn for both rows
            const dy = (r) => (G.top ? r - 8 : r + G.bh / 2 + 6);  // dy(r) is the vertical position of a row's "done" label
            K.push(s('text', { x: G.VW - 2, y: dy(G.r1), 'text-anchor': 'end', 'font-weight': 800, 'font-size': G.top ? 15 : 17 }, `done: ${n * READ} ms`));  // top row's finish time: n x 2 ms
            K.push(s('text', { x: G.VW - 2, y: dy(G.r2), 'text-anchor': 'end', 'font-weight': 800, 'font-size': G.top ? 15 : 17, style: 'fill:var(--ok)' }, `done: ${READ} ms`));  // bottom row's finish time: always 2 ms, in green
            K.push(s('line', { x1: X0, x2: X0 + 16 * U, y1: G.ax, y2: G.ax, class: 's-line' }));  // the time axis
            for (let t = 0; t <= 16; t += G.top ? 4 : 2) K.push(s('line', { x1: X0 + t * U, x2: X0 + t * U, y1: G.ax - 4, y2: G.ax + 4, class: 's-line' }), s('text', { x: X0 + t * U, y: G.ax + 21, 'text-anchor': t === 16 && G.top ? 'end' : 'middle', class: 's-sub', 'font-size': 13.5 }, t + (t === 16 ? ' ms' : '')));  // tick marks and labels along the axis, every 2 ms (every 4 ms on phones), ending with "16 ms"
            svg.replaceChildren(...K);  // replaces the old drawing
            res.innerHTML = n === 1  // result sentence...
              ? 'With a single reader both approaches take 2 ms. The difference appears as soon as two or more readers want the data at once: drag the slider.'  // ...for one reader: both take 2 ms, so move the slider
              : `With <b>${n} readers</b>, one lock makes them queue: ${n} × 2 = <b>${n * READ} ms</b>. The readers/writers rules let them overlap, so with a processor free for each they all finish in <b>2 ms</b>, ${n}× sooner. That is perfectly safe because none of them changes the data.`;  // ...for several: one lock takes n x 2 ms, the rules let them finish together in 2 ms
          }  // ends draw()
          const sl = ctx.ui.slider({ label: ctx.narrow ? 'Readers at once' : 'Readers who want the data at the same moment (each read takes 2 ms of work)', min: 1, max: 8, value: n, onInput: (v) => { n = v; draw(); } });  // slider for the number of readers (1 to 8), with a shorter label on phones; moving it redraws
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the step: everything stacked in one column
            sl, h('div', { class: 'card white', style: { padding: '10px 14px' } }, svg), res,  // the slider, the drawing card and the result sentence
            h('div', { class: 'grid-2' },  // two cards side by side
              h('div', { class: 'card tight', html: '<h3 style="font-size:17px">Why not plain <span class="t">mutual exclusion</span>?</h3><p class="small m0">If we could not tell which processes only read, one lock around every access (a single <span class="t">critical section</span>) would be the only safe choice. But we know readers never change anything, so they cannot hurt one another. Making them take turns would throw away safe parallelism.</p>' }),  // card: why not plain mutual exclusion (readers cannot hurt one another)
              h('div', { class: 'card tight', html: '<h3 style="font-size:17px">Why not <span class="t" data-t="Producer/consumer problem">producer/consumer</span>?</h3><p class="small m0">It can look like one writer (the producer) and one reader (the consumer). But the consumer is not read-only: it <b>removes</b> an item and updates the buffer’s pointers. Both sides change the buffer, and each waits for the other (an item to take, a free slot to fill). Here a reader leaves the data exactly as it found it.</p>' })),  // card: why not producer/consumer (the consumer changes the buffer, a reader does not)
            h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: '“Readers need no protection at all.” They need none from <i>each other</i>, but they must still be kept away from writers (rule 3).' })));  // warning: readers still need protection from writers (rule 3); closes the layout
          draw();  // draws the starting picture (4 readers) once
        },  // ends render() for step 2
      },  // ends step 2

      /* ---------------- 3. Readers-priority solution, traced line by line ---------------- */
      {  // step 3 (explore): the readers-priority semaphore solution, traced line by line
        title: 'Solution 1: readers have priority',  // title shown at the top of step 3
        kind: 'explore',  // kind 'explore' sets the header label for this step
        core: true,  // core: true keeps this step on the shorter core path through the guide
        render(el, ctx) {  // render(el, ctx) builds step 3 when the student opens it
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const preR = codeBox(ctx, CODE.rp.R);  // preR is the code listing of the reader in this solution
          const preW = codeBox(ctx, CODE.rp.W);  // preW is the code listing of the writer
          const svg = s('svg', { width: '100%' });  // the drawing of the room and the semaphores
          const F = [  // F: the frames of the walk-through; each has a caption and a go(E) function that makes that frame's moves in the simulator
            { cap: '<b>Start.</b> Nobody is using the data: readcount = 0 and both semaphores are 1 (open). Press Play, or step with the arrows.', go: () => {} },  // frame 1: nothing is happening; both semaphores are open
            { cap: '<b>R1 wants to read.</b> Its semWait(x) takes the lock on the counter: x drops from 1 to 0.', go: (E) => { E.arrive('R'); E.exec('R1'); } },  // frame 2: R1 arrives and takes x
            { cap: 'R1 adds itself: readcount = 1. Because it is the <b>first</b> reader it also calls semWait(wsem). wsem drops to 0, so writers are now locked out.', go: (E) => E.run('R1', 2) },  // frame 3: R1 raises readcount to 1 and, as the first reader, takes wsem
            { cap: 'R1 gives back the counter lock (x is 1 again) and starts reading.', go: (E) => E.run('R1') },  // frame 4: R1 releases x and starts reading
            { cap: '<b>R2 arrives.</b> readcount becomes 2. R2 is not the first reader, so it skips wsem and walks straight in. Two readers now share the data.', go: (E) => { E.arrive('R'); E.run('R2'); } },  // frame 5: R2 arrives and walks straight in, since it is not the first reader
            { cap: '<b>W1 wants to write.</b> semWait(wsem) makes wsem −1. A negative value means somebody is waiting: W1 is blocked in wsem’s queue (red line).', go: (E) => { E.arrive('W'); E.run('W1'); } },  // frame 6: W1 arrives and blocks on wsem, which goes to -1
            { cap: '<b>R3 arrives while W1 waits.</b> Only the first reader in ever waits on wsem, so R3 walks straight in (readcount = 3). That is <span class="t">readers priority</span>, and if readers keep overlapping like this W1 can <span class="t" data-t="Starvation">starve</span>.', go: (E) => { E.arrive('R'); E.run('R3'); } },  // frame 7: R3 arrives and walks past the waiting writer, the source of writer starvation
            { cap: 'R1 finishes and leaves: readcount = 2. It is not the last reader, so wsem stays closed.', go: (E) => { E.endWork('R1'); E.run('R1'); } },  // frame 8: R1 leaves; not the last reader, so wsem stays closed
            { cap: 'R2 leaves: readcount = 1. Still not zero, so W1 keeps waiting.', go: (E) => { E.endWork('R2'); E.run('R2'); } },  // frame 9: R2 leaves; W1 still waits
            { cap: 'R3 leaves: readcount = 0. As the <b>last</b> reader out it calls semSignal(wsem): wsem rises to 0 and W1, first in the queue, is released.', go: (E) => { E.endWork('R3'); E.run('R3'); } },  // frame 10: R3 leaves as the last reader and signals wsem, releasing W1
            { cap: 'W1 writes with the data entirely to itself.', go: (E) => E.run('W1') },  // frame 11: W1 writes alone
            { cap: '<b>R4 arrives while W1 writes.</b> It takes x, sets readcount = 1 and, as the first reader, calls semWait(wsem): wsem = −1, so R4 blocks <b>while still holding x</b>.', go: (E) => { E.arrive('R'); E.run('R4'); } },  // frame 12: R4 arrives while W1 writes and blocks on wsem while still holding x
            { cap: '<b>R5 arrives.</b> Its semWait(x) makes x −1, so R5 blocks on x. Only the first waiting reader queues on wsem; any others queue behind it on x.', go: (E) => { E.arrive('R'); E.run('R5'); } },  // frame 13: R5 arrives and blocks on x behind R4
            { cap: 'W1 finishes. semSignal(wsem) releases R4; R4 then signals x, which releases R5. Both read together (readcount = 2). The group of readers now holds wsem.', go: (E) => { E.endWork('W1'); E.settle(); } },  // frame 14: W1 finishes; R4 is released, then R5, and both read together
          ];  // closes F
          const player = ctx.ui.player({  // the step-through player for these frames
            count: F.length, interval: 3400,  // one position per frame, 3.4 s apart when playing
            render: (i) => {  // render(i) rebuilds frame i from scratch each time the player moves
              const E = engine('rp');  // starts a fresh simulator for the readers-priority solution
              for (let k = 0; k <= i; k++) { E.mark(); F[k].go(E); }  // replays every frame's moves up to frame i, clearing the "just ran" marks before each one so only the last frame's lines are tinted
              drawRW(s, svg, E, { W: ctx.narrow ? 400 : 540, roomH: 122, rowH: 40 });  // draws the room and semaphores, a little smaller on phones
              markCode(preR, E, 'R'); markCode(preW, E, 'W');  // colours both code listings to match
              return F[i].cap;  // returns the caption for the player to display
            },  // ends render
          });  // ends the player setup
          player.caption.style.minHeight = '5.9em';  // gives the caption a fixed minimum height so the page does not jump between frames
          el.append(h('div', { class: 'split fill' },  // builds the step: code on the left, the drawing and player on the right
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked
              h('div', { class: 'small', html: 'Shared: <code>int readcount = 0;</code> <code>semaphore x = 1, wsem = 1;</code> (1 = open)<br><b>x</b> guards the counter; <span class="t">wsem</span> guards the data itself. Both are <span class="t">semaphores</span>.' }),  // line stating the shared variables: readcount, and semaphores x and wsem both starting at 1
              h('div', { class: 'mini-h' }, 'Reader: runs these lines each time it reads'), preR,  // heading and listing for the reader's code
              h('div', { class: 'mini-h' }, 'Writer: runs these lines each time it writes'), preW,  // heading and listing for the writer's code
              h('div', { class: 'xs muted', html: 'Code colours: <span class="sw sw-cur">tinted</span> = just ran · <span class="sw sw-ok">green</span> = reading or writing here · <span class="sw sw-bad">red</span> = blocked here' }),  // key for the code colours: tinted just ran, green reading or writing, red blocked
              h('div', { class: 'callout warn m0', style: { fontSize: '15px' }, 'data-label': 'Common mistake', html: 'Thinking every reader calls semWait(wsem). Only the <b>first</b> reader in does, and only the <b>last</b> one out signals it. The readers act as one group that holds wsem between them.' })),  // warning: only the first reader waits on wsem and only the last signals it; closes the left column
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column, stacked
              h('div', { class: 'row', style: { justifyContent: 'space-between' }, html: '<span class="mini-h m0">What the semaphores see</span><span>' + LEGEND + '</span>' }),  // heading "What the semaphores see" with the R/W legend
              h('div', { class: 'card white', style: { padding: '10px 12px' } }, svg), player.el)));  // card with the drawing, then the player; closes the layout
        },  // ends render() for step 3
      },  // ends step 3

      /* ---------------- 4. Lab: the reading room, both policies side by side ---------------- */
      {  // step 4 (lab): the same stream of visitors run through both policies side by side
        title: 'Lab: one crowd of visitors, two policies',  // title shown at the top of step 4
        kind: 'lab',  // kind 'lab' sets the header label for this step
        core: true,  // core: true keeps this step on the shorter core path
        render(el, ctx) {  // render(el, ctx) builds the lab when the student opens it
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const rate = { R: 60, W: 8 };  // rate: the percentage chance that a reader (60) or a writer (8) arrives on each tick; the sliders change them
          let playing = false, rng = null;  // playing says whether the clock runs by itself; rng will be the random number source
          const P = [  // P: the two panels, one per policy
            { pol: 'rp', title: 'Readers priority', sub: 'semaphores x, wsem' },  // left panel: readers priority, with its two semaphores
            { pol: 'wp', title: 'Writers priority', sub: 'semaphores z, rsem, x, y, wsem' },  // right panel: writers priority, with its five semaphores
          ];  // closes P
          function meter(label) {  // meter(label) builds a labelled bar that shows how long the longest-waiting process has waited
            const bar = h('i'), txt = h('span', { class: 'xs b' });  // bar is the coloured fill; txt is the text on the right of the label
            const box = h('div', { class: 'stack', style: { gap: '2px' } },  // box stacks the label line above the bar
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted b' }, label), txt),  // label on the left, text on the right
              h('div', { class: 'meter' }, bar));  // the bar track with its fill; closes the box
            box.set = (p, E) => {  // box.set(p, E) updates the meter for process p (or nobody) in simulator E
              const w = p ? E.t - p.t0 : 0;  // w is how many ticks p has waited since it arrived
              bar.style.width = Math.min(100, (w / 40) * 100) + '%';  // the bar fills up over 40 ticks
              bar.style.background = `var(--${w >= 25 ? 'bad' : w >= 10 ? 'warn' : 'ok'})`;  // green under 10 ticks, amber from 10, red from 25
              txt.textContent = p ? `${p.id} has waited ${w} tick${w === 1 ? '' : 's'}` : 'nobody waiting';  // text: who has waited how long, or "nobody waiting"
              txt.style.color = w >= 25 ? 'var(--bad)' : '';  // the text turns red at 25 ticks or more
            };  // ends box.set
            return box;  // returns the meter
          }  // ends meter()
          P.forEach((p) => {  // builds each panel's parts
            p.svg = s('svg', { width: '100%' });  // the panel's drawing of the room and semaphores
            p.stats = h('span', { class: 'chip' });  // a chip showing the clock and how many reads and writes have finished
            p.mW = meter('Starvation meter: longest-waiting writer');  // meter for the writer who has waited longest (the starvation meter)
            p.mR = meter('Longest-waiting reader');  // meter for the reader who has waited longest
            p.card = h('div', { class: 'card white stack', style: { gap: '8px', padding: '10px 12px' } },  // the panel card, assembled from top to bottom
              h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { justifyContent: 'space-between' } },  // top line (it may wrap on phones)
                h('div', {}, h('b', { style: { fontSize: '17px' } }, h('span', { class: 't' }, p.title)), h('span', { class: 'xs muted', style: { marginLeft: '8px' } }, p.sub)), p.stats),  // the policy name and its semaphores on the left, the stats chip on the right
              p.svg,  // the drawing
              p.pol === 'rp' ? h('p', { class: 'small muted m0', html: 'A reader who finds other readers inside walks straight in. A writer in the wsem queue must wait until readcount falls all the way to 0, so with busy readers it can <span class="t" data-t="Starvation">starve</span>.' })  // left panel's note: new readers walk past a waiting writer, so it can starve...
                : h('p', { class: 'small muted m0', html: 'The first waiting writer closes the reader gate <span class="t">rsem</span>. New readers queue (one on rsem, the rest on z) while the readers inside drain out, so the writer goes next.' }),  // ...right panel's note: the first waiting writer closes rsem, so it goes next
              h('div', { class: 'stack', style: { gap: '6px', marginTop: 'auto' } }, p.mW, p.mR));  // the two meters, pushed to the bottom of the card; closes the card
          });  // ends the panel builder
          const cap = h('div', { class: 'cap-box' });  // cap is the caption box under both panels that compares what is happening
          const oldest = (E, k) => E.waiting(k).sort((a, b) => a.t0 - b.t0)[0];  // oldest(E, k) finds the process of kind k that has been waiting longest
          function paint() {  // paint() redraws both panels and the caption; it runs after every tick and button press
            P.forEach((p) => {  // for each panel...
              const E = p.E;  // E is that panel's simulator
              drawRW(s, p.svg, E, { W: ctx.narrow ? 400 : 540, roomH: 70, rowH: 28, title: 'Reading room' });  // draws its room (titled "Reading room") and semaphore rows, a little smaller on phones
              p.stats.textContent = `t = ${E.t} · reads ${E.done.R} · writes ${E.done.W}`;  // updates the stats chip: clock, finished reads, finished writes
              p.mW.set(oldest(E, 'W'), E); p.mR.set(oldest(E, 'R'), E);  // updates both meters
            });  // ends the per-panel update
            const [a, b] = P.map((p) => p.E);  // a and b are the left and right simulators
            const wa = oldest(a, 'W'), wb = oldest(b, 'W');  // wa and wb are the longest-waiting writer on each side
            const rIn = (E) => E.inside().some((q) => q.kind === 'R'), wIn = (E) => E.inside().find((q) => q.kind === 'W');  // rIn(E): are readers inside? wIn(E): which writer is inside, if any?
            const ticks = (E, p) => plural(E.t - p.t0, 'tick', 'ticks');  // ticks(E, p) writes how many ticks p has waited, such as "3 ticks"
            const left = !wa ? '<b>Left:</b> no writer is waiting at the moment.'  // left sentence: no writer waiting...
              : rIn(a) ? `<b>Left:</b> ${wa.id} has waited ${ticks(a, wa)} on wsem, yet each new reader who finds readers inside walks straight in, so readcount may never reach 0.`  // ...or a writer waits while new readers keep walking in, so readcount may never reach 0...
                : `<b>Left:</b> ${wIn(a) ? wIn(a).id + ' is writing, and ' : ''}${wa.id} waits its turn on wsem.`;  // ...or a writer waits its turn behind another writer
            const right = wb && rIn(b)  // right sentence: a waiting writer has closed rsem while readers drain out...
              ? `<b>Right:</b> ${wb.id} has closed rsem, so newcomers queue on z and rsem while the readers inside drain out; then ${wb.id} writes.`  // ...then that writer writes
              : wb ? `<b>Right:</b> ${wb.id} waits on wsem behind the writer inside, and rsem stays closed to new readers.` : b.waiting('R').length ? '<b>Right:</b> readers are held back until the last writer reopens rsem.' : '<b>Right:</b> nobody is being held back.';  // ...or it waits behind the writer inside, or readers are held back, or nobody is held back
            cap.innerHTML = left + ' ' + right;  // shows both sentences together
            bPlay.textContent = playing ? 'Pause' : '▶ Play';  // the Play button reads Pause while running
          }  // ends paint()
          function tickAll(arr) { P.forEach((p) => p.E.tick(arr)); }  // tickAll(arr) advances both simulators by one tick with the same arrivals, so the comparison is fair
          function randomArrivals() {  // randomArrivals() decides who arrives this tick, using the rates
            const r = [rng(), rng(), rng(), rng()], arr = [];  // four random numbers between 0 and 1: two for readers, two for writers
            const busy = Math.max(...P.map((p) => p.E.procs.length));  // busy is the larger crowd of the two sides, to cap how many visitors there can be
            if (busy < 18 && r[0] < rate.R / 100) arr.push(['R', 4 + Math.floor(r[1] * 4)]);  // a reader arrives with chance rate.R, reading for 4 to 7 ticks (unless 18 are already there)
            if (busy < 18 && r[2] < rate.W / 100) arr.push(['W', 3 + Math.floor(r[3] * 2)]);  // a writer arrives with chance rate.W, writing for 3 or 4 ticks
            return arr;  // returns the arrivals for this tick
          }  // ends randomArrivals()
          function step() { tickAll(randomArrivals()); paint(); }  // step() advances one tick with random arrivals and repaints
          function addNow(kind, dur) { P.forEach((p) => { p.E.arrive(kind, dur); p.E.settle(); }); paint(); }  // addNow(kind, dur) adds the same visitor to both sides at once, lets them move, and repaints
          function reset() {  // reset() restarts both sides from the same starting scene
            rng = ctx.util.seeded(57);  // a seeded random number source: the same seed gives the same "random" arrivals after every reset
            P.forEach((p) => (p.E = engine(p.pol)));  // a fresh simulator for each policy
            [[['R', 7]], [['R', 7]], [['W', 3]], [['R', 6]], [['R', 6]]].forEach(tickAll);  // the starting scene: two readers, then a writer, then two more readers, one per tick
            playing = false; paint();  // stops the clock and repaints
          }  // ends reset()
          const bPlay = h('button', { class: 'btn sm primary', type: 'button', style: { minWidth: '92px' }, onclick: () => { playing = !playing; paint(); } });  // Play button: starts or pauses the clock
          const bStep = h('button', { class: 'btn sm', type: 'button', onclick: () => { playing = false; step(); } }, 'Step 1 tick');  // Step button: pauses and advances exactly one tick
          const bR = h('button', { class: 'btn sm proc', type: 'button', onclick: () => addNow('R', 5) }, '+ Reader');  // + Reader button: adds a reader who reads for 5 ticks to both sides
          const bW = h('button', { class: 'btn sm', type: 'button', style: { borderColor: 'var(--accent)', color: 'var(--accent)' }, onclick: () => addNow('W', 3) }, '+ Writer');  // + Writer button in the writer colour: adds a writer who writes for 3 ticks to both sides
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset');  // Reset button
          const sR = ctx.ui.slider({ label: 'Chance a reader arrives each tick', min: 0, max: 90, step: 5, value: rate.R, format: (v) => v + '%', onInput: (v) => (rate.R = v) });  // slider for the chance a reader arrives each tick (0 to 90%)
          const sW = ctx.ui.slider({ label: 'Chance a writer arrives each tick', min: 0, max: 40, step: 2, value: rate.W, format: (v) => v + '%', onInput: (v) => (rate.W = v) });  // slider for the chance a writer arrives each tick (0 to 40%)
          [sR, sW].forEach((x) => (x.style.fontSize = '14px'));  // makes both slider labels a little smaller
          reset();  // sets up the starting scene
          ctx.every(650, () => { if (playing) step(); });  // every 0.65 seconds (stopped automatically when the step closes), one tick passes while playing
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the lab: everything stacked in one column
            h('div', { class: 'split', style: { height: 'auto', gridTemplateColumns: 'auto minmax(0,1fr)', alignItems: 'center', gap: '18px' } },  // top row: the buttons on the left, the sliders on the right
              h('div', { class: ctx.narrow ? 'row gap-s' : 'row gap-s nw' }, bPlay, bStep, bR, bW, bReset),  // the five buttons (they may wrap on phones)
              h('div', { class: 'stack', style: { gap: '2px' } }, sR, sW)),  // the two sliders; closes the top row
            h('div', { class: 'grid-2 grow' }, P[0].card, P[1].card),  // the two panels side by side, taking the spare height
            cap));  // the caption box last; closes the layout
        },  // ends render() for step 4
      },  // ends step 4

      /* ---------------- 5. Writers-priority solution: what each semaphore is for ---------------- */
      {  // step 5 (learn): what each semaphore and counter in the writers-priority solution is for
        title: 'Solution 2: writers have priority',  // title shown at the top of step 5
        kind: 'learn',  // kind 'learn' sets the header label for this step
        render(el, ctx) {  // render(el, ctx) builds step 5 when the student opens it
          const { h } = ctx;  // takes the element builder h out of ctx
          const preR = codeBox(ctx, CODE.wp.R);  // preR is the code listing of the writers-priority reader
          const preW = codeBox(ctx, CODE.wp.W);  // preW is the code listing of the writers-priority writer
          const ROLES = [  // ROLES: one clickable name per idea; each explains its job and which code lines to highlight
            { key: 'new', label: 'What is new?', r: [1, 2, 7, 8], w: [1, 2, 3, 4, 8, 9, 10, 11],  // "What is new?": highlights the lines added compared with solution 1 (r = reader lines, w = writer lines)
              html: '<b>Goal (<span class="t">writers priority</span>):</b> once a writer has announced it wants to write, no <i>new</i> reader may start. The reading part and wsem work exactly as in solution 1. The highlighted lines are the additions: a reader must now pass <b>z</b> and <b>rsem</b>, and writers keep a count so the first can close <b>rsem</b> and the last can reopen it.' },  // explanation: once a writer announces itself, no new reader may start; z, rsem and writecount are the additions
            { key: 'rsem', label: 'rsem', html: '<b><span class="t">rsem</span>, the reader gate.</b> The writer that makes writecount go 0 → 1 closes it with semWait(rsem). After that the writers hold it as a group, and whichever writer makes writecount go 1 → 0 reopens it. While it is shut no new reader can even begin. A reader passes through it alone and reopens it at once.' },  // rsem: the reader gate that the first writer closes and the last writer reopens
            { key: 'z', label: 'z', html: '<b>z, the turnstile before the gate.</b> A reader holds z while it waits at rsem, so only one reader at a time can queue on rsem; the rest wait on z. When the first writer calls semWait(rsem), at most one reader is ahead of it, never a crowd. (During that short wait the writer still holds y, so another writer briefly waits on y.)' },  // z: the turnstile that lets only one reader at a time queue on rsem
            { key: 'wsem', label: 'wsem', html: '<b>wsem guards the data itself,</b> exactly as before: held by one writer, or by the whole group of readers (the first reader in takes it, the last reader out returns it). Writers still line up here one at a time.' },  // wsem: guards the data itself, exactly as in solution 1
            { key: 'x', label: 'x', html: '<b>x protects readcount,</b> so two readers can never update the counter at the same moment.' },  // x: protects readcount
            { key: 'y', label: 'y', html: '<b>y protects writecount,</b> so two writers can never update that counter at the same moment. It does the same job for writers that x does for readers.' },  // y: protects writecount, the writers' version of x
            { key: 'readcount', label: 'readcount', html: '<b><span class="t">readcount</span></b> counts the readers inside. As in solution 1, the change 0 → 1 means “take wsem” and 1 → 0 means “give wsem back”.' },  // readcount: counts readers inside; 0 to 1 takes wsem, 1 to 0 gives it back
            { key: 'writecount', label: 'writecount', html: '<b><span class="t">writecount</span></b> counts writers that are waiting <i>or</i> writing. 0 → 1: the first one closes rsem. 1 → 0: the last one reopens it. So rsem stays shut as long as any writer is interested.' },  // writecount: counts writers waiting or writing; it keeps rsem shut while any writer is interested
          ];  // closes ROLES
          const info = h('div', { class: 'card', style: { minHeight: '104px', padding: '10px 14px', fontSize: '15.5px', lineHeight: '1.45' } });  // info is the card that shows the selected explanation
          const btns = ROLES.map((r) => h('button', { class: 'btn sm' + (r.key === 'new' ? '' : ' mono'), type: 'button', onclick: () => pick(r) }, r.label));  // one button per name; names of variables use code font; clicking one calls pick()
          function pick(r) {  // pick(r) selects one name: highlights its button, its code lines and shows its explanation
            btns.forEach((b, i) => b.classList.toggle('on', ROLES[i] === r));  // lights only the selected button
            const rl = r.r || linesWith(CODE.wp.R, r.key), wl = r.w || linesWith(CODE.wp.W, r.key);  // the lines to highlight: the listed ones, or every line that mentions the name
            preR.clear(); preW.clear();  // clears both listings
            preR.mark(rl, 'cur'); preW.mark(wl, 'cur');  // highlights the chosen lines in both listings
            const where = r.key === 'new' ? '' : `<div class="xs muted" style="margin-top:4px">Used on ${rl.length} reader line${rl.length === 1 ? '' : 's'} and ${wl.length} writer line${wl.length === 1 ? '' : 's'} (highlighted).</div>`;  // a small note saying on how many reader and writer lines the name appears (not for "What is new?")
            info.innerHTML = r.html + where;  // shows the explanation and the note
          }  // ends pick()
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the step: everything stacked in one column
            h('div', { class: 'row nw', style: { justifyContent: 'space-between', gap: '16px' } },  // top row...
              h('p', { class: 'm0', html: 'Shared: <code>int readcount = 0, writecount = 0;</code> <code>semaphore x = 1, y = 1, z = 1, wsem = 1, rsem = 1;</code>' })),  // ...stating the shared variables: two counters and five semaphores, all semaphores starting at 1
            h('div', { class: 'row gap-s' }, h('span', { class: 'mini-h m0', style: { marginRight: '4px' } }, 'Click a name:'), ...btns),  // row of name buttons with a "Click a name" label
            info,  // the explanation card
            h('div', { class: 'split', style: { height: 'auto' } },  // the two listings side by side
              h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'mini-h' }, 'Reader: each time it reads'), preR),  // left: heading and the reader's code
              h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'mini-h' }, 'Writer: each time it writes'), preW,  // right: heading and the writer's code...
                h('div', { class: 'callout why m0', style: { fontSize: '15px', marginTop: '4px' }, 'data-label': 'Why it matters', html: 'A stream of readers can no longer shut writers out: once a writer arrives, the gate closes and the readers inside simply drain away.' })))));  // ...and a callout: a stream of readers can no longer shut writers out; closes the layout
          pick(ROLES[0]);  // starts on "What is new?"
        },  // ends render() for step 5
      },  // ends step 5

      /* ---------------- 6. Writers priority: the four classic queue pictures ---------------- */
      {  // step 6 (explore): the four classic queue pictures of the writers-priority solution
        title: 'Writers priority: where does everyone wait?',  // title shown at the top of step 6
        kind: 'explore',  // kind 'explore' sets the header label for this step
        render(el, ctx) {  // render(el, ctx) builds step 6 when the student opens it
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const A = (k) => (E) => { E.arrive(k, 99); E.settle(); };  // A(k) makes a frame action: a process of kind k arrives (with a very long job, so it stays until told to finish) and everyone moves
          const D = (id) => (E) => { E.endWork(id); E.settle(); };  // D(id) makes a frame action: process id finishes its reading or writing and everyone moves
          const SC = [  // SC: the four situations, each with its label, the frame where the classic picture is reached, and its frames
            { label: 'Only readers', pic: 3, frames: [  // situation 1: only readers
              ['<b>R1 arrives.</b> It passes z and rsem, becomes the first reader and takes wsem for the readers.', A('R')],  // frame: R1 arrives, passes z and rsem and takes wsem for the readers
              ['<b>R2 arrives.</b> No writer has closed the gate, so R2 passes z and rsem and joins R1.', A('R')],  // frame: R2 arrives and joins R1
              ['<b>R3 arrives</b> and joins too. <b>Classic picture:</b> the readers hold wsem as a group, and every queue is empty.', A('R')]] },  // frame: R3 joins; the classic picture with no queues
            { label: 'Only writers', pic: 3, frames: [  // situation 2: only writers
              ['<b>W1 arrives.</b> writecount = 1, so it closes rsem; then it takes wsem and writes.', A('W')],  // frame: W1 arrives, closes rsem, takes wsem and writes
              ['<b>W2 arrives.</b> writecount = 2 (rsem is already shut), and it queues on wsem.', A('W')],  // frame: W2 arrives and queues on wsem
              ['<b>W3 arrives</b> and queues on wsem behind W2. <b>Classic picture:</b> W1 holds wsem, the writers keep rsem closed, and the other writers line up on wsem.', A('W')]] },  // frame: W3 queues behind W2; the classic picture
            { label: 'Both, a reader first', pic: 5, frames: [  // situation 3: both kinds, with a reader first
              ['<b>R1 arrives first</b> and starts reading, taking wsem for the readers.', A('R')],  // frame: R1 arrives and reads, taking wsem for the readers
              ['<b>W1 arrives.</b> It closes rsem (writecount = 1), then queues on wsem because R1 is reading.', A('W')],  // frame: W1 arrives, closes rsem, then queues on wsem
              ['<b>W2 arrives</b> and queues on wsem behind W1.', A('W')],  // frame: W2 queues on wsem behind W1
              ['<b>R2 arrives.</b> It gets past z but finds rsem shut, so it queues on rsem.', A('R')],  // frame: R2 gets past z but queues on the closed rsem
              ['<b>R3 arrives.</b> R2 still holds z, so R3 queues on z. <b>Classic picture:</b> the readers hold wsem, a writer closed rsem; writers line up on wsem, one reader on rsem, the rest on z.', A('R')],  // frame: R3 queues on z behind R2; the classic picture
              ['<b>R1 finishes.</b> As the last reader out it signals wsem, and W1 (front of the queue) writes.', D('R1')],  // frame: R1 leaves as the last reader and W1 writes
              ['<b>W1 finishes.</b> W2 writes next, even though R2 and R3 were waiting: writers go first.', D('W1')],  // frame: W1 finishes and W2 writes next, ahead of the waiting readers
              ['<b>W2 finishes.</b> writecount drops to 0, so it reopens rsem. R2 gets in and lets R3 through z: both read.', D('W2')]] },  // frame: W2 finishes, reopens rsem, and R2 and R3 read together
            { label: 'Both, a writer first', pic: 4, frames: [  // situation 4: both kinds, with a writer first
              ['<b>W1 arrives first.</b> It closes rsem, takes wsem and writes.', A('W')],  // frame: W1 arrives, closes rsem, takes wsem and writes
              ['<b>R1 arrives.</b> It passes z but finds rsem shut, so it queues on rsem.', A('R')],  // frame: R1 passes z and queues on rsem
              ['<b>W2 arrives.</b> writecount = 2, and it queues on wsem.', A('W')],  // frame: W2 queues on wsem
              ['<b>R2 arrives.</b> R1 still holds z, so R2 queues on z. <b>Classic picture:</b> a writer holds wsem and the writers keep rsem closed; writers line up on wsem, one reader on rsem, the rest on z.', A('R')],  // frame: R2 queues on z behind R1; the classic picture
              ['<b>W1 finishes.</b> W2 takes wsem next; the readers keep waiting.', D('W1')],  // frame: W1 finishes and W2 writes next
              ['<b>W2 finishes.</b> It was the last writer, so it reopens rsem; R1 and then R2 get in and read together.', D('W2')]] },  // frame: W2 finishes, reopens rsem, and the readers go in together
          ];  // closes SC
          const PICS = [  // PICS: the one-line summary of each classic picture, shown in the table
            'Readers hold wsem. No queues at all.',  // picture 1: readers hold wsem and nobody waits
            'A writer holds wsem; rsem is shut. Other writers queue on wsem.',  // picture 2: a writer holds wsem, rsem is shut, other writers queue on wsem
            'Readers hold wsem; a writer shut rsem. Writers queue on wsem, one reader on rsem, the rest on z.',  // picture 3: readers hold wsem, a writer shut rsem, writers on wsem, one reader on rsem, the rest on z
            'A writer holds wsem; rsem is shut. Writers queue on wsem, one reader on rsem, the rest on z.',  // picture 4: a writer holds wsem, rsem is shut, same queues as picture 3
          ];  // closes PICS
          let cur = 2;  // cur is the situation being played; it starts on "Both, a reader first"
          const svg = s('svg', { width: '100%' });  // the drawing of the room and the five semaphores
          const rows = SC.map((sc, i) => h('tr', {}, h('td', { style: { width: '116px' } }, h('b', {}, sc.label), h('div', { class: 'r57-now xs b' }, '✓ shown now')), h('td', {}, PICS[i])));  // one table row per situation: its label (with a hidden "shown now" note) and its picture summary
          const table = h('table', { class: 'tbl compact' }, h('tr', {}, h('th', {}, 'Situation'), h('th', {}, 'Semaphores and queues')), ...rows);  // the table, with column headings
          const player = ctx.ui.player({  // the step-through player for the current situation
            count: SC[cur].frames.length + 1, interval: 3200,  // one position per frame, plus an empty starting frame; 3.2 s apart when playing
            render: (i) => {  // render(i) rebuilds frame i from scratch each time the player moves
              const sc = SC[cur], fr = [['<b>Empty.</b> All five semaphores are 1 and both counters are 0. Press Play or step forward.', () => {}], ...sc.frames];  // sc is the current situation; fr adds the empty starting frame in front of its frames
              const E = engine('wp');  // starts a fresh writers-priority simulator
              for (let k = 0; k <= i; k++) { E.mark(); fr[k][1](E); }  // replays every frame's action up to frame i, clearing the "just ran" marks before each
              drawRW(s, svg, E, { W: ctx.narrow ? 400 : 620, roomH: 90, rowH: 33 });  // draws the room and semaphore rows
              rows.forEach((r, j) => {  // updates the table rows...
                r.classList.toggle('on', j === cur);  // ...marking the current situation's row
                r.classList.toggle('r57-hit', j === cur && i === sc.pic);  // ...and turning it green with "shown now" when this frame is its classic picture
              });  // ends the row update
              return fr[i][0];  // returns the frame's caption
            },  // ends render
          });  // ends the player setup
          player.caption.style.minHeight = '4.4em';  // gives the caption a fixed minimum height so the page does not jump
          const seg = ctx.ui.seg(SC.map((sc, i) => ({ value: i, label: sc.label })), cur, (v) => { cur = v; player.setCount(SC[cur].frames.length + 1); });  // buttons to choose one of the four situations; choosing one restarts the player with that situation's frame count
          el.append(h('div', { class: 'split r fill' },  // builds the step: the drawing and player on the left, the table and notes on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column, stacked
              seg,  // the situation buttons
              h('div', { class: 'card white', style: { padding: '8px 12px' } }, svg), player.el),  // card with the drawing, then the player; closes the left column
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column, stacked
              h('div', { class: 'mini-h' }, 'The four classic pictures'), table,  // heading and the table of the four classic pictures
              h('div', { class: 'callout tip m0', style: { fontSize: '15px' }, 'data-label': 'Spot the pattern', html: 'Waiting writers always queue on <b>wsem</b>. At most <b>one</b> reader ever waits on rsem; any other waiting readers are on <b>z</b>. That is exactly z’s job.' }),  // tip: writers always queue on wsem, at most one reader on rsem, the rest on z
              h('div', { class: 'callout why m0', style: { fontSize: '15px' }, 'data-label': 'Compare', html: 'Under readers priority a newcomer walks past a waiting writer whenever readers are inside. Here, once a writer shuts rsem, every newcomer waits.' }))));  // comparison with readers priority: here every newcomer waits once rsem is shut; closes the layout
        },  // ends render() for step 6
      },  // ends step 6

      /* ---------------- 7. Message passing: one controller, three mailboxes ---------------- */
      {  // step 7 (explore): the message-passing solution, with one controller process and three mailboxes
        title: 'Solution 3: a controller and three mailboxes',  // title shown at the top of step 7
        kind: 'explore',  // kind 'explore' sets the header label for this step
        render(el, ctx) {  // render(el, ctx) builds step 7 when the student opens it
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const pre = codeBox(ctx, CTRL);  // pre is the listing of the controller's code
          const preC = codeBox(ctx, CLIENT);  // preC is the listing of the reader and writer code
          const svg = s('svg', { viewBox: '0 0 470 304', width: '100%' });  // the drawing of mailboxes, controller and data, 470 by 304 units
          const cap = h('div', { class: 'cap-box', style: { minHeight: '4.4em', flex: 'none' } });  // cap is the caption box that narrates each controller action
          const clock = h('span', { class: 'chip' });  // clock is a chip showing the current tick
          let M = null, auto = false;  // M will hold the message-passing simulator; auto says whether it runs by itself
          function draw() {  // draw() redraws the three parts of the picture from the simulator's state
            const W = 470, K = [];  // W is the drawing width; K collects the shapes
            K.push(s('text', { x: 2, y: 14, 'font-weight': 800, 'font-size': 15 }, 'Mailboxes'), s('text', { x: 90, y: 14, class: 's-sub', 'font-size': 13 }, '(oldest message on the left)'));  // heading "Mailboxes" with a note that the oldest message is on the left
            ['readrequest', 'writerequest', 'finished'].forEach((nm, i) => {  // draws one row per mailbox
              const y = 24 + i * 38, q = M.mb[nm];  // y is the row's top; q is the list of messages waiting in that mailbox
              K.push(s('text', { x: 2, y: y + 21, class: 's-monot', 'font-weight': 700, 'font-size': 14 }, nm));  // the mailbox's name, in code font
              K.push(s('rect', { x: 118, y, width: W - 120, height: 32, rx: 8, class: 's-os', 'stroke-width': 1.5 }));  // a box in the operating-system colour holding its messages
              q.slice(0, 7).forEach((id, k) => K.push(tok(s, { id, kind: id[0] }, 144 + k * 46, y + 16, { small: true })));  // up to seven small tokens, one per message, oldest first (the sender's first letter picks reader or writer style)
              if (!q.length) K.push(s('text', { x: 130, y: y + 21, class: 's-sub', 'font-size': 13.5 }, 'empty'));  // "empty" when there are no messages
            });  // ends the mailbox rows
            const cy = 146, zone = M.count > 0 ? 0 : M.count === 0 ? 1 : 2, zc = ['ok', 'warn', 'bad'];  // cy is the controller box's top; zone says which of the three count cases applies (above, equal to, or below 0); zc gives each its colour
            K.push(s('rect', { x: 1, y: cy, width: W - 2, height: 84, rx: 12, class: 's-panel', 'stroke-width': 2 }));  // the controller box
            K.push(s('text', { x: 14, y: cy + 22, 'font-weight': 800, 'font-size': 15 }, 'Controller process'));  // its title "Controller process"
            K.push(s('text', { x: 14, y: cy + 56, class: 's-monot', 'font-weight': 800, 'font-size': 26, style: `fill:var(--${zc[zone]})` }, 'count = ' + fmtV(M.count)));  // count in large digits, coloured green, amber or red by case
            K.push(s('text', { x: 14, y: cy + 75, class: 's-sub', 'font-size': 13 }, M.writer ? `writer_id = ${M.writer} (${M.waitW ? 'now writing' : 'waiting for OK'})` : 'count started at 100'));  // under it: which writer was accepted and whether it is writing or waiting for its OK, or a reminder that count started at 100
            [['> 0', 'no writer accepted yet'], ['= 0', 'the writer goes alone'], ['< 0', 'writer waits for readers']].forEach(([a, b], k) => {  // a small key of the three count cases, with the current one lit
              const y = cy + 7 + k * 25, on = k === zone;  // y is this key row's top; on says whether it is the current case
              K.push(s('rect', { x: 226, y, width: 236, height: 21, rx: 6, class: on ? 's-' + zc[k] : 's-muted', 'stroke-width': on ? 2 : 1 }));  // the row's box, coloured when it is the current case
              K.push(s('text', { x: 236, y: y + 15, class: 's-monot', 'font-weight': 800, 'font-size': 13.5, style: on ? `fill:var(--${zc[k]})` : '' }, a));  // the condition, such as "> 0"
              K.push(s('text', { x: 272, y: y + 15, 'font-size': 13.5, class: on ? '' : 's-sub' }, b));  // what it means, such as "no writer accepted yet"
            });  // ends the key
            const ry = 240, inside = M.inside(), wr = inside.find((c) => c.kind === 'W');  // ry is the data box's top; inside lists the clients using the data; wr is the writer among them
            K.push(s('rect', { x: 1, y: ry, width: W - 2, height: 62, rx: 12, class: wr ? 's-accent' : inside.length ? 's-proc' : 's-panel', 'stroke-width': 2 }));  // the data box: writer colour, reader colour, or plain, depending on who is inside
            K.push(s('text', { x: 14, y: ry + 28, 'font-weight': 800, 'font-size': 15 }, 'Using the data'));  // its title "Using the data"
            K.push(s('text', { x: 14, y: ry + 47, class: 's-sub', 'font-size': 13 }, wr ? 'a writer, alone' : inside.length ? plural(inside.length, 'reader', 'readers') : 'nobody'));  // under it: a writer alone, how many readers, or nobody
            inside.slice(0, 5).forEach((c, k) => K.push(tok(s, c, 180 + k * 56, ry + 31)));  // up to five tokens for the clients inside
            svg.replaceChildren(...K);  // replaces the old drawing
          }  // ends draw()
          function paint(msg) {  // paint(msg) redraws everything and shows msg as the caption (if given); it runs after every tick and button press
            draw();  // redraws the picture
            pre.clear(); pre.mark(M.lines, 'cur'); pre.mark(M.bad, 'bad');  // highlights the controller lines that just ran, and in red the line where it is blocked
            if (msg) cap.innerHTML = msg;  // shows the narration, if there is a new one
            clock.textContent = 'tick ' + M.t;  // shows the current tick
            bAuto.textContent = auto ? 'Pause' : 'Auto-run';  // the auto button reads Pause while running and Auto-run otherwise
            bAuto.classList.toggle('on', auto);  // and looks pressed while running
            bR.disabled = M.mb.readrequest.length >= 6; bW.disabled = M.mb.writerequest.length >= 6;  // the ask buttons are disabled when a mailbox already holds six requests
          }  // ends paint()
          function reset() {  // reset() starts the starting scene again
            M = mpEngine();  // a fresh simulator
            M.reading(2); M.reading(3); M.reading(4); M.request('W', 3); M.request('R', 3);  // three readers already inside (count 97), plus a write request from W1 and a read request from R4
            auto = false;  // stops auto-running
            paint('<b>Start.</b> Three readers are inside, so count = 100 − 3 = <b>97</b>. The requests from W1 and R4 sit unread in their mailboxes. Press <b>Next tick</b>: one controller action per tick.');  // starting caption: count is 100 - 3 = 97 and two requests wait unread
          }  // ends reset()
          const ask = (k) => { const c = M.request(k, 3); paint(`${c.id} sends its request to <b>${k === 'R' ? 'readrequest' : 'writerequest'}</b> and blocks until an OK comes back. The controller will see it on a later tick.`); };  // ask(k) makes a new reader or writer send its request, then explains that it now blocks until an OK arrives
          const bR = h('button', { class: 'btn sm proc', type: 'button', onclick: () => ask('R') }, '+ Reader asks');  // button: a new reader asks to read
          const bW = h('button', { class: 'btn sm', type: 'button', style: { borderColor: 'var(--accent)', color: 'var(--accent)' }, onclick: () => ask('W') }, '+ Writer asks');  // button in the writer colour: a new writer asks to write
          const bNext = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { auto = false; paint(M.tick()); } }, 'Next tick ▶');  // Next tick button: stops auto-run and advances one tick, showing the controller's narration
          const bAuto = h('button', { class: 'btn sm', type: 'button', onclick: () => { auto = !auto; paint(); } });  // Auto-run button: starts or pauses automatic ticks
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset');  // Reset button
          reset();  // sets up the starting scene
          ctx.every(1600, () => { if (auto) paint(M.tick()); });  // every 1.6 seconds (stopped automatically when the step closes), one tick passes while auto-running
          const tabs = ctx.ui.tabs([  // two tabs for the code
            { label: 'Controller code', render: (p) => { p.append(pre, h('p', { class: 'm0', style: { marginTop: '8px', fontSize: '14px', lineHeight: '1.4' }, html: '<b>Why 100?</b> Any start value above the largest possible number of readers works (here: at most 99 at once). Then count &gt; 0 always means “no writer accepted yet”, and after count −= 100 the value is exactly minus the readers still inside.' })); } },  // tab 1: the controller code plus a note on why count starts at 100
            { label: 'Reader and writer code', render: (p) => { p.append(h('div', { class: 'stack', style: { gap: '10px' } }, preC,  // tab 2: the reader and writer code...
              h('p', { class: 'small m0', html: 'A reader or writer never touches the data without an <b>OK</b>. <code>mbox[i]</code> is process i’s own mailbox, where its OK arrives. Only the controller ever reads or changes <b>count</b>: it is a private variable of one process, so it needs no semaphore at all.' }),  // ...a note that each client waits for an OK in its own mailbox and only the controller touches count
              h('div', { class: 'callout why m0', style: { fontSize: '15px' }, 'data-label': 'Why it matters', html: 'The processes coordinate only by exchanging messages: no shared counter, no semaphore. So the same design works when they run on different computers that share nothing but the data itself (a file on a server, say). The price is one extra process that every access must go through.' }))); } },  // ...and a callout: with messages only, the design works across computers that share nothing else
          ]);  // closes the tabs list
          el.append(h('div', { class: 'split r fill' },  // builds the step: the code tabs on the left, the simulation on the right
            h('div', { class: 'stack' }, tabs),  // left column: the tabs
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked
              h('div', { class: 'row gap-s' }, bR, bW, bReset),  // first button row: the two ask buttons and Reset
              h('div', { class: 'row gap-s' }, bNext, bAuto, clock),  // second button row: Next tick, Auto-run and the tick chip
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg), cap,  // card with the drawing, then the caption
              h('p', { class: 'small muted m0', html: 'This is <span class="t">message passing</span>: no shared variables at all. Each <span class="t">mailbox</span> queues messages, and one <span class="t">controller process</span> owns the only counter.' }))));  // closing note: this is message passing, with mailboxes and one controller owning the only counter; closes the layout
        },  // ends render() for step 7
      },  // ends step 7

      /* ---------------- 8. Predict: who goes next? ---------------- */
      {  // step 8 (predict): look at a situation and predict who goes next
        title: 'Predict: who goes next?',  // title shown at the top of step 8
        kind: 'predict',  // kind 'predict' sets the header label for this step
        render(el, ctx) {  // render(el, ctx) builds step 8 when the student opens it
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const A = (...ks) => (E) => ks.forEach((k) => { E.arrive(k, 99); E.settle(); });  // A(...ks) makes a setup action: processes of the given kinds arrive one after another, each with a very long job
          const D = (...ids) => (E) => { ids.forEach((id) => E.endWork(id)); E.settle(); };  // D(...ids) makes an action: the named processes finish their work, then everyone moves
          const PZ = [  // PZ: the prediction puzzles
            { pol: 'rp', setup: A('R', 'R', 'W'), then: A('R'),  // puzzle 1 (readers priority): setup R1, R2 reading and W1 waiting; then R3 arrives
              q: 'R1 and R2 are reading and W1 waits on wsem. Now <b>R3 arrives</b>. What happens to R3?',  // question: what happens to R3?
              choices: ['R3 walks straight in and reads with R1 and R2', 'R3 waits behind W1 in wsem’s queue', 'R3 waits on x until R1 and R2 leave'], answer: 0,  // choices: walks in, waits behind W1, or waits on x; the first is right
              why: 'R3 finds readcount already above 0, so it never touches wsem. Only the first reader competes with writers; later readers simply join the group. This is how a writer starves.' },  // why: R3 never touches wsem because readcount is above 0, which is how a writer starves
            { pol: 'wp', setup: A('R', 'R', 'W'), then: A('R'),  // puzzle 2 (writers priority): the same setup and the same newcomer
              q: 'Same crowd, other policy: R1 and R2 are reading and W1 is waiting. Now <b>R3 arrives</b>. What happens to R3?',  // question: what happens to R3 under this policy?
              choices: ['R3 walks straight in', 'R3 is stopped at rsem, which W1 has closed', 'R3 is stopped at wsem, behind W1'], answer: 1,  // choices: walks in, stopped at rsem, or stopped at wsem; the second is right
              why: 'As the first writer, W1 did semWait(rsem) before queueing on wsem. R3 gets past z but blocks on rsem: no new reader may start once a writer has asked.' },  // why: W1 closed rsem before queueing on wsem, so R3 blocks at the gate
            { pol: 'rp', setup: A('W'), then: A('R', 'R'),  // puzzle 3 (readers priority): setup W1 writing; then R1 and R2 arrive
              q: 'W1 is writing. Then <b>R1 arrives, and then R2</b>. Where does each reader wait?',  // question: where does each reader wait?
              choices: ['Both wait on wsem', 'R1 waits on wsem (still holding x); R2 waits on x', 'Both wait on x'], answer: 1,  // choices: both on wsem, R1 on wsem and R2 on x, or both on x; the second is right
              why: 'R1 takes x, sets readcount = 1 and, as the first reader, blocks on wsem without releasing x. R2 therefore blocks at its very first line, semWait(x).' },  // why: R1 blocks on wsem while still holding x, so R2 blocks on its first line
            { pol: 'wp', setup: A('W', 'R', 'W', 'R'), then: D('W1'),  // puzzle 4 (writers priority): setup W1 writing with W2, R1 and R2 waiting; then W1 finishes
              q: 'W1 is writing; W2 waits on wsem, R1 on rsem, R2 on z. <b>W1 finishes.</b> Who uses the data next?',  // question: who uses the data next?
              choices: ['R1 and R2, together', 'W2', 'R1 alone'], answer: 1,  // choices: both readers, W2, or R1 alone; the second is right
              why: 'W1’s semSignal(wsem) releases W2, the front of that queue. writecount only falls from 2 to 1, so rsem stays shut and the readers keep waiting.' },  // why: W2 is released from wsem; writecount is still 1, so rsem stays shut
            { pol: 'wp', setup: A('R', 'R', 'W', 'R'), then: D('R1', 'R2'),  // puzzle 5 (writers priority): setup R1, R2 reading, W1 waiting, R3 at the gate; then both readers finish
              q: 'R1 and R2 are reading, W1 waits on wsem and R3 on rsem. <b>R1 and R2 both finish.</b> Who goes next?',  // question: who goes next?
              choices: ['R3, since readers were already in charge', 'W1', 'R3 and W1 together'], answer: 1,  // choices: R3, W1, or both; the second is right
              why: 'The last reader out signals wsem, which releases W1. R3 sits behind the closed rsem gate until writecount returns to 0.' },  // why: the last reader out releases W1; R3 waits until writecount is back to 0
            { pol: 'mp',  // puzzle 6 (message passing), which uses a log of count values instead of a drawing
              q: 'Message passing. count starts at 100. The controller grants <b>4</b> read requests and then receives <b>1</b> finished message. Now it accepts a write request. What is count?',  // question: count after 4 grants, 1 finished message and an accepted write request
              choices: ['−3', '96', '0'], answer: 0,  // choices: -3, 96 or 0; the first is right
              why: '100 − 4 + 1 = 97 while three readers are inside; 97 − 100 = −3. The controller now waits for exactly 3 finished messages (count climbs to 0) before it sends the writer its OK.',  // why: 100 - 4 + 1 = 97, then 97 - 100 = -3, so the controller waits for 3 more finished messages
              log: ['start: count = 100', '4 read requests granted: 99, 98, 97, 96', '1 finished message: 97 (3 readers inside)'], after: ['write request accepted: 97 − 100 = −3', '3 finished messages: −2, −1, 0', 'count == 0: the writer gets its OK'] },  // log shown before answering, and after: the follow-up events revealed once the student answers
          ];  // closes PZ
          let i = 0, view = 0;  // i is the current puzzle; view is 0 for the Before picture and 1 for After
          const chosen = PZ.map(() => null);  // chosen[k] is the student's answer to puzzle k, or null if not yet answered
          const nav = h('div', { class: 'row nw', style: { gap: '6px' } });  // nav holds the numbered puzzle buttons
          const qEl = h('div', { style: { fontSize: '18px', fontWeight: 650, lineHeight: '1.4' } });  // qEl shows the question in large text
          const opts = h('div', { class: 'qopts' });  // opts holds the answer buttons
          const fb = h('div', { class: 'verdict' });  // fb is the feedback box (it reuses the verdict style)
          const pol = h('span', { class: 'chip accent' });  // pol is a chip naming the policy of the current puzzle
          const svg = s('svg', { width: '100%' });  // the Before/After drawing
          const logEl = h('div', { class: 'stack', style: { gap: '8px' } });  // logEl holds the event log for the message-passing puzzle
          const vis = h('div', { class: 'card white', style: { padding: '10px 12px' } });  // vis is the card that shows either the drawing or the log
          const seg = ctx.ui.seg([{ value: 0, label: 'Before' }, { value: 1, label: 'After' }], 0, (v) => { view = v; paintVis(); });  // Before/After switch; changing it redraws the picture
          const tip = h('div', { class: 'callout tip m0', style: { fontSize: '15px', marginTop: 'auto' }, 'data-label': 'Reading the picture' });  // tip is a callout explaining how to read the picture
          const bPrev = h('button', { class: 'btn sm', type: 'button', onclick: () => go(i - 1) }, '◀ Previous');  // Previous button
          const bNext = h('button', { class: 'btn sm primary', type: 'button', onclick: () => go(i + 1) }, 'Next puzzle ▶');  // Next puzzle button
          function paintVis() {  // paintVis() draws the Before or After picture for the current puzzle
            const p = PZ[i];  // p is the current puzzle
            seg.querySelectorAll('button')[1].disabled = chosen[i] == null;  // the After button works only once the puzzle has been answered
            tip.innerHTML = p.pol === 'mp'  // tip text depends on the puzzle...
              ? 'Each box is one event in the controller’s life. The violet boxes appear once you answer: they show the arithmetic and what the controller does next.'  // ...for message passing: each box is one controller event, and the coloured ones appear after answering
              : 'A <b>dashed</b> token is blocked in that semaphore’s queue, front of the line first. A <mark>highlighted</mark> token was just released by a semSignal. A negative value counts the processes waiting.';  // ...for the semaphore puzzles: dashed means blocked, highlighted means just released, negative values count waiters
            if (p.pol === 'mp') {  // the message-passing puzzle shows a log instead of a drawing
              const rows = p.log.concat(view ? p.after : ['write request accepted: count = ?']);  // rows: the log so far, plus either the revealed follow-up or a "count = ?" placeholder
              logEl.replaceChildren(h('div', { class: 'mini-h' }, 'Controller’s count, event by event'),  // fills the log with a heading...
                ...rows.map((r, k) => h('div', { class: 'box' + (k >= p.log.length ? ' os' : ''), style: { textAlign: 'left', fontWeight: 600, fontSize: '15.5px' } }, r)));  // ...and one box per event, with the follow-up events in the operating-system colour
              vis.replaceChildren(logEl);  // shows the log in the card
              return;  // stops here, since there is no drawing for this puzzle
            }  // ends the message-passing case
            const E = engine(p.pol);  // a fresh simulator for the puzzle's policy
            p.setup(E); E.mark();  // builds the Before situation, then clears the "just ran" marks
            if (view) p.then(E);  // for the After picture, also makes the puzzle's next move
            drawRW(s, svg, E, { W: ctx.narrow ? 400 : 540, roomH: p.pol === 'rp' ? 116 : 84, rowH: p.pol === 'rp' ? 40 : 31, title: view ? 'After' : 'Before' });  // draws the room and semaphores, titled Before or After
            vis.replaceChildren(svg);  // shows the drawing in the card
          }  // ends paintVis()
          function paint() {  // paint() redraws the puzzle: buttons, question, choices, feedback and picture
            const p = PZ[i], c = chosen[i];  // p is the current puzzle and c the student's answer to it
            nav.replaceChildren(...PZ.map((_, k) => h('button', { type: 'button', class: 'quiz-pill' + (k === i ? ' on' : '') + (chosen[k] != null ? (chosen[k] === PZ[k].answer ? ' right' : ' wrong') : ''), onclick: () => go(k) }, String(k + 1))));  // one numbered button per puzzle, marked green or red once answered
            pol.textContent = p.pol === 'rp' ? 'Readers priority' : p.pol === 'wp' ? 'Writers priority' : 'Message passing';  // names the puzzle's policy
            qEl.innerHTML = p.q;  // shows the question
            opts.replaceChildren(...p.choices.map((t, k) => {  // rebuilds the three answer buttons
              const b = h('button', { type: 'button', class: 'qopt', onclick: () => { if (chosen[i] == null) { chosen[i] = k; view = 1; seg.set(1); paint(); } } },  // each button records the answer (only the first time), switches to the After picture and repaints
                h('span', { class: 'ql' }, 'ABC'[k]), h('span', { html: t }));  // its letter (A, B or C) and its text
              if (c != null) { b.disabled = true; if (k === p.answer) b.classList.add('right'); else if (k === c) b.classList.add('wrong'); else b.classList.add('dim'); }  // once answered, all buttons are disabled; the right one turns green, a wrong pick red, the others dim
              return b;  // returns the button
            }));  // ends the answer buttons
            if (c == null) { fb.className = 'verdict'; fb.innerHTML = '<span class="vh">Commit to a prediction</span>Pick one answer. Then the picture switches from <b>Before</b> to <b>After</b> so you can check it.'; }  // before answering: the feedback box asks the student to commit to a prediction
            else { fb.className = 'verdict ' + (c === p.answer ? 'ok' : 'bad'); fb.innerHTML = `<span class="vh">${c === p.answer ? '✓ Right' : '✗ Not quite: the answer is ' + 'ABC'[p.answer]}</span>${p.why}`; }  // after answering: it says right or wrong (with the correct letter) and explains why
            bPrev.disabled = i === 0; bNext.disabled = i === PZ.length - 1;  // disables Previous on the first puzzle and Next on the last
            if (c == null) { view = 0; seg.set(0); }  // an unanswered puzzle always shows the Before picture
            paintVis();  // redraws the picture
          }  // ends paint()
          function go(k) { i = Math.max(0, Math.min(PZ.length - 1, k)); view = chosen[i] == null ? 0 : 1; seg.set(view); paint(); }  // go(k) moves to puzzle k (kept in range), showing After if it was already answered, then repaints
          el.append(h('div', { class: 'split fill' },  // builds the step: the question on the left, the picture on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column, stacked
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, nav, pol), qEl, opts, fb,  // puzzle buttons and policy chip, then the question, answers and feedback
              h('div', { class: 'row', style: { marginTop: 'auto' } }, bPrev, bNext)),  // Previous and Next at the bottom; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, seg, h('span', { html: LEGEND })), vis,  // the Before/After switch with the R/W legend, then the picture card
              tip)));  // the reading tip at the bottom; closes the layout
          paint();  // draws the first puzzle once
        },  // ends render() for step 8
      },  // ends step 8

      /* ---------------- 9. Recap ---------------- */
      {  // step 9 (recap): flip cards for six ideas and a comparison table
        title: 'Recap: six ideas to carry away',  // title shown at the top of step 9
        kind: 'recap',  // kind 'recap' sets the header label for this step
        render(el, ctx) {  // render(el, ctx) builds step 9 when the student opens it
          const { h } = ctx;  // takes the element builder h out of ctx
          // each face is wrapped in one <span>: the card face is a flex box, so bare inline tags would become separate columns
          const wrap = (pairs) => pairs.map(([f, bk]) => ['<span>' + f + '</span>', '<span>' + bk + '</span>']);  // wrap(pairs) puts each card face's text inside one span so it stays together in the card layout
          const cards = ctx.ui.flipcards(wrap([  // the flip cards: a prompt on the front and the answer on the back
            ['The three rules', 'Any number of readers at once; only one writer at a time; nobody reads while a writer writes.'],  // flip card: the three rules
            ['Who touches wsem in solution 1?', 'Every writer, but among readers only the <b>first in</b> (takes it) and the <b>last out</b> (returns it). The readers hold it as a group.'],  // flip card: who touches wsem in solution 1 (every writer, but only the first and last reader)
            ['The flaw of readers priority', 'Writers can <b>starve</b>: if readers keep overlapping, readcount never reaches 0, so wsem is never released.'],  // flip card: the flaw of readers priority (writers can starve)
            ['What rsem does', 'It is the reader gate. The first interested writer closes it and the last one reopens it, so no new reader starts while a writer waits.'],  // flip card: what rsem does (the reader gate)
            ['Why z exists', 'Only one reader may queue on rsem; the rest wait on z. A writer calling semWait(rsem) is never stuck behind a crowd of readers.'],  // flip card: why z exists (only one reader queues on rsem)
            ['The controller’s count', '<b>&gt; 0</b>: no writer accepted yet (100 − readers inside). <b>= 0</b>: the writer goes alone. <b>&lt; 0</b>: a writer waits for −count readers to leave.'],  // flip card: the meaning of the controller's count above, at and below 0
          ]), { cols: 3, height: 146 });  // closes the cards: three columns, each card 146px tall
          const sol = (name, tag, body, cls) => h('div', { class: 'card tight ' + cls }, h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('b', {}, name), h('span', { class: 'chip' }, tag)), h('p', { class: 'small m0', style: { marginTop: '4px' }, html: body }));  // sol(name, tag, body, cls) builds one small summary card with a name, a chip and a short text
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // builds the step: everything stacked in one column
            h('p', { class: 'lead m0' }, 'Say each answer out loud, then click the card to check yourself.'),  // instruction: say each answer out loud, then click to check
            cards,  // the flip cards
            h('div', { class: 'mini-h', style: { marginTop: '4px' } }, 'The three solutions at a glance'),  // heading for the comparison cards
            h('div', { class: 'grid-3' },  // three summary cards side by side
              sol('1 · Readers priority', 'x, wsem', 'Maximum sharing and the simplest code. Weakness: a steady stream of readers can starve a writer.', 'proc'),  // card: readers priority, the simplest, but writers can starve
              sol('2 · Writers priority', '+ rsem, y, z', 'Once a writer asks, no new reader starts; the readers inside drain out. Weakness: readers can wait long if writers keep coming.', ''),  // card: writers priority, no new reader once a writer asks, but readers can wait long
              sol('3 · Message passing', 'controller', 'One controller answers readrequest, writerequest and finished, checking finished first and writers before readers. No shared counters or semaphores.', 'os'))));  // card: message passing, one controller and no shared counters; closes the layout
        },  // ends render() for step 9
      },  // ends step 9

      /* ---------------- 10. Check yourself ---------------- */
      {  // step 10 (check): the section quiz
        title: 'Check yourself',  // title shown at the top of step 10
        kind: 'check',  // kind 'check' sets the header label for this step
        quiz: [  // quiz: the questions; the shell's quiz engine shows them one at a time and saves the score
          { q: 'Which situation breaks the readers/writers rules?',  // quiz question 1 (multiple choice): which situation breaks the rules
            choices: ['Three readers reading the data at the same time', 'One writer writing while nobody else uses the data', 'One reader reading while one writer writes', 'Nobody using the data at all'], answer: 2,  // choices: three readers, one writer alone, a reader with a writer, nobody; the third is right (answer counts from 0)
            feedback: ['Allowed: any number of readers may read together.', 'Allowed: the writer has the data to itself, which is exactly what it needs.', null, 'An unused data area breaks no rule.'],  // feedback for each wrong choice (null where the choice is right)
            why: 'While a writer is writing, no reader may read. The reader could see a half-finished update that mixes old and new values.' },  // why: a reader during a write could see a half-finished update; closes question 1
          { type: 'tf', q: 'In the readers-priority semaphore solution, every reader performs semWait(wsem) before it reads.', answer: false,  // quiz question 2 (true or false): every reader does semWait(wsem) in solution 1 (false)
            why: 'Only the reader that raises readcount from 0 to 1 calls semWait(wsem), and only the one that brings it back to 0 calls semSignal(wsem). The readers hold wsem as a group.' },  // why: only the first reader in and the last reader out touch wsem; closes question 2
          { q: 'In the readers-priority solution, why can a writer starve?',  // quiz question 3 (multiple choice): why a writer can starve under readers priority
            choices: ['It needs readcount to reach 0, but new readers keep joining while others are still reading', 'It is blocked on x, which readers never release', 'The semaphore wsem starts at 0', 'Readers are faster than writers, so the scheduler prefers them'], answer: 0,  // choices: readers keep joining, blocked on x, wsem starts at 0, scheduler prefers readers; the first is right
            feedback: [null, 'Writers never touch x in this solution; x only protects readcount.', 'wsem starts at 1, so a writer gets in at once when nobody is inside.', 'Speed has nothing to do with it; the rule that lets a new reader join the group does.'],  // feedback for the wrong choices
            why: 'A writer needs wsem, and the readers give it back only when the last of them leaves. If readers keep overlapping, that moment never arrives.' },  // why: the readers give wsem back only when the last one leaves; closes question 3
          { type: 'multi', q: 'Which statements about the writers-priority semaphore solution are true?',  // quiz question 4 (select all): true statements about the writers-priority solution
            choices: ['The writer that raises writecount from 0 to 1 closes rsem, so no new reader can start', 'writecount counts the writers that are waiting or writing', 'Two writers may write together as long as no reader is reading', 'At most one reader is ever queued on rsem; other waiting readers queue on z', 'Readers already inside are forced to stop the moment a writer arrives'], answer: [0, 1, 3],  // the five statements; the first, second and fourth are right
            why: 'rsem is the reader gate, driven by writecount, and z keeps rsem’s queue down to one reader. Writers still take wsem one at a time, and readers already inside are allowed to finish: they drain out.' },  // why: rsem is the gate driven by writecount, z keeps its queue to one reader, readers inside drain out; closes question 4
          { type: 'match', q: 'Match each variable of the writers-priority solution with its job.',  // quiz question 5 (match): each writers-priority variable and its job
            pairs: [['rsem', 'Keeps new readers out while any writer is interested'], ['wsem', 'Gives the data to one writer or to the group of readers'], ['x', 'Protects readcount'], ['y', 'Protects writecount'], ['z', 'Lets only one reader at a time wait on rsem']],  // the pairs: rsem, wsem, x, y and z
            why: 'wsem guards the data itself; rsem is the gate writers close; x and y protect the two counters; z is the turnstile that stops readers piling up on rsem.' },  // why: a one-line summary of each job; closes question 5
          { q: 'Writers-priority semaphore solution: the readers hold wsem, a writer has closed rsem, every writer is queued on wsem, one reader is queued on rsem and the other waiting readers are queued on z. Which situation is this?',  // quiz question 6 (multiple choice): identify the situation from its queue picture
            choices: ['Only readers are in the system', 'Only writers are in the system', 'Both readers and writers, and a read came first', 'Both readers and writers, and a write came first'], answer: 2,  // choices: only readers, only writers, both with a read first, both with a write first; the third is right
            feedback: ['With only readers there are no queues at all.', 'With only writers no reader would be queued anywhere.', null, 'If a write had come first, a writer would hold wsem, not the readers.'],  // feedback for the wrong choices
            why: 'A reader got in first and holds wsem for the readers. The first writer then closed rsem and queued on wsem; later readers stop at rsem (just one) and z (the rest).' },  // why: a reader got in first, then a writer closed rsem; closes question 6
          { type: 'order', q: 'Readers priority: put the steps of the <b>first</b> reader to arrive in order.',  // quiz question 7 (put in order): the steps of the first reader to arrive under readers priority
            items: ['semWait(x): lock the counter', 'readcount++ (it is now 1)', 'semWait(wsem): lock writers out', 'semSignal(x): unlock the counter', 'READUNIT(): read the data'],  // the steps in their correct order (the quiz shuffles them)
            why: 'The counter is locked, updated and tested; the first reader claims wsem for the group; only then does it release the counter and read.' },  // why: lock, update and test the counter, claim wsem, release the counter, read; closes question 7
          { type: 'bucket', q: 'Which semaphore solution does each feature belong to?', buckets: ['Readers priority', 'Writers priority'],  // quiz question 8 (sort into groups): which semaphore solution each feature belongs to
            items: [['Uses only two semaphores, x and wsem', 0], ['A newly arriving reader may join while a writer waits', 0], ['Needs a writecount variable', 1], ['A waiting writer can starve', 0], ['A stream of writers can keep readers waiting', 1], ['Uses the semaphores rsem, y and z', 1]],  // the six features, each with the number of its correct group
            why: 'Readers priority is the short solution that lets readers join freely, at the risk of starving writers. Writers priority adds rsem, y, z and writecount so a waiting writer is never overtaken by new readers.' },  // why: the short solution risks starving writers; the longer one protects them; closes question 8
          { type: 'num', q: 'Message-passing solution: count starts at 100. The controller has granted 6 read requests and received 2 finished messages. It now accepts a write request. What is count right after that?', answer: -4, tol: 0,  // quiz question 9 (calculate): count after 6 grants, 2 finished messages and an accepted write (answer -4)
            why: '100 − 6 + 2 = 96, meaning four readers are inside. 96 − 100 = −4, so the controller now waits for four finished messages before the writer may start.' },  // why: 100 - 6 + 2 = 96, then 96 - 100 = -4; closes question 9
          { type: 'num', q: 'Message-passing readers/writers solution: the controller’s count is −2. How many finished messages must it receive before it sends the waiting writer its OK?', answer: 2, tol: 0,  // quiz question 10 (calculate): finished messages needed when count is -2 (answer 2)
            why: 'A negative count is minus the number of readers still inside. Each finished message adds 1, and when count reaches 0 the writer gets its OK.' },  // why: a negative count is minus the readers still inside; closes question 10
          { type: 'tf', q: 'In the message-passing solution, when count > 0 the controller checks the finished mailbox first, then writerequest, then readrequest. Checking writerequest before readrequest is what gives writers priority over newly arriving readers.', answer: true,  // quiz question 11 (true or false): checking writerequest before readrequest gives writers priority (true)
            why: 'Serving finished first keeps count accurate; checking writerequest before readrequest means a waiting writer is always taken ahead of a new reader, and once it is taken count ≤ 0, so no further read request is served until the writer is done.' },  // why: a waiting writer is always taken before a new reader, and count then stops further reads; closes question 11
          { q: 'Why is the readers/writers problem not simply the producer/consumer problem?',  // quiz question 12 (multiple choice): why this is not the producer/consumer problem
            choices: ['Readers never change the data, so they may share it; a consumer is not read-only, because it removes an item and updates the buffer’s pointers', 'There are always more readers than writers', 'Producer/consumer cannot be solved with semaphores', 'In readers/writers no process ever has to wait'], answer: 0,  // choices: readers never change the data but a consumer does, more readers, no semaphores possible, nobody waits; the first is right
            feedback: [null, 'How many of each kind there are does not define the problem; the rules would be the same with one reader and ten writers.', 'It can; that is a standard semaphore exercise.', 'Readers and writers certainly wait for each other: rule 3 forbids reading during a write.'],  // feedback for the wrong choices
            why: 'It can look like one writer (the producer) and one reader (the consumer), but the consumer changes the buffer too: it removes an item and updates the pointers, while the producer reads those pointers to find a free slot and then updates them. Both sides modify shared data, so neither may share it. Readers leave the data untouched, which is exactly why many of them may share it at once.' },  // why: both producer and consumer modify the buffer, while readers leave the data untouched; closes question 12
        ],  // closes the quiz list
      },  // ends step 10

    ],  // closes the steps list

    notes: `${/* notes: the section's summary text, shown in the Notes panel and in the printable version */''}
      <h3>1. The problem</h3>${/* notes heading 1: the problem */''}
      <p>A <b>shared data area</b> (a file, a block of main memory, or even a bank of processor registers) is used by two kinds of processes. <b>Readers</b> only read it and never change it, so they may share access. <b>Writers</b> modify it (a writer may also read the data as part of its update), so each writer needs exclusive access. Three rules must hold:</p>${/* notes paragraph: readers share, writers need the data alone, and three rules must hold */''}
      <ol><li>Any number of readers may read at the same time.</li><li>Only one writer at a time may write.</li><li>While a writer is writing, no reader may read.</li></ol>${/* notes list: the three rules */''}
      <p>Rule 3 exists because a reader could otherwise see an update half-done. Example: a board says “09:40, gate B7”; the writer has changed the time to 10:15 but not yet the gate, so a reader sees “10:15, gate B7”, a combination that was never true.</p>${/* notes paragraph: why rule 3 exists, with the departure-board example */''}
      <h4>Why it is its own problem</h4>${/* notes subheading: why it is its own problem */''}
      <ul>${/* starts the list */''}
        <li><b>Not plain mutual exclusion.</b> If we could not tell which processes only read, one lock (one critical section) around every access would be the only safe choice. Knowing that readers never change the data lets them share. Example: 4 readers of 2 ms each take 4 × 2 = 8 ms under one lock, but 2 ms when they overlap (a processor each).</li>${/* list item: not plain mutual exclusion, with the 8 ms versus 2 ms example */''}
        <li><b>Not producer/consumer.</b> It can look like one writer (producer) and one reader (consumer), but the consumer is not read-only: it removes an item and updates the buffer’s pointers. The producer reads those pointers to find a free slot and check for “full”, then updates them. Both sides change the buffer, so neither may share it, and each waits for the other (an item to take, a slot to fill). Readers never change the data, which is exactly why many may share it.</li>${/* list item: not producer/consumer, because both sides change the buffer */''}
      </ul>${/* ends the list */''}
      <h3>2. Solution 1: readers have priority</h3>${/* notes heading 2: solution 1, readers have priority */''}
      <p>Shared: <code>int readcount = 0; semaphore x = 1, wsem = 1;</code>. <b>x</b> protects readcount; <b>wsem</b> protects the data.</p>${/* notes line: the shared variables of solution 1 */''}
      <pre>/* reader, each time it reads */${/* starts the code box with a label for the reader's code */''}
${listing(CODE.rp.R, true)}${/* inserts the reader's code, generated from the same table the simulator runs, in compact form */''}

/* writer, each time it writes */${/* label for the writer's code */''}
${listing(CODE.rp.W, true)}</pre>${/* inserts the writer's code in compact form; ends the code box */''}
      <ul>${/* starts the list of points about solution 1 */''}
        <li>Every writer does semWait(wsem) / semSignal(wsem) around its write.</li>${/* list item: every writer waits on and signals wsem */''}
        <li>Among readers only the <b>first in</b> (readcount 0 → 1) takes wsem and only the <b>last out</b> (1 → 0) returns it. The readers hold wsem as one group.</li>${/* list item: only the first and last readers touch wsem */''}
        <li>Where they wait: a writer waits on wsem. If a writer is writing, the first arriving reader blocks on wsem <i>while still holding x</i>, so any further readers block on x.</li>${/* list item: where processes wait, including the first reader holding x */''}
        <li><b>Weakness: writers can starve.</b> A newly arriving reader joins whenever other readers are inside, even if a writer is waiting. If readers keep overlapping, readcount never returns to 0 and the writer waits indefinitely.</li>${/* list item: the weakness, writer starvation */''}
      </ul>${/* ends the list */''}
      <h3>3. Solution 2: writers have priority</h3>${/* notes heading 3: solution 2, writers have priority */''}
      <p>Goal: once a writer has declared that it wants to write, no new reader may start. Shared: <code>int readcount = 0, writecount = 0; semaphore x = 1, y = 1, z = 1, wsem = 1, rsem = 1;</code></p>${/* notes paragraph: the goal and the shared variables */''}
      <table><tr><th>Name</th><th>Job</th></tr>${/* starts the table of names and jobs */''}
        <tr><td>wsem</td><td>Guards the data: held by one writer or by the group of readers (first reader in, last reader out).</td></tr>${/* table row: wsem guards the data */''}
        <tr><td>rsem</td><td>Reader gate. The writer that takes writecount 0 → 1 closes it; the writers then hold it as a group, and whichever writer takes writecount 1 → 0 reopens it.</td></tr>${/* table row: rsem, the reader gate */''}
        <tr><td>z</td><td>A reader keeps z while it waits on rsem, so only one reader at a time can wait on rsem; the others wait on z. A writer calling semWait(rsem) is never behind a crowd of readers: at worst it waits briefly for that one reader, still holding y, so other writers briefly wait on y.</td></tr>${/* table row: z, which keeps rsem's queue to one reader */''}
        <tr><td>x / y</td><td>Protect readcount / writecount.</td></tr>${/* table row: x and y protect the two counters */''}
        <tr><td>writecount</td><td>Writers that are waiting or writing.</td></tr></table>${/* table row: writecount counts writers waiting or writing; ends the table */''}
      <pre>/* reader */${/* starts the code box with a label for the reader's code */''}
${listing(CODE.wp.R, true)}${/* inserts the writers-priority reader's code in compact form */''}

/* writer */${/* label for the writer's code */''}
${listing(CODE.wp.W, true)}</pre>${/* inserts the writers-priority writer's code; ends the code box */''}
      <h4>The four queue pictures</h4>${/* notes subheading: the four queue pictures */''}
      <table><tr><th>Situation</th><th>Semaphores and queues</th></tr>${/* starts the table of situations */''}
        <tr><td>Only readers</td><td>The readers hold wsem; nobody waits anywhere.</td></tr>${/* table row: only readers, so nobody waits */''}
        <tr><td>Only writers</td><td>A writer holds wsem, the writers keep rsem closed; the other writers line up on wsem.</td></tr>${/* table row: only writers, so writers line up on wsem */''}
        <tr><td>Both, read first</td><td>The readers hold wsem, a writer has closed rsem; every writer lines up on wsem, one reader waits on rsem, the other readers wait on z.</td></tr>${/* table row: both, with a read first */''}
        <tr><td>Both, write first</td><td>A writer holds wsem, the writers keep rsem closed; writers line up on wsem, one reader waits on rsem, the other readers wait on z.</td></tr></table>${/* table row: both, with a write first; ends the table */''}
      <p>Readers already inside when a writer arrives finish normally; the last one out hands wsem to the writer. The price: a stream of writers can keep readers waiting.</p>${/* notes paragraph: readers inside finish normally; the price is that readers can wait */''}
      <h3>4. Solution 3: message passing</h3>${/* notes heading 4: solution 3, message passing */''}
      <p>A <b>controller process</b> owns access. Readers and writers send requests to the mailboxes <b>readrequest</b> or <b>writerequest</b>, block on their own mailbox (mbox[i]) until the controller sends them “OK”, use the data, then send a message to <b>finished</b>. The controller keeps <b>count</b>, a private variable no other process touches, which starts at 100 (any number above the largest possible number of readers):</p>${/* notes paragraph: how clients and the controller exchange messages, and why count starts at 100 */''}
      <ul>${/* starts the list of count cases */''}
        <li><b>count &gt; 0</b>: no writer accepted yet (a request may sit unread in writerequest); count = 100 − readers inside. The controller serves <b>finished</b> first (count++), then <b>writerequest</b> (count −= 100), then <b>readrequest</b> (count--, send OK). Checking writers before readers gives writers priority.</li>${/* list item: count above 0, with the order in which mailboxes are served */''}
        <li><b>count == 0</b>: only the accepted writer is left. Send it OK, wait for its finished message, reset count to 100.</li>${/* list item: count exactly 0, when the writer goes alone */''}
        <li><b>count &lt; 0</b>: a writer is waiting for −count readers to leave. The controller receives only finished messages, adding 1 each time, until count reaches 0.</li>${/* list item: count below 0, when the controller waits for readers to leave */''}
      </ul>${/* ends the list */''}
      <p><b>Worked example.</b> Three readers inside: count = 97. A write request is accepted: 97 − 100 = −3. Three finished messages: −2, −1, 0. The writer gets OK, writes, reports finished; count = 100. Only now is a waiting read request served (count = 99).</p>${/* notes paragraph: a worked example from 97 to -3 and back to 100 */''}
      <h3>5. Comparison</h3>${/* notes heading 5: comparison */''}
      <table><tr><th>Solution</th><th>Tools</th><th>Who can wait a long time?</th></tr>${/* starts the comparison table with its headings */''}
        <tr><td>Readers priority</td><td>x, wsem, readcount</td><td>Writers (can starve)</td></tr>${/* table row: readers priority, where writers can starve */''}
        <tr><td>Writers priority</td><td>+ rsem, y, z, writecount</td><td>Readers, if writers keep coming</td></tr>${/* table row: writers priority, where readers can wait */''}
        <tr><td>Message passing</td><td>controller, 3 mailboxes, count</td><td>Readers (writers are served first)</td></tr></table>`,  // table row: message passing, where readers wait; ends the table and the notes text
  });  // ends the section object passed to Guide.section
})();  // ends the wrapping function and runs it immediately
