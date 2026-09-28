/* =====================================================================
   5.1  Mutual Exclusion: Software Approaches
   Two processes, shared memory, no special instructions, no OS help.
   Dekker's four flawed attempts, Dekker's algorithm, Peterson's algorithm.
   Helpers live in this IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {
  /* ---------------- small shared helpers ---------------- */
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TV = (b) => `<span class="tv ${b ? 'T' : 'F'}">${b ? 'true' : 'false'}</span>`;
  const TOK = (p) => `<span class="tok p${p}">P${p}</span>`;
  const PN = (p) => `<b class="c${p}">P${p}</b>`;

  /* ---------------- the six algorithms, written for process i (j = the other) ----------------
     Every line: c = code shown, k = kind (entry | cs | exit | rem | brace),
     x = plain-language "what this line does next", run(s) = effect when it executes.
     run returns { to: next line index, turn?: new turn, flag?: new value of flag[i], m: narration }. */
  const L = (c, k, x, run) => ({ c, k, x, run });
  const CSL = (i, to) => L('/* critical section */', 'cs', `P${i} is inside its critical section, using the shared data. Its next step leaves it.`, () => ({ to, m: 'finishes its critical section and leaves it' }));
  const REM = (i) => L('/* remainder section */', 'rem', `P${i} is doing unrelated work. Its next step means it wants to enter again.`, () => ({ to: 0, m: 'finishes its other work and wants to enter again' }));
  const RAISE = (i, to, x) => L(`flag[${i}] = true;`, 'entry', x || 'Raise its flag: “I want to go in.”', () => ({ to, flag: true, m: `sets flag[${i}] = true: it wants in` }));
  const LOWER = (i, to) => L(`flag[${i}] = false;`, 'exit', 'Lower its flag: “I have left.”', () => ({ to, flag: false, m: `sets flag[${i}] = false: it is out` }));
  const PROG = {
    a1: (i, j) => [
      L(`while (turn != ${i}) ;`, 'entry', `Wait until turn is ${i}. While it is ${j}, test again (busy wait).`,
        (s) => (s.turn !== i ? { to: 0, m: `reads turn = ${j}: not its turn, so it keeps waiting` } : { to: 1, m: `reads turn = ${i}: its turn, so it enters its critical section` })),
      CSL(i, 2),
      L(`turn = ${j};`, 'exit', `Hand the turn to P${j}.`, () => ({ to: 3, turn: j, m: `sets turn = ${j}: now it is P${j}’s turn` })),
      REM(i),
    ],
    a2: (i, j) => [
      L(`while (flag[${j}]) ;`, 'entry', `Look at P${j}’s flag. While it is up, keep looking (busy wait).`,
        (s) => (s.flag[j] ? { to: 0, m: `reads flag[${j}] = true, so it keeps waiting` } : { to: 1, m: `reads flag[${j}] = false, so it stops waiting (its own flag is still down)` })),
      L(`flag[${i}] = true;`, 'entry', 'Raise its own flag, then walk straight into the critical section.', () => ({ to: 2, flag: true, m: `sets flag[${i}] = true and enters its critical section` })),
      CSL(i, 3), LOWER(i, 4), REM(i),
    ],
    a3: (i, j) => [
      RAISE(i, 1, 'Raise its flag first: “I want to go in.”'),
      L(`while (flag[${j}]) ;`, 'entry', `Then look at P${j}’s flag. While it is up, keep looking (busy wait).`,
        (s) => (s.flag[j] ? { to: 1, m: `reads flag[${j}] = true, so it keeps waiting` } : { to: 2, m: `reads flag[${j}] = false, so it enters its critical section` })),
      CSL(i, 3), LOWER(i, 4), REM(i),
    ],
    a4: (i, j) => [
      RAISE(i, 1),
      L(`while (flag[${j}]) {`, 'entry', `Does P${j} want in too? If so, run the polite back-off loop. If not, enter.`,
        (s) => (s.flag[j] ? { to: 2, m: `reads flag[${j}] = true, so it starts to back off` } : { to: 6, m: `reads flag[${j}] = false, so it enters its critical section` })),
      L(`    flag[${i}] = false;`, 'entry', `Politely lower its flag to let P${j} go first.`, () => ({ to: 3, flag: false, m: `sets flag[${i}] = false: it steps back` })),
      L('    /* delay */', 'entry', 'Wait a moment before trying again.', () => ({ to: 4, m: 'waits a moment' })),
      L(`    flag[${i}] = true;`, 'entry', `Raise its flag again, then re-check P${j}’s flag.`, () => ({ to: 1, flag: true, m: `sets flag[${i}] = true again: it asks once more` })),
      L('}', 'brace'),
      CSL(i, 7), LOWER(i, 8), REM(i),
    ],
    dk: (i, j) => [
      RAISE(i, 1),
      L(`while (flag[${j}]) {`, 'entry', `Does P${j} want in too? If not, enter. If so, settle the tie below.`,
        (s) => (s.flag[j] ? { to: 2, m: `reads flag[${j}] = true: both want in` } : { to: 8, m: `reads flag[${j}] = false, so it enters its critical section` })),
      L(`    if (turn == ${j}) {`, 'entry', `Whose tie is it? If turn is ${j}, P${i} must back off. If not, it keeps checking.`,
        (s) => (s.turn === j ? { to: 3, m: `reads turn = ${j}: the tie is P${j}’s, so it must back off` } : { to: 1, m: `reads turn = ${i}: the tie is its own, so it re-checks flag[${j}]` })),
      L(`        flag[${i}] = false;`, 'entry', `Lower its flag so that P${j} can go in.`, () => ({ to: 4, flag: false, m: `sets flag[${i}] = false: it steps back` })),
      L(`        while (turn == ${j}) ;`, 'entry', `Wait until P${j} hands over the turn (busy wait).`,
        (s) => (s.turn === j ? { to: 4, m: `reads turn = ${j}, so it keeps waiting` } : { to: 5, m: `reads turn = ${i}: its turn has come` })),
      L(`        flag[${i}] = true;`, 'entry', `Raise its flag again, then re-check P${j}’s flag.`, () => ({ to: 1, flag: true, m: `sets flag[${i}] = true again` })),
      L('    }', 'brace'), L('}', 'brace'),
      CSL(i, 9),
      L(`turn = ${j};`, 'exit', `Give the next tie to P${j}.`, () => ({ to: 10, turn: j, m: `sets turn = ${j}: the next tie goes to P${j}` })),
      LOWER(i, 11), REM(i),
    ],
    pt: (i, j) => [
      RAISE(i, 1),
      L(`turn = ${j};`, 'entry', `Politely give the turn away: “P${j}, you go first.”`, () => ({ to: 2, turn: j, m: `sets turn = ${j}: it lets P${j} go first` })),
      L(`while (flag[${j}] && turn == ${j}) ;`, 'entry', `Wait only while P${j} wants in AND the turn is P${j}’s.`,
        (s) => (s.flag[j] && s.turn === j ? { to: 2, m: `reads flag[${j}] = true and turn = ${j}, so it keeps waiting` }
          : { to: 3, m: s.flag[j] ? `reads turn = ${i}, so it enters its critical section` : `reads flag[${j}] = false, so it enters its critical section` })),
      CSL(i, 4), LOWER(i, 5), REM(i),
    ],
  };
  const ALGOS = [
    { id: 'a1', label: 'Attempt 1', name: 'Attempt 1: one turn variable', turn: true, flag: false, turn0: 0 },
    { id: 'a2', label: 'Attempt 2', name: 'Attempt 2: look, then raise your flag', turn: false, flag: true, turn0: 0 },
    { id: 'a3', label: 'Attempt 3', name: 'Attempt 3: raise your flag, then look', turn: false, flag: true, turn0: 0 },
    { id: 'a4', label: 'Attempt 4', name: 'Attempt 4: flag plus polite back-off', turn: false, flag: true, turn0: 0 },
    { id: 'dk', label: 'Dekker', name: 'Dekker’s algorithm', turn: true, flag: true, turn0: 1 },
    { id: 'pt', label: 'Peterson', name: 'Peterson’s algorithm', turn: true, flag: true, turn0: 0 },
  ];
  const ALGO = Object.fromEntries(ALGOS.map((a) => [a.id, a]));
  const progsOf = (id) => [PROG[id](0, 1), PROG[id](1, 0)];
  const fresh = (id) => ({ pc: [0, 0], turn: ALGO[id].turn0, flag: [false, false], halted: [false, false] });
  const skey = (s) => `${s.pc[0]}.${s.pc[1]}.${s.turn}.${+s.flag[0]}${+s.flag[1]}.${+s.halted[0]}${+s.halted[1]}`;
  function exec(P, s, p) {
    const r = P[p][s.pc[p]].run(s);
    const n = { pc: s.pc.slice(), turn: s.turn, flag: s.flag.slice(), halted: s.halted.slice() };
    n.pc[p] = r.to;
    if (r.turn !== undefined) n.turn = r.turn;
    if (r.flag !== undefined) n.flag[p] = r.flag;
    return { n, m: r.m };
  }
  /* Could any process in `who` still reach its critical section, under SOME future schedule?
     The state space is tiny (at most a few hundred states), so a breadth-first search is instant. */
  function canEnter(P, s0, who) {
    const seen = new Set([skey(s0)]);
    const q = [s0];
    while (q.length) {
      const s = q.shift();
      if (who.some((p) => P[p][s.pc[p]].k === 'cs')) return true;
      for (const p of [0, 1]) {
        if (s.halted[p]) continue;
        const { n } = exec(P, s, p);
        const k = skey(n);
        if (!seen.has(k)) { seen.add(k); q.push(n); }
      }
    }
    return false;
  }

  /* ---------------- the interleaving lab: two code panels, shared memory, a verdict ----------------
     Used by the free lab step and the challenge step. The student (or a replay) is the scheduler. */
  function makeLab(ctx, o) {
    const { h } = ctx;
    let id = o.algo || 'a1';
    let P = progsOf(id);
    let st, hk, hw, log, cnt, last, status, replaying = false, replayTok = 0, demo = false;
    const undo = [];
    const mkCell = (nm) => { const v = h('div', { class: 'v' }); return { el: h('div', { class: 'cell' }, h('div', { class: 'nm' }, nm), v), v, prev: null }; };
    const cells = [mkCell('turn'), mkCell('flag[0]'), mkCell('flag[1]')];
    const room = h('div', { class: 'room' });
    const mem = h('div', { class: 'stack gap-s' }, h('h4', { class: 'm0 center' }, 'Shared memory'), ...cells.map((c) => c.el), room);
    const panels = [0, 1].map((p) => {
      const chip = h('span', { class: 'chip' });
      const btn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => stepBy(p) }, `Step P${p}`);
      const halt = h('button', { class: 'btn sm ghost', type: 'button', title: `Make P${p} stop for good, as if it crashed right here`, onclick: () => haltP(p) }, 'Halt');
      const codeBox = h('div', {});
      const next = h('div', { class: 'pp-next' });
      const el = h('div', { class: `card white ppanel p${p}` }, h('div', { class: 'pp-head' }, h('span', { class: `tok p${p}` }, `P${p}`), chip, h('span', { class: 'grow' }), halt, btn), codeBox, next);
      return { el, chip, btn, halt, codeBox, next, pre: null };
    });
    const grid = h('div', { class: 'grid-3 labgrid' }, panels[0].el, mem, panels[1].el);
    const verdict = h('div', { class: 'verdict' });
    const logEl = h('div', { class: 'log grow' });
    const stats = h('div', { class: 'small' });
    const undoBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => undoStep() }, 'Undo');
    const resetBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { stopReplay(); reset(); } }, 'Reset');

    function buildCode() {
      panels.forEach((pn, p) => {
        pn.pre = ctx.ui.code(P[p].map((l) => l.c).join('\n'), { lang: 'c', fontSize: 13 });
        pn.codeBox.replaceChildren(pn.pre);
      });
    }
    function snap() { undo.push(JSON.stringify({ st, hk, hw, log, cnt, last })); if (undo.length > 300) undo.shift(); }
    function reset() {
      st = fresh(id); hk = [skey(st)]; hw = []; log = []; cnt = { e: [0, 0], s: [0, 0], n: 0 }; last = null; undo.length = 0; demo = false;
      cells.forEach((c) => (c.prev = null));
      paint();
    }
    function undoStep() {
      if (!undo.length || replaying) return;
      demo = false;
      ({ st, hk, hw, log, cnt, last } = JSON.parse(undo.pop()));
      paint();
    }
    function stepBy(p, auto) {
      if ((replaying && !auto) || st.halted[p]) return;
      if (!auto) demo = false;
      snap();
      const ln = P[p][st.pc[p]];
      const { n, m } = exec(P, st, p);
      const k = skey(n);
      const changed = k !== skey(st);
      const entered = P[p][n.pc[p]].k === 'cs' && ln.k !== 'cs';
      // a wasted "spin": a test in the entry protocol that changed no shared variable and looped back
      // (or stayed put) instead of moving forward; this also catches Dekker's tie-holder re-checking flag[j]
      const spin = ln.k === 'entry' && P[p][n.pc[p]].k === 'entry' && n.pc[p] <= st.pc[p] && n.turn === st.turn && n.flag[0] === st.flag[0] && n.flag[1] === st.flag[1];
      cnt.n++;
      if (spin) cnt.s[p]++;
      if (entered) cnt.e[p]++;
      st = n;
      last = { p, c: ln.c.trim(), m, spin, entered, cyc: 0 };
      if (entered) { hk = [k]; hw = []; } else {
        // livelock check: have we come back to an earlier state, with BOTH processes changing things on the way?
        const at = hk.lastIndexOf(k);
        const w = hw.concat([{ p, ch: changed }]);
        if (at >= 0) {
          const seg = w.slice(at);
          if (seg.some((x) => x.p === 0 && x.ch) && seg.some((x) => x.p === 1 && x.ch)) last.cyc = seg.length;
        }
        hk.push(k); hw = w;
      }
      log.push({ n: cnt.n, p, c: ln.c.trim(), spin });
      paint();
    }
    function haltP(p, auto) {
      if ((replaying && !auto) || st.halted[p]) return;
      if (!auto) demo = false;
      snap();
      st = JSON.parse(JSON.stringify(st));
      st.halted[p] = true;
      hk = [skey(st)]; hw = [];
      last = { p, halt: true };
      log.push({ n: cnt.n, p, c: 'HALTED', halt: true });
      paint();
    }
    function assess() {
      const k = (p) => P[p][st.pc[p]].k;
      const inCS = [0, 1].filter((p) => k(p) === 'cs');
      if (!last) return { lv: 'ok', ev: 'start', head: 'Your move', text: 'Both processes want to enter. Press <b>Step P0</b> or <b>Step P1</b> (or the keys 0 and 1) to run the highlighted line of that process.' };
      if (inCS.length === 2) return { lv: 'bad', ev: 'violation', head: 'Mutual exclusion violated', text: 'P0 and P1 are both inside their critical sections at once. Any shared data they touch can now be corrupted.' };
      if (st.halted[0] && st.halted[1]) return { lv: 'info', ev: 'halted', head: 'Both halted', text: 'Nothing can run any more. Press Reset (or Undo).' };
      const waiting = [0, 1].filter((p) => !st.halted[p] && k(p) === 'entry');
      if (waiting.length && !canEnter(P, st, waiting)) {
        const q = st.halted[0] ? 0 : st.halted[1] ? 1 : -1;
        if (q >= 0) {
          const where = { cs: 'inside its critical section', rem: 'in its remainder section, outside its critical section', exit: 'in its exit protocol', entry: 'in its entry protocol' }[k(q)];
          return { lv: 'bad', ev: k(q) === 'rem' ? 'blocked' : 'blocked-in', head: 'Blocked forever', text: `P${q} halted ${where}. P${1 - q} is waiting for a change that only P${q} could make, so no schedule can ever let it in.` };
        }
        if (waiting.length === 2) return { lv: 'bad', ev: 'deadlock', head: 'Deadlock', text: 'Both processes are waiting, and no future order of steps can ever let either one in. Each waits for the other to lower its flag.' };
      }
      if (last.cyc) return { lv: 'warn', ev: 'livelock', head: 'Livelock pattern', text: `Everything is exactly as it was ${last.cyc} steps ago, and nobody got in. Keep this rhythm and it repeats forever; let one process run ahead and it breaks.` };
      if (last.spin) {
        const q = 1 - last.p;
        if (!st.halted[q] && k(q) === 'rem' && !inCS.length) return { lv: 'warn', ev: 'alternation', head: 'Forced alternation', text: `The critical section is empty and P${q} is not even trying to enter, yet P${last.p} must wait because the turn belongs to P${q}.` };
        return { lv: 'info', ev: 'spin', head: 'Busy waiting', text: `P${last.p} tested again and must keep looping. No shared variable changed, so that CPU step was wasted.` };
      }
      if (inCS.length) {
        const q = 1 - inCS[0];
        const extra = st.halted[q] && k(q) === 'rem' ? ` P${q} halted outside its critical section, yet P${inCS[0]} still got in.` : '';
        return { lv: 'ok', ev: 'enter', head: `P${inCS[0]} is in its critical section`, text: `It is alone there, so mutual exclusion holds.${extra}` };
      }
      return { lv: 'ok', ev: 'ok', head: 'No problem yet', text: 'Nobody is in a critical section. Choose who runs next.' };
    }
    function setCell(c, v) {
      c.el.classList.toggle('off', v === null);
      if (v === null) { c.v.className = 'v'; c.v.textContent = 'not used'; c.prev = null; return; }
      const txt = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
      c.v.className = 'v' + (typeof v === 'boolean' ? (v ? ' tv T' : ' tv F') : '');
      c.v.textContent = txt;
      if (c.prev !== null && c.prev !== txt) { c.el.classList.remove('flash'); void c.el.offsetWidth; c.el.classList.add('flash'); }
      c.prev = txt;
    }
    function paint() {
      const a = assess();
      status = a;
      panels.forEach((pn, p) => {
        const kind = P[p][st.pc[p]].k;
        pn.pre.clear();
        pn.pre.mark(st.pc[p] + 1, st.halted[p] ? 'dim' : kind === 'cs' ? (a.ev === 'violation' ? 'bad' : 'ok') : 'cur');
        const spun = last && !last.halt && last.p === p && last.spin;
        const [cls, txt] = st.halted[p] ? ['bad', 'halted'] : kind === 'cs' ? ['ok', 'in critical section'] : kind === 'rem' ? ['', 'remainder section']
          : kind === 'exit' ? ['', 'exit protocol'] : spun ? ['warn', 'waiting'] : ['', 'entry protocol'];
        pn.chip.className = 'chip ' + cls;
        pn.chip.textContent = txt;
        pn.el.classList.toggle('halted', st.halted[p]);
        pn.next.innerHTML = st.halted[p] ? `<b>Halted.</b> P${p} stopped on this line and will never run again.` : `<b>Next:</b> ${P[p][st.pc[p]].x}`;
        pn.btn.disabled = st.halted[p] || replaying;
        pn.halt.disabled = st.halted[p] || replaying;
      });
      const A = ALGO[id];
      setCell(cells[0], A.turn ? st.turn : null);
      setCell(cells[1], A.flag ? st.flag[0] : null);
      setCell(cells[2], A.flag ? st.flag[1] : null);
      const inside = [0, 1].filter((p) => P[p][st.pc[p]].k === 'cs');
      room.className = 'room' + (inside.length === 2 ? ' two' : inside.length ? ' one' : '');
      room.innerHTML = `<div class="xs">Critical section</div><div class="row" style="justify-content:center;gap:6px">${inside.length ? inside.map(TOK).join('') : '<span class="small muted">empty</span>'}</div>`;
      const lastTxt = !last ? 'No steps yet: both processes are about to run their first line.'
        : last.halt ? `${PN(last.p)} was halted, as if it crashed.`
          : `Step ${cnt.n}: ${PN(last.p)} ran <code>${esc(last.c)}</code> and ${last.m}.`;
      verdict.className = 'verdict ' + a.lv;
      verdict.innerHTML = `<div class="last">${lastTxt}</div><div><b>${a.head}.</b> ${a.text}</div>`;
      stats.innerHTML = `Critical-section visits: ${PN(0)} ${cnt.e[0]} · ${PN(1)} ${cnt.e[1]}<br>Wasted spin steps: ${PN(0)} ${cnt.s[0]} · ${PN(1)} ${cnt.s[1]}<br>Total steps: ${cnt.n}`;
      logEl.innerHTML = log.length ? log.slice(-60).reverse().map((e) => e.halt ? `<div class="bad">P${e.p} halted</div>` : `<div${e.spin ? ' class="spin"' : ''}><b>${e.n}</b> ${PN(e.p)} <code>${esc(e.c)}</code>${e.spin ? ' ↻' : ''}</div>`).join('') : '<div class="muted">Steps you schedule appear here, newest first.</div>';
      undoBtn.disabled = !undo.length || replaying;
      if (o.onEvent) o.onEvent(a.ev, api);
    }
    function stopReplay() { if (replaying) { replayTok++; replaying = false; } }
    function play(seq, done) {
      stopReplay();
      reset();
      replaying = true;
      demo = true;
      paint();
      const tok = ++replayTok;
      let i = 0;
      const tick = () => {
        if (tok !== replayTok || !ctx.alive) return;
        if (i >= seq.length) { replaying = false; paint(); if (done) done(); return; }
        const a = seq[i++];
        if (a === 'h0' || a === 'h1') haltP(+a[1], true); else stepBy(a, true);
        ctx.after(o.speed || 700, tick);
      };
      ctx.after(450, tick);
    }
    function setAlgo(nid) { stopReplay(); id = nid; P = progsOf(id); buildCode(); reset(); }
    if (o.keys) {
      ctx.on(document, 'keydown', (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (e.key === '0') stepBy(0); else if (e.key === '1') stepBy(1);
      });
    }
    const api = {
      grid, verdict, logEl, stats, undoBtn, resetBtn, setAlgo, reset, play, stopReplay,
      get id() { return id; }, get cnt() { return cnt; }, get status() { return status; }, get replaying() { return replaying; }, get demo() { return demo; },
    };
    buildCode();
    reset();
    return api;
  }

  /* ---------------- fine print, tab 1: Peterson's idea for n processes (the filter algorithm) ----------------
     n = 3, levels 1..2. Each process: set (level[i] = L) → vic (victim[L] = i) → test (wait, or climb) → cs → exit → rem.
     Model-checked (dev/scratch-5.1/filtercheck.js): never two in the CS, at most n − L past level L, never stuck. */
  function filterTab(panel, ctx) {
    const { h, s } = ctx;
    const N = 3, LINE = { set: 3, vic: 4, test: 5, cs: 9, exit: 10, rem: 11 };
    const code = ctx.ui.code(`
int level[n] = {0}, victim[n]; // shared; 0 = not trying
for (L = 1; L < n; L++) {  // climb levels 1 .. n-1
    level[i] = L;          // "I have reached level L"
    victim[L] = i;         // "I am the latest one here"
    while (victim[L] == i  // wait while I am the latest
      && some other Pk has //   AND someone else is at
         level[k] >= L) ;  //   level L or above
}                          // passed level L: climb on
/* critical section */     // only one process gets here
level[i] = 0;              // back to "not trying"
/* remainder section */    // other work, then repeat`, { lang: 'c', fontSize: 13 });
    let st, last, steps;
    const reset = () => { st = { pc: ['set', 'set', 'set'], L: [1, 1, 1], level: [0, 0, 0], victim: [null, null, null], spin: [false, false, false] }; last = null; steps = 0; code.clear(); paint(); };
    const blocked = (S, i) => S.victim[S.L[i]] === i && S.level.some((v, k) => k !== i && v >= S.L[i]);
    const passed = (S, L) => S.pc.filter((p, i) => p === 'cs' || p === 'exit' || (p !== 'rem' && S.L[i] > L)).length;
    function step(i, quiet) {
      const S = st, L = S.L[i], p = S.pc[i];
      S.spin[i] = false;
      let m;
      if (p === 'set') { S.level[i] = L; S.pc[i] = 'vic'; m = `writes <code>level[${i}] = ${L}</code>: it has reached level ${L}.`; }
      else if (p === 'vic') {
        const old = S.victim[L];
        const freed = old !== null && old !== i && S.pc[old] === 'test' && S.L[old] === L;
        S.victim[L] = i; S.pc[i] = 'test';
        m = `writes <code>victim[${L}] = ${i}</code>: it is now the latest arrival at level ${L}.` + (freed ? ` That releases ${PN(old)}: it is no longer the latest, so its next test passes.` : '');
      } else if (p === 'test') {
        const others = [0, 1, 2].filter((k) => k !== i && S.level[k] >= L);
        if (blocked(S, i)) { S.spin[i] = true; m = `tests level ${L}: it is the latest arrival (<code>victim[${L}] = ${i}</code>) and ${others.map(PN).join(' and ')} ${others.length > 1 ? 'are' : 'is'} at level ${L} or above, so it must wait (busy wait).`; }
        else {
          const why = S.victim[L] !== i ? `<code>victim[${L}]</code> is P${S.victim[L]}, not P${i}` : `no other process is at level ${L} or above`;
          if (L < N - 1) { S.L[i] = L + 1; S.pc[i] = 'set'; m = `tests level ${L}: ${why}, so it passes and climbs toward level ${L + 1}.`; }
          else { S.pc[i] = 'cs'; m = `tests level ${L}: ${why}, so it passes the top level and <b>enters its critical section</b>.`; }
        }
      } else if (p === 'cs') { S.pc[i] = 'exit'; m = 'finishes its critical section.'; }
      else if (p === 'exit') { S.level[i] = 0; S.pc[i] = 'rem'; S.L[i] = 1; m = `writes <code>level[${i}] = 0</code>: it is no longer trying.`; }
      else { S.pc[i] = 'set'; m = 'finishes its other work and wants in again.'; }
      steps++;
      last = `<b>Step ${steps}</b> (line ${LINE[p]}): ${PN(i)} ${m}`;
      code.clear(); code.mark(LINE[p]);
      if (!quiet) paint();
    }
    const cells = ['level[0]', 'level[1]', 'level[2]', 'victim[1]', 'victim[2]'].map((nm) => { const v = h('div', { class: 'v' }); return { el: h('div', { class: 'cell' }, h('div', { class: 'nm' }, nm), v), v, prev: null }; });
    const NW = ctx.narrow;
    const svg = s('svg', { viewBox: NW ? '0 0 284 398' : '0 0 560 196', width: '100%', role: 'img', 'aria-label': 'Three processes climbing the levels of the filter algorithm' });
    const nar = h('div', { class: 'card tight small', style: { minHeight: '66px' } });
    const stat = h('div', { class: 'small' });
    const btns = [0, 1, 2].map((i) => h('button', { class: 'btn sm primary', type: 'button', onclick: () => step(i) }, `Step P${i}`));
    const rnd = h('button', { class: 'btn sm', type: 'button', onclick: () => { for (let k = 0; k < 5; k++) step(Math.floor(Math.random() * N), k < 4); } }, 'Random ×5');
    const rst = h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset');
    const ZX = NW ? [6, 144, 6, 144] : [6, 144, 282, 420], ZY = NW ? [0, 0, 202, 202] : [0, 0, 0, 0], ZN = ['not trying', 'level 1', 'level 2', 'critical section'], PC = ['s-proc', 's-accent', 's-thread'], PV = ['--proc', '--accent', '--thread'];
    const T = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 13 }, o), t);
    function paint() {
      const S = st;
      const vals = [S.level[0], S.level[1], S.level[2], S.victim[1], S.victim[2]];
      cells.forEach((c, k) => {
        const txt = vals[k] === null ? '–' : (k > 2 ? 'P' : '') + vals[k];
        c.v.textContent = txt;
        if (c.prev !== null && c.prev !== txt) { c.el.classList.remove('flash'); void c.el.offsetWidth; c.el.classList.add('flash'); }
        c.prev = txt;
      });
      const inCS = S.pc.filter((p) => p === 'cs').length;
      const kids = [];
      ZX.forEach((x, z) => {
        const y0 = ZY[z];
        kids.push(s('rect', { x, y: y0 + 22, width: 134, height: 172, rx: 10, class: z === 3 ? (inCS > 1 ? 's-bad' : 's-ok') : 's-panel', 'stroke-width': 1.5 }),
          T(x + 67, y0 + 15, ZN[z], { 'font-weight': 700 }));
        if (z === 1 || z === 2) kids.push(T(x + 67, y0 + 186, S.victim[z] === null ? 'latest: none yet' : `latest: P${S.victim[z]}`, { class: 's-sub' }));
      });
      const slot = [0, 0, 0, 0];
      [0, 1, 2].forEach((i) => {
        const p = S.pc[i], z = p === 'cs' || p === 'exit' ? 3 : S.level[i], y = ZY[z] + 30 + slot[z]++ * 50;
        const status = { set: `next: level = ${S.L[i]}`, vic: `next: victim[${S.L[i]}] = ${i}`, test: S.spin[i] ? 'waits ↻ (latest)' : `next: test level ${S.L[i]}`, cs: 'inside', exit: 'leaving', rem: 'remainder' }[p];
        kids.push(s('rect', { x: ZX[z] + 6, y, width: 122, height: 44, rx: 9, class: PC[i], 'stroke-width': S.spin[i] ? 1.5 : 2, 'stroke-dasharray': S.spin[i] ? '5 3' : null }),
          T(ZX[z] + 67, y + 18, 'P' + i, { 'font-weight': 800, 'font-size': 15, style: `fill:var(${PV[i]})` }),
          T(ZX[z] + 67, y + 36, status, { 'font-size': 13 }));
      });
      svg.replaceChildren(...kids);
      nar.innerHTML = last || 'All three processes want in at once. Step them in any order and watch who is held back at each level. Try: <b>Step P0, P1, P2</b>, then all three again, then keep going.';
      stat.innerHTML = `In the critical section: <b>${inCS}</b> · past level 1: <b>${passed(S, 1)}</b> (never more than 2) · past level 2: <b>${passed(S, 2)}</b> (never more than 1)`;
    }
    const left = h('div', { class: 'stack', style: { gap: '10px' } },
      h('p', { class: 'small m0', html: '<b>Idea:</b> run Peterson’s contest <i>n</i> − 1 times, like the rounds of a tournament. <code>level[i]</code> plays the flag and <code>victim[L]</code> plays <code>turn</code>: at each level, the <b>latest arrival waits</b> while anyone else is at that level or above.' }),
      code,
      h('div', { class: 'callout why small m0', 'data-label': 'Why only one gets through', html: 'Each level holds back its latest arrival, so at most <i>n</i> − L processes get past level L. With <i>n</i> = 3: at most 2 pass level 1 and at most 1 passes level 2, the last door before the critical section. No deadlock and no starvation either. With <i>n</i> = 2 there is one level, and this is exactly Peterson’s algorithm.' }));
    const right = h('div', { class: 'stack', style: { gap: '8px' } },
      h('div', { class: 'row' }, ...btns, rnd, rst),
      h('div', { class: 'cells fcells' }, ...cells.map((c) => c.el)), svg, nar, stat);
    reset();
    panel.append(h('div', { class: 'split fill' }, left, right));
  }

  /* ---------------- fine print, tab 2: what busy waiting costs ----------------
     Two CPUs: P0 spins only while P1 finishes (cs µs). One CPU: P1 was preempted inside its CS, so P0 spins its whole slice. */
  function spinTab(panel, ctx) {
    const { h, s } = ctx;
    let cpus = 2, cs = 3, test = 6, slice = 10;
    // a count of tests, rounded; eq() gives '=' or '≈' so the arithmetic shown is always honest
    const fmtN = (x) => (x >= 1e6 ? (x / 1e6).toFixed(2).replace(/\.?0+$/, '') + ' million' : Math.round(x).toLocaleString('en-US'));
    const eq = (x) => (Number.isInteger(x) ? '=' : '≈');
    const tile = (label) => { const v = h('div', { class: 'b', style: { fontSize: '24px', lineHeight: '1.2' } }); return { el: h('div', { class: 'card tight center' }, h('div', { class: 'xs muted b' }, label), v), v }; };
    const tiles = [tile('Tests wasted'), tile('CPU time wasted'), tile('P0 waits at least')];
    const svg = s('svg', { viewBox: '0 0 560 112', width: '100%', role: 'img', 'aria-label': 'Timeline of a process that busy-waits (not to scale)' });
    const cap = h('div', { class: 'card tight small', style: { minHeight: '84px' } });
    const T = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 13 }, o), t);
    const box = (x, y, w, cls, t, o = {}) => [s('rect', Object.assign({ x, y, width: w, height: 34, rx: 7, class: cls, 'stroke-width': 1.5 }, o)), T(x + w / 2, y + 22, t, { 'font-weight': 600 })];
    function draw() {
      const one = cpus === 1;
      const spinNs = one ? slice * 1e6 : cs * 1000;
      tiles[0].v.textContent = (eq(spinNs / test) === '≈' && spinNs / test < 1e6 ? '≈ ' : '') + fmtN(spinNs / test);
      tiles[1].v.textContent = one ? `${slice} ms` : `${cs} µs`;
      tiles[2].v.textContent = one ? `${slice} ms + ${cs} µs` : `${cs} µs`;
      const lane = (y, t) => T(8, y + 22, t, { 'text-anchor': 'start', 'font-weight': 800 });
      const kids = [];
      if (!one) {
        kids.push(lane(14, 'CPU A'), lane(62, 'CPU B'),
          ...box(66, 14, 240, 's-ok', `P1 finishes its CS · ${cs} µs`), ...box(310, 14, 244, 's-panel', 'P1: remainder section'),
          ...box(66, 62, 240, 's-warn', `P0 spins ↻ · ${eq(spinNs / test) === '≈' ? '≈ ' : ''}${fmtN(spinNs / test)} tests`), ...box(310, 62, 244, 's-ok', 'P0 enters its CS'),
          s('line', { x1: 308, y1: 4, x2: 308, y2: 108, class: 's-line', 'stroke-dasharray': '4 3' }));
      } else {
        kids.push(lane(14, 'CPU'), lane(62, 'P1'),
          ...box(66, 14, 330, 's-warn', `P0 spins ↻ its whole slice · ${slice} ms`), ...box(400, 14, 72, 's-ok', 'P1 CS'), ...box(476, 14, 78, 's-panel', 'later: P0'),
          ...box(66, 62, 330, 's-panel', 'P1: ready, but has no CPU to run on', { 'stroke-dasharray': '6 4' }),
          s('line', { x1: 398, y1: 4, x2: 398, y2: 108, class: 's-line', 'stroke-dasharray': '4 3' }));
      }
      svg.replaceChildren(...kids);
      cap.innerHTML = one
        ? `<b>One CPU.</b> P1 was switched out <i>inside</i> its critical section, so while P0 spins, P1 cannot run and leave. P0 burns its whole ${slice} ms time slice: ${(slice * 1e6).toLocaleString('en-US')} ns ÷ ${test} ns ${eq(spinNs / test)} <b>${fmtN(spinNs / test)}</b> useless tests. Only then does P1 get the CPU back and finish its last ${cs} µs.`
        : `<b>Two CPUs.</b> P1 keeps running on its own CPU, so P0 spins only until P1 leaves: ${cs} µs = ${(cs * 1000).toLocaleString('en-US')} ns, and ${(cs * 1000).toLocaleString('en-US')} ns ÷ ${test} ns ${eq(spinNs / test)} <b>${fmtN(spinNs / test)}</b> tests. Wasteful, but short. Now switch to one CPU.`;
      sliceSl.style.opacity = one ? '1' : '.45';
      sliceSl.input.disabled = !one;
    }
    const seg = ctx.ui.seg([{ value: 2, label: 'Two CPUs' }, { value: 1, label: 'One CPU' }], cpus, (v) => { cpus = v; draw(); });
    const csSl = ctx.ui.slider({ label: 'P1’s time left in its CS', min: 1, max: 20, value: cs, format: (v) => v + ' µs', onInput: (v) => { cs = v; draw(); } });
    const testSl = ctx.ui.slider({ label: 'Time for one test', min: 2, max: 20, value: test, format: (v) => v + ' ns', onInput: (v) => { test = v; draw(); } });
    const sliceSl = ctx.ui.slider({ label: 'P0’s time slice', min: 1, max: 20, value: slice, format: (v) => v + ' ms', onInput: (v) => { slice = v; draw(); } });
    const left = h('div', { class: 'stack', style: { gap: '10px' } },
      h('p', { class: 'small m0', html: 'To the OS a spinning process looks busy, so it keeps its CPU while doing nothing useful. How much that wastes depends on <i>where</i> the process it waits for is running.' }),
      h('div', { class: 'card tight center', html: '<div class="xs muted b">THE FORMULA</div><div><b>tests wasted</b> = time spent spinning ÷ time for one test</div><div class="small muted">Example: 3 µs ÷ 6 ns = 3,000 ns ÷ 6 ns = 500 tests</div>' }),
      h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Thinking a spinning process is idle. It is running: it uses its full share of the CPU, and on a single CPU it even delays the very process it is waiting for.' }),
      h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'Spinning is acceptable only for very short waits on a multiprocessor, where the holder is running and will leave soon (the spinlocks of Section 5.3). For longer waits the process should give up the CPU and sleep until it is woken up. That is what semaphores (Section 5.4) do.' }));
    const right = h('div', { class: 'stack', style: { gap: '8px' } },
      h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, seg, h('span', { class: 'xs muted' }, 'timeline not to scale')),
      csSl, testSl, sliceSl,
      h('div', { class: 'grid-3', style: { gap: '8px' } }, ...tiles.map((t) => t.el)), svg, cap);
    draw();
    panel.append(h('div', { class: 'split fill' }, left, right));
  }

  /* ---------------- fine print, tab 3: Peterson on hardware that reorders memory ----------------
     Frame: [P0 store buffer, P1 store buffer, [flag0, flag1, turn] in memory, P0 status, P1 status, caption]. */
  function orderTab(panel, ctx) {
    const { h } = ctx;
    const T = true, F = false, B0 = ['flag[0] = true', 'turn = 1'], B1 = ['flag[1] = true', 'turn = 0'];
    const MODES = {
      order: [
        [[], [], [F, F, 0], '', '', '<b>In-order memory.</b> P0 and P1 run on two CPUs and start Peterson’s entry code together. Every write reaches memory at once, in program order.'],
        [[], [], [T, F, 0], '', '', 'P0 writes <code>flag[0] = true</code>. Memory changes immediately.'],
        [[], [], [T, F, 1], '', '', 'P0 writes <code>turn = 1</code>.'],
        [[], [], [T, T, 1], '', '', 'P1 writes <code>flag[1] = true</code>.'],
        [[], [], [T, T, 0], '', '', 'P1 writes <code>turn = 0</code>. P1 wrote <code>turn</code> last.'],
        [[], [], [T, T, 0], 'in', '', 'P0 tests <code>flag[1] &amp;&amp; turn == 1</code>: true &amp;&amp; false, so P0 enters.'],
        [[], [], [T, T, 0], 'in', 'wait', 'P1 tests <code>flag[0] &amp;&amp; turn == 0</code>: true &amp;&amp; true, so P1 waits. <b>One inside, as Peterson promises.</b> Now pick <b>Store buffers</b>.'],
      ],
      reorder: [
        [[], [], [F, F, 0], '', '', '<b>Store buffers.</b> Same code and the same two CPUs, but each CPU parks its writes in a private <b>store buffer</b> and sends them to memory later. Its reads do not wait for them.'],
        [B0, [], [F, F, 0], '', '', 'P0 makes both writes, but they sit in P0’s buffer. Memory has not changed.'],
        [B0, B1, [F, F, 0], '', '', 'P1 does the same. Its writes sit in P1’s buffer.'],
        [B0, B1, [F, F, 0], 'in', '', 'P0 reads <code>flag[1]</code> from memory: still false. Its test fails at once, so P0 enters.'],
        [B0, B1, [F, F, 0], 'in', 'in', 'P1 reads <code>flag[0]</code> from memory: still false, so P1 enters too. <b>Both are inside: mutual exclusion is broken.</b>'],
        [[], [], [T, T, 0], 'in', 'in', 'Later the buffers drain and memory shows both flags up, but too late. Each read overtook its own process’s earlier write. Now pick <b>+ barrier</b>.'],
      ],
      fence: [
        [[], [], [F, F, 0], '', '', '<b>Store buffers + barrier.</b> Same buffers, but each process now runs a <span class="t">memory barrier</span> between its writes and its test.'],
        [B0, [], [F, F, 0], '', '', 'P0’s two writes go into its store buffer.'],
        [B0, B1, [F, F, 0], '', '', 'P1’s two writes go into its store buffer.'],
        [[], B1, [T, F, 1], 'fence', '', 'P0 reaches its barrier and may not read until its buffer has drained. Memory now holds <code>flag[0] = true</code>, <code>turn = 1</code>.'],
        [[], [], [T, T, 0], 'fence', 'fence', 'P1 reaches its barrier and drains too: <code>flag[1] = true</code>, <code>turn = 0</code>. P1 wrote <code>turn</code> last.'],
        [[], [], [T, T, 0], 'in', 'fence', 'P0 tests <code>flag[1] &amp;&amp; turn == 1</code>: true &amp;&amp; false, so P0 enters.'],
        [[], [], [T, T, 0], 'in', 'wait', 'P1 tests <code>flag[0] &amp;&amp; turn == 0</code>: true &amp;&amp; true, so P1 waits. <b>The barrier restored the order the algorithm depends on.</b>'],
      ],
    };
    let mode = 'order';
    const cpu = (p) => {
      const chip = h('span', { class: 'chip' }), buf = h('div', { class: 'sbuf' }), seen = h('div', { class: 'pp-next' });
      return { chip, buf, seen, el: h('div', { class: `card white tight ppanel p${p}` }, h('div', { class: 'pp-head' }, h('span', { class: `tok p${p}` }, `P${p}`), h('span', { class: 'grow' }), chip), h('div', { class: 'xs muted b' }, 'STORE BUFFER'), buf, seen) };
    };
    const cp = [cpu(0), cpu(1)];
    const OK = ['<code>flag[1]</code> true, <code>turn</code> 0: go in', '<code>flag[0]</code> true, <code>turn</code> 0: wait'];
    const SEEN = { order: OK, fence: OK, reorder: ['<code>flag[1]</code> false: go in', '<code>flag[0]</code> false: go in'] };
    const cells = ['flag[0]', 'flag[1]', 'turn'].map((nm) => { const v = h('div', { class: 'v' }); return { el: h('div', { class: 'cell' }, h('div', { class: 'nm' }, nm), v), v }; });
    const room = h('div', { class: 'room' });
    const player = ctx.ui.player({
      count: MODES[mode].length, interval: 2100,
      render: (i) => {
        const fr = MODES[mode][Math.min(i, MODES[mode].length - 1)];
        [0, 1].forEach((p) => {
          cp[p].buf.innerHTML = fr[p].length ? fr[p].map((w) => `<code>${w}</code>`).join('') : '<span class="xs muted">empty</span>';
          const st = fr[3 + p];
          const [cls, txt] = { in: ['ok', 'in critical section'], wait: ['warn', 'waiting ↻'], fence: ['accent', 'at the barrier'], '': ['', 'entry code'] }[st];
          cp[p].chip.className = 'chip ' + cls; cp[p].chip.textContent = txt;
          cp[p].seen.innerHTML = st === 'in' || st === 'wait' ? `<b>Its test read:</b> ${SEEN[mode][p]}` : '<b>Its test:</b> not run yet';
        });
        fr[2].forEach((v, k) => { cells[k].v.className = 'v' + (k < 2 ? (v ? ' tv T' : ' tv F') : ''); cells[k].v.textContent = String(v); });
        const inside = [0, 1].filter((p) => fr[3 + p] === 'in');
        room.className = 'room' + (inside.length === 2 ? ' two' : inside.length ? ' one' : '');
        room.innerHTML = `<div class="xs">Critical section</div><div class="row" style="justify-content:center;gap:6px">${inside.length ? inside.map(TOK).join('') : '<span class="small muted">empty</span>'}</div>`;
        return fr[5];
      },
    });
    const seg = ctx.ui.seg([{ value: 'order', label: 'In-order memory' }, { value: 'reorder', label: 'Store buffers' }, { value: 'fence', label: '+ barrier' }], mode, (v) => { mode = v; player.setCount(MODES[v].length); });
    const code = ctx.ui.code(`
flag[i] = true;       // I want in
turn = j;             // you may go first
memory_barrier();     // finish my writes before I read
while (flag[j] && turn == j)   // now it is safe to look
    ;                 //   busy wait
/* critical section */`, { lang: 'c', fontSize: 13.5 });
    const left = h('div', { class: 'stack', style: { gap: '10px' } },
      h('p', { class: 'small m0', html: 'Every algorithm here assumes each process’s reads and writes reach memory <b>in program order</b>. Real hardware breaks that promise for speed: rather than stall until a write reaches memory, a CPU parks it in a <b>store buffer</b> and lets later reads run ahead. Compilers may also reorder or cache reads and writes.' }),
      code,
      h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Trusting code because it passed every test. Hardware reordering bites only when two CPUs race on the same variables, and even then only with unlucky timing, so tests rarely catch it.' }),
      h('div', { class: 'callout tip small m0', 'data-label': 'The fix', html: 'Put a <span class="t">memory barrier</span> (fence) between the writes and the test, or use atomic variables that include one. Once special instructions are needed anyway, the simpler hardware-supported locks of Section 5.3 are the natural choice.' }));
    const right = h('div', { class: 'stack', style: { gap: '10px' } }, seg,
      h('div', { class: 'grid-3 labgrid' }, cp[0].el, h('div', { class: 'stack gap-s' }, h('h4', { class: 'm0 center' }, 'Shared memory'), ...cells.map((c) => c.el), room), cp[1].el),
      player.el);
    panel.append(h('div', { class: 'split fill' }, left, right));
  }

  Guide.section({
    id: '5.1',
    title: 'Mutual Exclusion: Software Approaches',
    short: 'Software approaches',
    summary: 'Taking turns with plain reads and writes: four flawed attempts, Dekker’s fix, and Peterson’s algorithm.',
    objectives: [
      'Describe the setting for software-only mutual exclusion: two processes, shared variables, a memory arbiter, and no special hardware or OS help.',
      'Trace each of the four flawed attempts and find the interleaving that breaks it: strict alternation, violated mutual exclusion, deadlock, livelock.',
      'Explain how Dekker’s algorithm uses a turn variable to settle ties, and why it is correct.',
      'Explain why Peterson’s algorithm guarantees mutual exclusion with no deadlock and no starvation, and how its idea extends to n processes.',
      'Estimate the cost of busy waiting, and explain why these algorithms break on hardware that reorders memory operations unless a memory barrier is added.',
    ],
    terms: [
      ['Critical section', 'A stretch of code in which a process uses a shared resource, such as shared variables, that must not be used by another process at the same moment.'],
      ['Mutual exclusion', 'The guarantee that while one process is inside its critical section, no other process is inside its critical section for the same shared resource.'],
      ['Entry protocol', 'The code a process runs just before its critical section to get permission to go in.'],
      ['Exit protocol', 'The code a process runs just after its critical section to announce that it has left, so another process may enter.'],
      ['Remainder section', 'Everything else a process does: code that does not touch the shared resource and needs no permission.'],
      ['Memory arbiter', 'Hardware that lets only one access touch a given memory location at a time, so two reads or writes of the same word happen one after the other, never blended together.'],
      ['Atomic', 'Describes an operation that happens as one indivisible step: no other process can see it half-done or slip in between its parts.'],
      ['Interleaving', 'Running several processes on one processor by switching between them, so their individual steps take turns. Each possible order of those steps is called an interleaving, and a correct solution must work for every one.'],
      ['Race condition', 'A bug in which the result depends on the exact timing or order in which processes access shared data.'],
      ['Busy waiting', 'Waiting by testing a condition over and over in a loop. The waiting process keeps using the CPU while doing no useful work. Also called spinning.'],
      ['Turn variable', 'A shared variable that holds the number of the process that has priority, that is, whose turn it is.'],
      ['Flag variable', 'A shared true/false variable that a process sets to announce that it wants to enter (or is inside) its critical section.'],
      ['Strict alternation', 'A rule that forces processes into their critical sections in a fixed order, P0, P1, P0, P1, and so on, even when one of them does not need to go in.'],
      ['Deadlock', 'A situation in which each process in a group waits for something that only another waiting process can do, so none of them can ever continue.'],
      ['Livelock', 'A situation in which processes keep running and reacting to each other, yet none makes progress. Unlike deadlock, a change in their relative timing can end it.'],
      ['Starvation', 'A situation in which a process that wants to enter waits indefinitely because others are always allowed to go ahead of it.'],
      ['Dekker’s algorithm', 'The first known correct software-only solution to mutual exclusion for two processes. It combines one flag per process with a turn variable that decides who backs off when both want in.'],
      ['Peterson’s algorithm', 'A shorter correct two-process solution: each process raises its flag, then gives the turn to the other, and waits only while the other wants in and holds the turn.'],
      ['Filter algorithm', 'Peterson’s idea extended to n processes. Each process climbs n − 1 waiting levels; at each level the latest arrival waits while any other process is at that level or higher, so at most one process gets past the top level.'],
      ['Memory barrier', 'An instruction that makes a processor finish all of its earlier memory reads and writes, so other processors can see them, before it performs any later one. Also called a fence.'],
    ],
    css: `
      .sec-5-1 .step-eyebrow, .sec-5-1 pre.code { contain: inline-size; }
      .sec-5-1 .tscroll { overflow-x: auto; contain: inline-size; }
      .sec-5-1 .hot { cursor: pointer; }
      .sec-5-1 .hot:hover rect, .sec-5-1 .hot.sel rect { stroke-width: 3.5; }
      .sec-5-1 .hot.sel rect.hbox { stroke: var(--chc); }
      .sec-5-1 .tok { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 26px; padding: 0 8px; border-radius: 999px; border: 2px solid; font-weight: 800; font-size: 14px; line-height: 1; }
      .sec-5-1 .tok.p0 { color: var(--proc); background: var(--proc-bg); border-color: var(--proc); }
      .sec-5-1 .tok.p1 { color: var(--accent); background: var(--accent-bg); border-color: var(--accent); }
      .sec-5-1 .c0 { color: var(--proc); }
      .sec-5-1 .c1 { color: var(--accent); }
      .sec-5-1 .c2 { color: var(--thread); }
      .sec-5-1 .sbuf { display: flex; flex-direction: column; gap: 4px; min-height: 58px; border: 2px dashed var(--line-2); border-radius: 8px; padding: 4px; justify-content: center; align-items: center; }
      .sec-5-1 .sbuf code { font-size: 13px; background: var(--warn-bg); color: var(--ink); }
      .sec-5-1 .log > div.spin { color: var(--muted); }
      .sec-5-1 .log > div.bad { color: var(--bad); font-weight: 700; }
      .sec-5-1 .log code { background: none; padding: 0; }
      .sec-5-1 .cell { border: 2px solid var(--mem); background: var(--mem-bg); border-radius: 10px; padding: 3px 8px; text-align: center; min-width: 0; }
      .sec-5-1 .cell .nm { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--ink-2); }
      .sec-5-1 .cell .v { font-family: var(--mono); font-size: 20px; font-weight: 800; line-height: 1.25; }
      .sec-5-1 .cell.off { opacity: .38; border-style: dashed; }
      .sec-5-1 .cell.off .v { font-size: 13px; font-weight: 600; line-height: 26px; }
      .sec-5-1 .cells { display: flex; gap: 8px; }
      .sec-5-1 .cells > .cell { flex: 1; }
      .sec-5-1 .cells.fcells { flex-wrap: wrap; }
      .sec-5-1 .cells.fcells > .cell { flex: 1 1 90px; }
      .sec-5-1 .room { border: 2px dashed var(--line-2); border-radius: 12px; padding: 6px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 76px; }
      .sec-5-1 .room .xs { font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
      .sec-5-1 .room.one { border-style: solid; border-color: var(--ok); background: var(--ok-bg); }
      .sec-5-1 .room.two { border-style: solid; border-color: var(--bad); background: var(--bad-bg); }
      .sec-5-1 .ppanel { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; }
      .sec-5-1 .ppanel.p0 { border-top: 4px solid var(--proc); }
      .sec-5-1 .ppanel.p1 { border-top: 4px solid var(--accent); }
      .sec-5-1 .ppanel.halted pre.code { opacity: .5; }
      .sec-5-1 .pp-head { display: flex; align-items: center; gap: 6px; }
      .sec-5-1 .pp-next { font-size: 13.5px; line-height: 1.4; background: var(--panel-3); border-radius: 8px; padding: 5px 8px; min-height: 48px; }
      .sec-5-1 .labgrid { grid-template-columns: minmax(0, 1fr) 146px minmax(0, 1fr); gap: 10px; }
      .sec-5-1 .verdict { border-radius: 12px; padding: 7px 12px; border: 1px solid var(--line); border-left: 5px solid var(--accent); background: var(--panel-2); font-size: 15px; line-height: 1.45; min-height: 76px; }
      .sec-5-1 .verdict.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-5-1 .verdict.info { border-left-color: var(--warn); }
      .sec-5-1 .verdict.warn { border-left-color: var(--warn); background: var(--warn-bg); }
      .sec-5-1 .verdict.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-5-1 .verdict .last { color: var(--ink-2); font-size: 14px; }
      .sec-5-1 pre.code .ln.p0 { background: color-mix(in srgb, var(--proc) 15%, transparent); border-left-color: var(--proc); }
      .sec-5-1 pre.code .ln.p1 { background: color-mix(in srgb, var(--accent) 15%, transparent); border-left-color: var(--accent); }
      .sec-5-1 pre.code .ln.p0::before { content: 'P0'; color: var(--proc); opacity: 1; font-weight: 800; }
      .sec-5-1 pre.code .ln.p1::before { content: 'P1'; color: var(--accent); opacity: 1; font-weight: 800; }
      .sec-5-1 pre.code .ln.p0.p1::before { content: 'both'; color: var(--ink); font-size: .78em; }
      .sec-5-1 .tv { font-family: var(--mono); font-weight: 800; }
      .sec-5-1 .tv.T { color: var(--ok); }
      .sec-5-1 .tv.F { color: var(--muted); }
      .sec-5-1 table.trace td { padding-top: 2px; padding-bottom: 2px; font-size: 14px; line-height: 1.3; }
      .sec-5-1 table.trace th { padding-top: 4px; padding-bottom: 4px; }
      .sec-5-1 table.trace tr.cur td { background: var(--accent-bg); }
      .sec-5-1 table.trace tr.bad td { background: var(--bad-bg); }
      .sec-5-1 table.trace tr.warn td { background: var(--warn-bg); }
      .sec-5-1 table.trace tr.future td { opacity: .0; }
      .sec-5-1 .slot { border: 2px dashed var(--line-2); border-radius: 10px; padding: 4px 6px; font-size: 13.5px; text-align: center; min-height: 52px; display: flex; flex-direction: column; justify-content: center; }
      .sec-5-1 .slot.p0 { border-style: solid; border-color: var(--proc); background: var(--proc-bg); }
      .sec-5-1 .slot.p1 { border-style: solid; border-color: var(--accent); background: var(--accent-bg); }
      .sec-5-1 table.score td { padding: 3px 5px; vertical-align: middle; }
      .sec-5-1 table.score th { font-size: 13px; line-height: 1.25; vertical-align: bottom; text-transform: none; letter-spacing: 0; text-align: center; padding: 6px 4px; }
      .sec-5-1 table.score th:first-child { text-align: left; }
      .sec-5-1 .sc-btn { width: 100%; height: 34px; border: 0; background: transparent; font-weight: 800; font-size: 18px; cursor: pointer; border-radius: 7px; color: var(--muted); }
      .sec-5-1 .sc-btn:hover { background: var(--panel-3); }
      .sec-5-1 .sc-btn.y { color: var(--ok); background: var(--ok-bg); }
      .sec-5-1 .sc-btn.n { color: var(--bad); background: var(--bad-bg); }
      .sec-5-1 .sc-btn.sel { outline: 3px solid var(--chc); outline-offset: -3px; }
      .sec-5-1 .chal-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px; }
      .sec-5-1 .chal { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 50px; text-align: left; border: 2px solid var(--line); background: var(--panel); border-radius: 10px; padding: 4px 8px; cursor: pointer; font-size: 14px; line-height: 1.25; color: var(--ink); }
      .sec-5-1 .chal:hover { border-color: var(--chc); }
      .sec-5-1 .chal.on { border-color: var(--chc); background: var(--panel-2); }
      .sec-5-1 .chal.done .n { background: var(--ok); color: var(--panel); }
      .sec-5-1 .chal .n { flex: none; width: 24px; height: 24px; border-radius: 7px; background: var(--panel-3); display: grid; place-items: center; font-weight: 800; font-size: 13px; }
    `,
    steps: [
      /* ---------------- 1. Big picture: the setting, with a clickable diagram ---------------- */
      {
        title: 'Two processes, one critical section, no locks',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack">
              <p class="lead m0">Two processes share memory. Each has a <span class="t">critical section</span>: code that touches the shared data and must never overlap with the other’s. Can they take turns using only ordinary reads and writes?</p>
              <div class="callout tip small m0" style="padding:6px 12px"><b>New to this?</b> The chapter overview’s first steps explain race conditions and critical sections; Section 5.2 gives the full principles.</div>
              <div class="card tight">
                <h4>The rules of this puzzle</h4>
                <ul class="small m0">
                  <li><b>✓</b> Processes <b>P0</b> and <b>P1</b> may read and write shared variables.</li>
                  <li><b>✓</b> A <span class="t">memory arbiter</span> lets only one access touch a memory location at a time.</li>
                  <li><b>✗</b> No special instructions (Section 5.3) and no OS help.</li>
                  <li><b>✗</b> No speed assumptions: either process may pause after any step, for any time, so every possible <span class="t">interleaving</span> must work.</li>
                </ul>
              </div>
              <div class="callout analogy small m0" data-label="Analogy">Two roommates share a bathroom with no lock and never meet. They can only move magnets on the fridge door, one person at a time, and their rule must work however fast or slow each one is.</div>
            </div>
            <div class="stack">
              <div class="card white tight bp-fig"></div>
              <div class="card bp-cap" style="min-height:132px;font-size:16px;line-height:1.5"></div>
              <p class="small muted m0">Your mission: build a correct solution in five tries, find the fatal timing for each broken try yourself, then see why Peterson’s short version works.</p>
            </div>
          </div>`,
        render(el, ctx) {
          const { s } = ctx;
          const cap = ctx.$('.bp-cap');
          const INFO = {
            p: '<b>A process (P0 or P1).</b> Each loops forever through four parts: an <span class="t">entry protocol</span> (ask for permission), its critical section, an <span class="t">exit protocol</span> (announce that it is done) and its <span class="t">remainder section</span> (everything else). Our job is to design the entry and exit protocols.',
            data: '<b>The shared data.</b> Say both processes update one bank balance. If their updates overlap, one can wipe out the other: a <span class="t">race condition</span>. So only one process may be in its critical section at a time. That rule is <span class="t">mutual exclusion</span>.',
            arb: '<b>The memory arbiter.</b> If P0 writes <code>turn = 1</code> at the same instant P1 writes <code>turn = 0</code>, one write lands first and the other second, in an order nobody can predict. The result is one of the two values, never a blend. Each single read or write is <span class="t">atomic</span>. We also assume each process’s reads and writes reach memory in the order its code lists them. That is all the hardware promises here.',
            mem: '<b>Shared memory.</b> The only way P0 and P1 can coordinate: variables that both can read and write. We will use a <span class="t" data-t="Turn variable">turn variable</span> and one <span class="t" data-t="Flag variable">flag</span> per process.',
            os: '<b>No outside help.</b> The OS will not put a waiting process to sleep for us, and no special instruction can test and set a variable in one step. A process that must wait can only loop and re-check a variable: <span class="t">busy waiting</span>.',
          };
          const groups = [];
          const pick = (k, g) => { groups.forEach((x) => x.classList.toggle('sel', x === g)); cap.innerHTML = INFO[k]; };
          const hot = (k, label, ...kids) => {
            const g = s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);
            g.addEventListener('click', () => pick(k, g));
            g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(k, g); } });
            groups.push(g);
            return g;
          };
          const T = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 14 }, o), t);
          const proc = (x, n) => {
            const parts = [['entry protocol', 's-panel'], ['critical section', 's-warn'], ['exit protocol', 's-panel'], ['remainder', 's-panel']];
            return hot('p', 'Process P' + n,
              s('rect', { x, y: 8, width: 170, height: 214, rx: 14, class: 's-proc hbox', 'stroke-width': 2 }),
              T(x + 85, 32, 'P' + n, { 'font-size': 18, 'font-weight': 800 }),
              ...parts.map(([t, c], i) => s('g', {}, s('rect', { x: x + 26, y: 44 + i * 44, width: 132, height: 30, rx: 8, class: c, 'stroke-width': 1.5 }), T(x + 92, 64 + i * 44, t, { 'font-size': 13.5, 'font-weight': 600 }))),
              ...[0, 1, 2].map((i) => s('line', { x1: x + 92, y1: 74 + i * 44, x2: x + 92, y2: 86 + i * 44, class: 's-line', 'stroke-width': 1.6, 'marker-end': 'url(#arr)' })),
              s('path', { d: `M${x + 26},${191} H${x + 14} V${59} H${x + 24}`, class: 's-line', 'stroke-width': 1.6, 'marker-end': 'url(#arr)' }));
          };
          const svg = s('svg', { viewBox: '0 0 640 282', width: '100%', role: 'img', 'aria-label': 'Two processes share data and memory through a memory arbiter' },
            proc(8, 0), proc(462, 1),
            s('line', { x1: 188, y1: 103, x2: 226, y2: 60, class: 's-muted', 'stroke-dasharray': '5 4' }),
            s('line', { x1: 452, y1: 103, x2: 414, y2: 60, class: 's-muted', 'stroke-dasharray': '5 4' }),
            hot('data', 'Shared data',
              s('rect', { x: 226, y: 12, width: 188, height: 66, rx: 12, class: 's-warn hbox', 'stroke-width': 2 }),
              T(320, 38, 'Shared data', { 'font-weight': 800, 'font-size': 15 }), T(320, 60, 'one user at a time!', { class: 's-sub', 'font-size': 13.5 })),
            s('line', { x1: 178, y1: 132, x2: 228, y2: 132, class: 's-line', 'marker-start': 'url(#arr)', 'marker-end': 'url(#arr)' }),
            s('line', { x1: 462, y1: 132, x2: 412, y2: 132, class: 's-line', 'marker-start': 'url(#arr)', 'marker-end': 'url(#arr)' }),
            T(203, 124, 'r/w', { class: 's-sub', 'font-size': 13 }), T(437, 124, 'r/w', { class: 's-sub', 'font-size': 13 }),
            hot('arb', 'Memory arbiter',
              s('rect', { x: 232, y: 116, width: 176, height: 32, rx: 8, class: 's-panel hbox', 'stroke-width': 2 }),
              T(320, 137, 'memory arbiter', { 'font-weight': 700 })),
            s('line', { x1: 320, y1: 148, x2: 320, y2: 164, class: 's-line', 'marker-end': 'url(#arr)' }),
            hot('mem', 'Shared memory',
              s('rect', { x: 226, y: 166, width: 188, height: 58, rx: 12, class: 's-mem hbox', 'stroke-width': 2 }),
              ...[['turn', 262], ['flag[0]', 320], ['flag[1]', 378]].map(([t, cx]) => s('g', {}, s('rect', { x: cx - 27, y: 180, width: 54, height: 30, rx: 6, class: 's-panel' }), T(cx, 200, t, { class: 's-monot', 'font-size': 13 })))),
            hot('os', 'No operating system help',
              s('rect', { x: 8, y: 238, width: 624, height: 38, rx: 10, class: 's-muted hbox', 'stroke-dasharray': '6 5', 'pointer-events': 'all' }),
              T(320, 262, 'Operating system help, special instructions: not available', { class: 's-sub', 'font-weight': 600 })));
          ctx.$('.bp-fig').append(svg);
          cap.innerHTML = 'Click any part of the picture: a process, the shared data, the memory arbiter, shared memory, or the dashed strip at the bottom.';
        },
      },

      /* ---------------- 2. Attempt 1: a single turn variable ---------------- */
      {
        title: 'Attempt 1: take turns with one shared variable',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const code = ctx.ui.code(`
int turn = 0;              // shared: who may go in
// code for process Pi (j is the other one)
while (true) {             // each process loops forever
    while (turn != i)      // not my turn yet?
        ;                  //   test again (busy wait)
    /* critical section */ // only turn's owner is here
    turn = j;              // give the turn away
    /* remainder */        // other work, any length
}                          // ...then want in again`, { lang: 'c', fontSize: 13.5 });
          const left = h('div', { class: 'stack' },
            h('p', { class: 'small m0', html: '<b>Idea:</b> one shared <span class="t" data-t="Turn variable">turn variable</span> names the process that may go in. Wait until it names you; on the way out, hand it to the other process. (Pi is process number i; j is the other number.)' }),
            code,
            h('div', { class: 'row', html: '<span class="chip ok">✓ mutual exclusion</span><span class="chip bad">✗ forced strict alternation</span><span class="chip bad">✗ a halted process can block the other</span>' }),
            h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Thinking a crash matters only inside the critical section. If P1 stops in its <span class="t">remainder section</span>, P0 gets one more visit, hands the turn to P1, and then waits forever.' }));

          const T = 20, CW = 23, X0 = 64;
          let r1 = 5, halt = false;
          const sim = () => {
            const R = [1, r1], ph = ['entry', 'entry'], left = [0, 0], row = [[], []], turns = [], e = [0, 0], sp = [0, 0], csAt = [[], []];
            let turn = 0;
            for (let t = 0; t < T; t++) {
              turns.push(turn);
              let nt = turn;
              for (const p of [0, 1]) {
                if (ph[p] === 'halt') { row[p].push('halt'); continue; }
                if (ph[p] === 'rem') { row[p].push('rem'); if (--left[p] === 0) ph[p] = 'entry'; continue; }
                if (turn === p) {
                  row[p].push('cs'); e[p]++; csAt[p].push(t); nt = 1 - p;
                  if (p === 1 && halt) ph[p] = 'halt'; else { ph[p] = 'rem'; left[p] = R[p]; }
                } else { row[p].push('spin'); sp[p]++; }
              }
              turn = nt;
            }
            return { row, turns, e, sp, csAt };
          };
          const svg = s('svg', { viewBox: `0 0 ${X0 + T * CW + 8} 150`, width: '100%', role: 'img', 'aria-label': 'Timeline of Attempt 1' });
          const cap = h('div', { class: 'card small', style: { minHeight: '104px' } });
          const TX = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 13 }, o), t);
          function draw() {
            const r = sim();
            const kids = [TX(10, 40, 'turn', { 'text-anchor': 'start', class: 's-monot', 'font-weight': 700 }),
              TX(10, 80, 'P0', { 'text-anchor': 'start', 'font-weight': 800, 'font-size': 16, style: 'fill:var(--proc)' }),
              TX(10, 126, 'P1', { 'text-anchor': 'start', 'font-weight': 800, 'font-size': 16, style: 'fill:var(--accent)' })];
            for (let t = 0; t < T; t++) {
              const x = X0 + t * CW;
              if (t % 5 === 0) kids.push(TX(x + CW / 2, 13, 't=' + t, { class: 's-sub' }));
              kids.push(s('rect', { x: x + 1, y: 24, width: CW - 2, height: 22, rx: 4, class: 's-mem', 'stroke-width': 1 }), TX(x + CW / 2, 40, String(r.turns[t]), { class: 's-monot', 'font-weight': 700 }));
              [0, 1].forEach((p) => {
                const kind = r.row[p][t], y = 58 + p * 46;
                const cls = { cs: 's-ok', spin: 's-warn', rem: 's-panel', halt: 's-bad' }[kind];
                kids.push(s('rect', { x: x + 1, y, width: CW - 2, height: 36, rx: 5, class: cls, 'stroke-width': 1.2 }));
                const g = { cs: 'CS', spin: '↻', halt: '✗' }[kind];
                if (g) kids.push(TX(x + CW / 2, y + 23, g, { 'font-size': kind === 'cs' ? 13 : 14, 'font-weight': 800, 'letter-spacing': kind === 'cs' ? '-0.6' : null }));
              });
            }
            svg.replaceChildren(...kids);
            const alone = Math.floor(T / 2);
            if (halt) {
              const lastP0 = r.csAt[0][r.csAt[0].length - 1];
              cap.innerHTML = `<b>P1 visited once (tick ${r.csAt[1][0]}), set turn = 0, then stopped for good in its remainder section.</b> That is outside its critical section, yet P0 got just one more visit (tick ${lastP0}), handed the turn to P1, and has spun ever since: <b>${r.sp[0]} of ${T} ticks</b> wasted, with no end. Only P1 could ever set turn back to 0.`;
            } else if (!r.sp[0]) {
              cap.innerHTML = `<b>Equal speeds:</b> each process is ready exactly when its turn arrives, so alternation costs nothing here. P0 entered ${r.e[0]} times and P1 ${r.e[1]} times, with no spinning by P0. Now drag the slider to make P1 slower.`;
            } else {
              cap.innerHTML = `<b>P0 entered ${r.e[0]} times and spun for ${r.sp[0]} of ${T} ticks.</b> Left alone it could enter ${alone} times (it needs only 1 tick of other work). Turns must strictly alternate, so the fast process is held to the slow one’s pace: P0 ${r.e[0]} visits, P1 ${r.e[1]}. This is <span class="t">strict alternation</span>.`;
            }
          }
          const slider = ctx.ui.slider({ label: 'Set P1’s remainder length', min: 1, max: 8, value: r1, format: (v) => v + (v === 1 ? ' tick' : ' ticks'), onInput: (v) => { r1 = v; draw(); } });
          const seg = ctx.ui.seg([{ value: false, label: 'P1 keeps running' }, { value: true, label: 'P1 halts after one visit' }], false, (v) => { halt = v; draw(); });
          const legend = h('div', { class: 'row xs', style: { gap: '6px', marginTop: '4px' }, html: '<span class="chip ok">CS = in critical section</span><span class="chip warn">↻ spinning (busy wait)</span><span class="chip">remainder section</span><span class="chip bad">✗ halted</span><span class="chip mem">turn at the start of each tick</span>' });
          const right = h('div', { class: 'stack' },
            h('div', { class: 'card tight stack gap-s' }, h('div', { class: 'small', html: 'Both processes want in at tick 0. P0 needs 1 tick of other work between visits. The slider sets how much P1 needs.' }), slider, seg),
            h('div', { class: 'card white tight' }, svg, legend),
            cap);
          draw();
          el.append(h('div', { class: 'split fill' }, left, right));
        },
      },

      /* ---------------- 3. Attempts 2-4: flags, predict then replay ---------------- */
      {
        title: 'Attempts 2 to 4: flags, and why the order matters',
        kind: 'predict',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const T = true, F = false;
          const HEAD = 'boolean flag[2] = {false, false}; // shared: "Pk wants in"\n// code for process Pi (j is the other one)\n';
          const CFG = [
            {
              label: 'Attempt 2: look, then flag',
              idea: '<b>Idea:</b> give each process its own <span class="t" data-t="Flag variable">flag</span>. Wait while the other’s flag is up; then raise yours and go in. Now a process that is not interested never blocks anyone.',
              code: HEAD + `while (flag[j])        // is the other one inside?
    ;                  //   yes: test again (busy wait)
flag[i] = true;        // announce: I am going in
/* critical section */ // use the shared data
flag[i] = false;       // announce: I have left
/* remainder */        // other work`,
              q: 'Can P0 and P1 ever be inside their critical sections at the same time?',
              choices: [
                { label: 'Yes, with unlucky timing', ok: true, fb: 'A process can be paused after its check but before its flag goes up. Replay it on the right.' },
                { label: 'No, the check prevents it', ok: false, fb: 'The check and the flag-raise are two separate steps, and a process can be paused between them. Replay it on the right.' },
              ],
              note: ['Upside', 'A process that halts in its remainder section leaves its flag down, so the other can still get in. Attempt 1 (one shared turn variable) could not survive that. (A halt <i>inside</i> a critical section blocks the other in every attempt; no software rule can fix that.)'],
              chips: '<span class="chip bad">✗ mutual exclusion</span><span class="chip ok">✓ no deadlock</span><span class="chip ok">✓ a halt outside the CS blocks no one</span>',
              rows: [[0, 'tests <code>flag[1]</code>: false, so it stops waiting', F, F], [1, 'tests <code>flag[0]</code>: false, so it stops waiting', F, F],
                [0, 'sets <code>flag[0] = true</code>, enters its critical section', T, F], [1, 'sets <code>flag[1] = true</code>, enters its critical section', T, T, 'bad']],
              caps: ['<b>Start:</b> both flags are false and both processes want to enter. Suppose the scheduler switches after every single step.',
                'P0 checks <code>flag[1]</code>. It is false, so P0 leaves its waiting loop. But P0 has <b>not raised its own flag yet</b>.',
                'P1 runs next and checks <code>flag[0]</code>. Still false, so P1 also leaves its loop.',
                'P0 raises its flag and walks into its critical section.',
                '<b>Both are inside.</b> P1 raises its flag and walks in too. Each process looked before the other had announced itself: the gap between looking and flagging is fatal.'],
            },
            {
              label: 'Attempt 3: flag, then look',
              idea: '<b>Idea:</b> close Attempt 2’s gap by swapping two lines. Raise your flag <i>first</i>, then wait while the other’s flag is up. Two contenders now always see each other.',
              code: HEAD + `flag[i] = true;        // first announce: I want in
while (flag[j])        // then look: do you want in?
    ;                  //   yes: test again (busy wait)
/* critical section */ // use the shared data
flag[i] = false;       // announce: I have left
/* remainder */        // other work`,
              q: 'Mutual exclusion now holds. But can both processes get stuck forever?',
              choices: [
                { label: 'Yes, both can freeze', ok: true, fb: 'If both flags go up before either process looks, each waits for the other forever. Replay it on the right.' },
                { label: 'No, one always gets in', ok: false, fb: 'If both flags go up before either process looks, each waits for the other forever. Replay it on the right.' },
              ],
              note: ['Why it is safe', 'Suppose both got in. Each raised its flag <i>before</i> looking, so whichever looked second must have seen the other’s flag up, and waited. Contradiction: two can never be inside together.'],
              chips: '<span class="chip ok">✓ mutual exclusion</span><span class="chip bad">✗ deadlock possible</span><span class="chip ok">✓ no strict alternation</span>',
              rows: [[0, 'sets <code>flag[0] = true</code>', T, F], [1, 'sets <code>flag[1] = true</code>', T, T],
                [0, 'tests <code>flag[1]</code>: true, so it keeps waiting', T, T], [1, 'tests <code>flag[0]</code>: true, so it keeps waiting', T, T],
                [0, 'tests <code>flag[1]</code>: still true…', T, T], [1, 'tests <code>flag[0]</code>: still true… forever', T, T, 'bad']],
              caps: ['<b>Start:</b> both flags are false and both processes want to enter.',
                'P0 announces first: it raises <code>flag[0]</code>.',
                'Before P0 can look, P1 raises <code>flag[1]</code>. Both flags are now up.',
                'P0 looks: P1’s flag is up, so P0 waits.',
                'P1 looks: P0’s flag is up, so P1 waits too.',
                'P0 checks again. Nothing has changed, and nothing can: the only line that lowers a flag comes after the critical section.',
                '<b><span class="t">Deadlock</span>.</b> Each waits for the other to lower its flag, and neither ever will. Safe (never two inside), but frozen forever.'],
            },
            {
              label: 'Attempt 4: flag, then back off',
              idea: '<b>Idea:</b> avoid Attempt 3’s freeze with courtesy. If the other also wants in, lower your flag for a moment to let it go first, then ask again.',
              code: HEAD + `flag[i] = true;            // I want in
while (flag[j]) {          // do you want in too?
    flag[i] = false;       //   be polite: step back
    /* delay a moment */   //   give you a chance
    flag[i] = true;        //   then ask again
}                          // re-check your flag
/* critical section */     // use the shared data
flag[i] = false;           // announce: I have left
/* remainder */            // other work`,
              q: 'When Attempt 4 goes wrong, are the two processes frozen and idle, as in a deadlock?',
              choices: [
                { label: 'Yes, frozen like Attempt 3', ok: false, fb: 'They never stop: they keep lowering and raising their flags in step. Unlikely, but possible, and a correct algorithm must survive every interleaving.' },
                { label: 'No, busy but getting nowhere', ok: true, fb: 'They keep backing off and retrying in step. Unlikely to last, but possible, and a correct algorithm must survive every interleaving.' },
              ],
              chips: '<span class="chip ok">✓ mutual exclusion</span><span class="chip ok">✓ no deadlock</span><span class="chip bad">✗ livelock possible</span>',
              echo: [1, 9],
              rows: [[0, 'sets <code>flag[0] = true</code>', T, F], [1, 'sets <code>flag[1] = true</code>', T, T],
                [0, 'tests <code>flag[1]</code>: true, so it backs off', T, T], [1, 'tests <code>flag[0]</code>: true, so it backs off', T, T],
                [0, 'sets <code>flag[0] = false</code> (steps back)', F, T], [1, 'sets <code>flag[1] = false</code> (steps back)', F, F],
                [0, 'pauses for a moment', F, F], [1, 'pauses for a moment', F, F],
                [0, 'sets <code>flag[0] = true</code> (asks again)', T, F], [1, 'sets <code>flag[1] = true</code> (asks again)', T, T]],
              caps: ['<b>Start:</b> both flags are false and both processes want in. This time the scheduler keeps them in perfect step.',
                'P0 raises its flag.', 'P1 raises its flag. Both want in, exactly the spot where Attempt 3 froze.',
                'P0 sees P1’s flag up and starts its polite back-off.', 'P1 sees P0’s flag up and does the same.',
                'P0 lowers its flag to let P1 go first…', '…and at the same moment P1 lowers its flag to let P0 go first.',
                'P0 pauses politely.', 'P1 pauses politely too.', 'P0 raises its flag to ask again.',
                'P1 raises its flag too. <b>Back to the state after step 2.</b> In this rhythm, steps 3–10 repeat forever: both stay busy, nobody gets in. That is <span class="t">livelock</span>, not deadlock: if either runs slightly ahead, it finds the other’s flag down and enters.'],
            },
          ];
          const chosen = {};
          const build = (panel, c, ci) => {
            const code = ctx.ui.code(c.code, { lang: 'c', fontSize: 13.5 });
            const fb = h('div', { class: 'small' });
            const right = h('div', { class: 'stack fill' },
              h('div', { class: 'card fill', style: { display: 'grid', placeItems: 'center', textAlign: 'center' }, html: '<div><div class="big muted">?</div><p class="muted m0">Make your prediction on the left.<br>Then replay the timing that decides it.</p></div>' }));
            const btns = c.choices.map((ch, k) => h('button', { class: 'btn sm', type: 'button', onclick: () => answer(k) }, ch.label));
            const btnRow = h('div', { class: 'row' }, ...btns);
            function answer(k) {
              chosen[ci] = k;
              const ch = c.choices[k];
              fb.innerHTML = `<b style="color:var(--${ch.ok ? 'ok' : 'bad'})">${ch.ok ? 'Correct' : 'Not quite'}</b>: you said “${ch.label}”. ${ch.fb}`;
              btnRow.innerHTML = c.chips;
              const trs = c.rows.map((r, n) => h('tr', { html: `<td class="num">${n + 1}</td><td>${PN(r[0])}</td><td>${r[1]}</td><td class="center">${TV(r[2])}</td><td class="center">${TV(r[3])}</td>` }));
              const table = h('table', { class: 'tbl compact trace' }, h('thead', { html: '<tr><th>#</th><th>Runs</th><th>What happens</th><th>flag[0]</th><th>flag[1]</th></tr>' }), h('tbody', {}, ...trs));
              const player = ctx.ui.player({
                count: c.rows.length + 1, interval: 1700,
                render: (i) => {
                  trs.forEach((tr, n) => { tr.className = n >= i ? 'future' : n === i - 1 ? (c.rows[n][4] || 'cur') : ''; });
                  if (c.echo && i === c.rows.length) c.echo.forEach((n) => (trs[n].className = 'warn'));
                  return c.caps[i];
                },
              });
              right.replaceChildren(...[h('div', { class: 'tscroll' }, table), player.el, c.note ? h('div', { class: 'callout why m0', 'data-label': c.note[0], html: c.note[1] }) : null].filter(Boolean));
            }
            panel.append(h('div', { class: 'split fill' },
              h('div', { class: 'stack' }, h('p', { class: 'small m0', html: c.idea }), code,
                h('div', { class: 'card tight stack gap-s' }, h('div', { class: 'b', html: 'Predict: ' + c.q }), btnRow, fb)),
              right));
            if (chosen[ci] !== undefined) answer(chosen[ci]);
          };
          el.append(ctx.ui.tabs(CFG.map((c, ci) => ({ label: c.label, render: (panel) => build(panel, c, ci) }))));
        },
      },

      /* ---------------- 4. Dekker's algorithm: walk through a tie ---------------- */
      {
        title: 'Dekker’s algorithm: flags plus a tiebreaker',
        kind: 'learn',
        render(el, ctx) {
          const { h } = ctx;
          const code = ctx.ui.code(`
boolean flag[2] = {false, false}; // who wants in
int turn = 1;                     // who wins a tie
// code for process Pi (j is the other one)
flag[i] = true;              // I want in
while (flag[j]) {            // do you want in too?
    if (turn == j) {         //   and the tie is yours?
        flag[i] = false;     //     then I step back
        while (turn == j)    //     and wait for the turn
            ;                //       (busy wait)
        flag[i] = true;      //     then I ask again
    }                        //   (tie is mine: keep checking)
}                            // leave once your flag is down
/* critical section */       // only one of us is here
turn = j;                    // the next tie is yours
flag[i] = false;             // I no longer want in
/* remainder section */      // other work, then repeat`, { lang: 'c', fontSize: 13 });
          const left = h('div', { class: 'stack' },
            h('p', { class: 'small m0', html: '<b>Idea:</b> keep Attempt 3’s flags (they make it safe) and add a <span class="t" data-t="Turn variable">turn variable</span> as a tiebreaker. When both flags are up, only the process <i>without</i> the turn backs off, and it waits for the turn instead of retrying blindly.' }),
            code,
            h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Reading <code>turn</code> as “who is inside”. It only matters when <i>both</i> flags are up. If the other process is not interested, you walk straight in, whatever <code>turn</code> says.' }));
          const ST = { 4: 'about to raise its flag', 5: 'checking the other’s flag', 6: 'checking whose tie it is', 7: 'about to step back', 8: 'waiting for the turn', 10: 'about to ask again', 13: 'in its critical section', 14: 'leaving: hands over the tie', 15: 'leaving: lowers its flag', 16: 'in its remainder section' };
          const T = true, F = false;
          // [line P0 runs next, line P1 runs next, flag0, flag1, turn, caption]
          const FR = [
            [4, 4, F, F, 1, '<b>Start:</b> both processes want in at once. <code>turn</code> is 1, so if they tie, P1 wins and P0 must back off.'],
            [5, 4, T, F, 1, 'P0 raises <code>flag[0]</code>.'],
            [5, 5, T, T, 1, 'P1 raises <code>flag[1]</code>. Both flags are up: exactly where Attempt 3 deadlocked. Now the tiebreaker takes over.'],
            [6, 5, T, T, 1, 'P0 sees <code>flag[1]</code> is up, so it enters the loop to settle the tie.'],
            [6, 6, T, T, 1, 'P1 sees <code>flag[0]</code> is up and does the same.'],
            [7, 6, T, T, 1, 'P0 checks <code>turn == 1</code>: true. The tie belongs to P1, so P0 must be the one to yield.'],
            [7, 5, T, T, 1, 'P1 checks <code>turn == 0</code>: false. The tie is its own, so P1 does not back off; it goes back to watching <code>flag[0]</code>.'],
            [8, 5, F, T, 1, 'P0 lowers its flag. Only one process backs off, so they cannot mirror each other forever as in Attempt 4.'],
            [8, 13, F, T, 1, 'P1 sees <code>flag[0]</code> down, leaves the loop and enters its critical section.'],
            [8, 13, F, T, 1, 'P0 is <span class="t">busy waiting</span>: <code>turn</code> is still 1, so it tests again.'],
            [8, 14, F, T, 1, 'P1 finishes its critical section.'],
            [8, 15, F, T, 0, 'P1 sets <code>turn = 0</code>: the next tie goes to P0.'],
            [8, 16, F, F, 0, 'P1 lowers its flag and goes off to its remainder section.'],
            [10, 16, F, F, 0, 'P0’s wait ends: <code>turn</code> is now 0.'],
            [5, 16, T, F, 0, 'P0 raises its flag again and goes back to check <code>flag[1]</code>.'],
            [13, 16, T, F, 0, '<b>P0 sees <code>flag[1]</code> down and enters.</b> Both got in, one at a time, and the one that backed off was handed the next tie: nobody starves.'],
          ];
          const cellH = (nm) => h('div', { class: 'cell' }, h('div', { class: 'nm' }, nm), h('div', { class: 'v' }));
          const cells = [cellH('flag[0]'), cellH('flag[1]'), cellH('turn')];
          const pc = [0, 1].map((p) => h('div', { class: 'card tight', style: { flex: '1' } }));
          const room = h('div', { class: 'room', style: { flex: '1' } });
          let prev = null;
          const player = ctx.ui.player({
            count: FR.length, interval: 1900,
            render: (i) => {
              const [l0, l1, f0, f1, t, cap] = FR[i];
              [f0, f1, t].forEach((v, k) => {
                const vEl = cells[k].lastChild;
                const txt = typeof v === 'boolean' ? String(v) : String(v);
                vEl.className = 'v' + (typeof v === 'boolean' ? (v ? ' tv T' : ' tv F') : '');
                if (prev && prev[k] !== txt) { cells[k].classList.remove('flash'); void cells[k].offsetWidth; cells[k].classList.add('flash'); }
                vEl.textContent = txt;
              });
              prev = [String(f0), String(f1), String(t)];
              for (let n = 1; n <= 16; n++) code.line(n).classList.remove('p0', 'p1');
              code.line(l0).classList.add('p0');
              code.line(l1).classList.add('p1');
              [l0, l1].forEach((l, p) => { pc[p].innerHTML = `<div class="row" style="gap:6px">${TOK(p)}<span class="small b">next: line ${l}</span></div><div class="small">${ST[l]}</div>`; });
              const inside = [l0, l1].map((l, p) => (l === 13 ? p : -1)).filter((p) => p >= 0);
              room.className = 'room' + (inside.length ? ' one' : '');
              room.style.flex = '1';
              room.innerHTML = `<div class="xs">Critical section</div><div>${inside.length ? inside.map(TOK).join('') : '<span class="small muted">empty</span>'}</div>`;
              return cap;
            },
          });
          const right = h('div', { class: 'stack' },
            h('div', { class: 'cells' }, ...cells),
            h('div', { class: 'row nw', style: { alignItems: 'stretch' } }, pc[0], room, pc[1]),
            player.el,
            h('div', { class: 'callout why small m0', 'data-label': 'Why it works', html: '<b>Safe:</b> as in Attempt 3, a process enters only after raising its flag and then seeing the other’s flag down. Both flags up? <code>turn</code> is 0 or 1, never both, so exactly one process backs off: no <span class="t">deadlock</span>. The one backing off waits for the turn instead of retrying, so no <span class="t">livelock</span>. Every exit hands the next tie to the other, so no <span class="t">starvation</span>.' }),
            h('p', { class: 'xs muted m0', html: 'Gutter marks <b class="c0">P0</b> and <b class="c1">P1</b> show the line each process runs next. <span class="t">Dekker’s algorithm</span>, by the Dutch mathematician T. J. Dekker, was published by Edsger Dijkstra in the 1960s: the first known correct software-only solution.' }));
          el.append(h('div', { class: 'split fill' }, left, right));
        },
      },

      /* ---------------- 5. Peterson's algorithm: the later writer of turn waits ---------------- */
      {
        title: 'Peterson’s algorithm: whoever writes turn last waits',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const code = ctx.ui.code(`
boolean flag[2] = {false, false}; // who wants in
int turn = 0;                     // who waits in a tie
// code for process Pi (j is the other one)
flag[i] = true;              // I want in...
turn = j;                    // ...but you may go first
while (flag[j] && turn == j) // wait while you want in
    ;                        //   AND the turn is yours
/* critical section */       // at most one of us here
flag[i] = false;             // I am out: your go
/* remainder section */      // other work, then repeat`, { lang: 'c', fontSize: 13.5 });
          const left = h('div', { class: 'stack' },
            h('p', { class: 'small m0', html: '<b>Idea:</b> <span class="t">Peterson’s algorithm</span> (1981) does the job of <span class="t">Dekker’s algorithm</span> (the first known correct software solution: flags plus a tiebreaking turn) in three lines. Raise your flag, then politely <i>give the turn away</i>, then wait only while the other wants in <i>and</i> holds the turn.' }),
            code,
            h('div', { class: 'callout why small m0', 'data-label': 'Why it works', html: '<b>Safe:</b> if both want in, the later writer of <code>turn</code> waits (schedule all six write orders yourself). <b>No deadlock:</b> both waiting would need <code>turn == 1</code> and <code>turn == 0</code> at once. <b>No starvation:</b> the winner lowers its flag on the way out, so the waiter goes in next; if the winner rushes back, it sets <code>turn</code> to the waiter’s number and waits itself. Nobody waits more than one turn.' }),
            h('p', { class: 'xs muted m0', html: 'Peterson’s idea also scales up to <i>n</i> processes (the <span class="t">filter algorithm</span>); you will operate it in the fine-print step near the end.' }));

          let seq = [];
          const tried = new Set();
          const ALL = ['0011', '0101', '0110', '1001', '1010', '1100'];
          const W = (p, k) => (k === 0 ? `flag[${p}] = true` : `turn = ${1 - p}`);
          const bt = [0, 1].map((p) => h('button', { class: 'btn sm', type: 'button', onclick: () => write(p) }));
          const again = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { seq = []; paint(); } }, 'Start over');
          const slots = h('div', { class: 'grid-4', style: { gap: '8px' } });
          const cellsEl = h('div', { class: 'cells' });
          const res = h('div', { class: 'card', style: { minHeight: '150px' } });
          const triedEl = h('div', { class: 'small' });
          const stateOf = () => {
            const f = [false, false], cnt = [0, 0];
            let turn = 0, last = null;
            for (const p of seq) { if (cnt[p] === 0) f[p] = true; else { turn = 1 - p; last = p; } cnt[p]++; }
            return { f, turn, last, cnt };
          };
          function write(p) {
            const S = stateOf();
            if (S.cnt[p] >= 2 || seq.length >= 4) return;
            seq.push(p);
            if (seq.length === 4) tried.add(seq.join(''));
            paint();
          }
          function paint() {
            const S = stateOf();
            bt.forEach((b, p) => { b.disabled = S.cnt[p] >= 2; b.innerHTML = S.cnt[p] >= 2 ? `P${p}: both writes done` : `${PN(p)} writes <code>${W(p, S.cnt[p])}</code>`; });
            const k0 = [0, 0];
            slots.replaceChildren(...[0, 1, 2, 3].map((n) => {
              if (n >= seq.length) return h('div', { class: 'slot', html: `<span class="xs muted">write ${n + 1}</span>` });
              const p = seq[n];
              const txt = W(p, k0[p]++);
              return h('div', { class: 'slot p' + p, html: `<span class="xs b c${p}">write ${n + 1} · P${p}</span><code>${txt}</code>` });
            }));
            cellsEl.innerHTML = `<div class="cell"><div class="nm">flag[0]</div><div class="v">${TV(S.f[0])}</div></div><div class="cell"><div class="nm">flag[1]</div><div class="v">${TV(S.f[1])}</div></div><div class="cell"><div class="nm">turn</div><div class="v">${S.turn}</div></div>`;
            if (seq.length < 4) {
              res.innerHTML = `<p class="small m0"><b>${seq.length} of 4 writes made.</b> Each process must raise its flag and then set <code>turn</code>. When all four writes are done, both processes run their <code>while</code> test and we see who waits.</p><p class="small muted m0 mt">Before you finish: which process do you think will wait?</p>`;
            } else {
              const w = S.last;
              const line = (p) => { const j = 1 - p, a = S.f[j], b = S.turn === j; return `<div>${PN(p)} tests <code>flag[${j}] &amp;&amp; turn == ${j}</code> → ${TV(a)} &amp;&amp; ${TV(b)} → <b style="color:var(--${a && b ? 'warn' : 'ok'})">${a && b ? 'waits' : 'enters'}</b></div>`; };
              res.innerHTML = `<div class="small">${line(0)}${line(1)}</div><p class="small m0 mt"><b>P${w} wrote <code>turn</code> last, so P${w} waits and P${1 - w} goes in.</b> Each process writes the <i>other’s</i> number, so <code>turn</code> ends up naming P${1 - w}, the rival of the later writer. And P${1 - w}’s flag must already be up, because every process raises its flag <i>before</i> it writes <code>turn</code>. So the later writer’s test is true on both counts.</p>`;
            }
            const n = ALL.filter((x) => tried.has(x)).length;
            triedEl.innerHTML = `<div class="row" style="gap:6px"><span class="b">Orders tried: ${n} of 6</span>${ALL.map((x) => `<span class="chip ${tried.has(x) ? 'ok' : ''}">${x.split('').join(' ')}</span>`).join('')}</div>`
              + (n === 6 ? '<div class="mt"><b>All six:</b> every time, exactly one process waits, and it is always the one that wrote <code>turn</code> last.</div>' : '<div class="xs muted">Each chip lists who made writes 1 to 4 (0 = P0, 1 = P1). Try them all.</div>');
          }
          const right = h('div', { class: 'stack' },
            h('p', { class: 'small m0', html: '<b>You schedule the writes.</b> Both processes want in at the same moment. Click to choose which process makes its next write (each must raise its flag before it sets <code>turn</code>).' }),
            h('div', { class: 'row' }, bt[0], bt[1], again),
            slots, cellsEl, res, triedEl);
          paint();
          el.append(h('div', { class: 'split fill' }, left, right));
        },
      },

      /* ---------------- 6. The interleaving lab: the student is the scheduler ---------------- */
      {
        title: 'Interleaving lab: you are the scheduler',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const name = h('span', { class: 'small muted' });
          const lab = makeLab(ctx, { algo: 'a2', keys: true });
          const pick = (v) => { lab.setAlgo(v); name.textContent = ALGO[v].name; };
          const seg = ctx.ui.seg(ALGOS.map((a) => ({ value: a.id, label: a.label, title: a.name })), 'a2', pick);
          name.textContent = ALGO.a2.name;
          const main = h('div', { class: 'stack', style: { gap: '10px' } },
            h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, seg, name),
            lab.grid, lab.verdict,
            h('p', { class: 'xs muted m0', html: '<b>Halt</b> = the process crashes for good on its highlighted line. <b>↻</b> in the step log = a spin: a waiting test that changed no shared variable.' }));
          const side = h('div', { class: 'stack', style: { gap: '10px' } },
            h('div', { class: 'card tight' }, h('h4', {}, 'Scoreboard'), lab.stats),
            h('div', { class: 'row' }, lab.undoBtn, lab.resetBtn),
            h('div', { class: 'card tight small', html: '<h4>Things to try</h4><ul class="m0" style="padding-left:18px"><li>Attempt 2: step P0, P1, P0, P1.</li><li>Attempt 3: raise both flags, then let both look.</li><li>Attempt 1: give each one visit, halt P1 in its remainder, run P0.</li><li>Dekker, Peterson: try anything. Can you break them?</li></ul>' }),
            h('h4', { class: 'm0' }, 'Step log'),
            lab.logEl);
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 1fr) 262px', gap: '18px' } }, main, side));
        },
      },

      /* ---------------- 7. Break-it challenges with Show-me replays ---------------- */
      {
        title: 'Break-it challenges: find the fatal interleavings',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const CH = [
            { algo: 'a2', title: 'Both inside at once', ev: 'violation', show: [0, 1, 0, 1],
              goal: 'Using <b>Attempt 2</b>, get P0 and P1 into their critical sections at the same time.',
              hint: 'Let <i>each</i> process pass its check before either one raises its flag.',
              lesson: 'Looking and announcing are two separate steps. A process can be paused between them, so both can look before either announces.' },
            { algo: 'a3', title: 'Frozen forever', ev: 'deadlock', show: [0, 1, 0, 1],
              goal: 'Using <b>Attempt 3</b>, reach a state where neither process can ever get in: a deadlock.',
              hint: 'Raise both flags before either process looks.',
              lesson: 'Announcing first makes the attempt safe, but if both announce before either looks, each waits for a flag that will never come down.' },
            { algo: 'a4', title: 'Polite forever', ev: 'livelock', show: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
              goal: 'Using <b>Attempt 4</b>, bring everything back to an earlier state, with both processes busy and nobody in: a livelock pattern.',
              hint: 'Keep them in perfect step: P0, P1, P0, P1, … for ten steps.',
              lesson: 'Backing off prevents a permanent freeze, but perfectly matched timing can repeat forever. Any small difference in speed ends it: livelock, not deadlock.' },
            { algo: 'a1', title: 'Waiting at an empty door', ev: 'alternation', show: [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
              goal: 'Using <b>Attempt 1</b>, make P0 wait while the critical section is empty and P1 sits in its remainder section.',
              hint: 'Let P0 make one full visit, then P1 one full visit, then bring P0 back and let it test.',
              lesson: 'With a single turn variable a process may enter only on its turn, so a fast process is held back by a slow or uninterested one.' },
            { algo: 'a1', title: 'Stranded by a halt', ev: 'blocked', show: [0, 0, 0, 1, 1, 1, 'h1', 0, 0, 0, 0, 0],
              goal: 'Using <b>Attempt 1</b>, halt P1 in its <i>remainder section</i> (well outside its critical section) and leave P0 blocked forever.',
              hint: 'Let P0 and then P1 make one visit each, halt P1 in its remainder section, then keep running P0.',
              lesson: 'P1 stopped outside its critical section, yet it took the turn with it. With flags instead, a halted process leaves its flag down and blocks no one.' },
            { algo: 'pt', title: 'Try to break Peterson', ev: 'fair2', show: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
              goal: 'Using <b>Peterson’s algorithm</b>, get each process into its critical section twice. On the way, try to trap both inside or freeze them. You will not manage it.',
              hint: 'Mix it up: raise both flags, then let both write <code>turn</code> in different orders.',
              lesson: 'Whatever order you choose, the later writer of <code>turn</code> waits, and a waiting process gets in as soon as the other leaves. No interleaving breaks it.' },
          ];
          const solved = new Set();
          let cur = 0, hintOn = false;
          const listEl = h('div', { class: 'chal-grid' });
          const headEl = h('h4', { class: 'm0' });
          const goalEl = h('p', { class: 'small m0' });
          const hintEl = h('p', { class: 'small m0 muted' });
          const msgEl = h('div', { class: 'small' });
          const titleEl = h('div', { class: 'small' });
          const lessonEl = h('div', { class: 'callout tip small m0' });
          const setLesson = (on) => { const c = CH[cur]; lessonEl.className = 'callout small m0 ' + (on ? 'why' : 'tip'); lessonEl.dataset.label = on ? 'What this shows' : 'How to play'; lessonEl.innerHTML = on ? c.lesson : 'Think before you click: which process should run next to cause the trouble? <b>Undo</b> backs up one step, and the coloured bar above tells you the moment you succeed. Stuck? <b>Show me</b> replays one winning schedule.'; };
          const showBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { msgEl.innerHTML = '<span class="muted">Watch the replay. Each step runs one highlighted line.</span>'; lab.play(CH[cur].show); } }, 'Show me');
          const hintBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { hintOn = true; paintDetail(); } }, 'Hint');
          const onEvent = (ev, L) => {
            const c = CH[cur];
            if (!c || L.id !== c.algo) return;
            const hit = c.ev === 'fair2' ? L.cnt.e[0] >= 2 && L.cnt.e[1] >= 2 && ev !== 'violation' : ev === c.ev;
            if (!hit) { if (!L.replaying && !solved.has(cur) && ev === 'start') setLesson(false); if (!L.replaying && !solved.has(cur)) msgEl.innerHTML = '<span class="muted">Not solved yet. Keep scheduling.</span>'; return; }
            setLesson(true);
            if (L.demo) { msgEl.innerHTML = '<b style="color:var(--ok)">That is one winning interleaving.</b> Reset, then do it yourself to claim it.'; return; }
            solved.add(cur);
            msgEl.innerHTML = c.ev === 'fair2' ? '<b style="color:var(--ok)">Solved ✓</b> Both got in twice, never together, and nobody froze.' : '<b style="color:var(--ok)">Solved ✓</b> You found the fatal interleaving yourself.';
            paintList();
          };
          const lab = makeLab(ctx, { algo: CH[0].algo, keys: true, onEvent, speed: 650 });
          function paintList() {
            headEl.textContent = `Challenges · ${solved.size} of ${CH.length} solved`;
            listEl.replaceChildren(...CH.map((c, i) => h('button', { class: 'chal' + (i === cur ? ' on' : '') + (solved.has(i) ? ' done' : ''), type: 'button', title: ALGO[c.algo].name, onclick: () => choose(i) },
              h('span', { class: 'n' }, solved.has(i) ? '✓' : String(i + 1)), h('span', { class: 'grow' }, c.title))));
          }
          function paintDetail() {
            const c = CH[cur];
            goalEl.innerHTML = `<b>Goal:</b> ${c.goal}`;
            hintEl.innerHTML = hintOn ? `<b>Hint:</b> ${c.hint}` : '';
            titleEl.innerHTML = `<b>Challenge ${cur + 1}</b> · ${ALGO[c.algo].name}`;
          }
          function choose(i) {
            cur = i; hintOn = false;
            paintList(); paintDetail();
            lab.setAlgo(CH[i].algo);
            setLesson(solved.has(i));
            msgEl.innerHTML = solved.has(i) ? '<b style="color:var(--ok)">Solved ✓</b> Try it again, or pick another challenge.' : '<span class="muted">Not solved yet. You are the scheduler.</span>';
          }
          const side = h('div', { class: 'stack', style: { gap: '10px' } },
            headEl, listEl,
            h('div', { class: 'card tight stack gap-s' }, goalEl, h('div', { class: 'row' }, showBtn, hintBtn), hintEl, msgEl));
          const main = h('div', { class: 'stack', style: { gap: '10px' } },
            h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, titleEl, h('div', { class: 'row nw' }, lab.undoBtn, lab.resetBtn)),
            lab.grid, lab.verdict, lessonEl);
          choose(0);
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: '292px minmax(0, 1fr)', gap: '18px' } }, side, main));
        },
      },

      /* ---------------- 8. Scorecard: every attempt against every requirement ---------------- */
      {
        title: 'Scorecard: which attempt passes which test?',
        kind: 'compare',
        render(el, ctx) {
          const { h } = ctx;
          const COLS = ['Mutual exclusion', 'No deadlock', 'No livelock', 'No forced alternation', 'Survives a halt in the remainder', 'No busy waiting'];
          const BW = 'Waiting is still a loop that re-tests a shared variable, burning CPU time.';
          const ROWS = [
            ['Attempt 1', 'turn only', [1, 1, 1, 0, 0, 0], [
              'Only the process named by <code>turn</code> can leave its waiting loop, and <code>turn</code> holds one value at a time.',
              '<code>turn</code> always names someone, and that process can walk straight in.',
              'Nobody backs off and retries. A waiting process simply waits for one fixed value.',
              'Visits must alternate P0, P1, P0, P1. A process that wants two visits in a row must wait for the other, however slow or uninterested it is.',
              'If P1 halts in its remainder section, P0 gets one more visit, sets <code>turn = 1</code>, and then waits forever for a hand-back that never comes.',
              'The loop <code>while (turn != i)</code> re-reads <code>turn</code> over and over.']],
            ['Attempt 2', 'look, then flag', [0, 1, 1, 1, 1, 0], [
              'Both can pass their check before either raises its flag, and then both walk in. Checking and announcing are separate steps.',
              'A process waits only while the other’s flag is up, which means the other is inside and will lower its flag on the way out.',
              'No backing off and retrying, so no endless dance.',
              'A process that is not interested keeps its flag down, so the other may enter as often as it likes.',
              'A process halted in its remainder section has its flag down, so it blocks no one.',
              BW]],
            ['Attempt 3', 'flag, then look', [1, 0, 1, 1, 1, 0], [
              'Each process raises its flag before looking, so of two contenders the one that looks second sees the other’s flag and waits.',
              'If both raise their flags before either looks, each waits forever for the other to lower its flag.',
              'When it fails it freezes (deadlock); nobody keeps retrying.',
              'An uninterested process has its flag down, so it never holds the other back.',
              'Halted in its remainder section means its flag is down.',
              BW]],
            ['Attempt 4', 'flag, then back off', [1, 1, 0, 1, 1, 0], [
              'A process enters only after seeing the other’s flag down while its own is up, just as in Attempt 3.',
              'Backing off lowers flags, so the two can never stay stuck with both flags up for good.',
              'In perfect step both back off, pause and retry together, forever. Any small change in speed breaks the pattern.',
              'An uninterested process has its flag down.',
              'Halted in its remainder section means its flag is down.',
              'The waiting and retrying loop keeps the CPU busy.']],
            ['Dekker', 'flags + tiebreak turn', [1, 1, 1, 1, 1, 0], [
              'A process enters only when it sees the other’s flag down while its own is up, so two can never be inside together.',
              'With both flags up, <code>turn</code> names exactly one process to back off, so the other gets in.',
              'Only the process without the turn backs off, and it waits for the turn to change instead of pausing and retrying, so the two cannot mirror each other.',
              'If the other process is not interested its flag is down, and you enter at once, whatever <code>turn</code> says.',
              'A process halted in its remainder section has its flag down, and <code>turn</code> matters only in a tie.',
              'The process that backs off spins on <code>turn</code>, and the outer loop spins on the flag.']],
            ['Peterson', 'flag, give turn, wait', [1, 1, 1, 1, 1, 0], [
              'If both want in, the later writer of <code>turn</code> sees the other’s flag up and the turn pointing at the other, so it waits until the other leaves.',
              'Both waiting would need <code>turn</code> to equal 0 and 1 at the same time.',
              'A waiting process just re-tests; nobody lowers and raises flags in a dance.',
              'An uninterested process has its flag down, so your test fails at once and you enter.',
              'A process halted in its remainder section has its flag down, so the other’s test fails at once. (A halt in the entry protocol, with its flag up, can still block the other, as in every flag-based algorithm.)',
              'The <code>while</code> test is simply re-run until it fails: busy waiting.']],
          ];
          const shown = new Set();
          let sel = null;
          const btns = [];
          const detail = h('div', { class: 'card white', style: { minHeight: '210px' } });
          const prog = h('div', { class: 'small b' });
          function paint() {
            btns.forEach(({ b, r, c }) => {
              const k = r + '-' + c, on = shown.has(k), ok = ROWS[r][2][c];
              b.className = 'sc-btn' + (on ? (ok ? ' y' : ' n') : '') + (sel === k ? ' sel' : '');
              b.textContent = on ? (ok ? '✓' : '✗') : '?';
            });
            prog.textContent = `Revealed ${shown.size} of 36`;
            if (!sel) { detail.innerHTML = '<h3>Predict, then click</h3><p class="small m0">Each <b>?</b> hides whether that algorithm guarantees that property. Say ✓ or ✗ to yourself, then click the cell to check and read the reason.</p>'; return; }
            const [r, c] = sel.split('-').map(Number), ok = ROWS[r][2][c];
            detail.innerHTML = `<div class="xs muted b">${ROWS[r][0].toUpperCase()} · ${COLS[c].toUpperCase()}</div><div class="big" style="color:var(--${ok ? 'ok' : 'bad'})">${ok ? '✓ yes' : '✗ no'}</div><p class="m0">${ROWS[r][3][c]}</p>`;
          }
          const table = h('table', { class: 'tbl score' },
            h('thead', {}, h('tr', {}, h('th', { style: { width: '176px' } }, 'Algorithm'), ...COLS.map((c) => h('th', {}, c)))),
            h('tbody', {}, ...ROWS.map((row, r) => h('tr', {},
              h('td', { html: `<b>${row[0]}</b><div class="xs muted">${row[1]}</div>` }),
              ...COLS.map((_, c) => {
                const b = h('button', { type: 'button', class: 'sc-btn', 'aria-label': `${row[0]}: ${COLS[c]}`, onclick: () => { shown.add(r + '-' + c); sel = r + '-' + c; paint(); } });
                btns.push({ b, r, c });
                return h('td', {}, b);
              })))));
          const left = h('div', { class: 'stack' }, h('div', { class: 'tscroll' }, table),
            h('div', { class: 'grid-2' },
              h('div', { class: 'callout why small m0', 'data-label': 'The shared cost: busy waiting', html: 'Every row fails the last column. On a single CPU spinning is pure waste: while P0 spins, the process it waits for cannot even run until P0’s time slice ends. The next step measures the cost.' }),
              h('div', { class: 'callout warn small m0', 'data-label': 'A hidden assumption', html: 'All of these assume each read and write reaches memory in program order. Modern CPUs and compilers may reorder them. The next step shows Peterson breaking, and the fix: a memory barrier.' })));
          const right = h('div', { class: 'stack' }, detail,
            h('div', { class: 'row' }, prog, h('span', { class: 'grow' }),
              h('button', { class: 'btn sm', type: 'button', onclick: () => { btns.forEach(({ r, c }) => shown.add(r + '-' + c)); paint(); } }, 'Reveal all'),
              h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { shown.clear(); sel = null; paint(); } }, 'Hide all')),
            h('div', { class: 'callout tip small m0', 'data-label': 'Spot the pattern', html: 'Read down the columns: each attempt fixed one problem and exposed another. Only Dekker’s and Peterson’s rows pass all five correctness tests, and nobody passes the last one.' }));
          paint();
          el.append(h('div', { class: 'split r fill', style: { gridTemplateColumns: 'minmax(0, 2.1fr) minmax(0, 1fr)' } }, left, right));
        },
      },

      /* ---------------- 9. Fine print: n processes, the cost of spinning, memory order ---------------- */
      {
        title: 'Going deeper: n processes, spinning, memory order',
        kind: 'explore',
        render(el, ctx) {
          const tabs = ctx.ui.tabs([
            { label: 'Peterson for <i>n</i> processes', render: (panel) => filterTab(panel, ctx) },
            { label: 'The cost of busy waiting', render: (panel) => spinTab(panel, ctx) },
            { label: 'When memory is reordered', render: (panel) => orderTab(panel, ctx) },
          ]);
          // label the whole step as optional extension material, at the right end of the tab strip
          const strip = tabs.querySelector('.tabs-strip');
          if (strip) strip.append(ctx.h('span', { class: 'grow' }), ctx.h('span', { class: 'row gap-s', style: { alignSelf: 'center' } },
            ctx.h('span', { class: 'chip accent' }, 'Going deeper (optional)'),
            ctx.h('span', { class: 'xs muted' }, 'beyond the core ideas; fine to skip on a first read')));
          el.append(tabs);
        },
      },

      /* ---------------- 10. Recap ---------------- */
      {
        title: 'Recap: eight cards to remember',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['The rules of the game', 'Only plain reads and writes of shared variables. The memory arbiter makes each single access indivisible. No special instructions, no OS help.'],
              ['Attempt 1: one turn variable', 'Safe, but visits must strictly alternate, and a process that halts, even outside its critical section, can block the other forever.'],
              ['Attempt 2: look, then flag', 'Both can pass the check before either raises its flag, so both get in. Mutual exclusion fails.'],
              ['Attempt 3: flag, then look', 'Safe, but if both raise their flags before looking, each waits forever for the other: deadlock.'],
              ['Attempt 4: flag, then back off', 'Safe and free of deadlock, but in perfect step both back off and retry forever: livelock.'],
              ['Dekker’s fix', 'Flags plus a turn variable. In a tie, only the process without the turn backs off, and it waits for the turn. Each exit gives the next tie away.'],
              ['Peterson in one line', 'Raise your flag, give the turn away, wait while the other wants in and holds the turn. The later writer of turn waits. For n processes, climb n − 1 levels; at each one the latest arrival waits.'],
              ['The fine print', 'All of them busy-wait: on one CPU a spinner can burn its whole time slice. All assume in-order memory; store buffers break Peterson unless a memory barrier is added.'],
            ], { cols: 4, height: 222 })));
        },
      },

      /* ---------------- 11. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Attempt 1 uses only <code>int turn</code>. P0 has just left its critical section (setting <code>turn = 1</code>) and wants to go straight back in, while P1 is busy in a long remainder section. What happens?',
            choices: ['P0 re-enters at once, because the critical section is empty', 'P0 must wait until P1 enters and leaves its critical section', 'P0 and P1 both end up inside their critical sections', 'P0 and P1 deadlock'],
            answer: 1,
            feedback: ['An empty critical section is not enough: P0 may enter only when <code>turn</code> is 0, and only P1 sets it back.', null, 'Attempt 1 never breaks mutual exclusion: only the process named by <code>turn</code> can pass its loop.', 'P1 is not waiting for anything, so this is not deadlock. P0 is simply stuck behind the alternation rule.'],
            why: 'Attempt 1 forces strict alternation. After P0’s visit only P1 can hand the turn back, so the fast process is held to the slow one’s pace.' },
          { q: 'Attempt 2 runs <code>while (flag[j]) ;</code> then <code>flag[i] = true;</code> then the critical section. Which interleaving puts both processes inside at once?',
            choices: ['P0 tests, P1 tests, P0 raises its flag, P1 raises its flag', 'P0 tests, P0 raises its flag, P1 tests, P1 raises its flag', 'P1 tests, P1 raises its flag, P0 tests, P0 raises its flag', 'No interleaving can do it'],
            answer: 0,
            feedback: [null, 'P1 tests after P0’s flag is up, so P1 waits. This order is safe.', 'P0 tests after P1’s flag is up, so P0 waits. This order is safe.', 'Attempt 2 does fail, because the test and the flag-raise are two separate steps.'],
            why: 'If both test before either raises its flag, both see <code>false</code> and both walk in.' },
          { type: 'tf', q: '<b>Going deeper (optional):</b> on a multiprocessor whose CPUs let a later read go ahead of an earlier write that is still waiting in a store buffer, Peterson’s algorithm with no memory barrier can let both processes into their critical sections at once.', answer: true,
            why: 'Each process’s write of its own flag can still sit in its store buffer when it reads the other’s flag from memory, so both read false and both enter. A memory barrier between the writes and the test forces the writes out to memory first.' },
          { type: 'num', q: '<b>Going deeper (optional):</b> five processes use Peterson’s idea extended to <i>n</i> processes (the filter algorithm, with levels 1 to 4). At most how many of them can be past level 3 at the same moment?',
            answer: 2, tol: 0, unit: 'processes',
            hint: 'Each level holds back its latest arrival.',
            why: 'At most <i>n</i> − L processes get past level L, so 5 − 3 = 2. Past the top level, 4, at most 5 − 4 = 1 gets through: that one is in its critical section.' },
          { type: 'match', q: 'Match each attempt with its flaw.',
            pairs: [['Attempt 1 (turn only)', 'Forces strict alternation'], ['Attempt 2 (look, then flag)', 'Both can be inside at once'], ['Attempt 3 (flag, then look)', 'Can deadlock with both flags up'], ['Attempt 4 (flag, then back off)', 'Can livelock in perfect step']],
            why: 'Each fix exposed a new problem: alternation, then broken mutual exclusion, then deadlock, then livelock. Dekker’s tiebreaker cures all four.' },
          { type: 'order', q: 'Put the parts of Peterson’s algorithm for process Pi in order.',
            items: ['<code>flag[i] = true;</code>', '<code>turn = j;</code>', '<code>while (flag[j] &amp;&amp; turn == j) ;</code>', 'critical section', '<code>flag[i] = false;</code>', 'remainder section'],
            why: 'Announce interest, give the turn away, wait only while the other wants in and holds the turn, use the resource, withdraw interest, then do other work.' },
          { q: 'Both processes run Peterson’s entry code at about the same time, and both flags are up. P0 executes <code>turn = 1</code> first; P1 executes <code>turn = 0</code> a moment later. Which process enters its critical section first?',
            choices: ['P0', 'P1', 'Neither: they deadlock', 'Both at once'],
            answer: 0,
            feedback: [null, 'P1 wrote <code>turn</code> last, leaving it 0, so P1’s test <code>flag[0] &amp;&amp; turn == 0</code> is true and P1 waits.', 'Deadlock would need <code>turn</code> to equal 0 and 1 at once.', 'Peterson’s algorithm guarantees mutual exclusion.'],
            why: 'The later writer of <code>turn</code> waits. P1 wrote last, leaving <code>turn = 0</code>, so P0’s test <code>flag[1] &amp;&amp; turn == 1</code> is false and P0 goes in.' },
          { type: 'multi', q: 'Which statements about Dekker’s algorithm are true?',
            choices: ['It uses a flag for each process plus a turn variable', 'When both flags are up, <code>turn</code> decides which process backs off', 'It needs a special test-and-set instruction', 'A process that must wait still busy-waits', 'The process that backs off just pauses and retries, as in Attempt 4'],
            answer: [0, 1, 3],
            why: 'Dekker combines flags with a turn variable as a tiebreaker and needs only ordinary reads and writes. The process that backs off waits for the turn rather than retrying blindly, but waiting is still a busy loop.' },
          { type: 'bucket', q: 'Which failure does each scenario describe?', buckets: ['Both inside', 'Deadlock', 'Livelock'],
            items: [['Both pass their checks, then both flag', 0], ['Both flags up; each waits for the other', 1], ['Flags go down and up in step, forever', 2],
              ['No schedule can ever let anyone in', 1], ['A small speed change would end it', 2]],
            why: 'Both inside means mutual exclusion is violated. Deadlock means stuck with no possible progress. Livelock means busy but going nowhere, and a change in timing can break it.' },
          { type: 'num', q: 'P0 and P1 run on two different CPUs. P0 busy-waits on a flag while P1 spends 3 more microseconds in its critical section. One test of the flag takes 6 nanoseconds. About how many times does P0 test the flag before P1 leaves?',
            answer: 500, tol: 5, unit: 'tests',
            why: '3 µs = 3,000 ns, and 3,000 ns ÷ 6 ns per test = 500 tests, every one of them wasted CPU work. On a single CPU it could be far worse: the spinner would burn its whole time slice while P1 could not run at all.' },
          { q: 'Apart from memory operations happening in program order, what must the hardware guarantee for the software algorithms in this section to work?',
            choices: ['Accesses to the same memory location happen one at a time', 'An instruction that reads and writes a variable in one indivisible step', 'The OS can put a waiting process to sleep', 'Both processes run at the same speed'],
            answer: 0,
            feedback: [null, 'That is a special hardware instruction, the topic of Section 5.3. These algorithms do without it.', 'No OS help is assumed: waiting processes spin.', 'The algorithms must work at any relative speed.'],
            why: 'The memory arbiter serializes accesses to one location, so each single read or write is atomic. Everything else is built from that, plus the assumption that reads and writes happen in program order.' },
          { type: 'tf', q: 'With Attempt 1, a process that halts in its remainder section (outside its critical section) can leave the other process blocked forever.', answer: true,
            why: 'The halted process never hands the turn back, so once the survivor gives the turn away it waits forever. With flags (Attempts 2 to 4, Dekker, Peterson), a process halted in its remainder section leaves its flag down and blocks no one.' },
        ],
      },
    ],
    notes: `
<h3>The setting: only reads and writes</h3>
<p>Two processes, <b>P0</b> and <b>P1</b>, share memory. Each loops forever through four parts: an <b>entry protocol</b> (asks for permission), its <b>critical section</b> (uses the shared data), an <b>exit protocol</b> (announces it has left) and its <b>remainder section</b> (everything else). The goal is <b>mutual exclusion</b>: never both inside their critical sections at once. Without it, overlapping updates can corrupt shared data, a <b>race condition</b>.</p>
<ul>
<li><b>Allowed:</b> ordinary reads and writes. A <b>memory arbiter</b> lets one access at a time touch a memory location, so each single read or write is <b>atomic</b> (two writes to <code>turn</code> land one after the other, in an unpredictable order, never blended). We also assume each process’s reads and writes reach memory in program order.</li>
<li><b>Not allowed:</b> special instructions (Section 5.3) or OS help. A waiting process can only loop and re-test a variable: <b>busy waiting</b> (spinning).</li>
<li><b>No speed assumptions:</b> a process may be paused after any step. One order of steps is an <b>interleaving</b>; a solution must work for all of them.</li>
</ul>
<p>We want mutual exclusion with no <b>deadlock</b> (all frozen for good), no <b>livelock</b> (all busy, none progressing), no <b>starvation</b>, no <b>strict alternation</b>, and survival of a halt in the remainder section. Section 5.2 lists the full requirements.</p>

<h4>Attempt 1: one turn variable</h4>
<pre>int turn = 0;
while (turn != i) ;      /* wait for my turn   */
/* critical section */
turn = j;                /* hand the turn over */</pre>
<p><b>Mutual exclusion holds:</b> only the process named by <code>turn</code> can leave its loop. <b>Flaw 1, strict alternation:</b> visits must go P0, P1, P0, P1, so the pace is set by the slower process. Example: P0 needs 1 tick of other work, P1 needs 5. Over 20 ticks P0 enters only 4 times and spins for 12 ticks, although on its own it could enter 10 times. <b>Flaw 2:</b> if P1 halts, even in its remainder section, P0 gets one more visit, sets <code>turn = 1</code>, and then waits forever.</p>

