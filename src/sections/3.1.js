// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 3.1 — What Is a Process?
   Why the OS manages work in processes (hardware, applications, the OS
   interface, the three process-level duties), four definitions of a
   process, program vs process, code + data, the process control block
   and its eight elements, and how the PCB lets the OS interrupt a
   process and later resume it. Helpers live inside this IIFE so
   nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file
  /* ------------------------------------------------------------------
     Step 2 helper: a tiny scheduler for three processes.
       A: 6 units of processor work
       B: 2 units of work, 4 units waiting for the disk, 2 more units
       C: 1 unit (a keystroke to echo)
     mode 'serial' runs each to completion (the processor idles while B
     waits); mode 'rr' interleaves them with time slice q and hands the
     processor to someone else whenever a process blocks.
     Returns per-process segments, the processor timeline and finish times.
     ------------------------------------------------------------------ */
  const JOBS = [  // JOBS: the three sample processes for the scheduling demo; ph lists each one's phases as [kind, time units]
    { id: 'A', ph: [['cpu', 6]] },  // process A: 6 units of processor work
    { id: 'B', ph: [['cpu', 2], ['io', 4], ['cpu', 2]] },  // process B: 2 units of processor work, 4 units waiting for the disk (io), then 2 more units of work
    { id: 'C', ph: [['cpu', 1]] },  // process C: a single unit of work, like echoing one keystroke
  ];  // closes JOBS
  function schedule(mode, q) {  // schedule(mode, q): simulates running the three jobs one after another ('serial') or taking turns ('rr', slices of q units)
    const st = JOBS.map((j) => ({ id: j.id, ph: j.ph.map((p) => p.slice()), k: 0, done: null, ioUntil: null }));  // st copies each job's phases so the simulation can count them down; k is the current phase, done the finish time, ioUntil when disk waiting ends
    const segs = { A: [], B: [], C: [] };  // segs collects, for each process, the stretches of time it spent working, waiting for the disk or waiting its turn
    const cpu = [];  // cpu records, unit by unit, which process had the processor (null means the processor sat idle)
    const push = (id, kind, a, b) => {  // push(id, kind, a, b): adds a stretch from time a to b for one process, joining it to the previous stretch if it continues it
      const L = segs[id], last = L[L.length - 1];  // L is that process's list of stretches and last is its most recent one
      if (last && last.kind === kind && last.b === a) last.b = b; else L.push({ kind, a, b });  // if the last stretch is the same kind and ends where this one starts, it is extended; otherwise a new stretch is added
    };  // ends push()
    let t = 0;  // t is the simulated clock, in time units
    if (mode === 'serial') {  // serial mode: each process runs from start to finish before the next one begins
      for (const p of st) {  // goes through the processes in order A, B, C
        if (t > 0) push(p.id, 'wait', 0, t);  // a process that does not go first spends the time before its start waiting its turn
        for (const [kind, d] of p.ph) {  // walks through this process's phases
          push(p.id, kind, t, t + d);  // records the phase as one stretch
          for (let i = 0; i < d; i++) cpu.push(kind === 'cpu' ? p.id : null);  // during processor phases the processor is busy with this process; during disk phases it sits idle
          t += d;  // moves the clock forward by the phase's length
        }  // ends the loop over phases
        p.done = t;  // records when this process finished
      }  // ends the loop over processes
    } else {  // round-robin mode ('rr'): processes take turns in short time slices
      const ready = st.slice();  // ready is the queue of processes waiting for the processor; at first everyone is ready
      let run = null, used = 0;  // run is the process on the processor now, and used is how many units of its slice it has used
      while (st.some((p) => p.done == null) && t < 60) {  // steps the clock one unit at a time until every process is done (60 units is a safety limit)
        for (const p of st) if (p.ioUntil === t) { p.ioUntil = null; p.k++; ready.push(p); }  // a process whose disk wait ends now moves on to its next phase and rejoins the back of the ready queue
        if (run && used >= q) { ready.push(run); run = null; }  // a process that has used its whole slice is sent to the back of the queue (it is preempted)
        if (!run && ready.length) { run = ready.shift(); used = 0; }  // if the processor is free, the process at the front of the queue gets it with a fresh slice
        for (const p of st) {  // records what every unfinished process is doing during this unit:
          if (p.done != null) continue;  // finished processes are skipped
          push(p.id, p === run ? 'cpu' : p.ioUntil != null ? 'io' : 'wait', t, t + 1);  // working if it holds the processor, waiting for the disk if blocked on I/O, otherwise waiting its turn
        }  // ends the loop over processes
        cpu.push(run ? run.id : null);  // notes who had the processor this unit, or null if it was idle
        if (run) {  // if a process is running:
          run.ph[run.k][1]--; used++;  // one unit of its current phase is done and one unit of its slice is used
          if (run.ph[run.k][1] === 0) {  // if that phase is now finished:
            run.k++;  // it moves to its next phase
            if (run.k >= run.ph.length) run.done = t + 1;  // no phases left means the process finishes at the end of this unit
            else run.ioUntil = t + 1 + run.ph[run.k][1];  // otherwise the next phase is a disk wait, so it sets when that wait will end
            run = null;  // either way it gives up the processor, so someone else can run while it waits
          }  // ends the finished-phase case
        }  // ends the running case
        t++;  // advances the clock by one unit
      }  // ends the round-robin loop
    }  // ends the choice of mode
    const busy = cpu.filter(Boolean).length;  // busy counts the units in which the processor did useful work
    return { segs, cpu, total: t, busy, fin: Object.fromEntries(st.map((p) => [p.id, p.done])) };  // returns the stretches, the processor timeline, the total time, the busy count and each process's finish time
  }  // ends schedule()

  /* ------------------------------------------------------------------
     Step 2, tab 2: allocate resources by policy, avoid deadlock.
     Two processes both need the printer AND the scanner.
     Each frame lists edges [process, resource, 'holds' | 'waits'].
     ------------------------------------------------------------------ */
  const ALLOC = {  // ALLOC: the frames of the resource-allocation demo; each frame lists who holds or waits for which device, plus a caption
    any: [  // scenario "any": the OS grants every request as soon as it arrives, with no rule
      { e: [], st: ['needs both', 'needs both'],  // frame 1: nobody holds anything yet (st gives each process's status label)
        cap: '<b>Start.</b> P1 and P2 each need <b>both</b> the printer and the scanner to finish. The OS grants each request the moment it arrives.' },  // frame 1 caption: both processes need both devices, and requests are granted immediately
      { e: [['P1', 'printer', 'holds']], st: ['holds printer', 'needs both'],  // frame 2: P1 holds the printer
        cap: 'P1 asks for the printer. It is free, so the OS grants it.' },  // frame 2 caption: the printer was free, so P1 gets it
      { e: [['P1', 'printer', 'holds'], ['P2', 'scanner', 'holds']], st: ['holds printer', 'holds scanner'],  // frame 3: P1 holds the printer and P2 holds the scanner
        cap: 'P2 asks for the scanner. It is free too, so the OS grants it. Each process now holds one of the two.' },  // frame 3 caption: each process now holds one of the two devices
      { e: [['P1', 'printer', 'holds'], ['P2', 'scanner', 'holds'], ['P1', 'scanner', 'waits']], st: ['waiting', 'holds scanner'],  // frame 4: P1 also waits for the scanner
        cap: 'P1 asks for the scanner. P2 holds it, so P1 must <b>wait</b> until P2 lets go.' },  // frame 4 caption: P2 has the scanner, so P1 must wait
      { e: [['P1', 'printer', 'holds'], ['P2', 'scanner', 'holds'], ['P1', 'scanner', 'waits'], ['P2', 'printer', 'waits']], st: ['stuck', 'stuck'], dead: true,  // frame 5: P2 now waits for the printer too; dead marks this frame as the deadlock
        cap: '<b style="color:var(--bad)">Deadlock.</b> P2 now waits for the printer, which P1 holds. Each waits for the other, neither can finish, so neither ever releases anything. Both are stuck forever.' },  // frame 5 caption: each waits for the other forever, which is deadlock
    ],  // closes the "any" scenario
    rule: [  // scenario "rule": the OS serves requests by priority and in a fixed order, printer before scanner
      { e: [], st: ['needs both', 'needs both'],  // frame 1: nobody holds anything yet
        cap: '<b>Start.</b> Same two processes, but the OS enforces a policy: requests are served by <b>priority</b>, and everyone must ask for the printer <b>before</b> the scanner.' },  // frame 1 caption: the same two processes, now under a priority and ordering policy
      { e: [['P1', 'printer', 'holds'], ['P2', 'printer', 'waits']], st: ['holds printer', 'waiting'],  // frame 2: P1 holds the printer and P2 waits for it
        cap: 'Both ask for the printer at the same moment. The policy serves the higher priority first, so P1 gets it. P2 waits while holding nothing, so it blocks nobody.' },  // frame 2 caption: P1 has higher priority; P2 waits while holding nothing, so it blocks nobody
      { e: [['P1', 'printer', 'holds'], ['P1', 'scanner', 'holds'], ['P2', 'printer', 'waits']], st: ['holds both', 'waiting'],  // frame 3: P1 holds both devices while P2 still waits
        cap: 'P1 asks for the scanner. Nobody has it, so P1 gets it and now holds everything it needs.' },  // frame 3 caption: the scanner was free, so P1 now has everything it needs
      { e: [['P2', 'printer', 'holds']], st: ['finished', 'holds printer'],  // frame 4: P1 is finished and P2 holds the printer
        cap: 'P1 finishes and releases both devices. The OS hands the printer to P2, which was next in line.' },  // frame 4 caption: P1 releases both devices and the printer passes to P2
      { e: [['P2', 'printer', 'holds'], ['P2', 'scanner', 'holds']], st: ['finished', 'holds both'], ok: true,  // frame 5: P2 holds both devices; ok marks this frame as the happy ending
        cap: '<b style="color:var(--ok)">Both finish.</b> P2 takes the scanner and completes. Because every process asks in the same order, a circle of waiting can never form.' },  // frame 5 caption: both finish, because asking in the same order means a circle of waiting cannot form
    ],  // closes the "rule" scenario
  };  // closes ALLOC
  function dutyAllocate(panel, ctx) {  // dutyAllocate(panel, ctx): builds tab 2 of step 2, the resource-allocation and deadlock demo, inside panel
    const { h, s } = ctx;  // h builds page elements and s builds SVG (the browser's drawing format) elements
    let rule = 'any';  // rule is the scenario being shown: 'any' (no rule) at first, or 'rule' (the policy)
    const svg = s('svg', { viewBox: '0 0 600 236', width: '100%', role: 'img', 'aria-label': 'Two processes and two devices' });  // the SVG drawing of two processes on the left and two devices on the right
    const BOX = { P1: [30, 26], P2: [30, 150], printer: [410, 26], scanner: [410, 150] };   // top-left corners, 160 x 60
    const EDGE = {   // [x1, y1, x2, y2] from the process side to the resource side, label position
      'P1-printer': [190, 56, 410, 56, 300, 46], 'P2-scanner': [190, 180, 410, 180, 300, 170],  // positions of the two straight arrows (P1 to printer, P2 to scanner) and where their labels go
      'P1-scanner': [190, 76, 410, 160, 238, 100], 'P2-printer': [190, 160, 410, 76, 238, 147],  // positions of the two crossing arrows (P1 to scanner, P2 to printer) and their labels
    };  // closes EDGE
    function draw(f) {  // draw(f): redraws the picture for frame f; the player calls it through its render function
      svg.replaceChildren();  // empties the drawing first
      for (const [p, r, kind] of f.e) {  // draws one arrow for every holds/waits entry in this frame
        const [x1, y1, x2, y2, lx, ly] = EDGE[p + '-' + r];  // looks up the arrow's end points and label position for this process-device pair
        const bad = f.dead;  // bad is true in the deadlock frame, where every arrow turns red
        const col = bad ? 'var(--bad)' : kind === 'holds' ? 'var(--proc)' : 'var(--warn)';  // arrow colour: red in deadlock, process colour for "holds", amber for "waits"
        const mk = bad ? 'bad' : kind === 'holds' ? 'proc' : 'warn';  // the matching arrowhead name, so the head has the same colour as the line
        // "holds" arrows point resource → process; "waits" arrows point process → resource
        const [ax, ay, bx, by] = kind === 'holds' ? [x2, y2, x1 + 4, y1] : [x1, y1, x2 - 4, y2];  // picks the arrow's start and end so its head points the right way, stopping just short of the box
        svg.append(s('line', { x1: ax, y1: ay, x2: bx, y2: by, style: `stroke:${col}`, 'stroke-width': 3, 'stroke-dasharray': kind === 'waits' ? '8 6' : null, 'marker-end': `url(#arr-${mk})` }),  // draws the arrow: solid for holds, dashed for waits, with a coloured arrowhead from the shared marker set
          s('text', { x: lx, y: ly, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: 'halo', style: `fill:${col}` }, kind === 'holds' ? 'held by' : 'waits for'));  // the arrow's label, "held by" or "waits for", outlined so the line does not cut through the letters
      }  // ends the arrow loop
      const proc = (id, i, prio) => s('g', {},  // proc(id, i, prio): builds one process box
        s('rect', { x: BOX[id][0], y: BOX[id][1], width: 160, height: 60, rx: 12, class: f.dead ? 's-bad' : 's-proc', 'stroke-width': 2 }),  // the box, red in the deadlock frame
        s('text', { x: BOX[id][0] + 80, y: BOX[id][1] + 25, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, id + (rule === 'rule' ? ' · ' + prio : '')),  // the process name, followed by its priority when the policy is on
        s('text', { x: BOX[id][0] + 80, y: BOX[id][1] + 47, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, f.st[i]));  // the process's status for this frame, such as "holds printer" or "stuck"
      const dev = (id, label) => s('g', {},  // dev(id, label): builds one device box
        s('rect', { x: BOX[id][0], y: BOX[id][1], width: 160, height: 60, rx: 12, class: 's-io', 'stroke-width': 2 }),  // the device box in the I/O colour
        s('text', { x: BOX[id][0] + 80, y: BOX[id][1] + 36, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, label));  // the device name centred in its box
      svg.append(proc('P1', 0, 'high priority'), proc('P2', 1, 'normal'), dev('printer', 'Printer'), dev('scanner', 'Scanner'));  // adds both process boxes (P1 high priority, P2 normal) and both device boxes on top of the arrows
    }  // ends draw()
    const card = h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center', padding: '8px 12px' } }, svg);  // a white card that holds the drawing, centred
    const player = ctx.ui.player({ count: ALLOC[rule].length, render: (i) => { draw(ALLOC[rule][i]); card.style.borderColor = ALLOC[rule][i].dead ? 'var(--bad)' : ALLOC[rule][i].ok ? 'var(--ok)' : ''; return ALLOC[rule][i].cap; }, interval: 2200 });  // the step player: one step per frame; each step draws the frame, turns the card border red or green at the end, and returns the caption
    const seg = ctx.ui.seg([{ value: 'any', label: 'No rule: grant on request' }, { value: 'rule', label: 'Policy: priority + printer first' }], rule, (v) => { rule = v; player.stop(); player.setCount(ALLOC[rule].length); });  // buttons to choose no rule or the policy; switching stops the player and restarts it with that scenario's frames
    const text = h('div', { class: 'stack', style: { gap: '8px' }, html: `${/* the explanation text on the left, written as one block of HTML */''}
      <h3 class="m0">Duty 2 · Allocate resources by policy, without deadlock</h3>${/* heading for duty 2: allocate resources by policy, without deadlock */''}
      <p class="m0">Processes compete for memory, files, devices and processor time. The OS hands these out following a stated <b>policy</b>, for example by <span class="t">priority</span>: more important work is served first.</p>${/* paragraph: the OS hands out resources by a policy such as priority */''}
      <p class="m0">It must also avoid <span class="t">deadlock</span>: a standstill in which processes each hold something another one needs, so all of them wait forever.</p>${/* paragraph: what deadlock is */''}
      <div class="callout tip m0" data-label="Try it">Step through with no rule until the processes jam, then switch to the policy and replay.</div>${/* tip box: step through with no rule until the processes jam, then switch to the policy */''}
      <div class="callout warn m0" data-label="Common mistake">Deadlock is not the same as slowness. A slow process finishes eventually; deadlocked processes never do, unless the OS steps in, for example by taking a resource away or ending one of them.</div>` });  // common mistake box: deadlock is not slowness, it never ends unless the OS steps in; end of the text
    panel.append(h('div', { class: 'split l fill' }, text, h('div', { class: 'stack' }, seg, card, player.el)));  // lays out the tab: text on the left, then the picker, drawing and player on the right
  }  // ends dutyAllocate()

  /* ------------------------------------------------------------------
     Step 2, tab 3: user creation of processes + interprocess communication.
     ------------------------------------------------------------------ */
  function dutyIPC(panel, ctx) {  // dutyIPC(panel, ctx): builds tab 3 of step 2, where the user opens programs and they exchange a message
    const { h, s } = ctx;  // h builds page elements and s builds SVG elements
    const SLOT = [20, 215, 410];                     // x of the three process slots (170 wide)
    let st;  // st holds the demo's state: the three process slots, the next free process ID, and the last action
    const svg = s('svg', { viewBox: '0 0 600 250', width: '100%', role: 'img', 'aria-label': 'User, operating system and processes' });  // the SVG drawing: the user at the top, the OS in the middle, three process slots at the bottom
    const log = h('div', { class: 'log', style: { height: '84px' } });  // a short log box listing the last few events
    const say = h('p', { class: 'small m0', style: { minHeight: '44px' } });  // a sentence that explains the last action
    const reset = () => {  // reset(): puts the demo back to its starting state; runs at the start and when Reset is pressed
      st = { procs: [{ name: 'Desktop', pid: 120 }, null, null], next: 121, last: null };  // only the Desktop process (PID 120) exists; the next new process will get ID 121
      log.replaceChildren(h('div', {}, 'at login: OS creates Desktop (PID 120)'));  // the log starts with the OS creating Desktop at login
      say.innerHTML = 'Only the Desktop process is running. <b>Open</b> two programs, then have them exchange a message.';  // the instructions: open two programs, then have them exchange a message
      draw();  // redraws the picture
    };  // ends reset()
    const slotOf = (name) => st.procs.findIndex((p) => p && p.name === name);  // slotOf(name): finds which slot a running program is in, or -1 if it is not running
    function draw() {  // draw(): redraws the user, the OS, the process slots and any arrow for the last action
      svg.replaceChildren();  // empties the drawing
      const L = st.last;  // L is the last action (a create or a message), used to draw its arrow
      svg.append(s('circle', { cx: 50, cy: 15, r: 8, class: 's-panel', 'stroke-width': 2 }),  // the user's head, drawn as a small circle...
        s('path', { d: 'M36 40 Q36 25 50 25 Q64 25 64 40 Z', class: 's-panel', 'stroke-width': 2 }),  // ...and shoulders, drawn as a curved shape
        s('text', { x: 72, y: 34, 'font-size': 15, 'font-weight': 800 }, 'You (the user)'),  // label beside the figure: "You (the user)"
        s('rect', { x: 10, y: 62, width: 580, height: 60, rx: 12, class: 's-os', 'stroke-width': 2 }),  // a wide band for the operating system
        s('text', { x: 300, y: 84, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, 'Operating system'),  // the OS band's title
        s('text', { x: 300, y: 103, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, 'creates processes · carries messages between them'));  // the OS band's subtitle: it creates processes and carries messages between them
      st.procs.forEach((p, i) => {  // draws each of the three process slots
        const x = SLOT[i], fresh = L && L.kind === 'create' && L.slot === i;  // x is the slot's left edge; fresh is true if a process was just created in it
        svg.append(p  // a filled slot shows a process box, an empty one a dashed outline
          ? s('g', {}, s('rect', { x, y: 160, width: 170, height: 76, rx: 12, class: 's-proc', 'stroke-width': fresh ? 3.5 : 2 }),  // the process box, with a thicker border if it was just created
            s('text', { x: x + 85, y: 186, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, p.name),  // the program's name
            s('text', { x: x + 85, y: 206, 'text-anchor': 'middle', 'font-size': 13.5 }, 'PID ' + p.pid),  // its process ID (PID), the number the OS uses to identify it
            s('text', { x: x + 85, y: 226, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'private memory'))  // a reminder that each process has its own private memory
          : s('g', {}, s('rect', { x, y: 160, width: 170, height: 76, rx: 12, class: 's-muted', 'stroke-dasharray': '6 5' }),  // an empty slot: a dashed outline...
            s('text', { x: x + 85, y: 203, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, '(no process)')));  // ...with "(no process)" in it
      });  // ends the slot loop
      if (L && L.kind === 'create') {  // if the last action created a process:
        const cx = SLOT[L.slot] + 85;  // cx is the centre of the new process's slot
        svg.append(s('line', { x1: 50, y1: 42, x2: 50, y2: 59, class: 's-line', 'marker-end': 'url(#arr-os)' }),  // a short arrow from the user down to the OS...
          s('text', { x: 62, y: 56, 'font-size': 13.5, 'font-weight': 700, style: 'fill:var(--os)' }, 'double-click'),  // ...labelled "double-click"
          s('line', { x1: cx, y1: 122, x2: cx, y2: 156, style: 'stroke:var(--os)', 'stroke-width': 3, 'marker-end': 'url(#arr-os)' }),  // an arrow from the OS down to the new process...
          s('text', { x: cx + 8, y: 144, 'font-size': 13.5, 'font-weight': 800, class: 'halo', style: 'fill:var(--os)' }, 'create'));  // ...labelled "create"
      }  // ends the create case
      if (L && L.kind === 'msg') {  // if the last action was a message:
        const a = SLOT[L.from] + 85, b = SLOT[L.to] + 85;  // a and b are the centres of the sending and receiving slots
        svg.append(s('path', { d: `M${a} 160 V113 H${b} V156`, fill: 'none', style: 'stroke:var(--proc)', 'stroke-width': 3, 'marker-end': 'url(#arr-proc)' }),  // an arrow that leaves the sender, runs along under the OS band and drops into the receiver, showing the OS carries it
          s('rect', { x: (a + b) / 2 - 62, y: 128, width: 124, height: 24, rx: 6, class: 's-proc', 'stroke-width': 1.5 }),  // a small box on the arrow...
          s('text', { x: (a + b) / 2, y: 145, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, L.text));  // ...holding the message text
      }  // ends the message case
    }  // ends draw()
    const add = (line) => { log.append(h('div', {}, line)); while (log.children.length > 3) log.firstChild.remove(); };  // add(line): adds a line to the log and keeps only the latest three
    function open(name) {  // open(name): starts a program as a new process; runs when an Open button is pressed
      if (slotOf(name) >= 0) { say.innerHTML = `${name} is already running. (A second copy would be a second process: step 4 shows that.)`; return; }  // a program already running is not opened again here, with a note that a second copy would be a second process
      const i = st.procs.findIndex((p) => !p);  // i is the first empty slot
      const pid = st.next++;  // pid is the next free process ID, and the counter moves on
      st.procs[i] = { name, pid };  // puts the new process into the empty slot
      st.last = { kind: 'create', slot: i };  // remembers the action so draw() shows the create arrows
      add(`you open ${name} → OS creates PID ${pid}`);  // logs the program being opened and the PID the OS gave it
      say.innerHTML = `You asked for a program, so the OS <b>created a process</b> for it: new identifier (PID ${pid}), its own memory, its own record. That is user creation of processes.`;  // explains that the OS created a process with its own ID, memory and record
      draw();  // redraws the picture
    }  // ends open()
    function send(fromName, toName, text) {  // send(fromName, toName, text): passes a message from one program to another through the OS
      const f = slotOf(fromName), t = slotOf(toName);  // f and t are the slots of the sender and the receiver
      if (f < 0 || t < 0) { say.innerHTML = 'Open <b>both</b> the Editor and the Speller first: a message needs a sender and a receiver.'; return; }  // if either program is not running yet, explains that a message needs both a sender and a receiver
      st.last = { kind: 'msg', from: f, to: t, text };  // remembers the action so draw() shows the message arrow
      add(`${fromName} → OS → ${toName}: ${text}`);  // logs the message and the route it took through the OS
      say.innerHTML = `${fromName} cannot write into ${toName}’s private memory, so it hands the message to the OS, which delivers it. That is <span class="t">interprocess communication (IPC)</span>.`;  // explains that one process cannot write into another's memory, so the OS delivers the message (IPC)
      draw();  // redraws the picture
    }  // ends send()
    const btns = h('div', { class: 'row', style: { gap: '6px' } },  // the row of buttons for this tab
      h('button', { class: 'btn sm proc', type: 'button', onclick: () => open('Editor') }, 'Open the Editor'),  // button: open the Editor program
      h('button', { class: 'btn sm proc', type: 'button', onclick: () => open('Speller') }, 'Open the Speller'),  // button: open the Speller program
      h('button', { class: 'btn sm', type: 'button', onclick: () => send('Editor', 'Speller', '“teh cat”?') }, 'Editor → Speller'),  // button: the Editor asks the Speller about a misspelled phrase
      h('button', { class: 'btn sm', type: 'button', onclick: () => send('Speller', 'Editor', '“the cat”') }, 'Speller → Editor'),  // button: the Speller replies with the corrected phrase
      h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset'));  // button: reset the demo to just the Desktop process
    reset();  // sets up the starting state and first drawing
    const text = h('div', { class: 'stack', style: { gap: '8px' }, html: `${/* the explanation text on the left, written as one block of HTML */''}
      <h3 class="m0">Duty 3 · Let processes talk, and let users create them</h3>${/* heading for duty 3: let processes talk and let users create them */''}
      <p class="m0">Programs often cooperate: an editor asks a spell checker about a word, a browser tab asks a network helper for a page. The OS keeps each process’s memory private, so it must provide <span class="t">interprocess communication (IPC)</span>: a controlled door between processes.</p>${/* paragraph: cooperating programs need IPC, a controlled door, because their memory is private */''}
      <p class="m0">Users, and programs, must also be able to <b>create</b> new processes. Double-clicking an icon or typing a command is a request to the OS to start one.</p>${/* paragraph: double-clicking or typing a command asks the OS to create a process */''}
      <div class="callout why m0" data-label="Why it matters">Privacy between processes keeps one buggy program from corrupting another. IPC lets them cooperate anyway, on the OS’s terms.</div>` });  // why-it-matters box: privacy protects processes from each other, and IPC lets them cooperate; end of the text
    panel.append(h('div', { class: 'split l fill' }, text, h('div', { class: 'stack', style: { gap: '8px' } }, btns, h('div', { class: 'card white', style: { padding: '8px 12px' } }, svg), say, log)));  // lays out the tab: text on the left; buttons, drawing, explanation and log on the right
  }  // ends dutyIPC()

  /* ------------------------------------------------------------------
     Steps 5 and 7: the eight PCB elements, with plain explanations and
     the kitchen-ticket analogy, plus the frames of a toy process (PID 42)
     whose PCB changes as it runs. cpu = live processor values or null.
     Processor time grows only while Running; clock time always grows.
     ------------------------------------------------------------------ */
  const FIELDS = [  // FIELDS: the eight PCB elements as [key, name, what it holds, why the OS needs it, kitchen-ticket analogy]
    ['id', 'Identifier', 'A unique number for this process, its <span class="t">process identifier (PID)</span>.', 'Two processes can run the same program. The OS, and other processes, need a way to name exactly one of them.', 'The order number. Two tables may both order lasagna, but ticket 42 means exactly one of those dishes.'],  // PCB element: the identifier (PID), naming exactly one process
    ['state', 'State', 'Where the process stands right now, for example New, Ready, Running or Blocked (its <span class="t">process state</span>).', 'It tells the OS what the process may do next: only a process that is ready can be given the processor. Section 3.2 is all about states.', '“Waiting for a burner”, “on the stove”, “waiting for the oven”, “served”.'],  // PCB element: the state, what the process may do next
    ['prio', 'Priority', 'How important this process is compared with the others (its <span class="t">priority</span>).', 'When several processes want the processor or a resource, the OS’s policy may serve the higher priority first.', 'A rush flag: this table has a train to catch.'],  // PCB element: the priority, used when several processes compete
    ['pc', 'Program counter', 'The address of the <b>next instruction</b> the process will execute (its saved <span class="t">program counter (PC)</span>).', 'Without it the OS could not restart the process at the right place after pausing it.', 'Which step of the recipe comes next.'],  // PCB element: the program counter, where to restart
    ['mem', 'Memory pointers', 'Where the process’s program code and data are in memory, plus any memory blocks it shares with other processes (<span class="t">memory pointers</span>).', 'The OS must find, protect and eventually free that memory.', 'Which shelf and which pans hold this order’s ingredients.'],  // PCB element: the memory pointers, where code, data and shared blocks are
    ['ctx', 'Context data', 'The contents of the processor registers while the process is running (<span class="t">context data</span>).', 'Every process uses the same registers. Their values must be saved when the process stops and restored when it restarts.', 'What is in the pans at this moment: the half-made sauce.'],  // PCB element: the context data, the saved register values
    ['io', 'I/O status information', 'Outstanding I/O requests, the I/O devices assigned to the process, and the files it has in use (<span class="t">I/O status information</span>).', 'The OS must finish, cancel or clean these up, and it explains why a process is waiting.', '“Waiting on the oven; borrowed the big mixer.”'],  // PCB element: the I/O status information, requests, devices and open files
    ['acct', 'Accounting information', 'Processor time and clock time used so far, time limits, account numbers and similar (<span class="t">accounting information</span>).', 'For billing, for enforcing limits, for scheduling decisions and for statistics.', 'How long the order has been in the kitchen, and which table pays.'],  // PCB element: the accounting information, time used and limits
  ];  // closes FIELDS
  const MEM0 = 'code 0x5000–0x57FF · data 0x9000–0x9FFF';  // MEM0: the starting memory description for the sample process, its code and data address ranges
  const LIVE = 'in the processor now';  // LIVE: the text shown in PCB fields whose real values are in the processor while the process runs
  const PCB_FRAMES = [  // PCB_FRAMES: the frames of the sample process 42's life; v lists only the PCB fields that change, cpu the live [PC, R1, R2]
    { v: { id: '42', state: 'New', prio: 'normal', pc: '0x5000 (first instruction)', mem: MEM0, ctx: 'starting values: R1 = 0, R2 = 0', io: 'none', acct: 'CPU 0 ms · clock 0 ms · limit 2 s · acct lab-17' }, cpu: null,  // frame 1: process 42 is created with every PCB field filled in; it is not on the processor yet
      cap: '<b>Created.</b> You ask to shrink a photo. The OS gives the new process a unique identifier, 42, and fills in its PCB before running a single instruction.' },  // frame 1 caption: the OS gives the new process an ID and fills its PCB before running it
    { v: { state: 'Ready', acct: 'CPU 0 ms · clock 1 ms · limit 2 s · acct lab-17' }, cpu: null,  // frame 2: the state becomes Ready and clock time starts
      cap: '<b>Admitted.</b> The OS accepts the new process and marks it Ready: it could run the moment the processor is free. Clock time has started; processor time is still 0.' },  // frame 2 caption: admitted and ready; processor time is still 0
    { v: { state: 'Running', pc: LIVE, ctx: LIVE, acct: 'CPU 0 ms · clock 2 ms · limit 2 s · acct lab-17' }, cpu: ['0x5000', 0, 0],  // frame 3: Running; the PC and registers now live in the processor
      cap: '<b>Running.</b> The OS picks 42 and copies the PC and register values from its PCB into the processor. While 42 runs, the live values sit in the processor, not in the PCB.' },  // frame 3 caption: the OS copies the saved values into the processor
    { v: { io: 'files in use: photo.jpg', acct: 'CPU 3 ms · clock 5 ms · limit 2 s · acct lab-17' }, cpu: ['0x5010', 3, 0],  // frame 4: an open file is added to the I/O status
      cap: 'The process opens <i>photo.jpg</i>. The OS records the open file in the I/O status information, so it can close the file later, even if the process crashes.' },  // frame 4 caption: recording the open file lets the OS close it later even after a crash
    { v: { mem: MEM0 + ' · shared: preview block', acct: 'CPU 5 ms · clock 7 ms · limit 2 s · acct lab-17' }, cpu: ['0x5024', 3, 4096],  // frame 5: the memory pointers gain a block shared with the photo viewer
      cap: 'It sets up a <b>memory block shared</b> with the photo viewer, so the viewer can show a preview. The memory pointers now list that shared block as well.' },  // frame 5 caption: a shared memory block lets the viewer show a preview
    { v: { state: 'Blocked (waiting for disk)', pc: '0x5028 (saved)', ctx: 'saved: R1 = 3, R2 = 4096', io: 'outstanding: read photo.jpg · files: photo.jpg', acct: 'CPU 6 ms · clock 8 ms · limit 2 s · acct lab-17' }, cpu: null,  // frame 6: Blocked waiting for the disk; the PC and registers are saved into the PCB
      cap: '<b>Waits for the disk.</b> It asks to read the photo, which takes a while. The OS saves the PC and registers into the PCB, notes the outstanding request, and gives the processor to another process.' },  // frame 6 caption: the OS saves the context, notes the disk request and runs something else
    { v: { state: 'Ready', prio: 'high (you are watching it)', io: 'files in use: photo.jpg', acct: 'CPU 6 ms · clock 20 ms · limit 2 s · acct lab-17' }, cpu: null,  // frame 7: Ready again with raised priority; the disk request is gone
      cap: '<b>Disk done.</b> An interrupt tells the OS the data arrived, so the request leaves the I/O status and the state becomes Ready. You click its window, so the OS raises its priority. Clock time grew; processor time did not.' },  // frame 7 caption: an interrupt says the data arrived; clock time grew but processor time did not
    { v: { state: 'Running', pc: LIVE, ctx: LIVE, acct: 'CPU 6 ms · clock 23 ms · limit 2 s · acct lab-17' }, cpu: ['0x5028', 3, 4096],  // frame 8: Running again with the saved values back in the processor
      cap: '<b>Resumed.</b> The OS copies the saved PC (0x5028) and registers (3 and 4096) back into the processor. The process carries on exactly where it stopped.' },  // frame 8 caption: the process carries on exactly where it stopped
    { v: { io: 'files in use: photo.jpg, small.jpg', acct: 'CPU 14 ms · clock 31 ms · limit 2 s · acct lab-17' }, cpu: ['0x5064', 4, 1024],  // frame 9: a second file is added to the I/O status and processor time climbs
      cap: 'It shrinks the image and writes <i>small.jpg</i>. Another file joins the I/O status, and processor time keeps climbing while it runs.' },  // frame 9 caption: the shrunk image is written to a new file
    { v: { state: 'Exit', pc: '(finished)', ctx: '(no longer needed)', io: 'all files closed', mem: 'released', acct: 'CPU 15 ms · clock 32 ms · limit 2 s · acct lab-17' }, cpu: null,  // frame 10: Exit; files closed and memory released
      cap: '<b>Finished.</b> The OS closes its files and frees its memory, and keeps the accounting totals: 15 ms of processor time over 32 ms of clock time. Then the PCB itself is deleted.' },  // frame 10 caption: the OS keeps the accounting totals, then deletes the PCB
  ];  // closes PCB_FRAMES
  // expand the "only what changed" frames above into complete snapshots
  PCB_FRAMES.forEach((f, i) => { f.full = Object.assign({}, i ? PCB_FRAMES[i - 1].full : {}, f.v); });  // turns each frame into a full snapshot by copying the previous frame's fields and applying this frame's changes

  /* ------------------------------------------------------------------
     Step 6: interrupt and resume. Process A adds 17 + 40; process B
     doubles 9. full = true: the OS saves PC + registers (context data)
     in the PCB. full = false: a broken OS that saves only the PC, so
     the processes pick up each other's leftover register values.
     cpu = [PC, R1, R2]; A / B = PCB contents [state, PC, R1, R2].
     ------------------------------------------------------------------ */
  const CODE_A = `${/* CODE_A: process A's four-instruction program shown to students, with a memory address before each line */''}
1200  R1 = 17;      // put 17 in R1${/* shown code, A line 1: put 17 into register R1 */''}
1204  R2 = 40;      // put 40 in R2${/* shown code, A line 2: put 40 into register R2 */''}
1208  R1 = R1 + R2; // add R2 into R1${/* shown code, A line 3: add R2 into R1 */''}
120C  total = R1;   // save the sum`;  // shown code, A line 4: store the sum in total; end of program A
  const CODE_B = `${/* CODE_B: process B's four-instruction program shown to students */''}
3300  R1 = 5;       // put 5 in R1${/* shown code, B line 1: put 5 into R1 */''}
3304  R2 = 9;       // put 9 in R2${/* shown code, B line 2: put 9 into R2 */''}
3308  R2 = R2 * 2;  // double R2${/* shown code, B line 3: double R2 */''}
330C  count = R2;   // save the result`;  // shown code, B line 4: store the result in count; end of program B
  function resumeFrames(full) {  // resumeFrames(full): builds the frames of the interrupt-and-resume demo; full says whether the OS saves the registers too
    const IN = 'in processor', NS = 'not saved';  // IN and NS are the texts shown for values that are in the processor or were not saved
    const sv = (st, pc, r1, r2) => (full ? [st, pc, String(r1), String(r2)] : [st, pc, NS, NS]);  // sv(...): the PCB contents for a stopped process; without full saving the registers read "not saved"
    const run = (st) => [st, IN, IN, IN];  // run(st): the PCB contents for the running process, whose PC and registers are all in the processor
    const bad = (v) => `<b style="color:var(--bad)">${v}</b>`, good = (v) => `<b style="color:var(--ok)">${v}</b>`;  // bad(v) and good(v): wrap a value in red or green bold text for the captions
    const r2B = full ? 18 : 80, r2A = full ? 40 : 80, sum = full ? 57 : 97;  // the values that end up wrong when registers are not saved: B's doubled value, A's R2 and A's sum
    return [  // returns the list of frames:
      { who: 'A', cpu: ['0x1200', 0, 0], A: run('Running'), B: sv('Ready', '0x3308', 5, 9), total: '—',  // frame 1: A is running from its first instruction; B's PCB holds its saved values
        cap: '<b>A is running.</b> Its live program counter and registers are in the processor. B is waiting; ' + (full ? 'its PCB holds the PC and registers saved when it last stopped.' : 'this OS saved only its program counter.') },  // frame 1 caption: A's live values are in the processor; what B's PCB holds depends on the save mode
      { who: 'A', cpu: ['0x1204', 17, 0], A: run('Running'), B: sv('Ready', '0x3308', 5, 9), total: '—',  // frame 2: A has put 17 in R1
        cap: 'A executes <code>R1 = 17</code>. Its program counter moves on to 0x1204.' },  // frame 2 caption: A executes its first instruction and its PC moves on
      { who: 'A', cpu: ['0x1208', 17, 40], A: run('Running'), B: sv('Ready', '0x3308', 5, 9), total: '—',  // frame 3: A has put 40 in R2
        cap: 'A executes <code>R2 = 40</code>. The next instruction A needs is at 0x1208.' },  // frame 3 caption: A's next instruction is at 0x1208
      { who: 'OS', intr: true, cpu: ['OS', 17, 40], A: ['Running', 'set aside by hardware', IN, IN], B: sv('Ready', '0x3308', 5, 9), total: '—',  // frame 4: a timer interrupt; the OS runs and the hardware has set A's PC aside while R1 and R2 still hold A's values
        cap: '<b style="color:var(--intr)">Interrupt!</b> The timer says A’s time slice is over. The processor finishes A’s current instruction, sets A’s program counter (0x1208) aside, and jumps into the OS. R1 and R2 still hold A’s values.' },  // frame 4 caption: A's time slice is over, so the processor finishes the instruction and jumps into the OS
      { who: 'OS', cpu: ['OS', 17, 40], A: sv('Ready', '0x1208', 17, 40), B: sv('Ready', '0x3308', 5, 9), total: '—',  // frame 5: the OS saves A into its PCB and marks it Ready
        cap: full ? '<b>Save A.</b> The OS copies A’s program counter (0x1208) <b>and</b> the registers (17 and 40) into A’s PCB, and marks A Ready.'  // frame 5 caption with full saving: the PC and both registers go into A's PCB...
          : '<b>Save A, PC only.</b> This OS copies just A’s program counter (0x1208) into A’s PCB. The values 17 and 40 stay behind in the registers.' },  // ...and with PC-only saving: 17 and 40 are left behind in the registers
      { who: 'B', cpu: full ? ['0x3308', 5, 9] : ['0x3308', 17, 40], A: sv('Ready', '0x1208', 17, 40), B: run('Running'), total: '—',  // frame 6: B runs; with full saving it gets its own 5 and 9 back, otherwise it inherits A's 17 and 40
        cap: full ? '<b>Restore B.</b> The OS copies B’s saved values into the processor: PC 0x3308, R1 = 5, R2 = 9. B is running again.'  // frame 6 caption with full saving: B's saved values are copied into the processor...
          : '<b>Restore B, PC only.</b> The OS loads B’s PC, 0x3308. But the registers still hold A’s 17 and 40, not B’s 5 and 9.' },  // ...and with PC-only saving: B's PC is loaded but the registers still hold A's values
      { who: 'B', cpu: full ? ['0x330C', 5, 18] : ['0x330C', 17, 80], A: sv('Ready', '0x1208', 17, 40), B: run('Running'), total: '—',  // frame 7: B doubles R2, giving 18 when saved correctly or 80 when not
        cap: full ? 'B executes <code>R2 = R2 * 2</code>: 9 × 2 = ' + good(18) + '. B overwrites R2 freely, because A’s 40 is safe in A’s PCB.'  // frame 7 caption with full saving: 9 times 2 is 18, and A's 40 is safe in A's PCB...
          : 'B executes <code>R2 = R2 * 2</code> on the wrong value: 40 × 2 = ' + bad(80) + ' instead of 18.' },  // ...and with PC-only saving: B doubles the wrong value and gets 80
      { who: 'OS', intr: true, cpu: full ? ['OS', 5, 18] : ['OS', 17, 80], A: sv('Ready', '0x1208', 17, 40), B: sv('Ready', '0x330C', 5, r2B), total: '—',  // frame 8: a second timer interrupt; the OS saves B
        cap: full ? '<b style="color:var(--intr)">Interrupt, save B.</b> The timer fires again and the processor jumps into the OS, which saves B’s PC (0x330C) and registers (5 and 18) in B’s PCB and marks B Ready.'  // frame 8 caption with full saving: B's PC and registers go into B's PCB...
          : '<b style="color:var(--intr)">Interrupt, save B, PC only.</b> The timer fires again and the OS saves only B’s PC, 0x330C. The registers keep 17 and 80.' },  // ...and with PC-only saving: only B's PC is saved
      { who: 'A', cpu: ['0x1208', 17, r2A], A: run('Running'), B: sv('Ready', '0x330C', 5, r2B), total: '—',  // frame 9: A runs again with its registers restored, or with B's leftovers
        cap: full ? '<b>Restore A.</b> The OS copies A’s saved values back: PC 0x1208, R1 = 17, R2 = 40. The processor is exactly as A left it.'  // frame 9 caption with full saving: the processor is exactly as A left it...
          : '<b>Restore A, PC only.</b> A restarts at the right instruction, 0x1208, but R2 holds 80, B’s leftover, not A’s 40.' },  // ...and with PC-only saving: A restarts in the right place but R2 holds 80
      { who: 'A', cpu: ['0x120C', sum, r2A], A: run('Running'), B: sv('Ready', '0x330C', 5, r2B), total: '—',  // frame 10: A adds R2 into R1
        cap: 'A executes <code>R1 = R1 + R2</code>: ' + (full ? '17 + 40 = ' + good(57) + '. Correct.' : '17 + 80 = ' + bad(97) + '. Wrong.') },  // frame 10 caption: 17 plus 40 is 57 (correct), or 17 plus 80 is 97 (wrong)
      { who: 'A', cpu: ['0x1210', sum, r2A], A: run('Running'), B: sv('Ready', '0x330C', 5, r2B), total: String(sum), end: true,  // frame 11: A stores the sum; end marks the last frame
        cap: full ? good('total = 57.') + ' A finished correctly and never noticed the interruption. Saving the PC <b>and</b> the context data in the PCB made that possible.'  // frame 11 caption with full saving: A finished correctly and never noticed the interruption...
          : bad('total = 97.') + ' Both processes computed wrong values (A got 97, B got 80), and neither can tell. Resuming correctly needs the PC <b>and</b> the context data: that is why both live in the PCB.' },  // ...and with PC-only saving: both answers are wrong and neither process can tell, so the PCB must hold both PC and registers
    ];  // closes the list of frames
  }  // ends resumeFrames()


  Guide.section({  // registers this section with the guide: Guide.section receives one object describing its text, styles and steps
    id: '3.1',  // id: the section number; the guide uses it for links, saved progress and the sec-3-1 style class
    title: 'What Is a Process?',  // title: the full section name shown in the step header and the chapter menu
    short: 'What is a process?',  // short: a brief label used in tight lists such as the chapter's section list
    summary: 'Why the OS thinks in processes, what a process is, and the control block that lets it pause and resume one.',  // summary: one sentence shown on the chapter page describing what this section covers
    objectives: [  // objectives: the learning goals listed for this section, one string per goal
      'Explain why an OS stands between applications and hardware, and state its three process-level duties.',  // goal 1: why the OS sits between applications and hardware, and its three process duties
      'Define a process in four complementary ways and tell a process apart from a program.',  // goal 2: four definitions of a process, and process versus program
      'Name the two essential elements of a running program and the eight elements of a process control block.',  // goal 3: the two essential parts of a running program and the eight PCB elements
      'Trace how the process control block lets the OS interrupt a process and resume it exactly where it stopped.',  // goal 4: how the PCB lets the OS interrupt and resume a process
      'Pick the PCB element the OS would consult to answer a given question about a process.',  // goal 5: choosing which PCB element answers a given question
    ],  // closes the objectives list
    terms: [  // terms: glossary entries as [term, definition] pairs; they feed the glossary and the hover definitions
      ['Process', 'A program in execution: one running instance of a program, together with its data, its current state and the resources the OS has given it. It is the unit the OS schedules and manages.'],  // glossary entry: defines a process, a program in execution
      ['Program', 'A passive set of instructions stored in a file. It does nothing by itself until the OS loads it and starts a process to run it.'],  // glossary entry: defines a program, passive instructions in a file
      ['Process control block (PCB)', 'The record the OS creates and maintains for each process. It holds the identifier, state, priority, program counter, memory pointers, context data, I/O status information and accounting information.'],  // glossary entry: defines the process control block and its eight elements
      ['Process identifier (PID)', 'A unique number the OS gives each process so it can tell it apart from every other process, even ones running the same program.'],  // glossary entry: defines the process identifier (PID)
      ['Program counter (PC)', 'The processor register, and the PCB field that saves it, holding the address of the next instruction the process will execute.'],  // glossary entry: defines the program counter
      ['Context data', 'The values in the processor registers while a process runs. The OS copies them into the PCB when the process stops, so they can be put back later.'],  // glossary entry: defines context data, the saved register values
      ['Memory pointers', 'PCB entries that record where the process’s program code and data sit in memory, plus any memory blocks it shares with other processes.'],  // glossary entry: defines memory pointers
      ['I/O status information', 'The PCB part that lists a process’s outstanding I/O requests, the I/O devices assigned to it and the files it has in use.'],  // glossary entry: defines I/O status information
      ['Accounting information', 'The PCB part that records how much processor time and clock time a process has used, its time limits, its account numbers and similar bookkeeping.'],  // glossary entry: defines accounting information
      ['Priority', 'A level that says how important a process is compared with the others. The OS uses it to decide who gets the processor or a resource first.'],  // glossary entry: defines priority
      ['Processor utilization', 'The fraction of time the processor spends doing useful work instead of sitting idle, usually given as a percentage.'],  // glossary entry: defines processor utilization, the share of time spent on useful work
      ['Response time', 'How long a user waits between making a request (a click, a keystroke) and seeing the result.'],  // glossary entry: defines response time, how long a user waits for a result
      ['Time slice', 'A short, fixed amount of processor time a process may use before the OS switches the processor to another process.'],  // glossary entry: defines a time slice
      ['Interleaving', 'Running pieces of several processes one after another on one processor, switching between them so that all of them make progress.'],  // glossary entry: defines interleaving, taking turns on one processor
      ['Deadlock', 'A standstill in which two or more processes each hold a resource another one needs, so every one of them waits forever.'],  // glossary entry: defines deadlock
      ['Interprocess communication (IPC)', 'Any OS-provided way for processes to exchange data or signals, such as messages, pipes or a shared block of memory.'],  // glossary entry: defines interprocess communication (IPC)
      ['Abstraction', 'A simplified, tidy view of something complicated. The OS shows applications files instead of disk blocks, and processes instead of raw processor time.'],  // glossary entry: defines abstraction, a tidy view of something complicated
      ['Shared code', 'Program instructions kept in memory once and used by several processes at the same time. It is safe because running code only reads its instructions and never changes them.'],  // glossary entry: defines shared code, instructions used by several processes at once
      ['Interrupt', 'A signal that makes the processor stop the current program between two instructions and run an OS routine, for example when a timer expires or a device finishes.'],  // glossary entry: defines an interrupt
      ['Process state', 'The condition a process is in right now, such as Running, Ready or Blocked. The PCB records it so the OS knows what the process can do next.'],  // glossary entry: defines process state
    ],  // closes the terms list

    css: ` /* css: style rules for this section only; the guide adds them to the page once when the section registers */
      .sec-3-1 .hot { cursor: pointer; } /* .hot marks clickable parts of a drawing, so the mouse pointer becomes a pointing hand over them */
      .sec-3-1 .hot:hover rect, .sec-3-1 .hot:hover path.hitbox { stroke-width: 3.5; } /* hovering a clickable drawing part thickens its outline so the student sees what they will open */
      .sec-3-1 .info { background: var(--panel-2); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; font-size: 15.5px; line-height: 1.45; } /* .info is a details panel: tinted background, thin border, rounded corners, comfortable reading size */
      .sec-3-1 .info h4 { margin: 0 0 2px; } /* a heading inside the details panel sits close to the text below it */
      .sec-3-1 .info p { margin: 0 0 6px; } /* paragraphs in the details panel have a small gap between them */
      .sec-3-1 .info p:last-child { margin: 0; } /* the last paragraph in the details panel has no gap after it */
      .sec-3-1 .eq { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; font-weight: 800; font-size: 17px; } /* .eq lays out a word equation (such as code + data + PCB = process) centred on one line, wrapping if needed */
      .sec-3-1 .eq .box { padding: 5px 12px; } /* the boxes in that equation get compact padding */
      .sec-3-1 .halo { paint-order: stroke; stroke: var(--panel); stroke-width: 5px; stroke-linejoin: round; } /* .halo outlines SVG text with the panel colour so arrows and lines never cut through the letters */
      .sec-3-1 .player-cap { min-height: 70px; } /* gives the step player's caption a fixed minimum height so the controls do not jump as captions change */
      .sec-3-1 .lens { display: grid; grid-template-columns: 26px 1fr; gap: 8px; align-items: start; text-align: left; width: 100%; padding: 8px 12px; border-radius: 12px; border: 2px solid var(--line); background: var(--panel); cursor: pointer; font-size: 15px; line-height: 1.35; color: var(--ink); } /* .lens is one clickable definition button in step 3: a number badge beside the definition text */
      .sec-3-1 .lens:hover { border-color: var(--proc); } /* hovering a definition button outlines it in the process colour */
      .sec-3-1 .lens b { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; background: var(--proc-bg); color: var(--proc); font-size: 13px; } /* the number badge on a definition button: a small tinted square */
      .sec-3-1 .lens.on { border-color: var(--proc); background: var(--proc-bg); } /* the chosen definition button is filled with the process tint */
      .sec-3-1 .lens.on b { background: var(--proc); color: var(--panel); } /* the chosen button's badge turns solid with white text */
      .sec-3-1 svg .part { transition: opacity .25s; } /* .part is one piece of the step 3 drawing; pieces fade in and out smoothly as definitions change */
      .sec-3-1 .cmp tr.rowbtn { cursor: pointer; } /* .cmp is the comparison table in step 4; its clickable rows show a pointing hand */
      .sec-3-1 .cmp tr.rowbtn:hover td { background: var(--panel-2); } /* hovering a clickable row tints its cells */
      .sec-3-1 .cmp td { vertical-align: middle; } /* cells in the comparison table are centred vertically */
      .sec-3-1 .cmp { table-layout: fixed; } /* fixed table layout keeps the column widths steady as the text changes */
      .sec-3-1 .cmp th:nth-child(1) { width: 25%; } .sec-3-1 .cmp th:nth-child(2), .sec-3-1 .cmp th:nth-child(3) { width: 26%; } /* sets the widths of the table's first three columns */
      .sec-3-1 svg .lit rect, .sec-3-1 svg .lit path { stroke: var(--accent) !important; stroke-width: 4 !important; } /* .lit highlights a drawing part in step 4: its outline turns accent-coloured and thick */
      .sec-3-1 svg .lit text { fill: var(--accent) !important; font-weight: 800; } /* the text of a highlighted part also turns accent-coloured and bold */
      .sec-3-1 .pcb { display: flex; flex-direction: column; gap: 4px; } /* .pcb is the clickable PCB table in step 5: its eight rows stacked with small gaps */
      .sec-3-1 .pcb-head { display: flex; justify-content: space-between; align-items: baseline; padding: 2px 4px 6px; border-bottom: 2px solid var(--os); margin-bottom: 4px; color: var(--os); } /* the PCB table's title bar, underlined in the OS colour */
      .sec-3-1 .pf { display: grid; grid-template-columns: 190px 1fr; gap: 10px; align-items: center; padding: 6px 10px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); cursor: pointer; font-size: 15px; line-height: 1.3; min-height: 44px; } /* .pf is one PCB row: the element name in a fixed-width column beside its current value */
      .sec-3-1 .pcb.narrow .pf { grid-template-columns: 1fr; gap: 2px; } /* on a phone-width screen each PCB row puts the value under the name instead of beside it */
      .sec-3-1 .pf:hover { border-color: var(--os); } /* hovering a PCB row outlines it in the OS colour */
      .sec-3-1 .pf.sel { border-color: var(--os); background: var(--os-bg); } /* the selected PCB row is outlined and tinted in the OS colour */
      .sec-3-1 .pf .pl { font-weight: 800; } /* the element name in a PCB row is bold */
      .sec-3-1 .pf .pv { font-family: var(--mono); font-size: 13.5px; color: var(--ink-2); } /* the value in a PCB row uses a fixed-width code font in dark grey */
      .sec-3-1 .pf .pv.live { color: var(--cpu); font-style: italic; } /* a value that currently lives in the processor is shown in italic, in the processor colour */
      .sec-3-1 .pf.chg .pl::after { content: ' •'; color: var(--warn); } /* a row whose value changed in this frame gets an amber dot after its name */
      .sec-3-1 .reg { background: var(--panel); border: 2px solid var(--cpu); border-radius: 10px; padding: 4px 6px; } /* .reg is one processor register box in step 6, outlined in the processor colour */
      .sec-3-1 .reg .rv { font-family: var(--mono); font-weight: 800; font-size: 19px; color: var(--ink); } /* the value inside a register box: large, bold, fixed-width digits */
      .sec-3-1 .rs td { padding: 3px 8px; font-size: 14px; } /* .rs rows are the saved PCB contents in step 6: compact cells */
      .sec-3-1 .rs td:first-child { width: 34%; } /* the label column of the saved-contents table takes about a third of its width */
      .sec-3-1 .rs td.flash, .sec-3-1 .reg.flash { animation: flash 1s ease; } /* a table cell or register box whose value just changed flashes yellow for a second so the eye catches it */
      .sec-3-1 pre.code .addr { color: var(--muted); font-weight: 700; } /* the memory address at the start of each shown code line is grey and bold, set apart from the instruction */
      .sec-3-1 .qtext { font-size: 21px; font-weight: 700; line-height: 1.4; } /* .qtext is the question text in the step 7 lab: large and bold */
      .sec-3-1 .fbtn { height: 78px; border-radius: 12px; border: 2px solid var(--line-2); background: var(--panel); color: var(--ink); font-size: 16.5px; font-weight: 750; cursor: pointer; padding: 0 12px; } /* .fbtn is one PCB element answer button in the step 7 lab: a tall bordered button */
      .sec-3-1 .fbtn:hover:not(:disabled) { border-color: var(--os); color: var(--os); } /* hovering an answer button that can still be pressed outlines it in the OS colour */
      .sec-3-1 .fbtn:disabled { cursor: default; opacity: .5; } /* an answer button that cannot be pressed shows no pointing hand and is faded */
      .sec-3-1 .fbtn.right { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); opacity: 1; } /* the correct answer turns green and stays fully visible */
      .sec-3-1 .fbtn.wrong { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); opacity: .8; } /* a wrong answer that was tried turns red and slightly faded */
      .sec-3-1 .qd { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line-2); background: transparent; } /* .qd is one question progress dot in the lab: an empty circle */
      .sec-3-1 .qd.cur { border-color: var(--chc); } /* the dot for the current question has a chapter-coloured ring */
      .sec-3-1 .qd.ok { background: var(--ok); border-color: var(--ok); } /* a dot fills green when that question was answered right on the first try */
      .sec-3-1 .qd.late { background: var(--warn); border-color: var(--warn); } /* a dot fills amber when that question needed more than one try */
    `,  // end of the css text for this section

    steps: [  // steps: the list of screens in this section, shown one at a time as the student presses Next
      /* ---------------- 1. Big picture: hardware, applications and the OS in between ---------------- */
      {  // step 1 begins: why an OS stands between applications and hardware
        title: 'Many programs, one machine: why processes exist',  // step title shown in the header
        kind: 'story',  // kind "story": the header labels this step "Big Picture", an opening overview
        render(el, ctx) {  // render(el, ctx): runs each time this step is shown; el is the empty step area, ctx carries the guide's helpers
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const left = h('div', { class: 'stack', html: `${/* left column text, written as one block of HTML */''}
            <p class="lead m0">A computer is a set of <b>hardware resources</b>: a processor, main memory, I/O modules, timers, disk drives and more. People want <b>applications</b>: a browser, a music player, a spreadsheet.</p>${/* opening paragraph: a computer is hardware resources, and people want applications */''}
            <p class="m0">Writing every application straight onto bare hardware would be wasteful and risky, so the OS stands in between. It gives applications a <b>convenient, rich, safe and consistent</b> interface and a tidy <span class="t">abstraction</span> of each resource.</p>${/* paragraph: the OS stands between them, offering a convenient, safe interface and tidy abstractions */''}
            <p class="m0">Many applications share one machine, so the OS must also referee who uses what. It keeps that bookkeeping per <span class="t">process</span>: one record for every running instance of a program.</p>${/* paragraph: many applications share one machine, so the OS keeps one record per process */''}
            <div class="callout analogy m0" data-label="Analogy">A busy kitchen. Cooks (applications) never rewire the ovens (hardware); the head chef (the OS) assigns stations and keeps one <b>order ticket</b> per dish in progress.</div>${/* analogy box: a kitchen where the head chef keeps one order ticket per dish */''}
            <p class="small muted m0"><b>Coming up:</b> what a process is, the record the OS keeps for each one, and how that record lets the OS pause a process and resume it perfectly.</p>` });  // a preview line of what the rest of the section covers; end of the text

          // hardware resources: key, label, shape class, raw view, what the OS offers instead
          const HW = [  // HW: the five hardware resources as [key, label, drawing colour class, raw view, what the OS offers instead]
            ['cpu', 'Processor', 's-cpu', 'a circuit (or a few of them, called cores) that executes instructions one after another, from one program at a time.', 'the illusion that every program has its own processor, by switching between them very quickly.'],  // resource: the processor, and the OS's illusion that every program has its own
            ['mem', 'Main memory', 's-mem', 'billions of numbered byte cells that any program could read or overwrite.', 'a private, protected region for each process, so programs cannot trample one another.'],  // resource: main memory, and the OS's private region for each process
            ['io', 'I/O modules', 's-io', 'device controllers, each with its own status bits, data registers and command codes.', 'simple read and write calls that look the same for a keyboard, a network card or a screen.'],  // resource: I/O modules, and the OS's simple read and write calls
            ['timer', 'Timer', 's-io', 'a counter that ticks down and raises an <span class="t">interrupt</span> when it reaches zero.', 'sleep calls, alarms and fair turns on the processor, so no program can hog it.'],  // resource: the timer, and the sleep calls, alarms and fair turns it makes possible
            ['disk', 'Disk drive', 's-io', 'numbered blocks on platters or flash chips, read and written by number.', 'named files in folders, opened and read with one call.'],  // resource: the disk drive, and the named files the OS offers instead of numbered blocks
          ];  // closes HW
          const APPS = ['Browser', 'Music player', 'Spreadsheet'];  // APPS: the three sample applications drawn along the top
          const DEF = {  // DEF: the text shown in the details panel when each mode is first chosen
            without: '<b>Without an OS</b>, every application drives the hardware itself. Click any box to see what each one would have to handle alone, then switch to <b>With an OS</b>.',  // text for "Without an OS": every application drives the hardware itself
            with: '<b>With an OS</b>, applications talk only to the OS, and the OS manages every resource for them. Click the violet OS layer or any box.',  // text for "With an OS": applications talk only to the OS
          };  // closes DEF
          let mode = 'without';  // mode is which picture is shown: 'without' an OS at first, or 'with' one
          const svg = s('svg', { viewBox: '0 0 640 278', width: '100%', role: 'img', 'aria-label': 'Applications, the operating system and the hardware resources', style: 'flex:none' });  // the SVG drawing of applications, the OS layer and the hardware
          const info = h('div', { class: 'info grow', style: { minHeight: '104px' } });  // the details panel under the drawing, filled when something is clicked
          const say = (html) => { info.innerHTML = html; };  // say(html): puts new text into the details panel

          const hwX = (i) => 14 + i * 125;           // 5 boxes, 112 wide, 13 apart
          const appX = (i) => 30 + i * 210;          // 3 boxes, 160 wide
          function tag(y, text) {  // tag(y, text): builds a red warning banner across the middle of the drawing at height y
            return s('g', {}, s('rect', { x: 92, y, width: 456, height: 30, rx: 8, class: 's-bad', 'stroke-width': 1.5 }),  // the banner's red rectangle
              s('text', { x: 320, y: y + 20, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, style: 'fill:var(--bad)' }, text));  // the banner's text, centred
          }  // ends tag()
          function draw() {  // draw(): redraws the picture for the current mode; runs at the start and when the mode changes
            svg.replaceChildren();  // empties the drawing
            const wires = s('g');  // wires is a group for the connecting lines, drawn first so the boxes cover their ends
            if (mode === 'without') {  // without an OS:
              APPS.forEach((_, a) => HW.forEach((__, k) => wires.append(s('line', { x1: appX(a) + 80, y1: 54, x2: hwX(k) + 56, y2: 222, style: 'stroke:var(--bad);opacity:.45', 'stroke-width': 1.5 }))));  // a faint red line from every application to every hardware box, showing the tangle
            } else {  // with an OS:
              APPS.forEach((_, a) => wires.append(s('line', { x1: appX(a) + 80, y1: 54, x2: appX(a) + 80, y2: 94, class: 's-line', 'marker-end': 'url(#arr-os)' })));  // an arrow from each application down to the OS layer
              HW.forEach((_, k) => wires.append(s('line', { x1: hwX(k) + 56, y1: 174, x2: hwX(k) + 56, y2: 218, class: 's-line', 'marker-end': 'url(#arr-os)' })));  // an arrow from the OS layer down to each hardware box
            }  // ends the choice of wiring
            svg.append(wires);  // adds the wires to the drawing
            APPS.forEach((name, a) => {  // draws each application box
              const g = s('g', { class: 'hot', 'data-k': 'app' + a },  // a clickable group for this application
                s('rect', { x: appX(a), y: 6, width: 160, height: 48, rx: 12, class: 's-proc', 'stroke-width': 2 }),  // the application's box in the process colour
                s('text', { x: appX(a) + 80, y: 36, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, name));  // the application's name
              g.addEventListener('click', () => say(`<h4>Application: ${name}</h4><p>When you start it, the OS creates a <span class="t">process</span> to run it and keeps a record about that process. Every running application is at least one process.</p><p class="small muted">${mode === 'without' ? 'Here it must also carry its own code for every device it touches.' : 'It asks the OS for everything it needs: files, memory, processor time.'}</p>`));  // clicking it explains that the OS creates a process for every running application, with a note for the mode
              svg.append(g);  // adds the application box to the drawing
            });  // ends the application loop
            if (mode === 'without') {  // without an OS, the middle shows three red problem banners:
              svg.append(tag(76, '✗ every app carries its own disk, screen and timer code'),  // banner: every app carries its own device code
                tag(118, '✗ nothing stops one app overwriting another’s memory'),  // banner: nothing stops one app overwriting another's memory
                tag(160, '✗ two apps want the processor: who decides?'));  // banner: nobody decides who gets the processor
            } else {  // with an OS:
              const os = s('g', { class: 'hot', 'data-k': 'os' },  // a clickable group for the OS layer
                s('rect', { x: 14, y: 98, width: 612, height: 76, rx: 14, class: 's-os', 'stroke-width': 2.5 }),  // the wide OS band in violet
                s('text', { x: 320, y: 128, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800 }, 'Operating system'),  // its title, "Operating system"
                s('text', { x: 320, y: 154, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'one safe, consistent interface · referees every shared resource'));  // its subtitle: one safe, consistent interface that referees every shared resource
              os.addEventListener('click', () => say('<h4>What the OS interface gives applications</h4><p><b>Convenient:</b> one simple call replaces dozens of device commands. <b>Rich:</b> many services, from files to networking. <b>Safe:</b> one program cannot wreck another or the hardware. <b>Consistent:</b> the same calls work on different machines.</p>'));  // clicking it explains what the OS interface gives: convenient, rich, safe, consistent
              svg.append(os);  // adds the OS layer to the drawing
            }  // ends the choice of middle layer
            HW.forEach(([key, label, cls, raw, offer], k) => {  // draws each hardware box
              const g = s('g', { class: 'hot', 'data-k': key },  // a clickable group for this resource
                s('rect', { x: hwX(k), y: 222, width: 112, height: 50, rx: 12, class: cls, 'stroke-width': 2 }),  // the resource's box in its colour
                s('text', { x: hwX(k) + 56, y: 252, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, label));  // the resource's name
              g.addEventListener('click', () => say(mode === 'without'  // clicking it describes the raw device, and either the burden it puts on every app...
                ? `<h4>${label}, as raw hardware</h4><p>It is ${raw}</p><p class="small" style="color:var(--bad)"><b>Without an OS</b>, every application must speak this device’s language itself and must trust the others not to misuse it.</p>`  // ...when there is no OS...
                : `<h4>${label}</h4><p><b>Raw hardware:</b> ${raw}</p><p><b>What the OS offers instead:</b> ${offer}</p>`));  // ...or what the OS offers instead
              svg.append(g);  // adds the hardware box to the drawing
            });  // ends the hardware loop
          }  // ends draw()
          const seg = ctx.ui.seg([{ value: 'without', label: 'Without an OS' }, { value: 'with', label: 'With an OS' }], mode, (v) => { mode = v; draw(); say(DEF[mode]); });  // buttons to switch between "Without an OS" and "With an OS"; switching redraws and resets the details panel
          draw(); say(DEF[mode]);  // draws the first picture and shows its starting text
          const right = h('div', { class: 'card white stack', style: { gap: '8px' } },  // right column: a white card holding the heading, the mode buttons, the drawing and the details panel
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Who talks to the hardware?'), seg),  // heading row: "Who talks to the hardware?" with the mode buttons
            svg, info);  // the drawing and the details panel
          el.append(h('div', { class: 'split l fill' }, left, right));  // lays out the step with the text on the left and the card on the right
        },  // ends render() for step 1
      },  // ends step 1

      /* ---------------- 2. The three process-level duties (tabs; tab 1 = interleaving timeline) ---------------- */
      {  // step 2 begins: the three duties the OS owes its processes, shown as three tabs
        title: 'Three duties the OS owes its processes',  // step title shown in the header
        kind: 'explore',  // kind "explore": the header labels this as an exploration
        render(el, ctx) {  // render(el, ctx): builds the three tabs each time this step is shown
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          function interleave(panel) {  // interleave(panel): builds tab 1, the timeline of three processes run one at a time or interleaved
            let mode = 'rr', q = 2;  // mode starts as interleaved ('rr', round robin) and q is the time slice in units
            const svg = s('svg', { viewBox: '0 0 640 186', width: '100%', role: 'img', 'aria-label': 'Timeline of three processes and the processor' });  // the SVG timeline: one row per process, then a row for the processor
            const stat = (label) => {  // stat(label): builds a small card with a label and a big number; returns the card and the number element
              const v = h('div', { class: 'big', style: { fontSize: '26px' } });  // the big number inside the card
              return [h('div', { class: 'card tight center' }, h('div', { class: 'xs muted b' }, label), v), v];  // the card itself, with the label above the number
            };  // ends stat()
            const [c1, vUtil] = stat('Processor utilization'), [c2, vResp] = stat('C gets its answer at'), [c3, vTotal] = stat('Everything done at');  // three stat cards: processor utilization, when C gets its answer, and when everything is done
            const say = h('p', { class: 'small m0', style: { minHeight: '64px' } });  // a sentence under the cards that explains the current result
            const slider = ctx.ui.slider({ label: 'Time slice', min: 1, max: 6, value: q, format: (v) => v + (v === 1 ? ' unit' : ' units'), onInput: (v) => { q = v; draw(); } });  // slider for the time slice, 1 to 6 units; moving it redraws the timeline
            slider.style.flex = '1';  // lets the slider stretch to fill the rest of its row
            const seg = ctx.ui.seg([{ value: 'serial', label: 'One at a time' }, { value: 'rr', label: 'Interleaved' }], mode, (v) => { mode = v; draw(); });  // buttons to choose "One at a time" or "Interleaved"; choosing redraws the timeline
            const X = (t) => 92 + t * 35;          // 15 time units fill 525 px
            function draw() {  // draw(): reruns the schedule and redraws the timeline, stat cards and explanation
              const r = schedule(mode, q);  // r is the schedule result for the current mode and slice
              slider.style.opacity = mode === 'rr' ? 1 : 0.4;  // the slider is faded in one-at-a-time mode, where the slice does not matter...
              slider.input.disabled = mode !== 'rr';  // ...and disabled there too
              svg.replaceChildren();  // empties the drawing
              ['A', 'B', 'C'].forEach((id, row) => {  // draws one row for each process
                const y = 4 + row * 36;  // y is the top of this process's row
                svg.append(s('text', { x: 4, y: y + 20, 'font-size': 15, 'font-weight': 800 }, 'Process ' + id));  // the row label, "Process A" and so on
                for (const g of r.segs[id]) {  // draws each stretch of time for this process
                  const w = (g.b - g.a) * 35 - 2, n = g.b - g.a;  // w is the stretch's width in the drawing and n its length in time units
                  svg.append(s('rect', { x: X(g.a) + 1, y, width: w, height: 28, rx: 6, class: g.kind === 'cpu' ? 's-proc' : g.kind === 'io' ? 's-io' : 's-panel', 'stroke-width': g.kind === 'cpu' ? 2 : 1.2, 'stroke-dasharray': g.kind === 'wait' ? '4 3' : null }));  // the stretch's box: process colour when running, I/O colour when waiting for the disk, dashed grey when waiting its turn
                  if (n >= 2) svg.append(s('text', { x: X((g.a + g.b) / 2), y: y + 19, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': g.kind === 'wait' ? 400 : 700, class: g.kind === 'wait' ? 's-sub' : null }, g.kind === 'cpu' ? 'runs' : g.kind === 'io' ? (n >= 4 ? 'waits for disk' : 'disk') : (n >= 3 ? 'ready, waiting' : 'ready')));  // a label inside stretches at least 2 units long: "runs", "waits for disk" or "ready, waiting", shortened when space is tight
                }  // ends the stretch loop
                svg.append(s('text', { x: X(r.fin[id]) + 4, y: y + 20, 'font-size': 14, 'font-weight': 900, style: 'fill:var(--ok)' }, '✓'));  // a green tick where the process finishes
              });  // ends the process rows
              const yc = 116;  // yc is the top of the processor row
              svg.append(s('text', { x: 4, y: yc + 20, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'Processor'));  // the row label "Processor"
              r.cpu.forEach((id, t) => svg.append(  // one small box per time unit showing which process had the processor...
                s('rect', { x: X(t) + 1, y: yc, width: 33, height: 28, rx: 5, class: id ? 's-cpu' : 's-bad', 'stroke-width': 1.5 }),  // ...red when nobody did...
                s('text', { x: X(t) + 17.5, y: yc + 19, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: id ? '' : 'fill:var(--bad)' }, id || 'idle')));  // ...labelled with the process letter or "idle"
              for (let t = 0; t <= 15; t++) {  // tick marks and numbers along the time axis from 0 to 15
                svg.append(s('line', { x1: X(t), y1: 150, x2: X(t), y2: 156, class: 's-line', 'stroke-width': 1 }),  // a short tick line...
                  s('text', { x: X(t), y: 172, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(t)));  // ...and its time number
              }  // ends the tick loop
              svg.append(s('line', { x1: X(0), y1: 150, x2: X(15), y2: 150, class: 's-line', 'stroke-width': 1 }),  // the time axis line...
                s('text', { x: 4, y: 172, 'font-size': 13, class: 's-sub' }, 'time →'));  // ...and its label "time"
              const util = ctx.util.fmt((100 * r.busy) / r.total, 1), idle = r.total - r.busy;  // util is the busy share as a percentage, and idle is how many units the processor sat idle
              vUtil.textContent = util + '%';  // shows the utilization...
              vUtil.style.color = idle ? 'var(--warn)' : 'var(--ok)';  // ...in amber if the processor ever idled, green if it never did
              vResp.textContent = 't = ' + r.fin.C;  // shows the time at which C finished
              vTotal.textContent = 't = ' + r.total;  // shows the time at which everything finished
              if (mode === 'serial') {  // explanation for one-at-a-time mode:
                say.innerHTML = `<b>One at a time.</b> Each process runs to the end before the next may start. While B waits for the disk nobody else may run, so the processor idles 4 units, and C, a one-unit job, waits until time 15. Utilization = 11 busy ÷ 15 total = <b>${util}%</b>.`;  // nobody may run while B waits for the disk, so the processor idles and C waits until time 15
              } else {  // explanation for interleaved mode:
                say.innerHTML = `<b>Interleaved, slice = ${q}.</b> ` + (idle === 0  // starts with the slice size, then...
                  ? 'Whenever B stops to wait for the disk, another process takes the processor, so it never idles'  // ...if the processor never idled: someone else runs whenever B waits for the disk...
                  : `With long slices, at one point nothing is ready while B waits for the disk, so the processor idles ${idle} unit${idle > 1 ? 's' : ''}`) +  // ...otherwise: with long slices, at one point nothing is ready and the processor idles
                  `: utilization = 11 ÷ ${r.total} = <b>${util}%</b>. C gets its answer at time ${r.fin.C}` +  // then the utilization and when C got its answer...
                  (q === 1 ? '. Tiny slices answer fastest, but each real switch costs a little processor time (not shown here), so real systems choose a moderate slice.' : q <= 3 ? ', far sooner than the 15 it waits when jobs run one at a time.' : '. Shorter slices would answer C sooner.');  // ...plus a remark on the slice: tiny slices cost switching time, small ones beat 15, long ones delay C
              }  // ends the explanation choice
            }  // ends draw()
            const text = h('div', { class: 'stack', style: { gap: '9px' }, html: `${/* the explanation text on the left, written as one block of HTML */''}
              <h3 class="m0">Duty 1 · Interleave processes</h3>${/* heading for duty 1: interleave processes */''}
              <p class="m0">The OS must <span class="t" data-t="Interleaving">interleave</span> the execution of several processes: run one for a little while, then another, so that all of them make progress.</p>${/* paragraph: what interleaving means, so all processes make progress */''}
              <p class="m0">The goal is to keep <span class="t">processor utilization</span> as high as possible (the processor is rarely idle) while giving a reasonable <span class="t">response time</span> (nobody waits long for an answer). The two can clash: switching more often answers people sooner, but every switch costs the processor a little work.</p>${/* paragraph: high utilization versus good response time, and how switching trades one for the other */''}
              <div class="card tight small"><b>A</b> · a long calculation: 6 units of work<br><b>B</b> · 2 units, then waits 4 units for the disk, then 2 more<br><b>C</b> · echo one keystroke: 1 unit of work<br><span class="muted">Utilization = busy time ÷ total time</span></div>${/* card: the three sample jobs A, B and C, and the utilization formula */''}
              <div class="callout tip m0" data-label="Try it">Compare the two modes, then drag the <span class="t">time slice</span>. Keep an eye on how long C waits.</div>` });  // tip box: compare the modes, drag the slice, and watch how long C waits; end of the text
            const legend = h('div', { class: 'row', style: { gap: '6px' } },  // the colour key for the timeline
              h('span', { class: 'chip proc' }, 'runs on the processor'), h('span', { class: 'chip' }, 'ready, waiting its turn'),  // key chips: running on the processor, and ready but waiting its turn
              h('span', { class: 'chip io' }, 'waiting for the disk'), h('span', { class: 'chip bad' }, 'processor idle'));  // key chips: waiting for the disk, and processor idle
            panel.append(h('div', { class: 'split l fill' }, text,  // lays out the tab: text on the left and the timeline controls on the right
              h('div', { class: 'stack', style: { gap: '10px' } },  // the right column stacks the controls, drawing, key, stat cards and explanation
                // on a phone the toggle and slider cannot share one line (they would push 5px past the edge), so let them wrap
                h('div', { class: ctx.narrow ? 'row' : 'row nw' }, seg, slider),  // the mode buttons and the slice slider share a row (allowed to wrap on a phone-width screen)
                h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),  // a white card holding the timeline
                legend, h('div', { class: 'grid-3' }, c1, c2, c3), say)));  // the key, the three stat cards in a row, and the explanation
            draw();  // draws the timeline for the first time
          }  // ends interleave()
          el.append(ctx.ui.tabs([  // the step shows three tabs; each tab's render function builds its panel when the tab is opened
            { label: '1 · Interleave', render: interleave },  // tab 1: interleave processes
            { label: '2 · Allocate', render: dutyAllocate },  // tab 2: allocate resources, built by dutyAllocate() near the top of the file
            { label: '3 · Communicate and create', render: dutyIPC },  // tab 3: communicate and create, built by dutyIPC() near the top of the file
          ]));  // closes the tab list and adds the tabs to the step
        },  // ends render() for step 2
      },  // ends step 2

      /* ---------------- 3. Four definitions of a process (lenses light up the diagram) ---------------- */
      {  // step 3 begins: four definitions of a process, each lighting up part of a diagram
        title: 'Four ways to say what a process is',  // step title shown in the header
        kind: 'learn',  // kind "learn": the header labels this as a Learn step
        render(el, ctx) {  // render(el, ctx): builds the definition buttons and the diagram each time this step is shown
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const LENS = [  // LENS: the four definitions; on lists the diagram parts to light up and say is the explanation
            { def: 'A program in execution.', on: ['file', 'load21', 'p21', 'assign', 'cpu'],  // definition 1: a program in execution; lights the file, the load arrow, process 21 and the processor
              say: '<b>The shortest definition.</b> The program is the recipe on the shelf; the process is the cooking happening right now. Execution is what turns one into the other.' },  // explanation for definition 1: the program is the recipe, the process is the cooking
            { def: 'An instance of a program running on a computer.', on: ['file', 'load21', 'load22', 'p21', 'p22'],  // definition 2: an instance of a running program; lights the file and both processes made from it
              say: '<b>One program, many instances.</b> Open the same editor twice and the OS runs two separate processes from one file, each with its own data: cat.jpg in one, dog.jpg in the other.' },  // explanation for definition 2: one editor file opened twice gives two processes with their own data
            { def: 'The entity that can be assigned to and executed on a processor.', on: ['p21', 'p22', 'assign', 'cpu'],  // definition 3: something the OS can assign to a processor; lights both processes and the processor
              say: '<b>The OS’s point of view.</b> A process is the thing the OS picks and hands the processor to. Process 21 has it now; process 22 is Ready, so it is eligible too and waits its turn.' },  // explanation for definition 3: process 21 has the processor and process 22 is ready and waiting
            { def: 'A unit of activity characterized by the execution of a sequence of instructions, a current state and an associated set of system resources.', on: ['trace', 'state21', 'res', 'p21'],  // definition 4: a unit of activity with a trace, a state and resources; lights those parts
              say: '<b>Three things describe the activity:</b> the instructions it executes, in order (its <b>trace</b>: the list of instruction addresses it has run, bottom), where it stands right now (its state, “Running”), and what it holds (memory, an open file, a window).' },  // explanation for definition 4: the trace of instructions, the current state, and the resources held
          ];  // closes LENS
          const svg = s('svg', { viewBox: '0 0 640 324', width: '100%', role: 'img', 'aria-label': 'A program file on disk, two processes in memory, the processor and resources' });  // the SVG diagram: the program file on disk, two processes in memory, the processor, resources and a trace
          const part = (id, ...kids) => s('g', { 'data-part': id, class: 'part' }, ...kids);  // part(id, ...kids): groups shapes into a named piece of the diagram that the definitions can light up or fade
          const T = (x, y, str, o = {}) => s('text', Object.assign({ x, y, 'font-size': 14 }, o), str);  // T(x, y, str, o): shorthand for a 14px text label, with any extra settings in o
          const img = (id, y, pid, dataTxt, st) => part(id,  // img(id, y, pid, dataTxt, st): builds one process box in memory at height y
            s('rect', { x: 214, y, width: 236, height: 98, rx: 12, class: 's-proc', 'stroke-width': 2 }),  // the process box in the process colour
            T(226, y + 22, `Process ${pid} · photo-edit`, { 'font-size': 15, 'font-weight': 800 }),  // its title: the process number and the program it runs
            s('rect', { x: 226, y: y + 34, width: 96, height: 26, rx: 6, class: 's-panel' }), T(274, y + 52, 'code', { 'text-anchor': 'middle' }),  // a small box for its code
            s('rect', { x: 330, y: y + 34, width: 108, height: 26, rx: 6, class: 's-mem' }), T(384, y + 52, 'data: ' + dataTxt, { 'text-anchor': 'middle' }),  // a small box for its data, naming the photo it is editing
            part('state' + pid, T(226, y + 84, 'state: ', { class: 's-sub' }), T(270, y + 84, st, { 'font-weight': 800, style: 'fill:var(--proc)' })));  // its state line, itself a separate piece so definition 4 can light it alone
          svg.append(  // adds the fixed pieces of the diagram:
            s('rect', { x: 8, y: 34, width: 160, height: 136, rx: 14, class: 's-io', 'stroke-width': 2 }), T(88, 56, 'Disk', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }),  // the disk, with its label
            part('file', s('rect', { x: 22, y: 72, width: 132, height: 70, rx: 8, class: 's-panel', 'stroke-width': 2 }),  // the program file on the disk, a piece named 'file'...
              T(88, 100, 'photo-edit', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }), T(88, 122, '(program file)', { 'text-anchor': 'middle', class: 's-sub' })),  // ...labelled "photo-edit (program file)"
            s('rect', { x: 200, y: 6, width: 264, height: 250, rx: 14, class: 's-mem', 'stroke-width': 2, style: 'fill:none' }), T(332, 26, 'Main memory', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, style: 'fill:var(--mem)' }),  // an outline for main memory, with its label
            part('load21', s('path', { d: 'M154 96 C 180 90, 190 84, 210 82', fill: 'none', class: 's-line', 'marker-end': 'url(#arr)' })),  // the curved arrow loading the program into process 21
            part('load22', s('path', { d: 'M154 118 C 180 140, 190 176, 210 184', fill: 'none', class: 's-line', 'marker-end': 'url(#arr)' })),  // the curved arrow loading the same program into process 22
            img('p21', 38, 21, 'cat.jpg', 'Running'), img('p22', 146, 22, 'dog.jpg', 'Ready'),  // the two processes: 21 editing cat.jpg and Running, 22 editing dog.jpg and Ready
            part('assign', s('line', { x1: 452, y1: 86, x2: 484, y2: 86, style: 'stroke:var(--cpu)', 'stroke-width': 3, 'marker-end': 'url(#arr-cpu)' })),  // the arrow showing process 21 assigned to the processor
            part('cpu', s('rect', { x: 488, y: 34, width: 146, height: 104, rx: 12, class: 's-cpu', 'stroke-width': 2 }),  // the processor box...
              T(561, 56, 'Processor', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }), T(561, 82, 'executing', { 'text-anchor': 'middle', class: 's-sub' }),  // ...with its title and "executing"...
              T(561, 104, 'process 21', { 'text-anchor': 'middle', 'font-weight': 800, style: 'fill:var(--proc)' }), T(561, 126, 'next: 0x40AC', { 'text-anchor': 'middle', class: 's-monot', 'font-size': 13 })),  // ...naming process 21 and the address of its next instruction
            part('res', s('rect', { x: 488, y: 150, width: 146, height: 106, rx: 12, class: 's-io', 'stroke-width': 2 }),  // a box listing the resources process 21 holds...
              T(561, 172, 'Held by 21', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }),  // ...titled "Held by 21"...
              T(561, 196, 'its memory', { 'text-anchor': 'middle' }), T(561, 218, 'open file cat.jpg', { 'text-anchor': 'middle' }), T(561, 240, 'a window', { 'text-anchor': 'middle' })),  // ...its memory, an open file and a window
            part('trace', s('rect', { x: 8, y: 270, width: 626, height: 48, rx: 12, class: 's-panel', 'stroke-width': 2 }),  // a strip along the bottom showing process 21's trace...
              T(22, 300, 'Trace of process 21:', { 'font-weight': 800 }),  // ...with its label...
              T(176, 300, '0x40A0 → 0x40A4 → 0x40A8 → (next) 0x40AC …', { class: 's-monot', 'font-size': 14.5 })));  // ...and the addresses it has run so far, in order
          const info = h('div', { class: 'info', style: { minHeight: '80px' } });  // details panel under the diagram, filled by pick()
          const btns = LENS.map((L, i) => h('button', { type: 'button', class: 'lens', onclick: () => pick(i) }, h('b', { class: 'num' }, String(i + 1)), h('span', {}, L.def)));  // one button per definition: a number badge and the definition text; clicking it lights up the diagram
          function pick(i) {  // pick(i): lights up the diagram for definition i, or everything when i is null
            btns.forEach((b, j) => b.classList.toggle('on', i === j));  // marks only the chosen button as on
            const on = i == null ? null : new Set(LENS[i].on);  // on is the set of piece names to light up, or null for all
            svg.querySelectorAll('.part').forEach((g) => {  // goes through every piece of the diagram
              const lit = !on || on.has(g.dataset.part) || [...on].some((p) => g.closest(`[data-part="${p}"]`));  // a piece stays bright if nothing is chosen, if it is named in the set, or if it sits inside a named piece
              g.style.opacity = lit ? 1 : 0.22;  // other pieces fade to a faint grey (the part CSS rule makes this smooth)
            });  // ends the loop over pieces
            info.innerHTML = i == null ? '<b>Click a definition</b> on the left to light up the part of the picture it talks about. All four describe the same thing, a <span class="t">process</span>, from different angles.' : LENS[i].say;  // the details panel shows the chosen definition's explanation, or an instruction when none is chosen
          }  // ends pick()
          pick(null);  // starts with every piece lit and the instruction showing
          const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the introduction, the four definition buttons and a warning
            h('p', { class: 'm0', html: 'Operating systems people use four standard definitions of a <span class="t">process</span>. Each is correct; each looks from a different angle.' }),  // paragraph: four standard definitions, each correct from a different angle
            ...btns,  // the four definition buttons
            h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: '<b>A program is not a process.</b> A <span class="t">program</span> is passive: instructions sitting in a file. A process is that program in action, with its own data, state and resources. One program can run as several processes at once, and the OS schedules, protects and bills each of them separately.' }));  // common mistake box: a program is passive, a process is that program in action, and one program can run as several
          const analogy = h('div', { class: 'callout analogy small m0', 'data-label': 'In the kitchen', html: 'The lasagna recipe card is the program. Two lasagnas being cooked from it tonight are two processes, each with its own pan of ingredients and its own order ticket.' });  // analogy box: a recipe card is the program; two lasagnas cooking from it are two processes
          el.append(h('div', { class: 'split l fill' }, left, h('div', { class: 'card white stack', style: { gap: '10px' } }, svg, info, analogy)));  // lays out the step: definitions on the left, and a card with the diagram, details and analogy on the right
        },  // ends render() for step 3
      },  // ends step 3

      /* ---------------- 4. Lab: one program, two processes (code shared; data, PCB, PC separate) ---------------- */
      {  // step 4 begins: a lab showing what two processes of one program share and what they keep separate
        title: 'One program, two processes: what is shared?',  // step title shown in the header
        kind: 'lab',  // kind "lab": the header labels this as a hands-on lab
        render(el, ctx) {  // render(el, ctx): builds the memory-map lab each time this step is shown
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const WORDS = { 101: ['Buy', 'milk', 'and', 'eggs', 'and', 'bread'], 102: ['Call', 'Sam', 'about', 'the', 'trip'] };  // WORDS: the words each process's note will contain, typed one at a time; the key is the process ID
          const DATA_AT = { 101: '0x7000', 102: '0x9000' };  // DATA_AT: where each process's private data starts in memory
          const hex = (i) => '0x' + (0x2000 + 4 * i).toString(16).toUpperCase();  // hex(i): the address of instruction i of the shared code, starting at 0x2000 and 4 bytes apart
          let st, lit = null;  // st holds the lab's state (running processes, words typed, program counters); lit is the part highlighted from the table
          const svg = s('svg', { viewBox: '0 0 480 470', width: '100%', role: 'img', 'aria-label': 'Memory map: shared code, separate data and PCBs' });  // the SVG memory map
          const say = h('div', { class: 'info', style: { minHeight: '70px' } });  // the explanation panel under the map
          const T = (x, y, str, o = {}) => s('text', Object.assign({ x, y, 'font-size': 14, 'text-anchor': 'middle' }, o), str);  // T(x, y, str, o): shorthand for a centred 14px text label
          const reset = () => { st = { procs: [], n: { 101: 2, 102: 2 }, pc: { 101: 0, 102: 0 }, running: null }; say.innerHTML = 'Nothing is running yet. The program <b>notes</b> is just a file on the disk. Press <b>Launch notes</b>.'; paint(); };  // reset(): clears everything so nothing is running, each note shows its first two words, both PCs at the start; then redraws
          const has = (pid) => st.procs.includes(pid);  // has(pid): true if that process has been launched
          const text = (pid) => WORDS[pid].slice(0, st.n[pid]).join(' ');  // text(pid): the words typed so far in that process's note
          const stateOf = (pid) => (st.running === pid ? 'Running' : 'Ready');  // stateOf(pid): Running if the process has the processor, otherwise Ready
          function wrap(str, max) { const out = ['']; for (const w of str.split(' ')) { const L = out[out.length - 1]; if ((L + ' ' + w).trim().length > max) out.push(w); else out[out.length - 1] = (L + ' ' + w).trim(); } return out; }  // wrap(str, max): breaks text into lines of at most max characters so it fits inside a memory box
          function draw() {  // draw(): redraws the memory map; runs after every action
            svg.replaceChildren();  // empties the drawing
            const g = (id, ...k) => s('g', { class: lit === id ? 'lit' : '' }, ...k);  // g(id, ...k): groups shapes under a name, and marks the group lit when that part is chosen in the table
            const col = [14, 316];  // col holds the left edges of the two process columns
            svg.append(g('file', s('rect', { x: 150, y: 4, width: 180, height: 52, rx: 10, class: 's-io', 'stroke-width': 2 }),  // the program file on the disk, at the top...
              T(240, 26, 'notes', { 'font-weight': 800, 'font-size': 15 }), T(240, 46, 'program file on disk', { class: 's-sub', 'font-size': 13 })));  // ...labelled "notes, program file on disk"
            svg.append(s('rect', { x: 4, y: 72, width: 472, height: 394, rx: 14, class: 's-mem', style: 'fill:none', 'stroke-width': 2 }),  // the outline of main memory...
              T(14, 92, 'Main memory', { 'text-anchor': 'start', 'font-weight': 800, style: 'fill:var(--mem)' }));  // ...with its label
            const loaded = st.procs.length > 0;  // loaded is true once any process has been launched
            if (loaded) svg.append(s('line', { x1: 240, y1: 56, x2: 240, y2: 100, style: 'stroke:var(--io)', 'stroke-width': 2.5, 'stroke-dasharray': '6 4', 'marker-end': 'url(#arr-io)' }),  // once loaded, a dashed arrow from the file into memory...
              T(248, 90, 'loaded once', { 'text-anchor': 'start', 'font-size': 13, 'font-weight': 700, class: 'halo', style: 'fill:var(--io)' }));  // ...labelled "loaded once"
            // shared code column
            svg.append(g('code', s('rect', { x: 178, y: 104, width: 124, height: 352, rx: 10, class: loaded ? 's-panel' : 's-muted', 'stroke-width': 2, 'stroke-dasharray': loaded ? null : '6 5' }),  // the shared code column in the middle: solid once loaded, a dashed free area before that
              ...(loaded ? [T(240, 128, 'notes code', { 'font-weight': 800, 'font-size': 15 }), T(240, 148, 'one shared copy', { class: 's-sub', 'font-size': 13 }),  // once loaded, its title and "one shared copy"...
                ...Array.from({ length: 8 }, (_, i) => T(240, 190 + i * 34, hex(i), { class: 's-monot', 'font-size': 14 }))] : [T(240, 284, 'free', { class: 's-sub' })])));  // ...and the addresses of its eight instructions; before loading it just says "free"
            [101, 102].forEach((pid, k) => {  // draws each process's column, left for 101 and right for 102
              const x = col[k], cx = x + 75, on = has(pid);  // x is the column's left edge, cx its centre, and on whether this process exists
              if (!on) {  // a process that has not been launched yet:
                svg.append(s('rect', { x, y: 104, width: 150, height: 120, rx: 10, class: 's-muted', 'stroke-dasharray': '6 5' }), T(cx, 168, 'free', { class: 's-sub' }),  // dashed "free" areas where its PCB...
                  s('rect', { x, y: 282, width: 150, height: 174, rx: 10, class: 's-muted', 'stroke-dasharray': '6 5' }), T(cx, 372, 'free', { class: 's-sub' }));  // ...and its data would go
                return;  // nothing more to draw for it
              }  // ends the not-launched case
              svg.append(g('pcb', s('rect', { x, y: 104, width: 150, height: 120, rx: 10, class: 's-os', 'stroke-width': 2 }),  // the process's PCB box in the OS colour
                T(cx, 129, 'PCB ' + pid, { 'font-weight': 800, 'font-size': 15.5 }),  // titled with its process ID
                g('state', T(cx, 154, 'state: ' + stateOf(pid), { 'font-size': 14 })),  // its state line, a part the table can highlight
                g('pc', st.running === pid  // its program counter line: while running...
                  ? T(cx, 178, 'PC: live in processor', { 'font-size': 13, style: 'fill:var(--cpu)', 'font-style': 'italic' })  // ...it says the PC lives in the processor...
                  : T(cx, 178, 'PC: ' + hex(st.pc[pid]), { 'font-size': 14, class: 's-monot' })),  // ...otherwise it shows the saved address
                T(cx, 202, 'data at ' + DATA_AT[pid], { 'font-size': 14, class: 's-sub' })));  // where the process's data is in memory
              svg.append(g('data', s('rect', { x, y: 282, width: 150, height: 174, rx: 10, class: 's-mem', 'stroke-width': 2 }),  // the process's private data box in the memory colour
                T(cx, 307, 'data of ' + pid, { 'font-weight': 800, 'font-size': 15 }),  // titled "data of" plus its process ID
                ...wrap('“' + text(pid) + '”', 16).slice(0, 3).map((line, i) => T(cx, 340 + i * 24, line, { 'font-size': 14.5 })),  // the note text typed so far, wrapped onto at most three lines
                T(cx, 440, 'words: ' + st.n[pid], { 'font-size': 13.5, class: 's-sub' })));  // the number of words typed so far, at the bottom of the data box
              // memory pointers: PCB → its data (down) and PCB → the shared code (sideways)
              const toCode = k === 0 ? [164, 150, 176, 150] : [316, 150, 304, 150];  // the sideways pointer from this PCB to the shared code: rightward for the left process, leftward for the right one
              svg.append(s('line', { x1: cx, y1: 224, x2: cx, y2: 278, style: 'stroke:var(--proc)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-proc)' }),  // an arrow from the PCB down to its own data (a memory pointer)...
                s('line', { x1: toCode[0], y1: toCode[1], x2: toCode[2], y2: toCode[3], style: 'stroke:var(--proc)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-proc)' }),  // ...an arrow from the PCB to the shared code (another memory pointer)...
                T(cx + (k ? -8 : 8), 256, 'pointer', { 'text-anchor': k ? 'end' : 'start', 'font-size': 13, style: 'fill:var(--proc)', 'font-weight': 700 }));  // ...and the label "pointer" beside the downward arrow
              // this process's program counter, marked beside the shared code
              const y = 185 + st.pc[pid] * 34;  // y is the height of the instruction this process will run next
              svg.append(g('pc', s('path', { d: k === 0 ? `M184 ${y - 6} L194 ${y} L184 ${y + 6} Z` : `M296 ${y - 6} L286 ${y} L296 ${y + 6} Z`, style: 'fill:var(--proc)' })));  // a small triangle beside the shared code pointing at that instruction: right-pointing for 101, left-pointing for 102
            });  // ends the loop over the two processes
          }  // ends draw()
          // comparison table, with one column of actions per process
          const tbody = h('tbody');  // the body of the comparison table; paintTable() fills it
          const ROWS = [  // ROWS: the table's rows as [part id, label, function giving a process's value, shared or separate]
            ['file', 'Program it runs', (p) => 'notes', 'same program'],  // row: the program each process runs (the same one)
            ['code', 'Code in memory', (p) => '0x2000–0x2FFF', 'shared, one copy'],  // row: the code in memory (one shared copy)
            ['data', 'Its data', (p) => '“' + text(p) + '”', 'separate'],  // row: each process's data (separate)
            ['pcb', 'Its PCB', (p) => 'PCB ' + p, 'separate'],  // row: each process's PCB (separate)
            ['pc', 'Program counter', (p) => hex(st.pc[p]), 'separate'],  // row: each process's program counter (separate)
            ['state', 'State', (p) => stateOf(p), 'separate'],  // row: each process's state (separate)
          ];  // closes ROWS
          const act = {};  // act holds each process's Type and Step buttons, by process ID
          [101, 102].forEach((pid) => {  // builds the two buttons for each process:
            act[pid] = [h('button', { class: 'btn sm', type: 'button', title: 'Type a word into this process’s note', onclick: () => type(pid) }, 'Type'),  // Type stores one more word in that process's note
              h('button', { class: 'btn sm', type: 'button', title: 'Run one instruction of this process', onclick: () => run(pid) }, 'Step')];  // Step runs one instruction of that process
          });  // ends the button loop
          const launchBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => launch() }, 'Launch notes');  // the Launch button that starts the notes program
          function paintTable() {  // paintTable(): refills the comparison table and updates the buttons; runs after every action
            tbody.replaceChildren(...ROWS.map(([id, label, val, same]) => {  // builds one table row per ROWS entry
              const tr = h('tr', { class: 'rowbtn' + (lit === id ? ' on' : ''), onclick: () => { lit = lit === id ? null : id; paint(); } },  // clicking a row highlights (or un-highlights) that part in the memory map
                h('td', { class: 'b' }, label),  // the row's label cell
                ...[101, 102].map((p) => h('td', { class: id === 'pc' ? 'mono' : '' }, has(p) ? val(p) : '—')),  // one value cell per process (a dash if it is not running); program counters use a fixed-width font
                h('td', {}, st.procs.length === 2 ? h('span', { class: 'chip ' + (same === 'separate' ? 'proc' : 'ok') }, same) : '—'));  // once both processes run, the last cell says "shared" in green or "separate" in the process colour
              return tr;  // returns the row
            }), h('tr', {}, h('td', { class: 'b' }, 'Try it'), ...[101, 102].map((p) => h('td', {}, h('div', { class: 'row', style: { gap: '4px', flexWrap: 'nowrap' } }, ...act[p]))), h('td')));  // a final "Try it" row holding each process's Type and Step buttons
            [101, 102].forEach((p) => act[p].forEach((b) => (b.disabled = !has(p))));  // a process's buttons are disabled until it has been launched
            launchBtn.disabled = st.procs.length >= 2;  // Launch is disabled once two copies are running
            launchBtn.textContent = st.procs.length === 0 ? 'Launch notes' : st.procs.length === 1 ? 'Launch notes again' : 'Two copies running';  // the Launch button's label changes with how many copies are running
          }  // ends paintTable()
          function paint() { draw(); paintTable(); }  // paint(): redraws the memory map and the table together
          function launch() {  // launch(): starts one more copy of the notes program; runs when Launch is pressed
            if (st.procs.length >= 2) return;  // no more than two copies in this demo
            const pid = st.procs.length ? 102 : 101;  // the first copy gets ID 101 and the second 102
            st.procs.push(pid);  // adds it to the list of running processes
            say.innerHTML = pid === 101  // explains what the OS did:
              ? 'The OS <b>loaded the code</b> into memory, gave process 101 its <b>own data area</b>, and built <b>PCB 101</b> to keep track of it. Now launch the same program again.'  // first launch: the code was loaded, and process 101 got its own data area and PCB
              : 'The code is <b>already in memory</b>, so the OS does not load a second copy: PCB 102’s memory pointer aims at the same code. Only a new data area and a new PCB were created.';  // second launch: the code was already in memory, so only a new data area and PCB were made
            paint();  // redraws
          }  // ends launch()
          function type(pid) {  // type(pid): has a process store one more word in its note; runs when that process's Type is pressed
            if (st.n[pid] >= WORDS[pid].length) { say.innerHTML = `Process ${pid}’s note is full for this demo. Try the other process, or run an instruction.`; return; }  // once the note holds every word for this demo, says so and stops
            // storing a keystroke means this process runs one instruction of the shared code, which writes into ITS data
            st.n[pid]++;  // one more word is in this process's note
            st.pc[pid] = (st.pc[pid] + 1) % 8;  // its program counter moves to the next of the eight instructions, wrapping back to the first
            st.running = pid;  // this process is now the one on the processor
            const o = pid === 101 ? 102 : 101;  // o is the other process
            say.innerHTML = `Process ${pid} ran the shared code that stores a keystroke (its PC moved to ${hex(st.pc[pid])}), and only <b>its own data</b> changed.` + (has(o) ? ` Process ${o} still holds “${text(o)}”: same code, separate data.` : ' The code itself did not change: code is only read.');  // explains that only this process's data changed, and the other still holds its own text
            paint();  // redraws
          }  // ends type()
          function run(pid) {  // run(pid): has a process execute one instruction; runs when that process's Step is pressed
            const was = hex(st.pc[pid]);  // was is the address of the instruction being executed
            st.pc[pid] = (st.pc[pid] + 1) % 8;  // the program counter moves on, wrapping after the eighth instruction
            st.running = pid;  // this process is now the one on the processor
            const o = pid === 101 ? 102 : 101;  // o is the other process
            say.innerHTML = `Process ${pid} executed the instruction at ${was}, so its program counter moved to <b>${hex(st.pc[pid])}</b>` + (st.pc[pid] === 0 ? ' (the editor loops back to the top)' : '') + '.' +  // explains that the PC moved on (noting the loop back to the top when it wraps)...
              (!has(o) ? '' : st.pc[o] === st.pc[pid] ? ` Process ${o}’s counter did not move; right now both happen to point at the same instruction, but each process keeps its own counter.` : ` Process ${o}’s counter did not move: two processes can be at different places in the same code.`);  // ...and that the other process's counter did not move, even if both happen to point at the same instruction
            paint();  // redraws
          }  // ends run()
          reset();  // sets up the empty starting state and draws it
          const right = h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the explanation, the comparison table, the result message and the equation
            h('p', { class: 'm0', html: 'While a program runs, two <b>essential elements</b> exist: its <b>program code</b> (which may be <span class="t" data-t="Shared code">shared</span>) and the <b>set of data</b> that code works on. Launch one program twice and see which one gets copied. <b>Type</b> makes a process store one more word in its note; <b>Step</b> runs one of its instructions. Click a row to find it in the picture.' }),  // paragraph: a running program's two essential elements are its code and its data; what Type and Step do
            h('table', { class: 'tbl compact cmp' }, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Process 101'), h('th', {}, 'Process 102'), h('th', {}, 'Shared?'))), tbody),  // the comparison table with headings for each process and a "Shared?" column
            say,  // the result message after each action
            h('div', { class: 'eq' }, h('span', { class: 'box' }, 'program code'), '+', h('span', { class: 'box mem' }, 'data'), '+', h('span', { class: 'box os' }, 'PCB'), '=', h('span', { class: 'box proc' }, 'a process')));  // the equation: program code + data + PCB = a process
          el.append(h('div', { class: 'split l fill' }, h('div', { class: 'card white stack', style: { padding: '10px 12px', gap: '6px' } },  // lays out the lab: the memory map card on the left...
            h('div', { class: 'row' }, launchBtn, h('button', { class: 'btn ghost', type: 'button', onclick: () => { lit = null; reset(); } }, 'Reset')), svg,  // ...with the Launch and Reset buttons above the map...
            h('p', { class: 'xs muted m0 center' }, '▶ marks the next instruction of 101, ◀ that of 102. While a process runs, its PC lives in the processor. Teal arrows are the memory pointers stored in each PCB.')), right));  // ...and a key under it for the triangles and arrows; the right column goes beside it
        },  // ends render() for step 4
      },  // ends step 4

      /* ---------------- 5. The PCB inspector: eight elements, live values ---------------- */
      {  // step 5 begins: an inspector for the eight elements of the process control block
        title: 'Inside the process control block',  // step title shown in the header
        kind: 'explore',  // kind "explore": the header labels this as an exploration
        core: true,  // core: true puts this step on the guide's shorter core route through the chapter
        render(el, ctx) {  // render(el, ctx): builds the PCB inspector each time this step is shown
          const { h } = ctx;  // this step builds only ordinary page elements, so it needs just h
          let sel = 'pc', frame = 0;  // sel is the PCB element whose explanation is open (the program counter first), frame is the moment in process 42's life
          const rows = {};  // rows holds each PCB row and its value element, by element key
          const table = h('div', { class: 'pcb' + (ctx.narrow ? ' narrow' : '') });  // the PCB table, with a single-column row layout on phone-width screens
          FIELDS.forEach(([key, label]) => {  // builds one clickable row per PCB element
            const val = h('span', { class: 'pv' });  // the value part of the row, filled for the current frame
            const row = h('div', { class: 'pf', role: 'button', tabindex: 0, 'data-k': key, onclick: () => select(key), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(key); } } },  // the row itself, opened by click or by Enter or Space
              h('span', { class: 'pl' }, label), val);  // the element's name beside its value
            rows[key] = { row, val };  // remembers the row and its value element
            table.append(row);  // adds the row to the table
          });  // ends the row loop
          const detail = h('div', { class: 'info', style: { minHeight: '196px' } });  // the details panel that explains the selected element
          const cpuBox = h('div', { class: 'card cpu tight' });  // a card showing what is in the processor at this moment
          function select(key) {  // select(key): opens the explanation of one PCB element; runs when a row is clicked
            sel = key;  // remembers which element is open
            const [, label, holds, why, ticket] = FIELDS.find((f) => f[0] === key);  // looks up the element's name, what it holds, why the OS needs it, and its kitchen-ticket version
            Object.entries(rows).forEach(([k, r]) => r.row.classList.toggle('sel', k === key));  // highlights only the chosen row
            detail.innerHTML = `<h4>${label}</h4><p><b>Holds:</b> ${holds}</p><p><b>Why the OS needs it:</b> ${why}</p><p class="small" style="color:var(--os)"><b>On the kitchen ticket:</b> ${ticket}</p>`;  // fills the details panel with the element's name, contents, purpose and kitchen analogy
          }  // ends select()
          function show(i) {  // show(i): shows moment i of process 42's life in the PCB table; the player calls it on every step
            frame = i;  // remembers the current frame
            const f = PCB_FRAMES[i], prev = i ? PCB_FRAMES[i - 1].full : null;  // f is this frame, and prev is the previous frame's full snapshot (none for the first frame)
            FIELDS.forEach(([key]) => {  // updates every PCB row:
              const r = rows[key];  // r is this element's row
              r.val.textContent = f.full[key];  // writes the element's value for this frame
              r.val.classList.toggle('live', f.full[key] === LIVE);  // values that live in the processor right now are styled differently
              r.row.classList.remove('flash', 'chg');  // clears any earlier flash so it can play again
              if (prev && prev[key] !== f.full[key]) { void r.row.offsetWidth; r.row.classList.add('flash', 'chg'); }  // if the value changed since the last frame, the row flashes and gets a "changed" dot (reading offsetWidth restarts the animation)
            });  // ends the row loop
            cpuBox.innerHTML = f.cpu  // the processor card: when process 42 is running...
              ? `<div class="xs b" style="color:var(--cpu)">PROCESSOR</div><div>running <b style="color:var(--proc)">process 42</b> · <span class="mono">PC ${f.cpu[0]} · R1 = ${f.cpu[1]} · R2 = ${f.cpu[2]}</span></div>`  // ...it shows its live PC and register values...
              : `<div class="xs b" style="color:var(--cpu)">PROCESSOR</div><div class="muted">${i === PCB_FRAMES.length - 1 ? 'process 42 is gone; others run' : 'busy with another process; 42 is not running'}</div>`;  // ...otherwise it says the processor is busy elsewhere, or that 42 is gone after the last frame
            return f.cap;  // returns the caption, which the player shows
          }  // ends show()
          const player = ctx.ui.player({ count: PCB_FRAMES.length, render: show, interval: 2600, speed: false });  // the step player: one step per frame of process 42's life, 2.6 s per step when playing, no speed buttons
          select(sel);  // opens the program counter's explanation at the start
          const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the introduction and the PCB table
            h('p', { class: 'm0', html: 'For every process the OS creates a <span class="t">process control block (PCB)</span> and keeps it up to date. Only the OS reads and writes it. <b>Click any element</b> to learn what it holds; press <b>Play</b> to watch process 42 run. Changed values flash.' }),  // paragraph: the OS keeps one PCB per process; click an element or press Play, and changed values flash
            h('div', { class: 'card white', style: { padding: '8px 10px' } }, h('div', { class: 'pcb-head' }, h('b', {}, 'PCB · process 42'), h('span', { class: 'xs muted' }, 'kept by the OS in its own memory')), table));  // a white card with the PCB's title bar and the eight rows
          const mistake = h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'The PCB does not hold the program’s code or data. Its memory pointers only record <b>where</b> they are in memory.' });  // common mistake box: the PCB records where code and data are, it does not hold them
          el.append(h('div', { class: 'split r fill' }, left, h('div', { class: 'stack', style: { gap: '10px' } }, detail, cpuBox, player.el, mistake)));  // lays out the step: PCB table on the left (wider); details, processor card, player and warning on the right
        },  // ends render() for step 5
      },  // ends step 5

      /* ---------------- 6. Interrupt and resume: what the PCB makes possible ---------------- */
      {  // step 6 begins: how an interrupt, a save and a restore let a process resume exactly
        title: 'Interrupt, save, resume: the PCB’s big job',  // step title shown in the header
        kind: 'explore',  // kind "explore": the header labels this as an exploration
        core: true,  // core: true puts this step on the guide's shorter core route
        render(el, ctx) {  // render(el, ctx): builds the two process panels and the processor each time this step is shown
          const { h } = ctx;  // this step builds only ordinary page elements, so it needs just h
          let full = true, frames = resumeFrames(true);  // full says whether the OS saves registers as well as the PC; frames are the matching animation frames
          const LBL = ['State', 'PC', 'R1', 'R2'];  // LBL: the four saved values shown for each process: state, PC and the two registers
          function procPanel(id, title, src) {  // procPanel(id, title, src): builds one process's card with its code listing and its saved PCB values
            const code = ctx.ui.code(src, { lang: 'c', nums: false, fontSize: 13 });  // the code listing, without line numbers, in a smaller font
            // show the leading hex address of every line in one muted style (the highlighter colours only some of them)
            code.querySelectorAll('.ln').forEach((ln) => { ln.innerHTML = ln.innerHTML.replace(/^(?:<span class="tk-num">)?([0-9A-F]{4})(?:<\/span>)?/, '<span class="addr">$1</span>'); });  // wraps the address at the start of each listing line in a muted style (the regular expression finds the four hex digits)
            const cells = LBL.map(() => h('td', { class: 'mono' }));  // one table cell per saved value
            const tbl = h('table', { class: 'tbl compact rs' }, h('tbody', {}, ...LBL.map((l, i) => h('tr', {}, h('td', { class: 'b' }, l), cells[i]))));  // the small table of saved values: a label cell and a value cell per row
            const card = h('div', { class: 'card proc stack', style: { gap: '8px', padding: '10px 12px' } },  // the card in the process colour, holding...
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, title), h('span', { class: 'xs muted b' }, 'highlight = PC')),  // ...a title row with a note that the highlight marks the next instruction...
              code, h('div', { class: 'xs b', style: { color: 'var(--os)' } }, 'PCB ' + id + ' (saved by the OS)'), tbl);  // ...the code, a "PCB (saved by the OS)" heading and the table of saved values
            return { card, code, cells };  // returns the card, the code listing and the value cells so show() can update them
          }  // ends procPanel()
          const A = procPanel('A', 'Process A · adds two numbers', CODE_A);  // process A's card: it adds two numbers
          const B = procPanel('B', 'Process B · doubles a number', CODE_B);  // process B's card: it doubles a number
          const reg = LBL.slice(1).map((l) => { const v = h('div', { class: 'rv' }); return [h('div', { class: 'reg' }, h('div', { class: 'xs b muted' }, l), v), v]; });  // the processor's register boxes (PC, R1, R2), each returned with its value element
          const who = h('div', { class: 'b', style: { fontSize: '18px' } });  // line saying who is running on the processor
          const banner = h('div', { class: 'chip intr', style: { visibility: 'hidden', fontSize: '14px' } }, 'INTERRUPT: timer expired');  // the interrupt banner, hidden until an interrupt frame
          const mem = h('div', { class: 'small' });  // a line showing the value stored in memory at the end
          const cpu = h('div', { class: 'card cpu stack', style: { gap: '10px', padding: '12px 14px', alignItems: 'center', textAlign: 'center' } },  // the processor card in the middle, centred:
            h('b', { style: { color: 'var(--cpu)' } }, 'Processor'), who, banner,  // its title, who is running, and the interrupt banner
            h('div', { class: 'grid-3', style: { width: '100%', gap: '8px' } }, ...reg.map((r) => r[0])),  // the three register boxes in a row
            h('div', { class: 'xs muted' }, 'one set of registers, shared by every process'), mem);  // a note that every process shares this one set of registers, then the memory line
          const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);  // same(a, b): true if two values are equal, compared as text so lists compare by contents
          function show(i) {  // show(i): displays frame i; the player calls it on every step
            const f = frames[i], p = i ? frames[i - 1] : null;  // f is this frame and p the previous one
            who.innerHTML = f.who === 'OS' ? '<span style="color:var(--os)">the OS is running</span>' : `running <span style="color:var(--proc)">process ${f.who}</span>`;  // says whether the OS or which process is running
            // while the OS runs, the PC points into OS code; show that instead of a process address
            reg[0][0].title = f.cpu[0] === 'OS' ? 'The program counter now points into the operating system’s own code' : '';  // while the OS runs, the PC box's tooltip explains that the PC now points into the OS's own code
            banner.style.visibility = f.intr ? 'visible' : 'hidden';  // shows the interrupt banner only in interrupt frames
            reg.forEach(([box, v], k) => {  // updates each register box:
              v.textContent = String(f.cpu[k]);  // writes the value
              box.classList.remove('flash');  // clears any earlier flash
              if (p && p.cpu[k] !== f.cpu[k]) { void box.offsetWidth; box.classList.add('flash'); }  // flashes the box if its value changed
            });  // ends the register loop
            mem.innerHTML = 'memory: <span class="mono b">total = ' + f.total + '</span>' + (f.end ? (full ? ' <span class="chip ok">correct</span>' : ' <span class="chip bad">wrong</span>') : '');  // the memory line: the stored total, plus "correct" or "wrong" on the last frame
            [[A, 'A', 0x1200], [B, 'B', 0x3300]].forEach(([P, id, base]) => {  // updates both process cards, knowing where each one's code starts in memory:
              P.cells.forEach((c, k) => {  // for each saved value in the card's table:
                const val = f[id][k];  // val is this frame's value
                c.textContent = val;  // writes it
                c.style.color = val === 'not saved' ? 'var(--bad)' : val === 'in processor' ? 'var(--cpu)' : '';  // "not saved" is shown in red and "in processor" in the processor colour
                c.classList.remove('flash');  // clears any earlier flash
                if (p && !same(p[id][k], val)) { void c.offsetWidth; c.classList.add('flash'); }  // flashes the cell if its value changed
              });  // ends the cell loop
              P.card.style.outline = f.who === id ? '3px solid var(--proc)' : 'none';  // outlines the card of the process that is running
              P.code.clear();  // clears the code highlight
              if (f.who === id) { const n = (parseInt(f.cpu[0], 16) - base) / 4 + 1; if (n >= 1 && n <= 4) P.code.mark(n); }  // for the running process, works out which of its four lines the PC points at and highlights it
            });  // ends the loop over the two cards
            return f.cap;  // returns the caption, which the player shows
          }  // ends show()
          const player = ctx.ui.player({ count: frames.length, render: show, interval: 2400 });  // the step player, one step per frame, 2.4 s per step when playing
          const seg = ctx.ui.seg([{ value: true, label: 'OS saves PC + registers' }, { value: false, label: 'Broken OS: saves only the PC' }], full, (v) => { full = v; frames = resumeFrames(v); player.stop(); player.go(0); });  // buttons to choose the correct OS or the broken one; switching rebuilds the frames and restarts at frame 1
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // the step layout, stacked:
            h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // a top row with...
              h('p', { class: 'm0', html: 'An <span class="t">interrupt</span> can stop a process between any two instructions. The highlighted line is the process’s next instruction (addresses in hex). Step through, then try the broken OS.' }), seg),  // ...a paragraph (an interrupt can stop a process between any two instructions) and the OS choice buttons
            h('div', { class: 'grid-3 grow', style: { gridTemplateColumns: '1.25fr 1fr 1.25fr', alignItems: 'start' } }, A.card, cpu, B.card),  // three columns: process A, the processor, and process B
            player.el));  // the player under the columns; closes the layout
        },  // ends render() for step 6
      },  // ends step 6

      /* ---------------- 7. Lab: which PCB element would the OS read? ---------------- */
      {  // step 7 begins: a lab asking which PCB element the OS would read to answer a question
        title: 'Which PCB element would the OS read?',  // step title shown in the header
        kind: 'lab',  // kind "lab": the header labels this as a hands-on lab
        render(el, ctx) {  // render(el, ctx): builds the PCB question lab each time this step is shown
          const { h } = ctx;  // this step builds only ordinary page elements, so it needs just h
          const SHORT = { id: 'a unique number that names the process', state: 'where it stands right now: ready, running, blocked…', prio: 'how important it is compared with the others',  // SHORT: a one-line reminder of what each PCB element holds, used when a wrong element is picked
            pc: 'the address of the next instruction', mem: 'where its code, data and shared blocks sit in memory', ctx: 'the saved contents of the processor registers',  // short reminders for the program counter, memory pointers and context data
            io: 'outstanding I/O requests, assigned devices and files in use', acct: 'processor and clock time used, time limits, account numbers' };  // short reminders for the I/O status and accounting information
          const QS = [  // QS: the ten questions as [question, key of the element that answers it, explanation]
            ['The OS is about to give this process the processor again. At which instruction should it continue?', 'pc', 'The program counter holds the address of the next instruction to execute.'],  // question: where to continue when resuming, answered by the program counter
            ['Is this process allowed to run right now, or is it stuck waiting for something?', 'state', 'The state field records Ready, Running, Blocked and so on.'],  // question: can it run now, answered by the state
            ['Two processes are ready at the same moment. Which one should the policy serve first?', 'prio', 'Priority records how important each process is relative to the others.'],  // question: which ready process to serve first, answered by the priority
            ['At the end of the month, how much processor time should this user be billed for?', 'acct', 'Accounting information records the processor time used and the account to charge.'],  // question: how much processor time to bill, answered by the accounting information
            ['This process just crashed. Which files must the OS close on its behalf?', 'io', 'I/O status information lists the files the process has in use.'],  // question: which files to close after a crash, answered by the I/O status information
            ['The process has ended. Which regions of memory can now be freed?', 'mem', 'Memory pointers record where its code and data, and any shared blocks, are.'],  // question: which memory to free, answered by the memory pointers
            ['The process is about to resume. What did register R2 hold when it was interrupted?', 'ctx', 'Context data is the saved copy of the processor registers.'],  // question: what R2 held, answered by the context data
            ['Two copies of the same program are running. Exactly which one should get this “stop” request?', 'id', 'Only the unique identifier tells two processes running the same program apart.'],  // question: which of two copies to stop, answered by the identifier
            ['Has this job run past the time limit its owner was given?', 'acct', 'Time limits live in the accounting information, next to the time used so far.'],  // question: past its time limit or not, answered by the accounting information
            ['Which disk read request is this process still waiting on?', 'io', 'Outstanding I/O requests are part of the I/O status information.'],  // question: which disk read it waits on, answered by the I/O status information
          ];  // closes QS
          let k = 0, tries = 0, firstTry = 0, solved = false;  // k is the current question, tries the wrong picks on it, firstTry the first-try score, solved whether it is answered
          const qNum = h('div', { class: 'xs b muted' });  // small caption showing "QUESTION N OF 10"
          const qText = h('div', { class: 'qtext' });  // the question text
          const fb = h('div', { class: 'info', style: { minHeight: '104px' } });  // the feedback panel
          const dots = h('div', { class: 'row', style: { gap: '6px' } });  // row of progress dots, one per question
          const score = h('span', { class: 'chip ok' });  // chip showing the first-try score
          const next = h('button', { class: 'btn primary', type: 'button', onclick: () => go(k + 1) }, 'Next question');  // button to move to the next question
          const again = h('button', { class: 'btn ghost', type: 'button', onclick: () => { firstTry = 0; results.fill(null); go(0); } }, 'Start over');  // button to clear all results and start again from question 1
          const results = QS.map(() => null);  // results records each question's outcome: true for first try, false for later, null for not yet
          const btns = FIELDS.map(([key, label]) => h('button', { type: 'button', class: 'fbtn', 'data-k': key, onclick: () => pick(key) }, label));  // one answer button per PCB element, labelled with the element's name
          function paintDots() {  // paintDots(): redraws the progress dots and the score chip
            dots.replaceChildren(...QS.map((_, i) => h('span', { class: 'qd' + (i === k ? ' cur' : '') + (results[i] === true ? ' ok' : results[i] === false ? ' late' : '') })));  // each dot: ringed for the current question, green for first try, amber for later
            score.textContent = firstTry + ' right on the first try';  // updates the score text
          }  // ends paintDots()
          function go(i) {  // go(i): shows question i, or the final result after the last one; runs at the start, on Next and on Start over
            if (i >= QS.length) {  // past the last question, show the result:
              qNum.textContent = 'ALL DONE';  // caption becomes "ALL DONE"
              qText.innerHTML = `You found the right PCB element on the first try <b>${firstTry} of ${QS.length}</b> times.`;  // says how many were right on the first try
              fb.innerHTML = firstTry >= 8 ? '<b style="color:var(--ok)">Excellent.</b> You can already think like the OS: every question it asks about a process is answered by one element of the PCB.' : 'Review the elements you missed (the amber dots), then press <b>Start over</b> for a clean run.';  // praise for 8 or more, otherwise advice to review the amber questions and start over
              btns.forEach((b) => { b.disabled = true; b.classList.remove('right', 'wrong'); });  // disables and clears all the answer buttons
              next.disabled = true; k = QS.length; paintDots(); return;  // disables Next, marks the lab finished and updates the dots; stops here
            }  // ends the result case
            k = i; tries = 0; solved = false;  // moves to question i with no wrong picks yet
            qNum.textContent = `QUESTION ${k + 1} OF ${QS.length}`;  // caption shows the question number
            qText.textContent = QS[k][0];  // shows the question text
            fb.innerHTML = `Click the PCB element ${ctx.narrow ? 'below' : 'on the right'} that holds the answer.`;  // feedback asks the student to click the element below (phone) or on the right
            btns.forEach((b) => { b.disabled = false; b.classList.remove('right', 'wrong'); });  // re-enables and clears all the answer buttons
            next.disabled = true;  // Next stays disabled until the question is answered
            paintDots();  // updates the dots
          }  // ends go()
          function pick(key) {  // pick(key): checks an answer button; runs when one is clicked
            if (solved || k >= QS.length) return;  // ignores clicks once the question is solved or the lab is finished
            const [, ans, why] = QS[k];  // ans is the correct element and why its explanation
            const btn = btns.find((b) => b.dataset.k === key);  // btn is the button that was clicked
            const label = FIELDS.find((f) => f[0] === key)[1];  // label is the clicked element's name
            if (key === ans) {  // correct answer:
              solved = true;  // marks the question solved
              btn.classList.add('right');  // turns the button green
              results[k] = tries === 0;  // records whether it was a first try
              if (tries === 0) firstTry++;  // counts it toward the first-try score
              fb.innerHTML = `<b style="color:var(--ok)">Yes: ${label}.</b> ${why}` + (tries === 0 ? ' Right on the first try.' : '');  // feedback: "Yes", the element and why, plus a note if it was the first try
              btns.forEach((b) => { if (b !== btn) b.disabled = true; });  // disables the other buttons
              next.disabled = false;  // enables Next
              next.textContent = k === QS.length - 1 ? 'See my result' : 'Next question';  // on the last question Next reads "See my result"
            } else {  // wrong answer:
              tries++;  // counts the miss
              btn.classList.add('wrong'); btn.disabled = true;  // turns the button red and disables it
              fb.innerHTML = `<b style="color:var(--bad)">Not that one.</b> ${label} holds ${SHORT[key]}. Which element would answer this question? Try again.`;  // feedback: what the chosen element really holds, and a prompt to try again
            }  // ends the right/wrong branches
            paintDots();  // updates the dots
          }  // ends pick()
          go(0);  // shows the first question
          const left = h('div', { class: 'stack', style: { gap: '12px' } },  // left column: introduction, question card, feedback, dots and score, and a why-it-matters box
            h('p', { class: 'm0', html: 'Whenever the OS has a question about a process, it looks in that process’s <span class="t">PCB</span>. Your job: decide which element holds the answer. Amber dots mark questions that needed a second try.' }),  // paragraph: the OS answers its questions from the PCB; amber dots mark second tries
            h('div', { class: 'card white stack', style: { gap: '8px', minHeight: '150px' } }, qNum, qText),  // a white card holding the question number and text
            fb, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, dots, score),  // the feedback panel, then a row with the dots and the score
            h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'The OS asks questions like these thousands of times a second. Because everything it needs about a process sits in that one record, a single lookup answers each one.' }));  // why-it-matters box: one lookup in one record answers each question
          const right = h('div', { class: 'card os stack', style: { gap: '10px' } },  // right column: a card in the OS colour holding the answer buttons
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { color: 'var(--os)' } }, 'Process control block'), h('span', { class: 'xs muted' }, 'click the element that answers it')),  // its header: "Process control block" and a hint to click the answering element
            h('div', { class: 'grid-2', style: { gap: '10px' } }, ...btns),  // the eight answer buttons in two columns
            h('div', { class: 'row' }, next, again));  // the Next and Start over buttons
          el.append(h('div', { class: 'split fill' }, left, right));  // lays out the two columns side by side
        },  // ends render() for step 7
      },  // ends step 7

      /* ---------------- 8. Recap ---------------- */
      {  // step 8 begins: the recap
        title: 'Recap: six ideas to carry into the chapter',  // step title shown in the header
        kind: 'recap',  // kind "recap": the header labels this as a recap
        render(el, ctx) {  // render(el, ctx): builds the recap each time this step is shown
          const { h } = ctx;  // this step builds only ordinary page elements, so it needs just h
          el.append(h('div', { class: 'stack fill', style: { gap: '14px' } },  // the recap layout, stacked:
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. Click again to flip it back.'),  // a prompt to answer each card aloud before flipping it
            ctx.ui.flipcards([  // flip cards (click to turn a card over and see the answer):
              ['Program vs process', '<div>A <b>program</b> is passive code in a file. A <b>process</b> is a program in execution, with its own data, state, resources and PCB. One program can run as many processes.</div>'],  // card: program versus process
              ['Why put an OS between applications and hardware?', 'Writing apps for bare hardware is wasteful and unsafe. The OS offers a convenient, rich, safe, consistent interface and abstract resources, and it referees sharing.'],  // card: why an OS sits between applications and hardware
              ['The OS’s three process-level duties', '<div>1. Interleave processes: high utilization, reasonable response time.<br>2. Allocate resources by policy, avoiding deadlock.<br>3. Support IPC and user creation of processes.</div>'],  // card: the OS's three process-level duties
              ['Two essential elements of a running program', '<div>Its <b>program code</b> (which several processes may share) and the <b>set of data</b> that code works on.</div>'],  // card: the two essential elements of a running program
              ['The eight elements of a PCB', 'Identifier, state, priority, program counter, memory pointers, context data, I/O status information, accounting information.'],  // card: the eight elements of a PCB
              ['How can a process be stopped and resumed?', 'The OS saves its program counter and context data in its PCB, runs others, then restores them. The process carries on as if never interrupted.'],  // card: how a process is stopped and resumed
            ], { cols: 3, height: 176 }),  // closes the card list, laid out in three columns of 176px-tall cards
            h('div', { class: 'card white stack', style: { gap: '10px', padding: '12px 16px' } },  // a white card under the flip cards, holding the summary that follows
              h('div', { class: 'eq' }, h('span', { class: 'box' }, 'program code'), '+', h('span', { class: 'box mem' }, 'its data'), '+', h('span', { class: 'box os' }, 'PCB (kept by the OS)'), '=', h('span', { class: 'box proc' }, 'a process')),  // the equation again: program code + its data + PCB (kept by the OS) = a process
              h('p', { class: 'small muted m0 center', html: '<b>Coming next:</b> section 3.2 follows the <b>State</b> element as a process moves between states, and 3.3 opens up everything the OS records about a process.' }))));  // a closing line previewing sections 3.2 and 3.3; closes the summary card and the layout
        },  // ends render() for step 8
      },  // ends step 8

      /* ---------------- 9. Check yourself ---------------- */
      {  // step 9 begins: the self-check quiz for this section
        title: 'Check yourself',  // step title shown in the header
        kind: 'check',  // kind "check": the header labels this as Check Yourself
        quiz: [  // quiz: the questions; the guide's quiz engine draws them, checks answers and saves the best score
          { q: 'What is the key difference between a program and a process?',  // quiz question 1 (multiple choice): the key difference between a program and a process
            choices: ['A program is stored on disk; a process is that same file copied into main memory, unchanged.', 'A program is passive instructions; a process is that program executing, with its own data, state and resources.', 'A program is written by its developers; a process is written by the operating system at run time.', 'There is no real difference: “process” is simply the operating system’s word for a program.'],  // the four choices
            answer: 1,  // answer: 1 marks the second choice (counting from 0) as correct
            feedback: ['Copying the code into memory is only part of it. A process is executing, and it has its own data, a current state, resources and a PCB.', null, 'The OS creates the process and its PCB, but it does not write the program; the process runs the program’s instructions.', 'They differ: one program can be running as several processes at once, each with its own data and PCB.'],  // feedback shown for each wrong choice; null for the correct one
            why: 'A program is passive code. A process is an active instance of that code: executing, with its own data, state, resources and PCB.' },  // explanation shown after answering: passive code versus an active, executing instance
          { q: 'While a program is executing, which two essential elements make it up?',  // quiz question 2 (multiple choice): the two essential elements of a running program
            choices: ['Program code and a set of data associated with that code', 'A process control block and an interrupt handler', 'A disk file and a timer', 'A priority and an identifier'],  // the four choices
            answer: 0,  // the first choice is correct
            feedback: [null, 'The OS adds a PCB to manage the process, and interrupt handlers belong to the OS, not to the program.', 'The file is where the program is stored; a timer is hardware the OS uses. Neither is part of the running program.', 'Those are two elements of the PCB, the OS’s record about the process.'],  // feedback for each wrong choice
            why: 'A running program consists of its code (which several processes may share) and the data that code works on. The OS adds a PCB to manage it.' },  // explanation: code (which may be shared) plus the data it works on
          { type: 'multi', q: 'Which of these are elements of a process control block? Select all that apply.',  // quiz question 3 (select all that apply): which items are PCB elements
            choices: ['Program counter', 'The full source code of the program', 'Accounting information', 'I/O status information', 'A copy of every other process’s registers', 'Priority'],  // the six choices
            answer: [0, 2, 3, 5],  // the correct ones: program counter, accounting information, I/O status information and priority
            why: 'A PCB holds the identifier, state, priority, program counter, memory pointers, context data, I/O status information and accounting information. It points to the code in memory rather than storing it, and it holds only this process’s own register values.' },  // explanation: the eight elements, and why source code and other processes' registers are not in the PCB
          { type: 'match', q: 'Match each PCB element to what it holds.',  // quiz question 4 (match the pairs): PCB elements and what they hold
            pairs: [['Program counter', 'Address of the next instruction to execute'], ['Context data', 'Register contents while the process is running'], ['Memory pointers', 'Where the code, data and shared blocks are in memory'], ['Accounting information', 'Processor time used, time limits, account numbers'], ['Identifier', 'A unique number for this process']],  // the five element-and-contents pairs
            why: 'Each element answers a different question the OS may ask about a process: where to continue, what the registers held, where its memory is, how much time it used, and which process it is.' },  // explanation: each element answers a different question the OS may ask
          { q: 'After an interrupt, a process resumes at exactly the right instruction but computes a wrong result. Which PCB element did the OS most likely fail to save and restore?',  // quiz question 5 (multiple choice): right instruction but wrong result, so which element was not saved
            choices: ['Program counter', 'Context data', 'Priority', 'Identifier'],  // the four choices
            answer: 1,  // the second choice, context data, is correct
            feedback: ['The process restarted at the right instruction, so its program counter was saved and restored correctly.', null, 'Priority affects when a process runs, not the values it computes.', 'The identifier only names the process; it has no effect on its arithmetic.'],  // feedback for each wrong choice
            why: 'Context data is the saved copy of the processor registers. If it is not restored, the process continues with another process’s leftover register values.' },  // explanation: without restored registers, the process uses another process's leftover values
          { q: 'Which of these is <b>not</b> one of the fundamental OS requirements expressed in terms of processes?',  // quiz question 6 (multiple choice): which is not one of the three process-level OS requirements
            choices: ['Interleave the execution of multiple processes to maximize processor utilization while giving reasonable response time', 'Allocate resources to processes according to a specific policy while avoiding deadlock', 'Support interprocess communication and user creation of processes', 'Give every process an equal, fixed share of main memory'],  // the four choices
            answer: 3,  // the fourth choice, equal fixed memory shares, is the one that is not a requirement
            feedback: ['This is one of the three requirements: it is about keeping the processor busy without making users wait too long.', 'This is one of the three requirements: resources follow a policy, such as priorities, and deadlock must be avoided.', 'This is one of the three requirements: processes must be able to talk to each other, and users must be able to start new ones.', null],  // feedback for each of the three real requirements
            why: 'The three requirements are interleaving for utilization and response time, policy-based allocation without deadlock, and IPC plus process creation. Allocation follows a policy such as priorities; nothing demands equal, fixed shares.' },  // explanation: the three real requirements; allocation follows a policy, not equal shares
          { type: 'num', q: 'Over a 15-unit stretch, a processor does useful work for 11 units and sits idle for the rest. What is its processor utilization, in percent? (Give one decimal place.)',  // quiz question 7 (calculate): processor utilization for 11 busy units out of 15
            answer: 73.3, tol: 0.2, unit: '%',  // the answer is 73.3 percent, accepted within 0.2
            why: 'Utilization = busy time ÷ total time = 11 ÷ 15 ≈ 0.733, which is 73.3%.' },  // explanation: 11 divided by 15
          { type: 'order', q: 'Put the steps of interrupting and later resuming process A in order.',  // quiz question 8 (put in order): the steps of interrupting and later resuming process A
            items: ['Process A is running on the processor', 'An interrupt stops A between two instructions', 'The OS saves A’s program counter and registers in A’s PCB', 'The OS loads process B’s saved values, and B runs', 'The OS restores A’s saved values, and A continues where it stopped'],  // the five steps, listed in the correct order; the quiz shuffles them for the student
            why: 'The OS saves first, then switches, and later restores. Because A’s PC and context data were kept in its PCB, A resumes as if nothing had happened.' },  // explanation: save, switch, and later restore
          { type: 'tf', q: 'A process creates its own process control block and updates it as it runs.',  // quiz question 9 (true or false): a process creates and updates its own PCB
            answer: false,  // the answer is false
            why: 'The PCB is created and managed by the operating system. Ordinary processes cannot read or change it; that protects the OS’s bookkeeping.' },  // explanation: the OS creates and manages the PCB, and processes cannot touch it
          { type: 'bucket', q: 'Raw hardware, or an abstraction the OS offers? Sort each item.',  // quiz question 10 (sort into groups): raw hardware or an OS abstraction
            buckets: ['Hardware resource', 'OS abstraction'],  // the two groups
            items: [['Disk drive', 0], ['File', 1], ['I/O module', 0], ['Process', 1], ['A private memory region for each process', 1]],  // the items, each paired with the number of its correct group
            why: 'The OS hides raw devices behind convenient abstractions: files instead of disk blocks, processes instead of raw processor time, and protected memory regions instead of one shared array of bytes.' },  // explanation: files, processes and private memory regions are what the OS offers in place of raw devices
          { type: 'num', q: 'A PCB’s accounting information shows 15 ms of processor time and 60 ms of clock time since the process was created. For what percentage of its lifetime was the process actually running on the processor?',  // quiz question 11 (calculate): the share of its lifetime a process spent running
            answer: 25, tol: 0.5, unit: '%',  // the answer is 25 percent, accepted within 0.5
            why: '15 ÷ 60 = 0.25 = 25%. Clock time keeps growing while a process waits; processor time grows only while it runs.' },  // explanation: 15 ms of processor time over 60 ms of clock time
          { q: 'Which definition of a process describes it from the point of view of the OS deciding what to run next?',  // quiz question 12 (multiple choice): which definition takes the OS's point of view
            choices: ['A program in execution', 'An instance of a program running on a computer', 'The entity that can be assigned to and executed on a processor', 'A passive file of machine instructions'],  // the four choices
            answer: 2,  // the third choice is correct
            feedback: ['This is a correct definition, but it stresses the link between a program and its execution, not the OS’s choice of what to run.', 'This is a correct definition, but it stresses that one program can have many instances.', null, 'That describes a program, not a process.'],  // feedback for each wrong choice
            why: 'The OS repeatedly picks something to give the processor to. The entity it assigns to the processor is a process.' },  // explanation: the thing the OS assigns to the processor is a process
        ],  // closes the quiz list
      },  // ends step 9

    ],  // closes the steps list

    notes: `${/* notes: the section's reading notes as HTML text, shown in the side panel the Notes button opens */''}
      <h3>Why the OS thinks in processes</h3>${/* notes heading: why the OS thinks in processes */''}
      <p>A computer platform is a collection of <b>hardware resources</b>: the processor, main memory, I/O modules, timers, disk drives and so on. <b>Applications</b> are programs written to do useful tasks for people. Writing each application directly for the bare hardware would be <b>inefficient</b> (every application would need its own code for every device) and <b>unsafe</b> (nothing would stop one program from damaging another). So the operating system sits in between. It gives applications a <b>convenient, rich, safe and consistent</b> interface and an <b>abstract representation</b> of each resource: named files instead of disk blocks, a private memory region for each process instead of raw memory cells, and processes that take fair turns instead of the bare processor.</p>${/* notes paragraph: hardware resources, applications, and why the OS stands between them with abstractions */''}
      <p>Because many applications run at once, the OS must also manage how they share those resources. It does that bookkeeping per <b>process</b>.</p>${/* notes paragraph: the OS does its sharing bookkeeping per process */''}
      <h4>The three fundamental requirements, stated in terms of processes</h4>${/* notes subheading: the three fundamental requirements */''}
      <ol>${/* a numbered list of the requirements begins */''}
        <li><b>Interleave</b> the execution of multiple processes to maximize processor utilization while providing reasonable response time.</li>${/* list item: interleave for utilization and response time */''}
        <li><b>Allocate resources</b> to processes according to a specific policy (for example, higher priority is served first) while <b>avoiding deadlock</b>.</li>${/* list item: allocate by policy while avoiding deadlock */''}
        <li>Support <b>interprocess communication (IPC)</b> and <b>user creation of processes</b>.</li>${/* list item: support IPC and user creation of processes */''}
      </ol>${/* end of the numbered list */''}
      <p><b>Processor utilization</b> = busy time ÷ total time. <b>Response time</b> is how long a user waits for a result. The two goals can clash: switching more often answers people sooner, but every switch costs the processor some work.</p>${/* notes paragraph: the utilization formula, response time, and how the two goals clash */''}
      <h4>Worked example: one at a time vs interleaved</h4>${/* notes subheading: worked example comparing one at a time with interleaved */''}
      <p>Three processes arrive together. A needs 6 units of processor work. B needs 2 units, then waits 4 units for the disk, then needs 2 more. C needs 1 unit (echo a keystroke).</p>${/* notes paragraph: the three sample jobs A, B and C */''}
      <ul>${/* a bulleted list of the two outcomes begins */''}
        <li><b>One at a time</b> (A, then B, then C): the processor idles while B waits for the disk. Total time 15, busy time 6 + 4 + 1 = 11, so utilization = 11 ÷ 15 = <b>73.3%</b>. C gets its answer at time 15.</li>${/* list item: one at a time gives 73.3 percent utilization and C finishes at 15 */''}
        <li><b>Interleaved</b>, time slice 2, switching whenever a process blocks: A 0–2, B 2–4 (then waits for the disk until 8), C 4–5, A 5–9, B 9–11. Total 11, busy 11, utilization <b>100%</b>. C gets its answer at time 5.</li>${/* list item: interleaved with slice 2 gives 100 percent and C finishes at 5 */''}
      </ul>${/* end of the list */''}
      <p>Shorter slices answer short jobs sooner, but every real switch costs a little processor time, so real systems pick a moderate slice. Very long slices can bring idle time back (slice 6: utilization 11 ÷ 14 ≈ 78.6%).</p>${/* notes paragraph: slice length trade-offs, and how a slice of 6 brings idle time back */''}
      <h4>Allocation and deadlock</h4>${/* notes subheading: allocation and deadlock */''}
      <p>If P1 holds the printer and waits for the scanner while P2 holds the scanner and waits for the printer, neither can ever continue: that is <b>deadlock</b>. A policy such as “serve requests by priority, and always request the printer before the scanner” prevents the circle of waiting: a process that must wait for the printer holds nothing anyone else needs. Deadlock is not mere slowness; deadlocked processes never finish unless the OS intervenes.</p>${/* notes paragraph: the printer and scanner deadlock, and the ordering policy that prevents it */''}
      <h4>Communication and creation</h4>${/* notes subheading: communication and creation */''}
      <p>Each process’s memory is private, so cooperating processes need an OS-provided channel (messages, pipes, shared memory) to exchange data: that is IPC. Users and programs must also be able to ask the OS to create new processes, for example by double-clicking an icon or typing a command; each new process gets a new identifier, its own memory and its own record.</p>${/* notes paragraph: why private memory needs IPC, and how new processes are created */''}

      <h3>What is a process?</h3>${/* notes heading: what a process is */''}
      <p>Four standard definitions, all correct, each from a different angle:</p>${/* notes paragraph: four standard definitions, each from a different angle */''}
      <ul>${/* a bulleted list of the definitions begins */''}
        <li><b>A program in execution</b>: execution is what turns a program into a process.</li>${/* list item: a program in execution */''}
        <li><b>An instance of a program running on a computer</b>: one program can have many instances at once.</li>${/* list item: an instance of a running program */''}
        <li><b>The entity that can be assigned to and executed on a processor</b>: the OS’s point of view; it is what the OS picks to run next.</li>${/* list item: the thing the OS assigns to a processor */''}
        <li><b>A unit of activity characterized by the execution of a sequence of instructions, a current state, and an associated set of system resources</b>: its <b>trace</b> (the sequence of instruction addresses it executes), where it stands now, and what it holds (memory, open files, devices).</li>${/* list item: a unit of activity with a trace, a state and resources */''}
      </ul>${/* end of the list */''}
      <p><b>Program vs process.</b> A program is passive: a set of instructions stored in a file. A process is active: that program executing, with its own data, state, resources and PCB. Two processes can run the same program at the same time.</p>${/* notes paragraph: a program is passive, a process is active, and one program can run as two processes */''}
      <h4>Two essential elements</h4>${/* notes subheading: the two essential elements */''}
      <p>While a program executes, its process has two essential elements: the <b>program code</b>, which may be <b>shared</b> with other processes running the same program (running code is only read, never changed), and a <b>set of data</b> associated with that code. Launch the same program twice and the OS loads the code once; each process gets its own data area, its own PCB and its own program counter, so the two can be at different places in the same code.</p>${/* notes paragraph: shared code plus separate data, PCB and program counter for each process */''}
      <h3>The process control block (PCB)</h3>${/* notes heading: the process control block */''}
      <p>For every process the OS <b>creates and manages</b> a process control block. Processes themselves cannot read or change it. The PCB does not contain the code or data; its memory pointers say where they are. Its elements:</p>${/* notes paragraph: the OS creates and manages the PCB, which points to code and data rather than holding them */''}
      <table>${/* a table of the eight PCB elements begins */''}
        <tr><th>Element</th><th>What it holds</th><th>The OS uses it to answer…</th></tr>${/* table header row: element, what it holds, and the question the OS uses it to answer */''}
        <tr><td>Identifier</td><td>A unique number for this process (PID)</td><td>Which of two copies of a program should get this request?</td></tr>${/* table row: the identifier */''}
        <tr><td>State</td><td>Where it stands now, e.g. Running, Ready, Blocked</td><td>May this process run right now?</td></tr>${/* table row: the state */''}
        <tr><td>Priority</td><td>Its importance relative to other processes</td><td>Two are ready: who goes first?</td></tr>${/* table row: the priority */''}
        <tr><td>Program counter</td><td>Address of the next instruction to execute</td><td>Where should it continue?</td></tr>${/* table row: the program counter */''}
        <tr><td>Memory pointers</td><td>Where its code and data are, plus memory blocks shared with other processes</td><td>Which memory can be freed? What does it share?</td></tr>${/* table row: the memory pointers */''}
        <tr><td>Context data</td><td>The processor register contents while it runs (saved when it stops)</td><td>What did R2 hold when it was interrupted?</td></tr>${/* table row: the context data */''}
        <tr><td>I/O status information</td><td>Outstanding I/O requests, assigned I/O devices, files in use</td><td>Which files must be closed? Which request is it waiting on?</td></tr>${/* table row: the I/O status information */''}
        <tr><td>Accounting information</td><td>Processor time and clock time used, time limits, account numbers</td><td>How much should be billed? Is it over its limit?</td></tr>${/* table row: the accounting information */''}
      </table>${/* end of the PCB table */''}
      <p>While a process runs, its live program counter and register values sit in the processor; the PCB holds the copy saved when it last stopped. Processor time grows only while the process runs; clock time keeps growing while it waits. Example: 15 ms of processor time over 60 ms of clock time means the process was running for 15 ÷ 60 = 25% of its lifetime.</p>${/* notes paragraph: live values sit in the processor while running, and the processor-time versus clock-time example */''}
      <p>Kitchen analogy: the PCB is the order ticket: order number, status, rush flag, next recipe step, which shelf and pans, what is in the pans now, waiting on the oven, time in the kitchen and who pays.</p>${/* notes paragraph: the kitchen order-ticket analogy for each PCB element */''}

      <h3>Interrupt and resume: why the PCB matters</h3>${/* notes heading: interrupt and resume, and why the PCB matters */''}
      <p>The PCB holds enough information to <b>interrupt a running process and later resume it as if the interruption had not occurred</b>. The sequence:</p>${/* notes paragraph: the PCB lets the OS interrupt a process and resume it as if nothing happened */''}
      <ol>${/* a numbered list of the steps begins */''}
        <li>Process A is running on the processor.</li>${/* step 1: A is running */''}
        <li>An interrupt (for example, the timer ending A’s time slice) stops A between two instructions: the processor sets A’s PC aside and jumps into the OS.</li>${/* step 2: an interrupt stops A and the processor jumps into the OS */''}
        <li>The OS saves A’s program counter <b>and</b> context data into A’s PCB and updates A’s state.</li>${/* step 3: the OS saves A's program counter and context data into its PCB */''}
        <li>The OS loads another process’s saved values from its PCB, and that process runs.</li>${/* step 4: the OS loads another process's saved values and runs it */''}
        <li>Later the OS restores A’s saved values, and A continues at the saved instruction with its own register values.</li>${/* step 5: the OS restores A, which continues with its own values */''}
      </ol>${/* end of the numbered list */''}
      <p><b>Worked example.</b> A executes R1 = 17 and R2 = 40 and is interrupted with PC = 0x1208. B, restored with R1 = 5, R2 = 9, doubles R2 to 18. When A is restored (PC 0x1208, R1 17, R2 40), R1 = R1 + R2 gives <b>57</b>. If the OS saved only the program counter, B would start with A’s leftover registers (40 × 2 = 80), and A would resume with R2 = 80 and compute <b>97</b>: the right instruction with the wrong data. That is why the PCB keeps the context data as well as the program counter.</p>${/* notes paragraph: worked example giving 57 with full saving and 97 when only the PC is saved */''}
      <p>Without PCBs, an OS could not keep many processes in progress at once. In one line: <b>process = program code + associated data + PCB</b>.</p>${/* notes paragraph: without PCBs many processes could not be in progress; process = code + data + PCB */''}
      <svg viewBox="0 0 520 64" width="520" role="img" aria-label="process equals program code plus data plus PCB">${/* a small SVG picture of that equation, with fixed colours so it also prints well */''}
        <rect x="4" y="12" width="120" height="40" rx="8" fill="#f5f7fb" stroke="#69738c"/><text x="64" y="37" text-anchor="middle" font-size="14" fill="#151c2c">program code</text>${/* equation box: program code */''}
        <text x="138" y="38" text-anchor="middle" font-size="18" fill="#151c2c">+</text>${/* the plus sign */''}
        <rect x="152" y="12" width="84" height="40" rx="8" fill="#d7f5e8" stroke="#059669"/><text x="194" y="37" text-anchor="middle" font-size="14" fill="#151c2c">data</text>${/* equation box: data */''}
        <text x="250" y="38" text-anchor="middle" font-size="18" fill="#151c2c">+</text>${/* the plus sign */''}
        <rect x="264" y="12" width="84" height="40" rx="8" fill="#eee5ff" stroke="#7c3aed"/><text x="306" y="37" text-anchor="middle" font-size="14" fill="#151c2c">PCB</text>${/* equation box: PCB */''}
        <text x="362" y="38" text-anchor="middle" font-size="18" fill="#151c2c">=</text>${/* the equals sign */''}
        <rect x="376" y="12" width="140" height="40" rx="8" fill="#d6f3f9" stroke="#0891b2"/><text x="446" y="37" text-anchor="middle" font-size="14" font-weight="700" fill="#151c2c">a process</text>${/* equation box: a process */''}
      </svg>${/* end of the equation picture */''}
      <p>Coming next: section 3.2 follows the State element as a process moves between states, and section 3.3 describes everything else the OS records about a process.</p>${/* notes paragraph: a preview of sections 3.2 and 3.3 */''}
    `,  // end of the notes text
  });  // closes the section object and the Guide.section call
})();  // ends the function that wraps this file and runs it immediately
