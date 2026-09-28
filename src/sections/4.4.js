/* =====================================================================
   4.4  Windows Process and Thread Management
   Chapter 4 (Threads). Original teaching material.
   ===================================================================== */
Guide.section({
  id: '4.4',
  title: 'Windows Process and Thread Management',
  short: 'Windows threads',
  summary: 'How Windows builds apps from processes, threads, jobs and fibers, and the six states a thread moves through.',
  objectives: [
    'Describe what a Windows process and a Windows thread each hold, and name the extra building blocks: job objects, thread pools, fibers and user-mode scheduling.',
    'Explain how Windows 8 and later suspend, terminate and restore background apps, and what app developers must do about it.',
    'Identify the resources of a Windows process (access token, virtual address descriptors, handle table, threads) and sort the attributes of process and thread objects.',
    'Explain why a multithreaded process is an efficient server, and trace a thread through the six Windows thread states.',
    'Explain how environment subsystems build their own process features on top of the executive\'s generic services.',
  ],
  terms: [
    ['Job object', 'A Windows kernel object that groups several processes so they can be managed as one unit: one set of limits (such as total memory or processor time), one set of accounting totals, and one call to end them all.'],
    ['Thread pool', 'A set of worker threads that the system keeps ready. The application hands it small pieces of work (callbacks) and an idle worker runs each one, so the program does not create a thread per task.'],
    ['Fiber', 'A unit of execution that the application itself schedules by explicitly switching from one fiber to another. Fibers run inside an ordinary thread, and the kernel does not know they exist.'],
    ['User-mode scheduling (UMS)', 'A lightweight Windows mechanism that lets an application run its own scheduler for its own real threads, switching between them in user mode and regaining control whenever one of them blocks in the kernel. Introduced in 64-bit Windows 7; no longer supported starting with Windows 11.'],
    ['Process lifetime management (PLM)', 'The part of Windows 8 and later that decides when a Modern (Store) app runs, is suspended in the background, or is terminated to free memory.'],
    ['Background task', 'A small, separately registered piece of an app that Windows runs on a trigger (a timer, a push message, a network change) with a tight budget of processor time and memory while the app itself stays suspended.'],
    ['Access token', 'The kernel object that records whom a process runs as: the user\'s security identity, groups and privileges. Windows checks it every time the process tries to open a protected object.'],
    ['Virtual address descriptor (VAD)', 'One record in a tree the memory manager keeps for each process, describing a range of the process\'s virtual addresses that is in use (program image, heap, a thread\'s stack, a mapped file) and how it may be accessed.'],
    ['Handle table', 'The per-process table that lists every object the process has opened. Each entry points to one object, and the entry\'s number is the handle the program uses.'],
    ['Handle', 'A small number, private to one process, that stands for an object the process has opened. It indexes the process\'s handle table; programs never get a direct pointer to the object.'],
    ['Working set', 'The pages of a process that are currently in physical memory. Windows lets a process have a minimum and a maximum working-set size.'],
    ['Thread-local storage (TLS)', 'A small amount of storage that belongs to one thread only: one variable name has a separate value in every thread, so each thread can keep private data (such as its own error code) even though all threads share one address space.'],
    ['Processor affinity', 'The set of processors a thread is allowed to run on. A process holds a default set for its threads, and each thread may be limited to part of it.'],
    ['Base priority', 'The starting point of a thread\'s scheduling priority. A process\'s priority class sets the base priority for its threads, and a thread\'s current priority never drops below its own base priority.'],
    ['Dynamic priority', 'A thread\'s scheduling priority at this moment. Windows may raise it temporarily above the base priority (for example after a wait ends) and lets it fall back over time.'],
    ['Quantum', 'The amount of processor time a thread may use before the scheduler checks whether another ready thread of the same priority should get a turn. Also called a time slice.'],
    ['Standby state', 'The Windows thread state of a thread that has been chosen to run next on one particular processor and is waiting for that processor to become free.'],
    ['Transition state', 'The Windows thread state of a thread that is ready to run except that something it needs, typically its kernel stack, has been paged out of memory.'],
    ['Section object', 'A Windows object that represents a block of memory which can be mapped into the address space of one or more processes; it is how two processes share memory.'],
    ['Environment subsystem', 'A user-mode server process together with its DLLs that gives programs one operating-system "personality", meaning one set of API calls. Win32 is the main subsystem in Windows.'],
  ],

  css: `
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width and the page scrolls sideways */
    .sec-4-4 .step-eyebrow { contain: inline-size; }
    .sec-4-4 .hot { cursor: pointer; outline: none; }
    .sec-4-4 .hot .fr { transition: stroke-width .15s, opacity .2s; }
    .sec-4-4 .hot:hover .fr, .sec-4-4 .hot:focus-visible .fr { stroke-width: 3.5; }
    .sec-4-4 .hot.sel .fr { stroke-width: 4; }
    .sec-4-4 .btn.warn { border-color: var(--warn); color: var(--warn); }
    .sec-4-4 .stgrid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
    .sec-4-4 .btn.on { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
  `,

  steps: [
    /* ---------------- 1. Big picture: application → processes → threads ---------------- */
    {
      title: 'An application is a team of processes and threads',
      kind: 'story',
      render(el, ctx) {
        const { h, s } = ctx;
        // every clickable part: [title, explanation, owner, workshop analogy]  owner: 'shared' | 'private' | ''
        const INFO = {
          app: ['Application', 'What the user thinks of as one program. On Windows it can be several processes working together, like this photo studio and the helper process that makes its thumbnails.', '', 'The whole business, which may rent several workshops.'],
          procA: ['Process', 'A running instance of a program plus everything it owns: the eight resources in the tiles and at least one thread. The process itself never runs. Its threads do.', '', 'The rented workshop itself.'],
          vas: ['Virtual address space', 'The private range of memory addresses this process may use. Its code, its data, its heap and every thread\'s stack all live here, and no other process can see into it.', 'shared', 'The floor space inside the workshop walls.'],
          code: ['Executable code', 'The program\'s instructions, loaded from the .exe file and its DLLs into the address space. Every thread of the process runs code from here.', 'shared', 'The instruction manuals on the shelves.'],
          handles: ['Open handles to system objects', 'Files, events, other processes and threads this process has opened. Each one is reached through a small number called a <span class="t">handle</span>, and any thread of the process may use it.', 'shared', 'The ring of keys to storerooms and other buildings.'],
          sec: ['Security context', 'Whom the process acts for: the user account, its groups and its privileges, kept in an <span class="t">access token</span>. Windows checks it whenever the process opens something protected.', 'shared', 'The tenant badge that says whose workshop this is.'],
          pid: ['Unique process ID', 'A number that no other running process has at the same time. Tools and other programs use it to name this process.', 'shared', 'The street number on the door.'],
          env: ['Environment variables', 'Named text settings such as PATH or TEMP that the process receives when it starts, usually copied from the process that created it.', 'shared', 'The notes pinned inside the door saying where things are kept.'],
          prio: ['Priority class', 'A coarse importance level for the whole process (Idle, Below normal, Normal, Above normal, High or Real-time). Every thread\'s priority starts from it.', 'shared', 'How much attention the landlord gives this tenant.'],
          ws: ['Minimum and maximum working-set size', 'The <span class="t">working set</span> is the process\'s pages now in physical memory. These two sizes bound it, and the memory manager uses them to decide whose pages to keep.', 'shared', 'The fewest and most workbenches kept set up at once.'],
          thread: ['Thread', 'The part of a process that can be scheduled onto a processor. Threads share the process\'s address space and resources, and each also keeps the five private items listed. Thread 1, created along with the process, is often called the primary thread.', '', 'One worker.'],
          tid: ['Unique thread ID', 'A number that identifies this one thread. It is separate from the process ID: studio.exe has one process ID and a different thread ID for each of its threads.', 'private', 'The worker\'s own ID badge.'],
          ctx: ['Saved context', 'A copy of the thread\'s registers (instruction pointer, stack pointer and the rest) kept while it is off the processor, so it resumes exactly where it stopped.', 'private', 'The worker\'s notebook: \"I stopped at step 14.\"'],
          tprio: ['Scheduling priority', 'How urgently this particular thread wants a processor. Its <span class="t">base priority</span> comes from the process\'s priority class, and its current value can move up and down for this thread alone.', 'private', 'How urgent this worker\'s current job is.'],
          tls: ['Thread-local storage', '<span class="t" data-t="Thread-local storage (TLS)">Thread-local storage</span> is a set of private per-thread slots: the same variable name holds a different value in each thread, for example the last error code or the request it is serving.', 'private', 'The worker\'s private drawer.'],
          exc: ['Exception handlers', 'Each thread has its own chain of handlers that decide what happens when its code hits trouble, such as a divide by zero or a bad memory address.', 'private', 'The worker\'s own emergency plan.'],
          procB: ['A second process', 'helper.exe belongs to the same application but has its own address space, handles and security context. It cannot simply read studio.exe\'s variables; the two must share memory or send messages through a channel they both set up.', '', 'A second workshop down the street, with its own keys and badge.'],
        };
        const seen = new Set();
        const N = ctx.narrow; // phones: a tall single-column drawing so the text stays readable
        const svg = s('svg', { viewBox: N ? '0 0 340 650' : '0 0 640 332', width: '100%', role: 'img', 'aria-label': 'An application made of two processes; the first process has eight resources and two threads' });
        const hots = {};
        function hot(key, kids) {
          const g = s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': INFO[key][0] }, ...kids);
          g.addEventListener('click', (e) => { e.stopPropagation(); pick(key); });
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(key); } });
          (hots[key] = hots[key] || []).push(g);
          return g;
        }
        const tile = (key, x, y, w, hgt, cls, l1, l2) => hot(key, [
          s('rect', { x, y, width: w, height: hgt, rx: 8, class: 'fr ' + cls, 'stroke-width': 1.6 }),
          s('text', { x: x + w / 2, y: y + (l2 ? 16 : 24), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 650 }, l1),
          l2 ? s('text', { x: x + w / 2, y: y + 31, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 650 }, l2) : null,
        ]);
        const TILES = [['vas', 's-mem', 'Virtual', 'address space'], ['code', 's-mem', 'Executable', 'code'], ['handles', 's-os', 'Open handles', 'to objects'], ['sec', 's-os', 'Security', 'context'],
          ['pid', 's-panel', 'Process ID', ''], ['env', 's-panel', 'Environment', 'variables'], ['prio', 's-cpu', 'Priority', 'class'], ['ws', 's-mem', 'Working-set', 'min / max']];
        const PILLS = [['tid', 'Thread ID'], ['ctx', 'Saved context'], ['tprio', 'Scheduling priority'], ['tls', 'Thread-local storage'], ['exc', 'Exception handlers']];
        const threadBox = (x, y, w, name) => s('g', {},
          hot('thread', [s('rect', { x, y, width: w, height: 152, rx: 10, class: 'fr s-thread', 'stroke-width': 1.8 }),
            s('text', { x: x + 12, y: y + 19, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--thread)' }, name)]),
          ...PILLS.map(([k, lab], i) => hot(k, [
            s('rect', { x: x + 12, y: y + 28 + i * 24, width: w - 24, height: 20, rx: 6, class: 'fr s-panel', 'stroke-width': 1.2 }),
            s('text', { x: x + w / 2, y: y + 43 + i * 24, 'text-anchor': 'middle', 'font-size': 13 }, lab)])));
        // geometry: [appW, appH, procA rect, tile(i) → [x, y, w], thread boxes, procB drawing]
        const G = N
          ? { app: [336, 646], procA: [10, 34, 320, 534], sub: null, tile: (i) => [20 + (i % 2) * 152, 66 + Math.floor(i / 2) * 44, 144], t1: [20, 246, 300], t2: [20, 406, 300] }
          : { app: [636, 328], procA: [12, 34, 474, 288], sub: 472, tile: (i) => [24 + (i % 4) * 115, 66 + Math.floor(i / 4) * 46, 105], t1: [24, 160, 214], t2: [262, 160, 214] };
        const procB = N
          ? hot('procB', [s('rect', { x: 10, y: 578, width: 320, height: 60, rx: 14, class: 'fr s-proc', 'stroke-width': 2 }),
            s('text', { x: 24, y: 603, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--proc)' }, 'Process: helper.exe'),
            s('text', { x: 24, y: 624, 'font-size': 13, class: 's-sub' }, 'its own resources and its own Thread 1')])
          : hot('procB', [s('rect', { x: 496, y: 34, width: 130, height: 288, rx: 14, class: 'fr s-proc', 'stroke-width': 2 }),
            s('text', { x: 561, y: 56, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, style: 'fill:var(--proc)' }, 'Process:'),
            s('text', { x: 561, y: 74, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'helper.exe'),
            s('rect', { x: 508, y: 88, width: 106, height: 58, rx: 8, class: 's-panel', 'stroke-width': 1.2 }),
            s('text', { x: 561, y: 110, 'text-anchor': 'middle', 'font-size': 13 }, 'its own'),
            s('text', { x: 561, y: 128, 'text-anchor': 'middle', 'font-size': 13 }, 'resources'),
            s('rect', { x: 508, y: 160, width: 106, height: 60, rx: 10, class: 's-thread', 'stroke-width': 1.6 }),
            s('text', { x: 561, y: 195, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'Thread 1')]);
        const [ax, ay, aw, ah] = G.procA;
        svg.append(
          hot('app', [s('rect', { x: 2, y: 2, width: G.app[0], height: G.app[1], rx: 16, class: 'fr s-panel', 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }),
            s('text', { x: 16, y: 24, 'font-size': 15, 'font-weight': 800 }, 'Application: Photo studio')]),
          hot('procA', [s('rect', { x: ax, y: ay, width: aw, height: ah, rx: 14, class: 'fr s-proc', 'stroke-width': 2 }),
            s('text', { x: ax + 14, y: 56, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--proc)' }, 'Process: studio.exe'),
            G.sub ? s('text', { x: G.sub, y: 56, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'resources shared by all its threads') : null]),
          ...TILES.map(([k, cls, l1, l2], i) => { const [x, y, w] = G.tile(i); return tile(k, x, y, w, 38, cls, l1, l2); }),
          threadBox(...G.t1, 'Thread 1 (primary)'), threadBox(...G.t2, 'Thread 2'),
          procB,
        );
        const title = h('h3', { class: 'm0' });
        const body = h('p', { class: 'small m0' });
        const own = h('div', { class: 'row' });
        const count = h('span', { class: 'xs muted' });
        const ana = h('p', { class: 'small m0', style: { color: 'var(--os)' } });
        function pick(key) {
          seen.add(key);
          Object.values(hots).flat().forEach((g) => g.classList.remove('sel'));
          (hots[key] || []).forEach((g) => g.classList.add('sel'));
          const [t, d, o, a] = INFO[key];
          title.textContent = t; body.innerHTML = d; ana.innerHTML = '<b>In the workshop:</b> ' + a;
          own.innerHTML = o === 'shared' ? '<span class="chip proc">Belongs to the process: shared by every thread</span>' : o === 'private' ? '<span class="chip thread">Private: every thread has its own</span>' : '';
          count.textContent = `Parts explored: ${seen.size} of ${Object.keys(INFO).length}`;
        }
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack' },
            h('p', { class: 'lead m0', html: 'Starting a program on Windows builds a small organisation, not just a copy of the code in memory.' }),
            h('p', { class: 'm0', html: 'An <b>application</b> is one or more <span class="t">processes</span>. A process is a running instance of a program together with everything it owns. Inside each process, one or more <span class="t">threads</span> do the running: a thread is what the scheduler actually places on a processor.' }),
            h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A process is a rented workshop: floor space, a tenant badge saying whose it is, keys to the storerooms, a street number. Threads are the workers inside. They share the whole workshop, but each keeps a personal notebook of where they stopped, an emergency plan, a private drawer and an ID badge.' }),
            h('div', { class: 'callout why m0', 'data-label': 'Where this is going', html: 'Next: extra building blocks, paused background apps, a process opened up, a threaded server, six thread states and subsystems.' })),
          h('div', { class: 'card white stack', style: { gap: '8px' } }, svg,
            h('div', { class: 'card tight stack', style: { gap: '5px', minHeight: '124px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, title, count), body, ana, own),
            h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'xs muted' }, 'Click any part.'), h('span', { class: 'chip proc' }, 'teal box: shared by all its threads'), h('span', { class: 'chip thread' }, 'pink: private to one thread')))));
        pick('procA');
        seen.clear(); seen.add('procA');
        count.textContent = `Parts explored: 1 of ${Object.keys(INFO).length}`;
      },
    },
    /* ---------------- 2. Jobs, thread pools, fibers, UMS: a matcher ---------------- */
    {
      title: 'Four more building blocks: jobs, pools, fibers, UMS',
      kind: 'lab',
      render(el, ctx) {
        const { h } = ctx;
        const TOOLS = [
          { name: 'Job object', chip: 'Groups processes', cls: 'proc', t: 'Job object',
            text: 'Put several processes in one job and manage them as a unit: set limits once (total memory, processor time, number of processes), read shared accounting totals, and end them all with one call.',
            notFor: 'A job object groups <b>processes</b> and puts limits on them; it does not decide which code runs next inside a program.' },
          { name: 'Thread pool', chip: 'Kernel schedules the workers', cls: 'thread', t: 'Thread pool',
            text: 'The application queues small pieces of work as callbacks; worker threads that the system keeps ready pick them up. No thread per task, and the pool grows or shrinks for you.',
            notFor: 'A thread pool runs short <b>callbacks</b> on workers the system manages; the program gives up control over which worker runs when.' },
          { name: 'Fiber', chip: 'App switches, kernel unaware', cls: 'warn', t: 'Fiber',
            text: 'One thread hosts several fibers and switches between them by explicit calls. A fiber borrows its host thread\'s identity (its ID, its thread-local storage). The kernel sees only the thread, so one blocking fiber stalls them all.',
            notFor: 'A fiber is switched <b>by hand inside one thread</b>; the kernel never sees it, and it has no context of its own at the kernel level.' },
          { name: 'User-mode scheduling (UMS)', chip: 'App schedules real threads', cls: 'cpu', t: 'User-mode scheduling (UMS)',
            text: 'Introduced in 64-bit Windows 7, no longer supported from Windows 11. The app runs its own scheduler for its own real threads, switching in user mode (cheap for short work). Each keeps its own context; if one blocks in the kernel, the scheduler gets control back.',
            notFor: 'UMS lets an application schedule <b>its own real threads</b> in user mode; it is not a way to group processes or queue callbacks.' },
        ];
        const SC = [
          [0, 'A build tool starts a compiler, a linker and dozens of helper processes. Together they must never use more than 4 GB, and cancelling the build must stop every one of them at once.', 'Several processes managed as one unit, with one shared memory limit and one "terminate all" call: exactly what a job object is for.'],
          [1, 'A web service receives thousands of tiny requests per second. Creating a brand-new thread for each would waste time, so it hands each request to workers that the system keeps ready.', 'Short, independent pieces of work run as callbacks on ready-made worker threads: a thread pool.'],
          [2, 'A program ported from another system is built from tasks that hand control to each other at points the programmer chooses. Its authors want to keep that manual switching, all inside one ordinary thread.', 'Manual, explicit switching between units of execution that live inside one thread is the definition of fibers.'],
          [3, 'A database engine runs many real threads and wants its own code to pick which one runs next, switching without the system scheduler, while every thread keeps its own context and may make normal blocking system calls.', 'An application scheduling its own real threads in user mode, each with its own context: user-mode scheduling.'],
          [1, 'A program needs one callback every second from a timer and another whenever a file read finishes, and it does not want to create or manage any threads itself.', 'Timer and I/O-completion callbacks run on the system-managed workers of a thread pool; the program creates no threads.'],
          [0, 'An administrator wants every process launched by a batch script to share one processor-time budget, and wants one total of how much processor time the whole group used.', 'Shared limits and shared accounting for a group of processes come from a job object.'],
          [3, 'An application\'s scheduler must get the processor back the moment one of its threads blocks inside the kernel, so that it can immediately run another of its threads.', 'Regaining control when one of your own threads blocks in the kernel is a defining feature of UMS. With fibers, a blocking call would stall the whole host thread instead. (UMS existed on 64-bit Windows 7 to 10; Windows 11 dropped it.)'],
          [2, 'A game engine keeps hundreds of small tasks as separately saved execution states inside one worker thread and resumes them one after another by explicit calls, with no help from the kernel.', 'Units of execution that one thread resumes by explicit calls, invisible to the kernel: fibers.'],
        ];
        let i = 0, tries = 0, first = 0, done = false;
        const cards = TOOLS.map((tl) => h('div', { class: 'card tight stack', style: { gap: '3px', borderLeft: `5px solid var(--${tl.cls})` } },
          h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } }, h('b', { html: `<span class="t" data-t="${tl.t}">${tl.name}</span>` }), h('span', { class: 'chip ' + tl.cls }, tl.chip)),
          h('p', { class: 'small m0', style: { lineHeight: '1.38' } }, tl.text)));
        const counter = h('span', { class: 'chip accent' });
        const scoreEl = h('span', { class: 'xs muted' });
        const scen = h('div', { class: 'card white', style: { fontSize: '17.5px', lineHeight: '1.45', minHeight: '132px' } });
        const fb = h('div', { class: 'callout m0', style: { minHeight: '96px' } });
        const btns = TOOLS.map((tl, k) => h('button', { class: 'btn ' + tl.cls, type: 'button', onclick: () => choose(k) }, tl.name));
        const bNext = h('button', { class: 'btn primary', type: 'button', onclick: () => next() }, 'Next scenario');
        function paint() {
          counter.textContent = done ? 'All 8 scenarios done' : `Scenario ${i + 1} of ${SC.length}`;
          scoreEl.textContent = `Right on the first try: ${first}`;
        }
        function load() {
          tries = 0;
          scen.innerHTML = SC[i][1];
          fb.className = 'callout m0'; fb.removeAttribute('data-label');
          fb.innerHTML = '<span class="muted">Which building block fits this situation? Pick one of the four buttons.</span>';
          btns.forEach((b) => { b.disabled = false; b.classList.remove('on'); });
          cards.forEach((c) => c.classList.remove('flash'));
          bNext.disabled = true; paint();
        }
        function choose(k) {
          const [ans, , why] = SC[i];
          tries++;
          cards[k].classList.remove('flash'); void cards[k].offsetWidth; cards[k].classList.add('flash');
          if (k === ans) {
            if (tries === 1) first++;
            fb.className = 'callout tip m0'; fb.setAttribute('data-label', tries === 1 ? 'Right, first try' : 'Right');
            fb.innerHTML = why;
            btns.forEach((b, j) => { b.disabled = j !== k; b.classList.toggle('on', j === k); });
            bNext.disabled = false;
            if (i === SC.length - 1) { done = true; bNext.textContent = 'Start again'; }
          } else {
            fb.className = 'callout warn m0'; fb.setAttribute('data-label', 'Not this one');
            fb.innerHTML = TOOLS[k].notFor + ' Read the scenario again: what is being grouped, queued or switched?';
            btns[k].disabled = true;
          }
          paint();
        }
        function next() {
          if (done) { i = 0; first = 0; done = false; bNext.textContent = 'Next scenario'; }
          else i = Math.min(i + 1, SC.length - 1);
          load();
        }
        el.append(h('div', { class: 'split fill' },
          h('div', { class: 'stack', style: { gap: '8px' } },
            h('p', { class: 'm0 small', html: 'Processes and threads are the core. Windows adds four tools around them, and each answers a different question: <b>who is grouped</b>, and <b>who decides what runs next</b>?' }),
            ...cards),
          h('div', { class: 'stack' },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Which tool would you reach for?'), counter),
            scen,
            h('div', { class: 'grid-2', style: { gap: '8px' } }, ...btns),
            fb,
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, scoreEl, bNext),
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Mixing up fibers and UMS. In both, the application decides what runs next. A fiber lives <b>inside one thread</b> and the kernel never sees it; UMS threads are <b>real kernel threads</b>, each with its own context.' }))));
        load();
      },
    },
    /* ---------------- 3. Windows 8+ app lifecycle ---------------- */
    {
      title: 'Windows 8 and later: background apps are paused',
      kind: 'explore',
      render(el, ctx) {
        const { h } = ctx;
        const CAP = 1000; // MB of memory available to apps in this demo
        const APPS = [
          { id: 'notes', name: 'Notes', mem: 300, init: () => ({ words: 0 }), work: 'Type a sentence', doWork: (st) => { st.words += 8; }, show: (st) => `draft of ${st.words} words` },
          { id: 'mail', name: 'Mail', mem: 200, init: () => ({ unread: 3 }), work: 'Read a message', doWork: (st) => { if (st.unread > 0) st.unread--; }, show: (st) => `${st.unread} unread` },
          { id: 'photos', name: 'Photos', mem: 600, init: () => ({ photo: 1 }), work: 'Next photo', doWork: (st) => { st.photo = (st.photo % 40) + 1; }, show: (st) => `photo ${st.photo} of 40` },
        ];
        const byId = Object.fromEntries(APPS.map((a) => [a.id, a]));
        let S, fg, saveOn = true, clock = 0;
        const clone = (o) => Object.assign({}, o);
        const used = () => APPS.reduce((n, a) => n + (S[a.id].status === 'running' || S[a.id].status === 'suspended' ? a.mem : 0), 0);
        const note = h('div', { class: 'callout m0 small', style: { minHeight: '118px' } });
        const bar = h('div', { style: { display: 'flex', height: '14px', borderRadius: '99px', overflow: 'hidden', background: 'var(--panel-3)' } });
        const memTxt = h('span', { class: 'small b' });
        const tiles = h('div', { class: 'grid-3', style: { gap: '8px' } });
        const openBtns = APPS.map((a) => h('button', { class: 'btn sm proc', type: 'button', onclick: () => act(() => open(a.id)) }, 'Open ' + a.name));
        const bHome = h('button', { class: 'btn sm', type: 'button', onclick: () => act(() => home()) }, 'Go to Start screen');
        const bWork = h('button', { class: 'btn sm', type: 'button', onclick: () => act(() => work()) });
        const bMail = h('button', { class: 'btn sm io', type: 'button', onclick: () => act(() => newMail()) }, 'New mail arrives');
        const bLow = h('button', { class: 'btn sm intr', type: 'button', onclick: () => act(() => lowMem()) }, 'Memory runs low');
        const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { reset(); } }, 'Reset');
        const seg = ctx.ui.seg([{ value: true, label: 'App saves state on suspend' }, { value: false, label: 'App saves nothing' }], true, (v) => { saveOn = v; reset(); paint(); say([`The demo restarts. Now the apps ${v ? '<b>save</b> their app state data whenever they are suspended, as a well-written Modern app must.' : 'save <b>nothing</b> when suspended. Repeat the same steps and watch what happens to the user\'s work when an app is terminated.'}`], v ? 'tip' : 'warn'); });
        function reset() {
          S = {}; APPS.forEach((a) => { S[a.id] = { status: 'closed', live: null, saved: null, at: 0, pending: 0 }; });
          fg = null; clock = 0;
          say(['Nothing is running yet. Open Notes and type a few sentences, then open the other apps. Keep an eye on the memory bar and on each app\'s <b>saved state data</b>.'], '');
        }
        function say(msgs, kind) { note.className = 'callout m0 small' + (kind ? ' ' + kind : ''); note.innerHTML = msgs.join(' '); }
        function act(fn) { const r = fn(); say(r[0], r[1]); paint(); }
        function suspend(id, msgs) {
          const a = S[id];
          a.status = 'suspended'; a.at = ++clock;
          if (saveOn) a.saved = clone(a.live);
          msgs.push(`<b>${byId[id].name}</b> leaves the foreground, and a few seconds later PLM <b>suspends</b> it: its threads get no processor time, but its memory is kept. ${saveOn ? `It saved its app state data (${byId[id].show(a.live)}).` : 'It saved nothing.'}`);
        }
        function terminate(id, msgs, why) {
          const a = S[id];
          a.status = 'terminated'; a.live = null;
          msgs.push(`${why}, so PLM <b>terminates</b> a suspended app: here ${byId[id].name}, the one suspended longest. It gets <b>no warning</b>. ${a.saved ? `Its saved state (${byId[id].show(a.saved)}) is safe on disk.` : 'It never saved its state, so everything it held in memory is gone.'}`);
        }
        function open(id) {
          const msgs = []; let kind = '';
          if (fg === id) return [[`${byId[id].name} is already in the foreground.`], ''];
          if (fg) suspend(fg, msgs);
          const a = S[id], A = byId[id];
          if (a.status === 'suspended') {
            a.status = 'running';
            msgs.push(`<b>${A.name} resumes instantly.</b> It was only suspended, so its memory and its state (${A.show(a.live)}) were still there.`);
            kind = 'tip';
          } else {
            while (used() + A.mem > CAP) {
              const victims = APPS.filter((x) => S[x.id].status === 'suspended').sort((p, q) => S[p.id].at - S[q.id].at);
              if (!victims.length) break;
              terminate(victims[0].id, msgs, `${A.name} needs ${A.mem} MB and memory is short`);
            }
            const was = a.status;
            a.live = a.saved ? clone(a.saved) : A.init();
            a.status = 'running';
            if (was === 'terminated') {
              if (a.saved) { msgs.push(`<b>${A.name} is relaunched</b> and restores its saved app state: ${A.show(a.live)}. To the user it looks as if it never left.`); kind = 'tip'; }
              else { msgs.push(`<b>${A.name} is relaunched</b>, but it saved nothing, so it starts from scratch (${A.show(a.live)}). Whatever the user did in it is lost.`); kind = 'bad'; }
            } else msgs.push(`<b>${A.name} launches</b> and becomes the foreground app (${A.show(a.live)}).`);
          }
          if (id === 'mail' && a.pending) { a.live.unread += a.pending; msgs.push(`It picks up the ${a.pending} message${a.pending > 1 ? 's' : ''} its background task noticed.`); a.pending = 0; }
          fg = id;
          return [msgs, kind];
        }
        function home() {
          if (!fg) return [['You are already on the Start screen, so no app is in the foreground.'], ''];
          const msgs = []; suspend(fg, msgs); fg = null;
          return [msgs, ''];
        }
        function work() {
          if (!fg) return [['No app is in the foreground. Open one first: only the foreground app can do work.'], 'warn'];
          const A = byId[fg]; A.doWork(S[fg].live);
          return [[`The user works in ${A.name}: now ${A.show(S[fg].live)}. This lives in the app\'s memory until it saves.`], ''];
        }
        function newMail() {
          const a = S.mail;
          if (fg === 'mail') { a.live.unread++; return [['Mail is in the foreground, so it shows the new message itself.'], '']; }
          a.pending++;
          return [[`Mail is not active, but its registered <b>background task</b> runs for a moment with a small budget of processor time and memory and updates Mail's tile (+${a.pending}). The app itself ${a.status === 'suspended' ? 'stays suspended: its own threads still get no processor time' : 'is still not running'}.`], ''];
        }
        function lowMem() {
          const victims = APPS.filter((x) => S[x.id].status === 'suspended').sort((p, q) => S[p.id].at - S[q.id].at);
          if (!victims.length) return [['There is no suspended app to end. PLM reclaims memory from suspended apps; it does not end the app you are using.'], 'warn'];
          const msgs = []; terminate(victims[0].id, msgs, 'Another program needs memory');
          return [msgs, S[victims[0].id].saved ? '' : 'bad'];
        }
        const LABEL = { closed: ['Not running', ''], running: ['Foreground', 'ok'], suspended: ['Suspended', 'warn'], terminated: ['Terminated', 'bad'] };
        function paint() {
          tiles.replaceChildren(...APPS.map((A) => {
            const a = S[A.id]; const [lab, cls] = LABEL[a.status];
            const inMem = a.status === 'running' || a.status === 'suspended';
            return h('div', { class: 'card tight stack', style: { gap: '4px', borderTop: `4px solid var(--${cls || 'line-2'})`, background: a.status === 'running' ? 'var(--panel)' : 'var(--panel-2)' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } }, h('b', {}, A.name), h('span', { class: 'chip ' + cls }, lab)),
              h('div', { class: 'xs muted' }, 'In memory now'),
              h('div', { class: 'small b', style: { minHeight: '21px' } }, inMem ? A.show(a.live) : '—'),
              h('div', { class: 'xs muted' }, 'Saved app state data'),
              h('div', { class: 'small', style: { minHeight: '21px' } }, a.saved ? A.show(a.saved) : 'none'),
              h('div', { class: 'xs muted' }, `Memory: ${inMem ? A.mem : 0} MB${A.id === 'mail' && a.pending ? ` · tile: +${a.pending} new` : ''}`));
          }));
          bar.replaceChildren(...APPS.filter((A) => ['running', 'suspended'].includes(S[A.id].status)).map((A) =>
            h('div', { title: A.name, style: { width: (A.mem / CAP) * 100 + '%', background: S[A.id].status === 'running' ? 'var(--ok)' : 'var(--warn)', borderRight: '2px solid var(--panel)' } })));
          memTxt.textContent = `Memory used by apps: ${used()} of ${CAP} MB`;
          bWork.textContent = fg ? byId[fg].work + ' (' + byId[fg].name + ')' : 'Do some work';
          bWork.disabled = !fg;
          openBtns.forEach((b, k) => b.classList.toggle('on', fg === APPS[k].id));
        }
        reset(); paint();
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack', style: { gap: '9px' } },
            h('p', { class: 'm0', html: 'Classic desktop programs keep running when you switch away. The <b>Modern</b> (Store) apps introduced with Windows 8 follow stricter rules, run by <span class="t">process lifetime management (PLM)</span>:' }),
            h('ul', { class: 'small m0', style: { lineHeight: '1.4' }, html:
              '<li><b>Foreground:</b> only the app the user is looking at is active.</li>' +
              '<li><b>Suspended:</b> a few seconds after you switch away, its threads get no more processor time. Its memory stays, so returning is instant.</li>' +
              '<li><b>Terminated:</b> if memory runs low, Windows may end a suspended app without warning.</li>' +
              '<li><b>Developer\'s job:</b> save <i>app state data</i> on suspension and restore it on relaunch.</li>' +
              '<li><b>Background work:</b> a registered <span class="t">background task</span> may run on a trigger, with limited processor time and memory.</li>' }),
            h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Tablets and laptops have little memory and a battery. An app you cannot see should use neither, yet must come back exactly as the user left it.' }),
            h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'Open Notes and type twice. Open Mail, then Photos: which app is terminated, and why? Reopen Notes. Then choose <i>App saves nothing</i> and repeat.' })),
          h('div', { class: 'stack', style: { gap: '11px' } },
            h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, memTxt, h('span', { class: 'xs muted', html: '<span style="color:var(--ok)">■</span> running &nbsp;<span style="color:var(--warn)">■</span> suspended' })), bar),
            tiles,
            h('div', { class: 'row', style: { gap: '6px' } }, ...openBtns, bHome),
            h('div', { class: 'row', style: { gap: '6px' } }, bWork, bMail, bLow, bReset),
            seg, note)));
      },
    },
    /* ---------------- 4. Inside a Windows process: explorer + attribute sort ---------------- */
    {
      title: 'Inside a process: token, address map, handle table',
      kind: 'explore',
      core: true,
      render(el, ctx) {
        const { h, s } = ctx;
        // attribute explanations shared by the inspector and the sorting game
        const PATTR = [
          ['Process ID', 'A unique number that names this process while it exists.'],
          ['Security descriptor', 'Who owns the process object and who else may open it, for example to read its memory, debug it or end it.'],
          ['Base priority', 'The starting priority for this process\'s threads, set by its priority class.'],
          ['Default processor affinity', 'The processors this process\'s threads may run on unless a thread is limited further.'],
          ['Quota limits', 'The most system memory, paging-file space and processor time this process may consume.'],
          ['Execution time', 'Total processor time used so far by all of this process\'s threads added together.'],
          ['I/O counters', 'How many read, write and other I/O operations the process\'s threads have performed.'],
          ['VM operation counters', 'How many virtual-memory operations (reserve, commit, map, free) the process has performed.'],
          ['Exception/debugging ports', 'Message channels the process manager uses to tell the environment subsystem or a debugger that a thread of this process raised an exception.'],
          ['Exit status', 'Why the process ended; empty while it runs. When the process ends, its object becomes signaled, so any thread waiting on the process wakes up.'],
        ];
        const TATTR = [
          ['Thread ID', 'A unique number for this thread; it identifies the thread, for example when it calls a server.'],
          ['Thread context', 'The saved register values (instruction pointer, stack pointer and the rest) that let the thread resume exactly where it stopped.'],
          ['Dynamic priority', 'The thread\'s priority right now. Windows may boost it above the base, for example just after a wait ends, and it then decays back.'],
          ['Base priority', 'The lowest value this thread\'s dynamic priority may fall to.'],
          ['Thread processor affinity', 'The processors this thread may run on: all or part of its process\'s default set.'],
          ['Thread execution time', 'Processor time this thread has used, counted separately for user mode and kernel mode.'],
          ['Alert status', 'Whether this thread, while waiting, may be interrupted to run an asynchronous procedure call.'],
          ['Suspension count', 'How many times the thread has been suspended without a matching resume. It may run only when the count is 0.'],
          ['Impersonation token', 'A temporary access token that lets the thread act on behalf of another user, as a server thread does for a client.'],
          ['Termination port', 'A message channel the process manager uses to report that this thread has ended, typically to its subsystem.'],
          ['Thread exit status', 'Why the thread ended; empty while it runs. A thread object is also signaled when its thread ends, so another thread can wait for it to finish.'],
        ];

        /* ---------- tab 1: build and inspect a live process ---------- */
        function tabExplore(panel) {
          const START = 'A Windows process is four things: an <span class="t">access token</span> (whom it acts for), <span class="t" data-t="Virtual address descriptor (VAD)">VADs</span> (one record per range of its address space in use), a <span class="t">handle table</span> (the objects it has opened) and its threads. Press a button to make <b>editor.exe</b> act; click the process or a thread to inspect its object.';
          let P, sel, note = ['', START];
          const hx = (n, w = 2) => '0x' + n.toString(16).toUpperCase().padStart(w, '0');
          // a new handle takes the lowest free table entry (entries are 4 apart); a freed entry is reused
          const addH = (x) => { const used = new Set(P.handles.map((y) => y.hv)); let v = 4; while (used.has(v)) v += 4; P.handles.push(Object.assign({ hv: v }, x)); return v; };
          function reset() {
            P = { threads: [{ n: 1, tid: 4816, u: 0, k: 1, dyn: 8, susp: 0, ip: 0x401A30, sp: 0x19FF40, aff: 'CPUs 0–3' }],
              handles: [{ hv: 4, kind: 'dir', label: 'Folder C:\\docs', obj: 'File object · C:\\docs (folder)', cls: 's-io' }],
              vads: ['image: editor.exe', 'heap', 'stack: T1'], io: { read: 0 }, vm: 3, fileOpen: false, section: false, view: false, priv: 0 };
            sel = 'P';
          }
          reset();
          const N = ctx.narrow; // phones: drop the objects column so the text stays readable
          const svg = s('svg', { viewBox: N ? '0 0 412 300' : '0 0 660 300', width: '100%', style: 'flex:none' });
          const insp = h('div', { class: 'stack', style: { gap: '6px' } });
          const noteEl = h('div', { class: 'callout m0 small', style: { minHeight: '64px' } });
          const actor = () => { const t = P.threads.find((x) => x.n === sel && x.susp === 0) || P.threads.find((x) => x.susp === 0); return t || null; };
          function tick(t, u, k) { P.threads.forEach((x) => { x.dyn = Math.max(8, x.dyn - 1); }); t.u += u; t.k += k; t.ip += 0x40 + 0x10 * (u + k); t.sp -= 0x20; }
          function run(fn) {
            const t = actor();
            if (!t) { note = ['warn', 'Every thread is suspended, so nothing in this process can run. Resume a thread first.']; return paint(); }
            note = fn(t); paint();
          }
          const ACTS = [
            ['New thread', 'thread', () => run((t) => {
              if (P.threads.length >= 4) return ['warn', 'This demo stops at four threads, but a real process may create many more.'];
              const n = P.threads.length + 1; tick(t, 0, 2);
              P.threads.push({ n, tid: 4812 + 4 * n, u: 0, k: 0, dyn: 8, susp: 0, ip: 0x402200 + n * 0x100, sp: 0x19FF40 + (n - 1) * 0x100000, aff: n === 3 ? 'CPUs 2–3' : 'CPUs 0–3' });
              P.vads.push('stack: T' + n); P.vm++;
              const hv = addH({ kind: 'thread', label: 'Thread T' + n, obj: 'Thread object · T' + n, cls: 's-thread' });
              return ['ok', `T${t.n} asks the executive for a new thread. The executive builds <b>thread object T${n}</b> (thread ID ${4812 + 4 * n}), the memory manager adds a <b>VAD</b> for its stack, and the handle table gets handle <code>${hx(hv)}</code>.${n === 2 ? ' (T1 has no handle here: the handle to it went to whichever process started editor.exe.)' : n === 3 ? ' T3 is limited to CPUs 2–3: its <span class="t">processor affinity</span> is part of the process\'s default set.' : ''}`];
            })],
            ['Open report.docx', 'io', () => run((t) => {
              if (P.fileOpen) return ['warn', 'report.docx is already open; opening it again would simply add a second handle to the same file.'];
              tick(t, 0, 1); P.fileOpen = true;
              const hv = addH({ kind: 'file', label: 'File report.docx', obj: 'File object · report.docx', cls: 's-io' });
              return ['ok', `The file allows group <b>Staff</b>, and the <span class="t">access token</span> says user ana is in Staff, so the open succeeds: a new file object, reached through handle <code>${hx(hv)}</code>. Nothing has been read yet, so the I/O counters do not change.`];
            })],
            ['Read the file', 'io', () => run((t) => {
              if (!P.fileOpen) return ['warn', 'There is no open file to read. Open report.docx first.'];
              tick(t, 3, 1); P.io.read++; t.dyn = 9;
              return ['ok', `T${t.n} reads through its file handle, waits for the disk, then runs again. The read count goes up, and Windows gives T${t.n} a small <b>priority boost</b> (<span class="t">dynamic priority</span> 9, one above its base of 8) because its wait just ended.`];
            })],
            ['Allocate memory', 'mem', () => run((t) => {
              if (P.priv >= 1) return ['warn', 'Enough for this demo: a private data region already exists. A real process may allocate many more.'];
              tick(t, 1, 1); P.priv++; P.vm++; P.vads.push('private data');
              return ['ok', 'The process cannot edit its own address map directly. It asks the <b>memory manager</b>, which adds a new <b>VAD</b> describing the range. The VM operation counter goes up.'];
            })],
            ['Map shared memory', 'mem', () => run((t) => {
              if (P.section) return ['warn', 'The process already holds a handle to the shared section, and its view is mapped.'];
              tick(t, 0, 2); P.section = true;
              const hv = addH({ kind: 'section', label: 'Section shmem', obj: 'Section object · shmem', cls: 's-mem' });
              if (P.view) { return ['ok', `The process opens the section again (handle <code>${hx(hv)}</code>). Its view is still mapped from before, so no new VAD is needed.`]; }
              P.view = true; P.vm++; P.vads.push('view: shmem');
              return ['ok', `The process opens a <span class="t">section object</span> (handle <code>${hx(hv)}</code>) and maps a view of it, which adds a VAD. Another process can map the same section: this is how two processes share memory.`];
            })],
            ['Open payroll.xlsx', 'intr', () => run((t) => {
              tick(t, 0, 1);
              return ['bad', '<b>Access denied.</b> payroll.xlsx only allows group <b>HR</b>. The access token lists Users and Staff, not HR, so no handle is created. The token decides what this process may touch.'];
            })],
            ['Close newest handle', '', () => run((t) => {
              if (P.handles.length <= 1) return ['warn', 'Only the handle to the current folder is left. Every process keeps one, so this demo keeps it too.'];
              const x = P.handles.pop(); tick(t, 0, 1);
              if (x.kind === 'file') P.fileOpen = false;
              if (x.kind === 'section') { P.section = false; return ['ok', `Handle <code>${hx(x.hv)}</code> is closed. The mapped view (its VAD) stays until it is unmapped, and it keeps the section alive.`]; }
              if (x.kind === 'thread') return ['ok', `Handle <code>${hx(x.hv)}</code> is closed, but <b>${x.label.slice(7)} keeps running</b>: closing a handle only drops this process's way of referring to the thread object.`];
              return ['ok', `Handle <code>${hx(x.hv)}</code> is closed and report.docx is no longer open in this process.`];
            })],
            ['Suspend thread', '', () => { const t = P.threads.find((x) => x.n === sel); if (!t) { note = ['warn', 'Select a thread first (T1, T2...) in the inspector or the diagram.']; return paint(); } t.susp++; note = ['warn', `T${t.n}'s <b>suspension count</b> is now ${t.susp}. It cannot run until the count is back to 0.`]; paint(); }],
            ['Resume thread', '', () => { const t = P.threads.find((x) => x.n === sel); if (!t) { note = ['warn', 'Select a thread first (T1, T2...) in the inspector or the diagram.']; return paint(); } if (!t.susp) { note = ['warn', `T${t.n} is not suspended; its suspension count is already 0.`]; return paint(); } t.susp--; note = [t.susp ? 'warn' : 'ok', `One resume lowers T${t.n}'s suspension count to ${t.susp}. ${t.susp ? 'It still cannot run.' : 'It may run again.'}`]; paint(); }],
          ];
          const btns = ACTS.map(([lab, cls, fn]) => h('button', { class: 'btn sm ' + cls, type: 'button', onclick: fn }, lab));
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { reset(); note = ['', 'Back to a freshly started editor.exe.']; paint(); } }, 'Reset');
          function selTarget(v) { sel = v; paint(); }
          function paint() {
            const kids = [];
            const hotG = (target, children) => { const g = s('g', { class: 'hot' + (sel === target ? ' sel' : ''), tabindex: 0, role: 'button' }, ...children); g.addEventListener('click', () => selTarget(target)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selTarget(target); } }); return g; };
            kids.push(hotG('P', [s('rect', { x: 4, y: 4, width: 404, height: 292, rx: 14, class: 'fr s-proc', 'stroke-width': 2 }),
              s('text', { x: 16, y: 25, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'Process object · editor.exe · PID 4812')]));
            kids.push(s('rect', { x: 16, y: 36, width: 190, height: 66, rx: 9, class: 's-os', 'stroke-width': 1.5 }),
              s('text', { x: 26, y: 55, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }, 'Access token'),
              s('text', { x: 26, y: 73, 'font-size': 13 }, 'user: ana'),
              s('text', { x: 26, y: 91, 'font-size': 13 }, 'groups: Users, Staff'));
            kids.push(s('rect', { x: 16, y: 110, width: 190, height: 178, rx: 9, class: 's-mem', 'stroke-width': 1.5 }),
              s('text', { x: 24, y: 129, 'font-size': 13, 'font-weight': 700, 'letter-spacing': '-0.2', style: 'fill:var(--mem)' }, 'Virtual address descriptors'));
            P.vads.forEach((v, i) => kids.push(s('rect', { x: 26, y: 137 + i * 19, width: 170, height: 16, rx: 4, class: 's-panel', 'stroke-width': 1 }),
              s('text', { x: 32, y: 149.5 + i * 19, 'font-size': 13 }, v)));
            kids.push(s('rect', { x: 214, y: 36, width: 184, height: 190, rx: 9, class: 's-os', 'stroke-width': 1.5 }),
              s('text', { x: 224, y: 55, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }, 'Handle table'),
              N ? null : s('text', { x: 432, y: 25, 'font-size': 13, 'font-weight': 800 }, 'Objects the handles point to'));
            P.handles.forEach((x, i) => {
              const y = 63 + i * 21;
              kids.push(s('rect', { x: 222, y, width: 168, height: 18, rx: 4, class: 's-panel', 'stroke-width': 1 }),
                s('text', { x: 228, y: y + 13.5, 'font-size': 13, class: 's-monot', style: 'fill:var(--os)' }, hx(x.hv)),
                s('text', { x: 266, y: y + 13.5, 'font-size': 13 }, x.label));
              if (!N) kids.push(s('line', { x1: 390, y1: y + 9, x2: 436, y2: y + 9, class: 's-line', 'stroke-width': 1.5, 'marker-end': 'url(#arr)' }),
                s('rect', { x: 440, y, width: 214, height: 18, rx: 4, class: x.cls, 'stroke-width': 1.2 }),
                s('text', { x: 447, y: y + 13.5, 'font-size': 13 }, x.obj));
            });
            kids.push(s('rect', { x: 214, y: 234, width: 184, height: 54, rx: 9, class: 's-panel', 'stroke-width': 1.5 }),
              s('text', { x: 224, y: 249, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--thread)' }, 'Threads'));
            P.threads.forEach((t, i) => kids.push(hotG(t.n, [s('rect', { x: 222 + i * 43, y: 255, width: 38, height: 27, rx: 7, class: 'fr ' + (t.susp ? 's-warn' : 's-thread'), 'stroke-width': 1.6 }),
              s('text', { x: 241 + i * 43, y: 273, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, 'T' + t.n)])));
            if (!N) kids.push(s('text', { x: 440, y: 250, 'font-size': 13, class: 's-sub' }, 'Objects live in system memory,'),
              s('text', { x: 440, y: 267, 'font-size': 13, class: 's-sub' }, 'outside the process itself.'),
              s('text', { x: 440, y: 284, 'font-size': 13, class: 's-sub' }, `${P.handles.length} handle${P.handles.length > 1 ? 's' : ''} in use.`));
            svg.replaceChildren(...kids.filter(Boolean));
            noteEl.className = 'callout m0 small' + (note[0] ? ' ' + note[0] : '');
            noteEl.innerHTML = note[1];
            paintInspector();
          }
          function paintInspector() {
            const opts = [{ value: 'P', label: 'Process' }].concat(P.threads.map((t) => ({ value: t.n, label: 'T' + t.n })));
            const seg = ctx.ui.seg(opts, sel, (v) => selTarget(v));
            const why = h('div', { class: 'card tight small', style: { minHeight: '68px' } }, h('span', { class: 'muted' }, 'Click any row to see what that attribute means.'));
            let rows;
            if (sel === 'P') {
              const ms = P.threads.reduce((a, t) => a + t.u + t.k, 0);
              rows = [4812, 'owner ana; admins full access', '8 (Normal class)', 'CPUs 0–3', '64 MB pool, 2 GB page file', ms + ' ms (all threads)', `${P.io.read} read${P.io.read === 1 ? '' : 's'}, 0 writes, 0 other`, P.vm + ' operations', 'to Win32 subsystem; no debugger', '— (still running)'].map((v, i) => [PATTR[i][0], v, PATTR[i][1]]);
            } else {
              const t = P.threads.find((x) => x.n === sel);
              rows = [t.tid, `IP ${hx(t.ip, 6)}, SP ${hx(t.sp, 6)}`, t.dyn + (t.dyn > 8 ? ' (boosted)' : ''), 8, t.aff, `${t.u + t.k} ms (user ${t.u}, kernel ${t.k})`, 'not alertable', t.susp + (t.susp ? ' (cannot run)' : ''), 'none', 'to Win32 subsystem', '— (still running)'].map((v, i) => [TATTR[i][0], v, TATTR[i][1]]);
            }
            const tbody = h('tbody', {}, ...rows.map(([k, v, d]) => h('tr', { style: { cursor: 'pointer' }, onclick: (e) => { tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('on')); e.currentTarget.classList.add('on'); why.innerHTML = `<b>${k}:</b> ${d}`; } },
              h('td', { class: 'b' }, k), h('td', { class: 'mono', style: { fontSize: '13px' } }, String(v)))));
            insp.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, sel === 'P' ? 'Process object' : `Thread object T${sel}`), seg),
              h('table', { class: 'tbl compact' }, tbody), why);
          }
          paint();
          panel.append(h('div', { class: 'split r fill', style: { gap: '18px' } },
            h('div', { class: 'stack', style: { gap: '8px' } }, svg, h('div', { class: 'row', style: { gap: '5px' } }, ...btns, bReset), noteEl),
            insp));
        }

        /* ---------- tab 2: sort the attributes onto the right object ---------- */
        function tabSort(panel) {
          const BOTH = {
            'ID': 'Both objects carry an ID: the process has a process ID and every thread its own thread ID.',
            'Base priority': 'Both: the process\'s base priority is the starting point for its threads, and each thread has its own base priority as a floor for its dynamic priority.',
            'Execution time': 'Both: each thread counts its own processor time, and the process adds up the time of all its threads.',
            'Exit status': 'Both: a thread records why it ended, and so does the process as a whole.',
          };
          const ITEMS = [].concat(
            ['Security descriptor', 'Default processor affinity', 'Quota limits', 'I/O counters', 'VM operation counters', 'Exception/debugging ports'].map((n) => [n, 0, PATTR.find((a) => a[0] === n)[1]]),
            ['Thread context', 'Dynamic priority', 'Thread processor affinity', 'Alert status', 'Suspension count', 'Impersonation token', 'Termination port'].map((n) => [n, 1, TATTR.find((a) => a[0] === n)[1]]),
            Object.entries(BOTH).map(([n, d]) => [n, 2, d]));
          const BINS = [['Process object only', 'proc'], ['Thread object only', 'thread'], ['Both objects', 'os']];
          let order, placed, held, wrong;
          const pool = h('div', { class: 'row', style: { gap: '7px', minHeight: '82px', alignContent: 'flex-start' } });
          const binEls = BINS.map(([lab, cls], b) => {
            const list = h('div', { class: 'row', style: { gap: '5px', alignContent: 'flex-start' } });
            const head = h('button', { class: 'btn ' + cls, type: 'button', style: { width: '100%' }, onclick: () => drop(b) }, 'Put here: ' + lab);
            return { list, el: h('div', { class: 'card tight stack', style: { gap: '8px', borderTop: `4px solid var(--${cls})` } }, head, list) };
          });
          const fb = h('div', { class: 'callout m0 small', style: { minHeight: '66px' } });
          const score = h('span', { class: 'chip accent' });
          function reset() { order = ctx.util.shuffle(ITEMS.map((_, i) => i)); placed = new Set(); held = null; wrong = 0; say('', 'Click an attribute to pick it up, then click the object it belongs to. Some attributes appear on <b>both</b> objects.'); paint(); }
          function say(kind, html) { fb.className = 'callout m0 small' + (kind ? ' ' + kind : ''); fb.innerHTML = html; }
          function drop(b) {
            if (held == null) { say('warn', 'Pick up an attribute first by clicking it in the pool.'); return; }
            const [name, ans, d] = ITEMS[held];
            if (b === ans) { placed.add(held); say('tip', `<b>${name}</b> → ${BINS[ans][0]}. ${d}`); }
            else {
              wrong++;
              const obj = b === 0 ? 'process object' : 'thread object';
              const hint = ans === 1 ? 'It describes one path of execution, not the whole container.' : 'It describes the whole container and everything its threads do together.';
              say('warn', ans === 2 ? `Close, but <b>${name}</b> is not found only on the ${obj}. Does the other object keep its own version too?`
                : b === 2 ? `<b>${name}</b> is found on just one of the two objects. ${hint}` : `<b>${name}</b> is not on the ${obj}. ${hint}`);
            }
            held = null;
            if (placed.size === ITEMS.length) say('tip', `<b>All ${ITEMS.length} sorted${wrong ? ` with ${wrong} slip${wrong > 1 ? 's' : ''}` : ' without a single slip'}.</b> Pattern: the process holds what is shared (security, quotas, counters, defaults); each thread holds what belongs to one path of execution (context, current priority, suspension, alerts).`);
            paint();
          }
          function paint() {
            pool.replaceChildren(...order.filter((i) => !placed.has(i)).map((i) => h('button', { class: 'btn sm' + (held === i ? ' primary' : ''), type: 'button', onclick: () => { held = held === i ? null : i; paint(); } }, ITEMS[i][0])));
            if (placed.size === ITEMS.length) pool.append(h('span', { class: 'muted small' }, 'The pool is empty.'));
            binEls.forEach((bn, b) => bn.list.replaceChildren(...ITEMS.map((it, i) => [it, i]).filter(([it, i]) => placed.has(i) && it[1] === b).map(([it]) => h('span', { class: 'chip ' + BINS[b][1] }, it[0]))));
            score.textContent = `${placed.size} / ${ITEMS.length} sorted · ${wrong} slip${wrong === 1 ? '' : 's'}`;
          }
          reset();
          panel.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, 'Which object holds each attribute?'), h('div', { class: 'row' }, score, h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Shuffle and restart'))),
            pool,
            h('div', { class: 'grid-3', style: { gap: '10px', minHeight: '236px' } }, ...binEls.map((b) => b.el)),
            fb));
        }

        el.append(ctx.ui.tabs([
          { label: 'Explore a live process', render: tabExplore },
          { label: 'Sort the attributes', render: tabSort },
        ]));
      },
    },
    /* ---------------- 5. Multithreading: a server with one thread per request ---------------- */
    {
      title: 'Multithreading: a server that never sits idle',
      kind: 'compare',
      render(el, ctx) {
        const { h, s } = ctx;
        const WORK = [['cpu', 2], ['io', 3], ['cpu', 1]]; // every request: 2 ms of processing, a 3 ms disk read, 1 ms to reply
        const NR = 4, TMAX = 24;
        // returns segments {r, kind, from, to, core} and finish times, all in ms
        function sim(multi, ncpu) {
          const seg = [], fin = [];
          if (!multi) {
            let t = 0;
            for (let r = 0; r < NR; r++) {
              if (t > 0) seg.push({ r, kind: 'queue', from: 0, to: t });
              for (const [k, d] of WORK) { seg.push({ r, kind: k, from: t, to: t + d, core: 0 }); t += d; }
              fin[r] = t;
            }
            return { seg, fin };
          }
          const th = Array.from({ length: NR }, (_, r) => ({ r, ph: 0, readyAt: 0, cpuEnd: -1, ioEnd: -1, core: -1 }));
          const busy = Array(ncpu).fill(null);
          for (let t = 0; t <= 60 && fin.filter((x) => x != null).length < NR; t++) {
            for (const x of th) if (x.ioEnd === t) { x.ioEnd = -1; x.ph++; x.readyAt = t; }
            for (let c = 0; c < ncpu; c++) {
              const x = busy[c];
              if (x && x.cpuEnd === t) {
                busy[c] = null; x.cpuEnd = -1; x.ph++;
                if (x.ph >= WORK.length) fin[x.r] = t;
                else { x.ioEnd = t + WORK[x.ph][1]; seg.push({ r: x.r, kind: 'io', from: t, to: x.ioEnd }); }
              }
            }
            const ready = th.filter((x) => x.ph < WORK.length && WORK[x.ph][0] === 'cpu' && x.cpuEnd < 0 && x.ioEnd < 0 && !busy.includes(x)).sort((a, b) => a.readyAt - b.readyAt || a.r - b.r);
            for (let c = 0; c < ncpu && ready.length; c++) {
              if (busy[c]) continue;
              const x = ready.shift();
              if (t > x.readyAt) seg.push({ r: x.r, kind: 'wait', from: x.readyAt, to: t });
              busy[c] = x; x.cpuEnd = t + WORK[x.ph][1];
              seg.push({ r: x.r, kind: 'cpu', from: t, to: x.cpuEnd, core: c });
            }
          }
          return { seg, fin };
        }
        let multi = true, ncpu = 1, tCur = 3;
        const N = ctx.narrow, VW = N ? 360 : 640, X0 = N ? 34 : 62, PX = N ? 12.2 : 22.5, Y0 = 32, RH = 52; // phones get a narrower chart
        const svg = s('svg', { viewBox: `0 0 ${VW} 236`, width: '100%', style: 'flex:none' });
        const cap = h('div', { class: 'card tight small', style: { minHeight: '62px' } });
        const kpis = h('div', { class: 'grid-3', style: { gap: '8px' } });
        const story = h('div', { class: 'callout m0 small', style: { minHeight: '58px' } });
        const segDesign = ctx.ui.seg([{ value: false, label: 'Single-threaded server' }, { value: true, label: 'One thread per request' }], multi, (v) => { multi = v; draw(); });
        const segCpu = ctx.ui.seg([{ value: 1, label: '1 processor' }, { value: 2, label: '2' }, { value: 4, label: '4' }], ncpu, (v) => { ncpu = v; draw(); });
        const slider = ctx.ui.slider({ label: 'Look at time', min: 0, max: TMAX - 1, value: tCur, format: (v) => v + ' ms', onInput: (v) => { tCur = v; draw(); } });
        const KIND = { cpu: ['s-cpu', 'runs'], io: ['s-io', 'disk'], wait: ['s-warn', 'ready'], queue: ['s-panel', 'queued'] };
        function draw() {
          const { seg, fin } = sim(multi, ncpu);
          const end = Math.max(...fin);
          const kids = [];
          for (let t = 0; t <= TMAX; t += N ? 4 : 2) kids.push(s('line', { x1: X0 + t * PX, y1: 24, x2: X0 + t * PX, y2: Y0 + NR * RH - 8, class: 's-muted', 'stroke-width': 1, 'stroke-dasharray': '2 4' }),
            s('text', { x: X0 + t * PX, y: 17, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(t)));
          for (let r = 0; r < NR; r++) {
            const y = Y0 + r * RH;
            kids.push(s('text', { x: 6, y: y + 20, 'font-size': 14, 'font-weight': 800 }, (N ? 'R' : 'Req ') + (r + 1)));
            seg.filter((g) => g.r === r).forEach((g) => {
              const [cls, lab] = KIND[g.kind]; const w = (g.to - g.from) * PX;
              kids.push(s('rect', { x: X0 + g.from * PX + 1, y, width: w - 2, height: 30, rx: 5, class: cls, 'stroke-width': 1.4, 'stroke-dasharray': g.kind === 'queue' ? '4 3' : null }));
              const txt = g.kind === 'cpu' ? (w >= 40 ? 'CPU' + g.core : w >= 18 ? 'C' + g.core : '') : w >= lab.length * 6.8 + 4 ? lab : '';
              if (txt) kids.push(s('text', { x: X0 + (g.from + g.to) / 2 * PX, y: y + 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 650 }, txt));
            });
            kids.push(s('text', { x: X0 + fin[r] * PX + 5, y: y + 20, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--ok)' }, '✓ ' + fin[r]));
          }
          kids.push(s('line', { x1: X0 + (tCur + 0.5) * PX, y1: 22, x2: X0 + (tCur + 0.5) * PX, y2: Y0 + NR * RH - 4, style: 'stroke:var(--accent)', 'stroke-width': 2.5 }),
            s('text', { x: 6, y: 17, 'font-size': 13, class: 's-sub' }, N ? 'ms' : 'ms →'));
          svg.replaceChildren(...kids.filter(Boolean));
          // what is happening in the ms starting at tCur
          const now = ctx.util.range(NR).map((r) => {
            const g = seg.find((x) => x.r === r && x.from <= tCur && tCur < x.to);
            if (!g) return `R${r + 1} <b style="color:var(--ok)">done</b>`;
            return `R${r + 1} ${g.kind === 'cpu' ? `<b style="color:var(--cpu)">runs on processor ${g.core}</b>` : g.kind === 'io' ? 'waits for the disk' : g.kind === 'wait' ? '<b style="color:var(--warn)">is ready but no processor is free</b>' : 'has not started yet'}`;
          });
          const idle = ncpu - seg.filter((x) => x.kind === 'cpu' && x.from <= tCur && tCur < x.to).length;
          cap.innerHTML = `<b>From ${tCur} to ${tCur + 1} ms:</b> ${now.join(' · ')}. <span class="muted">Idle processors: ${idle} of ${ncpu}.</span>`;
          const busyPct = Math.round((NR * 3) / (end * ncpu) * 100);
          const avg = fin.reduce((a, b) => a + b, 0) / NR;
          kpis.replaceChildren(
            h('div', { class: 'card tight center' }, h('div', { class: 'xs muted' }, 'All 4 answered after'), h('div', { class: 'b', style: { fontSize: '24px' } }, end + ' ms')),
            h('div', { class: 'card tight center' }, h('div', { class: 'xs muted' }, 'Average response time'), h('div', { class: 'b', style: { fontSize: '24px' } }, ctx.util.fmt(avg, 1) + ' ms')),
            h('div', { class: 'card tight center' }, h('div', { class: 'xs muted' }, 'Processors busy'), h('div', { class: 'b', style: { fontSize: '24px' } }, busyPct + '%')));
          story.className = 'callout m0 small ' + (multi ? 'tip' : 'warn');
          story.innerHTML = !multi
            ? `One thread serves the requests in turn. While it waits for the disk, it cannot start the next request, so the processor sits idle half the time, and ${ncpu > 1 ? 'the extra processors never get any work at all: a single thread can only use one processor at a time.' : 'request 4 waits 18 ms before it is even looked at.'}`
            : ncpu === 1 ? 'With a thread per request, when one thread blocks on the disk the kernel simply runs another. The single processor is never idle, and everything finishes in half the time.'
              : `Now threads of the <b>same process</b> run at the same instant on ${ncpu} processors. ${ncpu === 4 ? 'Every request has its own processor; the only waiting left is the disk itself.' : 'Two requests are processed at once, so the queue drains even faster.'}`;
        }
        draw();
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack', style: { gap: '9px' } },
            h('p', { class: 'm0', html: 'Threads of <b>different processes</b> may run concurrently: on one processor they take turns so quickly that they appear to run together. What threads add is that the threads of <b>one process</b> can also be placed on different processors and run at literally the same moment, so a single program can use several processors.' }),
            h('div', { class: 'card tight small', html: '<b>How threads talk.</b> Threads of one process share its address space: one thread writes a variable and another reads it, no kernel call needed (a lock or an atomic operation makes that reliable; section 5.1). Threads in <b>different</b> processes must first map shared memory (a <span class="t">section object</span>) into both, or exchange messages.' }),
            h('div', { class: 'callout why m0 small', 'data-label': 'Why servers are built this way', html: 'A multithreaded process makes an efficient server. One process (one object, holding one copy of the code and shared data) serves everyone; each client request gets its own thread, so a request stuck waiting for the disk never holds up the others.' }),
            story),
          h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, segDesign, segCpu),
            h('p', { class: 'xs muted m0', html: 'Four requests arrive at time 0; each needs 2 ms of processing, a 3 ms disk read (reads may overlap), 1 ms to reply. <b style="color:var(--cpu)">Blue</b>: on a processor (C0 = processor 0) · <b style="color:var(--io)">orange</b>: disk · <b style="color:var(--warn)">amber</b>: ready, no free processor.' }),
            svg, slider, cap, kpis)));
      },
    },
    /* ---------------- 6. The six Windows thread states ---------------- */
    {
      title: 'Six thread states: drive a thread through its life',
      kind: 'lab',
      core: true,
      render(el, ctx) {
        const { h, s } = ctx;
        const ST = {
          Ready: [36, 52, true, 'The thread could run right now. It waits among the other ready threads, and the kernel\'s dispatcher considers them in priority order.'],
          Standby: [260, 52, true, 'The dispatcher has chosen this thread to run next on one particular processor. It waits for that processor; if its priority beats the thread running there, that thread is preempted.'],
          Running: [484, 52, true, 'The thread is executing on a processor. It keeps going until a higher-priority thread preempts it, its quantum runs out, it blocks, or it terminates.'],
          Transition: [36, 228, false, 'The wait is over and the thread is ready to run, but something it needs, typically its kernel stack, has been paged out of memory. When the page is back it becomes Ready.'],
          Waiting: [260, 228, false, 'The thread is blocked on an event such as I/O, is waiting on purpose to synchronize with other threads, or has been suspended by its environment subsystem.'],
          Terminated: [484, 228, false, 'The thread is finished: it ended itself, another thread ended it, or its process ended. After clean-up the executive removes it, or keeps the object to reuse for a new thread.'],
        };
        const W = 140, HH = 56;
        const EV = [
          ['pick', 'Picked to run next', 'Ready', 'Standby', 'The dispatcher picks this thread to run next on processor 2, so it moves to <span class="t" data-t="Standby state">Standby</span>. Only one thread can be on standby for each processor.'],
          ['switch', 'Its processor becomes free', 'Standby', 'Running', 'Processor 2 finishes with its previous thread, the dispatcher switches context, and the thread is <b>Running</b>.'],
          ['quantum', 'Quantum ends', 'Running', 'Ready', 'Its <span class="t">quantum</span> is used up. It did not block, so it goes straight back to <b>Ready</b> to take another turn later.'],
          ['preempt', 'Higher priority preempts it', 'Running', 'Ready', 'A higher-priority thread became ready, so this one is <b>preempted</b> and returns to <b>Ready</b>. It is still able to run; it has only lost the processor.'],
          ['io', 'Waits for I/O or a sync object', 'Running', 'Waiting', 'The thread asks for a disk read (or waits on an event or mutex) and cannot continue until it completes, so it moves to <b>Waiting</b> and frees the processor.'],
          ['suspend', 'Subsystem suspends it', 'Running', 'Waiting', 'Its subsystem tells it to suspend itself: it sits in <b>Waiting</b> until resumed. Its memory stays put, unlike the swapped-out Suspended state of section 4.1.'],
          ['wakeIn', 'Wait ends, stack in memory', 'Waiting', 'Ready', 'The wait is satisfied (or it was resumed) and everything it needs is in memory, so it becomes <b>Ready</b>.'],
          ['wakeOut', 'Wait ends, stack paged out', 'Waiting', 'Transition', 'The wait is satisfied, but while it slept its kernel stack was paged out to disk. It is ready in principle but must sit in <span class="t" data-t="Transition state">Transition</span>.'],
          ['pageIn', 'Kernel stack paged back in', 'Transition', 'Ready', 'The memory manager brings the kernel stack back into memory. Nothing is missing now, so the thread becomes <b>Ready</b>.'],
          ['term', 'Terminates', 'Running', 'Terminated', 'The thread returns from its start function (or is ended by another thread, or by its process ending) and becomes <b>Terminated</b>.'],
        ];
        const WRONG = {
          pick: 'The dispatcher only picks from <b>Ready</b> threads.',
          switch: 'A processor switches only to the thread already chosen for it, the one in <b>Standby</b>.',
          quantum: 'Only a <b>Running</b> thread has a quantum to use up.',
          preempt: 'Only a <b>Running</b> thread has a processor to lose.',
          io: 'A thread asks to wait by executing code, so it must be <b>Running</b>.',
          suspend: 'In the standard state diagram, the arrow into Waiting starts at <b>Running</b>.',
          wakeIn: 'Nothing to wake: the thread is not <b>Waiting</b> for anything.',
          wakeOut: 'Nothing to wake: the thread is not <b>Waiting</b> for anything.',
          pageIn: 'Only a thread in <b>Transition</b> is waiting for its kernel stack to come back.',
          term: 'In the standard state diagram, the only arrow into Terminated starts at <b>Running</b>.',
        };
        const ARROWS = {
          pick: ['M176 76 H254', 215, 68, 'pick to run', 'middle'],
          switch: ['M400 76 H478', 439, 68, 'switch', 'middle'],
          preempt: ['M554 52 V30 H106 V46', 330, 24, 'preempted, or quantum ends', 'middle'],
          block: ['M510 108 L382 224', 470, 160, 'block / suspend', 'start'],
          unblockIn: ['M290 228 L154 112', 240, 160, 'unblock / resume:', 'start', 'resources in memory'],
          unblockOut: ['M260 262 H182', 188, 302, 'unblock, but a', 'start', 'resource is paged out'],
          pageIn: ['M80 228 V114', 88, 160, 'resources', 'start', 'available'],
          term: ['M604 108 V222', 596, 200, 'terminate', 'end'],
        };
        const ARROW_OF = { pick: 'pick', switch: 'switch', quantum: 'preempt', preempt: 'preempt', io: 'block', suspend: 'block', wakeIn: 'unblockIn', wakeOut: 'unblockOut', pageIn: 'pageIn', term: 'term' };
        const MISSIONS = [
          ['Get the thread running', (a, b) => b === 'Running'],
          ['Make it lose the processor without blocking', (a, b) => a === 'Running' && b === 'Ready'],
          ['Take it through Transition and back to Ready', (a, b) => a === 'Transition' && b === 'Ready'],
          ['Terminate it', (a, b) => b === 'Terminated'],
        ];
        let cur, last, done, hist;
        const N = ctx.narrow; // phones: the arrow diagram would be too small, so show a two-column state board instead
        const svg = s('svg', { viewBox: '0 0 660 330', width: '100%', style: 'flex:none' });
        const board = h('div', { class: 'stgrid' });
        const stateCard = h('div', { class: 'card tight stack', style: { gap: '4px', minHeight: '104px' } });
        const fb = h('div', { class: 'callout m0 small', style: { minHeight: '84px' } });
        const mis = h('div', { class: 'stack', style: { gap: '3px' } });
        const log = h('div', { class: 'log', style: { height: '70px', fontSize: '13px' } });
        const btns = EV.map(([id, lab]) => h('button', { class: 'btn sm', type: 'button', style: { whiteSpace: 'normal', height: 'auto', minHeight: '32px', lineHeight: '1.2', padding: '4px 9px' }, onclick: () => fire(id) }, lab));
        function reset() {
          cur = 'Ready'; last = null; done = new Set(); hist = [];
          fb.className = 'callout m0 small'; fb.removeAttribute('data-label'); fb.innerHTML = 'A new thread is <b>Ready</b>. The top three states are <b>runnable</b>: the thread could use a processor now. In the bottom three it cannot, until something changes. Press events to move it; illegal moves are refused, with the reason.';
          paint();
        }
        function fire(id) {
          const ev = EV.find((e) => e[0] === id);
          if (cur !== ev[2]) {
            fb.className = 'callout bad m0 small'; fb.setAttribute('data-label', 'Not possible from ' + cur);
            fb.innerHTML = `“${ev[1]}” cannot happen now. ${WRONG[id]} ${cur === 'Terminated' ? 'A terminated thread never runs again; press Reset to create a new one.' : `The thread is in <b>${cur}</b>.`}`;
            return paint();
          }
          const from = cur; cur = ev[3]; last = ARROW_OF[id];
          MISSIONS.forEach(([, test], k) => { if (test(from, cur)) done.add(k); });
          hist.push(`${from} → ${cur}  (${ev[1]})`);
          fb.className = 'callout tip m0 small'; fb.setAttribute('data-label', from + ' → ' + cur);
          fb.innerHTML = ev[4];
          paint();
        }
        function paint() {
          const kids = [
            s('rect', { x: 8, y: 8, width: 644, height: 128, rx: 14, class: 's-panel', 'stroke-width': 1.2, 'stroke-dasharray': '6 4' }),
            s('text', { x: 20, y: 27, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--ok)' }, 'RUNNABLE'),
            s('rect', { x: 8, y: 186, width: 644, height: 140, rx: 14, class: 's-panel', 'stroke-width': 1.2, 'stroke-dasharray': '6 4' }),
            s('text', { x: 20, y: 316, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--bad)' }, 'NOT RUNNABLE'),
          ];
          for (const [k, [d, lx, ly, t1, anchor, t2]] of Object.entries(ARROWS)) {
            const on = k === last;
            kids.push(s('path', { d, fill: 'none', class: on ? '' : 's-line', style: on ? 'stroke:var(--accent)' : null, 'stroke-width': on ? 3.5 : 1.8, 'marker-end': on ? 'url(#arr-accent)' : 'url(#arr)' }),
              s('text', { x: lx, y: ly, 'text-anchor': anchor, 'font-size': 13, 'font-weight': on ? 800 : 500, style: on ? 'fill:var(--accent)' : null }, t1));
            if (t2) kids.push(s('text', { x: lx, y: ly + 16, 'text-anchor': anchor, 'font-size': 13, 'font-weight': on ? 800 : 500, style: on ? 'fill:var(--accent)' : null }, t2));
          }
          for (const [name, [x, y]] of Object.entries(ST)) {
            const me = name === cur;
            kids.push(s('rect', { x, y, width: W, height: HH, rx: 12, class: me ? 's-thread' : 's-panel', 'stroke-width': me ? 4 : 1.6 }),
              s('text', { x: x + W / 2, y: y + (me ? 25 : 34), 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800 }, name));
            if (me) kids.push(s('text', { x: x + W / 2, y: y + 45, 'text-anchor': 'middle', 'font-size': 13, style: 'fill:var(--thread)', 'font-weight': 700 }, '● the thread is here'));
          }
          svg.replaceChildren(...kids.filter(Boolean));
          const col = (title, names, cls) => h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'xs b', style: { color: `var(--${cls})` } }, title),
            ...names.map((n) => h('div', { class: 'box' + (n === cur ? ' thread' : ''), style: { borderWidth: n === cur ? '3px' : '2px' } }, n)));
          if (N) board.replaceChildren(col('RUNNABLE', ['Ready', 'Standby', 'Running'], 'ok'), col('NOT RUNNABLE', ['Waiting', 'Transition', 'Terminated'], 'bad'));
          const [, , run, desc] = ST[cur];
          const nextEv = EV.filter((e) => e[2] === cur).map((e) => e[1]);
          stateCard.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Now: ' + cur), h('span', { class: 'chip ' + (run ? 'ok' : 'bad') }, run ? 'Runnable' : 'Not runnable')),
            h('p', { class: 'small m0' }, desc),
            ...(N ? [h('p', { class: 'xs muted m0' }, nextEv.length ? 'Legal next events: ' + nextEv.join(' · ') : 'No event can move it any more.')] : []));
          mis.replaceChildren(h('b', { class: 'small' }, `Missions: ${done.size} of ${MISSIONS.length}`),
            ...MISSIONS.map(([t], k) => h('div', { class: 'small', style: { color: done.has(k) ? 'var(--ok)' : 'var(--ink-2)' } }, (done.has(k) ? '✓ ' : '○ ') + t)));
          log.replaceChildren(...(hist.length ? hist.slice().reverse().map((x) => h('div', {}, x)) : [h('div', { class: 'muted' }, 'Transitions will be listed here.')]));
        }
        reset();
        el.append(h('div', { class: 'split r fill' },
          h('div', { class: 'stack', style: { gap: '10px' } }, N ? board : svg, stateCard,
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Calling Transition a kind of Waiting. A <b>waiting</b> thread still needs its event; a thread in <b>Transition</b> already has it and only needs a paged-out resource (its kernel stack) back.' })),
          h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'grid-2', style: { gap: '6px' } }, ...btns),
            fb, mis, log,
            h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset: new thread')))));
      },
    },
    /* ---------------- 7. Environment subsystems build on the executive ---------------- */
    {
      title: 'Subsystems give processes their personality',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        const MODES = {
          win32: { app: 'Win32 program', call: 'CreateProcess(...)', sub: 'Win32 subsystem', frames: [
            [['app', 'a1'], 'A Win32 program wants to start another program, so it calls <b>CreateProcess</b>, a Win32 API function.'],
            [['sub', 'a1'], 'The call is handled by the <b>Win32 subsystem</b>: its DLLs inside the program and its server process. The subsystem knows the Win32 rules; the executive does not.'],
            [['sub', 'exe', 'a2', 'pobj', 'a3p'], 'The subsystem calls the executive\'s generic service: create a process object. It names the <b>calling program</b> as the parent, so the new process inherits that program\'s access token, quota limits, base priority and default processor affinity, not the subsystem server\'s. It also gets its own address space and handle table.'],
            [['exe', 'tobj', 'a3t'], 'Win32 rule: every new process starts with one thread. So the subsystem also has the executive create the first <b>thread object</b>.'],
            [['exe', 'sub', 'a4'], 'The executive returns <b>handles</b> to the new process and thread objects. To the executive these are ordinary, general-purpose objects.'],
            [['sub', 'app', 'a5'], 'The Win32 subsystem <b>interprets</b> the handles in Win32 terms: it records the new process in its own bookkeeping and gives the program a process handle, a thread handle and both IDs.'],
          ] },
          posix: { app: 'POSIX program', call: 'fork()', sub: 'POSIX subsystem', frames: [
            [['app', 'a1'], 'A program written for a POSIX-style subsystem (older Windows versions shipped one) calls <b>fork()</b>: make a copy of me.'],
            [['sub', 'a1'], 'The call is handled by the <b>POSIX subsystem</b>, which knows what fork means. The executive has no fork of its own.'],
            [['sub', 'exe', 'a2', 'pobj', 'a3p'], 'The subsystem uses the <b>same</b> generic executive service to create a process object, this time asking for a copy of the parent\'s address space.'],
            [['exe', 'tobj', 'a3t'], 'A thread object is created for the child too, set to continue from the same point as the parent, because fork returns in both.'],
            [['exe', 'sub', 'a4'], 'The executive hands back handles, exactly as it did for Win32. It does not care which personality asked.'],
            [['sub', 'app', 'a5'], 'The POSIX subsystem adds its own rules: it keeps the <b>parent-child link</b> so wait() and getppid() work, and returns the child\'s process ID. Same executive, different personality.'],
          ] },
        };
        let mode = 'win32';
        const svg = s('svg', { viewBox: '0 0 660 318', width: '100%', style: 'flex:none' });
        function box(id, on, x, y, w, hgt, cls, lines) {
          const g = s('g', { opacity: on ? 1 : 0.5 }, s('rect', { x, y, width: w, height: hgt, rx: 12, class: cls, 'stroke-width': on ? 3.5 : 1.5 }));
          lines.forEach(([t, dy, bold], i) => g.append(s('text', { x: x + w / 2, y: y + dy, 'text-anchor': 'middle', 'font-size': i === 0 ? 15 : 13, 'font-weight': bold ? 800 : 500, class: bold ? null : 's-sub' }, t)));
          return g;
        }
        function arrow(on, d, lx, ly, t, anchor = 'middle') {
          return s('g', { opacity: on ? 1 : 0.35 }, s('path', { d, fill: 'none', class: on ? '' : 's-line', style: on ? 'stroke:var(--accent)' : null, 'stroke-width': on ? 3 : 1.6, 'marker-end': on ? 'url(#arr-accent)' : 'url(#arr)' }),
            s('text', { x: lx, y: ly, 'text-anchor': anchor, 'font-size': 13, 'font-weight': 700, style: on ? 'fill:var(--accent)' : null }, t));
        }
        const N = ctx.narrow; // phones: stack the boxes vertically so the text stays readable
        if (N) svg.setAttribute('viewBox', '0 0 340 438');
        function draw(i) {
          const M = MODES[mode]; const [on, cap] = M.frames[i]; const is = (k) => on.includes(k);
          const L = N ? {
            user: [2, 2, 336, 206, 20], kern: [2, 220, 336, 214, 238],
            app: [16, 30, 308, 56, [[M.app, 24, true], ['calls ' + M.call, 44]]],
            sub: [16, 122, 308, 84, [[M.sub, 24, true], ['DLLs in each program + a server process', 46], ['decides what process features mean', 66]]],
            exe: [16, 256, 308, 84, [['Executive', 24, true], ['process and thread manager', 46], ['generic services: create, open, end', 66]]],
            pobj: [16, 370, 146, 44], tobj: [178, 370, 146, 44],
            a1: ['M120 86 V116', 128, 106, 'call', 'start'], a2: ['M120 206 V250', 128, 234, 'create', 'start'], a3p: ['M89 340 V364', 0, 0, ''], a3t: ['M251 340 V364', 0, 0, ''],
            a4: ['M220 250 V212', 228, 234, 'handles', 'start'], a5: ['M220 116 V92', 228, 106, 'handles, IDs', 'start'],
          } : {
            user: [2, 2, 656, 150, 22], kern: [2, 164, 656, 152, 184],
            app: [18, 42, 170, 88, [[M.app, 34, true], ['calls ' + M.call, 58]]],
            sub: [290, 32, 352, 104, [[M.sub, 30, true], ['the DLLs inside each program', 54], ['+ a server process', 74], ['decides what process features mean', 94]]],
            exe: [200, 196, 250, 104, [['Executive', 30, true], ['process and thread manager', 54], ['generic services only:', 74], ['create, open, end objects', 94]]],
            pobj: [490, 196, 152, 46], tobj: [490, 254, 152, 46],
            a1: ['M188 72 H284', 236, 64, 'call', 'middle'], a2: ['M330 136 V190', 338, 170, 'create', 'start'], a3p: ['M450 219 H484', 0, 0, ''], a3t: ['M450 277 H484', 0, 0, ''],
            a4: ['M420 190 V142', 428, 170, 'handles', 'start'], a5: ['M284 112 H194', 240, 104, 'handles, IDs', 'middle'],
          };
          const [ux, uy, uw, uh, uly] = L.user, [kx, ky, kw, kh, kly] = L.kern;
          svg.replaceChildren(
            s('rect', { x: ux, y: uy, width: uw, height: uh, rx: 12, class: 's-panel', 'stroke-width': 1, 'stroke-dasharray': '5 4' }),
            s('text', { x: 14, y: uly, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 'USER MODE'),
            s('rect', { x: kx, y: ky, width: kw, height: kh, rx: 12, class: 's-os', 'stroke-width': 1, 'stroke-dasharray': '5 4', opacity: 0.55 }),
            s('text', { x: 14, y: kly, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }, 'KERNEL MODE'),
            box('app', is('app'), ...L.app.slice(0, 4), 's-proc', L.app[4]),
            box('sub', is('sub'), ...L.sub.slice(0, 4), 's-os', L.sub[4]),
            box('exe', is('exe'), ...L.exe.slice(0, 4), 's-os', L.exe[4]),
            box('pobj', is('pobj'), ...L.pobj, 's-proc', [['Process object', 28, true]]),
            box('tobj', is('tobj'), ...L.tobj, 's-thread', [['Thread object', 28, true]]),
            ...['a1', 'a2', 'a3p', 'a3t', 'a4', 'a5'].map((k) => arrow(is(k), ...L[k])),
          );
          return cap;
        }
        const player = ctx.ui.player({ count: 6, render: draw, interval: 2600 });
        const seg = ctx.ui.seg([{ value: 'win32', label: 'Win32 program' }, { value: 'posix', label: 'POSIX-style program' }], mode, (v) => { mode = v; player.go(0); });
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'm0', html: 'Windows can host several operating-system "personalities", each provided by an <span class="t">environment subsystem</span>. Almost every program today uses Win32.' }),
            h('div', { class: 'grid-2', style: { gap: '8px' } },
              h('div', { class: 'card tight small', style: { borderTop: '4px solid var(--os)' }, html: '<b>The executive</b> supplies plain, general services: create a process object, create a thread object, open, wait, end. It returns handles and imposes very little policy.' }),
              h('div', { class: 'card tight small', style: { borderTop: '4px solid var(--os)' }, html: '<b>Each subsystem</b> is responsible for the process and thread features of its own personality. It calls the executive, then interprets the handles that come back.' })),
            h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'The executive is a builder who puts up standard rooms. Each subsystem is an interior designer who decides what a room is for and furnishes it to match its own style.' }),
            h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'The executive keeps processes simple: it notes which process created a new one but enforces no family tree (ending a parent does not end its children). A subsystem that needs parent-and-child rules, as POSIX does, keeps them itself, so new personalities need no kernel changes.' })),
          h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, 'Follow one process creation'), seg), svg, player.el)));
      },
    },
    /* ---------------- 8. Recap ---------------- */
    {
      title: 'Recap: Windows processes and threads on one page',
      kind: 'recap',
      render(el, ctx) {
        const { h } = ctx;
        el.append(h('div', { class: 'stack fill' },
          h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. Then check yourself.'),
          ctx.ui.flipcards([
            ['What does a process own, and what does each thread keep?', '<div><b>Process:</b> address space, code, handles, security context, ID, environment variables, priority class, working-set limits. <b>Thread:</b> its own ID, saved context, priority, thread-local storage and exception handlers.</div>'],
            ['Job, thread pool, fiber, UMS?', '<div><b>Job:</b> processes managed as one unit. <b>Pool:</b> system-kept workers run your callbacks. <b>Fiber:</b> switched by hand inside one thread, kernel unaware. <b>UMS:</b> the app schedules its own real threads.</div>'],
            ['What happens to a Modern app in the background?', '<div>Only the foreground app runs. PLM <b>suspends</b> background apps and may <b>terminate</b> them without warning when memory runs low, so apps save state on suspension. Background tasks get a small budget.</div>'],
            ['What four things make up a Windows process?', '<div>An <b>access token</b> (whom it acts for), <b>virtual address descriptors</b> (its address map), a <b>handle table</b> (objects it has opened) and <b>one or more threads</b>.</div>'],
            ['Process object or thread object?', '<div><b>Process:</b> security descriptor, default affinity, quotas, I/O and VM counters, exception/debug ports. <b>Thread:</b> context, dynamic priority, affinity, alert status, suspension count, impersonation token, termination port. <b>Both:</b> ID, base priority, execution time, exit status.</div>'],
            ['How does multithreading help?', '<div>Threads of different processes run concurrently, and a process can also run its own threads at the same instant on different processors. Same-process threads share memory directly. A thread per request makes an efficient server.</div>'],
            ['Name the six thread states.', '<div><b>Runnable:</b> Ready → Standby → Running. <b>Not runnable:</b> Waiting (I/O, sync or suspended), Transition (ready, but kernel stack paged out), Terminated.</div>'],
            ['Who gives a process its personality?', '<div>The <b>environment subsystem</b>. The executive only creates generic process and thread objects and returns handles; the subsystem interprets them by its own rules. It names the calling program as parent, so the new process inherits that program\'s token, quotas, base priority and affinity.</div>'],
          ], { cols: 4, height: 226 })));
      },
    },
    /* ---------------- 9. Check yourself ---------------- */
    {
      title: 'Check yourself: Windows processes and threads',
      kind: 'check',
      quiz: [
        { q: 'A Windows program opens a file and gets back the number 0x04. What is that number?',
          choices: ['A handle: an index into the process’s own handle table, whose entry points to the file object', 'A direct pointer to the file object in system memory, which the program follows to read the file', 'A system-wide file ID that any other process can also use to reach the same open file', 'A count of how many of the program’s threads are currently allowed to use the file'], answer: 0,
          feedback: [null, 'Programs never get a direct pointer to an object. They hold only an index into their own table, so Windows can check every use.', 'Handles are private to one process. Another process’s 0x04, if it has one, names a different entry in a different table.', 'A handle names an opened object and says nothing about threads: every thread of the process can use it.'],
          why: 'A handle is a small number private to one process. It indexes that process’s handle table, and the table entry points to the object, which lives in system memory outside the process.' },
        { type: 'multi', q: 'Which of these does each Windows thread keep for itself instead of sharing with the other threads of its process? Select all that apply.',
          choices: ['Thread-local storage', 'Exception handlers', 'Virtual address space', 'Saved context (register values)', 'The process\'s access token', 'Environment variables'], answer: [0, 1, 3],
          why: 'Each thread has its own ID, saved context, scheduling priority, thread-local storage and exception handlers. The address space, security context and environment variables belong to the process and are shared.' },
        { type: 'match', q: 'Match each Windows building block to what it does.',
          pairs: [['Job object', 'Manages a group of processes as one unit'], ['Thread pool', 'Worker threads that run asynchronous callbacks for the app'], ['Fiber', 'A unit of execution the app switches to by hand inside one thread'], ['User-mode scheduling (UMS)', 'Lets an app schedule its own real threads in user mode']],
          why: 'Jobs group processes; pools run callbacks on system-managed workers; fibers are scheduled manually and are invisible to the kernel; UMS lets an application schedule real kernel threads itself.' },
        { type: 'tf', q: 'When memory runs low, Windows warns a suspended Modern app just before terminating it, so the app can save its state at that moment.', answer: false,
          why: 'A suspended app is terminated without warning. That is why it must save its app state data when it is suspended, and restore that data if it is relaunched.' },
        { q: 'One Windows thread hosts four fibers. One fiber makes a blocking file read that must wait for the disk. What happens to the other three fibers until the read completes?',
          choices: ['None of them runs: the kernel blocks the host thread, and all four fibers live inside it', 'The kernel switches to another fiber of the same thread', 'The application\'s own scheduler is told about the block and runs another fiber', 'They keep running, because the kernel schedules each fiber separately'], answer: 0,
          feedback: [null, 'The kernel does not know fibers exist, so it cannot switch between them; it sees only the thread, which is now blocked.', 'That notification is what user-mode scheduling (UMS) gives for real threads. A fiber scheduler gets no such notice, and it is stuck inside the blocked thread anyway.', 'Only the host thread is scheduled by the kernel; the fibers are switched by explicit calls in the program.'],
          why: 'Fibers are switched by explicit calls inside one thread and are invisible to the kernel, so when one fiber blocks, the kernel blocks its whole host thread. UMS avoids this: its threads are real kernel threads, and the app\'s scheduler regains control when one blocks.' },
        { type: 'bucket', q: 'Sort each attribute onto the Windows object that holds it.', buckets: ['Process object', 'Thread object'],
          items: [['Quota limits', 0], ['VM operation counters', 0], ['Exception/debugging ports', 0], ['Suspension count', 1], ['Impersonation token', 1], ['Thread context', 1]],
          why: 'The process object holds what belongs to the whole container: quota limits, counters and the exception/debugging ports. The thread object holds what belongs to one path of execution: its context, suspension count and impersonation token.' },
        { q: 'Every Windows process has an access token. What is it for?',
          choices: ['Recording which ranges of the address space are in use', 'Identifying whom the process acts for, so Windows can decide whether it may open protected objects', 'Numbering the objects the process has opened', 'Storing the saved registers of the primary thread'], answer: 1,
          feedback: ['That is the job of the virtual address descriptors, the memory manager\'s records of which address ranges are in use.', null, 'That is the handle table: one entry per opened object, and the entry\'s number is the handle.', 'Saved registers are each thread\'s own context, kept per thread, not in a token shared by the whole process.'],
          why: 'The access token holds the user identity, groups and privileges. Each attempt to open a protected object is checked against it.' },
        { type: 'order', q: 'A ready thread is picked for a processor, runs, blocks on a disk read, and while it waits its kernel stack is paged out. Put the states it visits in order, up to the moment its read has completed.',
          items: ['Ready', 'Standby', 'Running', 'Waiting', 'Transition'],
          why: 'Ready → Standby (picked for one processor) → Running → Waiting (blocked on the read) → Transition (the read is done, but the kernel stack must come back into memory). Only then does it return to Ready.' },
        { q: 'What does the Standby state mean for a Windows thread?',
          choices: ['It has been selected to run next on a particular processor and is waiting for that processor', 'It is blocked until an I/O operation finishes', 'It is ready to run, but its kernel stack is paged out of memory', 'It has finished and is waiting to be cleaned up'], answer: 0,
          feedback: [null, 'That describes Waiting: the thread cannot continue until its I/O finishes, so no processor has been picked for it.', 'That describes Transition: the thread is ready except that its kernel stack must first be paged back in.', 'That describes Terminated: the thread has finished and will never be scheduled again.'],
          why: 'Standby sits between Ready and Running: the dispatcher has picked the thread for one processor. If its priority is high enough, the thread now running on that processor may be preempted.' },
        { type: 'num', q: 'A single-threaded server handles 4 requests strictly one after another. Each request needs 2 ms of processing, then a 3 ms disk read, then 1 ms to reply, and the thread does nothing else while it waits. How many milliseconds pass until all four are answered?',
          answer: 24, tol: 0, unit: 'ms',
          why: 'Each request takes 2 + 3 + 1 = 6 ms and nothing overlaps: 4 × 6 = 24 ms. With one thread per request, one thread\'s disk wait overlaps another\'s processing, so the same work finishes far sooner (12 ms on one processor).' },
        { type: 'num', q: 'A Windows thread is suspended 3 times and then resumed once. What is its suspension count now?', answer: 2, tol: 0,
          why: 'Each suspend adds 1 and each resume subtracts 1: 3 − 1 = 2. The thread may run again only when its suspension count is back to 0.' },
        { q: 'When a program creates a new process, what does its environment subsystem do that the executive does not?',
          choices: ['Allocate the physical memory for the new process', 'Interpret the returned handles and apply its own personality\'s rules, such as Win32\'s first thread or POSIX\'s parent-child link', 'Schedule the new process\'s threads on processors', 'Build the process object itself'], answer: 1,
          feedback: ['Memory belongs to the executive\'s memory manager, whichever subsystem asked for the process.', null, 'Scheduling belongs to the kernel\'s dispatcher, not to a subsystem.', 'The executive\'s process manager builds the object; the subsystem only asks for it.'],
          why: 'The executive offers generic process and thread services and returns handles. Each subsystem gives those objects the meaning its own personality requires; it also names the calling program as the parent, so the new process inherits that program\'s access token, quotas, base priority and affinity.' },
      ],
    },
  ],

  notes: `
    <h3>Windows process and thread management</h3>
    <p>Windows separates <b>owning resources</b> (the process) from <b>being scheduled</b> (the thread). Both are kernel <b>objects</b> with built-in synchronization: another thread can wait on either one.</p>

    <h4>1. The basic building blocks</h4>
    <p>An <b>application</b> consists of one or more <b>processes</b>. A process is a running instance of a program together with everything it owns:</p>
    <ul>
      <li>a private <b>virtual address space</b> and the <b>executable code</b> loaded into it;</li>
      <li><b>open handles</b> to system objects (files, events, other processes and threads);</li>
      <li>a <b>security context</b> (the access token: user, groups, privileges) and a <b>unique process ID</b>;</li>
      <li><b>environment variables</b>, a <b>priority class</b>, and a <b>minimum and maximum working-set size</b>;</li>
      <li><b>at least one thread</b>; the first is called the primary thread.</li>
    </ul>
    <p>A <b>thread</b> is the schedulable entity inside a process. All threads of a process share its address space and resources. Each thread also keeps its own <b>exception handlers</b>, <b>scheduling priority</b>, <b>thread-local storage</b> (a variable with a separate value per thread), <b>unique thread ID</b> and <b>saved context</b> (register values kept while it is not running).</p>

    <h4>2. Four extra building blocks</h4>
    <table>
      <tr><th>Tool</th><th>What it is</th><th>Who decides what runs</th></tr>
      <tr><td>Job object</td><td>A group of processes managed as one unit: shared limits (memory, processor time, number of processes), shared accounting, one call ends them all.</td><td>Normal scheduling; the job only groups and limits.</td></tr>
      <tr><td>Thread pool</td><td>System-kept worker threads that run asynchronous callbacks the application submits (timers, I/O completions, small tasks).</td><td>The kernel schedules the workers.</td></tr>
      <tr><td>Fiber</td><td>A unit of execution scheduled manually by the application. Fibers run inside a thread and take on its identity (its ID, its thread-local storage). The kernel does not know they exist, so one blocking fiber stalls its whole thread, exactly like the user-level threads of section 4.2. Useful for porting programs that schedule their own tasks.</td><td>The application, by explicit switches.</td></tr>
      <tr><td>User-mode scheduling (UMS)</td><td>Lets an application schedule its own real threads, switching in user mode without the system scheduler. Each UMS thread has its own context, and the app regains control when one blocks in the kernel. More efficient than a pool for short work items that make few system calls. Introduced in 64-bit Windows 7; deprecated and no longer supported starting with Windows 11.</td><td>The application, for real threads.</td></tr>
    </table>

    <h4>3. Background apps from Windows 8 onward</h4>
    <p>Classic desktop programs keep running in the background. Modern (Store) apps are managed by <b>process lifetime management (PLM)</b>:</p>
    <ul>
      <li>Only the <b>foreground</b> app is active.</li>
      <li>A few seconds after an app leaves the foreground, it is <b>suspended</b>: its threads get no processor time, but its memory is kept, so switching back is instant.</li>
      <li>If memory runs low, Windows may <b>terminate</b> a suspended app, with no warning.</li>
      <li>So the developer must save <b>app state data</b> on suspension and restore it on relaunch; done right, the user never notices.</li>
      <li>An app can register <b>background tasks</b> that run on a trigger with limited processor time and memory while the app itself stays suspended.</li>
    </ul>
    <p>Why: on a tablet or laptop, a hidden app should use neither memory nor battery.</p>

    <h4>4. Inside a Windows process</h4>
    <p>Each process is a <b>process object</b> made of:</p>
    <ul>
      <li>an <b>access token</b>: whom the process acts for. Windows checks it whenever the process opens a protected object (a file only group HR may open is refused if the token lacks HR).</li>
      <li><b>virtual address descriptors (VADs)</b>: one record per range of the address space in use (program image, heap, each thread's stack, private data, mapped views), kept by the memory manager.</li>
      <li>a <b>handle table</b>: one entry per object it has opened (files, sections, threads...). A handle is the entry's number, private to this process; the object itself lives in system memory, and the program never gets a direct pointer to it. A freed entry is reused. Closing a thread's handle does not stop the thread.</li>
      <li><b>one or more threads</b>, each represented by a thread object.</li>
    </ul>
    <table>
      <tr><th>Process object attributes</th><th>Thread object attributes</th></tr>
      <tr><td>Process ID</td><td>Thread ID</td></tr>
      <tr><td>Security descriptor (who may open or control it)</td><td>Thread context (saved registers)</td></tr>
      <tr><td>Base priority (starting point for its threads)</td><td>Dynamic priority (current value, may be boosted) and base priority (its floor)</td></tr>
      <tr><td>Default processor affinity</td><td>Thread processor affinity (all or part of the process's set)</td></tr>
      <tr><td>Quota limits (memory, paging file, processor time)</td><td>Thread execution time (user and kernel mode)</td></tr>
      <tr><td>Execution time (all threads added together)</td><td>Alert status (may it run an asynchronous procedure call while waiting?)</td></tr>
      <tr><td>I/O counters and VM operation counters</td><td>Suspension count (suspends minus resumes; runs only at 0)</td></tr>
      <tr><td>Exception/debugging ports (messages to the subsystem or a debugger)</td><td>Impersonation token (act on behalf of another user) and termination port</td></tr>
      <tr><td>Exit status (object signaled at exit)</td><td>Thread exit status (object signaled at exit)</td></tr>
    </table>
    <p>Pattern: the process holds what applies to the whole container; the thread holds what belongs to one path of execution. ID, base priority, execution time and exit status appear on <b>both</b>. Example: a thread suspended 3 times and resumed once has a suspension count of 2 and cannot run.</p>

    <h4>5. Multithreading</h4>
    <ul>
      <li>Threads in <b>different processes</b> may execute concurrently (on one processor they interleave and only appear to run together).</li>
      <li>Threads of the <b>same process</b> can also be placed on different processors and run at the same instant, so one program can use several processors.</li>
      <li>Threads of one process exchange information through their shared address space; threads in different processes need <b>shared memory set up between the processes</b> (a section object mapped into both) or messages.</li>
      <li>A multithreaded process is an efficient <b>server</b>: one copy of code and data, one thread per client request.</li>
    </ul>
    <p><b>Worked example.</b> Four requests arrive at time 0; each needs 2 ms of processing, a 3 ms disk read (reads may overlap) and 1 ms to reply. A single-threaded server takes 4 × (2 + 3 + 1) = <b>24 ms</b>, and the processor is idle half the time. With one thread per request, disk waits overlap other requests' processing: all four finish after <b>12 ms</b> on one processor, <b>8 ms</b> on two and <b>6 ms</b> on four.</p>

    <h4>6. The six thread states</h4>
    <svg viewBox="0 0 520 190" width="100%">
      <defs><marker id="n44a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#3d4760"/></marker></defs>
      <rect x="4" y="4" width="512" height="70" rx="10" fill="#dcf5e3" stroke="#15803d"/><text x="12" y="20" font-size="11" style="fill:#15803d">Runnable</text>
      <rect x="4" y="116" width="512" height="70" rx="10" fill="#fde1e1" stroke="#dc2626"/><text x="12" y="182" font-size="11" style="fill:#dc2626">Not runnable</text>
      <rect x="30" y="26" width="110" height="36" rx="8" fill="#ffffff" stroke="#3d4760"/><text x="85" y="49" font-size="13" text-anchor="middle" style="fill:#151c2c">Ready</text>
      <rect x="205" y="26" width="110" height="36" rx="8" fill="#ffffff" stroke="#3d4760"/><text x="260" y="49" font-size="13" text-anchor="middle" style="fill:#151c2c">Standby</text>
      <rect x="380" y="26" width="110" height="36" rx="8" fill="#ffffff" stroke="#3d4760"/><text x="435" y="49" font-size="13" text-anchor="middle" style="fill:#151c2c">Running</text>
      <rect x="30" y="128" width="110" height="36" rx="8" fill="#ffffff" stroke="#3d4760"/><text x="85" y="151" font-size="13" text-anchor="middle" style="fill:#151c2c">Transition</text>
      <rect x="205" y="128" width="110" height="36" rx="8" fill="#ffffff" stroke="#3d4760"/><text x="260" y="151" font-size="13" text-anchor="middle" style="fill:#151c2c">Waiting</text>
      <rect x="380" y="128" width="110" height="36" rx="8" fill="#ffffff" stroke="#3d4760"/><text x="435" y="151" font-size="13" text-anchor="middle" style="fill:#151c2c">Terminated</text>
      <path d="M140 44 H199" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>
      <path d="M315 44 H374" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>
      <path d="M398 62 L304 124" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>
      <path d="M205 146 H146" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>
      <path d="M60 128 V68" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>
      <path d="M240 128 L114 66" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>
      <path d="M470 62 V122" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>
      <path d="M435 26 V12 H85 V20" stroke="#3d4760" fill="none" marker-end="url(#n44a)"/>
      <text x="260" y="23" font-size="10" text-anchor="middle" style="fill:#151c2c">preempted / quantum ends</text>
    </svg>
    <ul>
      <li><b>Ready</b>: may be scheduled; the dispatcher considers ready threads in priority order.</li>
      <li><b>Standby</b>: selected to run next on a particular processor; waits until that processor is free. If its priority is high enough, the thread running there is preempted.</li>
      <li><b>Running</b>: executing until it is preempted by a higher-priority thread, uses up its quantum (both send it back to Ready), blocks or terminates.</li>
      <li><b>Waiting</b>: blocked on an event (such as I/O), waiting voluntarily to synchronize, or suspended by its environment subsystem. (Suspending one Windows thread only stops it being scheduled; its memory stays in place. It is not the swapped-out, process-wide Suspended state of section 4.1.)</li>
      <li><b>Transition</b>: ready to run but a resource is missing, typically its kernel stack paged out of memory.</li>
      <li><b>Terminated</b>: it ended itself, was ended by another thread, or the process it belongs to ended. After clean-up it is removed, or its object is kept for reuse.</li>
    </ul>
    <p>Legal moves: Ready → Standby → Running; Running → Ready, Waiting or Terminated; Waiting → Ready (resources in memory) or Transition (one is paged out); Transition → Ready once it is back. Example: Ready → Standby → Running → Waiting (disk read) → Transition (stack paged out) → Ready.</p>

    <h4>7. Support for OS subsystems</h4>
    <p>Each <b>environment subsystem</b> (Win32 today; older Windows also had POSIX) is responsible for the process and thread features of its own personality. The <b>executive</b> provides generic services to create process and thread objects and returns <b>handles</b>; the subsystem <b>interprets</b> those handles by its own rules. For CreateProcess, the Win32 subsystem has the executive create the process object and, because every Win32 process starts with one thread, its first thread; it then records the process and gives the program handles and IDs. The subsystem names the <b>calling program</b> as parent, so the new process inherits the caller's access token, quota limits, base priority and default processor affinity (not the subsystem server's). For fork, a POSIX subsystem uses the same services but copies the parent's address space and keeps the parent-child link itself: the executive records who created a process but enforces no hierarchy.</p>`,
});
