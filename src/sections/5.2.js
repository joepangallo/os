// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   5.2  Principles of Concurrency
   Unpredictable relative speed, the echo race, race conditions, the OS's
   four concerns, the three degrees of process awareness, competition and
   cooperation, and the six requirements for mutual exclusion.
   Helpers live in this IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in an arrow function that runs once, right away, so its names stay private to this file
  /* ---------------- small shared helpers ---------------- */
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));  // esc(x): turns &, <, > and " into safe HTML codes so a character is shown as text, never read as markup
  // P1 is teal (process colour), P2 is indigo (accent), P3 is pink: the same convention as 5.1
  const PN = (n) => `<b class="pc${n}">P${n}</b>`;  // PN(n): the label "P1", "P2" or "P3" in bold, coloured with that process's own colour
  const CH = (c, n) => `<span class="chr pc${n}">${esc(c)}</span>`;  // CH(c, n): one typed character (such as x) in monospace, coloured by the process n whose user typed it

  /* ---------------- echo lab: machine picture (keyboard → shared chin/chout → screen) ----------------
     st = { pc:[_,p1,p2], chin, chout, screen:[chars], running, last:{line,p} }, mode 1 = one CPU, 2 = two CPUs */
  const KEY = [null, 'x', 'y'];  // KEY[p]: the key each process's user typed (P1 typed x, P2 typed y); slot 0 is unused so indexes match P1, P2
  const OWN = (c) => (c === 'x' ? 1 : c === 'y' ? 2 : 0);          // whose user typed this character
  const VAR = (n) => (n === 1 ? '--proc' : '--accent');  // VAR(n): the CSS colour variable for P1 (teal) or P2 (indigo), used to fill shapes and text in the drawings
  const PCOL = [null, '--proc', '--accent', '--thread'];            // colour variable for P1, P2, P3
  function echoMachine(s) {  // echoMachine(s): builds the picture for the echo lab (keyboard, shared chin and chout, screen); s makes SVG parts
    const svg = s('svg', { viewBox: '0 0 480 262', width: '100%', role: 'img', 'aria-label': 'Keyboard, shared variables chin and chout, and the screen' });  // svg: the drawing surface; SVG (the browser's drawing format) uses a 480 by 262 coordinate grid scaled to fit
    const T = (x, y, str, o = {}) => s('text', Object.assign({ x, y, 'font-size': 14, 'font-weight': 700 }, o), str);  // T(x, y, str, o): shortcut that makes one bold SVG text label at (x, y); o can override size, colour or alignment
    function valText(x, y, c) {  // valText(x, y, c): draws what a shared variable holds, or the word "empty" when nothing is stored yet
      return c == null ? T(x, y, 'empty', { 'text-anchor': 'middle', 'font-size': 14, class: 's-sub', 'font-weight': 600 })  // no value yet: a small grey "empty" label in the middle of the box
        : T(x, y, c, { 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 800, class: 's-monot', style: `fill:var(${VAR(OWN(c))})` });  // a value: the character drawn large, in the colour of the process whose user typed it
    }  // ends valText()
    function draw(st, mode) {  // draw(st, mode): redraws the whole machine picture from the lab state st; runs after every step the student takes
      const k = [];  // k collects every shape for this redraw; they all replace the old picture at once at the end
      // CPUs
      if (mode === 1) {  // one-processor mode: a single CPU box is drawn
        const r = st.running;  // r is the process on the CPU right now (1 or 2), or 0 when nobody has run yet
        k.push(s('rect', { x: 150, y: 6, width: 180, height: 40, rx: 9, class: 's-cpu', 'stroke-width': 2 }));  // the CPU box, centred across the top of the drawing
        k.push(T(166, 31, 'CPU'), T(314, 31, r ? 'running P' + r : 'idle', { 'text-anchor': 'end', style: r ? `fill:var(${VAR(r)})` : null, class: r ? null : 's-sub' }));  // labels the box "CPU" and says which process is running (in its colour) or "idle" in grey
      } else {  // two-processor mode: each process gets its own CPU instead
        [1, 2].forEach((p) => {  // draws one CPU box for P1 and one for P2
          const x = p === 1 ? 40 : 260;  // P1's CPU sits on the left, P2's on the right
          k.push(s('rect', { x, y: 6, width: 180, height: 40, rx: 9, class: 's-cpu', 'stroke-width': 2 }));  // the CPU box outline
          k.push(T(x + 14, 31, 'CPU ' + p), T(x + 166, 31, 'runs P' + p, { 'text-anchor': 'end', style: `fill:var(${VAR(p)})` }));  // labels it "CPU 1" or "CPU 2" and states which process always runs there, in that process's colour
        });  // closes the loop over the two CPUs
      }  // ends the choice between one and two processors
      // keyboard
      k.push(s('rect', { x: 4, y: 78, width: 124, height: 124, rx: 12, class: 's-io', 'stroke-width': 2 }), T(66, 100, 'Keyboard', { 'text-anchor': 'middle' }));  // the keyboard box on the left edge, with its title
      [1, 2].forEach((p) => {  // draws one key per process: the x key for P1 and the y key for P2
        const x = p === 1 ? 20 : 72, used = st.pc[p] > 1;  // P1's key sits left, P2's right; used is true once that process has already read its key (passed line 1)
        k.push(s('g', { opacity: used ? 0.35 : 1 },  // groups the key's shapes; a key already read is faded to 35% so the student sees it was consumed
          s('rect', { x, y: 114, width: 40, height: 40, rx: 8, class: 's-panel', 'stroke-width': 2, style: `stroke:var(${VAR(p)})` }),  // the key cap outline, edged in the process's colour
          T(x + 20, 142, KEY[p], { 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800, class: 's-monot', style: `fill:var(${VAR(p)})` }),  // the key's letter (x or y), large and in the process's colour
          T(x + 20, 176, 'P' + p, { 'text-anchor': 'middle', 'font-size': 13, style: `fill:var(${VAR(p)})` })));  // "P1" or "P2" under the key, saying whose user typed it
      });  // closes the loop over the two keys
      // shared memory
      k.push(s('rect', { x: 160, y: 66, width: 160, height: 192, rx: 12, class: 's-mem', 'stroke-width': 2 }), T(240, 86, 'Shared memory', { 'text-anchor': 'middle' }));  // the large shared-memory box in the middle, with its title; both variables live inside it
      [['chin', 96, st.chin], ['chout', 178, st.chout]].forEach(([name, y, v]) => {  // draws the two shared variables, chin (upper box) and chout (lower box), with their current values
        const hot = st.last && ((name === 'chin' && st.last.line === 1) || (name === 'chout' && st.last.line === 2));  // hot is true for the variable that the last step wrote (line 1 writes chin, line 2 writes chout)
        k.push(s('rect', { x: 176, y, width: 128, height: 70, rx: 9, class: 's-panel', 'stroke-width': hot ? 3 : 1.5, style: hot ? `stroke:var(${VAR(st.last.p)})` : null }));  // the variable's box; a just-written box gets a thicker outline in the colour of the process that wrote it
        k.push(T(188, y + 20, name, { 'font-size': 14, class: 's-monot' }), valText(240, y + 56, v));  // the variable's name at the top left, and its value (or "empty") in the middle
      });  // closes the loop over chin and chout
      // screen
      k.push(s('rect', { x: 352, y: 78, width: 124, height: 124, rx: 12, class: 's-io', 'stroke-width': 2 }), T(414, 100, 'Screen', { 'text-anchor': 'middle' }));  // the screen box on the right edge, with its title
      k.push(s('rect', { x: 364, y: 110, width: 100, height: 76, rx: 8, class: 's-panel', 'stroke-width': 1.5 }));  // the inner display area where characters appear
      st.screen.forEach((c, i) => k.push(T(390 + i * 48, 160, c, { 'text-anchor': 'middle', 'font-size': 34, 'font-weight': 800, class: 's-monot', style: `fill:var(${VAR(OWN(c))})` })));  // every character shown so far, side by side, coloured by whose user typed it (so a lost key is easy to spot)
      // arrows for the three lines of echo; the one that just ran is drawn in that process's colour
      const arr = (n, d) => {  // arr(n, d): draws the arrow for echo line n along the path d (an SVG path: M = move to, L = line to, C = curve)
        const on = st.last && st.last.line === n;  // on is true when line n was the step that just ran
        const col = on ? (st.last.p === 1 ? 'proc' : 'accent') : 'muted';  // the arrow's colour: the running process's colour when it just ran, otherwise grey
        k.push(s('path', { d, class: on ? 's-line' : 's-muted', 'stroke-width': on ? 3 : 2, style: on ? `stroke:var(--${col})` : null, 'marker-end': `url(#arr-${col})`, fill: 'none' }));  // the arrow itself, thicker when active, with a matching arrowhead at its end
      };  // ends arr()
      arr(1, 'M128 131 L172 131');  // line 1 arrow: keyboard into chin (getchar)
      arr(2, 'M240 168 L240 176');  // line 2 arrow: chin down into chout (the copy)
      arr(3, 'M306 213 C 330 213, 336 176, 350 160');  // line 3 arrow: a curve from chout out to the screen (putchar)
      svg.replaceChildren(...k);  // swaps the old picture for all the new shapes in one go, so the drawing never flickers half-built
    }  // ends draw()
    return { svg, draw };  // hands back the drawing surface and its draw function; the echo lab places one and calls the other
  }  // ends echoMachine()

  /* ---------------- speed-independence model (OS concern 4) ----------------
     P1 calls echo after 2.6 time units of its own work, running at speed 1: lines at 2.6, 3.6, 4.6.
     P2 does 4 units of work first, at relative speed v: its lines are planned at 4/v, 5/v, 6/v.
     With protect on, a caller that arrives while the other is inside echo waits until that one
     has finished line 3 (plus a small hand-over gap), and its later lines shift by the same amount. */
  function speedRun(v, protect) {  // speedRun(v, protect): simulates both echo calls when P2 runs at speed v, and reports whether each got its key
    const plan = { 1: [2.6, 3.6, 4.6], 2: [4 / v, 5 / v, 6 / v] };  // plan: the planned time of each process's three echo lines (P1 fixed, P2 sooner when faster, later when slower)
    const idx = { 1: 0, 2: 0 }, shift = { 1: 0, 2: 0 }, waitFrom = { 1: null, 2: null };  // idx = next line each process will run; shift = delay added by waiting; waitFrom = when a process began to wait
    const mem = { chin: null, chout: null }, out = [], ev = [], shown = { 1: null, 2: null };  // mem = the shared chin and chout; out = screen order; ev = every line run, with time; shown = what each displayed
    const at = (p) => plan[p][idx[p]] + shift[p];  // at(p): the time at which process p will run its next line, including any waiting delay
    for (let guard = 0; guard < 20 && (idx[1] < 3 || idx[2] < 3); guard++) {  // keeps going until both processes finish all three lines; guard stops it after 20 turns so it can never hang
      const ps = [1, 2].filter((p) => idx[p] < 3).sort((a, b) => at(a) - at(b) || a - b);  // ps: the processes that still have lines left, earliest next line first (a tie goes to P1)
      const p = ps[0], o = 3 - p;  // p runs next and o is the other process (3 - 1 = 2, 3 - 2 = 1)
      if (protect && idx[p] === 0 && idx[o] > 0 && idx[o] < 3) {        // the other one is inside echo: wait
        waitFrom[p] = at(p);  // records when p started waiting at echo's entrance, so the timeline can draw a "waits" bar
        shift[p] = plan[o][2] + shift[o] + 0.3 - plan[p][0];  // delays all of p's lines until just after the other finishes line 3 (plus a 0.3 hand-over gap)
        continue;  // goes round again, now with p's times pushed later
      }  // ends the protection check
      const line = idx[p] + 1, t = at(p);  // line is which echo line (1, 2 or 3) p runs now, and t is the time it happens
      if (line === 1) mem.chin = KEY[p];  // line 1: getchar puts p's typed key into the shared chin
      if (line === 2) mem.chout = mem.chin;  // line 2: copies whatever chin holds now into the shared chout
      if (line === 3) { out.push(mem.chout); shown[p] = mem.chout; }  // line 3: putchar shows chout on the screen and records what p displayed
      ev.push({ p, line, t });  // logs this line so the timeline can draw it as a circle at time t
      idx[p]++;  // moves p on to its next line
    }  // ends the simulation loop
    // correct = each process displayed the key its own user typed (the screen order may still vary)
    return { ev, out, shown, ok: shown[1] === 'x' && shown[2] === 'y', waitFrom, end: Math.max(...ev.map((e) => e.t)) };  // hands back the event list, screen order, what each showed, ok (both right), wait start times and the last line's time
  }  // ends speedRun()

  /* ---------------- competition, tab 1: three processes, one printer ----------------
     One job = entercritical(R) → print page 1 → print page 2 → exitcritical(R) → remainder.
     Mutual exclusion ON: a caller that finds R busy joins a first-come queue, and exitcritical
     hands R straight to the head of that queue. OFF: nothing stops a second process walking in. */
  function mutexLab(ctx) {  // mutexLab(ctx): builds the "Mutual exclusion" tab of step 6, where three processes share one printer R
    const { h } = ctx;  // h is the guide's helper that creates an HTML element with its settings and children in one call
    let protect = true, st, token = 0, busy = false;  // protect = mutual exclusion switch; st = lab state; token and busy stop an old replay from clashing with a new one
    const cards = {}, btns = {};  // cards and btns hold each process's card and its action button, keyed by process number 1 to 3
    const paper = h('div', { class: 'log cp-paper' });  // paper: the scrolling box that shows every printed page, like the printer's output tray
    const res = h('div', { class: 'cp-res' });  // res: the panel that shows who is using printer R right now and who is queued for it
    const narr = h('div', { class: 'callout cp-narr small m0', 'data-label': 'What happened' });  // narr: the "What happened" callout box that explains each step in words
    function fresh() { st = { ph: [null, 'rem', 'rem', 'rem'], pg: [0, 0, 0, 0], job: [0, 0, 0, 0], q: [], pages: [], mixed: 0, clash: false }; }  // fresh(): a clean start: every process in its remainder (ph), no pages printed, empty queue, no mixed pages
    const inside = () => [1, 2, 3].filter((p) => st.ph[p] === 'cs');  // inside(): lists the processes currently in their critical section (phase 'cs'), i.e. using the printer
    const list = (ps) => ps.map((p) => PN(p)).join(' and ');  // list(ps): joins process labels into readable text such as "P1 and P3"
    function step(p) {  // step(p): runs process p's next action when its button is clicked (or during the replay)
      const ph = st.ph[p];  // ph is p's current phase: 'rem' (remainder), 'wait' (queued) or 'cs' (critical section)
      let msg = '', tone = '';  // msg is the explanation for the callout; tone becomes 'bad' when something goes wrong
      if (ph === 'wait') return;  // a blocked process cannot act until the printer is handed to it
      if (ph === 'rem') {  // p is in its remainder, so this click is its call to entercritical(R)
        st.job[p]++;  // starts a new print job for p, so its pages can be numbered job 1, job 2, and so on
        const others = inside();  // others: who is already using the printer at the moment p asks
        if (protect && others.length) {  // with mutual exclusion on and the printer busy, p must wait
          st.ph[p] = 'wait'; st.q.push(p);  // p becomes blocked and joins the end of the first-come queue
          msg = `${PN(p)} calls <code>entercritical(R)</code>, but ${PN(others[0])} is in its critical section. Here the OS <b>blocks</b> ${PN(p)} in a queue (position ${st.q.length}) until R is handed to it.`;  // explains that the OS blocked p and says its place in the queue
        } else {  // otherwise p enters its critical section now
          st.ph[p] = 'cs'; st.pg[p] = 0;  // p is in its critical section with no pages printed yet
          if (protect) msg = `${PN(p)} calls <code>entercritical(R)</code>. Nobody is using the printer, so ${PN(p)} enters its critical section straight away.`;  // protection on and the printer free: p goes straight in
          else if (others.length) { st.clash = true; tone = 'bad'; msg = `${PN(p)} walks straight in, because nothing checks. ${list(others)} ${others.length > 1 ? 'are' : 'is'} already using the printer. <b>Mutual exclusion is broken.</b>`; }  // protection off and someone else inside: both use the printer at once, so the rule is broken (shown as a problem)
          else msg = `${PN(p)} starts using the printer. Without entercritical, nothing would stop anyone else from starting too.`;  // protection off but nobody inside: it works this time only by luck
        }  // ends the free-or-busy choice
      } else if (st.pg[p] < 2) {  // p is in its critical section with pages left, so this click prints its next page
        st.pg[p]++;  // counts the page p just printed (1 or 2)
        const mixed = [1, 2, 3].some((q) => q !== p && st.ph[q] === 'cs' && st.pg[q] === 1);  // mixed is true if another process is also in its critical section with half its job printed
        if (mixed) { st.mixed++; tone = 'bad'; }  // a mixed page is counted and shown as a problem
        st.pages.push({ p, job: st.job[p], page: st.pg[p], mixed });  // adds the page to the printout list with its owner, job number, page number and mixed flag
        msg = `${PN(p)} prints page ${st.pg[p]} of its job.` + (mixed ? ' <b>It lands in the middle of another process’s half-printed job: the printout is mixed.</b>' : st.pg[p] === 1 ? ' It is in its critical section, using the one printer.' : ' Its job is complete.');  // explains the page: mixed into someone else's job, first page printed, or job complete
      } else {  // otherwise p has printed both pages, so this click is its call to exitcritical(R)
        st.ph[p] = 'rem';  // p goes back to its remainder, the work that needs no printer
        msg = `${PN(p)} calls <code>exitcritical(R)</code> and goes back to its <b>remainder</b> (other work that needs no printer).`;  // explains that p released the printer
        if (protect && st.q.length) { const n = st.q.shift(); st.ph[n] = 'cs'; st.pg[n] = 0; msg += ` The printer passes straight to ${PN(n)}, first in the queue.`; }  // with protection on and someone waiting, the printer passes straight to the first process in the queue
        else if (protect) msg += ' The printer is free again.';  // with protection on and nobody waiting, the printer is simply free
      }  // ends the three-way choice of action
      narr.className = 'callout cp-narr small m0 ' + tone;  // colours the callout: red for a problem, plain otherwise
      narr.dataset.label = tone === 'bad' ? 'Problem' : 'What happened';  // sets the callout's heading to "Problem" or "What happened"
      narr.innerHTML = msg;  // puts the explanation into the callout
      paint();  // refreshes the cards, the printer panel and the printout
    }  // ends step()
    function paint() {  // paint(): redraws every part of the tab from st; runs after every step and after a reset
      [1, 2, 3].forEach((p) => {  // updates the three process cards one by one
        const ph = st.ph[p], pg = st.pg[p];  // ph = phase and pg = pages printed so far for this process
        const chip = ph === 'wait' ? `<span class="chip os">blocked · queue #${st.q.indexOf(p) + 1}</span>`  // status chip: blocked with its queue position, in the critical section, or in the remainder
          : ph === 'cs' ? '<span class="chip io">in critical section</span>' : '<span class="chip">remainder</span>';  // the second and third choices of the status chip
        const next = ph === 'rem' ? 'next: ask for the printer' : ph === 'wait' ? 'waiting for exitcritical' : pg < 2 ? `job ${st.job[p]}, printed ${pg} of 2` : 'job done, must release R';  // a grey hint saying what this process's next action will be
        cards[p].querySelector('.cp-st').innerHTML = `${chip}<br><span class="muted">${next}</span>`;  // writes the chip and the hint into the card's status area
        btns[p].textContent = ph === 'rem' ? 'entercritical(R)' : ph === 'wait' ? 'waiting…' : pg < 2 ? `print page ${pg + 1}` : 'exitcritical(R)';  // the button label names the next action: entercritical(R), waiting, print page N, or exitcritical(R)
        btns[p].disabled = ph === 'wait' || busy;  // a queued process cannot be clicked, and no button works while the replay is running
      });  // ends the loop over the three cards
      const ins = inside();  // ins: who is using the printer right now
      res.classList.toggle('bad', ins.length > 1);  // the printer panel turns red when more than one process is using it
      res.innerHTML = `<div class="cp-res-h">Printer R <span class="xs muted">critical resource</span></div>` +  // printer panel heading: "Printer R", labelled as the critical resource
        `<div class="cp-slot">In use by: ${ins.length ? list(ins) : '<span class="muted">nobody (free)</span>'}${ins.length > 1 ? ' <b style="color:var(--bad)">✗ at once!</b>' : ''}</div>` +  // who is using the printer, or "nobody (free)", plus a red warning if two or more are using it at once
        `<div class="cp-slot">Queue: ${protect ? (st.q.length ? st.q.map((p) => `<span class="chip ${p === 1 ? 'proc' : p === 2 ? 'accent' : 'thread'}">P${p}</span>`).join(' ') : '<span class="muted">empty</span>') : '<span class="muted">none (no mutual exclusion)</span>'}</div>` +  // the queue in order as coloured chips, "empty", or a note that there is no queue when protection is off
        `<div class="cp-slot xs muted">${st.pages.length} pages printed · ${st.mixed ? `<b style="color:var(--bad)">${st.mixed} mixed</b>` : '0 mixed'}</div>`;  // running totals: pages printed and how many of them were mixed
      paper.innerHTML = st.pages.length ? st.pages.map((x) => `<div><span class="cp-pg p${x.p}">P${x.p} · job ${x.job} · page ${x.page}/2</span>${x.mixed ? '<span class="chip bad">mixed in</span>' : ''}</div>`).join('')  // the printout: one line per page with its owner, job and page number, and a red tag on any mixed page
        : '<div class="muted">The printer output appears here.</div>';  // placeholder shown before anything has been printed
      paper.scrollTop = paper.scrollHeight;  // scrolls the printout to the bottom so the newest page is always visible
    }  // ends paint()
    function reset(msg) {  // reset(msg): starts the tab over; msg is an optional message for the callout
      token++; busy = false; fresh();  // a new token cancels any replay still running; the state goes back to a clean start
      narr.className = 'callout cp-narr small m0'; narr.dataset.label = 'Your move';  // resets the callout to its neutral look with the heading "Your move"
      narr.innerHTML = msg || (protect ? 'Each process prints a two-page job. Click the buttons in any order. Try asking for the printer while someone else is using it.' : '<b>Mutual exclusion is OFF.</b> Let two processes into their critical sections at once and print, and watch the pages mix.');  // instructions for the student, which differ depending on whether mutual exclusion is on or off
      paint();  // draws the fresh state
    }  // ends reset()
    async function demo() {  // demo(): replays a prepared sequence of clicks, one every 0.75 seconds; async lets it pause between steps
      reset(protect ? 'Replaying a busy moment with mutual exclusion ON…' : 'Replaying the same kind of moment with mutual exclusion OFF…');  // starts over with a message saying which kind of replay this is
      const my = token; busy = true; paint();  // remembers this replay's token and locks the buttons while it runs
      const seq = protect ? [1, 2, 1, 3, 1, 1, 2, 2, 2, 3, 3, 3] : [1, 2, 1, 2, 1, 2, 1, 2];  // the click order: with protection on it builds a queue; with it off, P1 and P2 keep interleaving and mix pages
      for (const p of seq) {  // goes through the prepared clicks one at a time
        await ctx.sleep(750);  // waits 0.75 seconds; the guide's sleep stops by itself when the student leaves this step
        if (!ctx.alive || my !== token) return;  // quits if the step was closed or the student pressed Reset (the token changed) during the pause
        step(p);  // performs the click for process p
      }  // ends the replay loop
      busy = false; paint();  // unlocks the buttons once the replay is over
    }  // ends demo()
    [1, 2, 3].forEach((p) => {  // builds the card and button for each of the three processes when the tab opens
      btns[p] = h('button', { class: 'btn sm e-b' + p, type: 'button', onclick: () => step(p) }, 'entercritical(R)');  // the process's action button, coloured like the process; clicking it runs step(p)
      cards[p] = h('div', { class: 'card tight stack cp-card e-p' + p }, h('b', { class: 'pc' + p }, 'Process P' + p), h('div', { class: 'cp-st' }), btns[p]);  // the card: the process name in its colour, a status area, and the action button
    });  // closes the loop that builds the cards
    const tog = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'true', onclick: () => { protect = !protect; tog.setAttribute('aria-pressed', String(protect)); tog.textContent = protect ? 'Mutual exclusion: ON' : 'Mutual exclusion: OFF'; reset(); } }, 'Mutual exclusion: ON');  // the on/off switch for mutual exclusion; aria-pressed tells screen readers its state; flipping it restarts the tab
    fresh(); reset();  // sets up the first state and shows the opening instructions
    return h('div', { class: 'stack cp-tab' },  // returns the finished tab, laid out as a vertical stack
      h('div', { class: 'row' }, tog, h('button', { class: 'btn sm primary', type: 'button', onclick: demo }, 'Replay a busy moment'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => reset() }, 'Reset')),  // top row: the switch, the replay button and a Reset button
      h('div', { class: 'grid-3' }, cards[1], cards[2], cards[3]),  // the three process cards side by side
      h('div', { class: 'cp-mid' }, res, paper),  // the printer panel next to the printout
      narr);  // the explanation callout at the bottom; closes the tab layout
  }  // ends mutexLab()

  /* ---------------- competition, tab 2: deadlock with two resources ----------------
     Both processes need R1 (printer) AND R2 (a file). Asking for a resource that the other holds
     blocks the caller; releasing a resource hands it straight to a process blocked on it.
     Option "same order": P2 also asks for R1 first, which makes the circular wait impossible. */
  function deadlockLab(ctx) {  // deadlockLab(ctx): builds the "Deadlock" tab of step 6, where two processes each need a printer and a file
    const { h, s } = ctx;  // h makes HTML elements and s makes SVG drawing elements (both guide helpers)
    const NAME = { R1: 'printer', R2: 'file' };  // NAME: the everyday name of each resource, used in the code comments, the drawing and the messages
    let same = false, st, token = 0, busy = false;  // same = the "same request order" fix switch; st = lab state; token and busy guard the replay
    const prog = (p) => {  // prog(p): process p's five-step program, as [resource, operation] pairs
      const [a, b] = p === 1 || same ? ['R1', 'R2'] : ['R2', 'R1'];  // P1 asks for R1 then R2; P2 asks in the opposite order, unless the fix makes it ask for R1 first too
      return [[a, 'get'], [b, 'get'], [null, 'use'], [b, 'put'], [a, 'put']];  // get the first resource, get the second, use both, then free them in reverse order
    };  // ends prog()
    // every line carries a short comment, aligned in one column
    const src = (p) => prog(p).map(([r, op]) => (op === 'get' ? `entercritical(${r}); // get ${NAME[r]}`  // src(p): turns p's program into C-like text for the code box; each request line reads entercritical(R)
      : op === 'use' ? 'use(R1, R2);'.padEnd(19) + '// use both' : `exitcritical(${r});`.padEnd(19) + `// free ${NAME[r]}`)).join('\n');  // the use line and the release lines, padded with spaces so every short comment lines up in one column
    const svg = s('svg', { viewBox: '0 0 300 218', width: '100%', role: 'img', 'aria-label': 'Resource graph: which process holds and which waits for each resource' });  // svg: the resource graph (a drawing of who holds and who waits for each resource), 300 by 218 units
    const narr = h('div', { class: 'callout small m0 cp-narr', 'data-label': 'Your move' });  // narr: the callout under the graph that explains each step
    const cards = {}, btns = {}, codes = {};  // cards, btns and codes: each process's card, its Step button and its code box, keyed by 1 and 2
    const fresh = () => { st = { pc: [0, 0, 0], hold: { R1: 0, R2: 0 }, wait: [0, null, null], dead: false }; };  // fresh(): clean start: pc = next line of each process, hold = owner of each resource (0 = free), no waits, no deadlock
    const P = { 1: [50, 100], 2: [250, 100] };  // P: where each process circle sits in the graph (P1 left, P2 right, both halfway down)
    const EDGE = { R1: { 1: [[125, 40], [74, 84]], 2: [[175, 40], [226, 84]] }, R2: { 1: [[125, 160], [74, 116]], 2: [[175, 160], [226, 116]] } };  // EDGE: for each resource and process, the two end points of the arrow joining them in the graph
    function draw() {  // draw(): redraws the resource graph from st; runs after every step
      const k = [];  // k collects the shapes for this redraw
      ['R1', 'R2'].forEach((r) => [1, 2].forEach((p) => {  // looks at every resource-process pair (R1 or R2 with P1 or P2)
        const [a, b] = EDGE[r][p];  // a is the end near the resource box, b the end near the process circle
        if (st.hold[r] === p) k.push(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 's-line', 'stroke-width': 3, style: `stroke:var(${st.dead ? '--bad' : VAR(p)})`, 'marker-end': `url(#arr-${st.dead ? 'bad' : p === 1 ? 'proc' : 'accent'})` }));  // solid arrow from a resource to the process holding it, in that process's colour (all red once deadlocked)
        if (st.wait[p] === r) k.push(s('line', { x1: b[0], y1: b[1], x2: a[0], y2: a[1], class: 's-line', 'stroke-width': 3, 'stroke-dasharray': '6 4', style: `stroke:var(${st.dead ? '--bad' : '--warn'})`, 'marker-end': `url(#arr-${st.dead ? 'bad' : 'warn'})` }));  // dashed orange arrow from a blocked process to the resource it waits for (red once deadlocked)
      }));  // closes both loops over resources and processes
      [1, 2].forEach((p) => {  // draws the two process circles
        k.push(s('circle', { cx: P[p][0], cy: P[p][1], r: 28, class: p === 1 ? 's-proc' : 's-accent', 'stroke-width': 2.5 }));  // the circle, styled with that process's colour
        k.push(s('text', { x: P[p][0], y: P[p][1] + 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, style: `fill:var(${VAR(p)})` }, 'P' + p));  // "P1" or "P2" in the middle of its circle
      });  // closes the loop over the circles
      [['R1', 8], ['R2', 148]].forEach(([r, y]) => {  // draws the two resource boxes: R1 at the top, R2 at the bottom
        k.push(s('rect', { x: 125, y, width: 50, height: 44, rx: 8, class: 's-io', 'stroke-width': 2 }));  // the resource box, styled like an I/O device
        k.push(s('text', { x: 150, y: y + 20, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, r));  // the resource's short name (R1 or R2)
        k.push(s('text', { x: 150, y: y + 37, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, NAME[r]));  // its everyday name (printer or file) in small grey text underneath
      });  // closes the loop over the resource boxes
      if (st.dead) k.push(s('text', { x: 150, y: 106, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 900, style: 'fill:var(--bad)' }, 'DEADLOCK'));  // once deadlocked, a big red DEADLOCK label in the middle of the graph
      k.push(s('line', { x1: 4, y1: 211, x2: 30, y2: 211, class: 's-line', 'stroke-width': 2.5 }), s('text', { x: 36, y: 216, 'font-size': 13, class: 's-sub' }, 'is held by'));  // legend, first item: a solid line means "is held by"
      k.push(s('line', { x1: 124, y1: 211, x2: 150, y2: 211, class: 's-line', 'stroke-width': 2.5, 'stroke-dasharray': '6 4', style: 'stroke:var(--warn)' }), s('text', { x: 156, y: 216, 'font-size': 13, class: 's-sub' }, 'waits for'));  // legend, second item: a dashed orange line means "waits for"
      svg.replaceChildren(...k);  // replaces the old drawing with the new shapes in one go
    }  // ends draw()
    function step(p) {  // step(p): runs process p's next line when its Step button is clicked (or during the replay)
      if (st.dead || st.wait[p] || st.pc[p] >= 5) return;  // nothing happens after deadlock, while p is blocked, or once p has finished all five lines
      const [r, op] = prog(p)[st.pc[p]], o = 3 - p;  // r and op are the resource and operation on p's next line; o is the other process
      let msg, tone = '';  // msg is the explanation; tone becomes 'bad' for deadlock or 'tip' when both finish
      if (op === 'get' && !st.hold[r]) { st.hold[r] = p; st.pc[p]++; msg = `${PN(p)} asks for ${r} (the ${NAME[r]}). It is free, so ${PN(p)} now holds it.`; }  // asking for a free resource: p takes it and moves on
      else if (op === 'get') {  // asking for a resource the other process holds
        st.wait[p] = r;  // p becomes blocked, waiting for r
        msg = `${PN(p)} asks for ${r}, but ${PN(o)} holds it, so ${PN(p)} is <b>blocked</b> until ${PN(o)} releases it.`;  // explains that p is blocked until the other process releases r
        if (st.wait[o] && st.hold[st.wait[o]] === p) {  // if the other process is already waiting for something p holds, the waiting has closed into a circle
          st.dead = true; tone = 'bad';  // marks the lab as deadlocked, shown in red
          msg = `${PN(p)} now waits for ${r}, held by ${PN(o)}, while ${PN(o)} waits for ${st.wait[o]}, held by ${PN(p)}. Each waits for the other, so <b>neither can ever continue</b>: <span class="t">deadlock</span>.`;  // explains the circle: each waits for what the other holds, so neither can go on
        }  // ends the deadlock check
      } else if (op === 'use') { st.pc[p]++; msg = `${PN(p)} holds both resources and prints the file.`; }  // the use line: p holds both resources and does its work
      else {  // otherwise this is a release line (exitcritical)
        st.hold[r] = 0; st.pc[p]++;  // frees the resource and moves p to its next line
        msg = `${PN(p)} releases ${r}.`;  // explains the release
        if (st.wait[o] === r) { st.hold[r] = o; st.wait[o] = null; st.pc[o]++; msg += ` ${PN(o)} was blocked on it, so ${PN(o)} gets it now and carries on.`; }  // if the other process was blocked on this resource, it gets it at once and moves past its request line
      }  // ends the choice of operation
      if (st.pc[1] >= 5 && st.pc[2] >= 5) { tone = 'tip'; msg += ' <b>Both processes finished.</b>' + (same ? ' With everyone asking in the same order, a circle of waiting cannot form.' : ' No deadlock this time: the order of requests happened to be safe.'); }  // when both processes have run all five lines, the message says why no deadlock happened
      narr.className = 'callout small m0 cp-narr ' + tone;  // colours the callout by tone
      narr.dataset.label = tone === 'bad' ? 'Deadlock' : tone === 'tip' ? 'Finished' : 'What happened';  // sets the callout heading: "Deadlock", "Finished" or "What happened"
      narr.innerHTML = msg;  // puts the explanation into the callout
      paint();  // refreshes the graph, code boxes and buttons
    }  // ends step()
    function paint() {  // paint(): redraws everything from st
      draw();  // redraws the resource graph
      [1, 2].forEach((p) => {  // updates each process's code box and button
        codes[p].clear();  // removes the old line highlight from the code box
        if (st.pc[p] < 5) codes[p].mark(st.pc[p] + 1, st.wait[p] ? 'bad' : 'cur');  // highlights p's next line; in red if p is blocked on it
        btns[p].disabled = busy || st.dead || !!st.wait[p] || st.pc[p] >= 5;  // the Step button is off during the replay, after deadlock, while blocked, or once finished
        btns[p].textContent = st.pc[p] >= 5 ? 'done' : st.wait[p] ? 'blocked' : 'Step P' + p;  // the button reads "done", "blocked" or "Step P1"/"Step P2"
      });  // closes the loop over the two processes
    }  // ends paint()
    function build() {  // build(): makes a fresh code box and Step button for each process; needed because the fix changes P2's program
      [1, 2].forEach((p) => {  // for each process
        codes[p] = ctx.ui.code(src(p), { lang: 'c', nums: false });  // the code box listing its five lines (ctx.ui.code shows code with coloured keywords; nums: false hides line numbers)
        btns[p] = h('button', { class: 'btn sm e-b' + p, type: 'button', onclick: () => step(p) }, 'Step P' + p);  // the Step button, coloured like the process
        cards[p].replaceChildren(h('div', { class: 'row nw' }, h('b', { class: 'pc' + p }, 'Process P' + p), h('span', { class: 'grow' }), btns[p]), codes[p]);  // fills the card: a header row with the process name and button, then the code box
      });  // closes the loop
    }  // ends build()
    function reset(msg) {  // reset(msg): starts the tab over, cancelling any replay, and rebuilds the code boxes
      token++; busy = false; fresh(); build();  // a new token stops an old replay; the state and the code boxes are made fresh
      narr.className = 'callout small m0 cp-narr'; narr.dataset.label = 'Your move';  // resets the callout to its neutral look with the heading "Your move"
      narr.innerHTML = msg || `Each process needs <b>both</b> the printer and the file. ${same ? 'Both now ask for R1 first.' : 'P1 asks for R1 first; P2 asks for R2 first.'} Step them in any order. Can you get them stuck?`;  // instructions that say which order each process asks for the resources in
      paint();  // draws the fresh state
    }  // ends reset()
    async function demo() {  // demo(): replays P1, P2, P1, P2 one line each, 0.9 seconds apart, which leads straight into deadlock
      reset('Replaying: P1, P2, P1, P2, one line each…');  // starts over with a message describing the replay
      const my = token; busy = true; paint();  // remembers this replay's token and locks the buttons
      for (let i = 0; i < 14; i++) {  // at most 14 steps, enough for both processes to finish when the fix is on
        await ctx.sleep(900);  // pauses 0.9 seconds between steps
        if (!ctx.alive || my !== token) return;  // quits if the student left this step or pressed Reset during the pause
        let p = i < 4 ? [1, 2, 1, 2][i] : 1;  // the first four steps alternate P1, P2, P1, P2; after that it tries P1 first
        const can = (q) => !st.wait[q] && st.pc[q] < 5;  // can(q): true when process q is neither blocked nor finished
        if (!can(p)) p = 3 - p;  // if the chosen process cannot move, try the other one
        if (st.dead || !can(p)) break;  // stops once deadlocked or when neither process can move
        step(p);  // runs the chosen process's next line
      }  // ends the replay loop
      busy = false; paint();  // unlocks the buttons once the replay is over
    }  // ends demo()
    [1, 2].forEach((p) => { cards[p] = h('div', { class: 'card tight stack gap-s e-p' + p }); });  // makes an empty card for each process (build() fills it), with a coloured top edge for P1 or P2
    const fix = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'false', onclick: () => { same = !same; fix.setAttribute('aria-pressed', String(same)); reset(); } }, 'Fix: same request order');  // the "Fix: same request order" switch: makes P2 ask for R1 first too, then restarts the tab
    reset();  // sets up the first state and shows the opening instructions
    return h('div', { class: 'stack cp-tab' },  // returns the finished tab, laid out as a vertical stack
      h('div', { class: 'row' }, h('button', { class: 'btn sm primary', type: 'button', onclick: demo }, 'Replay P1, P2, P1, P2'), fix, h('button', { class: 'btn sm ghost', type: 'button', onclick: () => reset() }, 'Reset')),  // top row: the replay button, the fix switch and a Reset button
      h('div', { class: 'cp-dl' }, cards[1], cards[2]),  // the two process cards with their code, side by side
      h('div', { class: 'cp-graph' },  // lower area: the resource graph beside the explanation
        h('div', { class: 'card white tight' }, svg),  // the resource graph on a white card
        h('div', { class: 'stack gap-s' }, narr,  // the explanation callout, stacked above a fixed note
          h('div', { class: 'callout warn small m0', 'data-label': 'Notice', html: 'Each program is fine alone, and mutual exclusion holds. The trouble is the request <b>order</b>: each holds one resource while it waits for the other.' }))));  // fixed note: the programs are correct alone; the danger is the order of the requests. Closes the layout
  }  // ends deadlockLab()

  /* ---------------- competition, tab 3: starvation ----------------
     P1, P2, P3 all want R at slot 1. Using R takes one slot; afterwards a process does one slot of
     other work, then asks again. Each slot the OS grants R to one waiting process:
       'fav'  : always prefer P1 or P3 (whichever has waited longer), P2 only if nobody else waits
       'fifo' : first come, first served (ties go to the lower number)                           */
  const SLOTS = 8;  // SLOTS: how many time slots the starvation timeline covers
  function starveRun(policy) {  // starveRun(policy): works out, slot by slot, which process the OS gives R to under the chosen policy
    const ask = [0, 1, 1, 1];            // slot at which each process (re)joins the waiting set
    const grid = [null, [], [], []];    // grid[p][t] = 'use' | 'wait' | 'rem'
    const who = [];  // who[t - 1]: the process that gets R in slot t, used for the captions
    for (let t = 1; t <= SLOTS; t++) {  // goes through the eight slots in order
      const waiting = [1, 2, 3].filter((p) => ask[p] <= t);  // waiting: the processes that want R in this slot
      let pick = null;  // pick will be the process that gets R in this slot
      const byAge = (a, b) => ask[a] - ask[b] || a - b;  // byAge: orders processes by how long they have waited (earliest ask first); a tie goes to the lower number
      if (policy === 'fifo') pick = waiting.slice().sort(byAge)[0];  // first come, first served: the process that has waited longest gets R
      else { const fav = waiting.filter((p) => p !== 2).sort(byAge); pick = fav.length ? fav[0] : waiting[0]; }  // unfair policy: the longest-waiting of P1 and P3 gets R; P2 gets it only when neither of them wants it
      who.push(pick);  // records who got R in this slot
      [1, 2, 3].forEach((p) => { grid[p][t] = p === pick ? 'use' : ask[p] <= t ? 'wait' : 'rem'; });  // fills this slot's column: the chosen process uses R, other askers wait, the rest do other work
      if (pick) ask[pick] = t + 2;  // the chosen process uses R now, does other work next slot, and asks again two slots later
    }  // ends the slot loop
    return { grid, who };  // returns the full grid and the list of who got R in each slot
  }  // ends starveRun()
  function starveLab(ctx) {  // starveLab(ctx): builds the "Starvation" tab of step 6: a slot-by-slot timeline with a policy switch
    const { h, s } = ctx;  // h makes HTML elements, s makes SVG drawing elements
    let policy = 'fav';  // policy starts as the unfair "prefer P1 and P3" rule
    const svg = s('svg', { viewBox: '0 0 640 156', width: '100%', role: 'img', 'aria-label': 'Timeline of which process holds R in each slot' });  // svg: the timeline drawing, 640 by 156 units, scaled to the card's width
    const X0 = 40, CW = 62, ROW = { 1: 24, 2: 63, 3: 102 };  // X0 = left edge of slot 1; CW = width of one slot; ROW = top of each process's row
    function draw(run, upto) {  // draw(run, upto): draws the timeline with slots 1 to upto filled in; runs on every player step
      const k = [];  // k collects the shapes for this redraw
      for (let t = 1; t <= SLOTS; t++) k.push(s('text', { x: X0 + (t - 0.5) * CW, y: 13, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'slot ' + t));  // "slot 1" to "slot 8" headings across the top, one centred over each column
      k.push(s('text', { x: 636, y: 13, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'used · waited'));  // heading for the totals column on the right: slots used and slots waited
      [1, 2, 3].forEach((p) => {  // draws one row per process
        const y = ROW[p];  // y is the top of this process's row
        k.push(s('text', { x: 4, y: y + 22, 'font-size': 16, 'font-weight': 800, style: `fill:var(${PCOL[p]})` }, 'P' + p));  // "P1", "P2" or "P3" at the left, in that process's colour
        const wN = waited(p, upto);  // wN: how many slots this process has waited so far
        k.push(s('text', { x: 636, y: y + 21, 'text-anchor': 'end', 'font-size': 15, 'font-weight': 800, style: used(p, upto) === 0 && wN >= 3 ? 'fill:var(--bad)' : null }, `${used(p, upto)} · ${wN}`));  // totals so far (used · waited), shown in red once a process has waited 3 or more slots without ever using R
        for (let t = 1; t <= SLOTS; t++) {  // draws this process's box for each slot
          const x = X0 + (t - 1) * CW + 3, c = t <= upto ? run.grid[p][t] : null;  // x is the box's left edge; c is what the process did in that slot, or nothing if the slot is still ahead
          const cls = c === 'use' ? ['s-proc', 's-accent', 's-thread'][p - 1] : c === 'wait' ? 's-warn' : 's-panel';  // box style: the process's own colour when using R, orange when waiting, plain panel otherwise
          k.push(s('rect', { x, y, width: CW - 6, height: 32, rx: 7, class: cls, 'stroke-width': c === 'use' ? 2.5 : 1.2, 'stroke-dasharray': c === 'wait' ? '5 3' : null, opacity: c ? 1 : 0.45 }));  // the box: thicker edge when using R, dashed when waiting, faded for slots not reached yet
          if (c) k.push(s('text', { x: x + (CW - 6) / 2, y: y + 21, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': c === 'use' ? 800 : 600, style: c === 'use' ? `fill:var(${PCOL[p]})` : c === 'wait' ? 'fill:var(--warn)' : null, class: c === 'rem' ? 's-sub' : null }, c === 'use' ? 'uses R' : c === 'wait' ? 'waits' : 'other'));  // label inside a reached box: "uses R" in the process's colour, "waits" in orange, or "other" in grey
        }  // ends the loop over slots
      });  // ends the loop over processes
      if (upto > 0 && upto <= SLOTS) {  // when the player is on a real slot, outline that slot's whole column
        const x = X0 + (upto - 1) * CW;  // x is the left edge of the current slot's column
        k.push(s('rect', { x: x + 0.5, y: 18, width: CW - 1, height: 121, rx: 9, fill: 'none', style: 'stroke:var(--chc)', 'stroke-width': 2 }));  // the outline, drawn in the chapter's colour so the student sees which slot the caption describes
      }  // ends the current-slot outline
      k.push(s('text', { x: X0, y: 153, 'font-size': 13, class: 's-sub' }, 'time →   the OS gives R to exactly one waiting process per slot'));  // footnote under the timeline: time runs left to right, one grant per slot
      svg.replaceChildren(...k);  // replaces the old drawing with the new shapes in one go
    }  // ends draw()
    let run = starveRun(policy);  // run holds the worked-out timeline for the current policy
    const waited = (p, upto) => run.grid[p].slice(1, upto + 1).filter((c) => c === 'wait').length;  // waited(p, upto): counts the slots up to upto in which p was waiting
    const used = (p, upto) => run.grid[p].slice(1, upto + 1).filter((c) => c === 'use').length;  // used(p, upto): counts the slots up to upto in which p used R
    function render(i) {  // render(i): called by the step player for step i; redraws the timeline and returns the caption text
      draw(run, i);  // draws the timeline up to slot i
      if (i === 0) return `All three processes want the resource R at slot 1. Policy: <b>${policy === 'fav' ? 'always prefer P1 or P3' : 'first come, first served'}</b>. Press Play or Next.`;  // step 0 caption: everyone wants R; names the current policy and says how to start
      const pick = run.who[i - 1];  // pick: who got R in slot i
      const w = [1, 2, 3].filter((p) => run.grid[p][i] === 'wait');  // w: who waited in slot i
      let cap = `<b>Slot ${i}:</b> the OS gives R to ${PN(pick)}.` + (w.length ? ` ${w.map((p) => PN(p)).join(' and ')} ${w.length > 1 ? 'wait' : 'waits'}.` : '');  // caption: who gets R in this slot and who waits
      if (policy === 'fav' && i === SLOTS) cap += ` ${PN(2)} has waited every single slot while the others took turns. Nothing is stuck, and work gets done, yet ${PN(2)} may <b>never</b> be served: <span class="t">starvation</span>.`;  // last slot, unfair policy: P2 has waited every slot, so the caption names the problem as starvation
      else if (policy === 'fav' && i >= 3) cap += ` P1 and P3 keep taking turns, so ${PN(2)} is passed over again.`;  // unfair policy from slot 3 on: points out P2 being passed over again
      else if (policy === 'fifo' && i === SLOTS) cap += ' With first come, first served, every process gets R regularly. Nobody starves.';  // last slot, fair policy: everyone got R regularly and nobody starved
      return cap;  // hands the caption to the player
    }  // ends render()
    const player = ctx.ui.player({ count: SLOTS + 1, render, interval: 1100 });  // player: the guide's step player (Play, Pause, Next, Previous) with 9 steps, slot 0 to 8, 1.1 seconds apart
    const seg = ctx.ui.seg([{ value: 'fav', label: 'Prefer P1 and P3' }, { value: 'fifo', label: 'First come, first served' }], policy, (v) => { policy = v; run = starveRun(v); player.reset(); });  // seg: a two-button switch between policies; choosing one recomputes the timeline and restarts the player
    return h('div', { class: 'stack cp-tab' },  // returns the finished tab, laid out as a vertical stack
      h('div', { class: 'row' }, h('span', { class: 'small b' }, 'OS policy for handing out R:'), seg),  // top row: a label and the policy switch
      h('div', { class: 'card white tight' }, svg), player.el,  // the timeline on a white card, followed by the player controls and caption
      h('div', { class: 'callout warn small m0', 'data-label': 'Deadlock vs starvation', html: 'In deadlock <b>nobody</b> in the group can move. In starvation the system keeps working; one unlucky process is simply passed over, indefinitely.' }));  // note comparing the two problems: in deadlock nobody moves; in starvation one process is passed over
  }  // ends starveLab()

  /* ---------------- cooperation by sharing: the a = b coherence puzzle ----------------
     Invariant: a == b.  Start a = b = 1.
       P1:  a = a + 1;  b = b + 1;        P2:  b = 2 * b;  a = 2 * a;
     Serial orders give (4,4) or (3,3). All four interleaved orders give a = 4, b = 3. */
  const CO_PROG = {  // CO_PROG: the two programs of the a = b puzzle; each line is [shown code, shown comment, function that runs it]
    1: [['a = a + 1;', '// add 1 to a', (m) => { m.a = m.a + 1; }], ['b = b + 1;', '// add 1 to b', (m) => { m.b = m.b + 1; }]],  // P1's two statements: add 1 to a, then add 1 to b (m is the shared memory holding a and b)
    2: [['b = 2 * b;', '// double b', (m) => { m.b = 2 * m.b; }], ['a = 2 * a;', '// double a', (m) => { m.a = 2 * m.a; }]],  // P2's two statements: double b, then double a (the opposite variable order from P1)
  };  // closes CO_PROG
  const CO_ORDERS = [[1, 1, 2, 2], [1, 2, 1, 2], [1, 2, 2, 1], [2, 1, 1, 2], [2, 1, 2, 1], [2, 2, 1, 1]];  // CO_ORDERS: all six ways to interleave the four statements while each process keeps its own order
  function coRun(order) { const m = { a: 1, b: 1 }, pc = { 1: 0, 2: 0 }; order.forEach((p) => CO_PROG[p][pc[p]++][2](m)); return m; }  // coRun(order): runs one order from a = b = 1 and returns the final a and b, to fill in the results grid
  function coherenceLab(ctx) {  // coherenceLab(ctx): builds the a = b puzzle in step 7, where the student steps P1 and P2 in any order
    const { h } = ctx;  // h is the guide's helper for making HTML elements
    let cs = false, st;  // cs = the "each pair is a critical section" switch; st = puzzle state
    const found = new Set();  // found: the orders the student has already completed, stored as text such as "1212" (a Set keeps no duplicates)
    const cards = {}, btns = {};  // cards and btns: each process's card and Step button, keyed by 1 and 2
    const mem = h('div', { class: 'co-mem' });  // mem: the middle box showing the shared a and b and whether a = b holds
    const outs = h('div', { class: 'co-outs' });  // outs: the grid of all six possible orders and their results
    const trail = h('span', { class: 'small' });  // trail: the "YOUR ORDER" line listing the steps taken so far
    const narr = h('div', { class: 'callout small m0 co-narr', 'data-label': 'Your move' });  // narr: the callout under the grid that explains each step
    const fresh = () => { st = { a: 1, b: 1, pc: { 1: 0, 2: 0 }, order: [] }; };  // fresh(): clean start: a = b = 1, neither process has run a line, no steps recorded
    const key = (o) => o.join('');  // key(o): turns an order such as [1, 2, 1, 2] into the text "1212" so it can be looked up in found
    function step(p) {  // step(p): runs process p's next statement when its Step button is clicked
      const o = 3 - p;  // o is the other process
      if (st.pc[p] >= 2) return;  // a process that has run both its statements has nothing left to do
      if (cs && st.pc[o] === 1) {  // with critical sections on, p may not start while the other is halfway through its pair of updates
        narr.className = 'callout small m0 co-narr'; narr.dataset.label = 'Blocked';  // the callout switches to a neutral look headed "Blocked"
        narr.innerHTML = `${PN(o)} is in the middle of its critical section, so ${PN(p)} must wait until ${PN(o)} has updated <b>both</b> a and b.`;  // explains that p must wait until the other has updated both a and b
        return;  // p does not run
      }  // ends the blocking check
      const [src, , fn] = CO_PROG[p][st.pc[p]];  // src is the statement text and fn the function that performs it (the middle item, the comment, is skipped)
      const before = { a: st.a, b: st.b };  // remembers a and b before the change so the message can say "from ... to ..."
      fn(st); st.pc[p]++; st.order.push(p);  // runs the statement on the shared values, moves p to its next line and records p in the order
      const done = st.order.length === 4;  // done is true once all four statements have run
      let tone = '', label = 'What happened', msg = `${PN(p)} runs <code>${src}</code>: ${src[0]} goes from ${before[src[0]]} to ${st[src[0]]}.`;  // message: which statement ran and how its variable changed (src[0] is the variable's letter, a or b)
      if (!done && st.a !== st.b) msg += ' a and b differ for now, which is fine while an update is still in progress.';  // mid-run, a and b may differ; the message says that is allowed while an update is in progress
      if (done) {  // after the fourth statement, judge the final result
        found.add(key(st.order));  // records this order as tried
        const ok = st.a === st.b;  // ok is true when the invariant a = b still holds
        tone = ok ? 'tip' : 'bad'; label = ok ? 'Coherent' : 'Coherence broken';  // green "Coherent" when it holds, red "Coherence broken" when it does not
        msg = ok ? `Finished with <b>a = ${st.a}, b = ${st.b}</b>. One process ran completely before the other, so a = b still holds.`  // explanation for a serial order: one process ran first, so a = b survived
          : `Finished with <b>a = ${st.a}, b = ${st.b}</b>. Each process alone keeps a = b, yet together they broke it: a became (1 + 1) × 2 = 4 but b became 1 × 2 + 1 = 3, because the updates reached a and b in opposite orders.`;  // explanation for a mixed order: the arithmetic shows why a ends at 4 but b at 3
        msg += ` <span class="muted">${found.size} of 6 orders tried.</span>`;  // adds how many of the six orders the student has tried so far
      }  // ends the final judgement
      narr.className = 'callout small m0 co-narr ' + tone; narr.dataset.label = label;  // colours the callout and sets its heading
      narr.innerHTML = msg;  // puts the explanation into the callout
      paint();  // refreshes the memory box, code lines, order trail and grid
    }  // ends step()
    function paint() {  // paint(): redraws every part of the puzzle from st
      const done = st.order.length === 4;  // done: whether all four statements have run
      const inv = st.a === st.b ? ['ok', 'a = b ✓'] : done ? ['bad', 'a ≠ b ✗'] : ['warn', 'a ≠ b (for now)'];  // invariant badge: green "a = b", red "a ≠ b" when finished, or orange "a ≠ b (for now)" mid-run
      mem.innerHTML = `<div class="co-cells">${['a', 'b'].map((v) => `<div class="co-cell"><span class="xs muted b">${v}</span><span class="co-val">${st[v]}</span></div>`).join('')}</div><div class="co-inv ${inv[0]}">${inv[1]}</div>`;  // the memory box: a cell for a and a cell for b with their values, then the invariant badge below
      [1, 2].forEach((p) => {  // updates each process's code card
        const pc = st.pc[p];  // pc: how many of its two statements this process has run
        cards[p].querySelector('.co-code').innerHTML = CO_PROG[p].map(([src, com], i) => `<div class="co-ln ${i === pc ? 'cur' : i < pc ? 'done' : ''}">${i < pc ? '✓' : i === pc ? '▸' : '·'} ${esc(src)} <span class="tk-com">${esc(com)}</span></div>`).join('');  // lists its two statements: a tick for done, an arrow on the next one, a dot for later, each with its comment
        btns[p].disabled = pc >= 2;  // the Step button turns off once the process has run both statements
      });  // ends the loop over the two cards
      trail.innerHTML = `<b class="xs muted">YOUR ORDER</b> ` + (st.order.length ? st.order.map((p) => `<b class="pc${p}">P${p}</b>`).join(' → ') : '<span class="muted">nothing yet</span>');  // the order trail: "YOUR ORDER" then the steps so far as coloured P1/P2 labels joined by arrows
      outs.innerHTML = CO_ORDERS.map((o) => {  // builds one grid entry for each of the six possible orders
        const k = key(o), f = found.has(k), m = coRun(o), serial = k === '1122' || k === '2211';  // k = the order's text; f = already tried; m = its final a and b; serial = one process ran completely first
        const blocked = cs && !serial;  // with critical sections on, only the two serial orders are possible
        return `<div class="co-out ${f ? 'found ' + (m.a === m.b ? 'good' : 'bad') : ''}"><span class="co-seq">${o.map((p) => `<i class="q${p}">${p}</i>`).join('')}</span>` +  // entry frame, outlined green or red once found, showing the order as small coloured 1s and 2s
          `<span class="co-res">${f ? `${m.a}, ${m.b} ${m.a === m.b ? '<span style="color:var(--ok)">✓</span>' : '<span style="color:var(--bad)">✗</span>'}` : blocked ? '<span class="xs muted">not allowed</span>' : '<span class="muted">?</span>'}</span></div>`;  // its result: the final a, b with a tick or cross if found, "not allowed" if critical sections forbid it, else "?"
      }).join('');  // joins the six entries into the grid
    }  // ends paint()
    function reset() { fresh(); narr.className = 'callout small m0 co-narr'; narr.dataset.label = 'Your move'; narr.innerHTML = cs ? '<b>Critical sections ON:</b> once a process starts its pair of updates, the other must wait until it finishes both. Try to break a = b now.' : 'Start with a = b = 1. Step P1 and P2 in any order. The grid lists all six possible orders: can you fill it in?'; paint(); }  // reset(): starts the puzzle again from a = b = 1 with instructions that match the critical-section switch
    [1, 2].forEach((p) => {  // builds the card and Step button for each process when the step opens
      btns[p] = h('button', { class: 'btn sm e-b' + p, type: 'button', onclick: () => step(p) }, 'Step P' + p);  // the Step button, coloured like its process; clicking it runs step(p)
      cards[p] = h('div', { class: 'card tight stack co-card e-p' + p }, h('div', { class: 'row nw' }, h('b', { class: 'pc' + p }, 'P' + p), h('span', { class: 'grow' }), btns[p]), h('div', { class: 'co-code' }));  // the card: a header with the process name and button, then an empty area for its two code lines
    });  // closes the loop
    const tog = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'false', onclick: () => { cs = !cs; tog.setAttribute('aria-pressed', String(cs)); tog.textContent = cs ? 'Each pair is a critical section: ON' : 'Each pair is a critical section: OFF'; reset(); } }, 'Each pair is a critical section: OFF');  // the critical-section switch: when on, each process's pair of updates cannot be interleaved; flipping it restarts
    reset();  // shows the opening state and instructions
    return h('div', { class: 'stack co-left' },  // returns the finished puzzle, laid out as a vertical stack
      h('div', { class: 'co-grid' }, cards[1], mem, cards[2]),  // top: P1's card, the shared memory box and P2's card, side by side
      h('div', { class: 'row' }, trail, h('span', { class: 'grow' }), tog, h('button', { class: 'btn sm primary', type: 'button', onclick: reset }, 'Run again')),  // a row with the order trail, the critical-section switch and a "Run again" button
      h('div', { class: 'row' }, h('span', { class: 'xs b muted' }, 'ALL SIX ORDERS'), h('span', { class: 'xs muted' }, '(1 = a step of P1, 2 = a step of P2) → final a, b')),  // heading for the grid, with a key: 1 is a step of P1, 2 a step of P2, then the final a and b
      outs, narr);  // the grid of orders and the explanation callout; closes the layout
  }  // ends coherenceLab()

  /* ---------------- cooperation by communication: three message scenarios ----------------
     'ok' request + reply; 'dead' both block in receive(); 'starve' P1 and P2 keep talking, P3 waits. */
  function messageLab(ctx) {  // messageLab(ctx): builds the message-passing demo in step 7, with three scenarios the student can switch between
    const { h, s } = ctx;  // h makes HTML elements, s makes SVG drawing elements
    const POS = { 1: [80, 95], 2: [360, 42], 3: [360, 150] };  // POS: where each process circle sits (P1 on the left, P2 top right, P3 bottom right)
    const path = (a, b, off) => {                       // start/end points between two circles, shifted sideways by off
      const [x1, y1] = POS[a], [x2, y2] = POS[b], L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;  // L is the distance between the two centres; ux, uy is the unit direction from the first circle to the second
      return [x1 + ux * 32 - uy * off, y1 + uy * 32 + ux * off, x2 - ux * 32 - uy * off, y2 - uy * 32 + ux * off];  // starts and ends 32 units from each centre (just outside the circles), shifted sideways by off so arrows do not overlap
    };  // ends path()
    const svg = s('svg', { viewBox: '0 0 440 188', width: '100%', role: 'img', 'aria-label': 'Processes exchanging messages' });  // svg: the message drawing, 440 by 188 units, scaled to fit the card
    const cap = h('div', { class: 'callout small m0 co-cap', 'data-label': 'What you see' });  // cap: the callout under the drawing that explains the current scenario
    let mode = 'ok', dot = null, t0 = 0, passed = 0, lastCycle = -1, counter = null;  // mode = current scenario; dot = the moving message; t0, passed and lastCycle drive the animation; counter = P3's label
    const CAP = {  // CAP: heading and explanation text for each scenario
      ok: ['Request and reply', `${PN(1)} calls <code>send(P2, request)</code>, then <code>receive(P2)</code> to wait for the answer. ${PN(2)} receives the request and sends a reply. Nothing is shared, so nothing needs locking.`],  // request-and-reply caption: P1 sends and then waits to receive; nothing is shared, so nothing is locked
      dead: ['Deadlock', `Each process waits to <b>receive</b> from the other before it sends anything. ${PN(1)} is blocked in <code>receive(P2)</code> and ${PN(2)} in <code>receive(P1)</code>. No message will ever arrive: <span class="t">deadlock</span> over a <span class="t">consumable resource</span>.`],  // deadlock caption: both processes wait in receive, so no message is ever sent (a consumable resource)
      starve: ['Starvation', `${PN(2)} and ${PN(3)} both want to talk to ${PN(1)}. ${PN(1)} keeps exchanging messages with ${PN(2)}, so ${PN(3)}’s request is never taken. Work goes on, but ${PN(3)} may wait forever: <span class="t">starvation</span>.`],  // starvation caption: P1 keeps answering P2, so P3's request is never taken
    };  // closes CAP
    function line(a, b, off, o = {}) {  // line(a, b, off, o): an arrow from process a toward process b, with extra settings in o
      const [x1, y1, x2, y2] = path(a, b, off);  // gets the arrow's end points from path()
      return s('line', Object.assign({ x1, y1, x2, y2, class: 's-line', 'stroke-width': 2.5 }, o));  // the SVG line, 2.5 units thick, with any extra settings (colour, dashes, arrowhead) merged in
    }  // ends line()
    function draw() {  // draw(): redraws the drawing for the current scenario; runs whenever the student switches scenario
      const k = [];  // k collects the shapes
      if (mode === 'ok' || mode === 'starve') {  // request-and-reply and starvation both show messages flowing between P1 and P2
        k.push(line(1, 2, -7, { 'marker-end': 'url(#arr-proc)', style: 'stroke:var(--proc)' }), line(2, 1, -7, { 'marker-end': 'url(#arr-accent)', style: 'stroke:var(--accent)' }));  // two arrows: P1 to P2 in P1's colour, and P2 back to P1 in P2's colour
        k.push(s('text', { x: 205, y: 52, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', transform: 'rotate(-10 205 52)' }, mode === 'ok' ? 'request' : 'message'));  // label on the upper arrow: "request" (or "message" in the starvation scenario), tilted to follow it
        k.push(s('text', { x: 232, y: 90, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', transform: 'rotate(-10 232 90)' }, mode === 'ok' ? 'reply' : 'message'));  // label on the lower arrow: "reply" (or "message"), tilted the same way
      }  // ends the P1-P2 arrows
      if (mode === 'dead') {  // deadlock scenario
        k.push(line(1, 2, -7, { 'stroke-dasharray': '6 5', style: 'stroke:var(--bad)', 'marker-end': 'url(#arr-bad)' }), line(2, 1, -7, { 'stroke-dasharray': '6 5', style: 'stroke:var(--bad)', 'marker-end': 'url(#arr-bad)' }));  // both arrows dashed and red: each process is waiting on the other, and nothing actually travels
        k.push(s('text', { x: 190, y: 34, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 900, style: 'fill:var(--bad)' }, 'each waits for the other'));  // red label: "each waits for the other"
      }  // ends the deadlock drawing
      if (mode === 'starve') {  // starvation scenario adds P3
        k.push(line(3, 1, 0, { 'stroke-dasharray': '6 5', style: 'stroke:var(--warn)', 'marker-end': 'url(#arr-warn)' }));  // a dashed orange arrow from P3 to P1: P3's request that never gets taken
        counter = s('text', { x: 196, y: 180, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--warn)' }, 'P3 waits…');  // counter: an orange label under the drawing that will count how many exchanges went ahead of P3
        k.push(counter);  // adds P3's waiting label to the drawing
      }  // ends the starvation extras
      [1, 2, 3].forEach((p) => {  // draws the three process circles
        const [x, y] = POS[p], dim = p === 3 && mode !== 'starve';  // x, y is the circle's centre; P3 is dimmed when it plays no part (every scenario except starvation)
        k.push(s('g', { opacity: dim ? 0.3 : 1 },  // groups the circle and its label; a dimmed group is drawn at 30% strength
          s('circle', { cx: x, cy: y, r: 28, class: ['s-proc', 's-accent', 's-thread'][p - 1], 'stroke-width': 2.5 }),  // the circle, styled in the process's colour
          s('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, style: `fill:var(${PCOL[p]})` }, 'P' + p)));  // "P1", "P2" or "P3" in the middle of its circle
      });  // closes the loop over the circles
      if (mode === 'dead') {  // deadlock scenario: shows where each process is stuck
        k.push(s('text', { x: 80, y: 144, 'text-anchor': 'middle', 'font-size': 13, class: 's-monot', style: 'fill:var(--bad)' }, 'receive(P2)…'));  // red "receive(P2)…" under P1: P1 is stuck waiting for a message from P2
        k.push(s('text', { x: 360, y: 90, 'text-anchor': 'middle', 'font-size': 13, class: 's-monot', style: 'fill:var(--bad)' }, 'receive(P1)…'));  // red "receive(P1)…" under P2: P2 is stuck waiting for a message from P1
      }  // ends the deadlock labels
      dot = mode === 'dead' ? null : s('rect', { width: 16, height: 11, rx: 2, x: -8, y: -5.5, class: 's-io', 'stroke-width': 1.5 });  // dot: a small envelope-shaped box that travels along the arrows; there is none in deadlock, since nothing moves
      if (dot) k.push(dot);  // adds the envelope to the drawing when it exists
      svg.replaceChildren(...k);  // replaces the old drawing with the new shapes in one go
    }  // ends draw()
    function frame(now) {  // frame(now): runs on every animation frame (about 60 times a second) and moves the envelope; now is the time in ms
      if (!dot) return;  // nothing to move in the deadlock scenario
      if (!t0) t0 = now;  // t0 remembers when this scenario's animation started
      const T = 2400, u = ((now - t0) % T) / T, cycle = Math.floor((now - t0) / T);  // one round trip takes 2.4 seconds: u is how far through the current trip (0 to 1), cycle counts finished trips
      const [ax, ay, bx, by] = u < 0.5 ? path(1, 2, -7) : path(2, 1, -7);  // first half of the trip: along the P1-to-P2 arrow; second half: back along the P2-to-P1 arrow
      const f = u < 0.5 ? u * 2 : (u - 0.5) * 2;  // f: how far along the current arrow, from 0 to 1
      dot.setAttribute('transform', `translate(${(ax + (bx - ax) * f).toFixed(1)} ${(ay + (by - ay) * f).toFixed(1)})`);  // moves the envelope to the point that fraction of the way along the arrow
      if (mode === 'starve' && cycle !== lastCycle) { lastCycle = cycle; passed = cycle; if (counter) counter.textContent = `P3 waits · ${passed} exchange${passed === 1 ? '' : 's'} went ahead`; }  // in the starvation scenario, after each round trip, updates P3's label with how many exchanges went ahead of it
    }  // ends frame()
    function set(m) {  // set(m): switches to scenario m; called when the student clicks one of the three scenario buttons
      mode = m; t0 = 0; passed = 0; lastCycle = -1; draw();  // stores the scenario, restarts the animation clock and the counter, and redraws
      cap.dataset.label = CAP[m][0]; cap.className = 'callout small m0 co-cap ' + (m === 'ok' ? 'tip' : m === 'dead' ? 'bad' : 'warn');  // gives the caption its heading and colour: green for request and reply, red for deadlock, orange for starvation
      cap.innerHTML = CAP[m][1];  // puts the scenario's explanation into the caption
    }  // ends set()
    const seg = ctx.ui.seg([{ value: 'ok', label: 'Request and reply' }, { value: 'dead', label: 'Deadlock' }, { value: 'starve', label: 'Starvation' }], 'ok', set);  // seg: the three-button scenario switch (request and reply, deadlock, starvation); a click calls set()
    set('ok');  // starts on the request-and-reply scenario
    ctx.raf(frame);  // starts the animation loop; the guide stops it automatically when the student leaves the step
    return h('div', { class: 'stack co-right' }, seg, h('div', { class: 'card white tight' }, svg), cap);  // returns the demo: the switch, the drawing on a white card, and the caption
  }  // ends messageLab()


  Guide.section({  // registers section 5.2 with the guide; everything from here to the end is one description object
    id: '5.2',  // the section number, used in links, saved progress and the style prefix .sec-5-2
    title: 'Principles of Concurrency',  // the full title shown at the top of the section
    short: 'Concurrency principles',  // a shorter title for menus and the table of contents
    summary: 'Races, the OS’s concerns, how processes interact, and the six rules any mutual exclusion scheme must meet.',  // one-sentence summary shown on the chapter page
    objectives: [  // learning objectives: what the student should be able to do after this section
      'Explain why the relative speed of concurrent processes cannot be predicted, and the three difficulties this creates.',  // objective 1: explain unpredictable relative speed and the three difficulties it causes
      'Trace the echo example and other race conditions, and work out every final value an interleaving can produce.',  // objective 2: trace echo and other races and find every possible final value
      'List the four concerns concurrency raises for the OS, and classify process interaction by degree of awareness.',  // objective 3: list the OS's four concerns and classify interaction by degree of awareness
      'Recognise mutual exclusion, deadlock, starvation and data-coherence problems in competing and cooperating processes.',  // objective 4: recognise mutual exclusion, deadlock, starvation and data-coherence problems
      'State the six requirements for mutual exclusion and identify which ones a proposed mechanism breaks.',  // objective 5: state the six requirements and spot which one a mechanism breaks
    ],  // closes the objectives list
    terms: [  // glossary terms for this section, as [term, definition] pairs; dotted words in the text show these definitions
      ['Relative speed', 'How fast one process runs compared with the others. It changes from run to run because it depends on other processes, interrupts and the scheduler.'],  // glossary entry: defines relative speed
      ['Nondeterministic', 'Describes a program whose result can differ from one run to the next, even with identical input, because the timing of its steps differs. Its bugs are hard to reproduce.'],  // glossary entry: defines nondeterministic
      ['Global variable', 'A variable declared outside every procedure, so all code in the program uses the same copy. Threads of one process share it; separate processes each get their own copy unless it is placed in memory they share.'],  // glossary entry: defines global variable, and when separate processes do or do not share one
      ['I/O channel', 'A piece of I/O hardware, in effect a small special-purpose processor, that moves data between main memory and devices with little help from the CPU. The OS can grant a process the use of a channel for its I/O.'],  // glossary entry: defines an I/O channel
      ['Race condition', 'Several processes or threads read and write shared data, and the final result depends on the relative timing of their steps. When two writes collide, the last one to write decides the value.'],  // glossary entry: defines a race condition
      ['Critical resource', 'A resource that cannot be shared: only one process may use it at a time. A printer is the classic example.'],  // glossary entry: defines a critical resource
      ['Critical section', 'The part of a program that uses a critical resource or shared data. At most one process may be inside its critical section for a given resource at a time.'],  // glossary entry: defines a critical section
      ['Mutual exclusion', 'The guarantee that while one process is inside a critical section for a resource, no other process is inside a critical section for that same resource.'],  // glossary entry: defines mutual exclusion
      ['Deadlock', 'Each process in a group waits for something that only another member of the group can give, so none of them can ever continue.'],  // glossary entry: defines deadlock
      ['Starvation', 'A process that is ready to go is passed over again and again, indefinitely, while other processes keep getting the resource it needs.'],  // glossary entry: defines starvation
      ['Degree of awareness', 'How much processes know about each other: not at all, indirectly through a shared object, or directly by name through messages.'],  // glossary entry: defines degree of awareness
      ['Competition', 'The relationship between processes that are unaware of each other but need the same resources, so the OS must referee who gets what.'],  // glossary entry: defines competition
      ['Cooperation by sharing', 'Processes that know about each other only indirectly, because they read and write the same shared object, such as a variable, file or buffer.'],  // glossary entry: defines cooperation by sharing
      ['Cooperation by communication', 'Processes that know each other by name and work together by sending and receiving messages, instead of sharing memory.'],  // glossary entry: defines cooperation by communication
      ['Communication primitive', 'A basic operation, such as send or receive, provided by the OS or programming language so that processes can exchange messages.'],  // glossary entry: defines a communication primitive
      ['Data coherence', 'Keeping shared data consistent: every relationship that is supposed to hold between data items, such as a being equal to b, still holds after concurrent updates.'],  // glossary entry: defines data coherence
      ['Invariant', 'A condition that must be true whenever no update is in progress, for example a = b. An update may break it briefly but must restore it before it finishes.'],  // glossary entry: defines an invariant
      ['Renewable resource', 'A resource that is not used up: when one process releases it, another can use it. Processors, memory, files and I/O channels are examples. Also called a reusable resource.'],  // glossary entry: defines a renewable (reusable) resource
      ['Consumable resource', 'A resource that is created and then destroyed when a process takes it, such as a message or a signal. Once received, it is gone.'],  // glossary entry: defines a consumable resource
    ],  // closes the glossary list

    /* Scoped CSS: every selector starts with .sec-5-2 */
    css: ` /* the section's own style rules (CSS, the language that sets colours, sizes and layout), as one block of text */
      .sec-5-2 .pc1 { color: var(--proc); } /* text marked pc1 is drawn in P1's colour (teal) */
      .sec-5-2 .pc2 { color: var(--accent); } /* text marked pc2 is drawn in P2's colour (indigo) */
      .sec-5-2 .pc3 { color: var(--thread); } /* text marked pc3 is drawn in P3's colour (pink) */
      .sec-5-2 .chr { font-family: var(--mono); font-weight: 800; } /* typed characters (from CH) use the monospace font in extra bold so single letters stand out */
      .sec-5-2 .mini { font-size: 13px; } /* class mini: 13px text for compact labels (no element in this section uses it at the moment) */
      .sec-5-2 .tight p { margin-bottom: 6px; } /* tightens the space under paragraphs inside a compact block */
      .sec-5-2 .s1-list li { margin: 5px 0; } /* spaces out the three numbered difficulties in step 1 */
      .sec-5-2 .s1-why { padding-left: 20px; } /* indents the step 1 list of what relative speed depends on */
      .sec-5-2 .s1-why li { margin: 2px 0; } /* small gaps between the items of that list */
      .sec-5-2 .s1-demo { gap: 9px; } /* spacing between the parts of the step 1 "Try it" card */
      .sec-5-2 .s1-screen { display: flex; align-items: center; gap: 4px; min-height: 46px; padding: 4px 12px; border-radius: 10px; background: var(--panel-3); font-size: 26px; letter-spacing: .06em; } /* the step 1 "screen" strip: letters in a row on a shaded panel, large and slightly spaced like a terminal */
      .sec-5-2 .s1-screen .xs { letter-spacing: .08em; margin-right: 12px; } /* the small "SCREEN" label inside that strip, spaced out and set apart from the letters */
      .sec-5-2 .s1-hist { gap: 6px; } /* spacing between the history chips under the step 1 demo */
      .sec-5-2 pre.code .ln.m1 { background: color-mix(in srgb, var(--proc) 16%, transparent); border-left-color: var(--proc); } /* a code line where P1 is about to run gets a light teal wash and a teal left edge */
      .sec-5-2 pre.code .ln.m2 { background: color-mix(in srgb, var(--accent) 16%, transparent); border-left-color: var(--accent); } /* a code line where P2 is about to run gets a light indigo wash and an indigo left edge */
      .sec-5-2 pre.code .ln.m1::before { content: 'P1'; color: var(--proc); opacity: 1; font-weight: 800; } /* replaces the line number with a teal "P1" tag, so the student sees where P1 is in echo */
      .sec-5-2 pre.code .ln.m2::before { content: 'P2'; color: var(--accent); opacity: 1; font-weight: 800; } /* replaces the line number with an indigo "P2" tag for P2 */
      .sec-5-2 pre.code .ln.m1.m2::before { content: 'both'; color: var(--ink); font-size: .8em; width: 3.25em; } /* when both processes are on the same line, the tag reads "both" in smaller text so it fits */
      .sec-5-2 .e-goal { font-size: 13px; white-space: normal; line-height: 1.3; padding: 3px 10px; border-radius: 8px; } /* echo challenge chips: small text that may wrap onto a second line */
      .sec-5-2 .e-goal::before { content: '○'; font-weight: 900; } /* an unfinished challenge shows an empty circle in front of its text */
      .sec-5-2 .e-goal.ok::before { content: '✓'; } /* a finished challenge shows a tick instead */
      .sec-5-2 .e-p1 { border-top: 4px solid var(--proc); } /* P1's card in the echo lab has a thick teal top edge */
      .sec-5-2 .e-p2 { border-top: 4px solid var(--accent); } /* P2's card has a thick indigo top edge */
      .sec-5-2 .e-b1 { border-color: var(--proc); color: var(--proc); } /* P1's buttons are outlined and labelled in teal */
      .sec-5-2 .e-b2 { border-color: var(--accent); color: var(--accent); } /* P2's buttons are outlined and labelled in indigo */
      .sec-5-2 .e-stat .chip { font-size: 12.5px; } /* slightly smaller chips in the process cards' status line */
      .sec-5-2 .e-narr { min-height: 104px; font-size: 15px; line-height: 1.45; } /* the echo explanation box keeps a minimum height so the layout does not jump as messages change length */
      .sec-5-2 .e-log { min-height: 80px; font-size: 13px; } /* the echo schedule log keeps a minimum height and uses small text so many lines fit */
      .sec-5-2 .r1-box, .sec-5-2 .stack > .callout { flex: none; } /* the race example 1 box and callouts in stacks keep their natural height instead of being squeezed */
      .sec-5-2 .r1-a { min-width: 118px; } /* the big "a = ?" readout in race example 1 keeps a fixed width so the message beside it does not jump */
      .sec-5-2 .r1-msg { line-height: 1.4; } /* comfortable line spacing for the message beside that readout */
      .sec-5-2 .r2 { gap: 10px; } /* spacing between the parts of race example 2's card */
      .sec-5-2 .r2-grid { display: grid; grid-template-columns: minmax(0, 1fr) 96px minmax(0, 1fr); gap: 10px; } /* race example 2 layout: P3's panel, a 96px memory column, P4's panel, in three columns */
      .sec-5-2 .r2-mem { justify-content: center; } /* centres the b and c cells vertically in the memory column */
      .sec-5-2 .r2-cell { display: flex; flex-direction: column; align-items: center; border: 2px solid var(--mem); background: var(--mem-bg); border-radius: 10px; padding: 2px 0 4px; } /* a memory cell for b or c: a small labelled box in the memory colour */
      .sec-5-2 .r2-val { font-family: var(--mono); font-size: 28px; font-weight: 800; line-height: 1.1; } /* the value inside a memory cell, large and in monospace */
      .sec-5-2 .r2-ln { font-size: 14px; padding: 2px 6px; border-radius: 6px; } /* a code line in race example 2's process panels */
      .sec-5-2 .r2-ln.cur { background: var(--hl); } /* the line a process will run next is highlighted in yellow */
      .sec-5-2 .r2-ln.done { color: var(--muted); } /* lines already run are greyed out */
      .sec-5-2 .r2-narr { flex: 1; min-height: 44px; line-height: 1.4; } /* the example 2 narration grows to fill the row beside the Run again button and keeps a minimum height */
      .sec-5-2 .r2-tbl th.mono { text-transform: none; letter-spacing: 0; font-size: 14px; } /* the b and c column headings in the outcomes table keep their normal case and spacing */
      @media (max-width: 760px) { .sec-5-2 .r2-grid { grid-template-columns: minmax(0, 1fr); } .sec-5-2 .r2-mem { flex-direction: row; } .sec-5-2 .r2-cell { flex: 1; } } /* on phone-width screens (760px or less) example 2 stacks into one column and the b, c cells sit side by side */
      .sec-5-2 .c4-row { display: flex; gap: 12px; align-items: flex-start; text-align: left; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel-2); cursor: pointer; color: var(--ink); font: inherit; } /* step 4: each of the four concerns is a full-width clickable row with a number badge and text */
      .sec-5-2 .c4-row:hover { border-color: var(--chc); } /* hovering a concern row outlines it in the chapter colour */
      .sec-5-2 .c4-row.on { border-color: var(--chc); box-shadow: 0 0 0 1px var(--chc); background: color-mix(in srgb, var(--chc) 8%, var(--panel)); } /* the selected concern row gets a chapter-colour outline and a faint tint */
      .sec-5-2 .c4-n { flex: none; display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--panel-3); font-weight: 800; font-size: 14px; } /* the round number badge in front of each concern */
      .sec-5-2 .c4-row.on .c4-n, .sec-5-2 .c4-detail .c4-n { background: var(--chc); color: var(--panel); } /* the selected row's badge, and the big badge in the detail card, are filled with the chapter colour */
      .sec-5-2 .c4-t { display: flex; flex-direction: column; gap: 2px; font-size: 16px; line-height: 1.3; } /* a concern's title and one-line description stacked in a column */
      .sec-5-2 .c4-d { font-weight: 400; } /* the description line uses normal weight so the bold title stands out */
      .sec-5-2 .c4-detail { gap: 12px; } /* spacing between the parts of the detail card */
      .sec-5-2 .c4-res { gap: 10px; min-height: 30px; } /* the correct/wrong result line of the speed demo keeps a minimum height so the card does not jump */
      .sec-5-2 .c4-detail svg { flex: none; } /* drawings inside the detail card keep their size instead of shrinking */
      .sec-5-2 .c4-chg { background: var(--hl); font-weight: 700; } /* a process-record cell that just changed is highlighted in yellow and bold */
      .sec-5-2 .c4-note { min-height: 42px; line-height: 1.4; } /* the event explanation under the process table keeps a minimum height */
      .sec-5-2 .aw-tbl { font-size: 14.5px; table-layout: fixed; } /* step 5 awareness table: equal column widths regardless of content */
      .sec-5-2 .aw-tbl th:first-child { width: 104px; } /* the first column (row labels) is 104px wide */
      .sec-5-2 .aw-tbl th { text-transform: none; letter-spacing: 0; font-size: 15px; color: var(--ink); } /* column headings keep their normal case and spacing, a little larger, in the main text colour */
      .sec-5-2 .aw-ex { font-size: 12.5px; font-weight: 500; color: var(--muted); margin-top: 2px; line-height: 1.3; } /* the grey "e.g." example under each column heading */
      .sec-5-2 .aw-lbl { font-weight: 700; font-size: 13.5px; color: var(--ink-2); } /* row labels (Relationship, Influence, Control problems) in bold, slightly smaller text */
      .sec-5-2 .aw-cell { line-height: 1.35; transition: background .2s; } /* table cells fade their background smoothly when their column is highlighted */
      .sec-5-2 .aw-p { padding: 1px 0; } /* one control problem per line inside a table cell */
      .sec-5-2 .aw-p::before { content: '• '; color: var(--chc); font-weight: 900; } /* a bullet in the chapter colour in front of each control problem */
      .sec-5-2 table.tbl .aw-on { background: color-mix(in srgb, var(--chc) 11%, var(--panel)); } /* the column that matches the current scenario is tinted with the chapter colour */
      .sec-5-2 .aw-rev { width: 100%; border: 1px dashed var(--line-2); } /* the Reveal button fills its cell and has a dashed border */
      .sec-5-2 .aw-game { gap: 10px; } /* spacing between the parts of the classifier card */
      .sec-5-2 .aw-q { font-size: 16.5px; line-height: 1.45; min-height: 104px; } /* the scenario text is larger and the box keeps a minimum height so the buttons below do not jump */
      .sec-5-2 .aw-choice { justify-content: flex-start; height: 38px; } /* the three answer buttons: text aligned left, fixed height */
      .sec-5-2 .aw-choice.aw-right { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); opacity: 1; } /* the right answer turns green (full strength even though it is disabled) */
      .sec-5-2 .aw-choice.aw-wrong { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); opacity: 1; } /* a wrong pick turns red (full strength even though it is disabled) */
      .sec-5-2 .aw-fb { min-height: 96px; line-height: 1.45; } /* the classifier's feedback area keeps a minimum height */
      /* shell workaround: in narrow (phone) mode a "Hands-on lab" eyebrow that is just wider than the
         screen widened the whole canvas. Giving the eyebrow no intrinsic width lets it clip as intended. */
      .sec-5-2 .step-eyebrow { contain: inline-size; } /* the small label above the step title gets no width of its own, so on a small screen it clips instead of widening the page */
      .sec-5-2 .rc-row .chip { white-space: normal; } /* chips in the recap's row may wrap onto two lines */
      /* step 6: competition lab */
      .sec-5-2 .e-b3 { border-color: var(--thread); color: var(--thread); } /* P3's buttons are outlined and labelled in pink */
      .sec-5-2 .e-p3 { border-top: 4px solid var(--thread); } /* P3's card has a thick pink top edge */
      .sec-5-2 .cp-left { gap: 10px; } /* spacing in step 6's left column */
      .sec-5-2 .cp-tabs .tabs-strip { margin-bottom: 8px; } /* a little space between the tab buttons and the tab content */
      .sec-5-2 .cp-tab { gap: 9px; height: 100%; } /* each tab's content fills the full height of the tab panel */
      .sec-5-2 .cp-card { padding: 8px 10px; gap: 5px; } /* compact padding inside the printer tab's process cards */
      .sec-5-2 .cp-card .btn { width: 100%; } /* each card's action button stretches to the card's full width */
      .sec-5-2 .cp-st { font-size: 13.5px; line-height: 1.35; min-height: 38px; } /* the process status text keeps a minimum height so the buttons line up across the three cards */
      .sec-5-2 .cp-mid { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 10px; min-height: 0; flex: 1 1 auto; } /* printer tab middle row: a 210px printer panel beside the printout, which takes the rest of the width */
      .sec-5-2 .cp-res { align-self: start; display: flex; flex-direction: column; gap: 6px; border: 2px solid var(--io); background: var(--io-bg); border-radius: 12px; padding: 8px 10px; } /* the printer panel: a rounded box in the I/O colour, stuck to the top of its row */
      .sec-5-2 .cp-res.bad { border-color: var(--bad); background: var(--bad-bg); } /* the printer panel turns red when two processes use the printer at once */
      .sec-5-2 .cp-res-h { font-weight: 800; font-size: 15px; } /* the printer panel's heading */
      .sec-5-2 .cp-slot { font-size: 14px; line-height: 1.35; } /* each line of the printer panel (in use by, queue, totals) */
      .sec-5-2 .cp-paper { font-size: 13.5px; background: var(--panel); border: 1px solid var(--line); min-height: 128px; max-height: 210px; } /* the printout box: small text on a plain panel, 128 to 210px tall (it scrolls when longer) */
      .sec-5-2 .cp-paper > div { display: flex; align-items: center; gap: 8px; border-bottom: 1px dashed var(--line); } /* each printed page is one row, separated by a dashed line */
      .sec-5-2 .cp-pg { border-left: 4px solid var(--line-2); padding-left: 7px; font-weight: 700; } /* a page label with a coloured bar on its left edge */
      .sec-5-2 .cp-pg.p1 { border-color: var(--proc); color: var(--proc); } /* P1's pages are marked in teal */
      .sec-5-2 .cp-pg.p2 { border-color: var(--accent); color: var(--accent); } /* P2's pages are marked in indigo */
      .sec-5-2 .cp-pg.p3 { border-color: var(--thread); color: var(--thread); } /* P3's pages are marked in pink */
      .sec-5-2 .cp-narr { min-height: 66px; line-height: 1.42; } /* the explanation callout in step 6 keeps a minimum height so the layout does not jump */
      .sec-5-2 .cp-dl { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; } /* deadlock tab: the two process cards in two equal columns */
      .sec-5-2 .cp-dl pre.code { font-size: 13px; padding: 4px 0; overflow: hidden; } /* the deadlock code boxes use smaller text and no scroll bars */
      .sec-5-2 .cp-dl pre.code .ln { padding-right: 4px; } /* a little padding on the right of each code line */
      .sec-5-2 .cp-dl .card { padding: 8px 9px; } /* compact padding inside the deadlock cards */
      .sec-5-2 .cp-dl pre.code .ln.cur { background: color-mix(in srgb, var(--chc) 16%, transparent); } /* a process's next line is tinted with the chapter colour */
      .sec-5-2 .cp-dl pre.code .ln.bad { background: var(--bad-bg); border-left-color: var(--bad); } /* a line where the process is blocked is tinted red with a red left edge */
      .sec-5-2 .cp-graph { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 12px; align-items: start; } /* deadlock tab lower row: a 300px resource graph beside the explanation */
      .sec-5-2 .cp-sv-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; } /* class cp-sv-grid: a one-column grid (no element in this section uses it at the moment) */
      .sec-5-2 .cp-legend { font-size: 13px; } /* class cp-legend: small legend text (no element in this section uses it at the moment) */
      @media (max-width: 760px) { .sec-5-2 .cp-mid, .sec-5-2 .cp-dl, .sec-5-2 .cp-graph { grid-template-columns: minmax(0, 1fr); } } /* on phone-width screens (760px or less) the printer row, the deadlock cards and the graph row stack into one column */
      /* step 7: cooperation (data coherence puzzle + messages) */
      .sec-5-2 .co-left { gap: 9px; } /* spacing in step 7's left column */
      .sec-5-2 .co-grid { display: grid; grid-template-columns: minmax(0, 1fr) 124px minmax(0, 1fr); gap: 10px; } /* a = b puzzle layout: P1's card, a 124px shared-memory column, P2's card */
      .sec-5-2 .co-card { padding: 8px 10px; gap: 4px; } /* compact padding inside the puzzle's process cards */
      .sec-5-2 .co-ln { font-family: var(--mono); font-size: 13.5px; padding: 1px 6px; border-radius: 6px; white-space: nowrap; } /* a code line in the puzzle: monospace, never wrapped */
      .sec-5-2 .co-ln .tk-com { font-family: var(--mono); } /* the comment on each code line also uses monospace so it stays lined up */
      .sec-5-2 .co-ln.cur { background: var(--hl); } /* the next line to run is highlighted in yellow */
      .sec-5-2 .co-ln.done { color: var(--muted); } /* lines already run are greyed out */
      .sec-5-2 .co-mem { display: flex; flex-direction: column; gap: 5px; align-items: stretch; } /* the shared-memory column: the a and b cells above the invariant badge */
      .sec-5-2 .co-cells { display: flex; gap: 6px; } /* the a and b cells side by side */
      .sec-5-2 .co-cell { flex: 1; display: flex; flex-direction: column; align-items: center; border: 2px solid var(--mem); background: var(--mem-bg); border-radius: 10px; padding: 1px 0 3px; } /* a memory cell for a or b: a small labelled box in the memory colour */
      .sec-5-2 .co-val { font-family: var(--mono); font-size: 26px; font-weight: 800; line-height: 1.1; } /* the value inside a memory cell, large and in monospace */
      .sec-5-2 .co-inv { text-align: center; font-size: 13px; font-weight: 800; border-radius: 8px; padding: 2px 4px; background: var(--panel-3); } /* the invariant badge under the cells (shows a = b or a ≠ b) */
      .sec-5-2 .co-inv.ok { background: var(--ok-bg); color: var(--ok); } /* the badge turns green while a = b holds */
      .sec-5-2 .co-inv.bad { background: var(--bad-bg); color: var(--bad); } /* red when the finished run broke a = b */
      .sec-5-2 .co-inv.warn { background: var(--warn-bg); color: var(--warn); } /* orange while a and b differ in the middle of an update */
      .sec-5-2 .co-outs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; } /* the six orders are laid out in a grid of three columns */
      .sec-5-2 .co-out { border: 1px solid var(--line); border-radius: 10px; padding: 4px 8px; background: var(--panel-2); font-size: 13.5px; display: flex; align-items: center; gap: 6px; } /* each order entry: a small rounded box with the order on the left and the result on the right */
      .sec-5-2 .co-out.found { background: var(--panel); border-color: var(--line-2); } /* an order already tried gets a plain background and a darker border */
      .sec-5-2 .co-out.found.good { border-color: var(--ok); } /* a tried order that kept a = b gets a green border */
      .sec-5-2 .co-out.found.bad { border-color: var(--bad); } /* a tried order that broke a = b gets a red border */
      .sec-5-2 .co-seq { display: inline-flex; gap: 2px; } /* the order's digits sit in a row with small gaps */
      .sec-5-2 .co-seq i { font-style: normal; font-weight: 800; font-size: 12.5px; padding: 0 3px; border-radius: 4px; } /* each digit of an order is a small bold tag (the i element is used only as a styling hook, not italics) */
      .sec-5-2 .co-seq i.q1 { color: var(--proc); background: var(--proc-bg); } /* a 1 (a step of P1) is teal on a light teal background */
      .sec-5-2 .co-seq i.q2 { color: var(--accent); background: var(--accent-bg); } /* a 2 (a step of P2) is indigo on a light indigo background */
      .sec-5-2 .co-res { margin-left: auto; font-family: var(--mono); font-weight: 800; white-space: nowrap; } /* the result (final a, b) is pushed to the right end of the entry, in bold monospace */
      .sec-5-2 .co-narr { min-height: 70px; line-height: 1.42; } /* the puzzle's explanation callout keeps a minimum height so the layout does not jump */
      .sec-5-2 .co-right { gap: 9px; } /* spacing in step 7's right column (the message demo) */
      .sec-5-2 .co-cap { min-height: 88px; line-height: 1.42; } /* the message caption keeps a minimum height so switching scenarios does not move the layout */
      @media (max-width: 760px) { .sec-5-2 .co-grid, .sec-5-2 .co-outs { grid-template-columns: minmax(0, 1fr); } } /* on phone-width screens (760px or less) the puzzle cards and the order grid stack into one column */
      /* step 8: six requirements game */
      .sec-5-2 .rq-list { gap: 6px; } /* spacing between the six requirement buttons in step 8 */
      .sec-5-2 .rq { display: flex; gap: 10px; align-items: flex-start; text-align: left; width: 100%; padding: 7px 10px; border: 2px solid var(--line); border-radius: 11px; background: var(--panel-2); cursor: pointer; color: var(--ink); font: inherit; transition: border-color .15s, background .15s; } /* a requirement button: full width, number badge then text, rounded border, colours fade when it changes */
      .sec-5-2 .rq:hover:not(:disabled) { border-color: var(--chc); } /* hovering a requirement that can still be clicked outlines it in the chapter colour */
      .sec-5-2 .rq:disabled { cursor: default; } /* once answered, the buttons stop showing the pointing-hand cursor */
      .sec-5-2 .rq.right { border-color: var(--ok); background: var(--ok-bg); } /* the requirement the proposal really breaks turns green */
      .sec-5-2 .rq.wrong { border-color: var(--bad); background: var(--bad-bg); } /* a wrong pick turns red */
      .sec-5-2 .rq-n { flex: none; display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--chc); color: var(--panel); font-weight: 800; font-size: 14px; } /* the round number badge (1 to 6), filled with the chapter colour */
      .sec-5-2 .rq-t { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; font-size: 15.5px; line-height: 1.3; } /* the requirement's short title and description stacked, taking all the remaining width */
      .sec-5-2 .rq-d { font-weight: 400; font-size: 13.5px; color: var(--ink-2); } /* the description line is lighter and a little smaller than the title */
      .sec-5-2 .rq-tally { flex: none; align-self: center; } /* the "spotted" tally chip sits at the right edge, centred vertically */
      .sec-5-2 .rq-game { gap: 10px; } /* spacing between the parts of the game column */
      .sec-5-2 .rq-scn { font-size: 17px; line-height: 1.5; min-height: 118px; } /* the proposal text is large and its box keeps a minimum height so the feedback below does not jump */
      .sec-5-2 .rq-fb { min-height: 128px; line-height: 1.45; } /* the feedback callout keeps a minimum height as well */
      .sec-5-2 .rq-dots { display: flex; gap: 5px; } /* the row of progress dots, one per proposal */
      .sec-5-2 .rq-dots i { width: 12px; height: 12px; border-radius: 50%; background: var(--panel-3); border: 1px solid var(--line-2); } /* each progress dot: a small grey circle */
      .sec-5-2 .rq-dots i.ok { background: var(--ok); border-color: var(--ok); } /* a dot for a correct answer is filled green */
      .sec-5-2 .rq-dots i.bad { background: var(--bad); border-color: var(--bad); } /* a dot for a wrong answer is filled red */
      .sec-5-2 .rq-dots i.cur { border: 2px solid var(--chc); } /* the dot for the current proposal gets a thicker chapter-colour ring */
    `,  // end of the CSS text

    steps: [  // steps: the ten screens of this section, in order; each is one object with a title, a kind and its content
      /* ---------------- 1. Big picture: relative speed is unpredictable ---------------- */
      {  // step 1 begins
        title: 'Same program, different output: the timing problem',  // the step's heading
        kind: 'story',  // kind 'story': an introductory step (the kind sets the label shown above the title)
        html: `${/* html: the step's fixed page content, written as HTML text; the render function below adds the live demo */''}
          <div class="split l fill">${/* two-column layout that fills the step: the explanation on the left, the demo card on the right */''}
            <div class="stack tight">${/* left column: a compact stack of paragraphs */''}
              <p class="lead m0">Why did 5.1 forbid any assumption about speed? Because nobody can say in advance how fast each process will run compared with the others.</p>${/* opening paragraph: why no assumption about relative speed can be made */''}
              <p class="m0">On a single processor the OS <span class="t" data-t="Interleaving">interleaves</span> processes, a slice at a time. On a multiprocessor they are also <span class="t" data-t="Overlapping">overlapped</span>: some truly run at the same instant. Either way, the problems are identical.</p>${/* paragraph: interleaving on one processor versus overlapping on several; the same problems either way */''}
              <div class="small">${/* a smaller-text block about what relative speed depends on */''}
                <p class="m0">A process’s <span class="t">relative speed</span> depends on three things it cannot control:</p>${/* lead-in: relative speed depends on three things outside the process's control */''}
                <ul class="m0 s1-why">${/* the list of those three things */''}
                  <li><b>What other processes do</b>: how much CPU time they take</li>${/* item 1: what other processes do */''}
                  <li><b>How the OS handles interrupts</b>: they can pause it anytime</li>${/* item 2: how the OS handles interrupts */''}
                  <li><b>The OS’s scheduling policy</b>: who runs next, for how long</li>${/* item 3: the OS's scheduling policy */''}
                </ul>${/* ends the list */''}
              </div>${/* ends the smaller-text block */''}
              <div>${/* block for the three difficulties */''}
                <h4>Three difficulties that follow</h4>${/* heading: the three difficulties that follow */''}
                <ol class="s1-list small m0">${/* numbered list of the difficulties */''}
                  <li><b>Sharing global resources is risky.</b> If two processes share one <span class="t">global variable</span>, the order of their steps decides the result.</li>${/* difficulty 1: sharing a global variable makes the result depend on step order */''}
                  <li><b>Allocating resources well is hard.</b> Say P1 is granted an <span class="t">I/O channel</span>, then suspended before using it. Keeping the channel locked for P1 leaves it idle while others wait, and can even cause deadlock.</li>${/* difficulty 2: allocating an I/O channel to a suspended process leaves it idle and risks deadlock */''}
                  <li><b>Bugs are hard to find.</b> Results are <span class="t">nondeterministic</span>, so a failure may not happen again when you rerun the program to look for it.</li>${/* difficulty 3: nondeterministic results make bugs hard to reproduce */''}
                </ol>${/* ends the numbered list */''}
              </div>${/* ends the difficulties block */''}
            </div>${/* ends the left column */''}
            <div class="card white stack s1-demo"></div>${/* right column: an empty card that render() fills with the ping/PONG demo */''}
          </div>`,  // ends the two-column layout and the html text
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 1; builds the demo inside el using the guide's helpers in ctx
          const { h, s } = ctx;  // h makes HTML elements, s makes SVG drawing elements
          const host = el.querySelector('.s1-demo');  // host: the empty demo card from the html above
          const WORDS = ['ping', 'PONG'];  // WORDS: what the two programs print, P1 "ping" and P2 "PONG" (different case so the letters are easy to tell apart)
          let mode = 1, run = 1;  // mode = 1 or 2 processors; run counts the runs since the mode was chosen
          const seen = [];  // seen: the output of every run so far, to count how many different outputs appeared
          // Build one random schedule. p: 1 = P1, 2 = P2, 0 = other work (interrupt handler, other processes)
          const cell = (p, ch) => ({ p, ch });  // cell(p, ch): one time unit on a processor: which process ran (0 = other work) and the letter it printed
          const FIRST = {   // run 1 is hand-picked so the very first picture already shows mixing
            1: [[cell(1, 'p'), cell(1, 'i'), cell(0), cell(2, 'P'), cell(2, 'O'), cell(2, 'N'), cell(1, 'n'), cell(0), cell(2, 'G'), cell(1, 'g')]],  // hand-picked first run on one processor: P1 and P2 take turns with two grey gaps
            2: [[cell(1, 'p'), cell(1, 'i'), cell(0), cell(1, 'n'), cell(1, 'g')], [cell(0), cell(2, 'P'), cell(2, 'O'), cell(0), cell(2, 'N'), cell(2, 'G')]],  // hand-picked first run on two processors: P1's lane and P2's lane side by side, each with gaps
          };  // closes FIRST
          function schedule(rng) {  // schedule(rng): makes one timeline for the current mode; rng gives random numbers that repeat for the same seed
            if (run === 1) {  // the first run uses the hand-picked timeline
              const lanes = FIRST[mode];  // lanes: one row of time units per processor
              const out = [];  // out: the letters in the order they reach the screen
              for (let t = 0; t < 10; t++) lanes.forEach((L) => { const c = L[t]; if (c && c.p) out.push(c); });  // reads the lanes column by column (time unit by time unit), collecting every printed letter
              return { lanes, out };  // returns the timeline and the screen order
            }  // ends the first-run case
            if (mode === 1) {  // one processor: builds a single lane where the two programs take turns at random
              const rem = WORDS.map((w) => w.split(''));  // rem: the letters each program still has to print
              const lane = [];  // lane: the time units built so far
              let guard = 0;  // guard caps the loop at 60 turns so it can never run forever
              while ((rem[0].length || rem[1].length) && guard++ < 60) {  // keeps going until both words are fully printed
                if (rng() < 0.2 && lane.length && lane[lane.length - 1].p !== 0) { lane.push({ p: 0 }); continue; }  // 20% of the time, after a real slice, the OS spends a time unit on other work (never two in a row)
                const opts = [0, 1].filter((i) => rem[i].length);  // opts: which programs still have letters left
                const pick = opts[Math.floor(rng() * opts.length)];  // picks one of them at random to run next
                let len = 1 + Math.floor(rng() * 3);  // it runs for a slice of 1 to 3 time units
                while (len-- > 0 && rem[pick].length) lane.push({ p: pick + 1, ch: rem[pick].shift() });  // adds that many of its letters to the lane, one per time unit
              }  // ends the loop
              return { lanes: [lane], out: lane.filter((c) => c.p).map((c) => ({ p: c.p, ch: c.ch })) };  // returns the single lane and the letters in lane order (on one CPU the screen order is the lane order)
            }  // ends the one-processor case
            const lanes = [0, 1].map((i) => {  // two processors: builds one lane per program, each on its own CPU
              const L = [], r = WORDS[i].split('');  // L is the lane being built; r is that program's remaining letters
              while (r.length) { if (rng() < 0.3 && L.length < 7) L.push({ p: 0 }); else L.push({ p: i + 1, ch: r.shift() }); }  // each unit is other work (30% chance, only while the lane is under 7 units long) or the program's next letter
              return L;  // returns the finished lane
            });  // closes the lane builder
            const out = [];  // out: the letters in screen order
            const T = Math.max(lanes[0].length, lanes[1].length);  // T: the length of the longer lane
            for (let t = 0; t < T; t++) {  // goes through the time units in order
              const now = lanes.map((L) => L[t]).filter((c) => c && c.p);  // now: the letters printed by either CPU in this time unit
              if (now.length === 2 && rng() < 0.5) now.reverse();   // same instant: whichever reaches the screen first
              now.forEach((c) => out.push({ p: c.p, ch: c.ch, same: now.length === 2 }));  // adds this unit's letters to the screen order; same marks letters that both CPUs printed in the same instant
            }  // ends the time-unit loop
            return { lanes, out };  // returns the two lanes and the screen order
          }  // ends schedule()
          const svg = s('svg', { viewBox: '0 0 640 150', width: '100%', role: 'img', 'aria-label': 'Timeline of which process runs on each processor' });  // svg: the step 1 timeline drawing, 640 by 150 units, showing what each processor ran in each time unit
          function draw(res) {  // draw(res): draws the lanes of one schedule as rows of boxes; runs after every "Run again"
            const T = Math.max(...res.lanes.map((l) => l.length));  // T: the number of time units in the longest lane
            const X = 78, cw = Math.min(54, Math.floor(540 / Math.max(T, 1)));  // X = where the boxes start (after the CPU label); cw = box width, shrunk if needed so every box fits
            const ys = res.lanes.length === 1 ? [40] : [12, 66];  // row positions: one centred lane for one processor, two stacked lanes for two
            const kids = [];  // kids collects the shapes for this redraw
            res.lanes.forEach((L, i) => {  // draws each processor's lane
              const y = ys[i];  // y is the top of this lane
              kids.push(s('text', { x: 6, y: y + 25, 'font-size': 14, 'font-weight': 800 }, res.lanes.length === 1 ? 'CPU' : 'CPU ' + (i + 1)));  // the lane's label on the left: "CPU", or "CPU 1" and "CPU 2"
              L.forEach((c, t) => {  // draws one box per time unit
                const cls = c.p === 1 ? 's-proc' : c.p === 2 ? 's-accent' : 's-panel';  // box style: P1's colour, P2's colour, or a plain panel for other work
                kids.push(s('rect', { x: X + t * cw + 1.5, y, width: cw - 3, height: 40, rx: 7, class: cls, 'stroke-width': 1.5, 'stroke-dasharray': c.p ? null : '4 3' }));  // the box itself; boxes for other work have a dashed grey outline
                if (c.p) kids.push(s('text', { x: X + t * cw + cw / 2, y: y + 27, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, class: 's-monot', style: `fill:var(${c.p === 1 ? '--proc' : '--accent'})` }, c.ch));  // the printed letter inside the box, in the colour of the process that printed it
              });  // ends the loop over time units
            });  // ends the loop over lanes
            kids.push(s('line', { x1: X, y1: 124, x2: X + T * cw + 6, y2: 124, class: 's-line', 'marker-end': 'url(#arr)' }));  // the time arrow under the lanes, as long as the longest lane
            kids.push(s('text', { x: X, y: 144, 'font-size': 13, class: 's-sub' }, 'time →  one box = one time unit'));  // caption under the arrow: time runs to the right, one box per time unit
            svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes in one go
          }  // ends draw()
          const screen = h('div', { class: 's1-screen', 'aria-live': 'polite' });  // screen: the strip that shows the output letters; aria-live makes screen readers announce each new output
          const note = h('p', { class: 'small m0' });  // note: the paragraph under the screen that explains the current mode
          const stat = h('div', { class: 'row s1-hist' });  // stat: a row of chips with the run number, the number of different outputs, and the last three outputs
          function go() {  // go(): makes a new run: builds a schedule, draws it and updates the screen and the history chips
            const rng = ctx.util.seeded(run * 7919 + mode * 131 + 17);  // a seeded random generator: the same run number and mode always give the same timeline, so results are repeatable
            const res = schedule(rng);  // builds this run's schedule
            draw(res);  // draws its timeline
            const txt = res.out.map((c) => c.ch).join('');  // txt: the output as plain text, such as "piPONngG"
            screen.innerHTML = '<span class="xs muted b">SCREEN</span>' + res.out.map((c) => CH(c.ch, c.p)).join('');  // fills the screen strip: a "SCREEN" label, then each letter in the colour of the process that printed it
            seen.push(txt);  // adds this output to the history
            const distinct = new Set(seen).size;  // distinct: how many different outputs have appeared so far
            note.innerHTML = mode === 1  // the explanation depends on the mode
              ? `<b>One processor:</b> only one process runs at any instant, so their letters <b>interleave</b>. The grey boxes are time the OS gave to interrupts and other work. Neither program chose where its slices fell.`  // one processor: only one process runs at a time, so the letters interleave; grey boxes are other work
              : `<b>Two processors:</b> P1 and P2 now run <b>at the same time</b>, each on its own CPU, so letters can even arrive in the same instant. Interruptions (grey) still shift them, so the mix still changes.`;  // two processors: both run at once and letters can arrive together; interruptions still shift them
            stat.innerHTML = `<span class="chip accent">run ${seen.length}</span><span class="chip ${distinct > 1 ? 'warn' : ''}">${distinct} different output${distinct > 1 ? 's' : ''} so far</span>` +  // history chips: the run number, then how many different outputs so far (orange once there are two or more)
              seen.slice(-3).reverse().map((o) => `<span class="chip mono">${esc(o)}</span>`).join('');  // then the last three outputs, newest first, in monospace
            ctx.refit();  // asks the guide to recheck that the step still fits on screen after the content changed size
          }  // ends go()
          const seg = ctx.ui.seg([{ value: 1, label: 'One processor' }, { value: 2, label: 'Two processors' }], 1, (v) => { mode = v; run = 1; seen.length = 0; go(); });  // seg: the one/two processor switch; changing it starts the count again from run 1
          const again = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { run++; go(); } }, 'Run again');  // again: the "Run again" button; it moves to the next run number and makes a new schedule
          host.append(  // fills the demo card
            h('div', { class: 'row' }, h('h4', { class: 'm0' }, 'Try it'), seg, h('span', { class: 'grow' }), again),  // top row: the "Try it" heading, the processor switch, a spacer, and the Run again button
            h('p', { class: 'small m0', html: `Both programs are fixed: ${PN(1)} prints <b class="mono pc1">ping</b> and ${PN(2)} prints <b class="mono pc2">PONG</b>, one letter per time unit, to the same screen.` }),  // explains the two fixed programs: P1 prints ping, P2 prints PONG, one letter per time unit
            svg, screen, note, stat,  // the timeline, the screen strip, the explanation and the history chips
            h('div', { class: 'callout analogy small m0', 'data-label': 'Analogy', html: 'Two cooks share one cutting board. Neither controls when the other’s phone rings, so their chopping mixes in a different order every evening. Same recipes, different timing, different result.' }),  // analogy callout: two cooks sharing a cutting board, interrupted at unpredictable times
          );  // ends the card contents
          go();  // makes the first run as soon as the step opens
        },  // ends render() for step 1
      },  // ends step 1

      /* ---------------- 2. Echo lab: you are the scheduler ---------------- */
      {  // step 2 begins
        title: 'Lab: the echo procedure loses a character',  // the step's heading
        kind: 'lab',  // kind 'lab': a hands-on step (shown with the "Hands-on Lab" label)
        core: true,  // core: keeps this step in the guide's shorter "core" route through the chapter
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 2; builds the whole echo lab inside el
          const { h } = ctx;  // h is the guide's helper for making HTML elements
          const code = ctx.ui.code(`${/* code: a code box (ctx.ui.code shows code with coloured keywords) holding the echo procedure */''}
char chin, chout;     // in shared memory: one copy for all${/* shown code, line 1: chin and chout declared once, in memory every caller shares */''}
void echo() {         // any process may call this${/* shown code, line 2: the start of echo, which any process may call */''}
  chin = getchar();   // 1. read a key into chin${/* shown code, line 3: statement 1 reads a key into chin */''}
  chout = chin;       // 2. copy chin into chout${/* shown code, line 4: statement 2 copies chin into chout */''}
  putchar(chout);     // 3. show chout on the screen${/* shown code, line 5: statement 3 prints chout on the screen */''}
}                     // return to the caller`, { lang: 'c', fontSize: 14 });  // shown code, line 6: the end of echo; also closes the code text and sets C-style colouring at 14px
          // number only the three statements of echo, so "line 1, 2, 3" in the narration matches the gutter
          [['', 1], ['', 2], ['1', 3], ['2', 4], ['3', 5], ['', 6]].forEach(([n, i]) => { code.line(i).dataset.n = n; });  // sets the line-number gutter so only the three statements show 1, 2, 3 and the other lines show nothing
          const LINES = [null, 'chin = getchar();', 'chout = chin;', 'putchar(chout);'];  // LINES: the text of each echo statement by number, used in the log and the process cards
          const mach = echoMachine(ctx.s);  // mach: the machine picture (keyboard, chin, chout, screen) built by echoMachine above
          const log = h('div', { class: 'log grow e-log' });  // log: the scrolling list of every step the student has run, newest at the bottom
          const narr = h('div', { class: 'callout e-narr m0', 'data-label': 'What happened' });  // narr: the callout under the cards that explains each step
          let mode = 1, protect = false, st, token = 0, busy = false;  // mode = 1 or 2 processors; protect = the Protect echo switch; st = lab state; token and busy guard the replay
          const cards = {}, btns = {};  // cards and btns: each process's card and Step button, keyed by 1 and 2
          function fresh() { st = { pc: [0, 1, 1], chin: null, chout: null, screen: [], running: 0, last: null, blocked: 0, n: 0, logged: false }; log.innerHTML = '<div class="muted">Your schedule appears here, newest at the bottom.</div>'; }  // fresh(): clean start: both processes before line 1, empty chin and chout, blank screen; the log shows a hint
          const inside = (p) => st.pc[p] === 2 || st.pc[p] === 3;  // inside(p): true when p is between lines of echo (about to run line 2 or 3), so it is using chin or chout
          function addLog(html) { if (!st.logged) { log.innerHTML = ''; st.logged = true; } log.insertAdjacentHTML('beforeend', `<div>${html}</div>`); log.scrollTop = log.scrollHeight; }  // addLog(html): adds one line to the log (clearing the hint the first time) and scrolls it to the bottom
          // challenges tick themselves when a finished run matches
          const GOALS = [  // GOALS: the four challenges shown as chips; each is [id, text]
            ['lx', `Lose ${CH('x', 1)}: screen shows ${CH('y', 2)}${CH('y', 2)}`],  // challenge: lose P1's x, so the screen shows y twice
            ['ly', `Lose ${CH('y', 2)}: screen shows ${CH('x', 1)}${CH('x', 1)}`],  // challenge: lose P2's y, so the screen shows x twice
            ['mp', 'Lose a character on two processors'],  // challenge: lose a character even with two processors
            ['pr', 'Finish a run with Protect echo on'],  // challenge: finish a run with protection on
          ];  // closes GOALS
          const goalEls = GOALS.map(([id, txt]) => h('span', { class: 'chip e-goal', 'data-g': id, html: txt }));  // goalEls: one chip per challenge; data-g stores its id so it can be found and ticked later
          const tick = (id) => { const g = goalEls.find((x) => x.dataset.g === id); if (g && !g.classList.contains('ok')) { g.classList.add('ok', 'flash'); } };  // tick(id): marks that challenge as done and makes it flash once; a finished challenge stays ticked
          function step(p) {  // step(p): runs process p's next line of echo when its Step button is clicked (or during the replay)
            const o = 3 - p;  // o is the other process
            if (st.pc[p] > 3) return;  // a process that has finished echo does nothing
            if (protect && st.pc[p] === 1 && inside(o)) {  // with protection on, p cannot enter echo (start line 1) while the other process is inside
              st.blocked = p;  // p is blocked at echo's entrance
              if (mode === 1 && st.running === o) addLog(`<span class="muted">— interrupt: OS dispatches P${p} —</span>`);  // on one CPU, if the other process was running, the log shows the OS switching to p first
              if (mode === 1) st.running = o;  // on one CPU, the CPU goes back to the other process
              addLog(`<b class="pc${p}">P${p}</b> tries to enter echo → <b style="color:var(--bad)">blocked</b> (P${o} is inside)`);  // log line: p tried to enter echo and was blocked
              if (mode === 1) addLog(`<span class="muted">— P${p} is blocked, so the OS dispatches P${o} again —</span>`);  // on one CPU, a log line explains why the OS switches back to the other process
              narr.className = 'callout e-narr m0 warn'; narr.dataset.label = 'Blocked';  // the callout turns orange with the heading "Blocked"
              narr.innerHTML = `${PN(p)} called echo, but ${PN(o)} is still inside it. With protection on, ${PN(p)} is <b>blocked</b> at the entrance and cannot touch chin or chout until ${PN(o)} returns.` + (mode === 1 ? ` The OS gives the CPU back to ${PN(o)}.` : '');  // explains that p waits at the entrance until the other process returns from echo
              return paint();  // redraws and stops here: p did not run
            }  // ends the blocking check
            if (mode === 1 && st.running && st.running !== p) addLog(`<span class="muted">— interrupt: OS saves P${st.running}’s state, dispatches P${p} —</span>`);  // on one CPU, switching from the other process to p is logged as an interrupt and a dispatch (a context switch)
            if (mode === 1) st.running = p;  // on one CPU, p is now the running process
            if (st.blocked === p) st.blocked = 0;  // if p had been blocked, it is no longer: it now gets to enter echo
            const line = st.pc[p], before = { chin: st.chin, chout: st.chout };  // line = which echo statement p runs now; before = chin and chout before it runs, to detect an overwrite
            let what;  // what: the plain-words description of this statement's effect
            if (line === 1) { st.chin = KEY[p]; what = `getchar() returns ${CH(KEY[p], p)}, stored in shared <code>chin</code>`; }  // statement 1: p's typed key goes into the shared chin
            if (line === 2) { st.chout = st.chin; what = `copies chin into chout, so chout = ${CH(st.chout, OWN(st.chout))}`; }  // statement 2: whatever chin holds now is copied into the shared chout
            if (line === 3) { st.screen.push(st.chout); what = `putchar shows ${CH(st.chout, OWN(st.chout))} on the screen`; }  // statement 3: the value in chout is added to the screen
            st.pc[p]++; st.n++; st.last = { line, p };  // p moves to its next line, the step counter goes up, and the last step is remembered for the picture's highlights
            if (protect && st.pc[p] === 4 && st.blocked === o) st.blocked = 0;  // with protection on, when p leaves echo, a process blocked at the entrance is released
            addLog(`${st.n}. <b class="pc${p}">P${p}</b>${mode === 2 ? ' (CPU ' + p + ')' : ''} · <code>${LINES[line]}</code> → ${line === 1 ? 'chin = ' + st.chin : line === 2 ? 'chout = ' + st.chout : 'shows ' + st.screen[st.screen.length - 1]}`);  // log line: step number, process (and CPU in two-processor mode), the statement, and its result
            let msg = `${PN(p)} ran line ${line}: ${what}.`;  // the callout message starts with which line p ran and what it did
            if (line === 1 && st.pc[o] === 2 && before.chin !== st.chin) msg += ` <b style="color:var(--bad)">That overwrote ${CH(before.chin, OWN(before.chin))}, which ${PN(o)} had read and not yet copied.</b>`;  // warning when p's getchar overwrote a key the other process had read but not yet copied
            if (line === 2 && st.pc[o] === 3 && before.chout !== st.chout) msg += ` <b style="color:var(--bad)">That overwrote the chout that ${PN(o)} is about to display.</b>`;  // warning when p's copy overwrote a chout the other process was about to display
            if (line === 3 && st.chout !== KEY[p]) msg += ` <b style="color:var(--bad)">But ${PN(p)}’s user typed ${CH(KEY[p], p)}!</b>`;  // warning when p displays a character its own user did not type
            narr.className = 'callout e-narr m0'; narr.dataset.label = 'What happened';  // the callout returns to its neutral look with the heading "What happened"
            narr.innerHTML = msg;  // puts the message into the callout
            if (st.pc[1] === 4 && st.pc[2] === 4) verdict();  // once both processes have finished, judge the run
            paint();  // redraws the picture, code highlights and cards
          }  // ends step()
          function verdict() {  // verdict(): judges a finished run, ticks any challenges it meets and explains the result
            const out = st.screen.join('');  // out: the screen contents as text, such as "yy"
            const ok = out === 'xy' || out === 'yx';  // the output is correct if each key appears once, in either order
            if (out === 'yy') tick('lx');  // screen shows yy: the "lose x" challenge is met
            if (out === 'xx') tick('ly');  // screen shows xx: the "lose y" challenge is met
            if (!ok && mode === 2) tick('mp');  // a wrong output on two processors meets the "two processors" challenge
            if (protect) tick('pr');  // any finished run with protection on meets the "protect" challenge
            narr.className = 'callout e-narr m0 ' + (ok ? 'tip' : 'bad');  // the callout turns green for a correct output, red for a race condition
            narr.dataset.label = ok ? 'Correct output' : 'Race condition';  // the callout heading: "Correct output" or "Race condition"
            if (ok) narr.innerHTML = `Screen shows ${st.screen.map((c) => CH(c, OWN(c))).join(' ')}: each user saw their own key. ` + (protect ? 'With echo protected, one caller finished before the other could touch chin or chout, so no interleaving can go wrong.' : 'This schedule happened to be safe, but nothing guarantees the next one will be. Try interrupting a process in the middle of echo.');  // correct output: says why (protected, or just a lucky schedule this time)
            else { const lost = ['x', 'y'].filter((c) => !st.screen.includes(c)); narr.innerHTML = `Screen shows ${st.screen.map((c) => CH(c, OWN(c))).join(' ')}. <b>${lost.map((c) => CH(c, OWN(c))).join('')} was lost</b> and the other character appeared twice. Both callers used the one chin and chout in shared memory, and a second caller overwrote them while the first was still inside echo. Now switch on <b>Protect echo</b>.`; }  // wrong output: names the lost character, explains the overwrite in shared memory, and suggests Protect echo
          }  // ends verdict()
          function paint() {  // paint(): redraws the machine picture, the code highlights and both process cards from st
            mach.draw(st, mode);  // redraws the machine picture
            for (let n = 1; n <= 6; n++) code.line(n).classList.remove('m1', 'm2');  // removes the old P1/P2 markers from all six code lines
            [1, 2].forEach((p) => {  // updates the code marker and the card for each process
              // a blocked caller is shown waiting at echo's entrance (line "void echo() {"), not on a statement
              if (st.pc[p] <= 3) { const ln = code.line(st.blocked === p ? 2 : st.pc[p] + 2); ln.classList.add('m' + p); }  // marks the code line where p will run next (statement k is code line k + 2), or the entrance line if p is blocked
              const c = cards[p], pc = st.pc[p];  // c is p's card and pc its next line (4 = finished)
              const cpu = mode === 2 ? `<span class="chip cpu">on CPU ${p}</span>` : st.running === p ? '<span class="chip cpu">on the CPU</span>' : st.blocked === p ? '' : '<span class="chip">ready</span>';  // CPU chip: which CPU p is on (two CPUs), "on the CPU" or "ready" (one CPU), or nothing while blocked
              const loc = pc > 3 ? '<span class="chip ok">finished</span>' : st.blocked === p ? '<span class="chip bad">blocked at entry</span>' : inside(p) ? '<span class="chip warn">inside echo</span>' : '<span class="chip">about to call echo</span>';  // location chip: finished, blocked at entry, inside echo, or about to call echo
              c.querySelector('.e-stat').innerHTML = (pc > 3 ? '' : cpu) + loc;  // writes the chips into the card (a finished process shows no CPU chip)
              c.querySelector('.e-next').innerHTML = pc > 3 ? 'Done. Its user typed ' + CH(KEY[p], p) + '.' : `Next: line ${pc} · <code>${LINES[pc]}</code>`;  // the card's hint line: the next statement to run, or "Done" with the key its user typed
              btns[p].disabled = pc > 3 || busy;  // the Step button is off once p has finished, and during the replay
            });  // ends the loop over the two processes
          }  // ends paint()
          function reset(msg) {  // reset(msg): starts the lab again, cancelling any replay; msg is an optional opening message
            token++; busy = false; fresh();  // a new token stops an old replay; the state goes back to a clean start
            narr.className = 'callout e-narr m0'; narr.dataset.label = 'Your move';  // the callout returns to its neutral look with the heading "Your move"
            narr.innerHTML = msg || `Assume the OS, to save memory, loads echo <b>and its <span class="t" data-t="Global variable">global</span> variables</b> once, into memory shared by every program, so all callers use the <b>same</b> chin and chout. ${PN(1)}’s user typed ${CH('x', 1)} and ${PN(2)}’s user typed ${CH('y', 2)}. Press <b>Step</b> to run one line of that process. Can you make a character vanish?`;  // opening instructions: the OS loaded echo and its globals once into shared memory, so all callers share chin and chout
            paint();  // draws the fresh state
          }  // ends reset()
          async function replay() {  // replay(): plays the classic failure automatically, one step every 0.85 seconds
            reset(); const my = token; busy = true; paint();  // starts over, remembers this replay's token and locks the Step buttons
            const seq = mode === 1 ? [1, 2, 2, 2, 1, 1] : [1, 2, 1, 2, 1, 2];  // the order: one CPU = P1 reads, P2 runs all of echo, then P1 finishes; two CPUs = strict alternation
            for (let i = 0; i < 12; i++) {  // at most 12 steps, which is enough even when protection makes a process wait
              await ctx.sleep(850);  // pauses 0.85 seconds between steps
              if (!ctx.alive || my !== token) return;  // quits if the student left this step or pressed Reset during the pause
              let p = i < seq.length ? seq[i] : st.pc[1] <= 3 ? 1 : st.pc[2] <= 3 ? 2 : 0;  // follows the order; after it ends, runs whichever process is still unfinished (0 when both are done)
              if (!p) break;  // stops when both processes have finished
              if (st.pc[p] > 3 || st.blocked === p) p = 3 - p;   // finished, or already known to be blocked: run the other one
              if (st.pc[p] > 3) break;  // stops if both processes have finished
              step(p);  // runs the chosen process's next line
            }  // ends the replay loop
            busy = false; paint();  // unlocks the buttons once the replay is over
          }  // ends replay()
          [1, 2].forEach((p) => {  // builds the card and Step button for each process when the step opens
            btns[p] = h('button', { class: 'btn sm e-b' + p, type: 'button', onclick: () => step(p) }, 'Step P' + p);  // the Step button, coloured like its process; clicking it runs step(p)
            cards[p] = h('div', { class: 'card tight stack gap-s e-card e-p' + p },  // the card, with a coloured top edge for P1 or P2
              h('div', { class: 'row nw' }, h('b', { class: 'pc' + p }, 'Process P' + p), h('span', { class: 'grow' }), btns[p]),  // header row: the process name in its colour, a spacer, and the Step button
              h('div', { class: 'row gap-s e-stat' }),  // status row: the CPU and location chips
              h('div', { class: 'small e-next' }));  // hint line: what the process will run next
          });  // closes the loop
          const seg = ctx.ui.seg([{ value: 1, label: 'One processor' }, { value: 2, label: 'Two processors' }], 1, (v) => { mode = v; reset(); });  // seg: the one/two processor switch; changing it restarts the lab
          const prot = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'false', onclick: () => { protect = !protect; prot.setAttribute('aria-pressed', String(protect)); prot.textContent = protect ? 'Protect echo: ON' : 'Protect echo: OFF'; reset(protect ? `<b>Protection is on:</b> only one process may be inside echo at a time. A process that calls echo while the other is inside must wait. Try any schedule you like, or replay the classic case.` : null); } }, 'Protect echo: OFF');  // the Protect echo switch; turning it on restarts the lab with a message explaining the rule
          el.append(h('div', { class: 'stack fill e-wrap' },  // puts the whole lab on the page as one vertical stack that fills the step
            h('div', { class: 'row' }, seg, prot, h('button', { class: 'btn sm primary', type: 'button', onclick: replay }, 'Replay the classic failure'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => reset() }, 'Reset')),  // top row: processor switch, Protect echo switch, the replay button and Reset
            h('div', { class: 'split grow' },  // main area in two columns
              h('div', { class: 'stack' },  // left column
                code, h('div', { class: 'grid-2' }, cards[1], cards[2]), narr,  // the echo code, the two process cards side by side, and the explanation callout
                h('div', { class: 'row gap-s' }, h('span', { class: 'xs b muted' }, 'CHALLENGES'), ...goalEls)),  // the challenge chips, after a "CHALLENGES" label
              h('div', { class: 'stack' }, h('div', { class: 'card white tight' }, mach.svg), log))));  // right column: the machine picture on a white card, with the log underneath; closes the layout
          reset();  // shows the opening state and instructions
        },  // ends render() for step 2
      },  // ends step 2

      /* ---------------- 3. Race conditions ---------------- */
      {  // step 3 begins
        title: 'Race conditions: the loser of the race decides',  // the step's heading
        kind: 'explore',  // kind 'explore': a step for trying things out (shown with the "Explore" label)
        html: `${/* html: the step's fixed page content; render() below makes both examples interactive */''}
          <div class="split l fill">${/* two-column layout: the definition and example 1 on the left, example 2 on the right */''}
            <div class="stack">${/* left column */''}
              <p class="lead m0">A <span class="t">race condition</span> happens when several processes or threads read and write shared data, and the final result depends on the relative timing of their steps.</p>${/* opening paragraph: defines a race condition */''}
              <p class="small m0">The processes “race” to the data. The twist: the <b>loser</b> decides the result. Whoever writes last overwrites everyone before it, so its value is the one that survives.</p>${/* paragraph: the process that writes last (the loser of the race) decides the result */''}
              <div class="card stack gap-s r1-box">${/* the card for example 1 */''}
                <h4 class="m0">Example 1 · one shared variable</h4>${/* heading: example 1, one shared variable */''}
                <p class="small m0">${PN(1)} runs <code>a = 1;</code> and ${PN(2)} runs <code>a = 2;</code>. You pick the order.</p>${/* P1 writes 1 and P2 writes 2 into the shared a; the student chooses the order */''}
                <div class="row r1-btns"></div>${/* empty row that render() fills with the P1, P2 and Reset buttons */''}
                <div class="row nw"><div class="big r1-a">a = ?</div><div class="small r1-msg grow"></div></div>${/* the "a = ?" readout beside a message area, both filled in by render() */''}
              </div>${/* ends example 1's card */''}
              <div class="callout warn small m0" data-label="Common mistake">Thinking the first writer wins. The first write is simply overwritten; the last one survives.</div>${/* "Common mistake" callout: the first writer does not win; the last write survives */''}
              <div class="callout tip small m0" data-label="Key idea">A correct program must give the right answer for <b>every</b> interleaving.</div>${/* "Key idea" callout: a correct program must be right for every interleaving */''}
            </div>${/* ends the left column */''}
            <div class="card white stack r2"></div>${/* right column: an empty card that render() fills with example 2 */''}
          </div>`,  // ends the two-column layout and the html text
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 3; wires up both race examples inside el
          const { h } = ctx;  // h is the guide's helper for making HTML elements
          /* ----- example 1: a = 1 / a = 2 ----- */
          const aBox = el.querySelector('.r1-a'), aMsg = el.querySelector('.r1-msg');  // aBox: the "a = ?" readout; aMsg: the message beside it (both from the html above)
          let aHist = [];  // aHist: the order in which P1 and P2 have written so far, such as [2, 1]
          function paintA() {  // paintA(): updates example 1 after each click
            const v = aHist.length ? aHist[aHist.length - 1] : null;  // v: the value in a right now, which is whatever was written last (null before any write)
            aBox.innerHTML = 'a = ' + (v == null ? '?' : `<span class="pc${v}">${v}</span>`);  // the readout shows a's current value in the colour of the process that wrote it, or "?"
            const trail = aHist.map((p) => `${PN(p)} writes ${p}`).join(' → ');  // trail: the writes so far as text, such as "P2 writes 2 → P1 writes 1"
            aMsg.innerHTML = aHist.length === 0 ? 'Nobody has written yet.' : aHist.length === 1 ? `${trail}. Now let the other one write.`  // message: nobody has written yet, or one write so far and a prompt to let the other write
              : `${trail}. ${PN(v)} wrote last: it lost the race, yet its value is the one that survives.`;  // after both writes: the last writer lost the race, yet its value is the one that stays
            a1.disabled = aHist.includes(1); a2.disabled = aHist.includes(2);  // each process can write only once, so its button turns off after its write
          }  // ends paintA()
          const a1 = h('button', { class: 'btn sm e-b1', type: 'button', onclick: () => { aHist.push(1); paintA(); } }, 'P1: a = 1');  // P1's button: writes 1 into a
          const a2 = h('button', { class: 'btn sm e-b2', type: 'button', onclick: () => { aHist.push(2); paintA(); } }, 'P2: a = 2');  // P2's button: writes 2 into a
          el.querySelector('.r1-btns').append(a1, a2, h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { aHist = []; paintA(); } }, 'Reset'));  // puts the two buttons and a Reset button (which clears the history) into the example 1 row
          paintA();  // shows example 1's starting state

          /* ----- example 2: b = b + c and c = b + c ----- */
          const host = el.querySelector('.r2');  // host: the empty card for example 2
          let micro = false, st;  // micro = whether each statement is split into load and store steps; st = example 2 state
          const found = new Set();  // found: the indexes of the outcomes the student has produced so far
          const OUT = [  // OUT: the three possible outcomes, each [description, final b, final c, short tag]
            ['P3 runs completely, then P4', 3, 5, 'first'],  // outcome: P3 first, then P4, gives b = 3, c = 5
            ['P4 runs completely, then P3', 4, 3, 'second'],  // outcome: P4 first, then P3, gives b = 4, c = 3
            ['Both load before either stores', 3, 3, 'overlap'],  // outcome: both load before either stores, gives b = 3, c = 3
          ];  // closes OUT
          const PROG = {  // PROG: the two processes of example 2, keyed 3 and 4 so their names match the text
            3: { name: 'P3', stmt: 'b = b + c;', tgt: 'b', cls: 1 },  // P3 runs b = b + c; it writes b, and is drawn in the first colour
            4: { name: 'P4', stmt: 'c = b + c;', tgt: 'c', cls: 2 },  // P4 runs c = b + c; it writes c, and is drawn in the second colour
          };  // closes PROG
          const panels = {}, stepBtn = {};  // panels and stepBtn: each process's panel and Step button
          const mem = h('div', { class: 'stack gap-s r2-mem' });  // mem: the middle column showing the shared b and c
          const tbody = h('tbody');  // tbody: the body of the outcomes table
          const narr = h('p', { class: 'small m0 r2-narr' });  // narr: the explanation line next to the Run again button
          const trail = h('div', { class: 'row gap-s' });  // trail: the "YOUR ORDER" row of steps taken
          function fresh() { st = { b: 1, c: 2, pc: { 3: 0, 4: 0 }, reg: { 3: null, 4: null }, order: [] }; }  // fresh(): clean start: b = 1, c = 2, neither process has run, registers empty, no steps taken
          const nSteps = () => (micro ? 2 : 1);  // nSteps(): how many steps each process has, 1 as a whole statement or 2 as load then store
          function run(p) {  // run(p): runs process p's next step when its Step button is clicked
            const P = PROG[p], o = p === 3 ? 4 : 3;  // P is p's description, and o is the other process
            if (st.pc[p] >= nSteps()) return;  // a process that has run all its steps does nothing
            if (!micro) {  // whole-statement mode: read, add and write in one indivisible step
              const b0 = st.b, c0 = st.c, sum = b0 + c0; st[P.tgt] = sum; st.pc[p] = 1;  // reads b and c, stores their sum in p's target variable, and marks p finished
              narr.innerHTML = `${P.name} runs <code>${P.stmt}</code> in one go: it reads b = ${b0} and c = ${c0}, so ${P.tgt} becomes ${sum}.`;  // explains what p read and what its variable became
            } else if (st.pc[p] === 0) {  // load/store mode, first step: the load
              st.reg[p] = { b: st.b, c: st.c }; st.pc[p] = 1;  // copies b and c into p's own registers (a register is a small storage slot inside the processor)
              narr.innerHTML = `${P.name} <b>loads</b> b = ${st.b} and c = ${st.c} into its own registers. It has not changed memory yet.`;  // explains that p loaded the values but has not changed memory yet
            } else {  // load/store mode, second step: add and store
              const sum = st.reg[p].b + st.reg[p].c; st[P.tgt] = sum; st.pc[p] = 2;  // adds p's saved copies (which may now be stale) and writes the sum to p's target variable
              narr.innerHTML = `${P.name} adds its copies (${st.reg[p].b} + ${st.reg[p].c}) and <b>stores</b> ${P.tgt} = ${sum}.` + (st.pc[o] === 1 ? ` ${PROG[o].name} still holds the old values in its registers.` : '');  // explains the store, noting when the other process is still holding old values in its registers
            }  // ends the choice of step
            st.order.push(p);  // records p in the order of steps
            if (st.pc[3] === nSteps() && st.pc[4] === nSteps()) finish();  // once both processes have run all their steps, judge the result
            paint();  // redraws memory, panels, order trail and table
          }  // ends run()
          function finish() {  // finish(): records which outcome this run produced and tells the student what is left to find
            const k = OUT.findIndex(([, b, c]) => b === st.b && c === st.c);  // k: which of the three outcomes matches the final b and c
            const isNew = !found.has(k);  // isNew: whether this outcome has not been produced before
            found.add(k);  // records it
            narr.innerHTML = `Finished with <b>b = ${st.b}, c = ${st.c}</b>. ${isNew ? 'New outcome found!' : 'You have seen this outcome before.'} ` +  // message: the final values, and whether this outcome is new
              (found.size < (micro ? 3 : 2) ? 'Press <b>Run again</b> and try a different order.' : micro ? 'All three outcomes found: same code, three different answers.' : 'Both outcomes found. Now switch to <b>Load / store steps</b>: there is a third.');  // prompts for another order, or says all outcomes were found (and hints at the third one in load/store mode)
          }  // ends finish()
          function paint() {  // paint(): redraws example 2 from st
            mem.innerHTML = ['b', 'c'].map((v) => `<div class="r2-cell"><span class="xs muted b">${v}</span><span class="r2-val">${st[v]}</span></div>`).join('');  // the memory column: one cell for b and one for c with their current values
            [3, 4].forEach((p) => {  // updates each process panel
              const P = PROG[p], pc = st.pc[p];  // P is the process's description and pc how many of its steps it has run
              const lines = micro ? ['load b and c', `add; store in ${P.tgt}`] : [P.stmt];  // its step list: two steps (load, then add and store) in load/store mode, or the single statement
              panels[p].querySelector('.r2-code').innerHTML = lines.map((l, i) => `<div class="r2-ln ${i === pc ? 'cur' : i < pc ? 'done' : ''}">${i < pc ? '✓' : i === pc ? '▸' : '·'} <span class="mono">${esc(l)}</span></div>`).join('');  // each step with a tick when done, an arrow when next, a dot when later; the next one is highlighted
              panels[p].querySelector('.r2-reg').innerHTML = micro ? (st.reg[p] ? `registers: b = ${st.reg[p].b}, c = ${st.reg[p].c}` : 'registers: empty') : '&nbsp;';  // in load/store mode, shows what the process has in its registers; otherwise keeps the space blank
              stepBtn[p].disabled = pc >= nSteps();  // the Step button turns off once the process has run all its steps
            });  // ends the loop over the two panels
            trail.innerHTML = '<span class="xs b muted">YOUR ORDER</span>' + (st.order.length ? st.order.map((p, i) => {  // the order trail: "YOUR ORDER", then each step as a coloured chip joined by arrows
              const k = st.order.slice(0, i + 1).filter((x) => x === p).length;  // k counts how many times this process has appeared so far, so its first step is the load and the second the store
              return (i ? '<span class="muted">→</span>' : '') + `<span class="chip ${p === 3 ? 'proc' : 'accent'}">${PROG[p].name}${micro ? (k === 1 ? ' load' : ' store') : ''}</span>`;  // the chip reads "P3" or "P4", plus "load" or "store" in load/store mode
            }).join('') : '<span class="small muted">nothing run yet</span>');  // or a grey "nothing run yet"
            tbody.innerHTML = OUT.map(([lbl, b, c], i) => {  // rebuilds the outcomes table, one row per possible outcome
              const possible = micro || i < 2;  // possible: the third outcome can only happen in load/store mode
              const on = found.has(i);  // on: whether the student has produced this outcome
              return `<tr class="${on ? 'on' : ''}"><td>${lbl}</td><td class="mono b">${on ? b : '?'}</td><td class="mono b">${on ? c : '?'}</td><td class="xs">${!possible ? '<span class="muted">impossible with whole statements</span>' : on ? '<span class="chip ok">found</span>' : '<span class="chip">not yet</span>'}</td></tr>`;  // the row: description, b and c (or "?" until found), and a status: found, not yet, or impossible with whole statements
            }).join('');  // joins the rows into the table body
          }  // ends paint()
          [3, 4].forEach((p) => {  // builds the panel and Step button for P3 and P4 when the step opens
            stepBtn[p] = h('button', { class: 'btn sm e-b' + PROG[p].cls, type: 'button', onclick: () => run(p) }, 'Step ' + PROG[p].name);  // the Step button, coloured like its process; clicking it runs run(p)
            panels[p] = h('div', { class: 'card tight stack gap-s e-p' + PROG[p].cls },  // the panel, with a coloured top edge
              h('div', { class: 'row nw' }, h('b', { class: 'pc' + PROG[p].cls }, PROG[p].name + ': ' + PROG[p].stmt), h('span', { class: 'grow' }), stepBtn[p]),  // header row: the process name and its statement, a spacer, and the Step button
              h('div', { class: 'r2-code' }), h('div', { class: 'xs muted r2-reg' }));  // an area for the step list and a small line for the registers
          });  // closes the loop
          const seg = ctx.ui.seg([{ value: false, label: 'Whole statements' }, { value: true, label: 'Load / store steps' }], false, (v) => { micro = v; found.clear(); fresh(); narr.innerHTML = v ? 'Now each statement is two steps, as on a real processor: copy b and c into the process’s own <span class="t" data-t="Register">registers</span>, then add and store the sum. Try letting both processes load before either stores.' : 'Each statement runs as one indivisible step.'; paint(); });  // seg: switches between whole statements and load/store steps; clears the found outcomes and explains the new mode
          host.append(  // fills the example 2 card
            h('div', { class: 'row' }, h('h4', { class: 'm0' }, 'Example 2 · two shared variables'), h('span', { class: 'grow' }), seg),  // header row: the example title and the mode switch
            h('p', { class: 'small m0', html: 'Shared <code>b = 1</code> and <code>c = 2</code>. <b class="pc1">P3</b> runs <code>b = b + c;</code> and <b class="pc2">P4</b> runs <code>c = b + c;</code>. Choose the order.' }),  // the setup: shared b = 1 and c = 2, and what P3 and P4 each run
            h('div', { class: 'r2-grid' }, panels[3], mem, panels[4]),  // P3's panel, the memory column and P4's panel, side by side
            trail,  // the order trail
            h('table', { class: 'tbl compact r2-tbl' }, h('thead', { html: '<tr><th>Order</th><th class="mono">b</th><th class="mono">c</th><th></th></tr>' }), tbody),  // the outcomes table with columns Order, b, c and a status column
            h('div', { class: 'row nw' }, narr, h('button', { class: 'btn sm primary', type: 'button', onclick: () => { fresh(); narr.innerHTML = 'Values reset to b = 1, c = 2. Pick a different order this time.'; paint(); } }, 'Run again')));  // bottom row: the explanation beside a "Run again" button that puts b and c back to 1 and 2
          fresh();  // sets up the starting values for example 2
          narr.innerHTML = 'Each statement runs as one indivisible step. Step the two processes in either order and record what you get.';  // the first instruction shown in example 2
          paint();  // shows example 2's starting state
        },  // ends render() for step 3
      },  // ends step 3

      /* ---------------- 4. The OS's four concerns ---------------- */
      {  // step 4 begins
        title: 'Four jobs concurrency gives the operating system',  // the step's heading
        kind: 'explore',  // kind 'explore': a step for trying things out
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 4; builds the four clickable concerns and their detail card
          const { h, s } = ctx;  // h makes HTML elements, s makes SVG drawing elements
          const C = [  // C: the four concerns, each with a short title t and a one-line description d
            { t: 'Keep track of every process', d: 'Know which processes exist, their state, and what each one holds.' },  // concern 1: keep track of every process
            { t: 'Allocate and deallocate resources', d: 'Hand out processor time, memory, files and I/O devices, and take them back.' },  // concern 2: allocate and take back resources
            { t: 'Protect each process from the others', d: 'Stop unintended interference with a process’s data and physical resources.' },  // concern 3: protect processes from each other
            { t: 'Make results independent of speed', d: 'A process must work, and produce the same output, however fast it runs relative to the others.' },  // concern 4: results must not depend on relative speed
          ];  // closes C
          let cur = 3, v = 1.5, protect = false;  // cur = the concern shown (starts on concern 4, the speed demo); v = P2's speed; protect = the Protect echo switch
          const rows = C.map((c, i) => h('button', { class: 'c4-row', type: 'button', onclick: () => { cur = i; paint(); } },  // rows: one clickable button per concern; clicking shows that concern's detail
            h('span', { class: 'c4-n' }, String(i + 1)), h('span', { class: 'c4-t' }, h('b', {}, c.t), h('span', { class: 'small muted c4-d' }, c.d))));  // each row holds a number badge, the bold title and the grey description
          const detail = h('div', { class: 'card white stack c4-detail' });  // detail: the card on the right that shows the selected concern
          /* concern 4: live speed demo */
          const tl = s('svg', { viewBox: '0 0 560 116', width: '100%', role: 'img', 'aria-label': 'When each process runs each line of echo' });  // tl: the speed demo timeline, showing when each process runs each line of echo
          const band = s('svg', { viewBox: '0 0 560 30', width: '100%', role: 'img', 'aria-label': 'Which speeds give a correct result' });  // band: a thin strip under the slider that colours every speed green (correct) or red (wrong)
          const res = h('div', { class: 'row c4-res' });  // res: the result line: correct or wrong, what each process showed, and the screen
          const SPEEDS = ctx.util.range(51).map((i) => 0.5 + i * 0.05);  // SPEEDS: the 51 speeds on the strip, 0.5× to 3× in steps of 0.05
          const X0 = 70, W = 470;  // X0 = left edge of the timeline and strip (room for labels); W = their width
          function drawBand() {  // drawBand(): redraws the strip of all speeds; runs whenever the slider or the Protect switch changes
            const k = [];  // k collects the shapes
            SPEEDS.forEach((sp, i) => {  // one small block for each speed
              const ok = speedRun(sp, protect).ok;  // runs the whole echo simulation at that speed to see if both processes showed their own key
              k.push(s('rect', { x: X0 + (i / SPEEDS.length) * W, y: 4, width: W / SPEEDS.length + 0.5, height: 14, style: `fill:var(${ok ? '--ok' : '--bad'});opacity:.6`, 'stroke-width': 0 }));  // the block, green if correct and red if wrong, drawn half transparent
            });  // ends the loop over speeds
            const mx = X0 + ((v - 0.5) / 2.55) * W + W / SPEEDS.length / 2;  // mx: the x position on the strip that matches the slider's current speed
            k.push(s('path', { d: `M${mx - 6} 29 L${mx} 20 L${mx + 6} 29 Z`, style: 'fill:var(--ink)' }));  // a small black triangle under the strip pointing at the current speed
            k.push(s('text', { x: 0, y: 16, 'font-size': 13, class: 's-sub' }, 'all speeds'));  // the label "all speeds" at the left of the strip
            band.replaceChildren(...k);  // replaces the old strip with the new shapes in one go
          }  // ends drawBand()
          function drawTimeline(r) {  // drawTimeline(r): draws the result r of one simulation as circles on two time lines
            const tmax = Math.max(7, Math.ceil(r.end + 0.6));  // tmax: the time shown at the right edge, at least 7 units and enough to fit the last event
            const xt = (t) => X0 + (t / tmax) * W;  // xt(t): converts a time into an x position on the drawing
            const k = [];  // k collects the shapes
            [[1, 26], [2, 74]].forEach(([p, y]) => {  // one row per process: P1 at height 26, P2 at 74
              k.push(s('text', { x: 0, y: y + 5, 'font-size': 14, 'font-weight': 800, style: `fill:var(${VAR(p)})` }, 'P' + p));  // the row's label, "P1" or "P2", in its colour
              k.push(s('line', { x1: X0, y1: y, x2: X0 + W, y2: y, class: 's-muted' }));  // a faint horizontal line for the row
              if (r.waitFrom[p] != null) {  // if this process had to wait at echo's entrance (only with protection on)
                const x1 = xt(r.waitFrom[p]), x2 = xt(r.ev.find((e) => e.p === p && e.line === 1).t);  // the wait runs from when it arrived to when it finally ran line 1
                k.push(s('rect', { x: x1, y: y - 7, width: Math.max(2, x2 - x1), height: 14, rx: 4, class: 's-warn', 'stroke-width': 1 }));  // an orange bar covering the waiting time (at least 2 units wide so it is always visible)
                k.push(s('text', { x: (x1 + x2) / 2, y: y - 12, 'text-anchor': 'middle', 'font-size': 13, style: 'fill:var(--warn)', 'font-weight': 700 }, 'waits'));  // the word "waits" above the bar
              }  // ends the waiting bar
            });  // ends the loop over rows
            r.ev.forEach((e) => {  // one circle for every echo line that ran
              const y = e.p === 1 ? 26 : 74, x = xt(e.t);  // placed on the row of the process that ran it, at the time it ran
              k.push(s('circle', { cx: x, cy: y, r: 11, class: e.p === 1 ? 's-proc' : 's-accent', 'stroke-width': 2 }));  // the circle, in the process's colour
              k.push(s('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, String(e.line)));  // the line number (1, 2 or 3) inside the circle
            });  // ends the loop over events
            k.push(s('line', { x1: X0, y1: 100, x2: X0 + W, y2: 100, class: 's-line', 'marker-end': 'url(#arr)' }));  // the time arrow along the bottom
            k.push(s('text', { x: X0, y: 115, 'font-size': 13, class: 's-sub' }, 'time →   circles = echo lines 1, 2, 3'));  // caption: time runs to the right, and the circles are echo lines 1, 2 and 3
            tl.replaceChildren(...k);  // replaces the old timeline with the new shapes in one go
          }  // ends drawTimeline()
          function paintDemo() {  // paintDemo(): recomputes and redraws the speed demo; runs when the slider moves or Protect is switched
            const r = speedRun(v, protect);  // runs the simulation at the chosen speed
            drawTimeline(r); drawBand();  // redraws the timeline and the strip
            const mark = (p) => `${PN(p)} showed ${CH(r.shown[p], OWN(r.shown[p]))} ${r.shown[p] === KEY[p] ? '<b style="color:var(--ok)">✓</b>' : '<b style="color:var(--bad)">✗</b>'}`;  // mark(p): what process p showed on screen, with a green tick if it was its own key or a red cross if not
            res.innerHTML = `<span class="chip ${r.ok ? 'ok' : 'bad'}">${r.ok ? 'correct' : 'wrong'}</span><span class="small">${mark(1)} · ${mark(2)}</span><span class="small muted">screen: <b class="mono">${r.out.join(' ')}</b></span>`;  // the result line: a correct/wrong chip, each process's mark, and the characters on the screen
            // explain the first harmful overlap, if any
            const idx = { 1: 0, 2: 0 };  // idx: how many echo lines each process has run so far while scanning the events in time order
            let why = null;  // why: the explanation of the first harmful overlap, if there is one
            for (const e of r.ev) {  // goes through the events in the order they happened
              const o = 3 - e.p;  // o is the other process
              if (!why && e.line === 1 && idx[o] === 1) why = `${PN(e.p)}’s getchar overwrote chin before ${PN(o)} had copied it.`;  // p ran line 1 while the other had read chin but not copied it: the getchar overwrote chin
              if (!why && e.line === 2 && idx[o] === 2) why = `${PN(e.p)}’s copy overwrote chout before ${PN(o)} had displayed it.`;  // p ran line 2 while the other had copied but not displayed: the copy overwrote chout
              idx[e.p]++;  // counts this line for its process
            }  // ends the scan
            whyEl.innerHTML = why ? `<b style="color:var(--bad)">What went wrong:</b> ${why}`  // explanation shown under the result: what went wrong, if something did
              : r.waitFrom[1] != null || r.waitFrom[2] != null ? `<b style="color:var(--ok)">Why it worked:</b> ${PN(r.waitFrom[1] != null ? 1 : 2)} arrived while the other was inside echo, so it waited. The two calls never overlapped.`  // or, with protection, which process waited so the calls never overlapped
                : `<b>Why it worked:</b> at this speed the two calls did not overlap. That is luck, not design: look at the red on the strip.`;  // or, without protection, that the calls happened not to overlap at this speed: luck, not design
          }  // ends paintDemo()
          const whyEl = h('p', { class: 'small m0 c4-why' });  // whyEl: the paragraph that holds that explanation
          const slider = ctx.ui.slider({ label: 'P2’s speed', min: 0.5, max: 3, step: 0.05, value: v, format: (x) => x.toFixed(2) + '×', onInput: (x) => { v = x; paintDemo(); } });  // slider: P2's speed, from 0.5× to 3× in steps of 0.05; moving it recomputes the demo
          const prot = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'false', onclick: () => { protect = !protect; prot.setAttribute('aria-pressed', String(protect)); prot.textContent = protect ? 'Protect echo: ON' : 'Protect echo: OFF'; paintDemo(); } }, 'Protect echo: OFF');  // the Protect echo switch for the speed demo; toggling it recomputes the demo
          const BODY = [  // BODY: one function per concern that builds the content of the detail card
            () => {  // concern 1: a small table of process records that changes as events arrive
              // a tiny event stepper: each event changes the PCB records, as the OS would
              const EV = [  // EV: three events, each [button text, how it changes the table, explanation]
                ['The disk finishes P2’s read', (t) => { t[1][1] = 'Ready'; t[1][3] = 'the processor'; }, 'A disk interrupt tells the OS that P2’s data has arrived, so it moves P2 from Blocked to Ready.'],  // event 1: the disk finishes P2's read, so P2 moves from Blocked to Ready
                ['P1’s time slice runs out', (t) => { t[0][1] = 'Ready'; t[0][3] = 'the processor'; t[2][1] = 'Running'; t[2][3] = 'nothing'; }, 'A timer interrupt ends P1’s turn. P1 keeps the printer. The scheduler dispatches P3.'],  // event 2: P1's time slice ends; P1 becomes Ready but keeps the printer, and P3 starts running
                ['P3 asks for the printer', (t) => { t[2][1] = 'Blocked'; t[2][3] = 'the printer (P1 has it)'; t[1][1] = 'Running'; t[1][3] = 'nothing'; }, 'P1 holds the printer, so P3 is blocked and its record says what it waits for. P2 gets the processor.'],  // event 3: P3 asks for the printer, which P1 holds, so P3 is blocked and P2 runs
              ];  // closes EV
              let n = 0, prev = null;  // n = how many events have happened; prev = the table before the latest event, to highlight what changed
              const tb = h('tbody'), note = h('p', { class: 'small m0 c4-note' }), btn = h('button', { class: 'btn sm primary', type: 'button' });  // tb: the table body; note: the explanation under the table; btn: the next-event button
              const table = () => { const t = [['P1', 'Running', 'printer', 'nothing'], ['P2', 'Blocked', 'file F', 'the disk'], ['P3', 'Ready', 'nothing', 'the processor']]; for (let i = 0; i < n; i++) EV[i][1](t); return t; };  // table(): builds the starting records (process, state, holds, waiting for), then applies the first n events
              function draw() {  // draw(): redraws the records table, the note and the button label
                const t = table();  // t: the records as they are now
                tb.innerHTML = t.map((r, i) => `<tr>${r.map((c, j) => `<td class="${prev && prev[i][j] !== c ? 'c4-chg' : ''}">${j === 0 ? `<b class="pc${i + 1}">${c}</b>` : c}</td>`).join('')}</tr>`).join('');  // one row per process; a cell that changed in the latest event is highlighted, and the name is in its colour
                note.innerHTML = n ? `<b>Event ${n}:</b> ${EV[n - 1][2]}` : 'Press the button to send the OS an event and watch it update its records.';  // the note explains the latest event, or tells the student to press the button
                btn.textContent = n < EV.length ? `Next event: ${EV[n][0]}` : 'Start over';  // the button names the next event, or offers to start over after the last one
              }  // ends draw()
              btn.onclick = () => { prev = n < EV.length ? table() : null; n = n < EV.length ? n + 1 : 0; draw(); };  // button click: remembers the table before the event, then applies the next event (or starts over after the last)
              draw();  // shows the starting records
              return h('div', { class: 'stack' },  // returns concern 1's content as a vertical stack
                h('p', { class: 'm0', html: 'The OS keeps a <span class="t">process control block</span> for every process: its state, its priority, the resources it holds and what it is waiting for.' }),  // explains that the OS keeps a process control block (a record of state, priority, resources, waits) for each process
                h('table', { class: 'tbl compact' }, h('thead', { html: '<tr><th>Process</th><th>State</th><th>Holds</th><th>Waiting for</th></tr>' }), tb),  // the records table with columns Process, State, Holds and Waiting for
                h('div', { class: 'row nw' }, btn), note,  // the next-event button, then the explanation of the latest event
                h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'Every later decision (who runs, who waits, who gets the printer) starts by looking up these records.' }));  // "Why it matters" callout: every later decision starts from these records
            },  // ends concern 1's content
            () => h('div', { class: 'stack', html: `${/* concern 2: fixed content about resource allocation, written as HTML text */''}
              <p class="m0">Every active process needs resources, and the OS decides who gets each one, when, and when to take it back:</p>${/* intro paragraph: the OS decides who gets each resource, when, and when to take it back */''}
              <div class="grid-2">${/* a two-column grid of the four kinds of resources */''}
                <div class="box cpu small"><b>Processor time</b><br>who runs next, and for how long</div>${/* resource box: processor time (who runs next, and for how long) */''}
                <div class="box mem small"><b>Memory</b><br>which parts of memory each process may use</div>${/* resource box: memory (which parts each process may use) */''}
                <div class="box os small"><b>Files</b><br>who may open, read or change each file</div>${/* resource box: files (who may open, read or change them) */''}
                <div class="box io small"><b>I/O devices</b><br>who gets the printer or an I/O channel</div>${/* resource box: I/O devices (who gets the printer or an I/O channel) */''}
              </div>${/* ends the grid */''}
              <div class="card tight stack gap-s">${/* a card for the idle-channel example */''}
                <h4 class="m0">Example: the idle I/O channel</h4>${/* heading: example of an idle I/O channel */''}
                <svg viewBox="0 0 540 84" width="100%" role="img" aria-label="Suspended P1 holds an idle I/O channel that P2 is waiting for">${/* drawing of the example: P1 holds the channel while P2 waits for it */''}
                  <rect x="4" y="12" width="140" height="56" rx="10" class="s-proc" stroke-width="2"/><text x="74" y="36" text-anchor="middle" font-weight="800" style="fill:var(--proc)">P1</text><text x="74" y="56" text-anchor="middle" font-size="13">suspended</text>${/* drawing, left box: P1, marked as suspended */''}
                  <line x1="146" y1="40" x2="196" y2="40" class="s-line" marker-end="url(#arr)"/><text x="171" y="30" text-anchor="middle" font-size="13" class="s-sub">holds</text>${/* drawing: an arrow labelled "holds" from P1 to the channel */''}
                  <rect x="200" y="12" width="140" height="56" rx="10" class="s-io" stroke-width="2"/><text x="270" y="36" text-anchor="middle" font-weight="800">I/O channel</text><text x="270" y="56" text-anchor="middle" font-size="13">idle, locked</text>${/* drawing, middle box: the I/O channel, marked idle and locked */''}
                  <line x1="394" y1="40" x2="344" y2="40" class="s-line" stroke-dasharray="5 4" marker-end="url(#arr)"/><text x="369" y="30" text-anchor="middle" font-size="13" class="s-sub">wants</text>${/* drawing: a dashed arrow labelled "wants" from P2 to the channel */''}
                  <rect x="398" y="12" width="138" height="56" rx="10" class="s-accent" stroke-width="2"/><text x="467" y="36" text-anchor="middle" font-weight="800" style="fill:var(--accent)">P2</text><text x="467" y="56" text-anchor="middle" font-size="13">waiting</text>${/* drawing, right box: P2, marked as waiting */''}
                </svg>${/* ends the drawing */''}
                <p class="small m0">P1 was granted the channel, then suspended before using it. Keep it locked and the channel sits idle while P2 waits (with a risk of deadlock). Take it away and P1’s request is broken. Unpredictable speed makes the right choice hard to know.</p>${/* explains the dilemma: keep the channel locked and waste it, or take it away and break P1's request */''}
              </div>` }),  // ends the card and concern 2's content
            () => h('div', { class: 'stack', html: `${/* concern 3: fixed content about protection, written as HTML text */''}
              <p class="m0">One process must not damage another by accident: it must not overwrite another’s memory, corrupt its files or seize its devices.</p>${/* intro paragraph: one process must not damage another's memory, files or devices by accident */''}
              <svg viewBox="0 0 560 128" width="100%" role="img" aria-label="P2 is stopped from writing into P1's memory">${/* drawing: the OS and hardware stop P2 from writing into P1's memory */''}
                <rect x="20" y="6" width="200" height="98" rx="12" class="s-proc" stroke-width="2"/><text x="120" y="30" text-anchor="middle" font-weight="800" style="fill:var(--proc)">P1’s memory and files</text>${/* drawing: P1's area for memory and files */''}
                <rect x="45" y="44" width="150" height="44" rx="8" class="s-panel" stroke-width="1.5"/><text x="120" y="72" text-anchor="middle" font-size="14">balance = 500</text>${/* drawing: a value inside P1's memory (balance = 500) that must be kept safe */''}
                <rect x="340" y="6" width="200" height="98" rx="12" class="s-accent" stroke-width="2"/><text x="440" y="30" text-anchor="middle" font-weight="800" style="fill:var(--accent)">P2</text>${/* drawing: P2's box */''}
                <text x="440" y="66" text-anchor="middle" font-size="14">buggy write to</text><text x="440" y="84" text-anchor="middle" font-size="14">the wrong address</text>${/* drawing: P2's label explains it makes a buggy write to the wrong address */''}
                <line x1="336" y1="66" x2="206" y2="66" class="s-line" style="stroke:var(--intr)" stroke-width="3" stroke-dasharray="7 5" marker-end="url(#arr-intr)"/>${/* drawing: a dashed arrow from P2 toward P1's memory, in the interrupt colour */''}
                <rect x="252" y="40" width="44" height="52" rx="8" class="s-os" stroke-width="2"/><text x="274" y="75" text-anchor="middle" font-size="26" font-weight="800" style="fill:var(--intr)">✗</text>${/* drawing: a barrier with a cross between them, where the write is stopped */''}
                <text x="274" y="122" text-anchor="middle" font-size="13" class="s-sub">OS + hardware block it</text>${/* drawing: caption under the barrier, the OS and hardware block it */''}
              </svg>${/* ends the drawing */''}
              <div class="grid-3">${/* a three-column grid of how each kind of resource is protected */''}
                <div class="box mem small"><b>Memory</b><br>each process has its own <span class="t">address space</span>; hardware checks every access</div>${/* protection box: memory, each process has its own address space checked by hardware */''}
                <div class="box os small"><b>Files</b><br>permissions decide who may read or change each file</div>${/* protection box: files, permissions decide who may read or change them */''}
                <div class="box io small"><b>Devices</b><br>processes reach devices only by asking the OS</div>${/* protection box: devices, processes reach them only by asking the OS */''}
              </div>${/* ends the grid */''}
              <div class="callout warn small m0" data-label="Common mistake">Thinking protection solves races. It stops <i>unintended</i> interference. Processes that share data <i>on purpose</i>, like the two echo callers, still need the synchronization tools of this chapter.</div>` }),  // "Common mistake" callout: protection stops accidents, not races between processes that share data on purpose
            () => h('div', { class: 'stack gap-s' },  // concern 4: the live speed demo, built from the parts defined above
              h('p', { class: 'small m0', html: `The echo procedure again, with chin and chout in shared memory. ${PN(1)} calls it after a little work; ${PN(2)} does a bit more work first. Drag ${PN(2)}’s speed and watch the result.` }),  // intro: the echo procedure again; P2 does more work first; drag its speed and watch
              h('div', { class: 'row nw' }, h('div', { class: 'grow' }, slider), prot),  // a row with the speed slider (taking the spare width) and the Protect echo switch
              band, tl, res, whyEl,  // the speed strip, the timeline, the result line and the explanation
              h('p', { class: 'small m0 muted', html: 'The strip shows every speed from 0.5× to 3×: green gives a correct result, red a wrong one. Without protection the answer depends on speed, which breaks this rule. With it, every speed works.' })),  // note on how to read the strip: green speeds work, red ones fail; with protection every speed works
          ];  // closes BODY
          function paint() {  // paint(): shows the selected concern in the detail card; runs when a concern row is clicked
            rows.forEach((r, i) => r.classList.toggle('on', i === cur));  // highlights the selected row and clears the others
            detail.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'c4-n big-n' }, String(cur + 1)), h('h3', { class: 'm0' }, C[cur].t)), BODY[cur]());  // fills the detail card with a big number badge, the concern's title and that concern's content
            if (cur === 3) paintDemo();  // concern 4 also needs its demo computed and drawn
            ctx.refit();  // asks the guide to recheck that the step still fits on screen
          }  // ends paint()
          el.append(h('div', { class: 'split l fill' },  // puts the step on the page as two columns
            h('div', { class: 'stack' },  // left column
              h('p', { class: 'lead m0', html: 'Timing trouble is not only the programmer’s problem. Concurrency hands the OS four responsibilities.' }),  // intro: concurrency gives the OS four responsibilities
              h('div', { class: 'stack gap-s' }, ...rows),  // the four concern rows
              h('div', { class: 'callout why small m0', 'data-label': 'Where each is handled', html: 'Jobs 1 to 3 use the OS’s process, memory, file and I/O management. Job 4 is what the rest of this chapter is about. Click each job to explore it.' })),  // callout: jobs 1 to 3 use ordinary OS management; job 4 is the subject of the rest of the chapter
            detail));  // right column: the detail card; closes the layout
          paint();  // shows the starting concern (number 4)
        },  // ends render() for step 4
      },  // ends step 4

      /* ---------------- 5. Degrees of awareness ---------------- */
      {  // step 5 begins
        title: 'How aware are processes of each other?',  // the step's heading
        kind: 'compare',  // kind 'compare': a step that compares cases side by side
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 5; builds the awareness table and the classifier game
          const { h } = ctx;  // h is the guide's helper for making HTML elements
          const COLS = [  // COLS: the three degrees of awareness, one table column each
            { name: 'Unaware of each other', ex: 'separate programs that happen to run at the same time',  // column 1: unaware of each other, e.g. unrelated programs
              rel: '<span class="t">Competition</span>', inf: 'Each one’s results do <b>not</b> depend on the others. Its <b>timing</b> can suffer (it may wait for a resource).',  // its relationship is competition; results do not depend on the others, but timing can suffer
              prob: ['Mutual exclusion', 'Deadlock (renewable resource)', 'Starvation'] },  // its control problems: mutual exclusion, deadlock over a renewable resource, starvation
            { name: 'Indirectly aware', ex: 'processes that share an object, such as a variable, file or buffer',  // column 2: indirectly aware, through a shared object
              rel: '<span class="t">Cooperation by sharing</span>', inf: 'Results <b>may depend</b> on information obtained from the others. Timing can suffer.',  // its relationship is cooperation by sharing; results may depend on the others
              prob: ['Mutual exclusion', 'Deadlock (renewable resource)', 'Starvation', 'Data coherence'] },  // its control problems: the same three plus data coherence
            { name: 'Directly aware', ex: 'processes that name each other and exchange messages',  // column 3: directly aware, by name and messages
              rel: '<span class="t">Cooperation by communication</span>', inf: 'Results <b>may depend</b> on information obtained from the others. Timing can suffer.',  // its relationship is cooperation by communication; results may depend on the others
              prob: ['Deadlock (consumable resource)', 'Starvation'] },  // its control problems: deadlock over a consumable resource, and starvation
          ];  // closes COLS
          const ROWS = [['Relationship', 'rel'], ['Influence on each other', 'inf'], ['Control problems', 'prob']];  // ROWS: the table's three rows, each [row label, which field of the column to show]
          const shown = new Set();  // shown: the columns the student has revealed so far
          const cells = [];   // cells[col] = [td, ...]
          const head = h('tr', {}, h('th', {}, ''), ...COLS.map((c, i) => h('th', { class: 'aw-h aw-c' + i }, h('div', {}, c.name), h('div', { class: 'aw-ex' }, 'e.g. ' + c.ex))));  // head: the heading row, an empty corner cell then each column's name with a grey example underneath
          const body = ROWS.map(([label, key]) => h('tr', {}, h('td', { class: 'aw-lbl' }, label), ...COLS.map((c, i) => {  // body: one table row per ROWS entry, a label cell then one cell per column
            const td = h('td', { class: 'aw-cell aw-c' + i });  // each data cell is tagged with its column number (aw-c0, aw-c1, aw-c2) so a column can be highlighted
            td.dataset.key = key;  // stores which field the cell shows
            (cells[i] = cells[i] || []).push(td);  // files the cell under its column, so fill(i) can update the whole column at once
            return td;  // returns the cell to the row
          })));  // closes the row builder
          function fill(i) {  // fill(i): fills column i, either with its content or with Reveal buttons
            cells[i].forEach((td) => {  // for every cell in that column
              const key = td.dataset.key, c = COLS[i];  // key is the field this cell shows; c is the column's data
              if (shown.has(i)) td.innerHTML = key === 'prob' ? c.prob.map((p) => `<div class="aw-p">${p}</div>`).join('') : c[key];  // once revealed: the text, or for the problems row one line per problem
              else { td.innerHTML = ''; td.append(h('button', { class: 'btn sm ghost aw-rev', type: 'button', onclick: () => { shown.add(i); fill(i); ctx.refit(); } }, 'Reveal')); }  // not yet revealed: a Reveal button that reveals the whole column when clicked
            });  // ends the loop over cells
          }  // ends fill()
          COLS.forEach((_, i) => fill(i));  // fills all three columns at the start (with Reveal buttons, since nothing is revealed yet)
          const hl = (i) => el.querySelectorAll('.aw-cell, .aw-h').forEach((c) => c.classList.toggle('aw-on', i != null && c.classList.contains('aw-c' + i)));  // hl(i): tints column i of the table (heading and cells); hl(null) clears every tint
          /* ----- classifier ----- */
          const SC = [  // SC: the six classifier scenarios, each [description, correct column number, explanation]
            ['Two word processors, started by different users, both send documents to the one printer.', 0, 'Neither program knows the other exists. They simply compete for the printer, and the OS must referee.'],  // scenario 1 (competition): two word processors share one printer without knowing each other
            ['The threads of a web server all add 1 to the same shared visit counter.', 1, 'They never talk to each other, but they all read and write one shared variable, so they cooperate by sharing.'],  // scenario 2 (sharing): server threads all update one shared visit counter
            ['A client process sends a request message to a named server process and waits for its reply.', 2, 'They know each other by name and interact only through messages: cooperation by communication.'],  // scenario 3 (communication): a client sends a request message to a named server
            ['Several processes update records in one shared database file, relying on what the others wrote.', 1, 'They are linked only through the shared file. Its records must stay consistent (data coherence).'],  // scenario 4 (sharing): processes rely on records in one shared database file
            ['Batch jobs from different users each need the same tape drive at some point.', 0, 'The jobs are independent and unaware of each other. Only the tape drive links them, so they compete for it.'],  // scenario 5 (competition): independent batch jobs all need the same tape drive
            ['Stage 1 of a pipeline calls send() with each finished record; stage 2 calls receive() to get it.', 2, 'The stages communicate directly with message primitives. Nothing is shared, so no mutual exclusion is needed.'],  // scenario 6 (communication): pipeline stages pass records with send and receive
          ];  // closes SC
          let k = 0, score = 0, answered = false;  // k = current scenario; score = correct answers; answered = whether this scenario has been answered
          const res = [];  // res: whether each answer so far was right, used for the "correct" count
          const qText = h('div', { class: 'card aw-q' });  // qText: the card that shows the current scenario
          const fb = h('div', { class: 'aw-fb small' });  // fb: the feedback area under the answer buttons
          const prog = h('span', { class: 'chip accent' });  // prog: the running score chip, such as "3 / 4 correct"
          const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { if (k < SC.length - 1) { k++; show(); } else { k = 0; score = 0; res.length = 0; show(); } } }, 'Next scenario');  // next: moves to the next scenario, or starts over after the last one; stays off until the student answers
          const choices = COLS.map((c, i) => h('button', { class: 'btn aw-choice', type: 'button', onclick: () => answer(i) }, c.name));  // choices: one answer button per degree of awareness; clicking one calls answer(i)
          function show() {  // show(): displays the current scenario and resets the buttons and feedback
            answered = false; hl(null);  // allows a new answer and clears the table tint
            qText.innerHTML = `<span class="xs b muted">SCENARIO ${k + 1} OF ${SC.length}</span><div>${SC[k][0]}</div>`;  // the scenario card: "SCENARIO n OF 6" and the description
            fb.innerHTML = '<span class="muted">Pick the degree of awareness. The matching column of the table lights up.</span>';  // a hint in the feedback area until the student picks
            choices.forEach((b) => { b.disabled = false; b.classList.remove('aw-right', 'aw-wrong'); });  // turns every answer button back on and removes the green/red marks
            next.disabled = true; next.textContent = k < SC.length - 1 ? 'Next scenario' : 'Start over';  // turns the Next button off, and labels it "Start over" on the last scenario
            prog.textContent = `${score} / ${res.length} correct`;  // updates the score chip
          }  // ends show()
          function answer(i) {  // answer(i): checks the student's pick i; runs when an answer button is clicked
            if (answered) return;  // ignores extra clicks once the scenario has been answered
            answered = true;  // marks it answered
            const [, want, why] = SC[k];  // want is the correct column and why the explanation
            const ok = i === want;  // ok: whether the pick was right
            if (ok) score++;  // a right answer adds to the score
            res.push(ok);  // records the result
            choices.forEach((b, j) => { b.disabled = true; if (j === want) b.classList.add('aw-right'); else if (j === i) b.classList.add('aw-wrong'); });  // locks every button, turns the correct one green and a wrong pick red
            shown.add(want); fill(want); hl(want);  // reveals the correct column in the table and tints it so the student sees the matching row entries
            fb.innerHTML = `<b style="color:var(${ok ? '--ok' : '--bad'})">${ok ? 'Correct.' : 'Not quite.'}</b> ${why} <span class="muted">Problems to watch: ${COLS[want].prob.join(', ')}.</span>` +  // feedback: correct or not, the explanation, and the control problems to watch for that kind of interaction
              (k === SC.length - 1 ? ` <b>Done: ${score} of ${SC.length} correct.</b>` : '');  // after the last scenario, adds the final score
            next.disabled = false;  // turns the Next button on
            prog.textContent = `${score} / ${res.length} correct`;  // updates the score chip
            ctx.refit();  // asks the guide to recheck that the step still fits on screen
          }  // ends answer()
          el.append(h('div', { class: 'split r fill' },  // puts the step on the page as two columns (the wider column on the right)
            h('div', { class: 'stack' },  // left column
              h('p', { class: 'lead m0', html: 'Processes interact in three ways, depending on their <span class="t">degree of awareness</span> of each other.' }),  // intro: processes interact in three ways, depending on their degree of awareness
              h('table', { class: 'tbl aw-tbl' }, h('thead', {}, head), h('tbody', {}, ...body)),  // the awareness table: its heading row and three body rows
              h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', onclick: () => { COLS.forEach((_, i) => { shown.add(i); fill(i); }); ctx.refit(); } }, 'Reveal all'),  // a "Reveal all" button that reveals every column
                h('span', { class: 'small muted grow' }, 'Real processes often mix these; the table shows the pure cases.'))),  // note: real processes often mix these; the table shows the pure cases
            h('div', { class: 'card white stack aw-game' },  // right column: the classifier game on a white card
              h('div', { class: 'row' }, h('h4', { class: 'm0 grow' }, 'Classify the scenario'), prog),  // header row: "Classify the scenario" and the score chip
              qText, h('div', { class: 'stack gap-s' }, ...choices), fb, h('div', { class: 'row' }, h('span', { class: 'grow' }), next))));  // the scenario, the three answer buttons, the feedback, and the Next button at the right; closes the layout
          show();  // shows the first scenario
        },  // ends render() for step 5
      },  // ends step 5

      /* ---------------- 6. Competition: critical sections, deadlock, starvation ---------------- */
      {  // step 6 begins
        title: 'Competition: one resource, many processes',  // the step's heading
        kind: 'lab',  // kind 'lab': a hands-on step
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 6; shows the process pattern and the three competition tabs
          const { h } = ctx;  // h is the guide's helper for making HTML elements
          const code = ctx.ui.code(`${/* code: a code box showing the general shape of a competing process */''}
void P(int i) {       // same shape for P1, P2, P3${/* shown code, line 1: the same function shape serves P1, P2 and P3 */''}
  while (true) {      // each process loops forever${/* shown code, line 2: each process loops forever */''}
    entercritical(R); // wait here while R is busy${/* shown code, line 3: entercritical waits while the resource R is busy */''}
    use(R);           // critical section: uses R${/* shown code, line 4: the critical section, where the process uses R */''}
    exitcritical(R);  // free R, let one waiter in${/* shown code, line 5: exitcritical frees R and lets one waiting process in */''}
    other_work();     // remainder: needs no R${/* shown code, line 6: the remainder, work that needs no R */''}
  }                   // then around again${/* shown code, line 7: the end of the loop, back to the top */''}
}                     // end of process P(i)`, { lang: 'c', fontSize: 13.5 });  // shown code, line 8: the end of the process; also closes the code text and sets C-style colouring at 13.5px
          const tabs = ctx.ui.tabs([  // tabs: the guide's tab widget with three tabs; each builds its lab when opened
            { label: 'Mutual exclusion', render: (p) => { p.append(mutexLab(ctx)); } },  // tab 1: the printer lab with the mutual exclusion switch (mutexLab above)
            { label: 'Deadlock', render: (p) => { p.append(deadlockLab(ctx)); } },  // tab 2: the two-resource deadlock lab (deadlockLab above)
            { label: 'Starvation', render: (p) => { p.append(starveLab(ctx)); } },  // tab 3: the starvation timeline (starveLab above)
          ], { onChange: () => ctx.after(40, () => ctx.refit()) });  // after each tab switch, waits 40 ms for the new content to settle, then rechecks that the step fits on screen
          tabs.classList.add('cp-tabs');  // adds a class so this section's CSS can space the tab buttons
          el.append(h('div', { class: 'split l fill' },  // puts the step on the page as two columns
            h('div', { class: 'stack cp-left' },  // left column
              h('p', { class: 'lead m0', html: 'Processes that know nothing about each other still <span class="t" data-t="Competition">compete</span> for processors, memory, files and devices.' }),  // intro: processes that know nothing of each other still compete for resources
              h('p', { class: 'small m0', html: 'Some resources can serve only one process at a time, like a printer: a <span class="t">critical resource</span>. The code that uses it is that process’s <span class="t">critical section</span>. <span class="t">Mutual exclusion</span> means at most one process is in its critical section for that resource at any moment.' }),  // defines critical resource, critical section and mutual exclusion
              code,  // the code box
              h('p', { class: 'small m0', html: 'The mechanism is hidden behind two calls, <code>entercritical</code> and <code>exitcritical</code>. Competing processes exchange no information, yet one’s <b>timing</b> is affected: it may be kept waiting.' }),  // explains that entercritical and exitcritical hide the mechanism; competing processes may be kept waiting
              h('div', { class: 'callout why small m0', 'data-label': 'Two new dangers', html: 'Enforcing mutual exclusion creates two new problems: <span class="t">deadlock</span> and <span class="t">starvation</span>. Explore each tab.' })),  // callout: enforcing mutual exclusion brings two new dangers, deadlock and starvation
            h('div', { class: 'card white' }, tabs)));  // right column: the tabs on a white card; closes the layout
        },  // ends render() for step 6
      },  // ends step 6

      /* ---------------- 7. Cooperation: by sharing (data coherence) and by communication ---------------- */
      {  // step 7 begins
        title: 'Cooperation: sharing data and passing messages',  // the step's heading
        kind: 'lab',  // kind 'lab': a hands-on step
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 7; places the a = b puzzle and the message demo side by side
          const { h } = ctx;  // h is the guide's helper for making HTML elements
          el.append(h('div', { class: 'split r fill' },  // puts the step on the page as two columns
            h('div', { class: 'stack co-left' },  // left column: cooperation by sharing
              h('h4', { class: 'm0' }, 'Cooperation by sharing'),  // its heading
              h('p', { class: 'small m0', html: 'In <span class="t">cooperation by sharing</span>, processes read and write the same data without talking to each other. Many may read at once, but a writer needs exclusive access, and there is a new demand: <span class="t">data coherence</span>. Here the rule is <b>a = b</b>, an <span class="t">invariant</span>.' }),  // explains cooperation by sharing, the new demand of data coherence, and the invariant a = b
              coherenceLab(ctx),  // the a = b puzzle (coherenceLab above)
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Locking a and b separately is not enough. Make each <b>whole pair</b> one critical section.' })),  // "Common mistake" callout: lock the whole pair of updates, not a and b separately
            h('div', { class: 'card stack co-right' },  // right column: cooperation by communication
              h('h4', { class: 'm0' }, 'Cooperation by communication'),  // its heading
              h('p', { class: 'small m0', html: 'In <span class="t">cooperation by communication</span>, processes know each other by name and exchange messages with <span class="t" data-t="Communication primitive">communication primitives</span> such as <code>send</code> and <code>receive</code>. Nothing is shared, so mutual exclusion is not needed. Deadlock and starvation still are.' }),  // explains cooperation by communication: named processes exchange messages; no mutual exclusion, but deadlock and starvation remain
              messageLab(ctx))));  // the message demo (messageLab above); closes the layout
        },  // ends render() for step 7
      },  // ends step 7

      /* ---------------- 8. The six requirements for mutual exclusion ---------------- */
      {  // step 8 begins
        title: 'Six requirements any mutual exclusion scheme must meet',  // the step's heading
        kind: 'lab',  // kind 'lab': a hands-on step
        core: true,  // core: keeps this step in the guide's shorter "core" route
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 8; builds the requirement list and the spot-the-flaw game
          const { h } = ctx;  // h is the guide's helper for making HTML elements
          const REQ = [  // REQ: the six requirements, each [short title, one-sentence description]
            ['Only one process inside', 'Among all processes with critical sections for the same resource, at most one may be inside at a time.'],  // requirement 1: at most one process inside its critical section
            ['Halting outside must not hurt others', 'A process that stops in its non-critical code must not stop the others from entering.'],  // requirement 2: a process halting outside its critical section must not block the others
            ['No deadlock and no starvation', 'A process that wants to enter must never be delayed forever.'],  // requirement 3: no process may be delayed forever (no deadlock, no starvation)
            ['Free means enter at once', 'If nobody is inside, a process that asks to enter gets in without delay.'],  // requirement 4: when the critical section is free, a request is granted at once
            ['No assumptions about speed or CPUs', 'The scheme must work whatever the relative speeds and however many processors.'],  // requirement 5: no assumptions about relative speed or the number of processors
            ['Stay inside for a finite time', 'A process must leave its critical section after a finite time.'],  // requirement 6: a process stays inside only for a finite time
          ];  // closes REQ
          const SC = [  // SC: eight flawed proposals, each [description, index of the requirement it breaks, explanation]
            ['Two processes reach the entry code at the same instant, and the scheme lets both of them in.', 0, 'Two processes in their critical sections at once is exactly what mutual exclusion forbids.'],  // proposal 1 breaks requirement 1: two processes are let in together
            ['Processes must take strict turns. P2 halts for good while in its remainder code, far from any critical section, and now P1 can never get another turn.', 1, 'P1 does end up waiting forever, but the root cause is a process that halted <b>outside</b> its critical section. A correct scheme must not depend on what a process does, or fails to do, out there.'],  // proposal 2 breaks requirement 2: strict turns, and a process halted in its remainder blocks the other forever
            ['When the printer is freed, the lowest-numbered waiting process always gets it next. Under heavy load, P9 may wait forever.', 2, 'P9 is ready yet passed over indefinitely: starvation, which this requirement rules out.'],  // proposal 3 breaks requirement 3: lowest number always wins, so a high-numbered process can starve
            ['The critical section is empty, but a process that asks to enter is told to wait for the next timer tick first.', 3, 'Nobody is inside, so the request should be granted at once. Needless waiting wastes time.'],  // proposal 4 breaks requirement 4: a free critical section still makes the caller wait for a timer tick
            ['The scheme is only correct if the process holding the lock always runs faster than the processes waiting for it.', 4, 'Relative speed cannot be predicted (it depends on the scheduler, interrupts and other processes), so a correct scheme cannot rely on it.'],  // proposal 5 breaks requirement 5: it is correct only if the lock holder runs faster than the waiters
            ['Inside its critical section, a process waits for a user to type a reply, which may never come.', 5, 'Everyone else waiting for this resource is held up for as long as it stays inside, possibly forever.'],  // proposal 6 breaks requirement 6: a process waits for user input inside its critical section
            ['P1 holds lock A and waits for lock B. P2 holds lock B and waits for lock A.', 2, 'This is deadlock: both are delayed forever.'],  // proposal 7 breaks requirement 3: two processes each hold one lock and wait for the other's (deadlock)
            ['It was tested on a one-core laptop and relies on only one process running at any instant. On a four-core server it fails.', 4, 'On four cores it may even let two processes in, but the root cause is the assumption about the number of processors. On a multiprocessor, processes truly overlap.'],  // proposal 8 breaks requirement 5: it assumes a single processor and fails on four cores
          ];  // closes SC
          let k = 0, answered = false;  // k = current proposal; answered = whether it has been answered
          const res = [];  // res: whether each answer so far was right, used for the dots and the score
          const tally = REQ.map(() => 0);  // tally: how many times each requirement has been spotted correctly
          const scn = h('div', { class: 'card white rq-scn' });  // scn: the card that shows the current proposal
          const fb = h('div', { class: 'callout small m0 rq-fb', 'data-label': 'How to play' });  // fb: the feedback callout under the proposal
          const dots = h('div', { class: 'rq-dots' });  // dots: the row of progress dots, one per proposal
          const score = h('span', { class: 'chip accent' });  // score: the running score chip
          const next = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { if (k < SC.length - 1) { k++; show(); } else { k = 0; res.length = 0; tally.fill(0); show(); } } }, 'Next proposal');  // next: moves to the next proposal, or starts a new game after the last; stays off until the student answers
          const btns = REQ.map(([t, d], i) => h('button', { class: 'rq', type: 'button', onclick: () => answer(i) },  // btns: one clickable button per requirement; clicking one calls answer(i)
            h('span', { class: 'rq-n' }, String(i + 1)), h('span', { class: 'rq-t' }, h('b', {}, t), h('span', { class: 'rq-d' }, d)), h('span', { class: 'rq-tally' })));  // each button holds a number badge, the title and description, and a space for the "spotted" tally
          function paint() {  // paint(): updates the progress dots, the score and the tallies
            dots.innerHTML = SC.map((_, i) => `<i class="${i < res.length ? (res[i] ? 'ok' : 'bad') : ''} ${i === k ? 'cur' : ''}"></i>`).join('');  // one dot per proposal: green for right, red for wrong, a ring on the current one
            score.textContent = `${res.filter(Boolean).length} / ${res.length} correct`;  // the score chip, such as "5 / 6 correct"
            btns.forEach((b, i) => { b.querySelector('.rq-tally').innerHTML = tally[i] ? `<span class="chip ok">spotted ${tally[i] > 1 ? tally[i] + '×' : ''}✓</span>` : ''; });  // on each requirement, a "spotted" chip once it has been named correctly (with a count if more than once)
          }  // ends paint()
          function show() {  // show(): displays the current proposal and resets the buttons and feedback
            answered = false;  // allows a new answer
            btns.forEach((b) => { b.disabled = false; b.classList.remove('right', 'wrong'); });  // turns every requirement button back on and removes its green/red mark
            scn.innerHTML = `<div class="xs b muted">PROPOSED SCHEME ${k + 1} OF ${SC.length}</div><div>${SC[k][0]}</div>`;  // the proposal card: "PROPOSED SCHEME n OF 8" and the description
            fb.className = 'callout small m0 rq-fb'; fb.dataset.label = 'Your move';  // the feedback callout returns to its neutral look with the heading "Your move"
            fb.innerHTML = 'Each proposal has one root flaw. Click the requirement in the list that it most directly breaks.';  // instructions: each proposal has one root flaw; click the requirement it breaks most directly
            next.disabled = true; next.textContent = k < SC.length - 1 ? 'Next proposal' : 'Play again';  // turns the Next button off, and labels it "Play again" on the last proposal
            paint();  // updates the dots, score and tallies
          }  // ends show()
          function answer(i) {  // answer(i): checks the student's pick i; runs when a requirement button is clicked
            if (answered) return;  // ignores extra clicks once the proposal has been answered
            answered = true;  // marks it answered
            const [, want, why] = SC[k], ok = i === want;  // want is the requirement actually broken, why the explanation, and ok whether the pick was right
            res.push(ok);  // records the result
            if (ok) tally[want]++;  // a right answer adds to that requirement's tally
            btns.forEach((b, j) => { b.disabled = true; if (j === want) b.classList.add('right'); else if (j === i) b.classList.add('wrong'); });  // locks every button, turns the correct one green and a wrong pick red
            fb.className = 'callout small m0 rq-fb ' + (ok ? 'tip' : 'bad');  // the feedback callout turns green for right, red for wrong
            fb.dataset.label = ok ? 'Correct' : 'Not quite';  // its heading: "Correct" or "Not quite"
            fb.innerHTML = `${ok ? '' : `You chose requirement ${i + 1} (${REQ[i][0].toLowerCase()}), but this proposal breaks <b>requirement ${want + 1}: ${REQ[want][0].toLowerCase()}</b>. `}${why}` +  // feedback: for a wrong pick, names both the chosen and the broken requirement; then the explanation
              (k === SC.length - 1 ? ` <b>Finished: ${res.filter(Boolean).length} of ${SC.length} correct.</b>` : '');  // after the last proposal, adds the final score
            next.disabled = false;  // turns the Next button on
            paint();  // updates the dots, score and tallies
          }  // ends answer()
          el.append(h('div', { class: 'split fill' },  // puts the step on the page as two columns
            h('div', { class: 'stack rq-list' },  // left column: the requirement list
              h('p', { class: 'lead m0', html: 'Whatever tool provides mutual exclusion, whether software, hardware or the OS, it must meet all six.' }),  // intro: any mutual exclusion tool, whether software, hardware or the OS, must meet all six
              ...btns),  // the six requirement buttons
            h('div', { class: 'stack rq-game' },  // right column: the game
              h('div', { class: 'row' }, h('h4', { class: 'm0 grow' }, 'Spot the broken requirement'), score),  // header row: "Spot the broken requirement" and the score chip
              dots, scn, fb, h('div', { class: 'row' }, h('span', { class: 'small muted grow', html: 'Hint: ask who ends up waiting, and why.' }), next),  // the dots, the proposal, the feedback, and a row with a hint and the Next button
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'Look back at 5.1: Attempt 2 broke requirement 1, Attempt 1 broke 2 and 4, and Attempts 3 and 4 broke 3. The next sections judge every mechanism (hardware instructions, semaphores, monitors, messages) against this same checklist.' }))));  // "Why it matters" callout: links back to which requirements the attempts in 5.1 broke, and what later sections test
          show();  // shows the first proposal
        },  // ends render() for step 8
      },  // ends step 8

      /* ---------------- 9. Recap ---------------- */
      {  // step 9 begins
        title: 'Recap: six ideas to carry forward',  // the step's heading
        kind: 'recap',  // kind 'recap': a summary step
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 9; shows six flip cards and a summary row
          const { h } = ctx;  // h is the guide's helper for making HTML elements
          el.append(h('div', { class: 'stack fill' },  // puts the recap on the page as one vertical stack
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. Click again to flip it back.'),  // instructions: answer out loud before flipping each card
            ctx.ui.flipcards([  // the guide's flip-card widget: each card shows a question and turns over to its answer when clicked
              ['Why is concurrency hard?', '<span>Relative speed is unpredictable. It depends on other processes, interrupts and the scheduler, so sharing, allocation and debugging all get harder.</span>'],  // flip card: why concurrency is hard
              ['What went wrong in echo?', '<span>The globals chin and chout sat in memory shared by both callers. A second caller overwrote them while the first was still inside echo. Fix: one caller inside at a time.</span>'],  // flip card: what went wrong in echo, and the fix
              ['What is a race condition?', '<span>Processes read and write shared data and the result depends on the timing of their steps. The <b>last</b> writer decides the value.</span>'],  // flip card: what a race condition is
              ['The OS’s four concerns?', '<span>Track every process · allocate and reclaim resources · protect each process from the others · make results independent of speed.</span>'],  // flip card: the OS's four concerns
              ['Three ways processes interact?', '<span>Unaware → competition. Indirectly aware (shared object) → cooperation by sharing. Directly aware (messages) → cooperation by communication.</span>'],  // flip card: the three ways processes interact
              ['The six requirements?', '<span>One inside at a time · halting outside harms no one · no deadlock or starvation · free means enter at once · no speed or CPU assumptions · finite stay inside.</span>'],  // flip card: the six requirements for mutual exclusion
            ], { cols: 3, height: 176 }),  // three cards per row, each at least 176px tall
            h('div', { class: 'row rc-row' },  // a row of chips summarising which control problems go with each kind of interaction
              h('span', { class: 'chip io' }, 'Competition: mutual exclusion, deadlock, starvation'),  // chip: competition brings mutual exclusion, deadlock and starvation
              h('span', { class: 'chip mem' }, 'Sharing: all three + data coherence'),  // chip: sharing brings all three plus data coherence
              h('span', { class: 'chip proc' }, 'Communication: deadlock, starvation')),  // chip: communication brings deadlock and starvation
            h('div', { class: 'callout why small m0', 'data-label': 'Next', html: 'Section 5.3 shows how the hardware itself can help enforce mutual exclusion, and what that help costs.' })));  // "Next" callout: section 5.3 covers hardware help for mutual exclusion; closes the recap layout
        },  // ends render() for step 9
      },  // ends step 9

      /* ---------------- 10. Check yourself ---------------- */
      {  // step 10 begins
        title: 'Check yourself',  // the step's heading
        kind: 'check',  // kind 'check': the end-of-section quiz (the guide's quiz engine builds it from the list below)
        quiz: [  // quiz: the questions; a question with no type is multiple choice
          { q: 'The globals <code>chin</code> and <code>chout</code> sit in memory shared by two processes, which call the echo procedure at the same time, each on <b>its own processor</b>. The steps happen in this order: P1 reads <b>x</b> into chin; P2 reads <b>y</b> into chin; P1 copies chin into chout; P2 copies chin into chout; P1 displays chout; P2 displays chout. What appears on the screen?',  // quiz question 1 (multiple choice): what the screen shows when echo runs on two processors in the given order
            choices: ['x, then y', 'y, then y', 'x, then x', 'y, then x'], answer: 1,  // the four choices; answer 1 means the second choice, "y, then y" (counting starts at 0)
            feedback: ['That is the output we wanted, but it needs P1 to copy chin before P2 overwrites it. Here P2 put y into chin first.', null, 'x never reaches chout: by the time either process copies chin, it already holds y.', 'Neither process displays x. Both copy chin after it holds y, so both display y.'],  // feedback for each wrong choice (null for the right one), shown after a wrong pick
            why: 'A second processor does not help. P2 overwrote the shared chin with y before P1 copied it, so both processes put y into chout and both displayed y. The x was lost exactly as on one processor, but no interrupt was needed.' },  // explanation shown after checking: a second processor does not help; the shared chin was overwritten
          { type: 'order', q: 'Put the classic echo failure (one processor; chin and chout in memory both processes share) in the order it happens.',  // quiz question 2 (put in order): the steps of the classic one-processor echo failure
            items: ['P1 reads x into chin', 'P1 is interrupted before copying chin', 'P2 runs echo completely and displays y', 'P1 resumes and copies chin (now y) into chout', 'P1 displays y; the x is lost'],  // the steps, listed in the correct order; the quiz shuffles them for the student
            why: 'The damage happens in the gap between P1 reading chin and P1 copying it: P2 overwrote the shared variable in that gap.' },  // explanation: the damage happens in the gap between reading chin and copying it
          { type: 'tf', q: 'In a race condition, the process that writes to the shared variable first decides its final value.', answer: false,  // quiz question 3 (true or false): does the first writer decide the value? The answer is false
            why: 'The first value is simply overwritten. The last process to write (the loser of the race) decides the final value.' },  // explanation: the last writer decides the value
          { type: 'num', q: 'Shared variables start at b = 1 and c = 2. P3 executes <code>b = b + c;</code> and P4 executes <code>c = b + c;</code>. If P4 runs completely and then P3 runs, what is the final value of b?',  // quiz question 4 (calculate): the final b when P4 runs completely before P3
            answer: 4, tol: 0,  // the correct answer is 4, with no tolerance for other values
            why: 'P4 first: c = 1 + 2 = 3. Then P3: b = 1 + 3 = 4. (In the opposite order you get b = 3, c = 5.)' },  // explanation: the arithmetic for both orders
          { type: 'multi', q: 'Which of these are concerns the operating system must handle because processes run concurrently?',  // quiz question 5 (select all): which items are OS concerns caused by concurrency
            choices: ['Keep track of every process', 'Allocate and deallocate resources', 'Protect each process’s data and resources from the others', 'Make a process’s results independent of its relative speed', 'Make every process run at the same speed', 'Remove all resources that processes share'],  // the six choices: the four real concerns and two distractors
            answer: [0, 1, 2, 3],  // the correct choices are the first four
            why: 'The four concerns are tracking, allocation, protection and speed-independent results. The OS cannot equalise speeds, and sharing resources is unavoidable.' },  // explanation: the four concerns; the OS cannot equalise speeds or remove sharing
          { type: 'match', q: 'Match each degree of awareness to the relationship it produces.',  // quiz question 6 (match the pairs): each degree of awareness with its relationship
            pairs: [['Unaware of each other', 'Competition'], ['Indirectly aware, through a shared object', 'Cooperation by sharing'], ['Directly aware, by name', 'Cooperation by communication']],  // the three pairs, each [degree of awareness, relationship]
            why: 'Unaware processes only compete for resources. Processes linked by shared data cooperate by sharing. Processes that name each other and exchange messages cooperate by communication.' },  // explanation: how each kind of awareness leads to its relationship
          { type: 'bucket', q: 'Sort each situation by how the processes interact.', buckets: ['Competition', 'Cooperation by sharing', 'Cooperation by communication'],  // quiz question 7 (sort into groups): six situations into competition, sharing or communication
            items: [['Two unrelated batch jobs both need the one tape drive', 0], ['Threads of a server all update one shared counter', 1], ['A client sends a request message to a named server', 2], ['Several processes update records in one shared file', 1], ['Pipeline stages pass records with send and receive', 2], ['Programs from two users both print on the office printer', 0]],  // the situations, each with the number of its correct group
            why: 'No shared data and no messages means competition. A shared variable or file means cooperation by sharing. Named processes exchanging messages means cooperation by communication.' },  // explanation: the rule of thumb for telling the three apart
          { q: 'The part of a program that uses a resource which only one process may use at a time is called the…',  // quiz question 8 (multiple choice): the name for the code that uses a one-at-a-time resource
            choices: ['critical section', 'critical resource', 'remainder section', 'global variable'], answer: 0,  // choices; the correct one is "critical section"
            feedback: [null, 'The critical resource is the resource itself (the printer), not the code that uses it.', 'The remainder section is the code that does not use the resource.', 'A global variable may be shared data, but the question asks for the piece of code.'],  // feedback for each wrong choice: resource versus code, remainder section, global variable
            why: 'The resource is the critical resource; the code that uses it is the critical section. Mutual exclusion allows at most one process in its critical section for that resource.' },  // explanation: the difference between the critical resource and the critical section
          { type: 'multi', q: 'Which statements about deadlock and starvation are true?',  // quiz question 9 (select all): true statements about deadlock and starvation
            choices: ['In deadlock, each process in the group waits for something only another member of the group can provide', 'During starvation the rest of the system can keep doing useful work', 'Enforcing mutual exclusion can lead to either problem', 'Starvation requires a circle of processes waiting for each other'],  // choices; the last one (starvation needs a circle) is the false one
            answer: [0, 1, 2],  // the correct choices are the first three
            why: 'Deadlock is a closed circle of waiting, so nobody in it moves. Starvation needs no circle: the system runs, but one process is passed over indefinitely. Both can arise from how mutual exclusion is enforced.' },  // explanation: deadlock is a closed circle of waiting; starvation needs none
          { type: 'num', q: 'Shared a = b = 1 and the rule a = b must hold. P1 runs <code>a = a + 1; b = b + 1;</code> and P2 runs <code>b = 2 * b; a = 2 * a;</code>. Each process keeps its own two statements in order. Of the six possible interleavings of the four statements, how many finish with a ≠ b?',  // quiz question 10 (calculate): how many of the six interleavings of the a = b puzzle break a = b
            answer: 4, tol: 0,  // the correct answer is 4, with no tolerance
            why: 'Only the two orders where one process runs completely first keep a = b (giving 4, 4 or 3, 3). All four mixed orders finish with a = 4, b = 3.' },  // explanation: only the two serial orders keep a = b
          { q: 'A proposed lock is correct only if the process holding it always runs faster than the processes waiting for it. Which requirement for mutual exclusion does it break?',  // quiz question 11 (multiple choice): which requirement a speed-dependent lock breaks
            choices: ['Only one process may be in its critical section at a time', 'No assumptions may be made about relative speeds or the number of processors', 'A process must leave its critical section after a finite time', 'A process asking to enter a free critical section must get in without delay'], answer: 1,  // choices; the correct one is the rule against assumptions about speed or processors
            feedback: ['The lock may keep processes out correctly under its assumption; the problem is the assumption itself.', null, 'Nothing here says a process stays inside forever.', 'Nothing here describes needless waiting at a free critical section.'],  // feedback for each wrong choice
            why: 'Relative speeds depend on the scheduler, interrupts and other processes, so they cannot be predicted. A correct scheme must work at any speed.' },  // explanation: relative speed cannot be predicted, so a scheme must work at any speed
          { q: 'Processes that cooperate only by sending and receiving messages share no data. Which control problem therefore does <b>not</b> arise for them?',  // quiz question 12 (multiple choice): which control problem does not arise for pure message passing
            choices: ['Mutual exclusion', 'Deadlock', 'Starvation', 'All three still arise'], answer: 0,  // choices; the correct one is mutual exclusion
            feedback: [null, 'Deadlock can still happen: two processes may each wait to receive a message from the other.', 'Starvation can still happen: one process may keep being passed over while others exchange messages.', 'Mutual exclusion is not needed, because nothing is shared.'],  // feedback for each wrong choice: deadlock and starvation still arise with messages
            why: 'With nothing shared there is nothing to lock. Deadlock (both waiting in receive) and starvation (one process never answered) still can occur. Messages can also serve as a tool: in Section 5.6 a single token message enforces mutual exclusion on a resource that is shared.' },  // explanation: nothing shared means nothing to lock; a later section uses a token message for mutual exclusion
        ],  // closes the quiz list
      },  // ends step 10

    ],  // closes the steps list

    notes: `${/* notes: the printable summary of the whole section, written as HTML text */''}
<h3>Why concurrency is hard</h3>${/* notes heading: why concurrency is hard */''}
<p>On one processor the OS <b>interleaves</b> processes (a slice of one, then another). On a multiprocessor they are interleaved and also <b>overlapped</b> (truly running at the same instant). Both raise the same problems, because a process’s <b>relative speed</b> cannot be predicted: it depends on what other processes do, how the OS handles interrupts, and the OS’s scheduling policy. Three difficulties follow:</p>${/* notes paragraph: interleaving versus overlapping, and why relative speed is unpredictable */''}
<ol>${/* notes list of the three difficulties */''}
<li><b>Sharing global resources is risky:</b> if two processes read and write the same global variable, the order of their steps decides the result.</li>${/* difficulty 1: sharing a global variable */''}
<li><b>Optimal allocation is hard:</b> if P1 is granted an I/O channel and suspended before using it, locking the channel for P1 leaves it idle while others wait (and can lead to deadlock).</li>${/* difficulty 2: allocating an I/O channel to a suspended process */''}
<li><b>Errors are hard to locate:</b> results are nondeterministic, so a failure may not repeat when you rerun the program.</li>${/* difficulty 3: nondeterministic results make errors hard to find */''}
</ol>${/* ends the list */''}
<h3>The echo example</h3>${/* notes heading: the echo example */''}
<p><b>The assumption that makes the race possible:</b> to save memory, the OS loads echo <b>and its global variables</b> once, into a region of memory shared by every application, so all callers use the same chin and chout. (The same holds if the callers are threads of one process.) Sharing code alone would not be enough: separate processes running the same program normally get private copies of its globals.</p>${/* notes paragraph: the assumption that echo and its globals are loaded once into shared memory */''}
<pre>char chin, chout;    // in shared memory: one copy for all callers${/* shown code, line 1: chin and chout, one shared copy for all callers */''}
void echo() {        // any process may call it${/* shown code, line 2: the start of echo */''}
  chin = getchar();  // 1. read a key into chin${/* shown code, line 3: read a key into chin */''}
  chout = chin;      // 2. copy it into chout${/* shown code, line 4: copy chin into chout */''}
  putchar(chout);    // 3. display chout${/* shown code, line 5: display chout */''}
}                    // return to the caller</pre>${/* shown code, line 6: the end of echo; closes the code block */''}
<p><b>One processor:</b> P1 reads <b>x</b> into chin and is interrupted. P2 runs echo completely, reading and displaying <b>y</b>. P1 resumes, copies chin (now y) and displays y: x is lost, y appears twice. <b>Two processors:</b> no interrupt is needed. P1 reads x, P2 reads y, both copy chin (y) into chout, and both display y. <b>Fix:</b> let only one process be inside echo at a time; a second caller is blocked at the entrance until the first returns. The cause is shared data, not the number of processors.</p>${/* notes paragraph: the failure on one and on two processors, and the fix of one caller at a time */''}
<h3>Race conditions</h3>${/* notes heading: race conditions */''}
<p>A <b>race condition</b> occurs when several processes or threads read and write shared data and the final result depends on the relative timing of their execution. When writes collide, the “loser” of the race (the last writer) decides the value.</p>${/* notes paragraph: defines a race condition; the last writer decides */''}
<ul>${/* notes list of the two race examples */''}
<li>Shared <code>a</code>: P1 runs <code>a = 1</code>, P2 runs <code>a = 2</code>. Whichever runs last leaves its value.</li>${/* example: P1 and P2 each write a different value into a */''}
<li>Shared b = 1, c = 2: P3 runs <code>b = b + c</code>, P4 runs <code>c = b + c</code>. P3 then P4: b = 3, c = 5. P4 then P3: b = 4, c = 3. If both load b and c before either stores its sum, b = 3 and c = 3.</li>${/* example: b = b + c and c = b + c give three outcomes depending on the order */''}
</ul>${/* ends the list */''}
<p>A correct program must give the right answer for <b>every</b> possible interleaving.</p>${/* notes paragraph: a correct program must be right for every interleaving */''}
<h3>Four OS concerns</h3>${/* notes heading: the four OS concerns */''}
<ol>${/* notes numbered list of the concerns */''}
<li><b>Keep track of the processes</b>, using a process control block for each (state, priority, resources held, what it waits for).</li>${/* concern 1: keep track of processes with a process control block for each */''}
<li><b>Allocate and deallocate resources</b>: processor time, memory, files and I/O devices.</li>${/* concern 2: allocate and take back resources */''}
<li><b>Protect</b> each process’s data and physical resources against unintended interference by others (address spaces, file permissions, access to devices only through the OS).</li>${/* concern 3: protect each process's data and resources */''}
<li><b>Make results independent of speed:</b> a process’s function and output must not depend on how fast it runs relative to other processes. This is the subject of the rest of the chapter.</li>${/* concern 4: make results independent of speed, the subject of the rest of the chapter */''}
</ol>${/* ends the list */''}
<h3>How processes interact: degree of awareness</h3>${/* notes heading: degree of awareness */''}
<table>${/* notes table comparing the three kinds of interaction */''}
<tr><th>Degree of awareness</th><th>Relationship</th><th>Influence on each other</th><th>Control problems</th></tr>${/* table heading row: awareness, relationship, influence, control problems */''}
<tr><td>Unaware of each other</td><td>Competition</td><td>Results independent of the others; timing may suffer</td><td>Mutual exclusion, deadlock (renewable resource), starvation</td></tr>${/* table row: unaware processes compete */''}
<tr><td>Indirectly aware (shared object)</td><td>Cooperation by sharing</td><td>Results may depend on information from the others; timing may suffer</td><td>Mutual exclusion, deadlock (renewable resource), starvation, data coherence</td></tr>${/* table row: indirectly aware processes cooperate by sharing */''}
<tr><td>Directly aware (named, messages)</td><td>Cooperation by communication</td><td>Results may depend on information from the others; timing may suffer</td><td>Deadlock (consumable resource), starvation</td></tr>${/* table row: directly aware processes cooperate by communication */''}
</table>${/* ends the table */''}
<p>A <b>renewable</b> (reusable) resource, such as a processor, memory or an I/O channel, is released and reused. A <b>consumable</b> resource, such as a message, is destroyed when a process receives it.</p>${/* notes paragraph: renewable versus consumable resources */''}
<h3>Competition among processes</h3>${/* notes heading: competition among processes */''}
<p>A <b>critical resource</b> can be used by only one process at a time (a printer). The code that uses it is the process’s <b>critical section</b>. <b>Mutual exclusion</b>: at most one process at a time is in its critical section for that resource. Competing processes exchange no information, but one may be delayed while another uses the resource.</p>${/* notes paragraph: critical resource, critical section and mutual exclusion */''}
<pre>void P(int i) {        // same shape for every process${/* shown code, line 1: the general shape of a competing process */''}
  while (true) {       // loop forever${/* shown code, line 2: loop forever */''}
    entercritical(R);  // wait here while R is busy${/* shown code, line 3: wait at entercritical while R is busy */''}
    use(R);            // critical section${/* shown code, line 4: the critical section */''}
    exitcritical(R);   // free R, let one waiter in${/* shown code, line 5: free R and let one waiting process in */''}
    other_work();      // remainder: needs no R${/* shown code, line 6: the remainder, which needs no R */''}
  }                    // around again${/* shown code, line 7: back to the top of the loop */''}
}                      // end of P(i)</pre>${/* shown code, line 8: the end of P(i); closes the code block */''}
<p>A process that finds R busy waits in <code>entercritical</code>; <code>exitcritical</code> lets a waiter in. Without them, two processes can print at once and their pages mix. Enforcing mutual exclusion creates two new problems:</p>${/* notes paragraph: what entercritical and exitcritical do, and the two new problems they bring */''}
<ul>${/* notes list of the two new problems */''}
<li><b>Deadlock:</b> P1 and P2 both need R1 and R2. P1 holds R1 and waits for R2; P2 holds R2 and waits for R1. Neither can ever continue, though each program is fine alone. Asking for resources in the same order prevents this circle.</li>${/* notes item: deadlock over two resources, prevented by asking in the same order */''}
<li><b>Starvation:</b> P1, P2 and P3 all want R repeatedly. If the OS keeps handing R to P1 and P3 in turn, P2 is passed over indefinitely even though there is no deadlock and work continues. A fair policy such as first come, first served avoids it.</li>${/* notes item: starvation under an unfair policy, avoided by first come, first served */''}
</ul>${/* ends the list */''}
<h3>Cooperation by sharing</h3>${/* notes heading: cooperation by sharing */''}
<p>Processes share variables, files or databases without knowing each other’s identity. Many may read at once, but a writer needs exclusive access, so mutual exclusion, deadlock and starvation apply. The new demand is <b>data coherence</b>: every required relationship (an <b>invariant</b>) must still hold after concurrent updates.</p>${/* notes paragraph: shared data needs exclusive writers and data coherence (invariants must still hold) */''}
<p>Example: a = b = 1 and the rule a = b. P1 runs <code>a = a + 1; b = b + 1;</code> and P2 runs <code>b = 2 * b; a = 2 * a;</code>. Each keeps a = b when run alone (P1 then P2 gives 4, 4; P2 then P1 gives 3, 3). Every one of the four mixed orders, such as a = a + 1, b = 2 * b, b = b + 1, a = 2 * a, gives <b>a = 4, b = 3</b>. Protecting each variable separately is not enough: the <b>whole sequence</b> of updates in each process must be one critical section.</p>${/* notes paragraph: the a = b example, and why each whole sequence of updates must be one critical section */''}
<h3>Cooperation by communication</h3>${/* notes heading: cooperation by communication */''}
<p>Processes know each other by name and exchange messages using <b>communication primitives</b> (send, receive) supplied by the OS or the language. Nothing is shared, so mutual exclusion is not a control requirement. <b>Deadlock</b> is still possible (P1 waits to receive from P2 while P2 waits to receive from P1), and so is <b>starvation</b> (P2 and P3 both want to talk to P1, but P1 keeps exchanging messages with P2, so P3 is never served).</p>${/* notes paragraph: message passing needs no mutual exclusion but can still deadlock or starve */''}
<h3>Six requirements for mutual exclusion</h3>${/* notes heading: the six requirements for mutual exclusion */''}
<ol>${/* notes numbered list of the requirements */''}
<li>Mutual exclusion must be enforced: among all processes with critical sections for the same resource or shared object, only one at a time may be inside.</li>${/* requirement 1: only one process at a time inside its critical section */''}
<li>A process that halts in its non-critical section must do so without interfering with other processes.</li>${/* requirement 2: a process halting outside its critical section must not interfere with others */''}
<li>A process requesting entry must not be delayed indefinitely: no deadlock and no starvation.</li>${/* requirement 3: no process may be delayed forever */''}
<li>When no process is in a critical section, a process that requests entry must be admitted without delay.</li>${/* requirement 4: a free critical section admits a requester at once */''}
<li>No assumptions are made about relative process speeds or the number of processors.</li>${/* requirement 5: no assumptions about speed or the number of processors */''}
<li>A process remains inside its critical section for a finite time only.</li>${/* requirement 6: a process stays inside only for a finite time */''}
</ol>`,  // ends the list and the notes text
  });  // closes the section description and the Guide.section call
})();  // closes and immediately runs the wrapper function opened on the first line of code
