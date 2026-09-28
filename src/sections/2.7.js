/* Section 2.7 — Microsoft Windows Overview
   Original teaching material. Built step by step (see AUTHORING.txt). */
Guide.section({
  id: '2.7',
  title: 'Microsoft Windows Overview',
  short: 'Windows overview',
  summary: 'How Windows is built: executive, kernel and HAL, client/server subsystems, SMP threads and objects.',
  objectives: [
    'Trace the Windows NT line from 1993 to Windows 10 and 11 and explain how one design came to run on everything from tablets to servers.',
    'Name the kernel-mode parts of Windows (the executive and its managers, the kernel, the HAL, device drivers, windowing and graphics) and the four kinds of user-mode processes.',
    'Explain the client/server model inside Windows, how ALPC messages carry requests, and the four advantages of the design.',
    'Describe how Windows uses threads and symmetric multiprocessing to keep every processor busy.',
    'Explain Windows objects: the object manager, handles, security descriptors, named and unnamed objects, and control versus dispatcher objects.',
  ],
  terms: [
    ['Windows NT', 'The family of Microsoft operating systems designed from scratch in the early 1990s ("NT" first stood for New Technology). Every modern desktop and server version of Windows, including Windows 10 and Windows 11, is built on it.'],
    ['Executive', 'The upper layer of kernel-mode Windows. It holds the core OS services, organised as managers: I/O, cache, objects, plug and play, power, security, virtual memory, processes and threads, configuration, and the ALPC facility.'],
    ['Windows kernel', 'The layer beneath the executive that schedules threads, switches between processes, handles exceptions and interrupts, and keeps processors synchronized. Unlike the rest of the OS, its own code does not run in threads.'],
    ['Hardware abstraction layer (HAL)', 'A thin layer of kernel-mode code that turns generic hardware requests from the rest of Windows into the exact commands one platform needs, hiding differences in buses, DMA controllers, interrupt controllers and timers.'],
    ['Device driver', 'A kernel-mode module, loaded when needed, that knows how to operate one kind of device or file system and turns I/O requests into commands for it.'],
    ['Environment subsystem', 'A user-mode server process together with its DLLs that gives programs one operating-system "personality", meaning one set of API calls. Win32 is the main subsystem in Windows.'],
    ['Dynamic link library (DLL)', 'A file of shared code that is loaded into a process while it runs, so many programs can use the same functions without each carrying its own copy. Subsystem DLLs translate API calls into system calls.'],
    ['Win32 API', 'The main programming interface of Windows: thousands of documented functions, such as CreateFile, that applications call to use OS services.'],
    ['Service process', 'A background process that provides a service whether or not anyone is logged in, such as the print spooler or the event logger. The service control manager starts and stops it.'],
    ['Advanced local procedure call (ALPC)', 'The executive\'s fast message-passing facility between processes on the same computer. A client sends a request to a server\'s port and the server sends back a reply.'],
    ['Client/server model', 'A way of structuring software in which a client asks for a service by sending a message, and a server process does the work and sends back a reply.'],
    ['Remote procedure call (RPC)', 'A request that looks like an ordinary function call to the caller but is carried out by messages to a server, which may be on the same computer or across a network.'],
    ['Symmetric multiprocessor (SMP)', 'A computer with two or more similar processors that share main memory and I/O, where any processor can run any work, including the operating system itself.'],
    ['Object manager', 'The executive component that creates, names, tracks and deletes every Windows object and hands out the handles programs use to reach them.'],
    ['Handle', 'A small number, private to one process, that stands for an object the process has opened. It indexes the process\'s handle table; programs never get a direct pointer to the object.'],
    ['Security descriptor', 'Data attached to an object that records its owner and which users or groups may do what with it. It is checked whenever someone opens a handle to the object.'],
    ['Dispatcher object', 'A kernel object that threads can wait on. It is either signaled or not signaled, and waiting threads are released when it becomes signaled. Events, mutexes, semaphores, timers, threads and processes are examples.'],
    ['Control object', 'A kernel object used to control how the kernel itself operates, rather than to synchronize threads: asynchronous procedure call, deferred procedure call, interrupt, process and profile objects. (The process object is also waitable, so it belongs to both families.)'],
    ['Encapsulation', 'Hiding an object\'s data inside it so that outsiders can use the object only through the operations (methods) it offers.'],
    ['Polymorphism', 'Using one operation on objects of different types, with each type supplying its own meaning for that operation.'],
  ],

  css: `
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width and the page scrolls sideways */
    .sec-2-7 .step-eyebrow { contain: inline-size; }
    .sec-2-7 .hot { cursor: pointer; outline: none; }
    .sec-2-7 .hot .fr { transition: stroke-width .15s, opacity .2s; }
    .sec-2-7 .hot:hover .fr, .sec-2-7 .hot:focus-visible .fr { stroke-width: 3.5; }
    .sec-2-7 .hot.sel .fr { stroke-width: 4; }
    .sec-2-7 .dim-others .hot:not(.sel) { opacity: .42; }
    .sec-2-7 .info { display: flex; flex-direction: column; gap: 8px; }
    .sec-2-7 .info h3 { margin: 0; }
    .sec-2-7 .info p { font-size: 15.5px; line-height: 1.45; margin: 0; }
    .sec-2-7 .eg { font-size: 14.5px; line-height: 1.4; padding: 7px 11px; border-radius: 10px; background: var(--panel-3); border-left: 4px solid var(--chc); }
    .sec-2-7 .eg b { color: var(--chc); }
    .sec-2-7 .mgrs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 10px; height: 100%; }
    .sec-2-7 .mgr { display: flex; flex-direction: column; justify-content: center; gap: 2px; text-align: left; padding: 8px 14px; border: 2px solid color-mix(in srgb, var(--os) 35%, var(--line)); border-radius: 12px; background: var(--os-bg); color: var(--ink); cursor: pointer; font: inherit; transition: border-color .15s, background .15s; }
    .sec-2-7 .mgr b { font-size: 16px; }
    .sec-2-7 .mgr span { font-size: 14px; color: var(--ink-2); line-height: 1.3; }
    .sec-2-7 .mgr:hover { border-color: var(--os); }
    .sec-2-7 .mgr.ok { border-color: var(--ok); background: var(--ok-bg); }
    .sec-2-7 .mgr.bad { border-color: var(--bad); background: var(--bad-bg); }
    .sec-2-7 .scen { font-size: 18px; line-height: 1.45; padding: 12px 14px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--line); min-height: 120px; }
    .sec-2-7 .scen .xs { letter-spacing: .08em; margin-bottom: 4px; }
    .sec-2-7 .dot { width: 22px; height: 8px; border-radius: 9px; background: var(--panel-3); display: inline-block; }
    .sec-2-7 .dot.cur { background: var(--chc); }
    .sec-2-7 .dot.ok { background: var(--ok); }
    .sec-2-7 .dot.warn { background: var(--warn); }
    .sec-2-7 .fb .callout { font-size: 15px; line-height: 1.45; }
    .sec-2-7 .xlate { display: grid; grid-template-columns: minmax(0, 2fr) auto minmax(0, 3fr); gap: 8px; align-items: stretch; }
    .sec-2-7 .xlate .box { text-align: left; font-size: 15px; line-height: 1.4; font-weight: 600; }
    .sec-2-7 .xlate .box .xs { letter-spacing: .06em; margin-bottom: 3px; }
    .sec-2-7 .xlate .arrow { align-self: center; font-size: 22px; font-weight: 900; color: var(--chc); }
    .sec-2-7 .adv { display: flex; flex-direction: column; gap: 2px; padding: 8px 11px; border: 2px solid var(--line); border-radius: 11px; background: var(--panel); transition: border-color .25s, background .25s; }
    .sec-2-7 .adv b { font-size: 15px; }
    .sec-2-7 .adv span { font-size: 13.5px; line-height: 1.35; color: var(--ink-2); }
    .sec-2-7 .adv.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); }
    .sec-2-7 .tok { transition: transform .6s ease, opacity .3s; pointer-events: none; }
    .sec-2-7 .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .sec-2-7 .kpi { display: flex; flex-direction: column; gap: 0; }
    .sec-2-7 .kpi .big { font-size: 32px; }
    .sec-2-7 .kpi .xs { letter-spacing: .05em; line-height: 1.25; }
    .sec-2-7 .objgrid { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 16px; height: 100%; }
    .sec-2-7 .pcol { gap: 5px; font-size: 14.5px; min-height: 0; }
    .sec-2-7 .hrow { font-size: 14px; padding: 4px 8px; border-radius: 8px; background: var(--panel); border: 1px solid var(--line); }
    .sec-2-7 .objc { padding: 6px 9px; border-radius: 9px; background: var(--panel); border: 1.5px solid color-mix(in srgb, var(--os) 45%, transparent); line-height: 1.35; }
    .sec-2-7 .objc .xs { font-size: 13px; overflow-wrap: anywhere; }
    .sec-2-7 .oorow { display: grid; grid-template-columns: minmax(0, 1fr) 272px; gap: 10px; align-items: center; padding: 4px 8px 4px 10px; border: 2px solid var(--line); border-radius: 11px; background: var(--panel); }
    .sec-2-7 .oorow .small { font-size: 14px; line-height: 1.35; }
    .sec-2-7 .oorow.miss { border-color: color-mix(in srgb, var(--warn) 60%, transparent); }
    .sec-2-7 .oorow.right { border-color: var(--ok); background: var(--ok-bg); }
    .sec-2-7 .oobtns { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; }
    .sec-2-7 .oobtns .btn { height: 25px; font-size: 13px; padding: 0 6px; }
    .sec-2-7 .bucket { display: flex; flex-direction: column; gap: 5px; padding: 10px; border: 2px dashed var(--line-2); border-radius: 12px; background: var(--panel-2); min-height: 0; }
    .sec-2-7 .bitem { font-size: 13.5px; line-height: 1.3; padding: 4px 8px; border-radius: 8px; background: var(--panel); border: 1px solid var(--line); }
  `,

  steps: [
    /* ---------------- 1. Big picture: one design, many machines + clickable NT timeline ---------------- */
    {
      title: 'One operating system, from tablets to server rooms',
      kind: 'story',
      render(el, ctx) {
        const { h, s } = ctx;
        const REL = [
          { n: 'NT 3.1', full: 'Windows NT 3.1', y: 1993,
            what: 'A brand-new design that did not sit on top of MS-DOS. Fully 32-bit, with preemptive multitasking, a protected memory space for every process, built-in security and support for several processors. It was written mostly in C so that it could run on several processor families, not just Intel chips.',
            see: 'The layered architecture you will explore in this section (executive, kernel, hardware abstraction layer or HAL, subsystems) was there from day one.' },
          { n: 'NT 4.0', full: 'Windows NT 4.0', y: 1996,
            what: 'Took on the friendly look of Windows 95. Under the hood, the window manager and graphics code moved out of a user-mode server process and into kernel mode, which made the screen draw much faster.',
            see: 'That is why <b>windowing and graphics</b> appears among the kernel-mode parts of Windows.' },
          { n: '2000', full: 'Windows 2000', y: 2000,
            what: 'Brought plug and play (devices recognised the moment you connect them) and proper power management to the NT line, plus Active Directory for managing whole networks of users and computers.',
            see: 'The executive\'s <b>plug-and-play manager</b> and <b>power manager</b>, in the form you meet in step 3, arrived in the NT line with this release.' },
          { n: 'XP', full: 'Windows XP', y: 2001,
            what: 'The first NT release aimed at home users. It replaced the MS-DOS-based line (Windows 95, 98 and Me), so from then on every Windows PC ran NT underneath. 64-bit editions followed.',
            see: 'Home and business machines now share one kernel, and every idea in this section applies to both.' },
          { n: 'Vista', full: 'Windows Vista', y: 2007,
            what: 'A big internal overhaul: stronger security (User Account Control), a new graphics driver model, and a faster message facility between processes, ALPC, which replaced the older LPC.',
            see: 'The <b>ALPC facility</b> in the executive, which carries client/server messages, arrived here.' },
          { n: '7', full: 'Windows 7', y: 2009,
            what: 'Refined and sped up Vista. Deep changes to the scheduler removed a single system-wide lock, so Windows could make good use of machines with far more processors (up to 256 logical processors).',
            see: 'This is the <b>symmetric multiprocessing</b> story of step 6: every processor can run OS code at the same time.' },
          { n: '8', full: 'Windows 8', y: 2012,
            what: 'Redesigned for touch screens and tablets, and shipped on ARM processors as well as Intel and AMD ones. The portable design, and the HAL in particular, made that move practical.',
            see: 'Step 4 shows how the <b>hardware abstraction layer</b> hides one platform\'s wiring from the rest of the OS.' },
          { n: '10', full: 'Windows 10', y: 2015,
            what: 'One shared core for PCs, tablets, phones, the Xbox and small embedded devices, kept up to date with regular feature updates instead of a big new version every few years. Windows 11 (2021) continues on the same core.',
            see: 'The same NT design, stretched from a phone-sized device to a data-centre server.' },
        ];
        let cur = 0;
        // phones get two rows of four releases so the labels stay readable
        const NW = ctx.narrow, VBW = NW ? 360 : 636;
        const X = REL.map((_, i) => (NW ? 45 + (i % 4) * 90 : 38 + i * 80));
        const Y = REL.map((_, i) => (NW && i >= 4 ? 142 : 46));
        const ROWS = NW ? [[0, 4, 46], [4, 8, 142]] : [[0, 8, 46]];
        const svg = s('svg', { viewBox: `0 0 ${VBW} ${NW ? 196 : 100}`, width: '100%', class: 'tl' });
        const head = h('h3', {});
        const what = h('p', {});
        const see = h('div', { class: 'eg' });
        const prev = h('button', { class: 'btn sm', onclick: () => show(cur - 1) }, '◀ Earlier');
        const next = h('button', { class: 'btn sm', onclick: () => show(cur + 1) }, 'Later ▶');
        function draw() {
          const kids = [];
          ROWS.forEach(([a, b, y]) => {
            kids.push(s('line', { x1: 20, y1: y, x2: VBW - 20, y2: y, class: 's-muted', 'stroke-width': 4 }));
            const reach = cur >= b ? VBW - 20 : cur >= a ? X[cur] : null; // progress bar up to the chosen release
            if (reach != null) kids.push(s('line', { x1: 20, y1: y, x2: reach, y2: y, style: 'stroke:var(--chc)', 'stroke-width': 4 }));
          });
          REL.forEach((r, i) => {
            const on = i === cur, y = Y[i];
            kids.push(s('g', { class: 'hot' + (on ? ' sel' : ''), role: 'button', tabindex: 0, 'aria-label': r.full, onclick: () => show(i), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); } } },
              s('circle', { cx: X[i], cy: y, r: 22, fill: 'transparent' }),
              s('circle', { class: 'fr ' + (on ? 's-accent' : i < cur ? 's-os' : 's-panel'), cx: X[i], cy: y, r: on ? 14 : 10, 'stroke-width': 2 }),
              s('text', { x: X[i], y: y - 28, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(r.y)),
              s('text', { x: X[i], y: y + 40, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': on ? 800 : 600, style: on ? 'fill:var(--accent)' : '' }, r.n)));
          });
          svg.replaceChildren(...kids);
        }
        function show(i) {
          cur = ctx.util.clamp(i, 0, REL.length - 1);
          const r = REL[cur];
          head.innerHTML = `${r.full} <span class="chip os" style="vertical-align:3px">${r.y}</span>`;
          what.innerHTML = r.what;
          see.innerHTML = '<b>Where you meet it: </b>' + r.see;
          prev.disabled = cur === 0; next.disabled = cur === REL.length - 1;
          draw();
        }
        const left = h('div', { class: 'stack', style: { gap: '10px' } },
          h('p', { class: 'lead m0', html: 'The same operating system has to run a thin tablet, a gaming laptop and a server with a hundred processors. Windows manages this with <b>one core design</b> that is more than thirty years old.' }),
          h('p', { class: 'm0', html: 'Early Windows (1.0 to 3.x, then 95, 98 and Me) was built on top of MS-DOS. In the early 1990s Microsoft started again from a blank page and built <span class="t">Windows NT</span>: a modular, portable, multitasking OS with security and multiprocessor support built in. Every version since, including Windows 10, Windows 11 and Windows Server, grew from that design.' }),
          h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'Car makers build a hatchback, a sedan and a delivery van on one shared chassis and engine. NT is Windows\' chassis: a tablet, a desktop and a server get different bodywork (user interface, bundled services, tuning) on the same core.' }),
          h('div', { class: 'row gap-s small' }, h('span', { class: 'muted' }, 'Same core today:'), ...['tablet', 'laptop', 'desktop', 'server', 'game console'].map((d) => h('span', { class: 'chip' }, d))));
        const right = h('div', { class: 'card white stack', style: { gap: '10px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'The NT family tree: click a release'), h('div', { class: 'row gap-s' }, prev, next)),
          svg,
          h('div', { class: 'info grow' }, head, what, see),
          h('div', { style: { borderTop: '1px dashed var(--line-2)', paddingTop: '8px' } },
            h('h4', {}, 'The five design ideas in this section'),
            h('div', { class: 'row gap-s' },
              h('span', { class: 'chip os' }, '1 · layered, modular kernel'), h('span', { class: 'chip io' }, '2 · HAL for portability'),
              h('span', { class: 'chip proc' }, '3 · client/server subsystems'), h('span', { class: 'chip thread' }, '4 · threads + SMP'),
              h('span', { class: 'chip accent' }, '5 · everything is an object'))));
        el.append(h('div', { class: 'split l fill' }, left, right));
        show(0);
      },
    },

    /* ---------------- 2. Architecture map: click every part, then follow a request ---------------- */
    {
      title: 'The Windows architecture map: click every part',
      kind: 'explore',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h, s } = ctx;
        const P = {
          sys: { r: [12, 30, 152, 98], c: 's-proc', t: ['Special system', 'processes'], sub: ['session manager,', 'logon, security'], mode: 'user', name: 'Special system processes',
            job: 'Processes Windows itself needs, started while the system boots. The <b>session manager</b> is the first user-mode process and sets up each user session. The <b>logon process</b> handles sign-in, the <b>authentication subsystem</b> checks passwords and gives each user a security identity, and the <b>service control manager</b> starts, stops and watches services.',
            eg: 'You press Ctrl+Alt+Del and type a password: the logon process and the authentication subsystem do the work.' },
          svc: { r: [180, 30, 152, 98], c: 's-proc', t: ['Service', 'processes'], sub: ['print spooler,', 'event logger…'], mode: 'user', name: 'Service processes',
            job: 'Background programs with no window of their own that provide a service whether or not anyone is logged in. The service control manager starts, stops and restarts them. Examples: the print spooler, the event logger, the update service, or a database server an administrator installed.',
            eg: 'You print a report: your app hands the job to the <b>print spooler</b> service, which feeds the printer while you keep working.' },
          env: { r: [348, 30, 152, 98], c: 's-proc', t: ['Environment', 'subsystems'], sub: ['Win32 is the', 'main one'], mode: 'user', name: 'Environment subsystems',
            job: 'Each subsystem gives programs an operating-system <b>personality</b>: the set of API calls they were written for. A subsystem is a server process plus the DLLs that applications load. <span class="t">Win32 API</span> programs use the Win32 subsystem; early NT also offered OS/2 and POSIX personalities.',
            eg: 'The Win32 subsystem\'s server process is told about every new Win32 process and thread so it can keep its own records.' },
          apps: { r: [516, 30, 152, 98], c: 's-proc', t: ['User', 'applications'], sub: ['your EXE files', 'and their DLLs'], mode: 'user', name: 'User applications',
            job: 'Ordinary programs: an EXE file plus the <span class="t">DLLs</span> it loads. Each runs in <span class="t">user mode</span> in its own private memory, so a bug can crash the program but not the OS. Every OS service it needs is requested through an API such as Win32.',
            eg: 'A browser, a game or a text editor.' },
          dlls: { r: [180, 138, 488, 44], c: 's-panel', t: ['Subsystem DLLs (Win32 API) + ntdll.dll'], sub: ['turn documented API calls into native system calls'], mode: 'user', name: 'Subsystem DLLs',
            job: 'Libraries loaded into every application. They implement the documented API (for Win32: kernel32.dll, user32.dll, gdi32.dll and others) by translating each call into Windows\' own internal, undocumented <b>native</b> system services. Most calls go through ntdll.dll into the executive; window and drawing calls take a similar route into the windowing and graphics system. A few calls also send a message to the subsystem\'s server process.',
            eg: 'A call to CreateFile ends up in ntdll.dll\'s NtCreateFile, which executes the special instruction that enters kernel mode.' },
          exec: { r: [12, 226, 500, 128], c: 's-os', t: [], sub: [], mode: 'kernel', name: 'Executive',
            job: 'The upper layer of kernel-mode Windows and home of the core OS services. It is organised as a set of <b>managers</b> (the ten tiles), each owning one job. Applications reach them only through system calls; inside the kernel the managers call one another and the kernel directly.',
            eg: 'Click any tile for its job, or try the "who handles it?" game in step 3.' },
          win: { r: [524, 226, 144, 128], c: 's-os', t: ['Windowing', 'and graphics'], sub: ['windows, menus,', 'text, images'], mode: 'kernel', name: 'Windowing and graphics system',
            job: 'Kernel-mode code that manages windows, menus and keyboard and mouse focus, and draws text and images. Windows NT 4.0 moved it from a user-mode server process into kernel mode to make drawing faster.',
            eg: 'You drag a window across the screen and it redraws smoothly.' },
          kern: { r: [12, 364, 330, 40], c: 's-os', t: ['Kernel'], sub: ['scheduling · interrupts · sync'], mode: 'kernel', name: 'Kernel',
            job: 'The core beneath the executive. Its four jobs: <b>thread scheduling</b>, <b>process switching</b>, <b>exception and interrupt handling</b>, and <b>multiprocessor synchronization</b>. Unlike the rest of the executive and user programs, the kernel\'s own code does not run in threads: it is the code that hands out the threads\' turns.',
            eg: 'A timer interrupt fires; the kernel picks which thread runs next on that processor.' },
          hal: { r: [12, 412, 330, 42], c: 's-os', t: ['Hardware abstraction layer (HAL)'], sub: ['hides platform differences'], mode: 'kernel', name: 'Hardware abstraction layer (HAL)',
            job: 'Maps the generic hardware commands of the kernel and drivers onto the exact commands one platform needs. It hides differences such as the system bus, the DMA controller, the interrupt controller and the timers, so the rest of Windows barely changes from one machine to another.',
            eg: 'Step 4 lets you swap the platform and watch what changes.' },
          drv: { r: [354, 364, 314, 90], c: 's-io', t: ['Device drivers'], sub: ['disk, network, USB,', 'file systems…'], mode: 'kernel', name: 'Device drivers',
            job: 'Kernel-mode modules, loaded as needed, that extend the executive. Each one operates one kind of device, or implements a file system or network protocol, by turning I/O requests into device commands. Because they run in kernel mode, one buggy driver can crash the whole system.',
            eg: 'Plug in a new printer and its driver is loaded so the I/O manager can talk to it.' },
          hw: { r: [12, 466, 656, 30], c: 's-panel', t: ['Hardware: processors · memory · interrupt controller · timers · buses · devices'], sub: [], mode: 'hw', name: 'Hardware',
            job: 'The physical machine. Only kernel-mode code (the kernel, the HAL and drivers) touches it directly; everything else asks the OS.',
            eg: 'The disk controller, network card, keyboard and screen all live here.' },
        };
        const TILES = [
          ['io', 'I/O', 'manager', 'I/O manager', 'The hub for all input and output. It gives every device and file system one common interface, packs each request into an <b>I/O request packet (IRP)</b> and passes it down to the right drivers.', 'Reading a file, sending a network packet and printing all start here.'],
          ['cache', 'Cache', 'manager', 'Cache manager', 'Keeps recently used parts of files in main memory so repeated reads come from RAM instead of the disk, and collects writes to send to the disk later in larger batches. It serves every file system.', 'Open a big document twice: the second time it appears almost instantly.'],
          ['obj', 'Object', 'manager', 'Object manager', 'Creates, names, tracks and deletes every Windows object: files, processes, threads, events and more. Programs get a <span class="t">handle</span>, never a pointer, and the object is freed when nobody uses it any more.', 'Step 7 lets you create, share and close objects yourself.'],
          ['pnp', 'Plug and', 'play mgr', 'Plug-and-play manager', 'Notices when hardware is added or removed, works out which driver each device needs, and loads it.', 'Plug in a USB drive and it appears within seconds.'],
          ['pwr', 'Power', 'manager', 'Power manager', 'Coordinates power use: moves the whole system and individual devices into low-power states such as sleep and hibernate and back again, and turns off idle hardware to save energy.', 'Close the laptop lid and it goes to sleep in the right order.'],
          ['srm', 'Security', 'ref. monitor', 'Security reference monitor', 'Enforces access rules. Whenever a program opens an object, it compares the user\'s identity with the object\'s <span class="t">security descriptor</span> and decides which operations are allowed. It also writes audit records.', 'Opening another user\'s private file fails with "access denied".'],
          ['vm', 'Virtual', 'memory mgr', 'Virtual memory manager', 'Gives every process its own large private address space and maps its virtual addresses onto physical memory, moving pages between main memory and disk as needed.', 'A program touches a page that was moved out to disk; the VM manager brings it back.'],
          ['pt', 'Process/', 'thread mgr', 'Process/thread manager', 'Creates, tracks and deletes process and thread objects. (Choosing which thread runs on which processor is the kernel\'s job, not this manager\'s.)', 'Starting an app creates a process with its first thread.'],
          ['cfg', 'Config-', 'uration mgr', 'Configuration manager', 'Manages the <b>registry</b>: the system-wide database of settings for hardware, drivers, services, applications and users.', 'Which driver a device needs, and your desktop background, are both registry settings.'],
          ['alpc', 'ALPC', 'facility', 'ALPC facility', 'Advanced local procedure call: fast message passing between processes on the same computer. It carries requests from clients to servers such as subsystems and services.', 'Step 5 animates a client/server exchange over ALPC.'],
        ];
        TILES.forEach(([id, a, b, name, job, eg], k) => { P[id] = { r: [22 + (k % 5) * 97, 256 + Math.floor(k / 5) * 48, 88, 42], c: 's-os', t: [a, b], sub: [], mode: 'kernel', name, job, eg, tile: true }; });
        // phones: a tall, narrow version of the same map so every label stays readable
        if (ctx.narrow) {
          const NR = { sys: [8, 28, 168, 72], svc: [184, 28, 168, 72], env: [8, 108, 168, 72], apps: [184, 108, 168, 72], dlls: [8, 188, 344, 44], exec: [8, 278, 344, 262],
            win: [8, 548, 344, 48], kern: [8, 604, 344, 46], hal: [8, 658, 344, 46], drv: [8, 712, 344, 50], hw: [8, 780, 344, 58] };
          Object.entries(NR).forEach(([id, r]) => { P[id].r = r; });
          TILES.forEach(([id], k) => { P[id].r = [18 + (k % 2) * 166, 314 + Math.floor(k / 2) * 45, 158, 40]; });
          Object.assign(P.dlls, { t: ['Subsystem DLLs + ntdll.dll'], sub: ['turn API calls into native system calls'] });
          Object.assign(P.win, { t: ['Windowing and graphics'], sub: ['windows, menus, text, images'] });
          Object.assign(P.drv, { sub: ['disk, network, USB, file systems…'] });
          Object.assign(P.hw, { t: ['Hardware'], sub: ['processors · memory · interrupt controller', 'timers · buses · devices'] });
        }
        const L = ctx.narrow ? { W: 360, H: 846, user: [2, 2, 356, 236], uy: 19, line: 244, kern: [2, 250, 356, 522], ky: 268 }
          : { W: 680, H: 500, user: [4, 4, 672, 188], uy: 21, line: 196, kern: [4, 200, 672, 262], ky: 218 };
        const ORDER = ['sys', 'svc', 'env', 'apps', 'dlls', 'exec', ...TILES.map((t) => t[0]), 'win', 'kern', 'hal', 'drv', 'hw'];
        const F = [
          { sel: ['apps'], at: 'apps', m: 'user', cap: '<b>The application asks.</b> A text editor wants to open <code>notes.txt</code>, so it calls <code>CreateFile</code>, a function of the <span class="t">Win32 API</span>. We are in user mode, inside the editor\'s own process.' },
          { sel: ['dlls'], at: 'dlls', m: 'user', cap: '<b>The subsystem DLL translates.</b> CreateFile lives in a Win32 DLL loaded into the editor. It checks the arguments and calls the native service <code>NtCreateFile</code> in ntdll.dll, the last stop in user mode.' },
          { sel: ['kern'], at: 'kern', m: 'kernel', line: true, cap: '<b>System call.</b> ntdll executes a special instruction that switches the processor into kernel mode. The kernel\'s trap handler looks up the service number and calls the executive routine for NtCreateFile. A program has no other way in.' },
          { sel: ['io', 'obj'], at: 'obj', m: 'kernel', cap: '<b>Find the name.</b> The I/O manager takes charge and asks the object manager to look up the path. The object manager follows the name to drive C:, whose files are managed by a file system driver.' },
          { sel: ['io', 'drv'], at: 'io', m: 'kernel', cap: '<b>Package the request.</b> The I/O manager creates a file object for this open and packs the request into an <b>I/O request packet (IRP)</b>, which it hands to the file system driver.' },
          { sel: ['drv', 'hal'], at: 'hal', m: 'kernel', cap: '<b>Read the disk, through the HAL.</b> The file system driver needs the file\'s directory entry and its <span class="t">security descriptor</span>. If they are not already in memory, it passes a read to the disk driver, which programs the disk controller and calls HAL routines for platform-specific work such as setting up DMA.' },
          { sel: ['hw'], at: 'hw', m: 'hardware', cap: '<b>The hardware works.</b> The disk controller copies the data into memory by DMA while the processors run other threads (the editor\'s thread waits). When it finishes, it raises an <span class="t">interrupt</span>.' },
          { sel: ['kern', 'drv'], at: 'kern', m: 'kernel', cap: '<b>Interrupt handled.</b> The kernel runs the disk driver\'s interrupt routine, which does the urgent part and queues a deferred procedure call to finish the rest. The read completes, and the kernel makes the editor\'s waiting thread ready to run again.' },
          { sel: ['drv', 'srm'], at: 'srm', m: 'kernel', cap: '<b>Check permission.</b> The file system driver asks the security reference monitor to compare the user\'s identity with the file\'s security descriptor. Reading is allowed, so the open goes ahead; otherwise it would fail right here with "access denied".' },
          { sel: ['obj', 'apps'], at: 'apps', m: 'user', line: true, cap: '<b>A handle comes back.</b> The object manager puts a <span class="t">handle</span> to the new file object in the editor\'s handle table, along with the access just granted. The call returns to user mode and CreateFile gives the editor the handle.' },
        ];
        let mode = 'explore', selId = null, frame = 0;
        const svg = s('svg', { viewBox: `0 0 ${L.W} ${L.H}`, width: '100%' });
        function labels(p) {
          const [x, y, w, hh] = p.r, cx = x + w / 2, cy = y + hh / 2;
          const lh1 = p.tile ? 15 : 17, lh2 = 16;
          let yy = cy - (p.t.length * lh1 + p.sub.length * lh2) / 2 + (p.tile ? 11 : 12);
          const out = [];
          p.t.forEach((t) => { out.push(s('text', { x: cx, y: yy, 'text-anchor': 'middle', 'font-size': p.tile ? 13 : 14.5, 'font-weight': p.tile ? 700 : 800 }, t)); yy += lh1; });
          p.sub.forEach((t) => { out.push(s('text', { x: cx, y: yy + 1, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, t)); yy += lh2; });
          return out;
        }
        function draw() {
          const f = F[frame];
          const selSet = new Set(mode === 'explore' ? (selId ? [selId] : []) : f.sel);
          const lineOn = mode === 'follow' && f.line;
          const [ux, uy, uw, uh] = L.user, [kx, ky, kw, kh] = L.kern;
          const kids = [
            s('rect', { x: ux, y: uy, width: uw, height: uh, rx: 14, style: 'fill:var(--panel-2);stroke:var(--line)' }),
            s('text', { x: ux + 12, y: L.uy, 'font-size': 13, 'font-weight': 800, 'letter-spacing': 1.5, class: 's-sub' }, 'USER MODE'),
            s('rect', { x: kx, y: ky, width: kw, height: kh, rx: 14, style: 'fill:color-mix(in srgb, var(--os) 7%, var(--panel));stroke:color-mix(in srgb, var(--os) 40%, transparent)' }),
            s('text', { x: kx + 12, y: L.ky, 'font-size': 13, 'font-weight': 800, 'letter-spacing': 1.5, style: 'fill:var(--os)' }, 'KERNEL MODE'),
            s('text', { x: kx + kw - 8, y: L.ky - 2, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'system calls cross the dashed line'),
            s('line', { x1: ux, y1: L.line, x2: ux + uw, y2: L.line, 'stroke-dasharray': '9 6', 'stroke-width': lineOn ? 4 : 2, style: lineOn ? 'stroke:var(--accent)' : 'stroke:var(--ink-2)' }),
          ];
          for (const id of ORDER) {
            const p = P[id], [x, y, w, hh] = p.r;
            const g = s('g', { class: 'hot' + (selSet.has(id) ? ' sel' : ''), role: 'button', tabindex: 0, 'aria-label': p.name, onclick: () => pick(id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); } } },
              s('rect', { class: 'fr ' + p.c, x, y, width: w, height: hh, rx: p.tile ? 8 : 10, 'stroke-width': 2 }), ...labels(p));
            if (id === 'exec') g.append(s('text', { x: x + 12, y: y + 20, 'font-size': 15, 'font-weight': 800 }, 'Executive'), s('text', { x: x + w - 12, y: y + 20, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'ten managers, one job each'));
            kids.push(g);
          }
          if (mode === 'follow') {
            const seen = {};
            F.slice(0, frame + 1).forEach((fr, k) => {
              const [x, y, w] = P[fr.at].r, n = (seen[fr.at] = (seen[fr.at] || 0) + 1);
              const tile = P[fr.at].tile, bx = (tile ? x + w : x + w - 12) - (n - 1) * 26, by = tile ? y + 4 : y + 12, on = k === frame;
              kids.push(s('g', { style: 'pointer-events:none' },
                s('circle', { cx: bx, cy: by, r: 12, class: on ? '' : 's-panel', style: on ? 'fill:var(--accent);stroke:var(--accent)' : '', 'stroke-width': 2 }),
                s('text', { x: bx, y: by + 4.5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: on ? 'fill:var(--accent-ink)' : '' }, String(k + 1))));
            });
          }
          svg.classList.toggle('dim-others', selSet.size > 0);
          svg.replaceChildren(...kids);
        }
        const info = h('div', { class: 'card white info grow' });
        const INTRO = '<h3>How to read the map</h3><p>The <b>top half</b> is user mode: ordinary processes, each in its own protected memory. The <b>bottom half</b> is kernel mode: the parts of Windows that run with full hardware privileges and share one address space.</p><p>A program crosses the dashed line only through a <b>system call</b>: a controlled request that switches the processor into kernel mode. Colours follow the guide\'s language: <span class="chip proc">processes</span> <span class="chip os">OS / kernel</span> <span class="chip io">drivers and devices</span>.</p><div class="eg"><b>Try it: </b>click any box on the map, including each of the ten executive managers. Then switch to <b>Follow a request</b>.</div>';
        function showInfo() {
          if (!selId) { info.innerHTML = INTRO; return; }
          const p = P[selId];
          const chip = p.mode === 'user' ? '<span class="chip proc">user mode</span>' : p.mode === 'kernel' ? '<span class="chip os">kernel mode</span>' : '<span class="chip">hardware</span>';
          info.innerHTML = `<div class="row gap-s">${chip}${p.tile ? '<span class="chip os">executive manager</span>' : ''}</div><h3>${p.name}</h3><p>${p.job}</p><div class="eg"><b>Example: </b>${p.eg}</div>`;
        }
        const MODECHIP = { user: '<span class="chip proc">user mode</span>', kernel: '<span class="chip os">kernel mode</span>', hardware: '<span class="chip io">hardware</span>' };
        const player = ctx.ui.player({ count: F.length, interval: 3200, captionBelow: true, speed: false,
          render: (i) => { frame = i; if (mode === 'follow') draw(); return MODECHIP[F[i].m] + ' ' + F[i].cap; } });
        player.caption.style.minHeight = '150px';
        const follow = h('div', { class: 'stack grow', style: { display: 'none' } },
          h('p', { class: 'small m0', html: 'An editor opens <code>notes.txt</code>. Step through the ten hops; numbered badges mark the path on the map.' }),
          player.el,
          h('div', { class: 'callout why m0', 'data-label': 'Why so many hops?', html: 'Each part does one job and knows nothing about the others\' insides. Microsoft can replace a driver, port the HAL or add a subsystem without rewriting the rest.' }));
        function setMode(m) {
          mode = m; seg.set(m);
          info.style.display = m === 'explore' ? '' : 'none';
          follow.style.display = m === 'follow' ? '' : 'none';
          if (m === 'follow') player.stop();
          draw(); ctx.refit();
        }
        function pick(id) { selId = selId === id && mode === 'explore' ? null : id; if (mode !== 'explore') setMode('explore'); showInfo(); draw(); }
        const seg = ctx.ui.seg([{ value: 'explore', label: 'Explore the parts' }, { value: 'follow', label: 'Follow a request' }], 'explore', setMode);
        el.append(h('div', { class: 'split r fill', style: { gridTemplateColumns: 'minmax(0, 680px) minmax(0, 1fr)' } },
          h('div', { class: 'card tight', style: { display: 'grid', placeItems: 'center', padding: '6px' } }, svg),
          h('div', { class: 'stack' }, seg, info, follow)));
        showInfo(); draw();
      },
    },

    /* ---------------- 3. Inside the executive: route each request to the right manager ---------------- */
    {
      title: 'Inside the executive: who handles this request?',
      kind: 'lab',
      render(el, ctx) {
        const { h } = ctx;
        const M = [
          ['io', 'I/O manager', 'routes every I/O request down to the right drivers'],
          ['cache', 'Cache manager', 'keeps recently used file data in main memory'],
          ['obj', 'Object manager', 'creates, names, tracks and deletes objects'],
          ['pnp', 'Plug-and-play manager', 'spots new or removed devices, loads drivers'],
          ['pwr', 'Power manager', 'moves the system and devices between power states'],
          ['srm', 'Security reference monitor', 'checks who may do what to an object'],
          ['vm', 'Virtual memory manager', 'maps virtual addresses, moves pages to and from disk'],
          ['pt', 'Process/thread manager', 'creates, tracks and deletes processes and threads'],
          ['cfg', 'Configuration manager', 'implements and manages the registry'],
          ['alpc', 'ALPC facility', 'passes messages between processes on one computer'],
        ];
        const NAME = Object.fromEntries(M.map((m) => [m[0], m[1]]));
        const JOB = Object.fromEntries(M.map((m) => [m[0], m[2]]));
        const Q = [
          ['pnp', 'You plug a USB drive into a laptop. Something must notice the new device, work out which driver it needs and load that driver.', 'Detecting hardware that is added or removed, and loading the right driver for it, is the plug-and-play manager\'s job.'],
          ['srm', 'A program tries to open <code>salaries.xlsx</code> for writing. Is this user allowed to change that file?', 'The security reference monitor compares the user\'s identity with the file\'s security descriptor, then allows or denies the access.'],
          ['vm', 'A program touches an address whose page was moved out to disk. The page must come back into RAM and the address mapping must be fixed.', 'Mapping virtual addresses onto physical memory, and moving pages between memory and disk, is the virtual memory manager\'s work.'],
          ['cache', 'You open a large file, close it, and open it again. The second time it appears instantly because its data is still in main memory.', 'The cache manager keeps recently used file data in RAM on behalf of every file system, so the repeat read skips the disk.'],
          ['pwr', 'You close the laptop lid. The screen, disk and Wi-Fi must enter low-power states in the right order, and wake up again later.', 'Moving the whole system and its devices between power states is the power manager\'s job.'],
          ['pt', 'A game starts a second thread to load music in the background while you keep playing.', 'Creating, tracking and deleting processes and threads is the process/thread manager\'s job. The kernel then schedules the new thread onto a processor.'],
          ['cfg', 'During start-up, Windows looks up which drivers to load and reads your saved settings from the registry.', 'The configuration manager implements the registry, the system-wide database of settings.'],
          ['alpc', 'An application must send a request message to the Win32 subsystem\'s server process and wait for the reply.', 'Fast message passing between processes on the same computer is what the ALPC facility provides. It carries Windows\' client/server traffic.'],
          ['obj', 'Every file, event, process and thread the OS creates must be named or given a handle, tracked, and deleted once nobody uses it.', 'The object manager is the single place that creates, names, tracks and deletes all Windows objects.'],
          ['io', 'A program writes to a file. The request has to be packaged and passed to the file system driver, then on to the disk driver.', 'The I/O manager packs each request into an I/O request packet (IRP) and passes it through the right drivers.'],
        ];
        let order = Q.map((_, i) => i), k = 0, tries = 0, solved = false;
        const res = [];
        const count = h('h4', { class: 'm0' });
        const score = h('span', { class: 'chip ok' });
        const dots = h('div', { class: 'row gap-s' });
        const scen = h('div', { class: 'scen' });
        const fb = h('div', { class: 'fb' });
        const nextB = h('button', { class: 'btn primary', onclick: () => { k++; tries = 0; solved = false; paint(); } }, 'Next request ▶');
        const againB = h('button', { class: 'btn', onclick: () => { order = ctx.util.shuffle(Q.map((_, i) => i)); k = 0; tries = 0; solved = false; res.length = 0; paint(); } }, 'Start over (shuffled)');
        const tiles = M.map(([id, name, job]) => h('button', { class: 'mgr', type: 'button', 'data-id': id, onclick: () => answer(id) }, h('b', {}, name), h('span', {}, job)));
        function answer(id) {
          if (solved || k >= Q.length) return;
          const q = Q[order[k]];
          const t = tiles.find((b) => b.dataset.id === id);
          tries++;
          if (id === q[0]) {
            solved = true; res[k] = tries === 1 ? 'ok' : 'warn';
            t.classList.add('ok');
            fb.innerHTML = `<div class="callout tip m0" data-label="${tries === 1 ? 'Right, first try' : 'Right'}">${q[2]}</div>`;
          } else {
            t.classList.add('bad');
            const nm = NAME[id].replace(/^([A-Z])(?=[a-z])/, (c) => c.toLowerCase()); // "Security reference monitor" → "security reference monitor"; keeps I/O and ALPC
            fb.innerHTML = `<div class="callout warn m0" data-label="Not that one">The ${nm} ${JOB[id]}. That is not what this request needs. Read the request again: what is the <i>core</i> job being asked for?</div>`;
          }
          paintTop();
        }
        function paintTop() {
          const firstTry = res.filter((r) => r === 'ok').length;
          count.textContent = k < Q.length ? `Request ${k + 1} of ${Q.length}` : 'All requests routed';
          score.textContent = `${firstTry} right on the first try`;
          dots.replaceChildren(...Q.map((_, i) => h('span', { class: 'dot ' + (res[i] || (i === k ? 'cur' : '')) })));
          nextB.disabled = !solved;
          nextB.style.display = k < Q.length ? '' : 'none';
        }
        function paint() {
          tiles.forEach((b) => b.classList.remove('ok', 'bad'));
          if (k >= Q.length) {
            const firstTry = res.filter((r) => r === 'ok').length;
            scen.innerHTML = `<div class="xs b muted">SUMMARY</div><div>You routed all ${Q.length} requests, <b>${firstTry}</b> of them on the first try.</div>`;
            fb.innerHTML = `<div class="callout why m0" data-label="Why it matters">${firstTry === Q.length ? 'A perfect run. ' : ''}Ten managers, one job each: a change to how caching works touches only the cache manager, and every other manager keeps working unchanged. That is what "modular" buys Windows.</div>`;
          } else {
            scen.innerHTML = `<div class="xs b muted">INCOMING REQUEST</div><div>${Q[order[k]][1]}</div>`;
            fb.innerHTML = '<div class="callout m0" data-label="How to play">Click the manager that should handle this request. First ask what the request is really about: a device, memory, file data, permission, power, a setting, a message? Wrong picks explain what that manager really does.</div>';
          }
          paintTop();
        }
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack' },
            h('p', { class: 'm0', html: 'The <span class="t">executive</span> is organised as ten managers, and each owns exactly one job. Route every request to the manager that handles it.' }),
            h('div', { class: 'card white stack', style: { gap: '10px', flex: '1' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, count, score), dots, scen, fb,
              h('div', { class: 'row', style: { marginTop: 'auto' } }, nextB, againB))),
          h('div', { class: 'mgrs' }, ...tiles)));
        paint();
      },
    },

    /* ---------------- 4. Kernel + HAL: swap the platform, only the HAL changes ---------------- */
    {
      title: 'The kernel and the HAL: swap the hardware underneath',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        // same: what happens to the executive, drivers and kernel on this platform, compared with the desktop PC
        const SAME = { exec: ['unchanged ✓', 'ok'], drv: ['unchanged ✓', 'ok'], kern: ['unchanged ✓', 'ok'] };
        const PLAT = {
          pc: { name: 'Desktop PC', hal: 'HAL · x86-64 version', hw: 'x86-64 cores · APIC (interrupt controller) · HPET (timer chip) · PCI Express bus', same: SAME,
            foot: '<b>Only the HAL speaks this machine\'s wiring.</b> Pick another platform: the generic request never changes, only the HAL\'s answer does.' },
          arm: { name: 'ARM tablet', hal: 'HAL · ARM64 version', hw: 'ARM64 cores · GIC (interrupt controller) · ARM generic timer · on-chip buses', same: { exec: ['recompiled', 'thread'], drv: ['recompiled', 'thread'], kern: ['recompiled + small ARM-only part', 'thread'] },
            foot: '<b>A new processor family:</b> everything is recompiled from the same C source and the kernel gains a small ARM-only part, but only the HAL is written for this platform\'s wiring.' },
          srv: { name: 'Many-socket server', hal: 'HAL · x86-64, in x2APIC mode', hw: '128 cores on 4 chips · x2APIC (interrupt controllers) · many PCI Express buses', same: SAME,
            foot: '<b>Same processor family as the PC:</b> the executive, drivers and kernel are identical. The x86-64 HAL simply takes different paths for this bigger machine\'s wiring.' },
        };
        const REQ = {
          ack: { label: 'Acknowledge interrupt', from: 'kern',
            pc: 'Write an "end of interrupt" command into this core\'s local APIC, the PC\'s interrupt controller.',
            arm: 'Write an "end of interrupt" command into the GIC, the ARM interrupt controller, through its per-core registers.',
            srv: 'Write "end of interrupt" to the local APIC running in x2APIC mode, where it is reached through a special processor register instead of a memory address.' },
          timer: { label: 'Set a 1 ms timer', from: 'kern',
            pc: 'Load the local APIC timer (or the HPET chip) with the count that equals 1 ms on this machine.',
            arm: 'Load the ARM generic timer\'s compare register with "now + 1 ms".',
            srv: 'Load the local APIC timer of the chosen core; every one of the 128 cores has its own.' },
          ipi: { label: 'Interrupt core 3', from: 'kern',
            pc: 'Write to the local APIC\'s interrupt command register, naming core 3 as the target.',
            arm: 'Write a software-generated interrupt into the GIC, naming core 3 as the target.',
            srv: 'Write to the x2APIC interrupt command register; core 3 may sit on a different processor chip.' },
          dma: { label: 'Set up DMA', from: 'drv',
            pc: 'Turn the buffer\'s memory addresses into addresses the disk controller can use on the PCI Express bus, and give them to the device.',
            arm: 'Turn the buffer\'s addresses into ones an on-chip device can use, through the chip\'s own address-translation unit.',
            srv: 'Translate the buffer\'s addresses for a device on one of many PCI Express buses, attached to one particular processor chip.' },
        };
        let plat = 'pc', req = 'ack';
        const svg = ctx.narrow ? h('div', { class: 'stack', style: { gap: '6px' } }) : s('svg', { viewBox: '0 0 640 214', width: '100%', style: 'flex:none' });
        const out = h('div', { class: 'xlate', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0, 1fr)' } : {} });
        function row(id, x, y, w, hh, cls, label, chip, chipCol, sel) {
          return s('g', {},
            s('rect', { x, y, width: w, height: hh, rx: 10, class: cls, 'stroke-width': sel ? 4 : 2, style: sel ? 'stroke:var(--accent)' : '' }),
            s('text', { x: x + 14, y: y + hh / 2 + 5, 'font-size': 15, 'font-weight': 800 }, label),
            chip ? s('text', { x: x + w - 12, y: y + hh / 2 + 5, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 700, style: 'fill:var(--' + chipCol + ')' }, chip) : null);
        }
        function draw(flash) {
          const P = PLAT[plat], r = REQ[req], S = P.same;
          const kids = [
            row('exec', 0, 4, 270, 40, 's-os', 'Executive', S.exec[0], S.exec[1], false),
            row('drv', 280, 4, 280, 40, 's-io', 'Device drivers', S.drv[0], S.drv[1], r.from === 'drv'),
            row('kern', 0, 54, 560, 40, 's-os', 'Kernel', S.kern[0], S.kern[1], r.from === 'kern'),
            row('hal', 0, 104, 560, 44, 's-warn', P.hal, 'platform-specific', 'warn', true),
            s('rect', { x: 0, y: 158, width: 560, height: 52, rx: 10, class: 's-panel', 'stroke-width': 4, style: 'stroke:var(--accent)' }),
            s('text', { x: 14, y: 180, 'font-size': 15, 'font-weight': 800 }, 'Hardware: ' + P.name),
            s('text', { x: 14, y: 200, 'font-size': 13.5, class: 's-sub' }, P.hw),
            s('line', { x1: 600, y1: r.from === 'drv' ? 24 : 74, x2: 600, y2: 154, style: 'stroke:var(--accent)', 'stroke-width': 3, 'marker-end': 'url(#arr-accent)' }),
            s('text', { x: 616, y: 120, 'font-size': 13, 'font-weight': 700, transform: 'rotate(90 616 120)', 'text-anchor': 'middle', style: 'fill:var(--accent)' }, 'generic → specific'),
          ];
          if (ctx.narrow) {
            const lay = (cls, name, chip, col, on) => h('div', { class: 'box ' + cls, style: { textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', borderColor: on ? 'var(--accent)' : '' } }, h('span', {}, name), h('span', { class: 'small', style: { color: 'var(--' + col + ')' } }, chip));
            svg.replaceChildren(lay('os', 'Executive', S.exec[0], S.exec[1], false), lay('io', 'Device drivers', S.drv[0], S.drv[1], r.from === 'drv'), lay('os', 'Kernel', S.kern[0], S.kern[1], r.from === 'kern'),
              lay('', P.hal, 'platform-specific', 'warn', true), h('div', { class: 'box', style: { textAlign: 'left', borderColor: 'var(--accent)' } }, h('div', {}, 'Hardware: ' + P.name), h('div', { class: 'small muted', style: { fontWeight: 400 } }, P.hw)));
          } else svg.replaceChildren(...kids);
          out.innerHTML = `<div class="box os"><div class="xs b muted">GENERIC REQUEST (same on every machine)</div>${r.label}</div><div class="arrow">→</div><div class="box io"><div class="xs b muted">ON THE ${P.name.toUpperCase()}, THE HAL…</div>${r[plat]}</div>`;
          foot.innerHTML = P.foot;
          if (flash) { out.classList.remove('flash'); void out.offsetWidth; out.classList.add('flash'); }
          reqBtns.forEach((b) => b.classList.toggle('on', b.dataset.r === req));
        }
        const foot = h('p', { class: 'small m0' });
        const reqBtns = Object.entries(REQ).map(([k, r]) => h('button', { class: 'btn sm', 'data-r': k, onclick: () => { req = k; draw(true); } }, r.label));
        const seg = ctx.ui.seg(Object.entries(PLAT).map(([k, p]) => ({ value: k, label: p.name })), plat, (v) => { plat = v; draw(true); });
        const left = h('div', { class: 'stack', style: { gap: '10px' } },
          h('p', { class: 'lead m0', html: 'Below the executive sit the two layers closest to the hardware: the <span class="t">Windows kernel</span> and the <span class="t">HAL</span>.' }),
          h('div', { class: 'card os tight' },
            h('h4', {}, 'The kernel\'s four jobs'),
            h('ol', { class: 'small m0', html: '<li><b>Thread scheduling:</b> picks which thread runs next on each processor.</li><li><b>Process switching:</b> saves one process\'s state and loads another\'s.</li><li><b>Exception and interrupt handling:</b> takes control when a device interrupts or an error occurs.</li><li><b>Multiprocessor synchronization:</b> stops processors from colliding on shared kernel data.</li>' })),
          h('p', { class: 'small m0', html: 'Almost everything else, user programs and most executive work alike, runs in <span class="t">threads</span>. The kernel\'s own code does not: it is the code that creates the threads\' turns on the processor.' }),
          h('div', { class: 'callout warn small m0', 'data-label': 'The fine print', html: 'The HAL hides the <b>platform wiring</b> around the processor (bus, DMA, interrupt controller, timers), not the processor itself. A new processor family such as ARM also means recompiling the C source and rewriting a few thin processor-specific parts of the kernel.' }));
        const right = h('div', { class: 'card white stack', style: { gap: '10px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, '1 · Pick a platform'), seg),
          svg,
          h('h4', { class: 'm0' }, '2 · Send a generic request down'),
          h('div', { class: 'row gap-s' }, ...reqBtns),
          out,
          foot);
        el.append(h('div', { class: 'split l fill' }, left, right));
        draw(false);
      },
    },

    /* ---------------- 5. Client/server over ALPC: normal, crash, remote ---------------- */
    {
      title: 'Clients and servers: requests travel as messages',
      kind: 'explore',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h, s } = ctx;
        const ADV = [
          ['Simplifies the executive', 'The executive only carries messages. APIs and services live in server processes, so new ones can be added without changing it.'],
          ['Improves reliability', 'Each server is its own process with its own memory. A server that crashes is contained; the rest of the system keeps running.'],
          ['One uniform way to ask', 'Every service is reached the same way, by <span class="t">remote procedure call</span> (RPC). A small <b>stub</b> in the client packs each call into a message, so it looks like an ordinary function call.'],
          ['Ready for distribution', 'A server can move to another computer on the network while its clients keep making exactly the same calls.'],
        ];
        const base = [
          { at: 'client', tok: 'request', cth: 'running', t1: 'waiting', path: null, adv: 2, cap: '<b>Build a request.</b> The word processor (the client) calls a print function. A small <b>stub</b> packs the call and its parameters into a message addressed to the spooler\'s <b>port</b>, a named mailbox where the server collects requests. The client never learns where the spooler\'s code or data live.' },
          { at: 'mid', tok: 'request', cth: 'running', t1: 'waiting', path: 'req', adv: 0, cap: '<b>Send it through ALPC.</b> Sending is a system call: the processor enters kernel mode and the executive\'s <span class="t">ALPC</span> facility takes the message. The executive only carries it; it knows nothing about printing.' },
          { at: 'port', tok: 'request', cth: 'waiting', t1: 'waiting', path: 'req', adv: 0, cap: '<b>Deliver to the port.</b> ALPC puts the message in the spooler\'s port queue and wakes one of its waiting threads. The client\'s thread now waits for the reply.' },
        ];
        const MODES = {
          normal: base.concat([
            { at: 'srv', tok: 'request', cth: 'waiting', t1: 'working', path: null, adv: 0, cap: '<b>The server does the work.</b> Spooler thread T1 adds the job to the printer\'s queue. Thread T2 is serving a different client at the same moment.' },
            { at: 'mid', tok: 'reply', cth: 'waiting', t1: 'replying', path: 'rep', adv: 2, cap: '<b>Reply.</b> The spooler sends "job 17 queued" back through ALPC.' },
            { at: 'client', tok: 'reply', cth: 'running', t1: 'waiting', path: 'rep', adv: 2, cap: '<b>Carry on.</b> The client\'s thread wakes with the reply. The two processes never touched each other\'s memory: everything went through messages.' },
          ]),
          crash: base.concat([
            { at: 'srv', tok: null, cth: 'waiting', sv: 'crashed', path: null, adv: 1, cap: '<b>The server crashes.</b> A bug kills the spooler process while it works on the request. Only that process dies: its private memory is thrown away, and the executive and every other process keep running.' },
            { at: 'mid', tok: 'error', cth: 'waiting', sv: 'crashed', path: 'err', adv: 1, cap: '<b>An error instead of a reply.</b> ALPC sees that the server\'s port has closed and hands the waiting client an error.' },
            { at: 'client', tok: 'error', cth: 'running', sv: 'restarted', t1: 'waiting', t2: 'waiting', path: 'err', adv: 1, cap: '<b>Recovery.</b> The client shows "printing unavailable" and stays open. The service control manager restarts the spooler, and the client can simply try again.' },
          ]),
          remote: [
            { at: 'client', tok: 'request', cth: 'running', t1: 'waiting', path: null, adv: 3, cap: '<b>Same call, new place.</b> The printer now belongs to another computer, PRINTSRV. The word processor makes exactly the same <span class="t">RPC</span> call as before.' },
            { at: 'mid', tok: 'request', cth: 'running', t1: 'waiting', path: 'req', adv: 3, cap: '<b>Across the network.</b> The RPC machinery sees that the server is remote, so the message leaves through the network instead of through ALPC.' },
            { at: 'port', tok: 'request', cth: 'waiting', t1: 'waiting', path: 'req', adv: 3, cap: '<b>Delivered on PRINTSRV.</b> The message arrives at the spooler service running on the print server.' },
            { at: 'srv', tok: 'request', cth: 'waiting', t1: 'working', path: null, adv: 3, cap: '<b>The remote server does the work</b> and queues the job for its printer.' },
            { at: 'mid', tok: 'reply', cth: 'waiting', t1: 'replying', path: 'rep', adv: 3, cap: '<b>The reply travels back</b> over the network.' },
            { at: 'client', tok: 'reply', cth: 'running', t1: 'waiting', path: 'rep', adv: 3, cap: '<b>Carry on.</b> The client\'s code did not change at all when the server moved to another machine. That is why client/server is a natural base for distributed computing.' },
          ],
        };
        // geometry: wide = client and server side by side above the kernel; phone = client / kernel / server stacked
        const NW = ctx.narrow;
        const G = NW ? {
          W: 340, H: 412, lines: [126, 234],
          regions: [['user', 0, 0, 340, 120, 16], ['kern', 0, 132, 340, 96, 148], ['user2', 0, 240, 340, 172, 256]],
          client: { box: [10, 22, 320, 92], tx: 24, ty: 44, a: 'start', th: [24, 74, 150] },
          srv: { box: [10, 264, 320, 140], tx: 24, ty: 288, a: 'start', t1: [24, 358, 140], t2: [176, 358, 140], crash: [170, 378] },
          mid: { box: [10, 156, 320, 64], tx: 24, ty: 182, a: 'start' },
          port: [262, 264], portLbl: [298, 258, 'start'],
          req: ['M 140 114 L 140 152', 'M 250 220 L 259 250'], rep: ['M 200 264 L 200 224', 'M 200 156 L 200 118'],
          pos: { client: [262, 60], mid: [262, 188], port: [262, 264], srv: [262, 322] },
        } : {
          W: 640, H: 290, lines: [181],
          regions: [['user', 0, 0, 640, 176, 18], ['kern', 0, 186, 640, 104, 204]],
          client: { box: [20, 26, 206, 136], tx: 123, ty: 50, a: 'middle', th: [40, 116, 166] },
          srv: { box: [384, 26, 240, 136], tx: 504, ty: 50, a: 'middle', t1: [398, 116, 102], t2: [508, 116, 104], crash: [504, 136] },
          mid: { box: [180, 208, 280, 62], tx: 272, ty: 234, a: 'middle' },
          port: [384, 92], portLbl: [372, 124, 'end'],
          req: ['M 96 164 L 200 204', 'M 424 204 L 388 106'], rep: ['M 474 164 L 446 204', 'M 252 204 L 160 166'],
          pos: { client: [123, 93], mid: [400, 239], port: [330, 92], srv: [504, 93] },
        };
        const LBL = {
          user: (r) => (NW ? (r ? 'USER MODE · YOUR PC' : 'USER MODE · CLIENT') : r ? 'USER MODE (TWO COMPUTERS)' : 'USER MODE'),
          user2: (r) => (r ? 'USER MODE · PRINTSRV' : 'USER MODE · SERVER'),
          kern: () => 'KERNEL MODE',
        };
        let mode = 'normal';
        const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%', style: 'flex:none' });
        const baseG = s('g');
        const tokR = s('rect', { x: -30, y: -14, width: 60, height: 28, rx: 7, 'stroke-width': 2 });
        const tokT = s('text', { x: 0, y: 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 });
        const tok = s('g', { class: 'tok' }, tokR, tokT);
        svg.append(baseG, tok);
        const advEls = ADV.map(([t, d]) => h('div', { class: 'adv' }, h('b', {}, t), h('span', { html: d })));
        function thread([x, y, w], label, state) {
          const cls = state === 'working' || state === 'replying' || state === 'running' ? 's-thread' : 's-panel';
          return [s('rect', { x, y, width: w, height: 30, rx: 6, class: cls, 'stroke-width': state === 'working' ? 3 : 1.5 }),
            s('text', { x: x + w / 2, y: y + 19, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, label + ': ' + state)];
        }
        const box = ([x, y, w, hh], cls, on, dash) => s('rect', { x, y, width: w, height: hh, rx: 12, class: cls, 'stroke-width': on ? 4 : 2, 'stroke-dasharray': dash ? '8 5' : null });
        const title = (o, t, sub, fs) => [s('text', { x: o.tx, y: o.ty, 'text-anchor': o.a, 'font-size': fs, 'font-weight': 800 }, t),
          s('text', { x: o.tx, y: o.ty + 19, 'text-anchor': o.a, 'font-size': 13, class: 's-sub' }, sub)];
        function draw(f) {
          const remote = mode === 'remote', sv = f.sv || 'ok', C = G.client, S = G.srv, M = G.mid;
          const k = [];
          G.regions.forEach(([kind, x, y, w, hh, ly]) => {
            const kern = kind === 'kern';
            k.push(s('rect', { x, y, width: w, height: hh, rx: 12, style: kern ? 'fill:color-mix(in srgb, var(--os) 7%, var(--panel));stroke:color-mix(in srgb, var(--os) 40%, transparent)' : 'fill:var(--panel-2);stroke:var(--line)' }),
              s('text', { x: x + 12, y: ly, 'font-size': 13, 'font-weight': 800, 'letter-spacing': 1.5, class: kern ? null : 's-sub', style: kern ? 'fill:var(--os)' : null }, LBL[kind](remote)));
          });
          G.lines.forEach((y) => k.push(s('line', { x1: 0, y1: y, x2: G.W, y2: y, 'stroke-dasharray': '9 6', 'stroke-width': 2, style: 'stroke:var(--ink-2)' })));
          k.push(box(C.box, 's-proc', f.at === 'client'), ...title(C, 'Client process', 'word processor', 16), ...thread(C.th, 'thread', f.cth));
          k.push(box(S.box, sv === 'crashed' ? 's-bad' : 's-proc', f.at === 'srv', remote),
            ...title(S, sv === 'crashed' ? '✗ Server crashed' : 'Server process', remote ? (NW ? 'spooler on PRINTSRV' : 'spooler on PRINTSRV (another PC)') : sv === 'restarted' ? 'print spooler, restarted' : 'print spooler service', 16));
          if (sv !== 'crashed') k.push(...thread(S.t1, 'T1', f.t1), ...thread(S.t2, 'T2', f.t2 || 'working'));
          else k.push(s('text', { x: S.crash[0], y: S.crash[1], 'text-anchor': 'middle', 'font-size': 13.5, style: 'fill:var(--bad)', 'font-weight': 700 }, 'memory discarded, threads gone'));
          const dead = sv === 'crashed'; // a crashed server's port is closed
          k.push(s('circle', { cx: G.port[0], cy: G.port[1], r: 9, class: dead ? 's-bad' : 's-os', 'stroke-width': 2 }),
            s('text', { x: dead && NW ? G.W - 4 : G.portLbl[0], y: G.portLbl[1], 'text-anchor': dead && NW ? 'end' : G.portLbl[2], 'font-size': 13, 'font-weight': 700, style: dead ? 'fill:var(--bad)' : 'fill:var(--os)' }, dead ? (NW ? 'closed' : 'port closed') : 'port'));
          k.push(s('rect', { x: M.box[0], y: M.box[1], width: M.box[2], height: M.box[3], rx: 10, class: remote ? 's-io' : 's-os', 'stroke-width': f.at === 'mid' ? 4 : 2 }),
            ...title(M, remote ? 'Network' : 'ALPC facility', remote ? 'RPC messages to PRINTSRV' : 'in the executive', 15));
          // req = request going down and over; rep = reply coming back; err = only the kernel → client leg (the server is gone)
          const rq = f.path === 'req', rp = f.path === 'rep', er = f.path === 'err';
          const arrow = (d, on, col) => s('path', { d, class: on ? '' : 's-muted', style: on ? `stroke:var(--${col});fill:none` : '', 'stroke-width': on ? 3 : 2, 'marker-end': on ? `url(#arr-${col})` : 'url(#arr-muted)' });
          k.push(arrow(G.req[0], rq, 'accent'), arrow(G.req[1], rq, 'accent'), arrow(G.rep[0], rp, 'ok'), arrow(G.rep[1], rp || er, er ? 'bad' : 'ok'));
          baseG.replaceChildren(...k);
          if (f.tok) {
            const [x, y] = G.pos[f.at];
            tok.style.opacity = '1'; tok.style.transform = `translate(${x}px, ${y}px)`;
            tokR.setAttribute('class', f.tok === 'error' ? 's-bad' : f.tok === 'reply' ? 's-ok' : 's-accent');
            tokT.textContent = f.tok;
          } else tok.style.opacity = '0';
          advEls.forEach((a, i) => a.classList.toggle('on', i === f.adv));
        }
        let F = MODES.normal;
        const player = ctx.ui.player({ count: 6, interval: 2600, captionBelow: true, render: (i) => { draw(F[i]); return F[i].cap; } });
        player.caption.style.minHeight = '96px';
        const seg = ctx.ui.seg([{ value: 'normal', label: 'Normal request' }, { value: 'crash', label: 'Server crashes' }, { value: 'remote', label: 'Server on another PC' }], 'normal', (v) => { mode = v; F = MODES[v]; player.reset(); });
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'm0', html: 'Windows builds many services on the <span class="t">client/server model</span>, as the microkernel systems of section 2.4 do. <b>Servers</b> are separate processes (environment subsystems, services). <b>Clients</b>, usually applications, send a request message and wait for the reply; on one computer the executive\'s ALPC facility carries it.' }),
            h('h4', { class: 'm0' }, 'Four advantages (the one shown lights up)'),
            h('div', { class: 'grid-2', style: { gap: '8px' } }, ...advEls),
            h('p', { class: 'xs muted m0', html: 'Windows is not a pure microkernel: for speed, the executive stays in kernel mode.' })),
          h('div', { class: 'card white stack', style: { gap: '8px' } }, seg, svg, player.el)));
      },
    },

    /* ---------------- 6. Threads and SMP: a Gantt lab with policy toggles ---------------- */
    {
      title: 'Threads and SMP: keep every processor busy',
      kind: 'lab',
      render(el, ctx) {
        const { h, s } = ctx;
        // work waiting to run, in queue order: [label, kind, length, owning process]
        const WORK = [['I/O', 'os', 2, null], ['P1', 'th', 3, 'photo'], ['VM', 'os', 2, null], ['P2', 'th', 3, 'photo'], ['Obj', 'os', 1, null],
          ['P3', 'th', 3, 'photo'], ['Sec', 'os', 1, null], ['W1', 'th', 2, 'web'], ['Cache', 'os', 2, null], ['W2', 'th', 2, 'web']];
        const TOTAL = WORK.reduce((a, w) => a + w[2], 0); // 21 units of work
        function sim(n, os0, one) {
          const left = WORK.map(([id, kind, len, proc]) => ({ id, kind, len, proc }));
          const free = Array(n).fill(0), run = [];
          for (let t = 0; left.length && t < 100; t++) {
            for (let c = 0; c < n; c++) {
              if (free[c] > t) continue;
              const i = left.findIndex((k) => !(os0 && k.kind === 'os' && c !== 0) && !(one && k.proc && run.some((r) => r.proc === k.proc && r.s <= t && r.e > t)));
              if (i < 0) continue;
              const k = left.splice(i, 1)[0];
              run.push(Object.assign(k, { c, s: t, e: t + k.len })); free[c] = t + k.len;
            }
          }
          return { mk: Math.max(...run.map((r) => r.e)), run };
        }
        const maxAt = (run, pred, mk) => Math.max(...ctx.util.range(mk).map((t) => run.filter((r) => pred(r) && r.s <= t && r.e > t).length));
        let n = 4, os0 = false, one = false;
        const VW = ctx.narrow ? 360 : 620;
        const svg = s('svg', { viewBox: `0 0 ${VW} 252`, width: '100%', style: 'flex:none' });
        const stats = h('div', { class: 'kpis', style: ctx.narrow ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : {} });
        const story = h('div', { class: 'callout m0 small' });
        function update() {
          const cur = sim(n, os0, one), win = sim(n, false, false);
          const T = Math.max(...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => sim(n, !!a, !!b).mk));
          const X0 = ctx.narrow ? 54 : 74, W = VW - X0 - 10, u = W / T, step = u >= 24 ? 1 : 3;
          const k = [s('text', { x: X0, y: 16, 'font-size': 13, class: 's-sub' }, 'time →')];
          for (let t = 0; t <= T; t += step) {
            k.push(s('line', { x1: X0 + t * u, y1: 24, x2: X0 + t * u, y2: 226, class: 's-muted', 'stroke-width': 1, 'stroke-dasharray': '2 4' }),
              s('text', { x: X0 + t * u, y: 244, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(t)));
          }
          for (let c = 0; c < 4; c++) {
            const y = 26 + c * 50, here = c < n;
            k.push(s('text', { x: 6, y: y + 26, 'font-size': 14, 'font-weight': 800, class: here ? '' : 's-sub' }, 'Core ' + c),
              s('rect', { x: X0, y, width: W, height: 44, rx: 6, class: here ? 's-panel' : 's-muted', 'stroke-dasharray': here ? null : '5 4', opacity: here ? 1 : 0.6 }));
            if (!here) k.push(s('text', { x: X0 + W / 2, y: y + 27, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'not installed'));
          }
          for (const r of cur.run) {
            const x = X0 + r.s * u + 1, w = r.len * u - 2, y = 26 + r.c * 50 + 3;
            k.push(s('rect', { x, y, width: w, height: 38, rx: 5, class: r.kind === 'os' ? 's-os' : 's-thread', 'stroke-width': 2, 'stroke-dasharray': r.proc === 'web' ? '6 3' : null }));
            if (w >= r.id.length * 8 + 6) k.push(s('text', { x: x + w / 2, y: y + 24, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, r.id));
          }
          const fx = X0 + cur.mk * u, late = fx > VW - 100;
          k.push(s('line', { x1: fx, y1: 20, x2: fx, y2: 230, style: 'stroke:var(--accent)', 'stroke-width': 3 }),
            s('text', { x: late ? fx - 6 : fx + 6, y: 16, 'text-anchor': late ? 'end' : 'start', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--accent)' }, 'done at ' + cur.mk));
          svg.replaceChildren(...k);
          const util = Math.round((TOTAL / (n * cur.mk)) * 100);
          const photo = maxAt(cur.run, (r) => r.proc === 'photo', cur.mk), osPar = maxAt(cur.run, (r) => r.kind === 'os', cur.mk);
          stats.replaceChildren(
            h('div', { class: 'card tight kpi' }, h('span', { class: 'xs b muted' }, 'FINISH TIME'), h('span', { class: 'big' }, String(cur.mk))),
            h('div', { class: 'card tight kpi' }, h('span', { class: 'xs b muted' }, 'CORES BUSY'), h('span', { class: 'big' }, util + '%')),
            h('div', { class: 'card tight kpi' }, h('span', { class: 'xs b muted' }, 'PHOTO THREADS AT ONCE'), h('span', { class: 'big' }, String(photo))),
            h('div', { class: 'card tight kpi' }, h('span', { class: 'xs b muted' }, 'OS ROUTINES AT ONCE'), h('span', { class: 'big' }, String(osPar))));
          let msg, cls;
          if (!os0 && !one) {
            cls = 'tip'; msg = n === 1 ? '<b>Windows rules, one core.</b> With a single processor there is nothing to share: under every rule the 21 units of work finish at time 21. SMP pays off only when there are several processors.'
              : `<b>Windows rules.</b> Any core runs any work, OS routines included, and the photo editor's threads run side by side. The ${TOTAL} units of work finish at time ${cur.mk}${n === 4 ? ', the best any schedule can do on 4 cores (21 ÷ 4 = 5.25, rounded up to whole units)' : ''}.`;
          } else if (cur.mk === win.mk) {
            cls = 'why'; msg = `<b>No cost yet.</b> With ${n} core${n > 1 ? 's' : ''}, the processors themselves are the bottleneck, so this rule does not slow anything down. Add cores and watch it start to hurt.`;
          } else {
            cls = 'warn';
            const costOs = os0 && sim(n, true, false).mk > win.mk, costOne = one && sim(n, false, true).mk > win.mk, alone = !costOs && !costOne;
            const why = [costOs || alone ? 'all OS work must queue for core 0 (the old master/slave design), so core 0 becomes a bottleneck while other cores sit idle' : null, costOne || alone ? 'the photo editor\'s threads must take turns instead of running on different cores at the same time' : null].filter(Boolean).join(', and ');
            const note = os0 && one && !alone && !(costOs && costOne) ? ` (On its own, the ${costOs ? '"one at a time"' : '"core 0 only"'} rule would cost nothing with ${n} cores, but it adds to the delay here.)` : alone ? ' Neither rule hurts on its own with this many cores; together they do.' : '';
            msg = `<b>${cur.mk - win.mk} extra time units (finish at ${cur.mk} instead of ${win.mk}).</b> Here ${why}.${note} Windows allows both kinds of parallelism.`;
          }
          story.className = 'callout m0 small ' + cls;
          story.setAttribute('data-label', cls === 'tip' ? 'What you see' : cls === 'why' ? 'What you see' : 'What went wrong');
          story.innerHTML = msg;
        }
        const slider = ctx.ui.slider({ label: 'Processor cores', min: 1, max: 4, value: n, onInput: (v) => { n = v; update(); } });
        const segOs = ctx.ui.seg([{ value: 0, label: 'any core (Windows)' }, { value: 1, label: 'core 0 only (master/slave)' }], 0, (v) => { os0 = !!v; update(); });
        const segTh = ctx.ui.seg([{ value: 0, label: 'in parallel (Windows)' }, { value: 1, label: 'one at a time' }], 0, (v) => { one = !!v; update(); });
        const left = h('div', { class: 'stack', style: { gap: '10px' } },
          h('p', { class: 'm0', html: 'Windows was designed for a <span class="t">symmetric multiprocessor</span> from the start, and it treats every processor as an equal:' }),
          h('ul', { class: 'small m0', html: '<li>Any OS routine can run on any free processor, and different routines can run on different processors <b>at the same moment</b>.</li><li>One process can have several <span class="t">threads</span>, and they can run on different processors at the same time.</li><li>A server process can use several threads to serve several clients at once (W1 serves client A, W2 serves client B).</li><li>Processes can share data and resources, and talk through flexible message passing.</li>' }),
          h('div', { class: 'card tight small', html: '<b>The workload:</b> <span class="chip thread">P1–P3</span> photo editor threads, <span class="chip thread" style="outline:1.5px dashed var(--thread)">W1–W2</span> web server threads, <span class="chip os">I/O, VM, Obj, Sec, Cache</span> OS routines (work for the I/O, virtual memory, object, security and cache managers). 21 units of work in all.' }),
          story);
        const right = h('div', { class: 'card white stack', style: { gap: '9px' } },
          slider,
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'OS routines may run on'), segOs),
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'Threads of one process run'), segTh),
          svg, stats,
          h('p', { class: 'xs muted m0', html: '<b>Try:</b> set 2 cores and flip the toggles. When the processors themselves are the bottleneck, the rules cost nothing; with 4 cores they cost a lot.' }));
        el.append(h('div', { class: 'split l fill' }, left, right));
        update();
      },
    },

    /* ---------------- 7. Windows objects: handles + names, OO ideas, kernel objects ---------------- */
    {
      title: 'Everything is an object: handles, names and security',
      kind: 'explore',
      render(el, ctx) {
        const { h } = ctx;
        /* ---- tab 1: two processes share (or fail to share) objects through the object manager ---- */
        function tabHandles(panel) {
          const USERS = { A: 'ana', B: 'sam' };
          let objs, tables, nextH, msg;
          function reset() {
            objs = [{ id: 'adm', name: '\\BaseNamedObjects\\AdminOnlyLock', type: 'Mutex', sd: 'Administrators only', allow: [], count: 1, pre: true }];
            tables = { A: [], B: [] }; nextH = { A: 4, B: 4 };
            msg = ['', 'Pick an action from the list. Each one is a real kind of request a program makes to the object manager.'];
            paint();
          }
          const hex = (n) => '0x' + n.toString(16).toUpperCase();
          const find = (id) => objs.find((o) => o.id === id);
          // each handle-table entry records the object AND the access rights granted when the handle was made
          function give(p, o, acc) { const hv = nextH[p]; nextH[p] += 4; tables[p].push({ h: hv, id: o.id, acc }); o.count++; return hv; }
          function sameNum(p, hv) { // handle values are per-process: point out when the other process uses the same number
            const q = p === 'A' ? 'B' : 'A', r = tables[q].find((x) => x.h === hv);
            return r ? ` ${q} also has a handle numbered <code>${hex(hv)}</code>${r.id === tables[p].find((x) => x.h === hv).id ? ', to the same object' : ', to a different object'}: a handle value means something only inside its own process.` : '';
          }
          function openByName(p, id, label) {
            const o = find(id);
            if (!o) return ['bad', `<b>No such name.</b> The object manager finds nothing called “${label}” in its namespace, so ${p} gets no handle. Create it first.`];
            if (tables[p].some((r) => r.id === id)) return ['warn', `${p} already holds a handle to “${label}”. Opening again would simply give it a second handle.`];
            if (!o.allow.includes(USERS[p])) return ['bad', `<b>Access denied.</b> The object manager found “${label}”, but the security reference monitor checked its security descriptor (<i>${o.sd}</i>) and user ${USERS[p]} is not allowed. No handle is created.`];
            const hv = give(p, o, 'wait, signal');
            return ['ok', `<b>Opened by name.</b> The object manager found “${label}”, and the security reference monitor checked its security descriptor: user ${USERS[p]} may wait on it and signal it. ${p} gets handle <code>${hex(hv)}</code> in its <i>own</i> table, with those rights recorded beside it, so later uses of the handle are checked against the rights alone. The object now has ${o.count} handles.${sameNum(p, hv)}`];
          }
          function close(p, id) {
            const i = tables[p].findIndex((r) => r.id === id);
            if (i < 0) return ['warn', `${p} holds no handle to that object, so there is nothing to close.`];
            const o = find(id); const hv = tables[p][i].h;
            tables[p].splice(i, 1); o.count--;
            if (o.count === 0) { objs = objs.filter((x) => x !== o); return ['ok', `${p} closed <code>${hex(hv)}</code>. That was the last handle, so the object manager <b>deletes</b> the object and removes its name.`]; }
            return ['ok', `${p} closed <code>${hex(hv)}</code>. The object stays alive because ${o.count} handle${o.count > 1 ? 's' : ''} still point${o.count > 1 ? '' : 's'} to it.`];
          }
          const ACTS = [
            ['A', 'A: create named event “SaveDone”', () => {
              if (find('ev')) return ['warn', '“SaveDone” already exists. A second create with the same name would just open the existing event.'];
              const o = { id: 'ev', name: '\\BaseNamedObjects\\SaveDone', type: 'Event', sd: 'ana and sam may use it', allow: ['ana', 'sam'], count: 0, fresh: true };
              objs.push(o); const hv = give('A', o, 'all access');
              return ['ok', `<b>Created.</b> The object manager builds an Event object, records its name in the namespace, attaches a security descriptor and gives A handle <code>${hex(hv)}</code> with full access.${sameNum('A', hv)}`]; }],
            ['B', 'B: open “SaveDone” by name', () => openByName('B', 'ev', 'SaveDone')],
            ['A', 'A: create an unnamed mutex', () => {
              if (find('mx')) return ['warn', 'A already made its unnamed mutex.'];
              const o = { id: 'mx', name: '(no name)', type: 'Mutex', sd: 'ana only', allow: ['ana'], count: 0, fresh: true };
              objs.push(o); const hv = give('A', o, 'all access');
              return ['ok', `<b>Created, unnamed.</b> A gets handle <code>${hex(hv)}</code>. With no name in the namespace, nobody else can look this object up.${sameNum('A', hv)}`]; }],
            ['B', 'B: try to open A\'s unnamed mutex', () => find('mx') ? ['bad', '<b>Impossible by name.</b> The mutex has no name, so B has nothing to ask for. B can get a handle only if A passes one on, by duplicating its handle (try that button) or by letting a child process inherit it.'] : ['warn', 'A has not created its unnamed mutex yet.']],
            ['A', 'A: duplicate its mutex handle into B', () => {
              const o = find('mx');
              if (!o) return ['warn', 'A has not created its unnamed mutex yet, so there is no handle to pass on.'];
              if (tables.B.some((r) => r.id === 'mx')) return ['warn', 'B already holds a handle to the mutex.'];
              const hv = give('B', o, 'wait, release');
              return ['ok', `<b>Handle passed on.</b> A asks the object manager to copy its handle into B\'s table, and B gets <code>${hex(hv)}</code>. No name lookup is involved: A vouches for B, and the copy can never carry more rights than A\'s own handle. This is how unnamed objects are shared.${sameNum('B', hv)}`]; }],
            ['B', 'B: open “AdminOnlyLock”', () => openByName('B', 'adm', 'AdminOnlyLock')],
            ['A', 'A: close its handle to SaveDone', () => close('A', 'ev')],
            ['B', 'B: close its handle to SaveDone', () => close('B', 'ev')],
          ];
          const acts = h('div', { class: 'stack', style: { gap: '6px' } });
          const out = h('div', { class: 'callout m0 small' });
          const colA = h('div', { class: 'card proc tight stack pcol' }), colB = h('div', { class: 'card proc tight stack pcol' }), colOM = h('div', { class: 'card os tight stack pcol' });
          function table(p) {
            const rows = tables[p].map((r) => { const o = find(r.id); return `<div class="hrow"><code>${hex(r.h)}</code> → ${o.type} “${o.name === '(no name)' ? 'unnamed' : o.name.split('\\').pop()}”<div class="xs muted">granted: ${r.acc}</div></div>`; }).join('') || '<div class="xs muted">(no open handles)</div>';
            return `<div class="b">Process ${p}</div><div class="xs muted">${p === 'A' ? 'editor' : 'backup tool'}, user <b>${USERS[p]}</b></div><h4 style="margin:6px 0 2px">Handle table</h4>${rows}`;
          }
          function paint() {
            colA.innerHTML = table('A'); colB.innerHTML = table('B');
            colOM.innerHTML = '<div class="b">Object manager <span class="xs muted">(kernel mode)</span></div><div class="xs muted">It keeps each object\'s header (name, security, handle count); the body holds the type\'s own data.</div>' + objs.map((o) => `<div class="objc${o.fresh ? ' fade-in' : ''}"><div class="b">${o.type}${o.pre ? ' <span class="xs muted">(already exists)</span>' : ''}</div><div class="xs"><b>Name:</b> ${o.name.replace(/\\/g, '\\<wbr>')}</div><div class="xs"><b>Security:</b> ${o.sd}</div><div class="xs"><b>Handles:</b> ${o.count}</div></div>`).join('');
            objs.forEach((o) => { o.fresh = false; });
            out.className = 'callout m0 small ' + (msg[0] === 'ok' ? 'tip' : msg[0] === 'bad' ? 'bad' : msg[0] === 'warn' ? 'warn' : '');
            out.setAttribute('data-label', msg[0] === 'ok' ? 'Object manager' : msg[0] === 'bad' ? 'Refused' : msg[0] === 'warn' ? 'Note' : 'How to play');
            out.innerHTML = msg[1];
          }
          acts.append(...ACTS.map(([p, label, fn]) => h('button', { class: 'btn sm ' + (p === 'A' ? 'proc' : 'thread'), style: { justifyContent: 'flex-start' }, onclick: () => { msg = fn(); paint(); } }, label)),
            h('button', { class: 'btn sm ghost', style: { justifyContent: 'flex-start' }, onclick: reset }, '↺ Start over'));
          panel.append(h('div', { class: 'objgrid', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0, 1fr)', height: 'auto' } : {} },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'small m0', html: 'Windows makes something an <b>object</b> when user programs must reach it, or when it is shared or protected: files, processes, threads, events, mutexes. The <span class="t">object manager</span> creates each one; a program only ever holds a <span class="t">handle</span> to it.' }), acts),
            h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'grid-3', style: Object.assign({ gap: '10px', flex: '1', minHeight: '0' }, ctx.narrow ? {} : { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 1fr)' }) }, colA, colOM, colB), out)));
          reset();
        }
        /* ---- tab 2: match each Windows example to an object-oriented idea ---- */
        function tabOO(panel) {
          const C = [
            ['Encapsulation', 'Data is hidden inside the object; outsiders use only its operations.'],
            ['Class and instance', 'A class is a template for one kind of object; each object made from it is an instance.'],
            ['Inheritance', 'A new class reuses and extends an existing one. In Windows: inside the implementation only.'],
            ['Polymorphism', 'One operation works on many object types, each giving it its own meaning.'],
          ];
          const EX = [
            ['A program can never read an event object\'s fields directly. It can only call functions such as SetEvent or WaitForSingleObject on a handle.', 0, 'The event\'s data is sealed inside the object; the only way in is through the operations it offers.'],
            ['Each object type (File, Process, Event…) is described by a type object. Every file you open becomes a new File object built from that description.', 1, 'The type object plays the role of the class; each open file is one instance of it.'],
            ['Inside the kernel, mutex, event and semaphore objects all start with the same shared header structure and reuse the code written for that header.', 2, 'Sharing a common "parent" part and its code is inheritance, done by hand in C inside the implementation.'],
            ['WaitForSingleObject works on a process, a thread, an event or a timer. Each type decides for itself what "signaled" means.', 3, 'One operation, many types, each with its own meaning: that is polymorphism.'],
            ['Only the object manager ever touches an object\'s header. Programs are never given a pointer to it, just a handle.', 0, 'Hiding the object\'s insides behind handles and operations is encapsulation.'],
            ['Two programs each open report.txt. The object manager creates two separate file objects, both of the File type.', 1, 'One type (class), two objects made from it (instances), each with its own state such as its current position in the file.'],
          ];
          const fb = h('div', { class: 'callout m0 small', 'data-label': 'How to play', html: 'For each Windows example, click the idea it shows. You get instant feedback here.' });
          const score = h('span', { class: 'chip ok' });
          const got = [];
          const rows = EX.map(([txt, ans, why], i) => {
            const btns = C.map(([name], j) => h('button', { class: 'btn sm', type: 'button', onclick: () => {
              if (got[i]) return;
              if (j === ans) { got[i] = true; b.classList.add('right'); btns[j].classList.add('on'); btns.forEach((x) => (x.disabled = x !== btns[j])); fb.className = 'callout m0 small tip'; fb.setAttribute('data-label', 'Right: ' + name); fb.innerHTML = why; }
              else { btns[j].disabled = true; b.classList.add('miss'); fb.className = 'callout m0 small warn'; fb.setAttribute('data-label', 'Not ' + name); fb.innerHTML = `${name}: ${C[j][1]} Does that describe this example? Try another idea.`; }
              score.textContent = `${got.filter(Boolean).length} of ${EX.length} matched`;
            } }, name));
            const b = h('div', { class: 'oorow', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0, 1fr)' } : {} }, h('div', { class: 'small' }, txt), h('div', { class: 'oobtns' }, ...btns));
            return b;
          });
          score.textContent = `0 of ${EX.length} matched`;
          panel.append(h('div', { class: 'split fill', style: { gap: '16px', gridTemplateColumns: '320px minmax(0, 1fr)' } },
            h('div', { class: 'stack', style: { gap: '7px' } },
              ...C.map(([n, d]) => h('div', { class: 'card tight small', html: `<b>${n}.</b> ${d}` })), fb),
            h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { justifyContent: 'space-between' } }, h('span', { class: 'small', html: 'Windows is written in C, yet it is built on these four ideas. Match each example.' }), score), ...rows)));
        }
        /* ---- tab 3: sort kernel objects into control and dispatcher objects ---- */
        function tabKobj(panel) {
          const K = [
            ['Asynchronous procedure call (APC)', 0, 'breaks into one particular thread and makes it run a given procedure'],
            ['Event', 1, 'records that something happened; threads wait until it is signaled'],
            ['Deferred procedure call (DPC)', 0, 'postpones the less urgent part of interrupt handling so hardware interrupts are not held up'],
            ['Mutex', 1, 'lets one thread at a time own it; the others wait'],
            ['Interrupt object', 0, 'connects an interrupt source to its interrupt service routine'],
            ['Semaphore', 1, 'counts how many threads may pass; a thread waits while the count is zero'],
            ['Process (kernel process object)', 0, 'describes one process to the kernel: its address space and the list of its threads', true],
            ['Timer', 1, 'becomes signaled when a set time arrives'],
            ['Profile object', 0, 'measures where a block of code spends its running time'],
            ['Thread', 1, 'becomes signaled when the thread ends, so others can wait for it to finish'],
          ];
          let i = 0, fresh = -1; const done = [[], []]; let misses = 0;
          const card = h('div', { class: 'card white stack', style: { gap: '10px' } });
          const note = h('div', { class: 'callout m0 small', 'data-label': 'The rule', html: '<b><span class="t">Dispatcher objects</span></b> are used for synchronization: a thread can wait on one, and each is either signaled or not. <b><span class="t">Control objects</span></b> are used to control how the kernel itself operates.' });
          const bk = [h('div', { class: 'bucket' }), h('div', { class: 'bucket' })];
          function paint() {
            bk.forEach((b, j) => { b.innerHTML = `<div class="b">${j ? 'Dispatcher objects' : 'Control objects'}</div>` + (done[j].map((k) => `<div class="bitem${k === fresh ? ' fade-in' : ''}"><b>${K[k][0]}</b>${K[k][3] ? ' <span class="chip warn">in both families</span>' : ''}: ${K[k][2]}</div>`).join('') || '<div class="xs muted">nothing sorted here yet</div>'); });
            if (i >= K.length) { card.innerHTML = `<h3>All ten sorted${misses ? ` (${misses} wrong tr${misses > 1 ? 'ies' : 'y'} along the way)` : ', no mistakes'}.</h3><p class="small m0">Control objects steer the kernel: they break into threads (APC), defer interrupt work (DPC), connect interrupts, describe a process to the kernel, or profile code. Dispatcher objects are the ones threads wait on. The process object belongs to both families.</p>`; card.append(h('button', { class: 'btn sm', onclick: () => { i = 0; misses = 0; done[0].length = 0; done[1].length = 0; paint(); } }, '↺ Sort again')); return; }
            const [name] = K[i];
            card.replaceChildren(h('div', { class: 'xs b muted' }, `OBJECT ${i + 1} OF ${K.length}`), h('h3', { class: 'm0' }, name), h('p', { class: 'small m0 muted' }, 'Is it a control object or a dispatcher object?'),
              h('div', { class: 'row' }, h('button', { class: 'btn os', onclick: () => pick(0) }, 'Control object'), h('button', { class: 'btn thread', onclick: () => pick(1) }, 'Dispatcher object')));
          }
          function pick(j) {
            const [name, ans, what] = K[i];
            fresh = -1;
            if (K[i][3]) { // the process object is listed in BOTH families, so either answer is accepted
              done[j].push(i); fresh = i; i++; note.className = 'callout m0 small tip'; note.setAttribute('data-label', 'Both are right');
              note.innerHTML = `The <b>process object</b> ${what}, so it is listed among the control objects. Threads can also wait for a process to end, so it is a dispatcher object too: the one object in both families.`; }
            else if (j === ans) { done[ans].push(i); fresh = i; i++; note.className = 'callout m0 small tip'; note.setAttribute('data-label', 'Right'); note.innerHTML = `<b>${name}</b> ${what}.`; }
            else { misses++; note.className = 'callout m0 small warn'; note.setAttribute('data-label', 'Not quite'); note.innerHTML = `A ${name.toLowerCase().replace(/ \(.*\)/, '')} ${what}. ${ans ? 'Threads can wait on it, so it is a dispatcher object.' : 'It is used to control the kernel\'s own work, not to synchronize threads, so it is a control object.'}`; }
            paint();
          }
          panel.append(h('div', { class: 'split l fill', style: { gap: '16px' } }, h('div', { class: 'stack', style: { gap: '10px' } }, h('p', { class: 'small m0', html: 'Underneath the executive\'s objects the kernel keeps its own, simpler <b>kernel objects</b> (an executive event, for example, is built around a kernel event). They come in two families. Sort each one.' }), card, note), h('div', { class: 'grid-2', style: { gap: '10px' } }, ...bk)));
          paint();
        }
        el.append(ctx.ui.tabs([
          { label: '1 · Handles, names and security', render: tabHandles },
          { label: '2 · Four object-oriented ideas', render: tabOO },
          { label: '3 · Kernel objects: control vs dispatcher', render: tabKobj },
        ]));
      },
    },

    /* ---------------- 8. Recap ---------------- */
    {
      title: 'Recap: Windows on one page',
      kind: 'recap',
      render(el, ctx) {
        const { h } = ctx;
        el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
          h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
          ctx.ui.flipcards([
            ['The two halves of Windows', '<b>User mode:</b> special system processes, service processes, environment subsystems, user applications. <b>Kernel mode:</b> executive, kernel, HAL, device drivers, windowing and graphics.'],
            ['The executive\'s ten managers', 'I/O, cache, object, plug and play, power, security reference monitor, virtual memory, process/thread, configuration, and the ALPC facility. One job each.'],
            ['Kernel versus HAL', '<b>Kernel:</b> thread scheduling, process switching, exceptions and interrupts, multiprocessor sync; its code does not run in threads. <b>HAL:</b> turns generic hardware commands into one platform\'s commands.'],
            ['Client/server inside Windows', 'Client stubs turn calls into messages (ALPC locally, RPC in general) for servers such as subsystems and services. Pay-offs: simpler executive, reliability, one uniform way to ask, ready for distribution.'],
            ['Threads and SMP', 'Any OS routine can run on any processor, several at once. Threads of one process run on different processors at the same time. Servers use many threads for many clients.'],
            ['Windows objects', 'Created and tracked by the object manager, used through per-process handles, guarded by security descriptors (checked at open). Named: open by name. Unnamed: pass the handle. Kernel objects: control or dispatcher.'],
          ].map(([f, bk]) => [f, '<div>' + bk + '</div>']), { cols: 3, height: 168 }),
          h('div', { class: 'grid-2', style: { gap: '12px' } },
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"The HAL is just another device driver." No: a driver operates one device; the HAL hides the <b>whole platform</b> (bus, DMA controller, interrupt controller, timers) from the kernel and the drivers.' }),
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"Windows is a microkernel." Not a pure one: it borrows the client/server idea, but the executive and even windowing and graphics run in kernel mode, for speed.' }))));
      },
    },

    /* ---------------- 9. Check yourself ---------------- */
    {
      title: 'Check yourself: Microsoft Windows',
      kind: 'check',
      quiz: [
        { q: 'Which part of Windows turns generic hardware requests, such as "acknowledge this interrupt", into the exact commands one particular platform needs?',
          choices: ['A device driver', 'The hardware abstraction layer (HAL)', 'The kernel', 'The I/O manager'], answer: 1,
          feedback: ['A driver operates one kind of device. The platform wiring around the processor (interrupt controller, timers, bus, DMA) is hidden by a different layer.', null, 'The kernel issues generic requests such as "acknowledge interrupt"; it relies on another layer to carry them out on the actual platform.', 'The I/O manager routes I/O requests to drivers; it never talks to the platform hardware itself.'],
          why: 'The HAL maps generic hardware commands onto platform-specific ones, so the kernel and drivers barely change from one kind of machine to another.' },
        { type: 'match', q: 'Match each executive component to its job.',
          pairs: [['I/O manager', 'Packs requests into I/O request packets and passes them to drivers'], ['Cache manager', 'Keeps recently used file data in main memory'], ['Security reference monitor', 'Checks access rights against an object\'s security descriptor'], ['Configuration manager', 'Implements and manages the registry'], ['Plug-and-play manager', 'Detects new devices and loads their drivers']],
          why: 'Each executive manager owns exactly one job, which keeps the executive modular: changing one manager leaves the others untouched.' },
        { q: 'Which statement about the history of Windows is accurate?',
          choices: ['Windows 10 is built on the Windows NT design that first shipped in 1993.', 'Windows 10 still runs on top of MS-DOS, like Windows 95 did.', 'Windows XP was the last release built on NT.', 'Windows NT was written for Intel processors only, so moving to ARM required a new OS.'], answer: 0,
          feedback: [null, 'The MS-DOS-based line ended with Windows Me; since Windows XP every Windows PC has run NT underneath.', 'XP was the first NT release for home users, not the last; Vista, 7, 8, 10 and 11 all continued the NT line.', 'NT was designed to be portable from the start (it first ran on several processor families), and the HAL is part of what made the ARM move practical.'],
          why: 'Every modern Windows, desktop and server, descends from Windows NT, a portable, modular design started from scratch in the early 1990s.' },
        { type: 'bucket', q: 'Does each part run in user mode or in kernel mode?', buckets: ['User mode', 'Kernel mode'],
          items: [['Session manager', 0], ['Print spooler service', 0], ['Win32 subsystem DLLs', 0], ['Logon process', 0], ['Object manager', 1], ['Hardware abstraction layer', 1], ['ALPC facility', 1], ['Device drivers', 1]],
          why: 'Special system processes, service processes, environment subsystems and their DLLs, and applications run in user mode. The executive (including the object manager and ALPC), the kernel, the HAL, drivers, and windowing and graphics run in kernel mode.' },
        { q: 'The print spooler service crashes because of a bug, but every other program and the OS itself keep running. Which advantage of the client/server model does this show best?',
          choices: ['It simplifies the executive', 'It improves reliability', 'It gives applications one uniform way to ask for services', 'It is a natural base for distributed computing'], answer: 1,
          feedback: ['True in general, but this example is about containing a failure, not about keeping the executive small.', null, 'Uniform RPC calls describe how clients ask, not what happens when a server fails.', 'Distribution is about moving a server to another machine, which did not happen here.'],
          why: 'Each server runs as its own process with its own memory, so a failure stays inside that server. The service control manager can even restart it.' },
        { type: 'order', q: 'Put the path of a file-open request in order.',
          items: ['The application calls CreateFile', 'A subsystem DLL calls the native service in ntdll.dll', 'A system call switches the processor into kernel mode', 'The I/O manager sends an I/O request packet to the file system driver', 'The disk driver sets up the transfer using HAL routines', 'The disk controller finishes and raises an interrupt'],
          why: 'The request moves down the layers: application, subsystem DLL, system call, executive (I/O manager), drivers, HAL, hardware. The interrupt at the end is how the hardware reports back.' },
        { type: 'num', q: 'A process has 4 threads. Each needs 6 ms of processor time and never waits for I/O. On a 4-processor machine running Windows, what is the shortest time until all four threads have finished?', answer: 6, tol: 0, unit: 'ms',
          why: 'Windows lets the threads of one process run on different processors at the same time, so all four run side by side and finish after 6 ms. If only one thread at a time were allowed, it would take 4 × 6 = 24 ms.' },
        { type: 'multi', q: 'Which statements about Windows on a symmetric multiprocessor are true?',
          choices: ['Any OS routine can run on any available processor.', 'Two threads of the same process can run on different processors at the same moment.', 'All kernel-mode code runs on processor 0 only.', 'A server process can use several threads to serve several clients at once.', 'The kernel\'s own code runs in threads, just like the rest of the OS.'], answer: [0, 1, 3],
          why: 'Windows treats processors as equals: OS routines, and threads of the same process, can run anywhere and at the same time, and servers use many threads for many clients. The kernel is the exception to "everything runs in threads": its own code does not.' },
        { type: 'num', q: 'Process A creates a named event and gets a handle to it. Processes B and C then open the same event by name. Next, A and B close their handles. How many handles still refer to the event?', answer: 1, tol: 0, unit: 'handles',
          why: 'Three handles were opened (A, B, C) and two were closed, leaving C\'s. The object manager keeps the event alive until the last handle closes, then deletes it.' },
        { q: 'Process B wants a handle to an event that process A created. In which case can B <b>not</b> get it by asking the object manager for it by name?',
          choices: ['A created the event without a name', 'The event\'s security descriptor lets B\'s user wait on it', 'A still holds its own handle to the event', 'A and B run on different processors'], answer: 0,
          feedback: [null, 'Permission is exactly what B needs; the security reference monitor would allow the open.', 'A holding a handle keeps the event alive, which helps B rather than stopping it.', 'Processors do not matter: objects live in kernel memory shared by all processors.'],
          why: 'Only a named object appears in the object manager\'s namespace. An unnamed object can reach another process only if a handle is passed on, for example by duplication or inheritance.' },
        { type: 'bucket', q: 'Sort these kernel objects.', buckets: ['Control objects', 'Dispatcher objects'],
          items: [['Asynchronous procedure call (APC)', 0], ['Deferred procedure call (DPC)', 0], ['Interrupt object', 0], ['Profile object', 0], ['Event', 1], ['Mutex', 1], ['Semaphore', 1], ['Timer', 1]],
          why: 'Control objects steer the kernel\'s own operation (APC, DPC, interrupt, process, profile). Dispatcher objects are used for synchronization: threads wait on them until they become signaled.' },
        { type: 'match', q: 'Match each object-oriented idea to its Windows example.',
          pairs: [['Encapsulation', 'Programs reach an object only through a handle and its operations'], ['Class and instance', 'Every opened file is a new object of the File type'], ['Inheritance', 'Mutex, event and semaphore objects share a common header and its code'], ['Polymorphism', 'One wait function works on processes, threads, events and timers']],
          why: 'Windows is written in C, but its design uses all four ideas; inheritance appears only inside the implementation.' },
      ],
    },

  ],

  notes: `
<h3>Microsoft Windows: one design, many machines</h3>
<p>Windows runs on tablets, laptops, desktops, consoles and servers with 100+ processors, all on one core design, <b>Windows NT</b>, built from scratch in the early 1990s as a modular, portable, multitasking OS with security and multiprocessor support.</p>
<h4>1. Background</h4>
<p>Early Windows (1.0 to 3.x, 95, 98, Me) ran on top of MS-DOS. NT was a fresh design: <b>NT 3.1</b> (1993) was 32-bit with preemptive multitasking and protected memory, written mostly in C for portability. <b>NT 4.0</b> (1996) moved windowing and graphics into kernel mode for speed. <b>2000</b> added plug and play and power management. <b>XP</b> (2001) brought NT to home users and ended the MS-DOS line. <b>Vista</b> (2007) was an internal overhaul (ALPC replaced LPC). <b>7</b> (2009) scaled to many more processors. <b>8</b> (2012) added touch and ARM support. <b>10</b> (2015): one core for PCs, tablets, phones, Xbox and small devices; Windows Server shares it. <b>11</b> (2021) continues on the same NT core.</p>
<h4>2. Architecture</h4>
<p>Windows is highly <b>modular</b>. User programs cross into kernel mode only through system calls. <b>Kernel-mode components:</b></p>
<ul>
<li><b>Executive:</b> core OS services, organised as managers (below).</li>
<li><b>Kernel:</b> thread scheduling, process switching, exception and interrupt handling, multiprocessor synchronization. Unlike the rest of the OS, the kernel's own code does not run in threads.</li>
<li><b>Hardware abstraction layer (HAL):</b> maps generic hardware commands onto those of one specific platform, isolating the OS from differences in the system bus, DMA controller, interrupt controller and timers. It hides the platform wiring, not the processor: a new processor family (e.g. ARM) also needs recompiling and a small processor-specific part of the kernel.</li>
<li><b>Device drivers:</b> loadable modules that operate devices or implement file systems; a buggy one can crash the system.</li>
<li><b>Windowing and graphics system:</b> windows, menus, input focus, drawing.</li>
</ul>
<table>
<tr><th>Executive manager</th><th>Job</th></tr>
<tr><td>I/O manager</td><td>One interface to all devices; sends I/O request packets (IRPs) to drivers</td></tr>
<tr><td>Cache manager</td><td>Keeps recently used file data in main memory</td></tr>
<tr><td>Object manager</td><td>Creates, names, tracks, deletes objects; hands out handles</td></tr>
<tr><td>Plug-and-play manager</td><td>Detects devices, loads their drivers</td></tr>
<tr><td>Power manager</td><td>Sleep, hibernate, powering down idle devices</td></tr>
<tr><td>Security reference monitor</td><td>Checks access against security descriptors</td></tr>
<tr><td>Virtual memory manager</td><td>Maps virtual to physical memory; pages to and from disk</td></tr>
<tr><td>Process/thread manager</td><td>Creates and deletes processes and threads</td></tr>
<tr><td>Configuration manager</td><td>Implements the registry</td></tr>
<tr><td>ALPC facility</td><td>Fast message passing between local processes</td></tr>
</table>
<p><b>User-mode processes:</b> <b>special system processes</b> (session manager, logon process, authentication subsystem, service control manager); <b>service processes</b> (printer spooler, event logger); <b>environment subsystems</b> that give programs an OS personality (Win32 is the main one), whose <b>subsystem DLLs</b> translate API calls into native system calls; and <b>user applications</b> (EXEs and DLLs).</p>
<p><b>A file-open request:</b> app calls CreateFile → subsystem DLL calls NtCreateFile in ntdll.dll → system call enters kernel mode → I/O manager asks the object manager to resolve the name → I/O manager creates a file object and sends an IRP to the file system driver → if the file's information is not in memory, the disk driver reads it, using HAL routines (e.g. for DMA) → controller transfers data and interrupts; the driver queues a DPC to finish and the kernel wakes the waiting thread → the file system driver has the security reference monitor check the file's security descriptor → the app receives a handle.</p>
<h4>3. Client/server model</h4>
<p>Many services run as <b>servers</b> in their own processes (environment subsystems, services); applications are their <b>clients</b>. A client sends a request message; the server does the work and replies. Locally, messages travel through the executive's ALPC facility to the server's <b>port</b>. Windows is not a pure microkernel: the executive stays in kernel mode for speed. Advantages:</p>
<ol>
<li><b>Simplifies the executive:</b> new APIs and services are added as servers without changing it.</li>
<li><b>Improves reliability:</b> each server is its own process, so a crash is contained (and the service can be restarted).</li>
<li><b>Uniform communication:</b> applications reach every service the same way, through remote procedure calls (RPCs). A small <b>stub</b> in the client packs each call's parameters into a message, so the call looks like an ordinary function call.</li>
<li><b>Base for distributed computing:</b> a server can move to another machine while clients make the same calls.</li>
</ol>
<h4>4. Threads and SMP</h4>
<p>On a symmetric multiprocessor, any OS routine can run on any available processor, and different routines can run on different processors at once. Threads of one process can run on different processors simultaneously. Server processes can use several threads to serve several clients at once. Processes share data and resources through flexible IPC.</p>
<p><b>Worked example:</b> 21 units of work on 4 cores finish at time 6 under Windows' rules (lower bound 21 ÷ 4 = 5.25), with cores 21 ÷ 24 ≈ 88% busy. Forcing OS routines onto core 0 (a master/slave design) gives 8; making a process's threads take turns gives 9; both give 11. With 1 or 2 cores all rules tie. Four 6 ms threads on 4 processors finish in 6 ms, but would need 24 ms one at a time.</p>
<h4>5. Windows objects</h4>
<p>Windows is written in C but uses four object-oriented ideas: <b>encapsulation</b> (data hidden; only operations visible), <b>object class and instance</b> (each object type is a template; every opened file is a new File object), <b>inheritance</b> (only inside the implementation, e.g. objects sharing a common header), and <b>polymorphism</b> (one wait function works on processes, threads, events and timers).</p>
<p>Windows uses objects for data that user mode must reach, or that is shared or protected. The <b>object manager</b> creates and tracks all objects; it keeps each object's header (name, security descriptor, handle count), while the body holds type-specific data. Programs use them through <b>handles</b>, indexes into a per-process handle table, so one number can mean different objects in two processes. A <b>security descriptor</b> records who may do what; the security reference monitor checks it when a handle is opened, and the rights granted are stored with the handle. <b>Named</b> objects can be opened by name by any permitted process. <b>Unnamed</b> ones are shared only by passing handles on (duplication or inheritance). An object is deleted when its last handle closes. For example, if A, B and C hold handles and A and B close theirs, 1 remains.</p>
<p><b>Kernel objects</b> sit underneath executive objects (an executive event is built around a kernel event). <b>Control objects</b> control the kernel: asynchronous procedure call (interrupts a thread to run a procedure), deferred procedure call (postpones interrupt work), interrupt (links a source to its service routine), process, profile (measures where code spends time). <b>Dispatcher objects</b> are used for synchronization: each is signaled or not, and threads wait on them (event, mutex, semaphore, timer, thread). The process object is in both lists, since threads can wait for a process to end.</p>
<p><b>Common mistakes:</b> the HAL is not a device driver; the kernel is not the executive; Windows is not a pure microkernel.</p>`,
});
