/* Section 2.1 — Operating System Objectives and Functions
   Original teaching material. Built step by step. */
Guide.section({
  id: '2.1',
  title: 'Operating System Objectives and Functions',
  short: 'OS objectives',
  summary: 'What an OS is for: its three goals, the services it offers, the ISA/ABI/API, and how it manages resources.',
  objectives: [
    'Define an operating system and explain its three objectives: convenience, efficiency and the ability to evolve.',
    'Describe the layered view of a computer system and name the seven kinds of service an OS provides.',
    'Tell the ISA, ABI and API apart, and use them to predict whether a program will run on another machine as a binary or after recompiling.',
    'Explain how the OS manages resources even though it is itself a program that must give up the processor and win it back.',
    'Explain why an OS must keep evolving and why that calls for modular construction with clear interfaces and good documentation.',
  ],
  terms: [
    ['Operating system (OS)', 'A program that controls the execution of application programs and acts as the go-between for those programs and the computer hardware.'],
    ['Convenience', 'The first objective of an OS: make the computer easier to use by hiding hardware details behind simple services.'],
    ['Efficiency', 'The second objective of an OS: keep the processor, memory and devices doing useful work instead of sitting idle or being wasted.'],
    ['Ability to evolve', 'The third objective of an OS: be built so that new hardware, new services and fixes can be added without getting in the way of the services it already provides.'],
    ['Utilities', 'System programs that come with the OS, such as editors, compilers, debuggers, command shells and file tools. They help people build programs and run the computer, but they are not the kernel itself.'],
    ['Library', 'A collection of ready-made routines (for example the C standard library, with fopen and printf) that programs call instead of writing that code themselves. Many library routines make system calls on the program\'s behalf.'],
    ['Instruction set architecture (ISA)', 'The complete set of machine instructions a processor can carry out. It is the boundary between hardware and software.'],
    ['User ISA', 'The part of the instruction set that any program may use: arithmetic, comparisons, jumps, loads and stores.'],
    ['System ISA', 'The privileged part of the instruction set, such as instructions that control interrupts, memory-management hardware or I/O. Only the OS may use it.'],
    ['Application binary interface (ABI)', 'The rules a compiled (binary) program follows to use a system: the system call interface to the OS plus the user ISA, including details such as how arguments are passed. Systems with the same ABI run the same binary unchanged.'],
    ['Application programming interface (API)', 'The set of calls a program\'s source code may use: library routines and OS services, on top of the user ISA. Source code written to an API moves to another system with the same API by recompiling it.'],
    ['System call', 'A request from a running program to the OS for a service, such as reading a file. A special instruction switches the processor into the OS to handle it.'],
    ['Kernel (nucleus)', 'The part of the OS that stays in main memory all the time and holds its most frequently used functions.'],
    ['Resource manager', 'The view of the OS as the part of the system that decides how the processor, main memory, I/O devices and files are shared among programs.'],
    ['Dispatch', 'To hand the processor to a chosen program by loading its saved state and jumping to its next instruction.'],
    ['Device driver', 'The part of the OS that knows the exact commands for one kind of device and turns general requests such as read or write into those commands.'],
    ['Accounting', 'The OS service that records how much of each resource is used, for tuning performance, planning upgrades and, on shared systems, billing users.'],
    ['Portability', 'How easily software moves to a different machine or OS. Binary portability: the compiled program runs unchanged. Source portability: the source code only needs recompiling.'],
    ['Module', 'A self-contained part of a program or OS that hides its insides and is used only through a clearly defined, documented interface.'],
  ],

  css: `
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width */
    .sec-2-1 .step-eyebrow { contain: inline-size; }
    .sec-2-1 .hot { cursor: pointer; }
    /* step 1: objectives */
    .sec-2-1 .obj-tiles { gap: 10px; }
    .sec-2-1 .obj-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; padding: 10px 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel-2); cursor: pointer; color: var(--ink); font: inherit; }
    .sec-2-1 .obj-tile:hover { border-color: var(--chc); }
    .sec-2-1 .obj-tile.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); }
    .sec-2-1 .obj-n { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--panel-3); font-weight: 800; font-size: 14px; }
    .sec-2-1 .obj-tile.on .obj-n { background: var(--chc); color: var(--panel); }
    .sec-2-1 .obj-name { font-weight: 800; font-size: 17px; line-height: 1.25; }
    .sec-2-1 .obj-tag { font-size: 13.5px; color: var(--muted); line-height: 1.3; }
    .sec-2-1 .obj-detail { display: flex; flex-direction: column; gap: 10px; }
    .sec-2-1 .obj-ww { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .sec-2-1 .obj-w { border-radius: 10px; padding: 9px 12px; border-left: 5px solid; }
    .sec-2-1 .obj-w.bad { background: var(--bad-bg); border-color: var(--bad); }
    .sec-2-1 .obj-w.ok { background: var(--ok-bg); border-color: var(--ok); }
    .sec-2-1 .obj-w > b { display: block; font-size: 12.5px; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 3px; }
    .sec-2-1 .obj-w.bad > b { color: var(--bad); } .sec-2-1 .obj-w.ok > b { color: var(--ok); }
    .sec-2-1 .obj-how { padding: 7px 12px; border-radius: 10px; background: var(--os-bg); }
    @media (max-width: 760px) { .sec-2-1 .obj-ww { grid-template-columns: 1fr; } }
    /* step 2: layer cake */
    .sec-2-1 .lay-split { grid-template-columns: minmax(0, 11fr) minmax(0, 12fr); }
    .sec-2-1 .lay-stack { display: flex; flex-direction: column; }
    .sec-2-1 .lay { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 76px; padding: 8px 14px; border: 2px solid var(--line-2); border-radius: 12px; background: var(--panel-2); cursor: pointer; transition: opacity .2s, box-shadow .2s; }
    .sec-2-1 .lay:hover { box-shadow: 0 0 0 2px color-mix(in srgb, var(--chc) 45%, transparent); }
    .sec-2-1 .lay-nm { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
    .sec-2-1 .lay-nm b { font-size: 17px; }
    .sec-2-1 .lay.c-user { border-style: dashed; }
    .sec-2-1 .lay.c-proc { border-color: var(--proc); background: var(--proc-bg); }
    .sec-2-1 .lay.c-util { border-color: var(--accent); background: var(--accent-bg); }
    .sec-2-1 .lay.c-os { border-color: var(--os); background: var(--os-bg); }
    .sec-2-1 .lay.c-hw { border-color: var(--cpu); background: var(--cpu-bg); }
    .sec-2-1 .lay.dim { opacity: .33; }
    .sec-2-1 .lay.sel { box-shadow: 0 0 0 3px var(--chc); }
    .sec-2-1 .lay.act { box-shadow: 0 0 0 4px var(--hl); }
    .sec-2-1 .lay-role { flex: none; font-size: 13px; font-weight: 800; padding: 2px 10px; border-radius: 999px; background: var(--panel); color: var(--chc); border: 1.5px solid var(--chc); white-space: nowrap; }
    .sec-2-1 .lay-gap { height: 34px; display: flex; align-items: center; gap: 10px; padding-left: 24px; }
    .sec-2-1 .lay-gap .ar { color: var(--muted); font-weight: 800; }
    .sec-2-1 .lay-gap .msg { font: 700 13px var(--mono); padding: 1px 10px; border-radius: 999px; background: var(--hl); color: var(--ink); }
    .sec-2-1 .lay-gap .msg:empty { display: none; }
    .sec-2-1 .lay-gap.on .ar { color: var(--chc); }
    .sec-2-1 .lay-info { min-height: 84px; }
    /* step 3: services */
    .sec-2-1 .svc-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: 1fr 1fr; gap: 10px; height: 100%; }
    .sec-2-1 .svc-card { display: flex; flex-direction: column; gap: 6px; }
    .sec-2-1 .svc-card.svc-wide { grid-column: span 2; }
    .sec-2-1 .svc-h { display: flex; align-items: center; gap: 8px; line-height: 1.25; }
    .sec-2-1 .svc-n { flex: none; display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--os-bg); color: var(--os); font-size: 13px; font-weight: 800; }
    .sec-2-1 .svc-ex { margin-top: auto !important; padding-top: 5px; border-top: 1px dashed var(--line-2); }
    .sec-2-1 .svc-game { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 22px; height: 100%; }
    .sec-2-1 .svc-qcard { min-height: 132px; display: flex; align-items: center; }
    .sec-2-1 .svc-q { font-size: 19px; line-height: 1.45; font-weight: 600; }
    .sec-2-1 .svc-fb { min-height: 128px; padding: 11px 14px; border-radius: 12px; border: 1px solid var(--line); border-left: 5px solid var(--line-2); background: var(--panel-2); font-size: 15.5px; line-height: 1.5; }
    .sec-2-1 .svc-fb.ok { background: var(--ok-bg); border-left-color: var(--ok); }
    .sec-2-1 .svc-fb.ok .b { color: var(--ok); }
    .sec-2-1 .svc-fb.bad { background: var(--bad-bg); border-left-color: var(--bad); }
    .sec-2-1 .svc-fb.bad .b { color: var(--bad); }
    .sec-2-1 .svc-btn { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; text-align: left; padding: 7px 12px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); font: 650 15.5px var(--font); color: var(--ink); cursor: pointer; }
    .sec-2-1 .svc-btn:hover:not(:disabled) { border-color: var(--chc); }
    .sec-2-1 .svc-btn.right { border-color: var(--ok); background: var(--ok-bg); }
    .sec-2-1 .svc-btn.wrong { border-color: var(--bad); background: var(--bad-bg); }
    .sec-2-1 .svc-btn:disabled { cursor: default; }
    .sec-2-1 .svc-btn:disabled:not(.right):not(.wrong) { opacity: .5; }
    .sec-2-1 .svc-pill { width: 14px; height: 14px; border-radius: 4px; background: var(--panel-3); border: 1px solid var(--line-2); }
    .sec-2-1 .svc-pill.ok { background: var(--ok); border-color: var(--ok); }
    .sec-2-1 .svc-pill.late { background: var(--warn); border-color: var(--warn); }
    .sec-2-1 .svc-pill.cur { outline: 2px solid var(--chc); outline-offset: 1px; }
    /* step 4: interfaces */
    .sec-2-1 .if-split { grid-template-columns: minmax(0, 14fr) minmax(0, 11fr); gap: 20px; }
    .sec-2-1 .if-code td.mono { white-space: nowrap; font-size: 13.5px; }
    .sec-2-1 .if-code td { font-size: 14px; }
    .sec-2-1 .if-code th:first-child { white-space: normal; }
    .sec-2-1 .if-code tr.ok td { background: var(--ok-bg); }
    .sec-2-1 .if-code tr.bad td { background: var(--bad-bg); }
    .sec-2-1 .if-code tr.cur td { background: color-mix(in srgb, var(--chc) 14%, var(--panel)); }
    .sec-2-1 .if-wrap { display: grid; place-items: center; padding: 8px 10px; }
    .sec-2-1 .if-ln { stroke: var(--line-2); stroke-width: 3; stroke-dasharray: 7 6; transition: stroke .2s, stroke-width .2s; }
    .sec-2-1 .if-ln.thick { stroke-width: 5; stroke-dasharray: none; stroke: var(--ink-2); }
    .sec-2-1 .if-ln.on { stroke: var(--chc); stroke-width: 7; stroke-dasharray: none; }
    .sec-2-1 .if-lane { fill: var(--panel-2); stroke: var(--line-2); stroke-dasharray: 6 5; transition: fill .2s, stroke .2s; }
    .sec-2-1 .if-lane.on { fill: color-mix(in srgb, var(--chc) 14%, var(--panel)); stroke: var(--chc); stroke-width: 3; stroke-dasharray: none; }
    .sec-2-1 .if-tag { fill: var(--panel); stroke: var(--ink-2); stroke-width: 1.5; }
    .sec-2-1 .hot:hover .if-tag, .sec-2-1 .hot:focus-visible .if-tag { stroke: var(--chc); stroke-width: 3; }
    .sec-2-1 .if-card { min-height: 0; }
    .sec-2-1 .if-card .tbl td:first-child { width: 96px; white-space: nowrap; }
    .sec-2-1 .if-real { padding: 6px 12px; border-radius: 10px; border-left: 4px solid var(--chc); background: var(--panel-2); line-height: 1.4; }
    /* step 5: portability */
    .sec-2-1 .port-tbl th { vertical-align: middle; font-size: 12px; line-height: 1.9; }
    .sec-2-1 .port-tbl th .chip { text-transform: none; letter-spacing: 0; }
    .sec-2-1 .port-tbl td { vertical-align: middle; }
    .sec-2-1 .port-tbl td:first-child { line-height: 1.25; }
    .sec-2-1 .port-cell { width: 100%; min-width: 74px; height: 38px; border-radius: 9px; border: 2px dashed var(--line-2); background: var(--panel); font: 800 15px var(--font); color: var(--muted); cursor: pointer; }
    .sec-2-1 .port-cell:hover { border-color: var(--chc); color: var(--chc); }
    .sec-2-1 .port-cell.ok { border: 2px solid var(--ok); background: var(--ok-bg); color: var(--ok); }
    .sec-2-1 .port-cell.bad { border: 2px solid var(--bad); background: var(--bad-bg); color: var(--bad); }
    .sec-2-1 .port-cell.sel { box-shadow: 0 0 0 3px var(--chc); }
    .sec-2-1 .port-detail { flex: 1; min-height: 0; }
    .sec-2-1 .port-fork { margin-top: auto !important; padding: 6px 10px; border-radius: 8px; background: var(--panel-2); border: 1px dashed var(--line-2); line-height: 1.4; }
    .sec-2-1 .btn.ok-b { border-color: var(--ok); color: var(--ok); }
    .sec-2-1 .btn.bad-b { border-color: var(--bad); color: var(--bad); }
    .sec-2-1 .port-verdict { font-weight: 800; font-size: 17px; padding: 5px 12px; border-radius: 10px; white-space: pre-wrap; }
    .sec-2-1 .port-verdict.ok { background: var(--ok-bg); color: var(--ok); }
    .sec-2-1 .port-verdict.bad { background: var(--bad-bg); color: var(--bad); }
    .sec-2-1 .port-checks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .sec-2-1 .port-check { display: flex; flex-direction: column; padding: 5px 10px; border-radius: 10px; border: 2px solid var(--line); font-size: 13.5px; line-height: 1.3; }
    .sec-2-1 .port-check b { font-size: 15px; }
    .sec-2-1 .port-check.ok { border-color: var(--ok); } .sec-2-1 .port-check.ok span { color: var(--ok); font-weight: 700; }
    .sec-2-1 .port-check.bad { border-color: var(--bad); } .sec-2-1 .port-check.bad span { color: var(--bad); font-weight: 700; }
    .sec-2-1 .port-check.na { border-style: dashed; } .sec-2-1 .port-check.na span { color: var(--muted); }
    /* step 6: resource manager */
    .sec-2-1 .rm-grid { display: grid; grid-template-columns: minmax(0, 1fr) 316px; gap: 16px; min-height: 0; }
    .sec-2-1 .rm-main { padding: 8px 12px 10px; display: flex; flex-direction: column; gap: 6px; }
    .sec-2-1 .rm-strip-row { gap: 10px; }
    .sec-2-1 .rm-what { margin-top: auto; gap: 12px; align-items: center; }
    .sec-2-1 .rm-strip { flex: 1; display: grid; grid-template-columns: repeat(11, minmax(0, 1fr)); gap: 4px; }
    .sec-2-1 .rm-cell { height: 26px; border-radius: 6px; border: 1.5px dashed var(--line-2); display: grid; place-items: center; font: 800 12.5px var(--mono); }
    .sec-2-1 .rm-cell.os { border: 1.5px solid var(--os); background: var(--os-bg); color: var(--os); }
    .sec-2-1 .rm-cell.proc { border: 1.5px solid var(--proc); background: var(--proc-bg); color: var(--proc); }
    .sec-2-1 .rm-cell.now { box-shadow: 0 0 0 3px var(--hl); }
    .sec-2-1 .rm-res { display: grid; grid-template-columns: 112px minmax(0, 1fr); align-items: center; gap: 8px; line-height: 1.25; padding: 4px 8px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); transition: border-color .2s, background .2s; }
    .sec-2-1 .rm-res.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 9%, var(--panel)); }
    .sec-2-1 .rm-res .chip { justify-self: start; }
    .sec-2-1 .rm-ev { font-size: 14.5px; padding: 4px 10px; border-radius: 10px; background: var(--panel-2); border: 1px dashed var(--line-2); }
    .sec-2-1 .rm-ev.hot-ev { background: var(--intr-bg); border: 1px solid var(--intr); }
    .sec-2-1 .rm-wrap .player-cap { min-height: 3.1em; }
    /* step 7: evolution */
    .sec-2-1 .evo-r { display: flex; flex-direction: column; gap: 1px; padding: 7px 12px; border-left: 4px solid var(--chc); background: var(--panel-2); border-radius: 10px; line-height: 1.35; }
    .sec-2-1 .evo-btns { gap: 8px; }
    .sec-2-1 .evo-btn { display: flex; flex-direction: column; align-items: flex-start; gap: 0; text-align: left; padding: 5px 12px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); font: 650 15px var(--font); color: var(--ink); cursor: pointer; line-height: 1.3; }
    .sec-2-1 .evo-btn:hover { border-color: var(--chc); }
    .sec-2-1 .evo-btn.done { border-color: color-mix(in srgb, var(--chc) 45%, var(--line)); }
    .sec-2-1 .evo-btn.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); }
    .sec-2-1 .evo-panel { display: flex; flex-direction: column; gap: 4px; }
    .sec-2-1 .evo-count { color: var(--ink-2); }
    .sec-2-1 .evo-why { font-size: 14.5px; line-height: 1.45; min-height: 92px; }
    .sec-2-1 .evo-board { padding: 8px 12px; border-radius: 10px; border: 1px dashed var(--line-2); background: var(--panel-2); line-height: 1.45; }
    .sec-2-1 .evo-board.full { border: 1px solid var(--ok); background: var(--ok-bg); }
    @media (max-width: 760px) {
      .sec-2-1 .svc-grid, .sec-2-1 .svc-game { grid-template-columns: 1fr; grid-template-rows: none; height: auto; }
      .sec-2-1 .svc-card.svc-wide { grid-column: auto; }
      .sec-2-1 .rm-grid { grid-template-columns: minmax(0, 1fr); }
      .sec-2-1 .rm-strip-row { flex-wrap: wrap; }
      .sec-2-1 .rm-strip { flex: 1 1 100%; gap: 2px; }
      .sec-2-1 .port-tbl td:first-child .xs { font-size: 11px; line-height: 1.2; }
      .sec-2-1 .port-tbl { table-layout: fixed; }
      .sec-2-1 .port-tbl th:first-child { width: 74px; }
      .sec-2-1 .port-tbl th, .sec-2-1 .port-tbl td { padding: 4px 3px; }
      .sec-2-1 .port-tbl th .chip { font-size: 11px; padding: 0 4px; }
      .sec-2-1 .port-tbl th:first-child { font-size: 10.5px; }
      .sec-2-1 .port-tbl td:first-child { font-size: 13px; }
      .sec-2-1 .port-cell { min-width: 0; font-size: 13px; }
      .sec-2-1 .port-checks { grid-template-columns: minmax(0, 1fr); }
    }
  `,

  steps: [
    /* ---------------- 1. Big picture: what an OS is for ---------------- */
    {
      title: 'What is an operating system for?',
      kind: 'story',
      render(el, ctx) {
        const { h } = ctx;
        const GOALS = [
          { key: 'conv', name: 'Convenience', term: 'Convenience', tag: 'Easy to use',
            without: 'To save one paragraph, your program would need your SSD\'s exact command codes, pick free storage blocks itself and poll the device until it finished. Every program would repeat that work for every device model.',
            with: 'Your program says “write these bytes to essay.txt”. The OS deals with the device, the free space and the waiting, and the same request works on any drive.',
            how: 'Simple services and interfaces: files instead of disk blocks, windows instead of pixels, connections instead of network packets.' },
          { key: 'eff', name: 'Efficiency', term: 'Efficiency', tag: 'Use hardware well',
            without: 'A program computes for 2 ms, then waits 8 ms for the disk, over and over. Run alone, the processor is idle 8 ms of every 10 ms: <b>80% of its time wasted</b>. Memory holds one program even though there is room for several.',
            with: 'During those 8 ms of waiting, the OS hands the processor to another program, so the idle time is put to use. Memory is divided so several programs fit at once, and devices work in parallel with the processor.',
            how: 'Deciding which program gets the processor, how much memory, and which device, and when. That is the OS as resource manager.' },
          { key: 'evo', name: 'Ability to evolve', term: 'Ability to evolve', tag: 'Keep up with change',
            without: 'Plug in a new kind of graphics card and nothing can use it until the whole OS is rewritten. Every bug fix risks breaking some unrelated part, so fixes are rare and scary.',
            with: 'A new driver or a new service slots in behind an interface that does not change, so existing programs keep working. Fixes ship as routine updates.',
            how: 'Building the OS from modules with clearly defined interfaces, and documenting them well.' },
        ];
        let cur = 0;
        const tiles = GOALS.map((g, i) => h('button', { type: 'button', class: 'obj-tile', 'aria-label': 'Objective ' + (i + 1) + ': ' + g.name, onclick: () => pick(i) },
          h('span', { class: 'obj-n' }, String(i + 1)),
          h('span', { class: 'obj-name' }, g.name),
          h('span', { class: 'obj-tag' }, g.tag)));
        const detail = h('div', { class: 'card white obj-detail', 'aria-live': 'polite' });
        function pick(i) {
          cur = i;
          tiles.forEach((t, j) => t.classList.toggle('on', j === i));
          const g = GOALS[i];
          detail.replaceChildren(
            h('h3', { html: `Objective ${i + 1}: <span class="t" data-t="${g.term}">${g.name}</span>` }),
            h('div', { class: 'obj-ww' },
              h('div', { class: 'obj-w bad' }, h('b', {}, 'Without an OS taking care of it'), h('p', { class: 'small m0', html: g.without })),
              h('div', { class: 'obj-w ok' }, h('b', {}, 'With the OS doing its job'), h('p', { class: 'small m0', html: g.with }))),
            h('p', { class: 'small m0 obj-how', html: '<b>How the OS gets there:</b> ' + g.how }));
          detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');
        }
        const left = h('div', { class: 'stack' },
          h('p', { class: 'lead m0', html: 'An <span class="t">operating system</span> is a program that <b>controls the execution of application programs</b> and acts as the <b>go-between</b> for those programs and the computer hardware.' }),
          h('p', { class: 'm0', html: 'Almost every design decision inside an OS serves one of three objectives. Click each one ' + (ctx.narrow ? 'below' : 'on the right') + ' to see what a computer would be like without it.' }),
          h('div', { class: 'callout analogy m0', 'data-label': 'Analogy: a big public library', html: 'The front desk lets you borrow any book just by asking, without learning how the stacks are shelved (<b>convenience</b>). Staff keep study rooms and computers booked so none sit empty while people wait (<b>efficiency</b>). Over the years the library adds e-books and a maker space without ever closing its doors (<b>ability to evolve</b>).' }),
          h('div', { class: 'stack gap-s' },
            h('h4', { class: 'm0' }, 'Coming up in this section'),
            h('div', { class: 'row gap-s' }, ...['the layers of a system', 'seven OS services', 'ISA · ABI · API', 'the OS as resource manager', 'built to change'].map((t) => h('span', { class: 'chip os' }, t)))));
        const right = h('div', { class: 'stack' },
          h('div', { class: 'grid-3 obj-tiles' }, ...tiles),
          detail,
          h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'The goals can pull against each other: a slick graphical interface (convenience) costs processor time and memory (efficiency). OS design is largely about balance.' }));
        el.append(h('div', { class: 'split l fill' }, left, right));
        pick(0);
      },
    },

    /* ---------------- 2. Layers, viewpoints and a request that travels through them ---------------- */
    {
      title: 'The OS as a user/computer interface: the layers',
      kind: 'explore',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h } = ctx;
        const LAYERS = [
          { id: 'user', name: 'End user', sub: 'the person at the screen', col: 'user',
            d: 'The person using the computer. An end user sees the machine only through applications and never needs to know how the hardware works.' },
          { id: 'apps', name: 'Application programs', sub: 'browser, spreadsheet, game', col: 'proc',
            d: 'Programs that do a job for the user. They are written against the services of the layers below, not against raw hardware, so they do not care which disk or screen is attached.' },
          { id: 'utils', name: 'Utilities and libraries', sub: 'editors, compilers, debuggers, shells, file tools', col: 'util',
            d: '<span class="t">Utilities</span> are system programs that ship with the OS. They help people build programs, manage files and control devices. <span class="t">Libraries</span> hold ready-made routines programs call. Useful, but not the kernel itself.' },
          { id: 'os', name: 'Operating system', sub: 'controls the hardware, offers services upward', col: 'os',
            d: 'Controls the hardware and offers services to everything above: running programs, files, device access, protection, error handling. It hides the messy hardware details behind those services.' },
          { id: 'hw', name: 'Computer hardware', sub: 'processor, memory, I/O devices, storage', col: 'hw',
            d: 'The physical machine. It understands only machine instructions and device commands, nothing as friendly as a “file” or a “window”.' },
        ];
        const VIEWS = {
          user: { name: 'End user', roles: { user: 'you are here', apps: 'uses' },
            d: 'An end user cares about <b>what an application does</b>, not how the computer works. The whole stack exists so that this person can ignore everything below the application.',
            never: 'device commands, memory addresses, which program gets the processor' },
          prog: { name: 'Application programmer', roles: { apps: 'writes', utils: 'uses', os: 'calls its services' },
            d: 'A programmer writes applications in a programming language, using the <b>utilities</b> that come with the system (editor, compiler, debugger, libraries) and the <b>services</b> the OS offers.',
            never: 'the exact command codes of each disk or display model' },
          osd: { name: 'OS designer', roles: { utils: 'serves', os: 'builds', hw: 'must master' },
            d: 'The people who build the OS work in the middle. They must understand the <b>hardware</b> below in detail and design clean <b>services</b> for the programs above.',
            never: 'what any particular application is for' },
        };
        const TRACE = [
          { lay: 'user', gap: 0, msg: 'Ctrl+S', cap: '<b>You</b> press Ctrl+S in your word processor. That is all you do, and all you see.' },
          { lay: 'apps', gap: 1, msg: 'library call: fwrite(…)', cap: 'The <b>word processor</b> turns your document into bytes and calls the <span class="t">library</span> routine fwrite to write them to the file essay.docx.' },
          { lay: 'utils', gap: 2, msg: 'system call', cap: 'The <b>library routine</b> packages the request and makes a <span class="t">system call</span>: the official way to ask the OS for a service. The processor switches into the OS, in <span class="t">kernel mode</span>.' },
          { lay: 'os', gap: 3, msg: 'device commands', cap: 'The <b>OS</b> checks you may write this file and finds free space; its <span class="t">device driver</span> turns “write these bytes here” into the drive\'s own commands.' },
          { lay: 'hw', gap: 3, msg: '↑ interrupt: done', cap: 'The <b>drive</b> stores the data, then raises an <span class="t">interrupt</span> to tell the processor (and so the OS) that the job is finished.' },
          { lay: 'all', gap: -1, msg: '', cap: 'The OS wakes the waiting program, the library routine returns, and the word processor shows “Saved”. <b>Five layers</b> took part; you saw one word.' },
        ];
        const CROSS = [
          ['You → application', 'a keystroke or click'],
          ['Application → library', 'a library call'],
          ['Library → OS', 'a system call'],
          ['OS → hardware', 'device commands'],
          ['Hardware → OS', 'an interrupt'],
        ];
        let traceRows = [];
        let mode = 'view', view = 'user', selLayer = 'user', frame = 0;
        const layEls = {}, gapEls = [];
        const stack = h('div', { class: 'lay-stack' });
        LAYERS.forEach((l, i) => {
          const role = h('span', { class: 'lay-role' });
          const b = h('div', { class: 'lay c-' + l.col, role: 'button', tabindex: 0, 'aria-label': l.name },
            h('div', { class: 'lay-nm' }, h('b', {}, l.name), h('span', { class: 'xs muted' }, l.sub)), role);
          b._role = role;
          const act = () => { selLayer = l.id; if (mode !== 'view') tabs.show(0); else paint(); };
          ctx.on(b, 'click', act);
          ctx.on(b, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
          layEls[l.id] = b;
          stack.append(b);
          if (i < LAYERS.length - 1) {
            const g = h('div', { class: 'lay-gap' }, h('span', { class: 'ar' }, '↕'), h('span', { class: 'msg' }));
            gapEls.push(g); stack.append(g);
          }
        });
        const viewCard = h('div', { class: 'card white stack gap-s' });
        const layerCard = h('div', { class: 'card tight lay-info', 'aria-live': 'polite' });
        function paint() {
          const v = VIEWS[view];
          const f = TRACE[frame];
          LAYERS.forEach((l) => {
            const e = layEls[l.id];
            const seen = mode === 'view' ? !!v.roles[l.id] : (f.lay === 'all' || f.lay === l.id);
            e.classList.toggle('dim', !seen);
            e.classList.toggle('sel', mode === 'view' && selLayer === l.id);
            e.classList.toggle('act', mode === 'trace' && seen);
            e._role.textContent = mode === 'view' ? (v.roles[l.id] || '') : '';
            e._role.style.display = e._role.textContent ? '' : 'none';
          });
          gapEls.forEach((g, i) => {
            const on = mode === 'trace' && f.gap === i;
            g.classList.toggle('on', on);
            g.querySelector('.msg').textContent = on ? f.msg : '';
          });
          traceRows.forEach((r, i) => {
            const shown = i <= frame;
            r.classList.toggle('on', i === frame);
            r.lastChild.textContent = shown ? CROSS[i][1] : '…';
          });
          if (mode === 'view') {
            viewCard.replaceChildren(
              h('h3', { class: 'm0' }, v.name),
              h('p', { class: 'small m0', html: v.d }),
              h('p', { class: 'xs muted m0', html: '<b>Never has to think about:</b> ' + v.never }));
            const L = LAYERS.find((x) => x.id === selLayer);
            layerCard.replaceChildren(h('h4', { class: 'm0' }, 'Layer: ' + L.name), h('p', { class: 'small m0', html: L.d }));
          }
        }
        const tabs = ctx.ui.tabs([
          { label: 'Who sees what', render: (p) => {
            mode = 'view';
            const seg = ctx.ui.seg([{ value: 'user', label: 'End user' }, { value: 'prog', label: 'Programmer' }, { value: 'osd', label: 'OS designer' }], view, (x) => { view = x; paint(); });
            p.append(h('div', { class: 'stack' },
              h('p', { class: 'small m0' }, 'Pick a person. The layers they work with light up. Click any layer to read what it does.'),
              seg, viewCard, layerCard,
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Calling the compiler or the file manager “the OS”. They ship with it, but they are ordinary programs that ask the OS for services, just like your applications do.' })));
            paint();
          } },
          { label: 'Follow a request down and back', render: (p) => {
            mode = 'trace'; frame = 0;
            traceRows = CROSS.map((c) => h('tr', {}, h('td', { class: 'b' }, c[0]), h('td', {}, '…')));
            const tbl = h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', {}, 'Boundary crossed'), h('th', {}, 'What crosses it'))), h('tbody', {}, ...traceRows));
            const player = ctx.ui.player({ count: TRACE.length, interval: 2200, render: (i) => { frame = i; paint(); return TRACE[i].cap; } });
            p.append(h('div', { class: 'stack' },
              h('p', { class: 'small m0', html: 'Saving a document looks like one action. Step through it: each layer talks <b>only to its neighbours</b>, through an agreed interface.' }),
              player.el, tbl,
              h('div', { class: 'callout tip m0', 'data-label': 'Notice', html: 'The word processor never learns which drive you own. Swap the SSD for a USB stick and it still works: only the OS layer changes.' })));
            return () => { player.stop(); traceRows = []; };
          } },
        ]);
        el.append(h('div', { class: 'split lay-split fill' },
          h('div', { class: 'stack' }, stack),
          tabs));
      },
    },

    /* ---------------- 3. The seven services + a classifier game ---------------- */
    {
      title: 'Seven services the OS provides',
      kind: 'lab',
      render(el, ctx) {
        const { h } = ctx;
        const SV = [
          { name: 'Program development', ex: 'Stepping through your code in the debugger that came with the system.',
            d: 'Editors, compilers and debuggers help people create programs. They come with the OS, but strictly they are <span class="t">utilities</span>, not part of the kernel.',
            hint: 'Program development covers the tools for writing, compiling and debugging code.' },
          { name: 'Program execution', ex: 'You double-click an icon and the app simply starts.',
            d: 'Running a program takes many chores: load its instructions and data into memory, open its files, prepare its I/O devices and other resources. The OS does them all for you.',
            hint: 'Program execution is about getting a program loaded and started, with its resources ready.' },
          { name: 'Access to I/O devices', ex: 'The same print request works for any printer model.',
            d: 'Every device has its own commands and control signals. The OS hides them behind one uniform interface, so a program simply reads or writes.',
            hint: 'Access to I/O devices is about hiding each device\'s own commands behind a uniform read/write interface.' },
          { name: 'Controlled access to files', ex: '“Permission denied” when you open someone else\'s file.',
            d: 'The OS understands the storage device and how data is laid out on it, so programs can use file names. On shared systems it also enforces who may read or change each file.',
            hint: 'Controlled access to files is about finding a file\'s data by name and enforcing each file\'s permissions.' },
          { name: 'System access', ex: 'Logging in before you see a desktop.',
            d: 'On a shared or public system, the OS controls who may use the system at all and which system resources each user may reach. It protects them from unauthorized users and settles conflicts over resources.',
            hint: 'System access is about letting only authorized users into the system and its shared resources.' },
          { name: 'Error detection and response', ex: 'One program crashes; the OS ends it and everything else keeps running.',
            d: 'Errors happen while the system runs. <b>Hardware errors:</b> a memory error, a device that fails or malfunctions. <b>Software errors:</b> division by zero, an attempt to reach a forbidden memory location, a request the OS cannot grant. The OS responds with the least damage it can: end the offending program, retry the operation, or simply report the error.',
            hint: 'Error detection and response is about catching hardware and software errors and limiting the damage.' },
          { name: 'Accounting', ex: 'A task manager showing each program\'s processor and memory use.',
            d: 'The OS gathers usage statistics for each resource and monitors performance, such as response time. That helps tune the system and plan upgrades. On multiuser systems the records can be used for billing.',
            hint: 'Accounting is about recording resource usage and performance: for tuning, planning and billing.' },
        ];
        const SC = [
          { t: 'You double-click a game\'s icon. Its code and data are copied into memory, its files are opened, and it starts running.', a: 1,
            why: 'Getting a program from the disk to a running state means loading it, giving it memory and preparing its files and devices. That is <b>program execution</b>.' },
          { t: 'A spreadsheet divides a total by a cell that holds zero. The program is stopped and an error message appears.', a: 5,
            why: 'Division by zero is a <b>software error</b>. The processor detects it, the OS takes over, and it responds, here by ending the program and reporting the problem.' },
          { t: 'A music app plays sound through whatever headphones are plugged in, using the same simple “play these samples” request for every model.', a: 2,
            why: 'Each audio device has its own commands. The OS hides them behind one uniform interface: <b>access to I/O devices</b>.' },
          { t: 'You must type a username and password before the lab computer lets you do anything at all.', a: 4,
            why: 'Deciding who may use the system at all is <b>system access</b>. It protects the whole system and its resources from unauthorized users.' },
          { t: 'An app asks for “settings.txt” by name. The OS works out where that file\'s bytes live on the drive and hands them over.', a: 3,
            why: 'The file service understands how files are laid out on the storage device, so programs use names instead of block numbers: <b>controlled access to files</b>.' },
          { t: 'A disk sector fails while the OS is reading a file. The OS retries the read a few times, then reports that the data could not be read.', a: 5,
            why: 'A failing device is a <b>hardware error</b>. Retrying, then reporting, is a typical response that keeps the damage small.' },
          { t: 'IT staff notice that the web server kept its processor 90% busy all month, so they order a faster machine.', a: 6,
            why: 'Collecting usage statistics and performance figures, and using them to plan upgrades, is <b>accounting</b>.' },
          { t: 'A student writes code in an editor, compiles it, then steps through it line by line in a debugger that came with the system.', a: 0,
            why: 'Editors, compilers and debuggers are <b>program development</b> services, supplied with the OS as utilities.' },
          { t: 'A classmate on a shared lab computer tries to open your homework file and gets “permission denied”.', a: 3,
            why: 'Deciding who may read or change each individual file is part of <b>controlled access to files</b>. System access is about getting into the system at all.' },
          { t: 'A program with a bad pointer tries to read memory that belongs to another program. It is stopped with a “segmentation fault”.', a: 5,
            why: 'An attempt to reach a forbidden memory location is a <b>software error</b>. The hardware catches it and the OS responds by stopping the program.' },
          { t: 'A cloud provider charges a company for the exact number of processor-hours its programs used last month.', a: 6,
            why: 'On a multiuser system, <b>accounting</b> records can be used for billing.' },
        ];
        const learn = (p) => {
          const cards = SV.map((v, i) => h('div', { class: 'card tight svc-card' + (i === 5 ? ' svc-wide' : '') },
            h('div', { class: 'svc-h' }, h('span', { class: 'svc-n' }, String(i + 1)), h('b', {}, v.name)),
            h('p', { class: 'small m0', html: v.d }),
            h('p', { class: 'xs muted m0 svc-ex', html: 'e.g. ' + v.ex })));
          p.append(h('div', { class: 'svc-grid' }, ...cards));
        };
        const game = (p) => {
          let order = SC.map((_, i) => i), k = 0, tried = new Set(), done = false, finished = false;
          const res = SC.map(() => null);
          const pills = h('div', { class: 'row gap-s svc-pills' });
          const num = h('div', { class: 'xs muted b' });
          const text = h('p', { class: 'svc-q m0' });
          const fb = h('div', { class: 'svc-fb', 'aria-live': 'polite' });
          const nextB = h('button', { class: 'btn sm primary', type: 'button', onclick: () => (finished ? restart() : advance()) }, 'Next scenario →');
          const scoreLine = h('div', { class: 'small muted svc-score' });
          const btns = SV.map((v, i) => h('button', { class: 'svc-btn', type: 'button', onclick: () => answer(i) }, h('span', { class: 'svc-n' }, String(i + 1)), v.name));
          function show() {
            const s = SC[order[k]];
            tried = new Set(); done = false;
            num.textContent = `Scenario ${k + 1} of ${SC.length}`;
            text.innerHTML = s.t;
            fb.className = 'svc-fb'; fb.innerHTML = '<span class="muted">Which of the seven services is at work here? Pick one ' + (ctx.narrow ? 'below' : 'on the right') + '.</span>';
            btns.forEach((b) => { b.className = 'svc-btn'; b.disabled = false; });
            nextB.disabled = true;
            paintPills();
          }
          function paintPills() {
            const firstTry = res.filter((x) => x === 1).length, second = res.filter((x) => x === 0).length;
            scoreLine.innerHTML = `<b style="color:var(--ok)">${firstTry}</b> right on the first try · <b style="color:var(--warn)">${second}</b> needed another look`;
            pills.replaceChildren(...order.map((q, j) => h('span', { class: 'svc-pill' + (res[q] === 1 ? ' ok' : res[q] === 0 ? ' late' : '') + (j === k ? ' cur' : '') })));
          }
          function answer(i) {
            if (done) return;
            const s = SC[order[k]];
            if (i === s.a) {
              done = true;
              if (res[order[k]] == null) res[order[k]] = tried.size ? 0 : 1;
              btns[i].classList.add('right');
              btns.forEach((b) => { b.disabled = true; });
              fb.className = 'svc-fb ok';
              fb.innerHTML = `<div class="b">${tried.size ? 'Got it.' : 'Correct!'}</div><div>${s.why}</div>`;
              nextB.disabled = false;
              nextB.textContent = k === SC.length - 1 ? 'See your score' : 'Next scenario →';
            } else {
              tried.add(i);
              btns[i].classList.add('wrong');
              btns[i].disabled = true;
              fb.className = 'svc-fb bad';
              fb.innerHTML = `<div class="b">Not this one.</div><div>${SV[i].hint} Look again at what the OS is actually doing in the scenario.</div>`;
            }
            paintPills();
          }
          function advance() {
            if (!done) return;
            if (k < SC.length - 1) { k++; show(); return; }
            const first = res.filter((x) => x === 1).length;
            num.textContent = 'Finished';
            text.innerHTML = `You named the right service on the first try in <b>${first} of ${SC.length}</b> scenarios.`;
            fb.className = 'svc-fb ok';
            fb.innerHTML = first >= 9 ? 'Excellent. You can tell the seven services apart.' : 'Reread the cards in the first tab for the ones you missed, then play again.';
            btns.forEach((b) => { b.className = 'svc-btn'; b.disabled = true; });
            nextB.textContent = 'Play again (new order)'; nextB.disabled = false;
            finished = true;
            paintPills();
          }
          function restart() {
            finished = false; order = ctx.util.shuffle(order); k = 0; res.fill(null);
            nextB.textContent = 'Next scenario →';
            show();
          }
          p.append(h('div', { class: 'svc-game' },
            h('div', { class: 'stack' },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, num, pills),
              h('div', { class: 'card white svc-qcard' }, text),
              fb,
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, scoreLine, nextB),
              h('div', { class: 'callout analogy m0', 'data-label': 'Memory hook', html: '<b>Build</b> it (development) · <b>run</b> it (execution) · <b>talk</b> to devices (I/O) · <b>keep</b> data (files) · let the right people <b>in</b> (system access) · <b>survive</b> mistakes (errors) · <b>keep the books</b> (accounting).' })),
            h('div', { class: 'stack gap-s' }, h('h4', { class: 'm0' }, 'Which service is it?'), ...btns)));
          show();
        };
        el.append(ctx.ui.tabs([
          { label: 'The seven services', render: learn },
          { label: 'Play: which service handles this?', render: game },
        ]));
      },
    },

    /* ---------------- 4. Three key interfaces: ISA, ABI, API ---------------- */
    {
      title: 'Three key interfaces: ISA, ABI and API',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        const IF = {
          isa: { name: 'Instruction set architecture (ISA)', term: 'instruction set architecture',
            d: 'Every machine-language instruction the processor understands. It is the <b>boundary between hardware and software</b>: below it is circuitry, above it is code.',
            made: '<b>User ISA</b> (any program) + <b>system ISA</b> (privileged, OS only)',
            gives: 'The most basic compatibility: machine code runs only on processors with the same ISA.',
            label: 'Machine code', formula: 'ISA  =  user ISA  +  system ISA',
            lines: [['add r1, r2, r3', 'user ISA: any program may add two registers', 'ok'],
              ['load r4, [r5]', 'user ISA: read a word from memory', 'ok'],
              ['disable_interrupts', 'system ISA: turn interrupts off (OS only)', 'bad'],
              ['load_page_table r6', 'system ISA: set up memory mapping (OS only)', 'bad']],
            foot: 'Pseudo-assembly for illustration. If an ordinary program tries a system-ISA instruction, the processor refuses and hands control to the OS.',
            real: 'x86-64 (most PCs) and ARM64 (phones, many laptops) are different ISAs: machine code for one means nothing to the other.' },
          abi: { name: 'Application binary interface (ABI)', term: 'application binary interface',
            d: 'The agreement a <b>compiled</b> program relies on: how to ask the OS for services, which registers carry arguments and results, how data is laid out.',
            made: '<b>System call interface</b> to the OS + the <b>user ISA</b>',
            gives: '<b>Binary portability</b>: the same executable runs unchanged on any system with the same ABI.',
            label: 'Machine code', formula: 'ABI  =  system call interface  +  user ISA',
            lines: [['mov r0, #5', 'ABI rule: the system call number goes in r0 (5 = open)', ''],
              ['mov r1, name', 'ABI rule: the first argument goes in r1', ''],
              ['syscall', 'trap into the OS, which runs in <span class="t">kernel mode</span>', 'cur'],
              ['cmp r0, #0', 'ABI rule: the OS leaves its result in r0, so check it', '']],
            foot: 'Pseudo-assembly; the register and call numbers are illustrative. A binary bakes rules like these into its machine code, so it only runs where the same rules hold.',
            real: 'Downloads are labelled by OS + processor (“Windows x64”, “Linux ARM64”): that pair pins down the ABI. The wrong one will not start.' },
          api: { name: 'Application programming interface (API)', term: 'application programming interface',
            d: 'What a programmer writing <b>source code</b> uses: the library routines and OS services the language offers, on top of the ordinary instructions the compiler generates.',
            made: 'High-level <b>library calls</b> + the <b>user ISA</b>',
            gives: '<b>Source portability</b>: recompile on any system that offers the same API.',
            label: 'C source code', formula: 'API  =  library calls  +  user ISA',
            lines: [['f = fopen("notes.txt", "r");', 'library call: open a file by name', 'cur'],
              ['fgets(line, 80, f);', 'library call: read one line from it', 'cur'],
              ['count = count + 1;', 'plain arithmetic: the compiler turns it into user-ISA instructions', '']],
            foot: 'fopen and fgets are library routines that make the system calls for you. That is why most programs never make a system call directly.',
            real: 'Source code written to the POSIX API (the standard UNIX-style calls) builds on Linux, macOS and other UNIX-like systems after a recompile.' },
        };
        let sel = 'isa';
        const formula = s('text', { x: 320, y: 500, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 800, style: 'fill:var(--chc)' });
        const svg = s('svg', { viewBox: '0 0 640 516', width: '100%', class: 'if-svg', role: 'img', 'aria-label': 'Layers of software above the hardware, with the three interfaces marked' });
        const box = (x, y, w, hh, cls, label, sub) => s('g', {},
          s('rect', { x, y, width: w, height: hh, rx: 12, class: cls, 'stroke-width': 2 }),
          s('text', { x: x + 16, y: y + (sub ? 26 : hh / 2 + 6), 'font-weight': 800, 'font-size': 17 }, label),
          sub ? s('text', { x: x + 16, y: y + 47, 'font-size': 14, class: 's-sub' }, sub) : null);
        // highlightable parts
        const part = {};
        const hot = (key, el) => { el.classList.add('hot'); el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); ctx.on(el, 'click', () => pick(key)); ctx.on(el, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(key); } }); return el; };
        part.lib = s('line', { x1: 14, y1: 98, x2: 466, y2: 98, class: 'if-ln' });
        part.sys = s('line', { x1: 14, y1: 202, x2: 466, y2: 202, class: 'if-ln' });
        part.isaS = s('line', { x1: 14, y1: 326, x2: 466, y2: 326, class: 'if-ln thick' });
        part.isaU = s('line', { x1: 482, y1: 326, x2: 628, y2: 326, class: 'if-ln thick' });
        part.lane = s('rect', { x: 490, y: 14, width: 130, height: 296, rx: 12, class: 'if-lane', 'stroke-width': 2 });
        svg.append(
          box(20, 14, 440, 62, 's-proc', 'Application programs', 'your code, compiled'),
          box(20, 120, 440, 62, 's-accent', 'Libraries and utilities', 'fopen, printf, sort, math routines'),
          box(20, 224, 440, 80, 's-os', 'Operating system', 'services, reached by system calls'),
          part.lane,
          s('text', { x: 555, y: 42, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, 'user ISA'),
          ...['ordinary', 'instructions', '(add, load,', 'jump…) run', 'directly on', 'the processor'].map((t, i) => s('text', { x: 555, y: 76 + i * 22, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, t)),
          s('line', { x1: 462, y1: 45, x2: 486, y2: 45, class: 's-line', 'marker-end': 'url(#arr)' }),
          s('line', { x1: 462, y1: 151, x2: 486, y2: 151, class: 's-line', 'marker-end': 'url(#arr)' }),
          s('line', { x1: 555, y1: 216, x2: 555, y2: 352, class: 's-line', 'marker-end': 'url(#arr)' }),
          s('line', { x1: 240, y1: 306, x2: 240, y2: 352, class: 's-line', 'marker-end': 'url(#arr)' }),
          s('text', { x: 252, y: 346, 'font-size': 13.5, 'font-weight': 700, style: 'fill:var(--os)' }, 'user ISA + privileged system ISA'),
          s('rect', { x: 14, y: 356, width: 612, height: 104, rx: 14, class: 's-cpu', 'stroke-width': 2 }),
          s('text', { x: 30, y: 382, 'font-weight': 800, 'font-size': 17 }, 'Execution hardware'),
          ...[['Processor', 's-cpu', 30], ['Main memory', 's-mem', 230], ['I/O devices', 's-io', 430]].map(([t, c, x]) => s('g', {},
            s('rect', { x, y: 396, width: 180, height: 50, rx: 10, class: c, 'stroke-width': 2 }),
            s('text', { x: x + 90, y: 427, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 15 }, t))),
          part.lib, part.sys, part.isaS, part.isaU, formula,
          hot('api', s('g', {}, s('rect', { x: 150, y: 86, width: 150, height: 24, rx: 12, class: 'if-tag' }), s('text', { x: 225, y: 103, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, 'library calls'))),
          hot('abi', s('g', {}, s('rect', { x: 150, y: 190, width: 150, height: 24, rx: 12, class: 'if-tag' }), s('text', { x: 225, y: 207, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, 'system calls'))),
          hot('isa', s('g', {}, s('rect', { x: 20, y: 314, width: 200, height: 24, rx: 12, class: 'if-tag' }), s('text', { x: 120, y: 331, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, 'hardware | software'))));
        const USES = { isa: ['isaS', 'isaU'], abi: ['sys', 'lane', 'isaU'], api: ['lib', 'lane', 'isaU'] };
        const card = h('div', { class: 'stack gap-s if-card', 'aria-live': 'polite' });
        const seg = ctx.ui.seg([{ value: 'isa', label: 'ISA' }, { value: 'abi', label: 'ABI' }, { value: 'api', label: 'API' }], sel, (v) => pick(v));
        function pick(k) {
          sel = k; seg.set(k);
          Object.entries(part).forEach(([n, e]) => e.classList.toggle('on', USES[k].includes(n)));
          const f = IF[k];
          formula.textContent = f.formula;
          const code = h('table', { class: 'tbl compact if-code' },
            h('thead', {}, h('tr', {}, h('th', {}, f.label), h('th', {}, 'What this line does'))),
            h('tbody', {}, ...f.lines.map(([c, w, cls]) => h('tr', { class: cls || null }, h('td', { class: 'mono' }, c), h('td', { html: w })))));
          card.replaceChildren(
            h('h3', { class: 'm0', html: `<span class="t" data-t="${f.term}">${f.name}</span>` }),
            h('p', { class: 'small m0', html: f.d }),
            h('table', { class: 'tbl compact' }, h('tbody', {},
              h('tr', {}, h('td', { class: 'b' }, 'Made of'), h('td', { html: f.made })),
              h('tr', {}, h('td', { class: 'b' }, 'Gives you'), h('td', { html: f.gives })))),
            code,
            h('p', { class: 'xs muted m0', html: f.foot }),
            h('p', { class: 'small m0 if-real', html: '<b>In practice:</b> ' + f.real }));
        }
        el.append(h('div', { class: 'split if-split fill' },
          h('div', { class: 'card white if-wrap' }, svg),
          h('div', { class: 'stack' },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('span', { class: 'xs muted' }, 'or click a label in the diagram')),
            card)));
        pick('isa');
      },
    },

    /* ---------------- 5. Portability explorer: which interface must match? ---------------- */
    {
      title: 'Portability lab: will it run on the new machine?',
      kind: 'lab',
      render(el, ctx) {
        const { h } = ctx;
        const CARRY = [
          { id: 'bin', name: 'Compiled binary', sub: 'the executable file' },
          { id: 'srcC', name: 'Source code', sub: 'standard C library only' },
          { id: 'srcP', name: 'Source code', sub: 'also calls fork(), a UNIX call that copies a running program', tag: 'also calls fork()' },
        ];
        const TGT = [
          { cpu: 'x86', os: 'linux' }, { cpu: 'x86', os: 'win' }, { cpu: 'arm', os: 'linux' }, { cpu: 'arm', os: 'win' },
        ];
        const CPU = { x86: 'x86-64', arm: 'ARM64' }, OS = { linux: 'Linux', win: 'Windows' };
        function judge(c, t) {
          const isa = t.cpu === 'x86', abi = isa && t.os === 'linux';
          const api = c === 'srcP' ? t.os === 'linux' : true;
          const bin = c === 'bin';
          const runs = bin ? abi : api;
          let why;
          if (bin) {
            if (abi) why = 'Same processor family and same OS. The processor understands every instruction (same ISA) and the system calls follow the same rules (same ABI), so the file runs unchanged. That is <b>binary portability</b>.';
            else if (isa) why = 'The processor understands every instruction (same ISA), but the binary\'s system calls, register conventions and file format follow the Linux ABI. Windows expects different ones, so it will not run as is (unless a compatibility layer imitates the Linux ABI).';
            else if (t.os === 'linux') why = 'Same OS, but an ARM processor cannot decode x86-64 machine code. The ISA differs, so the ABI (which includes the user ISA) differs too. It will not run as is (an emulator could translate it, at a cost).';
            else why = 'Both the instruction set and the OS interface differ. Nothing in this binary fits the new machine.';
          } else if (!api) why = 'Recompiling is not enough: Windows\' own API has no fork(). The code must be rewritten to use the Windows way of creating processes (or built on a compatibility layer). For source code, the <b>API</b> is what has to match.';
          else if (c === 'srcP') why = t.cpu === 'x86' ? 'The origin machine itself: of course it builds and runs.' : 'Linux on ARM offers the same POSIX API, fork() included. A compiler for ARM64 generates brand-new machine code that follows this system\'s ABI, and the source needs no changes: <b>source portability</b>.';
          else why = (t.cpu === 'x86' && t.os === 'linux') ? 'The origin machine itself: of course it builds and runs.' : 'Recompile with a compiler for the target. It generates new machine code for that ISA and that ABI, and the standard C library (the API) exists on all four systems, so the same source builds and runs: <b>source portability</b>.';
          return { isa, abi, api, bin, runs, why };
        }
        const state = {};
        let sel = null, right = 0, made = 0;
        const cells = {};
        const score = h('div', { class: 'small b' });
        const detail = h('div', { class: 'card white stack gap-s port-detail', 'aria-live': 'polite' });
        const head = h('tr', {}, h('th', {}, 'You carry…'), ...TGT.map((t) => h('th', { class: 'center' },
          h('span', { class: 'chip cpu' }, CPU[t.cpu]), h('br'), h('span', { class: 'chip os' }, OS[t.os]))));
        const rows = CARRY.map((c) => h('tr', {}, h('td', {}, h('b', {}, c.name), h('div', { class: 'xs muted' }, c.sub)),
          ...TGT.map((t) => {
            const key = c.id + '|' + t.cpu + '|' + t.os;
            const b = h('button', { type: 'button', class: 'port-cell', 'aria-label': `${c.name} (${c.sub}) on ${CPU[t.cpu]} ${OS[t.os]}`, onclick: () => pick(key) }, '?');
            cells[key] = b;
            return h('td', { class: 'center' }, b);
          })));
        function paintCells() {
          Object.entries(cells).forEach(([k, b]) => {
            const st = state[k];
            const [c, cpu, os] = k.split('|');
            const r = judge(c, { cpu, os });
            b.className = 'port-cell' + (st ? (r.runs ? ' ok' : ' bad') : '') + (k === sel ? ' sel' : '');
            b.textContent = st ? (r.runs ? '✓ runs' : '✗ no') : '?';
          });
          score.innerHTML = made ? `Predictions right: <span style="color:var(--ok)">${right}</span> of ${made} · ${12 - made} cells left` : 'Predictions right: 0 of 0 · 12 cells left';
        }
        function check(label, ok, na) {
          return h('div', { class: 'port-check' + (na ? ' na' : ok ? ' ok' : ' bad') }, h('b', {}, label), h('span', {}, na || (ok ? '✓ matches' : '✗ differs')));
        }
        // only shown for the fork() row, where the term would otherwise be unexplained
        const forkNote = () => h('p', { class: 'xs m0 port-fork', html: '<b>What is fork()?</b> A standard call on UNIX-like systems (Linux, macOS) that makes a copy of a running program (section 3.6 covers it). It is part of <b>POSIX</b>, the API those systems share. Windows has no fork().' });
        function pick(key) {
          sel = key;
          const [c, cpu, os] = key.split('|');
          const C = CARRY.find((x) => x.id === c);
          const r = judge(c, { cpu, os });
          const title = h('h3', { class: 'm0', html: `${C.name} <span class="muted small">(${C.tag || C.sub})</span> →${CPU[cpu]} + ${OS[os]}` });
          if (!state[key]) {
            const ask = (yes) => { made++; if (yes === r.runs) right++; state[key] = { pred: yes }; pick(key); };
            detail.replaceChildren(...[title,
              h('p', { class: 'm0', html: r.bin ? 'You copy the <b>executable file</b> across and double-click it. Will it run?' : 'You copy the <b>source code</b> across and <b>recompile</b> it there. Will it build and run?' }),
              h('div', { class: 'row' }, h('button', { class: 'btn ok-b', type: 'button', onclick: () => ask(true) }, 'Predict: it runs'), h('button', { class: 'btn bad-b', type: 'button', onclick: () => ask(false) }, 'Predict: it won\'t')),
              h('h4', { class: 'm0 mt' }, 'Questions to ask yourself'),
              h('div', { class: 'port-checks' },
                h('div', { class: 'port-check na' }, h('b', {}, 'ISA ?'), h('span', {}, 'Can this processor decode the machine instructions?')),
                h('div', { class: 'port-check na' }, h('b', {}, 'ABI ?'), h('span', {}, 'Does this OS follow the same system-call rules?')),
                h('div', { class: 'port-check na' }, h('b', {}, 'API ?'), h('span', {}, 'Does it offer every library call the source uses?'))),
              h('p', { class: 'xs muted m0' }, 'Not every question matters in every case. Part of the skill is knowing which ones do.'),
              c === 'srcP' && forkNote()].filter(Boolean));
          } else {
            const good = state[key].pred === r.runs;
            const na = 'compiler makes new code';
            detail.replaceChildren(...[title,
              h('div', { class: 'port-verdict ' + (r.runs ? 'ok' : 'bad') }, (r.runs ? '✓ It runs.' : '✗ It will not run as is.') + (good ? '  You predicted right.' : '  Your prediction missed.')),
              h('div', { class: 'port-checks' },
                check('ISA', r.isa, r.bin ? null : na),
                check('ABI', r.abi, r.bin ? null : na),
                check('API', r.api, r.bin ? 'not needed: nothing is rebuilt' : null)),
              h('p', { class: 'small m0', html: r.why }),
              c === 'srcP' && forkNote()].filter(Boolean));
          }
          paintCells();
        }
        const rules = ctx.ui.reveal('Show the two rules', h('div', { class: 'callout why m0', 'data-label': 'The rules', html: '<b>Binary</b> runs unchanged only if the target has the <b>same ISA and the same ABI</b>.<br><b>Source</b> runs after recompiling if the target offers the <b>same API</b> (and a compiler for its ISA).' }));
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack' },
            h('p', { class: 'lead m0', html: 'You built a program on an <span class="chip cpu">x86-64</span> PC running <span class="chip os">Linux</span>. Now you want it on other machines.' }),
            h('p', { class: 'small m0', html: 'You can carry the <b>compiled binary</b>, or the <b>source code</b> and recompile it there. Pick any cell, predict, then see which interface decided the answer: the <span class="t">ISA</span>, the <span class="t">ABI</span> or the <span class="t">API</span>.' }),
            h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A binary is a recipe already converted for one kitchen: its oven, its measuring cups. Source code is the original recipe: any cook can adapt it, as long as their kitchen stocks every ingredient it calls for (the API).' }),
            score, rules),
          h('div', { class: 'stack' },
            h('table', { class: 'tbl compact port-tbl' }, h('thead', {}, head), h('tbody', {}, ...rows)),
            detail)));
        pick('bin|arm|linux');
      },
    },

    /* ---------------- 6. The OS as resource manager: give the processor away, win it back ---------------- */
    {
      title: 'The OS as resource manager: a manager that must let go',
      kind: 'explore',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h, s } = ctx;
        // one frame per moment; every frame is drawn from scratch by draw(i).
        // The script depends on whether the machine has a timer, which the student can toggle.
        let timerOn = true;
        function script(on) {
          const t = (x) => (on ? x : 'none in this machine');
          return [
            { cpu: 'OS', A: '', B: '', timer: t('off'), disk: 'idle', ev: '', res: ['mem'],
              cap: 'Meet the resources: the <b>processor</b>, <b>main memory</b>, <b>I/O devices</b> such as the disk, and the <b>files</b> stored there. The <span class="t">kernel</span> (nucleus), the most-used part of the OS, stays in main memory all the time. Right now the processor runs kernel code.' },
            { cpu: 'OS', A: 'ready', B: 'ready', timer: t('off'), disk: 'idle', ev: '', res: ['mem'],
              cap: 'Programs A and B want to run. The OS decides <b>how much memory</b> each gets and <b>where</b>, and sets up the memory-management hardware so each can reach only its own part.' },
            { cpu: 'A', A: 'running', B: 'ready', timer: t('armed for A'), disk: 'idle', ev: 'dispatch', res: ['cpu'],
              cap: (on ? 'The OS arms the <b>timer</b>, then <span class="t">dispatches</span> A' : 'There is no timer to arm. The OS <span class="t">dispatches</span> A') + ': it loads A\'s registers, switches the processor to restricted <b>user mode</b> and jumps to A\'s next instruction. From this instant the OS is <b>not running at all</b>.' },
            { cpu: 'A', A: 'running', B: 'ready', timer: t('counting down'), disk: 'idle', ev: '', res: ['cpu'],
              cap: 'A runs its own instructions directly on the processor. The OS is just bytes sitting in memory. It cannot watch A, and it cannot stop A by itself.' },
            { cpu: 'OS', A: 'in a system call', B: 'ready', timer: t('counting down'), disk: 'idle', ev: 'syscall', res: ['files'],
              cap: 'A needs data from the file scores.dat, so it makes a <span class="t">system call</span>. That special instruction switches the processor into <span class="t">kernel mode</span> and into the OS: control is back.' },
            { cpu: 'B', A: 'waiting for disk', B: 'running', timer: t('armed for B'), disk: 'reading', ev: 'cmd', res: ['io', 'cpu'],
              cap: 'The OS finds where scores.dat lives, tells the disk to start reading, and marks A as waiting. Rather than leave the processor idle, it ' + (on ? 'arms the timer for B and dispatches B.' : 'dispatches B.') },
            { cpu: 'B', A: 'waiting for disk', B: 'running', timer: t('counting down'), disk: 'reading', ev: '', res: ['io'],
              cap: 'B computes while the disk moves data <b>at the same time</b>. The OS is not running; nothing needs it right now.' },
            { cpu: 'OS', A: 'ready', B: 'interrupted', timer: t('counting down'), disk: 'done', ev: 'diskint', res: ['io'],
              cap: 'The disk finishes and raises an <span class="t">interrupt</span>. The processor stops B and jumps into the OS\'s interrupt handler. The OS marks A <b>ready</b>: its data has arrived.' },
            { cpu: 'B', A: 'ready', B: 'running', timer: t('counting down'), disk: 'idle', ev: 'dispatch', res: ['cpu'],
              cap: on ? 'The OS returns to B so B can use the rest of its turn (its <b>time slice</b>, measured by the timer). Deciding <b>who runs next, and for how long</b>, is how the OS manages processor time.'
                : 'The OS returns to B. Deciding <b>who runs next</b> is how the OS manages processor time, but with no timer it has no way to limit <b>for how long</b>.' },
            on ? { cpu: 'OS', A: 'ready', B: 'ready', timer: 'expired!', disk: 'idle', ev: 'timerint', res: ['cpu'],
              cap: 'B\'s time is up. The timer raises an interrupt and the OS is back in control, even though B never asked to stop.' }
              : { cpu: 'B', A: 'ready', B: 'running a long loop', timer: t(''), disk: 'idle', ev: '', res: ['cpu'],
              cap: 'Now B enters a long loop and makes no system call. A is ready, but with <b>no timer interrupt</b> nothing hands the processor back. The OS cannot step in on its own.' },
            on ? { cpu: 'A', A: 'running', B: 'ready', timer: 'armed for A', disk: 'idle', ev: 'dispatch', res: ['cpu'],
              cap: 'The OS dispatches A. It gave the processor away 4 times and got it back 3 times, always through <b>a system call or an interrupt</b> (from a device, the timer, or a program error such as dividing by zero). It has no other way back in.' }
              : { cpu: 'B', A: 'ready', B: 'running a long loop', timer: t(''), disk: 'idle', ev: '', res: ['cpu'],
              cap: 'Still B, and it could stay that way forever: A never runs and the OS never runs again. The OS <b>relies on the hardware</b> to win the processor back, which is why real machines have a timer. Switch it back on to compare.' },
          ];
        }
        let F = script(true);
        const EVN = { dispatch: 'dispatch', syscall: 'system call', cmd: 'disk told to read + dispatch B', diskint: 'interrupt from the disk', timerint: 'timer interrupt', '': '—' };
        // On phones the disk moves to a second row so the drawing is narrower and its text stays readable.
        const N = ctx.narrow;
        const D = N ? { x: 10, y: 322, w: 470, h: 96, sx: 186, sy: 382 } : { x: 540, y: 34, w: 210, h: 130, sx: 556, sy: 138 };
        const svg = s('svg', { viewBox: N ? '0 0 490 424' : '0 0 760 300', width: '100%', class: 'rm-svg', role: 'img', 'aria-label': 'Processor, timer, main memory and disk, with the program the processor is running' });
        const strip = h('div', { class: 'rm-strip' });
        const cellsEl = F.map(() => h('div', { class: 'rm-cell' }));
        strip.append(...cellsEl);
        const RES = [
          ['cpu', 'cpu', 'Processor time', 'who runs next, and for how long'],
          ['mem', 'mem', 'Main memory', 'who gets which part of memory'],
          ['io', 'io', 'I/O devices', 'which program uses which device, when'],
          ['files', 'io', 'Files', 'where data lives, and who may use it'],
        ];
        const resEls = RES.map(([k, c, n, d]) => h('div', { class: 'rm-res' }, h('span', { class: 'chip ' + c }, n), h('span', { class: 'xs muted' }, d)));
        const evEl = h('div', { class: 'rm-ev' });
        const segY = { free: [66, 50], B: [122, 56], A: [184, 56], OS: [246, 42] };
        const T = (x, y, t, o = {}) => s('text', Object.assign({ x, y }, o), t);
        function seg(key, label, state, cls, on) {
          const [y, hh] = segY[key];
          return s('g', {},
            s('rect', { x: 292, y, width: 176, height: hh, rx: 8, class: cls, 'stroke-width': on ? 3.5 : 2, 'stroke-dasharray': cls === 's-panel' ? '5 4' : null }),
            T(304, y + (state ? 22 : hh / 2 + 5), label, { 'font-weight': 800, 'font-size': 15 }),
            state ? T(304, y + 42, state, { 'font-size': 13.5, class: 's-sub' }) : null);
        }
        function draw(i) {
          const f = F[i];
          const own = f.cpu;
          const ownCol = own === 'OS' ? 'var(--os)' : 'var(--proc)';
          const loaded = !!f.A;
          const mid = { OS: 267, A: 212, B: 150 }[own];
          svg.replaceChildren(...[
            // processor
            s('rect', { x: 10, y: 34, width: 210, height: 130, rx: 12, class: 's-cpu', 'stroke-width': 2 }),
            T(24, 58, 'Processor', { 'font-weight': 800, 'font-size': 17 }),
            T(24, 86, 'now running:', { 'font-size': 14, class: 's-sub' }),
            T(24, 124, own === 'OS' ? 'OS kernel' : 'Program ' + own, { 'font-weight': 800, 'font-size': 27, style: 'fill:' + ownCol }),
            T(24, 152, own !== 'OS' ? 'user mode' : f.ev === 'syscall' ? 'kernel mode · via system call' : (f.ev === 'diskint' || f.ev === 'timerint') ? 'kernel mode · via interrupt' : 'kernel mode', { 'font-size': 13.5, class: f.ev === 'syscall' || f.ev === 'diskint' || f.ev === 'timerint' ? null : 's-sub', style: f.ev === 'syscall' || f.ev === 'diskint' || f.ev === 'timerint' ? 'fill:var(--intr);font-weight:700' : null }),
            // timer
            s('rect', { x: 10, y: 186, width: 210, height: 56, rx: 10, class: f.ev === 'timerint' ? 's-intr' : 's-panel', 'stroke-width': 2, 'stroke-dasharray': timerOn ? null : '6 5' }),
            T(24, 208, 'Timer', { 'font-weight': 800, 'font-size': 15 }),
            T(24, 230, f.timer, { 'font-size': 14, class: f.ev === 'timerint' ? null : 's-sub', style: f.ev === 'timerint' ? 'fill:var(--intr);font-weight:800' : null }),
            // memory
            s('rect', { x: 280, y: 34, width: 200, height: 262, rx: 12, class: 's-mem', 'stroke-width': 2 }),
            T(380, 56, 'Main memory', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }),
            seg('free', 'free', '', 's-panel', false),
            loaded ? seg('B', 'Program B', f.B, 's-proc', own === 'B') : seg('B', 'free', '', 's-panel', false),
            loaded ? seg('A', 'Program A', f.A, 's-proc', own === 'A') : seg('A', 'free', '', 's-panel', false),
            seg('OS', 'OS kernel (resident)', '', 's-os', own === 'OS'),
            // the processor is executing the code of whoever owns it
            s('path', { d: `M 222 100 H 252 V ${mid} H 288`, class: 's-line', style: 'stroke:' + ownCol + ';stroke-width:3', 'marker-end': own === 'OS' ? 'url(#arr-os)' : 'url(#arr-proc)' }),
            T(226, 92, 'runs', { 'font-size': 12.5, class: 's-sub' }),
            // disk + files
            s('rect', { x: D.x, y: D.y, width: D.w, height: D.h, rx: 12, class: 's-io', 'stroke-width': 2 }),
            T(D.x + 16, D.y + 24, 'Disk', { 'font-weight': 800, 'font-size': 17 }),
            T(D.x + 60, D.y + 24, '(an I/O device)', { 'font-size': 13.5, class: 's-sub' }),
            s('rect', { x: D.x + 16, y: D.y + 38, width: 140, height: 32, rx: 7, class: 's-panel', 'stroke-width': f.res.includes('files') ? 3 : 1.5 }),
            T(D.x + 86, D.y + 59, 'scores.dat', { 'text-anchor': 'middle', 'font-size': 14, class: 's-monot', 'font-weight': 700 }),
            T(D.sx, D.sy, f.disk === 'reading' ? 'reading…' : f.disk === 'done' ? 'done: data ready' : 'idle', { 'font-size': 15, 'font-weight': f.disk === 'idle' ? 400 : 800, style: f.disk === 'idle' ? 'fill:var(--muted)' : 'fill:var(--io)' }),
            // events
            f.ev === 'diskint' ? s('path', { d: N ? 'M 236 322 V 140 H 226' : 'M 645 34 V 14 H 115 V 30', class: 's-line', style: 'stroke:var(--intr);stroke-width:3', 'marker-end': 'url(#arr-intr)' }) : null,
            f.ev === 'diskint' ? T(N ? 228 : 380, N ? 312 : 29, 'interrupt: disk done', { 'text-anchor': N ? 'end' : 'middle', 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--intr)' }) : null,
            f.ev === 'timerint' ? s('line', { x1: 150, y1: 186, x2: 150, y2: 168, class: 's-line', style: 'stroke:var(--intr);stroke-width:3', 'marker-end': 'url(#arr-intr)' }) : null,
            f.ev === 'cmd' ? s('path', { d: N ? 'M 380 288 V 318' : 'M 470 267 H 645 V 168', class: 's-line', style: 'stroke:var(--io);stroke-width:3', 'marker-end': 'url(#arr-io)' }) : null,
            f.ev === 'cmd' ? T(N ? 390 : 560, N ? 313 : 259, 'start reading', { 'text-anchor': N ? 'start' : 'middle', 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--io)' }) : null,
          ].filter(Boolean));
          cellsEl.forEach((c, j) => {
            const done = j <= i;
            c.className = 'rm-cell' + (done ? (F[j].cpu === 'OS' ? ' os' : ' proc') : '') + (j === i ? ' now' : '');
            c.textContent = done ? F[j].cpu : '';
          });
          resEls.forEach((r, j) => r.classList.toggle('on', f.res.includes(RES[j][0])));
          evEl.innerHTML = '<b>Event:</b> ' + EVN[f.ev];
          evEl.classList.toggle('hot-ev', !!f.ev);
        }
        const player = ctx.ui.player({ count: F.length, interval: 2600, render: (i) => { draw(i); return F[i].cap; } });
        const tSeg = ctx.ui.seg([{ value: 'on', label: 'Timer fitted' }, { value: 'off', label: 'No timer' }], 'on', (v) => {
          timerOn = v === 'on'; F = script(timerOn); player.refresh();   // same moment, redrawn under the new hardware
          ctx.toast(timerOn ? 'Timer fitted: the OS can take the processor back on a schedule.' : 'No timer: watch the last two moments.');
        });
        el.append(h('div', { class: 'stack fill rm-wrap' },
          h('div', { class: 'rm-grid' },
            h('div', { class: 'card white rm-main' }, svg,
              h('div', { class: 'row rm-what' }, h('span', { class: 'small b' }, 'What if the machine had no timer?'), tSeg),
              h('div', { class: 'row nw rm-strip-row' }, h('span', { class: 'xs muted b' }, 'Who had the processor'), strip)),
            h('div', { class: 'stack gap-s' },
              h('h4', { class: 'm0' }, 'Resources the OS manages'), ...resEls, evEl,
              h('div', { class: 'callout why m0 small', 'data-label': 'The unusual part', html: 'A thermostat sits outside the furnace it controls. The OS is <b>a program run by the very processor it manages</b>, so it must give the processor away and rely on the hardware to hand it back.' }))),
          player.el));
      },
    },

    /* ---------------- 7. Ease of evolution: tangled vs modular ---------------- */
    {
      title: 'Built to change: why modular design wins',
      kind: 'compare',
      render(el, ctx) {
        const { h, s } = ctx;
        const MODS = [['sched', 'Scheduler'], ['mem', 'Memory mgr'], ['fs', 'File system'], ['drv', 'Device drivers'], ['ui', 'User interface'], ['acct', 'Accounting']];
        const POS = MODS.map((_, i) => ({ x: i % 2 ? 184 : 16, y: 14 + Math.floor(i / 2) * 70 }));
        const CH = [
          { id: 'page', cat: 'New hardware', name: 'Paging unit added', tangled: ['mem', 'sched', 'fs', 'drv'], modular: ['mem'], fault: null,
            why: 'Paging hardware hands out memory in small fixed-size blocks called pages, so the memory tables change shape. In the tangle, the scheduler, file system and drivers all read those tables directly, so every one of them breaks. In the modular OS only the memory manager knows the layout; the others call its <b>allocate</b> and <b>free</b> operations, which did not change.' },
          { id: 'gfx', cat: 'New kind of hardware', name: 'Graphics display replaces text terminal', tangled: ['drv', 'ui', 'fs', 'acct'], modular: ['drv', 'ui'], fault: null,
            why: 'In the tangle, the file system and accounting code wrote text straight to the terminal hardware, so all of them must change. In the modular OS everything prints through the user-interface module, so only it and the display driver change.' },
          { id: 'quota', cat: 'New service', name: 'Disk quotas per user', tangled: ['fs', 'acct', 'drv'], modular: ['fs', 'acct'], fault: null,
            why: 'A quota caps how much disk space each user may fill. A new service must touch the parts it really needs, but no more. In the tangle, disk-space bookkeeping is spread over the file code, the driver and accounting. In the modular OS the file system asks Accounting through one new, documented call.' },
          { id: 'fix', cat: 'Fix', name: 'Bug in long file names', tangled: ['fs', 'ui'], modular: ['fs'], fault: 'acct',
            why: 'The fix changes the layout of the file-name table. In the tangle, the user interface read that table directly, so it must be edited too, and accounting code that also read it was missed and now miscounts: <b>the fix introduced a new fault</b>. In the modular OS the table is private to the file system, so nothing outside can notice the change.' },
        ];
        const applied = new Set();
        let last = null;
        function panel(kind) {
          const svg = s('svg', { viewBox: '0 0 320 214', width: '100%', role: 'img', 'aria-label': kind === 'tangled' ? 'Tangled design: every part connected to every other part' : 'Modular design: every part connected only to a shared set of interfaces' });
          const count = h('div', { class: 'small evo-count' });
          return { kind, svg, count };
        }
        const P = { tangled: panel('tangled'), modular: panel('modular') };
        const center = (i) => [POS[i].x + 60, POS[i].y + 22];
        function drawPanel(p) {
          const cur = last ? CH.find((c) => c.id === last) : null;
          const edits = cur ? cur[p.kind] : [];
          const fault = cur && p.kind === 'tangled' ? cur.fault : null;
          const kids = [];
          if (p.kind === 'tangled') {
            for (let i = 0; i < MODS.length; i++) for (let j = i + 1; j < MODS.length; j++) {
              const [x1, y1] = center(i), [x2, y2] = center(j);
              kids.push(s('line', { x1, y1, x2, y2, class: 's-muted', 'stroke-width': 1.6 }));
            }
          } else {
            kids.push(s('rect', { x: 150, y: 8, width: 20, height: 198, rx: 8, class: 's-accent', 'stroke-width': 1.5 }));
            MODS.forEach((_, i) => kids.push(s('line', { x1: i % 2 ? 184 : 136, y1: POS[i].y + 22, x2: i % 2 ? 170 : 150, y2: POS[i].y + 22, class: 's-line' })));
          }
          MODS.forEach(([id, name], i) => {
            const isF = fault === id, isE = edits.includes(id);
            const cls = isF ? 's-bad' : isE ? 's-warn' : 's-panel';
            kids.push(s('g', {},
              s('rect', { x: POS[i].x, y: POS[i].y, width: 120, height: 44, rx: 9, class: cls, 'stroke-width': isF || isE ? 3 : 1.5 }),
              s('text', { x: POS[i].x + 60, y: POS[i].y + (isF || isE ? 19 : 27), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, name),
              isF || isE ? s('text', { x: POS[i].x + 60, y: POS[i].y + 36, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: isF ? 'fill:var(--bad)' : 'fill:var(--warn)' }, isF ? 'new fault!' : 'must edit') : null));
          });
          p.svg.replaceChildren(...kids);
          let e = 0, f = 0;
          applied.forEach((id) => { const c = CH.find((x) => x.id === id); e += c[p.kind].length; if (p.kind === 'tangled' && c.fault) f++; });
          p.count.innerHTML = `Parts edited so far: <b>${e}</b> · new faults: <b style="color:${f ? 'var(--bad)' : 'var(--ok)'}">${f}</b>`;
        }
        const why = h('div', { class: 'card tight evo-why', 'aria-live': 'polite' });
        const board = h('div', { class: 'evo-board small' });
        const btns = CH.map((c) => h('button', { type: 'button', class: 'evo-btn', onclick: () => apply(c.id) }, h('span', { class: 'xs muted b' }, c.cat), h('span', {}, c.name)));
        function apply(id) {
          applied.add(id); last = id;
          paint();
        }
        function paint() {
          btns.forEach((b, i) => { b.classList.toggle('on', CH[i].id === last); b.classList.toggle('done', applied.has(CH[i].id)); });
          drawPanel(P.tangled); drawPanel(P.modular);
          const c = CH.find((x) => x.id === last);
          if (!c) why.innerHTML = '<span class="muted">Pick a change request above. Amber = a part that must be edited; red = a new fault the change caused.</span>';
          else why.innerHTML = c.why;
          board.innerHTML = applied.size === CH.length
            ? '<b>All four changes applied.</b> Tangled: <b>13</b> edits and a new fault. Modular: <b>6</b> edits and none. Fewer parts touched means fewer chances to break something.'
            : `Changes applied: <b>${applied.size} of ${CH.length}</b>. Apply all four to compare the totals. (An illustrative model, not measurements.)`;
          board.classList.toggle('full', applied.size === CH.length);
        }
        const reset = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { applied.clear(); last = null; paint(); } }, 'Reset');
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack' },
            h('p', { class: 'lead m0', html: 'An OS is never finished. It must keep evolving, for three reasons:' }),
            h('div', { class: 'stack gap-s' },
              h('div', { class: 'evo-r' }, h('b', {}, '1 · Hardware upgrades and new kinds of hardware'), h('span', { class: 'small' }, 'Paging hardware added to a machine (memory handed out in fixed-size pages); graphics displays replacing text-only terminals.')),
              h('div', { class: 'evo-r' }, h('b', {}, '2 · New services'), h('span', { class: 'small' }, 'Users and administrators keep asking the OS to do more.')),
              h('div', { class: 'evo-r' }, h('b', {}, '3 · Fixes'), h('span', { class: 'small' }, 'Every OS has faults. Worse, a fix can itself introduce new faults.'))),
            h('div', { class: 'callout why m0', 'data-label': 'So build it from modules', html: 'Split the OS into <span class="t">modules</span>, each hidden behind a <b>clearly defined interface</b>, and <b>document</b> those interfaces well. Then most changes stay inside one module, and the rest of the system never notices.' }),
            board),
          h('div', { class: 'stack gap-s' },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Apply a change request to both designs'), reset),
            h('div', { class: 'grid-2 evo-btns' }, ...btns),
            h('div', { class: 'grid-2' },
              h('div', { class: 'card white tight evo-panel' }, h('div', { class: 'small b' }, 'Tangled: parts reach into each other'), P.tangled.svg, P.tangled.count),
              h('div', { class: 'card white tight evo-panel' }, h('div', { class: 'small b' }, 'Modular: parts meet only at interfaces'), P.modular.svg, P.modular.count)),
            why)));
        paint();
      },
    },

    /* ---------------- 8. Recap ---------------- */
    {
      title: 'Recap: six ideas to carry forward',
      kind: 'recap',
      render(el, ctx) {
        const { h } = ctx;
        el.append(h('div', { class: 'stack fill' },
          h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. If you hesitate, revisit that step.'),
          ctx.ui.flipcards([
            ['What is an operating system?', 'A program that <b>controls the execution of application programs</b> and acts as the <b>interface</b> between those programs and the hardware.'],
            ['Its three objectives?', '<b>Convenience</b> (easy to use), <b>efficiency</b> (hardware used well) and the <b>ability to evolve</b> (new hardware, services and fixes without disruption).'],
            ['The seven services?', 'Program development · program execution · access to I/O devices · controlled access to files · system access · error detection and response · accounting.'],
            ['ISA vs ABI vs API?', '<b>ISA</b>: user + system instructions, the hardware/software boundary. <b>ABI</b>: system call interface + user ISA → binary portability. <b>API</b>: library calls + user ISA → source portability by recompiling.'],
            ['Why is the OS an odd resource manager?', 'It is a <b>program run by the processor it manages</b>. It gives the processor away and wins it back only through <b>a system call or an interrupt</b> (device, timer, program error). It manages processor time, memory, I/O devices and files.'],
            ['How do you build an OS that can evolve?', 'From <b>modules</b> with <b>clearly defined interfaces</b> and <b>good documentation</b>, since hardware, services and fixes keep coming, and fixes can add new faults.'],
          ].map(([f, b]) => [f, '<div>' + b + '</div>']), { cols: 3, height: 214 }),
          h('p', { class: 'small muted m0', html: '<b>Next up (2.2):</b> how these same goals, convenience and efficiency above all, drove the history of operating systems from hands-on machines to time sharing.' })));
      },
    },

    /* ---------------- 9. Check yourself ---------------- */
    {
      title: 'Check yourself',
      kind: 'check',
      quiz: [
        { q: 'Which statement best describes an operating system?',
          choices: ['The complete collection of software installed on a computer, including every application program', 'A program that controls the execution of application programs and acts as the interface between them and the hardware', 'The circuitry inside the processor that fetches, decodes and executes each machine instruction', 'A translator that converts programs written in a high-level language into machine code the processor can run'],
          answer: 1,
          feedback: ['Applications are not part of the OS. They run on top of it and use its services.', null, 'That is the processor, which is hardware. The OS is software that the processor runs.', 'That is a compiler: a utility that comes with the OS, not the OS itself.'],
          why: 'An OS is software with two jobs: it controls how programs run, and it stands between those programs and the hardware, offering services so that programs never have to drive the hardware themselves.' },
        { type: 'multi', q: 'Which are the three standard objectives of an operating system? Select all that apply.',
          choices: ['Efficiency', 'Keeping the hardware design secret from programmers', 'Ability to evolve', 'Convenience', 'Running only one program at a time, so programs never compete'],
          answer: [0, 2, 3],
          why: 'An OS aims to be convenient to use, to use the hardware efficiently, and to be able to evolve. It hides hardware details to make programming convenient, not to keep them secret, and running one program at a time would leave the processor idle during every wait, the opposite of efficiency.' },
        { type: 'num', q: 'A program works in a repeating pattern: it computes for 2 ms, then waits 8 ms for the disk to deliver its next block of data. If the OS runs no other program, what percentage of the time does the processor sit idle?',
          answer: 80, tol: 0.5, unit: '%', hint: 'Idle fraction = waiting time ÷ length of one whole cycle.',
          why: 'One cycle lasts 2 + 8 = 10 ms, and the processor has nothing to do for 8 of them: 8 ÷ 10 = 80% idle. Handing the processor to another program during those waits is how an OS meets its efficiency objective.' },
        { type: 'match', q: 'Match each everyday event to the OS service at work.',
          pairs: [
            ['You type a password before you reach the desktop', 'System access'],
            ['A program divides by zero and is stopped with an error message', 'Error detection and response'],
            ['The same print request works on any printer model', 'Access to I/O devices'],
            ['A monthly report shows how much processor time each user consumed', 'Accounting'],
            ['Double-clicking an icon loads a program into memory and starts it', 'Program execution'],
          ],
          why: 'Logging in controls who may use the system; a division by zero is a software error the OS must handle; a uniform interface hides device details; usage records are accounting; loading and starting a program is program execution.' },
        { type: 'bucket', q: 'Sort each error the OS must detect and respond to into the right kind.', buckets: ['Hardware error', 'Software error'],
          items: [['A memory chip returns a corrupted value', 0], ['A disk sector can no longer be read', 0], ['A device stops responding', 0], ['A program divides by zero', 1], ['A program tries to read a forbidden memory location', 1], ['A program requests something the OS cannot grant', 1]],
          why: 'Hardware errors come from memory or devices that fail or malfunction. Software errors come from what a program tries to do. In both cases the OS responds with the least damage it can: ending the program, retrying the operation, or reporting the error.' },
        { q: 'Which interface marks the boundary between hardware and software?',
          choices: ['The application binary interface (ABI)', 'The application programming interface (API)', 'The system call interface', 'The instruction set architecture (ISA)'],
          answer: 3,
          feedback: ['The ABI sits above that boundary: it combines the system call interface with the user part of the ISA.', 'The API works at the source-code level: library calls plus the user ISA.', 'System calls connect programs to the OS. Both sides of that line are software.', null],
          why: 'The ISA is the set of machine instructions the processor carries out. Below it is circuitry, above it is software. Its user part is open to every program; its system part is reserved for the OS.' },
        { q: 'A game was compiled for an x86-64 PC running Linux. On which machine will the <b>same executable file</b> run without any changes?',
          choices: ['An x86-64 PC running Windows', 'An ARM64 laptop running Linux', 'Another x86-64 PC running Linux', 'Any machine at all, as long as the game\'s source code used only a standard API'],
          answer: 2,
          feedback: ['Same ISA, but a different ABI: Windows has its own system call interface and conventions.', 'Same OS family, but an ARM processor cannot decode x86-64 instructions. The ISA differs, and so does the ABI.', null, 'A standard API helps only when you recompile the source. The question is about the unchanged executable.'],
          why: 'A binary runs unchanged only where the ABI matches, which means the same system call interface and the same user ISA.' },
        { type: 'tf', q: 'Source code written only to a standard API can be moved to another system that offers the same API by recompiling it, even if the new system has a different processor (ISA).', answer: true,
          why: 'The compiler for the new system produces fresh machine code for its ISA that follows its ABI. For source code, the interface that must match is the API.' },
        { q: 'Why is the operating system an unusual kind of control mechanism?',
          choices: ['It is a program run by the same processor it manages, so it must give the processor away and depend on the hardware to get it back', 'It runs on a separate processor of its own that watches the main processor and every program continuously', 'It is permanently wired into the hardware circuits, so it can never be changed or updated after it ships', 'It never gives up control of the processor, so user programs can only run inside the OS itself'],
          answer: 0,
          feedback: [null, 'In an ordinary computer the OS runs on the same processor as the programs it manages. Nothing watches continuously.', 'The OS is software. It can be updated, and it constantly is.', 'If it never let go, user programs could not run directly on the processor, and they do.'],
          why: 'A thermostat sits outside the furnace it controls; the OS does not. While a user program runs, the OS is not running at all. It regains control only when the hardware hands it back: a system call, or an interrupt from a device, the timer or a program error.' },
        { type: 'multi', q: 'Which statements about the OS as a resource manager are true? Select all that apply.',
          choices: ['It runs on a separate processor of its own, so it can watch user programs continuously', 'It decides how processor time, main memory, I/O devices and files are shared among programs', 'The whole OS, including every utility, stays in main memory at all times', 'Its kernel (nucleus), which holds the most frequently used functions, stays in main memory', 'It decides which machine instructions the processor is able to understand'],
          answer: [1, 3],
          why: 'The OS allocates processor time, memory, devices and files. Only the kernel (nucleus) stays resident; other parts of the OS and the utilities are loaded when needed. The OS runs on the same processor it manages, and the instruction set is fixed by the hardware: the OS can only use it.' },
        { type: 'order', q: 'Put these moments in order for an OS running a program that reads a file.',
          items: ['The OS gives the program memory and arms the timer', 'The OS dispatches the program', 'The program makes a system call to read a file', 'The OS starts the disk and runs another program meanwhile', 'The disk\'s interrupt hands control back to the OS'],
          why: 'The OS sets things up and hands over the processor, gets it back through the system call, keeps the processor busy while the disk works, and regains control when the disk interrupts.' },
        { q: 'Engineers must add support for a new kind of graphics display. Which OS design makes that change easiest and least risky?',
          choices: ['One where every part reads and changes every other part\'s data directly, for speed', 'One kept small and simple by skipping documentation of its internal interfaces', 'One built from modules with clearly defined, documented interfaces', 'One that is frozen and never updated after it ships, so nothing can break'],
          answer: 2,
          feedback: ['Then the change ripples into every part that touched the display, and each edit risks a new fault.', 'Without documentation nobody knows which parts depend on what, so every change is a gamble.', null, 'A frozen OS cannot use new hardware at all. The ability to evolve is one of its three objectives.'],
          why: 'Hardware upgrades, new services and fixes keep arriving, and fixes can bring new faults. Modules behind clear, documented interfaces keep each change inside the part it concerns.' },
      ],
    },
  ],

  notes: `
    <h3>What an operating system is for</h3>
    <p>An <b>operating system (OS)</b> is a program that <b>controls the execution of application programs</b> and acts as the <b>interface</b> between those programs and the computer hardware. It pursues three objectives:</p>
    <ul>
      <li><b>Convenience</b>: make the computer easy to use (files and windows instead of disk blocks and device commands).</li>
      <li><b>Efficiency</b>: use the hardware well. Example: a program that computes for 2 ms, then waits 8 ms for the disk, leaves a processor that runs only it idle 8 ÷ 10 = <b>80%</b> of the time. The OS fills those waits by running another program.</li>
      <li><b>Ability to evolve</b>: let new hardware, new services and fixes be added without getting in the way of existing services.</li>
    </ul>
    <p>The goals can conflict: a rich graphical interface (convenience) costs processor time and memory (efficiency).</p>

    <h3>The OS as a user/computer interface</h3>
    <p>Layers, top to bottom: <b>end user → application programs → utilities (and libraries) → operating system → computer hardware</b>. Each layer uses the one below through an agreed interface and hides it from the layers above.</p>
    <ul>
      <li><b>End user</b>: sees only applications and never needs to know how the hardware works.</li>
      <li><b>Application programmer</b>: writes applications using the utilities (editors, compilers, debuggers, libraries) and the OS's services.</li>
      <li><b>OS designer</b>: must master the hardware below and design services for the programs above.</li>
    </ul>
    <p><b>Utilities</b> are system programs shipped with the OS. They are not the kernel: they ask the OS for services like any application. A <b>library</b> holds ready-made routines (such as <code>fopen</code> or <code>fwrite</code>) that often make system calls for the program.</p>
    <p><b>Saving a document:</b> Ctrl+S → application → library call → <b>system call</b> (the processor enters kernel mode, inside the OS) → the OS's <b>device driver</b> sends the drive its commands → the drive raises an <b>interrupt</b> when done → the result travels back up.</p>

    <h4>The seven services an OS provides</h4>
    <ol>
      <li><b>Program development</b>: editors, compilers and debuggers. They come with the OS but are, strictly, utilities.</li>
      <li><b>Program execution</b>: loading instructions and data into memory, preparing files and I/O devices, then starting the program.</li>
      <li><b>Access to I/O devices</b>: each device has its own commands and control signals; the OS offers one uniform interface (read, write).</li>
      <li><b>Controlled access to files</b>: the OS understands the storage device and how data is laid out on it, so programs use file names; on shared systems it enforces who may read or change each file.</li>
      <li><b>System access</b>: on shared systems, controlling who may use the system at all and which resources each user may reach, and resolving conflicts over resources.</li>
      <li><b>Error detection and response</b>: <i>hardware errors</i> (a memory error, a device that fails or malfunctions) and <i>software errors</i> (division by zero, an attempt to reach a forbidden memory location, a request the OS cannot grant). The OS responds with the least damage it can: end the program, retry the operation, or simply report the error.</li>
      <li><b>Accounting</b>: usage statistics for each resource and performance monitoring (such as response time), for tuning, planning upgrades and, on multiuser systems, billing.</li>
    </ol>
    <h3>Three key interfaces</h3>
    <table>
      <tr><th>Interface</th><th>Made of</th><th>What it gives you</th></tr>
      <tr><td><b>ISA</b> (instruction set architecture)</td><td>The <b>user ISA</b> (arithmetic, loads, jumps; any program) plus the <b>system ISA</b> (privileged: interrupts, memory management, I/O; OS only)</td><td>The boundary between hardware and software. Machine code runs only on processors with the same ISA.</td></tr>
      <tr><td><b>ABI</b> (application binary interface)</td><td>The <b>system call interface</b> to the OS plus the <b>user ISA</b> (and conventions such as which registers carry arguments)</td><td><b>Binary portability</b>: the same executable runs unchanged on any system with the same ABI.</td></tr>
      <tr><td><b>API</b> (application programming interface)</td><td>High-level-language <b>library calls</b> plus the <b>user ISA</b></td><td><b>Source portability</b>: recompile the source on any system that offers the same API.</td></tr>
    </table>
    <p>Most programs reach system calls through library routines. If an ordinary program tries a system-ISA instruction, the processor refuses and hands control to the OS.</p>
    <h4>Portability rules, with a worked example</h4>
    <ul>
      <li>A <b>binary</b> runs unchanged only if the target has the <b>same ISA and the same ABI</b>.</li>
      <li><b>Source code</b> runs after recompiling if the target offers the <b>same API</b> (the target's compiler makes new code for its ISA and ABI).</li>
    </ul>
    <table>
      <tr><th>Built on x86-64 + Linux, moved to…</th><th>x86-64 Linux</th><th>x86-64 Windows</th><th>ARM64 Linux</th><th>ARM64 Windows</th></tr>
      <tr><td>Compiled binary</td><td>runs</td><td>no: ABI differs</td><td>no: ISA differs</td><td>no: both differ</td></tr>
      <tr><td>Source, standard C library only</td><td>runs</td><td>runs after recompiling</td><td>runs after recompiling</td><td>runs after recompiling</td></tr>
      <tr><td>Source that also calls <code>fork()</code></td><td>runs</td><td>no: API lacks fork()</td><td>runs after recompiling</td><td>no: API lacks fork()</td></tr>
    </table>
    <p><code>fork()</code> is a standard call on UNIX-like systems (Linux, macOS) that makes a copy of the running program as a new process; section 3.6 covers it in full. It is part of <b>POSIX</b>, the API those systems share. Windows has no fork().</p>

    <h3>The OS as resource manager</h3>
    <p>The OS manages <b>processor time</b> (who runs next, and for how long), <b>main memory</b> (who gets which part, together with memory-management hardware), <b>I/O devices</b> (when a program may use one) and <b>files</b> (where data lives, who may use it).</p>
    <p>It is an <b>unusual controller</b>. It is ordinary software executed by the very processor it manages, and it must <b>give up</b> the processor so programs can run. While a user program runs, the OS is not running at all; it relies on the hardware to get control back, through a <b>system call</b> or an <b>interrupt</b> (from a device, the <b>timer</b>, or a program error such as dividing by zero). Without a timer, a program stuck in a loop that makes no system call would keep the processor forever.</p>
    <p>The <b>kernel</b> (or <b>nucleus</b>) is the part of the OS that stays in main memory all the time and holds its most frequently used functions; other parts are loaded when needed.</p>
    <p><b>Trace:</b> the OS gives A and B memory, arms the timer, <b>dispatches</b> A → A's system call to read a file (OS back) → the OS starts the disk, dispatches B → disk interrupt (OS back; A ready) → B resumes → timer interrupt (OS back) → the OS dispatches A.</p>

    <h3>Ease of evolution</h3>
    <p>An OS keeps changing because of <b>hardware upgrades and new types of hardware</b> (paging hardware, which hands out memory in fixed-size pages; graphics displays replacing text terminals), <b>new services</b> requested by users, and <b>fixes</b>: every OS has faults, and a fix can itself introduce new faults.</p>
    <p>So an OS should be built from <b>modules</b> with <b>clearly defined interfaces</b> and <b>good documentation</b>, so a change stays inside the module it concerns. In a tangled design, where parts reach into each other's data, a change ripples into many parts, and every extra edit is another chance to add a fault (in this section's illustrative model: 13 edits and a new fault, versus 6 edits and none).</p>`,
});
