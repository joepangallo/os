/* =====================================================================
   5.2  Principles of Concurrency
   Unpredictable relative speed, the echo race, race conditions, the OS's
   four concerns, the three degrees of process awareness, competition and
   cooperation, and the six requirements for mutual exclusion.
   Helpers live in this IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {
  /* ---------------- small shared helpers ---------------- */
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // P1 is teal (process colour), P2 is indigo (accent), P3 is pink: the same convention as 5.1
  const PN = (n) => `<b class="pc${n}">P${n}</b>`;
  const CH = (c, n) => `<span class="chr pc${n}">${esc(c)}</span>`;

  /* ---------------- echo lab: machine picture (keyboard → shared chin/chout → screen) ----------------
     st = { pc:[_,p1,p2], chin, chout, screen:[chars], running, last:{line,p} }, mode 1 = one CPU, 2 = two CPUs */
  const KEY = [null, 'x', 'y'];
  const OWN = (c) => (c === 'x' ? 1 : c === 'y' ? 2 : 0);          // whose user typed this character
  const VAR = (n) => (n === 1 ? '--proc' : '--accent');
  const PCOL = [null, '--proc', '--accent', '--thread'];            // colour variable for P1, P2, P3
  function echoMachine(s) {
    const svg = s('svg', { viewBox: '0 0 480 262', width: '100%', role: 'img', 'aria-label': 'Keyboard, shared variables chin and chout, and the screen' });
    const T = (x, y, str, o = {}) => s('text', Object.assign({ x, y, 'font-size': 14, 'font-weight': 700 }, o), str);
    function valText(x, y, c) {
      return c == null ? T(x, y, 'empty', { 'text-anchor': 'middle', 'font-size': 14, class: 's-sub', 'font-weight': 600 })
        : T(x, y, c, { 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 800, class: 's-monot', style: `fill:var(${VAR(OWN(c))})` });
    }
    function draw(st, mode) {
      const k = [];
      // CPUs
      if (mode === 1) {
        const r = st.running;
        k.push(s('rect', { x: 150, y: 6, width: 180, height: 40, rx: 9, class: 's-cpu', 'stroke-width': 2 }));
        k.push(T(166, 31, 'CPU'), T(314, 31, r ? 'running P' + r : 'idle', { 'text-anchor': 'end', style: r ? `fill:var(${VAR(r)})` : null, class: r ? null : 's-sub' }));
      } else {
        [1, 2].forEach((p) => {
          const x = p === 1 ? 40 : 260;
          k.push(s('rect', { x, y: 6, width: 180, height: 40, rx: 9, class: 's-cpu', 'stroke-width': 2 }));
          k.push(T(x + 14, 31, 'CPU ' + p), T(x + 166, 31, 'runs P' + p, { 'text-anchor': 'end', style: `fill:var(${VAR(p)})` }));
        });
      }
      // keyboard
      k.push(s('rect', { x: 4, y: 78, width: 124, height: 124, rx: 12, class: 's-io', 'stroke-width': 2 }), T(66, 100, 'Keyboard', { 'text-anchor': 'middle' }));
      [1, 2].forEach((p) => {
        const x = p === 1 ? 20 : 72, used = st.pc[p] > 1;
        k.push(s('g', { opacity: used ? 0.35 : 1 },
          s('rect', { x, y: 114, width: 40, height: 40, rx: 8, class: 's-panel', 'stroke-width': 2, style: `stroke:var(${VAR(p)})` }),
          T(x + 20, 142, KEY[p], { 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800, class: 's-monot', style: `fill:var(${VAR(p)})` }),
          T(x + 20, 176, 'P' + p, { 'text-anchor': 'middle', 'font-size': 13, style: `fill:var(${VAR(p)})` })));
      });
      // shared memory
      k.push(s('rect', { x: 160, y: 66, width: 160, height: 192, rx: 12, class: 's-mem', 'stroke-width': 2 }), T(240, 86, 'Shared memory', { 'text-anchor': 'middle' }));
      [['chin', 96, st.chin], ['chout', 178, st.chout]].forEach(([name, y, v]) => {
        const hot = st.last && ((name === 'chin' && st.last.line === 1) || (name === 'chout' && st.last.line === 2));
        k.push(s('rect', { x: 176, y, width: 128, height: 70, rx: 9, class: 's-panel', 'stroke-width': hot ? 3 : 1.5, style: hot ? `stroke:var(${VAR(st.last.p)})` : null }));
        k.push(T(188, y + 20, name, { 'font-size': 14, class: 's-monot' }), valText(240, y + 56, v));
      });
      // screen
      k.push(s('rect', { x: 352, y: 78, width: 124, height: 124, rx: 12, class: 's-io', 'stroke-width': 2 }), T(414, 100, 'Screen', { 'text-anchor': 'middle' }));
      k.push(s('rect', { x: 364, y: 110, width: 100, height: 76, rx: 8, class: 's-panel', 'stroke-width': 1.5 }));
      st.screen.forEach((c, i) => k.push(T(390 + i * 48, 160, c, { 'text-anchor': 'middle', 'font-size': 34, 'font-weight': 800, class: 's-monot', style: `fill:var(${VAR(OWN(c))})` })));
      // arrows for the three lines of echo; the one that just ran is drawn in that process's colour
      const arr = (n, d) => {
        const on = st.last && st.last.line === n;
        const col = on ? (st.last.p === 1 ? 'proc' : 'accent') : 'muted';
        k.push(s('path', { d, class: on ? 's-line' : 's-muted', 'stroke-width': on ? 3 : 2, style: on ? `stroke:var(--${col})` : null, 'marker-end': `url(#arr-${col})`, fill: 'none' }));
      };
      arr(1, 'M128 131 L172 131');
      arr(2, 'M240 168 L240 176');
      arr(3, 'M306 213 C 330 213, 336 176, 350 160');
      svg.replaceChildren(...k);
    }
    return { svg, draw };
  }

  /* ---------------- speed-independence model (OS concern 4) ----------------
     P1 calls echo after 2.6 time units of its own work, running at speed 1: lines at 2.6, 3.6, 4.6.
     P2 does 4 units of work first, at relative speed v: its lines are planned at 4/v, 5/v, 6/v.
     With protect on, a caller that arrives while the other is inside echo waits until that one
     has finished line 3 (plus a small hand-over gap), and its later lines shift by the same amount. */
  function speedRun(v, protect) {
    const plan = { 1: [2.6, 3.6, 4.6], 2: [4 / v, 5 / v, 6 / v] };
    const idx = { 1: 0, 2: 0 }, shift = { 1: 0, 2: 0 }, waitFrom = { 1: null, 2: null };
    const mem = { chin: null, chout: null }, out = [], ev = [], shown = { 1: null, 2: null };
    const at = (p) => plan[p][idx[p]] + shift[p];
    for (let guard = 0; guard < 20 && (idx[1] < 3 || idx[2] < 3); guard++) {
      const ps = [1, 2].filter((p) => idx[p] < 3).sort((a, b) => at(a) - at(b) || a - b);
      const p = ps[0], o = 3 - p;
      if (protect && idx[p] === 0 && idx[o] > 0 && idx[o] < 3) {        // the other one is inside echo: wait
        waitFrom[p] = at(p);
        shift[p] = plan[o][2] + shift[o] + 0.3 - plan[p][0];
        continue;
      }
      const line = idx[p] + 1, t = at(p);
      if (line === 1) mem.chin = KEY[p];
      if (line === 2) mem.chout = mem.chin;
      if (line === 3) { out.push(mem.chout); shown[p] = mem.chout; }
      ev.push({ p, line, t });
      idx[p]++;
    }
    // correct = each process displayed the key its own user typed (the screen order may still vary)
    return { ev, out, shown, ok: shown[1] === 'x' && shown[2] === 'y', waitFrom, end: Math.max(...ev.map((e) => e.t)) };
  }

  /* ---------------- competition, tab 1: three processes, one printer ----------------
     One job = entercritical(R) → print page 1 → print page 2 → exitcritical(R) → remainder.
     Mutual exclusion ON: a caller that finds R busy joins a first-come queue, and exitcritical
     hands R straight to the head of that queue. OFF: nothing stops a second process walking in. */
  function mutexLab(ctx) {
    const { h } = ctx;
    let protect = true, st, token = 0, busy = false;
    const cards = {}, btns = {};
    const paper = h('div', { class: 'log cp-paper' });
    const res = h('div', { class: 'cp-res' });
    const narr = h('div', { class: 'callout cp-narr small m0', 'data-label': 'What happened' });
    function fresh() { st = { ph: [null, 'rem', 'rem', 'rem'], pg: [0, 0, 0, 0], job: [0, 0, 0, 0], q: [], pages: [], mixed: 0, clash: false }; }
    const inside = () => [1, 2, 3].filter((p) => st.ph[p] === 'cs');
    const list = (ps) => ps.map((p) => PN(p)).join(' and ');
    function step(p) {
      const ph = st.ph[p];
      let msg = '', tone = '';
      if (ph === 'wait') return;
      if (ph === 'rem') {
        st.job[p]++;
        const others = inside();
        if (protect && others.length) {
          st.ph[p] = 'wait'; st.q.push(p);
          msg = `${PN(p)} calls <code>entercritical(R)</code>, but ${PN(others[0])} is in its critical section. Here the OS <b>blocks</b> ${PN(p)} in a queue (position ${st.q.length}) until R is handed to it.`;
        } else {
          st.ph[p] = 'cs'; st.pg[p] = 0;
          if (protect) msg = `${PN(p)} calls <code>entercritical(R)</code>. Nobody is using the printer, so ${PN(p)} enters its critical section straight away.`;
          else if (others.length) { st.clash = true; tone = 'bad'; msg = `${PN(p)} walks straight in, because nothing checks. ${list(others)} ${others.length > 1 ? 'are' : 'is'} already using the printer. <b>Mutual exclusion is broken.</b>`; }
          else msg = `${PN(p)} starts using the printer. Without entercritical, nothing would stop anyone else from starting too.`;
        }
      } else if (st.pg[p] < 2) {
        st.pg[p]++;
        const mixed = [1, 2, 3].some((q) => q !== p && st.ph[q] === 'cs' && st.pg[q] === 1);
        if (mixed) { st.mixed++; tone = 'bad'; }
        st.pages.push({ p, job: st.job[p], page: st.pg[p], mixed });
        msg = `${PN(p)} prints page ${st.pg[p]} of its job.` + (mixed ? ' <b>It lands in the middle of another process’s half-printed job: the printout is mixed.</b>' : st.pg[p] === 1 ? ' It is in its critical section, using the one printer.' : ' Its job is complete.');
      } else {
        st.ph[p] = 'rem';
        msg = `${PN(p)} calls <code>exitcritical(R)</code> and goes back to its <b>remainder</b> (other work that needs no printer).`;
        if (protect && st.q.length) { const n = st.q.shift(); st.ph[n] = 'cs'; st.pg[n] = 0; msg += ` The printer passes straight to ${PN(n)}, first in the queue.`; }
        else if (protect) msg += ' The printer is free again.';
      }
      narr.className = 'callout cp-narr small m0 ' + tone;
      narr.dataset.label = tone === 'bad' ? 'Problem' : 'What happened';
      narr.innerHTML = msg;
      paint();
    }
    function paint() {
      [1, 2, 3].forEach((p) => {
        const ph = st.ph[p], pg = st.pg[p];
        const chip = ph === 'wait' ? `<span class="chip os">blocked · queue #${st.q.indexOf(p) + 1}</span>`
          : ph === 'cs' ? '<span class="chip io">in critical section</span>' : '<span class="chip">remainder</span>';
        const next = ph === 'rem' ? 'next: ask for the printer' : ph === 'wait' ? 'waiting for exitcritical' : pg < 2 ? `job ${st.job[p]}, printed ${pg} of 2` : 'job done, must release R';
        cards[p].querySelector('.cp-st').innerHTML = `${chip}<br><span class="muted">${next}</span>`;
        btns[p].textContent = ph === 'rem' ? 'entercritical(R)' : ph === 'wait' ? 'waiting…' : pg < 2 ? `print page ${pg + 1}` : 'exitcritical(R)';
        btns[p].disabled = ph === 'wait' || busy;
      });
      const ins = inside();
      res.classList.toggle('bad', ins.length > 1);
      res.innerHTML = `<div class="cp-res-h">Printer R <span class="xs muted">critical resource</span></div>` +
        `<div class="cp-slot">In use by: ${ins.length ? list(ins) : '<span class="muted">nobody (free)</span>'}${ins.length > 1 ? ' <b style="color:var(--bad)">✗ at once!</b>' : ''}</div>` +
        `<div class="cp-slot">Queue: ${protect ? (st.q.length ? st.q.map((p) => `<span class="chip ${p === 1 ? 'proc' : p === 2 ? 'accent' : 'thread'}">P${p}</span>`).join(' ') : '<span class="muted">empty</span>') : '<span class="muted">none (no mutual exclusion)</span>'}</div>` +
        `<div class="cp-slot xs muted">${st.pages.length} pages printed · ${st.mixed ? `<b style="color:var(--bad)">${st.mixed} mixed</b>` : '0 mixed'}</div>`;
      paper.innerHTML = st.pages.length ? st.pages.map((x) => `<div><span class="cp-pg p${x.p}">P${x.p} · job ${x.job} · page ${x.page}/2</span>${x.mixed ? '<span class="chip bad">mixed in</span>' : ''}</div>`).join('')
        : '<div class="muted">The printer output appears here.</div>';
      paper.scrollTop = paper.scrollHeight;
    }
    function reset(msg) {
      token++; busy = false; fresh();
      narr.className = 'callout cp-narr small m0'; narr.dataset.label = 'Your move';
      narr.innerHTML = msg || (protect ? 'Each process prints a two-page job. Click the buttons in any order. Try asking for the printer while someone else is using it.' : '<b>Mutual exclusion is OFF.</b> Let two processes into their critical sections at once and print, and watch the pages mix.');
      paint();
    }
    async function demo() {
      reset(protect ? 'Replaying a busy moment with mutual exclusion ON…' : 'Replaying the same kind of moment with mutual exclusion OFF…');
      const my = token; busy = true; paint();
      const seq = protect ? [1, 2, 1, 3, 1, 1, 2, 2, 2, 3, 3, 3] : [1, 2, 1, 2, 1, 2, 1, 2];
      for (const p of seq) {
        await ctx.sleep(750);
        if (!ctx.alive || my !== token) return;
        step(p);
      }
      busy = false; paint();
    }
    [1, 2, 3].forEach((p) => {
      btns[p] = h('button', { class: 'btn sm e-b' + p, type: 'button', onclick: () => step(p) }, 'entercritical(R)');
      cards[p] = h('div', { class: 'card tight stack cp-card e-p' + p }, h('b', { class: 'pc' + p }, 'Process P' + p), h('div', { class: 'cp-st' }), btns[p]);
    });
    const tog = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'true', onclick: () => { protect = !protect; tog.setAttribute('aria-pressed', String(protect)); tog.textContent = protect ? 'Mutual exclusion: ON' : 'Mutual exclusion: OFF'; reset(); } }, 'Mutual exclusion: ON');
    fresh(); reset();
    return h('div', { class: 'stack cp-tab' },
      h('div', { class: 'row' }, tog, h('button', { class: 'btn sm primary', type: 'button', onclick: demo }, 'Replay a busy moment'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => reset() }, 'Reset')),
      h('div', { class: 'grid-3' }, cards[1], cards[2], cards[3]),
      h('div', { class: 'cp-mid' }, res, paper),
      narr);
  }

  /* ---------------- competition, tab 2: deadlock with two resources ----------------
     Both processes need R1 (printer) AND R2 (a file). Asking for a resource that the other holds
     blocks the caller; releasing a resource hands it straight to a process blocked on it.
     Option "same order": P2 also asks for R1 first, which makes the circular wait impossible. */
  function deadlockLab(ctx) {
    const { h, s } = ctx;
    const NAME = { R1: 'printer', R2: 'file' };
    let same = false, st, token = 0, busy = false;
    const prog = (p) => {
      const [a, b] = p === 1 || same ? ['R1', 'R2'] : ['R2', 'R1'];
      return [[a, 'get'], [b, 'get'], [null, 'use'], [b, 'put'], [a, 'put']];
    };
    // every line carries a short comment, aligned in one column
    const src = (p) => prog(p).map(([r, op]) => (op === 'get' ? `entercritical(${r}); // get ${NAME[r]}`
      : op === 'use' ? 'use(R1, R2);'.padEnd(19) + '// use both' : `exitcritical(${r});`.padEnd(19) + `// free ${NAME[r]}`)).join('\n');
    const svg = s('svg', { viewBox: '0 0 300 218', width: '100%', role: 'img', 'aria-label': 'Resource graph: which process holds and which waits for each resource' });
    const narr = h('div', { class: 'callout small m0 cp-narr', 'data-label': 'Your move' });
    const cards = {}, btns = {}, codes = {};
    const fresh = () => { st = { pc: [0, 0, 0], hold: { R1: 0, R2: 0 }, wait: [0, null, null], dead: false }; };
    const P = { 1: [50, 100], 2: [250, 100] };
    const EDGE = { R1: { 1: [[125, 40], [74, 84]], 2: [[175, 40], [226, 84]] }, R2: { 1: [[125, 160], [74, 116]], 2: [[175, 160], [226, 116]] } };
    function draw() {
      const k = [];
      ['R1', 'R2'].forEach((r) => [1, 2].forEach((p) => {
        const [a, b] = EDGE[r][p];
        if (st.hold[r] === p) k.push(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 's-line', 'stroke-width': 3, style: `stroke:var(${st.dead ? '--bad' : VAR(p)})`, 'marker-end': `url(#arr-${st.dead ? 'bad' : p === 1 ? 'proc' : 'accent'})` }));
        if (st.wait[p] === r) k.push(s('line', { x1: b[0], y1: b[1], x2: a[0], y2: a[1], class: 's-line', 'stroke-width': 3, 'stroke-dasharray': '6 4', style: `stroke:var(${st.dead ? '--bad' : '--warn'})`, 'marker-end': `url(#arr-${st.dead ? 'bad' : 'warn'})` }));
      }));
      [1, 2].forEach((p) => {
        k.push(s('circle', { cx: P[p][0], cy: P[p][1], r: 28, class: p === 1 ? 's-proc' : 's-accent', 'stroke-width': 2.5 }));
        k.push(s('text', { x: P[p][0], y: P[p][1] + 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, style: `fill:var(${VAR(p)})` }, 'P' + p));
      });
      [['R1', 8], ['R2', 148]].forEach(([r, y]) => {
        k.push(s('rect', { x: 125, y, width: 50, height: 44, rx: 8, class: 's-io', 'stroke-width': 2 }));
        k.push(s('text', { x: 150, y: y + 20, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, r));
        k.push(s('text', { x: 150, y: y + 37, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, NAME[r]));
      });
      if (st.dead) k.push(s('text', { x: 150, y: 106, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 900, style: 'fill:var(--bad)' }, 'DEADLOCK'));
      k.push(s('line', { x1: 4, y1: 211, x2: 30, y2: 211, class: 's-line', 'stroke-width': 2.5 }), s('text', { x: 36, y: 216, 'font-size': 13, class: 's-sub' }, 'is held by'));
      k.push(s('line', { x1: 124, y1: 211, x2: 150, y2: 211, class: 's-line', 'stroke-width': 2.5, 'stroke-dasharray': '6 4', style: 'stroke:var(--warn)' }), s('text', { x: 156, y: 216, 'font-size': 13, class: 's-sub' }, 'waits for'));
      svg.replaceChildren(...k);
    }
    function step(p) {
      if (st.dead || st.wait[p] || st.pc[p] >= 5) return;
      const [r, op] = prog(p)[st.pc[p]], o = 3 - p;
      let msg, tone = '';
      if (op === 'get' && !st.hold[r]) { st.hold[r] = p; st.pc[p]++; msg = `${PN(p)} asks for ${r} (the ${NAME[r]}). It is free, so ${PN(p)} now holds it.`; }
      else if (op === 'get') {
        st.wait[p] = r;
        msg = `${PN(p)} asks for ${r}, but ${PN(o)} holds it, so ${PN(p)} is <b>blocked</b> until ${PN(o)} releases it.`;
        if (st.wait[o] && st.hold[st.wait[o]] === p) {
          st.dead = true; tone = 'bad';
          msg = `${PN(p)} now waits for ${r}, held by ${PN(o)}, while ${PN(o)} waits for ${st.wait[o]}, held by ${PN(p)}. Each waits for the other, so <b>neither can ever continue</b>: <span class="t">deadlock</span>.`;
        }
      } else if (op === 'use') { st.pc[p]++; msg = `${PN(p)} holds both resources and prints the file.`; }
      else {
        st.hold[r] = 0; st.pc[p]++;
        msg = `${PN(p)} releases ${r}.`;
        if (st.wait[o] === r) { st.hold[r] = o; st.wait[o] = null; st.pc[o]++; msg += ` ${PN(o)} was blocked on it, so ${PN(o)} gets it now and carries on.`; }
      }
      if (st.pc[1] >= 5 && st.pc[2] >= 5) { tone = 'tip'; msg += ' <b>Both processes finished.</b>' + (same ? ' With everyone asking in the same order, a circle of waiting cannot form.' : ' No deadlock this time: the order of requests happened to be safe.'); }
      narr.className = 'callout small m0 cp-narr ' + tone;
      narr.dataset.label = tone === 'bad' ? 'Deadlock' : tone === 'tip' ? 'Finished' : 'What happened';
      narr.innerHTML = msg;
      paint();
    }
    function paint() {
      draw();
      [1, 2].forEach((p) => {
        codes[p].clear();
        if (st.pc[p] < 5) codes[p].mark(st.pc[p] + 1, st.wait[p] ? 'bad' : 'cur');
        btns[p].disabled = busy || st.dead || !!st.wait[p] || st.pc[p] >= 5;
        btns[p].textContent = st.pc[p] >= 5 ? 'done' : st.wait[p] ? 'blocked' : 'Step P' + p;
      });
    }
    function build() {
      [1, 2].forEach((p) => {
        codes[p] = ctx.ui.code(src(p), { lang: 'c', nums: false });
        btns[p] = h('button', { class: 'btn sm e-b' + p, type: 'button', onclick: () => step(p) }, 'Step P' + p);
        cards[p].replaceChildren(h('div', { class: 'row nw' }, h('b', { class: 'pc' + p }, 'Process P' + p), h('span', { class: 'grow' }), btns[p]), codes[p]);
      });
    }
    function reset(msg) {
      token++; busy = false; fresh(); build();
      narr.className = 'callout small m0 cp-narr'; narr.dataset.label = 'Your move';
      narr.innerHTML = msg || `Each process needs <b>both</b> the printer and the file. ${same ? 'Both now ask for R1 first.' : 'P1 asks for R1 first; P2 asks for R2 first.'} Step them in any order. Can you get them stuck?`;
      paint();
    }
    async function demo() {
      reset('Replaying: P1, P2, P1, P2, one line each…');
      const my = token; busy = true; paint();
      for (let i = 0; i < 14; i++) {
        await ctx.sleep(900);
        if (!ctx.alive || my !== token) return;
        let p = i < 4 ? [1, 2, 1, 2][i] : 1;
        const can = (q) => !st.wait[q] && st.pc[q] < 5;
        if (!can(p)) p = 3 - p;
        if (st.dead || !can(p)) break;
        step(p);
      }
      busy = false; paint();
    }
    [1, 2].forEach((p) => { cards[p] = h('div', { class: 'card tight stack gap-s e-p' + p }); });
    const fix = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'false', onclick: () => { same = !same; fix.setAttribute('aria-pressed', String(same)); reset(); } }, 'Fix: same request order');
    reset();
    return h('div', { class: 'stack cp-tab' },
      h('div', { class: 'row' }, h('button', { class: 'btn sm primary', type: 'button', onclick: demo }, 'Replay P1, P2, P1, P2'), fix, h('button', { class: 'btn sm ghost', type: 'button', onclick: () => reset() }, 'Reset')),
      h('div', { class: 'cp-dl' }, cards[1], cards[2]),
      h('div', { class: 'cp-graph' },
        h('div', { class: 'card white tight' }, svg),
        h('div', { class: 'stack gap-s' }, narr,
          h('div', { class: 'callout warn small m0', 'data-label': 'Notice', html: 'Each program is fine alone, and mutual exclusion holds. The trouble is the request <b>order</b>: each holds one resource while it waits for the other.' }))));
  }

  /* ---------------- competition, tab 3: starvation ----------------
     P1, P2, P3 all want R at slot 1. Using R takes one slot; afterwards a process does one slot of
     other work, then asks again. Each slot the OS grants R to one waiting process:
       'fav'  : always prefer P1 or P3 (whichever has waited longer), P2 only if nobody else waits
       'fifo' : first come, first served (ties go to the lower number)                           */
  const SLOTS = 8;
  function starveRun(policy) {
    const ask = [0, 1, 1, 1];            // slot at which each process (re)joins the waiting set
    const grid = [null, [], [], []];    // grid[p][t] = 'use' | 'wait' | 'rem'
    const who = [];
    for (let t = 1; t <= SLOTS; t++) {
      const waiting = [1, 2, 3].filter((p) => ask[p] <= t);
      let pick = null;
      const byAge = (a, b) => ask[a] - ask[b] || a - b;
      if (policy === 'fifo') pick = waiting.slice().sort(byAge)[0];
      else { const fav = waiting.filter((p) => p !== 2).sort(byAge); pick = fav.length ? fav[0] : waiting[0]; }
      who.push(pick);
      [1, 2, 3].forEach((p) => { grid[p][t] = p === pick ? 'use' : ask[p] <= t ? 'wait' : 'rem'; });
      if (pick) ask[pick] = t + 2;
    }
    return { grid, who };
  }
  function starveLab(ctx) {
    const { h, s } = ctx;
    let policy = 'fav';
    const svg = s('svg', { viewBox: '0 0 640 156', width: '100%', role: 'img', 'aria-label': 'Timeline of which process holds R in each slot' });
    const X0 = 40, CW = 62, ROW = { 1: 24, 2: 63, 3: 102 };
    function draw(run, upto) {
      const k = [];
      for (let t = 1; t <= SLOTS; t++) k.push(s('text', { x: X0 + (t - 0.5) * CW, y: 13, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'slot ' + t));
      k.push(s('text', { x: 636, y: 13, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'used · waited'));
      [1, 2, 3].forEach((p) => {
        const y = ROW[p];
        k.push(s('text', { x: 4, y: y + 22, 'font-size': 16, 'font-weight': 800, style: `fill:var(${PCOL[p]})` }, 'P' + p));
        const wN = waited(p, upto);
        k.push(s('text', { x: 636, y: y + 21, 'text-anchor': 'end', 'font-size': 15, 'font-weight': 800, style: used(p, upto) === 0 && wN >= 3 ? 'fill:var(--bad)' : null }, `${used(p, upto)} · ${wN}`));
        for (let t = 1; t <= SLOTS; t++) {
          const x = X0 + (t - 1) * CW + 3, c = t <= upto ? run.grid[p][t] : null;
          const cls = c === 'use' ? ['s-proc', 's-accent', 's-thread'][p - 1] : c === 'wait' ? 's-warn' : 's-panel';
          k.push(s('rect', { x, y, width: CW - 6, height: 32, rx: 7, class: cls, 'stroke-width': c === 'use' ? 2.5 : 1.2, 'stroke-dasharray': c === 'wait' ? '5 3' : null, opacity: c ? 1 : 0.45 }));
          if (c) k.push(s('text', { x: x + (CW - 6) / 2, y: y + 21, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': c === 'use' ? 800 : 600, style: c === 'use' ? `fill:var(${PCOL[p]})` : c === 'wait' ? 'fill:var(--warn)' : null, class: c === 'rem' ? 's-sub' : null }, c === 'use' ? 'uses R' : c === 'wait' ? 'waits' : 'other'));
        }
      });
      if (upto > 0 && upto <= SLOTS) {
        const x = X0 + (upto - 1) * CW;
        k.push(s('rect', { x: x + 0.5, y: 18, width: CW - 1, height: 121, rx: 9, fill: 'none', style: 'stroke:var(--chc)', 'stroke-width': 2 }));
      }
      k.push(s('text', { x: X0, y: 153, 'font-size': 13, class: 's-sub' }, 'time →   the OS gives R to exactly one waiting process per slot'));
      svg.replaceChildren(...k);
    }
    let run = starveRun(policy);
    const waited = (p, upto) => run.grid[p].slice(1, upto + 1).filter((c) => c === 'wait').length;
    const used = (p, upto) => run.grid[p].slice(1, upto + 1).filter((c) => c === 'use').length;
    function render(i) {
      draw(run, i);
      if (i === 0) return `All three processes want the resource R at slot 1. Policy: <b>${policy === 'fav' ? 'always prefer P1 or P3' : 'first come, first served'}</b>. Press Play or Next.`;
      const pick = run.who[i - 1];
      const w = [1, 2, 3].filter((p) => run.grid[p][i] === 'wait');
      let cap = `<b>Slot ${i}:</b> the OS gives R to ${PN(pick)}.` + (w.length ? ` ${w.map((p) => PN(p)).join(' and ')} ${w.length > 1 ? 'wait' : 'waits'}.` : '');
      if (policy === 'fav' && i === SLOTS) cap += ` ${PN(2)} has waited every single slot while the others took turns. Nothing is stuck, and work gets done, yet ${PN(2)} may <b>never</b> be served: <span class="t">starvation</span>.`;
      else if (policy === 'fav' && i >= 3) cap += ` P1 and P3 keep taking turns, so ${PN(2)} is passed over again.`;
      else if (policy === 'fifo' && i === SLOTS) cap += ' With first come, first served, every process gets R regularly. Nobody starves.';
      return cap;
    }
    const player = ctx.ui.player({ count: SLOTS + 1, render, interval: 1100 });
    const seg = ctx.ui.seg([{ value: 'fav', label: 'Prefer P1 and P3' }, { value: 'fifo', label: 'First come, first served' }], policy, (v) => { policy = v; run = starveRun(v); player.reset(); });
    return h('div', { class: 'stack cp-tab' },
      h('div', { class: 'row' }, h('span', { class: 'small b' }, 'OS policy for handing out R:'), seg),
      h('div', { class: 'card white tight' }, svg), player.el,
      h('div', { class: 'callout warn small m0', 'data-label': 'Deadlock vs starvation', html: 'In deadlock <b>nobody</b> in the group can move. In starvation the system keeps working; one unlucky process is simply passed over, indefinitely.' }));
  }

  /* ---------------- cooperation by sharing: the a = b coherence puzzle ----------------
     Invariant: a == b.  Start a = b = 1.
       P1:  a = a + 1;  b = b + 1;        P2:  b = 2 * b;  a = 2 * a;
     Serial orders give (4,4) or (3,3). All four interleaved orders give a = 4, b = 3. */
  const CO_PROG = {
    1: [['a = a + 1;', '// add 1 to a', (m) => { m.a = m.a + 1; }], ['b = b + 1;', '// add 1 to b', (m) => { m.b = m.b + 1; }]],
    2: [['b = 2 * b;', '// double b', (m) => { m.b = 2 * m.b; }], ['a = 2 * a;', '// double a', (m) => { m.a = 2 * m.a; }]],
  };
  const CO_ORDERS = [[1, 1, 2, 2], [1, 2, 1, 2], [1, 2, 2, 1], [2, 1, 1, 2], [2, 1, 2, 1], [2, 2, 1, 1]];
  function coRun(order) { const m = { a: 1, b: 1 }, pc = { 1: 0, 2: 0 }; order.forEach((p) => CO_PROG[p][pc[p]++][2](m)); return m; }
  function coherenceLab(ctx) {
    const { h } = ctx;
    let cs = false, st;
    const found = new Set();
    const cards = {}, btns = {};
    const mem = h('div', { class: 'co-mem' });
    const outs = h('div', { class: 'co-outs' });
    const trail = h('span', { class: 'small' });
    const narr = h('div', { class: 'callout small m0 co-narr', 'data-label': 'Your move' });
    const fresh = () => { st = { a: 1, b: 1, pc: { 1: 0, 2: 0 }, order: [] }; };
    const key = (o) => o.join('');
    function step(p) {
      const o = 3 - p;
      if (st.pc[p] >= 2) return;
      if (cs && st.pc[o] === 1) {
        narr.className = 'callout small m0 co-narr'; narr.dataset.label = 'Blocked';
        narr.innerHTML = `${PN(o)} is in the middle of its critical section, so ${PN(p)} must wait until ${PN(o)} has updated <b>both</b> a and b.`;
        return;
      }
      const [src, , fn] = CO_PROG[p][st.pc[p]];
      const before = { a: st.a, b: st.b };
      fn(st); st.pc[p]++; st.order.push(p);
      const done = st.order.length === 4;
      let tone = '', label = 'What happened', msg = `${PN(p)} runs <code>${src}</code>: ${src[0]} goes from ${before[src[0]]} to ${st[src[0]]}.`;
      if (!done && st.a !== st.b) msg += ' a and b differ for now, which is fine while an update is still in progress.';
      if (done) {
        found.add(key(st.order));
        const ok = st.a === st.b;
        tone = ok ? 'tip' : 'bad'; label = ok ? 'Coherent' : 'Coherence broken';
        msg = ok ? `Finished with <b>a = ${st.a}, b = ${st.b}</b>. One process ran completely before the other, so a = b still holds.`
          : `Finished with <b>a = ${st.a}, b = ${st.b}</b>. Each process alone keeps a = b, yet together they broke it: a became (1 + 1) × 2 = 4 but b became 1 × 2 + 1 = 3, because the updates reached a and b in opposite orders.`;
        msg += ` <span class="muted">${found.size} of 6 orders tried.</span>`;
      }
      narr.className = 'callout small m0 co-narr ' + tone; narr.dataset.label = label;
      narr.innerHTML = msg;
      paint();
    }
    function paint() {
      const done = st.order.length === 4;
      const inv = st.a === st.b ? ['ok', 'a = b ✓'] : done ? ['bad', 'a ≠ b ✗'] : ['warn', 'a ≠ b (for now)'];
      mem.innerHTML = `<div class="co-cells">${['a', 'b'].map((v) => `<div class="co-cell"><span class="xs muted b">${v}</span><span class="co-val">${st[v]}</span></div>`).join('')}</div><div class="co-inv ${inv[0]}">${inv[1]}</div>`;
      [1, 2].forEach((p) => {
        const pc = st.pc[p];
        cards[p].querySelector('.co-code').innerHTML = CO_PROG[p].map(([src, com], i) => `<div class="co-ln ${i === pc ? 'cur' : i < pc ? 'done' : ''}">${i < pc ? '✓' : i === pc ? '▸' : '·'} ${esc(src)} <span class="tk-com">${esc(com)}</span></div>`).join('');
        btns[p].disabled = pc >= 2;
      });
      trail.innerHTML = `<b class="xs muted">YOUR ORDER</b> ` + (st.order.length ? st.order.map((p) => `<b class="pc${p}">P${p}</b>`).join(' → ') : '<span class="muted">nothing yet</span>');
      outs.innerHTML = CO_ORDERS.map((o) => {
        const k = key(o), f = found.has(k), m = coRun(o), serial = k === '1122' || k === '2211';
        const blocked = cs && !serial;
        return `<div class="co-out ${f ? 'found ' + (m.a === m.b ? 'good' : 'bad') : ''}"><span class="co-seq">${o.map((p) => `<i class="q${p}">${p}</i>`).join('')}</span>` +
          `<span class="co-res">${f ? `${m.a}, ${m.b} ${m.a === m.b ? '<span style="color:var(--ok)">✓</span>' : '<span style="color:var(--bad)">✗</span>'}` : blocked ? '<span class="xs muted">not allowed</span>' : '<span class="muted">?</span>'}</span></div>`;
      }).join('');
    }
    function reset() { fresh(); narr.className = 'callout small m0 co-narr'; narr.dataset.label = 'Your move'; narr.innerHTML = cs ? '<b>Critical sections ON:</b> once a process starts its pair of updates, the other must wait until it finishes both. Try to break a = b now.' : 'Start with a = b = 1. Step P1 and P2 in any order. The grid lists all six possible orders: can you fill it in?'; paint(); }
    [1, 2].forEach((p) => {
      btns[p] = h('button', { class: 'btn sm e-b' + p, type: 'button', onclick: () => step(p) }, 'Step P' + p);
      cards[p] = h('div', { class: 'card tight stack co-card e-p' + p }, h('div', { class: 'row nw' }, h('b', { class: 'pc' + p }, 'P' + p), h('span', { class: 'grow' }), btns[p]), h('div', { class: 'co-code' }));
    });
    const tog = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'false', onclick: () => { cs = !cs; tog.setAttribute('aria-pressed', String(cs)); tog.textContent = cs ? 'Each pair is a critical section: ON' : 'Each pair is a critical section: OFF'; reset(); } }, 'Each pair is a critical section: OFF');
    reset();
    return h('div', { class: 'stack co-left' },
      h('div', { class: 'co-grid' }, cards[1], mem, cards[2]),
      h('div', { class: 'row' }, trail, h('span', { class: 'grow' }), tog, h('button', { class: 'btn sm primary', type: 'button', onclick: reset }, 'Run again')),
      h('div', { class: 'row' }, h('span', { class: 'xs b muted' }, 'ALL SIX ORDERS'), h('span', { class: 'xs muted' }, '(1 = a step of P1, 2 = a step of P2) → final a, b')),
      outs, narr);
  }

  /* ---------------- cooperation by communication: three message scenarios ----------------
     'ok' request + reply; 'dead' both block in receive(); 'starve' P1 and P2 keep talking, P3 waits. */
  function messageLab(ctx) {
    const { h, s } = ctx;
    const POS = { 1: [80, 95], 2: [360, 42], 3: [360, 150] };
    const path = (a, b, off) => {                       // start/end points between two circles, shifted sideways by off
      const [x1, y1] = POS[a], [x2, y2] = POS[b], L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
      return [x1 + ux * 32 - uy * off, y1 + uy * 32 + ux * off, x2 - ux * 32 - uy * off, y2 - uy * 32 + ux * off];
    };
    const svg = s('svg', { viewBox: '0 0 440 188', width: '100%', role: 'img', 'aria-label': 'Processes exchanging messages' });
    const cap = h('div', { class: 'callout small m0 co-cap', 'data-label': 'What you see' });
    let mode = 'ok', dot = null, t0 = 0, passed = 0, lastCycle = -1, counter = null;
    const CAP = {
      ok: ['Request and reply', `${PN(1)} calls <code>send(P2, request)</code>, then <code>receive(P2)</code> to wait for the answer. ${PN(2)} receives the request and sends a reply. Nothing is shared, so nothing needs locking.`],
      dead: ['Deadlock', `Each process waits to <b>receive</b> from the other before it sends anything. ${PN(1)} is blocked in <code>receive(P2)</code> and ${PN(2)} in <code>receive(P1)</code>. No message will ever arrive: <span class="t">deadlock</span> over a <span class="t">consumable resource</span>.`],
      starve: ['Starvation', `${PN(2)} and ${PN(3)} both want to talk to ${PN(1)}. ${PN(1)} keeps exchanging messages with ${PN(2)}, so ${PN(3)}’s request is never taken. Work goes on, but ${PN(3)} may wait forever: <span class="t">starvation</span>.`],
    };
    function line(a, b, off, o = {}) {
      const [x1, y1, x2, y2] = path(a, b, off);
      return s('line', Object.assign({ x1, y1, x2, y2, class: 's-line', 'stroke-width': 2.5 }, o));
    }
    function draw() {
      const k = [];
      if (mode === 'ok' || mode === 'starve') {
        k.push(line(1, 2, -7, { 'marker-end': 'url(#arr-proc)', style: 'stroke:var(--proc)' }), line(2, 1, -7, { 'marker-end': 'url(#arr-accent)', style: 'stroke:var(--accent)' }));
        k.push(s('text', { x: 205, y: 52, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', transform: 'rotate(-10 205 52)' }, mode === 'ok' ? 'request' : 'message'));
        k.push(s('text', { x: 232, y: 90, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', transform: 'rotate(-10 232 90)' }, mode === 'ok' ? 'reply' : 'message'));
      }
      if (mode === 'dead') {
        k.push(line(1, 2, -7, { 'stroke-dasharray': '6 5', style: 'stroke:var(--bad)', 'marker-end': 'url(#arr-bad)' }), line(2, 1, -7, { 'stroke-dasharray': '6 5', style: 'stroke:var(--bad)', 'marker-end': 'url(#arr-bad)' }));
        k.push(s('text', { x: 190, y: 34, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 900, style: 'fill:var(--bad)' }, 'each waits for the other'));
      }
      if (mode === 'starve') {
        k.push(line(3, 1, 0, { 'stroke-dasharray': '6 5', style: 'stroke:var(--warn)', 'marker-end': 'url(#arr-warn)' }));
        counter = s('text', { x: 196, y: 180, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--warn)' }, 'P3 waits…');
        k.push(counter);
      }
      [1, 2, 3].forEach((p) => {
        const [x, y] = POS[p], dim = p === 3 && mode !== 'starve';
        k.push(s('g', { opacity: dim ? 0.3 : 1 },
          s('circle', { cx: x, cy: y, r: 28, class: ['s-proc', 's-accent', 's-thread'][p - 1], 'stroke-width': 2.5 }),
          s('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, style: `fill:var(${PCOL[p]})` }, 'P' + p)));
      });
      if (mode === 'dead') {
        k.push(s('text', { x: 80, y: 144, 'text-anchor': 'middle', 'font-size': 13, class: 's-monot', style: 'fill:var(--bad)' }, 'receive(P2)…'));
        k.push(s('text', { x: 360, y: 90, 'text-anchor': 'middle', 'font-size': 13, class: 's-monot', style: 'fill:var(--bad)' }, 'receive(P1)…'));
      }
      dot = mode === 'dead' ? null : s('rect', { width: 16, height: 11, rx: 2, x: -8, y: -5.5, class: 's-io', 'stroke-width': 1.5 });
      if (dot) k.push(dot);
      svg.replaceChildren(...k);
    }
    function frame(now) {
      if (!dot) return;
      if (!t0) t0 = now;
      const T = 2400, u = ((now - t0) % T) / T, cycle = Math.floor((now - t0) / T);
      const [ax, ay, bx, by] = u < 0.5 ? path(1, 2, -7) : path(2, 1, -7);
      const f = u < 0.5 ? u * 2 : (u - 0.5) * 2;
      dot.setAttribute('transform', `translate(${(ax + (bx - ax) * f).toFixed(1)} ${(ay + (by - ay) * f).toFixed(1)})`);
      if (mode === 'starve' && cycle !== lastCycle) { lastCycle = cycle; passed = cycle; if (counter) counter.textContent = `P3 waits · ${passed} exchange${passed === 1 ? '' : 's'} went ahead`; }
    }
    function set(m) {
      mode = m; t0 = 0; passed = 0; lastCycle = -1; draw();
      cap.dataset.label = CAP[m][0]; cap.className = 'callout small m0 co-cap ' + (m === 'ok' ? 'tip' : m === 'dead' ? 'bad' : 'warn');
      cap.innerHTML = CAP[m][1];
    }
    const seg = ctx.ui.seg([{ value: 'ok', label: 'Request and reply' }, { value: 'dead', label: 'Deadlock' }, { value: 'starve', label: 'Starvation' }], 'ok', set);
    set('ok');
    ctx.raf(frame);
    return h('div', { class: 'stack co-right' }, seg, h('div', { class: 'card white tight' }, svg), cap);
  }


  Guide.section({
    id: '5.2',
    title: 'Principles of Concurrency',
    short: 'Concurrency principles',
    summary: 'Races, the OS’s concerns, how processes interact, and the six rules any mutual exclusion scheme must meet.',
    objectives: [
      'Explain why the relative speed of concurrent processes cannot be predicted, and the three difficulties this creates.',
      'Trace the echo example and other race conditions, and work out every final value an interleaving can produce.',
      'List the four concerns concurrency raises for the OS, and classify process interaction by degree of awareness.',
      'Recognise mutual exclusion, deadlock, starvation and data-coherence problems in competing and cooperating processes.',
      'State the six requirements for mutual exclusion and identify which ones a proposed mechanism breaks.',
    ],
    terms: [
      ['Relative speed', 'How fast one process runs compared with the others. It changes from run to run because it depends on other processes, interrupts and the scheduler.'],
      ['Nondeterministic', 'Describes a program whose result can differ from one run to the next, even with identical input, because the timing of its steps differs. Its bugs are hard to reproduce.'],
      ['Global variable', 'A variable declared outside every procedure, so all code in the program uses the same copy. Threads of one process share it; separate processes each get their own copy unless it is placed in memory they share.'],
      ['I/O channel', 'A piece of I/O hardware, in effect a small special-purpose processor, that moves data between main memory and devices with little help from the CPU. The OS can grant a process the use of a channel for its I/O.'],
      ['Race condition', 'Several processes or threads read and write shared data, and the final result depends on the relative timing of their steps. When two writes collide, the last one to write decides the value.'],
      ['Critical resource', 'A resource that cannot be shared: only one process may use it at a time. A printer is the classic example.'],
      ['Critical section', 'The part of a program that uses a critical resource or shared data. At most one process may be inside its critical section for a given resource at a time.'],
      ['Mutual exclusion', 'The guarantee that while one process is inside a critical section for a resource, no other process is inside a critical section for that same resource.'],
      ['Deadlock', 'Each process in a group waits for something that only another member of the group can give, so none of them can ever continue.'],
      ['Starvation', 'A process that is ready to go is passed over again and again, indefinitely, while other processes keep getting the resource it needs.'],
      ['Degree of awareness', 'How much processes know about each other: not at all, indirectly through a shared object, or directly by name through messages.'],
      ['Competition', 'The relationship between processes that are unaware of each other but need the same resources, so the OS must referee who gets what.'],
      ['Cooperation by sharing', 'Processes that know about each other only indirectly, because they read and write the same shared object, such as a variable, file or buffer.'],
      ['Cooperation by communication', 'Processes that know each other by name and work together by sending and receiving messages, instead of sharing memory.'],
      ['Communication primitive', 'A basic operation, such as send or receive, provided by the OS or programming language so that processes can exchange messages.'],
      ['Data coherence', 'Keeping shared data consistent: every relationship that is supposed to hold between data items, such as a being equal to b, still holds after concurrent updates.'],
      ['Invariant', 'A condition that must be true whenever no update is in progress, for example a = b. An update may break it briefly but must restore it before it finishes.'],
      ['Renewable resource', 'A resource that is not used up: when one process releases it, another can use it. Processors, memory, files and I/O channels are examples. Also called a reusable resource.'],
      ['Consumable resource', 'A resource that is created and then destroyed when a process takes it, such as a message or a signal. Once received, it is gone.'],
    ],

    /* Scoped CSS: every selector starts with .sec-5-2 */
    css: `
      .sec-5-2 .pc1 { color: var(--proc); }
      .sec-5-2 .pc2 { color: var(--accent); }
      .sec-5-2 .pc3 { color: var(--thread); }
      .sec-5-2 .chr { font-family: var(--mono); font-weight: 800; }
      .sec-5-2 .mini { font-size: 13px; }
      .sec-5-2 .tight p { margin-bottom: 6px; }
      .sec-5-2 .s1-list li { margin: 5px 0; }
      .sec-5-2 .s1-why { padding-left: 20px; }
      .sec-5-2 .s1-why li { margin: 2px 0; }
      .sec-5-2 .s1-demo { gap: 9px; }
      .sec-5-2 .s1-screen { display: flex; align-items: center; gap: 4px; min-height: 46px; padding: 4px 12px; border-radius: 10px; background: var(--panel-3); font-size: 26px; letter-spacing: .06em; }
      .sec-5-2 .s1-screen .xs { letter-spacing: .08em; margin-right: 12px; }
      .sec-5-2 .s1-hist { gap: 6px; }
      .sec-5-2 pre.code .ln.m1 { background: color-mix(in srgb, var(--proc) 16%, transparent); border-left-color: var(--proc); }
      .sec-5-2 pre.code .ln.m2 { background: color-mix(in srgb, var(--accent) 16%, transparent); border-left-color: var(--accent); }
      .sec-5-2 pre.code .ln.m1::before { content: 'P1'; color: var(--proc); opacity: 1; font-weight: 800; }
      .sec-5-2 pre.code .ln.m2::before { content: 'P2'; color: var(--accent); opacity: 1; font-weight: 800; }
      .sec-5-2 pre.code .ln.m1.m2::before { content: 'both'; color: var(--ink); font-size: .8em; width: 3.25em; }
      .sec-5-2 .e-goal { font-size: 13px; white-space: normal; line-height: 1.3; padding: 3px 10px; border-radius: 8px; }
      .sec-5-2 .e-goal::before { content: '○'; font-weight: 900; }
      .sec-5-2 .e-goal.ok::before { content: '✓'; }
      .sec-5-2 .e-p1 { border-top: 4px solid var(--proc); }
      .sec-5-2 .e-p2 { border-top: 4px solid var(--accent); }
      .sec-5-2 .e-b1 { border-color: var(--proc); color: var(--proc); }
      .sec-5-2 .e-b2 { border-color: var(--accent); color: var(--accent); }
      .sec-5-2 .e-stat .chip { font-size: 12.5px; }
      .sec-5-2 .e-narr { min-height: 104px; font-size: 15px; line-height: 1.45; }
      .sec-5-2 .e-log { min-height: 80px; font-size: 13px; }
      .sec-5-2 .r1-box, .sec-5-2 .stack > .callout { flex: none; }
      .sec-5-2 .r1-a { min-width: 118px; }
      .sec-5-2 .r1-msg { line-height: 1.4; }
      .sec-5-2 .r2 { gap: 10px; }
      .sec-5-2 .r2-grid { display: grid; grid-template-columns: minmax(0, 1fr) 96px minmax(0, 1fr); gap: 10px; }
      .sec-5-2 .r2-mem { justify-content: center; }
      .sec-5-2 .r2-cell { display: flex; flex-direction: column; align-items: center; border: 2px solid var(--mem); background: var(--mem-bg); border-radius: 10px; padding: 2px 0 4px; }
      .sec-5-2 .r2-val { font-family: var(--mono); font-size: 28px; font-weight: 800; line-height: 1.1; }
      .sec-5-2 .r2-ln { font-size: 14px; padding: 2px 6px; border-radius: 6px; }
      .sec-5-2 .r2-ln.cur { background: var(--hl); }
      .sec-5-2 .r2-ln.done { color: var(--muted); }
      .sec-5-2 .r2-narr { flex: 1; min-height: 44px; line-height: 1.4; }
      .sec-5-2 .r2-tbl th.mono { text-transform: none; letter-spacing: 0; font-size: 14px; }
      @media (max-width: 760px) { .sec-5-2 .r2-grid { grid-template-columns: minmax(0, 1fr); } .sec-5-2 .r2-mem { flex-direction: row; } .sec-5-2 .r2-cell { flex: 1; } }
      .sec-5-2 .c4-row { display: flex; gap: 12px; align-items: flex-start; text-align: left; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel-2); cursor: pointer; color: var(--ink); font: inherit; }
      .sec-5-2 .c4-row:hover { border-color: var(--chc); }
      .sec-5-2 .c4-row.on { border-color: var(--chc); box-shadow: 0 0 0 1px var(--chc); background: color-mix(in srgb, var(--chc) 8%, var(--panel)); }
      .sec-5-2 .c4-n { flex: none; display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--panel-3); font-weight: 800; font-size: 14px; }
      .sec-5-2 .c4-row.on .c4-n, .sec-5-2 .c4-detail .c4-n { background: var(--chc); color: var(--panel); }
      .sec-5-2 .c4-t { display: flex; flex-direction: column; gap: 2px; font-size: 16px; line-height: 1.3; }
      .sec-5-2 .c4-d { font-weight: 400; }
      .sec-5-2 .c4-detail { gap: 12px; }
      .sec-5-2 .c4-res { gap: 10px; min-height: 30px; }
      .sec-5-2 .c4-detail svg { flex: none; }
      .sec-5-2 .c4-chg { background: var(--hl); font-weight: 700; }
      .sec-5-2 .c4-note { min-height: 42px; line-height: 1.4; }
      .sec-5-2 .aw-tbl { font-size: 14.5px; table-layout: fixed; }
      .sec-5-2 .aw-tbl th:first-child { width: 104px; }
      .sec-5-2 .aw-tbl th { text-transform: none; letter-spacing: 0; font-size: 15px; color: var(--ink); }
      .sec-5-2 .aw-ex { font-size: 12.5px; font-weight: 500; color: var(--muted); margin-top: 2px; line-height: 1.3; }
      .sec-5-2 .aw-lbl { font-weight: 700; font-size: 13.5px; color: var(--ink-2); }
      .sec-5-2 .aw-cell { line-height: 1.35; transition: background .2s; }
      .sec-5-2 .aw-p { padding: 1px 0; }
      .sec-5-2 .aw-p::before { content: '• '; color: var(--chc); font-weight: 900; }
      .sec-5-2 table.tbl .aw-on { background: color-mix(in srgb, var(--chc) 11%, var(--panel)); }
      .sec-5-2 .aw-rev { width: 100%; border: 1px dashed var(--line-2); }
      .sec-5-2 .aw-game { gap: 10px; }
      .sec-5-2 .aw-q { font-size: 16.5px; line-height: 1.45; min-height: 104px; }
      .sec-5-2 .aw-choice { justify-content: flex-start; height: 38px; }
      .sec-5-2 .aw-choice.aw-right { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); opacity: 1; }
      .sec-5-2 .aw-choice.aw-wrong { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); opacity: 1; }
      .sec-5-2 .aw-fb { min-height: 96px; line-height: 1.45; }
      /* shell workaround: in narrow (phone) mode a "Hands-on lab" eyebrow that is just wider than the
         screen widened the whole canvas. Giving the eyebrow no intrinsic width lets it clip as intended. */
      .sec-5-2 .step-eyebrow { contain: inline-size; }
      .sec-5-2 .rc-row .chip { white-space: normal; }
      /* step 6: competition lab */
      .sec-5-2 .e-b3 { border-color: var(--thread); color: var(--thread); }
      .sec-5-2 .e-p3 { border-top: 4px solid var(--thread); }
      .sec-5-2 .cp-left { gap: 10px; }
      .sec-5-2 .cp-tabs .tabs-strip { margin-bottom: 8px; }
      .sec-5-2 .cp-tab { gap: 9px; height: 100%; }
      .sec-5-2 .cp-card { padding: 8px 10px; gap: 5px; }
      .sec-5-2 .cp-card .btn { width: 100%; }
      .sec-5-2 .cp-st { font-size: 13.5px; line-height: 1.35; min-height: 38px; }
      .sec-5-2 .cp-mid { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 10px; min-height: 0; flex: 1 1 auto; }
      .sec-5-2 .cp-res { align-self: start; display: flex; flex-direction: column; gap: 6px; border: 2px solid var(--io); background: var(--io-bg); border-radius: 12px; padding: 8px 10px; }
      .sec-5-2 .cp-res.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-5-2 .cp-res-h { font-weight: 800; font-size: 15px; }
      .sec-5-2 .cp-slot { font-size: 14px; line-height: 1.35; }
      .sec-5-2 .cp-paper { font-size: 13.5px; background: var(--panel); border: 1px solid var(--line); min-height: 128px; max-height: 210px; }
      .sec-5-2 .cp-paper > div { display: flex; align-items: center; gap: 8px; border-bottom: 1px dashed var(--line); }
      .sec-5-2 .cp-pg { border-left: 4px solid var(--line-2); padding-left: 7px; font-weight: 700; }
      .sec-5-2 .cp-pg.p1 { border-color: var(--proc); color: var(--proc); }
      .sec-5-2 .cp-pg.p2 { border-color: var(--accent); color: var(--accent); }
      .sec-5-2 .cp-pg.p3 { border-color: var(--thread); color: var(--thread); }
      .sec-5-2 .cp-narr { min-height: 66px; line-height: 1.42; }
      .sec-5-2 .cp-dl { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
      .sec-5-2 .cp-dl pre.code { font-size: 13px; padding: 4px 0; overflow: hidden; }
      .sec-5-2 .cp-dl pre.code .ln { padding-right: 4px; }
      .sec-5-2 .cp-dl .card { padding: 8px 9px; }
      .sec-5-2 .cp-dl pre.code .ln.cur { background: color-mix(in srgb, var(--chc) 16%, transparent); }
      .sec-5-2 .cp-dl pre.code .ln.bad { background: var(--bad-bg); border-left-color: var(--bad); }
      .sec-5-2 .cp-graph { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 12px; align-items: start; }
      .sec-5-2 .cp-sv-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
      .sec-5-2 .cp-legend { font-size: 13px; }
      @media (max-width: 760px) { .sec-5-2 .cp-mid, .sec-5-2 .cp-dl, .sec-5-2 .cp-graph { grid-template-columns: minmax(0, 1fr); } }
      /* step 7: cooperation (data coherence puzzle + messages) */
      .sec-5-2 .co-left { gap: 9px; }
      .sec-5-2 .co-grid { display: grid; grid-template-columns: minmax(0, 1fr) 124px minmax(0, 1fr); gap: 10px; }
      .sec-5-2 .co-card { padding: 8px 10px; gap: 4px; }
      .sec-5-2 .co-ln { font-family: var(--mono); font-size: 13.5px; padding: 1px 6px; border-radius: 6px; white-space: nowrap; }
      .sec-5-2 .co-ln .tk-com { font-family: var(--mono); }
      .sec-5-2 .co-ln.cur { background: var(--hl); }
      .sec-5-2 .co-ln.done { color: var(--muted); }
      .sec-5-2 .co-mem { display: flex; flex-direction: column; gap: 5px; align-items: stretch; }
      .sec-5-2 .co-cells { display: flex; gap: 6px; }
      .sec-5-2 .co-cell { flex: 1; display: flex; flex-direction: column; align-items: center; border: 2px solid var(--mem); background: var(--mem-bg); border-radius: 10px; padding: 1px 0 3px; }
      .sec-5-2 .co-val { font-family: var(--mono); font-size: 26px; font-weight: 800; line-height: 1.1; }
      .sec-5-2 .co-inv { text-align: center; font-size: 13px; font-weight: 800; border-radius: 8px; padding: 2px 4px; background: var(--panel-3); }
      .sec-5-2 .co-inv.ok { background: var(--ok-bg); color: var(--ok); }
      .sec-5-2 .co-inv.bad { background: var(--bad-bg); color: var(--bad); }
      .sec-5-2 .co-inv.warn { background: var(--warn-bg); color: var(--warn); }
      .sec-5-2 .co-outs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
      .sec-5-2 .co-out { border: 1px solid var(--line); border-radius: 10px; padding: 4px 8px; background: var(--panel-2); font-size: 13.5px; display: flex; align-items: center; gap: 6px; }
      .sec-5-2 .co-out.found { background: var(--panel); border-color: var(--line-2); }
      .sec-5-2 .co-out.found.good { border-color: var(--ok); }
      .sec-5-2 .co-out.found.bad { border-color: var(--bad); }
      .sec-5-2 .co-seq { display: inline-flex; gap: 2px; }
      .sec-5-2 .co-seq i { font-style: normal; font-weight: 800; font-size: 12.5px; padding: 0 3px; border-radius: 4px; }
      .sec-5-2 .co-seq i.q1 { color: var(--proc); background: var(--proc-bg); }
      .sec-5-2 .co-seq i.q2 { color: var(--accent); background: var(--accent-bg); }
      .sec-5-2 .co-res { margin-left: auto; font-family: var(--mono); font-weight: 800; white-space: nowrap; }
      .sec-5-2 .co-narr { min-height: 70px; line-height: 1.42; }
      .sec-5-2 .co-right { gap: 9px; }
      .sec-5-2 .co-cap { min-height: 88px; line-height: 1.42; }
      @media (max-width: 760px) { .sec-5-2 .co-grid, .sec-5-2 .co-outs { grid-template-columns: minmax(0, 1fr); } }
      /* step 8: six requirements game */
      .sec-5-2 .rq-list { gap: 6px; }
      .sec-5-2 .rq { display: flex; gap: 10px; align-items: flex-start; text-align: left; width: 100%; padding: 7px 10px; border: 2px solid var(--line); border-radius: 11px; background: var(--panel-2); cursor: pointer; color: var(--ink); font: inherit; transition: border-color .15s, background .15s; }
      .sec-5-2 .rq:hover:not(:disabled) { border-color: var(--chc); }
      .sec-5-2 .rq:disabled { cursor: default; }
      .sec-5-2 .rq.right { border-color: var(--ok); background: var(--ok-bg); }
      .sec-5-2 .rq.wrong { border-color: var(--bad); background: var(--bad-bg); }
      .sec-5-2 .rq-n { flex: none; display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--chc); color: var(--panel); font-weight: 800; font-size: 14px; }
      .sec-5-2 .rq-t { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; font-size: 15.5px; line-height: 1.3; }
      .sec-5-2 .rq-d { font-weight: 400; font-size: 13.5px; color: var(--ink-2); }
      .sec-5-2 .rq-tally { flex: none; align-self: center; }
      .sec-5-2 .rq-game { gap: 10px; }
      .sec-5-2 .rq-scn { font-size: 17px; line-height: 1.5; min-height: 118px; }
      .sec-5-2 .rq-fb { min-height: 128px; line-height: 1.45; }
      .sec-5-2 .rq-dots { display: flex; gap: 5px; }
      .sec-5-2 .rq-dots i { width: 12px; height: 12px; border-radius: 50%; background: var(--panel-3); border: 1px solid var(--line-2); }
      .sec-5-2 .rq-dots i.ok { background: var(--ok); border-color: var(--ok); }
      .sec-5-2 .rq-dots i.bad { background: var(--bad); border-color: var(--bad); }
      .sec-5-2 .rq-dots i.cur { border: 2px solid var(--chc); }
    `,

    steps: [
      /* ---------------- 1. Big picture: relative speed is unpredictable ---------------- */
      {
        title: 'Same program, different output: the timing problem',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack tight">
              <p class="lead m0">Why did 5.1 forbid any assumption about speed? Because nobody can say in advance how fast each process will run compared with the others.</p>
              <p class="m0">On a single processor the OS <span class="t" data-t="Interleaving">interleaves</span> processes, a slice at a time. On a multiprocessor they are also <span class="t" data-t="Overlapping">overlapped</span>: some truly run at the same instant. Either way, the problems are identical.</p>
              <div class="small">
                <p class="m0">A process’s <span class="t">relative speed</span> depends on three things it cannot control:</p>
                <ul class="m0 s1-why">
                  <li><b>What other processes do</b>: how much CPU time they take</li>
                  <li><b>How the OS handles interrupts</b>: they can pause it anytime</li>
                  <li><b>The OS’s scheduling policy</b>: who runs next, for how long</li>
                </ul>
              </div>
              <div>
                <h4>Three difficulties that follow</h4>
                <ol class="s1-list small m0">
                  <li><b>Sharing global resources is risky.</b> If two processes share one <span class="t">global variable</span>, the order of their steps decides the result.</li>
                  <li><b>Allocating resources well is hard.</b> Say P1 is granted an <span class="t">I/O channel</span>, then suspended before using it. Keeping the channel locked for P1 leaves it idle while others wait, and can even cause deadlock.</li>
                  <li><b>Bugs are hard to find.</b> Results are <span class="t">nondeterministic</span>, so a failure may not happen again when you rerun the program to look for it.</li>
                </ol>
              </div>
            </div>
            <div class="card white stack s1-demo"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const host = el.querySelector('.s1-demo');
          const WORDS = ['ping', 'PONG'];
          let mode = 1, run = 1;
          const seen = [];
          // Build one random schedule. p: 1 = P1, 2 = P2, 0 = other work (interrupt handler, other processes)
          const cell = (p, ch) => ({ p, ch });
          const FIRST = {   // run 1 is hand-picked so the very first picture already shows mixing
            1: [[cell(1, 'p'), cell(1, 'i'), cell(0), cell(2, 'P'), cell(2, 'O'), cell(2, 'N'), cell(1, 'n'), cell(0), cell(2, 'G'), cell(1, 'g')]],
            2: [[cell(1, 'p'), cell(1, 'i'), cell(0), cell(1, 'n'), cell(1, 'g')], [cell(0), cell(2, 'P'), cell(2, 'O'), cell(0), cell(2, 'N'), cell(2, 'G')]],
          };
          function schedule(rng) {
            if (run === 1) {
              const lanes = FIRST[mode];
              const out = [];
              for (let t = 0; t < 10; t++) lanes.forEach((L) => { const c = L[t]; if (c && c.p) out.push(c); });
              return { lanes, out };
            }
            if (mode === 1) {
              const rem = WORDS.map((w) => w.split(''));
              const lane = [];
              let guard = 0;
              while ((rem[0].length || rem[1].length) && guard++ < 60) {
                if (rng() < 0.2 && lane.length && lane[lane.length - 1].p !== 0) { lane.push({ p: 0 }); continue; }
                const opts = [0, 1].filter((i) => rem[i].length);
                const pick = opts[Math.floor(rng() * opts.length)];
                let len = 1 + Math.floor(rng() * 3);
                while (len-- > 0 && rem[pick].length) lane.push({ p: pick + 1, ch: rem[pick].shift() });
              }
              return { lanes: [lane], out: lane.filter((c) => c.p).map((c) => ({ p: c.p, ch: c.ch })) };
            }
            const lanes = [0, 1].map((i) => {
              const L = [], r = WORDS[i].split('');
              while (r.length) { if (rng() < 0.3 && L.length < 7) L.push({ p: 0 }); else L.push({ p: i + 1, ch: r.shift() }); }
              return L;
            });
            const out = [];
            const T = Math.max(lanes[0].length, lanes[1].length);
            for (let t = 0; t < T; t++) {
              const now = lanes.map((L) => L[t]).filter((c) => c && c.p);
              if (now.length === 2 && rng() < 0.5) now.reverse();   // same instant: whichever reaches the screen first
              now.forEach((c) => out.push({ p: c.p, ch: c.ch, same: now.length === 2 }));
            }
            return { lanes, out };
          }
          const svg = s('svg', { viewBox: '0 0 640 150', width: '100%', role: 'img', 'aria-label': 'Timeline of which process runs on each processor' });
          function draw(res) {
            const T = Math.max(...res.lanes.map((l) => l.length));
            const X = 78, cw = Math.min(54, Math.floor(540 / Math.max(T, 1)));
            const ys = res.lanes.length === 1 ? [40] : [12, 66];
            const kids = [];
            res.lanes.forEach((L, i) => {
              const y = ys[i];
              kids.push(s('text', { x: 6, y: y + 25, 'font-size': 14, 'font-weight': 800 }, res.lanes.length === 1 ? 'CPU' : 'CPU ' + (i + 1)));
              L.forEach((c, t) => {
                const cls = c.p === 1 ? 's-proc' : c.p === 2 ? 's-accent' : 's-panel';
                kids.push(s('rect', { x: X + t * cw + 1.5, y, width: cw - 3, height: 40, rx: 7, class: cls, 'stroke-width': 1.5, 'stroke-dasharray': c.p ? null : '4 3' }));
                if (c.p) kids.push(s('text', { x: X + t * cw + cw / 2, y: y + 27, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, class: 's-monot', style: `fill:var(${c.p === 1 ? '--proc' : '--accent'})` }, c.ch));
              });
            });
            kids.push(s('line', { x1: X, y1: 124, x2: X + T * cw + 6, y2: 124, class: 's-line', 'marker-end': 'url(#arr)' }));
            kids.push(s('text', { x: X, y: 144, 'font-size': 13, class: 's-sub' }, 'time →  one box = one time unit'));
            svg.replaceChildren(...kids);
          }
          const screen = h('div', { class: 's1-screen', 'aria-live': 'polite' });
          const note = h('p', { class: 'small m0' });
          const stat = h('div', { class: 'row s1-hist' });
          function go() {
            const rng = ctx.util.seeded(run * 7919 + mode * 131 + 17);
            const res = schedule(rng);
            draw(res);
            const txt = res.out.map((c) => c.ch).join('');
            screen.innerHTML = '<span class="xs muted b">SCREEN</span>' + res.out.map((c) => CH(c.ch, c.p)).join('');
            seen.push(txt);
            const distinct = new Set(seen).size;
            note.innerHTML = mode === 1
              ? `<b>One processor:</b> only one process runs at any instant, so their letters <b>interleave</b>. The grey boxes are time the OS gave to interrupts and other work. Neither program chose where its slices fell.`
              : `<b>Two processors:</b> P1 and P2 now run <b>at the same time</b>, each on its own CPU, so letters can even arrive in the same instant. Interruptions (grey) still shift them, so the mix still changes.`;
            stat.innerHTML = `<span class="chip accent">run ${seen.length}</span><span class="chip ${distinct > 1 ? 'warn' : ''}">${distinct} different output${distinct > 1 ? 's' : ''} so far</span>` +
              seen.slice(-3).reverse().map((o) => `<span class="chip mono">${esc(o)}</span>`).join('');
            ctx.refit();
          }
          const seg = ctx.ui.seg([{ value: 1, label: 'One processor' }, { value: 2, label: 'Two processors' }], 1, (v) => { mode = v; run = 1; seen.length = 0; go(); });
          const again = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { run++; go(); } }, 'Run again');
          host.append(
            h('div', { class: 'row' }, h('h4', { class: 'm0' }, 'Try it'), seg, h('span', { class: 'grow' }), again),
            h('p', { class: 'small m0', html: `Both programs are fixed: ${PN(1)} prints <b class="mono pc1">ping</b> and ${PN(2)} prints <b class="mono pc2">PONG</b>, one letter per time unit, to the same screen.` }),
            svg, screen, note, stat,
            h('div', { class: 'callout analogy small m0', 'data-label': 'Analogy', html: 'Two cooks share one cutting board. Neither controls when the other’s phone rings, so their chopping mixes in a different order every evening. Same recipes, different timing, different result.' }),
          );
          go();
        },
      },

      /* ---------------- 2. Echo lab: you are the scheduler ---------------- */
      {
        title: 'Lab: the echo procedure loses a character',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const code = ctx.ui.code(`
char chin, chout;     // in shared memory: one copy for all
void echo() {         // any process may call this
  chin = getchar();   // 1. read a key into chin
  chout = chin;       // 2. copy chin into chout
  putchar(chout);     // 3. show chout on the screen
}                     // return to the caller`, { lang: 'c', fontSize: 14 });
          // number only the three statements of echo, so "line 1, 2, 3" in the narration matches the gutter
          [['', 1], ['', 2], ['1', 3], ['2', 4], ['3', 5], ['', 6]].forEach(([n, i]) => { code.line(i).dataset.n = n; });
          const LINES = [null, 'chin = getchar();', 'chout = chin;', 'putchar(chout);'];
          const mach = echoMachine(ctx.s);
          const log = h('div', { class: 'log grow e-log' });
          const narr = h('div', { class: 'callout e-narr m0', 'data-label': 'What happened' });
          let mode = 1, protect = false, st, token = 0, busy = false;
          const cards = {}, btns = {};
          function fresh() { st = { pc: [0, 1, 1], chin: null, chout: null, screen: [], running: 0, last: null, blocked: 0, n: 0, logged: false }; log.innerHTML = '<div class="muted">Your schedule appears here, newest at the bottom.</div>'; }
          const inside = (p) => st.pc[p] === 2 || st.pc[p] === 3;
          function addLog(html) { if (!st.logged) { log.innerHTML = ''; st.logged = true; } log.insertAdjacentHTML('beforeend', `<div>${html}</div>`); log.scrollTop = log.scrollHeight; }
          // challenges tick themselves when a finished run matches
          const GOALS = [
            ['lx', `Lose ${CH('x', 1)}: screen shows ${CH('y', 2)}${CH('y', 2)}`],
            ['ly', `Lose ${CH('y', 2)}: screen shows ${CH('x', 1)}${CH('x', 1)}`],
            ['mp', 'Lose a character on two processors'],
            ['pr', 'Finish a run with Protect echo on'],
          ];
          const goalEls = GOALS.map(([id, txt]) => h('span', { class: 'chip e-goal', 'data-g': id, html: txt }));
          const tick = (id) => { const g = goalEls.find((x) => x.dataset.g === id); if (g && !g.classList.contains('ok')) { g.classList.add('ok', 'flash'); } };
          function step(p) {
            const o = 3 - p;
            if (st.pc[p] > 3) return;
            if (protect && st.pc[p] === 1 && inside(o)) {
              st.blocked = p;
              if (mode === 1 && st.running === o) addLog(`<span class="muted">— interrupt: OS dispatches P${p} —</span>`);
              if (mode === 1) st.running = o;
              addLog(`<b class="pc${p}">P${p}</b> tries to enter echo → <b style="color:var(--bad)">blocked</b> (P${o} is inside)`);
              if (mode === 1) addLog(`<span class="muted">— P${p} is blocked, so the OS dispatches P${o} again —</span>`);
              narr.className = 'callout e-narr m0 warn'; narr.dataset.label = 'Blocked';
              narr.innerHTML = `${PN(p)} called echo, but ${PN(o)} is still inside it. With protection on, ${PN(p)} is <b>blocked</b> at the entrance and cannot touch chin or chout until ${PN(o)} returns.` + (mode === 1 ? ` The OS gives the CPU back to ${PN(o)}.` : '');
              return paint();
            }
            if (mode === 1 && st.running && st.running !== p) addLog(`<span class="muted">— interrupt: OS saves P${st.running}’s state, dispatches P${p} —</span>`);
            if (mode === 1) st.running = p;
            if (st.blocked === p) st.blocked = 0;
            const line = st.pc[p], before = { chin: st.chin, chout: st.chout };
            let what;
            if (line === 1) { st.chin = KEY[p]; what = `getchar() returns ${CH(KEY[p], p)}, stored in shared <code>chin</code>`; }
            if (line === 2) { st.chout = st.chin; what = `copies chin into chout, so chout = ${CH(st.chout, OWN(st.chout))}`; }
            if (line === 3) { st.screen.push(st.chout); what = `putchar shows ${CH(st.chout, OWN(st.chout))} on the screen`; }
            st.pc[p]++; st.n++; st.last = { line, p };
            if (protect && st.pc[p] === 4 && st.blocked === o) st.blocked = 0;
            addLog(`${st.n}. <b class="pc${p}">P${p}</b>${mode === 2 ? ' (CPU ' + p + ')' : ''} · <code>${LINES[line]}</code> → ${line === 1 ? 'chin = ' + st.chin : line === 2 ? 'chout = ' + st.chout : 'shows ' + st.screen[st.screen.length - 1]}`);
            let msg = `${PN(p)} ran line ${line}: ${what}.`;
            if (line === 1 && st.pc[o] === 2 && before.chin !== st.chin) msg += ` <b style="color:var(--bad)">That overwrote ${CH(before.chin, OWN(before.chin))}, which ${PN(o)} had read and not yet copied.</b>`;
            if (line === 2 && st.pc[o] === 3 && before.chout !== st.chout) msg += ` <b style="color:var(--bad)">That overwrote the chout that ${PN(o)} is about to display.</b>`;
            if (line === 3 && st.chout !== KEY[p]) msg += ` <b style="color:var(--bad)">But ${PN(p)}’s user typed ${CH(KEY[p], p)}!</b>`;
            narr.className = 'callout e-narr m0'; narr.dataset.label = 'What happened';
            narr.innerHTML = msg;
            if (st.pc[1] === 4 && st.pc[2] === 4) verdict();
            paint();
          }
          function verdict() {
            const out = st.screen.join('');
            const ok = out === 'xy' || out === 'yx';
            if (out === 'yy') tick('lx');
            if (out === 'xx') tick('ly');
            if (!ok && mode === 2) tick('mp');
            if (protect) tick('pr');
            narr.className = 'callout e-narr m0 ' + (ok ? 'tip' : 'bad');
            narr.dataset.label = ok ? 'Correct output' : 'Race condition';
            if (ok) narr.innerHTML = `Screen shows ${st.screen.map((c) => CH(c, OWN(c))).join(' ')}: each user saw their own key. ` + (protect ? 'With echo protected, one caller finished before the other could touch chin or chout, so no interleaving can go wrong.' : 'This schedule happened to be safe, but nothing guarantees the next one will be. Try interrupting a process in the middle of echo.');
            else { const lost = ['x', 'y'].filter((c) => !st.screen.includes(c)); narr.innerHTML = `Screen shows ${st.screen.map((c) => CH(c, OWN(c))).join(' ')}. <b>${lost.map((c) => CH(c, OWN(c))).join('')} was lost</b> and the other character appeared twice. Both callers used the one chin and chout in shared memory, and a second caller overwrote them while the first was still inside echo. Now switch on <b>Protect echo</b>.`; }
          }
          function paint() {
            mach.draw(st, mode);
            for (let n = 1; n <= 6; n++) code.line(n).classList.remove('m1', 'm2');
            [1, 2].forEach((p) => {
              // a blocked caller is shown waiting at echo's entrance (line "void echo() {"), not on a statement
              if (st.pc[p] <= 3) { const ln = code.line(st.blocked === p ? 2 : st.pc[p] + 2); ln.classList.add('m' + p); }
              const c = cards[p], pc = st.pc[p];
              const cpu = mode === 2 ? `<span class="chip cpu">on CPU ${p}</span>` : st.running === p ? '<span class="chip cpu">on the CPU</span>' : st.blocked === p ? '' : '<span class="chip">ready</span>';
              const loc = pc > 3 ? '<span class="chip ok">finished</span>' : st.blocked === p ? '<span class="chip bad">blocked at entry</span>' : inside(p) ? '<span class="chip warn">inside echo</span>' : '<span class="chip">about to call echo</span>';
              c.querySelector('.e-stat').innerHTML = (pc > 3 ? '' : cpu) + loc;
              c.querySelector('.e-next').innerHTML = pc > 3 ? 'Done. Its user typed ' + CH(KEY[p], p) + '.' : `Next: line ${pc} · <code>${LINES[pc]}</code>`;
              btns[p].disabled = pc > 3 || busy;
            });
          }
          function reset(msg) {
            token++; busy = false; fresh();
            narr.className = 'callout e-narr m0'; narr.dataset.label = 'Your move';
            narr.innerHTML = msg || `Assume the OS, to save memory, loads echo <b>and its <span class="t" data-t="Global variable">global</span> variables</b> once, into memory shared by every program, so all callers use the <b>same</b> chin and chout. ${PN(1)}’s user typed ${CH('x', 1)} and ${PN(2)}’s user typed ${CH('y', 2)}. Press <b>Step</b> to run one line of that process. Can you make a character vanish?`;
            paint();
          }
          async function replay() {
            reset(); const my = token; busy = true; paint();
            const seq = mode === 1 ? [1, 2, 2, 2, 1, 1] : [1, 2, 1, 2, 1, 2];
            for (let i = 0; i < 12; i++) {
              await ctx.sleep(850);
              if (!ctx.alive || my !== token) return;
              let p = i < seq.length ? seq[i] : st.pc[1] <= 3 ? 1 : st.pc[2] <= 3 ? 2 : 0;
              if (!p) break;
              if (st.pc[p] > 3 || st.blocked === p) p = 3 - p;   // finished, or already known to be blocked: run the other one
              if (st.pc[p] > 3) break;
              step(p);
            }
            busy = false; paint();
          }
          [1, 2].forEach((p) => {
            btns[p] = h('button', { class: 'btn sm e-b' + p, type: 'button', onclick: () => step(p) }, 'Step P' + p);
            cards[p] = h('div', { class: 'card tight stack gap-s e-card e-p' + p },
              h('div', { class: 'row nw' }, h('b', { class: 'pc' + p }, 'Process P' + p), h('span', { class: 'grow' }), btns[p]),
              h('div', { class: 'row gap-s e-stat' }),
              h('div', { class: 'small e-next' }));
          });
          const seg = ctx.ui.seg([{ value: 1, label: 'One processor' }, { value: 2, label: 'Two processors' }], 1, (v) => { mode = v; reset(); });
          const prot = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'false', onclick: () => { protect = !protect; prot.setAttribute('aria-pressed', String(protect)); prot.textContent = protect ? 'Protect echo: ON' : 'Protect echo: OFF'; reset(protect ? `<b>Protection is on:</b> only one process may be inside echo at a time. A process that calls echo while the other is inside must wait. Try any schedule you like, or replay the classic case.` : null); } }, 'Protect echo: OFF');
          el.append(h('div', { class: 'stack fill e-wrap' },
            h('div', { class: 'row' }, seg, prot, h('button', { class: 'btn sm primary', type: 'button', onclick: replay }, 'Replay the classic failure'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => reset() }, 'Reset')),
            h('div', { class: 'split grow' },
              h('div', { class: 'stack' },
                code, h('div', { class: 'grid-2' }, cards[1], cards[2]), narr,
                h('div', { class: 'row gap-s' }, h('span', { class: 'xs b muted' }, 'CHALLENGES'), ...goalEls)),
              h('div', { class: 'stack' }, h('div', { class: 'card white tight' }, mach.svg), log))));
          reset();
        },
      },

      /* ---------------- 3. Race conditions ---------------- */
      {
        title: 'Race conditions: the loser of the race decides',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack">
              <p class="lead m0">A <span class="t">race condition</span> happens when several processes or threads read and write shared data, and the final result depends on the relative timing of their steps.</p>
              <p class="small m0">The processes “race” to the data. The twist: the <b>loser</b> decides the result. Whoever writes last overwrites everyone before it, so its value is the one that survives.</p>
              <div class="card stack gap-s r1-box">
                <h4 class="m0">Example 1 · one shared variable</h4>
                <p class="small m0">${PN(1)} runs <code>a = 1;</code> and ${PN(2)} runs <code>a = 2;</code>. You pick the order.</p>
                <div class="row r1-btns"></div>
                <div class="row nw"><div class="big r1-a">a = ?</div><div class="small r1-msg grow"></div></div>
              </div>
              <div class="callout warn small m0" data-label="Common mistake">Thinking the first writer wins. The first write is simply overwritten; the last one survives.</div>
              <div class="callout tip small m0" data-label="Key idea">A correct program must give the right answer for <b>every</b> interleaving.</div>
            </div>
            <div class="card white stack r2"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          /* ----- example 1: a = 1 / a = 2 ----- */
          const aBox = el.querySelector('.r1-a'), aMsg = el.querySelector('.r1-msg');
          let aHist = [];
          function paintA() {
            const v = aHist.length ? aHist[aHist.length - 1] : null;
            aBox.innerHTML = 'a = ' + (v == null ? '?' : `<span class="pc${v}">${v}</span>`);
            const trail = aHist.map((p) => `${PN(p)} writes ${p}`).join(' → ');
            aMsg.innerHTML = aHist.length === 0 ? 'Nobody has written yet.' : aHist.length === 1 ? `${trail}. Now let the other one write.`
              : `${trail}. ${PN(v)} wrote last: it lost the race, yet its value is the one that survives.`;
            a1.disabled = aHist.includes(1); a2.disabled = aHist.includes(2);
          }
          const a1 = h('button', { class: 'btn sm e-b1', type: 'button', onclick: () => { aHist.push(1); paintA(); } }, 'P1: a = 1');
          const a2 = h('button', { class: 'btn sm e-b2', type: 'button', onclick: () => { aHist.push(2); paintA(); } }, 'P2: a = 2');
          el.querySelector('.r1-btns').append(a1, a2, h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { aHist = []; paintA(); } }, 'Reset'));
          paintA();

          /* ----- example 2: b = b + c and c = b + c ----- */
          const host = el.querySelector('.r2');
          let micro = false, st;
          const found = new Set();
          const OUT = [
            ['P3 runs completely, then P4', 3, 5, 'first'],
            ['P4 runs completely, then P3', 4, 3, 'second'],
            ['Both load before either stores', 3, 3, 'overlap'],
          ];
          const PROG = {
            3: { name: 'P3', stmt: 'b = b + c;', tgt: 'b', cls: 1 },
            4: { name: 'P4', stmt: 'c = b + c;', tgt: 'c', cls: 2 },
          };
          const panels = {}, stepBtn = {};
          const mem = h('div', { class: 'stack gap-s r2-mem' });
          const tbody = h('tbody');
          const narr = h('p', { class: 'small m0 r2-narr' });
          const trail = h('div', { class: 'row gap-s' });
          function fresh() { st = { b: 1, c: 2, pc: { 3: 0, 4: 0 }, reg: { 3: null, 4: null }, order: [] }; }
          const nSteps = () => (micro ? 2 : 1);
          function run(p) {
            const P = PROG[p], o = p === 3 ? 4 : 3;
            if (st.pc[p] >= nSteps()) return;
            if (!micro) {
              const b0 = st.b, c0 = st.c, sum = b0 + c0; st[P.tgt] = sum; st.pc[p] = 1;
              narr.innerHTML = `${P.name} runs <code>${P.stmt}</code> in one go: it reads b = ${b0} and c = ${c0}, so ${P.tgt} becomes ${sum}.`;
            } else if (st.pc[p] === 0) {
              st.reg[p] = { b: st.b, c: st.c }; st.pc[p] = 1;
              narr.innerHTML = `${P.name} <b>loads</b> b = ${st.b} and c = ${st.c} into its own registers. It has not changed memory yet.`;
            } else {
              const sum = st.reg[p].b + st.reg[p].c; st[P.tgt] = sum; st.pc[p] = 2;
              narr.innerHTML = `${P.name} adds its copies (${st.reg[p].b} + ${st.reg[p].c}) and <b>stores</b> ${P.tgt} = ${sum}.` + (st.pc[o] === 1 ? ` ${PROG[o].name} still holds the old values in its registers.` : '');
            }
            st.order.push(p);
            if (st.pc[3] === nSteps() && st.pc[4] === nSteps()) finish();
            paint();
          }
          function finish() {
            const k = OUT.findIndex(([, b, c]) => b === st.b && c === st.c);
            const isNew = !found.has(k);
            found.add(k);
            narr.innerHTML = `Finished with <b>b = ${st.b}, c = ${st.c}</b>. ${isNew ? 'New outcome found!' : 'You have seen this outcome before.'} ` +
              (found.size < (micro ? 3 : 2) ? 'Press <b>Run again</b> and try a different order.' : micro ? 'All three outcomes found: same code, three different answers.' : 'Both outcomes found. Now switch to <b>Load / store steps</b>: there is a third.');
          }
          function paint() {
            mem.innerHTML = ['b', 'c'].map((v) => `<div class="r2-cell"><span class="xs muted b">${v}</span><span class="r2-val">${st[v]}</span></div>`).join('');
            [3, 4].forEach((p) => {
              const P = PROG[p], pc = st.pc[p];
              const lines = micro ? ['load b and c', `add; store in ${P.tgt}`] : [P.stmt];
              panels[p].querySelector('.r2-code').innerHTML = lines.map((l, i) => `<div class="r2-ln ${i === pc ? 'cur' : i < pc ? 'done' : ''}">${i < pc ? '✓' : i === pc ? '▸' : '·'} <span class="mono">${esc(l)}</span></div>`).join('');
              panels[p].querySelector('.r2-reg').innerHTML = micro ? (st.reg[p] ? `registers: b = ${st.reg[p].b}, c = ${st.reg[p].c}` : 'registers: empty') : '&nbsp;';
              stepBtn[p].disabled = pc >= nSteps();
            });
            trail.innerHTML = '<span class="xs b muted">YOUR ORDER</span>' + (st.order.length ? st.order.map((p, i) => {
              const k = st.order.slice(0, i + 1).filter((x) => x === p).length;
              return (i ? '<span class="muted">→</span>' : '') + `<span class="chip ${p === 3 ? 'proc' : 'accent'}">${PROG[p].name}${micro ? (k === 1 ? ' load' : ' store') : ''}</span>`;
            }).join('') : '<span class="small muted">nothing run yet</span>');
            tbody.innerHTML = OUT.map(([lbl, b, c], i) => {
              const possible = micro || i < 2;
              const on = found.has(i);
              return `<tr class="${on ? 'on' : ''}"><td>${lbl}</td><td class="mono b">${on ? b : '?'}</td><td class="mono b">${on ? c : '?'}</td><td class="xs">${!possible ? '<span class="muted">impossible with whole statements</span>' : on ? '<span class="chip ok">found</span>' : '<span class="chip">not yet</span>'}</td></tr>`;
            }).join('');
          }
          [3, 4].forEach((p) => {
            stepBtn[p] = h('button', { class: 'btn sm e-b' + PROG[p].cls, type: 'button', onclick: () => run(p) }, 'Step ' + PROG[p].name);
            panels[p] = h('div', { class: 'card tight stack gap-s e-p' + PROG[p].cls },
              h('div', { class: 'row nw' }, h('b', { class: 'pc' + PROG[p].cls }, PROG[p].name + ': ' + PROG[p].stmt), h('span', { class: 'grow' }), stepBtn[p]),
              h('div', { class: 'r2-code' }), h('div', { class: 'xs muted r2-reg' }));
          });
          const seg = ctx.ui.seg([{ value: false, label: 'Whole statements' }, { value: true, label: 'Load / store steps' }], false, (v) => { micro = v; found.clear(); fresh(); narr.innerHTML = v ? 'Now each statement is two steps, as on a real processor: copy b and c into the process’s own <span class="t" data-t="Register">registers</span>, then add and store the sum. Try letting both processes load before either stores.' : 'Each statement runs as one indivisible step.'; paint(); });
          host.append(
            h('div', { class: 'row' }, h('h4', { class: 'm0' }, 'Example 2 · two shared variables'), h('span', { class: 'grow' }), seg),
            h('p', { class: 'small m0', html: 'Shared <code>b = 1</code> and <code>c = 2</code>. <b class="pc1">P3</b> runs <code>b = b + c;</code> and <b class="pc2">P4</b> runs <code>c = b + c;</code>. Choose the order.' }),
            h('div', { class: 'r2-grid' }, panels[3], mem, panels[4]),
            trail,
            h('table', { class: 'tbl compact r2-tbl' }, h('thead', { html: '<tr><th>Order</th><th class="mono">b</th><th class="mono">c</th><th></th></tr>' }), tbody),
            h('div', { class: 'row nw' }, narr, h('button', { class: 'btn sm primary', type: 'button', onclick: () => { fresh(); narr.innerHTML = 'Values reset to b = 1, c = 2. Pick a different order this time.'; paint(); } }, 'Run again')));
          fresh();
          narr.innerHTML = 'Each statement runs as one indivisible step. Step the two processes in either order and record what you get.';
          paint();
        },
      },

      /* ---------------- 4. The OS's four concerns ---------------- */
      {
        title: 'Four jobs concurrency gives the operating system',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const C = [
            { t: 'Keep track of every process', d: 'Know which processes exist, their state, and what each one holds.' },
            { t: 'Allocate and deallocate resources', d: 'Hand out processor time, memory, files and I/O devices, and take them back.' },
            { t: 'Protect each process from the others', d: 'Stop unintended interference with a process’s data and physical resources.' },
            { t: 'Make results independent of speed', d: 'A process must work, and produce the same output, however fast it runs relative to the others.' },
          ];
          let cur = 3, v = 1.5, protect = false;
          const rows = C.map((c, i) => h('button', { class: 'c4-row', type: 'button', onclick: () => { cur = i; paint(); } },
            h('span', { class: 'c4-n' }, String(i + 1)), h('span', { class: 'c4-t' }, h('b', {}, c.t), h('span', { class: 'small muted c4-d' }, c.d))));
          const detail = h('div', { class: 'card white stack c4-detail' });
          /* concern 4: live speed demo */
          const tl = s('svg', { viewBox: '0 0 560 116', width: '100%', role: 'img', 'aria-label': 'When each process runs each line of echo' });
          const band = s('svg', { viewBox: '0 0 560 30', width: '100%', role: 'img', 'aria-label': 'Which speeds give a correct result' });
          const res = h('div', { class: 'row c4-res' });
          const SPEEDS = ctx.util.range(51).map((i) => 0.5 + i * 0.05);
          const X0 = 70, W = 470;
          function drawBand() {
            const k = [];
            SPEEDS.forEach((sp, i) => {
              const ok = speedRun(sp, protect).ok;
              k.push(s('rect', { x: X0 + (i / SPEEDS.length) * W, y: 4, width: W / SPEEDS.length + 0.5, height: 14, style: `fill:var(${ok ? '--ok' : '--bad'});opacity:.6`, 'stroke-width': 0 }));
            });
            const mx = X0 + ((v - 0.5) / 2.55) * W + W / SPEEDS.length / 2;
            k.push(s('path', { d: `M${mx - 6} 29 L${mx} 20 L${mx + 6} 29 Z`, style: 'fill:var(--ink)' }));
            k.push(s('text', { x: 0, y: 16, 'font-size': 13, class: 's-sub' }, 'all speeds'));
            band.replaceChildren(...k);
          }
          function drawTimeline(r) {
            const tmax = Math.max(7, Math.ceil(r.end + 0.6));
            const xt = (t) => X0 + (t / tmax) * W;
            const k = [];
            [[1, 26], [2, 74]].forEach(([p, y]) => {
              k.push(s('text', { x: 0, y: y + 5, 'font-size': 14, 'font-weight': 800, style: `fill:var(${VAR(p)})` }, 'P' + p));
              k.push(s('line', { x1: X0, y1: y, x2: X0 + W, y2: y, class: 's-muted' }));
              if (r.waitFrom[p] != null) {
                const x1 = xt(r.waitFrom[p]), x2 = xt(r.ev.find((e) => e.p === p && e.line === 1).t);
                k.push(s('rect', { x: x1, y: y - 7, width: Math.max(2, x2 - x1), height: 14, rx: 4, class: 's-warn', 'stroke-width': 1 }));
                k.push(s('text', { x: (x1 + x2) / 2, y: y - 12, 'text-anchor': 'middle', 'font-size': 13, style: 'fill:var(--warn)', 'font-weight': 700 }, 'waits'));
              }
            });
            r.ev.forEach((e) => {
              const y = e.p === 1 ? 26 : 74, x = xt(e.t);
              k.push(s('circle', { cx: x, cy: y, r: 11, class: e.p === 1 ? 's-proc' : 's-accent', 'stroke-width': 2 }));
              k.push(s('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, String(e.line)));
            });
            k.push(s('line', { x1: X0, y1: 100, x2: X0 + W, y2: 100, class: 's-line', 'marker-end': 'url(#arr)' }));
            k.push(s('text', { x: X0, y: 115, 'font-size': 13, class: 's-sub' }, 'time →   circles = echo lines 1, 2, 3'));
            tl.replaceChildren(...k);
          }
          function paintDemo() {
            const r = speedRun(v, protect);
            drawTimeline(r); drawBand();
            const mark = (p) => `${PN(p)} showed ${CH(r.shown[p], OWN(r.shown[p]))} ${r.shown[p] === KEY[p] ? '<b style="color:var(--ok)">✓</b>' : '<b style="color:var(--bad)">✗</b>'}`;
            res.innerHTML = `<span class="chip ${r.ok ? 'ok' : 'bad'}">${r.ok ? 'correct' : 'wrong'}</span><span class="small">${mark(1)} · ${mark(2)}</span><span class="small muted">screen: <b class="mono">${r.out.join(' ')}</b></span>`;
            // explain the first harmful overlap, if any
            const idx = { 1: 0, 2: 0 };
            let why = null;
            for (const e of r.ev) {
              const o = 3 - e.p;
              if (!why && e.line === 1 && idx[o] === 1) why = `${PN(e.p)}’s getchar overwrote chin before ${PN(o)} had copied it.`;
              if (!why && e.line === 2 && idx[o] === 2) why = `${PN(e.p)}’s copy overwrote chout before ${PN(o)} had displayed it.`;
              idx[e.p]++;
            }
            whyEl.innerHTML = why ? `<b style="color:var(--bad)">What went wrong:</b> ${why}`
              : r.waitFrom[1] != null || r.waitFrom[2] != null ? `<b style="color:var(--ok)">Why it worked:</b> ${PN(r.waitFrom[1] != null ? 1 : 2)} arrived while the other was inside echo, so it waited. The two calls never overlapped.`
                : `<b>Why it worked:</b> at this speed the two calls did not overlap. That is luck, not design: look at the red on the strip.`;
          }
          const whyEl = h('p', { class: 'small m0 c4-why' });
          const slider = ctx.ui.slider({ label: 'P2’s speed', min: 0.5, max: 3, step: 0.05, value: v, format: (x) => x.toFixed(2) + '×', onInput: (x) => { v = x; paintDemo(); } });
          const prot = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'false', onclick: () => { protect = !protect; prot.setAttribute('aria-pressed', String(protect)); prot.textContent = protect ? 'Protect echo: ON' : 'Protect echo: OFF'; paintDemo(); } }, 'Protect echo: OFF');
          const BODY = [
            () => {
              // a tiny event stepper: each event changes the PCB records, as the OS would
              const EV = [
                ['The disk finishes P2’s read', (t) => { t[1][1] = 'Ready'; t[1][3] = 'the processor'; }, 'A disk interrupt tells the OS that P2’s data has arrived, so it moves P2 from Blocked to Ready.'],
                ['P1’s time slice runs out', (t) => { t[0][1] = 'Ready'; t[0][3] = 'the processor'; t[2][1] = 'Running'; t[2][3] = 'nothing'; }, 'A timer interrupt ends P1’s turn. P1 keeps the printer. The scheduler dispatches P3.'],
                ['P3 asks for the printer', (t) => { t[2][1] = 'Blocked'; t[2][3] = 'the printer (P1 has it)'; t[1][1] = 'Running'; t[1][3] = 'nothing'; }, 'P1 holds the printer, so P3 is blocked and its record says what it waits for. P2 gets the processor.'],
              ];
              let n = 0, prev = null;
              const tb = h('tbody'), note = h('p', { class: 'small m0 c4-note' }), btn = h('button', { class: 'btn sm primary', type: 'button' });
              const table = () => { const t = [['P1', 'Running', 'printer', 'nothing'], ['P2', 'Blocked', 'file F', 'the disk'], ['P3', 'Ready', 'nothing', 'the processor']]; for (let i = 0; i < n; i++) EV[i][1](t); return t; };
              function draw() {
                const t = table();
                tb.innerHTML = t.map((r, i) => `<tr>${r.map((c, j) => `<td class="${prev && prev[i][j] !== c ? 'c4-chg' : ''}">${j === 0 ? `<b class="pc${i + 1}">${c}</b>` : c}</td>`).join('')}</tr>`).join('');
                note.innerHTML = n ? `<b>Event ${n}:</b> ${EV[n - 1][2]}` : 'Press the button to send the OS an event and watch it update its records.';
                btn.textContent = n < EV.length ? `Next event: ${EV[n][0]}` : 'Start over';
              }
              btn.onclick = () => { prev = n < EV.length ? table() : null; n = n < EV.length ? n + 1 : 0; draw(); };
              draw();
              return h('div', { class: 'stack' },
                h('p', { class: 'm0', html: 'The OS keeps a <span class="t">process control block</span> for every process: its state, its priority, the resources it holds and what it is waiting for.' }),
                h('table', { class: 'tbl compact' }, h('thead', { html: '<tr><th>Process</th><th>State</th><th>Holds</th><th>Waiting for</th></tr>' }), tb),
                h('div', { class: 'row nw' }, btn), note,
                h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'Every later decision (who runs, who waits, who gets the printer) starts by looking up these records.' }));
            },
            () => h('div', { class: 'stack', html: `
              <p class="m0">Every active process needs resources, and the OS decides who gets each one, when, and when to take it back:</p>
              <div class="grid-2">
                <div class="box cpu small"><b>Processor time</b><br>who runs next, and for how long</div>
                <div class="box mem small"><b>Memory</b><br>which parts of memory each process may use</div>
                <div class="box os small"><b>Files</b><br>who may open, read or change each file</div>
                <div class="box io small"><b>I/O devices</b><br>who gets the printer or an I/O channel</div>
              </div>
              <div class="card tight stack gap-s">
                <h4 class="m0">Example: the idle I/O channel</h4>
                <svg viewBox="0 0 540 84" width="100%" role="img" aria-label="Suspended P1 holds an idle I/O channel that P2 is waiting for">
                  <rect x="4" y="12" width="140" height="56" rx="10" class="s-proc" stroke-width="2"/><text x="74" y="36" text-anchor="middle" font-weight="800" style="fill:var(--proc)">P1</text><text x="74" y="56" text-anchor="middle" font-size="13">suspended</text>
                  <line x1="146" y1="40" x2="196" y2="40" class="s-line" marker-end="url(#arr)"/><text x="171" y="30" text-anchor="middle" font-size="13" class="s-sub">holds</text>
                  <rect x="200" y="12" width="140" height="56" rx="10" class="s-io" stroke-width="2"/><text x="270" y="36" text-anchor="middle" font-weight="800">I/O channel</text><text x="270" y="56" text-anchor="middle" font-size="13">idle, locked</text>
                  <line x1="394" y1="40" x2="344" y2="40" class="s-line" stroke-dasharray="5 4" marker-end="url(#arr)"/><text x="369" y="30" text-anchor="middle" font-size="13" class="s-sub">wants</text>
                  <rect x="398" y="12" width="138" height="56" rx="10" class="s-accent" stroke-width="2"/><text x="467" y="36" text-anchor="middle" font-weight="800" style="fill:var(--accent)">P2</text><text x="467" y="56" text-anchor="middle" font-size="13">waiting</text>
                </svg>
                <p class="small m0">P1 was granted the channel, then suspended before using it. Keep it locked and the channel sits idle while P2 waits (with a risk of deadlock). Take it away and P1’s request is broken. Unpredictable speed makes the right choice hard to know.</p>
              </div>` }),
            () => h('div', { class: 'stack', html: `
              <p class="m0">One process must not damage another by accident: it must not overwrite another’s memory, corrupt its files or seize its devices.</p>
              <svg viewBox="0 0 560 128" width="100%" role="img" aria-label="P2 is stopped from writing into P1's memory">
                <rect x="20" y="6" width="200" height="98" rx="12" class="s-proc" stroke-width="2"/><text x="120" y="30" text-anchor="middle" font-weight="800" style="fill:var(--proc)">P1’s memory and files</text>
                <rect x="45" y="44" width="150" height="44" rx="8" class="s-panel" stroke-width="1.5"/><text x="120" y="72" text-anchor="middle" font-size="14">balance = 500</text>
                <rect x="340" y="6" width="200" height="98" rx="12" class="s-accent" stroke-width="2"/><text x="440" y="30" text-anchor="middle" font-weight="800" style="fill:var(--accent)">P2</text>
                <text x="440" y="66" text-anchor="middle" font-size="14">buggy write to</text><text x="440" y="84" text-anchor="middle" font-size="14">the wrong address</text>
                <line x1="336" y1="66" x2="206" y2="66" class="s-line" style="stroke:var(--intr)" stroke-width="3" stroke-dasharray="7 5" marker-end="url(#arr-intr)"/>
                <rect x="252" y="40" width="44" height="52" rx="8" class="s-os" stroke-width="2"/><text x="274" y="75" text-anchor="middle" font-size="26" font-weight="800" style="fill:var(--intr)">✗</text>
                <text x="274" y="122" text-anchor="middle" font-size="13" class="s-sub">OS + hardware block it</text>
              </svg>
              <div class="grid-3">
                <div class="box mem small"><b>Memory</b><br>each process has its own <span class="t">address space</span>; hardware checks every access</div>
                <div class="box os small"><b>Files</b><br>permissions decide who may read or change each file</div>
                <div class="box io small"><b>Devices</b><br>processes reach devices only by asking the OS</div>
              </div>
              <div class="callout warn small m0" data-label="Common mistake">Thinking protection solves races. It stops <i>unintended</i> interference. Processes that share data <i>on purpose</i>, like the two echo callers, still need the synchronization tools of this chapter.</div>` }),
            () => h('div', { class: 'stack gap-s' },
              h('p', { class: 'small m0', html: `The echo procedure again, with chin and chout in shared memory. ${PN(1)} calls it after a little work; ${PN(2)} does a bit more work first. Drag ${PN(2)}’s speed and watch the result.` }),
              h('div', { class: 'row nw' }, h('div', { class: 'grow' }, slider), prot),
              band, tl, res, whyEl,
              h('p', { class: 'small m0 muted', html: 'The strip shows every speed from 0.5× to 3×: green gives a correct result, red a wrong one. Without protection the answer depends on speed, which breaks this rule. With it, every speed works.' })),
          ];
          function paint() {
            rows.forEach((r, i) => r.classList.toggle('on', i === cur));
            detail.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'c4-n big-n' }, String(cur + 1)), h('h3', { class: 'm0' }, C[cur].t)), BODY[cur]());
            if (cur === 3) paintDemo();
            ctx.refit();
          }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'Timing trouble is not only the programmer’s problem. Concurrency hands the OS four responsibilities.' }),
              h('div', { class: 'stack gap-s' }, ...rows),
              h('div', { class: 'callout why small m0', 'data-label': 'Where each is handled', html: 'Jobs 1 to 3 use the OS’s process, memory, file and I/O management. Job 4 is what the rest of this chapter is about. Click each job to explore it.' })),
            detail));
          paint();
        },
      },

      /* ---------------- 5. Degrees of awareness ---------------- */
      {
        title: 'How aware are processes of each other?',
        kind: 'compare',
        render(el, ctx) {
          const { h } = ctx;
          const COLS = [
            { name: 'Unaware of each other', ex: 'separate programs that happen to run at the same time',
              rel: '<span class="t">Competition</span>', inf: 'Each one’s results do <b>not</b> depend on the others. Its <b>timing</b> can suffer (it may wait for a resource).',
              prob: ['Mutual exclusion', 'Deadlock (renewable resource)', 'Starvation'] },
            { name: 'Indirectly aware', ex: 'processes that share an object, such as a variable, file or buffer',
              rel: '<span class="t">Cooperation by sharing</span>', inf: 'Results <b>may depend</b> on information obtained from the others. Timing can suffer.',
              prob: ['Mutual exclusion', 'Deadlock (renewable resource)', 'Starvation', 'Data coherence'] },
            { name: 'Directly aware', ex: 'processes that name each other and exchange messages',
              rel: '<span class="t">Cooperation by communication</span>', inf: 'Results <b>may depend</b> on information obtained from the others. Timing can suffer.',
              prob: ['Deadlock (consumable resource)', 'Starvation'] },
          ];
          const ROWS = [['Relationship', 'rel'], ['Influence on each other', 'inf'], ['Control problems', 'prob']];
          const shown = new Set();
          const cells = [];   // cells[col] = [td, ...]
          const head = h('tr', {}, h('th', {}, ''), ...COLS.map((c, i) => h('th', { class: 'aw-h aw-c' + i }, h('div', {}, c.name), h('div', { class: 'aw-ex' }, 'e.g. ' + c.ex))));
          const body = ROWS.map(([label, key]) => h('tr', {}, h('td', { class: 'aw-lbl' }, label), ...COLS.map((c, i) => {
            const td = h('td', { class: 'aw-cell aw-c' + i });
            td.dataset.key = key;
            (cells[i] = cells[i] || []).push(td);
            return td;
          })));
          function fill(i) {
            cells[i].forEach((td) => {
              const key = td.dataset.key, c = COLS[i];
              if (shown.has(i)) td.innerHTML = key === 'prob' ? c.prob.map((p) => `<div class="aw-p">${p}</div>`).join('') : c[key];
              else { td.innerHTML = ''; td.append(h('button', { class: 'btn sm ghost aw-rev', type: 'button', onclick: () => { shown.add(i); fill(i); ctx.refit(); } }, 'Reveal')); }
            });
          }
          COLS.forEach((_, i) => fill(i));
          const hl = (i) => el.querySelectorAll('.aw-cell, .aw-h').forEach((c) => c.classList.toggle('aw-on', i != null && c.classList.contains('aw-c' + i)));
          /* ----- classifier ----- */
          const SC = [
            ['Two word processors, started by different users, both send documents to the one printer.', 0, 'Neither program knows the other exists. They simply compete for the printer, and the OS must referee.'],
            ['The threads of a web server all add 1 to the same shared visit counter.', 1, 'They never talk to each other, but they all read and write one shared variable, so they cooperate by sharing.'],
            ['A client process sends a request message to a named server process and waits for its reply.', 2, 'They know each other by name and interact only through messages: cooperation by communication.'],
            ['Several processes update records in one shared database file, relying on what the others wrote.', 1, 'They are linked only through the shared file. Its records must stay consistent (data coherence).'],
            ['Batch jobs from different users each need the same tape drive at some point.', 0, 'The jobs are independent and unaware of each other. Only the tape drive links them, so they compete for it.'],
            ['Stage 1 of a pipeline calls send() with each finished record; stage 2 calls receive() to get it.', 2, 'The stages communicate directly with message primitives. Nothing is shared, so no mutual exclusion is needed.'],
          ];
          let k = 0, score = 0, answered = false;
          const res = [];
          const qText = h('div', { class: 'card aw-q' });
          const fb = h('div', { class: 'aw-fb small' });
          const prog = h('span', { class: 'chip accent' });
          const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { if (k < SC.length - 1) { k++; show(); } else { k = 0; score = 0; res.length = 0; show(); } } }, 'Next scenario');
          const choices = COLS.map((c, i) => h('button', { class: 'btn aw-choice', type: 'button', onclick: () => answer(i) }, c.name));
          function show() {
            answered = false; hl(null);
            qText.innerHTML = `<span class="xs b muted">SCENARIO ${k + 1} OF ${SC.length}</span><div>${SC[k][0]}</div>`;
            fb.innerHTML = '<span class="muted">Pick the degree of awareness. The matching column of the table lights up.</span>';
            choices.forEach((b) => { b.disabled = false; b.classList.remove('aw-right', 'aw-wrong'); });
            next.disabled = true; next.textContent = k < SC.length - 1 ? 'Next scenario' : 'Start over';
            prog.textContent = `${score} / ${res.length} correct`;
          }
          function answer(i) {
            if (answered) return;
            answered = true;
            const [, want, why] = SC[k];
            const ok = i === want;
            if (ok) score++;
            res.push(ok);
            choices.forEach((b, j) => { b.disabled = true; if (j === want) b.classList.add('aw-right'); else if (j === i) b.classList.add('aw-wrong'); });
            shown.add(want); fill(want); hl(want);
            fb.innerHTML = `<b style="color:var(${ok ? '--ok' : '--bad'})">${ok ? 'Correct.' : 'Not quite.'}</b> ${why} <span class="muted">Problems to watch: ${COLS[want].prob.join(', ')}.</span>` +
              (k === SC.length - 1 ? ` <b>Done: ${score} of ${SC.length} correct.</b>` : '');
            next.disabled = false;
            prog.textContent = `${score} / ${res.length} correct`;
            ctx.refit();
          }
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'Processes interact in three ways, depending on their <span class="t">degree of awareness</span> of each other.' }),
              h('table', { class: 'tbl aw-tbl' }, h('thead', {}, head), h('tbody', {}, ...body)),
              h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', onclick: () => { COLS.forEach((_, i) => { shown.add(i); fill(i); }); ctx.refit(); } }, 'Reveal all'),
                h('span', { class: 'small muted grow' }, 'Real processes often mix these; the table shows the pure cases.'))),
            h('div', { class: 'card white stack aw-game' },
              h('div', { class: 'row' }, h('h4', { class: 'm0 grow' }, 'Classify the scenario'), prog),
              qText, h('div', { class: 'stack gap-s' }, ...choices), fb, h('div', { class: 'row' }, h('span', { class: 'grow' }), next))));
          show();
        },
      },

      /* ---------------- 6. Competition: critical sections, deadlock, starvation ---------------- */
      {
        title: 'Competition: one resource, many processes',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const code = ctx.ui.code(`
void P(int i) {       // same shape for P1, P2, P3
  while (true) {      // each process loops forever
    entercritical(R); // wait here while R is busy
    use(R);           // critical section: uses R
    exitcritical(R);  // free R, let one waiter in
    other_work();     // remainder: needs no R
  }                   // then around again
}                     // end of process P(i)`, { lang: 'c', fontSize: 13.5 });
          const tabs = ctx.ui.tabs([
            { label: 'Mutual exclusion', render: (p) => { p.append(mutexLab(ctx)); } },
            { label: 'Deadlock', render: (p) => { p.append(deadlockLab(ctx)); } },
            { label: 'Starvation', render: (p) => { p.append(starveLab(ctx)); } },
          ], { onChange: () => ctx.after(40, () => ctx.refit()) });
          tabs.classList.add('cp-tabs');
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack cp-left' },
              h('p', { class: 'lead m0', html: 'Processes that know nothing about each other still <span class="t" data-t="Competition">compete</span> for processors, memory, files and devices.' }),
              h('p', { class: 'small m0', html: 'Some resources can serve only one process at a time, like a printer: a <span class="t">critical resource</span>. The code that uses it is that process’s <span class="t">critical section</span>. <span class="t">Mutual exclusion</span> means at most one process is in its critical section for that resource at any moment.' }),
              code,
              h('p', { class: 'small m0', html: 'The mechanism is hidden behind two calls, <code>entercritical</code> and <code>exitcritical</code>. Competing processes exchange no information, yet one’s <b>timing</b> is affected: it may be kept waiting.' }),
              h('div', { class: 'callout why small m0', 'data-label': 'Two new dangers', html: 'Enforcing mutual exclusion creates two new problems: <span class="t">deadlock</span> and <span class="t">starvation</span>. Explore each tab.' })),
            h('div', { class: 'card white' }, tabs)));
        },
      },

      /* ---------------- 7. Cooperation: by sharing (data coherence) and by communication ---------------- */
      {
        title: 'Cooperation: sharing data and passing messages',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack co-left' },
              h('h4', { class: 'm0' }, 'Cooperation by sharing'),
              h('p', { class: 'small m0', html: 'In <span class="t">cooperation by sharing</span>, processes read and write the same data without talking to each other. Many may read at once, but a writer needs exclusive access, and there is a new demand: <span class="t">data coherence</span>. Here the rule is <b>a = b</b>, an <span class="t">invariant</span>.' }),
              coherenceLab(ctx),
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Locking a and b separately is not enough. Make each <b>whole pair</b> one critical section.' })),
            h('div', { class: 'card stack co-right' },
              h('h4', { class: 'm0' }, 'Cooperation by communication'),
              h('p', { class: 'small m0', html: 'In <span class="t">cooperation by communication</span>, processes know each other by name and exchange messages with <span class="t" data-t="Communication primitive">communication primitives</span> such as <code>send</code> and <code>receive</code>. Nothing is shared, so mutual exclusion is not needed. Deadlock and starvation still are.' }),
              messageLab(ctx))));
        },
      },

      /* ---------------- 8. The six requirements for mutual exclusion ---------------- */
      {
        title: 'Six requirements any mutual exclusion scheme must meet',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const REQ = [
            ['Only one process inside', 'Among all processes with critical sections for the same resource, at most one may be inside at a time.'],
            ['Halting outside must not hurt others', 'A process that stops in its non-critical code must not stop the others from entering.'],
            ['No deadlock and no starvation', 'A process that wants to enter must never be delayed forever.'],
            ['Free means enter at once', 'If nobody is inside, a process that asks to enter gets in without delay.'],
            ['No assumptions about speed or CPUs', 'The scheme must work whatever the relative speeds and however many processors.'],
            ['Stay inside for a finite time', 'A process must leave its critical section after a finite time.'],
          ];
          const SC = [
            ['Two processes reach the entry code at the same instant, and the scheme lets both of them in.', 0, 'Two processes in their critical sections at once is exactly what mutual exclusion forbids.'],
            ['Processes must take strict turns. P2 halts for good while in its remainder code, far from any critical section, and now P1 can never get another turn.', 1, 'P1 does end up waiting forever, but the root cause is a process that halted <b>outside</b> its critical section. A correct scheme must not depend on what a process does, or fails to do, out there.'],
            ['When the printer is freed, the lowest-numbered waiting process always gets it next. Under heavy load, P9 may wait forever.', 2, 'P9 is ready yet passed over indefinitely: starvation, which this requirement rules out.'],
            ['The critical section is empty, but a process that asks to enter is told to wait for the next timer tick first.', 3, 'Nobody is inside, so the request should be granted at once. Needless waiting wastes time.'],
            ['The scheme is only correct if the process holding the lock always runs faster than the processes waiting for it.', 4, 'Relative speed cannot be predicted (it depends on the scheduler, interrupts and other processes), so a correct scheme cannot rely on it.'],
            ['Inside its critical section, a process waits for a user to type a reply, which may never come.', 5, 'Everyone else waiting for this resource is held up for as long as it stays inside, possibly forever.'],
            ['P1 holds lock A and waits for lock B. P2 holds lock B and waits for lock A.', 2, 'This is deadlock: both are delayed forever.'],
            ['It was tested on a one-core laptop and relies on only one process running at any instant. On a four-core server it fails.', 4, 'On four cores it may even let two processes in, but the root cause is the assumption about the number of processors. On a multiprocessor, processes truly overlap.'],
          ];
          let k = 0, answered = false;
          const res = [];
          const tally = REQ.map(() => 0);
          const scn = h('div', { class: 'card white rq-scn' });
          const fb = h('div', { class: 'callout small m0 rq-fb', 'data-label': 'How to play' });
          const dots = h('div', { class: 'rq-dots' });
          const score = h('span', { class: 'chip accent' });
          const next = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { if (k < SC.length - 1) { k++; show(); } else { k = 0; res.length = 0; tally.fill(0); show(); } } }, 'Next proposal');
          const btns = REQ.map(([t, d], i) => h('button', { class: 'rq', type: 'button', onclick: () => answer(i) },
            h('span', { class: 'rq-n' }, String(i + 1)), h('span', { class: 'rq-t' }, h('b', {}, t), h('span', { class: 'rq-d' }, d)), h('span', { class: 'rq-tally' })));
          function paint() {
            dots.innerHTML = SC.map((_, i) => `<i class="${i < res.length ? (res[i] ? 'ok' : 'bad') : ''} ${i === k ? 'cur' : ''}"></i>`).join('');
            score.textContent = `${res.filter(Boolean).length} / ${res.length} correct`;
            btns.forEach((b, i) => { b.querySelector('.rq-tally').innerHTML = tally[i] ? `<span class="chip ok">spotted ${tally[i] > 1 ? tally[i] + '×' : ''}✓</span>` : ''; });
          }
          function show() {
            answered = false;
            btns.forEach((b) => { b.disabled = false; b.classList.remove('right', 'wrong'); });
            scn.innerHTML = `<div class="xs b muted">PROPOSED SCHEME ${k + 1} OF ${SC.length}</div><div>${SC[k][0]}</div>`;
            fb.className = 'callout small m0 rq-fb'; fb.dataset.label = 'Your move';
            fb.innerHTML = 'Each proposal has one root flaw. Click the requirement in the list that it most directly breaks.';
            next.disabled = true; next.textContent = k < SC.length - 1 ? 'Next proposal' : 'Play again';
            paint();
          }
          function answer(i) {
            if (answered) return;
            answered = true;
            const [, want, why] = SC[k], ok = i === want;
            res.push(ok);
            if (ok) tally[want]++;
            btns.forEach((b, j) => { b.disabled = true; if (j === want) b.classList.add('right'); else if (j === i) b.classList.add('wrong'); });
            fb.className = 'callout small m0 rq-fb ' + (ok ? 'tip' : 'bad');
            fb.dataset.label = ok ? 'Correct' : 'Not quite';
            fb.innerHTML = `${ok ? '' : `You chose requirement ${i + 1} (${REQ[i][0].toLowerCase()}), but this proposal breaks <b>requirement ${want + 1}: ${REQ[want][0].toLowerCase()}</b>. `}${why}` +
              (k === SC.length - 1 ? ` <b>Finished: ${res.filter(Boolean).length} of ${SC.length} correct.</b>` : '');
            next.disabled = false;
            paint();
          }
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack rq-list' },
              h('p', { class: 'lead m0', html: 'Whatever tool provides mutual exclusion, whether software, hardware or the OS, it must meet all six.' }),
              ...btns),
            h('div', { class: 'stack rq-game' },
              h('div', { class: 'row' }, h('h4', { class: 'm0 grow' }, 'Spot the broken requirement'), score),
              dots, scn, fb, h('div', { class: 'row' }, h('span', { class: 'small muted grow', html: 'Hint: ask who ends up waiting, and why.' }), next),
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'Look back at 5.1: Attempt 2 broke requirement 1, Attempt 1 broke 2 and 4, and Attempts 3 and 4 broke 3. The next sections judge every mechanism (hardware instructions, semaphores, monitors, messages) against this same checklist.' }))));
          show();
        },
      },

      /* ---------------- 9. Recap ---------------- */
      {
        title: 'Recap: six ideas to carry forward',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. Click again to flip it back.'),
            ctx.ui.flipcards([
              ['Why is concurrency hard?', '<span>Relative speed is unpredictable. It depends on other processes, interrupts and the scheduler, so sharing, allocation and debugging all get harder.</span>'],
              ['What went wrong in echo?', '<span>The globals chin and chout sat in memory shared by both callers. A second caller overwrote them while the first was still inside echo. Fix: one caller inside at a time.</span>'],
              ['What is a race condition?', '<span>Processes read and write shared data and the result depends on the timing of their steps. The <b>last</b> writer decides the value.</span>'],
              ['The OS’s four concerns?', '<span>Track every process · allocate and reclaim resources · protect each process from the others · make results independent of speed.</span>'],
              ['Three ways processes interact?', '<span>Unaware → competition. Indirectly aware (shared object) → cooperation by sharing. Directly aware (messages) → cooperation by communication.</span>'],
              ['The six requirements?', '<span>One inside at a time · halting outside harms no one · no deadlock or starvation · free means enter at once · no speed or CPU assumptions · finite stay inside.</span>'],
            ], { cols: 3, height: 176 }),
            h('div', { class: 'row rc-row' },
              h('span', { class: 'chip io' }, 'Competition: mutual exclusion, deadlock, starvation'),
              h('span', { class: 'chip mem' }, 'Sharing: all three + data coherence'),
              h('span', { class: 'chip proc' }, 'Communication: deadlock, starvation')),
            h('div', { class: 'callout why small m0', 'data-label': 'Next', html: 'Section 5.3 shows how the hardware itself can help enforce mutual exclusion, and what that help costs.' })));
        },
      },

      /* ---------------- 10. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'The globals <code>chin</code> and <code>chout</code> sit in memory shared by two processes, which call the echo procedure at the same time, each on <b>its own processor</b>. The steps happen in this order: P1 reads <b>x</b> into chin; P2 reads <b>y</b> into chin; P1 copies chin into chout; P2 copies chin into chout; P1 displays chout; P2 displays chout. What appears on the screen?',
            choices: ['x, then y', 'y, then y', 'x, then x', 'y, then x'], answer: 1,
            feedback: ['That is the output we wanted, but it needs P1 to copy chin before P2 overwrites it. Here P2 put y into chin first.', null, 'x never reaches chout: by the time either process copies chin, it already holds y.', 'Neither process displays x. Both copy chin after it holds y, so both display y.'],
            why: 'A second processor does not help. P2 overwrote the shared chin with y before P1 copied it, so both processes put y into chout and both displayed y. The x was lost exactly as on one processor, but no interrupt was needed.' },
          { type: 'order', q: 'Put the classic echo failure (one processor; chin and chout in memory both processes share) in the order it happens.',
            items: ['P1 reads x into chin', 'P1 is interrupted before copying chin', 'P2 runs echo completely and displays y', 'P1 resumes and copies chin (now y) into chout', 'P1 displays y; the x is lost'],
            why: 'The damage happens in the gap between P1 reading chin and P1 copying it: P2 overwrote the shared variable in that gap.' },
          { type: 'tf', q: 'In a race condition, the process that writes to the shared variable first decides its final value.', answer: false,
            why: 'The first value is simply overwritten. The last process to write (the loser of the race) decides the final value.' },
          { type: 'num', q: 'Shared variables start at b = 1 and c = 2. P3 executes <code>b = b + c;</code> and P4 executes <code>c = b + c;</code>. If P4 runs completely and then P3 runs, what is the final value of b?',
            answer: 4, tol: 0,
            why: 'P4 first: c = 1 + 2 = 3. Then P3: b = 1 + 3 = 4. (In the opposite order you get b = 3, c = 5.)' },
          { type: 'multi', q: 'Which of these are concerns the operating system must handle because processes run concurrently?',
            choices: ['Keep track of every process', 'Allocate and deallocate resources', 'Protect each process’s data and resources from the others', 'Make a process’s results independent of its relative speed', 'Make every process run at the same speed', 'Remove all resources that processes share'],
            answer: [0, 1, 2, 3],
            why: 'The four concerns are tracking, allocation, protection and speed-independent results. The OS cannot equalise speeds, and sharing resources is unavoidable.' },
          { type: 'match', q: 'Match each degree of awareness to the relationship it produces.',
            pairs: [['Unaware of each other', 'Competition'], ['Indirectly aware, through a shared object', 'Cooperation by sharing'], ['Directly aware, by name', 'Cooperation by communication']],
            why: 'Unaware processes only compete for resources. Processes linked by shared data cooperate by sharing. Processes that name each other and exchange messages cooperate by communication.' },
          { type: 'bucket', q: 'Sort each situation by how the processes interact.', buckets: ['Competition', 'Cooperation by sharing', 'Cooperation by communication'],
            items: [['Two unrelated batch jobs both need the one tape drive', 0], ['Threads of a server all update one shared counter', 1], ['A client sends a request message to a named server', 2], ['Several processes update records in one shared file', 1], ['Pipeline stages pass records with send and receive', 2], ['Programs from two users both print on the office printer', 0]],
            why: 'No shared data and no messages means competition. A shared variable or file means cooperation by sharing. Named processes exchanging messages means cooperation by communication.' },
          { q: 'The part of a program that uses a resource which only one process may use at a time is called the…',
            choices: ['critical section', 'critical resource', 'remainder section', 'global variable'], answer: 0,
            feedback: [null, 'The critical resource is the resource itself (the printer), not the code that uses it.', 'The remainder section is the code that does not use the resource.', 'A global variable may be shared data, but the question asks for the piece of code.'],
            why: 'The resource is the critical resource; the code that uses it is the critical section. Mutual exclusion allows at most one process in its critical section for that resource.' },
          { type: 'multi', q: 'Which statements about deadlock and starvation are true?',
            choices: ['In deadlock, each process in the group waits for something only another member of the group can provide', 'During starvation the rest of the system can keep doing useful work', 'Enforcing mutual exclusion can lead to either problem', 'Starvation requires a circle of processes waiting for each other'],
            answer: [0, 1, 2],
            why: 'Deadlock is a closed circle of waiting, so nobody in it moves. Starvation needs no circle: the system runs, but one process is passed over indefinitely. Both can arise from how mutual exclusion is enforced.' },
          { type: 'num', q: 'Shared a = b = 1 and the rule a = b must hold. P1 runs <code>a = a + 1; b = b + 1;</code> and P2 runs <code>b = 2 * b; a = 2 * a;</code>. Each process keeps its own two statements in order. Of the six possible interleavings of the four statements, how many finish with a ≠ b?',
            answer: 4, tol: 0,
            why: 'Only the two orders where one process runs completely first keep a = b (giving 4, 4 or 3, 3). All four mixed orders finish with a = 4, b = 3.' },
          { q: 'A proposed lock is correct only if the process holding it always runs faster than the processes waiting for it. Which requirement for mutual exclusion does it break?',
            choices: ['Only one process may be in its critical section at a time', 'No assumptions may be made about relative speeds or the number of processors', 'A process must leave its critical section after a finite time', 'A process asking to enter a free critical section must get in without delay'], answer: 1,
            feedback: ['The lock may keep processes out correctly under its assumption; the problem is the assumption itself.', null, 'Nothing here says a process stays inside forever.', 'Nothing here describes needless waiting at a free critical section.'],
            why: 'Relative speeds depend on the scheduler, interrupts and other processes, so they cannot be predicted. A correct scheme must work at any speed.' },
          { q: 'Processes that cooperate only by sending and receiving messages share no data. Which control problem therefore does <b>not</b> arise for them?',
            choices: ['Mutual exclusion', 'Deadlock', 'Starvation', 'All three still arise'], answer: 0,
            feedback: [null, 'Deadlock can still happen: two processes may each wait to receive a message from the other.', 'Starvation can still happen: one process may keep being passed over while others exchange messages.', 'Mutual exclusion is not needed, because nothing is shared.'],
            why: 'With nothing shared there is nothing to lock. Deadlock (both waiting in receive) and starvation (one process never answered) still can occur. Messages can also serve as a tool: in Section 5.6 a single token message enforces mutual exclusion on a resource that is shared.' },
        ],
      },

    ],

    notes: `
<h3>Why concurrency is hard</h3>
<p>On one processor the OS <b>interleaves</b> processes (a slice of one, then another). On a multiprocessor they are interleaved and also <b>overlapped</b> (truly running at the same instant). Both raise the same problems, because a process’s <b>relative speed</b> cannot be predicted: it depends on what other processes do, how the OS handles interrupts, and the OS’s scheduling policy. Three difficulties follow:</p>
<ol>
<li><b>Sharing global resources is risky:</b> if two processes read and write the same global variable, the order of their steps decides the result.</li>
<li><b>Optimal allocation is hard:</b> if P1 is granted an I/O channel and suspended before using it, locking the channel for P1 leaves it idle while others wait (and can lead to deadlock).</li>
<li><b>Errors are hard to locate:</b> results are nondeterministic, so a failure may not repeat when you rerun the program.</li>
</ol>
<h3>The echo example</h3>
<p><b>The assumption that makes the race possible:</b> to save memory, the OS loads echo <b>and its global variables</b> once, into a region of memory shared by every application, so all callers use the same chin and chout. (The same holds if the callers are threads of one process.) Sharing code alone would not be enough: separate processes running the same program normally get private copies of its globals.</p>
<pre>char chin, chout;    // in shared memory: one copy for all callers
void echo() {        // any process may call it
  chin = getchar();  // 1. read a key into chin
  chout = chin;      // 2. copy it into chout
  putchar(chout);    // 3. display chout
}                    // return to the caller</pre>
<p><b>One processor:</b> P1 reads <b>x</b> into chin and is interrupted. P2 runs echo completely, reading and displaying <b>y</b>. P1 resumes, copies chin (now y) and displays y: x is lost, y appears twice. <b>Two processors:</b> no interrupt is needed. P1 reads x, P2 reads y, both copy chin (y) into chout, and both display y. <b>Fix:</b> let only one process be inside echo at a time; a second caller is blocked at the entrance until the first returns. The cause is shared data, not the number of processors.</p>
<h3>Race conditions</h3>
<p>A <b>race condition</b> occurs when several processes or threads read and write shared data and the final result depends on the relative timing of their execution. When writes collide, the “loser” of the race (the last writer) decides the value.</p>
<ul>
<li>Shared <code>a</code>: P1 runs <code>a = 1</code>, P2 runs <code>a = 2</code>. Whichever runs last leaves its value.</li>
<li>Shared b = 1, c = 2: P3 runs <code>b = b + c</code>, P4 runs <code>c = b + c</code>. P3 then P4: b = 3, c = 5. P4 then P3: b = 4, c = 3. If both load b and c before either stores its sum, b = 3 and c = 3.</li>
</ul>
<p>A correct program must give the right answer for <b>every</b> possible interleaving.</p>
<h3>Four OS concerns</h3>
<ol>
<li><b>Keep track of the processes</b>, using a process control block for each (state, priority, resources held, what it waits for).</li>
<li><b>Allocate and deallocate resources</b>: processor time, memory, files and I/O devices.</li>
<li><b>Protect</b> each process’s data and physical resources against unintended interference by others (address spaces, file permissions, access to devices only through the OS).</li>
<li><b>Make results independent of speed:</b> a process’s function and output must not depend on how fast it runs relative to other processes. This is the subject of the rest of the chapter.</li>
</ol>
<h3>How processes interact: degree of awareness</h3>
<table>
<tr><th>Degree of awareness</th><th>Relationship</th><th>Influence on each other</th><th>Control problems</th></tr>
<tr><td>Unaware of each other</td><td>Competition</td><td>Results independent of the others; timing may suffer</td><td>Mutual exclusion, deadlock (renewable resource), starvation</td></tr>
<tr><td>Indirectly aware (shared object)</td><td>Cooperation by sharing</td><td>Results may depend on information from the others; timing may suffer</td><td>Mutual exclusion, deadlock (renewable resource), starvation, data coherence</td></tr>
<tr><td>Directly aware (named, messages)</td><td>Cooperation by communication</td><td>Results may depend on information from the others; timing may suffer</td><td>Deadlock (consumable resource), starvation</td></tr>
</table>
<p>A <b>renewable</b> (reusable) resource, such as a processor, memory or an I/O channel, is released and reused. A <b>consumable</b> resource, such as a message, is destroyed when a process receives it.</p>
<h3>Competition among processes</h3>
<p>A <b>critical resource</b> can be used by only one process at a time (a printer). The code that uses it is the process’s <b>critical section</b>. <b>Mutual exclusion</b>: at most one process at a time is in its critical section for that resource. Competing processes exchange no information, but one may be delayed while another uses the resource.</p>
<pre>void P(int i) {        // same shape for every process
  while (true) {       // loop forever
    entercritical(R);  // wait here while R is busy
    use(R);            // critical section
    exitcritical(R);   // free R, let one waiter in
    other_work();      // remainder: needs no R
  }                    // around again
}                      // end of P(i)</pre>
<p>A process that finds R busy waits in <code>entercritical</code>; <code>exitcritical</code> lets a waiter in. Without them, two processes can print at once and their pages mix. Enforcing mutual exclusion creates two new problems:</p>
<ul>
<li><b>Deadlock:</b> P1 and P2 both need R1 and R2. P1 holds R1 and waits for R2; P2 holds R2 and waits for R1. Neither can ever continue, though each program is fine alone. Asking for resources in the same order prevents this circle.</li>
<li><b>Starvation:</b> P1, P2 and P3 all want R repeatedly. If the OS keeps handing R to P1 and P3 in turn, P2 is passed over indefinitely even though there is no deadlock and work continues. A fair policy such as first come, first served avoids it.</li>
</ul>
<h3>Cooperation by sharing</h3>
<p>Processes share variables, files or databases without knowing each other’s identity. Many may read at once, but a writer needs exclusive access, so mutual exclusion, deadlock and starvation apply. The new demand is <b>data coherence</b>: every required relationship (an <b>invariant</b>) must still hold after concurrent updates.</p>
<p>Example: a = b = 1 and the rule a = b. P1 runs <code>a = a + 1; b = b + 1;</code> and P2 runs <code>b = 2 * b; a = 2 * a;</code>. Each keeps a = b when run alone (P1 then P2 gives 4, 4; P2 then P1 gives 3, 3). Every one of the four mixed orders, such as a = a + 1, b = 2 * b, b = b + 1, a = 2 * a, gives <b>a = 4, b = 3</b>. Protecting each variable separately is not enough: the <b>whole sequence</b> of updates in each process must be one critical section.</p>
<h3>Cooperation by communication</h3>
<p>Processes know each other by name and exchange messages using <b>communication primitives</b> (send, receive) supplied by the OS or the language. Nothing is shared, so mutual exclusion is not a control requirement. <b>Deadlock</b> is still possible (P1 waits to receive from P2 while P2 waits to receive from P1), and so is <b>starvation</b> (P2 and P3 both want to talk to P1, but P1 keeps exchanging messages with P2, so P3 is never served).</p>
<h3>Six requirements for mutual exclusion</h3>
<ol>
<li>Mutual exclusion must be enforced: among all processes with critical sections for the same resource or shared object, only one at a time may be inside.</li>
<li>A process that halts in its non-critical section must do so without interfering with other processes.</li>
<li>A process requesting entry must not be delayed indefinitely: no deadlock and no starvation.</li>
<li>When no process is in a critical section, a process that requests entry must be admitted without delay.</li>
<li>No assumptions are made about relative process speeds or the number of processors.</li>
<li>A process remains inside its critical section for a finite time only.</li>
</ol>`,
  });
})();
