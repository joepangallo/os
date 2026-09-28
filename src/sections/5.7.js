/* =====================================================================
   5.7  Readers/Writers Problem
   One shared data area, many readers, a few writers.
   Helpers (semaphore engine, code tables, drawing) live inside this IIFE
   so nothing leaks into the global scope.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     1. The code, written ONCE as tables of [code, comment, operation].
        Both the listings students read and the programs the simulator
        runs are generated from these tables, so a highlighted line is
        always exactly the line that just executed.
     --------------------------------------------------------------- */
  const W_ = (s) => ({ k: 'wait', s });
  const S_ = (s) => ({ k: 'signal', s });
  const INC = (v) => ({ k: 'inc', v });
  const DEC = (v) => ({ k: 'dec', v });
  const WORK = { k: 'work' };
  const CODE = {
    rp: {
      R: [
        ['semWait(x);', 'lock the counter', W_('x')],
        ['readcount++;', 'one more reader inside', INC('readcount')],
        ['if (readcount == 1) semWait(wsem);', 'first reader bars writers', { k: 'waitIf', v: 'readcount', eq: 1, s: 'wsem' }],
        ['semSignal(x);', 'unlock the counter', S_('x')],
        ['READUNIT();', 'read (others may too)', WORK],
        ['semWait(x);', 'lock the counter again', W_('x')],
        ['readcount--;', 'one fewer reader inside', DEC('readcount')],
        ['if (readcount == 0) semSignal(wsem);', 'last out lets writers in', { k: 'signalIf', v: 'readcount', eq: 0, s: 'wsem' }],
        ['semSignal(x);', 'unlock the counter', S_('x')],
      ],
      W: [
        ['semWait(wsem);', 'wait until data is free', W_('wsem')],
        ['WRITEUNIT();', 'write, completely alone', WORK],
        ['semSignal(wsem);', 'hand the data back', S_('wsem')],
      ],
    },
    wp: {
      R: [
        ['semWait(z);', 'readers line up here', W_('z')],
        ['semWait(rsem);', 'closed while writers wait', W_('rsem')],
        ['semWait(x);', 'lock readcount', W_('x')],
        ['readcount++;', 'one more reader inside', INC('readcount')],
        ['if (readcount == 1) semWait(wsem);', 'first reader bars writers', { k: 'waitIf', v: 'readcount', eq: 1, s: 'wsem' }],
        ['semSignal(x);', 'unlock readcount', S_('x')],
        ['semSignal(rsem);', 'reopen the reader gate', S_('rsem')],
        ['semSignal(z);', 'next reader may go on', S_('z')],
        ['READUNIT();', 'read (others may too)', WORK],
        ['semWait(x);', 'lock readcount', W_('x')],
        ['readcount--;', 'one fewer reader inside', DEC('readcount')],
        ['if (readcount == 0) semSignal(wsem);', 'last out lets writers in', { k: 'signalIf', v: 'readcount', eq: 0, s: 'wsem' }],
        ['semSignal(x);', 'unlock readcount', S_('x')],
      ],
      W: [
        ['semWait(y);', 'lock writecount', W_('y')],
        ['writecount++;', 'one more writer wants in', INC('writecount')],
        ['if (writecount == 1) semWait(rsem);', 'first one shuts the gate', { k: 'waitIf', v: 'writecount', eq: 1, s: 'rsem' }],
        ['semSignal(y);', 'unlock writecount', S_('y')],
        ['semWait(wsem);', 'then wait for the data', W_('wsem')],
        ['WRITEUNIT();', 'write, completely alone', WORK],
        ['semSignal(wsem);', 'hand the data back', S_('wsem')],
        ['semWait(y);', 'lock writecount', W_('y')],
        ['writecount--;', 'one fewer writer', DEC('writecount')],
        ['if (writecount == 0) semSignal(rsem);', 'last one reopens the gate', { k: 'signalIf', v: 'writecount', eq: 0, s: 'rsem' }],
        ['semSignal(y);', 'unlock writecount', S_('y')],
      ],
    },
  };
  const SEMS = { rp: ['x', 'wsem'], wp: ['z', 'rsem', 'x', 'y', 'wsem'] };
  // aligned comments for the wide listings; compact (no alignment padding) for
  // the printed notes and for phones, where the comment wraps onto its own line
  function listing(rows, compact) {
    const pad = compact ? 0 : Math.max(...rows.map((r) => r[0].length)) + 1;
    return rows.map((r) => (compact ? r[0] + '  ' : r[0].padEnd(pad)) + '// ' + r[1]).join('\n');
  }
  function codeBox(ctx, rows) {
    const pre = ctx.ui.code(listing(rows, ctx.narrow), { nums: false, fontSize: 13, cls: ctx.narrow ? 'r57-wrap' : '' });
    pre.style.flex = 'none';
    return pre;
  }
  // lines (1-based) of a listing that mention a word, e.g. linesWith(CODE.wp.R, 'rsem')
  function linesWith(rows, word) {
    const re = new RegExp('\\b' + word + '\\b');
    return rows.map((r, i) => (re.test(r[0]) ? i + 1 : 0)).filter(Boolean);
  }

  /* ---------------------------------------------------------------
     2. A tiny, faithful semaphore machine.
        semWait: value - 1; if the value is now negative the caller
        blocks at the back of that semaphore's FIFO queue.
        semSignal: value + 1; if the value is still <= 0 the process
        at the front of the queue is released (it moves past its wait).
        Every visitor runs its code once: arrive, read or write, leave.
     --------------------------------------------------------------- */
  function engine(pol) {
    const prog = {};
    ['R', 'W'].forEach((k) => (prog[k] = CODE[pol][k].map((r, i) => Object.assign({ ln: i + 1 }, r[2]))));
    const workIdx = { R: prog.R.findIndex((o) => o.k === 'work'), W: prog.W.findIndex((o) => o.k === 'work') };
    const E = { pol, names: SEMS[pol], sem: {}, vars: { readcount: 0, writecount: 0 }, procs: [], t: 0, n: { R: 0, W: 0 },
      ran: [], woke: [], done: { R: 0, W: 0 }, maxWait: { R: 0, W: 0 }, workIdx };
    E.names.forEach((nm) => (E.sem[nm] = { v: 1, q: [] }));
    const get = (id) => (typeof id === 'string' ? E.procs.find((p) => p.id === id) : id);
    E.get = get;
    // p.held lists the semaphores p itself acquired and has not yet signalled
    // (used only to label who holds what; the semaphore logic ignores it)
    E.arrive = (kind, dur) => {
      const p = { id: kind + ++E.n[kind], kind, pc: 0, st: 'run', on: null, left: 0, dur: dur || 4, t0: E.t, tIn: null, held: [] };
      E.procs.push(p);
      return p;
    };
    function wait(p, nm) {
      const sm = E.sem[nm];
      sm.v--;
      if (sm.v < 0) { p.st = 'blk'; p.on = nm; sm.q.push(p.id); } else { p.pc++; p.held.push(nm); }
    }
    function signal(nm, by) {
      const sm = E.sem[nm];
      sm.v++;
      if (by && by.held.includes(nm)) by.held.splice(by.held.indexOf(nm), 1);
      if (sm.v <= 0 && sm.q.length) {
        const w = get(sm.q.shift());
        w.st = 'run'; w.on = null; w.pc++; w.held.push(nm);
        E.woke.push(w.id);
      }
    }
    function finish(p) { p.st = 'done'; E.done[p.kind]++; }
    // execute exactly one line of p's code
    E.exec = (id) => {
      const p = get(id);
      if (!p || p.st !== 'run') return;
      const op = prog[p.kind][p.pc];
      if (!op) { finish(p); return; }
      E.ran.push({ kind: p.kind, ln: op.ln, id: p.id });
      if (op.k === 'wait') wait(p, op.s);
      else if (op.k === 'signal') { signal(op.s, p); p.pc++; }
      else if (op.k === 'inc') { E.vars[op.v]++; p.pc++; }
      else if (op.k === 'dec') { E.vars[op.v]--; p.pc++; }
      else if (op.k === 'waitIf') { if (E.vars[op.v] === op.eq) wait(p, op.s); else p.pc++; }
      else if (op.k === 'signalIf') { if (E.vars[op.v] === op.eq) signal(op.s, p); p.pc++; }
      else if (op.k === 'work') {
        p.st = 'work'; p.left = p.dur; p.tIn = E.t;
        E.maxWait[p.kind] = Math.max(E.maxWait[p.kind], E.t - p.t0);
      }
      if (p.st === 'run' && p.pc >= prog[p.kind].length) finish(p);
    };
    // run p until it blocks, starts reading/writing, or leaves (or at most n lines)
    E.run = (id, n) => {
      const p = get(id);
      for (let k = 0; p && p.st === 'run' && (n == null || k < n); k++) E.exec(p);
    };
    E.endWork = (id) => { const p = get(id); if (p && p.st === 'work') { p.st = 'run'; p.pc++; p.left = 0; } };
    // let every runnable process run (oldest first) until nobody can move
    E.settle = () => {
      for (let g = 0; g < 500; g++) { const p = E.procs.find((q) => q.st === 'run'); if (!p) break; E.run(p); }
    };
    E.mark = () => { E.ran = []; E.woke = []; };
    // one clock tick of the continuous simulation
    E.tick = (arrivals) => {
      E.t++;
      E.procs.forEach((p) => { if (p.st === 'work' && --p.left <= 0) E.endWork(p); });
      (arrivals || []).forEach(([k, d]) => E.arrive(k, d));
      E.settle();
      E.procs = E.procs.filter((p) => p.st !== 'done');
    };
    E.waiting = (kind) => E.procs.filter((p) => p.kind === kind && p.tIn == null && p.st !== 'done');
    E.inside = () => E.procs.filter((p) => p.st === 'work');
    // who holds a semaphore right now (for labels only). wsem can belong to the
    // readers as a GROUP (first in took it, last out returns it) and rsem to the
    // writers as a group (first interested writer closed it, last one reopens it).
    E.holder = (nm) => {
      if (E.sem[nm].v > 0) return '';
      const hs = E.procs.filter((p) => p.st !== 'done' && p.held.includes(nm));
      const w = hs.find((p) => p.kind === 'W'), r = hs.find((p) => p.kind === 'R');
      if (nm === 'wsem') {
        if (w) return 'held by ' + w.id;
        if (E.vars.readcount > 0) return 'held by the readers';
      }
      if (nm === 'rsem') {
        if (r) return 'held by ' + r.id;
        if (E.vars.writecount > 0) return 'closed by the writers';
      }
      return hs.length ? 'held by ' + hs.map((p) => p.id).join(', ') : 'in use';
    };
    return E;
  }

  /* ---------------------------------------------------------------
     3. Drawing: the shared data "room", then one row per semaphore
        showing its value, who holds it, and its FIFO waiting queue.
     --------------------------------------------------------------- */
  const fmtV = (v) => (v < 0 ? '−' + -v : String(v));
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  function tok(s, p, x, y, o = {}) {
    const w = o.small ? 42 : 50, hh = o.small ? 24 : 30;
    return s('g', { class: 'tok ' + (p.kind === 'R' ? 'tk-r' : 'tk-w') + (o.cls ? ' ' + o.cls : '') },
      s('rect', { x: x - w / 2, y: y - hh / 2, width: w, height: hh, rx: hh / 2 }),
      s('text', { x, y: y + 4.5, 'text-anchor': 'middle' }, p.id));
  }
  function drawRW(s, svg, E, o = {}) {
    const W = o.W || 560, RH = o.roomH || 88, rowH = o.rowH || 31, top = 24;
    const compact = W < 450;   // phones: no STATE column, so the queue gets the room
    const headY = top + RH + 22, rowsTop = headY + 7;
    const H = rowsTop + E.names.length * rowH - 3;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const inside = E.inside(), wr = inside.find((p) => p.kind === 'W');
    const K = [];
    K.push(s('text', { x: 2, y: 16, 'font-weight': 800, 'font-size': 15 }, o.title || 'Shared data'));
    K.push(s('text', { x: W - 2, y: 16, 'text-anchor': 'end', class: 's-monot', 'font-size': 14, 'font-weight': 700 },
      'readcount = ' + E.vars.readcount + (E.pol === 'wp' ? (compact ? '  writecount = ' : '   writecount = ') + E.vars.writecount : '')));
    K.push(s('rect', { x: 1, y: top, width: W - 2, height: RH, rx: 14, class: wr ? 's-accent' : inside.length ? 's-proc' : 's-panel', 'stroke-width': 2 }));
    K.push(s('text', { x: 14, y: top + 21, class: 's-sub', 'font-size': 13.5, 'font-weight': 700 },
      wr ? wr.id + ' is writing, alone' : inside.length ? plural(inside.length, 'reader is', 'readers are') + ' reading' : 'Nobody is using the data'));
    const gap = 58, maxN = Math.max(1, Math.floor((W - 40) / gap));
    const shown = inside.slice(0, maxN), cx0 = W / 2 - ((shown.length - 1) * gap) / 2, cy = top + RH / 2 + 11;
    shown.forEach((p, i) => K.push(tok(s, p, cx0 + i * gap, cy, { cls: E.woke.includes(p.id) ? 'new' : '' })));
    if (inside.length > maxN) K.push(s('text', { x: W - 14, y: top + 21, 'text-anchor': 'end', class: 's-sub', 'font-size': 13.5, 'font-weight': 700 }, '+' + (inside.length - maxN) + ' more'));
    const cVal = 98, cState = 126, cQ = compact ? 132 : o.qx || 280;
    const maxQ = Math.max(1, Math.floor((W - cQ - 40) / 47));
    [['NAME', 2, 'start'], ['VALUE', cVal, 'middle'], compact ? null : ['STATE', cState, 'start'], ['WAITING QUEUE (front first)', cQ, 'start']].filter(Boolean).forEach(([t, x, a]) =>
      K.push(s('text', { x, y: headY, 'text-anchor': a, class: 's-sub', 'font-size': 12.5, 'font-weight': 700, 'letter-spacing': '.04em' }, t)));
    E.names.forEach((nm, i) => {
      const sm = E.sem[nm], y = rowsTop + i * rowH, cyR = y + (rowH - 5) / 2;
      if (i) K.push(s('line', { x1: 1, x2: W - 1, y1: y - 3, y2: y - 3, class: 's-muted', 'stroke-width': 1 }));
      K.push(s('rect', { x: 1, y, width: 66, height: rowH - 5, rx: 7, class: 's-os', 'stroke-width': 1.5 }));
      K.push(s('text', { x: 34, y: cyR + 5, 'text-anchor': 'middle', class: 's-monot', 'font-weight': 700, 'font-size': 14 }, nm));
      K.push(s('text', { x: cVal, y: cyR + 6, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 17, style: `fill:var(--${sm.v > 0 ? 'ok' : sm.v === 0 ? 'warn' : 'bad'})` }, fmtV(sm.v)));
      if (!compact) K.push(s('text', { x: cState, y: cyR + 5, 'font-size': 13.5, class: sm.v > 0 ? 's-sub' : '' }, sm.v > 0 ? 'open' : E.holder(nm)));
      sm.q.slice(0, maxQ).forEach((id, k) => K.push(tok(s, E.get(id), cQ + 21 + k * 47, cyR, { small: true, cls: 'wait' })));
      if (sm.q.length > maxQ) K.push(s('text', { x: cQ + maxQ * 47 + 4, y: cyR + 5, 'font-size': 13.5, 'font-weight': 700, class: 's-sub' }, '+' + (sm.q.length - maxQ)));
      // phones have no STATE column, so an empty queue row also says who holds the semaphore
      if (!sm.q.length) K.push(s('text', { x: cQ, y: cyR + 5, 'font-size': 13.5, class: 's-sub' }, compact && sm.v <= 0 ? 'empty · ' + E.holder(nm) : 'empty'));
    });
    svg.replaceChildren(...K);
    return H;
  }
  // colour a code listing: green = someone is reading/writing on that line,
  // red = someone is blocked there, highlight = the lines that just ran
  function markCode(pre, E, kind) {
    pre.clear();
    pre.mark(E.ran.filter((r) => r.kind === kind).map((r) => r.ln), 'cur');
    pre.mark(E.procs.filter((p) => p.kind === kind && p.st === 'work').map((p) => p.pc + 1), 'ok');
    pre.mark(E.procs.filter((p) => p.kind === kind && p.st === 'blk').map((p) => p.pc + 1), 'bad');
  }
  const LEGEND = '<span class="chip proc">R = reader</span> <span class="chip accent">W = writer</span>';

  /* ---------------------------------------------------------------
     4. The message-passing controller.
        count starts at 100 (more than the most readers there can be).
        count > 0  : no writer accepted yet; count = 100 − readers inside
                     (a write request may still sit unread in its mailbox)
        count == 0 : the accepted writer is the only one left (or writing)
        count < 0  : a writer is waiting for −count readers to leave
        One controller action happens per clock tick.
     --------------------------------------------------------------- */
  const CTRL = [
    ['while (true) {', 'serve requests for ever'],
    ['  if (count > 0) {', 'no writer accepted yet'],
    ['    if (!empty(finished)) {', '1st: has a reader left?'],
    ['      receive(finished, msg); count++;', 'one reader fewer inside'],
    ['    } else if (!empty(writerequest)) {', '2nd: is a writer asking?'],
    ['      receive(writerequest, msg);', 'take the write request'],
    ['      writer_id = msg.id; count -= 100;', 'count = −(readers inside)'],
    ['    } else if (!empty(readrequest)) {', '3rd: is a reader asking?'],
    ['      receive(readrequest, msg); count--;', 'one reader more inside'],
    ['      send(msg.id, "OK");', 'let that reader start'],
    ['    }', 'end of the three choices'],
    ['  }', 'end of the count > 0 case'],
    ['  if (count == 0) {', 'only the writer is left'],
    ['    send(writer_id, "OK");', 'let the writer start'],
    ['    receive(finished, msg);', 'block until it is done'],
    ['    count = 100;', 'the data is free again'],
    ['  }', 'end of the count == 0 case'],
    ['  while (count < 0) {', 'readers are still inside'],
    ['    receive(finished, msg); count++;', 'wait for each one to leave'],
    ['  }', 'end of the waiting loop'],
    ['}', 'end of the controller loop'],
  ];
  const CLIENT = [
    ['void reader(int i) {', 'reader number i'],
    ['  send(readrequest, i);', 'ask permission to read'],
    ['  receive(mbox[i], msg);', 'block until "OK" arrives'],
    ['  READUNIT();', 'read (others may too)'],
    ['  send(finished, i);', 'tell the controller: done'],
    ['}', 'real readers repeat this'],
    ['void writer(int j) {', 'writer number j'],
    ['  send(writerequest, j);', 'ask permission to write'],
    ['  receive(mbox[j], msg);', 'block until "OK" arrives'],
    ['  WRITEUNIT();', 'write, completely alone'],
    ['  send(finished, j);', 'tell the controller: done'],
    ['}', 'real writers repeat this'],
  ];
  function mpEngine() {
    const M = { count: 100, mb: { readrequest: [], writerequest: [], finished: [] }, cl: [], writer: null, waitW: false, t: 0, n: { R: 0, W: 0 }, lines: [], bad: [] };
    const get = (id) => M.cl.find((c) => c.id === id);
    const go = (id) => { const c = get(id); c.st = 'work'; c.left = c.dur; };
    M.request = (kind, dur) => {
      const c = { id: kind + ++M.n[kind], kind, st: 'asked', left: 0, dur: dur || 3 };
      M.cl.push(c);
      M.mb[kind === 'R' ? 'readrequest' : 'writerequest'].push(c.id);
      return c;
    };
    M.reading = (dur) => { const c = { id: 'R' + ++M.n.R, kind: 'R', st: 'work', left: dur, dur }; M.cl.push(c); M.count--; return c; };
    M.inside = () => M.cl.filter((c) => c.st === 'work');
    // one controller action; returns the narration
    M.act = () => {
      const mb = M.mb;
      M.lines = []; M.bad = [];
      if (M.waitW) {
        if (mb.finished.length) {
          const id = mb.finished.shift();
          M.waitW = false; M.count = 100; M.writer = null; M.lines = [15, 16];
          return `${id}’s <b>finished</b> message arrives, so the controller resets count to <b>100</b>: nobody is inside any more.`;
        }
        M.bad = [15];
        return `The controller is blocked in receive(finished) until ${M.writer} finishes writing. Any new request simply waits in its mailbox.`;
      }
      if (M.count > 0) {
        if (mb.finished.length) {
          const id = mb.finished.shift(); M.count++; M.lines = [2, 3, 4];
          return `count > 0 and <b>finished</b> holds ${id}’s message, which is always served first: count++ → <b>${fmtV(M.count)}</b>.`;
        }
        if (mb.writerequest.length) {
          const id = mb.writerequest.shift(); M.writer = id; M.count -= 100; M.lines = [2, 3, 5, 6, 7];
          return `No reader has left, but <b>writerequest</b> holds ${id}’s request, which beats any read request. count −= 100 → <b>${fmtV(M.count)}</b>` +
            (M.count < 0 ? `: ${plural(-M.count, 'reader is', 'readers are')} still inside, and ${id} must wait for them.` : ': nobody is inside, so the writer can go next.');
        }
        if (mb.readrequest.length) {
          const id = mb.readrequest.shift(); M.count--; go(id); M.lines = [2, 3, 5, 8, 9, 10];
          return `No reader has left and no writer is asking, so the controller takes ${id}’s read request: count-- → <b>${fmtV(M.count)}</b>, and it sends ${id} an <b>OK</b>.`;
        }
        M.lines = [2, 3, 5, 8];
        return 'count > 0 but all three mailboxes are empty, so the controller has nothing to do this tick. Add a request.';
      }
      if (M.count === 0) {
        go(M.writer); M.waitW = true; M.lines = [13, 14]; M.bad = [15];
        return `count == 0: every reader has left. The controller sends <b>OK</b> to ${M.writer}, which writes alone, and then blocks until it hears back.`;
      }
      if (mb.finished.length) {
        const id = mb.finished.shift(); M.count++; M.lines = [18, 19];
        return `count &lt; 0, so the controller listens only to <b>finished</b>. ${id} has left: count++ → <b>${fmtV(M.count)}</b>` +
          (M.count === 0 ? '. That was the last reader.' : `; ${plural(-M.count, 'reader is', 'readers are')} still inside.`);
      }
      M.bad = [19];
      return `count = ${fmtV(M.count)}: blocked in receive(finished) until one of the ${-M.count} reader${M.count === -1 ? '' : 's'} inside leaves. New requests wait in their mailboxes.`;
    };
    // one tick: clients that finish send "finished", then the controller acts once
    M.tick = () => {
      M.t++;
      M.cl.forEach((c) => { if (c.st === 'work' && --c.left <= 0) { c.st = 'gone'; M.mb.finished.push(c.id); } });
      M.cl = M.cl.filter((c) => c.st !== 'gone');
      return M.act();
    };
    return M;
  }


  Guide.section({
    id: '5.7',
    title: 'Readers/Writers Problem',
    short: 'Readers/writers',
    summary: 'Let many readers share data while each writer gets it alone: semaphore and message-passing solutions.',
    objectives: [
      'State the three readers/writers rules and explain why this is neither plain mutual exclusion nor producer/consumer.',
      'Trace the readers-priority semaphore solution line by line and explain why a writer can starve.',
      'Explain how rsem, y and z give writers priority, and describe the semaphore queues in the four classic situations.',
      'Trace the message-passing controller and read the meaning of its count variable (above zero, zero, below zero).',
    ],
    terms: [
      ['Readers/writers problem', 'A classic synchronization problem: several processes share one data area. Readers only look at it, so any number may read together. Writers modify it (a writer may also read it while updating), so a writer must have the data entirely to itself.'],
      ['Reader', 'A process that only reads the shared data and never changes it. Because reading changes nothing, readers may share access with each other.'],
      ['Writer', 'A process that modifies the shared data. It may read the data as part of its update, but because it changes it, it needs exclusive access: no reader and no other writer at the same time.'],
      ['Shared data area', 'Whatever the readers and writers use in common: a file, a block of main memory, or even a bank of processor registers.'],
      ['Semaphore','A shared integer that processes may change only through atomic operations: semWait subtracts 1 and blocks the caller if the result is negative; semSignal adds 1 and wakes one blocked process if any are waiting.'],
      ['readcount', 'A shared counter of how many readers are currently reading. The reader that raises it from 0 to 1 locks writers out; the reader that brings it back to 0 lets them in.'],
      ['writecount', 'In the writers-priority solution, a shared counter of how many writers are waiting to write or writing.'],
      ['wsem', 'The semaphore that guards the data itself. Whenever the data is in use, wsem is held either by one writer or by the whole group of current readers.'],
      ['rsem', 'In the writers-priority solution, the “reader gate”: the first writer that shows up closes it so no new reader can start, and the last writer to finish opens it again.'],
      ['Readers priority', 'A policy in which a newly arriving reader joins the readers already reading, even if a writer is waiting. It maximizes sharing but can starve writers.'],
      ['Writers priority', 'A policy in which, once a writer has announced that it wants to write, no new reader may start reading until every waiting writer has written.'],
      ['Starvation', 'A situation in which a process waits indefinitely, not because of a deadlock, but because other processes keep being served ahead of it.'],
      ['Mutual exclusion', 'The guarantee that while one process is using a shared resource in its critical section, no other process can be using that same resource.'],
      ['Producer/consumer problem', 'A classic problem in which producers put items into a shared buffer and consumers take them out. Both sides change the buffer and its bookkeeping (a producer adds an item after checking for a free slot, a consumer removes one), so neither side is a read-only reader.'],
      ['Message passing', 'Cooperation by sending and receiving messages (send and receive operations) instead of sharing variables. A receive can block until a message arrives, so messages also synchronize.'],
      ['Mailbox', 'A named queue that holds messages until a process receives them. Many processes may send to the same mailbox.'],
      ['Controller process', 'In the message-passing solution, the single process that decides who may use the shared data. Readers and writers ask it for permission and wait for its “OK” reply.'],
    ],

    css: `
      .sec-5-7 .tok rect { fill: var(--panel); stroke-width: 2.2; }
      .sec-5-7 .tok text { font-weight: 800; font-size: 13.5px; }
      .sec-5-7 .tk-r rect { stroke: var(--proc); }
      .sec-5-7 .tk-r text { fill: var(--proc); }
      .sec-5-7 .tk-w rect { stroke: var(--accent); }
      .sec-5-7 .tk-w text { fill: var(--accent); }
      .sec-5-7 .tok.wait rect { stroke-dasharray: 4 3; }
      .sec-5-7 .tok.new rect { stroke-width: 3.5; fill: var(--hl); }
      .sec-5-7 .tok.bad rect { stroke: var(--bad); fill: var(--bad-bg); }
      .sec-5-7 .tok.bad text { fill: var(--bad); }
      .sec-5-7 .cap-box { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; font-size: 15px; line-height: 1.45; }
      .sec-5-7 .cap-box b { color: var(--chc); }
      .sec-5-7 .verdict { border-radius: 10px; padding: 9px 12px; font-size: 15.5px; line-height: 1.4; border: 2px solid var(--line); }
      .sec-5-7 .verdict.ok { border-color: var(--ok); background: var(--ok-bg); }
      .sec-5-7 .verdict.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-5-7 .verdict .vh { font-weight: 800; display: block; }
      .sec-5-7 .verdict.ok .vh { color: var(--ok); }
      .sec-5-7 .verdict.bad .vh { color: var(--bad); }
      .sec-5-7 .rule { display: grid; grid-template-columns: 30px 1fr; gap: 10px; align-items: start; padding: 7px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel-2); transition: background .2s, border-color .2s; }
      .sec-5-7 .rule .n { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-weight: 800; background: var(--panel-3); color: var(--ink-2); }
      .sec-5-7 .rule.hit { border-color: var(--bad); background: var(--bad-bg); }
      .sec-5-7 .rule.hit .n { background: var(--bad); color: var(--panel); }
      .sec-5-7 .rule.okk { border-color: var(--ok); background: var(--ok-bg); }
      .sec-5-7 .rule.okk .n { background: var(--ok); color: var(--panel); }
      .sec-5-7 .sw { padding: 0 5px; border-radius: 3px; border-left: 3px solid; font-weight: 700; }
      .sec-5-7 .sw-cur { background: color-mix(in srgb, var(--chc) 16%, transparent); border-color: var(--chc); }
      .sec-5-7 .sw-ok { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
      .sec-5-7 .sw-bad { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
      .sec-5-7 .r57-now { display: none; color: var(--ok); margin-top: 2px; }
      .sec-5-7 tr.r57-hit .r57-now { display: block; }
      .sec-5-7 table.tbl tr.r57-hit td { background: var(--ok-bg); }
      .sec-5-7 pre.code.r57-wrap .ln { white-space: pre-wrap; padding-bottom: 3px; }
      .sec-5-7 pre.code.r57-wrap .tk-com { display: block; padding-left: 1.6em; line-height: 1.3; }
      .sec-5-7 .mini-h { font-size: 12.5px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); margin: 0 0 4px; }
    `,

    steps: [
      /* ---------------- 1. Big picture + rule tester ---------------- */
      {
        title: 'Many readers, one writer: the three rules',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack">
              <p class="lead m0">Some data is read far more often than it is changed: a flight departure board, a price list, a settings file.</p>
              <p class="m0">The <span class="t">readers/writers problem</span> is about one <span class="t">shared data area</span> (a file, a block of main memory, even a bank of processor registers) used by two kinds of processes. <span class="t">Readers</span> only look at the data, so they may share it. <span class="t">Writers</span> modify it (and may read it as they do), so each needs it alone.</p>
              <div class="callout analogy m0" data-label="Analogy">A library keeps one reference ledger on a stand. Any number of visitors can read it side by side. When the librarian corrects an entry, she needs the ledger to herself: nobody should copy a half-corrected line, and two librarians must not edit at once.</div>
              <div class="callout why m0" data-label="What you will be able to do">Run two semaphore solutions line by line, watch a writer starve under one of them, see how the other fixes it, and follow a controller process that hands out permission by message.</div>
            </div>
            <div class="card white stack r57-tester" style="gap:10px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const host = ctx.$('.r57-tester');
          let nR = 2, nW = 0;
          const svg = s('svg', { viewBox: '0 0 640 112', width: '100%' });
          const verdict = h('div', { class: 'verdict' });
          const RULES = [
            'Any number of readers may read the data at the same time.',
            'Only one writer at a time may write.',
            'While a writer is writing, no reader may read.',
          ];
          const ruleEls = RULES.map((t, i) => h('div', { class: 'rule' }, h('span', { class: 'n' }, String(i + 1)), h('span', { class: 'small', style: { lineHeight: '1.35' } }, t)));
          const btn = (label, cls, fn) => h('button', { class: 'btn sm ' + cls, type: 'button', onclick: () => { fn(); paint(); } }, label);
          function paint() {
            const bad2 = nW >= 2, bad3 = nW >= 1 && nR >= 1;
            const people = [];
            for (let i = 1; i <= nR; i++) people.push({ id: 'R' + i, kind: 'R' });
            for (let i = 1; i <= nW; i++) people.push({ id: 'W' + i, kind: 'W' });
            const cls = !people.length ? 's-panel' : bad2 || bad3 ? 's-bad' : 's-ok';
            const gap = 64, x0 = 320 - ((people.length - 1) * gap) / 2;
            svg.replaceChildren(
              s('rect', { x: 2, y: 22, width: 636, height: 86, rx: 16, class: cls, 'stroke-width': 2 }),
              s('text', { x: 4, y: 15, 'font-weight': 800, 'font-size': 15 }, 'Who is using the shared data right now?'),
              people.length ? null : s('text', { x: 320, y: 70, 'text-anchor': 'middle', class: 's-sub', 'font-size': 15 }, 'nobody'),
              ...people.map((p, i) => tok(s, p, x0 + i * gap, 66, { cls: (p.kind === 'W' && (bad2 || bad3)) ? 'bad' : '' })));
            ruleEls.forEach((r) => r.classList.remove('hit', 'okk'));
            const msgs = [];
            if (bad2) { ruleEls[1].classList.add('hit'); msgs.push('<b>Rule 2.</b> Two writers could interleave their updates, each overwriting half of the other’s change.'); }
            if (bad3) { ruleEls[2].classList.add('hit'); msgs.push('<b>Rule 3.</b> A reader could catch the data mid-update. If the board said “09:40, gate B7” and the writer has changed the time to 10:15 but not yet the gate, the reader sees “10:15, gate B7”, which was never true.'); }
            if (msgs.length) {
              verdict.className = 'verdict bad';
              verdict.innerHTML = `<span class="vh">✗ Not allowed: breaks ${msgs.length > 1 ? 'two rules' : 'a rule'}</span>` + msgs.join(' ');
            } else if (!people.length) {
              verdict.className = 'verdict';
              verdict.innerHTML = '<span class="vh">Empty</span>Nobody is inside, so nothing can go wrong. Add readers and writers to test the rules.';
            } else if (nW === 1) {
              ruleEls[1].classList.add('okk'); ruleEls[2].classList.add('okk');
              verdict.className = 'verdict ok';
              verdict.innerHTML = '<span class="vh">✓ Allowed</span>One writer with the data entirely to itself can update it safely.';
            } else {
              ruleEls[0].classList.add('okk');
              verdict.className = 'verdict ok';
              verdict.innerHTML = `<span class="vh">✓ Allowed</span>${plural(nR, 'reader', 'readers')} ${nR === 1 ? 'is' : 'share'} the data. Reading changes nothing, so readers cannot disturb each other.`;
            }
            bRp.disabled = nR >= 5; bRm.disabled = nR <= 0; bWp.disabled = nW >= 2; bWm.disabled = nW <= 0;
          }
          const bRp = btn('+ Reader', 'proc', () => nR++), bRm = btn('− Reader', '', () => nR--);
          const bWp = btn('+ Writer', '', () => nW++), bWm = btn('− Writer', '', () => nW--);
          bWp.style.borderColor = 'var(--accent)'; bWp.style.color = 'var(--accent)';
          host.append(
            h('h3', { class: 'm0' }, 'Try the rules'),
            h('div', { class: 'row gap-s' }, bRp, bRm, bWp, bWm, btn('Empty the room', 'ghost', () => { nR = 0; nW = 0; })),
            svg, verdict, h('div', { class: 'stack', style: { gap: '6px' } }, ...ruleEls),
            h('p', { class: 'small muted m0', style: { marginTop: 'auto' } }, 'Try this: add a writer while two readers are inside, then take the readers out and add a second writer.'));
          paint();
        },
      },

      /* ---------------- 2. Not plain mutual exclusion, not producer/consumer ---------------- */
      {
        title: 'Not just a lock, and not producer/consumer',
        kind: 'compare',
        render(el, ctx) {
          const { h, s } = ctx;
          let n = 4;
          const READ = 2;
          // wide: row labels on the left; phones: labels above each row so the bars stay large
          const G = ctx.narrow
            ? { VW: 420, VH: 178, X0: 10, U: 25, top: true, r1: 24, r2: 98, bh: 40, ax: 154 }
            : { VW: 1100, VH: 172, X0: 214, U: 48, top: false, r1: 12, r2: 82, bh: 48, ax: 146 };
          const { X0, U } = G;
          const svg = s('svg', { viewBox: `0 0 ${G.VW} ${G.VH}`, width: '100%' });
          const res = h('p', { class: 'm0' });
          function draw() {
            const K = [];
            const label = (y, a, b) => G.top
              ? K.push(s('text', { x: 0, y, 'font-weight': 800, 'font-size': 15 }, a))
              : K.push(s('text', { x: 0, y, 'font-weight': 800, 'font-size': 16 }, a), s('text', { x: 0, y: y + 19, class: 's-sub', 'font-size': 14 }, b));
            label(G.top ? G.r1 - 8 : 36, 'One lock for everyone', 'readers must take turns');
            label(G.top ? G.r2 - 8 : 106, 'Readers/writers rules', 'readers may overlap');
            for (let i = 0; i < n; i++) {
              const x = X0 + i * READ * U;
              K.push(s('rect', { x: x + 1, y: G.r1, width: READ * U - 3, height: G.bh, rx: 8, class: 's-proc', 'stroke-width': 2 }),
                s('text', { x: x + U, y: G.r1 + G.bh / 2 + 5, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': G.top ? 13.5 : 17, style: 'fill:var(--proc)' }, 'R' + (i + 1)));
            }
            const bh = G.bh / n;
            for (let i = 0; i < n; i++) K.push(s('rect', { x: X0 + 1, y: G.r2 + i * bh + 0.5, width: READ * U - 3, height: Math.max(2, bh - 1.5), rx: Math.min(6, bh / 2), class: 's-proc', 'stroke-width': 1.5 }));
            K.push(s('text', { x: X0 + READ * U + 10, y: G.r2 + G.bh / 2 + 5, 'font-weight': 700, 'font-size': G.top ? 14 : 17, style: 'fill:var(--proc)' }, n === 1 ? 'R1 reads' : `R1 to R${n} all read at the same time`));
            [[X0 + n * READ * U, G.r1 - 2, G.r1 + G.bh + 2], [X0 + READ * U, G.r2 - 2, G.r2 + G.bh + 2]].forEach(([x, y1, y2]) =>
              K.push(s('line', { x1: x, x2: x, y1, y2, class: 's-line', 'stroke-dasharray': '4 3' })));
            const dy = (r) => (G.top ? r - 8 : r + G.bh / 2 + 6);
            K.push(s('text', { x: G.VW - 2, y: dy(G.r1), 'text-anchor': 'end', 'font-weight': 800, 'font-size': G.top ? 15 : 17 }, `done: ${n * READ} ms`));
            K.push(s('text', { x: G.VW - 2, y: dy(G.r2), 'text-anchor': 'end', 'font-weight': 800, 'font-size': G.top ? 15 : 17, style: 'fill:var(--ok)' }, `done: ${READ} ms`));
            K.push(s('line', { x1: X0, x2: X0 + 16 * U, y1: G.ax, y2: G.ax, class: 's-line' }));
            for (let t = 0; t <= 16; t += G.top ? 4 : 2) K.push(s('line', { x1: X0 + t * U, x2: X0 + t * U, y1: G.ax - 4, y2: G.ax + 4, class: 's-line' }), s('text', { x: X0 + t * U, y: G.ax + 21, 'text-anchor': t === 16 && G.top ? 'end' : 'middle', class: 's-sub', 'font-size': 13.5 }, t + (t === 16 ? ' ms' : '')));
            svg.replaceChildren(...K);
            res.innerHTML = n === 1
              ? 'With a single reader both approaches take 2 ms. The difference appears as soon as two or more readers want the data at once: drag the slider.'
              : `With <b>${n} readers</b>, one lock makes them queue: ${n} × 2 = <b>${n * READ} ms</b>. The readers/writers rules let them overlap, so with a processor free for each they all finish in <b>2 ms</b>, ${n}× sooner. That is perfectly safe because none of them changes the data.`;
          }
          const sl = ctx.ui.slider({ label: ctx.narrow ? 'Readers at once' : 'Readers who want the data at the same moment (each read takes 2 ms of work)', min: 1, max: 8, value: n, onInput: (v) => { n = v; draw(); } });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            sl, h('div', { class: 'card white', style: { padding: '10px 14px' } }, svg), res,
            h('div', { class: 'grid-2' },
              h('div', { class: 'card tight', html: '<h3 style="font-size:17px">Why not plain <span class="t">mutual exclusion</span>?</h3><p class="small m0">If we could not tell which processes only read, one lock around every access (a single <span class="t">critical section</span>) would be the only safe choice. But we know readers never change anything, so they cannot hurt one another. Making them take turns would throw away safe parallelism.</p>' }),
              h('div', { class: 'card tight', html: '<h3 style="font-size:17px">Why not <span class="t" data-t="Producer/consumer problem">producer/consumer</span>?</h3><p class="small m0">It can look like one writer (the producer) and one reader (the consumer). But the consumer is not read-only: it <b>removes</b> an item and updates the buffer’s pointers. Both sides change the buffer, and each waits for the other (an item to take, a free slot to fill). Here a reader leaves the data exactly as it found it.</p>' })),
            h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: '“Readers need no protection at all.” They need none from <i>each other</i>, but they must still be kept away from writers (rule 3).' })));
          draw();
        },
      },

      /* ---------------- 3. Readers-priority solution, traced line by line ---------------- */
      {
        title: 'Solution 1: readers have priority',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const preR = codeBox(ctx, CODE.rp.R);
          const preW = codeBox(ctx, CODE.rp.W);
          const svg = s('svg', { width: '100%' });
          const F = [
            { cap: '<b>Start.</b> Nobody is using the data: readcount = 0 and both semaphores are 1 (open). Press Play, or step with the arrows.', go: () => {} },
            { cap: '<b>R1 wants to read.</b> Its semWait(x) takes the lock on the counter: x drops from 1 to 0.', go: (E) => { E.arrive('R'); E.exec('R1'); } },
            { cap: 'R1 adds itself: readcount = 1. Because it is the <b>first</b> reader it also calls semWait(wsem). wsem drops to 0, so writers are now locked out.', go: (E) => E.run('R1', 2) },
            { cap: 'R1 gives back the counter lock (x is 1 again) and starts reading.', go: (E) => E.run('R1') },
            { cap: '<b>R2 arrives.</b> readcount becomes 2. R2 is not the first reader, so it skips wsem and walks straight in. Two readers now share the data.', go: (E) => { E.arrive('R'); E.run('R2'); } },
            { cap: '<b>W1 wants to write.</b> semWait(wsem) makes wsem −1. A negative value means somebody is waiting: W1 is blocked in wsem’s queue (red line).', go: (E) => { E.arrive('W'); E.run('W1'); } },
            { cap: '<b>R3 arrives while W1 waits.</b> Only the first reader in ever waits on wsem, so R3 walks straight in (readcount = 3). That is <span class="t">readers priority</span>, and if readers keep overlapping like this W1 can <span class="t" data-t="Starvation">starve</span>.', go: (E) => { E.arrive('R'); E.run('R3'); } },
            { cap: 'R1 finishes and leaves: readcount = 2. It is not the last reader, so wsem stays closed.', go: (E) => { E.endWork('R1'); E.run('R1'); } },
            { cap: 'R2 leaves: readcount = 1. Still not zero, so W1 keeps waiting.', go: (E) => { E.endWork('R2'); E.run('R2'); } },
            { cap: 'R3 leaves: readcount = 0. As the <b>last</b> reader out it calls semSignal(wsem): wsem rises to 0 and W1, first in the queue, is released.', go: (E) => { E.endWork('R3'); E.run('R3'); } },
            { cap: 'W1 writes with the data entirely to itself.', go: (E) => E.run('W1') },
            { cap: '<b>R4 arrives while W1 writes.</b> It takes x, sets readcount = 1 and, as the first reader, calls semWait(wsem): wsem = −1, so R4 blocks <b>while still holding x</b>.', go: (E) => { E.arrive('R'); E.run('R4'); } },
            { cap: '<b>R5 arrives.</b> Its semWait(x) makes x −1, so R5 blocks on x. Only the first waiting reader queues on wsem; any others queue behind it on x.', go: (E) => { E.arrive('R'); E.run('R5'); } },
            { cap: 'W1 finishes. semSignal(wsem) releases R4; R4 then signals x, which releases R5. Both read together (readcount = 2). The group of readers now holds wsem.', go: (E) => { E.endWork('W1'); E.settle(); } },
          ];
          const player = ctx.ui.player({
            count: F.length, interval: 3400,
            render: (i) => {
              const E = engine('rp');
              for (let k = 0; k <= i; k++) { E.mark(); F[k].go(E); }
              drawRW(s, svg, E, { W: ctx.narrow ? 400 : 540, roomH: 122, rowH: 40 });
              markCode(preR, E, 'R'); markCode(preW, E, 'W');
              return F[i].cap;
            },
          });
          player.caption.style.minHeight = '5.9em';
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'small', html: 'Shared: <code>int readcount = 0;</code> <code>semaphore x = 1, wsem = 1;</code> (1 = open)<br><b>x</b> guards the counter; <span class="t">wsem</span> guards the data itself. Both are <span class="t">semaphores</span>.' }),
              h('div', { class: 'mini-h' }, 'Reader: runs these lines each time it reads'), preR,
              h('div', { class: 'mini-h' }, 'Writer: runs these lines each time it writes'), preW,
              h('div', { class: 'xs muted', html: 'Code colours: <span class="sw sw-cur">tinted</span> = just ran · <span class="sw sw-ok">green</span> = reading or writing here · <span class="sw sw-bad">red</span> = blocked here' }),
              h('div', { class: 'callout warn m0', style: { fontSize: '15px' }, 'data-label': 'Common mistake', html: 'Thinking every reader calls semWait(wsem). Only the <b>first</b> reader in does, and only the <b>last</b> one out signals it. The readers act as one group that holds wsem between them.' })),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' }, html: '<span class="mini-h m0">What the semaphores see</span><span>' + LEGEND + '</span>' }),
              h('div', { class: 'card white', style: { padding: '10px 12px' } }, svg), player.el)));
        },
      },

      /* ---------------- 4. Lab: the reading room, both policies side by side ---------------- */
      {
        title: 'Lab: one crowd of visitors, two policies',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const rate = { R: 60, W: 8 };
          let playing = false, rng = null;
          const P = [
            { pol: 'rp', title: 'Readers priority', sub: 'semaphores x, wsem' },
            { pol: 'wp', title: 'Writers priority', sub: 'semaphores z, rsem, x, y, wsem' },
          ];
          function meter(label) {
            const bar = h('i'), txt = h('span', { class: 'xs b' });
            const box = h('div', { class: 'stack', style: { gap: '2px' } },
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted b' }, label), txt),
              h('div', { class: 'meter' }, bar));
            box.set = (p, E) => {
              const w = p ? E.t - p.t0 : 0;
              bar.style.width = Math.min(100, (w / 40) * 100) + '%';
              bar.style.background = `var(--${w >= 25 ? 'bad' : w >= 10 ? 'warn' : 'ok'})`;
              txt.textContent = p ? `${p.id} has waited ${w} tick${w === 1 ? '' : 's'}` : 'nobody waiting';
              txt.style.color = w >= 25 ? 'var(--bad)' : '';
            };
            return box;
          }
          P.forEach((p) => {
            p.svg = s('svg', { width: '100%' });
            p.stats = h('span', { class: 'chip' });
            p.mW = meter('Starvation meter: longest-waiting writer');
            p.mR = meter('Longest-waiting reader');
            p.card = h('div', { class: 'card white stack', style: { gap: '8px', padding: '10px 12px' } },
              h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { justifyContent: 'space-between' } },
                h('div', {}, h('b', { style: { fontSize: '17px' } }, h('span', { class: 't' }, p.title)), h('span', { class: 'xs muted', style: { marginLeft: '8px' } }, p.sub)), p.stats),
              p.svg,
              p.pol === 'rp' ? h('p', { class: 'small muted m0', html: 'A reader who finds other readers inside walks straight in. A writer in the wsem queue must wait until readcount falls all the way to 0, so with busy readers it can <span class="t" data-t="Starvation">starve</span>.' })
                : h('p', { class: 'small muted m0', html: 'The first waiting writer closes the reader gate <span class="t">rsem</span>. New readers queue (one on rsem, the rest on z) while the readers inside drain out, so the writer goes next.' }),
              h('div', { class: 'stack', style: { gap: '6px', marginTop: 'auto' } }, p.mW, p.mR));
          });
          const cap = h('div', { class: 'cap-box' });
          const oldest = (E, k) => E.waiting(k).sort((a, b) => a.t0 - b.t0)[0];
          function paint() {
            P.forEach((p) => {
              const E = p.E;
              drawRW(s, p.svg, E, { W: ctx.narrow ? 400 : 540, roomH: 70, rowH: 28, title: 'Reading room' });
              p.stats.textContent = `t = ${E.t} · reads ${E.done.R} · writes ${E.done.W}`;
              p.mW.set(oldest(E, 'W'), E); p.mR.set(oldest(E, 'R'), E);
            });
            const [a, b] = P.map((p) => p.E);
            const wa = oldest(a, 'W'), wb = oldest(b, 'W');
            const rIn = (E) => E.inside().some((q) => q.kind === 'R'), wIn = (E) => E.inside().find((q) => q.kind === 'W');
            const ticks = (E, p) => plural(E.t - p.t0, 'tick', 'ticks');
            const left = !wa ? '<b>Left:</b> no writer is waiting at the moment.'
              : rIn(a) ? `<b>Left:</b> ${wa.id} has waited ${ticks(a, wa)} on wsem, yet each new reader who finds readers inside walks straight in, so readcount may never reach 0.`
                : `<b>Left:</b> ${wIn(a) ? wIn(a).id + ' is writing, and ' : ''}${wa.id} waits its turn on wsem.`;
            const right = wb && rIn(b)
              ? `<b>Right:</b> ${wb.id} has closed rsem, so newcomers queue on z and rsem while the readers inside drain out; then ${wb.id} writes.`
              : wb ? `<b>Right:</b> ${wb.id} waits on wsem behind the writer inside, and rsem stays closed to new readers.` : b.waiting('R').length ? '<b>Right:</b> readers are held back until the last writer reopens rsem.' : '<b>Right:</b> nobody is being held back.';
            cap.innerHTML = left + ' ' + right;
            bPlay.textContent = playing ? 'Pause' : '▶ Play';
          }
          function tickAll(arr) { P.forEach((p) => p.E.tick(arr)); }
          function randomArrivals() {
            const r = [rng(), rng(), rng(), rng()], arr = [];
            const busy = Math.max(...P.map((p) => p.E.procs.length));
            if (busy < 18 && r[0] < rate.R / 100) arr.push(['R', 4 + Math.floor(r[1] * 4)]);
            if (busy < 18 && r[2] < rate.W / 100) arr.push(['W', 3 + Math.floor(r[3] * 2)]);
            return arr;
          }
          function step() { tickAll(randomArrivals()); paint(); }
          function addNow(kind, dur) { P.forEach((p) => { p.E.arrive(kind, dur); p.E.settle(); }); paint(); }
          function reset() {
            rng = ctx.util.seeded(57);
            P.forEach((p) => (p.E = engine(p.pol)));
            [[['R', 7]], [['R', 7]], [['W', 3]], [['R', 6]], [['R', 6]]].forEach(tickAll);
            playing = false; paint();
          }
          const bPlay = h('button', { class: 'btn sm primary', type: 'button', style: { minWidth: '92px' }, onclick: () => { playing = !playing; paint(); } });
          const bStep = h('button', { class: 'btn sm', type: 'button', onclick: () => { playing = false; step(); } }, 'Step 1 tick');
          const bR = h('button', { class: 'btn sm proc', type: 'button', onclick: () => addNow('R', 5) }, '+ Reader');
          const bW = h('button', { class: 'btn sm', type: 'button', style: { borderColor: 'var(--accent)', color: 'var(--accent)' }, onclick: () => addNow('W', 3) }, '+ Writer');
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset');
          const sR = ctx.ui.slider({ label: 'Chance a reader arrives each tick', min: 0, max: 90, step: 5, value: rate.R, format: (v) => v + '%', onInput: (v) => (rate.R = v) });
          const sW = ctx.ui.slider({ label: 'Chance a writer arrives each tick', min: 0, max: 40, step: 2, value: rate.W, format: (v) => v + '%', onInput: (v) => (rate.W = v) });
          [sR, sW].forEach((x) => (x.style.fontSize = '14px'));
          reset();
          ctx.every(650, () => { if (playing) step(); });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'split', style: { height: 'auto', gridTemplateColumns: 'auto minmax(0,1fr)', alignItems: 'center', gap: '18px' } },
              h('div', { class: ctx.narrow ? 'row gap-s' : 'row gap-s nw' }, bPlay, bStep, bR, bW, bReset),
              h('div', { class: 'stack', style: { gap: '2px' } }, sR, sW)),
            h('div', { class: 'grid-2 grow' }, P[0].card, P[1].card),
            cap));
        },
      },

      /* ---------------- 5. Writers-priority solution: what each semaphore is for ---------------- */
      {
        title: 'Solution 2: writers have priority',
        kind: 'learn',
        render(el, ctx) {
          const { h } = ctx;
          const preR = codeBox(ctx, CODE.wp.R);
          const preW = codeBox(ctx, CODE.wp.W);
          const ROLES = [
            { key: 'new', label: 'What is new?', r: [1, 2, 7, 8], w: [1, 2, 3, 4, 8, 9, 10, 11],
              html: '<b>Goal (<span class="t">writers priority</span>):</b> once a writer has announced it wants to write, no <i>new</i> reader may start. The reading part and wsem work exactly as in solution 1. The highlighted lines are the additions: a reader must now pass <b>z</b> and <b>rsem</b>, and writers keep a count so the first can close <b>rsem</b> and the last can reopen it.' },
            { key: 'rsem', label: 'rsem', html: '<b><span class="t">rsem</span>, the reader gate.</b> The writer that makes writecount go 0 → 1 closes it with semWait(rsem). After that the writers hold it as a group, and whichever writer makes writecount go 1 → 0 reopens it. While it is shut no new reader can even begin. A reader passes through it alone and reopens it at once.' },
            { key: 'z', label: 'z', html: '<b>z, the turnstile before the gate.</b> A reader holds z while it waits at rsem, so only one reader at a time can queue on rsem; the rest wait on z. When the first writer calls semWait(rsem), at most one reader is ahead of it, never a crowd. (During that short wait the writer still holds y, so another writer briefly waits on y.)' },
            { key: 'wsem', label: 'wsem', html: '<b>wsem guards the data itself,</b> exactly as before: held by one writer, or by the whole group of readers (the first reader in takes it, the last reader out returns it). Writers still line up here one at a time.' },
            { key: 'x', label: 'x', html: '<b>x protects readcount,</b> so two readers can never update the counter at the same moment.' },
            { key: 'y', label: 'y', html: '<b>y protects writecount,</b> so two writers can never update that counter at the same moment. It does the same job for writers that x does for readers.' },
            { key: 'readcount', label: 'readcount', html: '<b><span class="t">readcount</span></b> counts the readers inside. As in solution 1, the change 0 → 1 means “take wsem” and 1 → 0 means “give wsem back”.' },
            { key: 'writecount', label: 'writecount', html: '<b><span class="t">writecount</span></b> counts writers that are waiting <i>or</i> writing. 0 → 1: the first one closes rsem. 1 → 0: the last one reopens it. So rsem stays shut as long as any writer is interested.' },
          ];
          const info = h('div', { class: 'card', style: { minHeight: '104px', padding: '10px 14px', fontSize: '15.5px', lineHeight: '1.45' } });
          const btns = ROLES.map((r) => h('button', { class: 'btn sm' + (r.key === 'new' ? '' : ' mono'), type: 'button', onclick: () => pick(r) }, r.label));
          function pick(r) {
            btns.forEach((b, i) => b.classList.toggle('on', ROLES[i] === r));
            const rl = r.r || linesWith(CODE.wp.R, r.key), wl = r.w || linesWith(CODE.wp.W, r.key);
            preR.clear(); preW.clear();
            preR.mark(rl, 'cur'); preW.mark(wl, 'cur');
            const where = r.key === 'new' ? '' : `<div class="xs muted" style="margin-top:4px">Used on ${rl.length} reader line${rl.length === 1 ? '' : 's'} and ${wl.length} writer line${wl.length === 1 ? '' : 's'} (highlighted).</div>`;
            info.innerHTML = r.html + where;
          }
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row nw', style: { justifyContent: 'space-between', gap: '16px' } },
              h('p', { class: 'm0', html: 'Shared: <code>int readcount = 0, writecount = 0;</code> <code>semaphore x = 1, y = 1, z = 1, wsem = 1, rsem = 1;</code>' })),
            h('div', { class: 'row gap-s' }, h('span', { class: 'mini-h m0', style: { marginRight: '4px' } }, 'Click a name:'), ...btns),
            info,
            h('div', { class: 'split', style: { height: 'auto' } },
              h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'mini-h' }, 'Reader: each time it reads'), preR),
              h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'mini-h' }, 'Writer: each time it writes'), preW,
                h('div', { class: 'callout why m0', style: { fontSize: '15px', marginTop: '4px' }, 'data-label': 'Why it matters', html: 'A stream of readers can no longer shut writers out: once a writer arrives, the gate closes and the readers inside simply drain away.' })))));
          pick(ROLES[0]);
        },
      },

      /* ---------------- 6. Writers priority: the four classic queue pictures ---------------- */
      {
        title: 'Writers priority: where does everyone wait?',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const A = (k) => (E) => { E.arrive(k, 99); E.settle(); };
          const D = (id) => (E) => { E.endWork(id); E.settle(); };
          const SC = [
            { label: 'Only readers', pic: 3, frames: [
              ['<b>R1 arrives.</b> It passes z and rsem, becomes the first reader and takes wsem for the readers.', A('R')],
              ['<b>R2 arrives.</b> No writer has closed the gate, so R2 passes z and rsem and joins R1.', A('R')],
              ['<b>R3 arrives</b> and joins too. <b>Classic picture:</b> the readers hold wsem as a group, and every queue is empty.', A('R')]] },
            { label: 'Only writers', pic: 3, frames: [
              ['<b>W1 arrives.</b> writecount = 1, so it closes rsem; then it takes wsem and writes.', A('W')],
              ['<b>W2 arrives.</b> writecount = 2 (rsem is already shut), and it queues on wsem.', A('W')],
              ['<b>W3 arrives</b> and queues on wsem behind W2. <b>Classic picture:</b> W1 holds wsem, the writers keep rsem closed, and the other writers line up on wsem.', A('W')]] },
            { label: 'Both, a reader first', pic: 5, frames: [
              ['<b>R1 arrives first</b> and starts reading, taking wsem for the readers.', A('R')],
              ['<b>W1 arrives.</b> It closes rsem (writecount = 1), then queues on wsem because R1 is reading.', A('W')],
              ['<b>W2 arrives</b> and queues on wsem behind W1.', A('W')],
              ['<b>R2 arrives.</b> It gets past z but finds rsem shut, so it queues on rsem.', A('R')],
              ['<b>R3 arrives.</b> R2 still holds z, so R3 queues on z. <b>Classic picture:</b> the readers hold wsem, a writer closed rsem; writers line up on wsem, one reader on rsem, the rest on z.', A('R')],
              ['<b>R1 finishes.</b> As the last reader out it signals wsem, and W1 (front of the queue) writes.', D('R1')],
              ['<b>W1 finishes.</b> W2 writes next, even though R2 and R3 were waiting: writers go first.', D('W1')],
              ['<b>W2 finishes.</b> writecount drops to 0, so it reopens rsem. R2 gets in and lets R3 through z: both read.', D('W2')]] },
            { label: 'Both, a writer first', pic: 4, frames: [
              ['<b>W1 arrives first.</b> It closes rsem, takes wsem and writes.', A('W')],
              ['<b>R1 arrives.</b> It passes z but finds rsem shut, so it queues on rsem.', A('R')],
              ['<b>W2 arrives.</b> writecount = 2, and it queues on wsem.', A('W')],
              ['<b>R2 arrives.</b> R1 still holds z, so R2 queues on z. <b>Classic picture:</b> a writer holds wsem and the writers keep rsem closed; writers line up on wsem, one reader on rsem, the rest on z.', A('R')],
              ['<b>W1 finishes.</b> W2 takes wsem next; the readers keep waiting.', D('W1')],
              ['<b>W2 finishes.</b> It was the last writer, so it reopens rsem; R1 and then R2 get in and read together.', D('W2')]] },
          ];
          const PICS = [
            'Readers hold wsem. No queues at all.',
            'A writer holds wsem; rsem is shut. Other writers queue on wsem.',
            'Readers hold wsem; a writer shut rsem. Writers queue on wsem, one reader on rsem, the rest on z.',
            'A writer holds wsem; rsem is shut. Writers queue on wsem, one reader on rsem, the rest on z.',
          ];
          let cur = 2;
          const svg = s('svg', { width: '100%' });
          const rows = SC.map((sc, i) => h('tr', {}, h('td', { style: { width: '116px' } }, h('b', {}, sc.label), h('div', { class: 'r57-now xs b' }, '✓ shown now')), h('td', {}, PICS[i])));
          const table = h('table', { class: 'tbl compact' }, h('tr', {}, h('th', {}, 'Situation'), h('th', {}, 'Semaphores and queues')), ...rows);
          const player = ctx.ui.player({
            count: SC[cur].frames.length + 1, interval: 3200,
            render: (i) => {
              const sc = SC[cur], fr = [['<b>Empty.</b> All five semaphores are 1 and both counters are 0. Press Play or step forward.', () => {}], ...sc.frames];
              const E = engine('wp');
              for (let k = 0; k <= i; k++) { E.mark(); fr[k][1](E); }
              drawRW(s, svg, E, { W: ctx.narrow ? 400 : 620, roomH: 90, rowH: 33 });
              rows.forEach((r, j) => {
                r.classList.toggle('on', j === cur);
                r.classList.toggle('r57-hit', j === cur && i === sc.pic);
              });
              return fr[i][0];
            },
          });
          player.caption.style.minHeight = '4.4em';
          const seg = ctx.ui.seg(SC.map((sc, i) => ({ value: i, label: sc.label })), cur, (v) => { cur = v; player.setCount(SC[cur].frames.length + 1); });
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              seg,
              h('div', { class: 'card white', style: { padding: '8px 12px' } }, svg), player.el),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'mini-h' }, 'The four classic pictures'), table,
              h('div', { class: 'callout tip m0', style: { fontSize: '15px' }, 'data-label': 'Spot the pattern', html: 'Waiting writers always queue on <b>wsem</b>. At most <b>one</b> reader ever waits on rsem; any other waiting readers are on <b>z</b>. That is exactly z’s job.' }),
              h('div', { class: 'callout why m0', style: { fontSize: '15px' }, 'data-label': 'Compare', html: 'Under readers priority a newcomer walks past a waiting writer whenever readers are inside. Here, once a writer shuts rsem, every newcomer waits.' }))));
        },
      },

      /* ---------------- 7. Message passing: one controller, three mailboxes ---------------- */
      {
        title: 'Solution 3: a controller and three mailboxes',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const pre = codeBox(ctx, CTRL);
          const preC = codeBox(ctx, CLIENT);
          const svg = s('svg', { viewBox: '0 0 470 304', width: '100%' });
          const cap = h('div', { class: 'cap-box', style: { minHeight: '4.4em', flex: 'none' } });
          const clock = h('span', { class: 'chip' });
          let M = null, auto = false;
          function draw() {
            const W = 470, K = [];
            K.push(s('text', { x: 2, y: 14, 'font-weight': 800, 'font-size': 15 }, 'Mailboxes'), s('text', { x: 90, y: 14, class: 's-sub', 'font-size': 13 }, '(oldest message on the left)'));
            ['readrequest', 'writerequest', 'finished'].forEach((nm, i) => {
              const y = 24 + i * 38, q = M.mb[nm];
              K.push(s('text', { x: 2, y: y + 21, class: 's-monot', 'font-weight': 700, 'font-size': 14 }, nm));
              K.push(s('rect', { x: 118, y, width: W - 120, height: 32, rx: 8, class: 's-os', 'stroke-width': 1.5 }));
              q.slice(0, 7).forEach((id, k) => K.push(tok(s, { id, kind: id[0] }, 144 + k * 46, y + 16, { small: true })));
              if (!q.length) K.push(s('text', { x: 130, y: y + 21, class: 's-sub', 'font-size': 13.5 }, 'empty'));
            });
            const cy = 146, zone = M.count > 0 ? 0 : M.count === 0 ? 1 : 2, zc = ['ok', 'warn', 'bad'];
            K.push(s('rect', { x: 1, y: cy, width: W - 2, height: 84, rx: 12, class: 's-panel', 'stroke-width': 2 }));
            K.push(s('text', { x: 14, y: cy + 22, 'font-weight': 800, 'font-size': 15 }, 'Controller process'));
            K.push(s('text', { x: 14, y: cy + 56, class: 's-monot', 'font-weight': 800, 'font-size': 26, style: `fill:var(--${zc[zone]})` }, 'count = ' + fmtV(M.count)));
            K.push(s('text', { x: 14, y: cy + 75, class: 's-sub', 'font-size': 13 }, M.writer ? `writer_id = ${M.writer} (${M.waitW ? 'now writing' : 'waiting for OK'})` : 'count started at 100'));
            [['> 0', 'no writer accepted yet'], ['= 0', 'the writer goes alone'], ['< 0', 'writer waits for readers']].forEach(([a, b], k) => {
              const y = cy + 7 + k * 25, on = k === zone;
              K.push(s('rect', { x: 226, y, width: 236, height: 21, rx: 6, class: on ? 's-' + zc[k] : 's-muted', 'stroke-width': on ? 2 : 1 }));
              K.push(s('text', { x: 236, y: y + 15, class: 's-monot', 'font-weight': 800, 'font-size': 13.5, style: on ? `fill:var(--${zc[k]})` : '' }, a));
              K.push(s('text', { x: 272, y: y + 15, 'font-size': 13.5, class: on ? '' : 's-sub' }, b));
            });
            const ry = 240, inside = M.inside(), wr = inside.find((c) => c.kind === 'W');
            K.push(s('rect', { x: 1, y: ry, width: W - 2, height: 62, rx: 12, class: wr ? 's-accent' : inside.length ? 's-proc' : 's-panel', 'stroke-width': 2 }));
            K.push(s('text', { x: 14, y: ry + 28, 'font-weight': 800, 'font-size': 15 }, 'Using the data'));
            K.push(s('text', { x: 14, y: ry + 47, class: 's-sub', 'font-size': 13 }, wr ? 'a writer, alone' : inside.length ? plural(inside.length, 'reader', 'readers') : 'nobody'));
            inside.slice(0, 5).forEach((c, k) => K.push(tok(s, c, 180 + k * 56, ry + 31)));
            svg.replaceChildren(...K);
          }
          function paint(msg) {
            draw();
            pre.clear(); pre.mark(M.lines, 'cur'); pre.mark(M.bad, 'bad');
            if (msg) cap.innerHTML = msg;
            clock.textContent = 'tick ' + M.t;
            bAuto.textContent = auto ? 'Pause' : 'Auto-run';
            bAuto.classList.toggle('on', auto);
            bR.disabled = M.mb.readrequest.length >= 6; bW.disabled = M.mb.writerequest.length >= 6;
          }
          function reset() {
            M = mpEngine();
            M.reading(2); M.reading(3); M.reading(4); M.request('W', 3); M.request('R', 3);
            auto = false;
            paint('<b>Start.</b> Three readers are inside, so count = 100 − 3 = <b>97</b>. The requests from W1 and R4 sit unread in their mailboxes. Press <b>Next tick</b>: one controller action per tick.');
          }
          const ask = (k) => { const c = M.request(k, 3); paint(`${c.id} sends its request to <b>${k === 'R' ? 'readrequest' : 'writerequest'}</b> and blocks until an OK comes back. The controller will see it on a later tick.`); };
          const bR = h('button', { class: 'btn sm proc', type: 'button', onclick: () => ask('R') }, '+ Reader asks');
          const bW = h('button', { class: 'btn sm', type: 'button', style: { borderColor: 'var(--accent)', color: 'var(--accent)' }, onclick: () => ask('W') }, '+ Writer asks');
          const bNext = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { auto = false; paint(M.tick()); } }, 'Next tick ▶');
          const bAuto = h('button', { class: 'btn sm', type: 'button', onclick: () => { auto = !auto; paint(); } });
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset');
          reset();
          ctx.every(1600, () => { if (auto) paint(M.tick()); });
          const tabs = ctx.ui.tabs([
            { label: 'Controller code', render: (p) => { p.append(pre, h('p', { class: 'm0', style: { marginTop: '8px', fontSize: '14px', lineHeight: '1.4' }, html: '<b>Why 100?</b> Any start value above the largest possible number of readers works (here: at most 99 at once). Then count &gt; 0 always means “no writer accepted yet”, and after count −= 100 the value is exactly minus the readers still inside.' })); } },
            { label: 'Reader and writer code', render: (p) => { p.append(h('div', { class: 'stack', style: { gap: '10px' } }, preC,
              h('p', { class: 'small m0', html: 'A reader or writer never touches the data without an <b>OK</b>. <code>mbox[i]</code> is process i’s own mailbox, where its OK arrives. Only the controller ever reads or changes <b>count</b>: it is a private variable of one process, so it needs no semaphore at all.' }),
              h('div', { class: 'callout why m0', style: { fontSize: '15px' }, 'data-label': 'Why it matters', html: 'The processes coordinate only by exchanging messages: no shared counter, no semaphore. So the same design works when they run on different computers that share nothing but the data itself (a file on a server, say). The price is one extra process that every access must go through.' }))); } },
          ]);
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack' }, tabs),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'row gap-s' }, bR, bW, bReset),
              h('div', { class: 'row gap-s' }, bNext, bAuto, clock),
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg), cap,
              h('p', { class: 'small muted m0', html: 'This is <span class="t">message passing</span>: no shared variables at all. Each <span class="t">mailbox</span> queues messages, and one <span class="t">controller process</span> owns the only counter.' }))));
        },
      },

      /* ---------------- 8. Predict: who goes next? ---------------- */
      {
        title: 'Predict: who goes next?',
        kind: 'predict',
        render(el, ctx) {
          const { h, s } = ctx;
          const A = (...ks) => (E) => ks.forEach((k) => { E.arrive(k, 99); E.settle(); });
          const D = (...ids) => (E) => { ids.forEach((id) => E.endWork(id)); E.settle(); };
          const PZ = [
            { pol: 'rp', setup: A('R', 'R', 'W'), then: A('R'),
              q: 'R1 and R2 are reading and W1 waits on wsem. Now <b>R3 arrives</b>. What happens to R3?',
              choices: ['R3 walks straight in and reads with R1 and R2', 'R3 waits behind W1 in wsem’s queue', 'R3 waits on x until R1 and R2 leave'], answer: 0,
              why: 'R3 finds readcount already above 0, so it never touches wsem. Only the first reader competes with writers; later readers simply join the group. This is how a writer starves.' },
            { pol: 'wp', setup: A('R', 'R', 'W'), then: A('R'),
              q: 'Same crowd, other policy: R1 and R2 are reading and W1 is waiting. Now <b>R3 arrives</b>. What happens to R3?',
              choices: ['R3 walks straight in', 'R3 is stopped at rsem, which W1 has closed', 'R3 is stopped at wsem, behind W1'], answer: 1,
              why: 'As the first writer, W1 did semWait(rsem) before queueing on wsem. R3 gets past z but blocks on rsem: no new reader may start once a writer has asked.' },
            { pol: 'rp', setup: A('W'), then: A('R', 'R'),
              q: 'W1 is writing. Then <b>R1 arrives, and then R2</b>. Where does each reader wait?',
              choices: ['Both wait on wsem', 'R1 waits on wsem (still holding x); R2 waits on x', 'Both wait on x'], answer: 1,
              why: 'R1 takes x, sets readcount = 1 and, as the first reader, blocks on wsem without releasing x. R2 therefore blocks at its very first line, semWait(x).' },
            { pol: 'wp', setup: A('W', 'R', 'W', 'R'), then: D('W1'),
              q: 'W1 is writing; W2 waits on wsem, R1 on rsem, R2 on z. <b>W1 finishes.</b> Who uses the data next?',
              choices: ['R1 and R2, together', 'W2', 'R1 alone'], answer: 1,
              why: 'W1’s semSignal(wsem) releases W2, the front of that queue. writecount only falls from 2 to 1, so rsem stays shut and the readers keep waiting.' },
            { pol: 'wp', setup: A('R', 'R', 'W', 'R'), then: D('R1', 'R2'),
              q: 'R1 and R2 are reading, W1 waits on wsem and R3 on rsem. <b>R1 and R2 both finish.</b> Who goes next?',
              choices: ['R3, since readers were already in charge', 'W1', 'R3 and W1 together'], answer: 1,
              why: 'The last reader out signals wsem, which releases W1. R3 sits behind the closed rsem gate until writecount returns to 0.' },
            { pol: 'mp',
              q: 'Message passing. count starts at 100. The controller grants <b>4</b> read requests and then receives <b>1</b> finished message. Now it accepts a write request. What is count?',
              choices: ['−3', '96', '0'], answer: 0,
              why: '100 − 4 + 1 = 97 while three readers are inside; 97 − 100 = −3. The controller now waits for exactly 3 finished messages (count climbs to 0) before it sends the writer its OK.',
              log: ['start: count = 100', '4 read requests granted: 99, 98, 97, 96', '1 finished message: 97 (3 readers inside)'], after: ['write request accepted: 97 − 100 = −3', '3 finished messages: −2, −1, 0', 'count == 0: the writer gets its OK'] },
          ];
          let i = 0, view = 0;
          const chosen = PZ.map(() => null);
          const nav = h('div', { class: 'row nw', style: { gap: '6px' } });
          const qEl = h('div', { style: { fontSize: '18px', fontWeight: 650, lineHeight: '1.4' } });
          const opts = h('div', { class: 'qopts' });
          const fb = h('div', { class: 'verdict' });
          const pol = h('span', { class: 'chip accent' });
          const svg = s('svg', { width: '100%' });
          const logEl = h('div', { class: 'stack', style: { gap: '8px' } });
          const vis = h('div', { class: 'card white', style: { padding: '10px 12px' } });
          const seg = ctx.ui.seg([{ value: 0, label: 'Before' }, { value: 1, label: 'After' }], 0, (v) => { view = v; paintVis(); });
          const tip = h('div', { class: 'callout tip m0', style: { fontSize: '15px', marginTop: 'auto' }, 'data-label': 'Reading the picture' });
          const bPrev = h('button', { class: 'btn sm', type: 'button', onclick: () => go(i - 1) }, '◀ Previous');
          const bNext = h('button', { class: 'btn sm primary', type: 'button', onclick: () => go(i + 1) }, 'Next puzzle ▶');
          function paintVis() {
            const p = PZ[i];
            seg.querySelectorAll('button')[1].disabled = chosen[i] == null;
            tip.innerHTML = p.pol === 'mp'
              ? 'Each box is one event in the controller’s life. The violet boxes appear once you answer: they show the arithmetic and what the controller does next.'
              : 'A <b>dashed</b> token is blocked in that semaphore’s queue, front of the line first. A <mark>highlighted</mark> token was just released by a semSignal. A negative value counts the processes waiting.';
            if (p.pol === 'mp') {
              const rows = p.log.concat(view ? p.after : ['write request accepted: count = ?']);
              logEl.replaceChildren(h('div', { class: 'mini-h' }, 'Controller’s count, event by event'),
                ...rows.map((r, k) => h('div', { class: 'box' + (k >= p.log.length ? ' os' : ''), style: { textAlign: 'left', fontWeight: 600, fontSize: '15.5px' } }, r)));
              vis.replaceChildren(logEl);
              return;
            }
            const E = engine(p.pol);
            p.setup(E); E.mark();
            if (view) p.then(E);
            drawRW(s, svg, E, { W: ctx.narrow ? 400 : 540, roomH: p.pol === 'rp' ? 116 : 84, rowH: p.pol === 'rp' ? 40 : 31, title: view ? 'After' : 'Before' });
            vis.replaceChildren(svg);
          }
          function paint() {
            const p = PZ[i], c = chosen[i];
            nav.replaceChildren(...PZ.map((_, k) => h('button', { type: 'button', class: 'quiz-pill' + (k === i ? ' on' : '') + (chosen[k] != null ? (chosen[k] === PZ[k].answer ? ' right' : ' wrong') : ''), onclick: () => go(k) }, String(k + 1))));
            pol.textContent = p.pol === 'rp' ? 'Readers priority' : p.pol === 'wp' ? 'Writers priority' : 'Message passing';
            qEl.innerHTML = p.q;
            opts.replaceChildren(...p.choices.map((t, k) => {
              const b = h('button', { type: 'button', class: 'qopt', onclick: () => { if (chosen[i] == null) { chosen[i] = k; view = 1; seg.set(1); paint(); } } },
                h('span', { class: 'ql' }, 'ABC'[k]), h('span', { html: t }));
              if (c != null) { b.disabled = true; if (k === p.answer) b.classList.add('right'); else if (k === c) b.classList.add('wrong'); else b.classList.add('dim'); }
              return b;
            }));
            if (c == null) { fb.className = 'verdict'; fb.innerHTML = '<span class="vh">Commit to a prediction</span>Pick one answer. Then the picture switches from <b>Before</b> to <b>After</b> so you can check it.'; }
            else { fb.className = 'verdict ' + (c === p.answer ? 'ok' : 'bad'); fb.innerHTML = `<span class="vh">${c === p.answer ? '✓ Right' : '✗ Not quite: the answer is ' + 'ABC'[p.answer]}</span>${p.why}`; }
            bPrev.disabled = i === 0; bNext.disabled = i === PZ.length - 1;
            if (c == null) { view = 0; seg.set(0); }
            paintVis();
          }
          function go(k) { i = Math.max(0, Math.min(PZ.length - 1, k)); view = chosen[i] == null ? 0 : 1; seg.set(view); paint(); }
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, nav, pol), qEl, opts, fb,
              h('div', { class: 'row', style: { marginTop: 'auto' } }, bPrev, bNext)),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, seg, h('span', { html: LEGEND })), vis,
              tip)));
          paint();
        },
      },

      /* ---------------- 9. Recap ---------------- */
      {
        title: 'Recap: six ideas to carry away',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          // each face is wrapped in one <span>: the card face is a flex box, so bare inline tags would become separate columns
          const wrap = (pairs) => pairs.map(([f, bk]) => ['<span>' + f + '</span>', '<span>' + bk + '</span>']);
          const cards = ctx.ui.flipcards(wrap([
            ['The three rules', 'Any number of readers at once; only one writer at a time; nobody reads while a writer writes.'],
            ['Who touches wsem in solution 1?', 'Every writer, but among readers only the <b>first in</b> (takes it) and the <b>last out</b> (returns it). The readers hold it as a group.'],
            ['The flaw of readers priority', 'Writers can <b>starve</b>: if readers keep overlapping, readcount never reaches 0, so wsem is never released.'],
            ['What rsem does', 'It is the reader gate. The first interested writer closes it and the last one reopens it, so no new reader starts while a writer waits.'],
            ['Why z exists', 'Only one reader may queue on rsem; the rest wait on z. A writer calling semWait(rsem) is never stuck behind a crowd of readers.'],
            ['The controller’s count', '<b>&gt; 0</b>: no writer accepted yet (100 − readers inside). <b>= 0</b>: the writer goes alone. <b>&lt; 0</b>: a writer waits for −count readers to leave.'],
          ]), { cols: 3, height: 146 });
          const sol = (name, tag, body, cls) => h('div', { class: 'card tight ' + cls }, h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('b', {}, name), h('span', { class: 'chip' }, tag)), h('p', { class: 'small m0', style: { marginTop: '4px' }, html: body }));
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
            h('p', { class: 'lead m0' }, 'Say each answer out loud, then click the card to check yourself.'),
            cards,
            h('div', { class: 'mini-h', style: { marginTop: '4px' } }, 'The three solutions at a glance'),
            h('div', { class: 'grid-3' },
              sol('1 · Readers priority', 'x, wsem', 'Maximum sharing and the simplest code. Weakness: a steady stream of readers can starve a writer.', 'proc'),
              sol('2 · Writers priority', '+ rsem, y, z', 'Once a writer asks, no new reader starts; the readers inside drain out. Weakness: readers can wait long if writers keep coming.', ''),
              sol('3 · Message passing', 'controller', 'One controller answers readrequest, writerequest and finished, checking finished first and writers before readers. No shared counters or semaphores.', 'os'))));
        },
      },

      /* ---------------- 10. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Which situation breaks the readers/writers rules?',
            choices: ['Three readers reading the data at the same time', 'One writer writing while nobody else uses the data', 'One reader reading while one writer writes', 'Nobody using the data at all'], answer: 2,
            feedback: ['Allowed: any number of readers may read together.', 'Allowed: the writer has the data to itself, which is exactly what it needs.', null, 'An unused data area breaks no rule.'],
            why: 'While a writer is writing, no reader may read. The reader could see a half-finished update that mixes old and new values.' },
          { type: 'tf', q: 'In the readers-priority semaphore solution, every reader performs semWait(wsem) before it reads.', answer: false,
            why: 'Only the reader that raises readcount from 0 to 1 calls semWait(wsem), and only the one that brings it back to 0 calls semSignal(wsem). The readers hold wsem as a group.' },
          { q: 'In the readers-priority solution, why can a writer starve?',
            choices: ['It needs readcount to reach 0, but new readers keep joining while others are still reading', 'It is blocked on x, which readers never release', 'The semaphore wsem starts at 0', 'Readers are faster than writers, so the scheduler prefers them'], answer: 0,
            feedback: [null, 'Writers never touch x in this solution; x only protects readcount.', 'wsem starts at 1, so a writer gets in at once when nobody is inside.', 'Speed has nothing to do with it; the rule that lets a new reader join the group does.'],
            why: 'A writer needs wsem, and the readers give it back only when the last of them leaves. If readers keep overlapping, that moment never arrives.' },
          { type: 'multi', q: 'Which statements about the writers-priority semaphore solution are true?',
            choices: ['The writer that raises writecount from 0 to 1 closes rsem, so no new reader can start', 'writecount counts the writers that are waiting or writing', 'Two writers may write together as long as no reader is reading', 'At most one reader is ever queued on rsem; other waiting readers queue on z', 'Readers already inside are forced to stop the moment a writer arrives'], answer: [0, 1, 3],
            why: 'rsem is the reader gate, driven by writecount, and z keeps rsem’s queue down to one reader. Writers still take wsem one at a time, and readers already inside are allowed to finish: they drain out.' },
          { type: 'match', q: 'Match each variable of the writers-priority solution with its job.',
            pairs: [['rsem', 'Keeps new readers out while any writer is interested'], ['wsem', 'Gives the data to one writer or to the group of readers'], ['x', 'Protects readcount'], ['y', 'Protects writecount'], ['z', 'Lets only one reader at a time wait on rsem']],
            why: 'wsem guards the data itself; rsem is the gate writers close; x and y protect the two counters; z is the turnstile that stops readers piling up on rsem.' },
          { q: 'Writers-priority semaphore solution: the readers hold wsem, a writer has closed rsem, every writer is queued on wsem, one reader is queued on rsem and the other waiting readers are queued on z. Which situation is this?',
            choices: ['Only readers are in the system', 'Only writers are in the system', 'Both readers and writers, and a read came first', 'Both readers and writers, and a write came first'], answer: 2,
            feedback: ['With only readers there are no queues at all.', 'With only writers no reader would be queued anywhere.', null, 'If a write had come first, a writer would hold wsem, not the readers.'],
            why: 'A reader got in first and holds wsem for the readers. The first writer then closed rsem and queued on wsem; later readers stop at rsem (just one) and z (the rest).' },
          { type: 'order', q: 'Readers priority: put the steps of the <b>first</b> reader to arrive in order.',
            items: ['semWait(x): lock the counter', 'readcount++ (it is now 1)', 'semWait(wsem): lock writers out', 'semSignal(x): unlock the counter', 'READUNIT(): read the data'],
            why: 'The counter is locked, updated and tested; the first reader claims wsem for the group; only then does it release the counter and read.' },
          { type: 'bucket', q: 'Which semaphore solution does each feature belong to?', buckets: ['Readers priority', 'Writers priority'],
            items: [['Uses only two semaphores, x and wsem', 0], ['A newly arriving reader may join while a writer waits', 0], ['Needs a writecount variable', 1], ['A waiting writer can starve', 0], ['A stream of writers can keep readers waiting', 1], ['Uses the semaphores rsem, y and z', 1]],
            why: 'Readers priority is the short solution that lets readers join freely, at the risk of starving writers. Writers priority adds rsem, y, z and writecount so a waiting writer is never overtaken by new readers.' },
          { type: 'num', q: 'Message-passing solution: count starts at 100. The controller has granted 6 read requests and received 2 finished messages. It now accepts a write request. What is count right after that?', answer: -4, tol: 0,
            why: '100 − 6 + 2 = 96, meaning four readers are inside. 96 − 100 = −4, so the controller now waits for four finished messages before the writer may start.' },
          { type: 'num', q: 'Message-passing readers/writers solution: the controller’s count is −2. How many finished messages must it receive before it sends the waiting writer its OK?', answer: 2, tol: 0,
            why: 'A negative count is minus the number of readers still inside. Each finished message adds 1, and when count reaches 0 the writer gets its OK.' },
          { type: 'tf', q: 'In the message-passing solution, when count > 0 the controller checks the finished mailbox first, then writerequest, then readrequest. Checking writerequest before readrequest is what gives writers priority over newly arriving readers.', answer: true,
            why: 'Serving finished first keeps count accurate; checking writerequest before readrequest means a waiting writer is always taken ahead of a new reader, and once it is taken count ≤ 0, so no further read request is served until the writer is done.' },
          { q: 'Why is the readers/writers problem not simply the producer/consumer problem?',
            choices: ['Readers never change the data, so they may share it; a consumer is not read-only, because it removes an item and updates the buffer’s pointers', 'There are always more readers than writers', 'Producer/consumer cannot be solved with semaphores', 'In readers/writers no process ever has to wait'], answer: 0,
            feedback: [null, 'How many of each kind there are does not define the problem; the rules would be the same with one reader and ten writers.', 'It can; that is a standard semaphore exercise.', 'Readers and writers certainly wait for each other: rule 3 forbids reading during a write.'],
            why: 'It can look like one writer (the producer) and one reader (the consumer), but the consumer changes the buffer too: it removes an item and updates the pointers, while the producer reads those pointers to find a free slot and then updates them. Both sides modify shared data, so neither may share it. Readers leave the data untouched, which is exactly why many of them may share it at once.' },
        ],
      },

    ],

    notes: `
      <h3>1. The problem</h3>
      <p>A <b>shared data area</b> (a file, a block of main memory, or even a bank of processor registers) is used by two kinds of processes. <b>Readers</b> only read it and never change it, so they may share access. <b>Writers</b> modify it (a writer may also read the data as part of its update), so each writer needs exclusive access. Three rules must hold:</p>
      <ol><li>Any number of readers may read at the same time.</li><li>Only one writer at a time may write.</li><li>While a writer is writing, no reader may read.</li></ol>
      <p>Rule 3 exists because a reader could otherwise see an update half-done. Example: a board says “09:40, gate B7”; the writer has changed the time to 10:15 but not yet the gate, so a reader sees “10:15, gate B7”, a combination that was never true.</p>
      <h4>Why it is its own problem</h4>
      <ul>
        <li><b>Not plain mutual exclusion.</b> If we could not tell which processes only read, one lock (one critical section) around every access would be the only safe choice. Knowing that readers never change the data lets them share. Example: 4 readers of 2 ms each take 4 × 2 = 8 ms under one lock, but 2 ms when they overlap (a processor each).</li>
        <li><b>Not producer/consumer.</b> It can look like one writer (producer) and one reader (consumer), but the consumer is not read-only: it removes an item and updates the buffer’s pointers. The producer reads those pointers to find a free slot and check for “full”, then updates them. Both sides change the buffer, so neither may share it, and each waits for the other (an item to take, a slot to fill). Readers never change the data, which is exactly why many may share it.</li>
      </ul>
      <h3>2. Solution 1: readers have priority</h3>
      <p>Shared: <code>int readcount = 0; semaphore x = 1, wsem = 1;</code>. <b>x</b> protects readcount; <b>wsem</b> protects the data.</p>
      <pre>/* reader, each time it reads */
