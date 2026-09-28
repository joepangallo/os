/* =====================================================================
   5.4 Semaphores
   Original teaching material. Every step is self-contained; small helpers
   shared by several steps live inside this IIFE (no globals).
   ===================================================================== */
(function () {
  /* ---------- shared semaphore model (general / counting semaphore) ---------- */
  // wait: returns true when the caller must block (it is appended to the queue)
  function semWaitOp(sem, who) {
    sem.v -= 1;
    if (sem.v < 0) { sem.q.push(who); return true; }
    return false;
  }
  // signal: returns the process that was unblocked, or null if nobody was waiting
  function semSignalOp(sem, pick) {
    sem.v += 1;
    if (sem.v <= 0 && sem.q.length) {
      const i = pick ? pick(sem.q.length) : 0;
      return sem.q.splice(i, 1)[0];
    }
    return null;
  }
  // plain-language reading of a counting semaphore's value
  function meaning(v) {
    if (v > 0) return `<b>${v}</b> more semWait call${v === 1 ? '' : 's'} can pass without blocking.`;
    if (v === 0) return 'No units left and <b>nobody waiting</b>: the next semWait will block.';
    return `<b>${-v}</b> process${v === -1 ? ' is' : 'es are'} blocked in the queue (the magnitude of ${v}).`;
  }
  // a rounded process token for SVG diagrams
  function token(s, x, y, label, cls, w = 44, h = 44) {
    return s('g', {},
      s('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 10, class: cls || 's-proc', 'stroke-width': 2 }),
      s('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 18 }, label));
  }

  Guide.section({
    id: '5.4',
    title: 'Semaphores',
    short: 'Semaphores',
    summary: 'A semaphore is a counter with wait and signal operations that lets processes block, wake and take turns.',
    objectives: [
      'Define a semaphore and trace exactly what semWait and semSignal do to its value and its queue.',
      'Read a semaphore\'s value, and tell counting semaphores, binary semaphores, mutexes, and strong versus weak semaphores apart.',
      'Use one semaphore to enforce mutual exclusion and others to pass signals between producers and consumers.',
      'Solve the producer/consumer problem for infinite and bounded buffers, and explain why the order of semWait calls matters.',
      'Explain why semWait and semSignal must be atomic and how compare_and_swap or disabling interrupts makes them so.',
    ],
    terms: [
      ['Semaphore', 'A shared integer variable that processes may touch only through three operations: initialize, semWait and semSignal. Processes use it to wait for, and to send, simple signals.'],
      ['semWait', 'The semaphore operation that subtracts 1 from the value. If the result is negative, the calling process is blocked and placed in the semaphore\'s queue.'],
      ['semSignal', 'The semaphore operation that adds 1 to the value. If the result is zero or negative, one process waiting in the semaphore\'s queue is unblocked.'],
      ['Binary semaphore', 'A semaphore that can only hold 0 or 1. Its operations are usually written semWaitB and semSignalB.'],
      ['Counting semaphore (general semaphore)', 'A semaphore whose value can be any integer, so it can count available units of a resource and, when negative, how many processes are waiting.'],
      ['Mutex', 'A lock that behaves like a binary semaphore with one extra rule: the process that locked it (set it to 0) is the only one allowed to unlock it (set it to 1).'],
      ['Strong semaphore', 'A semaphore that releases blocked processes in first-in, first-out order, so the longest waiter goes first and no waiter can starve.'],
      ['Weak semaphore', 'A semaphore that does not say which blocked process is released next, so an unlucky process could be passed over again and again.'],
      ['Starvation', 'A situation in which a process is overlooked indefinitely, even though other processes keep making progress.'],
      ['Critical section', 'A piece of code that uses a shared resource. While one process is inside it, no other process may be inside a critical section for that same resource.'],
      ['Mutual exclusion', 'The guarantee that while one process is inside a critical section for a resource, no other process is inside a critical section for that same resource.'],
      ['Producer/consumer problem', 'A classic coordination problem: producers put items into a shared buffer and consumers take them out; the buffer must never be corrupted, over-filled, or read when empty.'],
      ['Bounded buffer', 'A buffer with a fixed number of slots, usually reused in a circle; a producer must wait when every slot is full.'],
      ['Deadlock', 'A permanent standstill in which every process in a group is waiting (blocked or spinning) for something that only another waiting member of the group can provide.'],
      ['Atomic operation', 'An operation that happens as one indivisible unit: no other process can run in the middle of it or see it half-done.'],
      ['Busy waiting', 'Waiting by running a loop that keeps testing a condition, which burns processor time instead of sleeping.'],
      ['Spinlock', 'A lock where a process that finds it taken busy-waits (spins) in a loop until the lock becomes free.'],
      ['Condition variable', 'A named queue that a process joins to wait until some condition about shared data becomes true; another process signals it when that happens.'],
      ['Monitor', 'A programming-language construct that packages shared data with the only procedures allowed to use it, and lets just one process be active inside at a time.'],
      ['Message passing (mailbox)', 'Coordination by sending and receiving messages. A mailbox is a shared place where messages wait until a receiver collects them.'],
    ],
    css: `
      .sec-5-4 .tool-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .sec-5-4 .tool-grid .btn { justify-content: flex-start; height: 40px; }
      .sec-5-4 .pcard { border: 2px solid var(--proc); background: var(--proc-bg); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .sec-5-4 .pcard.blocked { border-color: var(--warn); background: var(--warn-bg); }
      .sec-5-4 .pcard .nm { font-weight: 900; font-size: 20px; line-height: 1; }
      .sec-5-4 .pcard > .row { min-height: 24px; flex-wrap: nowrap; }
      .sec-5-4 .pcard .st { font-size: 13px; font-weight: 700; color: var(--ink-2); }
      .sec-5-4 .pcard .btn { width: 100%; }
      .sec-5-4 .valbig { font-size: 44px; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; }
      .sec-5-4 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 10px 14px; font-size: 15.5px; line-height: 1.45; }
      .sec-5-4 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-5-4 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-5-4 .log { font-size: 13px; }
      .sec-5-4 pre.code.clk { line-height: 1.68; }
      .sec-5-4 pre.code.tight { line-height: 1.38; }
      .sec-5-4 .grid-2 > *, .sec-5-4 .mw0 > * { min-width: 0; }
      .sec-5-4 .flip-face.front { font-size: 19px; }
      .sec-5-4 .flip-face.back { font-size: 15.5px; line-height: 1.45; }
      .sec-5-4 table.trace td { padding: 5px 10px; font-size: 15px; }
      .sec-5-4 table.trace th { padding: 6px 10px; }
      .sec-5-4 pre.code.clk .ln { cursor: pointer; }
      .sec-5-4 pre.code.clk .ln:hover { background: var(--accent-bg); }
      .sec-5-4 pre.code .ln.pick-ok { outline: 2px solid var(--ok); outline-offset: -2px; border-radius: 4px; }
      .sec-5-4 pre.code .ln.pick-bad { outline: 2px dashed var(--bad); outline-offset: -2px; border-radius: 4px; }
    `,
    steps: [
      /* ---------------- 1. Big picture ---------------- */
      {
        title: 'Stop here until you get the signal',
        kind: 'story',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:8px">
              <p class="lead m0">When processes share work, one of them often has to stop and wait until another one says “go”.</p>
              <p class="m0">That is the whole idea of this section. Processes can cooperate using nothing more than simple <b>signals</b>: a process can be forced to halt at a chosen point in its code and stay there until a particular signal arrives. However complicated the coordination you need, from “one at a time, please” to “wait until there is data”, it can be built from the right arrangement of such signals.</p>
              <p class="m0">The variable that carries these signals is a <span class="t">semaphore</span>. To send a signal on semaphore <code>s</code> a process calls <code>semSignal(s)</code>; to receive one it calls <code>semWait(s)</code>. If the signal has not been sent yet, the receiver is suspended until it is.</p>
              <div class="callout analogy m0" data-label="Analogy">A bike-share dock shows how many bikes are free. Taking a bike lowers the number; at zero, new riders queue at the dock; each returned bike lets exactly one waiting rider leave. The number is the semaphore's value, taking is semWait, returning is semSignal.</div>
              <div class="row gap-s small"><span class="chip os">run a semaphore by hand</span><span class="chip proc">trace values and queues</span><span class="chip mem">fix a buggy buffer</span><span class="chip intr">cause a deadlock on purpose</span></div>
            </div>
            <div class="card stack" style="gap:10px">
              <h4 class="m0">The concurrency toolbox</h4>
              <p class="small muted m0">Operating systems and programming languages offer a family of related tools. Click one to see what it is and where you meet it.</p>
              <div class="tool-grid"></div>
              <div class="card white grow tool-detail" style="display:flex;flex-direction:column;gap:6px"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const tools = [
            ['Semaphore', 'semaphore', 'os', 'An integer shared by processes that can only be initialized, decremented by semWait and incremented by semSignal. A process whose semWait drives the value below zero is blocked until a semSignal releases it.', 'This section.'],
            ['Binary semaphore', 'binary semaphore', 'os', 'A semaphore that only ever holds 0 or 1. That is enough for “one at a time” locking and for simple on/off signals.', 'This section.'],
            ['Mutex', 'mutex', 'os', 'A lock that behaves much like a binary semaphore, plus an ownership rule: only the process that locked it may unlock it. The rule catches bugs where some other process releases a lock it never held.', 'This section (try it in the playground).'],
            ['Condition variable', 'condition variable', 'proc', 'A named waiting line tied to a condition about shared data, such as “buffer not empty”. A process waits on it until another process signals that the condition may now hold.', 'Section 5.5, inside monitors.'],
            ['Monitor', 'monitor', 'proc', 'A language construct that wraps shared data together with the only procedures allowed to touch it, and lets just one process be active inside at a time. Condition variables live inside it.', 'Section 5.5.'],
            ['Event flags', null, 'io', 'A memory word in which each bit stands for one event. A process can wait until one chosen flag, or any or all of a group of flags, has been set by someone else; until then it is blocked.', 'Common in real-time and embedded systems; only introduced here.'],
            ['Mailboxes / messages', 'message passing', 'mem', 'Processes exchange information by sending messages; a mailbox holds messages until a receiver collects them. Because a receiver can wait for a message to arrive, messages also synchronize.', 'Section 5.6 (message passing).'],
            ['Spinlock', 'spinlock', 'intr', 'A lock where a waiting process loops, testing a variable over and over until the lock frees up. Wasteful for long waits, but cheap when the wait lasts only a few instructions.', 'Section 5.3 builds one from compare_and_swap.'],
          ];
          const grid = ctx.$('.tool-grid'), detail = ctx.$('.tool-detail');
          const btns = tools.map((t, i) => h('button', { class: 'btn ' + t[2], type: 'button', onclick: () => show(i) }, t[0]));
          grid.append(...btns);
          function show(i) {
            const [name, term, cls, desc, where] = tools[i];
            btns.forEach((b, j) => b.classList.toggle('on', i === j));
            detail.innerHTML = '';
            detail.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },
                h('b', { style: { fontSize: '19px' }, html: term ? `<span class="t" data-t="${term}">${name}</span>` : name }),
                h('span', { class: 'chip ' + cls }, 'tool ' + (i + 1) + ' of ' + tools.length)),
              h('p', { class: 'm0', style: { fontSize: '15.5px' } }, desc),
              h('p', { class: 'small muted m0', style: { marginTop: 'auto' } }, h('b', {}, 'Where: '), where));
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');
          }
          show(0);
        },
      },

      /* ---------------- 2. Definition: value + three operations ---------------- */
      {
        title: 'One integer, three operations',
        kind: 'learn',
        render(el, ctx) {
          const { h, s } = ctx;
          const src = `
struct semaphore {              // one semaphore object
    int count;                  // its integer value
    queueType queue;            // processes blocked on it
};                              // end of the structure
semaphore s = 2;                // 1) initialize (any value ≥ 0)
void semWait(semaphore s) {     // 2) "may I continue?"
    s.count--;                  // always take one unit
    if (s.count < 0) {          // negative: nothing was left
        place this process in s.queue; // join the line
        block this process;     // sleep until released
    }                           // (else: carry straight on)
}                               // end of semWait
void semSignal(semaphore s) {   // 3) "one unit is free again"
    s.count++;                  // always give one unit back
    if (s.count <= 0) {         // still ≤ 0: someone waits
        remove a process P from s.queue; // pick a waiter
        place P on the ready list;  // P may run again later
    }                           // (else: nobody to wake)
}                               // end of semSignal`;
          const notes = [
            'A semaphore is a tiny data structure owned by the operating system (or a thread library). Processes never touch its fields directly; they may only call the three operations below.',
            'The integer value. Positive means units (permissions, items, free slots) are available; negative means processes are waiting.',
            'The processes currently blocked on this semaphore. They use no processor time: they are asleep until a semSignal releases one of them.',
            'End of the structure: just a number and a waiting line.',
            '<b>Operation 1: initialize.</b> The value must start at zero or more. Start at 1 for “one at a time”, at N for “N identical resources”, at 0 for “wait until somebody signals”.',
            '<b>Operation 2: semWait.</b> A process calls it when it may continue only if a unit is available.',
            'The decrement happens <b>every</b> time, whether or not the caller will block. That is exactly why a negative value ends up counting the waiters.',
            'If the value is now below zero, there was no unit to take, so the caller cannot continue.',
            'The caller is recorded in the semaphore’s queue so that a later semSignal can find it.',
            'The OS moves the caller to the Blocked state and runs some other process. The caller uses no CPU while it waits: there is no busy waiting.',
            'If the value was still zero or more, the caller simply continues with its next statement.',
            'End of semWait. Its caller either continues at once or sleeps here.',
            '<b>Operation 3: semSignal.</b> A process calls it to say “one unit is available again”: it released a lock, produced an item or freed a slot.',
            'The increment happens every time.',
            'If the value is still zero or below after adding 1, it was negative before, which means at least one process is waiting.',
            'One waiter leaves the queue. Which one depends on the policy: first-in-first-out for a <span class="t">strong semaphore</span>, unspecified for a weak one.',
            'P becomes Ready. Its semWait is now finished, and it continues after that call when the scheduler gives it the CPU. The caller of semSignal keeps running too.',
            'If the value came out positive, nobody was waiting; the extra unit is simply remembered in the count.',
            'End of semSignal. The caller never blocks inside semSignal.',
          ];
          const code = ctx.ui.code(src, { lang: 'c', fontSize: 13.5 });
          code.classList.add('clk');
          const lnTitle = h('div', { class: 'row gap-s' });
          const lnText = h('div', { class: 'mono small', style: { background: 'var(--panel-3)', borderRadius: '8px', padding: '6px 10px', whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis' } });
          const lnNote = h('p', { class: 'm0', style: { fontSize: '16px' } });
          let cur = 5;
          const lines = String(src).replace(/^\n+|\s+$/g, '').split('\n');
          let tabs = null;
          function pick(n) {
            cur = ctx.util.clamp(n, 1, lines.length);
            code.mark(cur);
            const kind = cur <= 4 ? ['data', 'mem'] : cur === 5 ? ['initialize', 'ok'] : cur <= 12 ? ['semWait', 'proc'] : ['semSignal', 'intr'];
            lnTitle.innerHTML = `<span class="chip">line ${cur} of ${lines.length}</span><span class="chip ${kind[1]}">${kind[0]}</span>`;
            lnText.textContent = lines[cur - 1].split('//')[0].trim();
            lnNote.innerHTML = notes[cur - 1];
          }
          code.querySelectorAll('.ln').forEach((ln, i) => ln.addEventListener('click', () => { if (tabs) tabs.show(0); pick(i + 1); }));
          const tabLine = h('div', { class: 'stack', style: { gap: '10px' } },
            lnTitle, lnText, lnNote,
            h('div', { class: 'row', style: { marginTop: '4px' } },
              h('button', { class: 'btn sm', type: 'button', onclick: () => pick(cur - 1) }, '◀ Previous line'),
              h('button', { class: 'btn sm primary', type: 'button', onclick: () => pick(cur + 1) }, 'Next line ▶')),
            h('div', { class: 'callout tip small m0', 'data-label': 'Tip' }, 'Click any line of the code to jump to it.'),
            h('div', { class: 'callout why small m0', 'data-label': 'Why a queue instead of a loop?', html: 'A blocked process sleeps and costs nothing until it is released. A process that kept re-testing the value in a loop (<span class="t">busy waiting</span>) would burn processor time for the whole wait, time the process it is waiting for could have used.' }));
          // tab 2: reading the value
          const nl = s('svg', { viewBox: '0 0 440 170', width: '100%' });
          const vText = h('p', { class: 'm0', style: { fontSize: '16px', minHeight: '48px' } });
          let v = 2;
          function drawValue() {
            const X = (k) => 40 + (k + 3) * 60;
            const kids = [s('line', { x1: 25, y1: 50, x2: 415, y2: 50, class: 's-line' })];
            for (let k = -3; k <= 3; k++) {
              kids.push(s('line', { x1: X(k), y1: 42, x2: X(k), y2: 58, class: 's-line' }));
              kids.push(s('text', { x: X(k), y: 80, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': k === v ? 800 : 500 }, String(k)));
            }
            kids.push(s('path', { d: `M${X(v)} 40 l-9 -16 h18 z`, class: v > 0 ? 's-ok' : v < 0 ? 's-warn' : 's-accent', 'stroke-width': 2 }));
            kids.push(s('text', { x: 40, y: 20, class: 's-sub', 'font-size': 13 }, '← processes waiting'), s('text', { x: 400, y: 20, class: 's-sub', 'font-size': 13, 'text-anchor': 'end' }, 'units free →'));
            if (v > 0) for (let k = 0; k < v; k++) kids.push(s('circle', { cx: 220 - (v - 1) * 26 + k * 52, cy: 132, r: 20, class: 's-ok', 'stroke-width': 2 }), s('text', { x: 220 - (v - 1) * 26 + k * 52, y: 138, 'text-anchor': 'middle', 'font-weight': 800 }, '✓'));
            else if (v < 0) for (let k = 0; k < -v; k++) kids.push(token(s, 220 - (-v - 1) * 28 + k * 56, 132, 'P' + (k + 1), 's-warn', 46, 40));
            else kids.push(s('text', { x: 220, y: 138, 'text-anchor': 'middle', class: 's-sub', 'font-size': 15 }, 'no free units · empty queue'));
            nl.replaceChildren(...kids);
            vText.innerHTML = meaning(v);
          }
          const vs = ctx.ui.slider({ label: 'Suppose the value is', min: -3, max: 3, value: v, onInput: (x) => { v = x; drawValue(); } });
          const tabValue = h('div', { class: 'stack', style: { gap: '8px' } }, vs, nl, vText,
            h('p', { class: 'small muted m0' }, 'Rule of thumb: a positive value counts how many more processes may call semWait and continue; a negative value’s magnitude counts the processes blocked in the queue.'));
          tabs = ctx.ui.tabs([
            { label: 'What this line does', render: (p) => { p.append(tabLine); } },
            { label: 'Reading the value', render: (p) => { p.append(tabValue); drawValue(); } },
            { label: 'Three consequences', html: `<div class="stack" style="gap:10px">
              <ol class="m0" style="font-size:15.5px;line-height:1.45">
                <li><b>No peeking.</b> Before it calls semWait, a process cannot know whether it will block. It has no way to read the count first and decide.</li>
                <li><b>After a wake-up, both carry on.</b> When semSignal releases a waiter, the signaller and the woken process both continue concurrently. Nothing says which runs first; on one processor the scheduler decides.</li>
                <li><b>A signal is not a receipt.</b> A process calling semSignal learns nothing about whether anyone was waiting: it may have woken one process or none.</li>
              </ol>
              <div class="callout warn small m0" data-label="Common mistake">Thinking semSignal wakes <i>every</i> waiter or hands the CPU straight to one. It releases at most one process and only moves it to Ready.</div>
              <div class="callout why small m0" data-label="Why it matters">Correct semaphore code therefore never depends on which process runs first after a signal, and never tries to test the value directly. The only questions it may ask are “wait” and “signal”.</div></div>` },
          ]);
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 590px) minmax(0, 1fr)' } },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'A <span class="t">semaphore</span> is an integer that processes may touch in only three ways: <b>initialize</b> it, <span class="t">semWait</span> on it, or <span class="t">semSignal</span> it.' }),
              code),
            h('div', { class: 'stack fill' }, tabs)));
          pick(5);
        },
      },

      /* ---------------- 3. Playground ---------------- */
      {
        title: 'Semaphore playground: you drive four processes',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const names = ['A', 'B', 'C', 'D'];
          const OPS = { counting: ['semWait', 'semSignal'], binary: ['semWaitB', 'semSignalB'], mutex: ['lock', 'unlock'] };
          const rng = ctx.util.seeded(11);
          let mode = 'counting', policy = 'strong', init = 1, sem, procs, owner;
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 330' : '0 0 660 196', width: '100%' });
          const cards = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${ctx.narrow ? 2 : 4}, minmax(0, 1fr))`, gap: '10px' } });
          const narr = h('div', { class: 'narr' });
          const mean = h('div', { class: 'small', style: { minHeight: '42px' } });
          const log = h('div', { class: 'log grow', style: { minHeight: '60px' } });
          const rules = h('div', { class: 'card tight small', style: { lineHeight: 1.45 } });
          const RULES = {
            counting: '<b>Rules of a <span class="t" data-t="counting semaphore">counting semaphore</span>.</b> semWait: value − 1; if the result is negative, the caller blocks. semSignal: value + 1; if the result is ≤ 0, one waiter is released.',
            binary: '<b>Rules of a binary semaphore.</b> semWaitB: if the value is 1, set it to 0 and go on; if it is 0, block. semSignalB: if someone is blocked, release one (the value stays 0); otherwise set the value to 1.',
            mutex: '<b>Rules of a mutex.</b> lock: like semWaitB, and the caller becomes the <b>owner</b>. unlock: allowed only for the owner; it hands the lock to one released waiter, or sets the value back to 1.',
          };
          const semName = () => (mode === 'mutex' ? 'mutex m' : mode === 'binary' ? 'binary semaphore s' : 'semaphore s');
          function say(html, tone) { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; }
          function logLine(txt) { log.prepend(h('div', {}, txt)); while (log.children.length > 40) log.lastChild.remove(); }
          function reset(msg) {
            sem = { v: mode === 'mutex' ? 1 : init, q: [] }; owner = null;
            procs = names.map((n) => ({ n, blocked: false }));
            log.innerHTML = '';
            logLine(`start: ${semName()} = ${sem.v}`);
            say(msg || `Reset. The ${semName()} starts at <b>${sem.v}</b>. Pick a process and make it call an operation.`);
            draw();
          }
          const pickFn = () => (policy === 'strong' ? () => 0 : (n) => Math.floor(rng() * n));
          function wake(n) { procs.find((p) => p.n === n).blocked = false; }
          function skipNote(w, longest) {
            if (policy === 'strong') return ' (strong semaphore: the longest waiter goes first).';
            if (w !== longest) return `. <b>${longest}</b> had waited longest but was passed over; with a weak semaphore that can happen again and again, which is <span class="t">starvation</span>.`;
            return ' (weak semaphore: this time the pick happened to be the longest waiter).';
          }
          function doWait(p) {
            const old = sem.v, W = OPS[mode][0];
            if (mode === 'counting') {
              if (semWaitOp(sem, p.n)) { p.blocked = true; say(`<b>${p.n}</b> calls ${W}(s): value ${old} → <b>${sem.v}</b>. The result is negative, so ${p.n} <b>blocks</b> and joins the queue in position ${sem.q.length}. Its buttons grey out: it sleeps inside ${W} until another process signals.`, 'bad'); }
              else say(`<b>${p.n}</b> calls ${W}(s): value ${old} → <b>${sem.v}</b>. Still zero or more, so ${p.n} <b>continues</b> at once.`, 'ok');
            } else if (sem.v === 1) {
              sem.v = 0; if (mode === 'mutex') owner = p.n;
              say(`<b>${p.n}</b> calls ${W}: the value was 1, so it becomes <b>0</b> and ${p.n} continues${mode === 'mutex' ? ` as the <b>owner</b> of the mutex` : ''}.`, 'ok');
            } else {
              sem.q.push(p.n); p.blocked = true;
              const self = mode === 'mutex' && owner === p.n;
              say(self ? `<b>${p.n}</b> already owns the mutex and locks it again, so it blocks <b>waiting for itself</b>. Nobody else is allowed to unlock it: ${p.n} is stuck for good.`
                : `<b>${p.n}</b> calls ${W}: the value is 0, so ${p.n} <b>blocks</b>. A ${mode === 'mutex' ? 'mutex' : 'binary semaphore'} never goes below 0; the queue alone remembers the waiters.`, 'bad');
            }
            logLine(`${p.n}: ${W} → ${sem.v}${p.blocked ? '  (' + p.n + ' blocked)' : ''}`);
          }
          function doSignal(p) {
            const old = sem.v, S = OPS[mode][1], longest = sem.q[0];
            if (mode === 'counting') {
              const w = semSignalOp(sem, pickFn());
              if (w) { wake(w); say(`<b>${p.n}</b> calls ${S}(s): value ${old} → <b>${sem.v}</b>. Still zero or below, so one waiter is released: <b>${w}</b> moves to Ready${skipNote(w, longest)} ${p.n} keeps running too.`, 'ok'); }
              else say(`<b>${p.n}</b> calls ${S}(s): value ${old} → <b>${sem.v}</b>. Positive, so nobody was waiting; the spare unit is simply remembered in the count.`);
              logLine(`${p.n}: ${S} → ${sem.v}${w ? '  (' + w + ' woken)' : ''}`);
              return;
            }
            if (mode === 'mutex' && owner !== p.n) {
              say(owner ? `<b>Refused.</b> ${p.n} tries to unlock, but <b>${owner}</b> locked the mutex, and only the owner may unlock it. (A plain binary semaphore would have allowed this.)` : `<b>Refused.</b> The mutex is not locked, so there is nothing for ${p.n} to unlock.`, 'bad');
              logLine(`${p.n}: unlock refused`);
              return;
            }
            let w = null;
            if (sem.q.length) { w = sem.q.splice(pickFn()(sem.q.length), 1)[0]; wake(w); if (mode === 'mutex') owner = w; }
            else if (sem.v === 0) { sem.v = 1; if (mode === 'mutex') owner = null; }
            if (w) say(`<b>${p.n}</b> calls ${S}: a process is waiting, so the value stays <b>0</b> and <b>${w}</b> is released${mode === 'mutex' ? ' and becomes the new owner' : ''}${skipNote(w, longest)}`, 'ok');
            else if (old === 1) say(`<b>${p.n}</b> calls ${S}: the value was already 1, so it <b>stays 1</b>. A binary semaphore cannot count two signals: the extra one is lost.`, 'bad');
            else say(`<b>${p.n}</b> calls ${S}: nobody is waiting, so the value becomes <b>1</b>${mode === 'mutex' ? ' and the mutex is free again' : ''}.`);
            logLine(`${p.n}: ${S} → ${sem.v}${w ? '  (' + w + ' woken)' : ''}`);
          }
          function act(p, isWait) {
            if (p.blocked) return;
            if (isWait) doWait(p); else doSignal(p);
            if (procs.every((x) => x.blocked)) say('All four processes are <b>blocked</b>. Nobody is left to call a signal operation, so they will sleep forever. Press <b>Reset</b>.', 'bad');
            draw();
          }
          // layout: side by side on a wide canvas, stacked (value above queue) on phones so the labels stay readable
          const G = ctx.narrow
            ? { nm: [180, 18], box: [100, 28, 160, 110], val: [180, 102, 56], lab: [180, 128], own: [180, 160], arrow: null, qt: [180, 190], qbox: [6, 200, 348, 104], qx: (k) => 50 + k * 87, qy: 246, qs: 66, ord: 294, none: [180, 322] }
            : { nm: [110, 20], box: [16, 30, 188, 132], val: [110, 112, 60], lab: [110, 146], own: [110, 186], arrow: [208, 96, 246, 96], qt: [450, 20], qbox: [252, 30, 396, 132], qx: (k) => 300 + k * 96, qy: 90, qs: 70, ord: 148, none: [450, 186] };
          function draw() {
            const kids = [];
            kids.push(s('text', { x: G.nm[0], y: G.nm[1], 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 15 }, semName()));
            kids.push(s('rect', { x: G.box[0], y: G.box[1], width: G.box[2], height: G.box[3], rx: 16, class: 's-os', 'stroke-width': 2.5 }));
            kids.push(s('text', { x: G.val[0], y: G.val[1], 'text-anchor': 'middle', 'font-weight': 900, 'font-size': G.val[2], style: `fill:var(${sem.v < 0 ? '--warn' : sem.v > 0 ? '--ok' : '--os'})` }, String(sem.v)));
            kids.push(s('text', { x: G.lab[0], y: G.lab[1], 'text-anchor': 'middle', class: 's-sub', 'font-size': 14 }, 'value'));
            if (mode === 'mutex') kids.push(s('text', { x: G.own[0], y: G.own[1], 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, 'owner: ' + (owner || 'none')));
            if (G.arrow) kids.push(s('line', { x1: G.arrow[0], y1: G.arrow[1], x2: G.arrow[2], y2: G.arrow[3], class: 's-line', 'marker-end': 'url(#arr)' }));
            kids.push(s('text', { x: G.qt[0], y: G.qt[1], 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 15 }, policy === 'strong' ? 'blocked queue (strong: first in, first out)' : (ctx.narrow ? 'blocked (weak: any order)' : 'blocked processes (weak: released in any order)')));
            kids.push(s('rect', { x: G.qbox[0], y: G.qbox[1], width: G.qbox[2], height: G.qbox[3], rx: 16, class: 's-panel', 'stroke-width': 2 }));
            for (let k = 0; k < 4; k++) {
              const x = G.qx(k), n = sem.q[k], hs = G.qs / 2;
              if (n) kids.push(token(s, x, G.qy, n, 's-warn', G.qs, G.qs));
              else kids.push(s('rect', { x: x - hs, y: G.qy - hs, width: G.qs, height: G.qs, rx: 10, class: 's-muted', 'stroke-dasharray': '5 5' }));
              if (policy === 'strong') kids.push(s('text', { x, y: G.ord, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 }, k === 0 ? 'front' : ['', '2nd', '3rd', '4th'][k]));
            }
            if (!sem.q.length) kids.push(s('text', { x: G.none[0], y: G.none[1], 'text-anchor': 'middle', class: 's-sub', 'font-size': 14 }, 'nobody is waiting'));
            svg.replaceChildren(...kids);
            cards.replaceChildren(...procs.map((p) => h('div', { class: 'pcard' + (p.blocked ? ' blocked' : '') },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'nm' }, p.n), owner === p.n ? h('span', { class: 'chip os' }, 'owner') : null),
              h('div', { class: 'st', title: p.blocked ? 'Asleep inside its wait call: it can do nothing until another process signals.' : null }, p.blocked ? 'Blocked: asleep' : 'Running or Ready'),
              h('button', { class: 'btn sm', type: 'button', disabled: p.blocked, onclick: () => act(p, true) }, OPS[mode][0]),
              h('button', { class: 'btn sm', type: 'button', disabled: p.blocked, onclick: () => act(p, false) }, OPS[mode][1]))));
            if (mode === 'counting') mean.innerHTML = '<b>Right now:</b> ' + meaning(sem.v);
            else mean.innerHTML = `<b>Right now:</b> ${sem.v === 1 ? '1 means open: the next ' + OPS[mode][0] + ' passes.' : '0 means closed: the next ' + OPS[mode][0] + ' blocks.'} ${sem.q.length ? sem.q.length + ' waiting.' : 'Nobody waiting.'}`;
            if (rules.dataset.mode !== mode) { rules.dataset.mode = mode; rules.innerHTML = RULES[mode]; }
          }
          const initSl = ctx.ui.slider({ label: 'Start value', min: 0, max: 3, value: init, onInput: (v) => { init = v; reset(); } });
          initSl.style.minWidth = '230px';
          const modeSeg = ctx.ui.seg([{ value: 'counting', label: 'Counting' }, { value: 'binary', label: 'Binary' }, { value: 'mutex', label: 'Mutex' }], mode, (v) => {
            mode = v;
            initSl.input.max = mode === 'counting' ? 3 : 1;
            if (mode !== 'counting' && init > 1) { init = 1; initSl.set(1); }
            if (mode === 'mutex') initSl.set(1);
            initSl.input.disabled = mode === 'mutex';
            reset(mode === 'mutex' ? 'A <span class="t">mutex</span> always starts unlocked (1). Whoever locks it becomes its owner, and only the owner may unlock it.' : mode === 'binary' ? 'A <span class="t">binary semaphore</span> holds only 0 or 1. Try signalling twice with nobody waiting.' : null);
          });
          const polSeg = ctx.ui.seg([{ value: 'strong', label: 'Strong (FIFO)' }, { value: 'weak', label: 'Weak (any order)' }], policy, (v) => {
            policy = v;
            say(v === 'strong' ? '<span class="t">Strong semaphore</span>: waiters are released in the order they arrived, so nobody can be skipped forever.' : '<span class="t">Weak semaphore</span>: the order of release is unspecified (this simulation picks at random). Block three processes, then signal and watch who wakes.');
            draw();
          });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { gap: '14px' } }, h('span', { class: 'small b' }, 'Type'), modeSeg, h('span', { class: 'small b' }, 'Wake order'), polSeg, initSl,
              h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset')),
            h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: '18px' } },
              h('div', { class: 'stack', style: { gap: '10px' } }, h('div', { class: 'card white tight' }, svg), cards, log),
              h('div', { class: 'stack', style: { gap: '10px' } },
                h('h4', { class: 'm0' }, 'What just happened'), narr, mean, rules,
                h('div', { class: 'card tight small' }, h('b', {}, 'Try these'),
                  h('ol', { class: 'm0', style: { paddingLeft: '20px' } },
                    h('li', {}, 'Counting, start 1: block three processes. What is the value?'),
                    h('li', {}, 'Now signal three times. Who wakes, in what order?'),
                    h('li', {}, 'Weak: repeat 1 and 2. Is the longest waiter ever skipped?'),
                    h('li', {}, 'Binary: signal twice with nobody waiting.'),
                    h('li', {}, 'Mutex: let A lock, then let B try to unlock.')))))));
          reset();
        },
      },

      /* ---------------- 4. Predict the trace: one producer, three consumers ---------------- */
      {
        title: 'Predict the trace: one producer, three consumers',
        kind: 'predict',
        render(el, ctx) {
          const { h, s } = ctx;
          // D produces results (each semSignal announces one); A, B, C consume them (each semWait claims one). s starts at 1.
          const PRODUCER = 'D';
          const ops = [['A', 'W'], ['B', 'W'], ['D', 'S'], ['C', 'W'], ['A', 'W'], ['B', 'W'], ['D', 'S'], ['D', 'S'], ['D', 'S'], ['D', 'S']];
          const says = [
            'A takes the result that was already there: 1 → 0. Zero is not negative, so A continues (and later goes back to the ready queue).',
            'B wants a result, but none is left: 0 → −1. Negative, so B <b>blocks</b>. The −1 says one process is waiting, and D now gets the CPU.',
            'D finishes a new result and signals: −1 → 0. The result is still ≤ 0, which means a waiter exists: <b>B is released</b> to Ready and will use the new result.',
            'C wants a result: 0 → −1. Nothing is spare, so C blocks.',
            'A comes back for more: −1 → −2. A blocks behind C.',
            'B asks again: −2 → −3. Three consumers are asleep, and the magnitude 3 is exactly the queue length. Only D can run now.',
            'D signals: −3 → −2. The front of the queue, <b>C</b>, is released (strong semaphore: first in, first out).',
            'D signals again: −2 → −1. <b>A</b> is released.',
            'D signals again: −1 → 0. <b>B</b> is released and the queue is empty.',
            'D signals once more: 0 → 1. Nobody is waiting, so the result is <b>saved in the count</b>. The next consumer to call semWait will pass straight through.',
          ];
          // simulate so every number shown is computed, not typed
          const states = [{ v: 1, q: [] }];
          { const sem = { v: 1, q: [] }; ops.forEach(([p, o]) => { if (o === 'W') semWaitOp(sem, p); else semSignalOp(sem); states.push({ v: sem.v, q: sem.q.slice() }); }); }
          let r = 0, guesses = [];
          const tbody = h('tbody');
          const prompt = h('div', { class: 'b', style: { fontSize: '17px', minHeight: '26px' } });
          const choices = h('div', { class: 'row gap-s' });
          const narr = h('div', { class: 'narr', style: { minHeight: '92px' } });
          const score = h('span', { class: 'chip accent' });
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 256' : '0 0 520 250', width: '100%' });
          const opText = (i) => `${ops[i][0]} calls ${ops[i][1] === 'W' ? 'semWait(s)' : 'semSignal(s)'}`;
          function drawTable() {
            const rows = [h('tr', {}, h('td', {}, '0'), h('td', {}, 'start (one result is waiting)'), h('td', {}, '—'), h('td', { class: 'b mono' }, '1'), h('td', { class: 'mono' }, '—'))];
            ops.forEach((o, i) => {
              const done = i < r, g = guesses[i];
              const gCell = !done ? '' : g == null ? h('span', { class: 'muted' }, 'shown') : h('span', { class: 'chip ' + (g === states[i + 1].v ? 'ok' : 'bad') }, (g === states[i + 1].v ? '✓ ' : '✗ ') + g);
              rows.push(h('tr', { class: i === r ? 'on' : '' },
                h('td', {}, String(i + 1)),
                h('td', { class: 'mono', style: { color: o[0] === PRODUCER ? 'var(--mem)' : 'var(--proc)', fontWeight: 700 } }, opText(i)),
                h('td', {}, gCell),
                h('td', { class: 'b mono' }, done ? String(states[i + 1].v) : '?'),
                h('td', { class: 'mono' }, done ? (states[i + 1].q.join(' ') || '—') : '')));
            });
            tbody.replaceChildren(...rows);
          }
          // wide and phone layouts share one drawing; only the coordinates change
          const D = ctx.narrow
            ? { px: (k) => 45 + k * 90, tk: 56, ty: 44, role: 96, state: 114, box: [6, 132, 104, 100], eq: 152, val: [58, 210, 42], qt: [122, 150], qx: (k) => 152 + k * 64, qy: 192, qw: 54, cnt: [240, 248] }
            : { px: (k) => 70 + k * 125, tk: 62, ty: 50, role: 108, state: 126, box: [10, 146, 130, 96], eq: 168, val: [75, 222, 46], qt: [160, 164], qx: (k) => 192 + k * 72, qy: 206, qw: 56, cnt: [420, 212] };
          function drawDiagram() {
            const st = states[r], next = r < ops.length ? ops[r][0] : null;
            const kids = [];
            ['A', 'B', 'C', 'D'].forEach((n, k) => {
              const x = D.px(k), blocked = st.q.includes(n), hl = D.tk / 2 + 8;
              const cls = blocked ? 's-warn' : n === PRODUCER ? 's-mem' : 's-proc';
              if (n === next) kids.push(s('rect', { x: x - hl, y: D.ty - hl, width: 2 * hl, height: 2 * hl, rx: 16, class: 's-accent', 'stroke-width': 3 }));
              kids.push(token(s, x, D.ty, n, cls, D.tk, D.tk));
              kids.push(s('text', { x, y: D.role, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, n === PRODUCER ? 'producer' : 'consumer'));
              kids.push(s('text', { x, y: D.state, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, style: blocked ? 'fill:var(--warn)' : '' }, blocked ? 'blocked' : n === next ? 'acts next' : 'ready'));
            });
            kids.push(s('rect', { x: D.box[0], y: D.box[1], width: D.box[2], height: D.box[3], rx: 14, class: 's-os', 'stroke-width': 2 }));
            kids.push(s('text', { x: D.val[0], y: D.eq, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 's ='));
            kids.push(s('text', { x: D.val[0], y: D.val[1], 'text-anchor': 'middle', 'font-size': D.val[2], 'font-weight': 900 }, String(st.v)));
            kids.push(s('text', { x: D.qt[0], y: D.qt[1], 'font-size': 14, class: 's-sub' }, ctx.narrow ? 'blocked queue (front at left)' : 'blocked queue (front on the left)'));
            for (let k = 0; k < 3; k++) {
              const x = D.qx(k);
              if (st.q[k]) kids.push(token(s, x, D.qy, st.q[k], 's-warn', D.qw, 52));
              else kids.push(s('rect', { x: x - D.qw / 2, y: D.qy - 26, width: D.qw, height: 52, rx: 10, class: 's-muted', 'stroke-dasharray': '4 4' }));
            }
            kids.push(s('text', { x: D.cnt[0], y: D.cnt[1], 'font-size': 15, 'font-weight': 700, 'text-anchor': 'middle' }, st.v > 0 ? st.v + ' spare result' + (st.v > 1 ? 's' : '') : st.v === 0 ? 'none spare' : -st.v + ' waiting'));
            svg.replaceChildren(...kids);
          }
          function drawPrompt() {
            const right = guesses.filter((g, i) => g != null && g === states[i + 1].v).length;
            score.textContent = `${right} of ${r} correct`;
            if (r >= ops.length) {
              prompt.innerHTML = 'Trace complete.';
              choices.replaceChildren(h('button', { class: 'btn sm primary', type: 'button', onclick: restart }, 'Start again'));
              return;
            }
            prompt.innerHTML = `Row ${r + 1}: ${opText(r)}. What is <span class="mono">s</span> now?`;
            choices.replaceChildren(...[-3, -2, -1, 0, 1, 2].map((v) => h('button', { class: 'btn sm', type: 'button', style: { minWidth: '44px' }, onclick: () => answer(v) }, String(v))),
              h('button', { class: 'btn sm ghost', type: 'button', onclick: () => answer(null) }, 'Just show me'));
          }
          function answer(g) {
            if (r >= ops.length) return;
            guesses[r] = g;
            const actual = states[r + 1].v;
            const verdict = g == null ? '' : g === actual ? '<b style="color:var(--ok)">Correct.</b> ' : `<b style="color:var(--bad)">Not quite: s is ${actual}.</b> `;
            narr.className = 'narr' + (g == null ? '' : g === actual ? ' ok' : ' bad');
            narr.innerHTML = verdict + says[r];
            r++;
            paint();
          }
          function restart() { r = 0; guesses = []; narr.className = 'narr'; narr.innerHTML = 'Predict each value before you reveal it. semWait always subtracts 1 and blocks its caller if the result is negative. semSignal always adds 1 and releases the front waiter if the result is ≤ 0 (which means the value was negative).'; paint(); }
          function paint() { drawTable(); drawDiagram(); drawPrompt(); }
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 11fr) minmax(0, 10fr)', gap: '22px' } },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0 small', html: '<b>Setup.</b> Processes <b style="color:var(--proc)">A, B, C</b> each need a result that process <b style="color:var(--mem)">D</b> produces. D announces each new result with <code>semSignal(s)</code>; a consumer claims one with <code>semWait(s)</code>. <code>s</code> starts at 1 because one result is already waiting. It is a <span class="t">strong semaphore</span>, so waiters leave in arrival order.' }),
              h('table', { class: 'tbl trace' }, h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Operation'), h('th', {}, 'Your guess'), h('th', {}, 's'), h('th', {}, 'Queue'))), tbody)),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Your prediction'), score),
              prompt, choices, narr, h('div', { class: 'card white tight grow', style: { display: 'grid', placeItems: 'center' } }, svg))));
          restart();
        },
      },

      /* ---------------- 5. Mutual exclusion with one semaphore ---------------- */
      {
        title: 'Mutual exclusion with a single semaphore',
        kind: 'lab',
        render(el, ctx) {
          const { h, s } = ctx;
          const codeSrc = (v) => `
semaphore s = ${v};          // ${v} = ${v === 1 ? 'room is free' : 'two may enter!'}
void P(int i) {           // A, B and C all run this
    while (true) {        // repeat forever
        semWait(s);       // ask to enter; may block
        /* critical section */  // use the shared data
        semSignal(s);     // leave; wake one waiter
        /* remainder */   // private work
    }                     // end of loop
}                         // end of P
void main() {             // program start
    parbegin (P(1), P(2), P(3)); // run all three
}                         // end of main`;
          let code = ctx.ui.code(codeSrc(1), { lang: 'c', fontSize: 13.5 });
          const names = ['A', 'B', 'C'];
          let init = 1, sem, where, hist, runId = 0;
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 256' : '0 0 600 168', width: '100%' });
          const btnRow = h('div', { class: 'grid-3', style: { gap: '8px' } });
          const histEl = h('div', { class: 'row gap-s', style: { minHeight: '28px' } });
          const narr = h('div', { class: 'narr', style: { minHeight: '70px' } });
          const inv = h('div', { class: 'row gap-s' });
          function reset(msg) {
            sem = { v: init, q: [] }; where = { A: 'rem', B: 'rem', C: 'rem' }; hist = [init];
            if (code.isConnected) { const nc = ctx.ui.code(codeSrc(init), { lang: 'c', fontSize: 13.5 }); code.replaceWith(nc); code = nc; }
            narr.className = 'narr'; narr.innerHTML = msg || `Every process runs the same loop. <code>s</code> starts at <b>${init}</b>. Click a process to run its next statement, or play the classic trace.`;
            paint();
          }
          function act(n) {
            const old = sem.v;
            let msg, tone = '';
            if (where[n] === 'rem') {
              if (semWaitOp(sem, n)) { where[n] = 'blocked'; msg = `<b>${n}</b> calls semWait(s): ${old} → <b>${sem.v}</b>. Negative, so ${n} <b>blocks</b>${cs().length ? ` while ${cs().join(' and ')} ${cs().length > 1 ? 'are' : 'is'} inside` : ''}. ${-sem.v} process${sem.v === -1 ? '' : 'es'} now wait${sem.v === -1 ? 's' : ''}.`; tone = 'bad'; }
              else { where[n] = 'cs'; msg = `<b>${n}</b> calls semWait(s): ${old} → <b>${sem.v}</b>. Not negative, so ${n} <b>enters</b> the critical section.`; }
            } else if (where[n] === 'cs') {
              where[n] = 'rem';
              const w = semSignalOp(sem);
              if (w) { where[w] = 'cs'; msg = `<b>${n}</b> leaves and calls semSignal(s): ${old} → <b>${sem.v}</b>. Still ≤ 0, so the first waiter, <b>${w}</b>, is released. Its semWait is now complete, so ${w} is the one process allowed into the critical section (it enters as soon as it gets the CPU).`; tone = 'ok'; }
              else msg = `<b>${n}</b> leaves and calls semSignal(s): ${old} → <b>${sem.v}</b>. Nobody was waiting${sem.v === init ? ', so the room is completely free again' : ''}.`;
            } else return;
            hist.push(sem.v);
            if (cs().length > 1) { msg += ` <b>Two processes are inside at once: mutual exclusion is broken</b>, because s started at ${init}.`; tone = 'bad'; }
            narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = msg;
            paint();
          }
          const cs = () => names.filter((n) => where[n] === 'cs');
          function paint() {
            // buttons
            btnRow.replaceChildren(...names.map((n) => {
              const w = where[n];
              return h('button', { class: 'btn ' + (w === 'cs' ? 'mem' : w === 'blocked' ? '' : 'proc'), type: 'button', disabled: w === 'blocked', onclick: () => { runId++; act(n); } },
                w === 'rem' ? `${n}: semWait(s)` : w === 'cs' ? `${n}: semSignal(s)` : `${n} is asleep`);
            }));
            // diagram: three zones
            const zones = [['rem', 'remainder (outside)', 's-panel', 10], ['blocked', 'blocked in semWait(s)', 's-warn', 205], ['cs', 'critical section', cs().length > 1 ? 's-bad' : 's-ok', 400]];
            const kids = [], NW = ctx.narrow;
            zones.forEach(([key, label, cls, x], zi) => {
              // wide: three zones side by side; phone: three zones stacked, each with its label above it
              const zx = NW ? 6 : x, zy = NW ? 22 + zi * 86 : 30, zw = NW ? 290 : 190, zh = NW ? 58 : 96;
              kids.push(s('rect', { x: zx, y: zy, width: zw, height: zh, rx: 14, class: cls, 'stroke-width': 2, 'fill-opacity': key === 'blocked' ? 0.5 : 1 }));
              kids.push(s('text', { x: NW ? zx + 4 : zx + 95, y: zy - 8, 'text-anchor': NW ? 'start' : 'middle', 'font-size': 14, 'font-weight': 700 }, label));
              const who = key === 'blocked' ? sem.q.slice() : names.filter((n) => where[n] === key);
              who.forEach((n, k) => kids.push(token(s, zx + zw / 2 + (k - (who.length - 1) / 2) * 58, zy + zh / 2, n, key === 'blocked' ? 's-warn' : key === 'cs' ? 's-mem' : 's-proc', 48, 44)));
            });
            // released waiter: from the blocked zone into the critical section
            if (NW) kids.push(s('path', { d: 'M298 137 C 352 145, 352 216, 300 222', class: 's-line', fill: 'none', 'stroke-width': 1.8, 'marker-end': 'url(#arr)' }));
            else {
              kids.push(s('path', { d: 'M300 128 C 300 150, 495 150, 495 131', class: 's-line', fill: 'none', 'stroke-width': 1.8, 'marker-end': 'url(#arr)' }));
              kids.push(s('text', { x: 398, y: 164, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'a semSignal moves the front waiter into the room'));
            }
            svg.replaceChildren(...kids);
            // history strip
            histEl.replaceChildren(h('span', { class: 'small b' }, 's over time:'), ...hist.map((v, i) => [i ? h('span', { class: 'muted' }, '→') : null, h('span', { class: 'chip ' + (v < 0 ? 'warn' : v === 0 ? 'os' : 'ok') + (i === hist.length - 1 ? ' flash' : '') }, String(v))]).flat().filter(Boolean).slice(-19));
            const inside = cs().length;
            inv.replaceChildren(h('span', { class: 'chip ' + (inside > 1 ? 'bad' : 'ok') }, `inside the critical section: ${inside} ${inside > 1 ? '✗' : '✓'}`), h('span', { class: 'chip warn' }, `blocked: ${sem.q.length}`), h('span', { class: 'chip os' }, `s = ${sem.v}`));
            code.clear();
            if (names.some((n) => where[n] === 'rem')) code.mark([7], 'cur');
            if (sem.q.length) code.mark([4], 'bad');
            if (inside) code.mark([5], 'ok');
          }
          async function classic() {
            const my = ++runId;
            init = 1; initSeg.set(1);
            reset('Classic trace: A, B and C all try to enter one after another, then leave in turn.');
            for (const n of ['A', 'B', 'C', 'A', 'B', 'C']) {
              await ctx.sleep(1300);
              if (!ctx.alive || my !== runId) return;
              act(n);
            }
          }
          const initSeg = ctx.ui.seg([{ value: 1, label: 's starts at 1' }, { value: 2, label: 's starts at 2' }], 1, (v) => {
            runId++; init = v;
            reset(v === 2 ? 'Now <code>s</code> starts at <b>2</b>, which means “two may be inside at once”. Let two processes call semWait and watch what happens.' : null);
          });
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 500px) minmax(0, 1fr)', gap: '22px' } },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'Wrap the <span class="t">critical section</span> in <code>semWait(s)</code> and <code>semSignal(s)</code>, with <code>s</code> starting at <b>1</b>: one process inside at a time, which is <span class="t">mutual exclusion</span>.' }),
              code,
              h('div', { class: 'row gap-s xs' }, h('span', { class: 'small b' }, 'Code highlights:'), h('span', { class: 'chip io' }, 'someone in remainder'), h('span', { class: 'chip bad' }, 'someone blocked'), h('span', { class: 'chip ok' }, 'someone inside')),
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake' }, 'Forgetting semSignal on some exit path (an early return, an error): the room stays locked and every later process blocks forever.')),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, initSeg, h('div', { class: 'row gap-s' },
                h('button', { class: 'btn sm primary', type: 'button', onclick: classic }, '▶ Play the classic trace'),
                h('button', { class: 'btn sm', type: 'button', onclick: () => { runId++; reset(); } }, 'Reset'))),
              btnRow,
              h('div', { class: 'card white tight' }, svg),
              histEl, inv, narr,
              h('div', { class: 'callout why small m0', 'data-label': 'Why start at 1?' }, 'The start value is how many may be inside at once. At 2, two get in together: right for a pool of two printers, wrong for a critical section.'))));
          reset();
        },
      },

      /* ---------------- 6. The producer/consumer problem (infinite buffer, no semaphores yet) ---------------- */
      {
        title: 'The producer/consumer problem',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const PSRC = `
while (true) {            // producer, forever:
    v = produce();        // make the next item
    b[in] = v;            // store it in slot b[in]
    in++;                 // in = next empty slot
}                         // it never has to wait`;
          const CSRC = `
while (true) {            // consumer, forever:
    while (in <= out) ;   // empty? test again (spin)
    w = b[out];           // read slot b[out]
    out++;                // out = next unread slot
    consume(w);           // use the item
}                         // then go round again`;
          const pCode = ctx.ui.code(PSRC, { lang: 'c', fontSize: 13, cls: 'tight' });
          const cCode = ctx.ui.code(CSRC, { lang: 'c', fontSize: 13, cls: 'tight' });
          let check = true, st;
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 318 230' : '0 0 600 116', width: '100%' });
          const chips = h('div', { class: 'row gap-s' });
          const narr = h('div', { class: 'narr', style: { minHeight: '100px' } });
          function say(html, tone) { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; }
          function marks() { pCode.clear(); cCode.clear(); if (!check) cCode.mark([2], 'dim'); }
          // first visible slot: keep two used slots on the left of the lower pointer
          const base = () => Math.max(1, Math.min(st.in, st.out) - 2);
          function reset(msg) {
            st = { in: 1, out: 1, made: 0, cells: {}, spins: 0 };
            marks();
            say(msg || 'The buffer is empty: in = out = 1. Add a few items, take a few, then try to take when nothing is left, first with the check on, then with it off.');
            draw();
          }
          function produce() {
            if (st.in >= base() + 7) { say('The real buffer never fills up, but this picture only has room for eight slots. Let the consumer catch up (or press Reset).'); return; }
            const id = ++st.made, lost = st.in < st.out;
            st.cells[st.in] = { id, st: lost ? 'lost' : 'full' };
            st.in++;
            marks(); pCode.mark([2, 3, 4]);
            say(lost ? `The producer stores item ${id} in b[${st.in - 1}], but out has already moved past that slot, so this item will <b>never be read</b>. Once out overtook in, the bookkeeping was broken for good. Press Reset.`
              : `The producer makes item ${id}, stores it in b[${st.in - 1}] and moves in to ${st.in}. It never waits, because an infinite buffer never fills. Items waiting: in − out = ${st.in - st.out}.`, lost ? 'bad' : '');
            draw();
          }
          function consume() {
            const empty = st.in <= st.out;
            marks();
            if (empty && check) {
              st.spins += 1; cCode.mark([2], 'bad');
              say(`in = ${st.in} and out = ${st.out}, so in ≤ out: the buffer is empty. The consumer stays on line 2, testing again and again. That is <span class="t">busy waiting</span>: ${st.spins} wasted test${st.spins === 1 ? '' : 's'} so far, and only the producer can end it.`, 'bad');
            } else if (empty) {
              if (st.out >= base() + 7) { say('The picture has run out of room. Press Reset to start again.'); return; }
              st.cells[st.out] = { st: 'ghost' }; st.out++;
              cCode.mark([3, 4, 5], 'bad');
              say(`With the check gone, the consumer reads b[${st.out - 1}], where nothing was ever stored, and consumes <b>garbage</b>: an item that does not exist. out (${st.out}) is now ahead of in (${st.in}), which breaks rule 2.`, 'bad');
            } else {
              const c = st.cells[st.out]; c.st = 'used'; st.out++;
              cCode.mark([3, 4, 5]);
              say(`in (${st.in}) is greater than out (${st.out - 1}), so an item is waiting. The consumer reads item ${c.id} from b[${st.out - 1}], moves out to ${st.out} and consumes it. Items still waiting: in − out = ${st.in - st.out}.`, 'ok');
            }
            draw();
          }
          // slot k of the visible window: one row of 8 on a wide canvas, two rows of 4 on a phone
          const cell = (k) => (ctx.narrow ? [12 + (k % 4) * 70, Math.floor(k / 4) * 116] : [12 + k * 70, 0]);
          function draw() {
            const b0 = base(), kids = [];
            const px = (p) => { const [x, dy] = cell(p - b0); return [x + 31, dy]; };
            for (let k = 0; k < 8; k++) {
              const idx = b0 + k, [x, dy] = cell(k), c = st.cells[idx];
              const cls = !c ? 's-muted' : c.st === 'full' ? 's-mem' : c.st === 'ghost' ? 's-bad' : c.st === 'lost' ? 's-warn' : 's-panel';
              kids.push(s('text', { x: x + 31, y: dy + 14, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, `b[${idx}]`));
              kids.push(s('rect', { x, y: dy + 22, width: 62, height: 44, rx: 8, class: cls, 'stroke-width': 2, 'stroke-dasharray': c ? null : '5 4' }));
              if (c) kids.push(s('text', { x: x + 31, y: dy + 49, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: c.st === 'ghost' ? 'fill:var(--bad)' : c.st === 'used' ? 'fill:var(--muted)' : '' }, c.st === 'ghost' ? 'garbage' : c.st === 'used' ? 'taken' : 'item ' + c.id));
            }
            kids.push(s('text', { x: ctx.narrow ? 302 : 588, y: ctx.narrow ? 166 : 50, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800, class: 's-sub' }, '…'));
            const same = st.in === st.out;
            if (st.in >= b0 && st.in < b0 + 8) { const [x, dy] = px(st.in); kids.push(s('text', { x, y: dy + 88, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--mem)' }, '▲ in')); }
            if (st.out >= b0 && st.out < b0 + 8) { const [x, dy] = px(st.out); kids.push(s('text', { x, y: dy + (same ? 108 : 88), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, '▲ out')); }
            svg.replaceChildren(...kids);
            const wait = st.in - st.out;
            chips.replaceChildren(h('span', { class: 'chip mem' }, `in = ${st.in}`), h('span', { class: 'chip proc' }, `out = ${st.out}`),
              h('span', { class: 'chip ' + (wait < 0 ? 'bad' : 'os') }, `waiting: in − out = ${wait}`),
              h('span', { class: 'chip ' + (st.spins ? 'warn' : '') }, `wasted tests: ${st.spins}`));
          }
          const checkSeg = ctx.ui.seg([{ value: true, label: 'Check on' }, { value: false, label: 'Check off' }], true, (v) => {
            check = v; marks();
            say(v ? 'The check is back: on an empty buffer the consumer will spin on line 2 instead of reading an empty slot.' : 'The consumer now skips line 2 and reads b[out] no matter what. Take until the buffer is empty, then take once more.', v ? '' : 'bad');
          });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: '<b>The problem.</b> One or more <b>producers</b> put items into a shared buffer and a <b>consumer</b> takes them out one at a time. This is the <span class="t" data-t="producer/consumer problem">producer/consumer problem</span>, and every solution must keep two rules: <b>(1)</b> only one process uses the buffer at any moment, and <b>(2)</b> the consumer never takes from an empty buffer. For now the buffer is <b>infinite</b> (b[1], b[2], … never run out): the producer writes at index <code>in</code>, the consumer reads at <code>out</code>, and <code>in − out</code> items are waiting.' }),
            h('div', { class: 'grid-2', style: { gap: '14px' } },
              h('div', { class: 'stack', style: { gap: '4px' } }, h('h4', { class: 'm0', style: { color: 'var(--mem)' } }, 'Producer'), pCode),
              h('div', { class: 'stack', style: { gap: '4px' } }, h('h4', { class: 'm0', style: { color: 'var(--proc)' } }, 'Consumer'), cCode)),
            h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 13fr) minmax(0, 10fr)', gap: '16px' } },
              h('div', { class: 'card white tight stack', style: { gap: '8px' } },
                h('div', { class: 'row gap-s' },
                  h('button', { class: 'btn sm mem', type: 'button', onclick: produce }, 'Producer: add an item'),
                  h('button', { class: 'btn sm proc', type: 'button', onclick: consume }, 'Consumer: take an item'),
                  h('button', { class: 'btn sm', type: 'button', style: { marginLeft: 'auto' }, onclick: () => reset() }, 'Reset')),
                h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Consumer’s line-2 check:'), checkSeg,
                  h('span', { class: 'small muted' }, 'on = spin while empty · off = read anyway')),
                svg, chips),
              h('div', { class: 'stack', style: { gap: '10px' } }, narr,
                h('div', { class: 'callout why small m0', 'data-label': 'Why semaphores next', html: 'The check keeps rule 2, but a spinning consumer wastes the processor, and nothing yet enforces rule 1. Next, a semaphore <code>s</code> locks the buffer and another one lets the consumer <b>sleep</b> until an item exists.' })))));
          reset();
        },
      },

      /* ---------------- 7. Producer/consumer, infinite buffer ---------------- */
      {
        title: 'Producer/consumer: catch the bug, then fix it',
        kind: 'lab',
        render(el, ctx) {
          const { h, s } = ctx;
          const add = (st) => { st.items++; st.cells[st.in - 1] = { id: st.items, st: 'full' }; st.in++; };
          const take = (st) => { const c = st.cells[st.out - 1]; if (c && c.st === 'full') c.st = 'used'; else { st.cells[st.out - 1] = { id: null, st: 'ghost' }; st.bad = true; } st.out++; };
          const PROD_B = `
int n = 0;                     // items in the buffer
binary_semaphore s = 1;        // guards the buffer
binary_semaphore delay = 0;    // 0 = consumer must wait
void producer() {              // the producer process
    while (true) {             // forever:
        produce();             // make an item
        semWaitB(s);           // lock the buffer
        append();              // b[in] = item; in++
        n++;                   // one more item
        if (n == 1) semSignalB(delay); // was empty: wake
        semSignalB(s);         // unlock the buffer
    }                          // end loop
}                              // end producer`;
          const V = {
            flawed: {
              intro: 'The <span class="t" data-t="producer/consumer problem">producer/consumer</span> problem with <span class="t" data-t="binary semaphore">binary semaphores</span>: <code>s</code> locks the buffer; <code>delay</code> puts the consumer to sleep while it is empty. <b style="color:var(--warn)">Hunt for the bug:</b> play to step 7, then <b>click the consumer line</b> you blame.',
              hunt: {
                right: [9],
                yes: 'It tests the shared <code>n</code> after line 7 has already released s. In that gap the producer can change n and store a signal in delay, so the test and the stored signal disagree. Play on to see the damage.',
                fb: { 2: 'This first wait only makes the consumer sleep until the very first item exists. It is fine.', 4: 'Locking s here is right: take() and n-- then have the buffer to themselves.', 5: 'take() runs while s is held, so the producer cannot interfere with it.', 6: 'n-- runs while s is held, so it is safe.', 7: 'Unlocking is necessary. Ask what the consumer does with shared data <i>after</i> this line.', 8: 'consume() uses only the consumer’s own item, which no other process touches.' },
              },
              vars: ['n', 's', 'delay'], prod: PROD_B,
              cons: `
void consumer() {              // the consumer process
    semWaitB(delay);           // wait for a first item
    while (true) {             // forever:
        semWaitB(s);           // lock the buffer
        take();                // item = b[out]; out++
        n--;                   // one fewer item
        semSignalB(s);         // unlock the buffer
        consume();             // use the item
        if (n == 0) semWaitB(delay); // empty? then sleep
    }                          // end loop
}                              // end consumer`,
              frames: [
                { cap: '<b>Start.</b> The buffer is empty: n = 0, s = 1, delay = 0. Step through one particular timing of the two processes.' },
                { c: [2], f: (st) => { st.C = 'blocked'; }, cap: 'The consumer runs first and calls semWaitB(delay). delay is 0, so the consumer <b>blocks</b> until the producer says there is something to take.' },
                { p: [6, 7, 8], f: (st) => { st.s = 0; add(st); st.P = 'running'; }, cap: 'The producer makes item 1, locks the buffer (s: 1 → 0) and appends it to b[1].' },
                { p: [9, 10], f: (st) => { st.n = 1; st.C = 'ready'; }, cap: 'n: 0 → 1. Because n is 1, the buffer was empty a moment ago, so the producer calls semSignalB(delay). The consumer was waiting, so it is <b>released</b> (delay stays 0).' },
                { p: [11], f: (st) => { st.s = 1; st.P = 'ready'; }, cap: 'The producer unlocks the buffer (s: 0 → 1).' },
                { c: [4, 5, 6, 7], f: (st) => { take(st); st.n = 0; st.C = 'running'; }, cap: 'The consumer locks the buffer, takes item 1 from b[1], sets n: 1 → 0 and unlocks. So far, so good.' },
                { c: [8], cc: 'bad', f: () => {}, cap: 'The consumer is busy consuming item 1. It has <b>not yet</b> reached the test <code>if (n == 0)</code>, and n is no longer protected by s. Now the scheduler switches to the producer…' },
                { p: [6, 7, 8, 9, 10, 11], f: (st) => { add(st); st.n = 1; st.delay = 1; st.C = 'ready'; }, cap: 'The producer adds item 2 (n: 0 → 1). Since n == 1 it signals delay again. This time nobody is waiting, so delay becomes <b>1</b>: a stored wake-up that nobody asked for.' },
                { c: [9], f: () => {}, cap: 'Back to the consumer. It finally tests n == 0 but sees <b>1</b> (the producer’s new item), so it does not sleep. That alone is fine; the trouble is that the stale <b>delay = 1 is still stored</b>.' },
                { c: [4, 5, 6, 7, 8], f: (st) => { take(st); st.n = 0; }, cap: 'It takes item 2 (n: 1 → 0), unlocks and consumes it. The buffer is now truly empty.' },
                { c: [9], cc: 'bad', f: (st) => { st.delay = 0; }, cap: 'n == 0, so the consumer calls semWaitB(delay) to sleep. But the stale signal is still there, so it <b>passes straight through</b> (delay: 1 → 0).' },
                { c: [4, 5, 6, 7], cc: 'bad', f: (st) => { take(st); st.n = -1; }, cap: '<b>Bug!</b> The consumer locks the buffer and takes b[3], which was never filled: it consumes an item that <b>does not exist</b>, n drops to −1, and out has overtaken in. Cause: n was tested outside the critical section.' },
              ],
            },
            fixed: {
              intro: 'One change: the consumer copies n into a private <code>m</code> while it still holds the lock, and tests m later. <b style="color:var(--ok)">Your turn:</b> <b>click the consumer line</b> that actually repairs the bug.',
              hunt: {
                right: [8],
                yes: '<code>m = n</code> runs while s is held, so m records n at a moment when the consumer owned the buffer. No other process can change m, so the later test on line 11 can no longer be fooled.',
                fb: { 2: 'That only declares m. What matters is <i>when</i> m gets its value.', 11: 'Line 11 tests m, but that is safe only because of how m got its value. Look a little earlier.', 3: 'This first wait is unchanged from the flawed version.', 5: 'This lock was already there in the flawed version.', 6: 'Unchanged from the flawed version.', 7: 'Unchanged from the flawed version.', 9: 'Unchanged from the flawed version.', 10: 'Unchanged from the flawed version.' },
              },
              vars: ['n', 's', 'delay', 'm'], prod: PROD_B,
              cons: `
void consumer() {              // the consumer process
    int m;                     // private copy of n
    semWaitB(delay);           // wait for a first item
    while (true) {             // forever:
        semWaitB(s);           // lock the buffer
        take();                // item = b[out]; out++
        n--;                   // one fewer item
        m = n;                 // remember n while locked
        semSignalB(s);         // unlock the buffer
        consume();             // use the item
        if (m == 0) semWaitB(delay); // test the saved copy
    }                          // end loop
}                              // end consumer`,
              frames: [
                { cap: '<b>Start.</b> Exactly the same timing as before. Watch what the private copy m changes.' },
                { c: [3], f: (st) => { st.C = 'blocked'; }, cap: 'The consumer calls semWaitB(delay) and <b>blocks</b>: nothing to take yet.' },
                { p: [6, 7, 8], f: (st) => { st.s = 0; add(st); st.P = 'running'; }, cap: 'The producer makes item 1, locks the buffer (s: 1 → 0) and appends it to b[1].' },
                { p: [9, 10], f: (st) => { st.n = 1; st.C = 'ready'; }, cap: 'n: 0 → 1, so the producer signals delay and the waiting consumer is <b>released</b>.' },
                { p: [11], f: (st) => { st.s = 1; st.P = 'ready'; }, cap: 'The producer unlocks the buffer (s: 0 → 1).' },
                { c: [5, 6, 7, 8, 9], cc: 'ok', f: (st) => { take(st); st.n = 0; st.m = 0; st.C = 'running'; }, cap: 'The consumer takes item 1 (n: 1 → 0) and, <b>while still holding the lock</b>, copies n into m (m = 0). Then it unlocks.' },
                { c: [10], f: () => {}, cap: 'The consumer is consuming item 1. The scheduler switches to the producer at the same risky moment as before…' },
                { p: [6, 7, 8, 9, 10, 11], f: (st) => { add(st); st.n = 1; st.delay = 1; st.C = 'ready'; }, cap: 'The producer adds item 2 (n: 0 → 1) and, since n == 1, stores a signal in delay (delay = 1).' },
                { c: [11], cc: 'ok', f: (st) => { st.delay = 0; }, cap: 'The consumer tests its saved m, which is 0, and calls semWaitB(delay). The stored signal lets it through (delay: 1 → 0), and this time the signal is <b>deserved</b>: item 2 really exists.' },
                { c: [5, 6, 7, 8, 9, 10], f: (st) => { take(st); st.n = 0; st.m = 0; }, cap: 'It takes item 2 (n: 1 → 0), saves m = 0, unlocks and consumes.' },
                { c: [11], cc: 'ok', f: (st) => { st.C = 'blocked'; }, cap: 'm is 0 and delay is 0, so the consumer <b>blocks</b>: exactly right, because the buffer is empty.' },
                { cap: '<b>Fixed.</b> Every signal on delay now matches a real item, and n never goes negative. The consumer sleeps until the producer’s next semSignalB(delay).' },
              ],
            },
            counting: {
              intro: '<code>n</code> is now a <span class="t" data-t="counting semaphore">counting semaphore</span>, so the item count and the wake-up can never disagree. <b style="color:var(--info)">Your turn:</b> <b>click the consumer line</b> that now does the job of both n and delay.',
              hunt: {
                right: [3],
                yes: 'semWait(n) claims an item and, if none exists, puts the consumer to sleep, all in one atomic operation, so there is no gap to exploit. Order check: swapping the producer’s two semSignal calls is harmless; swapping these two semWaits is not.',
                fb: { 4: 'semWait(s) is only the lock around take().', 5: 'take() just removes the item; it does not decide whether one exists.', 6: 'semSignal(s) only unlocks the buffer.', 7: 'consume() only uses the item.' },
              },
              vars: ['n', 's'],
              prod: `
semaphore n = 0;               // counts items in the buffer
semaphore s = 1;               // guards the buffer
void producer() {              // the producer process
    while (true) {             // forever:
        produce();             // make an item
        semWait(s);            // lock the buffer
        append();              // b[in] = item; in++
        semSignal(s);          // unlock the buffer
        semSignal(n);          // announce one more item
    }                          // end loop
}                              // end producer`,
              cons: `
void consumer() {              // the consumer process
    while (true) {             // forever:
        semWait(n);            // wait until an item exists
        semWait(s);            // lock the buffer
        take();                // item = b[out]; out++
        semSignal(s);          // unlock the buffer
        consume();             // use the item
    }                          // end loop
}                              // end consumer`,
              frames: [
                { cap: '<b>Start.</b> Same timing again, now with a counting semaphore n = 0 and s = 1.' },
                { c: [3], f: (st) => { st.n = -1; st.C = 'blocked'; }, cap: 'The consumer calls semWait(n): 0 → −1. Negative, so it <b>blocks</b>. The semaphore is both the item count and the waiting line.' },
                { p: [5, 6, 7, 8], f: (st) => { add(st); st.P = 'running'; }, cap: 'The producer makes item 1, locks the buffer, appends it to b[1] and unlocks.' },
                { p: [9], f: (st) => { st.n = 0; st.C = 'ready'; st.P = 'ready'; }, cap: 'semSignal(n): −1 → 0. Still ≤ 0, so the consumer is <b>released</b>.' },
                { c: [4, 5, 6, 7], f: (st) => { take(st); st.C = 'running'; }, cap: 'The consumer locks, takes item 1, unlocks and starts consuming. The scheduler switches to the producer…' },
                { p: [5, 6, 7, 8, 9], f: (st) => { add(st); st.n = 1; st.C = 'ready'; }, cap: '…which adds item 2 and signals n: 0 → 1. Nobody is waiting, so the count simply <b>remembers</b> the item.' },
                { c: [3, 4, 5, 6, 7], cc: 'ok', f: (st) => { st.n = 0; take(st); }, cap: 'semWait(n): 1 → 0, so the consumer passes, and there really is an item: it takes item 2.' },
                { c: [3], cc: 'ok', f: (st) => { st.n = -1; st.C = 'blocked'; }, cap: 'Next round: semWait(n) takes n from 0 to −1, so the consumer <b>blocks</b>. Correct. Order matters, though: swapping the consumer’s two semWait calls can deadlock, as the next step shows.' },
              ],
            },
          };
          let ver = 'flawed', snaps = [];
          const prodBox = h('div', { class: 'stack', style: { gap: '4px' } });
          const consBox = h('div', { class: 'stack', style: { gap: '4px' } });
          const intro = h('p', { class: 'small m0' });
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 304' : '0 0 560 178', width: '100%' });
          let pCode, cCode;
          function snapshotsFor(v) {
            const st = { n: 0, s: 1, delay: 0, m: null, cells: [], in: 1, out: 1, items: 0, P: 'ready', C: 'ready', bad: false };
            return V[v].frames.map((fr) => { if (fr.f) fr.f(st); return JSON.parse(JSON.stringify(st)); });
          }
          function load(v) {
            ver = v; snaps = snapshotsFor(v);
            pCode = ctx.ui.code(V[v].prod, { lang: 'c', fontSize: 13, cls: 'tight' });
            cCode = ctx.ui.code(V[v].cons, { lang: 'c', fontSize: 13, cls: 'tight clk' });
            // the student hunts for the key line by clicking it; feedback replaces the intro text
            cCode.querySelectorAll('.ln').forEach((ln, k) => ln.addEventListener('click', () => guess(k + 1)));
            prodBox.replaceChildren(h('h4', { class: 'm0' }, 'Producer'), pCode);
            consBox.replaceChildren(h('h4', { class: 'm0' }, 'Consumer ', h('span', { class: 'xs muted', style: { fontWeight: 600 } }, '(click a line)')), cCode);
            intro.innerHTML = V[v].intro;
          }
          function guess(n) {
            const H = V[ver].hunt, ok = H.right.includes(n);
            cCode.querySelectorAll('.ln').forEach((ln, k) => { ln.classList.toggle('pick-ok', ok && k + 1 === n); ln.classList.toggle('pick-bad', !ok && k + 1 === n); });
            intro.innerHTML = `<b style="color:var(${ok ? '--ok' : '--bad'})">Line ${n}: ${ok ? 'yes, that is the one.' : 'not this one.'}</b> ` + (ok ? H.yes : (H.fb[n] || 'That line only opens or closes the loop or the function.') + ' Try another line.');
          }
          function draw(i) {
            const fr = V[ver].frames[i], st = snaps[i];
            pCode.clear(); cCode.clear();
            if (fr.p) pCode.mark(fr.p, fr.pc || 'cur');
            if (fr.c) cCode.mark(fr.c, fr.cc || 'cur');
            const kids = [];
            // coordinates: one wide strip, or a taller phone layout (3 buffer slots per row)
            const NW = ctx.narrow;
            const varX = (k) => (NW ? 8 + k * 88 : 14 + k * 92);
            const proc = (k) => (NW ? [8 + k * 176, 68, 168, 44] : [390 + k * 86, 8, 78, 52]);
            const cell = (k) => (NW ? [8 + (k % 3) * 118, 138 + Math.floor(k / 3) * 84] : [14 + k * 90, 92]);
            const cw = NW ? 104 : 78;
            // variables
            V[ver].vars.forEach((name, k) => {
              const x = varX(k), val = name === 'm' ? (st.m == null ? '–' : st.m) : st[name];
              const hot = (name === 'n' && st.n < 0 && ver !== 'counting') || (name === 'delay' && st.delay === 1 && ver === 'flawed');
              kids.push(s('rect', { x, y: 8, width: 80, height: 52, rx: 10, class: hot ? 's-bad' : name === 'm' ? 's-proc' : 's-os', 'stroke-width': 2 }));
              kids.push(s('text', { x: x + 40, y: 25, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, name === 'n' && ver === 'counting' ? 'sem n' : name));
              kids.push(s('text', { x: x + 40, y: 51, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 900 }, String(val)));
            });
            // process states
            [['Producer', st.P, i && fr.p], ['Consumer', st.C, i && fr.c]].forEach(([nm, state, active], k) => {
              const [x, y, w, hh] = proc(k);
              kids.push(s('rect', { x, y, width: w, height: hh, rx: 10, class: state === 'blocked' ? 's-warn' : nm === 'Producer' ? 's-mem' : 's-proc', 'stroke-width': active ? 3.5 : 1.5 }));
              kids.push(s('text', { x: x + w / 2, y: y + (NW ? 18 : 21), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, nm));
              kids.push(s('text', { x: x + w / 2, y: y + (NW ? 36 : 40), 'text-anchor': 'middle', 'font-size': 13, style: state === 'blocked' ? 'fill:var(--warn)' : '' }, state === 'blocked' ? 'Blocked' : active ? 'Running' : 'Ready'));
            });
            // buffer cells
            kids.push(s('text', { x: NW ? 8 : 14, y: NW ? 130 : 84, 'font-size': 13, class: 's-sub' }, 'buffer (never fills up)'));
            for (let k = 0; k < 6; k++) {
              const [x, y] = cell(k), c = st.cells[k];
              const cls = !c ? 's-muted' : c.st === 'full' ? 's-mem' : c.st === 'ghost' ? 's-bad' : 's-panel';
              kids.push(s('rect', { x, y, width: cw, height: 44, rx: 8, class: cls, 'stroke-width': 2, 'stroke-dasharray': c ? null : '5 4' }));
              kids.push(s('text', { x: x + cw / 2, y: y + 28, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, style: c && c.st === 'ghost' ? 'fill:var(--bad)' : c && c.st === 'used' ? 'fill:var(--muted)' : '' }, !c ? `b[${k + 1}]` : c.st === 'full' ? 'item ' + c.id : c.st === 'used' ? 'taken' : 'nothing!'));
            }
            const px = (p, dy) => { const [x, y] = cell(p - 1); return { x: x + cw / 2, y: y + dy }; };
            kids.push(s('text', { ...px(st.in, NW ? 60 : 63), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--mem)' }, '▲ in'));
            kids.push(s('text', { ...px(st.out, NW ? 76 : 81), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--proc)' }, '▲ out'));
            svg.replaceChildren(...kids);
            const cap = V[ver].frames[i].cap;
            return st.bad ? `<span style="color:var(--bad)">${cap}</span>` : cap;
          }
          load(ver);
          const player = ctx.ui.player({ count: V[ver].frames.length, render: draw, interval: 2600, speed: false });
          const seg = ctx.ui.seg([{ value: 'flawed', label: '1 · Flawed' }, { value: 'fixed', label: '2 · Fixed with m' }, { value: 'counting', label: '3 · Counting' }], ver, (v) => { player.stop(); load(v); player.setCount(V[v].frames.length); });
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },
            h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { gap: '14px' } }, h('div', { style: { flex: ctx.narrow ? '1 1 100%' : 'none' } }, seg), intro),
            h('div', { class: 'grid-2' }, prodBox, consBox),
            h('div', { class: 'split grow', style: { gap: '16px' } }, h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center' } }, svg),
              h('div', { class: 'stack', style: { gap: '10px' } }, player.el,
                h('div', { class: 'row gap-s xs' }, h('span', { class: 'small b' }, 'Line colours:'), h('span', { class: 'chip io' }, 'just ran'), h('span', { class: 'chip bad' }, 'the risky moment'), h('span', { class: 'chip ok' }, 'the fix at work'))))));
        },
      },

      /* ---------------- 7. Bounded buffer factory ---------------- */
      {
        title: 'The bounded-buffer factory (and how to break it)',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const SIZE = 6, TICK = 90;
          const DUR = { 1: 36, 2: 22, 3: 14, 4: 8, 5: 4 };
          const PROG = {
            P: [['produce', 'produce();    // make an item'], ['wait e', 'semWait(e);   // need a free slot'], ['wait s', 'semWait(s);   // lock the buffer'], ['append', 'append();     // item into b[in]'], ['signal s', 'semSignal(s); // unlock the buffer'], ['signal n', 'semSignal(n); // +1 item ready']],
            C: [['wait n', 'semWait(n);   // need an item'], ['wait s', 'semWait(s);   // lock the buffer'], ['take', 'take();       // item from b[out]'], ['signal s', 'semSignal(s); // unlock the buffer'], ['signal e', 'semSignal(e); // +1 free slot'], ['consume', 'consume();    // use the item']],
            Cbug: [['wait s', 'semWait(s);   // lock first (bug!)'], ['wait n', 'semWait(n);   // then need an item'], ['take', 'take();       // item from b[out]'], ['signal s', 'semSignal(s); // unlock the buffer'], ['signal e', 'semSignal(e); // +1 free slot'], ['consume', 'consume();    // use the item']],
          };
          let bug = false, running = true, speed = { P: 4, C: 2 }, st, turn = 0, lastMsg = '';
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 336' : '0 0 480 400', width: '100%', style: { maxHeight: '100%' } });
          const narr = h('div', { class: 'narr', style: { minHeight: '66px' } });
          const startInfo = h('span', { class: 'small muted' });
          const side = {};
          // prefill > 0 starts with that many items already in the buffer (n and e adjusted to match)
          function fresh(prefill = 0) {
            st = { sem: { s: { v: 1, q: [] }, n: { v: prefill, q: [] }, e: { v: SIZE - prefill, q: [] } }, buf: Array(SIZE).fill(null), inP: prefill, outP: 0, made: prefill, used: 0, dead: false,
              P: { pc: 0, left: null, blocked: null, item: null }, C: { pc: 0, left: null, blocked: null, item: null } };
            for (let k = 0; k < prefill; k++) st.buf[k] = k + 1;
            startInfo.innerHTML = `circular <span class="t">bounded buffer</span>, ${SIZE} slots · start: s = 1, n = ${prefill}, e = ${SIZE - prefill}`;
            // the side notes must describe the same starting values as the header above
            if (side.P) side.P.note.innerHTML = noteHTML('P', prefill);
            if (side.C) side.C.note.innerHTML = noteHTML('C', prefill);
            lastMsg = '';
          }
          const prog = (who) => (who === 'P' ? PROG.P : bug ? PROG.Cbug : PROG.C);
          function step(who) {
            const p = st[who];
            if (p.blocked || st.dead) return;
            const [op] = prog(who)[p.pc];
            if (p.left == null) p.left = op === 'produce' ? DUR[speed.P] : op === 'consume' ? DUR[speed.C] : op === 'append' || op === 'take' ? 3 : 1;
            if (--p.left > 0) return;
            p.left = null;
            const [verb, name] = op.split(' ');
            if (verb === 'produce') p.item = ++st.made;
            else if (verb === 'wait') { if (semWaitOp(st.sem[name], who)) p.blocked = name; }
            else if (verb === 'signal') { const w = semSignalOp(st.sem[name]); if (w) st[w].blocked = null; }
            else if (verb === 'append') { st.buf[st.inP] = p.item; st.inP = (st.inP + 1) % SIZE; }
            else if (verb === 'take') { p.item = st.buf[st.outP]; st.buf[st.outP] = null; st.outP = (st.outP + 1) % SIZE; }
            else if (verb === 'consume') st.used++;
            p.pc = (p.pc + 1) % 6;
            if (st.P.blocked && st.C.blocked) st.dead = true;
          }
          function tick() {
            if (!running || st.dead) return;
            const order = turn++ % 2 ? ['C', 'P'] : ['P', 'C'];
            order.forEach(step);
            draw();
          }
          function at(who) { const p = st[who]; return p.blocked ? (p.pc + 5) % 6 : p.pc; }
          function draw() {
            const S = st.sem, kids = [];
            // phones get a smaller canvas (360 wide) so the labels stay readable when it is scaled down
            const NW = ctx.narrow, bw = NW ? 112 : 148, bx = NW ? 118 : 158;
            [['s', 'lock'], ['n', 'items'], ['e', 'empty slots']].forEach(([k, lab], i) => {
              const x = (NW ? 4 : 8) + i * bx, v = S[k].v;
              kids.push(s('rect', { x, y: 4, width: bw, height: NW ? 60 : 66, rx: 12, class: v < 0 ? 's-warn' : 's-os', 'stroke-width': 2 }));
              kids.push(s('text', { x: x + bw / 2, y: 24, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, NW ? k + ' · ' + lab.replace('empty slots', 'empty') : `${k} · ${lab}`));
              kids.push(s('text', { x: x + bw / 2, y: NW ? 55 : 60, 'text-anchor': 'middle', 'font-size': NW ? 26 : 28, 'font-weight': 900 }, String(v)));
            });
            const cx = NW ? 180 : 240, cy = NW ? 206 : 240, R = NW ? 100 : 118, sw = NW ? 64 : 72, sh = NW ? 46 : 52;
            const pos = (k) => { const a = (-90 + k * (360 / SIZE)) * Math.PI / 180; return [cx + R * Math.cos(a), cy + R * Math.sin(a), a]; };
            kids.push(s('circle', { cx, cy, r: R, class: 's-muted', 'stroke-dasharray': '3 6' }));
            // pointer = arrow from the hub toward a slot. It stops just short of the slot's edge (so the
            // arrowhead stays visible) and its label sits at the arrow's inner end; the hub is kept empty for them.
            const ptr = (k, lab, color, off) => {
              // off shifts the arrow sideways (parallel) when in and out point at the same slot
              const [, , a] = pos(k), ux = Math.cos(a), uy = Math.sin(a), qx = -uy * off, qy = ux * off, lx = qx * 1.9, ly = qy * 1.9;
              const edge = Math.min(Math.abs(ux) > 1e-6 ? sw / 2 / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-6 ? sh / 2 / Math.abs(uy) : 1e9);
              const r2 = R - edge - 5, r1 = Math.max(r2 - 34, 16), rl = r1 - 11;
              kids.push(s('line', { x1: cx + r1 * ux + qx, y1: cy + r1 * uy + qy, x2: cx + r2 * ux + qx, y2: cy + r2 * uy + qy, style: `stroke:var(${color})`, 'stroke-width': 3, 'marker-end': `url(#arr-${color.slice(2)})` }));
              kids.push(s('text', { x: cx + rl * ux + lx, y: cy + rl * uy + ly + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: `fill:var(${color})` }, lab));
            };
            const same = st.inP === st.outP;
            ptr(st.inP, 'in', '--mem', same ? -9 : 0);
            ptr(st.outP, 'out', '--proc', same ? 9 : 0);
            for (let k = 0; k < SIZE; k++) {
              const [x, y] = pos(k), item = st.buf[k];
              kids.push(s('rect', { x: x - sw / 2, y: y - sh / 2, width: sw, height: sh, rx: 12, class: item ? 's-mem' : 's-muted', style: item ? null : 'fill:var(--panel)', 'stroke-width': 2, 'stroke-dasharray': item ? null : '5 4' }));
              kids.push(s('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': item ? 800 : 500, class: item ? '' : 's-sub' }, item ? '#' + item : 'b[' + k + ']'));
            }
            // fill level, in the free bottom-left corner (the hub belongs to the pointers)
            const full = st.buf.filter(Boolean).length, fy = NW ? 314 : 374;
            kids.push(s('text', { x: 8, y: fy, 'font-size': 20, 'font-weight': 900 }, `${full} / ${SIZE}`));
            kids.push(s('text', { x: 8, y: fy + 18, 'font-size': 13, class: st.dead ? '' : 's-sub', style: st.dead ? 'fill:var(--bad);font-weight:800' : '' }, st.dead ? 'stuck forever' : 'slots full'));
            svg.replaceChildren(...kids);
            ['P', 'C'].forEach((who) => {
              const p = st[who], sd = side[who];
              sd.code.clear();
              sd.code.mark(at(who) + 1, p.blocked ? 'bad' : 'cur');
              sd.state.className = 'chip ' + (p.blocked ? (st.dead ? 'bad' : 'warn') : 'ok');
              sd.state.textContent = p.blocked ? `blocked on ${p.blocked}` : 'running';
              sd.count.textContent = who === 'P' ? `items made: ${st.made}` : `items consumed: ${st.used}`;
            });
            let msg, tone = '';
            if (st.dead) { msg = '<b><span class="t">Deadlock</span>.</b> The consumer locked the buffer (s) and then went to sleep on n because the buffer was empty, <b>still holding s</b>. The producer needs s to add the very item that would wake the consumer. Each waits for the other forever. Press Reset or switch back to the correct order.'; tone = 'bad'; }
            else if (st.P.blocked === 'e') msg = `<b>Buffer full.</b> The producer called semWait(e) with no free slot announced, so e went to ${S.e.v} and it sleeps until the consumer’s semSignal(e) hands it a slot.${full < SIZE ? ' (A slot the consumer is emptying right now counts only once it calls semSignal(e).)' : ''}`;
            else if (bug && st.C.blocked === 'n') { msg = `<b>Danger.</b> The buffer ran empty, so the consumer’s semWait(n) took n to ${S.n.v} and it fell asleep. But in this order it had <b>already locked s</b>, and it still holds it (s = ${S.s.v}). The producer needs s to add the item that would wake it…`; tone = 'bad'; }
            else if (st.C.blocked === 'n') msg = `<b>Buffer empty.</b> The consumer called semWait(n) with no item announced, so n went to ${S.n.v} and it sleeps until the producer’s semSignal(n). It holds nothing while it sleeps, so the producer can still get in.${full ? ' (An item the producer has just appended counts only once it calls semSignal(n).)' : ''}`;
            else if (bug) msg = 'The consumer now locks s <b>before</b> waiting on n. The buffer starts with 3 items and the consumer is set faster than the producer, so the buffer will drain. While items remain, this happens to work. Watch the moment the buffer runs empty.';
            else msg = `Both processes are running: the producer puts items into the shared buffer and the consumer takes them out. n counts ready items and e counts empty slots, so each side waits only when it truly must. Try making one side much faster than the other.`;
            if (msg !== lastMsg) { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = msg; lastMsg = msg; }
          }
          function panel(who) {
            const code = ctx.ui.code(prog(who).map((x) => x[1]).join('\n'), { lang: 'c', fontSize: 13.5, nums: false });
            const stateChip = h('span', { class: 'chip' });
            const count = h('div', { class: 'small muted' });
            const sl = ctx.ui.slider({ label: 'Speed', min: 1, max: 5, value: speed[who], format: (v) => ['', 'slow', 'calm', 'medium', 'quick', 'fast'][v], onInput: (v) => { speed[who] = v; } });
            const note = h('div', { class: 'callout small m0 ' + (who === 'P' ? 'tip' : 'why'), 'data-label': who === 'P' ? 'e = empty slots' : 'n = items ready', html: noteHTML(who, bug ? 3 : 0) });
            side[who] = { code, state: stateChip, count, slider: sl, note };
            const wrap = h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0', style: { color: who === 'P' ? 'var(--mem)' : 'var(--proc)' } }, who === 'P' ? 'Producer' : 'Consumer'), stateChip),
              code, sl, count, note);
            return wrap;
          }
          // side note for each process; it names the real starting value of its semaphore for this run
          function noteHTML(who, prefill) {
            if (who === 'P') {
              return (prefill ? `e starts at ${SIZE - prefill} here: this run begins with ${prefill} items already in the buffer, so ${SIZE - prefill} slots are empty.` : `e starts at ${SIZE} because every slot begins empty.`) +
                ` If semWait(e) takes e below 0, the buffer is full and the producer sleeps. append() fills b[in], then in = (in + 1) % ${SIZE}, so after b[${SIZE - 1}] it wraps to b[0].`;
            }
            return (prefill ? `n starts at ${prefill} here: this run begins with ${prefill} items already in the buffer.` : 'n starts at 0 because there are no items yet.') +
              ` If semWait(n) takes n below 0, the buffer is empty and the consumer sleeps. take() empties b[out], then out = (out + 1) % ${SIZE}, chasing in around the circle.`;
          }
          fresh();
          const left = panel('P'), right = panel('C');
          function rebuildConsumer() { const old = side.C; const nc = ctx.ui.code(prog('C').map((x) => x[1]).join('\n'), { lang: 'c', fontSize: 13.5, nums: false }); old.code.replaceWith(nc); old.code = nc; }
          const pauseBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { running = !running; pauseBtn.textContent = running ? 'Pause' : 'Run'; } }, 'Pause');
          const bugSeg = ctx.ui.seg([{ value: false, label: 'Correct order' }, { value: true, label: 'Swapped semWaits (bug)' }], false, (v) => {
            bug = v; rebuildConsumer();
            // the bug hides while items remain: start with 3 items and a consumer faster than the producer so the buffer drains
            if (v) { side.P.slider.set(2, true); side.C.slider.set(5, true); }
            fresh(v ? 3 : 0); draw();
          });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } },
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Consumer code:'), bugSeg),
              h('div', { class: 'row gap-s' }, startInfo, pauseBtn, h('button', { class: 'btn sm', type: 'button', onclick: () => { fresh(bug ? 3 : 0); draw(); } }, 'Reset'))),
            h('div', { class: 'grow mw0', style: { display: 'grid', gridTemplateColumns: ctx.narrow ? '1fr' : 'minmax(0, 330px) minmax(0, 1fr) minmax(0, 330px)', gap: '16px', minHeight: 0 } },
              left, h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center', minHeight: 0 } }, svg), right),
            narr));
          draw();
          ctx.every(TICK, tick);
        },
      },

      /* ---------------- 8. Implementation: making the operations atomic ---------------- */
      {
        title: 'Making semWait and semSignal atomic',
        kind: 'compare',
        render(el, ctx) {
          const { h, s } = ctx;
          // each frame: shared memory + per-process register/status
          const RUNS = {
            raw: [
              { cnt: 1, fl: null, A: ['calls semWait(s)', null, 'run'], B: ['calls semWait(s)', null, 'run'], cap: '<b>No protection.</b> A and B run on two processors and call semWait(s) at almost the same moment. s.count = 1, so exactly one of them should get in.' },
              { cnt: 1, fl: null, A: ['reads count', 1, 'run'], B: ['calls semWait(s)', null, 'run'], cap: 'A copies s.count (1) into one of its registers so it can subtract.' },
              { cnt: 1, fl: null, A: ['reads count', 1, 'run'], B: ['reads count', 1, 'run'], cap: 'B does the same, <b>before A has written anything back</b>. Both now hold the value 1.' },
              { cnt: 0, fl: null, A: ['stores 0; 0 < 0? no', 0, 'cs'], B: ['reads count', 1, 'run'], cap: 'A stores 1 − 1 = 0. The test 0 < 0 is false, so A continues into its critical section.' },
              { cnt: 0, fl: null, A: ['in critical section', 0, 'cs'], B: ['stores 0; 0 < 0? no', 0, 'cs'], cap: 'B stores its own 1 − 1 = 0 over A’s result. Its test is false too, so <b>B also continues</b>.', bad: true },
              { cnt: 0, fl: null, A: ['in critical section', 0, 'cs'], B: ['in critical section', 0, 'cs'], cap: '<b>Broken.</b> Both are inside, and s.count says 0 when it should be −1 with B asleep. The semaphore’s own code had a <span class="t">race condition</span>, because semWait was not atomic.', bad: true },
            ],
            cas: [
              { cnt: 1, fl: 0, A: ['calls semWait(s)', null, 'run'], B: ['calls semWait(s)', null, 'run'], cap: '<b>With a flag guarded by compare_and_swap (CAS for short).</b> Same start: s.count = 1, and a small field s.flag = 0 means “nobody is inside semWait or semSignal”.' },
              { cnt: 1, fl: 1, A: ['CAS(flag,0,1) → 0; A got the flag', null, 'run'], B: ['calls semWait(s)', null, 'run'], cap: 'A runs compare_and_swap(s.flag, 0, 1). It returns the old value 0, which means A <b>won</b> the flag (flag is now 1). The hardware reads, compares and writes the flag in one indivisible step, so B cannot win it too.' },
              { cnt: 0, fl: 1, A: ['count: 1 → 0', 0, 'run'], B: ['CAS(flag,0,1) → 1; flag busy: spin', null, 'spin'], cap: 'B’s compare_and_swap returns 1: the flag is taken, so B <b>busy-waits</b> in its tiny loop. Meanwhile A, the only process allowed in, decrements s.count: 1 → 0.' },
              { cnt: 0, fl: 0, A: ['0 < 0? no; flag = 0', 0, 'cs'], B: ['CAS(flag,0,1) → 1; flag busy: spin', null, 'spin'], cap: 'A’s test is false, so A clears the flag and enters its critical section. B spun for only a few instructions.' },
              { cnt: -1, fl: 1, A: ['in critical section', 0, 'cs'], B: ['CAS → 0: got it; count: 0 → −1', -1, 'run'], cap: 'B’s compare_and_swap now succeeds. It decrements s.count: 0 → −1. Negative, so B must block.' },
              { cnt: -1, fl: 0, A: ['in critical section', 0, 'cs'], B: ['queued, blocked; flag = 0', -1, 'blocked'], cap: '<b>Correct.</b> B joins s.queue and blocks, and the flag is released as part of blocking. One process inside, one asleep, s.count = −1.' },
            ],
          };
          let mode = 'raw';
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 230' : '0 0 540 160', width: '100%' });
          function lane(x, name, info, out, oy = 0) {
            const [act, reg, stt] = info, kids = [];
            const cls = stt === 'cs' ? 's-mem' : stt === 'spin' ? 's-intr' : stt === 'blocked' ? 's-warn' : 's-proc';
            kids.push(s('rect', { x, y: 4, width: 170, height: 152, rx: 14, class: 's-cpu', 'stroke-width': 1.5, 'fill-opacity': 0.5 }));
            kids.push(s('text', { x: x + 85, y: 24, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--cpu)' }, `processor ${name === 'A' ? 1 : 2}`));
            kids.push(token(s, x + 42, 58, name, cls, 46, 46));
            kids.push(s('text', { x: x + 118, y: 46, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'register'));
            kids.push(s('rect', { x: x + 88, y: 52, width: 60, height: 28, rx: 6, class: 's-cpu', 'stroke-width': 1.5 }));
            kids.push(s('text', { x: x + 118, y: 72, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, class: 's-monot' }, reg == null ? '–' : String(reg)));
            act.split('; ').forEach((w, i) => kids.push(s('text', { x: x + 85, y: 102 + i * 18, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, w)));
            kids.push(s('text', { x: x + 85, y: 146, 'text-anchor': 'middle', 'font-size': 13, style: `fill:var(${stt === 'cs' ? '--mem' : stt === 'spin' ? '--intr' : stt === 'blocked' ? '--warn' : '--muted'})`, 'font-weight': 700 }, stt === 'cs' ? 'inside critical section' : stt === 'spin' ? 'busy waiting' : stt === 'blocked' ? 'asleep in s.queue' : 'running semWait'));
            out.push(s('g', { transform: `translate(0 ${oy})` }, ...kids));
          }
          function draw(i) {
            const f = RUNS[mode][i], kids = [];
            if (ctx.narrow) {
              // phone: shared memory on top, the two processors side by side underneath
              lane(4, 'A', f.A, kids, 72); lane(186, 'B', f.B, kids, 72);
              kids.push(s('rect', { x: 40, y: 2, width: 280, height: 64, rx: 14, class: f.bad ? 's-bad' : 's-mem', 'stroke-width': 2 }));
              kids.push(s('text', { x: 180, y: 19, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--mem)' }, 'shared memory'));
              const cx = f.fl == null ? 180 : 125;
              kids.push(s('text', { x: cx, y: 36, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 's.count'));
              kids.push(s('text', { x: cx, y: 60, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 900 }, String(f.cnt)));
              if (f.fl != null) {
                kids.push(s('text', { x: 235, y: 36, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 's.flag'));
                kids.push(s('text', { x: 235, y: 60, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 900, style: f.fl ? 'fill:var(--intr)' : '' }, String(f.fl)));
              }
              svg.replaceChildren(...kids);
              return f.bad ? `<span style="color:var(--bad)">${f.cap}</span>` : f.cap;
            }
            lane(4, 'A', f.A, kids); lane(366, 'B', f.B, kids);
            kids.push(s('text', { x: 270, y: 24, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--mem)' }, 'shared memory'));
            kids.push(s('rect', { x: 190, y: 34, width: 160, height: f.fl == null ? 84 : 118, rx: 14, class: f.bad ? 's-bad' : 's-mem', 'stroke-width': 2 }));
            kids.push(s('text', { x: 270, y: 56, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 's.count'));
            kids.push(s('text', { x: 270, y: 98, 'text-anchor': 'middle', 'font-size': 34, 'font-weight': 900 }, String(f.cnt)));
            if (f.fl != null) {
              kids.push(s('text', { x: 270, y: 122, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 's.flag'));
              kids.push(s('text', { x: 270, y: 146, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 900, style: f.fl ? 'fill:var(--intr)' : '' }, String(f.fl)));
            }
            svg.replaceChildren(...kids);
            return f.bad ? `<span style="color:var(--bad)">${f.cap}</span>` : f.cap;
          }
          const player = ctx.ui.player({ count: RUNS.raw.length, render: draw, interval: 2400, speed: false });
          const seg = ctx.ui.seg([{ value: 'raw', label: 'Not atomic' }, { value: 'cas', label: 'Guarded by compare_and_swap' }], mode, (v) => { mode = v; player.stop(); player.setCount(RUNS[v].length); });
          const casCode = `
semWait(s) {                                 // multiprocessor-safe
    while (compare_and_swap(s.flag, 0, 1) == 1) // busy? spin
        /* do nothing */;                    // ...briefly
    s.count--;                               // take one unit
    if (s.count < 0) {                       // none left:
        place this process in s.queue;       // join the line
        block it; also set s.flag to 0;      // sleep, free flag
    }                                        // (else go on)
    s.flag = 0;                              // free the flag
}                                            // end semWait
semSignal(s) {                               // same guard
    while (compare_and_swap(s.flag, 0, 1) == 1) // busy? spin
        /* do nothing */;                    // ...briefly
    s.count++;                               // give a unit back
    if (s.count <= 0) {                      // someone waits:
        remove a process P from s.queue;     // pick a waiter
        place process P on ready list;       // make it Ready
    }                                        // (else nobody)
    s.flag = 0;                              // free the flag
}                                            // end semSignal`;
          const intCode = `
semWait(s) {                             // one-CPU version
    inhibit interrupts;                  // nobody can cut in
    s.count--;                           // take one unit
    if (s.count < 0) {                   // none left:
        place this process in s.queue;   // join the line
        block it; allow interrupts;      // sleep, re-enable
    }                                    // end of none-left case
    else allow interrupts;               // passed: re-enable
}                                        // end semWait
semSignal(s) {                           // one-CPU version
    inhibit interrupts;                  // nobody can cut in
    s.count++;                           // give a unit back
    if (s.count <= 0) {                  // someone waits:
        remove a process P from s.queue; // pick a waiter
        place process P on ready list;   // make it Ready
    }                                    // (else nobody)
    allow interrupts;                    // re-enable
}                                        // end semSignal`;
          const tabs = ctx.ui.tabs([
            { label: 'Hardware: compare_and_swap', render: (p) => { p.append(h('div', { class: 'stack', style: { gap: '8px' } }, ctx.ui.code(casCode, { lang: 'c', fontSize: 13, cls: 'tight' }),
              h('div', { class: 'callout tip small m0', 'data-label': 'Still busy waiting?', html: 'Yes, but only while another process is inside semWait or semSignal: a few instructions, never a whole critical section (the cheap kind of <span class="t">spinlock</span> from 5.3).' }))); } },
            { label: 'One CPU: disable interrupts', render: (p) => { p.append(h('div', { class: 'stack', style: { gap: '8px' } }, ctx.ui.code(intCode, { lang: 'c', fontSize: 13, cls: 'tight' }),
              h('div', { class: 'callout warn small m0', 'data-label': 'Only on a uniprocessor', html: 'With one processor, a process can lose the CPU only through an interrupt, so blocking interrupts makes the few statements indivisible. On a multiprocessor another core can still reach the semaphore, so this trick is not enough there.' }))); } },
          ]);
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 11fr) minmax(0, 12fr)', gap: '20px' } },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0 small', html: 'semWait and semSignal change shared data too, so each must be <span class="t" data-t="atomic operation">atomic</span>: only one process at a time may run either operation on a given semaphore.' }),
              seg,
              h('div', { class: 'card white tight' }, svg),
              player.el,
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters' }, 'A software lock such as Peterson’s algorithm would also work, but it is slow. Real systems use one of the two hardware routes shown here, which guard only a few instructions, so every longer wait can sleep instead of spin.')),
            h('div', { class: 'stack fill' }, tabs)));
        },
      },

      /* ---------------- 9. Recap ---------------- */
      {
        title: 'Recap: eight things to remember',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['semWait(s)', 'Subtract 1. If the result is negative, the caller is placed in the queue and blocked.'],
              ['semSignal(s)', 'Add 1. If the result is ≤ 0, move one waiter to Ready. The caller itself never blocks.'],
              ['Reading the value', 'Positive: how many more semWaits can pass. Negative: its magnitude is the number of blocked processes.'],
              ['Binary, counting, mutex', 'Binary holds only 0 or 1. Counting holds any integer. A mutex is binary plus ownership: only the locker may unlock.'],
              ['Strong vs weak', 'Strong releases waiters first in, first out, so none can starve. Weak leaves the order unspecified.'],
              ['Mutual exclusion recipe', 's starts at 1; semWait(s); critical section; semSignal(s). Three arrivals take s to 1 → 0 → −1 → −2.'],
              ['Bounded buffer recipe', 's = 1, n = 0, e = size. Producer: wait e, wait s, append, signal s, signal n. Consumer: wait n, wait s, take, signal s, signal e.'],
              ['Why atomic?', 'The operations update shared data. Guard them with compare_and_swap (a short spin) or, on one CPU, by disabling interrupts.'],
            ], { cols: 4, height: 186 }),
            h('div', { class: 'callout warn m0', 'data-label': 'The two classic traps' }, 'Testing a shared variable after you have released its lock (the flawed infinite buffer), and taking the lock before waiting for a resource (the swapped bounded-buffer consumer, which deadlocks).')));
        },
      },

      /* ---------------- 10. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'A counting semaphore <code>s</code> has the value 0. Process P calls <code>semWait(s)</code>. What happens?',
            choices: ['s becomes −1 and P blocks.', 's stays 0 and P blocks.', 's becomes −1 and P continues.', 'P busy-waits until s becomes positive.'], answer: 0,
            feedback: [null, 'That is how a binary semaphore behaves. A counting semaphore always decrements, so the value becomes −1.', 'A process continues only if the result is zero or more; −1 is negative, so P must block.', 'A semaphore puts the caller to sleep in its queue; it does not make it spin.'],
            why: 'semWait always subtracts 1 first. A negative result means no unit was available, so the caller joins the queue and is blocked.' },
          { type: 'num', q: 'A counting semaphore s counts the results produced by process D and starts at 1. Consumers A, B and C each call semWait(s) once, in that order, and then D calls semSignal(s) once. What is the value of s now?', answer: -1, tol: 0, hint: 'Apply one −1 per semWait and one +1 per semSignal.',
            why: '1 − 3 = −2 after the three waits: A passed, B and C are blocked. D’s signal gives −2 + 1 = −1 and releases B, the front waiter; the −1 says C is still waiting.' },
          { type: 'num', q: 'Three processes share a critical section guarded by a semaphore initialized to 1. Each calls semWait in turn, and none has left the critical section yet. What is the semaphore’s value?', answer: -2, tol: 0, hint: 'The answer may be negative. Count one step per semWait.',
            why: '1 → 0 (the first enters) → −1 (the second blocks) → −2 (the third blocks). The magnitude 2 is the number of waiting processes.' },
          { type: 'tf', q: 'A binary semaphore has the value 1 and no process is waiting on it. After one more semSignalB, its value is 2.', answer: false,
            why: 'A binary semaphore can only hold 0 or 1. With nobody waiting, semSignalB just sets the value to 1, so a second signal in a row is lost. Counting extra signals needs a counting semaphore.' },
          { type: 'multi', q: 'Which statements follow directly from the definition of a semaphore?',
            choices: ['A process cannot know in advance whether its semWait will block.', 'After a semSignal that wakes a waiter, the order in which the two processes continue is not specified.', 'A process calling semSignal cannot tell whether any process was waiting.', 'semSignal releases every waiting process at once.', 'A semaphore’s value can never be negative.'], answer: [0, 1, 2],
            why: 'The first three are the standard consequences. semSignal releases at most one process, and a negative value is normal: it counts the waiters.' },
          { q: 'Which kind of semaphore guarantees that a blocked process cannot be passed over forever?',
            choices: ['A strong semaphore, which releases waiters first in, first out', 'A weak semaphore, because it chooses at random', 'A binary semaphore', 'Any semaphore, because semSignal wakes the newest waiter'], answer: 0,
            feedback: [null, 'A random choice can skip the same unlucky process again and again, which is starvation.', 'Binary versus counting is about the range of values, not the order in which waiters are released.', 'Release order is exactly what differs between semaphores, and newest-first would let the oldest waiter starve.'],
            why: 'A strong semaphore serves its queue in arrival order, so every waiter eventually reaches the front. A weak semaphore makes no such promise.' },
          { type: 'match', q: 'Match each concurrency mechanism to its description.',
            pairs: [['Semaphore', 'An integer changed only by initialize, semWait and semSignal'], ['Mutex', 'Only the process that locked it may unlock it'], ['Spinlock', 'A waiter loops, testing the lock until it frees up'], ['Event flags', 'Each bit of a memory word stands for one event'], ['Mailbox', 'Holds messages until a receiver collects them'], ['Monitor', 'Bundles shared data with the only procedures allowed to use it']],
            why: 'These are the common tools. Semaphores and mutexes block the waiter; a spinlock makes it busy-wait; event flags and mailboxes signal events and data; a monitor is a language-level construct.' },
          { type: 'order', q: 'Put the bounded-buffer producer’s loop body in order.',
            items: ['produce()', 'semWait(e)', 'semWait(s)', 'append()', 'semSignal(s)', 'semSignal(n)'],
            why: 'Make the item, claim an empty slot (e), lock the buffer (s), add the item, unlock, then announce the new item (n).' },
          { type: 'bucket', q: 'Bounded buffer: sort each fact to the semaphore (s, n or e) it describes.', buckets: ['s', 'n', 'e'],
            items: [['Initialized to 1', 0], ['Initialized to 0', 1], ['Initialized to the buffer size', 2], ['The consumer waits on it before taking an item', 1], ['The producer waits on it when every slot is full', 2], ['Keeps append() and take() from overlapping', 0]],
            why: 's is the lock (starts at 1), n counts items (starts at 0), and e counts empty slots (starts at the buffer size).' },
          { q: 'In the bounded-buffer consumer, what can happen if <code>semWait(s)</code> is called before <code>semWait(n)</code>?',
            choices: ['Deadlock: with an empty buffer the consumer sleeps on n while holding s, so the producer can never add an item', 'Nothing: the order of the two semWait calls never matters', 'The consumer may take an item that does not exist', 'The producer may overwrite an item that has not been consumed'], answer: 0,
            feedback: [null, 'It matters as soon as the buffer is empty, which is exactly when the consumer blocks.', 'n still stops the consumer from taking from an empty buffer; it blocks instead, and blocking while holding s is the problem.', 'e still protects the producer’s slots; the issue is the consumer holding the lock while asleep.'],
            why: 'The consumer grabs s, then blocks on n. The producer finishes an item but blocks on s, which the sleeping consumer holds. Each waits for the other forever.' },
          { q: 'In the flawed binary-semaphore producer/consumer with an infinite buffer (variables n and delay), why can the consumer end up consuming an item that does not exist?',
            choices: ['It tests n outside the critical section, so the producer can change n in between and leave a stale signal in delay', 'The producer forgets to lock the buffer before appending', 'delay is initialized to 1 instead of 0', 'Binary semaphores cannot provide mutual exclusion'], answer: 0,
            feedback: [null, 'The producer does lock s around append and n++.', 'delay starts at 0 in that solution; the problem comes later, from timing.', 's works perfectly well as a lock; the bug is reading n after releasing it.'],
            why: 'The unmatched signal stored in delay later lets the consumer pass semWaitB(delay) when the buffer is empty. Saving n into a private m inside the critical section, or using a counting semaphore, fixes it.' },
          { q: 'On a single-processor machine, what is a simple way to make semWait and semSignal atomic?',
            choices: ['Disable interrupts at the start of the operation and re-enable them at the end', 'Protect the semaphore with a second semaphore', 'Give every process the same priority', 'Busy-wait for the whole critical section'], answer: 0,
            feedback: [null, 'The second semaphore’s operations would need protecting too, so the problem just moves.', 'Equal priorities do not stop an interrupt from switching processes halfway through the operation.', 'That is the waste semaphores exist to avoid; only the few instructions inside the operation need protecting.'],
            why: 'On one processor a process loses the CPU only through an interrupt, so blocking interrupts makes those few statements indivisible. Multiprocessors instead use an instruction such as compare_and_swap.' },
        ],
      },
    ],
    notes: `
<h3>The core idea: stop here until you get a signal</h3>
<p>Processes can cooperate using simple signals: a process can be forced to halt at a chosen point in its code until a particular signal arrives. The variable that carries signals is a <b>semaphore</b>: <code>semSignal(s)</code> sends one, <code>semWait(s)</code> receives one, and if no signal has been sent yet the receiver is suspended until it is.</p>
<h4>The concurrency toolbox</h4>
<table>
  <tr><th>Mechanism</th><th>What it is</th></tr>
  <tr><td>Semaphore</td><td>Integer changed only by initialize, semWait, semSignal.</td></tr>
  <tr><td>Binary semaphore</td><td>Semaphore holding only 0 or 1.</td></tr>
  <tr><td>Mutex</td><td>Binary lock; the process that locks it (sets 0) must be the one to unlock it (set 1).</td></tr>
  <tr><td>Condition variable</td><td>Queue a process joins to wait until some condition holds (5.5).</td></tr>
  <tr><td>Monitor</td><td>Language construct bundling shared data and its procedures; one process active inside at a time.</td></tr>
  <tr><td>Event flags</td><td>Memory word, one bit per event; wait for one, any or all flags.</td></tr>
  <tr><td>Mailboxes / messages</td><td>Messages wait in a mailbox until received; waiting for one also synchronizes.</td></tr>
  <tr><td>Spinlock</td><td>Waiter busy-waits in a loop until the lock is free.</td></tr>
</table>
<h3>Definition: one integer, three operations</h3>
<ol>
  <li><b>Initialize</b> the semaphore to a nonnegative integer.</li>
  <li><b>semWait(s)</b> decrements the value; if it becomes negative, the caller is blocked in the semaphore's queue, otherwise it continues.</li>
  <li><b>semSignal(s)</b> increments the value; if it is then ≤ 0, one blocked process is moved to Ready. The caller never blocks.</li>
</ol>
<pre>semWait(s):   s.count--;  if (s.count &lt; 0)  { add caller to s.queue; block it; }
semSignal(s): s.count++;  if (s.count &lt;= 0) { remove P from s.queue; make P ready; }</pre>
<h4>Three consequences</h4>
<ul>
  <li>A process cannot know in advance whether its semWait will block.</li>
  <li>After a semSignal wakes a waiter, both continue concurrently in an unknown order.</li>
  <li>A signalling process does not learn whether anyone was waiting (it released one process or none).</li>
</ul>
<h4>Reading the value</h4>
<p><b>Positive:</b> how many more processes can call semWait and continue. <b>Zero:</b> no units left, nobody waiting. <b>Negative:</b> its magnitude is the number of blocked processes (−3 means three are asleep). Blocked processes use no processor time, unlike busy waiting.</p>
<h3>Kinds of semaphore</h3>
<table>
  <tr><th>Kind</th><th>Values</th><th>Behaviour</th></tr>
  <tr><td>Counting (general)</td><td>any integer</td><td>As defined above.</td></tr>
  <tr><td>Binary</td><td>0 or 1</td><td>semWaitB: if 1, set to 0 and continue, else block. semSignalB: if nobody waits, set to 1, else release one waiter (value stays 0). A signal while already 1 is lost.</td></tr>
  <tr><td>Mutex</td><td>locked / unlocked</td><td>Binary lock with ownership: only the locker may unlock.</td></tr>
</table>
<p>Blocked processes wait in a <b>queue</b>. A <b>strong semaphore</b> releases them first-in-first-out, so none can starve. A <b>weak semaphore</b> leaves the order unspecified, so a process may be passed over again and again (starvation).</p>
<h3>Worked trace: one producer, three consumers</h3>
<p>A, B and C each need a result produced by D. D announces each result with semSignal; a consumer claims one with semWait. s starts at 1 (one result waiting); strong semaphore.</p>
<table>
<tr><th>Operation</th><th>s</th><th>Queue</th><th>Operation</th><th>s</th><th>Queue</th></tr>
<tr><td>1 A wait</td><td>0</td><td>–</td><td>6 B wait</td><td>−3</td><td>C A B</td></tr>
<tr><td>2 B wait</td><td>−1</td><td>B</td><td>7 D signal (C freed)</td><td>−2</td><td>A B</td></tr>
<tr><td>3 D signal (B freed)</td><td>0</td><td>–</td><td>8 D signal (A freed)</td><td>−1</td><td>B</td></tr>
<tr><td>4 C wait</td><td>−1</td><td>C</td><td>9 D signal (B freed)</td><td>0</td><td>–</td></tr>
<tr><td>5 A wait</td><td>−2</td><td>C A</td><td>10 D signal (saved)</td><td>1</td><td>–</td></tr>
</table>
<h3>Mutual exclusion with one semaphore</h3>
<pre>semaphore s = 1;
void P(int i) { while (true) { semWait(s); /* critical section */; semSignal(s); /* remainder */; } }
void main() { parbegin (P(1), P(2), P(3)); }</pre>
<p>The start value is how many may be inside at once, so it must be 1 (2 would let two in). If A, B, C call semWait in turn, s goes 1 → 0 (A enters) → −1 (B blocks) → −2 (C blocks). A's semSignal gives −1 and releases B into the critical section; B's gives 0 and releases C; C's returns s to 1.</p>
<h3>Producer/consumer with an infinite buffer</h3>
<p>The producer appends at <code>in</code>, the consumer takes at <code>out</code>; never take from an empty buffer, never touch the buffer at the same time.</p>
<h4>Flawed solution with binary semaphores</h4>
<pre>int n = 0; binary_semaphore s = 1, delay = 0;
producer: produce(); semWaitB(s); append(); n++; if (n == 1) semSignalB(delay); semSignalB(s);
consumer: semWaitB(delay); loop { semWaitB(s); take(); n--; semSignalB(s); consume(); if (n == 0) semWaitB(delay); }</pre>
<p>The bug: the consumer tests n <b>after</b> releasing s. If the producer runs in that gap, it adds an item and, since n == 1, signals delay although nobody waits (delay = 1). The consumer skips waiting, consumes that item, finds n == 0 and calls semWaitB(delay), which the stale 1 lets through. It then consumes an item that does not exist, and n = −1.</p>
<p><b>Fix:</b> inside the critical section copy n into a private variable (<code>m = n</code>) and test <code>if (m == 0)</code> afterwards.</p>
<h4>Correct solution with counting semaphores</h4>
<pre>semaphore n = 0, s = 1;
producer: produce(); semWait(s); append(); semSignal(s); semSignal(n);
consumer: semWait(n); semWait(s); take(); semSignal(s); consume();</pre>
<p>n counts items, so the count and the wake-up can never disagree. Swapping the producer's two semSignal calls is harmless.</p>
<h3>Bounded (circular) buffer</h3>
<p>The buffer has a fixed size and is used in a circle: <code>in = (in + 1) % size</code>, <code>out = (out + 1) % size</code>. Three semaphores:</p>
<ul>
  <li><b>s = 1</b>: mutual exclusion on the buffer.</li>
  <li><b>n = 0</b>: number of items ready (the consumer waits on it when the buffer is empty).</li>
  <li><b>e = size</b>: number of empty slots (the producer waits on it when the buffer is full).</li>
