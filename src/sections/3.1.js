/* =====================================================================
   Section 3.1 — What Is a Process?
   Why the OS manages work in processes (hardware, applications, the OS
   interface, the three process-level duties), four definitions of a
   process, program vs process, code + data, the process control block
   and its eight elements, and how the PCB lets the OS interrupt a
   process and later resume it. Helpers live inside this IIFE so
   nothing leaks into the global scope.
   ===================================================================== */
(() => {
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
  const JOBS = [
    { id: 'A', ph: [['cpu', 6]] },
    { id: 'B', ph: [['cpu', 2], ['io', 4], ['cpu', 2]] },
    { id: 'C', ph: [['cpu', 1]] },
  ];
  function schedule(mode, q) {
    const st = JOBS.map((j) => ({ id: j.id, ph: j.ph.map((p) => p.slice()), k: 0, done: null, ioUntil: null }));
    const segs = { A: [], B: [], C: [] };
    const cpu = [];
    const push = (id, kind, a, b) => {
      const L = segs[id], last = L[L.length - 1];
      if (last && last.kind === kind && last.b === a) last.b = b; else L.push({ kind, a, b });
    };
    let t = 0;
    if (mode === 'serial') {
      for (const p of st) {
        if (t > 0) push(p.id, 'wait', 0, t);
        for (const [kind, d] of p.ph) {
          push(p.id, kind, t, t + d);
          for (let i = 0; i < d; i++) cpu.push(kind === 'cpu' ? p.id : null);
          t += d;
        }
        p.done = t;
      }
    } else {
      const ready = st.slice();
      let run = null, used = 0;
      while (st.some((p) => p.done == null) && t < 60) {
        for (const p of st) if (p.ioUntil === t) { p.ioUntil = null; p.k++; ready.push(p); }
        if (run && used >= q) { ready.push(run); run = null; }
        if (!run && ready.length) { run = ready.shift(); used = 0; }
        for (const p of st) {
          if (p.done != null) continue;
          push(p.id, p === run ? 'cpu' : p.ioUntil != null ? 'io' : 'wait', t, t + 1);
        }
        cpu.push(run ? run.id : null);
        if (run) {
          run.ph[run.k][1]--; used++;
          if (run.ph[run.k][1] === 0) {
            run.k++;
            if (run.k >= run.ph.length) run.done = t + 1;
            else run.ioUntil = t + 1 + run.ph[run.k][1];
            run = null;
          }
        }
        t++;
      }
    }
    const busy = cpu.filter(Boolean).length;
    return { segs, cpu, total: t, busy, fin: Object.fromEntries(st.map((p) => [p.id, p.done])) };
  }

  /* ------------------------------------------------------------------
     Step 2, tab 2: allocate resources by policy, avoid deadlock.
     Two processes both need the printer AND the scanner.
     Each frame lists edges [process, resource, 'holds' | 'waits'].
     ------------------------------------------------------------------ */
  const ALLOC = {
    any: [
      { e: [], st: ['needs both', 'needs both'],
        cap: '<b>Start.</b> P1 and P2 each need <b>both</b> the printer and the scanner to finish. The OS grants each request the moment it arrives.' },
      { e: [['P1', 'printer', 'holds']], st: ['holds printer', 'needs both'],
        cap: 'P1 asks for the printer. It is free, so the OS grants it.' },
      { e: [['P1', 'printer', 'holds'], ['P2', 'scanner', 'holds']], st: ['holds printer', 'holds scanner'],
        cap: 'P2 asks for the scanner. It is free too, so the OS grants it. Each process now holds one of the two.' },
      { e: [['P1', 'printer', 'holds'], ['P2', 'scanner', 'holds'], ['P1', 'scanner', 'waits']], st: ['waiting', 'holds scanner'],
        cap: 'P1 asks for the scanner. P2 holds it, so P1 must <b>wait</b> until P2 lets go.' },
      { e: [['P1', 'printer', 'holds'], ['P2', 'scanner', 'holds'], ['P1', 'scanner', 'waits'], ['P2', 'printer', 'waits']], st: ['stuck', 'stuck'], dead: true,
        cap: '<b style="color:var(--bad)">Deadlock.</b> P2 now waits for the printer, which P1 holds. Each waits for the other, neither can finish, so neither ever releases anything. Both are stuck forever.' },
    ],
    rule: [
      { e: [], st: ['needs both', 'needs both'],
        cap: '<b>Start.</b> Same two processes, but the OS enforces a policy: requests are served by <b>priority</b>, and everyone must ask for the printer <b>before</b> the scanner.' },
      { e: [['P1', 'printer', 'holds'], ['P2', 'printer', 'waits']], st: ['holds printer', 'waiting'],
        cap: 'Both ask for the printer at the same moment. The policy serves the higher priority first, so P1 gets it. P2 waits while holding nothing, so it blocks nobody.' },
      { e: [['P1', 'printer', 'holds'], ['P1', 'scanner', 'holds'], ['P2', 'printer', 'waits']], st: ['holds both', 'waiting'],
        cap: 'P1 asks for the scanner. Nobody has it, so P1 gets it and now holds everything it needs.' },
      { e: [['P2', 'printer', 'holds']], st: ['finished', 'holds printer'],
        cap: 'P1 finishes and releases both devices. The OS hands the printer to P2, which was next in line.' },
      { e: [['P2', 'printer', 'holds'], ['P2', 'scanner', 'holds']], st: ['finished', 'holds both'], ok: true,
        cap: '<b style="color:var(--ok)">Both finish.</b> P2 takes the scanner and completes. Because every process asks in the same order, a circle of waiting can never form.' },
    ],
  };
  function dutyAllocate(panel, ctx) {
    const { h, s } = ctx;
    let rule = 'any';
    const svg = s('svg', { viewBox: '0 0 600 236', width: '100%', role: 'img', 'aria-label': 'Two processes and two devices' });
    const BOX = { P1: [30, 26], P2: [30, 150], printer: [410, 26], scanner: [410, 150] };   // top-left corners, 160 x 60
    const EDGE = {   // [x1, y1, x2, y2] from the process side to the resource side, label position
      'P1-printer': [190, 56, 410, 56, 300, 46], 'P2-scanner': [190, 180, 410, 180, 300, 170],
      'P1-scanner': [190, 76, 410, 160, 238, 100], 'P2-printer': [190, 160, 410, 76, 238, 147],
    };
    function draw(f) {
      svg.replaceChildren();
      for (const [p, r, kind] of f.e) {
        const [x1, y1, x2, y2, lx, ly] = EDGE[p + '-' + r];
        const bad = f.dead;
        const col = bad ? 'var(--bad)' : kind === 'holds' ? 'var(--proc)' : 'var(--warn)';
        const mk = bad ? 'bad' : kind === 'holds' ? 'proc' : 'warn';
        // "holds" arrows point resource → process; "waits" arrows point process → resource
        const [ax, ay, bx, by] = kind === 'holds' ? [x2, y2, x1 + 4, y1] : [x1, y1, x2 - 4, y2];
        svg.append(s('line', { x1: ax, y1: ay, x2: bx, y2: by, style: `stroke:${col}`, 'stroke-width': 3, 'stroke-dasharray': kind === 'waits' ? '8 6' : null, 'marker-end': `url(#arr-${mk})` }),
          s('text', { x: lx, y: ly, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: 'halo', style: `fill:${col}` }, kind === 'holds' ? 'held by' : 'waits for'));
      }
      const proc = (id, i, prio) => s('g', {},
        s('rect', { x: BOX[id][0], y: BOX[id][1], width: 160, height: 60, rx: 12, class: f.dead ? 's-bad' : 's-proc', 'stroke-width': 2 }),
        s('text', { x: BOX[id][0] + 80, y: BOX[id][1] + 25, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, id + (rule === 'rule' ? ' · ' + prio : '')),
        s('text', { x: BOX[id][0] + 80, y: BOX[id][1] + 47, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, f.st[i]));
      const dev = (id, label) => s('g', {},
        s('rect', { x: BOX[id][0], y: BOX[id][1], width: 160, height: 60, rx: 12, class: 's-io', 'stroke-width': 2 }),
        s('text', { x: BOX[id][0] + 80, y: BOX[id][1] + 36, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, label));
      svg.append(proc('P1', 0, 'high priority'), proc('P2', 1, 'normal'), dev('printer', 'Printer'), dev('scanner', 'Scanner'));
    }
    const card = h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center', padding: '8px 12px' } }, svg);
    const player = ctx.ui.player({ count: ALLOC[rule].length, render: (i) => { draw(ALLOC[rule][i]); card.style.borderColor = ALLOC[rule][i].dead ? 'var(--bad)' : ALLOC[rule][i].ok ? 'var(--ok)' : ''; return ALLOC[rule][i].cap; }, interval: 2200 });
    const seg = ctx.ui.seg([{ value: 'any', label: 'No rule: grant on request' }, { value: 'rule', label: 'Policy: priority + printer first' }], rule, (v) => { rule = v; player.stop(); player.setCount(ALLOC[rule].length); });
    const text = h('div', { class: 'stack', style: { gap: '8px' }, html: `
      <h3 class="m0">Duty 2 · Allocate resources by policy, without deadlock</h3>
      <p class="m0">Processes compete for memory, files, devices and processor time. The OS hands these out following a stated <b>policy</b>, for example by <span class="t">priority</span>: more important work is served first.</p>
      <p class="m0">It must also avoid <span class="t">deadlock</span>: a standstill in which processes each hold something another one needs, so all of them wait forever.</p>
      <div class="callout tip m0" data-label="Try it">Step through with no rule until the processes jam, then switch to the policy and replay.</div>
      <div class="callout warn m0" data-label="Common mistake">Deadlock is not the same as slowness. A slow process finishes eventually; deadlocked processes never do, unless the OS steps in, for example by taking a resource away or ending one of them.</div>` });
    panel.append(h('div', { class: 'split l fill' }, text, h('div', { class: 'stack' }, seg, card, player.el)));
  }

  /* ------------------------------------------------------------------
     Step 2, tab 3: user creation of processes + interprocess communication.
     ------------------------------------------------------------------ */
  function dutyIPC(panel, ctx) {
    const { h, s } = ctx;
    const SLOT = [20, 215, 410];                     // x of the three process slots (170 wide)
    let st;
    const svg = s('svg', { viewBox: '0 0 600 250', width: '100%', role: 'img', 'aria-label': 'User, operating system and processes' });
    const log = h('div', { class: 'log', style: { height: '84px' } });
    const say = h('p', { class: 'small m0', style: { minHeight: '44px' } });
    const reset = () => {
      st = { procs: [{ name: 'Desktop', pid: 120 }, null, null], next: 121, last: null };
      log.replaceChildren(h('div', {}, 'at login: OS creates Desktop (PID 120)'));
      say.innerHTML = 'Only the Desktop process is running. <b>Open</b> two programs, then have them exchange a message.';
      draw();
    };
    const slotOf = (name) => st.procs.findIndex((p) => p && p.name === name);
    function draw() {
      svg.replaceChildren();
      const L = st.last;
      svg.append(s('circle', { cx: 50, cy: 15, r: 8, class: 's-panel', 'stroke-width': 2 }),
        s('path', { d: 'M36 40 Q36 25 50 25 Q64 25 64 40 Z', class: 's-panel', 'stroke-width': 2 }),
        s('text', { x: 72, y: 34, 'font-size': 15, 'font-weight': 800 }, 'You (the user)'),
        s('rect', { x: 10, y: 62, width: 580, height: 60, rx: 12, class: 's-os', 'stroke-width': 2 }),
        s('text', { x: 300, y: 84, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, 'Operating system'),
        s('text', { x: 300, y: 103, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, 'creates processes · carries messages between them'));
      st.procs.forEach((p, i) => {
        const x = SLOT[i], fresh = L && L.kind === 'create' && L.slot === i;
        svg.append(p
          ? s('g', {}, s('rect', { x, y: 160, width: 170, height: 76, rx: 12, class: 's-proc', 'stroke-width': fresh ? 3.5 : 2 }),
            s('text', { x: x + 85, y: 186, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, p.name),
            s('text', { x: x + 85, y: 206, 'text-anchor': 'middle', 'font-size': 13.5 }, 'PID ' + p.pid),
            s('text', { x: x + 85, y: 226, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'private memory'))
          : s('g', {}, s('rect', { x, y: 160, width: 170, height: 76, rx: 12, class: 's-muted', 'stroke-dasharray': '6 5' }),
            s('text', { x: x + 85, y: 203, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, '(no process)')));
      });
      if (L && L.kind === 'create') {
        const cx = SLOT[L.slot] + 85;
        svg.append(s('line', { x1: 50, y1: 42, x2: 50, y2: 59, class: 's-line', 'marker-end': 'url(#arr-os)' }),
          s('text', { x: 62, y: 56, 'font-size': 13.5, 'font-weight': 700, style: 'fill:var(--os)' }, 'double-click'),
          s('line', { x1: cx, y1: 122, x2: cx, y2: 156, style: 'stroke:var(--os)', 'stroke-width': 3, 'marker-end': 'url(#arr-os)' }),
          s('text', { x: cx + 8, y: 144, 'font-size': 13.5, 'font-weight': 800, class: 'halo', style: 'fill:var(--os)' }, 'create'));
      }
      if (L && L.kind === 'msg') {
        const a = SLOT[L.from] + 85, b = SLOT[L.to] + 85;
        svg.append(s('path', { d: `M${a} 160 V113 H${b} V156`, fill: 'none', style: 'stroke:var(--proc)', 'stroke-width': 3, 'marker-end': 'url(#arr-proc)' }),
          s('rect', { x: (a + b) / 2 - 62, y: 128, width: 124, height: 24, rx: 6, class: 's-proc', 'stroke-width': 1.5 }),
          s('text', { x: (a + b) / 2, y: 145, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, L.text));
      }
    }
    const add = (line) => { log.append(h('div', {}, line)); while (log.children.length > 3) log.firstChild.remove(); };
    function open(name) {
      if (slotOf(name) >= 0) { say.innerHTML = `${name} is already running. (A second copy would be a second process: step 4 shows that.)`; return; }
      const i = st.procs.findIndex((p) => !p);
      const pid = st.next++;
      st.procs[i] = { name, pid };
      st.last = { kind: 'create', slot: i };
      add(`you open ${name} → OS creates PID ${pid}`);
      say.innerHTML = `You asked for a program, so the OS <b>created a process</b> for it: new identifier (PID ${pid}), its own memory, its own record. That is user creation of processes.`;
      draw();
    }
    function send(fromName, toName, text) {
      const f = slotOf(fromName), t = slotOf(toName);
      if (f < 0 || t < 0) { say.innerHTML = 'Open <b>both</b> the Editor and the Speller first: a message needs a sender and a receiver.'; return; }
      st.last = { kind: 'msg', from: f, to: t, text };
      add(`${fromName} → OS → ${toName}: ${text}`);
      say.innerHTML = `${fromName} cannot write into ${toName}’s private memory, so it hands the message to the OS, which delivers it. That is <span class="t">interprocess communication (IPC)</span>.`;
      draw();
    }
    const btns = h('div', { class: 'row', style: { gap: '6px' } },
      h('button', { class: 'btn sm proc', type: 'button', onclick: () => open('Editor') }, 'Open the Editor'),
      h('button', { class: 'btn sm proc', type: 'button', onclick: () => open('Speller') }, 'Open the Speller'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => send('Editor', 'Speller', '“teh cat”?') }, 'Editor → Speller'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => send('Speller', 'Editor', '“the cat”') }, 'Speller → Editor'),
      h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset'));
    reset();
    const text = h('div', { class: 'stack', style: { gap: '8px' }, html: `
      <h3 class="m0">Duty 3 · Let processes talk, and let users create them</h3>
      <p class="m0">Programs often cooperate: an editor asks a spell checker about a word, a browser tab asks a network helper for a page. The OS keeps each process’s memory private, so it must provide <span class="t">interprocess communication (IPC)</span>: a controlled door between processes.</p>
      <p class="m0">Users, and programs, must also be able to <b>create</b> new processes. Double-clicking an icon or typing a command is a request to the OS to start one.</p>
      <div class="callout why m0" data-label="Why it matters">Privacy between processes keeps one buggy program from corrupting another. IPC lets them cooperate anyway, on the OS’s terms.</div>` });
    panel.append(h('div', { class: 'split l fill' }, text, h('div', { class: 'stack', style: { gap: '8px' } }, btns, h('div', { class: 'card white', style: { padding: '8px 12px' } }, svg), say, log)));
  }

  /* ------------------------------------------------------------------
     Steps 5 and 7: the eight PCB elements, with plain explanations and
     the kitchen-ticket analogy, plus the frames of a toy process (PID 42)
     whose PCB changes as it runs. cpu = live processor values or null.
     Processor time grows only while Running; clock time always grows.
     ------------------------------------------------------------------ */
  const FIELDS = [
    ['id', 'Identifier', 'A unique number for this process, its <span class="t">process identifier (PID)</span>.', 'Two processes can run the same program. The OS, and other processes, need a way to name exactly one of them.', 'The order number. Two tables may both order lasagna, but ticket 42 means exactly one of those dishes.'],
    ['state', 'State', 'Where the process stands right now, for example New, Ready, Running or Blocked (its <span class="t">process state</span>).', 'It tells the OS what the process may do next: only a process that is ready can be given the processor. Section 3.2 is all about states.', '“Waiting for a burner”, “on the stove”, “waiting for the oven”, “served”.'],
    ['prio', 'Priority', 'How important this process is compared with the others (its <span class="t">priority</span>).', 'When several processes want the processor or a resource, the OS’s policy may serve the higher priority first.', 'A rush flag: this table has a train to catch.'],
    ['pc', 'Program counter', 'The address of the <b>next instruction</b> the process will execute (its saved <span class="t">program counter (PC)</span>).', 'Without it the OS could not restart the process at the right place after pausing it.', 'Which step of the recipe comes next.'],
    ['mem', 'Memory pointers', 'Where the process’s program code and data are in memory, plus any memory blocks it shares with other processes (<span class="t">memory pointers</span>).', 'The OS must find, protect and eventually free that memory.', 'Which shelf and which pans hold this order’s ingredients.'],
    ['ctx', 'Context data', 'The contents of the processor registers while the process is running (<span class="t">context data</span>).', 'Every process uses the same registers. Their values must be saved when the process stops and restored when it restarts.', 'What is in the pans at this moment: the half-made sauce.'],
    ['io', 'I/O status information', 'Outstanding I/O requests, the I/O devices assigned to the process, and the files it has in use (<span class="t">I/O status information</span>).', 'The OS must finish, cancel or clean these up, and it explains why a process is waiting.', '“Waiting on the oven; borrowed the big mixer.”'],
    ['acct', 'Accounting information', 'Processor time and clock time used so far, time limits, account numbers and similar (<span class="t">accounting information</span>).', 'For billing, for enforcing limits, for scheduling decisions and for statistics.', 'How long the order has been in the kitchen, and which table pays.'],
  ];
  const MEM0 = 'code 0x5000–0x57FF · data 0x9000–0x9FFF';
  const LIVE = 'in the processor now';
  const PCB_FRAMES = [
    { v: { id: '42', state: 'New', prio: 'normal', pc: '0x5000 (first instruction)', mem: MEM0, ctx: 'starting values: R1 = 0, R2 = 0', io: 'none', acct: 'CPU 0 ms · clock 0 ms · limit 2 s · acct lab-17' }, cpu: null,
      cap: '<b>Created.</b> You ask to shrink a photo. The OS gives the new process a unique identifier, 42, and fills in its PCB before running a single instruction.' },
    { v: { state: 'Ready', acct: 'CPU 0 ms · clock 1 ms · limit 2 s · acct lab-17' }, cpu: null,
      cap: '<b>Admitted.</b> The OS accepts the new process and marks it Ready: it could run the moment the processor is free. Clock time has started; processor time is still 0.' },
    { v: { state: 'Running', pc: LIVE, ctx: LIVE, acct: 'CPU 0 ms · clock 2 ms · limit 2 s · acct lab-17' }, cpu: ['0x5000', 0, 0],
      cap: '<b>Running.</b> The OS picks 42 and copies the PC and register values from its PCB into the processor. While 42 runs, the live values sit in the processor, not in the PCB.' },
    { v: { io: 'files in use: photo.jpg', acct: 'CPU 3 ms · clock 5 ms · limit 2 s · acct lab-17' }, cpu: ['0x5010', 3, 0],
      cap: 'The process opens <i>photo.jpg</i>. The OS records the open file in the I/O status information, so it can close the file later, even if the process crashes.' },
    { v: { mem: MEM0 + ' · shared: preview block', acct: 'CPU 5 ms · clock 7 ms · limit 2 s · acct lab-17' }, cpu: ['0x5024', 3, 4096],
      cap: 'It sets up a <b>memory block shared</b> with the photo viewer, so the viewer can show a preview. The memory pointers now list that shared block as well.' },
    { v: { state: 'Blocked (waiting for disk)', pc: '0x5028 (saved)', ctx: 'saved: R1 = 3, R2 = 4096', io: 'outstanding: read photo.jpg · files: photo.jpg', acct: 'CPU 6 ms · clock 8 ms · limit 2 s · acct lab-17' }, cpu: null,
      cap: '<b>Waits for the disk.</b> It asks to read the photo, which takes a while. The OS saves the PC and registers into the PCB, notes the outstanding request, and gives the processor to another process.' },
    { v: { state: 'Ready', prio: 'high (you are watching it)', io: 'files in use: photo.jpg', acct: 'CPU 6 ms · clock 20 ms · limit 2 s · acct lab-17' }, cpu: null,
      cap: '<b>Disk done.</b> An interrupt tells the OS the data arrived, so the request leaves the I/O status and the state becomes Ready. You click its window, so the OS raises its priority. Clock time grew; processor time did not.' },
    { v: { state: 'Running', pc: LIVE, ctx: LIVE, acct: 'CPU 6 ms · clock 23 ms · limit 2 s · acct lab-17' }, cpu: ['0x5028', 3, 4096],
      cap: '<b>Resumed.</b> The OS copies the saved PC (0x5028) and registers (3 and 4096) back into the processor. The process carries on exactly where it stopped.' },
    { v: { io: 'files in use: photo.jpg, small.jpg', acct: 'CPU 14 ms · clock 31 ms · limit 2 s · acct lab-17' }, cpu: ['0x5064', 4, 1024],
      cap: 'It shrinks the image and writes <i>small.jpg</i>. Another file joins the I/O status, and processor time keeps climbing while it runs.' },
    { v: { state: 'Exit', pc: '(finished)', ctx: '(no longer needed)', io: 'all files closed', mem: 'released', acct: 'CPU 15 ms · clock 32 ms · limit 2 s · acct lab-17' }, cpu: null,
      cap: '<b>Finished.</b> The OS closes its files and frees its memory, and keeps the accounting totals: 15 ms of processor time over 32 ms of clock time. Then the PCB itself is deleted.' },
  ];
  // expand the "only what changed" frames above into complete snapshots
  PCB_FRAMES.forEach((f, i) => { f.full = Object.assign({}, i ? PCB_FRAMES[i - 1].full : {}, f.v); });

  /* ------------------------------------------------------------------
     Step 6: interrupt and resume. Process A adds 17 + 40; process B
     doubles 9. full = true: the OS saves PC + registers (context data)
     in the PCB. full = false: a broken OS that saves only the PC, so
     the processes pick up each other's leftover register values.
     cpu = [PC, R1, R2]; A / B = PCB contents [state, PC, R1, R2].
     ------------------------------------------------------------------ */
  const CODE_A = `
1200  R1 = 17;      // put 17 in R1
1204  R2 = 40;      // put 40 in R2
1208  R1 = R1 + R2; // add R2 into R1
120C  total = R1;   // save the sum`;
  const CODE_B = `
3300  R1 = 5;       // put 5 in R1
3304  R2 = 9;       // put 9 in R2
3308  R2 = R2 * 2;  // double R2
330C  count = R2;   // save the result`;
  function resumeFrames(full) {
    const IN = 'in processor', NS = 'not saved';
    const sv = (st, pc, r1, r2) => (full ? [st, pc, String(r1), String(r2)] : [st, pc, NS, NS]);
    const run = (st) => [st, IN, IN, IN];
    const bad = (v) => `<b style="color:var(--bad)">${v}</b>`, good = (v) => `<b style="color:var(--ok)">${v}</b>`;
    const r2B = full ? 18 : 80, r2A = full ? 40 : 80, sum = full ? 57 : 97;
    return [
      { who: 'A', cpu: ['0x1200', 0, 0], A: run('Running'), B: sv('Ready', '0x3308', 5, 9), total: '—',
        cap: '<b>A is running.</b> Its live program counter and registers are in the processor. B is waiting; ' + (full ? 'its PCB holds the PC and registers saved when it last stopped.' : 'this OS saved only its program counter.') },
      { who: 'A', cpu: ['0x1204', 17, 0], A: run('Running'), B: sv('Ready', '0x3308', 5, 9), total: '—',
        cap: 'A executes <code>R1 = 17</code>. Its program counter moves on to 0x1204.' },
      { who: 'A', cpu: ['0x1208', 17, 40], A: run('Running'), B: sv('Ready', '0x3308', 5, 9), total: '—',
        cap: 'A executes <code>R2 = 40</code>. The next instruction A needs is at 0x1208.' },
      { who: 'OS', intr: true, cpu: ['OS', 17, 40], A: ['Running', 'set aside by hardware', IN, IN], B: sv('Ready', '0x3308', 5, 9), total: '—',
        cap: '<b style="color:var(--intr)">Interrupt!</b> The timer says A’s time slice is over. The processor finishes A’s current instruction, sets A’s program counter (0x1208) aside, and jumps into the OS. R1 and R2 still hold A’s values.' },
      { who: 'OS', cpu: ['OS', 17, 40], A: sv('Ready', '0x1208', 17, 40), B: sv('Ready', '0x3308', 5, 9), total: '—',
        cap: full ? '<b>Save A.</b> The OS copies A’s program counter (0x1208) <b>and</b> the registers (17 and 40) into A’s PCB, and marks A Ready.'
          : '<b>Save A, PC only.</b> This OS copies just A’s program counter (0x1208) into A’s PCB. The values 17 and 40 stay behind in the registers.' },
      { who: 'B', cpu: full ? ['0x3308', 5, 9] : ['0x3308', 17, 40], A: sv('Ready', '0x1208', 17, 40), B: run('Running'), total: '—',
        cap: full ? '<b>Restore B.</b> The OS copies B’s saved values into the processor: PC 0x3308, R1 = 5, R2 = 9. B is running again.'
          : '<b>Restore B, PC only.</b> The OS loads B’s PC, 0x3308. But the registers still hold A’s 17 and 40, not B’s 5 and 9.' },
      { who: 'B', cpu: full ? ['0x330C', 5, 18] : ['0x330C', 17, 80], A: sv('Ready', '0x1208', 17, 40), B: run('Running'), total: '—',
        cap: full ? 'B executes <code>R2 = R2 * 2</code>: 9 × 2 = ' + good(18) + '. B overwrites R2 freely, because A’s 40 is safe in A’s PCB.'
          : 'B executes <code>R2 = R2 * 2</code> on the wrong value: 40 × 2 = ' + bad(80) + ' instead of 18.' },
      { who: 'OS', intr: true, cpu: full ? ['OS', 5, 18] : ['OS', 17, 80], A: sv('Ready', '0x1208', 17, 40), B: sv('Ready', '0x330C', 5, r2B), total: '—',
        cap: full ? '<b style="color:var(--intr)">Interrupt, save B.</b> The timer fires again and the processor jumps into the OS, which saves B’s PC (0x330C) and registers (5 and 18) in B’s PCB and marks B Ready.'
          : '<b style="color:var(--intr)">Interrupt, save B, PC only.</b> The timer fires again and the OS saves only B’s PC, 0x330C. The registers keep 17 and 80.' },
      { who: 'A', cpu: ['0x1208', 17, r2A], A: run('Running'), B: sv('Ready', '0x330C', 5, r2B), total: '—',
        cap: full ? '<b>Restore A.</b> The OS copies A’s saved values back: PC 0x1208, R1 = 17, R2 = 40. The processor is exactly as A left it.'
          : '<b>Restore A, PC only.</b> A restarts at the right instruction, 0x1208, but R2 holds 80, B’s leftover, not A’s 40.' },
      { who: 'A', cpu: ['0x120C', sum, r2A], A: run('Running'), B: sv('Ready', '0x330C', 5, r2B), total: '—',
        cap: 'A executes <code>R1 = R1 + R2</code>: ' + (full ? '17 + 40 = ' + good(57) + '. Correct.' : '17 + 80 = ' + bad(97) + '. Wrong.') },
      { who: 'A', cpu: ['0x1210', sum, r2A], A: run('Running'), B: sv('Ready', '0x330C', 5, r2B), total: String(sum), end: true,
        cap: full ? good('total = 57.') + ' A finished correctly and never noticed the interruption. Saving the PC <b>and</b> the context data in the PCB made that possible.'
          : bad('total = 97.') + ' Both processes computed wrong values (A got 97, B got 80), and neither can tell. Resuming correctly needs the PC <b>and</b> the context data: that is why both live in the PCB.' },
    ];
  }


  Guide.section({
    id: '3.1',
    title: 'What Is a Process?',
    short: 'What is a process?',
    summary: 'Why the OS thinks in processes, what a process is, and the control block that lets it pause and resume one.',
    objectives: [
      'Explain why an OS stands between applications and hardware, and state its three process-level duties.',
      'Define a process in four complementary ways and tell a process apart from a program.',
      'Name the two essential elements of a running program and the eight elements of a process control block.',
      'Trace how the process control block lets the OS interrupt a process and resume it exactly where it stopped.',
      'Pick the PCB element the OS would consult to answer a given question about a process.',
    ],
    terms: [
      ['Process', 'A program in execution: one running instance of a program, together with its data, its current state and the resources the OS has given it. It is the unit the OS schedules and manages.'],
      ['Program', 'A passive set of instructions stored in a file. It does nothing by itself until the OS loads it and starts a process to run it.'],
      ['Process control block (PCB)', 'The record the OS creates and maintains for each process. It holds the identifier, state, priority, program counter, memory pointers, context data, I/O status information and accounting information.'],
      ['Process identifier (PID)', 'A unique number the OS gives each process so it can tell it apart from every other process, even ones running the same program.'],
      ['Program counter (PC)', 'The processor register, and the PCB field that saves it, holding the address of the next instruction the process will execute.'],
      ['Context data', 'The values in the processor registers while a process runs. The OS copies them into the PCB when the process stops, so they can be put back later.'],
      ['Memory pointers', 'PCB entries that record where the process’s program code and data sit in memory, plus any memory blocks it shares with other processes.'],
      ['I/O status information', 'The PCB part that lists a process’s outstanding I/O requests, the I/O devices assigned to it and the files it has in use.'],
      ['Accounting information', 'The PCB part that records how much processor time and clock time a process has used, its time limits, its account numbers and similar bookkeeping.'],
      ['Priority', 'A level that says how important a process is compared with the others. The OS uses it to decide who gets the processor or a resource first.'],
      ['Processor utilization', 'The fraction of time the processor spends doing useful work instead of sitting idle, usually given as a percentage.'],
      ['Response time', 'How long a user waits between making a request (a click, a keystroke) and seeing the result.'],
      ['Time slice', 'A short, fixed amount of processor time a process may use before the OS switches the processor to another process.'],
      ['Interleaving', 'Running pieces of several processes one after another on one processor, switching between them so that all of them make progress.'],
      ['Deadlock', 'A standstill in which two or more processes each hold a resource another one needs, so every one of them waits forever.'],
      ['Interprocess communication (IPC)', 'Any OS-provided way for processes to exchange data or signals, such as messages, pipes or a shared block of memory.'],
      ['Abstraction', 'A simplified, tidy view of something complicated. The OS shows applications files instead of disk blocks, and processes instead of raw processor time.'],
      ['Shared code', 'Program instructions kept in memory once and used by several processes at the same time. It is safe because running code only reads its instructions and never changes them.'],
      ['Interrupt', 'A signal that makes the processor stop the current program between two instructions and run an OS routine, for example when a timer expires or a device finishes.'],
      ['Process state', 'The condition a process is in right now, such as Running, Ready or Blocked. The PCB records it so the OS knows what the process can do next.'],
    ],

    css: `
      .sec-3-1 .hot { cursor: pointer; }
      .sec-3-1 .hot:hover rect, .sec-3-1 .hot:hover path.hitbox { stroke-width: 3.5; }
      .sec-3-1 .info { background: var(--panel-2); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; font-size: 15.5px; line-height: 1.45; }
      .sec-3-1 .info h4 { margin: 0 0 2px; }
      .sec-3-1 .info p { margin: 0 0 6px; }
      .sec-3-1 .info p:last-child { margin: 0; }
      .sec-3-1 .eq { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; font-weight: 800; font-size: 17px; }
      .sec-3-1 .eq .box { padding: 5px 12px; }
      .sec-3-1 .halo { paint-order: stroke; stroke: var(--panel); stroke-width: 5px; stroke-linejoin: round; }
      .sec-3-1 .player-cap { min-height: 70px; }
      .sec-3-1 .lens { display: grid; grid-template-columns: 26px 1fr; gap: 8px; align-items: start; text-align: left; width: 100%; padding: 8px 12px; border-radius: 12px; border: 2px solid var(--line); background: var(--panel); cursor: pointer; font-size: 15px; line-height: 1.35; color: var(--ink); }
      .sec-3-1 .lens:hover { border-color: var(--proc); }
      .sec-3-1 .lens b { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; background: var(--proc-bg); color: var(--proc); font-size: 13px; }
      .sec-3-1 .lens.on { border-color: var(--proc); background: var(--proc-bg); }
      .sec-3-1 .lens.on b { background: var(--proc); color: var(--panel); }
      .sec-3-1 svg .part { transition: opacity .25s; }
      .sec-3-1 .cmp tr.rowbtn { cursor: pointer; }
      .sec-3-1 .cmp tr.rowbtn:hover td { background: var(--panel-2); }
      .sec-3-1 .cmp td { vertical-align: middle; }
      .sec-3-1 .cmp { table-layout: fixed; }
      .sec-3-1 .cmp th:nth-child(1) { width: 25%; } .sec-3-1 .cmp th:nth-child(2), .sec-3-1 .cmp th:nth-child(3) { width: 26%; }
      .sec-3-1 svg .lit rect, .sec-3-1 svg .lit path { stroke: var(--accent) !important; stroke-width: 4 !important; }
      .sec-3-1 svg .lit text { fill: var(--accent) !important; font-weight: 800; }
      .sec-3-1 .pcb { display: flex; flex-direction: column; gap: 4px; }
      .sec-3-1 .pcb-head { display: flex; justify-content: space-between; align-items: baseline; padding: 2px 4px 6px; border-bottom: 2px solid var(--os); margin-bottom: 4px; color: var(--os); }
      .sec-3-1 .pf { display: grid; grid-template-columns: 190px 1fr; gap: 10px; align-items: center; padding: 6px 10px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); cursor: pointer; font-size: 15px; line-height: 1.3; min-height: 44px; }
      .sec-3-1 .pcb.narrow .pf { grid-template-columns: 1fr; gap: 2px; }
      .sec-3-1 .pf:hover { border-color: var(--os); }
      .sec-3-1 .pf.sel { border-color: var(--os); background: var(--os-bg); }
      .sec-3-1 .pf .pl { font-weight: 800; }
      .sec-3-1 .pf .pv { font-family: var(--mono); font-size: 13.5px; color: var(--ink-2); }
      .sec-3-1 .pf .pv.live { color: var(--cpu); font-style: italic; }
      .sec-3-1 .pf.chg .pl::after { content: ' •'; color: var(--warn); }
      .sec-3-1 .reg { background: var(--panel); border: 2px solid var(--cpu); border-radius: 10px; padding: 4px 6px; }
      .sec-3-1 .reg .rv { font-family: var(--mono); font-weight: 800; font-size: 19px; color: var(--ink); }
      .sec-3-1 .rs td { padding: 3px 8px; font-size: 14px; }
      .sec-3-1 .rs td:first-child { width: 34%; }
      .sec-3-1 .rs td.flash, .sec-3-1 .reg.flash { animation: flash 1s ease; }
      .sec-3-1 pre.code .addr { color: var(--muted); font-weight: 700; }
      .sec-3-1 .qtext { font-size: 21px; font-weight: 700; line-height: 1.4; }
      .sec-3-1 .fbtn { height: 78px; border-radius: 12px; border: 2px solid var(--line-2); background: var(--panel); color: var(--ink); font-size: 16.5px; font-weight: 750; cursor: pointer; padding: 0 12px; }
      .sec-3-1 .fbtn:hover:not(:disabled) { border-color: var(--os); color: var(--os); }
      .sec-3-1 .fbtn:disabled { cursor: default; opacity: .5; }
      .sec-3-1 .fbtn.right { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); opacity: 1; }
      .sec-3-1 .fbtn.wrong { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); opacity: .8; }
      .sec-3-1 .qd { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line-2); background: transparent; }
      .sec-3-1 .qd.cur { border-color: var(--chc); }
      .sec-3-1 .qd.ok { background: var(--ok); border-color: var(--ok); }
      .sec-3-1 .qd.late { background: var(--warn); border-color: var(--warn); }
    `,

    steps: [
      /* ---------------- 1. Big picture: hardware, applications and the OS in between ---------------- */
      {
        title: 'Many programs, one machine: why processes exist',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          const left = h('div', { class: 'stack', html: `
            <p class="lead m0">A computer is a set of <b>hardware resources</b>: a processor, main memory, I/O modules, timers, disk drives and more. People want <b>applications</b>: a browser, a music player, a spreadsheet.</p>
            <p class="m0">Writing every application straight onto bare hardware would be wasteful and risky, so the OS stands in between. It gives applications a <b>convenient, rich, safe and consistent</b> interface and a tidy <span class="t">abstraction</span> of each resource.</p>
            <p class="m0">Many applications share one machine, so the OS must also referee who uses what. It keeps that bookkeeping per <span class="t">process</span>: one record for every running instance of a program.</p>
            <div class="callout analogy m0" data-label="Analogy">A busy kitchen. Cooks (applications) never rewire the ovens (hardware); the head chef (the OS) assigns stations and keeps one <b>order ticket</b> per dish in progress.</div>
            <p class="small muted m0"><b>Coming up:</b> what a process is, the record the OS keeps for each one, and how that record lets the OS pause a process and resume it perfectly.</p>` });

          // hardware resources: key, label, shape class, raw view, what the OS offers instead
          const HW = [
            ['cpu', 'Processor', 's-cpu', 'a circuit (or a few of them, called cores) that executes instructions one after another, from one program at a time.', 'the illusion that every program has its own processor, by switching between them very quickly.'],
            ['mem', 'Main memory', 's-mem', 'billions of numbered byte cells that any program could read or overwrite.', 'a private, protected region for each process, so programs cannot trample one another.'],
            ['io', 'I/O modules', 's-io', 'device controllers, each with its own status bits, data registers and command codes.', 'simple read and write calls that look the same for a keyboard, a network card or a screen.'],
            ['timer', 'Timer', 's-io', 'a counter that ticks down and raises an <span class="t">interrupt</span> when it reaches zero.', 'sleep calls, alarms and fair turns on the processor, so no program can hog it.'],
            ['disk', 'Disk drive', 's-io', 'numbered blocks on platters or flash chips, read and written by number.', 'named files in folders, opened and read with one call.'],
          ];
          const APPS = ['Browser', 'Music player', 'Spreadsheet'];
          const DEF = {
            without: '<b>Without an OS</b>, every application drives the hardware itself. Click any box to see what each one would have to handle alone, then switch to <b>With an OS</b>.',
            with: '<b>With an OS</b>, applications talk only to the OS, and the OS manages every resource for them. Click the violet OS layer or any box.',
          };
          let mode = 'without';
          const svg = s('svg', { viewBox: '0 0 640 278', width: '100%', role: 'img', 'aria-label': 'Applications, the operating system and the hardware resources', style: 'flex:none' });
          const info = h('div', { class: 'info grow', style: { minHeight: '104px' } });
          const say = (html) => { info.innerHTML = html; };

          const hwX = (i) => 14 + i * 125;           // 5 boxes, 112 wide, 13 apart
          const appX = (i) => 30 + i * 210;          // 3 boxes, 160 wide
          function tag(y, text) {
            return s('g', {}, s('rect', { x: 92, y, width: 456, height: 30, rx: 8, class: 's-bad', 'stroke-width': 1.5 }),
              s('text', { x: 320, y: y + 20, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, style: 'fill:var(--bad)' }, text));
          }
          function draw() {
            svg.replaceChildren();
            const wires = s('g');
            if (mode === 'without') {
              APPS.forEach((_, a) => HW.forEach((__, k) => wires.append(s('line', { x1: appX(a) + 80, y1: 54, x2: hwX(k) + 56, y2: 222, style: 'stroke:var(--bad);opacity:.45', 'stroke-width': 1.5 }))));
            } else {
              APPS.forEach((_, a) => wires.append(s('line', { x1: appX(a) + 80, y1: 54, x2: appX(a) + 80, y2: 94, class: 's-line', 'marker-end': 'url(#arr-os)' })));
              HW.forEach((_, k) => wires.append(s('line', { x1: hwX(k) + 56, y1: 174, x2: hwX(k) + 56, y2: 218, class: 's-line', 'marker-end': 'url(#arr-os)' })));
            }
            svg.append(wires);
            APPS.forEach((name, a) => {
              const g = s('g', { class: 'hot', 'data-k': 'app' + a },
                s('rect', { x: appX(a), y: 6, width: 160, height: 48, rx: 12, class: 's-proc', 'stroke-width': 2 }),
                s('text', { x: appX(a) + 80, y: 36, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, name));
              g.addEventListener('click', () => say(`<h4>Application: ${name}</h4><p>When you start it, the OS creates a <span class="t">process</span> to run it and keeps a record about that process. Every running application is at least one process.</p><p class="small muted">${mode === 'without' ? 'Here it must also carry its own code for every device it touches.' : 'It asks the OS for everything it needs: files, memory, processor time.'}</p>`));
              svg.append(g);
            });
            if (mode === 'without') {
              svg.append(tag(76, '✗ every app carries its own disk, screen and timer code'),
                tag(118, '✗ nothing stops one app overwriting another’s memory'),
                tag(160, '✗ two apps want the processor: who decides?'));
            } else {
              const os = s('g', { class: 'hot', 'data-k': 'os' },
                s('rect', { x: 14, y: 98, width: 612, height: 76, rx: 14, class: 's-os', 'stroke-width': 2.5 }),
                s('text', { x: 320, y: 128, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800 }, 'Operating system'),
                s('text', { x: 320, y: 154, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'one safe, consistent interface · referees every shared resource'));
              os.addEventListener('click', () => say('<h4>What the OS interface gives applications</h4><p><b>Convenient:</b> one simple call replaces dozens of device commands. <b>Rich:</b> many services, from files to networking. <b>Safe:</b> one program cannot wreck another or the hardware. <b>Consistent:</b> the same calls work on different machines.</p>'));
              svg.append(os);
            }
            HW.forEach(([key, label, cls, raw, offer], k) => {
              const g = s('g', { class: 'hot', 'data-k': key },
                s('rect', { x: hwX(k), y: 222, width: 112, height: 50, rx: 12, class: cls, 'stroke-width': 2 }),
                s('text', { x: hwX(k) + 56, y: 252, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, label));
              g.addEventListener('click', () => say(mode === 'without'
                ? `<h4>${label}, as raw hardware</h4><p>It is ${raw}</p><p class="small" style="color:var(--bad)"><b>Without an OS</b>, every application must speak this device’s language itself and must trust the others not to misuse it.</p>`
                : `<h4>${label}</h4><p><b>Raw hardware:</b> ${raw}</p><p><b>What the OS offers instead:</b> ${offer}</p>`));
              svg.append(g);
            });
          }
          const seg = ctx.ui.seg([{ value: 'without', label: 'Without an OS' }, { value: 'with', label: 'With an OS' }], mode, (v) => { mode = v; draw(); say(DEF[mode]); });
          draw(); say(DEF[mode]);
          const right = h('div', { class: 'card white stack', style: { gap: '8px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Who talks to the hardware?'), seg),
            svg, info);
          el.append(h('div', { class: 'split l fill' }, left, right));
        },
      },

      /* ---------------- 2. The three process-level duties (tabs; tab 1 = interleaving timeline) ---------------- */
      {
        title: 'Three duties the OS owes its processes',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          function interleave(panel) {
            let mode = 'rr', q = 2;
            const svg = s('svg', { viewBox: '0 0 640 186', width: '100%', role: 'img', 'aria-label': 'Timeline of three processes and the processor' });
            const stat = (label) => {
              const v = h('div', { class: 'big', style: { fontSize: '26px' } });
              return [h('div', { class: 'card tight center' }, h('div', { class: 'xs muted b' }, label), v), v];
            };
            const [c1, vUtil] = stat('Processor utilization'), [c2, vResp] = stat('C gets its answer at'), [c3, vTotal] = stat('Everything done at');
            const say = h('p', { class: 'small m0', style: { minHeight: '64px' } });
            const slider = ctx.ui.slider({ label: 'Time slice', min: 1, max: 6, value: q, format: (v) => v + (v === 1 ? ' unit' : ' units'), onInput: (v) => { q = v; draw(); } });
            slider.style.flex = '1';
            const seg = ctx.ui.seg([{ value: 'serial', label: 'One at a time' }, { value: 'rr', label: 'Interleaved' }], mode, (v) => { mode = v; draw(); });
            const X = (t) => 92 + t * 35;          // 15 time units fill 525 px
            function draw() {
              const r = schedule(mode, q);
              slider.style.opacity = mode === 'rr' ? 1 : 0.4;
              slider.input.disabled = mode !== 'rr';
              svg.replaceChildren();
              ['A', 'B', 'C'].forEach((id, row) => {
                const y = 4 + row * 36;
                svg.append(s('text', { x: 4, y: y + 20, 'font-size': 15, 'font-weight': 800 }, 'Process ' + id));
                for (const g of r.segs[id]) {
                  const w = (g.b - g.a) * 35 - 2, n = g.b - g.a;
                  svg.append(s('rect', { x: X(g.a) + 1, y, width: w, height: 28, rx: 6, class: g.kind === 'cpu' ? 's-proc' : g.kind === 'io' ? 's-io' : 's-panel', 'stroke-width': g.kind === 'cpu' ? 2 : 1.2, 'stroke-dasharray': g.kind === 'wait' ? '4 3' : null }));
                  if (n >= 2) svg.append(s('text', { x: X((g.a + g.b) / 2), y: y + 19, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': g.kind === 'wait' ? 400 : 700, class: g.kind === 'wait' ? 's-sub' : null }, g.kind === 'cpu' ? 'runs' : g.kind === 'io' ? (n >= 4 ? 'waits for disk' : 'disk') : (n >= 3 ? 'ready, waiting' : 'ready')));
                }
                svg.append(s('text', { x: X(r.fin[id]) + 4, y: y + 20, 'font-size': 14, 'font-weight': 900, style: 'fill:var(--ok)' }, '✓'));
              });
              const yc = 116;
              svg.append(s('text', { x: 4, y: yc + 20, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'Processor'));
              r.cpu.forEach((id, t) => svg.append(
                s('rect', { x: X(t) + 1, y: yc, width: 33, height: 28, rx: 5, class: id ? 's-cpu' : 's-bad', 'stroke-width': 1.5 }),
                s('text', { x: X(t) + 17.5, y: yc + 19, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: id ? '' : 'fill:var(--bad)' }, id || 'idle')));
              for (let t = 0; t <= 15; t++) {
                svg.append(s('line', { x1: X(t), y1: 150, x2: X(t), y2: 156, class: 's-line', 'stroke-width': 1 }),
                  s('text', { x: X(t), y: 172, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(t)));
              }
              svg.append(s('line', { x1: X(0), y1: 150, x2: X(15), y2: 150, class: 's-line', 'stroke-width': 1 }),
                s('text', { x: 4, y: 172, 'font-size': 13, class: 's-sub' }, 'time →'));
              const util = ctx.util.fmt((100 * r.busy) / r.total, 1), idle = r.total - r.busy;
              vUtil.textContent = util + '%';
              vUtil.style.color = idle ? 'var(--warn)' : 'var(--ok)';
              vResp.textContent = 't = ' + r.fin.C;
              vTotal.textContent = 't = ' + r.total;
              if (mode === 'serial') {
                say.innerHTML = `<b>One at a time.</b> Each process runs to the end before the next may start. While B waits for the disk nobody else may run, so the processor idles 4 units, and C, a one-unit job, waits until time 15. Utilization = 11 busy ÷ 15 total = <b>${util}%</b>.`;
              } else {
                say.innerHTML = `<b>Interleaved, slice = ${q}.</b> ` + (idle === 0
                  ? 'Whenever B stops to wait for the disk, another process takes the processor, so it never idles'
                  : `With long slices, at one point nothing is ready while B waits for the disk, so the processor idles ${idle} unit${idle > 1 ? 's' : ''}`) +
                  `: utilization = 11 ÷ ${r.total} = <b>${util}%</b>. C gets its answer at time ${r.fin.C}` +
                  (q === 1 ? '. Tiny slices answer fastest, but each real switch costs a little processor time (not shown here), so real systems choose a moderate slice.' : q <= 3 ? ', far sooner than the 15 it waits when jobs run one at a time.' : '. Shorter slices would answer C sooner.');
              }
            }
            const text = h('div', { class: 'stack', style: { gap: '9px' }, html: `
              <h3 class="m0">Duty 1 · Interleave processes</h3>
              <p class="m0">The OS must <span class="t" data-t="Interleaving">interleave</span> the execution of several processes: run one for a little while, then another, so that all of them make progress.</p>
              <p class="m0">The goal is to keep <span class="t">processor utilization</span> as high as possible (the processor is rarely idle) while giving a reasonable <span class="t">response time</span> (nobody waits long for an answer). The two can clash: switching more often answers people sooner, but every switch costs the processor a little work.</p>
              <div class="card tight small"><b>A</b> · a long calculation: 6 units of work<br><b>B</b> · 2 units, then waits 4 units for the disk, then 2 more<br><b>C</b> · echo one keystroke: 1 unit of work<br><span class="muted">Utilization = busy time ÷ total time</span></div>
              <div class="callout tip m0" data-label="Try it">Compare the two modes, then drag the <span class="t">time slice</span>. Keep an eye on how long C waits.</div>` });
            const legend = h('div', { class: 'row', style: { gap: '6px' } },
              h('span', { class: 'chip proc' }, 'runs on the processor'), h('span', { class: 'chip' }, 'ready, waiting its turn'),
              h('span', { class: 'chip io' }, 'waiting for the disk'), h('span', { class: 'chip bad' }, 'processor idle'));
            panel.append(h('div', { class: 'split l fill' }, text,
              h('div', { class: 'stack', style: { gap: '10px' } },
                // on a phone the toggle and slider cannot share one line (they would push 5px past the edge), so let them wrap
                h('div', { class: ctx.narrow ? 'row' : 'row nw' }, seg, slider),
                h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),
                legend, h('div', { class: 'grid-3' }, c1, c2, c3), say)));
            draw();
          }
          el.append(ctx.ui.tabs([
            { label: '1 · Interleave', render: interleave },
            { label: '2 · Allocate', render: dutyAllocate },
            { label: '3 · Communicate and create', render: dutyIPC },
          ]));
        },
      },

      /* ---------------- 3. Four definitions of a process (lenses light up the diagram) ---------------- */
      {
        title: 'Four ways to say what a process is',
        kind: 'learn',
        render(el, ctx) {
          const { h, s } = ctx;
          const LENS = [
            { def: 'A program in execution.', on: ['file', 'load21', 'p21', 'assign', 'cpu'],
              say: '<b>The shortest definition.</b> The program is the recipe on the shelf; the process is the cooking happening right now. Execution is what turns one into the other.' },
            { def: 'An instance of a program running on a computer.', on: ['file', 'load21', 'load22', 'p21', 'p22'],
              say: '<b>One program, many instances.</b> Open the same editor twice and the OS runs two separate processes from one file, each with its own data: cat.jpg in one, dog.jpg in the other.' },
            { def: 'The entity that can be assigned to and executed on a processor.', on: ['p21', 'p22', 'assign', 'cpu'],
              say: '<b>The OS’s point of view.</b> A process is the thing the OS picks and hands the processor to. Process 21 has it now; process 22 is Ready, so it is eligible too and waits its turn.' },
            { def: 'A unit of activity characterized by the execution of a sequence of instructions, a current state and an associated set of system resources.', on: ['trace', 'state21', 'res', 'p21'],
              say: '<b>Three things describe the activity:</b> the instructions it executes, in order (its <b>trace</b>: the list of instruction addresses it has run, bottom), where it stands right now (its state, “Running”), and what it holds (memory, an open file, a window).' },
          ];
          const svg = s('svg', { viewBox: '0 0 640 324', width: '100%', role: 'img', 'aria-label': 'A program file on disk, two processes in memory, the processor and resources' });
          const part = (id, ...kids) => s('g', { 'data-part': id, class: 'part' }, ...kids);
          const T = (x, y, str, o = {}) => s('text', Object.assign({ x, y, 'font-size': 14 }, o), str);
          const img = (id, y, pid, dataTxt, st) => part(id,
            s('rect', { x: 214, y, width: 236, height: 98, rx: 12, class: 's-proc', 'stroke-width': 2 }),
            T(226, y + 22, `Process ${pid} · photo-edit`, { 'font-size': 15, 'font-weight': 800 }),
            s('rect', { x: 226, y: y + 34, width: 96, height: 26, rx: 6, class: 's-panel' }), T(274, y + 52, 'code', { 'text-anchor': 'middle' }),
            s('rect', { x: 330, y: y + 34, width: 108, height: 26, rx: 6, class: 's-mem' }), T(384, y + 52, 'data: ' + dataTxt, { 'text-anchor': 'middle' }),
            part('state' + pid, T(226, y + 84, 'state: ', { class: 's-sub' }), T(270, y + 84, st, { 'font-weight': 800, style: 'fill:var(--proc)' })));
          svg.append(
            s('rect', { x: 8, y: 34, width: 160, height: 136, rx: 14, class: 's-io', 'stroke-width': 2 }), T(88, 56, 'Disk', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }),
            part('file', s('rect', { x: 22, y: 72, width: 132, height: 70, rx: 8, class: 's-panel', 'stroke-width': 2 }),
              T(88, 100, 'photo-edit', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }), T(88, 122, '(program file)', { 'text-anchor': 'middle', class: 's-sub' })),
            s('rect', { x: 200, y: 6, width: 264, height: 250, rx: 14, class: 's-mem', 'stroke-width': 2, style: 'fill:none' }), T(332, 26, 'Main memory', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, style: 'fill:var(--mem)' }),
            part('load21', s('path', { d: 'M154 96 C 180 90, 190 84, 210 82', fill: 'none', class: 's-line', 'marker-end': 'url(#arr)' })),
            part('load22', s('path', { d: 'M154 118 C 180 140, 190 176, 210 184', fill: 'none', class: 's-line', 'marker-end': 'url(#arr)' })),
            img('p21', 38, 21, 'cat.jpg', 'Running'), img('p22', 146, 22, 'dog.jpg', 'Ready'),
            part('assign', s('line', { x1: 452, y1: 86, x2: 484, y2: 86, style: 'stroke:var(--cpu)', 'stroke-width': 3, 'marker-end': 'url(#arr-cpu)' })),
            part('cpu', s('rect', { x: 488, y: 34, width: 146, height: 104, rx: 12, class: 's-cpu', 'stroke-width': 2 }),
              T(561, 56, 'Processor', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }), T(561, 82, 'executing', { 'text-anchor': 'middle', class: 's-sub' }),
              T(561, 104, 'process 21', { 'text-anchor': 'middle', 'font-weight': 800, style: 'fill:var(--proc)' }), T(561, 126, 'next: 0x40AC', { 'text-anchor': 'middle', class: 's-monot', 'font-size': 13 })),
            part('res', s('rect', { x: 488, y: 150, width: 146, height: 106, rx: 12, class: 's-io', 'stroke-width': 2 }),
              T(561, 172, 'Held by 21', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }),
              T(561, 196, 'its memory', { 'text-anchor': 'middle' }), T(561, 218, 'open file cat.jpg', { 'text-anchor': 'middle' }), T(561, 240, 'a window', { 'text-anchor': 'middle' })),
            part('trace', s('rect', { x: 8, y: 270, width: 626, height: 48, rx: 12, class: 's-panel', 'stroke-width': 2 }),
              T(22, 300, 'Trace of process 21:', { 'font-weight': 800 }),
              T(176, 300, '0x40A0 → 0x40A4 → 0x40A8 → (next) 0x40AC …', { class: 's-monot', 'font-size': 14.5 })));
          const info = h('div', { class: 'info', style: { minHeight: '80px' } });
          const btns = LENS.map((L, i) => h('button', { type: 'button', class: 'lens', onclick: () => pick(i) }, h('b', { class: 'num' }, String(i + 1)), h('span', {}, L.def)));
          function pick(i) {
            btns.forEach((b, j) => b.classList.toggle('on', i === j));
            const on = i == null ? null : new Set(LENS[i].on);
            svg.querySelectorAll('.part').forEach((g) => {
              const lit = !on || on.has(g.dataset.part) || [...on].some((p) => g.closest(`[data-part="${p}"]`));
              g.style.opacity = lit ? 1 : 0.22;
            });
            info.innerHTML = i == null ? '<b>Click a definition</b> on the left to light up the part of the picture it talks about. All four describe the same thing, a <span class="t">process</span>, from different angles.' : LENS[i].say;
          }
          pick(null);
          const left = h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'm0', html: 'Operating systems people use four standard definitions of a <span class="t">process</span>. Each is correct; each looks from a different angle.' }),
            ...btns,
            h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: '<b>A program is not a process.</b> A <span class="t">program</span> is passive: instructions sitting in a file. A process is that program in action, with its own data, state and resources. One program can run as several processes at once, and the OS schedules, protects and bills each of them separately.' }));
          const analogy = h('div', { class: 'callout analogy small m0', 'data-label': 'In the kitchen', html: 'The lasagna recipe card is the program. Two lasagnas being cooked from it tonight are two processes, each with its own pan of ingredients and its own order ticket.' });
          el.append(h('div', { class: 'split l fill' }, left, h('div', { class: 'card white stack', style: { gap: '10px' } }, svg, info, analogy)));
        },
      },

      /* ---------------- 4. Lab: one program, two processes (code shared; data, PCB, PC separate) ---------------- */
      {
        title: 'One program, two processes: what is shared?',
        kind: 'lab',
        render(el, ctx) {
          const { h, s } = ctx;
          const WORDS = { 101: ['Buy', 'milk', 'and', 'eggs', 'and', 'bread'], 102: ['Call', 'Sam', 'about', 'the', 'trip'] };
          const DATA_AT = { 101: '0x7000', 102: '0x9000' };
          const hex = (i) => '0x' + (0x2000 + 4 * i).toString(16).toUpperCase();
          let st, lit = null;
          const svg = s('svg', { viewBox: '0 0 480 470', width: '100%', role: 'img', 'aria-label': 'Memory map: shared code, separate data and PCBs' });
          const say = h('div', { class: 'info', style: { minHeight: '70px' } });
          const T = (x, y, str, o = {}) => s('text', Object.assign({ x, y, 'font-size': 14, 'text-anchor': 'middle' }, o), str);
          const reset = () => { st = { procs: [], n: { 101: 2, 102: 2 }, pc: { 101: 0, 102: 0 }, running: null }; say.innerHTML = 'Nothing is running yet. The program <b>notes</b> is just a file on the disk. Press <b>Launch notes</b>.'; paint(); };
          const has = (pid) => st.procs.includes(pid);
          const text = (pid) => WORDS[pid].slice(0, st.n[pid]).join(' ');
          const stateOf = (pid) => (st.running === pid ? 'Running' : 'Ready');
          function wrap(str, max) { const out = ['']; for (const w of str.split(' ')) { const L = out[out.length - 1]; if ((L + ' ' + w).trim().length > max) out.push(w); else out[out.length - 1] = (L + ' ' + w).trim(); } return out; }
          function draw() {
            svg.replaceChildren();
            const g = (id, ...k) => s('g', { class: lit === id ? 'lit' : '' }, ...k);
            const col = [14, 316];
            svg.append(g('file', s('rect', { x: 150, y: 4, width: 180, height: 52, rx: 10, class: 's-io', 'stroke-width': 2 }),
              T(240, 26, 'notes', { 'font-weight': 800, 'font-size': 15 }), T(240, 46, 'program file on disk', { class: 's-sub', 'font-size': 13 })));
            svg.append(s('rect', { x: 4, y: 72, width: 472, height: 394, rx: 14, class: 's-mem', style: 'fill:none', 'stroke-width': 2 }),
              T(14, 92, 'Main memory', { 'text-anchor': 'start', 'font-weight': 800, style: 'fill:var(--mem)' }));
            const loaded = st.procs.length > 0;
            if (loaded) svg.append(s('line', { x1: 240, y1: 56, x2: 240, y2: 100, style: 'stroke:var(--io)', 'stroke-width': 2.5, 'stroke-dasharray': '6 4', 'marker-end': 'url(#arr-io)' }),
              T(248, 90, 'loaded once', { 'text-anchor': 'start', 'font-size': 13, 'font-weight': 700, class: 'halo', style: 'fill:var(--io)' }));
            // shared code column
            svg.append(g('code', s('rect', { x: 178, y: 104, width: 124, height: 352, rx: 10, class: loaded ? 's-panel' : 's-muted', 'stroke-width': 2, 'stroke-dasharray': loaded ? null : '6 5' }),
              ...(loaded ? [T(240, 128, 'notes code', { 'font-weight': 800, 'font-size': 15 }), T(240, 148, 'one shared copy', { class: 's-sub', 'font-size': 13 }),
                ...Array.from({ length: 8 }, (_, i) => T(240, 190 + i * 34, hex(i), { class: 's-monot', 'font-size': 14 }))] : [T(240, 284, 'free', { class: 's-sub' })])));
            [101, 102].forEach((pid, k) => {
              const x = col[k], cx = x + 75, on = has(pid);
              if (!on) {
                svg.append(s('rect', { x, y: 104, width: 150, height: 120, rx: 10, class: 's-muted', 'stroke-dasharray': '6 5' }), T(cx, 168, 'free', { class: 's-sub' }),
                  s('rect', { x, y: 282, width: 150, height: 174, rx: 10, class: 's-muted', 'stroke-dasharray': '6 5' }), T(cx, 372, 'free', { class: 's-sub' }));
                return;
              }
              svg.append(g('pcb', s('rect', { x, y: 104, width: 150, height: 120, rx: 10, class: 's-os', 'stroke-width': 2 }),
                T(cx, 129, 'PCB ' + pid, { 'font-weight': 800, 'font-size': 15.5 }),
                g('state', T(cx, 154, 'state: ' + stateOf(pid), { 'font-size': 14 })),
                g('pc', st.running === pid
                  ? T(cx, 178, 'PC: live in processor', { 'font-size': 13, style: 'fill:var(--cpu)', 'font-style': 'italic' })
                  : T(cx, 178, 'PC: ' + hex(st.pc[pid]), { 'font-size': 14, class: 's-monot' })),
                T(cx, 202, 'data at ' + DATA_AT[pid], { 'font-size': 14, class: 's-sub' })));
              svg.append(g('data', s('rect', { x, y: 282, width: 150, height: 174, rx: 10, class: 's-mem', 'stroke-width': 2 }),
                T(cx, 307, 'data of ' + pid, { 'font-weight': 800, 'font-size': 15 }),
                ...wrap('“' + text(pid) + '”', 16).slice(0, 3).map((line, i) => T(cx, 340 + i * 24, line, { 'font-size': 14.5 })),
                T(cx, 440, 'words: ' + st.n[pid], { 'font-size': 13.5, class: 's-sub' })));
              // memory pointers: PCB → its data (down) and PCB → the shared code (sideways)
              const toCode = k === 0 ? [164, 150, 176, 150] : [316, 150, 304, 150];
              svg.append(s('line', { x1: cx, y1: 224, x2: cx, y2: 278, style: 'stroke:var(--proc)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-proc)' }),
                s('line', { x1: toCode[0], y1: toCode[1], x2: toCode[2], y2: toCode[3], style: 'stroke:var(--proc)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-proc)' }),
                T(cx + (k ? -8 : 8), 256, 'pointer', { 'text-anchor': k ? 'end' : 'start', 'font-size': 13, style: 'fill:var(--proc)', 'font-weight': 700 }));
              // this process's program counter, marked beside the shared code
              const y = 185 + st.pc[pid] * 34;
              svg.append(g('pc', s('path', { d: k === 0 ? `M184 ${y - 6} L194 ${y} L184 ${y + 6} Z` : `M296 ${y - 6} L286 ${y} L296 ${y + 6} Z`, style: 'fill:var(--proc)' })));
            });
          }
          // comparison table, with one column of actions per process
          const tbody = h('tbody');
          const ROWS = [
            ['file', 'Program it runs', (p) => 'notes', 'same program'],
            ['code', 'Code in memory', (p) => '0x2000–0x2FFF', 'shared, one copy'],
            ['data', 'Its data', (p) => '“' + text(p) + '”', 'separate'],
            ['pcb', 'Its PCB', (p) => 'PCB ' + p, 'separate'],
            ['pc', 'Program counter', (p) => hex(st.pc[p]), 'separate'],
            ['state', 'State', (p) => stateOf(p), 'separate'],
          ];
          const act = {};
          [101, 102].forEach((pid) => {
            act[pid] = [h('button', { class: 'btn sm', type: 'button', title: 'Type a word into this process’s note', onclick: () => type(pid) }, 'Type'),
              h('button', { class: 'btn sm', type: 'button', title: 'Run one instruction of this process', onclick: () => run(pid) }, 'Step')];
          });
          const launchBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => launch() }, 'Launch notes');
          function paintTable() {
            tbody.replaceChildren(...ROWS.map(([id, label, val, same]) => {
              const tr = h('tr', { class: 'rowbtn' + (lit === id ? ' on' : ''), onclick: () => { lit = lit === id ? null : id; paint(); } },
                h('td', { class: 'b' }, label),
                ...[101, 102].map((p) => h('td', { class: id === 'pc' ? 'mono' : '' }, has(p) ? val(p) : '—')),
                h('td', {}, st.procs.length === 2 ? h('span', { class: 'chip ' + (same === 'separate' ? 'proc' : 'ok') }, same) : '—'));
              return tr;
            }), h('tr', {}, h('td', { class: 'b' }, 'Try it'), ...[101, 102].map((p) => h('td', {}, h('div', { class: 'row', style: { gap: '4px', flexWrap: 'nowrap' } }, ...act[p]))), h('td')));
            [101, 102].forEach((p) => act[p].forEach((b) => (b.disabled = !has(p))));
            launchBtn.disabled = st.procs.length >= 2;
            launchBtn.textContent = st.procs.length === 0 ? 'Launch notes' : st.procs.length === 1 ? 'Launch notes again' : 'Two copies running';
          }
          function paint() { draw(); paintTable(); }
          function launch() {
            if (st.procs.length >= 2) return;
            const pid = st.procs.length ? 102 : 101;
            st.procs.push(pid);
            say.innerHTML = pid === 101
              ? 'The OS <b>loaded the code</b> into memory, gave process 101 its <b>own data area</b>, and built <b>PCB 101</b> to keep track of it. Now launch the same program again.'
              : 'The code is <b>already in memory</b>, so the OS does not load a second copy: PCB 102’s memory pointer aims at the same code. Only a new data area and a new PCB were created.';
            paint();
          }
          function type(pid) {
            if (st.n[pid] >= WORDS[pid].length) { say.innerHTML = `Process ${pid}’s note is full for this demo. Try the other process, or run an instruction.`; return; }
            // storing a keystroke means this process runs one instruction of the shared code, which writes into ITS data
            st.n[pid]++;
            st.pc[pid] = (st.pc[pid] + 1) % 8;
            st.running = pid;
            const o = pid === 101 ? 102 : 101;
            say.innerHTML = `Process ${pid} ran the shared code that stores a keystroke (its PC moved to ${hex(st.pc[pid])}), and only <b>its own data</b> changed.` + (has(o) ? ` Process ${o} still holds “${text(o)}”: same code, separate data.` : ' The code itself did not change: code is only read.');
            paint();
          }
          function run(pid) {
            const was = hex(st.pc[pid]);
            st.pc[pid] = (st.pc[pid] + 1) % 8;
            st.running = pid;
            const o = pid === 101 ? 102 : 101;
            say.innerHTML = `Process ${pid} executed the instruction at ${was}, so its program counter moved to <b>${hex(st.pc[pid])}</b>` + (st.pc[pid] === 0 ? ' (the editor loops back to the top)' : '') + '.' +
              (!has(o) ? '' : st.pc[o] === st.pc[pid] ? ` Process ${o}’s counter did not move; right now both happen to point at the same instruction, but each process keeps its own counter.` : ` Process ${o}’s counter did not move: two processes can be at different places in the same code.`);
            paint();
          }
          reset();
          const right = h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'm0', html: 'While a program runs, two <b>essential elements</b> exist: its <b>program code</b> (which may be <span class="t" data-t="Shared code">shared</span>) and the <b>set of data</b> that code works on. Launch one program twice and see which one gets copied. <b>Type</b> makes a process store one more word in its note; <b>Step</b> runs one of its instructions. Click a row to find it in the picture.' }),
            h('table', { class: 'tbl compact cmp' }, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Process 101'), h('th', {}, 'Process 102'), h('th', {}, 'Shared?'))), tbody),
            say,
            h('div', { class: 'eq' }, h('span', { class: 'box' }, 'program code'), '+', h('span', { class: 'box mem' }, 'data'), '+', h('span', { class: 'box os' }, 'PCB'), '=', h('span', { class: 'box proc' }, 'a process')));
          el.append(h('div', { class: 'split l fill' }, h('div', { class: 'card white stack', style: { padding: '10px 12px', gap: '6px' } },
            h('div', { class: 'row' }, launchBtn, h('button', { class: 'btn ghost', type: 'button', onclick: () => { lit = null; reset(); } }, 'Reset')), svg,
            h('p', { class: 'xs muted m0 center' }, '▶ marks the next instruction of 101, ◀ that of 102. While a process runs, its PC lives in the processor. Teal arrows are the memory pointers stored in each PCB.')), right));
        },
      },

      /* ---------------- 5. The PCB inspector: eight elements, live values ---------------- */
      {
        title: 'Inside the process control block',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          let sel = 'pc', frame = 0;
          const rows = {};
          const table = h('div', { class: 'pcb' + (ctx.narrow ? ' narrow' : '') });
          FIELDS.forEach(([key, label]) => {
            const val = h('span', { class: 'pv' });
            const row = h('div', { class: 'pf', role: 'button', tabindex: 0, 'data-k': key, onclick: () => select(key), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(key); } } },
              h('span', { class: 'pl' }, label), val);
            rows[key] = { row, val };
            table.append(row);
          });
          const detail = h('div', { class: 'info', style: { minHeight: '196px' } });
          const cpuBox = h('div', { class: 'card cpu tight' });
          function select(key) {
            sel = key;
            const [, label, holds, why, ticket] = FIELDS.find((f) => f[0] === key);
            Object.entries(rows).forEach(([k, r]) => r.row.classList.toggle('sel', k === key));
            detail.innerHTML = `<h4>${label}</h4><p><b>Holds:</b> ${holds}</p><p><b>Why the OS needs it:</b> ${why}</p><p class="small" style="color:var(--os)"><b>On the kitchen ticket:</b> ${ticket}</p>`;
          }
          function show(i) {
            frame = i;
            const f = PCB_FRAMES[i], prev = i ? PCB_FRAMES[i - 1].full : null;
            FIELDS.forEach(([key]) => {
              const r = rows[key];
              r.val.textContent = f.full[key];
              r.val.classList.toggle('live', f.full[key] === LIVE);
              r.row.classList.remove('flash', 'chg');
              if (prev && prev[key] !== f.full[key]) { void r.row.offsetWidth; r.row.classList.add('flash', 'chg'); }
            });
            cpuBox.innerHTML = f.cpu
              ? `<div class="xs b" style="color:var(--cpu)">PROCESSOR</div><div>running <b style="color:var(--proc)">process 42</b> · <span class="mono">PC ${f.cpu[0]} · R1 = ${f.cpu[1]} · R2 = ${f.cpu[2]}</span></div>`
              : `<div class="xs b" style="color:var(--cpu)">PROCESSOR</div><div class="muted">${i === PCB_FRAMES.length - 1 ? 'process 42 is gone; others run' : 'busy with another process; 42 is not running'}</div>`;
            return f.cap;
          }
          const player = ctx.ui.player({ count: PCB_FRAMES.length, render: show, interval: 2600, speed: false });
          select(sel);
          const left = h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'm0', html: 'For every process the OS creates a <span class="t">process control block (PCB)</span> and keeps it up to date. Only the OS reads and writes it. <b>Click any element</b> to learn what it holds; press <b>Play</b> to watch process 42 run. Changed values flash.' }),
            h('div', { class: 'card white', style: { padding: '8px 10px' } }, h('div', { class: 'pcb-head' }, h('b', {}, 'PCB · process 42'), h('span', { class: 'xs muted' }, 'kept by the OS in its own memory')), table));
          const mistake = h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'The PCB does not hold the program’s code or data. Its memory pointers only record <b>where</b> they are in memory.' });
          el.append(h('div', { class: 'split r fill' }, left, h('div', { class: 'stack', style: { gap: '10px' } }, detail, cpuBox, player.el, mistake)));
        },
      },

      /* ---------------- 6. Interrupt and resume: what the PCB makes possible ---------------- */
      {
        title: 'Interrupt, save, resume: the PCB’s big job',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          let full = true, frames = resumeFrames(true);
          const LBL = ['State', 'PC', 'R1', 'R2'];
          function procPanel(id, title, src) {
            const code = ctx.ui.code(src, { lang: 'c', nums: false, fontSize: 13 });
            // show the leading hex address of every line in one muted style (the highlighter colours only some of them)
            code.querySelectorAll('.ln').forEach((ln) => { ln.innerHTML = ln.innerHTML.replace(/^(?:<span class="tk-num">)?([0-9A-F]{4})(?:<\/span>)?/, '<span class="addr">$1</span>'); });
            const cells = LBL.map(() => h('td', { class: 'mono' }));
            const tbl = h('table', { class: 'tbl compact rs' }, h('tbody', {}, ...LBL.map((l, i) => h('tr', {}, h('td', { class: 'b' }, l), cells[i]))));
            const card = h('div', { class: 'card proc stack', style: { gap: '8px', padding: '10px 12px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, title), h('span', { class: 'xs muted b' }, 'highlight = PC')),
              code, h('div', { class: 'xs b', style: { color: 'var(--os)' } }, 'PCB ' + id + ' (saved by the OS)'), tbl);
            return { card, code, cells };
          }
          const A = procPanel('A', 'Process A · adds two numbers', CODE_A);
          const B = procPanel('B', 'Process B · doubles a number', CODE_B);
          const reg = LBL.slice(1).map((l) => { const v = h('div', { class: 'rv' }); return [h('div', { class: 'reg' }, h('div', { class: 'xs b muted' }, l), v), v]; });
          const who = h('div', { class: 'b', style: { fontSize: '18px' } });
          const banner = h('div', { class: 'chip intr', style: { visibility: 'hidden', fontSize: '14px' } }, 'INTERRUPT: timer expired');
          const mem = h('div', { class: 'small' });
          const cpu = h('div', { class: 'card cpu stack', style: { gap: '10px', padding: '12px 14px', alignItems: 'center', textAlign: 'center' } },
            h('b', { style: { color: 'var(--cpu)' } }, 'Processor'), who, banner,
            h('div', { class: 'grid-3', style: { width: '100%', gap: '8px' } }, ...reg.map((r) => r[0])),
            h('div', { class: 'xs muted' }, 'one set of registers, shared by every process'), mem);
          const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
          function show(i) {
            const f = frames[i], p = i ? frames[i - 1] : null;
            who.innerHTML = f.who === 'OS' ? '<span style="color:var(--os)">the OS is running</span>' : `running <span style="color:var(--proc)">process ${f.who}</span>`;
            // while the OS runs, the PC points into OS code; show that instead of a process address
            reg[0][0].title = f.cpu[0] === 'OS' ? 'The program counter now points into the operating system’s own code' : '';
            banner.style.visibility = f.intr ? 'visible' : 'hidden';
            reg.forEach(([box, v], k) => {
              v.textContent = String(f.cpu[k]);
              box.classList.remove('flash');
              if (p && p.cpu[k] !== f.cpu[k]) { void box.offsetWidth; box.classList.add('flash'); }
            });
            mem.innerHTML = 'memory: <span class="mono b">total = ' + f.total + '</span>' + (f.end ? (full ? ' <span class="chip ok">correct</span>' : ' <span class="chip bad">wrong</span>') : '');
            [[A, 'A', 0x1200], [B, 'B', 0x3300]].forEach(([P, id, base]) => {
              P.cells.forEach((c, k) => {
                const val = f[id][k];
                c.textContent = val;
                c.style.color = val === 'not saved' ? 'var(--bad)' : val === 'in processor' ? 'var(--cpu)' : '';
                c.classList.remove('flash');
                if (p && !same(p[id][k], val)) { void c.offsetWidth; c.classList.add('flash'); }
              });
              P.card.style.outline = f.who === id ? '3px solid var(--proc)' : 'none';
              P.code.clear();
              if (f.who === id) { const n = (parseInt(f.cpu[0], 16) - base) / 4 + 1; if (n >= 1 && n <= 4) P.code.mark(n); }
            });
            return f.cap;
          }
          const player = ctx.ui.player({ count: frames.length, render: show, interval: 2400 });
          const seg = ctx.ui.seg([{ value: true, label: 'OS saves PC + registers' }, { value: false, label: 'Broken OS: saves only the PC' }], full, (v) => { full = v; frames = resumeFrames(v); player.stop(); player.go(0); });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } },
              h('p', { class: 'm0', html: 'An <span class="t">interrupt</span> can stop a process between any two instructions. The highlighted line is the process’s next instruction (addresses in hex). Step through, then try the broken OS.' }), seg),
            h('div', { class: 'grid-3 grow', style: { gridTemplateColumns: '1.25fr 1fr 1.25fr', alignItems: 'start' } }, A.card, cpu, B.card),
            player.el));
        },
      },

      /* ---------------- 7. Lab: which PCB element would the OS read? ---------------- */
      {
        title: 'Which PCB element would the OS read?',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const SHORT = { id: 'a unique number that names the process', state: 'where it stands right now: ready, running, blocked…', prio: 'how important it is compared with the others',
            pc: 'the address of the next instruction', mem: 'where its code, data and shared blocks sit in memory', ctx: 'the saved contents of the processor registers',
            io: 'outstanding I/O requests, assigned devices and files in use', acct: 'processor and clock time used, time limits, account numbers' };
          const QS = [
            ['The OS is about to give this process the processor again. At which instruction should it continue?', 'pc', 'The program counter holds the address of the next instruction to execute.'],
            ['Is this process allowed to run right now, or is it stuck waiting for something?', 'state', 'The state field records Ready, Running, Blocked and so on.'],
            ['Two processes are ready at the same moment. Which one should the policy serve first?', 'prio', 'Priority records how important each process is relative to the others.'],
            ['At the end of the month, how much processor time should this user be billed for?', 'acct', 'Accounting information records the processor time used and the account to charge.'],
            ['This process just crashed. Which files must the OS close on its behalf?', 'io', 'I/O status information lists the files the process has in use.'],
            ['The process has ended. Which regions of memory can now be freed?', 'mem', 'Memory pointers record where its code and data, and any shared blocks, are.'],
            ['The process is about to resume. What did register R2 hold when it was interrupted?', 'ctx', 'Context data is the saved copy of the processor registers.'],
            ['Two copies of the same program are running. Exactly which one should get this “stop” request?', 'id', 'Only the unique identifier tells two processes running the same program apart.'],
            ['Has this job run past the time limit its owner was given?', 'acct', 'Time limits live in the accounting information, next to the time used so far.'],
            ['Which disk read request is this process still waiting on?', 'io', 'Outstanding I/O requests are part of the I/O status information.'],
          ];
          let k = 0, tries = 0, firstTry = 0, solved = false;
          const qNum = h('div', { class: 'xs b muted' });
          const qText = h('div', { class: 'qtext' });
          const fb = h('div', { class: 'info', style: { minHeight: '104px' } });
          const dots = h('div', { class: 'row', style: { gap: '6px' } });
          const score = h('span', { class: 'chip ok' });
          const next = h('button', { class: 'btn primary', type: 'button', onclick: () => go(k + 1) }, 'Next question');
          const again = h('button', { class: 'btn ghost', type: 'button', onclick: () => { firstTry = 0; results.fill(null); go(0); } }, 'Start over');
          const results = QS.map(() => null);
          const btns = FIELDS.map(([key, label]) => h('button', { type: 'button', class: 'fbtn', 'data-k': key, onclick: () => pick(key) }, label));
          function paintDots() {
            dots.replaceChildren(...QS.map((_, i) => h('span', { class: 'qd' + (i === k ? ' cur' : '') + (results[i] === true ? ' ok' : results[i] === false ? ' late' : '') })));
            score.textContent = firstTry + ' right on the first try';
          }
          function go(i) {
            if (i >= QS.length) {
              qNum.textContent = 'ALL DONE';
              qText.innerHTML = `You found the right PCB element on the first try <b>${firstTry} of ${QS.length}</b> times.`;
              fb.innerHTML = firstTry >= 8 ? '<b style="color:var(--ok)">Excellent.</b> You can already think like the OS: every question it asks about a process is answered by one element of the PCB.' : 'Review the elements you missed (the amber dots), then press <b>Start over</b> for a clean run.';
              btns.forEach((b) => { b.disabled = true; b.classList.remove('right', 'wrong'); });
              next.disabled = true; k = QS.length; paintDots(); return;
            }
            k = i; tries = 0; solved = false;
            qNum.textContent = `QUESTION ${k + 1} OF ${QS.length}`;
            qText.textContent = QS[k][0];
            fb.innerHTML = `Click the PCB element ${ctx.narrow ? 'below' : 'on the right'} that holds the answer.`;
            btns.forEach((b) => { b.disabled = false; b.classList.remove('right', 'wrong'); });
            next.disabled = true;
            paintDots();
          }
          function pick(key) {
            if (solved || k >= QS.length) return;
            const [, ans, why] = QS[k];
            const btn = btns.find((b) => b.dataset.k === key);
            const label = FIELDS.find((f) => f[0] === key)[1];
            if (key === ans) {
              solved = true;
              btn.classList.add('right');
              results[k] = tries === 0;
              if (tries === 0) firstTry++;
              fb.innerHTML = `<b style="color:var(--ok)">Yes: ${label}.</b> ${why}` + (tries === 0 ? ' Right on the first try.' : '');
              btns.forEach((b) => { if (b !== btn) b.disabled = true; });
              next.disabled = false;
              next.textContent = k === QS.length - 1 ? 'See my result' : 'Next question';
            } else {
              tries++;
              btn.classList.add('wrong'); btn.disabled = true;
              fb.innerHTML = `<b style="color:var(--bad)">Not that one.</b> ${label} holds ${SHORT[key]}. Which element would answer this question? Try again.`;
            }
            paintDots();
          }
          go(0);
          const left = h('div', { class: 'stack', style: { gap: '12px' } },
            h('p', { class: 'm0', html: 'Whenever the OS has a question about a process, it looks in that process’s <span class="t">PCB</span>. Your job: decide which element holds the answer. Amber dots mark questions that needed a second try.' }),
            h('div', { class: 'card white stack', style: { gap: '8px', minHeight: '150px' } }, qNum, qText),
            fb, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, dots, score),
            h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'The OS asks questions like these thousands of times a second. Because everything it needs about a process sits in that one record, a single lookup answers each one.' }));
          const right = h('div', { class: 'card os stack', style: { gap: '10px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { color: 'var(--os)' } }, 'Process control block'), h('span', { class: 'xs muted' }, 'click the element that answers it')),
            h('div', { class: 'grid-2', style: { gap: '10px' } }, ...btns),
            h('div', { class: 'row' }, next, again));
          el.append(h('div', { class: 'split fill' }, left, right));
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: six ideas to carry into the chapter',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill', style: { gap: '14px' } },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. Click again to flip it back.'),
            ctx.ui.flipcards([
              ['Program vs process', '<div>A <b>program</b> is passive code in a file. A <b>process</b> is a program in execution, with its own data, state, resources and PCB. One program can run as many processes.</div>'],
              ['Why put an OS between applications and hardware?', 'Writing apps for bare hardware is wasteful and unsafe. The OS offers a convenient, rich, safe, consistent interface and abstract resources, and it referees sharing.'],
              ['The OS’s three process-level duties', '<div>1. Interleave processes: high utilization, reasonable response time.<br>2. Allocate resources by policy, avoiding deadlock.<br>3. Support IPC and user creation of processes.</div>'],
              ['Two essential elements of a running program', '<div>Its <b>program code</b> (which several processes may share) and the <b>set of data</b> that code works on.</div>'],
              ['The eight elements of a PCB', 'Identifier, state, priority, program counter, memory pointers, context data, I/O status information, accounting information.'],
              ['How can a process be stopped and resumed?', 'The OS saves its program counter and context data in its PCB, runs others, then restores them. The process carries on as if never interrupted.'],
            ], { cols: 3, height: 176 }),
            h('div', { class: 'card white stack', style: { gap: '10px', padding: '12px 16px' } },
              h('div', { class: 'eq' }, h('span', { class: 'box' }, 'program code'), '+', h('span', { class: 'box mem' }, 'its data'), '+', h('span', { class: 'box os' }, 'PCB (kept by the OS)'), '=', h('span', { class: 'box proc' }, 'a process')),
              h('p', { class: 'small muted m0 center', html: '<b>Coming next:</b> section 3.2 follows the <b>State</b> element as a process moves between states, and 3.3 opens up everything the OS records about a process.' }))));
        },
      },

      /* ---------------- 9. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'What is the key difference between a program and a process?',
            choices: ['A program is stored on disk; a process is that same file copied into main memory, unchanged.', 'A program is passive instructions; a process is that program executing, with its own data, state and resources.', 'A program is written by its developers; a process is written by the operating system at run time.', 'There is no real difference: “process” is simply the operating system’s word for a program.'],
            answer: 1,
            feedback: ['Copying the code into memory is only part of it. A process is executing, and it has its own data, a current state, resources and a PCB.', null, 'The OS creates the process and its PCB, but it does not write the program; the process runs the program’s instructions.', 'They differ: one program can be running as several processes at once, each with its own data and PCB.'],
            why: 'A program is passive code. A process is an active instance of that code: executing, with its own data, state, resources and PCB.' },
          { q: 'While a program is executing, which two essential elements make it up?',
            choices: ['Program code and a set of data associated with that code', 'A process control block and an interrupt handler', 'A disk file and a timer', 'A priority and an identifier'],
            answer: 0,
            feedback: [null, 'The OS adds a PCB to manage the process, and interrupt handlers belong to the OS, not to the program.', 'The file is where the program is stored; a timer is hardware the OS uses. Neither is part of the running program.', 'Those are two elements of the PCB, the OS’s record about the process.'],
            why: 'A running program consists of its code (which several processes may share) and the data that code works on. The OS adds a PCB to manage it.' },
          { type: 'multi', q: 'Which of these are elements of a process control block? Select all that apply.',
            choices: ['Program counter', 'The full source code of the program', 'Accounting information', 'I/O status information', 'A copy of every other process’s registers', 'Priority'],
            answer: [0, 2, 3, 5],
            why: 'A PCB holds the identifier, state, priority, program counter, memory pointers, context data, I/O status information and accounting information. It points to the code in memory rather than storing it, and it holds only this process’s own register values.' },
          { type: 'match', q: 'Match each PCB element to what it holds.',
            pairs: [['Program counter', 'Address of the next instruction to execute'], ['Context data', 'Register contents while the process is running'], ['Memory pointers', 'Where the code, data and shared blocks are in memory'], ['Accounting information', 'Processor time used, time limits, account numbers'], ['Identifier', 'A unique number for this process']],
            why: 'Each element answers a different question the OS may ask about a process: where to continue, what the registers held, where its memory is, how much time it used, and which process it is.' },
          { q: 'After an interrupt, a process resumes at exactly the right instruction but computes a wrong result. Which PCB element did the OS most likely fail to save and restore?',
            choices: ['Program counter', 'Context data', 'Priority', 'Identifier'],
            answer: 1,
            feedback: ['The process restarted at the right instruction, so its program counter was saved and restored correctly.', null, 'Priority affects when a process runs, not the values it computes.', 'The identifier only names the process; it has no effect on its arithmetic.'],
            why: 'Context data is the saved copy of the processor registers. If it is not restored, the process continues with another process’s leftover register values.' },
          { q: 'Which of these is <b>not</b> one of the fundamental OS requirements expressed in terms of processes?',
            choices: ['Interleave the execution of multiple processes to maximize processor utilization while giving reasonable response time', 'Allocate resources to processes according to a specific policy while avoiding deadlock', 'Support interprocess communication and user creation of processes', 'Give every process an equal, fixed share of main memory'],
            answer: 3,
            feedback: ['This is one of the three requirements: it is about keeping the processor busy without making users wait too long.', 'This is one of the three requirements: resources follow a policy, such as priorities, and deadlock must be avoided.', 'This is one of the three requirements: processes must be able to talk to each other, and users must be able to start new ones.', null],
            why: 'The three requirements are interleaving for utilization and response time, policy-based allocation without deadlock, and IPC plus process creation. Allocation follows a policy such as priorities; nothing demands equal, fixed shares.' },
          { type: 'num', q: 'Over a 15-unit stretch, a processor does useful work for 11 units and sits idle for the rest. What is its processor utilization, in percent? (Give one decimal place.)',
            answer: 73.3, tol: 0.2, unit: '%',
            why: 'Utilization = busy time ÷ total time = 11 ÷ 15 ≈ 0.733, which is 73.3%.' },
          { type: 'order', q: 'Put the steps of interrupting and later resuming process A in order.',
            items: ['Process A is running on the processor', 'An interrupt stops A between two instructions', 'The OS saves A’s program counter and registers in A’s PCB', 'The OS loads process B’s saved values, and B runs', 'The OS restores A’s saved values, and A continues where it stopped'],
            why: 'The OS saves first, then switches, and later restores. Because A’s PC and context data were kept in its PCB, A resumes as if nothing had happened.' },
          { type: 'tf', q: 'A process creates its own process control block and updates it as it runs.',
            answer: false,
            why: 'The PCB is created and managed by the operating system. Ordinary processes cannot read or change it; that protects the OS’s bookkeeping.' },
          { type: 'bucket', q: 'Raw hardware, or an abstraction the OS offers? Sort each item.',
            buckets: ['Hardware resource', 'OS abstraction'],
            items: [['Disk drive', 0], ['File', 1], ['I/O module', 0], ['Process', 1], ['A private memory region for each process', 1]],
            why: 'The OS hides raw devices behind convenient abstractions: files instead of disk blocks, processes instead of raw processor time, and protected memory regions instead of one shared array of bytes.' },
          { type: 'num', q: 'A PCB’s accounting information shows 15 ms of processor time and 60 ms of clock time since the process was created. For what percentage of its lifetime was the process actually running on the processor?',
            answer: 25, tol: 0.5, unit: '%',
            why: '15 ÷ 60 = 0.25 = 25%. Clock time keeps growing while a process waits; processor time grows only while it runs.' },
          { q: 'Which definition of a process describes it from the point of view of the OS deciding what to run next?',
            choices: ['A program in execution', 'An instance of a program running on a computer', 'The entity that can be assigned to and executed on a processor', 'A passive file of machine instructions'],
            answer: 2,
            feedback: ['This is a correct definition, but it stresses the link between a program and its execution, not the OS’s choice of what to run.', 'This is a correct definition, but it stresses that one program can have many instances.', null, 'That describes a program, not a process.'],
            why: 'The OS repeatedly picks something to give the processor to. The entity it assigns to the processor is a process.' },
        ],
      },

    ],

    notes: `
      <h3>Why the OS thinks in processes</h3>
      <p>A computer platform is a collection of <b>hardware resources</b>: the processor, main memory, I/O modules, timers, disk drives and so on. <b>Applications</b> are programs written to do useful tasks for people. Writing each application directly for the bare hardware would be <b>inefficient</b> (every application would need its own code for every device) and <b>unsafe</b> (nothing would stop one program from damaging another). So the operating system sits in between. It gives applications a <b>convenient, rich, safe and consistent</b> interface and an <b>abstract representation</b> of each resource: named files instead of disk blocks, a private memory region for each process instead of raw memory cells, and processes that take fair turns instead of the bare processor.</p>
      <p>Because many applications run at once, the OS must also manage how they share those resources. It does that bookkeeping per <b>process</b>.</p>
      <h4>The three fundamental requirements, stated in terms of processes</h4>
      <ol>
        <li><b>Interleave</b> the execution of multiple processes to maximize processor utilization while providing reasonable response time.</li>
        <li><b>Allocate resources</b> to processes according to a specific policy (for example, higher priority is served first) while <b>avoiding deadlock</b>.</li>
        <li>Support <b>interprocess communication (IPC)</b> and <b>user creation of processes</b>.</li>
      </ol>
      <p><b>Processor utilization</b> = busy time ÷ total time. <b>Response time</b> is how long a user waits for a result. The two goals can clash: switching more often answers people sooner, but every switch costs the processor some work.</p>
      <h4>Worked example: one at a time vs interleaved</h4>
      <p>Three processes arrive together. A needs 6 units of processor work. B needs 2 units, then waits 4 units for the disk, then needs 2 more. C needs 1 unit (echo a keystroke).</p>
      <ul>
        <li><b>One at a time</b> (A, then B, then C): the processor idles while B waits for the disk. Total time 15, busy time 6 + 4 + 1 = 11, so utilization = 11 ÷ 15 = <b>73.3%</b>. C gets its answer at time 15.</li>
        <li><b>Interleaved</b>, time slice 2, switching whenever a process blocks: A 0–2, B 2–4 (then waits for the disk until 8), C 4–5, A 5–9, B 9–11. Total 11, busy 11, utilization <b>100%</b>. C gets its answer at time 5.</li>
      </ul>
      <p>Shorter slices answer short jobs sooner, but every real switch costs a little processor time, so real systems pick a moderate slice. Very long slices can bring idle time back (slice 6: utilization 11 ÷ 14 ≈ 78.6%).</p>
      <h4>Allocation and deadlock</h4>
      <p>If P1 holds the printer and waits for the scanner while P2 holds the scanner and waits for the printer, neither can ever continue: that is <b>deadlock</b>. A policy such as “serve requests by priority, and always request the printer before the scanner” prevents the circle of waiting: a process that must wait for the printer holds nothing anyone else needs. Deadlock is not mere slowness; deadlocked processes never finish unless the OS intervenes.</p>
      <h4>Communication and creation</h4>
      <p>Each process’s memory is private, so cooperating processes need an OS-provided channel (messages, pipes, shared memory) to exchange data: that is IPC. Users and programs must also be able to ask the OS to create new processes, for example by double-clicking an icon or typing a command; each new process gets a new identifier, its own memory and its own record.</p>

      <h3>What is a process?</h3>
      <p>Four standard definitions, all correct, each from a different angle:</p>
      <ul>
        <li><b>A program in execution</b>: execution is what turns a program into a process.</li>
        <li><b>An instance of a program running on a computer</b>: one program can have many instances at once.</li>
        <li><b>The entity that can be assigned to and executed on a processor</b>: the OS’s point of view; it is what the OS picks to run next.</li>
        <li><b>A unit of activity characterized by the execution of a sequence of instructions, a current state, and an associated set of system resources</b>: its <b>trace</b> (the sequence of instruction addresses it executes), where it stands now, and what it holds (memory, open files, devices).</li>
      </ul>
      <p><b>Program vs process.</b> A program is passive: a set of instructions stored in a file. A process is active: that program executing, with its own data, state, resources and PCB. Two processes can run the same program at the same time.</p>
      <h4>Two essential elements</h4>
      <p>While a program executes, its process has two essential elements: the <b>program code</b>, which may be <b>shared</b> with other processes running the same program (running code is only read, never changed), and a <b>set of data</b> associated with that code. Launch the same program twice and the OS loads the code once; each process gets its own data area, its own PCB and its own program counter, so the two can be at different places in the same code.</p>
      <h3>The process control block (PCB)</h3>
      <p>For every process the OS <b>creates and manages</b> a process control block. Processes themselves cannot read or change it. The PCB does not contain the code or data; its memory pointers say where they are. Its elements:</p>
      <table>
        <tr><th>Element</th><th>What it holds</th><th>The OS uses it to answer…</th></tr>
        <tr><td>Identifier</td><td>A unique number for this process (PID)</td><td>Which of two copies of a program should get this request?</td></tr>
        <tr><td>State</td><td>Where it stands now, e.g. Running, Ready, Blocked</td><td>May this process run right now?</td></tr>
        <tr><td>Priority</td><td>Its importance relative to other processes</td><td>Two are ready: who goes first?</td></tr>
        <tr><td>Program counter</td><td>Address of the next instruction to execute</td><td>Where should it continue?</td></tr>
        <tr><td>Memory pointers</td><td>Where its code and data are, plus memory blocks shared with other processes</td><td>Which memory can be freed? What does it share?</td></tr>
        <tr><td>Context data</td><td>The processor register contents while it runs (saved when it stops)</td><td>What did R2 hold when it was interrupted?</td></tr>
        <tr><td>I/O status information</td><td>Outstanding I/O requests, assigned I/O devices, files in use</td><td>Which files must be closed? Which request is it waiting on?</td></tr>
        <tr><td>Accounting information</td><td>Processor time and clock time used, time limits, account numbers</td><td>How much should be billed? Is it over its limit?</td></tr>
      </table>
      <p>While a process runs, its live program counter and register values sit in the processor; the PCB holds the copy saved when it last stopped. Processor time grows only while the process runs; clock time keeps growing while it waits. Example: 15 ms of processor time over 60 ms of clock time means the process was running for 15 ÷ 60 = 25% of its lifetime.</p>
      <p>Kitchen analogy: the PCB is the order ticket: order number, status, rush flag, next recipe step, which shelf and pans, what is in the pans now, waiting on the oven, time in the kitchen and who pays.</p>

      <h3>Interrupt and resume: why the PCB matters</h3>
      <p>The PCB holds enough information to <b>interrupt a running process and later resume it as if the interruption had not occurred</b>. The sequence:</p>
      <ol>
        <li>Process A is running on the processor.</li>
        <li>An interrupt (for example, the timer ending A’s time slice) stops A between two instructions: the processor sets A’s PC aside and jumps into the OS.</li>
        <li>The OS saves A’s program counter <b>and</b> context data into A’s PCB and updates A’s state.</li>
        <li>The OS loads another process’s saved values from its PCB, and that process runs.</li>
        <li>Later the OS restores A’s saved values, and A continues at the saved instruction with its own register values.</li>
      </ol>
      <p><b>Worked example.</b> A executes R1 = 17 and R2 = 40 and is interrupted with PC = 0x1208. B, restored with R1 = 5, R2 = 9, doubles R2 to 18. When A is restored (PC 0x1208, R1 17, R2 40), R1 = R1 + R2 gives <b>57</b>. If the OS saved only the program counter, B would start with A’s leftover registers (40 × 2 = 80), and A would resume with R2 = 80 and compute <b>97</b>: the right instruction with the wrong data. That is why the PCB keeps the context data as well as the program counter.</p>
      <p>Without PCBs, an OS could not keep many processes in progress at once. In one line: <b>process = program code + associated data + PCB</b>.</p>
      <svg viewBox="0 0 520 64" width="520" role="img" aria-label="process equals program code plus data plus PCB">
        <rect x="4" y="12" width="120" height="40" rx="8" fill="#f5f7fb" stroke="#69738c"/><text x="64" y="37" text-anchor="middle" font-size="14" fill="#151c2c">program code</text>
        <text x="138" y="38" text-anchor="middle" font-size="18" fill="#151c2c">+</text>
        <rect x="152" y="12" width="84" height="40" rx="8" fill="#d7f5e8" stroke="#059669"/><text x="194" y="37" text-anchor="middle" font-size="14" fill="#151c2c">data</text>
        <text x="250" y="38" text-anchor="middle" font-size="18" fill="#151c2c">+</text>
        <rect x="264" y="12" width="84" height="40" rx="8" fill="#eee5ff" stroke="#7c3aed"/><text x="306" y="37" text-anchor="middle" font-size="14" fill="#151c2c">PCB</text>
        <text x="362" y="38" text-anchor="middle" font-size="18" fill="#151c2c">=</text>
        <rect x="376" y="12" width="140" height="40" rx="8" fill="#d6f3f9" stroke="#0891b2"/><text x="446" y="37" text-anchor="middle" font-size="14" font-weight="700" fill="#151c2c">a process</text>
      </svg>
      <p>Coming next: section 3.2 follows the State element as a process moves between states, and section 3.3 describes everything else the OS records about a process.</p>
    `,
  });
})();
