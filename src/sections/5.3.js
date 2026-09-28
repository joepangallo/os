/* =====================================================================
   5.3  Mutual Exclusion: Hardware Support
   Two kinds of help from the hardware: (1) switching interrupts off on a
   single processor, (2) atomic machine instructions (compare_and_swap and
   exchange) that let any number of processes, on any number of processors
   sharing memory, build a spinlock. Then the price: busy waiting,
   starvation and a priority deadlock.
   All helpers live in this IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {
  /* ---------------- small shared helpers ---------------- */
  const PN = (i) => `<b class="pc${i}">P${i}</b>`;                 // coloured process name
  const TOK = (i) => `<span class="tok p${i}">P${i}</span>`;       // pill-shaped process token

  /* A code listing (ctx.ui.code) with an extra gutter that can hold process markers.
     marks({ 3: [1, 2] }) puts P1 and P2 pointers on line 3 and tints that line. */
  function listing(ctx, src, o = {}) {
    const pre = ctx.ui.code(src, Object.assign({ lang: 'c' }, o));
    const lines = Array.from(pre.querySelectorAll('.ln'));
    const guts = lines.map((ln) => { const g = ctx.h('span', { class: 'gut' }); ln.prepend(g); return g; });
    pre.marks = (map) => {
      lines.forEach((ln, k) => {
        const who = (map && map[k + 1]) || [];
        guts[k].innerHTML = who.map((i) => `<i class="mk p${i}">P${i}</i>`).join('');
        ln.classList.toggle('on1', who.length === 1);
        ln.classList.toggle('on2', who.length > 1);
        ln.dataset.who = who.length === 1 ? who[0] : '';
      });
    };
    return pre;
  }

  /* A memory cell: name on top, big value underneath. */
  function cell(ctx, name, cls = '') {
    const v = ctx.h('div', { class: 'v' });
    const el = ctx.h('div', { class: 'cell ' + cls }, ctx.h('div', { class: 'nm', html: name }), v);
    el.set = (val, flash) => { v.innerHTML = String(val); if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } };
    return el;
  }

  /* A verdict box whose colour follows the outcome (ok | bad | warn | info). */
  function verdict(ctx) {
    const el = ctx.h('div', { class: 'vbox', 'aria-live': 'polite' });
    el.say = (cls, html) => { el.className = 'vbox ' + (cls || ''); el.innerHTML = html; };
    return el;
  }

  Guide.section({
    id: '5.3',
    title: 'Mutual Exclusion: Hardware Support',
    short: 'Hardware support',
    summary: 'Disabling interrupts, compare_and_swap and exchange: how hardware makes locks, and what they cost.',
    objectives: [
      'Explain why disabling interrupts guarantees mutual exclusion on a uniprocessor, and name its two costs.',
      'Trace compare_and_swap and exchange step by step, and use each one to build a spinlock.',
      'Explain why the read and the write of a lock must happen as one atomic instruction.',
      'State and check the exchange invariant: bolt plus the sum of all keys equals n.',
      'List the advantages and disadvantages of the machine-instruction approach, including busy waiting, starvation and the priority deadlock.',
    ],
    terms: [
      ['Uniprocessor', 'A computer with exactly one processor. Its processes can take turns (interleave) but never run at the same instant.'],
      ['Multiprocessor', 'A computer with two or more processors that share one main memory. Processes on different processors really do run at the same instant.'],
      ['Interleaving', 'Running pieces of several processes one after another on a processor, switching between them, so they appear to run together.'],
      ['Overlapping (true parallelism)', 'Two processes executing at literally the same moment, which is only possible when there is more than one processor.'],
      ['Interrupt', 'A signal from hardware (a timer, a disk, a network card) that makes the processor pause the running program and jump to operating-system code. The OS may then switch to another process.'],
      ['Interrupt disabling', 'Getting mutual exclusion on one processor by switching interrupts off just before a critical section and back on just after it, so nothing can take the processor away in between.'],
      ['Pending interrupt', 'An interrupt that arrived while interrupts were switched off. The hardware remembers it and delivers it as soon as interrupts are switched back on.'],
      ['Privileged instruction', 'An instruction that only the operating system kernel may execute. Switching interrupts off is one, so ordinary programs cannot use it.'],
      ['Critical section', 'A stretch of code that uses a shared resource. While one process is inside it, no other process may be inside a critical section for that same resource.'],
      ['Mutual exclusion', 'The guarantee that while one process is inside its critical section for a resource, no other process is inside a critical section for that same resource.'],
      ['Atomic instruction', 'A machine instruction whose parts (for example, read a memory word and then write it) happen as one indivisible action. No other process or processor can get in between the parts.'],
      ['compare_and_swap (compare and exchange)', 'An atomic instruction that reads a memory word, compares it with a test value, writes a new value only if the two match, and returns the old value. Often abbreviated CAS.'],
      ['Exchange instruction', 'An atomic instruction that swaps the contents of a register and a memory word in one indivisible step.'],
      ['Lock variable (bolt)', 'A shared memory word that says whether the lock is free (0) or taken (1). In this section it is called bolt.'],
      ['Invariant', 'A condition on a program’s variables that must be true whenever no update is in progress. In the exchange lock every update is one atomic swap, so the invariant holds after every step, which makes it a tool for proving the lock correct.'],
      ['Busy waiting (spin waiting)', 'Waiting by running a loop that tests a condition again and again. The waiting process keeps using processor time while doing no useful work.'],
      ['Spinlock', 'A lock where a process that finds it taken busy-waits, testing it over and over, until it becomes free.'],
      ['Starvation', 'A situation in which a process that wants to enter waits indefinitely because others are always chosen ahead of it.'],
      ['Deadlock', 'A permanent standstill: each process in a group waits for something that only another waiting process in the group can provide, so none can ever continue.'],
      ['Priority scheduling', 'A dispatching rule that always gives the processor to the highest-priority process that is ready to run.'],
    ],
    css: `
      .sec-5-3 pre.code { contain: inline-size; }
      .sec-5-3 .step-eyebrow { contain: inline-size; }   /* shell workaround: a long nowrap eyebrow must not widen the phone layout */
      .sec-5-3 .pc1 { color: var(--proc); } .sec-5-3 .pc2 { color: var(--accent); } .sec-5-3 .pc3 { color: var(--io); }
      .sec-5-3 .tok { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 26px; padding: 0 8px; border-radius: 999px; border: 2px solid; font-weight: 800; font-size: 14px; line-height: 1; }
      .sec-5-3 .tok.p1 { color: var(--proc); background: var(--proc-bg); border-color: var(--proc); }
      .sec-5-3 .tok.p2 { color: var(--accent); background: var(--accent-bg); border-color: var(--accent); }
      .sec-5-3 .tok.p3 { color: var(--io); background: var(--io-bg); border-color: var(--io); }
      .sec-5-3 pre.code .gut { display: inline-flex; gap: 2px; width: 50px; vertical-align: top; }
      .sec-5-3 pre.code .mk { font-style: normal; font-family: var(--font); font-size: 11px; font-weight: 800; line-height: 1; padding: 3px 4px; border-radius: 5px; color: var(--accent-ink); }
      .sec-5-3 pre.code .mk.p1 { background: var(--proc); } .sec-5-3 pre.code .mk.p2 { background: var(--accent); } .sec-5-3 pre.code .mk.p3 { background: var(--io); }
      .sec-5-3 pre.code .ln.on2 { background: color-mix(in srgb, var(--ink) 8%, transparent); border-left-color: var(--ink-2); }
      .sec-5-3 pre.code .ln.on1[data-who="1"] { background: color-mix(in srgb, var(--proc) 14%, transparent); border-left-color: var(--proc); }
      .sec-5-3 pre.code .ln.on1[data-who="2"] { background: color-mix(in srgb, var(--accent) 14%, transparent); border-left-color: var(--accent); }
      .sec-5-3 pre.code .ln.on1[data-who="3"] { background: color-mix(in srgb, var(--io) 14%, transparent); border-left-color: var(--io); }
      .sec-5-3 .cell { border: 2px solid var(--mem); background: var(--mem-bg); border-radius: 10px; padding: 3px 8px; text-align: center; min-width: 0; }
      .sec-5-3 .cell .nm { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--ink-2); }
      .sec-5-3 .cell .v { font-family: var(--mono); font-size: 22px; font-weight: 800; line-height: 1.25; }
      .sec-5-3 .cell.cpu { border-color: var(--cpu); background: var(--cpu-bg); }
      .sec-5-3 .vbox { border-radius: 12px; padding: 8px 12px; border: 1px solid var(--line); border-left: 5px solid var(--accent); background: var(--panel-2); font-size: 15px; line-height: 1.45; }
      .sec-5-3 .vbox.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-5-3 .vbox.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-5-3 .vbox.warn { border-left-color: var(--warn); background: var(--warn-bg); }
      .sec-5-3 .vbox.info { border-left-color: var(--info); background: var(--info-bg); }
      .sec-5-3 .hot { cursor: pointer; }
      .sec-5-3 .room { border: 2px dashed var(--line-2); border-radius: 12px; padding: 6px 10px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 64px; min-width: 240px; background: var(--panel); }
      .sec-5-3 .room .xs { font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
      .sec-5-3 .room.one { border-style: solid; border-color: var(--ok); background: var(--ok-bg); }
      .sec-5-3 .room.two { border-style: solid; border-color: var(--bad); background: var(--bad-bg); }
      .sec-5-3 .log > div.bad { color: var(--bad); font-weight: 700; }
      .sec-5-3 .log > div.ok { color: var(--ok); font-weight: 700; }
      .sec-5-3 .log > div.spin { color: var(--muted); }
      .sec-5-3 .pc4 { color: var(--thread); }
      .sec-5-3 .tok.p4 { color: var(--thread); background: var(--thread-bg); border-color: var(--thread); }
      .sec-5-3 .tok.win { box-shadow: 0 0 0 3px var(--hl); }
      .sec-5-3 .legend-sw { display: inline-block; width: 14px; height: 14px; border-radius: 4px; border: 2px solid; vertical-align: -2px; margin-right: 4px; }
      .sec-5-3 .vbox .btn { margin: 4px 6px 0 0; }
      .sec-5-3 svg .cl-rem { fill: color-mix(in srgb, var(--proc) 22%, var(--panel)); stroke: var(--proc); }
      .sec-5-3 svg .cl-spin { fill: color-mix(in srgb, var(--warn) 45%, var(--panel)); stroke: var(--warn); }
      .sec-5-3 svg .cl-in { fill: color-mix(in srgb, var(--ok) 45%, var(--panel)); stroke: var(--ok); }
      .sec-5-3 .sb-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding: 5px 8px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); font-size: 14.5px; line-height: 1.3; }
      .sec-5-3 .sb-row.good { border-color: var(--ok); background: var(--ok-bg); }
      .sec-5-3 .sb-row.oops { border-color: var(--bad); background: var(--bad-bg); }
    `,
    steps: [
      /* ============ 1. Big Picture: the gap between "look" and "lock" ============ */
      {
        title: 'Let the hardware referee',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          const svg = s('svg', { viewBox: '0 0 640 250', width: '100%', role: 'img', 'aria-label': 'Timeline of P1 taking a lock, and where P2 can slip in' });
          const cap = h('div', { class: 'vbox' });
          const blk = (x, w, y, label, cls, o = {}) => s('g', {},
            s('rect', { x, y, width: w, height: 46, rx: 9, class: cls, 'stroke-width': 2, 'stroke-dasharray': o.dash ? '6 5' : null }),
            s('text', { x: x + w / 2, y: y + 29, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700 }, label));
          const arrowUp = (x, y1, y2, cls) => s('line', { x1: x, y1, x2: x, y2, class: 's-line', 'stroke-width': 2.5, 'marker-end': `url(#arr-${cls})`, style: `stroke:var(--${cls})` });
          const MODES = {
            none: {
              draw: () => [
                blk(20, 210, 70, 'look: is bolt 0? yes', 's-proc'),
                blk(230, 130, 70, 'gap', 's-warn', { dash: true }),
                blk(360, 150, 70, 'lock: bolt = 1', 's-proc'),
                blk(510, 110, 70, 'inside', 's-bad'),
                arrowUp(295, 205, 124, 'bad'),
                s('text', { x: 295, y: 228, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700, style: 'fill:var(--bad)' }, 'P2 runs in the gap: looks (0), locks, goes inside'),
              ],
              cap: ['bad', '<b>No help.</b> P1 has looked but not yet locked when P2 gets to bolt (after a switch on one processor, or at the same moment from a second processor). P2 also sees bolt = 0, so <b>both</b> processes walk into their critical sections.'],
            },
            off: {
              draw: () => [
                s('rect', { x: 14, y: 58, width: 612, height: 70, rx: 12, class: 's-os', 'stroke-width': 2, 'fill-opacity': 0.5 }),
                s('text', { x: 320, y: 50, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--os)' }, 'interrupts switched OFF for this whole stretch'),
                blk(20, 190, 70, 'look: bolt is 0', 's-proc'),
                blk(210, 90, 70, 'gap', 's-panel', { dash: true }),
                blk(300, 160, 70, 'lock: bolt = 1', 's-proc'),
                blk(460, 160, 70, 'inside, then ON', 's-ok'),
                arrowUp(255, 205, 136, 'muted'),
                s('text', { x: 255, y: 150, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 900, style: 'fill:var(--bad)' }, '✗'),
                s('text', { x: 255, y: 228, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700, style: 'fill:var(--muted)' }, 'no interrupt, so no switch: P2 cannot run yet'),
              ],
              cap: ['ok', '<b>Route 1: switch off interrupts.</b> The gap is still there, but on a single processor nothing can take the processor away from P1, so nobody can run in it. (With interrupts off for the whole critical section, the bolt is not even needed. A second processor, though, would not need a switch to get in. More on that soon.)'],
            },
            atomic: {
              draw: () => [
                blk(20, 350, 70, 'compare_and_swap: look AND lock', 's-cpu'),
                blk(370, 250, 70, 'inside', 's-ok'),
                s('text', { x: 195, y: 142, 'text-anchor': 'middle', 'font-size': 13.5, style: 'fill:var(--cpu)', 'font-weight': 700 }, 'one indivisible instruction: no gap'),
                arrowUp(560, 205, 124, 'warn'),
                s('text', { x: 440, y: 228, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700, style: 'fill:var(--warn)' }, 'P2 reaches bolt only after it: sees 1, waits'),
              ],
              cap: ['ok', '<b>Route 2: one atomic instruction.</b> The hardware does the look and the lock as a single step. Even from another processor, P2 can reach bolt only before or after that step, never in the middle, so it finds bolt = 1 and waits.'],
            },
          };
          const lanes = () => [
            s('text', { x: 20, y: 24, 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.06em' }, 'P1 TAKES THE LOCK   ·   TIME →'),
          ];
          function show(m) {
            svg.replaceChildren(...lanes(), ...MODES[m].draw());
            cap.className = 'vbox ' + MODES[m].cap[0];
            cap.innerHTML = MODES[m].cap[1];
          }
          const seg = ctx.ui.seg([
            { value: 'none', label: 'No help' },
            { value: 'off', label: 'Route 1: interrupts off' },
            { value: 'atomic', label: 'Route 2: atomic instruction' },
          ], 'none', show);
          show('none');
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'In 5.1, processes got <span class="t">mutual exclusion</span> for a <span class="t">critical section</span> using only ordinary reads and writes. It works, but the code is subtle.' }),
              h('p', { class: 'm0', html: 'Every lock boils down to two moves on a shared <span class="t" data-t="lock variable">lock variable</span>, which we will call <code>bolt</code>: <b>look</b> (is it 0, free?) and <b>lock</b> (set it to 1, taken). The danger is the <b>gap</b> between them. The hardware can close it in two ways:' }),
              h('ol', { class: 'm0', html: '<li><b>Switch off interrupts</b>, so nothing else can run during the gap (one processor only).</li><li><b>Special machine instructions</b> that look and lock as one indivisible step, so there is no gap at all.</li>' }),
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A shared room with a paper sign. You read FREE, then reach for a pen to write TAKEN. If a roommate reads the sign in between, you both walk in. A real door <b>bolt</b> fixes this: sliding it checks and locks in one motion, and if it is already shut, it will not slide.' })),
            h('div', { class: 'card stack' },
              h('h4', { class: 'm0' }, 'Where can another process slip in?'),
              seg,
              h('div', { class: 'card white grow', style: { display: 'grid', placeItems: 'center', padding: '8px' } }, svg),
              cap,
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs b muted' }, 'COMING UP:'), ...['fire interrupts at a process', 'break a two-step lock', 'open up compare_and_swap', 'watch spinners starve', 'trigger a priority deadlock'].map((t) => h('span', { class: 'chip accent' }, t))))));
        },
      },

      /* ============ 2. Route 1: switch off interrupts (lab, one processor) ============ */
      {
        title: 'Route 1: switch off interrupts (one processor)',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const SRC = {
            prot: `/* remainder */         // other work; can be switched out
disable interrupts;     // from now on, no switch can happen
reg = count;            // in critical section: read count
count = reg + 1;        // in critical section: write count+1
enable interrupts;      // switches allowed again`,
            unprot: `/* remainder */         // other work; can be switched out
/* (no disable) */      // unprotected: nothing stops a switch
reg = count;            // in critical section: read count
count = reg + 1;        // in critical section: write count+1
/* (no enable) */       // unprotected: nothing to undo`,
          };
          let S, code, busy = false, gen = 0;   // gen: bumped by every reset so an older replay loop stops
          const codeBox = h('div');
          const cpuRun = h('span', { class: 'tok p1' }, 'P1');
          const intChip = h('span', { class: 'chip ok' });
          const pendChip = h('span', { class: 'chip' });
          const cCount = cell(ctx, 'count'), cR1 = cell(ctx, 'P1 reg', 'cpu'), cR2 = cell(ctx, 'P2 reg', 'cpu');
          const tally = h('div', { class: 'small' });
          const say = verdict(ctx);
          const log = h('div', { class: 'log grow', style: { minHeight: '60px' } });
          const bRun = h('button', { class: 'btn primary', type: 'button', onclick: () => !busy && act('run') }, 'Run next line');
          const bInt = h('button', { class: 'btn intr', type: 'button', onclick: () => !busy && act('timer') }, 'Timer interrupt!');
          const bReplay = h('button', { class: 'btn sm', type: 'button', onclick: () => replay() }, 'Replay a risky timing');
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { busy = false; reset(S.mode); } }, 'Reset');
          const seg = ctx.ui.seg([{ value: 'prot', label: 'Protected (interrupts off)' }, { value: 'unprot', label: 'Unprotected' }], 'prot', (m) => { busy = false; reset(m); });
          const skip = (m, pc) => (m === 'unprot' && (pc === 1 || pc === 4));
          const nextPc = (m, pc) => { let n = (pc + 1) % 5; while (skip(m, n)) n = (n + 1) % 5; return n; };
          const inside = (pc) => pc === 2 || pc === 3;

          function reset(mode) {
            gen++;
            S = { mode, run: 1, pc: { 1: 0, 2: 0 }, reg: { 1: '–', 2: '–' }, count: 0, done: 0, ints: true, pending: false, violated: false, lost: false };
            code = listing(ctx, SRC[mode], { fontSize: 14 });
            if (mode === 'unprot') code.mark([2, 5], 'dim');
            codeBox.replaceChildren(code);
            log.replaceChildren(h('div', { class: 'spin ph' }, 'Events appear here, newest first.'));
            paint(mode === 'prot'
              ? ['info', '<b>Your move.</b> P1 is running. Press <b>Run next line</b> to execute its highlighted line, and fire the <b>Timer interrupt</b> whenever you like. Try to switch to P2 while P1 is inside its critical section.']
              : ['warn', '<b>Unprotected.</b> Same program, but nothing switches interrupts off. Run P1 into its critical section, then fire the timer. What happens?']);
          }
          function note(txt, cls) { const ph = log.querySelector('.ph'); if (ph) ph.remove(); log.prepend(h('div', { class: cls || '', html: txt })); }
          function paint(v) {
            const other = S.run === 1 ? 2 : 1;
            const map = {};
            [1, 2].forEach((p) => { (map[S.pc[p] + 1] = map[S.pc[p] + 1] || []).push(p); });
            code.marks(map);
            code.querySelectorAll('.mk.p' + other).forEach((m) => (m.style.opacity = 0.4));
            cpuRun.className = 'tok p' + S.run; cpuRun.textContent = 'P' + S.run;
            intChip.className = 'chip ' + (S.ints ? 'ok' : 'os'); intChip.textContent = 'interrupts ' + (S.ints ? 'ON' : 'OFF');
            pendChip.className = 'chip ' + (S.pending ? 'intr pulse' : ''); pendChip.textContent = S.pending ? 'timer interrupt pending' : 'nothing pending';
            cCount.set(S.count); cR1.set(S.reg[1]); cR2.set(S.reg[2]);
            tally.innerHTML = `Increments finished: <b>${S.done}</b> · count should be <b>${S.done}</b>, it is <b style="color:var(--${S.count === S.done ? 'ok' : 'bad'})">${S.count}</b>`;
            if (v) say.say(v[0], v[1]);
          }
          function act(kind) {
            const p = S.run, other = p === 1 ? 2 : 1, P = PN(p), O = PN(other);
            let v;
            if (kind === 'timer') {
              if (S.ints) {
                const mid = inside(S.pc[p]);
                S.run = other;
                note(`Timer interrupt: OS switches ${P} → ${O}${mid ? ' (inside its critical section!)' : ''}`, mid ? 'bad' : '');
                v = mid ? ['warn', `<b>Switched out mid-critical-section.</b> ${P} was inside its critical section when the interrupt arrived, and interrupts were on, so the OS gave the processor to ${O}. If ${O} now enters too, mutual exclusion is broken.`]
                  : ['info', `<b>Timer interrupt.</b> Interrupts are on, so the OS saves ${P} and dispatches ${O}. That is harmless here: ${P} is not inside its critical section.`];
              } else {
                const again = S.pending;
                S.pending = true;
                note(`Timer interrupt held as pending (interrupts OFF)`, 'ok');
                v = ['ok', `<b>Interrupt held.</b> Interrupts are off, so the processor ${again ? 'already has a timer interrupt waiting; it' : 'records this one as <span class="t">pending interrupt</span> and'} keeps running ${P}. No switch can happen until ${P} switches interrupts back on.`];
              }
            } else {
              const pc = S.pc[p];
              if (pc === 0) { note(`${P} finishes other work`); v = ['info', `${P} finishes its remainder work and heads for its critical section.`]; }
              if (pc === 1) { S.ints = false; note(`${P} disables interrupts`); v = ['info', `${P} switches interrupts <b>off</b>. From now on, the only way it can lose the processor is by calling the OS itself, and it will not.`]; }
              if (pc === 2) { S.reg[p] = S.count; note(`${P} reads count = ${S.count}`); v = ['info', `${P} reads <code>count = ${S.count}</code> into its register. It is now halfway through its critical section.`]; }
              if (pc === 3) {
                S.count = S.reg[p] + 1; S.done++;
                const lost = S.count !== S.done;
                if (lost) S.lost = true;
                note(`${P} writes count = ${S.count}${lost ? ' (an update is lost!)' : ''}`, lost ? 'bad' : '');
                v = lost ? ['bad', `<b>Lost update.</b> ${P} writes back ${S.count}, the value it computed from a stale read. ${S.done} increments have finished, but count is only ${S.count}.`]
                  : ['info', `${P} writes <code>count = ${S.count}</code>. ${S.mode === 'prot' ? 'Its critical section is done; next it switches interrupts back on.' : 'Its critical section is done.'}`];
              }
              if (pc === 4) {
                S.ints = true;
                if (S.pending) {
                  S.pending = false; S.run = other;
                  note(`${P} enables interrupts; pending timer fires: switch → ${O}`, 'ok');
                  v = ['ok', `${P} switches interrupts back <b>on</b>, and the pending timer interrupt is delivered at once. The OS now switches to ${O}. ${P} had already left its critical section, so this is perfectly safe.`];
                } else { note(`${P} enables interrupts`); v = ['info', `${P} switches interrupts back <b>on</b>. Its critical section is over, so being switched out is fine again.`]; }
              }
              S.pc[p] = nextPc(S.mode, pc);
            }
            if (!S.violated && inside(S.pc[1]) && inside(S.pc[2])) {
              S.violated = true;
              note('Both processes are inside their critical sections!', 'bad');
              v = ['bad', `<b>Mutual exclusion broken.</b> ${PN(1)} and ${PN(2)} are both inside their critical sections: one was switched out in the middle, and the other walked right in. Keep running to see the damage to <code>count</code>.`];
            }
            paint(v);
          }
          async function replay() {
            const mode = S.mode;
            reset(mode); busy = true;
            const g = gen;
            const seq = mode === 'unprot' ? ['run', 'run', 'timer', 'run', 'run', 'run', 'timer', 'run'] : ['run', 'run', 'run', 'timer', 'run', 'run', 'run', 'run'];
            for (const k of seq) { await ctx.sleep(750); if (!ctx.alive || g !== gen) return; act(k); }
            busy = false;
            if (mode === 'prot') paint(['ok', `<b>Replay over: no harm done.</b> The timer fired while ${PN(1)} was inside its critical section, but it was held until ${PN(1)} switched interrupts back on. count = ${S.count}, exactly the number of finished increments. Now try <b>Unprotected</b>.`]);
          }
          reset('prot');
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'On a <span class="t">uniprocessor</span>, processes never truly <span class="t" data-t="overlapping">overlap</span>; they only <span class="t" data-t="interleaving">interleave</span>, taking turns.' }),
              h('p', { class: 'm0', html: 'A running process keeps the processor until one of two things happens: it <b>calls an OS service</b> (to read a file, say), or an <span class="t">interrupt</span> arrives (a timer tick, a disk finishing) and the OS decides to switch.' }),
              h('p', { class: 'm0', html: 'So a process that switches interrupts off before its critical section, and makes no OS calls inside it, cannot lose the processor. Nobody else can run, so nobody else can get in: <span class="t">interrupt disabling</span>.' }),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Switching interrupts off does not throw them away. The hardware holds them pending and delivers them as soon as interrupts are back on.' }),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'Run P1 to <code>count = reg + 1</code>, then fire the timer. Then pick <b>Unprotected</b> and do the same, or press <b>Replay a risky timing</b> in each mode.' })),
            h('div', { class: 'stack gap-s' },
              h('div', { class: 'row' }, seg, h('span', { class: 'grow' }), bReplay, bReset),
              codeBox,
              h('div', { class: 'row', style: { alignItems: 'stretch', gap: '8px' } },
                h('div', { class: 'card tight stack gap-s', style: { flex: '1 1 210px' } },
                  h('div', { class: 'row gap-s' }, h('b', { class: 'small' }, 'Processor runs'), cpuRun),
                  h('div', { class: 'row gap-s' }, intChip, pendChip)),
                h('div', { style: { flex: '0 0 92px', display: 'grid' } }, cCount),
                h('div', { style: { flex: '0 0 92px', display: 'grid' } }, cR1),
                h('div', { style: { flex: '0 0 92px', display: 'grid' } }, cR2)),
              h('div', { class: 'row' }, bRun, bInt, tally),
              say, log)));
        },
      },

      /* ============ 3. The two costs of interrupt disabling (compare) ============ */
      {
        title: 'The two costs of switching off interrupts',
        kind: 'compare',
        render(el, ctx) {
          const { h, s } = ctx;
          /* ---- Cost 1: efficiency. Device events that arrive while interrupts are off must wait. ---- */
          const EV = [6, 18, 33, 47, 64, 88];       // arrival times of device interrupts, in microseconds
          const X = (t) => 20 + t * 4.8;           // 0..100 µs → 20..500 in the SVG
          const svg1 = s('svg', { viewBox: '0 0 520 150', width: '100%', role: 'img', 'aria-label': 'Timeline of device interrupts delayed by a critical section' });
          const stat = h('div', { class: 'small' });
          function drawCost(L) {
            const end = 10 + L;
            const late = EV.filter((t) => t >= 10 && t < end);
            const waits = late.map((t) => end - t);
            const kids = [
              s('rect', { x: X(10), y: 22, width: L * 4.8, height: 76, rx: 8, class: 's-os', 'stroke-width': 2, 'fill-opacity': 0.7 }),
              s('text', { x: X(10) + 6, y: 38, 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--os)' }, L >= 22 ? 'interrupts OFF' : 'OFF'),
              s('line', { x1: 20, y1: 110, x2: 505, y2: 110, class: 's-line' }),
              s('circle', { cx: 300, cy: 10, r: 5, class: 's-io', 'stroke-width': 2 }), s('text', { x: 310, y: 14.5, 'font-size': 12.5, class: 's-sub' }, 'served at once'),
              s('circle', { cx: 412, cy: 10, r: 5, class: 's-intr', 'stroke-width': 2, style: 'fill:var(--intr)' }), s('text', { x: 422, y: 14.5, 'font-size': 12.5, class: 's-sub' }, 'had to wait'),
            ];
            for (let t = 0; t <= 100; t += 20) kids.push(s('line', { x1: X(t), y1: 106, x2: X(t), y2: 114, class: 's-line' }), s('text', { x: X(t), y: 132, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, t === 100 ? '100 µs' : String(t)));
            EV.forEach((t) => {
              const k = late.indexOf(t);
              if (k >= 0) {
                const y = 52 + k * 10;
                kids.push(s('line', { x1: X(t), y1: y, x2: X(end) - 4, y2: y, class: 's-line', 'stroke-dasharray': '4 3', 'marker-end': 'url(#arr-intr)', style: 'stroke:var(--intr)' }),
                  s('line', { x1: X(t), y1: 104, x2: X(t), y2: y, class: 's-muted', 'stroke-width': 1.5 }));
              }
              kids.push(s('circle', { cx: X(t), cy: 110, r: 6, class: k >= 0 ? 's-intr' : 's-io', 'stroke-width': 2, style: k >= 0 ? 'fill:var(--intr)' : null }));
            });
            svg1.replaceChildren(...kids);
            const tot = waits.reduce((a, b) => a + b, 0);
            stat.innerHTML = `Device interrupts delayed: <b>${late.length} of ${EV.length}</b> · longest wait <b>${late.length ? Math.max(...waits) : 0} µs</b> · total <b>${tot} µs</b>`
              + `<div class="muted" style="margin-top:4px">Interrupts go off at 10 µs and back on at 10 + ${L} = <b>${end} µs</b>. `
              + (late.length ? `Each delayed interrupt waits until then: ${late.map((t) => `${end} − ${t} = ${end - t}`).join(', ')} µs.</div>` : 'No device interrupt arrives in that window, so none waits.</div>');
          }
          const sl = ctx.ui.slider({ label: 'Critical section length', min: 5, max: 80, step: 1, value: 20, format: (v) => v + ' µs', onInput: drawCost });
          drawCost(20);

          /* ---- Cost 2: a multiprocessor. Disabling interrupts on one CPU does not stop the others. ---- */
          let mode = 1;
          const cpus = h('div', { class: 'row nw', style: { gap: '12px', justifyContent: 'center' } });
          const room = h('div', { class: 'room' });
          const mem = h('div', { class: 'card mem tight stack gap-s', style: { alignItems: 'center' } }, h('div', { class: 'xs b', style: { color: 'var(--mem)', letterSpacing: '.06em' } }, 'SHARED MAIN MEMORY'), room);
          const cpuBox = (n, run, on, pend) => h('div', { class: 'box cpu stack gap-s', style: { flex: '0 1 200px', alignItems: 'center', padding: '6px 10px' } },
            h('div', { class: 'row gap-s' }, h('b', { class: 'small' }, 'CPU ' + n), run ? h('span', { class: 'tok p' + run }, 'P' + run) : h('span', { class: 'chip' }, 'idle')),
            h('div', { class: 'row gap-s' }, h('span', { class: 'chip ' + (on ? 'ok' : 'os') }, 'interrupts ' + (on ? 'ON' : 'OFF')), pend ? h('span', { class: 'chip intr' }, 'pending') : null));
          const F = {
            1: [
              { c: [[1, true]], in: [], wait: 'P2 is Ready, waiting for the processor', cap: '<b>One processor.</b> P1 is running. P2 is ready but can only run if the OS switches to it.' },
              { c: [[1, false]], in: [1], wait: 'P2 is Ready, waiting for the processor', cap: 'P1 switches interrupts <b>off</b> and enters its critical section.' },
              { c: [[1, false, true]], in: [1], wait: 'P2 is still waiting: no switch is possible', cap: 'A timer interrupt arrives and is <b>held</b>. With no switch, P2 cannot run, so it cannot touch the shared data.' },
              { c: [[2, true]], in: [], wait: 'P1 is Ready, waiting for the processor', cap: 'P1 leaves its critical section and switches interrupts on. The held interrupt fires and the OS switches to P2.' },
              { c: [[2, false]], in: [2], wait: 'P1 is Ready, waiting for the processor', cap: 'P2 switches interrupts off and enters. One process at a time: <b>on one processor it works.</b>', ok: true },
            ],
            2: [
              { c: [[1, true], [2, true]], in: [], wait: '', cap: '<b>Two processors, one shared memory.</b> P1 runs on CPU 1 and P2 runs on CPU 2, truly at the same instant.' },
              { c: [[1, false], [2, true]], in: [1], wait: '', cap: 'P1 switches interrupts off and enters. But that setting belongs to <b>CPU 1 only</b>. CPU 2 is not affected at all.' },
              { c: [[1, false], [2, true]], in: [1], wait: 'P2 heads for its critical section', cap: 'P2 never needed to be switched in: it is <b>already running</b> on CPU 2. Nothing stops it from reaching the shared data.' },
              { c: [[1, false], [2, false]], in: [1, 2], wait: '', cap: 'P2 switches interrupts off on CPU 2 and enters too. <b>Both are inside at once</b>, reading and writing the same data.', bad: true },
              { c: [[1, false], [2, false]], in: [1, 2], wait: '', cap: 'Interrupts only decide when a processor can be <b>switched</b>. They cannot stop another processor from using memory, so this method <b>fails on a multiprocessor</b>.', bad: true },
            ],
          };
          const waitNote = h('div', { class: 'xs muted center', style: { minHeight: '18px' } });
          function drawMp(i) {
            const f = F[mode][i];
            cpus.replaceChildren(...f.c.map(([run, on, pend], k) => cpuBox(k + 1, run, on, pend)));
            room.className = 'room' + (f.in.length === 1 ? ' one' : f.in.length > 1 ? ' two' : '');
            room.replaceChildren(h('div', { class: 'xs' }, 'critical section (shared data)'),
              h('div', { class: 'row gap-s', style: { justifyContent: 'center' } }, ...(f.in.length ? f.in.map((p) => h('span', { class: 'tok p' + p }, 'P' + p)) : [h('span', { class: 'small muted' }, 'empty')])));
            waitNote.textContent = f.wait || ' ';
            return f.cap;
          }
          const player = ctx.ui.player({ count: 5, render: drawMp, interval: 2200 });
          const seg = ctx.ui.seg([{ value: 1, label: '1 processor' }, { value: 2, label: '2 processors' }], 1, (v) => { mode = v; player.reset(); });

          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'card stack gap-s' },
              h('h3', { class: 'm0' }, 'Cost 1: everything else must wait'),
              h('p', { class: 'small m0', html: 'While interrupts are off, the processor cannot <span class="t" data-t="interleaving">interleave</span>: no other process can run and no device can be served. A finished disk read or an arriving network packet just waits. Slide to see how the delays grow with the critical section.' }),
              sl, h('div', { class: 'card white tight' }, svg1), stat,
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Switching interrupts off is a <span class="t">privileged instruction</span>: only the kernel may use it, since a user program could otherwise hog the machine forever. Even the kernel keeps these stretches as short as it can.' })),
            h('div', { class: 'card stack gap-s' },
              h('h3', { class: 'm0' }, 'Cost 2: useless on a multiprocessor'),
              h('p', { class: 'small m0', html: 'On a <span class="t">multiprocessor</span>, processes run truly at the same time. Switching interrupts off on one processor says nothing to the others.' }),
              seg, cpus, waitNote, mem, player.el)));
        },
      },

      /* ============ 4. Why look-and-lock must be one atomic step (lab) ============ */
      {
        title: 'Look and lock in one step: why atomic matters',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          /* Each program: lines with a plain-language "next" text and an effect. inside = lines that count as
             "inside the critical section" (after taking the lock, before releasing it). */
          const PROGS = {
            two: {
              src: `while (bolt == 1) ;     // STEP 1, a read: taken? test again
bolt = 1;               // STEP 2, a write: claim the lock
/* critical section */  // use the shared resource
bolt = 0;               // unlock: put the 0 back
/* remainder */         // other work, then want in again`,
              inside: [2, 3], gap: 1,
              run(S, p) {
                const pc = S.pc[p];
                if (pc === 0) return S.bolt === 0 ? { to: 1, m: `reads bolt = 0: free! (but has not claimed it yet)` } : { to: 0, spin: true, m: `reads bolt = 1: taken, so it tests again` };
                if (pc === 1) { S.bolt = 1; return { to: 2, m: `writes bolt = 1 and walks into its critical section` }; }
                if (pc === 2) return { to: 3, m: `finishes its critical section` };
                if (pc === 3) { S.bolt = 0; return { to: 4, m: `writes bolt = 0: unlocked` }; }
                return { to: 0, m: `does other work, then wants in again` };
              },
              next: ['Read bolt. If it is 1, test again; if it is 0, go on to STEP 2.', 'Write 1 into bolt, then enter the critical section.', 'Use the shared resource, then leave.', 'Write 0 into bolt: the lock is free again.', 'Other work. Then it wants the lock again.'],
            },
            cas: {
              src: `while (compare_and_swap(&bolt, 0, 1) == 1) ;  // ONE atomic step: test + set
/* critical section */                         // got 0 back: the lock is ours
bolt = 0;                                      // unlock: put the 0 back
/* remainder */                                // other work, then want in again`,
              inside: [1, 2], gap: -1,
              run(S, p) {
                const pc = S.pc[p];
                if (pc === 0) {
                  const old = S.bolt;
                  if (old === 0) { S.bolt = 1; return { to: 1, m: `compare_and_swap finds 0, writes 1, returns 0: it holds the lock` }; }
                  return { to: 0, spin: true, m: `compare_and_swap finds 1, writes nothing, returns 1: it spins` };
                }
                if (pc === 1) return { to: 2, m: `finishes its critical section` };
                if (pc === 2) { S.bolt = 0; return { to: 3, m: `writes bolt = 0: unlocked` }; }
                return { to: 0, m: `does other work, then wants in again` };
              },
              next: ['One instruction: read bolt, and if it is 0 write 1, all at once. Returned 1? Test again.', 'Use the shared resource, then leave.', 'Write 0 into bolt: the lock is free again.', 'Other work. Then it wants the lock again.'],
            },
          };
          let mode = 'two', S, P, code, busy = false, gen = 0;   // gen: bumped by every reset so an older replay loop stops
          const codeBox = h('div');
          const cBolt = cell(ctx, 'bolt');
          const room = h('div', { class: 'room', style: { minWidth: '0' } });
          const say = verdict(ctx);
          const log = h('div', { class: 'log grow', style: { minHeight: '60px' } });
          const tally = h('div', { class: 'xs muted center' });
          const pcard = [1, 2].map((p) => {
            const st = h('span', { class: 'chip' });
            const nx = h('div', { class: 'small', style: { minHeight: '42px', lineHeight: '1.35' } });
            const btn = h('button', { class: 'btn sm ' + (p === 1 ? 'proc' : 'os'), type: 'button', style: p === 2 ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : null, onclick: () => !busy && stepP(p) }, 'Step P' + p);
            const card = h('div', { class: 'card tight stack gap-s', style: { borderTop: `4px solid var(--${p === 1 ? 'proc' : 'accent'})` } }, h('div', { class: 'row gap-s' }, h('span', { class: 'tok p' + p }, 'P' + p), st, h('span', { class: 'grow' }), btn), nx);
            return { st, nx, card };
          });
          function reset(m) {
            gen++;
            mode = m; P = PROGS[m];
            S = { pc: { 1: 0, 2: 0 }, bolt: 0, spins: { 1: 0, 2: 0 }, spinNow: { 1: false, 2: false }, overlaps: 0, both: false };
            code = listing(ctx, P.src, { fontSize: 13 });
            codeBox.replaceChildren(code);
            log.replaceChildren(h('div', { class: 'spin ph' }, 'Your steps appear here, newest first.'));
            paint(m === 'two'
              ? ['info', '<b>Your move.</b> You are the scheduler: press <b>Step P1</b> or <b>Step P2</b> to run one line of that process. Can you get <b>both</b> into the critical section?']
              : ['info', '<b>Now the lock is one atomic instruction.</b> Try every order you like. Can you still get both inside?']);
          }
          const stateOf = (p) => {
            const pc = S.pc[p];
            if (P.inside.includes(pc)) return ['inside', 'ok'];
            if (pc === P.gap) return ['looked, not locked', 'warn'];
            if (mode === 'two' ? pc === 4 : pc === 3) return ['remainder', ''];
            return [S.spinNow[p] ? 'spinning' : 'wants in', S.spinNow[p] ? 'warn' : 'accent'];
          };
          function paint(v) {
            const map = {};
            [1, 2].forEach((p) => { (map[S.pc[p] + 1] = map[S.pc[p] + 1] || []).push(p); });
            code.marks(map);
            cBolt.set(S.bolt);
            const ins = [1, 2].filter((p) => P.inside.includes(S.pc[p]));
            room.className = 'room' + (ins.length === 1 ? ' one' : ins.length > 1 ? ' two' : '');
            room.replaceChildren(h('div', { class: 'xs' }, 'critical section'), h('div', { class: 'row gap-s', style: { justifyContent: 'center' } }, ...(ins.length ? ins.map((p) => h('span', { class: 'tok p' + p }, 'P' + p)) : [h('span', { class: 'small muted' }, 'empty')])));
            [1, 2].forEach((p) => { const [t, c] = stateOf(p); pcard[p - 1].st.className = 'chip ' + c; pcard[p - 1].st.textContent = t; pcard[p - 1].nx.innerHTML = '<b>Next:</b> ' + P.next[S.pc[p]]; });
            tally.innerHTML = `Times both were inside: <b style="color:var(--${S.overlaps ? 'bad' : 'ok'})">${S.overlaps}</b> · spins: P1 ${S.spins[1]}, P2 ${S.spins[2]}`;
            if (v) say.say(v[0], v[1]);
          }
          function stepP(p) {
            const r = P.run(S, p);
            S.pc[p] = r.to;
            S.spinNow[p] = !!r.spin;
            if (r.spin) S.spins[p]++;
            const both = [1, 2].every((q) => P.inside.includes(S.pc[q]));
            let v = ['info', `${PN(p)} ${r.m}.`];
            if (both && !S.both) {
              S.overlaps++;
              v = ['bad', `<b>Both are inside!</b> Each process read bolt = 0 before either one wrote 1. The gap between STEP 1 and STEP 2 let the other process slip in. Mutual exclusion is broken.`];
            } else if (mode === 'two' && S.pc[1] === 1 && S.pc[2] === 1) {
              v = ['warn', `${PN(p)} ${r.m}. Now <b>both</b> processes have read bolt = 0 and neither has written 1 yet. Each one believes the lock is free. Step them both once more.`];
            } else if (mode === 'two' && S.pc[p] === 1) {
              v = ['warn', `${PN(p)} ${r.m}. It is now in the <b>danger window</b>: it has looked but not locked. Try stepping the other process now.`];
            } else if (mode === 'cas' && r.spin) {
              v = ['ok', `${PN(p)} ${r.m}. The value did not match 0, so nothing was written. Whatever order you pick, only one process can ever get the 0 back.`];
            }
            S.both = both;
            const ph = log.querySelector('.ph'); if (ph) ph.remove();
            log.prepend(h('div', { class: both && v[0] === 'bad' ? 'bad' : r.spin ? 'spin' : '', html: `P${p} ${r.m}` }));
            paint(v);
          }
          async function replay() {
            const m = mode;
            reset(m); busy = true;
            const g = gen;
            for (const p of [1, 2, 1, 2, 1, 2]) { await ctx.sleep(800); if (!ctx.alive || g !== gen) return; stepP(p); }
            busy = false;
          }
          const seg = ctx.ui.seg([{ value: 'two', label: 'Two steps: test, then set' }, { value: 'cas', label: 'One atomic instruction' }], 'two', (m) => { busy = false; reset(m); });
          reset('two');
          el.append(h('div', { class: 'split l3 fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'Route 2 works on any number of processors. It starts from one hardware fact.' }),
              h('p', { class: 'm0 small', html: 'Memory serves one access to a given word at a time: while one read or write of a location is in progress, any other access to that <b>same</b> location waits its turn.' }),
              h('p', { class: 'm0 small', html: 'Processor designers built on that: special instructions carry out <b>two actions on one word</b>, such as reading and writing it, or reading and testing it, within a single instruction cycle. Nothing can get between the two actions. Such an instruction is an <span class="t">atomic instruction</span>.' }),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Even squeezed onto one line, <code>if (bolt == 0) bolt = 1;</code> is two separate memory accesses: a read, then a write. Another process can reach bolt between them.' }),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Predict, then try', html: 'Is there <b>any</b> order of steps that gets both processes inside the atomic version? Decide first. Then step P1, P2, P1, P2 in each mode (or press <b>Replay</b>) and try every order you can think of.' })),
            h('div', { class: 'stack gap-s' },
              h('div', { class: 'row' }, seg, h('span', { class: 'grow' }), h('button', { class: 'btn sm', type: 'button', onclick: replay }, 'Replay P1, P2, P1, P2'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { busy = false; reset(mode); } }, 'Reset')),
              codeBox,
              h('div', { class: 'cols', style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 200px minmax(0,1fr)', gap: '10px' } },
                pcard[0].card,
                h('div', { class: 'stack gap-s' }, cBolt, room),
                pcard[1].card),
              tally, say, log)));
        },
      },

      /* ============ 5. compare_and_swap: inside the instruction, then a lock built from it ============ */
      {
        title: 'compare_and_swap: open up the instruction',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          /* ---------- tab 1: what the instruction does, micro-step by micro-step ---------- */
          function inside(panel) {
            const code = ctx.ui.code(`int compare_and_swap(int *word,   // address of the shared word
                     int testval, // the value we expect to find
                     int newval)  // the value to store if we do
{                                 // ---- one atomic instruction ----
    int oldval;                   // room for what we find
    oldval = *word;               // 1. READ the word
    if (oldval == testval)        // 2. COMPARE it with testval
        *word = newval;           // 3. equal? WRITE newval
    return oldval;                // 4. hand back what we found
}                                 // ---- end: nothing got in between`, { fontSize: 13 });
            const PRE = [
              { w: 0, t: 0, n: 1, label: 'Lock is free', lock: true },
              { w: 1, t: 0, n: 1, label: 'Lock is taken', lock: true },
              { w: 7, t: 7, n: 3, label: 'Any values: match' },
              { w: 4, t: 7, n: 3, label: 'Any values: no match' },
            ];
            let pr = PRE[0];
            const cWord = cell(ctx, '*word (in memory)'), cT = cell(ctx, 'testval', 'cpu'), cN = cell(ctx, 'newval', 'cpu'), cO = cell(ctx, 'oldval', 'cpu');
            const badge = h('span', { class: 'chip' });
            const cmp = h('div', { class: 'card white tight small', style: { minHeight: '64px' } });
            const btns = PRE.map((p, k) => h('button', { class: 'btn sm', type: 'button', onclick: () => { pr = PRE[k]; btns.forEach((b, j) => b.classList.toggle('on', j === k)); player.reset(); } }, p.label));
            btns[0].classList.add('on');
            function frame(i) {
              const { w, t, n } = pr, eq = w === t;
              const word = i >= 3 && eq ? n : w;
              cWord.set(word, i === 3 && eq); cT.set(t); cN.set(n); cO.set(i >= 1 ? w : '?', i === 1);
              badge.className = 'chip ' + (i >= 1 && i <= 3 ? 'os' : ''); badge.textContent = i >= 1 && i <= 3 ? 'word reserved: no other access can get in' : (i === 4 ? 'instruction finished' : 'instruction about to start');
              code.clear(); code.mark([[1, 2, 3], [6], [7], [8], [9]][i]);
              if (i === 3 && !eq) code.mark([8], 'dim');
              const res = `returns <b>${w}</b>, word is now <b>${word}</b>`;
              cmp.innerHTML = [
                `Inputs: the word in memory holds <b>${w}</b>; we expect <b>${t}</b>; if it matches, store <b>${n}</b>.`,
                `<b>1. READ.</b> oldval = *word = <b>${w}</b>.`,
                `<b>2. COMPARE.</b> Is oldval (${w}) == testval (${t})? <b style="color:var(--${eq ? 'ok' : 'bad'})">${eq ? 'yes' : 'no'}</b>.`,
                eq ? `<b>3. WRITE.</b> They match, so *word = newval = <b>${n}</b>.` : `<b>3. NO WRITE.</b> No match, so memory is left exactly as it was (<b>${w}</b>).`,
                `<b>4. RETURN.</b> The instruction ${res}.` + (pr.lock ? (w === 0 ? ' <span class="chip ok">returned 0: the lock is ours</span>' : ' <span class="chip warn">returned 1: taken, test again</span>') : ''),
              ][i];
              return [
                'Pick a case above, then step through. The whole instruction runs as <b>one indivisible step</b>; we slow it down only so you can see inside.',
                'The processor reads the memory word. From now until the instruction ends, no other processor can access this word.',
                eq ? 'The value found equals the value expected.' : 'The value found is not the value expected, so the write will be skipped.',
                eq ? 'Because they matched, the new value is written. Read, compare and write all happened inside one instruction.' : 'Nothing is written. That is why a taken lock stays taken when someone else tests it.',
                `The old value is returned. The caller looks at it to learn what the word held <b>before</b>: that is how it knows whether it won.`,
              ][i];
            }
            const player = ctx.ui.player({ count: 5, render: frame, interval: 1700, speed: false });
            panel.append(h('div', { class: 'split r fill' },
              h('div', { class: 'stack' }, code,
                h('p', { class: 'small m0', html: '<span class="t" data-t="compare_and_swap">compare_and_swap</span> (<b>CAS</b> for short) is also called <b>compare and exchange</b>. Many processors have it (x86 calls it <code>CMPXCHG</code>). It always returns the <b>old</b> value, whether or not it wrote anything.' }),
                h('div', { class: 'callout tip m0 small', 'data-label': 'Reading the result', html: 'Returned value <b>equals testval</b>? Then the write happened. <b>Anything else</b>? Memory was not touched. For a lock with testval 0: getting 0 back means “I locked it”; getting 1 back means “someone else holds it”.' }),
                h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'The read and the write sit inside one instruction, so no other process or processor can see the word between them. The gap from the previous step is simply gone.' })),
              h('div', { class: 'stack gap-s' },
                h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' } }, ...btns),
                h('div', { class: 'card mem tight stack gap-s' }, h('div', { class: 'row gap-s' }, h('b', { class: 'xs', style: { color: 'var(--mem)', letterSpacing: '.06em' } }, 'MEMORY'), badge), cWord),
                h('div', { class: 'card cpu tight stack gap-s' }, h('b', { class: 'xs', style: { color: 'var(--cpu)', letterSpacing: '.06em' } }, 'PROCESSOR REGISTERS'), h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' } }, cT, cN, cO)),
                cmp, player.el)));
            return () => player.stop();
          }
          /* ---------- tab 2: the spinlock built from compare_and_swap, three processes ---------- */
          function lock(panel) {
            const code = listing(ctx, `int bolt = 0;                     // shared lock word: 0 free, 1 taken
void P(int i) {                   // every process runs this same code
  while (true) {                  // repeat forever
    while (compare_and_swap(&bolt, 0, 1) == 1)   // 1 back? taken...
      ;                           // ...so do nothing and test again
    /* critical section */        // 0 back: bolt is 1 now, and ours
    bolt = 0;                     // unlock: the next test can succeed
    /* remainder */               // other work, no lock needed
  }                               // end of the forever loop
}                                 // end of P`, { fontSize: 13 });
            code.style.alignSelf = 'start';   // size to its 10 lines instead of stretching to the callout column
            const LINE = { rem: 8, spin: 4, in: 6 };
            /* frames: state of P1..P3, bolt, number of failed tests, and who just acted */
            const FR = [
              { st: ['rem', 'rem', 'rem'], bolt: 0, t: [0, 0, 0], cap: 'All three processes are doing other work. <b>bolt = 0</b>: the lock is free.' },
              { st: ['rem', 'in', 'rem'], bolt: 1, t: [0, 0, 0], who: 2, cap: 'P2 wants in. compare_and_swap finds 0, writes 1 and returns 0. The loop ends: <b>P2 is inside</b>.' },
              { st: ['spin', 'in', 'rem'], bolt: 1, t: [1, 0, 0], who: 1, cap: 'P1 wants in. compare_and_swap finds 1 (no match, nothing written) and returns 1. P1 must test again.' },
              { st: ['spin', 'in', 'spin'], bolt: 1, t: [1, 0, 1], who: 3, cap: 'P3 wants in too. It also gets 1 back. Now two processes are spinning.' },
              { st: ['spin', 'in', 'spin'], bolt: 1, t: [2, 0, 1], who: 1, cap: 'P1 tests again: 1 again. This is <b>busy waiting</b>: every test burns processor time and achieves nothing.' },
              { st: ['spin', 'rem', 'spin'], bolt: 0, t: [2, 0, 1], who: 2, cap: 'P2 leaves its critical section and writes <b>bolt = 0</b>. The lock is free, but nobody is told; the spinners must notice.' },
              { st: ['spin', 'rem', 'in'], bolt: 1, t: [2, 0, 1], who: 3, cap: 'P3 happens to test first and gets 0: <b>P3 is inside</b>. P1 had waited longer, but the hardware keeps no queue.' },
              { st: ['spin', 'rem', 'in'], bolt: 1, t: [3, 0, 1], who: 1, cap: 'P1 tests again and gets 1. Nothing promises it a turn, ever. That is how <b>starvation</b> becomes possible.' },
              { st: ['in', 'rem', 'rem'], bolt: 1, t: [3, 0, 1], who: 1, cap: 'P3 unlocks (bolt = 0), and this time P1 is the first to test: it gets 0 and <b>goes in</b>. Luck, not fairness.' },
            ];
            const cBolt = cell(ctx, 'bolt');
            const pbox = [1, 2, 3].map((p) => { const st = h('span', { class: 'chip' }); const tn = h('span', { class: 'xs muted' }); return { st, tn, el: h('div', { class: 'card tight row gap-s', style: { flex: '1 1 0', justifyContent: 'center' } }, h('span', { class: 'tok p' + p }, 'P' + p), st, tn) }; });
            const NAME = { rem: ['remainder', ''], spin: ['spinning', 'warn'], in: ['inside', 'ok'] };
            function frame(i) {
              const f = FR[i];
              const map = {};
              f.st.forEach((st, k) => { (map[LINE[st]] = map[LINE[st]] || []).push(k + 1); });
              code.marks(map);
              cBolt.set(f.bolt, i > 0 && f.bolt !== FR[i - 1].bolt);
              pbox.forEach((b, k) => { const [t, c] = NAME[f.st[k]]; b.st.className = 'chip ' + c; b.st.textContent = t; b.tn.textContent = f.t[k] ? `failed tests: ${f.t[k]}` : ''; b.el.classList.toggle('flash', f.who === k + 1); });
              return f.cap;
            }
            const player = ctx.ui.player({ count: FR.length, render: frame, interval: 2300 });
            panel.append(h('div', { class: 'stack fill gap-s' },
              h('div', { class: 'split r', style: { height: 'auto' } }, code,
                h('div', { class: 'stack gap-s' },
                  h('div', { class: 'callout tip m0 small', 'data-label': 'Simple, so easy to verify', html: 'Only the process that finds bolt = 0 leaves the loop, and finding it sets bolt to 1 in the same step. That is the whole proof.' }),
                  h('div', { class: 'callout why m0 small', 'data-label': 'Many critical sections', html: 'Give each resource its own lock word (<code>bolt_printer</code>, <code>bolt_queue</code>). Users of different resources never block each other.' }),
                  h('div', { class: 'callout warn m0 small', 'data-label': 'The catch', html: 'A waiter runs compare_and_swap over and over: <span class="t" data-t="busy waiting">busy waiting</span>, hence the name <span class="t" data-t="spinlock">spinlock</span>. Each failed test burns processor time.' }))),
              h('div', { class: 'row nw', style: { gap: '8px' } }, ...pbox.map((b) => b.el), h('div', { style: { flex: '0 0 110px' } }, cBolt)),
              player.el));
            return () => player.stop();
          }
          el.append(ctx.ui.tabs([{ label: 'Inside the instruction', render: inside }, { label: 'Building a lock from it', render: lock }]));
        },
      },

      /* ============ 6. The exchange instruction and its invariant (explore) ============ */
      {
        title: 'The exchange instruction and its invariant',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const N = 3;
          const def = ctx.ui.code(`void exchange(int *reg, int *mem) { // reg: a register, mem: a memory word
    int temp;          // scratch space inside the processor
    temp = *mem;       // copy the memory word aside
    *mem = *reg;       // the register's value goes to memory
    *reg = temp;       // the old memory value goes to the register
}                      // all one atomic instruction`, { fontSize: 13 });
          const code = listing(ctx, `int bolt = 0;                  // shared: 0 free, 1 taken
void P(int i) {                // every process runs this code
  while (true) {               // repeat forever
    int keyi = 1;              // my private key starts at 1
    do exchange(&keyi, &bolt); // swap my key with bolt, atomically
    while (keyi != 0);         // pulled out the 0? if not, swap again
    /* critical section */     // I hold the only 0: the lock is mine
    bolt = 0;                  // put a 0 back into bolt: unlock
    /* remainder */            // other work
  }                            // end of the forever loop
}                              // end of P`, { fontSize: 13 });
          /* ---- the machine: bolt in memory, one key register per process ---- */
          const BX = 235, BY = 56, KX = [80, 235, 390], KY = 196;
          const svg = s('svg', { viewBox: '0 0 470 236', width: '100%', role: 'img', 'aria-label': 'bolt in memory and the three private keys' });
          let S, busy = false, gen = 0;   // gen: bumped by Reset so a swap already in flight is ignored
          const say = verdict(ctx);
          const inv = h('div', { class: 'card white tight center mono', style: { fontSize: '14.5px', whiteSpace: ctx.narrow ? 'normal' : 'nowrap' } });
          const meaning = h('div', { class: 'small center', style: { minHeight: '22px' } });
          const pc = [1, 2, 3].map((p) => {
            const st = h('span', { class: 'chip' });
            const btn = h('button', { class: 'btn sm', type: 'button', style: { borderColor: `var(--${['proc', 'accent', 'io'][p - 1]})`, color: `var(--${['proc', 'accent', 'io'][p - 1]})` }, onclick: () => !busy && stepP(p) }, 'Step P' + p);
            return { st, btn, el: h('div', { class: 'stack gap-s', style: { alignItems: 'center' } }, btn, st) };
          });
          const token = (x, y, v, extra = {}) => s('g', Object.assign({ class: 'tokn' }, extra),
            s('circle', { cx: x, cy: y, r: 19, class: v === 0 ? 's-ok' : 's-panel', 'stroke-width': 3 }),
            s('text', { x, y: y + 7, 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 900, class: 's-monot', style: v === 0 ? 'fill:var(--ok)' : '' }, String(v)));
          function draw(hi) {
            const kids = [];
            KX.forEach((x, k) => kids.push(s('line', { x1: x, y1: 146, x2: BX, y2: 92, class: 's-muted', style: hi === k + 1 ? 'stroke:var(--accent);stroke-width:3' : '' })));
            const FS = ctx.narrow ? 1.25 : 1;   // phones render this SVG at about 70%, so enlarge its text
            kids.push(s('rect', { x: 160, y: 8, width: 150, height: 82, rx: 12, class: 's-mem', 'stroke-width': 2 }),
              s('text', { x: BX, y: 28, 'text-anchor': 'middle', 'font-size': 13 * FS, 'font-weight': 800 }, ctx.narrow ? 'bolt (memory)' : 'bolt (shared memory)'));
            KX.forEach((x, k) => kids.push(
              s('rect', { x: x - 68, y: 140, width: 136, height: 93, rx: 12, class: 's-cpu', 'stroke-width': S.st[k] === 'in' ? 3.5 : 2, style: S.st[k] === 'in' ? 'stroke:var(--ok)' : '' }),
              s('text', { x, y: 159, 'text-anchor': 'middle', 'font-size': 14.5 * FS, 'font-weight': 800, style: `fill:var(--${['proc', 'accent', 'io'][k]})` }, `key${k + 1}`),
              s('text', { x, y: ctx.narrow ? 177 : 174, 'text-anchor': 'middle', 'font-size': 12.5 * FS, class: 's-sub' }, `P${k + 1}'s register`)));
            kids.push(token(BX, BY + 8, S.bolt, { 'data-slot': 'b' }));
            KX.forEach((x, k) => kids.push(token(x, KY + 8, S.key[k], { 'data-slot': 'k' + (k + 1) })));
            if (hi) kids.push(s('text', { x: (KX[hi - 1] + BX) / 2 + (hi === 2 ? 22 : 0), y: 124, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 900, style: 'fill:var(--accent)' }, '⇅'));
            svg.replaceChildren(...kids);
          }
          function paint(v, hi) {
            draw(hi);
            const sum = S.bolt + S.key.reduce((a, b) => a + b, 0);
            const good = sum === N;
            inv.innerHTML = `bolt + key1 + key2 + key3 = ${S.bolt}+${S.key.join('+')} = <b>${sum}</b> ${good ? '= n <b style="color:var(--ok)">✓</b>' : '≠ n <b style="color:var(--bad)">✗</b>'}`;
            const ins = S.st.map((x, k) => (x === 'in' ? k + 1 : 0)).filter(Boolean);
            const zeros = (S.bolt === 0 ? 1 : 0) + S.key.filter((x) => x === 0).length;
            meaning.innerHTML = !good ? `<b style="color:var(--bad)">Invariant broken: ${zeros} zeros in the system, so ${zeros} processes can be inside at once.</b>`
              : S.bolt === 0 ? 'bolt = 0, so <b>no process</b> is in its critical section.'
                : `bolt = 1, so <b>exactly one</b> process is inside: ${PN(ins[0])}, the one whose key is 0.`;
            const map = {};
            S.st.forEach((st, k) => { const ln = st === 'in' ? 7 : st === 'try' ? 5 : 9; (map[ln] = map[ln] || []).push(k + 1); });
            code.marks(map);
            pc.forEach((c, k) => { const [t, cl] = { rem: ['remainder', ''], try: ['spinning', 'warn'], in: ['inside', 'ok'] }[S.st[k]]; c.st.className = 'chip ' + cl; c.st.textContent = t; });
            if (v) say.say(v[0], v[1]);
          }
          function reset() {
            gen++;
            S = { bolt: 0, key: [1, 1, 1], st: ['rem', 'rem', 'rem'], broken: false };
            busy = false;
            paint(['info', '<b>You are the scheduler.</b> Step any process. A waiting process swaps its key with bolt and checks whether it pulled out the 0. Watch the sum above: no order of steps can change it.']);
          }
          /* animate a swap between bolt and key p, then commit the new values */
          function flySwap(p, done) {
            const tb = svg.querySelector('[data-slot="b"]'), tk = svg.querySelector('[data-slot="k' + p + '"]');
            const dx = KX[p - 1] - BX, dy = KY - BY;
            [tb, tk].forEach((t) => (t.style.transition = 'transform .5s ease'));
            const g = gen;
            ctx.raf(() => { if (g === gen) { tb.style.transform = `translate(${dx}px, ${dy}px)`; tk.style.transform = `translate(${-dx}px, ${-dy}px)`; } return false; });
            busy = true;
            ctx.after(560, () => { if (g !== gen) return; busy = false; done(); });
          }
          function stepP(p) {
            const k = p - 1, st = S.st[k];
            if (st === 'in') {
              S.bolt = 0; S.key[k] = 1; S.st[k] = 'rem';
              paint(['info', `${PN(p)} leaves its critical section and writes <b>bolt = 0</b>: the single 0 is back in bolt. Its old key is done with; its next attempt starts with <code>int key${p} = 1</code>, so the diagram shows key${p} = 1 from now on.`]);
              return;
            }
            flySwap(p, () => {
              const old = S.bolt; S.bolt = S.key[k]; S.key[k] = old;
              if (S.key[k] === 0) {
                S.st[k] = 'in';
                const two = S.st.filter((x) => x === 'in').length > 1;
                paint(two ? ['bad', `${PN(p)} swaps and pulls out a 0 too. <b>Two processes are inside.</b> The rule was broken, so the invariant no longer protects anyone.`]
                  : ['ok', `${PN(p)} swaps: its key gets bolt's <b>0</b> and bolt gets its 1. The test <code>key${p} != 0</code> is false, so the loop ends: ${PN(p)} is <b>inside</b>.`], p);
              } else {
                S.st[k] = 'try';
                paint(['warn', `${PN(p)} swaps its 1 for bolt's 1: nothing changes. <code>key${p}</code> is still 1, so it loops and swaps again (busy waiting).`], p);
              }
            });
          }
          function breakRule() {
            if (busy) return;
            const holder = S.st.indexOf('in');
            if (holder < 0) { say.say('info', 'Nobody holds the lock right now, so a stray <code>bolt = 0</code> would change nothing. Let a process get inside first.'); return; }
            if (S.bolt === 0) { say.say('bad', 'bolt is already 0 while a process is inside: the rule is already broken. Step a waiting process to see it walk in, or press <b>Reset</b>.'); return; }
            S.bolt = 0;
            const sum = S.key.reduce((a, b) => a + b, 0), zeros = 1 + S.key.filter((x) => x === 0).length;
            paint(['bad', `<b>A bug:</b> some code writes <code>bolt = 0</code> while ${PN(holder + 1)} still holds the lock. Now there are ${zeros} zeros in the system and the sum is ${sum}, not ${N}. Step another process: it will get in too.`]);
          }
          reset();
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack gap-s' },
              h('p', { class: 'm0', html: 'The <span class="t" data-t="exchange instruction">exchange instruction</span> atomically swaps a register with a memory word.' }),
              def, code,
              h('div', { class: 'callout why m0 small', 'data-label': 'Why the sum stays n', html: 'Each process swaps its private <b>key</b> with <code>bolt</code>. A swap only moves two values around, so their total cannot change, and unlocking just returns the 0 to bolt. The sum is an <span class="t">invariant</span>: exactly one 0 exists, so at most one process can hold it. (A process outside the loop counts as key 1, its restart value.)' })),
            h('div', { class: 'stack gap-s' },
              h('div', { class: 'card white tight' }, svg),
              h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' } }, ...pc.map((c) => c.el)),
              inv, meaning, say,
              h('div', { class: 'row gap-s' }, h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset'), h('span', { class: 'grow' }),
                h('button', { class: 'btn sm danger', type: 'button', title: 'Simulate a buggy process that unlocks a lock it does not hold', onclick: breakRule }, 'Break the rule')))));
        },
      },

      /* ============ 7. Busy waiting and starvation: the spin simulator (lab) ============ */
      {
        title: 'Busy waiting and starvation: the spin simulator',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          /* ticks shown, cell width and lane geometry. Phones get a compact layout (10 ticks, short lane labels,
             tighter stat columns) so the viewBox stays close to the rendered width and the text stays readable. */
          const NW = ctx.narrow;
          const W = NW ? 10 : 24, CW = NW ? 18 : 19, X0 = NW ? 34 : 58, LH = 38, Y0 = 28;
          const SX0 = X0 + W * CW, SX = NW ? [SX0 + 24, SX0 + 70, SX0 + 122] : [SX0 + 34, SX0 + 84, SX0 + 136], VW = SX0 + (NW ? 152 : 166);
          const LANE_CLS = { rem: 'cl-rem', spin: 'cl-spin', in: 'cl-in' };
          let n = 4, L = 3, policy = 'random', S, rng, timer = null;
          const svg = s('svg', { viewBox: `0 0 ${VW} ${Y0 + 4 * LH + 26}`, width: '100%', role: 'img', 'aria-label': 'Timeline of what each processor did in every tick' });
          const say = verdict(ctx);
          const meter = h('div', { class: 'meter grow' }, h('i', { style: { background: 'var(--warn)' } }));
          const pct = h('div', { class: 'small', style: { minWidth: '250px' } });
          const bRun = h('button', { class: 'btn sm primary', type: 'button', onclick: () => (timer ? stop() : run()) }, 'Run');
          const listP = (arr) => arr.map((p) => PN(p.k + 1)).join(arr.length === 2 ? ' and ' : ', ');

          function reset() {
            stop();
            rng = ctx.util.seeded(7);
            S = { t: 0, bolt: 0, asking: null, hist: [], P: ctx.util.range(n).map((k) => ({ k, st: 'rem', left: [1, 1, 2, 2][k], entries: 0, spun: 0, wait: 0, maxWait: 0 })) };
            draw();
            say.say('info', policy === 'you'
              ? '<b>You are the memory.</b> Press <b>Step</b> or <b>Run</b>. Whenever the lock is free and several processes try compare_and_swap at once, you decide whose instruction reaches memory first. Try to keep P1 out.'
              : policy === 'unlucky'
                ? '<b>Press Run.</b> In this mode P1 loses every race that has another contender. That is unlucky but perfectly legal: the hardware promises nothing about who wins.'
                : '<b>Press Run</b> (or Step, one tick at a time). Each row is one processor running one process. Watch the orange stretches: that is processor time spent spinning.');
          }
          /* one tick of time. choice = index of the winner when the student is the arbiter */
          function tick(choice) {
            if (S.asking && choice == null) return;
            if (choice != null && !(S.asking && S.asking.includes(S.P[choice]))) return;
            const sp = S.P.filter((p) => p.st === 'spin');
            let w = null, v = null;
            if (S.bolt === 0 && sp.length) {
              if (sp.length === 1) w = sp[0];
              else if (policy === 'you') {
                if (choice == null) { ask(sp); return; }
                w = S.P[choice];
              } else if (policy === 'unlucky') { const o = sp.filter((p) => p.k !== 0); w = o.length ? o[Math.floor(rng() * o.length)] : sp[0]; }
              else w = sp[Math.floor(rng() * sp.length)];
              const waited = w.wait;
              w.st = 'in'; w.left = L; w.entries++; w.wait = 0; S.bolt = 1;
              const lost = sp.filter((p) => p !== w);
              v = sp.length === 1
                ? ['ok', `Tick ${S.t}: ${PN(w.k + 1)} ran compare_and_swap on a free lock, got 0 back and went in${waited ? ` after spinning ${waited} tick${waited === 1 ? '' : 's'}` : ' with no waiting at all'}.`]
                : ['info', `Tick ${S.t}: the lock came free and ${listP(sp)} all ran compare_and_swap. ${PN(w.k + 1)}’s reached memory first and got 0. ${listP(lost)} got 1 and keep spinning. Nobody checked who had waited longest.`];
            }
            S.asking = null;
            S.hist.push(S.P.map((p) => p.st));
            if (S.hist.length > W) S.hist.shift();
            S.P.forEach((p) => {
              if (p.st === 'in') { p.left--; if (!p.left) { p.st = 'rem'; p.left = 1 + Math.floor(rng() * 3); S.bolt = 0; } }
              else if (p.st === 'rem') { p.left--; if (!p.left) { p.st = 'spin'; p.wait = 0; } }
              else { p.spun++; p.wait++; p.maxWait = Math.max(p.maxWait, p.wait); }
            });
            S.t++;
            const starving = S.P.filter((p) => p.st === 'spin' && p.wait >= 10).sort((a, b) => b.wait - a.wait)[0];
            const spinning = S.P.filter((p) => p.st === 'spin');
            if (starving) v = ['bad', `<b>Starvation.</b> ${PN(starving.k + 1)} has been spinning for <b>${starving.wait} ticks</b> and has got in ${starving.entries} time${starving.entries === 1 ? '' : 's'} in total. Others keep winning the race for the free lock, and nothing in the hardware promises ${PN(starving.k + 1)} a turn.`];
            else if (!v) v = spinning.length ? ['warn', `Tick ${S.t - 1}: ${listP(spinning)} spun: compare_and_swap returned 1, so the loop tests again. That is ${spinning.length} processor-tick${spinning.length === 1 ? '' : 's'} of <b>busy waiting</b>, doing no useful work.`]
              : ['info', `Tick ${S.t - 1}: nobody is waiting. When there is no contention, a spinlock costs almost nothing.`];
            draw(); say.say(v[0], v[1]);
          }
          function ask(sp) {
            S.asking = sp;
            say.say('warn', `<b>The lock is free, and ${listP(sp)} all run compare_and_swap at the same moment.</b> Memory serves one of them first. Whose instruction gets there first?<br>`);
            sp.forEach((p) => say.append(h('button', { class: 'btn sm', type: 'button', style: { borderColor: `var(--${['proc', 'accent', 'io', 'thread'][p.k]})` }, onclick: () => tick(p.k), html: TOK(p.k + 1) + (p.wait ? ` <span class="xs muted">waited ${p.wait}</span>` : '') })));
          }
          function draw() {
            const kids = [
              s('text', { x: 4, y: 16, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 'CPU'),
              s('text', { x: X0 + (W * CW) / 2, y: 16, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 's-sub' }, ctx.narrow ? `last ${W} ticks  →` : `what each processor did, last ${W} ticks  →`),
              ...['got in', 'spun', 'max wait'].map((t, j) => s('text', { x: SX[j], y: 16, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 's-sub' }, t)),
            ];
            const t0 = S.t - S.hist.length;
            S.P.forEach((p, k) => {
              const y = Y0 + k * LH;
              kids.push(s('text', { x: 4, y: y + 23, 'font-size': 14, 'font-weight': 800, style: `fill:var(--${['proc', 'accent', 'io', 'thread'][k]})` }, NW ? `P${k + 1}` : `${k + 1}: P${k + 1}`));
              for (let j = 0; j < W; j++) {
                const row = S.hist[j];
                kids.push(row ? s('rect', { x: X0 + j * CW + 1, y: y + 4, width: CW - 2, height: LH - 9, rx: 3, class: LANE_CLS[row[k]], 'stroke-width': 1.5 })
                  : s('rect', { x: X0 + j * CW + 1, y: y + 4, width: CW - 2, height: LH - 9, rx: 3, class: 's-panel', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
              }
              const hot = p.st === 'spin' && p.wait >= 10;
              [p.entries, p.spun, p.maxWait].forEach((val, j) => kids.push(s('text', { x: SX[j], y: y + 24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: 's-monot', style: j === 2 && (hot || val >= 10) ? 'fill:var(--bad)' : j === 0 && val === 0 && S.t > 12 ? 'fill:var(--bad)' : '' }, String(val))));
            });
            const yA = Y0 + n * LH + 16;
            for (let j = 0; j < W; j += 4) kids.push(s('text', { x: X0 + j * CW + CW / 2, y: yA, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(t0 + j)));
            svg.setAttribute('viewBox', `0 0 ${VW} ${yA + 6}`);
            svg.replaceChildren(...kids);
            const tot = S.P.reduce((a, p) => a + p.spun, 0), all = n * S.t;
            meter.firstChild.style.width = (all ? (100 * tot) / all : 0) + '%';
            pct.innerHTML = `Processor time burned spinning: <b>${all ? Math.round((100 * tot) / all) : 0}%</b> <span class="muted">(${tot} of ${all} processor-ticks)</span>`;
          }
          function run() { if (timer) return; timer = ctx.every(650, () => tick()); bRun.textContent = 'Pause'; }
          function stop() { if (timer) clearInterval(timer); timer = null; bRun.textContent = 'Run'; }
          const seg = ctx.ui.seg([{ value: 'random', label: 'Random winner' }, { value: 'unlucky', label: 'Unlucky P1' }, { value: 'you', label: 'You pick the winner' }], 'random', (v) => { policy = v; reset(); });
          const slL = ctx.ui.slider({ label: 'Critical section', min: 1, max: 6, value: L, format: (v) => v + (v === 1 ? ' tick' : ' ticks'), onInput: (v) => { L = v; reset(); } });
          const slN = ctx.ui.slider({ label: 'Processes', min: 2, max: 4, value: n, onInput: (v) => { n = v; reset(); } });
          reset();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'The compare_and_swap lock is correct. It is not free, and it is not fair.' }),
              h('p', { class: 'm0 small', html: '<b>Busy waiting.</b> A process that finds <code>bolt = 1</code> does not step aside. It runs compare_and_swap again, and again, in a tight loop, using its processor the whole time and producing nothing. On one processor it is worse: the spinner uses up its turn while the holder, the only process that can free the lock, is not even running.' }),
              h('p', { class: 'm0 small', html: '<b>Starvation.</b> When the lock comes free, every spinner’s next compare_and_swap races for it, and whichever reaches memory first wins. There is no queue and no memory of who waited longest, so the choice is arbitrary. One process can lose again and again, with no limit: <span class="t">starvation</span>.' }),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Starvation is not <span class="t">deadlock</span>. The system keeps working, since others get in all the time. Only the starved process is stuck.' }),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'Stretch the critical section and watch the spinning share grow. Pick <b>Unlucky P1</b> and run. Then drop to 2 processes: fewer rivals means fewer races to lose.' })),
            h('div', { class: 'stack gap-s' },
              h('div', { class: 'row' }, seg, h('span', { class: 'grow' }), h('button', { class: 'btn sm', type: 'button', onclick: () => { stop(); tick(); } }, 'Step'), bRun, h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset')),
              h('div', { class: 'grid-2', style: { gap: '18px' } }, slL, slN),
              h('div', { class: 'card white tight stack gap-s' },
                h('div', { class: 'row small', style: { gap: '16px' } },
                  h('span', { html: '<i class="legend-sw" style="border-color:var(--proc);background:color-mix(in srgb, var(--proc) 22%, var(--panel))"></i>other useful work' }),
                  h('span', { html: '<i class="legend-sw" style="border-color:var(--warn);background:color-mix(in srgb, var(--warn) 45%, var(--panel))"></i>spinning (wasted)' }),
                  h('span', { html: '<i class="legend-sw" style="border-color:var(--ok);background:color-mix(in srgb, var(--ok) 45%, var(--panel))"></i>inside critical section' })),
                svg),
              h('div', { class: 'row nw' }, pct, meter),
              say,
              h('p', { class: 'xs muted m0', html: 'One tick = the time one compare_and_swap attempt takes. <b>got in</b> counts entries; <b>spun</b> counts failed attempts (wasted ticks); <b>max wait</b> is the longest unbroken run of them.' }))));
        },
      },

      /* ============ 8. Priority scheduling + spinning = deadlock (explore, player) ============ */
      {
        title: 'Priorities plus spinning: a deadlock',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const LO = '<b class="pc1">P<sub>low</sub></b>', HI = '<b class="pc2">P<sub>high</sub></b>';
          const VAR = { L: 'proc', H: 'accent' };
          /* SVG text with subscripts: parts are strings, or [text] for a subscript */
          const rich = (props, parts) => { let down = false; return s('text', props, ...parts.map((p) => { const sub = Array.isArray(p); const dy = sub && !down ? 4 : !sub && down ? -4 : 0; down = sub; return s('tspan', Object.assign({ dy: dy || null }, sub ? { 'font-size': '0.75em' } : {}), sub ? p[0] : p); })); };
          const SLOT = {
            spin: [['L', 'other work'], ['L', 'CAS → 0'], ['H', 'resumes'], ['H', 'CAS → 1'], ['H', 'spins'], ['H', 'spins'], ['H', 'spins…']],
            block: [['L', 'other work'], ['L', 'CAS → 0'], ['H', 'resumes'], ['H', 'sleeps'], ['L', 'bolt = 0'], ['H', 'CAS → 0'], ['H', 'bolt = 0']],
          };
          const MARK = { spin: { 2: 'disk', 4: 'timer', 5: 'timer', 6: 'timer' }, block: { 2: 'disk', 5: 'wake-up' } };
          const run = 'Running', rdy = 'Ready', blk = 'Blocked';
          const F0 = [
            { L: [run, 'other work'], H: [blk, 'waiting for a disk read'], bolt: 0, cap: `One processor with <span class="t">priority scheduling</span>. ${LO} is running. ${HI} is asleep until its disk read finishes. The lock is free.` },
            { L: [run, 'in its critical section'], H: [blk, 'waiting for a disk read'], bolt: 1, who: 'L', cap: `${LO} runs <code>compare_and_swap(&bolt, 0, 1)</code>, gets 0 back and enters its critical section. bolt = 1.` },
            { L: [rdy, 'in critical section, paused'], H: [run, 'other work'], bolt: 1, who: 'L', bot: 'warn', cap: `Disk interrupt: ${HI} is Ready and outranks ${LO}, so the dispatcher switches to it in the <b>middle</b> of ${LO}’s critical section. ${LO} still holds bolt.` },
          ];
          const F = {
            spin: F0.concat([
              { L: [rdy, 'in critical section, paused'], H: [run, 'spinning on bolt'], bolt: 1, who: 'L', top: 'warn', bot: 'warn', cap: `${HI} reaches its own critical section for the same resource. compare_and_swap returns 1: taken. ${HI} starts to spin.` },
              { L: [rdy, 'in critical section, paused'], H: [run, 'spinning on bolt'], bolt: 1, who: 'L', top: 'warn', bot: 'warn', cap: `Timer interrupt. The dispatcher picks the highest-priority Ready process. Spinning is not sleeping: ${HI} is still Ready and still outranks ${LO}. So ${HI} runs again, and spins again.` },
              { L: [rdy, 'in critical section, paused'], H: [run, 'spinning on bolt'], bolt: 1, who: 'L', top: 'warn', bot: 'warn', cap: `And again. Only ${LO} can set bolt back to 0, but ${LO} runs only when nothing more important is Ready, and ${HI} is <b>always</b> Ready.` },
              { L: [rdy, 'in critical section, paused'], H: [run, 'spinning on bolt'], bolt: 1, who: 'L', top: 'bad', bot: 'bad', dead: true, cap: `<b>Deadlock.</b> ${HI} waits for ${LO} to release bolt. ${LO} waits for ${HI} to release the processor. Neither can ever happen, so both are stuck for good.` },
            ]),
            block: F0.concat([
              { L: [rdy, 'in critical section, paused'], H: [blk, 'asleep until bolt is free'], bolt: 1, who: 'L', top: 'muted', cap: `${HI} finds the lock taken. This time it does not spin: the OS puts it to sleep until the lock is released. It is <b>Blocked</b>, not Ready.` },
              { L: [run, 'left its critical section'], H: [rdy, 'woken: lock released'], bolt: 0, cap: `With ${HI} asleep, ${LO} is the only Ready process. It runs, finishes its critical section and sets bolt = 0. The OS wakes ${HI}.` },
              { L: [rdy, 'other work'], H: [run, 'in its critical section'], bolt: 1, who: 'H', cap: `${HI} outranks ${LO}, so it runs at once, gets 0 from compare_and_swap and enters. Priorities are respected and nobody is stuck.` },
              { L: [rdy, 'other work'], H: [run, 'other work'], bolt: 0, ok: true, cap: `${HI} leaves and sets bolt = 0. Both got through. Letting a waiter sleep instead of spin is the idea behind semaphores (next section).` },
            ]),
          };
          let mode = 'spin', extra = 0, cur = 0;
          const svg = s('svg', { viewBox: '0 0 620 246', width: '100%', role: 'img', 'aria-label': 'Two processes, the lock, the dispatcher rule and a processor timeline' });
          const BX = { L: 14, H: 336 }, BW = 270, BY = 38, BH = 70;
          const nm = (k) => ['P', [k === 'L' ? 'low' : 'high']];
          function arc(which, cls) {
            const top = which === 'top';
            const col = cls === 'muted' ? 'var(--muted)' : `var(--${cls})`;
            const d = top ? `M 471 ${BY} Q 310 ${BY - 40} 149 ${BY}` : `M 149 ${BY + BH} Q 310 ${BY + BH + 40} 471 ${BY + BH}`;
            const ly = top ? 18 : BY + BH + 20;
            const parts = top ? (mode === 'block' ? [...nm('H'), ' sleeps until bolt is released'] : [...nm('H'), ' waits for bolt (held by ', ...nm('L'), ')'])
              : [...nm('L'), ' waits for the processor (held by ', ...nm('H'), ')'];
            return [s('path', { d, class: 's-line', 'stroke-width': 2.5, 'stroke-dasharray': cls === 'bad' ? null : '6 4', style: `stroke:${col}`, 'marker-end': `url(#arr-${cls === 'muted' ? 'muted' : cls})` }),
              s('rect', { x: 150, y: ly - 11, width: 320, height: 21, rx: 7, style: `fill:var(--panel);stroke:${col}`, 'stroke-width': 1.5 }),
              rich({ x: 310, y: ly + 4, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: `fill:${col}` }, parts)];
          }
          function draw(i) {
            const f = F[mode][i], kids = [];
            if (f.top) kids.push(...arc('top', f.top));
            if (f.bot) kids.push(...arc('bot', f.bot));
            ['L', 'H'].forEach((k) => {
              const [st, doing] = f[k], x = BX[k];
              const stc = st === run ? 'ok' : st === rdy ? 'warn' : 'panel';
              kids.push(s('rect', { x, y: BY, width: BW, height: BH, rx: 12, style: `fill:var(--panel-2);stroke:var(--${VAR[k]});opacity:${st === blk ? 0.75 : 1}`, 'stroke-width': st === run ? 3.5 : 2, 'stroke-dasharray': st === blk ? '7 5' : null }),
                rich({ x: x + 12, y: BY + 22, 'font-size': 15, 'font-weight': 800, style: `fill:var(--${VAR[k]})` }, [...nm(k), k === 'L' ? '  ·  priority 1 (low)' : '  ·  priority 9 (high)']),
                s('rect', { x: x + 12, y: BY + 32, width: 78, height: 22, rx: 11, class: 's-' + stc, 'stroke-width': 1.5 }),
                s('text', { x: x + 51, y: BY + 47.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, st),
                s('text', { x: x + 98, y: BY + 48, 'font-size': 13.5 }, doing));
            });
            const RY = BY + BH + 38;
            kids.push(s('rect', { x: 14, y: RY, width: 204, height: 30, rx: 8, class: 's-mem', 'stroke-width': 2 }),
              f.who ? rich({ x: 116, y: RY + 20, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: 's-monot' }, ['bolt = 1, held by ', ...nm(f.who)])
                : s('text', { x: 116, y: RY + 20, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: 's-monot' }, 'bolt = 0, free'),
              s('rect', { x: 228, y: RY, width: 378, height: 30, rx: 8, class: f.dead ? 's-bad' : f.ok ? 's-ok' : 's-os', 'stroke-width': 2 }),
              s('text', { x: 417, y: RY + 20, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, style: f.dead ? 'fill:var(--bad)' : '' }, f.dead ? 'DEADLOCK: each waits for the other, forever' : 'Dispatcher: run the highest-priority Ready process'));
            const TY = RY + 54;
            kids.push(s('text', { x: 14, y: TY + 25, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 'CPU'));
            SLOT[mode].forEach(([k, txt], j) => {
              const x = 56 + j * 79;
              if (j <= i) {
                kids.push(s('rect', { x: x + 2, y: TY, width: 75, height: 40, rx: 7, style: `fill:color-mix(in srgb, var(--${VAR[k]}) 22%, var(--panel));stroke:var(--${VAR[k]})`, 'stroke-width': j === i ? 3 : 1.5 }),
                  s('text', { x: x + 39.5, y: TY + 16, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: `fill:var(--${VAR[k]})` }, k === 'L' ? 'low' : 'high'),
                  s('text', { x: x + 39.5, y: TY + 33, 'text-anchor': 'middle', 'font-size': 12.5 }, txt));
              } else kids.push(s('rect', { x: x + 2, y: TY, width: 75, height: 40, rx: 7, class: 's-panel', 'stroke-dasharray': '4 4', 'stroke-width': 1 }));
              const mk = MARK[mode][j];
              if (mk && j <= i) kids.push(s('line', { x1: x, y1: TY - 4, x2: x, y2: TY + 44, style: 'stroke:var(--intr)', 'stroke-width': 2.5 }),
                s('text', { x: x + 4, y: TY - 6, 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--intr)' }, '↓ ' + mk));
            });
            svg.replaceChildren(...kids);
          }
          /* Phone layout (viewBox 360 wide, rendered near 1:1): the two process boxes stack, the wait-for
             relations become labelled pills instead of arcs, and the timeline uses short slot labels. */
          const SHORT = { spin: ['work', 'CAS→0', 'wakes', 'CAS→1', 'spin', 'spin', 'spin…'], block: ['work', 'CAS→0', 'wakes', 'sleep', 'bolt=0', 'CAS→0', 'bolt=0'] };
          function drawNarrow(i) {
            const f = F[mode][i], kids = [];
            ['L', 'H'].forEach((k, r) => {
              const [st, doing] = f[k], x = 6, y = 6 + r * 70;
              const stc = st === run ? 'ok' : st === rdy ? 'warn' : 'panel';
              kids.push(s('rect', { x, y, width: 348, height: 62, rx: 12, style: `fill:var(--panel-2);stroke:var(--${VAR[k]});opacity:${st === blk ? 0.75 : 1}`, 'stroke-width': st === run ? 3.5 : 2, 'stroke-dasharray': st === blk ? '7 5' : null }),
                rich({ x: x + 12, y: y + 22, 'font-size': 15, 'font-weight': 800, style: `fill:var(--${VAR[k]})` }, [...nm(k), k === 'L' ? '  ·  priority 1 (low)' : '  ·  priority 9 (high)']),
                s('rect', { x: x + 12, y: y + 31, width: 78, height: 22, rx: 11, class: 's-' + stc, 'stroke-width': 1.5 }),
                s('text', { x: x + 51, y: y + 46.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, st),
                s('text', { x: x + 98, y: y + 47, 'font-size': 13.5 }, doing));
            });
            [['top', f.top], ['bot', f.bot]].forEach(([which, cls], r) => {
              if (!cls) return;
              const col = cls === 'muted' ? 'var(--muted)' : `var(--${cls})`, y = 146 + r * 26;
              const parts = which === 'top' ? (mode === 'block' ? [...nm('H'), ' sleeps until bolt is released'] : [...nm('H'), ' waits for bolt (held by ', ...nm('L'), ')'])
                : [...nm('L'), ' waits for the processor (held by ', ...nm('H'), ')'];
              kids.push(s('rect', { x: 6, y, width: 348, height: 22, rx: 7, style: `fill:var(--panel);stroke:${col}`, 'stroke-width': 1.5, 'stroke-dasharray': cls === 'bad' ? null : '5 3' }),
                rich({ x: 180, y: y + 15.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, style: `fill:${col}` }, parts));
            });
            const RY = 202;
            kids.push(s('rect', { x: 6, y: RY, width: 348, height: 28, rx: 8, class: 's-mem', 'stroke-width': 2 }),
              f.who ? rich({ x: 180, y: RY + 19, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: 's-monot' }, ['bolt = 1, held by ', ...nm(f.who)])
                : s('text', { x: 180, y: RY + 19, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: 's-monot' }, 'bolt = 0, free'),
              s('rect', { x: 6, y: RY + 34, width: 348, height: 28, rx: 8, class: f.dead ? 's-bad' : f.ok ? 's-ok' : 's-os', 'stroke-width': 2 }),
              s('text', { x: 180, y: RY + 53, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: f.dead ? 'fill:var(--bad)' : '' }, f.dead ? 'DEADLOCK: each waits for the other, forever' : 'Dispatcher: highest-priority Ready runs'));
            const TY = RY + 108, SW = 348 / 7;
            kids.push(s('text', { x: 6, y: TY - 28, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.05em' }, 'PROCESSOR TIMELINE →'));
            SLOT[mode].forEach(([k], j) => {
              const x = 6 + j * SW;
              if (j <= i) {
                kids.push(s('rect', { x: x + 1.5, y: TY, width: SW - 3, height: 40, rx: 6, style: `fill:color-mix(in srgb, var(--${VAR[k]}) 22%, var(--panel));stroke:var(--${VAR[k]})`, 'stroke-width': j === i ? 3 : 1.5 }),
                  s('text', { x: x + SW / 2, y: TY + 16, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: `fill:var(--${VAR[k]})` }, k === 'L' ? 'low' : 'high'),
                  s('text', { x: x + SW / 2, y: TY + 33, 'text-anchor': 'middle', 'font-size': 12.5 }, SHORT[mode][j]));
              } else kids.push(s('rect', { x: x + 1.5, y: TY, width: SW - 3, height: 40, rx: 6, class: 's-panel', 'stroke-dasharray': '4 4', 'stroke-width': 1 }));
              const mk = MARK[mode][j];
              if (mk && j <= i) kids.push(s('line', { x1: x, y1: TY - 4, x2: x, y2: TY + 44, style: 'stroke:var(--intr)', 'stroke-width': 2.5 }),
                s('text', { x: x + 3, y: TY - 7, 'font-size': 12, 'font-weight': 800, style: 'fill:var(--intr)' }, '↓ ' + mk));
            });
            svg.replaceChildren(...kids);
          }
          if (ctx.narrow) svg.setAttribute('viewBox', '0 0 360 356');
          /* "you are the dispatcher" panel: live only on the last spin frames. One box holds the prompt, then the result. */
          const dMsg = h('div', { class: 'grow', style: { minWidth: 0 } });
          const bH = h('button', { class: 'btn sm', type: 'button', style: { borderColor: 'var(--accent)', color: 'var(--accent)' }, html: '<span>Run P<sub>high</sub></span>', onclick: () => pick('H') });
          const bL = h('button', { class: 'btn sm', type: 'button', style: { borderColor: 'var(--proc)', color: 'var(--proc)' }, html: '<span>Run P<sub>low</sub></span>', onclick: () => pick('L') });
          const dBox = h('div', { class: 'vbox row nw', style: { gap: '10px', minHeight: '64px' } }, dMsg, h('div', { class: 'stack gap-s' }, bH, bL));
          const dSay = (cls, html) => { dBox.className = 'vbox row nw ' + cls; dMsg.innerHTML = html; };
          function pick(k) {
            if (!(mode === 'spin' && cur >= 4)) return;
            if (k === 'H') { extra++; dSay('warn', `By the rule, ${HI} runs and spends its whole turn spinning; compare_and_swap keeps returning 1. Turns you have handed it: <b>${extra}</b>. bolt is still 1.`); }
            else dSay('bad', `<b>Not allowed.</b> ${HI} is Ready and outranks ${LO}. Priority scheduling always runs the highest-priority Ready process, and spinning keeps ${HI} Ready, so ${LO} never gets a turn.`);
          }
          function paintDisp(i) {
            const live = mode === 'spin' && i >= 4;
            bH.disabled = bL.disabled = !live;
            if (live && extra) return;
            if (!live) extra = 0;
            dSay(live ? 'info' : '', live ? '<b>You are the dispatcher.</b> Another timer interrupt! Who runs next? Try both.'
              : mode === 'spin' ? '<b>You are the dispatcher</b> at each timer interrupt, from player step 5 on: you choose who runs next.' : 'Here the waiter sleeps, so the dispatcher never faces an impossible choice.');
          }
          const player = ctx.ui.player({ count: 7, interval: 2800, render: (i) => { cur = i; (ctx.narrow ? drawNarrow : draw)(i); paintDisp(i); return F[mode][i].cap; } });
          const seg = ctx.ui.seg([{ value: 'spin', label: 'Waiter spins (hardware lock)' }, { value: 'block', label: 'Waiter sleeps (preview)' }], 'spin', (v) => { mode = v; player.reset(); });
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'On one processor, busy waiting plus priorities can freeze two processes for good.' }),
              h('p', { class: 'm0 small', html: '<b>Priority scheduling</b> means the dispatcher always runs the highest-priority process that is Ready. A spinning process counts as Ready: it is busy running a loop, not asleep.' }),
              h('p', { class: 'm0 small', html: `The recipe: ${LO} takes the lock. ${HI} wakes up (say, its disk read finishes), takes the processor away from ${LO}, then needs the same lock.` }),
              h('div', { class: 'callout bad m0 small', 'data-label': 'The trap', html: `${HI} cannot continue until ${LO} runs <code>bolt = 0</code>. ${LO} cannot run while ${HI} is Ready. Each waits for the other: a <span class="t">deadlock</span>.` }),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'The machine-instruction lock does not know about priorities or sleeping. Keep spinlocks for very short waits, and let longer waits sleep instead (flip the switch ' + (ctx.narrow ? 'below' : 'on the right') + ').' }),
              h('p', { class: 'm0 small muted', html: 'Notice that nothing here is buggy: the lock and the scheduler each follow their own rules exactly. Only the combination is fatal.' })),
            h('div', { class: 'stack gap-s' },
              seg,
              h('div', { class: 'card white tight' }, svg),
              player.el,
              dBox)));
        },
      },

      /* ============ 9. Recap: sort the scorecard + key facts (recap) ============ */
      {
        title: 'Recap: the scorecard for hardware locks',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          /* [statement, 0 = advantage | 1 = disadvantage, why] in a deliberately mixed order */
          const ITEMS = [
            ['Works for any number of processes', 0, 'Every process runs the same short loop on the same lock word. A tenth process needs no new code.'],
            ['Waiting processes keep using processor time', 1, '<b>Busy waiting.</b> A spinner runs compare_and_swap over and over, burning its processor while producing nothing.'],
            ['Simple, so it is easy to check that it is correct', 0, 'One loop around one atomic instruction. Compare that with the careful flag juggling of the software approaches in 5.1.'],
            ['A waiting process can be passed over again and again', 1, '<b>Starvation is possible.</b> When the lock comes free, the winner is whoever’s instruction reaches memory first. No queue, no fairness.'],
            ['Works on one processor, or on several that share main memory', 0, 'The atomic instruction works on the shared memory word itself, so it does not matter whether rivals interleave or truly overlap.'],
            ['Can protect many critical sections, each with its own lock word', 0, 'Give each resource its own variable (<code>bolt_printer</code>, <code>bolt_queue</code>). Users of different resources never block each other.'],
            ['A high-priority spinner can shut out the low-priority lock holder', 1, '<b>Deadlock is possible.</b> On one processor with priority scheduling, the spinner stays Ready forever, so the holder never runs to release the lock.'],
          ];
          const got = ITEMS.map(() => null);
          const score = h('span', { class: 'chip' });
          const say = verdict(ctx);
          const rows = ITEMS.map(([txt, ans, why], k) => {
            const mk = (lab, v, col) => h('button', { class: 'btn sm', type: 'button', style: { borderColor: `var(--${col})`, color: `var(--${col})` }, onclick: () => choose(k, v) }, lab);
            const row = h('div', { class: 'sb-row', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' } : null }, h('span', { html: txt, style: ctx.narrow ? { gridColumn: '1 / -1' } : null }), mk('Advantage', 0, 'ok'), mk('Disadvantage', 1, 'bad'));
            return row;
          });
          function choose(k, v) {
            const [txt, ans, why] = ITEMS[k];
            got[k] = v === ans;
            rows[k].className = 'sb-row ' + (got[k] ? 'good' : 'oops');
            const right = got.filter((g) => g === true).length;
            score.className = 'chip ' + (right === ITEMS.length ? 'ok' : 'accent');
            score.textContent = `${right} / ${ITEMS.length} sorted correctly`;
            if (right === ITEMS.length) say.say('ok', '<b>Scorecard complete.</b> Four advantages (any number of processes, one or many processors, simple, many critical sections) and three disadvantages (busy waiting, starvation, deadlock).');
            else say.say(got[k] ? 'ok' : 'bad', `<b>${got[k] ? 'Right' : 'Not quite'}: it is ${ans ? 'a disadvantage' : 'an advantage'}.</b> ${why}`);
          }
          score.textContent = `0 / ${ITEMS.length} sorted correctly`;
          say.say('info', 'Sort each statement about the machine-instruction approach (compare_and_swap or exchange). The reason appears here.');
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'card stack gap-s' },
              h('div', { class: 'row' }, h('h3', { class: 'm0' }, 'Sort the scorecard'), h('span', { class: 'grow' }), score),
              ...rows, say),
            h('div', { class: 'stack gap-s' },
              h('h3', { class: 'm0' }, 'Six facts to keep'),
              h('p', { class: 'small muted m0' }, 'Say the answer out loud, then click the card to check.'),
              ctx.ui.flipcards([
                ['When does switching off interrupts work?', 'Only on a single processor, and only for kernel code. Other processors carry on regardless.'],
                ['What makes an instruction atomic?', 'Its read and write of one memory word happen as one step. Nothing can get in between.'],
                ['What does compare_and_swap return?', 'Always the OLD value. It stores newval only if that old value equals testval.'],
                ['The exchange invariant', 'bolt + key<sub>1</sub> + … + key<sub>n</sub> = n. There is only one 0, so at most one process is inside.'],
                ['What is busy waiting?', 'Testing the lock again and again in a loop, using processor time and doing no useful work.'],
                ['Why can priorities cause deadlock?', 'The high-priority spinner is always Ready, so the low-priority holder never runs to unlock.'],
              ], { cols: 2, height: 108 }),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Next up', html: 'Semaphores (5.4) let a waiting process sleep instead of spin, so it stops burning processor time and cannot shut out the lock holder the way a spinner can.' }))));
        },
      },

      /* ============ 10. Check yourself (quiz) ============ */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'On a computer with a single processor, why does switching interrupts off before a critical section give mutual exclusion?',
            choices: ['Without interrupts the running process cannot be switched out, so no other process runs until it switches them back on', 'It locks the shared variables in memory so that other processes cannot read them', 'The hardware throws away every interrupt that arrives, so the operating system never runs', 'It tells every other processor to pause until interrupts are switched back on'],
            answer: 0,
            feedback: [null, 'Memory is not locked at all. The method works only because no other process gets the processor.', 'Interrupts are not thrown away. They are held as pending and delivered once interrupts are back on.', 'Switching interrupts off affects only the processor that does it. That is exactly why the method fails on a multiprocessor.'],
            why: 'On one processor, a process loses the processor only through an OS call or an interrupt. With interrupts off (and no OS calls inside), nothing can switch it out, so nothing else can run and get into the critical section.' },
          { type: 'multi', q: 'Which statements about using interrupt disabling for mutual exclusion are true? Select all that apply.',
            choices: ['While interrupts are off, the processor cannot interleave other processes, so efficiency can suffer', 'It does not work on a multiprocessor', 'Device interrupts that arrive while interrupts are off are lost for good', 'Switching interrupts off is a privileged instruction, available only to the kernel', 'It forces processes on other processors to wait'],
            answer: [0, 1, 3],
            why: 'The two costs are lost efficiency (no interleaving, devices wait) and failure on multiprocessors, since the other processors are not affected. Arriving interrupts are held as pending, not lost, and ordinary programs are not allowed to switch interrupts off.' },
          { type: 'tf', q: 'The line <code>if (bolt == 0) bolt = 1;</code> is a safe lock, because it is only one line of code.',
            answer: false,
            why: 'One line of source code can be several machine actions: here a read of bolt and then a separate write. Another process can run between them, see bolt = 0 too, and both get in. Only an atomic instruction closes that gap.' },
          { q: 'The shared word holds 5. A process executes <code>old = compare_and_swap(&word, 5, 9);</code>. What happens?',
            choices: ['old is 5, and word now holds 9', 'old is 9, and word now holds 9', 'old is 5, and word still holds 5', 'old is 1 (meaning success), and word now holds 9'],
            answer: 0,
            feedback: [null, 'compare_and_swap returns the value it found (the old value), not the new one.', 'The word matched testval (5 = 5), so the new value 9 is written.', 'This version returns the old value, not a success flag. A caller learns about success by comparing the returned value with testval.'],
            why: 'compare_and_swap reads the word (5), compares it with testval (5), and because they match, writes newval (9). It always returns the old value, so old = 5.' },
          { type: 'num', q: 'The shared word holds 3. A process executes <code>compare_and_swap(&word, 0, 1)</code>. What value does the instruction return?',
            answer: 3, tol: 0,
            hint: 'Does 3 match testval? Either way, what does compare_and_swap always return?',
            why: 'The old value 3 does not equal testval 0, so nothing is written and the word stays 3. The instruction still returns the old value: 3.' },
          { type: 'tf', q: 'In the compare_and_swap spinlock, a process that gets 1 back from compare_and_swap has just entered its critical section.',
            answer: false,
            why: 'Getting 1 back means the word already held 1: someone else holds the lock, and nothing was written. The process loops and tests again. It enters only when it gets 0 back, which means it just changed bolt from 0 to 1 itself.' },
          { type: 'order', q: 'Put the actions of a single compare_and_swap(word, testval, newval) instruction in order.',
            items: ['Read the memory word into oldval', 'Compare oldval with testval', 'If they are equal, write newval into the word', 'Return oldval to the caller'],
            why: 'Read, compare, conditionally write, return the old value. All four happen inside one atomic instruction, so no other access to the word can come between them.' },
          { type: 'num', q: 'Six processes share a lock built with the exchange instruction (bolt starts at 0, and each process starts every attempt with its private key set to 1). Right now one process is inside its critical section and the other five are waiting in their exchange loops. What is key<sub>1</sub> + key<sub>2</sub> + … + key<sub>6</sub>?',
            answer: 5, tol: 0,
            hint: 'Use the invariant bolt + Σ key<sub>i</sub> = n. What is bolt while someone is inside?',
            why: 'The invariant says bolt + Σ key<sub>i</sub> = n = 6. With a process inside, bolt = 1, so the keys add to 5: the holder’s key is 0, and each waiter keeps swapping its 1 for bolt’s 1, so the other five keys are 1.' },
          { type: 'match', q: 'Match each idea with its description.',
            pairs: [['Interrupt disabling', 'Prevents switches on one processor'], ['compare_and_swap', 'Conditional write; returns old value'], ['exchange', 'Swaps a register with a memory word'], ['Busy waiting', 'Looping on a test, wasting CPU time'], ['Starvation', 'A waiter passed over indefinitely']],
            why: 'Interrupt disabling blocks switches on one processor. compare_and_swap and exchange are the two atomic instructions. Busy waiting and starvation are two of the costs of spinlocks built from them.' },
          { type: 'num', q: 'Four processes each run on their own processor of a shared-memory multiprocessor. P1 holds a spinlock for 40 µs, and during that entire time the other three processes spin on it. How much processor time is spent spinning, in microseconds?',
            answer: 120, tol: 0, unit: 'µs',
            why: 'Three processors each spin for the full 40 µs: 3 × 40 = 120 µs of processor time that does no useful work. That waste is the cost of busy waiting.' },
          { q: 'One processor, priority scheduling. Low-priority P1 holds a compare_and_swap lock and is preempted inside its critical section by high-priority P2, which then spins on the same lock. What happens?',
            choices: ['P2 spins forever and P1 never runs again: a deadlock', 'A timer interrupt soon gives P1 a turn, so P2 only waits a little longer', 'compare_and_swap notices that the holder is paused and hands the lock to P2', 'Both get into their critical sections, so mutual exclusion is broken'],
            answer: 0,
            feedback: [null, 'At each timer interrupt the dispatcher again picks the highest-priority Ready process. A spinning P2 is still Ready, so P1 is never chosen.', 'The instruction knows nothing about processes or who holds the lock. It only compares and writes one word.', 'The lock still keeps P2 out: it keeps getting 1 back. The failure here is that nobody makes progress, not that both get in.'],
            why: 'P2 needs P1 to release bolt, and P1 needs P2 to give up the processor. Spinning keeps P2 Ready, so under priority scheduling P1 never runs. Each waits for the other forever. P2 keeps running, yet this is deadlock, not livelock (5.1): no change in timing can end it.' },
          { type: 'bucket', q: 'Machine-instruction locks: advantage or disadvantage?',
            buckets: ['Advantage', 'Disadvantage'],
            items: [['Works for any number of processes', 0], ['Busy waiting uses processor time', 1], ['Works on a multiprocessor with shared memory', 0], ['Starvation is possible', 1], ['Simple, so easy to verify', 0], ['Supports many critical sections, one variable each', 0], ['Deadlock is possible under priority scheduling', 1]],
            why: 'Advantages: any number of processes, one or many processors sharing memory, simple to verify, many critical sections. Disadvantages: busy waiting, possible starvation (the next winner is arbitrary), possible deadlock (the priority scenario).' },
        ],
      },
    ],
    notes: `
      <h3>5.3 Mutual Exclusion: Hardware Support</h3>
      <p>Every lock comes down to two moves on a shared <b>lock variable</b> (here <code>bolt</code>: 0 = free, 1 = taken): <b>look</b> (is it 0?) and <b>lock</b> (set it to 1). If another process reaches bolt in the gap between them, it also sees 0 and both enter their critical sections. The software approaches of 5.1 cope using ordinary reads and writes, but the code is subtle. Hardware helps in two ways: (1) switch off interrupts so nothing else can run (one processor only), or (2) special machine instructions that look and lock in one indivisible step, so there is no gap.</p>

      <h4>Route 1: interrupt disabling (uniprocessor)</h4>
      <p>On a <b>uniprocessor</b>, processes never truly overlap; they only <b>interleave</b>. A running process keeps the processor until it either calls an OS service or an <b>interrupt</b> arrives and the OS decides to switch. So a process that switches interrupts off before its critical section, and makes no OS calls inside it, cannot be switched out. No other process can run, so none can enter, and no lock variable is needed.</p>
      <pre>while (true) {
    disable interrupts;  /* no switch can happen from here on */
    /* critical section */  /* use the shared data */
    enable interrupts;  /* switching allowed again */
    /* remainder */  /* other work */
}</pre>
      <p>Interrupts that arrive while they are off are not lost: the hardware keeps them <b>pending</b> and delivers them as soon as interrupts are switched back on.</p>
      <p><b>Two costs.</b></p>
      <ul>
        <li><b>Efficiency.</b> While interrupts are off, the processor cannot interleave other processes or serve devices; a finished disk read must wait. Worked example: interrupts go off at t = 10 µs for a 20 µs critical section (until 30 µs); a device interrupt arriving at 18 µs waits 30 − 18 = 12 µs. Longer critical sections delay more events, for longer.</li>
        <li><b>It fails on a multiprocessor.</b> Switching interrupts off affects only the processor that does it. Processes on other processors are already running and can reach the shared data at the same instant, so mutual exclusion is not guaranteed.</li>
      </ul>
      <p>Switching interrupts off is a <b>privileged instruction</b> (kernel only), and even the kernel keeps such stretches very short.</p>

      <h4>Route 2: special machine instructions</h4>
      <p>The hardware fact underneath: memory serves one access to a given location at a time; other accesses to the same location wait. Processor designers built instructions that perform <b>two actions on one word</b> (such as a read and a write, or a read and a test) within a single instruction cycle. Because they cannot be interrupted part-way and no other access to that word can come between the two actions, they are <b>atomic</b>.</p>
      <p>Common mistake: <code>if (bolt == 0) bolt = 1;</code> (or <code>while (bolt == 1) ; bolt = 1;</code>) looks like one action but is two separate memory accesses, a read and then a write. If P1 reads 0, then P2 reads 0, then both write 1, both are inside. An atomic instruction closes exactly this gap.</p>

      <h4>compare_and_swap (compare and exchange)</h4>
      <pre>int compare_and_swap(int *word, int testval, int newval) {
    int oldval;
    oldval = *word;  /* 1. read the word */
    if (oldval == testval)  /* 2. compare with the expected value */
        *word = newval;  /* 3. equal? write the new value */
    return oldval;  /* 4. always return the OLD value */
}  /* all one atomic instruction */</pre>
      <p>It always returns the old value, whether or not it wrote. The caller compares the result with testval: equal means the write happened; anything else means memory was left untouched. Examples: word = 5, <code>compare_and_swap(&amp;word, 5, 9)</code> returns 5 and leaves 9 in word. Word = 3, <code>compare_and_swap(&amp;word, 0, 1)</code> returns 3 and leaves word at 3.</p>
      <p><b>The spinlock:</b></p>
      <pre>int bolt = 0;  /* shared: 0 free, 1 taken */
void P(int i) {
    while (true) {
        while (compare_and_swap(&amp;bolt, 0, 1) == 1)
            ;  /* got 1: taken, test again */
        /* critical section */  /* got 0: bolt is now 1, mine */
        bolt = 0;  /* unlock */
        /* remainder */
    }
}</pre>
      <p>Only a process that finds bolt = 0 leaves the loop, and finding it sets bolt to 1 in the same atomic step, so every other process sees 1 and keeps waiting. Getting 1 back does not mean success: it means someone else holds the lock.</p>

      <h4>The exchange instruction</h4>
      <pre>void exchange(int *reg, int *mem) {  /* a register, a memory word */
    int temp;
    temp = *mem;   /* copy the memory word aside */
    *mem = *reg;   /* register value goes to memory */
    *reg = temp;   /* old memory value to register */
}  /* all one atomic instruction */</pre>
      <p>Each process keeps a private <b>key</b> and swaps it with the shared bolt until it pulls out the 0:</p>
      <pre>int bolt = 0;
void P(int i) {
    while (true) {
        int keyi = 1;  /* fresh key for each attempt */
        do exchange(&amp;keyi, &amp;bolt); /* swap my key with bolt, atomically */
        while (keyi != 0);  /* no 0 pulled out? swap again */
        /* critical section */  /* I hold the only 0 */
        bolt = 0;  /* put the 0 back: unlock */
        /* remainder */
    }
}</pre>
      <p><b>The invariant</b> (a fact that stays true after every step). With n processes, <b>bolt + key<sub>1</sub> + … + key<sub>n</sub> = n</b>. Exchanges only move values around, so the sum never changes and there is exactly one 0 in the whole system. (A process outside the loop counts as key 1, the value its next attempt starts with; a waiter always holds 1.) If bolt = 0, no process is in its critical section. If bolt = 1, exactly one process is inside: the one whose key is 0. Worked example: 6 processes, one inside and five waiting, so bolt = 1 and the keys add up to 6 − 1 = 5. A bug that writes bolt = 0 while the lock is held creates a second 0 (the sum drops), and then two processes can get in.</p>

      <h4>Busy waiting and starvation</h4>
      <p><b>Busy waiting (spin waiting):</b> a process that finds the lock taken keeps executing the test in a loop, using processor time and doing no useful work. On a multiprocessor, each spinner wastes its own processor. Worked example: 4 processes on 4 processors; P1 holds the lock for 40 µs while the other 3 spin the whole time: 3 × 40 = 120 µs of processor time wasted. On a uniprocessor it is worse: the spinner uses up its turn while the holder, the only process that can release the lock, is not running. The waste grows with the number of waiters and the length of the critical section.</p>
      <p><b>Starvation:</b> when the lock is released, all spinners race and whichever instruction reaches memory first wins. The hardware keeps no queue and no record of who waited longest, so the choice is arbitrary and some process could lose indefinitely. With fewer rivals a process wins more often, but there is still no guarantee (a releaser that loops straight back can beat it again). Starvation differs from deadlock: the system keeps making progress; only the starved process is stuck.</p>

      <h4>Deadlock with priorities</h4>
      <p>On one processor with <b>priority scheduling</b> (always run the highest-priority Ready process): low-priority P<sub>low</sub> takes the lock; high-priority P<sub>high</sub> becomes Ready (say, its disk read finishes) and preempts P<sub>low</sub> inside its critical section; P<sub>high</sub> then tries the same lock and spins. A spinning process is still Ready, so at every timer interrupt the dispatcher picks P<sub>high</sub> again. P<sub>high</sub> waits for P<sub>low</sub> to release bolt; P<sub>low</sub> waits for P<sub>high</sub> to release the processor: a <b>deadlock</b>. If the waiter slept (was Blocked) instead of spinning, P<sub>low</sub> would run, unlock, and P<sub>high</sub> would be woken. That is the idea behind semaphores (5.4).</p>

      <h4>Scorecard: machine-instruction approach</h4>
      <table>
        <tr><th>Advantages</th><th>Disadvantages</th></tr>
        <tr><td>Works for any number of processes</td><td>Busy waiting: waiting processes consume processor time</td></tr>
        <tr><td>Works on a uniprocessor or on multiple processors sharing main memory</td><td>Starvation is possible: the next process to enter is chosen arbitrarily</td></tr>
        <tr><td>Simple, so easy to verify</td><td>Deadlock is possible: a high-priority spinner can shut out a low-priority holder</td></tr>
        <tr><td>Supports multiple critical sections, each with its own lock variable</td><td></td></tr>
      </table>
      <p><b>The two routes compared:</b> interrupt disabling works only on a uniprocessor, only in the kernel, and stalls everything else; atomic instructions work wherever memory is shared, at the price of busy waiting, possible starvation and the priority deadlock.</p>`,
  });
})();