${listing(CODE.rp.R, true)}

/* writer, each time it writes */
${listing(CODE.rp.W, true)}</pre>
      <ul>
        <li>Every writer does semWait(wsem) / semSignal(wsem) around its write.</li>
        <li>Among readers only the <b>first in</b> (readcount 0 → 1) takes wsem and only the <b>last out</b> (1 → 0) returns it. The readers hold wsem as one group.</li>
        <li>Where they wait: a writer waits on wsem. If a writer is writing, the first arriving reader blocks on wsem <i>while still holding x</i>, so any further readers block on x.</li>
        <li><b>Weakness: writers can starve.</b> A newly arriving reader joins whenever other readers are inside, even if a writer is waiting. If readers keep overlapping, readcount never returns to 0 and the writer waits indefinitely.</li>
      </ul>
      <h3>3. Solution 2: writers have priority</h3>
      <p>Goal: once a writer has declared that it wants to write, no new reader may start. Shared: <code>int readcount = 0, writecount = 0; semaphore x = 1, y = 1, z = 1, wsem = 1, rsem = 1;</code></p>
      <table><tr><th>Name</th><th>Job</th></tr>
        <tr><td>wsem</td><td>Guards the data: held by one writer or by the group of readers (first reader in, last reader out).</td></tr>
        <tr><td>rsem</td><td>Reader gate. The writer that takes writecount 0 → 1 closes it; the writers then hold it as a group, and whichever writer takes writecount 1 → 0 reopens it.</td></tr>
        <tr><td>z</td><td>A reader keeps z while it waits on rsem, so only one reader at a time can wait on rsem; the others wait on z. A writer calling semWait(rsem) is never behind a crowd of readers: at worst it waits briefly for that one reader, still holding y, so other writers briefly wait on y.</td></tr>
        <tr><td>x / y</td><td>Protect readcount / writecount.</td></tr>
        <tr><td>writecount</td><td>Writers that are waiting or writing.</td></tr></table>
      <pre>/* reader */
