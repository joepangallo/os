// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 4.1 — Processes and Threads
   A process bundles two separable ideas: owning resources and being
   scheduled. Threads split them apart. Original teaching material.
   ===================================================================== */
Guide.section({  // registers section 4.1 with the guide; the object inside holds its terms, styles, steps and quiz
  id: '4.1',  // the section number, used in links, the side menu and saved progress
  title: 'Processes and Threads',  // the full title shown at the top of every step of this section
  short: 'Processes & threads',  // the short name used in the side menu and progress list
  summary: 'A process owns the resources; its threads do the running. Why splitting the two pays off.',  // one-sentence summary shown on the chapter overview page
  objectives: [  // what the student should be able to do after this section, listed on its first page
    'Explain the two characteristics of a process (resource ownership and scheduling/execution) and why separating them gives us threads.',  // objective 1: the two sides of a process and how splitting them gives threads
    'Match the four process/thread models to example systems, and say what a process owns versus what each thread owns.',  // objective 2: the four process/thread models and who owns what
    'State the four performance benefits of threads and recognise the four ways threads are used in a single-user system.',  // objective 3: the performance benefits of threads and their four common uses
    'Trace thread states and the Spawn, Block, Unblock and Finish operations, including interleaving on one processor and an RPC example.',  // objective 4: thread states, the four thread operations, interleaving and the RPC example
    'Explain why threads that share one address space must synchronize their work.',  // objective 5: why threads sharing one address space need synchronization
  ],  // closes the objectives list
  terms: [  // key terms for the glossary and the hover pop-ups, each written as [term, definition]
    ['Resource ownership', 'The side of a process that holds things: a virtual address space containing the process image, plus open files, I/O devices and other resources, all protected by the OS from other processes.'],  // glossary entry: resource ownership, the "owning" side of a process
    ['Scheduling and execution', 'The side of a process that runs: a path through program code, with its own execution state (Running, Ready, Blocked...) and a dispatching priority the scheduler uses.'],  // glossary entry: scheduling and execution, the "running" side of a process
    ['Unit of dispatching', 'Whatever the scheduler picks to run on a processor. In a multithreaded operating system this is the thread, not the whole process.'],  // glossary entry: unit of dispatching, which is the thread in a multithreaded OS
    ['Task', 'Another name for a process when we mean the unit that owns resources (address space, files, devices) rather than the thing that runs.'],  // glossary entry: task, the older name for the resource-owning unit
    ['Lightweight process', 'Another name for a thread, the unit that gets dispatched. It is “lightweight” because it carries only execution state, not a whole set of resources. (Some systems, such as Solaris, also use the name for one specific kernel structure.)'],  // glossary entry: lightweight process, another name for a thread
    ['Multithreading', 'The ability of an operating system to support several concurrent paths of execution (threads) inside a single process.'],  // glossary entry: multithreading, several paths of execution inside one process
    ['Virtual address space', 'The range of memory addresses a process may use, which the OS maps onto real memory. It holds the process image, and every thread of the process works inside this one space.'],  // glossary entry: virtual address space, the addresses a process may use
    ['Thread context', 'The register values, above all the program counter and stack pointer, that a thread needs to resume exactly where it stopped. It is saved in the thread control block whenever the thread is not running.'],  // glossary entry: thread context, the saved registers that let a thread resume
    ['User stack', 'The stack a thread uses while running ordinary program code in user mode: the return addresses, parameters and local variables of its function calls.'],  // glossary entry: user stack, used while the thread runs ordinary program code
    ['Kernel stack', 'A separate stack used while the kernel runs on behalf of a thread (during a system call or an interrupt), so kernel work never mixes with the thread’s user stack.'],  // glossary entry: kernel stack, used while the kernel works on the thread's behalf
    ['Thread-local storage (TLS)', 'A small amount of static storage that belongs to one thread only, such as its own copy of an error code or a counter. Every thread has its own copy.'],  // glossary entry: thread-local storage, a small private data area for each thread
    ['Interprocess communication (IPC)', 'Any mechanism that lets separate processes exchange data or signals, such as pipes, messages or shared memory. It normally needs the kernel’s help, because processes are protected from each other.'],  // glossary entry: interprocess communication, which normally needs the kernel's help
    ['Dispatching priority', 'A number the scheduler uses to decide which ready unit of execution gets the processor first. A higher-priority thread is served before a lower-priority one.'],  // glossary entry: dispatching priority, the number the scheduler compares
    ['Spawn', 'The thread operation that creates a new thread: it gets its own register context and stack and is placed on the ready list. Creating a process also spawns its first thread.'],  // glossary entry: Spawn, the operation that creates a new thread
    ['Remote procedure call (RPC)', 'A call to a procedure that runs on another computer. The caller sends a request over the network and waits (is blocked) until the reply comes back.'],  // glossary entry: remote procedure call, a call that waits for another computer to reply
    ['Time quantum', 'The longest stretch a thread may run before the scheduler can take the processor away and give another ready thread a turn. Also called a time slice.'],  // glossary entry: time quantum, the longest turn a thread gets before it can be preempted
    ['Preemption', 'Taking the processor away from a running thread before it chooses to stop, for example because its time quantum expired or a higher-priority thread became ready.'],  // glossary entry: preemption, taking the processor away from a running thread
    ['Uniprocessor', 'A computer with a single processor (one core). Only one thread can execute at any instant, so threads take turns.'],  // glossary entry: uniprocessor, a machine where only one thread runs at any instant
    ['Thread synchronization', 'Coordinating threads that share data so their actions happen in a safe order and cannot corrupt shared data structures.'],  // glossary entry: thread synchronization, keeping threads that share data in a safe order
    ['Lost update', 'A race-condition outcome: two threads read the same old value, each writes back its own result, and the second write silently wipes out the first.'],  // glossary entry: lost update, the race outcome shown in step 9
  ],  // closes the terms list

  css: ` /* css: style rules for this section only; every rule starts with .sec-4-1 so it cannot affect other sections */
    .sec-4-1 .info { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; font-size: 15px; line-height: 1.45; } /* .info: the pale rounded box that shows explanations when the student clicks a part of a diagram */
    .sec-4-1 .info b { color: var(--chc); } /* bold words inside an info box take the chapter's accent color so the key phrase stands out */
    .sec-4-1 .hot { cursor: pointer; outline: none; } /* .hot marks a clickable part of a diagram: show a pointing-hand cursor and hide the default focus outline */
    .sec-4-1 .hot .fr { transition: stroke-width .15s; } /* makes the frame of a clickable part thicken smoothly instead of jumping */
    .sec-4-1 .hot:hover .fr, .sec-4-1 .hot:focus-visible .fr { stroke-width: 3; } /* thickens the frame when the mouse is over a clickable part or the keyboard has focused it */
    .sec-4-1 .hot.sel .fr { stroke-width: 3.5; stroke: var(--chc); } /* a selected part keeps an even thicker frame in the accent color so the student sees what is being explained */
    .sec-4-1 .s1-info { min-height: 92px; } /* keeps the step 1 explanation box at a fixed minimum height so the diagram does not jump as text changes */
    .sec-4-1 .road { font-size: 14.5px; color: var(--ink-2); } /* the "Coming up" roadmap line under the step 1 diagram, in slightly smaller, softer text */
    .sec-4-1 .m-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 10px; } /* step 2: lays the four model boxes out as a 2-by-2 grid of equal cells */
    .sec-4-1 .m-cell { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; text-align: left; color: var(--ink); font: inherit; min-height: 0; } /* step 2: each model box is a button styled as a card: its name, a small drawing and the systems placed in it */
    .sec-4-1 .m-cell:hover { border-color: var(--chc); } /* step 2: a model box gets an accent border when the mouse is over it */
    .sec-4-1 .m-cell.armed { border-style: dashed; border-color: var(--chc); } /* step 2: while an example system is picked, every model box shows a dashed border to invite a drop */
    .sec-4-1 .m-cell.bad { border-color: var(--bad); background: var(--bad-bg); } /* step 2: a wrong drop turns that model box red for a moment */
    .sec-4-1 .m-cell .m-name { font-weight: 800; font-size: 15px; } /* step 2: the model's name at the top of each box, in bold */
    .sec-4-1 .m-cell .m-got { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; } /* step 2: the row of green chips for systems already placed correctly in this box */
    .sec-4-1 .m-tray { display: flex; flex-wrap: wrap; gap: 6px; min-height: 36px; align-items: center; } /* step 2: the tray of example-system buttons still waiting to be placed */
    .sec-4-1 .m-tray .btn.on { background: var(--chc); border-color: var(--chc); color: var(--panel); } /* step 2: the picked example system fills with the accent color so the student sees what they are holding */
    .sec-4-1 .own ul { margin: 4px 0 0; padding-left: 20px; font-size: 15px; line-height: 1.4; } /* step 3: the bullet lists in the "process has" and "each thread has" cards */
    .sec-4-1 .own li { margin: 1px 0; } /* step 3: tightens the space between bullet points so both cards fit */
    .sec-4-1 .own h4 { margin: 0; } /* step 3: removes the default space above the card headings */
    .sec-4-1 .card.proc h4 { color: var(--proc); } /* step 3: the "process has" heading uses the process color, matching the diagram */
    .sec-4-1 .card.thread h4 { color: var(--thread); } /* step 3: the "each thread has" heading uses the thread color, matching the diagram */
    .sec-4-1 .s3-say { min-height: 96px; } /* step 3: keeps the explanation box a steady height as the student clicks around */
    .sec-4-1 .trace { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; } /* a row of chips that spells out a sequence of events, such as the lost-update steps in step 3 */
    .sec-4-1 .dim { opacity: .38; } /* fades out whatever is not selected (other threads in step 3, gone parts in step 4) */
    .sec-4-1 .sflash { animation: sec-4-1-blink .8s ease 2; } /* .sflash makes a just-changed value blink twice so the student notices it */
    @keyframes sec-4-1-blink { 50% { opacity: .2; } } /* the blink animation itself: halfway through, the element is nearly transparent */
    .sec-4-1 .ben { margin: 0; padding-left: 22px; } /* step 5: the numbered list of the four performance benefits */
    .sec-4-1 .ben li { margin: 0 0 6px; } /* step 5: space between the benefit items */
    .sec-4-1 .cost td.n, .sec-4-1 .cost th.n { text-align: center; width: 84px; font-variant-numeric: tabular-nums; } /* step 5: the number columns of the cost table: centered, fixed width, digits lined up */
    .sec-4-1 .cost td.n.no, .sec-4-1 .cost th.n.w { width: 128px; } /* step 5: the "not needed" column and its heading get extra width for their longer text */
    .sec-4-1 .cost td.no { color: var(--muted); font-size: 13px; } /* step 5: the "not needed" notes in the cost table are small and grey */
    .sec-4-1 .cost td.pr { color: var(--proc); font-weight: 800; } /* step 5: the process cost cells are bold in the process color */
    .sec-4-1 .cost td.th { color: var(--thread); font-weight: 800; } /* step 5: the thread cost cells are bold in the thread color */
    .sec-4-1 .bar { display: grid; grid-template-columns: 150px minmax(0, 1fr) 70px; align-items: center; gap: 10px; font-size: 14.5px; font-weight: 700; } /* step 5: a comparison bar row: a label, the bar track, and the number at the right */
    .sec-4-1 .bar .trk { height: 18px; border-radius: 6px; background: var(--panel-3); overflow: hidden; } /* step 5: the grey track each colored bar grows inside */
    .sec-4-1 .bar .trk i { display: block; height: 100%; border-radius: 6px; transition: width .45s ease; } /* step 5: the colored bar itself; its width animates when the numbers change */
    .sec-4-1 .bar .trk i.pb { background: var(--proc); } /* step 5: the process bar uses the process color */
    .sec-4-1 .bar .trk i.tb { background: var(--thread); } /* step 5: the thread bar uses the thread color */
    .sec-4-1 .bar .v { text-align: right; font-variant-numeric: tabular-nums; } /* step 5: the number at the end of each bar, right-aligned with evenly spaced digits */
    .sec-4-1 .use { padding: 7px 11px; } /* step 6: padding inside each of the four "use of threads" cards */
    .sec-4-1 .use b { display: block; font-size: 15px; color: var(--thread); } /* step 6: the card's title on its own line in the thread color */
    .sec-4-1 .use span { display: block; font-size: 14.5px; line-height: 1.38; color: var(--ink-2); } /* step 6: the card's description on its own line in slightly smaller, softer text */
    .sec-4-1 .scn { font-size: 17px; line-height: 1.45; min-height: 104px; display: flex; align-items: center; } /* step 6: the scenario card: larger text, vertically centered, fixed minimum height so buttons do not move */
    .sec-4-1 .bins { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; } /* step 6: the four sorting bins sit side by side in equal columns */
    .sec-4-1 .bin { border: 1.5px dashed var(--line-2); border-radius: 10px; padding: 6px 8px; min-height: 150px; } /* step 6: each bin has a dashed border and room for several sorted scenarios */
    .sec-4-1 .bin h4 { font-size: 11.5px; margin: 0 0 4px; } /* step 6: the small heading at the top of each bin */
    .sec-4-1 .bin .chip { display: flex; white-space: normal; line-height: 1.3; margin: 3px 0; padding: 2px 8px; font-size: 12.5px; border-radius: 8px; } /* step 6: each sorted scenario chip inside a bin may wrap onto several lines */
    .sec-4-1 .pick4 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } /* step 6: the four answer buttons in a 2-by-2 grid */
    .sec-4-1 .ops { margin: 0; padding-left: 20px; font-size: 14.5px; line-height: 1.4; } /* step 7: the list of the four thread operations (Spawn, Block, Unblock, Finish) */
    .sec-4-1 .ops li { margin: 0 0 3px; } /* step 7: space between the operation items */
    .sec-4-1 .callout.sm { font-size: 14.5px; padding: 8px 12px; line-height: 1.4; } /* a smaller callout box used for side notes in steps 4, 5 and 7 */
    .sec-4-1 .arc { fill: none; stroke: var(--line-2); stroke-width: 2; } /* step 7: an arrow in the state diagram, grey while not in use */
    .sec-4-1 .arc.on { stroke: var(--thread); stroke-width: 2.8; } /* step 7: the arrow for the transition just taken turns thread-colored and thicker */
    .sec-4-1 .arcl { font-size: 12.5px; fill: var(--muted); } /* step 7: the label on each state-diagram arrow, small and grey */
    .sec-4-1 .arcl.on { fill: var(--thread); font-weight: 800; } /* step 7: the label of the arrow just taken turns thread-colored and bold */
    .sec-4-1 svg.nw .arcl { font-size: 16.5px; } /* step 7: on a small screen the diagram is scaled down, so its arrow labels get a bigger font to stay readable */
    .sec-4-1 .thtbl td, .sec-4-1 .thtbl th { padding: 3px 8px; font-size: 14px; vertical-align: middle; } /* step 7: tight padding and smaller text in the thread table so every row fits */
    .sec-4-1 .thtbl .btn.sm { height: 24px; padding: 0 8px; font-size: 12.5px; } /* step 7: the small action buttons inside the thread table are shorter than usual */
    .sec-4-1 .s7-cap { min-height: 88px; } /* step 7: keeps the animation caption a steady height so the controls below it do not jump */
    .sec-4-1 .rpc-ctl { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 18px; align-items: center; } /* step 8: the control row: two sliders side by side, then the totals at the right */
    .sec-4-1 .tot { display: flex; gap: 8px; } /* step 8: the two total-time chips sit in a row with a small gap */
    .sec-4-1 .tot .chip { font-size: 14px; padding: 3px 11px; } /* step 8: slightly larger text in the total-time chips so the results are easy to compare */
    .sec-4-1 .s8-guess { width: 46px; height: 22px; margin: 0 3px; padding: 0 4px; font: inherit; font-size: 13.5px; text-align: center; border: 1px solid var(--line-2); border-radius: 6px; background: var(--panel); color: var(--ink); } /* step 8: the small number box where the student types a prediction before playing */
    .sec-4-1 .s8-cap { min-height: 72px; } /* step 8: keeps the RPC animation caption a steady height */
    .sec-4-1 .s9-mem { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; padding: 6px 14px; } /* step 9: the shared-memory strip holding the count: label, big number and lock chip in one row */
    .sec-4-1 .s9-mem .xs { white-space: nowrap; } /* step 9: the small label in the memory strip never breaks across lines */
    .sec-4-1 .s9-mem .big { font-size: 34px; line-height: 1; color: var(--mem); font-variant-numeric: tabular-nums; } /* step 9: the count itself, shown as a large number in the memory color with evenly spaced digits */
    .sec-4-1 .s9-th { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; } /* step 9: each thread's card stacks its heading, code lines, register and button vertically */
    .sec-4-1 .s9-th h4 { margin: 0 0 2px; display: flex; justify-content: space-between; align-items: center; color: var(--thread); } /* step 9: the thread card heading puts the name on the left and the status chip on the right */
    .sec-4-1 .s9-ln { font-family: var(--mono); font-size: 13.5px; padding: 1px 8px; border-radius: 6px; color: var(--ink-2); border: 1px solid transparent; } /* step 9: one line of the thread's machine steps, in a code font with a thin invisible border */
    .sec-4-1 .s9-ln.cur { border-color: var(--thread); background: var(--panel); color: var(--ink); font-weight: 700; } /* step 9: the step the thread will run next gets a thread-colored border and bold text */
    .sec-4-1 .s9-ln.did { color: var(--muted); } /* step 9: steps the thread has already run turn grey */
    .sec-4-1 .s9-reg { font-size: 14px; } /* step 9: the line that shows the thread's private register r */
    .sec-4-1 .s9-reg code { font-weight: 700; } /* step 9: the register's value is bold */
    .sec-4-1 .s9-trace { display: flex; flex-wrap: wrap; gap: 4px; min-height: 50px; align-content: flex-start; align-items: center; } /* step 9: the "order run" row of chips that records each step as it happens; keeps a minimum height */
    .sec-4-1 .s9-th h4 .chip { text-transform: none; letter-spacing: 0; font-size: 12.5px; } /* step 9: the status chip in a thread heading keeps normal capitalisation and a small font */
    .sec-4-1 .s9-trace .chip { font-size: 12.5px; padding: 1px 8px; } /* step 9: the chips in the order-run row are small so many fit on one line */
    .sec-4-1 .s9-say { min-height: 88px; } /* step 9: keeps the explanation box a steady height while the student picks steps */
    @media (max-width: 760px) { /* rules below apply only when the page is 760 pixels wide or less (phones and small windows) */
      .sec-4-1 .rpc-ctl { grid-template-columns: minmax(0, 1fr); } /* step 8: stacks the sliders and totals in one column on a small screen */
      .sec-4-1 .tot { flex-wrap: wrap; } /* step 8: lets the total chips wrap onto a second line if needed */
      .sec-4-1 .cost td.n, .sec-4-1 .cost th.n { width: 54px; } /* step 5: shrinks the number columns of the cost table so it fits a phone-width screen */
      .sec-4-1 .cost td.n.no, .sec-4-1 .cost th.n.w { width: 72px; } /* step 5: shrinks the wider "not needed" column too */
      .sec-4-1 .bar { grid-template-columns: 104px minmax(0, 1fr) 62px; } /* step 5: gives the bar labels and numbers less room on a small screen */
      .sec-4-1 .bins { grid-template-columns: repeat(2, minmax(0, 1fr)); } /* step 6: shows the four bins as 2-by-2 instead of 4 across */
      .sec-4-1 .pick4 { grid-template-columns: 1fr; } /* step 6: puts the four answer buttons in a single column */
      .sec-4-1 .thtbl .wide { display: none; } /* step 7: hides the less important columns of the thread table on a small screen */
    } /* ends the small-screen rules */
  `,  // end of the CSS text for this section

  steps: [  // steps: the list of pages in this section, shown one at a time as the student presses Next
    /* ---------------- 1. Big picture: a process is two ideas glued together ---------------- */
    {  // step 1 begins: the big-picture diagram of a process split into its two halves
      title: 'A process is really two ideas glued together',  // the step title shown at the top of the page
      kind: 'story',  // the kind of step (a story page), shown as a label above the title
      html: `${/* html: the fixed page content for step 1, written as HTML text */''}
        <div class="split l fill">${/* two-column layout: explanation text on the left, the interactive diagram on the right */''}
          <div class="stack">${/* the left column stacks its paragraphs with even spacing */''}
            <p class="lead m0">So far a process has meant two things at once: a <b>bundle of resources</b> that the OS protects, and a <b>path of execution</b> that the processor runs.</p>${/* opening paragraph: a process has meant both a bundle of resources and a path of execution */''}
            <p class="m0">The first is <span class="t">resource ownership</span>: a <span class="t">virtual address space</span> holding the <span class="t">process image</span>, plus files and I/O devices. The second is <span class="t">scheduling and execution</span>: where in the code it is, its state, and its <span class="t">dispatching priority</span>. The two are independent, so an OS can split them. The <span class="t">unit of dispatching</span> becomes the <span class="t">thread</span> (or <span class="t">lightweight process</span>); the unit of resource ownership stays the process (or <span class="t">task</span>).</p>${/* paragraph naming the two sides and the terms thread, lightweight process and task (each marked term pops up its glossary definition) */''}
            <div class="callout analogy m0" data-label="Analogy">A restaurant kitchen is the process: it owns the pantry, the stoves and the recipes. The cooks are the threads. Each works through a different recipe, yet all share one pantry and one set of stoves. Hiring a cook is far cheaper than building a kitchen.</div>${/* analogy box: a kitchen is the process and its cooks are the threads */''}
            <p class="small m0"><b>Why split them?</b> A program often has several jobs to do at once. Giving each job its own thread, instead of its own process, lets all the jobs share one set of resources cheaply.</p>${/* small paragraph: why a program benefits from splitting jobs into threads */''}
          </div>${/* ends the left column */''}
          <div class="card white stack s1-host"></div>${/* the empty card on the right where render() below places the diagram */''}
        </div>`,  // ends the two-column layout and the HTML text
      render(el, ctx) {  // render(el, ctx): runs when step 1 is shown and builds the clickable diagram; ctx is the guide's toolbox for this page
        const { h, s } = ctx;  // takes h (makes HTML elements) and s (makes SVG elements; SVG is the browser's drawing format) from the toolbox
        const host = ctx.$('.s1-host');  // host is the empty card from the HTML above, where the diagram goes
        const INFO = {  // INFO: the explanation shown in the box below the diagram for each clickable part, keyed by part id
          vas: '<b>Virtual address space.</b> The range of addresses the process may use. It holds the process image: program code, data, heap and stacks, plus the attributes the OS keeps in the process control block. The OS maps it to real memory and keeps other processes out.',  // explanation for the address space part: what it holds and that the OS guards it
          files: '<b>Open files.</b> A file opened by the process belongs to the process as a whole. When the process ends, the OS closes it.',  // explanation for the open files part: they belong to the whole process
          io: '<b>I/O devices and other resources.</b> A printer channel, a network connection, extra memory: the OS grants these to the process, and the process owns them until it gives them back or ends.',  // explanation for the I/O devices part: granted to the process until it returns them or ends
          prot: '<b>Protection.</b> The OS guards everything the process owns, so other processes cannot read or damage it by accident or on purpose. Crossing that wall needs interprocess communication through the kernel.',  // explanation for the protection part: crossing between processes needs the kernel
          path: '<b>Execution path.</b> A trace through the program’s instructions, jumping between functions and even into library code. This is the part the processor actually executes.',  // explanation for the execution path part: the trace the processor actually follows
          state: '<b>Execution state.</b> Running, Ready, Blocked and so on. A state describes something that <i>runs</i>, not the memory it owns.',  // explanation for the state part: a state describes something that runs
          prio: '<b>Dispatching priority.</b> The scheduler compares priorities to decide who gets the processor next.',  // explanation for the priority part: what the scheduler compares
        };  // closes the INFO table
        const THREADS = [['T1', 'Running', 8], ['T2', 'Ready', 5], ['T3', 'Blocked', 5]];  // THREADS: the three threads drawn in split view, each as [name, state, priority]
        const DEF = {  // DEF: the default text for the info box in each view, shown when nothing is selected
          classic: '<b>Classic view.</b> One process = one bundle of resources + one path of execution. The OS schedules the process and protects what it owns. Click any part, then press <b>Split into threads</b>.',  // default text for the classic view, telling the student what to click
          split: '<b>Split view.</b> The resource half stays with the process. The execution half is now repeated once per thread: three paths, three states, three priorities, one shared set of resources. Click a thread.',  // default text for the split view: the execution half now repeats once per thread
        };  // closes the DEF table
        let mode = 'classic', sel = null;  // mode is the current view (classic or split) and sel is the id of the clicked part, if any
        const NW = ctx.narrow;  // NW is true on a phone-width screen, where the diagram is drawn tall instead of wide
        const svg = s('svg', { viewBox: NW ? '0 0 310 544' : '0 0 620 300', width: '100%', role: 'img', 'aria-label': 'A process split into resource ownership and execution' });  // the SVG drawing area; its size and shape depend on the screen width
        const info = h('div', { class: 'info s1-info' });  // the info box under the diagram where explanations appear
        const wave = (x1, x2, y, amp) => { let d = `M${x1},${y}`; const n = 6, w = (x2 - x1) / n; for (let k = 0; k < n; k++) d += ` q${w / 2},${k % 2 ? amp : -amp} ${w},0`; return d; };  // wave(): builds an SVG path string for a wavy arrow from x1 to x2, used to picture a path of execution
        function hot(id, x, y, w, hh, cls, label, extra) {  // hot(): builds one clickable box in the diagram; clicking it (or pressing Enter/Space) selects that part
          const g = s('g', { class: 'hot' + (sel === id ? ' sel' : ''), tabindex: 0, role: 'button', 'aria-label': label, onclick: () => pick(id) },  // the group holds the box and its label; it gets the "sel" class when it is the selected part, and is keyboard focusable
            s('rect', { class: 'fr ' + cls, x, y, width: w, height: hh, rx: 8, 'stroke-width': 1.5 }),  // the box's frame, colored by cls (memory, I/O, OS or thread color)
            s('text', { x: x + 12, y: extra && hh > 50 ? y + 22 : y + hh / 2 + 5, 'font-size': 14, 'font-weight': 700 }, label), extra || null);  // the box's label; a tall box with extra drawing puts the label near the top, otherwise it is centered
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); } });  // lets keyboard users select the part with Enter or Space, just like a click
          return g;  // hands the finished group back to draw()
        }  // ends hot()
        function draw() {  // draw(): rebuilds the whole diagram for the current view and selection; runs at start and after every click
          const kids = [  // kids collects every shape that will go into the drawing
            s('text', { x: 10, y: 18, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, mode === 'classic' ? 'Process P (classic: one bundle)' : 'Process P (split: resources + threads)'),  // the title above the process box, which changes with the view
            s('rect', { x: 6, y: 26, width: NW ? 298 : 608, height: NW ? 426 : 220, rx: 14, class: 's-proc', 'stroke-width': 2 }),  // the big outer box that stands for process P
            s('rect', { x: 20, y: 40, width: 282, height: 194, rx: 10, class: 's-panel', 'stroke-width': 1 }),  // the left panel that holds the resource-ownership parts
            s('text', { x: 32, y: 60, 'font-size': 12.5, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, 'RESOURCE OWNERSHIP'),  // heading of the left panel
            hot('vas', 32, 70, 258, 34, 's-mem', 'Address space + process image'),  // clickable part: address space and process image
            hot('files', 32, 110, 258, 34, 's-io', 'Open files'),  // clickable part: open files
            hot('io', 32, 150, 258, 34, 's-io', 'I/O devices, other resources'),  // clickable part: I/O devices and other resources
            hot('prot', 32, 190, 258, 34, 's-os', 'Protection from other processes'),  // clickable part: protection from other processes
          ];  // ends the list of left-panel shapes
          const R = [s('rect', { x: 318, y: 40, width: 282, height: 194, rx: 10, class: 's-panel', 'stroke-width': 1 }),  // R collects the right panel (scheduling/execution); it starts with the panel's background box
            s('text', { x: 330, y: 60, 'font-size': 12.5, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, 'SCHEDULING / EXECUTION')];  // heading of the right panel
          if (mode === 'classic') {  // in the classic view the right panel shows a single path, state and priority
            R.push(  // adds the three classic execution parts to the right panel
              hot('path', 330, 70, 258, 62, 's-thread', 'One execution path', s('path', { d: wave(346, 572, 110, 7), class: 's-line', style: 'stroke:var(--thread)', 'marker-end': 'url(#arr-thread)' })),  // clickable part: the one execution path, drawn with a wavy arrow
              hot('state', 330, 140, 258, 34, 's-thread', 'State: Running'),  // clickable part: the state (Running)
              hot('prio', 330, 180, 258, 34, 's-thread', 'Priority: 8'));  // clickable part: the priority (8)
          } else {  // in the split view the right panel shows one row per thread instead
            kids.push(NW ? s('line', { x1: 10, y1: 240, x2: 300, y2: 240, class: 's-line', 'stroke-dasharray': '5 5', 'stroke-width': 1.5 })  // a dashed divider between the two halves; horizontal on a phone, vertical on a wide screen
              : s('line', { x1: 310, y1: 30, x2: 310, y2: 242, class: 's-line', 'stroke-dasharray': '5 5', 'stroke-width': 1.5 }));  // the vertical version of the divider for wide screens
            THREADS.forEach(([n, st, p], i) => {  // draws one clickable row for each of the three threads
              const y = 70 + i * 54;  // each thread row sits 54 units below the previous one
              R.push(hot('t' + i, 330, y, 258, 46, 's-thread', n, s('g', {},  // adds the thread's clickable row, holding its own wavy path and its state and priority
                s('path', { d: wave(372, 470, y + 23, 6), class: 's-line', style: 'stroke:var(--thread)', 'marker-end': 'url(#arr-thread)' }),  // the thread's wavy path, drawn in the thread color with an arrowhead at the end
                s('text', { x: 580, y: y + 28, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, st + ' \u00b7 prio ' + p))));  // the thread's state and priority, right-aligned at the end of its row
            });  // ends the loop over the three threads
          }  // ends the classic/split choice
          kids.push(s('g', { transform: NW ? 'translate(-298,206)' : null }, ...R));  // adds the right panel as one group; on a phone it is shifted down and left so it sits under the left panel
          const [ax, ay, bx, by] = NW ? [10, 476, 10, 516] : [20, 270, 318, 270];  // where the two "unit of ..." labels go: stacked on a phone, side by side on a wide screen
          kids.push(  // adds the two labels under the diagram
            s('text', { x: ax, y: ay, 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--proc)' }, 'Unit of resource ownership'),  // label: the process is the unit of resource ownership
            s('text', { x: ax, y: ay + 20, 'font-size': 13.5 }, 'the process (also called a task)'),  // second line of that label: the process is also called a task
            s('text', { x: bx, y: by, 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--thread)' }, 'Unit of dispatching'),  // label: the unit of dispatching
            s('text', { x: bx, y: by + 20, 'font-size': 13.5 }, mode === 'classic' ? 'the same process (one path only)' : 'each thread (a lightweight process)'));  // second line: the process itself in the classic view, each thread in the split view
          svg.replaceChildren(...kids);  // swaps the old drawing for the new shapes all at once
          if (!sel) info.innerHTML = DEF[mode];  // when nothing is selected, the info box shows the default text for the current view
        }  // ends draw()
        function pick(id) {  // pick(id): runs when the student clicks a part; remembers the selection and explains it
          sel = id;  // remembers which part is selected so draw() can highlight it
          if (id[0] === 't' && id.length === 2) {  // thread ids are "t0", "t1" and "t2": a "t" followed by one digit
            const [n, st, p] = THREADS[+id[1]];  // looks up that thread's name, state and priority
            info.innerHTML = `<b>Thread ${n}.</b> Its own path through the code, its own state (${st}) and its own priority (${p}). It owns nothing: it uses the process’s address space, files and devices, exactly like its sibling threads.`;  // explains that the thread has its own path, state and priority but owns nothing
          } else info.innerHTML = INFO[id];  // any other part shows its explanation from the INFO table
          draw();  // redraws so the selected part gets its highlight
        }  // ends pick()
        const seg = ctx.ui.seg([{ value: 'classic', label: 'Classic process' }, { value: 'split', label: 'Split into threads' }], 'classic', (v) => { mode = v; sel = null; draw(); });  // the Classic/Split switch above the diagram; changing it clears the selection and redraws
        host.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'One process, two jobs'), seg), svg, info,  // places the heading and switch, then the drawing and the info box, into the right-hand card
          h('div', { class: 'road', style: { marginTop: 'auto' }, html: '<b>Coming up:</b> four process/thread models → who owns what → why threads are cheap → what they are used for → thread states → a network example → why sharing needs synchronization.' }));  // the "Coming up" roadmap at the bottom of the card, pushed down to the card's bottom edge
        draw();  // draws the diagram for the first time when the step opens
      },  // ends render() for step 1
    },  // ends step 1
    /* ---------------- 2. The four process/thread models ---------------- */
    {  // step 2 begins: a sorting game that matches real systems to the four process/thread models
      title: 'Four ways to combine processes and threads',  // the step title shown at the top of the page
      kind: 'explore',  // the kind of step (explore), shown as a label above the title
      html: `${/* html: the fixed page content for step 2 */''}
        <div class="split l fill">${/* two-column layout: explanation on the left, the game on the right */''}
          <div class="stack">${/* the left column stacks its blocks with even spacing */''}
            <p class="lead m0"><span class="t">Multithreading</span> is the ability of an OS to support several concurrent paths of execution inside <b>one</b> process.</p>${/* opening paragraph: defines multithreading */''}
            <p class="m0">Ask two questions about any OS. Can more than one process exist at a time? Can a process contain more than one thread? The answers give four models.</p>${/* paragraph: the two questions that produce the four models */''}
            <div class="card tight small m0"><b>How to play:</b> click an example system in the tray, then click the model it belongs to. A wrong guess tells you why.</div>${/* how-to-play card: pick a system from the tray, then click its model */''}
            <div class="callout why m0" data-label="Why it matters">The boxes trace how systems grew up. Early personal computers ran one program with one path. Classic multiuser systems ran many processes, each single-threaded. A Java virtual machine is one process hosting many threads. Today’s general-purpose systems let every process have as many threads as it needs.</div>${/* why-it-matters box: the four models follow the history of operating systems */''}
            <div class="info s2-say">Pick an example system to start.</div>${/* feedback box where the game writes its responses; starts with a prompt */''}
          </div>${/* ends the left column */''}
          <div class="stack s2-host"></div>${/* the empty column on the right where render() places the game */''}
        </div>`,  // ends the layout and the HTML text
      render(el, ctx) {  // render(el, ctx): builds the sorting game when step 2 is shown
        const { h, s } = ctx;  // takes the HTML and SVG element builders from the toolbox
        const host = ctx.$('.s2-host');  // host is the right-hand column that receives the game
        const say = ctx.$('.s2-say');  // say is the feedback box on the left
        const MODELS = [  // MODELS: the four models, with how many processes and threads per process to draw in each box
          { name: 'One process, one thread', procs: 1, th: 1 },  // model 0: one process with one thread
          { name: 'One process, many threads', procs: 1, th: 3 },  // model 1: one process with many threads
          { name: 'Many processes, one thread each', procs: 3, th: 1 },  // model 2: many processes, each single-threaded
          { name: 'Many processes, many threads each', procs: 3, th: 3 },  // model 3: many processes, each with many threads
        ];  // closes the MODELS list
        const EX = [  // EX: the six example systems; cell is the index of the correct model and why is the explanation
          { id: 'dos', label: 'MS-DOS', cell: 0, why: 'MS-DOS runs a single user program at a time, and that program has a single path of execution.' },  // example: MS-DOS belongs in model 0
          { id: 'java', label: 'Java runtime environment', cell: 1, why: 'A Java runtime environment is one process (the virtual machine) inside which the program can start many threads.' },  // example: the Java runtime environment belongs in model 1
          { id: 'unix', label: 'Traditional UNIX', cell: 2, why: 'Traditional UNIX lets many users run many processes, but each process has exactly one thread.' },  // example: traditional UNIX belongs in model 2
          { id: 'win', label: 'Windows', cell: 3, why: 'Windows runs many processes, and each process may create as many threads as it needs.' },  // example: Windows belongs in model 3
          { id: 'sol', label: 'Solaris', cell: 3, why: 'Solaris supports many processes, each with many threads.' },  // example: Solaris belongs in model 3
          { id: 'mod', label: 'Modern UNIX versions', cell: 3, why: 'Most modern UNIX-family systems support many processes, each with many threads.' },  // example: modern UNIX versions belong in model 3
        ];  // closes the EX list
        const WRONG = [  // WRONG: the hint shown when the student drops a system on the wrong model, one per model
          'That model has room for only one program with one path. ',  // hint for a wrong drop on model 0: only one program and one path
          'That model allows threads, but only inside a single process. ',  // hint for a wrong drop on model 1: threads but a single process
          'That model allows many processes, but each one has only a single thread. ',  // hint for a wrong drop on model 2: many processes but one thread each
          'That model gives many processes many threads each. ',  // hint for a wrong drop on model 3: many processes and many threads
        ];  // closes the WRONG list
        const placed = {}; let armed = null, tries = 0;  // placed records which systems are sorted; armed is the system currently picked up; tries counts wrong drops
        const wave = (x1, x2, y, amp) => { let d = `M${x1},${y}`; const n = 4, w = (x2 - x1) / n; for (let k = 0; k < n; k++) d += ` q${w / 2},${k % 2 ? amp : -amp} ${w},0`; return d; };  // wave(): builds a wavy arrow path for a thread, with fewer bumps than in step 1 because the boxes are small
        function mini(m) {  // mini(m): draws the small picture inside a model box: process rectangles, each with its thread arrows
          const svg = s('svg', { viewBox: '0 0 300 112', width: '100%', 'aria-hidden': 'true', style: 'flex:1;min-height:0' });  // a small SVG that stretches to fill the box; screen readers skip it because the model name says the same thing
          const pw = m.procs === 1 ? 170 : 86, gap = 10, total = m.procs * pw + (m.procs - 1) * gap, x0 = (300 - total) / 2;  // works out each process box's width and the left margin that centers the group of boxes
          for (let p = 0; p < m.procs; p++) {  // draws each process in turn
            const x = x0 + p * (pw + gap);  // the left edge of this process box
            svg.append(s('rect', { x, y: 4, width: pw, height: 104, rx: 10, class: 's-proc', 'stroke-width': 2 }));  // the process rectangle
            const ys = m.th === 1 ? [56] : [28, 56, 84];  // one thread arrow in the middle, or three arrows stacked for a multithreaded model
            ys.forEach((y) => svg.append(s('path', { d: wave(x + 12, x + pw - 16, y, 5), class: 's-line', style: 'stroke:var(--thread)', 'marker-end': 'url(#arr-thread)' })));  // draws each thread as a wavy arrow in the thread color
          }  // ends the loop over processes
          return svg;  // hands the finished picture to the model box
        }  // ends mini()
        const cells = MODELS.map((m, i) => {  // cells: builds one clickable box for each model
          const got = h('div', { class: 'm-got' });  // got will hold the green chips of systems placed correctly in this box
          const b = h('button', { type: 'button', class: 'm-cell', onclick: () => drop(i) }, h('div', { class: 'm-name' }, m.name), mini(m), got);  // the model box is a button: clicking it tries to drop the picked-up system here
          b.got = got; return b;  // keeps a handle on the got area so drop() can add chips to it later
        });  // closes the map that builds the four boxes
        const tray = h('div', { class: 'm-tray' });  // the tray that holds the systems still waiting to be sorted
        const score = h('span', { class: 'chip accent' });  // the score chip: how many are placed and how many wrong guesses
        function paintTray() {  // paintTray(): redraws the tray and score after every pick or drop
          const left = EX.filter((e) => !placed[e.id]);  // left is the list of systems not yet placed
          tray.replaceChildren(...left.map((e) => h('button', { type: 'button', class: 'btn sm' + (armed === e.id ? ' on' : ''), onclick: () => arm(e.id) }, e.label)));  // one button per remaining system; the picked-up one gets the "on" highlight
          if (!left.length) tray.append(h('span', { class: 'chip ok' }, '✓ All six placed'));  // once all six are placed, a green chip says so
          score.textContent = `${Object.keys(placed).length} / ${EX.length} placed · ${tries} wrong`;  // updates the score text, for example "3 / 6 placed · 1 wrong"
          cells.forEach((c) => c.classList.toggle('armed', !!armed));  // shows dashed borders on the model boxes while a system is picked up
        }  // ends paintTray()
        function arm(id) { armed = armed === id ? null : id; const e = EX.find((x) => x.id === id); say.innerHTML = armed ? `Where does <b>${e.label}</b> belong? Click one of the four models.` : 'Pick an example system.'; paintTray(); }  // arm(id): picks up a system (or puts it back if clicked again) and asks where it belongs
        function drop(i) {  // drop(i): runs when the student clicks model box i
          cells.forEach((c) => c.classList.remove('bad'));  // clears any red wrong-answer marking from the last attempt
          if (!armed) { say.innerHTML = `<b>${MODELS[i].name}.</b> ${['Exactly one process exists, and it has one path of execution.', 'A single process whose work is split among several threads.', 'Many processes can exist, but every one of them has exactly one thread. This is the classic process from Chapter 3.', 'Many processes, and each may have many threads. The unit of dispatching is the thread.'][i]} Pick an example from the tray to place.`; return; }  // with nothing picked up, clicking a model just describes it and asks the student to pick a system
          const e = EX.find((x) => x.id === armed);  // finds the picked-up system
          if (e.cell === i) {  // a correct drop: the system's right model is the one clicked
            placed[e.id] = true; armed = null;  // marks the system as placed and empties the student's hand
            cells[i].got.append(h('span', { class: 'chip ok fade-in' }, '✓ ' + e.label));  // adds a green chip naming the system to the model box it was dropped on
            say.innerHTML = `<b style="color:var(--ok)">Correct.</b> ${e.why}` + (Object.keys(placed).length === EX.length ? ' <b>All placed!</b> Notice the bottom-right box holds every mainstream desktop OS today.' : '');  // praises the answer, explains it, and adds a closing remark once all six are placed
          } else {  // a wrong drop
            tries++; cells[i].classList.add('bad');  // counts the mistake and turns the clicked model box red
            say.innerHTML = `<b style="color:var(--bad)">Not quite.</b> ${WRONG[i]}${e.label}? Think again: how many processes, and how many threads in each?`;  // explains what the clicked model allows and asks the student to think again
          }  // ends the right/wrong choice
          paintTray();  // refreshes the tray and the score
        }  // ends drop()
        function reset() { Object.keys(placed).forEach((k) => delete placed[k]); armed = null; tries = 0; cells.forEach((c) => { c.got.replaceChildren(); c.classList.remove('bad'); }); say.innerHTML = 'Pick an example system to start.'; paintTray(); }  // reset(): clears every placement, the red marks and the score so the game starts over
        const grid = h('div', { class: 'm-grid grow' }, ...cells);  // grid holds the four model boxes and stretches to fill the remaining space
        host.append(  // builds the right-hand column of the game
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Example systems'), h('div', { class: 'row' }, score, h('button', { type: 'button', class: 'btn sm ghost', onclick: reset }, 'Reset'))),  // top row: the "Example systems" heading on the left, the score and a Reset button on the right
          tray, grid);  // then the tray of systems and the grid of models
        if (ctx.narrow) host.append(say); // keep feedback next to the game on phones
        paintTray();  // draws the tray and score for the first time
      },  // ends render() for step 2
    },  // ends step 2
    /* ---------------- 3. What the process keeps, what each thread gets ---------------- */
    {  // step 3 begins: which things exist once per process and which once per thread
      title: 'What the process keeps, what each thread gets',  // the step title shown at the top of the page
      kind: 'explore',  // the kind of step (explore), shown as a label above the title
      core: true,  // core: true keeps this step on the shorter core route through the guide
      html: `${/* html: the fixed page content for step 3 */''}
        <div class="split l fill">${/* two-column layout: the two ownership lists on the left, the diagram on the right */''}
          <div class="stack">${/* the left column stacks its cards with even spacing */''}
            <p class="lead m0">One copy for everyone, or one copy each?</p>${/* opening question: one shared copy, or one copy per thread? */''}
            <div class="card proc tight own m0"><h4>The process has (one copy)</h4><ul>${/* card listing what the process has, starting its bullet list */''}
              <li>a <span class="t">virtual address space</span> holding the process image</li>${/* bullet: the virtual address space with the process image */''}
              <li>protected access to processors, other processes (<span class="t" data-t="Interprocess communication (IPC)">IPC</span>), files and I/O resources</li></ul></div>${/* bullet: protected access to processors, IPC, files and I/O; data-t tells the pop-up which glossary entry to show */''}
            <div class="card thread tight own m0"><h4>Each thread has (its own copy)</h4><ul>${/* card listing what each thread has, starting its bullet list */''}
              <li>an execution state (Running, Ready, Blocked...)</li>${/* bullet: an execution state */''}
              <li>a saved <span class="t">thread context</span> when not running: in effect, its own <span class="t">program counter</span> inside the process</li>${/* bullet: a saved thread context, which gives each thread its own program counter */''}
              <li>an execution <span class="t">stack</span></li>${/* bullet: an execution stack */''}
              <li>per-thread static storage for local variables (<span class="t">thread-local storage</span>, TLS)</li>${/* bullet: thread-local storage */''}
              <li>access to the process\u2019s memory and resources, <b>shared</b> with its siblings</li></ul></div>${/* bullet: shared access to the process's memory and resources; the list and card end here */''}
            <div class="callout warn m0" data-label="Common mistake">“Its own stack” is not a protected stack. It sits in the shared address space, so a stray pointer in one thread can overwrite a sibling’s data.</div>${/* common-mistake box: a thread's own stack is not protected from its siblings */''}
          </div>${/* ends the left column */''}
          <div class="card white stack s3-host"></div>${/* the empty card on the right where render() draws the diagram */''}
        </div>`,  // ends the layout and the HTML text
      render(el, ctx) {  // render(el, ctx): builds the shared-versus-private diagram when step 3 is shown
        const { h, s } = ctx;  // takes the HTML and SVG element builders from the toolbox
        const host = ctx.$('.s3-host');  // host is the right-hand card that receives the diagram
        const ST = ['Running', 'Ready', 'Blocked', 'Ready'], PC = [14, 31, 22, 9], ERR = [0, 0, 2, 0];  // fixed per-thread facts for up to 4 threads: state, program counter line, and private error code
        const SH = [  // SH: the four shared resources as [id, title, lines to show, color class, explanation]
          ['code', 'Code', () => ['instructions'], 's-cpu', '<b>Code.</b> One copy of the program’s instructions. Every thread executes from it, each at its own place, because each has its own program counter.'],  // shared resource: the code, one copy that every thread executes from
          ['data', 'Global data', () => ['count = ' + st.count], 's-mem', '<b>Global data.</b> One copy, in the address space every thread shares, so any thread can read what another wrote, with no copying. But a write is only <b>reliably</b> seen by the others, and in the right order, when threads synchronize (a lock or an atomic operation; section 5.1 explains memory order).'],  // shared resource: global data showing the current count; the explanation notes that seeing a write reliably needs synchronization
          ['heap', 'Heap', () => ['list: 3 items'], 's-mem', '<b>Heap.</b> Memory allocated while the program runs belongs to the process. Any thread holding a pointer to a heap object can use it.'],  // shared resource: the heap, memory allocated while the program runs
          ['files', 'Open files', () => st.files, 's-io', '<b>Open files.</b> Files belong to the process, so a file opened by one thread can be read or written by all of them.'],  // shared resource: the open files, whose list grows when a thread opens one
        ];  // closes the SH table
        let st;  // st will hold the diagram's current state (number of threads, count, files, selection)
        const svg = s('svg', { viewBox: '0 0 640 250', width: '100%', role: 'img', 'aria-label': 'Shared process resources above, private thread state below' });  // the SVG drawing area; draw() changes its height to fit the number of threads
        const say = h('div', { class: 'info s3-say' });  // the explanation box below the diagram
        const nOut = h('b', { class: 'num' });  // shows the current number of threads next to the controls
        function fresh(n) { st = { n: n || 3, count: 5, files: ['log.txt'], loc: [0, 0, 0, 0], sel: null, flash: null }; }  // fresh(n): resets the state: n threads (3 by default), count 5, one open file, nothing selected
        function hot(id, g) { g.setAttribute('class', 'hot' + (st.sel === id ? ' sel' : '')); g.setAttribute('tabindex', 0); g.setAttribute('role', 'button'); g.addEventListener('click', () => pick(id)); return g; }  // hot(id, g): makes a drawn group clickable and focusable, and highlights it if it is selected
        const NW = ctx.narrow;  // NW is true on a phone-width screen, where the boxes are laid out two per row
        const shPos = (i) => (NW ? [14 + (i % 2) * 150, 36 + Math.floor(i / 2) * 74] : [18 + i * 153, 36]), IW = NW ? 140 : 145;  // shPos(i): where shared box i goes (a 2-by-2 grid on a phone, one row on a wide screen); IW is each box's width
        function draw() {  // draw(): rebuilds the diagram from the current state; runs after every click or button press
          const n = st.n, w = NW ? 140 : (608 - (n - 1) * 10) / n;  // n threads; each thread box's width shrinks as more threads share the row on a wide screen
          const thPos = (k) => (NW ? [14 + (k % 2) * 150, 196 + Math.floor(k / 2) * 112] : [16 + k * (w + 10), 136]);  // thPos(k): where thread box k goes, below the shared row
          const H = NW ? 196 + Math.ceil(n / 2) * 112 : 242;  // H is the height of the process box, which grows on a phone as threads add new rows
          svg.setAttribute('viewBox', NW ? `0 0 318 ${H + 8}` : '0 0 640 250');  // resizes the drawing so it fits the process box exactly
          const kids = [  // kids collects every shape in the drawing
            s('rect', { x: 4, y: 4, width: NW ? 310 : 632, height: H, rx: 14, class: 's-proc', 'stroke-width': 2 }),  // the outer box that stands for process P
            s('text', { x: NW ? 14 : 18, y: 26, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, NW ? 'Process P \u00b7 shared by all threads' : 'Process P \u00b7 shared by every thread (one copy each)'),  // the title inside the process box, shorter on a phone
          ];  // ends the starting list of shapes
          SH.forEach(([id, t, val, cls], i) => {  // draws the four shared resource boxes
            const [x, y0] = shPos(i), v = val();  // finds this box's position and asks for its current lines of text
            kids.push(hot(id, s('g', {},  // each shared box is a clickable group
              s('rect', { class: 'fr ' + cls + (st.flash === id ? ' sflash' : ''), x, y: y0, width: IW, height: 66, rx: 9, 'stroke-width': 1.5 }),  // the box's frame; it blinks when this resource was just changed
              s('text', { x: x + 10, y: y0 + 21, 'font-size': 14, 'font-weight': 800 }, t),  // the resource's title
              ...v.map((line, j) => s('text', { x: x + 10, y: y0 + 41 + j * 17, 'font-size': 13, class: 's-monot' }, line)))));  // one line of text per value, such as "count = 7" or each open file name
          });  // ends the loop over shared resources
          const sx = st.sel && SH.findIndex((x) => x[0] === st.sel);  // sx is the index of the selected shared resource; it is -1 when a thread is selected and null when nothing is
          for (let k = 0; k < n; k++) {  // draws one box per thread below the shared row
            const [x, y] = thPos(k), mine = st.sel === 'th' + k, other = st.sel && st.sel.startsWith('th') && !mine, shared = sx != null && sx >= 0;  // finds the box position; mine/other tell whether this thread or a different one is selected; shared means a resource is selected
            if (shared && !NW) kids.push(s('line', { x1: 18 + sx * 153 + 72, y1: 104, x2: x + w / 2, y2: 134, class: 's-line', style: 'stroke:var(--thread)', 'stroke-width': 1.8, 'marker-end': 'url(#arr-thread)' }));  // on a wide screen, when a shared resource is selected, an arrow runs from it down to every thread to show they all use it
            const g = s('g', { class: other ? 'dim' : '' },  // the thread's group; it fades out when a different thread is selected
              s('rect', { class: 'fr s-thread', x, y, width: w, height: 102, rx: 9, 'stroke-width': shared && NW ? 3 : 1.5 }),  // the thread's frame; on a phone it thickens instead of drawing arrows when a shared resource is selected
              s('text', { x: x + 10, y: y + 19, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--thread)' }, 'T' + (k + 1)),  // the thread's name (T1, T2 ...)
              s('text', { x: x + w - 8, y: y + 19, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, ST[k]),  // the thread's state at the top right
              s('text', { x: x + 10, y: y + 38, 'font-size': 13, class: 's-monot' }, 'PC \u2192 line ' + PC[k]),  // the thread's own program counter
              s('text', { x: x + 10, y: y + 56, 'font-size': 13, class: 's-monot' + (st.flash === 'loc' + k ? ' sflash' : '') }, 'stack: i = ' + st.loc[k]),  // the thread's own stack variable i; it blinks right after that thread changes it
              s('text', { x: x + 10, y: y + 74, 'font-size': 13, class: 's-monot' }, 'TLS: err = ' + ERR[k]),  // the thread's private error code in thread-local storage
              s('text', { x: x + 10, y: y + 92, 'font-size': 13, class: 's-monot' }, 'sees count = ' + st.count));  // the shared count as seen by this thread, always the same value for every thread
            kids.push(hot('th' + k, g));  // makes the thread box clickable
          }  // ends the loop over threads
          svg.replaceChildren(...kids);  // swaps the old drawing for the new one
          nOut.textContent = n;  // updates the thread-count number shown beside the controls
        }  // ends draw()
        function pick(id) {  // pick(id): runs when the student clicks a box; selects it and explains it
          st.sel = id; st.flash = null;  // remembers the selection and stops any blinking
          if (id.startsWith('th')) { const k = +id.slice(2); say.innerHTML = `<b>T${k + 1}, private parts.</b> Its state (${ST[k]}), its saved context with its own program counter (line ${PC[k]}), its own stack (its local <code>i</code> = ${st.loc[k]}) and its thread-local storage (here a private error code, <code>err</code> = ${ERR[k]}: when a sibling records an error, it sets its own <code>err</code>, not this one). Everything in the teal area it shares with its ${st.n - 1} sibling${st.n > 2 ? 's' : ''}.`; }  // for a thread: lists its private parts using its current values and says how many siblings share the rest
          else say.innerHTML = SH.find((x) => x[0] === id)[4];  // for a shared resource: shows its explanation from the SH table
          draw();  // redraws with the new highlight
        }  // ends pick()
        const ACT = {  // ACT: what each action button does to the state and what it explains
          write() { st.count = 7; st.sel = 'data'; st.flash = 'data'; say.innerHTML = '<b>T1 sets count = 7.</b> There is only one <code>count</code>, so the others read that same variable, not a copy: no message, no system call. Another thread is <b>guaranteed</b> to read 7 only with <span class="t">thread synchronization</span>, such as a lock (section 5.1 shows why).'; },  // action: T1 writes count = 7, and every thread sees the one shared variable change
          open() { if (!st.files.includes('report.txt')) st.files.push('report.txt'); st.sel = 'files'; st.flash = 'files'; say.innerHTML = '<b>T2 opens report.txt.</b> The open file belongs to the process, not to T2. Every thread can now read or write it through the same handle, and it stays open even if T2 finishes.'; },  // action: T2 opens report.txt, which then belongs to the whole process
          local() { const k = st.n - 1; st.loc[k] = 42; st.sel = 'th' + k; st.flash = 'loc' + k; say.innerHTML = `<b>T${k + 1} sets its local i = 42.</b> Local variables live on each thread’s own stack, so only T${k + 1}’s <code>i</code> changed. The other threads each still have their own <code>i</code>.`; },  // action: the last thread sets its local i = 42, and only that thread's stack changes
          race() {  // action: T1 and T2 both add 1 to count at the same moment
            const a = st.count; st.count = a + 1; st.sel = 'data'; st.flash = 'data';  // count goes up by only one, because in this story both threads read the same old value
            say.innerHTML = `<b style="color:var(--bad)">Both T1 and T2 run count = count + 1.</b><div class="trace"><span class="chip thread">T1 reads ${a}</span><span class="chip thread">T2 reads ${a}</span><span class="chip thread">T1 writes ${a + 1}</span><span class="chip thread">T2 writes ${a + 1}</span></div>Two increments ran, but count only went from ${a} to ${a + 1}: one update was lost (a <span class="t">race condition</span>). Sharing needs <span class="t">thread synchronization</span>; later in this section you play the scheduler for exactly this race.`;  // explains the lost update with a row of chips showing the four reads and writes in order
          },  // ends the race action
        };  // closes the ACT table
        const act = (k) => () => { ACT[k](); draw(); };  // act(k): makes the click handler for action k: run the action, then redraw
        const setN = (d) => { const n = Math.max(2, Math.min(4, st.n + d)); if (n === st.n) return; st.n = n; if (st.sel && st.sel.startsWith('th') && +st.sel.slice(2) >= n) st.sel = null; draw(); };  // setN(d): adds or removes a thread (between 2 and 4); clears the selection if the selected thread disappears
        host.append(  // builds the right-hand card
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Try it: who sees a change?'),  // top row: the heading on the left and the thread counter on the right
            h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b' }, 'Threads:'), h('button', { type: 'button', class: 'btn sm', 'aria-label': 'Remove a thread', onclick: () => setN(-1) }, '−'), nOut, h('button', { type: 'button', class: 'btn sm', 'aria-label': 'Add a thread', onclick: () => setN(1) }, '+'))),  // the thread counter: a minus button, the current number, and a plus button
          svg,  // then the diagram itself
          h('div', { class: 'row', style: { gap: '6px' } },  // a row of action buttons under the diagram
            h('button', { type: 'button', class: 'btn sm thread', onclick: act('write') }, 'T1: count = 7'),  // button: T1 writes to the shared count
            h('button', { type: 'button', class: 'btn sm thread', onclick: act('open') }, 'T2: open a file'),  // button: T2 opens a file
            h('button', { type: 'button', class: 'btn sm thread', onclick: act('local') }, 'Last thread: local i = 42'),  // button: the last thread changes its own local variable
            h('button', { type: 'button', class: 'btn sm intr', onclick: act('race') }, 'T1 + T2: count++'),  // button: T1 and T2 both increment count, showing the race (red interrupt style)
            h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { fresh(st.n); say.innerHTML = DEF; draw(); } }, 'Reset')),  // Reset button: back to the starting state, keeping the current number of threads
          say,  // the explanation box
          h('p', { class: 'small muted m0', style: { marginTop: 'auto' }, html: '<b style="color:var(--proc)">Teal</b> = exists once for the whole process \u00b7 <b style="color:var(--thread)">pink</b> = exists once per thread.' }));  // color key at the bottom: teal means one per process, pink means one per thread
        const DEF = 'Click a shared box or a thread to see who can use it, or press an action button. Add or remove threads with + and −.';  // DEF: the default explanation shown at the start and after Reset
        fresh(3); say.innerHTML = DEF; draw();  // sets up 3 threads, shows the default text and draws the diagram when the step opens
      },  // ends render() for step 3
    },  // ends step 3
    /* ---------------- 4. Single-threaded vs multithreaded process models ---------------- */
    {  // step 4 begins: compares the OS's records for a single-threaded and a multithreaded process
      title: 'The OS’s bookkeeping: one thread vs many',  // the step title shown at the top of the page
      kind: 'compare',  // the kind of step (compare), shown as a label above the title
      html: `${/* html: the fixed page content for step 4 */''}
        <div class="split l fill">${/* two-column layout: explanation on the left, the diagram on the right */''}
          <div class="stack">${/* the left column stacks its blocks with even spacing */''}
            <p class="lead m0">For every process the OS keeps a record and some memory. Adding threads changes what that bookkeeping looks like.</p>${/* opening paragraph: adding threads changes the OS's bookkeeping */''}
            <p class="m0"><b>Single-threaded:</b> a <span class="t">process control block</span> (PCB) and a user address space, plus one <span class="t">user stack</span> and one <span class="t">kernel stack</span>. The PCB also stores the registers and state of the single path.</p>${/* paragraph: a single-threaded process has one PCB, one address space and one pair of stacks */''}
            <p class="m0"><b>Multithreaded:</b> still one PCB and one user address space, but <b>each thread</b> gets its own <span class="t" data-t="Thread control block (TCB)">thread control block</span> (TCB), user stack and kernel stack.</p>${/* paragraph: a multithreaded process adds a TCB and two stacks for each thread */''}
            <div class="callout why m0" data-label="Why a kernel stack per thread?">When a thread makes a system call, the kernel works on its behalf and needs a place for its own function calls. Two threads can both be inside the kernel at once (one waiting for the disk, one for the network), so each needs its own.</div>${/* why box: each thread needs its own kernel stack because two threads can be in the kernel at once */''}
            <div class="callout warn sm m0" data-label="Common mistake">A TCB is not a second PCB. It holds only per-thread facts (registers, priority, state); everything else stays in the one PCB.</div>${/* common-mistake box: a TCB is not a second PCB */''}
          </div>${/* ends the left column */''}
          <div class="card white stack s4-host"></div>${/* the empty card on the right where render() draws the diagram */''}
        </div>`,  // ends the layout and the HTML text
      render(el, ctx) {  // render(el, ctx): builds the bookkeeping diagram when step 4 is shown
        const { h, s } = ctx;  // takes the HTML and SVG element builders from the toolbox
        const host = ctx.$('.s4-host');  // host is the right-hand card that receives the diagram
        let mode = 'multi', status = 'ok', sel = null;  // mode is single or multi; status is ok, susp (suspended) or dead; sel is the clicked box
        const NW = ctx.narrow;  // NW is true on a phone-width screen, where the diagram is drawn in a taller, thinner shape
        const svg = s('svg', { viewBox: '0 0 640 262', width: '100%', role: 'img', 'aria-label': 'Process control structures' });  // the SVG drawing area; draw() adjusts its shape
        const info = h('div', { class: 'info', style: { minHeight: '98px' } });  // the explanation box under the diagram, with a fixed minimum height
        const INFO = {  // INFO: a function per box id that returns its explanation (the PCB's text depends on the mode)
          pcb: () => mode === 'single'  // the PCB explanation depends on whether the process has one thread or many
            ? '<b>Process control block (PCB).</b> The OS’s record of the process: identity, owned resources, memory map, access rights. With only one path of execution, it also holds the saved registers and the execution state.'  // single-threaded PCB: it also holds the registers and state of the only path
            : '<b>Process control block (PCB).</b> Still one per process, but now it holds only process-wide facts: identity, resources, memory map and access rights. The per-path details have moved into the TCBs.',  // multithreaded PCB: only process-wide facts, because per-thread details moved into the TCBs
          uas: () => '<b>User address space.</b> The program’s code, global data and heap: one copy, used by every thread of the process.',  // explanation for the user address space: one copy used by every thread
          tcb: () => '<b>Thread control block (TCB).</b> One per thread: its register values (saved while it is not running), its priority, its state and other thread-related facts.',  // explanation for a TCB: one per thread, holding its registers, priority and state
          ustack: () => '<b>User stack.</b> Holds the function calls, parameters and local variables of ordinary program code. Each thread calls functions independently, so each needs its own.',  // explanation for a user stack: each thread calls functions independently
          kstack: () => '<b>Kernel stack.</b> Used while the kernel works on behalf of this path of execution, for example during a system call or an interrupt.',  // explanation for a kernel stack: used while the kernel works for this path
        };  // closes the INFO table
        const DEF = {  // DEF: the default explanation for each mode, shown when nothing is clicked
          single: 'One PCB, one address space, one pair of stacks. Click any box to see what it holds.',  // default text for the single-threaded view
          multi: 'Three threads: the PCB and address space appear once, the TCB and both stacks appear once <b>per thread</b>. Click any box.',  // default text for the multithreaded view
        };  // closes the DEF table
        function blk(id, x, y, w, hh, cls, title, sub) {  // blk(): draws one clickable labelled box; clicking it selects it and shows its explanation
          const g = s('g', { class: 'hot' + (sel === id ? ' sel' : ''), tabindex: 0, role: 'button', 'aria-label': title, onclick: () => { sel = id; info.innerHTML = INFO[id](); draw(); } },  // the group is focusable and highlighted when selected; its click handler fills the info box and redraws
            s('rect', { class: 'fr ' + cls, x, y, width: w, height: hh, rx: 8, 'stroke-width': 1.5 }),  // the box's frame, colored by cls
            s('text', { x: x + w / 2, y: y + hh / 2 + (sub ? -3 : 5), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, title),  // the box's main label, centered; it moves up a little when there is a second line
            sub ? s('text', { x: x + w / 2, y: y + hh / 2 + 15, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, sub) : null);  // the optional second line of the label, in smaller grey text
          return g;  // hands the finished box back to draw()
        }  // ends blk()
        function draw() {  // draw(): rebuilds the diagram for the current mode and status; runs after every change
          const kids = [];  // kids collects every shape in the drawing
          const gone = status === 'dead', susp = status === 'susp';  // gone is true after Terminate; susp is true while the process is suspended
          svg.setAttribute('viewBox', !NW ? '0 0 640 262' : mode === 'single' ? '0 0 330 262' : '0 0 330 312');  // picks the drawing's shape: one wide shape on large screens, taller for multithreaded on a phone
          if (mode === 'single' && NW) {  // phone layout of the single-threaded process
            kids.push(s('rect', { x: 4, y: 6, width: 322, height: 246, rx: 14, class: 's-proc', 'stroke-width': 2 }),  // the process outline for the phone layout
              s('text', { x: 16, y: 28, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'Single-threaded process'),  // the title "Single-threaded process"
              blk('pcb', 14, 40, 150, 70, 's-os', 'Process control', 'block + registers'),  // the PCB box, which here also holds the registers
              blk('uas', 14, 122, 150, 118, susp ? 's-io' : 's-mem', 'User address', susp ? 'swapped out' : 'space'),  // the address space box; when suspended it changes color and says it is swapped out
              blk('ustack', 172, 40, 144, 94, 's-panel', 'User stack', susp ? 'frozen' : 'the only one'),  // the one user stack, frozen while suspended
              blk('kstack', 172, 146, 144, 94, 's-panel', 'Kernel stack', susp ? 'frozen' : 'the only one'));  // the one kernel stack, frozen while suspended
          } else if (NW) {  // phone layout of the multithreaded process
            kids.push(s('rect', { x: 4, y: 6, width: 322, height: 300, rx: 14, class: 's-proc', 'stroke-width': 2 }),  // the process outline for the phone layout
              s('text', { x: 16, y: 26, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'The process'),  // the title "The process"
              blk('pcb', 14, 34, 148, 62, 's-os', 'Process control', 'block (one)'),  // the one PCB box
              blk('uas', 168, 34, 148, 62, susp ? 's-io' : 's-mem', 'User address', susp ? 'swapped out' : 'space (one)'));  // the one address space box, marked swapped out while suspended
            for (let k = 0; k < 3; k++) {  // draws the three threads side by side
              const x = 14 + k * 102;  // the left edge of this thread's column
              kids.push(s('rect', { x, y: 106, width: 98, height: 192, rx: 10, class: 's-thread', 'stroke-width': 1.5, 'fill-opacity': 0.5 }),  // a light pink column that groups this thread's parts
                s('text', { x: x + 49, y: 124, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--thread)' }, 'T' + (k + 1) + (susp ? ' frozen' : '')),  // the thread's name, with "frozen" added while the process is suspended
                blk('tcb', x + 6, 132, 86, 50, 's-os', 'TCB'),  // the thread's TCB
                blk('ustack', x + 6, 188, 86, 50, 's-panel', 'User', 'stack'),  // the thread's user stack
                blk('kstack', x + 6, 244, 86, 50, 's-panel', 'Kernel', 'stack'));  // the thread's kernel stack
            }  // ends the loop over threads
          } else if (mode === 'single') {  // wide-screen layout of the single-threaded process
            kids.push(s('rect', { x: 120, y: 6, width: 400, height: 246, rx: 14, class: 's-proc', 'stroke-width': 2 }),  // the process outline, centered
              s('text', { x: 136, y: 28, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'Single-threaded process'),  // the title "Single-threaded process"
              blk('pcb', 136, 40, 180, 70, 's-os', 'Process control block', 'incl. registers + state'),  // the PCB box, including registers and state
              blk('uas', 136, 122, 180, 118, susp ? 's-io' : 's-mem', 'User address space', susp ? 'swapped out to disk' : 'code, data, heap'),  // the address space box: code, data and heap, or swapped out to disk while suspended
              blk('ustack', 328, 40, 176, 94, 's-panel', 'User stack', susp ? 'frozen: cannot run' : 'the only one'),  // the one user stack; while suspended it cannot run
              blk('kstack', 328, 146, 176, 94, 's-panel', 'Kernel stack', susp ? 'frozen: cannot run' : 'the only one'));  // the one kernel stack; while suspended it cannot run
          } else {  // wide-screen layout of the multithreaded process
            kids.push(s('rect', { x: 4, y: 6, width: 632, height: 246, rx: 14, class: 's-proc', 'stroke-width': 2 }),  // the process outline across the full width
              s('text', { x: 18, y: 28, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'The process'),  // the title "The process"
              blk('pcb', 16, 40, 150, 70, 's-os', 'Process control', 'block (one)'),  // the one PCB box, at the left
              blk('uas', 16, 122, 150, 118, susp ? 's-io' : 's-mem', 'User address', susp ? 'swapped out' : 'space (one)'));  // the one address space box below it, marked swapped out while suspended
            for (let k = 0; k < 3; k++) {  // draws the three thread columns to the right of the shared boxes
              const x = 180 + k * 152;  // the left edge of this thread's column
              kids.push(s('rect', { x, y: 14, width: 142, height: 232, rx: 11, class: 's-thread', 'stroke-width': 1.5, 'fill-opacity': 0.5 }),  // a light pink column that groups this thread's parts
                s('text', { x: x + 71, y: 32, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--thread)' }, 'Thread ' + (k + 1) + (susp ? ' · frozen' : '')),  // the thread's name, with "frozen" added while the process is suspended
                blk('tcb', x + 8, 42, 126, 60, 's-os', 'Thread control', 'block (TCB)'),  // the thread's TCB
                blk('ustack', x + 8, 110, 126, 60, 's-panel', 'User stack'),  // the thread's user stack
                blk('kstack', x + 8, 178, 126, 60, 's-panel', 'Kernel stack'));  // the thread's kernel stack
            }  // ends the loop over threads
          }  // ends the choice of layout
          const g = s('g', { class: gone ? 'dim' : '' }, ...kids);  // wraps every shape in one group, faded out after the process is terminated
          const ox = NW ? 20 : 150, cx = NW ? 165 : 320;  // the left edge and center of the "terminated" banner, which depend on the screen width
          const over = gone ? [s('rect', { x: ox, y: 104, width: NW ? 290 : 340, height: 50, rx: 12, class: 's-bad', 'stroke-width': 2 }),  // after Terminate, a red banner is drawn across the middle of the diagram
            s('text', { x: cx, y: 135, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, style: 'fill:var(--bad)' }, 'Terminated: everything freed')] : [];  // the banner's text: everything has been freed
          svg.replaceChildren(g, ...over);  // swaps in the new drawing, with the banner on top if there is one
          bS.textContent = susp ? 'Resume process' : 'Suspend process';  // the Suspend button's label flips to Resume while the process is suspended
          bS.disabled = gone; bT.textContent = gone ? 'Recreate process' : 'Terminate process';  // Suspend is disabled after Terminate, and Terminate becomes Recreate
          if (!sel && status === 'ok') info.innerHTML = DEF[mode];  // with nothing selected and the process running normally, shows the default text for the mode
        }  // ends draw()
        const bS = h('button', { type: 'button', class: 'btn sm io', onclick: () => {  // bS: the Suspend/Resume button; clicking it flips the process between suspended and running
          status = status === 'susp' ? 'ok' : 'susp'; sel = null;  // switches the status and clears any selection
          info.innerHTML = status === 'susp'  // explains what just happened
            ? (mode === 'multi' ? '<b>Suspended.</b> Suspension belongs to the process: its one address space is swapped out to disk to free main memory. Every thread needs that address space, so <b>all three</b> threads are frozen together, even one that was ready to run.' : '<b>Suspended.</b> The address space is swapped out to disk, so the single path cannot run until the process is brought back.')  // suspended: the address space is swapped out, so every thread freezes together (or the single path cannot run)
            : '<b>Resumed.</b> The address space is back in memory, so the threads can be scheduled again.';  // resumed: the address space is back and the threads can be scheduled again
          draw(); } });  // redraws, then ends the click handler and the button
        const bT = h('button', { type: 'button', class: 'btn sm intr', onclick: () => {  // bT: the Terminate/Recreate button; clicking it ends the process or brings it back
          status = status === 'dead' ? 'ok' : 'dead'; sel = null;  // switches between terminated and running, and clears any selection
          info.innerHTML = status === 'dead'  // explains what the OS frees
            ? (mode === 'multi' ? '<b>Terminated.</b> Ending a process ends <b>every</b> thread inside it, and the OS frees the address space, the PCB, every TCB and stack, and closes the open files.' : '<b>Terminated.</b> The OS frees the address space, the PCB and both stacks, and closes the process’s open files.')  // terminated: every thread ends and every record, stack and open file is released
            : DEF[mode];  // recreated: back to the default text
          draw(); } });  // redraws, then ends the click handler and the button
        const seg = ctx.ui.seg([{ value: 'single', label: 'Single-threaded' }, { value: 'multi', label: 'Multithreaded' }], mode, (v) => { mode = v; sel = null; status = 'ok'; draw(); });  // the Single/Multithreaded switch; changing it clears the selection and brings the process back to running
        host.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Process models'), seg),  // builds the card: heading and switch on top, then the diagram
          svg, h('div', { class: 'row', style: { gap: '8px' } }, bS, bT, h('span', { class: 'small muted' }, 'These act on the whole process: watch every thread.')), info);  // then the Suspend and Terminate buttons with a note that they act on the whole process, then the info box
        draw();  // draws the diagram for the first time when the step opens
      },  // ends render() for step 4
    },  // ends step 4
    /* ---------------- 5. Why threads are cheap ---------------- */
    {  // step 5 begins: the four ways threads save time compared with processes
      title: 'Why threads are cheap: four savings',  // the step title shown at the top of the page
      kind: 'explore',  // the kind of step (explore), shown as a label above the title
      html: `${/* html: the fixed page content for step 5 */''}
        <div class="split l fill">${/* two-column layout: the list of savings on the left, the cost tabs on the right */''}
          <div class="stack">${/* the left column stacks its blocks with even spacing */''}
            <p class="lead m0">The main reason to use threads is speed. Compared with separate processes, threads save time in four ways.</p>${/* opening paragraph: speed is the main reason to use threads */''}
            <ol class="ben">${/* numbered list of the four benefits begins */''}
              <li><b>Create:</b> a new thread takes far less time to set up than a new process.</li>${/* benefit 1: creating a thread is faster */''}
              <li><b>Terminate:</b> ending a thread takes less time than ending a process.</li>${/* benefit 2: ending a thread is faster */''}
              <li><b>Switch:</b> switching between two threads of the same process is quicker than switching between processes.</li>${/* benefit 3: switching between threads of one process is faster */''}
              <li><b>Communicate:</b> threads share memory, so they can pass data without calling the kernel. Separate processes need the kernel’s protection and help (<span class="t" data-t="Interprocess communication (IPC)">IPC</span>).</li>${/* benefit 4: threads communicate through shared memory without calling the kernel */''}
            </ol>${/* ends the numbered list */''}
            <div class="callout why m0" data-label="Why it matters">A file server gets a stream of small requests. A new thread per request is cheap; a new process per request is not. The second tab measures the difference.</div>          </div>${/* why box: a file server with many small requests; the left column ends here too */''}
          <div class="card white s5-host" style="min-height:0"></div>${/* the empty card on the right where render() puts the tabs */''}
        </div>`,  // ends the layout and the HTML text
      render(el, ctx) {  // render(el, ctx): builds the two tabs (cost breakdown and server comparison) when step 5 is shown
        const { h } = ctx;  // takes the HTML element builder from the toolbox
        const host = ctx.$('.s5-host');  // host is the right-hand card
        const OPS = {  // OPS: for each of the four operations, the work rows as [task, process cost, thread cost, note when a thread skips it]
          create: { label: 'Create', rows: [  // the Create operation's rows begin
            ['Allocate and fill a process control block', 2, 0, 'reuses the PCB'],  // create row: a new PCB, which a thread does not need
            ['Build a new address space (memory map)', 8, 0, 'already exists'],  // create row: a new address space
            ['Load or copy the program image into it', 10, 0, 'already loaded'],  // create row: loading the program image
            ['Set up the open-file table and I/O access', 3, 0, 'shared'],  // create row: the open-file table and I/O access
            ['Set up protection and IPC rights', 2, 0, 'shared'],  // create row: protection and IPC rights
            ['Allocate a TCB and stacks, set registers, mark Ready', 3, 3, ''],  // create row: the one piece both need, a TCB and stacks for the new thread
          ], say: 'Creating a process builds a whole new world (address space, image, files, protection) and then spawns its first thread. Creating a thread does only that last row.' },  // closes the Create rows; say explains the difference in one sentence
          term: { label: 'Terminate', rows: [  // the Terminate operation's rows begin
            ['Free a TCB and its stacks', 2, 2, ''],  // terminate row: free the TCB and stacks, which both must do
            ['Close open files, release I/O devices', 4, 0, 'siblings use them'],  // terminate row: close files and release devices, skipped for a thread because siblings still use them
            ['Tear down the address space, free its memory', 8, 0, 'siblings use it'],  // terminate row: tear down the address space
            ['Free the PCB and notify the parent', 2, 0, 'process lives on'],  // terminate row: free the PCB and tell the parent
          ], say: 'Ending a thread only frees its own small pieces. Ending a process must also tear down everything it owns (and every one of its threads).' },  // closes the Terminate rows with its explanation
          sw: { label: 'Switch', rows: [  // the Switch operation's rows begin
            ['Save the old thread’s registers', 1, 1, ''],  // switch row: save the old registers
            ['Load the new thread’s registers', 1, 1, ''],  // switch row: load the new registers
            ['Switch to the other process’s memory map', 3, 0, 'same map'],  // switch row: change the memory map, not needed between threads of one process
            ['Refill caches that held the old process’s data', 5, 0, 'still useful'],  // switch row: refill caches, not needed when the new thread uses the same data
          ], say: 'Two threads of one process live in the same address space, so a switch only swaps register sets. A process switch also changes the memory map, and the cached data of the old process becomes useless.' },  // closes the Switch rows with its explanation
          comm: { label: 'Communicate', rows: [  // the Communicate operation's rows begin
            ['Sender makes a system call (enter the kernel)', 2, 0, 'not needed'],  // communicate row: the sender enters the kernel
            ['Kernel copies the data into its own buffer', 3, 0, 'no copy'],  // communicate row: the kernel copies the message into its buffer
            ['Receiver makes a system call', 2, 0, 'not needed'],  // communicate row: the receiver enters the kernel
            ['Kernel copies the data out to the receiver', 3, 0, 'no copy'],  // communicate row: the kernel copies the message out
            ['Store to / load from shared memory', 0, 1, ''],  // communicate row: threads simply store to and load from shared memory
          ], say: 'Processes are walled off from each other, so the kernel must get involved: with message passing (shown here) it carries every byte across. Threads just write and read the same memory, although they must still coordinate.' },  // closes the Communicate rows with its explanation
        };  // closes the OPS table
        const table = h('table', { class: 'tbl compact cost' });  // the cost table for the chosen operation
        const bars = h('div', { class: 'stack', style: { gap: '6px' } });  // holds the two comparison bars under the table
        const say = h('div', { class: 'info' });  // the explanation box under the bars
        function showOp(k) {  // showOp(k): fills the table, the bars and the explanation for operation k; runs when a button is pressed
          const o = OPS[k];  // o is the chosen operation's data
          const P = o.rows.reduce((a, r) => a + r[1], 0), T = o.rows.reduce((a, r) => a + r[2], 0);  // adds up the total process cost (P) and total thread cost (T)
          table.innerHTML = `<thead><tr><th>Work the OS must do <span class="xs" style="text-transform:none;letter-spacing:0">(illustrative units)</span></th><th class="n">Process</th><th class="n w">Thread</th></tr></thead><tbody>` +  // the table header: the work column, then the Process and Thread columns
            o.rows.map((r) => `<tr><td>${r[0]}</td>${r[1] ? `<td class="n pr">${r[1]}</td>` : '<td class="n no">—</td>'}${r[2] ? `<td class="n th">${r[2]}</td>` : `<td class="n no">${r[3] || '—'}</td>`}</tr>`).join('') + '</tbody>';  // one row per task: a dash or the thread's note where a cost is zero, then closes the table body
          bars.replaceChildren(  // replaces the two bars
            h('div', { class: 'bar' }, h('span', { style: { color: 'var(--proc)' } }, 'Separate process'), h('div', { class: 'trk' }, h('i', { class: 'pb', style: { width: '100%' } })), h('span', { class: 'v' }, P + ' units')),  // the process bar, always full width, with its total at the right
            h('div', { class: 'bar' }, h('span', { style: { color: 'var(--thread)' } }, 'Thread'), h('div', { class: 'trk' }, h('i', { class: 'tb', style: { width: (T / P * 100) + '%' } })), h('span', { class: 'v' }, T + (T === 1 ? ' unit' : ' units'))));  // the thread bar, as a share of the process total, with its total at the right
          say.innerHTML = `<b>${o.label}: about ${Math.round(P / T)}× less work for a thread.</b> ${o.say}`;  // the headline: roughly how many times less work a thread needs, followed by the explanation
        }  // ends showOp()
        function costTab(p) {  // costTab(p): fills the first tab, "Where the time goes", when the student opens it
          const seg = ctx.ui.seg(Object.entries(OPS).map(([value, o]) => ({ value, label: o.label })), 'create', showOp);  // a four-button switch, one per operation (Create, Terminate, Switch, Communicate); choosing one calls showOp
          p.append(h('div', { class: 'stack', style: { gap: '10px' } }, seg, table, bars, say,  // stacks the switch, the table, the bars and the explanation in the tab panel
            h('p', { class: 'small muted m0', html: '<b>The common thread:</b> every saving comes from reusing what the process already owns.' })));  // closing note: every saving comes from reusing what the process already owns
          showOp('create');  // shows the Create operation first
        }  // ends costTab()
        function serverTab(p) {  // serverTab(p): fills the second tab, a file server that creates a helper for every request
          const PC = 500, TC = 50; // microseconds for create + terminate, illustrative
          const big1 = h('div', { class: 'big', style: { color: 'var(--proc)' } }), big2 = h('div', { class: 'big', style: { color: 'var(--thread)' } });  // two big percentage numbers, one in the process color and one in the thread color
          const m1 = h('i', { class: 'pb' }), m2 = h('i', { class: 'tb' });  // the two meter bars that show those percentages
          const out = h('div', { class: 'info' });  // the explanation box that shows the arithmetic
          function upd(r) {  // upd(r): recalculates everything for r requests per second; runs whenever the slider moves
            const p1 = r * PC / 10000, p2 = r * TC / 10000; // percent of one processor
            big1.textContent = Math.min(100, p1).toFixed(0) + '%'; big2.textContent = p2.toFixed(0) + '%';  // shows each percentage as a whole number; the process figure is capped at 100%
            m1.style.width = Math.min(100, p1) + '%'; m2.style.width = Math.min(100, p2) + '%';  // sets each meter bar's width to its percentage, capped at a full bar
            out.innerHTML = `${r} requests/s × ${PC} µs = <b>${ctx.util.fmt(r * PC / 1000, 1)} ms</b> of creating and ending processes per second, versus ${r} × ${TC} µs = <b>${ctx.util.fmt(r * TC / 1000, 1)} ms</b> with threads. ` +  // spells out the sum: requests per second times the cost of each, in milliseconds per second
              (p1 > 100 ? '<b style="color:var(--bad)">That is more than one second of overhead every second: the process version cannot keep up at all, and no real work gets done.</b>'  // when the process version needs more than a whole second of overhead per second, says it cannot keep up
                : p1 === 100 ? '<b style="color:var(--bad)">That is the whole processor: the process version is saturated, with nothing left for real work.</b>'  // when it uses exactly the whole processor, says it is saturated
                  : `That leaves ${(100 - p1).toFixed(0)}% versus ${(100 - p2).toFixed(0)}% of the processor for actual file serving.`);  // otherwise compares how much of the processor is left for real work in each version
          }  // ends upd()
          const sl = ctx.ui.slider({ label: 'Requests per second', min: 100, max: 2400, step: 100, value: 800, onInput: upd });  // the requests-per-second slider (100 to 2400, starting at 800); moving it calls upd with the new value
          p.append(h('div', { class: 'stack' },  // stacks the tab's contents
            h('p', { class: 'small m0', html: 'A server spawns a helper for each request and ends it when the reply is sent. Illustrative costs: <b>500 µs</b> to create and end a process, <b>50 µs</b> for a thread (measured systems often show a gap of ten times or more).' }),  // intro paragraph: the server spawns a helper per request, with the illustrative costs
            sl,  // then the slider
            h('div', { class: 'grid-2' },  // two cards side by side
              h('div', { class: 'card proc tight' }, h('h4', {}, 'Process per request'), big1, h('div', { class: 'bar', style: { gridTemplateColumns: '1fr' } }, h('div', { class: 'trk' }, m1)), h('div', { class: 'xs muted' }, 'of one processor lost to overhead')),  // process card: its percentage, its meter bar and a caption
              h('div', { class: 'card thread tight' }, h('h4', {}, 'Thread per request'), big2, h('div', { class: 'bar', style: { gridTemplateColumns: '1fr' } }, h('div', { class: 'trk' }, m2)), h('div', { class: 'xs muted' }, 'of one processor lost to overhead'))),  // thread card: its percentage, its meter bar and a caption
            out,  // then the explanation box
            h('div', { class: 'callout tip sm m0', 'data-label': 'Going further', html: 'Busy real servers often skip even the thread cost: they create a <b>pool</b> of threads once at start-up and hand each new request to an idle one, so nothing is created or ended per request.' })));  // going-further box: real servers often keep a pool of ready threads
          upd(800);  // fills the tab for the slider's starting value, 800 requests per second
        }  // ends serverTab()
        host.append(ctx.ui.tabs([{ label: 'Where the time goes', render: costTab }, { label: 'A busy file server', render: serverTab }]));  // puts the two tabs into the card; each tab's function runs when the student opens that tab
      },  // ends render() for step 5
    },  // ends step 5
    /* ---------------- 6. Four uses of threads ---------------- */
    {  // step 6 begins: a game that sorts eight programs into the four uses of threads
      title: 'What threads are used for: sort the scenarios',  // the step title shown at the top of the page
      kind: 'lab',  // the kind of step (lab), shown as a label above the title
      html: `${/* html: the fixed page content for step 6 */''}
        <div class="split l fill">${/* two-column layout: the four uses on the left, the game on the right */''}
          <div class="stack" style="gap:8px">${/* the left column stacks its cards with a small gap */''}
            <p class="m0">Even on a single-user computer, threads earn their keep in four ways:</p>${/* intro line: threads are useful even on a single-user computer */''}
            <div class="card thread use m0"><b>1 · Foreground and background work</b><span>One thread serves the user while another does the heavy work. In a spreadsheet, one thread shows menus and reads input while another runs commands and updates the sheet, so the program feels faster.</span></div>${/* use card 1: foreground and background work, with the spreadsheet example */''}
            <div class="card thread use m0"><b>2 · Asynchronous processing</b><span>Work that happens independently of the main flow, set off by a timer or an outside event. A word processor can give one thread the job of saving the buffer to disk every minute, in case the power fails.</span></div>${/* use card 2: asynchronous processing, with the timed-backup example */''}
            <div class="card thread use m0"><b>3 · Speed of execution</b><span>One thread computes on a batch of data while another reads the next batch from a device. On a multiprocessor, several threads of one process can even run at the same instant.</span></div>${/* use card 3: speed of execution by overlapping work, or using several processors */''}
            <div class="card thread use m0"><b>4 · Modular program structure</b><span>A program with many separate activities, or many sources and destinations of I/O, is easier to design and build as one thread per activity.</span></div>${/* use card 4: modular program structure, one thread per activity */''}
          </div>${/* ends the left column */''}
          <div class="card white stack s6-host"></div>${/* the empty card on the right where render() builds the game */''}
        </div>`,  // ends the layout and the HTML text
      render(el, ctx) {  // render(el, ctx): builds the scenario-sorting game when step 6 is shown
        const { h } = ctx;  // takes the HTML element builder from the toolbox
        const host = ctx.$('.s6-host');  // host is the right-hand card
        const CAT = ['Foreground / background', 'Asynchronous', 'Speed of execution', 'Modular structure'];  // CAT: the four category names, used for the bins and the answer buttons
        const TEST = [  // TEST: a one-line test for each category, shown after a wrong answer
          'Foreground/background means one thread keeps serving the user while another does heavy work.',  // test for foreground/background: one thread serves the user while another works
          'Asynchronous processing means work set off by a timer or an outside event, independent of the program’s main flow.',  // test for asynchronous: work set off by a timer or an outside event
          'Speed of execution means overlapping computation with I/O, or running on several processors at once, so the job finishes sooner.',  // test for speed: overlapping computing with I/O, or running on several processors
          'Modular structure means organising a program with many different activities into simple, separate pieces.',  // test for modular: splitting many activities into separate simple pieces
        ];  // closes the TEST list
        const SC = [  // SC: the eight scenarios as [story, correct category index, short chip label, explanation]
          ['A photo editor keeps its menus and brushes responsive while a second thread applies a slow blur to the whole image.', 0, 'photo editor blur', 'The user-facing thread stays responsive while the heavy blur runs behind it.'],  // scenario 1: a photo editor stays responsive during a blur (foreground/background)
          ['A video converter decodes chunk 7 of a film while a second thread is already reading chunk 8 from the disk.', 2, 'decode while reading', 'Computing and reading overlap, so the processor never sits idle waiting for the disk.'],  // scenario 2: a video converter decodes one chunk while reading the next (speed)
          ['A note-taking app writes a recovery copy of your document to disk every 60 seconds, whatever you are doing.', 1, 'recovery copy every 60 s', 'The save runs on its own timer. Without a thread, the main code would need to keep checking the clock.'],  // scenario 3: a note app saves a recovery copy every minute (asynchronous)
          ['A robot controller is written as separate threads for the camera, the motors and the network link, each a short loop with one job.', 3, 'robot: camera/motors/net', 'Three independent activities with their own I/O become three simple threads instead of one tangled loop.'],  // scenario 4: a robot controller with one thread per device (modular)
          ['On a four-core laptop, a rendering program splits one image into four strips and gives each strip to its own thread.', 2, 'four strips, four cores', 'On a multiprocessor, the four threads truly run at the same moment, so the image can finish up to about four times sooner (Section 4.3 shows why the gain is rarely a full 4×).'],  // scenario 5: a renderer splits an image across four cores (speed)
          ['In a tax-return program, one thread reads what you type into the form while another recalculates all the totals.', 0, 'tax form + totals', 'Typing stays smooth (foreground) while the recalculation runs behind it (background).'],  // scenario 6: a tax program keeps typing smooth while totals recalculate (foreground/background)
          ['A game is organised as separate threads for sound, controller input and networking, so each part can be written and tested on its own.', 3, 'game: sound/input/net', 'The point is program structure: each activity becomes its own easy-to-understand thread.'],  // scenario 7: a game with separate threads for sound, input and network (modular)
          ['A chat program has a thread that wakes every 30 seconds to tell the server “I am still online”.', 1, 'heartbeat every 30 s', 'A periodic job on its own schedule, unrelated to what the user is doing: asynchronous processing.'],  // scenario 8: a chat program's 30-second heartbeat (asynchronous)
        ];  // closes the SC list
        let i = 0, wrong = 0, done = [], missed = false;  // i is the current scenario, wrong counts mistakes, done lists sorted scenarios, missed marks a first-try miss
        const scn = h('div', { class: 'card thread scn' });  // the card that shows the current scenario's story
        const fb = h('div', { class: 'info', style: { minHeight: '66px' } });  // the feedback box under the answer buttons
        const score = h('span', { class: 'chip accent' });  // the score chip: how many sorted and how many wrong
        const bins = CAT.map((c) => h('div', { class: 'bin' }, h('h4', {}, c)));  // one bin per category, each starting with its heading
        const btns = CAT.map((c, k) => h('button', { type: 'button', class: 'btn', onclick: () => answer(k) }, (k + 1) + ' · ' + c));  // the four answer buttons, numbered 1 to 4
        const next = h('button', { type: 'button', class: 'btn sm primary', onclick: () => { i++; fb.innerHTML = i < SC.length ? 'Pick the <b>main</b> reason this program uses threads.' : fb.innerHTML; show(); } }, 'Next scenario →');  // the Next button: moves to the next scenario and resets the prompt (keeps the final feedback at the end)
        function show() {  // show(): displays the current scenario, or the finished message after the last one
          score.textContent = `${done.length} / ${SC.length} sorted · ${wrong} wrong`;  // updates the score text
          next.style.display = 'none';  // hides the Next button until the current scenario is answered correctly
          if (i >= SC.length) {  // after the eighth scenario
            scn.innerHTML = `<div><b>All eight sorted${wrong ? '' : ' with no mistakes'}!</b> The four uses often overlap in real programs, but each scenario has one main reason for its threads. Orange chips needed a second try.</div>`;  // shows the finished message, saying whether there were no mistakes and what the orange chips mean
            btns.forEach((b) => (b.disabled = true));  // disables the answer buttons because the game is over
            return;  // stops here so no new scenario is shown
          }  // ends the finished case
          missed = false;  // a new scenario starts with no miss recorded
          scn.innerHTML = `<div><span class="xs muted b">SCENARIO ${i + 1} OF ${SC.length}</span><br>${SC[i][0]}</div>`;  // shows "Scenario n of 8" above the story
          btns.forEach((b) => { b.disabled = false; b.classList.remove('on'); });  // re-enables the answer buttons for the new scenario
        }  // ends show()
        function answer(k) {  // answer(k): runs when the student presses answer button k
          const s = SC[i];  // s is the current scenario
          if (!s) return;  // ignores clicks after the game has ended
          if (k === s[1]) {  // a correct answer
            done.push(i);  // records this scenario as sorted
            bins[k].append(h('span', { class: 'chip ' + (missed ? 'warn' : 'ok') + ' fade-in' }, s[2]));  // drops its chip into the right bin: green on the first try, orange if it needed a second try
            fb.innerHTML = `<b style="color:var(--ok)">Yes: ${CAT[k]}.</b> ${s[3]}`;  // confirms the category and explains it
            btns.forEach((b) => (b.disabled = true));  // disables the answer buttons until Next is pressed
            score.textContent = `${done.length} / ${SC.length} sorted · ${wrong} wrong`;  // updates the score
            next.style.display = '';  // shows the Next button
            if (i === SC.length - 1) { next.textContent = 'Finish'; }  // on the last scenario the Next button reads Finish instead
          } else {  // a wrong answer
            wrong++; missed = true; btns[k].disabled = true;  // counts the mistake, remembers the miss for this scenario, and disables the wrong button so it cannot be picked again
            fb.innerHTML = `<b style="color:var(--bad)">Not the main point here.</b> ${TEST[k]} Is that what this scenario is about? Try another.`;  // explains what that category really means and asks the student to try another
            score.textContent = `${done.length} / ${SC.length} sorted · ${wrong} wrong`;  // updates the score
          }  // ends the right/wrong choice
        }  // ends answer()
        function reset() { i = 0; wrong = 0; done = []; bins.forEach((b, k) => b.replaceChildren(h('h4', {}, CAT[k]))); next.textContent = 'Next scenario →'; fb.innerHTML = 'Read the scenario, then pick the <b>main</b> reason it uses threads.'; show(); }  // reset(): empties the bins, clears the score and restarts from scenario 1
        host.append(  // builds the right-hand card
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Which use is this?'), h('div', { class: 'row' }, score, h('button', { type: 'button', class: 'btn sm ghost', onclick: reset }, 'Restart'))),  // top row: the heading on the left, the score and a Restart button on the right
          scn, h('div', { class: 'pick4' }, ...btns), h('div', { class: 'row', style: { gap: '10px', alignItems: 'flex-start', flexWrap: 'nowrap' } }, h('div', { class: 'grow' }, fb), next), h('div', { class: 'bins' }, ...bins));  // then the scenario card, the four answer buttons, the feedback with the Next button beside it, and the four bins
        reset();  // starts the game when the step opens
      },  // ends render() for step 6
    },  // ends step 6
    /* ---------------- 7. Thread states and operations on one processor ---------------- */
    {  // step 7 begins: thread states and the four thread operations, simulated on one processor
      title: 'Thread states, four operations, one processor',  // the step title shown at the top of the page
      kind: 'explore',  // the kind of step (explore), shown as a label above the title
      core: true,  // core: true keeps this step on the shorter core route through the guide
      html: `${/* html: the fixed page content for step 7 */''}
        <div class="split l fill">${/* two-column layout: the state diagram and notes on the left, the simulator on the right */''}
          <div class="stack" style="gap:10px">${/* the left column stacks its blocks with a small gap */''}
            <div class="card white tight s7-diag"></div>${/* the empty card where render() draws the state diagram */''}
            <ul class="ops">${/* list of the four thread operations begins */''}
              <li><b><span class="t">Spawn</span>:</b> a thread creates a sibling in its own process (start address + arguments) with its own context and stacks → Ready.</li>${/* operation Spawn: creates a sibling thread with its own context and stacks, placed on Ready */''}
              <li><b>Block:</b> it must wait for an event; its registers are saved → Blocked.</li>${/* operation Block: the thread waits for an event and its registers are saved */''}
              <li><b>Unblock:</b> the event has happened → Ready.</li>${/* operation Unblock: the event happened, so the thread is Ready again */''}
              <li><b>Finish:</b> it ends; its register context and stacks are freed.</li>${/* operation Finish: the thread ends and its context and stacks are freed */''}
            </ul>${/* ends the operations list */''}
            <div class="callout tip sm m0" data-label="No Suspended state for threads">Suspending swaps out the address space that all the threads share, so in this model it is a process-level state, not a thread-level one.</div>${/* tip box: threads have no Suspended state, because suspension swaps out the shared address space */''}
            <div class="callout why sm m0" data-label="Open question">When one thread blocks, is its whole process blocked? That depends on how the threads are built. Section 4.2 answers it.</div>${/* open-question box: does one blocked thread block its whole process? answered in section 4.2 */''}
          </div>${/* ends the left column */''}
          <div class="card white stack s7-host" style="gap:10px"></div>${/* the empty card on the right where render() builds the simulator */''}
        </div>`,  // ends the layout and the HTML text
      render(el, ctx) {  // render(el, ctx): builds the state diagram, the thread table and the timeline when step 7 is shown
        const { h, s } = ctx;  // takes the HTML and SVG element builders from the toolbox
        const host = ctx.$('.s7-host'), diag = ctx.$('.s7-diag');  // host is the simulator card on the right; diag is the diagram card on the left
        const T = (S, id) => S.th.find((t) => t.id === id);  // T(S, id): finds the thread with this id in simulation state S
        const init = () => ({ th: [{ id: 'A', p: 'P1', pr: 2, st: 'Running' }, { id: 'C', p: 'P2', pr: 1, st: 'Ready' }], q: ['C'], run: 'A', last: 'A', hist: [], arcs: [], say: '' });  // init(): the starting state: A (process P1, priority 2) running, C (P2, priority 1) ready; empty history
        function dispatch(S) {  // dispatch(S): picks the next thread to run and returns a sentence describing the choice
          if (!S.q.length) { S.run = null; return ' The ready list is empty, so the processor sits <b>idle</b>.'; }  // with nothing ready, the processor has nothing to run and sits idle
          let b = 0; S.q.forEach((id, k) => { if (T(S, id).pr > T(S, S.q[b]).pr) b = k; });  // finds the ready thread with the highest priority; on a tie the one nearest the front of the list wins
          const id = S.q.splice(b, 1)[0], t = T(S, id), prev = S.last ? T(S, S.last) : null;  // takes it off the ready list; prev is the thread that ran last
          t.st = 'Running'; S.run = id; S.last = id; S.arcs.push('dispatch');  // marks it Running and lights the dispatch arrow in the diagram
          if (prev && prev.id === id) return ` ${id} is the only ready thread, so it runs again.`;  // when the same thread is picked again, says so
          return ` The dispatcher runs <b>${id}</b> (${t.p}): ` + (prev && prev.p === t.p ? 'a cheap <b>thread switch</b> inside one process.' : 'a <b>process switch</b>, so the memory map changes too.');  // otherwise says whether this is a cheap thread switch (same process) or a process switch (new memory map)
        }  // ends dispatch()
        function apply(S, ev) {  // apply(S, ev): applies one event (a button press) to the state and writes an explanation into S.say
          S.arcs = [];  // clears the lit arrows from the previous event
          const cur = S.run ? T(S, S.run) : null;  // cur is the thread running before this event, if any
          S.hist.push(cur ? { id: cur.id, p: cur.p } : { id: null });  // records who held the processor for this time slot, for the timeline
          let m = '';  // m will hold the explanation
          if (ev.type === 'spawn') {  // Spawn event
            S.th.push({ id: ev.id, p: ev.p, pr: 1, st: 'Ready' }); S.q.push(ev.id); S.arcs.push('spawn');  // adds the new thread, priority 1, to the ready list and lights the spawn arrow
            m = `<b>Spawn:</b> the running thread ${cur.id} creates ${ev.id} in its own process ${ev.p}. ${ev.id} gets its own TCB, register context and stacks and joins the ready list; ${cur.id} keeps running.`;  // explains that the running thread created a sibling in its own process and keeps running
          } else if (ev.type === 'block') {  // Block event
            cur.st = 'Blocked'; S.run = null; S.arcs.push('block');  // the running thread becomes Blocked, the processor is free, and the block arrow lights
            m = `<b>Block:</b> ${cur.id} must wait for I/O, so it becomes Blocked and its registers are saved in its TCB.` + dispatch(S);  // explains the block, then lets the dispatcher pick the next thread
          } else if (ev.type === 'quantum') {  // time-quantum event
            cur.st = 'Ready'; S.q.push(cur.id); S.run = null; S.arcs.push('timeout');  // the running thread goes back to the end of the ready list
            m = `<b>Quantum expired:</b> ${cur.id} goes to the back of the ready list.` + dispatch(S);  // explains the expired quantum, then dispatches
          } else if (ev.type === 'unblock') {  // Unblock event
            const t = T(S, ev.id); t.st = 'Ready'; S.arcs.push('unblock');  // the waiting thread becomes Ready and the unblock arrow lights
            m = `<b>Unblock:</b> the event ${t.id} was waiting for has happened, so ${t.id} is Ready.`;  // explains that its event has happened
            if (!S.run) { S.q.push(t.id); m += dispatch(S); }  // if the processor is idle, the thread joins the ready list and is dispatched at once
            else if (t.pr > cur.pr) { cur.st = 'Ready'; S.q.push(cur.id, t.id); S.run = null; S.arcs.push('timeout'); m += ` It outranks the running ${cur.id}, so ${cur.id} is <b>preempted</b>.` + dispatch(S); }  // if it outranks the running thread, the running one is preempted and both go on the ready list before dispatching
            else { S.q.push(t.id); m += ' It waits its turn on the ready list.'; }  // otherwise it simply waits on the ready list
          } else if (ev.type === 'finish') {  // Finish event
            cur.st = 'Done'; S.run = null; S.arcs.push('finish');  // the running thread is done, the processor is free, and the finish arrow lights
            m = `<b>Finish:</b> ${cur.id} is done; its register context and stacks are freed.` + dispatch(S);  // explains that its context and stacks are freed, then dispatches
          }  // ends the list of event types
          S.say = m;  // saves the explanation for the caption
          return S;  // hands back the updated state
        }  // ends apply()
        const replay = (evs) => evs.reduce(apply, init());  // replay(evs): rebuilds the state from scratch by applying every event in order; used when stepping back in history

        /* ---- state diagram ---- */
        const FS = ctx.narrow ? 18 : 14; // bigger labels on phones, where the diagram is drawn smaller
        const dsvg = s('svg', { viewBox: '0 0 460 196', width: '100%', class: ctx.narrow ? 'nw' : '', role: 'img', 'aria-label': 'Thread state diagram' });  // the diagram's SVG; on a phone it gets the "nw" class so its arrow labels are drawn larger
        diag.append(dsvg);  // places the diagram in the left-hand card
        const ARCS = {  // ARCS: each arrow in the diagram as [path shape, label, label x, label y, label alignment]
          spawn: ['M80,2 L80,34', 'Spawn', 90, 18, 'start'],  // arrow into Ready for Spawn
          dispatch: ['M140,50 C180,20 220,20 260,50', 'dispatch', 200, 22, 'middle'],  // arrow from Ready to Running for dispatch
          timeout: ['M260,76 C220,104 180,104 140,76', 'quantum over / preempted', 200, 116, 'middle'],  // arrow from Running back to Ready when the quantum ends or the thread is preempted
          block: ['M322,88 C320,124 296,152 264,162', 'Block', 326, 140, 'start'],  // arrow from Running to Blocked for Block
          unblock: ['M140,162 C106,152 82,124 80,90', 'Unblock', 14, 136, 'start'],  // arrow from Blocked back to Ready for Unblock
          finish: ['M382,62 L436,62', 'Finish', 408, 52, 'middle'],  // arrow out of Running for Finish
        };  // closes the ARCS table
        function drawDiag(S) {  // drawDiag(S): redraws the state diagram, lighting the arrows the last event used
          const kids = [];  // kids collects every shape in the diagram
          Object.entries(ARCS).forEach(([k, [d, lab, lx, ly, anc]]) => {  // draws each arrow and its label
            const on = S.arcs.includes(k);  // on is true when the last event used this arrow
            kids.push(s('path', { d, class: 'arc' + (on ? ' on' : ''), 'marker-end': on ? 'url(#arr-thread)' : 'url(#arr-muted)' }),  // the arrow itself: thread-colored with a colored head when lit, grey otherwise
              s('text', { x: lx, y: ly, 'text-anchor': anc, class: 'arcl' + (on ? ' on' : '') }, lab));  // the arrow's label, lit the same way
          });  // ends the loop over arrows
          kids.push(s('circle', { cx: 446, cy: 62, r: 7, class: 's-panel', 'stroke-width': 2 }));  // a small circle at the end of the Finish arrow that marks "gone"
          [['Ready', 20, 36, 'Ready', 's-accent'], ['Running', 262, 36, 'Running', 's-ok'], ['Blocked', 142, 138, 'Blocked', 's-intr']].forEach(([st, x, y, lab, cls]) => {  // draws the three state boxes: Ready, Running and Blocked, each with its own color
            const ids = (st === 'Ready' ? S.q.slice() : S.th.filter((t) => t.st === st).map((t) => t.id)).join(', ') || '—';  // lists the thread ids in each state (Ready in ready-list order), or a dash when empty
            kids.push(s('rect', { x, y, width: 120, height: 52, rx: 14, class: cls, 'stroke-width': 2 }),  // the state's box
              s('text', { x: x + 60, y: y + 22, 'text-anchor': 'middle', 'font-size': FS, 'font-weight': 800 }, lab),  // the state's name
              s('text', { x: x + 60, y: y + 43, 'text-anchor': 'middle', 'font-size': FS, class: 's-monot', style: 'fill:var(--thread);font-weight:700' }, ids));  // the ids of the threads currently in that state
          });  // ends the loop over states
          dsvg.replaceChildren(...kids);  // swaps the old diagram for the new one
        }  // ends drawDiag()

        /* ---- thread table + CPU strip ---- */
        const table = h('table', { class: 'tbl compact thtbl' });  // the thread table: one row per thread with its process, priority, state and where its registers are
        const NS = ctx.narrow ? 5 : 10;  // NS is how many time slots the CPU strip shows: 5 on a phone, 10 on a wide screen
        const strip = s('svg', { viewBox: `0 0 ${NS * 63 + 10} 68`, width: '100%', role: 'img', 'aria-label': 'Which thread held the processor after each event' });  // the CPU strip: a row of boxes showing which thread held the processor after each event
        const CH = { Running: 'ok', Ready: 'accent', Blocked: 'intr', Done: '' };  // CH: the chip color for each thread state, matching the state diagram
        const CTX = { Running: 'in the CPU registers', Ready: 'saved in its TCB', Blocked: 'saved in its TCB', Done: 'freed' };  // CTX: where a thread's register context is in each state, shown in the last table column
        let manual = false, mevs = [];  // manual is true in "You drive" mode; mevs is the list of events the student has triggered there
        function drawTable(S) {  // drawTable(S): rebuilds the thread table from the state
          table.replaceChildren(h('thead', {}, h('tr', {}, ...['Thread', 'Process', 'Priority', 'State', 'Register context'].map((x, k) => h('th', { class: k === 2 || k === 4 ? 'wide' : '' }, x)))),  // the header row; the Priority and Register context columns are marked "wide" so small screens can hide them
            h('tbody', {}, ...S.th.map((t) => h('tr', { class: t.st === 'Running' ? 'on' : '' },  // one body row per thread; the running thread's row is highlighted
              h('td', { class: 'b', style: { color: 'var(--thread)' } }, t.id), h('td', {}, t.p), h('td', { class: 'wide' }, t.pr > 1 ? 'high' : 'normal'),  // the thread's id in the thread color, its process, and its priority shown as high or normal
              h('td', {}, h('span', { class: 'chip ' + CH[t.st] }, t.st), manual && t.st === 'Blocked' ? h('button', { type: 'button', class: 'btn sm', style: { marginLeft: '6px' }, onclick: () => act({ type: 'unblock', id: t.id }) }, 'Unblock') : null),  // the state as a colored chip; in "You drive" mode a Blocked thread also gets an Unblock button
              h('td', { class: 'wide small' + (t.st === 'Done' ? ' muted' : '') }, CTX[t.st])))));  // where the thread's registers are right now, greyed out once it is done
        }  // ends drawTable()
        function drawStrip(S) {  // drawStrip(S): redraws the CPU strip showing the most recent time slots
          const slots = S.hist.concat([{ id: S.run, p: S.run ? T(S, S.run).p : null, now: true }]).slice(-NS);  // the history of who ran, plus a dashed "now" slot for the current runner, trimmed to the last NS slots
          const kids = [];  // kids collects every shape in the strip
          slots.forEach((sl, k) => {  // draws each time slot
            const x = 4 + k * 63;  // the left edge of this slot's box
            kids.push(s('rect', { x, y: 12, width: 60, height: 50, rx: 8, class: sl.id ? 's-thread' : 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': sl.now ? '5 3' : null }),  // the slot's box: pink when a thread ran, plain when idle; the "now" slot has a dashed border
              s('text', { x: x + 30, y: 36, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, sl.id || 'idle'),  // the thread id in the slot, or "idle"
              s('text', { x: x + 30, y: 54, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, sl.now ? 'now' : sl.p || ''));  // under it, "now" for the current slot or the process the thread belongs to
            const pv = slots.slice(0, k).reverse().find((q) => q.id);  // pv is the most recent earlier slot in which some thread ran
            if (pv && sl.id && pv.id !== sl.id) {  // when a different thread took over from that one, a badge marks the kind of switch
              const same = pv.p === sl.p;  // same is true when both threads belong to one process
              kids.push(s('circle', { cx: x - 1.5, cy: 12, r: 9, class: same ? 's-ok' : 's-warn', 'stroke-width': 1.5 }),  // a small circle between the slots: green for a thread switch, orange for a process switch
                s('text', { x: x - 1.5, y: 16.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: `fill:var(--${same ? 'ok' : 'warn'})` }, same ? 'T' : 'P'));  // the badge letter: T for a cheap thread switch, P for a costly process switch
            }  // ends the switch badge
          });  // ends the loop over slots
          strip.replaceChildren(...kids);  // swaps the old strip for the new one
        }  // ends drawStrip()
        function paint(S) { drawDiag(S); drawTable(S); drawStrip(S); }  // paint(S): redraws the diagram, the table and the CPU strip together from one state

        /* ---- guided tour ---- */
        const SCRIPT = [  // SCRIPT: the guided tour, one entry per frame as [event to apply, caption]
          [null, '<b>Start.</b> One processor. Process P1 has thread A (high priority); process P2 has thread C. A is Running; C is Ready and waiting its turn.'],  // frame 1: the starting situation, with no event yet
          [{ type: 'spawn', id: 'B', p: 'P1' }, '<b>Spawn.</b> A creates a new thread B inside P1. The OS gives B its own TCB, register context and stacks and puts it on the ready list. A keeps running.'],  // frame 2: A spawns B inside P1
          [{ type: 'block' }, '<b>Block.</b> A asks to read from the disk and must wait, so it becomes Blocked with its registers saved. The <span class="t">dispatcher</span> picks C, which has waited longest. C is in P2, so this is a <b>process switch</b> (orange P).'],  // frame 3: A blocks for the disk, and C runs, which is a process switch
          [{ type: 'quantum' }, '<b>Time quantum expires.</b> C has used its <span class="t">time quantum</span>, so it goes back to Ready and B runs: another process switch, back to P1.'],  // frame 4: C's quantum expires and B runs, another process switch
          [{ type: 'unblock', id: 'A' }, '<b>Unblock + preemption.</b> The disk read is done, so A is Ready. A has higher priority than the running B, so B is preempted (<span class="t">preemption</span>) and A runs. A and B share P1: a cheap <b>thread switch</b> (green T).'],  // frame 5: A is unblocked and preempts B, a cheap thread switch inside P1
          [{ type: 'finish' }, '<b>Finish.</b> A completes and its context and stacks are freed. C has waited longest, so C runs: a process switch to P2.'],  // frame 6: A finishes and C runs
          [{ type: 'block' }, '<b>Block.</b> C sends a network request and waits for the reply. B runs, back in P1.'],  // frame 7: C blocks for the network and B runs
          [{ type: 'finish' }, '<b>Finish.</b> B completes. The only thread left, C, is Blocked, so the processor is <b>idle</b>.'],  // frame 8: B finishes and, with C blocked, the processor is idle
          [{ type: 'unblock', id: 'C' }, '<b>Unblock.</b> The network reply arrives. C becomes Ready and, with the processor idle, is dispatched at once.'],  // frame 9: C is unblocked and dispatched at once
          [{ type: 'finish' }, '<b>Finish.</b> C completes and the processor goes idle. Now read the CPU strip: threads of two processes were <span class="t" data-t="Interleaving">interleaved</span> on one processor. Switches happened because a thread blocked, a quantum expired, a higher-priority thread became ready, or a thread finished.'],  // frame 10: C finishes; the caption sums up why switches happen and points to the CPU strip
        ];  // closes the SCRIPT list
        const cap = h('div', { class: 'player-cap s7-cap' });  // the tour's caption box, placed above the player controls
        const player = ctx.ui.player({ count: SCRIPT.length, interval: 2600, caption: false, render(i) {  // the play/step controls for the tour (the guide's player helper); its own caption is turned off
          const S = replay(SCRIPT.slice(1, i + 1).map((x) => x[0]));  // for frame i, rebuilds the state by applying the first i events of the script
          if (!manual) { paint(S); cap.innerHTML = SCRIPT[i][1]; }  // in tour mode, redraws everything and shows the frame's caption
          return null;  // returns nothing, so the player leaves its own (hidden) caption alone
        } });  // ends the player settings

        /* ---- you drive ---- */
        const say = h('div', { class: 'player-cap s7-cap' });  // the explanation box for "You drive" mode
        const bar = h('div', { class: 'row', style: { gap: '6px' } });  // the row of event buttons for "You drive" mode
        function act(ev) {  // act(ev): adds one event chosen by the student and redraws
          if (ev.type === 'spawn') { const S0 = replay(mevs), used = S0.th.map((t) => t.id); ev.id = 'BDEFG'.split('').find((n) => !used.includes(n)); ev.p = T(S0, S0.run).p; }  // a spawn gets the first unused name from B, D, E, F, G and joins the running thread's process
          mevs.push(ev); drive();  // records the event and redraws
        }  // ends act()
        function drive() {  // drive(): replays the student's events, redraws, and rebuilds the event buttons
          const S = replay(mevs); paint(S);  // rebuilds the state from all the student's events and redraws
          say.innerHTML = mevs.length ? S.say : 'You are the event source. The dispatcher follows two rules: <b>higher priority first</b>, then <b>longest-waiting first</b>. Only the running thread can spawn, and its new sibling lands in its own process. Try blocking A, then unblocking it.';  // shows the latest explanation, or the rules of the game before the first event
          const run = !!S.run, full = S.th.length >= 6;  // run is true while some thread is running; full stops spawning once there are 6 threads
          const B = (label, cls, ev, ok) => h('button', { type: 'button', class: 'btn sm ' + cls, disabled: !ok, onclick: () => act(Object.assign({}, ev)) }, label);  // B(): builds one event button, disabled when the event is not possible right now
          bar.replaceChildren(B(run ? `${S.run} spawns a thread` : 'Spawn (needs a running thread)', 'thread', { type: 'spawn' }, run && !full),  // the Spawn button, labelled with the running thread's name
            B('Block (I/O)', 'intr', { type: 'block' }, run), B('Quantum expires', '', { type: 'quantum' }, run), B('Finish', '', { type: 'finish' }, run),  // the Block, Quantum expires and Finish buttons, all needing a running thread
            h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { mevs = []; drive(); } }, 'Reset'));  // the Reset button clears the student's events
        }  // ends drive()
        const guided = h('div', { class: 'stack', style: { gap: '8px' } }, cap, player.el,  // the tour panel: caption, player controls and a hint
          h('p', { class: 'small muted m0', html: '<b>Then try it yourself:</b> switch to <b>You drive</b>, block A, let the running thread spawn a sibling, then unblock A. Watch which switches are cheap (T) and which are costly (P).' }));  // hint: switch to You drive and try blocking, spawning and unblocking
        const driving = h('div', { class: 'stack', style: { gap: '8px', display: 'none' } }, say, bar);  // the "You drive" panel, hidden at first
        const seg = ctx.ui.seg([{ value: 'tour', label: 'Guided tour' }, { value: 'drive', label: 'You drive' }], 'tour', (v) => {  // the Guided tour / You drive switch
          manual = v === 'drive'; guided.style.display = manual ? 'none' : ''; driving.style.display = manual ? '' : 'none';  // shows one panel and hides the other
          if (manual) drive(); else { player.stop(); player.refresh(); }  // entering You drive starts from the student's events; going back stops the tour and redraws its current frame
        });  // ends the switch
        host.append(  // builds the right-hand card
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0', html: 'One <span class="t">uniprocessor</span>, two processes' }), seg),  // top row: the heading and the mode switch
          table,  // then the thread table
          h('div', {}, h('div', { class: 'xs muted b', html: 'WHO HELD THE PROCESSOR AFTER EACH EVENT · <span style="white-space:nowrap"><span style="color:var(--ok)">T</span> = thread switch in one process (cheap)</span> · <span style="white-space:nowrap"><span style="color:var(--warn)">P</span> = process switch (costly)</span>' }), strip),  // then the CPU strip with its legend explaining T and P
          guided, driving);  // then the two mode panels
        player.refresh();  // draws the tour's first frame when the step opens
      },  // ends render() for step 7
    },  // ends step 7
    /* ---------------- 8. RPC: one thread vs two threads ---------------- */
    {  // step 8 begins: an RPC timeline that compares one thread with two threads
      title: 'Waiting on two servers: one thread or two?',  // the step title shown at the top of the page
      kind: 'compare',  // the kind of step (compare), shown as a label above the title
      render(el, ctx) {  // render(el, ctx): builds the whole page in code, since this step has no fixed HTML
        const { h, s } = ctx;  // takes the HTML and SVG element builders from the toolbox
        let a = 5, b = 5, P;  // a and b are the reply delays of servers A and B in ms; P holds the computed timelines
        const lead = h('p', { class: 'm0', html: 'A <span class="t">remote procedure call</span> (RPC) runs a procedure on another computer; the caller is <b>blocked</b> until the reply arrives. Each send or reply-handling here takes 1 ms of processor time on a <span class="t">uniprocessor</span>. <b>Predict:</b> type the two-thread finish time in the box, then press Play.' });  // intro paragraph: what an RPC is, the 1 ms cost of each send or reply, and the prediction task
        function build() {  // build(): works out both timelines from the current delays a and b
          const S = [[0, 1, 'run', 'send A'], [1, 1 + a, 'wait', 'A'], [1 + a, 2 + a, 'run', 'handle A'], [2 + a, 3 + a, 'run', 'send B'], [3 + a, 3 + a + b, 'wait', 'B'], [3 + a + b, 4 + a + b, 'run', 'handle B']];  // one thread: send A, wait for A, handle A, then send B, wait for B, handle B, each as [start, end, kind, label]
          const rA = 1 + a, rB = 2 + b;  // rA and rB are when the replies from A and B arrive in the two-thread version
          const M1 = [[0, 1, 'run', 'send A'], [1, rA, 'wait', 'A']], M2 = [[0, 1, 'ready', ''], [1, 2, 'run', 'send B'], [2, rB, 'wait', 'B']];  // two threads: thread 1 sends A and waits; thread 2 is ready, then sends B and waits
          let s1, s2;  // s1 and s2 will hold when each thread starts handling its reply
          if (rA <= rB) { s1 = rA; s2 = Math.max(rB, s1 + 1); } else { s2 = rB; s1 = Math.max(rA, s2 + 1); }  // the reply that arrives first is handled first; the other thread must wait until the processor is free again
          if (s1 > rA) M1.push([rA, s1, 'ready', '']);  // if T1 had to wait for the processor after its reply came, a "ready" stretch is added to its row
          if (s2 > rB) M2.push([rB, s2, 'ready', '']);  // the same for T2
          M1.push([s1, s1 + 1, 'run', 'handle A']); M2.push([s2, s2 + 1, 'run', 'handle B']);  // each thread then spends 1 ms handling its reply
          return { S, M1, M2, sT: 4 + a + b, mT: Math.max(s1, s2) + 1, e1: s1 + 1, e2: s2 + 1 };  // returns both timelines plus the finish times: one thread (sT), two threads (mT), and each thread's own end
        }  // ends build()
        const NW = ctx.narrow, W = NW ? 400 : 1110;  // NW is true on a phone-width screen; W is the drawing's width in SVG units
        const svg = s('svg', { viewBox: `0 0 ${W} 222`, width: '100%', role: 'img', 'aria-label': 'Timeline of one thread versus two threads making two remote calls' });  // the timeline drawing
        const X0 = NW ? 34 : 120, XW = W - X0 - (NW ? 6 : 30);  // X0 is where the time axis starts (after the row labels) and XW is how wide it is
        function row(y, segs, t, u, end, label) {  // row(): draws one thread's timeline up to time t, with u pixels per ms, and a finish mark once t reaches end
          const out = [s('text', { x: NW ? 2 : 8, y: y + 25, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--thread)' }, label),  // the row's label (T1 or T2) at the left
            s('rect', { x: X0, y, width: XW, height: 40, rx: 6, class: 's-panel', 'stroke-width': 1, 'fill-opacity': 0.5 })];  // a faint background bar for the whole row
          segs.forEach(([t0, t1, kind, lab]) => {  // draws each stretch of the timeline
            if (t0 >= t) return;  // skips stretches that have not started yet at time t
            const x = X0 + t0 * u, w = (Math.min(t1, t) - t0) * u;  // where the stretch starts and how wide it is so far, cut off at time t
            const cls = kind === 'run' ? 's-thread' : kind === 'wait' ? 's-panel' : 's-warn';  // color by kind: pink for running, plain for blocked, orange for ready but waiting
            out.push(s('rect', { x: x + 1, y: y + 2, width: Math.max(0, w - 2), height: 36, rx: 5, class: cls, 'stroke-width': 1.5, 'stroke-dasharray': kind === 'wait' ? '5 3' : null }));  // the stretch's bar; blocked stretches get a dashed border
            const txt = kind === 'wait' ? 'blocked: waiting for ' + lab : kind === 'ready' ? 'ready' : lab;  // the text for the bar: "blocked: waiting for A", "ready", or the action name
            if (w > txt.length * 6.6 + 6) out.push(s('text', { x: x + w / 2, y: y + 25, 'text-anchor': 'middle', 'font-size': 13, class: kind === 'wait' ? 's-sub' : '' }, txt));  // draws the text only if the bar is wide enough to hold it
          });  // ends the loop over stretches
          if (t >= end) out.push(s('text', { x: X0 + end * u + 8, y: y + 25, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--ok)' }, '✓ ' + end + ' ms'));  // once the row is finished, a green tick and its finish time appear after the last bar
          return out;  // hands back the row's shapes
        }  // ends row()
        function draw(t) {  // draw(t): redraws the whole timeline as it stands at time t ms; runs on every player step
          const u = XW / (P.sT + (NW ? 2.8 : 1.6));  // u is pixels per ms, leaving a little room at the right for the finish label
          const kids = [  // kids collects every shape in the drawing
            s('text', { x: 2, y: 14, 'font-size': 12.5, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, NW ? 'ONE THREAD' : 'ONE THREAD: CALLS ONE AFTER THE OTHER'),  // heading for the one-thread row (shorter on a phone)
            ...row(22, P.S, t, u, P.sT, 'T1'),  // the one-thread row
            s('text', { x: 2, y: 88, 'font-size': 12.5, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, NW ? 'TWO THREADS, ONE PROCESSOR' : 'TWO THREADS: ONE PER SERVER (SAME ONE PROCESSOR)'),  // heading for the two-thread rows (shorter on a phone)
            ...row(96, P.M1, t, u, P.e1, 'T1'), ...row(142, P.M2, t, u, P.e2, 'T2'),  // the two rows for T1 and T2 in the two-thread version
          ];  // ends the starting list of shapes
          for (let k = 0; k <= P.sT; k += NW ? (P.sT > 12 ? 4 : 2) : (P.sT > 14 ? 2 : 1)) kids.push(s('line', { x1: X0 + k * u, y1: 188, x2: X0 + k * u, y2: 194, class: 's-line', 'stroke-width': 1 }), s('text', { x: X0 + k * u, y: 212, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(k)));  // tick marks and numbers along the time axis, spaced 1, 2 or 4 ms apart so they do not crowd
          if (!NW) kids.push(s('text', { x: 8, y: 212, 'font-size': 12.5, class: 's-sub' }, 'time (ms)'));  // on a wide screen, labels the axis "time (ms)"
          [[18, 66], [92, 186]].forEach(([y1, y2]) => kids.push(s('line', { x1: X0 + t * u, y1, x2: X0 + t * u, y2, style: 'stroke:var(--chc)', 'stroke-width': 2.5 })));  // a vertical line in the accent color marks the current time across both groups of rows
          svg.replaceChildren(...kids);  // swaps the old drawing for the new one
        }  // ends draw()
        const where = (segs, t, end) => {  // where(): describes what one thread is doing at time t, for the caption
          if (t >= end) return '<b>done</b>';  // after its finish time the thread is done
          const g = segs.find((x) => t >= x[0] && t < x[1]);  // finds the stretch that covers time t
          return g[2] === 'run' ? `<b>running</b> (${g[3]})` : g[2] === 'wait' ? `<b>blocked</b>, waiting for Server ${g[3]}` : '<b>ready</b>, waiting for the processor';  // says running (and what), blocked (and for which server), or ready and waiting for the processor
        };  // ends where()
        function caption(t) {  // caption(t): the text under the timeline for time t
          if (t === 0) return '<b>t = 0.</b> One thread: T1 sends its request to Server A. Two threads: T1 sends to A while T2 is ready but waits, because one processor runs one thread at a time.';  // at the start: both versions send to A first, and T2 must wait because there is one processor
          if (t >= P.sT) return `<b>Done.</b> One thread: <b>${P.sT} ms</b> (4 ms of processing + ${a} + ${b}: the waits come in series). Two threads: <b>${P.mT} ms</b>, because the waits overlap: ${ctx.util.fmt(P.sT / P.mT, 2)}× faster on one processor.` + (gVal() == null ? '' : gVal() === P.mT ? ' Your prediction was spot on.' : ` You said ${gVal()} ms. Trace: sends at 0–1 and 1–2, replies at ${1 + a} and ${2 + b} ms, each handled for 1 ms one at a time → done at ${P.mT} ms.`);  // at the end: compares both totals, and checks the student's prediction with a trace if it was wrong
          const bothWait = P.M1.concat(P.M2).filter((g) => g[2] === 'wait' && t >= g[0] && t < g[1]).length === 2;  // bothWait is true when both threads are blocked at the same moment, which is where time is saved
          return `<b>t = ${t} ms.</b> One thread: T1 ${where(P.S, t, P.sT)}. Two threads: T1 ${where(P.M1, t, P.e1)}; T2 ${where(P.M2, t, P.e2)}.` + (bothWait ? ' <b>Both waits overlap:</b> this is where the time is saved.' : '') + (t === P.mT ? ' <b>The two-thread version has finished.</b>' : '');  // the step caption: what each thread is doing, plus notes when the waits overlap or the two-thread run finishes
        }  // ends caption()
        const c1 = h('span', { class: 'chip thread' });  // the one-thread total chip
        // the student types a prediction for the two-thread time; it is checked when that run finishes
        const guess = h('input', { type: 'number', min: 1, max: 30, step: 1, placeholder: '?', class: 's8-guess', 'aria-label': 'Your prediction for the two-thread finish time, in ms' });  // the number box where the student types a prediction for the two-thread total
        const gRes = h('span');  // shows " ms" while playing, then the real result and whether the guess was right
        const c2 = h('span', { class: 'chip thread' }, 'Two threads: ', guess, gRes);  // the two-thread total chip, holding the prediction box and its result
        const gVal = () => { const g = parseInt(guess.value, 10); return Number.isFinite(g) ? g : null; };  // gVal(): reads the student's prediction as a whole number, or null if the box is empty
        function totals(t) {  // totals(t): updates the two total chips for time t
          const end = t >= P.sT, done2 = t >= P.mT, g = gVal();  // end: one thread finished; done2: two threads finished; g: the student's guess
          c1.textContent = 'One thread: ' + (end ? P.sT + ' ms' : '? ms');  // the one-thread chip shows its total once that run is finished, "? ms" before
          guess.style.display = done2 ? 'none' : '';  // hides the prediction box once the two-thread run finishes
          gRes.textContent = !done2 ? ' ms' : P.mT + ' ms' + (g == null ? '' : g === P.mT ? ' ✓ your guess' : ` (you said ${g})`);  // after the finish, shows the real total and says whether the guess matched
          c1.className = 'chip ' + (end ? 'warn' : 'thread'); c2.className = 'chip ' + (done2 ? (g == null || g === P.mT ? 'ok' : 'warn') : 'thread');  // colors the chips: orange for the slower one-thread total; green or orange for the guess
        }  // ends totals()
        let player;  // player will hold the play/step controls
        function rebuild() { P = build(); if (player) { player.stop(); player.setCount(P.sT + 1); } }  // rebuild(): recomputes the timelines after a slider moves and resets the player to the new length
        const sa = ctx.ui.slider({ label: 'Server A reply', min: 2, max: 8, value: a, format: (v) => v + ' ms', onInput: (v) => { a = v; rebuild(); } });  // slider for server A's reply time (2-8 ms)
        const sb = ctx.ui.slider({ label: 'Server B reply', min: 2, max: 8, value: b, format: (v) => v + ' ms', onInput: (v) => { b = v; rebuild(); } });  // slider for server B's reply time (2-8 ms)
        P = build();  // computes the timelines for the starting delays
        player = ctx.ui.player({ count: P.sT + 1, interval: 700, render(i) { draw(i); totals(i); return caption(i); } });  // the player: one step per ms; each step redraws the timeline, updates the totals and sets the caption
        player.caption.classList.add('s8-cap');  // gives the player's caption the steady minimum height
        guess.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); player.reset(); player.play(); } }); // Enter = lock in the guess and play
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } }, lead,  // builds the page: the intro paragraph first
          h('div', { class: 'rpc-ctl' }, sa, sb, h('div', { class: 'tot' }, c1, c2)),  // then the control row: two sliders and the two total chips
          h('div', { class: 'card white tight' }, svg, h('div', { class: 'row xs muted', style: { gap: '14px', marginTop: '2px' }, html: '<span><span class="chip thread">\u00a0</span> running on the processor</span><span><span class="chip" style="border:1.5px dashed var(--line-2)">\u00a0</span> blocked, waiting for a reply</span><span><span class="chip warn">\u00a0</span> ready, waiting for the processor</span>' })), player.el));  // then the timeline card with a color key (running, blocked, ready), and the player controls below
      },  // ends render() for step 8
    },  // ends step 8
    /* ---------------- 9. Why threads must synchronize ---------------- */
    {  // step 9 begins: a lab where the student plays the scheduler and causes a lost update
      title: 'Why threads must synchronize: you pick the order',  // the step title shown at the top of the page
      kind: 'lab',  // the kind of step (lab), shown as a label above the title
      html: `${/* html: the fixed page content for step 9 */''}
        <div class="split l fill">${/* two-column layout: explanation and code on the left, the lab on the right */''}
          <div class="stack">${/* the left column stacks its blocks with even spacing */''}
            <p class="lead m0">Threads share global data with no wall between them. That makes sharing fast, and it also makes it dangerous.</p>${/* opening paragraph: sharing is fast but dangerous */''}
            <p class="m0">The line <code>count = count + 1</code> looks like one action, but the processor carries it out as three machine steps. The scheduler may switch threads between <b>any</b> two of them.</p>${/* paragraph: count = count + 1 is really three machine steps, and a switch can fall between any two */''}
            <div class="s9-code"></div>${/* empty box where render() places the three-line code listing */''}
            <div class="callout why sm m0" data-label="Why it matters">Each thread’s register <code>r</code> is part of its own saved context. A thread switched out between LOAD and STORE carries a stale private copy. Bigger shared structures suffer the same way: two threads adding to one list at once can lose an item or break its links.</div>${/* why box: each thread's register is private, so a thread switched out mid-update holds a stale copy */''}
            <div class="callout warn sm m0" data-label="Common mistake">“It is one line of code, so it cannot be interrupted.” A single source line can be several machine steps, and a switch can fall between them.</div>${/* common-mistake box: one source line is not one uninterruptible action */''}
          </div>${/* ends the left column */''}
          <div class="card white stack s9-host" style="gap:9px"></div>${/* the empty card on the right where render() builds the lab */''}
        </div>`,  // ends the layout and the HTML text
      render(el, ctx) {  // render(el, ctx): builds the scheduler lab when step 9 is shown
        const { h } = ctx;  // takes the HTML element builder from the toolbox
        const host = ctx.$('.s9-host');  // host is the right-hand card
        const code = ctx.ui.code(ctx.narrow // phones: too narrow for side comments, so shorten them
          ? 'r = count;   // LOAD\nr = r + 1;   // ADD (private)\ncount = r;   // STORE'  // the phone version of the listing, with short side comments
          : `r = count;     // LOAD: copy shared count into r${/* shown code, line 1: LOAD copies the shared count into the private register r */''}
r = r + 1;     // ADD: change only the copy in r${/* shown code, line 2: ADD changes only the copy in r */''}
count = r;     // STORE: write r back to count`, { lang: 'c', nums: true, fontSize: 14 });  // shown code, line 3: STORE writes r back to count; then line numbers are turned on and the font size set
        ctx.$('.s9-code').append(code);  // places the listing in its box on the left
        const OPS = ['LOAD', 'ADD', 'STORE'], LINES = ['r = count', 'r = r + 1', 'count = r'];  // OPS names the three machine steps; LINES is their text as shown on the thread cards
        let st, mode = 'free', tok = 0;  // st is the lab state; mode is "free" (no coordination) or "lock"; tok cancels an automatic run that is out of date
        const fresh = () => { st = { pc: [0, 0], r: [null, null], base: [null, null], count: 10, lock: null, blocked: [false, false], trace: [], last: null }; };  // fresh(): the starting state: both threads before step 1, empty registers, count 10, lock free, no trace
        const big = h('div', { class: 'big' }), lockChip = h('span', { class: 'chip' });  // big shows the shared count in the memory strip; lockChip shows who holds the lock
        const say = h('div', { class: 'info s9-say' }), trace = h('div', { class: 's9-trace' });  // the explanation box, and the "order run" row of chips that records every step
        const cards = [0, 1].map((t) => {  // cards: builds one card for each of the two threads
          const tag = h('span', { class: 'chip' }), lines = LINES.map((x) => h('div', { class: 's9-ln' }, x)), reg = h('div', { class: 's9-reg' });  // each card has a status chip, its three step lines and a line showing its private register
          const btn = h('button', { type: 'button', class: 'btn sm thread', onclick: () => { tok++; step(t); paint(); } }, `Run T${t + 1}’s next step`);  // the card's button runs that thread's next machine step; tok++ first cancels any automatic run
          return { el: h('div', { class: 'card thread tight s9-th' }, h('h4', {}, 'Thread T' + (t + 1), tag), ...lines, reg, btn), tag, lines, reg, btn };  // assembles the card and keeps handles on its parts so paint() can update them
        });  // closes the map that builds the two cards
        function step(t) {  // step(t): runs the next machine step of thread t (0 or 1) and explains what happened
          const o = 1 - t, T = `T${t + 1}`, O = `T${o + 1}`;  // o is the other thread; T and O are their display names
          if (st.pc[t] >= 3) return;  // a thread that has finished all three steps does nothing
          if (mode === 'lock' && st.pc[t] === 0 && st.lock === o) {  // in lock mode, a thread cannot start its LOAD while the other thread holds the lock
            if (!st.blocked[t]) st.trace.push([`${T} waits`, 'warn']);  // records the wait in the order-run row the first time it happens
            st.blocked[t] = true;  // marks the thread as Blocked
            say.innerHTML = `<b>${T} tries to start, but ${O} holds the lock.</b> ${T} is Blocked until ${O} finishes its STORE and releases it. Run ${O}.`;  // explains that it must wait for the other thread to finish and release the lock
            return;  // stops here without running any step
          }  // ends the lock check
          const pc = st.pc[t]; st.blocked[t] = false; st.last = pc + 1;  // pc is which step comes next (0, 1 or 2); the thread is no longer blocked; last is the code line to highlight
          if (pc === 0) {  // step 1, LOAD
            if (mode === 'lock') st.lock = t;  // in lock mode, the thread takes the lock as it starts
            st.r[t] = st.count; st.base[t] = st.count; st.trace.push([`${T} LOAD r=${st.count}`, 'thread']);  // copies the shared count into the thread's register, remembers the value it started from, and records the step
            say.innerHTML = (st.pc[o] === 1 || st.pc[o] === 2)  // if the other thread is mid-update, warns that both now hold the same old value
              ? `<b>${T} loads count (${st.count}) into its register.</b> But ${O} already holds a copy of that same value and has not stored its result yet. Both threads are now working from the same old number: trouble ahead.`  // explanation for that dangerous case
              : `<b>${T} loads the shared count (${st.count}) into its own register r.</b> The shared count itself does not change.` + (mode === 'lock' ? ` ${T} took the lock first, so ${O} cannot start until ${T} is finished.` : '');  // otherwise explains that loading does not change count, and mentions the lock in lock mode
          } else if (pc === 1) {  // step 2, ADD
            st.r[t] += 1; st.trace.push([`${T} ADD r=${st.r[t]}`, 'thread']);  // adds 1 inside the thread's own register and records the step
            say.innerHTML = `<b>${T} adds 1 inside its register: r = ${st.r[t]}.</b> The shared count is still ${st.count}; the new value exists only in ${T}’s private context.`;  // explains that the shared count has not changed yet
          } else {  // step 3, STORE
            const old = st.count, lost = old !== st.base[t];  // lost is true when count changed since this thread loaded it, so storing will overwrite the other thread's work
            st.count = st.r[t]; st.trace.push([`${T} STORE count=${st.r[t]}`, lost ? 'bad' : 'ok']);  // writes the register back into count; the chip is red when an update is lost, green otherwise
            if (mode === 'lock') { st.lock = null; st.blocked[o] = false; }  // in lock mode, releases the lock and lets the other thread start
            say.innerHTML = lost  // explains the store: a lost update in red, or a normal store
              ? `<b style="color:var(--bad)">${T} stores ${st.r[t]}.</b> Count already held ${old} from ${O}, but ${T}’s ${st.r[t]} was computed from the old ${st.base[t]}. ${O}’s increment has just been wiped out: a <span class="t">lost update</span>.`  // explanation when an update is lost
              : `<b>${T} stores ${st.r[t]} back into count.</b>` + (mode === 'lock' ? ` It releases the lock, so ${O} is no longer blocked and may start.` : '');  // explanation for a normal store, noting the lock release in lock mode
          }  // ends the three-step choice
          st.pc[t]++;  // moves the thread on to its next step
          if (st.pc[0] === 3 && st.pc[1] === 3) {  // once both threads have finished all three steps, sums up the result
            say.innerHTML = st.count === 12  // count 12 means both increments counted
              ? (mode === 'lock'  // in lock mode the success message differs from the unlocked one
                ? '<b style="color:var(--ok)">count = 12, whatever order you pick.</b> The lock let only one thread at a time inside its LOAD-ADD-STORE sequence, so no interleaving can lose an update. Building such tools correctly is the subject of Chapter 5.'  // with a lock, 12 is guaranteed in any order
                : '<b style="color:var(--ok)">count = 12: both increments counted.</b> This order was safe because one thread stored its result before the other loaded. Nothing in the code forces that order, though: it was luck.')  // without a lock, 12 happened only because of a lucky order
              : `<b style="color:var(--bad)">count = ${st.count}: a lost update.</b> Two increments ran, yet count rose by only 1. The result depended on the order the scheduler happened to choose: a <span class="t">race condition</span>. On one processor it happens when a quantum expires between LOAD and STORE; on several processors the threads can even collide at the same instant.`;  // any other count is a lost update caused by a race condition
          }  // ends the final summary
        }  // ends step()
        function paint() {  // paint(): updates every part of the lab from the current state; runs after every step
          const fin = st.pc[0] === 3 && st.pc[1] === 3;  // fin is true once both threads have finished
          big.textContent = st.count; big.style.color = !fin ? '' : st.count === 12 ? 'var(--ok)' : 'var(--bad)';  // shows count; when finished it turns green for 12 or red for anything else
          lockChip.className = 'chip ' + (mode !== 'lock' ? '' : st.lock === null ? 'ok' : 'warn');  // colors the lock chip: plain without a lock, green when free, orange when held
          lockChip.textContent = mode !== 'lock' ? 'no lock: anyone may start' : st.lock === null ? 'lock: free' : `lock: held by T${st.lock + 1}`;  // the lock chip's text
          cards.forEach((c, t) => {  // updates each thread card
            const pc = st.pc[t];  // pc is that thread's next step
            c.tag.className = 'chip ' + (pc === 3 ? 'ok' : st.blocked[t] ? 'warn' : pc ? 'thread' : '');  // colors the status chip: green done, orange blocked, pink mid-update, plain not started
            c.tag.textContent = pc === 3 ? 'done' : st.blocked[t] ? 'Blocked' : pc ? 'mid-update' : 'not started';  // the status chip's text
            c.lines.forEach((ln, k) => { ln.classList.toggle('cur', k === pc); ln.classList.toggle('did', k < pc); ln.textContent = (k < pc ? '✓ ' : '') + LINES[k]; });  // highlights the next line, greys out finished lines and puts a tick in front of them
            c.reg.innerHTML = `register r = <code>${st.r[t] == null ? '—' : st.r[t]}</code> <span class="muted small">(private)</span>`;  // shows the thread's private register, or a dash before it has loaded
            c.btn.disabled = pc === 3;  // disables the thread's button once it has finished
          });  // ends the loop over cards
          trace.replaceChildren(h('span', { class: 'xs muted b' }, 'ORDER RUN:'), ...(st.trace.length ? st.trace.map(([x, c]) => h('span', { class: 'chip ' + c }, x)) : [h('span', { class: 'xs muted' }, 'nothing yet')]));  // rebuilds the order-run row: a label, then one chip per step taken (or "nothing yet")
          code.clear(); if (st.last) code.mark([st.last]);  // highlights the line of the code listing that was just run
        }  // ends paint()
        async function auto(pattern) {  // auto(pattern): lets the program play scheduler, following a pattern of thread choices, one step every 0.56 s
          const my = ++tok; fresh(); say.innerHTML = 'Watching the scheduler run one order…'; paint();  // starts a new run (cancelling any older one), resets the lab and says it is watching
          let k = 0, guard = 0;  // k walks through the pattern; guard stops the loop after 14 rounds in case something goes wrong
          while (!(st.pc[0] === 3 && st.pc[1] === 3) && guard++ < 14) {  // keeps going until both threads are finished
            await ctx.sleep(560); if (!ctx.alive || my !== tok) return;  // waits between steps; stops if the student left the page or started something else
            let t = pattern[k++ % pattern.length]; if (st.pc[t] === 3 || st.blocked[t]) t = 1 - t; // a finished or Blocked thread is never dispatched
            step(t); paint();  // runs the chosen thread's step and updates the display
          }  // ends the loop
        }  // ends auto()
        const START = 'You are the scheduler. Both threads will run <code>count = count + 1</code> once, starting from 10, so the right answer is 12. Click the threads in any order you like, or try a preset.';  // START: the opening instructions: you are the scheduler, and the right answer is 12
        const reset = () => { tok++; fresh(); say.innerHTML = START; paint(); };  // reset(): cancels any automatic run and starts the lab over
        const seg = ctx.ui.seg([{ value: 'free', label: 'No coordination' }, { value: 'lock', label: 'With a lock' }], mode, (v) => { mode = v; reset(); if (v === 'lock') say.innerHTML = 'Now a thread must take a <b>lock</b> before its LOAD and gives it back after its STORE. While one thread holds it, the other cannot start. Try the unlucky order again.'; });  // the No coordination / With a lock switch; switching resets the lab and explains the lock rule
        host.append(  // builds the right-hand card
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'You are the scheduler'), seg),  // top row: the heading and the mode switch
          h('div', { class: 'card mem tight s9-mem' }, h('div', {}, h('div', { class: 'b' }, 'count'), h('div', { class: 'xs muted' }, 'shared global data, one copy')), big, h('div', { class: 'grow' }), lockChip),  // the shared-memory strip: the label, the big count and the lock chip
          h('div', { class: 'grid-2' }, cards[0].el, cards[1].el),  // the two thread cards side by side
          trace, say,  // then the order-run row and the explanation box
          h('div', { class: 'row', style: { gap: '6px' } },  // a row of preset buttons
            h('button', { type: 'button', class: 'btn sm intr', onclick: () => auto([0, 1]) }, 'Unlucky order'),  // preset: strict alternation T1, T2, T1, T2..., which loses an update
            h('button', { type: 'button', class: 'btn sm', style: { borderColor: 'var(--ok)', color: 'var(--ok)' }, onclick: () => auto([0, 0, 0, 1, 1, 1]) }, 'Safe order'),  // preset: T1 runs all three steps, then T2, which is safe
            h('button', { type: 'button', class: 'btn sm', onclick: () => auto(Array.from({ length: 8 }, () => (Math.random() < 0.5 ? 0 : 1))) }, 'Random order'),  // preset: a random order, different each time
            h('button', { type: 'button', class: 'btn sm ghost', onclick: reset }, 'Reset')));  // Reset button
        reset();  // starts the lab when the step opens
      },  // ends render() for step 9
    },  // ends step 9
    /* ---------------- 10. Recap ---------------- */
    {  // step 10 begins: the recap page
      title: 'Recap: the six things to remember',  // the step title shown at the top of the page
      kind: 'recap',  // the kind of step (recap), shown as a label above the title
      render(el, ctx) {  // render(el, ctx): builds the recap page when it is shown
        const { h } = ctx;  // takes the HTML element builder from the toolbox
        el.append(h('div', { class: 'stack fill' },  // stacks the recap page's parts to fill the page
          h('div', { class: 'grid-2' },  // two summary cards side by side
            h('div', { class: 'card proc tight', html: '<h4 style="color:var(--proc)">Process (task) · unit of resource ownership</h4><div class="small">Owns the <b>virtual address space</b> with the process image, open files, I/O devices, and protected access to other processes (IPC). Suspending or terminating it affects <b>every</b> thread inside.</div>' }),  // summary card: the process (task), the unit of resource ownership, and what it owns
            h('div', { class: 'card thread tight', html: '<h4 style="color:var(--thread)">Thread (lightweight process) · unit of dispatching</h4><div class="small">Has its own <b>execution state</b>, saved context (its own program counter), user and kernel stacks, and thread-local storage. Shares everything its process owns.</div>' })),  // summary card: the thread (lightweight process), the unit of dispatching, and what it has
          h('p', { class: 'small muted m0' }, 'Say each answer out loud before you flip the card.'),  // instruction: say each answer before flipping the card
          ctx.ui.flipcards([  // flip cards: click one to turn it over and see the answer
            ['Two characteristics of a process?', 'Resource ownership (address space with the process image, files, devices) and scheduling/execution (path, state, priority). They are independent, so threads can split them.'],  // card: the two characteristics of a process
            ['The four process/thread models?', '1 process, 1 thread (MS-DOS) · 1 process, many threads (Java runtime) · many processes, 1 thread each (traditional UNIX) · many, many (Windows, Solaris, modern UNIX).'],  // card: the four process/thread models with their examples
            ['Four performance benefits of threads?', 'Quicker to create, quicker to terminate, quicker to switch between (same process), and they communicate through shared memory without calling the kernel.'],  // card: the four performance benefits of threads
            ['Four uses in a single-user system?', 'Foreground and background work · asynchronous processing · speed of execution · modular program structure.'],  // card: the four uses of threads in a single-user system
            ['Thread states and operations?', 'States: Running, Ready, Blocked (no Suspended: that is process-level). Operations: Spawn, Block, Unblock, Finish.'],  // card: thread states (no Suspended) and the four thread operations
            ['Why must threads synchronize?', 'They share one address space. count = count + 1 is really LOAD, ADD, STORE; a switch between those steps can lose an update (a race condition). Coordination such as a lock prevents it (Chapter 5).'],  // card: why threads must synchronize, using the LOAD-ADD-STORE example
          ], { cols: 3, height: 172 })));  // ends the card list; 3 cards per row, each 172 pixels tall; then closes the page
      },  // ends render() for the recap
    },  // ends the recap step
    /* ---------------- 10. Check yourself ---------------- */
    {  // the final step begins: the section quiz
      title: 'Check yourself',  // the step title shown at the top of the page
      kind: 'check',  // the kind of step (check), which the guide uses for quiz pages
      quiz: [  // quiz: the questions; the guide's quiz engine draws them, checks answers and gives feedback
        { q: 'In an operating system that supports threads, what is the <b>unit of dispatching</b>, the thing the scheduler picks to run?',  // question 1 (multiple choice): what is the unit of dispatching in a threaded OS?
          choices: ['The process', 'The thread', 'The process control block', 'The virtual address space'], answer: 1,  // the four choices; answer: 1 means the second choice, the thread, is correct
          feedback: ['In a multithreaded OS the process is the unit of resource ownership, not the unit that gets dispatched.', null, 'The PCB is a record the OS keeps about a process; it is data, not something that runs.', 'The address space is memory the process owns; it cannot be scheduled.'],  // a hint for each wrong choice (null for the right one), shown after a wrong pick
          why: 'Threads separate the two characteristics of a process: the thread (lightweight process) is dispatched, while the process (task) owns the resources.' },  // explanation shown after answering: the thread is dispatched, the process owns resources
        { q: 'Which is the standard example of the model with <b>a single process that contains multiple threads</b> (rather than many processes)?',  // question 2 (multiple choice): the standard example of one process with many threads
          choices: ['MS-DOS', 'A Java runtime environment', 'Traditional UNIX', 'Windows'], answer: 1,  // the four systems to choose from; the Java runtime environment is correct
          feedback: ['MS-DOS supports a single user process with a single thread.', null, 'Traditional UNIX supports many processes, but each has only one thread.', 'Windows runs many processes at once, each with many threads: that is the many-processes, many-threads model.'],  // a hint for each wrong system
          why: 'A Java runtime environment is a single process (the virtual machine) in which the program can run many threads.' },  // explanation: a Java runtime environment is one process running many threads
        { type: 'bucket', q: 'In a multithreaded process, does the OS keep one of these <b>per process</b> or <b>per thread</b>?',  // question 3 (sort into groups): which structures exist once per process and which once per thread
          buckets: ['One per process', 'One per thread'],  // the two groups
          items: [['Virtual address space holding the process image', 0], ['Open files', 0], ['Process control block', 0], ['Thread control block', 1], ['Execution state (Running, Ready, Blocked)', 1], ['Saved register context', 1], ['User stack and kernel stack', 1]],  // the items to sort, each paired with the index of its correct group
          why: 'Resources (address space, files, the PCB) exist once for the whole process. Everything that describes a path of execution (TCB, state, registers, stacks) exists once per thread.' },  // explanation: resources are per process; anything describing a path of execution is per thread
        { type: 'multi', q: 'Which of these are performance benefits of threads compared with separate processes?',  // question 4 (select all): which statements are real performance benefits of threads
          choices: ['A thread takes less time to create than a process', 'A thread takes less time to terminate than a process', 'Switching between two threads of the same process is quicker than switching between processes', 'The OS protects threads of one process from each other', 'Threads of one process can exchange data without involving the kernel'],  // the five statements; one wrongly claims the OS protects threads from each other
          answer: [0, 1, 2, 4],  // answer: the first, second, third and fifth statements are correct
          why: 'The four classic benefits are faster create, faster terminate, faster switch, and kernel-free communication through shared memory. Threads of one process are <b>not</b> protected from each other; they share one address space.' },  // explanation: the four benefits, and that threads of one process are not protected from each other
        { type: 'match', q: 'Match each situation to the use of threads it illustrates.',  // question 5 (match the pairs): match each situation to its use of threads
          pairs: [['A word processor saves a backup copy of its buffer every minute', 'Asynchronous processing'], ['A spreadsheet keeps reading input while another thread recalculates the sheet', 'Foreground and background work'], ['One thread computes on a batch of data while another reads the next batch', 'Speed of execution'], ['A program with many I/O sources is written as one thread per source', 'Modular program structure']],  // the four situation/use pairs; the quiz shuffles the right-hand side
          why: 'Timed or periodic jobs are asynchronous; keeping the user side responsive is foreground/background; overlapping computing with I/O is speed; organising many activities is modularity.' },  // explanation: how to recognise each of the four uses
        { type: 'tf', q: 'In the general thread model, one thread of a process can be swapped out to disk (the Suspended state) while its sibling threads keep running.', answer: false,  // question 6 (true or false): can one thread be suspended while its siblings run? The answer is false
          why: 'Suspension swaps the address space out of main memory, and every thread shares that address space. It is therefore a process-level state: suspending a process suspends all of its threads. (Windows can also "suspend" one thread, as section 4.4 shows, but that only stops it being scheduled; nothing is swapped out.)' },  // explanation: suspension swaps out the shared address space, so it is a process-level state
        { type: 'tf', q: 'Terminating a process terminates every thread in that process.', answer: true,  // question 7 (true or false): terminating a process ends all its threads, which is true
          why: 'Threads live inside the process and use its resources. When the process ends, its address space and resources are released, so all of its threads end too.' },  // explanation: threads live inside the process and use its resources
        { type: 'order', q: 'Put the life of a thread that makes one remote procedure call in order.',  // question 8 (put in order): the life of a thread that makes one RPC
          items: ['Spawn: the thread is created and placed on the ready list', 'It is dispatched and runs, sending its request', 'Block: it waits for the reply', 'Unblock: the reply arrives and the thread becomes Ready', 'It runs again and handles the reply', 'Finish: its register context and stacks are freed'],  // the steps in their correct order; the quiz shuffles them for the student
          why: 'Spawn puts a new thread in Ready; running leads to Block while it waits; Unblock returns it to Ready; after running again it Finishes and its resources are freed.' },  // explanation: Spawn, run, Block, Unblock, run again, Finish
        { type: 'num', q: 'One thread makes two remote procedure calls, one after the other, to two different servers. Sending a request takes 1 ms of processor time, handling a reply takes 1 ms, and each server’s reply arrives 6 ms after the request was sent. How many ms does the whole job take?',  // question 9 (calculate): total time for one thread making two RPCs one after the other
          answer: 16, tol: 0, unit: 'ms',  // the correct answer is exactly 16 ms (tol is the allowed error)
          why: 'Four pieces of processing (send A, handle A, send B, handle B) take 4 ms, and the two 6 ms waits happen one after the other: 4 + 6 + 6 = 16 ms.' },  // explanation: 4 ms of processing plus two 6 ms waits in a row
        { type: 'num', q: 'Now two threads share one processor, one thread per server. T1 sends its request from 0 to 1 ms; T2 sends its request from 1 to 2 ms. Each reply arrives 6 ms after its send finishes, and handling a reply takes 1 ms of processor time. At what time (ms) is all the work finished?',  // question 10 (calculate): the same job with two threads on one processor
          answer: 9, tol: 0, unit: 'ms',  // the correct answer is exactly 9 ms
          why: 'Reply A arrives at 1 + 6 = 7 ms and is handled from 7 to 8. Reply B arrives at 2 + 6 = 8 ms and is handled from 8 to 9. The waits overlap, so the job ends at 9 ms instead of 16.' },  // explanation: the two waits overlap, so the job ends at 9 ms instead of 16
        { type: 'num', q: 'A file server creates a helper for every request and ends it afterwards. Creating plus ending a <b>process</b> costs 500 µs. At 1,200 requests per second, what percentage of one processor is spent on that overhead?',  // question 11 (calculate): percentage of a processor spent creating and ending processes at 1,200 requests per second
          answer: 60, tol: 0.5, unit: '%',  // the correct answer is 60%, accepting anything within half a percent
          why: '1,200 × 500 µs = 600,000 µs = 0.6 s of every second, which is 60%. With threads at 50 µs each it would be only 6%.' },  // explanation: 1,200 times 500 microseconds is 0.6 s of every second
        { type: 'multi', q: 'Two threads of one process both run <code>count = count + 1</code> on a shared variable that starts at 10, with no synchronization. Which final values are possible?',  // question 12 (select all): which final values of count are possible after two unsynchronized increments
          choices: ['10', '11', '12', '13'], answer: [1, 2],  // the four values; 11 and 12 are the possible ones
          why: 'If the increments do not overlap, count ends at 12. If both threads read 10 before either writes, both write 11 and one update is lost. It can never stay 10 or reach 13. Preventing the lost update is the job of thread synchronization.' },  // explanation: 12 without overlap, 11 when both read 10 first; never 10 or 13
      ],  // closes the quiz list
    },  // ends the quiz step
  ],  // closes the list of steps

  notes: `${/* notes: the section summary shown in the Notes drawer (N key) and in the printable guide, written as HTML text */''}
<h3>1. Two characteristics of a process</h3>${/* notes heading 1: the two characteristics of a process */''}
<ul>${/* starts the bullet list for heading 1 */''}
<li><b>Resource ownership.</b> A virtual address space holding the process image (code, data, stacks and the attributes kept in the PCB), plus control of resources such as main memory, files and I/O devices. The OS protects these from other processes.</li>${/* notes bullet: resource ownership and what it includes */''}
<li><b>Scheduling and execution.</b> An execution path (trace) through one or more programs, with an execution state (Running, Ready, Blocked...) and a dispatching priority. This is the part the OS schedules and dispatches.</li>${/* notes bullet: scheduling and execution and what it includes */''}
</ul>${/* ends the list */''}
<p>The two are independent, so an OS can separate them. The unit of dispatching is the <b>thread</b> (or <b>lightweight process</b>); the unit of resource ownership is the <b>process</b> (or <b>task</b>). <b>Multithreading</b> is the ability of an OS to support several concurrent paths of execution within one process.</p>${/* notes paragraph: the two are independent, which gives threads and tasks, and defines multithreading */''}

<h3>2. Four process/thread models</h3>${/* notes heading 2: the four process/thread models */''}
<table>${/* starts the models table */''}
<tr><th>Model</th><th>Example</th></tr>${/* header row of the models table */''}
<tr><td>One process, one thread</td><td>MS-DOS</td></tr>${/* table row: one process, one thread (MS-DOS) */''}
<tr><td>One process, many threads</td><td>A Java runtime environment (one virtual machine process)</td></tr>${/* table row: one process, many threads (Java runtime environment) */''}
<tr><td>Many processes, one thread each</td><td>Traditional UNIX</td></tr>${/* table row: many processes, one thread each (traditional UNIX) */''}
<tr><td>Many processes, many threads each</td><td>Windows, Solaris, modern UNIX versions</td></tr>${/* table row: many processes, many threads each (Windows, Solaris, modern UNIX) */''}
</table>${/* ends the models table */''}

<h3>3. What the process has, what each thread has</h3>${/* notes heading 3: what the process has and what each thread has */''}
<p><b>The process:</b> a virtual address space holding the process image, and protected access to processors, other processes (IPC), files and I/O resources.</p>${/* notes paragraph: what the process has */''}
<p><b>Each thread:</b> an execution state; a saved thread context when not running (in effect, its own program counter); an execution stack; per-thread static storage for local variables (thread-local storage); and access to the memory and resources of its process, shared with its siblings.</p>${/* notes paragraph: what each thread has */''}
<p>Threads share one address space, so each can see the data the others write, and a file opened by one thread can be used by all. Seeing another thread's update <b>reliably and in the right order</b> is not automatic: it takes synchronization (a lock or an atomic operation), because processors and compilers may delay or reorder memory writes (section 5.1 covers memory order). A thread's stack is its own but lives in the shared address space: the OS does not protect threads of one process from each other.</p>${/* notes paragraph: sharing makes writes visible, but seeing them reliably needs synchronization */''}

<h3>4. Single-threaded vs multithreaded process models</h3>${/* notes heading 4: single-threaded versus multithreaded bookkeeping */''}
<table>${/* starts the comparison table */''}
<tr><th>Structure</th><th>Single-threaded</th><th>Multithreaded</th></tr>${/* header row: structure, single-threaded, multithreaded */''}
<tr><td>Process control block (PCB)</td><td>1, also holds the registers and state</td><td>1, process-wide facts only</td></tr>${/* table row: the PCB in each model */''}
<tr><td>User address space</td><td>1</td><td>1, shared by all threads</td></tr>${/* table row: the user address space in each model */''}
<tr><td>Thread control block (TCB): registers, priority, state</td><td>none</td><td>1 per thread</td></tr>${/* table row: the TCB, which only the multithreaded model has */''}
<tr><td>User stack and kernel stack</td><td>1 each</td><td>1 each per thread</td></tr>${/* table row: the user and kernel stacks in each model */''}
</table>${/* ends the comparison table */''}
<p>Each thread needs its own kernel stack because the kernel may be working for several threads at once. <b>Process-wide actions affect every thread:</b> suspending a process swaps its one address space out of main memory, so all its threads are suspended together; terminating a process terminates all of its threads.</p>${/* notes paragraph: why each thread needs a kernel stack, and that suspend and terminate affect every thread */''}

<h3>5. Four performance benefits of threads</h3>${/* notes heading 5: the four performance benefits */''}
<ol>${/* starts the numbered list of benefits */''}
<li><b>Create:</b> far quicker than creating a process (no new address space, image, file table or protection).</li>${/* notes item: faster create, and why */''}
<li><b>Terminate:</b> quicker than ending a process (the address space and files remain).</li>${/* notes item: faster terminate, and why */''}
<li><b>Switch:</b> switching between threads of one process is quicker than a process switch (the memory map and cached data stay).</li>${/* notes item: faster switch within one process, and why */''}
<li><b>Communicate:</b> threads share memory, so they exchange data without invoking the kernel; separate processes need kernel-mediated IPC.</li>${/* notes item: communication through shared memory without the kernel */''}
</ol>${/* ends the numbered list */''}
<p><b>Worked example</b> (illustrative costs): a file server creates and ends a helper for every request, 500 µs for a process or 50 µs for a thread. Overhead = requests per second × cost. At 800 requests/s: 800 × 500 µs = 0.4 s of every second, 40% of one processor, versus 4% with threads. At 1,200/s: 60% versus 6%. At 2,000/s the process version uses 100%. Busy servers often go further and reuse a pool of threads.</p>${/* notes paragraph: the worked file-server example with its overhead arithmetic */''}

<h3>6. Uses of threads in a single-user system</h3>${/* notes heading 6: uses of threads in a single-user system */''}
<ul>${/* starts the list of uses */''}
<li><b>Foreground and background work:</b> one spreadsheet thread shows menus and reads input while another runs commands and updates the sheet.</li>${/* notes bullet: foreground and background work */''}
<li><b>Asynchronous processing:</b> work set off by a timer or outside event, e.g. saving a word processor's buffer to disk once a minute.</li>${/* notes bullet: asynchronous processing */''}
<li><b>Speed of execution:</b> compute one batch while another thread reads the next; on a multiprocessor, threads of one process run at the same time.</li>${/* notes bullet: speed of execution */''}
<li><b>Modular program structure:</b> programs with many activities or many I/O sources and destinations are easier to design as threads.</li>${/* notes bullet: modular program structure */''}
</ul>${/* ends the list of uses */''}

<h3>7. Thread states and operations</h3>${/* notes heading 7: thread states and operations */''}
<p>States: <b>Running</b>, <b>Ready</b>, <b>Blocked</b>. There is no thread-level Suspended state: suspension swaps out the shared address space, a process-level act.</p>${/* notes paragraph: the three thread states and why there is no Suspended state for threads */''}
<ul>${/* starts the list of operations */''}
<li><b>Spawn:</b> creating a process spawns its first thread; a thread may spawn another in the same process, supplying a start address and arguments. The new thread gets its own register context and stacks and joins the ready list.</li>${/* notes bullet: Spawn */''}
<li><b>Block:</b> the thread waits for an event; its registers, program counter and stack pointer are saved and the processor runs another ready thread.</li>${/* notes bullet: Block */''}
<li><b>Unblock:</b> the event occurs and the thread returns to the ready list.</li>${/* notes bullet: Unblock */''}
<li><b>Finish:</b> its register context and stacks are deallocated.</li>${/* notes bullet: Finish */''}
</ul>${/* ends the list of operations */''}
<p>Whether one blocked thread blocks its whole process depends on how threads are implemented (Section 4.2). On a <b>uniprocessor</b> only one thread runs at a time, so threads of several processes are interleaved. The processor passes on when the running thread blocks, finishes, uses up its time quantum, or is preempted by a higher-priority thread. A switch between threads of one process keeps the memory map; a switch to another process changes it.</p>${/* notes paragraph: blocking of the whole process is covered in 4.2; interleaving on a uniprocessor and why switches happen */''}

<h3>8. Example: remote procedure calls</h3>${/* notes heading 8: the remote procedure call example */''}
<p>An RPC runs a procedure on another computer; the caller is blocked until the reply arrives. Suppose sending a request and handling a reply each take 1 ms of processor time, and the replies arrive a and b ms after their sends.</p>${/* notes paragraph: what an RPC is and the timing assumptions */''}
<ul>${/* starts the list comparing the two designs */''}
<li><b>One thread:</b> the waits happen one after the other: total = 4 + a + b (a = b = 5 gives 14 ms; a = b = 6 gives 16 ms).</li>${/* notes bullet: one thread, where the waits add up one after the other */''}
<li><b>One thread per server, one processor:</b> T1 sends at 0–1, T2 at 1–2, and then both wait together. Replies arrive at 1 + a and 2 + b and are handled one at a time. With a = b = 5 they are handled at 6–7 and 7–8, so the job ends at 8 ms (1.75× faster); with a = b = 6 it ends at 9 ms.</li>${/* notes bullet: one thread per server on one processor, where the waits overlap */''}
</ul>${/* ends the list */''}
<p>The gain comes from overlapping the waits, not from running at the same instant.</p>${/* notes paragraph: the gain comes from overlapping the waits */''}

<h3>9. Why threads must synchronize</h3>${/* notes heading 9: why threads must synchronize */''}
<p>Threads of a process share its address space and resources, so their activities must be coordinated or they can interfere and corrupt shared data. <code>count = count + 1</code> is three machine steps: LOAD (copy count into a private register), ADD, STORE (write it back). If T1 and T2 both LOAD 10 before either STOREs, both store 11 and one increment is lost: a <b>lost update</b>, a kind of race condition. If one thread stores before the other loads, count ends at 12. It can never end at 10 or 13. A lock that lets only one thread at a time run the three steps always gives 12; Chapter 5 builds such tools.</p>`,  // notes paragraph: count = count + 1 is three steps and can lose an update; then the notes text ends
});  // closes the section object and the call that registers it with the guide
