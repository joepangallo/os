/* =====================================================================
   Section 3.2 — Process States
   Traces and the dispatcher, the two-state model, creation and
   termination, the five-state model, queues, and suspension
   (the seven-state model). Helpers live in the IIFE so nothing
   leaks into the global scope.
   ===================================================================== */
(() => {
  /* ------------------------------------------------------------------
     Shared helpers: state names, diagram layouts, the diagram builder
     ------------------------------------------------------------------ */
  const NAME = { nr: 'Not Running', new: 'New', ready: 'Ready', running: 'Running', blocked: 'Blocked', exit: 'Exit', rs: 'Ready/Suspend', bs: 'Blocked/Suspend', sus: 'Suspend' };
  const SHAPE = { nr: 's-panel', new: 's-panel', ready: 's-proc', running: 's-cpu', blocked: 's-warn', exit: 's-panel', rs: 's-proc', bs: 's-warn', sus: 's-panel' };
  const SUSPENDED = ['rs', 'bs', 'sus'];
  const L = (x1, y1, x2, y2) => `M${x1},${y1} L${x2},${y2}`;

  /* Each layout: vb = viewBox size, w/h = state box size, st = box centres,
     ar = arrows as [id, path, labelX, labelY, anchor, label, dashed?]. */
  const MODELS = {
    two: {
      vb: [560, 170], w: 150, h: 52,
      st: { nr: [170, 85], running: [400, 85] },
      ar: [
        ['enter', L(14, 85, 95, 85), 54, 74, 'middle', 'enter'],
        ['dispatch', L(245, 72, 325, 72), 285, 60, 'middle', 'dispatch'],
        ['pause', L(325, 98, 245, 98), 285, 119, 'middle', 'pause'],
        ['exit', L(475, 85, 546, 85), 510, 74, 'middle', 'exit'],
      ],
    },
    five: {
      vb: [480, 330], w: 120, h: 46,
      st: { new: [70, 55], ready: [140, 165], running: [340, 165], exit: [410, 55], blocked: [240, 290] },
      ar: [
        ['create', L(70, 2, 70, 32), 80, 17, 'start', 'create'],
        ['admit', L(88, 78, 118, 142), 96, 114, 'end', 'admit'],
        ['dispatch', L(200, 154, 280, 154), 240, 145, 'middle', 'dispatch'],
        ['timeout', L(280, 176, 200, 176), 240, 195, 'middle', 'timeout'],
        ['release', L(365, 142, 395, 78), 388, 116, 'start', 'release'],
        ['wait', L(318, 188, 268, 267), 300, 236, 'start', 'event wait'],
        ['occurs', L(212, 267, 162, 188), 180, 236, 'end', 'event occurs'],
        ['killReady', 'M150,142 C 175,72 240,55 350,55', 262, 44, 'middle', 'terminated', true],
        ['killBlocked', 'M300,295 C 470,300 470,150 430,78', 452, 306, 'end', 'terminated', true],
      ],
    },
    /* the first attempt at suspension: ONE Suspend state (six states in all) */
    one: {
      vb: [500, 262], w: 112, h: 40,
      st: { new: [75, 45], exit: [425, 45], ready: [190, 135], running: [385, 135], sus: [75, 235], blocked: [300, 235] },
      ar: [
        ['create', L(75, 2, 75, 23), 85, 15, 'start', 'create'],
        ['admit', L(105, 65, 158, 113), 124, 97, 'end', 'admit'],
        ['dispatch', L(246, 126, 327, 126), 287, 118, 'middle', 'dispatch'],
        ['timeout', L(329, 144, 248, 144), 288, 162, 'middle', 'timeout'],
        ['release', L(410, 115, 425, 67), 425, 96, 'start', 'release'],
        ['wait', L(370, 155, 325, 213), 356, 192, 'start', 'event wait'],
        ['occurs', L(275, 215, 218, 157), 238, 192, 'end', 'event occurs'],
        ['activate', L(105, 215, 160, 157), 116, 190, 'end', 'activate'],
        ['suspend', L(242, 235, 133, 235), 187, 227, 'middle', 'suspend'],
      ],
    },
    /* the fix, zoomed in: the four "waiting? / in memory?" states plus Running (New and Exit left out) */
    split: {
      vb: [540, 236], w: 124, h: 40,
      st: { rs: [72, 55], ready: [272, 55], running: [468, 55], bs: [72, 200], blocked: [272, 200] },
      ar: [
        ['activate', L(134, 47, 208, 47), 171, 39, 'middle', 'activate'],
        ['suspendR', L(210, 63, 136, 63), 173, 80, 'middle', 'suspend'],
        ['dispatch', L(334, 47, 404, 47), 369, 39, 'middle', 'dispatch'],
        ['timeout', L(406, 63, 336, 63), 371, 80, 'middle', 'timeout'],
        ['wait', L(440, 75, 320, 178), 400, 138, 'start', 'event wait'],
        ['occurs', L(272, 180, 272, 77), 264, 135, 'end', 'event occurs'],
        ['suspendB', L(208, 192, 136, 192), 172, 184, 'middle', 'suspend'],
        ['activateB', L(136, 210, 208, 210), 172, 228, 'middle', 'activate'],
        ['occursS', L(72, 180, 72, 77), 80, 135, 'start', 'event occurs'],
      ],
    },
    seven: {
      vb: [600, 345], w: 132, h: 42,
      st: { new: [80, 50], exit: [510, 50], rs: [80, 175], ready: [290, 175], running: [495, 175], bs: [80, 300], blocked: [290, 300] },
      ar: [
        ['create', L(80, 2, 80, 29), 90, 15, 'start', 'create'],
        ['admit', L(146, 64, 244, 154), 176, 104, 'end', 'admit'],
        ['admitS', L(80, 71, 80, 154), 88, 116, 'start', 'admit'],
        ['activate', L(146, 167, 224, 167), 185, 159, 'middle', 'activate'],
        ['suspendR', L(224, 185, 146, 185), 185, 202, 'middle', 'suspend'],
        ['dispatch', L(356, 167, 429, 167), 392, 159, 'middle', 'dispatch'],
        ['timeout', L(429, 185, 356, 185), 392, 202, 'middle', 'timeout'],
        ['release', L(500, 154, 508, 71), 512, 116, 'start', 'release'],
        ['wait', L(460, 196, 340, 279), 412, 250, 'start', 'event wait'],
        ['occurs', L(290, 279, 290, 196), 282, 242, 'end', 'event occurs'],
        ['suspendB', L(224, 293, 146, 293), 185, 285, 'middle', 'suspend'],
        ['activateB', L(146, 309, 224, 309), 185, 327, 'middle', 'activate'],
        ['occursS', L(80, 279, 80, 196), 88, 242, 'start', 'event occurs'],
        ['suspendRun', 'M455,154 C 420,95 190,95 120,154', 300, 103, 'middle', 'suspend'],
      ],
      note: [596, 340, 'Any state → Exit if the process is killed'],
    },
  };

  /* Build a state diagram.  o.onArrow(id) / o.onState(id) make parts clickable,
     o.counts adds a count bubble to every state.  Returns an API to recolour it. */
  function diagram(ctx, key, o = {}) {
    const { s } = ctx;
    const M = MODELS[key];
    const svg = s('svg', { viewBox: `0 0 ${M.vb[0]} ${M.vb[1]}`, width: '100%', class: 'sd', role: 'img', 'aria-label': o.label || 'process state diagram' });
    const arrowLayer = s('g'), stateLayer = s('g'), top = s('g');
    svg.append(arrowLayer, stateLayer, top);
    const ar = {}, st = {};
    M.ar.forEach(([id, d, lx, ly, anchor, text, dash]) => {
      const ln = s('path', { d, class: 'ln', 'marker-end': 'url(#arr)' });
      const g = s('g', { class: 'ar' + (dash ? ' dash' : '') + (o.onArrow ? ' hot' : ''), 'data-id': id },
        ln, s('path', { d, class: 'hit' }), s('text', { x: lx, y: ly, 'text-anchor': anchor }, text));
      if (o.onArrow) g.addEventListener('click', () => o.onArrow(id));
      arrowLayer.append(g);
      ar[id] = { g, ln };
    });
    for (const [id, [x, y]] of Object.entries(M.st)) {
      const w = M.w, h = M.h;
      const g = s('g', { class: 'st' + (SUSPENDED.includes(id) ? ' dash' : '') + (o.onState ? ' hot' : ''), 'data-id': id },
        s('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 12, class: SHAPE[id] }),
        s('text', { x, y: o.counts ? y - 7 : y + 1, class: 'nm' }, NAME[id]));
      let cnt = null;
      if (o.counts) {
        cnt = s('text', { x, y: y + 12, class: 'cnt s-sub' }, 'empty');
        g.append(cnt);
      }
      if (o.onState) g.addEventListener('click', () => o.onState(id));
      stateLayer.append(g);
      st[id] = { g, cnt, x, y };
    }
    if (M.note) top.append(s('text', { x: M.note[0], y: M.note[1], 'text-anchor': 'end', class: 'note' }, M.note[2]));
    const ghostLayer = s('g');
    top.append(ghostLayer);
    // point on the edge of box (cx,cy) in the direction of (tx,ty)
    const edge = (cx, cy, tx, ty) => {
      const dx = tx - cx, dy = ty - cy;
      const k = Math.min((M.w / 2) / Math.abs(dx || 1e-9), (M.h / 2) / Math.abs(dy || 1e-9));
      return [cx + dx * k, cy + dy * k];
    };
    const api = {
      svg,
      has: (id) => !!ar[id],
      arrow(id, cls) {
        const a = ar[id]; if (!a) return;
        a.g.classList.remove('on', 'used', 'dim');
        if (cls) a.g.classList.add(cls);
        a.ln.setAttribute('marker-end', cls === 'on' ? 'url(#arr-accent)' : cls === 'used' ? 'url(#arr-ok)' : 'url(#arr)');
      },
      arrows(fn) { Object.keys(ar).forEach((id) => api.arrow(id, fn(id))); },
      state(id, cls) { const x = st[id]; if (!x) return; x.g.classList.remove('on', 'dim', 'fresh'); if (cls) x.g.classList.add(cls); },
      states(fn) { Object.keys(st).forEach((id) => api.state(id, fn(id))); },
      count(id, n) { if (st[id] && st[id].cnt) st[id].cnt.textContent = n ? `${n} process${n === 1 ? '' : 'es'}` : 'empty'; },
      /* a red dashed "forbidden" arrow between two states, bent to one side */
      ghost(from, to, bend = 40) {
        ghostLayer.replaceChildren();
        const A = st[from], B = st[to];
        if (!A || !B || from === to) return;
        const [x1, y1] = edge(A.x, A.y, B.x, B.y), [x2, y2] = edge(B.x, B.y, A.x, A.y);
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const qx = (x1 + x2) / 2 + bend * (y2 - y1) / len, qy = (y1 + y2) / 2 - bend * (x2 - x1) / len;
        const mx = 0.25 * x1 + 0.5 * qx + 0.25 * x2, my = 0.25 * y1 + 0.5 * qy + 0.25 * y2;
        ghostLayer.append(
          s('path', { d: `M${x1},${y1} Q${qx},${qy} ${x2},${y2}`, class: 'ghost', 'marker-end': 'url(#arr-bad)' }),
          s('circle', { cx: mx, cy: my, r: 13, style: 'fill:var(--panel);stroke:var(--bad);stroke-width:2' }),
          s('text', { x: mx, y: my + 1, class: 'ghostx', style: 'fill:var(--bad);font-size:17px' }, '✗'));
      },
      clearGhost() { ghostLayer.replaceChildren(); },
    };
    return api;
  }

  /* Data for step 5: why processes are created and why they end.
     Each creation reason: [name, what it means].  Each termination reason:
     [name, what it means, a scenario that illustrates exactly this reason]. */
  const CREATE = [
    ['New batch job', 'A job that was submitted earlier (and saved on disk or tape) is picked up, and the OS creates a process to run it.'],
    ['Interactive log-on', 'A user signs in at a terminal, and the OS creates a process for that user’s session.'],
    ['Created by the OS to provide a service', 'The OS starts a process on a program’s behalf, for example to manage printing, so the program does not have to wait.'],
    ['Spawned by an existing process', 'A running program asks the OS to create another process, for example to split up work or run something in parallel.'],
  ];
  const CREATE_SCEN = [
    ['An overnight payroll job, submitted earlier in the day, reaches the front of the batch queue.', 0],
    ['A student types a username and password at a terminal and is accepted.', 1],
    ['A program asks to print a long report. The OS starts a separate process to feed the printer so the program can carry on.', 2],
    ['A web server creates a new process to handle each client that connects to it.', 3],
    ['Someone connects to a server over the network and signs in to get a command prompt.', 1],
    ['You type a command into a shell, and the shell asks the OS to create a process that runs the command.', 3],
  ];
  const TERM = [
    ['Normal completion', 'The process reached the end of its work and told the OS it is done.', 'A program finishes writing its output file and calls the OS service that says “I am finished”.'],
    ['Time limit exceeded', 'The process went past its total time limit. The limit may count wall-clock time, processor time used, or (for an interactive process) time since the user last typed anything.','A batch job was given a budget of 10 minutes of processor time and has now used all 10.'],
    ['Memory unavailable', 'The process needs more memory than the system can give it.', 'A program asks for a 64 GB table on a machine that can never supply that much memory.'],
    ['Bounds violation', 'The process tried to reach a memory location it is not allowed to use.', 'A buggy loop runs past the end of an array and reads an address outside the process’s own memory area.'],
    ['Protection error', 'The process tried to use a resource in a way it is not permitted to, such as writing to a read-only file.', 'A process that may only read a file tries to write into it.'],
    ['Arithmetic error', 'A calculation the hardware cannot complete, such as dividing by zero or producing a number too large to store.', 'A division instruction runs with a divisor of zero.'],
    ['Time overrun', 'The process waited for some event longer than the maximum wait that was set.', 'A process is waiting for a reply from a server. Its maximum wait of 30 seconds passes and no reply has arrived.'],
    ['I/O failure', 'An input or output operation went wrong and could not be completed.', 'The program asks to read a file that does not exist, so the read cannot be carried out.'],
    ['Invalid instruction', 'The process tried to execute a bit pattern that is not a real instruction.', 'After a bad jump, the processor tries to execute bytes of text data as if they were an instruction.'],
    ['Privileged instruction', 'The process tried to execute an instruction reserved for the OS.', 'An ordinary program tries to run the instruction that switches off interrupts.'],
    ['Data misuse', 'A piece of data is the wrong type or was never given a value before use.', 'A program reads a variable before any value was ever stored in it.'],
    ['Operator or OS intervention', 'A person operating the system, or the OS itself, decides to stop the process.', 'The OS detects that several processes are stuck waiting for each other forever and kills one of them to break the jam.'],
    ['Parent termination', 'The parent process ended, and this OS automatically ends everything the parent created.', 'Process X ends. On this system, ending a process also ends every child it created, including this one.'],
    ['Parent request', 'The parent process asked the OS to end one of its children.', 'A browser decides that a helper process it started is no longer needed and asks the OS to end it.'],
  ];

  /* Data for steps 8 and 9: what triggers each arrow of the seven-state model */
  const TR7 = {
    create: ['Null → New', 'A process is created: a batch job, a log-on, an OS service, or spawning by another process.'],
    admit: ['New → Ready', 'The OS admits the new process into main memory because there is room for it.'],
    admitS: ['New → Ready/Suspend', 'Memory is tight, so the OS finishes creating the process but parks it on disk. Keeping a pool of ready work on disk lets the OS refill memory quickly later.'],
    activate: ['Ready/Suspend → Ready', 'There is room in memory, or no Ready process is left in memory, or this process is more important than those in memory, so the OS swaps it back in.'],
    suspendR: ['Ready → Ready/Suspend', 'Normally the OS would rather swap out a Blocked process. It may swap out a Ready one when that is the only way to free a big enough block of memory, or when the Ready one is low priority.'],
    dispatch: ['Ready → Running', 'The dispatcher chooses the process. Only processes that are in main memory can be dispatched.'],
    timeout: ['Running → Ready', 'The time slice ends, or a more important process preempts it.'],
    release: ['Running → Exit', 'The process finishes, or is aborted while it runs.'],
    wait: ['Running → Blocked', 'The process requests I/O (or another event) and must wait for it.'],
    occurs: ['Blocked → Ready', 'The awaited event happens while the process is still in main memory.'],
    suspendB: ['Blocked → Blocked/Suspend', 'The usual suspension: memory is needed, and a blocked process cannot use its memory anyway, so it is swapped out to disk. The OS may do this even when Ready processes exist, if the running or a ready process needs more memory to perform well.'],
    activateB: ['Blocked/Suspend → Blocked', 'Unusual, because the process still cannot run. The OS might do it when memory frees up and this process is important and its event is expected very soon.'],
    occursS: ['Blocked/Suspend → Ready/Suspend', 'The awaited event happens while the process is on disk. It is no longer waiting, but it stays on disk until it is activated.'],
    suspendRun: ['Running → Ready/Suspend', 'The OS preempts the running process and swaps it straight out, for example because a more important process on disk has just become ready and needs the memory.'],
  };
  const SUSP_CHAR = [
    ['Not available to run', 'A suspended process cannot be dispatched right away, even if the processor is idle.'],
    ['Waiting is a separate question', 'It may or may not also be waiting for an event. If it is, the event can occur while it is suspended, and that alone still does not let it run.'],
    ['Put there by an agent', 'Something deliberately suspended it to keep it from running: the process itself, its parent, or the OS.'],
    ['Only the agent releases it', 'It stays suspended until that agent explicitly orders it back.'],
  ];
  const SUSP_WHY = [
    ['Swapping', 'The OS needs to free main memory so it can bring in a process that is ready to run.'],
    ['Other OS reason', 'The OS may set aside a background or utility process, or one it suspects of causing a problem.'],
    ['Interactive user request', 'A user may pause a program, for example to debug it or while a resource it uses is being fixed.'],
    ['Timing', 'A process that runs periodically (such as a monitoring job) can be suspended until its next turn comes round.'],
    ['Parent process request', 'A parent may suspend a child to inspect or change it, or to coordinate several children.'],
  ];

  /* Small DOM helpers used by the simulators */
  const actGrid = (ctx, cols, ...btns) => ctx.h('div', { class: 'acts', style: { gridTemplateColumns: `repeat(${ctx.narrow ? 2 : cols}, minmax(0, 1fr))` } }, ...btns);
  const tokCls = (state) => 'tok' + ({ running: ' run', blocked: ' blk', new: ' new', exit: ' ex', rs: ' sus', bs: ' blk sus' }[state] || '');
  function say(box, kind, head, html) {
    box.className = 'msg ' + (kind || '');
    box.innerHTML = (head ? `<b class="h">${head}</b>` : '') + html;
  }

  Guide.section({
    id: '3.2',
    title: 'Process States',
    short: 'Process states',
    summary: 'Follow a process from creation to exit through the two-, five- and seven-state models and their queues.',
    objectives: [
      'Read an interleaved instruction trace and explain what the dispatcher does between processes.',
      'Draw the two-state and five-state models and name the event behind every transition.',
      'List the reasons a process is created or terminated, and explain parent/child spawning.',
      'Explain why the OS keeps ready and blocked queues, and why one queue per event helps.',
      'Explain why processes are swapped out, why a single Suspend state falls short, and use the seven-state model with Ready/Suspend and Blocked/Suspend.',
    ],
    terms: [
      ['Trace', 'The list of instruction addresses a process executes, in the order it executes them. Comparing traces shows how the processor moves between processes.'],
      ['Dispatcher', 'A small piece of OS code that switches the processor from one process to another: it records where the old process stopped and starts the next chosen process where that one left off.'],
      ['Timeout', 'The OS takes the processor from a running process because it has used up its allowed slice of time. The process goes back to Ready.'],
      ['Two-state model', 'The simplest process model: each process is either Running or Not Running, and all not-running processes wait in one queue.'],
      ['Five-state model', 'A process model with the states New, Ready, Running, Blocked and Exit. It separates processes that could run from those waiting for an event.'],
      ['New state', 'The OS has just created the process (it has an identifier and a control block) but has not yet admitted it into the group of processes allowed to run. Usually its program is not yet loaded into main memory.'],
      ['Ready state', 'The process could run right now; it is only waiting for its turn on the processor.'],
      ['Running state', 'The process is executing on the processor at this moment. On a single processor at most one process is Running.'],
      ['Blocked state', 'The process cannot run until some event happens, such as an I/O operation finishing. Also called the Waiting state.'],
      ['Exit state', 'The process has finished or been aborted. It will never run again, although the OS may keep its records for a short while.'],
      ['Preemption', 'Taking the processor away from a running process that did not ask to stop, for example because a more important process has become ready.'],
      ['Process spawning', 'One process asking the OS to create another process.'],
      ['Parent process', 'A process that has created (spawned) another process.'],
      ['Child process', 'A process that was created by another process, called its parent.'],
      ['Ready queue', 'The list of processes in the Ready state. The dispatcher picks the next process to run from it.'],
      ['Blocked queue', 'A list of processes in the Blocked state. An OS may keep one list for every blocked process, or a separate list for each kind of event.'],
      ['Swapping', 'Moving all or part of a process from main memory out to disk (and later back in) so the memory can be used by other processes.'],
      ['Suspended process', 'A process that has been set aside, typically by swapping it out to disk, and is not available to run until something explicitly brings it back. The simplest design uses one Suspend state; a better one splits it into Ready/Suspend and Blocked/Suspend.'],
      ['Ready/Suspend state', 'The process is swapped out to disk but is not waiting for any event: it could run as soon as it is brought back into main memory.'],
      ['Blocked/Suspend state', 'The process is swapped out to disk and is also waiting for an event, so two things stand between it and the processor.'],
    ],

    css: `
      /* ---- state diagrams (SVG) ---- */
      .sec-3-2 svg.sd { display: block; }
      .sec-3-2 .st rect { stroke-width: 2.2; transition: stroke-width .15s, opacity .2s; }
      .sec-3-2 .st.dash rect { stroke-dasharray: 7 4; }
      .sec-3-2 .st text.nm { font-size: 15px; font-weight: 800; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
      .sec-3-2 .st[data-id="rs"] text.nm, .sec-3-2 .st[data-id="bs"] text.nm { font-size: 13.5px; }
      .sec-3-2 .st text.cnt { font-size: 12.5px; font-weight: 700; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
      .sec-3-2 .st.hot { cursor: pointer; }
      .sec-3-2 .st.hot:hover rect { stroke-width: 3.5; }
      .sec-3-2 .st.on rect { stroke-width: 4.5; }
      .sec-3-2 .st.fresh rect { stroke-width: 4; }
      .sec-3-2 .st.dim { opacity: .3; }
      .sec-3-2 .ar .ln { fill: none; stroke: var(--ink-2); stroke-width: 2; opacity: .85; }
      .sec-3-2 .ar.dash .ln { stroke-dasharray: 6 5; }
      .sec-3-2 .ar .hit { fill: none; stroke: transparent; stroke-width: 16; pointer-events: stroke; }
      .sec-3-2 .ar.hot { cursor: pointer; }
      .sec-3-2 .ar text { font-size: 13.5px; font-weight: 700; fill: var(--ink-2); }
      .sec-3-2 .ar.hot:hover .ln { stroke-width: 3; }
      .sec-3-2 .ar.used .ln { stroke: var(--ok); opacity: 1; }
      .sec-3-2 .ar.used text { fill: var(--ok); }
      .sec-3-2 .ar.on .ln { stroke: var(--accent); stroke-width: 3; opacity: 1; }
      .sec-3-2 .ar.on text { fill: var(--accent); }
      .sec-3-2 .ar.dim { opacity: .18; }
      .sec-3-2 .ghost { fill: none; stroke: var(--bad); stroke-width: 2.5; stroke-dasharray: 5 5; }
      .sec-3-2 .ghostx { font-size: 26px; font-weight: 900; text-anchor: middle; dominant-baseline: central; }
      .sec-3-2 svg .note { font-size: 13px; fill: var(--muted); font-style: italic; }

      /* ---- process tokens and lanes (DOM) ---- */
      .sec-3-2 .tok { width: 48px; height: 34px; border-radius: 9px; border: 2px solid var(--proc); background: var(--proc-bg);
        font-weight: 800; font-size: 15px; cursor: pointer; color: var(--ink); display: inline-flex; align-items: center;
        justify-content: center; flex: none; padding: 0; position: relative; }
      .sec-3-2 .tok.sel { outline: 3px solid var(--accent); outline-offset: 2px; }
      .sec-3-2 .tok.run { border-color: var(--cpu); background: var(--cpu-bg); }
      .sec-3-2 .tok.blk { border-color: var(--warn); background: var(--warn-bg); }
      .sec-3-2 .tok.new { border-color: var(--line-2); background: var(--panel); }
      .sec-3-2 .tok.ex { opacity: .5; border-style: dashed; border-color: var(--line-2); background: var(--panel-2); }
      .sec-3-2 .tok.sus { border-style: dashed; }
      .sec-3-2 .tok.skip { border-color: var(--bad); background: var(--bad-bg); }
      .sec-3-2 .tok .tag { position: absolute; top: -9px; right: -8px; font-size: 10.5px; font-weight: 800; line-height: 1;
        padding: 2px 4px; border-radius: 6px; background: var(--io); color: var(--panel); }
      .sec-3-2 .lane { display: grid; grid-template-columns: 112px minmax(0, 1fr); align-items: center; gap: 10px;
        border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px; background: var(--panel-2); min-height: 50px; }
      .sec-3-2 .lane .lbl { font-weight: 800; font-size: 14px; line-height: 1.2; }
      .sec-3-2 .lane .lbl small { display: block; font-weight: 600; color: var(--muted); font-size: 12.5px; }
      .sec-3-2 .lane .toks { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; min-height: 36px; }
      .sec-3-2 .lane.cpu { border-color: color-mix(in srgb, var(--cpu) 45%, transparent); background: var(--cpu-bg); }
      .sec-3-2 .lane.sm { min-height: 42px; padding: 4px 10px; }
      .sec-3-2 .lane.sm .toks { min-height: 32px; }
      .sec-3-2 .lane.sm .tok { height: 30px; width: 44px; font-size: 14px; }
      .sec-3-2 .tok.ev2, .sec-3-2 .lane.sm .tok.ev2 { width: 66px; height: 40px; flex-direction: column; line-height: 1.05; font-size: 14px; }
      .sec-3-2 .tok.ev2 .evn { font-size: 11px; font-weight: 700; color: var(--io); }
      .sec-3-2 .lane.hit { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-bg); }
      .sec-3-2 .lane .empty { font-size: 13px; color: var(--muted); font-style: italic; }

      /* ---- narration box ---- */
      .sec-3-2 .msg { border-radius: 10px; padding: 9px 12px; background: var(--panel-2); border: 1px solid var(--line);
        font-size: 15px; line-height: 1.45; }
      .sec-3-2 .msg.ok { border-color: var(--ok); background: var(--ok-bg); }
      .sec-3-2 .msg.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-3-2 .msg.info { border-color: var(--accent); background: var(--accent-bg); }
      .sec-3-2 .msg b.h { display: block; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 2px; }
      .sec-3-2 .msg.ok b.h { color: var(--ok); } .sec-3-2 .msg.bad b.h { color: var(--bad); } .sec-3-2 .msg.info b.h { color: var(--accent); }

      /* ---- processes A, B, C (three shades of the process colour) + dispatcher ---- */
      .sec-3-2 svg .fA { fill: color-mix(in srgb, var(--proc) 16%, var(--panel)); stroke: var(--proc); }
      .sec-3-2 svg .fB { fill: color-mix(in srgb, var(--proc) 40%, var(--panel)); stroke: var(--proc); }
      .sec-3-2 svg .fC { fill: color-mix(in srgb, var(--proc) 64%, var(--panel)); stroke: var(--proc); }
      .sec-3-2 svg .fD { fill: var(--os-bg); stroke: var(--os); }
      .sec-3-2 svg .fGap { fill: var(--panel-2); stroke: var(--line-2); stroke-dasharray: 4 4; }
      .sec-3-2 .cA { background: color-mix(in srgb, var(--proc) 16%, var(--panel)); border-color: var(--proc); }
      .sec-3-2 .cB { background: color-mix(in srgb, var(--proc) 40%, var(--panel)); border-color: var(--proc); }
      .sec-3-2 .cC { background: color-mix(in srgb, var(--proc) 64%, var(--panel)); border-color: var(--proc); }
      .sec-3-2 .cD { background: var(--os-bg); border-color: var(--os); }
      .sec-3-2 .mreg { cursor: pointer; }
      .sec-3-2 .mreg rect { stroke-width: 2; transition: stroke-width .15s; }
      .sec-3-2 .mreg:hover rect { stroke-width: 3.5; }
      .sec-3-2 .mreg.on rect { stroke-width: 4.5; }
      .sec-3-2 .addr { display: inline-flex; align-items: center; justify-content: center; height: 30px; border-radius: 8px;
        border: 2px solid var(--line-2); font-family: var(--mono); font-weight: 700; font-size: 14.5px; }
      .sec-3-2 .addr.flag { border-color: var(--io); box-shadow: 0 0 0 2px var(--io-bg); }

      /* ---- combined trace list (step 3) ---- */
      .sec-3-2 .trgrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-flow: column; grid-template-rows: repeat(13, 17px); column-gap: 10px; row-gap: 1px; }
      .sec-3-2 .tr { display: grid; grid-template-columns: 24px 11px minmax(0, 1fr); align-items: center; gap: 6px; font-family: var(--mono);
        font-size: 13.5px; line-height: 17px; padding: 0 6px; border-radius: 5px; white-space: nowrap; }
      .sec-3-2 .tr .n { color: var(--muted); text-align: right; font-size: 12.5px; }
      .sec-3-2 .tr .sw { width: 11px; height: 12px; border-radius: 3px; border: 1.5px solid; }
      .sec-3-2 .tr .ev { font-family: var(--font); font-size: 11.5px; font-weight: 800; color: var(--intr); margin-left: 6px; }
      .sec-3-2 .tr { cursor: pointer; }
      .sec-3-2 .tr:hover { background: var(--panel-3); opacity: 1; }
      .sec-3-2 .tr.fut { opacity: .25; }
      .sec-3-2 .tr.fut:hover { opacity: .7; }
      .sec-3-2 .tr.cur { background: var(--accent-bg); font-weight: 800; }
      .sec-3-2 svg .cell { stroke-width: 1.2; cursor: pointer; }
      .sec-3-2 svg .cell.fut { opacity: .22; }
      .sec-3-2 svg .curbox { fill: none; stroke: var(--accent); stroke-width: 3; }

      /* ---- step 5: reason buttons and the parent/child tree ---- */
      .sec-3-2 .rgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
      .sec-3-2 .rbtn { height: 34px; font-size: 14px; justify-content: flex-start; padding: 0 10px; }
      .sec-3-2 .rbtn.done { border-color: var(--ok); color: var(--ok); background: var(--ok-bg); }
      .sec-3-2 .rbtn.wrong { border-color: var(--bad); color: var(--bad); background: var(--bad-bg); }
      .sec-3-2 .scen { font-size: 18px; line-height: 1.45; font-weight: 600; }
      .sec-3-2 .trow { display: flex; align-items: center; gap: 8px; padding: 3px 8px; border-radius: 9px; cursor: pointer;
        border: 2px solid transparent; background: none; width: 100%; text-align: left; font-size: 15px; color: var(--ink); min-height: 38px; }
      .sec-3-2 .trow:hover { background: var(--panel-2); }
      .sec-3-2 .trow.sel { border-color: var(--accent); background: var(--accent-bg); }
      .sec-3-2 .trow.dead { opacity: .55; }
      .sec-3-2 .trow .branch { color: var(--muted); font-family: var(--mono); white-space: pre; }
      .sec-3-2 .trow .pn { font-weight: 800; padding: 2px 10px; border-radius: 8px; border: 2px solid var(--proc); background: var(--proc-bg); }
      .sec-3-2 .trow.dead .pn { border-style: dashed; border-color: var(--line-2); background: var(--panel-2); text-decoration: line-through; }

      /* ---- step 8: memory slots, disk, and the suspend matrix ---- */
      .sec-3-2 .slots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .sec-3-2 .slot { border: 2px solid var(--mem); background: var(--mem-bg); border-radius: 10px; min-height: 60px; display: flex;
        flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 4px; }
      .sec-3-2 .slot.free { border-style: dashed; background: transparent; border-color: var(--line-2); color: var(--muted); font-size: 13px; font-style: italic; }
      .sec-3-2 .slot .sl, .sec-3-2 .dsk .sl { font-size: 12px; font-weight: 700; color: var(--ink-2); }
      .sec-3-2 .dsk { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; }
      .sec-3-2 .cpustat { font-weight: 800; font-size: 15px; }
      .sec-3-2 .cpustat.idle { color: var(--bad); }
      .sec-3-2 .cpustat.busy { color: var(--cpu); }
      .sec-3-2 .mx { display: grid; grid-template-columns: 110px repeat(2, minmax(0, 1fr)); gap: 8px; align-items: stretch; }
      .sec-3-2 .mx .hd { font-size: 13px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; display: flex; align-items: center; }
      .sec-3-2 .mx .hd.c { justify-content: center; text-align: center; }
      .sec-3-2 .mx .box { display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 15px; padding: 10px; }
      .sec-3-2 .mx .box small { font-weight: 500; font-size: 12.5px; color: var(--ink-2); }
      .sec-3-2 .mx .box.sus { border-style: dashed; }

      /* ---- misc ---- */
      .sec-3-2 .acts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
      .sec-3-2 .acts .btn { padding: 0 6px; }
      .sec-3-2 .kv { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; font-size: 15px; align-items: baseline; }
      .sec-3-2 .goal { display: flex; gap: 5px; flex-wrap: wrap; }
      .sec-3-2 .goal span { width: 26px; height: 26px; border-radius: 7px; display: inline-grid; place-items: center; font-size: 13px;
        font-weight: 800; border: 2px solid var(--line-2); color: var(--muted); background: var(--panel); }
      .sec-3-2 .goal span.done { background: var(--ok); border-color: var(--ok); color: var(--panel); }
      .sec-3-2 .goal span.cur { border-color: var(--accent); color: var(--accent); }
    `,

    steps: [
      /* ============ 1. Big picture: why states? (growing diagram) ============ */
      {
        title: 'One processor, many processes: why states?',
        kind: 'story',
        render(el, ctx) {
          const { h } = ctx;
          const INFO = {
            nr: ['Every process that is not on the processor, lumped together in one line.', 'Everyone who is not with the doctor. Waiting room, lab and front desk all count as one group.'],
            new: ['The OS has built the process’s records but has not yet let it compete for the processor.', 'You just walked in and are filling in forms at the front desk. The clinic knows your name but has not accepted you as a patient yet.'],
            ready: ['Able to run right now; only waiting for its turn on the processor.', 'You are in the waiting room. The moment the doctor is free, you can go in.'],
            running: ['Executing instructions on the processor. One processor means at most one Running process.', 'You are in the exam room with the doctor. With one doctor, only one patient can be in there.'],
            blocked: ['Cannot continue until some event happens, such as a disk read finishing.', 'You were sent for a blood test. Even if the doctor is free, there is nothing to discuss until the results come back.'],
            exit: ['Finished or aborted. It will never run again, though its records may linger briefly.', 'You have been discharged. The clinic keeps your file open a little longer to finish the paperwork.'],
            rs: ['Swapped out to disk but not waiting for anything: it can run once it is brought back into memory.', 'The waiting room was full, so you were sent to the overflow annex across the street. You could be seen, but first you must walk back over.'],
            bs: ['Swapped out to disk and still waiting for an event.', 'You are waiting for lab results and were moved to the annex. Two separate things keep you from the doctor.'],
          };
          const MODEL = {
            two: ['Two states: the simplest possible bookkeeping.', ['nr', 'running']],
            five: ['Five states: Not Running splits into Ready and Blocked; New and Exit are added.', ['new', 'ready', 'blocked', 'exit']],
            seven: ['Seven states: two suspended states for processes swapped out to disk.', ['rs', 'bs']],
          };
          const wrap = h('div', { style: { height: ctx.narrow ? 'auto' : '300px', display: 'grid', placeItems: 'center' } });
          const desc = h('p', { class: 'small muted m0' });
          const info = h('div', { class: 'msg info', style: { minHeight: '108px' } });
          let d = null, cur = 'five';
          const pick = (id) => {
            d.states((x) => (x === id ? 'on' : ''));
            say(info, 'info', `${NAME[id]} · in the OS`, `${INFO[id][0]}<div class="small" style="margin-top:6px"><b>In the clinic:</b> ${INFO[id][1]}</div>`);
          };
          const show = (key) => {
            cur = key;
            d = diagram(ctx, key, { onState: pick, label: MODEL[key][0] });
            d.svg.style.height = ctx.narrow ? 'auto' : '300px';
            d.svg.setAttribute('width', '100%');
            wrap.replaceChildren(d.svg);
            d.states((id) => (MODEL[key][1].includes(id) ? 'fresh' : ''));
            desc.textContent = MODEL[key][0] + ' Thick outlines mark the states this model adds.';
            say(info, 'info', 'Click a state', 'Click any box in the diagram to see what the state means to the OS, and what it would mean for a patient in the clinic.');
          };
          const seg = ctx.ui.seg([{ value: 'two', label: 'Two states' }, { value: 'five', label: 'Five states' }, { value: 'seven', label: 'Seven states' }], cur, show);
          show(cur);
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'A computer may host hundreds of processes but only a few processors. At any instant almost every process is <i>not</i> running. The OS needs a compact way to record where each one stands and what can happen to it next.' }),
              h('p', { class: 'm0', html: 'That record is the process’s <b>state</b>, kept in its <span class="t">process control block (PCB)</span>. A <b>state model</b> lists the possible states and the events that move a process from one state to another.' }),
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'Picture a small clinic with <b>one doctor</b> (the processor). Patients (processes) wait, go in one at a time, get sent off for lab tests, and are eventually discharged. Click the states in the diagram to see each one in clinic terms.' }),
              h('div', { class: 'card tight small', html: '<b>In this section you will</b> follow the processor through three interleaved programs, see why two states are not enough, play the OS in the five-state model, and swap processes out when memory runs short.' })),
            h('div', { class: 'card white stack' },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'A model that grows'), seg),
              desc, wrap, info)));
        },
      },

      /* ============ 2. Traces and the dispatcher (clickable memory map) ============ */
      {
        title: 'Traces: the footprints a process leaves',
        kind: 'learn',
        render(el, ctx) {
          const { h, s } = ctx;
          const R = {
            D: { name: 'Dispatcher', cls: 'D', top: 28, ht: 52, addr: '100', list: [[100, 101, 102, 103, 104, 105]], rows: ['every switch'],
              text: 'The dispatcher is OS code, not a user process. The same six instructions run <b>every time</b> the processor moves from one process to another: note where the old process stopped, choose the next one, and jump to where that one left off.' },
            A: { name: 'Process A', cls: 'A', top: 116, ht: 76, addr: '5000', list: [[5000, 5001, 5002, 5003, 5004, 5005], [5006, 5007, 5008, 5009, 5010, 5011]], rows: ['1st turn', '2nd turn'],
              text: 'From A’s own point of view these 12 instructions simply run one after another. In reality the processor is taken away after 5005 and does other work before 5006. A cannot tell: its registers are restored exactly as it left them.' },
            B: { name: 'Process B', cls: 'B', top: 218, ht: 42, addr: '8000', list: [[8000, 8001, 8002, 8003]], rows: ['1st turn'], flag: 8003,
              text: 'B’s trace is short. Its fourth instruction, at <b>8003</b>, asks for I/O (say, a disk read). B cannot continue until the device answers, so it gives up the processor after only 4 of its 6 allowed cycles.' },
            C: { name: 'Process C', cls: 'C', top: 286, ht: 76, addr: '12000', list: [[12000, 12001, 12002, 12003, 12004, 12005], [12006, 12007, 12008, 12009, 12010, 12011]], rows: ['1st turn', '2nd turn'],
              text: 'Like A, C is cut off after six instructions (a timeout) and later resumes at 12006 as if nothing had happened.' },
          };
          const svg = s('svg', { viewBox: '0 0 250 386', width: '100%', style: 'max-height:386px;max-width:250px;justify-self:center' });
          svg.append(s('text', { x: 165, y: 18, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, 'Main memory'));
          [[80, 36], [192, 26], [260, 26]].forEach(([y, ht]) => svg.append(
            s('rect', { x: 90, y, width: 150, height: ht, class: 'fGap' }),
            s('text', { x: 165, y: y + ht / 2 + 5, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 }, '⋯ other contents ⋯')));
          const groups = {};
          for (const [k, r] of Object.entries(R)) {
            const g = s('g', { class: 'mreg hot', role: 'button', tabindex: 0, 'aria-label': r.name },
              s('rect', { x: 90, y: r.top, width: 150, height: r.ht, rx: 6, class: 'f' + r.cls }),
              s('text', { x: 165, y: r.top + r.ht / 2 + 5, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, r.name),
              s('text', { x: 82, y: r.top + 14, 'text-anchor': 'end', class: 's-monot', 'font-size': 14, 'font-weight': 700 }, r.addr));
            g.addEventListener('click', () => pick(k));
            g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(k); } });
            groups[k] = g; svg.append(g);
          }
          svg.append(s('text', { x: 82, y: 380, 'text-anchor': 'end', class: 's-sub', 'font-size': 12.5 }, 'address ↓'));
          const panel = h('div', { class: 'stack', style: { gap: '10px' } });
          function pick(k) {
            Object.entries(groups).forEach(([x, g]) => g.classList.toggle('on', x === k));
            const r = R[k];
            panel.replaceChildren(...[
              h('h3', { class: 'm0' }, k === 'D' ? 'The dispatcher’s code' : `${r.name}’s own trace`),
              ...r.list.map((row, i) => h('div', { class: 'stack', style: { gap: '4px' } },
                h('div', { class: 'xs muted b' }, r.rows[i]),
                h('div', { style: { display: 'grid', gap: '6px', gridTemplateColumns: `repeat(${ctx.narrow ? 3 : 6}, minmax(0,1fr))` } },
                  row.map((a) => h('span', { class: 'addr c' + r.cls + (a === r.flag ? ' flag' : ''), title: a === r.flag ? 'I/O request' : '' }, String(a)))))),
              r.flag ? h('div', { class: 'row gap-s' }, h('span', { class: 'chip io' }, '8003 = I/O request'), h('span', { class: 'xs muted' }, 'B must now wait for the device')) : null,
              h('p', { class: 'm0 small', html: r.text })].filter(Boolean));
          }
          pick('A');
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'To see how the OS juggles processes, watch the processor’s <span class="t" data-t="Program counter (PC)">program counter</span> (PC): the register that holds the address of the next instruction.' }),
              h('p', { class: 'm0', html: 'The ordered list of addresses that one process executes is that process’s <span class="t">trace</span>. A small OS routine called the <span class="t">dispatcher</span> switches the processor from one process to another.' }),
              h('div', { class: 'card tight stack gap-s' },
                h('h4', { class: 'm0' }, 'The experiment'),
                h('ul', { class: 'm0 small', html: '<li>Processes A, B and C sit in memory at <b>5000</b>, <b>8000</b> and <b>12000</b>. The dispatcher sits at <b>100</b> and is 6 instructions long (100–105).</li><li>The OS lets a process run at most <b>6 instruction cycles</b>. Then a <b>timer interrupt</b> (a signal from the hardware clock) ends its turn: a <span class="t">timeout</span>.</li><li>B’s <b>4th</b> instruction requests I/O, so B stops early and must wait.</li>' })),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Try it', html: 'Click each region of memory to see the trace that program would record about itself.' })),
            h('div', { class: 'card white', style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'minmax(0,1fr)' : '250px minmax(0,1fr)', gap: '14px 18px', alignItems: 'start', alignContent: 'space-between' } }, svg, panel,
              h('div', { class: 'callout why m0 small', 'data-label': 'Two points of view', style: { gridColumn: '1 / -1' }, html: 'Each process only ever sees its <b>own</b> trace, as if it had the processor to itself. The processor sees all the traces <b>interleaved</b>, with the dispatcher’s code between them. The next step shows exactly that combined view.' }))));
        },
      },

      /* ============ 3. The interleaved trace, cycle by cycle (player) ============ */
      {
        title: 'Interleaved: what the processor actually sees',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          // segments of the combined trace: [who, first address, length, how the turn ends]
          const SEGS = [['A', 5000, 6, 'timeout'], ['D', 100, 6], ['B', 8000, 4, 'io'], ['D', 100, 6], ['C', 12000, 6, 'timeout'],
            ['D', 100, 6], ['A', 5006, 6, 'timeout'], ['D', 100, 6], ['C', 12006, 6, 'timeout']];
          // process states + ready queue (front first) while each segment runs; pick = whom the dispatcher chooses
          const SNAP = [
            { A: 'Running', B: 'Ready', C: 'Ready', q: ['B', 'C'] },
            { A: 'Ready', B: 'Ready', C: 'Ready', q: ['B', 'C', 'A'], pick: 'B' },
            { A: 'Ready', B: 'Running', C: 'Ready', q: ['C', 'A'] },
            { A: 'Ready', B: 'Blocked', C: 'Ready', q: ['C', 'A'], pick: 'C' },
            { A: 'Ready', B: 'Blocked', C: 'Running', q: ['A'] },
            { A: 'Ready', B: 'Blocked', C: 'Ready', q: ['A', 'C'], pick: 'A' },
            { A: 'Running', B: 'Blocked', C: 'Ready', q: ['C'] },
            { A: 'Ready', B: 'Blocked', C: 'Ready', q: ['C', 'A'], pick: 'C' },
            { A: 'Ready', B: 'Blocked', C: 'Running', q: ['A'] },
          ];
          const START0 = { A: 'Ready', B: 'Ready', C: 'Ready', q: ['A', 'B', 'C'] };
          const TOTAL = { A: 12, B: 4, C: 12 };
          const CY = [];
          SEGS.forEach(([who, start, n, end], si) => { for (let k = 0; k < n; k++) CY.push({ n: CY.length + 1, who, addr: start + k, k: k + 1, len: n, end: k === n - 1 ? end : null, seg: si }); });

          /* --- timeline (one cell per instruction cycle; wraps into 4 rows of 13 on phones) --- */
          const X0 = 20, CW = 20, PER = ctx.narrow ? 13 : 52, RH = 96, ROWS = 52 / PER;
          const pos = (n) => [X0 + ((n - 1) % PER) * CW, Math.floor((n - 1) / PER) * RH];
          const tl = s('svg', { viewBox: `0 0 ${X0 * 2 + PER * CW} ${ROWS * RH - 6}`, width: '100%' });
          let player = null;                      // created below; cells and rows jump the player to their cycle
          const jump = (n) => { if (player) { player.stop(); player.go(n); } };
          const cells = CY.map((c) => { const [x, y] = pos(c.n); const r = s('rect', { x: x + 1, y: y + 20, width: CW - 2, height: 30, rx: 3, class: 'cell f' + c.who }); r.addEventListener('click', () => jump(c.n)); return r; });
          tl.append(...cells);
          let segStart = 0;
          SEGS.forEach(([who, , n, end]) => {
            for (let a = segStart + 1; a <= segStart + n;) {           // one label per row-piece of the segment
              const rowEnd = Math.min(segStart + n, Math.ceil(a / PER) * PER);
              const [x1, y] = pos(a), x2 = pos(rowEnd)[0] + CW;
              tl.append(s('text', { x: (x1 + x2) / 2, y: y + 13, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: who === 'D' ? 'fill:var(--os)' : 'fill:var(--proc)' }, who === 'D' ? (rowEnd - a >= 3 ? 'Dispatcher' : 'D') : who));
              tl.append(s('text', { x: x1 + 3, y: y + 66, 'font-size': 12.5, class: 's-sub' }, String(a)));
              a = rowEnd + 1;
            }
            if (end) {
              const [xl, y] = pos(segStart + n), x2 = xl + CW;
              tl.append(s('line', { x1: x2, y1: y + 16, x2: x2, y2: y + 76, style: 'stroke:var(--intr);stroke-width:2' }),
                s('text', { x: x2, y: y + 88, 'text-anchor': end === 'io' ? 'middle' : x2 < 70 ? 'start' : 'end', 'font-size': 12, 'font-weight': 800, style: 'fill:var(--intr)' }, end === 'io' ? 'I/O request' : 'timeout'));
            }
            segStart += n;
          });
          const [xz, yz] = pos(52);
          tl.append(s('text', { x: xz + CW - 2, y: yz + 66, 'font-size': 12.5, 'text-anchor': 'end', class: 's-sub' }, '52'));
          const curBox = s('rect', { x: 0, y: 17, width: CW + 2, height: 36, rx: 4, class: 'curbox', style: 'display:none' });
          tl.append(curBox);

          /* --- combined trace list (4 columns x 13 rows) --- */
          const rows = CY.map((c) => h('div', { class: 'tr', role: 'button', tabindex: 0, title: `Jump to cycle ${c.n}`, onclick: () => jump(c.n), onkeydown: (e) => { if (e.key === 'Enter') jump(c.n); } },
            h('span', { class: 'n' }, String(c.n)), h('span', { class: 'sw c' + c.who }),
            h('span', {}, String(c.addr), c.end ? h('span', { class: 'ev' }, c.end === 'io' ? 'I/O' : 'timeout') : null)));
          const grid = h('div', { class: 'trgrid', style: ctx.narrow ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'repeat(26, 17px)' } : null }, rows);

          /* --- right-now panel --- */
          const nowTop = h('div', { class: 'row', style: { justifyContent: 'space-between' } });
          const stTbl = h('table', { class: 'tbl compact' });
          const queue = h('div', { class: 'row gap-s' });
          const ovh = h('div', { class: 'small' });
          const chipFor = (st) => `<span class="chip ${st === 'Running' ? 'cpu' : st === 'Blocked' ? 'warn' : 'proc'}">${st}</span>`;
          function draw(i) {
            const c = i ? CY[i - 1] : null;
            const snap = c ? SNAP[c.seg] : START0;
            cells.forEach((r, j) => r.classList.toggle('fut', j >= i));
            rows.forEach((r, j) => { r.classList.toggle('fut', j >= i); r.classList.toggle('cur', j === i - 1); });
            if (c) { const [x, y] = pos(c.n); curBox.style.display = ''; curBox.setAttribute('x', x - 1); curBox.setAttribute('y', y + 17); } else curBox.style.display = 'none';
            const done = { A: 0, B: 0, C: 0 };
            CY.slice(0, i).forEach((x) => { if (x.who !== 'D') done[x.who]++; });
            // on the last cycle of a turn, show the move the event causes (Running → Ready or Running → Blocked)
            const after = c && c.end ? (c.end === 'io' ? 'Blocked' : 'Ready') : null;
            const q = snap.q.concat(after === 'Ready' ? [c.who] : []);
            nowTop.innerHTML = c
              ? `<div><div class="xs muted b">CYCLE</div><div class="big" style="font-size:30px">${c.n}</div></div><div><div class="xs muted b">PC</div><div class="big mono" style="font-size:30px">${c.addr}</div></div><div><div class="xs muted b">OWNER</div><span class="chip ${c.who === 'D' ? 'os' : 'proc'}" style="font-size:14.5px">${c.who === 'D' ? 'Dispatcher (OS)' : 'Process ' + c.who}</span></div>`
              : '<div><div class="xs muted b">CYCLE</div><div class="big" style="font-size:30px">0</div></div><div class="small muted" style="max-width:250px">Nothing has run yet. Press Play or Next.</div>';
            stTbl.innerHTML = '<tr><th>Process</th><th>State</th><th>Done</th></tr>' + ['A', 'B', 'C'].map((p) =>
              `<tr${c && c.who === p ? ' class="on"' : ''}><td><b>${p}</b></td><td>${chipFor(snap[p])}${after && c.who === p ? ` <span class="muted">→</span> ${chipFor(after)}` : ''}</td><td class="mono">${done[p]} / ${TOTAL[p]}</td></tr>`).join('');
            queue.innerHTML = '<span class="xs muted b">READY QUEUE (front first)</span>' + (q.length ? q.map((p) => `<span class="chip proc">${p}</span>`).join('') : '<span class="xs muted">empty</span>') +
              (snap.pick ? `<span class="chip os">dispatcher picks ${snap.pick}</span>` : '');
            const nd = CY.slice(0, i).filter((x) => x.who === 'D').length;
            ovh.innerHTML = `<span class="xs muted b">DISPATCHER OVERHEAD SO FAR</span> <b>${nd}</b> of <b>${i}</b> cycles` + (i ? ` = <b>${Math.round((nd / i) * 100)}%</b>` : '');
          }
          function caption(i) {
            if (i === 0) return '<b>Before cycle 1.</b> All three processes are Ready and A is first in line. Press <b>Play</b>, step one cycle at a time, or click any cycle to jump to it.';
            const c = CY[i - 1];
            if (c.who === 'D') {
              const pk = SNAP[c.seg].pick;
              if (c.k === 1) return `<b>Cycle ${c.n}: the dispatcher starts</b> at address 100. No user process is running; the OS owns the processor while it picks the next process.` + (c.seg === 3 ? ' B is Blocked, so it is not in the ready queue and cannot be picked.' : '');
              if (c.k === c.len) return `<b>Cycle ${c.n}:</b> the dispatcher’s last instruction (105) hands the processor to <b>${pk}</b> by jumping to ${pk}’s next instruction.`;
              return `<b>Cycle ${c.n}:</b> dispatcher instruction ${c.addr} (${c.k} of 6). Necessary work, but no user program makes progress during it.`;
            }
            if (c.end === 'io') return `<b>Cycle ${c.n}: B executes 8003, an I/O request.</b> The request is a call into the OS, so the OS takes over. B cannot go on until the device answers, so it becomes <b>Blocked</b> after only 4 cycles, and the dispatcher runs next.`;
            if (c.end === 'timeout' && i === 52) return '<b>Cycle 52: C executes 12011; its time is up.</b> A ran 12 cycles, B 4, C 12, the dispatcher 24 (46%). That overhead is huge only because these turns are tiny: a real time slice lasts milliseconds, or millions of instructions.';
            if (c.end === 'timeout') return `<b>Cycle ${c.n}: ${c.who} executes ${c.addr}, its 6th cycle.</b> The timer interrupt fires: a <b>timeout</b>. ${c.who} goes to the back of the ready queue and the dispatcher takes over.`;
            const resumed = c.addr !== { A: 5000, B: 8000, C: 12000 }[c.who];
            if (c.k === 1) return `<b>Cycle ${c.n}: ${c.who} ${resumed ? 'resumes' : 'starts'}</b> at ${c.addr}${resumed ? ', exactly where it was stopped' : ''}. It may use up to 6 cycles.`;
            return `<b>Cycle ${c.n}:</b> ${c.who} executes the instruction at ${c.addr} (cycle ${c.k} of its 6).`;
          }
          player = ctx.ui.player({ count: CY.length + 1, interval: 700, render: (i) => { draw(i); return caption(i); } });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'card white tight' }, tl),
            h('div', { class: 'split r grow', style: { gap: '14px' } },
              h('div', { class: 'card stack gap-s' }, h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'baseline' } },
                h('h4', { class: 'm0' }, 'Combined trace · cycle and address'), h('span', { class: 'xs muted' }, 'click any cycle to jump there')), grid),
              h('div', { class: 'card stack gap-s' }, nowTop, stTbl, queue, ovh)),
            player.el));
        },
      },

      /* ============ 4. The two-state model and its flaw (queue simulator) ============ */
      {
        title: 'The two-state model, and where it breaks',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const d = diagram(ctx, 'two', { label: 'Two-state model: Not Running and Running' });
          let S;
          const reset = () => { S = { q: [{ id: 'P2', w: true }, { id: 'P3', w: false }, { id: 'P4', w: true }], run: { id: 'P1', w: false }, out: [], next: 5, wasted: 0, idle: 0, skip: [] }; };
          const laneQ = h('div', { class: 'toks' }), laneR = h('div', { class: 'toks' }), laneX = h('div', { class: 'toks' });
          const msg = h('div', { class: 'msg', style: { minHeight: '92px' } });
          const stats = h('div', { class: 'row gap-s' });
          const tok = (p, extra = '') => h('span', { class: 'tok' + extra, style: { cursor: 'default' } }, p.id, p.w ? h('span', { class: 'tag' }, 'disk') : null);
          function paint(arrow) {
            laneQ.replaceChildren(...(S.q.length ? S.q.map((p) => tok(p, S.skip.includes(p.id) ? ' skip' : '')) : [h('span', { class: 'empty' }, 'empty')]));
            laneR.replaceChildren(S.run ? tok(S.run, ' run') : h('span', { class: 'empty' }, 'idle: no process running'));
            laneX.replaceChildren(...(S.out.length ? S.out.map((p) => tok(p, ' ex')) : [h('span', { class: 'empty' }, 'none yet')]));
            stats.innerHTML = `<span class="chip ${S.wasted ? 'bad' : ''}">useless checks: ${S.wasted}</span><span class="chip ${S.idle ? 'bad' : ''}">times the processor sat idle: ${S.idle}</span>`;
            d.arrows((id) => (id === arrow ? 'on' : ''));
            d.states((id) => (id === 'running' && S.run ? 'on' : ''));
          }
          const busy = () => { say(msg, 'bad', 'Refused', `The processor is busy running <b>${S.run.id}</b>. With one processor only one process can be Running. Pause it or let it exit first.`); paint(); };
          const none = () => { say(msg, 'bad', 'Refused', 'Nothing is running right now, so there is no process to pause or finish. Dispatch one first.'); paint(); };
          const act = {
            enter() {
              if (S.q.length + (S.run ? 1 : 0) >= 7) { say(msg, 'bad', 'Queue full', 'Seven processes is plenty for this demo. Let one exit first.'); return paint(); }
              const p = { id: 'P' + S.next++, w: false }; S.q.push(p); S.skip = [];
              say(msg, 'ok', 'Enter', `<b>${p.id}</b> is created and joins the <b>back</b> of the queue of not-running processes.`); paint('enter');
            },
            dispatch() {
              if (S.run) return busy();
              if (!S.q.length) { say(msg, 'bad', 'Nothing to run', 'The queue is empty, so the processor has nothing to do.'); return paint(); }
              S.skip = [];
              const i = S.q.findIndex((p) => !p.w);
              if (i < 0) {
                S.skip = S.q.map((p) => p.id); S.wasted += S.q.length; S.idle++;
                say(msg, 'bad', 'Stuck', `The dispatcher checked all ${S.q.length} queued processes and <b>every one is waiting for the disk</b>. Nothing can run, so the processor sits idle, and the OS wasted time finding that out.`);
                return paint();
              }
              S.skip = S.q.slice(0, i).map((p) => p.id); S.wasted += i;
              S.run = S.q.splice(i, 1)[0];
              say(msg, i ? 'bad' : 'ok', i ? 'Dispatch, the hard way' : 'Dispatch',
                i ? `The front of the queue was <b>${S.skip.join(', ')}</b>, still waiting for the disk. Running ${i > 1 ? 'them' : 'it'} would be pointless, so the dispatcher had to skip ${i > 1 ? 'them' : 'it'} and search further back before dispatching <b>${S.run.id}</b>.`
                  : `The process at the front of the queue, <b>${S.run.id}</b>, can run, so the dispatcher gives it the processor.`);
              paint('dispatch');
            },
            pause() {
              if (!S.run) return none();
              const p = S.run; S.run = null; S.q.push(p); S.skip = [];
              say(msg, 'ok', 'Pause', `<b>${p.id}</b>’s time is up. It goes to the back of the queue and the processor is free.`); paint('pause');
            },
            io() {
              if (!S.run) return none();
              const p = S.run; p.w = true; S.run = null; S.q.push(p); S.skip = [];
              say(msg, 'info', 'Request I/O', `<b>${p.id}</b> asks for a disk read and must wait. The only place for it is the same queue, marked as waiting. Look at the diagram: it used the same <b>pause</b> arrow. This model cannot tell “my time is up” from “I am waiting for the disk”.`);
              paint('pause');
            },
            exit() {
              if (!S.run) return none();
              const p = S.run; S.run = null; S.out.push(p); S.skip = [];
              say(msg, 'ok', 'Exit', `<b>${p.id}</b> finishes and leaves the system for good.`); paint('exit');
            },
            disk() {
              const ws = S.q.filter((p) => p.w); S.skip = [];
              if (!ws.length) { say(msg, 'info', 'Disk finishes', 'No process in the queue was waiting for the disk, so nothing changes.'); return paint(); }
              ws.forEach((p) => (p.w = false));
              say(msg, 'info', 'Disk finishes', `<b>${ws.map((p) => p.id).join(', ')}</b> can run again. The OS had to hunt for ${ws.length > 1 ? 'them' : 'it'} inside the one big queue and clear the waiting marks.`);
              paint();
            },
          };
          const B = (label, fn, cls = 'btn sm') => h('button', { class: cls, type: 'button', onclick: fn }, label);
          const intro = () => say(msg, '', '', 'Start by pressing <b>Dispatch</b> while P1 is running. Then <b>Pause</b> P1 and <b>Dispatch</b> again: notice P2 at the front is waiting for the disk. Try <b>Request I/O</b> too.');
          reset(); paint(); intro();
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'The simplest model says a process is either <span class="t" data-t="Running state">Running</span> or Not Running. That is the <span class="t">two-state model</span>.' }),
              h('div', { class: 'card white tight' }, d.svg),
              h('p', { class: 'm0 small', html: 'Not-running processes wait in <b>one queue</b>. <b>Enter</b>: a new process joins the back. <b>Dispatch</b>: the processor is given to a process from the queue. <b>Pause</b>: the running process is interrupted and rejoins the back. <b>Exit</b>: the running process finishes and leaves.' }),
              h('div', { class: 'callout warn m0 small', 'data-label': 'The flaw', html: 'Some not-running processes are <b>waiting for I/O</b> and could not run even if chosen. With only one queue, the dispatcher cannot simply take the front: it must search past them. The fix, next: split Not Running into <b>Ready</b> and <b>Blocked</b>.' })),
            h('div', { class: 'card stack' },
              h('div', { class: 'lane' }, h('div', { class: 'lbl', html: 'Queue<small>Not Running · front on the left</small>' }), laneQ),
              h('div', { class: 'lane cpu' }, h('div', { class: 'lbl', html: 'Processor<small>Running</small>' }), laneR),
              h('div', { class: 'lane' }, h('div', { class: 'lbl', html: 'Exited<small>gone for good</small>' }), laneX),
              actGrid(ctx, 4,
                B('Enter new', act.enter), B('Dispatch', act.dispatch, 'btn sm primary'), B('Pause (timeout)', act.pause), B('Exit (finish)', act.exit),
                B('Request I/O', act.io, 'btn sm io'), B('Disk finishes', act.disk, 'btn sm io'), B('Reset', () => { reset(); paint(); intro(); }, 'btn sm')),
              stats, msg,
              h('div', { class: 'row gap-s xs muted', style: { marginTop: 'auto' } },
                h('span', { class: 'tok', style: { cursor: 'default', width: '40px', height: '28px' } }, 'P', h('span', { class: 'tag' }, 'disk')), 'waiting for a disk read',
                h('span', { class: 'tok skip', style: { cursor: 'default', width: '40px', height: '28px' } }, 'P'), 'checked by the dispatcher for nothing'))));
        },
      },

      /* ============ 5. Creation and termination (classification games + spawn tree) ============ */
      {
        title: 'Why processes are born, and why they end',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          /* a scenario-classification game: read a scenario, click the reason that explains it */
          function game(reasons, scen, order, o) {
            let idx = 0, tries = 0, first = 0, solvedNow = false;
            const done = new Set();
            const btns = reasons.map((r, i) => h('button', { class: 'btn rbtn', type: 'button', onclick: () => choose(i) }, r[0]));
            const head = h('div', { class: 'row', style: { justifyContent: 'space-between' } });
            const text = h('div', { class: 'scen' });
            const fb = h('div', { class: 'msg', style: { minHeight: o.fbH || '96px' } });
            const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { if (idx >= order.length) { idx = 0; first = 0; done.clear(); } else idx++; tries = 0; show(); } });
            const bar = h('i', { style: { width: '0%' } }), barTxt = h('div', { class: 'xs muted b' });
            const meter = h('div', { class: 'stack', style: { gap: '4px', marginTop: 'auto' } }, barTxt, h('div', { class: 'meter' }, bar));
            const upd = () => { const n = Math.min(idx + (solvedNow ? 1 : 0), order.length); bar.style.width = (n / order.length) * 100 + '%'; barTxt.textContent = `MATCHED SO FAR: ${n} OF ${order.length}`; };
            function show() {
              solvedNow = false; upd();
              btns.forEach((b, i) => { b.classList.remove('wrong'); b.classList.toggle('done', !!o.persist && done.has(i)); });
              if (idx >= order.length) {
                head.innerHTML = `<h4 class="m0">All ${order.length} matched</h4><span class="chip ok">${first} of ${order.length} on the first try</span>`;
                text.textContent = 'Every scenario is matched to its reason.';
                say(fb, 'ok', 'Finished', o.finish);
                next.textContent = 'Start over'; next.disabled = false; return;
              }
              head.innerHTML = `<h4 class="m0">${o.ask} · ${idx + 1} of ${order.length}</h4><span class="chip">${first} right first try</span>`;
              text.textContent = scen[order[idx]][0];
              say(fb, '', '', o.hint);
              next.textContent = idx === order.length - 1 ? 'Finish ▶' : 'Next scenario ▶'; next.disabled = true;
            }
            function choose(i) {
              if (idx >= order.length || solvedNow) return;
              const ans = scen[order[idx]][1];
              btns.forEach((b) => b.classList.remove('wrong'));
              if (i === ans) {
                solvedNow = true; if (!tries) first++; done.add(i);
                btns[i].classList.add('done');
                say(fb, 'ok', tries ? 'Right (on a later try)' : 'Right', `<b>${reasons[i][0]}</b>: ${reasons[i][1]}`);
                head.querySelector('.chip').textContent = `${first} right first try`;
                next.disabled = false; upd();
              } else {
                tries++; btns[i].classList.add('wrong');
                say(fb, 'bad', 'Not this one', `<b>${reasons[i][0]}</b> means: ${reasons[i][1]} Read the scenario again and try another reason.`);
              }
            }
            show();
            return { btns, head, text, fb, next, meter };
          }

          /* ---- tab 1: creation ---- */
          const tabCreate = (p) => {
            const g = game(CREATE, CREATE_SCEN, [0, 1, 2, 3, 4, 5], { ask: 'Why was this process created?', hint: 'Pick one of the four reasons above.', finish: 'All four reasons in action. Remember that the fourth, spawning, is how most processes on a modern desktop are born.' });
            p.append(h('div', { class: 'split fill' },
              h('div', { class: 'stack gap-s' },
                h('p', { class: 'm0', html: 'Each new process gets a <span class="t">process control block (PCB)</span> and memory. Four kinds of event typically create one:' }),
                ...CREATE.map(([n, d], i) => h('div', { class: 'card tight small' }, h('b', {}, `${i + 1}. ${n}. `), d)),
                h('div', { class: 'callout why m0 small', 'data-label': 'Spawning', html: 'Reason 4 is <span class="t">process spawning</span>: the creator is the <span class="t">parent process</span>, the new one its <span class="t">child process</span>. Build a family tree in the next tab.' })),
              h('div', { class: 'card white stack' }, g.head, g.text, h('div', { class: 'stack gap-s' }, ...g.btns), g.fb, h('div', { class: 'row' }, g.next), g.meter)));
          };

          /* ---- tab 2: parent and child ---- */
          const tabSpawn = (p) => {
            const NAMES = ['editor', 'compiler', 'print helper', 'browser', 'browser tab', 'downloader', 'music player', 'backup tool', 'viewer'];
            let nodes, sel, k, cascade = true;
            const reset = () => { nodes = [{ id: 0, name: 'shell', parent: null, alive: true, why: '' }]; sel = 0; k = 0; };
            const tree = h('div', { class: 'stack', style: { gap: '4px' } });
            const msg = h('div', { class: 'msg', style: { minHeight: '100px' } });
            const kids = (id) => nodes.filter((n) => n.parent === id);
            function end(n, why, log) {
              n.alive = false; n.why = why; log.push(`${n.name} (${why})`);
              kids(n.id).filter((c) => c.alive).forEach((c) => { if (cascade) end(c, 'parent termination', log); });
            }
            function paint() {
              const rows = [];
              const walk = (n, depth) => { rows.push([n, depth]); kids(n.id).forEach((c) => walk(c, depth + 1)); };
              walk(nodes[0], 0);
              tree.replaceChildren(...rows.map(([n, depth]) => h('button', { type: 'button', class: 'trow' + (n.id === sel ? ' sel' : '') + (n.alive ? '' : ' dead'), onclick: () => { sel = n.id; paint(); } },
                h('span', { class: 'branch' }, depth ? '   '.repeat(depth - 1) + '└─' : ''),
                h('span', { class: 'pn' }, n.name),
                h('span', { class: 'xs muted' }, n.alive ? (n.parent == null ? 'the first process here' : `child of ${nodes[n.parent].name}`) : `ended: ${n.why}`))));
            }
            const S = () => nodes[sel];
            const act = {
              spawn() {
                if (!S().alive) return say(msg, 'bad', 'Refused', `${S().name} has ended, and an ended process cannot create anything.`);
                if (nodes.filter((n) => n.alive).length >= 7 || nodes.length >= 10) return say(msg, 'bad', 'That is enough', 'The tree is full for this demo. Press Reset to start again.');
                const c = { id: nodes.length, name: NAMES[k++ % NAMES.length], parent: sel, alive: true, why: '' };
                nodes.push(c);
                say(msg, 'ok', 'Spawned', `<b>${S().name}</b> asked the OS to create <b>${c.name}</b>. ${S().name} is the parent; ${c.name} is its child, a separate process with its own PCB. Both keep running.`); paint();
              },
              finish() {
                if (!S().alive) return say(msg, 'bad', 'Refused', `${S().name} has already ended.`);
                const log = []; const n = S(); end(n, 'normal completion', log);
                say(msg, 'info', 'Ended', `<b>${n.name}</b> finished normally. ` + (log.length > 1 ? `Because this OS ends a parent’s children too, these also ended: ${log.slice(1).join(', ')}.` : kids(n.id).some((c) => c.alive) ? 'Its children keep running without their parent (UNIX-like systems hand such orphans to another process to look after).' : '')); paint();
              },
              kill() {
                const n = S();
                if (!n.alive) return say(msg, 'bad', 'Refused', `${n.name} has already ended.`);
                if (n.parent == null || !nodes[n.parent].alive) return say(msg, 'bad', 'Refused', `${n.name} has no living parent to make the request.`);
                const log = []; end(n, 'parent request', log);
                say(msg, 'info', 'Parent request', `<b>${nodes[n.parent].name}</b> asked the OS to end its child <b>${n.name}</b>.` + (log.length > 1 ? ` The cascade also ended: ${log.slice(1).join(', ')}.` : '')); paint();
              },
            };
            const seg = ctx.ui.seg([{ value: true, label: 'Children end too' }, { value: false, label: 'Children live on' }], cascade, (v) => { cascade = v; });
            reset(); paint();
            say(msg, '', '', 'Select a process in the tree, then spawn children, finish one, or have a parent end its child.');
            p.append(h('div', { class: 'split fill' },
              h('div', { class: 'stack' },
                h('p', { class: 'm0', html: 'A process can ask the OS to create another process: <span class="t">process spawning</span>. The pair is called <b>parent</b> and <b>child</b>, and a child can spawn children of its own, so processes form a family tree.' }),
                h('div', { class: 'card tight stack gap-s' }, h('div', { class: 'small b' }, 'When a parent ends, this OS makes its children…'), seg),
                h('div', { class: 'row' },
                  h('button', { class: 'btn sm primary', type: 'button', onclick: act.spawn }, 'Spawn a child'),
                  h('button', { class: 'btn sm', type: 'button', onclick: act.finish }, 'Finish normally'),
                  h('button', { class: 'btn sm', type: 'button', onclick: act.kill }, 'Parent ends this child'),
                  h('button', { class: 'btn sm', type: 'button', onclick: () => { reset(); paint(); say(msg, '', '', 'Fresh start: just the shell.'); } }, 'Reset')),
                msg,
                h('div', { class: 'callout why m0 small', 'data-label': 'Two termination reasons live here', html: '<b>Parent termination</b>: on systems that choose to, ending a parent also ends all of its children. <b>Parent request</b>: a parent usually has the authority to ask the OS to end any child it created.' })),
              h('div', { class: 'card white stack gap-s' }, h('h4', { class: 'm0' }, 'Process family tree (click to select)'), tree)));
          };

          /* ---- tab 3: termination ---- */
          const tabTerm = (p) => {
            const g = game(TERM.map(([n, d]) => [n, d]), TERM.map(([, , s], i) => [s, i]), [5, 0, 7, 3, 13, 9, 1, 11, 4, 8, 12, 2, 10, 6],
              { persist: true, ask: 'Why was this process ended?', hint: 'Click the reason that fits best.', finish: 'You have seen all fourteen reasons. The ones in the middle of the list are the process doing something illegal, which the hardware or OS catches.', fbH: '118px' });
            p.append(h('div', { class: 'split fill' },
              h('div', { class: 'card stack gap-s' },
                h('h4', { class: 'm0' }, 'Fourteen reasons a process ends'), h('div', { class: 'rgrid', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0,1fr)' } : null }, ...g.btns),
                h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '<b>Time limit exceeded</b> is about running too long in total. <b>Time overrun</b> is about <i>waiting</i> too long for an event.' })),
              h('div', { class: 'card white stack' }, g.head, g.text, g.fb, h('div', { class: 'row' }, g.next), g.meter)));
          };

          el.append(ctx.ui.tabs([
            { label: 'Creation: 4 reasons', render: tabCreate },
            { label: 'Parent and child', render: tabSpawn },
            { label: 'Termination: 14 reasons', render: tabTerm },
          ]));
        },
      },

      /* ============ 6. Be the OS: five-state simulator ============ */
      {
        title: 'Be the OS: drive processes through five states',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const TRIG = {
            create: ['Null → New', 'A process is created for one of the four reasons: a batch job, a log-on, an OS service, or spawning by another process.'],
            admit: ['New → Ready', 'The OS is prepared to take on one more process. Most systems cap the number of processes, or the memory promised to them, so that the machine is not overloaded. Until there is room, the process waits in New.'],
            dispatch: ['Ready → Running', 'The processor is free and the dispatcher chooses this process from the ready queue.'],
            timeout: ['Running → Ready', 'The process used up its time slice (a <span class="t">timeout</span>), or the OS took the processor for a more important process (<span class="t">preemption</span>). Occasionally a process gives up the processor voluntarily.'],
            wait: ['Running → Blocked', 'The running process asks for something it must wait for: an I/O operation, a message, or a resource that is busy.'],
            occurs: ['Blocked → Ready', 'The event the process was waiting for happens, for example its disk read completes. It rejoins the ready queue.'],
            release: ['Running → Exit', 'The process finishes its work, or is aborted while it runs (say, after a protection error).'],
            killReady: ['Ready → Exit', 'Another party ends the process while it waits its turn, for example its parent terminates it.'],
            killBlocked: ['Blocked → Exit', 'Another party ends the process while it waits for an event, for example its parent terminates it.'],
          };
          const ORDER = ['create', 'admit', 'dispatch', 'timeout', 'wait', 'occurs', 'release', 'killReady', 'killBlocked'];
          let lanes, sel, used, last, nextId, triedBR;
          const reset = () => { lanes = { new: ['P5'], ready: ['P2', 'P3'], running: ['P1'], blocked: ['P4'], exit: [] }; sel = null; used = new Set(); last = null; nextId = 6; triedBR = false; };
          const stateOf = (id) => Object.keys(lanes).find((k) => lanes[k].includes(id));
          const move = (id, to) => { const f = stateOf(id); lanes[f] = lanes[f].filter((x) => x !== id); lanes[to].push(id); };
          const msg = h('div', { class: 'msg', style: { minHeight: '128px' } });
          const d = diagram(ctx, 'five', { counts: true, label: 'Five-state model', onArrow: (a) => { d.clearGhost(); paint(a); say(msg, 'info', TRIG[a][0], TRIG[a][1]); }, onState: (s) => { d.clearGhost(); paint(); d.state(s, 'on'); say(msg, 'info', NAME[s], `${ctx.util.esc(({ new: 'Created but not yet admitted.', ready: 'Could run now; waiting for the processor.', running: 'On the processor right now (at most one).', blocked: 'Waiting for an event; cannot use the processor even if it is free.', exit: 'Finished or killed; never runs again.' })[s])} It holds <b>${lanes[s].length}</b> process${lanes[s].length === 1 ? '' : 'es'} now.`); } });
          const laneEls = {};
          const progress = h('div', { class: 'row gap-s' });
          function paint(hl) {
            for (const k of Object.keys(lanes)) {
              laneEls[k].replaceChildren(...(lanes[k].length ? lanes[k].map((id) => h('button', { type: 'button', class: tokCls(k) + (id === sel ? ' sel' : ''), onclick: () => { sel = sel === id ? null : id; d.clearGhost(); paint(); }, 'aria-label': `Select ${id}` }, id))
                : [h('span', { class: 'empty' }, k === 'running' ? 'processor idle' : 'empty')]));
              d.count(k, lanes[k].length);
            }
            d.arrows((a) => (a === (hl || last) ? 'on' : used.has(a) ? 'used' : ''));
            d.states((s) => (sel && stateOf(sel) === s ? 'on' : ''));
            progress.innerHTML = `<span class="chip ${used.size === 9 ? 'ok' : 'accent'}">transitions used: ${used.size} / 9</span>` +
              ORDER.map((a) => `<span class="chip ${used.has(a) ? 'ok' : ''}" style="${used.has(a) ? '' : 'opacity:.6'}">${TRIG[a][0]}</span>`).join('') +
              `<span class="chip ${triedBR ? 'ok' : 'warn'}">${triedBR ? '✓ tried' : 'try'} the forbidden Blocked → Running</span>`;
          }
          const ok = (arrow, head, html) => { used.add(arrow); last = arrow; sel = null; say(msg, 'ok', head, html); paint(); };
          const no = (html, from, to) => { say(msg, 'bad', 'Refused', html); paint(); if (from && to) d.ghost(from, to); };
          const gone = (id) => no(`<b>${id}</b> has exited. The OS may keep its records briefly (for example so its parent can collect results), but it will never run again.`);
          function act(a) {
            d.clearGhost();
            if (a === 'create') {
              if (Object.keys(lanes).filter((k) => k !== 'exit').reduce((n, k) => n + lanes[k].length, 0) >= 8) return no('Eight live processes is plenty for this simulator. Finish or terminate some first.');
              const id = 'P' + nextId++; lanes.new.push(id);
              return ok('create', 'Null → New', `<b>${id}</b> is created. The OS has built its PCB, but it is not yet admitted to compete for the processor.`);
            }
            let id = sel;
            if (!id) id = { dispatch: lanes.ready[0], timeout: lanes.running[0], wait: lanes.running[0], release: lanes.running[0], admit: lanes.new[0], occurs: lanes.blocked[0] }[a];
            if (!id) return no('Select a process first: click one of the tokens in the lanes, then choose what happens to it.');
            const st = stateOf(id), run = lanes.running[0];
            if (st === 'exit') return gone(id);
            if (a === 'admit') {
              if (st !== 'new') return no(`<b>${id}</b> is already ${NAME[st]}. Only a New process can be admitted.`);
              move(id, 'ready'); return ok('admit', 'New → Ready (admit)', `<b>${id}</b> is admitted and joins the back of the ready queue.`);
            }
            if (a === 'dispatch') {
              if (st === 'blocked') { triedBR = true; return no(`<b>No Blocked → Running arrow.</b> ${id} is waiting for an event. If it got the processor it would still be stuck, so the processor would be wasted. When its event occurs it goes to <b>Ready</b> first and waits its turn like everyone else.`, 'blocked', 'running'); }
              if (st === 'new') return no(`<b>${id}</b> has not been admitted yet. The dispatcher only chooses from the ready queue.`, 'new', 'running');
              if (st === 'running') return no(`<b>${id}</b> is already running.`);
              if (run) return no(`The processor is busy running <b>${run}</b>. With one processor, only one process can be Running. Time it out, or let it block or finish first.`);
              move(id, 'running'); return ok('dispatch', 'Ready → Running (dispatch)', `The dispatcher gives the processor to <b>${id}</b>.` + (lanes.ready.length ? ` Still waiting in the ready queue: ${lanes.ready.join(', ')}.` : ''));
            }
            if (a === 'timeout') {
              if (st !== 'running') return no(`Only the Running process can time out: a timeout means the OS takes the processor from whoever is using it. <b>${id}</b> is ${NAME[st]}.`);
              move(id, 'ready'); return ok('timeout', 'Running → Ready (timeout)', `<b>${id}</b>’s time slice is used up. It goes to the <b>back</b> of the ready queue; the processor is now free.`);
            }
            if (a === 'wait') {
              if (st === 'ready') return no(`<b>${id}</b> is not executing, so it cannot ask for I/O. Only the running process can issue a request that makes it wait.`, 'ready', 'blocked');
              if (st !== 'running') return no(`Only the running process can start waiting for an event. <b>${id}</b> is ${NAME[st]}.`);
              move(id, 'blocked'); return ok('wait', 'Running → Blocked (event wait)', `<b>${id}</b> asks for a disk read and must wait for it. It moves to Blocked and frees the processor for someone else.`);
            }
            if (a === 'occurs') {
              if (st !== 'blocked') return no(`<b>${id}</b> is not waiting for anything, so there is no event to occur for it.`);
              move(id, 'ready'); return ok('occurs', 'Blocked → Ready (event occurs)', `The disk read for <b>${id}</b> has finished. It joins the ready queue; it does <b>not</b> jump straight onto the processor.`);
            }
            if (a === 'release') {
              if (st !== 'running') return no(`Release means the running process ends. <b>${id}</b> is ${NAME[st]}, not running. To end it from outside, use Terminate.`);
              move(id, 'exit'); return ok('release', 'Running → Exit (release)', `<b>${id}</b> finishes and releases the processor for good.`);
            }
            if (a === 'kill') {
              if (st === 'new') return no('The five-state model lists no New → Exit transition: the usual cases are a Running process ending, or a parent ending a Ready or Blocked child. (The seven-state model later allows Exit from any state.)');
              move(id, 'exit');
              if (st === 'running') return ok('release', 'Running → Exit (aborted)', `<b>${id}</b> is aborted while running. That uses the same Running → Exit arrow as a normal finish.`);
              return ok(st === 'ready' ? 'killReady' : 'killBlocked', `${NAME[st]} → Exit (terminated)`, `<b>${id}</b> never gets to finish: its parent (or the OS) terminates it while it is ${NAME[st]}.`);
            }
          }
          const B = (label, a, cls = 'btn sm') => h('button', { class: cls, type: 'button', onclick: () => act(a) }, label);
          const lane = (k, lbl, sub, extra = '') => { laneEls[k] = h('div', { class: 'toks' }); return h('div', { class: 'lane' + extra }, h('div', { class: 'lbl', html: `${lbl}<small>${sub}</small>` }), laneEls[k]); };
          reset();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' }, h('div', { class: 'card white tight' }, d.svg), msg),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'row nw', style: { alignItems: 'flex-start', gap: '12px' } },
                h('p', { class: 'm0 small grow', html: 'You are the OS. <b>Click a process</b>, then a transition. With nothing selected, a button acts on the obvious process (Dispatch takes the front of the ready queue). Click diagram arrows for real-world triggers.' }),
                h('button', { class: 'btn sm', type: 'button', onclick: () => { reset(); d.clearGhost(); paint(); say(msg, '', '', 'Reset to the starting situation.'); } }, 'Reset')),
              lane('new', 'New', 'created, not admitted'), lane('ready', 'Ready queue', 'front on the left'), lane('running', 'Running', 'the one processor', ' cpu'),
              lane('blocked', 'Blocked', 'waiting for an event'), lane('exit', 'Exit', 'finished or killed'),
              actGrid(ctx, 4, B('Create', 'create'), B('Admit', 'admit'), B('Dispatch', 'dispatch', 'btn sm primary'), B('Timeout', 'timeout'),
                B('Event wait', 'wait'), B('Event occurs', 'occurs'), B('Release', 'release'), B('Terminate', 'kill', 'btn sm danger')),
              progress)));
          paint();
          say(msg, '', '', 'This is the <span class="t">five-state model</span>. P1 is <span class="t" data-t="Running state">Running</span>, P2 and P3 are <span class="t" data-t="Ready state">Ready</span>, P4 is <span class="t" data-t="Blocked state">Blocked</span> on the disk and P5 is <span class="t" data-t="New state">New</span>. Use all nine arrows (finished processes go to <span class="t" data-t="Exit state">Exit</span>), and try the move the model forbids: dispatching a Blocked process.');
        },
      },

      /* ============ 7. Queues: one blocked queue or many; priority ready queues ============ */
      {
        title: 'Queues: one line for blocked processes, or many?',
        kind: 'compare',
        render(el, ctx) {
          const { h } = ctx;
          const EV = { disk: 'disk', prn: 'printer', key: 'keyboard' };
          const tk = (p, extra = '') => h('span', { class: 'tok ev2' + extra, style: { cursor: 'default' } }, p.id, p.ev ? h('span', { class: 'evn' }, EV[p.ev]) : null);
          const emptyEl = (t) => h('span', { class: 'empty' }, t || 'empty');

          /* ---- tab 1: one blocked queue versus one queue per event ---- */
          const tabBlocked = (panel) => {
            const START = [['P1', 'disk'], ['P2', 'key'], ['P3', 'disk'], ['P4', 'prn'], ['P5', 'key'], ['P6', 'disk'], ['P7', 'prn'], ['P8', 'disk']];
            let one, many, readyL, readyR, costL, costR, skipped;
            const reset = () => {
              one = START.map(([id, ev]) => ({ id, ev }));
              many = { disk: [], prn: [], key: [] }; one.forEach((p) => many[p.ev].push({ ...p }));
              readyL = []; readyR = []; costL = 0; costR = 0; skipped = [];
            };
            const L = { blocked: h('div', { class: 'toks' }), ready: h('div', { class: 'toks' }), cost: h('span', { class: 'chip bad' }) };
            const R = { disk: h('div', { class: 'toks' }), prn: h('div', { class: 'toks' }), key: h('div', { class: 'toks' }), ready: h('div', { class: 'toks' }), cost: h('span', { class: 'chip ok' }) };
            const laneR = {};
            const msgL = h('div', { class: 'msg small', style: { minHeight: '64px' } }), msgR = h('div', { class: 'msg small', style: { minHeight: '64px' } });
            function paint(hit) {
              L.blocked.replaceChildren(...(one.length ? one.map((p) => tk(p, ' blk' + (skipped.includes(p.id) ? ' skip' : ''))) : [emptyEl()]));
              L.ready.replaceChildren(...(readyL.length ? readyL.map((p) => tk({ id: p.id })) : [emptyEl()]));
              for (const e of Object.keys(EV)) { R[e].replaceChildren(...(many[e].length ? many[e].map((p) => tk(p, ' blk')) : [emptyEl()])); laneR[e].classList.toggle('hit', e === hit); }
              R.ready.replaceChildren(...(readyR.length ? readyR.map((p) => tk({ id: p.id })) : [emptyEl()]));
              L.cost.textContent = `PCBs touched: ${costL}`; R.cost.textContent = `PCBs touched: ${costR}`;
            }
            function fire(ev) {
              const n = one.length, woke = one.filter((p) => p.ev === ev);
              one = one.filter((p) => p.ev !== ev); skipped = one.map((p) => p.id); costL += n; readyL.push(...woke);
              const w2 = many[ev]; many[ev] = []; costR += w2.length; readyR.push(...w2);
              say(msgL, woke.length ? 'bad' : '', `Scanned ${n} PCB${n === 1 ? '' : 's'}`, n ? `The OS checked every blocked process to find those waiting for the ${EV[ev]}: ${woke.length ? woke.map((p) => p.id).join(', ') + ' woke up' : 'none were'}. The red ones were checked for nothing.` : 'No blocked processes left.');
              say(msgR, 'ok', `Went straight to the ${EV[ev]} queue`, w2.length ? `Every process in that queue was waiting for exactly this event, so the OS moved all ${w2.length} (${w2.map((p) => p.id).join(', ')}) to Ready without looking at anyone else.` : `The ${EV[ev]} queue is empty, so there was nothing to do and nothing to search.`);
              paint(ev);
            }
            const lane = (lbl, sub, toks, cls = '') => h('div', { class: 'lane sm ' + cls }, h('div', { class: 'lbl', html: `${lbl}<small>${sub}</small>` }), toks);
            ['disk', 'prn', 'key'].forEach((e) => (laneR[e] = lane(`${EV[e][0].toUpperCase() + EV[e].slice(1)} queue`, 'blocked', R[e])));
            reset(); paint();
            say(msgL, '', '', 'One list holds every blocked process, whatever it is waiting for.');
            say(msgR, '', '', 'A separate list for each event: disk, printer, keyboard.');
            panel.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
              h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Make an event happen:'),
                h('button', { class: 'btn sm io', type: 'button', onclick: () => fire('disk') }, 'Disk read finishes'),
                h('button', { class: 'btn sm io', type: 'button', onclick: () => fire('prn') }, 'Printer finishes'),
                h('button', { class: 'btn sm io', type: 'button', onclick: () => fire('key') }, 'Key pressed'),
                h('button', { class: 'btn sm', type: 'button', onclick: () => { reset(); paint(); say(msgL, '', '', 'Refilled: eight blocked processes again.'); say(msgR, '', '', 'Refilled: eight blocked processes again.'); } }, 'Refill')),
              h('div', { class: 'split grow', style: { gap: '14px' } },
                h('div', { class: 'card stack gap-s' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Design 1: one blocked queue'), L.cost),
                  lane('Blocked queue', 'everyone waiting', L.blocked), lane('Ready queue', 'woken processes', L.ready), msgL,
                  h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', style: { marginTop: 'auto' }, html: 'A busy system may have hundreds of blocked processes. With one <span class="t">blocked queue</span>, every event means a search through all of them. With one queue per event, the OS just moves one whole list to Ready.' })),
                h('div', { class: 'card stack gap-s' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Design 2: one queue per event'), R.cost),
                  laneR.disk, laneR.prn, laneR.key, lane('Ready queue', 'woken processes', R.ready), msgR))));
          };

          /* ---- tab 2: priority ready queues ---- */
          const tabPrio = (panel) => {
            const PN = ['High', 'Medium', 'Low'];
            let lanes, run, nextId, hist, prio = 0, preempt = true;
            const reset = () => { lanes = [[], [{ id: 'P2', p: 1 }, { id: 'P3', p: 1 }], [{ id: 'P4', p: 2 }]]; run = { id: 'P1', p: 1 }; nextId = 5; hist = [run]; };
            const histEl = h('div', { class: 'row gap-s' });
            const laneEls = [0, 1, 2].map(() => h('div', { class: 'toks' }));
            const runEl = h('div', { class: 'toks' });
            const msg = h('div', { class: 'msg', style: { minHeight: '104px' } });
            const pTok = (p, extra = '') => h('span', { class: 'tok' + extra, style: { cursor: 'default', width: '58px' } }, p.id, h('span', { class: 'tag', style: { background: 'var(--accent)' } }, PN[p.p][0]));
            function paint() {
              laneEls.forEach((e, i) => e.replaceChildren(...(lanes[i].length ? lanes[i].map((p) => pTok(p)) : [emptyEl()])));
              runEl.replaceChildren(run ? pTok(run, ' run') : emptyEl('processor idle'));
              histEl.innerHTML = hist.slice(-9).map((p, i, a) => `<span class="chip ${i === a.length - 1 ? 'accent' : ''}">${p.id} · ${PN[p.p]}</span>`).join('<span class="muted">→</span>');
            }
            const pickNext = () => { const i = lanes.findIndex((l) => l.length); const p = i < 0 ? null : lanes[i].shift(); if (p) hist.push(p); return p; };
            const act = {
              add() {
                if (lanes.flat().length + (run ? 1 : 0) >= 9) return say(msg, 'bad', 'Full', 'Nine processes is plenty. Finish or dispatch some first.');
                const p = { id: 'P' + nextId++, p: prio }; lanes[prio].push(p);
                if (preempt && run && prio < run.p) {
                  const old = run; lanes[old.p].push(old); run = pickNext();
                  say(msg, 'info', 'Preemption', `<b>${p.id}</b> (${PN[prio]}) became ready while <b>${old.id}</b> (${PN[old.p]}) was running. The OS <b>preempts</b> ${old.id}: Running → Ready, back of the ${PN[old.p]} queue, and dispatches ${run.id}.`);
                } else say(msg, 'ok', 'New ready process', `<b>${p.id}</b> joins the back of the ${PN[prio]} ready queue.` + (run && prio < run.p ? ' Preemption is off, so the running process keeps the processor until it times out.' : ''));
                paint();
              },
              dispatch() {
                if (run) return say(msg, 'bad', 'Refused', `The processor is busy with <b>${run.id}</b>. Time it out or let it finish first.`);
                run = pickNext();
                if (!run) return say(msg, 'bad', 'Nothing ready', 'All three ready queues are empty.');
                say(msg, 'ok', 'Dispatch', `The dispatcher checks the High queue first, then Medium, then Low, and takes the front of the first non-empty one: <b>${run.id}</b> (${PN[run.p]}).`); paint();
              },
              timeout() {
                if (!run) return say(msg, 'bad', 'Refused', 'Nothing is running.');
                const old = run; lanes[old.p].push(old); run = null;
                say(msg, 'ok', 'Timeout', `<b>${old.id}</b> goes to the back of the ${PN[old.p]} queue. Press Dispatch to see who goes next.`); paint();
              },
              finish() {
                if (!run) return say(msg, 'bad', 'Refused', 'Nothing is running.');
                say(msg, 'ok', 'Release', `<b>${run.id}</b> finishes and exits.`); run = null; paint();
              },
            };
            reset(); paint();
            say(msg, '', '', 'Add a High-priority process while a Medium one is running and watch what preemption does. Then dispatch repeatedly and notice Low waits until the higher queues are empty.');
            const B = (t, f, c = 'btn sm') => h('button', { class: c, type: 'button', onclick: f }, t);
            panel.append(h('div', { class: 'split fill' },
              h('div', { class: 'stack' },
                h('p', { class: 'm0', html: 'With one <span class="t">ready queue</span>, the dispatcher simply takes the front. Many systems give processes <b>priorities</b> and keep <b>one ready queue per priority level</b>. The dispatcher always serves the highest non-empty level.' }),
                h('div', { class: 'card tight stack gap-s' },
                  h('div', { class: 'row' }, h('span', { class: 'small b' }, 'New process priority'), ctx.ui.seg(PN.map((n, i) => ({ value: i, label: n })), prio, (v) => (prio = v))),
                  h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Preemptive?'), ctx.ui.seg([{ value: true, label: 'Yes' }, { value: false, label: 'No' }], preempt, (v) => (preempt = v))),
                  h('div', { class: 'row' }, B('New ready process', act.add, 'btn sm primary'), B('Dispatch', act.dispatch), B('Timeout', act.timeout), B('Finish', act.finish),
                    B('Reset', () => { reset(); paint(); say(msg, '', '', 'Back to the start.'); }, 'btn sm'))),
                msg,
                h('div', { class: 'callout warn m0 small', 'data-label': 'Watch out', html: 'If high-priority work keeps arriving, low-priority processes may wait a very long time. Real schedulers often raise the priority of a process that has waited too long.' })),
              h('div', { class: 'card stack gap-s' },
                h('h4', { class: 'm0' }, 'Ready queues by priority'),
                ...PN.map((n, i) => h('div', { class: 'lane' }, h('div', { class: 'lbl', html: `${n}<small>${['served first', 'served second', 'served last'][i]}</small>` }), laneEls[i])),
                h('div', { class: 'lane cpu' }, h('div', { class: 'lbl', html: 'Running<small>the processor</small>' }), runEl),
                h('p', { class: 'small muted m0', html: 'The letter on each process is its priority. A timed-out or preempted process returns to the back of <b>its own</b> priority queue.' }),
                h('div', { class: 'card white tight stack gap-s', style: { marginTop: 'auto' } }, h('h4', { class: 'm0' }, 'Who got the processor, in order (latest 9)'), histEl))));
          };

          el.append(ctx.ui.tabs([
            { label: 'Blocked: one queue vs one per event', render: tabBlocked },
            { label: 'Ready: priority queues', render: tabPrio },
          ]));
        },
      },

      /* ============ 8. Swapping and the single Suspend state (bring-one-back game) ============ */
      {
        title: 'Out of room: swapping and one Suspend state',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const tally = { one: { u: 0, w: 0 }, two: { u: 0, w: 0 } };
          let mode = 'one', round = 0, d, mem, disk, phase, last;
          const diagWrap = h('div'), diagCap = h('div', { class: 'xs muted b' });
          const cpu = h('div', { class: 'cpustat' });
          const slots = h('div', { class: 'slots' }), diskEl = h('div', { class: 'toks' });
          const msg = h('div', { class: 'msg', style: { minHeight: '104px' } });
          const tallyEl = h('div', { class: 'row gap-s' });
          const nextBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { newRound(); paint(); intro(); } }, 'Next round ▶');
          /* memory holds three Blocked processes; three more wait on disk, and the events of one or two of those have already happened */
          function newRound() {
            round++;
            const rnd = ctx.util.seeded(round * 97 + 13);
            mem = ['P1', 'P2', 'P3'].map((id) => ({ id, st: 'blocked' }));
            disk = ['P4', 'P5', 'P6'].map((id) => ({ id, done: false }));
            ctx.util.shuffle([0, 1, 2], rnd).slice(0, rnd() < 0.5 ? 1 : 2).forEach((k) => (disk[k].done = true));
            phase = 'out'; last = null;
          }
          function setDiagram() {
            d = diagram(ctx, mode === 'one' ? 'one' : 'split', { label: mode === 'one' ? 'Five-state model plus a single Suspend state' : 'Ready/Suspend and Blocked/Suspend beside Ready, Blocked and Running' });
            diagWrap.replaceChildren(d.svg);
            diagCap.textContent = mode === 'one' ? 'FIRST ATTEMPT: FIVE STATES + ONE SUSPEND STATE' : 'THE FIX: TWO SUSPEND STATES (NEW AND EXIT NOT SHOWN)';
          }
          const hidden = () => mode === 'one' && phase !== 'done';     // one Suspend state: the OS cannot see who is still waiting
          const diskLabel = (p) => (mode === 'two' ? NAME[p.done ? 'rs' : 'bs'] : hidden() ? 'Suspend' : p.done ? 'event done' : 'still waiting');
          const diskCls = (p) => 'tok sus' + (hidden() ? ' new' : p.done ? '' : ' blk');
          function paint() {
            slots.replaceChildren(...[0, 1, 2].map((i) => {
              const p = mem[i];
              if (!p) return h('div', { class: 'slot free' }, 'free slot');
              return h('div', { class: 'slot' }, h('button', { type: 'button', class: tokCls(p.st), onclick: () => clickMem(p), 'aria-label': 'Swap out ' + p.id }, p.id), h('span', { class: 'sl' }, p.note || NAME[p.st]));
            }));
            diskEl.replaceChildren(...disk.map((p) => h('span', { class: 'dsk' },
              h('button', { type: 'button', class: diskCls(p), onclick: () => clickDisk(p), 'aria-label': 'Bring back ' + p.id }, p.id), h('span', { class: 'sl' }, diskLabel(p)))));
            const run = mem.find((p) => p && p.st === 'running');
            cpu.className = 'cpustat ' + (run ? 'busy' : 'idle');
            cpu.textContent = run ? `Processor: running ${run.id}` : phase === 'done' ? 'Processor still IDLE' : 'Processor IDLE: every process in memory is Blocked';
            tallyEl.innerHTML = ['one', 'two'].map((m) => `<span class="chip ${tally[m].w ? 'bad' : tally[m].u ? 'ok' : ''}">${m === 'one' ? 'One state' : 'Two states'}: ${tally[m].u} useful · ${tally[m].w} wasted</span>`).join('');
            nextBtn.disabled = phase !== 'done';
            const sus = mode === 'one' ? 'suspend' : 'suspendB';
            d.arrows((a) => (a === last ? 'on' : phase !== 'out' && a === sus ? (phase === 'in' ? 'on' : 'used') : a === 'dispatch' && run ? 'used' : ''));
          }
          const intro = () => say(msg, 'info', `Round ${round} · step 1 of 2`, 'All three processes in memory are <b>Blocked</b> waiting for the disk, so nothing can run and nothing new fits. <b>Click one of them</b> to swap it out to disk and free its slot.');
          function clickMem(p) {
            if (phase !== 'out') return say(msg, 'bad', 'Not now', phase === 'in' ? 'A slot is already free. Now choose a process on disk to bring back.' : 'This round is over. Press <b>Next round</b>, or switch designs.');
            mem[mem.indexOf(p)] = null;
            disk.push({ id: p.id, done: false });
            phase = 'in';
            say(msg, 'info', `Round ${round} · step 2 of 2`, `<b>${p.id}</b> is copied out to disk (${mode === 'one' ? 'Blocked → Suspend' : 'Blocked → Blocked/Suspend'}) and its slot is free. Now <b>click a process on disk</b> to bring back. ` + (mode === 'one'
              ? 'While they sat on disk, the disk reads of some of them finished, but with one Suspend state they all look the same.'
              : 'This time the OS records whether each suspended process is still waiting.'));
            paint();
          }
          function clickDisk(p) {
            if (phase === 'out') return say(msg, 'bad', 'No room yet', 'Memory is full (3 of 3 slots). Swap a Blocked process out first.');
            if (phase === 'done') return say(msg, 'bad', 'Round over', 'Press <b>Next round</b> to try again, or switch designs.');
            const one = mode === 'one', slot = mem.indexOf(null);
            disk = disk.filter((q) => q !== p);
            phase = 'done';
            if (p.done) {
              mem[slot] = { id: p.id, st: 'running' }; tally[mode].u++; last = 'activate';
              say(msg, 'ok', one ? 'Useful swap, by luck' : 'Right choice', one
                ? `<b>${p.id}</b>’s disk read had already finished, so it arrives Ready and the dispatcher runs it. But the OS could not have known: in one Suspend state they all looked alike. The labels on disk now show the truth.`
                : `<b>${p.id}</b> was in <b>Ready/Suspend</b>, so the OS knew its event had happened. Activate (Ready/Suspend → Ready) brings it in, and the dispatcher runs it.`);
            } else {
              mem[slot] = { id: p.id, st: 'blocked', note: 'still Blocked' }; tally[mode].w++; last = one ? 'activate' : 'activateB';
              say(msg, 'bad', 'Wasted swap', one
                ? `<b>${p.id}</b> is still waiting for its disk read. The activate arrow promises Ready, yet ${p.id} lands in memory Blocked: a slow disk transfer bought nothing and the processor is still idle. The labels on disk now show what the OS could not see.`
                : `<b>${p.id}</b> was in <b>Blocked/Suspend</b>: still waiting. Bringing it in (Blocked/Suspend → Blocked) fills the slot with a process that cannot run. The labels warned you; pick a Ready/Suspend one.`);
            }
            paint();
          }
          const seg = ctx.ui.seg([{ value: 'one', label: 'One Suspend state' }, { value: 'two', label: 'Two suspend states' }], mode, (v) => { mode = v; setDiagram(); newRound(); paint(); intro(); });
          setDiagram(); newRound(); paint(); intro();
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'I/O is far slower than the processor, so every process in main memory can end up <b>Blocked</b> at once while the processor sits idle.' }),
              h('p', { class: 'm0 small', html: 'Adding memory helps only for a while, because programs grow to fill it. The OS’s answer is <span class="t">swapping</span>: move all or part of a blocked process out to disk, into a <span class="t" data-t="Suspended process">Suspend</span> state, and use the freed memory for a process that can run. Bringing a suspended process back into memory is called <b>activating</b> it. Swapping is itself I/O, but the disk is usually the fastest I/O device, so it normally pays off.' }),
              h('div', { class: 'card white tight stack gap-s' }, diagCap, diagWrap)),
            h('div', { class: 'card stack', style: { gap: '10px' } },
              h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'You are the OS'), seg),
              h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { justifyContent: 'space-between' } }, cpu, nextBtn),
              h('div', { class: 'lane' }, h('div', { class: 'lbl', html: 'Main memory<small>room for 3</small>' }), slots),
              h('div', { class: 'lane' }, h('div', { class: 'lbl', html: 'Disk<small>suspended</small>' }), diskEl),
              msg,
              h('div', { class: 'callout warn m0 small', 'data-label': 'The catch', html: 'Every process in Suspend was Blocked when it left memory. Its event may have happened since, and a single Suspend state cannot say which. Compare the wasted swaps of the two designs.' }),
              h('div', { class: 'row', style: { marginTop: 'auto' } }, tallyEl))));
        },
      },

      /* ============ 9. Suspension: the memory-pressure lab + seven-state model ============ */
      {
        title: 'Seven states: Ready/Suspend and Blocked/Suspend',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const GOALS = [
            ['suspendB', 'Make room: select a Blocked process and press <b>Suspend</b> (Blocked → Blocked/Suspend).'],
            ['admit', '<b>Admit</b> the New process into the free slot (New → Ready).'],
            ['dispatch', 'Put the idle processor to work: <b>Dispatch</b> (Ready → Running).'],
            ['occursS', 'The disk finishes for the process on disk: select it, press <b>Event occurs</b> (Blocked/Suspend → Ready/Suspend).'],
            ['release', 'Let the running process finish with <b>Release</b> (Running → Exit). That frees its slot.'],
            ['activate', 'Bring the ready process back from disk: <b>Activate</b> (Ready/Suspend → Ready).'],
          ];
          let P, sel, used, last, nextId;
          const reset = () => { P = [{ id: 'P1', st: 'blocked', slot: 0 }, { id: 'P2', st: 'blocked', slot: 1 }, { id: 'P3', st: 'blocked', slot: 2 }, { id: 'P4', st: 'new', slot: null }]; sel = null; used = new Set(); last = null; nextId = 5; };
          const inMem = () => P.filter((p) => ['ready', 'running', 'blocked'].includes(p.st));
          const byId = (id) => P.find((p) => p.id === id);
          const room = () => inMem().length < 3;
          const enterMem = (p, st) => { const taken = inMem().map((q) => q.slot); p.slot = [0, 1, 2].find((i) => !taken.includes(i)); p.st = st; };
          const cap = h('div', { class: 'msg info small', style: { minHeight: '84px' } });
          const d = diagram(ctx, 'seven', { label: 'Seven-state model', onArrow: (a) => { paint(a); say(cap, 'info', TR7[a][0], TR7[a][1]); } });
          const goalRow = h('div', { class: 'goal' }), goalText = h('div', { class: 'small', style: { minHeight: '42px' } });
          const cpu = h('div', { class: 'cpustat' }), exitL = h('div', { class: 'xs muted' });
          const newL = h('div', { class: 'toks' }), slots = h('div', { class: 'slots' }), disk = h('div', { class: 'toks' });
          const msg = h('div', { class: 'msg small', style: { minHeight: '84px' } });
          function paint(hl) {
            const tb = (p) => h('button', { type: 'button', class: tokCls(p.st) + (p.id === sel ? ' sel' : ''), onclick: () => { sel = sel === p.id ? null : p.id; paint(); }, 'aria-label': 'Select ' + p.id }, p.id);
            const news = P.filter((p) => p.st === 'new');
            newL.replaceChildren(...(news.length ? news.map(tb) : [h('span', { class: 'empty' }, 'none')]));
            slots.replaceChildren(...[0, 1, 2].map((i) => { const p = inMem().find((q) => q.slot === i); return p ? h('div', { class: 'slot' }, tb(p), h('span', { class: 'sl' }, NAME[p.st])) : h('div', { class: 'slot free' }, 'free slot'); }));
            const onDisk = P.filter((p) => p.st === 'rs' || p.st === 'bs');
            disk.replaceChildren(...(onDisk.length ? onDisk.map((p) => h('span', { class: 'dsk' }, tb(p), h('span', { class: 'sl' }, NAME[p.st]))) : [h('span', { class: 'empty' }, 'nothing swapped out')]));
            const run = P.find((p) => p.st === 'running'), rdy = P.find((p) => p.st === 'ready');
            cpu.className = 'cpustat ' + (run ? 'busy' : 'idle');
            cpu.textContent = run ? `Processor: running ${run.id}` : rdy ? `Processor IDLE, yet ${rdy.id} is Ready` : 'Processor IDLE: nothing in memory can run';
            const ex = P.filter((p) => p.st === 'exit');
            exitL.textContent = ex.length ? 'Exited: ' + ex.map((p) => p.id).join(', ') : 'Exited: none';
            const k = GOALS.findIndex(([a]) => !used.has(a));
            goalRow.replaceChildren(h('b', { class: 'small', style: { marginRight: '4px' } }, 'Goals'), ...GOALS.map(([a], i) => h('span', { class: used.has(a) ? 'done' : i === k ? 'cur' : '', title: TR7[a][0] }, used.has(a) ? '✓' : String(i + 1))));
            goalText.innerHTML = k < 0 ? '<b>All six goals done.</b> Now explore the rest: suspend a Ready or Running process, admit a new arrival while memory is full, or activate a Blocked/Suspend process.' : `<b>Goal ${k + 1}:</b> ${GOALS[k][1]}`;
            d.arrows((a) => (a === (hl || last) ? 'on' : used.has(a) ? 'used' : ''));
            d.states((s) => (sel && byId(sel).st === s ? 'on' : ''));
          }
          const ok = (a, html) => { used.add(a); last = a; sel = null; say(msg, 'ok', TR7[a][0], html); say(cap, 'info', TR7[a][0], TR7[a][1]); paint(); };
          const no = (html) => { say(msg, 'bad', 'Refused', html); paint(); };
          const FULL = 'Main memory is full (3 of 3 slots). Suspend a process or let one finish first.';
          function act(a) {
            if (a === 'create') {
              if (P.filter((p) => p.st !== 'exit').length >= 7) return no('Seven live processes is plenty for this lab.');
              const p = { id: 'P' + nextId++, st: 'new', slot: null }; P.push(p);
              return ok('create', `<b>${p.id}</b> arrives and waits in New to be admitted.`);
            }
            let id = sel;
            if (!id) { const f = (st) => (P.find((p) => p.st === st) || {}).id; id = { dispatch: f('ready'), timeout: f('running'), wait: f('running'), release: f('running'), admit: f('new'), activate: f('rs'), occurs: f('bs') || f('blocked') }[a]; }
            if (!id) return no('Select a process first: click a token in New, in memory, or on disk.');
            const p = byId(id), st = p.st;
            if (st === 'exit') return no(`<b>${id}</b> has exited and will never run again.`);
            const out = (to) => { p.slot = null; p.st = to; };
            switch (a) {
              case 'suspend':
                if (st === 'blocked') { out('bs'); return ok('suspendB', `<b>${id}</b> is swapped out to disk. Its slot is free, and it is still waiting for the disk.`); }
                if (st === 'ready') { out('rs'); return ok('suspendR', `<b>${id}</b> could have run, but it is swapped out anyway. Usually a Blocked process is the better choice.`); }
                if (st === 'running') { out('rs'); return ok('suspendRun', `<b>${id}</b> is preempted and swapped straight out to disk. The processor is now idle.`); }
                if (st === 'new') return no(`<b>${id}</b> is not in memory yet, so there is nothing to swap out. (When memory is full, Admit sends it straight to disk.)`);
                return no(`<b>${id}</b> is already on disk.`);
              case 'activate':
                if (st !== 'rs' && st !== 'bs') return no(`Activate brings a suspended process back from disk. <b>${id}</b> is ${NAME[st]}, not on disk.`);
                if (!room()) return no(FULL);
                if (st === 'rs') { enterMem(p, 'ready'); return ok('activate', `<b>${id}</b> is swapped back into memory and joins the ready queue.`); }
                enterMem(p, 'blocked'); return ok('activateB', `<b>${id}</b> is back in memory but <b>still Blocked</b>: it holds a slot without being able to run. Usually a poor trade.`);
              case 'admit':
                if (st !== 'new') return no(`Only a New process can be admitted. <b>${id}</b> is ${NAME[st]}.`);
                if (room()) { enterMem(p, 'ready'); return ok('admit', `<b>${id}</b> is admitted into a free memory slot and is Ready.`); }
                out('rs'); return ok('admitS', `Memory is full, so <b>${id}</b> is admitted straight to disk as Ready/Suspend.`);
              case 'dispatch':
                if (st === 'rs') return no(`<b>${id}</b> is ready but on disk. Only processes in main memory can run: Activate it first.`);
                if (st === 'blocked' || st === 'bs') return no(`<b>${id}</b> is waiting for an event, and no arrow leads from a Blocked state to Running.`);
                if (st !== 'ready') return no(`Only a Ready process can be dispatched. <b>${id}</b> is ${NAME[st]}.`);
                if (P.some((q) => q.st === 'running')) return no('The processor is already busy.');
                p.st = 'running'; return ok('dispatch', `<b>${id}</b> gets the processor. No more idle time.`);
              case 'occurs':
                if (st === 'blocked') { p.st = 'ready'; return ok('occurs', `The disk read for <b>${id}</b> completes. It is in memory, so it becomes Ready.`); }
                if (st === 'bs') { p.st = 'rs'; return ok('occursS', `The disk read for <b>${id}</b> completes while it is on disk. It becomes <b>Ready/Suspend</b>: runnable, but still out of memory.`); }
                return no(`<b>${id}</b> is not waiting for any event.`);
              case 'wait':
                if (st !== 'running') return no(`Only the running process can start waiting for an event. <b>${id}</b> is ${NAME[st]}.`);
                p.st = 'blocked'; return ok('wait', `<b>${id}</b> asks for a disk read and blocks. It keeps its memory slot while it waits.`);
              case 'timeout':
                if (st !== 'running') return no(`Only the running process can time out. <b>${id}</b> is ${NAME[st]}.`);
                p.st = 'ready'; return ok('timeout', `<b>${id}</b>’s time slice ends. It goes back to Ready and stays in memory.`);
              case 'release':
                if (st !== 'running') return no(`Only the running process can finish. <b>${id}</b> is ${NAME[st]}.`);
                out('exit'); return ok('release', `<b>${id}</b> finishes. Its memory slot is free again.`);
            }
            return null;
          }
          const B = (t, a, c = 'btn sm') => h('button', { class: c, type: 'button', onclick: () => act(a) }, t);
          const tabs = ctx.ui.tabs([
            { label: 'Diagram', render: (p) => p.append(h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white tight' }, d.svg), cap)) },
            { label: 'Two suspend states', render: (p) => p.append(h('div', { class: 'stack' },
              h('p', { class: 'm0 small', html: 'With a single Suspend state, the OS could not tell which processes on disk were still waiting, so it sometimes fetched one that still could not run.' }),
              h('p', { class: 'm0 small', html: 'The fix is to track <b>two independent facts</b> about every process: is it waiting for an event, and is it in main memory? Four combinations give four states. Add New, Running and Exit, and you have the <b>seven-state model</b>.' }),
              h('div', { class: 'mx' }, h('span'), h('div', { class: 'hd c' }, 'not waiting'), h('div', { class: 'hd c' }, 'waiting for an event'),
                h('div', { class: 'hd' }, 'in main memory'), h('div', { class: 'box proc', html: 'Ready<small>can be dispatched</small>' }), h('div', { class: 'box', style: { borderColor: 'var(--warn)', background: 'var(--warn-bg)' }, html: 'Blocked<small>in memory, waiting</small>' }),
                h('div', { class: 'hd' }, 'on disk'), h('div', { class: 'box proc sus', html: '<span class="t" data-t="Ready/Suspend state">Ready/Suspend</span><small>must be activated first</small>' }), h('div', { class: 'box sus', style: { borderColor: 'var(--warn)', background: 'var(--warn-bg)' }, html: '<span class="t" data-t="Blocked/Suspend state">Blocked/Suspend</span><small>two obstacles</small>' })),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Rule of thumb', html: 'Only processes in main memory can be dispatched. The OS prefers to swap out Blocked processes, and to swap in Ready/Suspend ones.' }))) },
            { label: 'Characteristics', render: (p) => p.append(h('div', { class: 'stack' },
              h('p', { class: 'm0', html: 'What makes a <span class="t">suspended process</span> different from a merely blocked one:' }),
              h('div', { class: 'grid-2' }, ...SUSP_CHAR.map(([t, x], i) => h('div', { class: 'card tight' }, h('div', { class: 'b' }, `${i + 1}. ${t}`), h('div', { class: 'small' }, x)))),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '“Suspended” does not mean “waiting for I/O”. Blocked is about an <b>event</b>; suspended is about being <b>set aside</b> (usually out of memory). A process can be either, both, or neither.' }))) },
            { label: 'Reasons', render: (p) => p.append(h('div', { class: 'stack' },
              h('p', { class: 'm0', html: 'Memory pressure (<span class="t">swapping</span>) is the main reason, but not the only one:' }),
              h('table', { class: 'tbl compact', html: '<tr><th>Reason</th><th>What is going on</th></tr>' + SUSP_WHY.map(([r, x]) => `<tr><td><b>${r}</b></td><td>${x}</td></tr>`).join('') }),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Whatever the reason, the OS uses the same two states, Ready/Suspend and Blocked/Suspend, and the process stays there until whoever suspended it says otherwise.' }))) },
          ]);
          reset(); paint();
          say(msg, '', '', 'All three processes in memory wait for the disk, so the processor is idle and there is no room to admit P4 into memory. <b>Click a process, then an action</b> (with nothing selected, a button picks the obvious process). Follow the goals.');
          say(cap, 'info', 'Seven-state model', '<b>Reminder:</b> to free memory the OS can <b>suspend</b> a process by <span class="t">swapping</span> it out to disk; <b>activating</b> it brings it back. Click any arrow to see what triggers it. Arrows you use in the lab turn green; the latest one is highlighted.');
          el.append(h('div', { class: 'split fill', style: { gap: '18px' } }, tabs,
            h('div', { class: 'card stack', style: { gap: '8px' } },
              h('div', { class: 'stack', style: { gap: '4px' } }, goalRow, goalText),
              h('div', { class: 'grid-2', style: { alignItems: 'center' } }, h('div', { class: 'stack', style: { gap: '2px' } }, cpu, exitL),
                h('div', { class: 'lane sm' }, h('div', { class: 'lbl', html: 'New<small>not yet admitted</small>' }), newL)),
              h('div', { class: 'lane' }, h('div', { class: 'lbl', html: 'Main memory<small>room for 3</small>' }), slots),
              h('div', { class: 'lane' }, h('div', { class: 'lbl', html: 'Disk<small>swapped out</small>' }), disk),
              actGrid(ctx, 5,
                B('Suspend', 'suspend', 'btn sm primary'), B('Activate', 'activate', 'btn sm primary'), B('Admit', 'admit'), B('Dispatch', 'dispatch'), B('Event occurs', 'occurs'),
                B('Event wait', 'wait'), B('Timeout', 'timeout'), B('Release', 'release'), B('New arrives', 'create'),
                h('button', { class: 'btn sm', type: 'button', onclick: () => { reset(); paint(); say(msg, '', '', 'Back to the start: memory full of Blocked processes.'); } }, 'Reset')),
              msg,
              h('div', { class: 'row gap-s xs muted', style: { marginTop: 'auto' } }, h('span', { class: 'tok', style: { width: '38px', height: '26px', fontSize: '12.5px', cursor: 'default' } }, 'P'), 'solid: in memory',
                h('span', { class: 'tok sus', style: { width: '38px', height: '26px', fontSize: '12.5px', cursor: 'default' } }, 'P'), 'dashed: suspended on disk',
                h('span', { class: 'tok blk', style: { width: '38px', height: '26px', fontSize: '12.5px', cursor: 'default' } }, 'P'), 'orange: waiting'))));
        },
      },

      /* ============ 10. Recap ============ */
      {
        title: 'Recap: eight ideas to carry with you',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'lead m0' }, 'Say each answer out loud, then flip the card. Next, section 3.3 opens up the OS’s tables and the full PCB.'),
            ctx.ui.flipcards([
              ['Traces and the dispatcher', 'A trace is the list of addresses a process executes. The dispatcher is OS code that switches processes. In the A/B/C example it used 24 of the first 52 cycles.'],
              ['Why two states fail', 'One Not Running queue mixes processes that could run with ones waiting for I/O, so the dispatcher has to search. Fix: split it into Ready and Blocked.'],
              ['The five states', 'New → Ready → Running → Exit, plus Blocked. Timeout: Running → Ready. Event wait: Running → Blocked. Event occurs: Blocked → Ready.'],
              ['Why no Blocked → Running?', 'A blocked process is still waiting, so the processor would be wasted on it. When its event occurs it goes to Ready and waits its turn.'],
              ['Four ways to be born', 'A new batch job, an interactive log-on, the OS providing a service, or spawning by an existing process (parent and child).'],
              ['Fourteen ways to end', 'Normal completion, or trouble: time limit, memory, bounds, protection, arithmetic, time overrun, I/O, invalid or privileged instruction, data misuse, operator/OS, or the parent.'],
              ['One queue per event', 'When an event occurs, the OS moves that event’s whole queue to Ready instead of scanning every blocked process. Priorities can get one ready queue each.'],
              ['Swapping and suspension', 'Swap Blocked processes to disk to free memory. One Suspend state cannot tell who is still waiting, so use two: Ready/Suspend and Blocked/Suspend. Only in-memory Ready processes can run.'],
            ], { cols: 4, height: 182 }),
            h('div', { class: 'callout why m0', 'data-label': 'The one-sentence version', html: 'A process’s state records <b>whether it could use the processor right now</b> and <b>whether it is in main memory</b>; every transition is the OS reacting to an event such as a timeout, an I/O request, an I/O completion, or a shortage of memory.' })));
        },
      },

      /* ============ 11. Check yourself ============ */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'In the five-state model, which transition can <b>never</b> happen?', choices: ['Ready → Running', 'Blocked → Running', 'Running → Blocked', 'Blocked → Ready'], answer: 1,
            feedback: ['This is dispatch, the normal way a process gets the processor.', null, 'This happens whenever a running process requests I/O or waits for another event.', 'This happens when the event a blocked process is waiting for occurs.'],
            why: 'A blocked process is still waiting for its event, so handing it the processor would waste it. When the event occurs it moves to Ready and waits its turn like everyone else.' },
          { type: 'num', q: 'Processes A (at 5000), B (at 8000) and C (at 12000) share one processor with a 6-instruction dispatcher at address 100. Each process may run at most 6 instruction cycles before a timeout, and B requests I/O on its 4th instruction. A runs first, then B, then C. At which cycle number does C execute its first instruction?',
            answer: 23, tol: 0, why: 'A uses cycles 1–6, the dispatcher 7–12, B 13–16 (then it blocks for I/O), the dispatcher 17–22. So C starts at cycle 23, at address 12000.' },
          { type: 'num', q: 'Three processes share one processor. A 6-instruction dispatcher runs between turns, each turn lasts at most 6 instruction cycles, and one process blocks for I/O after 4. Over the first 52 instruction cycles the dispatcher runs 4 times. What percentage of those 52 cycles is dispatcher overhead? Round to the nearest whole percent.',
            answer: 46, tol: 1, unit: '%', why: '4 × 6 = 24 dispatcher cycles, and 24 ÷ 52 ≈ 0.46, so about 46%. It is this high only because 6-instruction turns are tiny; a real slice lasts milliseconds, which is millions of instructions, so real dispatch overhead is a small fraction.' },
          { type: 'match', q: 'Match each five-state transition to the event that typically causes it.',
            pairs: [['New → Ready', 'The OS is prepared to take on another process'], ['Ready → Running', 'The dispatcher chooses the process'], ['Running → Ready', 'The time slice runs out'], ['Running → Blocked', 'The process requests I/O'], ['Blocked → Ready', 'The awaited event occurs']],
            why: 'Admit, dispatch, timeout, event wait and event occurs: each arrow in the model is the OS reacting to one kind of event.' },
          { type: 'bucket', q: 'Is each event a reason a process is <b>created</b> or a reason one is <b>terminated</b>?', buckets: ['Creation', 'Termination'],
            items: [['A user logs on at a terminal', 0], ['The process divides by zero', 1], ['A running program asks the OS to start a helper process', 0], ['The process tries to run an instruction reserved for the OS', 1],
              ['A batch job reaches the front of the job queue', 0], ['The process waits longer than allowed for an event', 1]],
            why: 'The four creation reasons are a new batch job, an interactive log-on, the OS providing a service, and spawning. Dividing by zero (arithmetic error), running a privileged instruction, and waiting too long for an event (time overrun) are all termination reasons.' },
          { q: 'A process that is only allowed to <i>read</i> a file tries to <i>write</i> to it, and the OS ends the process. Which termination reason is this?', choices: ['Bounds violation', 'Protection error', 'Data misuse', 'Privileged instruction'], answer: 1,
            feedback: ['A bounds violation is touching a memory location outside the area the process may use, not misusing a file.', null, 'Data misuse means data of the wrong type, or data that was never given a value.', 'A privileged instruction is an instruction reserved for the OS, not a file operation.'],
            why: 'Using a resource, such as a file, in a way the process is not permitted to is a protection error.' },
          { type: 'match', q: 'Match each reason for suspending a process to the situation it describes.',
            pairs: [['Swapping', 'Main memory must be freed to bring in a process that is ready to run'], ['Other OS reason', 'The OS sets aside a background utility, or a process it suspects of causing a problem'],
              ['Interactive user request', 'A person pauses a program in order to debug it'], ['Timing', 'A monitoring job that runs once an hour waits for its next run'], ['Parent process request', 'A process wants to examine or change one of the processes it created']],
            why: 'Swapping (memory pressure) is the most common reason, but the OS, a user, the clock or a parent can also set a process aside. Whatever the reason, it stays suspended until whoever suspended it releases it.' },
          { type: 'multi', q: 'Which statements describe a <b>suspended</b> process?', choices: ['It is not immediately available for execution', 'It may or may not be waiting for an event', 'An agent put it there: itself, its parent, or the OS', 'It leaves the state only when that agent orders it', 'It is always waiting for I/O', 'It has been terminated and its PCB deleted'], answer: [0, 1, 2, 3],
            why: 'Those four are the defining characteristics. Suspension is independent of waiting (so “always waiting for I/O” is wrong), and a suspended process still exists: it can be brought back.' },
          { type: 'order', q: 'A process is swapped out to disk while it waits for a disk read, and the read completes while it is still on disk. Put its moves in order.', items: ['Dispatched for the first time (Running)', 'Requests a disk read (Blocked)', 'Swapped out to disk (Blocked/Suspend)', 'The disk read completes (Ready/Suspend)', 'Swapped back into main memory (Ready)', 'Dispatched again (Running)'],
            why: 'Running → Blocked → Blocked/Suspend → Ready/Suspend → Ready → Running. The read completes while the process is on disk, so it becomes Ready/Suspend, not Ready; and it must reach Ready in main memory before it can run, because no arrow leads from a Blocked state straight to Running.' },
          { q: 'Why do many operating systems keep a separate blocked queue for each kind of event?', choices: ['So a blocked process can be dispatched directly from its event queue', 'So that when an event occurs, the OS can move the whole matching queue to Ready without scanning every blocked process', 'So each device gets its own processor', 'Because a single queue cannot hold more than a few processes'], answer: 1,
            feedback: ['Blocked processes are never dispatched; they must become Ready first.', null, 'Queues are bookkeeping lists; they do not create processors.', 'One queue can be as long as needed. The problem is the time it takes to search it.'],
            why: 'With one queue per event, every process in the matching queue is waiting for exactly that event, so the OS can wake them all at once without searching.' },
          { q: 'Every process in main memory is Blocked waiting for I/O, and the processor sits idle. What does the OS typically do?', choices: ['Dispatch one of the blocked processes anyway', 'Swap a blocked process out to disk (Blocked/Suspend) to make room for a process that can run', 'Terminate all of the blocked processes', 'Wait for one of the I/O operations to finish and leave memory as it is'], answer: 1,
            feedback: ['A blocked process cannot use the processor; that would waste it.', null, 'Waiting for I/O is normal, not a reason to end a process.', 'That leaves the processor idle, which is exactly the problem swapping solves.'],
            why: 'Swapping a blocked process out frees memory, so the OS can admit a new process or bring back a Ready/Suspend one and keep the processor busy.' },
          { type: 'tf', q: 'In the two-state model, processes waiting for I/O share one Not Running queue with processes that could run. Even so, the dispatcher can always simply take the process at the front of that queue.', answer: false,
            why: 'The front process may be waiting for I/O and unable to run, so the dispatcher must search past it. That flaw is why Not Running is split into Ready and Blocked.' },
        ],
      },
    ],

    notes: `
      <h3>Why an OS tracks process states</h3>
      <p>A machine holds many processes but has few processors, so most processes are not running at any instant. The OS records each process's <b>state</b> in its PCB. A <b>state model</b> lists the states and the events that move a process between them (think of a one-doctor clinic: waiting room, exam room, lab tests, discharge).</p>

      <h3>Traces and the dispatcher</h3>
      <p>A process's <b>trace</b> is the ordered list of instruction addresses it executes (the values its program counter takes). The <b>dispatcher</b> is a small piece of OS code that switches the processor from one process to another.</p>
      <p><b>Example.</b> A, B and C are loaded at 5000, 8000 and 12000; the dispatcher is at 100 and is 6 instructions long (100–105). A process may run at most 6 instruction cycles before a timer interrupt ends its turn (a <b>timeout</b>). B's 4th instruction (8003) requests I/O. Each process sees only its own trace; the processor sees them interleaved:</p>
      <table>
        <tr><th>Cycles</th><th>Running</th><th>Addresses</th><th>How the turn ends</th></tr>
        <tr><td>1–6</td><td>A</td><td>5000–5005</td><td>timeout; A back to Ready</td></tr>
        <tr><td>7–12</td><td>Dispatcher</td><td>100–105</td><td>chooses B</td></tr>
        <tr><td>13–16</td><td>B</td><td>8000–8003</td><td>I/O request; B becomes Blocked</td></tr>
        <tr><td>17–22</td><td>Dispatcher</td><td>100–105</td><td>chooses C (B is not eligible)</td></tr>
        <tr><td>23–28</td><td>C</td><td>12000–12005</td><td>timeout</td></tr>
        <tr><td>29–34</td><td>Dispatcher</td><td>100–105</td><td>chooses A</td></tr>
        <tr><td>35–40</td><td>A</td><td>5006–5011</td><td>timeout</td></tr>
        <tr><td>41–46</td><td>Dispatcher</td><td>100–105</td><td>chooses C</td></tr>
        <tr><td>47–52</td><td>C</td><td>12006–12011</td><td>timeout</td></tr>
      </table>
      <p><b>Worked numbers.</b> In 52 cycles A ran 12, B 4, C 12 and the dispatcher 4 × 6 = 24, so overhead = 24 ÷ 52 ≈ 46%. It is high only because the slices are tiny: a real slice lasts milliseconds, which is millions of instructions. C first runs at cycle 23 (6 + 6 + 4 + 6 = 22 cycles come before it). A resumed process continues exactly where it stopped (A at 5006).</p>

      <h3>The two-state model</h3>
      <p>Each process is <b>Running</b> or <b>Not Running</b>; not-running processes wait in one queue. <b>Enter</b>: a new process joins the back. <b>Dispatch</b>: a queued process gets the processor. <b>Pause</b>: the running process is interrupted and rejoins the back. <b>Exit</b>: the running process finishes.</p>
      <p><b>The flaw:</b> some queued processes are waiting for I/O and cannot run, so the dispatcher must search past them instead of taking the front. Fix: split Not Running into <b>Ready</b> and <b>Blocked</b>.</p>

      <h3>Why processes are created</h3>
      <ol>
        <li><b>New batch job</b>: a previously submitted job is picked up.</li>
        <li><b>Interactive log-on</b>: a user signs in at a terminal.</li>
        <li><b>Created by the OS to provide a service</b>: e.g. to manage printing.</li>
        <li><b>Spawned by an existing process</b>: a program asks the OS for another process.</li>
      </ol>
      <p><b>Process spawning</b>: the creator is the <b>parent process</b>, the new one the <b>child process</b>; children can spawn children, forming a tree.</p>

      <h3>Why processes are terminated (14 reasons)</h3>
      <table>
        <tr><th>Reason</th><th>Meaning</th></tr>
        <tr><td>Normal completion</td><td>Finished; told the OS it is done.</td></tr>
        <tr><td>Time limit exceeded</td><td>Ran longer in total than allowed (wall-clock time, processor time, or time since an interactive user last typed).</td></tr>
        <tr><td>Memory unavailable</td><td>Needs more memory than the system can give.</td></tr>
        <tr><td>Bounds violation</td><td>Reached a memory location it may not use.</td></tr>
        <tr><td>Protection error</td><td>Used a resource in a forbidden way (writing a read-only file).</td></tr>
        <tr><td>Arithmetic error</td><td>Division by zero, overflow.</td></tr>
        <tr><td>Time overrun</td><td><i>Waited</i> for an event longer than the set maximum.</td></tr>
        <tr><td>I/O failure</td><td>An I/O operation failed (e.g. file not found).</td></tr>
        <tr><td>Invalid instruction</td><td>Executed something that is not an instruction.</td></tr>
        <tr><td>Privileged instruction</td><td>Executed an instruction reserved for the OS.</td></tr>
        <tr><td>Data misuse</td><td>Wrong type of data, or data never initialised.</td></tr>
        <tr><td>Operator or OS intervention</td><td>Stopped by an operator or the OS (e.g. to break a deadlock).</td></tr>
        <tr><td>Parent termination</td><td>The parent ended, and the OS ends its children too.</td></tr>
        <tr><td>Parent request</td><td>The parent asked the OS to end this child.</td></tr>
      </table>
      <h3>The five-state model</h3>
      <figure>
        <svg viewBox="0 0 480 330" width="100%" style="max-width:430px" role="img" aria-label="Five-state process model">
          <defs><marker id="n32a" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#3d4760"/></marker></defs>
          <g fill="none" stroke="#3d4760" stroke-width="1.8">
            <path d="M70,2 L70,32" marker-end="url(#n32a)"/><path d="M88,78 L118,142" marker-end="url(#n32a)"/>
            <path d="M200,154 L280,154" marker-end="url(#n32a)"/><path d="M280,176 L200,176" marker-end="url(#n32a)"/>
            <path d="M365,142 L395,78" marker-end="url(#n32a)"/><path d="M318,188 L268,267" marker-end="url(#n32a)"/>
            <path d="M212,267 L162,188" marker-end="url(#n32a)"/>
            <path d="M150,142 C 175,72 240,55 350,55" stroke-dasharray="6 5" marker-end="url(#n32a)"/>
            <path d="M300,295 C 470,300 470,150 430,78" stroke-dasharray="6 5" marker-end="url(#n32a)"/>
          </g>
          <g stroke-width="2">
            <rect x="10" y="32" width="120" height="46" rx="12" fill="#f5f7fb" stroke="#8a94ae"/>
            <rect x="350" y="32" width="120" height="46" rx="12" fill="#f5f7fb" stroke="#8a94ae"/>
            <rect x="80" y="142" width="120" height="46" rx="12" fill="#d6f3f9" stroke="#0891b2"/>
            <rect x="280" y="142" width="120" height="46" rx="12" fill="#e1eaff" stroke="#2563eb"/>
            <rect x="180" y="267" width="120" height="46" rx="12" fill="#fff0d1" stroke="#b45309"/>
          </g>
          <g font-size="15" font-weight="700" text-anchor="middle" fill="#151c2c">
            <text x="70" y="60">New</text><text x="410" y="60">Exit</text><text x="140" y="170">Ready</text><text x="340" y="170">Running</text><text x="240" y="295">Blocked</text>
          </g>
          <g font-size="13" fill="#3d4760">
            <text x="80" y="17">create</text><text x="96" y="114" text-anchor="end">admit</text><text x="240" y="145" text-anchor="middle">dispatch</text>
            <text x="240" y="195" text-anchor="middle">timeout</text><text x="388" y="116">release</text><text x="300" y="236">event wait</text>
            <text x="180" y="236" text-anchor="end">event occurs</text><text x="262" y="44" text-anchor="middle">terminated</text><text x="452" y="306" text-anchor="end">terminated</text>
          </g>
        </svg>
      </figure>
      <ul>
        <li><b>New</b>: PCB built but not yet admitted, and usually not yet in main memory (lets the OS cap how many processes compete).</li>
        <li><b>Ready</b>: could run now; waiting only for the processor.</li>
        <li><b>Running</b>: executing; at most one per processor.</li>
        <li><b>Blocked</b> (Waiting): cannot run until an event occurs.</li>
        <li><b>Exit</b>: finished or aborted; records may be kept briefly, then deleted.</li>
      </ul>
      <table>
        <tr><th>Transition</th><th>Typical trigger</th></tr>
        <tr><td>Null → New</td><td>A process is created.</td></tr>
        <tr><td>New → Ready (admit)</td><td>The OS is prepared to take on another process.</td></tr>
        <tr><td>Ready → Running (dispatch)</td><td>The dispatcher chooses it.</td></tr>
        <tr><td>Running → Exit (release)</td><td>It finishes or is aborted.</td></tr>
        <tr><td>Running → Ready</td><td><b>Timeout</b>, or <b>preemption</b> by a more important process.</td></tr>
        <tr><td>Running → Blocked (event wait)</td><td>It requests I/O or another event.</td></tr>
        <tr><td>Blocked → Ready (event occurs)</td><td>The awaited event happens.</td></tr>
        <tr><td>Ready / Blocked → Exit</td><td>Killed from outside, e.g. by its parent.</td></tr>
      </table>
      <p><b>No Blocked → Running arrow:</b> a blocked process is still waiting, so the processor would be wasted on it; after its event it becomes Ready first. Only a Running process can time out, block or release.</p>

      <h3>Queues</h3>
      <p>The dispatcher takes processes from the <b>ready queue</b>; waiting processes sit in <b>blocked queues</b>.</p>
      <ul>
        <li><b>One blocked queue</b>: on every event the OS scans all blocked processes to find the ones waiting for it.</li>
        <li><b>One queue per event</b>: the whole matching queue moves to Ready at once. Example: 8 blocked, 4 waiting for the disk: a disk completion costs 8 checks with one queue, 4 moves with per-event queues.</li>
        <li><b>Priority ready queues</b>: one per priority level; the dispatcher serves the highest non-empty level. With preemption, a newly ready higher-priority process takes the processor. Low-priority work may wait a long time.</li>
      </ul>

      <h3>Swapping and the single Suspend state</h3>
      <p>I/O is far slower than the processor, so every process in memory may be Blocked at once: the processor idles and there is no room to admit more. More memory helps only briefly, since programs grow to fill it. <b>Swapping</b> moves all or part of a process from main memory to disk so the space can hold a process that can run. Swapping is itself I/O, but the disk is usually the fastest I/O device, so it normally pays off.</p>
      <p><b>First attempt: one Suspend state.</b> Add Suspend to the five-state model with two arrows: Blocked → Suspend (suspend) when memory is needed, and Suspend → Ready (activate) to bring a process back. <b>The flaw:</b> every suspended process was Blocked when it left, and its event may or may not have happened since. One state cannot record which, so the OS may spend a disk transfer bringing back a process that still cannot run.</p>
      <h3>The seven-state model</h3>
      <p>Track two independent facts, <b>waiting or not</b> and <b>in memory or on disk</b>: Ready, Blocked, <b>Ready/Suspend</b> (on disk, not waiting) and <b>Blocked/Suspend</b> (on disk, still waiting). With New, Running and Exit, that makes seven states.</p>
      <table>
        <tr><th>New transition</th><th>When it happens</th></tr>
        <tr><td>Blocked → Blocked/Suspend</td><td>Usual choice when memory is needed: a blocked process cannot use its memory anyway.</td></tr>
        <tr><td>Blocked/Suspend → Ready/Suspend</td><td>The event occurs while on disk (not Ready yet).</td></tr>
        <tr><td>Ready/Suspend → Ready (activate)</td><td>No Ready process in memory, or it has higher priority.</td></tr>
        <tr><td>Ready → Ready/Suspend</td><td>Only way to free enough memory, or it is low priority.</td></tr>
        <tr><td>New → Ready/Suspend or Ready</td><td>Admit to disk when memory is tight, into memory when there is room.</td></tr>
        <tr><td>Blocked/Suspend → Blocked (activate)</td><td>Unusual: it is important and its event is due soon.</td></tr>
        <tr><td>Running → Ready/Suspend</td><td>Preempted and swapped out for a more important process.</td></tr>
        <tr><td>Any state → Exit</td><td>Killed, e.g. by its parent or the OS.</td></tr>
      </table>
      <p>Only processes in main memory can be dispatched. The OS prefers to swap out Blocked processes and to swap in Ready/Suspend ones.</p>
      <h4>Characteristics of a suspended process</h4>
      <ol>
        <li>It is not immediately available for execution.</li>
        <li>It may or may not be waiting for an event; if it is, the event occurring does not by itself let it run.</li>
        <li>An agent put it there to stop it running: itself, its parent, or the OS.</li>
        <li>It stays suspended until that agent orders its removal.</li>
      </ol>
      <h4>Reasons for suspending a process</h4>
      <ul>
        <li><b>Swapping</b>: free memory for a process that is ready to run.</li>
        <li><b>Other OS reason</b>: a background process, or one suspected of causing a problem.</li>
        <li><b>Interactive user request</b>: e.g. pausing a program to debug it.</li>
        <li><b>Timing</b>: a periodic process waits for its next interval.</li>
        <li><b>Parent process request</b>: to examine, modify or coordinate a child.</li>
      </ul>`,
  });
})();
