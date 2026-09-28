// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 2.7 — Microsoft Windows Overview
   Original teaching material. Built step by step. */
Guide.section({  // registers this section with the guide: Guide.section checks the object below and adds it to the table of contents
  id: '2.7',  // section number 2.7; the guide uses it for links, saved progress and the section's own CSS class (sec-2-7)
  title: 'Microsoft Windows Overview',  // full title shown at the top of every step in this section
  short: 'Windows overview',  // short title used where space is tight, such as the contents list and progress chips
  summary: 'How Windows is built: executive, kernel and HAL, client/server subsystems, SMP threads and objects.',  // one-sentence summary shown on the chapter overview card for this section
  objectives: [  // objectives: the list of things a student should be able to do after this section
    'Trace the Windows NT line from 1993 to Windows 10 and 11 and explain how one design came to run on everything from tablets to servers.',  // objective 1: follow the Windows NT line from 1993 to today and see why one design fits every machine
    'Name the kernel-mode parts of Windows (the executive and its managers, the kernel, the HAL, device drivers, windowing and graphics) and the four kinds of user-mode processes.',  // objective 2: name the kernel-mode parts of Windows and the four kinds of user-mode processes
    'Explain the client/server model inside Windows, how ALPC messages carry requests, and the four advantages of the design.',  // objective 3: explain client/server inside Windows, the ALPC messages that carry requests, and its advantages
    'Describe how Windows uses threads and symmetric multiprocessing to keep every processor busy.',  // objective 4: describe how threads and symmetric multiprocessing keep all processors busy
    'Explain Windows objects: the object manager, handles, security descriptors, named and unnamed objects, and control versus dispatcher objects.',  // objective 5: explain Windows objects, handles, security descriptors and the two families of kernel objects
  ],  // closes the objectives list
  terms: [  // terms: glossary entries as [term, definition] pairs; they feed the glossary panel and the dotted-word pop-ups
    ['Windows NT', 'The family of Microsoft operating systems designed from scratch in the early 1990s ("NT" first stood for New Technology). Every modern desktop and server version of Windows, including Windows 10 and Windows 11, is built on it.'],  // glossary entry: defines Windows NT, the design every modern Windows grew from
    ['Executive', 'The upper layer of kernel-mode Windows. It holds the core OS services, organised as managers: I/O, cache, objects, plug and play, power, security, virtual memory, processes and threads, configuration, and the ALPC facility.'],  // glossary entry: defines the executive, the upper kernel-mode layer made of managers
    ['Windows kernel', 'The layer beneath the executive that schedules threads, switches between processes, handles exceptions and interrupts, and keeps processors synchronized. Unlike the rest of the OS, its own code does not run in threads.'],  // glossary entry: defines the Windows kernel and notes that its own code does not run in threads
    ['Hardware abstraction layer (HAL)', 'A thin layer of kernel-mode code that turns generic hardware requests from the rest of Windows into the exact commands one platform needs, hiding differences in buses, DMA controllers, interrupt controllers and timers.'],  // glossary entry: defines the hardware abstraction layer (HAL), which hides platform differences
    ['Device driver', 'A kernel-mode module, loaded when needed, that knows how to operate one kind of device or file system and turns I/O requests into commands for it.'],  // glossary entry: defines a device driver, a loadable module that operates one kind of device
    ['Environment subsystem', 'A user-mode server process together with its DLLs that gives programs one operating-system "personality", meaning one set of API calls. Win32 is the main subsystem in Windows.'],  // glossary entry: defines an environment subsystem, the server plus DLLs that give programs an OS personality
    ['Dynamic link library (DLL)', 'A file of shared code that is loaded into a process while it runs, so many programs can use the same functions without each carrying its own copy. Subsystem DLLs translate API calls into system calls.'],  // glossary entry: defines a DLL, shared code loaded into a running process
    ['Win32 API', 'The main programming interface of Windows: thousands of documented functions, such as CreateFile, that applications call to use OS services.'],  // glossary entry: defines the Win32 API, the main set of functions Windows programs call
    ['Service process', 'A background process that provides a service whether or not anyone is logged in, such as the print spooler or the event logger. The service control manager starts and stops it.'],  // glossary entry: defines a service process, a background program that runs even when nobody is logged in
    ['Advanced local procedure call (ALPC)', 'The executive\'s fast message-passing facility between processes on the same computer. A client sends a request to a server\'s port and the server sends back a reply.'],  // glossary entry: defines ALPC, the fast message facility between processes on one computer
    ['Client/server model', 'A way of structuring software in which a client asks for a service by sending a message, and a server process does the work and sends back a reply.'],  // glossary entry: defines the client/server model: a client asks by message, a server does the work
    ['Remote procedure call (RPC)', 'A request that looks like an ordinary function call to the caller but is carried out by messages to a server, which may be on the same computer or across a network.'],  // glossary entry: defines a remote procedure call, a message exchange that looks like a normal function call
    ['Symmetric multiprocessor (SMP)', 'A computer with two or more similar processors that share main memory and I/O, where any processor can run any work, including the operating system itself.'],  // glossary entry: defines a symmetric multiprocessor, where any processor can run any work, OS included
    ['Object manager', 'The executive component that creates, names, tracks and deletes every Windows object and hands out the handles programs use to reach them.'],  // glossary entry: defines the object manager, which creates, names, tracks and deletes objects
    ['Handle', 'A small number, private to one process, that stands for an object the process has opened. It indexes the process\'s handle table; programs never get a direct pointer to the object.'],  // glossary entry: defines a handle, a per-process number that stands for an opened object
    ['Security descriptor', 'Data attached to an object that records its owner and which users or groups may do what with it. It is checked whenever someone opens a handle to the object.'],  // glossary entry: defines a security descriptor, the owner and access rules attached to an object
    ['Dispatcher object', 'A kernel object that threads can wait on. It is either signaled or not signaled, and waiting threads are released when it becomes signaled. Events, mutexes, semaphores, timers, threads and processes are examples.'],  // glossary entry: defines a dispatcher object, a kernel object that threads can wait on
    ['Control object', 'A kernel object used to control how the kernel itself operates, rather than to synchronize threads: asynchronous procedure call, deferred procedure call, interrupt, process and profile objects. (The process object is also waitable, so it belongs to both families.)'],  // glossary entry: defines a control object, a kernel object that steers how the kernel itself works
    ['Encapsulation', 'Hiding an object\'s data inside it so that outsiders can use the object only through the operations (methods) it offers.'],  // glossary entry: defines encapsulation, hiding an object's data behind its operations
    ['Polymorphism', 'Using one operation on objects of different types, with each type supplying its own meaning for that operation.'],  // glossary entry: defines polymorphism, one operation with a different meaning for each type
  ],  // closes the terms list

  css: ` /* css: style rules for this section only; the guide adds them to the page when the section is registered */
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width and the page scrolls sideways */
    .sec-2-7 .step-eyebrow { contain: inline-size; } /* stops the long step heading line from forcing the whole page wider than the screen on a phone */
    .sec-2-7 .hot { cursor: pointer; outline: none; } /* .hot marks clickable parts of a drawing: a pointer cursor, and no browser focus box around the shape */
    .sec-2-7 .hot .fr { transition: stroke-width .15s, opacity .2s; } /* makes the frame of a clickable shape thicken and fade smoothly instead of jumping */
    .sec-2-7 .hot:hover .fr, .sec-2-7 .hot:focus-visible .fr { stroke-width: 3.5; } /* hovering or tabbing to a clickable shape thickens its frame so the student sees what they are about to pick */
    .sec-2-7 .hot.sel .fr { stroke-width: 4; } /* the currently selected shape gets the thickest frame */
    .sec-2-7 .dim-others .hot:not(.sel) { opacity: .42; } /* when a shape is selected, every other clickable shape fades so the chosen one stands out */
    .sec-2-7 .info { display: flex; flex-direction: column; gap: 8px; } /* .info: the explanation panel beside a drawing, stacked top to bottom with small gaps */
    .sec-2-7 .info h3 { margin: 0; } /* removes the default space around the heading in the explanation panel */
    .sec-2-7 .info p { font-size: 15.5px; line-height: 1.45; margin: 0; } /* sets a comfortable reading size and spacing for paragraphs in the explanation panel */
    .sec-2-7 .eg { font-size: 14.5px; line-height: 1.4; padding: 7px 11px; border-radius: 10px; background: var(--panel-3); border-left: 4px solid var(--chc); } /* .eg: a small example box with a tinted fill and a stripe in the chapter color down its left edge */
    .sec-2-7 .eg b { color: var(--chc); } /* bold words inside an example box take the chapter color */
    .sec-2-7 .mgrs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 10px; height: 100%; } /* .mgrs: the grid of ten executive manager buttons in step 3, two columns of equal-height tiles */
    .sec-2-7 .mgr { display: flex; flex-direction: column; justify-content: center; gap: 2px; text-align: left; padding: 8px 14px; border: 2px solid color-mix(in srgb, var(--os) 35%, var(--line)); border-radius: 12px; background: var(--os-bg); color: var(--ink); cursor: pointer; font: inherit; transition: border-color .15s, background .15s; } /* .mgr: one manager button: name and job stacked, left-aligned, with a rounded purple-tinted border */
    .sec-2-7 .mgr b { font-size: 16px; } /* the manager's name inside its button is a little larger */
    .sec-2-7 .mgr span { font-size: 14px; color: var(--ink-2); line-height: 1.3; } /* the one-line job description under the manager's name is smaller and grey */
    .sec-2-7 .mgr:hover { border-color: var(--os); } /* hovering a manager button darkens its border to the operating system purple */
    .sec-2-7 .mgr.ok { border-color: var(--ok); background: var(--ok-bg); } /* a manager button turns green when it is the right answer to the current request */
    .sec-2-7 .mgr.bad { border-color: var(--bad); background: var(--bad-bg); } /* a manager button turns red when it was a wrong pick */
    .sec-2-7 .scen { font-size: 18px; line-height: 1.45; padding: 12px 14px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--line); min-height: 120px; } /* .scen: the box in step 3 that shows the incoming request, in large text so it is easy to read */
    .sec-2-7 .scen .xs { letter-spacing: .08em; margin-bottom: 4px; } /* the small "INCOMING REQUEST" label above the scenario is spaced out a little */
    .sec-2-7 .dot { width: 22px; height: 8px; border-radius: 9px; background: var(--panel-3); display: inline-block; } /* .dot: one small pill in the progress row of step 3, one per request, grey until it is played */
    .sec-2-7 .dot.cur { background: var(--chc); } /* the pill for the request being played now takes the chapter color */
    .sec-2-7 .dot.ok { background: var(--ok); } /* a green pill means that request was answered right on the first try */
    .sec-2-7 .dot.warn { background: var(--warn); } /* an amber pill means that request needed more than one try */
    .sec-2-7 .fb .callout { font-size: 15px; line-height: 1.45; } /* feedback notes under the step 3 game use a slightly smaller font */
    .sec-2-7 .xlate { display: grid; grid-template-columns: minmax(0, 2fr) auto minmax(0, 3fr); gap: 8px; align-items: stretch; } /* .xlate: step 4's translation row: generic request, arrow, then what the HAL does on this platform */
    .sec-2-7 .xlate .box { text-align: left; font-size: 15px; line-height: 1.4; font-weight: 600; } /* each box in the translation row has left-aligned, semi-bold text */
    .sec-2-7 .xlate .box .xs { letter-spacing: .06em; margin-bottom: 3px; } /* the small caption at the top of each translation box is spaced out a little */
    .sec-2-7 .xlate .arrow { align-self: center; font-size: 22px; font-weight: 900; color: var(--chc); } /* the big arrow between the two translation boxes, centered and in the chapter color */
    .sec-2-7 .adv { display: flex; flex-direction: column; gap: 2px; padding: 8px 11px; border: 2px solid var(--line); border-radius: 11px; background: var(--panel); transition: border-color .25s, background .25s; } /* .adv: one of the four advantage cards in step 5, with a border that can change color smoothly */
    .sec-2-7 .adv b { font-size: 15px; } /* the advantage's title */
    .sec-2-7 .adv span { font-size: 13.5px; line-height: 1.35; color: var(--ink-2); } /* the advantage's short explanation, smaller and grey */
    .sec-2-7 .adv.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); } /* the advantage card that the current animation frame illustrates gets a colored border and a light glow */
    .sec-2-7 .tok { transition: transform .6s ease, opacity .3s; pointer-events: none; } /* .tok: the moving message token in step 5; it glides between spots and never blocks clicks */
    .sec-2-7 .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; } /* .kpis: the row of four number tiles under the step 6 chart */
    .sec-2-7 .kpi { display: flex; flex-direction: column; gap: 0; } /* one number tile: its label and its value stacked */
    .sec-2-7 .kpi .big { font-size: 32px; } /* the value in a number tile is shown large */
    .sec-2-7 .kpi .xs { letter-spacing: .05em; line-height: 1.25; } /* the label in a number tile is small with a little extra letter spacing */
    .sec-2-7 .objgrid { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 16px; height: 100%; } /* .objgrid: step 7 tab 1 layout: a fixed-width action list on the left, the tables on the right */
    .sec-2-7 .pcol { gap: 5px; font-size: 14.5px; min-height: 0; } /* .pcol: one column (process A, object manager, process B) in step 7, with tight spacing */
    .sec-2-7 .hrow { font-size: 14px; padding: 4px 8px; border-radius: 8px; background: var(--panel); border: 1px solid var(--line); } /* .hrow: one row of a process's handle table in step 7, drawn as a small bordered strip */
    .sec-2-7 .objc { padding: 6px 9px; border-radius: 9px; background: var(--panel); border: 1.5px solid color-mix(in srgb, var(--os) 45%, transparent); line-height: 1.35; } /* .objc: one object card inside the object manager column, with a purple-tinted border */
    .sec-2-7 .objc .xs { font-size: 13px; overflow-wrap: anywhere; } /* small text inside an object card may break anywhere so long object names never overflow */
    .sec-2-7 .oorow { display: grid; grid-template-columns: minmax(0, 1fr) 272px; gap: 10px; align-items: center; padding: 4px 8px 4px 10px; border: 2px solid var(--line); border-radius: 11px; background: var(--panel); } /* .oorow: one example row in step 7 tab 2: the example text on the left, four idea buttons on the right */
    .sec-2-7 .oorow .small { font-size: 14px; line-height: 1.35; } /* the example sentence in a row uses slightly smaller text */
    .sec-2-7 .oorow.miss { border-color: color-mix(in srgb, var(--warn) 60%, transparent); } /* a row gets an amber border after a wrong pick */
    .sec-2-7 .oorow.right { border-color: var(--ok); background: var(--ok-bg); } /* a row turns green once it is matched correctly */
    .sec-2-7 .oobtns { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; } /* .oobtns: the four idea buttons in a row, arranged two by two */
    .sec-2-7 .oobtns .btn { height: 25px; font-size: 13px; padding: 0 6px; } /* makes the idea buttons short and compact so the six rows fit on screen */
    .sec-2-7 .bucket { display: flex; flex-direction: column; gap: 5px; padding: 10px; border: 2px dashed var(--line-2); border-radius: 12px; background: var(--panel-2); min-height: 0; } /* .bucket: one dashed sorting box in step 7 tab 3 (control objects or dispatcher objects) */
    .sec-2-7 .bitem { font-size: 13.5px; line-height: 1.3; padding: 4px 8px; border-radius: 8px; background: var(--panel); border: 1px solid var(--line); } /* .bitem: one sorted kernel object shown inside a bucket */
  `,  // end of the section's CSS text

  steps: [  // steps: the list of screens in this section, shown one at a time as the student presses Next
    /* ---------------- 1. Big picture: one design, many machines + clickable NT timeline ---------------- */
    {  // step 1 starts here
      title: 'One operating system, from tablets to server rooms',  // step title shown as the heading of step 1
      kind: 'story',  // kind "story" sets the small label above the title (the step type)
      render(el, ctx) {  // render(el, ctx): builds step 1 inside el when the step opens; ctx carries the guide's helper tools
        const { h, s } = ctx;  // takes the helpers h (makes HTML elements) and s (makes SVG drawing elements, the browser's drawing format)
        const REL = [  // REL: the eight Windows releases on the timeline, each with a short name, full name, year and two notes
          { n: 'NT 3.1', full: 'Windows NT 3.1', y: 1993,  // release NT 3.1 (1993): n is the short label on the timeline, full is the heading, y is the year
            what: 'A brand-new design that did not sit on top of MS-DOS. Fully 32-bit, with preemptive multitasking, a protected memory space for every process, built-in security and support for several processors. It was written mostly in C so that it could run on several processor families, not just Intel chips.',  // what NT 3.1 changed: a fresh design, not built on MS-DOS, 32-bit, protected and portable
            see: 'The layered architecture you will explore in this section (executive, kernel, hardware abstraction layer or HAL, subsystems) was there from day one.' },  // where the student meets NT 3.1 again: the layered architecture explored in this section
          { n: 'NT 4.0', full: 'Windows NT 4.0', y: 1996,  // release NT 4.0 (1996)
            what: 'Took on the friendly look of Windows 95. Under the hood, the window manager and graphics code moved out of a user-mode server process and into kernel mode, which made the screen draw much faster.',  // what NT 4.0 changed: the Windows 95 look, and windowing and graphics moved into kernel mode
            see: 'That is why <b>windowing and graphics</b> appears among the kernel-mode parts of Windows.' },  // where the student meets NT 4.0 again: windowing and graphics in the kernel-mode part of the map
          { n: '2000', full: 'Windows 2000', y: 2000,  // release Windows 2000
            what: 'Brought plug and play (devices recognised the moment you connect them) and proper power management to the NT line, plus Active Directory for managing whole networks of users and computers.',  // what Windows 2000 changed: plug and play, power management and Active Directory
            see: 'The executive\'s <b>plug-and-play manager</b> and <b>power manager</b>, in the form you meet in step 3, arrived in the NT line with this release.' },  // where the student meets Windows 2000 again: the plug-and-play and power managers of step 3
          { n: 'XP', full: 'Windows XP', y: 2001,  // release Windows XP (2001)
            what: 'The first NT release aimed at home users. It replaced the MS-DOS-based line (Windows 95, 98 and Me), so from then on every Windows PC ran NT underneath. 64-bit editions followed.',  // what XP changed: NT reached home users and replaced the MS-DOS-based line
            see: 'Home and business machines now share one kernel, and every idea in this section applies to both.' },  // where the student meets XP again: home and business PCs now share one kernel
          { n: 'Vista', full: 'Windows Vista', y: 2007,  // release Windows Vista (2007)
            what: 'A big internal overhaul: stronger security (User Account Control), a new graphics driver model, and a faster message facility between processes, ALPC, which replaced the older LPC.',  // what Vista changed: stronger security, a new graphics driver model, and ALPC replacing LPC
            see: 'The <b>ALPC facility</b> in the executive, which carries client/server messages, arrived here.' },  // where the student meets Vista again: the ALPC facility that carries client/server messages
          { n: '7', full: 'Windows 7', y: 2009,  // release Windows 7 (2009)
            what: 'Refined and sped up Vista. Deep changes to the scheduler removed a single system-wide lock, so Windows could make good use of machines with far more processors (up to 256 logical processors).',  // what Windows 7 changed: scheduler work that removed a single system-wide lock, allowing many more processors
            see: 'This is the <b>symmetric multiprocessing</b> story of step 6: every processor can run OS code at the same time.' },  // where the student meets Windows 7 again: the symmetric multiprocessing lab in step 6
          { n: '8', full: 'Windows 8', y: 2012,  // release Windows 8 (2012)
            what: 'Redesigned for touch screens and tablets, and shipped on ARM processors as well as Intel and AMD ones. The portable design, and the HAL in particular, made that move practical.',  // what Windows 8 changed: touch screens, tablets and ARM processors
            see: 'Step 4 shows how the <b>hardware abstraction layer</b> hides one platform\'s wiring from the rest of the OS.' },  // where the student meets Windows 8 again: the HAL lab in step 4
          { n: '10', full: 'Windows 10', y: 2015,  // release Windows 10 (2015)
            what: 'One shared core for PCs, tablets, phones, the Xbox and small embedded devices, kept up to date with regular feature updates instead of a big new version every few years. Windows 11 (2021) continues on the same core.',  // what Windows 10 changed: one shared core for every kind of device, updated regularly; Windows 11 continues it
            see: 'The same NT design, stretched from a phone-sized device to a data-centre server.' },  // where the student meets Windows 10 again: the same design from phone-sized devices to servers
        ];  // closes the REL list of releases
        let cur = 0;  // cur is the index of the release currently shown in the panel; it starts at the first one, NT 3.1
        // phones get two rows of four releases so the labels stay readable
        const NW = ctx.narrow, VBW = NW ? 360 : 636;  // NW is true on a phone-width screen; VBW is the width of the drawing's coordinate system (viewBox)
        const X = REL.map((_, i) => (NW ? 45 + (i % 4) * 90 : 38 + i * 80));  // X holds each release's horizontal position: four per row on a phone, all eight in one row otherwise
        const Y = REL.map((_, i) => (NW && i >= 4 ? 142 : 46));  // Y holds each release's vertical position: on a phone the last four go on a second, lower row
        const ROWS = NW ? [[0, 4, 46], [4, 8, 142]] : [[0, 8, 46]];  // ROWS lists each timeline row as [first release, one past the last release, height of the line]
        const svg = s('svg', { viewBox: `0 0 ${VBW} ${NW ? 196 : 100}`, width: '100%', class: 'tl' });  // creates the SVG timeline drawing; its height grows on a phone to fit the second row
        const head = h('h3', {});  // heading of the panel under the timeline: the chosen release's full name and year
        const what = h('p', {});  // paragraph that explains what the chosen release changed
        const see = h('div', { class: 'eg' });  // example box that says where in this section the student meets that change
        const prev = h('button', { class: 'btn sm', onclick: () => show(cur - 1) }, '◀ Earlier');  // "Earlier" button: shows the previous release on the timeline
        const next = h('button', { class: 'btn sm', onclick: () => show(cur + 1) }, 'Later ▶');  // "Later" button: shows the next release on the timeline
        function draw() {  // draw(): rebuilds the whole timeline drawing; runs every time the chosen release changes
          const kids = [];  // kids collects every shape of the drawing before it is put on the screen in one go
          ROWS.forEach(([a, b, y]) => {  // for each timeline row: draw a grey track and, if needed, a colored progress bar on top
            kids.push(s('line', { x1: 20, y1: y, x2: VBW - 20, y2: y, class: 's-muted', 'stroke-width': 4 }));  // the grey track that runs the full width of the row
            const reach = cur >= b ? VBW - 20 : cur >= a ? X[cur] : null; // progress bar up to the chosen release
            if (reach != null) kids.push(s('line', { x1: 20, y1: y, x2: reach, y2: y, style: 'stroke:var(--chc)', 'stroke-width': 4 }));  // draws the colored part of the track, from the left edge up to the chosen release
          });  // ends the loop over rows
          REL.forEach((r, i) => {  // for each release: draw its clickable marker, year and name
            const on = i === cur, y = Y[i];  // on is true for the chosen release; y is that release's row height
            kids.push(s('g', { class: 'hot' + (on ? ' sel' : ''), role: 'button', tabindex: 0, 'aria-label': r.full, onclick: () => show(i), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); } } },  // a group acting as a button: click it or press Enter or Space to show that release
              s('circle', { cx: X[i], cy: y, r: 22, fill: 'transparent' }),  // a large invisible circle around the marker so it is easy to hit with a finger or mouse
              s('circle', { class: 'fr ' + (on ? 's-accent' : i < cur ? 's-os' : 's-panel'), cx: X[i], cy: y, r: on ? 14 : 10, 'stroke-width': 2 }),  // the visible marker: bigger and accent-colored if chosen, purple if already passed, plain if still ahead
              s('text', { x: X[i], y: y - 28, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(r.y)),  // the release year written above the marker in small grey text
              s('text', { x: X[i], y: y + 40, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': on ? 800 : 600, style: on ? 'fill:var(--accent)' : '' }, r.n)));  // the release name written below the marker, bold and in the accent color when chosen
          });  // ends the loop over releases
          svg.replaceChildren(...kids);  // replaces everything in the SVG with the freshly built shapes
        }  // ends draw()
        function show(i) {  // show(i): makes release i the chosen one and fills the panel; runs on clicks and on the arrow buttons
          cur = ctx.util.clamp(i, 0, REL.length - 1);  // keeps i inside the list (clamp limits a number to a range) so the buttons cannot go past either end
          const r = REL[cur];  // r is the chosen release's data
          head.innerHTML = `${r.full} <span class="chip os" style="vertical-align:3px">${r.y}</span>`;  // writes the full release name and a purple chip with its year into the heading
          what.innerHTML = r.what;  // writes what this release changed into the paragraph
          see.innerHTML = '<b>Where you meet it: </b>' + r.see;  // writes where the student meets this change, after a bold label, into the example box
          prev.disabled = cur === 0; next.disabled = cur === REL.length - 1;  // greys out "Earlier" on the first release and "Later" on the last one
          draw();  // redraws the timeline so the chosen marker is highlighted
        }  // ends show()
        const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left: the left column of step 1, holding the story text
          h('p', { class: 'lead m0', html: 'The same operating system has to run a thin tablet, a gaming laptop and a server with a hundred processors. Windows manages this with <b>one core design</b> that is more than thirty years old.' }),  // opening paragraph: one design has to run on a tablet, a laptop and a large server
          h('p', { class: 'm0', html: 'Early Windows (1.0 to 3.x, then 95, 98 and Me) was built on top of MS-DOS. In the early 1990s Microsoft started again from a blank page and built <span class="t">Windows NT</span>: a modular, portable, multitasking OS with security and multiprocessor support built in. Every version since, including Windows 10, Windows 11 and Windows Server, grew from that design.' }),  // paragraph: early Windows sat on MS-DOS, then NT was built from scratch and every version grew from it
          h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'Car makers build a hatchback, a sedan and a delivery van on one shared chassis and engine. NT is Windows\' chassis: a tablet, a desktop and a server get different bodywork (user interface, bundled services, tuning) on the same core.' }),  // analogy box: one car chassis under many body styles, like one NT core under many Windows editions
          h('div', { class: 'row gap-s small' }, h('span', { class: 'muted' }, 'Same core today:'), ...['tablet', 'laptop', 'desktop', 'server', 'game console'].map((d) => h('span', { class: 'chip' }, d))));  // a row of chips listing the kinds of device that run the same core today
        const right = h('div', { class: 'card white stack', style: { gap: '10px' } },  // right: the card in the right column with the clickable timeline
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'The NT family tree: click a release'), h('div', { class: 'row gap-s' }, prev, next)),  // card header: the title on the left and the Earlier and Later buttons on the right
          svg,  // the timeline drawing itself
          h('div', { class: 'info grow' }, head, what, see),  // the explanation panel for the chosen release, which grows to fill the spare height
          h('div', { style: { borderTop: '1px dashed var(--line-2)', paddingTop: '8px' } },  // a section below the panel, separated by a dashed line
            h('h4', {}, 'The five design ideas in this section'),  // heading for the five design ideas this section covers
            h('div', { class: 'row gap-s' },  // a row of chips, one per design idea
              h('span', { class: 'chip os' }, '1 · layered, modular kernel'), h('span', { class: 'chip io' }, '2 · HAL for portability'),  // chips for ideas 1 and 2: a layered, modular kernel and the HAL for portability
              h('span', { class: 'chip proc' }, '3 · client/server subsystems'), h('span', { class: 'chip thread' }, '4 · threads + SMP'),  // chips for ideas 3 and 4: client/server subsystems and threads with SMP
              h('span', { class: 'chip accent' }, '5 · everything is an object'))));  // chip for idea 5: everything is an object; closes the chip row, the lower section and the card
        el.append(h('div', { class: 'split l fill' }, left, right));  // puts both columns into the step as a two-column layout, the left one smaller
        show(0);  // shows the first release, NT 3.1, so the panel is filled as soon as the step opens
      },  // ends render() for step 1
    },  // ends step 1

    /* ---------------- 2. Architecture map: click every part, then follow a request ---------------- */
    {  // step 2 starts here
      title: 'The Windows architecture map: click every part',  // step title shown as the heading of step 2
      kind: 'explore',  // kind "explore" marks this step as one to click around in
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the architecture map when step 2 opens
        const { h, s } = ctx;  // takes the helpers h (HTML elements) and s (SVG drawing elements)
        const P = {  // P: every box on the architecture map, keyed by a short id
          sys: { r: [12, 30, 152, 98], c: 's-proc', t: ['Special system', 'processes'], sub: ['session manager,', 'logon, security'], mode: 'user', name: 'Special system processes',  // box "sys": special system processes; r is [x, y, width, height], c its color class, t and sub its label lines
            job: 'Processes Windows itself needs, started while the system boots. The <b>session manager</b> is the first user-mode process and sets up each user session. The <b>logon process</b> handles sign-in, the <b>authentication subsystem</b> checks passwords and gives each user a security identity, and the <b>service control manager</b> starts, stops and watches services.',  // what the special system processes do: session manager, logon, authentication and service control
            eg: 'You press Ctrl+Alt+Del and type a password: the logon process and the authentication subsystem do the work.' },  // example: pressing Ctrl+Alt+Del and signing in uses the logon process and authentication subsystem
          svc: { r: [180, 30, 152, 98], c: 's-proc', t: ['Service', 'processes'], sub: ['print spooler,', 'event logger…'], mode: 'user', name: 'Service processes',  // box "svc": service processes, in user mode next to the system processes
            job: 'Background programs with no window of their own that provide a service whether or not anyone is logged in. The service control manager starts, stops and restarts them. Examples: the print spooler, the event logger, the update service, or a database server an administrator installed.',  // what service processes do: background work without a window, started by the service control manager
            eg: 'You print a report: your app hands the job to the <b>print spooler</b> service, which feeds the printer while you keep working.' },  // example: printing hands the job to the print spooler service
          env: { r: [348, 30, 152, 98], c: 's-proc', t: ['Environment', 'subsystems'], sub: ['Win32 is the', 'main one'], mode: 'user', name: 'Environment subsystems',  // box "env": environment subsystems, the OS personalities programs are written for
            job: 'Each subsystem gives programs an operating-system <b>personality</b>: the set of API calls they were written for. A subsystem is a server process plus the DLLs that applications load. <span class="t">Win32 API</span> programs use the Win32 subsystem; early NT also offered OS/2 and POSIX personalities.',  // what an environment subsystem is: a server process plus DLLs; Win32 is the main one
            eg: 'The Win32 subsystem\'s server process is told about every new Win32 process and thread so it can keep its own records.' },  // example: the Win32 subsystem server is told about every new Win32 process and thread
          apps: { r: [516, 30, 152, 98], c: 's-proc', t: ['User', 'applications'], sub: ['your EXE files', 'and their DLLs'], mode: 'user', name: 'User applications',  // box "apps": user applications, the rightmost box of the user-mode row
            job: 'Ordinary programs: an EXE file plus the <span class="t">DLLs</span> it loads. Each runs in <span class="t">user mode</span> in its own private memory, so a bug can crash the program but not the OS. Every OS service it needs is requested through an API such as Win32.',  // what a user application is: an EXE plus its DLLs, in its own protected memory, asking the OS through an API
            eg: 'A browser, a game or a text editor.' },  // example: a browser, a game or a text editor
          dlls: { r: [180, 138, 488, 44], c: 's-panel', t: ['Subsystem DLLs (Win32 API) + ntdll.dll'], sub: ['turn documented API calls into native system calls'], mode: 'user', name: 'Subsystem DLLs',  // box "dlls": the wide strip of subsystem DLLs and ntdll.dll under the applications
            job: 'Libraries loaded into every application. They implement the documented API (for Win32: kernel32.dll, user32.dll, gdi32.dll and others) by translating each call into Windows\' own internal, undocumented <b>native</b> system services. Most calls go through ntdll.dll into the executive; window and drawing calls take a similar route into the windowing and graphics system. A few calls also send a message to the subsystem\'s server process.',  // what the subsystem DLLs do: turn documented API calls into Windows' own native system calls
            eg: 'A call to CreateFile ends up in ntdll.dll\'s NtCreateFile, which executes the special instruction that enters kernel mode.' },  // example: CreateFile ends up in NtCreateFile, which switches into kernel mode
          exec: { r: [12, 226, 500, 128], c: 's-os', t: [], sub: [], mode: 'kernel', name: 'Executive',  // box "exec": the large executive box; its label is drawn separately and its ten manager tiles sit inside it
            job: 'The upper layer of kernel-mode Windows and home of the core OS services. It is organised as a set of <b>managers</b> (the ten tiles), each owning one job. Applications reach them only through system calls; inside the kernel the managers call one another and the kernel directly.',  // what the executive is: the upper kernel-mode layer, organised as ten managers with one job each
            eg: 'Click any tile for its job, or try the "who handles it?" game in step 3.' },  // example text pointing the student to the tiles and to the game in step 3
          win: { r: [524, 226, 144, 128], c: 's-os', t: ['Windowing', 'and graphics'], sub: ['windows, menus,', 'text, images'], mode: 'kernel', name: 'Windowing and graphics system',  // box "win": the windowing and graphics system, to the right of the executive
            job: 'Kernel-mode code that manages windows, menus and keyboard and mouse focus, and draws text and images. Windows NT 4.0 moved it from a user-mode server process into kernel mode to make drawing faster.',  // what windowing and graphics does: windows, menus, focus and drawing, moved into kernel mode in NT 4.0
            eg: 'You drag a window across the screen and it redraws smoothly.' },  // example: dragging a window and seeing it redraw smoothly
          kern: { r: [12, 364, 330, 40], c: 's-os', t: ['Kernel'], sub: ['scheduling · interrupts · sync'], mode: 'kernel', name: 'Kernel',  // box "kern": the kernel, under the executive
            job: 'The core beneath the executive. Its four jobs: <b>thread scheduling</b>, <b>process switching</b>, <b>exception and interrupt handling</b>, and <b>multiprocessor synchronization</b>. Unlike the rest of the executive and user programs, the kernel\'s own code does not run in threads: it is the code that hands out the threads\' turns.',  // what the kernel does: its four jobs, and why its own code does not run in threads
            eg: 'A timer interrupt fires; the kernel picks which thread runs next on that processor.' },  // example: a timer interrupt, after which the kernel picks the next thread for that processor
          hal: { r: [12, 412, 330, 42], c: 's-os', t: ['Hardware abstraction layer (HAL)'], sub: ['hides platform differences'], mode: 'kernel', name: 'Hardware abstraction layer (HAL)',  // box "hal": the hardware abstraction layer, under the kernel
            job: 'Maps the generic hardware commands of the kernel and drivers onto the exact commands one platform needs. It hides differences such as the system bus, the DMA controller, the interrupt controller and the timers, so the rest of Windows barely changes from one machine to another.',  // what the HAL does: maps generic hardware commands onto one platform's exact commands
            eg: 'Step 4 lets you swap the platform and watch what changes.' },  // example text pointing the student to the platform-swapping lab in step 4
          drv: { r: [354, 364, 314, 90], c: 's-io', t: ['Device drivers'], sub: ['disk, network, USB,', 'file systems…'], mode: 'kernel', name: 'Device drivers',  // box "drv": device drivers, to the right of the kernel and HAL
            job: 'Kernel-mode modules, loaded as needed, that extend the executive. Each one operates one kind of device, or implements a file system or network protocol, by turning I/O requests into device commands. Because they run in kernel mode, one buggy driver can crash the whole system.',  // what device drivers do: extend the executive, one device or file system each; a buggy one can crash the system
            eg: 'Plug in a new printer and its driver is loaded so the I/O manager can talk to it.' },  // example: plugging in a printer loads its driver so the I/O manager can reach it
          hw: { r: [12, 466, 656, 30], c: 's-panel', t: ['Hardware: processors · memory · interrupt controller · timers · buses · devices'], sub: [], mode: 'hw', name: 'Hardware',  // box "hw": the hardware strip along the bottom of the map
            job: 'The physical machine. Only kernel-mode code (the kernel, the HAL and drivers) touches it directly; everything else asks the OS.',  // what the hardware layer is: only kernel-mode code touches it directly
            eg: 'The disk controller, network card, keyboard and screen all live here.' },  // example: the disk controller, network card, keyboard and screen
        };  // closes the P table of map boxes
        const TILES = [  // TILES: the ten executive managers as [id, label line 1, label line 2, full name, job, example]
          ['io', 'I/O', 'manager', 'I/O manager', 'The hub for all input and output. It gives every device and file system one common interface, packs each request into an <b>I/O request packet (IRP)</b> and passes it down to the right drivers.', 'Reading a file, sending a network packet and printing all start here.'],  // manager tile: the I/O manager, which packs requests into I/O request packets for drivers
          ['cache', 'Cache', 'manager', 'Cache manager', 'Keeps recently used parts of files in main memory so repeated reads come from RAM instead of the disk, and collects writes to send to the disk later in larger batches. It serves every file system.', 'Open a big document twice: the second time it appears almost instantly.'],  // manager tile: the cache manager, which keeps recently used file data in memory
          ['obj', 'Object', 'manager', 'Object manager', 'Creates, names, tracks and deletes every Windows object: files, processes, threads, events and more. Programs get a <span class="t">handle</span>, never a pointer, and the object is freed when nobody uses it any more.', 'Step 7 lets you create, share and close objects yourself.'],  // manager tile: the object manager, which creates, names and deletes objects and hands out handles
          ['pnp', 'Plug and', 'play mgr', 'Plug-and-play manager', 'Notices when hardware is added or removed, works out which driver each device needs, and loads it.', 'Plug in a USB drive and it appears within seconds.'],  // manager tile: the plug-and-play manager, which notices new hardware and loads its driver
          ['pwr', 'Power', 'manager', 'Power manager', 'Coordinates power use: moves the whole system and individual devices into low-power states such as sleep and hibernate and back again, and turns off idle hardware to save energy.', 'Close the laptop lid and it goes to sleep in the right order.'],  // manager tile: the power manager, which moves the system and devices between power states
          ['srm', 'Security', 'ref. monitor', 'Security reference monitor', 'Enforces access rules. Whenever a program opens an object, it compares the user\'s identity with the object\'s <span class="t">security descriptor</span> and decides which operations are allowed. It also writes audit records.', 'Opening another user\'s private file fails with "access denied".'],  // manager tile: the security reference monitor, which checks access against security descriptors
          ['vm', 'Virtual', 'memory mgr', 'Virtual memory manager', 'Gives every process its own large private address space and maps its virtual addresses onto physical memory, moving pages between main memory and disk as needed.', 'A program touches a page that was moved out to disk; the VM manager brings it back.'],  // manager tile: the virtual memory manager, which maps virtual addresses and moves pages to disk
          ['pt', 'Process/', 'thread mgr', 'Process/thread manager', 'Creates, tracks and deletes process and thread objects. (Choosing which thread runs on which processor is the kernel\'s job, not this manager\'s.)', 'Starting an app creates a process with its first thread.'],  // manager tile: the process/thread manager, which creates and deletes processes and threads
          ['cfg', 'Config-', 'uration mgr', 'Configuration manager', 'Manages the <b>registry</b>: the system-wide database of settings for hardware, drivers, services, applications and users.', 'Which driver a device needs, and your desktop background, are both registry settings.'],  // manager tile: the configuration manager, which runs the registry of system settings
          ['alpc', 'ALPC', 'facility', 'ALPC facility', 'Advanced local procedure call: fast message passing between processes on the same computer. It carries requests from clients to servers such as subsystems and services.', 'Step 5 animates a client/server exchange over ALPC.'],  // manager tile: the ALPC facility, which passes messages between processes on one computer
        ];  // closes the TILES list
        TILES.forEach(([id, a, b, name, job, eg], k) => { P[id] = { r: [22 + (k % 5) * 97, 256 + Math.floor(k / 5) * 48, 88, 42], c: 's-os', t: [a, b], sub: [], mode: 'kernel', name, job, eg, tile: true }; });  // turns each tile into a map box inside the executive: five per row, two rows, tagged tile: true
        // phones: a tall, narrow version of the same map so every label stays readable
        if (ctx.narrow) {  // on a phone-width screen the map is rebuilt as a tall single column so every label stays readable
          const NR = { sys: [8, 28, 168, 72], svc: [184, 28, 168, 72], env: [8, 108, 168, 72], apps: [184, 108, 168, 72], dlls: [8, 188, 344, 44], exec: [8, 278, 344, 262],  // NR: new [x, y, width, height] for each large box in the phone layout, stacked top to bottom
            win: [8, 548, 344, 48], kern: [8, 604, 344, 46], hal: [8, 658, 344, 46], drv: [8, 712, 344, 50], hw: [8, 780, 344, 58] };  // more phone positions: windowing, kernel, HAL, drivers and hardware each get a full-width row
          Object.entries(NR).forEach(([id, r]) => { P[id].r = r; });  // copies each phone position into the matching box of P
          TILES.forEach(([id], k) => { P[id].r = [18 + (k % 2) * 166, 314 + Math.floor(k / 2) * 45, 158, 40]; });  // places the ten manager tiles two per row inside the tall executive box
          Object.assign(P.dlls, { t: ['Subsystem DLLs + ntdll.dll'], sub: ['turn API calls into native system calls'] });  // shortens the DLL box labels so they fit the slimmer phone map
          Object.assign(P.win, { t: ['Windowing and graphics'], sub: ['windows, menus, text, images'] });  // puts the windowing and graphics label on one line for the phone map
          Object.assign(P.drv, { sub: ['disk, network, USB, file systems…'] });  // puts the driver examples on one line for the phone map
          Object.assign(P.hw, { t: ['Hardware'], sub: ['processors · memory · interrupt controller', 'timers · buses · devices'] });  // splits the long hardware label into a title and two short lines for the phone map
        }  // ends the phone-only layout changes
        const L = ctx.narrow ? { W: 360, H: 846, user: [2, 2, 356, 236], uy: 19, line: 244, kern: [2, 250, 356, 522], ky: 268 }  // L: overall layout of the map; the phone version is taller, with its own user and kernel areas
          : { W: 680, H: 500, user: [4, 4, 672, 188], uy: 21, line: 196, kern: [4, 200, 672, 262], ky: 218 };  // L for wider screens: drawing size, the user-mode area, its label height, the dashed line and the kernel area
        const ORDER = ['sys', 'svc', 'env', 'apps', 'dlls', 'exec', ...TILES.map((t) => t[0]), 'win', 'kern', 'hal', 'drv', 'hw'];  // ORDER: the order in which boxes are drawn, so tiles are drawn after (on top of) the executive box
        const F = [  // F: the ten frames of the "Follow a request" animation for opening a file
          { sel: ['apps'], at: 'apps', m: 'user', cap: '<b>The application asks.</b> A text editor wants to open <code>notes.txt</code>, so it calls <code>CreateFile</code>, a function of the <span class="t">Win32 API</span>. We are in user mode, inside the editor\'s own process.' },  // frame 1: the editor calls CreateFile in user mode (sel = boxes to highlight, at = where the badge goes)
          { sel: ['dlls'], at: 'dlls', m: 'user', cap: '<b>The subsystem DLL translates.</b> CreateFile lives in a Win32 DLL loaded into the editor. It checks the arguments and calls the native service <code>NtCreateFile</code> in ntdll.dll, the last stop in user mode.' },  // frame 2: the Win32 DLL checks the call and passes it to NtCreateFile in ntdll.dll
          { sel: ['kern'], at: 'kern', m: 'kernel', line: true, cap: '<b>System call.</b> ntdll executes a special instruction that switches the processor into kernel mode. The kernel\'s trap handler looks up the service number and calls the executive routine for NtCreateFile. A program has no other way in.' },  // frame 3: the system call crosses into kernel mode (line: true lights up the dashed boundary)
          { sel: ['io', 'obj'], at: 'obj', m: 'kernel', cap: '<b>Find the name.</b> The I/O manager takes charge and asks the object manager to look up the path. The object manager follows the name to drive C:, whose files are managed by a file system driver.' },  // frame 4: the I/O manager asks the object manager to look up the file's name
          { sel: ['io', 'drv'], at: 'io', m: 'kernel', cap: '<b>Package the request.</b> The I/O manager creates a file object for this open and packs the request into an <b>I/O request packet (IRP)</b>, which it hands to the file system driver.' },  // frame 5: the I/O manager builds an I/O request packet and hands it to the file system driver
          { sel: ['drv', 'hal'], at: 'hal', m: 'kernel', cap: '<b>Read the disk, through the HAL.</b> The file system driver needs the file\'s directory entry and its <span class="t">security descriptor</span>. If they are not already in memory, it passes a read to the disk driver, which programs the disk controller and calls HAL routines for platform-specific work such as setting up DMA.' },  // frame 6: the drivers read the disk if needed, using HAL routines for platform work such as DMA
          { sel: ['hw'], at: 'hw', m: 'hardware', cap: '<b>The hardware works.</b> The disk controller copies the data into memory by DMA while the processors run other threads (the editor\'s thread waits). When it finishes, it raises an <span class="t">interrupt</span>.' },  // frame 7: the disk controller copies the data by DMA and raises an interrupt when it is done
          { sel: ['kern', 'drv'], at: 'kern', m: 'kernel', cap: '<b>Interrupt handled.</b> The kernel runs the disk driver\'s interrupt routine, which does the urgent part and queues a deferred procedure call to finish the rest. The read completes, and the kernel makes the editor\'s waiting thread ready to run again.' },  // frame 8: the kernel runs the driver's interrupt routine and wakes the editor's waiting thread
          { sel: ['drv', 'srm'], at: 'srm', m: 'kernel', cap: '<b>Check permission.</b> The file system driver asks the security reference monitor to compare the user\'s identity with the file\'s security descriptor. Reading is allowed, so the open goes ahead; otherwise it would fail right here with "access denied".' },  // frame 9: the security reference monitor checks that this user may read the file
          { sel: ['obj', 'apps'], at: 'apps', m: 'user', line: true, cap: '<b>A handle comes back.</b> The object manager puts a <span class="t">handle</span> to the new file object in the editor\'s handle table, along with the access just granted. The call returns to user mode and CreateFile gives the editor the handle.' },  // frame 10: a handle goes into the editor's handle table and the call returns to user mode
        ];  // closes the F list of frames
        let mode = 'explore', selId = null, frame = 0;  // mode is "explore" or "follow"; selId is the box clicked in explore mode; frame is the animation step shown
        const svg = s('svg', { viewBox: `0 0 ${L.W} ${L.H}`, width: '100%' });  // creates the SVG drawing for the map, sized to the chosen layout
        function labels(p) {  // labels(p): builds the centered text lines (title lines, then grey sub-lines) for one map box
          const [x, y, w, hh] = p.r, cx = x + w / 2, cy = y + hh / 2;  // unpacks the box's position and size and finds its center point
          const lh1 = p.tile ? 15 : 17, lh2 = 16;  // line heights: tighter title lines on the small manager tiles, 16 units for the grey sub-lines
          let yy = cy - (p.t.length * lh1 + p.sub.length * lh2) / 2 + (p.tile ? 11 : 12);  // yy is the first line's height, chosen so the whole block of lines sits in the middle of the box
          const out = [];  // out collects the text elements for this box
          p.t.forEach((t) => { out.push(s('text', { x: cx, y: yy, 'text-anchor': 'middle', 'font-size': p.tile ? 13 : 14.5, 'font-weight': p.tile ? 700 : 800 }, t)); yy += lh1; });  // adds each title line, bold and centered, moving down one line each time
          p.sub.forEach((t) => { out.push(s('text', { x: cx, y: yy + 1, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, t)); yy += lh2; });  // adds each grey sub-line underneath, in smaller text
          return out;  // gives the finished lines back to draw()
        }  // ends labels()
        function draw() {  // draw(): rebuilds the whole map; runs on every click, mode change and animation step
          const f = F[frame];  // f is the animation frame currently shown
          const selSet = new Set(mode === 'explore' ? (selId ? [selId] : []) : f.sel);  // selSet: the boxes to highlight, either the one clicked (explore) or the frame's boxes (follow)
          const lineOn = mode === 'follow' && f.line;  // lineOn is true when this frame crosses the user/kernel boundary, so the dashed line lights up
          const [ux, uy, uw, uh] = L.user, [kx, ky, kw, kh] = L.kern;  // unpacks the positions and sizes of the user-mode and kernel-mode background areas
          const kids = [  // kids collects the background shapes first; the boxes are added after them
            s('rect', { x: ux, y: uy, width: uw, height: uh, rx: 14, style: 'fill:var(--panel-2);stroke:var(--line)' }),  // the grey user-mode background area
            s('text', { x: ux + 12, y: L.uy, 'font-size': 13, 'font-weight': 800, 'letter-spacing': 1.5, class: 's-sub' }, 'USER MODE'),  // the "USER MODE" label in its top-left corner
            s('rect', { x: kx, y: ky, width: kw, height: kh, rx: 14, style: 'fill:color-mix(in srgb, var(--os) 7%, var(--panel));stroke:color-mix(in srgb, var(--os) 40%, transparent)' }),  // the purple-tinted kernel-mode background area
            s('text', { x: kx + 12, y: L.ky, 'font-size': 13, 'font-weight': 800, 'letter-spacing': 1.5, style: 'fill:var(--os)' }, 'KERNEL MODE'),  // the "KERNEL MODE" label in purple
            s('text', { x: kx + kw - 8, y: L.ky - 2, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'system calls cross the dashed line'),  // a small note at the right: system calls are the only way across the dashed line
            s('line', { x1: ux, y1: L.line, x2: ux + uw, y2: L.line, 'stroke-dasharray': '9 6', 'stroke-width': lineOn ? 4 : 2, style: lineOn ? 'stroke:var(--accent)' : 'stroke:var(--ink-2)' }),  // the dashed user/kernel boundary, drawn thicker and in the accent color when a frame crosses it
          ];  // closes the background shape list
          for (const id of ORDER) {  // goes through every box in drawing order
            const p = P[id], [x, y, w, hh] = p.r;  // p is the box's data; x, y, w and hh are its position and size
            const g = s('g', { class: 'hot' + (selSet.has(id) ? ' sel' : ''), role: 'button', tabindex: 0, 'aria-label': p.name, onclick: () => pick(id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); } } },  // a group acting as a button for this box: click it or press Enter or Space to pick it
              s('rect', { class: 'fr ' + p.c, x, y, width: w, height: hh, rx: p.tile ? 8 : 10, 'stroke-width': 2 }), ...labels(p));  // the box's outline rectangle with its color class, followed by its label lines
            if (id === 'exec') g.append(s('text', { x: x + 12, y: y + 20, 'font-size': 15, 'font-weight': 800 }, 'Executive'), s('text', { x: x + w - 12, y: y + 20, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'ten managers, one job each'));  // the executive box gets its own title at the top left and a note at the top right
            kids.push(g);  // adds the finished box to the drawing list
          }  // ends the loop over boxes
          if (mode === 'follow') {  // in follow mode, numbered badges mark every hop the request has made so far
            const seen = {};  // seen counts how many badges each box already has, so repeat visits do not sit on top of each other
            F.slice(0, frame + 1).forEach((fr, k) => {  // goes through every frame up to the current one; k is the frame index
              const [x, y, w] = P[fr.at].r, n = (seen[fr.at] = (seen[fr.at] || 0) + 1);  // x, y and w of the box this hop lands on; n is how many times that box has been visited so far
              const tile = P[fr.at].tile, bx = (tile ? x + w : x + w - 12) - (n - 1) * 26, by = tile ? y + 4 : y + 12, on = k === frame;  // badge position: near the box's top-right corner, shifted left for each repeat visit; on marks the current hop
              kids.push(s('g', { style: 'pointer-events:none' },  // a badge group that ignores clicks, so the box underneath can still be picked
                s('circle', { cx: bx, cy: by, r: 12, class: on ? '' : 's-panel', style: on ? 'fill:var(--accent);stroke:var(--accent)' : '', 'stroke-width': 2 }),  // the badge circle: filled with the accent color for the current hop, plain for earlier hops
                s('text', { x: bx, y: by + 4.5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: on ? 'fill:var(--accent-ink)' : '' }, String(k + 1))));  // the hop number (1-10) written in the middle of the badge
            });  // ends the loop over hops
          }  // ends the follow-mode badges
          svg.classList.toggle('dim-others', selSet.size > 0);  // when something is highlighted, the SVG gets the dim-others class so every other box fades
          svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes in one go
        }  // ends draw()
        const info = h('div', { class: 'card white info grow' });  // info: the explanation card beside the map in explore mode
        const INTRO = '<h3>How to read the map</h3><p>The <b>top half</b> is user mode: ordinary processes, each in its own protected memory. The <b>bottom half</b> is kernel mode: the parts of Windows that run with full hardware privileges and share one address space.</p><p>A program crosses the dashed line only through a <b>system call</b>: a controlled request that switches the processor into kernel mode. Colours follow the guide\'s language: <span class="chip proc">processes</span> <span class="chip os">OS / kernel</span> <span class="chip io">drivers and devices</span>.</p><div class="eg"><b>Try it: </b>click any box on the map, including each of the ten executive managers. Then switch to <b>Follow a request</b>.</div>';  // INTRO: the card's starting text, explaining user mode, kernel mode, system calls and the color code
        function showInfo() {  // showInfo(): fills the card for the box that is selected, or shows the intro when nothing is
          if (!selId) { info.innerHTML = INTRO; return; }  // with nothing selected, the intro text is shown instead
          const p = P[selId];  // p is the selected box's data
          const chip = p.mode === 'user' ? '<span class="chip proc">user mode</span>' : p.mode === 'kernel' ? '<span class="chip os">kernel mode</span>' : '<span class="chip">hardware</span>';  // chip: a colored tag saying whether the box runs in user mode, kernel mode or is hardware
          info.innerHTML = `<div class="row gap-s">${chip}${p.tile ? '<span class="chip os">executive manager</span>' : ''}</div><h3>${p.name}</h3><p>${p.job}</p><div class="eg"><b>Example: </b>${p.eg}</div>`;  // writes the chips, the box name, its job and an example into the card
        }  // ends showInfo()
        const MODECHIP = { user: '<span class="chip proc">user mode</span>', kernel: '<span class="chip os">kernel mode</span>', hardware: '<span class="chip io">hardware</span>' };  // MODECHIP: the colored tag placed at the start of each follow-mode caption (user, kernel or hardware)
        const player = ctx.ui.player({ count: F.length, interval: 3200, captionBelow: true, speed: false,  // the guide's step player for the ten hops: one frame every 3.2 seconds, caption under the buttons, no speed choice
          render: (i) => { frame = i; if (mode === 'follow') draw(); return MODECHIP[F[i].m] + ' ' + F[i].cap; } });  // runs for each frame: stores its number, redraws the map in follow mode, and returns the caption text
        player.caption.style.minHeight = '150px';  // gives the caption box a fixed minimum height so the buttons do not jump as captions change length
        const follow = h('div', { class: 'stack grow', style: { display: 'none' } },  // follow: the panel shown instead of the info card in follow mode, hidden at first
          h('p', { class: 'small m0', html: 'An editor opens <code>notes.txt</code>. Step through the ten hops; numbered badges mark the path on the map.' }),  // a one-line introduction: the editor opens notes.txt in ten hops marked by numbered badges
          player.el,  // the step player's buttons and caption
          h('div', { class: 'callout why m0', 'data-label': 'Why so many hops?', html: 'Each part does one job and knows nothing about the others\' insides. Microsoft can replace a driver, port the HAL or add a subsystem without rewriting the rest.' }));  // "Why so many hops?" note: each part does one job, so parts can be replaced without rewriting the rest
        function setMode(m) {  // setMode(m): switches between explore and follow; runs when the student uses the switch or clicks a box
          mode = m; seg.set(m);  // stores the mode and makes the switch show it
          info.style.display = m === 'explore' ? '' : 'none';  // shows the info card only in explore mode
          follow.style.display = m === 'follow' ? '' : 'none';  // shows the follow panel only in follow mode
          if (m === 'follow') player.stop();  // entering follow mode stops any animation that was still playing
          draw(); ctx.refit();  // redraws the map, then asks the guide to re-check that the step still fits on the screen
        }  // ends setMode()
        function pick(id) { selId = selId === id && mode === 'explore' ? null : id; if (mode !== 'explore') setMode('explore'); showInfo(); draw(); }  // pick(id): clicking a box selects it, or clears it if it was already selected; it also returns to explore mode
        const seg = ctx.ui.seg([{ value: 'explore', label: 'Explore the parts' }, { value: 'follow', label: 'Follow a request' }], 'explore', setMode);  // seg: the two-button switch "Explore the parts" / "Follow a request"; it calls setMode when clicked
        el.append(h('div', { class: 'split r fill', style: { gridTemplateColumns: 'minmax(0, 680px) minmax(0, 1fr)' } },  // puts the step on screen: map on the left (up to 680 wide), the controls on the right
          h('div', { class: 'card tight', style: { display: 'grid', placeItems: 'center', padding: '6px' } }, svg),  // the map inside a card, centered
          h('div', { class: 'stack' }, seg, info, follow)));  // the right column: the mode switch, the info card and the follow panel
        showInfo(); draw();  // fills the info card with the intro and draws the map for the first time
      },  // ends render() for step 2
    },  // ends step 2

    /* ---------------- 3. Inside the executive: route each request to the right manager ---------------- */
    {  // step 3 starts here
      title: 'Inside the executive: who handles this request?',  // step title shown as the heading of step 3
      kind: 'lab',  // kind "lab" marks this step as a hands-on exercise
      render(el, ctx) {  // render(el, ctx): builds the manager-routing game when step 3 opens
        const { h } = ctx;  // takes the helper h, which makes HTML elements
        const M = [  // M: the ten executive managers as [id, name, one-line job]
          ['io', 'I/O manager', 'routes every I/O request down to the right drivers'],  // manager: the I/O manager
          ['cache', 'Cache manager', 'keeps recently used file data in main memory'],  // manager: the cache manager
          ['obj', 'Object manager', 'creates, names, tracks and deletes objects'],  // manager: the object manager
          ['pnp', 'Plug-and-play manager', 'spots new or removed devices, loads drivers'],  // manager: the plug-and-play manager
          ['pwr', 'Power manager', 'moves the system and devices between power states'],  // manager: the power manager
          ['srm', 'Security reference monitor', 'checks who may do what to an object'],  // manager: the security reference monitor
          ['vm', 'Virtual memory manager', 'maps virtual addresses, moves pages to and from disk'],  // manager: the virtual memory manager
          ['pt', 'Process/thread manager', 'creates, tracks and deletes processes and threads'],  // manager: the process/thread manager
          ['cfg', 'Configuration manager', 'implements and manages the registry'],  // manager: the configuration manager
          ['alpc', 'ALPC facility', 'passes messages between processes on one computer'],  // manager: the ALPC facility
        ];  // closes the M list
        const NAME = Object.fromEntries(M.map((m) => [m[0], m[1]]));  // NAME looks up a manager's full name from its id
        const JOB = Object.fromEntries(M.map((m) => [m[0], m[2]]));  // JOB looks up a manager's one-line job from its id
        const Q = [  // Q: the ten requests to route, as [right manager id, request text, explanation shown when solved]
          ['pnp', 'You plug a USB drive into a laptop. Something must notice the new device, work out which driver it needs and load that driver.', 'Detecting hardware that is added or removed, and loading the right driver for it, is the plug-and-play manager\'s job.'],  // request: a new USB drive needs a driver; answer is the plug-and-play manager
          ['srm', 'A program tries to open <code>salaries.xlsx</code> for writing. Is this user allowed to change that file?', 'The security reference monitor compares the user\'s identity with the file\'s security descriptor, then allows or denies the access.'],  // request: may this user write to a salary spreadsheet; answer is the security reference monitor
          ['vm', 'A program touches an address whose page was moved out to disk. The page must come back into RAM and the address mapping must be fixed.', 'Mapping virtual addresses onto physical memory, and moving pages between memory and disk, is the virtual memory manager\'s work.'],  // request: a page on disk must come back into memory; answer is the virtual memory manager
          ['cache', 'You open a large file, close it, and open it again. The second time it appears instantly because its data is still in main memory.', 'The cache manager keeps recently used file data in RAM on behalf of every file system, so the repeat read skips the disk.'],  // request: a reopened file appears instantly; answer is the cache manager
          ['pwr', 'You close the laptop lid. The screen, disk and Wi-Fi must enter low-power states in the right order, and wake up again later.', 'Moving the whole system and its devices between power states is the power manager\'s job.'],  // request: closing the lid puts devices to sleep; answer is the power manager
          ['pt', 'A game starts a second thread to load music in the background while you keep playing.', 'Creating, tracking and deleting processes and threads is the process/thread manager\'s job. The kernel then schedules the new thread onto a processor.'],  // request: a game starts a second thread; answer is the process/thread manager
          ['cfg', 'During start-up, Windows looks up which drivers to load and reads your saved settings from the registry.', 'The configuration manager implements the registry, the system-wide database of settings.'],  // request: reading settings from the registry at start-up; answer is the configuration manager
          ['alpc', 'An application must send a request message to the Win32 subsystem\'s server process and wait for the reply.', 'Fast message passing between processes on the same computer is what the ALPC facility provides. It carries Windows\' client/server traffic.'],  // request: a message to the Win32 subsystem and back; answer is the ALPC facility
          ['obj', 'Every file, event, process and thread the OS creates must be named or given a handle, tracked, and deleted once nobody uses it.', 'The object manager is the single place that creates, names, tracks and deletes all Windows objects.'],  // request: every object must be named, tracked and deleted; answer is the object manager
          ['io', 'A program writes to a file. The request has to be packaged and passed to the file system driver, then on to the disk driver.', 'The I/O manager packs each request into an I/O request packet (IRP) and passes it through the right drivers.'],  // request: a file write must be passed down to the drivers; answer is the I/O manager
        ];  // closes the Q list
        let order = Q.map((_, i) => i), k = 0, tries = 0, solved = false;  // order: the order requests are asked in; k: which one is shown now; tries: picks on it so far; solved: done yet
        const res = [];  // res records each request's result: "ok" for right first time, "warn" for right after a miss
        const count = h('h4', { class: 'm0' });  // count: the heading that says which request this is, e.g. "Request 3 of 10"
        const score = h('span', { class: 'chip ok' });  // score: a green chip counting first-try successes
        const dots = h('div', { class: 'row gap-s' });  // dots: the row of progress pills, one per request
        const scen = h('div', { class: 'scen' });  // scen: the box that shows the incoming request
        const fb = h('div', { class: 'fb' });  // fb: the feedback area under the request
        const nextB = h('button', { class: 'btn primary', onclick: () => { k++; tries = 0; solved = false; paint(); } }, 'Next request ▶');  // "Next request" button: moves to the next request and clears the tries; enabled only once solved
        const againB = h('button', { class: 'btn', onclick: () => { order = ctx.util.shuffle(Q.map((_, i) => i)); k = 0; tries = 0; solved = false; res.length = 0; paint(); } }, 'Start over (shuffled)');  // "Start over" button: shuffles the requests into a new order and resets every result
        const tiles = M.map(([id, name, job]) => h('button', { class: 'mgr', type: 'button', 'data-id': id, onclick: () => answer(id) }, h('b', {}, name), h('span', {}, job)));  // tiles: one button per manager; clicking it answers the current request with that manager
        function answer(id) {  // answer(id): checks the student's pick; runs when a manager button is clicked
          if (solved || k >= Q.length) return;  // ignores clicks once this request is solved or when every request is done
          const q = Q[order[k]];  // q is the current request
          const t = tiles.find((b) => b.dataset.id === id);  // t is the button that was clicked
          tries++;  // counts this pick
          if (id === q[0]) {  // the pick is the right manager
            solved = true; res[k] = tries === 1 ? 'ok' : 'warn';  // marks the request solved and records whether it took one try or more
            t.classList.add('ok');  // turns the clicked button green
            fb.innerHTML = `<div class="callout tip m0" data-label="${tries === 1 ? 'Right, first try' : 'Right'}">${q[2]}</div>`;  // shows the explanation in a green note, labelled "Right, first try" or just "Right"
          } else {  // the pick is wrong
            t.classList.add('bad');  // turns the clicked button red
            const nm = NAME[id].replace(/^([A-Z])(?=[a-z])/, (c) => c.toLowerCase()); // "Security reference monitor" → "security reference monitor"; keeps I/O and ALPC
            fb.innerHTML = `<div class="callout warn m0" data-label="Not that one">The ${nm} ${JOB[id]}. That is not what this request needs. Read the request again: what is the <i>core</i> job being asked for?</div>`;  // explains what the picked manager really does and asks the student to think about the core job again
          }  // ends the right/wrong branches
          paintTop();  // updates the heading, score, pills and Next button
        }  // ends answer()
        function paintTop() {  // paintTop(): refreshes everything above the request box; runs after every pick and every new request
          const firstTry = res.filter((r) => r === 'ok').length;  // counts how many requests were answered right on the first try
          count.textContent = k < Q.length ? `Request ${k + 1} of ${Q.length}` : 'All requests routed';  // heading: "Request 3 of 10" while playing, "All requests routed" at the end
          score.textContent = `${firstTry} right on the first try`;  // updates the green chip with the number of first-try successes
          dots.replaceChildren(...Q.map((_, i) => h('span', { class: 'dot ' + (res[i] || (i === k ? 'cur' : '')) })));  // rebuilds the pills: green or amber for finished requests, chapter color for the current one, grey otherwise
          nextB.disabled = !solved;  // the Next button works only after the current request is solved
          nextB.style.display = k < Q.length ? '' : 'none';  // hides the Next button once every request is done
        }  // ends paintTop()
        function paint() {  // paint(): shows the current request (or the final summary); runs at the start and after Next or Start over
          tiles.forEach((b) => b.classList.remove('ok', 'bad'));  // clears the green and red marks left on the manager buttons by the previous request
          if (k >= Q.length) {  // every request is done: show the summary instead of a new request
            const firstTry = res.filter((r) => r === 'ok').length;  // counts the first-try successes for the summary
            scen.innerHTML = `<div class="xs b muted">SUMMARY</div><div>You routed all ${Q.length} requests, <b>${firstTry}</b> of them on the first try.</div>`;  // summary box: how many requests were routed, and how many of them on the first try
            fb.innerHTML = `<div class="callout why m0" data-label="Why it matters">${firstTry === Q.length ? 'A perfect run. ' : ''}Ten managers, one job each: a change to how caching works touches only the cache manager, and every other manager keeps working unchanged. That is what "modular" buys Windows.</div>`;  // "Why it matters" note: one job per manager keeps changes local; that is what modular means
          } else {  // there are still requests left
            scen.innerHTML = `<div class="xs b muted">INCOMING REQUEST</div><div>${Q[order[k]][1]}</div>`;  // shows the current request's text under an "INCOMING REQUEST" label
            fb.innerHTML = '<div class="callout m0" data-label="How to play">Click the manager that should handle this request. First ask what the request is really about: a device, memory, file data, permission, power, a setting, a message? Wrong picks explain what that manager really does.</div>';  // "How to play" note: click the manager that should handle it, and think about what the request is really about
          }  // ends the summary/request branches
          paintTop();  // refreshes the heading, score, pills and Next button
        }  // ends paint()
        el.append(h('div', { class: 'split l fill' },  // puts the game on screen: game card on the left, the ten manager buttons on the right
          h('div', { class: 'stack' },  // the left column
            h('p', { class: 'm0', html: 'The <span class="t">executive</span> is organised as ten managers, and each owns exactly one job. Route every request to the manager that handles it.' }),  // instructions: the executive has ten managers, route every request to the right one
            h('div', { class: 'card white stack', style: { gap: '10px', flex: '1' } },  // the game card, which stretches to fill the column
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, count, score), dots, scen, fb,  // card contents: heading and score on one line, then the pills, the request and the feedback
              h('div', { class: 'row', style: { marginTop: 'auto' } }, nextB, againB))),  // the Next and Start over buttons, pushed to the bottom of the card
          h('div', { class: 'mgrs' }, ...tiles)));  // the right column: the grid of manager buttons
        paint();  // shows the first request as soon as the step opens
      },  // ends render() for step 3
    },  // ends step 3

    /* ---------------- 4. Kernel + HAL: swap the platform, only the HAL changes ---------------- */
    {  // step 4 starts here
      title: 'The kernel and the HAL: swap the hardware underneath',  // step title shown as the heading of step 4
      kind: 'explore',  // kind "explore" marks this step as one to click around in
      render(el, ctx) {  // render(el, ctx): builds the platform-swapping lab when step 4 opens
        const { h, s } = ctx;  // takes the helpers h (HTML elements) and s (SVG drawing elements)
        // same: what happens to the executive, drivers and kernel on this platform, compared with the desktop PC
        const SAME = { exec: ['unchanged ✓', 'ok'], drv: ['unchanged ✓', 'ok'], kern: ['unchanged ✓', 'ok'] };  // SAME: the desktop and server case, where the executive, drivers and kernel all stay unchanged (green)
        const PLAT = {  // PLAT: the three platforms the student can choose between
          pc: { name: 'Desktop PC', hal: 'HAL · x86-64 version', hw: 'x86-64 cores · APIC (interrupt controller) · HPET (timer chip) · PCI Express bus', same: SAME,  // platform "pc": a desktop PC; hal names its HAL version, hw lists its hardware, same says what else changes
            foot: '<b>Only the HAL speaks this machine\'s wiring.</b> Pick another platform: the generic request never changes, only the HAL\'s answer does.' },  // note under the lab for the PC: only the HAL speaks this machine's wiring
          arm: { name: 'ARM tablet', hal: 'HAL · ARM64 version', hw: 'ARM64 cores · GIC (interrupt controller) · ARM generic timer · on-chip buses', same: { exec: ['recompiled', 'thread'], drv: ['recompiled', 'thread'], kern: ['recompiled + small ARM-only part', 'thread'] },  // platform "arm": an ARM tablet, where the upper layers are recompiled and the kernel gains a small ARM part
            foot: '<b>A new processor family:</b> everything is recompiled from the same C source and the kernel gains a small ARM-only part, but only the HAL is written for this platform\'s wiring.' },  // note under the lab for ARM: new processor family, same C source, but only the HAL knows the wiring
          srv: { name: 'Many-socket server', hal: 'HAL · x86-64, in x2APIC mode', hw: '128 cores on 4 chips · x2APIC (interrupt controllers) · many PCI Express buses', same: SAME,  // platform "srv": a large server with 128 cores; same processor family as the PC, so nothing else changes
            foot: '<b>Same processor family as the PC:</b> the executive, drivers and kernel are identical. The x86-64 HAL simply takes different paths for this bigger machine\'s wiring.' },  // note under the lab for the server: same executive, drivers and kernel, the HAL takes different paths
        };  // closes the PLAT table
        const REQ = {  // REQ: the four generic hardware requests, each with what the HAL does on each platform
          ack: { label: 'Acknowledge interrupt', from: 'kern',  // request "ack": acknowledge an interrupt; from says which layer sends it (here the kernel)
            pc: 'Write an "end of interrupt" command into this core\'s local APIC, the PC\'s interrupt controller.',  // what the PC's HAL does: sends "end of interrupt" to this core's local APIC
            arm: 'Write an "end of interrupt" command into the GIC, the ARM interrupt controller, through its per-core registers.',  // what the ARM HAL does: sends "end of interrupt" to the GIC interrupt controller
            srv: 'Write "end of interrupt" to the local APIC running in x2APIC mode, where it is reached through a special processor register instead of a memory address.' },  // what the server's HAL does: sends "end of interrupt" to the x2APIC through a processor register
          timer: { label: 'Set a 1 ms timer', from: 'kern',  // request "timer": set a 1 ms timer, sent by the kernel
            pc: 'Load the local APIC timer (or the HPET chip) with the count that equals 1 ms on this machine.',  // what the PC's HAL does: loads the APIC timer or the HPET chip with the right count
            arm: 'Load the ARM generic timer\'s compare register with "now + 1 ms".',  // what the ARM HAL does: loads the ARM generic timer's compare register
            srv: 'Load the local APIC timer of the chosen core; every one of the 128 cores has its own.' },  // what the server's HAL does: loads the timer of the chosen core, one of 128
          ipi: { label: 'Interrupt core 3', from: 'kern',  // request "ipi": interrupt another core (core 3), sent by the kernel
            pc: 'Write to the local APIC\'s interrupt command register, naming core 3 as the target.',  // what the PC's HAL does: writes to the APIC's interrupt command register
            arm: 'Write a software-generated interrupt into the GIC, naming core 3 as the target.',  // what the ARM HAL does: writes a software-generated interrupt into the GIC
            srv: 'Write to the x2APIC interrupt command register; core 3 may sit on a different processor chip.' },  // what the server's HAL does: writes to the x2APIC command register; the target may be on another chip
          dma: { label: 'Set up DMA', from: 'drv',  // request "dma": set up a direct memory access transfer, sent by a device driver
            pc: 'Turn the buffer\'s memory addresses into addresses the disk controller can use on the PCI Express bus, and give them to the device.',  // what the PC's HAL does: turns buffer addresses into addresses the device can use on the PCI Express bus
            arm: 'Turn the buffer\'s addresses into ones an on-chip device can use, through the chip\'s own address-translation unit.',  // what the ARM HAL does: translates the addresses through the chip's own address-translation unit
            srv: 'Translate the buffer\'s addresses for a device on one of many PCI Express buses, attached to one particular processor chip.' },  // what the server's HAL does: translates addresses for a device on one of many buses
        };  // closes the REQ table
        let plat = 'pc', req = 'ack';  // plat and req hold the chosen platform and request; the lab starts with the PC and "acknowledge interrupt"
        const svg = ctx.narrow ? h('div', { class: 'stack', style: { gap: '6px' } }) : s('svg', { viewBox: '0 0 640 214', width: '100%', style: 'flex:none' });  // the layer diagram: plain HTML boxes on a phone-width screen, an SVG drawing otherwise
        const out = h('div', { class: 'xlate', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0, 1fr)' } : {} });  // out: the translation row (generic request → what the HAL does); one column on a phone
        function row(id, x, y, w, hh, cls, label, chip, chipCol, sel) {  // row(...): draws one labelled layer bar for the SVG, with an optional colored status note at its right end
          return s('g', {},  // returns a group of shapes for this layer
            s('rect', { x, y, width: w, height: hh, rx: 10, class: cls, 'stroke-width': sel ? 4 : 2, style: sel ? 'stroke:var(--accent)' : '' }),  // the bar itself; the layer that sends the request gets a thick accent-colored outline
            s('text', { x: x + 14, y: y + hh / 2 + 5, 'font-size': 15, 'font-weight': 800 }, label),  // the layer name on the left of the bar
            chip ? s('text', { x: x + w - 12, y: y + hh / 2 + 5, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 700, style: 'fill:var(--' + chipCol + ')' }, chip) : null);  // the status note on the right (e.g. "unchanged"), in the color named by chipCol
        }  // ends row()
        function draw(flash) {  // draw(flash): redraws the lab for the chosen platform and request; flash makes the answer blink once
          const P = PLAT[plat], r = REQ[req], S = P.same;  // P is the chosen platform, r the chosen request, S the platform's list of what changes
          const kids = [  // kids: the shapes of the SVG diagram
            row('exec', 0, 4, 270, 40, 's-os', 'Executive', S.exec[0], S.exec[1], false),  // executive bar with its status for this platform
            row('drv', 280, 4, 280, 40, 's-io', 'Device drivers', S.drv[0], S.drv[1], r.from === 'drv'),  // device drivers bar, highlighted when the request comes from a driver
            row('kern', 0, 54, 560, 40, 's-os', 'Kernel', S.kern[0], S.kern[1], r.from === 'kern'),  // kernel bar, highlighted when the request comes from the kernel
            row('hal', 0, 104, 560, 44, 's-warn', P.hal, 'platform-specific', 'warn', true),  // HAL bar, always highlighted and always marked "platform-specific"
            s('rect', { x: 0, y: 158, width: 560, height: 52, rx: 10, class: 's-panel', 'stroke-width': 4, style: 'stroke:var(--accent)' }),  // the hardware box at the bottom, outlined in the accent color
            s('text', { x: 14, y: 180, 'font-size': 15, 'font-weight': 800 }, 'Hardware: ' + P.name),  // the hardware box's title with the platform name
            s('text', { x: 14, y: 200, 'font-size': 13.5, class: 's-sub' }, P.hw),  // the platform's hardware list in small grey text
            s('line', { x1: 600, y1: r.from === 'drv' ? 24 : 74, x2: 600, y2: 154, style: 'stroke:var(--accent)', 'stroke-width': 3, 'marker-end': 'url(#arr-accent)' }),  // the arrow down the right side, from the sending layer to the hardware
            s('text', { x: 616, y: 120, 'font-size': 13, 'font-weight': 700, transform: 'rotate(90 616 120)', 'text-anchor': 'middle', style: 'fill:var(--accent)' }, 'generic → specific'),  // a sideways label on the arrow: "generic → specific"
          ];  // closes the shape list
          if (ctx.narrow) {  // on a phone the diagram is made of HTML boxes instead of SVG
            const lay = (cls, name, chip, col, on) => h('div', { class: 'box ' + cls, style: { textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', borderColor: on ? 'var(--accent)' : '' } }, h('span', {}, name), h('span', { class: 'small', style: { color: 'var(--' + col + ')' } }, chip));  // lay(...): makes one layer box with its name on the left and colored status text on the right
            svg.replaceChildren(lay('os', 'Executive', S.exec[0], S.exec[1], false), lay('io', 'Device drivers', S.drv[0], S.drv[1], r.from === 'drv'), lay('os', 'Kernel', S.kern[0], S.kern[1], r.from === 'kern'),  // fills the phone diagram with the executive, driver and kernel boxes
              lay('', P.hal, 'platform-specific', 'warn', true), h('div', { class: 'box', style: { textAlign: 'left', borderColor: 'var(--accent)' } }, h('div', {}, 'Hardware: ' + P.name), h('div', { class: 'small muted', style: { fontWeight: 400 } }, P.hw)));  // then the HAL box and the hardware box with its hardware list
          } else svg.replaceChildren(...kids);  // on wider screens the SVG shapes are put in place instead
          out.innerHTML = `<div class="box os"><div class="xs b muted">GENERIC REQUEST (same on every machine)</div>${r.label}</div><div class="arrow">→</div><div class="box io"><div class="xs b muted">ON THE ${P.name.toUpperCase()}, THE HAL…</div>${r[plat]}</div>`;  // fills the translation row: the generic request, an arrow, and what this platform's HAL does
          foot.innerHTML = P.foot;  // shows the platform's note under the lab
          if (flash) { out.classList.remove('flash'); void out.offsetWidth; out.classList.add('flash'); }  // on a new choice, restarts the flash animation (reading offsetWidth forces the browser to notice the reset)
          reqBtns.forEach((b) => b.classList.toggle('on', b.dataset.r === req));  // marks the chosen request's button as on
        }  // ends draw()
        const foot = h('p', { class: 'small m0' });  // foot: the note paragraph under the lab
        const reqBtns = Object.entries(REQ).map(([k, r]) => h('button', { class: 'btn sm', 'data-r': k, onclick: () => { req = k; draw(true); } }, r.label));  // reqBtns: one button per request; clicking one makes it the chosen request and redraws with a flash
        const seg = ctx.ui.seg(Object.entries(PLAT).map(([k, p]) => ({ value: k, label: p.name })), plat, (v) => { plat = v; draw(true); });  // seg: the platform switch (Desktop PC / ARM tablet / Many-socket server); a new pick redraws with a flash
        const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left: the left column of text about the kernel and HAL
          h('p', { class: 'lead m0', html: 'Below the executive sit the two layers closest to the hardware: the <span class="t">Windows kernel</span> and the <span class="t">HAL</span>.' }),  // opening paragraph: the kernel and the HAL are the two layers closest to the hardware
          h('div', { class: 'card os tight' },  // a purple card listing the kernel's jobs
            h('h4', {}, 'The kernel\'s four jobs'),  // card heading: the kernel's four jobs
            h('ol', { class: 'small m0', html: '<li><b>Thread scheduling:</b> picks which thread runs next on each processor.</li><li><b>Process switching:</b> saves one process\'s state and loads another\'s.</li><li><b>Exception and interrupt handling:</b> takes control when a device interrupts or an error occurs.</li><li><b>Multiprocessor synchronization:</b> stops processors from colliding on shared kernel data.</li>' })),  // numbered list: thread scheduling, process switching, exceptions and interrupts, multiprocessor synchronization
          h('p', { class: 'small m0', html: 'Almost everything else, user programs and most executive work alike, runs in <span class="t">threads</span>. The kernel\'s own code does not: it is the code that creates the threads\' turns on the processor.' }),  // paragraph: almost everything runs in threads, but the kernel's own code is what gives threads their turns
          h('div', { class: 'callout warn small m0', 'data-label': 'The fine print', html: 'The HAL hides the <b>platform wiring</b> around the processor (bus, DMA, interrupt controller, timers), not the processor itself. A new processor family such as ARM also means recompiling the C source and rewriting a few thin processor-specific parts of the kernel.' }));  // "The fine print" note: the HAL hides the platform wiring, not the processor, so ARM also needs recompiling
        const right = h('div', { class: 'card white stack', style: { gap: '10px' } },  // right: the lab card in the right column
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, '1 · Pick a platform'), seg),  // card header: "1 · Pick a platform" on the left, the platform switch on the right
          svg,  // the layer diagram (SVG, or HTML boxes on a phone)
          h('h4', { class: 'm0' }, '2 · Send a generic request down'),  // sub-heading for the request buttons
          h('div', { class: 'row gap-s' }, ...reqBtns),  // a row of the four request buttons
          out,  // the translation row: generic request → what the HAL does
          foot);  // the platform's note; closes the lab card
        el.append(h('div', { class: 'split l fill' }, left, right));  // puts both columns into the step, the left one smaller
        draw(false);  // draws the lab for the first time, without the flash
      },  // ends render() for step 4
    },  // ends step 4

    /* ---------------- 5. Client/server over ALPC: normal, crash, remote ---------------- */
    {  // step 5 starts here
      title: 'Clients and servers: requests travel as messages',  // step title shown as the heading of step 5
      kind: 'explore',  // kind "explore" marks this step as one to click around in
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the client/server animation when step 5 opens
        const { h, s } = ctx;  // takes the helpers h (HTML elements) and s (SVG drawing elements)
        const ADV = [  // ADV: the four advantages of the client/server design, as [title, explanation]; frames light one of them up
          ['Simplifies the executive', 'The executive only carries messages. APIs and services live in server processes, so new ones can be added without changing it.'],  // advantage 0: the executive only carries messages, so new services need no change to it
          ['Improves reliability', 'Each server is its own process with its own memory. A server that crashes is contained; the rest of the system keeps running.'],  // advantage 1: each server is its own process, so a crash stays inside it
          ['One uniform way to ask', 'Every service is reached the same way, by <span class="t">remote procedure call</span> (RPC). A small <b>stub</b> in the client packs each call into a message, so it looks like an ordinary function call.'],  // advantage 2: every service is reached the same way, by remote procedure call through a client stub
          ['Ready for distribution', 'A server can move to another computer on the network while its clients keep making exactly the same calls.'],  // advantage 3: a server can move to another computer without the clients changing
        ];  // closes the ADV list
        const base = [  // base: the first three frames, shared by the normal and crash stories
          { at: 'client', tok: 'request', cth: 'running', t1: 'waiting', path: null, adv: 2, cap: '<b>Build a request.</b> The word processor (the client) calls a print function. A small <b>stub</b> packs the call and its parameters into a message addressed to the spooler\'s <b>port</b>, a named mailbox where the server collects requests. The client never learns where the spooler\'s code or data live.' },  // frame 1: the client's stub packs a print call into a message for the spooler's port (at = where the token sits)
          { at: 'mid', tok: 'request', cth: 'running', t1: 'waiting', path: 'req', adv: 0, cap: '<b>Send it through ALPC.</b> Sending is a system call: the processor enters kernel mode and the executive\'s <span class="t">ALPC</span> facility takes the message. The executive only carries it; it knows nothing about printing.' },  // frame 2: sending is a system call; the executive's ALPC facility takes the message without reading it
          { at: 'port', tok: 'request', cth: 'waiting', t1: 'waiting', path: 'req', adv: 0, cap: '<b>Deliver to the port.</b> ALPC puts the message in the spooler\'s port queue and wakes one of its waiting threads. The client\'s thread now waits for the reply.' },  // frame 3: ALPC puts the message in the port queue and wakes a server thread; the client thread waits
        ];  // closes the shared frames
        const MODES = {  // MODES: the three stories the student can choose, each a list of six frames
          normal: base.concat([  // normal story: the shared frames plus three more
            { at: 'srv', tok: 'request', cth: 'waiting', t1: 'working', path: null, adv: 0, cap: '<b>The server does the work.</b> Spooler thread T1 adds the job to the printer\'s queue. Thread T2 is serving a different client at the same moment.' },  // frame 4: server thread T1 does the work while T2 serves another client
            { at: 'mid', tok: 'reply', cth: 'waiting', t1: 'replying', path: 'rep', adv: 2, cap: '<b>Reply.</b> The spooler sends "job 17 queued" back through ALPC.' },  // frame 5: the reply "job 17 queued" goes back through ALPC
            { at: 'client', tok: 'reply', cth: 'running', t1: 'waiting', path: 'rep', adv: 2, cap: '<b>Carry on.</b> The client\'s thread wakes with the reply. The two processes never touched each other\'s memory: everything went through messages.' },  // frame 6: the client wakes with the reply; the two processes never touched each other's memory
          ]),  // ends the normal story
          crash: base.concat([  // crash story: the shared frames plus three more
            { at: 'srv', tok: null, cth: 'waiting', sv: 'crashed', path: null, adv: 1, cap: '<b>The server crashes.</b> A bug kills the spooler process while it works on the request. Only that process dies: its private memory is thrown away, and the executive and every other process keep running.' },  // frame 4: the spooler crashes; only its own process and memory are lost
            { at: 'mid', tok: 'error', cth: 'waiting', sv: 'crashed', path: 'err', adv: 1, cap: '<b>An error instead of a reply.</b> ALPC sees that the server\'s port has closed and hands the waiting client an error.' },  // frame 5: ALPC sees the closed port and hands the waiting client an error instead of a reply
            { at: 'client', tok: 'error', cth: 'running', sv: 'restarted', t1: 'waiting', t2: 'waiting', path: 'err', adv: 1, cap: '<b>Recovery.</b> The client shows "printing unavailable" and stays open. The service control manager restarts the spooler, and the client can simply try again.' },  // frame 6: the client stays open, the spooler is restarted, and the client can try again
          ]),  // ends the crash story
          remote: [  // remote story: six frames of its own, with the printer on another computer
            { at: 'client', tok: 'request', cth: 'running', t1: 'waiting', path: null, adv: 3, cap: '<b>Same call, new place.</b> The printer now belongs to another computer, PRINTSRV. The word processor makes exactly the same <span class="t">RPC</span> call as before.' },  // frame 1: the word processor makes exactly the same RPC call as before
            { at: 'mid', tok: 'request', cth: 'running', t1: 'waiting', path: 'req', adv: 3, cap: '<b>Across the network.</b> The RPC machinery sees that the server is remote, so the message leaves through the network instead of through ALPC.' },  // frame 2: the RPC machinery sends the message over the network instead of through ALPC
            { at: 'port', tok: 'request', cth: 'waiting', t1: 'waiting', path: 'req', adv: 3, cap: '<b>Delivered on PRINTSRV.</b> The message arrives at the spooler service running on the print server.' },  // frame 3: the message arrives at the spooler on the print server, PRINTSRV
            { at: 'srv', tok: 'request', cth: 'waiting', t1: 'working', path: null, adv: 3, cap: '<b>The remote server does the work</b> and queues the job for its printer.' },  // frame 4: the remote spooler queues the job for its printer
            { at: 'mid', tok: 'reply', cth: 'waiting', t1: 'replying', path: 'rep', adv: 3, cap: '<b>The reply travels back</b> over the network.' },  // frame 5: the reply travels back over the network
            { at: 'client', tok: 'reply', cth: 'running', t1: 'waiting', path: 'rep', adv: 3, cap: '<b>Carry on.</b> The client\'s code did not change at all when the server moved to another machine. That is why client/server is a natural base for distributed computing.' },  // frame 6: the client's code did not change at all, which is why client/server suits distributed computing
          ],  // ends the remote story
        };  // closes the MODES table
        // geometry: wide = client and server side by side above the kernel; phone = client / kernel / server stacked
        const NW = ctx.narrow;  // NW is true on a phone-width screen
        const G = NW ? {  // G: all positions for the phone drawing, where client, kernel and server are stacked top to bottom
          W: 340, H: 412, lines: [126, 234],  // drawing size and the heights of the two dashed user/kernel boundary lines
          regions: [['user', 0, 0, 340, 120, 16], ['kern', 0, 132, 340, 96, 148], ['user2', 0, 240, 340, 172, 256]],  // the three background areas as [kind, x, y, width, height, label height]
          client: { box: [10, 22, 320, 92], tx: 24, ty: 44, a: 'start', th: [24, 74, 150] },  // client box, its title position and alignment, and its thread bar as [x, y, width]
          srv: { box: [10, 264, 320, 140], tx: 24, ty: 288, a: 'start', t1: [24, 358, 140], t2: [176, 358, 140], crash: [170, 378] },  // server box, its title, its two thread bars T1 and T2, and where the "crashed" note goes
          mid: { box: [10, 156, 320, 64], tx: 24, ty: 182, a: 'start' },  // middle box: the ALPC facility (or the network in the remote story)
          port: [262, 264], portLbl: [298, 258, 'start'],  // the port circle's position and where its label goes
          req: ['M 140 114 L 140 152', 'M 250 220 L 259 250'], rep: ['M 200 264 L 200 224', 'M 200 156 L 200 118'],  // arrow paths as SVG path strings: req = the two request legs, rep = the two reply legs
          pos: { client: [262, 60], mid: [262, 188], port: [262, 264], srv: [262, 322] },  // pos: where the message token stops at each stage (client, middle, port, server)
        } : {  // G for wider screens: client and server side by side above the kernel area
          W: 640, H: 290, lines: [181],  // drawing size and the height of the single dashed boundary line
          regions: [['user', 0, 0, 640, 176, 18], ['kern', 0, 186, 640, 104, 204]],  // two background areas: user mode on top, kernel mode below
          client: { box: [20, 26, 206, 136], tx: 123, ty: 50, a: 'middle', th: [40, 116, 166] },  // client box on the left, with its title and thread bar
          srv: { box: [384, 26, 240, 136], tx: 504, ty: 50, a: 'middle', t1: [398, 116, 102], t2: [508, 116, 104], crash: [504, 136] },  // server box on the right, with its title, two thread bars and crash note position
          mid: { box: [180, 208, 280, 62], tx: 272, ty: 234, a: 'middle' },  // middle box in the kernel area for ALPC or the network
          port: [384, 92], portLbl: [372, 124, 'end'],  // the port circle sits on the server box's left edge; its label goes below and to the left
          req: ['M 96 164 L 200 204', 'M 424 204 L 388 106'], rep: ['M 474 164 L 446 204', 'M 252 204 L 160 166'],  // request and reply arrow paths for the wide layout
          pos: { client: [123, 93], mid: [400, 239], port: [330, 92], srv: [504, 93] },  // token stop positions for the wide layout
        };  // closes the G layout choice
        const LBL = {  // LBL: the label for each background area; r is true in the remote story
          user: (r) => (NW ? (r ? 'USER MODE · YOUR PC' : 'USER MODE · CLIENT') : r ? 'USER MODE (TWO COMPUTERS)' : 'USER MODE'),  // user-mode label: says "your PC" or "two computers" in the remote story
          user2: (r) => (r ? 'USER MODE · PRINTSRV' : 'USER MODE · SERVER'),  // label for the phone layout's lower user-mode area: the server, or PRINTSRV when remote
          kern: () => 'KERNEL MODE',  // the kernel area is always labelled "KERNEL MODE"
        };  // closes LBL
        let mode = 'normal';  // mode is the chosen story: "normal", "crash" or "remote"
        const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%', style: 'flex:none' });  // creates the SVG drawing, sized to the layout
        const baseG = s('g');  // baseG: the group that holds everything except the moving token; it is rebuilt each frame
        const tokR = s('rect', { x: -30, y: -14, width: 60, height: 28, rx: 7, 'stroke-width': 2 });  // tokR: the token's rounded rectangle, centered on its own position
        const tokT = s('text', { x: 0, y: 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 });  // tokT: the word written on the token (request, reply or error)
        const tok = s('g', { class: 'tok' }, tokR, tokT);  // tok: the token group; its tok class makes it glide smoothly to each new spot
        svg.append(baseG, tok);  // adds the scene and the token to the drawing, with the token on top
        const advEls = ADV.map(([t, d]) => h('div', { class: 'adv' }, h('b', {}, t), h('span', { html: d })));  // advEls: the four advantage cards, one per ADV entry
        function thread([x, y, w], label, state) {  // thread(...): draws one thread bar with its label and state, e.g. "T1: working"
          const cls = state === 'working' || state === 'replying' || state === 'running' ? 's-thread' : 's-panel';  // active states (working, replying, running) get the thread color; waiting threads stay plain
          return [s('rect', { x, y, width: w, height: 30, rx: 6, class: cls, 'stroke-width': state === 'working' ? 3 : 1.5 }),  // the bar, with a thicker outline while the thread is working
            s('text', { x: x + w / 2, y: y + 19, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, label + ': ' + state)];  // the label and state written in the middle of the bar
        }  // ends thread()
        const box = ([x, y, w, hh], cls, on, dash) => s('rect', { x, y, width: w, height: hh, rx: 12, class: cls, 'stroke-width': on ? 4 : 2, 'stroke-dasharray': dash ? '8 5' : null });  // box(...): draws a rounded rectangle, thicker when active, dashed when asked (the remote server)
        const title = (o, t, sub, fs) => [s('text', { x: o.tx, y: o.ty, 'text-anchor': o.a, 'font-size': fs, 'font-weight': 800 }, t),  // title(...): writes a box's bold title and, below it, a grey subtitle
          s('text', { x: o.tx, y: o.ty + 19, 'text-anchor': o.a, 'font-size': 13, class: 's-sub' }, sub)];  // the grey subtitle line, 19 units under the title
        function draw(f) {  // draw(f): redraws the scene for frame f; runs on every step of the player
          const remote = mode === 'remote', sv = f.sv || 'ok', C = G.client, S = G.srv, M = G.mid;  // remote is true in the remote story; sv is the server's state; C, S and M are the client, server and middle layouts
          const k = [];  // k collects the scene's shapes
          G.regions.forEach(([kind, x, y, w, hh, ly]) => {  // draws each background area (user mode, kernel mode, and on a phone the server's user area)
            const kern = kind === 'kern';  // kern is true for the kernel-mode area
            k.push(s('rect', { x, y, width: w, height: hh, rx: 12, style: kern ? 'fill:color-mix(in srgb, var(--os) 7%, var(--panel));stroke:color-mix(in srgb, var(--os) 40%, transparent)' : 'fill:var(--panel-2);stroke:var(--line)' }),  // the area's rectangle: purple-tinted for kernel mode, grey for user mode
              s('text', { x: x + 12, y: ly, 'font-size': 13, 'font-weight': 800, 'letter-spacing': 1.5, class: kern ? null : 's-sub', style: kern ? 'fill:var(--os)' : null }, LBL[kind](remote)));  // the area's label in its top-left corner, purple for kernel mode and grey otherwise
          });  // ends the loop over areas
          G.lines.forEach((y) => k.push(s('line', { x1: 0, y1: y, x2: G.W, y2: y, 'stroke-dasharray': '9 6', 'stroke-width': 2, style: 'stroke:var(--ink-2)' })));  // draws each dashed user/kernel boundary line across the full width
          k.push(box(C.box, 's-proc', f.at === 'client'), ...title(C, 'Client process', 'word processor', 16), ...thread(C.th, 'thread', f.cth));  // the client box (highlighted when the token is there), its title "Client process" and its thread bar
          k.push(box(S.box, sv === 'crashed' ? 's-bad' : 's-proc', f.at === 'srv', remote),  // the server box: red when crashed, dashed when it sits on another computer, thick when the token is there
            ...title(S, sv === 'crashed' ? '✗ Server crashed' : 'Server process', remote ? (NW ? 'spooler on PRINTSRV' : 'spooler on PRINTSRV (another PC)') : sv === 'restarted' ? 'print spooler, restarted' : 'print spooler service', 16));  // the server's title and subtitle, which change for the crashed, restarted and remote cases
          if (sv !== 'crashed') k.push(...thread(S.t1, 'T1', f.t1), ...thread(S.t2, 'T2', f.t2 || 'working'));  // a working server shows its two thread bars; T2 is busy with another client unless the frame says otherwise
          else k.push(s('text', { x: S.crash[0], y: S.crash[1], 'text-anchor': 'middle', 'font-size': 13.5, style: 'fill:var(--bad)', 'font-weight': 700 }, 'memory discarded, threads gone'));  // a crashed server shows a red note instead: its memory is discarded and its threads are gone
          const dead = sv === 'crashed'; // a crashed server's port is closed
          k.push(s('circle', { cx: G.port[0], cy: G.port[1], r: 9, class: dead ? 's-bad' : 's-os', 'stroke-width': 2 }),  // the port circle, red when the port is closed
            s('text', { x: dead && NW ? G.W - 4 : G.portLbl[0], y: G.portLbl[1], 'text-anchor': dead && NW ? 'end' : G.portLbl[2], 'font-size': 13, 'font-weight': 700, style: dead ? 'fill:var(--bad)' : 'fill:var(--os)' }, dead ? (NW ? 'closed' : 'port closed') : 'port'));  // the port's label: "port", or "port closed" in red (just "closed" on a phone, where space is tight)
          k.push(s('rect', { x: M.box[0], y: M.box[1], width: M.box[2], height: M.box[3], rx: 10, class: remote ? 's-io' : 's-os', 'stroke-width': f.at === 'mid' ? 4 : 2 }),  // the middle box: the ALPC facility in purple, or the network in orange in the remote story
            ...title(M, remote ? 'Network' : 'ALPC facility', remote ? 'RPC messages to PRINTSRV' : 'in the executive', 15));  // the middle box's title and subtitle
          // req = request going down and over; rep = reply coming back; err = only the kernel → client leg (the server is gone)
          const rq = f.path === 'req', rp = f.path === 'rep', er = f.path === 'err';  // rq, rp and er say whether this frame shows the request, the reply or the error path
          const arrow = (d, on, col) => s('path', { d, class: on ? '' : 's-muted', style: on ? `stroke:var(--${col});fill:none` : '', 'stroke-width': on ? 3 : 2, 'marker-end': on ? `url(#arr-${col})` : 'url(#arr-muted)' });  // arrow(...): draws one path with an arrowhead, colored when active and faint grey otherwise
          k.push(arrow(G.req[0], rq, 'accent'), arrow(G.req[1], rq, 'accent'), arrow(G.rep[0], rp, 'ok'), arrow(G.rep[1], rp || er, er ? 'bad' : 'ok'));  // adds the four arrow legs; in the crash story the last leg turns red to carry the error
          baseG.replaceChildren(...k);  // replaces the scene with the new shapes; the token stays in place so it can glide
          if (f.tok) {  // this frame has a token to show
            const [x, y] = G.pos[f.at];  // x and y: where the token should sit at this stage
            tok.style.opacity = '1'; tok.style.transform = `translate(${x}px, ${y}px)`;  // makes the token visible and moves it there; the CSS transition animates the move
            tokR.setAttribute('class', f.tok === 'error' ? 's-bad' : f.tok === 'reply' ? 's-ok' : 's-accent');  // colors the token: red for an error, green for a reply, accent for a request
            tokT.textContent = f.tok;  // writes the token's word
          } else tok.style.opacity = '0';  // frames without a token (the crash moment) hide it
          advEls.forEach((a, i) => a.classList.toggle('on', i === f.adv));  // lights up the advantage card this frame illustrates
        }  // ends draw()
        let F = MODES.normal;  // F is the list of frames for the chosen story; it starts with the normal story
        const player = ctx.ui.player({ count: 6, interval: 2600, captionBelow: true, render: (i) => { draw(F[i]); return F[i].cap; } });  // the step player: six frames, one every 2.6 seconds, caption under the buttons; each step redraws the scene
        player.caption.style.minHeight = '96px';  // gives the caption box a minimum height so the controls do not jump
        const seg = ctx.ui.seg([{ value: 'normal', label: 'Normal request' }, { value: 'crash', label: 'Server crashes' }, { value: 'remote', label: 'Server on another PC' }], 'normal', (v) => { mode = v; F = MODES[v]; player.reset(); });  // story switch: Normal request / Server crashes / Server on another PC; a new pick restarts the player
        el.append(h('div', { class: 'split l fill' },  // puts the step on screen: text on the left, the animation card on the right
          h('div', { class: 'stack', style: { gap: '10px' } },  // the left column
            h('p', { class: 'm0', html: 'Windows builds many services on the <span class="t">client/server model</span>, as the microkernel systems of section 2.4 do. <b>Servers</b> are separate processes (environment subsystems, services). <b>Clients</b>, usually applications, send a request message and wait for the reply; on one computer the executive\'s ALPC facility carries it.' }),  // intro paragraph: Windows builds many services as servers, and on one computer ALPC carries the messages
            h('h4', { class: 'm0' }, 'Four advantages (the one shown lights up)'),  // heading for the four advantage cards
            h('div', { class: 'grid-2', style: { gap: '8px' } }, ...advEls),  // the four advantage cards in a two-column grid
            h('p', { class: 'xs muted m0', html: 'Windows is not a pure microkernel: for speed, the executive stays in kernel mode.' })),  // small note: Windows is not a pure microkernel, because the executive stays in kernel mode for speed
          h('div', { class: 'card white stack', style: { gap: '8px' } }, seg, svg, player.el)));  // the right card: the story switch, the drawing and the player
      },  // ends render() for step 5
    },  // ends step 5

    /* ---------------- 6. Threads and SMP: a Gantt lab with policy toggles ---------------- */
    {  // step 6 starts here
      title: 'Threads and SMP: keep every processor busy',  // step title shown as the heading of step 6
      kind: 'lab',  // kind "lab" marks this step as a hands-on exercise
      render(el, ctx) {  // render(el, ctx): builds the processor-scheduling lab when step 6 opens
        const { h, s } = ctx;  // takes the helpers h (HTML elements) and s (SVG drawing elements)
        // work waiting to run, in queue order: [label, kind, length, owning process]
        const WORK = [['I/O', 'os', 2, null], ['P1', 'th', 3, 'photo'], ['VM', 'os', 2, null], ['P2', 'th', 3, 'photo'], ['Obj', 'os', 1, null],  // WORK: ten pieces of work: OS routines (os) and photo editor (P) and web server (W) threads (th), with lengths
          ['P3', 'th', 3, 'photo'], ['Sec', 'os', 1, null], ['W1', 'th', 2, 'web'], ['Cache', 'os', 2, null], ['W2', 'th', 2, 'web']];  // continues the WORK list with the last three OS routines and the two web server threads
        const TOTAL = WORK.reduce((a, w) => a + w[2], 0); // 21 units of work
        function sim(n, os0, one) {  // sim(n, os0, one): simulates scheduling WORK on n cores; os0 = OS work only on core 0, one = one thread per process at a time
          const left = WORK.map(([id, kind, len, proc]) => ({ id, kind, len, proc }));  // left: a fresh copy of the waiting work as objects, in queue order
          const free = Array(n).fill(0), run = [];  // free[c] is the time core c becomes free; run collects each piece of work with its core and start and end times
          for (let t = 0; left.length && t < 100; t++) {  // steps through time one unit at a time until nothing is left (100 is a safety limit)
            for (let c = 0; c < n; c++) {  // at each moment, looks at each core in turn
              if (free[c] > t) continue;  // a core still busy with earlier work is skipped
              const i = left.findIndex((k) => !(os0 && k.kind === 'os' && c !== 0) && !(one && k.proc && run.some((r) => r.proc === k.proc && r.s <= t && r.e > t)));  // finds the first waiting piece this core may take under the chosen rules
              if (i < 0) continue;  // nothing this core may run right now, so it stays idle for this unit
              const k = left.splice(i, 1)[0];  // takes that piece out of the waiting list
              run.push(Object.assign(k, { c, s: t, e: t + k.len })); free[c] = t + k.len;  // records it as running on core c from t to t + its length, and marks the core busy until then
            }  // ends the loop over cores
          }  // ends the loop over time
          return { mk: Math.max(...run.map((r) => r.e)), run };  // returns the finish time of the last piece (mk) and the full schedule
        }  // ends sim()
        const maxAt = (run, pred, mk) => Math.max(...ctx.util.range(mk).map((t) => run.filter((r) => pred(r) && r.s <= t && r.e > t).length));  // maxAt: the largest number of pieces matching a test that run at the same moment, over the whole schedule
        let n = 4, os0 = false, one = false;  // n is the number of cores (starting at 4); os0 and one are the two rule switches, both off (Windows rules)
        const VW = ctx.narrow ? 360 : 620;  // width of the chart's coordinate system: smaller on a phone
        const svg = s('svg', { viewBox: `0 0 ${VW} 252`, width: '100%', style: 'flex:none' });  // creates the SVG chart (a Gantt chart: one lane per core, bars along a time axis)
        const stats = h('div', { class: 'kpis', style: ctx.narrow ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : {} });  // stats: the row of four number tiles; two per row on a phone
        const story = h('div', { class: 'callout m0 small' });  // story: the note that explains what the current settings show
        function update() {  // update(): reruns the simulation and redraws everything; runs on every slider or switch change
          const cur = sim(n, os0, one), win = sim(n, false, false);  // cur is the schedule under the chosen rules; win is the schedule under Windows rules, for comparison
          const T = Math.max(...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => sim(n, !!a, !!b).mk));  // T: the worst finish time over all four rule combinations, so the time axis does not rescale while toggling
          const X0 = ctx.narrow ? 54 : 74, W = VW - X0 - 10, u = W / T, step = u >= 24 ? 1 : 3;  // X0 is the left margin for core labels, W the chart width, u the width of one time unit, step the tick spacing
          const k = [s('text', { x: X0, y: 16, 'font-size': 13, class: 's-sub' }, 'time →')];  // k collects the chart's shapes, starting with the "time →" label
          for (let t = 0; t <= T; t += step) {  // draws a tick every step units along the time axis
            k.push(s('line', { x1: X0 + t * u, y1: 24, x2: X0 + t * u, y2: 226, class: 's-muted', 'stroke-width': 1, 'stroke-dasharray': '2 4' }),  // a dotted vertical grid line at this time
              s('text', { x: X0 + t * u, y: 244, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(t)));  // the time number under the grid line
          }  // ends the tick loop
          for (let c = 0; c < 4; c++) {  // draws four core lanes, whether or not that many cores are installed
            const y = 26 + c * 50, here = c < n;  // y is the lane's height; here is true when this core is installed
            k.push(s('text', { x: 6, y: y + 26, 'font-size': 14, 'font-weight': 800, class: here ? '' : 's-sub' }, 'Core ' + c),  // the core's name at the left, grey when the core is not installed
              s('rect', { x: X0, y, width: W, height: 44, rx: 6, class: here ? 's-panel' : 's-muted', 'stroke-dasharray': here ? null : '5 4', opacity: here ? 1 : 0.6 }));  // the lane's background: plain when installed, dashed and faded when not
            if (!here) k.push(s('text', { x: X0 + W / 2, y: y + 27, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'not installed'));  // an uninstalled lane says "not installed" in its middle
          }  // ends the lane loop
          for (const r of cur.run) {  // draws a bar for each piece of work in the schedule
            const x = X0 + r.s * u + 1, w = r.len * u - 2, y = 26 + r.c * 50 + 3;  // x and w: where the bar starts and how long it is; y: the lane it sits in
            k.push(s('rect', { x, y, width: w, height: 38, rx: 5, class: r.kind === 'os' ? 's-os' : 's-thread', 'stroke-width': 2, 'stroke-dasharray': r.proc === 'web' ? '6 3' : null }));  // the bar: purple for OS routines, the thread color for threads, dashed for web server threads
            if (w >= r.id.length * 8 + 6) k.push(s('text', { x: x + w / 2, y: y + 24, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, r.id));  // writes the piece's name on the bar when the bar is wide enough
          }  // ends the bar loop
          const fx = X0 + cur.mk * u, late = fx > VW - 100;  // fx: where the last piece ends; late is true when that is near the right edge
          k.push(s('line', { x1: fx, y1: 20, x2: fx, y2: 230, style: 'stroke:var(--accent)', 'stroke-width': 3 }),  // a vertical accent line at the finish time
            s('text', { x: late ? fx - 6 : fx + 6, y: 16, 'text-anchor': late ? 'end' : 'start', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--accent)' }, 'done at ' + cur.mk));  // the "done at" label, placed to the left of the line when it would run off the right edge
          svg.replaceChildren(...k);  // puts all the chart shapes on the screen
          const util = Math.round((TOTAL / (n * cur.mk)) * 100);  // util: the share of core time spent busy, as a percentage (total work divided by cores times finish time)
          const photo = maxAt(cur.run, (r) => r.proc === 'photo', cur.mk), osPar = maxAt(cur.run, (r) => r.kind === 'os', cur.mk);  // photo: most photo editor threads running at once; osPar: most OS routines running at once
          stats.replaceChildren(  // refills the four number tiles
            h('div', { class: 'card tight kpi' }, h('span', { class: 'xs b muted' }, 'FINISH TIME'), h('span', { class: 'big' }, String(cur.mk))),  // tile: the finish time of the whole workload
            h('div', { class: 'card tight kpi' }, h('span', { class: 'xs b muted' }, 'CORES BUSY'), h('span', { class: 'big' }, util + '%')),  // tile: how busy the cores were, as a percentage
            h('div', { class: 'card tight kpi' }, h('span', { class: 'xs b muted' }, 'PHOTO THREADS AT ONCE'), h('span', { class: 'big' }, String(photo))),  // tile: the most photo editor threads that ran at the same moment
            h('div', { class: 'card tight kpi' }, h('span', { class: 'xs b muted' }, 'OS ROUTINES AT ONCE'), h('span', { class: 'big' }, String(osPar))));  // tile: the most OS routines that ran at the same moment; closes the tile row
          let msg, cls;  // msg and cls: the story note's text and its style (tip, why or warn)
          if (!os0 && !one) {  // both switches on Windows rules
            cls = 'tip'; msg = n === 1 ? '<b>Windows rules, one core.</b> With a single processor there is nothing to share: under every rule the 21 units of work finish at time 21. SMP pays off only when there are several processors.'  // with one core, every rule gives the same finish time of 21, so SMP has nothing to share
              : `<b>Windows rules.</b> Any core runs any work, OS routines included, and the photo editor's threads run side by side. The ${TOTAL} units of work finish at time ${cur.mk}${n === 4 ? ', the best any schedule can do on 4 cores (21 ÷ 4 = 5.25, rounded up to whole units)' : ''}.`;  // with several cores: any core runs any work, and the note names the finish time (and the best possible on 4 cores)
          } else if (cur.mk === win.mk) {  // a rule is switched on but the finish time is no worse than under Windows rules
            cls = 'why'; msg = `<b>No cost yet.</b> With ${n} core${n > 1 ? 's' : ''}, the processors themselves are the bottleneck, so this rule does not slow anything down. Add cores and watch it start to hurt.`;  // the "No cost yet" note: the processors themselves are the bottleneck, so the rule does not slow anything down
          } else {  // a rule is switched on and the work finishes later than under Windows rules
            cls = 'warn';  // this case uses the warning style
            const costOs = os0 && sim(n, true, false).mk > win.mk, costOne = one && sim(n, false, true).mk > win.mk, alone = !costOs && !costOne;  // checks which rule costs time on its own; alone means neither does by itself, only together
            const why = [costOs || alone ? 'all OS work must queue for core 0 (the old master/slave design), so core 0 becomes a bottleneck while other cores sit idle' : null, costOne || alone ? 'the photo editor\'s threads must take turns instead of running on different cores at the same time' : null].filter(Boolean).join(', and ');  // why: explains the cause, core 0 as a bottleneck, threads forced to take turns, or both, joined with "and"
            const note = os0 && one && !alone && !(costOs && costOne) ? ` (On its own, the ${costOs ? '"one at a time"' : '"core 0 only"'} rule would cost nothing with ${n} cores, but it adds to the delay here.)` : alone ? ' Neither rule hurts on its own with this many cores; together they do.' : '';  // note: an extra remark when only one of the two switched-on rules is to blame, or only both together
            msg = `<b>${cur.mk - win.mk} extra time units (finish at ${cur.mk} instead of ${win.mk}).</b> Here ${why}.${note} Windows allows both kinds of parallelism.`;  // the full warning: how many extra time units, why, and that Windows allows both kinds of parallelism
          }  // ends the three cases
          story.className = 'callout m0 small ' + cls;  // gives the note its style class
          story.setAttribute('data-label', cls === 'tip' ? 'What you see' : cls === 'why' ? 'What you see' : 'What went wrong');  // sets the note's small label: "What you see" for the good cases, "What went wrong" for the warning
          story.innerHTML = msg;  // writes the explanation into the note
        }  // ends update()
        const slider = ctx.ui.slider({ label: 'Processor cores', min: 1, max: 4, value: n, onInput: (v) => { n = v; update(); } });  // slider for the number of processor cores, 1 to 4; moving it reruns the simulation
        const segOs = ctx.ui.seg([{ value: 0, label: 'any core (Windows)' }, { value: 1, label: 'core 0 only (master/slave)' }], 0, (v) => { os0 = !!v; update(); });  // switch: OS routines may run on any core (Windows) or on core 0 only (the old master/slave design)
        const segTh = ctx.ui.seg([{ value: 0, label: 'in parallel (Windows)' }, { value: 1, label: 'one at a time' }], 0, (v) => { one = !!v; update(); });  // switch: threads of one process run in parallel (Windows) or one at a time
        const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left: the left column of text about SMP
          h('p', { class: 'm0', html: 'Windows was designed for a <span class="t">symmetric multiprocessor</span> from the start, and it treats every processor as an equal:' }),  // opening sentence: Windows treats every processor of a symmetric multiprocessor as an equal
          h('ul', { class: 'small m0', html: '<li>Any OS routine can run on any free processor, and different routines can run on different processors <b>at the same moment</b>.</li><li>One process can have several <span class="t">threads</span>, and they can run on different processors at the same time.</li><li>A server process can use several threads to serve several clients at once (W1 serves client A, W2 serves client B).</li><li>Processes can share data and resources, and talk through flexible message passing.</li>' }),  // bullet list: OS routines on any processor at once, threads of one process in parallel, multithreaded servers, sharing
          h('div', { class: 'card tight small', html: '<b>The workload:</b> <span class="chip thread">P1–P3</span> photo editor threads, <span class="chip thread" style="outline:1.5px dashed var(--thread)">W1–W2</span> web server threads, <span class="chip os">I/O, VM, Obj, Sec, Cache</span> OS routines (work for the I/O, virtual memory, object, security and cache managers). 21 units of work in all.' }),  // workload card: the photo editor threads, web server threads and OS routines, 21 units in all
          story);  // the story note; closes the left column
        const right = h('div', { class: 'card white stack', style: { gap: '9px' } },  // right: the lab card in the right column
          slider,  // the core slider
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'OS routines may run on'), segOs),  // row with the label "OS routines may run on" and its switch
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'Threads of one process run'), segTh),  // row with the label "Threads of one process run" and its switch
          svg, stats,  // the Gantt chart and the number tiles
          h('p', { class: 'xs muted m0', html: '<b>Try:</b> set 2 cores and flip the toggles. When the processors themselves are the bottleneck, the rules cost nothing; with 4 cores they cost a lot.' }));  // hint: try 2 cores and flip the switches, then compare with 4 cores
        el.append(h('div', { class: 'split l fill' }, left, right));  // puts both columns into the step, the left one smaller
        update();  // runs the simulation once so the chart is drawn when the step opens
      },  // ends render() for step 6
    },  // ends step 6

    /* ---------------- 7. Windows objects: handles + names, OO ideas, kernel objects ---------------- */
    {  // step 7 starts here
      title: 'Everything is an object: handles, names and security',  // step title shown as the heading of step 7
      kind: 'explore',  // kind "explore" marks this step as one to click around in
      render(el, ctx) {  // render(el, ctx): builds the three-tab objects step when step 7 opens
        const { h } = ctx;  // takes the helper h, which makes HTML elements
        /* ---- tab 1: two processes share (or fail to share) objects through the object manager ---- */
        function tabHandles(panel) {  // tabHandles(panel): builds tab 1 inside panel when the tab is opened
          const USERS = { A: 'ana', B: 'sam' };  // USERS: the user each process runs as: process A is ana, process B is sam
          let objs, tables, nextH, msg;  // objs: objects in the object manager; tables: each process's handle table; nextH: next handle number; msg: feedback
          function reset() {  // reset(): puts tab 1 back to its starting state; runs when the tab opens and on "Start over"
            objs = [{ id: 'adm', name: '\\BaseNamedObjects\\AdminOnlyLock', type: 'Mutex', sd: 'Administrators only', allow: [], count: 1, pre: true }];  // starts with one object that already exists: a mutex (a lock only one thread can hold) only administrators may open
            tables = { A: [], B: [] }; nextH = { A: 4, B: 4 };  // both handle tables start empty, and each process's first handle will be number 4
            msg = ['', 'Pick an action from the list. Each one is a real kind of request a program makes to the object manager.'];  // starting feedback: explains how to play
            paint();  // draws the tab's columns and feedback
          }  // ends reset()
          const hex = (n) => '0x' + n.toString(16).toUpperCase();  // hex(n): writes a number in hexadecimal with a 0x prefix, the way handle values are usually shown
          const find = (id) => objs.find((o) => o.id === id);  // find(id): looks up an object by its id, or gives undefined if it no longer exists
          // each handle-table entry records the object AND the access rights granted when the handle was made
          function give(p, o, acc) { const hv = nextH[p]; nextH[p] += 4; tables[p].push({ h: hv, id: o.id, acc }); o.count++; return hv; }  // give(p, o, acc): adds a handle for object o to process p's table, going up by 4 each time, and counts it
          function sameNum(p, hv) { // handle values are per-process: point out when the other process uses the same number
            const q = p === 'A' ? 'B' : 'A', r = tables[q].find((x) => x.h === hv);  // q is the other process; r is its handle with the same number, if it has one
            return r ? ` ${q} also has a handle numbered <code>${hex(hv)}</code>${r.id === tables[p].find((x) => x.h === hv).id ? ', to the same object' : ', to a different object'}: a handle value means something only inside its own process.` : '';  // returns an extra sentence when both processes hold the same number, saying whether it is the same object
          }  // ends sameNum()
          function openByName(p, id, label) {  // openByName(p, id, label): process p asks the object manager to open an object by its name
            const o = find(id);  // o is the object, if it exists
            if (!o) return ['bad', `<b>No such name.</b> The object manager finds nothing called “${label}” in its namespace, so ${p} gets no handle. Create it first.`];  // no object has that name, so no handle is made
            if (tables[p].some((r) => r.id === id)) return ['warn', `${p} already holds a handle to “${label}”. Opening again would simply give it a second handle.`];  // p already holds a handle to this object
            if (!o.allow.includes(USERS[p])) return ['bad', `<b>Access denied.</b> The object manager found “${label}”, but the security reference monitor checked its security descriptor (<i>${o.sd}</i>) and user ${USERS[p]} is not allowed. No handle is created.`];  // the object exists, but its security descriptor does not allow p's user, so access is denied
            const hv = give(p, o, 'wait, signal');  // allowed: p gets a new handle recording the rights "wait, signal"
            return ['ok', `<b>Opened by name.</b> The object manager found “${label}”, and the security reference monitor checked its security descriptor: user ${USERS[p]} may wait on it and signal it. ${p} gets handle <code>${hex(hv)}</code> in its <i>own</i> table, with those rights recorded beside it, so later uses of the handle are checked against the rights alone. The object now has ${o.count} handles.${sameNum(p, hv)}`];  // explains the successful open: name found, security checked, handle made in p's own table, handle count
          }  // ends openByName()
          function close(p, id) {  // close(p, id): process p closes its handle to an object
            const i = tables[p].findIndex((r) => r.id === id);  // i is the position of p's handle to that object in its table
            if (i < 0) return ['warn', `${p} holds no handle to that object, so there is nothing to close.`];  // p has no such handle, so there is nothing to close
            const o = find(id); const hv = tables[p][i].h;  // o is the object; hv is the handle value being closed
            tables[p].splice(i, 1); o.count--;  // removes the handle from p's table and lowers the object's handle count
            if (o.count === 0) { objs = objs.filter((x) => x !== o); return ['ok', `${p} closed <code>${hex(hv)}</code>. That was the last handle, so the object manager <b>deletes</b> the object and removes its name.`]; }  // that was the last handle, so the object manager deletes the object and its name
            return ['ok', `${p} closed <code>${hex(hv)}</code>. The object stays alive because ${o.count} handle${o.count > 1 ? 's' : ''} still point${o.count > 1 ? '' : 's'} to it.`];  // other handles remain, so the object stays alive
          }  // ends close()
          const ACTS = [  // ACTS: the action buttons for tab 1, as [process, button label, what happens when clicked]
            ['A', 'A: create named event “SaveDone”', () => {  // action: process A creates a named event called SaveDone (an event records that something happened)
              if (find('ev')) return ['warn', '“SaveDone” already exists. A second create with the same name would just open the existing event.'];  // if SaveDone already exists, a second create would only open it
              const o = { id: 'ev', name: '\\BaseNamedObjects\\SaveDone', type: 'Event', sd: 'ana and sam may use it', allow: ['ana', 'sam'], count: 0, fresh: true };  // the new Event object: its name, a security descriptor letting ana and sam use it, and no handles yet
              objs.push(o); const hv = give('A', o, 'all access');  // adds the object and gives A a handle with full access
              return ['ok', `<b>Created.</b> The object manager builds an Event object, records its name in the namespace, attaches a security descriptor and gives A handle <code>${hex(hv)}</code> with full access.${sameNum('A', hv)}`]; }],  // explains what the object manager did: built the object, named it, attached security, gave A a handle
            ['B', 'B: open “SaveDone” by name', () => openByName('B', 'ev', 'SaveDone')],  // action: process B opens SaveDone by name
            ['A', 'A: create an unnamed mutex', () => {  // action: process A creates a mutex with no name
              if (find('mx')) return ['warn', 'A already made its unnamed mutex.'];  // A only needs to make its unnamed mutex once
              const o = { id: 'mx', name: '(no name)', type: 'Mutex', sd: 'ana only', allow: ['ana'], count: 0, fresh: true };  // the new Mutex object: no name, and only ana may use it
              objs.push(o); const hv = give('A', o, 'all access');  // adds the object and gives A a handle with full access
              return ['ok', `<b>Created, unnamed.</b> A gets handle <code>${hex(hv)}</code>. With no name in the namespace, nobody else can look this object up.${sameNum('A', hv)}`]; }],  // explains that with no name, nobody else can look this object up
            ['B', 'B: try to open A\'s unnamed mutex', () => find('mx') ? ['bad', '<b>Impossible by name.</b> The mutex has no name, so B has nothing to ask for. B can get a handle only if A passes one on, by duplicating its handle (try that button) or by letting a child process inherit it.'] : ['warn', 'A has not created its unnamed mutex yet.']],  // action: B tries to reach A's unnamed mutex, which is impossible without a name
            ['A', 'A: duplicate its mutex handle into B', () => {  // action: A duplicates (copies) its mutex handle into B's table
              const o = find('mx');  // o is the unnamed mutex
              if (!o) return ['warn', 'A has not created its unnamed mutex yet, so there is no handle to pass on.'];  // the mutex must exist before a handle to it can be passed on
              if (tables.B.some((r) => r.id === 'mx')) return ['warn', 'B already holds a handle to the mutex.'];  // B only needs one handle to the mutex
              const hv = give('B', o, 'wait, release');  // gives B a handle with the rights "wait, release"
              return ['ok', `<b>Handle passed on.</b> A asks the object manager to copy its handle into B\'s table, and B gets <code>${hex(hv)}</code>. No name lookup is involved: A vouches for B, and the copy can never carry more rights than A\'s own handle. This is how unnamed objects are shared.${sameNum('B', hv)}`]; }],  // explains duplication: no name lookup, A vouches for B, and the copy never has more rights than A's own
            ['B', 'B: open “AdminOnlyLock”', () => openByName('B', 'adm', 'AdminOnlyLock')],  // action: B tries to open the administrators-only lock by name, which will be refused
            ['A', 'A: close its handle to SaveDone', () => close('A', 'ev')],  // action: A closes its handle to SaveDone
            ['B', 'B: close its handle to SaveDone', () => close('B', 'ev')],  // action: B closes its handle to SaveDone; if it was the last one, the event is deleted
          ];  // closes the ACTS list
          const acts = h('div', { class: 'stack', style: { gap: '6px' } });  // acts: the column that holds the action buttons
          const out = h('div', { class: 'callout m0 small' });  // out: the feedback note under the tables
          const colA = h('div', { class: 'card proc tight stack pcol' }), colB = h('div', { class: 'card proc tight stack pcol' }), colOM = h('div', { class: 'card os tight stack pcol' });  // the three columns: process A and process B (teal cards) and the object manager between them (purple card)
          function table(p) {  // table(p): builds the HTML for one process's column, including its handle table
            const rows = tables[p].map((r) => { const o = find(r.id); return `<div class="hrow"><code>${hex(r.h)}</code> → ${o.type} “${o.name === '(no name)' ? 'unnamed' : o.name.split('\\').pop()}”<div class="xs muted">granted: ${r.acc}</div></div>`; }).join('') || '<div class="xs muted">(no open handles)</div>';  // one row per handle: its number, the object's type and short name, and the rights granted; or "(no open handles)"
            return `<div class="b">Process ${p}</div><div class="xs muted">${p === 'A' ? 'editor' : 'backup tool'}, user <b>${USERS[p]}</b></div><h4 style="margin:6px 0 2px">Handle table</h4>${rows}`;  // the column: process name, what it is and which user it runs as, then the handle table heading and rows
          }  // ends table()
          function paint() {  // paint(): redraws all three columns and the feedback; runs after every action
            colA.innerHTML = table('A'); colB.innerHTML = table('B');  // fills the two process columns
            colOM.innerHTML = '<div class="b">Object manager <span class="xs muted">(kernel mode)</span></div><div class="xs muted">It keeps each object\'s header (name, security, handle count); the body holds the type\'s own data.</div>' + objs.map((o) => `<div class="objc${o.fresh ? ' fade-in' : ''}"><div class="b">${o.type}${o.pre ? ' <span class="xs muted">(already exists)</span>' : ''}</div><div class="xs"><b>Name:</b> ${o.name.replace(/\\/g, '\\<wbr>')}</div><div class="xs"><b>Security:</b> ${o.sd}</div><div class="xs"><b>Handles:</b> ${o.count}</div></div>`).join('');  // fills the object manager column with one card per object: type, name, security descriptor and handle count
            objs.forEach((o) => { o.fresh = false; });  // clears the fresh flag so a new object fades in only once
            out.className = 'callout m0 small ' + (msg[0] === 'ok' ? 'tip' : msg[0] === 'bad' ? 'bad' : msg[0] === 'warn' ? 'warn' : '');  // styles the feedback by result: green for success, red for refused, amber for a note
            out.setAttribute('data-label', msg[0] === 'ok' ? 'Object manager' : msg[0] === 'bad' ? 'Refused' : msg[0] === 'warn' ? 'Note' : 'How to play');  // sets the feedback's small label to match: "Object manager", "Refused", "Note" or "How to play"
            out.innerHTML = msg[1];  // writes the feedback text
          }  // ends paint()
          acts.append(...ACTS.map(([p, label, fn]) => h('button', { class: 'btn sm ' + (p === 'A' ? 'proc' : 'thread'), style: { justifyContent: 'flex-start' }, onclick: () => { msg = fn(); paint(); } }, label)),  // adds one button per action (teal for A, pink for B); each click runs its action and repaints
            h('button', { class: 'btn sm ghost', style: { justifyContent: 'flex-start' }, onclick: reset }, '↺ Start over'));  // a last button that resets the tab to its starting state
          panel.append(h('div', { class: 'objgrid', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0, 1fr)', height: 'auto' } : {} },  // lays out the tab: actions on the left, tables on the right; a single column on a phone
            h('div', { class: 'stack', style: { gap: '8px' } },  // the left column
              h('p', { class: 'small m0', html: 'Windows makes something an <b>object</b> when user programs must reach it, or when it is shared or protected: files, processes, threads, events, mutexes. The <span class="t">object manager</span> creates each one; a program only ever holds a <span class="t">handle</span> to it.' }), acts),  // intro text: what Windows makes into objects and that programs only ever hold handles; then the action buttons
            h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'grid-3', style: Object.assign({ gap: '10px', flex: '1', minHeight: '0' }, ctx.narrow ? {} : { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 1fr)' }) }, colA, colOM, colB), out)));  // the right column: A, object manager and B side by side (the middle one wider), with the feedback below
          reset();  // sets up the starting state and draws it
        }  // ends tabHandles()
        /* ---- tab 2: match each Windows example to an object-oriented idea ---- */
        function tabOO(panel) {  // tabOO(panel): builds tab 2, matching Windows examples to object-oriented ideas
          const C = [  // C: the four ideas as [name, short definition]
            ['Encapsulation', 'Data is hidden inside the object; outsiders use only its operations.'],  // idea: encapsulation
            ['Class and instance', 'A class is a template for one kind of object; each object made from it is an instance.'],  // idea: class and instance
            ['Inheritance', 'A new class reuses and extends an existing one. In Windows: inside the implementation only.'],  // idea: inheritance, which Windows uses only inside its own implementation
            ['Polymorphism', 'One operation works on many object types, each giving it its own meaning.'],  // idea: polymorphism
          ];  // closes the C list
          const EX = [  // EX: six Windows examples as [example text, index of the right idea, explanation shown when matched]
            ['A program can never read an event object\'s fields directly. It can only call functions such as SetEvent or WaitForSingleObject on a handle.', 0, 'The event\'s data is sealed inside the object; the only way in is through the operations it offers.'],  // example: programs use an event only through functions like SetEvent (answer: encapsulation)
            ['Each object type (File, Process, Event…) is described by a type object. Every file you open becomes a new File object built from that description.', 1, 'The type object plays the role of the class; each open file is one instance of it.'],  // example: each type object describes a kind of object, and each opened file is built from it (answer: class and instance)
            ['Inside the kernel, mutex, event and semaphore objects all start with the same shared header structure and reuse the code written for that header.', 2, 'Sharing a common "parent" part and its code is inheritance, done by hand in C inside the implementation.'],  // example: mutex, event and semaphore objects share a common header and its code (answer: inheritance)
            ['WaitForSingleObject works on a process, a thread, an event or a timer. Each type decides for itself what "signaled" means.', 3, 'One operation, many types, each with its own meaning: that is polymorphism.'],  // example: one wait function works on several object types (answer: polymorphism)
            ['Only the object manager ever touches an object\'s header. Programs are never given a pointer to it, just a handle.', 0, 'Hiding the object\'s insides behind handles and operations is encapsulation.'],  // example: only the object manager touches an object's header; programs hold handles (answer: encapsulation)
            ['Two programs each open report.txt. The object manager creates two separate file objects, both of the File type.', 1, 'One type (class), two objects made from it (instances), each with its own state such as its current position in the file.'],  // example: two programs open the same file and get two File objects (answer: class and instance)
          ];  // closes the EX list
          const fb = h('div', { class: 'callout m0 small', 'data-label': 'How to play', html: 'For each Windows example, click the idea it shows. You get instant feedback here.' });  // fb: the feedback note, starting with instructions
          const score = h('span', { class: 'chip ok' });  // score: a green chip counting matched examples
          const got = [];  // got[i] becomes true once example i is matched
          const rows = EX.map(([txt, ans, why], i) => {  // rows: one row per example, each with four idea buttons
            const btns = C.map(([name], j) => h('button', { class: 'btn sm', type: 'button', onclick: () => {  // builds the four buttons; each click checks whether that idea matches this example
              if (got[i]) return;  // a matched example ignores further clicks
              if (j === ans) { got[i] = true; b.classList.add('right'); btns[j].classList.add('on'); btns.forEach((x) => (x.disabled = x !== btns[j])); fb.className = 'callout m0 small tip'; fb.setAttribute('data-label', 'Right: ' + name); fb.innerHTML = why; }  // right idea: mark the row green, keep only that button active, and show the explanation
              else { btns[j].disabled = true; b.classList.add('miss'); fb.className = 'callout m0 small warn'; fb.setAttribute('data-label', 'Not ' + name); fb.innerHTML = `${name}: ${C[j][1]} Does that describe this example? Try another idea.`; }  // wrong idea: disable that button, give the row an amber border, and explain what the idea really means
              score.textContent = `${got.filter(Boolean).length} of ${EX.length} matched`;  // updates the count of matched examples
            } }, name));  // closes the click handler; the button's text is the idea's name
            const b = h('div', { class: 'oorow', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0, 1fr)' } : {} }, h('div', { class: 'small' }, txt), h('div', { class: 'oobtns' }, ...btns));  // the row itself: the example text beside the buttons; the buttons go underneath on a phone
            return b;  // gives the row back to the list
          });  // ends the list of rows
          score.textContent = `0 of ${EX.length} matched`;  // starting score: 0 matched
          panel.append(h('div', { class: 'split fill', style: { gap: '16px', gridTemplateColumns: '320px minmax(0, 1fr)' } },  // lays out the tab: idea cards on the left, example rows on the right
            h('div', { class: 'stack', style: { gap: '7px' } },  // the left column
              ...C.map(([n, d]) => h('div', { class: 'card tight small', html: `<b>${n}.</b> ${d}` })), fb),  // one small card per idea with its definition, then the feedback note
            h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { justifyContent: 'space-between' } }, h('span', { class: 'small', html: 'Windows is written in C, yet it is built on these four ideas. Match each example.' }), score), ...rows)));  // the right column: a heading row with instructions and the score, then the six example rows
        }  // ends tabOO()
        /* ---- tab 3: sort kernel objects into control and dispatcher objects ---- */
        function tabKobj(panel) {  // tabKobj(panel): builds tab 3, sorting kernel objects into control and dispatcher objects
          const K = [  // K: ten kernel objects as [name, 0 = control or 1 = dispatcher, what it does, and a flag for "in both families"]
            ['Asynchronous procedure call (APC)', 0, 'breaks into one particular thread and makes it run a given procedure'],  // control object: asynchronous procedure call, which makes one thread run a given procedure
            ['Event', 1, 'records that something happened; threads wait until it is signaled'],  // dispatcher object: event, which threads wait on until it is signaled
            ['Deferred procedure call (DPC)', 0, 'postpones the less urgent part of interrupt handling so hardware interrupts are not held up'],  // control object: deferred procedure call, which postpones the less urgent part of interrupt handling
            ['Mutex', 1, 'lets one thread at a time own it; the others wait'],  // dispatcher object: mutex, owned by one thread at a time
            ['Interrupt object', 0, 'connects an interrupt source to its interrupt service routine'],  // control object: interrupt object, which links an interrupt source to its service routine
            ['Semaphore', 1, 'counts how many threads may pass; a thread waits while the count is zero'],  // dispatcher object: semaphore, a counter threads wait on while it is zero
            ['Process (kernel process object)', 0, 'describes one process to the kernel: its address space and the list of its threads', true],  // control object that is also waitable: the kernel process object, flagged as belonging to both families
            ['Timer', 1, 'becomes signaled when a set time arrives'],  // dispatcher object: timer, signaled when a set time arrives
            ['Profile object', 0, 'measures where a block of code spends its running time'],  // control object: profile object, which measures where code spends its time
            ['Thread', 1, 'becomes signaled when the thread ends, so others can wait for it to finish'],  // dispatcher object: thread, signaled when the thread ends
          ];  // closes the K list
          let i = 0, fresh = -1; const done = [[], []]; let misses = 0;  // i: which object is being sorted; fresh: the one just sorted (so it fades in); done: each bucket's contents; misses: wrong tries
          const card = h('div', { class: 'card white stack', style: { gap: '10px' } });  // card: the question card for the current object
          const note = h('div', { class: 'callout m0 small', 'data-label': 'The rule', html: '<b><span class="t">Dispatcher objects</span></b> are used for synchronization: a thread can wait on one, and each is either signaled or not. <b><span class="t">Control objects</span></b> are used to control how the kernel itself operates.' });  // note: the rule note under the card; it also shows feedback after each pick
          const bk = [h('div', { class: 'bucket' }), h('div', { class: 'bucket' })];  // bk: the two buckets, control objects and dispatcher objects
          function paint() {  // paint(): redraws both buckets and the question card; runs at the start and after every pick
            bk.forEach((b, j) => { b.innerHTML = `<div class="b">${j ? 'Dispatcher objects' : 'Control objects'}</div>` + (done[j].map((k) => `<div class="bitem${k === fresh ? ' fade-in' : ''}"><b>${K[k][0]}</b>${K[k][3] ? ' <span class="chip warn">in both families</span>' : ''}: ${K[k][2]}</div>`).join('') || '<div class="xs muted">nothing sorted here yet</div>'); });  // fills each bucket with its title and sorted objects, marking the process object "in both families"
            if (i >= K.length) { card.innerHTML = `<h3>All ten sorted${misses ? ` (${misses} wrong tr${misses > 1 ? 'ies' : 'y'} along the way)` : ', no mistakes'}.</h3><p class="small m0">Control objects steer the kernel: they break into threads (APC), defer interrupt work (DPC), connect interrupts, describe a process to the kernel, or profile code. Dispatcher objects are the ones threads wait on. The process object belongs to both families.</p>`; card.append(h('button', { class: 'btn sm', onclick: () => { i = 0; misses = 0; done[0].length = 0; done[1].length = 0; paint(); } }, '↺ Sort again')); return; }  // after the last object: a summary card with the number of misses and a "Sort again" button that resets
            const [name] = K[i];  // name of the current object
            card.replaceChildren(h('div', { class: 'xs b muted' }, `OBJECT ${i + 1} OF ${K.length}`), h('h3', { class: 'm0' }, name), h('p', { class: 'small m0 muted' }, 'Is it a control object or a dispatcher object?'),  // question card: which object this is, its name, the question, and two answer buttons
              h('div', { class: 'row' }, h('button', { class: 'btn os', onclick: () => pick(0) }, 'Control object'), h('button', { class: 'btn thread', onclick: () => pick(1) }, 'Dispatcher object')));  // the row with the "Control object" and "Dispatcher object" buttons
          }  // ends paint()
          function pick(j) {  // pick(j): the student sorts the current object into bucket j (0 = control, 1 = dispatcher)
            const [name, ans, what] = K[i];  // the object's name, right bucket and description
            fresh = -1;  // clears the fade-in mark from the previous pick
            if (K[i][3]) { // the process object is listed in BOTH families, so either answer is accepted
              done[j].push(i); fresh = i; i++; note.className = 'callout m0 small tip'; note.setAttribute('data-label', 'Both are right');  // the process object: either answer is accepted; it goes into the chosen bucket and the next object comes up
              note.innerHTML = `The <b>process object</b> ${what}, so it is listed among the control objects. Threads can also wait for a process to end, so it is a dispatcher object too: the one object in both families.`; }  // explains why the process object belongs to both families
            else if (j === ans) { done[ans].push(i); fresh = i; i++; note.className = 'callout m0 small tip'; note.setAttribute('data-label', 'Right'); note.innerHTML = `<b>${name}</b> ${what}.`; }  // right bucket: sort it, move on, and confirm with a green note
            else { misses++; note.className = 'callout m0 small warn'; note.setAttribute('data-label', 'Not quite'); note.innerHTML = `A ${name.toLowerCase().replace(/ \(.*\)/, '')} ${what}. ${ans ? 'Threads can wait on it, so it is a dispatcher object.' : 'It is used to control the kernel\'s own work, not to synchronize threads, so it is a control object.'}`; }  // wrong bucket: count a miss and explain which family it belongs to and why
            paint();  // redraws the buckets and the next question
          }  // ends pick()
          panel.append(h('div', { class: 'split l fill', style: { gap: '16px' } }, h('div', { class: 'stack', style: { gap: '10px' } }, h('p', { class: 'small m0', html: 'Underneath the executive\'s objects the kernel keeps its own, simpler <b>kernel objects</b> (an executive event, for example, is built around a kernel event). They come in two families. Sort each one.' }), card, note), h('div', { class: 'grid-2', style: { gap: '10px' } }, ...bk)));  // lays out the tab: intro, question card and note on the left, the two buckets on the right
          paint();  // draws the first question
        }  // ends tabKobj()
        el.append(ctx.ui.tabs([  // puts the guide's tab strip on the step; each tab builds its content when it is opened
          { label: '1 · Handles, names and security', render: tabHandles },  // tab 1: two processes share objects through handles, names and security checks
          { label: '2 · Four object-oriented ideas', render: tabOO },  // tab 2: match Windows examples to the four object-oriented ideas
          { label: '3 · Kernel objects: control vs dispatcher', render: tabKobj },  // tab 3: sort kernel objects into control objects and dispatcher objects
        ]));  // closes the tab list and the tabs call
      },  // ends render() for step 7
    },  // ends step 7

    /* ---------------- 8. Recap ---------------- */
    {  // step 8 starts here
      title: 'Recap: Windows on one page',  // step title shown as the heading of step 8
      kind: 'recap',  // kind "recap" marks this step as a summary
      render(el, ctx) {  // render(el, ctx): builds the recap cards when step 8 opens
        const { h } = ctx;  // takes the helper h, which makes HTML elements
        el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // a full-height column holding the instruction, the flip cards and the two warnings
          h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // instruction: say each answer out loud before flipping the card, which helps it stick
          ctx.ui.flipcards([  // the guide's flip cards: the front shows a topic, a click turns it over to show the summary
            ['The two halves of Windows', '<b>User mode:</b> special system processes, service processes, environment subsystems, user applications. <b>Kernel mode:</b> executive, kernel, HAL, device drivers, windowing and graphics.'],  // card: the two halves of Windows and what runs in each
            ['The executive\'s ten managers', 'I/O, cache, object, plug and play, power, security reference monitor, virtual memory, process/thread, configuration, and the ALPC facility. One job each.'],  // card: the executive's ten managers
            ['Kernel versus HAL', '<b>Kernel:</b> thread scheduling, process switching, exceptions and interrupts, multiprocessor sync; its code does not run in threads. <b>HAL:</b> turns generic hardware commands into one platform\'s commands.'],  // card: the kernel's jobs compared with the HAL's job
            ['Client/server inside Windows', 'Client stubs turn calls into messages (ALPC locally, RPC in general) for servers such as subsystems and services. Pay-offs: simpler executive, reliability, one uniform way to ask, ready for distribution.'],  // card: client/server inside Windows and its four pay-offs
            ['Threads and SMP', 'Any OS routine can run on any processor, several at once. Threads of one process run on different processors at the same time. Servers use many threads for many clients.'],  // card: threads and SMP
            ['Windows objects', 'Created and tracked by the object manager, used through per-process handles, guarded by security descriptors (checked at open). Named: open by name. Unnamed: pass the handle. Kernel objects: control or dispatcher.'],  // card: Windows objects, handles, security descriptors, named and unnamed objects, kernel objects
          ].map(([f, bk]) => [f, '<div>' + bk + '</div>']), { cols: 3, height: 168 }),  // wraps each back face in its own block; cards are laid out three per row, 168 pixels tall
          h('div', { class: 'grid-2', style: { gap: '12px' } },  // a two-column row for the common mistakes
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"The HAL is just another device driver." No: a driver operates one device; the HAL hides the <b>whole platform</b> (bus, DMA controller, interrupt controller, timers) from the kernel and the drivers.' }),  // common mistake: calling the HAL a driver, when it hides the whole platform rather than one device
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"Windows is a microkernel." Not a pure one: it borrows the client/server idea, but the executive and even windowing and graphics run in kernel mode, for speed.' }))));  // common mistake: calling Windows a microkernel, when its executive and graphics run in kernel mode
      },  // ends render() for step 8
    },  // ends step 8

    /* ---------------- 9. Check yourself ---------------- */
    {  // step 9 starts here
      title: 'Check yourself: Microsoft Windows',  // step title shown as the heading of step 9
      kind: 'check',  // kind "check" marks this step as the self-test
      quiz: [  // quiz: the questions the guide's quiz engine shows one at a time, with checking and explanations
        { q: 'Which part of Windows turns generic hardware requests, such as "acknowledge this interrupt", into the exact commands one particular platform needs?',  // question 1 (multiple choice): which part turns generic hardware requests into platform commands
          choices: ['A device driver', 'The hardware abstraction layer (HAL)', 'The kernel', 'The I/O manager'], answer: 1,  // choices: a device driver, the HAL (right, index 1), the kernel, the I/O manager
          feedback: ['A driver operates one kind of device. The platform wiring around the processor (interrupt controller, timers, bus, DMA) is hidden by a different layer.', null, 'The kernel issues generic requests such as "acknowledge interrupt"; it relies on another layer to carry them out on the actual platform.', 'The I/O manager routes I/O requests to drivers; it never talks to the platform hardware itself.'],  // feedback for each wrong choice, explaining why it is not the layer that hides the platform
          why: 'The HAL maps generic hardware commands onto platform-specific ones, so the kernel and drivers barely change from one kind of machine to another.' },  // explanation shown after answering: the HAL maps generic commands onto platform ones
        { type: 'match', q: 'Match each executive component to its job.',  // question 2 (match): pair five executive managers with their jobs
          pairs: [['I/O manager', 'Packs requests into I/O request packets and passes them to drivers'], ['Cache manager', 'Keeps recently used file data in main memory'], ['Security reference monitor', 'Checks access rights against an object\'s security descriptor'], ['Configuration manager', 'Implements and manages the registry'], ['Plug-and-play manager', 'Detects new devices and loads their drivers']],  // the five pairs: I/O, cache, security reference monitor, configuration, plug and play
          why: 'Each executive manager owns exactly one job, which keeps the executive modular: changing one manager leaves the others untouched.' },  // explanation: one job per manager keeps the executive modular
        { q: 'Which statement about the history of Windows is accurate?',  // question 3 (multiple choice): which statement about Windows history is accurate
          choices: ['Windows 10 is built on the Windows NT design that first shipped in 1993.', 'Windows 10 still runs on top of MS-DOS, like Windows 95 did.', 'Windows XP was the last release built on NT.', 'Windows NT was written for Intel processors only, so moving to ARM required a new OS.'], answer: 0,  // choices: Windows 10 is built on NT (right), still on MS-DOS, XP was the last NT, NT was Intel-only
          feedback: [null, 'The MS-DOS-based line ended with Windows Me; since Windows XP every Windows PC has run NT underneath.', 'XP was the first NT release for home users, not the last; Vista, 7, 8, 10 and 11 all continued the NT line.', 'NT was designed to be portable from the start (it first ran on several processor families), and the HAL is part of what made the ARM move practical.'],  // feedback for each wrong choice: the MS-DOS line ended with Me, XP was the first home NT, NT was portable
          why: 'Every modern Windows, desktop and server, descends from Windows NT, a portable, modular design started from scratch in the early 1990s.' },  // explanation: every modern Windows descends from NT
        { type: 'bucket', q: 'Does each part run in user mode or in kernel mode?', buckets: ['User mode', 'Kernel mode'],  // question 4 (sort into groups): which parts run in user mode and which in kernel mode
          items: [['Session manager', 0], ['Print spooler service', 0], ['Win32 subsystem DLLs', 0], ['Logon process', 0], ['Object manager', 1], ['Hardware abstraction layer', 1], ['ALPC facility', 1], ['Device drivers', 1]],  // items: four user-mode parts (session manager, spooler, subsystem DLLs, logon) and four kernel-mode parts
          why: 'Special system processes, service processes, environment subsystems and their DLLs, and applications run in user mode. The executive (including the object manager and ALPC), the kernel, the HAL, drivers, and windowing and graphics run in kernel mode.' },  // explanation: lists everything that runs in each mode
        { q: 'The print spooler service crashes because of a bug, but every other program and the OS itself keep running. Which advantage of the client/server model does this show best?',  // question 5 (multiple choice): a crashed spooler leaves the rest running; which advantage is this
          choices: ['It simplifies the executive', 'It improves reliability', 'It gives applications one uniform way to ask for services', 'It is a natural base for distributed computing'], answer: 1,  // choices: the four client/server advantages; improved reliability (index 1) is right
          feedback: ['True in general, but this example is about containing a failure, not about keeping the executive small.', null, 'Uniform RPC calls describe how clients ask, not what happens when a server fails.', 'Distribution is about moving a server to another machine, which did not happen here.'],  // feedback for each wrong choice: explains which situation each other advantage is really about
          why: 'Each server runs as its own process with its own memory, so a failure stays inside that server. The service control manager can even restart it.' },  // explanation: each server has its own memory, so a failure stays inside it and it can be restarted
        { type: 'order', q: 'Put the path of a file-open request in order.',  // question 6 (put in order): the path of a file-open request
          items: ['The application calls CreateFile', 'A subsystem DLL calls the native service in ntdll.dll', 'A system call switches the processor into kernel mode', 'The I/O manager sends an I/O request packet to the file system driver', 'The disk driver sets up the transfer using HAL routines', 'The disk controller finishes and raises an interrupt'],  // six steps from the CreateFile call down to the disk controller's interrupt
          why: 'The request moves down the layers: application, subsystem DLL, system call, executive (I/O manager), drivers, HAL, hardware. The interrupt at the end is how the hardware reports back.' },  // explanation: the request moves down the layers, and the interrupt is how the hardware reports back
        { type: 'num', q: 'A process has 4 threads. Each needs 6 ms of processor time and never waits for I/O. On a 4-processor machine running Windows, what is the shortest time until all four threads have finished?', answer: 6, tol: 0, unit: 'ms',  // question 7 (calculate): four 6 ms threads on four processors finish after 6 ms
          why: 'Windows lets the threads of one process run on different processors at the same time, so all four run side by side and finish after 6 ms. If only one thread at a time were allowed, it would take 4 × 6 = 24 ms.' },  // explanation: the threads run side by side; one at a time would take 24 ms
        { type: 'multi', q: 'Which statements about Windows on a symmetric multiprocessor are true?',  // question 8 (select all): which statements about Windows on an SMP are true
          choices: ['Any OS routine can run on any available processor.', 'Two threads of the same process can run on different processors at the same moment.', 'All kernel-mode code runs on processor 0 only.', 'A server process can use several threads to serve several clients at once.', 'The kernel\'s own code runs in threads, just like the rest of the OS.'], answer: [0, 1, 3],  // five statements; the first, second and fourth are true
          why: 'Windows treats processors as equals: OS routines, and threads of the same process, can run anywhere and at the same time, and servers use many threads for many clients. The kernel is the exception to "everything runs in threads": its own code does not.' },  // explanation: processors are equals, threads run anywhere at once, but the kernel's own code is not threads
        { type: 'num', q: 'Process A creates a named event and gets a handle to it. Processes B and C then open the same event by name. Next, A and B close their handles. How many handles still refer to the event?', answer: 1, tol: 0, unit: 'handles',  // question 9 (calculate): three handles opened and two closed leave one handle to the event
          why: 'Three handles were opened (A, B, C) and two were closed, leaving C\'s. The object manager keeps the event alive until the last handle closes, then deletes it.' },  // explanation: C's handle remains, and the event is deleted only when the last handle closes
        { q: 'Process B wants a handle to an event that process A created. In which case can B <b>not</b> get it by asking the object manager for it by name?',  // question 10 (multiple choice): when B cannot open A's event by name
          choices: ['A created the event without a name', 'The event\'s security descriptor lets B\'s user wait on it', 'A still holds its own handle to the event', 'A and B run on different processors'], answer: 0,  // choices: an unnamed event (right), a permissive descriptor, A still holding a handle, different processors
          feedback: [null, 'Permission is exactly what B needs; the security reference monitor would allow the open.', 'A holding a handle keeps the event alive, which helps B rather than stopping it.', 'Processors do not matter: objects live in kernel memory shared by all processors.'],  // feedback for each wrong choice: explains why that situation does not stop B
          why: 'Only a named object appears in the object manager\'s namespace. An unnamed object can reach another process only if a handle is passed on, for example by duplication or inheritance.' },  // explanation: only named objects are in the namespace; unnamed ones need a passed-on handle
        { type: 'bucket', q: 'Sort these kernel objects.', buckets: ['Control objects', 'Dispatcher objects'],  // question 11 (sort into groups): kernel objects into control and dispatcher objects
          items: [['Asynchronous procedure call (APC)', 0], ['Deferred procedure call (DPC)', 0], ['Interrupt object', 0], ['Profile object', 0], ['Event', 1], ['Mutex', 1], ['Semaphore', 1], ['Timer', 1]],  // items: APC, DPC, interrupt and profile are control objects; event, mutex, semaphore and timer are dispatcher
          why: 'Control objects steer the kernel\'s own operation (APC, DPC, interrupt, process, profile). Dispatcher objects are used for synchronization: threads wait on them until they become signaled.' },  // explanation: control objects steer the kernel, dispatcher objects are waited on by threads
        { type: 'match', q: 'Match each object-oriented idea to its Windows example.',  // question 12 (match): pair the four object-oriented ideas with Windows examples
          pairs: [['Encapsulation', 'Programs reach an object only through a handle and its operations'], ['Class and instance', 'Every opened file is a new object of the File type'], ['Inheritance', 'Mutex, event and semaphore objects share a common header and its code'], ['Polymorphism', 'One wait function works on processes, threads, events and timers']],  // the four pairs: encapsulation, class and instance, inheritance, polymorphism
          why: 'Windows is written in C, but its design uses all four ideas; inheritance appears only inside the implementation.' },  // explanation: Windows is written in C but uses all four ideas, inheritance only inside
      ],  // closes the quiz list
    },  // ends step 9

  ],  // closes the steps list

  notes: `${/* notes: a written summary of the whole section, shown in the guide's notes panel */''}
<h3>Microsoft Windows: one design, many machines</h3>${/* notes heading: one design for many machines */''}
<p>Windows runs on tablets, laptops, desktops, consoles and servers with 100+ processors, all on one core design, <b>Windows NT</b>, built from scratch in the early 1990s as a modular, portable, multitasking OS with security and multiprocessor support.</p>${/* notes paragraph: Windows runs everywhere on one core design, Windows NT */''}
<h4>1. Background</h4>${/* notes heading for part 1, background */''}
<p>Early Windows (1.0 to 3.x, 95, 98, Me) ran on top of MS-DOS. NT was a fresh design: <b>NT 3.1</b> (1993) was 32-bit with preemptive multitasking and protected memory, written mostly in C for portability. <b>NT 4.0</b> (1996) moved windowing and graphics into kernel mode for speed. <b>2000</b> added plug and play and power management. <b>XP</b> (2001) brought NT to home users and ended the MS-DOS line. <b>Vista</b> (2007) was an internal overhaul (ALPC replaced LPC). <b>7</b> (2009) scaled to many more processors. <b>8</b> (2012) added touch and ARM support. <b>10</b> (2015): one core for PCs, tablets, phones, Xbox and small devices; Windows Server shares it. <b>11</b> (2021) continues on the same NT core.</p>${/* notes paragraph: the release history from MS-DOS days through NT 3.1 to Windows 11 */''}
<h4>2. Architecture</h4>${/* notes heading for part 2, architecture */''}
<p>Windows is highly <b>modular</b>. User programs cross into kernel mode only through system calls. <b>Kernel-mode components:</b></p>${/* notes paragraph: Windows is modular and user programs enter kernel mode only by system calls */''}
<ul>${/* start of the list of kernel-mode components */''}
<li><b>Executive:</b> core OS services, organised as managers (below).</li>${/* list item: the executive */''}
<li><b>Kernel:</b> thread scheduling, process switching, exception and interrupt handling, multiprocessor synchronization. Unlike the rest of the OS, the kernel's own code does not run in threads.</li>${/* list item: the kernel and its four jobs */''}
<li><b>Hardware abstraction layer (HAL):</b> maps generic hardware commands onto those of one specific platform, isolating the OS from differences in the system bus, DMA controller, interrupt controller and timers. It hides the platform wiring, not the processor: a new processor family (e.g. ARM) also needs recompiling and a small processor-specific part of the kernel.</li>${/* list item: the HAL, and why a new processor family still needs recompiling */''}
<li><b>Device drivers:</b> loadable modules that operate devices or implement file systems; a buggy one can crash the system.</li>${/* list item: device drivers */''}
<li><b>Windowing and graphics system:</b> windows, menus, input focus, drawing.</li>${/* list item: the windowing and graphics system */''}
</ul>${/* end of the kernel-mode component list */''}
<table>${/* start of the table of executive managers */''}
<tr><th>Executive manager</th><th>Job</th></tr>${/* table header row: manager and job */''}
<tr><td>I/O manager</td><td>One interface to all devices; sends I/O request packets (IRPs) to drivers</td></tr>${/* table row: I/O manager */''}
<tr><td>Cache manager</td><td>Keeps recently used file data in main memory</td></tr>${/* table row: cache manager */''}
<tr><td>Object manager</td><td>Creates, names, tracks, deletes objects; hands out handles</td></tr>${/* table row: object manager */''}
<tr><td>Plug-and-play manager</td><td>Detects devices, loads their drivers</td></tr>${/* table row: plug-and-play manager */''}
<tr><td>Power manager</td><td>Sleep, hibernate, powering down idle devices</td></tr>${/* table row: power manager */''}
<tr><td>Security reference monitor</td><td>Checks access against security descriptors</td></tr>${/* table row: security reference monitor */''}
<tr><td>Virtual memory manager</td><td>Maps virtual to physical memory; pages to and from disk</td></tr>${/* table row: virtual memory manager */''}
<tr><td>Process/thread manager</td><td>Creates and deletes processes and threads</td></tr>${/* table row: process/thread manager */''}
<tr><td>Configuration manager</td><td>Implements the registry</td></tr>${/* table row: configuration manager */''}
<tr><td>ALPC facility</td><td>Fast message passing between local processes</td></tr>${/* table row: ALPC facility */''}
</table>${/* end of the manager table */''}
<p><b>User-mode processes:</b> <b>special system processes</b> (session manager, logon process, authentication subsystem, service control manager); <b>service processes</b> (printer spooler, event logger); <b>environment subsystems</b> that give programs an OS personality (Win32 is the main one), whose <b>subsystem DLLs</b> translate API calls into native system calls; and <b>user applications</b> (EXEs and DLLs).</p>${/* notes paragraph: the four kinds of user-mode processes */''}
<p><b>A file-open request:</b> app calls CreateFile → subsystem DLL calls NtCreateFile in ntdll.dll → system call enters kernel mode → I/O manager asks the object manager to resolve the name → I/O manager creates a file object and sends an IRP to the file system driver → if the file's information is not in memory, the disk driver reads it, using HAL routines (e.g. for DMA) → controller transfers data and interrupts; the driver queues a DPC to finish and the kernel wakes the waiting thread → the file system driver has the security reference monitor check the file's security descriptor → the app receives a handle.</p>${/* notes paragraph: the file-open request traced hop by hop, as in step 2 */''}
<h4>3. Client/server model</h4>${/* notes heading for part 3, the client/server model */''}
<p>Many services run as <b>servers</b> in their own processes (environment subsystems, services); applications are their <b>clients</b>. A client sends a request message; the server does the work and replies. Locally, messages travel through the executive's ALPC facility to the server's <b>port</b>. Windows is not a pure microkernel: the executive stays in kernel mode for speed. Advantages:</p>${/* notes paragraph: servers, clients, ports and ALPC, and why Windows is not a pure microkernel */''}
<ol>${/* start of the numbered list of advantages */''}
<li><b>Simplifies the executive:</b> new APIs and services are added as servers without changing it.</li>${/* advantage 1: a simpler executive */''}
<li><b>Improves reliability:</b> each server is its own process, so a crash is contained (and the service can be restarted).</li>${/* advantage 2: better reliability */''}
<li><b>Uniform communication:</b> applications reach every service the same way, through remote procedure calls (RPCs). A small <b>stub</b> in the client packs each call's parameters into a message, so the call looks like an ordinary function call.</li>${/* advantage 3: one uniform way to ask, through remote procedure calls and stubs */''}
<li><b>Base for distributed computing:</b> a server can move to another machine while clients make the same calls.</li>${/* advantage 4: a base for distributed computing */''}
</ol>${/* end of the advantage list */''}
<h4>4. Threads and SMP</h4>${/* notes heading for part 4, threads and SMP */''}
<p>On a symmetric multiprocessor, any OS routine can run on any available processor, and different routines can run on different processors at once. Threads of one process can run on different processors simultaneously. Server processes can use several threads to serve several clients at once. Processes share data and resources through flexible IPC.</p>${/* notes paragraph: how Windows uses every processor of a symmetric multiprocessor */''}
<p><b>Worked example:</b> 21 units of work on 4 cores finish at time 6 under Windows' rules (lower bound 21 ÷ 4 = 5.25), with cores 21 ÷ 24 ≈ 88% busy. Forcing OS routines onto core 0 (a master/slave design) gives 8; making a process's threads take turns gives 9; both give 11. With 1 or 2 cores all rules tie. Four 6 ms threads on 4 processors finish in 6 ms, but would need 24 ms one at a time.</p>${/* notes paragraph: the worked example from step 6, with finish times under each rule */''}
<h4>5. Windows objects</h4>${/* notes heading for part 5, Windows objects */''}
<p>Windows is written in C but uses four object-oriented ideas: <b>encapsulation</b> (data hidden; only operations visible), <b>object class and instance</b> (each object type is a template; every opened file is a new File object), <b>inheritance</b> (only inside the implementation, e.g. objects sharing a common header), and <b>polymorphism</b> (one wait function works on processes, threads, events and timers).</p>${/* notes paragraph: the four object-oriented ideas in Windows */''}
<p>Windows uses objects for data that user mode must reach, or that is shared or protected. The <b>object manager</b> creates and tracks all objects; it keeps each object's header (name, security descriptor, handle count), while the body holds type-specific data. Programs use them through <b>handles</b>, indexes into a per-process handle table, so one number can mean different objects in two processes. A <b>security descriptor</b> records who may do what; the security reference monitor checks it when a handle is opened, and the rights granted are stored with the handle. <b>Named</b> objects can be opened by name by any permitted process. <b>Unnamed</b> ones are shared only by passing handles on (duplication or inheritance). An object is deleted when its last handle closes. For example, if A, B and C hold handles and A and B close theirs, 1 remains.</p>${/* notes paragraph: the object manager, handles, security descriptors, named and unnamed objects */''}
<p><b>Kernel objects</b> sit underneath executive objects (an executive event is built around a kernel event). <b>Control objects</b> control the kernel: asynchronous procedure call (interrupts a thread to run a procedure), deferred procedure call (postpones interrupt work), interrupt (links a source to its service routine), process, profile (measures where code spends time). <b>Dispatcher objects</b> are used for synchronization: each is signaled or not, and threads wait on them (event, mutex, semaphore, timer, thread). The process object is in both lists, since threads can wait for a process to end.</p>${/* notes paragraph: kernel objects, control versus dispatcher */''}
<p><b>Common mistakes:</b> the HAL is not a device driver; the kernel is not the executive; Windows is not a pure microkernel.</p>`,  // last notes paragraph: three common mistakes; the backtick after it ends the notes text
});  // closes the section object and the Guide.section call
