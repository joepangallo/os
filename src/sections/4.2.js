// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 4.2  Types of Threads
   User-level threads (ULTs), kernel-level threads (KLTs), the combined
   approach, and the thread : process arrangements.
   ===================================================================== */
(() => {  // wraps the whole file in a function that runs once, right away, so its helper names stay private to this file
  /* ---------- shared helpers (scoped to this file) ---------- */
  // Thread colours: all threads are "thread" pink; we tell them apart with
  // different tints so a Gantt chart stays readable in light and dark mode.
  const TINT = { T1: 'var(--thread)', T2: 'color-mix(in srgb, var(--thread) 62%, var(--os))', T3: 'color-mix(in srgb, var(--thread) 55%, var(--io))' };  // TINT: the outline and text color for each thread in the timelines; color-mix blends the thread pink with another color
  const TBG = { T1: 'var(--thread-bg)', T2: 'color-mix(in srgb, var(--thread-bg) 70%, var(--os-bg))', T3: 'color-mix(in srgb, var(--thread-bg) 65%, var(--io-bg))' };  // TBG: the matching pale fill color for each thread's boxes
  /* Tick-by-tick simulation of one 3-thread program under ULTs or KLTs.
     Each thread needs 4 ticks of CPU. With `block`, T2 computes 1 tick, then does a
     blocking read that keeps the disk busy for 4 ticks, then computes 3 more ticks.
     Scheduling is round robin with a 1-tick slice in both designs:
       ULT: the kernel sees one process P and gives it ONE core; the library picks the thread.
            A blocking call blocks P, so no thread runs until the read finishes.
       KLT: the kernel keeps a ready queue of threads and fills up to `cores` cores per tick.
            Threads whose I/O finishes join the queue before threads that were just preempted. */
  const NAMES = ['T1', 'T2', 'T3'];  // NAMES: the three threads of the program being simulated
  const IO_TICKS = 4;  // IO_TICKS: how many ticks the disk stays busy for T2's blocking read
  function simulate(kind, cores, block) {  // simulate(kind, cores, block): runs the 3-thread program tick by tick as ULTs or KLTs and records every tick
    const st = {};  // st holds each thread's remaining work
    NAMES.forEach((n) => { st[n] = { segs: n === 'T2' && block ? [1, -IO_TICKS, 3] : [4], done: false }; });  // each thread needs 4 ticks of CPU; with block, T2's work is 1 tick, then a 4-tick read (negative), then 3 ticks
    const ticks = [];  // ticks will collect one record per tick: what ran on each core and what happened
    const left = () => NAMES.some((n) => !st[n].done);  // left(): true while at least one thread still has work to do
    if (kind === 'ult') {  // the user-level thread version
      let last = -1, resume = null, blockedUntil = -1, ioThr = null;  // last: the thread the library ran last; resume: who continues after the read; blockedUntil: when the read ends; ioThr: who is reading
      for (let t = 0; left() && t < 40; t++) {  // one pass per tick, stopping when all threads are done (40 ticks at most, as a safety limit)
        const rec = { t, cores: [], io: null, ev: [], lib: {}, kern: 'Running' };  // this tick's record: the cores, the disk, the event text, the library's view of each thread, and the kernel's view of P
        const second = cores === 2 ? 'unusable' : 'absent';  // the second core is "unusable" on a two-core machine (the kernel gives P only one), or "absent" on a one-core machine
        if (t < blockedUntil) {  // while the read is still going on, the whole process is blocked
          rec.cores = ['blocked', second]; rec.io = ioThr; rec.kern = 'Blocked';  // core 1 shows P as blocked, the disk shows the reading thread, and the kernel's view of P is Blocked
          const others = NAMES.filter((n) => n !== ioThr && !st[n].done);  // others: the threads that could run if only the kernel knew about them
          rec.ev.push(`P is blocked. ${others.join(' and ')} ${others.length > 1 ? 'are' : 'is'} ready, but the kernel cannot see ${others.length > 1 ? 'them' : 'it'}.`);  // event text: P is blocked, and the other threads are ready but invisible to the kernel
          NAMES.forEach((n) => { rec.lib[n] = st[n].done ? 'Done' : n === ioThr ? 'Running' : 'Ready'; });  // the library still thinks the reading thread is Running, because it never got a chance to switch
          ticks.push(rec); continue;  // saves the record and moves on to the next tick
        }  // ends the blocked case
        let pick = resume;  // pick is the thread to run now; after a read it is the thread that made the read
        if (pick) rec.ev.push(`The read is done; P runs again and resumes inside ${pick}.`);  // event text: the read is done and P continues inside that thread
        resume = null;  // the resume request has been used up
        if (!pick) for (let k = 1; k <= 3; k++) { const n = NAMES[(last + k + 3) % 3]; if (!st[n].done) { pick = n; break; } }  // otherwise the library picks the next unfinished thread after the last one, taking turns (round robin)
        last = NAMES.indexOf(pick);  // remembers which thread ran so the next turn goes to the one after it
        rec.cores = [pick, second];  // the chosen thread runs on core 1; the second core stays unusable or absent
        const seg = st[pick].segs;  // seg is the chosen thread's remaining pieces of work
        seg[0]--;  // uses up one tick of the current piece
        if (!rec.ev.length) rec.ev.push(`The library runs ${pick} on core 1.`);  // if nothing else happened, the event text just names the running thread
        if (seg[0] === 0) {  // when the current piece of computing is finished
          seg.shift();  // drops the finished piece
          if (seg.length && seg[0] < 0) {  // if the next piece is a read (a negative number), the thread makes a blocking system call
            const d = -seg.shift(); blockedUntil = t + 1 + d; ioThr = pick; resume = pick;  // the read length d sets when the process is unblocked; the same thread resumes afterwards
            rec.ev.push(`${pick} calls read(): the kernel blocks the whole process.`);  // event text: the read() call blocks the whole process
          } else if (!seg.length) { st[pick].done = true; rec.ev.push(`${pick} finishes.`); }  // if nothing is left, the thread is finished
        }  // ends the finished-piece case
        NAMES.forEach((n) => { rec.lib[n] = n === pick ? 'Running' : st[n].done ? 'Done' : 'Ready'; });  // the library's view: the picked thread is Running, the others Ready or Done
        ticks.push(rec);  // saves this tick's record
      }  // ends the tick loop for ULTs
    } else {  // the kernel-level thread version
      const q = NAMES.slice(); const io = [];  // q is the kernel's ready queue (all three threads to start); io lists the reads in progress
      for (let t = 0; left() && t < 40; t++) {  // one pass per tick, as above
        const rec = { t, cores: [], io: null, ev: [], kst: {} };  // this tick's record; kst is the kernel's view of each thread
        const run = q.splice(0, cores);  // takes as many threads from the front of the ready queue as there are cores
        for (let c = 0; c < cores; c++) rec.cores.push(run[c] || 'idle');  // each core runs one of them, or idles if the queue ran out
        if (cores === 1) rec.cores.push('absent');  // on a one-core machine the second core is shown as absent
        const busy = io.find((x) => x.start <= t && t < x.until);  // finds a read that is in progress during this tick
        rec.io = busy ? busy.n : null;  // the disk row shows which thread is reading, if any
        rec.ev.push(run.length ? run.map((n, c) => `core ${c + 1}: ${n}`).join(', ') + (run.length < cores ? '; core 2 idles, nothing is ready' : '') + '.' : 'Every core idles: nothing is ready.');  // event text: which thread runs on which core, or that every core idles
        const back = [];  // back collects the threads whose 1-tick slice ended and that still have work
        for (const n of run) {  // handles each thread that ran this tick
          const seg = st[n].segs;  // seg is its remaining pieces of work
          seg[0]--;  // uses up one tick
          if (seg[0] > 0) { back.push(n); continue; }  // still more computing to do: it goes back in the queue after this slice
          seg.shift();  // drops the finished piece
          if (seg.length && seg[0] < 0) { const d = -seg.shift(); io.push({ n, start: t + 1, until: t + 1 + d }); rec.ev.push(`${n} calls read() and blocks; the kernel keeps running the others.`); }  // a read comes next: the thread blocks for d ticks, and the kernel keeps running the other threads
          else if (!seg.length) { st[n].done = true; rec.ev.push(`${n} finishes.`); }  // nothing left: the thread is finished
          else back.push(n);  // another piece of computing: back to the queue
        }  // ends the loop over running threads
        for (const x of io) if (x.until === t + 1) { q.push(x.n); rec.ev.push(`${x.n}’s read completes, so ${x.n} is ready again.`); }  // threads whose read completes join the ready queue first, ahead of those just preempted
        q.push(...back);  // then the preempted threads go to the back of the queue
        NAMES.forEach((n) => { rec.kst[n] = run.includes(n) ? 'Running' : st[n].done ? 'Done' : io.some((x) => x.n === n && x.start <= t && t < x.until) ? 'Blocked' : 'Ready'; });  // the kernel's view: Running, Done, Blocked on a read, or Ready
        ticks.push(rec);  // saves this tick's record
      }  // ends the tick loop for KLTs
    }  // ends the ULT/KLT choice
    return { ticks, end: ticks.length };  // returns every tick's record and the total number of ticks the program took
  }  // ends simulate()

  Guide.section({  // registers section 4.2 with the guide; the object inside holds its terms, styles, steps and quiz
    id: '4.2',  // the section number, used in links, the side menu and saved progress
    title: 'Types of Threads',  // the full title shown at the top of every step of this section
    short: 'Types of threads',  // the short name used in the side menu and progress list
    summary: 'User-level vs kernel-level threads: who manages them, what blocks, what it costs, and hybrid designs.',  // one-sentence summary shown on the chapter overview page
    objectives: [  // what the student should be able to do after this section, listed on its first page
      'Explain who manages threads in the user-level (ULT) and kernel-level (KLT) approaches, and what the kernel can and cannot see in each.',  // objective 1: who manages the threads, and what the kernel can see, in each approach
      'Trace how ULT states relate to process states when a thread blocks, when the time slice ends, and when one thread waits for another.',  // objective 2: how ULT states relate to process states
      'Weigh the advantages and disadvantages of ULTs and KLTs, including the workarounds, using measured latency numbers.',  // objective 3: the pros and cons of each approach, with measured numbers
      'Describe the combined approach and the 1:1, M:1, 1:M and M:N thread-to-process arrangements, with an example of each.',  // objective 4: the combined approach and the four thread-to-process arrangements
    ],  // closes the objectives list
    terms: [  // key terms for the glossary and the hover pop-ups, each written as [term, definition]
      ['User-level thread (ULT)', 'A thread that is created, scheduled and switched entirely by a thread library inside the application. The kernel does not know it exists; it only sees the process that contains it.'],  // glossary entry: user-level thread, managed by a library the kernel cannot see
      ['Kernel-level thread (KLT)', 'A thread that the kernel itself creates, keeps records for and schedules. Also called a kernel-supported thread or a lightweight process.'],  // glossary entry: kernel-level thread, created and scheduled by the kernel
      ['Lightweight process (LWP)', 'Another name for a thread (section 4.1), the unit that gets dispatched; when threads are sorted into user-level and kernel-level, the name usually means a kernel-level thread. Solaris uses it for one specific kernel-side carrier that user-level threads run on (section 4.5).'],  // glossary entry: lightweight process, and the different meanings the name can have
      ['Thread library', 'A package of ordinary user-mode routines, linked into a program, that creates and destroys threads, passes data between them, schedules them, and saves and restores their contexts.'],  // glossary entry: thread library, the user-mode routines that manage ULTs
      ['Thread context', 'Everything a thread needs to resume exactly where it stopped: its program counter, stack pointer and other register values.'],  // glossary entry: thread context, the registers a thread needs to resume
      ['Kernel mode', 'The privileged processor mode in which operating-system code runs; it may execute any instruction and touch any memory. Ordinary programs run in the restricted user mode.'],  // glossary entry: kernel mode, the privileged processor mode
      ['Mode switch', 'A change of the processor between user mode and kernel mode: user → kernel when a program makes a system call or an interrupt arrives, and kernel → user when the kernel returns. Each one costs time.'],  // glossary entry: mode switch, moving between user mode and kernel mode
      ['System call', 'A request from a program to the kernel for a service, such as reading a file. It enters the kernel through a controlled gate, which means a mode switch.'],  // glossary entry: system call, a program's request for a kernel service
      ['Blocking system call', 'A system call that cannot finish right away (for example, a read whose data is still on the disk), so the caller is put to sleep until the event it needs happens.'],  // glossary entry: blocking system call, one that puts the caller to sleep
      ['Time slice', 'The longest stretch of processor time the scheduler hands out in one go before it may switch to someone else. Also called a quantum.'],  // glossary entry: time slice, also called a quantum
      ['Clock interrupt', 'A regular signal from a hardware timer that hands control to the kernel, so it can check whether the running process has used up its time slice.'],  // glossary entry: clock interrupt, the timer signal that hands control to the kernel
      ['Jacketing', 'A thread-library trick that wraps a possibly blocking system call in code that first asks, without blocking, whether the call would block. If it would, the library runs another thread and tries again later.'],  // glossary entry: jacketing, the library's check-before-blocking trick
      ['Multiprocessor', 'A computer with two or more processors (or cores) that can execute instructions at the same moment.'],  // glossary entry: multiprocessor, several processors running at the same moment
      ['Latency', 'How long one operation takes from start to finish. Here it is measured in microseconds (µs): millionths of a second.'],  // glossary entry: latency, how long one operation takes, measured here in microseconds
      ['Null fork', 'A benchmark that measures the pure overhead of creating, scheduling, running and finishing a thread or process whose body does nothing at all.'],  // glossary entry: null fork, the benchmark for creating an empty thread or process
      ['Signal-wait', 'A benchmark that measures the overhead of one thread or process signalling a waiting partner and then waiting itself: the basic cost of synchronizing two of them.'],  // glossary entry: signal-wait, the benchmark for the cost of synchronizing two of them
      ['Combined approach (hybrid threading)', 'A design in which threads are created and mostly managed by a user-level library, and the many user-level threads of an application are mapped onto a smaller or equal number of kernel-level threads.'],  // glossary entry: combined approach, many user-level threads mapped onto kernel-level threads
      ['Thread migration', 'Moving an executing thread out of one process environment (address space and resources) into another, possibly on a different machine.'],  // glossary entry: thread migration, moving a thread into another process environment
      ['Address space', 'The range of memory addresses a process is allowed to use. All threads of one process share the same address space.'],  // glossary entry: address space, shared by all threads of one process
    ],  // closes the terms list

    css: ` /* css: style rules for this section only; every rule starts with .sec-4-2 so it cannot affect other sections */
      .sec-4-2 .kv { display:flex; justify-content:space-between; gap:10px; } /* .kv: a label on the left and its value on the right of the same row (used in steps 7 and 8) */
      .sec-4-2 .say { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; font-size: 15px; line-height: 1.45; } /* .say: the pale rounded box where explanations appear as the student interacts */
      .sec-4-2 .say b { color: var(--chc); } /* bold words inside an explanation box take the chapter's accent color */
      .sec-4-2 .job { padding: 8px 11px; } /* step 2: padding inside each of the library's four job cards */
      .sec-4-2 .job b { display: block; font-size: 15.5px; color: var(--thread); } /* step 2: the job title sits on its own line in the thread color */
      .sec-4-2 .job > span { font-size: 14px; color: var(--ink-2); line-height: 1.35; display: block; } /* step 2: the job description in smaller, softer text under the title */
      .sec-4-2 .grid-1 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; } /* a one-column grid with even gaps between its items */
      .sec-4-2 .btn.okay { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); } /* step 9: a correct answer button turns green */
      .sec-4-2 .btn.nope { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); text-decoration: line-through; } /* step 9: a wrong answer button turns red and its label is struck through */
      .sec-4-2 .seg.tp { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } /* step 9: the two-choice switch is laid out as two equal columns */
      .sec-4-2 .seg.tp button { white-space: normal; line-height: 1.25; } /* step 9: lets the switch's button labels wrap onto a second line */
      .sec-4-2 .tp-ans { display: grid; grid-template-columns: repeat(2, max-content); gap: 6px; } /* step 9: the answer buttons sit in two columns, each as wide as its label */
      .sec-4-2 .tp-note { font-size: 13px; color: var(--ink-2); font-weight: 650; } /* step 9: the small note next to the arrangement's heading, in softer bold text */
    `,  // end of the CSS text for this section

    steps: [  // steps: the list of pages in this section, shown one at a time as the student presses Next
      /* ---------------- 1. Big picture: who knows the threads exist? ---------------- */
      {  // step 1 begins: who knows the threads exist, the user program or the kernel?
        title: 'Who knows your threads exist?',  // the step title shown at the top of the page
        kind: 'story',  // the kind of step (a story page), shown as a label above the title
        html: `${/* html: the fixed page content for step 1, written as HTML text */''}
          <div class="split l fill">${/* two-column layout: explanation on the left, the interactive diagram on the right */''}
            <div class="stack">${/* the left column stacks its paragraphs with even spacing */''}
              <p class="lead m0">Every thread needs a manager: someone must create it, decide when it runs, and save its place when it pauses. This section asks one question: <b>who does that job?</b></p>${/* opening paragraph: every thread needs a manager, so who does that job? */''}
              <p class="m0">There are two broad answers. With <span class="t">user-level threads</span> (ULTs), a <span class="t">thread library</span> inside the application does all the managing and the kernel never hears about the threads. With <span class="t">kernel-level threads</span> (KLTs, also called kernel-supported threads or <span class="t" data-t="lightweight process">lightweight processes</span>), the kernel manages every thread itself.</p>${/* paragraph: the two answers, ULTs managed by a library and KLTs managed by the kernel (marked terms pop up definitions) */''}
              <div class="callout analogy m0" data-label="Analogy">An office tower hands out door badges. Company A registers only its own name, gets one badge, and its staff pass it around themselves (ULTs). Company B registers every employee, so the tower can let several of them in at once (KLTs). If A's badge-holder gets stuck in the lobby, nobody else from A gets in.</div>${/* analogy box: office door badges, one per company versus one per employee */''}
              <div class="sec-4-2-road small"><b>Coming up:</b> inside a thread library → three state puzzles → kernel-level switching → a side-by-side simulator → jacketing → real timing numbers → hybrid designs → threads per process.</div>${/* the "Coming up" roadmap for the rest of the section */''}
            </div>${/* ends the left column */''}
            <div class="card white stack sec-4-2-s1"></div>${/* the empty card on the right where render() draws the diagram */''}
          </div>`,  // ends the layout and the HTML text
        render(el, ctx) {  // render(el, ctx): builds the what-the-kernel-sees diagram when step 1 is shown; ctx is the guide's toolbox for this page
          const { h, s } = ctx;  // takes h (makes HTML elements) and s (makes SVG elements; SVG is the browser's drawing format) from the toolbox
          const host = ctx.$('.sec-4-2-s1');  // host is the right-hand card from the HTML above
          const svg = s('svg', { viewBox: '0 0 620 292', width: '100%', role: 'img', 'aria-label': 'User space and kernel space, showing what the kernel can see' });  // the SVG drawing area showing user space above and kernel space below
          const cap = h('p', { class: 'small m0 sec-4-2-cap' });  // the caption under the diagram
          const X = [120, 310, 500]; // centres of the three thread boxes
          const CAPS = {  // CAPS: the caption for each of the three designs
            ult: '<b>The kernel sees 1 schedulable unit.</b> It schedules process P as a whole and has no idea there are three threads inside. The library decides which thread gets to use P’s turn on the CPU.',  // caption for ULTs: the kernel sees only process P
            klt: '<b>The kernel sees 3 schedulable units.</b> It keeps a record for P and for each thread, and schedules threads directly, so two threads of P could run on two processors at the same moment.',  // caption for KLTs: the kernel sees and schedules all three threads
            mix: '<b>The kernel sees 2 schedulable units.</b> The library creates and schedules the three threads but runs them on two kernel-level threads. This hybrid comes back near the end of the section.',  // caption for the hybrid: three threads carried by two kernel-level threads
          };  // closes the CAPS table
          function box(x, y, w, hh, cls, label, sub) {  // box(): draws a rounded box with a centered label and an optional second line
            return s('g', {},  // returns the box as one group of shapes
              s('rect', { x, y, width: w, height: hh, rx: 9, class: cls, 'stroke-width': 2 }),  // the box's frame, colored by cls
              s('text', { x: x + w / 2, y: y + (sub ? 19 : hh / 2 + 5), 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, label),  // the main label, near the top when there is a second line, otherwise centered
              sub ? s('text', { x: x + w / 2, y: y + 35, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, sub) : null);  // the optional second line in smaller grey text
          }  // ends box()
          function draw(mode) {  // draw(mode): redraws the diagram for one design (ult, klt or mix); runs when the student picks a design
            const kids = [  // kids collects the shapes that are the same in every design
              s('text', { x: 8, y: 16, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'USER SPACE'),  // the "USER SPACE" heading
              s('rect', { x: 20, y: 24, width: 580, height: 116, rx: 12, class: 's-proc', 'stroke-width': 2 }),  // the box for process P
              s('text', { x: 34, y: 44, 'font-size': 14, 'font-weight': 700, style: 'fill:var(--proc)' }, 'Process P  (one address space, shared files)'),  // process P's title: one address space and shared files
              ...X.map((cx, i) => box(cx - 60, 54, 120, 42, 's-thread', 'Thread ' + (i + 1), null)),  // the three thread boxes inside P
              s('line', { x1: 0, y1: 156, x2: 620, y2: 156, class: 's-line', 'stroke-dasharray': '6 5', 'stroke-width': 1.5 }),  // a dashed line that separates user space from kernel space
              s('text', { x: 612, y: 151, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'user mode ↑'),  // label on the line: user mode is above
              s('text', { x: 612, y: 170, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'kernel mode ↓'),  // label on the line: kernel mode is below
              s('text', { x: 8, y: 184, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'KERNEL SPACE'),  // the "KERNEL SPACE" heading
              s('rect', { x: 20, y: 192, width: 580, height: 96, rx: 12, class: 's-os', 'stroke-width': 2 }),  // the kernel box at the bottom
            ];  // ends the list of shared shapes
            const halo = (bg) => `paint-order:stroke;stroke:var(${bg});stroke-width:6px;stroke-linejoin:round;`;  // halo(): style text with an outline in the background color, so it stays readable when it sits over lines
            const late = [s('text', { x: 34, y: 212, 'font-size': 14, 'font-weight': 700, style: halo('--os-bg') + 'fill:var(--os)' }, 'What the kernel’s scheduler can see')];  // late collects text drawn last, on top of everything else; it starts with the kernel box's title
            if (mode === 'ult' || mode === 'mix') {  // ULTs and the hybrid both have a thread library in user space
              kids.push(s('rect', { x: 60, y: 104, width: 500, height: 28, rx: 8, class: 's-accent', 'stroke-width': 1.5 }),  // the library's box across the bottom of process P
                s('text', { x: 310, y: 123, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'thread library (ordinary user-mode code)'));  // the library's label: ordinary user-mode code
            } else {  // KLTs have no library
              late.push(s('text', { x: 310, y: 124, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub', style: halo('--proc-bg') }, 'no library: threads are created through kernel system calls'));  // a note in P instead: threads are created with kernel system calls
            }  // ends the library choice
            if (mode === 'ult') {  // ULT design: the kernel sees only the process
              kids.push(s('line', { x1: 310, y1: 132, x2: 310, y2: 222, class: 's-line', 'marker-end': 'url(#arr)' }),  // one arrow down from P to a single "Process P" record in the kernel
                box(230, 226, 160, 50, 's-proc', 'Process P', '1 unit to schedule'));  // the single record: one unit to schedule
            } else if (mode === 'klt') {  // KLT design: one arrow and one kernel-level thread per user thread
              X.forEach((cx, i) => kids.push(s('line', { x1: cx, y1: 96, x2: cx, y2: 222, class: 's-line', 'marker-end': 'url(#arr)' }), box(cx - 70, 226, 140, 50, 's-thread', 'KLT ' + (i + 1), 'runs Thread ' + (i + 1))));  // each thread gets its own arrow and its own KLT box in the kernel
            } else {  // hybrid design: two kernel-level threads carry the three user threads
              [[215, 'KLT 1', 'carries Threads 1, 2'], [405, 'KLT 2', 'carries Thread 3']].forEach(([cx, l, sub]) => kids.push(  // KLT 1 carries threads 1 and 2; KLT 2 carries thread 3
                s('line', { x1: cx, y1: 132, x2: cx, y2: 222, class: 's-line', 'marker-end': 'url(#arr)' }), box(cx - 80, 226, 160, 50, 's-thread', l, sub)));  // draws each KLT's arrow and box
            }  // ends the design choice
            svg.replaceChildren(...kids, ...late);  // swaps in the new drawing, with the late text on top
            cap.innerHTML = CAPS[mode];  // updates the caption for this design
            const st = STATS[mode];  // st is this design's row from the STATS table
            stats.replaceChildren(...[['Units the kernel schedules', st[0]], ['Threads of P running at once on 2 cores', st[1]], ['Who switches between threads', st[2]]].map(([k, v]) =>  // rebuilds the three facts under the diagram: kernel units, threads at once on 2 cores, and who switches
              h('div', { class: 'card tight', style: { textAlign: 'center' } }, h('div', { class: 'xs muted b' }, k), h('div', { class: 'b', style: { fontSize: '19px', color: 'var(--chc)' } }, v))));  // each fact is a small centered card: the question in grey, the answer large in the accent color
          }  // ends draw()
          const STATS = { ult: ['1', 'at most 1', 'the library'], klt: ['3', 'up to 2', 'the kernel'], mix: ['2', 'up to 2', 'library + kernel'] };  // STATS: for each design, the three facts: units the kernel schedules, threads at once on 2 cores, who switches
          const stats = h('div', { class: 'grid-3', style: { gap: '8px', marginTop: 'auto' } });  // the row of three fact cards, pushed to the bottom of the card
          const seg = ctx.ui.seg([{ value: 'ult', label: 'User-level' }, { value: 'klt', label: 'Kernel-level' }, { value: 'mix', label: 'Combined' }], 'ult', draw);  // the three-way switch (User-level, Kernel-level, Combined); choosing one calls draw with that design
          host.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'What does the kernel see?'), seg), svg, cap, stats);  // places the heading and switch, then the diagram, caption and facts into the card
          draw('ult');  // draws the user-level design first when the step opens
        },  // ends render() for step 1
      },  // ends step 1
      /* ---------------- 2. ULTs: the library runs the show ---------------- */
      {  // step 2 begins: an interactive thread library, where the student makes library calls
        title: 'User-level threads: a library runs the show',  // the step title shown at the top of the page
        kind: 'explore',  // the kind of step (explore), shown as a label above the title
        html: `${/* html: the fixed page content for step 2 */''}
          <div class="split l fill">${/* two-column layout: explanation on the left, the library simulator on the right */''}
            <div class="stack">${/* the left column stacks its blocks with even spacing */''}
              <p class="m0">With <span class="t">ULTs</span>, all thread management happens inside the application, in a <span class="t">thread library</span>: plain code linked into the program that runs in user mode. The kernel sees only the process, which it schedules as one unit with one state (Running, Ready or Blocked).</p>${/* opening paragraph: with ULTs a user-mode library does all the managing; the kernel sees one process */''}
              <h4 class="m0">The library’s four jobs</h4>${/* heading over the four job cards */''}
              <div class="grid-2" style="gap:8px">${/* a 2-by-2 grid of job cards begins */''}
                <div class="card tight job"><b>Create &amp; destroy threads</b><span>Give each thread a stack and a context slot.</span></div>${/* job card: create and destroy threads */''}
                <div class="card tight job"><b>Pass messages &amp; data</b><span>Move values between threads in shared memory.</span></div>${/* job card: pass messages and data */''}
                <div class="card tight job"><b>Schedule threads</b><span>Pick the next thread with the app’s own policy.</span></div>${/* job card: schedule threads with the app's own policy */''}
                <div class="card tight job"><b>Save &amp; restore <span class="t" data-t="thread context">contexts</span></b><span>Store one thread’s registers, load the next one’s.</span></div>${/* job card: save and restore thread contexts */''}
              </div>${/* ends the job grid */''}
              <div class="card tight stack" style="gap:4px;flex:none">${/* a card listing three advantages of ULTs begins */''}
                <div class="xs b muted">WHY BOTHER? THREE ADVANTAGES OF ULTS</div>${/* small heading for the advantages card */''}
                <div class="small"><span class="chip ok">1</span> <b>Cheap switches:</b> thread records live in the process, so no <span class="t">mode switch</span>.</div>${/* advantage 1: cheap switches, because no mode switch is needed */''}
                <div class="small"><span class="chip ok">2</span> <b>Custom scheduling:</b> each app picks its own policy.</div>${/* advantage 2: each application can choose its own scheduling policy */''}
                <div class="small"><span class="chip ok">3</span> <b>Runs on any OS:</b> the kernel needs no thread support.</div>${/* advantage 3: ULTs run on any OS, even one without thread support */''}
              </div>${/* ends the advantages card */''}
            </div>${/* ends the left column */''}
            <div class="card white stack sec-4-2-s2" style="gap:10px"></div>${/* the empty card on the right where render() builds the simulator */''}
          </div>`,  // ends the layout and the HTML text
        render(el, ctx) {  // render(el, ctx): builds the thread-library simulator when step 2 is shown
          const { h, s } = ctx;  // takes the HTML and SVG element builders from the toolbox
          const host = ctx.$('.sec-4-2-s2');  // host is the right-hand card
          const hex = (n) => '0x' + n.toString(16).toUpperCase().padStart(4, '0');  // hex(n): writes a number as a 4-digit hexadecimal address such as 0x1040, like the register values shown
          const ROLES = ['UI', 'network', 'disk', 'worker'];  // ROLES: the jobs a thread can have in this demo; a new thread takes the first one that is free
          let th, run, switches, policy = 'rr', lastWorker, nextId;  // th: the thread list; run: index of the running thread; switches: count; policy: rr or ui; lastWorker, nextId: bookkeeping
          const svg = s('svg', { viewBox: '0 0 640 300', width: '100%', role: 'img', 'aria-label': 'Threads, thread library and the kernel record for the process' });  // the SVG drawing of process P, its threads, the library and the kernel's record
          const say = h('div', { class: 'say' });  // the explanation box under the controls
          // thread IDs are never reused or renumbered (as in a real library); a new thread takes a free role
          const mk = () => { const n = nextId++, sp0 = 0x7F00 - ((n - 1) % 6) * 0x1000;  // mk(): makes a new thread record with the next id and its own stack top (sp0), spaced apart in memory
            return { id: 'T' + n, role: ROLES.find((r) => !th.some((t) => t.role === r)) || 'worker', pc: 0x1040 + ((n - 1) % 8) * 0x1000, sp0, sp: sp0, runs: 0 }; };  // the record: id, a free role, a starting program counter, stack pointers, and how many times it has run
          function reset() { th = []; nextId = 1; th.push(mk()); th.push(mk()); th.push(mk()); run = 0; switches = 0; lastWorker = 0;  // reset(): starts again with three threads, T1 running, and no switches
            say.innerHTML = '<b>Start.</b> Three threads live in process P. T1 is running; T2 and T3 wait in the library’s ready list. Press <b>yield()</b> a few times, create a thread, then try <b>UI first</b>. Watch the violet kernel row: it never changes.'; draw(); }  // writes the opening instructions, then draws
          function pickNext() {  // pickNext(): decides which thread the library should run next, using the current policy
            const n = th.length;  // n is the number of threads
            if (n === 1) return 0;  // with only one thread, it is always the next one
            if (policy === 'rr') return (run + 1) % n;  // round robin: simply the next thread in the list, wrapping around to the first
            const ui = th.findIndex((t) => t.role === 'UI');  // finds the UI thread, if there still is one
            if (ui < 0) return (run + 1) % n;  // no UI thread left: fall back to round robin
            if (run !== ui) return ui;                         // UI first: always go back to the UI thread
            const others = th.map((t, i) => i).filter((i) => i !== ui);  // others lists every thread except the UI thread
            const k = others.findIndex((i) => i > lastWorker); // then the next worker in turn
            return others[k < 0 ? 0 : k];  // picks that worker, or wraps around to the first worker
          }  // ends pickNext()
          function doYield() {  // doYield(): runs when the student presses yield(); the running thread gives up the processor to another thread
            if (th.length < 2) { say.innerHTML = 'Only one thread is left, so yield() simply returns to it. Create another thread first.'; return; }  // with only one thread there is no one to switch to, so it says so and stops
            const cur = th[run];  // cur is the thread that is yielding
            cur.runs++; cur.pc += 0x28 + 0x08 * (cur.runs % 3); cur.sp = cur.sp0 - ((cur.runs * 0x10) % 0x40);  // pretends it did some work: its program counter moves on and its stack pointer changes a little
            const nx = pickNext();  // asks the library which thread goes next
            if (th[nx].role !== 'UI') lastWorker = nx;  // remembers the last worker picked, so UI-first can rotate through the workers
            switches++;  // counts the thread switch
            say.innerHTML = `<b>${cur.id} called yield()</b>, an ordinary function call into the library. The library saved ${cur.id}’s registers (PC ${hex(cur.pc)}, SP ${hex(cur.sp)}) in ${cur.id}’s slot, picked <b>${th[nx].id}</b> (${policy === 'rr' ? 'round robin: next in line' : 'UI first: the UI thread gets every other turn'}), loaded ${th[nx].id}’s saved registers and jumped into it. No system call was made, so the kernel was never entered: still <b>0 mode switches</b>.`;  // explains that yield() is a plain function call: the library saved and loaded registers, and the kernel was never entered
            run = nx; draw();  // makes the chosen thread the running one and redraws
          }  // ends doYield()
          function doCreate() {  // doCreate(): runs when the student presses thread_create()
            if (th.length >= 4) { say.innerHTML = 'This demo stops at four threads so everything fits on screen. A real library can create many more.'; return; }  // stops at four threads so the drawing fits
            const t = mk(); th.push(t);  // makes a new thread and adds it to the list
            say.innerHTML = `<b>${th[run].id} called thread_create()</b>, a library call. The library carved out a stack for the new thread ${t.id} (${t.role}) inside P’s memory, filled in a context slot (PC ${hex(t.pc)}) and put ${t.id} on its ready list. The kernel’s record for P did not change at all.`;  // explains that the library gave it a stack and a context slot, and the kernel's record did not change
            draw();  // redraws
          }  // ends doCreate()
          function doExit() {  // doExit(): runs when the student presses thread_exit(); the running thread ends
            if (th.length < 2) { say.innerHTML = 'The last thread cannot exit in this demo; if it did, the whole process would end.'; return; }  // the last thread may not exit, because that would end the whole process
            const gone = th[run];  // gone is the thread that is exiting
            th.splice(run, 1); run = run % th.length; lastWorker = 0; switches++;  // removes it, moves on to the next thread in the list, and counts the switch
            if (policy === 'ui') { const ui = th.findIndex((t) => t.role === 'UI'); if (ui >= 0) run = ui; } // UI first: the UI thread gets the freed turn
            say.innerHTML = `<b>${gone.id} (${gone.role}) called thread_exit().</b> The library freed ${gone.id}’s stack and context slot, picked ${th[run].id} and loaded its saved registers. Again, only library code ran: <b>0 mode switches</b>.`;  // explains that the library freed its stack and slot and switched, still without a mode switch
            draw();  // redraws
          }  // ends doExit()
          // geometry: one wide row of threads on desktop; a 2 x 2 grid and stacked library/kernel boxes on phones
          const NW = ctx.narrow;  // NW is true on a phone-width screen
          const L = NW  // L holds the drawing's layout numbers: sizes and positions for process P, the thread boxes, the library box and the kernel box
            ? { W: 360, H: 486, P: [4, 20, 352, 356], T: (i) => [14 + (i % 2) * 170, 50 + Math.floor(i / 2) * 68, 162], LIB: [14, 190, 332, 176], LX: 26, LY: [212, 232, 250, 268], CX: 26, CY: 294, B: 390, K: [4, 416, 352, 64] }  // the phone layout: taller, with threads in a 2-by-2 grid
            : { W: 640, H: 300, P: [8, 20, 624, 196], T: (i) => [22 + i * 152, 48, 140], LIB: [22, 118, 596, 90], LX: 34, LY: [139, 160, 178, 196], CX: 250, CY: 139, B: 228, K: [8, 252, 624, 44] };  // the wide-screen layout: threads in one row
          svg.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);  // sets the drawing's size to match the chosen layout
          function draw() {  // draw(): redraws the diagram from the current thread list; runs after every button press
            const [px, py, pw, ph] = L.P, [lx, ly, lw, lh] = L.LIB, [kx, ky, kw, kh] = L.K;  // unpacks the positions of the process box, the library box and the kernel box
            const kids = [  // kids collects every shape in the drawing
              s('text', { x: px, y: 13, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'USER SPACE · USER MODE'),  // the "USER SPACE · USER MODE" heading
              s('rect', { x: px, y: py, width: pw, height: ph, rx: 12, class: 's-proc', 'stroke-width': 2 }),  // the box for process P
              s('text', { x: px + 14, y: py + 20, 'font-size': 14, 'font-weight': 700, style: 'fill:var(--proc)' }, 'Process P'),  // process P's title
            ];  // ends the starting list of shapes
            th.forEach((t, i) => {  // draws one box per thread
              const [x, y, w] = L.T(i), on = i === run;  // finds its position; on is true for the running thread
              kids.push(s('g', {},  // each thread is one group of shapes
                s('rect', { x, y, width: w, height: 60, rx: 9, class: 's-thread', 'stroke-width': on ? 4 : 1.5, opacity: on ? 1 : 0.8 }),  // the thread's box, with a thicker border when it is running
                s('text', { x: x + 10, y: y + 19, 'font-size': 14.5, 'font-weight': 800 }, `${t.id} · ${t.role}`),  // the thread's id and role
                s('text', { x: x + 10, y: y + 37, 'font-size': 13.5, 'font-weight': on ? 800 : 500, style: on ? 'fill:var(--thread)' : '', class: on ? '' : 's-sub' }, on ? '▶ Running' : 'Ready'),  // its state: Running (in bold pink, with a play arrow) or Ready
                s('text', { x: x + 10, y: y + 53, 'font-size': 13, class: 's-sub s-monot' }, on ? 'on the CPU now' : 'PC ' + hex(t.pc))));  // the last line: "on the CPU now" for the running thread, or its saved program counter
            });  // ends the loop over threads
            kids.push(s('rect', { x: lx, y: ly, width: lw, height: lh, rx: 9, class: 's-accent', 'stroke-width': 1.5 }),  // the thread library's box
              s('text', { x: L.LX, y: L.LY[0], 'font-size': 14.5, 'font-weight': 800 }, 'Thread library'),  // the library's title
              s('text', { x: L.LX, y: L.LY[1], 'font-size': 13.5 }, 'policy: ' + (policy === 'rr' ? 'round robin' : 'UI first')),  // the current scheduling policy
              s('text', { x: L.LX, y: L.LY[2], 'font-size': 13.5 }, 'thread switches: ' + switches),  // how many thread switches the library has made so far
              s('text', { x: L.LX, y: L.LY[3], 'font-size': 13.5 }, 'next pick: ' + (th.length > 1 ? th[pickNext()].id : '(none)')),  // which thread the library would pick next
              s('text', { x: L.CX, y: L.CY, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 'SAVED CONTEXTS (in P’s own memory)'));  // heading for the saved contexts, which live in P's own memory
            th.forEach((t, i) => kids.push(s('text', { x: L.CX, y: L.CY + 18 + i * 15, 'font-size': 13, class: 's-monot', style: i === run ? 'fill:var(--thread)' : '' },  // one line per thread: its saved program counter and stack pointer...
              i === run ? `${t.id}  live in the CPU’s registers` : `${t.id}  PC ${hex(t.pc)}  SP ${hex(t.sp)}`)));  // ...or, for the running thread, a note that its registers are live in the CPU
            kids.push(s('line', { x1: 0, y1: L.B, x2: L.W, y2: L.B, class: 's-line', 'stroke-dasharray': '6 5', 'stroke-width': 1.5 }),  // the dashed line between user space and kernel space
              s('text', { x: kx, y: L.B + 18, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'KERNEL SPACE'),  // the "KERNEL SPACE" heading
              s('rect', { x: kx, y: ky, width: kw, height: kh, rx: 10, class: 's-os', 'stroke-width': 2 }),  // the kernel's box
              s('text', { x: kx + 14, y: ky + 27, 'font-size': 14.5 }, NW ? 'Kernel’s record: P = Running' : 'Kernel’s record: process P = Running · threads it knows of: 0'),  // the kernel's record for P: Running, and it knows of 0 threads (split over two lines on a phone)
              NW ? s('text', { x: kx + 14, y: ky + 51, 'font-size': 14.5 }, 'threads it knows of: 0') : null,  // the second line of that record, used only on a phone
              s('text', { x: kx + kw - 12, y: NW ? ky + 51 : ky + 28, 'text-anchor': 'end', 'font-size': 16, 'font-weight': 800, style: 'fill:var(--ok)' }, 'mode switches: 0'));  // mode switches: always 0, shown in green, because no library call enters the kernel
            svg.replaceChildren(...kids.filter(Boolean));  // swaps in the new drawing, skipping the empty slot used only on phones
          }  // ends draw()
          const pol = ctx.ui.seg([{ value: 'rr', label: 'Round robin' }, { value: 'ui', label: 'UI first' }], 'rr', (v) => {  // the Round robin / UI first switch for the library's policy
            policy = v; lastWorker = 0; draw();  // stores the new policy, restarts the worker rotation and redraws
            say.innerHTML = v === 'rr' ? '<b>Round robin:</b> every thread gets a turn in a fixed circle.' : '<b>UI first:</b> this application wants its screen to feel snappy, so its library hands the UI thread every other turn. The kernel did not have to change, or even know.';  // explains the chosen policy; UI first shows that the app, not the kernel, chooses
          });  // ends the switch
          host.append(  // builds the right-hand card
            h('div', { class: 'row', style: { gap: '8px' } },  // the top row of library-call buttons
              h('span', { class: 'small b' }, 'Running thread calls:'),  // label: these are calls made by the running thread
              h('button', { class: 'btn primary sm', onclick: doYield }, 'yield()'),  // button: yield()
              h('button', { class: 'btn sm thread', onclick: doCreate }, 'thread_create()'),  // button: thread_create()
              h('button', { class: 'btn sm', onclick: doExit }, 'thread_exit()'),  // button: thread_exit()
              h('span', { class: 'grow' }),  // an empty stretchy space that pushes the Reset button to the right
              h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset')),  // Reset button
            svg,  // then the diagram
            h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'small b' }, 'The library’s scheduling policy:'), pol, h('span', { class: 'xs muted' }, 'chosen by the app, not the kernel')),  // then the policy row: label, switch, and a note that the app chooses it
            say);  // then the explanation box
          reset();  // sets up the starting threads and draws them when the step opens
        },  // ends render() for step 2
      },  // ends step 2
      /* ---------------- 3. ULT states vs process states ---------------- */
      {  // step 3 begins: three scenarios comparing the library's thread states with the kernel's process state
        title: 'Thread states vs process states: three scenarios',  // the step title shown at the top of the page
        kind: 'explore',  // the kind of step (explore), shown as a label above the title
        core: true,  // core: true keeps this step on the shorter core route through the guide
        render(el, ctx) {  // render(el, ctx): builds the three state diagrams and the scenario player when step 3 is shown
          const { h, s } = ctx;  // takes the HTML and SVG element builders from the toolbox
          const svg = s('svg', { viewBox: '0 0 1120 316', width: '100%', role: 'img', 'aria-label': 'State diagrams for thread 1, thread 2 and process B' });  // the SVG drawing that holds the three state diagrams side by side
          const NODE = { Running: [165, 32], Ready: [72, 128], Blocked: [258, 128] };  // NODE: where each state box sits inside one diagram
          const ARC = { // transition paths, relative to a diagram's origin
            'Ready>Running': ['M 60 109 Q 64 40 108 30', 'dispatch', 40, 62],  // arrow from Ready to Running, labelled dispatch, with its label position
            'Running>Ready': ['M 146 51 Q 128 96 96 109', 'time-out', 136, 98],  // arrow from Running to Ready, labelled time-out
            'Running>Blocked': ['M 190 51 Q 230 70 250 109', 'wait', 236, 72],  // arrow from Running to Blocked, labelled wait
            'Blocked>Ready': ['M 200 128 L 132 128', 'event', 166, 150],  // arrow from Blocked to Ready, labelled event
          };  // closes the ARC table
          function diagram(ox, oy, title, cur, cls, hot, warn) {  // diagram(): draws one small state diagram at (ox, oy), highlighting the current state and the arrow just taken
            const g = s('g', { transform: `translate(${ox},${oy})` });  // the group is moved to its place in the drawing
            g.append(s('text', { x: 0, y: -6, 'font-size': 15, 'font-weight': 800 }, title));  // the diagram's title, such as "Thread 1" or "Process B"
            for (const [k, [d, lab, lx, ly]] of Object.entries(ARC)) {  // draws each of the four arrows with its label
              const on = hot === k;  // on is true for the arrow just taken
              g.append(s('path', { d, class: on ? '' : 's-muted', fill: 'none', style: on ? 'stroke:var(--accent);stroke-width:3.5' : 'stroke-width:1.6', 'marker-end': on ? 'url(#arr-accent)' : 'url(#arr-muted)' }),  // the arrow: thick and accent-colored when just taken, thin and grey otherwise
                s('text', { x: lx, y: ly, 'text-anchor': 'middle', 'font-size': 12.5, class: on ? '' : 's-sub', style: on ? 'fill:var(--accent);font-weight:800' : '' }, lab));  // the arrow's label, highlighted the same way
            }  // ends the loop over arrows
            for (const [st, [cx, cy]] of Object.entries(NODE)) {  // draws the three state boxes
              const on = st === cur;  // on is true for the current state
              g.append(s('rect', { x: cx - 56, y: cy - 19, width: 112, height: 38, rx: 19, class: on ? cls : 's-panel', 'stroke-width': on ? 3 : 1.2 }),  // the state box: filled in the diagram's color when current, plain otherwise
                s('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': on ? 800 : 500, class: on ? '' : 's-sub' }, st));  // the state's name, bold when current
            }  // ends the loop over states
            if (warn) g.append(s('text', { x: 165, y: 184, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--warn)' }, warn));  // an optional orange warning under the diagram, such as "only on paper"
            return g;  // hands the finished diagram back
          }  // ends diagram()
          const W2 = '“Running” only on paper: B is not on the CPU';  // W2: the warning shown under Thread 2 while the library's "Running" is out of date
          const START = { t1: 'Ready', t2: 'Running', pb: 'Running', cpu: ['B · Thread 2', 'proc'], cap: '<b>Starting point.</b> Process B has two user-level threads, run by a thread library inside B that the kernel knows nothing about. The library’s records say Thread 2 is Running and Thread 1 is Ready. The kernel’s record says B is Running, and the CPU really is executing Thread 2’s code.' };  // START: the shared first frame of every scenario: Thread 2 running, Thread 1 ready, B running
          const SC = {  // SC: the three scenarios, each a list of frames with states, highlighted arrows, what the CPU runs, and a caption
            a: [START,  // scenario a: Thread 2 makes a blocking system call
              { t1: 'Ready', t2: 'Running', pb: 'Running', cpu: ['kernel code (B’s system call)', 'os'], cap: '<b>Thread 2 calls read() on a file.</b> That is a <span class="t">system call</span>: the CPU switches to <span class="t">kernel mode</span> and kernel code takes over on B’s behalf.' },  // frame: read() is a system call, so kernel code runs on B's behalf
              { t1: 'Ready', t2: 'Running', pb: 'Blocked', hot: { pb: 'Running>Blocked' }, w2: W2, cpu: ['Process A (someone else)', 'panel'], cap: '<b>The kernel starts the disk transfer</b> and, because B must wait for it, moves B to Blocked and runs another process. The library’s table still says Thread 2 is Running: no library code ran, so nothing updated it.' },  // frame: the kernel blocks all of B, yet the library still says Thread 2 is Running
              { t1: 'Ready', t2: 'Running', pb: 'Blocked', w2: W2, w1: 'Ready and able to work, but stuck', cpu: ['Process A (someone else)', 'panel'], cap: '<b>Thread 1 could do useful work right now</b>, but the kernel has never heard of it. One thread’s <span class="t">blocking system call</span> has frozen the whole process. This is the best-known weakness of ULTs.' },  // frame: Thread 1 could work but is stuck, because the kernel does not know it exists
              { t1: 'Ready', t2: 'Running', pb: 'Ready', hot: { pb: 'Blocked>Ready' }, w2: W2, cpu: ['Process A (someone else)', 'panel'], cap: '<b>The disk finishes</b> and interrupts. The kernel moves B from Blocked to Ready. B still has to wait for its turn on the CPU.' },  // frame: the disk finishes and B becomes Ready
              { t1: 'Ready', t2: 'Running', pb: 'Running', hot: { pb: 'Ready>Running' }, cpu: ['B · Thread 2', 'proc'], cap: '<b>The kernel dispatches B.</b> Execution resumes exactly where it stopped: inside Thread 2, just after its read() call. The library’s “Running” matches reality again.' }],  // frame: the kernel dispatches B and Thread 2 resumes after its read; ends scenario a
            b: [START,  // scenario b: B's time slice runs out
              { t1: 'Ready', t2: 'Running', pb: 'Running', cpu: ['kernel code (clock interrupt)', 'intr'], cap: '<b>A <span class="t">clock interrupt</span> fires.</b> Control jumps to the kernel, which finds that B has used up its <span class="t">time slice</span>.' },  // frame: a clock interrupt hands control to the kernel
              { t1: 'Ready', t2: 'Running', pb: 'Ready', hot: { pb: 'Running>Ready' }, w2: W2, cpu: ['Process A (someone else)', 'panel'], cap: '<b>The kernel moves B to Ready</b> and dispatches another process. The library’s table still shows Thread 2 Running. Nothing inside B can react, because none of B’s code (library included) is executing.' },  // frame: the kernel moves B to Ready; nothing inside B can react
              { t1: 'Ready', t2: 'Running', pb: 'Running', hot: { pb: 'Ready>Running' }, cpu: ['B · Thread 2', 'proc'], cap: '<b>Later the kernel dispatches B again</b>, and it picks up inside Thread 2 exactly where the clock interrupted it. As far as the library knows, Thread 2 never stopped running.' }],  // frame: B is dispatched again and Thread 2 carries on as if it never stopped; ends scenario b
            c: [START,  // scenario c: one thread waits for another inside the library
              { t1: 'Ready', t2: 'Running', pb: 'Running', cpu: ['B · library code', 'proc'], cap: '<b>Thread 2 needs Thread 1 to finish something first</b> (say, fill a buffer). It calls a library routine to wait. That is a plain function call, not a system call.' },  // frame: Thread 2 calls a library routine to wait, a plain function call
              { t1: 'Ready', t2: 'Blocked', pb: 'Running', hot: { t2: 'Running>Blocked' }, cpu: ['B · library code', 'proc'], cap: '<b>The library marks Thread 2 Blocked</b> and saves Thread 2’s context in its slot, all in user mode.' },  // frame: the library marks Thread 2 Blocked and saves its context, all in user mode
              { t1: 'Running', t2: 'Blocked', pb: 'Running', hot: { t1: 'Ready>Running' }, cpu: ['B · Thread 1', 'proc'], cap: '<b>The library loads Thread 1’s context</b>, so Thread 1 is now Running. Process B stayed Running the whole time: the kernel only saw B executing instructions.' },  // frame: the library runs Thread 1; B stays Running throughout
              { t1: 'Running', t2: 'Ready', pb: 'Running', hot: { t2: 'Blocked>Ready' }, cpu: ['B · Thread 1', 'proc'], cap: '<b>Thread 1 produces what Thread 2 was waiting for</b> and tells the library, which moves Thread 2 back to Ready. Every change here happened inside the process; B never left Running.' }],  // frame: Thread 1 provides what Thread 2 needed, so Thread 2 is Ready again; ends scenario c
          };  // closes the SC table
          let sc = 'a';  // sc is the scenario being shown (a, b or c)
          const NW = ctx.narrow;  // NW is true on a phone-width screen
          if (NW) svg.setAttribute('viewBox', '0 0 380 806');  // on a phone the drawing is tall enough to stack the three diagrams
          function drawNarrow(f, hot) { // phones: stack the three diagrams vertically so the text stays readable
            svg.replaceChildren(  // replaces the whole drawing with the stacked phone layout for frame f
              s('rect', { x: 0, y: 0, width: 380, height: 476, rx: 12, class: 's-accent', 'stroke-width': 1.5 }),  // the pale box that holds the two thread diagrams
              s('text', { x: 14, y: 22, 'font-size': 13, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, 'THREAD LIBRARY’S RECORDS'),  // its heading: the thread library's records
              diagram(25, 62, 'Thread 1', f.t1, 's-thread', hot.t1, f.w1),  // diagram for Thread 1
              diagram(25, 282, 'Thread 2', f.t2, 's-thread', hot.t2, f.w2),  // diagram for Thread 2
              s('rect', { x: 0, y: 492, width: 380, height: 222, rx: 12, class: 's-os', 'stroke-width': 1.5 }),  // the box that holds the kernel's record
              s('text', { x: 14, y: 514, 'font-size': 13, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, 'KERNEL’S RECORD'),  // its heading: the kernel's record
              diagram(25, 552, 'Process B', f.pb, 's-proc', hot.pb, null),  // diagram for process B
              s('rect', { x: 0, y: 730, width: 380, height: 72, rx: 10, class: 's-panel', 'stroke-width': 1.2 }),  // a box at the bottom showing what the CPU is doing
              s('text', { x: 14, y: 752, 'font-size': 14, 'font-weight': 700 }, 'The CPU is executing:'),  // its label: "The CPU is executing:"
              s('rect', { x: 14, y: 762, width: 352, height: 30, rx: 15, class: 's-' + f.cpu[1], 'stroke-width': 2 }),  // a pill-shaped box colored by what the CPU is running (B, the kernel, an interrupt, or another process)
              s('text', { x: 190, y: 782, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800 }, f.cpu[0]));  // the name of what the CPU is running
          }  // ends the phone layout function
          function draw(f) {  // draw(f): redraws the three diagrams for one frame of the current scenario
            const hot = f.hot || {};  // hot names the arrow to highlight in each diagram, if any
            if (NW) return drawNarrow(f, hot);  // on a phone, hands the frame to the stacked phone layout above instead
            svg.replaceChildren(  // replaces the drawing with the wide layout
              s('rect', { x: 0, y: 0, width: 716, height: 254, rx: 12, class: 's-accent', 'stroke-width': 1.5 }),  // the pale box on the left that holds the two thread diagrams
              s('text', { x: 14, y: 22, 'font-size': 13, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, 'THREAD LIBRARY’S RECORDS · USER SPACE'),  // its heading: the library's records, in user space
              diagram(30, 56, 'Thread 1', f.t1, 's-thread', hot.t1, f.w1),  // diagram for Thread 1
              diagram(380, 56, 'Thread 2', f.t2, 's-thread', hot.t2, f.w2),  // diagram for Thread 2
              s('rect', { x: 736, y: 0, width: 384, height: 254, rx: 12, class: 's-os', 'stroke-width': 1.5 }),  // the box on the right that holds the kernel's record
              s('text', { x: 750, y: 22, 'font-size': 13, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, 'KERNEL’S RECORD · KERNEL SPACE'),  // its heading: the kernel's record, in kernel space
              diagram(768, 56, 'Process B', f.pb, 's-proc', hot.pb, null),  // diagram for process B
              s('rect', { x: 0, y: 268, width: 1120, height: 46, rx: 10, class: 's-panel', 'stroke-width': 1.2 }),  // a strip across the bottom showing what the CPU is doing
              s('text', { x: 18, y: 297, 'font-size': 15, 'font-weight': 700 }, 'The CPU is executing:'),  // its label: "The CPU is executing:"
              s('rect', { x: 196, y: 277, width: 380, height: 28, rx: 14, class: 's-' + f.cpu[1], 'stroke-width': 2 }),  // a pill-shaped box colored by what the CPU is running
              s('text', { x: 386, y: 296, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800 }, f.cpu[0]),  // the name of what the CPU is running
              s('text', { x: 1104, y: 297, 'text-anchor': 'end', 'font-size': 13.5, class: 's-sub' }, sc === 'c' ? 'no mode switch needed for any of this' : 'the kernel acts; the library cannot'));  // a note at the right: scenario c needs no mode switch; in a and b only the kernel can act
          }  // ends draw()
          const player = ctx.ui.player({ count: SC.a.length, interval: 2600, render: (i) => { const f = SC[sc][i]; draw(f); return f.cap; } });  // the player that steps through the scenario's frames; each step draws the frame and returns its caption
          const seg = ctx.ui.seg([{ value: 'a', label: 'a) Thread 2 makes a blocking call' }, { value: 'b', label: 'b) B’s time slice runs out' }, { value: 'c', label: 'c) Thread 2 waits for Thread 1' }], 'a', (v) => { sc = v; player.setCount(SC[v].length); });  // the scenario switch (a, b or c); choosing one resets the player to that scenario's number of frames
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the page: everything stacked to fill the step
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('span', { class: 'small muted' }, 'Pick a scenario, then step through it.')),  // top row: the scenario switch and a hint to step through it
            h('div', { class: 'card white grow', style: { display: 'grid', placeItems: 'center', padding: '12px' } }, svg),  // the white card holding the diagrams, centered and stretched to fill the space
            player.el));  // then the player controls and caption
        },  // ends render() for step 3
      },  // ends step 3
      /* ---------------- 4. KLTs and the cost of a thread switch ---------------- */
      {  // step 4 begins: kernel-level threads and what a thread switch costs
        title: 'Kernel-level threads: the kernel knows every thread',  // the step title shown at the top of the page
        kind: 'compare',  // the kind of step (compare), shown as a label above the title
        html: `${/* html: the fixed page content for step 4 */''}
          <div class="split l fill">${/* two-column layout: explanation on the left, the switch animation on the right */''}
            <div class="stack" style="gap:10px">${/* the left column stacks its blocks with a small gap */''}
              <p class="lead m0">With <span class="t">KLTs</span>, the application contains no thread-management code at all. It asks the kernel for threads through system calls, and the kernel does the rest.</p>${/* opening paragraph: with KLTs the application asks the kernel for threads */''}
              <p class="m0">The kernel keeps one record for the process <b>and</b> a separate saved context for each of its threads, and its scheduler chooses among <b>threads</b>, not whole processes. Windows and Linux both work this way.</p>${/* paragraph: the kernel keeps a record per thread and schedules threads; Windows and Linux work this way */''}
              <div class="card tight stack" style="gap:6px">${/* a card of pros and cons begins */''}
                <div class="small"><span class="chip ok">✓</span> Threads of one process can run at the same moment on different processors of a <span class="t">multiprocessor</span>.</div>${/* pro: threads of one process can run at once on a multiprocessor */''}
                <div class="small"><span class="chip ok">✓</span> If one thread blocks, the kernel can run another thread of the same process.</div>${/* pro: if one thread blocks, another thread of the process can run */''}
                <div class="small"><span class="chip ok">✓</span> The kernel’s own routines can themselves be multithreaded.</div>${/* pro: the kernel's own routines can be multithreaded */''}
                <div class="small"><span class="chip bad">✗</span> Passing control between two threads of the <b>same</b> process needs a <span class="t">mode switch</span> into the kernel and another one back out.</div>${/* con: switching between threads of the same process needs two mode switches */''}
              </div>${/* ends the pros and cons card */''}
              <div class="callout warn m0 small" data-label="Common mistake">“The kernel runs them, so KLT switches must be faster.” No: the kernel does the same save-pick-load work plus two mode switches. KLTs win on blocking and parallelism, not on switch speed.</div>${/* common-mistake box: KLT switches are not faster; they add two mode switches */''}
            </div>${/* ends the left column */''}
            <div class="card white stack sec-4-2-s4" style="gap:10px"></div>${/* the empty card on the right where render() builds the animation */''}
          </div>`,  // ends the layout and the HTML text
        render(el, ctx) {  // render(el, ctx): builds the side-by-side thread-switch animation when step 4 is shown
          const { h, s } = ctx;  // takes the HTML and SVG element builders from the toolbox
          const host = ctx.$('.sec-4-2-s4');  // host is the right-hand card
          const svg = s('svg', { viewBox: '0 0 640 318', width: '100%', role: 'img', 'aria-label': 'Path of a thread switch for user-level and kernel-level threads' });  // the drawing with two lanes: the ULT switch on top, the KLT switch below
          const FR = [  // FR: the animation frames; u and k are how far each lane has got, cap is the caption
            { u: 0, k: 0, cap: '<b>Same job, two designs.</b> In both programs Thread 1 is running and is about to hand the CPU to Thread 2. Watch where the switching work happens.' },  // frame 1: both programs are about to switch from Thread 1 to Thread 2
            { u: 1, k: 1, cap: '<b>Going in.</b> The ULT program calls its library: an ordinary function call, still in user mode. In the KLT program only the kernel can switch threads, so control must enter kernel mode (here through a system call such as yield; a blocking call or a clock interrupt gets there the same way): <b>mode switch 1</b>.' },  // frame 2: the ULT program calls its library; the KLT program must enter the kernel (mode switch 1)
            { u: 2, k: 2, cap: '<b>Same bookkeeping on both sides:</b> save Thread 1’s registers, choose Thread 2, load Thread 2’s registers. The library keeps its records in the process’s memory; the kernel keeps one record for the process and one for each thread.' },  // frame 3: both do the same save, pick and load work
            { u: 3, k: 3, cap: '<b>Coming out.</b> The library simply jumps into Thread 2. The kernel must first return to user mode (<b>mode switch 2</b>) before Thread 2 can run.' },  // frame 4: the library jumps into Thread 2; the kernel must first return to user mode (mode switch 2)
            { u: 3, k: 3, fin: true, cap: '<b>Result:</b> the KLT switch paid for two trips across the user/kernel boundary that the ULT switch never made. That is the price of the kernel knowing, scheduling and spreading every thread.' },  // frame 5: the result, two extra boundary crossings for the KLT switch
          ];  // closes the frame list
          // geometry: wide lanes on desktop; tighter lanes with two-line middle boxes on phones
          const NW = ctx.narrow;  // NW is true on a phone-width screen
          const G = NW ? { W: 360, H: 332, t1: 4, t2: 276, sw: 80, mx: 116, mw: 128, uY: 22, uH: 58, bY: 85, kY: 90, kH: 58, uc: 51, kc: 119, sh: 36, mh: 44, fs: 14, lane2: 182 }  // G holds the layout numbers for the phone version: sizes, box positions and lane heights
            : { W: 640, H: 318, t1: 70, t2: 520, sw: 90, mx: 230, mw: 220, uY: 24, uH: 52, bY: 81, kY: 86, kH: 52, uc: 50, kc: 112, sh: 34, mh: 34, fs: 15, lane2: 170 };  // the same layout numbers for wide screens
          svg.setAttribute('viewBox', `0 0 ${G.W} ${G.H}`);  // sets the drawing's size to match the chosen layout
          function lane(y0, title, klt, stage) {  // lane(): draws one lane (ULT or KLT) as it looks at a given stage of the animation
            const ms = klt ? (stage >= 3 ? 2 : stage >= 1 ? 1 : 0) : 0;  // ms counts the mode switches so far: none for ULTs; for KLTs one after stage 1 and two after stage 3
            const on = (n) => stage >= n;  // on(n): true once the animation has reached stage n
            const yu = y0 + G.uc, yk = y0 + G.kc, yb = y0 + G.bY;  // the vertical centers of the user row and kernel row, and the boundary line between them
            const g = [  // g collects the lane's shapes
              s('text', { x: 0, y: y0 + 14, 'font-size': G.fs, 'font-weight': 800 }, title),  // the lane's title
              s('text', { x: G.W, y: y0 + 14, 'text-anchor': 'end', 'font-size': G.fs, 'font-weight': 800, style: ms ? 'fill:var(--bad)' : 'fill:var(--ok)' }, 'mode switches: ' + ms),  // the mode-switch count at the right: green when 0, red otherwise
              s('rect', { x: 0, y: y0 + G.uY, width: G.W, height: G.uH, rx: 8, class: 's-panel', 'stroke-width': 1 }),  // the user-mode row
              s('line', { x1: 0, y1: yb, x2: G.W, y2: yb, class: 's-line', 'stroke-dasharray': '5 5', 'stroke-width': 1.2 }),  // the dashed boundary between user mode and kernel mode
              s('rect', { x: 0, y: y0 + G.kY, width: G.W, height: G.kH, rx: 8, class: 's-os', 'stroke-width': 1 }),  // the kernel-mode row
            ];  // ends the list of lane shapes
            if (!NW) g.push(s('text', { x: 10, y: yu + 4, 'font-size': 12.5, 'font-weight': 800, class: 's-sub' }, 'USER'),  // on a wide screen, labels the rows USER...
              s('text', { x: 10, y: yk + 4, 'font-size': 12.5, 'font-weight': 800, class: 's-sub' }, 'KERNEL'),  // ...and KERNEL...
              s('text', { x: G.W - 8, y: y0 + G.kY + G.kH - 7, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, klt ? 'records kept: P, T1, T2, T3' : 'records kept: P only (not involved)'));  // ...and says which records the kernel keeps in this design
            const box = (x, cy, w, hh, lines, cls, lit) => {  // box(): draws a rounded box with one or two centered lines of text; lit boxes get a thicker border
              g.push(s('rect', { x, y: cy - hh / 2, width: w, height: hh, rx: 8, class: cls, 'stroke-width': lit ? 3 : 1.4 }));  // the box itself
              lines.forEach((ln, j) => g.push(s('text', { x: x + w / 2, y: cy + 5 + (j - (lines.length - 1) / 2) * 17, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, ln)));  // each line of text, spaced so the lines stay centered as a group
            };  // ends box()
            const who = klt ? 'kernel' : 'library';  // who does the switching: the kernel for KLTs, the library for ULTs
            box(G.t1, yu, G.sw, G.sh, ['Thread 1'], 's-thread', stage === 0);  // Thread 1's box, highlighted at the start
            box(G.t2, yu, G.sw, G.sh, ['Thread 2'], 's-thread', stage >= 3);  // Thread 2's box, highlighted once it is running
            box(G.mx, klt ? yk : yu, G.mw, G.mh, NW ? [who + ':', 'save · pick · load'] : [who + ': save · pick · load'], klt ? 's-os' : 's-accent', stage === 2);  // the middle box doing save, pick and load: in the kernel row for KLTs, in the user row for ULTs
            const arrow = (d, lit) => g.push(s('path', { d, fill: 'none', class: lit ? '' : 's-muted', style: lit ? 'stroke:var(--accent);stroke-width:3' : 'stroke-width:1.5', 'marker-end': lit ? 'url(#arr-accent)' : 'url(#arr-muted)' }));  // arrow(): draws one arrow, accent-colored when lit and grey otherwise
            const x1 = G.t1 + G.sw, x2 = G.mx - 2, x3 = G.mx + G.mw, x4 = G.t2 - 2;  // the x positions where the arrows start and end, between the three boxes
            if (klt) {  // KLT lane: the arrows must dip into the kernel row and come back
              const d = (x2 - x1) / 2;  // d controls how much each arrow curves
              arrow(`M ${x1} ${yu} C ${x1 + d} ${yu}, ${x2 - d} ${yk}, ${x2} ${yk}`, on(1));  // the curved arrow from Thread 1 down into the kernel, lit from stage 1
              arrow(`M ${x3} ${yk} C ${x3 + d} ${yk}, ${x4 - d} ${yu}, ${x4} ${yu}`, on(3));  // the curved arrow from the kernel back up to Thread 2, lit from stage 3
              [[(x1 + x2) / 2, 1], [(x3 + x4) / 2, 3]].forEach(([x, n]) => {  // a marker where each arrow crosses the boundary, once that stage is reached
                if (!on(n)) return;  // skips a crossing that has not happened yet
                const lab = 'mode switch ' + (n === 1 ? 1 : 2), st = 'fill:var(--intr)';  // its label, "mode switch 1" or "mode switch 2", in the interrupt color
                g.push(s('rect', { x: x - 7, y: yb - 7, width: 14, height: 14, rx: 2, transform: `rotate(45 ${x} ${yb})`, class: 's-intr', 'stroke-width': 2 }),  // a small diamond on the boundary line marks the crossing
                  NW ? s('text', { x: n === 1 ? 8 : G.W - 8, y: y0 + G.kY + G.kH - 8, 'text-anchor': n === 1 ? 'start' : 'end', 'font-size': 12.5, 'font-weight': 800, style: st }, lab)  // on a phone the label goes in a corner of the kernel row
                    : s('text', { x: n === 1 ? x + 10 : x - 10, y: yb - 12, 'text-anchor': n === 1 ? 'start' : 'end', 'font-size': 12.5, 'font-weight': 800, style: st }, lab));  // on a wide screen it sits beside the diamond
              });  // ends the loop over crossings
            } else {  // ULT lane: the arrows stay in the user row
              arrow(`M ${x1} ${yu} L ${x2} ${yu}`, on(1));  // a straight arrow from Thread 1 to the library, lit from stage 1
              arrow(`M ${x3} ${yu} L ${x4} ${yu}`, on(3));  // a straight arrow from the library to Thread 2, lit from stage 3
            }  // ends the KLT/ULT choice of arrows
            return g;  // hands the lane's shapes back
          }  // ends lane()
          function draw(i) {  // draw(i): redraws both lanes for frame i of the animation
            const f = FR[i];  // f is the frame's data
            const kids = [...lane(0, NW ? 'ULT: Thread 1 → Thread 2' : 'ULT: switch from Thread 1 to Thread 2', false, f.u), ...lane(G.lane2, NW ? 'KLT: Thread 1 → Thread 2' : 'KLT: switch from Thread 1 to Thread 2', true, f.k)];  // draws the ULT lane on top and the KLT lane below it, with shorter titles on a phone
            if (f.fin) {  // on the final frame, a summary banner is added between the lanes
              const px = NW ? 20 : 150, pw = NW ? 320 : 340, py = NW ? 155 : 146;  // the banner's position and width depend on the screen width
              kids.push(s('rect', { x: px, y: py, width: pw, height: 22, rx: 11, class: 's-warn', 'stroke-width': 1.5 }), s('text', { x: px + pw / 2, y: py + 16, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, 'difference: 2 mode switches per thread switch'));  // the banner: 2 mode switches of difference per thread switch
            }  // ends the final-frame banner
            svg.replaceChildren(...kids.filter(Boolean));  // swaps in the new drawing
          }  // ends draw()
          const player = ctx.ui.player({ count: FR.length, interval: 2400, captionBelow: true, render: (i) => { draw(i); return FR[i].cap; } });  // the player for the animation, with the caption shown below the controls
          host.append(svg, player.el, h('div', { class: 'xs muted' }, '◆ marks a mode switch: the CPU crossing the dashed line between user mode and kernel mode. Each crossing costs time.'));  // places the drawing, the player and a note explaining the diamond marker into the card
        },  // ends render() for step 4
      },  // ends step 4
      /* ---------------- 5. Side-by-side simulator: blocking and a second core ---------------- */
      {  // step 5 begins: a lab that runs the same program as ULTs and as KLTs, side by side
        title: 'Side by side: one blocking call, one extra core',  // the step title shown at the top of the page
        kind: 'lab',  // the kind of step (lab), shown as a label above the title
        core: true,  // core: true keeps this step on the shorter core route through the guide
        render(el, ctx) {  // render(el, ctx): builds the two timelines, the controls and the scoreboard when step 5 is shown
          const { h, s } = ctx;  // takes the HTML and SVG element builders from the toolbox
          let cores = 1, block = true, U, K, N;  // cores: 1 or 2; block: whether T2 makes a disk read; U and K: the two simulation results; N: the longer run's length
          const mkPanel = (title, sub) => {  // mkPanel(): builds one timeline card with a title, a subtitle, a status chip and an empty drawing
            const chip = h('span', { class: 'chip' });  // the status chip at the top right (not started, tick n, or done)
            const svg = s('svg', { viewBox: '0 0 540 206', width: '100%', role: 'img', 'aria-label': title + ' timeline' });  // the timeline drawing
            const card = h('div', { class: 'card white stack', style: { gap: '6px', padding: '10px 14px' } },  // the card itself
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', {}, h('b', {}, title), h('span', { class: 'xs muted' }, '  ' + sub)), chip), svg);  // its header row: the title and subtitle on the left, the chip on the right
            return { chip, svg, card };  // hands back the parts that gantt() will update
          };  // ends mkPanel()
          const PU = mkPanel('User-level threads', 'kernel schedules process P'), PK = mkPanel('Kernel-level threads', 'kernel schedules T1, T2, T3');  // PU is the user-level card and PK the kernel-level card
          const FS = ctx.narrow ? 1.4 : 1, X0 = ctx.narrow ? 84 : 64, ROWY = [22, 60, 98], RH = 32;  // FS scales the text up on a phone; X0 is where the tick columns start; ROWY and RH place the three rows
          if (ctx.narrow) { PU.svg.setAttribute('viewBox', '0 0 540 216'); PK.svg.setAttribute('viewBox', '0 0 540 216'); }  // on a phone both drawings get a little extra height for the larger text
          const COL = { Running: 'var(--thread)', Blocked: 'var(--intr)', Ready: 'var(--ink-2)', Done: 'var(--muted)' };  // COL: the text color for each state in the status lines
          function statusLine(y, label, items) {  // statusLine(): builds one line of text such as "Kernel sees: P Blocked", coloring each state
            const t = s('text', { x: 0, y: ctx.narrow ? y + (y > 170 ? 16 : 8) : y, 'font-size': 13.5 * FS }, s('tspan', { 'font-weight': 800 }, label + '  '));  // the line starts with its bold label
            items.forEach(([name, state], i) => t.append(s('tspan', { style: `fill:${COL[state] || 'var(--ink)'}`, 'font-weight': state === 'Running' || state === 'Blocked' ? 800 : 500 }, (i ? '  ·  ' : '') + name + ' ' + state)));  // adds each name and state, colored by state and bold when Running or Blocked
            return t;  // hands back the line
          }  // ends statusLine()
          function gantt(P, sim, kind, k) {  // gantt(P, sim, kind, k): draws panel P's timeline (a Gantt chart) showing the first k ticks of simulation sim
            const cw = (540 - X0 - 2) / N;  // cw is the width of one tick column
            const kids = [s('text', { x: 0, y: 14, 'font-size': 12.5 * FS, class: 's-sub' }, 'tick')];  // kids starts with the "tick" label above the columns
            const every = ctx.narrow ? (N > 8 ? 4 : 2) : N > 12 ? 2 : 1;  // every: how often to number the ticks so the numbers do not crowd
            for (let i = 0; i < N; i++) if (i % every === 0) kids.push(s('text', { x: X0 + i * cw + cw / 2, y: 14, 'text-anchor': 'middle', 'font-size': 12.5 * FS, class: 's-sub' }, String(i)));  // numbers the tick columns along the top
            ['Core 1', 'Core 2', 'Disk'].forEach((lab, r) => kids.push(  // draws the three rows: Core 1, Core 2 and Disk
              s('rect', { x: X0, y: ROWY[r], width: N * cw, height: RH, rx: 6, class: 's-panel', 'stroke-width': 0.8 }),  // each row's background bar
              s('text', { x: 0, y: ROWY[r] + 22, 'font-size': 14 * FS, 'font-weight': 700, class: r === 1 && cores === 1 ? 's-sub' : '' }, lab)));  // each row's label; Core 2's label is greyed out on a one-core machine
            if (cores === 1) kids.push(s('text', { x: X0 + N * cw / 2, y: ROWY[1] + 22, 'text-anchor': 'middle', 'font-size': 13.5 * FS, class: 's-sub' }, '(only one core)'));  // on a one-core machine, Core 2's row says "(only one core)"
            if (k > 0 && k <= sim.end) kids.push(s('rect', { x: X0 + (k - 1) * cw, y: 16, width: cw, height: 118, rx: 4, class: 's-accent', 'stroke-width': 1.5, opacity: 0.55 }));  // a pale highlight over the tick just played
            const shown = sim.ticks.slice(0, Math.min(k, sim.end));  // shown holds the tick records played so far
            const rowVal = (r, rec) => (r === 2 ? rec.io : rec.cores[r]);  // rowVal(): what a row holds in one tick: the disk's reader, or the thread or status on that core
            for (let r = 0; r < 3; r++) {  // draws each row
              let i = 0;  // i walks along the ticks played so far
              while (i < shown.length) {  // until the end of the row
                const v = rowVal(r, shown[i]);  // v is what this row held at tick i
                let j = i + 1;  // j will be the first tick after the run of equal values
                while (j < shown.length && rowVal(r, shown[j]) === v && !(r < 2 && /^T\d$/.test(v || ''))) j++;  // joins neighbouring ticks with the same value into one bar, but keeps each thread's tick on a core separate
                const x = X0 + i * cw + 1.5, w = (j - i) * cw - 3, y = ROWY[r] + 2, hh = RH - 4;  // the bar's position and size
                const lab = (txt, min) => (w >= min * FS ? s('text', { x: x + w / 2, y: y + 19 + (FS - 1) * 8, 'text-anchor': 'middle', 'font-size': 13 * FS, 'font-weight': 700 }, txt) : null);  // lab(): the bar's label, drawn only if the bar is at least min units wide
                if (v && /^T\d$/.test(v) && r < 2) kids.push(s('rect', { x, y, width: w, height: hh, rx: 5, style: `fill:${TBG[v]};stroke:${TINT[v]};stroke-width:2` }), lab(v, 18));  // a thread running on a core: a box in that thread's own tint, labelled with its name
                else if (v === 'blocked') kids.push(s('rect', { x, y, width: w, height: hh, rx: 5, class: 's-bad', 'stroke-width': 2 }), lab('P blocked', 74) || lab('×', 10));  // process P blocked: a red box labelled "P blocked", or an x if the bar is short
                else if (v === 'unusable') kids.push(s('rect', { x, y, width: w, height: hh, rx: 5, class: 's-muted', 'stroke-dasharray': '4 4', 'stroke-width': 1.5 }), w >= 200 ? s('text', { x: x + w / 2, y: y + 19, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'unused: P gets one core at a time') : null);  // the unusable second core on the ULT side: a dashed grey box, with a note when there is room
                else if (v === 'idle') kids.push(s('rect', { x, y, width: w, height: hh, rx: 5, class: 's-muted', 'stroke-width': 1.5 }), w >= 36 ? s('text', { x: x + w / 2, y: y + 19, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'idle') : null);  // an idle core: a grey box labelled idle when there is room
                else if (r === 2 && v) kids.push(s('rect', { x, y, width: w, height: hh, rx: 5, class: 's-io', 'stroke-width': 2 }), lab(v + ' read', 60) || lab(v, 18));  // the disk busy with a read: an I/O-colored box naming the reader
                i = j;  // moves on to the next run of values
              }  // ends the walk along the row
            }  // ends the loop over rows
            const done = k >= sim.end, rec = k > 0 && !done ? sim.ticks[k - 1] : null;  // done: this side has finished; rec: the record of the tick just played
            const stOf = (fn) => (done ? 'Done' : rec ? fn(rec) : 'Ready');  // stOf(): picks a thread's state for the status lines: Done at the end, Ready before the start
            if (kind === 'ult') {  // ULT side: two status lines
              kids.push(statusLine(160, 'Kernel sees:', [['P', stOf((r) => r.kern)]]),  // what the kernel sees: only P, with its state
                statusLine(186, 'Library says:', NAMES.map((n) => [n, stOf((r) => r.lib[n])])));  // what the library says about each of the three threads
            } else {  // KLT side: one status line and a note
              kids.push(statusLine(160, 'Kernel sees:', NAMES.map((n) => [n, stOf((r) => r.kst[n])])),  // what the kernel sees: each thread; then a note that there is no library table
                s('text', { x: 0, y: ctx.narrow ? 202 : 186, 'font-size': 13.5 * FS, class: 's-sub' }, ctx.narrow ? 'No library: the kernel tracks each thread.' : 'No library table: the kernel tracks every thread itself.'));  // the note's text, shorter on a phone
            }  // ends the ULT/KLT choice
            P.svg.replaceChildren(...kids.filter(Boolean));  // swaps in the new drawing
            const fin = k >= sim.end;  // fin is true once this side has finished
            P.chip.className = 'chip ' + (fin ? (sim.end <= Math.min(U.end, K.end) ? 'ok' : 'warn') : '');  // the chip turns green for the faster side (or a tie) and orange for the slower one
            P.chip.textContent = fin ? `done after ${sim.end} ticks` : k ? `tick ${k - 1}` : 'not started';  // the chip's text: done after n ticks, the current tick, or not started
          }  // ends gantt()
          function summary() {  // summary(): the closing text after both sides have finished
            const parts = [`<b>Finished.</b> ULT: ${U.end} ticks. KLT: ${K.end} ticks.`];  // starts with both finish times
            if (block) parts.push(`On the ULT side, process P sat blocked for ${IO_TICKS} ticks while T1 and T3 were ready: one thread’s read stopped them all.`);  // with blocking: the ULT process sat blocked while two threads were ready
            if (cores === 2) parts.push('The ULT side never touched core 2, because the kernel gives a process one processor at a time; the KLT side ran two threads at once.');  // with two cores: the ULT side never used core 2, while the KLT side ran two threads at once
            if (!block && cores === 1) parts.push('A tie: with one core and no blocking, both designs keep the core busy. (In reality the ULT version would edge ahead, since its switches never enter the kernel.)');  // with one core and no blocking: a tie, though real ULTs would be slightly faster
            return parts.join(' ');  // joins the sentences into one caption
          }  // ends summary()
          U = simulate('ult', cores, block); K = simulate('klt', cores, block); N = Math.max(U.end, K.end);  // runs both simulations for the starting settings; N is the longer of the two runs
          const player = ctx.ui.player({ count: N + 1, interval: 900, render: (k) => {  // the player: one step per tick, plus a starting step
            gantt(PU, U, 'ult', k); gantt(PK, K, 'klt', k);  // each step redraws both timelines up to tick k
            if (k === 0) return `<b>Ready.</b> Both sides run the same three threads, which take turns one tick at a time (on the ULT side each thread calls yield() after every tick); each needs 4 ticks of CPU. ${block ? `T2 computes for 1 tick, then reads from the disk for ${IO_TICKS} ticks, then computes 3 more.` : 'No thread blocks.'} <b>Predict:</b> which side finishes first, and by how much?`;  // step 0: explains the setup and asks the student to predict which side finishes first
            const t = k - 1;  // t is the tick just played
            const say = (sim) => (t < sim.end ? sim.ticks[t].ev.join(' ') : `Already finished after ${sim.end} ticks.`);  // say(): that side's event text for tick t, or a note that it already finished
            const line = `<b>Tick ${t}.</b> ULT: ${say(U)}<br>KLT: ${say(K)}`;  // the caption for this tick: what happened on each side
            if (k === N) { seen[cores + '-' + block] = [U.end, K.end]; board(); return summary(); }  // on the last step, records the result in the scoreboard, redraws it and shows the summary
            return line;  // otherwise shows the tick's events
          } });  // ends the player settings
          const seen = {};  // seen records the finish times for each set-up the student has run to the end, keyed like "1-true"
          const boardEl = h('div', { class: 'grid-4', style: { gap: '8px' } });  // the scoreboard: four small cards, one per set-up
          function board() {  // board(): redraws the scoreboard from what has been recorded so far
            boardEl.replaceChildren(...[[1, true], [1, false], [2, true], [2, false]].map(([c, b]) => {  // one card for each set-up: 1 or 2 cores, with or without T2's disk read
              const r = seen[c + '-' + b], on = c === cores && b === block;  // r is the recorded result, if any; on is true for the set-up currently selected
              return h('div', { class: 'card tight', style: { padding: '6px 10px', borderColor: on ? 'var(--chc)' : '' } },  // each card gets an accent border when it matches the current settings
                h('div', { class: 'xs muted b' }, `${c} core${c > 1 ? 's' : ''} · ${b ? 'T2 reads' : 'no blocking'}`),  // the card's heading names the set-up
                h('div', { class: 'small', html: r ? `ULT <b>${r[0]}</b> ticks · KLT <b>${r[1]}</b> ticks` : '<span class="muted">run it to the end to record</span>' }));  // its body shows both finish times, or a hint to run the set-up to the end
            }));  // ends the map over set-ups
          }  // ends board()
          function rerun() { U = simulate('ult', cores, block); K = simulate('klt', cores, block); N = Math.max(U.end, K.end); board(); player.setCount(N + 1); }  // rerun(): re-simulates both sides after a setting changes and resets the player to the new length
          const segC = ctx.ui.seg([{ value: 1, label: '1 core' }, { value: 2, label: '2 cores' }], 1, (v) => { cores = v; rerun(); });  // the 1 core / 2 cores switch
          const segB = ctx.ui.seg([{ value: true, label: 'T2 reads from disk' }, { value: false, label: 'No blocking' }], true, (v) => { block = v; rerun(); });  // the "T2 reads from disk" / "No blocking" switch
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the page: everything stacked to fill the step
            h('div', { class: 'row', style: { gap: '14px' } }, h('span', { class: 'small b' }, 'Machine:'), segC, h('span', { class: 'small b' }, 'Thread 2:'), segB, h('span', { class: 'grow' }), h('span', { class: 'small muted' }, 'Predict, then press Play or step.')),  // top row: the two setting switches and a hint to predict first
            h('div', { class: 'grid-2', style: { gap: '12px' } }, PU.card, PK.card),  // the two timeline cards side by side
            player.el,  // then the player controls and caption
            h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'xs muted b' }, 'YOUR RESULTS: try all four set-ups'), boardEl)));  // then the scoreboard with its heading
          rerun();  // runs the first simulation and draws the scoreboard when the step opens
        },  // ends render() for step 5
      },  // ends step 5
      /* ---------------- 6. Workarounds: many processes, or jacketing ---------------- */
      {  // step 6 begins: jacketing, a way around the ULT blocking problem
        title: 'Working around the limits: jacketing',  // the step title shown at the top of the page
        kind: 'explore',  // the kind of step (explore), shown as a label above the title
        html: `${/* html: the fixed page content for step 6 */''}
          <div class="split r fill">${/* two-column layout with the wider column on the right */''}
            <div class="stack sec-4-2-s6l" style="gap:10px">${/* the left column, which render() also fills with the code and controls */''}
              <p class="m0"><b>ULTs have two big limits:</b> one blocking call stops every thread, and the process cannot use extra processors. Two classic workarounds:</p>${/* paragraph: the two limits of ULTs */''}
              <div class="grid-2" style="gap:10px">${/* two workaround cards side by side */''}
                <div class="card tight"><b>1 · Use processes, not threads.</b> <span class="small">Fixes <b>both</b> limits: the kernel sees each part, so it can block them separately and spread them over processors. The catch: every switch is now a full process switch, so the cheap switching that made ULTs attractive is gone.</span></div>${/* workaround 1: use processes instead of threads, which fixes both limits but loses cheap switching */''}
                <div class="card tight thread"><b>2 · <span class="t">Jacketing</span>.</b> <span class="small">Fixes <b>blocking only</b>. Wrap each blocking system call in a “jacket”: library code that first checks, without waiting, whether the call would block. If it would, run another thread and try again later.</span></div>${/* workaround 2: jacketing, which fixes blocking only */''}
              </div>${/* ends the two workaround cards */''}
            </div>${/* ends the left column */''}
            <div class="card white stack sec-4-2-s6r" style="gap:8px"></div>${/* the empty card on the right where render() draws the state picture */''}
          </div>`,  // ends the layout and the HTML text
        render(el, ctx) {  // render(el, ctx): builds the jacketing walkthrough when step 6 is shown
          const { h, s } = ctx;  // takes the HTML and SVG element builders from the toolbox
          const L = ctx.$('.sec-4-2-s6l'), R = ctx.$('.sec-4-2-s6r');  // L is the left column and R the right-hand card
          const CODE = {  // CODE: the two code listings shown to students, with and without a jacket
            jack: `int jacket_read(int fd, char *buf, int n) { // replaces read()${/* shown code, line 1: jacket_read() takes the place of read() */''}
  while (!io_ready(fd)) {    // would read block? (never waits)${/* shown code, line 2: loop while a read would block; the check itself never waits */''}
    mark_waiting(me, fd);    // yes: this thread waits on fd${/* shown code, line 3: note in the library that this thread waits on the device */''}
    thread_yield();          // run another thread meanwhile${/* shown code, line 4: give the processor to another thread meanwhile */''}
  }                          // resumed later: check again${/* shown code, line 5: when this thread runs again, the loop checks again */''}
  return read(fd, buf, n);   // data is there: cannot block${/* shown code, line 6: the data is there, so the real read cannot block */''}
}                            // caller never knew it was wrapped`,  // shown code, line 7: end of the jacket; the caller never knew its call was wrapped
            plain: `void thread2_body(void) {          // Thread 2's code, no jacket${/* second listing, line 1: Thread 2's code with no jacket */''}
  int n = read(fd, buf, sizeof buf); // system call: can block all of P${/* second listing, line 2: a direct read() that can block all of P */''}
  use(buf, n);                       // runs only once P is unblocked${/* second listing, line 3: runs only after P is unblocked */''}
}                                    // T1 and T3 were frozen meanwhile`,  // second listing, line 4: end of the function; T1 and T3 were frozen while it waited
          };  // closes the CODE table
          const F = {  // F: the frames for each version, giving each thread's state, P's state, the device, what the CPU runs, the code line and a caption
            jack: [  // frames for the jacketed version begin
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'fetching', cpu: ['P · Thread 2', 'proc'], ln: null, cap: '<b>Start.</b> Thread 2 is about to read from a device (say, a network connection) whose data has not arrived yet. The program links a thread library that jackets its I/O calls.' },  // frame: T2 is about to read from a device whose data has not arrived
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'fetching', cpu: ['P · jacket code (user mode)', 'proc'], ln: 1, cap: '<b>T2 calls read.</b> The call lands in the library’s jacket_read(): an ordinary function, so the CPU is still in user mode.' },  // frame: the call lands in jacket_read, still in user mode
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'fetching', cpu: ['kernel: quick check', 'os'], ln: 2, cap: '<b>The jacket asks the kernel whether a read would block right now</b> (a nonblocking check, like select() or poll() on UNIX). The kernel answers at once: yes, no data yet. It does not block P.' },  // frame: the jacket asks the kernel a quick nonblocking question, and the answer is "would block"
              { T1: 'Ready', T2: 'Waiting', T3: 'Ready', P: 'Running', dev: 'fetching', cpu: ['P · library code', 'proc'], ln: 3, cap: '<b>The library notes that T2 waits for this device</b> and marks T2 blocked in its own table. The kernel’s record for P still says Running.' },  // frame: the library marks T2 as waiting; the kernel still sees P Running
              { T1: 'Running', T2: 'Waiting', T3: 'Ready', P: 'Running', dev: 'fetching', cpu: ['P · Thread 1', 'proc'], ln: 4, cap: '<b>thread_yield() switches to T1.</b> P keeps its turn on the CPU and spends it on useful work instead of sleeping.' },  // frame: thread_yield() switches to T1, so P's turn is not wasted
              { T1: 'Ready', T2: 'Waiting', T3: 'Running', P: 'Running', dev: 'ready', cpu: ['P · Thread 3', 'proc'], ln: null, cap: '<b>T1 and T3 keep taking turns</b> while T2’s data is on its way. Here the data has just arrived.' },  // frame: T1 and T3 take turns, and the data arrives
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'ready', cpu: ['kernel: quick check', 'os'], ln: 2, cap: '<b>When the library gives T2 another turn, the loop repeats the check.</b> This time io_ready() says the data is there, so the loop ends.' },  // frame: T2 gets another turn and the check now succeeds
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'idle', cpu: ['kernel: read() copies data', 'os'], ln: 6, cap: '<b>Now the real read() runs.</b> Because the data is already waiting, it returns immediately. Process P never blocked.' },  // frame: the real read() returns at once, so P never blocked
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'idle', cpu: ['P · Thread 2', 'proc'], ln: 7, cap: '<b>Net effect:</b> T2 waited, but T1 and T3 kept working the whole time. The price: extra checking calls and a more complicated library.' },  // frame: the net effect and the price of jacketing
            ],  // ends the jacketed frames
            plain: [  // frames for the version without a jacket begin
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'fetching', cpu: ['P · Thread 2', 'proc'], ln: null, cap: '<b>Start.</b> Thread 2 is about to read from the same device, whose data has not arrived yet. This time there is no jacket.' },  // frame: T2 is about to read with no jacket
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'fetching', cpu: ['kernel: read()', 'os'], ln: 2, cap: '<b>T2 calls read() directly.</b> It is a real system call, so the CPU enters kernel mode, and the kernel finds no data waiting.' },  // frame: read() is a real system call and the kernel finds no data
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Blocked', dev: 'fetching', cpu: ['another process', 'panel'], ln: 2, cap: '<b>So the kernel blocks the caller.</b> To the kernel the caller is process P, so all of P is now Blocked, and the kernel runs some other process.' },  // frame: the kernel blocks the caller, which is all of P
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Blocked', dev: 'fetching', cpu: ['another process', 'panel'], ln: 2, cap: '<b>T1 and T3 are ready but frozen.</b> The library cannot switch to them, because none of P’s code is running at all. Its table still says T2 is Running.' },  // frame: T1 and T3 are ready but frozen
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Ready', dev: 'ready', cpu: ['another process', 'panel'], ln: 2, cap: '<b>The data arrives</b> and the device interrupts. The kernel moves P from Blocked to Ready; P still has to wait for its turn on the CPU.' },  // frame: the data arrives and P becomes Ready
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'idle', cpu: ['P · Thread 2', 'proc'], ln: 3, cap: '<b>The kernel dispatches P.</b> read() copies the data and returns inside T2, which carries on. Compare with the jacketed version, where P never stopped.' },  // frame: P is dispatched and T2 continues; compare with the jacketed version
            ],  // ends the frames without a jacket
          };  // closes the F table
          let mode = 'jack', code;  // mode is the version being shown (jack or plain); code will hold the code listing element
          const codeBox = h('div', {});  // the box that holds the code listing
          const svg = s('svg', { viewBox: '0 0 440 248', width: '100%', role: 'img', 'aria-label': 'Thread, process, device and CPU state during a read' });  // the drawing of the library's table, the kernel's record, the device and the CPU
          const SC = { Running: 'var(--thread)', Waiting: 'var(--warn)', Ready: 'var(--ink-2)', Blocked: 'var(--intr)' };  // SC: the text color for each thread state
          const why = h('div', { class: 'callout why m0 small' });  // the callout box that explains why this version works or fails
          const WHY = {  // WHY: the callout's label and text for each version
            jack: ['Why it works', 'The kernel only ever sees quick, nonblocking questions from P, so it never has a reason to block the whole process. All the waiting is bookkeeping inside the library.'],  // for the jacketed version: the kernel only ever sees quick questions
            plain: ['What goes wrong', 'The kernel blocks whoever made the call. With ULTs, “whoever” is the entire process, so one thread’s read puts every thread to sleep.'],  // for the plain version: the kernel blocks the whole process
          };  // closes the WHY table
          // phones: each comment moves onto its own line just above its statement, so nothing is cut off
          const stacked = (src) => src.split('\n').flatMap((ln) => { const i = ln.indexOf('//'), ind = ln.match(/^\s*/)[0]; return [ind + ln.slice(i).trim(), ln.slice(0, i).trimEnd()]; }).join('\n');  // stacked(): for phones, moves each line's comment onto its own line above the code, keeping the indentation
          const markLn = (n) => (ctx.narrow ? [2 * n - 1, 2 * n] : n); // original line n → both of its lines when stacked
          function setCode() {  // setCode(): shows the listing and the callout for the current version
            code = ctx.ui.code(ctx.narrow ? stacked(CODE[mode]) : CODE[mode], { lang: 'c', fontSize: 13, nums: !ctx.narrow }); codeBox.replaceChildren(code);  // builds the code listing (stacked and without line numbers on a phone) and puts it in its box
            why.className = 'callout m0 small ' + (mode === 'jack' ? 'why' : 'bad'); why.dataset.label = WHY[mode][0]; why.textContent = WHY[mode][1];  // styles the callout as "why" for jacketing or "bad" for the plain version, and fills in its label and text
          }  // ends setCode()
          function draw(f) {  // draw(f): redraws the state picture for frame f
            const kids = [  // kids starts with the library's part of the picture
              s('text', { x: 0, y: 13, 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em' }, 'THREAD LIBRARY’S TABLE · USER SPACE'),  // heading: the thread library's table, in user space
              s('rect', { x: 0, y: 22, width: 440, height: 76, rx: 10, class: 's-accent', 'stroke-width': 1.2 })];  // the library table's background box
            ['T1', 'T2', 'T3'].forEach((n, i) => {  // draws one box per thread
              const x = 10 + i * 142, on = f[n] === 'Running';  // its position; on is true for the running thread
              kids.push(s('rect', { x, y: 31, width: 132, height: 58, rx: 9, class: 's-thread', 'stroke-width': on ? 3.5 : 1.2 }),  // the thread's box, with a thicker border when it is running
                s('text', { x: x + 66, y: 55, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, 'Thread ' + n.slice(1)),  // the thread's name
                s('text', { x: x + 66, y: 77, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, style: `fill:${SC[f[n]]}` }, f[n] === 'Waiting' ? 'Blocked' : f[n]));  // its state in color; the library's "Waiting" is shown to students as Blocked
            });  // ends the loop over threads
            kids.push(s('text', { x: 0, y: 120, 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em' }, 'KERNEL SPACE'),  // heading: kernel space
              s('rect', { x: 0, y: 128, width: 440, height: 52, rx: 10, class: 's-os', 'stroke-width': 1.2 }),  // the kernel's box
              s('text', { x: 14, y: 160, 'font-size': 15.5, 'font-weight': 700 }, 'P ='),  // the label "P ="
              s('text', { x: 46, y: 160, 'font-size': 15.5, 'font-weight': 800, style: `fill:${{ Blocked: 'var(--intr)', Ready: 'var(--ink-2)', Running: 'var(--ok)' }[f.P]}` }, f.P),  // P's state as the kernel records it, colored: violet for Blocked, grey for Ready, green for Running
              s('rect', { x: 196, y: 136, width: 234, height: 36, rx: 9, class: 's-io', 'stroke-width': f.dev === 'idle' ? 1 : 2.5 }),  // the device box, with a thicker border while data is on its way or waiting
              s('text', { x: 313, y: 159, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700 }, { idle: 'device: idle', fetching: 'device: data on its way…', ready: 'device: data ready' }[f.dev]),  // the device's status: idle, data on its way, or data ready
              s('rect', { x: 0, y: 194, width: 440, height: 50, rx: 10, class: 's-panel', 'stroke-width': 1 }),  // the CPU strip at the bottom
              s('text', { x: 14, y: 224, 'font-size': 15.5, 'font-weight': 700 }, 'CPU runs:'),  // its label: "CPU runs:"
              s('rect', { x: 100, y: 203, width: 330, height: 32, rx: 16, class: 's-' + f.cpu[1], 'stroke-width': 2 }),  // a pill-shaped box colored by what the CPU is running
              s('text', { x: 265, y: 224, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, f.cpu[0]));  // the name of what the CPU is running
            svg.replaceChildren(...kids.filter(Boolean));  // swaps in the new drawing
            code.clear();  // clears the highlight from the code listing
            if (f.ln) code.mark(markLn(f.ln));  // highlights the code line this frame is about (both of its lines when the listing is stacked on a phone)
          }  // ends draw()
          setCode();  // shows the jacketed listing first
          const player = ctx.ui.player({ count: F.jack.length, interval: 2600, speed: false, render: (i) => { const f = F[mode][i]; draw(f); return f.cap; } });  // the player that steps through the frames (without a speed control); each step draws the frame and returns its caption
          const seg = ctx.ui.seg([{ value: 'jack', label: 'Jacketed read' }, { value: 'plain', label: 'Plain read()' }], 'jack', (v) => { mode = v; setCode(); player.setCount(F[v].length); });  // the Jacketed / Plain switch; changing it swaps the listing and resets the player
          L.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'The code being traced'), h('span', { class: 'xs muted' }, 'io_ready, mark_waiting: library helpers')), codeBox, why);  // fills the left column: a heading with a note about the helper names, then the listing and the callout
          R.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, 'Trace it'), seg), svg, player.el,  // fills the right card: a heading and the switch, then the drawing and the player
            h('div', { class: 'callout tip m0 small', 'data-label': 'Watch', style: { marginTop: 'auto' } }, 'Keep an eye on the violet kernel row. With the jacket, does P ever turn Blocked? Then switch to Plain read() and compare.'));  // a tip at the bottom: watch whether the kernel row ever shows P Blocked
        },  // ends render() for step 6
      },  // ends step 6
      /* ---------------- 7. What each design costs: latency numbers ---------------- */
      {  // step 7 begins: measured costs of ULTs, KLTs and processes
        title: 'What it costs: ULT vs KLT vs process',  // the step title shown at the top of the page
        kind: 'explore',  // the kind of step (explore), shown as a label above the title
        html: `${/* html: the fixed page content for step 7 */''}
          <div class="split r fill">${/* two-column layout with the wider column on the right */''}
            <div class="card white stack sec-4-2-s7c" style="gap:8px"></div>${/* the empty card on the left where render() draws the bar chart */''}
            <div class="stack sec-4-2-s7r" style="gap:10px">${/* the right column, which render() also fills with the calculator */''}
              <p class="m0">Two classic micro-benchmarks, both run on the same older single-processor machine. The <span class="t">latency</span> of each operation is in microseconds (µs).</p>${/* intro paragraph: two micro-benchmarks, latency in microseconds */''}
            </div>${/* ends the right column */''}
          </div>`,  // ends the layout and the HTML text
        render(el, ctx) {  // render(el, ctx): builds the bar chart and the calculator when step 7 is shown
          const { h, s } = ctx;  // takes the HTML and SVG element builders from the toolbox
          const C = ctx.$('.sec-4-2-s7c'), R = ctx.$('.sec-4-2-s7r');  // C is the chart card and R the right column
          const DATA = { fork: { name: 'Null fork', ult: 34, klt: 948, proc: 11300 }, sig: { name: 'Signal-wait', ult: 37, klt: 441, proc: 1840 } };  // DATA: the measured latencies in microseconds for each benchmark and each kind
          const KINDS = [['ult', 'ULT', 's-thread'], ['klt', 'KLT', 's-os'], ['proc', 'Process', 's-proc']];  // KINDS: the three kinds compared, with their labels and bar colors
          // chart geometry: a narrower drawing on phones so the labels stay readable after scaling
          const G = ctx.narrow ? { W: 400, X0: 78, BW: 214, FS: 1.2, G2: 128, RG: 34, BH: 26, AX: 248, TL: 268, H: 274 }  // G holds the chart layout numbers for phones: widths, bar sizes, gaps and text positions
                               : { W: 620, X0: 100, BW: 430, FS: 1, G2: 110, RG: 30, BH: 24, AX: 218, TL: 234, H: 240 };  // the same layout numbers for wide screens
          const { X0, BW, FS } = G;  // short names for the most used layout numbers
          let scale = 'lin', shown = null, stopTween = null;  // scale is the current axis (lin or log); shown is the scale being animated away from; stopTween stops a running animation
          const nf = (v) => Math.round(v).toLocaleString('en-US');  // nf(): writes a number with thousands separators, such as 11,300
          const pos = (v, sc) => (sc === 'lin' ? (v / 12000) * BW : Math.max(0, Math.log10(v / 10) / Math.log10(2000)) * BW);  // pos(v, sc): how long the bar for v is on the linear axis (0 to 12,000) or the log axis (10 to 20,000)
          const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%', role: 'img', 'aria-label': 'Bar chart of null fork and signal-wait latency' });  // the chart drawing
          function draw(f) { // f: 0..1 blend from the old scale to the new one
            const kids = [];  // kids collects every shape in the chart
            const ticks = scale === 'lin' ? [0, 2000, 4000, 6000, 8000, 10000, 12000] : [10, 100, 1000, 10000];  // the grid-line values for the current scale
            ticks.forEach((tv) => { const x = X0 + pos(tv, scale); kids.push(s('line', { x1: x, y1: 18, x2: x, y2: G.AX, class: 's-muted', 'stroke-width': 1 }), s('text', { x, y: G.TL, 'text-anchor': 'middle', 'font-size': 12.5 * FS, class: 's-sub' }, tv >= 1000 ? tv / 1000 + (scale === 'lin' ? 'k' : ',000') : String(tv))); });  // draws each grid line with its label under the chart (2k, 4k... or 10, 100, 1,000...)
            kids.push(s('text', { x: G.W - 8, y: G.TL, 'text-anchor': 'end', 'font-size': 12.5 * FS, class: 's-sub' }, 'µs'));  // the unit, µs, at the end of the axis
            [['fork', 0], ['sig', G.G2]].forEach(([key, y0]) => {  // draws the two groups of bars: null fork on top, signal-wait below
              const d = DATA[key];  // d is this benchmark's data
              kids.push(s('text', { x: 0, y: y0 + 15, 'font-size': 14.5 * FS, 'font-weight': 800 }, d.name));  // the benchmark's name above its group
              KINDS.forEach(([k, lab, cls], i) => {  // one bar each for ULT, KLT and process
                const y = y0 + 21 + i * G.RG, v = d[k], ty = y + G.BH / 2 + 5 * FS;  // the bar's vertical position and the text baseline
                const w = Math.max(3, (shown ? pos(v, shown) * (1 - f) : 0) + pos(v, scale) * (shown ? f : 1));  // the bar's width, blended between the old scale and the new one during the animation (at least 3 units)
                kids.push(s('text', { x: X0 - 8, y: ty, 'text-anchor': 'end', 'font-size': 14 * FS, 'font-weight': 700 }, lab),  // the label to the left of the bar
                  s('rect', { x: X0, y, width: w, height: G.BH, rx: 5, class: cls, 'stroke-width': 2 }),  // the bar itself, colored by kind
                  s('text', { x: X0 + w + 7, y: ty, 'font-size': 14 * FS, 'font-weight': 800 }, nf(v) + ' µs'));  // the value written just past the end of the bar
              });  // ends the loop over kinds
            });  // ends the loop over benchmarks
            svg.replaceChildren(...kids.filter(Boolean));  // swaps in the new chart
          }  // ends draw()
          function setScale(v) {  // setScale(v): switches the axis to linear or log with a short smooth animation
            if (stopTween) stopTween();  // stops any animation that is still running
            shown = scale; scale = v;  // remembers the old scale for blending, and sets the new one
            const t0 = performance.now();  // t0 is the time the animation starts
            stopTween = ctx.raf((now) => { const f = Math.min(1, (now - t0) / 450); draw(1 - Math.pow(1 - f, 3)); if (f >= 1) { shown = null; return false; } });  // on each animation frame, redraws with an eased blend for 0.45 s, then stops
          }  // ends setScale()
          const segS = ctx.ui.seg([{ value: 'lin', label: 'Linear scale' }, { value: 'log', label: 'Log scale' }], 'lin', setScale);  // the Linear / Log switch for the chart
          C.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Measured latency'), segS), svg,  // fills the chart card: heading and switch, then the chart
            h('div', { class: 'small' }, h('b', {}, h('span', { class: 't', 'data-t': 'Null fork' }, 'Null fork'), ': '), 'create, schedule, run and finish a thread or process whose body is empty. ', h('b', {}, h('span', { class: 't', 'data-t': 'Signal-wait' }, 'Signal-wait'), ': '), 'one signals a waiting partner, then waits itself (the cost of synchronizing two).'),  // explains the two benchmarks, with glossary pop-ups on their names
            h('div', { class: 'xs muted' }, 'On a linear scale the ULT bars are almost invisible: that is the point. Switch to the log scale, where each grid line is 10× the one before, to compare all six.'),  // a note: the ULT bars nearly vanish on the linear scale, so try the log scale
            h('div', { class: 'callout warn m0 small', 'data-label': 'Keep it in proportion', style: { marginTop: 'auto' } }, 'Today’s absolute numbers are far smaller, but the pattern holds. And if most of an application’s thread switches need kernel services anyway, the ULT speed advantage shrinks.'));  // a warning at the bottom: today's numbers are smaller, but the pattern holds
          draw(1);  // draws the chart for the first time
          // ---- calculator
          let op = 'fork', n = 1000;  // op is the benchmark used by the calculator; n is how many operations
          const ratios = h('div', { class: 'stack', style: { gap: '4px' } });  // the three ratio lines of the calculator
          const totals = h('div', { class: 'grid-3', style: { gap: '6px' } });  // the three total-time cards of the calculator
          const fmtT = (us) => (us < 1000 ? ctx.util.fmt(us, 0) + ' µs' : us < 1e6 ? ctx.util.fmt(us / 1000, 1) + ' ms' : ctx.util.fmt(us / 1e6, 2) + ' s');  // fmtT(): writes a time in µs, ms or s, whichever reads best
          function calc() {  // calc(): recalculates the ratios and totals; runs when the benchmark or N changes
            const d = DATA[op];  // d is the chosen benchmark's data
            const what = op === 'fork' ? 'null fork' : 'signal-wait';  // what names the benchmark in the sentences below
            ratios.replaceChildren(...[[d.proc / d.ult, 'process', 'ULT'], [d.klt / d.ult, 'KLT', 'ULT'], [d.proc / d.klt, 'process', 'KLT']].map(([r, a, b]) =>  // three ratios: process versus ULT, KLT versus ULT, and process versus KLT
              h('div', { class: 'kv small' }, h('span', {}, `1 ${a} ${what} lasts as long as`), h('span', { class: 'mono b', style: { whiteSpace: 'nowrap' } }, `≈ ${ctx.util.fmt(r, r >= 100 ? 0 : 1)} ${b} ones`))));  // each ratio as a label/value row, such as "1 process null fork lasts as long as ≈ 332 ULT ones"
            totals.replaceChildren(...KINDS.map(([k, lab]) => {  // one total card for each kind
              const pct = (d[k] * n) / 1e4; // share of one second, in %: (µs per op × N) ÷ 1,000,000 µs × 100
              const load = pct > 100 ? 'cannot keep up' : (pct < 0.1 ? '< 0.1' : ctx.util.fmt(pct, 1)) + '% of the CPU';  // describes that share: over 100% cannot keep up, otherwise a percentage
              return h('div', { class: 'card tight', style: { textAlign: 'center', padding: '6px 8px' } }, h('div', { class: 'xs muted b' }, lab),  // the card, with the kind's name at the top
                h('div', { class: 'b mono', style: { fontSize: '16px', color: 'var(--chc)' } }, fmtT(d[k] * n)),  // the total time for N operations, in the accent color
                h('div', { class: 'xs', style: { color: pct > 100 ? 'var(--bad)' : pct > 25 ? 'var(--warn)' : 'var(--ok)', fontWeight: 700 } }, load));  // the CPU share, colored green, orange above 25% or red above 100%
            }));  // ends the map over kinds
          }  // ends calc()
          const segO = ctx.ui.seg([{ value: 'fork', label: 'Null fork' }, { value: 'sig', label: 'Signal-wait' }], 'fork', (v) => { op = v; calc(); });  // the Null fork / Signal-wait switch for the calculator
          const sl = ctx.ui.slider({ label: 'Do it N times', min: 0, max: 4, step: 0.5, value: 3, format: (v) => 'N = ' + nf(Math.round(Math.pow(10, v))), onInput: (v) => { n = Math.round(Math.pow(10, v)); calc(); } });  // the N slider; it moves in half-powers of ten, so N runs from 1 to 10,000
          R.append(h('div', { class: 'card stack', style: { gap: '8px', flex: 'none' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Calculator'), segO), ratios, sl, totals,  // fills the calculator card: heading and switch, then the ratios, the slider and the totals
            h('div', { class: 'xs muted' }, 'Top: total time for N operations. Bottom: the share of one processor they would use if a program needed N of them every second.')),  // a note explaining the two numbers in each total card
            h('div', { class: 'callout why m0 small', 'data-label': 'Why the gaps' }, 'A ULT operation is just a library call. A KLT operation must enter the kernel: two mode switches plus kernel bookkeeping. A process operation must also build or switch a whole address space and its resources.'));  // a why box: each kind costs more because it does more work
          calc();  // fills the calculator for the starting values
        },  // ends render() for step 7
      },  // ends step 7
      /* ---------------- 8. Combined approach: M ULTs on N KLTs ---------------- */
      {  // step 8 begins: the combined approach, M user-level threads on N kernel-level threads
        title: 'Best of both: the combined approach',  // the step title shown at the top of the page
        kind: 'explore',  // the kind of step (explore), shown as a label above the title
        html: `${/* html: the fixed page content for step 8 */''}
          <div class="split l fill">${/* two-column layout: explanation on the left, the mapping diagram on the right */''}
            <div class="stack" style="gap:10px">${/* the left column stacks its blocks with a small gap */''}
              <p class="m0">A <span class="t" data-t="combined approach">combined approach</span> mixes the two designs; older versions of Solaris are the classic example. The application creates its threads with library calls, and the library also does most of their scheduling and synchronization, all in user space.</p>${/* paragraph: the combined approach, with threads created and mostly scheduled by a user-level library */''}
              <p class="m0">Underneath, the library runs the application’s <b>M</b> user-level threads on a <b>smaller or equal number N</b> of kernel-level threads. The programmer can tune N to suit the application and the machine.</p>${/* paragraph: M user-level threads run on N kernel-level threads, and N can be tuned */''}
              <div class="callout tip m0 small" data-label="Done well, you get both">Most thread operations stay cheap library calls, yet threads of one application can run in parallel on several processors, and one blocking system call no longer stops the whole process.</div>${/* tip box: done well, this gives cheap operations, parallelism, and no whole-process blocking */''}
              <div class="card tight small"><b>Names you may meet.</b> Running M ULTs on N KLTs is often called the <b>many-to-many</b> model. With N = 1 it shrinks to <b>many-to-one</b> (pure ULTs); with one KLT per ULT it becomes <b>one-to-one</b> (pure KLTs). These names describe how <b>user-level threads map onto kernel-level threads</b>, nothing else.</div>${/* card: the many-to-many, many-to-one and one-to-one names for the ULT-to-KLT mapping */''}
              <p class="xs muted m0">Section 4.5 shows how Solaris built this with <span class="t" data-t="Solaris lightweight process">lightweight processes</span>: kernel-scheduled carriers for user-level threads.</p>${/* small note: section 4.5 shows the Solaris version of this design */''}
            </div>${/* ends the left column */''}
            <div class="card white stack sec-4-2-s8" style="gap:8px"></div>${/* the empty card on the right where render() draws the diagram */''}
          </div>`,  // ends the layout and the HTML text
        render(el, ctx) {  // render(el, ctx): builds the M-on-N mapping diagram when step 8 is shown
          const { h, s } = ctx;  // takes the HTML and SVG element builders from the toolbox
          {  // an extra pair of braces keeps this step's names inside their own block
            let N = 2, cores = 2, blk = false;  // N kernel-level threads, the number of cores, and whether U2 is blocked
            const M = 6;  // M is fixed at six user-level threads
            // geometry: 600 wide on desktop; a 360-wide drawing on phones so labels stay readable after scaling
            const NW = ctx.narrow, W = NW ? 360 : 600, UX = (W - 24) / M, UW = UX - (NW ? 8 : 16), KG = NW ? 8 : 12, CG = NW ? 10 : 16;  // NW marks a phone; W is the drawing width; UX, UW, KG and CG space out the ULT boxes, KLT boxes and cores
            const ux = (i) => 12 + i * UX, uc = (i) => ux(i) + UW / 2;  // ux(i) and uc(i): the left edge and center of user thread i's box
            const svg = s('svg', { viewBox: `0 0 ${W} 292`, width: '100%', role: 'img', 'aria-label': 'Six user-level threads mapped onto kernel-level threads and cores' });  // the diagram of ULTs, library, KLTs and cores
            const out = h('div', { class: 'stack', style: { gap: '6px' } });  // the box under the diagram that holds the results
            function draw() {  // draw(): redraws the mapping for the current N, core count and blocking state
              let map = Array.from({ length: M }, (_, i) => Math.floor((i * N) / M)); // contiguous groups, no crossing lines
              const kb = map[1];                                                       // the KLT under U2
              const movedNames = map.map((k, i) => (i !== 1 && k === kb ? 'U' + (i + 1) : null)).filter(Boolean); // U2's neighbours on that KLT
              const moved = movedNames.length;  // moved counts U2's neighbours that shared its KLT
              if (blk && N > 1) map = map.map((k, i) => (i !== 1 && k === kb ? (kb + 1) % N : k)); // library moves U2's neighbours away
              const alive = Array.from({ length: N }, (_, k) => k).filter((k) => !(blk && k === kb));  // alive lists the KLTs that can run: every one except a blocked KLT
              const running = alive.slice(0, cores);  // running: the first alive KLTs, one per core
              const kw = Math.min(90, (W - 24 - (N - 1) * KG) / N), kx = (k) => W / 2 - (N * kw + (N - 1) * KG) / 2 + k * (kw + KG);  // kw and kx(k): the width of each KLT box and where KLT k sits, centered as a group
              const cw = cores === 2 ? 130 : NW ? 76 : 110, cx = (c) => W / 2 - (cores * cw + (cores - 1) * CG) / 2 + c * (cw + CG);  // cw and cx(c): the width of each core box and where core c sits, centered as a group
              const kids = [  // kids collects every shape in the drawing
                s('text', { x: 0, y: 12, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em' }, NW ? 'USER SPACE: 6 ULTs' : 'USER SPACE: 6 ULTs, created and scheduled by the library'),  // the user-space heading (shorter on a phone)
                s('line', { x1: 0, y1: 104, x2: W, y2: 104, class: 's-line', 'stroke-dasharray': '6 5', 'stroke-width': 1.2 }),  // the dashed line between user space and kernel space
              ];  // ends the starting list of shapes
              map.forEach((k, i) => kids.push(s('line', { x1: uc(i), y1: 56, x2: kx(k) + kw / 2, y2: 132, style: `stroke:${blk && i === 1 ? 'var(--intr)' : 'var(--thread)'};stroke-width:2`, opacity: 0.85 })));  // a line from each user thread to the KLT carrying it; U2's line turns violet while it is blocked
              kids.push(s('text', { x: 0, y: 122, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em', style: 'paint-order:stroke;stroke:var(--panel);stroke-width:6px;stroke-linejoin:round' }, `KERNEL SPACE: ${N} KLT${N > 1 ? 's' : ''}`));  // the kernel-space heading, with a halo so it stays readable over the lines
              kids.push(s('rect', { x: 12, y: 66, width: W - 24, height: 26, rx: 7, class: 's-accent', 'stroke-width': 1.2 }),  // the thread library's box across the middle
                s('text', { x: W / 2, y: 84, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'thread library: maps ULTs onto KLTs'));  // its label: the library maps ULTs onto KLTs
              for (let i = 0; i < M; i++) {  // draws the six user thread boxes
                const frozen = blk && (N === 1 || i === 1);  // a thread is stuck (red) if it is U2 while blocked, or if the only KLT is blocked
                kids.push(s('rect', { x: ux(i), y: 22, width: UW, height: 34, rx: 8, class: frozen ? 's-bad' : 's-thread', 'stroke-width': 2 }),  // the thread's box
                  s('text', { x: uc(i), y: 44, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'U' + (i + 1)));  // its name, U1 to U6
              }  // ends the loop over user threads
              for (let k = 0; k < N; k++) {  // draws the N kernel-level threads
                const isB = blk && k === kb, run = running.indexOf(k), tight = kw < 60;  // isB marks the blocked KLT; run is the core it is on, or -1; tight means the box is too small for full words
                kids.push(s('rect', { x: kx(k), y: 132, width: kw, height: 42, rx: 8, class: isB ? 's-bad' : 's-os', 'stroke-width': run >= 0 ? 3 : 1.4 }),  // the KLT's box: red when blocked, thicker border when running
                  s('text', { x: kx(k) + kw / 2, y: 150, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, (tight ? 'K' : 'KLT ') + (k + 1)),  // its name, shortened to K1, K2... when tight
                  s('text', { x: kx(k) + kw / 2, y: 167, 'text-anchor': 'middle', 'font-size': 12.5, style: isB ? 'fill:var(--intr)' : '', class: isB ? '' : 's-sub' }, isB ? (tight ? 'block' : 'blocked') : run >= 0 ? (tight ? 'run' : 'running') : 'ready'));  // its status: blocked, running or ready (shortened when tight)
                if (run >= 0) kids.push(s('line', { x1: kx(k) + kw / 2, y1: 174, x2: cx(run) + cw / 2, y2: 236, class: 's-line', 'marker-end': 'url(#arr-cpu)', style: 'stroke:var(--cpu)' }));  // a running KLT gets an arrow down to the core it is using
              }  // ends the loop over KLTs
              for (let c = 0; c < cores; c++) {  // draws the cores
                const idle = c >= running.length;  // a core is idle when there are fewer running KLTs than cores
                kids.push(s('rect', { x: cx(c), y: 240, width: cw, height: 40, rx: 8, class: 's-cpu', 'stroke-width': 2, opacity: idle ? 0.6 : 1 }),  // the core's box, faded when idle
                  s('text', { x: cx(c) + cw / 2, y: idle ? 257 : 265, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, `Core ${c + 1}`),  // its name
                  ...(idle ? [s('text', { x: cx(c) + cw / 2, y: 274, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'idle')] : []));  // and "idle" underneath when it has nothing to run
              }  // ends the loop over cores
              svg.replaceChildren(...kids.filter(Boolean));  // swaps in the new drawing
              const par = running.length;  // par: how many of the app's threads run at the same moment
              const like = N === 1 ? 'pure ULTs (many-to-one)' : N === M ? 'pure KLTs (one-to-one)' : 'a true hybrid (many-to-many)';  // like: which pure model this setting behaves like, based on N
              out.replaceChildren(  // fills the results box
                h('div', { class: 'kv small' }, h('span', {}, 'ULT threads of this app running at the same moment'), h('b', { class: 'mono' }, String(par))),  // result: how many threads run at once
                h('div', { class: 'kv small' }, h('span', {}, 'With N = ' + N + ' this behaves like'), h('b', {}, like)),  // result: which model this setting behaves like
                h('div', { class: 'small', html: !blk ? 'Press <b>U2 makes a blocking call</b> to see what happens to the others.' : N === 1 ? '<b style="color:var(--intr)">Everything stops.</b> The only KLT is blocked, so, exactly as with pure ULTs, all six threads wait.' : `<b style="color:var(--ok)">Only U2 waits.</b> KLT ${kb + 1} is blocked with U2 on it; ` + (moved ? `the library moved ${movedNames.join(' and ')}, which shared it, to KLT ${(kb + 1) % N + 1}, so the process keeps running.` : 'every other ULT has its own KLT, so they all carry on.') }));  // result: a prompt to try blocking, or what the block did (everything stops when N is 1, otherwise only U2 waits)
            }  // ends draw()
            const slN = ctx.ui.slider({ label: 'Kernel-level threads N', min: 1, max: 6, value: 2, onInput: (v) => { N = v; draw(); } });  // the N slider, from 1 to 6 kernel-level threads
            const segC = ctx.ui.seg([{ value: 2, label: '2 cores' }, { value: 4, label: '4 cores' }], 2, (v) => { cores = v; draw(); });  // the 2 cores / 4 cores switch
            const bB = h('button', { class: 'btn sm intr', onclick: () => { blk = !blk; bB.classList.toggle('on', blk); bB.textContent = blk ? 'U2’s call finishes' : 'U2 makes a blocking call'; draw(); } }, 'U2 makes a blocking call');  // the button that starts or ends U2's blocking call; its label flips and it stays highlighted while U2 is blocked
            ctx.$('.sec-4-2-s8').append(h('div', { class: 'row', style: { gap: '10px' } }, h('div', { class: 'grow' }, slN), segC), svg,  // fills the card: the slider and core switch, then the diagram
              h('div', { class: 'row', style: { gap: '10px' } }, bB, h('span', { class: 'xs muted' }, 'Drag N from 1 to 6, with and without the blocking call.')), out);  // then the blocking button with a hint, and the results
            draw();  // draws the diagram for the first time
          }  // closes the extra block
        },  // ends render() for step 8
      },  // ends step 8
      /* ---------------- 9. Thread : process arrangements ---------------- */
      {  // step 9 begins: a quiz game on the four threads-to-processes arrangements
        title: 'How many threads per process? Four arrangements',  // the step title shown at the top of the page
        kind: 'explore',  // the kind of step (explore), shown as a label above the title
        html: `${/* html: the fixed page content for step 9 */''}
          <div class="split l fill">${/* two-column layout: explanation on the left, the game on the right */''}
            <div class="stack sec-4-2-s9l" style="gap:10px">${/* the left column, which render() fills further */''}
              <p class="m0 small">A different question from ULT vs KLT: how many <b>threads</b> live in how many <b>processes</b> (an <span class="t">address space</span> plus resources)? The answer is written as a ratio, <b>threads : processes</b>, and it describes one process, not a whole system as in section 4.1’s models.</p>${/* paragraph: this ratio counts threads per process, a different question from ULT versus KLT */''}
            </div>${/* ends the left column */''}
            <div class="card white stack sec-4-2-s9r" style="gap:8px"></div>${/* the empty card on the right where render() builds the game */''}
          </div>`,  // ends the layout and the HTML text
        render(el, ctx) {  // render(el, ctx): builds the arrangement explorer and quiz when step 9 is shown
          const { h, s } = ctx;  // takes the HTML and SVG element builders from the toolbox
          {  // an extra pair of braces keeps this step's names inside their own block
            const R = {  // R: the four arrangements, each with a button label, title, description and example systems
              // lab = button label (spells out "threads : processes" so it cannot be mistaken for the ULT→KLT mapping names)
              '1:1': { lab: '1 thread : 1 process', t: 'One thread per process', d: 'Every path of execution is its own process, with a private address space and its own resources. Making or switching a “thread” means making or switching a whole process.', ex: ['Traditional UNIX'] },  // arrangement 1:1, one thread per process, as in traditional UNIX
              'M:1': { lab: 'M threads : 1 process', t: 'Many threads in one process', d: 'One process owns the address space and the resources, and any number of threads run inside it, sharing all of them. This is the everyday case, and the one the rest of this chapter assumes.', ex: ['Windows NT', 'Solaris', 'Linux', 'OS X', 'iOS'] },  // arrangement M:1, many threads in one process, the everyday case
              '1:M': { lab: '1 thread : M processes', t: 'One thread, several process environments', d: 'A thread can <span class="t" data-t="thread migration">migrate</span> out of one process environment (address space plus resources) into another, even on a different computer, to follow the data it works on. An idea from distributed-systems research.', ex: ['Ra (Clouds)', 'Emerald'] },  // arrangement 1:M, one thread that migrates between process environments
              'M:N': { lab: 'M threads : N processes', t: 'Many threads, many environments', d: 'Both ideas at once: a process holds many threads, and those threads can also migrate from one process environment to another. Also from distributed-systems research.', ex: ['TRIX'] },  // arrangement M:N, many threads that can also migrate
            };  // closes the R table
            const nm = (k) => `${R[k].lab} (${k.replace(':', ' : ')})`;  // nm(k): the full name of an arrangement, such as "M threads : 1 process (M : 1)"
            // geometry: 600 x 238 on desktop; a narrower 360 x 250 drawing on phones (resource chips stack there)
            const NW = ctx.narrow, W = NW ? 360 : 600, H = NW ? 250 : 238;  // NW marks a phone; W and H are the drawing's width and height
            const CWID = (W - 16) / 2, SHIFT = CWID + 4; // computer width; how far a migrating thread travels, A to B
            let mode = 'M:1', away = false, mover = null;  // mode is the arrangement shown; away says which computer the migrating thread is on; mover is its drawn group
            const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Threads and processes arrangement' });  // the drawing of processes and threads
            const info = h('div', { class: 'card stack', style: { gap: '8px', flex: 'none' } });  // the card under the switch that describes the chosen arrangement
            const wave = (x, y) => s('g', {}, s('path', { d: `M ${x} ${y} q 10 7 0 14` + ' t 0 14'.repeat(3), fill: 'none', style: 'stroke:var(--thread);stroke-width:3.5;stroke-linecap:round' }),  // wave(): draws a thread as a wavy line going down...
              s('path', { d: `M ${x - 7} ${y + 54} L ${x + 7} ${y + 54} L ${x} ${y + 65} Z`, style: 'fill:var(--thread)' }));  // ...ending in an arrowhead
            const proc = (x, y, w, hh, lab, sub, stackChips) => [s('rect', { x, y, width: w, height: hh, rx: 12, class: 's-proc', 'stroke-width': 2 }),  // proc(): draws a process box with its name, memory and files chips, and a caption; stackChips stacks the chips on a phone
              s('text', { x: x + 10, y: y + 24, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--proc)' }, lab),  // the process name at the top of the box
              ...[['memory', 's-mem', 68], ['files', 's-io', 50]].flatMap(([l, c, cw], j) => {  // a "memory" chip and a "files" chip for the resources the process owns
                const cx = x + 10 + (stackChips ? 0 : j * 74), cy = y + hh - (stackChips ? 80 - j * 28 : 58);  // each chip's position: side by side, or stacked one above the other
                return [s('rect', { x: cx, y: cy, width: cw, height: 22, rx: 11, class: c, 'stroke-width': 1.5 }), s('text', { x: cx + cw / 2, y: cy + 16, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, l)];  // the chip's pill shape and its label
              }),  // ends the chips
              s('text', { x: x + 10, y: y + hh - 12, 'font-size': 13, class: 's-sub' }, sub)];  // the caption along the bottom of the box
            const title = (txt) => s('text', { x: W / 2, y: 17, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, txt);  // title(): the heading centered at the top of the drawing
            function draw() {  // draw(): redraws the picture and the description for the chosen arrangement
              const kids = [];  // kids collects every shape in the drawing
              mover = null;  // forgets the old migrating thread
              const top = 30, ph = H - 34;  // top and ph: where the process boxes start and how tall they are
              if (mode === '1:1') {  // 1:1 arrangement: three processes, one thread each
                const bw = (W - 16 - 2 * 8) / 3;  // bw is each process box's width
                kids.push(title('3 threads → 3 processes'));  // the heading: 3 threads, 3 processes
                [0, 1, 2].forEach((i) => { const x = 8 + i * (bw + 8); kids.push(...proc(x, top, bw, ph, NW ? 'Proc. ' + (i + 1) : 'Process ' + (i + 1), NW ? 'own space' : 'own address space', NW), wave(x + bw / 2, top + 40)); });  // three process boxes, each with its own address space and one thread (shorter labels on a phone)
              } else if (mode === 'M:1') {  // M:1 arrangement: one process with three threads
                const x = NW ? 10 : 40, w = W - 2 * x;  // the process box's left edge and width
                kids.push(title('3 threads → 1 process'), ...proc(x, top, w, ph, 'Process', NW ? 'one shared space + resources' : 'one shared address space + resources', false));  // the heading and the one big process box with its shared address space and resources
                [0, 1, 2].forEach((i) => kids.push(wave(W / 2 + (i - 1) * (NW ? 80 : 110), top + 40)));  // three threads inside that one process
              } else {  // 1:M and M:N arrangements: two computers, and a thread that moves between them
                const mn = mode === 'M:N';  // mn is true for M:N, which also has threads that stay put
                kids.push(title(mn ? (NW ? 'many threads; threads can move' : 'many threads per process, and threads can move') : (NW ? '1 thread that moves' : '1 thread that moves between process environments')));  // the heading for the chosen one (shorter on a phone)
                [0, 1].forEach((m) => kids.push(s('rect', { x: 6 + m * SHIFT, y: 28, width: CWID, height: H - 30, rx: 14, class: 's-muted', 'stroke-dasharray': '6 5', 'stroke-width': 1.5 }),  // two dashed boxes, one per computer
                  s('text', { x: 18 + m * SHIFT, y: 46, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 'Computer ' + 'AB'[m]),  // each labelled Computer A or Computer B
                  ...proc(16 + m * SHIFT, 54, CWID - 20, H - 64, (NW ? 'Env. ' : 'Process env. ') + 'AB'[m], NW ? 'space + resources' : 'address space + resources', NW)));  // each holding a process environment with its space and resources
                const sx = NW ? [36, 66] : [70, 125], mx = NW ? 128 : 210;  // sx: where the resident threads go; mx: where the migrating thread starts
                if (mn) [...sx, ...sx.map((x) => x + SHIFT)].forEach((x) => kids.push(wave(x, 90)));  // M:N only: two resident threads in each environment
                kids.push(s('rect', { x: W / 2 - 44, y: 106, width: 88, height: 24, rx: 12, class: 's-panel', 'stroke-width': 1.2 }),  // a small label between the computers...
                  s('text', { x: W / 2, y: 123, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'migrates ⇄'));  // ...saying "migrates"
                mover = s('g', { style: `transform: translate(${away ? SHIFT : 0}px, 0px); transition: transform .9s ease` }, wave(mx, 90),  // the migrating thread, placed on computer A or B; the CSS transition slides it smoothly across
                  s('text', { x: mx, y: 82, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--thread)' }, NW ? 'this one' : 'this thread'));  // its label, "this thread" (shorter on a phone)
                kids.push(mover);  // adds it to the drawing
              }  // ends the arrangement choice
              svg.replaceChildren(...kids.filter(Boolean));  // swaps in the new drawing
              const r = R[mode];  // r is the chosen arrangement's data
              info.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'baseline' } }, h('h3', { class: 'm0' }, r.t), h('span', { class: 'tp-note' }, 'threads : processes = ' + mode.replace(':', ' : '))), h('p', { class: 'm0 small', html: r.d }),  // fills the description card: the title with the ratio note, then the description
                h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'xs muted b' }, 'EXAMPLES'), ...r.ex.map((x) => h('span', { class: 'chip proc' }, x))));  // then the example systems as chips
            }  // ends draw()
            ctx.every(2200, () => { away = !away; if (mover) mover.style.transform = `translate(${away ? SHIFT : 0}px, 0px)`; });  // every 2.2 seconds while the step is open, sends the migrating thread to the other computer
            const seg = ctx.ui.seg(Object.keys(R).map((k) => ({ value: k, label: R[k].lab })), mode, (v) => { mode = v; draw(); });  // the four-way switch of arrangements
            seg.classList.add('tp');  // gives the switch the two-column "tp" layout
            ctx.$('.sec-4-2-s9l').append(seg, info,  // fills the left column: the switch and the description card
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake: M : 1 is not many-to-one', html: 'These ratios count <b>threads per process</b>. They are a different idea from the <b>many-to-one mapping</b> of the previous step, where many user-level threads share one kernel-level thread. A Linux process with 50 threads is “M threads : 1 process”, yet each of its threads has its own KLT (a one-to-one mapping).' }));  // a warning box: the M : 1 ratio is not the many-to-one mapping from the previous step
            /* ---- sorting game: which arrangement does each description show? ---- */
            const ITEMS = [  // ITEMS: the game's descriptions as [description, correct arrangement, reason]
              ['Classic UNIX: every running program is a process with exactly one thread of control.', '1:1', 'one path of execution per process.'],  // item: classic UNIX, 1:1
              ['A Linux web server process runs 50 threads that share its memory and open files.', 'M:1', 'many threads live inside one process and share it.'],  // item: a Linux web server with 50 threads, M:1
              ['Emerald: a thread follows the object it works on to another computer and carries on there.', '1:M', 'a single thread migrates between process environments.'],  // item: Emerald, a thread that follows its object, 1:M
              ['TRIX: a process holds many threads, and a thread can also move to another process environment.', 'M:N', 'many threads per process, plus migration.'],  // item: TRIX, many threads that can also move, M:N
              ['A Windows browser process starts a new thread for each file it downloads.', 'M:1', 'all those threads belong to the one browser process.'],  // item: a Windows browser with a thread per download, M:1
              ['Starting a new “thread” means creating a whole new process with its own address space.', '1:1', 'each thread needs a process of its own.'],  // item: every new thread is a whole new process, 1:1
              ['Ra, the kernel of the Clouds system: one thread can travel from one address space to another.', '1:M', 'one thread visits several process environments.'],  // item: Ra in the Clouds system, 1:M
            ];  // closes the ITEMS list
            const MEANS = { '1:1': 'That would mean each thread is a separate process of its own.', 'M:1': 'That would mean many threads that share one process and never leave it.', '1:M': 'That would mean one thread that migrates between process environments.', 'M:N': 'That would mean many threads per process that can also migrate.' };  // MEANS: what each wrong choice would mean, shown as a hint
            let order = ITEMS.map((_, i) => i), at = 0, tries = 0, right = 0, solved = false, res = [];  // order: the order the items are asked in; at: current item; tries, right, solved, res: scoring for the game
            const dots = h('div', { class: 'row', style: { gap: '6px', marginTop: 'auto' } });  // the row of progress chips at the bottom
            const paintDots = () => dots.replaceChildren(h('span', { class: 'xs muted b' }, 'PROGRESS'), ...ITEMS.map((_, i) => h('span', { class: 'chip ' + (res[i] || (i === at ? 'accent' : '')), title: res[i] === 'ok' ? 'right first try' : res[i] === 'warn' ? 'needed another try' : '' }, String(i + 1))),  // paintDots(): redraws the progress chips: green right first try, amber after another go, accent for the current one
              h('span', { class: 'xs muted' }, 'green = right first try, amber = needed another go'));  // and a key explaining the colors
            const scoreEl = h('span', { class: 'small b' });  // the running score
            const prompt = h('div', { class: 'card tight b', style: { minHeight: '50px', display: 'flex', alignItems: 'center', fontSize: '15.5px' } });  // the card showing the current description
            const fb = h('div', { class: 'small', style: { minHeight: '42px' } });  // the feedback line under the answers
            const nextB = h('button', { class: 'btn sm primary', onclick: () => { if (at < ITEMS.length - 1) { at++; show(); } else restart(); } }, 'Next →');  // the Next button: moves to the next item, or restarts after the last
            const opts = Object.keys(R).map((k) => h('button', { class: 'btn sm', onclick: () => pick(k) }, R[k].lab));  // one answer button per arrangement
            function show() {  // show(): displays the current item and resets the answer buttons
              const [txt] = ITEMS[order[at]];  // txt is the item's description
              tries = 0; solved = false; nextB.style.visibility = 'hidden'; opts.forEach((b) => { b.disabled = false; b.className = 'btn sm'; });  // resets the tries, hides Next, and re-enables and un-colors every answer button
              prompt.textContent = `${at + 1}/${ITEMS.length} · ${txt}`;  // shows "n/7" and the description
              fb.innerHTML = '<span class="muted">Which arrangement is this? Press your answer above.</span>';  // prompts for an answer
              scoreEl.textContent = `${right} right first try`; paintDots();  // updates the score and the progress chips
            }  // ends show()
            function pick(k) {  // pick(k): runs when the student presses an answer button
              if (solved) return;  // ignores presses once the item is solved
              const [, ans, why] = ITEMS[order[at]];  // the correct answer and its reason
              tries++;  // counts this attempt
              const b = opts[Object.keys(R).indexOf(k)];  // b is the button that was pressed
              if (k !== ans) { b.className = 'btn sm nope'; b.disabled = true; fb.innerHTML = `<b style="color:var(--bad)">Not ${R[k].lab}.</b> ${MEANS[k]} Try another.`; return; }  // a wrong answer: the button turns red and is disabled, and the hint says what that choice would mean
              solved = true; if (tries === 1) right++; res[at] = tries === 1 ? 'ok' : 'warn'; paintDots();  // a right answer: records first-try success or not and updates the progress chips
              b.className = 'btn sm okay';  // the button turns green
              mode = ans; seg.set(ans); draw();  // switches the diagram above to this arrangement
              const last = at === ITEMS.length - 1;  // last is true on the final item
              fb.innerHTML = `<b style="color:var(--ok)">Yes, ${nm(ans)}:</b> ${why}` + (last ? ` <b>All sorted: ${right} of ${ITEMS.length} right first try.</b>` : ' The diagram now shows it.');  // confirms the answer with its reason, and on the last item gives the final score
              scoreEl.textContent = `${right} right first try`;  // updates the score
              nextB.textContent = last ? 'Play again' : 'Next →'; nextB.style.visibility = 'visible';  // shows the Next button, or Play again after the last item
            }  // ends pick()
            function restart() { order = ctx.util.shuffle(ITEMS.map((_, i) => i)); at = 0; right = 0; res = []; show(); }  // restart(): shuffles the items and starts the game over
            ctx.$('.sec-4-2-s9r').append(svg,  // fills the right card: the drawing first
              h('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: '2px' } }, h('b', {}, 'Sort it: which threads : processes ratio?'), scoreEl),  // then the game's heading and score
              prompt, h('div', { class: 'row sec-4-2-ans', style: { gap: '8px', flexWrap: 'nowrap' } }, h('span', { class: 'small b' }, 'Answer:'), h('div', { class: 'tp-ans', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0, 1fr)' } : null }, ...opts), h('span', { class: 'grow' }), nextB), fb, dots);  // then the description, the answer buttons (one column on a phone) with Next, the feedback and the progress chips
            draw(); show();  // draws the first arrangement and the first item
          }  // closes the extra block
        },  // ends render() for step 9
      },  // ends step 9
      /* ---------------- 10. Recap ---------------- */
      {  // step 10 begins: the recap page
        title: 'Recap: ULT vs KLT at a glance',  // the step title shown at the top of the page
        kind: 'recap',  // the kind of step (recap), shown as a label above the title
        html: `${/* html: the fixed page content for the recap */''}
          <div class="split r fill">${/* two-column layout with the wider column on the right */''}
            <div class="stack" style="gap:8px">${/* the left column stacks the table and the tip */''}
              <table class="tbl compact">${/* the ULT-versus-KLT comparison table begins */''}
                <tr><th style="width:27%"></th><th style="width:36%">User-level threads</th><th>Kernel-level threads</th></tr>${/* header row: an empty corner, then the two designs, with fixed column widths */''}
                <tr><td class="b">Who manages threads</td><td>A thread library in user space</td><td>The kernel</td></tr>${/* table row: who manages the threads */''}
                <tr><td class="b">What the kernel schedules</td><td>The whole process</td><td>Each individual thread</td></tr>${/* table row: what the kernel schedules */''}
                <tr><td class="b">Thread switch</td><td>A library call: no mode switch</td><td>A mode switch into the kernel and back</td></tr>${/* table row: the cost of a thread switch */''}
                <tr><td class="b">One thread’s blocking call</td><td>Blocks every thread (unless jacketed)</td><td>Blocks only that thread</td></tr>${/* table row: what one thread's blocking call does */''}
                <tr><td class="b">Several processors</td><td>One thread of the process at a time</td><td>Threads run truly in parallel</td></tr>${/* table row: use of several processors */''}
                <tr><td class="b">Scheduling policy</td><td>Chosen by the application</td><td>The kernel’s policy</td></tr>${/* table row: who chooses the scheduling policy */''}
                <tr><td class="b">Needs OS support?</td><td>No: runs on any OS</td><td>Yes: kernel thread support</td></tr>${/* table row: whether the OS must support threads */''}
                <tr><td class="b">Null fork / signal-wait</td><td class="mono">34 / 37 µs</td><td class="mono">948 / 441 µs <span class="muted">(process: 11,300 / 1,840)</span></td></tr>${/* table row: the measured null fork and signal-wait times */''}
              </table>${/* ends the table */''}
              <div class="callout tip m0 small" data-label="The middle road">The combined approach creates and schedules threads in user space but maps M ULTs onto N ≤ M KLTs, keeping most of the speed of ULTs and the parallelism and independent blocking of KLTs.</div>${/* tip box: the combined approach keeps the best of both */''}
            </div>${/* ends the left column */''}
            <div class="stack sec-4-2-s9" style="gap:8px"><p class="m0 b">Say the answer out loud, then flip.</p></div>${/* the right column, which render() fills with flip cards under this instruction */''}
          </div>`,  // ends the layout and the HTML text
        render(el, ctx) {  // render(el, ctx): adds the flip cards to the right column when the recap is shown
          ctx.$('.sec-4-2-s9').append(ctx.ui.flipcards([  // flip cards: click one to turn it over and see the answer
            ['What is jacketing?', 'Library code that turns a blocking system call into a quick nonblocking check. If the call would block, the library runs another thread and retries later.'],  // card: what jacketing is
            ['Library says Running, kernel says Blocked. Bug?', 'No. With ULTs, when a system call blocks the process (or its time slice ends), no library code runs, so its table is not updated. The thread resumes when the process runs again.'],  // card: why the library can say Running while the kernel says Blocked
            ['Threads : processes ratios 1:1, M:1, 1:M, M:N: examples?', '1:1 traditional UNIX · M:1 Windows NT, Solaris, Linux, OS X, iOS · 1:M Ra (Clouds), Emerald · M:N TRIX. (Not the ULT-to-KLT mapping names.)'],  // card: examples of the four threads : processes ratios
            ['Why is a KLT operation slower than a ULT one?', 'It must enter the kernel: a mode switch in and out plus kernel bookkeeping. A process operation also sets up or switches a whole address space.'],  // card: why a KLT operation is slower than a ULT one
          ], { cols: 1, height: 104 }));  // ends the card list; one card per row, each 104 pixels tall
        },  // ends render() for the recap
      },  // ends the recap step
      /* ---------------- 11. Check yourself ---------------- */
      {  // the final step begins: the section quiz
        title: 'Check yourself',  // the step title shown at the top of the page
        kind: 'check',  // the kind of step (check), which the guide uses for quiz pages
        quiz: [  // quiz: the questions; the guide's quiz engine draws them, checks answers and gives feedback
          { q: 'A program uses pure user-level threads. Thread 2 calls read() on a file whose data is not in memory yet. What happens?',  // question 1 (multiple choice): what happens when a pure ULT calls read() and must wait
            choices: ['Only Thread 2 blocks; the library immediately runs Thread 1', 'The whole process blocks, and the library’s table still shows Thread 2 as Running', 'The kernel blocks Thread 2 and schedules Thread 1 of the same process', 'The call fails, because user-level threads may not make system calls'],  // the four choices
            answer: 1,  // the second choice is correct: the whole process blocks and the library still says Running
            feedback: ['That is what jacketing or kernel-level threads achieve. A plain read() is a real system call, and the kernel blocks the caller it knows about: the whole process.', null, 'The kernel cannot schedule Thread 1: with ULTs it does not even know Thread 1 exists.', 'ULTs can make system calls. The trouble is what the kernel does when one of those calls blocks.'],  // a hint for each wrong choice (null for the right one)
            why: 'With ULTs the kernel sees only the process, so a blocking system call blocks the process as a whole. No library code runs while the process is blocked, so the library still records Thread 2 as Running; when the I/O completes and the process runs again, Thread 2 simply continues.' },  // explanation shown after answering
          { type: 'tf', q: 'Switching between two user-level threads of the same process requires a mode switch into the kernel.', answer: false,  // question 2 (true or false): does a ULT switch need a mode switch? The answer is false
            why: 'A ULT switch is done by library code in user mode, so it avoids the two mode switches (into the kernel and back out) that a KLT switch needs.' },  // explanation: the library switches threads in user mode
          { type: 'multi', q: 'Which of these are advantages of kernel-level threads over pure user-level threads? Select all that apply.',  // question 3 (select all): the advantages of KLTs over pure ULTs
            choices: ['Threads of the same process can run at the same moment on different processors', 'If one thread blocks, another thread of the same process can still run', 'Kernel routines themselves can be multithreaded', 'Switching between threads of the same process needs no mode switch', 'Each application can pick its own thread-scheduling policy without kernel changes'],  // the five statements; the last two actually describe ULTs
            answer: [0, 1, 2],  // the first three are correct
            why: 'The first three are the classic KLT advantages. The last two describe ULTs: their switches stay in user mode, and their library can use any scheduling policy the application likes.' },  // explanation: the classic KLT advantages, and why the other two belong to ULTs
          { type: 'num', q: 'Creating an empty ULT (null fork) took 34 µs; creating an empty process took 11,300 µs. How many ULT creations fit in the time of one process creation? Round to the nearest whole number.',  // question 4 (calculate): how many ULT creations fit in one process creation
            answer: 332, tol: 1, unit: 'ULT creations',  // the answer is 332, accepting one either way
            why: '11,300 ÷ 34 ≈ 332.4, so about 332 ULT creations cost as much as creating one process.' },  // explanation: 11,300 divided by 34
          { type: 'num', q: 'Signal-wait took 37 µs with user-level threads and 441 µs with kernel-level threads. How many times slower is the KLT version? Give one decimal place.',  // question 5 (calculate): how many times slower KLT signal-wait is
            answer: 11.9, tol: 0.1, unit: '×',  // the answer is 11.9, accepting 0.1 either way
            why: '441 ÷ 37 ≈ 11.9. Most of the extra cost is the trip into the kernel and back that every KLT synchronization needs.' },  // explanation: 441 divided by 37, mostly the trip into the kernel
          { type: 'bucket', q: 'Does each statement describe user-level threads or kernel-level threads?', buckets: ['User-level threads', 'Kernel-level threads'],  // question 6 (sort into groups): does each statement describe ULTs or KLTs?
            items: [['The kernel keeps a context record for every thread', 1], ['Can run on an operating system that knows nothing about threads', 0], ['A thread switch needs a mode switch into the kernel', 1], ['One blocking system call stops every thread of the process', 0], ['The scheduling policy can be tailored to the application', 0], ['Two threads of one process can use two cores at the same moment', 1]],  // the statements, each paired with the index of its correct group
            why: 'ULTs live entirely in a user-space library: portable, cheap and customizable, but invisible to the kernel. KLTs are known to the kernel: parallel and independently blockable, but every switch goes through the kernel.' },  // explanation: ULTs are portable and cheap but invisible; KLTs are visible, parallel and slower to switch
          { type: 'order', q: 'A process uses ULTs, and Thread 2 makes a blocking system call. Put the events in order.',  // question 7 (put in order): the events when a ULT makes a blocking system call
            items: ['Thread 2 makes the system call and the CPU enters the kernel', 'The kernel starts the I/O and moves the process to Blocked', 'The kernel runs another process; the library still lists Thread 2 as Running', 'The I/O completes and the kernel moves the process to Ready', 'The process is dispatched and execution resumes inside Thread 2'],  // the events in their correct order; the quiz shuffles them for the student
            why: 'Every state change here happens in the kernel, at the level of the whole process. The library is frozen along with the process, so Thread 2’s entry in the library’s table never changes.' },  // explanation: every change happens in the kernel, and the library's table never changes
          { type: 'match', q: 'Match each threads : processes ratio (threads per process, not the ULT-to-KLT mapping) with its meaning and an example system.',  // question 8 (match the pairs): each threads : processes ratio with its meaning and example
            pairs: [['1 : 1', 'Each thread is its own process (UNIX)'], ['M : 1', 'Threads share one process (Windows NT)'], ['1 : M', 'One thread migrates (Emerald, Ra)'], ['M : N', 'Many threads that migrate (TRIX)']],  // the four ratio/meaning pairs; the quiz shuffles the right-hand side
            why: 'The ratio is threads : processes. 1 : 1 gives every thread its own process (traditional UNIX); M : 1 packs many threads into one process (Windows NT, Solaris, Linux, OS X, iOS); 1 : M lets a single thread move between process environments (Emerald, Ra on Clouds); M : N combines the last two (TRIX). This is a different idea from the many-to-one ULT-to-KLT mapping: a Linux process is M : 1 here, yet each of its threads has its own kernel-level thread.' },  // explanation: what each ratio means, with examples
          { q: 'What does jacketing do?',  // question 9 (multiple choice): what jacketing does
            choices: ['Converts a blocking system call into a nonblocking check, so the thread library can run another thread instead of letting the process block', 'Wraps each ULT in its own process so the kernel can see it', 'Lets the kernel read the thread library’s table so it can schedule individual ULTs', 'Lengthens the process’s time slice so a blocked thread has time to finish'],  // the four choices
            answer: 0,  // the first choice is correct
            feedback: [null, 'That would turn threads into processes (the other workaround), which gives up cheap thread switching.', 'The kernel still never sees the ULTs; jacketing works entirely inside the library.', 'Time slices have nothing to do with it; the problem being solved is blocking system calls.'],  // a hint for each wrong choice
            why: 'The jacket first asks the kernel, without waiting, whether the call would block. If it would, the library parks the thread and runs another one, retrying later, so the process as a whole never blocks.' },  // explanation: the jacket checks without waiting and runs another thread if the call would block
          { q: 'Which statement best describes the combined (hybrid) approach, as used by older versions of Solaris?',  // question 10 (multiple choice): the best description of the combined approach
            choices: ['Threads are created and mostly scheduled in user space, and M user-level threads are mapped onto N ≤ M kernel-level threads', 'Every kernel-level thread is split into several processes so the kernel can schedule them', 'The kernel creates every thread and the library only gives them names', 'Each ULT always gets exactly one KLT, and the programmer cannot change the number'],  // the four choices
            answer: 0,  // the first choice is correct
            feedback: [null, 'This mixes up threads and processes; the hybrid is about mapping ULTs onto KLTs.', 'In the hybrid, creation happens in user space, which is what keeps it cheap.', 'N may be smaller than M, and the programmer can tune it for the application and the machine.'],  // a hint for each wrong choice
            why: 'The library does most thread work cheaply in user space, while the N kernel-level threads let the process use several processors and keep one blocking call from stopping everything.' },  // explanation: cheap user-space thread work plus N kernel-level threads for parallelism
          { type: 'tf', q: 'When a clock interrupt ends the time slice of a process that uses ULTs, the thread library changes the running thread’s state to Ready.', answer: false,  // question 11 (true or false): does the library mark a thread Ready at a clock interrupt? The answer is false
            why: 'The kernel moves the process to Ready. The library does not run at all during this, so its table still shows the thread as Running, and that thread simply continues when the process is dispatched again.' },  // explanation: the kernel moves the process to Ready while the library does not run at all
          { q: 'Process B uses user-level threads. Thread 2 is running and must wait until Thread 1 fills a buffer, so it calls the library’s wait routine. Which states result?',  // question 12 (multiple choice): the states after one ULT waits for another in the library
            choices: ['Library: Thread 2 Blocked, Thread 1 Running. Kernel: B stays Running', 'Library: Thread 2 Blocked, Thread 1 Running. Kernel: B becomes Blocked', 'Library: Thread 2 still Running. Kernel: B becomes Blocked', 'Library: Thread 2 Blocked, Thread 1 Ready. Kernel: B becomes Ready'],  // the four combinations of library and kernel states
            answer: 0,  // the first choice is correct
            feedback: [null, 'The kernel was never asked to do anything: the wait was a plain library call, not a system call, so the kernel has no reason to block B.', 'That is what happens when Thread 2 makes a blocking system call. Waiting for another thread of the same process is handled by the library alone.', 'Nothing stops B from running: the library switches straight to Thread 1, which can do useful work. B only becomes Ready when the kernel takes the processor away, for example at the end of its time slice.'],  // a hint for each wrong choice
            why: 'Waiting for another thread is a library matter. The library blocks Thread 2 and switches to Thread 1 in user mode, while the kernel keeps seeing process B executing instructions, so B stays Running.' },  // explanation: waiting for another thread is handled by the library alone, so B stays Running
        ],  // closes the quiz list
      },  // ends the quiz step
    ],  // closes the list of steps

    notes: `${/* notes: the section summary shown in the Notes drawer (N key) and in the printable guide, written as HTML text */''}
<h3>Two ways to manage threads</h3>${/* notes heading: two ways to manage threads */''}
<p>Every thread needs a manager: something must create it, decide when it runs, and save and restore its place when it pauses. With <b>user-level threads (ULTs)</b> a thread library inside the application does that job and the kernel never learns the threads exist. With <b>kernel-level threads (KLTs)</b>, also called kernel-supported threads or lightweight processes (the general name for a thread from section 4.1; Solaris gives it a narrower meaning, see 4.5), the kernel manages every thread itself. A <b>combined approach</b> mixes the two.</p>${/* notes paragraph: every thread needs a manager; ULTs use a library, KLTs use the kernel */''}

<h3>User-level threads</h3>${/* notes heading: user-level threads */''}
<p>The application manages its own threads through a <b>thread library</b>: ordinary routines linked into the program that run in user mode. Its four jobs: <b>create and destroy threads</b>, <b>pass messages and data between threads</b>, <b>schedule</b> which thread runs next, and <b>save and restore thread contexts</b> (program counter, stack pointer and other registers). The kernel knows none of this: it schedules the <b>process as a single unit</b> with one execution state (Running, Ready or Blocked).</p>${/* notes paragraph: the thread library, its four jobs, and what the kernel sees */''}

<h4>How ULT states relate to the process state</h4>${/* notes subheading: how ULT states relate to the process state */''}
<p>Start: process B has two ULTs; the library says Thread 2 Running, Thread 1 Ready; the kernel says B Running.</p>${/* notes paragraph: the starting states for the three scenarios */''}
<table>${/* starts the scenario table */''}
<tr><th>Scenario</th><th>Kernel’s record for B</th><th>Library’s table</th></tr>${/* header row: scenario, the kernel's record, the library's table */''}
<tr><td>a) Thread 2 makes a blocking system call (e.g. read)</td><td>B → Blocked while the I/O runs; then Ready, later Running.</td><td>Unchanged: Thread 2 still “Running”, Thread 1 Ready but unable to run. B resumes inside Thread 2.</td></tr>${/* table row: scenario a, a blocking system call */''}
<tr><td>b) Clock interrupt: B’s time slice is used up</td><td>B → Ready; later Running.</td><td>Unchanged: Thread 2 still “Running”.</td></tr>${/* table row: scenario b, the time slice runs out */''}
<tr><td>c) Thread 2 needs some action by Thread 1</td><td>B stays Running the whole time.</td><td>Thread 2 → Blocked, Thread 1 → Running (a library thread switch). Later Thread 2 → Ready.</td></tr>${/* table row: scenario c, one thread waits for another */''}
</table>${/* ends the scenario table */''}
<p>In a) and b) the library’s “Running” is only a belief: none of B’s code runs, so nothing updates the table.</p>${/* notes paragraph: in scenarios a and b the library's "Running" is only a belief */''}

<h4>Advantages of ULTs</h4>${/* notes subheading: advantages of ULTs */''}
<ol>${/* starts the numbered list of advantages */''}
<li><b>Cheap switches.</b> Every thread record lives in the process’s own memory, so switching threads never needs kernel-mode privileges and skips the two mode switches (user → kernel and kernel → user).</li>${/* notes item: cheap switches with no mode switch */''}
<li><b>Custom scheduling.</b> Each application can use the policy that suits it (say, favour its UI thread) without touching the kernel’s scheduler.</li>${/* notes item: each application can choose its own scheduling */''}
<li><b>Runs on any OS.</b> The library is ordinary application code, so the kernel needs no changes and no thread support.</li>${/* notes item: ULTs run on any OS */''}
</ol>${/* ends the list of advantages */''}
<h4>Disadvantages of ULTs</h4>${/* notes subheading: disadvantages of ULTs */''}
<ol>${/* starts the numbered list of disadvantages */''}
<li><b>A blocking system call blocks every thread of the process</b>, because the kernel blocks the only thing it knows: the process.</li>${/* notes item: one blocking call blocks every thread */''}
<li><b>No true multiprocessing.</b> The kernel assigns a process to one processor at a time, so only one thread of the process can execute at any moment.</li>${/* notes item: only one thread of the process runs at a time, even on a multiprocessor */''}
</ol>${/* ends the list of disadvantages */''}
<p>Example: 3 threads × 4 ticks of CPU, and Thread 2 reads the disk for 4 ticks. On one core ULTs take 16 ticks (the process sits blocked for 4) and KLTs 12; on two cores KLTs take 8 (6 with no read), while ULTs still take 16 and never use core 2.</p>${/* notes paragraph: the simulator's finish times for each set-up */''}

<h4>Working around the limits</h4>${/* notes subheading: working around the limits */''}
<ul>${/* starts the list of workarounds */''}
<li><b>Write the application as multiple processes</b> instead of threads. This fixes both limits, but every switch becomes a costly process switch.</li>${/* notes bullet: use several processes instead of threads */''}
<li><b>Jacketing</b> (fixes blocking only): turn a blocking system call into a nonblocking one. The “jacket” first asks the kernel, without waiting, whether the call would block. If so, the library marks the thread waiting, runs another thread and checks again later; the real call is made only when it will return at once.</li>${/* notes bullet: jacketing, and how it works */''}
</ul>${/* ends the list of workarounds */''}
<pre>int jacket_read(int fd, char *buf, int n) { // replaces read()${/* notes code block, line 1: jacket_read() takes the place of read() */''}
  while (!io_ready(fd)) {  // would read block? (quick check)${/* notes code, line 2: loop while a read would block */''}
    mark_waiting(me, fd);  // yes: this thread waits${/* notes code, line 3: record that this thread is waiting */''}
    thread_yield();        // run another thread meanwhile${/* notes code, line 4: let another thread run meanwhile */''}
  }                        // resumed later: check again${/* notes code, line 5: check again when this thread resumes */''}
  return read(fd, buf, n); // data ready: cannot block${/* notes code, line 6: the data is ready, so the real read cannot block */''}
}                          // caller never knew</pre>${/* notes code, line 7: end of the jacket, and end of the code block */''}

<h3>Kernel-level threads</h3>${/* notes heading: kernel-level threads */''}
<p>With KLTs the application contains no thread-management code; it asks the kernel for threads through system calls. The kernel keeps one record for the process <b>and</b> a saved context for each of its threads, and its scheduler chooses among <b>threads</b>, not whole processes. Windows and Linux work this way.</p>${/* notes paragraph: the kernel keeps a record per thread and schedules threads */''}
<h4>Advantages</h4>${/* notes subheading: advantages of KLTs */''}
<ol>${/* starts the list of KLT advantages */''}
<li>Several threads of one process can run on several processors at the same time.</li>${/* notes item: threads of one process can run in parallel */''}
<li>If one thread of a process blocks, the kernel can schedule another thread of the same process.</li>${/* notes item: one blocked thread does not stop the others */''}
<li>Kernel routines themselves can be multithreaded.</li>${/* notes item: kernel routines can be multithreaded */''}
</ol>${/* ends the list of KLT advantages */''}
<h4>Disadvantage</h4>${/* notes subheading: the disadvantage of KLTs */''}
<p>Handing the processor from one thread to another <b>of the same process</b> has to go through the kernel: a mode switch in, and another back out. KLTs win on blocking and parallelism, not on switch speed.</p>${/* notes paragraph: a switch within one process goes through the kernel */''}

<h3>What it costs: measured latency</h3>${/* notes heading: measured latency */''}
<p>Two classic benchmarks, both measured on the same older single-processor machine. <b>Null fork</b> measures pure creation overhead: make a thread or process whose body is empty, schedule it, let it run and finish. <b>Signal-wait</b> measures synchronization overhead: one thread or process wakes a waiting partner and then waits itself.</p>${/* notes paragraph: what the null fork and signal-wait benchmarks measure */''}
<table>${/* starts the latency table */''}
<tr><th>Operation (µs)</th><th>ULT</th><th>KLT</th><th>Process</th></tr>${/* header row: operation, ULT, KLT, process */''}
<tr><td>Null fork</td><td>34</td><td>948</td><td>11,300</td></tr>${/* table row: null fork times */''}
<tr><td>Signal-wait</td><td>37</td><td>441</td><td>1,840</td></tr>${/* table row: signal-wait times */''}
</table>${/* ends the latency table */''}
<p>Worked examples: 11,300 ÷ 34 ≈ 332, so one process creation costs about 332 ULT creations; 948 ÷ 34 ≈ 27.9 and 11,300 ÷ 948 ≈ 11.9. For signal-wait, 441 ÷ 37 ≈ 11.9 and 1,840 ÷ 441 ≈ 4.2. Creating 1,000 threads takes 1,000 × 34 µs = 34 ms with ULTs, 948 ms with KLTs and 11.3 s with processes; at 1,000 creations every second that is 3.4% of a processor, 94.8%, or more than the machine has.</p>${/* notes paragraph: worked ratio and total-time examples from the table */''}
<p>Why the gaps: a ULT operation is a library call; a KLT operation must enter the kernel (mode switches plus bookkeeping); a process operation also builds or switches a whole address space. Today’s numbers are smaller but the pattern holds, and if most thread switches need kernel services anyway, the ULT advantage shrinks.</p>${/* notes paragraph: why the gaps exist, and why they matter less today */''}

<h3>Combined approach</h3>${/* notes heading: the combined approach */''}
<p>Some systems mix both designs; older Solaris is the classic example (see 4.5). The application creates its threads with library calls, and the library also does most of their <b>scheduling and synchronization</b>, all in user space. Underneath, the library runs the application’s M user-level threads on a <b>smaller or equal number N</b> of kernel-level threads, and the programmer can tune N for the application and the machine. Done well, most thread operations stay cheap, threads can run in parallel on several processors, and one blocking call need not stop the whole process. With N = 1 it behaves like pure ULTs (often called <b>many-to-one</b>); with one KLT per ULT it behaves like pure KLTs (<b>one-to-one</b>); in between it is <b>many-to-many</b>.</p>${/* notes paragraph: M user-level threads on N kernel-level threads, with most work done in user space */''}

<h3>Other arrangements: threads per process</h3>${/* notes heading: threads per process */''}
<table>${/* starts the arrangements table */''}
<tr><th>Threads : processes</th><th>Meaning</th><th>Examples</th></tr>${/* header row: ratio, meaning, examples */''}
<tr><td>1 : 1 (1 thread : 1 process)</td><td>Every path of execution is its own process, with a private address space and resources.</td><td>Traditional UNIX</td></tr>${/* table row: 1 : 1 */''}
<tr><td>M : 1 (M threads : 1 process)</td><td>One process owns the address space and resources; many threads run inside it and share them.</td><td>Windows NT, Solaris, Linux, OS X, iOS</td></tr>${/* table row: M : 1 */''}
<tr><td>1 : M (1 thread : M processes)</td><td>A thread can migrate out of one process environment into another, even on another computer.</td><td>Ra (Clouds), Emerald</td></tr>${/* table row: 1 : M */''}
<tr><td>M : N (M threads : N processes)</td><td>Both at once: many threads per process, and threads can migrate.</td><td>TRIX</td></tr>${/* table row: M : N */''}
</table>${/* ends the arrangements table */''}
<p>M : 1 (many threads in one process) is the everyday case; 1 : M and M : N come from distributed-systems research. Do not confuse these threads : processes ratios with the one-to-one / many-to-one / many-to-many names for mapping ULTs onto KLTs; they answer different questions. A Linux process running 50 threads is “M threads : 1 process”, yet each of those threads has its own kernel-level thread, so its ULT-to-KLT mapping is one-to-one, not many-to-one. Each ratio describes one process, whereas the four models of section 4.1 describe a whole system: Windows, for example, runs many processes, and each of them is M : 1.</p>`,  // notes paragraph: M : 1 is the everyday case, and these ratios are not the ULT-to-KLT mapping names; the notes end here
  });  // closes the section object and the call that registers it with the guide
})();  // ends the wrapper function and runs it straight away