<h4>Attempt 2: look, then raise your flag</h4>
<pre>boolean flag[2] = {false, false};
while (flag[j]) ;            /* wait while the other is inside */
flag[i] = true;              /* announce, then go in           */
/* critical section */
flag[i] = false;</pre>
<p>An uninterested or halted process keeps its flag down and blocks no one. But <b>mutual exclusion fails</b>: P0 tests (false), P1 tests (false), P0 raises its flag and enters, P1 does the same. Looking and announcing are separate steps.</p>

<h4>Attempt 3: raise your flag, then look</h4>
<pre>flag[i] = true;              /* announce first      */
while (flag[j]) ;            /* then wait if needed */
/* critical section */
flag[i] = false;</pre>
<p><b>Mutual exclusion holds:</b> each raises its flag before looking, so of two contenders the one that looks second sees the other’s flag and waits. But <b>deadlock</b> is possible: both raise their flags, then each waits forever for the other’s to drop.</p>

<h4>Attempt 4: flag, polite back-off, retry</h4>
<pre>flag[i] = true;
while (flag[j]) {
    flag[i] = false;         /* step back          */
    /* delay a moment */
    flag[i] = true;          /* then ask again     */
}
/* critical section */
flag[i] = false;</pre>
<p>Safe and deadlock-free, but <b>livelock</b> is possible: in perfect step both raise, both see the other’s flag, both lower, pause and raise again, forever. Not deadlock: any change in relative speed lets one process find the other’s flag down and enter.</p>
<h3>Dekker’s algorithm: flags plus a tiebreaker</h3>
<pre>boolean flag[2] = {false, false};
int turn = 1;
flag[i] = true;
while (flag[j]) {            /* both want in?     */
    if (turn == j) {         /* tie is the other's */
        flag[i] = false;     /* step back         */
        while (turn == j) ;  /* wait for the turn */
        flag[i] = true;      /* ask again         */
    }
}
/* critical section */
turn = j;                    /* next tie: other   */
flag[i] = false;</pre>
<p>The first known correct software-only solution for two processes. Flags keep it safe; the <b>turn variable</b> settles ties. With <code>turn = 1</code>: both raise flags; P0 finds <code>turn == 1</code>, lowers its flag and waits on <code>turn</code>; P1 keeps checking, sees P0’s flag down and enters. On exit P1 sets <code>turn = 0</code> and lowers its flag, so P0 raises its flag again and enters.</p>
<ul>
<li><b>Mutual exclusion:</b> a process enters only after seeing the other’s flag down while its own is up.</li>
<li><b>No deadlock:</b> with both flags up, <code>turn</code> is 0 or 1, so exactly one process backs off.</li>
<li><b>No livelock:</b> only the process without the turn backs off, and it waits for the turn rather than retrying blindly.</li>
<li><b>No starvation:</b> each exit hands the next tie to the other process.</li>
<li><code>turn</code> is not “who is inside”: if the other process is not interested, you enter at once whatever <code>turn</code> says.</li>
</ul>

