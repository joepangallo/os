// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 4.8  Mac OS X Grand Central Dispatch
   GCD as an OS-managed thread pool, blocks (closures in C), dispatch
   queues (serial, concurrent, main, global), dispatch sources, and the
   "slow work on a global queue, UI update on the main queue" pattern.
   Original teaching material, built step by step.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file
  /* ---------- shared helpers (scoped to this file) ---------- */
  // six tile colours for blocks, cycled by position (letters A, B, C ... keep them apart)
  const TILE = ['proc', 'cpu', 'mem', 'io', 'os', 'accent'];  // TILE: six colour names for the lettered block tiles; block number i gets TILE[i % 6] so neighbours look different
  const LETTERS = 'ABCDEFGHIJKL';  // LETTERS: the labels given to blocks in order (block 0 is A, block 1 is B, and so on)
  /* Schedule a list of blocks (in submission order) on a serial or a concurrent queue served by `cores`
     pool threads. Both kinds take blocks from the front (FIFO). A serial queue starts a block only when
     the previous one has finished; a concurrent queue starts the next block on whichever thread frees up
     first (lowest-numbered thread on a tie). Returns each block's thread and times, plus overlapping pairs
     of blocks that touch shared data (possible races). */
  function gcdSchedule(blocks, mode, cores) {  // gcdSchedule(blocks, mode, cores): works out when and on which pool thread each block runs; the step 5 lab uses it
    const free = Array(Math.max(1, cores)).fill(0);  // free[t] is the time at which pool thread t next becomes idle; every thread starts idle at time 0 (at least one thread)
    let prevEnd = 0;  // prevEnd remembers when the previous block finished, which is all a serial queue needs to know
    const out = blocks.map((b, i) => {  // goes through the blocks in submission order, giving each one a thread (lane) and a start time
      let lane = 0, start;  // lane is the pool thread chosen for this block (thread 0 unless a better one is found); start is filled in below
      if (mode === 'serial') start = prevEnd;  // serial queue: a block may start only when the one before it has finished
      else { for (let j = 1; j < free.length; j++) if (free[j] < free[lane]) lane = j; start = free[lane]; }  // concurrent queue: pick the thread that frees up earliest (the lowest number wins a tie) and start the block then
      const end = start + b.dur;  // the block ends after its own running time (dur, in milliseconds)
      free[lane] = end; prevEnd = end;  // marks the chosen thread busy until this block ends, and records the end for the next serial block
      return { i, b, lane, start, end };  // one result row per block: its index, the block itself, its thread and its start and end times
    });  // ends the per-block map
    const total = blocks.reduce((a, b) => a + b.dur, 0);  // total: the sum of all running times, the time one thread alone would need
    const makespan = out.reduce((m, o) => Math.max(m, o.end), 0);  // makespan: when the last block finishes, which is how long the whole job takes on this queue
    const races = [];  // races collects pairs of blocks that could interfere with each other
    for (let a = 0; a < out.length; a++) for (let c = a + 1; c < out.length; c++) {  // checks every pair of blocks once (a before c) to see whether they overlap in time
      const A = out[a], B = out[c];  // A and B are the two scheduled blocks being compared
      if (A.b.sh && B.b.sh && A.start < B.end && B.start < A.end) races.push([a, c]);  // a race is possible when both blocks touch shared data (sh) and their running times overlap
    }  // ends the pair check
    const finishOrder = out.slice().sort((x, y) => x.end - y.end || x.i - y.i).map((o) => o.i);  // finishOrder: the block indexes sorted by finish time (ties broken by submission order), for the finish-order display
    const events = [...new Set(out.flatMap((o) => [o.start, o.end]))].sort((x, y) => x - y);  // events: every distinct start or end time, sorted, so the lab can step through the moments where something changes
    return { out, total, makespan, races, finishOrder, events };  // hands all of these results back to the caller as one object
  }  // ends gcdSchedule()

  Guide.section({  // registers section 4.8 with the guide's shell, which builds its slides, glossary and quizzes from this object
    id: '4.8',  // id: the section number the shell uses in links, saved progress and the style prefix .sec-4-8
    title: 'Mac OS X Grand Central Dispatch',  // title: the full section name shown at the top of every step
    short: 'Grand Central Dispatch',  // short: a shorter name for the table of contents and other tight spots
    summary: 'Programs hand GCD blocks of work on dispatch queues; the OS runs them on a thread pool sized to the cores.',  // summary: the one-sentence description shown on the chapter overview page
    objectives: [  // objectives: what a student should be able to do after this section, listed on the chapter page
      'Explain what problem Grand Central Dispatch solves and how its OS-managed thread pool differs from creating threads by hand.',  // objective 1: explain the problem GCD solves and how its OS-managed pool differs from hand-made threads
      'Read and write simple blocks, and predict which values a block captures.',  // objective 2: read and write blocks and predict which values they capture
      'Tell serial, concurrent, main and global dispatch queues apart and predict the orders in which their blocks can run and finish.',  // objective 3: tell the four kinds of dispatch queue apart and predict run and finish orders
      'Use the dispatch_async pattern to move slow work off the main thread and hand the result back to the main queue.',  // objective 4: use dispatch_async to move slow work off the main thread and return to the main queue
      'Describe what a dispatch source does and name events it can watch.',  // objective 5: describe dispatch sources and the events they watch
    ],  // closes the objectives list
    terms: [  // terms: the glossary entries for this section; the shell links matching words in the text to them
      ['Grand Central Dispatch (GCD)', 'Apple’s system for running work in parallel, first shipped in Mac OS X 10.6 (Snow Leopard). A program describes units of work as blocks placed on dispatch queues, and the system runs them on a pool of threads it manages.'],  // glossary entry: defines Grand Central Dispatch and when it first shipped
      ['Thread pool', 'A group of worker threads that are created once and reused. Work is handed to the pool and an idle worker runs it, so no thread has to be created and destroyed for each piece of work.'],  // glossary entry: defines a thread pool of reusable worker threads
      ['Degree of concurrency', 'How many pieces of work the hardware can truly run at the same moment. On an ordinary machine it is about the number of cores.'],  // glossary entry: defines degree of concurrency (roughly the number of cores)
      ['Task (GCD)', 'In GCD, a unit of work: a self-contained piece of a job that can be done on its own, such as analysing one document. (Not the same meaning as the process-as-task of section 4.1 or the Linux task of section 4.6.)'],  // glossary entry: defines a task in the GCD sense and warns it differs from earlier uses of the word
      ['Block (GCD)', 'An extension to C, Objective-C and C++ for writing an unnamed piece of code inline, marked by a caret, as in ^{ ... }. A block can use variables from the code around it and can be stored or passed around like a value. GCD uses blocks to describe tasks.'],  // glossary entry: defines a block, the caret syntax for inline unnamed code
      ['Anonymous function', 'A function written inline without a name, usually so it can be handed straight to another function.'],  // glossary entry: defines an anonymous function
      ['Closure', 'A piece of code packaged together with the variables it uses from the surrounding code, so it can run later, somewhere else, and still see those values.'],  // glossary entry: defines a closure (code bundled with the variables it uses)
      ['Capture', 'What a block does with an outside variable it uses: it keeps its own copy of the value (or, for a variable marked __block, a shared link to it) for when the block runs later.'],  // glossary entry: defines capture, including the shared link a __block variable gets
      ['Dispatch queue', 'A first-in, first-out waiting line of blocks, kept as a lightweight data structure in the app’s own memory, so adding a block is far cheaper than creating a thread. GCD takes blocks from the front and runs them on threads from its pool.'],  // glossary entry: defines a dispatch queue and why adding to one is cheap
      ['FIFO (first in, first out)', 'An ordering rule: items leave a line in the same order in which they joined it.'],  // glossary entry: defines FIFO ordering
      ['Serial queue', 'A dispatch queue that runs one block at a time: the next block starts only after the previous one has finished. It is often used instead of a lock to protect shared data.'],  // glossary entry: defines a serial queue and its use in place of a lock
      ['Concurrent queue', 'A dispatch queue that starts its blocks in first-in, first-out order but lets several of them run at the same time on different threads, so they may finish in any order.'],  // glossary entry: defines a concurrent queue, which starts in order but may finish in any order
      ['Main queue', 'The serial dispatch queue whose blocks run on the application’s main thread. Work that updates the user interface is sent here.'],  // glossary entry: defines the main queue that runs on the main thread
      ['Main thread', 'The first thread of an application (also called the UI thread): it runs the event loop that handles clicks, key presses and drawing, and it is the thread that updates the window. While it is busy, the app looks frozen.'],  // glossary entry: defines the main thread (UI thread) and why a busy one freezes the app
      ['Global queue', 'One of the concurrent dispatch queues that the system provides to every application, at several priority levels: high, default and low (plus background, added in Mac OS X 10.7). Newer code usually picks one by quality-of-service class instead.'],  // glossary entry: defines the global queues and their priority levels
      ['dispatch_async', 'The GCD function that adds a block to a queue and returns immediately, without waiting for the block to run.'],  // glossary entry: defines dispatch_async, which queues a block and returns at once
      ['Dispatch source', 'A GCD object that watches for a system event, such as a timer firing, a signal arriving or a file descriptor becoming readable, and submits a handler block to a queue when the event happens. Events that arrive before the handler has run are merged into one run.'],  // glossary entry: defines a dispatch source and how waiting events merge into one run
      ['Oversubscription', 'Having more runnable threads than cores, so the threads must take turns; the extra switching adds cost without adding speed.'],  // glossary entry: defines oversubscription (more runnable threads than cores)
    ],  // closes the terms list

    /* Scoped CSS: every selector starts with .sec-4-8 */
    css: ` /* css: this section's own style rules, written as one text string that the shell adds to the page */
      /* shell workaround: the header eyebrow is white-space:nowrap, and with this long section title its min-content
         width exceeded a phone screen, which widened the whole page in narrow mode. Letting the title wrap fixes it. */
      .sec-4-8 .step-eyebrow > span:nth-child(2) { white-space:normal; min-width:0; line-height:1.3; } /* lets the section title in the step header wrap onto two lines so it fits a phone screen */
      .sec-4-8 .tile { display:inline-grid; place-items:center; min-width:34px; height:30px; padding:0 6px; border-radius:8px; border:2px solid var(--line-2); font-weight:800; font-size:14px; background:var(--panel-2); } /* a tile is a small rounded box with a bold letter; it stands for one block in the diagrams */
      .sec-4-8 .tile.proc { border-color:var(--proc); background:var(--proc-bg); } .sec-4-8 .tile.cpu { border-color:var(--cpu); background:var(--cpu-bg); } /* proc and cpu tiles take the process and processor colours for their border and fill */
      .sec-4-8 .tile.mem { border-color:var(--mem); background:var(--mem-bg); } .sec-4-8 .tile.io { border-color:var(--io); background:var(--io-bg); } /* mem and io tiles take the memory and input/output colours */
      .sec-4-8 .tile.os { border-color:var(--os); background:var(--os-bg); } .sec-4-8 .tile.accent { border-color:var(--accent); background:var(--accent-bg); } /* os and accent tiles take the operating-system and highlight colours */
      .sec-4-8 .ctl { display:flex; align-items:center; gap:8px; flex-wrap:wrap; } /* .ctl lays out a row of controls (labels, buttons, sliders) that wraps when space runs out */
      .sec-4-8 .ctl > .lbl { font-size:14px; font-weight:700; color:var(--ink-2); } /* .lbl is the small bold grey label in front of a control, such as "This Mac has" */
      .sec-4-8 .cap { background:var(--panel-2); border:1px solid var(--line); border-radius:10px; padding:9px 12px; font-size:15px; line-height:1.45; } /* .cap is the pale caption box where a demo explains what just happened */
      .sec-4-8 .pipe { display:flex; flex-direction:column; } /* .pipe stacks the four layer buttons of step 1 from top to bottom */
      .sec-4-8 .pipe-btn { display:block; width:100%; text-align:left; border:2px solid var(--c); border-radius:12px; padding:7px 11px; background:var(--panel); cursor:pointer; color:var(--ink); font:inherit; } /* a layer button in step 1: full width, coloured border set by the --c variable, looks clickable */
      .sec-4-8 .pipe-btn:hover { background:var(--cb); } /* hovering a layer button fills it with its pale colour so the student sees it can be clicked */
      .sec-4-8 .pipe-btn.on { background:var(--cb); box-shadow:0 0 0 3px color-mix(in srgb, var(--c) 30%, transparent); } /* the selected layer button stays filled and gets a soft glow ring around it */
      .sec-4-8 .pipe-btn .nm { font-weight:800; font-size:16px; } /* .nm is the layer name in bold on a layer button */
      .sec-4-8 .pipe-btn .sb { font-size:13.5px; color:var(--ink-2); line-height:1.3; margin-top:2px; } /* .sb is the smaller grey line under the layer name that says what that layer does */
      .sec-4-8 .strat { padding:10px 11px; } .sec-4-8 .strat > .meter { flex:none; } /* a strategy card in step 2: slightly tighter padding, and its bookkeeping meter keeps its height */
      .sec-4-8 .strat.best { border-color:var(--ok); box-shadow:0 0 0 2px color-mix(in srgb, var(--ok) 30%, transparent); } /* the fastest strategy card gets a green border and glow */
      .sec-4-8 pre.mini { flex:none; margin:0; font-family:var(--mono); font-size:12.5px; line-height:1.4; background:var(--panel-3); border-radius:8px; padding:5px 7px; white-space:pre-wrap; min-height:3.6em; } /* .mini is the small code box on each strategy card; min-height keeps the three cards lined up */
      .sec-4-8 .dots { flex:none; display:flex; flex-wrap:wrap; gap:2px 3px; align-content:flex-start; align-items:center; height:34px; overflow:hidden; } /* .dots is the fixed-height area filled with one dot per thread; extra dots are cut off instead of growing the card */
      .sec-4-8 .dots > i { width:8px; height:8px; border-radius:50%; background:var(--thread); display:block; } /* each dot is a small circle in the thread colour */
      .sec-4-8 .coresrow { display:flex; gap:4px; } /* .coresrow is the strip of little boxes, one per core, on each strategy card */
      .sec-4-8 .coresrow > i { flex:1; height:16px; border-radius:4px; border:1.5px solid var(--line-2); background:var(--panel-3); display:block; } /* each core box shares the width equally and is grey while the core is idle */
      .sec-4-8 .coresrow > i.on { background:var(--cpu-bg); border-color:var(--cpu); } /* a busy core box turns the processor colour */
      .sec-4-8 .kps { display:grid; grid-template-columns:1fr 1fr; gap:6px; } /* .kps arranges the four key numbers on a strategy card in a two-column grid */
      .sec-4-8 .kp { background:var(--panel-2); border:1px solid var(--line); border-radius:8px; padding:2px 8px; } /* .kp is one key-number box on a strategy card (for example THREADS or STACK MEMORY), with a thin border */
      .sec-4-8 .kp b { font-size:16px; } /* the number inside a key-number box is a little larger so it stands out from its label */
      .sec-4-8 .corebar { display:grid; grid-template-columns:118px minmax(0,1fr); align-items:center; gap:8px; } /* .corebar puts the "CORES BUSY" label in a fixed 118px column and the core boxes beside it */
      .sec-4-8 .toks { display:flex; flex-wrap:wrap; gap:6px; align-items:center; font-family:var(--mono); } /* .toks lays out the clickable pieces of the block declaration in step 3 in a wrapping row, in code font */
      .sec-4-8 .tok { font:inherit; font-family:var(--mono); font-size:16px; font-weight:700; padding:6px 9px; border-radius:8px; border:2px dashed var(--line-2); background:var(--panel); color:var(--ink); cursor:pointer; } /* .tok is one clickable piece of that declaration: code font, dashed border, pointer cursor */
      .sec-4-8 .tok:hover { border-color:var(--chc); } /* hovering a piece turns its dashed border the chapter colour to show it can be clicked */
      .sec-4-8 .tok.on { border-style:solid; border-color:var(--thread); background:var(--thread-bg); } /* the selected piece gets a solid border and the thread colour, matching the explanation below it */
      .sec-4-8 .tok.plain { border:0; background:none; cursor:default; padding:6px 0; } /* .tok.plain is the final semicolon: shown in the row but not clickable, so it has no border or pointer */
      .sec-4-8 .capbox { text-align:left; min-height:82px; padding:6px 10px; } /* .capbox is the box showing a value in the capture demo; min-height stops it resizing as text changes */
      .sec-4-8 .capbox .big { font-size:28px; } /* .big inside that box shows the value of x in large digits */
      .sec-4-8 .tile.sm { min-width:26px; height:24px; font-size:12.5px; border-radius:6px; padding:0 4px; } /* .tile.sm is a smaller tile used inside the queue lines and the started/finished rows */
      .sec-4-8 .qrow2 { display:grid; grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) auto minmax(0,.9fr); align-items:center; gap:10px; width:100%; text-align:left; padding:5px 10px; border:2px solid var(--line); border-radius:12px; background:var(--panel); cursor:pointer; color:var(--ink); font:inherit; } /* .qrow2 is one clickable queue row in step 4: four columns for name, waiting blocks, arrow and destination */
      .sec-4-8 .qrow2:hover { border-color:var(--chc); } /* hovering a queue row turns its border the chapter colour */
      .sec-4-8 .qrow2.on { border-color:var(--chc); background:color-mix(in srgb, var(--chc) 8%, var(--panel)); } /* the selected queue row keeps the chapter-colour border and a faint tint of that colour */
      .sec-4-8 .qname { display:flex; flex-direction:column; align-items:flex-start; gap:2px; font-size:15px; } /* .qname stacks a queue's name above its serial/concurrent chip */
      .sec-4-8 .qline { display:flex; flex-direction:row-reverse; justify-content:flex-start; gap:4px; padding:4px 6px; border:1.5px dashed var(--line-2); border-radius:8px; min-height:34px; align-items:center; } /* .qline draws a queue as a dashed box of tiles; row-reverse puts the first block on the right, at the front */
      .sec-4-8 .qarr { font-weight:900; color:var(--muted); } /* .qarr is the grey arrow from a queue to whoever runs its blocks */
      .sec-4-8 .qto { font-size:13.5px; padding:4px 8px; } /* .qto is the small box naming who runs the blocks (main thread or thread pool) */
      .sec-4-8 .srcq { flex:1; display:flex; gap:5px; align-items:center; min-height:40px; padding:4px 8px; border:1.5px dashed var(--line-2); border-radius:10px; } /* .srcq is the dashed box that shows queue q in the dispatch-sources demo; it stretches to fill the row */
      .sec-4-8 .labgrid { display:grid; grid-template-columns:minmax(0, 2.05fr) minmax(0, 1fr); gap:18px; } /* .labgrid splits the lab into a wide left side (controls and timeline) and a slimmer right side (goals, clock) */
      .sec-4-8 .labgrid > * { min-width:0; min-height:0; } /* lets both lab columns shrink below their content size so nothing pushes past the edge of the slide */
      .sec-4-8 ol.goals { list-style:none; padding:0 !important; margin:0; display:flex; flex-direction:column; gap:6px; } /* ol.goals is the lab's goal checklist: no numbers from the browser, items stacked with small gaps */
      .sec-4-8 ol.goals li { display:grid; grid-template-columns:22px minmax(0,1fr); gap:6px; font-size:14px; line-height:1.35; margin:0; } /* each goal item is a two-column grid: a round check mark on the left, the goal text on the right */
      .sec-4-8 .gck { width:18px; height:18px; margin-top:1px; border-radius:50%; border:2px solid var(--line-2); display:grid; place-items:center; font-size:12px; font-weight:900; color:var(--panel); } /* .gck is the empty round check circle in front of each goal */
      .sec-4-8 ol.goals li.ok .gck { background:var(--ok); border-color:var(--ok); } /* when a goal is met (class ok), its circle fills green */
      .sec-4-8 ol.goals li.ok .gck::after { content:'✓'; } /* and a tick character appears inside that green circle */
      .sec-4-8 ol.goals li.ok > span:last-child { color:var(--ok); } /* and the goal text turns green too */
      .sec-4-8 .row.ord { gap:3px; min-height:26px; flex-wrap:wrap; } /* .row.ord is the row of small tiles showing the started or finished order in the lab; it wraps if needed */
      .sec-4-8 .cand { border:2px solid var(--line); border-radius:12px; padding:7px 10px; background:var(--panel); } /* .cand is one candidate print order in the predict step, drawn as a rounded box */
      .sec-4-8 .cand.right { border-color:var(--ok); background:var(--ok-bg); } /* after checking, a correctly judged candidate turns green */
      .sec-4-8 .cand.wrong { border-color:var(--bad); background:var(--bad-bg); } /* after checking, a wrongly judged candidate turns red */
      .sec-4-8 .ordtxt { font-family:var(--mono); font-size:20px; font-weight:800; letter-spacing:.06em; } /* .ordtxt shows a candidate order such as "A B C" in large, spaced code font */
      .sec-4-8 .qpics { display:flex; flex-direction:column; gap:5px; padding:6px 10px; } /* .qpics is the small panel in the predict step that pictures each queue and who serves it */
      .sec-4-8 .qp { display:grid; grid-template-columns:132px 88px 14px minmax(0,1fr); align-items:center; gap:8px; font-size:14px; line-height:1.3; } /* .qp is one row of that panel: queue name, its blocks, an arrow, then who runs them */
      .sec-4-8 .qp .qline { min-height:30px; padding:2px 5px; } /* a queue line inside that panel is a little shorter than the ones in step 4 */
      .sec-4-8 .qp .nmq { display:flex; align-items:center; gap:5px; font-family:var(--mono); font-weight:800; } /* .nmq shows the queue's name in bold code font next to its kind chip */
      .sec-4-8 .win { position:relative; border:1px solid var(--line-2); border-radius:12px; overflow:hidden; background:var(--panel); box-shadow:var(--shadow); } /* .win draws the pretend application window in step 7, with rounded corners and a shadow */
      .sec-4-8 .win-bar { display:flex; align-items:center; gap:6px; padding:6px 10px; background:var(--panel-3); border-bottom:1px solid var(--line); } /* .win-bar is the window's title bar, a grey strip along the top */
      .sec-4-8 .win-bar > i { width:10px; height:10px; border-radius:50%; background:var(--line-2); display:block; } /* the three small circles in the title bar imitate the close, minimise and zoom buttons of a Mac window */
      .sec-4-8 .win-bar > span { margin-left:8px; color:var(--ink-2); } /* the title text in the bar sits a little right of those circles */
      .sec-4-8 .win-body { padding:10px 12px; display:flex; flex-direction:column; gap:7px; } /* .win-body holds the document lines, the status text and the progress bar inside the window */
      .sec-4-8 .doclines { display:flex; flex-direction:column; gap:6px; } /* .doclines stacks the grey bars that stand in for lines of text in the document */
      .sec-4-8 .doclines .dl { height:8px; border-radius:4px; background:var(--panel-3); transition:width .3s; } /* each grey bar is one pretend text line; its width animates when a scroll changes it */
      .sec-4-8 .freeze { position:absolute; inset:31px 0 0 0; display:none; flex-direction:column; align-items:center; justify-content:center; gap:8px; background:color-mix(in srgb, var(--panel) 84%, transparent); color:var(--bad); pointer-events:none; } /* .freeze is the "Not responding" cover over the window body; it is hidden until the main thread is stuck */
      .sec-4-8 .spin { width:34px; height:34px; border-radius:50%; background:conic-gradient(var(--intr), var(--warn), var(--ok), var(--cpu), var(--os), var(--intr)); animation:sec-4-8-spin 1s linear infinite; } /* .spin is the rainbow spinning wait cursor shown on the frozen window */
      @keyframes sec-4-8-spin { to { transform:rotate(360deg); } } /* the spin animation: one full turn, repeated forever */
      .sec-4-8 .lane { display:grid; grid-template-columns:110px minmax(0,1fr); align-items:center; gap:8px; font-size:14.5px; } /* .lane is one row in the step 7 status card: a label on the left, what that thread or queue is doing on the right */
      .sec-4-8 .lane > .chip { justify-self:start; } /* keeps each label chip at its natural width instead of stretching across its column */
      .sec-4-8 .pipe-arrow { text-align:center; color:var(--muted); font-weight:900; font-size:15px; line-height:1; padding:3px 0; } /* .pipe-arrow is the small down arrow between the layer buttons in step 1 */
    `,  // end of the CSS text

    steps: [  // steps: the list of slides in this section, shown in this order
      /* ---------------- 1. Big Picture: describe the work, not the threads ---------------- */
      {  // step 1 (story): the big picture of what GCD does and who does which job
        title: 'Describe the work, let the system run it',  // title shown at the top of step 1
        kind: 'story',  // kind 'story' sets the label shown in the step header
        render(el, ctx) {  // render(el, ctx) runs when the student opens step 1; el is the empty step area, ctx holds the shell's helpers
          const { h } = ctx;  // h(tag, props, ...children) is the shell's shortcut for building a page element
          const LAYERS = [  // LAYERS: the four layers of the diagram, from the programmer's code down to the cores
            { key: 'code', nm: 'Your code', sb: 'writes each task as a block: ^{ … }', who: 'you', c: 'proc',  // layer 1, your code: name, subtitle, who is responsible, and colour (proc)
              head: 'You: find the work and wrap it up',  // heading shown when layer 1 is selected
              body: '<p>You look for pieces of work that could happen at the same time (resize each photo, analyse a document, save a file) and wrap each piece in a <span class="t" data-t="Block (GCD)">block</span>. Then you choose a queue and hand the block over.</p>',  // explanation of layer 1: find work that can run at once and wrap each piece in a block
              eg: 'In code: <code>dispatch_async(queue, ^{ resize(photo); });</code> hands one block to a queue.' },  // code example for layer 1: one dispatch_async call handing a block to a queue
            { key: 'queue', nm: 'Dispatch queues', sb: 'hold blocks in first-in, first-out order', who: 'handoff', c: 'os',  // layer 2, dispatch queues: shared by you (who picks) and GCD (who empties)
              head: 'Queues: the waiting lines',  // heading shown when layer 2 is selected
              body: '<p>A <span class="t">dispatch queue</span> is a waiting line of blocks; they leave it in the order they arrived. Some queues let one block run at a time, others let several run at once. You pick the queue; GCD empties it.</p>',  // explanation of layer 2: a queue is a first-in, first-out line of blocks
              eg: 'Examples: the main queue (for the user interface) and the global queues (shared by the whole app).' },  // examples for layer 2: the main queue and the global queues
            { key: 'pool', nm: 'Thread pool', sb: 'worker threads that GCD creates and reuses', who: 'gcd', c: 'thread',  // layer 3, the thread pool, run by GCD and drawn in the thread colour
              head: 'GCD: the pool of workers',  // heading shown when layer 3 is selected
              body: '<p>GCD keeps a small set of worker threads, about one per core, and reuses them for block after block. If some are stuck waiting for I/O, GCD adds a few more so the cores stay busy, and it retires idle ones. You never create, count or destroy these threads.</p>',  // explanation of layer 3: about one reused worker per core, with extras only when some are waiting on I/O
              eg: 'Example: on a 4-core Mac, about 4 workers take turns emptying all of the app’s queues.' },  // example for layer 3: four workers on a four-core Mac
            { key: 'cores', nm: 'Cores', sb: 'the hardware that actually runs threads', who: 'gcd', c: 'cpu',  // layer 4, the cores, the hardware itself
              head: 'Hardware: as many cores as the machine has',  // heading shown when layer 4 is selected
              body: '<p>The kernel runs the pool’s threads on the cores. The same program uses 2 cores on a 2-core laptop and 10 on a 10-core desktop without any change, because the pool follows the hardware, not a number the programmer guessed.</p>',  // explanation of layer 4: the same program uses however many cores the machine has
              eg: 'The kernel schedules the pool’s threads like any other threads, as earlier in this chapter.' },  // note for layer 4: the kernel schedules pool threads like any other thread
          ];  // closes the LAYERS list
          let cur = 0;  // cur is the index of the layer the student has selected; layer 1 is shown first
          const detail = h('div', { class: 'card white stack gap-s', style: { minHeight: '220px' } });  // detail is the white card on the right that explains the selected layer
          const btns = LAYERS.map((L, i) => h('button', { type: 'button', class: 'pipe-btn', style: { '--c': `var(--${L.c})`, '--cb': `var(--${L.c}-bg)` }, onclick: () => { cur = i; paint(); } },  // builds one button per layer; clicking it selects that layer and repaints; --c and --cb carry the layer colours into the CSS
            h('div', { class: 'row nw', style: { justifyContent: 'space-between', gap: '6px' } },  // top line of the button: the layer name on the left and a "who does this" chip on the right
              h('span', { class: 'nm' }, L.nm),  // the layer name in bold
              h('span', { class: 'chip ' + (L.who === 'you' ? 'proc' : L.who === 'gcd' ? 'os' : 'accent') }, L.who === 'you' ? 'you' : L.who === 'gcd' ? 'GCD + OS' : 'you + GCD')),  // chip saying who is responsible: "you", "GCD + OS", or "you + GCD" for the queues, each in its own colour
            h('div', { class: 'sb' }, L.sb)));  // the short subtitle under the layer name; closes the button
          const pipe = h('div', { class: 'pipe' });  // pipe is the column that will hold the four layer buttons
          btns.forEach((b, i) => { if (i) pipe.append(h('div', { class: 'pipe-arrow', 'aria-hidden': 'true' }, '↓')); pipe.append(b); });  // adds each button to the column, with a down arrow between neighbours to show the flow from code to cores
          function paint() {  // paint() redraws the highlight and the detail card for the selected layer; it runs on every click
            btns.forEach((b, i) => b.classList.toggle('on', i === cur));  // highlights only the selected button
            const L = LAYERS[cur];  // L is the selected layer's data
            detail.replaceChildren(  // replaces the contents of the detail card with the selected layer's text
              h('h4', { class: 'm0' }, `Layer ${cur + 1} of 4 · click the layers`),  // small heading: which layer this is, plus a reminder to click the others
              h('h3', { class: 'm0' }, L.head),  // the layer's heading
              ctx.frag(L.body),  // the layer's explanation; ctx.frag turns an HTML string into page elements
              h('div', { class: 'small muted', html: L.eg }));  // the layer's example, in small grey text; closes the detail card contents
          }  // ends paint()
          paint();  // draws the first layer once when the step opens
          el.append(h('div', { class: 'split l fill' },  // builds the step: a two-column layout, with text on the left and the diagram on the right
            h('div', { class: 'stack' },  // left column: the reading text, stacked
              h('p', { class: 'lead m0', html: 'A modern Mac has several cores. To use them, a program must split its work into pieces that can run at the same time, and <i>someone</i> has to create threads, hand them work and clean up afterwards.' }),  // opening paragraph: using several cores means splitting work and managing threads
              h('p', { class: 'm0', html: '<span class="t">Grand Central Dispatch (GCD)</span>, introduced in Mac OS X 10.6 (Snow Leopard), moves that job into the operating system. You describe <span class="t" data-t="Task (GCD)">tasks</span>, not threads, and GCD maps them onto a <span class="t">thread pool</span> sized to the <span class="t">degree of concurrency</span> the hardware offers.' }),  // paragraph: GCD moves thread management into the OS; you describe tasks, it maps them to a pool
              h('div', { class: 'callout why m0', 'data-label': 'What GCD adds to an old idea', html: 'Thread pools are not new: server programs have used them for decades, and Windows has one too. GCD adds a language feature, <b>blocks</b>, for writing a task right where it belongs, plus <b>queues</b> that keep tasks in order. A whole unit of work can be split off without scrambling the order and dependencies between its parts.' }),  // callout: thread pools are old; GCD adds blocks and queues on top
              h('p', { class: 'small muted m0', html: 'Bridge: section 4.3 showed that extra cores help only when work is split into parallel pieces. GCD is the Mac OS X answer to the question “who manages the threads that run those pieces?”' })),  // small bridge note linking back to section 4.3: extra cores only help when work is split up; closes the left column
            h('div', { class: 'stack' },  // right column: the layer diagram and an analogy, stacked
              h('div', { class: 'card', style: { display: 'grid', gridTemplateColumns: ctx.narrow ? '1fr' : 'minmax(0, 5fr) minmax(0, 6fr)', gap: '14px', alignItems: 'start' } }, pipe, detail),  // card holding the layer buttons beside the detail card; on a phone-width screen they stack in one column instead
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy: a restaurant kitchen', html: 'Waiters (your code) do not hire a cook for every dish. They clip tickets (blocks) onto a rail (a queue); the kitchen manager (GCD) keeps about one cook (thread) per stove (core), and each free cook takes the next ticket. A ticket carries all it needs, just as a block carries its data.' }))));  // callout: the restaurant-kitchen analogy (tickets on a rail, about one cook per stove); closes the whole layout
        },  // ends render() for step 1
      },  // ends step 1

      /* ---------------- 2. Compare: threads by hand vs tasks for GCD ---------------- */
      {  // step 2 (compare): three ways to run many small tasks, side by side
        title: 'Why not just create the threads yourself?',  // title shown at the top of step 2
        kind: 'compare',  // kind 'compare' sets the header label for this step
        render(el, ctx) {  // render(el, ctx) builds step 2 when the student opens it
          const { h } = ctx;  // takes the element builder h out of ctx
          const W = 0.1, C = 0.04, STACK = 0.5; // ms of work per task, ms to create + destroy a thread, MB of stack per thread
          const STRATS = [  // STRATS: the three strategies being compared, each with the number of threads it creates for T tasks
            { key: 'each', nm: 'One thread per task', code: 'pthread_create × N   // N new threads\npthread_join × N     // wait, destroy', threads: (T) => T },  // strategy 1: a brand-new thread for every task, so T tasks make T threads
            { key: 'pool', nm: 'Hand-made pool of 4', code: 'make 4 threads       // guessed once\n+ queue, locks, exit // all your code', threads: (T) => Math.min(4, T) },  // strategy 2: a pool of 4 threads chosen once by the programmer, never more than 4 whatever the machine
            { key: 'gcd', nm: 'GCD', code: 'dispatch_async(q,    // per task: a cheap\n  ^{ work(i); });    // enqueue, no thread', threads: (T, cores) => Math.min(cores, T) },  // strategy 3: GCD, whose pool has one thread per core, never more threads than tasks
          ];  // closes the STRATS list
          let T = 32, cores = 8;  // T is the number of tasks and cores the number of cores; the slider and core buttons change them
          const model = (st) => {  // model(st) works out the numbers shown on one strategy's card for the current T and cores
            const n = st.threads(T, cores), P = Math.min(n, cores);  // n = threads created; P = cores that can actually be busy (never more than the threads)
            const cpu = T * W + n * C;  // cpu = total CPU time: the real work of every task plus the cost of creating and destroying n threads
            return { n, P, finish: cpu / P, over: (n * C) / cpu, mem: n * STACK, perCore: n / cores };  // finish time = CPU time shared over the busy cores; over = share spent on thread bookkeeping; mem = stack for n threads
          };  // ends model()
          const cards = STRATS.map((st) => {  // builds one card per strategy and keeps references to the parts paint() will update
            const kp = (lbl) => { const v = h('b', { class: 'num' }); return [v, h('div', { class: 'kp' }, h('div', { class: 'xs muted b' }, lbl), v)]; };  // kp(lbl) makes one key-number box with a label and returns both the number element and the box
            const [tN, kN] = kp('THREADS'), [tMem, kMem] = kp('STACK MEMORY'), [tPer, kPer] = kp('THREADS PER CORE'), [tFin, kFin] = kp('FINISHES AFTER');  // the four key numbers on each card: threads, stack memory, threads per core and finish time
            const c = { st, dots: h('div', { class: 'dots' }), coresRow: h('div', { class: 'coresrow' }), coresLbl: h('div', { class: 'xs muted b' }),  // c collects the card's changing parts: the thread dots, the core boxes and their label
              tN, tMem, tPer, tFin, meter: h('div', { class: 'meter' }, h('i')), tOver: h('span', { class: 'xs b' }), badge: h('span') };  // ...the four numbers, the bookkeeping meter bar, its percentage text, and the fastest/slower badge
            c.el = h('div', { class: 'card white stack gap-s strat' },  // the card itself, assembled from top to bottom
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('span', { class: 'b' }, st.nm), c.badge),  // top line: the strategy name on the left and its badge on the right
              h('pre', { class: 'mini' }, st.code),  // the small code sketch of how this strategy is programmed
              h('div', { class: 'xs muted b' }, 'THREADS THAT EXIST (ONE DOT EACH)'), c.dots,  // label and area for one dot per thread that exists
              h('div', { class: 'corebar' }, c.coresLbl, c.coresRow),  // the "CORES BUSY" label next to the row of core boxes
              h('div', { class: 'kps' }, kN, kMem, kPer, kFin),  // the grid of four key numbers
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted b' }, 'CPU TIME SPENT ON THREAD BOOKKEEPING'), c.tOver),  // label and percentage for CPU time lost to creating and destroying threads
              c.meter);  // the meter bar under that label; closes the card
            return c;  // hands the card's parts back so paint() can reach them
          });  // ends the card builder
          const verdict = h('div', { class: 'cap' });  // verdict is the caption box under the cards that explains the result in words
          const fmtMem = (mb) => (mb >= 1 ? ctx.util.fmt(mb, 1) + ' MB' : Math.round(mb * 1024) + ' KB');  // fmtMem(mb) writes a memory size as MB, or as KB when it is under 1 MB
          function paint() {  // paint() recalculates every card and the verdict; it runs whenever the tasks slider or core buttons change
            const ms = cards.map((c) => model(c.st));  // ms holds the model results for the three strategies, in card order
            const best = Math.min(...ms.map((m) => m.finish));  // best is the shortest finish time among them
            cards.forEach((c, k) => {  // updates each card with its own results
              const m = ms[k];  // m is this card's result
              const shown = m.n > 90 ? 72 : m.n; // leave room on the last row for the "+N more" label
              const dots = ctx.util.range(shown).map(() => h('i'));  // builds one dot per thread
              if (m.n > shown) dots.push(h('span', { class: 'xs b', style: { lineHeight: '1', marginLeft: '3px' } }, '+' + (m.n - shown) + ' more'));  // if some dots were left out, adds a "+N more" label after the last one
              c.dots.replaceChildren(...dots);  // puts the dots into the card, replacing the old ones
              c.coresRow.replaceChildren(...ctx.util.range(cores).map((j) => h('i', { class: j < m.P ? 'on' : '' })));  // redraws one box per core, lighting up as many as can be busy
              c.coresLbl.textContent = `CORES BUSY: ${m.P} / ${cores}`;  // label above the core boxes: how many cores are busy out of the total
              c.tN.textContent = m.n;  // writes the number of threads
              c.tMem.textContent = fmtMem(m.mem);  // writes the stack memory those threads reserve
              c.tPer.textContent = ctx.util.fmt(m.perCore, 2);  // writes threads per core, to two decimals
              c.tPer.style.color = m.perCore > 1 ? 'var(--bad)' : '';  // turns threads per core red when it is above 1, which means threads must take turns (oversubscription)
              c.tFin.textContent = ctx.util.fmt(m.finish, 2) + ' ms';  // writes the finish time in milliseconds
              c.meter.firstChild.style.width = Math.max(1, m.over * 100) + '%';  // sets the meter bar's length to the bookkeeping share (at least 1% so it stays visible)
              c.meter.firstChild.style.background = m.over > 0.15 ? 'var(--bad)' : m.over > 0.05 ? 'var(--warn)' : 'var(--ok)';  // colours the meter: green under 5%, amber up to 15%, red above that
              c.tOver.textContent = ctx.util.fmt(m.over * 100, 1) + '%';  // writes the bookkeeping share as a percentage
              const fastest = Math.abs(m.finish - best) < 1e-9;  // fastest is true for the card whose finish time equals the best one (allowing a tiny rounding error)
              c.badge.className = 'chip ' + (fastest ? 'ok' : 'warn');  // the badge is green for the fastest card and amber for the others
              const pct = (m.finish / best - 1) * 100;  // pct: how much longer this strategy takes than the fastest, as a percentage
              c.badge.textContent = fastest ? 'fastest' : pct < 1 ? '≈ same time' : '+' + Math.round(pct) + '% time';  // badge text: "fastest", "about the same time" when under 1% slower, or "+N% time"
              c.el.classList.toggle('best', fastest);  // gives the fastest card its green outline
            });  // ends the per-card update
            const [a, b] = ms;  // a and b are the results for strategy 1 (one thread per task) and strategy 2 (the pool of 4)
            // with no more tasks than cores (and than the pool's 4 threads) all three make the same threads and tie
            if (T <= Math.min(4, cores)) {  // when there are no more tasks than cores or pool threads, all strategies make the same threads
              verdict.innerHTML = `With only <b>${T}</b> tasks, all three strategies make <b>${T}</b> threads, so they tie. The differences appear once tasks outnumber cores (<span class="t">oversubscription</span>) or the pool’s guess: slide <b>Tasks</b> up.`;  // verdict for that case: they tie, and the student is told to slide Tasks up to see a difference
              return;  // stops here so the longer verdict below is skipped
            }  // ends the tie case
            const sA = a.n > cores  // sentence about strategy 1, chosen by whether it made more threads than cores
              ? `One thread per task makes <b>${a.n}</b> threads (${fmtMem(a.mem)} of stack) and spends <b>${ctx.util.fmt(a.over * 100, 0)}%</b> of its CPU time creating and destroying them; ${ctx.util.fmt(a.perCore, 1)} threads share each core (<span class="t">oversubscription</span>).`  // more threads than cores: names the count, the memory, the bookkeeping share and the threads per core
              : `One thread per task makes ${a.n} threads, no more than the ${cores} cores, so here it matches GCD. Add tasks and it falls behind.`;  // otherwise: it matches GCD for now but falls behind with more tasks
            let sB;  // sB will hold the sentence about the hand-made pool
            if (cores === 4) sB = 'The hand-made pool ties GCD only because its author guessed 4 cores and this Mac has exactly 4. Try another machine.';  // exactly 4 cores: the pool only ties because its guess happens to match this machine
            else if (cores > 4) sB = `The hand-made pool leaves <b>${cores - b.P} of ${cores}</b> cores idle: it was written for a smaller machine. GCD sized its pool to this one.`;  // more than 4 cores: the pool leaves cores idle because it was written for a smaller machine
            else sB = `The hand-made pool runs 4 threads on ${cores} core${cores > 1 ? 's' : ''}: they take turns, adding memory but no speed. GCD made only ${cores}.`;  // fewer than 4 cores: the pool's threads take turns, costing memory without speed
            verdict.innerHTML = sA + ' ' + sB;  // shows both sentences together in the verdict box
          }  // ends paint()
          const sl = ctx.ui.slider({ label: 'Tasks', min: 2, max: 10, value: 5, format: (v) => String(2 ** v), onInput: (v) => { T = 2 ** v; paint(); } });  // Tasks slider: positions 2 to 10 mean 2^2 = 4 up to 2^10 = 1024 tasks; moving it repaints
          sl.style.width = ctx.narrow ? '100%' : '290px';  // slider width: full width on a phone-width screen, otherwise 290px
          const seg = ctx.ui.seg([1, 2, 4, 8].map((c) => ({ value: c, label: c + (c === 1 ? ' core' : ' cores') })), cores, (v) => { cores = v; paint(); });  // core buttons: 1, 2, 4 or 8 cores; choosing one repaints
          paint();  // draws the cards once when the step opens
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the step: everything stacked in one column that fills the slide
            h('p', { class: 'm0', html: 'A program has a pile of small, independent tasks, each needing <b>0.1 ms</b> of computing (one thumbnail, say). Compare three ways to run them.' }),  // opening paragraph: many small tasks of 0.1 ms each, three ways to run them
            h('div', { class: 'ctl', style: { gap: '18px' } }, sl, h('div', { class: 'ctl' }, h('span', { class: 'lbl' }, 'This Mac has'), seg),  // control row: the Tasks slider, then the core buttons with their label
              h('span', { class: 'xs muted', style: { flex: '1', minWidth: '220px' }, html: 'Cost model: creating + destroying a thread ≈ 0.04 ms of CPU; each thread reserves 0.5 MB of stack; queueing a block is almost free.' })),  // note stating the cost model: thread create and destroy cost, stack size, and the near-free enqueue
            h('div', { class: 'grid-3 grow' }, ...cards.map((c) => c.el)),  // the three strategy cards side by side, taking the spare height
            h('div', { class: 'split', style: { height: 'auto', gap: '14px', gridTemplateColumns: ctx.narrow ? '1fr' : 'minmax(0, 3fr) minmax(0, 2fr)' } }, verdict,  // bottom row: the verdict on the left and a warning on the right (one column on a phone-width screen)
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'More threads is not more speed. Once every core is busy, extra threads only take turns; they add memory and switching and finish no sooner.' }))));  // callout: more threads is not more speed once every core is busy; closes the layout
        },  // ends render() for step 2
      },  // ends step 2

      /* ---------------- 3. Learn: blocks, a unit of work you can hold ---------------- */
      {  // step 3 (learn): what a block is and what it captures
        title: 'Blocks: a piece of work you can pass around',  // title shown at the top of step 3
        kind: 'learn',  // kind 'learn' sets the header label for this step
        render(el, ctx) {  // render(el, ctx) builds step 3 when the student opens it
          const { h } = ctx;  // takes the element builder h out of ctx
          /* --- tab 1: clickable anatomy of a block --- */
          const PARTS = [  // PARTS: the pieces of the example declaration, each with the code text, a name and an explanation
            ['int', 'Return type', 'The block hands back an int when it finishes.'],  // piece 1: int, the type of value the block returns
            ['(^twice)', 'A block variable', 'In a declaration the caret plays the role that * plays for pointers: twice is a variable that <i>holds</i> a block.'],  // piece 2: (^twice), which declares a variable that holds a block (the caret works like * for pointers)
            ['(int)', 'Parameter types', 'The block takes one int.'],  // piece 3: (int), the list of parameter types
            ['=', 'Store it', 'The block written on the right is stored in twice. Nothing runs yet.'],  // piece 4: the equals sign, which stores the block without running it
            ['^(int n)', 'Block literal starts', 'The caret says “a block starts here”; (int n) names its parameter. A block that takes nothing can be written just ^{ … }.'],  // piece 5: ^(int n), where the block itself begins and names its parameter
            ['{ return n * 2; }', 'The body', 'The actual work. It runs only when someone calls the block, not when the block is created.'],  // piece 6: the body, which runs only when the block is called
          ];  // closes the PARTS list
          function anatomy(panel) {  // anatomy(panel) builds the "Anatomy of a block" tab inside the given panel
            let pick = 4;  // pick is the selected piece; it starts on piece 5, the caret that begins the block
            const info = h('div', { class: 'card white', style: { minHeight: '92px' } });  // info is the white card that explains the selected piece
            const toks = PARTS.map((p, i) => h('button', { type: 'button', class: 'tok', onclick: () => { pick = i; paint(); } }, p[0]));  // one clickable button per piece of the declaration; clicking selects it and repaints
            function paint() {  // paint() highlights the selected piece and shows its name and explanation
              toks.forEach((t, i) => t.classList.toggle('on', i === pick));  // marks only the selected button as on
              info.innerHTML = `<h3 class="m0">${PARTS[pick][1]}</h3><p class="m0">${PARTS[pick][2]}</p>`;  // writes the piece's name and explanation into the info card
            }  // ends paint()
            paint();  // shows the starting piece once when the tab opens
            panel.append(h('div', { class: 'stack' },  // fills the tab: everything stacked in one column
              h('p', { class: 'm0 small', html: 'Click each part of this declaration. It makes a block that doubles a number and keeps it in a variable called <code>twice</code>.' }),  // instruction line: click each part; the declaration makes a block that doubles a number
              h('div', { class: 'toks' }, ...toks, h('span', { class: 'tok plain' }, ';')),  // the clickable pieces in a row, followed by a plain semicolon that ends the statement
              info,  // the explanation card
              h('div', { class: 'grid-2' },  // two small cards side by side
                h('div', { class: 'card tight' }, h('h4', {}, 'Call it like a function'), h('code', {}, 'int r = twice(21);'), h('p', { class: 'small m0 mt' }, 'r is now 42. The body ran only at this moment.')),  // card: calling the block like a function, twice(21), which gives 42
                h('div', { class: 'card tight' }, h('h4', {}, 'The simplest block'), h('code', {}, '^{ printf("hello world\\n"); }'), h('p', { class: 'small m0 mt' }, 'No parameters and no result, so only the caret and the braces are left.'))),  // card: the simplest block, one that just prints hello world
              h('div', { class: 'card tight' }, h('h4', {}, 'Where blocks go in GCD'), h('code', {}, 'dispatch_async(queue, ^{ resize(photo); });'),  // card: where blocks go in GCD, as the last argument of dispatch_async
                h('p', { class: 'small m0 mt', html: 'The block is simply the last argument. <code>dispatch_async</code> stores it in the queue and returns; a pool thread calls it later. Note that <code>photo</code> is captured, so the block brings the data along.' }))));  // note under it: dispatch_async stores the block and returns, and photo is captured; closes the tab contents
          }  // ends anatomy()
          /* --- tab 2: predict what a block captures, then step through --- */
          function capture(panel) {  // capture(panel) builds the "Predict: what does a block capture?" tab
            let shared = false, guess = null;  // shared is true when x is declared with __block; guess is the student's prediction (5, 9 or none yet)
            const SRC = (sh) => `${/* SRC(sh) returns the six-line C example shown to students; its first line depends on sh */''}
${sh ? '__block int x = 5;          // __block: share x, do not copy it' : 'int x = 5;                  // an ordinary local variable'}${/* shown code, line 1: declares x as 5, either as an ordinary local or marked __block to be shared */''}
void (^greet)(void) = ^{    // make a block, keep it in greet${/* shown code, line 2: creates a block that takes and returns nothing and keeps it in greet */''}
    printf("x is %d\\n", x); // the body uses x ...${/* shown code, line 3: the block's body prints the value of x */''}
};                          // ... so the block captures x here${/* shown code, line 4: closes the block, which is the moment x is captured */''}
x = 9;                      // change x AFTER the block exists${/* shown code, line 5: changes x to 9 after the block already exists */''}
greet();                    // now run the block`;  // shown code, line 6: runs the block; ends the code text
            const codeBox = h('div');  // codeBox holds the code listing so it can be swapped when the first line changes
            let code = null;  // code will hold the current code listing element
            const vVar = h('div', { class: 'box mem capbox' }), vBlk = h('div', { class: 'box thread capbox' }), out = h('div', { class: 'log', style: { minHeight: '34px' } });  // three result boxes: the variable x, the block greet, and the printed output
            const gBtns = [5, 9].map((v) => h('button', { type: 'button', class: 'btn sm', onclick: () => { guess = v; gBtns.forEach((b, i) => b.classList.toggle('on', [5, 9][i] === v)); player.refresh(); } }, `x is ${v}`));  // prediction buttons "x is 5" and "x is 9"; clicking one records the guess, lights it and redraws the frame
            const LINES = [[1], [2, 3, 4], [5], [6]];  // LINES: which code lines to highlight in each of the 4 frames of the walk-through
            function draw(i) {  // draw(i) shows frame i of the walk-through and returns its caption; the player calls it
              code.clear(); code.mark(LINES[i]);  // clears the old highlight and highlights this frame's lines
              const x = i >= 2 ? 9 : 5;  // x is 5 in frames 1 and 2, and 9 once line 5 has run
              vVar.innerHTML = `<div class="xs muted b">VARIABLE x (in the function)</div><div class="big">${x}</div>`;  // shows the current value of the variable x
              if (i === 0) vBlk.innerHTML = '<div class="xs muted b">BLOCK greet</div><div class="small muted" style="padding:10px 0">not created yet</div>';  // in frame 1 the block does not exist yet
              else vBlk.innerHTML = shared  // from frame 2 on, the block box depends on how x was declared
                ? `<div class="xs muted b">BLOCK greet</div><div class="small">captured: <b>a link to x</b></div><div class="big">→ ${x}</div>`  // shared: the block holds a link to x, so it shows x's current value
                : '<div class="xs muted b">BLOCK greet</div><div class="small">captured: <b>its own copy</b></div><div class="big">5</div>';  // copied: the block holds its own copy, which stays 5
              out.textContent = i === 3 ? `x is ${shared ? 9 : 5}` : '(nothing printed yet)';  // the output box shows the printed line only in the last frame
              const ans = shared ? 9 : 5;  // ans is what the block will print: 9 if x is shared, otherwise 5
              const caps = [  // caps: the caption for each of the four frames
                '<b>Line 1.</b> An ordinary variable x is created with the value 5.' + (shared ? ' The <code>__block</code> marker asks for it to be shared with any block that uses it.' : ''),  // caption for frame 1: x is created with 5 (and, if marked __block, is to be shared)
                shared ? '<b>Lines 2 to 4.</b> The block is created. Because x is marked __block, the block keeps a <b>link</b> to x itself, not a copy.' : '<b>Lines 2 to 4.</b> The block is created. It uses x, so it <b>captures</b> x: it copies the value 5 into itself, right now.',  // caption for frame 2: the block is created and either copies 5 or keeps a link to x
                shared ? '<b>Line 5.</b> x becomes 9. The block’s link sees the change, because both refer to the same x.' : '<b>Line 5.</b> x becomes 9, but the block’s copy was made earlier and still says 5.',  // caption for frame 3: x becomes 9, and whether the block sees it
                `<b>Line 6.</b> Running the block prints <b>x is ${ans}</b>. ` + (guess == null ? 'Make a prediction next time before you step.' : guess === ans ? 'Your prediction was right.' : `You predicted ${guess}: the block ${shared ? 'shares x, so it sees the new value' : 'took its copy before x changed'}.`),  // caption for frame 4: what is printed, plus feedback on the student's prediction
              ];  // closes the captions list
              return caps[i];  // returns this frame's caption for the player to display
            }  // ends draw()
            function build() {  // build() makes a fresh code listing for the current version of the first line
              code = ctx.ui.code(SRC(shared), { lang: 'c', fontSize: 13.5 });  // builds the highlighted C listing from SRC
              codeBox.replaceChildren(code);  // puts it into the code box, replacing the old one
            }  // ends build()
            const seg = ctx.ui.seg([{ value: false, label: 'int x = 5;' }, { value: true, label: '__block int x = 5;' }], false, (v) => { shared = v; guess = null; gBtns.forEach((b) => b.classList.remove('on')); build(); player.reset(); });  // switch between the two first lines; changing it clears the guess, rebuilds the code and restarts the walk-through
            build();  // builds the first code listing when the tab opens
            const player = ctx.ui.player({ count: 4, render: draw, interval: 2200, speed: false });  // the step-through player with 4 frames, 2.2 s apart when playing, with no speed buttons
            panel.append(h('div', { class: 'stack', style: { gap: '9px' } },  // fills the tab: everything stacked in one column
              h('div', { class: 'ctl' }, h('span', { class: 'lbl' }, 'First line:'), seg, h('span', { class: 'lbl', style: { marginLeft: '10px' } }, 'Predict:'), ...gBtns),  // control row: the first-line switch and the two prediction buttons
              codeBox,  // the code listing
              h('div', { class: 'grid-3', style: { alignItems: 'stretch' } }, vVar, vBlk, h('div', { class: 'stack gap-s' }, h('div', { class: 'xs muted b' }, 'OUTPUT'), out)),  // the three result boxes side by side: variable, block, output
              player.el,  // the player's buttons and caption
              h('div', { class: 'callout tip m0 small', 'data-label': 'Why copying is the default', html: 'By the time a block runs on some pool thread, the function that created it may already have returned and its local variables may be gone. A copy travels safely with the block.' })));  // tip: copying is the default because the creating function may be gone when the block runs; closes the tab
          }  // ends capture()
          const tabs = ctx.ui.tabs([{ label: 'Predict: what does a block capture?', render: capture }, { label: 'Anatomy of a block', render: anatomy }]);  // the two tabs for this step, with the capture prediction shown first
          el.append(h('div', { class: 'split l fill' },  // builds the step: text on the left, the tabs on the right
            h('div', { class: 'stack' },  // left column: the reading text
              h('p', { class: 'lead m0', html: 'A <span class="t" data-t="Block (GCD)">block</span> is a piece of code you can hold in your hand and pass to someone else.' }),  // opening line: a block is code you can hold and pass on
              h('p', { class: 'm0', html: 'Blocks are a small extension to C, Objective-C and C++. A caret and a pair of braces make one: <code style="white-space:nowrap">^{ printf("hello world\\n"); }</code>' }),  // paragraph: blocks extend C, Objective-C and C++; a caret and braces make one
              h('p', { class: 'm0', html: 'A block has no name: it is an <span class="t">anonymous function</span>. You can store it, pass it to <code>dispatch_async</code>, and run it later, even on another thread.' }),  // paragraph: a block is an anonymous function that can be stored, passed and run later
              h('p', { class: 'm0', html: 'A block also remembers the outside variables it uses: it <span class="t" data-t="Capture">captures</span> them. Code bundled with captured values is called a <span class="t">closure</span>.' }),  // paragraph: a block captures the outside variables it uses, which makes it a closure
              h('div', { class: 'callout why m0 small', 'data-label': 'Why GCD needs blocks', html: 'A task’s code stays where it belongs in your function, in the order you think about it, yet runs elsewhere, later, carrying its data.' }),  // callout: why GCD needs blocks (the code stays in place but runs elsewhere, later)
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Writing a block does not run it. It runs when it is called, or when GCD takes it off a queue.' })),  // warning: writing a block does not run it
            tabs));  // the tabs fill the right column; closes the layout
        },  // ends render() for step 3
      },  // ends step 3

      /* ---------------- 4. Learn: dispatch queues and dispatch sources ---------------- */
      {  // step 4 (learn): the kinds of dispatch queue, and dispatch sources
        title: 'Dispatch queues: where blocks wait their turn',  // title shown at the top of step 4
        kind: 'learn',  // kind 'learn' sets the header label for this step
        render(el, ctx) {  // render(el, ctx) builds step 4 when the student opens it
          const { h } = ctx;  // takes the element builder h out of ctx
          /* --- tab 1: the queues every app can use --- */
          const QS = [  // QS: the three kinds of queue shown in the first tab, with their facts
            { nm: 'Main queue', kind: 'serial', to: 'main thread', tcls: 'thread', n: 2,  // the main queue: serial, served by the main thread, drawn with two waiting blocks
              get: 'dispatch_get_main_queue()',  // the call that gets the main queue
              what: 'The <span class="t">main queue</span> is serial: its blocks run one at a time on the application’s <span class="t">main thread</span>, the thread that handles clicks, keys and drawing.',  // what the main queue is: serial, running on the main thread that handles clicks, keys and drawing
              use: 'Anything that touches the window: showing results, changing labels, enabling buttons.',  // what the main queue is for: anything that changes the window
              care: 'Never put slow work here. While a block runs on the main queue, the app cannot react to the user.' },  // warning for the main queue: slow work here freezes the app; closes the main-queue entry
            { nm: 'Global queues', kind: 'concurrent', to: 'thread pool', tcls: 'os', n: 4,  // the global queues: concurrent, served by the thread pool, drawn with four waiting blocks
              get: 'dispatch_get_global_queue(\n  DISPATCH_QUEUE_PRIORITY_DEFAULT, 0)',  // the call that gets the default-priority global queue
              what: 'The <span class="t" data-t="Global queue">global queues</span> are concurrent, shared by the whole app and supplied by the system at priorities <b>high, default and low</b> (plus <b>background</b> since 10.7); higher-priority blocks go first when cores are scarce. Newer code usually picks a <b>quality-of-service class</b> instead: user-interactive, user-initiated, utility or background.',  // what the global queues are: shared, concurrent, at several priorities, with quality-of-service classes in newer code
              use: 'Independent background work: analysing, resizing, compressing, searching.',  // what global queues are for: independent background work
              care: 'Blocks may run at the same time, so shared data needs protection.' },  // warning for global queues: blocks may overlap, so shared data needs protection; closes the entry
            { nm: 'Your own serial queue', kind: 'serial', to: 'thread pool', tcls: 'os', n: 3,  // a private serial queue the app creates itself, served by the pool, drawn with three blocks
              get: 'dispatch_queue_create("com.example.bank",\n  DISPATCH_QUEUE_SERIAL)',  // the call that creates a named serial queue
              what: 'A private queue you create and name. Its blocks run on pool threads, one at a time, in order. (In 10.6 every app-made queue was serial; private concurrent queues, DISPATCH_QUEUE_CONCURRENT, came in 10.7.)',  // what a private serial queue is, plus a note that private concurrent queues arrived one version later
              use: 'Guarding shared data instead of a lock: if every use of a balance goes through this queue, two updates can never overlap.',  // what it is for: guarding shared data instead of a lock
              care: 'A serial queue is not a thread. Its blocks may run on different pool threads, just never two at once.' },  // warning: a serial queue is not a thread; its blocks may use different pool threads; closes the entry
          ];  // closes the QS list
          function queueMap(panel) {  // queueMap(panel) builds the "The queues an app gets" tab
            let pick = 0;  // pick is the selected queue row; the main queue is selected first
            const rows = QS.map((q, i) => h('button', { type: 'button', class: 'qrow2', onclick: () => { pick = i; paint(); } },  // one clickable row per queue; clicking selects it and repaints
              h('div', { class: 'qname' }, h('b', {}, q.nm), h('span', { class: 'chip ' + (q.kind === 'serial' ? 'proc' : 'cpu') }, q.kind)),  // row part 1: the queue's name with a serial or concurrent chip
              h('div', { class: 'qline' }, ...ctx.util.range(q.n).map((k) => h('span', { class: 'tile sm ' + TILE[(i * 2 + k) % TILE.length] }, LETTERS[k]))),  // row part 2: a queue line of lettered tiles standing for the waiting blocks
              h('span', { class: 'qarr' }, '→'),  // row part 3: an arrow toward whoever runs the blocks
              h('span', { class: 'box ' + q.tcls + ' qto' }, q.to)));  // row part 4: a box naming who runs them (main thread or thread pool); closes the row
            const info = h('div', { class: 'card white stack gap-s' });  // info is the card under the rows that describes the selected queue
            function paint() {  // paint() highlights the selected row and fills the info card; it runs on every click
              rows.forEach((r, i) => r.classList.toggle('on', i === pick));  // marks only the selected row as on
              const q = QS[pick];  // q is the selected queue's data
              info.replaceChildren(  // replaces the info card's contents
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, q.nm), h('span', { class: 'chip ' + (q.kind === 'serial' ? 'proc' : 'cpu') }, q.kind + ' queue')),  // heading line: the queue's name and its kind
                h('pre', { class: 'mini' }, q.get),  // the C call that gets or creates this queue
                h('p', { class: 'm0 small', html: q.what }),  // what the queue is
                h('p', { class: 'm0 small', html: '<b>Use it for:</b> ' + q.use }),  // what to use it for
                h('p', { class: 'm0 small', html: '<b>Careful:</b> ' + q.care }));  // what to be careful about; closes the info card contents
            }  // ends paint()
            paint();  // shows the first queue once when the tab opens
            panel.append(h('div', { class: 'stack gap-s' }, h('p', { class: 'small muted m0' }, 'Click a queue. Front of each line is on the right, next to the arrow.'), ...rows, info));  // fills the tab: a hint that the front of each line is on the right, the three rows, then the info card
          }  // ends queueMap()
          /* --- tab 2: dispatch sources turn events into queued blocks --- */
          const SRCS = [  // SRCS: the four event types the dispatch-sources demo can fire, each with a letter, handler job and colour
            { key: 'T', nm: 'Timer fires', type: 'TIMER', job: 'autosave()', c: 'warn' },  // timer source (T): its handler runs autosave()
            { key: 'R', nm: 'Socket has data', type: 'READ', job: 'readMessage()', c: 'io' },  // read source (R): data arrived on a network socket, so the handler reads the message
            { key: 'S', nm: 'Signal arrives', type: 'SIGNAL', job: 'reloadSettings()', c: 'intr' },  // signal source (S): a Unix signal arrived, so the handler reloads the settings
            { key: 'P', nm: 'Child process exits', type: 'PROC', job: 'collectResult()', c: 'proc' },  // process source (P): a child process ended, so the handler collects its result
          ];  // closes the SRCS list
          function sources(panel) {  // sources(panel) builds the "Dispatch sources" tab: fire events and watch handlers go through a queue to two threads
            /* Model of real dispatch-source behaviour: a source has at most ONE handler run waiting in the queue
               (events that arrive before it starts are merged into it, count n), and never runs its own handler
               twice at once (an event that arrives while the handler runs is held by the source, then queued). */
            const q = [], run = [null, null], held = {};  // q is the queue of waiting handler runs; run holds what each of the two pool threads is doing; held counts events a busy source is holding
            let serial = 0;  // serial numbers each handler run so the tiles can be told apart (T1, R2, ...)
            const qBox = h('div', { class: 'srcq' }), runBox = h('div', { class: 'grid-2', style: { gap: '6px' } }), log = h('div', { class: 'log', style: { height: '70px' } });  // the queue box, the pair of thread boxes, and the scrolling event log
            const glow = {}, heldEl = {};  // glow keeps each source's button so it can flash; heldEl keeps the "holds N" label on each button
            const btns = SRCS.map((sd) => {  // builds one button per event source
              held[sd.key] = 0;  // each source starts with no held events
              heldEl[sd.key] = h('span', { class: 'xs b', style: { marginLeft: '4px' } });  // the small label on the button that will say how many events the source is holding
              const b = h('button', { type: 'button', class: 'btn sm ' + (sd.c === 'warn' ? '' : sd.c), onclick: () => fire(sd) }, h('b', {}, sd.key), ' ' + sd.nm, heldEl[sd.key]);  // the button itself: the source's letter, its name and the held label; clicking fires that event
              glow[sd.key] = b; return b;  // remembers the button for flashing and returns it
            });  // ends the button builder
            function fire(sd) {  // fire(sd) handles one event from source sd, following the real rules of dispatch sources
              glow[sd.key].classList.remove('flash'); void glow[sd.key].offsetWidth; glow[sd.key].classList.add('flash');  // restarts the button's flash animation (removing the class and reading offsetWidth forces the browser to replay it)
              const waiting = q.find((it) => it.sd === sd);  // looks for a handler run from this same source that is still waiting in the queue
              if (waiting) { waiting.n++; addLog(`${sd.type} event merged into the waiting ${sd.key}${waiting.id} (${waiting.n} events, still one run)`); }  // if one is waiting, the new event merges into it: its count goes up but it will still run only once
              else if (run.some((r) => r && r.sd === sd)) { held[sd.key]++; addLog(`${sd.type} event held: this source's handler is still running`); }  // if this source's handler is running now, the source holds the event instead of starting a second run
              else { q.push({ id: ++serial, sd, n: 1, age: 0 }); addLog(`${sd.type} source saw its event → queued ^{ ${sd.job}; }`); }  // otherwise a new handler run joins the back of the queue
              paint();  // redraws the queue, threads and labels
            }  // ends fire()
            function addLog(t) { log.append(h('div', {}, t)); while (log.childNodes.length > 30) log.firstChild.remove(); log.scrollTop = log.scrollHeight; }  // addLog(t) adds a line to the event log, keeps only the last 30 lines and scrolls to the newest
            const tileOf = (it) => h('span', { class: 'tile ' + (it.sd.c === 'warn' ? 'accent' : it.sd.c === 'intr' ? 'os' : it.sd.c) }, it.sd.key + it.id + (it.n > 1 ? ' ×' + it.n : ''));  // tileOf(it) draws a handler run as a tile such as "T3" or "R2 ×3" (×3 means three merged events)
            function paint() {  // paint() redraws the queue, both pool threads and the held counts
              qBox.replaceChildren(...(q.length ? q.map(tileOf) : [h('span', { class: 'xs muted' }, 'empty: no thread is waiting for events')]));  // the queue box: one tile per waiting run, or a note that it is empty
              runBox.replaceChildren(...run.map((r, i) => h('div', { class: 'box thread small', style: { textAlign: 'left', padding: '4px 8px' } },  // one box per pool thread
                h('div', { class: 'xs muted b' }, 'POOL THREAD ' + (i + 1)), r ? h('span', {}, tileOf(r), ' ' + r.sd.job) : h('span', { class: 'muted' }, 'idle'))));  // each thread box shows its label and either the run it is working on (with its job) or "idle"
              SRCS.forEach((sd) => { heldEl[sd.key].textContent = held[sd.key] ? '· holds ' + held[sd.key] : ''; });  // updates each button's "holds N" label
            }  // ends paint()
            log.append(h('div', { class: 'muted' }, 'Fire a few events, then fire the same one twice quickly and watch the queue.'));  // first line of the log: tells the student what to try
            ctx.every(450, () => {  // every 0.45 seconds (stopped automatically when the step closes) the pretend pool threads make progress
              let changed = false;  // changed records whether anything happened this tick, so the screen is redrawn only when needed
              run.forEach((r, i) => {  // checks each thread's current run
                if (!r || ++r.age < 3) return;  // skips idle threads; a run finishes after 3 ticks, about 1.35 seconds
                addLog(`pool thread ${i + 1} finished ${r.sd.key}${r.id}: ${r.sd.job}` + (r.n > 1 ? ` (handled ${r.n} events)` : ''));  // logs that the thread finished, and how many merged events that one run handled
                run[i] = null; changed = true;  // frees the thread
                const k = r.sd.key;  // k is the letter of the source whose handler just finished
                if (held[k]) { q.push({ id: ++serial, sd: r.sd, n: held[k], age: 0 }); addLog(`${r.sd.type} source now queues its held event${held[k] > 1 ? 's' : ''}`); held[k] = 0; }  // if that source held events while its handler ran, they now become one new queued run
              });  // ends the finished-run check
              run.forEach((r, i) => { if (!r && q.length) { run[i] = q.shift(); run[i].age = 0; changed = true; } });  // each idle thread takes the run at the front of the queue (first in, first out)
              if (changed) paint();  // redraws only if something changed
            });  // ends the repeating timer
            paint();  // draws the empty demo once when the tab opens
            panel.append(h('div', { class: 'stack gap-s' },  // fills the tab: everything stacked in one column
              h('p', { class: 'small m0', html: 'A <span class="t">dispatch source</span> watches for a system event. When it happens, the source puts a handler block on a queue you chose, and a pool thread runs it: no thread of yours sits waiting. Events that arrive before the handler starts are <b>merged</b> into one run, and one source never runs its handler twice at once.' }),  // explanation: a source watches for an event, queues a handler, merges early events and never runs twice at once
              ctx.ui.code(`${/* starts a short C listing of a timer source shown to students */''}
s = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER,   // watch a timer...${/* shown code, line 1: creates a source that watches a timer */''}
                           0, 0, q);                     // ...handlers go to q${/* shown code, line 2: the rest of that call, naming q as the queue for its handlers */''}
dispatch_source_set_timer(s, start, 30*NSEC_PER_SEC, 0); // from start, every 30 s${/* shown code, line 3: sets the timer to fire every 30 seconds from start */''}
dispatch_source_set_event_handler(s, ^{ autosave(); });  // the handler block${/* shown code, line 4: sets the handler block, which calls autosave() */''}
dispatch_resume(s);                                      // start watching`, { lang: 'c', nums: false, fontSize: 12.5 }),  // shown code, line 5: starts the source watching; the listing has no line numbers
              h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'xs muted b' }, 'FIRE AN EVENT:'), ...btns),  // row of fire buttons with its label
              h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'xs muted b', style: { flex: 'none' } }, 'QUEUE q (GLOBAL)'), qBox),  // the labelled queue box showing q, a global queue
              runBox, log));  // the two pool-thread boxes and the log; closes the tab contents
          }  // ends sources()
          const tabs = ctx.ui.tabs([{ label: 'The queues an app gets', render: queueMap }, { label: 'Dispatch sources', render: sources }]);  // the two tabs for this step, with the queue map first
          el.append(h('div', { class: 'split l fill' },  // builds the step: text on the left, the tabs on the right
            h('div', { class: 'stack' },  // left column: the reading text about queues
              h('p', { class: 'lead m0', html: 'Blocks wait in a <span class="t">dispatch queue</span> until GCD hands them to a thread. Every queue is <span class="t" data-t="FIFO (first in, first out)">FIFO</span>: first in, first out.' }),  // opening line: blocks wait in a dispatch queue, and every queue is first in, first out
              h('div', { class: 'card tight proc' }, h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'chip proc' }, 'serial'), h('b', {}, 'One at a time')),  // card for serial queues: a "serial" chip and the phrase "One at a time"
                h('p', { class: 'small m0 mt', html: 'A <span class="t">serial queue</span> takes the next block only after the current one finishes. Strictly in order, never together.' })),  // explanation: a serial queue starts the next block only after the current one ends; closes the card
              h('div', { class: 'card tight cpu' }, h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'chip cpu' }, 'concurrent'), h('b', {}, 'Start in order, run together')),  // card for concurrent queues: a "concurrent" chip and the phrase "Start in order, run together"
                h('p', { class: 'small m0 mt', html: 'A <span class="t">concurrent queue</span> hands out the next block as soon as a pool thread is free, without waiting for earlier ones to finish. Blocks <b>start</b> in FIFO order but may overlap and <b>finish</b> in any order.' })),  // explanation: blocks start in FIFO order but may overlap and finish in any order; closes the card
              h('div', { class: 'callout why m0 small', 'data-label': 'A queue instead of a lock', html: 'Send every read and update of some shared data through one serial queue, and two updates can never overlap. The queue itself does the job a lock would do.' }),  // callout: sending all uses of shared data through one serial queue does the job of a lock
              h('div', { class: 'card tight small' }, h('h4', {}, 'Two ways to hand over a block'),  // small card comparing the two ways to hand over a block
                h('div', { html: '<code>dispatch_async(q, blk)</code> adds the block and returns at once; your code keeps going. <code>dispatch_sync(q, blk)</code> waits until the block has run. GCD code mostly uses <span class="t">dispatch_async</span>.' }))),  // text: dispatch_async returns at once, dispatch_sync waits; closes the card and the left column
            tabs));  // the tabs fill the right column; closes the layout
        },  // ends render() for step 4
      },  // ends step 4

      /* ---------------- 5. Lab: a dispatch queue simulator ---------------- */
      {  // step 5 (lab): a simulator where blocks run through a serial or a concurrent queue on up to 8 cores
        title: 'Lab: run blocks through a serial or a concurrent queue',  // title shown at the top of step 5
        kind: 'lab',  // kind 'lab' sets the header label for this step
        core: true,  // core: true keeps this step on the shorter "core path" through the guide
        render(el, ctx) {  // render(el, ctx) builds the lab when the student opens it
          const { h, s } = ctx;  // h builds page elements and s builds SVG elements (SVG is the browser's format for drawings made of shapes)
          const NAR = ctx.narrow;  // NAR is true on a phone-width screen; the drawing then uses a smaller coordinate width
          const VW = NAR ? 420 : 760, LX = NAR ? 54 : 70, GX0 = LX + 6, GX1 = VW - 12;  // drawing sizes: total width VW, where the core labels end (LX), and the left and right edges of the timeline (GX0, GX1)
          const QY = 22, TW = NAR ? 30 : 56, TH = 32, LT = 80, LH = 264, AX = LT + LH + 4, VH = AX + 24;  // more sizes: queue row top (QY), tile width and height, timeline top (LT) and height (LH), time axis (AX), full height (VH)
          const RATE = 300; // simulated ms per real second
          const EXAMPLE = () => [{ dur: 300, sh: true }, { dur: 100 }, { dur: 200 }, { dur: 100, sh: true }, { dur: 300 }, { dur: 200 }];  // EXAMPLE() makes the starting set of six blocks with their times in ms; two of them (sh) touch shared data
          let blocks = EXAMPLE(), mode = 'serial', cores = 4, t = 0, playing = false, stopRaf = null, nextSh = false;  // the lab's state: the blocks, queue type, number of cores, current time t, whether it is playing, and the "shared" toggle
          let S = gcdSchedule(blocks, mode, cores);  // S holds the schedule for the current blocks, queue type and cores, worked out by gcdSchedule()
          const done = [false, false, false, false];  // done[i] becomes true when the student completes goal i + 1
          let raceSeen = false; // goal 4 has two parts: first see a race, then prevent it
          const GOALS = ['<b>Serial</b> queue on <b>4+ cores</b>: run to the end and watch the other cores', 'Make blocks <b>finish</b> in a different order than they <b>started</b>', 'Finish <b>6+ blocks</b> at least <b>3× faster</b> than one at a time', 'Let two <b>◆</b> blocks <b>race</b>, then prevent the race on <b>2+ cores</b> by changing only the queue type'];  // GOALS: the four challenges shown in the side panel
          const svg = s('svg', { viewBox: `0 0 ${VW} ${VH}`, width: '100%', role: 'img', 'aria-label': 'Queue contents and a timeline of which core ran which block' });  // the SVG drawing of the queue and timeline; role and aria-label describe it to screen readers
          const TS = () => Math.max(S.total, 400);  // TS() is the length of the time axis: the total work time, but at least 400 ms so short runs are not stretched
          const X = (tm) => GX0 + (tm / TS()) * (GX1 - GX0);  // X(tm) converts a time in ms into a horizontal position on the timeline
          const nm = (o) => LETTERS[o.i] + (o.b.sh ? '◆' : '');  // nm(o) is a block's label: its letter, plus a diamond if it touches shared data
          const started = (o) => t > 0 && o.start <= t;  // started(o) is true once the clock has reached the block's start time
          function draw() {  // draw() rebuilds the whole SVG drawing for the current time t; paint() calls it on every change and animation frame
            const k = [];  // k collects the shapes to draw, in back-to-front order
            const lh = Math.min(62, LH / cores), labels = [];  // lh is the height of one core's row (at most 62); labels are block names drawn last so they sit on top
            k.push(s('text', { x: 0, y: 14, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, (mode === 'serial' ? 'SERIAL' : 'CONCURRENT') + ' QUEUE · FIFO · the front is on the left'));  // heading above the queue: serial or concurrent, FIFO, with the front on the left
            k.push(s('rect', { x: 1, y: QY, width: VW - 2, height: TH + 12, rx: 10, class: 's-panel', 'stroke-dasharray': '5 4' }));  // the dashed box that holds the waiting blocks
            const waiting = S.out.filter((o) => !started(o));  // waiting: the blocks that have not started yet, in queue order
            if (!waiting.length) k.push(s('text', { x: 14, y: QY + TH / 2 + 11, 'font-size': 13.5, class: 's-sub' }, blocks.length ? 'empty: every block has been handed to a thread' : 'empty: add blocks with the buttons above'));  // if nothing is waiting, a note says why: all blocks handed out, or none added yet
            waiting.forEach((o, j) => {  // draws each waiting block as a coloured tile in the queue box, front first
              const x = 7 + j * (TW + 5), y = QY + 6;  // the tile's position: tiles sit side by side from the left edge of the box
              k.push(s('rect', { x, y, width: TW, height: TH, rx: 7, class: 's-' + TILE[o.i % TILE.length], 'stroke-width': 2 }));  // the tile's rectangle, coloured by the block's number
              k.push(s('text', { x: x + TW / 2, y: y + TH / 2 + 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, NAR ? LETTERS[o.i] : nm(o) + ' ' + o.b.dur));  // the tile's label: just the letter on a phone-width screen, otherwise name and duration
            });  // ends the waiting-tile loop
            for (let c = 0; c < cores; c++) {  // draws one timeline row per core
              const y = LT + c * lh;  // y is the top of this core's row
              k.push(s('rect', { x: GX0, y: y + 2, width: GX1 - GX0, height: lh - 4, rx: 6, class: 's-panel', 'stroke-width': 1 }));  // the row's pale background strip
              k.push(s('text', { x: LX - 2, y: y + lh / 2 + (lh >= 40 ? -3 : 5), 'text-anchor': 'end', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'core ' + (c + 1)));  // the row label "core N"; it moves up a little when there is room for a second line
              if (lh >= 40) k.push(s('text', { x: LX - 2, y: y + lh / 2 + 13, 'text-anchor': 'end', 'font-size': 13, style: 'fill:var(--thread)' }, 'thread ' + (c + 1)));  // when rows are tall enough, a second label "thread N" says which pool thread runs on that core
              if (blocks.length && !S.out.some((o) => o.lane === c)) k.push(s('text', { x: GX0 + 10, y: y + lh / 2 + 5, 'font-size': 13, class: 's-sub' }, mode === 'serial' ? 'idle: a serial queue runs only one block at a time' : 'idle: no block left for this thread'));  // if no block ever uses this row, a grey note explains why it stays idle (serial queue, or no block left)
            }  // ends the per-core loop
            S.out.forEach((o) => {  // draws a bar for every block that has started, on its thread's row
              if (!started(o)) return;  // skips blocks that have not started yet
              const y = LT + o.lane * lh, x0 = X(o.start), x1 = X(Math.min(t, o.end)), run = t < o.end;  // row position, start x, end x (cut off at the current time), and whether the block is still running
              k.push(s('rect', { x: x0 + 1, y: y + 5, width: Math.max(3, x1 - x0 - 2), height: lh - 10, rx: 5, class: 's-' + TILE[o.i % TILE.length] + (run ? ' pulse' : ''), 'stroke-width': run ? 3 : 1.5 }));  // the block's bar; a running block pulses and gets a thicker outline
              if (x1 - x0 > 26 && lh >= 22) labels.push(s('text', { x: (x0 + x1) / 2, y: y + lh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, nm(o)));  // adds the block's name if the bar is wide and tall enough to hold it
            });  // ends the block-bar loop
            S.races.forEach(([a, c]) => {  // marks every race: two shared-data blocks running at the same time
              const A = S.out[a], B = S.out[c], r0 = Math.max(A.start, B.start), r1 = Math.min(A.end, B.end, t);  // the overlap runs from the later start to the earliest end (never past the current time)
              if (t <= 0 || r1 <= r0) return;  // skips races whose overlap has not happened yet
              [A, B].forEach((o) => k.push(s('rect', { x: X(r0), y: LT + o.lane * lh + 3, width: X(r1) - X(r0), height: lh - 6, rx: 4, class: 's-intr', 'fill-opacity': 0.3, 'stroke-width': 2.5, 'stroke-dasharray': '5 3' })));  // draws a dashed red-tinted box over the overlapping part of both blocks' bars
            });  // ends the race loop
            k.push(...labels);  // adds the block names last so they are drawn on top of the bars
            const stp = TS() <= 1200 ? 100 : TS() <= 2400 ? 200 : 300, px = ((GX1 - GX0) * stp) / TS(), every = Math.ceil(40 / px);  // picks a tick spacing of 100, 200 or 300 ms by axis length, and labels every tick that is at least 40 units apart
            k.push(s('line', { x1: GX0, y1: AX, x2: GX1, y2: AX, class: 's-line', 'stroke-width': 1.5 }));  // the time axis line under the rows
            k.push(s('text', { x: LX - 2, y: AX + 18, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'ms'));  // the unit label "ms" at the left end of the axis
            for (let m = 0, j = 0; m <= TS() + 1e-9; m += stp, j++) {  // walks along the axis one tick spacing at a time
              k.push(s('line', { x1: X(m), y1: AX, x2: X(m), y2: AX + 5, class: 's-line', 'stroke-width': 1.5 }));  // draws a small tick mark
              if (j % every === 0) k.push(s('text', { x: X(m), y: AX + 19, 'text-anchor': X(m) > GX1 - 16 ? 'end' : 'middle', 'font-size': 13, class: 's-sub' }, String(m)));  // labels the tick with its time when there is room; the last label is right-aligned so it stays inside
            }  // ends the tick loop
            if (t > 0 && blocks.length) {  // once the clock is running and there are blocks, draws the current-time marker
              const fin = t >= S.makespan;  // fin is true when every block has finished
              k.push(s('line', { x1: X(t), y1: LT - 4, x2: X(t), y2: AX, style: `stroke:var(${fin ? '--ok' : '--accent'})`, 'stroke-width': 2.5, 'stroke-dasharray': fin ? '6 4' : '' }));  // a vertical line at the current time: highlight colour while running, dashed green when done
              k.push(s('text', { x: Math.min(X(t), GX1 - 4), y: LT - 8, 'text-anchor': X(t) > GX1 - 80 ? 'end' : 'middle', 'font-size': 13, 'font-weight': 800, style: `fill:var(${fin ? '--ok' : '--accent'})` }, fin ? `all done at ${S.makespan} ms` : Math.round(t) + ' ms'));  // label above the line: the current time, or "all done at N ms"; kept inside the right edge
            }  // ends the time marker
            svg.replaceChildren(...k);  // replaces the old drawing with the new shapes
          }  // ends draw()
          /* side panel */
          const goalEls = GOALS.map((g) => h('li', {}, h('span', { class: 'gck' }), h('span', { html: g })));  // one list item per goal: an empty check circle and the goal text
          const tNow = h('span', { class: 'big num', style: { fontSize: '26px' } });  // tNow shows the simulated clock in large digits
          const stRow = h('div', { class: 'row ord' }), fnRow = h('div', { class: 'row ord' });  // rows of small tiles showing the order blocks started and the order they finished
          const cap = h('div', { class: 'cap grow', style: { overflow: 'hidden' } });  // cap is the caption box that narrates what is happening
          const tileOf = (i) => h('span', { class: 'tile sm ' + TILE[i % TILE.length] }, LETTERS[i]);  // tileOf(i) makes the small lettered tile for block i
          function narrate() {  // narrate() writes the caption for the current moment; paint() calls it
            if (!blocks.length) return 'The queue is empty. Add blocks with the buttons above the timeline.';  // no blocks: tells the student to add some
            if (t <= 0) return mode === 'serial'  // before the run starts, explains what the chosen queue type will do
              ? `<b>Ready.</b> Each tile is a <span class="t" data-t="Block (GCD)">block</span>, a piece of work waiting in a <span class="t">dispatch queue</span>. A serial queue hands the pool <b>one block at a time</b>: ${blocks.length > 1 ? 'B cannot start until A has finished' : 'the next block would wait for A'}, even with ${cores} core${cores > 1 ? 's' : ''} free. (Any free pool thread may run each block; this lab draws them all on thread 1.) Press <b>Run</b> or <b>Next event</b>.`  // serial version: one block at a time, so B waits for A even with free cores
              : `<b>Ready.</b> Each tile is a <span class="t" data-t="Block (GCD)">block</span>, a piece of work waiting in a <span class="t">dispatch queue</span>. A concurrent queue hands the front block to <b>any free thread</b>, so up to ${Math.min(cores, blocks.length)} block${Math.min(cores, blocks.length) > 1 ? 's' : ''} can run at once. Press <b>Run</b> or <b>Next event</b>.`;  // concurrent version: the front block goes to any free thread, so several run at once
            const races = S.races.filter(([a, c]) => Math.max(S.out[a].start, S.out[c].start) < Math.min(S.out[a].end, S.out[c].end, t));  // races: shared-data pairs whose overlap has already begun by the current time
            const raceTxt = races.length ? ` <span style="color:var(--bad)"><b>Race:</b> ${races.map(([a, c]) => nm(S.out[a]) + ' and ' + nm(S.out[c])).join(', ')} overlapped on shared data (a <span class="t">race condition</span>).</span>` : '';  // raceTxt: a red sentence naming the racing pairs, or nothing when there is no race
            if (t >= S.makespan) {  // after every block has finished, sums up the run
              const sp = S.total / S.makespan, nSh = blocks.filter((b) => b.sh).length;  // sp = speed-up over running everything one at a time; nSh = how many blocks touch shared data
              if (mode === 'serial') return `<b>All ${blocks.length} blocks done at ${S.makespan} ms</b>: the sum of their times, since only one ran at a time.` +  // serial summary: the finish time is simply the sum of the block times...
                (cores > 1 ? ` The other ${cores - 1} core${cores === 2 ? '' : 's'} did nothing for this queue.` : '') +  // ...the other cores did nothing for this queue...
                (nSh >= 2 ? ' But the ◆ blocks could never overlap, so the shared data was safe: the queue did the job of a lock.' : '');  // ...but the shared-data blocks never overlapped, so the queue protected the data like a lock
              return `<b>All ${blocks.length} blocks done at ${S.makespan} ms</b>: ${ctx.util.fmt(sp, 1)}× faster than one at a time (${S.total} ms). ` +  // concurrent summary: the finish time and how many times faster than one at a time...
                (S.finishOrder.some((v, j) => v !== j) ? 'They started in FIFO order but finished in a different order.' : 'This time they finished in the order they started.') + raceTxt +  // ...whether blocks finished in a different order than they started...
                (races.length && !done[3] ? ' Now prevent it without removing cores.' : '');  // ...and, if a race happened and goal 4 is not done yet, a nudge to prevent it without removing cores
            }  // ends the finished-run summary
            const e = S.events.filter((x) => x <= t + 1e-9).pop();  // e is the most recent start or finish time the clock has reached
            const fin = S.out.filter((o) => o.end === e).map((o) => `<b>${nm(o)}</b> finished on core ${o.lane + 1}`);  // fin lists the blocks that finished at that moment, with their core
            const st = S.out.filter((o) => o.start === e).map((o) => `<b>${nm(o)}</b> started on core ${o.lane + 1}`);  // st lists the blocks that started at that moment, with their core
            return `<b>At ${e} ms:</b> ` + [...fin, ...st].join('; ') + '.' + (st.length && e > 0 ? ' Each came from the front of the queue (FIFO).' : '') + raceTxt;  // caption during the run: what finished and started at that moment, a reminder that starts come from the front (FIFO), and any race
          }  // ends narrate()
          function paint() {  // paint() refreshes the drawing, the side panel and the Run button; it runs after every change and on each animation frame
            draw();  // redraws the SVG timeline
            tNow.textContent = Math.round(t) + ' ms';  // shows the clock in whole milliseconds
            stRow.replaceChildren(...S.out.filter(started).map((o) => tileOf(o.i)));  // fills the STARTED row with a tile for every block that has begun, in start order
            fnRow.replaceChildren(...S.finishOrder.filter((i) => t > 0 && S.out[i].end <= t).map(tileOf));  // fills the FINISHED row with the blocks that are done, in finish order
            goalEls.forEach((g, i) => g.classList.toggle('ok', done[i]));  // ticks every completed goal in the checklist
            goalEls[3].lastChild.innerHTML = GOALS[3] + (raceSeen && !done[3] ? ' <b style="color:var(--bad)">(race seen)</b>' : '');  // goal 4 shows "(race seen)" in red after its first half (seeing a race) is done but before it is prevented
            cap.innerHTML = narrate();  // writes the caption
            bRun.textContent = playing ? 'Pause' : t > 0 && t >= S.makespan ? 'Run again' : t > 0 ? 'Resume' : 'Run';  // the Run button reads Pause while playing, Run again after the end, Resume in the middle, and Run at the start
          }  // ends paint()
          function arrive() {  // arrive() runs when a run reaches the end and checks which goals the student has now met
            const n = blocks.length;  // n is the number of blocks in the queue
            if (!n) return;  // no blocks means nothing to check
            if (S.races.length) raceSeen = true;  // any race in this schedule completes the first half of goal 4
            const ok = [mode === 'serial' && cores >= 4 && n >= 3, S.finishOrder.some((v, j) => v !== j), n >= 6 && S.total / S.makespan >= 3 - 1e-9,  // goals 1 to 3: serial on 4+ cores with 3+ blocks; a finish order different from the start order; 6+ blocks at 3x speed-up
              raceSeen && mode === 'serial' && cores >= 2 && blocks.filter((b) => b.sh).length >= 2 && !S.races.length];  // goal 4: after seeing a race, a serial queue on 2+ cores with 2+ shared blocks and no race left
            const fresh = [];  // fresh collects the goals completed for the first time this run
            ok.forEach((v, i) => { if (v && !done[i]) { done[i] = true; fresh.push(i + 1); } });  // marks newly met goals done and remembers their numbers
            if (fresh.length) ctx.toast((fresh.length > 1 ? 'Goals ' : 'Goal ') + fresh.join(' and ') + ' complete' + (done.every(Boolean) ? '. All four done!' : ''));  // shows a short pop-up message (a toast) naming the goals just completed, and cheers when all four are done
          }  // ends arrive()
          function stop() { playing = false; if (stopRaf) { stopRaf(); stopRaf = null; } }  // stop() pauses the animation and cancels the per-frame updates
          function play() {  // play() runs the simulated clock forward smoothly until every block has finished
            if (!blocks.length) return;  // nothing to play without blocks
            if (t >= S.makespan) t = 0;  // starting again after the end rewinds the clock to 0
            playing = true;  // marks the lab as playing
            let last = null;  // last remembers the time of the previous animation frame
            stopRaf = ctx.raf((now) => {  // ctx.raf calls this function on every animation frame (about 60 per second) until it returns false or the step closes
              if (last == null) last = now;  // on the first frame there is no previous time yet, so use this one
              t = Math.min(S.makespan, Math.max(t, 1e-3) + ((now - last) / 1000) * RATE);  // moves the clock forward by the real time passed times RATE (300 simulated ms per real second), capped at the end
              last = now;  // remembers this frame's time for the next one
              if (t >= S.makespan) { playing = false; stopRaf = null; arrive(); paint(); return false; }  // at the end: stop playing, check goals, repaint and return false to stop the frame loop
              paint();  // otherwise repaints for this frame
            });  // ends the per-frame function
            paint();  // repaints right away so the Run button changes to Pause
          }  // ends play()
          function nextEvent() {  // nextEvent() jumps the clock to the next moment where a block starts or finishes
            stop();  // pauses any running animation first
            if (!blocks.length) return;  // nothing to step through without blocks
            if (t >= S.makespan) t = 0;  // from the end, rewind to 0
            else if (t === 0) t = 1e-3;  // from 0, move a tiny amount forward so the blocks that start at 0 show as started
            else t = S.events.find((x) => x > t + 1e-9);  // otherwise jump to the first event after the current time
            if (t >= S.makespan) arrive();  // if that jump reached the end, checks the goals
            paint();  // redraws everything for the new time
          }  // ends nextEvent()
          function reconfig() { stop(); t = 0; S = gcdSchedule(blocks, mode, cores); paint(); }  // reconfig() runs after any change to blocks, queue type or cores: stop, rewind and recompute the schedule
          function add(d) { if (blocks.length >= 12) { ctx.toast('Twelve blocks is the limit in this lab.'); return; } blocks.push({ dur: d, sh: nextSh }); reconfig(); }  // add(d) adds a block of d ms (with the shared-data flag if it is on), up to twelve, then reconfigures
          const bRun = h('button', { type: 'button', class: 'btn sm primary', onclick: () => (playing ? (stop(), paint()) : play()) });  // the Run button: pauses if playing, otherwise plays; its label is set by paint()
          const shBtn = h('button', { type: 'button', class: 'btn sm', title: 'The next block you add will change shared data', onclick: () => { nextSh = !nextSh; shBtn.classList.toggle('on', nextSh); } }, '◆ shared data');  // the shared-data toggle: while on, every new block is marked as touching shared data
          const segMode = ctx.ui.seg([{ value: 'serial', label: 'Serial queue' }, { value: 'concurrent', label: 'Concurrent queue' }], mode, (v) => { mode = v; reconfig(); });  // switch between a serial and a concurrent queue; changing it reconfigures the lab
          const slCores = ctx.ui.slider({ label: 'Cores', min: 1, max: 8, value: cores, onInput: (v) => { cores = v; reconfig(); } });  // the Cores slider, 1 to 8; changing it reconfigures the lab
          slCores.style.minWidth = NAR ? '100%' : '250px';  // the slider takes the full width on a phone-width screen, otherwise at least 250px
          paint();  // draws the lab once when the step opens
          el.append(h('div', { class: 'labgrid fill', style: NAR ? { gridTemplateColumns: '1fr' } : null },  // builds the lab: the wide left side and the side panel (one column on a phone-width screen)
            h('div', { class: 'stack', style: { gap: '9px' } },  // left side, stacked
              h('div', { class: 'ctl', style: { gap: '14px' } }, segMode, slCores),  // first control row: queue type and cores
              h('div', { class: 'ctl', style: { gap: '6px' } }, h('span', { class: 'lbl' }, 'Add a block:'), ...[100, 200, 300].map((d) => h('button', { type: 'button', class: 'btn sm', onclick: () => add(d) }, `+ ${d} ms`)), shBtn,  // second control row: buttons to add 100, 200 or 300 ms blocks, and the shared-data toggle
                h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { blocks = []; reconfig(); } }, 'Clear'),  // Clear button: empties the queue
                h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { blocks = EXAMPLE(); reconfig(); } }, 'Example set')),  // Example set button: restores the six starting blocks
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),  // the white card holding the queue-and-timeline drawing
              h('div', { class: 'ctl', style: { gap: '6px' } }, bRun,  // playback row: the Run button first
                h('button', { type: 'button', class: 'btn sm', onclick: nextEvent }, 'Next event ▸'),  // Next event button: steps to the next start or finish
                h('button', { type: 'button', class: 'btn sm', onclick: () => { stop(); if (blocks.length) { t = S.makespan; arrive(); } paint(); } }, 'Skip to end'),  // Skip to end button: jumps to the end and checks goals
                h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { stop(); t = 0; paint(); } }, 'Reset'),  // Reset button: rewinds the clock to 0 without changing the blocks
                h('span', { class: 'xs muted', style: { marginLeft: '6px' } }, '◆ = changes shared data · thick outline = running now'))),  // legend: the diamond means shared data, a thick outline means running now; closes the left side
            h('div', { class: 'stack', style: { gap: '9px' } },  // side panel, stacked
              h('div', { class: 'card tight' }, h('h4', {}, 'Goals'), h('ol', { class: 'goals' }, ...goalEls)),  // the goals card with its checklist
              h('div', { class: 'card tight stack gap-s' },  // card with the clock and the start and finish orders
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted b' }, 'CLOCK'), tNow),  // the clock row
                h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'xs muted b', style: { width: '62px', flex: 'none' } }, 'STARTED'), stRow),  // the STARTED row of tiles
                h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'xs muted b', style: { width: '62px', flex: 'none' } }, 'FINISHED'), fnRow)),  // the FINISHED row of tiles; closes the card
              cap)));  // the caption box last; closes the layout
        },  // ends render() for step 5
      },  // ends step 5

      /* ---------------- 6. Predict: which output orders are possible? ---------------- */
      {  // step 6 (predict): decide which print orders are possible for four short programs
        title: 'Predict: which print orders can really happen?',  // title shown at the top of step 6
        kind: 'predict',  // kind 'predict' sets the header label for this step
        render(el, ctx) {  // render(el, ctx) builds step 6 when the student opens it
          const { h } = ctx;  // takes the element builder h out of ctx
          const PUZ = [  // PUZ: the four puzzles, each with setup text, code, candidate orders, a queue picture, a hint and a summary
            { nm: 'Serial', setup: 'Three blocks go into one <b>serial</b> queue. Each prints a letter when it finishes its work.',  // puzzle 1 (Serial): three blocks in one serial queue, each printing a letter when done
              code: `${/* code shown for puzzle 1 */''}
// q is a SERIAL queue${/* shown code, line 1: says q is a serial queue */''}
dispatch_async(q, ^{ work(300); print("A"); }); // 300 ms, then A${/* shown code, line 2: block A works 300 ms, then prints A */''}
dispatch_async(q, ^{ print("B"); });            // B at once${/* shown code, line 3: block B prints at once */''}
dispatch_async(q, ^{ work(50); print("C"); });  // 50 ms, then C`,  // shown code, line 4: block C works 50 ms, then prints C; ends the code
              cands: [['A B C', true, 'Each block finishes before the next one starts, so this is the only possible order.'],  // candidate A B C: possible, and the only possible order
                ['B C A', false, 'B is behind A, and a serial queue will not start B until A has finished, however slow A is.'],  // candidate B C A: impossible, because B cannot start until A has finished
                ['A C B', false, 'B was queued before C, so B runs (and prints) before C even starts.'],  // candidate A C B: impossible, because B was queued before C
                ['C B A', false, 'C is last in line; it cannot start until A and B are both done.']],  // candidate C B A: impossible, because C is last in line
              pic: [['q', 'serial', 'ABC', 'one pool thread at a time']],  // queue picture for puzzle 1: q, serial, holding A B C, one pool thread at a time
              hint: 'Ask yourself: can this queue start B while A is still running?',  // hint for puzzle 1: can this queue start B while A is running?
              sum: 'A serial queue is first in, first out <b>and</b> one at a time, so the print order always equals the order of submission. The durations do not matter at all.' },  // summary for puzzle 1: serial means FIFO and one at a time, so print order equals submission order; closes puzzle 1
            { nm: 'Concurrent', setup: 'The same three blocks go into a <b>global concurrent</b> queue on a 4-core Mac.',  // puzzle 2 (Concurrent): the same three blocks on a global concurrent queue on a 4-core Mac
              code: `${/* code shown for puzzle 2 */''}
// g is a global (concurrent) queue${/* shown code, line 1: says g is a global concurrent queue */''}
dispatch_async(g, ^{ work(300); print("A"); }); // 300 ms, then A${/* shown code, line 2: block A works 300 ms, then prints A */''}
dispatch_async(g, ^{ print("B"); });            // B at once${/* shown code, line 3: block B prints at once */''}
dispatch_async(g, ^{ work(50); print("C"); });  // 50 ms, then C`,  // shown code, line 4: block C works 50 ms, then prints C; ends the code
              cands: [['B C A', true, 'The most likely order: B has no work, C a little, A the most.'],  // candidate B C A: possible, and the most likely order
                ['C B A', true, 'B and C run at the same time on different threads, so either may print first.'],  // candidate C B A: possible, since B and C run at the same time on different threads
                ['B A C', true, 'Unlikely but allowed: if C’s thread is paused by the kernel, A can overtake it.'],  // candidate B A C: possible but unlikely, if the kernel pauses C's thread
                ['A B C', true, 'Unlikely but allowed: a busy machine can delay the threads running B and C.']],  // candidate A B C: possible but unlikely, if B and C are delayed on a busy machine
              pic: [['g', 'concurrent', 'ABC', 'any free pool threads, side by side']],  // queue picture for puzzle 2: g, concurrent, holding A B C, served by any free pool threads
              hint: 'Once a block has left a concurrent queue, does GCD wait for it to finish before handing out the next one?',  // hint for puzzle 2: does GCD wait for a block to finish before handing out the next?
              sum: 'A concurrent queue only promises that A, B and C are <b>taken off</b> the queue in that order. After that they run side by side and may finish in any order; durations make some orders likelier, never certain.' },  // summary for puzzle 2: only the order of leaving the queue is promised, not the finish order; closes puzzle 2
            { nm: 'Two queues', setup: 'Blocks go into two different queues: a <b>serial</b> queue s and a <b>concurrent</b> queue g.',  // puzzle 3 (Two queues): blocks split between a serial queue s and a concurrent queue g
              code: `${/* code shown for puzzle 3 */''}
// s is a SERIAL queue; g is a global queue${/* shown code, line 1: says s is serial and g is a global queue */''}
dispatch_async(s, ^{ print("A"); }); // A goes into s${/* shown code, line 2: block A goes into s */''}
dispatch_async(g, ^{ print("C"); }); // C goes into g${/* shown code, line 3: block C goes into g */''}
dispatch_async(s, ^{ print("B"); }); // B waits behind A in s`,  // shown code, line 4: block B goes into s, behind A; ends the code
              cands: [['A C B', true, 'A runs, C runs on another thread, then B follows A.'],  // candidate A C B: possible
                ['C A B', true, 'C is on a different queue, so nothing stops it from printing first.'],  // candidate C A B: possible, since C is on a different queue
                ['B A C', false, 'B is behind A in the same serial queue, so A must print before B.'],  // candidate B A C: impossible, because A must print before B in the same serial queue
                ['C B A', false, 'Again B before A: impossible while they share a serial queue.']],  // candidate C B A: impossible for the same reason
              pic: [['s', 'serial', 'AB', 'one pool thread at a time'], ['g', 'concurrent', 'C', 'any free pool thread']],  // queue picture for puzzle 3: s holds A and B; g holds C
              hint: 'Which blocks share a queue? Only blocks in the same serial queue are ordered with respect to each other.',  // hint for puzzle 3: only blocks in the same serial queue are ordered with respect to each other
              sum: 'Order is promised only <b>within</b> one serial queue: A must come before B. C, on another queue, may land anywhere, so A B C, A C B and C A B are all possible.' },  // summary for puzzle 3: order is promised only within one serial queue; closes puzzle 3
            { nm: 'Round trip', setup: 'This code runs <b>on the main thread</b>, inside a button handler. <code>main</code> stands for the main queue.',  // puzzle 4 (Round trip): code inside a button handler on the main thread sends work out and back
              code: `${/* code shown for puzzle 4 */''}
print("1");                 // prints immediately${/* shown code, line 1: prints 1 straight away on the main thread */''}
dispatch_async(g, ^{        // queue a block on a global queue${/* shown code, line 2: queues a block on a global queue */''}
    print("2");             // runs later, on a pool thread${/* shown code, line 3: that block prints 2 on a pool thread */''}
    dispatch_async(main, ^{ // queue a block on the main queue${/* shown code, line 4: it then queues another block on the main queue */''}
        print("3");         // needs the main thread${/* shown code, line 5: that inner block prints 3, which needs the main thread */''}
    });                     // end of the main-queue block${/* shown code, line 6: end of the main-queue block */''}
});                         // end of the global-queue block${/* shown code, line 7: end of the global-queue block */''}
print("4");                 // the handler carries on at once`,  // shown code, line 8: the handler prints 4 without waiting; ends the code
              cands: [['1 4 2 3', true, 'The handler reaches 4 before the pool thread gets going; 3 runs once the main thread is free.'],  // candidate 1 4 2 3: possible
                ['1 2 4 3', true, 'The pool thread can print 2 before the handler reaches line 8. 3 still waits for the handler to return.'],  // candidate 1 2 4 3: possible, if the pool thread prints 2 before the handler reaches line 8
                ['1 2 3 4', false, '3 must run on the main thread, which is still busy with this handler. It can only run after 4.'],  // candidate 1 2 3 4: impossible, because 3 needs the main thread, which is still busy with the handler
                ['4 1 2 3', false, 'Lines 1 and 8 run on the same thread in program order, so 1 always comes before 4.']],  // candidate 4 1 2 3: impossible, because lines 1 and 8 run in program order on one thread
              pic: [['g', 'concurrent', '2', 'any free pool thread'], ['main', 'serial', '3', 'only the main thread']],  // queue picture for puzzle 4: g holds block 2 for any pool thread; main holds block 3 for the main thread only
              hint: 'Which thread runs blocks from the main queue, and what is that thread busy doing when line 8 runs?',  // hint for puzzle 4: what is the main thread busy doing when line 8 runs?
              sum: '<code>dispatch_async</code> never waits, so line 8 is not held up. But the main queue is serial and served only by the main thread, so 3 cannot start until the handler (which prints 4) has returned.' },  // summary for puzzle 4: dispatch_async never waits, but block 3 must wait for the handler to return; closes puzzle 4
          ];  // closes the PUZ list
          let p = 0;  // p is the puzzle currently shown
          const ans = PUZ.map((pz) => pz.cands.map(() => null)), checked = PUZ.map(() => false);  // ans[p][i] is the student's answer for candidate i (true, false, or null for undecided); checked[p] says whether puzzle p was checked
          const setup = h('p', { class: 'm0' }), codeBox = h('div'), sumBox = h('div'), candBox = h('div', { class: 'stack gap-s', style: { flex: 'none' } }), score = h('span', { class: 'b' });  // page elements that paint() fills: setup text, code, summary, candidate list and score
          const hintBox = h('div');  // hintBox holds the "Show a hint" button
          // shown only before checking: the only three guarantees that can rule an order out
          const rules = h('div', { class: 'card tight stack gap-s' }, h('h4', {}, 'How to decide: only these guarantees make an order impossible'),  // rules card: the three guarantees that can make an order impossible, shown only before checking
            h('ol', { class: 'small m0', style: { paddingLeft: '20px' }, html: '<li>Blocks in the <b>same serial queue</b> run one at a time, in queued order.</li><li>Lines on <b>one thread</b> run in program order.</li><li>A <b>main-queue</b> block waits until the main thread is free.</li>' }),  // the three guarantees: same serial queue, program order on one thread, main-queue blocks wait for the main thread
            hintBox);  // the hint button sits at the bottom of the rules card; closes it
          const picBox = h('div', { class: 'card tight qpics' });  // picBox is the card that pictures the puzzle's queues
          // one row per queue in the puzzle: name + kind, its blocks (front on the right), and who serves it
          const qpRow = ([nm, kind, tiles, to]) => h('div', { class: 'qp', style: ctx.narrow ? { gridTemplateColumns: 'max-content max-content 14px minmax(0,1fr)' } : null },  // qpRow(...) builds one queue row: name and kind, the waiting blocks, an arrow, and who runs them; auto-sized columns on a phone-width screen
            h('span', { class: 'nmq' }, nm, h('span', { class: 'chip ' + (kind === 'serial' ? 'proc' : 'cpu') }, kind)),  // the queue's name with its serial or concurrent chip
            h('div', { class: 'qline' }, ...[...tiles].map((c) => h('span', { class: 'tile sm ' + TILE[('ABC123'.indexOf(c) + 3) % TILE.length] }, c))),  // the queue's blocks as small tiles, each coloured by its label so a letter looks the same in every puzzle
            h('span', { class: 'qarr' }, '→'),  // arrow toward whoever runs the blocks
            h('span', { class: 'small' }, to));  // who runs them, in small text; closes the row
          const bCheck = h('button', { type: 'button', class: 'btn primary', onclick: () => { checked[p] = true; paint(); } }, 'Check my answers');  // Check button: marks the current puzzle as checked and repaints
          const bAgain = h('button', { type: 'button', class: 'btn', onclick: () => { checked[p] = false; ans[p] = ans[p].map(() => null); paint(); } }, 'Try again');  // Try again button: unchecks the puzzle and clears its answers
          const seg = ctx.ui.seg(PUZ.map((pz, i) => ({ value: i, label: `${i + 1} · ${pz.nm}` })), 0, (v) => { p = v; paint(); });  // buttons to switch between the four puzzles; switching repaints
          const pick = (i, v) => { if (checked[p]) return; ans[p][i] = v; paint(); };  // pick(i, v) records Possible (true) or Impossible (false) for candidate i, unless the puzzle is already checked
          function paint() {  // paint() redraws the current puzzle; it runs after every choice, check and switch
            const pz = PUZ[p], ck = checked[p];  // pz is the current puzzle and ck says whether it has been checked
            setup.innerHTML = pz.setup;  // shows the puzzle's setup text
            picBox.replaceChildren(h('div', { class: 'xs muted b' }, 'WHO RUNS WHAT · front of each queue on the right'), ...pz.pic.map(qpRow));  // fills the queue picture: a heading, then one row per queue
            codeBox.replaceChildren(ctx.ui.code(pz.code, { lang: 'c', fontSize: 13 }));  // shows the puzzle's code as a highlighted C listing
            candBox.replaceChildren(...pz.cands.map((c, i) => {  // rebuilds the candidate list, one box per candidate order
              const mine = ans[p][i], right = ck ? mine === c[1] : null;  // mine is the student's answer; after checking, right says whether it matches the truth
              return h('div', { class: 'cand' + (right === true ? ' right' : right === false ? ' wrong' : '') },  // the candidate box, green or red after checking
                h('div', { class: 'row nw', style: { justifyContent: 'space-between' } },  // top line of the box
                  h('span', { class: 'ordtxt' }, c[0]),  // the order itself, such as "A B C"
                  h('div', { class: 'row nw', style: { gap: '4px' } },  // the two answer buttons, side by side
                    h('button', { type: 'button', class: 'btn sm' + (mine === true ? ' on' : ''), disabled: ck, onclick: () => pick(i, true) }, 'Possible'),  // Possible button, lit when chosen and disabled after checking
                    h('button', { type: 'button', class: 'btn sm' + (mine === false ? ' on' : ''), disabled: ck, onclick: () => pick(i, false) }, 'Impossible'))),  // Impossible button, lit when chosen and disabled after checking
                ck ? h('div', { class: 'small', style: { marginTop: '4px' }, html: `<b style="color:var(--${right ? 'ok' : 'bad'})">${right ? '✓' : '✗'} ${c[1] ? 'Possible.' : 'Impossible.'}</b> ${c[2]}` }) : null);  // after checking, a line saying whether the student was right, the true answer and why
            }));  // ends the candidate list
            const all = ans[p].every((v) => v !== null);  // all is true when every candidate has an answer
            bCheck.disabled = !all || ck;  // Check is enabled only when all are answered and the puzzle is not yet checked
            bCheck.style.display = ck ? 'none' : '';  // Check is hidden after checking
            bAgain.style.display = ck ? '' : 'none';  // Try again appears only after checking
            const nRight = pz.cands.filter((c, i) => ans[p][i] === c[1]).length;  // nRight counts the candidates judged correctly
            score.textContent = ck ? `${nRight} of ${pz.cands.length} right` : all ? 'Ready to check' : `${ans[p].filter((v) => v !== null).length} of ${pz.cands.length} decided`;  // score text: "N of 4 right" after checking, "Ready to check", or how many have been decided so far
            hintBox.replaceChildren(...(ck ? [] : [ctx.ui.reveal('Show a hint', `<p class="small m0">${pz.hint}</p>`)]));  // before checking, the hint box gets a "Show a hint" reveal button; after checking it is emptied
            hintBox.style.display = ck ? 'none' : '';  // hides the hint box after checking
            rules.style.display = ck ? 'none' : '';  // hides the rules card after checking to make room for the explanations
            // solved puzzles get a tick on their tab instead of a separate panel (keeps the checked view inside the canvas)
            [...seg.children].forEach((b, j) => {  // updates the label on each puzzle button
              const ok = checked[j] && PUZ[j].cands.every((c, i) => ans[j][i] === c[1]);  // a puzzle counts as solved when it was checked and every answer was right
              b.innerHTML = (ok ? '<span style="color:var(--ok)">✓</span> ' : '') + `${j + 1} · ${PUZ[j].nm}`;  // solved puzzles get a green tick in front of their number and name
            });  // ends the label update
            sumBox.replaceChildren(ck ? h('div', { class: 'callout tip m0 small', 'data-label': 'The rule behind it', html: pz.sum }) : h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Assuming the shortest block always prints first. Durations make an order <b>likely</b>, never guaranteed: a thread can be paused at any moment. Only a queue’s rules or program order can rule an order out.' }));  // bottom card: the puzzle's rule after checking, otherwise a warning not to assume the shortest block prints first
          }  // ends paint()
          paint();  // draws the first puzzle once when the step opens
          el.append(h('div', { class: 'split fill' },  // builds the step: two columns
            h('div', { class: 'stack' }, seg, setup, codeBox, picBox, sumBox),  // left column: puzzle switcher, setup, code, queue picture and summary
            h('div', { class: 'stack' },  // right column: the question, the candidates and the controls
              h('p', { class: 'lead m0', html: 'Can each order <b>ever</b> happen, even rarely?' }),  // the question: can each order ever happen, even rarely?
              candBox,  // the candidate boxes
              h('div', { class: 'row' }, bCheck, bAgain, score),  // row with the Check and Try again buttons and the score
              rules)));  // the rules card with the hint at the bottom; closes the layout
        },  // ends render() for step 6
      },  // ends step 6

      /* ---------------- 7. Explore: slow work off the main thread, result back to the main queue ---------------- */
      {  // step 7 (explore): the two-hop pattern that moves slow work off the main thread and brings the result back
        title: 'The classic pattern: analyse a document, keep the app alive',  // title shown at the top of step 7
        kind: 'explore',  // kind 'explore' sets the header label for this step
        core: true,  // core: true keeps this step on the shorter core path
        render(el, ctx) {  // render(el, ctx) builds step 7 when the student opens it
          const { h } = ctx;  // takes the element builder h out of ctx
          const CODE = {  // CODE: the two versions of the button handler shown to students
            gcd: `${/* the GCD version, twelve lines of C */''}
void onAnalyze(Doc *doc) {                 // main thread: user clicked${/* shown code, line 1: the handler for the Analyze button starts on the main thread */''}
  dispatch_queue_t q =                     // choose a queue:${/* shown code, line 2: declares q, the queue to use */''}
    dispatch_get_global_queue(             //   a shared concurrent one${/* shown code, line 3: asks for a global concurrent queue */''}
      DISPATCH_QUEUE_PRIORITY_DEFAULT, 0); //   at default priority${/* shown code, line 4: at default priority */''}
  dispatch_async(q, ^{                     // queue the work, do not wait${/* shown code, line 5: queues a block on q without waiting */''}
    Stats st = analyze(doc);               // pool thread: the slow part${/* shown code, line 6: inside the block, the slow analysis runs on a pool thread */''}
    dispatch_async(                        // send the result back...${/* shown code, line 7: queues a second block... */''}
      dispatch_get_main_queue(), ^{        // ...to the main queue${/* shown code, line 8: ...on the main queue */''}
        showStats(st);                     // main thread: update window${/* shown code, line 9: the second block shows the results on the main thread */''}
      });                                  // end of the UI block${/* shown code, line 10: end of the UI block */''}
  });                                      // end of the work block${/* shown code, line 11: end of the work block */''}
}                                          // handler returns at once`,  // shown code, line 12: the handler returns at once; ends the GCD version
            naive: `${/* the version that does everything on the main thread, four lines of C */''}
void onAnalyze(Doc *doc) {                 // main thread: user clicked${/* shown code, line 1: the same handler starts on the main thread */''}
  Stats st = analyze(doc);                 // slow work ON the main thread${/* shown code, line 2: runs the slow analysis right there, on the main thread */''}
  showStats(st);                           // update the window${/* shown code, line 3: updates the window */''}
}                                          // only now can events run`,  // shown code, line 4: only when the handler returns can other events run; ends this version
          };  // closes CODE
          // m = main thread, p = pool thread, gq / mq = contents of global / main queue, prog = analysis %, ui = can the app react?
          const F = {  // F: the frames of the walk-through for each version; each lists code lines to highlight, thread and queue states, progress and caption
            gcd: [  // frames for the GCD version
              { ln: [1], m: 'running onAnalyze()', p: 'idle', gq: '', mq: '', prog: 0, ui: true, cap: 'The user clicks <b>Analyze</b>. Clicks are events, and events are handled on the <b>main thread</b>, so it starts running the handler.' },  // frame 1: the click event makes the main thread start the handler
              { ln: [2, 3, 4], m: 'running onAnalyze()', p: 'idle', gq: '', mq: '', prog: 0, ui: true, cap: 'The handler picks a <b>global queue</b> at default priority: a concurrent queue that the whole app shares.' },  // frame 2: the handler picks a global queue at default priority
              { ln: [5], m: 'running onAnalyze()', p: 'idle', gq: 'analyze block', mq: '', prog: 0, ui: true, cap: '<b>dispatch_async</b> puts the analysis block on that queue and <b>returns immediately</b>. It does not wait for the block to run.' },  // frame 3: dispatch_async puts the analysis block on the global queue and returns immediately
              { ln: [12], m: 'idle: waiting for events', p: 'took the analyze block', gq: '', mq: '', prog: 0, ui: true, cap: 'The handler returns at once, so the main thread is back in its event loop. A pool thread has taken the block off the global queue.' },  // frame 4: the handler has returned, and a pool thread takes the block
              { ln: [6], m: 'free: handles your scrolls', p: 'analyze(doc) …', gq: '', mq: '', prog: 40, ui: true, cap: 'The pool thread runs <b>analyze(doc)</b>, the slow part (it could take seconds). Press <b>Scroll</b> in the window: the main thread is free, so it reacts.' },  // frame 5: the pool thread analyses (40%) while the main thread stays free to handle scrolls
              { ln: [6], m: 'free: handles your scrolls', p: 'analyze(doc) …', gq: '', mq: '', prog: 80, ui: true, cap: 'Still analysing on the pool thread. The user can keep scrolling, typing or even press Cancel.' },  // frame 6: still analysing (80%); the user can keep working
              { ln: [7, 8], m: 'free: handles your scrolls', p: 'dispatch_async(main queue)', gq: '', mq: 'showStats block', prog: 100, ui: true, cap: 'Analysis done. Window code must run on the main thread, so the block sends a <b>second block</b>, showStats, to the <b>main queue</b>. It does not wait for it.' },  // frame 7: analysis done; the block sends showStats to the main queue without waiting
              { ln: [10, 11], m: 'free: handles your scrolls', p: 'idle: back in the pool', gq: '', mq: 'showStats block', prog: 100, ui: true, cap: 'The analysis block ends and its thread goes back to the pool, ready for other work. The captured <code>st</code> travels inside the UI block.' },  // frame 8: the analysis block ends and its thread goes back to the pool; st travels inside the UI block
              { ln: [9], m: 'running showStats()', p: 'idle', gq: '', mq: '', prog: 100, ui: true, stats: true, cap: 'Between two events, the main thread takes the UI block from the main queue and runs <b>showStats</b>: the results appear.' },  // frame 9: between events, the main thread runs showStats and the results appear
              { ln: [], m: 'idle: waiting for events', p: 'idle', gq: '', mq: '', prog: 100, ui: true, stats: true, cap: '<b>Done.</b> The main thread was never busy for more than a moment, so the app never froze. This two-hop pattern is how GCD code keeps apps responsive.' },  // frame 10: done; the main thread was never busy for more than a moment
            ],  // closes the GCD frames
            naive: [  // frames for the all-on-the-main-thread version
              { ln: [1], m: 'running onAnalyze()', p: 'idle (unused)', gq: '', mq: '', prog: 0, ui: true, cap: 'The user clicks <b>Analyze</b>, and the main thread starts running the handler.' },  // frame 1: the click starts the handler on the main thread
              { ln: [2], m: 'stuck in analyze(doc)', p: 'idle (unused)', gq: '', mq: '', prog: 35, ui: false, cap: 'This version calls <b>analyze(doc)</b> directly, <b>on the main thread</b>. Until it returns, no event can be handled. Press <b>Scroll</b> and see.' },  // frame 2: analyze(doc) runs on the main thread and the app stops reacting (ui false)
              { ln: [2], m: 'stuck in analyze(doc)', p: 'idle (unused)', gq: '', mq: '', prog: 75, ui: false, cap: 'Still analysing. The system notices the app has stopped answering events and shows the <b>spinning wait cursor</b>. Every click just piles up.' },  // frame 3: still analysing; the system shows the spinning wait cursor
              { ln: [3], m: 'running showStats()', p: 'idle (unused)', gq: '', mq: '', prog: 100, ui: false, stats: true, cap: 'Finally the analysis returns and showStats updates the window, still inside the same handler.' },  // frame 4: the analysis returns and showStats updates the window, still inside the handler
              { ln: [4], m: 'idle: catching up', p: 'idle (unused)', gq: '', mq: '', prog: 100, ui: true, stats: true, cap: 'Only now does the handler return. Any scrolls that piled up are handled all at once. The app was frozen for the whole analysis, and the other cores did nothing.' },  // frame 5: the handler returns at last and the piled-up scrolls are handled all at once
            ],  // closes these frames
          };  // closes F
          /* per-thread timeline (time 0..10) and where each frame sits on it */
          const TL = {  // TL: the per-thread timeline for each version on a 0 to 10 scale, plus where the marker sits for each frame
            gcd: { main: [[0, 1.25, 'handler', 's-thread'], [1.25, 7.8, 'free: answers every event', 's-ok'], [7.8, 9.6, 'showStats', 's-thread'], [9.6, 10, '', 's-ok']], pool: [[1.25, 7.4, 'analyze(doc)', 's-os']],  // GCD timeline: the main thread is busy only briefly (handler, showStats); the pool thread does the analysis
              at: [0.25, 0.6, 0.95, 1.4, 3.2, 6, 7.3, 7.6, 8.7, 10] },  // marker positions for the ten GCD frames
            naive: { main: [[0, 0.5, '', 's-thread'], [0.5, 7.8, 'analyze(doc): app frozen', 's-bad'], [7.8, 9.6, 'showStats', 's-thread'], [9.6, 10, '', 's-ok']], pool: [],  // main-thread-only timeline: the main thread is frozen for most of it and the pool thread is never used
              at: [0.3, 3, 6, 8.7, 9.8] },  // marker positions for the five frames of that version
          };  // closes TL
          // phones get a narrower drawing (so 13px text stays readable) with shorter row names and segment labels
          const NW = ctx.narrow, TVW = NW ? 360 : 600, TX0 = NW ? 46 : 104, TU = NW ? 31 : 48.5;  // drawing sizes: total width, where the bars start (TX0), and units per timeline step (TU), smaller on a phone-width screen
          const SHORT = { handler: '', 'free: answers every event': 'free', showStats: 'show', 'analyze(doc): app frozen': 'app frozen' };  // SHORT: shorter segment labels used when the full label does not fit
          const fitLabel = (t, w) => (t.length * 7.6 <= w - 6 ? t : SHORT[t] != null && SHORT[t].length * 7.6 <= w - 6 ? SHORT[t] : '');  // fitLabel(t, w) returns the full label if it fits width w (about 7.6 units per character), else the short one, else nothing
          const tl = ctx.s('svg', { viewBox: `0 0 ${TVW} 70`, width: '100%', role: 'img', 'aria-label': 'What the main thread and a pool thread do over time' });  // tl is the SVG timeline drawing for the two threads
          function drawTL(i) {  // drawTL(i) redraws the timeline and moves the marker to frame i
            const T = TL[mode], X = (v) => TX0 + v * TU, k = [];  // T is the timeline for the current version; X converts a 0-10 time to a horizontal position; k collects the shapes
            [['main thread', T.main, 2], ['pool thread', T.pool, 38]].forEach(([nm, segs, y]) => {  // draws two rows, the main thread at the top and a pool thread below
              k.push(ctx.s('text', { x: TX0 - 8, y: y + 21, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 700, style: `fill:var(${nm === 'main thread' ? '--thread' : '--os'})` }, NW ? nm.split(' ')[0] : nm));  // the row label, coloured by thread type ("main" or "pool" alone on a phone-width screen)
              k.push(ctx.s('rect', { x: X(0), y, width: X(10) - X(0), height: 30, rx: 6, class: 's-panel', 'stroke-width': 1 }));  // the row's pale background strip
              if (!segs.length) k.push(ctx.s('text', { x: X(0) + 10, y: y + 20, 'font-size': 13, class: 's-sub' }, 'never used'));  // if the thread is never used in this version, says so
              segs.forEach(([a, b, t, c]) => {  // draws each segment of what the thread was doing
                k.push(ctx.s('rect', { x: X(a) + 1, y: y + 3, width: X(b) - X(a) - 2, height: 24, rx: 5, class: c, 'stroke-width': 1.5 }));  // the segment's coloured bar
                const lab = t && fitLabel(t, X(b) - X(a));  // its label, if one fits
                if (lab) k.push(ctx.s('text', { x: (X(a) + X(b)) / 2, y: y + 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, lab));  // draws the label in the middle of the bar
              });  // ends the segment loop
            });  // ends the row loop
            const x = X(T.at[i]);  // x is where this frame's marker goes
            k.push(ctx.s('line', { x1: x, y1: 0, x2: x, y2: 70, style: 'stroke:var(--accent)', 'stroke-width': 2.5 }));  // the vertical marker line in the highlight colour
            tl.replaceChildren(...k);  // replaces the old drawing with the new shapes
          }  // ends drawTL()
          const mistake = h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Doing slow work (reading big files, waiting for the network, long calculations) straight inside an event handler. The app freezes, and the other cores sit idle.' });  // warning: doing slow work straight inside an event handler freezes the app; shown only for the main-thread-only version
          let mode = 'gcd', handled = 0, waiting = 0, cur = F.gcd[0];  // state: which version, scrolls handled, scrolls waiting while frozen, and the current frame
          const codeBox = h('div');  // codeBox holds the code listing so it can be swapped when the version changes
          let code = null;  // code will hold the current code listing
          const docLines = h('div', { class: 'doclines' });  // docLines holds the grey bars that stand for lines of the document in the pretend window
          const statusEl = h('div', { class: 'small' }), bar = h('div', { class: 'meter' }, h('i'));  // statusEl is the status text under the document; bar is the analysis progress bar
          const freeze = h('div', { class: 'freeze' }, h('span', { class: 'spin' }), h('b', {}, 'Not responding'));  // freeze is the "Not responding" cover with the spinning cursor
          const mEl = h('span', { class: 'b' }), pEl = h('span', { class: 'b' }), gqEl = h('span'), mqEl = h('span'), scrollInfo = h('div', { class: 'small' });  // texts for the status card: main thread, pool thread, global queue, main queue, plus the scroll counter
          function paintDoc() {  // paintDoc() redraws the document lines and the scroll counter
            docLines.replaceChildren(...ctx.util.range(5).map((k) => h('div', { class: 'dl', style: { width: (55 + ((k + handled) * 37) % 40) + '%' } })));  // five bars whose widths shift with each handled scroll, so the document appears to move
            scrollInfo.innerHTML = `Scrolls handled: <b>${handled}</b> · waiting in line: <b style="color:var(${waiting ? '--bad' : '--ink'})">${waiting}</b>`;  // scroll counter: how many scrolls were handled and how many are waiting (red when any are waiting)
          }  // ends paintDoc()
          function draw(i) {  // draw(i) shows frame i of the current version and returns its caption; the player calls it
            const f = F[mode][i];  // f is the frame's data
            cur = f;  // remembers the frame so the Scroll button knows whether the app can react right now
            code.clear(); if (f.ln.length) code.mark(f.ln);  // highlights the code lines for this frame
            if (f.ui && waiting) { handled += waiting; waiting = 0; }  // when the app can react again, all waiting scrolls are handled at once
            paintDoc();  // redraws the document lines and the scroll counter
            statusEl.innerHTML = f.stats ? '<b>Words 12,408 · Sentences 731 · Reading level: grade 9</b>' : f.prog ? `Analysing… ${f.prog}%` : 'Press Analyze to count words and sentences.';  // status text: the finished statistics, the analysis percentage, or the starting instruction
            bar.firstChild.style.width = f.prog + '%';  // sets the progress bar's length to the analysis percentage
            freeze.style.display = f.ui ? 'none' : 'flex';  // shows the "Not responding" cover only while the app cannot react
            mEl.textContent = f.m; mEl.style.color = f.ui ? 'var(--ok)' : 'var(--bad)';  // writes what the main thread is doing, green when the app can react and red when it cannot
            pEl.textContent = f.p;  // writes what the pool thread is doing
            const chip = (t, c) => (t ? h('span', { class: 'chip ' + c }, t) : h('span', { class: 'xs muted' }, 'empty'));  // chip(t, c) shows a queue's contents as a coloured chip, or "empty"
            gqEl.replaceChildren(chip(f.gq, 'os')); mqEl.replaceChildren(chip(f.mq, 'thread'));  // shows what is waiting in the global queue and in the main queue
            drawTL(i);  // moves the timeline marker to this frame
            mistake.style.display = mode === 'naive' ? '' : 'none';  // shows the common-mistake warning only for the all-on-the-main-thread version
            return f.cap;  // returns the frame's caption for the player to display
          }  // ends draw()
          function build() { code = ctx.ui.code(CODE[mode], { lang: 'c', fontSize: 12.5 }); codeBox.replaceChildren(code); }  // build() makes a fresh highlighted listing of the current version's code and puts it in the code box
          const scroll = () => {  // scroll() runs when the student presses Scroll in the pretend window
            if (cur.ui) { handled++; paintDoc(); ctx.toast('Scrolled: the main thread handled it at once.'); }  // if the app can react, the scroll is handled at once and a message says so
            else { waiting++; paintDoc(); ctx.toast('Nothing moves: the main thread is stuck inside analyze().'); }  // otherwise the scroll waits in line and a message says the main thread is stuck
          };  // ends scroll()
          const seg = ctx.ui.seg([{ value: 'gcd', label: 'With GCD (two hops)' }, { value: 'naive', label: 'All on the main thread' }], mode, (v) => { mode = v; handled = 0; waiting = 0; build(); player.setCount(F[mode].length); });  // switch between the two versions; switching resets the scroll counts, rebuilds the code and restarts the player with the right number of frames
          build();  // builds the first code listing when the step opens
          const player = ctx.ui.player({ count: F.gcd.length, render: draw, interval: 2000, speed: false });  // the step-through player for the frames, 2 s apart when playing, with no speed buttons
          el.append(h('div', { class: 'split r fill' },  // builds the step: code and timeline on the left, the pretend window and status card on the right
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column, stacked
              h('div', { class: 'ctl' }, h('span', { class: 'lbl' }, 'Version:'), seg),  // the version switch with its label
              codeBox, player.el,  // the code listing and the player
              h('div', { class: 'card white tight' }, h('h4', {}, 'What each thread does over time →'), tl), mistake),  // card with the thread timeline, then the warning (hidden in the GCD version); closes the left column
            h('div', { class: 'stack', style: { gap: '9px' } },  // right column, stacked
              h('div', { class: 'win' },  // the pretend application window
                h('div', { class: 'win-bar' }, h('i'), h('i'), h('i'), h('span', { class: 'xs b' }, 'Essay.txt · Analyzer')),  // title bar with three window buttons and the document's name
                h('div', { class: 'win-body' }, docLines, statusEl, bar,  // window body: document lines, status text, progress bar
                  h('div', { class: 'row', style: { gap: '8px' } }, h('button', { type: 'button', class: 'btn sm', onclick: scroll }, 'Scroll ↓'), scrollInfo)),  // the Scroll button and the scroll counter; closes the window body
                freeze),  // the frozen-window cover sits on top of the body; closes the window
              h('div', { class: 'card tight stack gap-s' },  // status card showing each thread and queue
                h('div', { class: 'lane' }, h('span', { class: 'chip thread' }, 'main thread'), mEl),  // row: what the main thread is doing
                h('div', { class: 'lane' }, h('span', { class: 'chip os' }, 'pool thread'), pEl),  // row: what the pool thread is doing
                h('div', { class: 'lane' }, h('span', { class: 'xs muted b' }, 'GLOBAL QUEUE'), gqEl),  // row: what is in the global queue
                h('div', { class: 'lane' }, h('span', { class: 'xs muted b' }, 'MAIN QUEUE'), mqEl)),  // row: what is in the main queue; closes the card
              h('div', { class: 'callout why m0 small', 'data-label': 'Why two hops?', html: 'Slow work must leave the main thread so the app stays responsive, but window code must run on the main thread (the same rule as on Android, section 4.7). So the work goes out to a global queue, and the result comes back on the main queue. (Each <code>^{ … }</code> is a <span class="t" data-t="Block (GCD)">block</span>: a piece of work that <span class="t">dispatch_async</span> puts on a queue for a pool thread to run.)' }))));  // callout: why two hops (slow work leaves the main thread, window code must come back to it); closes the layout
        },  // ends render() for step 7
      },  // ends step 7

      /* ---------------- 8. Recap ---------------- */
      {  // step 8 (recap): flip cards for the six key ideas and the pattern to remember
        title: 'Recap: six things to remember about GCD',  // title shown at the top of step 8
        kind: 'recap',  // kind 'recap' sets the header label for this step
        render(el, ctx) {  // render(el, ctx) builds step 8 when the student opens it
          const { h } = ctx;  // takes the element builder h out of ctx
          const code = ctx.ui.code(`${/* builds a highlighted listing of the two-hop pattern shown to students */''}
dispatch_async(global_queue, ^{    // leave the main thread${/* shown code, line 1: send a block to a global queue to leave the main thread */''}
    Result r = slow_work();        // runs on a pool thread${/* shown code, line 2: the slow work runs on a pool thread */''}
    dispatch_async(main_queue, ^{  // come back to the main thread${/* shown code, line 3: send a block to the main queue to come back */''}
        update_ui(r);              // main thread; r came along${/* shown code, line 4: update the screen on the main thread with the captured result */''}
    });                            // end of the UI block${/* shown code, line 5: end of the UI block */''}
});                                // end of the work block`, { lang: 'c', fontSize: 13 });  // shown code, line 6: end of the work block; closes the listing
          el.append(h('div', { class: 'stack fill' },  // builds the step: everything stacked in one column
            h('p', { class: 'lead m0' }, 'Say each answer out loud, then click the card to check yourself.'),  // instruction: say each answer out loud, then click to check
            ctx.ui.flipcards([  // flip cards: a question on the front and its answer on the back
              ['What does a programmer hand to GCD?', 'Tasks, written as blocks and put on dispatch queues. Never threads: GCD creates, reuses and schedules those.'],  // flip card: what a programmer hands to GCD (tasks as blocks on queues, never threads)
              ['What is a block?', 'An unnamed function written with a caret, ^{ … }: an extension to C, Objective-C and C++ that captures the variables it uses (a closure).'],  // flip card: what a block is
              ['Serial queue or concurrent queue?', 'Both hand blocks out in FIFO order. Serial: one at a time, each finishes before the next starts. Concurrent: several at once, finishing in any order.'],  // flip card: serial versus concurrent queues
              ['What is special about the main queue?', 'It is serial and its blocks run on the main thread, which handles events and the window. Never put slow work there.'],  // flip card: what is special about the main queue
              ['How big is GCD’s thread pool?', 'About one worker per core (the degree of concurrency), plus extra workers while some are blocked waiting for I/O.'],  // flip card: how big GCD's thread pool is
              ['What does a dispatch source do?', 'Watches for an event (a timer, a signal, a readable file descriptor, a process exiting) and queues a handler block when it happens; events that pile up first are merged into one run.'],  // flip card: what a dispatch source does
            ], { cols: ctx.narrow ? 1 : 3, height: 118 }),  // closes the cards; three columns (one on a phone-width screen), each card 118px tall
            h('div', { class: 'split', style: { height: 'auto', gridTemplateColumns: ctx.narrow ? '1fr' : 'minmax(0, 7fr) minmax(0, 5fr)' } },  // bottom row with two cards side by side (stacked on a phone-width screen)
              h('div', { class: 'card white stack gap-s' }, h('h4', {}, 'The pattern to remember'), code),  // card showing the pattern to remember
              h('div', { class: 'card stack gap-s' }, h('h4', {}, 'Where GCD fits'),  // card placing GCD in context
                h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'chip accent' }, 'Mac OS X 10.6 Snow Leopard'), h('span', { class: 'chip os' }, 'OS-managed thread pool'), h('span', { class: 'chip thread' }, 'blocks + queues')),  // chips: when GCD shipped and what it is
                h('p', { class: 'small m0', html: 'Thread pools are old news in servers and Windows. GCD’s contribution is the language support: blocks make a whole unit of work easy to split off, and queues keep the order and dependencies between its parts.' })))));  // paragraph: pools are old, and GCD's addition is the language support; closes the layout
        },  // ends render() for step 8
      },  // ends step 8

      /* ---------------- 9. Check yourself ---------------- */
      {  // step 9 (check): the section quiz
        title: 'Check yourself: Grand Central Dispatch',  // title shown at the top of step 9
        kind: 'check',  // kind 'check' sets the header label for this step
        quiz: [  // quiz: the questions; the shell's quiz engine shows them one at a time and saves the score
          { q: 'When a program uses Grand Central Dispatch, what does the programmer hand to the system?',  // quiz question 1 (multiple choice): what the programmer hands to GCD
            choices: ['A number of threads to create, one for each core', 'Units of work written as blocks, placed on dispatch queues', 'A list of cores on which each thread must run', 'Finished threads that GCD only has to start'],  // the four choices; only the second one (blocks on queues) is right
            answer: 1,  // answer is the index of the correct choice, counting from 0
            feedback: ['Choosing a thread count is exactly the job GCD takes away: it sizes its own pool to the machine.', null, 'The programmer never pins work to cores; the kernel schedules GCD’s pool threads onto cores.', 'With GCD the programmer does not create threads at all; GCD creates, reuses and retires them.'],  // feedback for each wrong choice (null where the choice is right)
            why: 'With GCD you name the work, not the threads. Each task is written as a block and put on a queue; GCD maps those blocks onto a pool of threads it manages, about one per core.' },  // why: the explanation shown after answering; closes question 1
          { type: 'tf', q: 'A serial dispatch queue always runs all of its blocks on the same thread.', answer: false,  // quiz question 2 (true or false): a serial queue always uses the same thread (false)
            why: 'A serial queue promises only that its blocks run one at a time, in order. Each block can be run by whichever pool thread is free, so different blocks may use different threads; they just never overlap.' },  // why: a serial queue promises order, not a particular thread; closes question 2
          { q: 'Blocks A, B and C are added, in that order, to a <b>concurrent</b> dispatch queue on a 4-core machine. What does the queue guarantee?',  // quiz question 3 (multiple choice): what a concurrent queue guarantees about A, B and C
            choices: ['They finish in the order A, B, C', 'They run one at a time, A then B then C', 'They are started (taken off the queue) in the order A, B, C, but may run at the same time and finish in any order', 'Nothing at all: they may even be started in any order'],  // choices: finish order, one at a time, start order only, or random order
            answer: 2,  // the third choice is right: they start in order but may overlap
            feedback: ['Finish order is not promised: a short block that started later can finish first.', 'That describes a serial queue. A concurrent queue lets several blocks run at once.', null, 'Every dispatch queue is FIFO, so the start order is guaranteed; only the finish order is open.'],  // feedback for the wrong choices
            why: 'Every dispatch queue hands blocks out first in, first out. A concurrent queue does not wait for one block to finish before handing out the next, so blocks overlap and can finish in any order.' },  // why: every queue hands blocks out FIFO, but a concurrent one does not wait; closes question 3
          { type: 'multi', q: 'Which statements about the <b>main queue</b> are true? Select all that apply.',  // quiz question 4 (select all): true statements about the main queue
            choices: ['It is a serial queue', 'Its blocks run on the application’s main thread', 'It is the right place to update the user interface', 'It is the best place for slow work, because it is always available', 'It is one of the concurrent global queues'],  // choices: serial, main thread, place for UI updates, place for slow work
            answer: [0, 1, 2],  // the first three are right
            why: 'The main queue is serial and served by the main thread, the thread that handles events and draws the window. UI updates belong there; slow work does not, because while a block runs on it the app cannot respond. The global queues are a separate, concurrent set.' },  // why: the main queue is serial on the main thread; slow work there freezes the app; closes question 4
          { type: 'match', q: 'Match each GCD object to what it does.',  // quiz question 5 (match): match each GCD object to its job
            pairs: [['Main queue', 'Serial; runs on the main thread'], ['Global queue', 'Concurrent; shared, by priority'], ['Private serial queue', 'App-made; can stand in for a lock'], ['Dispatch source', 'Turns events into queued blocks']],  // the pairs: main queue, global queue, private serial queue and dispatch source
            why: 'The main queue serves the user interface, the global queues run independent background work at a chosen priority (high, default, low, and background since 10.7), a private serial queue can replace a lock, and a dispatch source turns events such as timers or signals into queued blocks.' },  // why: what each object is for; closes question 5
          { type: 'order', q: 'A button handler on the main thread uses GCD to analyse a document without freezing the app. Put the events in order.',  // quiz question 6 (put in order): the steps of the two-hop document analysis
            items: ['The user clicks Analyze and the main thread starts running the handler', 'The handler calls dispatch_async to put an analysis block on a global queue', 'A pool thread takes the block off the queue and runs the slow analysis', 'The analysis block calls dispatch_async to put a UI block on the main queue', 'The main thread runs the UI block and shows the results'],  // the steps, listed in their correct order (the quiz shuffles them)
            why: 'Each event causes the next. dispatch_async returns at once, so the handler finishes right away and the main thread stays free while a pool thread does the slow part. The result travels back as a second block on the main queue, because window code must run on the main thread.' },  // why: each step causes the next; closes question 6
          { type: 'num', q: 'Three blocks that take 300 ms, 100 ms and 200 ms are added, in that order, to a <b>serial</b> queue on an otherwise idle 4-core machine. How many milliseconds after the first block starts does the last block finish?',  // quiz question 7 (calculate): when three blocks of 300, 100 and 200 ms finish on a serial queue
            answer: 600, tol: 0, unit: 'ms',  // answer 600 ms, with no tolerance
            why: 'A serial queue runs one block at a time no matter how many cores are free: 300 + 100 + 200 = 600 ms. The other three cores do nothing for this queue.' },  // why: a serial queue runs one block at a time, so the times simply add up; closes question 7
          { type: 'num', q: 'Four blocks that take 300, 100, 200 and 100 ms are added, in that order, to a <b>concurrent</b> queue served by <b>2</b> pool threads. Each time a thread becomes free it takes the block at the front of the queue. When does the last block finish (in ms)?',  // quiz question 8 (calculate): when the last of four blocks finishes on a concurrent queue with 2 threads
            answer: 400, tol: 0, unit: 'ms',  // answer 400 ms, with no tolerance
            hint: 'At time 0 both threads take a block. Track when each thread becomes free.',  // hint: both threads take a block at time 0; track when each becomes free
            why: 'At 0, thread 1 takes the 300 ms block and thread 2 the 100 ms block. At 100 thread 2 is free and takes the 200 ms block (busy until 300). At 300 both are free; one takes the last 100 ms block, finishing at 400 ms.' },  // why: walks through the two threads' schedule to reach 400 ms; closes question 8
          { q: 'What does this code print?',  // quiz question 9 (multiple choice): what a small block program prints
            code: 'int x = 5;               // ordinary local variable\nvoid (^show)(void) = ^{  // create a block\n    printf("%d\\n", x);   // the block uses x\n};                       // end of the block\nx = 9;                   // change x after the block exists\nshow();                  // run the block',  // the code shown with the question: x is 5, a block prints x, x becomes 9, then the block runs
            choices: ['5', '9', '14', 'Nothing: the block was never queued'],  // choices: 5, 9, 14, or nothing
            answer: 0,  // the first choice (5) is right
            feedback: [null, 'It would print 9 only if x were declared __block, which makes the block share x instead of copying it.', 'The block does not add anything; it prints the value of x it holds.', 'A block can be called directly, like a function; show() runs it right here.'],  // feedback for the wrong choices: 9 needs __block, 14 adds values, and a block can be called directly
            why: 'An ordinary variable used inside a block is captured by value at the moment the block is created. The block’s copy is 5; changing x afterwards does not affect it.' },  // why: an ordinary variable is captured by value when the block is created; closes question 9
          { type: 'bucket', q: 'With GCD, who is responsible for each job?',  // quiz question 10 (sort into groups): who is responsible for each job
            buckets: ['The programmer', 'GCD and the OS'],  // the two groups: the programmer, and GCD with the OS
            items: [['Finding pieces of work that can run at the same time', 0], ['Writing each piece of work as a block', 0], ['Choosing which queue receives each block', 0], ['Deciding how many worker threads exist', 1], ['Assigning a waiting block to a free thread', 1], ['Adding workers when some are blocked on I/O', 1]],  // the six jobs, each with the number of its correct group
            why: 'The programmer identifies and describes the work and chooses queues. GCD owns the thread pool: how many threads, which thread runs which block, and when to grow or shrink the pool.' },  // why: the programmer describes work and picks queues; GCD owns the pool; closes question 10
          { q: 'This code runs on the main thread inside a button handler. <code>g</code> is a global queue and <code>main</code> is the main queue. Which output is <b>impossible</b>?',  // quiz question 11 (multiple choice): which output of the round-trip code is impossible
            code: 'print("1");                                  // right away, on the main thread\ndispatch_async(g, ^{                         // queue a block on g; do not wait\n    print("2");                              // later, on a pool thread\n    dispatch_async(main, ^{ print("3"); });  // queue a block for the main thread\n});                                          // end of the g block\nprint("4");                                  // the handler carries on at once',  // the code shown with the question: print 1, queue a block that prints 2 and queues 3 on main, print 4
            choices: ['1 4 2 3', '1 2 4 3', '1 2 3 4', 'All three are possible'],  // choices: three orders, or "all possible"
            answer: 2,  // the third choice (1 2 3 4) is the impossible one
            feedback: ['Possible: the handler reaches print("4") before the pool thread prints 2.', 'Possible: the pool thread can print 2 before the handler reaches print("4"); 3 still comes last.', null, 'One of them is ruled out by where the block that prints 3 must run.'],  // feedback for the other choices
            why: 'The block that prints 3 sits on the main queue, which only the main thread serves. The main thread is busy running this handler, so 3 cannot print until the handler has printed 4 and returned.' },  // why: 3 needs the main thread, which is busy with the handler until after 4; closes question 11
          { type: 'tf', q: 'To react to a timer or a signal with a dispatch source, the program must dedicate one of its own threads to waiting for the event.', answer: false,  // quiz question 12 (true or false): a dispatch source needs one of your own threads to wait (false)
            why: 'The point of a dispatch source is that nobody waits: the system watches for the event and, when it happens, puts the handler block on the queue you chose, where a pool thread runs it. Events that arrive before the handler runs are merged into one run.' },  // why: the system watches the event and queues the handler, so nobody waits; closes question 12
        ],  // closes the quiz list
      },  // ends step 9
    ],  // closes the steps list

    notes: `${/* notes: the section's summary text, shown in the Notes panel and in the printable version */''}
<h3>1. The problem GCD solves</h3>${/* notes heading 1: the problem GCD solves */''}
<p>Extra cores help only when a program splits its work into pieces that can run at the same time, and something must create threads, hand them the pieces and clean up. <b>Grand Central Dispatch (GCD)</b>, first shipped in <b>Mac OS X 10.6 (Snow Leopard)</b>, moves that job into the OS. The programmer describes <b>tasks</b> (units of work, such as analysing one document) and GCD maps them onto a <b>thread pool</b> it manages: worker threads created once and reused. The pool is sized to the <b>degree of concurrency</b> of the hardware (roughly the number of cores), plus a few extra workers while some are blocked on I/O.</p>${/* notes paragraph: GCD moves thread management into the OS and sizes its pool to the hardware */''}
<ul>${/* starts the list of who does which job */''}
<li><b>Your job:</b> find work that can run in parallel, write each piece as a <b>block</b>, and put it on a <b>dispatch queue</b>.</li>${/* list item: the programmer's job (find parallel work, write blocks, pick queues) */''}
<li><b>GCD's job:</b> decide how many threads exist, give each waiting block to a free thread, reuse threads, grow the pool when workers are blocked.</li>${/* list item: GCD's job (thread count, handing blocks to threads, reuse, growing the pool) */''}
<li><b>The kernel's job:</b> schedule the pool's threads onto the cores like any other threads.</li>${/* list item: the kernel's job (scheduling pool threads onto cores) */''}
</ul>${/* ends the list */''}
<p>Layers: your code (blocks) → dispatch queues → thread pool → cores. Because the pool follows the hardware, the same program uses 2 cores on a 2-core laptop and 10 on a 10-core desktop.</p>${/* notes paragraph: the four layers, and why the same program scales from 2 to 10 cores */''}
<p><b>What is new?</b> Thread pools are old: servers and Windows (whose thread pool appears in section 4.4) have had them for years. GCD adds a <b>language extension (blocks)</b> for writing a task right where it belongs in the code, plus <b>queues</b> that keep tasks in order, so a unit of work can be split off without losing the order and dependencies between its parts.</p>${/* notes paragraph: what GCD adds to the old idea of a thread pool (blocks and queues) */''}

<h3>2. Threads by hand versus tasks for GCD</h3>${/* notes heading 2: threads by hand versus tasks for GCD */''}
<p>Three ways to run many small, independent tasks:</p>${/* notes line introducing the three strategies */''}
<table>${/* starts the comparison table */''}
<tr><th>Strategy</th><th>Threads</th><th>Weakness</th></tr>${/* table header: strategy, threads, weakness */''}
<tr><td>One thread per task</td><td>as many as tasks</td><td>Creating and destroying threads costs CPU; each thread reserves stack memory; more threads than cores must take turns (<b>oversubscription</b>): extra switching, no speed.</td></tr>${/* table row: one thread per task and its costs */''}
<tr><td>Hand-made pool</td><td>a number the author guessed</td><td>Too few leaves cores idle on a big machine; too many oversubscribes a small one. The author also writes the queue, locking and shutdown code.</td></tr>${/* table row: a hand-made pool and the problem with a guessed size */''}
<tr><td>GCD</td><td>about one per core, chosen by the system</td><td>None: the OS sizes the pool to the machine. Queueing a block is almost free: a dispatch queue is a lightweight data structure in the app's own memory.</td></tr>${/* table row: GCD, sized by the system, with cheap enqueueing */''}
</table>${/* ends the table */''}
<p><b>Worked example (toy cost model):</b> 32 tasks of 0.1 ms each on 8 cores; creating plus destroying a thread costs 0.04 ms; each thread reserves 0.5 MB of stack.</p>${/* notes paragraph: the toy cost model used for the worked example */''}
<ul>${/* starts the worked-example list */''}
<li>One thread per task: 32 threads, 32 × 0.5 = 16 MB of stack, 4 threads per core. CPU time = 32 × 0.1 + 32 × 0.04 = 4.48 ms, of which 1.28 ms (about 29%) is bookkeeping. Over 8 cores: 0.56 ms.</li>${/* worked example: one thread per task gives 0.56 ms with about 29% bookkeeping */''}
<li>Hand-made pool of 4: 4 threads, 2 MB. CPU time = 3.2 + 0.16 = 3.36 ms, but only 4 of the 8 cores work: 0.84 ms.</li>${/* worked example: the hand-made pool of 4 gives 0.84 ms because half the cores sit idle */''}
<li>GCD: 8 threads, 4 MB. CPU time = 3.2 + 0.32 = 3.52 ms over 8 cores: <b>0.44 ms</b>, the fastest.</li>${/* worked example: GCD gives 0.44 ms, the fastest */''}
</ul>${/* ends the worked-example list */''}
<p><b>Common mistake:</b> more threads is not more speed; once every core is busy, extra threads only take turns.</p>${/* notes line: more threads is not more speed */''}

<h3>3. Blocks</h3>${/* notes heading 3: blocks */''}
<p>A <b>block</b> is an extension to C, Objective-C and C++ for writing an unnamed piece of code inline (an <b>anonymous function</b>). A caret and braces make one: <code>^{ printf("hello world\\n"); }</code>. A block can be stored in a variable, passed to a function such as <code>dispatch_async</code>, and run later, even on another thread.</p>${/* notes paragraph: what a block is, with the hello world example */''}
<pre>int (^twice)(int) = ^(int n) { return n * 2; };  // a block variable holding a doubling block${/* notes code, line 1: a block variable holding a doubling block */''}
int r = twice(21);                                // call it like a function: r is 42</pre>${/* notes code, line 2: calling it like a function gives 42 */''}
<ul>${/* starts the list explaining the declaration */''}
<li><code>int</code> is the return type; <code>(^twice)</code> declares a variable that holds a block (the caret plays the role * plays for pointers); <code>(int)</code> lists parameter types.</li>${/* list item: return type, block variable and parameter types */''}
<li><code>^(int n) { ... }</code> is the block literal: the caret starts it, <code>(int n)</code> names the parameter, the braces hold the body.</li>${/* list item: the block literal with its caret, parameter and body */''}
<li>Writing a block does <b>not</b> run it. The body runs only when the block is called, or when GCD takes it off a queue.</li>${/* list item: writing a block does not run it */''}
</ul>${/* ends the list */''}
<p><b>Capture:</b> a block remembers the outside variables it uses. Code packaged with the values it uses is a <b>closure</b>. By default an ordinary local variable is captured <b>by value</b> at the moment the block is created:</p>${/* notes paragraph: capture and closures; ordinary locals are copied when the block is made */''}
<pre>int x = 5;                          // ordinary local variable${/* notes code, line 1: an ordinary local x set to 5 */''}
void (^greet)(void) = ^{ printf("x is %d\\n", x); };  // block copies x (5) now${/* notes code, line 2: a block that prints x, copying 5 now */''}
x = 9;                              // change x after the block exists${/* notes code, line 3: x changes to 9 afterwards */''}
greet();                            // prints "x is 5"</pre>${/* notes code, line 4: running the block still prints 5 */''}
<p>If the variable is declared <code>__block int x = 5;</code> the block keeps a shared link to x instead of a copy, so the same code prints "x is 9". Copying is the safe default: by the time a pool thread runs the block, the function that made it may have returned and its locals be gone.</p>${/* notes paragraph: with __block the block shares x and prints 9; why copying is the safe default */''}
<h3>4. Dispatch queues and dispatch sources</h3>${/* notes heading 4: dispatch queues and dispatch sources */''}
<p>A <b>dispatch queue</b> is a FIFO line of blocks; GCD takes blocks from the front and runs them on pool threads.</p>${/* notes line: a dispatch queue is a FIFO line of blocks */''}
<ul>${/* starts the list of queue kinds */''}
<li><b>Serial queue:</b> one block at a time; the next starts only after the previous finishes. It may use different pool threads, never two at once. Routing every use of some shared data through one serial queue replaces a lock.</li>${/* list item: serial queues, and using one in place of a lock */''}
<li><b>Concurrent queue:</b> blocks <b>start</b> in FIFO order but the next is handed out as soon as a thread is free, so blocks overlap and may <b>finish</b> in any order.</li>${/* list item: concurrent queues start in order but may finish in any order */''}
<li><b>Main queue</b> (<code>dispatch_get_main_queue()</code>): serial, runs on the <b>main thread</b>, which handles events and drawing. UI updates go here; slow work never does.</li>${/* list item: the main queue, serial on the main thread, for UI updates */''}
<li><b>Global queues</b> (<code>dispatch_get_global_queue(priority, 0)</code>): concurrent, system-provided, at <b>high, default and low</b> priority (plus <b>background</b> since 10.7). Newer GCD code usually asks for a <b>quality-of-service (QoS) class</b> instead of one of these priorities: user-interactive, user-initiated, utility or background, from most to least urgent.</li>${/* list item: the global queues, their priorities and the newer quality-of-service classes */''}
<li><b>Private queues:</b> <code>dispatch_queue_create(name, DISPATCH_QUEUE_SERIAL)</code>. In 10.6 every app-made queue was serial; private concurrent queues (<code>DISPATCH_QUEUE_CONCURRENT</code>) came in 10.7.</li>${/* list item: private queues, and when private concurrent queues arrived */''}
</ul>${/* ends the list */''}
<p><code>dispatch_async(q, block)</code> adds the block and returns at once; <code>dispatch_sync</code> waits until it has run.</p>${/* notes line: dispatch_async returns at once; dispatch_sync waits */''}
<p>A <b>dispatch source</b> watches for a system event (a timer, a signal, a readable file descriptor or socket, a process exiting) and, when it happens, submits a handler block to a chosen queue. No thread of yours sits waiting. Events that arrive before the handler starts are <b>merged</b> into one run, and a source never runs its handler twice at once.</p>${/* notes paragraph: what a dispatch source watches, and how events merge into one run */''}

<h3>5. Timing on serial and concurrent queues</h3>${/* notes heading 5: timing on serial and concurrent queues */''}
<p><b>Serial:</b> blocks of 300, 100 and 200 ms take 300 + 100 + 200 = <b>600 ms</b>, even with 4 cores free.</p>${/* notes line: the serial example adds up to 600 ms */''}
<p><b>Concurrent, 2 threads:</b> blocks of 300, 100, 200, 100 ms. At 0: thread 1 takes 300 (to 300), thread 2 takes 100 (to 100). At 100: thread 2 takes 200 (to 300). At 300: the last 100 ms block runs to <b>400 ms</b>. Speed-up = total work ÷ finish time = 700 ÷ 400 = 1.75×. The 100 ms block finished before the 300 ms block that started earlier. If two overlapping blocks change the same data, the result is a race condition; putting them on one serial queue removes the overlap.</p>${/* notes paragraph: the concurrent example with 2 threads finishes at 400 ms, a 1.75x speed-up, and the race risk */''}

<h3>6. Which output orders are possible?</h3>${/* notes heading 6: which output orders are possible */''}
<p>An order is impossible only if it breaks a guarantee: (1) blocks in the same serial queue run one at a time in queued order; (2) lines on one thread run in program order; (3) a main-queue block waits until the main thread is free. Durations make an order likely, never certain.</p>${/* notes paragraph: the three guarantees that can rule an order out */''}
<ul>${/* starts the list of cases */''}
<li>Same <b>serial</b> queue: output order = submission order, whatever the durations.</li>${/* list item: same serial queue, so output order equals submission order */''}
<li><b>Concurrent</b> queue: any finish order is possible.</li>${/* list item: concurrent queue, so any finish order is possible */''}
<li><b>Two queues:</b> A then B on serial s, C on global g: A precedes B and C may land anywhere (A B C, A C B, C A B).</li>${/* list item: two queues, where only A before B is promised */''}
<li><b>Round trip from the main thread:</b> print 1, dispatch_async to g (print 2, then dispatch_async to main to print 3), print 4. Possible: 1 4 2 3 and 1 2 4 3. Impossible: 1 2 3 4, because 3 needs the main thread, busy with the handler until after 4.</li>${/* list item: the round trip from the main thread and why 1 2 3 4 is impossible */''}
</ul>${/* ends the list */''}

<h3>7. The classic pattern</h3>${/* notes heading 7: the classic pattern */''}
<pre>dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{${/* notes code, line 1: send a block to the default global queue */''}
    Stats st = analyze(doc);                     // slow work on a pool thread${/* notes code, line 2: the slow work on a pool thread */''}
    dispatch_async(dispatch_get_main_queue(), ^{${/* notes code, line 3: send a block to the main queue */''}
        showStats(st);                           // UI update on the main thread${/* notes code, line 4: the UI update on the main thread */''}
    });${/* notes code, line 5: end of the UI block */''}
});</pre>${/* notes code, line 6: end of the work block */''}
<ol>${/* starts the numbered steps of the pattern */''}
<li>The handler (main thread) puts the work block on a global queue and returns at once, so the main thread keeps handling events.</li>${/* pattern step 1: the handler queues the work and returns, so the main thread stays free */''}
<li>A pool thread runs the slow analysis.</li>${/* pattern step 2: a pool thread runs the slow analysis */''}
<li>That block queues a second block, carrying the captured result, on the main queue.</li>${/* pattern step 3: the result goes to the main queue inside a second block */''}
<li>The main thread runs it and updates the window.</li>${/* pattern step 4: the main thread runs it and updates the window */''}
</ol>${/* ends the numbered steps */''}
<p><b>Common mistake:</b> doing slow work directly in an event handler freezes the app (spinning wait cursor) and leaves the other cores idle.</p>`,  // notes line: slow work inside an event handler freezes the app; end of the notes text
  });  // ends the section object passed to Guide.section
})();  // ends the wrapping function and runs it immediately
