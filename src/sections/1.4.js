// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 1.4  Interrupts
   Why devices interrupt the processor, the four classes of interrupts,
   flow of control and timing with/without interrupts, the interrupt
   stage of the instruction cycle, the nine steps of interrupt
   processing, and how multiple interrupts are handled.
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  /* ------------------------------------------------------------------
     Shared helpers (kept inside this IIFE so nothing leaks globally)
     ------------------------------------------------------------------ */
  /* Multiple-interrupt model used by steps 7 and 8.
     Three devices, each handler needs `svc` time units. Two policies:
       'seq'    interrupts disabled while any handler runs; waiting requests served oldest-first
       'nested' priorities; a higher-priority request suspends a lower-priority handler */
  const MI = {  // MI: fixed facts about the multiple-interrupt model shared by steps 7 and 8
    NAME: { U: 'user program', P: 'printer', D: 'disk', C: 'comm line' },  // display names for the four lanes: U = user program, P = printer, D = disk, C = comm line
    PR: { U: 0, P: 2, D: 4, C: 5 },  // priorities: a bigger number is more urgent; the user program has 0 so any handler outranks it
    LANES: [['C', 'Comm line · 5'], ['D', 'Disk · 4'], ['P', 'Printer · 2'], ['U', 'User program']],  // the timeline's lanes from top to bottom, each as [code, label with its priority]
    DEADLINE: 3,   // the comm line must be served within 3 units or incoming data is overwritten
  };  // closes the MI table
  const cap1 = (x) => x.charAt(0).toUpperCase() + x.slice(1);  // cap1(x): the same text with its first letter made uppercase, for sentences that start with a device name
  function simMulti(arr, mode, svc) {  // simMulti(arr, mode, svc): simulates three interrupts arriving at the times in arr, under the "seq" or "nested" policy
    svc = svc || 10;  // svc is how many time units each handler needs; 10 if not given
    const { PR, NAME } = MI, devs = ['P', 'D', 'C'];  // pulls the priorities and names out of MI; devs lists the three interrupting devices
    const left = { P: svc, D: svc, C: svc }, info = {};  // left counts each handler's remaining work; info will record each device's arrival, start and finish times
    devs.forEach((d) => (info[d] = { arrive: arr[d], start: null, finish: null }));  // every device starts with its arrival time and no start or finish yet
    const segs = [], susp = [], moments = [], stack = [], pending = [], suspAt = {};  // segs = who ran when; susp = when a handler was suspended; moments = narration; stack = what was interrupted; pending = waiting requests
    const tag = (d) => `<b>${NAME[d]}</b> (priority ${PR[d]})`, tagC = (d) => `<b>${cap1(NAME[d])}</b> (priority ${PR[d]})`;  // tag(d) writes a device's bold name with its priority; tagC(d) does the same with a capital first letter
    let run = 'U', finished = null, end = 0;  // run = who is using the processor now (starts with the user program); finished = the handler that just ended; end = last time
    for (let t = 0; t < 400; t++) {  // steps through time one unit at a time; the limit of 400 is only a safety stop
      const lines = [];  // lines collects the narration sentences for this moment
      const arriving = devs.filter((d) => arr[d] === t).sort((a, b) => PR[b] - PR[a]);  // devices whose request arrives at this moment, most urgent first
      arriving.forEach((d) => pending.push(d));  // every new request joins the pending list
      const started = [];  // started will list [device, what it interrupted] for each handler that starts now
      if (mode === 'nested') {  // nested policy: a request may interrupt anything with a lower priority, including another handler
        while (pending.length) {  // keeps starting handlers while the most urgent waiting request outranks whatever is running
          const best = pending.reduce((a, b) => (PR[b] > PR[a] ? b : a));  // finds the most urgent pending request
          if (PR[best] <= PR[run]) break;  // if it does not outrank the one running, it has to wait, so stop looking
          pending.splice(pending.indexOf(best), 1);  // removes it from the pending list
          stack.push(run); if (run !== 'U' && suspAt[run] === undefined) suspAt[run] = t;  // saves what was running on the stack, and notes when a handler was suspended
          started.push([best, run]); run = best;  // records the start and switches the processor to the new handler
          if (info[best].start === null) info[best].start = t;  // remembers the first time this handler got the processor
        }  // ends the nesting loop
      } else if (run === 'U' && pending.length) {  // sequential policy: interrupts are disabled during any handler, so a new one starts only when the user program is running
        pending.sort((a, b) => arr[a] - arr[b] || PR[b] - PR[a]);  // serves the oldest waiting request first; requests that arrived together go most urgent first
        const nx = pending.shift(); stack.push('U'); started.push([nx, 'U']); run = nx; info[nx].start = t;  // takes that request off the list, saves the user program, and starts the handler
      }  // ends the policy choice
      if (run !== 'U' && suspAt[run] !== undefined && !started.some((x) => x[0] === run)) { susp.push({ who: run, s: suspAt[run], e: t }); delete suspAt[run]; }  // a suspended handler that gets the processor back (and did not just start) closes its suspended stretch at this moment
      /* narration for this moment */
      if (finished) lines.push(`The ${NAME[finished]} handler finishes.`);  // narration: says that the handler which ended last moment is now finished
      started.filter(([d]) => !arriving.includes(d)).forEach(([d, over]) => {  // narration for handlers that start now after waiting (not ones that just arrived)
        if (mode === 'nested') lines.push(over === 'U' ? `The waiting ${tag(d)} request is the most urgent one left, so its handler runs next. It waited ${t - arr[d]} units.` : `The waiting ${tag(d)} request outranks the suspended ${NAME[over]} handler (${PR[over]}), so its handler runs first. It waited ${t - arr[d]} units.`);  // nested: explains why this waiting request goes next and how long it waited
        else {  // sequential policy wording
          const urgent = pending.filter((x) => PR[x] > PR[d]), tie = pending.some((x) => arr[x] === arr[d]);  // urgent = waiting requests more urgent than this one; tie = one arrived at the same time
          lines.push(`Interrupts are enabled again. The oldest waiting request, ${tag(d)}, which arrived at t = ${arr[d]}, is served next` + (tie ? ' (requests that arrived together are taken most urgent first)' : '') + (urgent.length ? `, even though the ${NAME[urgent[0]]} request is more urgent.` : '.'));  // explains that interrupts are enabled again and the oldest request goes first, even if a more urgent one is waiting
        }  // ends the sequential wording
      });  // ends the narration for waiting requests
      if (finished && !started.length) lines.push(run === 'U' ? 'Nothing is waiting, so the <b>user program</b> resumes.' : `Control returns to the suspended <b>${NAME[run]}</b> handler, which continues where it stopped.`);  // when a handler ended and nothing new started: the user program resumes, or the suspended handler continues
      arriving.forEach((d) => {  // narration for each request that arrives at this moment
        const st = started.find((x) => x[0] === d);  // st is set if this request's handler started straight away
        if (st && st[1] === 'U') lines.push(`${tagC(d)} interrupts the user program. Its handler starts` + (mode === 'seq' ? ', and interrupts are now disabled.' : '.'));  // it interrupted the user program; under the sequential policy interrupts are now disabled
        else if (st) lines.push(`${tagC(d)} interrupts. ${PR[d]} > ${PR[st[1]]}, so the ${NAME[st[1]]} handler is suspended (its state goes on the stack) and the ${NAME[d]} handler starts.`);  // it interrupted a lower-priority handler, which is suspended with its state saved on the stack
        else if (mode === 'nested') lines.push(`${tagC(d)} interrupts, but the running ${NAME[run]} handler outranks it (${PR[run]} > ${PR[d]}), so the request is left pending.`);  // nested, but outranked by the running handler: the request is left pending
        else lines.push(`${tagC(d)} interrupts, but interrupts are disabled while the ${NAME[run]} handler runs, so the request waits` + (PR[d] > PR[run] ? ', even though it is more urgent.' : '.'));  // sequential: interrupts are disabled, so the request waits even if it is more urgent
      });  // ends the narration for arriving requests
      if (lines.length) moments.push({ t, html: lines.join(' ') });  // if anything happened at this moment, saves its narration with the time
      /* run one time unit */
      const ls = segs[segs.length - 1];  // ls is the latest segment of the timeline
      if (ls && ls.who === run && ls.e === t) ls.e = t + 1; else segs.push({ who: run, s: t, e: t + 1 });  // if the same one keeps running, the segment grows by one unit; otherwise a new segment starts
      finished = null;  // clears the "just finished" note before this unit's work
      if (run !== 'U') {  // when a handler is running
        left[run]--;  // it uses up one unit of its work
        if (!left[run]) { info[run].finish = t + 1; finished = run; run = stack.pop(); if (mode === 'seq') { run = 'U'; stack.length = 0; } }  // when its work is done: record the finish and return to what it interrupted (always the user program under the sequential policy)
      }  // ends the handler branch
      if (!finished && run === 'U' && !pending.length && devs.every((d) => info[d].finish !== null)) { end = t; break; }  // the simulation ends when the user program runs again with nothing waiting and every handler finished
    }  // ends the time loop
    const pend = devs.filter((d) => info[d].start > info[d].arrive).map((d) => ({ who: d, s: info[d].arrive, e: info[d].start }));  // pend lists each request's waiting stretch, from its arrival to the start of its handler
    return { segs, pend, susp, info, moments, end };  // returns everything the timeline and the narration need
  }  // ends simMulti()
  /* On phones, a dense diagram is shown at a readable size inside a sideways-swipe box instead of shrinking to tiny text. */
  function panWrap(ctx, svg, minW) {  // panWrap(ctx, svg, minW): on a phone-width screen, keeps a busy diagram readable by letting it scroll sideways
    if (!ctx.narrow) return svg;  // on larger screens the drawing is returned unchanged
    svg.style.minWidth = minW + 'px';  // gives the drawing a minimum width so its text does not shrink too far
    return ctx.h('div', {}, ctx.h('div', { style: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' } }, svg),  // puts it inside a box that scrolls sideways (smoothly on touch screens)
      ctx.h('div', { class: 'xs muted center' }, '← swipe sideways to see the whole diagram →'));  // adds a hint under it telling the student to swipe sideways
  }  // ends panWrap()
  /* Draw a Gantt chart of a simMulti result. o: { x0, x1, y0, laneH, tmax, T (cursor time or null), veil, short, tick } */
  function ganttNodes(s, sim, o) {  // ganttNodes(s, sim, o): builds the shapes of a timeline chart (a Gantt chart) with one lane per device
    const { x0, x1, y0, laneH, tmax } = o, K = (x1 - x0) / tmax, X = (t) => x0 + Math.min(t, tmax) * K;  // reads the chart's position; K is pixels per time unit and X(t) turns a time into a horizontal position
    const laneY = (w) => y0 + MI.LANES.findIndex((l) => l[0] === w) * (laneH + 8);  // laneY(w): the top of the lane for w, in the order of MI.LANES, with a small gap between lanes
    const out = [s('defs', {}, s('pattern', { id: 's14-hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },  // defines a striped fill pattern (a hatch) used to paint "pending" stretches
      s('rect', { width: 8, height: 8, style: 'fill:var(--warn-bg)' }), s('line', { x1: 0, y1: 0, x2: 0, y2: 8, class: 's14-hatch-line' })))];  // the pattern's pale warning-colour background and one diagonal stripe line
    const SHORT = { C: 'Comm 5', D: 'Disk 4', P: 'Printer 2', U: 'User' };  // short lane names used on small screens
    MI.LANES.forEach(([w, label]) => out.push(s('text', { x: x0 - 8, y: laneY(w) + laneH / 2 + 5, class: 't13 end bold' }, o.short ? SHORT[w] : label),  // writes each lane's label to the left of the chart
      s('line', { x1: x0, y1: laneY(w) + laneH, x2: x1, y2: laneY(w) + laneH, class: 'axis' })));  // and draws a thin line under each lane
    const vis = (p) => ((o.T == null ? p.e : Math.min(p.e, o.T)) - p.s) * K;   // label only the part not hidden by the veil
    sim.pend.forEach((p) => { const w = (p.e - p.s) * K, v = vis(p); out.push(s('rect', { x: X(p.s), y: laneY(p.who) + 6, width: w, height: laneH - 12, rx: 3, class: 'idle', 'stroke-width': 1.5 }));  // each pending stretch is a striped box; the word "pending" is added only when enough of it is visible
      if (v >= 58) out.push(s('text', { x: X(p.s) + v / 2, y: laneY(p.who) + laneH / 2 + 5, class: 't13 mid bold', style: 'fill:var(--warn)' }, 'pending')); });  // the "pending" label, centred in the visible part, in the warning colour
    sim.susp.forEach((p) => { const w = (p.e - p.s) * K, v = vis(p); out.push(s('rect', { x: X(p.s), y: laneY(p.who) + 6, width: w, height: laneH - 12, rx: 3, class: 's-panel', 'stroke-dasharray': '5 4', 'stroke-width': 1.5 }));  // each suspended stretch is a dashed empty box
      if (v >= 70) out.push(s('text', { x: X(p.s) + v / 2, y: laneY(p.who) + laneH / 2 + 5, class: 't13 mid s-sub' }, 'suspended')); });  // the "suspended" label, added only when at least 70 pixels of the box are visible
    sim.segs.forEach((g, i) => {  // draws the running blocks
      const e = g.who === 'U' && i === sim.segs.length - 1 ? tmax : g.e;  // the user program's last block stretches to the right edge, since it keeps running after the handlers finish
      out.push(s('rect', { x: X(g.s), y: laneY(g.who) + 2, width: (Math.min(e, tmax) - g.s) * K, height: laneH - 4, rx: 4, class: 'blk ' + (g.who === 'U' ? 's-proc' : 's-intr') }));  // a solid block: the user-program colour on its lane, the interrupt colour on a handler's lane
    });  // ends the running-block loop
    const marker = (d) => { const x = X(sim.info[d].arrive), y = laneY(d); return s('path', { d: `M${x - 6},${y - 7} L${x + 6},${y - 7} L${x},${y + 1} Z`, style: 'fill:var(--intr)' }); };  // marker(d): a small downward triangle at the moment device d's request arrives
    const seen = (d) => o.T == null || sim.info[d].arrive <= o.T;   // requests that have already arrived are drawn above the veil
    ['P', 'D', 'C'].filter((d) => !seen(d)).forEach((d) => out.push(marker(d)));  // requests that have not arrived yet are drawn now, so the veil drawn next covers them
    const ay = y0 + 4 * (laneH + 8) + 2;  // ay is the y position of the time axis under the four lanes
    out.push(s('line', { x1: x0, y1: ay, x2: x1, y2: ay, class: 'axis' }));  // the time axis line
    for (let t = 0; t <= tmax; t += o.tick || 5) out.push(s('line', { x1: X(t), y1: ay, x2: X(t), y2: ay + 5, class: 'axis' }), s('text', { x: X(t), y: ay + 20, class: 't13 mid s-sub' }, String(t)));  // tick marks and numbers along the axis, every 5 units unless another spacing is given
    if (o.T != null && o.T < tmax) out.push(s('rect', { x: X(o.T), y: y0 - 12, width: x1 - X(o.T) + 4, height: ay - y0 + 12, style: `fill:var(--panel);opacity:${o.veil || 0.8}` }),  // when a cursor time is given, a see-through veil covers the future part of the chart
      s('line', { x1: X(o.T), y1: y0 - 12, x2: X(o.T), y2: ay + 4, class: 'cursor' }), s('text', { x: X(o.T), y: y0 - 16, class: 't13 mid bold', style: 'fill:var(--accent)' }, 't = ' + o.T));  // a vertical cursor line at that time, labelled "t = ..." above the chart
    ['P', 'D', 'C'].filter(seen).forEach((d) => out.push(marker(d)));  // requests that have already arrived are drawn last so they stay visible on top of the veil
    return out;  // hands the finished list of shapes back to the caller
  }  // ends ganttNodes()

  Guide.section({  // registers this section with the guide shell, which builds its slides, glossary and quiz from the object below
    id: '1.4',  // section number; the shell uses it for the slide keys, the colours and the contents list
    title: 'Interrupts',  // full section title shown at the top of every step
    short: 'Interrupts',  // short title used in tight spots such as the chapter list on the home page
    summary: 'How devices get the processor’s attention, and how it pauses, serves them and resumes.',  // one-sentence summary shown next to the section on its chapter overview page
    objectives: [  // learning objectives, printed in the printable version of the guide
      'Explain why interrupts raise processor utilization when I/O devices are far slower than the processor.',  // objective 1: why interrupts raise processor utilization when devices are slow
      'Classify events into the four classes of interrupts: program, timer, I/O and hardware failure.',  // objective 2: classifying events into the four classes of interrupts
      'Trace the flow of control and the timing of a program with and without interrupts, for short and long I/O waits.',  // objective 3: tracing control flow and timing with and without interrupts
      'List, in order, the hardware and software steps of interrupt processing and show how the PC, PSW and control stack change.',  // objective 4: the steps of interrupt processing and how the PC, PSW and stack change
      'Compare disabling interrupts with priority-based nesting, and trace a timeline with several interrupts.',  // objective 5: disabling interrupts compared with priority nesting, on a timeline
    ],  // closes the objectives list
    terms: [  // key terms: each pair is [term, definition]; they feed the glossary drawer and the chapter flash cards
      ['Interrupt', 'A signal that makes the processor set aside the program it is running, run a special routine to deal with some event, and then carry on exactly where it left off.'],  // glossary entry: defines an interrupt
      ['Interrupt handler', 'The routine (normally part of the operating system) that runs when an interrupt is accepted. It finds out what the device or event needs and deals with it. Also called an interrupt service routine (ISR).'],  // glossary entry: defines the interrupt handler, also called an interrupt service routine
      ['Processor utilization', 'The fraction of time the processor spends doing useful work instead of sitting idle.'],  // glossary entry: defines processor utilization
      ['Program interrupt', 'An interrupt caused by the instruction just executed: for example arithmetic overflow, division by zero, an illegal instruction, or an attempt to use memory outside the program’s allowed space.'],  // glossary entry: defines a program interrupt, caused by the instruction just executed
      ['Timer interrupt', 'An interrupt produced by a clock in the processor at regular intervals. It lets the operating system take back control and do jobs on a schedule.'],  // glossary entry: defines a timer interrupt
      ['I/O interrupt', 'An interrupt produced by an I/O module to report that an operation finished, that the device needs service, or that an error occurred.'],  // glossary entry: defines an I/O interrupt
      ['Hardware failure interrupt', 'An interrupt triggered by a physical fault, such as the power supply failing or memory detecting a parity error.'],  // glossary entry: defines a hardware failure interrupt
      ['I/O command', 'An instruction the processor sends to an I/O module telling it to start an operation, such as printing a line. The device then works on its own.'],  // glossary entry: defines an I/O command
      ['Instruction cycle', 'The repeating routine the processor follows for every instruction: fetch it from memory, execute it, and (with interrupts) check whether an interrupt is waiting.'],  // glossary entry: defines the instruction cycle, now including the interrupt check
      ['Interrupt stage', 'The stage added to the instruction cycle after execute. The processor checks for a pending interrupt and, if one is waiting and interrupts are enabled, switches to its handler.'],  // glossary entry: defines the interrupt stage
      ['Pending interrupt', 'An interrupt request a device has raised that the processor has not accepted yet, for example because interrupts are disabled or a higher-priority handler is running.'],  // glossary entry: defines a pending interrupt
      ['Program counter (PC)', 'The processor register that holds the address of the next instruction to fetch.'],  // glossary entry: defines the program counter (PC)
      ['Kernel mode', 'The privileged processor mode in which the operating system (including every interrupt handler) runs: all instructions are allowed, such as those that enable or disable interrupts. Ordinary programs run in the restricted user mode.'],  // glossary entry: defines kernel mode, where interrupt handlers run
      ['Program status word (PSW)', 'A processor register that holds status about the running program: condition codes (for example, whether the last result was zero or overflowed), whether interrupts are enabled, and whether the processor is in user or kernel mode.'],  // glossary entry: defines the program status word (PSW)
      ['Context (processor state)', 'Everything the processor needs to continue a program exactly where it stopped: the program counter, the PSW and the contents of the other registers.'],  // glossary entry: defines the context, the processor state needed to resume a program
      ['Control stack', 'An area of memory used last-in, first-out, where the processor and the operating system save return addresses and register contents.'],  // glossary entry: defines the control stack
      ['Stack pointer (SP)', 'The register holding the address of the top of the control stack. It moves every time something is pushed onto or popped off the stack.'],  // glossary entry: defines the stack pointer (SP)
      ['Disabled interrupts', 'A processor setting in which new interrupt requests are ignored for the moment. They stay pending and are served once interrupts are enabled again.'],  // glossary entry: defines disabled interrupts
      ['Interrupt priority', 'A ranking given to each source of interrupts so that, when several compete, the more urgent one is served first and may even interrupt a less urgent handler.'],  // glossary entry: defines interrupt priority
      ['Nested interrupts', 'Handling in which a higher-priority interrupt may interrupt a handler that is already running; the interrupted handler resumes when the higher one finishes.'],  // glossary entry: defines nested interrupts
    ],  // closes the terms list

    css: ` /* styles used only by this section; the shell adds them to the page once, when the section registers */
      .sec-1-4 .ev-card { font-size: 19px; font-weight: 650; line-height: 1.4; min-height: 84px; display: flex; align-items: center; } /* the event card in the classify game: large bold text, vertically centred, with a fixed minimum height */
      .sec-1-4 .cls-btns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } /* the four class buttons in the classify game sit in a 2 by 2 grid */
      .sec-1-4 .cls-btns .btn { height: 42px; font-size: 15.5px; } /* the class buttons are all the same height with slightly larger text */
      .sec-1-4 .cls-btns .btn.right { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); } /* after an answer, the right class button turns green */
      .sec-1-4 .cls-btns .btn.wrong { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); } /* a wrong pick turns red */
      .sec-1-4 .cls-card { padding: 9px 12px; } /* the four class description cards use tighter padding */
      .sec-1-4 .cls-card h3 { font-size: 17px; margin: 0 0 2px; } /* each class card's title */
      .sec-1-4 .cls-card p { font-size: 14.5px; margin: 0; line-height: 1.4; } /* each class card's description text */
      .sec-1-4 .cls-card.hot { box-shadow: 0 0 0 3px var(--hl); } /* the class card that matches the current event gets a yellow glow round its edge */
      .sec-1-4 .isteps { list-style: none; padding: 0 !important; margin: 0; display: flex; flex-direction: column; gap: 4px; } /* the numbered list of interrupt processing steps: no bullets, stacked with small gaps */
      .sec-1-4 .isteps > li { margin: 0 !important; } /* removes the default list spacing from each step */
      .sec-1-4 .isteps li { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 8px; align-items: start; padding: 2px 8px; border-radius: 9px; font-size: 14.5px; line-height: 1.35; color: var(--ink-2); border: 1px solid transparent; margin: 0; } /* one step row: a small number column and the text, with rounded corners for highlighting */
      .sec-1-4 .isteps li .n { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; font-weight: 800; font-size: 13px; background: var(--panel-3); color: var(--ink-2); } /* the step number badge: a small rounded square with the number centred in it */
      .sec-1-4 .isteps li.hw .n { background: var(--cpu-bg); color: var(--cpu); } /* hardware steps get a processor-coloured number badge */
      .sec-1-4 .isteps li.sw .n { background: var(--os-bg); color: var(--os); } /* software steps get an operating-system-coloured number badge */
      .sec-1-4 .isteps li.done { color: var(--muted); } /* steps already done are shown in grey */
      .sec-1-4 .isteps li.on { background: var(--accent-bg); border-color: var(--accent); color: var(--ink); font-weight: 650; } /* the current step is highlighted in the accent colour with bolder text */
      .sec-1-4 .grp { font-size: 12.5px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; margin: 4px 0 2px; } /* the small uppercase heading over each group of steps (hardware or software) */
      .sec-1-4 .kv { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 3px 10px; font-size: 14.5px; align-items: baseline; } /* a two-column key-value list for register readouts: name on the left, value on the right */
      .sec-1-4 .kv b { font-family: var(--mono); } /* the values in the key-value list use the monospace font */
      .sec-1-4 .pq-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } /* the answer buttons in the predict question sit in a 2 by 2 grid */
      .sec-1-4 .pq-choices .btn { height: auto; min-height: 40px; padding: 6px 10px; white-space: normal; text-align: left; justify-content: flex-start; } /* predict answer buttons may wrap onto several lines and are left-aligned, since answers are sentences */
      .sec-1-4 .pq-choices .btn.right { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); } /* the right predict answer turns green */
      .sec-1-4 .pq-choices .btn.wrong { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); } /* a wrong predict answer turns red */
      .sec-1-4 .fb { font-size: 15px; line-height: 1.45; } /* feedback text size and line spacing */
      .sec-1-4 .stat { display: flex; flex-direction: column; gap: 0; } /* a statistic box: a label stacked above a big number */
      .sec-1-4 .stat .v { font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.15; } /* the big number of a statistic, with equal-width digits so it does not jitter as it changes */
      .sec-1-4 .stat .l { font-size: 12.5px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .05em; } /* the small uppercase grey label of a statistic */
      .sec-1-4 .lamp { display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: var(--panel-3); border: 2px solid var(--line-2); vertical-align: -1px; } /* the round "interrupt pending" lamp, grey when off */
      .sec-1-4 .lamp.on { background: var(--intr); border-color: var(--intr); box-shadow: 0 0 0 3px var(--intr-bg); } /* when a request is pending the lamp lights up in the interrupt colour with a soft glow */
      .sec-1-4 .mini-log { font-family: var(--mono); font-size: 13px; line-height: 1.4; background: var(--panel-3); border-radius: 10px; padding: 6px 10px; overflow-y: auto; min-height: 0; } /* the small event log: monospace text on a grey panel that scrolls when it fills up */
      .sec-1-4 .mini-log > div { padding: 1px 0; border-bottom: 1px dashed var(--line); } /* each log entry is separated from the next by a dashed line */
      .sec-1-4 svg .blk { stroke-width: 2; } /* solid blocks in the diagrams get a thicker outline */
      .sec-1-4 svg .dim { opacity: .35; } /* fades diagram parts that are not active */
      .sec-1-4 svg .glow { stroke-width: 4; } /* the active box in a diagram gets an extra-thick outline */
      .sec-1-4 svg .idle { fill: url(#s14-hatch); stroke: var(--warn); } /* a pending stretch on the timeline is filled with the striped pattern and outlined in the warning colour */
      .sec-1-4 svg .s14-hatch-line { stroke: var(--warn); stroke-width: 2; } /* the stripe lines inside that pattern are in the warning colour */
      .sec-1-4 svg .axis { stroke: var(--line-2); stroke-width: 1; } /* thin grey lines for timeline axes and lane baselines */
      .sec-1-4 svg .cursor { stroke: var(--accent); stroke-width: 2.5; } /* the "now" cursor line on a timeline, in the accent colour */
      .sec-1-4 svg .t13 { font-size: 13px; } /* SVG text size 13px */
      .sec-1-4 svg .t14 { font-size: 14px; } /* SVG text size 14px */
      .sec-1-4 svg .t15 { font-size: 15px; } /* SVG text size 15px */
      .sec-1-4 svg .bold { font-weight: 700; } /* bold SVG text */
      .sec-1-4 svg .mid { text-anchor: middle; } /* centres SVG text on its x position */
      .sec-1-4 svg .end { text-anchor: end; } /* right-aligns SVG text so it ends at its x position */
    `,  // end of the section's CSS text

    steps: [  // steps: the list of screens in this section, shown in order as the student presses Next
      /* ============ 1. Big Picture: why interrupts exist ============ */
      {  // step 1 object starts here: why interrupts exist
        title: 'Why a fast processor should never wait for a slow device',  // step 1 title shown at the top of the screen
        kind: 'story',  // kind "story" labels the step as the Big Picture and keeps it on the core path
        html: `${/* html: the fixed page layout for step 1; the shell inserts it before render() runs */''}
          <div class="split l fill">${/* two-column layout: text on the left, the speed-gap card on the right */''}
            <div class="stack">${/* left column stack */''}
              <p class="lead m0">A processor runs about a billion instructions per second. One disk, printer or network operation can last as long as 100,000 to over 100,000,000 instructions.</p>${/* intro paragraph: a processor runs about a billion instructions per second while one device operation takes far longer */''}
              <p class="m0">Say a program asks the printer to print a line. If the processor just waits, it sits idle for millions of instruction-times. An <span class="t">interrupt</span> fixes this: the processor starts the device, goes back to useful work, and the device <em>interrupts</em> it (sends it a signal) when it is done.</p>${/* paragraph: the printer example, and how an interrupt lets the processor work instead of waiting */''}
              <div class="callout why m0" data-label="Why it matters">Interrupts exist mainly to raise <span class="t">processor utilization</span>, the share of time the processor spends on useful work instead of waiting.</div>${/* "why it matters" box: interrupts exist mainly to raise processor utilization */''}
              <div class="callout analogy m0" data-label="Analogy">At a busy food counter you pay, get a buzzer, and sit down to answer emails. You do not stand at the counter watching the kitchen. When the buzzer goes off you collect your food, then return to your emails exactly where you stopped.</div>${/* analogy box: the restaurant buzzer that lets you get on with something else */''}
            </div>${/* end of the left column */''}
            <div class="card stack s14-gap"></div>${/* empty right-hand card; render() fills it with the device picker */''}
          </div>`,  // end of the layout HTML
        render(el, ctx) {  // render(el, ctx): fills the speed-gap card each time step 1 is opened
          const { h } = ctx;  // takes the HTML element builder h from ctx
          const card = ctx.$('.s14-gap');  // finds the empty card that the html above created
          const DEV = {  // DEV: five example devices with a typical wait time in milliseconds and a description
            ssd: { label: 'SSD read', ms: 0.1, what: 'Reading one block from a solid-state drive' },  // device: an SSD block read, about 0.1 ms
            hdd: { label: 'Hard-disk read', ms: 5, what: 'Reading one block from a spinning hard disk' },  // device: a hard-disk block read, about 5 ms
            prn: { label: 'Print a line', ms: 20, what: 'A slow printer printing one line of text' },  // device: a slow printer printing a line, about 20 ms
            net: { label: 'Network reply', ms: 50, what: 'Waiting for a reply from a server far away' },  // device: a reply from a distant server, about 50 ms
            key: { label: 'Next keypress', ms: 200, what: 'The gap between two keys typed by a quick typist' },  // device: the gap between two keypresses, about 200 ms
          };  // closes the DEV table
          const stretch = (sec) => {  // stretch(sec): turns a number of seconds into rough hours, days, months or years for the "stretch it" comparison
            const day = 86400;  // the number of seconds in one day
            if (sec < 2 * day) return 'about ' + Math.round(sec / 3600) + ' hours';  // under two days: say it in hours
            if (sec < 60 * day) return 'about ' + Math.round(sec / day) + ' days';  // under 60 days: say it in days
            if (sec < 2 * 365.25 * day) return 'about ' + Math.round(sec / (30.44 * day)) + ' months';  // under two years: say it in months (an average month is 30.44 days)
            return 'about ' + ctx.util.fmt(sec / (365.25 * day), 1) + ' years';  // otherwise: say it in years with one decimal place
          };  // ends stretch()
          const what = h('p', { class: 'small m0 muted' });  // the device description line
          const devTime = h('div', { class: 'stat' });  // the "Device needs" statistic box
          const big = h('div', { class: 'big', style: { color: 'var(--io)' } });  // the big number of instructions the processor could have run while waiting
          const human = h('div', { class: 'callout tip m0' });  // the tip box that scales the wait up to human time
          const show = (k) => {  // show(k): fills the card for device k; runs when the page opens and whenever another device is picked
            const d = DEV[k];  // d is the chosen device's entry
            const instr = Math.round(d.ms * 1e6);            // 1 instruction per nanosecond
            what.textContent = d.what + '.';  // writes the device description
            devTime.innerHTML = `<span class="l">Device needs</span><span class="v">≈ ${d.ms < 1 ? d.ms * 1000 + ' µs' : d.ms + ' ms'}</span>`;  // writes the wait time, in microseconds when under 1 ms, otherwise in milliseconds
            big.textContent = instr.toLocaleString('en-US');  // writes the number of lost instructions with thousands separators
            human.innerHTML = `<b>Stretch it:</b> if one instruction took one second, this wait would last <b>${stretch(instr)}</b>.`;  // scales it up: if each instruction took one second, how long the wait would last
          };  // ends show()
          const seg = ctx.ui.seg(Object.entries(DEV).map(([value, d]) => ({ value, label: d.label })), 'prn', show);  // the device picker: a row of buttons (ctx.ui.seg), one per device, starting on the printer
          card.append(  // fills the right-hand card
            h('h4', { class: 'm0' }, 'The speed gap: pick a device'),  // the card's heading
            h('p', { class: 'small m0' }, 'Assume the processor runs one instruction per nanosecond. The device times are rough, typical figures; the size of the gap is what matters.'),  // explains the assumption of one instruction per nanosecond and that the figures are rough
            seg, what, devTime,  // the picker, the description and the wait-time box
            h('div', {}, big, h('div', { class: 'small b' }, 'instructions the processor could have run while waiting')),  // the big lost-instructions number with its label
            human,  // the "stretch it" tip box
            h('div', { class: 'row gap-s', style: { marginTop: 'auto' } },  // a row of preview chips pushed to the bottom of the card
              h('span', { class: 'xs muted b' }, 'COMING UP:'),  // the "COMING UP" label
              h('span', { class: 'chip intr' }, '4 classes'), h('span', { class: 'chip proc' }, 'flow of control'),  // preview chips: the four classes and flow of control
              h('span', { class: 'chip warn' }, 'timing race'), h('span', { class: 'chip cpu' }, '9-step walkthrough'),  // preview chips: the timing race and the 9-step walkthrough
              h('span', { class: 'chip os' }, 'nested interrupts')),  // preview chip: nested interrupts
          );  // ends the card contents
          show('prn');  // shows the printer figures when the step opens
        },  // ends render() for step 1
      },  // ends step 1

      /* ============ 2. The four classes + classify game ============ */
      {  // step 2 object starts here: the four classes of interrupts and a sorting game
        title: 'Four classes of interrupts: sort the events',  // step 2 title
        kind: 'lab',  // kind "lab": a hands-on sorting activity
        html: `${/* html: the fixed page layout for step 2 */''}
          <div class="split l fill">${/* two-column layout: class cards on the left, the game on the right */''}
            <div class="stack gap-s">${/* left column stack with small gaps */''}
              <p class="m0">Every interrupt says “stop and deal with this”. They are grouped by <b>where the signal comes from</b>:</p>${/* intro sentence: interrupts are grouped by where the signal comes from */''}
              <div class="card proc cls-card" data-c="0"><h3>1 · Program</h3><p>Caused by the instruction just executed: <b>arithmetic overflow</b>, <b>division by zero</b>, an <b>illegal instruction</b>, or a <b>memory reference outside</b> the program’s allowed space.</p></div>${/* class card 1, program interrupts: caused by the instruction just executed (data-c is its class number) */''}
              <div class="card cpu cls-card" data-c="1"><h3>2 · Timer</h3><p>Produced by a clock inside the processor at regular intervals, so the operating system can regain control and do jobs on a schedule.</p></div>${/* class card 2, timer interrupts: from a clock inside the processor */''}
              <div class="card io cls-card" data-c="2"><h3>3 · I/O</h3><p>Sent by an <span class="t">I/O module</span> (device controller) when an operation finishes, the device needs service, or to report an error.</p></div>${/* class card 3, I/O interrupts: sent by an I/O module */''}
              <div class="card intr cls-card" data-c="3"><h3>4 · Hardware failure</h3><p>Raised by a physical fault, such as the power failing or a memory parity error (stored bits found corrupted).</p></div>${/* class card 4, hardware failure interrupts: raised by a physical fault */''}
            </div>${/* end of the left column */''}
            <div class="card white stack s14-game"></div>${/* empty right-hand card; render() builds the game in it */''}
          </div>`,  // end of the layout HTML
        render(el, ctx) {  // render(el, ctx): builds the sorting game each time step 2 is opened
          const { h } = ctx;  // takes the HTML element builder h from ctx
          const CLASSES = ['Program', 'Timer', 'I/O', 'Hardware failure'];  // the four class names, in the same order as the cards
          const EVENTS = [  // EVENTS: twelve events to sort, each as [description, correct class number, explanation]
            ['An ADD instruction produces a result too large to fit in its register.', 0, 'Arithmetic overflow is caused by the instruction the processor just ran, so it is a <span class="t">program interrupt</span>.'],  // event: an ADD overflows its register, a program interrupt
            ['A program divides a number by zero.', 0, 'Division by zero happens inside the executing instruction: a program interrupt.'],  // event: division by zero, a program interrupt
            ['The processor fetches a bit pattern that is not a valid instruction.', 0, 'An illegal instruction comes from the program itself: a program interrupt.'],  // event: fetching an invalid bit pattern, a program interrupt
            ['A program tries to read an address outside the memory it is allowed to use.', 0, 'A memory access violation is caused by the program’s own instruction: a program interrupt.'],  // event: reading memory outside the allowed area, a program interrupt
            ['The processor’s built-in clock signals that another 10 milliseconds have passed.', 1, 'A regular tick from the processor’s clock is a <span class="t">timer interrupt</span>.'],  // event: a 10 ms clock tick, a timer interrupt
            ['A program has been running in an endless loop, but the OS still gets control back after a fixed slice of time.', 1, 'The OS regains control because the clock fires at regular intervals: a timer interrupt.'],  // event: the OS regains control from an endless loop, a timer interrupt
            ['The printer finishes printing a line and is ready for the next one.', 2, 'A device reporting that its operation completed is an <span class="t">I/O interrupt</span>.'],  // event: the printer finishes a line, an I/O interrupt
            ['The disk controller reports that the block you asked for is now in memory.', 2, 'The I/O module signals completion of a transfer: an I/O interrupt.'],  // event: the disk controller reports a finished transfer, an I/O interrupt
            ['The network card reports that a transmission failed.', 2, 'An error reported by an I/O module is still an I/O interrupt. Hardware-failure interrupts are about the machine itself breaking.'],  // event: the network card reports a failed transmission, still an I/O interrupt (a common trap)
            ['A key is pressed on the keyboard.', 2, 'The keyboard’s I/O module asks for service: an I/O interrupt.'],  // event: a key is pressed, an I/O interrupt
            ['The power supply detects that the voltage is dropping.', 3, 'A failing power supply is a physical fault: a <span class="t">hardware failure interrupt</span>. The OS may have a few milliseconds to save critical data.'],  // event: the power supply voltage drops, a hardware failure interrupt
            ['Memory detects a parity error in a word it just read.', 3, 'A parity error means the extra check bit no longer matches the stored bits, so the memory hardware has corrupted them: a hardware failure interrupt.'],  // event: memory detects a parity error, a hardware failure interrupt
          ];  // closes the EVENTS list
          const game = ctx.$('.s14-game');  // finds the empty game card from the html above
          const cards = ctx.$$('.cls-card');  // finds the four class cards so the matching one can be highlighted
          let order = [], k = 0, firstTry = 0, answered = false;  // order = shuffled event order; k = position in it; firstTry = right on first try; answered = current event is done
          const prog = h('div', { class: 'small b muted' });  // progress line, for example "Event 3 of 12"
          const score = h('span', { class: 'chip ok' });  // score chip
          const evCard = h('div', { class: 'card ev-card' });  // the card that shows the event to classify
          const fb = h('div', { class: 'fb', style: { minHeight: '66px' } });  // the feedback box under the buttons; its minimum height keeps the layout still
          const btns = CLASSES.map((c, i) => h('button', { class: 'btn', type: 'button', onclick: () => answer(i) }, c));  // one button per class; clicking it answers with that class
          const next = h('button', { class: 'btn primary', type: 'button', onclick: () => advance() }, 'Next event →');  // the Next button, which moves to the next event once the current one is answered
          const meter = h('div', { class: 'meter' }, h('i', { style: { width: '0%' } }));  // a thin progress bar; its inner bar grows as the student works through the events
          function paint() {  // paint(): shows the current event with the buttons reset; runs for every new event
            const ev = EVENTS[order[k]];  // ev is the current event, taken from the shuffled order
            prog.textContent = `Event ${k + 1} of ${EVENTS.length}`;  // progress text, for example "Event 3 of 12"
            score.textContent = `${firstTry} right first time`;  // score text
            meter.firstChild.style.width = (k / EVENTS.length) * 100 + '%';  // sets the progress bar to the share of events already done
            evCard.textContent = ev[0];  // puts the event text in the event card
            btns.forEach((b) => { b.disabled = false; b.classList.remove('right', 'wrong'); });  // re-enables the class buttons and clears last event's green and red
            cards.forEach((c) => c.classList.remove('hot'));  // removes the glow from the class cards
            fb.innerHTML = '<span class="muted">Which class does this event belong to? Click one of the four buttons.</span>';  // prompt in the feedback box before an answer
            next.disabled = true; answered = false;  // Next stays disabled until an answer is given
          }  // ends paint()
          function answer(i) {  // answer(i): runs when the student clicks class button i
            if (answered) return;  // ignores clicks after the first answer to this event
            const ev = EVENTS[order[k]];  // ev is the current event
            answered = true;  // marks the event as answered
            const ok = i === ev[1];  // right if the chosen class matches the event's class
            if (ok) firstTry++;  // only a first answer can add to the score, since later clicks are ignored
            btns[i].classList.add(ok ? 'right' : 'wrong');  // colours the clicked button green or red
            if (!ok) btns[ev[1]].classList.add('right');  // after a wrong pick, also shows the right button in green
            cards.forEach((c) => c.classList.toggle('hot', +c.dataset.c === ev[1]));  // makes the matching class card on the left glow
            fb.innerHTML = `<b style="color:var(--${ok ? 'ok' : 'bad'})">${ok ? '✓ Correct.' : '✗ Not quite: it is ' + CLASSES[ev[1]] + '.'}</b> ${ev[2]}`;  // feedback: a tick or a cross naming the right class, then the explanation
            score.textContent = `${firstTry} right first time`;  // updates the score chip
            next.disabled = false;  // enables the Next button
            next.textContent = k === EVENTS.length - 1 ? 'See my score →' : 'Next event →';  // on the last event the button offers the final score instead
          }  // ends answer()
          function advance() {  // advance(): runs when the student clicks Next
            if (!answered) return;  // does nothing until the current event is answered
            if (k < EVENTS.length - 1) { k++; paint(); return; }  // if events remain, moves to the next one and stops here
            meter.firstChild.style.width = '100%';  // after the last event: fills the progress bar
            prog.textContent = 'All events sorted';  // progress text says every event is sorted
            evCard.innerHTML = `<div><div class="big" style="color:var(--ok)">${firstTry} / ${EVENTS.length}</div><div class="small">right on the first try</div></div>`;  // the event card shows the final score in large green numbers
            btns.forEach((b) => { b.disabled = true; b.classList.remove('right', 'wrong'); });  // disables and clears the class buttons
            cards.forEach((c) => c.classList.remove('hot'));  // removes any class card glow
            fb.innerHTML = firstTry >= 10 ? 'Excellent. You can tell where an interrupt comes from.' : 'Reread the four class cards on the left, then play again with a new order.';  // praise for 10 or more right, otherwise advice to reread the cards and play again
            next.textContent = 'Play again (new order)';  // the Next button becomes "Play again"
            next.disabled = false;  // and stays clickable
            answered = false;                                   // advance() now ignores clicks...
            next.addEventListener('click', restart, { once: true }); // ...and this one restarts the game
          }  // ends advance()
          function restart() { order = ctx.util.shuffle(ctx.util.range(EVENTS.length)); k = 0; firstTry = 0; next.textContent = 'Next event →'; paint(); }  // restart(): shuffles the events into a new order (ctx.util helpers), resets the score and shows the first event
          game.append(  // fills the game card
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, prog, score),  // top row: progress text on the left, score chip on the right
            meter, evCard,  // the progress bar and the event card
            h('div', { class: 'cls-btns' }, ...btns),  // the four class buttons in a 2 by 2 grid
            fb,  // the feedback box
            h('div', { class: 'callout why small', 'data-label': 'How to decide', style: { marginTop: 'auto', marginBottom: '0' } },  // a "how to decide" tip pinned to the bottom of the card
              'Ask where the signal came from. Did the ', h('b', {}, 'running instruction'), ' cause it? The processor’s ', h('b', {}, 'clock'), '? A ', h('b', {}, 'device'), ' reporting on its work? Or the ', h('b', {}, 'machine itself'), ' breaking?'),  // the tip: ask whether the signal came from the instruction, the clock, a device, or the machine breaking
            h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, next),  // the Next button, aligned to the right
          );  // ends the game card contents
          restart();  // starts the first round when the step opens
        },  // ends render() for step 2
      },  // ends step 2

      /* ============ 3. Flow of control: without vs with interrupts ============ */
      {  // step 3 object starts here: the flow of control with and without interrupts
        title: 'Follow the processor: with and without interrupts',  // step 3 title
        kind: 'compare',  // kind "compare": the same program run three ways
        render(el, ctx) {  // render(el, ctx): builds step 3 each time it is opened
          const { h, s } = ctx;  // takes both builders from ctx: h for HTML, s for SVG
          const UX = 20, UW = 250, RX = 450, RW = 270;  // x positions and widths of the two columns: the user program (UX, UW) and the operating system (RX, RW)
          /* Block positions for each scenario. U = user program column, R = OS column (I/O program on top, handler below). */
          function layout(mode) {  // layout(mode): returns the position of every block in the diagram for one scenario
            const B = {};  // B collects the blocks, keyed by id
            const U = (id, y, hh, label, cls = 's-proc') => (B[id] = { x: UX, y, w: UW, h: hh, label, cls });  // U(...) adds a block to the user program column (user-program colour unless another class is given)
            const R = (id, y, hh, label, cls = 's-os') => (B[id] = { x: RX, y, w: RW, h: hh, label, cls });  // R(...) adds a block to the OS column (OS colour unless another class is given)
            U('U1', 34, 44, '① User code');  // block: the first stretch of user code
            U('W1', 84, 26, 'WRITE: call the I/O program', 's-panel');  // block: the first WRITE, which calls the I/O program
            if (mode === 'short') { U('U2a', 116, 36, '② User code (first part)'); U('U2b', 152, 36, '② User code (the rest)'); } else U('U2', 116, 72, '② User code');  // user code 2: split in two for the short-wait scenario (the interrupt lands in the middle), otherwise one block
            U('W2', 194, 26, 'WRITE: call it again', 's-panel');  // block: the second WRITE
            if (mode === 'short') { U('U3a', 226, 36, '③ User code (first part)'); U('U3b', 262, 36, '③ User code (the rest)'); } else U('U3', 226, 72, '③ User code');  // user code 3: split in two for the short-wait scenario, otherwise one block
            if (mode === 'none') {  // no-interrupt scenario: the OS column holds the whole I/O program, including the wait
              R('P4', 34, 34, '④ Prep code'); R('CMD', 74, 26, 'I/O command → printer'); R('WAIT', 106, 50, 'Wait: keep checking the printer', 'idle');  // blocks: prep code, the I/O command, and the busy-wait loop (striped, since no useful work happens)
              R('C5', 162, 34, '⑤ Completion code'); R('RET', 202, 26, 'Return to the user program');  // blocks: the completion code and the return to the user program
            } else if (mode === 'short') {  // short-wait scenario with interrupts
              R('P4', 34, 34, '④ Prep code'); R('CMD', 74, 26, 'I/O command → printer'); R('RET', 106, 26, 'Return right away');  // blocks: prep code, the I/O command, then an immediate return
            } else {  // long-wait scenario with interrupts
              R('WAITP', 34, 44, 'Wait: printer still busy', 'idle'); R('P4', 84, 34, '④ Prep code'); R('CMD', 124, 26, 'I/O command → printer'); R('RET', 156, 26, 'Return right away');  // blocks: a wait because the printer is still busy with the last line, then prep, command, and an immediate return
            }  // ends the scenario choice
            if (mode !== 'none') { R('C5h', 260, 34, '⑤ Completion code', 's-intr'); R('IRET', 300, 24, 'Return from interrupt', 's-intr'); }  // with interrupts, the handler blocks sit lower in the OS column: the completion code and the return from interrupt
            return B;  // hands back the finished block table
          }  // ends layout()
          /* Frames: act = blocks the processor runs in this frame, arr = [from, to] jump, cpu = what the processor is doing. */
          const F = (act, arr, cpu, prn, cap, mark) => ({ act, arr, cpu, prn, cap, mark });  // F(...) builds one animation frame: the active blocks, a jump arrow, what the processor and printer do, the caption, and a marker
          const FRAMES = {  // FRAMES: the animation frames for each of the three scenarios
            none: [  // scenario "none": no interrupts
              F(['U1'], null, 'user', 'idle', '<b>User code ①.</b> The processor runs the program’s own instructions. The printer is idle.'),  // frame: user code 1 runs while the printer is idle
              F(['W1', 'P4'], ['W1', 'P4'], 'os', 'idle', '<b>WRITE.</b> The program calls the I/O program (part of the OS). Its <b>prep code ④</b> gets the data ready and checks that the printer is free.'),  // frame: WRITE jumps to the I/O program, whose prep code runs
              F(['CMD'], null, 'os', 'printing line 1 …', '<b>I/O command.</b> The processor tells the printer to start. Printing one line takes millions of instruction-times.'),  // frame: the I/O command starts the printer
              F(['WAIT'], null, 'idle', 'printing line 1 …', '<b>Wait.</b> With no interrupts, the only way to learn that the printer is done is to keep checking its status. No useful work happens here.'),  // frame: the processor keeps checking the printer, doing no useful work
              F(['C5'], null, 'os', 'line 1 done; its status register now reads “ready”', '<b>Completion code ⑤.</b> One of the status checks finally sees “ready”. The I/O program checks the result (success or error) and tidies up.'),  // frame: a status check finally sees "ready" and the completion code runs
              F(['RET', 'U2'], ['RET', 'U2'], 'user', 'idle', '<b>Return.</b> Only now does control go back to the user program, and code ② runs.'),  // frame: control returns to the user program and code 2 runs
              F(['W2', 'P4'], ['W2', 'P4'], 'os', 'idle', '<b>Second WRITE.</b> Prep code ④ runs again for line 2.'),  // frame: the second WRITE and prep code again
              F(['CMD', 'WAIT'], null, 'idle', 'printing line 2 …', '<b>Command, then wait again.</b> The processor sits idle for the whole of line 2.'),  // frame: command, then another idle wait for line 2
              F(['C5', 'RET', 'U3'], ['RET', 'U3'], 'user', 'idle', '<b>Completion ⑤, return, code ③.</b> The program finally moves on. Cost: two long idle waits, one per WRITE.'),  // frame: completion, return, and code 3, with the cost summed up as two idle waits
            ],  // closes the "none" frames
            short: [  // scenario "short": interrupts, and the printer finishes before the next WRITE
              F(['U1'], null, 'user', 'idle', '<b>User code ①.</b> Same program, but now the system uses interrupts.'),  // frame: user code 1 runs; same program, now with interrupts
              F(['W1', 'P4'], ['W1', 'P4'], 'os', 'idle', '<b>WRITE.</b> Control jumps to the I/O program; <b>prep code ④</b> gets the data ready.'),  // frame: WRITE jumps to the I/O program and its prep code runs
              F(['CMD'], null, 'os', 'printing line 1 …', '<b>I/O command.</b> The printer starts line 1.'),  // frame: the I/O command starts line 1
              F(['RET', 'U2a'], ['RET', 'U2a'], 'user', 'printing line 1 …', '<b>Return right away.</b> The I/O program does not wait. User code ② runs <i>while</i> the printer works in parallel.'),  // frame: the I/O program returns at once, so code 2 runs while the printer works
              F(['C5h'], ['U2a', 'C5h'], 'isr', 'done → raises an interrupt', '<b>Interrupt!</b> The printer finishes partway through code ②. The processor completes its current instruction, saves where it was, and jumps to the <b>interrupt handler</b>, which runs completion code ⑤.', ['U2']),  // frame: the printer interrupts partway through code 2 and the handler runs completion code (mark = where it landed)
              F(['IRET', 'U2b'], ['IRET', 'U2b'], 'user', 'idle', '<b>Return from interrupt.</b> Code ② carries on from the very next instruction, as if nothing had happened.', ['U2']),  // frame: return from interrupt, and code 2 carries on from the next instruction
              F(['W2', 'P4', 'CMD'], ['W2', 'P4'], 'os', 'printing line 2 …', '<b>Second WRITE.</b> Prep ④ and the I/O command start line 2.', ['U2']),  // frame: the second WRITE runs prep and starts line 2
              F(['RET', 'U3a'], ['RET', 'U3a'], 'user', 'printing line 2 …', '<b>Return right away.</b> Code ③ runs while line 2 prints.', ['U2']),  // frame: immediate return, and code 3 runs while line 2 prints
              F(['C5h'], ['U3a', 'C5h'], 'isr', 'done → raises an interrupt', '<b>Interrupt again.</b> Line 2 is done, so the handler runs completion code ⑤.', ['U2', 'U3']),  // frame: the second interrupt lands inside code 3 and the handler runs again
              F(['IRET', 'U3b'], ['IRET', 'U3b'], 'user', 'idle', '<b>Resume ③.</b> The processor never sat idle: both lines printed while user code ran. The only extra cost is the short handler.', ['U2', 'U3']),  // frame: code 3 resumes; the processor never sat idle
            ],  // closes the "short" frames
            long: [  // scenario "long": interrupts, but each line takes longer to print than the user code between WRITEs
              F(['U1'], null, 'user', 'idle', '<b>User code ①.</b> Interrupts again, but now each line takes <i>longer</i> to print than code ② takes to run.'),  // frame: user code 1, with the longer printing time explained
              F(['W1', 'P4'], ['W1', 'P4'], 'os', 'idle', '<b>WRITE.</b> The printer is free, so <b>prep code ④</b> runs straight away.'),  // frame: the printer is free, so prep code runs at once
              F(['CMD'], null, 'os', 'printing line 1 …', '<b>I/O command.</b> Line 1 starts. This one is slow.'),  // frame: the I/O command starts the slow line 1
              F(['RET', 'U2'], ['RET', 'U2'], 'user', 'printing line 1 …', '<b>Return right away.</b> Code ② runs in parallel with the printer.'),  // frame: immediate return, and code 2 runs in parallel with the printer
              F(['W2', 'WAITP'], ['W2', 'WAITP'], 'idle', 'printing line 1 …', '<b>Second WRITE, but the printer is still busy</b> with line 1. A new command cannot be issued yet, and this program has nothing else to do, so the processor waits.'),  // frame: the second WRITE finds the printer still busy, so the processor has to wait
              F(['C5h'], ['WAITP', 'C5h'], 'isr', 'done → raises an interrupt', '<b>Interrupt!</b> Line 1 finishes. The handler runs completion code ⑤.'),  // frame: line 1 finishes and the handler runs completion code
              F(['IRET', 'P4'], ['IRET', 'P4'], 'os', 'idle', '<b>Return from interrupt</b> to the waiting I/O program, which can now run prep code ④ for line 2.'),  // frame: return from interrupt to the waiting I/O program, which prepares line 2
              F(['CMD', 'RET', 'U3'], ['RET', 'U3'], 'user', 'printing line 2 …', '<b>Command, return, code ③.</b> Line 2 prints while code ③ runs.'),  // frame: command, return, and code 3 runs while line 2 prints
              F(['C5h'], ['U3', 'C5h'], 'isr', 'done → raises an interrupt', '<b>Interrupt.</b> Line 2 finishes; the handler runs ⑤ once more, then returns to the program. Interrupts still saved time, but the wait at the second WRITE could not be hidden.'),  // frame: the last interrupt; interrupts saved time, but the wait at the second WRITE could not be hidden
            ],  // closes the "long" frames
          };  // closes the FRAMES table
          const CPU = { user: ['proc', 'running user code'], os: ['os', 'running the I/O program (OS)'], isr: ['intr', 'running the interrupt handler'], idle: ['warn', 'idle: waiting for the printer'] };  // CPU: for each processor activity, the chip colour and the words shown in "Processor right now"
          const EXPLAIN = {  // EXPLAIN: a short summary paragraph for each scenario
            none: 'The processor starts the printer with an <span class="t">I/O command</span>, then does nothing useful until the printer is finished. Every WRITE costs one full printing time.',  // summary for "none": every WRITE costs one full printing time
            short: 'The processor starts the printer with an <span class="t">I/O command</span> and immediately goes back to the user program. The printer’s interrupt tells it when to run the <span class="t">interrupt handler</span>.',  // summary for "short": the processor returns to the user program and the interrupt calls the handler
            long: 'Interrupts help, but if the program reaches its next WRITE before the previous line is done, it still has to wait for that line to finish.',  // summary for "long": a WRITE that comes too soon still has to wait for the previous line
          };  // closes the EXPLAIN table
          let mode = 'none';  // mode is the scenario being shown; it starts with no interrupts
          const svg = s('svg', { viewBox: '0 0 740 366', width: '100%' });  // the flow diagram, an SVG drawing 740 by 366 units
          const stChip = h('span', { class: 'chip' });  // chip showing what the processor is doing in this frame
          const idleOut = h('b', { class: 'num' });  // number of idle waits so far
          const expl = h('p', { class: 'small m0' });  // the scenario summary paragraph
          function draw(i) {  // draw(i): rebuilds the diagram for frame i of the current scenario; the step player calls it on every frame
            const B = layout(mode), frames = FRAMES[mode], fr = frames[i];  // B = block positions for this scenario; fr = this frame
            const seen = new Set(); frames.slice(0, i + 1).forEach((f) => f.act.forEach((a) => seen.add(a)));  // seen collects every block that has run up to and including this frame
            const kids = [  // kids collects every shape; it starts with the fixed parts
              s('defs', {}, s('pattern', { id: 's14-hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },  // defines the striped fill used for the busy-wait blocks
                s('rect', { width: 8, height: 8, style: 'fill:var(--warn-bg)' }), s('line', { x1: 0, y1: 0, x2: 0, y2: 8, class: 's14-hatch-line' }))),  // the stripe pattern's pale background and diagonal line
              s('text', { x: UX, y: 22, class: 't15 bold', style: 'fill:var(--proc)' }, 'User program'),  // heading over the user program column
              s('text', { x: RX, y: 22, class: 't15 bold', style: 'fill:var(--os)' }, 'I/O program (part of the OS)'),  // heading over the I/O program column
              s('text', { x: RX, y: 252, class: 't15 bold', style: 'fill:var(--intr)' }, 'Interrupt handler (part of the OS)'),  // heading over the interrupt handler area
            ];  // ends the fixed parts
            if (mode === 'none') kids.push(s('rect', { x: RX, y: 260, width: RW, height: 64, rx: 8, class: 's-panel', 'stroke-dasharray': '5 4' }),  // with no interrupts, the handler area is an empty dashed box
              s('text', { x: RX + RW / 2, y: 288, class: 't14 mid s-sub' }, 'Not used: with no interrupts'), s('text', { x: RX + RW / 2, y: 308, class: 't14 mid s-sub' }, 'there is no handler'));  // with the note "Not used: with no interrupts there is no handler"
            // history arrows (faint) and the current jump (bold)
            frames.slice(0, i + 1).forEach((f, j) => {  // draws every jump made so far: earlier ones faint, the current one bold
              if (!f.arr) return;  // frames without a jump are skipped
              const a = B[f.arr[0]], b = B[f.arr[1]]; if (!a || !b) return;  // a and b are the blocks the jump goes from and to
              const y1 = a.y + a.h / 2, y2 = b.y + b.h / 2;  // y1 and y2 are the vertical middles of those two blocks
              let d;  // d will hold the curve's drawing instructions
              if (a.x === b.x) d = `M${a.x},${y1} C${a.x - 70},${y1} ${b.x - 70},${y2} ${b.x - 3},${y2}`;   // same column: loop out to the left
              else {  // a jump between columns
                const ltr = a.x < b.x;  // ltr is true when the jump goes left to right
                const x1 = ltr ? a.x + a.w : a.x, x2 = ltr ? b.x - 3 : b.x + b.w + 3, dx = (x2 - x1) * 0.5;  // the curve starts at one block's edge and ends at the other's, bending halfway across
                d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;  // a smooth curve (a cubic Bezier) between the two blocks
              }  // ends the column check
              const isIntr = f.arr[1] === 'C5h';  // a jump into the handler is an interrupt, drawn dashed in the interrupt colour
              kids.push(s('path', { d, fill: 'none', 'stroke-width': j === i ? 3 : 2,  // adds the curve: thicker for the current jump
                style: `stroke:var(--${isIntr ? 'intr' : 'accent'});opacity:${j === i ? 1 : 0.28}`, 'stroke-dasharray': isIntr ? '6 4' : null,  // earlier jumps are drawn faint
                'marker-end': j === i ? `url(#arr-${isIntr ? 'intr' : 'accent'})` : null }));  // only the current jump gets an arrowhead
            });  // ends the jump loop
            for (const [id, b] of Object.entries(B)) {  // draws every block in the scenario
              const on = fr.act.includes(id);  // on is true for the blocks running in this frame
              kids.push(s('g', { class: seen.has(id) || on ? '' : 'dim' },  // blocks that have not run yet are faded
                s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 8, class: 'blk ' + b.cls + (on ? ' glow' : '') }),  // the block's box, with a thick outline when running
                s('text', { x: b.x + b.w / 2, y: b.y + b.h / 2 + 5, class: 't14 mid' + (on ? ' bold' : '') }, b.label)));  // the block's label, bold when running
            }  // ends the block loop
            const last = B[fr.act[fr.act.length - 1]];  // last is the final block running in this frame, where the processor is now
            if (last) kids.push(s('rect', { x: last.x - 12, y: last.y + last.h / 2 - 10, width: 40, height: 20, rx: 10, class: 's-cpu', 'stroke-width': 2 }),  // a small CPU tag sits on that block's left edge
              s('text', { x: last.x + 8, y: last.y + last.h / 2 + 5, class: 't13 mid bold', style: 'fill:var(--cpu)' }, 'CPU'));  // the tag's "CPU" label
            (fr.mark || []).forEach((m) => {  // draws the marks for places where an interrupt landed inside user code
              const y = m === 'U2' ? 152 : 262;  // the mark for code 2 sits between its two halves; the mark for code 3 lower down
              kids.push(s('line', { x1: UX, y1: y, x2: UX + UW + 6, y2: y, 'stroke-width': 2.5, 'stroke-dasharray': '5 3', style: 'stroke:var(--intr)' }),  // a dashed line across the user code at that spot
                s('text', { x: UX + UW + 10, y: y + 5, class: 't13 bold', style: 'fill:var(--intr)' }, '✗ interrupt'));  // labelled "interrupt"
            });  // ends the mark loop
            kids.push(s('rect', { x: UX, y: 336, width: 700, height: 26, rx: 8, class: 's-io', 'stroke-width': 1.5 }),  // the printer status bar along the bottom of the diagram
              s('text', { x: UX + 12, y: 354, class: 't14 bold', style: 'fill:var(--io)' }, 'Printer: ' + fr.prn));  // shows what the printer is doing in this frame
            svg.replaceChildren(...kids);  // swaps all the new shapes into the drawing at once
            const c = CPU[fr.cpu];  // c is the chip style and text for the processor's current activity
            stChip.className = 'chip ' + c[0]; stChip.textContent = c[1];  // updates the "Processor right now" chip
            idleOut.textContent = frames.slice(0, i + 1).filter((f, j) => f.cpu === 'idle' && (j === 0 || frames[j - 1].cpu !== 'idle')).length;  // counts idle waits: each run of back-to-back idle frames counts as one wait
            return fr.cap;  // returns the caption for the player to show
          }  // ends draw()
          const player = ctx.ui.player({ count: FRAMES.none.length, render: draw, interval: 2600 });  // the shell's step player, starting with the no-interrupt scenario's frame count
          const seg = ctx.ui.seg([{ value: 'none', label: 'No interrupts' }, { value: 'short', label: 'Interrupts, short I/O wait' }, { value: 'long', label: 'Interrupts, long I/O wait' }], 'none', (v) => {  // scenario switch with three options
            mode = v; expl.innerHTML = EXPLAIN[v]; player.stop(); player.setCount(FRAMES[v].length);  // switching scenario updates the summary, stops the player, and restarts with the new frame count
          });  // ends the scenario switch
          seg.style.display = 'flex'; seg.style.flexDirection = 'column';  // stacks the scenario buttons vertically so their long labels fit
          expl.innerHTML = EXPLAIN.none;  // shows the no-interrupt summary when the step opens
          el.append(h('div', { class: 'split l3 fill' },  // builds the page: a left column one third wide and a right column two thirds wide
            h('div', { class: 'stack' },  // left column: instructions, scenario switch, status card, summary and a tip
              h('p', { class: 'm0' }, 'Pick a scenario, then step through it. The ', h('b', {}, 'CPU'), ' tag shows where the processor is working right now; faded blocks have not run yet.'),  // instructions: pick a scenario and step through it; the CPU tag shows where the processor is
              seg,  // the scenario switch
              h('div', { class: 'card tight stack gap-s' },  // status card
                h('div', { class: 'small' }, 'Processor right now: ', stChip),  // status line: what the processor is doing now
                h('div', { class: 'small' }, 'Idle waits so far: ', idleOut)),  // status line: the number of idle waits so far
              expl,  // the scenario summary
              h('div', { class: 'callout tip m0 small', 'data-label': 'Notice' }, 'The user program contains no code for the interrupt. The processor and the OS pause it and resume it without it ever knowing.')),  // tip box: the user program has no code for the interrupt; the processor and OS handle it invisibly
            h('div', { class: 'stack gap-s' }, h('div', { class: 'card white tight' }, panWrap(ctx, svg, 660)), player.el,  // right column: the diagram in a white card (swipeable on phone-width screens), then the player
              h('div', { class: 'row gap-s xs' }, h('span', { class: 'chip proc' }, 'user program'), h('span', { class: 'chip os' }, 'OS I/O program'),  // colour key under the diagram: user program and OS I/O program chips
                h('span', { class: 'chip intr' }, 'interrupt handler'), h('span', { class: 'chip warn' }, 'processor idle'), h('span', { class: 'chip accent' }, '→ jump of control')))));  // more key chips: interrupt handler, processor idle, and jump of control; closes the page layout
        },  // ends render() for step 3
      },  // ends step 3

      /* ============ 4. Timing race ============ */
      {  // step 4 object starts here: a timing race between the two approaches
        title: 'Timing race: how much time do interrupts save?',  // step 4 title
        kind: 'lab',  // kind "lab": the student changes the printer time and compares
        render(el, ctx) {  // render(el, ctx): builds step 4 each time it is opened
          const { h, s } = ctx;  // takes both builders from ctx: h for HTML, s for SVG
          const A = 10, P = 2, Q = 2, O = 1, HND = O + Q;   // user code, prep ④, completion ⑤, save/restore overhead
          /* Without interrupts: ① ④ wait ⑤ ② ④ wait ⑤ ③ */
          function noIntr(D) {  // noIntr(D): builds the timeline without interrupts for a printer that takes D time units per line
            const cpu = [], prn = []; let t = 0;  // cpu and prn collect the processor's and the printer's blocks; t is the current time
            const add = (len, kind, label) => { if (len > 0) cpu.push({ s: t, e: t + len, kind, label }); t += len; };  // add(...) appends a processor block of the given length and kind and moves the clock forward
            add(A, 'user', '①');  // user code 1 runs first
            [['1', '②'], ['2', '③']].forEach(([n, next]) => {  // then two WRITEs, each followed by the next stretch of user code (2, then 3)
              add(P, 'os', '④');  // prep code for the WRITE
              prn.push({ s: t, e: t + D, label: 'line ' + n });  // the printer prints this line for D units
              add(D, 'idle', 'idle');  // meanwhile the processor sits idle for the whole printing time
              add(Q, 'os', '⑤');  // completion code once the printer is done
              add(A, 'user', next);  // the next stretch of user code
            });  // ends the WRITE loop
            return { cpu, prn, end: t };  // returns both rows and the finishing time
          }  // ends noIntr()
          /* With interrupts: the printer runs in parallel; its interrupt runs the handler (overhead + ⑤). */
          function withIntr(D) {  // withIntr(D): builds the timeline with interrupts for the same printer time D
            const cpu = [], prn = []; let t = 0, irq = null;  // cpu and prn collect the blocks; t is the current time; irq is when the printer will interrupt (null if nothing is printing)
            const seg = (a, b, kind, label) => { if (b > a) cpu.push({ s: a, e: b, kind, label }); };  // seg(...) records a processor block from time a to time b, skipping empty ones
            const handle = (at) => { seg(at, at + HND, 'isr', '⑤'); return at + HND; };  // handle(at): runs the interrupt handler (save/restore overhead plus completion code) starting at time at
            const waitForIrq = () => { if (irq === null) return; seg(t, irq, 'idle', 'idle'); t = handle(Math.max(t, irq)); irq = null; };  // waitForIrq(): if a line is still printing, idle until its interrupt, then run the handler
            const runUser = (len, label) => {  // runUser(len, label): runs a stretch of user code, letting the interrupt cut into it if it arrives meanwhile
              if (irq !== null && irq >= t && irq < t + len) {  // checks whether the interrupt lands inside this stretch of user code
                const done = irq - t; seg(t, irq, 'user', label); t = handle(irq); irq = null;  // runs up to the interrupt, then the handler
                seg(t, t + len - done, 'user', label); t += len - done;  // then the rest of the user code
              } else { seg(t, t + len, 'user', label); t += len; }  // otherwise the user code runs straight through
            };  // ends runUser()
            const write = (n) => { waitForIrq(); seg(t, t + P, 'os', '④'); t += P; prn.push({ s: t, e: t + D, label: 'line ' + n }); irq = t + D; };  // write(n): a WRITE waits for any earlier line, runs prep code, starts the printer, and notes when it will interrupt
            seg(0, A, 'user', '①'); t = A;  // user code 1 runs from 0 to A
            write('1'); runUser(A, '②'); write('2'); runUser(A, '③'); waitForIrq();  // the program: WRITE, code 2, WRITE, code 3, then wait for the last line to finish
            return { cpu, prn, end: t };  // returns both rows and the finishing time
          }  // ends withIntr()
          const stats = (r) => { const idle = r.cpu.filter((x) => x.kind === 'idle').reduce((n, x) => n + x.e - x.s, 0); return { end: r.end, idle, util: Math.round(((r.end - idle) / r.end) * 100) }; };  // stats(r): adds up the idle time and works out total time and utilization (busy time as a percentage)

          const NW = ctx.narrow, VBW = NW ? 420 : 1120, X0 = NW ? 62 : 150, X1 = VBW - 16, TMAX = 120, K = (X1 - X0) / TMAX;  // NW = phone-width screen; drawing width, the chart's left and right edges, 120 time units shown, and pixels per unit
          const X = (t) => X0 + t * K;  // X(t) turns a time into a horizontal position
          const CLS = { user: 's-proc', os: 's-os', isr: 's-intr', idle: 'idle' };  // CLS: the fill style for each kind of processor block (idle blocks use the striped pattern)
          const svg = s('svg', { viewBox: `0 0 ${VBW} 250`, width: '100%' });  // the race drawing, an SVG 250 units tall
          let D = 6, T = TMAX, R1, R2;  // D = printer time per line (starts at 6); T = the race clock; R1 and R2 = the two timelines
          function row(y, title, r, T) {  // row(y, title, r, T): draws one approach's CPU and printer rows starting at height y
            const out = [s('text', { x: 0, y: y + 14, class: 't15 bold' }, title),  // the row's title
              s('text', { x: X0 - 10, y: y + 49, class: 't14 end s-sub' }, 'CPU'), s('text', { x: X0 - 10, y: y + 88, class: 't14 end s-sub' }, 'Printer')];  // the "CPU" and "Printer" labels to the left of the two bars
            r.cpu.forEach((g) => {  // draws each processor block
              const w = (g.e - g.s) * K;  // w is the block's width in pixels
              out.push(s('rect', { x: X(g.s), y: y + 24, width: w, height: 40, rx: 3, class: 'blk ' + CLS[g.kind], 'stroke-width': 1.5 }));  // the block, coloured by its kind
              const txt = g.kind === 'idle' ? (w >= 44 ? 'idle' : '') : (w >= 15 ? g.label : '');  // its label: "idle" only if the block is wide enough, other labels if at least 15 pixels wide
              if (txt) out.push(s('text', { x: X(g.s) + w / 2, y: y + (g.kind === 'idle' ? 49 : 51), class: 'mid bold', style: `font-size:${g.kind === 'idle' ? 14 : 19}px` }, txt));  // writes the label in the middle of the block
            });  // ends the processor block loop
            r.prn.forEach((g) => {  // draws each printer block
              const w = (g.e - g.s) * K;  // w is the block's width in pixels
              out.push(s('rect', { x: X(g.s), y: y + 70, width: w, height: 26, rx: 3, class: 's-io', 'stroke-width': 1.5 }));  // the printer block
              if (w >= 44) out.push(s('text', { x: X(g.s) + w / 2, y: y + 88, class: 't13 mid' }, g.label));  // its "line 1" or "line 2" label, if there is room
            });  // ends the printer block loop
            const done = T >= r.end;  // done is true once the race clock has passed this approach's finishing time
            out.push(s('text', { x: NW ? X1 : X0, y: y + 14, class: 't14 bold' + (NW ? ' end' : ''), style: `fill:var(--${done ? 'ok' : 'muted'})` },  // status text beside the title: "finished at t = ..." in green, or "running" with the current time
              done ? `✓ finished at t = ${r.end}` : `running …  t = ${Math.floor(T)}`));  // the two possible status texts
            if (done) out.push(s('line', { x1: X(r.end), y1: y + 20, x2: X(r.end), y2: y + 100, 'stroke-width': 2, 'stroke-dasharray': '4 3', style: 'stroke:var(--ok)' }));  // a dashed green line marks where this approach finished
            return out;  // returns the row's shapes
          }  // ends row()
          function draw() {  // draw(): rebuilds the whole race drawing; runs on every animation frame and after every change
            const kids = [s('defs', {}, s('pattern', { id: 's14-hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },  // starts with the striped pattern definition for idle blocks
              s('rect', { width: 8, height: 8, style: 'fill:var(--warn-bg)' }), s('line', { x1: 0, y1: 0, x2: 0, y2: 8, class: 's14-hatch-line' })))];  // the pattern's pale background and diagonal line
            kids.push(...row(0, 'No interrupts', R1, T), ...row(110, 'With interrupts', R2, T));  // the two rows: no interrupts on top, with interrupts below
            if (T < TMAX) kids.push(s('rect', { x: X(T), y: 18, width: X1 - X(T) + 2, height: 198, style: 'fill:var(--panel);opacity:.82' }),  // while the race is running, a see-through veil covers the future
              s('line', { x1: X(T), y1: 16, x2: X(T), y2: 218, class: 'cursor' }));  // and a cursor line marks the current time
            kids.push(s('line', { x1: X0, y1: 222, x2: X1, y2: 222, class: 'axis' }));  // the time axis
            for (let t = 0; t <= TMAX; t += NW ? 30 : 10) kids.push(s('line', { x1: X(t), y1: 222, x2: X(t), y2: 228, class: 'axis' }), s('text', { x: X(t), y: 244, class: 't13 mid s-sub' }, String(t)));  // tick marks and numbers (every 10 units, or every 30 on a small screen)
            kids.push(s('text', { x: X0 - 10, y: 244, class: 't13 end s-sub' }, 'time →'));  // the "time" label at the left of the axis
            svg.replaceChildren(...kids);  // swaps all the new shapes into the drawing at once
          }  // ends draw()
          const statBox = (label) => { const v = h('span', { class: 'v' }); return [h('div', { class: 'stat' }, h('span', { class: 'l' }, label), v), v]; };  // statBox(label) builds one statistic box and returns [the box, the element that holds its number]
          const [n1, nTot] = statBox('Total time'), [n2, nIdle] = statBox('CPU idle'), [n3, nUtil] = statBox('Utilization');  // the three statistics for the no-interrupt run
          const [w1, wTot] = statBox('Total time'), [w2, wIdle] = statBox('CPU idle'), [w3, wUtil] = statBox('Utilization');  // the three statistics for the interrupt run
          const insight = h('div', { class: 'callout why m0 small' });  // the box that explains the result in words
          function update() {  // update(): recomputes both timelines and statistics; runs whenever the printer time changes
            R1 = noIntr(D); R2 = withIntr(D);  // builds both timelines for the current printer time
            const a = stats(R1), b = stats(R2);  // works out their statistics
            nTot.textContent = a.end; nIdle.textContent = a.idle; nUtil.textContent = a.util + '%';  // fills the no-interrupt statistics
            wTot.textContent = b.end; wIdle.textContent = b.idle; wUtil.textContent = b.util + '%';  // fills the interrupt statistics
            const saved = a.end - b.end;  // how many time units interrupts saved
            const head = saved > 0 ? `<b>Interrupts finish ${saved} time units sooner</b> (${Math.round((saved / a.end) * 100)}% less time). ` : '<b>No time saved.</b> ';  // headline: how much sooner interrupts finish, or that nothing was saved
            let body;  // body will hold the explanation
            if (D <= O) body = 'The printer is no slower than the handler’s extra save/restore cost, so overlapping gains nothing.';  // if the printer is no slower than the handler's overhead, overlapping gains nothing
            else if (b.idle === 0) body = 'Short wait: each line finishes while user code is still running, so the processor never idles. Only the handler’s cost remains.';  // short wait: each line finishes during user code, so the processor never idles
            else body = 'Long wait: a line outlasts the 10 units of user code between WRITEs, so some idle time (hatched) remains.';  // long wait: a line outlasts the user code between WRITEs, so some idle time remains
            insight.innerHTML = head + body;  // shows the explanation
            preset.set(D === 6 ? 's' : D === 25 ? 'l' : null);  // lights the matching preset button (short = 6, long = 25), or none for other values
            draw();  // redraws the chart
          }  // ends update()
          const slider = ctx.ui.slider({ label: 'Printer time per line', min: 1, max: 40, value: D, format: (v) => v + ' units', onInput: (v) => { D = v; stopRace(); update(); } });  // slider for the printer time per line (1 to 40 units); moving it stops any race and recomputes
          const preset = ctx.ui.seg([{ value: 's', label: 'Short wait (6)' }, { value: 'l', label: 'Long wait (25)' }], 's', (v) => { D = v === 's' ? 6 : 25; slider.set(D); stopRace(); update(); });  // two preset buttons, short wait (6) and long wait (25), which also move the slider
          let stopFn = null;  // stopFn holds the function that stops the running race animation, or null
          const stopRace = () => { if (stopFn) stopFn(); stopFn = null; T = TMAX; raceBtn.textContent = '▶ Race'; };  // stopRace(): stops the animation, shows the full chart, and resets the button label
          const raceBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => {  // Race button: starts the animated race, or stops it if one is running
            if (stopFn) { stopRace(); draw(); return; }  // if a race is running, stop it and redraw the full chart
            T = 0; let last = null; raceBtn.textContent = '■ Stop';  // starts the clock at 0; last remembers the previous frame's timestamp
            stopFn = ctx.raf((now) => {  // ctx.raf calls this function on every animation frame (about 60 times a second) until it returns false
              if (last === null) last = now;  // the first frame just records its timestamp
              T = Math.min(TMAX, T + ((now - last) / 1000) * 32); last = now;  // advances the race clock by 32 time units per real second, capped at the end of the chart
              draw();  // redraws with the veil at the new time
              if (T >= Math.max(R1.end, R2.end) + 2) { T = TMAX; stopFn = null; raceBtn.textContent = '▶ Race'; draw(); return false; }  // a little after both approaches finish, the race stops by itself and shows the full chart
            });  // ends the animation function
          } }, '▶ Race');  // ends the Race button
          slider.style.flex = '1'; slider.style.minWidth = '260px';  // lets the slider take the spare width in its row
          el.append(h('div', { class: 'stack fill gap-s' },  // builds the page: one column
            h('div', { class: 'row' }, slider, preset, raceBtn),  // top row: slider, presets and Race button
            h('div', { class: 'card white tight' }, svg),  // the race drawing in a white card
            h('div', { class: 'row gap-s xs' },  // colour key chips under the drawing
              h('span', { class: 'chip proc' }, '①②③ user code (10 each)'), h('span', { class: 'chip os' }, '④ prep (2), ⑤ completion (2)'),  // key: user code (10 units each) and OS prep and completion (2 each)
              h('span', { class: 'chip intr' }, 'handler: ⑤ + save/restore (3)'), h('span', { class: 'chip warn' }, 'idle'), h('span', { class: 'chip io' }, 'printer busy')),  // key: the handler (completion plus 3 units of save/restore), idle, and printer busy
            h('div', { class: 'grid-3' },  // a 3-column row: the two sets of statistics and the explanation
              h('div', { class: 'card tight stack gap-s' }, h('div', { class: 'b small' }, 'No interrupts'), h('div', { class: 'row', style: { gap: '22px' } }, n1, n2, n3)),  // statistics card for the no-interrupt run
              h('div', { class: 'card tight stack gap-s' }, h('div', { class: 'b small' }, 'With interrupts'), h('div', { class: 'row', style: { gap: '22px' } }, w1, w2, w3)),  // statistics card for the interrupt run
              insight),  // the explanation box
            h('p', { class: 'small m0 muted' }, h('b', {}, 'Try this: '), 'drag the slider slowly from 1 up to 40. The “with interrupts” row first shows idle time at 11 units, the moment a line takes longer than the 10 units of user code between WRITEs. That is the line between a short and a long I/O wait.')));  // "try this": idle time first appears at 11 units, where a short wait becomes a long wait
          update();  // computes and draws everything when the step opens
        },  // ends render() for step 4
      },  // ends step 4

      /* ============ 5. The interrupt stage in the instruction cycle ============ */
      {  // step 5 object starts here: the interrupt stage added to the instruction cycle
        title: 'The interrupt stage: a check after every instruction',  // step 5 title
        kind: 'explore',  // kind "explore": the student steps through the cycle and raises interrupts
        core: true,  // core: true keeps this key step on the core path
        render(el, ctx) {  // render(el, ctx): builds step 5 each time it is opened
          const { h, s } = ctx;  // takes both builders from ctx: h for HTML, s for SVG
          const PROG = {  // PROG: the instructions in memory, each as [instruction, plain meaning]
            300: ['LOAD R1, [count]', 'copy a number from memory into R1'], 301: ['ADD R1, 1', 'add 1 to R1'],  // user program at 300-301: load a counter into R1, add 1 to it
            302: ['STORE R1, [count]', 'write R1 back to memory'], 303: ['JUMP 300', 'loop back to address 300'],  // user program at 302-303: store it back, jump back to 300
            900: ['SAVE registers', 'push the registers the handler will use (R1…R3) onto the stack'], 901: ['READ printer status', 'find out what the printer needs and send it the next line'],  // handler at 900-901: save registers, read the printer status and send the next line
            902: ['RESTORE registers', 'pop R1…R3 back, so they hold the program’s values again'], 903: ['RETURN from interrupt', 'pop the PC and PSW, so the program resumes where it stopped'],  // handler at 902-903: restore the registers, return from interrupt
          };  // closes the PROG table
          let st;  // st holds the whole machine state; fresh() builds a clean one
          const fresh = () => ({ last: null, edge: null, pc: 300, ir: null, pending: false, en: true, kernel: false, stack: [], user: 0, hnd: 0, served: 0, handler: false });  // fresh state: PC at 300, nothing pending, interrupts enabled, user mode, empty stack, all counters at 0
          /* ---- the cycle diagram ---- */
          const svg = s('svg', { viewBox: '0 0 540 266', width: '100%' });  // the cycle diagram, an SVG drawing 540 by 266 units
          const BOX = { fetch: [110, 12, 'Fetch stage', 'IR ← memory[PC];  PC ← PC + 1', 's-cpu'], exec: [110, 102, 'Execute stage', 'carry out the instruction in IR', 's-cpu'], intr: [110, 192, 'Interrupt stage', 'is an interrupt pending?', 's-intr'] };  // BOX: the three stage boxes, each as [x, y, title, what it does, colour class]
          const EDGE = {  // EDGE: the arrows between the stages, as SVG path instructions
            'f-e': ['M215,72 V100', ''], 'e-i': ['M215,162 V190', ''],  // arrows: fetch to execute, and execute to the interrupt check
            'i-f': ['M110,222 H46 V30 H108', ''], 'e-f': ['M320,132 H352 V56 H322', ''],  // arrows: no interrupt pending back to fetch, and (dashed) execute straight to fetch when interrupts are disabled
            'i-h': ['M320,222 H370', ''], 'h-f': ['M452,192 V22 H322', ''],  // arrows: interrupt check to the handler entry, and handler entry up to the next fetch
          };  // closes the EDGE table
          function drawCycle() {  // drawCycle(): redraws the cycle diagram, highlighting the stage and arrow just used
            const on = (e) => st.edge === e || (st.handler && st.last === 'intr' && e === 'i-h') || (st.handler && st.last === 'intr' && e === 'e-i');  // on(e): true for the arrow just taken, and for the path into the handler when an interrupt was accepted
            const kids = Object.entries(EDGE).map(([k, [d]]) => s('path', { d, fill: 'none', 'stroke-width': on(k) ? 3.5 : 2, 'stroke-dasharray': k === 'e-f' ? '6 4' : null,  // draws each arrow: thick with an accent arrowhead when active, grey otherwise; the skip-check arrow is dashed
              style: `stroke:var(--${on(k) ? 'accent' : 'line-2'})`, 'marker-end': `url(#arr-${on(k) ? 'accent' : 'muted'})` }));  // the arrow's colour and arrowhead
            for (const [k, [x, y, t1, t2, cls]] of Object.entries(BOX)) {  // draws the three stage boxes
              const act = st.last === k;  // act is true for the stage that just ran
              kids.push(s('rect', { x, y, width: 210, height: 60, rx: 12, class: 'blk ' + cls + (act ? ' glow' : ''), style: act ? '' : 'opacity:.75' }),  // the stage box, glowing when active and slightly faded otherwise
                s('text', { x: x + 105, y: y + 25, class: 't15 mid bold' }, t1), s('text', { x: x + 105, y: y + 46, class: 't13 mid s-sub' }, t2));  // the stage title and its one-line description
            }  // ends the box loop
            const hAct = st.handler && st.last === 'intr';  // hAct is true when the interrupt check just sent control to the handler
            kids.push(s('rect', { x: 372, y: 192, width: 160, height: 64, rx: 12, class: 'blk s-os' + (hAct ? ' glow' : ''), style: hAct ? '' : 'opacity:.75' }),  // the handler entry box, glowing when just used
              s('text', { x: 452, y: 213, class: 't13 mid bold' }, 'Save PC + PSW'), s('text', { x: 452, y: 231, class: 't13 mid bold' }, 'PC ← 900'), s('text', { x: 452, y: 249, class: 't13 mid s-sub' }, '(handler start)'),  // its text: save PC and PSW, load PC with 900, start of the handler
              s('text', { x: 345, y: 214, class: 't13 mid', style: 'fill:var(--intr)' }, 'yes'),  // "yes" label on the arrow into the handler
              s('text', { x: 36, y: 126, class: 't13 mid s-sub', transform: 'rotate(-90 36 126)' }, 'none pending → next fetch'),  // sideways label on the left arrow: no interrupt pending, go to the next fetch
              s('text', { x: 360, y: 80, class: 't13 s-sub' }, 'interrupts'), s('text', { x: 360, y: 97, class: 't13 s-sub' }, 'disabled:'), s('text', { x: 360, y: 114, class: 't13 s-sub' }, 'skip check'),  // label on the dashed arrow: interrupts disabled, skip the check
              s('text', { x: 460, y: 90, class: 't13 s-sub' }, 'next fetch'), s('text', { x: 460, y: 107, class: 't13 s-sub' }, 'comes from'), s('text', { x: 460, y: 124, class: 't13 s-sub' }, 'the handler'));  // label on the right arrow: the next fetch comes from the handler
            svg.replaceChildren(...kids);  // swaps all the new shapes into the drawing at once
          }  // ends drawCycle()
          /* ---- the processor panel ---- */
          const vPC = h('b', { class: 'mono' }), vIR = h('span', { class: 'mono small' }), vPSW = h('span', { class: 'small' }), vStack = h('span', { class: 'mono small' });  // value boxes for the PC, IR, PSW and stack readouts
          const vMean = h('div', { class: 'small', style: { gridColumn: '1 / -1', color: 'var(--ink-2)', lineHeight: '1.35' } });   // plain-language meaning of the instruction in IR
          const lamp = h('span', { class: 'lamp' }), vPend = h('span', { class: 'small' });  // the pending-interrupt lamp and its text
          const vCount = h('div', { class: 'xs muted' });  // the counters line under the panel
          const rows = {};  // rows remembers each memory row and its PC marker by address
          const memTbl = h('table', { class: 'tbl compact' });  // the memory table showing both the user program and the handler
          const addRows = (title, addrs) => {  // addRows(title, addrs): adds a heading row and one row per address to the memory table
            memTbl.append(h('tr', {}, h('th', { colspan: 2 }, title)));  // the heading row, spanning both columns
            addrs.forEach((a) => { const pcMark = h('span', { class: 'chip cpu', style: { marginLeft: '6px', display: 'none' } }, '← PC'); rows[a] = [h('tr', {}, h('td', { class: 'mono' }, String(a)), h('td', { class: 'mono' }, PROG[a][0], pcMark)), pcMark]; memTbl.append(rows[a][0]); });  // each row shows the address and instruction, with a hidden "← PC" marker chip
          };  // ends addRows()
          addRows('User program', [300, 301, 302, 303]); addRows('Interrupt handler (OS)', [900, 901, 902, 903]);  // fills the table: the user program at 300-303, then the handler at 900-903
          const log = h('div', { class: 'mini-log', style: { height: '112px' } });  // the event log, newest line at the top
          const say = (msg, cls) => { log.prepend(h('div', { html: msg, style: cls ? { color: `var(--${cls})` } : null })); while (log.children.length > 40) log.lastChild.remove(); };  // say(msg, cls): adds a line to the top of the log (optionally coloured) and keeps at most 40 lines
          const nextLabel = () => (st.last === 'fetch' ? 'Execute' : st.last === 'exec' ? (st.en ? 'Interrupt check' : 'Fetch') : 'Fetch');  // nextLabel(): names the stage that will run next; after execute it is the interrupt check only if interrupts are enabled
          const nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => stepOnce() });  // the main button that runs the next stage
          function paint() {  // paint(): copies the machine state onto the page; runs after every stage and every button press
            drawCycle();  // redraws the cycle diagram
            vPC.textContent = st.pc;  // shows the PC
            vIR.textContent = st.ir == null ? '(empty)' : `${st.ir}: ${PROG[st.ir][0]}`;  // shows the IR as address and instruction, or "(empty)"
            vMean.innerHTML = st.ir == null ? '<i>The IR holds the instruction being executed; nothing is fetched yet.</i>' : `<i>Meaning:</i> ${PROG[st.ir][1]}.`;  // explains the instruction in the IR in plain words
            vPSW.innerHTML = `mode <b>${st.kernel ? 'kernel' : 'user'}</b> · interrupts <b style="color:var(--${st.en ? 'ok' : 'bad'})">${st.en ? 'enabled' : 'disabled'}</b>`;  // shows the PSW: user or kernel mode, and whether interrupts are enabled (green) or disabled (red)
            vStack.textContent = st.stack.length ? st.stack.map((x) => (x.regs ? 'R1…R3' : `PC=${x.pc}, PSW(user, ${x.en ? 'on' : 'off'})`)).join(' | ') : '(empty)';  // shows the stack contents: saved registers, or a saved PC and PSW
            lamp.classList.toggle('on', st.pending); vPend.textContent = st.pending ? 'printer interrupt waiting' : 'none';  // lights the lamp and updates its text when a printer interrupt is pending
            Object.entries(rows).forEach(([a, [tr, mark]]) => { tr.classList.toggle('on', +a === st.ir); mark.style.display = +a === st.pc ? '' : 'none'; });  // highlights the memory row in the IR and shows the "← PC" marker on the row the PC points at
            vCount.textContent = `User instructions done: ${st.user} · handler instructions (overhead): ${st.hnd} · interrupts served: ${st.served}`;  // counts user instructions, handler instructions (the overhead) and interrupts served
            nextBtn.textContent = 'Run next stage: ' + nextLabel() + ' ▶';  // labels the main button with the stage that will run next
            enSeg.set(st.en);  // keeps the enable/disable switch in step with the state (the handler can change it)
          }  // ends paint()
          function stepOnce() {  // stepOnce(): runs the next stage of the cycle; the main button and auto-run both call it
            const stage = st.last === 'fetch' ? 'exec' : st.last === 'exec' ? (st.en ? 'intr' : 'fetch') : 'fetch';  // picks the stage: execute after fetch; after execute, the interrupt check (or fetch if interrupts are off); otherwise fetch
            if (stage === 'fetch') {  // fetch stage
              st.edge = st.last === 'exec' ? 'e-f' : st.last === 'intr' ? (st.handler ? 'h-f' : 'i-f') : null;  // records which arrow led here: skip-check, from the handler entry, or the normal no-interrupt path
              if (st.last === 'exec') say('Interrupts are disabled, so the interrupt stage is skipped.', 'muted');  // if we came straight from execute, the log explains that the interrupt check was skipped
              st.handler = false; st.ir = st.pc; st.pc += 1;  // copies the instruction at the PC into the IR and adds 1 to the PC
              say(`<b>Fetch</b> ${st.ir}: ${PROG[st.ir][0]}. PC → ${st.pc}.`);  // logs the fetch and the new PC
            } else if (stage === 'exec') {  // execute stage
              st.edge = 'f-e';  // the arrow from fetch to execute
              if (st.ir === 303) st.pc = 300;  // JUMP 300 puts 300 back into the PC
              if (st.ir === 900) st.stack.push({ regs: true });                       // software saves the registers it will use
              if (st.ir === 902 && st.stack.length && st.stack[st.stack.length - 1].regs) st.stack.pop();   // ...and restores them
              if (st.ir === 903) { const sv = st.stack.pop(); st.pc = sv.pc; st.en = sv.en; st.kernel = false; }  // RETURN from interrupt pops the saved PC and PSW, so user mode and the old interrupt setting come back
              if (st.ir >= 900) st.hnd++; else st.user++;  // counts the instruction as user work or handler overhead
              say(`<b>Execute</b> ${PROG[st.ir][0]}: ${PROG[st.ir][1]}.` + (st.ir === 903 ? ` PC is back to ${st.pc}, user mode, interrupts on.` : ''));  // logs what the instruction did, adding the restored state after a RETURN
              if (st.ir === 903) say('That detour cost 4 handler instructions (including its own register save and restore) plus the hardware’s push and pop of the PC and PSW: this is <b>overhead</b>. It is tiny next to the millions of instruction-times the processor would otherwise spend waiting for the printer.', 'ok');  // after a RETURN, the log sums up the overhead and compares it with the millions of cycles saved
            } else {  // interrupt stage
              st.edge = 'e-i';  // the arrow from execute to the interrupt check
              if (st.pending) {  // if a request is waiting
                st.stack.push({ pc: st.pc, en: st.en });  // push the PC and the interrupt setting onto the stack
                say(`<b>Interrupt stage:</b> request found! Acknowledge it, push the PC (${st.pc}) and PSW onto the stack, then PC ← 900, kernel mode, interrupts off.`, 'intr');  // logs the acknowledgment and the switch into the handler
                st.pc = 900; st.en = false; st.kernel = true; st.pending = false; st.handler = true; st.served++;  // PC gets the handler address 900, interrupts go off, kernel mode on, the request is cleared and counted
              } else { st.handler = false; say('<b>Interrupt stage:</b> nothing pending, carry on.', 'muted'); }  // with nothing pending the log says so and the next fetch continues the program
            }  // ends the stage choice
            st.last = stage;  // remembers which stage just ran
            paint();  // repaints everything
          }  // ends stepOnce()
          let auto = false;  // auto is true while auto-run is on
          const setAuto = (v) => { auto = v; autoBtn.classList.toggle('on', auto); autoBtn.textContent = auto ? 'Pause auto-run' : 'Auto-run'; };  // setAuto(v): turns auto-run on or off and updates its button
          const autoBtn = h('button', { class: 'btn', type: 'button', onclick: () => setAuto(!auto) }, 'Auto-run');  // the Auto-run button toggles auto-run
          ctx.every(1000, () => { if (auto) stepOnce(); });  // every second, while auto-run is on, run one stage (ctx.every stops this when the step closes)
          const irqBtn = h('button', { class: 'btn intr', type: 'button', onclick: () => {  // button that raises the printer's interrupt request
            if (st.pending) { ctx.toast('The printer’s request is already waiting.'); return; }  // a second request while one is already waiting just shows a short pop-up message (ctx.toast)
            st.pending = true;  // marks the request as pending
            say((st.last === 'fetch' ? 'Printer raises an interrupt <i>in the middle of an instruction</i>. It must wait until the instruction finishes.' : 'Printer raises an interrupt request. It waits for the next interrupt stage.') + (st.en ? '' : ' Interrupts are off, so it stays <b>pending</b> until they are turned back on.'), 'intr');  // logs when it will be noticed: after the current instruction, at the next interrupt stage, or once interrupts are on again
            paint();  // repaints so the lamp lights up
          } }, 'Raise printer interrupt');  // ends the interrupt button
          const enSeg = ctx.ui.seg([{ value: true, label: 'Interrupts on' }, { value: false, label: 'Off' }], true, (v) => {  // switch to turn interrupts on or off
            if (st.kernel) { ctx.toast('The handler runs with interrupts disabled; RETURN turns them back on.'); enSeg.set(st.en); return; }  // inside the handler the switch is locked, since interrupts stay off until RETURN
            st.en = v; say(v ? 'Interrupts enabled again: a pending request will be noticed at the next interrupt stage.' : 'Interrupts disabled (on a real machine only the OS is allowed to do this). The interrupt stage is now skipped, so any request stays pending.', 'muted'); paint();  // applies the setting and logs what it means for pending requests
          });  // ends the switch
          const resetBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => { setAuto(false); st = fresh(); log.replaceChildren(); say('Reset. Press “Run next stage”, raise an interrupt at any moment, and watch when it is noticed.'); paint(); } }, 'Reset');  // Reset button: stops auto-run, rebuilds a fresh state, clears the log and repaints
          st = fresh();  // creates the starting state
          el.append(h('div', { class: 'split fill' },  // builds the page: two equal columns
            h('div', { class: 'stack' }, h('div', { class: 'card white tight' }, panWrap(ctx, svg, 520)),  // left column: the cycle diagram in a white card (swipeable on phone-width screens)
              h('div', { class: 'callout tip m0 small', 'data-label': 'Reading the processor panel', html: '<b>R1, R2 …</b> Real processors have many general-purpose registers, not the single <span class="t" data-t="Accumulator (AC)">AC</span> of section 1.3. <b>PSW mode:</b> programs run in the less-privileged <b>user mode</b>, the OS in the privileged <span class="t">kernel mode</span> (more in 2.2 and 3.4).' }),  // tip box: why there are registers R1, R2 and how user and kernel mode differ
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake' }, h('span', { html: 'A device’s interrupt request never cuts an instruction in half. The processor finishes the current instruction and only looks for requests in the <span class="t">interrupt stage</span>, which is added to the <span class="t">instruction cycle</span> right after execute.' }))),  // "common mistake" box: an interrupt never cuts an instruction in half; it is checked after execute
            h('div', { class: 'stack gap-s' },  // right column: controls, processor panel, memory, counters and log
              h('div', { class: 'row gap-s' }, nextBtn, irqBtn),  // row: Run next stage and Raise printer interrupt
              h('div', { class: 'row gap-s' }, autoBtn, enSeg, resetBtn),  // row: Auto-run, the interrupt switch, and Reset
              h('div', { class: 'grid-2', style: { gridTemplateColumns: 'minmax(0,5fr) minmax(0,6fr)', gap: '10px' } },  // two columns: the register panel and the memory table
                h('div', { class: 'card cpu tight stack gap-s' }, h('h4', { class: 'm0' }, 'Processor registers'),  // the register panel card with its heading
                  h('div', { class: 'kv' }, h('span', {}, h('span', { class: 't', 'data-t': 'Program counter (PC)' }, 'PC')), vPC,  // key-value list: PC and its value (the dotted name links to the glossary)
                    h('span', {}, h('span', { class: 't', 'data-t': 'Instruction register (IR)' }, 'IR')), vIR, vMean,  // IR, its value, and its plain meaning spanning both columns
                    h('span', {}, h('span', { class: 't', 'data-t': 'Program status word (PSW)' }, 'PSW')), vPSW, h('span', {}, 'Pending'), h('span', {}, lamp, ' ', vPend)),  // PSW and its value, then the pending lamp and its text
                  h('div', { class: 'small' }, h('span', { class: 't', 'data-t': 'Control stack' }, 'Control stack'), ': ', vStack)),  // the control stack line under the list
                memTbl),  // the memory table beside the panel
              vCount, log)));  // the counters line and the log at the bottom
          say('Press “Run next stage”, raise an interrupt at any moment, and watch <i>when</i> the processor notices it.');  // first log message when the step opens
          paint();  // first paint
        },  // ends render() for step 5
      },  // ends step 5

      /* ============ 6. The nine steps of interrupt processing ============ */
      {  // step 6 object starts here: the nine steps of interrupt processing
        title: 'Nine steps: what exactly happens during an interrupt',  // step 6 title
        kind: 'explore',  // kind "explore": the student steps through the process
        core: true,  // core: true keeps this key step on the core path
        render(el, ctx) {  // render(el, ctx): builds step 6 each time it is opened
          const { h, s } = ctx;  // takes both builders from ctx: h for HTML, s for SVG
          /* ---- the frames: full machine state after each step ---- */
          const R0 = { PC: '401', PSW: 'user, int on', SP: '1000', R1: '17', R2: '42', R3: '8' };  // R0: the register values before the interrupt (PC 401, user mode, stack pointer at 1000, and R1-R3)
          const PSW0 = 'PSW (user, int on)';  // PSW0: how the saved PSW appears on the stack
          const F = [];  // F collects the frames, one per step
          const add = (patch, cap) => {             // each frame = previous frame + the changes this step makes
            const prev = F[F.length - 1] || { regs: R0, stack: {}, irq: false, ack: false, prn: 'printing a line …', mem: 400 };  // prev is the last frame, or the starting state for the first one
            const { regs, stack, arrows, ...rest } = patch;  // splits the changes into registers, stack, arrows and everything else
            F.push(Object.assign({}, prev, rest, { regs: Object.assign({}, prev.regs, regs || {}), stack: stack || prev.stack, arrows: arrows || [], cap }));  // copies the previous frame, applies this step's changes, and saves it with its caption
          };  // ends add()
          add({}, '<b>Before.</b> The user program is running. The processor is executing the instruction at <b>N = 400</b> (ADD R1, R2), so the PC already holds the next address, <b>N+1 = 401</b>. The printer is busy.');  // frame "Before": the ADD at 400 is running and the PC already holds 401
          add({ irq: true, prn: 'done! request line raised' }, '<b>Step 1 · hardware.</b> The printer finishes its line and raises its <b>interrupt request</b>. Nothing inside the processor has changed yet.');  // step 1 (hardware): the printer raises its interrupt request
          add({ regs: { R1: '59' } }, '<b>Step 2 · hardware.</b> The processor <b>finishes the current instruction</b>: the ADD completes, so R1 becomes 17 + 42 = 59. An instruction is never abandoned halfway.');  // step 2 (hardware): the processor finishes the ADD, so R1 becomes 59
          add({ irq: false, ack: true, prn: 'acknowledged: request dropped' }, '<b>Step 3 · hardware.</b> In the interrupt stage the processor finds the pending request and sends an <b>acknowledgment</b>. The printer lowers its request line.');  // step 3 (hardware): the processor acknowledges the request and the printer drops its request line
          add({ regs: { SP: '998' }, stack: { 999: PSW0, 998: 'PC = 401' }, ack: false, arrows: [['PSW', 999], ['PC', 998]] }, '<b>Step 4 · hardware.</b> The processor pushes the <b>PSW</b> and the <b>PC (401)</b> onto the control stack; the <span class="t" data-t="Stack pointer (SP)">stack pointer</span> moves from 1000 down to 998. These two must be saved first because the next step overwrites them.');  // step 4 (hardware): the PSW and PC are pushed onto the stack and the stack pointer drops to 998
          add({ regs: { PC: '900', PSW: 'kernel, int off' }, mem: 900, arrows: [[900, 'PC']] }, '<b>Step 5 · hardware.</b> The processor loads the PC with the right handler’s start address, <b>Y = 900</b> (it learns which handler from the interrupt signal or by asking the device), and switches to <span class="t">kernel mode</span> with interrupts disabled. The next fetch comes from the handler.');  // step 5 (hardware): PC gets the handler address 900, kernel mode, interrupts off
          add({ regs: { SP: '995' }, stack: { 999: PSW0, 998: 'PC = 401', 997: 'R1 = 59', 996: 'R2 = 42', 995: 'R3 = 8' }, arrows: [['R1', 997], ['R2', 996], ['R3', 995]] }, '<b>Step 6 · software.</b> The handler’s first instructions push R1, R2 and R3 onto the stack (SP → 995). The program’s whole <span class="t" data-t="Context (processor state)">context</span> is now safe.');  // step 6 (software): the handler pushes R1, R2 and R3, so the whole context is saved
          add({ regs: { R1: '1', R2: '7', R3: '0' }, mem: 901, prn: 'printing the next line …' }, '<b>Step 7 · software.</b> The handler does the real work: it reads the printer’s status and sends the next line. It uses R1–R3 freely, overwriting the program’s values.');  // step 7 (software): the handler serves the printer and overwrites R1-R3
          const OLD3 = { 997: 'R1 = 59', 996: 'R2 = 42', 995: 'R3 = 8' };  // OLD3: the three register copies left behind in memory after they are popped
          add({ regs: { R1: '59', R2: '42', R3: '8', SP: '998' }, stack: { 999: PSW0, 998: 'PC = 401' }, stale: OLD3, mem: 902, arrows: [[995, 'R3'], [996, 'R2'], [997, 'R1']] }, '<b>Step 8 · software.</b> The handler pops the saved values back into R3, R2 and R1 (SP → 998). R1 holds 59 again. The old copies stay in memory (faded), but they now count as free space.');  // step 8 (software): the handler pops R3, R2 and R1 back; the old copies are shown faded
          add({ regs: { PC: '401', PSW: 'user, int on', SP: '1000' }, stack: {}, stale: Object.assign({ 999: PSW0, 998: 'PC = 401' }, OLD3), mem: 903, arrows: [[998, 'PC'], [999, 'PSW']] }, '<b>Step 9 · software.</b> The handler ends with a special return-from-interrupt instruction that pops the PC and PSW (SP → 1000). PC = 401, user mode, interrupts on.');  // step 9 (software): return from interrupt pops the PC and PSW, back to user mode
          add({ mem: 401 }, '<b>Resumed.</b> The processor fetches the instruction at N + 1 = 401. The program carries on exactly where it stopped and never knew it was interrupted.');  // frame "Resumed": the processor fetches 401 as if nothing had happened
          /* ---- geometry ---- */
          const REGS = ['PC', 'PSW', 'SP', 'R1', 'R2', 'R3'];  // REGS: the six registers shown in the diagram, top to bottom
          const regY = (r) => 148 + REGS.indexOf(r) * 34;  // regY(r): the vertical position of register r
          /* [address, instruction, tag, plain-language comment] */
          const MEM = [[400, 'ADD R1, R2', 'N', 'R1 ← R1 + R2'], [401, 'STORE R1, [sum]', 'N+1', 'copy R1 into sum'], [402, 'JUMP 380', '', 'go back to 380'],  // MEM: the memory rows, each as [address, instruction, tag (N, N+1 or Y), plain comment]
            [900, 'SAVE registers', 'Y', 'push R1, R2, R3'], [901, 'READ printer status', '', 'serve printer'], [902, 'RESTORE registers', '', 'pop R3, R2, R1'], [903, 'RETURN from interrupt', '', 'pop PC + PSW']];  // handler rows at 900-903, with Y marking the handler's start address
          const memY = { 400: 54, 401: 74, 402: 94, 900: 142, 901: 162, 902: 182, 903: 202 };  // memY: the vertical position of each memory row
          const stkY = (a) => 252 + (999 - a) * 20;  // stkY(a): the vertical position of stack address a (999 at the top, growing downward)
          const anchor = (k) => (typeof k === 'string' ? [242, regY(k) + 14] : k >= 995 && k <= 999 ? [330, stkY(k) + 10] : [300, memY[k] + 10]);   // program/handler rows: start left of the N / Y tag
          const svg = s('svg', { viewBox: '0 0 660 372', width: '100%' });  // the machine diagram, an SVG drawing 660 by 372 units
          function draw(i) {  // draw(i): rebuilds the diagram for frame i; the step player calls it on every frame
            const f = F[i], p = F[Math.max(0, i - 1)];  // f is this frame and p the frame before, so changes can be spotted
            const kids = [  // kids collects every shape; it starts with the fixed parts
              s('rect', { x: 10, y: 8, width: 232, height: 64, rx: 10, class: 's-io', 'stroke-width': 2 }),  // the printer box at the top left
              s('text', { x: 24, y: 32, class: 't15 bold', style: 'fill:var(--io)' }, 'Printer (I/O device)'), s('text', { x: 24, y: 56, class: 't14' }, f.prn),  // the printer's title and its current status line
              s('line', { x1: 70, y1: 74, x2: 70, y2: 106, 'stroke-width': f.irq ? 4 : 2, style: `stroke:var(--${f.irq ? 'intr' : 'line-2'})`, 'marker-end': `url(#arr-${f.irq ? 'intr' : 'muted'})` }),  // the request line from the printer down to the processor, thick and interrupt-coloured while raised
              s('text', { x: 78, y: 96, class: 't13', style: `fill:var(--${f.irq ? 'intr' : 'muted'})` }, 'request'),  // its "request" label
              s('line', { x1: 190, y1: 110, x2: 190, y2: 78, 'stroke-width': f.ack ? 4 : 2, style: `stroke:var(--${f.ack ? 'cpu' : 'line-2'})`, 'marker-end': `url(#arr-${f.ack ? 'cpu' : 'muted'})` }),  // the acknowledgment line from the processor up to the printer, lit during step 3
              s('text', { x: 198, y: 96, class: 't13', style: `fill:var(--${f.ack ? 'cpu' : 'muted'})` }, 'ack'),  // its "ack" label
              s('rect', { x: 10, y: 112, width: 232, height: 240, rx: 12, class: 's-cpu', 'stroke-width': 2 }),  // the processor box
              s('text', { x: 24, y: 136, class: 't15 bold', style: 'fill:var(--cpu)' }, 'Processor'),  // the processor's title
              s('rect', { x: 296, y: 4, width: 358, height: 362, rx: 12, class: 's-mem', 'stroke-width': 2 }),  // the main memory box on the right
              s('text', { x: 306, y: 24, class: 't15 bold', style: 'fill:var(--mem)' }, 'Main memory'),  // the memory's title
              s('text', { x: 334, y: 48, class: 't13 bold' }, 'User program'), s('text', { x: 334, y: 136, class: 't13 bold' }, 'Interrupt handler (OS)'),  // headings for the user program area and the handler area in memory
              s('text', { x: 334, y: 246, class: 't13 bold' }, 'Control stack (T = 1000, grows down)'),  // heading for the control stack area, which starts at T = 1000 and grows toward lower addresses
            ];  // ends the fixed parts
            REGS.forEach((r) => {  // draws each register
              const y = regY(r), ch = f.regs[r] !== p.regs[r] && i > 0;  // its position, and whether this step changed its value
              kids.push(s('text', { x: 24, y: y + 19, class: 't14 bold' }, r),  // the register's name
                s('rect', { x: 70, y, width: 164, height: 28, rx: 6, class: ch ? 's-accent glow' : 's-panel', 'stroke-width': ch ? 3 : 1.5 }),  // its value box, glowing when just changed
                s('text', { x: 78, y: y + 19, class: 't14 s-monot' + (ch ? ' bold' : '') }, f.regs[r]));  // the value itself, bold when just changed
            });  // ends the register loop
            MEM.forEach(([a, txt, tag, note]) => {  // draws each memory row of program and handler
              const y = memY[a], on = f.mem === a;  // its position, and whether it is the instruction being fetched in this frame
              kids.push(s('rect', { x: 332, y, width: 316, height: 20, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 2.5 : 1 }),  // the row's box, highlighted when active
                s('text', { x: 338, y: y + 15, class: 't13 s-monot' }, String(a)), s('text', { x: 382, y: y + 15, class: 't13 s-monot' + (on ? ' bold' : '') }, txt),  // the address and the instruction
                s('text', { x: 642, y: y + 15, class: 't13 end s-sub', style: 'font-style:italic' }, note));  // the plain-language comment at the right end of the row, in italics
              if (tag) kids.push(s('text', { x: 328, y: y + 15, class: 't13 end bold', style: 'fill:var(--os)' }, tag));   // N, N+1 or Y label
            });  // ends the memory row loop
            for (let a = 999; a >= 995; a--) {  // draws the five stack slots from 999 down to 995
              const y = stkY(a), v = f.stack[a], fresh = v && p.stack[a] !== v && i > 0, old = !v && f.stale && f.stale[a];  // v = what the slot holds now; fresh = just pushed; old = a popped value still sitting there
              kids.push(s('rect', { x: 332, y, width: 316, height: 20, class: fresh ? 's-accent' : v ? 's-panel' : 's-muted', 'stroke-width': fresh ? 2.5 : 1 }),  // the slot's box: highlighted when just pushed, plain when holding something, muted when free
                s('text', { x: 338, y: y + 15, class: 't13 s-monot' }, String(a)),  // the slot's address
                s('text', { x: 382, y: y + 15, class: 't13 s-monot' + (v ? '' : ' s-sub'), style: old ? 'opacity:.6;font-style:italic' : null }, v || old || '(free)'),  // its contents, a faded old value, or "(free)"
                s('text', { x: 596, y: y + 15, class: 't13 end s-sub' }, 'T−' + (1000 - a)));  // the slot's distance below the top of the stack, such as T−1
            }  // ends the stack loop
            const sp = +f.regs.SP, spY = sp === 1000 ? 241 : stkY(sp) + 10;  // sp is the stack pointer's value; spY places its marker (above the slots when the stack is empty)
            kids.push(s('text', { x: 646, y: spY + 5, class: 't13 end bold', style: 'fill:var(--cpu)' }, '◂ SP'));  // the "◂ SP" marker pointing at the top of the stack
            f.arrows.forEach(([a, b]) => {  // draws this step's data-movement arrows
              const [x1, y1] = anchor(a), [x2, y2] = anchor(b), toMem = typeof b !== 'string';  // each arrow runs from a register to memory or back; anchor() gives both end points
              const xa = toMem ? x1 : x1, xb = toMem ? x2 - 2 : x2 + 2;  // keeps the start point and stops the end 2 pixels short of its target so the arrowhead stays visible
              kids.push(s('path', { d: `M${xa},${y1} C${(xa + xb) / 2},${y1} ${(xa + xb) / 2},${y2} ${xb},${y2}`, fill: 'none', 'stroke-width': 2.5, style: 'stroke:var(--accent)', 'marker-end': 'url(#arr-accent)' }));  // a smooth curved arrow in the accent colour
            });  // ends the arrow loop
            svg.replaceChildren(...kids);  // swaps all the new shapes into the drawing at once
            items.forEach((li, k) => { li.classList.toggle('on', k + 1 === i); li.classList.toggle('done', k + 1 < i || i === 10); });  // highlights the current step in the list on the right and greys out the finished ones
            return f.cap;  // returns the caption for the player to show
          }  // ends draw()
          const STEPS = ['A device raises an <b>interrupt signal</b>.', 'The processor <b>finishes the current instruction</b>.', 'It <b>tests for a pending interrupt</b> and sends an <b>acknowledgment</b> to the device.',  // STEPS: the nine steps in words, for the clickable list; steps 1-3
            'It <b>pushes the PSW and PC</b> onto the control stack.', 'It <b>loads the PC</b> with the handler’s start address.',  // steps 4-5: push PSW and PC, then load the handler address
            'The handler <b>saves the remaining registers</b>.', 'The handler <b>processes the interrupt</b>.', 'The saved <b>registers are restored</b>.', 'The <b>PSW and PC are restored</b>; the program resumes.'];  // steps 6-9: the handler's software part
          const items = STEPS.map((t, k) => h('li', { class: k < 5 ? 'hw' : 'sw', role: 'button', tabindex: 0, style: { cursor: 'pointer' }, onclick: () => { player.stop(); player.go(k + 1); },  // builds one list item per step; the first five are hardware, the rest software; clicking jumps to that step
            onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); player.stop(); player.go(k + 1); } } },  // pressing Enter or Space on a focused item jumps too, for keyboard users
            h('span', { class: 'n' }, String(k + 1)), h('span', { html: t })));  // the item's number badge and its text
          const player = ctx.ui.player({ count: F.length, render: draw, interval: 3200 });  // the shell's step player over all the frames, one every 3.2 seconds when playing
          el.append(h('div', { class: 'split r fill' },  // builds the page: a wide left column and a right column for the list
            h('div', { class: 'stack gap-s' }, h('div', { class: 'card white tight' }, panWrap(ctx, svg, 620)), player.el),  // left column: the diagram (swipeable on phone-width screens) and the player
            h('div', { class: 'card stack gap-s' },  // right column: the list of steps
              h('div', { class: 'grp', style: { color: 'var(--cpu)' } }, 'Hardware: the processor does these by itself'),  // heading for the hardware steps
              h('ol', { class: 'isteps' }, ...items.slice(0, 5)),  // the first five steps
              h('div', { class: 'grp', style: { color: 'var(--os)' } }, 'Software: the interrupt handler (OS)'),  // heading for the software steps
              h('ol', { class: 'isteps' }, ...items.slice(5)),  // the last four steps
              h('p', { class: 'small m0', style: { marginTop: 'auto', lineHeight: '1.4' }, html: '<b>Labels:</b> <b>N</b> = the instruction running when the interrupt arrives, <b>N+1</b> = the next one, where the program resumes, and <b>Y</b> = the handler’s first instruction. <b>PSW</b> “user, int on” = user mode (an ordinary program is running) with interrupts enabled.' }),  // key explaining the N, N+1 and Y labels and the PSW text
              h('p', { class: 'xs muted m0' }, 'Click any step to jump to it. Values that just changed glow.'))));  // hint: click any step to jump there; changed values glow
        },  // ends render() for step 6
      },  // ends step 6

      /* ============ 7. Multiple interrupts: two policies + predictions ============ */
      {  // step 7 object starts here: multiple interrupts and the two ways to handle them
        title: 'Two interrupts at once? Predict what the processor does',  // step 7 title
        kind: 'predict',  // kind "predict": the student predicts the timeline before seeing it
        html: `${/* html: the fixed page layout for step 7 */''}
          <div class="split l fill">${/* two-column layout: explanations on the left, the prediction card on the right */''}
            <div class="stack gap-s">${/* left column stack */''}
              <p class="m0">What if a second request arrives while a handler is still running? There are two classic answers.</p>${/* intro sentence: what if a second request arrives while a handler runs */''}
              <div class="card os tight"><h3 style="font-size:17px">Approach 1 · Disable interrupts</h3>${/* card for approach 1, disabling interrupts */''}
                <p class="small m0">While any handler runs, the processor <span class="t" data-t="Disabled interrupts">ignores new requests</span>; they stay <span class="t" data-t="Pending interrupt">pending</span>. When the handler finishes, interrupts are enabled again and the waiting requests are served strictly one after another (in this guide, oldest first). Simple, but it <b>ignores priority</b>: a time-critical device may wait too long.</p></div>${/* explains approach 1: requests wait and are served one after another, ignoring priority */''}
              <div class="card intr tight"><h3 style="font-size:17px">Approach 2 · Priorities and nesting</h3>${/* card for approach 2, priorities and nesting */''}
                <p class="small m0">Each source gets an <span class="t">interrupt priority</span>. A higher-priority request may interrupt a lower-priority handler, whose state is saved exactly like a user program’s. A lower-priority request waits until the higher-priority handlers are done. These are <span class="t">nested interrupts</span>.</p></div>${/* explains approach 2: a more urgent request may interrupt a less urgent handler */''}
              <div class="card tight">${/* the scenario card */''}
                <h4>Scenario · each handler needs 10 time units</h4>${/* scenario heading: each handler needs 10 time units */''}
                <table class="tbl compact"><tr><th>Device</th><th>Priority</th><th>Interrupts at</th></tr>${/* scenario table header: device, priority, arrival time */''}
                  <tr><td>Printer</td><td>2 (lowest)</td><td>t = 10</td></tr><tr><td>Comm line</td><td>5 (highest)</td><td>t = 15</td></tr><tr><td>Disk</td><td>4</td><td>t = 20</td></tr></table>${/* scenario rows: printer at t = 10, comm line at 15, disk at 20; closes the table */''}
              </div>${/* end of the scenario card */''}
            </div>${/* end of the left column */''}
            <div class="card white stack gap-s s14-pred"></div>${/* empty right-hand card; render() builds the prediction questions in it */''}
          </div>`,  // end of the layout HTML
        render(el, ctx) {  // render(el, ctx): builds the prediction card each time step 7 is opened
          const { h, s } = ctx;  // takes both builders from ctx: h for HTML, s for SVG
          const sim = simMulti({ P: 10, D: 20, C: 15 }, 'nested');  // simulates the scenario under the nesting policy so the timeline can be drawn
          const QS = [  // QS: the prediction questions, each with a time T, question, choices, answer and feedback per choice
            { T: 20, q: 'At <b>t = 20</b> the disk (priority 4) interrupts while the comm line handler (priority 5) is running. What runs from t = 20 to t = 25?',  // question 1, at t = 20: the disk interrupts during the comm handler; what runs next?
              choices: ['The disk handler: it just arrived', 'The comm line handler keeps running', 'The printer handler resumes', 'The user program'], answer: 1,  // choices; answer: 1 (the comm handler keeps running)
              fb: ['The disk’s priority (4) is lower than the running comm handler’s (5), so it cannot interrupt it. Its request stays pending.', 'Right. 5 > 4, so the comm handler keeps the processor and the disk request waits, pending.',  // feedback for the disk and for the correct choice
                'The printer handler is suspended underneath the comm handler. It cannot run until everything above it finishes.', 'The user program is at the bottom of the stack. It runs only when all three handlers are done.'] },  // feedback for the printer and the user program choices
            { T: 25, q: 'At <b>t = 25</b> the comm line handler finishes. The printer handler is suspended and the disk request is pending. What runs next?',  // question 2, at t = 25: the comm handler finishes; what runs next?
              choices: ['The printer handler: it was interrupted first', 'The disk handler', 'The user program', 'The comm line handler again'], answer: 1,  // choices; answer: 1 (the disk handler)
              fb: ['Tempting, since the printer was there first, but the pending disk request has priority 4 > 2, so it is served before the printer handler resumes.', 'Right. Before returning to the printer handler (priority 2) the processor finds the pending disk request (priority 4), which outranks it.',  // feedback for the printer (a tempting trap) and for the correct choice
                'Two handlers are unfinished. The user program runs only when nothing is pending or suspended.', 'The comm handler is finished and its device has not interrupted again.'] },  // feedback for the user program and comm handler choices
            { T: 35, q: 'At <b>t = 35</b> the disk handler finishes. At what time does the <b>user program</b> get the processor back?',  // question 3, at t = 35: when does the user program get the processor back?
              choices: ['t = 30', 't = 35', 't = 40', 't = 45'], answer: 2,  // choices; answer: 2 (t = 40)
              fb: ['Three handlers of 10 units each start no earlier than t = 10, so the user program cannot resume before t = 40.', 'At 35 the printer handler still has 5 units of work left (it only ran from 10 to 15).', 'Right. The printer handler resumes at 35, does its last 5 units and finishes at 40. Then the user program resumes.',  // feedback for t = 30, t = 35 and the correct t = 40
                'The printer handler already did 5 of its 10 units (t = 10 to 15), so it needs only 5 more after t = 35.'] },  // feedback for t = 45: the printer only needs 5 more units after t = 35
          ];  // closes the QS list
          const box = ctx.$('.s14-pred');  // finds the empty prediction card from the html above
          const prog = h('div', { class: 'small b muted' });  // progress line, for example "Prediction 2 of 3"
          const qText = h('div', { class: 'b', style: { fontSize: '17px', lineHeight: '1.4' } });  // the question text in bold
          const choiceBox = h('div', { class: 'pq-choices' });  // the grid that holds the answer buttons
          const fb = h('div', { class: 'fb', style: { minHeight: '64px' } });  // the feedback box; its minimum height keeps the layout still
          const nextBtn = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { if (k < QS.length - 1) { k++; show(); } else finish(); } });  // Next button: goes to the next prediction, or after the last one shows the whole story
          const NW = ctx.narrow, svg = s('svg', { viewBox: `0 0 ${NW ? 420 : 640} ${NW ? 222 : 258}`, width: '100%' });  // NW = phone-width screen; the timeline drawing is smaller there
          let k = 0, right = 0;  // k = the current question; right = how many were predicted correctly
          const drawG = (T) => svg.replaceChildren(...ganttNodes(s, sim, { x0: NW ? 72 : 112, x1: NW ? 410 : 628, y0: 26, laneH: NW ? 34 : 43, tmax: 45, T, veil: 1, short: NW, tick: NW ? 10 : 5 }));   // opaque: no peeking at the answer
          function show() {  // show(): displays question k with fresh answer buttons and the timeline revealed up to its moment
            const Q = QS[k];  // Q is the current question
            prog.textContent = `Prediction ${k + 1} of ${QS.length}`;  // progress text
            qText.innerHTML = Q.q;  // the question text
            fb.innerHTML = '<span class="muted">Commit to an answer. The chart shows everything up to this moment.</span>';  // prompt: commit to an answer; the chart shows only what has happened so far
            choiceBox.replaceChildren(...Q.choices.map((c, i) => h('button', { class: 'btn', type: 'button', onclick: (e) => pick(i, e.currentTarget) }, c)));  // one button per choice; clicking passes the choice number and the button itself to pick()
            nextBtn.style.visibility = 'hidden';  // hides Next until an answer is picked
            drawG(Q.T);  // draws the timeline with the future hidden behind an opaque veil at the question's time
          }  // ends show()
          function pick(i, btn) {  // pick(i, btn): runs when the student picks choice i
            const Q = QS[k];  // Q is the current question
            if (choiceBox.dataset.done === String(k)) return;  // only the first pick for this question counts; choiceBox remembers which question was answered
            choiceBox.dataset.done = String(k);  // marks this question as answered
            const ok = i === Q.answer; if (ok) right++;  // checks the answer and counts it if right
            btn.classList.add(ok ? 'right' : 'wrong');  // colours the clicked button green or red
            choiceBox.children[Q.answer].classList.add('right');  // always shows the right answer in green
            [...choiceBox.children].forEach((b) => b.setAttribute('aria-disabled', 'true'));   // stay readable; pick() ignores repeats
            fb.innerHTML = `<b style="color:var(--${ok ? 'ok' : 'bad'})">${ok ? '✓' : '✗'}</b> ${Q.fb[i]}`;  // feedback: a tick or a cross, then the explanation for the choice picked
            drawG(k < QS.length - 1 ? QS[k + 1].T : null);  // reveals the timeline up to the next question's moment (or all of it after the last)
            nextBtn.textContent = k < QS.length - 1 ? 'Next prediction →' : 'Show the whole timeline →';  // Next button label: the next prediction, or the whole timeline
            nextBtn.style.visibility = 'visible';  // shows the Next button
          }  // ends pick()
          function finish() {  // finish(): shows the full timeline and the final score after the last prediction
            prog.textContent = `Done: ${right} of ${QS.length} predictions right`;  // progress text becomes the score
            qText.innerHTML = 'The whole story: printer at 10, comm preempts at 15, disk waits at 20, disk runs at 25, printer resumes at 35, user program back at 40.';  // retells the whole scenario in one sentence
            choiceBox.replaceChildren();  // removes the answer buttons
            fb.innerHTML = 'Notice the comm line waited <b>0</b> units and the disk <b>5</b>, while the printer, the least urgent, finished last. With interrupts simply disabled, the comm line would have waited 5 units. Compare both policies on the next step.';  // points out who waited how long, and that disabling interrupts would have made the comm line wait 5
            nextBtn.textContent = 'Try again'; nextBtn.style.visibility = 'visible';  // the Next button becomes "Try again"
            drawG(null);  // draws the complete timeline with no veil
            k = -1; right = 0; delete choiceBox.dataset.done;   // the next click does k++ → 0 and restarts
          }  // ends finish()
          const legend = h('div', { class: 'row gap-s xs', style: { marginTop: 'auto' } }, h('span', { class: 'chip intr' }, 'handler running'), h('span', { class: 'chip proc' }, 'user program'),  // colour key for the timeline: handler running and user program chips
            h('span', { class: 'chip warn' }, 'pending'), h('span', { class: 'chip' }, 'suspended'), h('span', { class: 'chip bad' }, '▼ request arrives'));  // more key chips: pending, suspended and the arrival marker
          box.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, prog, nextBtn), qText, choiceBox, fb, legend, svg);  // fills the card: progress and Next on top, then question, choices, feedback, key and the timeline
          show();  // shows the first prediction when the step opens
        },  // ends render() for step 7
      },  // ends step 7

      /* ============ 8. Lab: sequential vs nested, student sets the arrivals ============ */
      {  // step 8 object starts here: the lab where students set the arrival times and compare the two policies
        title: 'Lab: disabled vs nested, you choose when devices interrupt',  // step 8 title
        kind: 'lab',  // kind "lab": a hands-on activity
        render(el, ctx) {  // render(el, ctx): builds step 8 each time it is opened
          const { h, s } = ctx;  // takes both builders from ctx: h for HTML, s for SVG
          let mode = 'nested', sim, frames;  // mode = the policy ("seq" or "nested"); sim = the latest simulation; frames = the narration frames
          const arr = { P: 10, C: 15, D: 20 };  // arr: when each device interrupts, starting with the scenario from the previous step
          const NW = ctx.narrow, G = { x0: NW ? 72 : 112, x1: NW ? 410 : 648, y0: 30, laneH: NW ? 40 : 52, tmax: 70, short: NW, tick: NW ? 10 : 5 };  // NW = phone-width screen; G holds the timeline's position and size settings (70 time units shown)
          const svg = s('svg', { viewBox: `0 0 ${NW ? 420 : 660} ${NW ? 260 : 308}`, width: '100%' });  // the timeline drawing
          const tbody = h('tbody');  // the table body for the results table
          function build() {  // build(): reruns the simulation and rebuilds the narration and the table; runs after every change
            sim = simMulti(arr, mode);  // simulates the current arrival times under the current policy
            const w = (d) => sim.info[d].start - sim.info[d].arrive, cw = w('C'), ok = cw <= MI.DEADLINE;  // w(d) = how long device d waited before its handler started; ok = the comm line met its 3-unit limit
            const suspended = ['C', 'D', 'P'].map((d) => [d, sim.susp.filter((x) => x.who === d).reduce((n, x) => n + x.e - x.s, 0)]).filter(([, n]) => n > 0).map(([d, n]) => `${MI.NAME[d]} ${n}`);  // lists how long each handler spent suspended, for the summary
            frames = [{ T: 0, html: `<b>t = 0.</b> The user program is running. Policy: <b>${mode === 'nested' ? 'nested interrupts with priorities' : 'interrupts disabled while a handler runs'}</b>.` },  // frame 0: the user program runs, and the policy in use is named
              ...sim.moments.map((m) => ({ T: m.t, html: `<b>t = ${m.t}.</b> ${m.html}` })),  // one frame for every moment the simulation narrated
              { T: null, html: `<b>Summary.</b> Waits before a handler starts: comm line ${cw}, disk ${w('D')}, printer ${w('P')}. ` +  // the final summary frame: how long each device waited
                (suspended.length ? `Suspended partway through: ${suspended.join(', ')} units. ` : '') + `The user program is back at t = ${sim.end}. ` +  // how long handlers were suspended, and when the user program got the processor back
                (ok ? `The comm line was served within its ${MI.DEADLINE}-unit limit, so no data was lost.` : `The comm line waited ${cw} units, over its ${MI.DEADLINE}-unit limit: incoming characters would be overwritten and lost.`) }];  // whether the comm line met its limit or lost data
            tbody.replaceChildren(...['C', 'D', 'P'].map((d) => {  // rebuilds the results table: one row per device
              const f = sim.info[d], late = d === 'C' && !ok;  // f is the device's times; late is true when the comm line missed its limit
              return h('tr', { class: late ? 'on' : null }, h('td', { class: 'b', style: { whiteSpace: 'nowrap' } }, `${cap1(MI.NAME[d])} (${MI.PR[d]})`), h('td', {}, String(f.arrive)), h('td', {}, String(f.start)), h('td', {}, String(f.finish)),  // the row: device name and priority, arrival, start and finish times; highlighted when late
                h('td', {}, h('span', { class: 'chip ' + (d === 'C' ? (ok ? 'ok' : 'bad') : w(d) ? 'warn' : 'ok') }, String(w(d)) + (d === 'C' ? (ok ? ' ✓' : ' ✗ late') : ''))));  // the wait column as a chip: green if no wait, orange if a wait, and for the comm line a tick or "late"
            }));  // ends the table rows
          }  // ends build()
          function draw(i) {  // draw(i): draws narration frame i; the step player calls it on every frame
            const f = frames[i];  // f is the frame to show
            const K = (G.x1 - G.x0) / G.tmax, xd = G.x0 + Math.min(G.tmax, arr.C + MI.DEADLINE) * K;  // xd is the x position of the comm line's deadline, 3 units after its arrival
            const kids = ganttNodes(s, sim, Object.assign({ T: f.T }, G));  // the timeline, veiled beyond this frame's time
            kids.push(s('line', { x1: xd, y1: G.y0 - 2, x2: xd, y2: G.y0 + G.laneH + 2, 'stroke-width': 2, 'stroke-dasharray': '3 3', style: 'stroke:var(--bad)' }),   // comm line's deadline
              s('text', { x: xd + 4, y: G.y0 - 5, class: 't13 bold', style: 'fill:var(--bad)' }, 'limit'));  // a "limit" label at the top of the deadline line
            svg.replaceChildren(...kids);  // swaps the shapes into the drawing at once
            return f.html;  // returns the frame's narration for the player's caption
          }  // ends draw()
          build();  // runs the first simulation when the step opens
          const player = ctx.ui.player({ count: frames.length, render: draw, interval: 2600, start: frames.length - 1 });  // the shell's step player over the narration frames, starting on the summary frame
          const refresh = () => { build(); player.stop(); player.setCount(frames.length); player.go(frames.length - 1); };  // refresh(): rebuilds everything, stops the player, and jumps to the summary frame
          const seg = ctx.ui.seg([{ value: 'seq', label: 'Disabled (sequential)' }, { value: 'nested', label: 'Nested with priorities' }], mode, (v) => { mode = v; refresh(); });  // policy switch: disabled (sequential) or nested with priorities
          const sliders = {};  // sliders holds one slider per device
          [['P', 'Printer (2) at'], ['C', 'Comm line (5) at'], ['D', 'Disk (4) at']].forEach(([d, label]) => {  // builds a slider for each device's arrival time
            sliders[d] = ctx.ui.slider({ label, min: 0, max: 40, value: arr[d], format: (v) => 't = ' + v, onInput: (v) => { arr[d] = v; refresh(); } });  // slider from t = 0 to t = 40; moving it reruns the simulation straight away
          });  // ends the slider loop
          const preset = (p, c, d) => () => { arr.P = p; arr.C = c; arr.D = d; Object.entries(sliders).forEach(([k, sl]) => sl.set(arr[k])); refresh(); };  // preset(p, c, d) makes a click handler that sets all three arrival times and moves the sliders to match
          el.append(h('div', { class: 'split r fill' },  // builds the page: a wide left column and a right column for the controls
            h('div', { class: 'stack gap-s' },  // left column: timeline card and player
              h('div', { class: 'card white tight' }, svg,  // white card holding the timeline
                h('div', { class: 'row gap-s xs', style: { marginTop: '4px' } }, h('span', { class: 'chip intr' }, 'handler running'), h('span', { class: 'chip proc' }, 'user program'),  // colour key: handler running and user program chips
                  h('span', { class: 'chip warn' }, 'pending (not started)'), h('span', { class: 'chip' }, 'suspended (preempted)'), h('span', { class: 'chip bad' }, '▼ request arrives'))),  // more key chips: pending, suspended and the arrival marker
              player.el),  // the step player under the timeline card; closes the left column
            h('div', { class: 'card stack gap-s' },  // right column: the controls card
              h('h4', { class: 'm0' }, 'Policy'), seg,  // the policy heading and switch
              h('h4', { class: 'm0', style: { marginTop: '4px' } }, 'When does each device interrupt?'),  // heading for the arrival-time sliders
              sliders.P, sliders.C, sliders.D,  // the three sliders: printer, comm line, disk
              h('div', { class: 'row gap-s' }, h('button', { class: 'btn sm', type: 'button', onclick: preset(10, 15, 20) }, 'Classic 10 / 15 / 20'),  // preset buttons: the classic 10 / 15 / 20 scenario
                h('button', { class: 'btn sm', type: 'button', onclick: preset(5, 12, 8) }, 'Rising urgency'), h('button', { class: 'btn sm', type: 'button', onclick: preset(5, 5, 5) }, 'All at once')),  // more presets: rising urgency (5, 12, 8) and all three at once (5, 5, 5)
              h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, ...['Device', 'Arrives', 'Starts', 'Done', 'Waited'].map((x) => h('th', {}, x)))), tbody),  // the results table with its header row: device, arrives, starts, done, waited
              h('div', { class: 'callout why m0 small', 'data-label': 'The trade-off' }, 'Nesting serves urgent devices fast; low-priority handlers finish later. A printer can wait, a communications line cannot: here its handler must start within ',  // trade-off box: nesting serves urgent devices fast, but a comm line must start within its limit
                h('b', {}, MI.DEADLINE + ' units'), ' of the request (red dashed “limit” line) or the next incoming character overwrites the waiting one.'))));  // the limit in bold, pointing to the red dashed line; closes the page layout
        },  // ends render() for step 8
      },  // ends step 8

      /* ============ 9. Recap ============ */
      {  // step 9 object starts here: the recap
        title: 'Recap: six ideas to carry forward',  // step 9 title
        kind: 'recap',  // kind "recap": a summary step, kept on the core path
        render(el, ctx) {  // render(el, ctx): builds step 9 each time it is opened
          const { h } = ctx;  // takes the HTML element builder h from ctx
          const chain = [['cpu', 'Signal'], ['cpu', 'Finish instruction'], ['cpu', 'Acknowledge'], ['cpu', 'Push PSW + PC'], ['cpu', 'PC ← handler'],  // chain: the nine steps in short form, each with its colour; the first five are hardware
            ['os', 'Save registers'], ['os', 'Service device'], ['os', 'Restore registers'], ['os', 'Pop PSW + PC']];  // the last four steps, done by the handler (OS colour)
          el.append(h('div', { class: 'stack fill' },  // builds the page: one column
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // instruction to answer out loud before flipping each card
            ctx.ui.flipcards([  // the flip cards (ctx.ui.flipcards): each pair is [front question, back answer]
              ['Why do interrupts exist?', 'One I/O operation can last as long as a hundred thousand to over a hundred million instructions. Interrupts let the processor start a device and keep doing useful work, raising processor utilization.'],  // card: why interrupts exist
              ['What are the four classes?', '<b>Program</b> (overflow, divide by zero, illegal instruction, bad memory reference), <b>timer</b>, <b>I/O</b>, and <b>hardware failure</b>.'],  // card: the four classes
              ['What is the interrupt stage?', 'A check after execute. If interrupts are enabled and one is pending: save the context and load the PC with the handler’s address. Otherwise fetch the next instruction.'],  // card: what the interrupt stage does
              ['Who saves what?', 'Hardware pushes the <b>PSW and PC</b> and loads the handler address. The handler saves and restores the <b>other registers</b>. Return-from-interrupt pops PC and PSW.'],  // card: who saves what, hardware or handler
              ['Short vs long I/O wait?', 'Short: the device finishes while user code runs, so there is no idle time. Long: the next WRITE arrives before the last one is done, so some waiting remains.'],  // card: short compared with long I/O waits
              ['Disabled vs nested?', 'Disabled: simple, requests wait (pending) and are served strictly one after another, ignoring priority. Nested: a higher-priority request may interrupt a lower-priority handler.'],  // card: disabled compared with nested interrupts
            ], { cols: 3, height: 172 }),  // closes the card list; 3 columns, each card 172px tall
            h('div', { class: 'card tight', style: { marginTop: 'auto' } },  // a card with the nine steps as one chain, pushed to the bottom
              h('h4', {}, 'The nine steps in one line: blue = hardware, violet = interrupt handler'),  // its heading, explaining the two colours
              h('div', { class: 'row gap-s' }, ...chain.flatMap(([c, t], i) => [h('span', { class: 'box ' + c, style: { padding: '5px 8px', fontSize: '14px' } }, `${i + 1}. ${t}`), i < chain.length - 1 ? h('span', { class: 'muted' }, '→') : null]))),  // one coloured box per step, joined by arrows
          ));  // ends the page contents
        },  // ends render() for step 9
      },  // ends step 9

      /* ============ 10. Check yourself ============ */
      {  // step 10 object starts here: the section quiz
        title: 'Check yourself: interrupts',  // step 10 title
        kind: 'check',  // kind "check": the Check Yourself quiz, kept on the core path and counted for mastery
        quiz: [  // quiz: the shell turns this list of questions into the interactive quiz
          { q: 'What is the main reason computers use interrupts?',  // question 1 (multiple choice): the main reason computers use interrupts
            choices: ['To keep the processor doing useful work while slow I/O devices operate', 'To make I/O devices run faster', 'To let one user program call another', 'To stop programs from reading each other’s memory'], answer: 0,  // choices; answer: 0 (keep the processor busy while slow devices work)
            feedback: [null, 'Interrupts do not speed up the device at all; they stop the processor from wasting time waiting for it.', 'Calling another program is an ordinary procedure call or system service, not the purpose of interrupts.', 'Memory protection is a separate mechanism (a violation may cause a program interrupt, but that is not why interrupts exist).'],  // feedback for each wrong choice: not faster devices, not program calls, not memory protection
            why: 'I/O devices are far slower than the processor. With interrupts the processor starts an I/O operation, runs other instructions, and is told when the device is done, which raises processor utilization.' },  // explanation shown after answering
          { type: 'bucket', q: 'Sort each event into its class of interrupt.', buckets: ['Program', 'Timer', 'I/O', 'Hardware failure'],  // question 2 (sort into groups): events into the four classes
            items: [['Division by zero', 0], ['Illegal instruction', 0], ['Regular clock tick', 1], ['Printer finished a line', 2], ['Disk reports a read error', 2], ['Memory parity error', 3]],  // the events, each with the number of its correct class
            why: 'Program interrupts come from the executing instruction; timer interrupts from the processor’s clock; I/O interrupts from an I/O module (completion or error); hardware-failure interrupts from physical faults such as power loss or parity errors.' },  // explanation: where each class of interrupt comes from
          { type: 'order', q: 'Put the stages of interrupt processing in order. (The handler’s save, process and restore steps are combined into one item.)',  // question 3 (put in order): the stages of interrupt processing, with the handler's work as one item
            items: ['Device issues an interrupt signal', 'Processor finishes the current instruction', 'Processor tests for a pending interrupt and acknowledges it', 'Processor pushes the PSW and PC onto the control stack', 'Processor loads the PC with the handler’s start address', 'Handler saves registers, processes the interrupt, restores registers', 'PSW and PC are restored from the stack'],  // the items in their correct order; the quiz shuffles them for the student
            why: 'The full list has nine steps. Steps 1–5 are hardware: signal, finish the instruction, test and acknowledge, push PSW and PC, load the handler address. Steps 6–9 belong to the handler: save registers, process the interrupt, restore registers, restore PSW and PC. The stack is last-in, first-out, so things come off in the reverse order they went on.' },  // explanation: the full nine steps, split into hardware and handler, and why the stack reverses the order
          { q: 'Interrupts are disabled whenever a handler runs. The printer handler (lowest priority) starts at t = 10 and needs 10 time units. At t = 12 the communications line (highest priority) interrupts. When does the comm line handler start?',  // question 4 (multiple choice): with interrupts disabled, when does the comm line handler start?
            choices: ['t = 12, because it has the higher priority', 't = 20', 't = 22', 'Never: a request that arrives while interrupts are disabled is lost'], answer: 1,  // choices; answer: 1 (t = 20)
            feedback: ['That is what nesting with priorities would do. With interrupts disabled, a running handler cannot be interrupted, whatever the priority.', null, 'There is no extra delay: as soon as the printer handler finishes at t = 20 and interrupts are enabled again, the pending request is accepted.', 'A request that arrives while interrupts are disabled is not lost. It stays pending until interrupts are enabled again.'],  // feedback for each wrong choice: that would be nesting, no extra delay, and requests are not lost
            why: 'With the disable approach, requests are handled strictly one after another. The comm line waits 8 units behind a less urgent handler, which is exactly the weakness of this approach: it ignores priority and time-critical needs.' },  // explanation: the comm line waits 8 units, the weakness of the disable approach
          { type: 'num', q: 'A program runs three code segments of 10 time units each, with a WRITE between them (two WRITEs). Each WRITE costs 2 units of prep, and the printer then needs 6 units per line. <b>Without interrupts</b> the processor waits out the 6 units and then runs 2 units of completion code. <b>With interrupts</b> the printer works while user code runs, and each completion costs a 3-unit handler (the completion code plus saving and restoring the context). Each line finishes before the next WRITE. How many time units do interrupts save?',  // question 5 (calculate): time saved by interrupts with a 6-unit printer
            answer: 10, tol: 0, unit: 'units', why: 'Without: 3 × 10 + 2 × (2 + 6 + 2) = 50. With: the waits disappear, so 3 × 10 + 2 × 2 (prep) + 2 × 3 (handlers) = 40, with no idle time. Saved: 50 − 40 = 10 units. The handler costs 1 unit more than plain completion code, but that is far less than the 6-unit wait it hides.' },  // answer: 10 units exactly (tol: 0 means no tolerance), with the full working in the explanation
          { q: 'Which values does the processor <b>hardware</b> push onto the control stack when it accepts an interrupt?',  // question 6 (multiple choice): what the hardware pushes onto the stack
            choices: ['The PSW and the program counter', 'Every general-purpose register', 'Only the stack pointer', 'The whole user program'], answer: 0,  // choices; answer: 0 (the PSW and the PC)
            feedback: [null, 'The other registers are saved by the interrupt handler (software), because only the handler knows which registers it will use.', 'The stack pointer is what moves when things are pushed; it is not itself pushed at this point.', 'The program stays in memory where it is; only the information needed to resume it is saved.'],  // feedback for each wrong choice: the handler saves other registers, SP moves rather than being pushed, the program stays put
            why: 'The PSW and PC must be saved by hardware because loading the handler address immediately overwrites the PC. The handler then saves whatever other registers it needs.' },  // explanation: the PC must be saved before it is overwritten with the handler address
          { type: 'num', q: 'The stack pointer holds 1000 and the stack grows toward lower addresses, one word per item. The processor pushes the PSW and PC, then the handler pushes 4 registers. What address does SP hold now?',  // question 7 (calculate): the stack pointer after pushing 6 items from 1000
            answer: 994, tol: 0, why: 'Six items are pushed in total (PSW, PC and 4 registers), so SP moves down from 1000 to 1000 − 6 = 994.' },  // answer: 994, with the working in the explanation
          { type: 'num', q: 'Without interrupts, a program runs three code segments of 10 time units each, with a WRITE between them (two WRITEs). Each WRITE needs 2 units of prep, 20 units of printing during which the processor just waits, and 2 units of completion. What is the total time?',  // question 8 (calculate): total time without interrupts for a 20-unit printer
            answer: 78, tol: 0, unit: 'units', why: 'Code: 3 × 10 = 30. Each WRITE: 2 + 20 + 2 = 24, and there are two, so 48. Total 30 + 48 = 78 time units, of which 40 are pure waiting.' },  // answer: 78 units, with the working in the explanation
          { q: 'Priorities: printer 2, disk 4, comm line 5 (higher is more urgent), with nesting allowed. The printer handler is running when the comm line interrupts; then the disk interrupts while the comm handler runs. When the comm handler finishes, what runs next?',  // question 9 (multiple choice): with nesting, what runs after the comm handler finishes?
            choices: ['The disk handler', 'The printer handler, since it was interrupted first', 'The user program', 'The comm line handler again'], answer: 0,  // choices; answer: 0 (the disk handler)
            feedback: [null, 'The printer handler (2) is suspended, but the pending disk request (4) outranks it, so the disk is served first.', 'Two handlers are still unfinished; the user program resumes only when all of them are done.', 'The comm handler has finished and nothing new came from the comm line.'],  // feedback for each wrong choice: the disk outranks the printer, two handlers are unfinished, the comm line is done
            why: 'On finishing a handler, the processor serves the highest-priority request that outranks what it would return to. The disk (4) beats the suspended printer handler (2); the printer resumes after the disk finishes.' },  // explanation: the highest-priority request that outranks the suspended handler goes next
          { type: 'multi', q: 'Which statements about the interrupt stage are true? Select all that apply.',  // question 10 (select all that apply): true statements about the interrupt stage
            choices: ['It follows the execute stage of the instruction cycle', 'It is skipped when interrupts are disabled', 'It interrupts an instruction halfway to respond faster', 'If a request is pending, the context is saved and the PC is set to the handler’s start address'], answer: [0, 1, 3],  // choices; the right ones are 0, 1 and 3
            why: 'The interrupt stage comes after execute and is skipped when interrupts are disabled. It never splits an instruction; if a request is pending it saves the context and points the PC at the handler.' },  // explanation: after execute, skipped when disabled, never splits an instruction
          { type: 'match', q: 'Match each item to its role.',  // question 11 (match the pairs): PC, PSW, control stack and handler to their roles
            pairs: [['Program counter (PC)', 'Holds the address of the next instruction'], ['Program status word (PSW)', 'Holds condition codes, the mode and the interrupt-enable bit'], ['Control stack', 'Memory where return addresses and registers are saved'], ['Interrupt handler', 'Routine that services the device that interrupted']],  // the four pairs
            why: 'The PC and PSW describe where the program is and its status; the control stack stores them while the handler, the OS routine that services the device, runs.' },  // explanation tying the four together
          { q: 'A system uses interrupts. A program issues a WRITE, runs some code, then reaches its next WRITE while the printer is still busy with the first line. What happens?',  // question 12 (multiple choice): a WRITE that arrives while the printer is still busy
            choices: ['The processor waits until the first line is done (signalled by its interrupt), then starts the second', 'The second WRITE overwrites the first line in the printer', 'The OS throws the first line away', 'The printer prints both lines at the same time'], answer: 0,  // choices; answer: 0 (the processor waits for the first line's interrupt)
            feedback: [null, 'The I/O program will not issue a new command to a busy device, so nothing is overwritten.', 'Nothing is discarded; the first operation is allowed to finish.', 'A printer handles one operation at a time.'],  // feedback for each wrong choice: nothing is overwritten, discarded, or printed at the same time
            why: 'This is the long I/O wait case. Interrupts let code overlap the printing, but when the program needs the device again before it is free, the processor must wait for the completion interrupt.' },  // explanation: this is the long I/O wait case
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the steps list

    notes: `${/* notes: the written summary of the section, opened with the Notes button and included in the printable guide */''}
<h3>Why interrupts exist</h3>${/* heading for the notes part on why interrupts exist */''}
<p>An <b>interrupt</b> is a signal that makes the processor set aside the running program, run an <b>interrupt handler</b> (ISR), then resume the program where it stopped. Interrupts exist mainly to improve <b>processor utilization</b>, the fraction of time the processor does useful work. I/O devices are far slower: at one instruction per nanosecond, printing a line (about 20 ms) lasts 20 million instruction-times. Without interrupts the processor idles through it; with them it starts the device and keeps working until the device signals it is done.</p>${/* notes paragraph: what an interrupt is and how it raises processor utilization, with the printer figures */''}

<h3>The four classes of interrupts</h3>${/* heading for the notes part on the four classes */''}
<table>${/* start of the classes table */''}
<tr><th>Class</th><th>Where it comes from</th><th>Examples</th></tr>${/* classes table header: class, where it comes from, examples */''}
<tr><td>Program</td><td>The instruction just executed</td><td>Arithmetic overflow, division by zero, illegal instruction, reference outside the program’s allowed memory</td></tr>${/* classes table row: program interrupts */''}
<tr><td>Timer</td><td>A clock inside the processor, at regular intervals</td><td>OS regains control periodically, even from an endless loop</td></tr>${/* classes table row: timer interrupts */''}
<tr><td>I/O</td><td>An I/O module (device controller)</td><td>Operation done, device needs service, or an error (e.g. a disk read error)</td></tr>${/* classes table row: I/O interrupts */''}
<tr><td>Hardware failure</td><td>A physical fault</td><td>Power failure, memory parity error</td></tr>${/* classes table row: hardware failure interrupts */''}
</table>${/* end of the classes table */''}

<h3>Flow of control without and with interrupts</h3>${/* heading for the notes part on flow of control */''}
<p>A user program has code segments ①, ② and ③ with a WRITE call between them. Each WRITE calls the OS’s I/O program: <b>prep code ④</b> (get the data ready), the <b>I/O command</b> that starts the device, and <b>completion code ⑤</b> (check the result).</p>${/* notes paragraph: the user program's code segments, WRITE calls, and the I/O program's three parts */''}
<ul>${/* start of the list of the three scenarios */''}
<li><b>No interrupts.</b> After the I/O command, the I/O program keeps checking the device until it finishes, runs ⑤, and only then returns. Every WRITE costs a full device time of idle processor.</li>${/* scenario item: no interrupts, so every WRITE costs a full device time of idle processor */''}
<li><b>Interrupts, short I/O wait.</b> After the I/O command, the I/O program returns at once and user code runs <i>in parallel</i> with the device. When the device finishes it interrupts partway through user code; the processor saves its place, runs the handler (which contains ⑤), and resumes. No idle time, and the user program contains no interrupt code.</li>${/* scenario item: interrupts with a short wait, where user code overlaps the device and nothing idles */''}
<li><b>Interrupts, long I/O wait.</b> If the device takes longer than the user code between WRITEs, the next WRITE finds it still busy, so the processor waits for the completion interrupt. Some idle time remains, but less than without interrupts.</li>${/* scenario item: interrupts with a long wait, where some idle time remains */''}
</ul>${/* end of the scenario list */''}

<h3>Program timing: a worked example</h3>${/* heading for the notes part on program timing */''}
<p>Let each user segment take 10 time units, prep ④ 2, completion ⑤ 2, and the printer D units per line. With interrupts each handler costs 3 units (⑤ plus 1 unit to save and restore the context).</p>${/* notes paragraph: the time units used in the worked example */''}
<ul>${/* start of the timing results list */''}
<li><b>Without interrupts:</b> total = 3 × 10 + 2 × (2 + D + 2) = 38 + 2D, of which 2D is idle. D = 20 gives 78 units, 40 idle.</li>${/* timing result: the formula without interrupts, and the D = 20 case */''}
<li><b>Short wait, D = 6:</b> 50 units (12 idle) without; with interrupts 3 × 10 + 2 × 2 + 2 × 3 = 40 units, 0 idle. Saved 10.</li>${/* timing result: the short-wait case, D = 6, saving 10 units */''}
<li><b>Long wait, D = 25:</b> 88 units (50 idle) without; 70 with, still 30 idle (at the 2nd WRITE and the last line). Saved 18.</li>${/* timing result: the long-wait case, D = 25, saving 18 units */''}
</ul>${/* end of the timing results list */''}
<p>Handler overhead is small next to the waiting it removes; the gain vanishes only when D falls to the 1-unit overhead.</p>${/* notes paragraph: handler overhead is small next to the waiting it removes */''}
<h3>Interrupts and the instruction cycle</h3>${/* heading for the notes part on the interrupt stage in the instruction cycle */''}
<p>The basic cycle is fetch (copy the instruction the PC points to into the <b>instruction register (IR)</b> and add 1 to the PC) then execute. To support interrupts, an <b>interrupt stage</b> is added after execute: fetch → execute → interrupt check → fetch …</p>${/* notes paragraph: fetch, execute, then the added interrupt check */''}
<ul>${/* start of the list of what the interrupt check can do */''}
<li>If interrupts are <b>disabled</b>, the check is skipped and the next instruction is fetched. A request that arrives meanwhile is not lost; it stays <b>pending</b>.</li>${/* list item: interrupts disabled, so the check is skipped and requests stay pending */''}
<li>If enabled and <b>none is pending</b>, the next instruction is fetched.</li>${/* list item: enabled with nothing pending, so the next instruction is fetched */''}
<li>If enabled and <b>one is pending</b>, the processor suspends the program, saves its <b>context</b> (PC, PSW, registers) and sets the <b>PC</b> to the handler’s start address, so the next fetch comes from the handler. Later the context is restored and the program resumes.</li>${/* list item: enabled with a request pending, so the context is saved and the PC points at the handler */''}
</ul>${/* end of the interrupt check list */''}
<p>A device’s request never splits an instruction. The handler’s instructions are <b>overhead</b>, but far cheaper than waiting.</p>${/* notes paragraph: a request never splits an instruction, and handler instructions are overhead */''}

<h3>Interrupt processing: the nine steps</h3>${/* heading for the notes part on the nine steps */''}
<p>Recall: the <b>PC</b> holds the address of the next instruction; the <b>PSW</b> holds condition codes, the user/kernel mode bit and the interrupt-enable bit. The <b>control stack</b> is memory used last-in, first-out to save them.</p>${/* notes paragraph: reminder of what the PC, PSW and control stack hold */''}
<p><b>Two details in the examples.</b> Real processors have many general-purpose registers (R1, R2, R3 …) instead of the single accumulator of the simple machine in 1.3, so instructions name the register they use, as in LOAD R1, [count]. The processor also has two modes, recorded in the PSW: ordinary programs run in the less-privileged <b>user mode</b>, and the OS, including every interrupt handler, runs in the privileged <b>kernel mode</b> (sections 2.2 and 3.4 explain modes fully). In the step-by-step example, <b>N</b> is the address of the instruction running when the interrupt arrives, <b>N + 1</b> is the next one (where the program resumes), and <b>Y</b> is the handler’s first instruction.</p>${/* notes paragraph: why the examples use registers R1-R3, what user and kernel mode are, and what N, N+1 and Y mean */''}
<p><b>Hardware</b> (the processor, automatically):</p>${/* lead-in to the hardware steps */''}
<ol>${/* start of the numbered hardware steps */''}
<li>A device issues an interrupt signal to the processor.</li>${/* hardware step 1: the device signals */''}
<li>The processor finishes executing the current instruction.</li>${/* hardware step 2: the current instruction finishes */''}
<li>The processor tests for a pending interrupt, finds one, and sends the device an acknowledgment; the device drops its request.</li>${/* hardware step 3: test for a pending request and acknowledge it */''}
<li>The processor pushes the PSW and the PC onto the control stack; the next step overwrites them.</li>${/* hardware step 4: push the PSW and PC */''}
<li>The processor loads the PC with the start address of the right interrupt handler (known from the signal, or by asking the device) and switches to privileged <b>kernel mode</b>.</li>${/* hardware step 5: load the handler's address and switch to kernel mode */''}
</ol>${/* end of the hardware steps */''}
<p><b>Software</b> (the OS interrupt handler):</p>${/* lead-in to the software steps */''}
<ol start="6">${/* start of the software steps, numbered from 6 */''}
<li>The handler saves the rest of the processor state: the general registers it will use.</li>${/* software step 6: the handler saves the registers it will use */''}
<li>The handler processes the interrupt (e.g. reads the device status, sends more data).</li>${/* software step 7: the handler serves the device */''}
<li>The saved registers are restored from the stack.</li>${/* software step 8: the registers are restored */''}
<li>The PSW and PC are restored from the stack by a return-from-interrupt instruction, so the program resumes at its next instruction.</li>${/* software step 9: return from interrupt restores the PSW and PC */''}
</ol>${/* end of the software steps */''}
<p><b>Worked example.</b> The program is executing the instruction at N = 400, so the PC already holds N + 1 = 401. The control stack starts at T = 1000 and grows toward lower addresses, one word per item. Step 4 pushes the PSW (to 999) and PC = 401 (to 998): SP goes 1000 → 998. Step 5 sets PC to the handler address Y = 900. Step 6 pushes R1, R2, R3: SP → 995. Step 8 pops them: SP → 998. Step 9 pops PC and PSW: SP → 1000, PC = 401. A pop only moves SP; old values stay in memory but count as free. Likewise, PSW, PC and 4 registers pushed from 1000 leave SP = 994.</p>${/* notes paragraph: the worked example, following the stack pointer through every push and pop */''}

<h3>Multiple interrupts</h3>${/* heading for the notes part on multiple interrupts */''}
<p><b>Approach 1: disable interrupts</b> while any handler runs. A request that arrives meanwhile is not lost: it stays pending, whatever its priority, until the handler ends and interrupts are re-enabled. Waiting requests are served strictly one at a time (here, oldest first). Simple, but it ignores priority. Example: printer handler t = 10–20, comm line interrupts at t = 12: the comm handler cannot start until t = 20, risking lost characters.</p>${/* notes paragraph: approach 1, disabling interrupts, with the printer and comm line example */''}
<p><b>Approach 2: priorities with nesting.</b> Each source has a priority. A higher-priority request may interrupt a lower-priority handler (its state is saved on the stack); a lower-priority request waits, pending, until higher-priority handlers finish. When a handler ends, the processor serves the most urgent pending request that outranks what it would return to.</p>${/* notes paragraph: approach 2, priorities with nesting */''}
<p><b>Classic example</b> (priorities: printer 2, disk 4, comm line 5; each handler needs 10 units):</p>${/* lead-in to the classic example table */''}
<table>${/* start of the classic example table */''}
<tr><th>Time</th><th>Event</th><th>What runs</th></tr>${/* table header: time, event, what runs */''}
<tr><td>t = 10</td><td>Printer interrupts the user program</td><td>Printer handler</td></tr>${/* table row: t = 10, the printer handler starts */''}
<tr><td>t = 15</td><td>Comm line interrupts; 5 &gt; 2, printer handler suspended</td><td>Comm handler</td></tr>${/* table row: t = 15, the comm line preempts the printer handler */''}
<tr><td>t = 20</td><td>Disk interrupts; 4 &lt; 5, so it waits (pending)</td><td>Comm handler continues</td></tr>${/* table row: t = 20, the disk waits because the comm handler outranks it */''}
<tr><td>t = 25</td><td>Comm handler done; disk (4) outranks printer (2)</td><td>Disk handler</td></tr>${/* table row: t = 25, the disk handler runs next */''}
<tr><td>t = 35</td><td>Disk handler done; nothing pending</td><td>Printer handler resumes</td></tr>${/* table row: t = 35, the printer handler resumes */''}
<tr><td>t = 40</td><td>Printer handler done</td><td>User program resumes</td></tr>${/* table row: t = 40, the user program resumes */''}
</table>${/* end of the classic example table */''}
<p>With interrupts disabled instead, the same arrivals give printer 10–20, comm 20–30 (a 5-unit wait for the most urgent device), disk 30–40. Nesting serves urgent devices fast; low-priority handlers finish later.</p>${/* notes paragraph: the same arrivals with interrupts disabled, and the trade-off */''}
`,  // end of the notes text
  });  // closes the section object and the Guide.section call
})();  // closes and immediately runs the wrapper function opened at the top of the file
