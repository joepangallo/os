/* =====================================================================
   10.4 UNIX SVR4 Scheduling
   Original teaching material. Helpers shared by several steps live
   inside this IIFE (no globals).
   ===================================================================== */
(function () {
  /* The illustrative time-sharing dispatch table used by steps 5 and 6 (and the quiz and notes).
     Real SVR4 systems ship their own defaults and let an administrator retune them. */
  const QSTEP = [100, 80, 60, 40, 20, 10];
  const TS = Array.from({ length: 60 }, (_, p) => ({
    p,
    q: QSTEP[Math.floor(p / 10)],
    tqexp: Math.max(0, p - 10),
    slpret: Math.min(59, p + 10),
    maxwait: 1,
    lwait: Math.min(59, p + 20),
  }));

  /* The three classes, highest first. */
  const CLASSES = [
    { key: 'rt', name: 'Real-time', term: 'real-time class', lo: 100, hi: 159, cls: 'intr' },
    { key: 'k', name: 'Kernel', term: 'kernel class', lo: 60, hi: 99, cls: 'os' },
    { key: 'ts', name: 'Time-sharing', term: 'time-sharing class', lo: 0, hi: 59, cls: 'proc' },
  ];
  const classOf = (g) => (g >= 100 ? CLASSES[0] : g >= 60 ? CLASSES[1] : CLASSES[2]);

  /* Time-sharing simulation driven by the table TS, one millisecond per tick (step 6).
     procs: [{ n, kind: 'cpu' | 'io', start, burst, sleep }]. A cpu process never blocks; an io process
     blocks after each burst of `burst` ms of processor time and sleeps `sleep` ms.
     Rules: a process that uses its whole quantum moves to ts_tqexp and gets a fresh quantum at the tail of
     that queue; a process waking from a sleep moves to ts_slpret with a fresh quantum; a newcomer with a
     higher priority preempts the running process, which returns to the front of its queue with the rest
     of its quantum; once a second, a process that has waited more than ts_maxwait seconds moves to ts_lwait. */
  function tsRun(procs, T) {
    const P = procs.map((c) => ({ ...c, pri: c.start, left: TS[c.start].q, burstLeft: c.kind === 'io' ? c.burst : Infinity, st: 'ready', wakeAt: -1, dw: 0, cpu: 0, series: [[0, c.start]], quanta: [] }));
    const Q = Array.from({ length: 60 }, () => []);
    P.forEach((p) => Q[p.pri].push(p));
    const segs = [], log = [];
    let run = null;
    const topLevel = () => { for (let l = 59; l >= 0; l--) if (Q[l].length) return l; return -1; };
    const setPri = (p, np, t) => { p.pri = np; p.series.push([t, np]); };
    for (let t = 0; t < T; t++) {
      for (const p of P) if (p.st === 'sleep' && p.wakeAt === t) {
        const np = TS[p.pri].slpret;
        log.push([t, `${p.n} wakes: ts_slpret ${p.pri} → ${np}`]);
        setPri(p, np, t); p.left = TS[np].q; p.dw = 0; p.burstLeft = p.burst; p.st = 'ready'; Q[np].push(p);
      }
      if (t > 0 && t % 1000 === 0) for (const p of P) if (p.st === 'ready' && ++p.dw > TS[p.pri].maxwait) {
        const np = TS[p.pri].lwait;
        Q[p.pri].splice(Q[p.pri].indexOf(p), 1);
        log.push([t, `${p.n} waited too long: ts_lwait ${p.pri} → ${np}`]);
        setPri(p, np, t); p.left = TS[np].q; p.dw = 0; Q[np].push(p);
      }
      const tl = topLevel();
      if (run && tl > run.pri) {
        log.push([t, `${Q[tl][0].n} (${tl}) preempts ${run.n} (${run.pri})`]);
        run.st = 'ready'; Q[run.pri].unshift(run); run = null;
      }
      if (!run && tl >= 0) { run = Q[tl].shift(); run.st = 'run'; }
      const last = segs[segs.length - 1], who = run ? run.n : null, pri = run ? run.pri : null;
      if (last && last.n === who && last.pri === pri && last.t1 === t) last.t1 = t + 1; else segs.push({ n: who, pri, t0: t, t1: t + 1 });
      if (!run) continue;
      run.left--; run.cpu++;
      if (run.kind === 'io') run.burstLeft--;
      if (run.kind === 'io' && run.burstLeft === 0) {
        run.st = 'sleep'; run.wakeAt = t + 1 + run.sleep;
        log.push([t + 1, `${run.n} blocks for I/O until ${run.wakeAt} ms`]);
        run = null;
      } else if (run.left === 0) {
        const q = TS[run.pri].q, np = TS[run.pri].tqexp;
        log.push([t + 1, `${run.n} used its whole ${q} ms quantum: ts_tqexp ${run.pri} → ${np}`]);
        run.quanta.push(q); setPri(run, np, t + 1); run.left = TS[np].q; run.dw = 0; run.st = 'ready'; Q[np].push(run);
        run = null;
      }
    }
    return { P, segs, log };
  }

  Guide.section({
    id: '10.4',
    title: 'UNIX SVR4 Scheduling',
    short: 'UNIX SVR4 scheduling',
    summary: 'SVR4 ranks every process on one 160-level scale: real-time first, then kernel work, then time-sharing.',
    objectives: [
      'Explain the three goals of the SVR4 scheduler and how they differ from the traditional UNIX scheduler of Section 9.3.',
      'Place any global priority from 0 to 159 in its class (real-time, kernel or time-sharing) and state how that class sets priorities and quanta.',
      'Explain what a preemption point is and compute the dispatch latency of a real-time process with and without preemption points.',
      'Trace how the dispatcher uses the dispatch queues and the dqactmap bit map to choose the next process.',
      'Use a time-sharing dispatch table to predict how a process’s priority and quantum change when it uses its quantum, sleeps, or waits too long.',
    ],
    terms: [
      ['UNIX SVR4 (System V Release 4)', 'AT&T’s Release 4 of UNIX System V, from the late 1980s, which merged features of the main UNIX branches of its day. Its scheduler, taught here, lives on in Solaris and illumos.'],
      ['Global priority', 'The single number, from 0 to 159, that SVR4 uses to rank every ready process whatever its class. A higher number means a more urgent process.'],
      ['Scheduling class (priority class)', 'A group of priority levels that shares one set of rules for choosing priorities and quanta. SVR4 has three: real-time, kernel and time-sharing.'],
      ['Real-time class', 'SVR4’s top class, global priorities 100 to 159. Each process keeps a fixed priority and a fixed quantum, set when a privileged user places it in the class; the scheduler never changes them.'],
      ['Kernel class (system class)', 'SVR4’s middle band, global priorities 60 to 99: fixed priorities and no time slicing. The kernel’s own system processes live here, and a user process that wakes from a sleep inside the kernel borrows a priority in this band until it returns to user mode.'],
      ['Time-sharing class', 'SVR4’s bottom class, global priorities 0 to 59, for ordinary user processes. A process’s priority falls when it uses a whole quantum and rises when it returns from a sleep.'],
      ['Preemption point', 'A place in kernel code where every kernel data structure is either consistent or locked, so the kernel can safely stop the current process there and switch to a waiting real-time process.'],
      ['Dispatch latency', 'The delay between the moment an urgent process becomes ready and the moment it actually starts running.'],
      ['Dispatch queue', 'In SVR4, the ready queue for one global priority level. There are 160 of them, and the processes in one queue take turns round robin.'],
      ['dqactmap', 'SVR4’s bit-map vector with one bit per priority level. A bit is 1 exactly when that level’s dispatch queue holds at least one ready process.'],
      ['Bit map (bit vector)', 'A row of bits in which each bit answers yes or no for one item, such as “is this queue non-empty?”. A processor can find the highest 1 bit in a word with a few instructions.'],
      ['Dispatch table (ts_dptbl)', 'SVR4’s tunable table for the time-sharing class, with one row per priority 0 to 59. Each row gives that priority’s quantum and the new priority to use after each kind of event.'],
      ['ts_globpri', 'The global priority that one row of the time-sharing dispatch table describes (0 to 59).'],
      ['ts_quantum', 'The time quantum given to a time-sharing process that runs at this row’s priority.'],
      ['ts_tqexp', 'The new, lower priority given to a process that used up its whole quantum (“time quantum expired”).'],
      ['ts_slpret', 'The new, higher priority given to a process when it returns to user mode after a sleep (“sleep return”).'],
      ['ts_maxwait', 'The number of seconds a ready process may go without using up its quantum before the starvation guard raises its priority to ts_lwait.'],
      ['ts_lwait', 'The new, higher priority given to a ready process that has gone more than ts_maxwait seconds without using up its quantum: a guard against starvation.'],
      ['priocntl', 'The SVR4 system call (and command) that places a process in a scheduling class and sets its class-specific priority and quantum.'],
    ],
    css: `
      .sec-10-4 .msg { border-radius: 10px; padding: 9px 12px; background: var(--panel-2); border: 1px solid var(--line); font-size: 15px; line-height: 1.45; }
      .sec-10-4 .msg.ok { border-color: var(--ok); background: var(--ok-bg); }
      .sec-10-4 .msg.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-10-4 .msg.info { border-color: var(--accent); background: var(--accent-bg); }
      .sec-10-4 .grid-2 > *, .sec-10-4 .grid-3 > * { min-width: 0; }
      .sec-10-4 .noshrink > * { flex-shrink: 0; }
      .sec-10-4 .goals { margin: 0; padding-left: 24px; }
      .sec-10-4 .goals li { margin: 3px 0; }
      .sec-10-4 .pick { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: center; width: 100%; text-align: left;
        padding: 9px 12px; border-radius: 12px; border: 2px solid var(--line-2); background: var(--panel); color: var(--ink); cursor: pointer; font: inherit; }
      .sec-10-4 .pick:hover { border-color: var(--accent); }
      .sec-10-4 .pick .badge { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-weight: 900; font-size: 16px;
        border: 2px dashed var(--line-2); color: var(--muted); }
      .sec-10-4 .pick .nm { font-weight: 800; font-size: 16.5px; }
      .sec-10-4 .pick .ds { font-size: 14px; color: var(--ink-2); line-height: 1.4; }
      .sec-10-4 .pick.done { cursor: default; }
      .sec-10-4 .pick.done.intr { border-color: var(--intr); background: var(--intr-bg); }
      .sec-10-4 .pick.done.os { border-color: var(--os); background: var(--os-bg); }
      .sec-10-4 .pick.done.proc { border-color: var(--proc); background: var(--proc-bg); }
      .sec-10-4 .pick.done .badge { border-style: solid; border-color: var(--ok); color: var(--ok); background: var(--panel); }
      .sec-10-4 .pick.wrong { border-color: var(--bad); }
      .sec-10-4 .ladder { display: grid; grid-template-columns: 74px minmax(0, 1fr); gap: 10px; }
      .sec-10-4 .ladder .axis { display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center;
        font-size: 12.5px; font-weight: 800; color: var(--muted); line-height: 1.25; padding: 2px 0; }
      .sec-10-4 .ladder .axis .shaft { flex: 1; width: 4px; margin: 6px 0; border-radius: 4px; background: linear-gradient(var(--intr), var(--os), var(--proc)); position: relative; }
      .sec-10-4 .ladder .axis .shaft::before { content: ''; position: absolute; top: -9px; left: -6px; border: 8px solid transparent; border-bottom: 10px solid var(--intr); border-top: 0; }
      .sec-10-4 .bands { position: relative; display: flex; flex-direction: column; gap: 4px; }
      .sec-10-4 .band { display: flex; flex-direction: column; justify-content: center; gap: 2px; width: 100%; padding: 0 14px; border-radius: 10px; text-align: left;
        border: 2px solid var(--line-2); background: var(--panel); color: var(--ink); font: inherit; cursor: pointer; }
      .sec-10-4 .band .bn { font-size: 18px; font-weight: 850; }
      .sec-10-4 .band .br { font-size: 14px; color: var(--ink-2); font-family: var(--mono); }
      .sec-10-4 .band.intr { border-color: var(--intr); background: var(--intr-bg); }
      .sec-10-4 .band.os { border-color: var(--os); background: var(--os-bg); }
      .sec-10-4 .band.proc { border-color: var(--proc); background: var(--proc-bg); }
      .sec-10-4 .band:hover { filter: brightness(1.04); }
      .sec-10-4 .band.on { outline: 3px solid var(--accent); outline-offset: 2px; }
      .sec-10-4 .gmark { position: absolute; right: 0; width: 58px; height: 0; border-top: 3px solid var(--accent); pointer-events: none; transition: top .15s; }
      .sec-10-4 .gmark span { position: absolute; right: 10px; top: -12px; background: var(--accent); color: var(--accent-ink); font-size: 13px; font-weight: 800; border-radius: 6px; padding: 1px 7px; font-family: var(--mono); }
      .sec-10-4 .fact { display: grid; grid-template-columns: 118px minmax(0, 1fr); gap: 10px; font-size: 15px; line-height: 1.42; padding: 6px 0; border-top: 1px dashed var(--line); }
      .sec-10-4 .pchip { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 8px; border-radius: 7px; font-weight: 800; font-size: 14px;
        border: 2px solid var(--line-2); background: var(--panel); color: var(--ink); white-space: nowrap; }
      .sec-10-4 .pchip small { font-weight: 700; font-size: 12.5px; color: var(--ink-2); font-family: var(--mono); }
      .sec-10-4 .pchip.intr { border-color: var(--intr); background: var(--intr-bg); }
      .sec-10-4 .pchip.os { border-color: var(--os); background: var(--os-bg); }
      .sec-10-4 .pchip.proc { border-color: var(--proc); background: var(--proc-bg); }
      .sec-10-4 .qrow { display: grid; grid-template-columns: 58px minmax(0, 1fr); align-items: center; gap: 8px; padding: 1px 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel); min-height: 30px; }
      .sec-10-4 .qrow.top { border-color: var(--ok); background: var(--ok-bg); }
      .sec-10-4 .qrow .lv { font-family: var(--mono); font-weight: 800; font-size: 14.5px; }
      .sec-10-4 .qrow .lv.intr { color: var(--intr); } .sec-10-4 .qrow .lv.os { color: var(--os); } .sec-10-4 .qrow .lv.proc { color: var(--proc); }
      .sec-10-4 .qrow .toks { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }
      .sec-10-4 .cpubox { border: 2px solid var(--cpu); background: var(--cpu-bg); border-radius: 12px; padding: 6px 10px; min-height: 56px; display: flex; flex-direction: column; gap: 4px; justify-content: center; }
      .sec-10-4 .wake.btn { height: 28px; padding: 0 9px; font-size: 13.5px; }
      .sec-10-4 .fact .fk { font-size: 12.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); padding-top: 2px; }
    `,
    steps: [
      /* ---------------- 1. Big picture: three kinds of work, one processor ---------------- */
      {
        title: 'Three kinds of work, one processor',
        kind: 'story',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:10px">
              <p class="lead m0">Traditional UNIX (Section 9.3) served terminals and batch jobs: fixed bands plus one usage formula, recomputed once a second. It could not promise any process a turn within milliseconds.</p>
              <p class="m0"><span class="t" data-t="UNIX SVR4">UNIX System V Release 4</span> (SVR4, late 1980s) rebuilt the scheduler around three goals, in strict order of preference:</p>
              <ol class="goals">
                <li><b>Real-time</b> processes first (<span class="t">real-time class</span>).</li>
                <li><b>Kernel-mode</b> work next (<span class="t">kernel class</span>).</li>
                <li><b>Ordinary user-mode</b> processes last (<span class="t">time-sharing class</span>).</li>
              </ol>
              <p class="small m0">Four mechanisms make that order real: one scale of 160 priorities split into three classes, <span class="t">preemption points</span> inside the kernel, one ready queue per level found through a bit map, and a tunable table that moves time-sharing priorities up and down.</p>
              <div class="callout analogy m0" data-label="Analogy">A restaurant with one stove. An order with a fixed pickup minute is cooked first. Next comes a dish already half-cooked, whose pans block the counter for everyone. Regular orders share whatever stove time is left, in turns.</div>
            </div>
            <div class="card stack" style="gap:10px">
              <h4 class="m0">Who goes first?</h4>
              <p class="small m0">Three processes are ready at the same moment. Click them in the order SVR4 serves them.</p>
              <div class="stack picks" style="gap:8px"></div>
              <div class="msg info pick-msg">Pick the process that should run first.</div>
              <div class="row"><button type="button" class="btn sm pick-reset">Start over</button></div>
              <div class="stack" style="gap:6px;margin-top:auto"><span class="xs muted b">IN THIS SECTION YOU WILL</span>
                <div class="row gap-s small"><span class="chip intr">rank 160 priorities</span><span class="chip os">stop the kernel safely</span><span class="chip accent">drive the dispatcher</span><span class="chip proc">walk the dispatch table</span></div></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          // shown in a fixed mixed-up order; rank is the correct serving position (0 = first)
          const items = [
            { nm: 'Compile job', cls: 'proc', rank: 2, ds: 'A student’s program build in user mode: long, processor-hungry, no deadline.' },
            { nm: 'Disk-read finisher', cls: 'os', rank: 1, ds: 'Just woke up inside the kernel when its disk block arrived. It still holds a kernel buffer that other processes need.' },
            { nm: 'Audio mixer', cls: 'intr', rank: 0, ds: 'Must refill the sound card’s buffer every 5 ms, or the speaker crackles.' },
          ];
          const right = [
            '<b>Right.</b> Real-time work gets the highest preference: for it, being late is the same as being wrong.',
            '<b>Right.</b> Kernel-mode work comes next, so it can finish and release shared kernel resources quickly.',
            '<b>Right.</b> Ordinary time-sharing work comes last and shares whatever processor time is left.',
          ];
          const host = ctx.$('.picks'), msg = ctx.$('.pick-msg');
          let next = 0;
          const btns = items.map((it, i) => h('button', { type: 'button', class: 'pick', onclick: () => choose(i) },
            h('span', { class: 'badge' }, '?'),
            h('span', {}, h('div', { class: 'nm' }, it.nm), h('div', { class: 'ds' }, it.ds))));
          host.append(...btns);
          function say(cls, html) { msg.className = 'msg pick-msg ' + cls; msg.innerHTML = html; }
          function choose(i) {
            const it = items[i];
            if (btns[i].classList.contains('done') || next > 2) return;
            btns.forEach((b) => b.classList.remove('wrong'));
            if (it.rank !== next) {
              btns[i].classList.add('wrong');
              if (next === 0) say('bad', it.rank === 1
                ? '<b>Not yet.</b> Kernel work is important, but a real-time process outranks even the kernel band: its deadline cannot slip.'
                : '<b>Not yet.</b> The compile job has no deadline and runs in user mode. In SVR4 ordinary user work comes last.');
              else say('bad', '<b>Not yet.</b> The disk-read finisher holds a kernel buffer other processes are waiting for. SVR4 lets kernel-mode work finish before ordinary user work.');
              return;
            }
            btns[i].classList.add('done', it.cls);
            btns[i].querySelector('.badge').textContent = String(next + 1);
            next++;
            say('ok', right[it.rank] + (next === 3 ? ' That is the SVR4 order: real-time (priorities 100–159), then kernel (60–99), then time-sharing (0–59).' : ''));
          }
          ctx.$('.pick-reset').addEventListener('click', () => {
            next = 0;
            btns.forEach((b) => { b.className = 'pick'; b.querySelector('.badge').textContent = '?'; });
            say('info', 'Pick the process that should run first.');
          });
        },
      },
      /* ---------------- 2. The 160-level ladder and its three classes ---------------- */
      {
        title: '160 priorities in three classes',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const INFO = {
            rt: {
              who: 'Processes that must react within a known time: controlling a machine, streaming audio or video, sampling sensors. Only a privileged user can move a process into this class, with <span class="t">priocntl</span>.',
              pri: 'Fixed. It is chosen when the process enters the class, and the scheduler never changes it.',
              q: 'Fixed as well: set for each priority level (or for one process) and never adjusted to match behavior.',
              note: '<b>Careful:</b> a real-time process outranks even kernel work, so a buggy one stuck in a loop can freeze everything below it.',
            },
            k: {
              who: 'The kernel’s own system processes (such as the daemon that writes memory pages out to disk), and ordinary processes that were asleep inside the kernel and have just woken, while they finish their kernel work.',
              pri: 'Fixed. The kernel picks the level from what the process was waiting for, much like the bands of Section 9.3. Processor use never moves it.',
              q: 'Not time-sliced: it runs until it sleeps or returns to user mode. Only a real-time process can take over sooner, at a preemption point.',
              note: '<b>Why above user work?</b> A process inside the kernel often holds buffers or locks that others need. Finishing fast releases them.',
            },
            ts: {
              who: 'Ordinary user processes: shells, editors, compilers, browsers. It is the default class for user work.',
              pri: 'Variable. It falls when the process uses its whole quantum, rises when it returns from a sleep, and rises if it waits too long. A table holds the rules (Step 5).',
              q: 'Depends on the priority: higher priority, shorter quantum. The standard SVR4 table runs from 100 ms at priority 0 down to 10 ms at priority 59.',
              note: '<b>Think of it as</b> traditional UNIX’s user band, stretched over the bottom 60 levels and driven by a table instead of a formula.',
            },
          };
          const H = { rt: 168, k: 112, ts: 168 }, GAP = 4;
          const tops = { rt: 0, k: H.rt + GAP, ts: H.rt + GAP + H.k + GAP };
          const bandBtns = {};
          const bands = h('div', { class: 'bands' }, ...CLASSES.map((c) => (bandBtns[c.key] = h('button', {
            type: 'button', class: 'band ' + c.cls, style: { height: H[c.key] + 'px' }, onclick: () => { pick(c.key); slider.set(c.hi, false); mark(c.hi); },
          }, h('span', { class: 'bn' }, c.name), h('span', { class: 'br' }, `${c.hi} … ${c.lo}  ·  ${c.hi - c.lo + 1} levels`)))));
          const gmark = h('div', { class: 'gmark' }, h('span', {}, '0'));
          bands.append(gmark);
          const ladder = h('div', { class: 'ladder' },
            h('div', { class: 'axis' }, h('div', {}, '159', h('br'), 'most urgent'), h('div', { class: 'shaft' }), h('div', {}, '0', h('br'), 'least')),
            bands);

          const factStyle = ctx.narrow ? { gridTemplateColumns: '1fr', gap: '2px' } : null;
          const title = h('div', { style: { fontSize: '22px', fontWeight: 850 } });
          const range = h('span', { class: 'chip' });
          const fWho = h('div'), fPri = h('div'), fQ = h('div');
          const note = h('div', { class: 'msg info' });
          const info = h('div', { class: 'card white stack', style: { gap: '4px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, title, range),
            h('div', { class: 'fact', style: factStyle }, h('span', { class: 'fk' }, 'Who runs here'), fWho),
            h('div', { class: 'fact', style: factStyle }, h('span', { class: 'fk' }, 'Priority'), fPri),
            h('div', { class: 'fact', style: factStyle }, h('span', { class: 'fk' }, 'Quantum'), fQ),
            note);
          const verdict = h('p', { class: 'm0', style: { fontSize: '15.5px', minHeight: '46px' } });
          const slider = ctx.ui.slider({ label: 'Try a global priority', min: 0, max: 159, value: 75, onInput: (v) => { pick(classOf(v).key); mark(v); } });
          slider.setAttribute('data-keys', '');

          function pick(key) {
            const c = CLASSES.find((x) => x.key === key), d = INFO[key];
            Object.entries(bandBtns).forEach(([k, b]) => { b.classList.toggle('on', k === key); b.setAttribute('aria-pressed', k === key); });
            title.innerHTML = `<span style="color:var(--${c.cls})">${c.name} class</span>`;
            range.className = 'chip ' + c.cls; range.textContent = `global priorities ${c.lo}–${c.hi}`;
            fWho.innerHTML = d.who; fPri.innerHTML = d.pri; fQ.innerHTML = d.q; note.innerHTML = d.note;
          }
          function mark(g) {
            const c = classOf(g), n = c.hi - c.lo + 1;
            gmark.style.top = (tops[c.key] + ((c.hi - g + 0.5) / n) * H[c.key]) + 'px';
            gmark.firstChild.textContent = String(g);
            const above = 159 - g, below = g, pl = (k) => (k === 1 ? '' : 's');
            let tail;
            if (c.key === 'rt') tail = above ? `loses only to the <b>${above}</b> real-time level${pl(above)} above it.` : 'nothing outranks it: it is the top of the scale.';
            else if (c.key === 'k') tail = `loses to the <b>${above}</b> levels above it: ` + (above > 60 ? `${above - 60} kernel level${pl(above - 60)} and ` : '') + 'all 60 real-time levels.';
            else tail = above === 100 ? 'loses to the <b>100</b> levels above it: every kernel and real-time level.' : `loses to the <b>${above}</b> levels above it, including all 100 kernel and real-time levels.`;
            verdict.innerHTML = `Global priority <b>${g}</b> is in the <b>${c.name.toLowerCase()}</b> class. ` +
              (below ? `It outranks the <b>${below}</b> level${pl(below)} below it and ${tail}` : `Nothing ranks below it, and it ${tail}`);
          }
          pick('k'); mark(75);
          el.append(h('div', { class: 'split l fill', style: { gap: '22px' } },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'SVR4 ranks every process on one scale of 160 <span class="t">global priorities</span>, split into three <span class="t" data-t="scheduling class">classes</span>. Click a band.' }),
              ladder),
            h('div', { class: 'stack', style: { gap: '10px' } },
              info,
              h('div', { class: 'card tight stack', style: { gap: '6px' } }, slider, verdict),
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'In traditional UNIX (Section 9.3) a <i>smaller</i> number meant more urgent. SVR4 flips it: a <b>larger</b> global priority is more urgent, so 159 beats 0.' }))));
        },
      },
      /* ---------------- 3. Preemption points versus a nonpreemptible kernel ---------------- */
      {
        title: 'Preemption points: stopping the kernel safely',
        kind: 'compare',
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          // process P's write system call: four stretches of kernel work; preemption points sit between them
          const KSEG = [
            { t0: 0, t1: 2.5, what: 'check the arguments and find the open-file entry', mid: 'the entry’s reference count is being changed' },
            { t0: 2.5, t1: 5.5, what: 'take a free buffer off the buffer cache’s free list', mid: 'the free list’s links are half rewired' },
            { t0: 5.5, t1: 9.5, what: 'fill the buffer and update the file’s block map', mid: 'the file’s block map is half updated' },
            { t0: 9.5, t1: 12, what: 'update the file offset and times, then return', mid: 'the file’s offset and times are being changed' },
          ];
          const PP = [2.5, 5.5, 9.5], END = 12, RUN_R = 1.5, TMAX = 14;
          const WORST_NP = END, WORST_PP = Math.max(...KSEG.map((g) => g.t1 - g.t0));
          const W = slim ? 360 : 640, X0 = 14, X1 = W - 14, HGT = 272;
          const x = (t) => X0 + (t / TMAX) * (X1 - X0);
          const fmt = (v) => ctx.util.fmt(v, v % 1 ? 1 : 0);
          const svg = s('svg', { viewBox: `0 0 ${W} ${HGT}`, width: '100%', role: 'img', 'aria-label': 'Two timelines of the same system call, without and with preemption points' });
          const narr = h('div', { class: 'msg', style: { minHeight: '68px' } });
          let a = 4;

          function bar(t0, t1, y, cls, label) {
            const g = s('g', {}, s('rect', { x: x(t0) + 1, y, width: Math.max(2, x(t1) - x(t0) - 2), height: 40, rx: 6, class: cls, 'stroke-width': 2 }));
            if (label && x(t1) - x(t0) > 18) g.append(s('text', { x: (x(t0) + x(t1)) / 2, y: y + 26, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, label));
            return g;
          }
          function lane(y, title, start, withPoints) {
            const g = s('g', {});
            g.append(s('text', { x: X0, y: y - 12, 'font-weight': 800, 'font-size': 15 }, title));
            // P's kernel work before R runs, R's run, then the rest of P's call (shifted later)
            KSEG.forEach((k, i) => {
              if (k.t1 <= start) g.append(bar(k.t0, k.t1, y, 's-os', String(i + 1)));
              else g.append(bar(k.t0 + RUN_R, k.t1 + RUN_R, y, 's-os', String(i + 1)));
            });
            g.append(bar(start, start + RUN_R, y, 's-intr', 'R'));
            if (withPoints) PP.forEach((p) => {
              const px = x(p > start ? p + RUN_R : p);
              g.append(s('path', { d: `M${px - 6},${y - 4} L${px + 6},${y - 4} L${px},${y + 5} Z`, class: 's-os', 'stroke-width': 1.5 }));
            });
            // arrival of R, and the wait bracket under the lane
            const ax = x(a), sx = x(start);
            g.append(s('line', { x1: ax, y1: y - 4, x2: ax, y2: y + 46, stroke: 'var(--intr)', 'stroke-width': 2.5, 'stroke-dasharray': '4 3' }));
            g.append(s('line', { x1: ax, y1: y + 54, x2: sx, y2: y + 54, stroke: 'var(--intr)', 'stroke-width': 2.5 }));
            g.append(s('line', { x1: ax, y1: y + 48, x2: ax, y2: y + 60, stroke: 'var(--intr)', 'stroke-width': 2.5 }));
            g.append(s('line', { x1: sx, y1: y + 48, x2: sx, y2: y + 60, stroke: 'var(--intr)', 'stroke-width': 2.5 }));
            const lx = Math.min(Math.max((ax + sx) / 2, X0 + 70), X1 - 70);
            g.append(s('text', { x: lx, y: y + 78, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, style: 'fill:var(--intr)' }, `R waits ${fmt(start - a)} ms`));
            return g;
          }
          function draw() {
            const next = [...PP, END].find((p) => p > a);
            const k = KSEG.findIndex((g) => a >= g.t0 && a < g.t1);
            svg.replaceChildren(
              lane(28, slim ? `Nonpreemptible · worst ${WORST_NP} ms` : `Nonpreemptible kernel (traditional UNIX) · worst case ${WORST_NP} ms`, END, false),
              lane(150, slim ? `Preemption points ◆ · worst ${WORST_PP} ms` : `With preemption points ◆ (SVR4) · worst case ${WORST_PP} ms`, next, true));
            const axis = s('g', {});
            axis.append(s('line', { x1: X0, y1: HGT - 26, x2: X1, y2: HGT - 26, class: 's-muted' }));
            for (let t = 0; t <= TMAX; t += 2) {
              axis.append(s('line', { x1: x(t), y1: HGT - 30, x2: x(t), y2: HGT - 22, class: 's-muted' }));
              axis.append(s('text', { x: x(t), y: HGT - 6, 'text-anchor': t === TMAX ? 'end' : 'middle', 'font-size': 13, class: 's-sub' }, t + (t === TMAX ? ' ms' : '')));
            }
            svg.append(axis);
            const seg = KSEG[k];
            narr.className = 'msg ' + (next === END ? 'info' : 'ok');
            narr.innerHTML = `At t = <b>${a} ms</b> the kernel is in stretch ${k + 1} (${seg.what}): ${seg.mid}. ` + (next === END
              ? `No preemption point is left before the call returns at ${END} ms, so <b>both kernels switch at ${END} ms</b>: here the points cannot help.`
              : `Switching now could expose that half-done structure, so SVR4 runs on to the <b>preemption point at ${next} ms</b> (R waits ${fmt(next - a)} ms). The nonpreemptible kernel makes R wait until the call returns at ${END} ms (${fmt(END - a)} ms).`);
          }
          const slider = ctx.ui.slider({ label: slim ? 'R ready at' : 'Real-time process R becomes ready at', min: 0, max: 11, step: 1, value: a, format: (v) => v + ' ms', onInput: (v) => { a = v; draw(); } });
          slider.setAttribute('data-keys', '');
          const legend = h('div', { class: 'xs', style: { display: 'grid', gridTemplateColumns: slim ? '1fr' : '1fr 1fr', gap: '2px 14px', color: 'var(--ink-2)' } },
            ...KSEG.map((g, i) => h('div', {}, h('b', {}, `${i + 1} `), `${g.t0}–${g.t1} ms: ${g.what}`)));
          draw();
          el.append(h('div', { class: 'split l fill', style: { gap: '22px' } },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'lead m0' }, 'Real-time processes outrank everything, but only if the processor can be taken back quickly.'),
              h('p', { class: 'm0', html: 'Traditional UNIX had a <span class="t">nonpreemptible kernel</span>: once process P was inside a system call, a newly ready process waited until P slept or returned to user mode.' }),
              h('p', { class: 'm0', html: 'Why not stop the kernel anywhere? Midway through a call it may be half done changing a shared structure. Another process running then could find it broken.' }),
              h('p', { class: 'm0', html: 'SVR4’s compromise: <span class="t">preemption points</span>, spots in long kernel paths where every structure is consistent or locked. At each one the kernel checks a flag meaning “a real-time process is ready” and, if it is set, switches right there.' }),
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'The worst <span class="t">dispatch latency</span> shrinks from the longest system call to the longest stretch between two points.' }),
              h('p', { class: 'xs muted m0' }, 'Later kernels went further: Solaris 2 and Linux 2.6 (as a build option) lock shared structures individually, so the kernel can be preempted almost anywhere.')),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),
              legend, slider, narr)));
        },
      },
      /* ---------------- 4. Dispatcher lab: dispatch queues and the dqactmap bit map ---------------- */
      {
        title: 'Dispatcher lab: one queue per level, one bit per queue',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const POOL = ['E', 'F'];
          let P, Q, run, blocked, used, last;
          const push = (g, n, front) => { if (!Q.has(g)) Q.set(g, []); if (front) Q.get(g).unshift(n); else Q.get(g).push(n); };
          const top = () => { let best = -1; for (const [g, q] of Q) if (q.length && g > best) best = g; return best; };
          const cname = (g) => classOf(g).name.toLowerCase();
          function init() {
            P = {
              A: { n: 'A', g: 30 }, B: { n: 'B', g: 30 }, C: { n: 'C', g: 45 },
              D: { n: 'D', g: 75, why: 'asleep in the kernel until its disk block arrives' },
              R: { n: 'R', g: 120, why: 'waiting for its 10 ms timer' },
            };
            Q = new Map();
            push(30, 'A'); push(30, 'B'); push(45, 'C');
            run = null; blocked = ['D', 'R']; used = 0;
            last = { cls: 'info', html: 'The processor is idle. Press <b>Dispatch</b> and watch which bit the dispatcher looks at.' };
          }
          function dispatch() {
            const g = top();
            if (g < 0) { run = null; return 'Every bit is 0: nothing is ready, so the processor idles until something wakes up.'; }
            const n = Q.get(g).shift();
            const rest = Q.get(g);
            if (!rest.length) Q.delete(g);
            run = n;
            return `Highest set bit: <b>${g}</b>. The dispatcher runs <b>${n}</b>, the head of queue ${g}; ` +
              (rest.length ? `${rest.join(', ')} still wait${rest.length === 1 ? 's' : ''} there, so bit ${g} stays 1.` : `the queue is now empty, so bit ${g} → 0.`);
          }
          function arrive(n, how) {
            const p = P[n], was = Q.has(p.g);
            push(p.g, n);
            const t = `${how} It joins the tail of queue ${p.g}, and bit ${p.g} ${was ? 'stays 1' : '→ 1'}.`;
            if (!run) return t + ' ' + dispatch();
            const r = P[run];
            if (p.g > r.g) {
              // kernel-band work can be preempted only by a real-time process, and only at a preemption point
              const inK = classOf(r.g).key === 'k';
              if (inK && classOf(p.g).key !== 'rt') return t + ` ${p.g} &gt; ${r.g}, but ${r.n} is working inside the kernel, where only a real-time process may preempt it. ${n} waits until ${r.n} sleeps or returns to user mode.`;
              push(r.g, run, true); run = null;
              return t + ` ${p.g} &gt; ${r.g}, so ${n} <b>preempts</b> ${r.n}` + (inK ? ' at the kernel’s next preemption point' : '') + `; ${r.n} goes back to the <i>front</i> of queue ${r.g}. ` + dispatch();
            }
            return t + ` ${p.g} is not higher than ${r.n}’s ${r.g}, so ${r.n} keeps the processor.`;
          }
          function act(kind, arg) {
            if (kind === 'dispatch') last = { cls: 'ok', html: dispatch() };
            if (kind === 'expire') {
              const r = P[run]; push(r.g, run); run = null;
              last = { cls: 'ok', html: `<b>${r.n}</b>’s quantum expired: it goes to the <i>tail</i> of queue ${r.g} (round robin). ` + dispatch() };
            }
            if (kind === 'block') {
              const r = P[run]; r.why = 'waiting for I/O'; blocked.push(run); run = null;
              last = { cls: 'ok', html: `<b>${r.n}</b> blocks for I/O and leaves every queue. ` + dispatch() };
            }
            if (kind === 'wake') { blocked = blocked.filter((x) => x !== arg); last = { cls: 'ok', html: arrive(arg, `<b>${arg}</b> wakes.`) }; }
            if (kind === 'add') {
              const n = POOL[used++]; P[n] = { n, g: arg };
              last = { cls: 'ok', html: arrive(n, `New process <b>${n}</b> (${arg}) is ready.`) };
            }
            if (kind === 'reset') init();
            draw();
          }

          // the bit map: three rows of cells, highest priority at the left of each row
          const W = slim ? 360 : 640, PX = slim ? 10 : 18, CW = (W - 2 * PX) / 60, CH = 22;
          const ROWY = { rt: 26, k: 86, ts: 146 };
          const svg = s('svg', { viewBox: `0 0 ${W} 182`, width: '100%', role: 'img', 'aria-label': 'The dqactmap bit map: one cell per priority level' });
          const chip = (n) => { const g = P[n].g; return h('span', { class: 'pchip ' + classOf(g).cls }, n, h('small', {}, String(g))); };
          const cpu = h('div', { class: 'cpubox' });
          const blk = h('div', { class: 'row gap-s' });
          const qlist = h('div', { class: 'stack', style: { gap: '4px' } });
          const narr = h('div', { class: 'msg', style: { minHeight: '118px' } });
          const bitCap = h('div', { class: 'small', style: { minHeight: '22px' } });
          const bDisp = h('button', { type: 'button', class: 'btn primary', onclick: () => act('dispatch') }, 'Dispatch');
          const bExp = h('button', { type: 'button', class: 'btn', onclick: () => act('expire') }, 'Quantum expires');
          const bBlk = h('button', { type: 'button', class: 'btn', onclick: () => act('block') }, 'Running process blocks');
          const addSl = ctx.ui.slider({ label: 'New priority', min: 0, max: 159, value: 52, format: (v) => (slim ? String(v) : `${v} · ${classOf(v).name.toLowerCase()}`) });
          addSl.setAttribute('data-keys', '');
          const bAdd = h('button', { type: 'button', class: 'btn', onclick: () => act('add', addSl.get()) }, 'Add process');
          const bReset = h('button', { type: 'button', class: 'btn ghost', onclick: () => act('reset') }, 'Reset');

          function draw() {
            svg.replaceChildren();
            const best = top();
            CLASSES.forEach((c) => {
              const y = ROWY[c.key];
              let set = 0;
              for (let g = c.hi; g >= c.lo; g--) {
                const on = Q.has(g), xx = PX + (c.hi - g) * CW;
                if (on) set++;
                svg.append(s('rect', on
                  ? { x: xx + 0.5, y, width: CW - 1, height: CH, rx: 2, style: `fill:var(--${c.cls});stroke:var(--${g === best ? 'accent' : c.cls})`, 'stroke-width': g === best ? 3 : 1 }
                  : { x: xx + 0.5, y, width: CW - 1, height: CH, rx: 2, style: 'fill:var(--panel);stroke:var(--line)', 'stroke-width': 1 }));
                if (on && g === best) svg.append(s('path', { d: `M${xx + CW / 2 - 6},${y + CH + 12} L${xx + CW / 2 + 6},${y + CH + 12} L${xx + CW / 2},${y + CH + 4} Z`, style: 'fill:var(--accent);stroke:none' }));
              }
              svg.append(s('text', { x: PX, y: y - 7, 'font-size': 13.5, 'font-weight': 800, style: `fill:var(--${c.cls})` }, `${c.name}: bits ${c.hi} … ${c.lo}`));
              svg.append(s('text', { x: W - PX, y: y - 7, 'font-size': 13, 'text-anchor': 'end', class: 's-sub' }, `${set} set`));
            });
            bitCap.innerHTML = best >= 0 ? `Highest set bit: <b>${best}</b> (outlined) → the dispatcher serves dispatch queue ${best} next.` : 'All 160 bits are 0: nothing is ready.';
            const levels = [...Q.keys()].sort((x, y) => y - x);
            qlist.replaceChildren(...(levels.length ? levels.map((g) => h('div', { class: 'qrow' + (g === best ? ' top' : '') },
              h('span', { class: 'lv ' + classOf(g).cls }, 'q ' + g),
              h('div', { class: 'toks' }, h('span', { class: 'xs muted' }, 'head →'), ...Q.get(g).map(chip)))) : [h('div', { class: 'small muted' }, 'No ready process: every dispatch queue is empty.')]));
            cpu.replaceChildren(h('span', { class: 'xs b', style: { color: 'var(--cpu)' } }, 'PROCESSOR'),
              run ? h('div', { class: 'row gap-s' }, chip(run), h('span', { class: 'small' }, `running (${cname(P[run].g)})`)) : h('span', { class: 'small muted' }, 'idle'));
            blk.replaceChildren(h('span', { class: 'xs b muted' }, 'BLOCKED'), ...(blocked.length ? blocked.map((n) => h('button', {
              type: 'button', class: 'btn wake ' + classOf(P[n].g).cls, title: P[n].why, onclick: () => act('wake', n),
            }, `Wake ${n} (${P[n].g})`)) : [h('span', { class: 'small muted' }, 'none')]));
            const kband = run && classOf(P[run].g).key === 'k';
            bDisp.disabled = !!run || top() < 0;
            bExp.disabled = !run || kband;
            bExp.title = kband ? 'Kernel-band work runs until it sleeps again or returns to user mode' : '';
            bBlk.disabled = !run;
            bAdd.disabled = used >= POOL.length;
            bAdd.textContent = used >= POOL.length ? 'No more names' : `Add process ${POOL[used]}`;
            narr.className = 'msg ' + last.cls;
            narr.innerHTML = last.html + (kband ? ' <i>Kernel-band work is not time-sliced: it runs until it sleeps or returns to user mode, unless a real-time process preempts it at a preemption point.</i>' : '');
          }
          init(); draw();
          el.append(h('div', { class: 'split l fill', style: { gap: '20px' } },
            h('div', { class: 'stack noshrink', style: { gap: '7px' } },
              h('p', { class: 'm0', style: { fontSize: '16px' }, html: 'SVR4 keeps one <span class="t">dispatch queue</span> per global priority (160 queues), each served <span class="t">round robin</span>. The <span class="t">bit map</span> <span class="t">dqactmap</span> holds one bit per level, 1 when that queue is not empty. The dispatcher finds the highest 1 bit and runs the head of that queue. Finding it is cheap: 160 bits are only five 32-bit words.' }),
              h('div', { class: 'row gap-s' }, bDisp, bExp, bBlk),
              h('div', { class: 'card tight stack', style: { gap: '6px' } }, addSl, h('div', { class: 'row gap-s' }, bAdd, bReset)),
              narr,
              h('p', { class: 'xs muted m0', style: { marginTop: 'auto' } }, 'Priorities stay fixed here; Step 5 makes them move. A newcomer preempts at once if the running process is in user mode (assumed here for time-sharing work). Inside the kernel, a real-time newcomer waits for the next preemption point, any other until the process sleeps or returns to user mode.')),
            h('div', { class: 'stack noshrink', style: { gap: '8px' } },
              h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg, bitCap),
              h('div', { class: 'grid-2', style: { gap: '10px', gridTemplateColumns: slim ? '1fr' : 'minmax(0, 2fr) minmax(0, 3fr)' } }, cpu, h('div', { class: 'card tight', style: { display: 'flex', alignItems: 'center' } }, blk)),
              h('div', { class: 'stack', style: { gap: '4px' } }, h('span', { class: 'xs b muted' }, 'READY: NON-EMPTY DISPATCH QUEUES, HIGHEST FIRST'), qlist))));
        },
      },
      /* ---------------- 5. The time-sharing dispatch table ---------------- */
      {
        title: 'The time-sharing dispatch table',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const MEANING = {
            ts_globpri: 'the global priority this row describes',
            ts_quantum: 'how long a process at this priority may run',
            ts_tqexp: 'new priority if it uses its <b>whole</b> quantum',
            ts_slpret: 'new priority when it returns from a <b>sleep</b>',
            ts_maxwait: 'longest it may wait without using up its quantum',
            ts_lwait: 'new priority once it has waited <b>longer</b> than ts_maxwait',
          };
          const COL = { ts_tqexp: 'warn', ts_slpret: 'ok', ts_lwait: 'accent' };
          let cur = 35, trail = [35], lastMsg = { cls: 'info', html: 'Pick an event. Before you click, predict the new row from the table.' };
          const tbody = h('tbody');
          const tbl = h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', {}, 'Column'), h('th', {}, 'Value'), h('th', {}, 'Meaning'))), tbody);
          const W = slim ? 360 : 640, X0 = slim ? 30 : 44, X1 = W - 10, BASE = 226, SC = 1.3;
          const bw = (X1 - X0) / 60, bx = (p) => X0 + p * bw, top = (p) => BASE - TS[p].q * SC;
          const svg = s('svg', { viewBox: `0 0 ${W} 262`, width: '100%', role: 'img', 'aria-label': 'Quantum for each time-sharing priority, with arrows to the rows an event leads to' });
          const big = h('div', { class: 'big', style: { fontSize: '34px' } });
          const qline = h('div', { class: 'small' });
          const trailEl = h('div', { class: 'row gap-s small', style: { minHeight: '26px' } });
          const narr = h('div', { class: 'msg', style: { minHeight: '66px' } });

          function row(p) {
            const r = TS[p];
            return [['ts_globpri', String(p)], ['ts_quantum', r.q + ' ms'], ['ts_tqexp', String(r.tqexp)], ['ts_slpret', String(r.slpret)], ['ts_maxwait', r.maxwait + ' s'], ['ts_lwait', String(r.lwait)]];
          }
          function chart() {
            svg.replaceChildren();
            const r = TS[cur];
            // axes and gridlines for 0, 50 and 100 ms
            [0, 50, 100].forEach((ms) => {
              const y = BASE - ms * SC;
              svg.append(s('line', { x1: X0, y1: y, x2: X1, y2: y, class: 's-muted', 'stroke-width': 1 }));
              svg.append(s('text', { x: X0 - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, String(ms)));
            });
            svg.append(s('text', { x: X0 - 4, y: BASE - 100 * SC - 12, 'font-size': 13, class: 's-sub', 'text-anchor': slim ? 'start' : 'middle' }, 'ms'));
            const dests = { ts_tqexp: r.tqexp, ts_slpret: r.slpret, ts_lwait: r.lwait };
            for (let p = 0; p < 60; p++) {
              const hit = Object.entries(dests).find(([, d]) => d === p && d !== cur);
              const style = p === cur ? 'fill:var(--accent);stroke:var(--accent)' : hit ? `fill:var(--${COL[hit[0]]}-bg);stroke:var(--${COL[hit[0]]})` : 'fill:var(--proc-bg);stroke:var(--proc)';
              svg.append(s('rect', { x: bx(p) + 0.6, y: top(p), width: bw - 1.2, height: TS[p].q * SC, style, 'stroke-width': p === cur || hit ? 1.6 : 0.8 }));
            }
            for (let p = 0; p <= 50; p += 10) svg.append(s('text', { x: bx(p) + bw / 2, y: BASE + 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(p)));
            svg.append(s('text', { x: bx(59) + bw / 2, y: BASE + 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, '59'));
            svg.append(s('text', { x: (X0 + X1) / 2, y: BASE + 34, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'time-sharing priority (row) → higher is more urgent'));
            // arrows from the current row to the three destination rows
            const H = { ts_tqexp: 34, ts_slpret: 46, ts_lwait: 112 };
            const LBL = { ts_tqexp: 'tqexp', ts_slpret: 'slpret', ts_lwait: 'lwait' };
            const selfs = [];
            let minY = top(cur) - 10;
            Object.entries(dests).forEach(([k, d]) => {
              if (d === cur) { selfs.push(LBL[k]); return; }
              const x1 = bx(cur) + bw / 2, x2 = bx(d) + bw / 2, y1 = top(cur) - 3, y2 = top(d) - 3;
              const cy = Math.min(y1, y2) - H[k], ay = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
              svg.append(s('path', { d: `M${x1},${y1} Q${(x1 + x2) / 2},${cy} ${x2},${y2}`, fill: 'none', style: `stroke:var(--${COL[k]})`, 'stroke-width': 2.2, 'marker-end': `url(#arr-${COL[k]})` }));
              svg.append(s('text', { x: (x1 + x2) / 2, y: ay - 6, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, style: `fill:var(--${COL[k]})` }, slim ? String(d) : `${LBL[k]} → ${d}`));
              minY = Math.min(minY, ay - 26);
            });
            if (selfs.length) svg.append(s('text', { x: cur < 8 ? bx(cur) : Math.min(bx(cur) + bw / 2, X1 - 4), y: minY, 'text-anchor': cur < 8 ? 'start' : cur > 50 ? 'end' : 'middle', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, `${selfs.join(', ')}: stays ${cur}`));
          }
          function draw() {
            tbody.replaceChildren(...row(cur).map(([k, v]) => h('tr', { class: k === 'ts_globpri' ? 'on' : null },
              h('td', {}, h('code', { html: `<span class="t" data-t="${k}">${k}</span>` })),
              h('td', { class: 'b mono', style: COL[k] ? { color: `var(--${COL[k]})` } : null }, v),
              h('td', { html: MEANING[k] }))));
            chart();
            big.textContent = String(cur);
            qline.innerHTML = `current row · quantum <b>${TS[cur].q} ms</b>`;
            trailEl.replaceChildren(h('span', { class: 'xs b muted' }, 'PATH'), ...trail.slice(-9).flatMap((p, i, a) => [h('span', { class: 'chip ' + (i === a.length - 1 ? 'accent' : '') }, String(p)), i < a.length - 1 ? '→' : null]));
            narr.className = 'msg ' + lastMsg.cls; narr.innerHTML = lastMsg.html;
            slider.set(cur, false);
          }
          function ev(kind) {
            const r = TS[cur], p = cur;
            if (kind === 'q') { cur = r.tqexp; lastMsg = { cls: 'ok', html: `It used its whole ${r.q} ms quantum at ${p}. <b>ts_tqexp</b> sends it to <b>${cur}</b>${cur === p ? ' (already the bottom row)' : ''}, where the quantum is ${TS[cur].q} ms.` }; }
            if (kind === 's') { cur = r.slpret; lastMsg = { cls: 'ok', html: `It blocked before its quantum ran out (say, for disk I/O). Returning from that sleep, <b>ts_slpret</b> moves it from ${p} to <b>${cur}</b>${cur === p ? ' (already the top row)' : ''}; quantum ${TS[cur].q} ms.` }; }
            if (kind === 'w') { cur = r.lwait; lastMsg = { cls: 'ok', html: `It sat ready for more than ts_maxwait (${r.maxwait} s) without using up its quantum. The starvation guard <b>ts_lwait</b> lifts it from ${p} to <b>${cur}</b>${cur === p ? ' (already the top row)' : ''}; quantum ${TS[cur].q} ms.` }; }
            trail.push(cur); draw();
          }
          const slider = ctx.ui.slider({ label: 'Row (priority)', min: 0, max: 59, value: cur, onInput: (v) => { cur = v; trail = [v]; lastMsg = { cls: 'info', html: `A process now sits at row ${v}. Pick an event and predict where it goes.` }; draw(); } });
          slider.setAttribute('data-keys', '');
          const btns = h('div', { class: 'row gap-s' },
            h('button', { type: 'button', class: 'btn', style: { borderColor: 'var(--warn)' }, onclick: () => ev('q') }, '↓ Uses whole quantum'),
            h('button', { type: 'button', class: 'btn', style: { borderColor: 'var(--ok)' }, onclick: () => ev('s') }, '↑ Sleeps, then returns'),
            h('button', { type: 'button', class: 'btn', style: { borderColor: 'var(--accent)' }, onclick: () => ev('w') }, '↑ Waits > ts_maxwait'));
          draw();
          el.append(h('div', { class: 'split l fill', style: { gap: '20px' } },
            h('div', { class: 'stack noshrink', style: { gap: '9px' } },
              h('p', { class: 'm0', style: { fontSize: '16px' }, html: 'The <span class="t">time-sharing class</span> runs on a <span class="t">dispatch table</span>, one row per priority 0–59. There is no formula to compute: on each event the kernel just reads a column of the process’s current row.' }),
              tbl,
              h('div', { class: 'callout tip m0', 'data-label': 'Our example table', html: 'Quanta step from 100 ms (rows 0–9) down to 10 ms (rows 50–59). tqexp = row − 10, slpret = row + 10, lwait = row + 20, each kept within 0–59; maxwait = 1 s. Real systems ship their own values, and an administrator can retune them without rebuilding the kernel.' })),
            h('div', { class: 'stack noshrink', style: { gap: '8px' } },
              h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg),
              slider,
              h('div', { class: 'card tight stack', style: { gap: '6px' } },
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'row gap-s' }, big, qline), btns),
                trailEl, narr))));
        },
      },
      /* ---------------- 6. Simulation: a CPU-bound process sinks, an I/O-bound one rises ---------------- */
      {
        title: 'Watch priorities move: sinking and rising',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const T = 600;
          const COLR = { A: 'cpu', B: 'io', C: 'thread' };
          const cfg = { a: 50, burst: 3, sleep: 25, c: false };
          const W = slim ? 360 : 640, X0 = slim ? 26 : 34, X1 = W - 10, YT = 14, YB = 190, GY = 210, GH = 20, HGT = 262;
          const x = (t) => X0 + (t / T) * (X1 - X0), y = (p) => YB - (p / 59) * (YB - YT);
          const svg = s('svg', { viewBox: `0 0 ${W} ${HGT}`, width: '100%', role: 'img', 'aria-label': 'Priority of each process over 600 ms, with the processor timeline underneath' });
          const legend = h('div', { class: 'stack', style: { gap: '4px' } });
          const narr = h('div', { class: 'msg ok', style: { minHeight: '96px' } });
          const logEl = h('div', { class: 'log', style: { height: '150px' } });
          const priAt = (p, t) => { let v = p.series[0][1]; for (const [tt, q] of p.series) if (tt <= t) v = q; return v; };
          const firstAt = (p, v) => { const e = p.series.find(([, q]) => q === v); return e ? e[0] : null; };

          function draw() {
            const procs = [{ n: 'A', kind: 'cpu', start: cfg.a }, { n: 'B', kind: 'io', start: 20, burst: cfg.burst, sleep: cfg.sleep }];
            if (cfg.c) procs.push({ n: 'C', kind: 'cpu', start: 35 });
            const r = tsRun(procs, T);
            svg.replaceChildren();
            [0, 20, 40, 59].forEach((p) => {
              svg.append(s('line', { x1: X0, y1: y(p), x2: X1, y2: y(p), class: 's-muted', 'stroke-width': 1 }));
              svg.append(s('text', { x: X0 - 6, y: y(p) + 4, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, String(p)));
            });
            const OFF = { A: -2, B: 2, C: 0 };
            r.P.forEach((p) => {
              const yy = (q) => y(q) + OFF[p.n];
              let d = `M${x(0)},${yy(p.series[0][1])}`;
              p.series.forEach(([t, q]) => { d += ` H${x(t)} V${yy(q)}`; });
              d += ` H${x(T)}`;
              svg.append(s('path', { d, fill: 'none', style: `stroke:var(--${COLR[p.n]})`, 'stroke-width': 3, 'stroke-linejoin': 'round' }));
            });
            svg.append(s('text', { x: X0, y: GY - 5, 'font-size': 13, class: 's-sub' }, 'who holds the processor'));
            r.segs.forEach((g) => { if (g.n) svg.append(s('rect', { x: x(g.t0), y: GY, width: Math.max(0.8, x(g.t1) - x(g.t0)), height: GH, style: `fill:var(--${COLR[g.n]});stroke:none` })); });
            svg.append(s('rect', { x: X0, y: GY, width: X1 - X0, height: GH, fill: 'none', style: 'stroke:var(--line-2)', 'stroke-width': 1 }));
            for (let t = 0; t <= T; t += slim ? 200 : 100) svg.append(s('text', { x: x(t), y: HGT - 8, 'text-anchor': t === T ? 'end' : 'middle', 'font-size': 13, class: 's-sub' }, t === T ? T + ' ms' : String(t)));

            legend.replaceChildren(...r.P.map((p) => h('div', { class: 'row gap-s small', style: { flexWrap: 'nowrap' } },
              h('span', { class: 'pchip', style: { borderColor: `var(--${COLR[p.n]})` } }, p.n),
              h('span', {}, `${p.kind === 'cpu' ? 'CPU-bound' : 'I/O-bound'} · ran ${p.cpu} ms (${+((100 * p.cpu) / T).toFixed(1)}%) · ${p.series[0][1]} → ${p.pri}`))));

            const A = r.P[0], B = r.P[1];
            const qs = A.quanta.filter((q, i) => i === 0 || q !== A.quanta[i - 1]);
            const tA0 = firstAt(A, 0);
            let txt = cfg.a === 0 ? 'A starts on the bottom row and stays there, running 100 ms quanta whenever B sleeps. '
              : tA0 != null ? `<b>A sinks</b> from ${cfg.a} to 0 by t = ${tA0} ms: each whole quantum sends it to its row’s lower ts_tqexp. ` + (qs.length > 1 ? `Its quanta grow as it falls: ${qs.join(' → ')} ms. ` : '')
                : `<b>A sinks</b> from ${cfg.a} to ${A.pri}, its quanta growing as it falls. `;
            const bFirst = r.segs.find((g) => g.n === 'B');
            if (bFirst && bFirst.t0 > 0) txt += `B starts at 20 and first runs at t = ${bFirst.t0} ms, once nothing above it is ready. `;
            const late = [priAt(B, T / 2), ...B.series.filter(([t]) => t > T / 2).map(([, q]) => q)];
            const bMax = Math.max(...B.series.map(([, q]) => q));
            if (!B.quanta.length) txt += `<b>B rises</b>: each ${cfg.burst} ms burst ends before its quantum, so every return from I/O lifts it (ts_slpret) until it reaches ${bMax} at t = ${firstAt(B, bMax)} ms.`;
            else txt += `B’s ${cfg.burst} ms bursts are longer than some quanta it meets, so a whole quantum drops it and each return from I/O lifts it. In the second half it moves between ${Math.min(...late)} and ${Math.max(...late)}.`;
            if (cfg.c) txt += ` C, also CPU-bound, sinks too (35 → ${r.P[2].pri}).`;
            narr.innerHTML = txt;
            logEl.replaceChildren(...r.log.map(([t, m]) => h('div', {}, `${String(t).padStart(3, ' ')} ms  ${m}`)));
          }
          const sA = ctx.ui.slider({ label: 'A starts at', min: 0, max: 59, value: cfg.a, onInput: (v) => { cfg.a = v; draw(); } });
          const sB = ctx.ui.slider({ label: 'B’s burst', min: 1, max: 30, value: cfg.burst, format: (v) => v + ' ms', onInput: (v) => { cfg.burst = v; draw(); } });
          const sW = ctx.ui.slider({ label: 'B’s I/O wait', min: 5, max: 60, value: cfg.sleep, format: (v) => v + ' ms', onInput: (v) => { cfg.sleep = v; draw(); } });
          [sA, sB, sW].forEach((sl) => sl.setAttribute('data-keys', ''));
          const segC = ctx.ui.seg([{ value: false, label: 'A and B' }, { value: true, label: 'add C (CPU-bound, starts at 35)' }], false, (v) => { cfg.c = v; draw(); });
          draw();
          el.append(h('div', { class: 'split l fill', style: { gap: '20px' } },
            h('div', { class: 'stack noshrink', style: { gap: '9px' } },
              h('p', { class: 'm0', style: { fontSize: '16px' }, html: 'Two <span class="t">time-sharing class</span> processes share one processor under the example table from Step 5. A is <span class="t" data-t="processor-bound process">processor-bound</span>: it never blocks. B is <span class="t" data-t="I/O-bound process">I/O-bound</span>: short bursts of computing, then a wait for I/O.' }),
              h('div', { class: 'card tight stack', style: { gap: '6px' } }, sA, sB, sW, segC),
              legend,
              narr),
            h('div', { class: 'stack noshrink', style: { gap: '8px' } },
              h('div', { class: 'card white', style: { padding: '6px 10px' } },
                h('div', { class: 'row gap-s xs b', style: { marginBottom: '2px' } }, h('span', { class: 'muted' }, 'PRIORITY OVER TIME'), h('span', { style: { color: 'var(--cpu)' } }, '■ A'), h('span', { style: { color: 'var(--io)' } }, '■ B'), h('span', { style: { color: 'var(--thread)' } }, '■ C (if added)')),
                svg),
              h('div', { class: 'stack', style: { gap: '3px' } }, h('span', { class: 'xs b muted' }, 'EVENT LOG (every change the table caused)'), logEl),
              h('p', { class: 'xs muted m0' }, 'Shortcuts: this run lasts under one second, so ts_maxwait never fires. And a process that slept inside the kernel would first finish its kernel work at a kernel-band priority, then drop to its ts_slpret row.'))));
        },
      },
      /* ---------------- 7. Recap ---------------- */
      {
        title: 'Recap: six ideas to carry with you',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['In what order does SVR4 serve its three classes?', 'Real-time (global priorities 100–159) first, then kernel work (60–99), then time-sharing (0–59). A higher global priority always wins.'],
              ['Which way do SVR4’s priority numbers run?', 'Bigger means more urgent: 159 is the top, 0 the bottom. Traditional UNIX ran the other way, with a smaller number meaning more urgent.'],
              ['What is a preemption point, and why have them?', 'A safe spot in a long kernel path where every structure is consistent or locked. A waiting real-time process can take over there, so its wait is bounded by the longest gap between points.'],
              ['How does the dispatcher pick the next process?', 'One dispatch queue per priority, round robin inside each. The bit map dqactmap has a 1 for every non-empty queue; the head of the queue with the highest 1 bit runs.'],
              ['Which classes have fixed priorities?', 'Real-time: fixed priority and fixed quantum. Kernel: fixed priority. Time-sharing: variable priority, with a quantum set by the row (100 ms at 0 down to 10 ms at 59 in standard SVR4).'],
              ['What does each row of ts_dptbl tell the kernel?', 'Its quantum; ts_tqexp, the lower row after a whole quantum; ts_slpret, the higher row after a sleep; and ts_maxwait with ts_lwait, a guard that lifts a process that waited too long.'],
            ], { cols: ctx.narrow ? 1 : 3, height: 214 })));
        },
      },
      /* ---------------- 8. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'In UNIX SVR4, which of these global priorities belongs to the kernel class?', choices: ['45', '130', '75', '160'], answer: 2,
            feedback: ['45 lies in 0–59, the time-sharing class.', '130 lies in 100–159, the real-time class.', null, 'The scale has 160 levels numbered 0 to 159, so 160 is not a valid global priority.'],
            why: 'SVR4’s kernel class covers global priorities 60 to 99, so 75 is a kernel-class priority. Real-time is 100–159 and time-sharing is 0–59.' },
          { type: 'tf', q: 'In UNIX SVR4, a process at global priority 90 is more urgent than a process at global priority 20.', answer: true,
            why: 'In SVR4 a larger global priority is more urgent. 90 is in the kernel class and beats every time-sharing priority, including 20. (Traditional UNIX used the opposite direction, where a smaller number was more urgent.)' },
          { q: 'What makes a place in SVR4 kernel code suitable to be a preemption point?', choices: ['The kernel switches back to user mode there after a call.', 'Every kernel structure there is consistent or locked.', 'A clock interrupt is certain to arrive there every 10 ms.', 'Only code that belongs to real-time processes runs there.'], answer: 1,
            feedback: ['Returning to user mode is where even a nonpreemptible kernel switches; preemption points sit inside long kernel paths.', null, 'Preemption points are chosen by where the data is safe, not by clock timing.', 'The kernel path belongs to whichever process made the system call, usually an ordinary one.'],
            why: 'A preemption point is a spot where no kernel data structure is half updated (each is consistent or protected by a lock), so the kernel can safely switch to a waiting real-time process there.' },
          { type: 'num', q: 'A system call’s kernel path has preemption points at 2.5 ms, 5.5 ms and 9.5 ms and returns to user mode at 12 ms. A real-time process becomes ready 6 ms into the call. How many milliseconds does it wait before it can run?', answer: 3.5, tol: 0.01, unit: 'ms',
            why: 'The next preemption point after 6 ms is at 9.5 ms, so it waits 9.5 − 6 = 3.5 ms. A nonpreemptible kernel would make it wait until 12 ms, which is 6 ms.' },
          { q: 'In SVR4’s dqactmap bit map, what does a bit set to 1 mean?', choices: ['The process at that priority is running on the processor.', 'That priority level belongs to the real-time class.', 'A process at that priority has used up its whole quantum.', 'That level’s dispatch queue holds at least one ready process.'], answer: 3,
            feedback: ['The running process is not in any dispatch queue; the bits describe waiting, ready processes.', 'Every level, in every class, has its own bit; the bit says nothing about the class.', 'Using up a quantum changes a time-sharing priority; it is not what the bit records.', null],
            why: 'dqactmap has one bit per priority level, set exactly when that level’s dispatch queue is not empty. The dispatcher runs the head of the queue with the highest set bit.' },
          { type: 'order', q: 'A time-sharing process uses up its quantum in SVR4. Put what happens next in order.', items: ['The running process uses up its whole quantum', 'Its row’s ts_tqexp column gives its new, lower priority', 'It joins the tail of that priority’s dispatch queue, and that bit is set', 'The dispatcher finds the highest set bit in dqactmap', 'The process at the head of that queue starts running'],
            why: 'The table decides the new priority first, the process is queued at that level (setting its bit), and only then does the dispatcher look for the highest set bit and run the head of that queue.' },
          { type: 'match', q: 'Match each column of the SVR4 time-sharing dispatch table (ts_dptbl) to its meaning.', pairs: [['ts_quantum', 'Length of a turn at this priority'], ['ts_tqexp', 'New priority after using a whole quantum'], ['ts_slpret', 'New priority on return from a sleep'], ['ts_maxwait', 'Seconds a ready process may wait before the guard acts'], ['ts_lwait', 'New priority for a process that waited too long']],
            why: 'Each row gives a quantum and three “next row” answers: one for a used-up quantum (lower), one for a sleep return (higher) and one, with ts_maxwait, that rescues a process at risk of starving.' },
          { type: 'num', q: 'In an example SVR4 dispatch table, row 23 has ts_quantum = 60 ms, ts_tqexp = 13, ts_slpret = 33 and ts_lwait = 43. A process at priority 23 blocks for disk I/O before its quantum ends, and later returns from that sleep. What is its new priority?', answer: 33, tol: 0,
            why: 'Returning from a sleep uses the ts_slpret column, which is 33 in row 23. ts_tqexp (13) applies only after a whole quantum, and ts_lwait (43) only after waiting longer than ts_maxwait.' },
          { type: 'bucket', q: 'In SVR4, does each process below have a fixed priority, or one that changes with its behavior?', buckets: ['Fixed priority', 'Changes with behavior'],
            items: [['A real-time audio mixer at priority 120', 0], ['The kernel’s page-out daemon', 0], ['A compiler in the time-sharing class', 1], ['A text editor at time-sharing priority 40', 1], ['A process placed in the real-time class with priocntl', 0]],
            why: 'Real-time and kernel-class priorities are fixed. Only time-sharing priorities move: down after a whole quantum, up after a sleep or a long wait.' },
          { type: 'multi', q: 'Which statements about SVR4 time-sharing quanta are true?', choices: ['In the standard table, priority 0 gets a longer quantum than priority 59.', 'Every row of the table gives the same quantum.', 'A processor-bound process tends to sink, and its quanta grow as it does.', 'An I/O-bound process tends to rise toward the rows with the shortest quanta.', 'Real-time processes take their quanta from the time-sharing table.'], answer: [0, 2, 3],
            why: 'The standard table runs from 100 ms at priority 0 to 10 ms at 59. Using whole quanta pushes a busy process down to longer quanta; sleeping lifts an I/O-bound process to short quanta it rarely uses up. Real-time quanta are set separately and stay fixed.' },
          { q: 'Why does SVR4 rank kernel-mode work above ordinary time-sharing processes?', choices: ['Such work often holds kernel buffers or locks that others need.', 'Kernel code is always shorter than user code, so it goes first.', 'The hardware blocks all interrupts until kernel work is finished.', 'Kernel-band processes carry deadlines, just as real-time ones do.'], answer: 0,
            feedback: [null, 'Kernel paths vary in length; the reason is the shared resources they hold, not their length.', 'Interrupts are not blocked for the whole time kernel-band work waits or runs.', 'Deadlines belong to the real-time class; kernel-band work is ranked for a different reason.'],
            why: 'A process working inside the kernel may hold buffers, locks or other shared kernel resources. Letting it finish quickly releases them for everyone else.' },
          { type: 'tf', q: 'The SVR4 kernel can be preempted at any instruction, which is how it bounds the wait of a real-time process.', answer: false,
            why: 'SVR4 preempts the kernel only at preemption points, so the wait is bounded by the longest stretch between points. Kernels that can be preempted almost anywhere came later (for example Solaris 2, and Linux 2.6 as a build option).' },
        ],
      },
    ],
    notes: `
      <h3>UNIX SVR4 scheduling</h3>
      <p>UNIX System V Release 4 (SVR4, late 1980s) replaced the traditional UNIX scheduler of Section 9.3, which ranked processes by fixed bands plus one usage formula recomputed once a second, had no real-time class, and ran a kernel that could not be preempted. The redesign has three goals, in strict order of preference:</p>
      <ol>
        <li><b>Real-time processes</b> get the highest preference: for them, being late is as bad as being wrong.</li>
        <li><b>Kernel-mode work</b> comes next, so processes holding kernel resources finish quickly and release them.</li>
        <li><b>Ordinary user-mode (time-sharing) processes</b> come last and share the remaining processor time.</li>
      </ol>
      <p>Four mechanisms deliver this: one scale of global priorities split into classes, preemption points in the kernel, per-level dispatch queues found through a bit map, and a tunable table that moves time-sharing priorities.</p>

      <h4>160 global priorities in three classes</h4>
      <p>Every process has a <b>global priority</b> from 0 to 159. <b>A larger number is more urgent</b> (159 is the top), the opposite of traditional UNIX, where a smaller number was more urgent.</p>
      <svg viewBox="0 0 420 96" width="420" role="img" aria-label="Three priority classes">
        <rect x="4" y="4" width="412" height="26" rx="5" fill="#fde2e2" stroke="#dc2626"/><text x="12" y="22" font-size="13" fill="#111">Real-time class: 159 … 100 (60 levels)</text>
        <rect x="4" y="35" width="412" height="26" rx="5" fill="#ede4fb" stroke="#7c3aed"/><text x="12" y="53" font-size="13" fill="#111">Kernel class: 99 … 60 (40 levels)</text>
        <rect x="4" y="66" width="412" height="26" rx="5" fill="#d9f2f2" stroke="#0d9488"/><text x="12" y="84" font-size="13" fill="#111">Time-sharing class: 59 … 0 (60 levels)</text>
      </svg>
      <table>
        <tr><th>Class</th><th>Global priorities</th><th>Who runs there</th><th>Priority</th><th>Quantum</th></tr>
        <tr><td>Real-time</td><td>100–159</td><td>Processes that must react within a known time (machine control, audio, video). Only a privileged user can place a process here, using the <code>priocntl</code> system call.</td><td>Fixed; never changed by the scheduler</td><td>Fixed per priority level or per process</td></tr>
        <tr><td>Kernel</td><td>60–99</td><td>The kernel’s own system processes (for example the page-out daemon) and processes that have just woken from a sleep inside the kernel, while they finish their kernel work.</td><td>Fixed; chosen by what the process waited for</td><td>None (not time-sliced): runs until it sleeps again or returns to user mode; only a real-time process can preempt it, at a preemption point</td></tr>
        <tr><td>Time-sharing</td><td>0–59</td><td>Ordinary user processes: shells, editors, compilers. The default class for user work.</td><td>Variable: down after a whole quantum, up after a sleep or a long wait</td><td>Set by the priority: 100 ms at 0 down to 10 ms at 59 in the standard SVR4 table</td></tr>
      </table>
      <p>A real-time process outranks even kernel work, so a buggy real-time process stuck in a loop can freeze everything below it. Kernel-mode work sits above user work because a process inside the kernel often holds buffers or locks that others need. Strictly, the kernel class proper holds the system processes; a user process that wakes inside the kernel stays in its own class and only borrows a kernel-band priority until it returns to user mode, when ts_slpret sets its new time-sharing priority.</p>

      <h4>Preemption points</h4>
      <p>Traditional UNIX had a <b>nonpreemptible kernel</b>: a process inside a system call kept the processor until it slept or returned to user mode, so a newly ready process could wait as long as the longest system call. The kernel cannot simply be stopped anywhere, because midway through a call a shared structure may be half updated.</p>
      <p>A <b>preemption point</b> is a place in a long kernel path where every kernel data structure is either consistent or locked. At each one the kernel checks a flag that says a real-time process is ready, and if it is set, switches right there. The worst <b>dispatch latency</b> (delay from becoming ready to running) is then the longest stretch between two points, not the longest system call.</p>
      <p><b>Worked example.</b> A 12 ms write system call has preemption points at 2.5, 5.5 and 9.5 ms. A real-time process R becomes ready at 6 ms. With preemption points R runs at 9.5 ms and waits 3.5 ms; with a nonpreemptible kernel it runs at 12 ms and waits 6 ms. Worst cases: 4 ms (the longest stretch, 5.5–9.5) versus 12 ms. If R becomes ready during the last stretch (after 9.5 ms), both kernels switch at 12 ms. Later kernels went further and can be preempted almost anywhere (Solaris 2, and Linux 2.6 as a build option) by locking each shared structure separately.</p>

      <h4>Dispatch queues and the dqactmap bit map</h4>
      <ul>
        <li>There is one <b>dispatch queue</b> (ready queue) per global priority: 160 queues. Processes in the same queue take turns round robin.</li>
        <li><b>dqactmap</b> is a bit map with one bit per priority level; a bit is 1 exactly when that level’s queue holds at least one ready process. The running process is in no queue.</li>
        <li>The dispatcher finds the highest set bit and runs the process at the head of that queue. 160 bits fit in five 32-bit words, so this is cheap and does not grow with the number of ready processes.</li>
        <li>A process whose quantum expires goes to the tail of its queue; a process that blocks leaves every queue. A process that becomes ready joins the tail of its level and sets that bit; if its priority is higher than the running process’s, the running process is preempted (and goes back to the front of its own queue). When that happens depends on where the running process is: in user mode, the newcomer takes over at once; inside the kernel, a real-time newcomer takes over at the next preemption point, and any other newcomer waits until the running process sleeps or returns to user mode.</li>
      </ul>

      <h4>The time-sharing dispatch table (ts_dptbl)</h4>
      <p>Time-sharing priorities are driven by a tunable table with one row per priority 0–59. On each event the kernel reads a column of the process’s current row:</p>
      <table>
        <tr><th>Column</th><th>Meaning</th></tr>
        <tr><td>ts_globpri</td><td>The global priority this row describes.</td></tr>
        <tr><td>ts_quantum</td><td>The quantum for a process at this priority.</td></tr>
        <tr><td>ts_tqexp</td><td>New, lower priority after the process uses its whole quantum (“time quantum expired”).</td></tr>
        <tr><td>ts_slpret</td><td>New, higher priority when it returns to user mode after a sleep (“sleep return”).</td></tr>
        <tr><td>ts_maxwait</td><td>Seconds a ready process may go without using up its quantum before the guard acts.</td></tr>
        <tr><td>ts_lwait</td><td>New, higher priority for a process that waited longer than ts_maxwait: a starvation guard.</td></tr>
      </table>
      <p><b>Example table used in this section</b> (illustrative; real systems ship their own values, which an administrator can retune): quantum 100 ms for rows 0–9, 80 ms for 10–19, 60 ms for 20–29, 40 ms for 30–39, 20 ms for 40–49 and 10 ms for 50–59; tqexp = row − 10, slpret = row + 10, lwait = row + 20, each kept within 0–59; maxwait = 1 s.</p>
      <p><b>Worked example.</b> A process at row 35 has a 40 ms quantum. If it uses all 40 ms it moves to row 25 (quantum 60 ms). If instead it blocks for I/O and returns from the sleep, it moves to row 45 (quantum 20 ms). If it sits ready for more than 1 s without using up its quantum, it moves to row 55 (quantum 10 ms).</p>

      <h4>What the table does over time</h4>
      <p>A processor-bound process keeps using whole quanta, so it sinks, and its quanta grow as it falls. An I/O-bound process blocks before its quantum ends, so each sleep return lifts it toward the top rows, where quanta are short but it rarely needs a long one. In the simulation (A processor-bound from row 50; B I/O-bound from row 20 with 3 ms bursts and 25 ms I/O waits), A sinks from 50 to 0 by t = 228 ms with quanta of 10, 20, 40, 60, 80 and 100 ms; B first runs at 70 ms, once A has sunk to its row, then climbs to 59 by t = 182 ms. A burst longer than a row’s quantum (for example 16 ms against a 10 ms quantum) makes the process alternate: down after a whole quantum, up after each sleep. Two simplifications: the run is shorter than one second, so ts_maxwait never fires, and a process that slept inside the kernel would first finish its kernel work at a kernel-band priority before dropping to its ts_slpret row.</p>

      <h4>History</h4>
      <p>The SVR4 design lives on in Solaris and illumos, which kept the 0–159 layout and added further classes (such as interactive, fair-share and fixed-priority) and a band above 159 for interrupt threads.</p>
    `,
  });
})();
