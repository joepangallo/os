/* =====================================================================
   Section 1.4  Interrupts
   Why devices interrupt the processor, the four classes of interrupts,
   flow of control and timing with/without interrupts, the interrupt
   stage of the instruction cycle, the nine steps of interrupt
   processing, and how multiple interrupts are handled.
   ===================================================================== */
(function () {
  /* ------------------------------------------------------------------
     Shared helpers (kept inside this IIFE so nothing leaks globally)
     ------------------------------------------------------------------ */
  /* Multiple-interrupt model used by steps 7 and 8.
     Three devices, each handler needs `svc` time units. Two policies:
       'seq'    interrupts disabled while any handler runs; waiting requests served oldest-first
       'nested' priorities; a higher-priority request suspends a lower-priority handler */
  const MI = {
    NAME: { U: 'user program', P: 'printer', D: 'disk', C: 'comm line' },
    PR: { U: 0, P: 2, D: 4, C: 5 },
    LANES: [['C', 'Comm line · 5'], ['D', 'Disk · 4'], ['P', 'Printer · 2'], ['U', 'User program']],
    DEADLINE: 3,   // the comm line must be served within 3 units or incoming data is overwritten
  };
  const cap1 = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  function simMulti(arr, mode, svc) {
    svc = svc || 10;
    const { PR, NAME } = MI, devs = ['P', 'D', 'C'];
    const left = { P: svc, D: svc, C: svc }, info = {};
    devs.forEach((d) => (info[d] = { arrive: arr[d], start: null, finish: null }));
    const segs = [], susp = [], moments = [], stack = [], pending = [], suspAt = {};
    const tag = (d) => `<b>${NAME[d]}</b> (priority ${PR[d]})`, tagC = (d) => `<b>${cap1(NAME[d])}</b> (priority ${PR[d]})`;
    let run = 'U', finished = null, end = 0;
    for (let t = 0; t < 400; t++) {
      const lines = [];
      const arriving = devs.filter((d) => arr[d] === t).sort((a, b) => PR[b] - PR[a]);
      arriving.forEach((d) => pending.push(d));
      const started = [];
      if (mode === 'nested') {
        while (pending.length) {
          const best = pending.reduce((a, b) => (PR[b] > PR[a] ? b : a));
          if (PR[best] <= PR[run]) break;
          pending.splice(pending.indexOf(best), 1);
          stack.push(run); if (run !== 'U' && suspAt[run] === undefined) suspAt[run] = t;
          started.push([best, run]); run = best;
          if (info[best].start === null) info[best].start = t;
        }
      } else if (run === 'U' && pending.length) {
        pending.sort((a, b) => arr[a] - arr[b] || PR[b] - PR[a]);
        const nx = pending.shift(); stack.push('U'); started.push([nx, 'U']); run = nx; info[nx].start = t;
      }
      if (run !== 'U' && suspAt[run] !== undefined && !started.some((x) => x[0] === run)) { susp.push({ who: run, s: suspAt[run], e: t }); delete suspAt[run]; }
      /* narration for this moment */
      if (finished) lines.push(`The ${NAME[finished]} handler finishes.`);
      started.filter(([d]) => !arriving.includes(d)).forEach(([d, over]) => {
        if (mode === 'nested') lines.push(over === 'U' ? `The waiting ${tag(d)} request is the most urgent one left, so its handler runs next. It waited ${t - arr[d]} units.` : `The waiting ${tag(d)} request outranks the suspended ${NAME[over]} handler (${PR[over]}), so its handler runs first. It waited ${t - arr[d]} units.`);
        else {
          const urgent = pending.filter((x) => PR[x] > PR[d]), tie = pending.some((x) => arr[x] === arr[d]);
          lines.push(`Interrupts are enabled again. The oldest waiting request, ${tag(d)}, which arrived at t = ${arr[d]}, is served next` + (tie ? ' (requests that arrived together are taken most urgent first)' : '') + (urgent.length ? `, even though the ${NAME[urgent[0]]} request is more urgent.` : '.'));
        }
      });
      if (finished && !started.length) lines.push(run === 'U' ? 'Nothing is waiting, so the <b>user program</b> resumes.' : `Control returns to the suspended <b>${NAME[run]}</b> handler, which continues where it stopped.`);
      arriving.forEach((d) => {
        const st = started.find((x) => x[0] === d);
        if (st && st[1] === 'U') lines.push(`${tagC(d)} interrupts the user program. Its handler starts` + (mode === 'seq' ? ', and interrupts are now disabled.' : '.'));
        else if (st) lines.push(`${tagC(d)} interrupts. ${PR[d]} > ${PR[st[1]]}, so the ${NAME[st[1]]} handler is suspended (its state goes on the stack) and the ${NAME[d]} handler starts.`);
        else if (mode === 'nested') lines.push(`${tagC(d)} interrupts, but the running ${NAME[run]} handler outranks it (${PR[run]} > ${PR[d]}), so the request is left pending.`);
        else lines.push(`${tagC(d)} interrupts, but interrupts are disabled while the ${NAME[run]} handler runs, so the request waits` + (PR[d] > PR[run] ? ', even though it is more urgent.' : '.'));
      });
      if (lines.length) moments.push({ t, html: lines.join(' ') });
      /* run one time unit */
      const ls = segs[segs.length - 1];
      if (ls && ls.who === run && ls.e === t) ls.e = t + 1; else segs.push({ who: run, s: t, e: t + 1 });
      finished = null;
      if (run !== 'U') {
        left[run]--;
        if (!left[run]) { info[run].finish = t + 1; finished = run; run = stack.pop(); if (mode === 'seq') { run = 'U'; stack.length = 0; } }
      }
      if (!finished && run === 'U' && !pending.length && devs.every((d) => info[d].finish !== null)) { end = t; break; }
    }
    const pend = devs.filter((d) => info[d].start > info[d].arrive).map((d) => ({ who: d, s: info[d].arrive, e: info[d].start }));
    return { segs, pend, susp, info, moments, end };
  }
  /* On phones, a dense diagram is shown at a readable size inside a sideways-swipe box instead of shrinking to tiny text. */
  function panWrap(ctx, svg, minW) {
    if (!ctx.narrow) return svg;
    svg.style.minWidth = minW + 'px';
    return ctx.h('div', {}, ctx.h('div', { style: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' } }, svg),
      ctx.h('div', { class: 'xs muted center' }, '← swipe sideways to see the whole diagram →'));
  }
  /* Draw a Gantt chart of a simMulti result. o: { x0, x1, y0, laneH, tmax, T (cursor time or null), veil, short, tick } */
  function ganttNodes(s, sim, o) {
    const { x0, x1, y0, laneH, tmax } = o, K = (x1 - x0) / tmax, X = (t) => x0 + Math.min(t, tmax) * K;
    const laneY = (w) => y0 + MI.LANES.findIndex((l) => l[0] === w) * (laneH + 8);
    const out = [s('defs', {}, s('pattern', { id: 's14-hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      s('rect', { width: 8, height: 8, style: 'fill:var(--warn-bg)' }), s('line', { x1: 0, y1: 0, x2: 0, y2: 8, class: 's14-hatch-line' })))];
    const SHORT = { C: 'Comm 5', D: 'Disk 4', P: 'Printer 2', U: 'User' };
    MI.LANES.forEach(([w, label]) => out.push(s('text', { x: x0 - 8, y: laneY(w) + laneH / 2 + 5, class: 't13 end bold' }, o.short ? SHORT[w] : label),
      s('line', { x1: x0, y1: laneY(w) + laneH, x2: x1, y2: laneY(w) + laneH, class: 'axis' })));
    const vis = (p) => ((o.T == null ? p.e : Math.min(p.e, o.T)) - p.s) * K;   // label only the part not hidden by the veil
    sim.pend.forEach((p) => { const w = (p.e - p.s) * K, v = vis(p); out.push(s('rect', { x: X(p.s), y: laneY(p.who) + 6, width: w, height: laneH - 12, rx: 3, class: 'idle', 'stroke-width': 1.5 }));
      if (v >= 58) out.push(s('text', { x: X(p.s) + v / 2, y: laneY(p.who) + laneH / 2 + 5, class: 't13 mid bold', style: 'fill:var(--warn)' }, 'pending')); });
    sim.susp.forEach((p) => { const w = (p.e - p.s) * K, v = vis(p); out.push(s('rect', { x: X(p.s), y: laneY(p.who) + 6, width: w, height: laneH - 12, rx: 3, class: 's-panel', 'stroke-dasharray': '5 4', 'stroke-width': 1.5 }));
      if (v >= 70) out.push(s('text', { x: X(p.s) + v / 2, y: laneY(p.who) + laneH / 2 + 5, class: 't13 mid s-sub' }, 'suspended')); });
    sim.segs.forEach((g, i) => {
      const e = g.who === 'U' && i === sim.segs.length - 1 ? tmax : g.e;
      out.push(s('rect', { x: X(g.s), y: laneY(g.who) + 2, width: (Math.min(e, tmax) - g.s) * K, height: laneH - 4, rx: 4, class: 'blk ' + (g.who === 'U' ? 's-proc' : 's-intr') }));
    });
    const marker = (d) => { const x = X(sim.info[d].arrive), y = laneY(d); return s('path', { d: `M${x - 6},${y - 7} L${x + 6},${y - 7} L${x},${y + 1} Z`, style: 'fill:var(--intr)' }); };
    const seen = (d) => o.T == null || sim.info[d].arrive <= o.T;   // requests that have already arrived are drawn above the veil
    ['P', 'D', 'C'].filter((d) => !seen(d)).forEach((d) => out.push(marker(d)));
    const ay = y0 + 4 * (laneH + 8) + 2;
    out.push(s('line', { x1: x0, y1: ay, x2: x1, y2: ay, class: 'axis' }));
    for (let t = 0; t <= tmax; t += o.tick || 5) out.push(s('line', { x1: X(t), y1: ay, x2: X(t), y2: ay + 5, class: 'axis' }), s('text', { x: X(t), y: ay + 20, class: 't13 mid s-sub' }, String(t)));
    if (o.T != null && o.T < tmax) out.push(s('rect', { x: X(o.T), y: y0 - 12, width: x1 - X(o.T) + 4, height: ay - y0 + 12, style: `fill:var(--panel);opacity:${o.veil || 0.8}` }),
      s('line', { x1: X(o.T), y1: y0 - 12, x2: X(o.T), y2: ay + 4, class: 'cursor' }), s('text', { x: X(o.T), y: y0 - 16, class: 't13 mid bold', style: 'fill:var(--accent)' }, 't = ' + o.T));
    ['P', 'D', 'C'].filter(seen).forEach((d) => out.push(marker(d)));
    return out;
  }

  Guide.section({
    id: '1.4',
    title: 'Interrupts',
    short: 'Interrupts',
    summary: 'How devices get the processor’s attention, and how it pauses, serves them and resumes.',
    objectives: [
      'Explain why interrupts raise processor utilization when I/O devices are far slower than the processor.',
      'Classify events into the four classes of interrupts: program, timer, I/O and hardware failure.',
      'Trace the flow of control and the timing of a program with and without interrupts, for short and long I/O waits.',
      'List, in order, the hardware and software steps of interrupt processing and show how the PC, PSW and control stack change.',
      'Compare disabling interrupts with priority-based nesting, and trace a timeline with several interrupts.',
    ],
    terms: [
      ['Interrupt', 'A signal that makes the processor set aside the program it is running, run a special routine to deal with some event, and then carry on exactly where it left off.'],
      ['Interrupt handler', 'The routine (normally part of the operating system) that runs when an interrupt is accepted. It finds out what the device or event needs and deals with it. Also called an interrupt service routine (ISR).'],
      ['Processor utilization', 'The fraction of time the processor spends doing useful work instead of sitting idle.'],
      ['Program interrupt', 'An interrupt caused by the instruction just executed: for example arithmetic overflow, division by zero, an illegal instruction, or an attempt to use memory outside the program’s allowed space.'],
      ['Timer interrupt', 'An interrupt produced by a clock in the processor at regular intervals. It lets the operating system take back control and do jobs on a schedule.'],
      ['I/O interrupt', 'An interrupt produced by an I/O module to report that an operation finished, that the device needs service, or that an error occurred.'],
      ['Hardware failure interrupt', 'An interrupt triggered by a physical fault, such as the power supply failing or memory detecting a parity error.'],
      ['I/O command', 'An instruction the processor sends to an I/O module telling it to start an operation, such as printing a line. The device then works on its own.'],
      ['Instruction cycle', 'The repeating routine the processor follows for every instruction: fetch it from memory, execute it, and (with interrupts) check whether an interrupt is waiting.'],
      ['Interrupt stage', 'The stage added to the instruction cycle after execute. The processor checks for a pending interrupt and, if one is waiting and interrupts are enabled, switches to its handler.'],
      ['Pending interrupt', 'An interrupt request a device has raised that the processor has not accepted yet, for example because interrupts are disabled or a higher-priority handler is running.'],
      ['Program counter (PC)', 'The processor register that holds the address of the next instruction to fetch.'],
      ['Kernel mode', 'The privileged processor mode in which the operating system (including every interrupt handler) runs: all instructions are allowed, such as those that enable or disable interrupts. Ordinary programs run in the restricted user mode.'],
      ['Program status word (PSW)', 'A processor register that holds status about the running program: condition codes (for example, whether the last result was zero or overflowed), whether interrupts are enabled, and whether the processor is in user or kernel mode.'],
      ['Context (processor state)', 'Everything the processor needs to continue a program exactly where it stopped: the program counter, the PSW and the contents of the other registers.'],
      ['Control stack', 'An area of memory used last-in, first-out, where the processor and the operating system save return addresses and register contents.'],
      ['Stack pointer (SP)', 'The register holding the address of the top of the control stack. It moves every time something is pushed onto or popped off the stack.'],
      ['Disabled interrupts', 'A processor setting in which new interrupt requests are ignored for the moment. They stay pending and are served once interrupts are enabled again.'],
      ['Interrupt priority', 'A ranking given to each source of interrupts so that, when several compete, the more urgent one is served first and may even interrupt a less urgent handler.'],
      ['Nested interrupts', 'Handling in which a higher-priority interrupt may interrupt a handler that is already running; the interrupted handler resumes when the higher one finishes.'],
    ],

    css: `
      .sec-1-4 .ev-card { font-size: 19px; font-weight: 650; line-height: 1.4; min-height: 84px; display: flex; align-items: center; }
      .sec-1-4 .cls-btns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .sec-1-4 .cls-btns .btn { height: 42px; font-size: 15.5px; }
      .sec-1-4 .cls-btns .btn.right { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
      .sec-1-4 .cls-btns .btn.wrong { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
      .sec-1-4 .cls-card { padding: 9px 12px; }
      .sec-1-4 .cls-card h3 { font-size: 17px; margin: 0 0 2px; }
      .sec-1-4 .cls-card p { font-size: 14.5px; margin: 0; line-height: 1.4; }
      .sec-1-4 .cls-card.hot { box-shadow: 0 0 0 3px var(--hl); }
      .sec-1-4 .isteps { list-style: none; padding: 0 !important; margin: 0; display: flex; flex-direction: column; gap: 4px; }
      .sec-1-4 .isteps > li { margin: 0 !important; }
      .sec-1-4 .isteps li { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 8px; align-items: start; padding: 2px 8px; border-radius: 9px; font-size: 14.5px; line-height: 1.35; color: var(--ink-2); border: 1px solid transparent; margin: 0; }
      .sec-1-4 .isteps li .n { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; font-weight: 800; font-size: 13px; background: var(--panel-3); color: var(--ink-2); }
      .sec-1-4 .isteps li.hw .n { background: var(--cpu-bg); color: var(--cpu); }
      .sec-1-4 .isteps li.sw .n { background: var(--os-bg); color: var(--os); }
      .sec-1-4 .isteps li.done { color: var(--muted); }
      .sec-1-4 .isteps li.on { background: var(--accent-bg); border-color: var(--accent); color: var(--ink); font-weight: 650; }
      .sec-1-4 .grp { font-size: 12.5px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; margin: 4px 0 2px; }
      .sec-1-4 .kv { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 3px 10px; font-size: 14.5px; align-items: baseline; }
      .sec-1-4 .kv b { font-family: var(--mono); }
      .sec-1-4 .pq-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .sec-1-4 .pq-choices .btn { height: auto; min-height: 40px; padding: 6px 10px; white-space: normal; text-align: left; justify-content: flex-start; }
      .sec-1-4 .pq-choices .btn.right { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
      .sec-1-4 .pq-choices .btn.wrong { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
      .sec-1-4 .fb { font-size: 15px; line-height: 1.45; }
      .sec-1-4 .stat { display: flex; flex-direction: column; gap: 0; }
      .sec-1-4 .stat .v { font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.15; }
      .sec-1-4 .stat .l { font-size: 12.5px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
      .sec-1-4 .lamp { display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: var(--panel-3); border: 2px solid var(--line-2); vertical-align: -1px; }
      .sec-1-4 .lamp.on { background: var(--intr); border-color: var(--intr); box-shadow: 0 0 0 3px var(--intr-bg); }
      .sec-1-4 .mini-log { font-family: var(--mono); font-size: 13px; line-height: 1.4; background: var(--panel-3); border-radius: 10px; padding: 6px 10px; overflow-y: auto; min-height: 0; }
      .sec-1-4 .mini-log > div { padding: 1px 0; border-bottom: 1px dashed var(--line); }
      .sec-1-4 svg .blk { stroke-width: 2; }
      .sec-1-4 svg .dim { opacity: .35; }
      .sec-1-4 svg .glow { stroke-width: 4; }
      .sec-1-4 svg .idle { fill: url(#s14-hatch); stroke: var(--warn); }
      .sec-1-4 svg .s14-hatch-line { stroke: var(--warn); stroke-width: 2; }
      .sec-1-4 svg .axis { stroke: var(--line-2); stroke-width: 1; }
      .sec-1-4 svg .cursor { stroke: var(--accent); stroke-width: 2.5; }
      .sec-1-4 svg .t13 { font-size: 13px; }
      .sec-1-4 svg .t14 { font-size: 14px; }
      .sec-1-4 svg .t15 { font-size: 15px; }
      .sec-1-4 svg .bold { font-weight: 700; }
      .sec-1-4 svg .mid { text-anchor: middle; }
      .sec-1-4 svg .end { text-anchor: end; }
    `,

    steps: [
      /* ============ 1. Big Picture: why interrupts exist ============ */
      {
        title: 'Why a fast processor should never wait for a slow device',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack">
              <p class="lead m0">A processor runs about a billion instructions per second. One disk, printer or network operation can last as long as 100,000 to over 100,000,000 instructions.</p>
              <p class="m0">Say a program asks the printer to print a line. If the processor just waits, it sits idle for millions of instruction-times. An <span class="t">interrupt</span> fixes this: the processor starts the device, goes back to useful work, and the device <em>interrupts</em> it (sends it a signal) when it is done.</p>
              <div class="callout why m0" data-label="Why it matters">Interrupts exist mainly to raise <span class="t">processor utilization</span>, the share of time the processor spends on useful work instead of waiting.</div>
              <div class="callout analogy m0" data-label="Analogy">At a busy food counter you pay, get a buzzer, and sit down to answer emails. You do not stand at the counter watching the kitchen. When the buzzer goes off you collect your food, then return to your emails exactly where you stopped.</div>
            </div>
            <div class="card stack s14-gap"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const card = ctx.$('.s14-gap');
          const DEV = {
            ssd: { label: 'SSD read', ms: 0.1, what: 'Reading one block from a solid-state drive' },
            hdd: { label: 'Hard-disk read', ms: 5, what: 'Reading one block from a spinning hard disk' },
            prn: { label: 'Print a line', ms: 20, what: 'A slow printer printing one line of text' },
            net: { label: 'Network reply', ms: 50, what: 'Waiting for a reply from a server far away' },
            key: { label: 'Next keypress', ms: 200, what: 'The gap between two keys typed by a quick typist' },
          };
          const stretch = (sec) => {
            const day = 86400;
            if (sec < 2 * day) return 'about ' + Math.round(sec / 3600) + ' hours';
            if (sec < 60 * day) return 'about ' + Math.round(sec / day) + ' days';
            if (sec < 2 * 365.25 * day) return 'about ' + Math.round(sec / (30.44 * day)) + ' months';
            return 'about ' + ctx.util.fmt(sec / (365.25 * day), 1) + ' years';
          };
          const what = h('p', { class: 'small m0 muted' });
          const devTime = h('div', { class: 'stat' });
          const big = h('div', { class: 'big', style: { color: 'var(--io)' } });
          const human = h('div', { class: 'callout tip m0' });
          const show = (k) => {
            const d = DEV[k];
            const instr = Math.round(d.ms * 1e6);            // 1 instruction per nanosecond
            what.textContent = d.what + '.';
            devTime.innerHTML = `<span class="l">Device needs</span><span class="v">≈ ${d.ms < 1 ? d.ms * 1000 + ' µs' : d.ms + ' ms'}</span>`;
            big.textContent = instr.toLocaleString('en-US');
            human.innerHTML = `<b>Stretch it:</b> if one instruction took one second, this wait would last <b>${stretch(instr)}</b>.`;
          };
          const seg = ctx.ui.seg(Object.entries(DEV).map(([value, d]) => ({ value, label: d.label })), 'prn', show);
          card.append(
            h('h4', { class: 'm0' }, 'The speed gap: pick a device'),
            h('p', { class: 'small m0' }, 'Assume the processor runs one instruction per nanosecond. The device times are rough, typical figures; the size of the gap is what matters.'),
            seg, what, devTime,
            h('div', {}, big, h('div', { class: 'small b' }, 'instructions the processor could have run while waiting')),
            human,
            h('div', { class: 'row gap-s', style: { marginTop: 'auto' } },
              h('span', { class: 'xs muted b' }, 'COMING UP:'),
              h('span', { class: 'chip intr' }, '4 classes'), h('span', { class: 'chip proc' }, 'flow of control'),
              h('span', { class: 'chip warn' }, 'timing race'), h('span', { class: 'chip cpu' }, '9-step walkthrough'),
              h('span', { class: 'chip os' }, 'nested interrupts')),
          );
          show('prn');
        },
      },

      /* ============ 2. The four classes + classify game ============ */
      {
        title: 'Four classes of interrupts: sort the events',
        kind: 'lab',
        html: `
          <div class="split l fill">
            <div class="stack gap-s">
              <p class="m0">Every interrupt says “stop and deal with this”. They are grouped by <b>where the signal comes from</b>:</p>
              <div class="card proc cls-card" data-c="0"><h3>1 · Program</h3><p>Caused by the instruction just executed: <b>arithmetic overflow</b>, <b>division by zero</b>, an <b>illegal instruction</b>, or a <b>memory reference outside</b> the program’s allowed space.</p></div>
              <div class="card cpu cls-card" data-c="1"><h3>2 · Timer</h3><p>Produced by a clock inside the processor at regular intervals, so the operating system can regain control and do jobs on a schedule.</p></div>
              <div class="card io cls-card" data-c="2"><h3>3 · I/O</h3><p>Sent by an <span class="t">I/O module</span> (device controller) when an operation finishes, the device needs service, or to report an error.</p></div>
              <div class="card intr cls-card" data-c="3"><h3>4 · Hardware failure</h3><p>Raised by a physical fault, such as the power failing or a memory parity error (stored bits found corrupted).</p></div>
            </div>
            <div class="card white stack s14-game"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const CLASSES = ['Program', 'Timer', 'I/O', 'Hardware failure'];
          const EVENTS = [
            ['An ADD instruction produces a result too large to fit in its register.', 0, 'Arithmetic overflow is caused by the instruction the processor just ran, so it is a <span class="t">program interrupt</span>.'],
            ['A program divides a number by zero.', 0, 'Division by zero happens inside the executing instruction: a program interrupt.'],
            ['The processor fetches a bit pattern that is not a valid instruction.', 0, 'An illegal instruction comes from the program itself: a program interrupt.'],
            ['A program tries to read an address outside the memory it is allowed to use.', 0, 'A memory access violation is caused by the program’s own instruction: a program interrupt.'],
            ['The processor’s built-in clock signals that another 10 milliseconds have passed.', 1, 'A regular tick from the processor’s clock is a <span class="t">timer interrupt</span>.'],
            ['A program has been running in an endless loop, but the OS still gets control back after a fixed slice of time.', 1, 'The OS regains control because the clock fires at regular intervals: a timer interrupt.'],
            ['The printer finishes printing a line and is ready for the next one.', 2, 'A device reporting that its operation completed is an <span class="t">I/O interrupt</span>.'],
            ['The disk controller reports that the block you asked for is now in memory.', 2, 'The I/O module signals completion of a transfer: an I/O interrupt.'],
            ['The network card reports that a transmission failed.', 2, 'An error reported by an I/O module is still an I/O interrupt. Hardware-failure interrupts are about the machine itself breaking.'],
            ['A key is pressed on the keyboard.', 2, 'The keyboard’s I/O module asks for service: an I/O interrupt.'],
            ['The power supply detects that the voltage is dropping.', 3, 'A failing power supply is a physical fault: a <span class="t">hardware failure interrupt</span>. The OS may have a few milliseconds to save critical data.'],
            ['Memory detects a parity error in a word it just read.', 3, 'A parity error means the extra check bit no longer matches the stored bits, so the memory hardware has corrupted them: a hardware failure interrupt.'],
          ];
          const game = ctx.$('.s14-game');
          const cards = ctx.$$('.cls-card');
          let order = [], k = 0, firstTry = 0, answered = false;
          const prog = h('div', { class: 'small b muted' });
          const score = h('span', { class: 'chip ok' });
          const evCard = h('div', { class: 'card ev-card' });
          const fb = h('div', { class: 'fb', style: { minHeight: '66px' } });
          const btns = CLASSES.map((c, i) => h('button', { class: 'btn', type: 'button', onclick: () => answer(i) }, c));
          const next = h('button', { class: 'btn primary', type: 'button', onclick: () => advance() }, 'Next event →');
          const meter = h('div', { class: 'meter' }, h('i', { style: { width: '0%' } }));
          function paint() {
            const ev = EVENTS[order[k]];
            prog.textContent = `Event ${k + 1} of ${EVENTS.length}`;
            score.textContent = `${firstTry} right first time`;
            meter.firstChild.style.width = (k / EVENTS.length) * 100 + '%';
            evCard.textContent = ev[0];
            btns.forEach((b) => { b.disabled = false; b.classList.remove('right', 'wrong'); });
            cards.forEach((c) => c.classList.remove('hot'));
            fb.innerHTML = '<span class="muted">Which class does this event belong to? Click one of the four buttons.</span>';
            next.disabled = true; answered = false;
          }
          function answer(i) {
            if (answered) return;
            const ev = EVENTS[order[k]];
            answered = true;
            const ok = i === ev[1];
            if (ok) firstTry++;
            btns[i].classList.add(ok ? 'right' : 'wrong');
            if (!ok) btns[ev[1]].classList.add('right');
            cards.forEach((c) => c.classList.toggle('hot', +c.dataset.c === ev[1]));
            fb.innerHTML = `<b style="color:var(--${ok ? 'ok' : 'bad'})">${ok ? '✓ Correct.' : '✗ Not quite: it is ' + CLASSES[ev[1]] + '.'}</b> ${ev[2]}`;
            score.textContent = `${firstTry} right first time`;
            next.disabled = false;
            next.textContent = k === EVENTS.length - 1 ? 'See my score →' : 'Next event →';
          }
          function advance() {
            if (!answered) return;
            if (k < EVENTS.length - 1) { k++; paint(); return; }
            meter.firstChild.style.width = '100%';
            prog.textContent = 'All events sorted';
            evCard.innerHTML = `<div><div class="big" style="color:var(--ok)">${firstTry} / ${EVENTS.length}</div><div class="small">right on the first try</div></div>`;
            btns.forEach((b) => { b.disabled = true; b.classList.remove('right', 'wrong'); });
            cards.forEach((c) => c.classList.remove('hot'));
            fb.innerHTML = firstTry >= 10 ? 'Excellent. You can tell where an interrupt comes from.' : 'Reread the four class cards on the left, then play again with a new order.';
            next.textContent = 'Play again (new order)';
            next.disabled = false;
            answered = false;                                   // advance() now ignores clicks...
            next.addEventListener('click', restart, { once: true }); // ...and this one restarts the game
          }
          function restart() { order = ctx.util.shuffle(ctx.util.range(EVENTS.length)); k = 0; firstTry = 0; next.textContent = 'Next event →'; paint(); }
          game.append(
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, prog, score),
            meter, evCard,
            h('div', { class: 'cls-btns' }, ...btns),
            fb,
            h('div', { class: 'callout why small', 'data-label': 'How to decide', style: { marginTop: 'auto', marginBottom: '0' } },
              'Ask where the signal came from. Did the ', h('b', {}, 'running instruction'), ' cause it? The processor’s ', h('b', {}, 'clock'), '? A ', h('b', {}, 'device'), ' reporting on its work? Or the ', h('b', {}, 'machine itself'), ' breaking?'),
            h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, next),
          );
          restart();
        },
      },

      /* ============ 3. Flow of control: without vs with interrupts ============ */
      {
        title: 'Follow the processor: with and without interrupts',
        kind: 'compare',
        render(el, ctx) {
          const { h, s } = ctx;
          const UX = 20, UW = 250, RX = 450, RW = 270;
          /* Block positions for each scenario. U = user program column, R = OS column (I/O program on top, handler below). */
          function layout(mode) {
            const B = {};
            const U = (id, y, hh, label, cls = 's-proc') => (B[id] = { x: UX, y, w: UW, h: hh, label, cls });
            const R = (id, y, hh, label, cls = 's-os') => (B[id] = { x: RX, y, w: RW, h: hh, label, cls });
            U('U1', 34, 44, '① User code');
            U('W1', 84, 26, 'WRITE: call the I/O program', 's-panel');
            if (mode === 'short') { U('U2a', 116, 36, '② User code (first part)'); U('U2b', 152, 36, '② User code (the rest)'); } else U('U2', 116, 72, '② User code');
            U('W2', 194, 26, 'WRITE: call it again', 's-panel');
            if (mode === 'short') { U('U3a', 226, 36, '③ User code (first part)'); U('U3b', 262, 36, '③ User code (the rest)'); } else U('U3', 226, 72, '③ User code');
            if (mode === 'none') {
              R('P4', 34, 34, '④ Prep code'); R('CMD', 74, 26, 'I/O command → printer'); R('WAIT', 106, 50, 'Wait: keep checking the printer', 'idle');
              R('C5', 162, 34, '⑤ Completion code'); R('RET', 202, 26, 'Return to the user program');
            } else if (mode === 'short') {
              R('P4', 34, 34, '④ Prep code'); R('CMD', 74, 26, 'I/O command → printer'); R('RET', 106, 26, 'Return right away');
            } else {
              R('WAITP', 34, 44, 'Wait: printer still busy', 'idle'); R('P4', 84, 34, '④ Prep code'); R('CMD', 124, 26, 'I/O command → printer'); R('RET', 156, 26, 'Return right away');
            }
            if (mode !== 'none') { R('C5h', 260, 34, '⑤ Completion code', 's-intr'); R('IRET', 300, 24, 'Return from interrupt', 's-intr'); }
            return B;
          }
          /* Frames: act = blocks the processor runs in this frame, arr = [from, to] jump, cpu = what the processor is doing. */
          const F = (act, arr, cpu, prn, cap, mark) => ({ act, arr, cpu, prn, cap, mark });
          const FRAMES = {
            none: [
              F(['U1'], null, 'user', 'idle', '<b>User code ①.</b> The processor runs the program’s own instructions. The printer is idle.'),
              F(['W1', 'P4'], ['W1', 'P4'], 'os', 'idle', '<b>WRITE.</b> The program calls the I/O program (part of the OS). Its <b>prep code ④</b> gets the data ready and checks that the printer is free.'),
              F(['CMD'], null, 'os', 'printing line 1 …', '<b>I/O command.</b> The processor tells the printer to start. Printing one line takes millions of instruction-times.'),
              F(['WAIT'], null, 'idle', 'printing line 1 …', '<b>Wait.</b> With no interrupts, the only way to learn that the printer is done is to keep checking its status. No useful work happens here.'),
              F(['C5'], null, 'os', 'line 1 done; its status register now reads “ready”', '<b>Completion code ⑤.</b> One of the status checks finally sees “ready”. The I/O program checks the result (success or error) and tidies up.'),
              F(['RET', 'U2'], ['RET', 'U2'], 'user', 'idle', '<b>Return.</b> Only now does control go back to the user program, and code ② runs.'),
              F(['W2', 'P4'], ['W2', 'P4'], 'os', 'idle', '<b>Second WRITE.</b> Prep code ④ runs again for line 2.'),
              F(['CMD', 'WAIT'], null, 'idle', 'printing line 2 …', '<b>Command, then wait again.</b> The processor sits idle for the whole of line 2.'),
              F(['C5', 'RET', 'U3'], ['RET', 'U3'], 'user', 'idle', '<b>Completion ⑤, return, code ③.</b> The program finally moves on. Cost: two long idle waits, one per WRITE.'),
            ],
            short: [
              F(['U1'], null, 'user', 'idle', '<b>User code ①.</b> Same program, but now the system uses interrupts.'),
              F(['W1', 'P4'], ['W1', 'P4'], 'os', 'idle', '<b>WRITE.</b> Control jumps to the I/O program; <b>prep code ④</b> gets the data ready.'),
              F(['CMD'], null, 'os', 'printing line 1 …', '<b>I/O command.</b> The printer starts line 1.'),
              F(['RET', 'U2a'], ['RET', 'U2a'], 'user', 'printing line 1 …', '<b>Return right away.</b> The I/O program does not wait. User code ② runs <i>while</i> the printer works in parallel.'),
              F(['C5h'], ['U2a', 'C5h'], 'isr', 'done → raises an interrupt', '<b>Interrupt!</b> The printer finishes partway through code ②. The processor completes its current instruction, saves where it was, and jumps to the <b>interrupt handler</b>, which runs completion code ⑤.', ['U2']),
              F(['IRET', 'U2b'], ['IRET', 'U2b'], 'user', 'idle', '<b>Return from interrupt.</b> Code ② carries on from the very next instruction, as if nothing had happened.', ['U2']),
              F(['W2', 'P4', 'CMD'], ['W2', 'P4'], 'os', 'printing line 2 …', '<b>Second WRITE.</b> Prep ④ and the I/O command start line 2.', ['U2']),
              F(['RET', 'U3a'], ['RET', 'U3a'], 'user', 'printing line 2 …', '<b>Return right away.</b> Code ③ runs while line 2 prints.', ['U2']),
              F(['C5h'], ['U3a', 'C5h'], 'isr', 'done → raises an interrupt', '<b>Interrupt again.</b> Line 2 is done, so the handler runs completion code ⑤.', ['U2', 'U3']),
              F(['IRET', 'U3b'], ['IRET', 'U3b'], 'user', 'idle', '<b>Resume ③.</b> The processor never sat idle: both lines printed while user code ran. The only extra cost is the short handler.', ['U2', 'U3']),
            ],
            long: [
              F(['U1'], null, 'user', 'idle', '<b>User code ①.</b> Interrupts again, but now each line takes <i>longer</i> to print than code ② takes to run.'),
              F(['W1', 'P4'], ['W1', 'P4'], 'os', 'idle', '<b>WRITE.</b> The printer is free, so <b>prep code ④</b> runs straight away.'),
              F(['CMD'], null, 'os', 'printing line 1 …', '<b>I/O command.</b> Line 1 starts. This one is slow.'),
              F(['RET', 'U2'], ['RET', 'U2'], 'user', 'printing line 1 …', '<b>Return right away.</b> Code ② runs in parallel with the printer.'),
              F(['W2', 'WAITP'], ['W2', 'WAITP'], 'idle', 'printing line 1 …', '<b>Second WRITE, but the printer is still busy</b> with line 1. A new command cannot be issued yet, and this program has nothing else to do, so the processor waits.'),
              F(['C5h'], ['WAITP', 'C5h'], 'isr', 'done → raises an interrupt', '<b>Interrupt!</b> Line 1 finishes. The handler runs completion code ⑤.'),
              F(['IRET', 'P4'], ['IRET', 'P4'], 'os', 'idle', '<b>Return from interrupt</b> to the waiting I/O program, which can now run prep code ④ for line 2.'),
              F(['CMD', 'RET', 'U3'], ['RET', 'U3'], 'user', 'printing line 2 …', '<b>Command, return, code ③.</b> Line 2 prints while code ③ runs.'),
              F(['C5h'], ['U3', 'C5h'], 'isr', 'done → raises an interrupt', '<b>Interrupt.</b> Line 2 finishes; the handler runs ⑤ once more, then returns to the program. Interrupts still saved time, but the wait at the second WRITE could not be hidden.'),
            ],
          };
          const CPU = { user: ['proc', 'running user code'], os: ['os', 'running the I/O program (OS)'], isr: ['intr', 'running the interrupt handler'], idle: ['warn', 'idle: waiting for the printer'] };
          const EXPLAIN = {
            none: 'The processor starts the printer with an <span class="t">I/O command</span>, then does nothing useful until the printer is finished. Every WRITE costs one full printing time.',
            short: 'The processor starts the printer with an <span class="t">I/O command</span> and immediately goes back to the user program. The printer’s interrupt tells it when to run the <span class="t">interrupt handler</span>.',
            long: 'Interrupts help, but if the program reaches its next WRITE before the previous line is done, it still has to wait for that line to finish.',
          };
          let mode = 'none';
          const svg = s('svg', { viewBox: '0 0 740 366', width: '100%' });
          const stChip = h('span', { class: 'chip' });
          const idleOut = h('b', { class: 'num' });
          const expl = h('p', { class: 'small m0' });
          function draw(i) {
            const B = layout(mode), frames = FRAMES[mode], fr = frames[i];
            const seen = new Set(); frames.slice(0, i + 1).forEach((f) => f.act.forEach((a) => seen.add(a)));
            const kids = [
              s('defs', {}, s('pattern', { id: 's14-hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
                s('rect', { width: 8, height: 8, style: 'fill:var(--warn-bg)' }), s('line', { x1: 0, y1: 0, x2: 0, y2: 8, class: 's14-hatch-line' }))),
              s('text', { x: UX, y: 22, class: 't15 bold', style: 'fill:var(--proc)' }, 'User program'),
              s('text', { x: RX, y: 22, class: 't15 bold', style: 'fill:var(--os)' }, 'I/O program (part of the OS)'),
              s('text', { x: RX, y: 252, class: 't15 bold', style: 'fill:var(--intr)' }, 'Interrupt handler (part of the OS)'),
            ];
            if (mode === 'none') kids.push(s('rect', { x: RX, y: 260, width: RW, height: 64, rx: 8, class: 's-panel', 'stroke-dasharray': '5 4' }),
              s('text', { x: RX + RW / 2, y: 288, class: 't14 mid s-sub' }, 'Not used: with no interrupts'), s('text', { x: RX + RW / 2, y: 308, class: 't14 mid s-sub' }, 'there is no handler'));
            // history arrows (faint) and the current jump (bold)
            frames.slice(0, i + 1).forEach((f, j) => {
              if (!f.arr) return;
              const a = B[f.arr[0]], b = B[f.arr[1]]; if (!a || !b) return;
              const y1 = a.y + a.h / 2, y2 = b.y + b.h / 2;
              let d;
              if (a.x === b.x) d = `M${a.x},${y1} C${a.x - 70},${y1} ${b.x - 70},${y2} ${b.x - 3},${y2}`;   // same column: loop out to the left
              else {
                const ltr = a.x < b.x;
                const x1 = ltr ? a.x + a.w : a.x, x2 = ltr ? b.x - 3 : b.x + b.w + 3, dx = (x2 - x1) * 0.5;
                d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
              }
              const isIntr = f.arr[1] === 'C5h';
              kids.push(s('path', { d, fill: 'none', 'stroke-width': j === i ? 3 : 2,
                style: `stroke:var(--${isIntr ? 'intr' : 'accent'});opacity:${j === i ? 1 : 0.28}`, 'stroke-dasharray': isIntr ? '6 4' : null,
                'marker-end': j === i ? `url(#arr-${isIntr ? 'intr' : 'accent'})` : null }));
            });
            for (const [id, b] of Object.entries(B)) {
              const on = fr.act.includes(id);
              kids.push(s('g', { class: seen.has(id) || on ? '' : 'dim' },
                s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 8, class: 'blk ' + b.cls + (on ? ' glow' : '') }),
                s('text', { x: b.x + b.w / 2, y: b.y + b.h / 2 + 5, class: 't14 mid' + (on ? ' bold' : '') }, b.label)));
            }
            const last = B[fr.act[fr.act.length - 1]];
            if (last) kids.push(s('rect', { x: last.x - 12, y: last.y + last.h / 2 - 10, width: 40, height: 20, rx: 10, class: 's-cpu', 'stroke-width': 2 }),
              s('text', { x: last.x + 8, y: last.y + last.h / 2 + 5, class: 't13 mid bold', style: 'fill:var(--cpu)' }, 'CPU'));
            (fr.mark || []).forEach((m) => {
              const y = m === 'U2' ? 152 : 262;
              kids.push(s('line', { x1: UX, y1: y, x2: UX + UW + 6, y2: y, 'stroke-width': 2.5, 'stroke-dasharray': '5 3', style: 'stroke:var(--intr)' }),
                s('text', { x: UX + UW + 10, y: y + 5, class: 't13 bold', style: 'fill:var(--intr)' }, '✗ interrupt'));
            });
            kids.push(s('rect', { x: UX, y: 336, width: 700, height: 26, rx: 8, class: 's-io', 'stroke-width': 1.5 }),
              s('text', { x: UX + 12, y: 354, class: 't14 bold', style: 'fill:var(--io)' }, 'Printer: ' + fr.prn));
            svg.replaceChildren(...kids);
            const c = CPU[fr.cpu];
            stChip.className = 'chip ' + c[0]; stChip.textContent = c[1];
            idleOut.textContent = frames.slice(0, i + 1).filter((f, j) => f.cpu === 'idle' && (j === 0 || frames[j - 1].cpu !== 'idle')).length;
            return fr.cap;
          }
          const player = ctx.ui.player({ count: FRAMES.none.length, render: draw, interval: 2600 });
          const seg = ctx.ui.seg([{ value: 'none', label: 'No interrupts' }, { value: 'short', label: 'Interrupts, short I/O wait' }, { value: 'long', label: 'Interrupts, long I/O wait' }], 'none', (v) => {
            mode = v; expl.innerHTML = EXPLAIN[v]; player.stop(); player.setCount(FRAMES[v].length);
          });
          seg.style.display = 'flex'; seg.style.flexDirection = 'column';
          expl.innerHTML = EXPLAIN.none;
          el.append(h('div', { class: 'split l3 fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'm0' }, 'Pick a scenario, then step through it. The ', h('b', {}, 'CPU'), ' tag shows where the processor is working right now; faded blocks have not run yet.'),
              seg,
              h('div', { class: 'card tight stack gap-s' },
                h('div', { class: 'small' }, 'Processor right now: ', stChip),
                h('div', { class: 'small' }, 'Idle waits so far: ', idleOut)),
              expl,
              h('div', { class: 'callout tip m0 small', 'data-label': 'Notice' }, 'The user program contains no code for the interrupt. The processor and the OS pause it and resume it without it ever knowing.')),
            h('div', { class: 'stack gap-s' }, h('div', { class: 'card white tight' }, panWrap(ctx, svg, 660)), player.el,
              h('div', { class: 'row gap-s xs' }, h('span', { class: 'chip proc' }, 'user program'), h('span', { class: 'chip os' }, 'OS I/O program'),
                h('span', { class: 'chip intr' }, 'interrupt handler'), h('span', { class: 'chip warn' }, 'processor idle'), h('span', { class: 'chip accent' }, '→ jump of control')))));
        },
      },

      /* ============ 4. Timing race ============ */
      {
        title: 'Timing race: how much time do interrupts save?',
        kind: 'lab',
        render(el, ctx) {
          const { h, s } = ctx;
          const A = 10, P = 2, Q = 2, O = 1, HND = O + Q;   // user code, prep ④, completion ⑤, save/restore overhead
          /* Without interrupts: ① ④ wait ⑤ ② ④ wait ⑤ ③ */
          function noIntr(D) {
            const cpu = [], prn = []; let t = 0;
            const add = (len, kind, label) => { if (len > 0) cpu.push({ s: t, e: t + len, kind, label }); t += len; };
            add(A, 'user', '①');
            [['1', '②'], ['2', '③']].forEach(([n, next]) => {
              add(P, 'os', '④');
              prn.push({ s: t, e: t + D, label: 'line ' + n });
              add(D, 'idle', 'idle');
              add(Q, 'os', '⑤');
              add(A, 'user', next);
            });
            return { cpu, prn, end: t };
          }
          /* With interrupts: the printer runs in parallel; its interrupt runs the handler (overhead + ⑤). */
          function withIntr(D) {
            const cpu = [], prn = []; let t = 0, irq = null;
            const seg = (a, b, kind, label) => { if (b > a) cpu.push({ s: a, e: b, kind, label }); };
            const handle = (at) => { seg(at, at + HND, 'isr', '⑤'); return at + HND; };
            const waitForIrq = () => { if (irq === null) return; seg(t, irq, 'idle', 'idle'); t = handle(Math.max(t, irq)); irq = null; };
            const runUser = (len, label) => {
              if (irq !== null && irq >= t && irq < t + len) {
                const done = irq - t; seg(t, irq, 'user', label); t = handle(irq); irq = null;
                seg(t, t + len - done, 'user', label); t += len - done;
              } else { seg(t, t + len, 'user', label); t += len; }
            };
            const write = (n) => { waitForIrq(); seg(t, t + P, 'os', '④'); t += P; prn.push({ s: t, e: t + D, label: 'line ' + n }); irq = t + D; };
            seg(0, A, 'user', '①'); t = A;
            write('1'); runUser(A, '②'); write('2'); runUser(A, '③'); waitForIrq();
            return { cpu, prn, end: t };
          }
          const stats = (r) => { const idle = r.cpu.filter((x) => x.kind === 'idle').reduce((n, x) => n + x.e - x.s, 0); return { end: r.end, idle, util: Math.round(((r.end - idle) / r.end) * 100) }; };

          const NW = ctx.narrow, VBW = NW ? 420 : 1120, X0 = NW ? 62 : 150, X1 = VBW - 16, TMAX = 120, K = (X1 - X0) / TMAX;
          const X = (t) => X0 + t * K;
          const CLS = { user: 's-proc', os: 's-os', isr: 's-intr', idle: 'idle' };
          const svg = s('svg', { viewBox: `0 0 ${VBW} 250`, width: '100%' });
          let D = 6, T = TMAX, R1, R2;
          function row(y, title, r, T) {
            const out = [s('text', { x: 0, y: y + 14, class: 't15 bold' }, title),
              s('text', { x: X0 - 10, y: y + 49, class: 't14 end s-sub' }, 'CPU'), s('text', { x: X0 - 10, y: y + 88, class: 't14 end s-sub' }, 'Printer')];
            r.cpu.forEach((g) => {
              const w = (g.e - g.s) * K;
              out.push(s('rect', { x: X(g.s), y: y + 24, width: w, height: 40, rx: 3, class: 'blk ' + CLS[g.kind], 'stroke-width': 1.5 }));
              const txt = g.kind === 'idle' ? (w >= 44 ? 'idle' : '') : (w >= 15 ? g.label : '');
              if (txt) out.push(s('text', { x: X(g.s) + w / 2, y: y + (g.kind === 'idle' ? 49 : 51), class: 'mid bold', style: `font-size:${g.kind === 'idle' ? 14 : 19}px` }, txt));
            });
            r.prn.forEach((g) => {
              const w = (g.e - g.s) * K;
              out.push(s('rect', { x: X(g.s), y: y + 70, width: w, height: 26, rx: 3, class: 's-io', 'stroke-width': 1.5 }));
              if (w >= 44) out.push(s('text', { x: X(g.s) + w / 2, y: y + 88, class: 't13 mid' }, g.label));
            });
            const done = T >= r.end;
            out.push(s('text', { x: NW ? X1 : X0, y: y + 14, class: 't14 bold' + (NW ? ' end' : ''), style: `fill:var(--${done ? 'ok' : 'muted'})` },
              done ? `✓ finished at t = ${r.end}` : `running …  t = ${Math.floor(T)}`));
            if (done) out.push(s('line', { x1: X(r.end), y1: y + 20, x2: X(r.end), y2: y + 100, 'stroke-width': 2, 'stroke-dasharray': '4 3', style: 'stroke:var(--ok)' }));
            return out;
          }
          function draw() {
            const kids = [s('defs', {}, s('pattern', { id: 's14-hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
              s('rect', { width: 8, height: 8, style: 'fill:var(--warn-bg)' }), s('line', { x1: 0, y1: 0, x2: 0, y2: 8, class: 's14-hatch-line' })))];
            kids.push(...row(0, 'No interrupts', R1, T), ...row(110, 'With interrupts', R2, T));
            if (T < TMAX) kids.push(s('rect', { x: X(T), y: 18, width: X1 - X(T) + 2, height: 198, style: 'fill:var(--panel);opacity:.82' }),
              s('line', { x1: X(T), y1: 16, x2: X(T), y2: 218, class: 'cursor' }));
            kids.push(s('line', { x1: X0, y1: 222, x2: X1, y2: 222, class: 'axis' }));
            for (let t = 0; t <= TMAX; t += NW ? 30 : 10) kids.push(s('line', { x1: X(t), y1: 222, x2: X(t), y2: 228, class: 'axis' }), s('text', { x: X(t), y: 244, class: 't13 mid s-sub' }, String(t)));
            kids.push(s('text', { x: X0 - 10, y: 244, class: 't13 end s-sub' }, 'time →'));
            svg.replaceChildren(...kids);
          }
          const statBox = (label) => { const v = h('span', { class: 'v' }); return [h('div', { class: 'stat' }, h('span', { class: 'l' }, label), v), v]; };
          const [n1, nTot] = statBox('Total time'), [n2, nIdle] = statBox('CPU idle'), [n3, nUtil] = statBox('Utilization');
          const [w1, wTot] = statBox('Total time'), [w2, wIdle] = statBox('CPU idle'), [w3, wUtil] = statBox('Utilization');
          const insight = h('div', { class: 'callout why m0 small' });
          function update() {
            R1 = noIntr(D); R2 = withIntr(D);
            const a = stats(R1), b = stats(R2);
            nTot.textContent = a.end; nIdle.textContent = a.idle; nUtil.textContent = a.util + '%';
            wTot.textContent = b.end; wIdle.textContent = b.idle; wUtil.textContent = b.util + '%';
            const saved = a.end - b.end;
            const head = saved > 0 ? `<b>Interrupts finish ${saved} time units sooner</b> (${Math.round((saved / a.end) * 100)}% less time). ` : '<b>No time saved.</b> ';
            let body;
            if (D <= O) body = 'The printer is no slower than the handler’s extra save/restore cost, so overlapping gains nothing.';
            else if (b.idle === 0) body = 'Short wait: each line finishes while user code is still running, so the processor never idles. Only the handler’s cost remains.';
            else body = 'Long wait: a line outlasts the 10 units of user code between WRITEs, so some idle time (hatched) remains.';
            insight.innerHTML = head + body;
            preset.set(D === 6 ? 's' : D === 25 ? 'l' : null);
            draw();
          }
          const slider = ctx.ui.slider({ label: 'Printer time per line', min: 1, max: 40, value: D, format: (v) => v + ' units', onInput: (v) => { D = v; stopRace(); update(); } });
          const preset = ctx.ui.seg([{ value: 's', label: 'Short wait (6)' }, { value: 'l', label: 'Long wait (25)' }], 's', (v) => { D = v === 's' ? 6 : 25; slider.set(D); stopRace(); update(); });
          let stopFn = null;
          const stopRace = () => { if (stopFn) stopFn(); stopFn = null; T = TMAX; raceBtn.textContent = '▶ Race'; };
          const raceBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => {
            if (stopFn) { stopRace(); draw(); return; }
            T = 0; let last = null; raceBtn.textContent = '■ Stop';
            stopFn = ctx.raf((now) => {
              if (last === null) last = now;
              T = Math.min(TMAX, T + ((now - last) / 1000) * 32); last = now;
              draw();
              if (T >= Math.max(R1.end, R2.end) + 2) { T = TMAX; stopFn = null; raceBtn.textContent = '▶ Race'; draw(); return false; }
            });
          } }, '▶ Race');
          slider.style.flex = '1'; slider.style.minWidth = '260px';
          el.append(h('div', { class: 'stack fill gap-s' },
            h('div', { class: 'row' }, slider, preset, raceBtn),
            h('div', { class: 'card white tight' }, svg),
            h('div', { class: 'row gap-s xs' },
              h('span', { class: 'chip proc' }, '①②③ user code (10 each)'), h('span', { class: 'chip os' }, '④ prep (2), ⑤ completion (2)'),
              h('span', { class: 'chip intr' }, 'handler: ⑤ + save/restore (3)'), h('span', { class: 'chip warn' }, 'idle'), h('span', { class: 'chip io' }, 'printer busy')),
            h('div', { class: 'grid-3' },
              h('div', { class: 'card tight stack gap-s' }, h('div', { class: 'b small' }, 'No interrupts'), h('div', { class: 'row', style: { gap: '22px' } }, n1, n2, n3)),
              h('div', { class: 'card tight stack gap-s' }, h('div', { class: 'b small' }, 'With interrupts'), h('div', { class: 'row', style: { gap: '22px' } }, w1, w2, w3)),
              insight),
            h('p', { class: 'small m0 muted' }, h('b', {}, 'Try this: '), 'drag the slider slowly from 1 up to 40. The “with interrupts” row first shows idle time at 11 units, the moment a line takes longer than the 10 units of user code between WRITEs. That is the line between a short and a long I/O wait.')));
          update();
        },
      },

      /* ============ 5. The interrupt stage in the instruction cycle ============ */
      {
        title: 'The interrupt stage: a check after every instruction',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const PROG = {
            300: ['LOAD R1, [count]', 'copy a number from memory into R1'], 301: ['ADD R1, 1', 'add 1 to R1'],
            302: ['STORE R1, [count]', 'write R1 back to memory'], 303: ['JUMP 300', 'loop back to address 300'],
            900: ['SAVE registers', 'push the registers the handler will use (R1…R3) onto the stack'], 901: ['READ printer status', 'find out what the printer needs and send it the next line'],
            902: ['RESTORE registers', 'pop R1…R3 back, so they hold the program’s values again'], 903: ['RETURN from interrupt', 'pop the PC and PSW, so the program resumes where it stopped'],
          };
          let st;
          const fresh = () => ({ last: null, edge: null, pc: 300, ir: null, pending: false, en: true, kernel: false, stack: [], user: 0, hnd: 0, served: 0, handler: false });
          /* ---- the cycle diagram ---- */
          const svg = s('svg', { viewBox: '0 0 540 266', width: '100%' });
          const BOX = { fetch: [110, 12, 'Fetch stage', 'IR ← memory[PC];  PC ← PC + 1', 's-cpu'], exec: [110, 102, 'Execute stage', 'carry out the instruction in IR', 's-cpu'], intr: [110, 192, 'Interrupt stage', 'is an interrupt pending?', 's-intr'] };
          const EDGE = {
            'f-e': ['M215,72 V100', ''], 'e-i': ['M215,162 V190', ''],
            'i-f': ['M110,222 H46 V30 H108', ''], 'e-f': ['M320,132 H352 V56 H322', ''],
            'i-h': ['M320,222 H370', ''], 'h-f': ['M452,192 V22 H322', ''],
          };
          function drawCycle() {
            const on = (e) => st.edge === e || (st.handler && st.last === 'intr' && e === 'i-h') || (st.handler && st.last === 'intr' && e === 'e-i');
            const kids = Object.entries(EDGE).map(([k, [d]]) => s('path', { d, fill: 'none', 'stroke-width': on(k) ? 3.5 : 2, 'stroke-dasharray': k === 'e-f' ? '6 4' : null,
              style: `stroke:var(--${on(k) ? 'accent' : 'line-2'})`, 'marker-end': `url(#arr-${on(k) ? 'accent' : 'muted'})` }));
            for (const [k, [x, y, t1, t2, cls]] of Object.entries(BOX)) {
              const act = st.last === k;
              kids.push(s('rect', { x, y, width: 210, height: 60, rx: 12, class: 'blk ' + cls + (act ? ' glow' : ''), style: act ? '' : 'opacity:.75' }),
                s('text', { x: x + 105, y: y + 25, class: 't15 mid bold' }, t1), s('text', { x: x + 105, y: y + 46, class: 't13 mid s-sub' }, t2));
            }
            const hAct = st.handler && st.last === 'intr';
            kids.push(s('rect', { x: 372, y: 192, width: 160, height: 64, rx: 12, class: 'blk s-os' + (hAct ? ' glow' : ''), style: hAct ? '' : 'opacity:.75' }),
              s('text', { x: 452, y: 213, class: 't13 mid bold' }, 'Save PC + PSW'), s('text', { x: 452, y: 231, class: 't13 mid bold' }, 'PC ← 900'), s('text', { x: 452, y: 249, class: 't13 mid s-sub' }, '(handler start)'),
              s('text', { x: 345, y: 214, class: 't13 mid', style: 'fill:var(--intr)' }, 'yes'),
              s('text', { x: 36, y: 126, class: 't13 mid s-sub', transform: 'rotate(-90 36 126)' }, 'none pending → next fetch'),
              s('text', { x: 360, y: 80, class: 't13 s-sub' }, 'interrupts'), s('text', { x: 360, y: 97, class: 't13 s-sub' }, 'disabled:'), s('text', { x: 360, y: 114, class: 't13 s-sub' }, 'skip check'),
              s('text', { x: 460, y: 90, class: 't13 s-sub' }, 'next fetch'), s('text', { x: 460, y: 107, class: 't13 s-sub' }, 'comes from'), s('text', { x: 460, y: 124, class: 't13 s-sub' }, 'the handler'));
            svg.replaceChildren(...kids);
          }
          /* ---- the processor panel ---- */
          const vPC = h('b', { class: 'mono' }), vIR = h('span', { class: 'mono small' }), vPSW = h('span', { class: 'small' }), vStack = h('span', { class: 'mono small' });
          const vMean = h('div', { class: 'small', style: { gridColumn: '1 / -1', color: 'var(--ink-2)', lineHeight: '1.35' } });   // plain-language meaning of the instruction in IR
          const lamp = h('span', { class: 'lamp' }), vPend = h('span', { class: 'small' });
          const vCount = h('div', { class: 'xs muted' });
          const rows = {};
          const memTbl = h('table', { class: 'tbl compact' });
          const addRows = (title, addrs) => {
            memTbl.append(h('tr', {}, h('th', { colspan: 2 }, title)));
            addrs.forEach((a) => { const pcMark = h('span', { class: 'chip cpu', style: { marginLeft: '6px', display: 'none' } }, '← PC'); rows[a] = [h('tr', {}, h('td', { class: 'mono' }, String(a)), h('td', { class: 'mono' }, PROG[a][0], pcMark)), pcMark]; memTbl.append(rows[a][0]); });
          };
          addRows('User program', [300, 301, 302, 303]); addRows('Interrupt handler (OS)', [900, 901, 902, 903]);
          const log = h('div', { class: 'mini-log', style: { height: '112px' } });
          const say = (msg, cls) => { log.prepend(h('div', { html: msg, style: cls ? { color: `var(--${cls})` } : null })); while (log.children.length > 40) log.lastChild.remove(); };
          const nextLabel = () => (st.last === 'fetch' ? 'Execute' : st.last === 'exec' ? (st.en ? 'Interrupt check' : 'Fetch') : 'Fetch');
          const nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => stepOnce() });
          function paint() {
            drawCycle();
            vPC.textContent = st.pc;
            vIR.textContent = st.ir == null ? '(empty)' : `${st.ir}: ${PROG[st.ir][0]}`;
            vMean.innerHTML = st.ir == null ? '<i>The IR holds the instruction being executed; nothing is fetched yet.</i>' : `<i>Meaning:</i> ${PROG[st.ir][1]}.`;
            vPSW.innerHTML = `mode <b>${st.kernel ? 'kernel' : 'user'}</b> · interrupts <b style="color:var(--${st.en ? 'ok' : 'bad'})">${st.en ? 'enabled' : 'disabled'}</b>`;
            vStack.textContent = st.stack.length ? st.stack.map((x) => (x.regs ? 'R1…R3' : `PC=${x.pc}, PSW(user, ${x.en ? 'on' : 'off'})`)).join(' | ') : '(empty)';
            lamp.classList.toggle('on', st.pending); vPend.textContent = st.pending ? 'printer interrupt waiting' : 'none';
            Object.entries(rows).forEach(([a, [tr, mark]]) => { tr.classList.toggle('on', +a === st.ir); mark.style.display = +a === st.pc ? '' : 'none'; });
            vCount.textContent = `User instructions done: ${st.user} · handler instructions (overhead): ${st.hnd} · interrupts served: ${st.served}`;
            nextBtn.textContent = 'Run next stage: ' + nextLabel() + ' ▶';
            enSeg.set(st.en);
          }
          function stepOnce() {
            const stage = st.last === 'fetch' ? 'exec' : st.last === 'exec' ? (st.en ? 'intr' : 'fetch') : 'fetch';
            if (stage === 'fetch') {
              st.edge = st.last === 'exec' ? 'e-f' : st.last === 'intr' ? (st.handler ? 'h-f' : 'i-f') : null;
              if (st.last === 'exec') say('Interrupts are disabled, so the interrupt stage is skipped.', 'muted');
              st.handler = false; st.ir = st.pc; st.pc += 1;
              say(`<b>Fetch</b> ${st.ir}: ${PROG[st.ir][0]}. PC → ${st.pc}.`);
            } else if (stage === 'exec') {
              st.edge = 'f-e';
              if (st.ir === 303) st.pc = 300;
              if (st.ir === 900) st.stack.push({ regs: true });                       // software saves the registers it will use
              if (st.ir === 902 && st.stack.length && st.stack[st.stack.length - 1].regs) st.stack.pop();   // ...and restores them
              if (st.ir === 903) { const sv = st.stack.pop(); st.pc = sv.pc; st.en = sv.en; st.kernel = false; }
              if (st.ir >= 900) st.hnd++; else st.user++;
              say(`<b>Execute</b> ${PROG[st.ir][0]}: ${PROG[st.ir][1]}.` + (st.ir === 903 ? ` PC is back to ${st.pc}, user mode, interrupts on.` : ''));
              if (st.ir === 903) say('That detour cost 4 handler instructions (including its own register save and restore) plus the hardware’s push and pop of the PC and PSW: this is <b>overhead</b>. It is tiny next to the millions of instruction-times the processor would otherwise spend waiting for the printer.', 'ok');
            } else {
              st.edge = 'e-i';
              if (st.pending) {
                st.stack.push({ pc: st.pc, en: st.en });
                say(`<b>Interrupt stage:</b> request found! Acknowledge it, push the PC (${st.pc}) and PSW onto the stack, then PC ← 900, kernel mode, interrupts off.`, 'intr');
                st.pc = 900; st.en = false; st.kernel = true; st.pending = false; st.handler = true; st.served++;
              } else { st.handler = false; say('<b>Interrupt stage:</b> nothing pending, carry on.', 'muted'); }
            }
            st.last = stage;
            paint();
          }
          let auto = false;
          const setAuto = (v) => { auto = v; autoBtn.classList.toggle('on', auto); autoBtn.textContent = auto ? 'Pause auto-run' : 'Auto-run'; };
          const autoBtn = h('button', { class: 'btn', type: 'button', onclick: () => setAuto(!auto) }, 'Auto-run');
          ctx.every(1000, () => { if (auto) stepOnce(); });
          const irqBtn = h('button', { class: 'btn intr', type: 'button', onclick: () => {
            if (st.pending) { ctx.toast('The printer’s request is already waiting.'); return; }
            st.pending = true;
            say((st.last === 'fetch' ? 'Printer raises an interrupt <i>in the middle of an instruction</i>. It must wait until the instruction finishes.' : 'Printer raises an interrupt request. It waits for the next interrupt stage.') + (st.en ? '' : ' Interrupts are off, so it stays <b>pending</b> until they are turned back on.'), 'intr');
            paint();
          } }, 'Raise printer interrupt');
          const enSeg = ctx.ui.seg([{ value: true, label: 'Interrupts on' }, { value: false, label: 'Off' }], true, (v) => {
            if (st.kernel) { ctx.toast('The handler runs with interrupts disabled; RETURN turns them back on.'); enSeg.set(st.en); return; }
            st.en = v; say(v ? 'Interrupts enabled again: a pending request will be noticed at the next interrupt stage.' : 'Interrupts disabled (on a real machine only the OS is allowed to do this). The interrupt stage is now skipped, so any request stays pending.', 'muted'); paint();
          });
          const resetBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => { setAuto(false); st = fresh(); log.replaceChildren(); say('Reset. Press “Run next stage”, raise an interrupt at any moment, and watch when it is noticed.'); paint(); } }, 'Reset');
          st = fresh();
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack' }, h('div', { class: 'card white tight' }, panWrap(ctx, svg, 520)),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Reading the processor panel', html: '<b>R1, R2 …</b> Real processors have many general-purpose registers, not the single <span class="t" data-t="Accumulator (AC)">AC</span> of section 1.3. <b>PSW mode:</b> programs run in the less-privileged <b>user mode</b>, the OS in the privileged <span class="t">kernel mode</span> (more in 2.2 and 3.4).' }),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake' }, h('span', { html: 'A device’s interrupt request never cuts an instruction in half. The processor finishes the current instruction and only looks for requests in the <span class="t">interrupt stage</span>, which is added to the <span class="t">instruction cycle</span> right after execute.' }))),
            h('div', { class: 'stack gap-s' },
              h('div', { class: 'row gap-s' }, nextBtn, irqBtn),
              h('div', { class: 'row gap-s' }, autoBtn, enSeg, resetBtn),
              h('div', { class: 'grid-2', style: { gridTemplateColumns: 'minmax(0,5fr) minmax(0,6fr)', gap: '10px' } },
                h('div', { class: 'card cpu tight stack gap-s' }, h('h4', { class: 'm0' }, 'Processor registers'),
                  h('div', { class: 'kv' }, h('span', {}, h('span', { class: 't', 'data-t': 'Program counter (PC)' }, 'PC')), vPC,
                    h('span', {}, h('span', { class: 't', 'data-t': 'Instruction register (IR)' }, 'IR')), vIR, vMean,
                    h('span', {}, h('span', { class: 't', 'data-t': 'Program status word (PSW)' }, 'PSW')), vPSW, h('span', {}, 'Pending'), h('span', {}, lamp, ' ', vPend)),
                  h('div', { class: 'small' }, h('span', { class: 't', 'data-t': 'Control stack' }, 'Control stack'), ': ', vStack)),
                memTbl),
              vCount, log)));
          say('Press “Run next stage”, raise an interrupt at any moment, and watch <i>when</i> the processor notices it.');
          paint();
        },
      },

      /* ============ 6. The nine steps of interrupt processing ============ */
      {
        title: 'Nine steps: what exactly happens during an interrupt',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          /* ---- the frames: full machine state after each step ---- */
          const R0 = { PC: '401', PSW: 'user, int on', SP: '1000', R1: '17', R2: '42', R3: '8' };
          const PSW0 = 'PSW (user, int on)';
          const F = [];
          const add = (patch, cap) => {             // each frame = previous frame + the changes this step makes
            const prev = F[F.length - 1] || { regs: R0, stack: {}, irq: false, ack: false, prn: 'printing a line …', mem: 400 };
            const { regs, stack, arrows, ...rest } = patch;
            F.push(Object.assign({}, prev, rest, { regs: Object.assign({}, prev.regs, regs || {}), stack: stack || prev.stack, arrows: arrows || [], cap }));
          };
          add({}, '<b>Before.</b> The user program is running. The processor is executing the instruction at <b>N = 400</b> (ADD R1, R2), so the PC already holds the next address, <b>N+1 = 401</b>. The printer is busy.');
          add({ irq: true, prn: 'done! request line raised' }, '<b>Step 1 · hardware.</b> The printer finishes its line and raises its <b>interrupt request</b>. Nothing inside the processor has changed yet.');
          add({ regs: { R1: '59' } }, '<b>Step 2 · hardware.</b> The processor <b>finishes the current instruction</b>: the ADD completes, so R1 becomes 17 + 42 = 59. An instruction is never abandoned halfway.');
          add({ irq: false, ack: true, prn: 'acknowledged: request dropped' }, '<b>Step 3 · hardware.</b> In the interrupt stage the processor finds the pending request and sends an <b>acknowledgment</b>. The printer lowers its request line.');
          add({ regs: { SP: '998' }, stack: { 999: PSW0, 998: 'PC = 401' }, ack: false, arrows: [['PSW', 999], ['PC', 998]] }, '<b>Step 4 · hardware.</b> The processor pushes the <b>PSW</b> and the <b>PC (401)</b> onto the control stack; the <span class="t" data-t="Stack pointer (SP)">stack pointer</span> moves from 1000 down to 998. These two must be saved first because the next step overwrites them.');
          add({ regs: { PC: '900', PSW: 'kernel, int off' }, mem: 900, arrows: [[900, 'PC']] }, '<b>Step 5 · hardware.</b> The processor loads the PC with the right handler’s start address, <b>Y = 900</b> (it learns which handler from the interrupt signal or by asking the device), and switches to <span class="t">kernel mode</span> with interrupts disabled. The next fetch comes from the handler.');
          add({ regs: { SP: '995' }, stack: { 999: PSW0, 998: 'PC = 401', 997: 'R1 = 59', 996: 'R2 = 42', 995: 'R3 = 8' }, arrows: [['R1', 997], ['R2', 996], ['R3', 995]] }, '<b>Step 6 · software.</b> The handler’s first instructions push R1, R2 and R3 onto the stack (SP → 995). The program’s whole <span class="t" data-t="Context (processor state)">context</span> is now safe.');
          add({ regs: { R1: '1', R2: '7', R3: '0' }, mem: 901, prn: 'printing the next line …' }, '<b>Step 7 · software.</b> The handler does the real work: it reads the printer’s status and sends the next line. It uses R1–R3 freely, overwriting the program’s values.');
          const OLD3 = { 997: 'R1 = 59', 996: 'R2 = 42', 995: 'R3 = 8' };
          add({ regs: { R1: '59', R2: '42', R3: '8', SP: '998' }, stack: { 999: PSW0, 998: 'PC = 401' }, stale: OLD3, mem: 902, arrows: [[995, 'R3'], [996, 'R2'], [997, 'R1']] }, '<b>Step 8 · software.</b> The handler pops the saved values back into R3, R2 and R1 (SP → 998). R1 holds 59 again. The old copies stay in memory (faded), but they now count as free space.');
          add({ regs: { PC: '401', PSW: 'user, int on', SP: '1000' }, stack: {}, stale: Object.assign({ 999: PSW0, 998: 'PC = 401' }, OLD3), mem: 903, arrows: [[998, 'PC'], [999, 'PSW']] }, '<b>Step 9 · software.</b> The handler ends with a special return-from-interrupt instruction that pops the PC and PSW (SP → 1000). PC = 401, user mode, interrupts on.');
          add({ mem: 401 }, '<b>Resumed.</b> The processor fetches the instruction at N + 1 = 401. The program carries on exactly where it stopped and never knew it was interrupted.');
          /* ---- geometry ---- */
          const REGS = ['PC', 'PSW', 'SP', 'R1', 'R2', 'R3'];
          const regY = (r) => 148 + REGS.indexOf(r) * 34;
          /* [address, instruction, tag, plain-language comment] */
          const MEM = [[400, 'ADD R1, R2', 'N', 'R1 ← R1 + R2'], [401, 'STORE R1, [sum]', 'N+1', 'copy R1 into sum'], [402, 'JUMP 380', '', 'go back to 380'],
            [900, 'SAVE registers', 'Y', 'push R1, R2, R3'], [901, 'READ printer status', '', 'serve printer'], [902, 'RESTORE registers', '', 'pop R3, R2, R1'], [903, 'RETURN from interrupt', '', 'pop PC + PSW']];
          const memY = { 400: 54, 401: 74, 402: 94, 900: 142, 901: 162, 902: 182, 903: 202 };
          const stkY = (a) => 252 + (999 - a) * 20;
          const anchor = (k) => (typeof k === 'string' ? [242, regY(k) + 14] : k >= 995 && k <= 999 ? [330, stkY(k) + 10] : [300, memY[k] + 10]);   // program/handler rows: start left of the N / Y tag
          const svg = s('svg', { viewBox: '0 0 660 372', width: '100%' });
          function draw(i) {
            const f = F[i], p = F[Math.max(0, i - 1)];
            const kids = [
              s('rect', { x: 10, y: 8, width: 232, height: 64, rx: 10, class: 's-io', 'stroke-width': 2 }),
              s('text', { x: 24, y: 32, class: 't15 bold', style: 'fill:var(--io)' }, 'Printer (I/O device)'), s('text', { x: 24, y: 56, class: 't14' }, f.prn),
              s('line', { x1: 70, y1: 74, x2: 70, y2: 106, 'stroke-width': f.irq ? 4 : 2, style: `stroke:var(--${f.irq ? 'intr' : 'line-2'})`, 'marker-end': `url(#arr-${f.irq ? 'intr' : 'muted'})` }),
              s('text', { x: 78, y: 96, class: 't13', style: `fill:var(--${f.irq ? 'intr' : 'muted'})` }, 'request'),
              s('line', { x1: 190, y1: 110, x2: 190, y2: 78, 'stroke-width': f.ack ? 4 : 2, style: `stroke:var(--${f.ack ? 'cpu' : 'line-2'})`, 'marker-end': `url(#arr-${f.ack ? 'cpu' : 'muted'})` }),
              s('text', { x: 198, y: 96, class: 't13', style: `fill:var(--${f.ack ? 'cpu' : 'muted'})` }, 'ack'),
              s('rect', { x: 10, y: 112, width: 232, height: 240, rx: 12, class: 's-cpu', 'stroke-width': 2 }),
              s('text', { x: 24, y: 136, class: 't15 bold', style: 'fill:var(--cpu)' }, 'Processor'),
              s('rect', { x: 296, y: 4, width: 358, height: 362, rx: 12, class: 's-mem', 'stroke-width': 2 }),
              s('text', { x: 306, y: 24, class: 't15 bold', style: 'fill:var(--mem)' }, 'Main memory'),
              s('text', { x: 334, y: 48, class: 't13 bold' }, 'User program'), s('text', { x: 334, y: 136, class: 't13 bold' }, 'Interrupt handler (OS)'),
              s('text', { x: 334, y: 246, class: 't13 bold' }, 'Control stack (T = 1000, grows down)'),
            ];
            REGS.forEach((r) => {
              const y = regY(r), ch = f.regs[r] !== p.regs[r] && i > 0;
              kids.push(s('text', { x: 24, y: y + 19, class: 't14 bold' }, r),
                s('rect', { x: 70, y, width: 164, height: 28, rx: 6, class: ch ? 's-accent glow' : 's-panel', 'stroke-width': ch ? 3 : 1.5 }),
                s('text', { x: 78, y: y + 19, class: 't14 s-monot' + (ch ? ' bold' : '') }, f.regs[r]));
            });
            MEM.forEach(([a, txt, tag, note]) => {
              const y = memY[a], on = f.mem === a;
              kids.push(s('rect', { x: 332, y, width: 316, height: 20, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 2.5 : 1 }),
                s('text', { x: 338, y: y + 15, class: 't13 s-monot' }, String(a)), s('text', { x: 382, y: y + 15, class: 't13 s-monot' + (on ? ' bold' : '') }, txt),
                s('text', { x: 642, y: y + 15, class: 't13 end s-sub', style: 'font-style:italic' }, note));
              if (tag) kids.push(s('text', { x: 328, y: y + 15, class: 't13 end bold', style: 'fill:var(--os)' }, tag));   // N, N+1 or Y label
            });
            for (let a = 999; a >= 995; a--) {
              const y = stkY(a), v = f.stack[a], fresh = v && p.stack[a] !== v && i > 0, old = !v && f.stale && f.stale[a];
              kids.push(s('rect', { x: 332, y, width: 316, height: 20, class: fresh ? 's-accent' : v ? 's-panel' : 's-muted', 'stroke-width': fresh ? 2.5 : 1 }),
                s('text', { x: 338, y: y + 15, class: 't13 s-monot' }, String(a)),
                s('text', { x: 382, y: y + 15, class: 't13 s-monot' + (v ? '' : ' s-sub'), style: old ? 'opacity:.6;font-style:italic' : null }, v || old || '(free)'),
                s('text', { x: 596, y: y + 15, class: 't13 end s-sub' }, 'T−' + (1000 - a)));
            }
            const sp = +f.regs.SP, spY = sp === 1000 ? 241 : stkY(sp) + 10;
            kids.push(s('text', { x: 646, y: spY + 5, class: 't13 end bold', style: 'fill:var(--cpu)' }, '◂ SP'));
            f.arrows.forEach(([a, b]) => {
              const [x1, y1] = anchor(a), [x2, y2] = anchor(b), toMem = typeof b !== 'string';
              const xa = toMem ? x1 : x1, xb = toMem ? x2 - 2 : x2 + 2;
              kids.push(s('path', { d: `M${xa},${y1} C${(xa + xb) / 2},${y1} ${(xa + xb) / 2},${y2} ${xb},${y2}`, fill: 'none', 'stroke-width': 2.5, style: 'stroke:var(--accent)', 'marker-end': 'url(#arr-accent)' }));
            });
            svg.replaceChildren(...kids);
            items.forEach((li, k) => { li.classList.toggle('on', k + 1 === i); li.classList.toggle('done', k + 1 < i || i === 10); });
            return f.cap;
          }
          const STEPS = ['A device raises an <b>interrupt signal</b>.', 'The processor <b>finishes the current instruction</b>.', 'It <b>tests for a pending interrupt</b> and sends an <b>acknowledgment</b> to the device.',
            'It <b>pushes the PSW and PC</b> onto the control stack.', 'It <b>loads the PC</b> with the handler’s start address.',
            'The handler <b>saves the remaining registers</b>.', 'The handler <b>processes the interrupt</b>.', 'The saved <b>registers are restored</b>.', 'The <b>PSW and PC are restored</b>; the program resumes.'];
          const items = STEPS.map((t, k) => h('li', { class: k < 5 ? 'hw' : 'sw', role: 'button', tabindex: 0, style: { cursor: 'pointer' }, onclick: () => { player.stop(); player.go(k + 1); },
            onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); player.stop(); player.go(k + 1); } } },
            h('span', { class: 'n' }, String(k + 1)), h('span', { html: t })));
          const player = ctx.ui.player({ count: F.length, render: draw, interval: 3200 });
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack gap-s' }, h('div', { class: 'card white tight' }, panWrap(ctx, svg, 620)), player.el),
            h('div', { class: 'card stack gap-s' },
              h('div', { class: 'grp', style: { color: 'var(--cpu)' } }, 'Hardware: the processor does these by itself'),
              h('ol', { class: 'isteps' }, ...items.slice(0, 5)),
              h('div', { class: 'grp', style: { color: 'var(--os)' } }, 'Software: the interrupt handler (OS)'),
              h('ol', { class: 'isteps' }, ...items.slice(5)),
              h('p', { class: 'small m0', style: { marginTop: 'auto', lineHeight: '1.4' }, html: '<b>Labels:</b> <b>N</b> = the instruction running when the interrupt arrives, <b>N+1</b> = the next one, where the program resumes, and <b>Y</b> = the handler’s first instruction. <b>PSW</b> “user, int on” = user mode (an ordinary program is running) with interrupts enabled.' }),
              h('p', { class: 'xs muted m0' }, 'Click any step to jump to it. Values that just changed glow.'))));
        },
      },

      /* ============ 7. Multiple interrupts: two policies + predictions ============ */
      {
        title: 'Two interrupts at once? Predict what the processor does',
        kind: 'predict',
        html: `
          <div class="split l fill">
            <div class="stack gap-s">
              <p class="m0">What if a second request arrives while a handler is still running? There are two classic answers.</p>
              <div class="card os tight"><h3 style="font-size:17px">Approach 1 · Disable interrupts</h3>
                <p class="small m0">While any handler runs, the processor <span class="t" data-t="Disabled interrupts">ignores new requests</span>; they stay <span class="t" data-t="Pending interrupt">pending</span>. When the handler finishes, interrupts are enabled again and the waiting requests are served strictly one after another (in this guide, oldest first). Simple, but it <b>ignores priority</b>: a time-critical device may wait too long.</p></div>
              <div class="card intr tight"><h3 style="font-size:17px">Approach 2 · Priorities and nesting</h3>
                <p class="small m0">Each source gets an <span class="t">interrupt priority</span>. A higher-priority request may interrupt a lower-priority handler, whose state is saved exactly like a user program’s. A lower-priority request waits until the higher-priority handlers are done. These are <span class="t">nested interrupts</span>.</p></div>
              <div class="card tight">
                <h4>Scenario · each handler needs 10 time units</h4>
                <table class="tbl compact"><tr><th>Device</th><th>Priority</th><th>Interrupts at</th></tr>
                  <tr><td>Printer</td><td>2 (lowest)</td><td>t = 10</td></tr><tr><td>Comm line</td><td>5 (highest)</td><td>t = 15</td></tr><tr><td>Disk</td><td>4</td><td>t = 20</td></tr></table>
              </div>
            </div>
            <div class="card white stack gap-s s14-pred"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const sim = simMulti({ P: 10, D: 20, C: 15 }, 'nested');
          const QS = [
            { T: 20, q: 'At <b>t = 20</b> the disk (priority 4) interrupts while the comm line handler (priority 5) is running. What runs from t = 20 to t = 25?',
              choices: ['The disk handler: it just arrived', 'The comm line handler keeps running', 'The printer handler resumes', 'The user program'], answer: 1,
              fb: ['The disk’s priority (4) is lower than the running comm handler’s (5), so it cannot interrupt it. Its request stays pending.', 'Right. 5 > 4, so the comm handler keeps the processor and the disk request waits, pending.',
                'The printer handler is suspended underneath the comm handler. It cannot run until everything above it finishes.', 'The user program is at the bottom of the stack. It runs only when all three handlers are done.'] },
            { T: 25, q: 'At <b>t = 25</b> the comm line handler finishes. The printer handler is suspended and the disk request is pending. What runs next?',
              choices: ['The printer handler: it was interrupted first', 'The disk handler', 'The user program', 'The comm line handler again'], answer: 1,
              fb: ['Tempting, since the printer was there first, but the pending disk request has priority 4 > 2, so it is served before the printer handler resumes.', 'Right. Before returning to the printer handler (priority 2) the processor finds the pending disk request (priority 4), which outranks it.',
                'Two handlers are unfinished. The user program runs only when nothing is pending or suspended.', 'The comm handler is finished and its device has not interrupted again.'] },
            { T: 35, q: 'At <b>t = 35</b> the disk handler finishes. At what time does the <b>user program</b> get the processor back?',
              choices: ['t = 30', 't = 35', 't = 40', 't = 45'], answer: 2,
              fb: ['Three handlers of 10 units each start no earlier than t = 10, so the user program cannot resume before t = 40.', 'At 35 the printer handler still has 5 units of work left (it only ran from 10 to 15).', 'Right. The printer handler resumes at 35, does its last 5 units and finishes at 40. Then the user program resumes.',
                'The printer handler already did 5 of its 10 units (t = 10 to 15), so it needs only 5 more after t = 35.'] },
          ];
          const box = ctx.$('.s14-pred');
          const prog = h('div', { class: 'small b muted' });
          const qText = h('div', { class: 'b', style: { fontSize: '17px', lineHeight: '1.4' } });
          const choiceBox = h('div', { class: 'pq-choices' });
          const fb = h('div', { class: 'fb', style: { minHeight: '64px' } });
          const nextBtn = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { if (k < QS.length - 1) { k++; show(); } else finish(); } });
          const NW = ctx.narrow, svg = s('svg', { viewBox: `0 0 ${NW ? 420 : 640} ${NW ? 222 : 258}`, width: '100%' });
          let k = 0, right = 0;
          const drawG = (T) => svg.replaceChildren(...ganttNodes(s, sim, { x0: NW ? 72 : 112, x1: NW ? 410 : 628, y0: 26, laneH: NW ? 34 : 43, tmax: 45, T, veil: 1, short: NW, tick: NW ? 10 : 5 }));   // opaque: no peeking at the answer
          function show() {
            const Q = QS[k];
            prog.textContent = `Prediction ${k + 1} of ${QS.length}`;
            qText.innerHTML = Q.q;
            fb.innerHTML = '<span class="muted">Commit to an answer. The chart shows everything up to this moment.</span>';
            choiceBox.replaceChildren(...Q.choices.map((c, i) => h('button', { class: 'btn', type: 'button', onclick: (e) => pick(i, e.currentTarget) }, c)));
            nextBtn.style.visibility = 'hidden';
            drawG(Q.T);
          }
          function pick(i, btn) {
            const Q = QS[k];
            if (choiceBox.dataset.done === String(k)) return;
            choiceBox.dataset.done = String(k);
            const ok = i === Q.answer; if (ok) right++;
            btn.classList.add(ok ? 'right' : 'wrong');
            choiceBox.children[Q.answer].classList.add('right');
            [...choiceBox.children].forEach((b) => b.setAttribute('aria-disabled', 'true'));   // stay readable; pick() ignores repeats
            fb.innerHTML = `<b style="color:var(--${ok ? 'ok' : 'bad'})">${ok ? '✓' : '✗'}</b> ${Q.fb[i]}`;
            drawG(k < QS.length - 1 ? QS[k + 1].T : null);
            nextBtn.textContent = k < QS.length - 1 ? 'Next prediction →' : 'Show the whole timeline →';
            nextBtn.style.visibility = 'visible';
          }
          function finish() {
            prog.textContent = `Done: ${right} of ${QS.length} predictions right`;
            qText.innerHTML = 'The whole story: printer at 10, comm preempts at 15, disk waits at 20, disk runs at 25, printer resumes at 35, user program back at 40.';
            choiceBox.replaceChildren();
            fb.innerHTML = 'Notice the comm line waited <b>0</b> units and the disk <b>5</b>, while the printer, the least urgent, finished last. With interrupts simply disabled, the comm line would have waited 5 units. Compare both policies on the next step.';
            nextBtn.textContent = 'Try again'; nextBtn.style.visibility = 'visible';
            drawG(null);
            k = -1; right = 0; delete choiceBox.dataset.done;   // the next click does k++ → 0 and restarts
          }
          const legend = h('div', { class: 'row gap-s xs', style: { marginTop: 'auto' } }, h('span', { class: 'chip intr' }, 'handler running'), h('span', { class: 'chip proc' }, 'user program'),
            h('span', { class: 'chip warn' }, 'pending'), h('span', { class: 'chip' }, 'suspended'), h('span', { class: 'chip bad' }, '▼ request arrives'));
          box.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, prog, nextBtn), qText, choiceBox, fb, legend, svg);
          show();
        },
      },

      /* ============ 8. Lab: sequential vs nested, student sets the arrivals ============ */
      {
        title: 'Lab: disabled vs nested, you choose when devices interrupt',
        kind: 'lab',
        render(el, ctx) {
          const { h, s } = ctx;
          let mode = 'nested', sim, frames;
          const arr = { P: 10, C: 15, D: 20 };
          const NW = ctx.narrow, G = { x0: NW ? 72 : 112, x1: NW ? 410 : 648, y0: 30, laneH: NW ? 40 : 52, tmax: 70, short: NW, tick: NW ? 10 : 5 };
          const svg = s('svg', { viewBox: `0 0 ${NW ? 420 : 660} ${NW ? 260 : 308}`, width: '100%' });
          const tbody = h('tbody');
          function build() {
            sim = simMulti(arr, mode);
            const w = (d) => sim.info[d].start - sim.info[d].arrive, cw = w('C'), ok = cw <= MI.DEADLINE;
            const suspended = ['C', 'D', 'P'].map((d) => [d, sim.susp.filter((x) => x.who === d).reduce((n, x) => n + x.e - x.s, 0)]).filter(([, n]) => n > 0).map(([d, n]) => `${MI.NAME[d]} ${n}`);
            frames = [{ T: 0, html: `<b>t = 0.</b> The user program is running. Policy: <b>${mode === 'nested' ? 'nested interrupts with priorities' : 'interrupts disabled while a handler runs'}</b>.` },
              ...sim.moments.map((m) => ({ T: m.t, html: `<b>t = ${m.t}.</b> ${m.html}` })),
              { T: null, html: `<b>Summary.</b> Waits before a handler starts: comm line ${cw}, disk ${w('D')}, printer ${w('P')}. ` +
                (suspended.length ? `Suspended partway through: ${suspended.join(', ')} units. ` : '') + `The user program is back at t = ${sim.end}. ` +
                (ok ? `The comm line was served within its ${MI.DEADLINE}-unit limit, so no data was lost.` : `The comm line waited ${cw} units, over its ${MI.DEADLINE}-unit limit: incoming characters would be overwritten and lost.`) }];
            tbody.replaceChildren(...['C', 'D', 'P'].map((d) => {
              const f = sim.info[d], late = d === 'C' && !ok;
              return h('tr', { class: late ? 'on' : null }, h('td', { class: 'b', style: { whiteSpace: 'nowrap' } }, `${cap1(MI.NAME[d])} (${MI.PR[d]})`), h('td', {}, String(f.arrive)), h('td', {}, String(f.start)), h('td', {}, String(f.finish)),
                h('td', {}, h('span', { class: 'chip ' + (d === 'C' ? (ok ? 'ok' : 'bad') : w(d) ? 'warn' : 'ok') }, String(w(d)) + (d === 'C' ? (ok ? ' ✓' : ' ✗ late') : ''))));
            }));
          }
          function draw(i) {
            const f = frames[i];
            const K = (G.x1 - G.x0) / G.tmax, xd = G.x0 + Math.min(G.tmax, arr.C + MI.DEADLINE) * K;
            const kids = ganttNodes(s, sim, Object.assign({ T: f.T }, G));
            kids.push(s('line', { x1: xd, y1: G.y0 - 2, x2: xd, y2: G.y0 + G.laneH + 2, 'stroke-width': 2, 'stroke-dasharray': '3 3', style: 'stroke:var(--bad)' }),   // comm line's deadline
              s('text', { x: xd + 4, y: G.y0 - 5, class: 't13 bold', style: 'fill:var(--bad)' }, 'limit'));
            svg.replaceChildren(...kids);
            return f.html;
          }
          build();
          const player = ctx.ui.player({ count: frames.length, render: draw, interval: 2600, start: frames.length - 1 });
          const refresh = () => { build(); player.stop(); player.setCount(frames.length); player.go(frames.length - 1); };
          const seg = ctx.ui.seg([{ value: 'seq', label: 'Disabled (sequential)' }, { value: 'nested', label: 'Nested with priorities' }], mode, (v) => { mode = v; refresh(); });
          const sliders = {};
          [['P', 'Printer (2) at'], ['C', 'Comm line (5) at'], ['D', 'Disk (4) at']].forEach(([d, label]) => {
            sliders[d] = ctx.ui.slider({ label, min: 0, max: 40, value: arr[d], format: (v) => 't = ' + v, onInput: (v) => { arr[d] = v; refresh(); } });
          });
          const preset = (p, c, d) => () => { arr.P = p; arr.C = c; arr.D = d; Object.entries(sliders).forEach(([k, sl]) => sl.set(arr[k])); refresh(); };
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack gap-s' },
              h('div', { class: 'card white tight' }, svg,
                h('div', { class: 'row gap-s xs', style: { marginTop: '4px' } }, h('span', { class: 'chip intr' }, 'handler running'), h('span', { class: 'chip proc' }, 'user program'),
                  h('span', { class: 'chip warn' }, 'pending (not started)'), h('span', { class: 'chip' }, 'suspended (preempted)'), h('span', { class: 'chip bad' }, '▼ request arrives'))),
              player.el),
            h('div', { class: 'card stack gap-s' },
              h('h4', { class: 'm0' }, 'Policy'), seg,
              h('h4', { class: 'm0', style: { marginTop: '4px' } }, 'When does each device interrupt?'),
              sliders.P, sliders.C, sliders.D,
              h('div', { class: 'row gap-s' }, h('button', { class: 'btn sm', type: 'button', onclick: preset(10, 15, 20) }, 'Classic 10 / 15 / 20'),
                h('button', { class: 'btn sm', type: 'button', onclick: preset(5, 12, 8) }, 'Rising urgency'), h('button', { class: 'btn sm', type: 'button', onclick: preset(5, 5, 5) }, 'All at once')),
              h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, ...['Device', 'Arrives', 'Starts', 'Done', 'Waited'].map((x) => h('th', {}, x)))), tbody),
              h('div', { class: 'callout why m0 small', 'data-label': 'The trade-off' }, 'Nesting serves urgent devices fast; low-priority handlers finish later. A printer can wait, a communications line cannot: here its handler must start within ',
                h('b', {}, MI.DEADLINE + ' units'), ' of the request (red dashed “limit” line) or the next incoming character overwrites the waiting one.'))));
        },
      },

      /* ============ 9. Recap ============ */
      {
        title: 'Recap: six ideas to carry forward',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          const chain = [['cpu', 'Signal'], ['cpu', 'Finish instruction'], ['cpu', 'Acknowledge'], ['cpu', 'Push PSW + PC'], ['cpu', 'PC ← handler'],
            ['os', 'Save registers'], ['os', 'Service device'], ['os', 'Restore registers'], ['os', 'Pop PSW + PC']];
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['Why do interrupts exist?', 'One I/O operation can last as long as a hundred thousand to over a hundred million instructions. Interrupts let the processor start a device and keep doing useful work, raising processor utilization.'],
              ['What are the four classes?', '<b>Program</b> (overflow, divide by zero, illegal instruction, bad memory reference), <b>timer</b>, <b>I/O</b>, and <b>hardware failure</b>.'],
              ['What is the interrupt stage?', 'A check after execute. If interrupts are enabled and one is pending: save the context and load the PC with the handler’s address. Otherwise fetch the next instruction.'],
              ['Who saves what?', 'Hardware pushes the <b>PSW and PC</b> and loads the handler address. The handler saves and restores the <b>other registers</b>. Return-from-interrupt pops PC and PSW.'],
              ['Short vs long I/O wait?', 'Short: the device finishes while user code runs, so there is no idle time. Long: the next WRITE arrives before the last one is done, so some waiting remains.'],
              ['Disabled vs nested?', 'Disabled: simple, requests wait (pending) and are served strictly one after another, ignoring priority. Nested: a higher-priority request may interrupt a lower-priority handler.'],
            ], { cols: 3, height: 172 }),
            h('div', { class: 'card tight', style: { marginTop: 'auto' } },
              h('h4', {}, 'The nine steps in one line: blue = hardware, violet = interrupt handler'),
              h('div', { class: 'row gap-s' }, ...chain.flatMap(([c, t], i) => [h('span', { class: 'box ' + c, style: { padding: '5px 8px', fontSize: '14px' } }, `${i + 1}. ${t}`), i < chain.length - 1 ? h('span', { class: 'muted' }, '→') : null]))),
          ));
        },
      },

      /* ============ 10. Check yourself ============ */
      {
        title: 'Check yourself: interrupts',
        kind: 'check',
        quiz: [
          { q: 'What is the main reason computers use interrupts?',
            choices: ['To keep the processor doing useful work while slow I/O devices operate', 'To make I/O devices run faster', 'To let one user program call another', 'To stop programs from reading each other’s memory'], answer: 0,
            feedback: [null, 'Interrupts do not speed up the device at all; they stop the processor from wasting time waiting for it.', 'Calling another program is an ordinary procedure call or system service, not the purpose of interrupts.', 'Memory protection is a separate mechanism (a violation may cause a program interrupt, but that is not why interrupts exist).'],
            why: 'I/O devices are far slower than the processor. With interrupts the processor starts an I/O operation, runs other instructions, and is told when the device is done, which raises processor utilization.' },
          { type: 'bucket', q: 'Sort each event into its class of interrupt.', buckets: ['Program', 'Timer', 'I/O', 'Hardware failure'],
            items: [['Division by zero', 0], ['Illegal instruction', 0], ['Regular clock tick', 1], ['Printer finished a line', 2], ['Disk reports a read error', 2], ['Memory parity error', 3]],
            why: 'Program interrupts come from the executing instruction; timer interrupts from the processor’s clock; I/O interrupts from an I/O module (completion or error); hardware-failure interrupts from physical faults such as power loss or parity errors.' },
          { type: 'order', q: 'Put the stages of interrupt processing in order. (The handler’s save, process and restore steps are combined into one item.)',
            items: ['Device issues an interrupt signal', 'Processor finishes the current instruction', 'Processor tests for a pending interrupt and acknowledges it', 'Processor pushes the PSW and PC onto the control stack', 'Processor loads the PC with the handler’s start address', 'Handler saves registers, processes the interrupt, restores registers', 'PSW and PC are restored from the stack'],
            why: 'The full list has nine steps. Steps 1–5 are hardware: signal, finish the instruction, test and acknowledge, push PSW and PC, load the handler address. Steps 6–9 belong to the handler: save registers, process the interrupt, restore registers, restore PSW and PC. The stack is last-in, first-out, so things come off in the reverse order they went on.' },
          { q: 'Interrupts are disabled whenever a handler runs. The printer handler (lowest priority) starts at t = 10 and needs 10 time units. At t = 12 the communications line (highest priority) interrupts. When does the comm line handler start?',
            choices: ['t = 12, because it has the higher priority', 't = 20', 't = 22', 'Never: a request that arrives while interrupts are disabled is lost'], answer: 1,
            feedback: ['That is what nesting with priorities would do. With interrupts disabled, a running handler cannot be interrupted, whatever the priority.', null, 'There is no extra delay: as soon as the printer handler finishes at t = 20 and interrupts are enabled again, the pending request is accepted.', 'A request that arrives while interrupts are disabled is not lost. It stays pending until interrupts are enabled again.'],
            why: 'With the disable approach, requests are handled strictly one after another. The comm line waits 8 units behind a less urgent handler, which is exactly the weakness of this approach: it ignores priority and time-critical needs.' },
          { type: 'num', q: 'A program runs three code segments of 10 time units each, with a WRITE between them (two WRITEs). Each WRITE costs 2 units of prep, and the printer then needs 6 units per line. <b>Without interrupts</b> the processor waits out the 6 units and then runs 2 units of completion code. <b>With interrupts</b> the printer works while user code runs, and each completion costs a 3-unit handler (the completion code plus saving and restoring the context). Each line finishes before the next WRITE. How many time units do interrupts save?',
            answer: 10, tol: 0, unit: 'units', why: 'Without: 3 × 10 + 2 × (2 + 6 + 2) = 50. With: the waits disappear, so 3 × 10 + 2 × 2 (prep) + 2 × 3 (handlers) = 40, with no idle time. Saved: 50 − 40 = 10 units. The handler costs 1 unit more than plain completion code, but that is far less than the 6-unit wait it hides.' },
          { q: 'Which values does the processor <b>hardware</b> push onto the control stack when it accepts an interrupt?',
            choices: ['The PSW and the program counter', 'Every general-purpose register', 'Only the stack pointer', 'The whole user program'], answer: 0,
            feedback: [null, 'The other registers are saved by the interrupt handler (software), because only the handler knows which registers it will use.', 'The stack pointer is what moves when things are pushed; it is not itself pushed at this point.', 'The program stays in memory where it is; only the information needed to resume it is saved.'],
            why: 'The PSW and PC must be saved by hardware because loading the handler address immediately overwrites the PC. The handler then saves whatever other registers it needs.' },
          { type: 'num', q: 'The stack pointer holds 1000 and the stack grows toward lower addresses, one word per item. The processor pushes the PSW and PC, then the handler pushes 4 registers. What address does SP hold now?',
            answer: 994, tol: 0, why: 'Six items are pushed in total (PSW, PC and 4 registers), so SP moves down from 1000 to 1000 − 6 = 994.' },
          { type: 'num', q: 'Without interrupts, a program runs three code segments of 10 time units each, with a WRITE between them (two WRITEs). Each WRITE needs 2 units of prep, 20 units of printing during which the processor just waits, and 2 units of completion. What is the total time?',
            answer: 78, tol: 0, unit: 'units', why: 'Code: 3 × 10 = 30. Each WRITE: 2 + 20 + 2 = 24, and there are two, so 48. Total 30 + 48 = 78 time units, of which 40 are pure waiting.' },
          { q: 'Priorities: printer 2, disk 4, comm line 5 (higher is more urgent), with nesting allowed. The printer handler is running when the comm line interrupts; then the disk interrupts while the comm handler runs. When the comm handler finishes, what runs next?',
            choices: ['The disk handler', 'The printer handler, since it was interrupted first', 'The user program', 'The comm line handler again'], answer: 0,
            feedback: [null, 'The printer handler (2) is suspended, but the pending disk request (4) outranks it, so the disk is served first.', 'Two handlers are still unfinished; the user program resumes only when all of them are done.', 'The comm handler has finished and nothing new came from the comm line.'],
            why: 'On finishing a handler, the processor serves the highest-priority request that outranks what it would return to. The disk (4) beats the suspended printer handler (2); the printer resumes after the disk finishes.' },
          { type: 'multi', q: 'Which statements about the interrupt stage are true? Select all that apply.',
            choices: ['It follows the execute stage of the instruction cycle', 'It is skipped when interrupts are disabled', 'It interrupts an instruction halfway to respond faster', 'If a request is pending, the context is saved and the PC is set to the handler’s start address'], answer: [0, 1, 3],
            why: 'The interrupt stage comes after execute and is skipped when interrupts are disabled. It never splits an instruction; if a request is pending it saves the context and points the PC at the handler.' },
          { type: 'match', q: 'Match each item to its role.',
            pairs: [['Program counter (PC)', 'Holds the address of the next instruction'], ['Program status word (PSW)', 'Holds condition codes, the mode and the interrupt-enable bit'], ['Control stack', 'Memory where return addresses and registers are saved'], ['Interrupt handler', 'Routine that services the device that interrupted']],
            why: 'The PC and PSW describe where the program is and its status; the control stack stores them while the handler, the OS routine that services the device, runs.' },
          { q: 'A system uses interrupts. A program issues a WRITE, runs some code, then reaches its next WRITE while the printer is still busy with the first line. What happens?',
            choices: ['The processor waits until the first line is done (signalled by its interrupt), then starts the second', 'The second WRITE overwrites the first line in the printer', 'The OS throws the first line away', 'The printer prints both lines at the same time'], answer: 0,
            feedback: [null, 'The I/O program will not issue a new command to a busy device, so nothing is overwritten.', 'Nothing is discarded; the first operation is allowed to finish.', 'A printer handles one operation at a time.'],
            why: 'This is the long I/O wait case. Interrupts let code overlap the printing, but when the program needs the device again before it is free, the processor must wait for the completion interrupt.' },
        ],
      },
    ],

    notes: `
<h3>Why interrupts exist</h3>
<p>An <b>interrupt</b> is a signal that makes the processor set aside the running program, run an <b>interrupt handler</b> (ISR), then resume the program where it stopped. Interrupts exist mainly to improve <b>processor utilization</b>, the fraction of time the processor does useful work. I/O devices are far slower: at one instruction per nanosecond, printing a line (about 20 ms) lasts 20 million instruction-times. Without interrupts the processor idles through it; with them it starts the device and keeps working until the device signals it is done.</p>

<h3>The four classes of interrupts</h3>
<table>
<tr><th>Class</th><th>Where it comes from</th><th>Examples</th></tr>
<tr><td>Program</td><td>The instruction just executed</td><td>Arithmetic overflow, division by zero, illegal instruction, reference outside the program’s allowed memory</td></tr>
<tr><td>Timer</td><td>A clock inside the processor, at regular intervals</td><td>OS regains control periodically, even from an endless loop</td></tr>
<tr><td>I/O</td><td>An I/O module (device controller)</td><td>Operation done, device needs service, or an error (e.g. a disk read error)</td></tr>
<tr><td>Hardware failure</td><td>A physical fault</td><td>Power failure, memory parity error</td></tr>
</table>

<h3>Flow of control without and with interrupts</h3>
<p>A user program has code segments ①, ② and ③ with a WRITE call between them. Each WRITE calls the OS’s I/O program: <b>prep code ④</b> (get the data ready), the <b>I/O command</b> that starts the device, and <b>completion code ⑤</b> (check the result).</p>
<ul>
<li><b>No interrupts.</b> After the I/O command, the I/O program keeps checking the device until it finishes, runs ⑤, and only then returns. Every WRITE costs a full device time of idle processor.</li>
<li><b>Interrupts, short I/O wait.</b> After the I/O command, the I/O program returns at once and user code runs <i>in parallel</i> with the device. When the device finishes it interrupts partway through user code; the processor saves its place, runs the handler (which contains ⑤), and resumes. No idle time, and the user program contains no interrupt code.</li>
<li><b>Interrupts, long I/O wait.</b> If the device takes longer than the user code between WRITEs, the next WRITE finds it still busy, so the processor waits for the completion interrupt. Some idle time remains, but less than without interrupts.</li>
</ul>

<h3>Program timing: a worked example</h3>
<p>Let each user segment take 10 time units, prep ④ 2, completion ⑤ 2, and the printer D units per line. With interrupts each handler costs 3 units (⑤ plus 1 unit to save and restore the context).</p>
<ul>
<li><b>Without interrupts:</b> total = 3 × 10 + 2 × (2 + D + 2) = 38 + 2D, of which 2D is idle. D = 20 gives 78 units, 40 idle.</li>
<li><b>Short wait, D = 6:</b> 50 units (12 idle) without; with interrupts 3 × 10 + 2 × 2 + 2 × 3 = 40 units, 0 idle. Saved 10.</li>
<li><b>Long wait, D = 25:</b> 88 units (50 idle) without; 70 with, still 30 idle (at the 2nd WRITE and the last line). Saved 18.</li>
</ul>
<p>Handler overhead is small next to the waiting it removes; the gain vanishes only when D falls to the 1-unit overhead.</p>
<h3>Interrupts and the instruction cycle</h3>
<p>The basic cycle is fetch (copy the instruction the PC points to into the <b>instruction register (IR)</b> and add 1 to the PC) then execute. To support interrupts, an <b>interrupt stage</b> is added after execute: fetch → execute → interrupt check → fetch …</p>
<ul>
<li>If interrupts are <b>disabled</b>, the check is skipped and the next instruction is fetched. A request that arrives meanwhile is not lost; it stays <b>pending</b>.</li>
<li>If enabled and <b>none is pending</b>, the next instruction is fetched.</li>
<li>If enabled and <b>one is pending</b>, the processor suspends the program, saves its <b>context</b> (PC, PSW, registers) and sets the <b>PC</b> to the handler’s start address, so the next fetch comes from the handler. Later the context is restored and the program resumes.</li>
</ul>
<p>A device’s request never splits an instruction. The handler’s instructions are <b>overhead</b>, but far cheaper than waiting.</p>

<h3>Interrupt processing: the nine steps</h3>
<p>Recall: the <b>PC</b> holds the address of the next instruction; the <b>PSW</b> holds condition codes, the user/kernel mode bit and the interrupt-enable bit. The <b>control stack</b> is memory used last-in, first-out to save them.</p>
<p><b>Two details in the examples.</b> Real processors have many general-purpose registers (R1, R2, R3 …) instead of the single accumulator of the simple machine in 1.3, so instructions name the register they use, as in LOAD R1, [count]. The processor also has two modes, recorded in the PSW: ordinary programs run in the less-privileged <b>user mode</b>, and the OS, including every interrupt handler, runs in the privileged <b>kernel mode</b> (sections 2.2 and 3.4 explain modes fully). In the step-by-step example, <b>N</b> is the address of the instruction running when the interrupt arrives, <b>N + 1</b> is the next one (where the program resumes), and <b>Y</b> is the handler’s first instruction.</p>
<p><b>Hardware</b> (the processor, automatically):</p>
<ol>
<li>A device issues an interrupt signal to the processor.</li>
<li>The processor finishes executing the current instruction.</li>
<li>The processor tests for a pending interrupt, finds one, and sends the device an acknowledgment; the device drops its request.</li>
<li>The processor pushes the PSW and the PC onto the control stack; the next step overwrites them.</li>
<li>The processor loads the PC with the start address of the right interrupt handler (known from the signal, or by asking the device) and switches to privileged <b>kernel mode</b>.</li>
</ol>
<p><b>Software</b> (the OS interrupt handler):</p>
<ol start="6">
<li>The handler saves the rest of the processor state: the general registers it will use.</li>
<li>The handler processes the interrupt (e.g. reads the device status, sends more data).</li>
<li>The saved registers are restored from the stack.</li>
<li>The PSW and PC are restored from the stack by a return-from-interrupt instruction, so the program resumes at its next instruction.</li>
</ol>
<p><b>Worked example.</b> The program is executing the instruction at N = 400, so the PC already holds N + 1 = 401. The control stack starts at T = 1000 and grows toward lower addresses, one word per item. Step 4 pushes the PSW (to 999) and PC = 401 (to 998): SP goes 1000 → 998. Step 5 sets PC to the handler address Y = 900. Step 6 pushes R1, R2, R3: SP → 995. Step 8 pops them: SP → 998. Step 9 pops PC and PSW: SP → 1000, PC = 401. A pop only moves SP; old values stay in memory but count as free. Likewise, PSW, PC and 4 registers pushed from 1000 leave SP = 994.</p>

<h3>Multiple interrupts</h3>
<p><b>Approach 1: disable interrupts</b> while any handler runs. A request that arrives meanwhile is not lost: it stays pending, whatever its priority, until the handler ends and interrupts are re-enabled. Waiting requests are served strictly one at a time (here, oldest first). Simple, but it ignores priority. Example: printer handler t = 10–20, comm line interrupts at t = 12: the comm handler cannot start until t = 20, risking lost characters.</p>
<p><b>Approach 2: priorities with nesting.</b> Each source has a priority. A higher-priority request may interrupt a lower-priority handler (its state is saved on the stack); a lower-priority request waits, pending, until higher-priority handlers finish. When a handler ends, the processor serves the most urgent pending request that outranks what it would return to.</p>
<p><b>Classic example</b> (priorities: printer 2, disk 4, comm line 5; each handler needs 10 units):</p>
<table>
<tr><th>Time</th><th>Event</th><th>What runs</th></tr>
<tr><td>t = 10</td><td>Printer interrupts the user program</td><td>Printer handler</td></tr>
<tr><td>t = 15</td><td>Comm line interrupts; 5 &gt; 2, printer handler suspended</td><td>Comm handler</td></tr>
<tr><td>t = 20</td><td>Disk interrupts; 4 &lt; 5, so it waits (pending)</td><td>Comm handler continues</td></tr>
<tr><td>t = 25</td><td>Comm handler done; disk (4) outranks printer (2)</td><td>Disk handler</td></tr>
<tr><td>t = 35</td><td>Disk handler done; nothing pending</td><td>Printer handler resumes</td></tr>
<tr><td>t = 40</td><td>Printer handler done</td><td>User program resumes</td></tr>
</table>
<p>With interrupts disabled instead, the same arrivals give printer 10–20, comm 20–30 (a 5-unit wait for the most urgent device), disk 30–40. Nesting serves urgent devices fast; low-priority handlers finish later.</p>
`,
  });
})();
