// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 2.4 — Developments Leading to Modern Operating Systems
   Original teaching material. Built step by step. */
Guide.section({  // registers this section with the guide; the object below holds everything the section shows
  id: '2.4',  // the section number, used in links, the progress list and saved progress
  title: 'Developments Leading to Modern Operating Systems',  // the full title shown at the top of every step
  short: 'Modern OS developments',  // the short name used in the side menu and progress list
  summary: 'Why OSs changed, and five answers: microkernels, threads, SMP, distributed OSs and object design.',  // one-sentence summary shown on the chapter page
  objectives: [  // what the student should be able to do after this section, shown on its first page
    'Name the three forces (new hardware, new applications, new security threats) that pushed operating systems to change.',  // objective 1: the three forces that pushed operating systems to change
    'Contrast a monolithic kernel with a microkernel, and explain why a microkernel is simpler, more flexible and suited to distributed systems.',  // objective 2: monolithic kernel versus microkernel
    'Define thread and process, explain when multithreading helps, and explain why a thread switch is cheaper than a process switch.',  // objective 3: threads, processes, and why a thread switch is cheaper
    'Describe symmetric multiprocessing (SMP), its four potential advantages, and the difference between multiprogramming and multiprocessing.',  // objective 4: symmetric multiprocessing and its advantages
    'Explain what a distributed operating system and object-oriented design add to an operating system.',  // objective 5: distributed operating systems and object-oriented design
  ],  // closes the objectives list
  terms: [  // key terms for the glossary, each written as [term, definition]
    ['Monolithic kernel', 'A kernel design in which almost the whole operating system (scheduling, file systems, networking, device drivers, memory management and more) runs together in kernel mode in one shared kernel address space, so its parts call one another directly instead of sending messages. The word describes how the kernel is built, not a single process: kernel code runs on behalf of whichever process made a system call, and in kernel threads and interrupt handlers.'],  // glossary entry: monolithic kernel
    ['Microkernel', 'A small kernel that keeps only the essential core functions (address spaces, interprocess communication and basic scheduling) and leaves every other OS service to server processes that run in user mode.'],  // glossary entry: microkernel
    ['Address space', 'The range of memory addresses a process is allowed to use. The hardware, set up by the kernel, keeps each process inside its own address space, so one process cannot read or damage another\'s memory.'],  // glossary entry: address space
    ['Interprocess communication (IPC)', 'Any mechanism that lets separate processes exchange data; in a microkernel it is the kernel delivering messages from one process to another.'],  // glossary entry: interprocess communication (IPC)
    ['Server process', 'In a microkernel system, an OS service such as a file system or a device driver that runs as an ordinary user-mode process and does its work when request messages arrive.'],  // glossary entry: server process
    ['Client/server computing', 'Organising work so that client programs send requests to server programs, often on other machines, which do the work and send back replies.'],  // glossary entry: client/server computing
    ['Thread', 'A dispatchable unit of work inside a process. It has its own processor context (program counter and other registers) and its own stack, runs its instructions one after another, and can be interrupted so the processor can turn to another thread.'],  // glossary entry: thread
    ['Process', 'A collection of one or more threads together with the system resources they share: memory holding code and data, open files and devices. Informally, a program in execution.'],  // glossary entry: process, as a set of threads plus shared resources
    ['Multithreading', 'Dividing one process into several threads that can run concurrently, so one application can work on several independent tasks at once.'],  // glossary entry: multithreading
    ['Thread switch', 'Moving the processor from one thread to another thread of the same process. Only the processor context and the stack change, so it costs much less than a switch between processes.'],  // glossary entry: thread switch
    ['Process switch', 'Moving the processor from one process to another. Besides saving and loading registers, the OS must switch to the other process\'s address space, after which the processor\'s cached address translations and cached data no longer help. It is one kind of context switch.'],  // glossary entry: process switch
    ['Symmetric multiprocessing (SMP)', 'A computer with two or more similar processors that share main memory and I/O and can each run any work, including the OS, under one integrated operating system; the term also covers the OS behaviour that exploits such hardware.'],  // glossary entry: symmetric multiprocessing (SMP)
    ['Multiprocessing', 'Running processes on several processors, so that their execution can both take turns (interleave) and truly happen at the same instant (overlap).'],  // glossary entry: multiprocessing
    ['Incremental growth', 'Raising a system\'s performance by adding a part, such as one more processor, instead of replacing the whole machine.'],  // glossary entry: incremental growth
    ['Scaling', 'Offering a family of machines that run the same software but differ in price and performance, for example by the number of processors they contain.'],  // glossary entry: scaling
    ['Cluster', 'A group of interconnected, complete computers that work together as one unified computing resource.'],  // glossary entry: cluster
    ['Distributed operating system', 'An operating system for a cluster of networked computers that gives the illusion of one single main memory and one single secondary-memory space, plus unified services such as a distributed file system.'],  // glossary entry: distributed operating system
    ['Distributed file system', 'A file system spread over several machines that users see as one ordinary tree of files and folders, without needing to know which machine stores each file.'],  // glossary entry: distributed file system
    ['Object-oriented design', 'Building software from objects: self-contained modules that hide their inner data and are used only through defined interfaces. In an OS it gives a disciplined way to add modular extensions to a small kernel.'],  // glossary entry: object-oriented design
  ],  // closes the terms list

  css: ` /* css: the style rules for this section only, written as one text block that the guide adds to the page */
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width and the page scrolls sideways */
    .sec-2-4 .step-eyebrow { contain: inline-size; } /* stops the one-line step label above the title from forcing the whole page wider on a small screen */
    .sec-2-4 .xs-card { font-size: 13.5px; line-height: 1.35; padding: 7px 10px; } /* a compact card with slightly smaller text, used for the two short pros-and-cons notes in step 2 */
    .sec-2-4 .ok-t { color: var(--ok); font-weight: 700; } /* green bold text for good news, such as "still running" */
    .sec-2-4 .bad-t { color: var(--bad); font-weight: 800; } /* red bold text for bad news, such as "crashed" */
    .sec-2-4 .player-cap { min-height: 66px; } /* keeps every animation caption at least 66 pixels tall so the controls below do not jump */
    /* step 3: kernel builder */
    .sec-2-4 .zone { border: 2px solid var(--line-2); border-radius: 12px; padding: 7px 10px 10px; display: flex; flex-direction: column; gap: 6px; min-height: 148px; transition: background .25s, border-color .25s; } /* a zone of the kernel builder (user space or kernel space): a rounded box whose colour can change smoothly */
    .sec-2-4 .zone.user { background: var(--panel-2); border-style: dashed; } /* the user-space zone: light grey with a dashed border, because nothing in it is privileged */
    .sec-2-4 .zone.kern { background: var(--os-bg); border-color: var(--os); } /* the kernel-space zone: tinted and outlined in the OS colour, because everything in it is privileged */
    .sec-2-4 .zone.kern.panic { background: var(--bad-bg); border-color: var(--bad); } /* after a kernel crash the kernel zone turns red to show that the whole system stopped */
    .sec-2-4 .zone-lbl { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); } /* the zone's label row: small capital letters, with the zone name on the left and a note on the right */
    .sec-2-4 .zone-lbl .zl-note { text-transform: none; letter-spacing: 0; font-weight: 650; } /* the note in the label row keeps normal letters and spacing */
    .sec-2-4 .zone.kern .zone-lbl { color: var(--os); } /* the kernel zone's label is drawn in the OS colour */
    .sec-2-4 .zone.kern.panic .zone-lbl { color: var(--bad); } /* after a kernel crash the kernel zone's label turns red */
    .sec-2-4 .tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; } /* the service tiles inside a zone, laid out four across */
    .sec-2-4 .svc { display: flex; flex-direction: column; justify-content: center; gap: 1px; min-height: 50px; padding: 5px 9px; border: 2px solid var(--os); border-radius: 10px; background: var(--panel); color: var(--ink); text-align: left; font: inherit; cursor: pointer; line-height: 1.25; transition: opacity .2s, transform .08s; } /* a service tile: a clickable card with a name and a short line beneath, outlined in the OS colour */
    .sec-2-4 button.svc:hover { box-shadow: 0 0 0 2px color-mix(in srgb, var(--os) 40%, transparent); } /* hovering a service tile adds a soft glow to show it can be clicked */
    .sec-2-4 button.svc:active { transform: translateY(1px); } /* pressing a service tile nudges it down one pixel, like a real button */
    .sec-2-4 .svc b { font-size: 14.5px; } /* the service's name in bold */
    .sec-2-4 .svc > span { font-size: 12.5px; color: var(--muted); } /* the service's short description in small grey text */
    .sec-2-4 .svc.srv { border-style: dashed; background: var(--os-bg); } /* a service running as a user-mode server gets a dashed border and a tinted background */
    .sec-2-4 .svc.core { cursor: help; } /* core services show a question-mark pointer, because clicking them explains why they cannot move */
    .sec-2-4 .svc .lock { font-style: normal; font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--os); border: 1px solid var(--os); border-radius: 5px; padding: 0 4px; margin-right: 3px; vertical-align: 1px; } /* the small "core" badge on a core service: tiny capitals in a thin OS-coloured frame */
    .sec-2-4 .svc.core { border-width: 3px; } /* core services also get a thicker border to stand out */
    .sec-2-4 .svc.app { border-color: var(--proc); background: var(--proc-bg); cursor: default; } /* the two application tiles (editor and browser) use the process colour and are not clickable */
    .sec-2-4 .svc.dead { border-color: var(--bad); background: var(--bad-bg); border-style: solid; } /* a crashed tile turns red with a solid border */
    .sec-2-4 .svc.down { opacity: .45; } /* after a kernel crash every other tile fades to show it has stopped too */
    .sec-2-4 .svc .st { font-size: 12.5px; } /* the status line on a tile (such as "crashed" or "v2 running") in small text */
    .sec-2-4 .hwstrip { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); } /* the strip below the zones that lists the hardware: processor, memory, disk and network card */
    .sec-2-4 .kind-name { font-size: 22px; font-weight: 800; color: var(--os); line-height: 1.2; } /* the design's name ("Monolithic kernel", "Microkernel" or "Mixed design") in large bold OS-coloured text */
    .sec-2-4 .result { min-height: 118px; } /* reserves room for the test result box so the benefits list below does not jump */
    .sec-2-4 .result .callout { font-size: 14.5px; line-height: 1.42; } /* the text inside a test result box, slightly smaller */
    .sec-2-4 .result .btn { margin-top: 6px; } /* space above the "Restart the driver server" button inside a result box */
    .sec-2-4 .benefits { display: flex; flex-direction: column; gap: 4px; } /* the list of four microkernel benefits, stacked with small gaps */
    .sec-2-4 .ben { display: grid; grid-template-columns: 22px 1fr; align-items: center; gap: 6px; padding: 4px 8px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel); font-size: 13.5px; line-height: 1.3; transition: background .25s, border-color .25s; } /* one benefit row: a tick column beside the text; it fades to green when earned */
    .sec-2-4 .ben .tick { font-weight: 900; color: var(--line-2); text-align: center; } /* the tick mark of a benefit not yet earned, drawn in a faint grey circle symbol */
    .sec-2-4 .ben.on { border-color: color-mix(in srgb, var(--ok) 55%, transparent); background: var(--ok-bg); } /* an earned benefit gets a green border and green background */
    .sec-2-4 .ben.on .tick { color: var(--ok); } /* and its tick turns green */
    /* step 4: process anatomy */
    .sec-2-4 .pgrid { display: grid; grid-template-columns: minmax(0, 3.1fr) minmax(0, 1fr); gap: 8px; } /* step 4 layout: process A's box takes about three times the width of process B's box */
    .sec-2-4 .pbox { display: flex; flex-direction: column; gap: 7px; padding: 8px 10px 10px; border: 2px solid var(--proc); border-radius: 12px; background: var(--proc-bg); min-width: 0; } /* a process box: outlined and tinted in the process colour, with its parts stacked inside */
    .sec-2-4 .pbox > b, .sec-2-4 .pbox .row > b { font-size: 15px; } /* the process name in the box's header, slightly larger */
    .sec-2-4 .shared { border-radius: 9px; padding: 6px 8px; background: color-mix(in srgb, var(--proc) 14%, var(--panel)); display: flex; flex-direction: column; gap: 5px; } /* the shaded area inside a process box that holds the resources all its threads share */
    .sec-2-4 .res-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; } /* the shared resource buttons, laid out four across */
    .sec-2-4 .res { height: 30px; border-radius: 8px; border: 1px solid var(--proc); background: var(--panel); color: var(--ink); font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer; } /* a shared resource button (Code, Data, Open files, Devices); clicking it explains the resource */
    .sec-2-4 .res:hover { background: var(--proc-bg); } /* hovering a resource button tints it in the process colour */
    .sec-2-4 .thr-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; } /* the row of thread cards in process A, four across */
    .sec-2-4 .thr-row.one { grid-template-columns: 1fr; } /* process B has a single thread, so its row has one column */
    .sec-2-4 .thr { display: flex; flex-direction: column; gap: 2px; padding: 6px 7px; border: 2px solid var(--thread); border-radius: 10px; background: var(--thread-bg); color: var(--ink); font: inherit; text-align: left; cursor: pointer; min-width: 0; } /* a thread card: outlined and tinted in the thread colour, clickable to switch the processor to it */
    .sec-2-4 .thr b { font-size: 14px; color: var(--thread); } /* the thread's name in bold thread colour */
    .sec-2-4 .thr .chip { font-size: 11.5px; padding: 0 6px; } /* the small "running" / "ready" chip on a thread card */
    .sec-2-4 .thr.run { box-shadow: 0 0 0 3px color-mix(in srgb, var(--thread) 45%, transparent); background: var(--panel); } /* the running thread gets a glowing outline and a plain background so it stands out */
    .sec-2-4 .thr .xs { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } /* the PC and SP lines on a thread card are cut off with an ellipsis if the card is too thin */
    .sec-2-4 .stk { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 5px; } /* the stack row on a thread card: the word "stack" beside a bar */
    .sec-2-4 .stk .meter { height: 7px; } /* the stack depth bar is thin */
    .sec-2-4 .stk .meter > i { background: var(--thread); } /* and filled in the thread colour */
    .sec-2-4 .cpu-box { border: 2px solid var(--cpu); background: var(--cpu-bg); border-radius: 12px; padding: 8px 11px; display: flex; flex-direction: column; gap: 2px; font-size: 15px; } /* the processor box: outlined in the processor colour, showing which thread is running */
    .sec-2-4 .chk { border: 1px solid var(--line); background: var(--panel-2); border-radius: 12px; padding: 7px 10px; display: flex; flex-direction: column; gap: 2px; } /* the checklist box that shows what a switch costs */
    .sec-2-4 .ci { display: grid; grid-template-columns: 18px 1fr; gap: 4px; font-size: 13.5px; line-height: 1.3; } /* one checklist line: a mark column beside the text */
    .sec-2-4 .ci span { font-weight: 900; text-align: center; color: var(--muted); } /* the mark on a checklist line, grey by default */
    .sec-2-4 .ci.done span { color: var(--ok); } /* a cost that this switch had to pay gets a green tick */
    .sec-2-4 .ci.skip { opacity: .45; text-decoration: line-through; } /* a cost this switch skipped fades and is crossed out */
    /* step 5: server timeline */
    .sec-2-4 .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } /* the two score boxes in the server lab sit side by side in two equal columns */
    .sec-2-4 .kpis .big { font-size: 34px; color: var(--chc); } /* the big numbers in those score boxes, drawn large in the chapter colour */
    .sec-2-4 .lg { display: inline-flex; align-items: center; gap: 4px; } /* one legend entry under the timeline: a colour swatch beside its label */
    .sec-2-4 .sw { display: inline-block; width: 13px; height: 11px; border-radius: 3px; border: 1.5px solid; } /* a legend colour swatch: a small rounded rectangle with a border */
    .sec-2-4 .sw.run { background: var(--proc-bg); border-color: var(--proc); } /* swatch for "running": process colour */
    .sec-2-4 .sw.ovh { background: var(--warn); border-color: var(--warn); } /* swatch for "creating / switching" overhead: solid amber so the wasted time stands out */
    .sec-2-4 .sw.io { background: var(--io-bg); border-color: var(--io); } /* swatch for "waiting for disk": I/O colour */
    .sec-2-4 .sw.cpu { background: var(--cpu-bg); border-color: var(--cpu); } /* swatch in the processor colour for the processor's own row */
    .sec-2-4 .sw.q { background: var(--panel-2); border-color: var(--line-2); border-style: dashed; } /* swatch for "waiting for the CPU": grey with a dashed border, like the queue bars */
    /* step 6: SMP */
    .sec-2-4 .mode-lbl { font-size: 14.5px; display: flex; align-items: center; gap: 8px; min-height: 24px; } /* the line that names the current mode in the SMP step, kept at a fixed height so the layout does not jump */
    .sec-2-4 .tight-list li { margin: 1px 0; line-height: 1.4; } /* bullet lists that use this class sit closer together to save space */
    /* step 7: object-oriented design */
    .sec-2-4 .kcore { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 8px 12px; border: 2.5px solid var(--os); border-radius: 12px; background: var(--os-bg); } /* the small kernel core box in step 7: a thick OS-coloured frame with its name and a status on one line */
    .sec-2-4 .kcore > b { color: var(--os); font-size: 15.5px; } /* the "Small kernel core" label in bold OS colour */
    .sec-2-4 .slots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; } /* the three sockets under the kernel core, laid out three across */
    .sec-2-4 .slot { display: flex; flex-direction: column; gap: 5px; position: relative; } /* one socket: its interface label above the object plugged into it */
    .sec-2-4 .slot::before { content: ''; position: absolute; left: 50%; top: -9px; height: 9px; border-left: 2px solid var(--os); } /* a short vertical line above each socket, drawing the link up to the kernel core */
    .sec-2-4 .iface { display: flex; flex-direction: column; min-height: 44px; padding: 4px 8px; border-radius: 8px; border: 1.5px solid var(--os); background: var(--panel); line-height: 1.3; } /* the interface label of a socket (such as "File system: open · read · write") in a thin OS-coloured frame */
    .sec-2-4 .iface b { font-size: 13.5px; color: var(--os); } /* the interface name in bold OS colour */
    .sec-2-4 .obj { min-height: 40px; display: grid; place-items: center; text-align: center; padding: 4px 6px; border-radius: 9px; border: 2px dashed var(--line-2); color: var(--muted); font-size: 13.5px; font-weight: 700; line-height: 1.25; } /* the object slot in a socket: a dashed grey placeholder reading "empty socket" */
    .sec-2-4 .slot.full .obj { border-style: solid; border-color: var(--os); background: var(--os-bg); color: var(--ink); } /* once an object is plugged in, the slot turns solid and tinted in the OS colour */
    /* step 8: matching recap */
    .sec-2-4 .mprob { flex: none; display: grid; grid-template-columns: 30px minmax(0, 1fr); align-items: center; gap: 1px 10px; width: 100%; padding: 5px 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); color: var(--ink); font: inherit; font-size: 14.5px; line-height: 1.36; text-align: left; cursor: pointer; } /* a problem button in the matching recap: a number badge beside the problem text, clickable */
    .sec-2-4 .mprob:hover { border-color: var(--chc); } /* hovering a problem button outlines it in the chapter colour */
    .sec-2-4 .mprob.sel { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); } /* the problem the student has selected gets a chapter-coloured outline and tint */
    .sec-2-4 .mprob.done { border-color: color-mix(in srgb, var(--ok) 55%, transparent); background: var(--ok-bg); } /* a problem already matched correctly turns green */
    .sec-2-4 .mnum { grid-row: 1 / 3; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-weight: 800; font-size: 14px; background: var(--panel-3); color: var(--ink-2); } /* the number badge of a problem, spanning both text lines */
    .sec-2-4 .mprob.done .mnum { background: var(--ok); color: var(--panel); } /* a solved problem's badge turns solid green (it then shows a tick) */
    .sec-2-4 .mdev { justify-self: start; font-size: 12.5px; line-height: 1.4; } /* the green chip naming the matching development under a solved problem */
    .sec-2-4 .mdevbtn { flex: none; height: 42px; border-radius: 11px; border: 2px solid var(--accent); background: var(--panel); color: var(--accent); font: inherit; font-size: 15.5px; font-weight: 750; cursor: pointer; } /* a development button in the matching recap: a tall outlined button in the accent colour */
    .sec-2-4 .mdevbtn:hover { background: var(--accent-bg); } /* hovering a development button tints it */
    .sec-2-4 .mdevbtn.sel { background: var(--accent); color: var(--accent-ink); } /* the selected development button fills with the accent colour */
    .sec-2-4 .mdevbtn.done { border-color: color-mix(in srgb, var(--ok) 55%, transparent); color: var(--ok); background: var(--ok-bg); cursor: default; } /* a development whose problem has been matched turns green and can no longer be clicked */
    /* phones (narrow mode): simpler grids and the button version of the step-1 map */
    .sec-2-4 .nrw .tiles, .sec-2-4 .nrw .thr-row, .sec-2-4 .nrw .res-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } /* on a phone the kernel tiles, thread cards and resource buttons drop to two columns so they stay readable */
    .sec-2-4 .nrw .pgrid { grid-template-columns: 1fr; } /* on a phone the two process boxes stack instead of sitting side by side */
    .sec-2-4 .nmap .nm-d, .sec-2-4 .nmap .nm-v { font: inherit; font-size: 14px; font-weight: 700; border-radius: 10px; padding: 7px 8px; cursor: pointer; color: var(--ink); } /* the phone version of the step 1 map: shared look of the force and development buttons */
    .sec-2-4 .nmap .nm-d { border: 2px solid var(--line-2); background: var(--panel-2); opacity: .7; line-height: 1.25; } /* a force button: grey and slightly faded until it is selected or linked */
    .sec-2-4 .nmap .nm-d.cpu { border-color: var(--cpu); background: var(--cpu-bg); } /* the "New hardware" force button uses the processor colour */
    .sec-2-4 .nmap .nm-d.proc { border-color: var(--proc); background: var(--proc-bg); } /* the "New applications" force button uses the process colour */
    .sec-2-4 .nmap .nm-d.intr { border-color: var(--intr); background: var(--intr-bg); } /* the "New security threats" force button uses the interrupt colour (red) */
    .sec-2-4 .nmap .nm-d.on { opacity: 1; box-shadow: 0 0 0 2px var(--chc); } /* a lit force button becomes fully opaque with a chapter-coloured ring */
    .sec-2-4 .nmap .nm-v { border: 1.5px solid var(--line-2); background: var(--panel-2); text-align: left; } /* a development button in the phone map: a grey outlined button with left-aligned text */
    .sec-2-4 .nmap .nm-v.on { border: 2px solid var(--accent); background: var(--accent-bg); color: var(--accent); } /* a lit development button is outlined and tinted in the accent colour */
    .sec-2-4 .info-line { flex: none; border-left: 4px solid var(--thread); background: var(--panel-2); border-radius: 8px; padding: 7px 11px; line-height: 1.4; min-height: 64px; } /* the explanation line under the step 4 and step 5 diagrams: a thread-coloured bar on the left and room for two lines */
  `,  // end of the css text block

  steps: [  // steps: the list of pages in this section, in the order the student sees them
    /* ---------------- 1. Big picture: three forces → five developments (clickable map) ---------------- */
    {  // step 1 starts: a clickable map from three forces to five developments
      title: 'Why operating systems had to change',  // step 1 title shown at the top of the page
      kind: 'story',  // kind: 'story' labels this step as the big picture
      render(el, ctx) {  // render(el, ctx): builds step 1 when the student arrives; el is the page area, ctx holds the guide's helpers
        const { h, s } = ctx;  // h makes ordinary page elements and s makes SVG shapes (SVG is the browser's drawing format)
        const DRIVERS = [  // DRIVERS: the three forces that pushed operating systems to change; links lists the developments each one led to
          { id: 'hw', name: 'New hardware', sub: 'processors, networks, memory', cls: 'cpu', links: ['smp', 'mt', 'dist'],  // force 1: new hardware, linked to SMP, multithreading and distributed systems
            changed: 'Machines gained <b>several processors</b>, processors became many times <b>faster</b>, <b>high-speed networks</b> linked computers together, and memory grew <b>larger and more varied</b>.',  // what changed in hardware: several processors, faster processors, networks, bigger memory
            need: 'An OS written for one slow processor leaves the extra processors idle. It must spread work across many processors, keep a fast processor busy, and let networked machines cooperate.' },  // what the OS then needed: use every processor, keep a fast one busy, and let machines cooperate
          { id: 'app', name: 'New applications', sub: 'multimedia, Web, client/server', cls: 'proc', links: ['mt', 'micro', 'dist', 'ood'],  // force 2: new applications, linked to multithreading, microkernels, distributed systems and object design
            changed: '<b>Multimedia</b> (sound and video that must play without stutter), <b>Internet and Web</b> access, and <b><span class="t">client/server computing</span></b>, where one server answers requests from many clients.',  // what changed in applications: multimedia, the Web, and client/server computing
            need: 'A server must juggle many requests at once, and new services must be added, replaced or spread over several machines without rebuilding the whole OS.' },  // what the OS then needed: juggle many requests and add or move services without a rebuild
          { id: 'sec', name: 'New security threats', sub: 'viruses, worms, hacking', cls: 'intr', links: ['micro'],  // force 3: new security threats, linked to microkernels
            changed: 'Once computers joined the Internet, attackers anywhere could reach them: <b>viruses</b>, <b>worms</b> and ever cleverer <b>hacking techniques</b> followed.',  // what changed in security: networked machines could be attacked from anywhere
            need: 'The OS must protect itself and its users. Keeping the all-powerful kernel small, and running most services with limited rights, shrinks the damage one flaw can do.' },  // what the OS then needed: a small kernel and services with limited rights
        ];  // closes DRIVERS
        const DEVS = [  // DEVS: the five developments, each with the steps that cover it and a one-line description
          { id: 'micro', name: 'Microkernel architecture', where: 'Steps 2 and 3', what: 'Keep only a tiny core in the kernel and run every other OS service as a separate process in user mode.' },  // development: microkernel architecture (steps 2 and 3)
          { id: 'mt', name: 'Multithreading', where: 'Steps 4 and 5', what: 'Divide one process into several threads that can run concurrently, each working on an independent task.' },  // development: multithreading (steps 4 and 5)
          { id: 'smp', name: 'Symmetric multiprocessing', where: 'Step 6', what: 'Several similar processors share one memory under one OS, which runs work on all of them at the same time.' },  // development: symmetric multiprocessing (step 6)
          { id: 'dist', name: 'Distributed operating system', where: 'Step 7', what: 'Make a cluster of networked computers look like one machine with one memory and one file system.' },  // development: distributed operating system (step 7)
          { id: 'ood', name: 'Object-oriented design', where: 'Step 7', what: 'Build the OS from objects with clean interfaces, so it can be extended and customized without breaking it.' },  // development: object-oriented design (step 7)
        ];  // closes DEVS
        const DY = [28, 124, 220], DH = 74;              // driver boxes (left column of the map)
        const VY = [26, 84, 142, 200, 258], VH = 46;     // development boxes (right column)
        let sel = { type: 'd', id: 'hw' };  // sel is what the student has selected: type 'd' for a force or 'v' for a development, plus its id
        const svg = s('svg', { viewBox: '0 0 640 310', width: '100%', role: 'img', 'aria-label': 'Three forces linked to five developments' });  // the map drawing, 640 by 310 units: forces on the left, developments on the right
        const info = h('div', { class: 'card white stack', style: { gap: '6px', flex: '1', minHeight: '0' } });  // info: the card beside the map that explains the selected box
        const linked = (d, v) => d.links.includes(v.id);  // linked(d, v): true if force d led to development v
        function draw() {  // draw(): redraws the map so the selected box and everything linked to it stand out
          const kids = [];  // kids collects the shapes for this drawing
          const litD = (d) => sel.type === 'd' ? sel.id === d.id : linked(d, DEVS.find((v) => v.id === sel.id));  // litD(d): a force is lit if it is selected, or if it links to the selected development
          const litV = (v) => sel.type === 'v' ? sel.id === v.id : linked(DRIVERS.find((d) => d.id === sel.id), v);  // litV(v): a development is lit if it is selected, or if the selected force links to it
          // links first so boxes sit on top
          DRIVERS.forEach((d, i) => DEVS.forEach((v, j) => {  // for every force and development pair, draw a curved link if they are connected
            if (!linked(d, v)) return;  // skip pairs that are not linked
            const on = sel.type === 'd' ? sel.id === d.id : sel.id === v.id;  // on is true if this link touches the selected box
            const y1 = DY[i] + DH / 2, y2 = VY[j] + VH / 2;  // the heights where the link leaves the force box and enters the development box
            kids.push(s('path', { d: `M 222 ${y1} C 300 ${y1}, 320 ${y2}, 396 ${y2}`, fill: 'none', style: `stroke:${on ? `var(--${d.cls})` : 'var(--line-2)'}`, 'stroke-width': on ? 3.5 : 1.5, opacity: on ? 1 : 0.55, 'marker-end': on ? `url(#arr-${d.cls})` : null }));  // draws the curve, thick and coloured with an arrowhead if on, thin and faded grey if not
          }));  // ends the link loop
          DRIVERS.forEach((d, i) => {  // draws each force as a clickable box on the left
            const on = litD(d);  // on is true if this force is lit
            kids.push(s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': d.name, onclick: () => pick('d', d.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick('d', d.id); } } },  // the box works as a button: click, or Enter or Space from the keyboard, selects this force
              s('rect', { x: 8, y: DY[i], width: 214, height: DH, rx: 12, class: 's-' + d.cls, 'stroke-width': on ? 3.5 : 1.5, opacity: on ? 1 : 0.6 }),  // the force's rectangle in its own colour, faded when not lit
              s('text', { x: 22, y: DY[i] + 30, 'font-size': 17, 'font-weight': 800 }, d.name),  // the force's name in bold
              s('text', { x: 22, y: DY[i] + 52, 'font-size': 13, class: 's-sub' }, d.sub)));  // the force's short subtitle in grey; closes the box
          });  // ends the force loop
          DEVS.forEach((v, j) => {  // draws each development as a clickable box on the right
            const on = litV(v);  // on is true if this development is lit
            kids.push(s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': v.name, onclick: () => pick('v', v.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick('v', v.id); } } },  // the box works as a button: click, or Enter or Space from the keyboard, selects this development
              s('rect', { x: 400, y: VY[j], width: 232, height: VH, rx: 10, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 3 : 1.5 }),  // the development's rectangle, tinted in the accent colour when lit
              s('text', { x: 516, y: VY[j] + 30, 'text-anchor': 'middle', 'font-size': 15.5, 'font-weight': on ? 800 : 600, style: on ? 'fill:var(--accent)' : '' }, v.name)));  // the development's name, bold and accent-coloured when lit; closes the box
          });  // ends the development loop
          kids.push(s('text', { x: 8, y: 15, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'FORCES'));  // small grey "FORCES" heading over the left column
          kids.push(s('text', { x: 400, y: 15, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'DEVELOPMENTS'));  // small grey "DEVELOPMENTS" heading over the right column
          svg.replaceChildren(...kids);  // replaces everything in the drawing with the new shapes
        }  // ends draw()
        function paintInfo() {  // paintInfo(): fills the card beside the map with details of the selected box
          if (sel.type === 'd') {  // if a force is selected
            const d = DRIVERS.find((x) => x.id === sel.id);  // finds that force's record
            info.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="m0" style="color:var(--${d.cls})">${d.name}</h3><span class="xs muted">pushed toward ${d.links.length} development${d.links.length > 1 ? 's' : ''} (highlighted)</span></div>${/* card heading in the force's colour, and a note saying how many developments it pushed toward */''}
              <p class="small m0"><b>What changed.</b> ${d.changed}</p>${/* card paragraph: what changed */''}
              <p class="small m0"><b>What the OS had to learn.</b> ${d.need}</p>`;  // card paragraph: what the OS had to learn; ends the text
          } else {  // otherwise a development is selected
            const v = DEVS.find((x) => x.id === sel.id);  // finds that development's record
            const from = DRIVERS.filter((d) => linked(d, v));  // from lists every force that led to it
            info.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="m0" style="color:var(--accent)">${v.name}</h3><span class="chip">${v.where}</span></div>${/* card heading in the accent colour, and a chip naming the steps that cover it */''}
              <p class="small m0">${v.what}</p>${/* card paragraph: what the development does */''}
              <div class="row gap-s"><span class="small b">Pushed by:</span>${from.map((d) => `<span class="chip ${d.cls}">${d.name}</span>`).join('')}</div>`;  // a row of coloured chips naming the forces that pushed it; ends the text
          }  // ends the force/development choice
        }  // ends paintInfo()
        // phones: the wide SVG map would shrink to unreadable text, so use plain buttons instead
        const nmap = h('div', { class: 'nmap' });  // nmap: the phone version of the map, made of plain buttons
        function drawNarrow() {  // drawNarrow(): rebuilds the phone map so the selected and linked buttons are lit
          const litV = (v) => sel.type === 'v' ? sel.id === v.id : linked(DRIVERS.find((d) => d.id === sel.id), v);  // litV(v): a development is lit if selected, or if the selected force links to it
          const litD = (d) => sel.type === 'd' ? sel.id === d.id : linked(d, DEVS.find((v) => v.id === sel.id));  // litD(d): a force is lit if selected, or if it links to the selected development
          nmap.replaceChildren(  // replaces the buttons in the phone map
            h('div', { class: 'xs b muted' }, 'FORCES'),  // "FORCES" heading
            h('div', { class: 'grid-3', style: { gap: '6px' } }, ...DRIVERS.map((d) => h('button', { type: 'button', class: 'nm-d ' + d.cls + (litD(d) ? ' on' : ''), onclick: () => pick('d', d.id) }, d.name))),  // the three force buttons in a row, each in its own colour
            h('div', { class: 'xs b muted' }, 'DEVELOPMENTS'),  // "DEVELOPMENTS" heading
            ...DEVS.map((v) => h('button', { type: 'button', class: 'nm-v' + (litV(v) ? ' on' : ''), onclick: () => pick('v', v.id) }, v.name)));  // one button per development, stacked; closes the phone map
        }  // ends drawNarrow()
        function pick(type, id) { sel = { type, id }; if (ctx.narrow) drawNarrow(); else draw(); paintInfo(); }  // pick(type, id): selects a force or development, then redraws the map (the phone or full version) and the card
        el.append(h('div', { class: 'split l fill' },  // lays step 1 out as two columns side by side
          h('div', { class: 'stack' },  // left column: the story and instructions
            h('p', { class: 'lead m0', html: 'The operating systems of the 1960s and 1970s were built for one slow processor, a room of terminals and users who mostly trusted each other. That world did not last.' }),  // lead paragraph: early operating systems were built for one slow processor and trusting users
            h('p', { class: 'm0', html: 'Beyond the everyday changes of section 2.1, three forces pushed designers to rethink how an <span class="t">operating system</span> is built. <b>Click a force</b> in the map to see what changed, or <b>click a development</b> to see what pushed it.' }),  // instruction paragraph: three forces pushed a redesign; click a force or a development
            h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A small diner becomes a busy food hall. It needs several cooks working at once, each cook juggling several orders, stations that can be swapped without closing the kitchen, and locks on the doors. Making the old kitchen bigger is not enough; it has to be <b>redesigned</b>.' }),  // analogy box: a small diner turning into a busy food hall needs a redesign, not just more space
            h('p', { class: 'small muted m0', html: 'By the end of this section you can explain all five developments and say which problem each one solves.' })),  // footnote: by the end of the section the student can explain all five developments
          h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the map and the explanation card
            ctx.narrow ? h('div', { class: 'card white tight stack', style: { gap: '6px' } }, nmap) : h('div', { class: 'card white tight', style: { padding: '8px 10px' } }, svg),  // on a phone shows the button map; otherwise shows the drawn map
            info)));  // the explanation card under the map; closes both columns
        if (ctx.narrow) drawNarrow(); else draw();  // draws the right version of the map for this screen width
        paintInfo();  // fills the explanation card for the first selection, New hardware
      },  // ends render() for step 1
    },  // ends step 1
    /* ---------------- 2. Monolithic kernel vs microkernel: follow one read request ---------------- */
    {  // step 2 starts: an animated comparison of one read request in a monolithic kernel and a microkernel
      title: 'Two blueprints: monolithic kernel vs microkernel',  // step 2 title shown at the top of the page
      kind: 'compare',  // kind: 'compare' labels this step as a comparison
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds step 2 when the student arrives
        const { h, s } = ctx;  // takes the page-element and SVG builders from the guide
        let mode = 'mono';  // mode is which design is shown: 'mono' (monolithic) or 'micro' (microkernel)
        // ---- geometry shared by both drawings (viewBox 640 x 292) ----
        const BOX = {  // BOX: position, size, label and colour of each box in the drawing
          app: { x: 14, y: 36, w: 138, h: 58, t: 'Text editor', sub: 'application', cls: 'proc' },  // the text editor application at the top left
          app2: { x: 170, y: 36, w: 138, h: 58, t: 'Web browser', sub: 'application', cls: 'proc' },  // the web browser application (shown only in the monolithic drawing)
          fs: { x: 170, y: 36, w: 138, h: 58, t: 'File server', sub: 'user-mode process', cls: 'os', dash: true },  // the file server, a dashed box because it is an ordinary user-mode process (microkernel only)
          net: { x: 326, y: 36, w: 138, h: 58, t: 'Network server', sub: 'user-mode process', cls: 'os', dash: true },  // the network server, also a user-mode process
          drv: { x: 482, y: 36, w: 144, h: 58, t: 'Disk driver', sub: 'user-mode process', cls: 'os', dash: true },  // the disk driver as a user-mode process
          disk: { x: 306, y: 250, w: 128, h: 36, t: 'Disk', cls: 'io' },  // the disk at the bottom
        };  // closes BOX
        const DISK_AT = { mono: 306, micro: 490 };   // the disk sits under whichever part drives it
        const MONO_TILES = ['Scheduling', 'Memory mgmt', 'File system', 'Disk driver', 'Networking', 'IPC'];  // MONO_TILES: the six parts that all live inside a monolithic kernel
        const monoTile = (i) => ({ x: 22 + i * 100, y: 166, w: 96, h: 42 });  // monoTile(i): position of tile i in the row of kernel parts
        const MICRO_TILES = ['Address spaces', 'IPC', 'Basic scheduling'];  // MICRO_TILES: the only three parts left inside a microkernel
        const microTile = (i) => ({ x: 156 + i * 128, y: 166, w: 120, h: 42 });  // microTile(i): position of tile i in the microkernel row
        const cx = (b) => b.x + b.w / 2;  // cx(b): the horizontal centre of box b, used to aim the arrows
        // ---- the two request traces ----
        const TRACE = {  // TRACE: the animation frames for each design; hi lists boxes to light, arrows the moves, trips and msgs the running totals
          mono: [  // the monolithic kernel trace, five frames
            { hi: ['app'], trips: 0, msgs: 0, cap: '<b>Start.</b> The text editor, a process in user mode, needs part of a file. It asks the OS with a system call, <code>read()</code>.' },  // frame 1: the editor asks for part of a file with a read() system call
            { hi: ['app', 't2'], arrows: [['app', 't2']], trips: 1, msgs: 0, cap: 'The system call <b>traps into the kernel</b>: the processor switches to kernel mode and jumps to kernel code. That is 1 trip into the kernel. The file-system code, which lives inside the kernel, takes over.' },  // frame 2: the call traps into the kernel, where the file-system code takes over (1 trip)
            { hi: ['t2', 't3'], arrows: [['t2', 't3']], trips: 1, msgs: 0, cap: 'The file-system code calls the disk driver <b>directly, like calling a function</b>. No message is needed: both parts share one address space.' },  // frame 3: the file system calls the disk driver directly, like a function
            { hi: ['t3', 'disk'], arrows: [['t3', 'disk']], trips: 1, msgs: 0, cap: 'The driver tells the disk what to read. The disk returns the data blocks to the driver.' },  // frame 4: the driver reads the blocks from the disk
            { hi: ['t2', 'app'], arrows: [['t2', 'app']], trips: 1, msgs: 0, cap: '<b>Done.</b> The kernel copies the data to the editor and returns to user mode. Cost: <b>1 trip into the kernel, 0 messages</b>. Fast, but every kernel part can touch every other part.' },  // frame 5: the kernel returns the data; total 1 trip and 0 messages
          ],  // closes the monolithic trace
          micro: [  // the microkernel trace, six frames
            { hi: ['app'], trips: 0, msgs: 0, cap: '<b>Start.</b> The editor needs part of a file. The file system is now a <b>separate process</b>, so the editor must send it a request <b>message</b>.' },  // frame 1: the file system is now a separate process, so the editor must send a message
            { hi: ['app', 'ipc', 'fs'], arrows: [['app', 'ipc'], ['ipc', 'fs']], trips: 1, msgs: 1, cap: 'Every message travels <b>through the microkernel</b>: the editor traps into the kernel (switching to kernel mode) and IPC delivers the request to the file server. Message 1.' },  // frame 2: the request passes through the kernel's IPC to the file server (message 1)
            { hi: ['fs', 'ipc', 'drv'], arrows: [['fs', 'ipc'], ['ipc', 'drv']], trips: 2, msgs: 2, cap: 'The file server works out which disk blocks hold the data, then sends a message to the disk-driver process, again through the kernel. Message 2.' },  // frame 3: the file server sends a message to the driver process, again through the kernel (message 2)
            { hi: ['drv', 'disk'], arrows: [['drv', 'disk']], trips: 2, msgs: 2, cap: 'The disk-driver process operates the disk directly: the kernel has mapped the disk controller\'s registers into the driver\'s address space. The disk returns the data blocks.' },  // frame 4: the driver process operates the disk, whose registers the kernel mapped into its address space
            { hi: ['drv', 'ipc', 'fs'], arrows: [['drv', 'ipc'], ['ipc', 'fs']], trips: 3, msgs: 3, cap: 'The driver sends the data back to the file server in a reply message, through the kernel. Message 3.' },  // frame 5: the driver sends the data back to the file server (message 3)
            { hi: ['fs', 'ipc', 'app'], arrows: [['fs', 'ipc'], ['ipc', 'app']], trips: 4, msgs: 4, cap: '<b>Done.</b> The file server replies to the editor. Cost: <b>4 messages and 4 trips through the kernel</b> instead of 1. That overhead is the classic price of a microkernel.' },  // frame 6: the file server replies to the editor; total 4 messages and 4 trips, the microkernel's price
          ],  // closes the microkernel trace
        };  // closes TRACE
        const svg = s('svg', { viewBox: '0 0 640 292', width: '100%', role: 'img', 'aria-label': 'Kernel structure diagram' });  // the drawing for step 2, 640 by 292 units
        const tally = h('div', { class: 'row gap-s' });  // tally: the row of counters for trips into the kernel and messages
        function anchor(id) {  // anchor(id): finds the rectangle for a name used in the traces (a box, the IPC tile, or a monolithic tile t0-t5)
          if (BOX[id]) return BOX[id];  // a named box from BOX
          if (id === 'ipc') return microTile(1);  // "ipc" means the middle tile of the microkernel row
          if (/^t\d$/.test(id)) return monoTile(+id[1]);  // "t2" and similar mean tile number 2 of the monolithic row
          return null;  // anything else has no position
        }  // ends anchor()
        function arrowPath(a, b) {  // arrowPath(a, b): builds the SVG path for an arrow from box a to box b
          const A = anchor(a), B = anchor(b);  // finds both rectangles
          const down = A.y < B.y;  // down is true if the arrow travels downward on the page
          const x1 = cx(A), y1 = down ? A.y + A.h : A.y, x2 = cx(B), y2 = down ? B.y : B.y + B.h;  // starts at the bottom (or top) centre of A and ends at the top (or bottom) centre of B
          if (A.y === B.y) return `M ${x1} ${A.y} C ${x1} ${A.y - 22}, ${x2} ${B.y - 22}, ${x2} ${B.y - 3}`; // same row: arc over the top
          return `M ${x1} ${y1} L ${x2} ${y2 + (down ? -3 : 3)}`;  // otherwise a straight line, stopping 3 units short so the arrowhead does not cover the box edge
        }  // ends arrowPath()
        function box(b, lit, dim) {  // box(b, lit, dim): draws one labelled box; lit makes its outline thick, dim fades it out
          return s('g', { opacity: dim ? 0.45 : 1 },  // a group whose opacity drops to 45% when the box is not part of this design's story
            s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 10, class: 's-' + b.cls, 'stroke-width': lit ? 3.5 : 1.8, 'stroke-dasharray': b.dash ? '6 4' : null }),  // the rectangle in the box's colour, dashed for user-mode server processes
            s('text', { x: cx(b), y: b.y + (b.sub ? 25 : 23), 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, b.t),  // the box's title in bold, centred
            b.sub ? s('text', { x: cx(b), y: b.y + 44, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, b.sub) : null);  // the box's subtitle in grey, if it has one
        }  // ends box()
        function tile(r, label, lit) {  // tile(r, label, lit): draws one small part inside the kernel, lit in the accent colour when involved
          return s('g', {},  // groups the tile's rectangle and its label
            s('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 8, class: lit ? 's-accent' : 's-panel', 'stroke-width': lit ? 3 : 1.4 }),  // the tile's rectangle, tinted and thick when lit
            s('text', { x: r.x + r.w / 2, y: r.y + 26, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: lit ? 'fill:var(--accent)' : '' }, label));  // the tile's label, accent-coloured when lit
        }  // ends tile()
        function draw(i) {  // draw(i): builds frame i of the current design's trace; the player calls it and shows the caption it returns
          const f = TRACE[mode][i];  // f is this frame's record from TRACE
          BOX.disk.x = DISK_AT[mode];  // moves the disk under whichever part drives it in this design
          const lit = new Set(f.hi);  // lit is the set of boxes to highlight in this frame
          const k = [  // k collects the shapes, starting with the parts both designs share
            s('rect', { x: 2, y: 2, width: 636, height: 110, rx: 12, class: 's-panel', 'stroke-width': 1, opacity: 0.7 }),  // a faint panel across the top for user space
            s('text', { x: 14, y: 22, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'USER SPACE'),  // "USER SPACE" label
            s('text', { x: 14, y: 138, 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--os)', 'letter-spacing': '.08em' }, 'KERNEL SPACE'),  // "KERNEL SPACE" label in the OS colour
            s('line', { x1: 2, y1: 120, x2: 638, y2: 120, class: 's-muted', 'stroke-dasharray': '8 6' }),  // a dashed line separating user space from kernel space
            s('text', { x: 14, y: 272, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'HARDWARE'),  // "HARDWARE" label at the bottom
          ];  // closes the shared shapes
          if (mode === 'mono') {  // in the monolithic design
            k.push(s('rect', { x: 12, y: 146, width: 616, height: 88, rx: 12, class: 's-os', 'stroke-width': 2.5 }));  // one wide kernel box that holds everything
            k.push(s('text', { x: 618, y: 227, 'text-anchor': 'end', 'font-size': 12.5, style: 'fill:var(--os)', 'font-weight': 700 }, 'kernel mode · one shared address space'));  // note inside it: kernel mode, one shared address space
            MONO_TILES.forEach((t, j) => k.push(tile(monoTile(j), t, lit.has('t' + j))));  // the six kernel parts, each lit if this frame involves it
            k.push(box(BOX.app, lit.has('app')), box(BOX.app2, false, true));  // the editor, plus a faded web browser to show other applications exist
          } else {  // in the microkernel design
            k.push(s('rect', { x: 146, y: 146, width: 396, height: 88, rx: 12, class: 's-os', 'stroke-width': 2.5 }));  // a much smaller kernel box
            k.push(s('text', { x: 534, y: 227, 'text-anchor': 'end', 'font-size': 12.5, style: 'fill:var(--os)', 'font-weight': 700 }, 'microkernel · small and privileged'));  // note inside it: small and privileged
            MICRO_TILES.forEach((t, j) => k.push(tile(microTile(j), t, j === 1 && lit.has('ipc'))));  // the three microkernel parts; only IPC ever lights up
            ['app', 'fs', 'drv', 'net'].forEach((id) => k.push(box(BOX[id], lit.has(id), id === 'net')));  // the editor, the file server, the driver and a faded network server, all in user space
          }  // ends the design choice
          k.push(box(BOX.disk, lit.has('disk')));  // the disk, lit when data moves to or from it
          (f.arrows || []).forEach(([a, b], j) => k.push(s('path', { d: arrowPath(a, b), fill: 'none', style: 'stroke:var(--accent)', 'stroke-width': 3, 'marker-end': 'url(#arr-accent)', class: 'fade-in' })));  // draws this frame's arrows in the accent colour, fading in
          svg.replaceChildren(...k);  // replaces everything in the drawing with the new shapes
          tally.innerHTML = `<span class="chip os">trips into the kernel: ${f.trips}</span><span class="chip accent">messages: ${f.msgs}</span>`;  // updates the counters: trips into the kernel and messages so far
          return f.cap;  // hands the caption to the player
        }  // ends draw()
        const player = ctx.ui.player({ count: TRACE.mono.length, render: draw, interval: 2200 });  // the animation player, one step per trace frame, advancing every 2.2 s when playing
        const seg = ctx.ui.seg([{ value: 'mono', label: 'Monolithic kernel' }, { value: 'micro', label: 'Microkernel' }], mode, (v) => { mode = v; player.setCount(TRACE[v].length); });  // the design switch; choosing one resets the player to that design's number of frames
        el.append(h('div', { class: 'split l fill' },  // lays step 2 out as two columns side by side
          h('div', { class: 'stack', style: { gap: '8px' } },  // left column: the definitions of the two designs
            h('h3', { class: 'm0', html: '<span class="t">Monolithic kernel</span>' }),  // heading: monolithic kernel (a glossary term)
            h('p', { class: 'small m0', html: 'Almost the whole OS lives inside the <span class="t">kernel</span>: scheduling, the file system, networking, device drivers, memory management and more. All of it runs in kernel mode in <b>one shared <span class="t">address space</span></b>, so any part can call any other part directly, with no messages. (That is a structure, not one process: kernel code runs for whichever process made a system call.)' }),  // paragraph: almost the whole OS runs in kernel mode in one shared address space and calls itself directly
            h('h3', { class: 'm0', style: { marginTop: '4px' }, html: '<span class="t">Microkernel</span>' }),  // heading: microkernel (a glossary term)
            h('p', { class: 'small m0', html: 'Only the essential core stays in the kernel: managing <b>address spaces</b>, <span class="t">interprocess communication (IPC)</span> and <b>basic scheduling</b>. Every other service runs as a separate <span class="t" data-t="server process">server process</span> in <span class="t">user mode</span>. Servers and applications cooperate by <b>sending messages</b>, and the microkernel delivers each one.' }),  // paragraph: only address spaces, IPC and basic scheduling stay in the kernel; the rest are user-mode servers
            h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'A microkernel system does <b>not</b> offer fewer services. The same services exist; they have moved <b>out of the kernel</b> into user-mode processes.' }),  // "Common mistake" box: a microkernel moves services out of the kernel; it does not remove them
            h('p', { class: 'small muted m0', html: 'Pick a design, then press <b>Play</b> (or step with ▶) to follow one file read.' })),  // instruction: pick a design, then play the file read
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the switch, counters, drawing, player and trade-offs
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, tally),  // the design switch and the counters on one row
            h('div', { class: 'card white tight', style: { padding: '6px 8px' } }, svg),  // the drawing in a white card
            player.el,  // the player's caption and controls
            h('div', { class: 'grid-2', style: { gap: '8px' } },  // two small cards side by side summing up the trade-off
              h('div', { class: 'card tight xs-card', html: '<b>Monolithic:</b> <span class="ok-t">fast direct calls</span>, but one buggy part can corrupt or crash the whole kernel.' }),  // trade-off card: monolithic is fast but one bug can crash the kernel
              h('div', { class: 'card tight xs-card', html: '<b>Microkernel:</b> <span class="ok-t">small kernel, isolated services</span>, but every request costs extra messages.' })))));  // trade-off card: microkernel isolates services but costs extra messages; closes both columns
      },  // ends render() for step 2
    },  // ends step 2
    /* ---------------- 3. Lab: move services in or out of the kernel, then stress-test the design ---------------- */
    {  // step 3 starts: a lab where the student moves services in or out of the kernel and then tests the design
      title: 'Lab: build a kernel, then try to break it',  // step 3 title shown at the top of the page
      kind: 'lab',  // kind: 'lab' labels this step as a hands-on lab
      render(el, ctx) {  // render(el, ctx): builds step 3 when the student arrives
        const { h } = ctx;  // takes the page-element builder from the guide
        const SVC = [  // SVC: the seven kernel services; k is the name inside the kernel, u the name as a server, core marks the three that cannot move
          { id: 'ipc', k: 'IPC', sub: 'messages', core: true, why: 'Servers can only talk by messages. If IPC left the kernel, nothing could deliver them, so the whole design would fall apart.' },  // core service: IPC, which must stay because it delivers every message
          { id: 'as', k: 'Address spaces', sub: 'protection', core: true, why: 'Deciding which memory each process may touch uses privileged hardware controls. If ordinary processes could change them, protection would mean nothing.' },  // core service: address spaces, which rely on privileged hardware controls
          { id: 'sched', k: 'Basic scheduling', sub: 'picks next', core: true, why: 'Something privileged must pick the next process or thread and switch the processor to it, including switching between the servers themselves.' },  // core service: basic scheduling, which must switch the processor, even between servers
          { id: 'vm', k: 'Memory manager', u: 'Memory server', sub: 'paging policy' },  // movable service: memory manager, called the memory server once it is moved out
          { id: 'fs', k: 'File system', u: 'File server', sub: 'files and folders' },  // movable service: file system, the file server outside the kernel
          { id: 'drv', k: 'Device drivers', u: 'Driver server', sub: 'run the devices' },  // movable service: device drivers, the driver server outside the kernel
          { id: 'net', k: 'Networking', u: 'Network server', sub: 'network protocols' },  // movable service: networking, the network server outside the kernel
        ];  // closes SVC
        const MOVABLE = SVC.filter((x) => !x.core).map((x) => x.id);  // MOVABLE: the ids of the four services the student is allowed to move
        if (ctx.narrow) el.classList.add('nrw');  // on a phone, adds the class that switches the tile grids to two columns
        let where = {}; // id -> 'k' (kernel space) or 'u' (user space)
        let crash = null, fsVer = 1;  // crash records the last crash test ('drv-k' or 'drv-u', or null); fsVer counts file system upgrades
        const found = new Set();  // found holds the microkernel benefits the student has earned so far
        const setAll = (loc) => { MOVABLE.forEach((id) => (where[id] = loc)); SVC.filter((x) => x.core).forEach((x) => (where[x.id] = 'k')); };  // setAll(loc): puts every movable service in kernel space ('k') or user space ('u'); core services always stay in 'k'
        setAll('k');  // starts with everything in the kernel: a monolithic design
        const userTiles = h('div', { class: 'tiles' });  // userTiles: the grid of tiles in the user-space zone
        const kernTiles = h('div', { class: 'tiles' });  // kernTiles: the grid of tiles in the kernel-space zone
        const userZone = h('div', { class: 'zone user' }, h('div', { class: 'zone-lbl' }, h('span', {}, 'User space · user mode'), h('span', { class: 'zl-note' })), userTiles);  // the user-space zone with its label row and tile grid
        const kernZone = h('div', { class: 'zone kern' }, h('div', { class: 'zone-lbl' }, h('span', {}, 'Kernel space · kernel mode'), h('span', { class: 'zl-note' })), kernTiles);  // the kernel-space zone with its label row and tile grid
        const kind = h('div', { class: 'kind-name' });  // kind: the large name of the current design
        const kindSub = h('p', { class: 'small m0' });  // kindSub: one sentence describing the current design
        const meter = h('div', { class: 'meter' }, h('i'));  // meter: a bar showing how much of the OS runs in kernel mode
        const meterLbl = h('div', { class: 'xs muted' });  // meterLbl: the words under the bar ("Parts running in kernel mode: N of 7")
        const result = h('div', { class: 'result' });  // result: the box that shows the outcome of the last test
        const benefits = h('div', { class: 'benefits' });  // benefits: the list of four microkernel benefits
        const BEN = [  // BEN: the four benefits as [id, name, short explanation]
          ['simple', 'Simpler kernel', 'less privileged code to get right'],  // benefit: a simpler kernel
          ['flex', 'Flexibility', 'add or replace a service without touching the kernel'],  // benefit: flexibility
          ['dist', 'Suits distributed systems', 'a remote server is reached by the same messages'],  // benefit: suits distributed systems
          ['iso', 'Failures stay contained', 'a crashed server takes down only itself'],  // benefit: failures stay contained
        ];  // closes BEN
        const presets = ctx.ui.seg([{ value: 'mono', label: 'Monolithic' }, { value: 'micro', label: 'Microkernel' }, { value: 'mixed', label: 'Mixed' }], 'mono', (v) => {  // presets: a switch with three ready-made designs; choosing one moves the services to match
          if (v === 'mono') setAll('k');  // "Monolithic" puts every movable service in the kernel
          else if (v === 'micro') setAll('u');  // "Microkernel" moves every movable service out to user space
          else { setAll('k'); where.drv = 'u'; where.fs = 'u'; }  // "Mixed" starts monolithic, then moves only the drivers and the file system out
          afterMove();  // clears old test results and repaints the lab
        });  // closes the preset switch
        // after any change of design: clear old test results; reaching a pure microkernel earns the "simpler kernel" benefit
        function afterMove() {  // afterMove(): runs after any change of design
          crash = null;  // a new design clears any crash left over from an earlier test
          if (design() === 'micro') say('tip', 'Simpler kernel', 'Only the 3 core parts still run in kernel mode, instead of all 7. Less privileged code means less code that must be perfect: the first microkernel benefit. Now run the three tests.');  // reaching a pure microkernel shows the "Simpler kernel" message, the first benefit
          else say(null);  // any other design shows the default "Try the tests" prompt
          paint();  // redraws the zones, meter and benefits
        }  // ends afterMove()
        const nIn = () => SVC.filter((x) => where[x.id] === 'k').length;  // nIn(): counts the services currently in kernel space, core ones included
        const design = () => { const m = MOVABLE.filter((id) => where[id] === 'k').length; return m === MOVABLE.length ? 'mono' : m === 0 ? 'micro' : 'mixed'; };  // design(): names the design from how many movable services are in the kernel: all, none, or some
        function tileFor(x) {  // tileFor(x): builds the clickable tile for service x, showing its name and status for the current test
          const inK = where[x.id] === 'k';  // inK is true if the service is in kernel space
          const dead = crash && ((crash === 'drv-u' && x.id === 'drv') || crash === 'drv-k');  // dead is true for the driver after a user-space crash, or for everything after a kernel crash
          const label = inK ? x.k : x.u;  // the tile shows the kernel name inside the kernel and the server name outside it
          const st = crash === 'drv-u' && x.id === 'drv' ? '<span class="st bad-t">✗ crashed</span>' : crash === 'drv-k' ? '<span class="st bad-t">✗ halted</span>' : (x.id === 'fs' && fsVer > 1 ? `<span class="st ok-t">v${fsVer} running</span>` : `<span>${x.sub}</span>`);  // status line: crashed, halted, the file server's new version, or the usual short description
          return h('button', { type: 'button', class: 'svc' + (inK ? '' : ' srv') + (x.core ? ' core' : '') + (dead ? ' dead' : '') + (crash === 'drv-k' && !(x.id === 'drv') ? ' down' : ''), 'aria-label': (x.core ? 'Explain ' : 'Move ') + x.k, onclick: () => clickSvc(x), html: `<b>${label}</b>${x.core && crash !== 'drv-k' ? st.replace('<span>', '<span><i class="lock">core</i> ') : st}` });  // a button tile styled by where it lives, whether it is core, and whether it crashed or stopped; core tiles get a "core" badge
        }  // ends tileFor()
        function app(name) {  // app(name): builds a non-clickable tile for an application such as the text editor
          const st = crash === 'drv-k' ? '<span class="st bad-t">✗ stopped</span>' : crash === 'drv-u' ? '<span class="st ok-t">✓ still running</span>' : '<span>application</span>';  // status: stopped after a kernel crash, still running after a contained crash, or just "application"
          return h('div', { class: 'svc app' + (crash === 'drv-k' ? ' down' : '') , html: `<b>${name}</b>${st}` });  // the application tile, faded out after a kernel crash
        }  // ends app()
        function paint() {  // paint(): redraws the whole lab from the current design and test state
          userTiles.replaceChildren(app('Text editor'), app('Web browser'), ...SVC.filter((x) => where[x.id] === 'u').map(tileFor));  // the user zone always holds the two applications, followed by every service moved out of the kernel
          kernTiles.replaceChildren(...SVC.filter((x) => where[x.id] === 'k').map(tileFor));  // the kernel zone holds every service still in the kernel
          kernZone.classList.toggle('panic', crash === 'drv-k');  // turns the kernel zone red after a kernel crash
          kernZone.querySelector('.zl-note').textContent = crash === 'drv-k' ? 'kernel panic: everything stops' : `${nIn()} part${nIn() > 1 ? 's' : ''}`;  // the kernel zone's note: "kernel panic" after a crash, otherwise the number of parts inside
          userZone.querySelector('.zl-note').textContent = 'click a service to move it';  // the user zone's note reminds the student to click a service to move it
          const d = design();  // d is the name of the current design
          presets.set(d);  // keeps the preset switch in step with the design, even when services were moved one by one
          if (d === 'micro') found.add('simple');  // a pure microkernel earns the "Simpler kernel" benefit
          kind.textContent = d === 'mono' ? 'Monolithic kernel' : d === 'micro' ? 'Microkernel' : 'Mixed design';  // writes the design's name in large letters
          kindSub.innerHTML = d === 'mono' ? 'Every service runs in kernel mode in one shared kernel address space. Direct calls are fast, but all of this code is trusted completely.'  // description of a monolithic design: fast direct calls, but all code trusted
            : d === 'micro' ? 'Only IPC, address spaces and basic scheduling remain in kernel mode. Everything else is an ordinary process that talks by messages.'  // description of a microkernel: only three parts in kernel mode, the rest talk by messages
            : 'Some services moved out, some stayed in. Many real systems land somewhere in between.';  // description of a mixed design: many real systems land in between
          meter.firstChild.style.width = (nIn() / SVC.length) * 100 + '%';  // sets the meter's length to the share of services in kernel mode
          meter.firstChild.style.background = nIn() > 4 ? 'var(--warn)' : 'var(--ok)';  // colours the meter amber when more than four parts are in the kernel, green otherwise
          meterLbl.textContent = `Parts running in kernel mode: ${nIn()} of ${SVC.length}`;  // writes the meter's label
          benefits.replaceChildren(...BEN.map(([id, t, sub]) => h('div', { class: 'ben' + (found.has(id) ? ' on' : '') }, h('span', { class: 'tick' }, found.has(id) ? '✓' : '○'), h('div', { html: `<b>${t}</b> <span class="muted">· ${sub}</span>` }))));  // rebuilds the benefits list, ticking and colouring the ones earned so far
        }  // ends paint()
        function say(kind, label, html) {  // say(kind, label, html): shows a message in the result box; kind picks the colour style
          if (!kind) { result.innerHTML = '<div class="callout m0" data-label="Try the tests">Pick a design, then run one of the tests. Can you light up all four microkernel benefits?</div>'; return; }  // with no kind, shows the default prompt asking the student to try the tests
          result.innerHTML = `<div class="callout ${kind} m0 fade-in" data-label="${label}">${html}</div>`;  // otherwise shows a labelled callout that fades in
        }  // ends say()
        function clickSvc(x) {  // clickSvc(x): runs when a service tile is clicked
          if (x.core) { say('warn', x.k + ' must stay in the kernel', x.why + ' A microkernel always keeps its three core functions.'); return; }  // a core service does not move; instead its reason for staying is shown
          where[x.id] = where[x.id] === 'k' ? 'u' : 'k';  // any other service flips between kernel space and user space
          afterMove();  // clears old results and repaints
        }  // ends clickSvc()
        function testCrash() {  // testCrash(): the "Crash the drivers" test
          if (where.drv === 'k') {  // if the drivers are inside the kernel
            crash = 'drv-k';  // the crash takes the kernel down
            say('bad', 'Whole system down', 'The buggy driver ran <b>inside the kernel</b>, in the same address space as everything else. It scribbled over kernel memory, the kernel had to halt, and <b>every</b> program stopped. One bad driver, one dead machine.');  // message: the bad driver corrupted kernel memory and every program stopped
          } else {  // otherwise the drivers run as a user-mode server
            crash = 'drv-u'; found.add('iso');  // only the driver server crashes, and the "Failures stay contained" benefit is earned
            say('tip', 'Contained', 'The driver was an ordinary process in its own address space, so the bug could only wreck <b>itself</b>. The kernel, the other servers and both applications keep running. <button class="btn sm" type="button" data-act="restart">Restart the driver server</button>');  // message: only the driver died, everything else keeps running; includes a restart button
          }  // ends the inside/outside choice
          paint();  // redraws the lab to show the crash
        }  // ends testCrash()
        function testUpgrade() {  // testUpgrade(): the "Upgrade the file system" test
          crash = null;  // clears any earlier crash
          if (where.fs === 'u') {  // if the file system runs as a server
            fsVer++; found.add('flex');  // its version goes up by one and the "Flexibility" benefit is earned
            say('tip', 'Upgraded while running', `The old file server was stopped and version ${fsVer} started in its place, like any other program. The kernel was never touched and nothing had to be rebuilt.`);  // message: the old server was stopped and the new one started like any program
          } else {  // otherwise the file system is inside the kernel
            say('warn', 'Upgrade means kernel surgery', 'The file system is part of the kernel program, so changing it means changing the kernel itself. Any mistake in the new code runs with full privileges, right next to everything else.');  // message: changing it means changing the kernel itself, with full privileges
          }  // ends the choice
          paint();  // redraws the lab
        }  // ends testUpgrade()
        function testRemote() {  // testRemote(): the "Use a remote file server" test
          crash = null;  // clears any earlier crash
          if (where.fs === 'u') {  // if the file system runs as a server
            found.add('dist');  // earns the "Suits distributed systems" benefit
            say('tip', 'Works across the network', 'The editor keeps sending exactly the same request <b>message</b>. The message system forwards it to a file server on another computer and brings back the reply. Local or remote, it looks the same to the client.');  // message: the same request message can be forwarded to a server on another computer
          } else {  // otherwise the file system is inside the kernel
            say('warn', 'Not without a redesign', 'The file system is kernel code reached by <b>direct calls inside this machine</b>. There is no request message that could be forwarded to another computer.');  // message: kernel code is reached by direct calls, so there is no message to forward
          }  // ends the choice
          paint();  // redraws the lab
        }  // ends testRemote()
        ctx.on(result, 'click', (e) => { if (e.target.closest('[data-act="restart"]')) { crash = null; say('tip', 'Back to normal', 'The driver server restarted like any program. Nobody had to reboot the machine.'); paint(); } });  // listens for clicks on the "Restart the driver server" button inside the result box and brings the driver back
        say(null);  // shows the default prompt in the result box at the start
        el.append(h('div', { class: 'split r fill' },  // lays step 3 out as two columns side by side
          h('div', { class: 'stack', style: { gap: '8px' } },  // left column: the presets, the two zones and the hardware strip
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'Start from a preset:'), presets),  // the "Start from a preset" label with the preset switch
            userZone, kernZone,  // the user-space zone above the kernel-space zone
            h('div', { class: 'hwstrip' }, h('span', { class: 'xs b muted' }, 'HARDWARE'), h('span', { class: 'chip cpu' }, 'Processor'), h('span', { class: 'chip mem' }, 'Memory'), h('span', { class: 'chip io' }, 'Disk'), h('span', { class: 'chip io' }, 'Network card')),  // the hardware strip: processor, memory, disk and network card chips
            h('p', { class: 'small muted m0', html: 'Click any service to move it between the two spaces. The three <b>core</b> parts never leave the kernel; click one to find out why.' }),  // instruction: click a service to move it; core parts never leave
            h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Code in kernel mode is trusted completely: a bug anywhere in it can damage anything. Every service moved out to user mode shrinks the part that must be perfect.' })),  // "Why it matters" box: kernel-mode code is fully trusted, so moving services out shrinks what must be perfect
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the design summary, the tests, the result and the benefits
            h('div', { class: 'card tight stack', style: { gap: '4px' } }, h('div', { class: 'xs muted b' }, 'YOUR DESIGN'), kind, kindSub, meter, meterLbl),  // "YOUR DESIGN" card with the name, description, meter and its label
            h('div', { class: 'row gap-s' },  // the row of three test buttons
              h('button', { class: 'btn sm intr', type: 'button', onclick: testCrash }, 'Crash the drivers'),  // test button: crash the drivers
              h('button', { class: 'btn sm os', type: 'button', onclick: testUpgrade }, 'Upgrade the file system'),  // test button: upgrade the file system
              h('button', { class: 'btn sm io', type: 'button', onclick: testRemote }, 'Use a remote file server')),  // test button: use a remote file server
            result, benefits)));  // the result box and the benefits list; closes both columns
        paint();  // draws the lab in its starting (monolithic) state
      },  // ends render() for step 3
    },  // ends step 3
    /* ---------------- 4. Threads vs processes: anatomy + what a switch costs ---------------- */
    {  // step 4 starts: the anatomy of a process with threads, and what a thread or process switch costs
      title: 'Inside a process: threads share, each keeps its own',  // step 4 title shown at the top of the page
      kind: 'explore',  // kind: 'explore' marks this as a step where the student clicks to explore
      render(el, ctx) {  // render(el, ctx): builds step 4 when the student arrives
        const { h } = ctx;  // takes the page-element builder from the guide
        const TA = [  // TA: the saved context of each of process A's up to four threads: program counter, stack pointer and stack depth
          { pc: '0x1040', sp: '0x7FF0', depth: 0.35 }, { pc: '0x1A48', sp: '0x6FF0', depth: 0.6 },  // threads 1 and 2: each has its own PC and its own stack area (SP), and a stack filled to a different depth
          { pc: '0x22C0', sp: '0x5FF0', depth: 0.2 }, { pc: '0x1A10', sp: '0x4FF0', depth: 0.5 },  // threads 3 and 4; threads 2 and 4 are at nearby PCs because they run the same part of the shared code
        ];  // closes TA
        const TB = { pc: '0x0400', sp: '0x3FF0', depth: 0.45 };  // TB: the context of process B's single thread
        if (ctx.narrow) el.classList.add('nrw');  // on a phone, adds the class that switches the grids to two columns and stacks the process boxes
        const RES = [  // RES: the four resources that all threads of a process share, as [name, explanation]
          ['Code', 'The program\'s instructions. Every thread runs code from this one copy, often different parts of it at the same moment.'],  // shared resource: code, one copy for every thread
          ['Data', 'Global variables and the heap. Any thread can read and change them, which makes sharing easy (and, as Chapter 5 shows, risky).'],  // shared resource: data (globals and the heap), easy to share and risky
          ['Open files', 'A file opened by one thread is open for all its sibling threads: they share one table of open files.'],  // shared resource: open files, one table for all sibling threads
          ['Devices', 'I/O devices and connections the OS has given to the process, such as a network connection to a client.'],  // shared resource: devices and connections given to the process
        ];  // closes RES
        let n = 3, cur = { p: 'A', t: 0 }, last = null;  // n is how many threads process A has, cur is the thread on the processor, last is the kind of the latest switch
        const aThreads = h('div', { class: 'thr-row' });  // aThreads: the row of process A's thread cards
        const bThread = h('div', { class: 'thr-row one' });  // bThread: process B's single thread card
        const cpu = h('div', { class: 'cpu-box' });  // cpu: the processor box showing who is running
        const chk = h('div', { class: 'chk' });  // chk: the checklist of what a switch costs
        const info = h('div', { class: 'info-line small' });  // info: the explanation line at the bottom
        const CHK = ['Save the old thread\'s registers (PC, SP, …)', 'Load the new thread\'s registers and stack pointer', 'Switch the memory map to another address space', 'Cold start: cached translations and data no longer help'];  // CHK: the four costs a switch can involve; a thread switch pays the first two, a process switch pays all four
        const ctxOf = (c) => (c.p === 'A' ? TA[c.t] : TB);  // ctxOf(c): finds the saved context of thread c, from TA for process A or TB for process B
        function thrCard(p, i, t) {  // thrCard(p, i, t): builds the clickable card for thread i of process p, with its context t
          const run = cur.p === p && cur.t === i;  // run is true if this thread is on the processor now
          return h('button', { type: 'button', class: 'thr' + (run ? ' run' : ''), 'aria-label': `Run process ${p} thread ${i + 1}`, onclick: () => dispatch({ p, t: i }) },  // the card is a button; clicking it switches the processor to this thread
            h('b', {}, 'Thread ' + (i + 1)),  // the thread's name
            h('span', { class: 'chip ' + (run ? 'ok' : ''), style: { alignSelf: 'flex-start' } }, run ? 'running' : 'ready'),  // a chip saying running (green) or ready
            h('div', { class: 'xs mono' }, 'PC ' + t.pc), h('div', { class: 'xs mono' }, 'SP ' + t.sp),  // the thread's own program counter and stack pointer, in a fixed-width font
            h('div', { class: 'stk' }, h('span', { class: 'xs' }, 'stack'), h('div', { class: 'meter' }, h('i', { style: { width: t.depth * 100 + '%' } }))));  // a small bar showing how full this thread's stack is; closes the card
        }  // ends thrCard()
        function paint() {  // paint(): redraws the thread cards, the processor box and the cost checklist
          aThreads.replaceChildren(...TA.slice(0, n).map((t, i) => thrCard('A', i, t)));  // shows the first n of process A's threads
          bThread.replaceChildren(thrCard('B', 0, TB));  // shows process B's one thread
          const c = ctxOf(cur);  // c is the running thread's context
          cpu.innerHTML = `<div class="xs b" style="color:var(--cpu);letter-spacing:.08em">PROCESSOR</div><div class="b">Running: process ${cur.p} · thread ${cur.t + 1}</div><div class="mono small">PC ${c.pc} · SP ${c.sp}</div><div class="xs muted">memory map: process ${cur.p}'s address space</div>`;  // the processor box: which process and thread is running, its PC and SP, and whose memory map is in use
          const need = last == null ? null : last === 'thread' ? 2 : 4;  // need is how many of the four costs the last switch paid: none yet, 2 for a thread switch, 4 for a process switch
          chk.innerHTML = `<div class="xs b muted" style="letter-spacing:.06em">${need == null ? 'WHAT A SWITCH COSTS' : last === 'thread' ? 'THREAD SWITCH: ' + need + ' OF 4 COSTS' : 'PROCESS SWITCH: ALL ' + need + ' COSTS'}</div>` +  // checklist heading: what a switch costs, or how many of the costs this switch paid
            CHK.map((txt, i) => { const st = need == null ? 'idle' : i < need ? 'done' : 'skip'; return `<div class="ci ${st}"><span>${st === 'done' ? '✓' : st === 'skip' ? '–' : '○'}</span>${txt}</div>`; }).join('');  // each cost line gets a tick if paid, a crossed-out dash if skipped, or an empty circle before any switch
        }  // ends paint()
        function dispatch(to) {  // dispatch(to): switches the processor to thread to when the student clicks a thread card
          if (to.p === cur.p && to.t === cur.t) { info.innerHTML = 'That thread is already running. Click a different thread to switch the processor to it.'; return; }  // clicking the thread that is already running just explains that nothing changes
          const same = to.p === cur.p;  // same is true if the new thread belongs to the same process
          const from = cur; cur = to; last = same ? 'thread' : 'process';  // remembers the old thread, moves the processor to the new one, and records the kind of switch
          info.innerHTML = same  // the explanation line depends on the kind of switch
            ? `<b style="color:var(--thread)"><span class="t">Thread switch</span></b> inside process ${to.p}: save thread ${from.t + 1}'s registers, load thread ${to.t + 1}'s. Code, data, open files and the memory map stay put, so there is little to do.`  // thread switch: only registers change; code, data, files and memory map stay, so little work
            : `<b style="color:var(--proc)"><span class="t">Process switch</span></b> from ${from.p} to ${to.p}: besides the registers, the OS must switch to ${to.p}'s <span class="t">address space</span>, and the processor's cached address translations and data, built up for ${from.p}, no longer help. Much more work.`;  // process switch: the address space changes too and the processor's caches stop helping, so much more work
          paint();  // redraws the cards, processor and checklist
        }  // ends dispatch()
        const seg = ctx.ui.seg([1, 2, 3, 4].map((v) => ({ value: v, label: v + (v === 1 ? ' thread' : '') })), n, (v) => {  // a switch for choosing 1 to 4 threads in process A
          n = v; if (cur.p === 'A' && cur.t >= n) cur = { p: 'A', t: 0 }; last = null;  // stores the new count; if the running thread disappeared, thread 1 takes over; clears the last switch
          info.innerHTML = n === 1 ? 'With one thread the process can only do one thing at a time: this is the classic <b>single-threaded</b> process.' : `Process A now has <b>${n} threads</b>. Each has its own context and stack; all of them share the resources above.`;  // explains a single-threaded process, or how many threads A now has and what they share
          paint();  // redraws with the new number of threads
        });  // closes the thread-count switch
        const resBtns = RES.map(([name, d]) => h('button', { type: 'button', class: 'res', onclick: () => { info.innerHTML = `<b style="color:var(--proc)">${name}</b> (shared): ${d}`; } }, name));  // one button per shared resource; clicking one explains it in the info line
        info.innerHTML = 'Each thread keeps its own <b>processor context</b> and <b>stack</b>. Everything in the shaded area is shared. Click a resource to learn more, or click another thread to switch the processor to it.';  // the opening explanation: each thread has its own context and stack, everything shaded is shared
        el.append(h('div', { class: 'split l fill' },  // lays step 4 out as two columns side by side
          h('div', { class: 'stack', style: { gap: '9px' } },  // left column: the definitions
            h('p', { class: 'lead m0', html: 'A <span class="t">process</span> once had one thread, so it did one thing at a time. <span class="t">Multithreading</span> divides a process into several threads that can run concurrently.' }),  // lead paragraph: a process once had one thread; multithreading divides it into several
            h('div', { class: 'card thread tight', html: '<b><span class="t">Thread</span></b> = a <b>dispatchable unit of work</b>: what the scheduler actually picks to run. It has its own <b>processor context</b> (program counter, stack pointer, other registers) and its own <b>data area for a stack</b>. It runs its instructions one after another and is <b>interruptible</b>, so the processor can turn to another thread.' }),  // card: a thread is a dispatchable unit of work with its own context and stack
            h('div', { class: 'card proc tight', html: '<b>Process</b> = a collection of <b>one or more threads</b> plus the <b>system resources</b> they share: memory holding code and data, open files and devices.' }),  // card: a process is one or more threads plus the resources they share
            h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'Threads of one process share memory, so switching between them is cheap and they can cooperate through shared data. That pays off when an application has <b>independent tasks</b> that need not wait for each other.' })),  // "Why it matters" box: shared memory makes thread switches cheap and cooperation easy
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the interactive anatomy
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'Threads in process A:'), seg),  // the thread-count switch with its label
            h('div', { class: 'pgrid' },  // the two process boxes side by side
              h('div', { class: 'pbox' },  // process A's box
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, 'Process A · database server'), h('span', { class: 'xs muted' }, 'one address space')),  // its title (a database server) and a note that it has one address space
                h('div', { class: 'shared' }, h('div', { class: 'xs b', style: { color: 'var(--proc)', letterSpacing: '.06em' } }, 'SHARED BY ALL ITS THREADS'), h('div', { class: 'res-grid' }, ...resBtns)),  // the shaded shared area with its four resource buttons
                aThreads),  // process A's thread cards; closes A's box
              h('div', { class: 'pbox' },  // process B's box
                h('div', {}, h('b', {}, 'Process B'), h('div', { class: 'xs muted' }, 'web browser')),  // its title and subtitle: a web browser
                h('div', { class: 'shared' }, h('div', { class: 'xs', style: { lineHeight: 1.3 } }, 'its own code, data, files, devices')),  // its shared area, which is its own and not shared with A
                bThread)),  // process B's thread card; closes B's box and the grid
            h('div', { class: 'grid-2', style: { gap: '8px', gridTemplateColumns: '2fr 3fr' } }, cpu, chk),  // the processor box and the cost checklist side by side
            info)));  // the explanation line; closes both columns
        paint();  // draws the step in its starting state
      },  // ends render() for step 4
    },  // ends step 4
    /* ---------------- 5. Lab: a database server with one thread, a process per request, or a thread per request ---------------- */
    {  // step 5 starts: a lab that runs a database server three ways and compares the timelines
      title: 'Lab: a database server under load',  // step 5 title shown at the top of the page
      kind: 'lab',  // kind: 'lab' labels this step as a hands-on lab
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds step 5 when the student arrives
        const { h, s } = ctx;  // takes the page-element and SVG builders from the guide
        const C1 = 2, W = 12, C2 = 2;                       // per request: work, disk wait, work (time units)
        const COST = { single: { create: 0, sw: 0 }, procs: { create: 5, sw: 2 }, threads: { create: 1, sw: 1 } };  // COST: time to create a worker and to switch between workers, for each server design
        // deterministic one-CPU simulation; returns CPU segments, per-request segments and finish times
        function simServer(design) {  // simServer(design): simulates four requests on one processor and returns the timeline and finish times
          const c = COST[design];  // c holds this design's creation and switch costs
          const R = ['A', 'B', 'C', 'D'].map((id) => ({ id, phase: 0, readyAt: 0, started: false, done: null, segs: [] }));  // R: the four requests A-D, each tracking its phase, when it is next ready, whether it started, when it finished, and its bars
          const cpu = [];  // cpu collects the bars for the processor's own row
          const push = (arr, type, t0, t1, id) => { if (t1 > t0) arr.push({ type, t0, t1, id }); };  // push(): adds a bar from t0 to t1 to a list, skipping bars of zero length
          let t = 0;  // t is the simulated clock
          if (design === 'single') {  // the single-threaded design handles one request at a time
            for (const r of R) {  // goes through the requests in order
              push(r.segs, 'queued', 0, t);  // the request waits in line from time 0 until the server reaches it
              push(r.segs, 'run', t, t + C1); push(cpu, 'run', t, t + C1, r.id); t += C1;  // it computes for C1 units; the processor's row shows the same bar; the clock moves on
              push(r.segs, 'io', t, t + W); push(cpu, 'idle', t, t + W); t += W;  // it waits W units for the disk, and with only one thread the processor sits idle the whole time
              push(r.segs, 'run', t, t + C2); push(cpu, 'run', t, t + C2, r.id); t += C2;  // it computes for C2 more units to build its reply
              r.done = t;  // the request is finished at the current time
            }  // ends the loop over requests
          } else {  // the process-per-request and thread-per-request designs let requests overlap
            let queue = R.slice();  // queue holds the requests that still need the processor
            while (R.some((r) => r.done == null)) {  // keeps going until every request has finished
              queue.sort((a, b) => a.readyAt - b.readyAt || a.id.localeCompare(b.id));  // orders the queue by when each request becomes ready, then by name, so the run is the same every time
              const r = queue.find((q) => q.readyAt <= t);  // r is the first request that is ready now, if any
              if (!r) { const nt = Math.min(...queue.map((q) => q.readyAt)); push(cpu, 'idle', t, nt); t = nt; continue; }  // if nobody is ready, the processor idles until the next request comes back from the disk
              queue = queue.filter((q) => q !== r);  // takes r out of the queue
              push(r.segs, 'queued', r.readyAt, t);  // r's bar for the time it waited for the processor
              const ov = r.started ? c.sw : c.create;  // the overhead is the creation cost on a request's first turn, and the switch cost after that
              push(r.segs, 'ovh', t, t + ov); push(cpu, 'ovh', t, t + ov, r.id); t += ov;  // draws the overhead as a bar on both rows and advances the clock
              const burst = r.phase === 0 ? C1 : C2;  // burst is the computing this turn: C1 before the disk read, C2 after it
              push(r.segs, 'run', t, t + burst); push(cpu, 'run', t, t + burst, r.id); t += burst;  // draws the computing on both rows and advances the clock
              r.started = true;  // from now on this request pays only the switch cost
              if (r.phase === 0) { r.phase = 1; push(r.segs, 'io', t, t + W); r.readyAt = t + W; queue.push(r); } else r.done = t;  // after its first burst, the request waits for the disk and rejoins the queue when the disk is done; after its second, it is finished
            }  // ends the scheduling loop
          }  // ends the design choice
          const sum = (type) => cpu.filter((x) => x.type === type).reduce((a, x) => a + x.t1 - x.t0, 0);  // sum(type): adds up how long the processor spent on one kind of bar
          return { R, cpu, end: t, avg: R.reduce((a, r) => a + r.done, 0) / R.length, busy: sum('run'), ovh: sum('ovh') };  // returns the timelines, the finishing time, the average finishing time, useful processor time and overhead
        }  // ends simServer()
        const SIM = { single: simServer('single'), procs: simServer('procs'), threads: simServer('threads') };  // SIM: runs all three designs once, up front, since the results never change
        const TMAX = 64, X0 = 74, X1 = 596, px = (u) => X0 + (u / TMAX) * (X1 - X0);  // the timeline covers 0-64 units; px(u) turns a time into a horizontal pixel position between X0 and X1
        const ROWY = { CPU: 32, A: 94, B: 136, C: 178, D: 220 }, RH = 30;  // ROWY: the height of each row (the processor, then requests A-D); RH is the row height
        const CLS = { run: 's-proc', ovh: 's-warn', io: 's-io', queued: 's-panel', idle: null };  // CLS: the colour class for each kind of bar; idle bars are not drawn
        const svg = s('svg', { viewBox: '0 0 640 280', width: '100%', role: 'img', 'aria-label': 'Server timeline' });  // the timeline drawing, 640 by 280 units
        const stats = h('div', { class: 'stack', style: { gap: '6px' } });  // stats: the card with the scores for the chosen design
        const cap = h('div', { class: 'info-line small', style: { borderLeftColor: 'var(--thread)' } });  // cap: the explanation line under the timeline
        let design = 'single';  // design is the server design currently shown
        function seg(x, yKey, cls) {  // seg(x, yKey, cls): draws one bar x on the row named yKey
          const y = ROWY[yKey] + (yKey === 'CPU' ? -2 : 0), hh = yKey === 'CPU' ? RH + 2 : RH;  // the processor row's bars are slightly taller than the request rows
          const w = px(x.t1) - px(x.t0);  // w is the bar's width in pixels
          const g = [s('rect', { x: px(x.t0) + 0.5, y, width: Math.max(1, w - 1), height: hh, rx: 4, class: cls, 'stroke-width': 1.3, 'stroke-dasharray': x.type === 'queued' ? '3 3' : null, style: x.type === 'ovh' ? 'fill:var(--warn)' : null })];  // the bar: queued time dashed, overhead filled solid amber
          if (x.type === 'run' && yKey === 'CPU' && w >= 14) g.push(s('text', { x: px(x.t0) + w / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, x.id));  // a running bar on the processor row wide enough to fit a label shows which request it is serving
          if (x.type === 'io' && w >= 60) g.push(s('text', { x: px(x.t0) + w / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': 12.5, style: 'fill:var(--io)', 'font-weight': 700 }, 'disk'));  // a disk wait wide enough gets the word "disk"
          return g;  // hands back the bar and any label
        }  // ends seg()
        function draw() {  // draw(): redraws the timeline, the scores and the explanation for the chosen design
          const S = SIM[design];  // S is the simulation result for this design
          const k = [];  // k collects the shapes for the drawing
          for (let u = 0; u <= TMAX; u += 8) {  // draws a faint grid line every 8 time units
            k.push(s('line', { x1: px(u), y1: 14, x2: px(u), y2: 256, class: 's-muted', 'stroke-width': 1, opacity: 0.6 }));  // the grid line itself
            k.push(s('text', { x: px(u), y: 273, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(u)));  // the time label under it
          }  // ends the grid
          k.push(s('text', { x: 8, y: ROWY.CPU + 20, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'CPU'));  // "CPU" label for the processor row
          k.push(s('line', { x1: 8, y1: 76, x2: 632, y2: 76, class: 's-muted', 'stroke-width': 1 }));  // a line separating the processor row from the request rows
          S.cpu.forEach((x) => { if (x.type !== 'idle') k.push(...seg(x, 'CPU', CLS[x.type])); });  // draws every non-idle bar on the processor row
          S.cpu.filter((x) => x.type === 'idle' && px(x.t1) - px(x.t0) > 40).forEach((x) => k.push(s('text', { x: (px(x.t0) + px(x.t1)) / 2, y: ROWY.CPU + 19, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'idle')));  // writes "idle" inside any long idle gap on the processor row
          S.R.forEach((r) => {  // draws each request's row
            k.push(s('text', { x: 8, y: ROWY[r.id] + 20, 'font-size': 13.5, 'font-weight': 700 }, 'Req ' + r.id));  // the row label, "Req A" and so on
            r.segs.forEach((x) => k.push(...seg(x, r.id, CLS[x.type])));  // every bar of this request: queued, overhead, running and disk
            k.push(s('text', { x: px(r.done) + 5, y: ROWY[r.id] + 20, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--ok)' }, '✓' + r.done));  // a green tick and the finishing time just after the request's last bar
          });  // ends the request rows
          svg.replaceChildren(...k);  // replaces everything in the drawing with the new shapes
          const pct = Math.round((S.busy / S.end) * 100);  // pct: the share of time the processor did useful work
          stats.innerHTML = `${/* rebuilds the scores card */''}
            <div class="kpis">${/* the two big numbers side by side */''}
              <div><div class="xs muted b">ALL FOUR DONE AT</div><div class="big">${S.end}</div></div>${/* score: the time at which all four requests are done */''}
              <div><div class="xs muted b">AVERAGE RESPONSE</div><div class="big">${ctx.util.fmt(S.avg, 1)}</div></div>${/* score: the average response time, rounded to one decimal place */''}
            </div>${/* end of the two big numbers */''}
            <div class="small">CPU doing useful work: <b>${S.busy} of ${S.end}</b> units (${pct}%)</div>${/* line: useful processor time out of the total, with the percentage */''}
            <div class="meter"><i style="width:${pct}%;background:var(--proc)"></i></div>${/* a bar showing that percentage */''}
            <div class="small">CPU spent creating and switching: <b style="color:var(--warn)">${S.ovh} units</b></div>`;  // line: time spent creating and switching, in amber; ends the scores text
          const f = SIM.single, p = SIM.procs, t = SIM.threads;  // short names for the three results, used in the captions
          cap.innerHTML = design === 'single'  // the caption depends on the design
            ? `<b>One thread does everything.</b> While request A waits ${W} units for the disk, the whole server waits too: the CPU is idle and B, C and D stand in line. Everything is done only at ${f.end}.`  // single-threaded: the whole server waits whenever one request waits for the disk
            : design === 'procs'  // otherwise, if process per request
              ? `<b>One process per request.</b> While A waits for the disk, B can run, so the waits overlap and all four are done at ${p.end}. But creating a process (${COST.procs.create} units) and switching address spaces (${COST.procs.sw} units) cost <b>${p.ovh} units</b> of pure overhead.`  // process per request: waits overlap, but creating processes and switching address spaces cost a lot of overhead
              : `<b>One thread per request, all in one process.</b> The waits overlap just as with processes, but creating a thread (${COST.threads.create} unit) and switching threads (${COST.threads.sw} unit) is cheap, so everything is done at ${t.end}, with only ${t.ovh} units of overhead. Busy servers go further: they create a <b>pool of threads</b> once, at start-up, and hand each new request to an idle thread.`;  // thread per request: waits overlap and creating and switching threads is cheap, so it finishes soonest
        }  // ends draw()
        const segCtl = ctx.ui.seg([{ value: 'single', label: 'Single-threaded' }, { value: 'procs', label: 'Process per request' }, { value: 'threads', label: 'Thread per request' }], design, (v) => { design = v; draw(); });  // the design switch; choosing a design redraws the lab
        if (!ctx.narrow) segCtl.style.flex = 'none';  // on a wide screen the switch keeps its natural width instead of stretching
        el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },  // lays step 5 out: an instruction row above two columns
          h('div', { class: 'row' + (ctx.narrow ? '' : ' nw'), style: { justifyContent: 'space-between', gap: '16px' } },  // the top row, kept on one line on a wide screen
            h('p', { class: 'small m0', html: 'Four clients send a request to a database server at the same moment. Each request needs <b>2 units</b> of processing, then <b>waits 12 units</b> for the disk, then <b>2 more units</b> to build the reply. One CPU. Pick a server design:' }),  // instruction: four requests, each 2 units of work, a 12-unit disk wait and 2 more units, on one CPU
            segCtl),  // the design switch at the right of the row
          h('div', { class: 'split r grow', style: { height: 'auto' } },  // the two columns below
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: the timeline and its explanation
              h('div', { class: 'card white tight', style: { padding: '6px 8px' } }, svg,  // the timeline in a white card
                h('div', { class: 'row gap-s xs', style: { marginTop: '2px' } },  // the legend row under the timeline
                  h('span', { class: 'lg' }, h('i', { class: 'sw run' }), 'running'), h('span', { class: 'lg' }, h('i', { class: 'sw ovh' }), 'creating / switching'),  // legend entries: running, and creating or switching
                  h('span', { class: 'lg' }, h('i', { class: 'sw io' }), 'waiting for disk'), h('span', { class: 'lg' }, h('i', { class: 'sw q' }), 'waiting for the CPU'), h('span', { class: 'muted' }, 'time in made-up units'))),  // legend entries: waiting for disk, waiting for the CPU, and a note that the times are made up
              cap,  // the explanation line for the chosen design
              // one-line reminder so this lab also makes sense on the core path, which skips the step that defines threads
              h('p', { class: 'small muted m0', html: '<b>Recall:</b> a <span class="t">thread</span> is a unit of work, inside a process, that the scheduler runs.' })),  // reminder of what a thread is, for students who skipped step 4; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the scores and the comparison table
              h('div', { class: 'card tight' }, stats),  // the scores card
              h('table', { class: 'tbl compact', html: `<tr><th></th><th>Thread</th><th>Process</th></tr>${/* comparison table header: thread versus process */''}
                <tr><td>Create one</td><td class="b" style="color:var(--ok)">${COST.threads.create} unit</td><td class="b" style="color:var(--warn)">${COST.procs.create} units</td></tr>${/* table row: creating one costs 1 unit for a thread, 5 for a process */''}
                <tr><td>Switch to it</td><td class="b" style="color:var(--ok)">${COST.threads.sw} unit</td><td class="b" style="color:var(--warn)">${COST.procs.sw} units</td></tr>${/* table row: switching costs 1 unit for a thread, 2 for a process */''}
                <tr><td>Share the server's data</td><td>directly: same memory</td><td>needs IPC or shared memory</td></tr>${/* table row: threads share data directly, processes need IPC or shared memory */''}
                <tr><td>One crashes</td><td>can take down the whole server</td><td>only that process dies</td></tr>` }),  // table row: a crashing thread can take down the whole server, a crashing process only itself; ends the table
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"Threads only help when there are several processors." Not so: this server has <b>one CPU</b>, yet threads win, because one request computes while the others wait for the disk.' })))));  // "Common mistake" box: threads help even on one CPU, because one request computes while others wait; closes the layout
        draw();  // draws the lab for the first design
      },  // ends render() for step 5
    },  // ends step 5
    /* ---------------- 6. SMP: multiprogramming vs multiprocessing timeline + the four advantages ---------------- */
    {  // step 6 starts: a timeline comparing one, two and three processors, plus the four advantages of SMP
      title: 'SMP: several processors, one operating system',  // step 6 title shown at the top of the page
      kind: 'explore',  // kind: 'explore' marks this as a step where the student clicks to explore
      render(el, ctx) {  // render(el, ctx): builds step 6 when the student arrives
        const { h, s } = ctx;  // takes the page-element and SVG builders from the guide
        const BURSTS = [[4, 4, 3], [3, 5, 2], [5, 3, 2]];   // P1..P3: run, wait for I/O, run (time units)
        const FAIL_T = 5;  // FAIL_T: the time at which CPU 2 fails in the availability demo
        // tick-by-tick simulation: first-come first-served ready queue, a process keeps its processor until it blocks or ends
        function simSMP(nCpu, fail) {  // simSMP(nCpu, fail): simulates the three processes on nCpu processors, one time unit at a time; fail makes CPU 2 break
          const P = BURSTS.map((b, i) => ({ i, b, ph: 0, left: b[0], st: 'ready', done: null, row: [] }));  // P: each process with its bursts, current phase, time left in that phase, state, finish time and per-tick history
          const cpus = Array.from({ length: nCpu }, (_, k) => ({ k, cur: null, alive: true, row: [] }));  // cpus: each processor with the process it is running, whether it still works, and its per-tick history
          const ready = [0, 1, 2];  // ready: the ready queue, first come first served, starting with all three processes
          let t = 0, lost = null;  // t is the clock; lost will name the process that was on CPU 2 when it failed
          for (; t < 60; t++) {  // steps the clock forward one unit at a time, up to 60 units at most
            if (fail && t === FAIL_T && cpus[1] && cpus[1].alive) {  // in the failure demo, CPU 2 breaks at FAIL_T
              cpus[1].alive = false;  // marks CPU 2 as broken
              if (cpus[1].cur != null) { lost = 'P' + (cpus[1].cur + 1); P[cpus[1].cur].st = 'ready'; ready.push(cpus[1].cur); cpus[1].cur = null; }  // the process it was running goes back to the ready queue so another processor can pick it up
            }  // ends the failure check
            for (const c of cpus) if (c.alive && c.cur == null && ready.length) { c.cur = ready.shift(); P[c.cur].st = 'run'; }  // every working, idle processor takes the next process from the ready queue
            if (P.every((p) => p.st === 'done')) break;  // stops once every process has finished
            P.forEach((p) => { const c = cpus.find((q) => q.cur === p.i); p.row.push(p.st === 'run' ? 'C' + (c.k + 1) : p.st); });  // records each process's state for this tick: which CPU it runs on, or ready, io or done
            cpus.forEach((c) => c.row.push(!c.alive ? 'dead' : c.cur == null ? 'idle' : 'P' + (c.cur + 1)));  // records each processor's state: broken, idle, or the process it runs
            const fin = [];  // fin collects the processes whose current phase ends this tick
            P.forEach((p) => { if (p.st === 'run' || p.st === 'io') { p.left--; if (p.left === 0) fin.push(p); } });  // every running process, and every process waiting for I/O, has one unit less to go
            fin.sort((a, b) => a.i - b.i).forEach((p) => {  // handles the finished phases in process order, so ties always resolve the same way
              if (p.st === 'run') cpus.find((q) => q.cur === p.i).cur = null;  // a process that was running frees its processor
              p.ph++;  // moves on to its next phase
              if (p.ph >= p.b.length) { p.st = 'done'; p.done = t + 1; }  // after its last phase the process is done, at the end of this tick
              else if (p.ph % 2 === 1) { p.st = 'io'; p.left = p.b[p.ph]; }  // an odd phase is an I/O wait
              else { p.st = 'ready'; p.left = p.b[p.ph]; ready.push(p.i); }  // an even phase is another run, so the process rejoins the ready queue
            });  // ends the phase handling
          }  // ends the clock loop
          const busy = cpus.reduce((a, c) => a + c.row.filter((x) => x[0] === 'P').length, 0);  // busy: total processor time spent running processes
          const avail = cpus.reduce((a, c) => a + c.row.filter((x) => x !== 'dead').length, 0);  // avail: total processor time available, not counting a broken processor
          return { P, cpus, end: t, busy, lost, util: busy / Math.max(1, avail) };  // returns the histories, the finish time, busy time, the lost process and the share of time processors were busy
        }  // ends simSMP()
        const runs = (row) => { const out = []; row.forEach((v, t) => { const l = out[out.length - 1]; if (l && l.v === v) l.t1 = t + 1; else out.push({ v, t0: t, t1: t + 1 }); }); return out; };  // runs(row): merges a per-tick history into stretches of the same value, so each stretch becomes one bar
        let n = 1, fail = false, adv = null;  // n is the number of processors, fail turns on the failure demo, adv is the advantage being explained
        const TMAX = 20, X0 = 76, X1 = 604, px = (u) => X0 + (u / TMAX) * (X1 - X0);  // the timeline covers 0-20 units; px(u) turns a time into a horizontal pixel position
        const svg = s('svg', { viewBox: '0 0 640 268', width: '100%', role: 'img', 'aria-label': 'Processor timeline' });  // the timeline drawing, 640 by 268 units
        const modeLbl = h('div', { class: 'mode-lbl' });  // modeLbl: the line naming the mode, multiprogramming or multiprocessing
        const resultLn = h('div', { class: 'row gap-s' });  // resultLn: the row of result chips
        const info = h('div', { class: 'info-line small', style: { borderLeftColor: 'var(--cpu)', minHeight: '84px' } });  // info: the explanation line under the timeline
        function draw() {  // draw(): runs the simulation for the chosen settings and redraws everything
          const R = simSMP(n, fail), base = simSMP(1, false);  // R is the result for the chosen settings; base is always one processor, for comparison
          const k = [];  // k collects the shapes for the drawing
          for (let u = 0; u <= TMAX; u += 2) {  // draws a faint grid line every 2 time units
            k.push(s('line', { x1: px(u), y1: 8, x2: px(u), y2: 244, class: 's-muted', 'stroke-width': 1, opacity: 0.55 }));  // the grid line itself
            k.push(s('text', { x: px(u), y: 261, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(u)));  // the time label under it
          }  // ends the grid
          const PY = [12, 46, 80], CY = [140, 174, 208], H = 28;  // PY: heights of the three process rows; CY: heights of the three processor rows; H: bar height
          R.P.forEach((p, i) => {  // draws each process's row
            k.push(s('text', { x: 8, y: PY[i] + 19, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'P' + (i + 1)));  // the row label, P1 to P3
            runs(p.row).forEach((r) => {  // turns the process's history into bars
              if (r.v === 'done') return;  // nothing is drawn after the process is done
              const x = px(r.t0) + 0.5, w = px(r.t1) - px(r.t0) - 1;  // x and w are the bar's position and width
              const run = r.v[0] === 'C';  // run is true while the process is on a processor
              k.push(s('rect', { x, y: PY[i], width: w, height: H, rx: 5, class: run ? 's-cpu' : r.v === 'io' ? 's-io' : 's-panel', 'stroke-width': 1.4, 'stroke-dasharray': r.v === 'ready' ? '3 3' : null }));  // the bar: blue while running, orange during I/O, dashed grey while waiting in the ready queue
              const lbl = run ? (w > 70 ? 'on CPU ' + r.v[1] : w > 44 ? 'CPU ' + r.v[1] : 'C' + r.v[1]) : r.v === 'io' && w > 60 ? 'I/O wait' : '';  // the bar's label, shortened to fit: which CPU it runs on, or "I/O wait"
              if (lbl) k.push(s('text', { x: x + w / 2, y: PY[i] + 19, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: run ? 'fill:var(--cpu)' : 'fill:var(--io)' }, lbl));  // draws the label if there is room for one
            });  // ends the bars of this process
            k.push(s('text', { x: px(p.done) + 5, y: PY[i] + 19, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--ok)' }, '✓' + p.done));  // a green tick and the finish time after the last bar
          });  // ends the process rows
          k.push(s('line', { x1: 8, y1: 125, x2: 632, y2: 125, class: 's-muted', 'stroke-width': 1 }));  // a line separating the process rows from the processor rows
          [0, 1, 2].forEach((ci) => {  // draws the three processor rows
            k.push(s('text', { x: 8, y: CY[ci] + 19, 'font-size': 14, 'font-weight': 800, style: ci < n ? 'fill:var(--cpu)' : '', class: ci < n ? '' : 's-sub' }, 'CPU ' + (ci + 1)));  // the row label, CPU 1 to CPU 3, greyed out for processors not installed
            if (ci >= n) {  // for a processor that is not installed
              k.push(s('rect', { x: X0, y: CY[ci], width: X1 - X0, height: H, rx: 5, class: 's-muted', 'stroke-dasharray': '5 5', 'stroke-width': 1.2 }));  // a dashed empty bar across the whole row
              k.push(s('text', { x: (X0 + X1) / 2, y: CY[ci] + 19, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'empty slot: no processor installed'));  // labelled "empty slot: no processor installed"
              return;  // and nothing more for this row
            }  // ends the empty-slot case
            runs(R.cpus[ci].row).forEach((r) => {  // turns the processor's history into bars
              const x = px(r.t0) + 0.5, w = px(r.t1) - px(r.t0) - 1;  // x and w are the bar's position and width
              if (r.v === 'idle') { if (w > 50) k.push(s('text', { x: x + w / 2, y: CY[ci] + 19, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'idle')); return; }  // idle stretches are not drawn, only labelled "idle" if wide enough
              const dead = r.v === 'dead';  // dead is true after the processor has failed
              k.push(s('rect', { x, y: CY[ci], width: w, height: H, rx: 5, class: dead ? 's-bad' : 's-proc', 'stroke-width': 1.4 }));  // the bar: which process runs, or red once the processor has failed
              k.push(s('text', { x: x + w / 2, y: CY[ci] + 19, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: dead ? 'fill:var(--bad)' : 'fill:var(--proc)' }, dead ? (w > 120 ? '✗ failed at t = ' + FAIL_T : '✗') : r.v));  // the bar's label: the process name, or the failure time in red
            });  // ends the bars of this processor
          });  // ends the processor rows
          svg.replaceChildren(...k);  // replaces everything in the drawing with the new shapes
          const overlap = n > 1;  // overlap is true with more than one processor
          modeLbl.innerHTML = overlap  // the mode line depends on how many processors there are
            ? '<span class="chip cpu">Multiprocessing</span><span>interleaving <b>and</b> overlapping: bars in different rows run at the same instant</span>'  // multiprocessing: interleaving and overlapping, bars in different rows run at the same instant
            : '<span class="chip proc">Multiprogramming</span><span>interleaving only: at any instant just one process is running</span>';  // multiprogramming: interleaving only, one process running at any instant
          const sp = base.end / R.end;  // sp: the speed-up, how many times sooner everything finishes than on one processor
          resultLn.innerHTML = `<span class="chip ok">all done at t = ${R.end}</span><span class="chip">processors busy ${Math.round(R.util * 100)}% of the time</span><span class="chip accent">${n === 1 && !fail ? 'baseline' : 'speed-up ×' + ctx.util.fmt(sp, 2) + ' vs 1 CPU'}</span>`;  // result chips: finish time, how busy the processors were, and the speed-up (or "baseline" for one processor)
          failBtn.disabled = n === 1;  // the failure button only works with more than one processor
          failBtn.classList.toggle('on', fail && n > 1);  // the failure button stays lit while the failure demo is on
          advBtns.forEach((b) => b.classList.toggle('on', b.dataset.adv === adv));  // lights the button of the advantage being explained
          info.innerHTML = explain(R, base);  // writes the explanation for the current settings
        }  // ends draw()
        function explain(R, base) {  // explain(R, base): picks the explanation to show, based on the chosen advantage or settings
          const two = simSMP(2, false), three = simSMP(3, false);  // runs two- and three-processor versions for comparison in the text
          if (adv === 'perf') return `<b>Performance.</b> When work can run in parallel, several processors finish it sooner. The same three processes finish at <b>${two.end}</b> on two processors instead of <b>${base.end}</b> on one.`;  // performance: parallel work finishes sooner, with the two-processor time against the one-processor time
          if (adv === 'avail') return `<b>Availability.</b> Every processor can do every job, so losing one does not stop the machine. CPU 2 fails at t = ${FAIL_T} while running ${R.lost}; in this idealized model the OS rescues ${R.lost}, puts it back in the ready queue, and CPU 1 carries on. Done at <b>${R.end}</b> instead of ${two.end}: slower, but still working.`;  // availability: when CPU 2 fails the OS puts its process back in the queue and CPU 1 carries on
          if (adv === 'grow') return `<b><span class="t">Incremental growth</span>.</b> Need more speed? Add a processor instead of buying a new computer. A third processor moves the finish time from <b>${two.end}</b> to <b>${three.end}</b>.`;  // incremental growth: adding a third processor, with the finish times before and after
          if (adv === 'scale') return `<b><span class="t">Scaling</span>.</b> A vendor can sell a family of machines with 1, 2 or 3 processors at different prices, all running the same software: finish times <b>${base.end}</b>, <b>${two.end}</b>, <b>${three.end}</b>. Notice the gains shrink: three processes that often wait for I/O cannot keep many processors busy.`;  // scaling: a family of 1-, 2- and 3-processor machines running the same software, with shrinking gains
          if (n === 1) return `With <b>one processor</b> the OS keeps the processor busy by switching to another process whenever one waits for I/O. The three processes <b>take turns</b>, and everything is done at <b>${R.end}</b>. Now try 2 processors.`;  // with one processor and no advantage chosen: the processes take turns
          if (fail) return R.lost  // with the failure demo on and no advantage chosen
            ? `CPU 2 fails at t = ${FAIL_T} while running ${R.lost}. In this idealized model the OS rescues ${R.lost} and puts it back in the ready queue, and the remaining processor${n > 2 ? 's pick' : ' picks'} it up. Everything is done at <b>${R.end}</b>: slower, but the machine keeps working.`  // if CPU 2 was running something: the OS puts it back in the queue and the other processors pick it up; slower but still working
            : `CPU 2 fails at t = ${FAIL_T} while it happens to be idle, so no running work is lost; the other processors share what is left. Everything is done at <b>${R.end}</b>.`;  // if CPU 2 happened to be idle: no running work is lost
          return `With <b>${n} processors</b> the OS runs different processes (or different threads of one process) at the same instant, so the bars in different rows <b>overlap</b>. Everything is done at <b>${R.end}</b> instead of ${base.end}.`;  // with several processors and no advantage chosen: bars in different rows overlap, so work finishes sooner
        }  // ends explain()
        const segN = ctx.ui.seg([{ value: 1, label: '1 CPU' }, { value: 2, label: '2 CPUs' }, { value: 3, label: '3 CPUs' }], n, (v) => { n = v; if (n === 1) fail = false; adv = null; draw(); });  // the 1 / 2 / 3 CPU switch; changing it turns off the failure demo if only one is left and clears the chosen advantage
        const failBtn = h('button', { class: 'btn sm intr', type: 'button', onclick: () => { fail = !fail; adv = null; draw(); } }, 'Fail CPU 2 at t = ' + FAIL_T);  // the button that turns the CPU 2 failure demo on or off
        const ADV = [['perf', 'Performance', 2, false], ['avail', 'Availability', 2, true], ['grow', 'Incremental growth', 3, false], ['scale', 'Scaling', 3, false]];  // ADV: the four advantages as [id, label, processors to show, whether CPU 2 should fail]
        const advBtns = ADV.map(([id, label, nn, ff]) => h('button', { class: 'btn sm', type: 'button', 'data-adv': id, onclick: () => { adv = id; n = nn; fail = ff; segN.set(n); draw(); } }, label));  // one button per advantage; clicking sets up the matching number of processors and failure, then redraws
        el.append(h('div', { class: 'split l fill' },  // lays step 6 out as two columns side by side
          h('div', { class: 'stack', style: { gap: '8px' } },  // left column: what SMP is and the four advantage buttons
            h('p', { class: 'm0', style: { fontSize: '17.5px', lineHeight: '1.45' }, html: '<span class="t">Symmetric multiprocessing (SMP)</span> names both a kind of hardware (section 1.8) and the OS behaviour that makes use of it. An SMP computer has:' }),  // intro paragraph: SMP names both a kind of hardware and the OS behaviour that uses it
            h('ul', { class: 'small m0 tight-list', html: '<li><b>two or more similar processors</b> of comparable power,</li><li><b>sharing main memory and I/O</b> over a bus or other link, each reaching memory about equally fast,</li><li>each able to <b>do every job</b>, even run the OS (hence <i>symmetric</i>),</li><li>under <b>one integrated OS</b> that schedules work on all of them.</li>' }),  // bullet list: the features of an SMP computer
            h('div', { class: 'xs b muted', style: { letterSpacing: '.07em', marginTop: '2px' } }, 'FOUR POTENTIAL ADVANTAGES: CLICK ONE'),  // small heading: four potential advantages, click one
            h('div', { class: 'grid-2', style: { gap: '6px' } }, ...advBtns),  // the four advantage buttons in two columns
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'These are <b>potential</b> advantages, not guarantees. They appear only if there is parallel work to do and the OS actually spreads it across the processors.' }),  // "Common mistake" box: the advantages are potential, not guaranteed
            h('div', { class: 'card tight small', style: { lineHeight: '1.4' }, html: '<b style="color:var(--proc)"><span class="t">Multiprogramming</span></b> (one processor): processes are <b>interleaved</b>, so they only <i>seem</i> to run together. <b style="color:var(--cpu)"><span class="t">Multiprocessing</span></b> (several processors): they are interleaved <b>and overlapped</b>, truly running at the same instant.' })),  // card: multiprogramming interleaves on one processor, multiprocessing also overlaps on several
          h('div', { class: 'stack', style: { gap: '7px' } },  // right column: the controls, the timeline and the results
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, segN, failBtn),  // the CPU switch and the failure button on one row
            modeLbl,  // the mode line
            h('div', { class: 'card white tight', style: { padding: '6px 8px' } }, svg,  // the timeline in a white card
              h('div', { class: 'row gap-s xs' },  // the legend row under the timeline
                h('span', { class: 'lg' }, h('i', { class: 'sw cpu' }), 'running on a processor'), h('span', { class: 'lg' }, h('i', { class: 'sw io' }), 'waiting for I/O'),  // legend entries: running on a processor, and waiting for I/O
                h('span', { class: 'lg' }, h('i', { class: 'sw q' }), 'ready, waiting for a processor'), h('span', { class: 'lg' }, h('i', { class: 'sw run' }), 'process on this CPU'))),  // legend entries: ready and waiting for a processor, and a process on this CPU (the processor rows)
            resultLn, info)));  // the result chips and the explanation line; closes both columns
        draw();  // draws the step for one processor
      },  // ends render() for step 6
    },  // ends step 6
    /* ---------------- 7. Distributed OS + object-oriented design ---------------- */
    {  // step 7 starts: two small demos, a distributed OS on a cluster and object-oriented extension of a kernel
      title: 'Beyond one box: distributed OSs and object design',  // step 7 title shown at the top of the page
      kind: 'learn',  // kind: 'learn' labels this step as reading with small demos
      render(el, ctx) {  // render(el, ctx): builds step 7 when the student arrives
        const { h, s } = ctx;  // takes the page-element and SVG builders from the guide
        /* ---- left: a cluster with and without a distributed OS ---- */
        const FILES = [{ f: 'photos/', node: 0 }, { f: 'orders.db', node: 1 }, { f: 'logs/', node: 2 }];  // FILES: three files, each stored on one node of the cluster
        let unified = false, pickF = 1;  // unified is true in "With a distributed OS" mode; pickF is the file the student picked
        const NX = [14, 186, 358], NW = 150;  // NX: the left edge of each node box; NW: the width of a node box
        const svg = s('svg', { viewBox: '0 0 522 192', width: '100%', role: 'img', 'aria-label': 'A cluster of three computers' });  // the cluster drawing, 522 by 192 units
        const files = h('div', { class: 'row gap-s' });  // files: the row of file buttons
        const dInfo = h('div', { class: 'info-line small', style: { borderLeftColor: 'var(--io)', minHeight: '62px' } });  // dInfo: the explanation line under the cluster drawing
        function drawCluster() {  // drawCluster(): redraws the cluster in the chosen mode, with the picked file's disk highlighted
          const k = [s('rect', { x: 206, y: 2, width: 110, height: 30, rx: 9, class: 's-proc', 'stroke-width': 2 }), s('text', { x: 261, y: 22, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'You')];  // k starts with the "You" box at the top, standing for the user
          if (unified) {  // with a distributed OS
            k.push(s('rect', { x: 4, y: 50, width: 514, height: 112, rx: 14, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '7 5', opacity: 0.9 }));  // a dashed box around all three nodes: they act as one system
            k.push(s('text', { x: 261, y: 67, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--accent)' }, 'ONE SYSTEM: one memory space · one file space'));  // label: one memory space, one file space
            k.push(s('line', { x1: 261, y1: 32, x2: 261, y2: 48, class: 's-line', 'marker-end': 'url(#arr)' }));  // a single arrow from you to the whole system
          } else {  // without a distributed OS
            NX.forEach((x) => k.push(s('line', { x1: 261, y1: 32, x2: x + NW / 2, y2: 72, class: 's-line', 'stroke-dasharray': '4 3', 'marker-end': 'url(#arr)' })));  // three dashed arrows from you, one to each node
            k.push(s('text', { x: 92, y: 46, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'three logins'), s('text', { x: 430, y: 46, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'three file trees'));  // notes: three separate logins and three separate file trees
          }  // ends the mode choice
          NX.forEach((x, i) => {  // draws each node
            const hit = FILES[pickF].node === i;  // hit is true if the picked file lives on this node
            k.push(s('rect', { x, y: 74, width: NW, height: 82, rx: 10, class: 's-panel', 'stroke-width': 1.5 }));  // the node's box
            k.push(s('text', { x: x + 10, y: 91, 'font-size': 13, 'font-weight': 800 }, 'Node ' + (i + 1)));  // the node's name
            k.push(s('rect', { x: x + 10, y: 99, width: 56, height: 48, rx: 6, class: 's-mem', 'stroke-width': 1.3 }), s('text', { x: x + 38, y: 128, 'text-anchor': 'middle', 'font-size': 12.5, style: 'fill:var(--mem)', 'font-weight': 700 }, 'memory'));  // the node's memory
            k.push(s('rect', { x: x + 74, y: 99, width: 66, height: 48, rx: 6, class: 's-io', 'stroke-width': hit ? 3.5 : 1.3 }), s('text', { x: x + 107, y: 119, 'text-anchor': 'middle', 'font-size': 12.5, style: 'fill:var(--io)', 'font-weight': 700 }, 'disk'), s('text', { x: x + 107, y: 137, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': hit ? 800 : 500, class: 's-monot' }, FILES.find((f) => f.node === i).f));  // the node's disk and the file stored there, outlined heavily if it holds the picked file
          });  // ends the nodes
          k.push(s('line', { x1: 40, y1: 172, x2: 482, y2: 172, class: 's-line', 'stroke-width': 3 }), s('text', { x: 261, y: 188, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, 'fast network'));  // the fast network line along the bottom, with its label
          NX.forEach((x) => k.push(s('line', { x1: x + NW / 2, y1: 156, x2: x + NW / 2, y2: 172, class: 's-line', 'stroke-width': 2 })));  // a short line connecting each node to the network
          svg.replaceChildren(...k);  // replaces everything in the drawing with the new shapes
          files.replaceChildren(h('span', { class: 'xs b muted' }, unified ? 'ONE TREE:' : 'FILES:'), ...FILES.map((f, i) => h('button', { type: 'button', class: 'btn sm mono' + (i === pickF ? ' on' : ''), onclick: () => { pickF = i; drawCluster(); } }, unified ? '/' + f.f : 'node' + (f.node + 1) + ':/' + f.f)));  // file buttons: one tree of paths with a distributed OS, or node-by-node names without one
          const f = FILES[pickF];  // f is the picked file
          dInfo.innerHTML = unified  // the explanation depends on the mode
            ? `You open <code>/${f.f}</code> like a local file; the OS fetches it from <b>node ${f.node + 1}'s disk</b>. Programs likewise see one memory spanning all nodes.`  // with a distributed OS: you open the file like a local one and the OS fetches it from the right node
            : `You must know <code>${f.f}</code> is on <b>node ${f.node + 1}</b>, log in there and use its file tree; a program sees only its own node's memory.`;  // without: you must know which node holds it and log in there
        }  // ends drawCluster()
        const dSeg = ctx.ui.seg([{ value: false, label: 'Without a distributed OS' }, { value: true, label: 'With a distributed OS' }], unified, (v) => { unified = v; drawCluster(); });  // the "Without / With a distributed OS" switch; flipping it redraws the cluster
        dSeg.style.alignSelf = 'flex-start';  // keeps the switch at its natural width
        /* ---- right: object-oriented extension of a small kernel ---- */
        const SLOTS = [  // SLOTS: the three interfaces of the small kernel, each with the operations it offers
          { id: 'fs', iface: 'File system', ops: 'open · read · write' },  // interface: file system, with open, read and write
          { id: 'net', iface: 'Network protocol', ops: 'send · receive' },  // interface: network protocol, with send and receive
          { id: 'dev', iface: 'Device', ops: 'start · stop' },  // interface: device, with start and stop
        ];  // closes SLOTS
        const OBJS = [  // OBJS: the four objects that can be plugged in; slot names the interface each one fits
          { id: 'local', slot: 'fs', name: 'Local file system', why: 'Stores files on this machine\'s disk. It offers exactly the <b>open · read · write</b> interface, so every program can use it.' },  // object: a local file system
          { id: 'remote', slot: 'fs', name: 'Remote file system', why: 'Same interface, but each call is forwarded to a file server on another machine. Programs cannot tell the difference, which is how objects <b>ease building distributed tools</b>.' },  // object: a remote file system with the same interface, which eases building distributed tools
          { id: 'proto', slot: 'net', name: 'New network protocol', why: 'A new protocol object plugs into the <b>send · receive</b> interface. The kernel core is not edited, so it cannot be broken by the change.' },  // object: a new network protocol, added without editing the kernel core
          { id: 'drv', slot: 'dev', name: 'New device driver', why: 'Support for new hardware arrives as one more object behind the <b>start · stop</b> interface: the OS is <b>customized without disrupting its integrity</b>.' },  // object: a new device driver, customizing the OS without disrupting it
        ];  // closes OBJS
        const plugged = { fs: null, net: null, dev: null };  // plugged: which object sits in each socket, empty at the start
        let changed = null;   // the slot that just received an object (only it animates)
        const slotsEl = h('div', { class: 'slots' });  // slotsEl: the row of three sockets
        const oInfo = h('div', { class: 'info-line small', style: { borderLeftColor: 'var(--os)', minHeight: '62px' } });  // oInfo: the explanation line under the sockets
        const status = h('div', { class: 'row gap-s' });  // status: the row of chips under the kernel core
        function drawObjs() {  // drawObjs(): redraws the sockets, the status chips and the object buttons
          slotsEl.replaceChildren(...SLOTS.map((sl) => {  // builds one socket per interface
            const o = OBJS.find((x) => x.id === plugged[sl.id]);  // o is the object currently in this socket, if any
            return h('div', { class: 'slot' + (o ? ' full' : '') },  // the socket, marked full once something is plugged in
              h('div', { class: 'iface' }, h('b', {}, sl.iface), h('span', { class: 'xs mono' }, sl.ops)),  // the socket's interface name and its operations
              h('div', { class: 'obj' + (o && changed === sl.id ? ' fade-in' : '') }, o ? o.name : 'empty socket'));  // the object's name, or "empty socket"; only a newly plugged object fades in
          }));  // ends the sockets
          const nPl = Object.values(plugged).filter(Boolean).length;  // nPl counts the objects plugged in
          status.innerHTML = `<span class="chip os">objects plugged in: ${nPl}</span><span class="chip ok">kernel core changed: no ✓</span>`;  // chips: how many objects are plugged in, and that the kernel core never changed
          objBtns.forEach((b) => b.classList.toggle('on', plugged[OBJS.find((o) => o.id === b.dataset.o).slot] === b.dataset.o));  // lights each object button whose object is currently plugged in
        }  // ends drawObjs()
        const objBtns = OBJS.map((o) => h('button', { type: 'button', class: 'btn sm os', 'data-o': o.id, onclick: () => { plugged[o.slot] = o.id; changed = o.slot; oInfo.innerHTML = `<b>${o.name}</b>: ${o.why}`; drawObjs(); } }, '+ ' + o.name));  // one button per object; clicking plugs it into its socket (replacing what was there) and explains it
        oInfo.innerHTML = 'Plug objects into the small kernel. Each one must fit an <b>interface</b>: a fixed list of operations the rest of the system is allowed to call.';  // the opening explanation: each object must fit an interface, a fixed list of operations
        el.append(h('div', { class: 'split fill' },  // lays step 7 out as two cards side by side
          h('div', { class: 'card white stack', style: { gap: '7px' } },  // left card: the distributed OS demo
            h('h3', { class: 'm0', html: '<span class="t">Distributed operating system</span>' }),  // heading: distributed operating system (a glossary term)
            h('p', { class: 'small m0', html: 'A <span class="t">cluster</span> is a group of complete computers on a fast network working together. A distributed OS gives the <b>illusion of one machine</b>: one main memory, one secondary-memory space, and unified services such as a <span class="t">distributed file system</span>.' }),  // paragraph: a cluster, and a distributed OS giving the illusion of one machine
            dSeg, h('div', {}, svg), files, dInfo,  // the mode switch, the cluster drawing, the file buttons and the explanation line
            h('p', { class: 'm0', style: { fontSize: '13.5px' }, html: '<b>Reality check:</b> still <b>less mature</b> than uniprocessor and SMP OSs.' })),  // reality check: distributed OSs are still less mature; closes the left card
          h('div', { class: 'card white stack', style: { gap: '7px' } },  // right card: the object-oriented design demo
            h('h3', { class: 'm0', html: '<span class="t">Object-oriented design</span>' }),  // heading: object-oriented design (a glossary term)
            h('p', { class: 'small m0', html: 'Build the OS from <b>objects</b>: modules that hide their insides and are used only through a defined <b>interface</b>. A small kernel is then extended in a <b>disciplined, modular</b> way.' }),  // paragraph: objects hide their insides behind interfaces, so a small kernel grows in a disciplined way
            h('div', { class: 'kcore' }, h('b', {}, 'Small kernel core'), status),  // the kernel core box with its status chips
            slotsEl,  // the three sockets under the core
            h('div', { class: 'row gap-s' }, ...objBtns),  // the row of object buttons
            oInfo,  // the explanation line for the last object plugged in
            h('ul', { class: 'small m0 tight-list', html: '<li>Adds <b>modular extensions</b> to a small kernel in a disciplined way.</li><li>Lets programmers <b>customize</b> the OS without disrupting system integrity.</li><li>Eases building <b>distributed tools</b> and full distributed OSs.</li>' }))));  // bullet list: three benefits of object-oriented design; closes the right card and the layout
        drawCluster(); drawObjs();  // draws both demos in their starting state
      },  // ends render() for step 7
    },  // ends step 7
    /* ---------------- 8. Recap: match each development to the problem it solves ---------------- */
    {  // step 8 starts: a recap game matching each development to the problem it solves
      title: 'Recap: match each development to its problem',  // step 8 title shown at the top of the page
      kind: 'recap',  // kind: 'recap' labels this step as a recap
      render(el, ctx) {  // render(el, ctx): builds step 8 when the student arrives
        const { h } = ctx;  // takes the page-element builder from the guide
        const DEV = {  // DEV: the full name of each development, looked up by its short id
          smp: 'Symmetric multiprocessing', ood: 'Object-oriented design', micro: 'Microkernel architecture', dist: 'Distributed operating system', mt: 'Multithreading',  // the five developments by id
        };  // closes DEV
        const PROB = [  // PROB: the five problems; dev is the id of the development that solves each, why explains the match
          { dev: 'micro', text: 'The kernel has grown huge. A bug in any driver can crash the whole machine, and every change means editing the kernel.',  // problem 1: a huge kernel where one driver bug crashes everything (microkernel)
            why: 'Keep only IPC, address spaces and basic scheduling in the kernel; run every other service as a user-mode server that talks by messages.' },  // explanation for the microkernel match
          { dev: 'mt', text: 'A database server must keep answering other clients while one client\'s request waits for the disk.',  // problem 2: a database server must keep answering while one request waits for the disk (multithreading)
            why: 'Give each request its own thread inside one process: threads are cheap to create and switch, and they share the server\'s data.' },  // explanation for the multithreading match
          { dev: 'smp', text: 'One processor cannot keep up with the load, and the machine must keep running even if a processor fails.',  // problem 3: one processor is not enough and the machine must survive a processor failure (SMP)
            why: 'Several similar processors share memory under one OS: potential gains in performance, availability, incremental growth and scaling.' },  // explanation for the SMP match
          { dev: 'dist', text: 'Users want a room of networked computers to behave like one machine with one memory and one set of files.',  // problem 4: a room of networked computers should act like one machine (distributed OS)
            why: 'A distributed OS gives the illusion of a single main memory and a single secondary-memory space, with a distributed file system.' },  // explanation for the distributed OS match
          { dev: 'ood', text: 'Developers want to extend and customize the OS without putting the integrity of the whole system at risk.',  // problem 5: extend the OS safely without risking its integrity (object-oriented design)
            why: 'Objects with defined interfaces plug into a small kernel in a disciplined, modular way, and they ease building distributed tools.' },  // explanation for the object-oriented design match
        ];  // closes PROB
        const ORDER = ['smp', 'ood', 'micro', 'dist', 'mt'];  // ORDER: the fixed order of the development buttons, chosen so they do not line up with the problems
        const matched = new Set();  // matched holds the numbers of the problems already solved
        let selP = null, selD = null;  // selP is the selected problem and selD the selected development, or null
        const probCol = h('div', { class: 'stack', style: { gap: '5px', flex: 'none' } });  // probCol: the column of problem buttons
        const devCol = h('div', { class: 'stack', style: { gap: '7px' } });  // devCol: the column of development buttons
        const fb = h('div', { class: 'info-line small', style: { borderLeftColor: 'var(--chc)', minHeight: '86px' } });  // fb: the feedback line, edged in the chapter colour
        const prog = h('span', { class: 'chip accent' });  // prog: the chip counting matches
        function paint() {  // paint(): redraws both columns and the progress chip
          probCol.replaceChildren(...PROB.map((p, i) => {  // rebuilds the problem column
            const done = matched.has(i);  // done is true if this problem is already matched
            return h('button', { type: 'button', class: 'mprob' + (done ? ' done' : '') + (selP === i ? ' sel' : ''), 'aria-label': 'Problem ' + (i + 1), onclick: () => { if (done) { fb.innerHTML = `<b>${DEV[p.dev]}</b>: ${p.why}`; return; } selP = selP === i ? null : i; check(); } },  // a problem button; a solved one shows its explanation when clicked, an open one is selected or unselected
              h('span', { class: 'mnum' }, done ? '✓' : String(i + 1)),  // the number badge, or a tick once solved
              h('span', { class: 'mtext' }, p.text),  // the problem text
              done ? h('span', { class: 'chip ok mdev' }, DEV[p.dev]) : null);  // once solved, a green chip names the development that fits
          }));  // ends the problem column
          devCol.replaceChildren(...ORDER.map((d) => {  // rebuilds the development column in ORDER
            const done = PROB.some((p, i) => p.dev === d && matched.has(i));  // done is true if this development's problem is already matched
            return h('button', { type: 'button', class: 'mdevbtn' + (done ? ' done' : '') + (selD === d ? ' sel' : ''), disabled: done, onclick: () => { selD = selD === d ? null : d; check(); } }, (done ? '✓ ' : '') + DEV[d]);  // a development button, disabled once used; clicking selects or unselects it
          }));  // ends the development column
          prog.textContent = `${matched.size} / ${PROB.length} matched`;  // updates the chip: N of 5 matched
        }  // ends paint()
        function check() {  // check(): runs after every click to see whether a problem and a development are both selected
          if (selP != null && selD != null) {  // both are selected, so judge the pair
            const p = PROB[selP];  // p is the selected problem
            if (p.dev === selD) {  // the development fits the problem
              matched.add(selP);  // records the match
              fb.innerHTML = matched.size === PROB.length  // writes the feedback for a right match; the wording depends on whether it was the last one
                ? `<b style="color:var(--ok)">All five matched.</b> Three forces (new hardware, new applications, new security threats) pushed operating systems toward these five developments. Click any card to reread its explanation.`  // after the last match: a closing message tying the five developments back to the three forces
                : `<b style="color:var(--ok)">Right: ${DEV[selD]}.</b> ${p.why}`;  // otherwise, "Right" followed by the explanation
            } else {  // the development does not fit
              fb.innerHTML = `<b style="color:var(--bad)">Not quite.</b> ${DEV[selD]} does not solve problem ${selP + 1}. Ask yourself: is the pain about the kernel's structure, one application doing many things, too little processor power, many machines, or safe extension?`;  // "Not quite", with a hint listing the kinds of pain each development answers
            }  // ends the right/wrong choice
            selP = null; selD = null;  // clears both selections for the next try
          } else if (selP != null) fb.innerHTML = `Problem ${selP + 1} selected. Now click the development that solves it.`;  // only a problem is selected: asks for the development
          else if (selD != null) fb.innerHTML = `<b>${DEV[selD]}</b> selected. Now click the problem it solves.`;  // only a development is selected: asks for the problem
          paint();  // redraws both columns
        }  // ends check()
        fb.innerHTML = 'Click a problem, then the development that answers it. Say the reason out loud before you click.';  // the opening instruction in the feedback line
        el.append(h('div', { class: 'split r fill' },  // lays step 8 out as two columns side by side
          h('div', { class: 'stack', style: { gap: '8px' } },  // left column: the problems and a reminder card
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Problems'), prog),  // "Problems" heading with the progress chip
            probCol,  // the problem buttons
            h('div', { class: 'card tight small', style: { lineHeight: '1.4' } },  // reminder card
              h('div', { class: 'xs b muted', style: { letterSpacing: '.07em', marginBottom: '3px' } }, 'ALSO REMEMBER'),  // its small "ALSO REMEMBER" heading
              h('ul', { class: 'm0 tight-list', html: '<li>Three forces: <b>new hardware</b>, <b>new applications</b>, <b>new security threats</b>.</li><li>Multiprogramming <b>interleaves</b>; multiprocessing interleaves <b>and overlaps</b>.</li><li>A thread switch keeps the address space, so it is <b>cheaper</b> than a process switch.</li>' }))),  // reminder list: three forces, interleave versus overlap, and why a thread switch is cheaper; closes the left column
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the developments, feedback and controls
            h('h4', { class: 'm0', style: { lineHeight: '24px' } }, 'Developments'),  // "Developments" heading, sized to line up with the left heading
            devCol, fb,  // the development buttons and the feedback line
            h('div', { class: 'row gap-s' },  // the row with the two control buttons
              h('button', { type: 'button', class: 'btn sm', onclick: () => { PROB.forEach((_, i) => matched.add(i)); selP = selD = null; fb.innerHTML = 'All answers shown. Click any problem card to read why its development fits.'; paint(); } }, 'Show all answers'),  // "Show all answers" marks every problem as matched so each explanation can be read
              h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { matched.clear(); selP = selD = null; fb.innerHTML = 'Fresh start. Click a problem, then the development that answers it.'; paint(); } }, 'Start over')),  // "Start over" clears every match
            h('div', { class: 'card tight small', style: { lineHeight: '1.4' } },  // a second reminder card
              h('ul', { class: 'm0 tight-list', html: '<li>A microkernel keeps only <b>address spaces, IPC and basic scheduling</b>; other services run as user-mode servers.</li><li>Threads help even on <b>one</b> processor; with SMP, threads of one process can also run in parallel.</li>' })))));  // reminder list: what a microkernel keeps, and that threads help even on one processor; closes the layout
        paint();  // draws the game in its starting state
      },  // ends render() for step 8
    },  // ends step 8
    /* ---------------- 9. Check yourself ---------------- */
    {  // step 9 starts: the end-of-section quiz, drawn by the guide's quiz engine
      title: 'Check yourself',  // step 9 title shown at the top of the page
      kind: 'check',  // kind: 'check' labels this step as a self-check
      quiz: [  // quiz: the list of questions; each has a type (multiple choice if none is given), the answer and an explanation (why)
        { q: 'Which functions does a <b>microkernel</b> keep inside the kernel?',  // question 1 (multiple choice): which functions a microkernel keeps inside the kernel
          choices: ['Address-space management, interprocess communication (IPC) and basic scheduling', 'File systems, device drivers and networking', 'Every OS service, running together in kernel mode in one shared address space', 'None: every OS service runs in user mode'],  // the four choices: the core three, the services that move out, everything, or nothing
          answer: 0,  // the right answer is choice 0 (counting from 0): address spaces, IPC and basic scheduling
          feedback: [null, 'Those are exactly the services a microkernel moves out of the kernel into user-mode server processes.', 'That describes a monolithic kernel, the opposite design.', 'Something privileged must still manage address spaces, deliver messages and switch the processor between processes.'],  // feedback for each wrong choice; null marks the right one, which needs none
          why: 'A microkernel keeps only the essential core (address spaces, IPC and basic scheduling). Everything else runs as server processes in user mode that communicate by messages.' },  // explanation shown after answering: only the essential core stays; the rest are user-mode servers
        { type: 'multi', q: 'Which of these are benefits usually claimed for a <b>microkernel</b> design? Select all that apply.',  // question 2 (select all): the benefits usually claimed for a microkernel
          choices: ['A simpler kernel, with less privileged code to get right', 'Flexibility: services can be added, replaced or removed without changing the kernel', 'A good fit for distributed systems, because local and remote servers are both reached by messages', 'Faster requests, because each request needs fewer trips through the kernel'],  // choices; "faster requests" is the trap, since messages add trips through the kernel
          answer: [0, 1, 2],  // the right answers are choices 0, 1 and 2
          why: 'The first three are the classic benefits. The last is backwards: passing messages between user-mode servers usually means <b>more</b> trips through the kernel, which is the main performance cost of a microkernel.' },  // explanation: the first three are real benefits; the speed claim is backwards
        { type: 'order', q: 'In a microkernel system, put the steps of an application reading part of a file in order.',  // question 3 (put in order): the message hops of a file read in a microkernel system
          items: ['The application sends a request message to the file server', 'The microkernel delivers the message to the file server', 'The file server sends a message asking the disk-driver process for the blocks', 'The disk-driver process reads the blocks and replies to the file server', 'The file server sends the data back to the application in a reply message'],  // the steps in the right order (the quiz shuffles them for the student)
          why: 'Every hop is a message delivered through the microkernel: request to the file server, request to the driver, the driver\'s reply, then the reply to the application.' },  // explanation: every hop is a message delivered through the microkernel
        { q: 'Which of these does each <b>thread</b> keep for itself instead of sharing it with the other threads of its process?',  // question 4 (multiple choice): what each thread keeps for itself
          choices: ['Its processor context (program counter and other registers) and its stack', 'The program code', 'The table of open files', 'The global variables and the heap'],  // choices: its context and stack, or one of the things the process shares
          answer: 0,  // the right answer is choice 0, the context and stack
          feedback: [null, 'All threads of a process run code from the same copy of the program.', 'Open files belong to the process, so every thread in it can use them.', 'Global data and the heap live in the shared address space; any thread can reach them.'],  // feedback for each wrong choice: code, open files and globals are all shared
          why: 'A thread is a dispatchable unit of work: it needs its own saved registers and its own stack. The code, data, open files and devices belong to the process and are shared.' },  // explanation: a thread needs its own registers and stack; everything else belongs to the process
        { q: 'Why is switching the processor between two threads of the <b>same process</b> usually cheaper than switching between two <b>different processes</b>?',  // question 5 (multiple choice): why a thread switch is cheaper than a process switch
          choices: ['The threads share one address space, so the memory map and cached translations stay valid; only the registers and stack pointer change', 'Threads have no registers of their own, so nothing needs to be saved', 'Threads cannot be interrupted, so switches only happen at convenient points', 'Thread switches are carried out entirely by the hardware'],  // choices; only the first gives the real reason, the shared address space
          answer: 0,  // the right answer is choice 0
          feedback: [null, 'Each thread has its own processor context, and it must be saved and restored on every switch.', 'Threads are interruptible; that is what lets the processor turn to another thread at any moment.', 'Software (the OS or a thread library) still performs the switch.'],  // feedback for each wrong choice: threads do have registers, can be interrupted, and are switched by software
          why: 'A process switch must also change the address space, which makes cached memory translations and data stale. Threads of one process skip that work.' },  // explanation: a process switch must change the address space, which makes caches stale
        { type: 'num', q: 'Five requests reach a single-threaded file server at the same moment, and it handles them strictly one after another. Each request needs 3 ms of processing, then waits 10 ms for the disk, then needs 2 ms more processing. How many milliseconds pass before all 5 requests are finished?',  // question 6 (calculate): five requests on a single-threaded server, each 3 + 10 + 2 ms
          answer: 75, tol: 0, unit: 'ms',  // the answer is 75 ms, with no tolerance for rounding
          why: 'One thread cannot overlap anything, so each request takes 3 + 10 + 2 = 15 ms and 5 × 15 = <b>75 ms</b>. A multithreaded server could process other requests during the disk waits.' },  // explanation: nothing overlaps, so 5 times 15 ms
        { type: 'tf', q: 'Multithreading is useful only on a computer that has more than one processor.',  // question 7 (true or false): multithreading helps only with several processors (false)
          answer: false,  // the statement is false
          why: 'Even with one processor, a multithreaded server lets one thread compute while others wait for I/O, so the waits overlap. Multithreading and SMP are independent ideas; on an SMP machine they combine well, because threads of one process can then run on different processors at the same instant.' },  // explanation: threads let computing overlap I/O waits even on one processor, and combine well with SMP
        { type: 'match', q: 'Match each potential advantage of <b>symmetric multiprocessing</b> to its description.',  // question 8 (match): pair each SMP advantage with its description
          pairs: [['Performance', 'Work that can run in parallel finishes sooner'], ['Availability', 'If one processor fails, the machine keeps running at reduced speed'], ['Incremental growth', 'Add a processor instead of replacing the whole machine'], ['Scaling', 'A vendor sells a range of machines with different numbers of processors and prices']],  // the four advantages and their descriptions
          why: 'All four come from having several similar processors that can each do any job under one OS. They are potential advantages: they appear only when the OS spreads parallel work across the processors.' },  // explanation: all four come from similar processors under one OS, and are only potential
        { q: 'Three processes run on one machine. What can <b>multiprocessing</b> do that multiprogramming on a single processor cannot?',  // question 9 (multiple choice): what multiprocessing adds over multiprogramming
          choices: ['Overlap them: two processes can execute at literally the same instant', 'Interleave them: switch between them so that all make progress', 'Keep all three in main memory at the same time', 'Run another process while one waits for I/O'],  // choices: overlapping is the right one; the others are things multiprogramming already does
          answer: 0,  // the right answer is choice 0
          feedback: [null, 'Multiprogramming on one processor already interleaves processes.', 'Multiprogramming already keeps several programs in memory at once.', 'That is exactly what multiprogramming does on a single processor.'],  // feedback for each wrong choice: each describes something one processor can already do
          why: 'On one processor, processes can only be interleaved. With several processors they are interleaved <b>and</b> overlapped: some truly run at the same time.' },  // explanation: one processor can only interleave; several can interleave and overlap
        { type: 'tf', q: 'A distributed operating system gives users the illusion of a single main memory and a single secondary-memory space across a cluster of computers.',  // question 10 (true or false): a distributed OS gives the illusion of one memory and one storage space (true)
          answer: true,  // the statement is true
          why: 'That is its defining goal, together with unified services such as a distributed file system. Such systems are still less mature than uniprocessor and SMP operating systems.' },  // explanation: that is the defining goal, though such systems are still less mature
        { type: 'bucket', q: 'Which force behind modern operating systems does each change belong to?',  // question 11 (sort into groups): which force each change belongs to
          buckets: ['New hardware', 'New applications', 'New security threats'],  // the three groups: new hardware, new applications, new security threats
          items: [['Several processors', 0], ['High-speed networks', 0], ['Multimedia', 1], ['Client/server computing', 1], ['Viruses and worms', 2]],  // the five changes, each tagged with the number of its group
          why: 'Hardware changes (processors, speed, networks, memory), new kinds of applications, and Internet-borne attacks all forced operating-system designs to evolve.' },  // explanation: hardware, applications and attacks all forced OS designs to evolve
        { q: 'What is the main contribution of <b>object-oriented design</b> to operating systems?',  // question 12 (multiple choice): the main contribution of object-oriented design
          choices: ['A disciplined way to add modular extensions to a small kernel, so the OS can be customized without disrupting its integrity', 'Several identical processors running under one operating system', 'One process containing several threads that run concurrently', 'A cluster of computers made to look like one machine'],  // choices: disciplined modular extension, or one of the other developments in disguise
          answer: 0,  // the right answer is choice 0
          feedback: [null, 'That is symmetric multiprocessing.', 'That is multithreading.', 'That is a distributed operating system.'],  // feedback for each wrong choice: names the development each wrong choice really describes
          why: 'Objects hide their internals and are used only through defined interfaces, so extensions plug into a small kernel cleanly. The same idea eases building distributed tools and full distributed OSs.' },  // explanation: objects with defined interfaces plug into a small kernel cleanly
      ],  // closes the quiz list
    },  // ends step 9
  ],  // closes the steps list

  notes: `${/* notes: the section's summary text, shown in the Notes panel that the student can open from the top bar */''}
<h3>Why operating systems had to change</h3>${/* heading for the notes on why operating systems had to change */''}
<p>Early operating systems assumed one slow processor and trusted users. Three forces changed that:</p>${/* notes paragraph: early systems assumed one slow processor and trusted users */''}
<ul>${/* start of the list of three forces */''}
<li><b>New hardware:</b> machines with several processors, much faster processors, high-speed network connections, and larger, more varied memory.</li>${/* notes list item: new hardware */''}
<li><b>New applications:</b> multimedia (smooth sound and video), Internet and Web access, and client/server computing (clients send requests, servers do the work and reply).</li>${/* notes list item: new applications */''}
<li><b>New security threats:</b> once computers joined the Internet, attackers anywhere could reach them with viruses, worms and ever cleverer hacking techniques.</li>${/* notes list item: new security threats */''}
</ul>${/* end of the list of forces */''}
<p>Five developments answered these forces: <b>microkernel architecture</b>, <b>multithreading</b>, <b>symmetric multiprocessing (SMP)</b>, <b>distributed operating systems</b> and <b>object-oriented design</b>.</p>${/* notes paragraph: names the five developments that answered the forces */''}

<h3>Monolithic kernel vs microkernel</h3>${/* heading for the notes on monolithic kernels and microkernels */''}
<p>A <b>monolithic kernel</b> holds almost the whole OS: scheduling, file systems, networking, device drivers, memory management and more. All of these services run together in kernel mode in one shared kernel address space, so any part can call any other part directly, like a function call, with no messages. "Monolithic" describes this structure, not a single process: the same kernel code runs on behalf of whichever process made a system call, as well as in kernel threads and interrupt handlers. In a microkernel, by contrast, most services are separate user-mode server processes that exchange messages.</p>${/* notes paragraph: what a monolithic kernel holds and why its parts call each other directly */''}
<p>A <b>microkernel</b> keeps only the essential core in the kernel: <b>address spaces</b> (which memory each process may use), <b>interprocess communication (IPC)</b> and <b>basic scheduling</b>. Every other service (file system, device drivers, networking, the virtual-memory policy) runs as an ordinary <b>server process in user mode</b>. Applications and servers cooperate by sending <b>messages</b>, and the microkernel delivers each one. The OS offers the same services; they have simply moved out of the kernel.</p>${/* notes paragraph: what a microkernel keeps and how its servers talk by messages */''}
<p><b>One file read.</b> Monolithic: one system call into the kernel, where the file system calls the driver directly (1 trip, 0 messages). Microkernel: application → file server → disk-driver process → file server → application, each hop a message through the kernel (4 messages, 4 trips). That message passing is the classic performance price of a microkernel.</p>${/* notes paragraph: one file read in each design, 1 trip against 4 messages and 4 trips */''}
<h4>Benefits of a microkernel</h4>${/* subheading for the benefits of a microkernel */''}
<ul>${/* start of the benefits list */''}
<li><b>Simpler kernel:</b> far less code runs with full privileges, so there is less to get right.</li>${/* notes list item: simpler kernel */''}
<li><b>Flexibility:</b> servers can be added, replaced or upgraded without changing the kernel.</li>${/* notes list item: flexibility */''}
<li><b>Suits distributed environments:</b> a request message can be forwarded unchanged to a server on another machine, so local and remote servers look the same.</li>${/* notes list item: suits distributed environments */''}
<li><b>Contained failures:</b> a crashed driver server wrecks only its own address space; in a monolithic kernel the same bug can corrupt kernel memory and halt the whole machine.</li>${/* notes list item: contained failures */''}
</ul>${/* end of the benefits list */''}
<p>The three core functions stay in the kernel because each needs privilege: delivering messages, setting up address spaces, switching the processor.</p>${/* notes paragraph: why the three core functions must stay in the kernel */''}

<h3>Threads and processes</h3>${/* heading for the notes on threads and processes */''}
<p><b>Multithreading</b> divides one process into several threads that can run concurrently.</p>${/* notes paragraph: multithreading divides a process into concurrent threads */''}
<ul>${/* start of the thread and process definitions */''}
<li><b>Thread:</b> a dispatchable unit of work (what the scheduler runs). It has its own <b>processor context</b> (program counter, stack pointer and other registers) and its own <b>data area for a stack</b>. It executes its instructions sequentially and is <b>interruptible</b>, so the processor can turn to another thread.</li>${/* notes definition: a thread, with its own context and stack */''}
<li><b>Process:</b> a collection of one or more threads plus the <b>system resources</b> they share: memory holding code and data, open files and devices.</li>${/* notes definition: a process, one or more threads plus shared resources */''}
</ul>${/* end of the definitions */''}
<p><b>Thread switch vs process switch.</b> A thread switch within one process saves the old thread's registers and loads the new thread's registers and stack pointer (2 of 4 costs). A <b>process switch</b> must also switch the memory map to another <b>address space</b> (the range of memory a process may use), after which the processor's cached address translations and data no longer help (all 4 costs). So a thread switch is cheaper.</p>${/* notes paragraph: a thread switch pays 2 of the 4 costs, a process switch pays all 4 */''}
<p>Multithreading pays off when an application has <b>independent tasks</b> that need not wait for each other, such as a database server answering many clients. It helps even on <b>one processor</b> (one thread computes while another waits for I/O). It is independent of SMP but combines well with it: threads of one process can then run on different processors at once.</p>${/* notes paragraph: when multithreading pays off, and how it combines with SMP */''}

<h3>Worked example: a database server</h3>${/* heading for the notes' worked example: the database server lab */''}
<p>Four requests arrive together; each needs 2 units of processing, a 12-unit disk wait, then 2 more units, on one CPU. Illustrative costs: thread create 1 / switch 1; process create 5 / switch 2.</p>${/* notes paragraph: the setup of the example and the made-up costs */''}
<table>${/* start of the results table */''}
<tr><th>Design</th><th>All done at</th><th>Average response</th><th>Overhead</th></tr>${/* table header row: design, finish time, average response, overhead */''}
<tr><td>Single-threaded</td><td>64</td><td>40</td><td>0, but the CPU is busy only 16 of 64 = 25%</td></tr>${/* table row: single-threaded results */''}
<tr><td>Process per request</td><td>44</td><td>38</td><td>28 units</td></tr>${/* table row: process-per-request results */''}
<tr><td>Thread per request</td><td>27</td><td>22.5</td><td>8 units</td></tr>${/* table row: thread-per-request results */''}
</table>${/* end of the results table */''}
<p>Single-threaded total = number of requests × time per request. Example: 5 requests × (3 + 10 + 2) ms = 75 ms, and the processor is busy only 5 of every 15 ms ≈ 33.3%. Threads share the server's data directly; separate processes need IPC or shared memory to share it, but a crash in one process does not take down the others. Real servers often create a <b>thread pool</b> once, at start-up.</p>${/* notes paragraph: the single-threaded formula with a worked example, and the sharing and crash trade-offs */''}

<h3>Symmetric multiprocessing (SMP)</h3>${/* heading for the notes on symmetric multiprocessing */''}
<p>SMP names both a hardware architecture and the OS behaviour that exploits it: two or more similar processors of comparable capability share main memory and I/O over a bus or other link, with about equal memory access time; each can perform every function, even run the OS (hence symmetric); and one integrated OS schedules processes or threads on all of them, hiding the multiple processors from users.</p>${/* notes paragraph: what makes a machine SMP */''}
<p><b>Potential advantages</b> over a single processor (they appear only if there is parallel work and the OS spreads it):</p>${/* notes paragraph: introduces the potential advantages */''}
<ul>${/* start of the advantages list */''}
<li><b>Performance:</b> work that can run in parallel finishes sooner.</li>${/* notes list item: performance */''}
<li><b>Availability:</b> the failure of one processor does not halt the machine; it continues at reduced performance.</li>${/* notes list item: availability */''}
<li><b>Incremental growth:</b> add a processor to boost performance.</li>${/* notes list item: incremental growth */''}
<li><b>Scaling:</b> vendors offer a range of products with different price and performance based on the number of processors.</li>${/* notes list item: scaling */''}
</ul>${/* end of the advantages list */''}
<p><b>Multiprogramming</b> on one processor <b>interleaves</b> processes: they take turns, so they only seem to run together. <b>Multiprocessing</b> on several processors <b>interleaves and overlaps</b> them: some truly run at the same instant. Example: three processes that compute, wait for I/O, then compute again finish at 19 on one CPU, 13 on two, 11 on three (I/O waits limit the gain).</p>${/* notes paragraph: multiprogramming interleaves, multiprocessing interleaves and overlaps, with an example */''}

<h3>Distributed operating systems</h3>${/* heading for the notes on distributed operating systems */''}
<p>A <b>cluster</b> is a group of complete computers on a fast network working together as one resource. A <b>distributed operating system</b> gives the illusion of a single main memory and a single secondary-memory space, plus unified access facilities such as a <b>distributed file system</b>, so users need not know which machine stores a file. Distributed OSs are still less mature than uniprocessor and SMP operating systems.</p>${/* notes paragraph: clusters and the single-system illusion a distributed OS provides */''}

<h3>Object-oriented design</h3>${/* heading for the notes on object-oriented design */''}
<p>Objects are modules that hide their internals and are used only through defined interfaces. In an OS this gives a disciplined way to add <b>modular extensions to a small kernel</b>, lets programmers <b>customize the OS without disrupting system integrity</b>, and <b>eases building distributed tools</b> and full distributed operating systems (a remote object can offer the same interface as a local one).</p>${/* notes paragraph: objects behind interfaces give disciplined, safe extension of a small kernel */''}

<h3>Summary: development → problem it addresses</h3>${/* heading for the notes' summary table of developments and problems */''}
<p><b>Microkernel:</b> a huge, fragile kernel. <b>Multithreading:</b> one application juggling independent tasks cheaply. <b>SMP:</b> too little processing power; surviving a processor failure. <b>Distributed OS:</b> networked computers that should act as one. <b>Object-oriented design:</b> extending the OS safely.</p>${/* notes paragraph: each development paired with the problem it addresses */''}
`,  // end of the notes text
});  // closes the object passed to Guide.section
