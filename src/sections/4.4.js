// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   4.4  Windows Process and Thread Management
   Chapter 4 (Threads). Original teaching material.
   ===================================================================== */
Guide.section({  // registers section 4.4 with the guide; everything inside this call (text, terms, styles, steps) describes the section
  id: '4.4',  // id: the section number, used in the page address, the table of contents and the progress records
  title: 'Windows Process and Thread Management',  // title: the full section name shown at the top of every step
  short: 'Windows threads',  // short: the compact name used in tight lists such as the home page's section list
  summary: 'How Windows builds apps from processes, threads, jobs and fibers, and the six states a thread moves through.',  // summary: the one-line description shown under the section name on the chapter overview
  objectives: [  // objectives: what a student should be able to do after this section; listed in the printable version
    'Describe what a Windows process and a Windows thread each hold, and name the extra building blocks: job objects, thread pools, fibers and user-mode scheduling.',  // objective 1: describe a Windows process and thread and the extra building blocks around them
    'Explain how Windows 8 and later suspend, terminate and restore background apps, and what app developers must do about it.',  // objective 2: explain how Windows 8 and later pause, end and restore background apps
    'Identify the resources of a Windows process (access token, virtual address descriptors, handle table, threads) and sort the attributes of process and thread objects.',  // objective 3: name the resources of a process and sort process and thread object attributes
    'Explain why a multithreaded process is an efficient server, and trace a thread through the six Windows thread states.',  // objective 4: explain why a threaded server is efficient and trace the six thread states
    'Explain how environment subsystems build their own process features on top of the executive\'s generic services.',  // objective 5: explain how environment subsystems build on the executive's generic services
  ],  // closes the objectives list
  terms: [  // terms: glossary entries as [term, definition] pairs; they fill the glossary and the dotted-underline pop-ups
    ['Job object', 'A Windows kernel object that groups several processes so they can be managed as one unit: one set of limits (such as total memory or processor time), one set of accounting totals, and one call to end them all.'],  // glossary entry: defines a job object, a group of processes managed as one unit
    ['Thread pool', 'A set of worker threads that the system keeps ready. The application hands it small pieces of work (callbacks) and an idle worker runs each one, so the program does not create a thread per task.'],  // glossary entry: defines a thread pool, ready worker threads that run small callbacks
    ['Fiber', 'A unit of execution that the application itself schedules by explicitly switching from one fiber to another. Fibers run inside an ordinary thread, and the kernel does not know they exist.'],  // glossary entry: defines a fiber, a unit of execution switched by the application inside one thread
    ['User-mode scheduling (UMS)', 'A lightweight Windows mechanism that lets an application run its own scheduler for its own real threads, switching between them in user mode and regaining control whenever one of them blocks in the kernel. Introduced in 64-bit Windows 7; no longer supported starting with Windows 11.'],  // glossary entry: defines user-mode scheduling (UMS) and the Windows versions that had it
    ['Process lifetime management (PLM)', 'The part of Windows 8 and later that decides when a Modern (Store) app runs, is suspended in the background, or is terminated to free memory.'],  // glossary entry: defines process lifetime management, which runs, suspends or ends Store apps
    ['Background task', 'A small, separately registered piece of an app that Windows runs on a trigger (a timer, a push message, a network change) with a tight budget of processor time and memory while the app itself stays suspended.'],  // glossary entry: defines a background task, a small part of an app run on a trigger with a tight budget
    ['Access token', 'The kernel object that records whom a process runs as: the user\'s security identity, groups and privileges. Windows checks it every time the process tries to open a protected object.'],  // glossary entry: defines an access token, the record of whom a process runs as
    ['Virtual address descriptor (VAD)', 'One record in a tree the memory manager keeps for each process, describing a range of the process\'s virtual addresses that is in use (program image, heap, a thread\'s stack, a mapped file) and how it may be accessed.'],  // glossary entry: defines a virtual address descriptor, one record for a used range of addresses
    ['Handle table', 'The per-process table that lists every object the process has opened. Each entry points to one object, and the entry\'s number is the handle the program uses.'],  // glossary entry: defines the handle table, the per-process list of opened objects
    ['Handle', 'A small number, private to one process, that stands for an object the process has opened. It indexes the process\'s handle table; programs never get a direct pointer to the object.'],  // glossary entry: defines a handle, a small per-process number that stands for an opened object
    ['Working set', 'The pages of a process that are currently in physical memory. Windows lets a process have a minimum and a maximum working-set size.'],  // glossary entry: defines the working set, the process's pages now in physical memory
    ['Thread-local storage (TLS)', 'A small amount of storage that belongs to one thread only: one variable name has a separate value in every thread, so each thread can keep private data (such as its own error code) even though all threads share one address space.'],  // glossary entry: defines thread-local storage, per-thread private values for one variable name
    ['Processor affinity', 'The set of processors a thread is allowed to run on. A process holds a default set for its threads, and each thread may be limited to part of it.'],  // glossary entry: defines processor affinity, the processors a thread may run on
    ['Base priority', 'The starting point of a thread\'s scheduling priority. A process\'s priority class sets the base priority for its threads, and a thread\'s current priority never drops below its own base priority.'],  // glossary entry: defines base priority, the floor of a thread's scheduling priority
    ['Dynamic priority', 'A thread\'s scheduling priority at this moment. Windows may raise it temporarily above the base priority (for example after a wait ends) and lets it fall back over time.'],  // glossary entry: defines dynamic priority, a thread's current priority including temporary boosts
    ['Quantum', 'The amount of processor time a thread may use before the scheduler checks whether another ready thread of the same priority should get a turn. Also called a time slice.'],  // glossary entry: defines a quantum (time slice), the processor time a thread gets before a turn check
    ['Standby state', 'The Windows thread state of a thread that has been chosen to run next on one particular processor and is waiting for that processor to become free.'],  // glossary entry: defines the Standby state, chosen to run next on one processor
    ['Transition state', 'The Windows thread state of a thread that is ready to run except that something it needs, typically its kernel stack, has been paged out of memory.'],  // glossary entry: defines the Transition state, ready except that its kernel stack is paged out
    ['Section object', 'A Windows object that represents a block of memory which can be mapped into the address space of one or more processes; it is how two processes share memory.'],  // glossary entry: defines a section object, a block of memory that processes can share
    ['Environment subsystem', 'A user-mode server process together with its DLLs that gives programs one operating-system "personality", meaning one set of API calls. Win32 is the main subsystem in Windows.'],  // glossary entry: defines an environment subsystem, one operating-system personality (set of API calls)
  ],  // closes the terms list

  css: ` /* css: style rules for this section only; the guide adds them to the page once when the section is registered */
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width and the page scrolls sideways */
    .sec-4-4 .step-eyebrow { contain: inline-size; } /* limits the eyebrow's width to its box so its long text cannot push the page wider than the screen */
    .sec-4-4 .hot { cursor: pointer; outline: none; } /* a clickable part of a drawing gets a pointer cursor and no default focus outline */
    .sec-4-4 .hot .fr { transition: stroke-width .15s, opacity .2s; } /* the frame of a clickable part changes thickness and fade smoothly instead of jumping */
    .sec-4-4 .hot:hover .fr, .sec-4-4 .hot:focus-visible .fr { stroke-width: 3.5; } /* hovering over a clickable part, or reaching it with the Tab key, thickens its frame */
    .sec-4-4 .hot.sel .fr { stroke-width: 4; } /* the currently selected part keeps an even thicker frame so the student sees which one is explained */
    .sec-4-4 .btn.warn { border-color: var(--warn); color: var(--warn); } /* a button in the warning color (used for the fiber building block) gets an amber border and text */
    .sec-4-4 .stgrid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; } /* stgrid: a two-column grid with equal columns, used for the board of cards in the thread-states step */
    .sec-4-4 .btn.on { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); } /* a button marked "on" (the chosen answer or the app in front) turns green */
  `,  // end of the section's style rules

  steps: [  // steps: the list of screens in this section, shown one at a time as the student presses Next
    /* ---------------- 1. Big picture: application → processes → threads ---------------- */
    {  // step 1 begins: the big-picture opener
      title: 'An application is a team of processes and threads',  // step 1 title: an application is a team of processes and threads
      kind: 'story',  // kind 'story' labels the step as the Big Picture and keeps it on the short route through the guide
      render(el, ctx) {  // render(el, ctx) builds step 1 when the student arrives; el is the step's box, ctx holds the guide's helpers
        const { h, s } = ctx;  // h builds ordinary page elements and s builds SVG (the browser's drawing format) elements
        // every clickable part: [title, explanation, owner, workshop analogy]  owner: 'shared' | 'private' | ''
        const INFO = {  // INFO: what to show for each clickable part of the drawing, keyed by a short name
          app: ['Application', 'What the user thinks of as one program. On Windows it can be several processes working together, like this photo studio and the helper process that makes its thumbnails.', '', 'The whole business, which may rent several workshops.'],  // part "app": the application, which can be several processes working together
          procA: ['Process', 'A running instance of a program plus everything it owns: the eight resources in the tiles and at least one thread. The process itself never runs. Its threads do.', '', 'The rented workshop itself.'],  // part "procA": the process, a running program plus what it owns; its threads do the running
          vas: ['Virtual address space', 'The private range of memory addresses this process may use. Its code, its data, its heap and every thread\'s stack all live here, and no other process can see into it.', 'shared', 'The floor space inside the workshop walls.'],  // part "vas": the private virtual address space, shared by all the process's threads
          code: ['Executable code', 'The program\'s instructions, loaded from the .exe file and its DLLs into the address space. Every thread of the process runs code from here.', 'shared', 'The instruction manuals on the shelves.'],  // part "code": the executable code loaded from the program file and its libraries
          handles: ['Open handles to system objects', 'Files, events, other processes and threads this process has opened. Each one is reached through a small number called a <span class="t">handle</span>, and any thread of the process may use it.', 'shared', 'The ring of keys to storerooms and other buildings.'],  // part "handles": open handles to files, events and other objects
          sec: ['Security context', 'Whom the process acts for: the user account, its groups and its privileges, kept in an <span class="t">access token</span>. Windows checks it whenever the process opens something protected.', 'shared', 'The tenant badge that says whose workshop this is.'],  // part "sec": the security context kept in an access token
          pid: ['Unique process ID', 'A number that no other running process has at the same time. Tools and other programs use it to name this process.', 'shared', 'The street number on the door.'],  // part "pid": the unique process ID
          env: ['Environment variables', 'Named text settings such as PATH or TEMP that the process receives when it starts, usually copied from the process that created it.', 'shared', 'The notes pinned inside the door saying where things are kept.'],  // part "env": the environment variables such as PATH
          prio: ['Priority class', 'A coarse importance level for the whole process (Idle, Below normal, Normal, Above normal, High or Real-time). Every thread\'s priority starts from it.', 'shared', 'How much attention the landlord gives this tenant.'],  // part "prio": the process's priority class, the starting point for its threads' priorities
          ws: ['Minimum and maximum working-set size', 'The <span class="t">working set</span> is the process\'s pages now in physical memory. These two sizes bound it, and the memory manager uses them to decide whose pages to keep.', 'shared', 'The fewest and most workbenches kept set up at once.'],  // part "ws": the minimum and maximum working-set size
          thread: ['Thread', 'The part of a process that can be scheduled onto a processor. Threads share the process\'s address space and resources, and each also keeps the five private items listed. Thread 1, created along with the process, is often called the primary thread.', '', 'One worker.'],  // part "thread": a thread, the part that gets scheduled onto a processor
          tid: ['Unique thread ID', 'A number that identifies this one thread. It is separate from the process ID: studio.exe has one process ID and a different thread ID for each of its threads.', 'private', 'The worker\'s own ID badge.'],  // part "tid": the unique thread ID, separate from the process ID
          ctx: ['Saved context', 'A copy of the thread\'s registers (instruction pointer, stack pointer and the rest) kept while it is off the processor, so it resumes exactly where it stopped.', 'private', 'The worker\'s notebook: \"I stopped at step 14.\"'],  // part "ctx": the saved register context that lets a thread resume where it stopped
          tprio: ['Scheduling priority', 'How urgently this particular thread wants a processor. Its <span class="t">base priority</span> comes from the process\'s priority class, and its current value can move up and down for this thread alone.', 'private', 'How urgent this worker\'s current job is.'],  // part "tprio": the thread's own scheduling priority
          tls: ['Thread-local storage', '<span class="t" data-t="Thread-local storage (TLS)">Thread-local storage</span> is a set of private per-thread slots: the same variable name holds a different value in each thread, for example the last error code or the request it is serving.', 'private', 'The worker\'s private drawer.'],  // part "tls": thread-local storage, private per-thread slots
          exc: ['Exception handlers', 'Each thread has its own chain of handlers that decide what happens when its code hits trouble, such as a divide by zero or a bad memory address.', 'private', 'The worker\'s own emergency plan.'],  // part "exc": the thread's own chain of exception handlers
          procB: ['A second process', 'helper.exe belongs to the same application but has its own address space, handles and security context. It cannot simply read studio.exe\'s variables; the two must share memory or send messages through a channel they both set up.', '', 'A second workshop down the street, with its own keys and badge.'],  // part "procB": a second process of the same application, with its own resources
        };  // closes INFO
        const seen = new Set();  // seen: the parts the student has clicked so far, for the "parts explored" counter
        const N = ctx.narrow; // phones: a tall single-column drawing so the text stays readable
        const svg = s('svg', { viewBox: N ? '0 0 340 650' : '0 0 640 332', width: '100%', role: 'img', 'aria-label': 'An application made of two processes; the first process has eight resources and two threads' });  // the SVG drawing: tall and single-column on phones, wide on larger screens
        const hots = {};  // hots: for each part name, the clickable drawing groups that belong to it (a part can appear more than once)
        function hot(key, kids) {  // hot(key, kids): wraps shapes in a clickable, keyboard-focusable group that explains part "key" when chosen
          const g = s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': INFO[key][0] }, ...kids);  // the group gets the .hot class, can be reached with Tab, acts as a button and is named for screen readers
          g.addEventListener('click', (e) => { e.stopPropagation(); pick(key); });  // clicking it picks the part (without also triggering a click on the box around it)
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(key); } });  // pressing Enter or Space on it also picks the part
          (hots[key] = hots[key] || []).push(g);  // remembers the group under its part name so it can be highlighted later
          return g;  // returns the finished group
        }  // ends hot()
        const tile = (key, x, y, w, hgt, cls, l1, l2) => hot(key, [  // tile(): draws one clickable resource tile, a rounded rectangle with one or two lines of text
          s('rect', { x, y, width: w, height: hgt, rx: 8, class: 'fr ' + cls, 'stroke-width': 1.6 }),  // the tile's rectangle; the "fr" class lets the hover and selection rules thicken its frame
          s('text', { x: x + w / 2, y: y + (l2 ? 16 : 24), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 650 }, l1),  // the tile's first line of text, centered (lower down when there is only one line)
          l2 ? s('text', { x: x + w / 2, y: y + 31, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 650 }, l2) : null,  // the second line of text, if there is one
        ]);  // ends tile()
        const TILES = [['vas', 's-mem', 'Virtual', 'address space'], ['code', 's-mem', 'Executable', 'code'], ['handles', 's-os', 'Open handles', 'to objects'], ['sec', 's-os', 'Security', 'context'],  // TILES: the eight process resources as [part, color, line 1, line 2]; the first four here
          ['pid', 's-panel', 'Process ID', ''], ['env', 's-panel', 'Environment', 'variables'], ['prio', 's-cpu', 'Priority', 'class'], ['ws', 's-mem', 'Working-set', 'min / max']];  // the remaining four resources: process ID, environment, priority class and working-set size
        const PILLS = [['tid', 'Thread ID'], ['ctx', 'Saved context'], ['tprio', 'Scheduling priority'], ['tls', 'Thread-local storage'], ['exc', 'Exception handlers']];  // PILLS: the five private items drawn inside each thread box
        const threadBox = (x, y, w, name) => s('g', {},  // threadBox(): draws one thread as a pink box holding its five private items
          hot('thread', [s('rect', { x, y, width: w, height: 152, rx: 10, class: 'fr s-thread', 'stroke-width': 1.8 }),  // the thread box itself is clickable and explains what a thread is
            s('text', { x: x + 12, y: y + 19, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--thread)' }, name)]),  // the thread's name in the top-left corner of the box
          ...PILLS.map(([k, lab], i) => hot(k, [  // one clickable pill for each private item, stacked down the thread box
            s('rect', { x: x + 12, y: y + 28 + i * 24, width: w - 24, height: 20, rx: 6, class: 'fr s-panel', 'stroke-width': 1.2 }),  // the pill's gray rounded rectangle
            s('text', { x: x + w / 2, y: y + 43 + i * 24, 'text-anchor': 'middle', 'font-size': 13 }, lab)])));  // the pill's label, centered; closes the pills and the thread box
        // geometry: [appW, appH, procA rect, tile(i) → [x, y, w], thread boxes, procB drawing]
        const G = N  // G: the drawing's layout, one version for phones and one for wider screens
          ? { app: [336, 646], procA: [10, 34, 320, 534], sub: null, tile: (i) => [20 + (i % 2) * 152, 66 + Math.floor(i / 2) * 44, 144], t1: [20, 246, 300], t2: [20, 406, 300] }  // phone layout: the resource tiles in two columns, the two thread boxes stacked below them
          : { app: [636, 328], procA: [12, 34, 474, 288], sub: 472, tile: (i) => [24 + (i % 4) * 115, 66 + Math.floor(i / 4) * 46, 105], t1: [24, 160, 214], t2: [262, 160, 214] };  // wide layout: the tiles in four columns, the two thread boxes side by side, room for a subtitle
        const procB = N  // procB: the second process, drawn differently for phones and wider screens
          ? hot('procB', [s('rect', { x: 10, y: 578, width: 320, height: 60, rx: 14, class: 'fr s-proc', 'stroke-width': 2 }),  // phones: a short wide box under the first process
            s('text', { x: 24, y: 603, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--proc)' }, 'Process: helper.exe'),  // its title "Process: helper.exe"
            s('text', { x: 24, y: 624, 'font-size': 13, class: 's-sub' }, 'its own resources and its own Thread 1')])  // a note that it has its own resources and its own Thread 1; ends the phone version
          : hot('procB', [s('rect', { x: 496, y: 34, width: 130, height: 288, rx: 14, class: 'fr s-proc', 'stroke-width': 2 }),  // wider screens: a tall box to the right of the first process
            s('text', { x: 561, y: 56, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, style: 'fill:var(--proc)' }, 'Process:'),  // its title "Process:" on the first line
            s('text', { x: 561, y: 74, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'helper.exe'),  // the program name helper.exe on the second line
            s('rect', { x: 508, y: 88, width: 106, height: 58, rx: 8, class: 's-panel', 'stroke-width': 1.2 }),  // a gray box standing for its own resources
            s('text', { x: 561, y: 110, 'text-anchor': 'middle', 'font-size': 13 }, 'its own'),  // first line of that box: "its own"
            s('text', { x: 561, y: 128, 'text-anchor': 'middle', 'font-size': 13 }, 'resources'),  // second line of that box: "resources"
            s('rect', { x: 508, y: 160, width: 106, height: 60, rx: 10, class: 's-thread', 'stroke-width': 1.6 }),  // a pink box standing for its only thread
            s('text', { x: 561, y: 195, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'Thread 1')]);  // labels it "Thread 1"; ends the wide version
        const [ax, ay, aw, ah] = G.procA;  // ax, ay, aw, ah: the first process's position and size, taken from the layout
        svg.append(  // adds every part to the drawing, from the outside in
          hot('app', [s('rect', { x: 2, y: 2, width: G.app[0], height: G.app[1], rx: 16, class: 'fr s-panel', 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }),  // the clickable application outline, a dashed box around everything
            s('text', { x: 16, y: 24, 'font-size': 15, 'font-weight': 800 }, 'Application: Photo studio')]),  // the application's title, "Application: Photo studio"
          hot('procA', [s('rect', { x: ax, y: ay, width: aw, height: ah, rx: 14, class: 'fr s-proc', 'stroke-width': 2 }),  // the clickable first process box
            s('text', { x: ax + 14, y: 56, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--proc)' }, 'Process: studio.exe'),  // its title "Process: studio.exe"
            G.sub ? s('text', { x: G.sub, y: 56, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'resources shared by all its threads') : null]),  // on wide screens, a subtitle saying these resources are shared by all its threads
          ...TILES.map(([k, cls, l1, l2], i) => { const [x, y, w] = G.tile(i); return tile(k, x, y, w, 38, cls, l1, l2); }),  // the eight resource tiles, each placed by the layout's tile() position
          threadBox(...G.t1, 'Thread 1 (primary)'), threadBox(...G.t2, 'Thread 2'),  // the two thread boxes, the primary thread and Thread 2
          procB,  // the second process
        );  // ends the drawing
        const title = h('h3', { class: 'm0' });  // the explanation panel's heading, filled in by pick()
        const body = h('p', { class: 'small m0' });  // the explanation text for the chosen part
        const own = h('div', { class: 'row' });  // a chip saying whether the part is shared by all threads or private to one
        const count = h('span', { class: 'xs muted' });  // the "parts explored" counter
        const ana = h('p', { class: 'small m0', style: { color: 'var(--os)' } });  // the workshop analogy for the chosen part, in the operating-system color
        function pick(key) {  // pick(key): shows the explanation for part "key" and highlights it; runs when a part is clicked
          seen.add(key);  // records the part as explored
          Object.values(hots).flat().forEach((g) => g.classList.remove('sel'));  // removes the highlight from every part
          (hots[key] || []).forEach((g) => g.classList.add('sel'));  // highlights every drawing group that belongs to this part
          const [t, d, o, a] = INFO[key];  // t, d, o, a: the part's title, explanation, owner (shared or private) and analogy
          title.textContent = t; body.innerHTML = d; ana.innerHTML = '<b>In the workshop:</b> ' + a;  // fills the heading, the explanation and the analogy line
          own.innerHTML = o === 'shared' ? '<span class="chip proc">Belongs to the process: shared by every thread</span>' : o === 'private' ? '<span class="chip thread">Private: every thread has its own</span>' : '';  // shows the teal "shared" chip, the pink "private" chip, or nothing for parts that are neither
          count.textContent = `Parts explored: ${seen.size} of ${Object.keys(INFO).length}`;  // updates the counter, such as "Parts explored: 5 of 17"
        }  // ends pick()
        el.append(h('div', { class: 'split l fill' },  // lays out step 1: text on the left, the drawing and its explanation on the right (stacked on phones)
          h('div', { class: 'stack' },  // left column: a stack of paragraphs
            h('p', { class: 'lead m0', html: 'Starting a program on Windows builds a small organisation, not just a copy of the code in memory.' }),  // opening sentence: starting a program builds a small organisation
            h('p', { class: 'm0', html: 'An <b>application</b> is one or more <span class="t">processes</span>. A process is a running instance of a program together with everything it owns. Inside each process, one or more <span class="t">threads</span> do the running: a thread is what the scheduler actually places on a processor.' }),  // paragraph: an application is processes, and threads inside them do the running
            h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A process is a rented workshop: floor space, a tenant badge saying whose it is, keys to the storerooms, a street number. Threads are the workers inside. They share the whole workshop, but each keeps a personal notebook of where they stopped, an emergency plan, a private drawer and an ID badge.' }),  // analogy box: a process is a rented workshop and threads are the workers inside
            h('div', { class: 'callout why m0', 'data-label': 'Where this is going', html: 'Next: extra building blocks, paused background apps, a process opened up, a threaded server, six thread states and subsystems.' })),  // preview box listing what the rest of the section covers; closes the left column
          h('div', { class: 'card white stack', style: { gap: '8px' } }, svg,  // right column: a white card holding the drawing
            h('div', { class: 'card tight stack', style: { gap: '5px', minHeight: '124px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, title, count), body, ana, own),  // the explanation panel: heading and counter on top, then the explanation, analogy and owner chip
            h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'xs muted' }, 'Click any part.'), h('span', { class: 'chip proc' }, 'teal box: shared by all its threads'), h('span', { class: 'chip thread' }, 'pink: private to one thread')))));  // a key under the drawing: click any part, teal means shared, pink means private
        pick('procA');  // opens the step with the first process already explained
        seen.clear(); seen.add('procA');  // resets the explored set so only that starting part counts
        count.textContent = `Parts explored: 1 of ${Object.keys(INFO).length}`;  // shows the counter as 1 explored part
      },  // ends render() for step 1
    },  // ends step 1
    /* ---------------- 2. Jobs, thread pools, fibers, UMS: a matcher ---------------- */
    {  // step 2 begins: a matching game for four more Windows building blocks
      title: 'Four more building blocks: jobs, pools, fibers, UMS',  // step 2 title
      kind: 'lab',  // kind 'lab' labels this as a hands-on lab
      render(el, ctx) {  // render(el, ctx) builds step 2 when the student arrives on it
        const { h } = ctx;  // takes the element builder from ctx
        const TOOLS = [  // TOOLS: the four building blocks; each has a name, a chip, a color, a glossary term, a description and a "not for" hint
          { name: 'Job object', chip: 'Groups processes', cls: 'proc', t: 'Job object',  // tool 0: the job object, which groups processes
            text: 'Put several processes in one job and manage them as a unit: set limits once (total memory, processor time, number of processes), read shared accounting totals, and end them all with one call.',  // description of the job object: shared limits, shared accounting, one call to end them all
            notFor: 'A job object groups <b>processes</b> and puts limits on them; it does not decide which code runs next inside a program.' },  // hint shown when a job object is picked wrongly: it groups processes, it does not schedule code
          { name: 'Thread pool', chip: 'Kernel schedules the workers', cls: 'thread', t: 'Thread pool',  // tool 1: the thread pool, whose workers the kernel schedules
            text: 'The application queues small pieces of work as callbacks; worker threads that the system keeps ready pick them up. No thread per task, and the pool grows or shrinks for you.',  // description of the thread pool: queued callbacks run on ready workers
            notFor: 'A thread pool runs short <b>callbacks</b> on workers the system manages; the program gives up control over which worker runs when.' },  // hint shown when a thread pool is picked wrongly
          { name: 'Fiber', chip: 'App switches, kernel unaware', cls: 'warn', t: 'Fiber',  // tool 2: the fiber, switched by the application with the kernel unaware
            text: 'One thread hosts several fibers and switches between them by explicit calls. A fiber borrows its host thread\'s identity (its ID, its thread-local storage). The kernel sees only the thread, so one blocking fiber stalls them all.',  // description of the fiber: several per thread, switched by explicit calls, one blocking call stalls them all
            notFor: 'A fiber is switched <b>by hand inside one thread</b>; the kernel never sees it, and it has no context of its own at the kernel level.' },  // hint shown when a fiber is picked wrongly
          { name: 'User-mode scheduling (UMS)', chip: 'App schedules real threads', cls: 'cpu', t: 'User-mode scheduling (UMS)',  // tool 3: user-mode scheduling, where the application schedules its own real threads
            text: 'Introduced in 64-bit Windows 7, no longer supported from Windows 11. The app runs its own scheduler for its own real threads, switching in user mode (cheap for short work). Each keeps its own context; if one blocks in the kernel, the scheduler gets control back.',  // description of UMS: its Windows versions, cheap user-mode switching, control back when a thread blocks
            notFor: 'UMS lets an application schedule <b>its own real threads</b> in user mode; it is not a way to group processes or queue callbacks.' },  // hint shown when UMS is picked wrongly
        ];  // closes TOOLS
        const SC = [  // SC: the eight scenarios as [correct tool, scenario text, explanation shown when right]
          [0, 'A build tool starts a compiler, a linker and dozens of helper processes. Together they must never use more than 4 GB, and cancelling the build must stop every one of them at once.', 'Several processes managed as one unit, with one shared memory limit and one "terminate all" call: exactly what a job object is for.'],  // scenario 1 (job object): a build tool's processes share a 4 GB limit and one cancel
          [1, 'A web service receives thousands of tiny requests per second. Creating a brand-new thread for each would waste time, so it hands each request to workers that the system keeps ready.', 'Short, independent pieces of work run as callbacks on ready-made worker threads: a thread pool.'],  // scenario 2 (thread pool): a web service hands tiny requests to ready workers
          [2, 'A program ported from another system is built from tasks that hand control to each other at points the programmer chooses. Its authors want to keep that manual switching, all inside one ordinary thread.', 'Manual, explicit switching between units of execution that live inside one thread is the definition of fibers.'],  // scenario 3 (fiber): a ported program switches between tasks by hand inside one thread
          [3, 'A database engine runs many real threads and wants its own code to pick which one runs next, switching without the system scheduler, while every thread keeps its own context and may make normal blocking system calls.', 'An application scheduling its own real threads in user mode, each with its own context: user-mode scheduling.'],  // scenario 4 (UMS): a database engine picks which of its real threads runs next
          [1, 'A program needs one callback every second from a timer and another whenever a file read finishes, and it does not want to create or manage any threads itself.', 'Timer and I/O-completion callbacks run on the system-managed workers of a thread pool; the program creates no threads.'],  // scenario 5 (thread pool): timer and file-read callbacks without managing threads
          [0, 'An administrator wants every process launched by a batch script to share one processor-time budget, and wants one total of how much processor time the whole group used.', 'Shared limits and shared accounting for a group of processes come from a job object.'],  // scenario 6 (job object): a batch script's processes share a processor-time budget and total
          [3, 'An application\'s scheduler must get the processor back the moment one of its threads blocks inside the kernel, so that it can immediately run another of its threads.', 'Regaining control when one of your own threads blocks in the kernel is a defining feature of UMS. With fibers, a blocking call would stall the whole host thread instead. (UMS existed on 64-bit Windows 7 to 10; Windows 11 dropped it.)'],  // scenario 7 (UMS): the scheduler must get control back when one of its threads blocks in the kernel
          [2, 'A game engine keeps hundreds of small tasks as separately saved execution states inside one worker thread and resumes them one after another by explicit calls, with no help from the kernel.', 'Units of execution that one thread resumes by explicit calls, invisible to the kernel: fibers.'],  // scenario 8 (fiber): a game engine resumes saved task states inside one worker thread
        ];  // closes SC
        let i = 0, tries = 0, first = 0, done = false;  // game state: i = current scenario, tries = guesses on it, first = right on the first try, done = all finished
        const cards = TOOLS.map((tl) => h('div', { class: 'card tight stack', style: { gap: '3px', borderLeft: `5px solid var(--${tl.cls})` } },  // cards: one card per tool with a colored left edge, shown in the left column
          h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } }, h('b', { html: `<span class="t" data-t="${tl.t}">${tl.name}</span>` }), h('span', { class: 'chip ' + tl.cls }, tl.chip)),  // the card's top row: the tool's name as a glossary term, with its chip on the right
          h('p', { class: 'small m0', style: { lineHeight: '1.38' } }, tl.text)));  // the tool's description; closes the card
        const counter = h('span', { class: 'chip accent' });  // the "Scenario n of 8" chip
        const scoreEl = h('span', { class: 'xs muted' });  // the running first-try score
        const scen = h('div', { class: 'card white', style: { fontSize: '17.5px', lineHeight: '1.45', minHeight: '132px' } });  // the scenario text, in a large white card
        const fb = h('div', { class: 'callout m0', style: { minHeight: '96px' } });  // the feedback box under the answer buttons
        const btns = TOOLS.map((tl, k) => h('button', { class: 'btn ' + tl.cls, type: 'button', onclick: () => choose(k) }, tl.name));  // one answer button per tool, in the tool's color
        const bNext = h('button', { class: 'btn primary', type: 'button', onclick: () => next() }, 'Next scenario');  // the "Next scenario" button
        function paint() {  // paint(): refreshes the counter and the score
          counter.textContent = done ? 'All 8 scenarios done' : `Scenario ${i + 1} of ${SC.length}`;  // shows "Scenario n of 8", or that all eight are done
          scoreEl.textContent = `Right on the first try: ${first}`;  // shows how many scenarios were answered right on the first try
        }  // ends paint()
        function load() {  // load(): sets up the current scenario; runs at start and each time Next is pressed
          tries = 0;  // no guesses yet on this scenario
          scen.innerHTML = SC[i][1];  // shows the scenario text
          fb.className = 'callout m0'; fb.removeAttribute('data-label');  // resets the feedback box to its plain look with no label
          fb.innerHTML = '<span class="muted">Which building block fits this situation? Pick one of the four buttons.</span>';  // shows the prompt to pick one of the four buttons
          btns.forEach((b) => { b.disabled = false; b.classList.remove('on'); });  // re-enables every answer button and clears the green "on" mark
          cards.forEach((c) => c.classList.remove('flash'));  // removes any leftover flash from the tool cards
          bNext.disabled = true; paint();  // disables Next until the right tool is chosen, then refreshes the counter and score
        }  // ends load()
        function choose(k) {  // choose(k): checks the tool the student picked; runs when an answer button is pressed
          const [ans, , why] = SC[i];  // ans: the correct tool for this scenario; why: the explanation to show when right
          tries++;  // counts this guess
          cards[k].classList.remove('flash'); void cards[k].offsetWidth; cards[k].classList.add('flash');  // restarts the flash animation on the chosen tool's card (reading offsetWidth forces the browser to notice the change)
          if (k === ans) {  // the right tool
            if (tries === 1) first++;  // counts it toward the first-try score if it was the first guess
            fb.className = 'callout tip m0'; fb.setAttribute('data-label', tries === 1 ? 'Right, first try' : 'Right');  // turns the feedback green, labeled "Right, first try" or just "Right"
            fb.innerHTML = why;  // shows why this tool fits
            btns.forEach((b, j) => { b.disabled = j !== k; b.classList.toggle('on', j === k); });  // leaves only the chosen button enabled and marks it green
            bNext.disabled = false;  // enables the Next button
            if (i === SC.length - 1) { done = true; bNext.textContent = 'Start again'; }  // after the last scenario, marks the game done and turns Next into "Start again"
          } else {  // a wrong tool
            fb.className = 'callout warn m0'; fb.setAttribute('data-label', 'Not this one');  // turns the feedback amber, labeled "Not this one"
            fb.innerHTML = TOOLS[k].notFor + ' Read the scenario again: what is being grouped, queued or switched?';  // shows what that tool is not for and a hint about what to look for
            btns[k].disabled = true;  // disables the wrong button so it cannot be picked again for this scenario
          }  // ends the right-or-wrong choice
          paint();  // refreshes the counter and score
        }  // ends choose()
        function next() {  // next(): moves on to the next scenario, or starts over after the last one
          if (done) { i = 0; first = 0; done = false; bNext.textContent = 'Next scenario'; }  // after the last scenario: back to the first, with the score cleared and the button renamed
          else i = Math.min(i + 1, SC.length - 1);  // otherwise the next scenario (never past the last)
          load();  // sets up the new scenario
        }  // ends next()
        el.append(h('div', { class: 'split fill' },  // lays out step 2 in two equal columns (stacked on phones)
          h('div', { class: 'stack', style: { gap: '8px' } },  // left column: a short introduction above the four tool cards
            h('p', { class: 'm0 small', html: 'Processes and threads are the core. Windows adds four tools around them, and each answers a different question: <b>who is grouped</b>, and <b>who decides what runs next</b>?' }),  // intro: each tool answers who is grouped and who decides what runs next
            ...cards),  // the four tool cards; closes the left column
          h('div', { class: 'stack' },  // right column: the quiz area
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Which tool would you reach for?'), counter),  // its heading "Which tool would you reach for?" with the scenario counter
            scen,  // the scenario text
            h('div', { class: 'grid-2', style: { gap: '8px' } }, ...btns),  // the four answer buttons in a two-column grid
            fb,  // the feedback box
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, scoreEl, bNext),  // the first-try score and the Next button
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Mixing up fibers and UMS. In both, the application decides what runs next. A fiber lives <b>inside one thread</b> and the kernel never sees it; UMS threads are <b>real kernel threads</b>, each with its own context.' }))));  // a "Common mistake" box explaining the difference between fibers and UMS; closes the layout
        load();  // shows the first scenario so the step opens ready to play
      },  // ends render() for step 2
    },  // ends step 2
    /* ---------------- 3. Windows 8+ app lifecycle ---------------- */
    {  // step 3 begins: how Windows 8 and later pause and end background apps
      title: 'Windows 8 and later: background apps are paused',  // step 3 title
      kind: 'explore',  // kind 'explore' labels this as an Explore step
      render(el, ctx) {  // render(el, ctx) builds step 3 when the student arrives on it
        const { h } = ctx;  // takes the element builder from ctx
        const CAP = 1000; // MB of memory available to apps in this demo
        const APPS = [  // APPS: the three demo apps, each with its memory size, starting state, one kind of work, and how to describe its state
          { id: 'notes', name: 'Notes', mem: 300, init: () => ({ words: 0 }), work: 'Type a sentence', doWork: (st) => { st.words += 8; }, show: (st) => `draft of ${st.words} words` },  // Notes (300 MB): typing adds 8 words to the draft
          { id: 'mail', name: 'Mail', mem: 200, init: () => ({ unread: 3 }), work: 'Read a message', doWork: (st) => { if (st.unread > 0) st.unread--; }, show: (st) => `${st.unread} unread` },  // Mail (200 MB): reading lowers the unread count
          { id: 'photos', name: 'Photos', mem: 600, init: () => ({ photo: 1 }), work: 'Next photo', doWork: (st) => { st.photo = (st.photo % 40) + 1; }, show: (st) => `photo ${st.photo} of 40` },  // Photos (600 MB): Next photo moves through 40 photos
        ];  // closes APPS
        const byId = Object.fromEntries(APPS.map((a) => [a.id, a]));  // byId: the same apps looked up by their short name
        let S, fg, saveOn = true, clock = 0;  // S: each app's status and data; fg: the app in front; saveOn: whether apps save on suspend; clock: orders the suspensions
        const clone = (o) => Object.assign({}, o);  // clone(o): a shallow copy of an app's state, used for the saved copy so later work does not change it
        const used = () => APPS.reduce((n, a) => n + (S[a.id].status === 'running' || S[a.id].status === 'suspended' ? a.mem : 0), 0);  // used(): the memory held by apps that are running or suspended (terminated and closed apps hold none)
        const note = h('div', { class: 'callout m0 small', style: { minHeight: '118px' } });  // the message box that narrates what just happened
        const bar = h('div', { style: { display: 'flex', height: '14px', borderRadius: '99px', overflow: 'hidden', background: 'var(--panel-3)' } });  // the memory bar, a rounded strip filled with one colored piece per app in memory
        const memTxt = h('span', { class: 'small b' });  // the text "Memory used by apps: ... of 1000 MB"
        const tiles = h('div', { class: 'grid-3', style: { gap: '8px' } });  // the three app tiles in a row
        const openBtns = APPS.map((a) => h('button', { class: 'btn sm proc', type: 'button', onclick: () => act(() => open(a.id)) }, 'Open ' + a.name));  // one "Open ..." button per app
        const bHome = h('button', { class: 'btn sm', type: 'button', onclick: () => act(() => home()) }, 'Go to Start screen');  // the "Go to Start screen" button, which sends the front app to the background
        const bWork = h('button', { class: 'btn sm', type: 'button', onclick: () => act(() => work()) });  // the work button, whose label changes to match the app in front
        const bMail = h('button', { class: 'btn sm io', type: 'button', onclick: () => act(() => newMail()) }, 'New mail arrives');  // the "New mail arrives" button, which triggers Mail's background task
        const bLow = h('button', { class: 'btn sm intr', type: 'button', onclick: () => act(() => lowMem()) }, 'Memory runs low');  // the "Memory runs low" button, which makes the system end a suspended app
        const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { reset(); } }, 'Reset');  // the "Reset" button, which starts the demo over
        const seg = ctx.ui.seg([{ value: true, label: 'App saves state on suspend' }, { value: false, label: 'App saves nothing' }], true, (v) => { saveOn = v; reset(); paint(); say([`The demo restarts. Now the apps ${v ? '<b>save</b> their app state data whenever they are suspended, as a well-written Modern app must.' : 'save <b>nothing</b> when suspended. Repeat the same steps and watch what happens to the user\'s work when an app is terminated.'}`], v ? 'tip' : 'warn'); });  // the two-way choice: apps save state on suspend, or save nothing; switching restarts the demo and explains the new mode
        function reset() {  // reset(): closes every app and clears their data, the front app and the clock
          S = {}; APPS.forEach((a) => { S[a.id] = { status: 'closed', live: null, saved: null, at: 0, pending: 0 }; });  // each app starts closed, with no live or saved state and no waiting mail
          fg = null; clock = 0;  // no app in front and the suspension clock back at zero
          say(['Nothing is running yet. Open Notes and type a few sentences, then open the other apps. Keep an eye on the memory bar and on each app\'s <b>saved state data</b>.'], '');  // shows the starting instructions in the message box
        }  // ends reset()
        function say(msgs, kind) { note.className = 'callout m0 small' + (kind ? ' ' + kind : ''); note.innerHTML = msgs.join(' '); }  // say(msgs, kind): writes the messages into the message box and colors it (tip, warn, bad or plain)
        function act(fn) { const r = fn(); say(r[0], r[1]); paint(); }  // act(fn): runs one user action, shows the messages it returns, then redraws the tiles and bar
        function suspend(id, msgs) {  // suspend(id, msgs): moves app id to the background: suspended, memory kept, threads get no processor time
          const a = S[id];  // a: that app's record
          a.status = 'suspended'; a.at = ++clock;  // marks it suspended and stamps when, so the oldest can be found later
          if (saveOn) a.saved = clone(a.live);  // if saving is on, stores a copy of its current state as the saved app state
          msgs.push(`<b>${byId[id].name}</b> leaves the foreground, and a few seconds later PLM <b>suspends</b> it: its threads get no processor time, but its memory is kept. ${saveOn ? `It saved its app state data (${byId[id].show(a.live)}).` : 'It saved nothing.'}`);  // adds a message explaining the suspension and whether the app saved its state
        }  // ends suspend()
        function terminate(id, msgs, why) {  // terminate(id, msgs, why): ends a suspended app without warning to free its memory
          const a = S[id];  // a: that app's record
          a.status = 'terminated'; a.live = null;  // marks it terminated and throws away its in-memory state
          msgs.push(`${why}, so PLM <b>terminates</b> a suspended app: here ${byId[id].name}, the one suspended longest. It gets <b>no warning</b>. ${a.saved ? `Its saved state (${byId[id].show(a.saved)}) is safe on disk.` : 'It never saved its state, so everything it held in memory is gone.'}`);  // adds a message saying why, which app was ended, and whether its saved state survives
        }  // ends terminate()
        function open(id) {  // open(id): brings app id to the front, launching, resuming or relaunching it; returns messages and a color
          const msgs = []; let kind = '';  // msgs collects what happened; kind picks the message box color
          if (fg === id) return [[`${byId[id].name} is already in the foreground.`], ''];  // if the app is already in front there is nothing to do
          if (fg) suspend(fg, msgs);  // the app currently in front is suspended first
          const a = S[id], A = byId[id];  // a: the app's record; A: its description in APPS
          if (a.status === 'suspended') {  // a suspended app resumes
            a.status = 'running';  // marks it running again
            msgs.push(`<b>${A.name} resumes instantly.</b> It was only suspended, so its memory and its state (${A.show(a.live)}) were still there.`);  // explains that it resumes at once because its memory and state were never thrown away
            kind = 'tip';  // a green message box
          } else {  // otherwise the app is closed or terminated and must be launched
            while (used() + A.mem > CAP) {  // while there is not enough free memory for it
              const victims = APPS.filter((x) => S[x.id].status === 'suspended').sort((p, q) => S[p.id].at - S[q.id].at);  // victims: the suspended apps, the one suspended longest first
              if (!victims.length) break;  // if nothing can be ended, stop trying
              terminate(victims[0].id, msgs, `${A.name} needs ${A.mem} MB and memory is short`);  // ends the app suspended longest to make room
            }  // ends the memory loop
            const was = a.status;  // was: the app's status before launching, to tell a first launch from a relaunch
            a.live = a.saved ? clone(a.saved) : A.init();  // its live state comes from its saved state if it has one, otherwise a fresh start
            a.status = 'running';  // marks it running
            if (was === 'terminated') {  // a relaunch after being terminated
              if (a.saved) { msgs.push(`<b>${A.name} is relaunched</b> and restores its saved app state: ${A.show(a.live)}. To the user it looks as if it never left.`); kind = 'tip'; }  // with saved state: it looks to the user as if the app never left (green)
              else { msgs.push(`<b>${A.name} is relaunched</b>, but it saved nothing, so it starts from scratch (${A.show(a.live)}). Whatever the user did in it is lost.`); kind = 'bad'; }  // without saved state: it starts from scratch and the user's work is lost (red)
            } else msgs.push(`<b>${A.name} launches</b> and becomes the foreground app (${A.show(a.live)}).`);  // otherwise a plain first launch
          }  // ends the launch case
          if (id === 'mail' && a.pending) { a.live.unread += a.pending; msgs.push(`It picks up the ${a.pending} message${a.pending > 1 ? 's' : ''} its background task noticed.`); a.pending = 0; }  // when Mail comes to the front, it picks up any messages its background task noticed
          fg = id;  // records the app as the one in front
          return [msgs, kind];  // returns the messages and the box color to act()
        }  // ends open()
        function home() {  // home(): the user goes to the Start screen, sending the front app to the background
          if (!fg) return [['You are already on the Start screen, so no app is in the foreground.'], ''];  // if no app is in front, says so and changes nothing
          const msgs = []; suspend(fg, msgs); fg = null;  // suspends the front app and leaves no app in front
          return [msgs, ''];  // returns the suspension message
        }  // ends home()
        function work() {  // work(): the user does some work in the front app
          if (!fg) return [['No app is in the foreground. Open one first: only the foreground app can do work.'], 'warn'];  // if no app is in front, explains that only the foreground app can work
          const A = byId[fg]; A.doWork(S[fg].live);  // applies the front app's kind of work to its live state
          return [[`The user works in ${A.name}: now ${A.show(S[fg].live)}. This lives in the app\'s memory until it saves.`], ''];  // reports the new state and reminds the student it lives only in memory until saved
        }  // ends work()
        function newMail() {  // newMail(): a new message arrives for Mail
          const a = S.mail;  // a: Mail's record
          if (fg === 'mail') { a.live.unread++; return [['Mail is in the foreground, so it shows the new message itself.'], '']; }  // if Mail is in front, it simply shows the message itself
          a.pending++;  // otherwise counts one more message noticed by the background task
          return [[`Mail is not active, but its registered <b>background task</b> runs for a moment with a small budget of processor time and memory and updates Mail's tile (+${a.pending}). The app itself ${a.status === 'suspended' ? 'stays suspended: its own threads still get no processor time' : 'is still not running'}.`], ''];  // explains that Mail's background task ran briefly and updated its tile while the app stayed suspended
        }  // ends newMail()
        function lowMem() {  // lowMem(): another program needs memory, so the system ends a suspended app
          const victims = APPS.filter((x) => S[x.id].status === 'suspended').sort((p, q) => S[p.id].at - S[q.id].at);  // victims: suspended apps, the one suspended longest first
          if (!victims.length) return [['There is no suspended app to end. PLM reclaims memory from suspended apps; it does not end the app you are using.'], 'warn'];  // if none are suspended, explains that the app in use is never ended this way
          const msgs = []; terminate(victims[0].id, msgs, 'Another program needs memory');  // terminates the one suspended longest
          return [msgs, S[victims[0].id].saved ? '' : 'bad'];  // returns the message, in red if that app had saved nothing
        }  // ends lowMem()
        const LABEL = { closed: ['Not running', ''], running: ['Foreground', 'ok'], suspended: ['Suspended', 'warn'], terminated: ['Terminated', 'bad'] };  // LABEL: the chip text and color for each app status
        function paint() {  // paint(): redraws the app tiles, the memory bar and the buttons; runs after every action
          tiles.replaceChildren(...APPS.map((A) => {  // rebuilds one tile per app
            const a = S[A.id]; const [lab, cls] = LABEL[a.status];  // a: the app's record; lab and cls: its status chip text and color
            const inMem = a.status === 'running' || a.status === 'suspended';  // inMem: whether the app currently holds memory (running or suspended)
            return h('div', { class: 'card tight stack', style: { gap: '4px', borderTop: `4px solid var(--${cls || 'line-2'})`, background: a.status === 'running' ? 'var(--panel)' : 'var(--panel-2)' } },  // the tile: a card with a colored top edge for its status, brighter when the app is in front
              h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } }, h('b', {}, A.name), h('span', { class: 'chip ' + cls }, lab)),  // top row: the app's name and its status chip
              h('div', { class: 'xs muted' }, 'In memory now'),  // label "In memory now"
              h('div', { class: 'small b', style: { minHeight: '21px' } }, inMem ? A.show(a.live) : '—'),  // the app's live state, or a dash when it holds none
              h('div', { class: 'xs muted' }, 'Saved app state data'),  // label "Saved app state data"
              h('div', { class: 'small', style: { minHeight: '21px' } }, a.saved ? A.show(a.saved) : 'none'),  // the saved state, or "none"
              h('div', { class: 'xs muted' }, `Memory: ${inMem ? A.mem : 0} MB${A.id === 'mail' && a.pending ? ` · tile: +${a.pending} new` : ''}`));  // the memory it holds, plus the count of new mail shown on Mail's tile
          }));  // ends the tiles
          bar.replaceChildren(...APPS.filter((A) => ['running', 'suspended'].includes(S[A.id].status)).map((A) =>  // rebuilds the memory bar with one piece per app in memory
            h('div', { title: A.name, style: { width: (A.mem / CAP) * 100 + '%', background: S[A.id].status === 'running' ? 'var(--ok)' : 'var(--warn)', borderRight: '2px solid var(--panel)' } })));  // each piece is as wide as the app's share of 1000 MB, green if running and amber if suspended
          memTxt.textContent = `Memory used by apps: ${used()} of ${CAP} MB`;  // updates the memory text
          bWork.textContent = fg ? byId[fg].work + ' (' + byId[fg].name + ')' : 'Do some work';  // labels the work button with the front app's kind of work, or "Do some work"
          bWork.disabled = !fg;  // disables the work button when no app is in front
          openBtns.forEach((b, k) => b.classList.toggle('on', fg === APPS[k].id));  // marks the Open button of the front app green
        }  // ends paint()
        reset(); paint();  // sets up the starting state and draws it
        el.append(h('div', { class: 'split l fill' },  // lays out step 3: explanation on the left, the demo on the right (stacked on phones)
          h('div', { class: 'stack', style: { gap: '9px' } },  // left column: a stack of paragraphs and boxes
            h('p', { class: 'm0', html: 'Classic desktop programs keep running when you switch away. The <b>Modern</b> (Store) apps introduced with Windows 8 follow stricter rules, run by <span class="t">process lifetime management (PLM)</span>:' }),  // intro: Modern (Store) apps follow stricter rules, run by process lifetime management
            h('ul', { class: 'small m0', style: { lineHeight: '1.4' }, html:  // a bulleted list of the rules
              '<li><b>Foreground:</b> only the app the user is looking at is active.</li>' +  // rule: only the foreground app is active
              '<li><b>Suspended:</b> a few seconds after you switch away, its threads get no more processor time. Its memory stays, so returning is instant.</li>' +  // rule: a background app is suspended after a few seconds but keeps its memory
              '<li><b>Terminated:</b> if memory runs low, Windows may end a suspended app without warning.</li>' +  // rule: a suspended app may be ended without warning when memory is low
              '<li><b>Developer\'s job:</b> save <i>app state data</i> on suspension and restore it on relaunch.</li>' +  // rule: the developer must save app state on suspension and restore it on relaunch
              '<li><b>Background work:</b> a registered <span class="t">background task</span> may run on a trigger, with limited processor time and memory.</li>' }),  // rule: a registered background task may run on a trigger with limited resources
            h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Tablets and laptops have little memory and a battery. An app you cannot see should use neither, yet must come back exactly as the user left it.' }),  // "Why it matters" box: small memory and batteries on tablets and laptops
            h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'Open Notes and type twice. Open Mail, then Photos: which app is terminated, and why? Reopen Notes. Then choose <i>App saves nothing</i> and repeat.' })),  // "Try this" box: a sequence of actions to try in the demo; closes the left column
          h('div', { class: 'stack', style: { gap: '11px' } },  // right column: the demo
            h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, memTxt, h('span', { class: 'xs muted', html: '<span style="color:var(--ok)">■</span> running &nbsp;<span style="color:var(--warn)">■</span> suspended' })), bar),  // the memory text with a color key, above the memory bar
            tiles,  // the three app tiles
            h('div', { class: 'row', style: { gap: '6px' } }, ...openBtns, bHome),  // the Open buttons and the Start screen button
            h('div', { class: 'row', style: { gap: '6px' } }, bWork, bMail, bLow, bReset),  // the work, new mail, low memory and reset buttons
            seg, note)));  // the save-or-not choice and the message box; closes the layout
      },  // ends render() for step 3
    },  // ends step 3
    /* ---------------- 4. Inside a Windows process: explorer + attribute sort ---------------- */
    {  // step 4 begins: exploring what a Windows process holds, and sorting process and thread attributes
      title: 'Inside a process: token, address map, handle table',  // step 4 title
      kind: 'explore',  // kind 'explore' labels this as an Explore step
      core: true,  // core: true keeps this step on the short route
      render(el, ctx) {  // render(el, ctx) builds step 4 when the student arrives on it
        const { h, s } = ctx;  // takes the element builders from ctx
        // attribute explanations shared by the inspector and the sorting game
        const PATTR = [  // PATTR: the attributes of a process object, each with a short explanation
          ['Process ID', 'A unique number that names this process while it exists.'],  // process attribute: process ID
          ['Security descriptor', 'Who owns the process object and who else may open it, for example to read its memory, debug it or end it.'],  // process attribute: security descriptor, who may open the process and how
          ['Base priority', 'The starting priority for this process\'s threads, set by its priority class.'],  // process attribute: base priority for its threads
          ['Default processor affinity', 'The processors this process\'s threads may run on unless a thread is limited further.'],  // process attribute: default processor affinity
          ['Quota limits', 'The most system memory, paging-file space and processor time this process may consume.'],  // process attribute: quota limits on memory, paging-file space and processor time
          ['Execution time', 'Total processor time used so far by all of this process\'s threads added together.'],  // process attribute: total execution time of all its threads
          ['I/O counters', 'How many read, write and other I/O operations the process\'s threads have performed.'],  // process attribute: I/O counters
          ['VM operation counters', 'How many virtual-memory operations (reserve, commit, map, free) the process has performed.'],  // process attribute: virtual-memory operation counters
          ['Exception/debugging ports', 'Message channels the process manager uses to tell the environment subsystem or a debugger that a thread of this process raised an exception.'],  // process attribute: exception and debugging ports
          ['Exit status', 'Why the process ended; empty while it runs. When the process ends, its object becomes signaled, so any thread waiting on the process wakes up.'],  // process attribute: exit status, empty while the process runs
        ];  // closes PATTR
        const TATTR = [  // TATTR: the attributes of a thread object, each with a short explanation
          ['Thread ID', 'A unique number for this thread; it identifies the thread, for example when it calls a server.'],  // thread attribute: thread ID
          ['Thread context', 'The saved register values (instruction pointer, stack pointer and the rest) that let the thread resume exactly where it stopped.'],  // thread attribute: thread context, the saved registers
          ['Dynamic priority', 'The thread\'s priority right now. Windows may boost it above the base, for example just after a wait ends, and it then decays back.'],  // thread attribute: dynamic priority, which can be boosted and then decays
          ['Base priority', 'The lowest value this thread\'s dynamic priority may fall to.'],  // thread attribute: base priority, the floor for the dynamic priority
          ['Thread processor affinity', 'The processors this thread may run on: all or part of its process\'s default set.'],  // thread attribute: thread processor affinity
          ['Thread execution time', 'Processor time this thread has used, counted separately for user mode and kernel mode.'],  // thread attribute: thread execution time, split into user and kernel mode
          ['Alert status', 'Whether this thread, while waiting, may be interrupted to run an asynchronous procedure call.'],  // thread attribute: alert status for asynchronous procedure calls
          ['Suspension count', 'How many times the thread has been suspended without a matching resume. It may run only when the count is 0.'],  // thread attribute: suspension count; the thread runs only when it is 0
          ['Impersonation token', 'A temporary access token that lets the thread act on behalf of another user, as a server thread does for a client.'],  // thread attribute: impersonation token for acting on behalf of another user
          ['Termination port', 'A message channel the process manager uses to report that this thread has ended, typically to its subsystem.'],  // thread attribute: termination port
          ['Thread exit status', 'Why the thread ended; empty while it runs. A thread object is also signaled when its thread ends, so another thread can wait for it to finish.'],  // thread attribute: thread exit status
        ];  // closes TATTR

        /* ---------- tab 1: build and inspect a live process ---------- */
        function tabExplore(panel) {  // tabExplore(panel): builds the first tab, a live process the student can make act and inspect
          const START = 'A Windows process is four things: an <span class="t">access token</span> (whom it acts for), <span class="t" data-t="Virtual address descriptor (VAD)">VADs</span> (one record per range of its address space in use), a <span class="t">handle table</span> (the objects it has opened) and its threads. Press a button to make <b>editor.exe</b> act; click the process or a thread to inspect its object.';  // START: the opening explanation of the four parts of a process and how to use the tab
          let P, sel, note = ['', START];  // P: the simulated process; sel: what the inspector shows ('P' or a thread number); note: the message box's color and text
          const hx = (n, w = 2) => '0x' + n.toString(16).toUpperCase().padStart(w, '0');  // hx(n, w): writes n in hexadecimal with a 0x prefix, padded to w digits (handles and addresses are shown this way)
          // a new handle takes the lowest free table entry (entries are 4 apart); a freed entry is reused
          const addH = (x) => { const used = new Set(P.handles.map((y) => y.hv)); let v = 4; while (used.has(v)) v += 4; P.handles.push(Object.assign({ hv: v }, x)); return v; };  // addH(x): adds handle-table entry x at the lowest free handle value (4, 8, 12 ...) and returns that value
          function reset() {  // reset(): builds a freshly started editor.exe
            P = { threads: [{ n: 1, tid: 4816, u: 0, k: 1, dyn: 8, susp: 0, ip: 0x401A30, sp: 0x19FF40, aff: 'CPUs 0–3' }],  // one thread, T1, with its ID, times, priority 8, suspension count, instruction and stack pointers and allowed CPUs
              handles: [{ hv: 4, kind: 'dir', label: 'Folder C:\\docs', obj: 'File object · C:\\docs (folder)', cls: 's-io' }],  // one handle, to the current folder, which every process keeps
              vads: ['image: editor.exe', 'heap', 'stack: T1'], io: { read: 0 }, vm: 3, fileOpen: false, section: false, view: false, priv: 0 };  // three VADs (image, heap, T1's stack), no reads yet, 3 memory operations, and no file, section, view or private data
            sel = 'P';  // the inspector starts on the process object
          }  // ends reset()
          reset();  // builds the starting process right away
          const N = ctx.narrow; // phones: drop the objects column so the text stays readable
          const svg = s('svg', { viewBox: N ? '0 0 412 300' : '0 0 660 300', width: '100%', style: 'flex:none' });  // the SVG drawing of the process; on phones it leaves out the column of objects on the right
          const insp = h('div', { class: 'stack', style: { gap: '6px' } });  // the inspector panel that lists the selected object's attributes
          const noteEl = h('div', { class: 'callout m0 small', style: { minHeight: '64px' } });  // the message box under the buttons
          const actor = () => { const t = P.threads.find((x) => x.n === sel && x.susp === 0) || P.threads.find((x) => x.susp === 0); return t || null; };  // actor(): the thread that carries out the next action, the selected one if it can run, otherwise any thread not suspended
          function tick(t, u, k) { P.threads.forEach((x) => { x.dyn = Math.max(8, x.dyn - 1); }); t.u += u; t.k += k; t.ip += 0x40 + 0x10 * (u + k); t.sp -= 0x20; }  // tick(t, u, k): time passes: boosted priorities decay one step, and thread t gains u ms user time and k ms kernel time and moves on
          function run(fn) {  // run(fn): performs one action with the acting thread and then redraws
            const t = actor();  // t: the thread that will act
            if (!t) { note = ['warn', 'Every thread is suspended, so nothing in this process can run. Resume a thread first.']; return paint(); }  // if every thread is suspended, explains that nothing can run and stops
            note = fn(t); paint();  // runs the action, keeps the message it returns, and redraws
          }  // ends run()
          const ACTS = [  // ACTS: the action buttons as [label, color, handler]
            ['New thread', 'thread', () => run((t) => {  // action "New thread": the process creates another thread
              if (P.threads.length >= 4) return ['warn', 'This demo stops at four threads, but a real process may create many more.'];  // stops at four threads to keep the drawing readable
              const n = P.threads.length + 1; tick(t, 0, 2);  // n: the new thread's number; creating it costs the acting thread 2 ms of kernel time
              P.threads.push({ n, tid: 4812 + 4 * n, u: 0, k: 0, dyn: 8, susp: 0, ip: 0x402200 + n * 0x100, sp: 0x19FF40 + (n - 1) * 0x100000, aff: n === 3 ? 'CPUs 2–3' : 'CPUs 0–3' });  // adds the thread object with its own ID, pointers and allowed CPUs (T3 is limited to CPUs 2-3)
              P.vads.push('stack: T' + n); P.vm++;  // adds a VAD for the new thread's stack and counts a memory operation
              const hv = addH({ kind: 'thread', label: 'Thread T' + n, obj: 'Thread object · T' + n, cls: 's-thread' });  // adds a handle to the new thread object
              return ['ok', `T${t.n} asks the executive for a new thread. The executive builds <b>thread object T${n}</b> (thread ID ${4812 + 4 * n}), the memory manager adds a <b>VAD</b> for its stack, and the handle table gets handle <code>${hx(hv)}</code>.${n === 2 ? ' (T1 has no handle here: the handle to it went to whichever process started editor.exe.)' : n === 3 ? ' T3 is limited to CPUs 2–3: its <span class="t">processor affinity</span> is part of the process\'s default set.' : ''}`];  // explains the new thread object, VAD and handle, with extra notes for T2 and T3
            })],  // ends the "New thread" action
            ['Open report.docx', 'io', () => run((t) => {  // action "Open report.docx": the process opens a file it is allowed to open
              if (P.fileOpen) return ['warn', 'report.docx is already open; opening it again would simply add a second handle to the same file.'];  // refuses if the file is already open
              tick(t, 0, 1); P.fileOpen = true;  // costs 1 ms of kernel time and marks the file open
              const hv = addH({ kind: 'file', label: 'File report.docx', obj: 'File object · report.docx', cls: 's-io' });  // adds a handle to the new file object
              return ['ok', `The file allows group <b>Staff</b>, and the <span class="t">access token</span> says user ana is in Staff, so the open succeeds: a new file object, reached through handle <code>${hx(hv)}</code>. Nothing has been read yet, so the I/O counters do not change.`];  // explains that the access token's group matches the file's permission, so a handle is created
            })],  // ends the "Open report.docx" action
            ['Read the file', 'io', () => run((t) => {  // action "Read the file"
              if (!P.fileOpen) return ['warn', 'There is no open file to read. Open report.docx first.'];  // refuses if no file is open
              tick(t, 3, 1); P.io.read++; t.dyn = 9;  // costs user and kernel time, counts one read and boosts the thread's dynamic priority to 9
              return ['ok', `T${t.n} reads through its file handle, waits for the disk, then runs again. The read count goes up, and Windows gives T${t.n} a small <b>priority boost</b> (<span class="t">dynamic priority</span> 9, one above its base of 8) because its wait just ended.`];  // explains the read, the wait for the disk and the priority boost after the wait
            })],  // ends the "Read the file" action
            ['Allocate memory', 'mem', () => run((t) => {  // action "Allocate memory"
              if (P.priv >= 1) return ['warn', 'Enough for this demo: a private data region already exists. A real process may allocate many more.'];  // allows only one private data region in this demo
              tick(t, 1, 1); P.priv++; P.vm++; P.vads.push('private data');  // counts a memory operation and adds a "private data" VAD
              return ['ok', 'The process cannot edit its own address map directly. It asks the <b>memory manager</b>, which adds a new <b>VAD</b> describing the range. The VM operation counter goes up.'];  // explains that the memory manager, not the process, adds the new VAD
            })],  // ends the "Allocate memory" action
            ['Map shared memory', 'mem', () => run((t) => {  // action "Map shared memory"
              if (P.section) return ['warn', 'The process already holds a handle to the shared section, and its view is mapped.'];  // refuses if the section is already open
              tick(t, 0, 2); P.section = true;  // costs kernel time and marks the section as open
              const hv = addH({ kind: 'section', label: 'Section shmem', obj: 'Section object · shmem', cls: 's-mem' });  // adds a handle to the section object
              if (P.view) { return ['ok', `The process opens the section again (handle <code>${hx(hv)}</code>). Its view is still mapped from before, so no new VAD is needed.`]; }  // if the view is still mapped from before, only the handle is new
              P.view = true; P.vm++; P.vads.push('view: shmem');  // otherwise maps a view, counts a memory operation and adds a VAD for it
              return ['ok', `The process opens a <span class="t">section object</span> (handle <code>${hx(hv)}</code>) and maps a view of it, which adds a VAD. Another process can map the same section: this is how two processes share memory.`];  // explains section objects and how two processes share memory
            })],  // ends the "Map shared memory" action
            ['Open payroll.xlsx', 'intr', () => run((t) => {  // action "Open payroll.xlsx": an open that the access token does not allow
              tick(t, 0, 1);  // costs a little kernel time
              return ['bad', '<b>Access denied.</b> payroll.xlsx only allows group <b>HR</b>. The access token lists Users and Staff, not HR, so no handle is created. The token decides what this process may touch.'];  // explains that the token lacks group HR, so access is denied and no handle is made
            })],  // ends the "Open payroll.xlsx" action
            ['Close newest handle', '', () => run((t) => {  // action "Close newest handle"
              if (P.handles.length <= 1) return ['warn', 'Only the handle to the current folder is left. Every process keeps one, so this demo keeps it too.'];  // keeps the folder handle, since every process keeps one
              const x = P.handles.pop(); tick(t, 0, 1);  // removes the newest handle from the table
              if (x.kind === 'file') P.fileOpen = false;  // closing the file handle means the file is no longer open
              if (x.kind === 'section') { P.section = false; return ['ok', `Handle <code>${hx(x.hv)}</code> is closed. The mapped view (its VAD) stays until it is unmapped, and it keeps the section alive.`]; }  // closing the section handle: the mapped view stays and keeps the section alive
              if (x.kind === 'thread') return ['ok', `Handle <code>${hx(x.hv)}</code> is closed, but <b>${x.label.slice(7)} keeps running</b>: closing a handle only drops this process's way of referring to the thread object.`];  // closing a thread handle: the thread keeps running, only the process's reference is gone
              return ['ok', `Handle <code>${hx(x.hv)}</code> is closed and report.docx is no longer open in this process.`];  // otherwise explains that report.docx is closed
            })],  // ends the "Close newest handle" action
            ['Suspend thread', '', () => { const t = P.threads.find((x) => x.n === sel); if (!t) { note = ['warn', 'Select a thread first (T1, T2...) in the inspector or the diagram.']; return paint(); } t.susp++; note = ['warn', `T${t.n}'s <b>suspension count</b> is now ${t.susp}. It cannot run until the count is back to 0.`]; paint(); }],  // action "Suspend thread": raises the selected thread's suspension count
            ['Resume thread', '', () => { const t = P.threads.find((x) => x.n === sel); if (!t) { note = ['warn', 'Select a thread first (T1, T2...) in the inspector or the diagram.']; return paint(); } if (!t.susp) { note = ['warn', `T${t.n} is not suspended; its suspension count is already 0.`]; return paint(); } t.susp--; note = [t.susp ? 'warn' : 'ok', `One resume lowers T${t.n}'s suspension count to ${t.susp}. ${t.susp ? 'It still cannot run.' : 'It may run again.'}`]; paint(); }],  // action "Resume thread": lowers the selected thread's suspension count; it may run again at 0
          ];  // closes ACTS
          const btns = ACTS.map(([lab, cls, fn]) => h('button', { class: 'btn sm ' + cls, type: 'button', onclick: fn }, lab));  // one button per action, in the action's color
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { reset(); note = ['', 'Back to a freshly started editor.exe.']; paint(); } }, 'Reset');  // the Reset button returns to a freshly started process
          function selTarget(v) { sel = v; paint(); }  // selTarget(v): chooses what the inspector shows and redraws
          function paint() {  // paint(): redraws the process drawing, the message box and the inspector
            const kids = [];  // kids collects the drawing's shapes
            const hotG = (target, children) => { const g = s('g', { class: 'hot' + (sel === target ? ' sel' : ''), tabindex: 0, role: 'button' }, ...children); g.addEventListener('click', () => selTarget(target)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selTarget(target); } }); return g; };  // hotG(): wraps shapes in a clickable, keyboard-focusable group that selects the process or a thread
            kids.push(hotG('P', [s('rect', { x: 4, y: 4, width: 404, height: 292, rx: 14, class: 'fr s-proc', 'stroke-width': 2 }),  // the whole process box is clickable and selects the process object
              s('text', { x: 16, y: 25, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'Process object · editor.exe · PID 4812')]));  // the process title with its program name and process ID
            kids.push(s('rect', { x: 16, y: 36, width: 190, height: 66, rx: 9, class: 's-os', 'stroke-width': 1.5 }),  // the purple access-token box
              s('text', { x: 26, y: 55, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }, 'Access token'),  // its title "Access token"
              s('text', { x: 26, y: 73, 'font-size': 13 }, 'user: ana'),  // the user it runs as
              s('text', { x: 26, y: 91, 'font-size': 13 }, 'groups: Users, Staff'));  // the groups the user belongs to; the open buttons check these against each file's permissions
            kids.push(s('rect', { x: 16, y: 110, width: 190, height: 178, rx: 9, class: 's-mem', 'stroke-width': 1.5 }),  // the green box for the virtual address descriptors
              s('text', { x: 24, y: 129, 'font-size': 13, 'font-weight': 700, 'letter-spacing': '-0.2', style: 'fill:var(--mem)' }, 'Virtual address descriptors'));  // its title "Virtual address descriptors"
            P.vads.forEach((v, i) => kids.push(s('rect', { x: 26, y: 137 + i * 19, width: 170, height: 16, rx: 4, class: 's-panel', 'stroke-width': 1 }),  // one small gray row per VAD, stacked down the box
              s('text', { x: 32, y: 149.5 + i * 19, 'font-size': 13 }, v)));  // the VAD's description, such as "stack: T2"
            kids.push(s('rect', { x: 214, y: 36, width: 184, height: 190, rx: 9, class: 's-os', 'stroke-width': 1.5 }),  // the purple handle-table box
              s('text', { x: 224, y: 55, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }, 'Handle table'),  // its title "Handle table"
              N ? null : s('text', { x: 432, y: 25, 'font-size': 13, 'font-weight': 800 }, 'Objects the handles point to'));  // on wider screens, a heading over the column of objects the handles point to
            P.handles.forEach((x, i) => {  // one row per handle
              const y = 63 + i * 21;  // y: this row's top edge
              kids.push(s('rect', { x: 222, y, width: 168, height: 18, rx: 4, class: 's-panel', 'stroke-width': 1 }),  // the row's gray background
                s('text', { x: 228, y: y + 13.5, 'font-size': 13, class: 's-monot', style: 'fill:var(--os)' }, hx(x.hv)),  // the handle value in hexadecimal, such as 0x08
                s('text', { x: 266, y: y + 13.5, 'font-size': 13 }, x.label));  // what the handle refers to, such as "File report.docx"
              if (!N) kids.push(s('line', { x1: 390, y1: y + 9, x2: 436, y2: y + 9, class: 's-line', 'stroke-width': 1.5, 'marker-end': 'url(#arr)' }),  // on wider screens, an arrow from the handle out to its object
                s('rect', { x: 440, y, width: 214, height: 18, rx: 4, class: x.cls, 'stroke-width': 1.2 }),  // the object's box, colored by kind (file, thread, section)
                s('text', { x: 447, y: y + 13.5, 'font-size': 13 }, x.obj));  // the object's description
            });  // ends the handle rows
            kids.push(s('rect', { x: 214, y: 234, width: 184, height: 54, rx: 9, class: 's-panel', 'stroke-width': 1.5 }),  // the box that holds the process's threads
              s('text', { x: 224, y: 249, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--thread)' }, 'Threads'));  // its title "Threads"
            P.threads.forEach((t, i) => kids.push(hotG(t.n, [s('rect', { x: 222 + i * 43, y: 255, width: 38, height: 27, rx: 7, class: 'fr ' + (t.susp ? 's-warn' : 's-thread'), 'stroke-width': 1.6 }),  // one clickable badge per thread, amber when suspended and pink otherwise
              s('text', { x: 241 + i * 43, y: 273, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, 'T' + t.n)])));  // the badge's label, such as "T2"
            if (!N) kids.push(s('text', { x: 440, y: 250, 'font-size': 13, class: 's-sub' }, 'Objects live in system memory,'),  // on wider screens, a note that objects live in system memory outside the process
              s('text', { x: 440, y: 267, 'font-size': 13, class: 's-sub' }, 'outside the process itself.'),  // second line of that note
              s('text', { x: 440, y: 284, 'font-size': 13, class: 's-sub' }, `${P.handles.length} handle${P.handles.length > 1 ? 's' : ''} in use.`));  // the number of handles in use
            svg.replaceChildren(...kids.filter(Boolean));  // replaces the old drawing with the new shapes, skipping the empty entries left for phones
            noteEl.className = 'callout m0 small' + (note[0] ? ' ' + note[0] : '');  // colors the message box to match the last action's result
            noteEl.innerHTML = note[1];  // shows the last action's message
            paintInspector();  // redraws the inspector too
          }  // ends paint()
          function paintInspector() {  // paintInspector(): rebuilds the attribute table for the selected process or thread
            const opts = [{ value: 'P', label: 'Process' }].concat(P.threads.map((t) => ({ value: t.n, label: 'T' + t.n })));  // opts: one button for the process and one per thread
            const seg = ctx.ui.seg(opts, sel, (v) => selTarget(v));  // the selector row of those buttons; choosing one changes the selection
            const why = h('div', { class: 'card tight small', style: { minHeight: '68px' } }, h('span', { class: 'muted' }, 'Click any row to see what that attribute means.'));  // a box under the table that explains whichever attribute row is clicked
            let rows;  // rows will hold [attribute name, current value, explanation]
            if (sel === 'P') {  // the process is selected
              const ms = P.threads.reduce((a, t) => a + t.u + t.k, 0);  // ms: the process's total execution time, adding up every thread's user and kernel time
              rows = [4812, 'owner ana; admins full access', '8 (Normal class)', 'CPUs 0–3', '64 MB pool, 2 GB page file', ms + ' ms (all threads)', `${P.io.read} read${P.io.read === 1 ? '' : 's'}, 0 writes, 0 other`, P.vm + ' operations', 'to Win32 subsystem; no debugger', '— (still running)'].map((v, i) => [PATTR[i][0], v, PATTR[i][1]]);  // the process's current values, lined up with PATTR's attributes in order
            } else {  // a thread is selected
              const t = P.threads.find((x) => x.n === sel);  // t: the selected thread
              rows = [t.tid, `IP ${hx(t.ip, 6)}, SP ${hx(t.sp, 6)}`, t.dyn + (t.dyn > 8 ? ' (boosted)' : ''), 8, t.aff, `${t.u + t.k} ms (user ${t.u}, kernel ${t.k})`, 'not alertable', t.susp + (t.susp ? ' (cannot run)' : ''), 'none', 'to Win32 subsystem', '— (still running)'].map((v, i) => [TATTR[i][0], v, TATTR[i][1]]);  // the thread's current values, lined up with TATTR's attributes in order
            }  // ends the choice
            const tbody = h('tbody', {}, ...rows.map(([k, v, d]) => h('tr', { style: { cursor: 'pointer' }, onclick: (e) => { tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('on')); e.currentTarget.classList.add('on'); why.innerHTML = `<b>${k}:</b> ${d}`; } },  // the table body: clicking a row highlights it and shows that attribute's explanation below
              h('td', { class: 'b' }, k), h('td', { class: 'mono', style: { fontSize: '13px' } }, String(v)))));  // each row's attribute name in bold and its value in monospace
            insp.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, sel === 'P' ? 'Process object' : `Thread object T${sel}`), seg),  // fills the inspector: a heading naming the object, with the selector on the right
              h('table', { class: 'tbl compact' }, tbody), why);  // the attribute table and the explanation box
          }  // ends paintInspector()
          paint();  // draws the process for the first time
          panel.append(h('div', { class: 'split r fill', style: { gap: '18px' } },  // lays out tab 1: the drawing and controls on the wider left, the inspector on the right (stacked on phones)
            h('div', { class: 'stack', style: { gap: '8px' } }, svg, h('div', { class: 'row', style: { gap: '5px' } }, ...btns, bReset), noteEl),  // left: the drawing, the row of action buttons with Reset, and the message box
            insp));  // right: the inspector; closes the layout
        }  // ends tabExplore()

        /* ---------- tab 2: sort the attributes onto the right object ---------- */
        function tabSort(panel) {  // tabSort(panel): builds the second tab, a game sorting attributes onto the process object, the thread object or both
          const BOTH = {  // BOTH: the attributes found on both objects, each with an explanation of why
            'ID': 'Both objects carry an ID: the process has a process ID and every thread its own thread ID.',  // both: an ID (process ID and thread ID)
            'Base priority': 'Both: the process\'s base priority is the starting point for its threads, and each thread has its own base priority as a floor for its dynamic priority.',  // both: base priority
            'Execution time': 'Both: each thread counts its own processor time, and the process adds up the time of all its threads.',  // both: execution time
            'Exit status': 'Both: a thread records why it ended, and so does the process as a whole.',  // both: exit status
          };  // closes BOTH
          const ITEMS = [].concat(  // ITEMS: every attribute to sort as [name, correct bin, explanation]
            ['Security descriptor', 'Default processor affinity', 'Quota limits', 'I/O counters', 'VM operation counters', 'Exception/debugging ports'].map((n) => [n, 0, PATTR.find((a) => a[0] === n)[1]]),  // the six process-only attributes, with explanations taken from PATTR
            ['Thread context', 'Dynamic priority', 'Thread processor affinity', 'Alert status', 'Suspension count', 'Impersonation token', 'Termination port'].map((n) => [n, 1, TATTR.find((a) => a[0] === n)[1]]),  // the seven thread-only attributes, with explanations taken from TATTR
            Object.entries(BOTH).map(([n, d]) => [n, 2, d]));  // the four shared attributes from BOTH; closes ITEMS
          const BINS = [['Process object only', 'proc'], ['Thread object only', 'thread'], ['Both objects', 'os']];  // BINS: the three bins, each with its label and color
          let order, placed, held, wrong;  // game state: order = shuffled item order, placed = sorted items, held = item picked up, wrong = slips
          const pool = h('div', { class: 'row', style: { gap: '7px', minHeight: '82px', alignContent: 'flex-start' } });  // pool: the area of buttons for attributes not yet sorted
          const binEls = BINS.map(([lab, cls], b) => {  // binEls: builds each bin
            const list = h('div', { class: 'row', style: { gap: '5px', alignContent: 'flex-start' } });  // list: the area inside the bin where sorted attributes appear
            const head = h('button', { class: 'btn ' + cls, type: 'button', style: { width: '100%' }, onclick: () => drop(b) }, 'Put here: ' + lab);  // the bin's heading is a button; clicking it drops the held attribute there
            return { list, el: h('div', { class: 'card tight stack', style: { gap: '8px', borderTop: `4px solid var(--${cls})` } }, head, list) };  // returns the bin's list and the whole bin card with a colored top edge
          });  // ends binEls
          const fb = h('div', { class: 'callout m0 small', style: { minHeight: '66px' } });  // the feedback box
          const score = h('span', { class: 'chip accent' });  // the score chip, such as "5 / 17 sorted, 1 slip"
          function reset() { order = ctx.util.shuffle(ITEMS.map((_, i) => i)); placed = new Set(); held = null; wrong = 0; say('', 'Click an attribute to pick it up, then click the object it belongs to. Some attributes appear on <b>both</b> objects.'); paint(); }  // reset(): shuffles the attributes, clears the bins and the slips, and shows the instructions
          function say(kind, html) { fb.className = 'callout m0 small' + (kind ? ' ' + kind : ''); fb.innerHTML = html; }  // say(kind, html): writes feedback and colors the box
          function drop(b) {  // drop(b): tries to put the held attribute into bin b
            if (held == null) { say('warn', 'Pick up an attribute first by clicking it in the pool.'); return; }  // if nothing is held, tells the student to pick an attribute first
            const [name, ans, d] = ITEMS[held];  // name, ans, d: the held attribute's name, correct bin and explanation
            if (b === ans) { placed.add(held); say('tip', `<b>${name}</b> → ${BINS[ans][0]}. ${d}`); }  // the right bin: marks it sorted and shows the explanation
            else {  // the wrong bin
              wrong++;  // counts a slip
              const obj = b === 0 ? 'process object' : 'thread object';  // obj: the name of the object the student chose
              const hint = ans === 1 ? 'It describes one path of execution, not the whole container.' : 'It describes the whole container and everything its threads do together.';  // hint: a clue about whether the attribute belongs to one thread or to the whole process
              say('warn', ans === 2 ? `Close, but <b>${name}</b> is not found only on the ${obj}. Does the other object keep its own version too?`  // for shared attributes, asks whether the other object keeps its own version too
                : b === 2 ? `<b>${name}</b> is found on just one of the two objects. ${hint}` : `<b>${name}</b> is not on the ${obj}. ${hint}`);  // for a one-object attribute dropped on "Both", or on the wrong object, gives the matching clue
            }  // ends the wrong-bin case
            held = null;  // puts the attribute down either way
            if (placed.size === ITEMS.length) say('tip', `<b>All ${ITEMS.length} sorted${wrong ? ` with ${wrong} slip${wrong > 1 ? 's' : ''}` : ' without a single slip'}.</b> Pattern: the process holds what is shared (security, quotas, counters, defaults); each thread holds what belongs to one path of execution (context, current priority, suspension, alerts).`);  // when every attribute is sorted, shows the slip count and the pattern behind the answers
            paint();  // redraws the pool, bins and score
          }  // ends drop()
          function paint() {  // paint(): redraws the pool, the bins and the score
            pool.replaceChildren(...order.filter((i) => !placed.has(i)).map((i) => h('button', { class: 'btn sm' + (held === i ? ' primary' : ''), type: 'button', onclick: () => { held = held === i ? null : i; paint(); } }, ITEMS[i][0])));  // one button per unsorted attribute in shuffled order, highlighted if held; clicking picks it up or puts it down
            if (placed.size === ITEMS.length) pool.append(h('span', { class: 'muted small' }, 'The pool is empty.'));  // when all are sorted, notes that the pool is empty
            binEls.forEach((bn, b) => bn.list.replaceChildren(...ITEMS.map((it, i) => [it, i]).filter(([it, i]) => placed.has(i) && it[1] === b).map(([it]) => h('span', { class: 'chip ' + BINS[b][1] }, it[0]))));  // fills each bin with chips for the attributes sorted into it
            score.textContent = `${placed.size} / ${ITEMS.length} sorted · ${wrong} slip${wrong === 1 ? '' : 's'}`;  // updates the score chip
          }  // ends paint()
          reset();  // starts the first round
          panel.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // lays out tab 2 as a vertical stack
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, 'Which object holds each attribute?'), h('div', { class: 'row' }, score, h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Shuffle and restart'))),  // top row: the question on the left, the score and a "Shuffle and restart" button on the right
            pool,  // the pool of attributes still to sort
            h('div', { class: 'grid-3', style: { gap: '10px', minHeight: '236px' } }, ...binEls.map((b) => b.el)),  // the three bins side by side (stacked on phones)
            fb));  // the feedback box; closes the layout
        }  // ends tabSort()

        el.append(ctx.ui.tabs([  // builds step 4 as two tabs: the live process explorer and the attribute sort
          { label: 'Explore a live process', render: tabExplore },  // tab 1: "Explore a live process", filled by tabExplore()
          { label: 'Sort the attributes', render: tabSort },  // tab 2: "Sort the attributes", filled by tabSort()
        ]));  // closes the tab list and adds the tabs to the step
      },  // ends render() for step 4
    },  // ends step 4
    /* ---------------- 5. Multithreading: a server with one thread per request ---------------- */
    {  // step 5 begins: comparing a single-threaded server with one thread per request
      title: 'Multithreading: a server that never sits idle',  // step 5 title
      kind: 'compare',  // kind 'compare' labels this as a Compare step
      render(el, ctx) {  // render(el, ctx) builds step 5 when the student arrives on it
        const { h, s } = ctx;  // takes the element builders from ctx
        const WORK = [['cpu', 2], ['io', 3], ['cpu', 1]]; // every request: 2 ms of processing, a 3 ms disk read, 1 ms to reply
        const NR = 4, TMAX = 24;  // NR = 4 requests; TMAX = the 24 ms shown on the timeline
        // returns segments {r, kind, from, to, core} and finish times, all in ms
        function sim(multi, ncpu) {  // sim(multi, ncpu): simulates the four requests and returns the timeline pieces and each request's finish time
          const seg = [], fin = [];  // seg collects the timeline pieces; fin holds each request's finish time
          if (!multi) {  // the single-threaded server
            let t = 0;  // t: the server thread's clock
            for (let r = 0; r < NR; r++) {  // handles the requests one at a time, in order
              if (t > 0) seg.push({ r, kind: 'queue', from: 0, to: t });  // a request that is not first sits queued from time 0 until the thread gets to it
              for (const [k, d] of WORK) { seg.push({ r, kind: k, from: t, to: t + d, core: 0 }); t += d; }  // its three phases (process, disk read, reply) run back to back on processor 0
              fin[r] = t;  // records when this request finished
            }  // ends the request loop
            return { seg, fin };  // returns the single-threaded timeline
          }  // ends the single-threaded case
          const th = Array.from({ length: NR }, (_, r) => ({ r, ph: 0, readyAt: 0, cpuEnd: -1, ioEnd: -1, core: -1 }));  // th: one thread per request, tracking its phase, when it became ready, and when its processor or disk work ends
          const busy = Array(ncpu).fill(null);  // busy: which thread each processor is running (null when idle)
          for (let t = 0; t <= 60 && fin.filter((x) => x != null).length < NR; t++) {  // steps the clock one millisecond at a time until every request has finished (at most 60 ms)
            for (const x of th) if (x.ioEnd === t) { x.ioEnd = -1; x.ph++; x.readyAt = t; }  // a thread whose disk read ends now moves to its next phase and becomes ready
            for (let c = 0; c < ncpu; c++) {  // checks each processor
              const x = busy[c];  // x: the thread on this processor
              if (x && x.cpuEnd === t) {  // if its processing ends now
                busy[c] = null; x.cpuEnd = -1; x.ph++;  // frees the processor and moves the thread to its next phase
                if (x.ph >= WORK.length) fin[x.r] = t;  // if that was its last phase, the request is answered now
                else { x.ioEnd = t + WORK[x.ph][1]; seg.push({ r: x.r, kind: 'io', from: t, to: x.ioEnd }); }  // otherwise its disk read starts at once (reads may overlap) and is recorded
              }  // ends this processor's check
            }  // ends the processor loop
            const ready = th.filter((x) => x.ph < WORK.length && WORK[x.ph][0] === 'cpu' && x.cpuEnd < 0 && x.ioEnd < 0 && !busy.includes(x)).sort((a, b) => a.readyAt - b.readyAt || a.r - b.r);  // ready: threads waiting for a processor, the one ready longest first (ties go to the lower request number)
            for (let c = 0; c < ncpu && ready.length; c++) {  // hands ready threads to free processors
              if (busy[c]) continue;  // skips a processor that is already busy
              const x = ready.shift();  // x: the next ready thread
              if (t > x.readyAt) seg.push({ r: x.r, kind: 'wait', from: x.readyAt, to: t });  // if it had to wait for a processor, records an amber "ready" piece for the wait
              busy[c] = x; x.cpuEnd = t + WORK[x.ph][1];  // puts it on the processor and notes when its processing will end
              seg.push({ r: x.r, kind: 'cpu', from: t, to: x.cpuEnd, core: c });  // records the processing piece and which processor ran it
            }  // ends the hand-out loop
          }  // ends the clock loop
          return { seg, fin };  // returns the multithreaded timeline
        }  // ends sim()
        let multi = true, ncpu = 1, tCur = 3;  // the current choices: one thread per request, 1 processor, and the time cursor at 3 ms
        const N = ctx.narrow, VW = N ? 360 : 640, X0 = N ? 34 : 62, PX = N ? 12.2 : 22.5, Y0 = 32, RH = 52; // phones get a narrower chart
        const svg = s('svg', { viewBox: `0 0 ${VW} 236`, width: '100%', style: 'flex:none' });  // the timeline SVG with one row per request
        const cap = h('div', { class: 'card tight small', style: { minHeight: '62px' } });  // the caption that describes the millisecond under the cursor
        const kpis = h('div', { class: 'grid-3', style: { gap: '8px' } });  // the three result cards
        const story = h('div', { class: 'callout m0 small', style: { minHeight: '58px' } });  // the explanation box, green for the threaded server and amber for the single thread
        const segDesign = ctx.ui.seg([{ value: false, label: 'Single-threaded server' }, { value: true, label: 'One thread per request' }], multi, (v) => { multi = v; draw(); });  // the two-way design choice; switching redraws
        const segCpu = ctx.ui.seg([{ value: 1, label: '1 processor' }, { value: 2, label: '2' }, { value: 4, label: '4' }], ncpu, (v) => { ncpu = v; draw(); });  // the processor-count choice (1, 2 or 4); switching redraws
        const slider = ctx.ui.slider({ label: 'Look at time', min: 0, max: TMAX - 1, value: tCur, format: (v) => v + ' ms', onInput: (v) => { tCur = v; draw(); } });  // the time slider, 0 to 23 ms, which moves the cursor
        const KIND = { cpu: ['s-cpu', 'runs'], io: ['s-io', 'disk'], wait: ['s-warn', 'ready'], queue: ['s-panel', 'queued'] };  // KIND: the color and label for each kind of timeline piece (runs, disk, ready, queued)
        function draw() {  // draw(): runs the simulation and redraws the timeline, caption, results and explanation
          const { seg, fin } = sim(multi, ncpu);  // seg and fin: the simulated pieces and finish times
          const end = Math.max(...fin);  // end: when the last request is answered
          const kids = [];  // kids collects the new shapes
          for (let t = 0; t <= TMAX; t += N ? 4 : 2) kids.push(s('line', { x1: X0 + t * PX, y1: 24, x2: X0 + t * PX, y2: Y0 + NR * RH - 8, class: 's-muted', 'stroke-width': 1, 'stroke-dasharray': '2 4' }),  // dotted vertical grid lines every 2 ms (every 4 ms on phones)
            s('text', { x: X0 + t * PX, y: 17, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(t)));  // the time label at the top of each grid line
          for (let r = 0; r < NR; r++) {  // one row per request
            const y = Y0 + r * RH;  // y: the row's top edge
            kids.push(s('text', { x: 6, y: y + 20, 'font-size': 14, 'font-weight': 800 }, (N ? 'R' : 'Req ') + (r + 1)));  // the row's label, "Req 1" (or "R1" on phones)
            seg.filter((g) => g.r === r).forEach((g) => {  // draws each piece of this request's timeline
              const [cls, lab] = KIND[g.kind]; const w = (g.to - g.from) * PX;  // cls and lab: its color and label; w: its width
              kids.push(s('rect', { x: X0 + g.from * PX + 1, y, width: w - 2, height: 30, rx: 5, class: cls, 'stroke-width': 1.4, 'stroke-dasharray': g.kind === 'queue' ? '4 3' : null }));  // the piece's rectangle, dashed when the request is only queued
              const txt = g.kind === 'cpu' ? (w >= 40 ? 'CPU' + g.core : w >= 18 ? 'C' + g.core : '') : w >= lab.length * 6.8 + 4 ? lab : '';  // the label: "CPU0" or "C0" for processing if it fits, otherwise the kind's word if it fits
              if (txt) kids.push(s('text', { x: X0 + (g.from + g.to) / 2 * PX, y: y + 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 650 }, txt));  // writes the label in the middle of the piece
            });  // ends the pieces of this request
            kids.push(s('text', { x: X0 + fin[r] * PX + 5, y: y + 20, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--ok)' }, '✓ ' + fin[r]));  // a green tick and finish time just after the request is answered
          }  // ends the request rows
          kids.push(s('line', { x1: X0 + (tCur + 0.5) * PX, y1: 22, x2: X0 + (tCur + 0.5) * PX, y2: Y0 + NR * RH - 4, style: 'stroke:var(--accent)', 'stroke-width': 2.5 }),  // the vertical cursor line at the chosen millisecond
            s('text', { x: 6, y: 17, 'font-size': 13, class: 's-sub' }, N ? 'ms' : 'ms →'));  // a small "ms" label at the top left for the time axis
          svg.replaceChildren(...kids.filter(Boolean));  // replaces the old timeline with the new shapes, skipping empty entries
          // what is happening in the ms starting at tCur
          const now = ctx.util.range(NR).map((r) => {  // now: one short phrase per request describing what it is doing during the chosen millisecond
            const g = seg.find((x) => x.r === r && x.from <= tCur && tCur < x.to);  // g: the piece of this request's timeline that covers that millisecond, if any
            if (!g) return `R${r + 1} <b style="color:var(--ok)">done</b>`;  // no piece means the request is already done
            return `R${r + 1} ${g.kind === 'cpu' ? `<b style="color:var(--cpu)">runs on processor ${g.core}</b>` : g.kind === 'io' ? 'waits for the disk' : g.kind === 'wait' ? '<b style="color:var(--warn)">is ready but no processor is free</b>' : 'has not started yet'}`;  // otherwise it runs on a processor, waits for the disk, is ready without a processor, or has not started
          });  // ends the phrases
          const idle = ncpu - seg.filter((x) => x.kind === 'cpu' && x.from <= tCur && tCur < x.to).length;  // idle: processors not running any request during that millisecond
          cap.innerHTML = `<b>From ${tCur} to ${tCur + 1} ms:</b> ${now.join(' · ')}. <span class="muted">Idle processors: ${idle} of ${ncpu}.</span>`;  // writes the caption for that millisecond, with the idle processor count
          const busyPct = Math.round((NR * 3) / (end * ncpu) * 100);  // busyPct: the processors' busy share, 12 ms of processing divided by the finish time times the processor count
          const avg = fin.reduce((a, b) => a + b, 0) / NR;  // avg: the average time until a request is answered
          kpis.replaceChildren(  // rebuilds the three result cards
            h('div', { class: 'card tight center' }, h('div', { class: 'xs muted' }, 'All 4 answered after'), h('div', { class: 'b', style: { fontSize: '24px' } }, end + ' ms')),  // card: when all four requests were answered
            h('div', { class: 'card tight center' }, h('div', { class: 'xs muted' }, 'Average response time'), h('div', { class: 'b', style: { fontSize: '24px' } }, ctx.util.fmt(avg, 1) + ' ms')),  // card: the average response time
            h('div', { class: 'card tight center' }, h('div', { class: 'xs muted' }, 'Processors busy'), h('div', { class: 'b', style: { fontSize: '24px' } }, busyPct + '%')));  // card: how busy the processors were
          story.className = 'callout m0 small ' + (multi ? 'tip' : 'warn');  // colors the explanation green for the threaded server and amber for the single thread
          story.innerHTML = !multi  // the single-threaded explanation: the processor idles during disk waits and extra processors get no work
            ? `One thread serves the requests in turn. While it waits for the disk, it cannot start the next request, so the processor sits idle half the time, and ${ncpu > 1 ? 'the extra processors never get any work at all: a single thread can only use one processor at a time.' : 'request 4 waits 18 ms before it is even looked at.'}`  // continues the single-threaded text: with more processors, the extra ones never get work; with one, request 4 waits 18 ms
            : ncpu === 1 ? 'With a thread per request, when one thread blocks on the disk the kernel simply runs another. The single processor is never idle, and everything finishes in half the time.'  // one processor, one thread per request: another thread runs while one waits, so everything finishes in half the time
              : `Now threads of the <b>same process</b> run at the same instant on ${ncpu} processors. ${ncpu === 4 ? 'Every request has its own processor; the only waiting left is the disk itself.' : 'Two requests are processed at once, so the queue drains even faster.'}`;  // several processors: threads of the same process run at the same instant on different processors
        }  // ends draw() for step 5
        draw();  // draws the starting timeline so the step opens filled in
        el.append(h('div', { class: 'split l fill' },  // lays out step 5: explanation on the left, the simulation on the right (stacked on phones)
          h('div', { class: 'stack', style: { gap: '9px' } },  // left column: a stack of paragraphs
            h('p', { class: 'm0', html: 'Threads of <b>different processes</b> may run concurrently: on one processor they take turns so quickly that they appear to run together. What threads add is that the threads of <b>one process</b> can also be placed on different processors and run at literally the same moment, so a single program can use several processors.' }),  // paragraph: threads of one process can run at literally the same moment on different processors
            h('div', { class: 'card tight small', html: '<b>How threads talk.</b> Threads of one process share its address space: one thread writes a variable and another reads it, no kernel call needed (a lock or an atomic operation makes that reliable; section 5.1). Threads in <b>different</b> processes must first map shared memory (a <span class="t">section object</span>) into both, or exchange messages.' }),  // card: threads of one process talk through shared memory; different processes need a section object or messages
            h('div', { class: 'callout why m0 small', 'data-label': 'Why servers are built this way', html: 'A multithreaded process makes an efficient server. One process (one object, holding one copy of the code and shared data) serves everyone; each client request gets its own thread, so a request stuck waiting for the disk never holds up the others.' }),  // "Why servers are built this way" box: one process, one thread per client request
            story),  // the explanation box that changes with the choices; closes the left column
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the controls and the timeline
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, segDesign, segCpu),  // the design choice and the processor choice side by side
            h('p', { class: 'xs muted m0', html: 'Four requests arrive at time 0; each needs 2 ms of processing, a 3 ms disk read (reads may overlap), 1 ms to reply. <b style="color:var(--cpu)">Blue</b>: on a processor (C0 = processor 0) · <b style="color:var(--io)">orange</b>: disk · <b style="color:var(--warn)">amber</b>: ready, no free processor.' }),  // a short description of the four requests and a color key for the timeline
            svg, slider, cap, kpis)));  // the timeline, the time slider, the caption and the result cards; closes the layout
      },  // ends render() for step 5
    },  // ends step 5
    /* ---------------- 6. The six Windows thread states ---------------- */
    {  // step 6 begins: driving a thread through the six Windows thread states
      title: 'Six thread states: drive a thread through its life',  // step 6 title
      kind: 'lab',  // kind 'lab' labels this as a hands-on lab
      core: true,  // core: true keeps this step on the short route
      render(el, ctx) {  // render(el, ctx) builds step 6 when the student arrives on it
        const { h, s } = ctx;  // takes the element builders from ctx
        const ST = {  // ST: the six states as [x, y position in the diagram, runnable or not, description]
          Ready: [36, 52, true, 'The thread could run right now. It waits among the other ready threads, and the kernel\'s dispatcher considers them in priority order.'],  // state Ready: could run now, waits among other ready threads by priority
          Standby: [260, 52, true, 'The dispatcher has chosen this thread to run next on one particular processor. It waits for that processor; if its priority beats the thread running there, that thread is preempted.'],  // state Standby: chosen to run next on one particular processor
          Running: [484, 52, true, 'The thread is executing on a processor. It keeps going until a higher-priority thread preempts it, its quantum runs out, it blocks, or it terminates.'],  // state Running: executing until preempted, out of quantum, blocked or terminated
          Transition: [36, 228, false, 'The wait is over and the thread is ready to run, but something it needs, typically its kernel stack, has been paged out of memory. When the page is back it becomes Ready.'],  // state Transition: ready except that its kernel stack has been paged out
          Waiting: [260, 228, false, 'The thread is blocked on an event such as I/O, is waiting on purpose to synchronize with other threads, or has been suspended by its environment subsystem.'],  // state Waiting: blocked on I/O or a sync object, or suspended by its subsystem
          Terminated: [484, 228, false, 'The thread is finished: it ended itself, another thread ended it, or its process ended. After clean-up the executive removes it, or keeps the object to reuse for a new thread.'],  // state Terminated: finished, then removed or kept for reuse
        };  // closes ST
        const W = 140, HH = 56;  // W and HH: the width and height of each state box in the diagram
        const EV = [  // EV: the ten events as [id, button label, required state, new state, explanation]
          ['pick', 'Picked to run next', 'Ready', 'Standby', 'The dispatcher picks this thread to run next on processor 2, so it moves to <span class="t" data-t="Standby state">Standby</span>. Only one thread can be on standby for each processor.'],  // event "pick": Ready to Standby
          ['switch', 'Its processor becomes free', 'Standby', 'Running', 'Processor 2 finishes with its previous thread, the dispatcher switches context, and the thread is <b>Running</b>.'],  // event "switch": Standby to Running
          ['quantum', 'Quantum ends', 'Running', 'Ready', 'Its <span class="t">quantum</span> is used up. It did not block, so it goes straight back to <b>Ready</b> to take another turn later.'],  // event "quantum": Running back to Ready when its time slice ends
          ['preempt', 'Higher priority preempts it', 'Running', 'Ready', 'A higher-priority thread became ready, so this one is <b>preempted</b> and returns to <b>Ready</b>. It is still able to run; it has only lost the processor.'],  // event "preempt": Running back to Ready when a higher-priority thread arrives
          ['io', 'Waits for I/O or a sync object', 'Running', 'Waiting', 'The thread asks for a disk read (or waits on an event or mutex) and cannot continue until it completes, so it moves to <b>Waiting</b> and frees the processor.'],  // event "io": Running to Waiting for I/O or a sync object
          ['suspend', 'Subsystem suspends it', 'Running', 'Waiting', 'Its subsystem tells it to suspend itself: it sits in <b>Waiting</b> until resumed. Its memory stays put, unlike the swapped-out Suspended state of section 4.1.'],  // event "suspend": Running to Waiting when the subsystem suspends it
          ['wakeIn', 'Wait ends, stack in memory', 'Waiting', 'Ready', 'The wait is satisfied (or it was resumed) and everything it needs is in memory, so it becomes <b>Ready</b>.'],  // event "wakeIn": Waiting to Ready when the wait ends and the stack is in memory
          ['wakeOut', 'Wait ends, stack paged out', 'Waiting', 'Transition', 'The wait is satisfied, but while it slept its kernel stack was paged out to disk. It is ready in principle but must sit in <span class="t" data-t="Transition state">Transition</span>.'],  // event "wakeOut": Waiting to Transition when the wait ends but the stack is paged out
          ['pageIn', 'Kernel stack paged back in', 'Transition', 'Ready', 'The memory manager brings the kernel stack back into memory. Nothing is missing now, so the thread becomes <b>Ready</b>.'],  // event "pageIn": Transition to Ready when the kernel stack is brought back
          ['term', 'Terminates', 'Running', 'Terminated', 'The thread returns from its start function (or is ended by another thread, or by its process ending) and becomes <b>Terminated</b>.'],  // event "term": Running to Terminated
        ];  // closes EV
        const WRONG = {  // WRONG: the reason shown when each event is pressed from the wrong state
          pick: 'The dispatcher only picks from <b>Ready</b> threads.',  // reason for "pick": only Ready threads are picked
          switch: 'A processor switches only to the thread already chosen for it, the one in <b>Standby</b>.',  // reason for "switch": a processor switches only to its Standby thread
          quantum: 'Only a <b>Running</b> thread has a quantum to use up.',  // reason for "quantum": only a Running thread has a quantum
          preempt: 'Only a <b>Running</b> thread has a processor to lose.',  // reason for "preempt": only a Running thread can lose a processor
          io: 'A thread asks to wait by executing code, so it must be <b>Running</b>.',  // reason for "io": a thread must be Running to ask to wait
          suspend: 'In the standard state diagram, the arrow into Waiting starts at <b>Running</b>.',  // reason for "suspend": the arrow into Waiting starts at Running
          wakeIn: 'Nothing to wake: the thread is not <b>Waiting</b> for anything.',  // reason for "wakeIn": the thread is not Waiting
          wakeOut: 'Nothing to wake: the thread is not <b>Waiting</b> for anything.',  // reason for "wakeOut": the thread is not Waiting
          pageIn: 'Only a thread in <b>Transition</b> is waiting for its kernel stack to come back.',  // reason for "pageIn": only a Transition thread waits for its kernel stack
          term: 'In the standard state diagram, the only arrow into Terminated starts at <b>Running</b>.',  // reason for "term": the arrow into Terminated starts at Running
        };  // closes WRONG
        const ARROWS = {  // ARROWS: the diagram's arrows as [SVG path, label x, label y, label, alignment, optional second label line]
          pick: ['M176 76 H254', 215, 68, 'pick to run', 'middle'],  // arrow from Ready to Standby: "pick to run"
          switch: ['M400 76 H478', 439, 68, 'switch', 'middle'],  // arrow from Standby to Running: "switch"
          preempt: ['M554 52 V30 H106 V46', 330, 24, 'preempted, or quantum ends', 'middle'],  // arrow looping from Running back over the top to Ready: "preempted, or quantum ends"
          block: ['M510 108 L382 224', 470, 160, 'block / suspend', 'start'],  // arrow from Running down to Waiting: "block / suspend"
          unblockIn: ['M290 228 L154 112', 240, 160, 'unblock / resume:', 'start', 'resources in memory'],  // arrow from Waiting up to Ready: "unblock / resume: resources in memory"
          unblockOut: ['M260 262 H182', 188, 302, 'unblock, but a', 'start', 'resource is paged out'],  // arrow from Waiting to Transition: "unblock, but a resource is paged out"
          pageIn: ['M80 228 V114', 88, 160, 'resources', 'start', 'available'],  // arrow from Transition up to Ready: "resources available"
          term: ['M604 108 V222', 596, 200, 'terminate', 'end'],  // arrow from Running down to Terminated: "terminate"
        };  // closes ARROWS
        const ARROW_OF = { pick: 'pick', switch: 'switch', quantum: 'preempt', preempt: 'preempt', io: 'block', suspend: 'block', wakeIn: 'unblockIn', wakeOut: 'unblockOut', pageIn: 'pageIn', term: 'term' };  // ARROW_OF: which arrow to highlight for each event (quantum and preempt share one arrow, as do io and suspend)
        const MISSIONS = [  // MISSIONS: four goals, each with a test on the move just made (from state a to state b)
          ['Get the thread running', (a, b) => b === 'Running'],  // mission 1: reach Running
          ['Make it lose the processor without blocking', (a, b) => a === 'Running' && b === 'Ready'],  // mission 2: go from Running to Ready (lose the processor without blocking)
          ['Take it through Transition and back to Ready', (a, b) => a === 'Transition' && b === 'Ready'],  // mission 3: go from Transition to Ready
          ['Terminate it', (a, b) => b === 'Terminated'],  // mission 4: reach Terminated
        ];  // closes MISSIONS
        let cur, last, done, hist;  // cur: the current state; last: the arrow just used; done: missions completed; hist: the log of moves
        const N = ctx.narrow; // phones: the arrow diagram would be too small, so show a two-column state board instead
        const svg = s('svg', { viewBox: '0 0 660 330', width: '100%', style: 'flex:none' });  // the state diagram SVG (used on wider screens)
        const board = h('div', { class: 'stgrid' });  // the two-column board of state cards (used on phones), styled by the section's .stgrid rule
        const stateCard = h('div', { class: 'card tight stack', style: { gap: '4px', minHeight: '104px' } });  // the card describing the current state
        const fb = h('div', { class: 'callout m0 small', style: { minHeight: '84px' } });  // the feedback box
        const mis = h('div', { class: 'stack', style: { gap: '3px' } });  // the mission checklist
        const log = h('div', { class: 'log', style: { height: '70px', fontSize: '13px' } });  // the move log, a short scrolling box
        const btns = EV.map(([id, lab]) => h('button', { class: 'btn sm', type: 'button', style: { whiteSpace: 'normal', height: 'auto', minHeight: '32px', lineHeight: '1.2', padding: '4px 9px' }, onclick: () => fire(id) }, lab));  // one button per event; pressing it tries that event
        function reset() {  // reset(): a brand-new thread in Ready, with no missions done and an empty log
          cur = 'Ready'; last = null; done = new Set(); hist = [];  // sets the starting state and clears missions and history
          fb.className = 'callout m0 small'; fb.removeAttribute('data-label'); fb.innerHTML = 'A new thread is <b>Ready</b>. The top three states are <b>runnable</b>: the thread could use a processor now. In the bottom three it cannot, until something changes. Press events to move it; illegal moves are refused, with the reason.';  // resets the feedback box and explains runnable versus non-runnable states and how to play
          paint();  // redraws everything
        }  // ends reset()
        function fire(id) {  // fire(id): tries event id on the thread
          const ev = EV.find((e) => e[0] === id);  // ev: the event's details
          if (cur !== ev[2]) {  // the thread is not in the state this event needs
            fb.className = 'callout bad m0 small'; fb.setAttribute('data-label', 'Not possible from ' + cur);  // turns the feedback red, labeled "Not possible from" the current state
            fb.innerHTML = `“${ev[1]}” cannot happen now. ${WRONG[id]} ${cur === 'Terminated' ? 'A terminated thread never runs again; press Reset to create a new one.' : `The thread is in <b>${cur}</b>.`}`;  // explains why, with a special note when the thread is already terminated
            return paint();  // redraws and stops, leaving the state unchanged
          }  // ends the refused case
          const from = cur; cur = ev[3]; last = ARROW_OF[id];  // moves the thread: remembers where it was, sets the new state and the arrow to highlight
          MISSIONS.forEach(([, test], k) => { if (test(from, cur)) done.add(k); });  // marks any mission this move completes
          hist.push(`${from} → ${cur}  (${ev[1]})`);  // adds the move to the log, such as "Ready to Standby (Picked to run next)"
          fb.className = 'callout tip m0 small'; fb.setAttribute('data-label', from + ' → ' + cur);  // turns the feedback green, labeled with the move
          fb.innerHTML = ev[4];  // shows the event's explanation
          paint();  // redraws everything with the thread in its new state
        }  // ends fire()
        function paint() {  // paint(): redraws the diagram (or phone board), the state card, the missions and the log
          const kids = [  // kids starts with the two background regions
            s('rect', { x: 8, y: 8, width: 644, height: 128, rx: 14, class: 's-panel', 'stroke-width': 1.2, 'stroke-dasharray': '6 4' }),  // a dashed region around the top row of states
            s('text', { x: 20, y: 27, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--ok)' }, 'RUNNABLE'),  // its green label "RUNNABLE"
            s('rect', { x: 8, y: 186, width: 644, height: 140, rx: 14, class: 's-panel', 'stroke-width': 1.2, 'stroke-dasharray': '6 4' }),  // a dashed region around the bottom row of states
            s('text', { x: 20, y: 316, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--bad)' }, 'NOT RUNNABLE'),  // its red label "NOT RUNNABLE"
          ];  // closes the starting shapes
          for (const [k, [d, lx, ly, t1, anchor, t2]] of Object.entries(ARROWS)) {  // draws every arrow with its label
            const on = k === last;  // on: whether this arrow is the one just used
            kids.push(s('path', { d, fill: 'none', class: on ? '' : 's-line', style: on ? 'stroke:var(--accent)' : null, 'stroke-width': on ? 3.5 : 1.8, 'marker-end': on ? 'url(#arr-accent)' : 'url(#arr)' }),  // the arrow line, thick and in the accent color if just used, with a matching arrowhead
              s('text', { x: lx, y: ly, 'text-anchor': anchor, 'font-size': 13, 'font-weight': on ? 800 : 500, style: on ? 'fill:var(--accent)' : null }, t1));  // the arrow's label, bold and colored if just used
            if (t2) kids.push(s('text', { x: lx, y: ly + 16, 'text-anchor': anchor, 'font-size': 13, 'font-weight': on ? 800 : 500, style: on ? 'fill:var(--accent)' : null }, t2));  // a second label line for arrows that have one
          }  // ends the arrow loop
          for (const [name, [x, y]] of Object.entries(ST)) {  // draws every state box
            const me = name === cur;  // me: whether the thread is in this state now
            kids.push(s('rect', { x, y, width: W, height: HH, rx: 12, class: me ? 's-thread' : 's-panel', 'stroke-width': me ? 4 : 1.6 }),  // the state's box, pink and thick for the current state
              s('text', { x: x + W / 2, y: y + (me ? 25 : 34), 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800 }, name));  // the state's name, moved up in the current state to make room for a marker
            if (me) kids.push(s('text', { x: x + W / 2, y: y + 45, 'text-anchor': 'middle', 'font-size': 13, style: 'fill:var(--thread)', 'font-weight': 700 }, '● the thread is here'));  // in the current state, the line "the thread is here"
          }  // ends the state loop
          svg.replaceChildren(...kids.filter(Boolean));  // replaces the old diagram with the new shapes
          const col = (title, names, cls) => h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'xs b', style: { color: `var(--${cls})` } }, title),  // col(): builds one column of the phone board, a colored title above one box per state
            ...names.map((n) => h('div', { class: 'box' + (n === cur ? ' thread' : ''), style: { borderWidth: n === cur ? '3px' : '2px' } }, n)));  // each state box; the current one is pink with a thicker border
          if (N) board.replaceChildren(col('RUNNABLE', ['Ready', 'Standby', 'Running'], 'ok'), col('NOT RUNNABLE', ['Waiting', 'Transition', 'Terminated'], 'bad'));  // on phones, fills the board with a runnable column and a not-runnable column
          const [, , run, desc] = ST[cur];  // run and desc: whether the current state is runnable, and its description
          const nextEv = EV.filter((e) => e[2] === cur).map((e) => e[1]);  // nextEv: the labels of the events that are legal from the current state
          stateCard.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Now: ' + cur), h('span', { class: 'chip ' + (run ? 'ok' : 'bad') }, run ? 'Runnable' : 'Not runnable')),  // the state card's top row: "Now:" with the state name, and a runnable or not-runnable chip
            h('p', { class: 'small m0' }, desc),  // the state's description
            ...(N ? [h('p', { class: 'xs muted m0' }, nextEv.length ? 'Legal next events: ' + nextEv.join(' · ') : 'No event can move it any more.')] : []));  // on phones only, lists the legal next events (the diagram's arrows show them on wider screens)
          mis.replaceChildren(h('b', { class: 'small' }, `Missions: ${done.size} of ${MISSIONS.length}`),  // the mission list's heading with the count done
            ...MISSIONS.map(([t], k) => h('div', { class: 'small', style: { color: done.has(k) ? 'var(--ok)' : 'var(--ink-2)' } }, (done.has(k) ? '✓ ' : '○ ') + t)));  // one line per mission, green with a tick when done
          log.replaceChildren(...(hist.length ? hist.slice().reverse().map((x) => h('div', {}, x)) : [h('div', { class: 'muted' }, 'Transitions will be listed here.')]));  // the move log, newest move first, or a placeholder before any move
        }  // ends paint()
        reset();  // starts with a new thread
        el.append(h('div', { class: 'split r fill' },  // lays out step 6: the diagram on the wider left, the controls on the right (stacked on phones)
          h('div', { class: 'stack', style: { gap: '10px' } }, N ? board : svg, stateCard,  // left column: the board on phones or the diagram otherwise, then the state card
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Calling Transition a kind of Waiting. A <b>waiting</b> thread still needs its event; a thread in <b>Transition</b> already has it and only needs a paged-out resource (its kernel stack) back.' })),  // "Common mistake" box: Transition is not a kind of Waiting; closes the left column
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column
            h('div', { class: 'grid-2', style: { gap: '6px' } }, ...btns),  // the ten event buttons in two columns
            fb, mis, log,  // the feedback box, the missions and the log
            h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset: new thread')))));  // the "Reset: new thread" button at the bottom right; closes the layout
      },  // ends render() for step 6
    },  // ends step 6
    /* ---------------- 7. Environment subsystems build on the executive ---------------- */
    {  // step 7 begins: how environment subsystems build on the executive
      title: 'Subsystems give processes their personality',  // step 7 title
      kind: 'explore',  // kind 'explore' labels this as an Explore step
      render(el, ctx) {  // render(el, ctx) builds step 7 when the student arrives on it
        const { h, s } = ctx;  // takes the element builders from ctx
        const MODES = {  // MODES: the two walkthroughs; each has a program label, its call, its subsystem and six frames
          win32: { app: 'Win32 program', call: 'CreateProcess(...)', sub: 'Win32 subsystem', frames: [  // the Win32 walkthrough, with frames as [parts to light up, caption]
            [['app', 'a1'], 'A Win32 program wants to start another program, so it calls <b>CreateProcess</b>, a Win32 API function.'],  // Win32 frame 1: the program calls CreateProcess
            [['sub', 'a1'], 'The call is handled by the <b>Win32 subsystem</b>: its DLLs inside the program and its server process. The subsystem knows the Win32 rules; the executive does not.'],  // Win32 frame 2: the Win32 subsystem handles the call
            [['sub', 'exe', 'a2', 'pobj', 'a3p'], 'The subsystem calls the executive\'s generic service: create a process object. It names the <b>calling program</b> as the parent, so the new process inherits that program\'s access token, quota limits, base priority and default processor affinity, not the subsystem server\'s. It also gets its own address space and handle table.'],  // Win32 frame 3: the subsystem asks the executive for a process object with the caller as parent
            [['exe', 'tobj', 'a3t'], 'Win32 rule: every new process starts with one thread. So the subsystem also has the executive create the first <b>thread object</b>.'],  // Win32 frame 4: the executive also creates the first thread object
            [['exe', 'sub', 'a4'], 'The executive returns <b>handles</b> to the new process and thread objects. To the executive these are ordinary, general-purpose objects.'],  // Win32 frame 5: the executive returns handles to the new objects
            [['sub', 'app', 'a5'], 'The Win32 subsystem <b>interprets</b> the handles in Win32 terms: it records the new process in its own bookkeeping and gives the program a process handle, a thread handle and both IDs.'],  // Win32 frame 6: the subsystem interprets the handles in Win32 terms
          ] },  // closes the Win32 frames and walkthrough
          posix: { app: 'POSIX program', call: 'fork()', sub: 'POSIX subsystem', frames: [  // the POSIX-style walkthrough, with its own six frames
            [['app', 'a1'], 'A program written for a POSIX-style subsystem (older Windows versions shipped one) calls <b>fork()</b>: make a copy of me.'],  // POSIX frame 1: the program calls fork()
            [['sub', 'a1'], 'The call is handled by the <b>POSIX subsystem</b>, which knows what fork means. The executive has no fork of its own.'],  // POSIX frame 2: the POSIX subsystem handles the call
            [['sub', 'exe', 'a2', 'pobj', 'a3p'], 'The subsystem uses the <b>same</b> generic executive service to create a process object, this time asking for a copy of the parent\'s address space.'],  // POSIX frame 3: the same executive service creates a process object with a copy of the address space
            [['exe', 'tobj', 'a3t'], 'A thread object is created for the child too, set to continue from the same point as the parent, because fork returns in both.'],  // POSIX frame 4: a thread object continues from the same point as the parent
            [['exe', 'sub', 'a4'], 'The executive hands back handles, exactly as it did for Win32. It does not care which personality asked.'],  // POSIX frame 5: the executive returns handles exactly as for Win32
            [['sub', 'app', 'a5'], 'The POSIX subsystem adds its own rules: it keeps the <b>parent-child link</b> so wait() and getppid() work, and returns the child\'s process ID. Same executive, different personality.'],  // POSIX frame 6: the subsystem keeps the parent-child link and returns the child's ID
          ] },  // closes the POSIX frames and walkthrough
        };  // closes MODES
        let mode = 'win32';  // mode: which walkthrough is showing
        const svg = s('svg', { viewBox: '0 0 660 318', width: '100%', style: 'flex:none' });  // the step's SVG drawing of user mode, kernel mode and the boxes and arrows
        function box(id, on, x, y, w, hgt, cls, lines) {  // box(): draws one labeled box, faded unless it is lit up in this frame
          const g = s('g', { opacity: on ? 1 : 0.5 }, s('rect', { x, y, width: w, height: hgt, rx: 12, class: cls, 'stroke-width': on ? 3.5 : 1.5 }));  // the box's group and rectangle, thicker when lit
          lines.forEach(([t, dy, bold], i) => g.append(s('text', { x: x + w / 2, y: y + dy, 'text-anchor': 'middle', 'font-size': i === 0 ? 15 : 13, 'font-weight': bold ? 800 : 500, class: bold ? null : 's-sub' }, t)));  // its text lines, the first one larger; bold lines are dark, others gray
          return g;  // returns the finished box
        }  // ends box()
        function arrow(on, d, lx, ly, t, anchor = 'middle') {  // arrow(): draws one labeled arrow, highlighted in the accent color when lit and faded otherwise
          return s('g', { opacity: on ? 1 : 0.35 }, s('path', { d, fill: 'none', class: on ? '' : 's-line', style: on ? 'stroke:var(--accent)' : null, 'stroke-width': on ? 3 : 1.6, 'marker-end': on ? 'url(#arr-accent)' : 'url(#arr)' }),  // the arrow line with its arrowhead
            s('text', { x: lx, y: ly, 'text-anchor': anchor, 'font-size': 13, 'font-weight': 700, style: on ? 'fill:var(--accent)' : null }, t));  // the arrow's label; closes the group
        }  // ends arrow()
        const N = ctx.narrow; // phones: stack the boxes vertically so the text stays readable
        if (N) svg.setAttribute('viewBox', '0 0 340 438');  // on phones, a tall drawing with the boxes stacked vertically
        function draw(i) {  // draw(i): redraws the drawing for frame i and returns its caption; the player calls it
          const M = MODES[mode]; const [on, cap] = M.frames[i]; const is = (k) => on.includes(k);  // M: the current walkthrough; on: the parts to light up; cap: the caption; is(k) tells whether part k is lit
          const L = N ? {  // L: where everything goes; this first layout is for phones
            user: [2, 2, 336, 206, 20], kern: [2, 220, 336, 214, 238],  // phones: the user-mode and kernel-mode regions and their label heights
            app: [16, 30, 308, 56, [[M.app, 24, true], ['calls ' + M.call, 44]]],  // phones: the program box and its two lines of text
            sub: [16, 122, 308, 84, [[M.sub, 24, true], ['DLLs in each program + a server process', 46], ['decides what process features mean', 66]]],  // phones: the subsystem box and its three lines
            exe: [16, 256, 308, 84, [['Executive', 24, true], ['process and thread manager', 46], ['generic services: create, open, end', 66]]],  // phones: the executive box and its three lines
            pobj: [16, 370, 146, 44], tobj: [178, 370, 146, 44],  // phones: the process-object and thread-object boxes side by side at the bottom
            a1: ['M120 86 V116', 128, 106, 'call', 'start'], a2: ['M120 206 V250', 128, 234, 'create', 'start'], a3p: ['M89 340 V364', 0, 0, ''], a3t: ['M251 340 V364', 0, 0, ''],  // phones: the call, create and two object arrows
            a4: ['M220 250 V212', 228, 234, 'handles', 'start'], a5: ['M220 116 V92', 228, 106, 'handles, IDs', 'start'],  // phones: the two arrows carrying handles back up
          } : {  // the second layout, for wider screens
            user: [2, 2, 656, 150, 22], kern: [2, 164, 656, 152, 184],  // wide: the user-mode and kernel-mode regions
            app: [18, 42, 170, 88, [[M.app, 34, true], ['calls ' + M.call, 58]]],  // wide: the program box on the left
            sub: [290, 32, 352, 104, [[M.sub, 30, true], ['the DLLs inside each program', 54], ['+ a server process', 74], ['decides what process features mean', 94]]],  // wide: the subsystem box on the right, with four lines of text
            exe: [200, 196, 250, 104, [['Executive', 30, true], ['process and thread manager', 54], ['generic services only:', 74], ['create, open, end objects', 94]]],  // wide: the executive box in the kernel region
            pobj: [490, 196, 152, 46], tobj: [490, 254, 152, 46],  // wide: the process-object and thread-object boxes stacked on the right
            a1: ['M188 72 H284', 236, 64, 'call', 'middle'], a2: ['M330 136 V190', 338, 170, 'create', 'start'], a3p: ['M450 219 H484', 0, 0, ''], a3t: ['M450 277 H484', 0, 0, ''],  // wide: the call, create and two object arrows
            a4: ['M420 190 V142', 428, 170, 'handles', 'start'], a5: ['M284 112 H194', 240, 104, 'handles, IDs', 'middle'],  // wide: the two arrows carrying handles back
          };  // closes the layout choice
          const [ux, uy, uw, uh, uly] = L.user, [kx, ky, kw, kh, kly] = L.kern;  // unpacks the positions of the user-mode and kernel-mode regions from the chosen layout
          svg.replaceChildren(  // replaces the drawing with this frame's shapes
            s('rect', { x: ux, y: uy, width: uw, height: uh, rx: 12, class: 's-panel', 'stroke-width': 1, 'stroke-dasharray': '5 4' }),  // the dashed user-mode region
            s('text', { x: 14, y: uly, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 'USER MODE'),  // its label "USER MODE"
            s('rect', { x: kx, y: ky, width: kw, height: kh, rx: 12, class: 's-os', 'stroke-width': 1, 'stroke-dasharray': '5 4', opacity: 0.55 }),  // the dashed, tinted kernel-mode region
            s('text', { x: 14, y: kly, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }, 'KERNEL MODE'),  // its label "KERNEL MODE"
            box('app', is('app'), ...L.app.slice(0, 4), 's-proc', L.app[4]),  // the program box, lit if this frame involves it
            box('sub', is('sub'), ...L.sub.slice(0, 4), 's-os', L.sub[4]),  // the subsystem box
            box('exe', is('exe'), ...L.exe.slice(0, 4), 's-os', L.exe[4]),  // the executive box
            box('pobj', is('pobj'), ...L.pobj, 's-proc', [['Process object', 28, true]]),  // the process-object box
            box('tobj', is('tobj'), ...L.tobj, 's-thread', [['Thread object', 28, true]]),  // the thread-object box
            ...['a1', 'a2', 'a3p', 'a3t', 'a4', 'a5'].map((k) => arrow(is(k), ...L[k])),  // the six arrows, each lit if this frame involves it
          );  // ends the drawing
          return cap;  // hands the caption to the player
        }  // ends draw() for step 7
        const player = ctx.ui.player({ count: 6, render: draw, interval: 2600 });  // the frame player; it calls draw() for each of the six frames and auto-advances every 2.6 s
        const seg = ctx.ui.seg([{ value: 'win32', label: 'Win32 program' }, { value: 'posix', label: 'POSIX-style program' }], mode, (v) => { mode = v; player.go(0); });  // the Win32 or POSIX-style choice; switching restarts the player at frame 1
        el.append(h('div', { class: 'split l fill' },  // lays out step 7: explanation on the left, the drawing on the right (stacked on phones)
          h('div', { class: 'stack', style: { gap: '10px' } },  // left column: a stack of paragraphs and cards
            h('p', { class: 'm0', html: 'Windows can host several operating-system "personalities", each provided by an <span class="t">environment subsystem</span>. Almost every program today uses Win32.' }),  // intro: Windows hosts operating-system personalities through environment subsystems
            h('div', { class: 'grid-2', style: { gap: '8px' } },  // two cards side by side
              h('div', { class: 'card tight small', style: { borderTop: '4px solid var(--os)' }, html: '<b>The executive</b> supplies plain, general services: create a process object, create a thread object, open, wait, end. It returns handles and imposes very little policy.' }),  // card: the executive supplies plain, general services and returns handles
              h('div', { class: 'card tight small', style: { borderTop: '4px solid var(--os)' }, html: '<b>Each subsystem</b> is responsible for the process and thread features of its own personality. It calls the executive, then interprets the handles that come back.' })),  // card: each subsystem gives process and thread features their meaning; closes the pair
            h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'The executive is a builder who puts up standard rooms. Each subsystem is an interior designer who decides what a room is for and furnishes it to match its own style.' }),  // analogy box: the executive builds standard rooms, each subsystem furnishes them in its own style
            h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'The executive keeps processes simple: it notes which process created a new one but enforces no family tree (ending a parent does not end its children). A subsystem that needs parent-and-child rules, as POSIX does, keeps them itself, so new personalities need no kernel changes.' })),  // "Why it matters" box: the executive enforces no family tree; a subsystem that needs one keeps it; closes the column
          h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, 'Follow one process creation'), seg), svg, player.el)));  // right column: a heading with the mode choice, then the drawing and the player; closes the layout
      },  // ends render() for step 7
    },  // ends step 7
    /* ---------------- 8. Recap ---------------- */
    {  // step 8 begins: the recap
      title: 'Recap: Windows processes and threads on one page',  // step 8 title
      kind: 'recap',  // kind 'recap' labels this as a Recap and keeps it on the short route
      render(el, ctx) {  // render(el, ctx) builds step 8 when the student arrives on it
        const { h } = ctx;  // takes the element builder from ctx
        el.append(h('div', { class: 'stack fill' },  // lays out the recap as a vertical stack
          h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. Then check yourself.'),  // instruction: say each answer aloud before flipping the card
          ctx.ui.flipcards([  // flipcards(): a grid of cards showing a question on the front and the answer on the back when clicked
            ['What does a process own, and what does each thread keep?', '<div><b>Process:</b> address space, code, handles, security context, ID, environment variables, priority class, working-set limits. <b>Thread:</b> its own ID, saved context, priority, thread-local storage and exception handlers.</div>'],  // card 1: what a process owns and what each thread keeps
            ['Job, thread pool, fiber, UMS?', '<div><b>Job:</b> processes managed as one unit. <b>Pool:</b> system-kept workers run your callbacks. <b>Fiber:</b> switched by hand inside one thread, kernel unaware. <b>UMS:</b> the app schedules its own real threads.</div>'],  // card 2: job, thread pool, fiber and UMS in one line each
            ['What happens to a Modern app in the background?', '<div>Only the foreground app runs. PLM <b>suspends</b> background apps and may <b>terminate</b> them without warning when memory runs low, so apps save state on suspension. Background tasks get a small budget.</div>'],  // card 3: what happens to a Modern app in the background
            ['What four things make up a Windows process?', '<div>An <b>access token</b> (whom it acts for), <b>virtual address descriptors</b> (its address map), a <b>handle table</b> (objects it has opened) and <b>one or more threads</b>.</div>'],  // card 4: the four things that make up a Windows process
            ['Process object or thread object?', '<div><b>Process:</b> security descriptor, default affinity, quotas, I/O and VM counters, exception/debug ports. <b>Thread:</b> context, dynamic priority, affinity, alert status, suspension count, impersonation token, termination port. <b>Both:</b> ID, base priority, execution time, exit status.</div>'],  // card 5: which attributes belong to the process object, the thread object or both
            ['How does multithreading help?', '<div>Threads of different processes run concurrently, and a process can also run its own threads at the same instant on different processors. Same-process threads share memory directly. A thread per request makes an efficient server.</div>'],  // card 6: how multithreading helps
            ['Name the six thread states.', '<div><b>Runnable:</b> Ready → Standby → Running. <b>Not runnable:</b> Waiting (I/O, sync or suspended), Transition (ready, but kernel stack paged out), Terminated.</div>'],  // card 7: the six thread states, runnable and not runnable
            ['Who gives a process its personality?', '<div>The <b>environment subsystem</b>. The executive only creates generic process and thread objects and returns handles; the subsystem interprets them by its own rules. It names the calling program as parent, so the new process inherits that program\'s token, quotas, base priority and affinity.</div>'],  // card 8: the environment subsystem gives a process its personality
          ], { cols: 4, height: 226 })));  // closes the card list; four columns of cards, each 226 px tall
      },  // ends render() for step 8
    },  // ends step 8
    /* ---------------- 9. Check yourself ---------------- */
    {  // step 9 begins: the end-of-section quiz
      title: 'Check yourself: Windows processes and threads',  // step 9 title
      kind: 'check',  // kind 'check' labels this as Check Yourself and keeps it on the short route
      quiz: [  // quiz: the questions; the guide's quiz engine draws them, grades answers and shows feedback
        { q: 'A Windows program opens a file and gets back the number 0x04. What is that number?',  // question 1 (multiple choice): what the number 0x04 returned by opening a file is
          choices: ['A handle: an index into the process’s own handle table, whose entry points to the file object', 'A direct pointer to the file object in system memory, which the program follows to read the file', 'A system-wide file ID that any other process can also use to reach the same open file', 'A count of how many of the program’s threads are currently allowed to use the file'], answer: 0,  // the four choices; answer 0 (the first) is correct: a handle
          feedback: [null, 'Programs never get a direct pointer to an object. They hold only an index into their own table, so Windows can check every use.', 'Handles are private to one process. Another process’s 0x04, if it has one, names a different entry in a different table.', 'A handle names an opened object and says nothing about threads: every thread of the process can use it.'],  // feedback for each wrong choice
          why: 'A handle is a small number private to one process. It indexes that process’s handle table, and the table entry points to the object, which lives in system memory outside the process.' },  // why: a handle indexes the process's own handle table
        { type: 'multi', q: 'Which of these does each Windows thread keep for itself instead of sharing with the other threads of its process? Select all that apply.',  // question 2 (select all that apply): what each thread keeps for itself
          choices: ['Thread-local storage', 'Exception handlers', 'Virtual address space', 'Saved context (register values)', 'The process\'s access token', 'Environment variables'], answer: [0, 1, 3],  // the six options; the answers are thread-local storage, exception handlers and saved context
          why: 'Each thread has its own ID, saved context, scheduling priority, thread-local storage and exception handlers. The address space, security context and environment variables belong to the process and are shared.' },  // why: the private per-thread items versus the shared process items
        { type: 'match', q: 'Match each Windows building block to what it does.',  // question 3 (match the pairs): each building block with what it does
          pairs: [['Job object', 'Manages a group of processes as one unit'], ['Thread pool', 'Worker threads that run asynchronous callbacks for the app'], ['Fiber', 'A unit of execution the app switches to by hand inside one thread'], ['User-mode scheduling (UMS)', 'Lets an app schedule its own real threads in user mode']],  // the four building-block and description pairs
          why: 'Jobs group processes; pools run callbacks on system-managed workers; fibers are scheduled manually and are invisible to the kernel; UMS lets an application schedule real kernel threads itself.' },  // why: one line on each building block
        { type: 'tf', q: 'When memory runs low, Windows warns a suspended Modern app just before terminating it, so the app can save its state at that moment.', answer: false,  // question 4 (true or false): false, because a suspended app gets no warning before being terminated
          why: 'A suspended app is terminated without warning. That is why it must save its app state data when it is suspended, and restore that data if it is relaunched.' },  // why: the app must save its state when suspended
        { q: 'One Windows thread hosts four fibers. One fiber makes a blocking file read that must wait for the disk. What happens to the other three fibers until the read completes?',  // question 5 (multiple choice): what happens to the other fibers when one fiber blocks
          choices: ['None of them runs: the kernel blocks the host thread, and all four fibers live inside it', 'The kernel switches to another fiber of the same thread', 'The application\'s own scheduler is told about the block and runs another fiber', 'They keep running, because the kernel schedules each fiber separately'], answer: 0,  // the four choices; the first is correct: none of them runs
          feedback: [null, 'The kernel does not know fibers exist, so it cannot switch between them; it sees only the thread, which is now blocked.', 'That notification is what user-mode scheduling (UMS) gives for real threads. A fiber scheduler gets no such notice, and it is stuck inside the blocked thread anyway.', 'Only the host thread is scheduled by the kernel; the fibers are switched by explicit calls in the program.'],  // feedback for each wrong choice
          why: 'Fibers are switched by explicit calls inside one thread and are invisible to the kernel, so when one fiber blocks, the kernel blocks its whole host thread. UMS avoids this: its threads are real kernel threads, and the app\'s scheduler regains control when one blocks.' },  // why: the kernel blocks the whole host thread; UMS avoids this
        { type: 'bucket', q: 'Sort each attribute onto the Windows object that holds it.', buckets: ['Process object', 'Thread object'],  // question 6 (sort into groups): attributes onto the process object or the thread object
          items: [['Quota limits', 0], ['VM operation counters', 0], ['Exception/debugging ports', 0], ['Suspension count', 1], ['Impersonation token', 1], ['Thread context', 1]],  // the six items as [attribute, correct group] pairs
          why: 'The process object holds what belongs to the whole container: quota limits, counters and the exception/debugging ports. The thread object holds what belongs to one path of execution: its context, suspension count and impersonation token.' },  // why: the container's attributes versus one path of execution's attributes
        { q: 'Every Windows process has an access token. What is it for?',  // question 7 (multiple choice): what the access token is for
          choices: ['Recording which ranges of the address space are in use', 'Identifying whom the process acts for, so Windows can decide whether it may open protected objects', 'Numbering the objects the process has opened', 'Storing the saved registers of the primary thread'], answer: 1,  // the four choices; the second is correct
          feedback: ['That is the job of the virtual address descriptors, the memory manager\'s records of which address ranges are in use.', null, 'That is the handle table: one entry per opened object, and the entry\'s number is the handle.', 'Saved registers are each thread\'s own context, kept per thread, not in a token shared by the whole process.'],  // feedback for each wrong choice, naming what the wrong answer really describes
          why: 'The access token holds the user identity, groups and privileges. Each attempt to open a protected object is checked against it.' },  // why: the token holds identity, groups and privileges for access checks
        { type: 'order', q: 'A ready thread is picked for a processor, runs, blocks on a disk read, and while it waits its kernel stack is paged out. Put the states it visits in order, up to the moment its read has completed.',  // question 8 (put in order): the states a thread visits up to the end of its disk read
          items: ['Ready', 'Standby', 'Running', 'Waiting', 'Transition'],  // the five states in the correct order; the quiz engine shuffles them for the student
          why: 'Ready → Standby (picked for one processor) → Running → Waiting (blocked on the read) → Transition (the read is done, but the kernel stack must come back into memory). Only then does it return to Ready.' },  // why: the path through Standby, Running, Waiting and Transition
        { q: 'What does the Standby state mean for a Windows thread?',  // question 9 (multiple choice): what the Standby state means
          choices: ['It has been selected to run next on a particular processor and is waiting for that processor', 'It is blocked until an I/O operation finishes', 'It is ready to run, but its kernel stack is paged out of memory', 'It has finished and is waiting to be cleaned up'], answer: 0,  // the four choices; the first is correct
          feedback: [null, 'That describes Waiting: the thread cannot continue until its I/O finishes, so no processor has been picked for it.', 'That describes Transition: the thread is ready except that its kernel stack must first be paged back in.', 'That describes Terminated: the thread has finished and will never be scheduled again.'],  // feedback for each wrong choice, naming the state it really describes
          why: 'Standby sits between Ready and Running: the dispatcher has picked the thread for one processor. If its priority is high enough, the thread now running on that processor may be preempted.' },  // why: Standby sits between Ready and Running
        { type: 'num', q: 'A single-threaded server handles 4 requests strictly one after another. Each request needs 2 ms of processing, then a 3 ms disk read, then 1 ms to reply, and the thread does nothing else while it waits. How many milliseconds pass until all four are answered?',  // question 10 (calculate): time for a single-threaded server to answer four requests
          answer: 24, tol: 0, unit: 'ms',  // the answer is exactly 24 ms
          why: 'Each request takes 2 + 3 + 1 = 6 ms and nothing overlaps: 4 × 6 = 24 ms. With one thread per request, one thread\'s disk wait overlaps another\'s processing, so the same work finishes far sooner (12 ms on one processor).' },  // why: 4 times 6 ms with no overlap, compared with 12 ms using one thread per request
        { type: 'num', q: 'A Windows thread is suspended 3 times and then resumed once. What is its suspension count now?', answer: 2, tol: 0,  // question 11 (calculate): suspension count after 3 suspends and 1 resume; the answer is exactly 2
          why: 'Each suspend adds 1 and each resume subtracts 1: 3 − 1 = 2. The thread may run again only when its suspension count is back to 0.' },  // why: each suspend adds 1 and each resume subtracts 1
        { q: 'When a program creates a new process, what does its environment subsystem do that the executive does not?',  // question 12 (multiple choice): what the environment subsystem does that the executive does not
          choices: ['Allocate the physical memory for the new process', 'Interpret the returned handles and apply its own personality\'s rules, such as Win32\'s first thread or POSIX\'s parent-child link', 'Schedule the new process\'s threads on processors', 'Build the process object itself'], answer: 1,  // the four choices; the second is correct
          feedback: ['Memory belongs to the executive\'s memory manager, whichever subsystem asked for the process.', null, 'Scheduling belongs to the kernel\'s dispatcher, not to a subsystem.', 'The executive\'s process manager builds the object; the subsystem only asks for it.'],  // feedback for each wrong choice, naming who really does that job
          why: 'The executive offers generic process and thread services and returns handles. Each subsystem gives those objects the meaning its own personality requires; it also names the calling program as the parent, so the new process inherits that program\'s access token, quotas, base priority and affinity.' },  // why: the subsystem interprets the returned handles by its own rules
      ],  // closes the quiz list
    },  // ends step 9
  ],  // closes the steps list

  notes: `${/* notes: the section's reading notes as HTML, shown in the Notes panel on any step of this section */''}
    <h3>Windows process and thread management</h3>${/* notes heading: Windows process and thread management */''}
    <p>Windows separates <b>owning resources</b> (the process) from <b>being scheduled</b> (the thread). Both are kernel <b>objects</b> with built-in synchronization: another thread can wait on either one.</p>${/* notes paragraph: processes own resources, threads get scheduled, and both are kernel objects */''}

    <h4>1. The basic building blocks</h4>${/* notes subheading 1: the basic building blocks */''}
    <p>An <b>application</b> consists of one or more <b>processes</b>. A process is a running instance of a program together with everything it owns:</p>${/* notes paragraph: an application is one or more processes, each owning the items listed next */''}
    <ul>${/* starts the list of what a process owns */''}
      <li>a private <b>virtual address space</b> and the <b>executable code</b> loaded into it;</li>${/* owned item: the virtual address space and the executable code */''}
      <li><b>open handles</b> to system objects (files, events, other processes and threads);</li>${/* owned item: open handles to system objects */''}
      <li>a <b>security context</b> (the access token: user, groups, privileges) and a <b>unique process ID</b>;</li>${/* owned item: the security context and the unique process ID */''}
      <li><b>environment variables</b>, a <b>priority class</b>, and a <b>minimum and maximum working-set size</b>;</li>${/* owned items: environment variables, priority class and working-set limits */''}
      <li><b>at least one thread</b>; the first is called the primary thread.</li>${/* owned item: at least one thread, the first being the primary thread */''}
    </ul>${/* ends the list of what a process owns */''}
    <p>A <b>thread</b> is the schedulable entity inside a process. All threads of a process share its address space and resources. Each thread also keeps its own <b>exception handlers</b>, <b>scheduling priority</b>, <b>thread-local storage</b> (a variable with a separate value per thread), <b>unique thread ID</b> and <b>saved context</b> (register values kept while it is not running).</p>${/* notes paragraph: what a thread is and the five items each thread keeps for itself */''}

    <h4>2. Four extra building blocks</h4>${/* notes subheading 2: the four extra building blocks */''}
    <table>${/* starts the building-blocks table */''}
      <tr><th>Tool</th><th>What it is</th><th>Who decides what runs</th></tr>${/* table header: tool, what it is, who decides what runs */''}
      <tr><td>Job object</td><td>A group of processes managed as one unit: shared limits (memory, processor time, number of processes), shared accounting, one call ends them all.</td><td>Normal scheduling; the job only groups and limits.</td></tr>${/* table row: the job object */''}
      <tr><td>Thread pool</td><td>System-kept worker threads that run asynchronous callbacks the application submits (timers, I/O completions, small tasks).</td><td>The kernel schedules the workers.</td></tr>${/* table row: the thread pool */''}
      <tr><td>Fiber</td><td>A unit of execution scheduled manually by the application. Fibers run inside a thread and take on its identity (its ID, its thread-local storage). The kernel does not know they exist, so one blocking fiber stalls its whole thread, exactly like the user-level threads of section 4.2. Useful for porting programs that schedule their own tasks.</td><td>The application, by explicit switches.</td></tr>${/* table row: the fiber, compared with user-level threads */''}
      <tr><td>User-mode scheduling (UMS)</td><td>Lets an application schedule its own real threads, switching in user mode without the system scheduler. Each UMS thread has its own context, and the app regains control when one blocks in the kernel. More efficient than a pool for short work items that make few system calls. Introduced in 64-bit Windows 7; deprecated and no longer supported starting with Windows 11.</td><td>The application, for real threads.</td></tr>${/* table row: user-mode scheduling and its Windows versions */''}
    </table>${/* ends the building-blocks table */''}

    <h4>3. Background apps from Windows 8 onward</h4>${/* notes subheading 3: background apps from Windows 8 onward */''}
    <p>Classic desktop programs keep running in the background. Modern (Store) apps are managed by <b>process lifetime management (PLM)</b>:</p>${/* notes paragraph: Modern apps are managed by process lifetime management */''}
    <ul>${/* starts the list of lifecycle rules */''}
      <li>Only the <b>foreground</b> app is active.</li>${/* rule: only the foreground app is active */''}
      <li>A few seconds after an app leaves the foreground, it is <b>suspended</b>: its threads get no processor time, but its memory is kept, so switching back is instant.</li>${/* rule: a background app is suspended but keeps its memory */''}
      <li>If memory runs low, Windows may <b>terminate</b> a suspended app, with no warning.</li>${/* rule: a suspended app may be terminated without warning */''}
      <li>So the developer must save <b>app state data</b> on suspension and restore it on relaunch; done right, the user never notices.</li>${/* rule: the developer saves app state on suspension and restores it on relaunch */''}
      <li>An app can register <b>background tasks</b> that run on a trigger with limited processor time and memory while the app itself stays suspended.</li>${/* rule: background tasks run on triggers with limited resources */''}
    </ul>${/* ends the list of lifecycle rules */''}
    <p>Why: on a tablet or laptop, a hidden app should use neither memory nor battery.</p>${/* notes paragraph: why, in terms of memory and battery */''}

    <h4>4. Inside a Windows process</h4>${/* notes subheading 4: inside a Windows process */''}
    <p>Each process is a <b>process object</b> made of:</p>${/* notes paragraph: a process object is made of the four parts listed next */''}
    <ul>${/* starts the list of the four parts */''}
      <li>an <b>access token</b>: whom the process acts for. Windows checks it whenever the process opens a protected object (a file only group HR may open is refused if the token lacks HR).</li>${/* part: the access token and how it decides what the process may open */''}
      <li><b>virtual address descriptors (VADs)</b>: one record per range of the address space in use (program image, heap, each thread's stack, private data, mapped views), kept by the memory manager.</li>${/* part: the virtual address descriptors kept by the memory manager */''}
      <li>a <b>handle table</b>: one entry per object it has opened (files, sections, threads...). A handle is the entry's number, private to this process; the object itself lives in system memory, and the program never gets a direct pointer to it. A freed entry is reused. Closing a thread's handle does not stop the thread.</li>${/* part: the handle table, private handle numbers and reused entries */''}
      <li><b>one or more threads</b>, each represented by a thread object.</li>${/* part: one or more threads, each a thread object */''}
    </ul>${/* ends the list of parts */''}
    <table>${/* starts the table comparing process and thread object attributes */''}
      <tr><th>Process object attributes</th><th>Thread object attributes</th></tr>${/* table header: process object attributes beside thread object attributes */''}
      <tr><td>Process ID</td><td>Thread ID</td></tr>${/* table row: process ID beside thread ID */''}
      <tr><td>Security descriptor (who may open or control it)</td><td>Thread context (saved registers)</td></tr>${/* table row: security descriptor beside thread context */''}
      <tr><td>Base priority (starting point for its threads)</td><td>Dynamic priority (current value, may be boosted) and base priority (its floor)</td></tr>${/* table row: base priority beside dynamic and base priority */''}
      <tr><td>Default processor affinity</td><td>Thread processor affinity (all or part of the process's set)</td></tr>${/* table row: default processor affinity beside thread processor affinity */''}
      <tr><td>Quota limits (memory, paging file, processor time)</td><td>Thread execution time (user and kernel mode)</td></tr>${/* table row: quota limits beside thread execution time */''}
      <tr><td>Execution time (all threads added together)</td><td>Alert status (may it run an asynchronous procedure call while waiting?)</td></tr>${/* table row: total execution time beside alert status */''}
      <tr><td>I/O counters and VM operation counters</td><td>Suspension count (suspends minus resumes; runs only at 0)</td></tr>${/* table row: I/O and VM counters beside suspension count */''}
      <tr><td>Exception/debugging ports (messages to the subsystem or a debugger)</td><td>Impersonation token (act on behalf of another user) and termination port</td></tr>${/* table row: exception and debugging ports beside impersonation token and termination port */''}
      <tr><td>Exit status (object signaled at exit)</td><td>Thread exit status (object signaled at exit)</td></tr>${/* table row: exit status beside thread exit status */''}
    </table>${/* ends the attribute table */''}
    <p>Pattern: the process holds what applies to the whole container; the thread holds what belongs to one path of execution. ID, base priority, execution time and exit status appear on <b>both</b>. Example: a thread suspended 3 times and resumed once has a suspension count of 2 and cannot run.</p>${/* notes paragraph: the pattern behind the attributes and a suspension-count example */''}

    <h4>5. Multithreading</h4>${/* notes subheading 5: multithreading */''}
    <ul>${/* starts the list of multithreading points */''}
      <li>Threads in <b>different processes</b> may execute concurrently (on one processor they interleave and only appear to run together).</li>${/* point: threads of different processes run concurrently */''}
      <li>Threads of the <b>same process</b> can also be placed on different processors and run at the same instant, so one program can use several processors.</li>${/* point: threads of one process can run at the same instant on different processors */''}
      <li>Threads of one process exchange information through their shared address space; threads in different processes need <b>shared memory set up between the processes</b> (a section object mapped into both) or messages.</li>${/* point: how threads of one process, and of different processes, exchange information */''}
      <li>A multithreaded process is an efficient <b>server</b>: one copy of code and data, one thread per client request.</li>${/* point: a multithreaded process makes an efficient server */''}
    </ul>${/* ends the multithreading list */''}
    <p><b>Worked example.</b> Four requests arrive at time 0; each needs 2 ms of processing, a 3 ms disk read (reads may overlap) and 1 ms to reply. A single-threaded server takes 4 × (2 + 3 + 1) = <b>24 ms</b>, and the processor is idle half the time. With one thread per request, disk waits overlap other requests' processing: all four finish after <b>12 ms</b> on one processor, <b>8 ms</b> on two and <b>6 ms</b> on four.</p>${/* notes paragraph: the four-request server worked example (24, 12, 8 and 6 ms) */''}

    <h4>6. The six thread states</h4>${/* notes subheading 6: the six thread states */''}
    <svg viewBox="0 0 520 190" width="100%">${/* a small SVG diagram of the six states, drawn directly in the notes */''}
      <defs><marker id="n44a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#3d4760"/></marker></defs>${/* defines the arrowhead used by the diagram's arrows */''}
      <rect x="4" y="4" width="512" height="70" rx="10" fill="#dcf5e3" stroke="#15803d"/><text x="12" y="20" font-size="11" style="fill:#15803d">Runnable</text>${/* the green "Runnable" region behind the top row of states */''}
      <rect x="4" y="116" width="512" height="70" rx="10" fill="#fde1e1" stroke="#dc2626"/><text x="12" y="182" font-size="11" style="fill:#dc2626">Not runnable</text>${/* the red "Not runnable" region behind the bottom row of states */''}
      <rect x="30" y="26" width="110" height="36" rx="8" fill="#ffffff" stroke="#3d4760"/><text x="85" y="49" font-size="13" text-anchor="middle" style="fill:#151c2c">Ready</text>${/* state box: Ready */''}
      <rect x="205" y="26" width="110" height="36" rx="8" fill="#ffffff" stroke="#3d4760"/><text x="260" y="49" font-size="13" text-anchor="middle" style="fill:#151c2c">Standby</text>${/* state box: Standby */''}
      <rect x="380" y="26" width="110" height="36" rx="8" fill="#ffffff" stroke="#3d4760"/><text x="435" y="49" font-size="13" text-anchor="middle" style="fill:#151c2c">Running</text>${/* state box: Running */''}
      <rect x="30" y="128" width="110" height="36" rx="8" fill="#ffffff" stroke="#3d4760"/><text x="85" y="151" font-size="13" text-anchor="middle" style="fill:#151c2c">Transition</text>${/* state box: Transition */''}
      <rect x="205" y="128" width="110" height="36" rx="8" fill="#ffffff" stroke="#3d4760"/><text x="260" y="151" font-size="13" text-anchor="middle" style="fill:#151c2c">Waiting</text>${/* state box: Waiting */''}
      <rect x="380" y="128" width="110" height="36" rx="8" fill="#ffffff" stroke="#3d4760"/><text x="435" y="151" font-size="13" text-anchor="middle" style="fill:#151c2c">Terminated</text>${/* state box: Terminated */''}
      <path d="M140 44 H199" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>${/* arrow: Ready to Standby */''}
      <path d="M315 44 H374" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>${/* arrow: Standby to Running */''}
      <path d="M398 62 L304 124" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>${/* arrow: Running to Waiting */''}
      <path d="M205 146 H146" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>${/* arrow: Waiting to Transition */''}
      <path d="M60 128 V68" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>${/* arrow: Transition to Ready */''}
      <path d="M240 128 L114 66" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>${/* arrow: Waiting to Ready */''}
      <path d="M470 62 V122" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>${/* arrow: Running to Terminated */''}
      <path d="M435 26 V12 H85 V20" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>${/* arrow: Running back over the top to Ready */''}
      <text x="260" y="23" font-size="10" text-anchor="middle" style="fill:#151c2c">preempted / quantum ends</text>${/* the label on that top arrow: "preempted / quantum ends" */''}
    </svg>${/* ends the state diagram */''}
    <ul>${/* starts the list describing each state */''}
      <li><b>Ready</b>: may be scheduled; the dispatcher considers ready threads in priority order.</li>${/* state: Ready */''}
      <li><b>Standby</b>: selected to run next on a particular processor; waits until that processor is free. If its priority is high enough, the thread running there is preempted.</li>${/* state: Standby */''}
      <li><b>Running</b>: executing until it is preempted by a higher-priority thread, uses up its quantum (both send it back to Ready), blocks or terminates.</li>${/* state: Running and the four ways it ends */''}
      <li><b>Waiting</b>: blocked on an event (such as I/O), waiting voluntarily to synchronize, or suspended by its environment subsystem. (Suspending one Windows thread only stops it being scheduled; its memory stays in place. It is not the swapped-out, process-wide Suspended state of section 4.1.)</li>${/* state: Waiting, and how it differs from the Suspended state of section 4.1 */''}
      <li><b>Transition</b>: ready to run but a resource is missing, typically its kernel stack paged out of memory.</li>${/* state: Transition */''}
      <li><b>Terminated</b>: it ended itself, was ended by another thread, or the process it belongs to ended. After clean-up it is removed, or its object is kept for reuse.</li>${/* state: Terminated */''}
    </ul>${/* ends the list of states */''}
    <p>Legal moves: Ready → Standby → Running; Running → Ready, Waiting or Terminated; Waiting → Ready (resources in memory) or Transition (one is paged out); Transition → Ready once it is back. Example: Ready → Standby → Running → Waiting (disk read) → Transition (stack paged out) → Ready.</p>${/* notes paragraph: the legal moves and an example path through the states */''}

    <h4>7. Support for OS subsystems</h4>${/* notes subheading 7: support for OS subsystems */''}
    <p>Each <b>environment subsystem</b> (Win32 today; older Windows also had POSIX) is responsible for the process and thread features of its own personality. The <b>executive</b> provides generic services to create process and thread objects and returns <b>handles</b>; the subsystem <b>interprets</b> those handles by its own rules. For CreateProcess, the Win32 subsystem has the executive create the process object and, because every Win32 process starts with one thread, its first thread; it then records the process and gives the program handles and IDs. The subsystem names the <b>calling program</b> as parent, so the new process inherits the caller's access token, quota limits, base priority and default processor affinity (not the subsystem server's). For fork, a POSIX subsystem uses the same services but copies the parent's address space and keeps the parent-child link itself: the executive records who created a process but enforces no hierarchy.</p>`,  // notes paragraph: how subsystems use the executive's generic services, for Win32 and POSIX; end of the notes text
});  // ends the section object and the call that registers section 4.4