<h3>Peterson’s algorithm</h3>
<pre>boolean flag[2] = {false, false};
int turn = 0;
flag[i] = true;                      /* I want in           */
turn = j;                            /* but you go first    */
while (flag[j] &amp;&amp; turn == j) ;   /* you want in AND it is your turn */
/* critical section */
flag[i] = false;</pre>
<p><b>The later writer of <code>turn</code> waits.</b> Each process writes the <i>other’s</i> number, and <code>turn</code> holds one value, so it ends up naming the rival of whoever wrote last. Example: P0 writes <code>turn = 1</code>, then P1 writes <code>turn = 0</code>: P0’s test <code>flag[1] &amp;&amp; turn == 1</code> is false, so P0 enters; P1’s test is true, so P1 waits. This holds in all six orders of the four entry writes.</p>
<ul>
<li><b>Mutual exclusion:</b> if both want in, the later writer of <code>turn</code> finds the other’s flag already up (each process raises its flag before writing <code>turn</code>) and <code>turn</code> naming the other, so it waits until the other lowers its flag.</li>
<li><b>No deadlock:</b> both waiting would need <code>turn == 0</code> and <code>turn == 1</code> at once.</li>
<li><b>No starvation:</b> a winner that rushes back sets <code>turn</code> to the waiter’s number, so it waits itself; nobody waits more than one turn.</li>
<li>Simpler than Dekker’s and easier to prove.</li>
</ul>
<h3>Scorecard</h3>
<table>
<tr><th>Algorithm</th><th>Mutual exclusion</th><th>No deadlock</th><th>No livelock</th><th>No forced alternation</th><th>Survives halt in remainder</th><th>No busy waiting</th></tr>
<tr><td>Attempt 1 (turn only)</td><td>✓</td><td>✓</td><td>✓</td><td>✗</td><td>✗</td><td>✗</td></tr>
<tr><td>Attempt 2 (look, then flag)</td><td>✗</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✗</td></tr>
<tr><td>Attempt 3 (flag, then look)</td><td>✓</td><td>✗</td><td>✓</td><td>✓</td><td>✓</td><td>✗</td></tr>
<tr><td>Attempt 4 (flag, back off)</td><td>✓</td><td>✓</td><td>✗</td><td>✓</td><td>✓</td><td>✗</td></tr>
<tr><td>Dekker</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✗</td></tr>
<tr><td>Peterson</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✗</td></tr>
</table>