</ul>
<pre>producer: produce(); semWait(e); semWait(s); append(); semSignal(s); semSignal(n);
consumer: semWait(n); semWait(s); take(); semSignal(s); semSignal(e); consume();</pre>
<p><b>Order matters.</b> If the consumer called semWait(s) before semWait(n) with the buffer empty, it would block on n while holding s; the producer would block on s, and neither could continue: a <b>deadlock</b>. The bug only strikes when the buffer is empty, so it can hide in testing.</p>
<h3>Implementing semaphores: the operations must be atomic</h3>
<p>semWait and semSignal update shared data (count and queue). Run concurrently, both could read count = 1, both store 0, and both enter. Only one process at a time may be inside either operation on a semaphore.</p>
<ul>
  <li><b>Hardware (multiprocessors):</b> guard a <code>s.flag</code> with <code>while (compare_and_swap(s.flag, 0, 1) == 1) ;</code> at the start and <code>s.flag = 0</code> at the end (a blocking process frees the flag as it blocks). The busy waiting lasts only for the few instructions of the operation, never a whole critical section.</li>
  <li><b>Disabling interrupts (one processor only):</b> inhibit interrupts at the start, allow them at the end (or as the caller blocks). With one CPU a process loses the processor only through an interrupt, so the operation becomes indivisible; another core on a multiprocessor is not stopped.</li>
</ul>`,
  });
})();
