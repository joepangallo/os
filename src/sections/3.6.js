/* =====================================================================
   Section 3.6 — UNIX SVR4 Process Management
   The OS-inside-the-user-process model, system vs user processes,
   the nine UNIX process states and their transitions, process 0 and
   process 1, the three-part process image (user-level, register and
   system-level context), the process table entry vs the U area, and
   process creation with fork().
   Everything lives inside this IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {
  /* ------------------------------------------------------------------
     The nine UNIX SVR4 states: display names, seven-state equivalents,
     positions on the transition diagram, and plain-language details.
     ------------------------------------------------------------------ */
  const ST = {
    ur:  { name: 'User Running', lines: ['User Running'], seven: 'Running', sub: 'User Running', x: 300, y: 44, cls: 's-cpu', cls7: 's-cpu', mem: 'main memory', run: 'Now: it holds the processor (user mode).' },
    kr:  { name: 'Kernel Running', lines: ['Kernel Running'], seven: 'Running', sub: 'Kernel Running', x: 300, y: 168, cls: 's-os', cls7: 's-cpu', mem: 'main memory', run: 'Now: it holds the processor (kernel mode).' },
    rim: { name: 'Ready to Run, in Memory', lines: ['Ready to Run,', 'in Memory'], seven: 'Ready', sub: 'Ready in Memory', x: 300, y: 290, cls: 's-proc', cls7: 's-proc', mem: 'main memory', run: 'As soon as the scheduler picks it.' },
    pre: { name: 'Preempted', lines: ['Preempted'], note: '≈ Ready, in Memory', seven: 'Ready', sub: 'Preempted', x: 560, y: 44, cls: 's-proc', cls7: 's-proc', mem: 'main memory', run: 'As soon as the scheduler picks it again.' },
    asl: { name: 'Asleep in Memory', lines: ['Asleep', 'in Memory'], seven: 'Blocked', sub: 'Asleep in Memory', x: 90, y: 168, cls: 's-warn', cls7: 's-warn', mem: 'main memory', run: 'Only after its event happens.' },
    rsw: { name: 'Ready to Run, Swapped', lines: ['Ready to Run,', 'Swapped'], seven: 'Ready/Suspend', sub: 'Ready, Swapped', x: 300, y: 410, cls: 's-proc', cls7: 's-proc', dash: true, mem: 'disk (swapped out)', run: 'Only after the swapper brings it back into memory.' },
    ssw: { name: 'Sleeping, Swapped', lines: ['Sleeping,', 'Swapped'], seven: 'Blocked/Suspend', sub: 'Sleeping, Swapped', x: 90, y: 410, cls: 's-warn', cls7: 's-warn', dash: true, mem: 'disk (swapped out)', run: 'Only after its event happens AND it is swapped back in.' },
    cre: { name: 'Created', lines: ['Created'], seven: 'New', sub: 'Created', x: 560, y: 290, cls: 's-panel', cls7: 's-panel', mem: 'being set up by the kernel', run: 'Not yet: the kernel is still building it.' },
    zom: { name: 'Zombie', lines: ['Zombie'], seven: 'Exit', sub: 'Zombie', x: 560, y: 168, cls: 's-panel', cls7: 's-panel', mem: 'memory freed, record kept', run: 'Never again: it has finished.' },
  };
  const ST_INFO = {
    ur: 'The process holds the processor and is executing <b>its own program’s instructions</b> in user mode. It leaves this state only by entering the kernel: it makes a system call, an interrupt arrives, or its instruction causes an exception (a fault, such as dividing by zero). All three move it to Kernel Running.',
    kr: 'The <b>same process</b> holds the processor, but it is now executing <b>kernel code</b> in kernel mode, on its own kernel stack, because it made a system call or an interrupt arrived. From here it can return to user mode, go to sleep, be preempted on the way back to user mode, or exit.',
    rim: 'The process is in main memory and could run this instant. It is only waiting for the scheduler to choose it. When chosen, it resumes inside the kernel (Kernel Running), exactly where it stopped.',
    pre: 'The process had finished its kernel work and was <b>about to return to user mode</b>, but the kernel found a more important process ready to run and switched to it instead. It waits in the <b>same queue</b> as the Ready to Run, in Memory processes; when chosen again it goes straight back to User Running.',
    asl: 'The process cannot continue until some <b>event</b> happens: disk data arriving, a key being pressed, a child finishing. Giving it the processor would be pointless. Its image is still in main memory. This is a blocked state.',
    rsw: 'The process is ready to run, but its image is <b>out on disk</b>. Before the kernel can schedule it, the swapper (process 0) must copy it back into main memory.',
    ssw: 'The process is waiting for an event <b>and</b> its image has been swapped out to disk to free memory. Two things stand between it and the processor. This is a blocked state.',
    cre: 'The process has just been made by <code>fork()</code>. It exists (it has a process table entry and an ID) but is not ready to run yet. If there is enough memory it becomes Ready to Run in Memory; otherwise Ready to Run, Swapped.',
    zom: 'The process has called <code>exit</code>. It no longer exists as a running program and its memory is released, but it leaves a small record (exit status and usage times) in the process table for its <b>parent</b> to collect.',
  };

  /* Transitions: [id, from, to, path, labelX, labelY, anchor, 'label|second line'] */
  const TR = [
    ['fork', null, 'cre', 'M716,290 L636,290', 676, 281, 'middle', 'fork'],
    ['enough', 'cre', 'rim', 'M486,290 L376,290', 431, 281, 'middle', 'enough memory'],
    ['notEnough', 'cre', 'rsw', 'M505,317 L352,383', 446, 376, 'start', 'not enough|memory'],
    ['reschedule', 'rim', 'kr', 'M300,263 L300,196', 292, 236, 'end', 'reschedule'],
    ['syscall', 'ur', 'kr', 'M284,71 L284,140', 276, 100, 'end', 'system call,|interrupt'],
    ['ret', 'kr', 'ur', 'M316,141 L316,72', 324, 100, 'start', 'return|to user'],
    ['preempt', 'kr', 'pre', 'M374,150 L497,72', 448, 128, 'start', 'preempt'],
    ['preRet', 'pre', 'ur', 'M486,44 L376,44', 431, 35, 'middle', 'return to user'],
    ['exit', 'kr', 'zom', 'M374,168 L485,168', 430, 160, 'middle', 'exit'],
    ['sleep', 'kr', 'asl', 'M226,168 L165,168', 195, 160, 'middle', 'sleep'],
    ['wakeupMem', 'asl', 'rim', 'M140,195 L236,262', 184, 250, 'end', 'wakeup'],
    ['swapOutSleep', 'asl', 'ssw', 'M90,196 L90,382', 98, 292, 'start', 'swap out'],
    ['wakeupSw', 'ssw', 'rsw', 'M165,410 L225,410', 195, 401, 'middle', 'wakeup'],
    ['swapOutReady', 'rim', 'rsw', 'M286,318 L286,382', 278, 338, 'end', 'swap out'],
    ['swapIn', 'rsw', 'rim', 'M314,382 L314,318', 322, 372, 'start', 'swap in'],
    ['intr', 'kr', 'kr', 'M346,195 C 348,240 410,228 375,185', 398, 222, 'start', 'interrupt,|interrupt return'],
  ];
  const TR_BY = Object.fromEntries(TR.map((t) => [t[0], { id: t[0], from: t[1], to: t[2], label: t[7].replace('|', ' ') }]));
  const TR_INFO = {
    fork: 'A parent process calls <code>fork()</code>. The kernel builds a brand-new child process, which starts life in <b>Created</b>.',
    enough: 'There is room in main memory, so the new process becomes <b>Ready to Run, in Memory</b> and joins the processes waiting for the processor.',
    notEnough: 'On a system that swaps, if memory is short the new process is not loaded yet: it becomes <b>Ready to Run, Swapped</b> and waits on disk.',
    reschedule: 'The scheduler picks this process. It gets the processor in <b>Kernel Running</b>, because every UNIX process leaves and regains the processor from inside the kernel.',
    syscall: 'The program makes a <b>system call</b>, an interrupt arrives, or an instruction causes an exception (fault). The processor switches to kernel mode, and the <b>same process</b> now runs kernel code. No process switch is needed.',
    ret: 'The kernel has finished its work, so the process <b>returns to user mode</b> and carries on with its own program.',
    preempt: 'On the way back to user mode the kernel notices a <b>more important process is ready</b>. It preempts this one: the process goes to Preempted and a process switch happens. This return-to-user moment is the only place this kernel preempts.',
    preRet: 'The scheduler picks the preempted process again. Its kernel work was already finished, so it goes <b>straight back to user mode</b>.',
    exit: 'The process calls <code>exit</code> (a system call, so it is in the kernel). The kernel releases its memory and resources and leaves a <b>Zombie</b> record for the parent.',
    sleep: 'The process must wait for an event, such as data from the disk. It <b>sleeps</b> inside the kernel, and the kernel switches to another process. This switch is <b>voluntary</b> (the process gives up the processor itself), so it is allowed in the middle of kernel code.',
    wakeupMem: 'The awaited event happens (the disk data arrives). The kernel <b>wakes</b> the process: it is now Ready to Run, in Memory.',
    swapOutSleep: 'Memory is tight. The swapper copies a sleeping process out to disk: it could not use the processor anyway, so it is a good victim.',
    wakeupSw: 'The event happens while the process is on disk. It is now ready, but <b>still swapped out</b>: Ready to Run, Swapped.',
    swapOutReady: 'To make room, the swapper can also move a ready process out to disk. It stays ready, but must be swapped back in before it can run.',
    swapIn: 'The swapper copies the process back into main memory. Now the scheduler can pick it.',
    intr: 'While a process is in kernel mode an interrupt can arrive. The kernel handles it and returns to what it was doing: the process <b>stays in Kernel Running</b> the whole time.',
  };

  /* Build the transition diagram.  o.onState(id), o.onArrow(id) make parts clickable. */
  function stateDiagram(ctx, o = {}) {
    const { s } = ctx;
    const W = 144, H = 50;
    const svg = s('svg', { viewBox: '0 0 720 450', width: '100%', class: 'sd', role: 'img', 'aria-label': 'UNIX SVR4 process state transition diagram' });
    const back = s('g'), arrowLayer = s('g'), stateLayer = s('g');
    svg.append(back, arrowLayer, stateLayer);
    back.append(
      s('line', { x1: 0, y1: 350, x2: 720, y2: 350, class: 'divide' }),
      s('text', { x: 714, y: 342, 'text-anchor': 'end', class: 'zone' }, 'in main memory ↑'),
      s('text', { x: 714, y: 366, 'text-anchor': 'end', class: 'zone' }, 'swapped out to disk ↓'));
    const ar = {}, st = {};
    TR.forEach(([id, , , d, lx, ly, anchor, text]) => {
      const ln = s('path', { d, class: 'ln', 'marker-end': 'url(#arr)' });
      const lab = s('text', { x: lx, y: ly, 'text-anchor': anchor, class: 'lab' });
      text.split('|').forEach((t, i) => lab.append(s('tspan', { x: lx, dy: i ? 15 : 0 }, t)));
      const g = s('g', { class: 'ar' + (o.onArrow ? ' hot' : ''), 'data-id': id }, ln, s('path', { d, class: 'hit' }), lab);
      if (o.onArrow) g.addEventListener('click', () => o.onArrow(id));
      arrowLayer.append(g);
      ar[id] = { g, ln };
    });
    for (const [id, m] of Object.entries(ST)) {
      const rect = s('rect', { x: m.x - W / 2, y: m.y - H / 2, width: W, height: H, rx: 12, class: m.cls });
      const nm = s('text', { x: m.x, y: m.y, class: 'nm' });
      const sub = s('text', { x: m.x, y: m.y + 13, class: 'sub' });
      const g = s('g', { class: 'st' + (m.dash ? ' dash' : '') + (o.onState ? ' hot' : ''), 'data-id': id }, rect, nm, sub);
      if (o.onState) g.addEventListener('click', () => o.onState(id));
      stateLayer.append(g);
      st[id] = { g, rect, nm, sub };
    }
    const api = {
      svg,
      view: 'unix',
      setView(v) {
        api.view = v;
        for (const [id, m] of Object.entries(ST)) {
          const x = st[id];
          x.rect.setAttribute('class', v === 'seven' ? m.cls7 : m.cls);
          x.nm.replaceChildren();
          if (v === 'seven') {
            x.nm.setAttribute('y', m.y - 7);
            x.nm.classList.toggle('long', m.seven.length > 12);
            x.nm.textContent = m.seven;
            x.sub.textContent = m.sub;
          } else {
            x.nm.classList.remove('long');
            x.sub.textContent = m.note || '';
            if (m.note) { x.nm.setAttribute('y', m.y - 7); x.nm.textContent = m.lines[0]; }
            else if (m.lines.length === 1) { x.nm.setAttribute('y', m.y); x.nm.textContent = m.lines[0]; }
            else { x.nm.setAttribute('y', m.y - 8); m.lines.forEach((t, i) => x.nm.append(s('tspan', { x: m.x, dy: i ? 17 : 0 }, t))); }
          }
        }
      },
      arrow(id, cls) {
        const a = ar[id]; if (!a) return;
        a.g.classList.remove('on', 'used', 'dim', 'avail');
        if (cls) a.g.classList.add(cls);
        a.ln.setAttribute('marker-end', cls === 'on' ? 'url(#arr-accent)' : cls === 'used' ? 'url(#arr-ok)' : cls === 'avail' ? 'url(#arr-proc)' : 'url(#arr)');
      },
      arrows(fn) { Object.keys(ar).forEach((id) => api.arrow(id, fn(id))); },
      state(id, cls) { const x = st[id]; if (!x) return; x.g.classList.remove('on', 'dim', 'seen'); if (cls) x.g.classList.add(cls); },
      states(fn) { Object.keys(st).forEach((id) => api.state(id, fn(id))); },
    };
    api.setView(o.view || 'unix');
    return api;
  }

  /* Legend shown under the transition diagram (steps 2 and 3). */
  const diagramKey = (ctx) => ctx.h('div', { class: 's36-key xs', html: '<span><i></i>solid box: image in main memory</span><span><i class="k-dash"></i>dashed box: image swapped out to disk</span><span>arrow: a transition, labelled with its cause</span>' });

  /* ------------------------------------------------------------------
     fork() scene: the kernel's view (process table, memory images,
     open-file counts), redrawn from scratch for each frame f:
       f.slot  'free' | 'reserved' | 'pid' | 'ready'   (process table slot 3)
       f.image true once the child's image has been copied
       f.files 1 or 2 (users of each open file)
       f.hot   which part to highlight: 'slot' | 'image' | 'files' | null
     ------------------------------------------------------------------ */
  function forkScene(ctx) {
    const { s } = ctx;
    const svg = s('svg', { viewBox: '0 0 560 252', width: '100%', role: 'img', 'aria-label': 'Kernel tables during fork: process table, memory images and open files' });
    const T = (x, y, txt, o = {}) => s('text', Object.assign({ x, y, 'font-size': 13 }, o), txt);
    function draw(f) {
      const kids = [];
      // ---- process table ----
      kids.push(T(8, 16, 'Process table', { 'font-weight': 800 }));
      const rows = [['0', 'PID 0 · swapper'], ['1', 'PID 1 · init'], ['2', 'PID 812 · parent'], ['3', null], ['4', null]];
      rows.forEach(([slot, txt], i) => {
        const y = 26 + i * 36;
        let label = txt, cls = 's-panel', extra = {};
        if (i === 2) cls = 's-proc';
        if (i === 3) {
          if (f.slot === 'reserved') { label = 'reserved…'; cls = 's-accent'; }
          else if (f.slot === 'pid') { label = 'PID 813 · child'; cls = 's-proc'; }
          else if (f.slot === 'ready') { label = 'PID 813 · child'; cls = 's-proc'; }
          else if (f.slot === 'zombie') { label = 'PID 813 · zombie'; cls = 's-panel'; }
        }
        const hot = i === 3 && f.hot === 'slot';
        kids.push(s('rect', { x: 8, y, width: 190, height: 30, rx: 7, class: cls + (hot ? ' s36-hot' : ''), 'stroke-width': hot ? 3.5 : 1.5 }),
          T(18, y + 20, slot, { class: 's-sub', 'font-weight': 800 }),
          T(36, y + 20, label || 'free', Object.assign({ 'font-weight': label ? 700 : 400 }, label ? {} : { class: 's-sub' }, extra)));
      });
      if (f.cSt) kids.push(T(8, 222, 'slot 3 status: ' + f.cSt, { 'font-weight': 700, style: f.hot === 'slot' && f.slot !== 'pid' ? 'fill:var(--accent)' : 'fill:var(--ink-2)' }));
      // ---- memory images ----
      kids.push(T(214, 16, 'Main memory', { 'font-weight': 800 }));
      const img = (x, who, on, hot) => {
        const gone = (a, b) => [s('rect', { x, y: 26, width: 104, height: 160, rx: 9, class: 's-muted', 'stroke-dasharray': '6 4', 'stroke-width': hot ? 3 : 1.5 }), T(x + 52, 104, a, { 'text-anchor': 'middle', class: 's-sub' }), T(x + 52, 121, b, { 'text-anchor': 'middle', class: 's-sub' })];
        if (on === 'freed') return gone('image freed', '(zombie)');
        if (!on) return gone('no child', 'image yet');
        const parts = [s('rect', { x, y: 26, width: 104, height: 160, rx: 9, class: 's-proc', 'stroke-width': hot ? 3.5 : 2 }), T(x + 52, 45, who, { 'text-anchor': 'middle', 'font-weight': 800 })];
        ['text', 'data', 'user stack'].forEach((seg, k) => parts.push(
          s('rect', { x: x + 8, y: 54 + k * 43, width: 88, height: 36, rx: 6, class: 's-mem', 'stroke-width': 1.5 }),
          T(x + 52, 77 + k * 43, seg, { 'text-anchor': 'middle', 'font-weight': 650 })));
        return parts;
      };
      kids.push(...img(214, 'PID 812', true, false), ...img(340, f.cImg === 'ls' ? '813 · now ls' : 'PID 813', f.cImg === 'freed' ? 'freed' : f.image, f.hot === 'image'));
      if (f.image && f.hot === 'image' && !f.cImg) kids.push(s('line', { x1: 319, y1: 106, x2: 336, y2: 106, class: 's-line', 'marker-end': 'url(#arr-accent)', style: 'stroke:var(--accent)' }), T(327, 22, 'copy', { 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--accent)' }));
      // shared memory: one region, linked (not copied)
      kids.push(s('line', { x1: 266, y1: 186, x2: 296, y2: 212, class: 's-line', 'stroke-dasharray': '4 3' }));
      // exec and exit both detach the child from the shared region
      if (f.image && !f.cImg) kids.push(s('line', { x1: 392, y1: 186, x2: 362, y2: 212, class: 's-line', 'stroke-dasharray': '4 3' }));
      kids.push(s('rect', { x: 242, y: 212, width: 174, height: 32, rx: 7, class: 's-io', 'stroke-width': f.hot === 'image' ? 3 : 1.5 }),
        T(329, 233, f.image ? 'shared memory (1 copy)' : 'shared memory', { 'text-anchor': 'middle', 'font-weight': 700 }));
      // ---- open files ----
      kids.push(T(458, 16, 'Open files', { 'font-weight': 800 }));
      ['terminal', 'notes.txt'].forEach((name, k) => {
        const y = 26 + k * 72, hot = f.hot === 'files';
        kids.push(s('rect', { x: 458, y, width: 96, height: 60, rx: 8, class: 's-io', 'stroke-width': hot ? 3.5 : 1.5 }),
          T(506, y + 23, name, { 'text-anchor': 'middle', 'font-weight': 700 }),
          T(506, y + 45, 'count: ' + f.files, { 'text-anchor': 'middle', 'font-weight': 800, style: hot ? 'fill:var(--accent)' : '' }));
      });
      kids.push(T(506, 184, 'shared by parent', { 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }), T(506, 200, f.files > 1 ? 'and child' : 'only', { 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }));
      svg.replaceChildren(...kids);
    }
    return { svg, draw };
  }

  Guide.section({
    id: '3.6',
    title: 'UNIX SVR4 Process Management',
    short: 'UNIX SVR4 processes',
    summary: 'A real OS up close: UNIX SVR4’s nine process states, its three-part process image, and fork().',
    objectives: [
      'Explain how UNIX SVR4 runs most kernel code inside user processes, and tell system processes from user processes.',
      'Name the nine UNIX process states, map each onto the seven-state model, and explain why Preempted is a separate state.',
      'Trace a process through the UNIX transition diagram, including sleeping, swapping, preemption and becoming a zombie.',
      'Describe the process image as user-level, register and system-level context, and say which fields live in the process table entry and which in the U area.',
      'List the six things the kernel does during fork(), name its three choices afterwards, and predict what a program that calls fork() prints.',
    ],
    terms: [
      ['UNIX System V Release 4 (SVR4)', 'An influential release of AT&T’s UNIX, from the late 1980s, that combined features of several UNIX families. Its process design is the classic UNIX model.'],
      ['System call', 'A request a running program makes to the kernel for a service it may not perform itself, such as reading a file. It switches the processor into kernel mode.'],
      ['System process', 'In UNIX, a process that runs only in kernel mode and carries out operating-system housekeeping, such as allocating memory or swapping processes in and out.'],
      ['User process', 'In UNIX, a process that runs a user’s program in user mode and switches into kernel mode, still as the same process, whenever it makes a system call, causes an exception (fault) or an interrupt arrives.'],
      ['Nonpreemptible kernel', 'A kernel that never forces a process off the processor while that process is executing kernel code; forced switches wait for a safe point, such as the return to user mode. A process may still give up the processor voluntarily in the kernel, by sleeping.'],
      ['Preempted state', 'The UNIX state of a process that was about to return from kernel mode to user mode when the kernel switched to a more important process instead. It waits just like a ready process.'],
      ['Zombie', 'A process that has finished. Its memory is gone, but a small record (its exit status and usage totals) stays in the process table until its parent collects it.'],
      ['Swapper (process 0)', 'The first process, built by the kernel itself when the system boots. It is a system process whose job is to move process images between main memory and disk.'],
      ['init (process 1)', 'The second process, created by process 0 at boot. Every other process is its descendant; it starts a process for each user who logs in.'],
      ['User-level context', 'The part of a UNIX process image the program itself sees: its machine instructions (text), its data, its user stack and any shared memory.'],
      ['Register context', 'The processor register values that belong to a process: program counter, processor status register, stack pointer and general-purpose registers. Saved when the process stops running.'],
      ['System-level context', 'The part of a UNIX process image only the kernel uses: the process table entry, the U area, the per-process region table and the kernel stack.'],
      ['Process table entry', 'The kernel’s always-reachable record for one process: its state, IDs, priority, pending signals, the event it sleeps on and where its image is.'],
      ['U area (user area)', 'A per-process kernel record holding information the kernel needs only while that process is running, such as its open-file table and system-call parameters.'],
      ['Per-process region table', 'A kernel table describing the memory regions (text, data, stack) of one process: how its virtual addresses map to physical memory and whether each region is read-only or writable.'],
      ['Kernel stack', 'A second, private stack a process uses while it executes kernel code, holding the kernel functions’ local variables and return addresses.'],
      ['Shared memory', 'A region of memory that two or more processes can all read and write, used to pass data between them quickly.'],
      ['Signal', 'A short software notification the kernel delivers to a process, such as “your child has finished” or “please terminate”.'],
      ['fork()', 'The UNIX system call that creates a new process as an almost exact copy of the caller. It returns the child’s process ID to the parent and 0 to the child.'],
      ['exec', 'A family of UNIX system calls that replaces the calling process’s program with a new program loaded from a file. The process ID stays the same.'],
    ],

    css: `
      /* ---- the nine-state transition diagram ---- */
      /* shell workaround: the eyebrow is nowrap, and this long section title would force the canvas wider than a phone */
      .sec-3-6 .step-eyebrow { contain: inline-size; }
      .sec-3-6 svg.sd { display: block; max-height: 100%; }
      .sec-3-6 .sd .divide { stroke: var(--line-2); stroke-width: 1.5; stroke-dasharray: 6 5; }
      .sec-3-6 .sd .zone { font-size: 13px; font-weight: 700; fill: var(--muted); }
      .sec-3-6 .st rect { stroke-width: 2.2; transition: stroke-width .15s, opacity .2s; }
      .sec-3-6 .st.dash rect { stroke-dasharray: 7 4; }
      .sec-3-6 .st text { text-anchor: middle; dominant-baseline: central; pointer-events: none; }
      .sec-3-6 .st text.nm { font-size: 15px; font-weight: 800; }
      .sec-3-6 .st text.nm.long { font-size: 13.5px; }
      .sec-3-6 .st text.sub { font-size: 12.5px; font-weight: 600; fill: var(--muted); }
      .sec-3-6 .st.hot { cursor: pointer; }
      .sec-3-6 .st.hot:hover rect { stroke-width: 3.5; }
      .sec-3-6 .st.on rect { stroke-width: 5; }
      .sec-3-6 .st.seen rect { stroke-width: 3; }
      .sec-3-6 .st.dim { opacity: .32; }
      .sec-3-6 .ar .ln { fill: none; stroke: var(--ink-2); stroke-width: 2; opacity: .8; }
      .sec-3-6 .ar .hit { fill: none; stroke: transparent; stroke-width: 16; }
      .sec-3-6 .ar .lab { font-size: 13px; font-weight: 650; fill: var(--ink-2); }
      .sec-3-6 .ar.hot { cursor: pointer; }
      .sec-3-6 .ar.hot:hover .ln { stroke: var(--accent); opacity: 1; stroke-width: 3; }
      .sec-3-6 .ar.on .ln { stroke: var(--accent); opacity: 1; stroke-width: 3.5; }
      .sec-3-6 .ar.on .lab { fill: var(--accent); font-weight: 800; }
      .sec-3-6 .ar.used .ln { stroke: var(--ok); opacity: .9; stroke-width: 2.5; }
      .sec-3-6 .ar.avail .ln { stroke: var(--proc); opacity: 1; stroke-width: 3; stroke-dasharray: 6 4; }
      .sec-3-6 .ar.avail .lab { fill: var(--proc); font-weight: 800; }
      .sec-3-6 .ar.dim { opacity: .28; }
      .sec-3-6 .diag-card { display: grid; place-items: center; align-content: center; gap: 10px; padding: 8px 10px; }
      .sec-3-6 .s36-key { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 18px; color: var(--ink-2); font-weight: 600; }
      .sec-3-6 .s36-key i { display: inline-block; width: 24px; height: 14px; border: 2px solid var(--ink-2); border-radius: 4px; vertical-align: -2px; margin-right: 6px; }
      .sec-3-6 .s36-key i.k-dash { border-style: dashed; }
      /* ---- step 1: mode timeline ---- */
      .sec-3-6 .lane-u { fill: var(--panel-2); stroke: var(--line); }
      .sec-3-6 .lane-k { fill: color-mix(in srgb, var(--os-bg) 70%, transparent); stroke: color-mix(in srgb, var(--os) 30%, transparent); }
      .sec-3-6 .seg rect { stroke-width: 2; transition: stroke-width .15s; }
      .sec-3-6 .seg.hot { cursor: pointer; }
      .sec-3-6 .seg.hot:hover rect { stroke-width: 3.2; }
      .sec-3-6 .seg.on rect { stroke-width: 4.5; stroke: var(--accent); }
      .sec-3-6 .sw-tick { stroke: var(--intr); stroke-width: 2.5; }
      .sec-3-6 .s36-cap { min-height: 5.6em; }
      /* ---- step 2: explorer ---- */
      .sec-3-6 .s36-detail { flex: 1; min-height: 0; }
      .sec-3-6 .s36-detail h3 { margin-bottom: 6px; }
      /* ---- step 3: tour / drive ---- */
      .sec-3-6 .s36-trail { row-gap: 4px; }
      .sec-3-6 .s36-trail .chip { font-size: 12.5px; padding: 0 7px; }
      .sec-3-6 .s36-miss { padding-left: 20px; }
      .sec-3-6 .s36-miss li.done { color: var(--ok); font-weight: 700; }
      /* ---- step 4: image layers ---- */
      .sec-3-6 .s36-band { padding: 8px 10px; }
      .sec-3-6 .s36-bandh { gap: 6px; margin-bottom: 6px; }
      .sec-3-6 .s36-piece { font-size: 14px; padding: 6px 6px; min-height: 48px; cursor: pointer; line-height: 1.2; color: var(--ink); transition: opacity .2s, box-shadow .15s; }
      .sec-3-6 .s36-piece:hover { box-shadow: 0 0 0 2px var(--accent); }
      .sec-3-6 .s36-piece.on { box-shadow: 0 0 0 3px var(--accent); }
      .sec-3-6 .s36-piece.dim { opacity: .4; }
      /* ---- step 5: sort game ---- */
      .sec-3-6 .s36-field { font-size: 24px; font-weight: 800; letter-spacing: -.01em; color: var(--chc); min-height: 32px; }
      .sec-3-6 .s36-fb { min-height: 4.4em; font-size: 14.5px; }
      .sec-3-6 .s36-bins { grid-template-columns: minmax(0, 5fr) minmax(0, 3fr) minmax(0, 5fr); }
      .sec-3-6 .s36-chips { align-content: flex-start; row-gap: 5px; }
      .sec-3-6 .s36-chips:empty::before { content: 'Sorted fields land here.'; font-size: 13px; color: var(--muted); }
      .sec-3-6 .s36-chip { border: 0; cursor: pointer; font-family: inherit; }
      .sec-3-6 .s36-ok { color: var(--ok); font-weight: 800; }
      .sec-3-6 .s36-bad { color: var(--bad); font-weight: 800; }
      .sec-3-6 .card.accent { background: var(--accent-bg); border-color: color-mix(in srgb, var(--accent) 35%, transparent); }
      /* ---- step 6: fork ---- */
      .sec-3-6 .s36-var { font-weight: 800; font-size: 14px; padding: 1px 9px; border-radius: 7px; background: var(--hl); }
      .sec-3-6 .s36-var:empty { display: none; }
      .sec-3-6 .s36-empty { border: 2px dashed var(--line-2); border-radius: 10px; height: 191px; display: grid; place-items: center; color: var(--muted); font-size: 14.5px; }
      .sec-3-6 .s36-term { font-size: 13.5px; background: var(--panel-3); border-radius: 10px; padding: 6px 10px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .sec-3-6 .s36-out { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 0 7px; }
      .sec-3-6 .s36-fork pre.code { flex: none; }
      .sec-3-6 svg .s36-hot { stroke: var(--accent); }
      .sec-3-6 .s36-six { gap: 5px; }
      .sec-3-6 .s36-six .chip { font-size: 12.5px; padding: 1px 7px; }
      /* ---- step 7: predict ---- */
      .sec-3-6 .s36-n { width: 40px; padding: 0; font-size: 15px; }
      .sec-3-6 .s36-n.s36-right { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); }
      .sec-3-6 .callout.os { background: var(--os-bg); border-color: var(--os); }
      .sec-3-6 .callout.os::before { color: var(--os); }
    `,

    steps: [
      /* ---------------- 1. Big picture: the kernel runs inside user processes ---------------- */
      {
        title: 'UNIX SVR4: the kernel runs inside your processes',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack">
              <p class="lead m0">In <span class="t">SVR4</span>, most of the operating system runs <b>inside your own processes</b>: <span class="t" data-t="Execution within user processes">design 2 of section 3.5</span>.</p>
              <p class="m0">There is no separate “OS process” to send requests to. On a <span class="t">system call</span> or an <span class="t">interrupt</span>, the <b>same process</b> flips from <span class="t">user mode</span> into <span class="t">kernel mode</span> and runs the kernel’s code itself.</p>
              <div class="grid-2">
                <div class="card os tight">
                  <h4>System processes</h4>
                  <p class="small m0">Run <b>only in kernel mode</b>, executing OS housekeeping code such as memory allocation and swapping. Example: process 0, the <span class="t">swapper</span>.</p>
                </div>
                <div class="card proc tight">
                  <h4>User processes</h4>
                  <p class="small m0">Run programs and utilities in <b>user mode</b>, and switch to <b>kernel mode</b> to run kernel instructions on a system call, an exception (fault) or an interrupt.</p>
                </div>
              </div>
              <div class="callout analogy m0" data-label="Analogy">A library lends you a staff badge. You walk into the back room yourself, follow the library’s procedure, then hand the badge back. Same person, extra privileges, the library’s rules.</div>
            </div>
            <div class="card white stack s36-tl"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const host = el.querySelector('.s36-tl');
          const U = { y: 16, hh: 44 }, K = { y: 118, hh: 44 };
          // [id, lane, x1, x2, line1, line2, colour class, narration]
          const SEGS = [
            ['a', 'u', 104, 200, 'PID 812', 'editor code', 's-proc', '<b>PID 812 in user mode.</b> The editor runs its own instructions. It can touch only its own memory, and privileged instructions are off limits.'],
            ['b', 'k', 200, 290, 'PID 812', 'kernel code', 's-proc', '<b>Still PID 812, now in kernel mode.</b> The editor called <code>read()</code>. The processor switched to kernel mode and PID 812 itself runs the kernel’s file-reading code on its own kernel stack. No other process was needed.'],
            ['c', 'k', 290, 380, 'PID 0', 'swapper', 's-os', '<b>PID 0, the swapper: a system process.</b> PID 812 went to sleep to wait for the disk, so the kernel switched processes. The swapper runs only in kernel mode and moves process images between memory and disk. It never runs user code.'],
            ['d', 'k', 380, 446, 'PID 905', 'resumes', 's-proc', '<b>PID 905 resumes inside the kernel.</b> The scheduler picked PID 905. A UNIX process always gets the processor back in kernel mode, exactly where it stopped, and only then returns to user mode.'],
            ['e', 'u', 446, 540, 'PID 905', 'compiler code', 's-proc', '<b>PID 905 in user mode.</b> The compiler runs its own code, as PID 812 did at the start.'],
            ['f', 'k', 540, 612, 'PID 905', 'interrupt', 's-proc', '<b>PID 905 handles an interrupt that is not even its own.</b> The disk finishes PID 812’s read and interrupts. The kernel runs the handler inside whichever process is running (PID 905): it wakes PID 812, which becomes ready. No process switch needed.'],
            ['g', 'u', 612, 672, 'PID 905', '', 's-proc', '<b>Back to PID 905’s own code.</b> The interrupt return puts it back where it was. PID 812 will run again when the scheduler picks it.'],
          ];
          const svg = s('svg', { viewBox: '0 0 680 222', width: '100%', role: 'img', 'aria-label': 'Timeline of one processor switching between user mode and kernel mode' });
          svg.append(
            s('rect', { x: 100, y: U.y - 8, width: 576, height: U.hh + 16, rx: 10, class: 'lane-u' }),
            s('rect', { x: 100, y: K.y - 8, width: 576, height: K.hh + 16, rx: 10, class: 'lane-k' }),
            s('text', { x: 90, y: U.y + 17, 'text-anchor': 'end', 'font-weight': 800, 'font-size': 15 }, 'User'),
            s('text', { x: 90, y: U.y + 34, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'mode'),
            s('text', { x: 90, y: K.y + 17, 'text-anchor': 'end', 'font-weight': 800, 'font-size': 15, style: 'fill:var(--os)' }, 'Kernel'),
            s('text', { x: 90, y: K.y + 34, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'mode'),
            s('line', { x1: 104, y1: 198, x2: 668, y2: 198, class: 's-line', 'marker-end': 'url(#arr)' }),
            s('text', { x: 104, y: 216, 'font-size': 13, class: 's-sub' }, 'time →  (one processor, a few milliseconds)'),
          );
          // mode-change connectors between the lanes
          [[200, 'down', 'system call'], [446, 'up', 'return'], [540, 'down', 'interrupt'], [612, 'up', 'return']].forEach(([x, dir, lab]) => {
            svg.append(s('line', { x1: x, y1: dir === 'down' ? U.y + U.hh : K.y, x2: x, y2: dir === 'down' ? K.y - 2 : U.y + U.hh + 2, class: 's-line', 'stroke-dasharray': '4 3', 'marker-end': 'url(#arr)' }),
              s('text', { x: x + 6, y: 94, 'font-size': 13, 'font-weight': 650, style: 'fill:var(--ink-2)' }, lab));
          });
          // process switches happen inside the kernel lane
          [290, 380].forEach((x) => svg.append(
            s('line', { x1: x, y1: K.y - 6, x2: x, y2: K.y + K.hh + 6, class: 'sw-tick' }),
            s('text', { x, y: K.y + K.hh + 22, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--intr)' }, 'switch')));
          const segEls = {};
          SEGS.forEach(([id, lane, x1, x2, l1, l2, cls]) => {
            const L = lane === 'u' ? U : K;
            const cx = (x1 + x2) / 2;
            const g = s('g', { class: 'seg hot', 'data-click': id },
              s('rect', { x: x1 + 1.5, y: L.y, width: x2 - x1 - 3, height: L.hh, rx: 7, class: cls }),
              s('text', { x: cx, y: l2 ? L.y + 18 : L.y + 27, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, l1),
              l2 ? s('text', { x: cx, y: L.y + 34, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, l2) : null);
            g.addEventListener('click', () => pick(SEGS.findIndex((q) => q[0] === id)));
            svg.append(g);
            segEls[id] = g;
          });
          const cap = h('div', { class: 'player-cap s36-cap' });
          const count = h('span', { class: 'xs muted b' });
          const prev = h('button', { class: 'btn sm', type: 'button', onclick: () => pick(cur - 1) }, '◀ Back');
          const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => pick(cur + 1) }, 'Next moment ▶');
          let cur = 0;
          function pick(i) {
            cur = ctx.util.clamp(i, 0, SEGS.length - 1);
            SEGS.forEach(([id], k) => segEls[id].classList.toggle('on', k === cur));
            cap.innerHTML = SEGS[cur][7];
            count.textContent = `Moment ${cur + 1} of ${SEGS.length}`;
            prev.disabled = cur === 0; next.disabled = cur === SEGS.length - 1;
          }
          host.append(
            h('h4', { class: 'm0' }, 'One processor: who runs, and in which mode? Click any block.'),
            svg,
            h('div', { class: 'row' }, prev, next, count),
            cap,
            h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'Getting help from the kernel costs only a cheap <b>mode switch</b> inside the same process. A full <span class="t">process switch</span> happens only when the process has to wait, is preempted or ends.' }));
          pick(0);
        },
      },

      /* ---------------- 2. Explore the nine states and their seven-state equivalents ---------------- */
      {
        title: 'Nine states on one map',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const GROUPS = [
            ['Running', ['ur', 'kr'], 'Split by <b>mode</b>: User Running executes the program’s own code, Kernel Running executes kernel code on the process’s behalf. Either way the process holds the processor.'],
            ['Ready', ['rim', 'pre'], 'Split in two. <b>Ready to Run, in Memory</b> and <b>Preempted</b> are essentially the same state: both wait only for the processor, and the scheduler keeps them in <b>one queue</b>. Preempted is drawn apart to stress that preemption happens only as a process returns from kernel mode to user mode.'],
            ['Blocked', ['asl'], '<b>Asleep in Memory</b> is the Blocked state: waiting for an event, image still in main memory.'],
            ['Ready/Suspend', ['rsw'], '<b>Ready to Run, Swapped</b>: ready to go, but the image is on disk and must be swapped in first.'],
            ['Blocked/Suspend', ['ssw'], '<b>Sleeping, Swapped</b>: waiting for an event and swapped out to disk.'],
            ['New', ['cre'], '<b>Created</b> is the New state: the process exists but is not yet ready to run.'],
            ['Exit', ['zom'], '<b>Zombie</b> is the Exit state: the process is gone, but a record stays behind for its parent.'],
          ];
          const groupOf = (id) => GROUPS.findIndex((g) => g[1].includes(id));
          const dia = stateDiagram(ctx, { onState: (id) => pickState(id), onArrow: (id) => pickArrow(id) });
          const detail = h('div', { class: 'card white s36-detail' });
          const gbtns = GROUPS.map(([seven], gi) => h('button', { class: 'btn sm', type: 'button', onclick: () => pickGroup(gi) }, seven));
          const view = ctx.ui.seg([{ value: 'unix', label: 'UNIX names' }, { value: 'seven', label: 'Seven-state names' }], 'unix', (v) => dia.setView(v));
          const mark = (gi) => gbtns.forEach((b, k) => b.classList.toggle('on', k === gi));
          function pickState(id) {
            const m = ST[id];
            dia.states((x) => (x === id ? 'on' : null));
            dia.arrows((a) => (TR_BY[a].from === id || TR_BY[a].to === id ? null : 'dim'));
            mark(groupOf(id));
            let extra = '';
            if (id === 'pre') extra = `<div class="callout why small m0 mt" data-label="Why a separate state?">The traditional UNIX kernel is <span class="t" data-t="Nonpreemptible kernel">nonpreemptible</span>: it never <b>forces</b> a process off the processor mid-kernel, only as it is about to return to user mode, the moment this state marks. (Sleeping in the kernel is <b>voluntary</b>, so it is allowed.) Real-time work suffers: an urgent process may wait for a long system call to finish.</div>`;
            if (id === 'kr') extra = `<div class="callout warn small m0 mt" data-label="Common mistake">Kernel Running does <b>not</b> mean “the kernel process is running”. It is the same user process, executing kernel code in kernel mode.</div>`;
            detail.innerHTML = `<h3>${m.name}</h3><div class="row gap-s mb"><span class="chip accent">seven-state: ${m.seven}</span><span class="chip mem">${m.mem}</span></div><p class="small m0">${ST_INFO[id]}</p>${extra}`;
          }
          function pickArrow(id) {
            const t = TR_BY[id];
            dia.arrows((a) => (a === id ? 'on' : 'dim'));
            dia.states((x) => (x === t.from || x === t.to ? 'seen' : 'dim'));
            mark(-1);
            const route = t.from ? (t.from === t.to ? `${ST[t.from].name} → itself` : `${ST[t.from].name} → ${ST[t.to].name}`) : `(nothing) → ${ST[t.to].name}`;
            detail.innerHTML = `<h3>“${t.label}”</h3><div class="row gap-s mb"><span class="chip proc">${route}</span></div><p class="small m0">${TR_INFO[id]}</p>`;
          }
          function pickGroup(gi) {
            const [seven, ids, txt] = GROUPS[gi];
            dia.states((x) => (ids.includes(x) ? 'on' : 'dim'));
            dia.arrows(() => null);
            mark(gi);
            detail.innerHTML = `<h3>Seven-state “${seven}”</h3><div class="row gap-s mb">${ids.map((i) => `<span class="chip accent">${ST[i].name}</span>`).join('')}</div><p class="small m0">${txt}</p>` +
              `<table class="tbl compact small mt"><tr><th>UNIX state</th><th>Where is its image?</th><th>When can it run?</th></tr>${ids.map((i) => `<tr><td class="b">${ST[i].name}</td><td>${ST[i].mem}</td><td>${ST[i].run}</td></tr>`).join('')}</table>`;
          }
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'card white diag-card' }, dia.svg, diagramKey(ctx)),
            h('div', { class: 'stack' },
              h('div', { class: 'row' }, view, h('span', { class: 'xs muted' }, 'Click any state or arrow.')),
              h('div', { class: 'stack gap-s' }, h('h4', { class: 'm0' }, 'Seven-state model → UNIX: pick a state'), h('div', { class: 'row gap-s' }, ...gbtns)),
              detail)));
          pickState('pre');
        },
      },

      /* ---------------- 3. The life of a process: guided tour, then drive it yourself ---------------- */
      {
        title: 'One life, fork to zombie: watch it, then drive it',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const dia = stateDiagram(ctx, { onArrow: (id) => { if (mode === 'drive' && OUT(cur).includes(id)) take(id); } });
          const TOUR = [
            [null, null, '<b>Before birth.</b> Your shell (the parent) wants to run a program. Every UNIX process is born the same way: an existing process calls <code>fork()</code>. Only process 0 is different: the kernel builds it by hand at boot.'],
            ['cre', 'fork', '<b>fork → Created.</b> The kernel gives the child a process table entry and a new ID and copies the parent’s image. The child is not ready to run yet.'],
            ['rim', 'enough', '<b>enough memory → Ready to Run, in Memory.</b> There is room in main memory, so the child joins the processes waiting for the processor.'],
            ['kr', 'reschedule', '<b>reschedule → Kernel Running.</b> The scheduler picks the child. It starts inside the kernel, finishing its return from <code>fork()</code>.'],
            ['ur', 'ret', '<b>return to user → User Running.</b> The child now runs its own program in user mode.'],
            ['kr', 'syscall', '<b>system call → Kernel Running.</b> The program calls <code>read()</code> to get file data. Same process, now executing kernel code.'],
            ['asl', 'sleep', '<b>sleep → Asleep in Memory.</b> The data must come from the disk, which takes milliseconds. The process sleeps on that event and the kernel runs someone else.'],
            ['ssw', 'swapOutSleep', '<b>swap out → Sleeping, Swapped.</b> Memory is tight. The swapper picks this sleeper (it could not run anyway) and copies its image to disk.'],
            ['rsw', 'wakeupSw', '<b>wakeup → Ready to Run, Swapped.</b> The disk data arrives. The process is ready now, but its image is still on disk.'],
            ['rim', 'swapIn', '<b>swap in → Ready to Run, in Memory.</b> The swapper brings the image back into main memory, so the scheduler may pick it.'],
            ['kr', 'reschedule', '<b>reschedule → Kernel Running.</b> Picked again, it resumes inside the kernel exactly where it fell asleep, and finishes the <code>read()</code> call.'],
            ['ur', 'ret', '<b>return to user → User Running.</b> <code>read()</code> hands back the data and the program carries on.'],
            ['kr', 'syscall', '<b>interrupt → Kernel Running.</b> A clock interrupt arrives while the program runs. The kernel handles it inside this process and finds that the process has used up its time slice.'],
            ['pre', 'preempt', '<b>preempt → Preempted.</b> On its way back to user mode, the kernel sees that another ready process now deserves the processor more, and switches to it. This return-to-user moment is the only place this kernel preempts.'],
            ['ur', 'preRet', '<b>return to user → User Running.</b> Later the scheduler picks it again. Its kernel work was already done, so it goes straight back to its own code.'],
            ['kr', 'syscall', '<b>system call → Kernel Running.</b> The program has finished its work and calls <code>exit()</code>.'],
            ['zom', 'exit', '<b>exit → <span class="t">Zombie</span>.</b> The kernel frees its memory and closes its files but keeps a small record (exit status, times used). When the parent collects it with <code>wait()</code>, the record goes too.'],
          ];
          const DRIVE_LABEL = { fork: 'fork()', enough: 'enough memory', notEnough: 'not enough memory', reschedule: 'scheduler picks it', syscall: 'system call or interrupt', ret: 'return to user', preempt: 'preempt', preRet: 'scheduler picks it again', exit: 'exit()', sleep: 'sleep (wait for disk)', wakeupMem: 'the event happens', swapOutSleep: 'swap out', wakeupSw: 'the event happens', swapOutReady: 'swap out', swapIn: 'swap in', intr: 'interrupt' };
          const MISSIONS = [
            ['Run the new process’s own code: reach User Running.', (v) => v.st.includes('ur')],
            ['Put it to sleep, then get it swapped out while asleep.', (v) => v.st.includes('ssw')],
            ['Bring it back from disk all the way to User Running.', (v) => { const k = v.st.indexOf('ssw'); return k >= 0 && v.st.indexOf('ur', k) > k; }],
            ['Get it preempted, then let it resume its own code.', (v) => v.tr.includes('preRet')],
            ['End its life: reach Zombie.', (v) => v.st.includes('zom')],
          ];
          const OUT = (st) => (st === null ? ['fork'] : TR.filter((t) => t[1] === st && t[0] !== 'fork').map((t) => t[0]));
          // done: missions completed so far; kept across "Start a new process", cleared only by Reset
          let mode = 'tour', cur = null, visit = { st: [], tr: [] }, player = null, trailMax = 17;
          const done = new Set();
          const status = h('div', { class: 'row gap-s' });
          const trail = h('div', { class: 'row gap-s s36-trail' });
          const body = h('div', { class: 'stack grow' });
          function paint(st, tr, seenStates, usedArrows, avail = []) {
            dia.states((x) => (x === st ? 'on' : seenStates.includes(x) ? 'seen' : null));
            dia.arrows((a) => (a === tr ? 'on' : avail.includes(a) ? 'avail' : usedArrows.includes(a) ? 'used' : null));
            status.innerHTML = st ? `<span class="chip accent">now: ${ST[st].name}</span><span class="chip">seven-state: ${ST[st].seven}</span><span class="chip mem">${ST[st].mem}</span>`
              : '<span class="chip">no process yet</span>';
            const path = seenStates.concat(st ? [st] : []);
            const shown = path.length > trailMax ? path.slice(1 - trailMax) : path;
            trail.innerHTML = '<span class="xs muted b">Path so far (green arrows; bold indigo = latest move):</span>' + (path.length > shown.length ? '<span class="xs muted">…</span>' : '') +
              (shown.map((x, k) => `<span class="chip ${k === shown.length - 1 && st ? 'accent' : ''}">${ST[x].sub}</span>`).join('<span class="xs muted">→</span>') || '<span class="xs muted">(empty)</span>');
          }
          function tour() {
            player = ctx.ui.player({ count: TOUR.length, interval: 2600, speed: false, render: (i) => {
              const past = TOUR.slice(1, i);
              paint(TOUR[i][0], TOUR[i][1], past.map((f) => f[0]), past.map((f) => f[1]));
              return TOUR[i][2];
            } });
            body.append(player.el,
              h('div', { class: 'callout tip small m0', 'data-label': 'Watch for this', html: 'Every trip onto or off the processor passes through <b>Kernel Running</b>. A process is always switched out from inside the kernel, and it always resumes inside the kernel.' }));
          }
          const btns = h('div', { class: 'row gap-s' });
          const cap = h('div', { class: 'player-cap s36-cap' });
          const mlist = h('ol', { class: 'small s36-miss m0' });
          function drawDrive(msg) {
            const past = visit.st.slice(0, -1);
            paint(cur, visit.tr[visit.tr.length - 1] || null, past, visit.tr, OUT(cur));
            btns.replaceChildren(...OUT(cur).map((id) => h('button', { class: 'btn sm proc', type: 'button', onclick: () => take(id) }, DRIVE_LABEL[id])));
            if (cur === 'ur') btns.append(h('button', { class: 'btn sm ghost', type: 'button', onclick: () => whyNot('ur') }, 'Switch it out right now?'));
            if (cur === 'kr') btns.append(h('button', { class: 'btn sm ghost', type: 'button', onclick: () => whyNot('kr') }, 'Force it out mid-kernel?'));
            if (cur === 'zom') btns.append(h('button', { class: 'btn sm primary', type: 'button', onclick: () => resetDrive(false) }, 'Start a new process'));
            mlist.replaceChildren(...MISSIONS.map(([t], i) => h('li', { class: done.has(i) ? 'done' : '' }, (done.has(i) ? '✓ ' : '') + t)));
            if (msg) cap.innerHTML = msg;
          }
          function take(id) {
            const t = TR_BY[id];
            const before = done.size;
            cur = t.to; visit.st.push(cur); visit.tr.push(id);
            MISSIONS.forEach(([, ok], i) => { if (ok(visit)) done.add(i); });
            let msg = TR_INFO[id];
            if (done.size > before) msg += done.size === MISSIONS.length ? ' <b>All five missions complete!</b>' : ` <b>Mission done (${done.size}/5).</b>`;
            drawDrive(msg);
          }
          function whyNot(st) {
            cap.innerHTML = st === 'ur'
              ? '<b>Not from here.</b> While a process runs its own code, the kernel is not running at all. A clock interrupt (or a system call) must first carry the process into Kernel Running; only then can the kernel decide to switch.'
              : '<b>Not by force.</b> This kernel is <span class="t" data-t="Nonpreemptible kernel">nonpreemptible</span>: it never forces a process off the processor in the middle of kernel code, because kernel tables might be half-updated. It waits until the process is about to return to user mode: the <b>preempt</b> arrow. A process can leave mid-kernel only <b>voluntarily</b>, by going to sleep to wait for an event (the <b>sleep</b> arrow).';
          }
          function resetDrive(all) {
            if (all) done.clear();
            cur = null; visit = { st: [], tr: [] };
            drawDrive(all || !done.size ? 'Press <b>fork()</b> to create a process, then choose each move. The dashed teal arrows show the moves open to you.'
              : 'A brand-new process: press <b>fork()</b> again. Missions you already completed stay ticked.');
          }
          function setMode(v) {
            if (player) { player.stop(); player = null; }
            mode = v; trailMax = 17; trail.style.display = v === 'tour' ? '' : 'none'; body.replaceChildren();
            if (v === 'tour') tour();
            else {
              body.append(h('div', { class: 'card tight' }, h('h4', {}, 'Missions'), mlist),
                h('div', { class: 'stack gap-s' }, h('div', { class: 'row' }, h('span', { class: 'xs muted b grow' }, 'CHOOSE WHAT HAPPENS NEXT (or click a dashed arrow)'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => resetDrive(true) }, '↺ Reset')), btns), cap);
              resetDrive(false);
            }
          }
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'card white diag-card' }, dia.svg, diagramKey(ctx)),
            h('div', { class: 'stack' },
              ctx.ui.seg([{ value: 'tour', label: 'Guided tour' }, { value: 'drive', label: 'You drive' }], 'tour', setMode),
              status, body, trail)));
          setMode('tour');
        },
      },

      /* ---------------- 4. The process image: three layers of context ---------------- */
      {
        title: 'The process image: three layers of context',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack">
              <p class="lead m0">Everything that makes up a UNIX process is its <span class="t">process image</span>. SVR4 sorts it into three kinds of <b>context</b>.</p>
              <div class="card proc tight"><b>1. <span class="t">User-level context</span></b><br><span class="small">What the program itself can see and change: its instructions, data and stack.</span></div>
              <div class="card cpu tight"><b>2. <span class="t">Register context</span></b><br><span class="small">The processor’s registers while this process runs. Saved when it stops, reloaded when it resumes.</span></div>
              <div class="card os tight"><b>3. <span class="t">System-level context</span></b><br><span class="small">The kernel’s private bookkeeping about this process. User code can never touch it.</span></div>
              <div class="callout warn small m0" data-label="Common mistake">Picturing the register context as a table in memory. While the process runs, it <b>is</b> the processor’s live registers. The kernel copies it into memory when the process enters the kernel or is switched out, and reloads it to resume.</div>
            </div>
            <div class="stack s36-img"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const host = el.querySelector('.s36-img');
          const LAYERS = [
            ['proc', 'User-level context', 'the program’s own view', [
              ['text', 'Process text', 'The program’s <b>executable machine instructions</b>. Normally read-only, so a bug cannot overwrite the code.'],
              ['data', 'Process data', 'The <b>data the program’s code works on</b>: its variables and other values that only this process can reach.'],
              ['ustack', 'User stack', 'Arguments, local variables and return addresses for the functions the process calls <b>while in user mode</b>. It grows with each call and shrinks with each return.'],
              ['shm', 'Shared memory', 'A region that <b>several processes can all access</b>, used to pass data quickly. There is one physical copy; each sharing process maps it into its own image.'],
            ]],
            ['cpu', 'Register context', 'where the processor was', [
              ['pc', 'Program counter', 'The <b>address of the next instruction</b> to execute: in the program text while in user mode, in kernel code while in kernel mode.'],
              ['psr', 'Processor status register', 'The <b>hardware status</b> when the process last ran: condition codes, the current mode, interrupt settings. Its exact format depends on the hardware.'],
              ['sp', 'Stack pointer', 'Points to the <b>top of the stack in use</b>: the user stack in user mode, the kernel stack in kernel mode.'],
              ['gpr', 'General-purpose registers', 'The <b>working registers</b> the code was using. Their number and size depend on the hardware.'],
            ]],
            ['os', 'System-level context', 'what only the kernel sees', [
              ['pte', 'Process table entry', 'The kernel’s record of this process that is <b>always accessible to the kernel</b>, even while the process sleeps or is swapped out: its state, IDs, priority, pending signals and more.'],
              ['uarea', 'U area', 'The <b>user area</b>: information the kernel needs <b>only while this process is running</b>, such as its open files and system-call parameters. It can be swapped out with the rest of the image.'],
              ['region', 'Per-process region table', 'Maps this process’s <b>virtual addresses to physical memory</b>, region by region (text, data, stack), with a permission field saying read-only, read-write or read-execute.'],
              ['kstack', 'Kernel stack', 'The stack used while the process executes <b>kernel code</b>: the frames of the kernel functions it has called. Separate from the user stack, so user code cannot corrupt it.'],
            ]],
          ];
          const SCEN = [
            ['Its code calls a function', ['text', 'pc', 'ustack', 'sp'], 'The program counter walks through the <b>process text</b>; the call pushes a frame onto the <b>user stack</b> and moves the stack pointer. All in user mode.'],
            ['It touches virtual address 0x4000', ['region', 'data'], 'The address is virtual. The <b>per-process region table</b> tells the kernel (and memory hardware) which physical memory backs it and whether this access is allowed.'],
            ['It calls read() on an open file', ['uarea', 'kstack', 'pc'], 'Now in kernel mode: the kernel’s functions run on the <b>kernel stack</b>, and the <b>U area</b> supplies the open-file table and the I/O parameters of this call.'],
            ['It is switched out', ['pc', 'psr', 'sp', 'gpr', 'pte'], 'The whole <b>register context</b> is saved, and the <b>process table entry</b> records the new state so the kernel can find and resume the process later.'],
            ['Its disk data arrives while it sleeps', ['pte'], 'The kernel must find who was waiting, even if they are swapped out. Only the <b>process table entry</b> (with its event descriptor) is guaranteed to be in memory.'],
          ];
          const pieces = {};
          const detail = h('div', { class: 'player-cap s36-cap' });
          const sbtns = SCEN.map(([lab], i) => h('button', { class: 'btn sm', type: 'button', onclick: () => scen(i) }, lab));
          function light(ids) { Object.entries(pieces).forEach(([id, b]) => { b.classList.toggle('on', ids.includes(id)); b.classList.toggle('dim', ids.length > 0 && !ids.includes(id)); }); }
          function piece(layer, id, name, txt) {
            light([id]); sbtns.forEach((b) => b.classList.remove('on'));
            const nm = ['Process table entry', 'U area', 'Per-process region table', 'Kernel stack', 'Shared memory', 'Program counter'].includes(name) ? `<span class="t">${name}</span>` : name;
            detail.innerHTML = `<b>${nm}</b> <span class="chip ${layer[0]}">${layer[1]}</span><br>${txt}`;
          }
          function scen(i) {
            light(SCEN[i][1]); sbtns.forEach((b, k) => b.classList.toggle('on', k === i));
            detail.innerHTML = `<b>Scenario: ${SCEN[i][0]}.</b> ${SCEN[i][2]}`;
          }
          const bands = LAYERS.map((L) => h('div', { class: 'card tight s36-band ' + L[0] },
            h('div', { class: 'row s36-bandh' }, h('b', {}, L[1]), h('span', { class: 'xs muted' }, '· ' + L[2])),
            h('div', { class: 'grid-4 gap-s' }, ...L[3].map(([id, name, txt]) => (pieces[id] = h('button', { class: 'box ' + L[0] + ' s36-piece', type: 'button', onclick: () => piece(L, id, name, txt) }, name))))));
          host.append(
            h('h4', { class: 'm0' }, 'One UNIX process image: click any piece'),
            ...bands,
            h('div', { class: 'row gap-s', style: { alignItems: 'center' } }, h('span', { class: 'xs muted b' }, 'OR PICK A MOMENT:'), ...sbtns),
            detail);
          scen(2);
        },
      },

      /* ---------------- 5. Sort game: process table entry or U area? ---------------- */
      {
        title: 'Process table entry or U area? Sort the fields',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const BINS = ['Process table entry', 'Both', 'U area'];
          const BCLS = ['os', 'accent', 'proc'];
          // [field name, bin (0 = process table entry, 1 = both, 2 = U area), why]
          const F = [
            ['Process status', 0, 'The current state (Created, Asleep in Memory, Zombie…). The scheduler and the swapper check it for every process, running or not.'],
            ['Pointers to U area and memory', 0, 'The kernel must find a process’s U area and its text, data and stack even when it is not running, for example to swap it in or out.'],
            ['Process size', 0, 'Tells the kernel how much space to find when it swaps the process in or out.'],
            ['Process IDs (own and parent)', 0, 'Its own ID and its parent’s ID, set when the process is created. Needed to deliver signals and to leave the zombie record for the right parent.'],
            ['Event descriptor', 0, 'Records the event a sleeping process waits for. When the event happens the kernel must find every matching sleeper, even swapped-out ones.'],
            ['Priority', 0, 'The scheduler compares the priorities of all ready processes, and a ready process is by definition not running.'],
            ['Signal (pending signals)', 0, 'Signals sent to the process but not yet handled. A signal can arrive at any time, even while the process is asleep on disk.'],
            ['P_link', 0, 'Pointer to the next process in the ready queue. It only matters while the process is waiting in that queue, not while it runs.'],
            ['Memory status', 0, 'Is the image in main memory or swapped out, and is it locked in memory? The swapper reads this for every process.'],
            ['User IDs (real and effective)', 1, 'Kept in both. The kernel needs them while the process runs (what may its system calls do?) and while it does not (who may send it a signal?).'],
            ['Timers', 1, 'Kept in both, for different jobs: the process table’s timers track execution time, kernel resource use and user-set alarms; the U area’s record user-mode and kernel-mode time of the process and its children.'],
            ['Process table pointer', 2, 'Points back to this process’s process table entry, tying the two halves of the kernel’s record together.'],
            ['Signal-handler array', 2, 'For each kind of signal, what this process wants done: exit, ignore, or run one of its own functions. Consulted when the signal is acted on, while the process runs.'],
            ['Control terminal', 2, 'The login terminal this process is attached to, if any.'],
            ['Error field', 2, 'Records the error, if any, from the system call being executed.'],
            ['Return value', 2, 'Holds the result of the system call being executed.'],
            ['I/O parameters', 2, 'For the I/O in progress: how much data to move, the source or target address in user space, and the file offset.'],
            ['File parameters', 2, 'The current directory and current root: where this process’s file names are looked up.'],
            ['User file descriptor table', 2, 'The files this process has open. When it calls read() on descriptor 3, the kernel looks up entry 3 here.'],
            ['Limit fields', 2, 'Limits on the size of the process and on how large a file it may write.'],
            ['Permission modes', 2, 'A mask applied to the permissions of files the process creates.'],
          ];
          let round = 0, order = [], k = 0, res = {};
          const count = h('span', { class: 'chip accent' });
          const score = h('span', { class: 'xs muted b' });
          const fname = h('div', { class: 's36-field' });
          const fb = h('div', { class: 'player-cap s36-fb' });
          const abtns = BINS.map((b, bi) => h('button', { class: 'btn ' + BCLS[bi], type: 'button', onclick: () => answer(bi) }, b));
          const again = h('button', { class: 'btn sm primary', type: 'button', onclick: () => start(round + 1) }, 'Play again (new order)');
          const binEls = BINS.map(() => h('div', { class: 'row gap-s s36-chips' }));
          function start(r) {
            round = r; order = ctx.util.shuffle(ctx.util.range(F.length), ctx.util.seeded(7 + r)); k = 0; res = {};
            binEls.forEach((b) => b.replaceChildren());
            fb.innerHTML = 'Decide where the kernel keeps each field. Ask yourself: <b>does the kernel need it even when the process is not running?</b>';
            show();
          }
          function show() {
            const right = Object.values(res).filter(Boolean).length, done = Object.keys(res).length;
            score.textContent = `${right} of ${done} right first time` + (done ? ' · click a sorted chip to review it' : '');
            if (k >= F.length) {
              count.textContent = 'All 21 sorted';
              fname.innerHTML = right === F.length ? 'Perfect sort!' : `Done: ${right} / ${F.length} right.`;
              abtns.forEach((b) => (b.disabled = true));
              again.style.display = '';
              return;
            }
            again.style.display = 'none';
            abtns.forEach((b) => (b.disabled = false));
            count.textContent = `Field ${k + 1} of ${F.length}`;
            fname.textContent = F[order[k]][0];
          }
          function answer(bi) {
            if (k >= F.length) return;
            const i = order[k], [name, bin, why] = F[i];
            const ok = bin === bi;
            res[i] = ok;
            const chip = h('button', { class: 'chip ' + (ok ? 'ok' : 'bad') + ' s36-chip', type: 'button', title: why, onclick: () => { fb.innerHTML = `<b>${name}</b> → ${BINS[bin]}. ${why}`; } }, (ok ? '✓ ' : '✗ ') + name);
            binEls[bin].append(chip);
            fb.innerHTML = (ok ? '<span class="s36-ok">✓ Right.</span> ' : `<span class="s36-bad">✗ Not ${BINS[bi]}.</span> `) + `<b>${name}</b> belongs in <b>${BINS[bin]}</b>. ${why}`;
            k++;
            show();
          }
          el.append(h('div', { class: 'stack fill' },
            h('div', { class: 'split r', style: { height: 'auto' } },
              h('div', { class: 'card white stack gap-s' },
                h('div', { class: 'row' }, count, score),
                fname,
                h('div', { class: 'row' }, ...abtns, again),
                fb),
              h('div', { class: 'stack' },
                h('div', { class: 'callout why small m0', 'data-label': 'Why split the record in two?', html: 'Main memory was scarce. The small <span class="t">process table entry</span> stays in memory at all times, so the kernel can schedule, wake or signal any process. The <span class="t">U area</span> is needed only while its process runs, so it can be swapped out with the rest of the image.' }),
                ctx.ui.reveal('Show the rule of thumb', '<div class="callout tip small m0" data-label="Rule of thumb">Needed when the process is <b>not</b> running (asleep, swapped out, waiting in a queue)? Process table entry. Needed only while it runs its own system calls? U area.</div>'))),
            h('div', { class: 'grid-3 grow s36-bins' }, ...BINS.map((b, bi) => h('div', { class: 'card tight stack gap-s ' + BCLS[bi] }, h('h4', { class: 'm0' }, b), binEls[bi])))));
          start(0);
        },
      },

      /* ---------------- 6. fork() step by step ---------------- */
      {
        title: 'fork(): what the kernel does, step by step',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          // each line: [code, plain-language comment]; padded so comments line up
          const LINES = [
            ['pid_t pid;', 'room for fork’s answer'],
            ['pid = fork();', 'ask the kernel: clone me'],
            ['if (pid == 0) {', '0 means: I am the child'],
            ['  printf("child\\n");', 'only the child prints this'],
            ['  execlp("ls","ls",NULL);', 'child becomes the ls program'],
            ['} else {', 'not 0: I am the parent'],
            ['  printf("parent\\n");', 'only the parent prints this'],
            ['  wait(NULL);', 'sleep until the child ends'],
            ['}', 'end of if/else'],
          ];
          const SRC = LINES.map(([c, m]) => c.padEnd(27) + '// ' + m).join('\n');
          function panel(who, pid) {
            const st = h('span', { class: 'chip' });
            const v = h('span', { class: 's36-var mono' });
            const code = ctx.ui.code(SRC, { lang: 'c', fontSize: 13 });
            const empty = h('div', { class: 's36-empty' }, 'No child yet: fork() has not created it.');
            const el = h('div', { class: 'stack gap-s' }, h('div', { class: 'row gap-s' }, h('span', { class: 'chip proc' }, `${who} · PID ${pid}`), st, h('span', { class: 'grow' }), v), code, empty);
            return { el, st, v, code, empty };
          }
          const P = panel('Parent', 812), C = panel('Child', 813);
          P.empty.remove();
          const term = h('div', { class: 's36-term mono' });
          const scene = forkScene(ctx);
          const STEPS6 = ['slot', 'PID', 'copy image', 'file counts', 'Ready to Run', 'return values'];
          const chips = STEPS6.map((t, i) => h('span', { class: 'chip', html: `<b>${i + 1}</b>&nbsp;${t}` }));
          const base = { k: 0, pSt: 'User Running', cSt: null, slot: 'free', image: false, files: 1, hot: null, pVar: '?', cVar: '?', pL: [2], cL: [], cDim: false, out: [] };
          const CH = [
            [{}, '<b>Before.</b> Process 812 runs its own code in user mode and is about to execute line 2, <code>pid = fork();</code>. Watch the kernel’s tables: process table, main memory and open files.'],
            [{ pSt: 'Kernel Running' }, '<b><span class="t">fork()</span> is a system call.</b> Process 812 switches into kernel mode. Everything that follows is done by the kernel, running inside the parent process.'],
            [{ k: 1, slot: 'reserved', hot: 'slot' }, '<b>(1) Allocate a slot</b> in the process table for the new process. Slot 3 is free, so the kernel claims it. (With no free slot, fork would fail.)'],
            [{ k: 2, slot: 'pid', hot: 'slot' }, '<b>(2) Assign a unique process ID</b> to the child: <b>813</b>. No other current process has this number.'],
            [{ k: 3, image: true, cSt: 'Created', hot: 'image' }, '<b>(3) Copy the parent’s process image</b> (text, data, stack), so the child starts as an exact twin. The one exception is <span class="t">shared memory</span>: it is not copied; the child simply shares it too. (Modern kernels delay the copying: parent and child share pages until one of them writes, called copy-on-write.)'],
            [{ k: 4, files: 2, hot: 'files' }, '<b>(4) Increment the counters of every file the parent has open.</b> The child inherits them, so each file now has two users and stays open until both are done.'],
            [{ k: 5, slot: 'ready', cSt: 'Ready to Run', hot: 'slot' }, '<b>(5) Put the child in the Ready to Run state.</b> From now on the scheduler may choose it like any other process.'],
            [{ k: 6, pVar: '813', cVar: '0', cL: [2], hot: null }, '<b>(6) Return the child’s ID to the parent and 0 to the child.</b> The parent’s <code>pid</code> becomes 813; the child’s copy will read 0. That single difference is how the twins tell themselves apart. <b>Next, the kernel must choose who runs: pick one of its three options below.</b>'],
          ];
          // after step 6 the kernel has three options; each is its own four-frame branch
          const LS = 'notes.txt  report.c';
          const EXEC = (extra) => '<b>fork, then exec.</b> The child calls <code>execlp()</code>, one of the <span class="t">exec</span> calls: its program is replaced by <code>ls</code>. Same process, same PID 813, brand-new code; ls prints the directory listing.' + extra;
          const ZOMB = '<b>ls finishes: exit → Zombie.</b> The kernel frees the child’s image and closes its files (both counts drop back to 1), but slot 3 keeps a small record with the exit status.';
          const BR = {
            parent: [
              [{ pSt: 'User Running', pL: [6, 7], out: ['parent'] }, '<b>Choice: stay in the parent.</b> The kernel returns to user mode in the parent, at the point of the fork call. Its pid is 813, not 0, so it takes the <b>else</b> branch and prints “parent”. The child waits in Ready to Run.'],
              [{ pSt: 'Asleep in Memory', cSt: 'User Running', pL: [8], cL: [3, 4], out: ['parent', 'child'] }, '<b>The child gets its turn.</b> The parent calls <code>wait()</code> and sleeps until its child ends, so the scheduler picks the child. It starts where the parent was, at the return from fork(). Its pid is 0, so it prints “child”.'],
              [{ cL: [5], cDim: true, cImg: 'ls', hot: 'image', out: ['parent', 'child', LS] }, EXEC(' Every command you type in a shell starts this way.')],
              [{ pSt: 'Ready to Run', cSt: 'Zombie', slot: 'zombie', cImg: 'freed', files: 1, hot: 'slot', cL: [], out: ['parent', 'child', LS] }, ZOMB + ' The child’s exit also wakes the parent. When it runs, its <code>wait()</code> collects that record and slot 3 is free again.'],
            ],
            child: [
              [{ pSt: 'Ready to Run', cSt: 'User Running', pL: [2], cL: [3, 4], out: ['child'] }, '<b>Choice: switch to the child.</b> The parent is left in Ready to Run. The child starts at the same point in the code as the parent, the return from fork(). Its pid is 0, so it prints “child” first.'],
              [{ cL: [5], cDim: true, cImg: 'ls', hot: 'image', out: ['child', LS] }, EXEC(' The parent is still waiting its turn.')],
              [{ cSt: 'Zombie', slot: 'zombie', cImg: 'freed', files: 1, hot: 'slot', cL: [], out: ['child', LS] }, ZOMB + ' The parent has not even printed yet.'],
              [{ pSt: 'User Running', pL: [6, 7, 8], hot: null, out: ['child', LS, 'parent'] }, '<b>At last the parent runs.</b> fork() returns 813, so it prints “parent”. Its <code>wait()</code> finds the zombie child at once, collects the record and returns. The same lines as the other choices, in a <b>different order</b>.'],
            ],
            other: [
              [{ pSt: 'Ready to Run', pL: [2], out: [] }, '<b>Choice: switch to another process.</b> A more important process (say PID 905) is ready, so the kernel runs it. Parent and child are <b>both</b> left in Ready to Run, each paused at the return from fork(). Nothing new is printed.'],
              [{ pSt: 'User Running', pL: [6, 7], out: ['parent'] }, '<b>Later the scheduler picks one of the two</b>, here the parent: it returns to user mode at the fork call and prints “parent”. It could just as well have picked the child first.'],
              [{ pSt: 'Asleep in Memory', cSt: 'User Running', pL: [8], cL: [3, 4], out: ['parent', 'child'] }, '<b>The child runs.</b> The parent sleeps in <code>wait()</code>; the scheduler picks the child, whose pid is 0, so it prints “child”.'],
              [{ cL: [5], cDim: true, cImg: 'ls', hot: 'image', out: ['parent', 'child', LS] }, EXEC(' The choice changes the line order, not the count (on a terminal, as here).')],
            ],
          };
          const FR = [];
          CH.reduce((acc, [chg, cap]) => { const f = Object.assign({}, acc, chg, { cap, now: chg.k || 0 }); FR.push(f); return f; }, base);
          const FB = {};
          Object.entries(BR).forEach(([key, list]) => {
            FB[key] = [];
            list.reduce((acc, [chg, cap]) => { const f = Object.assign({}, acc, { hot: null }, chg, { cap, now: 0 }); FB[key].push(f); return f; }, FR[FR.length - 1]);
          });
          let choice = 'parent';
          const frameAt = (i) => (i < FR.length ? FR[i] : FB[choice][i - FR.length]);
          function draw(f) {
            chips.forEach((c, i) => { c.className = 'chip ' + (i + 1 === f.now ? 'accent' : i + 1 <= f.k ? 'ok' : ''); });
            scene.draw(f);
            P.st.textContent = f.pSt; P.v.textContent = 'pid = ' + f.pVar;
            P.code.clear(); P.code.mark(f.pL);
            const alive = !!f.cSt;
            C.code.style.display = alive ? '' : 'none'; C.empty.style.display = alive ? 'none' : '';
            C.st.textContent = alive ? f.cSt + (f.cImg === 'ls' ? ' (now ls)' : '') : 'does not exist';
            C.v.textContent = alive ? 'pid = ' + f.cVar : '';
            C.code.clear();
            // after exec only line 5 is still "this program"; after exit none of it is
            if (f.cDim) C.code.mark(ctx.util.range(9).map((i) => i + 1).filter((n) => f.cSt === 'Zombie' || n !== 5), 'dim');
            C.code.mark(f.cL);
            term.innerHTML = '<span class="xs muted b">TERMINAL</span> ' + (f.out.length ? f.out.map((o) => `<span class="s36-out">${o}</span>`).join('') : '<span class="muted">(nothing printed yet)</span>');
            return f.cap;
          }
          const player = ctx.ui.player({ count: FR.length + 4, interval: 3200, speed: false, render: (i) => draw(frameAt(i)) });
          const pickChoice = ctx.ui.seg([{ value: 'parent', label: 'Stay in the parent' }, { value: 'child', label: 'Switch to the child' }, { value: 'other', label: 'Run another process' }], 'parent',
            (v) => { choice = v; player.stop(); player.go(FR.length); });
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack gap-s s36-fork' }, P.el, C.el, term),
            h('div', { class: 'stack gap-s' }, h('div', { class: 'row gap-s s36-six' }, ...chips), h('div', { class: 'card white tight' }, scene.svg), player.el,
              h('div', { class: 'card tight stack gap-s s36-choice' }, h('span', { class: 'xs muted b' }, 'AFTER ITS SIX STEPS THE KERNEL CHOOSES WHO RUNS NEXT. TRY ALL THREE:'), pickChoice))));
        },
      },

      /* ---------------- 7. Predict: how many lines does a fork program print? ---------------- */
      {
        title: 'Predict the output, then see the family tree',
        kind: 'predict',
        render(el, ctx) {
          const { h, s } = ctx;
          // code lines [code, comment]; tree nodes [id, parent, which fork made it, what it prints]
          const PUZ = [
            { label: 'One fork', code: [['fork();', 'ask for a child'], ['printf("hi\\n");', 'print one line']],
              nodes: [['P', null, 0, 'hi'], ['C1', 'P', 1, 'hi']], legend: ['fork()'],
              why: '<code>fork()</code> returns twice: once in the parent and once in the new child. Both carry on from the line after it, so “hi” appears <b>2</b> times.' },
            { label: 'Two forks', code: [['fork();', 'ask for a child'], ['fork();', 'ask for another child'], ['printf("hi\\n");', 'print one line']],
              nodes: [['P', null, 0, 'hi'], ['C1', 'P', 1, 'hi'], ['C2', 'P', 2, 'hi'], ['C3', 'C1', 2, 'hi']], legend: ['1st fork()', '2nd fork()'],
              why: 'The first fork makes 2 processes, and <b>both</b> run the second fork, so each makes a child: <b>4</b> processes, 4 lines. n forks in a row give 2ⁿ processes.' },
            { label: 'A, then B', code: [['fork();', 'ask for a child'], ['printf("A\\n");', 'print A'], ['fork();', 'ask for another child'], ['printf("B\\n");', 'print B']],
              nodes: [['P', null, 0, 'A B'], ['C1', 'P', 1, 'A B'], ['C2', 'P', 2, 'B'], ['C3', 'C1', 2, 'B']], legend: ['1st fork()', '2nd fork()'],
              why: 'Two processes print A. Then both fork, making four, and all four print B: 2 + 4 = <b>6</b> lines. The second-generation children start after the first printf, so they never print A.',
              note: 'On a terminal: 6. Sent to a <b>file or pipe</b>, output is buffered inside the process, so the second fork copies the unwritten “A”: <b>8</b> lines. <code>fflush(stdout)</code> before <code>fork()</code> keeps it at 6.' },
            { label: 'if (fork()==0)', code: [['if (fork() == 0)', 'fork; was the result 0?'], ['    fork();', 'only if the result was 0'], ['printf("X\\n");', 'print one line']],
              nodes: [['P', null, 0, 'X'], ['C1', 'P', 1, 'X'], ['C2', 'C1', 2, 'X']], legend: ['fork() in the if', 'inner fork()'],
              why: 'In the parent, fork returns the child’s ID (not 0), so the parent skips the inner fork. In the child it returns 0, so the child forks once more. Parent, child and grandchild print: <b>3</b> lines.' },
            { label: 'Loop ×3', code: [['for (i = 0; i < 3; i++)', 'repeat three times'], ['    fork();', 'ask for a child'], ['printf("hi\\n");', 'print one line']],
              nodes: [['P', null, 0, 'hi'], ['C1', 'P', 1, 'hi'], ['C2', 'P', 2, 'hi'], ['C3', 'P', 3, 'hi'], ['C4', 'C1', 2, 'hi'], ['C5', 'C1', 3, 'hi'], ['C6', 'C2', 3, 'hi'], ['C7', 'C4', 3, 'hi']], legend: ['pass i = 0', 'pass i = 1', 'pass i = 2'],
              why: 'A child starts inside the loop with its parent’s value of <code>i</code>, so it joins the remaining passes. Every pass doubles the crowd: 1 → 2 → 4 → 8, so <b>8</b> lines.' },
          ];
          const ECOL = ['', 'var(--cpu)', 'var(--proc)', 'var(--io)'];
          let pz = 0, guess = null;
          const codeHost = h('div');
          const nbtns = ctx.util.range(8).map((i) => h('button', { class: 'btn sm s36-n', type: 'button', onclick: () => predict(i + 1) }, String(i + 1)));
          const verdict = h('div', { class: 'player-cap s36-cap' });
          const svg = s('svg', { viewBox: '0 0 600 300', width: '100%', role: 'img', 'aria-label': 'Process family tree' });
          const outRow = h('div', { class: 's36-term mono' });
          const legend = h('div', { class: 'row gap-s' });
          const total = (p) => p.nodes.reduce((n, x) => n + x[3].split(' ').length, 0);
          const box = (x, y, w, hh, cls, l1, l2) => [s('rect', { x: x - w / 2, y, width: w, height: hh, rx: 8, class: cls, 'stroke-width': 2 }),
            s('text', { x, y: l2 ? y + 16 : y + 21, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, l1),
            l2 ? s('text', { x, y: y + 31, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, l2) : null].filter(Boolean);
          function drawTree(show) {
            const p = PUZ[pz], kids = [];
            // the ancestors every process shares
            [[80, 'PID 0 · swapper', 's-os'], [250, 'PID 1 · init', 's-os'], [420, 'your shell', 's-proc']].forEach(([x, t, c], i) => {
              kids.push(...box(x, 6, 144, 32, c, t));
              if (i < 2) kids.push(s('line', { x1: x + 74, y1: 22, x2: x + 94, y2: 22, class: 's-line', 'marker-end': 'url(#arr)' }));
            });
            kids.push(s('text', { x: 80, y: 54, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'built at boot'),
              s('text', { x: 250, y: 54, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'ancestor of all'),
              s('path', { d: 'M420,38 C 420,56 320,50 304,66', class: 's-line', 'marker-end': 'url(#arr)' }));
            // lay out the program's own tree: leaves left to right, parents centred over children
            const N = p.nodes.map(([id, par, fk, pr]) => ({ id, par, fk, pr, kids: [] }));
            const by = Object.fromEntries(N.map((n) => [n.id, n]));
            N.forEach((n) => n.par && by[n.par].kids.push(n));
            let slot = 0;
            const place = (n, d) => { n.d = d; if (!n.kids.length) n.x = slot++; else { n.kids.forEach((k) => place(k, d + 1)); n.x = (n.kids[0].x + n.kids[n.kids.length - 1].x) / 2; } };
            place(N[0], 0);
            const X = (n) => 300 + (n.x - (slot - 1) / 2) * 118, Y = (n) => 70 + n.d * 57;
            if (!show) {
              kids.push(...box(300, 70, 104, 40, 's-accent', 'P', 'your program'),
                s('rect', { x: 230, y: 140, width: 140, height: 60, rx: 10, class: 's-muted', 'stroke-dasharray': '6 4' }),
                s('text', { x: 300, y: 175, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: 's-sub' }, '? predict first'));
            } else {
              N.forEach((n) => n.kids.forEach((k) => kids.push(s('line', { x1: X(n), y1: Y(n) + 40, x2: X(k), y2: Y(k), style: `stroke:${ECOL[k.fk]};stroke-width:2.5` }))));
              N.forEach((n) => kids.push(...box(X(n), Y(n), 104, 40, n.id === 'P' ? 's-accent' : 's-proc', n.id, 'prints ' + n.pr)));
            }
            svg.replaceChildren(...kids);
            legend.innerHTML = show ? '<span class="xs muted b">EDGE COLOUR = WHICH CALL MADE THE CHILD:</span>' + p.legend.map((t, i) => `<span class="chip ${['cpu', 'proc', 'io'][i]}">${t}</span>`).join('') : '';
            const lines = [];
            p.code.forEach(([c]) => { const m = c.match(/printf\("(\w+)/); if (m) p.nodes.forEach((n) => { if (n[3].split(' ').includes(m[1])) lines.push(m[1]); }); });
            outRow.innerHTML = '<span class="xs muted b">TERMINAL</span> ' + (show ? lines.map((l) => `<span class="s36-out">${l}</span>`).join('') + `<span class="xs muted">${lines.length} lines · the order may vary between runs; on a terminal the count does not</span>` : '<span class="muted">(run hidden until you predict)</span>');
            // a puzzle whose count depends on buffering swaps the common-mistake callout for its note once revealed
            const withNote = show && !!p.note;
            mistake.style.display = withNote ? 'none' : '';
            noteBox.style.display = withNote ? '' : 'none';
            if (withNote) noteBox.innerHTML = p.note;
          }
          function load(i) {
            pz = i; guess = null;
            const pad = Math.max(...PUZ[i].code.map(([c]) => c.length)) + 2;
            codeHost.replaceChildren(ctx.ui.code(PUZ[i].code.map(([c, m]) => c.padEnd(pad) + '// ' + m).join('\n'), { lang: 'c', fontSize: 14 }));
            nbtns.forEach((b) => b.classList.remove('on', 'ok', 'bad'));
            verdict.innerHTML = 'Count every line printed by <b>every</b> process. The output goes to a <b>terminal</b>, so each line appears as soon as it is printed. Commit to a number, then check.';
            drawTree(false);
          }
          function predict(n) {
            guess = n;
            const ans = total(PUZ[pz]);
            nbtns.forEach((b, i) => { b.classList.toggle('on', i + 1 === n); b.classList.toggle('s36-right', i + 1 === ans); });
            verdict.innerHTML = (n === ans ? '<span class="s36-ok">✓ Correct: ' + ans + ' lines.</span> ' : `<span class="s36-bad">✗ You said ${n}; it prints ${ans}.</span> `) + PUZ[pz].why;
            drawTree(true);
          }
          const mistake = h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Thinking only the original process runs the lines after <code>fork()</code>. Parent and child <b>both</b> continue from the same spot, so every later line runs in both, including any later forks.' });
          const noteBox = h('div', { class: 'callout why small m0', 'data-label': 'Why the count can change', style: { display: 'none' } });
          const pick = ctx.ui.seg(PUZ.map((p, i) => ({ value: i, label: p.label })), 0, load);
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              pick, codeHost,
              h('div', { class: 'stack gap-s' }, h('b', {}, 'How many lines will it print in total?'), h('div', { class: 'row gap-s' }, ...nbtns)),
              verdict,
              h('div', { class: 'callout os small m0', 'data-label': 'Where every tree starts', html: 'fork() can only copy an existing process, so at boot the kernel builds <span class="t">process 0</span> (the swapper) by hand. Process 0 creates <span class="t">process 1</span>, <b>init</b>, the ancestor of every other process. init starts a process for each user who logs in, which becomes that user’s shell.' })),
            h('div', { class: 'stack gap-s' },
              h('div', { class: 'card white tight' }, svg), legend, outRow, mistake, noteBox)));
          load(0);
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: eight ideas about UNIX processes',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'lead m0' }, 'Say each answer out loud, then flip the card to check yourself.'),
            ctx.ui.flipcards([
              ['Where does the kernel run?', 'Mostly <b>inside user processes</b>: a system call or interrupt switches the same process into kernel mode.'],
              ['System vs user processes', 'System processes run <b>only in kernel mode</b> (housekeeping such as swapping). User processes run programs in user mode and enter kernel mode on system calls, exceptions and interrupts.'],
              ['The nine states', 'User Running · Kernel Running · Ready to Run, in Memory · Preempted · Asleep in Memory · Ready to Run, Swapped · Sleeping, Swapped · Created · Zombie.'],
              ['Why a Preempted state?', 'It works like Ready in Memory, but shows that the <b>nonpreemptible</b> kernel forces a switch only as a process returns to user mode (sleeping in the kernel is voluntary). That rules out real-time use.'],
              ['Process 0 and process 1', 'The kernel builds <b>process 0</b> (the swapper) at boot. It creates <b>process 1</b> (init), the ancestor of every other process.'],
              ['Three kinds of context', '<b>User-level</b>: text, data, user stack, shared memory. <b>Register</b>: PC, status register, SP, general registers. <b>System-level</b>: process table entry, U area, region table, kernel stack.'],
              ['Process table entry vs U area', 'Process table entry: <b>always reachable</b> (state, IDs, priority, signals, event). U area: needed <b>only while running</b> (open files, system-call data).'],
              ['fork() in six steps', 'Slot, unique PID, copy the image (not shared memory), bump file counters, Ready to Run, return the child’s PID to the parent and 0 to the child. Then run the parent, the child or another process.'],
            ].map(([f, b]) => [f, `<div>${b}</div>`]), { cols: 4, height: 184 }),
            h('div', { class: 'callout why m0', 'data-label': 'The one-sentence version', html: 'A UNIX process is a user program that borrows kernel mode whenever it needs the OS, moves through nine states that refine the seven-state model, carries three layers of context, and is born when <code>fork()</code> clones its parent.' })));
        },
      },

      /* ---------------- 9. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'In UNIX SVR4, what happens when a user process makes a system call?',
            choices: ['The same process switches into kernel mode and executes the kernel’s code itself', 'The request is passed to a separate kernel process, which runs it and replies', 'The process is swapped out to disk until the kernel has finished', 'The swapper (process 0) executes the call on the process’s behalf'],
            answer: 0,
            feedback: [null, 'SVR4 does not use a separate “OS process” for services; the kernel code runs inside the calling process.', 'A system call needs no swapping. The process simply changes mode and keeps running, now in the kernel.', 'The swapper only moves process images between memory and disk; it does not run other processes’ system calls.'],
            why: 'SVR4 runs most of the OS within the environment of the user process: a system call is just a switch to kernel mode inside the same process, with no process switch needed.' },
          { type: 'tf', q: 'A UNIX system process runs in user mode most of the time and switches into kernel mode only for system calls.', answer: false,
            why: 'That describes a user process. A system process runs only in kernel mode and executes OS code for housekeeping, such as memory allocation and swapping.' },
          { type: 'match', q: 'Match each UNIX process state to its meaning.',
            pairs: [['Asleep in Memory', 'Waiting for an event; image in main memory'], ['Sleeping, Swapped', 'Waiting for an event; image on disk'], ['Ready to Run, Swapped', 'Could run, but must be swapped in first'], ['Created', 'Just made by fork(); not yet ready to run'], ['Zombie', 'Finished; leaves a record for its parent'], ['Preempted', 'Was returning to user mode when the kernel switched away']],
            why: 'Two questions sort most states: can it run (ready or waiting for an event)? And where is its image (main memory or disk)? Created, Zombie and Preempted mark birth, death and the preemption point.' },
          { q: 'Why does UNIX show Preempted as a state separate from Ready to Run, in Memory?',
            choices: ['To stress that preemption happens only when a process is about to return from kernel mode to user mode', 'Because a preempted process is kept on disk until it runs again', 'Because a preempted process jumps ahead of every other ready process', 'Because a preempted process must restart its system call from the beginning'],
            answer: 0,
            feedback: [null, 'A preempted process stays in main memory; being on disk is what the Swapped states describe.', 'Nothing in the model gives it priority; it waits like any ready process.', 'Its kernel work was already finished, which is exactly why it returns straight to User Running.'],
            why: 'The two states are essentially the same kind of waiting. Keeping Preempted separate shows that the traditional kernel is nonpreemptible: it never forces a process off the processor in the middle of kernel code, only at the return to user mode (a process may still give it up voluntarily by sleeping in the kernel). That also makes it unsuitable for real-time work.' },
          { type: 'multi', q: 'Which of these correctly map a UNIX state onto the seven-state model?',
            choices: ['User Running and Kernel Running → Running', 'Preempted → Blocked', 'Sleeping, Swapped → Blocked/Suspend', 'Created → New', 'Zombie → Ready/Suspend'],
            answer: [0, 2, 3],
            why: 'Running splits by mode into User Running and Kernel Running. Preempted is a kind of Ready (not Blocked), and Zombie corresponds to Exit.' },
          { type: 'bucket', q: 'Where does the kernel keep each field: in the process table entry or in the U area?',
            buckets: ['Process table entry', 'U area'],
            items: [['Event descriptor', 0], ['Signal (sent but not yet handled)', 0], ['Memory status', 0], ['Signal-handler array', 1], ['User file descriptor table', 1]],
            why: 'The process table entry holds what the kernel needs even when the process is not running (to schedule, wake or swap it). The U area holds what is needed only while the process runs its own system calls.' },
          { type: 'bucket', q: 'Which part of the UNIX process image does each item belong to?',
            buckets: ['User-level', 'Register', 'System-level'],
            items: [['Process text', 0], ['Program counter', 1], ['Processor status register', 1], ['Kernel stack', 2], ['Per-process region table', 2]],
            why: 'User-level context is what the program itself sees, register context is the processor’s registers for this process, and system-level context is the kernel’s private bookkeeping about it.' },
          { type: 'order', q: 'Put the kernel’s work during fork() in order.',
            items: ['Allocate a slot in the process table', 'Assign a unique process ID to the child', 'Copy the parent’s process image, except shared memory', 'Increment the counters of files the parent has open', 'Put the child in the Ready to Run state', 'Return the child’s ID to the parent and 0 to the child'],
            why: 'The kernel first reserves a slot and an ID, then builds the child as a copy of the parent (sharing, not copying, shared memory), accounts for the inherited open files, makes the child ready, and finally returns two different values.' },
          { type: 'num', q: 'How many lines does this program print in total?',
            code: 'if (fork() == 0)   // fork; did it return 0?\n    fork();        // runs only where it returned 0\nprintf("X\\n");     // print one line', answer: 3, tol: 0, unit: 'lines',
            why: 'fork() returns the new child’s ID (never 0) in the parent and 0 in the child. So the parent skips the inner fork, while the child runs it and makes a grandchild. Parent, child and grandchild each print X once: 3 lines.' },
          { type: 'multi', q: 'A UNIX kernel has just completed all of its work for a <code>fork()</code> call. Which of these may it do next?',
            choices: ['Return to the parent in user mode, at the point of the fork call', 'Switch to the child, which starts executing at the return from fork()', 'Switch to some other process, leaving both parent and child Ready to Run', 'Start the child at the first line of its program’s main function', 'Hold the child in the Created state until the parent calls wait()'],
            answer: [0, 1, 2],
            why: 'The kernel may stay in the parent, switch to the child, or run another process. The child never starts from the top of its program: it resumes at the return from fork(), and it is already Ready to Run, not Created.' },
          { type: 'num', q: 'How many lines (counting both A and B) does this program print in total? Assume the output goes to a terminal, so each <code>printf</code> that ends in <code>\\n</code> is written out at once.',
            code: 'fork();          // ask for a child\nprintf("A\\n");   // print A\nfork();          // ask for another child\nprintf("B\\n");   // print B', answer: 6, tol: 0, unit: 'lines',
            why: 'Every process alive runs each later fork, so each fork doubles the count. Two processes exist when A is printed (2 lines). Both then fork, making 4 processes, and all 4 print B (4 lines): 2 + 4 = 6. <b>Why the count can change:</b> sent to a file or pipe, the output is buffered inside each process, the second fork copies the unwritten “A”, and 8 lines appear; <code>fflush(stdout)</code> before <code>fork()</code> prevents that.' },
          { q: 'Which process does the kernel build by hand when the system boots, rather than creating it with fork()?',
            choices: ['Process 0, the swapper', 'Process 1, init', 'The first login shell', 'The first program a user runs'],
            answer: 0,
            feedback: [null, 'init is process 1: it is created by process 0, and it is the ancestor of every other process.', 'Login shells are started (indirectly) by init, long after boot.', 'User programs are always created by fork() from an existing process.'],
            why: 'Process 0 (the swapper) is hand-made at boot. It creates process 1 (init), from which every other process descends; init starts a process for each user who logs in.' },
        ],
      },
    ],

    notes: `
      <h3>1. Where the kernel runs in UNIX SVR4</h3>
      <p>In SVR4 <b>most of the OS executes inside the environment of a user process</b>. On a system call, exception or interrupt the <b>same process</b> switches to kernel mode and runs kernel code on its own kernel stack: a cheap mode switch, not a process switch. Interrupts are handled inside whichever process is running.</p>
      <ul>
        <li><b>System processes</b> run <b>only in kernel mode</b>, executing OS housekeeping code such as memory allocation and swapping (e.g. process 0, the swapper).</li>
        <li><b>User processes</b> run programs and utilities in <b>user mode</b>, and switch to <b>kernel mode</b> to execute kernel instructions on a system call, exception or interrupt.</li>
      </ul>

      <h3>2. The nine UNIX process states</h3>
      <table>
        <tr><th>UNIX state</th><th>Meaning</th><th>Seven-state</th></tr>
        <tr><td>User Running</td><td>Executing its own program in user mode.</td><td rowspan="2">Running</td></tr>
        <tr><td>Kernel Running</td><td>The same process executing kernel code in kernel mode.</td></tr>
        <tr><td>Ready to Run, in Memory</td><td>Ready to run as soon as the kernel schedules it.</td><td rowspan="2">Ready</td></tr>
        <tr><td>Preempted</td><td>Was returning from kernel mode to user mode, but the kernel preempted it and switched to another process.</td></tr>
        <tr><td>Asleep in Memory</td><td>Cannot run until an event occurs; image in main memory.</td><td>Blocked</td></tr>
        <tr><td>Ready to Run, Swapped</td><td>Ready, but the swapper must bring it into main memory first.</td><td>Ready/Suspend</td></tr>
        <tr><td>Sleeping, Swapped</td><td>Waiting for an event and swapped out to disk.</td><td>Blocked/Suspend</td></tr>
        <tr><td>Created</td><td>Newly created, not yet ready to run.</td><td>New</td></tr>
        <tr><td>Zombie</td><td>No longer exists, but leaves a record (exit status, usage times) for its parent to collect.</td><td>Exit</td></tr>
      </table>
      <p>Running is split by mode; Ready is split into Ready to Run, in Memory and Preempted (below, “Ready in Memory” and “Ready, Swapped” are short for the two Ready to Run states). Those two are essentially the same state (one queue for the scheduler), but Preempted is kept apart to stress that preemption happens <b>only as a process is about to return from kernel mode to user mode</b>. The traditional kernel is <b>nonpreemptible</b>: it never <b>forces</b> a process off the processor in the middle of kernel code (involuntary preemption waits until the process is about to return to user mode), which makes it unsuitable for real-time work. This does not mean no switch can happen in kernel mode: a process that <b>sleeps</b> inside the kernel to wait for an event gives up the processor <b>voluntarily</b>, and the kernel switches to another process right there.</p>

      <h3>3. Transitions and a typical life</h3>
      <ul>
        <li><b>fork</b> → Created; <b>enough memory</b> → Ready in Memory; <b>not enough memory</b> (swapping systems) → Ready, Swapped.</li>
        <li><b>reschedule</b>: Ready in Memory → Kernel Running. <b>return to user</b>: Kernel Running → User Running. <b>system call / interrupt</b>: User Running → Kernel Running; an interrupt in the kernel returns to Kernel Running.</li>
        <li><b>sleep</b>: Kernel Running → Asleep in Memory. <b>wakeup</b>: Asleep in Memory → Ready in Memory; Sleeping, Swapped → Ready, Swapped.</li>
        <li><b>swap out</b>: Asleep → Sleeping, Swapped; Ready in Memory → Ready, Swapped. <b>swap in</b>: Ready, Swapped → Ready in Memory.</li>
        <li><b>preempt</b>: Kernel Running → Preempted; <b>return to user</b>: Preempted → User Running. <b>exit</b>: Kernel Running → Zombie.</li>
      </ul>
      <p>A process is always switched out, and always resumes, inside the kernel (Kernel Running).</p>

      <h3>4. Process 0 and process 1</h3>
      <p><b>Process 0</b>, the <b>swapper</b>, is built by the kernel at boot. It spawns <b>process 1</b>, <b>init</b>, the ancestor of every other process. init creates a user process for each interactive user who logs in (the user’s shell). Every process except process 0 is created by <code>fork()</code>, which needs an existing process to copy.</p>
      <h3>5. The process image: three kinds of context</h3>
      <ul>
        <li><b>User-level context</b>: process text (executable machine instructions), process data, user stack (arguments, locals, return addresses in user mode), shared memory (one physical copy, mapped by every sharer).</li>
        <li><b>Register context</b>: program counter, processor status register (hardware status, including mode), stack pointer (user or kernel stack), general-purpose registers. Copied to memory when the process enters the kernel or is switched out.</li>
        <li><b>System-level context</b>: process table entry (always accessible to the kernel), U area (needed only while the process runs), per-process region table (virtual-to-physical mapping plus permission field: read-only, read-write, read-execute), kernel stack (frames of kernel functions called in kernel mode).</li>
      </ul>

      <h3>6. Process table entry versus U area</h3>
      <p><b>Process table entry</b>: process status; pointers to the U area and memory; process size; user IDs (real, effective); process IDs (own, parent); event descriptor (event a sleeper awaits); priority; signal (sent, not yet handled); timers (execution time, resource use, alarm); <b>P_link</b> (next in the ready queue); memory status (in memory or swapped; locked).</p>
      <p><b>U area</b>: process table pointer; user IDs; timers (user- and kernel-mode time of the process and its children); signal-handler array (exit, ignore or run a function); control terminal; error field; return value (of a system call); I/O parameters; file parameters (current directory and root); user file descriptor table (open files); limit fields; permission modes fields.</p>
      <p>User IDs and timers appear in both. <b>Rule of thumb:</b> needed even when the process is not running (to schedule, wake, signal or swap it)? Process table entry, which always stays in memory. Needed only while it runs its own system calls? U area, which can be swapped out.</p>

      <h3>7. Process creation with fork()</h3>
      <p>A process is created by the system call <code>pid = fork();</code>. In kernel mode, inside the parent, the kernel:</p>
      <ol>
        <li>allocates a slot in the process table for the new process;</li>
        <li>assigns a unique process ID to the child;</li>
        <li>copies the parent’s process image, except any shared memory (shared, not copied);</li>
        <li>increments the counters of files the parent has open (the child owns them too);</li>
        <li>assigns the child to the Ready to Run state;</li>
        <li>returns the ID of the child to the parent, and 0 to the child.</li>
      </ol>
      <p>Then the kernel chooses one of three options: <b>stay in the parent</b> (it returns to user mode at the point of the fork call); <b>switch to the child</b> (it starts at the return from <code>fork()</code>, not at the top of its program); or <b>switch to another process</b> (parent and child both stay Ready to Run). The choice changes the order of output, never the amount (with output to a terminal; see section 8). The return value tells them apart (0 = child; the child’s ID = parent; −1 = failure). Typically the child calls <code>exec</code> to load a new program (same PID), and the parent’s <code>wait()</code> sleeps until the child exits, then collects its zombie record. Real kernels defer copying (copy-on-write) with the same visible effect.</p>
      <pre>pid = fork();                         /* clone the caller */
if (pid == 0) execlp("ls","ls",NULL); /* child: become ls  */
else wait(NULL);                      /* parent: wait      */</pre>

      <h3>8. Counting processes and printed lines</h3>
      <p>After a fork <b>both</b> processes run every later line, including later forks, so n forks in a row give 2ⁿ processes (three forks, then printf: 8 lines). <code>fork(); printf("A\\n"); fork(); printf("B\\n");</code> prints 2 A + 4 B = 6 lines. <code>if (fork() == 0) fork(); printf("X\\n");</code> prints 3 lines (parent, child, grandchild). Line order may vary between runs; with output to a terminal, the count cannot.</p>
      <h4>Why the count can change: output buffering</h4>
      <p>These counts assume the output goes to a <b>terminal</b>. There the C library writes each line as soon as <code>printf</code> prints its <code>\\n</code> (line buffering). If the output is <b>redirected to a file or a pipe</b>, the library switches to full buffering: printed text waits in a buffer in the process’s own memory until the buffer fills or the process exits. Because <code>fork()</code> copies that memory, it also copies any text still waiting. In the A/B program each of the two processes still holds an unwritten “A\\n” at the second fork, so all four processes end up writing A and B: 4 A + 4 B = <b>8</b> lines. Calling <code>fflush(stdout)</code> just before <code>fork()</code> empties the buffer first and restores the count of 6. (For the same reason, a buffered line printed just before <code>exec</code> can vanish: exec replaces the memory that held it.)</p>`,
  });
})();