<h3>Going deeper (optional): the filter algorithm, Peterson for n processes</h3>
<pre>for (L = 1; L &lt; n; L++) {     /* climb levels 1 .. n-1 */
    level[i] = L;             /* like flag             */
    victim[L] = i;            /* like turn: I came last */
    while (victim[L] == i &amp;&amp; some other Pk has level[k] &gt;= L) ;
}
/* critical section */
level[i] = 0;</pre>
<p>Each level is a Peterson-style contest: the <b>latest arrival</b> (<code>victim[L]</code>) waits while anyone else is at that level or above; a newer arrival releases it. So at most <i>n</i> − L processes get past level L. Example with <i>n</i> = 5: at most 2 get past level 3, and at most 1 past level 4, the last door before the critical section. With <i>n</i> = 2 it is exactly Peterson’s algorithm. It is free of deadlock and starvation, but a process may wait at every level.</p>

<h3>Going deeper (optional): costs and hidden assumptions</h3>
<ul>
<li><b>Busy waiting wastes CPU time:</b> tests wasted = time spinning ÷ time per test. On <b>two CPUs</b> the spinner waits only until the holder leaves: 3 µs in the critical section at 6 ns per test = 3,000 ÷ 6 = 500 useless tests. On <b>one CPU</b> it is far worse: if the holder was switched out inside its critical section, it cannot run while the spinner spins, so the spinner burns its whole time slice (10 ms at 6 ns per test ≈ 1.67 million tests). Short spins are acceptable on multiprocessors; longer waits should block (sleep), as semaphores do (Section 5.4).</li>
<li><b>In-order memory is assumed.</b> Real CPUs park writes in a <b>store buffer</b> and let later reads go first; compilers may also reorder. Then in Peterson both processes can write their flags into their buffers, read the other’s flag from memory as false, and both enter. The fix is a <b>memory barrier</b> (fence) between the writes and the test, which forces earlier writes out before any later read, or atomic variables that include one.</li>
<li><b>A halt inside the critical section</b> (or with a flag up) blocks the other process in every algorithm here; no software rule can prevent that.</li>
</ul>`,
  });
})();