${listing(CODE.wp.R, true)}

/* writer */
${listing(CODE.wp.W, true)}</pre>
      <h4>The four queue pictures</h4>
      <table><tr><th>Situation</th><th>Semaphores and queues</th></tr>
        <tr><td>Only readers</td><td>The readers hold wsem; nobody waits anywhere.</td></tr>
        <tr><td>Only writers</td><td>A writer holds wsem, the writers keep rsem closed; the other writers line up on wsem.</td></tr>
        <tr><td>Both, read first</td><td>The readers hold wsem, a writer has closed rsem; every writer lines up on wsem, one reader waits on rsem, the other readers wait on z.</td></tr>
        <tr><td>Both, write first</td><td>A writer holds wsem, the writers keep rsem closed; writers line up on wsem, one reader waits on rsem, the other readers wait on z.</td></tr></table>
      <p>Readers already inside when a writer arrives finish normally; the last one out hands wsem to the writer. The price: a stream of writers can keep readers waiting.</p>
      <h3>4. Solution 3: message passing</h3>
      <p>A <b>controller process</b> owns access. Readers and writers send requests to the mailboxes <b>readrequest</b> or <b>writerequest</b>, block on their own mailbox (mbox[i]) until the controller sends them “OK”, use the data, then send a message to <b>finished</b>. The controller keeps <b>count</b>, a private variable no other process touches, which starts at 100 (any number above the largest possible number of readers):</p>
      <ul>
        <li><b>count &gt; 0</b>: no writer accepted yet (a request may sit unread in writerequest); count = 100 − readers inside. The controller serves <b>finished</b> first (count++), then <b>writerequest</b> (count −= 100), then <b>readrequest</b> (count--, send OK). Checking writers before readers gives writers priority.</li>
        <li><b>count == 0</b>: only the accepted writer is left. Send it OK, wait for its finished message, reset count to 100.</li>
        <li><b>count &lt; 0</b>: a writer is waiting for −count readers to leave. The controller receives only finished messages, adding 1 each time, until count reaches 0.</li>
      </ul>
      <p><b>Worked example.</b> Three readers inside: count = 97. A write request is accepted: 97 − 100 = −3. Three finished messages: −2, −1, 0. The writer gets OK, writes, reports finished; count = 100. Only now is a waiting read request served (count = 99).</p>
      <h3>5. Comparison</h3>
      <table><tr><th>Solution</th><th>Tools</th><th>Who can wait a long time?</th></tr>
        <tr><td>Readers priority</td><td>x, wsem, readcount</td><td>Writers (can starve)</td></tr>
        <tr><td>Writers priority</td><td>+ rsem, y, z, writecount</td><td>Readers, if writers keep coming</td></tr>
        <tr><td>Message passing</td><td>controller, 3 mailboxes, count</td><td>Readers (writers are served first)</td></tr></table>`,
  });
})();
