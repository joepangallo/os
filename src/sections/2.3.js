/* =====================================================================
   Section 2.3 — Major Achievements
   The four big ideas every modern OS is built on: the process, memory
   management, information protection and security, and scheduling and
   resource management. Original teaching material, built step by step
   (see AUTHORING.txt). Shared helpers live in the IIFE so nothing leaks
   into the global scope.
   ===================================================================== */
(() => {
  /* ------------------------------------------------------------------
     Shared helpers
     ------------------------------------------------------------------ */
  const PAGE = 1024;                 // bytes per page in the paging lab (1 KB)

  /* tiny SVG builders (Guide.s is the shell's SVG element factory) */
  const S = (tag, props, ...kids) => Guide.s(tag, props, ...kids);
  const R = (x, y, w, hh, cls, o) => S('rect', Object.assign({ x, y, width: w, height: hh, rx: 10, class: cls, 'stroke-width': 2 }, o || {}));
  const T = (x, y, str, o = {}) => S('text', { x, y, 'text-anchor': o.a || 'middle', 'font-size': o.fs || 15, 'font-weight': o.fw || 600, class: o.cls || null, style: o.st || null }, str);
  const stroke = (col, o) => ({ class: 's-line', style: col ? `stroke:var(--${col})` : null, 'stroke-width': o.w || 2.5, 'stroke-dasharray': o.dash || null, 'marker-end': o.head === false ? null : `url(#arr${col ? '-' + col : ''})` });
  const LN = (x1, y1, x2, y2, col, o = {}) => S('line', Object.assign({ x1, y1, x2, y2 }, stroke(col, o)));
  const PA = (d, col, o = {}) => S('path', Object.assign({ d }, stroke(col, o)));
  const OK = 'fill:var(--ok)', BAD = 'fill:var(--bad)';
  /* phones: keep dense diagrams readable by giving them a minimum width inside a sideways scroller */
  const fitWide = (ctx, svg, minW) => {
    if (!ctx.narrow) return svg;
    svg.style.minWidth = minW + 'px';
    return Guide.h('div', {}, Guide.h('div', { class: 'hscroll' }, svg), Guide.h('div', { class: 'xs muted' }, '↔ swipe sideways to see the whole diagram'));
  };

  /* ------------------------------------------------------------------
     Step 1 hub: four mini-demos. draw(withIt, frame) → [svgNodes, caption]
     Every demo has 4 frames and the same story in both modes, so the
     student can flip "Without it / With it" and compare the endings.
     ------------------------------------------------------------------ */
  const HUB = [
    { name: 'The process', col: 'proc', where: 'Steps 2–4',
      solves: 'Programs share one processor without losing their place.',
      draw(w, i) {
        const run = i === 1 ? 'Compiler' : 'Editor';
        const pc = i === 0 ? '42' : i === 1 ? '4' : w ? '42' : '4';
        const bad = !w && i >= 2;
        const saved = { Editor: w && i >= 1 ? 'PC 42 · R1 7' : null, Compiler: w && i >= 2 ? 'PC 4 · R1 3' : null };
        const prog = (name, y) => {
          const on = name === run;
          return [R(300, y, 284, 96, 's-proc', { 'stroke-width': on ? 3.5 : 1.5 }),
            T(318, y + 40, name, { a: 'start', fs: 17, fw: 800 }),
            T(318, y + 66, on ? (bad ? 'running ✗' : 'running') : 'paused', { a: 'start', fs: 14, cls: on ? null : 's-sub', st: on && bad ? BAD : null }),
            R(438, y + 12, 134, 72, 's-panel', { rx: 8, 'stroke-dasharray': w ? null : '5 4' }),
            T(505, y + 34, w ? 'saved context' : 'no saved context', { fs: 12.5, cls: 's-sub' }),
            T(505, y + 62, saved[name] || (w ? '(empty)' : '—'), { fs: 14, fw: 700, cls: 's-monot' })];
        };
        const n = [R(16, 40, 190, 150, 's-cpu'), T(111, 72, 'Processor', { fs: 17, fw: 800 }),
          T(111, 102, 'running:', { fs: 13.5, cls: 's-sub' }), T(111, 124, run, { fs: 16, fw: 750 }),
          T(111, 166, 'PC = ' + pc, { fs: 22, fw: 800, cls: 's-monot', st: bad ? BAD : 'fill:var(--cpu)' }),
          ...prog('Editor', 12), ...prog('Compiler', 122), LN(206, 115, 294, run === 'Editor' ? 62 : 170, 'cpu')];
        if (i === 1 || i === 2) n.push(T(111, 28, 'timer interrupt', { fs: 14, fw: 800, st: 'fill:var(--intr)' }));
        if (i === 3) n.push(T(111, 222, w ? '✓ resumes correctly' : '✗ resumes in the wrong place', { fs: 14.5, fw: 800, st: w ? OK : BAD }));
        const cap = [
          'The <b>Editor</b> is running. The processor\'s program counter (PC) says its next instruction is line 42, and register R1 holds 7.',
          w ? 'A timer interrupt arrives. The OS first copies the Editor\'s <b>context</b> (PC 42, register R1 = 7) into the Editor\'s own record. Then the Compiler starts at its line 1 and runs lines 1 to 3, so the PC now reads 4 and R1 holds 3.'
            : 'A timer interrupt arrives and the Compiler starts at its line 1. Nobody writes down where the Editor stopped. The Compiler runs lines 1 to 3, so the PC now reads 4 and R1 holds 3.',
          w ? 'Another interrupt: time to switch back. The OS saves the Compiler\'s context (PC 4, R1 = 3) as well, then reloads the Editor\'s saved values, so the PC is 42 again.'
            : 'Time to switch back to the Editor. The only values left in the processor are the Compiler\'s: PC 4, R1 = 3.',
          w ? '<b>✓ The Editor carries on at line 42</b> with R1 = 7 again, as if it had never been paused. Giving every running program a record like this is the heart of the process idea.'
            : '<b>✗ The Editor jumps to line 4</b> of its own code, holding the Compiler\'s R1 value, and produces garbage or crashes. Hand-written switching code in early systems was full of bugs like this.'][i];
        return [n, cap];
      } },
    { name: 'Memory management', col: 'mem', where: 'Steps 5–6',
      solves: 'Every program gets its own memory, safe from the others.',
      draw(w, i) {
        const X = (a) => 20 + a * 0.112;
        const n = [T(20, 34, 'Main memory', { a: 'start', fw: 800 }),
          R(X(0), 60, X(1000) - X(0), 70, 's-os', { rx: 6 }), T(X(500), 101, 'OS', { fw: 800 }),
          R(X(1000), 60, X(3000) - X(1000), 70, 's-proc', { rx: 6, 'stroke-width': i >= 1 ? 3 : 2 }),
          T(X(2000), 91, 'Program A', { fw: 800 }), T(X(2000), 113, 'has a bug', { fs: 13, cls: 's-sub' }),
          R(X(3000), 60, X(5000) - X(3000), 70, 's-proc', { rx: 6 }), T(X(4350), 101, 'Program B', { fw: 800 }),
          R(X(3380), 78, 36, 34, !w && i >= 2 ? 's-bad' : 's-mem', { rx: 5 }), T(X(3380) + 18, 100, 'data', { fs: 12.5, fw: 700 })];
        [0, 1000, 3000, 5000].forEach((a) => n.push(LN(X(a), 132, X(a), 142, '', { head: false, w: 1.5 }),
          T(X(a), 158, String(a), { fs: 12.5, cls: 's-sub', a: a === 0 ? 'start' : a === 5000 ? 'end' : 'middle' })));
        if (i >= 1) {
          const stop = w && i >= 2;
          n.push(PA(stop ? `M${X(2000)},58 C 270,18 330,18 ${X(3000) - 6},62` : `M${X(2000)},58 C 280,10 390,10 ${X(3530)},76`, 'intr', { dash: '6 4' }),
            T(318, 20, 'store to address 3500', { fs: 13.5, fw: 700, st: 'fill:var(--intr)' }));
        }
        if (i >= 2 && w) n.push(LN(X(3000), 48, X(3000), 142, 'bad', { head: false, w: 5 }),
          T(300, 192, 'Hardware check: 3500 is outside A\'s region (1000–2999) → blocked', { fs: 13.5, fw: 700, st: BAD }));
        if (i >= 2 && !w) n.push(T(300, 192, 'No check: the store lands in B\'s data', { fs: 13.5, fw: 700, st: BAD }));
        if (i === 3) n.push(T(300, 218, w ? '✓ The OS stops A; B is untouched' : '✗ B crashes later, though B has no bug', { fs: 15, fw: 800, st: w ? OK : BAD }));
        const cap = [
          'Programs A and B share main memory. A owns addresses 1000–2999 and B owns 3000–4999. Program A has a bug.',
          'The bug makes A compute a wrong address, 3500, and try to store a value there. That address belongs to B.',
          w ? 'The hardware checks every address A uses against A\'s own region. 3500 is outside it, so the store is <b>blocked</b> and the OS is interrupted.'
            : 'Nothing checks the address, so the store goes through and <b>overwrites B\'s data</b>.',
          w ? '<b>✓ The OS stops only A</b> and reports the error. B never notices. Keeping programs out of each other\'s memory is the first job of memory management.'
            : '<b>✗ B later reads its own data and crashes</b>, even though B has no bug. Tracking down the real culprit is a nightmare.'][i];
        return [n, cap];
      } },
    { name: 'Protection and security', col: 'os', where: 'Step 7',
      solves: 'Users and programs reach only what they are allowed to.',
      draw(w, i) {
        const benBad = !w && i === 3;
        const n = [R(16, 22, 130, 70, 's-panel'), T(81, 52, 'Ana', { fs: 16, fw: 800 }), T(81, 74, 'owns payroll', { fs: 13, cls: 's-sub' }),
          R(16, 140, 130, 70, benBad ? 's-bad' : 's-panel', { 'stroke-width': i >= 1 ? 3 : 2 }), T(81, 170, 'Ben', { fs: 16, fw: 800 }),
          T(81, 192, benBad ? 'sees salaries ✗' : 'no permission', { fs: 13, cls: benBad ? null : 's-sub', st: benBad ? BAD : null }),
          R(226, 56, 170, 118, 's-os'), T(311, 86, 'Operating system', { fw: 800 }),
          T(311, 112, w ? 'checks access' : 'no access checks', { fs: 13.5, cls: 's-sub' }),
          R(470, 70, 114, 90, 's-io'), T(527, 108, 'payroll', { fs: 16, fw: 800, cls: 's-monot' }), T(527, 132, 'salaries', { fs: 13, cls: 's-sub' })];
        if (i >= 1) n.push(LN(146, 164, 222, 138, 'proc'), T(188, 180, 'read payroll', { fs: 12.5, fw: 700, st: 'fill:var(--proc)' }));
        if (i >= 2 && w) n.push(T(311, 146, 'allowed: Ana only', { fs: 13.5, fw: 700, cls: 's-monot', st: 'fill:var(--os)' }));
        if (i >= 2 && !w) n.push(LN(396, 115, 466, 115, 'io'), T(431, 104, 'opens', { fs: 13, fw: 700 }));
        if (i === 3 && !w) n.push(PA('M500,162 Q 330,236 150,192', 'bad', { dash: '6 4' }));
        if (i === 3 && w) n.push(T(400, 208, '✓ refused and logged', { fs: 15, fw: 800, st: OK }), PA('M236,174 Q 214,216 150,202', 'bad'));
        const cap = [
          'Ana and Ben share one computer. The file <b>payroll</b> belongs to Ana, and Ben has no permission to read it.',
          'Ben\'s program asks the operating system to open payroll for reading.',
          w ? 'The OS looks up who may read payroll. Only Ana is on the list.' : 'This OS has no access checks, so it simply opens the file for Ben.',
          w ? '<b>✓ The request is refused and recorded.</b> Ana\'s data stays private. Controlling who may use what, and proving who is asking, is protection and security.'
            : '<b>✗ Ben reads every salary.</b> Confidentiality is lost, and nothing even records that it happened.'][i];
        return [n, cap];
      } },
    { name: 'Scheduling and resource management', col: 'cpu', where: 'Step 8',
      solves: 'Decides who runs next, and for how long.',
      draw(w, i) {
        const X = (t) => 130 + t * 40;
        const bar = (t0, t1, y, cls) => R(X(t0), y, Math.max(4, X(t1) - X(t0)), 36, cls, { rx: 5 });
        const n = [T(120, 57, 'Report job', { a: 'end', fw: 750 }), T(120, 119, 'Editor', { a: 'end', fw: 750 }),
          LN(130, 158, 576, 158, '', { head: false, w: 1.5 }),
          R(398, 4, 14, 14, 's-proc', { rx: 3 }), T(418, 16, 'running', { a: 'start', fs: 12.5, cls: 's-sub' }),
          R(488, 4, 14, 14, 's-warn', { rx: 3 }), T(508, 16, 'waiting', { a: 'start', fs: 12.5, cls: 's-sub' })];
        [0, 2, 4, 6, 8, 10].forEach((t) => n.push(LN(X(t), 154, X(t), 162, '', { head: false, w: 1.5 }), T(X(t), 180, t + ' s', { fs: 12.5, cls: 's-sub' })));
        if (i < 2) n.push(bar(0, 1.2, 34, 's-proc'));
        else if (w) n.push(bar(0, 1.5, 34, 's-proc'), bar(1.6, 10.1, 34, 's-proc'), bar(1.2, 1.5, 96, 's-warn'), bar(1.5, 1.6, 96, 's-proc'));
        else n.push(bar(0, 10, 34, 's-proc'), bar(1.2, 10, 96, 's-warn'), bar(10, 10.1, 96, 's-proc'));
        if (i >= 1) n.push(LN(X(1.2), 90, X(1.2), 140, 'intr', { head: false }), T(X(1.2) + 8, 90, 'key pressed', { a: 'start', fs: 13, fw: 700, st: 'fill:var(--intr)' }));
        if (i >= 2) n.push(w ? T(X(1.6) + 10, 119, 'waits 0.3 s, then runs 0.1 s', { a: 'start', fs: 13, fw: 700 })
          : T(X(5.6), 119, 'waiting 8.8 s', { fs: 13, fw: 700 }));
        if (i === 3) n.push(T(350, 214, w ? '✓ response time 0.4 s' : '✗ response time 8.9 s', { fs: 16, fw: 800, st: w ? OK : BAD }));
        const cap = [
          'A long <b>report job</b> starts. It needs 10 seconds of processor time.',
          'At 1.2 s a user presses a key in an editor. Showing that character needs only 0.1 s of processor time.',
          w ? 'This OS hands out short <b>time slices</b> (0.5 s here) in turn. When the report\'s slice ends at 1.5 s, the editor gets the processor.'
            : 'This OS lets a job keep the processor until it finishes, so the editor waits in line behind the report.',
          w ? '<b>✓ The character appears at 1.6 s</b>, 0.4 s after the key press, and the report still ends at 10.1 s. Deciding who runs next, and for how long, is scheduling.'
            : '<b>✗ The character appears at 10.1 s.</b> The user waited almost 9 seconds for one keystroke, and the report finished only 0.1 s sooner than it would have with time slices.'][i];
        return [n, cap];
      } },
  ];

  Guide.section({
    id: '2.3',
    title: 'Major Achievements',
    short: 'Major achievements',
    summary: 'Four ideas every modern OS rests on: processes, memory management, protection and security, and scheduling.',
    objectives: [
      'Name the four major achievements in OS design and the problem each one solved.',
      'Define a process in four equivalent ways, list its three parts, and explain how the OS uses a process list, base and limit registers to switch between processes safely.',
      'Explain why multiprogramming, time sharing and real-time transaction systems made the process concept necessary, and recognise the four kinds of errors that appear without it.',
      'List the five storage-management responsibilities of an OS and translate a virtual address (page number + offset) into a real address or a page fault.',
      'Classify security problems by the goal they violate (availability, confidentiality, data integrity, authenticity) and describe how the OS uses queues and interrupts to schedule processes fairly and efficiently.',
    ],
    terms: [
      ['Process', 'A program in execution: the program\'s code and data together with everything the OS needs to run it, pause it and later resume it exactly where it stopped.'],
      ['Execution context', 'Everything the OS must remember to stop a process and later restart it as if nothing happened: the processor register values (including the program counter), priority, open files, pending I/O and so on. Also called the process state (here "state" means these saved details).'],
      ['Process list', 'A table the OS keeps with one entry per process. Each entry points to where the process lives in memory and may hold part or all of its saved execution context (the rest can be kept with the process itself).'],
      ['Base register', 'A processor register that holds the starting address of the memory region belonging to the running process. Addresses the process uses are counted from this point.'],
      ['Limit register', 'A processor register that holds the size of the running process\'s memory region. The hardware refuses any address at or beyond this size, so a process cannot reach outside its own region.'],
      ['Mutual exclusion', 'Allowing only one process at a time to use a shared resource or run a piece of code that touches shared data.'],
      ['Deadlock', 'A situation in which two or more processes each hold something the other one needs and wait for it, so none of them can ever continue.'],
      ['Virtual memory', 'A scheme in which each program uses its own logical addresses, as if it had a large private memory, while the OS and hardware map those addresses onto real main memory and onto disk.'],
      ['Paging', 'Dividing every process into equal, fixed-size blocks called pages, and main memory into page-sized slots called page frames (frames). Any page can be loaded into any free frame, or kept on disk until it is needed.'],
      ['Page table', 'The table the OS keeps for each process that says, for every page, which frame of main memory holds it or that it is currently only on disk. The MMU consults it on every memory access.'],
      ['Virtual address', 'An address as a program sees it. With paging it is made of a page number and an offset (the position inside that page).'],
      ['Real address', 'An actual location in main memory, found by combining the frame that holds the page with the offset. Also called a physical address.'],
      ['Memory management unit (MMU)', 'Hardware between the processor and main memory that translates every virtual address into a real address, and interrupts the OS when the page needed is not in main memory.'],
      ['Page fault', 'The interrupt raised when a program uses an address whose page is not in main memory. The OS reads the page in from disk, updates the page table and lets the program retry.'],
      ['File system', 'The part of the OS that keeps information for the long term in named files on secondary storage, so it survives after programs end and the power goes off.'],
      ['Availability (security goal)', 'A security goal: the system and its data stay usable by authorized users whenever they need them, protected against anything that would interrupt service, such as a flood of fake requests.'],
      ['Confidentiality', 'A security goal: only people and programs with permission can read the data.'],
      ['Data integrity', 'A security goal: data cannot be changed, added to or deleted except by those allowed to do so.'],
      ['Authenticity', 'A security goal: the system can check that users really are who they claim to be, and that messages and data really come from where they say.'],
      ['Round-robin', 'A scheduling method that gives each ready process a short turn on the processor in circular order; a process whose turn runs out goes to the back of the line.'],
    ],

    css: `
      /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width */
      .sec-2-3 .step-eyebrow { contain: inline-size; }
      .sec-2-3 .hscroll { overflow-x: auto; contain: inline-size; padding-bottom: 4px; }
      /* step 1 hub tiles (each tile sets --c to its semantic colour) */
      .sec-2-3 .hub-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .sec-2-3 .hub-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left; padding: 10px 12px; border-radius: 12px; border: 2px solid var(--line); border-top: 5px solid var(--c); background: var(--panel); cursor: pointer; color: var(--ink); font: inherit; min-height: 104px; }
      .sec-2-3 .hub-tile:hover { border-color: var(--c); }
      .sec-2-3 .hub-tile.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 12%, var(--panel)); box-shadow: 0 0 0 1px var(--c); }
      .sec-2-3 .hub-tile .n { font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: var(--c); }
      .sec-2-3 .hub-tile b { font-size: 16.5px; line-height: 1.2; }
      .sec-2-3 .hub-tile .sv { font-size: 14px; color: var(--ink-2); line-height: 1.35; }
      .sec-2-3 .demo-card { gap: 8px; }
      .sec-2-3 .demo-card .player-cap { min-height: 4.5em; }
      /* step 2 definition buttons + diagram dimming */
      .sec-2-3 .defbtn { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 10px; align-items: start; text-align: left; padding: 8px 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; font: inherit; font-size: 15.5px; line-height: 1.35; color: var(--ink); }
      .sec-2-3 .defbtn .k { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: var(--proc-bg); color: var(--proc); font-weight: 900; font-size: 14px; }
      .sec-2-3 .defbtn:hover { border-color: var(--proc); }
      .sec-2-3 .defbtn.on { border-color: var(--proc); background: color-mix(in srgb, var(--proc) 11%, var(--panel)); box-shadow: 0 0 0 1px var(--proc); }
      .sec-2-3 svg .g { transition: opacity .25s; }
      .sec-2-3 svg .g.dim { opacity: .2; }
      /* step 3 error gallery */
      .sec-2-3 .dev { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 10px; align-items: start; padding: 8px 12px; }
      .sec-2-3 .dev .k { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-weight: 900; font-size: 14px; background: var(--panel-3); color: var(--ink-2); }
      .sec-2-3 .dev b { display: block; font-size: 15.5px; }
      .sec-2-3 .dev div > span { display: block; font-size: 14px; color: var(--ink-2); line-height: 1.35; }
      .sec-2-3 .opt { text-align: left; display: flex; flex-direction: column; gap: 2px; padding: 8px 11px; border: 2px solid var(--line); border-radius: 11px; background: var(--panel); cursor: pointer; font: inherit; color: var(--ink); }
      .sec-2-3 .opt b { font-size: 15px; }
      .sec-2-3 .opt span { font-size: 13px; color: var(--ink-2); line-height: 1.3; }
      .sec-2-3 .opt:hover:not(:disabled) { border-color: var(--chc); }
      .sec-2-3 .opt:disabled { cursor: default; }
      .sec-2-3 .opt.right { border-color: var(--ok); background: var(--ok-bg); }
      .sec-2-3 .opt.wrong { border-color: var(--bad); background: var(--bad-bg); }
      .sec-2-3 .fb { border-radius: 10px; padding: 8px 12px; font-size: 15px; line-height: 1.45; background: var(--panel-2); border: 1px solid var(--line); }
      .sec-2-3 .fb.ok { background: var(--ok-bg); border-color: color-mix(in srgb, var(--ok) 45%, transparent); }
      .sec-2-3 .fb.bad { background: var(--bad-bg); border-color: color-mix(in srgb, var(--bad) 45%, transparent); }
      .sec-2-3 .scen { font-size: 16px; line-height: 1.45; min-height: 104px; }
      /* step 6 paging lab */
      .sec-2-3 .va-in { font: inherit; font-family: var(--mono); font-size: 17px; width: 116px; height: 36px; border-radius: 10px; border: 2px solid var(--line-2); padding: 0 10px; background: var(--panel); color: var(--ink); }
      .sec-2-3 .brk { font-size: 15px; line-height: 1.5; display: flex; flex-direction: column; gap: 2px; }
      .sec-2-3 .brk .pg { color: var(--cpu); font-weight: 800; }
      .sec-2-3 .brk .of { color: var(--mem); font-weight: 800; }
      .sec-2-3 .brk .res { margin-top: 4px; padding-top: 6px; border-top: 1px dashed var(--line-2); font-weight: 650; }
      /* step 7 security goals board */
      .sec-2-3 .goal { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 10px; align-items: start; padding: 8px 12px; }
      .sec-2-3 .goal .k { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-weight: 900; font-size: 13px; background: var(--os-bg); color: var(--os); }
      .sec-2-3 .goal b { display: block; font-size: 15.5px; }
      .sec-2-3 .goal span.d { display: block; font-size: 14px; color: var(--ink-2); line-height: 1.35; }
      .sec-2-3 .gcol { display: flex; flex-direction: column; gap: 5px; padding: 8px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; color: var(--ink); min-height: 206px; }
      .sec-2-3 .gcol:hover, .sec-2-3 .gcol:focus-visible { border-color: var(--os); outline: none; }
      .sec-2-3 .gcol.done { cursor: default; }
      .sec-2-3 .gcol.done:hover { border-color: var(--line); }
      .sec-2-3 .gcol .gn { font-weight: 800; font-size: 14.5px; color: var(--os); }
      .sec-2-3 .gcol .gh { font-size: 12.5px; color: var(--muted); margin-bottom: 2px; }
      .sec-2-3 .gchip { display: block; font-size: 13px; font-weight: 700; padding: 3px 7px; border-radius: 7px; border: 1.5px solid; line-height: 1.3; }
      .sec-2-3 .gchip.ok { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
      .sec-2-3 .gchip.bad { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
      /* step 8 scheduling queues */
      .sec-2-3 .osrow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
      .sec-2-3 .osrow span { text-align: center; font-size: 13px; font-weight: 700; padding: 5px 4px; border-radius: 8px; border: 1.5px solid color-mix(in srgb, var(--os) 35%, transparent); color: var(--ink-2); background: var(--panel); transition: background .2s, color .2s; line-height: 1.25; }
      .sec-2-3 .osrow span.on { background: var(--os); border-color: var(--os); color: var(--accent-ink); }
      .sec-2-3 .ctl h4 { margin: 0 0 4px; }
      .sec-2-3 .hub-key { margin-top: auto; padding-top: 8px; border-top: 1px dashed var(--line-2); color: var(--ink-2); line-height: 1.4; }
    `,

    steps: [
      /* ---------------- 1. Big picture: the four achievements hub ---------------- */
      {
        title: 'Four ideas every modern operating system is built on',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          let cur = 0, mode = 'without', player = null;
          const tiles = HUB.map((d, k) => h('button', { class: 'hub-tile', type: 'button', style: { '--c': `var(--${d.col})` }, onclick: () => { cur = k; build(); } },
            h('span', { class: 'n' }, 'Idea ' + (k + 1)), h('b', {}, d.name), h('span', { class: 'sv' }, d.solves)));
          const head = h('div', { class: 'row', style: { justifyContent: 'space-between' } });
          const seg = ctx.ui.seg([{ value: 'without', label: 'Without it' }, { value: 'with', label: 'With it' }], mode, (v) => { mode = v; build(); });
          const svg = s('svg', { viewBox: '0 0 600 232', width: '100%', role: 'img', 'aria-label': 'Mini demonstration' });
          const slot = h('div');
          const KEY = [
            'A <b>process</b> is a program plus its data plus a saved record of exactly where it is, so the OS can pause and resume it at will.',
            'The OS gives each process its own region of memory and has the hardware check every address the process uses.',
            'The OS checks every request against who is asking and what that user or program is allowed to do.',
            'The OS keeps queues of waiting processes and uses interrupts and time slices to decide who runs next.',
          ];
          const keyEl = h('div', { class: 'small hub-key' });
          function build() {
            const d = HUB[cur];
            keyEl.innerHTML = '<b>Key idea:</b> ' + KEY[cur];
            head.innerHTML = `<h3 class="m0">${d.name}</h3><span class="chip ${d.col}">explored in ${d.where.toLowerCase()}</span>`;
            tiles.forEach((t, j) => t.classList.toggle('on', j === cur));
            if (player) player.stop();
            player = ctx.ui.player({ count: 4, speed: false, interval: 2600, render: (i) => { const [nodes, cap] = d.draw(mode === 'with', i); svg.replaceChildren(...nodes); return cap; } });
            slot.replaceChildren(player.el);
          }
          const left = h('div', { class: 'stack' },
            h('p', { class: 'lead m0', html: 'Juggling many programs and users at once (section 2.2) forced <b>four major achievements</b> in OS design. Pick one to see what goes wrong without it.' }),
            h('div', { class: 'hub-grid' }, tiles),
            h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A hospital runs on the same four ideas: a chart saying where each patient\'s treatment stands (<b>process</b>), a bed per patient (<b>memory</b>), locked records and ID badges (<b>security</b>), and triage deciding who is seen next (<b>scheduling</b>).' }));
          const right = h('div', { class: 'card white stack demo-card' }, head,
            h('div', { class: 'row' }, seg, h('span', { class: 'small muted' }, 'Play the story, then flip the switch and play it again.')),
            fitWide(ctx, svg, 520), slot, keyEl);
          el.append(h('div', { class: 'split l fill' }, left, right));
          build();
        },
      },
      /* ---------------- 2. Four definitions of a process, one anatomy diagram ---------------- */
      {
        title: 'What exactly is a process? Four ways to say it',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const G = {};                                  // highlight groups of the diagram
          const g = (key, ...kids) => (G[key] = s('g', { class: 'g' }, ...kids));
          const part = (x, y, hh, a, b, bcls) => [R(x, y, 160, hh, 's-panel', { rx: 6 }), T(x + 80, y + (b ? hh / 2 - 1 : hh / 2 + 5), a, { fs: 13.5, fw: 700 }), b ? T(x + 80, y + hh / 2 + 16, b, { fs: 12.5, cls: bcls || 's-sub' }) : null];
          const proc = (n, x, file, ctxTxt, res) => [
            g('p' + n, R(x, 120, 294, 172, 's-proc'), T(x + 12, 142, 'Process ' + n, { a: 'start', fw: 800 })),
            g('code' + n, R(x + 12, 150, 160, 38, 's-panel', { rx: 6 }), T(x + 92, 166, 'program code', { fs: 13.5, fw: 700 })),
            g('data' + n, ...part(x + 12, 194, 32, 'data: ' + file, null)),
            g('ctx' + n, ...part(x + 12, 232, 52, 'context', ctxTxt, 's-monot')),
            g('res' + n, T(x + 234, 162, 'resources', { fs: 12.5, cls: 's-sub' }),
              ...res.map((r, k) => [R(x + 186, 170 + k * 38, 96, 30, 's-mem', { rx: 7 }), T(x + 234, 190 + k * 38, r, { fs: 12.5, fw: 700 })])),
            g('thread' + n, LN(x + 30, 179, x + 154, 179, 'thread', { w: 2.5 }))];
          const svg = s('svg', { viewBox: '0 0 640 314', width: '100%', role: 'img', 'aria-label': 'Anatomy of two processes' },
            s('g', { transform: 'translate(0,14)' }, R(8, 94, 624, 204, 's-mem', { rx: 14, 'stroke-width': 1.5 }), T(22, 112, 'Main memory', { a: 'start', fs: 13, fw: 800, st: 'fill:var(--mem)' }),
              ...proc(1, 18, 'notes.txt', 'PC 212 · R1 7', ['memory', 'notes.txt']),
              ...proc(2, 326, 'todo.txt', 'PC 48 · R1 0', ['memory', 'todo.txt'])),
            g('cpu', R(14, 8, 290, 58, 's-cpu'), T(28, 32, 'Processor', { a: 'start', fw: 800 }), T(28, 54, 'running Process 1 · PC = 212', { a: 'start', fs: 13.5, cls: 's-monot' })),
            g('disk', R(336, 8, 290, 58, 's-io'), T(350, 32, 'Disk', { a: 'start', fw: 800 }), T(350, 54, 'program file "editor": just instructions', { a: 'start', fs: 13 })),
            g('run', LN(160, 68, 160, 130, 'cpu'), T(168, 96, 'runs', { a: 'start', fs: 13, fw: 700, st: 'fill:var(--cpu)' })),
            g('load', LN(350, 68, 296, 130, 'io'), LN(480, 68, 480, 130, 'io'), T(422, 96, 'load', { fs: 13, fw: 700, st: 'fill:var(--io)' })));
          const DEFS = [
            { q: 'A program in execution.', on: ['cpu', 'run', 'disk', 'load', 'p1', 'code1', 'data1', 'ctx1'],
              t: 'Alive, not just stored', x: 'A <b>program</b> is a passive file of instructions on disk. It becomes a <span class="t">process</span> when the OS loads it into memory and the processor starts carrying out its instructions. The recipe is not the cooking.' },
            { q: 'An instance of a program running on a computer.', on: ['disk', 'load', 'p1', 'code1', 'data1', 'ctx1', 'p2', 'code2', 'data2', 'ctx2'],
              t: 'One program, many copies', x: 'One program can run several times at once. Two windows of the same editor are two processes: same code, but each has its own data (notes.txt vs todo.txt) and its own place in the code (PC 212 vs PC 48).' },
            { q: 'The entity that can be assigned to and executed on a processor.', on: ['cpu', 'run', 'p1', 'ctx1'],
              t: 'What the scheduler sees', x: 'To the part of the OS that shares out the processor, a process is simply the thing it can hand the processor to. It picks one process, loads that process\'s saved context into the registers and lets it run.' },
            { q: 'A unit of activity with a single sequential thread of execution, a current state and an associated set of system resources.', on: ['p1', 'code1', 'thread1', 'ctx1', 'res1'],
              t: 'The ingredients', x: 'One <b style="color:var(--thread)">thread of execution</b>: the path the PC walks through the code, one instruction after another (section 2.4 allows several per process). A <b>current state</b>: the <span class="t" data-t="execution context">context</span> (PC, registers, status). A set of <b style="color:var(--mem)">resources</b>: memory, open files, devices.' },
          ];
          const title = h('h3', { class: 'm0' });
          const expl = h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.45' } });
          const btns = DEFS.map((d, k) => h('button', { class: 'defbtn', type: 'button', onclick: () => pick(k) }, h('span', { class: 'k' }, String(k + 1)), h('span', { html: '“' + d.q + '”' })));
          function pick(k) {
            btns.forEach((b, j) => b.classList.toggle('on', j === k));
            Object.entries(G).forEach(([key, node]) => node.classList.toggle('dim', !DEFS[k].on.includes(key)));
            title.innerHTML = `<span class="chip proc">Definition ${k + 1}</span> ${DEFS[k].t}`;
            expl.innerHTML = DEFS[k].x;
          }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'm0', html: 'Ask four experts to define a <span class="t">process</span> and you may hear four different sentences. They all describe the same thing from different angles. <b>Click each one.</b>' }),
              h('div', { class: 'stack gap-s' }, btns),
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A recipe in a cookbook is a <b>program</b>. A cook working through it is a <b>process</b>: they know which step they are on, have ingredients out and are using the oven. Two cooks making the same recipe are two processes.' })),
            h('div', { class: 'card white stack', style: { gap: '10px' } }, fitWide(ctx, svg, 560), title, expl,
              h('p', { class: 'small muted', style: { margin: 'auto 0 0' }, html: 'Every process has the same three parts: <b>program code</b>, <b>data</b> and an <b>execution context</b>. Step 4 shows where the OS keeps them.' }))));
          pick(0);
        },
      },
      /* ---------------- 3. Why processes were needed: three pressures, four kinds of bugs ---------------- */
      {
        title: 'Why the process idea was needed: name that bug',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const FAM = [
            ['Improper synchronization', 'A program waits for a signal from another activity, and the signal is lost, sent twice, or not waited for.'],
            ['Failed mutual exclusion', 'Two programs use the same shared resource at the same time when only one at a time should.'],
            ['Nondeterminate program operation', 'Results change from run to run because they depend on how programs happen to interleave.'],
            ['Deadlock', 'Programs each hold something and wait for what another holds, so none can ever go on.'],
          ];
          const CASES = [
            { a: 1, x: 'Two booking clerks\' programs both read <i>seat 14C: free</i> at the same moment. Each marks the seat sold, and two passengers are given the same seat.',
              hint: 'Were two programs inside the same shared record at once?', why: 'Reading and updating the seat record must be done by one program at a time. Both got in together, so this is failed <b>mutual exclusion</b>.' },
            { a: 3, x: 'Program A has the disk and is waiting for the printer. Program B has the printer and is waiting for the disk. Neither ever finishes.',
              hint: 'Is anyone stuck waiting for something another program is holding?', why: 'Each holds what the other needs and waits for it forever: a <b>deadlock</b>.' },
            { a: 0, x: 'A program asks for a block to be read from disk and is meant to sleep until the disk signals <i>done</i>. That signal is lost, so the program sleeps forever.',
              hint: 'Nobody is holding anything here. What went wrong with the wake-up signal?', why: 'The program was right to wait for an event, but the signal that should have woken it went missing: improper <b>synchronization</b>.' },
            { a: 2, x: 'A payroll program gives different totals on Monday and Tuesday for exactly the same input. On Tuesday another program changed a shared memory area at a different moment.',
              hint: 'Same input, different output. What decided the result?', why: 'The result depended on how the programs happened to interleave, not on the input: <b>nondeterminate</b> operation.' },
            { a: 0, x: 'A program starts working on a buffer before the disk has finished filling it, so it computes with half-old, half-new data.',
              hint: 'Should the program have waited for some event first?', why: 'It had to wait for the disk\'s <i>buffer full</i> signal before starting. The two activities were not <b>synchronized</b>.' },
            { a: 1, x: 'Two users edit the same shared file at once. Each saves their own version, and the second save silently wipes out the first user\'s changes.',
              hint: 'Should the updates have happened one at a time?', why: 'Updating the file needed one writer at a time. With both inside at once, one update was lost: failed <b>mutual exclusion</b>.' },
            { a: 2, x: 'A bug shows up about once in a thousand runs, and it vanishes whenever a programmer adds print statements to hunt for it.',
              hint: 'What changes when you add print statements? The timing.', why: 'Print statements change the timing, and this bug depends on timing: <b>nondeterminate</b> operation. Such bugs are notoriously hard to reproduce.' },
            { a: 3, x: 'Two bank transfers run at once. One locks account X and waits to lock account Y. The other has already locked Y and waits for X. Both hang forever.',
              hint: 'Two programs, each holding one thing and waiting for the other\'s.', why: 'A circular wait on locks that will never be released: a <b>deadlock</b>.' },
          ];
          let k = 0, first = 0, tried = false;
          const prog = h('span', { class: 'chip' });
          const score = h('span', { class: 'chip ok' });
          const scen = h('div', { class: 'card tight scen' });
          const fb = h('div', { class: 'fb' });
          const next = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { k++; show(); } });
          const opts = FAM.map(([n, d], j) => h('button', { class: 'opt', type: 'button', onclick: () => choose(j) }, h('b', {}, n), h('span', {}, d)));
          const optGrid = h('div', { class: 'grid-2', style: { gap: '8px' } }, opts);
          function show() {
            if (k >= CASES.length) {
              scen.innerHTML = `<div class="big" style="color:var(--ok)">${first} / ${CASES.length}</div><div>correct on the first try. All four families come from the same root: several activities sharing one processor and shared data, switched at unpredictable moments, with no clean way to describe each one.</div>`;
              opts.forEach((o) => { o.disabled = true; o.classList.remove('right', 'wrong'); });
              fb.className = 'fb'; fb.innerHTML = 'The fix was the <b>process</b>: a tidy package the OS can pause, resume, protect and coordinate. Chapter 5 returns to mutual exclusion and synchronization in depth.';
              prog.textContent = 'Done'; score.textContent = `Score ${first}`;
              next.textContent = 'Play again'; next.onclick = () => { k = 0; first = 0; next.onclick = () => { k++; show(); }; show(); };
              next.disabled = false; return;
            }
            tried = false;
            prog.textContent = `Case ${k + 1} of ${CASES.length}`; score.textContent = `First-try score ${first}`;
            scen.innerHTML = CASES[k].x;
            opts.forEach((o) => { o.disabled = false; o.classList.remove('right', 'wrong'); });
            fb.className = 'fb'; fb.innerHTML = '<span class="muted">Which family of error is this? Pick one.</span>';
            next.textContent = k === CASES.length - 1 ? 'See result' : 'Next case →'; next.disabled = true;
          }
          function choose(j) {
            const c = CASES[k];
            if (j === c.a) {
              if (!tried) first++;
              opts[j].classList.add('right'); opts.forEach((o) => (o.disabled = true));
              fb.className = 'fb ok'; fb.innerHTML = '<b>✓ ' + FAM[j][0] + '.</b> ' + c.why;
              score.textContent = `First-try score ${first}`; next.disabled = false;
            } else {
              tried = true; opts[j].classList.add('wrong'); opts[j].disabled = true;
              fb.className = 'fb bad'; fb.innerHTML = '<b>✗ Not ' + FAM[j][0].toLowerCase() + '.</b> Hint: ' + c.hint;
            }
          }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'm0', html: 'In the 1960s three kinds of system all had to switch one processor among many activities, at moments chosen by <span class="t">interrupts</span> rather than by the programs themselves:' }),
              ...[['1', 'Multiprogrammed batch', 'Keep the processor and I/O devices busy: when one job waits for I/O, switch to another.'],
                ['2', 'Time sharing', 'Answer many interactive users quickly by giving each a short turn in rotation.'],
                ['3', 'Real-time transaction systems', 'Many users query and update one shared database, such as airline seats, and expect answers within seconds.']]
                .map(([n, t, d]) => h('div', { class: 'card dev' }, h('span', { class: 'k' }, n), h('div', {}, h('b', {}, t), h('span', {}, d)))),
              h('div', { class: 'callout why m0', 'data-label': 'The trouble', html: 'Switching code written case by case, with no clean model of a half-finished program, bred timing bugs that are hard to reproduce. They fall into <b>four families</b>, from failed <span class="t">mutual exclusion</span> to <span class="t">deadlock</span>. Sort the cases on the right.' })),
            h('div', { class: 'card white stack', style: { gap: '10px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Name that bug'), h('div', { class: 'row' }, prog, score)),
              scen, optGrid, fb, h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: 'auto' } }, next))));
          show();
        },
      },
      /* ---------------- 4. Process list, base/limit registers, context switching ---------------- */
      {
        title: 'Inside the OS: the process list and a context switch',
        kind: 'lab',
        core: true, // on the shorter core path
        render(el, ctx) {
          const { h, s } = ctx;
          const CODE = [['+5', '+5', '+5', '+5', '+5', 'jmp 0'], ['+100', '+100', '+100', '+100', '+100', 'jmp 0']];
          let st, busy = false;
          const fresh = () => ({ regs: { idx: 0, pc: 0, base: 2000, limit: 600, r1: 0 }, hl: [], check: null, badBlock: false,
            rows: [{ n: 'A', base: 2000, limit: 600, pc: 0, r1: 0, inc: 5, state: 'running' }, { n: 'B', base: 4000, limit: 400, pc: 0, r1: 0, inc: 100, state: 'ready' }] });
          const svg = s('svg', { viewBox: '0 0 660 400', width: '100%', role: 'img', 'aria-label': 'Processor registers and main memory with the process list' });
          const logEl = h('div', { class: 'log grow' });
          const log = (html) => { logEl.append(h('div', { html })); logEl.scrollTop = logEl.scrollHeight; };
          function draw() {
            const r = st.regs, HL = new Set(st.hl);
            const hlr = (x, y, w, hh) => R(x, y, w, hh, '', { rx: 6, style: 'fill:var(--hl);stroke:none', opacity: 0.8 });
            const n = [R(8, 8, 226, 262, 's-cpu'), T(20, 34, 'Processor registers', { a: 'start', fw: 800 })];
            if (HL.has('regs')) n.push(hlr(14, 50, 214, 204));
            [['Process index', r.idx], ['PC', r.pc], ['Base', r.base], ['Limit', r.limit], ['R1', r.r1]].forEach(([nm, v], k) => {
              const y = 50 + k * 40;
              n.push(T(20, y + 24, nm, { a: 'start', fs: 14.5, fw: 700 }), R(146, y + 4, 80, 30, 's-panel', { rx: 6 }), T(186, y + 25, String(v), { fs: 15, fw: 800, cls: 's-monot' }));
            });
            n.push(R(8, 282, 226, 110, 's-panel'), T(20, 306, 'Hardware address check', { a: 'start', fs: 13.5, fw: 800 }));
            const c = st.check || { ok: true, a: 'every address < limit?', b: 'real = base + address', c: 'done on every access' };
            n.push(T(20, 334, c.a, { a: 'start', fs: 14, fw: 700, cls: 's-monot', st: st.check ? (c.ok ? OK : BAD) : null }),
              T(20, 360, c.b, { a: 'start', fs: 13.5, cls: 's-monot' }), T(20, 382, c.c, { a: 'start', fs: 13, cls: 's-sub' }));
            n.push(R(248, 8, 404, 384, 's-mem', { rx: 12 }), T(262, 30, 'Main memory', { a: 'start', fw: 800, st: 'fill:var(--mem)' }),
              R(260, 40, 380, 126, 's-os', { rx: 8 }), T(272, 62, 'OS region: the process list', { a: 'start', fs: 14, fw: 800, st: 'fill:var(--os)' }));
            const COL = [282, 320, 370, 422, 478, 532, 596];
            ['idx', 'proc', 'base', 'limit', 'PC', 'R1', 'state'].forEach((t, j) => n.push(T(COL[j], 86, t, { fs: 12.5, fw: 700, cls: 's-sub' })));
            st.rows.forEach((w, i) => {
              const y = 94 + i * 34, live = w.state === 'running';
              n.push(R(266, y, 368, 28, 's-panel', { rx: 6, 'stroke-width': 1 }));
              if (HL.has('row' + i)) n.push(hlr(266, y, 368, 28));
              [i, w.n, w.base, w.limit, live ? 'in CPU' : w.pc, live ? 'in CPU' : w.r1, w.state[0].toUpperCase() + w.state.slice(1)].forEach((v, j) => n.push(T(COL[j], y + 19, String(v),
                { fs: live && (j === 4 || j === 5) ? 12.5 : 13.5, fw: j === 1 || j === 6 ? 800 : 650, cls: live && (j === 4 || j === 5) ? 's-sub' : (j >= 2 && j <= 5 ? 's-monot' : null), st: j === 6 && live ? 'fill:var(--ok)' : null })));
            });
            st.rows.forEach((w, i) => {
              const y = 178 + i * 108, on = r.idx === i && w.state === 'running';
              const edge = on && st.badBlock ? { 'stroke-width': 3.5, style: 'stroke:var(--bad)' } : { 'stroke-width': on ? 3.5 : 1.5 };
              n.push(R(260, y, 380, 98, 's-proc', Object.assign({ rx: 8 }, edge)), T(272, y + 22, `Process ${w.n}: program + data`, { a: 'start', fs: 14, fw: 800 }),
                T(628, y + 22, `starts at ${w.base}, size ${w.limit}`, { a: 'end', fs: 12.5, cls: 's-sub' }));
              const at = on ? r.pc : w.pc;
              CODE[i].forEach((code, j) => {
                const x = 272 + j * 48, cur = j === at;
                n.push(R(x, y + 34, 44, 34, cur ? (on ? 's-cpu' : 's-panel') : 's-panel', { rx: 5, 'stroke-width': cur ? 3 : 1.2, 'stroke-dasharray': cur && !on ? '5 3' : null }),
                  T(x + 22, y + 56, code, { fs: 13, fw: 700, cls: 's-monot' }),
                  T(x + 22, y + 86, cur ? '▲ ' + j : String(j), { fs: cur ? 13 : 12.5, fw: cur ? 800 : 600, cls: cur ? null : 's-sub', st: cur ? (on ? 'fill:var(--cpu)' : 'fill:var(--muted)') : null }));
              });
              n.push(R(564, y + 34, 64, 34, 's-mem', { rx: 5 }), T(596, y + 56, 'data', { fs: 13, fw: 700 }),
                T(596, y + 86, on ? 'running' : 'paused', { fs: 12.5, fw: 700, st: on ? 'fill:var(--ok)' : null, cls: on ? null : 's-sub' }));
            });
            svg.replaceChildren(...n);
          }
          const btns = [];
          const btn = (label, cls, fn) => { const b = h('button', { class: 'btn sm ' + cls, type: 'button', onclick: () => { if (!busy) fn(); } }, label); btns.push(b); return b; };
          const setBusy = (v) => { busy = v; btns.forEach((b) => (b.disabled = v)); };
          function run() {
            const r = st.regs, w = st.rows[r.idx], code = CODE[r.idx][r.pc], real = r.base + r.pc;
            st.check = { ok: true, a: `${r.pc} < limit ${r.limit} ✓`, b: `real = ${r.base} + ${r.pc} = ${real}`, c: `fetches "${code}" for ${w.n}` };
            st.badBlock = false; st.hl = [];
            if (code === 'jmp 0') { r.pc = 0; log(`<b>${w.n}</b> fetches from ${real}: jump back to 0. PC = 0.`); }
            else { r.r1 += w.inc; r.pc += 1; log(`<b>${w.n}</b> fetches from ${real}: add ${w.inc}. R1 = ${r.r1}, PC = ${r.pc}.`); }
            draw();
          }
          async function sw() {
            setBusy(true);
            const r = st.regs, cur = r.idx, nx = 1 - cur, a = st.rows[cur], b = st.rows[nx];
            st.check = null; st.badBlock = false;
            a.pc = r.pc; a.r1 = r.r1; a.state = 'ready'; st.hl = ['regs', 'row' + cur]; draw();
            log(`<span style="color:var(--intr)"><b>Interrupt.</b></span> OS saves ${a.n}'s context (PC ${a.pc}, R1 ${a.r1}) in entry ${cur}.`);
            await ctx.sleep(900); if (!ctx.alive) return;
            st.hl = ['row' + nx]; draw(); log(`OS picks the next process: ${b.n} (entry ${nx}).`);
            await ctx.sleep(900); if (!ctx.alive) return;
            Object.assign(r, { idx: nx, pc: b.pc, base: b.base, limit: b.limit, r1: b.r1 }); b.state = 'running'; st.hl = ['regs', 'row' + nx]; draw();
            log(`OS loads ${b.n}'s context: index ${nx}, PC ${b.pc}, base ${b.base}, limit ${b.limit}, R1 ${b.r1}. <b>${b.n} runs.</b>`);
            await ctx.sleep(700); if (!ctx.alive) return;
            st.hl = []; draw(); setBusy(false);
          }
          function bad() {
            const r = st.regs, w = st.rows[r.idx], addr = r.limit + 50;
            st.check = { ok: false, a: `${addr} < limit ${r.limit}? ✗`, b: 'access blocked', c: 'interrupt: OS takes over' };
            st.badBlock = true; st.hl = []; draw();
            log(`<span style="color:var(--bad)"><b>${w.n} tries address ${addr}</b></span>, past its limit of ${r.limit}. The hardware refuses and interrupts the OS, which would normally end ${w.n} with a bounds error. (Here it lets ${w.n} carry on.)`);
          }
          function reset() { st = fresh(); logEl.replaceChildren(); log('A is running from the start of its block. B is ready and has never run.'); draw(); }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'm0', html: 'A process has three parts: the executable <b>program</b>, its <b>data</b>, and its <span class="t">execution context</span> (what the OS needs to pause and resume it). A typical OS stores them like this:' }),
              h('ul', { class: 'small m0', html: '<li>The <span class="t">process list</span> has one entry per process: where the process is in memory, plus its saved context while it is not running (some systems keep part of it with the process instead).</li><li>Each process owns a block of memory holding its program and data.</li><li><b>Process index</b> names the running entry, the <b>PC</b> counts from the start of the block, and the <span class="t">base register</span> and <span class="t">limit register</span> give the block\'s start and size.</li>' }),
              h('div', { class: 'row', style: { gap: '8px' } }, btn('Run 1 instruction', 'primary', run), btn('Interrupt: switch', 'os', sw), btn('Bad address', 'intr', bad), btn('Reset', 'ghost', reset)),
              h('div', { class: 'callout tip m0', 'data-label': 'Try this', html: 'Run A three times, switch, run B twice, switch back. A resumes at PC 3 with R1 = 15, exactly where it stopped.' }),
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'A <b>context switch</b> never copies the program or its data: it saves and reloads only a few register values.' })),
            h('div', { class: 'stack' }, fitWide(ctx, svg, 600), logEl)));
          reset();
        },
      },
      /* ---------------- 5. Memory management: five responsibilities, two tools ---------------- */
      {
        title: 'Memory management: five jobs the OS must do',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const frameGrid = (hot) => {
            const own = { 1: 'P', 4: 'P', 9: 'P' }, os = [0, 6], other = [2, 7, 10];
            const out = [];
            for (let k = 0; k < 12; k++) {
              const x = 170 + (k % 6) * 74, y = 40 + Math.floor(k / 6) * 84, isNew = hot.includes(k);
              const cls = os.includes(k) ? 's-os' : other.includes(k) ? 's-panel' : own[k] || isNew ? (isNew ? 's-ok' : 's-proc') : 's-panel';
              out.push(R(x, y, 66, 72, cls, { rx: 7, 'stroke-width': isNew ? 3 : 1.5, 'stroke-dasharray': !os.includes(k) && !other.includes(k) && !own[k] && !isNew ? '4 3' : null }),
                T(x + 33, y + 42, os.includes(k) ? 'OS' : other.includes(k) ? 'other' : own[k] ? 'P' : isNew ? '+P' : 'free', { fs: 13.5, fw: 700, cls: own[k] || isNew || os.includes(k) ? null : 's-sub' }));
            }
            return out;
          };
          const JOBS = [
            { n: 'Process isolation', tools: ['Virtual memory'],
              x: 'Each process gets its own space. The OS (with hardware help) stops any process from reading or changing another process\'s instructions or data.',
              eg: 'A crashing browser tab cannot scribble over your music player\'s memory.',
              wo: 'one buggy program could corrupt every other program, or the OS itself.',
              draw: () => [R(20, 50, 220, 130, 's-proc'), T(130, 80, 'Process A', { fw: 800 }), R(40, 96, 180, 32, 's-panel', { rx: 6 }), T(130, 117, 'code', { fs: 13.5 }), R(40, 136, 180, 32, 's-panel', { rx: 6 }), T(130, 157, 'data', { fs: 13.5 }),
                R(380, 50, 220, 130, 's-proc'), T(490, 80, 'Process B', { fw: 800 }), R(400, 96, 180, 32, 's-panel', { rx: 6 }), T(490, 117, 'code', { fs: 13.5 }), R(400, 136, 180, 32, 's-panel', { rx: 6 }), T(490, 157, 'data', { fs: 13.5 }),
                LN(310, 36, 310, 196, 'bad', { head: false, w: 6 }), PA('M222,150 C 260,150 280,150 300,150', 'intr', { dash: '6 4' }), T(310, 216, '✗ A cannot reach into B', { fs: 14.5, fw: 800, st: BAD }), T(310, 24, 'separate address spaces', { fs: 13.5, cls: 's-sub' })] },
            { n: 'Automatic allocation and management', tools: ['Virtual memory'],
              x: 'Programs get memory as they need it and return it when done, with no programmer deciding where it physically goes. Pieces of one program can sit anywhere in memory.',
              eg: 'Opening another browser tab simply gets more memory; nobody picks addresses by hand.',
              wo: 'programmers would have to plan where every program sits in memory, and redo that plan whenever anything changed.',
              draw: () => [R(10, 70, 130, 96, 's-proc'), T(75, 104, 'Process P', { fw: 800 }), T(75, 130, '"I need 2 more', { fs: 13 }), T(75, 148, 'blocks"', { fs: 13 }),
                LN(142, 118, 166, 118, 'os'), ...frameGrid([5, 8]), T(392, 222, 'New blocks (+P) come from wherever memory is free', { fs: 13.5, cls: 's-sub' })] },
            { n: 'Support of modular programming', tools: ['Virtual memory'],
              x: 'Programmers build programs from separate modules. The OS lets each module be created, removed, or grow and shrink on its own, while the program runs.',
              eg: 'A word processor loads its spell-checker module only when you first use it.',
              wo: 'a program would have to be loaded as one fixed lump, needed parts or not.',
              draw: () => [R(20, 60, 170, 110, 's-proc'), T(105, 104, 'main', { fs: 16, fw: 800, cls: 's-monot' }), T(105, 128, 'module', { fs: 13, cls: 's-sub' }),
                R(230, 60, 150, 80, 's-proc'), R(230, 140, 150, 34, 's-ok', { rx: 6, 'stroke-dasharray': '5 3' }), T(305, 96, 'math', { fs: 16, fw: 800, cls: 's-monot' }), T(305, 118, 'module', { fs: 13, cls: 's-sub' }), T(305, 162, 'grows', { fs: 13, fw: 700, st: OK }),
                R(420, 60, 180, 110, 's-proc', { 'stroke-dasharray': '6 4' }), T(510, 104, 'spell', { fs: 16, fw: 800, cls: 's-monot' }), T(510, 128, 'loaded on demand', { fs: 13, cls: 's-sub' }),
                LN(190, 100, 226, 100, 'proc'), LN(380, 100, 416, 100, 'proc'), T(310, 212, 'Each module is its own piece that can come, go or change size', { fs: 13.5, cls: 's-sub' })] },
            { n: 'Protection and access control', tools: ['Virtual memory', 'File system'],
              x: 'Sharing is useful (one copy of a library for every program), but the OS must control who may read, write or run each piece of memory, and each file.',
              eg: 'Every running program shares one copy of the system library, yet none of them can change it.',
              wo: 'either nothing can be shared (wasteful copies everywhere) or everything is (anyone can change anything).',
              draw: () => [R(20, 20, 160, 70, 's-proc'), T(100, 61, 'Process A', { fw: 800 }), R(440, 20, 160, 70, 's-proc'), T(520, 61, 'Process B', { fw: 800 }),
                R(210, 140, 200, 70, 's-mem'), T(310, 172, 'shared library', { fw: 800 }), T(310, 194, 'read + run only', { fs: 13, cls: 's-sub' }),
                LN(120, 92, 236, 138, 'ok'), T(150, 128, 'run ✓', { fs: 13.5, fw: 800, st: OK }), LN(470, 92, 390, 138, 'ok'), T(468, 128, 'run ✓', { fs: 13.5, fw: 800, st: OK }),
                PA('M560,92 C 560,170 480,188 414,182', 'bad', { dash: '6 4' }), T(548, 196, 'write ✗', { fs: 13.5, fw: 800, st: BAD })] },
            { n: 'Long-term storage', tools: ['File system'],
              x: 'Many users and programs need information kept for months or years, long after the program that made it has ended and the machine has been switched off.',
              eg: 'Your essay is still there tomorrow after you shut the laptop down.',
              wo: 'all work would vanish whenever a program ended or the power went off.',
              draw: () => [R(20, 40, 250, 150, 's-mem', { 'stroke-dasharray': '6 4' }), T(145, 72, 'Main memory', { fw: 800 }), T(145, 96, 'volatile', { fs: 13, cls: 's-sub' }),
                T(145, 132, 'power off →', { fs: 14, fw: 700, st: BAD }), T(145, 156, 'contents gone', { fs: 14, fw: 700, st: BAD }),
                R(350, 40, 250, 150, 's-io'), T(475, 72, 'Disk: file system', { fw: 800 }), ...['essay.docx', 'budget.xlsx', 'photos/'].map((f, k) => T(475, 104 + k * 24, f, { fs: 14, cls: 's-monot' })),
                T(475, 182, '✓ still there next year', { fs: 14, fw: 800, st: OK }), LN(272, 115, 346, 115, 'io'), T(309, 106, 'save', { fs: 13, fw: 700 })] },
          ];
          const svg = s('svg', { viewBox: '0 0 620 232', width: '100%', role: 'img', 'aria-label': 'Illustration of the selected memory-management job' });
          const title = h('div', { class: 'row', style: { justifyContent: 'space-between' } });
          const expl = h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.45' } });
          const eg = h('p', { class: 'small m0 muted' });
          const wo = h('p', { class: 'small m0' });
          const btns = JOBS.map((j, k) => h('button', { class: 'defbtn', type: 'button', style: { alignItems: 'center' }, onclick: () => pick(k) }, h('span', { class: 'k', style: { background: 'var(--mem-bg)', color: 'var(--mem)' } }, String(k + 1)), h('b', { style: { fontSize: '15.5px' } }, j.n)));
          /* predict-then-reveal: the student names the tool before the chips appear */
          const TOOL = [['vm', 'Virtual memory', 'mem'], ['fs', 'File system', 'io'], ['both', 'Both', '']];
          const WHY = { vm: 'this job concerns main memory while programs are running.', fs: 'this job is about keeping named information after programs end and the power goes off.',
            both: 'pieces of memory and files both need rules about who may read, write or run them.' };
          const key = (j) => (j.tools.length > 1 ? 'both' : j.tools[0] === 'File system' ? 'fs' : 'vm');
          const guessed = {};
          let cur = 0;
          const gBtns = TOOL.map(([v, label, col]) => h('button', { class: 'btn sm ' + col, type: 'button', onclick: () => { if (guessed[cur] == null) { guessed[cur] = v; pick(cur); } } }, label));
          const gfb = h('p', { class: 'small m0' });
          function pick(k) {
            const j = JOBS[k], ans = key(j), g = guessed[k];
            cur = k;
            btns.forEach((b, i) => { b.classList.toggle('on', i === k); b.style.borderColor = i === k ? 'var(--mem)' : ''; b.style.boxShadow = i === k ? '0 0 0 1px var(--mem)' : ''; b.style.background = i === k ? 'color-mix(in srgb, var(--mem) 10%, var(--panel))' : ''; });
            const chips = g == null ? '<span class="chip">tool: ?</span>' : j.tools.map((t) => `<span class="chip ${t === 'File system' ? 'io' : 'mem'}">${t}</span>`).join('');
            title.innerHTML = `<h3 class="m0">${k + 1}. ${j.n}</h3><span class="row" style="gap:6px">${chips}</span>`;
            svg.replaceChildren(...j.draw());
            expl.innerHTML = j.x; eg.innerHTML = '<b>Everyday example:</b> ' + j.eg;
            wo.innerHTML = '<b style="color:var(--warn)">Without it:</b> ' + j.wo;
            gBtns.forEach((b, i) => { b.disabled = g != null; b.classList.toggle('on', g === TOOL[i][0]); });
            const done = Object.keys(guessed).length, right = Object.keys(guessed).filter((i) => guessed[i] === key(JOBS[i])).length;
            gfb.innerHTML = g == null ? '<span class="muted">Commit to an answer; the chips above then show the tool that meets this job.</span>'
              : (g === ans ? '<b style="color:var(--ok)">✓ Right:</b> ' : `<b style="color:var(--bad)">✗ The answer is ${ans === 'both' ? 'both tools' : ans === 'fs' ? 'the file system' : 'virtual memory'}:</b> `) + WHY[ans] +
                (done === JOBS.length ? ` <b>${right} / ${JOBS.length}</b> matched.` : '');
          }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'm0', html: 'Users want to run many programs at once, and programmers want memory to just work. That hands the OS <b>five storage-management jobs</b>. Click each one, then name the tool that meets it:' }),
              h('div', { class: 'stack gap-s' }, btns),
              h('div', { class: 'callout why m0', 'data-label': 'Two tools do the work', html: '<span class="t">Virtual memory</span> lets each program use its own logical addresses, without caring how much real memory exists or where its pieces sit. The <span class="t">file system</span> keeps information for the long term in named files.' })),
            h('div', { class: 'card white stack', style: { gap: '10px' } }, title, fitWide(ctx, svg, 540), expl, wo, eg,
              h('div', { class: 'stack', style: { gap: '6px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px dashed var(--line-2)' } },
                h('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, h('b', { class: 'small' }, 'Which tool meets this job?'), ...gBtns), gfb))));
          pick(0);
        },
      },
      /* ---------------- 6. Paging lab: virtual address → page table → frame or page fault ---------------- */
      {
        title: 'Paging lab: follow a virtual address to memory',
        kind: 'lab',
        core: true, // on the shorter core path
        render(el, ctx) {
          const { h, s } = ctx;
          const NP = 8, NF = 6;
          let st, busy = false;
          const fresh = () => ({ table: [3, 0, null, 5, null, 1, null, null], frames: [1, 5, null, 0, null, 3], order: [1, 5, 0, 3], faults: 0, n: 0, va: null, res: null, hl: {} });
          const svg = s('svg', { viewBox: '0 0 660 460', width: '100%', role: 'img', 'aria-label': 'Processor, MMU with page table, main memory frames and disk' });
          const input = h('input', { class: 'va-in', type: 'number', min: 0, max: 9999, value: '5000', 'aria-label': 'Virtual address', onkeydown: (e) => { if (e.key === 'Enter') go(); } });
          const brk = h('div', { class: 'card tight brk' });
          const say = h('div', { class: 'fb' });
          const stats = h('div', { class: 'row', style: { gap: '6px' } });
          const handleBtn = h('button', { class: 'btn sm intr', type: 'button', onclick: () => { if (!busy && st.res && st.res.kind === 'fault') handle(); } }, 'Let the OS handle the page fault');
          const rowY = (p) => 86 + p * 45 + 19, frameY = (f) => 34 + f * 46 + 20;
          function draw() {
            const r = st.res || {}, H = st.hl;
            const n = [R(8, 176, 120, 96, 's-cpu'), T(68, 204, 'Processor', { fw: 800 }), T(68, 228, 'virtual address', { fs: 12.5, cls: 's-sub' }),
              T(68, 256, st.va == null ? '—' : String(st.va), { fs: 17, fw: 800, cls: 's-monot', st: 'fill:var(--cpu)' }), LN(128, 224, 148, 224, 'cpu'),
              R(150, 8, 164, 444, 's-cpu'), T(232, 32, 'MMU', { fw: 800 }), T(232, 52, 'page table', { fs: 12.5, cls: 's-sub' }),
              T(184, 76, 'page', { fs: 12.5, fw: 700, cls: 's-sub' }), T(258, 76, 'where', { fs: 12.5, fw: 700, cls: 's-sub' })];
            for (let p = 0; p < NP; p++) {
              const y = 86 + p * 45, f = st.table[p], on = H.row === p;
              n.push(R(160, y, 144, 38, on ? 's-accent' : 's-panel', { rx: 6, 'stroke-width': on ? 3 : 1 }), T(184, y + 25, String(p), { fs: 15, fw: 800 }),
                T(258, y + 25, f == null ? 'on disk' : 'frame ' + f, { fs: 14, fw: 700, st: f == null ? 'fill:var(--io)' : 'fill:var(--mem)' }));
            }
            n.push(T(400, 24, 'Main memory', { a: 'start', fw: 800, st: 'fill:var(--mem)' }));
            for (let f = 0; f < NF; f++) {
              const y = 34 + f * 46, p = st.frames[f], on = H.frame === f;
              n.push(R(400, y, 140, 40, p == null ? 's-panel' : 's-mem', { rx: 6, 'stroke-width': on ? 3.5 : 1.5, 'stroke-dasharray': p == null ? '5 4' : null, style: on ? 'stroke:var(--ok)' : null }),
                T(470, y + 26, `frame ${f}: ${p == null ? 'free' : 'page ' + p}`, { fs: 13.5, fw: 700, cls: p == null ? 's-sub' : null }),
                T(548, y + 26, `${f * PAGE}–${f * PAGE + PAGE - 1}`, { a: 'start', fs: 12.5, cls: 's-monot s-sub' }));
            }
            n.push(R(392, 322, 260, 130, 's-io'), T(406, 346, 'Disk (secondary memory)', { a: 'start', fs: 14, fw: 800 }));
            [...Array(NP).keys()].filter((p) => st.table[p] == null).forEach((p, k) => {
              const x = 406 + k * 61, on = H.disk === p;
              n.push(R(x, 364, 56, 44, on ? 's-intr' : 's-panel', { rx: 6, 'stroke-width': on ? 3 : 1.2 }), T(x + 28, 383, 'page ' + p, { fs: 12.5, fw: 700 }), T(x + 28, 400, 'blk ' + (50 + p), { fs: 12.5, cls: 's-monot s-sub' }));
            });
            n.push(T(522, 436, 'pages not in memory wait here', { fs: 12.5, cls: 's-sub' }));
            if (r.kind === 'hit' && H.frame === r.f) {
              const y1 = rowY(r.p), y2 = frameY(r.f);
              /* two-line label in the gap between the MMU and memory, on the side of the frame the line does not pass */
              const ly = y1 >= y2 ? y2 - 24 : y2 + 18;
              n.push(LN(304, y1, 396, y2, 'mem'), T(357, ly, 'real', { fs: 12.5, fw: 700, st: 'fill:var(--mem)' }), T(357, ly + 14, 'address', { fs: 12.5, fw: 700, st: 'fill:var(--mem)' }));
            }
            if (r.kind === 'fault' && H.disk === r.p) n.push(PA(`M304,${rowY(r.p)} C 350,${rowY(r.p)} 350,386 388,386`, 'intr', { dash: '6 4' }), T(388, 406, 'disk address', { a: 'end', fs: 12.5, fw: 700, st: 'fill:var(--intr)' }));
            svg.replaceChildren(...n);
            stats.innerHTML = `<span class="chip">translations: ${st.n}</span><span class="chip intr">page faults: ${st.faults}</span>`;
            handleBtn.style.display = r.kind === 'fault' && !busy ? '' : 'none';
          }
          function explain() {
            const r = st.res, va = st.va;
            if (r.kind === 'bad') {
              brk.innerHTML = `<div class="mono">${va} ÷ 1024 = page ${Math.floor(va / PAGE)}</div><div class="res" style="color:var(--bad)">✗ This program only has pages 0–7 (addresses 0–8191).</div>`;
              return;
            }
            const bits = va.toString(2).padStart(13, '0');
            brk.innerHTML = `<div><span class="mono">${va} = ${r.p} × 1024 + ${r.off}</span> → page <span class="pg">${r.p}</span>, offset <span class="of">${r.off}</span></div>` +
              `<div class="mono">binary: <span class="pg">${bits.slice(0, 3)}</span> <span class="of">${bits.slice(3)}</span></div>` +
              '<div class="xs muted">1024 = 2<sup>10</sup>, so the hardware simply splits the bits: low 10 bits = offset.</div>' +
              (r.kind === 'hit' ? `<div class="res" style="color:var(--mem)">page ${r.p} → frame ${r.f} → real address ${r.f} × 1024 + ${r.off} = <b>${r.real}</b></div>`
                : `<div class="res" style="color:var(--intr)">page ${r.p} → on disk → <b>page fault</b></div>`);
          }
          function translate(va, restart) {
            st.va = va; if (!restart) st.n++;
            if (!(va >= 0 && va < NP * PAGE)) {
              st.res = { kind: 'bad' }; st.hl = {};
              say.className = 'fb bad'; say.innerHTML = `<b>Address ${va} is outside the program.</b> Page ${Math.floor(va / PAGE)} does not exist, so the MMU interrupts the OS, which stops the program. Paging protects memory as well as placing it.`;
            } else {
              const p = Math.floor(va / PAGE), off = va % PAGE, f = st.table[p];
              if (f == null) {
                st.res = { kind: 'fault', p, off }; st.hl = { row: p, disk: p }; st.faults++;
                say.className = 'fb bad'; say.innerHTML = `The table says page ${p} is <b>on disk</b>, not in main memory. The MMU cannot finish the translation, so it raises a <span class="t">page fault</span>.`;
              } else {
                st.res = { kind: 'hit', p, off, f, real: f * PAGE + off }; st.hl = { row: p, frame: f };
                if (!restart) { say.className = 'fb ok'; say.innerHTML = `Page ${p} is in frame ${f}. The MMU swaps the page number for the frame number and keeps the offset: <b>${f * PAGE + off}</b>. The program never sees this <span class="t">real address</span>.`; }
              }
            }
            explain(); draw();
          }
          async function handle() {
            const { p, off } = st.res; busy = true;
            say.className = 'fb bad'; say.innerHTML = `<b>Page fault interrupt.</b> The OS takes over and blocks the process while it reads page ${p} from disk block ${50 + p}.`;
            draw(); await ctx.sleep(1200); if (!ctx.alive) return;
            let f = st.frames.indexOf(null), note;
            if (f < 0) { const v = st.order.shift(); f = st.table[v]; st.table[v] = null; note = `No frame is free, so the OS evicts page ${v}, the one in memory longest (saved to disk if changed).`; }
            else note = `Frame ${f} is free.`;
            st.frames[f] = p; st.table[p] = f; st.order.push(p); st.hl = { row: p, frame: f };
            say.innerHTML = `${note} The OS copies page ${p} into frame ${f} and updates the page table.`;
            draw(); await ctx.sleep(1200); if (!ctx.alive) return;
            busy = false; translate(st.va, true);
            say.className = 'fb ok'; say.innerHTML = `The instruction restarts. Now the MMU finds page ${p} in frame ${f}: real address ${f} × 1024 + ${off} = <b>${f * PAGE + off}</b>.`;
          }
          function go(v) { if (busy) return; const va = v != null ? v : Math.round(Number(input.value)); if (!Number.isFinite(va) || va < 0) return; input.value = String(va); translate(va); }
          function reset() { if (busy) return; st = fresh(); say.className = 'fb'; say.innerHTML = 'Pick an address above. Try the ones that land <b>on disk</b>, then keep going until memory is full.'; brk.innerHTML = '<div class="muted">The page number and offset will appear here.</div>'; draw(); }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: '<span class="t">Paging</span> cuts every program into fixed-size <b>pages</b> (here 1,024 bytes) and main memory into same-size <b>frames</b>. A <span class="t">virtual address</span> is a page number plus an offset. On every access the <span class="t">memory management unit (MMU)</span> looks it up in the <span class="t">page table</span>.' }),
              h('div', { class: 'row', style: { gap: '8px' } }, input, h('button', { class: 'btn primary sm', type: 'button', onclick: () => go() }, 'Translate'), h('button', { class: 'btn ghost sm', type: 'button', onclick: reset }, 'Reset')),
              h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small muted' }, 'Try:'), ...[1300, 3100, 5000, 2600, 7000, 9000].map((v) => h('button', { class: 'btn sm', type: 'button', onclick: () => go(v) }, String(v)))),
              brk, say, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, stats, handleBtn),
              h('p', { class: 'small m0', style: { marginTop: 'auto', paddingLeft: '10px', borderLeft: '4px solid var(--mem)', color: 'var(--ink-2)' }, html: '<b style="color:var(--ink)">Why it matters:</b> this program has 8 pages but memory has only 6 frames, and it still runs, because pages not in use wait on disk. That is <span class="t">virtual memory</span>.' })),
            fitWide(ctx, svg, 600)));
          reset();
        },
      },
      /* ---------------- 7. Protection and security: sort incidents by the goal they break ---------------- */
      {
        title: 'Protection and security: which goal was broken?',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const GOALS = [
            ['Availability', 'Systems and data are up and usable whenever authorized users need them.', 'kept from service'],
            ['Confidentiality', 'Only those with permission can read the data.', 'read by the wrong people'],
            ['Data integrity', 'Data is changed only by those allowed to, in allowed ways.', 'changed by the wrong people'],
            ['Authenticity', 'Users really are who they claim, and messages really come from where they say.', 'faked identity or origin'],
          ];
          const INC = [
            { g: 1, t: 'Stolen laptop', x: 'A laptop holding an unencrypted list of customers\' card numbers is stolen from a car.', why: 'Private data can now be read by people with no right to see it. Nothing was changed, and the owners can still work: <b>confidentiality</b>.' },
            { g: 3, t: 'Guessed password', x: 'An attacker guesses a weak password and logs in. The system treats them as the real account owner.', why: 'The system failed to verify who the user really was: <b>authenticity</b>. (What the intruder does next may break other goals too.)' },
            { g: 0, t: 'Runaway program', x: 'One program grabs all the memory and processor time, so everyone else\'s work grinds to a halt.', why: 'Nobody\'s data was read or changed, but authorized users could not get service: <b>availability</b>.' },
            { g: 2, t: 'Altered log', x: 'Malware quietly changes the amounts recorded in a bank\'s transaction log.', why: 'The records were modified by someone not allowed to: <b>data integrity</b>.' },
            { g: 3, t: 'Fake email', x: 'An email that claims to come from the IT department, asking you to reset your password, really comes from an outsider.', why: 'The message lied about where it came from: <b>authenticity</b>.' },
            { g: 1, t: 'Snooping program', x: 'A program reads another user\'s private messages because the OS never checked whether it had permission.', why: 'Data was read by a program without the right to read it: <b>confidentiality</b>.' },
            { g: 0, t: 'Flooded server', x: 'Thousands of fake requests per second swamp a college\'s registration server, so real students cannot sign up.', why: 'The service was knocked out for legitimate users (a denial-of-service attack): <b>availability</b>.' },
            { g: 2, t: 'Infected program file', x: 'A virus alters a program file on disk so that it also runs hidden code every time it starts.', why: 'Software was modified without permission: <b>data integrity</b>.' },
          ];
          let k = 0, right = 0;
          const placed = GOALS.map(() => []);
          const inc = h('div', { class: 'card tight', style: { minHeight: '84px' } });
          const fb = h('div', { class: 'fb', style: { minHeight: '66px' } });
          const prog = h('span', { class: 'chip' }), score = h('span', { class: 'chip ok' });
          const again = h('button', { class: 'btn sm primary', type: 'button', style: { display: 'none' }, onclick: () => { k = 0; right = 0; placed.forEach((p) => (p.length = 0)); show(); } }, 'Play again');
          const cols = GOALS.map(([n], j) => {
            const c = h('div', { class: 'gcol', style: ctx.narrow ? { minHeight: '120px' } : null, role: 'button', tabindex: 0, 'aria-label': 'Put it under ' + n, onclick: () => assign(j), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); assign(j); } } });
            return c;
          });
          function paintCols() {
            cols.forEach((c, j) => {
              c.replaceChildren(h('span', { class: 'gn' }, GOALS[j][0]), h('span', { class: 'gh' }, GOALS[j][2]),
                ...placed[j].map((p) => h('span', { class: 'gchip ' + (p.ok ? 'ok' : 'bad') }, (p.ok ? '✓ ' : '✗ ') + p.t)));
              c.classList.toggle('done', k >= INC.length);
            });
          }
          function show() {
            prog.textContent = k < INC.length ? `Incident ${k + 1} of ${INC.length}` : 'All sorted';
            score.textContent = `right first time: ${right}`;
            inc.innerHTML = k < INC.length ? `<b>${INC[k].t}.</b> ${INC[k].x}` : `<b>${right} of ${INC.length}</b> right first time. Each column now holds two incidents: every goal can be broken in more than one way, and one attack can break several goals.`;
            if (k === 0) { fb.className = 'fb'; fb.innerHTML = '<span class="muted">Click the column for the goal this incident breaks.</span>'; }
            again.style.display = k >= INC.length ? '' : 'none';
            paintCols();
          }
          function assign(j) {
            if (k >= INC.length) return;
            const c = INC[k], ok = c.g === j;
            placed[c.g].push({ t: c.t, ok }); if (ok) right++;
            fb.className = 'fb ' + (ok ? 'ok' : 'bad');
            fb.innerHTML = (ok ? '<b>✓ Right.</b> ' : `<b>✗ Not ${GOALS[j][0].toLowerCase()}.</b> `) + c.why;
            k++; show();
          }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: 'When many users share a machine and networks join machines, the OS must control who may use what, and check who is asking. Security has <b>four goals</b>:' }),
              ...GOALS.map(([n, d], j) => h('div', { class: 'card goal' }, h('span', { class: 'k' }, ['Av', 'C', 'I', 'Au'][j]), h('div', {}, h('b', { html: `<span class="t" data-t="${n === 'Availability' ? 'Availability (security goal)' : n}">${n}</span>` }), h('span', { class: 'd' }, d)))),
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Mixing up confidentiality and integrity. <b>Reading</b> data you should not breaks confidentiality; <b>changing</b> it breaks integrity.' })),
            h('div', { class: 'card white stack', style: { gap: '10px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Sort the incidents'), h('div', { class: 'row' }, prog, score)),
              inc, h('div', { style: { display: 'grid', gap: '8px', gridTemplateColumns: `repeat(${ctx.narrow ? 2 : 4}, minmax(0, 1fr))` } }, cols), fb, h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: 'auto' } }, again))));
          show();
        },
      },
      /* ---------------- 8. Scheduling and resource management: queues, service calls, interrupts ---------------- */
      {
        title: 'Scheduling: queues, service calls and interrupts',
        kind: 'lab',
        render(el, ctx) {
          const { h, s } = ctx;
          const CAP = 4;                                   // processes that fit in main memory
          let st, busy = false;
          const fresh = () => ({ run: 'P1', rq: ['P2', 'P3'], dq: ['P4'], pq: [], lt: ['P5', 'P6'], next: 7, done: 0, sw: 0, moved: null, path: null });
          const inMem = () => (st.run ? 1 : 0) + st.rq.length + st.dq.length + st.pq.length;
          const svg = s('svg', { viewBox: '0 0 660 322', width: '100%', role: 'img', 'aria-label': 'Long-term, short-term and I/O queues feeding the processor' });
          const HN = ['Service call handler', 'Interrupt handler', 'Long-term scheduler', 'Short-term scheduler'];
          const hEls = HN.map((n) => h('span', {}, n));
          const say = h('div', { class: 'fb', style: { minHeight: '70px' } });
          const stats = h('div', { class: 'row', style: { gap: '6px' } });
          const lit = (i) => hEls.forEach((e, j) => e.classList.toggle('on', j === i));
          const PATHS = {
            timeout: ['M540,94 C 530,66 120,66 96,104', 'warn'], diskDone: ['M52,186 C 52,150 60,126 90,126', 'io'], prnDone: ['M20,290 L8,290 L8,140 Q 8,126 22,126 L90,126', 'io'],
            dispatch: ['M472,126 L508,126', 'cpu'], toDisk: ['M560,160 L478,204', 'proc'], toPrn: ['M600,160 L478,286', 'proc'], admit: ['M92,48 C 66,56 66,112 88,120', 'mem'], exit: ['M630,94 L630,74', 'ok'],
          };
          function draw() {
            const n = [];
            const tok = (x, y, name) => [R(x, y, 54, 34, 's-proc', { rx: 8, style: st.moved === name ? 'fill:var(--hl)' : null, 'stroke-width': st.moved === name ? 3 : 2 }), T(x + 27, y + 23, name, { fs: 14.5, fw: 800 })];
            const lane = (y, label) => { n.push(R(92, y, 380, 44, 's-panel', { rx: 10, 'stroke-width': 1.5 }), T(472, y - 7, label, { a: 'end', fs: 13, fw: 700, cls: 's-sub' })); };
            lane(26, 'Long-term queue: new jobs waiting to be admitted'); lane(104, 'Short-term queue: ready, served round-robin');
            lane(186, 'I/O queue: waiting for the disk'); lane(268, 'I/O queue: waiting for the printer');
            st.lt.forEach((p, i) => n.push(...tok(98 + i * 62, 31, p)));
            st.rq.forEach((p, i) => n.push(...tok(412 - i * 62, 109, p)));
            st.dq.forEach((p, i) => n.push(...tok(98 + i * 62, 191, p)));
            st.pq.forEach((p, i) => n.push(...tok(98 + i * 62, 273, p)));
            n.push(R(512, 94, 140, 66, 's-cpu'), T(582, 112, 'Processor', { fs: 13.5, fw: 800 }));
            if (st.run) n.push(...tok(555, 119, st.run)); else n.push(T(582, 142, 'idle', { fs: 14, fw: 700, cls: 's-sub' }));
            n.push(R(20, 186, 64, 44, 's-io'), T(52, 213, 'Disk', { fs: 14, fw: 800 }), R(20, 268, 64, 44, 's-io'), T(52, 295, 'Printer', { fs: 13.5, fw: 800 }),
              LN(90, 208, 86, 208, 'io', { w: 2 }), LN(90, 290, 86, 290, 'io', { w: 2 }), LN(540, 48, 478, 48, 'muted', { w: 2 }), T(546, 53, 'new jobs', { a: 'start', fs: 13, fw: 700, cls: 's-sub' }));
            Object.entries(PATHS).forEach(([k, [d, col]]) => {
              const on = st.path === k, fixed = ['dispatch', 'toDisk', 'toPrn', 'admit'].includes(k);
              if (on || fixed) n.push(PA(d, on ? col : 'muted', { w: on ? 3.5 : 2, dash: on && !fixed ? '7 4' : null }));
            });
            if (st.path === 'exit') n.push(T(630, 68, 'finished', { fs: 13, fw: 800, st: OK }));
            svg.replaceChildren(...n);
            stats.innerHTML = `<span class="chip">in memory: ${inMem()} of ${CAP}</span><span class="chip ok">finished: ${st.done}</span><span class="chip cpu">dispatches: ${st.sw}</span>`;
          }
          const btns = [];
          const btn = (label, cls, fn) => { const b = h('button', { class: 'btn sm ' + cls, type: 'button', onclick: () => { if (!busy) run(fn); } }, label); btns.push(b); return b; };
          async function run(fn) { busy = true; btns.forEach((b) => (b.disabled = true)); await fn(); if (!ctx.alive) return; busy = false; btns.forEach((b) => (b.disabled = false)); }
          const beat = async (hi, path, moved, html) => { lit(hi); st.path = path; st.moved = moved; say.className = 'fb'; say.innerHTML = html; draw(); await ctx.sleep(1000); return ctx.alive; };
          async function dispatch() {
            if (st.run) return true;
            if (!st.rq.length) return beat(3, null, null, 'The short-term queue is empty, so the <b>processor sits idle</b> until an interrupt brings a process back.');
            st.run = st.rq.shift(); st.sw++;
            return beat(3, 'dispatch', st.run, `The short-term scheduler <b>dispatches ${st.run}</b>, the process at the front of the ready queue.`);
          }
          async function admit() {
            if (!st.lt.length || inMem() >= CAP) return true;
            const p = st.lt.shift(); st.rq.push(p);
            return beat(2, 'admit', p, `Memory has room, so the long-term scheduler <b>admits ${p}</b>: the OS gives it a share of main memory, and it joins the back of the short-term queue.`);
          }
          const needRun = () => { if (st.run) return false; lit(-1); say.className = 'fb bad'; say.innerHTML = 'Nothing is running, so there is no process to make that request.'; return true; };
          const EV = {
            timer: async () => { if (!st.run) { lit(1); say.className = 'fb'; say.innerHTML = 'Timer interrupt, but the processor is idle: nothing to preempt.'; return; }
              const p = st.run; st.run = null; st.rq.push(p);
              if (await beat(1, 'timeout', p, `<b>Timer interrupt.</b> ${p}'s time slice is used up. The OS saves its context and sends it to the <b>back</b> of the short-term queue. Round-robin: everyone gets a turn.`)) await dispatch(); },
            disk: async () => { if (needRun()) return; const p = st.run; st.run = null; st.dq.push(p);
              if (await beat(0, 'toDisk', p, `<b>Service call.</b> ${p} asks the OS to read the disk. It cannot go on until the data arrives, so it joins the <b>disk queue</b>.`)) await dispatch(); },
            prn: async () => { if (needRun()) return; const p = st.run; st.run = null; st.pq.push(p);
              if (await beat(0, 'toPrn', p, `<b>Service call.</b> ${p} asks the OS to print. It waits in the <b>printer queue</b> until the printer is done with it.`)) await dispatch(); },
            exit: async () => { if (needRun()) return; const p = st.run; st.run = null; st.done++;
              if (!(await beat(0, 'exit', null, `<b>Service call.</b> ${p} tells the OS it is finished. The OS reclaims its memory.`))) return;
              if (await admit()) await dispatch(); },
            diskDone: async () => { if (!st.dq.length) { lit(1); say.className = 'fb'; say.innerHTML = 'No process is waiting for the disk, so there is no disk interrupt to handle.'; return; }
              const p = st.dq.shift(); st.rq.push(p);
              if (await beat(1, 'diskDone', p, `<b>Disk interrupt.</b> ${p}'s data has arrived, so ${p} is ready again and joins the short-term queue.`)) await dispatch(); },
            prnDone: async () => { if (!st.pq.length) { lit(1); say.className = 'fb'; say.innerHTML = 'No process is waiting for the printer, so there is no printer interrupt to handle.'; return; }
              const p = st.pq.shift(); st.rq.push(p);
              if (await beat(1, 'prnDone', p, `<b>Printer interrupt.</b> ${p}'s output is printed, so ${p} is ready again and joins the short-term queue.`)) await dispatch(); },
            job: async () => { if (st.lt.length >= 6) { lit(-1); say.className = 'fb'; say.innerHTML = 'The long-term queue is full in this demo. Let some processes finish first.'; return; }
              const p = 'P' + st.next++; st.lt.push(p);
              if (!(await beat(2, null, p, `New job <b>${p}</b> arrives and joins the long-term queue. ${inMem() >= CAP ? 'Memory already holds ' + CAP + ' processes; admitting more would overcommit it, so ' + p + ' must wait.' : 'There is room in memory, so it can be admitted.'}`))) return;
              if (await admit()) await dispatch(); },
          };
          function reset() { if (busy) return; st = fresh(); lit(-1); say.className = 'fb'; say.innerHTML = 'P1 is running. Fire an event on the left: every event goes to the OS, which then decides who runs next.'; draw(); }
          const group = (label, ...b) => h('div', { class: 'ctl' }, h('h4', {}, label), h('div', { class: 'row', style: { gap: '6px' } }, b));
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: 'The OS shares the processor, memory and I/O devices among many active processes. Scheduling aims at three goals:' }),
              ...[['Fairness', 'Processes competing for the same resource, especially similar jobs, get roughly equal access. <span class="t">Round-robin</span> gives every ready process a turn.'],
                ['Differential responsiveness', 'Jobs with different needs get different treatment, decided as things change: e.g. quickly run a process that is holding an I/O device, so it finishes with the device and frees it for others.'],
                ['Efficiency', 'Maximize throughput, minimize response time and, in time sharing, serve as many users as possible.']]
                .map(([t, d], j) => h('div', { class: 'card dev' }, h('span', { class: 'k', style: { background: 'var(--cpu-bg)', color: 'var(--cpu)' } }, String(j + 1)), h('div', {}, h('b', {}, t), h('span', { html: d })))),
              group('Service calls from the running process', btn('Read disk', 'proc', EV.disk), btn('Print', 'proc', EV.prn), btn('Exit', 'proc', EV.exit)),
              group('Interrupts from hardware', btn('Timer', 'intr', EV.timer), btn('Disk done', 'intr', EV.diskDone), btn('Printer done', 'intr', EV.prnDone)),
              h('div', { class: 'row', style: { gap: '6px' } }, btn('New job arrives', 'mem', EV.job), h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset'))),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'osrow' }, hEls), fitWide(ctx, svg, 600), say, stats,
              h('p', { class: 'small m0', style: { color: 'var(--ink-2)' }, html: 'Every event reaches the OS as either a <b>service call</b> (the running process asks for something) or an <b>interrupt</b> (hardware signals). After handling it, the OS decides which process runs next: here by round-robin, though many systems pick by priority instead.' }))));
          reset();
        },
      },
      /* ---------------- 9. Recap ---------------- */
      {
        title: 'Recap: the four achievements in eight cards',
        kind: 'recap',
        render(el, ctx) {
          const CARDS = [
              ['The four major achievements', 'The <b>process</b>, <b>memory management</b>, <b>information protection and security</b>, and <b>scheduling and resource management</b>.'],
              ['Four ways to define a process', 'A program in execution · an instance of a running program · the entity assigned to and executed on a processor · a unit of activity with one sequential thread, a current state and a set of resources.'],
              ['Why processes? 3 pressures, 4 bug families', 'Multiprogrammed batch, time sharing, real-time transactions. Bugs: improper synchronization, failed mutual exclusion, nondeterminate operation, deadlock.'],
              ['A process has three parts. Where do they live?', 'Program + data + execution context. Each process-list entry locates the process and saves its context; base and limit registers fence in the running process.'],
              ['Five storage-management jobs', 'Process isolation · automatic allocation and management · support of modular programming · protection and access control · long-term storage. Tools: virtual memory and file systems.'],
              ['1 KB pages. Address 5000; page 4 is in frame 2. Real address?', '5000 = 4 × 1024 + 904, so page 4, offset 904 → 2 × 1024 + 904 = <b>2952</b>. Had page 4 been on disk: a page fault.'],
              ['Four security goals', '<b>Availability</b> (there when needed) · <b>confidentiality</b> (read only by the allowed) · <b>data integrity</b> (changed only by the allowed) · <b>authenticity</b> (identity and origin are genuine).'],
              ['Scheduling: 3 goals, 3 kinds of queue', 'Fairness, differential responsiveness, efficiency. Long-term queue (new jobs not yet admitted to memory), short-term queue (ready, often round-robin), one I/O queue per device.'],
          ];
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. If one surprises you, revisit its step.'),
            ctx.ui.flipcards(CARDS.map(([f, bk]) => [f, '<div>' + bk + '</div>']), { cols: 4, height: 222 })));
        },
      },
      /* ---------------- 10. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Which of these is <b>not</b> one of the four major achievements in operating-system design?',
            choices: ['The process', 'Memory management', 'The graphical user interface', 'Scheduling and resource management'], answer: 2,
            feedback: ['The process is the first of the four achievements.', 'Memory management is one of the four.', null, 'Scheduling and resource management is one of the four.'],
            why: 'The four are the process, memory management, information protection and security, and scheduling and resource management. Graphical interfaces matter to users, but they are not on this list.' },
          { type: 'multi', q: 'Which statements are valid definitions of a <b>process</b>?',
            choices: ['A program in execution', 'The file on disk that holds a program\'s machine code', 'The entity that can be assigned to and executed on a processor', 'A unit of activity with a single sequential thread of execution, a current state and an associated set of system resources'], answer: [0, 2, 3],
            why: 'A program file on disk is passive: just instructions. It becomes a process only when it is loaded and running, with a current position, register values and resources of its own.' },
          { type: 'multi', q: 'Which developments pushed designers to invent a clean process concept?',
            choices: ['Multiprogrammed batch operation', 'Time sharing', 'Real-time transaction systems', 'Serial processing, where each user booked the whole machine and ran one program at a time'], answer: [0, 1, 2],
            why: 'All three had to switch one processor among many activities at unpredictable moments. Ad hoc switching code led to timing bugs, and the process was the cure. Serial processing ran one program at a time with no switching, so it never faced these problems.' },
          { type: 'match', q: 'Match each bug to its family of error.',
            pairs: [['Each of two programs holds one lock and waits for the other\'s', 'Deadlock'], ['Two clerks\' programs both sell seat 14C', 'Failed mutual exclusion'], ['A lost "I/O done" signal leaves a program asleep forever', 'Improper synchronization'], ['Same input, different output, depending on timing', 'Nondeterminate operation']],
            why: 'Waiting on each other forever is deadlock. Two programs in a shared record at once is failed mutual exclusion. A lost or badly handled signal is improper synchronization. Results that depend on interleaving are nondeterminate.' },
          { type: 'order', q: 'Put the steps of a switch from process A to process B in order.',
            items: ['An interrupt hands control to the OS', 'The OS saves A\'s context (PC and other registers) in A\'s process-list entry', 'The OS chooses B as the next process to run', 'The OS loads B\'s saved context into the registers, including base and limit', 'B carries on exactly where it last stopped'],
            why: 'Control must reach the OS first; A\'s context is saved before anything overwrites the registers; then the OS picks B and restores B\'s context, so B resumes seamlessly.' },
          { type: 'tf', q: 'When the OS switches from process A to process B, it copies A\'s program code and data out of main memory to make room for B.', answer: false,
            why: 'A context switch saves and reloads only a few register values (the execution context). Code and data stay where they are in memory.' },
          { type: 'num', q: 'A running process has base register = 4000 and limit register = 500. What is the <b>largest</b> address, counted from the start of its block, that it may use?', answer: 499, tol: 0,
            why: 'The block covers relative addresses 0 to 499 (real addresses 4000 to 4499). Any address of 500 or more reaches the limit, so the hardware refuses it and interrupts the OS.' },
          { type: 'bucket', q: 'Which tool mainly meets each memory-management need?', buckets: ['Virtual memory', 'File system'],
            items: [['Keeping one process out of another\'s memory', 0], ['Giving a program more memory while it runs', 0], ['Keeping a report after the power is switched off', 1], ['Letting a module grow or shrink while the program runs', 0], ['Storing information under a name so it can be found next month', 1]],
            why: 'Virtual memory handles isolation, automatic allocation and modular programming while programs run. Long-term, named storage that survives power-off is the file system\'s job.' },
          { type: 'num', q: 'Pages are 1,024 bytes. A program uses virtual address 3000, and the page table maps that page to frame 7. What real address does the MMU produce?', answer: 8120, tol: 0,
            why: '3000 = 2 × 1024 + 952, so page 2, offset 952. Page 2 is in frame 7, so the real address is 7 × 1024 + 952 = 7168 + 952 = 8120.' },
          { q: 'A program uses an address whose page the page table marks as <b>on disk</b>. What happens next?',
            choices: ['The processor reads the byte straight from the disk', 'The MMU raises a page fault; the OS loads the page into a frame, updates the page table, and the instruction is retried', 'The program is always terminated for a bounds violation', 'The MMU uses the virtual address as the real address'], answer: 1,
            feedback: ['The processor can only reach main memory directly; the page must be brought in first.', null, 'The address is legal, the page is just not in memory yet. Only addresses outside the program lead to termination.', 'That would land on some other process\'s memory. The MMU never skips translation.'],
            why: 'A page fault is an interrupt: the OS fetches the missing page from disk (sending another page back if no frame is free), fixes the table, and the instruction restarts.' },
          { type: 'match', q: 'Match each security incident to the goal it breaks.',
            pairs: [['A flood of fake requests keeps real users off a web server', 'Availability'], ['A stranger reads an unencrypted backup of patient records', 'Confidentiality'], ['Malware changes the numbers in a company\'s accounts', 'Data integrity'], ['An attacker logs in with a stolen password and is treated as the owner', 'Authenticity']],
            why: 'Availability is about access to service; confidentiality about who can read; integrity about who can change; authenticity about genuine identity and origin.' },
          { type: 'match', q: 'Match each scheduling term to its meaning.',
            pairs: [['Fairness', 'Competing processes get roughly equal access'], ['Differential responsiveness', 'Jobs with different needs are treated differently'], ['Efficiency', 'High throughput, quick response, many users served'], ['Long-term queue', 'New jobs not yet admitted to main memory'], ['Short-term queue', 'Ready processes in memory, often served round-robin']],
            why: 'The three goals guide the choices; the queues are where waiting processes sit. I/O queues, one per device, hold processes waiting for that device.' },
        ],
      },
    ],

    notes: `
      <h3>The four major achievements</h3>
      <p>Serving many programs and users at once forced four ideas every modern OS rests on:</p>
      <ul>
        <li><b>The process</b>: programs take turns on one processor without losing their place.</li>
        <li><b>Memory management</b>: each program gets its own memory, safe from others.</li>
        <li><b>Information protection and security</b>: everyone reaches only what they are allowed to.</li>
        <li><b>Scheduling and resource management</b>: the OS decides who runs next, for how long, and who gets each device.</li>
      </ul>

      <h3>What a process is</h3>
      <p>Four definitions, one idea seen from different angles:</p>
      <ol>
        <li><b>A program in execution.</b> A program is a passive file of instructions; it becomes a process once it is loaded and running.</li>
        <li><b>An instance of a program running on a computer.</b> One program can run as several processes, each with its own data and position.</li>
        <li><b>The entity that can be assigned to and executed on a processor.</b> The scheduler's view: the thing it hands the processor to.</li>
        <li><b>A unit of activity characterized by a single sequential thread of execution, a current state and an associated set of system resources.</b> Thread = the path the PC walks through the code; state = the context; resources = memory, files, devices.</li>
      </ol>

      <h3>Why the process concept was needed</h3>
      <p>Three developments all had to switch one processor among many activities, at moments chosen by interrupts rather than by the programs:</p>
      <ul>
        <li><b>Multiprogrammed batch operation</b>: keep the processor and devices busy by switching jobs when one waits for I/O.</li>
        <li><b>Time sharing</b>: answer many interactive users quickly by giving each a short turn in rotation.</li>
        <li><b>Real-time transaction systems</b>: many users query and update one shared database (e.g. airline seats) and expect answers in seconds.</li>
      </ul>
      <p>Case-by-case switching code, with no clean model of a half-finished program, produced timing bugs in four families:</p>
      <table>
        <tr><th>Error</th><th>What goes wrong</th><th>Example</th></tr>
        <tr><td>Improper synchronization</td><td>A program waits for a signal from another activity, and the signal is lost, duplicated or not waited for.</td><td>A lost "disk done" signal leaves a program asleep forever.</td></tr>
        <tr><td>Failed mutual exclusion</td><td>Two programs use a shared resource at the same time when only one should.</td><td>Two clerks both read "seat 14C free" and both sell it.</td></tr>
        <tr><td>Nondeterminate program operation</td><td>Results depend on how programs happen to interleave, not only on the input.</td><td>Same input, different totals on different days.</td></tr>
        <tr><td>Deadlock</td><td>Programs each hold something and wait for what another holds, so none can continue.</td><td>A holds the disk, wants the printer; B holds the printer, wants the disk.</td></tr>
      </table>

      <h3>The parts of a process and how the OS stores them</h3>
      <p>A process has three parts: an <b>executable program</b>, the <b>associated data</b> it works on, and its <b>execution context</b> (or process state): what the OS needs to pause it and resume it exactly where it stopped, such as register values, the program counter, priority and whether it awaits I/O.</p>
      <p>A typical implementation:</p>
      <ul>
        <li>The OS keeps a <b>process list</b> with one entry per process. The entry points to the process's memory block and holds part or all of its saved context (the rest can live with the process).</li>
        <li>Each process owns a block of memory holding its program and data.</li>
        <li>Processor registers describe the running process: the <b>process index</b> (which list entry is running), the <b>program counter</b> (next instruction, counted from the start of the block), the <b>base register</b> (start address of the block) and the <b>limit register</b> (size of the block).</li>
        <li>Each address must be less than the limit, and is added to the base. With base 2000 and limit 600, addresses 0–599 are legal: 3 becomes 2003, while 650 is refused and the OS is interrupted.</li>
      </ul>
      <p><b>Switching from A to B:</b> an interrupt gives the OS control; it saves A's context in A's entry, chooses B, and loads B's context (including base and limit) into the registers. B resumes where it stopped; no program or data is copied, only register values.</p>
      <h3>Memory management: five responsibilities</h3>
      <ol>
        <li><b>Process isolation</b>: stop processes from reading or changing each other's instructions and data.</li>
        <li><b>Automatic allocation and management</b>: hand out and reclaim memory as needed; programmers never pick physical locations.</li>
        <li><b>Support of modular programming</b>: modules can be created, removed or resized as the program runs.</li>
        <li><b>Protection and access control</b>: allow useful sharing (one library copy for all) while controlling who may read, write or run each piece of memory and each file.</li>
        <li><b>Long-term storage</b>: keep information for long periods, after programs end and the power is off.</li>
      </ol>
      <p>Two tools meet these needs. <b>Virtual memory</b> lets each program address memory logically, whatever the real memory size or layout (jobs 1 to 4). Many processes can then share memory, and a program can even be larger than main memory. The <b>file system</b> keeps information in named files on secondary storage (jobs 4 and 5).</p>

      <h3>Paging and virtual-memory addressing</h3>
      <p><b>Paging</b> divides every process into equal, fixed-size <b>pages</b> and main memory into same-size <b>page frames</b>. A page can sit in any free frame or stay on disk until needed, so a program's pieces need not be side by side. Each process has a <b>page table</b> recording, for every page, the frame that holds it or that it is on disk. A <b>virtual address</b> is a page number plus an offset within that page:</p>
      <pre>page   = address ÷ page size  (whole part)
offset = address − page × page size
real   = frame × page size + offset</pre>
      <p><b>Worked example</b> (1,024-byte pages): virtual address 5000 = 4 × 1024 + 904, so page 4, offset 904. If the page table says page 4 is in frame 2, the real address is 2 × 1024 + 904 = <b>2952</b>. Since 1,024 = 2<sup>10</sup>, the hardware just splits the address: the low 10 bits are the offset, the rest the page number.</p>
      <p>The processor issues virtual addresses; the <b>memory management unit (MMU)</b> translates each one using the page table. If the page is in main memory, the result is a <b>real address</b> in main memory. If the page is on disk, it leads to a disk address instead: the MMU raises a <b>page fault</b>; the OS blocks the process, reads the page into a free frame (if none is free, it first evicts a page, e.g. the one in memory longest), updates the table, and the instruction is retried. An address beyond the last page is an error that stops the program.</p>
      <svg viewBox="0 0 520 110" width="100%">
        <rect x="0" y="0" width="520" height="110" rx="8" fill="#ffffff"/>
        <rect x="6" y="30" width="96" height="44" rx="8" fill="#e1eaff" stroke="#2563eb"/><text style="fill:#151c2c" x="54" y="57" text-anchor="middle" font-size="13">Processor</text>
        <line x1="102" y1="52" x2="182" y2="52" stroke="#3d4760" stroke-width="2"/><text style="fill:#151c2c" x="142" y="44" text-anchor="middle" font-size="11">virtual address</text>
        <rect x="182" y="30" width="96" height="44" rx="8" fill="#e1eaff" stroke="#2563eb"/><text style="fill:#151c2c" x="230" y="57" text-anchor="middle" font-size="13">MMU</text>
        <line x1="278" y1="44" x2="378" y2="20" stroke="#059669" stroke-width="2"/><text style="fill:#151c2c" x="318" y="22" text-anchor="middle" font-size="11">real address</text>
        <rect x="378" y="4" width="136" height="34" rx="8" fill="#d7f5e8" stroke="#059669"/><text style="fill:#151c2c" x="446" y="26" text-anchor="middle" font-size="13">Main memory</text>
        <line x1="278" y1="62" x2="378" y2="88" stroke="#ea580c" stroke-width="2"/><text style="fill:#151c2c" x="318" y="94" text-anchor="middle" font-size="11">disk address</text>
        <rect x="378" y="70" width="136" height="34" rx="8" fill="#ffe8d6" stroke="#ea580c"/><text style="fill:#151c2c" x="446" y="92" text-anchor="middle" font-size="13">Secondary memory</text>
      </svg>

      <h3>Information protection and security</h3>
      <p>The OS must control access to shared programs, data and devices. Four goals:</p>
      <ul>
        <li><b>Availability</b>: the system and its data are usable whenever authorized users need them (broken by a flood of fake requests).</li>
        <li><b>Confidentiality</b>: only those with permission can read the data (broken by a stolen unencrypted laptop).</li>
        <li><b>Data integrity</b>: data is changed only by those allowed to (broken by malware altering records).</li>
        <li><b>Authenticity</b>: users are who they claim and messages come from where they say (broken by a forged email).</li>
      </ul>
      <p>Common mistake: <i>reading</i> data you should not breaks confidentiality; <i>changing</i> it breaks integrity.</p>

      <h3>Scheduling and resource management</h3>
      <p>The OS shares the processor, memory and devices among active processes, aiming at three goals:</p>
      <ul>
        <li><b>Fairness</b>: processes competing for the same resource, especially jobs of the same kind, get roughly equal and fair access.</li>
        <li><b>Differential responsiveness</b>: jobs with different needs get different treatment, decided as conditions change; e.g. quickly run a process that holds an I/O device so it frees the device for others.</li>
        <li><b>Efficiency</b>: maximize throughput, minimize response time and, in time sharing, serve as many users as possible.</li>
      </ul>
      <p>Key elements of a typical scheduler:</p>
      <ul>
        <li><b>Long-term queue</b>: new jobs waiting to be admitted. Admission gives a job main memory, so the OS admits jobs only when that will not overcommit memory or the processor.</li>
        <li><b>Short-term queue</b>: processes in main memory and ready to run. The short-term scheduler (dispatcher) picks the next one, often by <b>round-robin</b>: each gets a short time slice in turn, and a process whose slice ends goes to the back of the line. Another common policy picks by priority.</li>
        <li><b>I/O queues</b>: one per device, holding processes waiting for that device.</li>
        <li>Every event reaches the OS as a <b>service call</b> (the running process asks, e.g. to read the disk or exit) or an <b>interrupt</b> (timer or device); then the OS picks who runs next.</li>
      </ul>
    `,
  });
})();
