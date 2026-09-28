// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   5.3  Mutual Exclusion: Hardware Support
   Two kinds of help from the hardware: (1) switching interrupts off on a
   single processor, (2) atomic machine instructions (compare_and_swap and
   exchange) that let any number of processes, on any number of processors
   sharing memory, build a spinlock. Then the price: busy waiting,
   starvation and a priority deadlock.
   All helpers live in this IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in an arrow function that runs once, right away, so its helper names stay private to this file
  /* ---------------- small shared helpers ---------------- */
  const PN = (i) => `<b class="pc${i}">P${i}</b>`;                 // coloured process name
  const TOK = (i) => `<span class="tok p${i}">P${i}</span>`;       // pill-shaped process token

  /* A code listing (ctx.ui.code) with an extra gutter that can hold process markers.
     marks({ 3: [1, 2] }) puts P1 and P2 pointers on line 3 and tints that line. */
  function listing(ctx, src, o = {}) {  // listing(ctx, src, o): builds a highlighted code box and adds a gutter in front of each line for process markers
    const pre = ctx.ui.code(src, Object.assign({ lang: 'c' }, o));  // ctx.ui.code draws the source as numbered, colored lines; C is the default language unless o says otherwise
    const lines = Array.from(pre.querySelectorAll('.ln'));  // collects the line elements (one span per source line) so the markers can be attached line by line
    const guts = lines.map((ln) => { const g = ctx.h('span', { class: 'gut' }); ln.prepend(g); return g; });  // puts an empty gutter span at the start of every line and keeps the gutters in a list, same order as the lines
    pre.marks = (map) => {  // pre.marks(map): called by each animation to show which process is on which line right now
      lines.forEach((ln, k) => {  // visits every line once so old markers are wiped and new ones drawn in the same pass
        const who = (map && map[k + 1]) || [];  // who lists the processes currently on this line (map uses 1-based line numbers, so k + 1); empty if none
        guts[k].innerHTML = who.map((i) => `<i class="mk p${i}">P${i}</i>`).join('');  // fills the gutter with one small colored badge per process, such as P1 or P2
        ln.classList.toggle('on1', who.length === 1);  // class on1 tints the line when exactly one process is there
        ln.classList.toggle('on2', who.length > 1);  // class on2 uses a neutral gray tint when two or more processes sit on the same line
        ln.dataset.who = who.length === 1 ? who[0] : '';  // remembers which single process is here so the CSS can pick that process's color (empty when 0 or 2+)
      });  // ends the loop over lines
    };  // ends pre.marks
    return pre;  // hands back the code box, now with its extra marks() method
  }  // ends listing()

  /* A memory cell: name on top, big value underneath. */
  function cell(ctx, name, cls = '') {  // cell(ctx, name, cls): builds a small box that looks like one memory word or register, with a label and a value
    const v = ctx.h('div', { class: 'v' });  // v is the big value area inside the box; it is filled later by set()
    const el = ctx.h('div', { class: 'cell ' + cls }, ctx.h('div', { class: 'nm', html: name }), v);  // the outer box: the name on top (HTML allowed, e.g. bold) and the value underneath; cls can add a color variant
    el.set = (val, flash) => { v.innerHTML = String(val); if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } };  // el.set(val, flash): writes a new value; with flash it restarts the short highlight animation (reading offsetWidth forces the restart)
    return el;  // returns the finished box so a step can place it on screen
  }  // ends cell()

  /* A verdict box whose colour follows the outcome (ok | bad | warn | info). */
  function verdict(ctx) {  // verdict(ctx): builds the message box that reports what just happened in a lab
    const el = ctx.h('div', { class: 'vbox', 'aria-live': 'polite' });  // aria-live="polite" makes screen readers read the new message aloud after it changes
    el.say = (cls, html) => { el.className = 'vbox ' + (cls || ''); el.innerHTML = html; };  // el.say(cls, html): swaps the color class (ok, bad, warn or info) and replaces the message text in one call
    return el;  // returns the verdict box
  }  // ends verdict()

  Guide.section({  // registers this section with the guide's shell, which builds its pages, glossary and quiz from the object below
    id: '5.3',  // id: the section number used in links, saved progress and CSS class names (sec-5-3)
    title: 'Mutual Exclusion: Hardware Support',  // title shown at the top of every step in this section
    short: 'Hardware support',  // short name used in the table of contents where space is tight
    summary: 'Disabling interrupts, compare_and_swap and exchange: how hardware makes locks, and what they cost.',  // one-sentence summary shown on the chapter overview page
    objectives: [  // objectives: what a student should be able to do after this section, listed on the overview
      'Explain why disabling interrupts guarantees mutual exclusion on a uniprocessor, and name its two costs.',  // objective 1: why switching interrupts off works on one processor, and its two costs
      'Trace compare_and_swap and exchange step by step, and use each one to build a spinlock.',  // objective 2: trace the two atomic instructions and build a lock from each
      'Explain why the read and the write of a lock must happen as one atomic instruction.',  // objective 3: why reading and writing the lock must be one indivisible action
      'State and check the exchange invariant: bolt plus the sum of all keys equals n.',  // objective 4: the exchange invariant (bolt plus all keys equals n)
      'List the advantages and disadvantages of the machine-instruction approach, including busy waiting, starvation and the priority deadlock.',  // objective 5: pros and cons of the instruction approach, including busy waiting, starvation and priority deadlock
    ],  // closes the objectives list
    terms: [  // terms: glossary entries as [term, definition] pairs; the shell links these words wherever they appear
      ['Uniprocessor', 'A computer with exactly one processor. Its processes can take turns (interleave) but never run at the same instant.'],  // glossary entry: defines a uniprocessor (a machine with one processor)
      ['Multiprocessor', 'A computer with two or more processors that share one main memory. Processes on different processors really do run at the same instant.'],  // glossary entry: defines a multiprocessor (several processors sharing one memory)
      ['Interleaving', 'Running pieces of several processes one after another on a processor, switching between them, so they appear to run together.'],  // glossary entry: defines interleaving (taking turns on one processor)
      ['Overlapping (true parallelism)', 'Two processes executing at literally the same moment, which is only possible when there is more than one processor.'],  // glossary entry: defines overlapping, meaning real simultaneous execution on several processors
      ['Interrupt', 'A signal from hardware (a timer, a disk, a network card) that makes the processor pause the running program and jump to operating-system code. The OS may then switch to another process.'],  // glossary entry: defines an interrupt, the hardware signal that can hand the processor to the OS
      ['Interrupt disabling', 'Getting mutual exclusion on one processor by switching interrupts off just before a critical section and back on just after it, so nothing can take the processor away in between.'],  // glossary entry: defines interrupt disabling as a way to get mutual exclusion on one processor
      ['Pending interrupt', 'An interrupt that arrived while interrupts were switched off. The hardware remembers it and delivers it as soon as interrupts are switched back on.'],  // glossary entry: defines a pending interrupt, held by the hardware until interrupts come back on
      ['Privileged instruction', 'An instruction that only the operating system kernel may execute. Switching interrupts off is one, so ordinary programs cannot use it.'],  // glossary entry: defines a privileged instruction, one only the kernel may run
      ['Critical section', 'A stretch of code that uses a shared resource. While one process is inside it, no other process may be inside a critical section for that same resource.'],  // glossary entry: defines a critical section
      ['Mutual exclusion', 'The guarantee that while one process is inside its critical section for a resource, no other process is inside a critical section for that same resource.'],  // glossary entry: defines mutual exclusion
      ['Atomic instruction', 'A machine instruction whose parts (for example, read a memory word and then write it) happen as one indivisible action. No other process or processor can get in between the parts.'],  // glossary entry: defines an atomic instruction, whose parts cannot be split by anyone else
      ['compare_and_swap (compare and exchange)', 'An atomic instruction that reads a memory word, compares it with a test value, writes a new value only if the two match, and returns the old value. Often abbreviated CAS.'],  // glossary entry: defines compare_and_swap (CAS)
      ['Exchange instruction', 'An atomic instruction that swaps the contents of a register and a memory word in one indivisible step.'],  // glossary entry: defines the exchange instruction (swap a register with a memory word)
      ['Lock variable (bolt)', 'A shared memory word that says whether the lock is free (0) or taken (1). In this section it is called bolt.'],  // glossary entry: defines the lock variable, called bolt in this section
      ['Invariant', 'A condition on a program’s variables that must be true whenever no update is in progress. In the exchange lock every update is one atomic swap, so the invariant holds after every step, which makes it a tool for proving the lock correct.'],  // glossary entry: defines an invariant and why it helps prove the exchange lock correct
      ['Busy waiting (spin waiting)', 'Waiting by running a loop that tests a condition again and again. The waiting process keeps using processor time while doing no useful work.'],  // glossary entry: defines busy waiting (spinning in a test loop)
      ['Spinlock', 'A lock where a process that finds it taken busy-waits, testing it over and over, until it becomes free.'],  // glossary entry: defines a spinlock
      ['Starvation', 'A situation in which a process that wants to enter waits indefinitely because others are always chosen ahead of it.'],  // glossary entry: defines starvation
      ['Deadlock', 'A permanent standstill: each process in a group waits for something that only another waiting process in the group can provide, so none can ever continue.'],  // glossary entry: defines deadlock
      ['Priority scheduling', 'A dispatching rule that always gives the processor to the highest-priority process that is ready to run.'],  // glossary entry: defines priority scheduling
    ],  // closes the terms list
    css: ` /* css: style rules for this section only; every rule starts with .sec-5-3 so it cannot affect other sections */
      .sec-5-3 pre.code { contain: inline-size; } /* contain: inline-size stops a wide code box from stretching the page sideways; it scrolls inside instead */
      .sec-5-3 .step-eyebrow { contain: inline-size; }   /* shell workaround: a long nowrap eyebrow must not widen the phone layout */
      .sec-5-3 .pc1 { color: var(--proc); } .sec-5-3 .pc2 { color: var(--accent); } .sec-5-3 .pc3 { color: var(--io); } /* gives each process its own text color: P1 uses the processor color, P2 the accent color, P3 the I/O color */
      .sec-5-3 .tok { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 26px; padding: 0 8px; border-radius: 999px; border: 2px solid; font-weight: 800; font-size: 14px; line-height: 1; } /* .tok is the pill-shaped process badge: rounded ends, a colored border and bold centered text */
      .sec-5-3 .tok.p1 { color: var(--proc); background: var(--proc-bg); border-color: var(--proc); } /* P1's badge colors: processor-colored text and border on a light matching background */
      .sec-5-3 .tok.p2 { color: var(--accent); background: var(--accent-bg); border-color: var(--accent); } /* P2's badge colors, in the accent color */
      .sec-5-3 .tok.p3 { color: var(--io); background: var(--io-bg); border-color: var(--io); } /* P3's badge colors, in the I/O color */
      .sec-5-3 pre.code .gut { display: inline-flex; gap: 2px; width: 50px; vertical-align: top; } /* the marker gutter in front of each code line: a fixed 50px wide row so the code text lines up */
      .sec-5-3 pre.code .mk { font-style: normal; font-family: var(--font); font-size: 11px; font-weight: 800; line-height: 1; padding: 3px 4px; border-radius: 5px; color: var(--accent-ink); } /* the small process markers inside the gutter: tiny bold labels on a colored background */
      .sec-5-3 pre.code .mk.p1 { background: var(--proc); } .sec-5-3 pre.code .mk.p2 { background: var(--accent); } .sec-5-3 pre.code .mk.p3 { background: var(--io); } /* marker background colors for P1, P2 and P3, matching their badges */
      .sec-5-3 pre.code .ln.on2 { background: color-mix(in srgb, var(--ink) 8%, transparent); border-left-color: var(--ink-2); } /* a line holding two or more processes gets a light gray tint and a darker left edge */
      .sec-5-3 pre.code .ln.on1[data-who="1"] { background: color-mix(in srgb, var(--proc) 14%, transparent); border-left-color: var(--proc); } /* a line holding only P1 is tinted with P1's color, so students see where P1 is at a glance */
      .sec-5-3 pre.code .ln.on1[data-who="2"] { background: color-mix(in srgb, var(--accent) 14%, transparent); border-left-color: var(--accent); } /* a line holding only P2 is tinted with P2's color */
      .sec-5-3 pre.code .ln.on1[data-who="3"] { background: color-mix(in srgb, var(--io) 14%, transparent); border-left-color: var(--io); } /* a line holding only P3 is tinted with P3's color */
      .sec-5-3 .cell { border: 2px solid var(--mem); background: var(--mem-bg); border-radius: 10px; padding: 3px 8px; text-align: center; min-width: 0; } /* .cell is the memory-word box: memory-colored border and background, rounded corners, centered text */
      .sec-5-3 .cell .nm { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--ink-2); } /* the cell's name label: small bold monospaced (fixed-width) text in a muted color */
      .sec-5-3 .cell .v { font-family: var(--mono); font-size: 22px; font-weight: 800; line-height: 1.25; } /* the cell's value: large bold monospaced digits so the lock value is easy to read from a distance */
      .sec-5-3 .cell.cpu { border-color: var(--cpu); background: var(--cpu-bg); } /* a cell with class cpu is a processor register, so it uses the processor colors instead of memory colors */
      .sec-5-3 .vbox { border-radius: 12px; padding: 8px 12px; border: 1px solid var(--line); border-left: 5px solid var(--accent); background: var(--panel-2); font-size: 15px; line-height: 1.45; } /* .vbox is the verdict box: rounded, with a thick colored left edge that signals the kind of message */
      .sec-5-3 .vbox.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* an ok verdict turns the edge and background green-toned for a success */
      .sec-5-3 .vbox.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* a bad verdict turns them red-toned for a broken rule, such as two processes inside */
      .sec-5-3 .vbox.warn { border-left-color: var(--warn); background: var(--warn-bg); } /* a warn verdict uses the warning color for something wasteful but not wrong, such as spinning */
      .sec-5-3 .vbox.info { border-left-color: var(--info); background: var(--info-bg); } /* an info verdict uses the neutral information color for plain explanations */
      .sec-5-3 .hot { cursor: pointer; } /* .hot marks clickable parts of a drawing, so the mouse pointer turns into a hand over them */
      .sec-5-3 .room { border: 2px dashed var(--line-2); border-radius: 12px; padding: 6px 10px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 64px; min-width: 240px; background: var(--panel); } /* .room is the dashed box that stands for the critical section; tokens of processes inside it are shown here */
      .sec-5-3 .room .xs { font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); } /* the small label inside the room: bold, spaced-out capital letters in a muted color */
      .sec-5-3 .room.one { border-style: solid; border-color: var(--ok); background: var(--ok-bg); } /* class one: exactly one process inside, so the room turns solid green (mutual exclusion holds) */
      .sec-5-3 .room.two { border-style: solid; border-color: var(--bad); background: var(--bad-bg); } /* class two: two processes inside at once, so the room turns solid red (mutual exclusion is broken) */
      .sec-5-3 .log > div.bad { color: var(--bad); font-weight: 700; } /* a log line marked bad is red and bold, so a violation stands out in the event list */
      .sec-5-3 .log > div.ok { color: var(--ok); font-weight: 700; } /* a log line marked ok is green and bold, used for a successful entry into the room */
      .sec-5-3 .log > div.spin { color: var(--muted); } /* a log line marked spin is gray, because a failed test while spinning is routine, not news */
      .sec-5-3 .pc4 { color: var(--thread); } /* a fourth process color, P4, uses the thread color */
      .sec-5-3 .tok.p4 { color: var(--thread); background: var(--thread-bg); border-color: var(--thread); } /* P4's pill badge colors, in the thread color */
      .sec-5-3 .tok.win { box-shadow: 0 0 0 3px var(--hl); } /* .win puts a highlighted ring around the badge of the process that just won the lock */
      .sec-5-3 .legend-sw { display: inline-block; width: 14px; height: 14px; border-radius: 4px; border: 2px solid; vertical-align: -2px; margin-right: 4px; } /* .legend-sw is a small colored square used in legends to show what each color means */
      .sec-5-3 .vbox .btn { margin: 4px 6px 0 0; } /* spaces out any buttons placed inside a verdict box */
      .sec-5-3 svg .cl-rem { fill: color-mix(in srgb, var(--proc) 22%, var(--panel)); stroke: var(--proc); } /* in the spin charts, cl-rem colors time spent outside the critical section (in the rest of the program) */
      .sec-5-3 svg .cl-spin { fill: color-mix(in srgb, var(--warn) 45%, var(--panel)); stroke: var(--warn); } /* cl-spin colors time wasted busy-waiting, in a warning tone */
      .sec-5-3 svg .cl-in { fill: color-mix(in srgb, var(--ok) 45%, var(--panel)); stroke: var(--ok); } /* cl-in colors time spent inside the critical section, in green */
      .sec-5-3 .sb-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding: 5px 8px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); font-size: 14.5px; line-height: 1.3; } /* .sb-row is one row of the recap scorecard: a statement plus two answer buttons laid out in a grid */
      .sec-5-3 .sb-row.good { border-color: var(--ok); background: var(--ok-bg); } /* a row answered correctly gets a green border and background */
      .sec-5-3 .sb-row.oops { border-color: var(--bad); background: var(--bad-bg); } /* a row answered wrongly gets a red border and background */
    `,  // end of the section's CSS text
    steps: [  // steps: the pages of this section, in the order students move through them
      /* ============ 1. Big Picture: the gap between "look" and "lock" ============ */
      {  // opens step 1
        title: 'Let the hardware referee',  // step 1 title shown at the top of the page
        kind: 'story',  // kind 'story' labels this as a big-picture page rather than a lab or quiz
        render(el, ctx) {  // render(el, ctx): the shell calls this when the student arrives on the step; el is the empty page body
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements (SVG is the browser's drawing format)
          const svg = s('svg', { viewBox: '0 0 640 250', width: '100%', role: 'img', 'aria-label': 'Timeline of P1 taking a lock, and where P2 can slip in' });  // the timeline drawing: 640 by 250 units that scale to the box width; aria-label describes it for screen readers
          const cap = h('div', { class: 'vbox' });  // cap is the verdict box under the drawing that explains the chosen mode
          const blk = (x, w, y, label, cls, o = {}) => s('g', {},  // blk(x, w, y, label, cls, o): draws one labeled block on the timeline, such as "look" or "gap"
            s('rect', { x, y, width: w, height: 46, rx: 9, class: cls, 'stroke-width': 2, 'stroke-dasharray': o.dash ? '6 5' : null }),  // the block's rectangle: 46 units tall with rounded corners; o.dash gives it a dashed outline (used for the gap)
            s('text', { x: x + w / 2, y: y + 29, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700 }, label));  // the block's label, centered inside the rectangle
          const arrowUp = (x, y1, y2, cls) => s('line', { x1: x, y1, x2: x, y2, class: 's-line', 'stroke-width': 2.5, 'marker-end': `url(#arr-${cls})`, style: `stroke:var(--${cls})` });  // arrowUp(x, y1, y2, cls): a vertical arrow with an arrowhead, colored by a named theme color such as bad or warn
          const MODES = {  // MODES: the three versions of the timeline the student can switch between
            none: {  // mode "none": no hardware help at all
              draw: () => [  // draw() returns the SVG pieces for this mode
                blk(20, 210, 70, 'look: is bolt 0? yes', 's-proc'),  // P1's first move: it reads bolt and sees 0 (free)
                blk(230, 130, 70, 'gap', 's-warn', { dash: true }),  // the dangerous gap between looking and locking, drawn dashed in the warning color
                blk(360, 150, 70, 'lock: bolt = 1', 's-proc'),  // P1's second move: it writes 1 into bolt
                blk(510, 110, 70, 'inside', 's-bad'),  // P1 enters its critical section; drawn red because P2 will be there too
                arrowUp(295, 205, 124, 'bad'),  // a red arrow pointing into the gap, where P2 gets its chance to run
                s('text', { x: 295, y: 228, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700, style: 'fill:var(--bad)' }, 'P2 runs in the gap: looks (0), locks, goes inside'),  // label under the arrow: P2 looks, locks and enters during P1's gap
              ],  // ends the list of pieces for "none"
              cap: ['bad', '<b>No help.</b> P1 has looked but not yet locked when P2 gets to bolt (after a switch on one processor, or at the same moment from a second processor). P2 also sees bolt = 0, so <b>both</b> processes walk into their critical sections.'],  // caption for "none": both processes see bolt = 0, so both enter
            },  // ends mode "none"
            off: {  // mode "off": interrupts are switched off around the whole look-and-lock
              draw: () => [  // draw() for this mode
                s('rect', { x: 14, y: 58, width: 612, height: 70, rx: 12, class: 's-os', 'stroke-width': 2, 'fill-opacity': 0.5 }),  // a wide shaded band behind the blocks showing the stretch where interrupts are off
                s('text', { x: 320, y: 50, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--os)' }, 'interrupts switched OFF for this whole stretch'),  // label above the band saying interrupts are off for the whole stretch
                blk(20, 190, 70, 'look: bolt is 0', 's-proc'),  // P1 looks at bolt and sees 0
                blk(210, 90, 70, 'gap', 's-panel', { dash: true }),  // the gap is still drawn, but in a calm color because nothing can use it
                blk(300, 160, 70, 'lock: bolt = 1', 's-proc'),  // P1 locks bolt
                blk(460, 160, 70, 'inside, then ON', 's-ok'),  // P1 goes inside and switches interrupts back on afterward
                arrowUp(255, 205, 136, 'muted'),  // a gray arrow toward the gap: another process would like to run there
                s('text', { x: 255, y: 150, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 900, style: 'fill:var(--bad)' }, '✗'),  // a red cross on the arrow: that attempt is blocked
                s('text', { x: 255, y: 228, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700, style: 'fill:var(--muted)' }, 'no interrupt, so no switch: P2 cannot run yet'),  // label: with no interrupt there is no process switch, so P2 cannot run yet
              ],  // ends the list of pieces for "off"
              cap: ['ok', '<b>Route 1: switch off interrupts.</b> The gap is still there, but on a single processor nothing can take the processor away from P1, so nobody can run in it. (With interrupts off for the whole critical section, the bolt is not even needed. A second processor, though, would not need a switch to get in. More on that soon.)'],  // caption for "off": why it works on one processor, why bolt becomes unnecessary, and a hint about multiprocessors
            },  // ends mode "off"
            atomic: {  // mode "atomic": one special instruction does both moves
              draw: () => [  // draw() for this mode
                blk(20, 350, 70, 'compare_and_swap: look AND lock', 's-cpu'),  // one long block: compare_and_swap performs the look and the lock together
                blk(370, 250, 70, 'inside', 's-ok'),  // P1 then goes inside, drawn green because it is alone
                s('text', { x: 195, y: 142, 'text-anchor': 'middle', 'font-size': 13.5, style: 'fill:var(--cpu)', 'font-weight': 700 }, 'one indivisible instruction: no gap'),  // label under the long block: one indivisible instruction, so there is no gap
                arrowUp(560, 205, 124, 'warn'),  // a warning-colored arrow landing after the instruction, where P2 arrives
                s('text', { x: 440, y: 228, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700, style: 'fill:var(--warn)' }, 'P2 reaches bolt only after it: sees 1, waits'),  // label: P2 reaches bolt only afterward, sees 1 and waits
              ],  // ends the list of pieces for "atomic"
              cap: ['ok', '<b>Route 2: one atomic instruction.</b> The hardware does the look and the lock as a single step. Even from another processor, P2 can reach bolt only before or after that step, never in the middle, so it finds bolt = 1 and waits.'],  // caption for "atomic": even another processor can only reach bolt before or after the instruction
            },  // ends mode "atomic"
          };  // closes the MODES table
          const lanes = () => [  // lanes(): the heading row drawn in every mode
            s('text', { x: 20, y: 24, 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.06em' }, 'P1 TAKES THE LOCK   ·   TIME →'),  // heading text across the top of the drawing, with an arrow showing time runs left to right
          ];  // ends lanes()
          function show(m) {  // show(m): redraws the timeline and caption for mode m; runs at start and whenever a mode button is pressed
            svg.replaceChildren(...lanes(), ...MODES[m].draw());  // replaceChildren wipes the old drawing and inserts the heading plus this mode's pieces
            cap.className = 'vbox ' + MODES[m].cap[0];  // colors the caption box to match the mode (bad or ok)
            cap.innerHTML = MODES[m].cap[1];  // puts the mode's explanation into the caption box
          }  // ends show()
          const seg = ctx.ui.seg([  // seg is a row of toggle buttons (a segmented control); the chosen value is passed to show()
            { value: 'none', label: 'No help' },  // button: no hardware help
            { value: 'off', label: 'Route 1: interrupts off' },  // button: route 1, switching interrupts off
            { value: 'atomic', label: 'Route 2: atomic instruction' },  // button: route 2, an atomic instruction
          ], 'none', show);  // starts on "none" and calls show() whenever the student picks another button
          show('none');  // draws the "none" version once, when the page loads
          el.append(h('div', { class: 'split l fill' },  // page layout: a two-column split, a slimmer text column on the left and a wider interactive card on the right
            h('div', { class: 'stack' },  // the left column stacks the explanation paragraphs
              h('p', { class: 'lead m0', html: 'In 5.1, processes got <span class="t">mutual exclusion</span> for a <span class="t">critical section</span> using only ordinary reads and writes. It works, but the code is subtle.' }),  // opening paragraph: recalls that software-only mutual exclusion works but is subtle (dotted words open definitions)
              h('p', { class: 'm0', html: 'Every lock boils down to two moves on a shared <span class="t" data-t="lock variable">lock variable</span>, which we will call <code>bolt</code>: <b>look</b> (is it 0, free?) and <b>lock</b> (set it to 1, taken). The danger is the <b>gap</b> between them. The hardware can close it in two ways:' }),  // paragraph: every lock is a look and a lock on bolt, and the danger is the gap between them
              h('ol', { class: 'm0', html: '<li><b>Switch off interrupts</b>, so nothing else can run during the gap (one processor only).</li><li><b>Special machine instructions</b> that look and lock as one indivisible step, so there is no gap at all.</li>' }),  // numbered list of the two hardware fixes: interrupts off, or one indivisible instruction
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A shared room with a paper sign. You read FREE, then reach for a pen to write TAKEN. If a roommate reads the sign in between, you both walk in. A real door <b>bolt</b> fixes this: sliding it checks and locks in one motion, and if it is already shut, it will not slide.' })),  // analogy box: a paper sign on a door versus a real sliding bolt that checks and locks in one motion
            h('div', { class: 'card stack' },  // the right column: a card holding the interactive timeline
              h('h4', { class: 'm0' }, 'Where can another process slip in?'),  // card heading: the question the timeline answers
              seg,  // the three mode buttons
              h('div', { class: 'card white grow', style: { display: 'grid', placeItems: 'center', padding: '8px' } }, svg),  // a white inner card that centers the drawing and lets it take the spare height
              cap,  // the caption box under the drawing
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs b muted' }, 'COMING UP:'), ...['fire interrupts at a process', 'break a two-step lock', 'open up compare_and_swap', 'watch spinners starve', 'trigger a priority deadlock'].map((t) => h('span', { class: 'chip accent' }, t))))));  // a "coming up" row: one small chip per lab later in this section, as a preview of what students will do
        },  // ends render() for step 1
      },  // ends step 1

      /* ============ 2. Route 1: switch off interrupts (lab, one processor) ============ */
      {  // opens step 2
        title: 'Route 1: switch off interrupts (one processor)',  // step 2 title: getting mutual exclusion by switching interrupts off, on a single processor
        kind: 'lab',  // kind 'lab' marks this as a hands-on experiment page
        render(el, ctx) {  // render() for step 2: builds the interrupt lab when the student arrives on this page
          const { h } = ctx;  // h builds HTML elements; this step draws no SVG, so s is not needed
          const SRC = {  // SRC: the two versions of the program shown in the code box, keyed by mode
            prot: `/* remainder */         // other work; can be switched out${/* shown code, line 1 (protected version): the remainder, other work where a switch is harmless */''}
disable interrupts;     // from now on, no switch can happen${/* shown code, line 2: switch interrupts off before touching the shared count */''}
reg = count;            // in critical section: read count${/* shown code, line 3: copy count into a register (the read half of the increment) */''}
count = reg + 1;        // in critical section: write count+1${/* shown code, line 4: write the register plus 1 back into count (the write half) */''}
enable interrupts;      // switches allowed again`,  // shown code, line 5: switch interrupts back on; ends the protected listing
            unprot: `/* remainder */         // other work; can be switched out${/* shown code, line 1 (unprotected version): the same remainder work */''}
/* (no disable) */      // unprotected: nothing stops a switch${/* shown code, line 2: an empty placeholder where the disable used to be */''}
reg = count;            // in critical section: read count${/* shown code, line 3: read count into a register, with nothing protecting it */''}
count = reg + 1;        // in critical section: write count+1${/* shown code, line 4: write count + 1 back, with nothing protecting it */''}
/* (no enable) */       // unprotected: nothing to undo`,  // shown code, line 5: empty placeholder where the enable used to be; ends the unprotected listing
          };  // closes SRC
          let S, code, busy = false, gen = 0;   // gen: bumped by every reset so an older replay loop stops
          const codeBox = h('div');  // codeBox holds the code listing; it is refilled on every reset
          const cpuRun = h('span', { class: 'tok p1' }, 'P1');  // cpuRun is the badge showing which process currently has the processor (starts as P1)
          const intChip = h('span', { class: 'chip ok' });  // intChip shows whether interrupts are ON or OFF
          const pendChip = h('span', { class: 'chip' });  // pendChip shows whether a timer interrupt is waiting to be delivered
          const cCount = cell(ctx, 'count'), cR1 = cell(ctx, 'P1 reg', 'cpu'), cR2 = cell(ctx, 'P2 reg', 'cpu');  // three value boxes: the shared variable count, and each process's private register
          const tally = h('div', { class: 'small' });  // tally line: how many increments finished and whether count matches that number
          const say = verdict(ctx);  // say is the verdict box that explains each move
          const log = h('div', { class: 'log grow', style: { minHeight: '60px' } });  // log lists every event, newest first; it grows to fill the spare height
          const bRun = h('button', { class: 'btn primary', type: 'button', onclick: () => !busy && act('run') }, 'Run next line');  // button that executes the highlighted line of the running process (ignored while a replay is playing)
          const bInt = h('button', { class: 'btn intr', type: 'button', onclick: () => !busy && act('timer') }, 'Timer interrupt!');  // button that fires a timer interrupt, which may make the OS switch processes
          const bReplay = h('button', { class: 'btn sm', type: 'button', onclick: () => replay() }, 'Replay a risky timing');  // button that plays a scripted risky timing automatically
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { busy = false; reset(S.mode); } }, 'Reset');  // button that clears everything and starts the current mode again
          const seg = ctx.ui.seg([{ value: 'prot', label: 'Protected (interrupts off)' }, { value: 'unprot', label: 'Unprotected' }], 'prot', (m) => { busy = false; reset(m); });  // mode buttons: protected (interrupts off) or unprotected; switching modes also resets the lab
          const skip = (m, pc) => (m === 'unprot' && (pc === 1 || pc === 4));  // skip(m, pc): in unprotected mode lines 1 and 4 (disable, enable) are placeholders, so they are skipped
          const nextPc = (m, pc) => { let n = (pc + 1) % 5; while (skip(m, n)) n = (n + 1) % 5; return n; };  // nextPc(m, pc): the next line to run, wrapping from the last line back to the remainder, skipping placeholders
          const inside = (pc) => pc === 2 || pc === 3;  // inside(pc): true when a process is on the read or write line, meaning it is in its critical section

          function reset(mode) {  // reset(mode): puts the lab back to its starting state in the given mode
            gen++;  // bumps the reset counter so any replay still running notices and stops
            S = { mode, run: 1, pc: { 1: 0, 2: 0 }, reg: { 1: '–', 2: '–' }, count: 0, done: 0, ints: true, pending: false, violated: false, lost: false };  // S holds the whole lab state: who runs, each process's line and register, count, interrupt flags, error flags
            code = listing(ctx, SRC[mode], { fontSize: 14 });  // builds a fresh code listing for this mode at a 14px font size
            if (mode === 'unprot') code.mark([2, 5], 'dim');  // in unprotected mode, dims the two placeholder lines (2 and 5) so they read as absent
            codeBox.replaceChildren(code);  // puts the new listing into its box, replacing the old one
            log.replaceChildren(h('div', { class: 'spin ph' }, 'Events appear here, newest first.'));  // empties the log and shows a placeholder until the first event
            paint(mode === 'prot'  // draws the starting state with an opening instruction that depends on the mode
              ? ['info', '<b>Your move.</b> P1 is running. Press <b>Run next line</b> to execute its highlighted line, and fire the <b>Timer interrupt</b> whenever you like. Try to switch to P2 while P1 is inside its critical section.']  // instruction for protected mode: run lines, fire interrupts, try to switch while P1 is inside
              : ['warn', '<b>Unprotected.</b> Same program, but nothing switches interrupts off. Run P1 into its critical section, then fire the timer. What happens?']);  // instruction for unprotected mode: run P1 into its critical section, then fire the timer
          }  // ends reset()
          function note(txt, cls) { const ph = log.querySelector('.ph'); if (ph) ph.remove(); log.prepend(h('div', { class: cls || '', html: txt })); }  // note(txt, cls): adds an event to the top of the log, removing the placeholder the first time
          function paint(v) {  // paint(v): copies the state S onto the screen; v is an optional [color, message] for the verdict box
            const other = S.run === 1 ? 2 : 1;  // other is whichever process is not running right now
            const map = {};  // map will say which processes sit on which code line
            [1, 2].forEach((p) => { (map[S.pc[p] + 1] = map[S.pc[p] + 1] || []).push(p); });  // groups the two processes by their current line (converted to 1-based numbers for the listing)
            code.marks(map);  // draws the P1 and P2 markers in the code gutter
            code.querySelectorAll('.mk.p' + other).forEach((m) => (m.style.opacity = 0.4));  // fades the marker of the process that is not running, so the running one stands out
            cpuRun.className = 'tok p' + S.run; cpuRun.textContent = 'P' + S.run;  // updates the badge for the process that holds the processor
            intChip.className = 'chip ' + (S.ints ? 'ok' : 'os'); intChip.textContent = 'interrupts ' + (S.ints ? 'ON' : 'OFF');  // updates the interrupts chip: green ON or OS-colored OFF
            pendChip.className = 'chip ' + (S.pending ? 'intr pulse' : ''); pendChip.textContent = S.pending ? 'timer interrupt pending' : 'nothing pending';  // updates the pending chip; a waiting interrupt pulses to draw the eye
            cCount.set(S.count); cR1.set(S.reg[1]); cR2.set(S.reg[2]);  // writes the current values into the count box and both register boxes
            tally.innerHTML = `Increments finished: <b>${S.done}</b> · count should be <b>${S.done}</b>, it is <b style="color:var(--${S.count === S.done ? 'ok' : 'bad'})">${S.count}</b>`;  // tally: finished increments versus count, with count green when they match and red when an update was lost
            if (v) say.say(v[0], v[1]);  // if a message was given, shows it in the verdict box
          }  // ends paint()
          function act(kind) {  // act(kind): handles one button press, either 'run' (execute a line) or 'timer' (fire an interrupt)
            const p = S.run, other = p === 1 ? 2 : 1, P = PN(p), O = PN(other);  // p is the running process, other the waiting one; P and O are their colored names for messages
            let v;  // v will hold the verdict message for this move
            if (kind === 'timer') {  // a timer interrupt was fired
              if (S.ints) {  // interrupts are on, so the interrupt is delivered right away
                const mid = inside(S.pc[p]);  // mid is true if the running process was caught inside its critical section
                S.run = other;  // the OS switches the processor to the other process
                note(`Timer interrupt: OS switches ${P} → ${O}${mid ? ' (inside its critical section!)' : ''}`, mid ? 'bad' : '');  // logs the switch, marked red if it happened mid-critical-section
                v = mid ? ['warn', `<b>Switched out mid-critical-section.</b> ${P} was inside its critical section when the interrupt arrived, and interrupts were on, so the OS gave the processor to ${O}. If ${O} now enters too, mutual exclusion is broken.`]  // warning message: the process was switched out inside its critical section, so the other may enter too
                  : ['info', `<b>Timer interrupt.</b> Interrupts are on, so the OS saves ${P} and dispatches ${O}. That is harmless here: ${P} is not inside its critical section.`];  // info message: the switch is harmless because the process was not inside its critical section
              } else {  // interrupts are off, so the interrupt cannot be delivered now
                const again = S.pending;  // again remembers whether one was already pending before this press
                S.pending = true;  // the hardware marks a timer interrupt as pending instead of switching
                note(`Timer interrupt held as pending (interrupts OFF)`, 'ok');  // logs that the interrupt is being held
                v = ['ok', `<b>Interrupt held.</b> Interrupts are off, so the processor ${again ? 'already has a timer interrupt waiting; it' : 'records this one as <span class="t">pending interrupt</span> and'} keeps running ${P}. No switch can happen until ${P} switches interrupts back on.`];  // success message: the interrupt waits and the same process keeps running; notes if one was already waiting
              }  // ends the interrupts-off case
            } else {  // a "Run next line" press: execute the running process's current line
              const pc = S.pc[p];  // pc is the line the running process is on (0 to 4)
              if (pc === 0) { note(`${P} finishes other work`); v = ['info', `${P} finishes its remainder work and heads for its critical section.`]; }  // line 0: the process finishes its remainder work and heads for the critical section
              if (pc === 1) { S.ints = false; note(`${P} disables interrupts`); v = ['info', `${P} switches interrupts <b>off</b>. From now on, the only way it can lose the processor is by calling the OS itself, and it will not.`]; }  // line 1: the process switches interrupts off, so it cannot be switched out now
              if (pc === 2) { S.reg[p] = S.count; note(`${P} reads count = ${S.count}`); v = ['info', `${P} reads <code>count = ${S.count}</code> into its register. It is now halfway through its critical section.`]; }  // line 2: the process copies count into its register (the read half)
              if (pc === 3) {  // line 3: the write half of the increment
                S.count = S.reg[p] + 1; S.done++;  // writes register + 1 into count and counts one more finished increment
                const lost = S.count !== S.done;  // an update was lost if count no longer equals the number of finished increments
                if (lost) S.lost = true;  // remembers the loss so the lab can report it later
                note(`${P} writes count = ${S.count}${lost ? ' (an update is lost!)' : ''}`, lost ? 'bad' : '');  // logs the write, flagged red if an update was lost
                v = lost ? ['bad', `<b>Lost update.</b> ${P} writes back ${S.count}, the value it computed from a stale read. ${S.done} increments have finished, but count is only ${S.count}.`]  // bad message: the process wrote a value based on a stale read, so count is too small
                  : ['info', `${P} writes <code>count = ${S.count}</code>. ${S.mode === 'prot' ? 'Its critical section is done; next it switches interrupts back on.' : 'Its critical section is done.'}`];  // info message: the write succeeded; in protected mode it says interrupts come back on next
              }  // ends line 3
              if (pc === 4) {  // line 4: the process switches interrupts back on
                S.ints = true;  // interrupts are on again
                if (S.pending) {  // if an interrupt was held while they were off, it is delivered now
                  S.pending = false; S.run = other;  // clears the pending flag and the OS switches to the other process
                  note(`${P} enables interrupts; pending timer fires: switch → ${O}`, 'ok');  // logs the enable and the delayed switch
                  v = ['ok', `${P} switches interrupts back <b>on</b>, and the pending timer interrupt is delivered at once. The OS now switches to ${O}. ${P} had already left its critical section, so this is perfectly safe.`];  // success message: the switch is safe because the process already left its critical section
                } else { note(`${P} enables interrupts`); v = ['info', `${P} switches interrupts back <b>on</b>. Its critical section is over, so being switched out is fine again.`]; }  // no interrupt was pending: the process just switches interrupts back on, which is safe now
              }  // ends line 4
              S.pc[p] = nextPc(S.mode, pc);  // moves the running process to its next line (wrapping back to the remainder after the last one)
            }  // ends the "Run next line" case
            if (!S.violated && inside(S.pc[1]) && inside(S.pc[2])) {  // after every move: if both processes are now inside at the same time, and this was not reported yet
              S.violated = true;  // remembers the violation so the warning is shown only once
              note('Both processes are inside their critical sections!', 'bad');  // logs the violation in red
              v = ['bad', `<b>Mutual exclusion broken.</b> ${PN(1)} and ${PN(2)} are both inside their critical sections: one was switched out in the middle, and the other walked right in. Keep running to see the damage to <code>count</code>.`];  // bad message: mutual exclusion is broken; keep running to see count go wrong
            }  // ends the violation check
            paint(v);  // redraws the screen with this move's message
          }  // ends act()
          async function replay() {  // replay(): plays a scripted sequence of moves by itself, pausing between them; async lets it wait with await
            const mode = S.mode;  // remembers which mode to replay
            reset(mode); busy = true;  // starts clean and sets busy so the student's buttons are ignored during the replay
            const g = gen;  // g remembers this replay's reset number; a later reset makes it stale
            const seq = mode === 'unprot' ? ['run', 'run', 'timer', 'run', 'run', 'run', 'timer', 'run'] : ['run', 'run', 'run', 'timer', 'run', 'run', 'run', 'run'];  // the script: in unprotected mode the timer fires inside the critical section twice; in protected mode once
            for (const k of seq) { await ctx.sleep(750); if (!ctx.alive || g !== gen) return; act(k); }  // runs one move every 750 ms; stops early if the student left the page or pressed reset
            busy = false;  // the replay is over, so the buttons work again
            if (mode === 'prot') paint(['ok', `<b>Replay over: no harm done.</b> The timer fired while ${PN(1)} was inside its critical section, but it was held until ${PN(1)} switched interrupts back on. count = ${S.count}, exactly the number of finished increments. Now try <b>Unprotected</b>.`]);  // in protected mode, ends with a summary: the interrupt was held, count is correct, now try unprotected
          }  // ends replay()
          reset('prot');  // draws the lab in protected mode when the page first loads
          el.append(h('div', { class: 'split l fill' },  // page layout: text on the left, the lab on the right
            h('div', { class: 'stack' },  // the left column stacks the explanation
              h('p', { class: 'lead m0', html: 'On a <span class="t">uniprocessor</span>, processes never truly <span class="t" data-t="overlapping">overlap</span>; they only <span class="t" data-t="interleaving">interleave</span>, taking turns.' }),  // opening paragraph: on one processor, processes only take turns (interleave) and never truly overlap
              h('p', { class: 'm0', html: 'A running process keeps the processor until one of two things happens: it <b>calls an OS service</b> (to read a file, say), or an <span class="t">interrupt</span> arrives (a timer tick, a disk finishing) and the OS decides to switch.' }),  // paragraph: a running process loses the processor only by calling the OS or when an interrupt arrives
              h('p', { class: 'm0', html: 'So a process that switches interrupts off before its critical section, and makes no OS calls inside it, cannot lose the processor. Nobody else can run, so nobody else can get in: <span class="t">interrupt disabling</span>.' }),  // paragraph: so switching interrupts off around a critical section keeps everyone else out
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Switching interrupts off does not throw them away. The hardware holds them pending and delivers them as soon as interrupts are back on.' }),  // common-mistake box: interrupts that arrive while off are held pending, not thrown away
              h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'Run P1 to <code>count = reg + 1</code>, then fire the timer. Then pick <b>Unprotected</b> and do the same, or press <b>Replay a risky timing</b> in each mode.' })),  // try-this box: suggested experiments with the timer button in both modes
            h('div', { class: 'stack gap-s' },  // the right column holds the lab controls and displays
              h('div', { class: 'row' }, seg, h('span', { class: 'grow' }), bReplay, bReset),  // top row: the mode buttons on the left, a stretchy spacer, then the replay and reset buttons
              codeBox,  // the code listing with process markers
              h('div', { class: 'row', style: { alignItems: 'stretch', gap: '8px' } },  // a row of status displays that stretch to the same height
                h('div', { class: 'card tight stack gap-s', style: { flex: '1 1 210px' } },  // a small card showing processor status; it can shrink but prefers about 210px wide
                  h('div', { class: 'row gap-s' }, h('b', { class: 'small' }, 'Processor runs'), cpuRun),  // which process the processor is running now
                  h('div', { class: 'row gap-s' }, intChip, pendChip)),  // the interrupts ON/OFF chip and the pending chip
                h('div', { style: { flex: '0 0 92px', display: 'grid' } }, cCount),  // the count value box, fixed at 92px wide
                h('div', { style: { flex: '0 0 92px', display: 'grid' } }, cR1),  // P1's register box
                h('div', { style: { flex: '0 0 92px', display: 'grid' } }, cR2)),  // P2's register box
              h('div', { class: 'row' }, bRun, bInt, tally),  // the two action buttons and the tally line
              say, log)));  // the verdict box and the event log close the right column
        },  // ends render() for step 2
      },  // ends step 2

      /* ============ 3. The two costs of interrupt disabling (compare) ============ */
      {  // opens step 3
        title: 'The two costs of switching off interrupts',  // step 3 title: the two costs of switching interrupts off
        kind: 'compare',  // kind 'compare' marks a side-by-side comparison page
        render(el, ctx) {  // render() for step 3: builds both cost demos when the page opens
          const { h, s } = ctx;  // h for HTML elements and s for SVG drawing elements
          /* ---- Cost 1: efficiency. Device events that arrive while interrupts are off must wait. ---- */
          const EV = [6, 18, 33, 47, 64, 88];       // arrival times of device interrupts, in microseconds
          const X = (t) => 20 + t * 4.8;           // 0..100 µs → 20..500 in the SVG
          const svg1 = s('svg', { viewBox: '0 0 520 150', width: '100%', role: 'img', 'aria-label': 'Timeline of device interrupts delayed by a critical section' });  // svg1 is the timeline drawing for cost 1: device interrupts that must wait while interrupts are off
          const stat = h('div', { class: 'small' });  // stat is the summary text under the timeline (how many interrupts waited and for how long)
          function drawCost(L) {  // drawCost(L): redraws the timeline for a critical section L microseconds long; runs whenever the slider moves
            const end = 10 + L;  // interrupts go off at 10 microseconds, so they come back on at 10 + L
            const late = EV.filter((t) => t >= 10 && t < end);  // late lists the device interrupts that arrive while interrupts are off
            const waits = late.map((t) => end - t);  // waits holds how long each late interrupt must wait (until interrupts come back on)
            const kids = [  // kids collects the SVG pieces of this drawing
              s('rect', { x: X(10), y: 22, width: L * 4.8, height: 76, rx: 8, class: 's-os', 'stroke-width': 2, 'fill-opacity': 0.7 }),  // the shaded box marking the time interrupts are off, 10 to 10 + L
              s('text', { x: X(10) + 6, y: 38, 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--os)' }, L >= 22 ? 'interrupts OFF' : 'OFF'),  // its label; short boxes just say OFF so the text fits
              s('line', { x1: 20, y1: 110, x2: 505, y2: 110, class: 's-line' }),  // the horizontal time axis
              s('circle', { cx: 300, cy: 10, r: 5, class: 's-io', 'stroke-width': 2 }), s('text', { x: 310, y: 14.5, 'font-size': 12.5, class: 's-sub' }, 'served at once'),  // legend dot and text: an interrupt served at once
              s('circle', { cx: 412, cy: 10, r: 5, class: 's-intr', 'stroke-width': 2, style: 'fill:var(--intr)' }), s('text', { x: 422, y: 14.5, 'font-size': 12.5, class: 's-sub' }, 'had to wait'),  // legend dot and text: an interrupt that had to wait
            ];  // ends the fixed pieces
            for (let t = 0; t <= 100; t += 20) kids.push(s('line', { x1: X(t), y1: 106, x2: X(t), y2: 114, class: 's-line' }), s('text', { x: X(t), y: 132, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, t === 100 ? '100 µs' : String(t)));  // tick marks and labels every 20 microseconds along the axis, with a unit on the last one
            EV.forEach((t) => {  // draws each device interrupt as a dot on the axis
              const k = late.indexOf(t);  // k is this interrupt's position in the late list, or -1 if it was served at once
              if (k >= 0) {  // a late interrupt also gets a waiting arrow
                const y = 52 + k * 10;  // each late arrow sits on its own row so arrows do not overlap
                kids.push(s('line', { x1: X(t), y1: y, x2: X(end) - 4, y2: y, class: 's-line', 'stroke-dasharray': '4 3', 'marker-end': 'url(#arr-intr)', style: 'stroke:var(--intr)' }),  // a dashed arrow from the arrival time to the moment interrupts come back on
                  s('line', { x1: X(t), y1: 104, x2: X(t), y2: y, class: 's-muted', 'stroke-width': 1.5 }));  // a thin gray line joining the dot on the axis to its waiting arrow
              }  // ends the late-interrupt case
              kids.push(s('circle', { cx: X(t), cy: 110, r: 6, class: k >= 0 ? 's-intr' : 's-io', 'stroke-width': 2, style: k >= 0 ? 'fill:var(--intr)' : null }));  // the dot itself: interrupt-colored if it had to wait, I/O-colored if it was served at once
            });  // ends the loop over interrupts
            svg1.replaceChildren(...kids);  // replaces the whole drawing with the new pieces
            const tot = waits.reduce((a, b) => a + b, 0);  // tot adds up all the waiting times
            stat.innerHTML = `Device interrupts delayed: <b>${late.length} of ${EV.length}</b> · longest wait <b>${late.length ? Math.max(...waits) : 0} µs</b> · total <b>${tot} µs</b>`  // summary: how many were delayed, the longest wait and the total wait
              + `<div class="muted" style="margin-top:4px">Interrupts go off at 10 µs and back on at 10 + ${L} = <b>${end} µs</b>. `  // explains when interrupts go off and back on, using the slider value
              + (late.length ? `Each delayed interrupt waits until then: ${late.map((t) => `${end} − ${t} = ${end - t}`).join(', ')} µs.</div>` : 'No device interrupt arrives in that window, so none waits.</div>');  // lists each delayed interrupt's wait as a subtraction, or says none arrived in the window
          }  // ends drawCost()
          const sl = ctx.ui.slider({ label: 'Critical section length', min: 5, max: 80, step: 1, value: 20, format: (v) => v + ' µs', onInput: drawCost });  // slider for the critical section length (5 to 80 microseconds); every move redraws the timeline
          drawCost(20);  // draws the timeline once for the starting length of 20 microseconds

          /* ---- Cost 2: a multiprocessor. Disabling interrupts on one CPU does not stop the others. ---- */
          let mode = 1;  // mode is 1 or 2, the number of processors in the cost 2 animation
          const cpus = h('div', { class: 'row nw', style: { gap: '12px', justifyContent: 'center' } });  // cpus is the row that shows one box per processor
          const room = h('div', { class: 'room' });  // room is the critical section box inside shared memory
          const mem = h('div', { class: 'card mem tight stack gap-s', style: { alignItems: 'center' } }, h('div', { class: 'xs b', style: { color: 'var(--mem)', letterSpacing: '.06em' } }, 'SHARED MAIN MEMORY'), room);  // mem is the shared-memory card: a label on top and the room below it
          const cpuBox = (n, run, on, pend) => h('div', { class: 'box cpu stack gap-s', style: { flex: '0 1 200px', alignItems: 'center', padding: '6px 10px' } },  // cpuBox(n, run, on, pend): builds the box for processor n showing who runs there and its interrupt state
            h('div', { class: 'row gap-s' }, h('b', { class: 'small' }, 'CPU ' + n), run ? h('span', { class: 'tok p' + run }, 'P' + run) : h('span', { class: 'chip' }, 'idle')),  // top row of the box: the processor's name and the running process badge, or "idle"
            h('div', { class: 'row gap-s' }, h('span', { class: 'chip ' + (on ? 'ok' : 'os') }, 'interrupts ' + (on ? 'ON' : 'OFF')), pend ? h('span', { class: 'chip intr' }, 'pending') : null));  // bottom row: interrupts ON or OFF for this processor, plus a pending chip when one is held
          const F = {  // F: the frames of the cost 2 animation, one list per processor count; c holds [process, interrupts on, pending] per processor
            1: [  // frames for one processor
              { c: [[1, true]], in: [], wait: 'P2 is Ready, waiting for the processor', cap: '<b>One processor.</b> P1 is running. P2 is ready but can only run if the OS switches to it.' },  // frame 1: P1 runs, P2 is ready and can run only if the OS switches to it
              { c: [[1, false]], in: [1], wait: 'P2 is Ready, waiting for the processor', cap: 'P1 switches interrupts <b>off</b> and enters its critical section.' },  // frame 2: P1 switches interrupts off and enters its critical section
              { c: [[1, false, true]], in: [1], wait: 'P2 is still waiting: no switch is possible', cap: 'A timer interrupt arrives and is <b>held</b>. With no switch, P2 cannot run, so it cannot touch the shared data.' },  // frame 3: a timer interrupt is held, so P2 still cannot run
              { c: [[2, true]], in: [], wait: 'P1 is Ready, waiting for the processor', cap: 'P1 leaves its critical section and switches interrupts on. The held interrupt fires and the OS switches to P2.' },  // frame 4: P1 leaves and switches interrupts on; the held interrupt lets the OS switch to P2
              { c: [[2, false]], in: [2], wait: 'P1 is Ready, waiting for the processor', cap: 'P2 switches interrupts off and enters. One process at a time: <b>on one processor it works.</b>', ok: true },  // frame 5: P2 enters alone, so the method works on one processor
            ],  // ends the one-processor frames
            2: [  // frames for two processors
              { c: [[1, true], [2, true]], in: [], wait: '', cap: '<b>Two processors, one shared memory.</b> P1 runs on CPU 1 and P2 runs on CPU 2, truly at the same instant.' },  // frame 1: P1 and P2 each run on their own processor at the same instant
              { c: [[1, false], [2, true]], in: [1], wait: '', cap: 'P1 switches interrupts off and enters. But that setting belongs to <b>CPU 1 only</b>. CPU 2 is not affected at all.' },  // frame 2: P1 switches interrupts off, but only on CPU 1; CPU 2 is unaffected
              { c: [[1, false], [2, true]], in: [1], wait: 'P2 heads for its critical section', cap: 'P2 never needed to be switched in: it is <b>already running</b> on CPU 2. Nothing stops it from reaching the shared data.' },  // frame 3: P2 is already running, so it needs no switch to reach the shared data
              { c: [[1, false], [2, false]], in: [1, 2], wait: '', cap: 'P2 switches interrupts off on CPU 2 and enters too. <b>Both are inside at once</b>, reading and writing the same data.', bad: true },  // frame 4: P2 enters too, so both are inside at once (bad marks the frame as a failure)
              { c: [[1, false], [2, false]], in: [1, 2], wait: '', cap: 'Interrupts only decide when a processor can be <b>switched</b>. They cannot stop another processor from using memory, so this method <b>fails on a multiprocessor</b>.', bad: true },  // frame 5: the lesson: interrupts control switching, not memory access, so the method fails here
            ],  // ends the two-processor frames
          };  // closes F
          const waitNote = h('div', { class: 'xs muted center', style: { minHeight: '18px' } });  // waitNote is the small line under the processors saying what the waiting process is doing
          function drawMp(i) {  // drawMp(i): draws frame i of the cost 2 animation; the player calls it on every step
            const f = F[mode][i];  // f is the frame to draw, taken from the list for the current processor count
            cpus.replaceChildren(...f.c.map(([run, on, pend], k) => cpuBox(k + 1, run, on, pend)));  // rebuilds one box per processor from the frame's [process, interrupts on, pending] entries
            room.className = 'room' + (f.in.length === 1 ? ' one' : f.in.length > 1 ? ' two' : '');  // colors the room: green with one process inside, red with two or more
            room.replaceChildren(h('div', { class: 'xs' }, 'critical section (shared data)'),  // refills the room with its label
              h('div', { class: 'row gap-s', style: { justifyContent: 'center' } }, ...(f.in.length ? f.in.map((p) => h('span', { class: 'tok p' + p }, 'P' + p)) : [h('span', { class: 'small muted' }, 'empty')])));  // and a badge for each process inside it, or the word "empty"
            waitNote.textContent = f.wait || ' ';  // shows the waiting note, or a single space when the frame has none (the minimum height keeps the line in place)
            return f.cap;  // returns the caption, which the player shows above its controls
          }  // ends drawMp()
          const player = ctx.ui.player({ count: 5, render: drawMp, interval: 2200 });  // player: a step-through animation with play, pause, back and next buttons; 5 frames, 2.2 seconds apart when playing
          const seg = ctx.ui.seg([{ value: 1, label: '1 processor' }, { value: 2, label: '2 processors' }], 1, (v) => { mode = v; player.reset(); });  // buttons for 1 or 2 processors; switching changes the frame list and restarts the player

          el.append(h('div', { class: 'split fill' },  // page layout: two equal columns, cost 1 on the left and cost 2 on the right
            h('div', { class: 'card stack gap-s' },  // left card: cost 1
              h('h3', { class: 'm0' }, 'Cost 1: everything else must wait'),  // heading for cost 1: everything else must wait
              h('p', { class: 'small m0', html: 'While interrupts are off, the processor cannot <span class="t" data-t="interleaving">interleave</span>: no other process can run and no device can be served. A finished disk read or an arriving network packet just waits. Slide to see how the delays grow with the critical section.' }),  // paragraph: with interrupts off no process can run and no device can be served
              sl, h('div', { class: 'card white tight' }, svg1), stat,  // the slider, the timeline drawing on a white card, and the summary line
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Switching interrupts off is a <span class="t">privileged instruction</span>: only the kernel may use it, since a user program could otherwise hog the machine forever. Even the kernel keeps these stretches as short as it can.' })),  // why-it-matters box: switching interrupts off is privileged, so only the kernel may do it, and briefly
            h('div', { class: 'card stack gap-s' },  // right card: cost 2
              h('h3', { class: 'm0' }, 'Cost 2: useless on a multiprocessor'),  // heading for cost 2: switching interrupts off is useless on a multiprocessor
              h('p', { class: 'small m0', html: 'On a <span class="t">multiprocessor</span>, processes run truly at the same time. Switching interrupts off on one processor says nothing to the others.' }),  // paragraph: turning interrupts off on one processor tells the others nothing
              seg, cpus, waitNote, mem, player.el)));  // the processor-count buttons, the processor boxes, the waiting note, shared memory and the player controls
        },  // ends render() for step 3
      },  // ends step 3

      /* ============ 4. Why look-and-lock must be one atomic step (lab) ============ */
      {  // opens step 4
        title: 'Look and lock in one step: why atomic matters',  // step 4 title: why the look and the lock must be one atomic step
        kind: 'lab',  // a lab page
        core: true,  // core: true keeps this step on the shorter core path through the guide
        render(el, ctx) {  // render() for step 4: builds the two-process lock lab when the page opens
          const { h } = ctx;  // only HTML elements are needed here
          /* Each program: lines with a plain-language "next" text and an effect. inside = lines that count as
             "inside the critical section" (after taking the lock, before releasing it). */
          const PROGS = {  // PROGS: the two lock programs the student can compare, keyed by mode
            two: {  // program "two": the broken lock where the test and the set are separate instructions
              src: `while (bolt == 1) ;     // STEP 1, a read: taken? test again${/* shown code, line 1: STEP 1 reads bolt and loops while it is 1 (taken) */''}
bolt = 1;               // STEP 2, a write: claim the lock${/* shown code, line 2: STEP 2 writes 1 to claim the lock */''}
/* critical section */  // use the shared resource${/* shown code, line 3: the critical section */''}
bolt = 0;               // unlock: put the 0 back${/* shown code, line 4: unlock by writing 0 */''}
/* remainder */         // other work, then want in again`,  // shown code, line 5: the remainder; ends this listing
              inside: [2, 3], gap: 1,  // inside lists the lines that count as in the critical section; gap is the line between looking and locking
              run(S, p) {  // run(S, p): executes process p's current line on state S and returns where it goes next and what to log
                const pc = S.pc[p];  // pc is the process's current line (0-based)
                if (pc === 0) return S.bolt === 0 ? { to: 1, m: `reads bolt = 0: free! (but has not claimed it yet)` } : { to: 0, spin: true, m: `reads bolt = 1: taken, so it tests again` };  // line 0, the test: if bolt is 0 move on (without claiming it); if 1, stay here and spin
                if (pc === 1) { S.bolt = 1; return { to: 2, m: `writes bolt = 1 and walks into its critical section` }; }  // line 1, the set: write 1 into bolt and enter the critical section
                if (pc === 2) return { to: 3, m: `finishes its critical section` };  // line 2: the critical section finishes
                if (pc === 3) { S.bolt = 0; return { to: 4, m: `writes bolt = 0: unlocked` }; }  // line 3: write 0 into bolt to unlock
                return { to: 0, m: `does other work, then wants in again` };  // line 4: the remainder, after which the process wants the lock again
              },  // ends run() for program "two"
              next: ['Read bolt. If it is 1, test again; if it is 0, go on to STEP 2.', 'Write 1 into bolt, then enter the critical section.', 'Use the shared resource, then leave.', 'Write 0 into bolt: the lock is free again.', 'Other work. Then it wants the lock again.'],  // next: plain-language text for each line, shown on the process card as what it will do next
            },  // ends program "two"
            cas: {  // program "cas": the correct lock built on compare_and_swap
              src: `while (compare_and_swap(&bolt, 0, 1) == 1) ;  // ONE atomic step: test + set${/* shown code, line 1: one atomic instruction tests and sets; loop while it returns 1 */''}
/* critical section */                         // got 0 back: the lock is ours${/* shown code, line 2: the critical section, reached only after getting 0 back */''}
bolt = 0;                                      // unlock: put the 0 back${/* shown code, line 3: unlock by writing 0 */''}
/* remainder */                                // other work, then want in again`,  // shown code, line 4: the remainder; ends this listing
              inside: [1, 2], gap: -1,  // lines 1 and 2 count as inside; gap is -1 because this program has no gap line
              run(S, p) {  // run(S, p) for the atomic program
                const pc = S.pc[p];  // pc is the process's current line
                if (pc === 0) {  // line 0: the atomic test-and-set
                  const old = S.bolt;  // old is the value compare_and_swap finds in bolt
                  if (old === 0) { S.bolt = 1; return { to: 1, m: `compare_and_swap finds 0, writes 1, returns 0: it holds the lock` }; }  // found 0: write 1 in the same step and return 0, so this process holds the lock
                  return { to: 0, spin: true, m: `compare_and_swap finds 1, writes nothing, returns 1: it spins` };  // found 1: write nothing, return 1, and stay on this line spinning
                }  // ends line 0
                if (pc === 1) return { to: 2, m: `finishes its critical section` };  // line 1: the critical section finishes
                if (pc === 2) { S.bolt = 0; return { to: 3, m: `writes bolt = 0: unlocked` }; }  // line 2: write 0 into bolt to unlock
                return { to: 0, m: `does other work, then wants in again` };  // line 3: the remainder, after which the process wants the lock again
              },  // ends run() for program "cas"
              next: ['One instruction: read bolt, and if it is 0 write 1, all at once. Returned 1? Test again.', 'Use the shared resource, then leave.', 'Write 0 into bolt: the lock is free again.', 'Other work. Then it wants the lock again.'],  // next: plain-language text for each line of the atomic program
            },  // ends program "cas"
          };  // closes PROGS
          let mode = 'two', S, P, code, busy = false, gen = 0;   // gen: bumped by every reset so an older replay loop stops
          const codeBox = h('div');  // codeBox holds the listing for the current mode
          const cBolt = cell(ctx, 'bolt');  // cBolt is the memory-word box showing bolt's value
          const room = h('div', { class: 'room', style: { minWidth: '0' } });  // room is the critical section box; minWidth 0 lets it shrink in the middle column
          const say = verdict(ctx);  // say is the verdict box
          const log = h('div', { class: 'log grow', style: { minHeight: '60px' } });  // log lists each step, newest first
          const tally = h('div', { class: 'xs muted center' });  // tally line: how many times both were inside and how many spins each process made
          const pcard = [1, 2].map((p) => {  // pcard: builds one control card for each process
            const st = h('span', { class: 'chip' });  // st is the chip showing the process's state (inside, spinning, wants in...)
            const nx = h('div', { class: 'small', style: { minHeight: '42px', lineHeight: '1.35' } });  // nx shows what the process will do on its next step; a minimum height stops the card from jumping
            const btn = h('button', { class: 'btn sm ' + (p === 1 ? 'proc' : 'os'), type: 'button', style: p === 2 ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : null, onclick: () => !busy && stepP(p) }, 'Step P' + p);  // the Step button runs one line of this process (ignored during a replay); P2's button uses the accent color
            const card = h('div', { class: 'card tight stack gap-s', style: { borderTop: `4px solid var(--${p === 1 ? 'proc' : 'accent'})` } }, h('div', { class: 'row gap-s' }, h('span', { class: 'tok p' + p }, 'P' + p), st, h('span', { class: 'grow' }), btn), nx);  // the card itself: a colored top edge, the process badge, the state chip, a spacer, the button, then the next text
            return { st, nx, card };  // keeps references to the parts that paint() updates
          });  // ends the card builder
          function reset(m) {  // reset(m): starts the lab again with program m
            gen++;  // bumps the reset counter so any running replay stops
            mode = m; P = PROGS[m];  // remembers the mode and picks its program
            S = { pc: { 1: 0, 2: 0 }, bolt: 0, spins: { 1: 0, 2: 0 }, spinNow: { 1: false, 2: false }, overlaps: 0, both: false };  // S holds each process's line, bolt, spin counts, who is spinning now, overlap count, and whether both are inside
            code = listing(ctx, P.src, { fontSize: 13 });  // builds a fresh listing of this program at a 13px font size
            codeBox.replaceChildren(code);  // shows the new listing in its box
            log.replaceChildren(h('div', { class: 'spin ph' }, 'Your steps appear here, newest first.'));  // empties the log and shows a placeholder until the first step
            paint(m === 'two'  // draws the starting state with an opening challenge that depends on the mode
              ? ['info', '<b>Your move.</b> You are the scheduler: press <b>Step P1</b> or <b>Step P2</b> to run one line of that process. Can you get <b>both</b> into the critical section?']  // challenge for the two-step lock: you are the scheduler; can you get both processes inside?
              : ['info', '<b>Now the lock is one atomic instruction.</b> Try every order you like. Can you still get both inside?']);  // challenge for the atomic lock: try any order; can both still get inside?
          }  // ends reset()
          const stateOf = (p) => {  // stateOf(p): works out the short state label and chip color for process p's card
            const pc = S.pc[p];  // pc is the process's current line
            if (P.inside.includes(pc)) return ['inside', 'ok'];  // on a critical-section line: "inside", in green
            if (pc === P.gap) return ['looked, not locked', 'warn'];  // on the gap line: it has looked but not locked, in the warning color
            if (mode === 'two' ? pc === 4 : pc === 3) return ['remainder', ''];  // on the last line (the remainder), which is line 4 in the two-step program and line 3 in the atomic one
            return [S.spinNow[p] ? 'spinning' : 'wants in', S.spinNow[p] ? 'warn' : 'accent'];  // otherwise it is at the test line: "spinning" if its last test failed, otherwise "wants in"
          };  // ends stateOf()
          function paint(v) {  // paint(v): copies the state onto the screen; v is an optional [color, message] for the verdict box
            const map = {};  // map will say which processes are on which code line
            [1, 2].forEach((p) => { (map[S.pc[p] + 1] = map[S.pc[p] + 1] || []).push(p); });  // groups the processes by line, using 1-based line numbers for the listing
            code.marks(map);  // draws the P1 and P2 markers in the code gutter
            cBolt.set(S.bolt);  // shows bolt's current value
            const ins = [1, 2].filter((p) => P.inside.includes(S.pc[p]));  // ins lists the processes that are inside the critical section right now
            room.className = 'room' + (ins.length === 1 ? ' one' : ins.length > 1 ? ' two' : '');  // colors the room green for one process inside, red for two
            room.replaceChildren(h('div', { class: 'xs' }, 'critical section'), h('div', { class: 'row gap-s', style: { justifyContent: 'center' } }, ...(ins.length ? ins.map((p) => h('span', { class: 'tok p' + p }, 'P' + p)) : [h('span', { class: 'small muted' }, 'empty')])));  // refills the room with its label and the badges of the processes inside, or "empty"
            [1, 2].forEach((p) => { const [t, c] = stateOf(p); pcard[p - 1].st.className = 'chip ' + c; pcard[p - 1].st.textContent = t; pcard[p - 1].nx.innerHTML = '<b>Next:</b> ' + P.next[S.pc[p]]; });  // updates each process card: its state chip (text and color) and the "Next:" description of its coming line
            tally.innerHTML = `Times both were inside: <b style="color:var(--${S.overlaps ? 'bad' : 'ok'})">${S.overlaps}</b> · spins: P1 ${S.spins[1]}, P2 ${S.spins[2]}`;  // tally: overlaps in red if any happened (green at zero), plus each process's spin count
            if (v) say.say(v[0], v[1]);  // shows the message, if one was given
          }  // ends paint()
          function stepP(p) {  // stepP(p): runs one line of process p; called by its Step button or by the replay
            const r = P.run(S, p);  // r is the result of running the line: the next line (to), whether it spun, and a log message (m)
            S.pc[p] = r.to;  // moves the process to its next line
            S.spinNow[p] = !!r.spin;  // remembers whether this step was a failed test, for the card's "spinning" label
            if (r.spin) S.spins[p]++;  // counts the spin
            const both = [1, 2].every((q) => P.inside.includes(S.pc[q]));  // both is true if both processes are now on critical-section lines
            let v = ['info', `${PN(p)} ${r.m}.`];  // default message: just what the process did
            if (both && !S.both) {  // both just got inside (and were not already both inside before this step)
              S.overlaps++;  // counts one more overlap
              v = ['bad', `<b>Both are inside!</b> Each process read bolt = 0 before either one wrote 1. The gap between STEP 1 and STEP 2 let the other process slip in. Mutual exclusion is broken.`];  // bad message: each read bolt = 0 before either wrote 1, so the gap let both in
            } else if (mode === 'two' && S.pc[1] === 1 && S.pc[2] === 1) {  // two-step lock, both on the gap line: both have looked, neither has locked, each thinks the lock is free
              v = ['warn', `${PN(p)} ${r.m}. Now <b>both</b> processes have read bolt = 0 and neither has written 1 yet. Each one believes the lock is free. Step them both once more.`];  // warning message for that dangerous moment, with a hint to step both once more
            } else if (mode === 'two' && S.pc[p] === 1) {  // two-step lock, this process just reached the gap line
              v = ['warn', `${PN(p)} ${r.m}. It is now in the <b>danger window</b>: it has looked but not locked. Try stepping the other process now.`];  // warning message: it is in the danger window, so try stepping the other process now
            } else if (mode === 'cas' && r.spin) {  // atomic lock, this process's test failed
              v = ['ok', `${PN(p)} ${r.m}. The value did not match 0, so nothing was written. Whatever order you pick, only one process can ever get the 0 back.`];  // success message: nothing was written, so only one process can ever get the 0 back
            }  // ends the choice of message
            S.both = both;  // remembers whether both are inside, so the next step only reports a new overlap
            const ph = log.querySelector('.ph'); if (ph) ph.remove();  // removes the log placeholder the first time something is logged
            log.prepend(h('div', { class: both && v[0] === 'bad' ? 'bad' : r.spin ? 'spin' : '', html: `P${p} ${r.m}` }));  // adds this step to the top of the log: red for an overlap, gray for a spin, plain otherwise
            paint(v);  // redraws everything with the chosen message
          }  // ends stepP()
          async function replay() {  // replay(): steps P1, P2, P1, P2, P1, P2 automatically, 800 ms apart
            const m = mode;  // remembers the mode being replayed
            reset(m); busy = true;  // starts clean and blocks the Step buttons during the replay
            const g = gen;  // g remembers this replay's reset number
            for (const p of [1, 2, 1, 2, 1, 2]) { await ctx.sleep(800); if (!ctx.alive || g !== gen) return; stepP(p); }  // alternates the two processes; stops if the student leaves the page or resets
            busy = false;  // the replay is done, so the buttons work again
          }  // ends replay()
          const seg = ctx.ui.seg([{ value: 'two', label: 'Two steps: test, then set' }, { value: 'cas', label: 'One atomic instruction' }], 'two', (m) => { busy = false; reset(m); });  // mode buttons: two separate steps (test, then set) or one atomic instruction; changing resets the lab
          reset('two');  // draws the two-step version when the page first loads
          el.append(h('div', { class: 'split l3 fill' },  // page layout: a split with the text column taking one third of the width and the lab column two thirds
            h('div', { class: 'stack' },  // the left column stacks the explanation
              h('p', { class: 'lead m0', html: 'Route 2 works on any number of processors. It starts from one hardware fact.' }),  // opening paragraph: route 2 works on any number of processors and rests on one hardware fact
              h('p', { class: 'm0 small', html: 'Memory serves one access to a given word at a time: while one read or write of a location is in progress, any other access to that <b>same</b> location waits its turn.' }),  // paragraph: memory handles one access to a given word at a time; others wait their turn
              h('p', { class: 'm0 small', html: 'Processor designers built on that: special instructions carry out <b>two actions on one word</b>, such as reading and writing it, or reading and testing it, within a single instruction cycle. Nothing can get between the two actions. Such an instruction is an <span class="t">atomic instruction</span>.' }),  // paragraph: so special instructions do two actions on one word in one instruction cycle, making them atomic
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Even squeezed onto one line, <code>if (bolt == 0) bolt = 1;</code> is two separate memory accesses: a read, then a write. Another process can reach bolt between them.' }),  // common-mistake box: writing the test and the set on one source line still makes two memory accesses
              h('div', { class: 'callout tip m0 small', 'data-label': 'Predict, then try', html: 'Is there <b>any</b> order of steps that gets both processes inside the atomic version? Decide first. Then step P1, P2, P1, P2 in each mode (or press <b>Replay</b>) and try every order you can think of.' })),  // predict-then-try box: decide whether any order breaks the atomic version, then experiment
            h('div', { class: 'stack gap-s' },  // the right column holds the lab
              h('div', { class: 'row' }, seg, h('span', { class: 'grow' }), h('button', { class: 'btn sm', type: 'button', onclick: replay }, 'Replay P1, P2, P1, P2'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { busy = false; reset(mode); } }, 'Reset')),  // top row: mode buttons, a spacer, the replay button and the reset button
              codeBox,  // the code listing with process markers
              h('div', { class: 'cols', style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 200px minmax(0,1fr)', gap: '10px' } },  // a three-column grid: P1's card, a 200px middle column, then P2's card (stacked into one column on a small screen)
                pcard[0].card,  // P1's control card
                h('div', { class: 'stack gap-s' }, cBolt, room),  // middle column: bolt's value box above the critical section room
                pcard[1].card),  // P2's control card
              tally, say, log)));  // the tally, the verdict box and the log close the right column
        },  // ends render() for step 4
      },  // ends step 4

      /* ============ 5. compare_and_swap: inside the instruction, then a lock built from it ============ */
      {  // opens step 5
        title: 'compare_and_swap: open up the instruction',  // step 5 title: opening up compare_and_swap to see what it does inside
        kind: 'explore',  // kind 'explore': a page for poking at a model
        render(el, ctx) {  // render() for step 5: builds the two tabs of this page
          const { h } = ctx;  // only HTML elements are needed
          /* ---------- tab 1: what the instruction does, micro-step by micro-step ---------- */
          function inside(panel) {  // inside(panel): builds tab 1, which walks through the instruction's parts one by one
            const code = ctx.ui.code(`int compare_and_swap(int *word,   // address of the shared word${/* shown code, line 1: the instruction's header and its first parameter, the address of the shared word */''}
                     int testval, // the value we expect to find${/* shown code, line 2: testval, the value the caller expects to find */''}
                     int newval)  // the value to store if we do${/* shown code, line 3: newval, the value to store if the expectation is right */''}
{                                 // ---- one atomic instruction ----${/* shown code, line 4: opening brace; everything inside happens as one atomic instruction */''}
    int oldval;                   // room for what we find${/* shown code, line 5: a local variable to hold the value found */''}
    oldval = *word;               // 1. READ the word${/* shown code, line 6: micro-step 1, read the word */''}
    if (oldval == testval)        // 2. COMPARE it with testval${/* shown code, line 7: micro-step 2, compare it with testval */''}
        *word = newval;           // 3. equal? WRITE newval${/* shown code, line 8: micro-step 3, write newval only if they matched */''}
    return oldval;                // 4. hand back what we found${/* shown code, line 9: micro-step 4, return the old value */''}
}                                 // ---- end: nothing got in between`, { fontSize: 13 });  // shown code, line 10: closing brace, nothing got in between; ends the listing, drawn at 13px
            const PRE = [  // PRE: the ready-made starting values the student can pick for the walkthrough
              { w: 0, t: 0, n: 1, label: 'Lock is free', lock: true },  // preset: the lock is free (word 0, test 0, new 1)
              { w: 1, t: 0, n: 1, label: 'Lock is taken', lock: true },  // preset: the lock is taken (word 1), so the compare fails
              { w: 7, t: 7, n: 3, label: 'Any values: match' },  // preset: arbitrary numbers that match, to show the instruction is not only for locks
              { w: 4, t: 7, n: 3, label: 'Any values: no match' },  // preset: arbitrary numbers that do not match
            ];  // closes PRE
            let pr = PRE[0];  // pr is the preset currently chosen; it starts as "lock is free"
            const cWord = cell(ctx, '*word (in memory)'), cT = cell(ctx, 'testval', 'cpu'), cN = cell(ctx, 'newval', 'cpu'), cO = cell(ctx, 'oldval', 'cpu');  // four value boxes: the word in memory, and testval, newval and oldval inside the processor
            const badge = h('span', { class: 'chip' });  // badge next to the memory label: says when the word is reserved for this instruction
            const cmp = h('div', { class: 'card white tight small', style: { minHeight: '64px' } });  // cmp is the white card that explains the current micro-step with the actual numbers
            const btns = PRE.map((p, k) => h('button', { class: 'btn sm', type: 'button', onclick: () => { pr = PRE[k]; btns.forEach((b, j) => b.classList.toggle('on', j === k)); player.reset(); } }, p.label));  // one button per preset; clicking marks it as chosen and restarts the walkthrough with its values
            btns[0].classList.add('on');  // the first preset starts out marked as chosen
            function frame(i) {  // frame(i): draws micro-step i (0 = before, 1 read, 2 compare, 3 write, 4 return); the player calls it
              const { w, t, n } = pr, eq = w === t;  // w, t and n are the preset's word, testval and newval; eq is true when the word matches testval
              const word = i >= 3 && eq ? n : w;  // word is the value in memory now: it changes to newval from micro-step 3 onward, but only on a match
              cWord.set(word, i === 3 && eq); cT.set(t); cN.set(n); cO.set(i >= 1 ? w : '?', i === 1);  // fills the four boxes; the word flashes when it is written and oldval flashes when it is first read
              badge.className = 'chip ' + (i >= 1 && i <= 3 ? 'os' : ''); badge.textContent = i >= 1 && i <= 3 ? 'word reserved: no other access can get in' : (i === 4 ? 'instruction finished' : 'instruction about to start');  // badge: during micro-steps 1-3 the word is reserved; before and after, it says the instruction is about to start or finished
              code.clear(); code.mark([[1, 2, 3], [6], [7], [8], [9]][i]);  // clears old highlights, then highlights the code lines for this micro-step (the header first, then lines 6-9)
              if (i === 3 && !eq) code.mark([8], 'dim');  // on a failed compare, the write line is dimmed to show it is skipped
              const res = `returns <b>${w}</b>, word is now <b>${word}</b>`;  // res is the result sentence reused in the last micro-step
              cmp.innerHTML = [  // the explanation card text, one entry per micro-step
                `Inputs: the word in memory holds <b>${w}</b>; we expect <b>${t}</b>; if it matches, store <b>${n}</b>.`,  // micro-step 0: the three inputs in plain words
                `<b>1. READ.</b> oldval = *word = <b>${w}</b>.`,  // micro-step 1: the read, with the value found
                `<b>2. COMPARE.</b> Is oldval (${w}) == testval (${t})? <b style="color:var(--${eq ? 'ok' : 'bad'})">${eq ? 'yes' : 'no'}</b>.`,  // micro-step 2: the compare, with yes in green or no in red
                eq ? `<b>3. WRITE.</b> They match, so *word = newval = <b>${n}</b>.` : `<b>3. NO WRITE.</b> No match, so memory is left exactly as it was (<b>${w}</b>).`,  // micro-step 3: the write when they match, or a note that memory is untouched when they do not
                `<b>4. RETURN.</b> The instruction ${res}.` + (pr.lock ? (w === 0 ? ' <span class="chip ok">returned 0: the lock is ours</span>' : ' <span class="chip warn">returned 1: taken, test again</span>') : ''),  // micro-step 4: the return value; for the lock presets a chip says whether the caller won the lock
              ][i];  // picks the entry for this micro-step
              return [  // the caption returned to the player, one per micro-step
                'Pick a case above, then step through. The whole instruction runs as <b>one indivisible step</b>; we slow it down only so you can see inside.',  // caption 0: choose a case; the instruction is really one step, slowed down only to look inside
                'The processor reads the memory word. From now until the instruction ends, no other processor can access this word.',  // caption 1: the read, after which no other processor can access this word until the end
                eq ? 'The value found equals the value expected.' : 'The value found is not the value expected, so the write will be skipped.',  // caption 2: whether the value found equals the value expected
                eq ? 'Because they matched, the new value is written. Read, compare and write all happened inside one instruction.' : 'Nothing is written. That is why a taken lock stays taken when someone else tests it.',  // caption 3: the write happened inside the same instruction, or nothing was written so a taken lock stays taken
                `The old value is returned. The caller looks at it to learn what the word held <b>before</b>: that is how it knows whether it won.`,  // caption 4: the old value tells the caller what the word held before, which is how it knows it won
              ][i];  // picks the caption for this micro-step
            }  // ends frame()
            const player = ctx.ui.player({ count: 5, render: frame, interval: 1700, speed: false });  // the step-through player for the 5 micro-steps, with no speed buttons
            panel.append(h('div', { class: 'split r fill' },  // tab 1 layout: a split with the wider column on the left for the code and notes
              h('div', { class: 'stack' }, code,  // left column: the code listing, then the notes
                h('p', { class: 'small m0', html: '<span class="t" data-t="compare_and_swap">compare_and_swap</span> (<b>CAS</b> for short) is also called <b>compare and exchange</b>. Many processors have it (x86 calls it <code>CMPXCHG</code>). It always returns the <b>old</b> value, whether or not it wrote anything.' }),  // paragraph: other names for the instruction (CAS, compare and exchange) and that it always returns the old value
                h('div', { class: 'callout tip m0 small', 'data-label': 'Reading the result', html: 'Returned value <b>equals testval</b>? Then the write happened. <b>Anything else</b>? Memory was not touched. For a lock with testval 0: getting 0 back means “I locked it”; getting 1 back means “someone else holds it”.' }),  // tip box: how to read the result; getting testval back means the write happened
                h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'The read and the write sit inside one instruction, so no other process or processor can see the word between them. The gap from the previous step is simply gone.' })),  // why-it-matters box: read and write in one instruction means the gap is gone
              h('div', { class: 'stack gap-s' },  // right column: the machine model
                h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' } }, ...btns),  // the four preset buttons in a two-column grid
                h('div', { class: 'card mem tight stack gap-s' }, h('div', { class: 'row gap-s' }, h('b', { class: 'xs', style: { color: 'var(--mem)', letterSpacing: '.06em' } }, 'MEMORY'), badge), cWord),  // memory card: a label, the reserved badge and the word's value box
                h('div', { class: 'card cpu tight stack gap-s' }, h('b', { class: 'xs', style: { color: 'var(--cpu)', letterSpacing: '.06em' } }, 'PROCESSOR REGISTERS'), h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' } }, cT, cN, cO)),  // processor card: a label and the three register boxes side by side
                cmp, player.el)));  // the explanation card and the player controls close the column
            return () => player.stop();  // returns a cleanup function that stops the player when the student leaves this tab
          }  // ends inside()
          /* ---------- tab 2: the spinlock built from compare_and_swap, three processes ---------- */
          function lock(panel) {  // lock(panel): builds tab 2, where three processes share a spinlock built from compare_and_swap
            const code = listing(ctx, `int bolt = 0;                     // shared lock word: 0 free, 1 taken${/* shown code, line 1: the shared lock word, starting at 0 (free) */''}
void P(int i) {                   // every process runs this same code${/* shown code, line 2: every process runs the same procedure P */''}
  while (true) {                  // repeat forever${/* shown code, line 3: an endless loop */''}
    while (compare_and_swap(&bolt, 0, 1) == 1)   // 1 back? taken...${/* shown code, line 4: keep calling compare_and_swap while it returns 1 (taken) */''}
      ;                           // ...so do nothing and test again${/* shown code, line 5: the empty loop body, so the process just tests again */''}
    /* critical section */        // 0 back: bolt is 1 now, and ours${/* shown code, line 6: the critical section, reached after getting 0 back */''}
    bolt = 0;                     // unlock: the next test can succeed${/* shown code, line 7: unlock by writing 0 */''}
    /* remainder */               // other work, no lock needed${/* shown code, line 8: the remainder, which needs no lock */''}
  }                               // end of the forever loop${/* shown code, line 9: end of the forever loop */''}
}                                 // end of P`, { fontSize: 13 });  // shown code, line 10: end of P; the listing is drawn at 13px
            code.style.alignSelf = 'start';   // size to its 10 lines instead of stretching to the callout column
            const LINE = { rem: 8, spin: 4, in: 6 };  // LINE: which code line each state is drawn on (remainder line 8, spinning line 4, inside line 6)
            /* frames: state of P1..P3, bolt, number of failed tests, and who just acted */
            const FR = [  // FR: the frames of the three-process animation; st holds each process's state, t its failed-test count
              { st: ['rem', 'rem', 'rem'], bolt: 0, t: [0, 0, 0], cap: 'All three processes are doing other work. <b>bolt = 0</b>: the lock is free.' },  // frame 1: all three are in their remainder and the lock is free
              { st: ['rem', 'in', 'rem'], bolt: 1, t: [0, 0, 0], who: 2, cap: 'P2 wants in. compare_and_swap finds 0, writes 1 and returns 0. The loop ends: <b>P2 is inside</b>.' },  // frame 2: P2 gets 0 back from compare_and_swap and goes inside
              { st: ['spin', 'in', 'rem'], bolt: 1, t: [1, 0, 0], who: 1, cap: 'P1 wants in. compare_and_swap finds 1 (no match, nothing written) and returns 1. P1 must test again.' },  // frame 3: P1 gets 1 back and must test again
              { st: ['spin', 'in', 'spin'], bolt: 1, t: [1, 0, 1], who: 3, cap: 'P3 wants in too. It also gets 1 back. Now two processes are spinning.' },  // frame 4: P3 also gets 1 back, so two processes spin
              { st: ['spin', 'in', 'spin'], bolt: 1, t: [2, 0, 1], who: 1, cap: 'P1 tests again: 1 again. This is <b>busy waiting</b>: every test burns processor time and achieves nothing.' },  // frame 5: P1 tests again and fails again: busy waiting wastes processor time
              { st: ['spin', 'rem', 'spin'], bolt: 0, t: [2, 0, 1], who: 2, cap: 'P2 leaves its critical section and writes <b>bolt = 0</b>. The lock is free, but nobody is told; the spinners must notice.' },  // frame 6: P2 unlocks; nobody is told, so the spinners have to notice on their own
              { st: ['spin', 'rem', 'in'], bolt: 1, t: [2, 0, 1], who: 3, cap: 'P3 happens to test first and gets 0: <b>P3 is inside</b>. P1 had waited longer, but the hardware keeps no queue.' },  // frame 7: P3 happens to test first and wins, though P1 waited longer: there is no queue
              { st: ['spin', 'rem', 'in'], bolt: 1, t: [3, 0, 1], who: 1, cap: 'P1 tests again and gets 1. Nothing promises it a turn, ever. That is how <b>starvation</b> becomes possible.' },  // frame 8: P1 fails again; nothing promises it a turn, so starvation is possible
              { st: ['in', 'rem', 'rem'], bolt: 1, t: [3, 0, 1], who: 1, cap: 'P3 unlocks (bolt = 0), and this time P1 is the first to test: it gets 0 and <b>goes in</b>. Luck, not fairness.' },  // frame 9: P3 unlocks and this time P1 tests first and wins, by luck rather than fairness
            ];  // closes FR
            const cBolt = cell(ctx, 'bolt');  // cBolt shows the lock word's value
            const pbox = [1, 2, 3].map((p) => { const st = h('span', { class: 'chip' }); const tn = h('span', { class: 'xs muted' }); return { st, tn, el: h('div', { class: 'card tight row gap-s', style: { flex: '1 1 0', justifyContent: 'center' } }, h('span', { class: 'tok p' + p }, 'P' + p), st, tn) }; });  // pbox: one status card per process with its badge, a state chip and a failed-test counter
            const NAME = { rem: ['remainder', ''], spin: ['spinning', 'warn'], in: ['inside', 'ok'] };  // NAME: the chip label and color for each state
            function frame(i) {  // frame(i): draws animation frame i; the player calls it on every step
              const f = FR[i];  // f is the frame to draw
              const map = {};  // map will say which processes are on which code line
              f.st.forEach((st, k) => { (map[LINE[st]] = map[LINE[st]] || []).push(k + 1); });  // puts each process on the code line that matches its state
              code.marks(map);  // draws the process markers in the gutter
              cBolt.set(f.bolt, i > 0 && f.bolt !== FR[i - 1].bolt);  // shows bolt, flashing it when its value changed since the previous frame
              pbox.forEach((b, k) => { const [t, c] = NAME[f.st[k]]; b.st.className = 'chip ' + c; b.st.textContent = t; b.tn.textContent = f.t[k] ? `failed tests: ${f.t[k]}` : ''; b.el.classList.toggle('flash', f.who === k + 1); });  // updates each process card: state chip, failed-test count (hidden at zero), and a flash on the one that just acted
              return f.cap;  // returns the caption for the player to show
            }  // ends frame()
            const player = ctx.ui.player({ count: FR.length, render: frame, interval: 2300 });  // the player: one step per frame, 2.3 seconds apart when playing
            panel.append(h('div', { class: 'stack fill gap-s' },  // tab 2 layout: everything stacked in one column that fills the tab
              h('div', { class: 'split r', style: { height: 'auto' } }, code,  // top part: a split with the code on the wider left side; auto height so it does not stretch
                h('div', { class: 'stack gap-s' },  // right side: three notes stacked
                  h('div', { class: 'callout tip m0 small', 'data-label': 'Simple, so easy to verify', html: 'Only the process that finds bolt = 0 leaves the loop, and finding it sets bolt to 1 in the same step. That is the whole proof.' }),  // tip box: the lock is simple enough that its correctness proof is one sentence
                  h('div', { class: 'callout why m0 small', 'data-label': 'Many critical sections', html: 'Give each resource its own lock word (<code>bolt_printer</code>, <code>bolt_queue</code>). Users of different resources never block each other.' }),  // why box: give each resource its own lock word so unrelated users never block each other
                  h('div', { class: 'callout warn m0 small', 'data-label': 'The catch', html: 'A waiter runs compare_and_swap over and over: <span class="t" data-t="busy waiting">busy waiting</span>, hence the name <span class="t" data-t="spinlock">spinlock</span>. Each failed test burns processor time.' }))),  // warning box: waiters test over and over (busy waiting), which is where the name spinlock comes from
              h('div', { class: 'row nw', style: { gap: '8px' } }, ...pbox.map((b) => b.el), h('div', { style: { flex: '0 0 110px' } }, cBolt)),  // a row of the three process cards with bolt's box at the end, fixed at 110px
              player.el));  // the player controls at the bottom
            return () => player.stop();  // returns a cleanup function that stops the player when the student leaves this tab
          }  // ends lock()
          el.append(ctx.ui.tabs([{ label: 'Inside the instruction', render: inside }, { label: 'Building a lock from it', render: lock }]));  // puts the two tabs on the page; each tab builds its content when it is opened
        },  // ends render() for step 5
      },  // ends step 5

      /* ============ 6. The exchange instruction and its invariant (explore) ============ */
      {  // opens step 6
        title: 'The exchange instruction and its invariant',  // step 6 title: the exchange instruction and the invariant that proves its lock correct
        kind: 'explore',  // an explore page
        render(el, ctx) {  // render() for step 6: builds the exchange lock model when the page opens
          const { h, s } = ctx;  // h for HTML elements and s for SVG drawing elements
          const N = 3;  // N is the number of processes sharing the lock (3); the invariant says bolt plus all keys equals N
          const def = ctx.ui.code(`void exchange(int *reg, int *mem) { // reg: a register, mem: a memory word${/* shown code, line 1: exchange takes a register and a memory word (def is the definition box on the page) */''}
    int temp;          // scratch space inside the processor${/* shown code, line 2: temp is scratch space inside the processor */''}
    temp = *mem;       // copy the memory word aside${/* shown code, line 3: copy the memory word aside */''}
    *mem = *reg;       // the register's value goes to memory${/* shown code, line 4: the register's value goes into memory */''}
    *reg = temp;       // the old memory value goes to the register${/* shown code, line 5: the old memory value goes into the register */''}
}                      // all one atomic instruction`, { fontSize: 13 });  // shown code, line 6: all of it happens as one atomic instruction; ends the definition, drawn at 13px
          const code = listing(ctx, `int bolt = 0;                  // shared: 0 free, 1 taken${/* shown code, line 1 of the lock: the shared lock word bolt starts at 0 (free); code is the listing with process markers */''}
void P(int i) {                // every process runs this code${/* shown code, line 2: every process runs the same procedure P */''}
  while (true) {               // repeat forever${/* shown code, line 3: an endless loop */''}
    int keyi = 1;              // my private key starts at 1${/* shown code, line 4: each attempt starts with the private key set to 1 */''}
    do exchange(&keyi, &bolt); // swap my key with bolt, atomically${/* shown code, line 5: swap the key with bolt in one atomic exchange */''}
    while (keyi != 0);         // pulled out the 0? if not, swap again${/* shown code, line 6: repeat the swap until the key holds the 0 */''}
    /* critical section */     // I hold the only 0: the lock is mine${/* shown code, line 7: the critical section; this process holds the only 0 */''}
    bolt = 0;                  // put a 0 back into bolt: unlock${/* shown code, line 8: unlock by putting a 0 back into bolt */''}
    /* remainder */            // other work${/* shown code, line 9: the remainder */''}
  }                            // end of the forever loop${/* shown code, line 10: end of the forever loop */''}
}                              // end of P`, { fontSize: 13 });  // shown code, line 11: end of P; the listing is drawn at 13px
          /* ---- the machine: bolt in memory, one key register per process ---- */
          const BX = 235, BY = 56, KX = [80, 235, 390], KY = 196;  // drawing positions: bolt's center (BX, BY) at the top, and the three key registers along the bottom at KX, KY
          const svg = s('svg', { viewBox: '0 0 470 236', width: '100%', role: 'img', 'aria-label': 'bolt in memory and the three private keys' });  // the machine drawing: bolt in memory above, the three processes' key registers below
          let S, busy = false, gen = 0;   // gen: bumped by Reset so a swap already in flight is ignored
          const say = verdict(ctx);  // say is the verdict box explaining each step
          const inv = h('div', { class: 'card white tight center mono', style: { fontSize: '14.5px', whiteSpace: ctx.narrow ? 'normal' : 'nowrap' } });  // inv shows the invariant sum in fixed-width type; it may wrap on a phone-width screen, but stays on one line otherwise
          const meaning = h('div', { class: 'small center', style: { minHeight: '22px' } });  // meaning is the line under the sum that says what the current values mean
          const pc = [1, 2, 3].map((p) => {  // pc: builds a Step button and a state chip for each of the three processes
            const st = h('span', { class: 'chip' });  // st is the process's state chip
            const btn = h('button', { class: 'btn sm', type: 'button', style: { borderColor: `var(--${['proc', 'accent', 'io'][p - 1]})`, color: `var(--${['proc', 'accent', 'io'][p - 1]})` }, onclick: () => !busy && stepP(p) }, 'Step P' + p);  // the Step button, drawn in the process's own color; it runs one step (ignored while a swap is animating)
            return { st, btn, el: h('div', { class: 'stack gap-s', style: { alignItems: 'center' } }, btn, st) };  // stacks the button above the chip and keeps references for later updates
          });  // ends the builder
          const token = (x, y, v, extra = {}) => s('g', Object.assign({ class: 'tokn' }, extra),  // token(x, y, v, extra): draws one round value token (a 0 or a 1) as an SVG group; extra adds attributes such as data-slot
            s('circle', { cx: x, cy: y, r: 19, class: v === 0 ? 's-ok' : 's-panel', 'stroke-width': 3 }),  // the token's circle: green when it holds the precious 0, gray when it holds a 1
            s('text', { x, y: y + 7, 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 900, class: 's-monot', style: v === 0 ? 'fill:var(--ok)' : '' }, String(v)));  // the digit inside the token, in fixed-width type, green for a 0
          function draw(hi) {  // draw(hi): redraws the machine; hi is the process whose swap should be highlighted, if any
            const kids = [];  // kids collects the SVG pieces
            KX.forEach((x, k) => kids.push(s('line', { x1: x, y1: 146, x2: BX, y2: 92, class: 's-muted', style: hi === k + 1 ? 'stroke:var(--accent);stroke-width:3' : '' })));  // a line from each key register up to bolt, drawn thick in the accent color for the process that is swapping
            const FS = ctx.narrow ? 1.25 : 1;   // phones render this SVG at about 70%, so enlarge its text
            kids.push(s('rect', { x: 160, y: 8, width: 150, height: 82, rx: 12, class: 's-mem', 'stroke-width': 2 }),  // the memory box around bolt
              s('text', { x: BX, y: 28, 'text-anchor': 'middle', 'font-size': 13 * FS, 'font-weight': 800 }, ctx.narrow ? 'bolt (memory)' : 'bolt (shared memory)'));  // its label; on a phone-width screen the shorter text "bolt (memory)" is used so it fits
            KX.forEach((x, k) => kids.push(  // for each process, draws its register box and labels
              s('rect', { x: x - 68, y: 140, width: 136, height: 93, rx: 12, class: 's-cpu', 'stroke-width': S.st[k] === 'in' ? 3.5 : 2, style: S.st[k] === 'in' ? 'stroke:var(--ok)' : '' }),  // the register box; its outline turns thick and green while that process is inside
              s('text', { x, y: 159, 'text-anchor': 'middle', 'font-size': 14.5 * FS, 'font-weight': 800, style: `fill:var(--${['proc', 'accent', 'io'][k]})` }, `key${k + 1}`),  // the key's name, key1 to key3, in that process's color
              s('text', { x, y: ctx.narrow ? 177 : 174, 'text-anchor': 'middle', 'font-size': 12.5 * FS, class: 's-sub' }, `P${k + 1}'s register`)));  // a smaller note under it saying whose register it is (moved down a little on phone-width screens)
            kids.push(token(BX, BY + 8, S.bolt, { 'data-slot': 'b' }));  // bolt's token, tagged with data-slot b so the swap animation can find it
            KX.forEach((x, k) => kids.push(token(x, KY + 8, S.key[k], { 'data-slot': 'k' + (k + 1) })));  // each key's token, tagged k1, k2 or k3
            if (hi) kids.push(s('text', { x: (KX[hi - 1] + BX) / 2 + (hi === 2 ? 22 : 0), y: 124, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 900, style: 'fill:var(--accent)' }, '⇅'));  // during a swap, a double arrow between the key and bolt (nudged sideways for the middle process)
            svg.replaceChildren(...kids);  // replaces the whole drawing with the new pieces
          }  // ends draw()
          function paint(v, hi) {  // paint(v, hi): redraws the machine and every text display; v is an optional [color, message]
            draw(hi);  // redraws the drawing, highlighting process hi's link if given
            const sum = S.bolt + S.key.reduce((a, b) => a + b, 0);  // sum is bolt plus all three keys, the quantity the invariant is about
            const good = sum === N;  // the invariant holds when the sum equals N (3)
            inv.innerHTML = `bolt + key1 + key2 + key3 = ${S.bolt}+${S.key.join('+')} = <b>${sum}</b> ${good ? '= n <b style="color:var(--ok)">✓</b>' : '≠ n <b style="color:var(--bad)">✗</b>'}`;  // writes the sum out term by term, then a green check if it equals n or a red cross if not
            const ins = S.st.map((x, k) => (x === 'in' ? k + 1 : 0)).filter(Boolean);  // ins lists the processes that are inside right now
            const zeros = (S.bolt === 0 ? 1 : 0) + S.key.filter((x) => x === 0).length;  // zeros counts how many 0 tokens exist in the whole system (in bolt or in any key)
            meaning.innerHTML = !good ? `<b style="color:var(--bad)">Invariant broken: ${zeros} zeros in the system, so ${zeros} processes can be inside at once.</b>`  // if the invariant is broken: warns that that many zeros means that many processes could be inside
              : S.bolt === 0 ? 'bolt = 0, so <b>no process</b> is in its critical section.'  // otherwise, if bolt holds the 0: nobody is inside
                : `bolt = 1, so <b>exactly one</b> process is inside: ${PN(ins[0])}, the one whose key is 0.`;  // otherwise: exactly one process is inside, the one whose key holds the 0
            const map = {};  // map will say which processes are on which code line
            S.st.forEach((st, k) => { const ln = st === 'in' ? 7 : st === 'try' ? 5 : 9; (map[ln] = map[ln] || []).push(k + 1); });  // puts each process on line 7 when inside, line 5 when trying (swapping), or line 9 in the remainder
            code.marks(map);  // draws the process markers in the listing's gutter
            pc.forEach((c, k) => { const [t, cl] = { rem: ['remainder', ''], try: ['spinning', 'warn'], in: ['inside', 'ok'] }[S.st[k]]; c.st.className = 'chip ' + cl; c.st.textContent = t; });  // updates each process's state chip: remainder, spinning or inside, with a matching color
            if (v) say.say(v[0], v[1]);  // shows the message, if one was given
          }  // ends paint()
          function reset() {  // reset(): puts the model back to its start: bolt 0, all keys 1, everyone in the remainder
            gen++;  // bumps the reset counter so a swap animation already running is ignored
            S = { bolt: 0, key: [1, 1, 1], st: ['rem', 'rem', 'rem'], broken: false };  // S holds bolt, the three keys, each process's state, and whether the rule has been broken
            busy = false;  // unlocks the Step buttons
            paint(['info', '<b>You are the scheduler.</b> Step any process. A waiting process swaps its key with bolt and checks whether it pulled out the 0. Watch the sum above: no order of steps can change it.']);  // draws the start with instructions: step any process and watch the sum stay the same
          }  // ends reset()
          /* animate a swap between bolt and key p, then commit the new values */
          function flySwap(p, done) {  // flySwap(p, done): slides bolt's token and process p's key token past each other, then calls done
            const tb = svg.querySelector('[data-slot="b"]'), tk = svg.querySelector('[data-slot="k' + p + '"]');  // finds the two tokens in the drawing by their data-slot tags
            const dx = KX[p - 1] - BX, dy = KY - BY;  // dx, dy is the distance from bolt to the key register
            [tb, tk].forEach((t) => (t.style.transition = 'transform .5s ease'));  // sets a half-second smooth transition on both tokens so the move is animated
            const g = gen;  // g remembers the reset number, so a reset during the animation cancels it
            ctx.raf(() => { if (g === gen) { tb.style.transform = `translate(${dx}px, ${dy}px)`; tk.style.transform = `translate(${-dx}px, ${-dy}px)`; } return false; });  // on the next animation frame, moves each token to the other's position (returning false runs it only once)
            busy = true;  // blocks the Step buttons while the tokens are moving
            ctx.after(560, () => { if (g !== gen) return; busy = false; done(); });  // after 560 ms, unless the lab was reset, unblocks the buttons and commits the swap by calling done
          }  // ends flySwap()
          function stepP(p) {  // stepP(p): one step for process p, called by its Step button
            const k = p - 1, st = S.st[k];  // k is the process's index (0-based) and st its current state
            if (st === 'in') {  // a process that is inside takes its next step by leaving
              S.bolt = 0; S.key[k] = 1; S.st[k] = 'rem';  // it writes 0 into bolt, its key goes back to 1 for next time, and it returns to the remainder
              paint(['info', `${PN(p)} leaves its critical section and writes <b>bolt = 0</b>: the single 0 is back in bolt. Its old key is done with; its next attempt starts with <code>int key${p} = 1</code>, so the diagram shows key${p} = 1 from now on.`]);  // info message: the single 0 is back in bolt, and the next attempt will start with key = 1
              return;  // nothing to animate for an unlock, so stop here
            }  // ends the leaving case
            flySwap(p, () => {  // otherwise the process swaps its key with bolt; the values change after the animation
              const old = S.bolt; S.bolt = S.key[k]; S.key[k] = old;  // the atomic exchange: bolt and the key trade values
              if (S.key[k] === 0) {  // the key came back holding 0, so this process has the lock
                S.st[k] = 'in';  // it is now inside
                const two = S.st.filter((x) => x === 'in').length > 1;  // two is true if someone else is inside as well, which can only happen after the rule was broken
                paint(two ? ['bad', `${PN(p)} swaps and pulls out a 0 too. <b>Two processes are inside.</b> The rule was broken, so the invariant no longer protects anyone.`]  // bad message if two are inside; the broken rule means the invariant protects nobody
                  : ['ok', `${PN(p)} swaps: its key gets bolt's <b>0</b> and bolt gets its 1. The test <code>key${p} != 0</code> is false, so the loop ends: ${PN(p)} is <b>inside</b>.`], p);  // ok message: the key took bolt's 0, so the loop test fails and the process enters; highlights its link
              } else {  // the key came back holding 1, so the lock was taken
                S.st[k] = 'try';  // the process keeps trying
                paint(['warn', `${PN(p)} swaps its 1 for bolt's 1: nothing changes. <code>key${p}</code> is still 1, so it loops and swaps again (busy waiting).`], p);  // warning message: it swapped a 1 for a 1, so it loops and swaps again (busy waiting)
              }  // ends the check on the swapped value
            });  // ends the callback run after the animation
          }  // ends stepP()
          function breakRule() {  // breakRule(): simulates a buggy process that writes bolt = 0 without holding the lock
            if (busy) return;  // does nothing while a swap animation is still running
            const holder = S.st.indexOf('in');  // holder is the index of the process that is inside, or -1 if nobody is
            if (holder < 0) { say.say('info', 'Nobody holds the lock right now, so a stray <code>bolt = 0</code> would change nothing. Let a process get inside first.'); return; }  // with nobody inside, a stray unlock would change nothing, so the lab says so and stops
            if (S.bolt === 0) { say.say('bad', 'bolt is already 0 while a process is inside: the rule is already broken. Step a waiting process to see it walk in, or press <b>Reset</b>.'); return; }  // if bolt is already 0 while someone is inside, the rule is already broken; the lab says so and stops
            S.bolt = 0;  // the bug itself: bolt becomes 0 even though a process still holds the lock
            const sum = S.key.reduce((a, b) => a + b, 0), zeros = 1 + S.key.filter((x) => x === 0).length;  // sum is now the keys alone (bolt is 0); zeros counts the 0 in bolt plus every 0 key
            paint(['bad', `<b>A bug:</b> some code writes <code>bolt = 0</code> while ${PN(holder + 1)} still holds the lock. Now there are ${zeros} zeros in the system and the sum is ${sum}, not ${N}. Step another process: it will get in too.`]);  // bad message: now there are two zeros and the sum is wrong, so another process will get in too
          }  // ends breakRule()
          reset();  // draws the starting state when the page loads
          el.append(h('div', { class: 'split r fill' },  // page layout: a split with the wider column on the left for the text and code
            h('div', { class: 'stack gap-s' },  // left column: explanation and listings
              h('p', { class: 'm0', html: 'The <span class="t" data-t="exchange instruction">exchange instruction</span> atomically swaps a register with a memory word.' }),  // paragraph: the exchange instruction swaps a register and a memory word atomically
              def, code,  // the exchange definition box, then the lock listing with process markers
              h('div', { class: 'callout why m0 small', 'data-label': 'Why the sum stays n', html: 'Each process swaps its private <b>key</b> with <code>bolt</code>. A swap only moves two values around, so their total cannot change, and unlocking just returns the 0 to bolt. The sum is an <span class="t">invariant</span>: exactly one 0 exists, so at most one process can hold it. (A process outside the loop counts as key 1, its restart value.)' })),  // why box: a swap only moves values around, so the total stays n and exactly one 0 exists
            h('div', { class: 'stack gap-s' },  // right column: the machine model and its controls
              h('div', { class: 'card white tight' }, svg),  // the machine drawing on a white card
              h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' } }, ...pc.map((c) => c.el)),  // the three Step buttons with their state chips, in three equal columns
              inv, meaning, say,  // the invariant sum, its meaning and the verdict box
              h('div', { class: 'row gap-s' }, h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset'), h('span', { class: 'grow' }),  // bottom row: the Reset button, then a spacer
                h('button', { class: 'btn sm danger', type: 'button', title: 'Simulate a buggy process that unlocks a lock it does not hold', onclick: breakRule }, 'Break the rule')))));  // the red Break the rule button, whose tooltip explains that it simulates a buggy unlock
        },  // ends render() for step 6
      },  // ends step 6

      /* ============ 7. Busy waiting and starvation: the spin simulator (lab) ============ */
      {  // opens step 7
        title: 'Busy waiting and starvation: the spin simulator',  // step 7 title: busy waiting and starvation, shown with a spin simulator
        kind: 'lab',  // a lab page
        core: true,  // on the core path through the guide
        render(el, ctx) {  // render() for step 7: builds the spin simulator when the page opens
          const { h, s } = ctx;  // h for HTML elements and s for SVG drawing elements
          /* ticks shown, cell width and lane geometry. Phones get a compact layout (10 ticks, short lane labels,
             tighter stat columns) so the viewBox stays close to the rendered width and the text stays readable. */
          const NW = ctx.narrow;  // NW is true on a phone-width screen; the drawing then uses a compact layout
          const W = NW ? 10 : 24, CW = NW ? 18 : 19, X0 = NW ? 34 : 58, LH = 38, Y0 = 28;  // W ticks shown (10 on phones, 24 otherwise), CW the width of one tick cell, X0 where cells start, LH the lane height, Y0 the top
          const SX0 = X0 + W * CW, SX = NW ? [SX0 + 24, SX0 + 70, SX0 + 122] : [SX0 + 34, SX0 + 84, SX0 + 136], VW = SX0 + (NW ? 152 : 166);  // SX0 is where the statistics columns start, SX their three x positions, and VW the total drawing width
          const LANE_CLS = { rem: 'cl-rem', spin: 'cl-spin', in: 'cl-in' };  // LANE_CLS maps each process state to its cell color class (remainder, spinning, inside)
          let n = 4, L = 3, policy = 'random', S, rng, timer = null;  // settings and state: n processes (4), critical section length L (3 ticks), the win policy, state S, random source, run timer
          const svg = s('svg', { viewBox: `0 0 ${VW} ${Y0 + 4 * LH + 26}`, width: '100%', role: 'img', 'aria-label': 'Timeline of what each processor did in every tick' });  // the timeline drawing: one lane per processor, sized from the geometry above
          const say = verdict(ctx);  // say is the verdict box that explains each tick
          const meter = h('div', { class: 'meter grow' }, h('i', { style: { background: 'var(--warn)' } }));  // meter is a thin bar that fills to show the share of processor time spent spinning
          const pct = h('div', { class: 'small', style: { minWidth: '250px' } });  // pct is the text next to the meter with the exact percentages
          const bRun = h('button', { class: 'btn sm primary', type: 'button', onclick: () => (timer ? stop() : run()) }, 'Run');  // Run button: starts automatic ticking, or pauses it if it is already running
          const listP = (arr) => arr.map((p) => PN(p.k + 1)).join(arr.length === 2 ? ' and ' : ', ');  // listP(arr): turns a list of processes into readable text such as "P1 and P3" or "P1, P2, P4"

          function reset() {  // reset(): starts the simulation over with the current settings
            stop();  // stops automatic running first
            rng = ctx.util.seeded(7);  // a seeded random generator (seed 7), so every reset replays the same "random" choices
            S = { t: 0, bolt: 0, asking: null, hist: [], P: ctx.util.range(n).map((k) => ({ k, st: 'rem', left: [1, 1, 2, 2][k], entries: 0, spun: 0, wait: 0, maxWait: 0 })) };  // S: tick count, bolt, any pending choice, the lane history, and per process its state, ticks left, entries, spins and waits
            draw();  // draws the empty timeline
            say.say('info', policy === 'you'  // opening instruction, which depends on the policy
              ? '<b>You are the memory.</b> Press <b>Step</b> or <b>Run</b>. Whenever the lock is free and several processes try compare_and_swap at once, you decide whose instruction reaches memory first. Try to keep P1 out.'  // for "you decide": the student acts as memory and picks who wins each race; try to keep P1 out
              : policy === 'unlucky'  // for "unlucky P1"
                ? '<b>Press Run.</b> In this mode P1 loses every race that has another contender. That is unlucky but perfectly legal: the hardware promises nothing about who wins.'  // instruction: P1 loses every race that has another contender, which is unlucky but legal
                : '<b>Press Run</b> (or Step, one tick at a time). Each row is one processor running one process. Watch the orange stretches: that is processor time spent spinning.');  // for the random policy: press Run and watch the orange spinning stretches
          }  // ends reset()
          /* one tick of time. choice = index of the winner when the student is the arbiter */
          function tick(choice) {  // tick(choice): advances the simulation one tick; choice is the winner's index when the student is deciding
            if (S.asking && choice == null) return;  // while waiting for the student to pick a winner, ordinary Step or Run ticks are ignored
            if (choice != null && !(S.asking && S.asking.includes(S.P[choice]))) return;  // a choice is ignored unless it names one of the processes currently in the race
            const sp = S.P.filter((p) => p.st === 'spin');  // sp lists the processes that are spinning, ready to run compare_and_swap this tick
            let w = null, v = null;  // w will be the process that gets the lock this tick; v the message to show
            if (S.bolt === 0 && sp.length) {  // a race happens only when the lock is free and at least one process is spinning
              if (sp.length === 1) w = sp[0];  // a single spinner wins automatically
              else if (policy === 'you') {  // in "you decide" mode with several spinners, the student chooses
                if (choice == null) { ask(sp); return; }  // no choice yet: show the choice buttons and wait
                w = S.P[choice];  // the student's pick wins
              } else if (policy === 'unlucky') { const o = sp.filter((p) => p.k !== 0); w = o.length ? o[Math.floor(rng() * o.length)] : sp[0]; }  // in unlucky mode, a random process other than P1 wins whenever there is one; P1 wins only when alone
              else w = sp[Math.floor(rng() * sp.length)];  // otherwise a random spinner wins
              const waited = w.wait;  // waited remembers how long the winner had been spinning, for the message
              w.st = 'in'; w.left = L; w.entries++; w.wait = 0; S.bolt = 1;  // the winner goes inside for L ticks, its entry count goes up, its wait resets, and bolt becomes 1
              const lost = sp.filter((p) => p !== w);  // lost lists the other spinners, who got 1 back
              v = sp.length === 1  // the message depends on whether there was a single spinner or a real race
                ? ['ok', `Tick ${S.t}: ${PN(w.k + 1)} ran compare_and_swap on a free lock, got 0 back and went in${waited ? ` after spinning ${waited} tick${waited === 1 ? '' : 's'}` : ' with no waiting at all'}.`]  // ok message for a single spinner: it got 0 back and went in, after spinning some ticks or with no waiting at all
                : ['info', `Tick ${S.t}: the lock came free and ${listP(sp)} all ran compare_and_swap. ${PN(w.k + 1)}’s reached memory first and got 0. ${listP(lost)} got 1 and keep spinning. Nobody checked who had waited longest.`];  // info message for a real race: one reached memory first; the rest keep spinning; nobody checked who waited longest
            }  // ends the race case
            S.asking = null;  // any pending choice is now settled
            S.hist.push(S.P.map((p) => p.st));  // records this tick's state of every process for the timeline
            if (S.hist.length > W) S.hist.shift();  // keeps only the last W ticks, dropping the oldest
            S.P.forEach((p) => {  // advances every process by one tick
              if (p.st === 'in') { p.left--; if (!p.left) { p.st = 'rem'; p.left = 1 + Math.floor(rng() * 3); S.bolt = 0; } }  // inside: one tick less; when done, it goes to the remainder for 1-3 random ticks and bolt becomes 0 (unlock)
              else if (p.st === 'rem') { p.left--; if (!p.left) { p.st = 'spin'; p.wait = 0; } }  // in the remainder: one tick less; when done, it starts spinning with its wait count at zero
              else { p.spun++; p.wait++; p.maxWait = Math.max(p.maxWait, p.wait); }  // spinning: counts one more spin and one more tick of waiting, and keeps the longest wait so far
            });  // ends the per-process update
            S.t++;  // the clock moves forward one tick
            const starving = S.P.filter((p) => p.st === 'spin' && p.wait >= 10).sort((a, b) => b.wait - a.wait)[0];  // starving is the longest-waiting spinner that has waited 10 ticks or more, if any
            const spinning = S.P.filter((p) => p.st === 'spin');  // spinning lists every process still spinning after this tick
            if (starving) v = ['bad', `<b>Starvation.</b> ${PN(starving.k + 1)} has been spinning for <b>${starving.wait} ticks</b> and has got in ${starving.entries} time${starving.entries === 1 ? '' : 's'} in total. Others keep winning the race for the free lock, and nothing in the hardware promises ${PN(starving.k + 1)} a turn.`];  // a starving process overrides other messages: it keeps losing and nothing promises it a turn
            else if (!v) v = spinning.length ? ['warn', `Tick ${S.t - 1}: ${listP(spinning)} spun: compare_and_swap returned 1, so the loop tests again. That is ${spinning.length} processor-tick${spinning.length === 1 ? '' : 's'} of <b>busy waiting</b>, doing no useful work.`]  // otherwise, if nothing else happened, report the spinners and the processor time they wasted
              : ['info', `Tick ${S.t - 1}: nobody is waiting. When there is no contention, a spinlock costs almost nothing.`];  // or, if nobody is waiting, note that an uncontested spinlock costs almost nothing
            draw(); say.say(v[0], v[1]);  // redraws the timeline and shows the message
          }  // ends tick()
          function ask(sp) {  // ask(sp): in "you decide" mode, asks the student which spinner reaches memory first
            S.asking = sp;  // remembers who is in the race, which pauses normal ticking
            say.say('warn', `<b>The lock is free, and ${listP(sp)} all run compare_and_swap at the same moment.</b> Memory serves one of them first. Whose instruction gets there first?<br>`);  // warning message: the lock is free and these processes all try at once; whose goes first?
            sp.forEach((p) => say.append(h('button', { class: 'btn sm', type: 'button', style: { borderColor: `var(--${['proc', 'accent', 'io', 'thread'][p.k]})` }, onclick: () => tick(p.k), html: TOK(p.k + 1) + (p.wait ? ` <span class="xs muted">waited ${p.wait}</span>` : '') })));  // adds one button per contender inside the verdict box, showing its badge and how long it has waited
          }  // ends ask()
          function draw() {  // draw(): redraws the timeline from the recorded history plus the statistics columns
            const kids = [  // kids collects the SVG pieces
              s('text', { x: 4, y: 16, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 'CPU'),  // the "CPU" heading over the lane labels
              s('text', { x: X0 + (W * CW) / 2, y: 16, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 's-sub' }, ctx.narrow ? `last ${W} ticks  →` : `what each processor did, last ${W} ticks  →`),  // the heading over the cells; on a phone-width screen it is shortened to "last 10 ticks"
              ...['got in', 'spun', 'max wait'].map((t, j) => s('text', { x: SX[j], y: 16, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 's-sub' }, t)),  // column headings over the three statistics: times it got in, failed attempts, and longest wait
            ];  // ends the fixed heading pieces
            const t0 = S.t - S.hist.length;  // t0 is the tick number of the oldest cell still shown, used for the time labels
            S.P.forEach((p, k) => {  // draws one lane per process
              const y = Y0 + k * LH;  // y is the top of this process's lane
              kids.push(s('text', { x: 4, y: y + 23, 'font-size': 14, 'font-weight': 800, style: `fill:var(--${['proc', 'accent', 'io', 'thread'][k]})` }, NW ? `P${k + 1}` : `${k + 1}: P${k + 1}`));  // the lane label in the process's color: "P1" on phones, "1: P1" (processor number and process) otherwise
              for (let j = 0; j < W; j++) {  // one cell per tick column
                const row = S.hist[j];  // row is the recorded state of every process at that tick, or missing if time has not reached it yet
                kids.push(row ? s('rect', { x: X0 + j * CW + 1, y: y + 4, width: CW - 2, height: LH - 9, rx: 3, class: LANE_CLS[row[k]], 'stroke-width': 1.5 })  // a recorded tick becomes a cell colored by this process's state then
                  : s('rect', { x: X0 + j * CW + 1, y: y + 4, width: CW - 2, height: LH - 9, rx: 3, class: 's-panel', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));  // a tick not reached yet is drawn as an empty dashed cell
              }  // ends the loop over tick columns
              const hot = p.st === 'spin' && p.wait >= 10;  // hot is true for a process that has been spinning for 10 ticks or more (starving)
              [p.entries, p.spun, p.maxWait].forEach((val, j) => kids.push(s('text', { x: SX[j], y: y + 24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: 's-monot', style: j === 2 && (hot || val >= 10) ? 'fill:var(--bad)' : j === 0 && val === 0 && S.t > 12 ? 'fill:var(--bad)' : '' }, String(val))));  // the three statistics as numbers; max wait turns red at 10+, and "got in" turns red if still 0 after tick 12
            });  // ends the loop over lanes
            const yA = Y0 + n * LH + 16;  // yA is the height of the time labels under the last lane
            for (let j = 0; j < W; j += 4) kids.push(s('text', { x: X0 + j * CW + CW / 2, y: yA, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(t0 + j)));  // tick numbers under every fourth column so students can tell how much time passed
            svg.setAttribute('viewBox', `0 0 ${VW} ${yA + 6}`);  // resizes the drawing's height to fit the current number of lanes
            svg.replaceChildren(...kids);  // replaces the whole drawing with the new pieces
            const tot = S.P.reduce((a, p) => a + p.spun, 0), all = n * S.t;  // tot is the total spins of all processes; all is every processor-tick so far (processes times ticks)
            meter.firstChild.style.width = (all ? (100 * tot) / all : 0) + '%';  // fills the meter to the share of processor time spent spinning
            pct.innerHTML = `Processor time burned spinning: <b>${all ? Math.round((100 * tot) / all) : 0}%</b> <span class="muted">(${tot} of ${all} processor-ticks)</span>`;  // shows that share as a percentage, plus the raw counts
          }  // ends draw()
          function run() { if (timer) return; timer = ctx.every(650, () => tick()); bRun.textContent = 'Pause'; }  // run(): starts ticking automatically every 650 ms and turns the button into Pause
          function stop() { if (timer) clearInterval(timer); timer = null; bRun.textContent = 'Run'; }  // stop(): stops automatic ticking and turns the button back into Run
          const seg = ctx.ui.seg([{ value: 'random', label: 'Random winner' }, { value: 'unlucky', label: 'Unlucky P1' }, { value: 'you', label: 'You pick the winner' }], 'random', (v) => { policy = v; reset(); });  // policy buttons: random winner, unlucky P1, or the student picks; changing it restarts the simulation
          const slL = ctx.ui.slider({ label: 'Critical section', min: 1, max: 6, value: L, format: (v) => v + (v === 1 ? ' tick' : ' ticks'), onInput: (v) => { L = v; reset(); } });  // slider for the critical section length, 1 to 6 ticks; moving it restarts the simulation
          const slN = ctx.ui.slider({ label: 'Processes', min: 2, max: 4, value: n, onInput: (v) => { n = v; reset(); } });  // slider for the number of processes, 2 to 4; moving it restarts the simulation
          reset();  // starts the simulation once when the page loads
          el.append(h('div', { class: 'split l fill' },  // page layout: a slimmer text column on the left and a wider simulator column on the right
            h('div', { class: 'stack' },  // the left column stacks the explanation
              h('p', { class: 'lead m0', html: 'The compare_and_swap lock is correct. It is not free, and it is not fair.' }),  // opening paragraph: the lock is correct, but it is neither free nor fair
              h('p', { class: 'm0 small', html: '<b>Busy waiting.</b> A process that finds <code>bolt = 1</code> does not step aside. It runs compare_and_swap again, and again, in a tight loop, using its processor the whole time and producing nothing. On one processor it is worse: the spinner uses up its turn while the holder, the only process that can free the lock, is not even running.' }),  // paragraph on busy waiting: the spinner burns its processor, and on one processor even blocks the holder from running
              h('p', { class: 'm0 small', html: '<b>Starvation.</b> When the lock comes free, every spinner’s next compare_and_swap races for it, and whichever reaches memory first wins. There is no queue and no memory of who waited longest, so the choice is arbitrary. One process can lose again and again, with no limit: <span class="t">starvation</span>.' }),  // paragraph on starvation: the race for a freed lock is arbitrary, so one process can lose without limit
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Starvation is not <span class="t">deadlock</span>. The system keeps working, since others get in all the time. Only the starved process is stuck.' }),  // common-mistake box: starvation is not deadlock, because others keep getting in
              h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'Stretch the critical section and watch the spinning share grow. Pick <b>Unlucky P1</b> and run. Then drop to 2 processes: fewer rivals means fewer races to lose.' })),  // try-this box: stretch the critical section, try unlucky P1, then drop to 2 processes
            h('div', { class: 'stack gap-s' },  // the right column holds the simulator
              h('div', { class: 'row' }, seg, h('span', { class: 'grow' }), h('button', { class: 'btn sm', type: 'button', onclick: () => { stop(); tick(); } }, 'Step'), bRun, h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset')),  // top row: policy buttons, a spacer, then Step (one tick), Run and Reset
              h('div', { class: 'grid-2', style: { gap: '18px' } }, slL, slN),  // the two sliders side by side
              h('div', { class: 'card white tight stack gap-s' },  // a white card holding the legend and the timeline
                h('div', { class: 'row small', style: { gap: '16px' } },  // the legend row
                  h('span', { html: '<i class="legend-sw" style="border-color:var(--proc);background:color-mix(in srgb, var(--proc) 22%, var(--panel))"></i>other useful work' }),  // legend: the processor-colored square means other useful work
                  h('span', { html: '<i class="legend-sw" style="border-color:var(--warn);background:color-mix(in srgb, var(--warn) 45%, var(--panel))"></i>spinning (wasted)' }),  // legend: the warning-colored square means spinning, which is wasted time
                  h('span', { html: '<i class="legend-sw" style="border-color:var(--ok);background:color-mix(in srgb, var(--ok) 45%, var(--panel))"></i>inside critical section' })),  // legend: the green square means inside the critical section
                svg),  // the timeline drawing, closing the card
              h('div', { class: 'row nw' }, pct, meter),  // a row with the percentage text and the meter bar
              say,  // the verdict box that explains each tick
              h('p', { class: 'xs muted m0', html: 'One tick = the time one compare_and_swap attempt takes. <b>got in</b> counts entries; <b>spun</b> counts failed attempts (wasted ticks); <b>max wait</b> is the longest unbroken run of them.' }))));  // small print: what a tick is and what the three statistics mean
        },  // ends render() for step 7
      },  // ends step 7

      /* ============ 8. Priority scheduling + spinning = deadlock (explore, player) ============ */
      {  // opens step 8
        title: 'Priorities plus spinning: a deadlock',  // step 8 title: priority scheduling plus spinning can cause a deadlock
        kind: 'explore',  // an explore page
        render(el, ctx) {  // render() for step 8: builds the priority deadlock animation when the page opens
          const { h, s } = ctx;  // h for HTML elements and s for SVG drawing elements
          const LO = '<b class="pc1">P<sub>low</sub></b>', HI = '<b class="pc2">P<sub>high</sub></b>';  // LO and HI are the colored names P-low and P-high (with subscripts) used in the messages
          const VAR = { L: 'proc', H: 'accent' };  // VAR maps each process to its theme color: low uses the processor color, high the accent color
          /* SVG text with subscripts: parts are strings, or [text] for a subscript */
          const rich = (props, parts) => { let down = false; return s('text', props, ...parts.map((p) => { const sub = Array.isArray(p); const dy = sub && !down ? 4 : !sub && down ? -4 : 0; down = sub; return s('tspan', Object.assign({ dy: dy || null }, sub ? { 'font-size': '0.75em' } : {}), sub ? p[0] : p); })); };  // rich(props, parts): builds SVG text where array parts become smaller subscripts; dy shifts the baseline down and back up
          const SLOT = {  // SLOT: what the processor does in each of the 7 timeline slots, as [who runs, short label], for each mode
            spin: [['L', 'other work'], ['L', 'CAS → 0'], ['H', 'resumes'], ['H', 'CAS → 1'], ['H', 'spins'], ['H', 'spins'], ['H', 'spins…']],  // spin mode: low works and locks, high resumes, fails and then spins forever
            block: [['L', 'other work'], ['L', 'CAS → 0'], ['H', 'resumes'], ['H', 'sleeps'], ['L', 'bolt = 0'], ['H', 'CAS → 0'], ['H', 'bolt = 0']],  // block mode: high sleeps instead, so low can unlock, and then high gets the lock
          };  // closes SLOT
          const MARK = { spin: { 2: 'disk', 4: 'timer', 5: 'timer', 6: 'timer' }, block: { 2: 'disk', 5: 'wake-up' } };  // MARK: which timeline slots begin with an interrupt or wake-up, and its label
          const run = 'Running', rdy = 'Ready', blk = 'Blocked';  // short names for the three process states used in the frames
          const F0 = [  // F0: the first three frames, shared by both modes
            { L: [run, 'other work'], H: [blk, 'waiting for a disk read'], bolt: 0, cap: `One processor with <span class="t">priority scheduling</span>. ${LO} is running. ${HI} is asleep until its disk read finishes. The lock is free.` },  // frame 1: one processor with priority scheduling; low runs, high sleeps on a disk read, the lock is free
            { L: [run, 'in its critical section'], H: [blk, 'waiting for a disk read'], bolt: 1, who: 'L', cap: `${LO} runs <code>compare_and_swap(&bolt, 0, 1)</code>, gets 0 back and enters its critical section. bolt = 1.` },  // frame 2: low takes the lock with compare_and_swap and enters its critical section
            { L: [rdy, 'in critical section, paused'], H: [run, 'other work'], bolt: 1, who: 'L', bot: 'warn', cap: `Disk interrupt: ${HI} is Ready and outranks ${LO}, so the dispatcher switches to it in the <b>middle</b> of ${LO}’s critical section. ${LO} still holds bolt.` },  // frame 3: the disk interrupt wakes high, which outranks low and takes the processor mid-critical-section
          ];  // closes F0
          const F = {  // F: the full frame list for each mode
            spin: F0.concat([  // spin mode: the shared frames plus four more
              { L: [rdy, 'in critical section, paused'], H: [run, 'spinning on bolt'], bolt: 1, who: 'L', top: 'warn', bot: 'warn', cap: `${HI} reaches its own critical section for the same resource. compare_and_swap returns 1: taken. ${HI} starts to spin.` },  // frame 4: high needs the same lock, gets 1 back and starts spinning
              { L: [rdy, 'in critical section, paused'], H: [run, 'spinning on bolt'], bolt: 1, who: 'L', top: 'warn', bot: 'warn', cap: `Timer interrupt. The dispatcher picks the highest-priority Ready process. Spinning is not sleeping: ${HI} is still Ready and still outranks ${LO}. So ${HI} runs again, and spins again.` },  // frame 5: a timer interrupt, but spinning keeps high Ready, so it runs and spins again
              { L: [rdy, 'in critical section, paused'], H: [run, 'spinning on bolt'], bolt: 1, who: 'L', top: 'warn', bot: 'warn', cap: `And again. Only ${LO} can set bolt back to 0, but ${LO} runs only when nothing more important is Ready, and ${HI} is <b>always</b> Ready.` },  // frame 6: only low can free the lock, yet low runs only when nothing more important is Ready
              { L: [rdy, 'in critical section, paused'], H: [run, 'spinning on bolt'], bolt: 1, who: 'L', top: 'bad', bot: 'bad', dead: true, cap: `<b>Deadlock.</b> ${HI} waits for ${LO} to release bolt. ${LO} waits for ${HI} to release the processor. Neither can ever happen, so both are stuck for good.` },  // frame 7: deadlock; each waits for what only the other can give (dead marks it for the red display)
            ]),  // ends the spin frames
            block: F0.concat([  // block mode: the shared frames plus four more
              { L: [rdy, 'in critical section, paused'], H: [blk, 'asleep until bolt is free'], bolt: 1, who: 'L', top: 'muted', cap: `${HI} finds the lock taken. This time it does not spin: the OS puts it to sleep until the lock is released. It is <b>Blocked</b>, not Ready.` },  // frame 4: high finds the lock taken and the OS puts it to sleep, so it is Blocked, not Ready
              { L: [run, 'left its critical section'], H: [rdy, 'woken: lock released'], bolt: 0, cap: `With ${HI} asleep, ${LO} is the only Ready process. It runs, finishes its critical section and sets bolt = 0. The OS wakes ${HI}.` },  // frame 5: low is the only Ready process, so it runs, unlocks, and the OS wakes high
              { L: [rdy, 'other work'], H: [run, 'in its critical section'], bolt: 1, who: 'H', cap: `${HI} outranks ${LO}, so it runs at once, gets 0 from compare_and_swap and enters. Priorities are respected and nobody is stuck.` },  // frame 6: high outranks low, runs at once and takes the lock
              { L: [rdy, 'other work'], H: [run, 'other work'], bolt: 0, ok: true, cap: `${HI} leaves and sets bolt = 0. Both got through. Letting a waiter sleep instead of spin is the idea behind semaphores (next section).` },  // frame 7: high unlocks and both got through; sleeping instead of spinning previews semaphores
            ]),  // ends the block frames
          };  // closes F
          let mode = 'spin', extra = 0, cur = 0;  // mode is spin or block; extra counts turns the student handed to P-high; cur is the frame on screen
          const svg = s('svg', { viewBox: '0 0 620 246', width: '100%', role: 'img', 'aria-label': 'Two processes, the lock, the dispatcher rule and a processor timeline' });  // the drawing: two process boxes, the wait-for arrows, the lock, the dispatcher rule and a processor timeline
          const BX = { L: 14, H: 336 }, BW = 270, BY = 38, BH = 70;  // positions and size of the two process boxes (low on the left, high on the right)
          const nm = (k) => ['P', [k === 'L' ? 'low' : 'high']];  // nm(k): the name "P" with a "low" or "high" subscript, in the parts format rich() expects
          function arc(which, cls) {  // arc(which, cls): draws a curved wait-for arrow above (top) or below (bot) the boxes, with a label
            const top = which === 'top';  // top is true for the arrow over the boxes
            const col = cls === 'muted' ? 'var(--muted)' : `var(--${cls})`;  // col is the arrow color from its class name
            const d = top ? `M 471 ${BY} Q 310 ${BY - 40} 149 ${BY}` : `M 149 ${BY + BH} Q 310 ${BY + BH + 40} 471 ${BY + BH}`;  // d is the curve's path: over the top from high to low, or under the bottom from low to high
            const ly = top ? 18 : BY + BH + 20;  // ly is the height of the arrow's label
            const parts = top ? (mode === 'block' ? [...nm('H'), ' sleeps until bolt is released'] : [...nm('H'), ' waits for bolt (held by ', ...nm('L'), ')'])  // top label: in block mode high sleeps until bolt is released; in spin mode high waits for bolt held by low
              : [...nm('L'), ' waits for the processor (held by ', ...nm('H'), ')'];  // bottom label: low waits for the processor, which high is holding
            return [s('path', { d, class: 's-line', 'stroke-width': 2.5, 'stroke-dasharray': cls === 'bad' ? null : '6 4', style: `stroke:${col}`, 'marker-end': `url(#arr-${cls === 'muted' ? 'muted' : cls})` }),  // the curved arrow itself; solid when it is part of a deadlock, dashed otherwise
              s('rect', { x: 150, y: ly - 11, width: 320, height: 21, rx: 7, style: `fill:var(--panel);stroke:${col}`, 'stroke-width': 1.5 }),  // a rounded box behind the label so it stays readable over the curve
              rich({ x: 310, y: ly + 4, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: `fill:${col}` }, parts)];  // the label text, with subscripts
          }  // ends arc()
          function draw(i) {  // draw(i): draws frame i of the deadlock animation in the wide (desktop) layout
            const f = F[mode][i], kids = [];  // f is the frame to draw; kids collects the SVG pieces
            if (f.top) kids.push(...arc('top', f.top));  // adds the wait-for arrow above the boxes if this frame has one (top holds its color)
            if (f.bot) kids.push(...arc('bot', f.bot));  // adds the wait-for arrow below the boxes if this frame has one
            ['L', 'H'].forEach((k) => {  // draws a box for each process, low first
              const [st, doing] = f[k], x = BX[k];  // st is the process's state (Running, Ready or Blocked), doing a short note, x the box position
              const stc = st === run ? 'ok' : st === rdy ? 'warn' : 'panel';  // stc picks the state pill color: green for Running, warning for Ready, gray for Blocked
              kids.push(s('rect', { x, y: BY, width: BW, height: BH, rx: 12, style: `fill:var(--panel-2);stroke:var(--${VAR[k]});opacity:${st === blk ? 0.75 : 1}`, 'stroke-width': st === run ? 3.5 : 2, 'stroke-dasharray': st === blk ? '7 5' : null }),  // the process box in its color; a Blocked process is faded and dashed, a Running one has a thick outline
                rich({ x: x + 12, y: BY + 22, 'font-size': 15, 'font-weight': 800, style: `fill:var(--${VAR[k]})` }, [...nm(k), k === 'L' ? '  ·  priority 1 (low)' : '  ·  priority 9 (high)']),  // the process name with its priority (1 for low, 9 for high)
                s('rect', { x: x + 12, y: BY + 32, width: 78, height: 22, rx: 11, class: 's-' + stc, 'stroke-width': 1.5 }),  // the rounded pill behind the state word
                s('text', { x: x + 51, y: BY + 47.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, st),  // the state word inside the pill
                s('text', { x: x + 98, y: BY + 48, 'font-size': 13.5 }, doing));  // what the process is doing, to the right of the pill
            });  // ends the loop over processes
            const RY = BY + BH + 38;  // RY is the height of the row holding the lock and the dispatcher rule
            kids.push(s('rect', { x: 14, y: RY, width: 204, height: 30, rx: 8, class: 's-mem', 'stroke-width': 2 }),  // the memory box for the lock
              f.who ? rich({ x: 116, y: RY + 20, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: 's-monot' }, ['bolt = 1, held by ', ...nm(f.who)])  // if someone holds the lock, the box says bolt = 1 and who holds it
                : s('text', { x: 116, y: RY + 20, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: 's-monot' }, 'bolt = 0, free'),  // otherwise it says bolt = 0, free
              s('rect', { x: 228, y: RY, width: 378, height: 30, rx: 8, class: f.dead ? 's-bad' : f.ok ? 's-ok' : 's-os', 'stroke-width': 2 }),  // the dispatcher box: red in the deadlock frame, green in the happy ending, OS-colored otherwise
              s('text', { x: 417, y: RY + 20, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, style: f.dead ? 'fill:var(--bad)' : '' }, f.dead ? 'DEADLOCK: each waits for the other, forever' : 'Dispatcher: run the highest-priority Ready process'));  // the dispatcher text: its rule, or the deadlock warning in the final spin frame
            const TY = RY + 54;  // TY is the height of the processor timeline
            kids.push(s('text', { x: 14, y: TY + 25, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 'CPU'));  // the "CPU" label at the left of the timeline
            SLOT[mode].forEach(([k, txt], j) => {  // one slot per timeline step, labeled with who ran and what it did
              const x = 56 + j * 79;  // x is the slot's left edge
              if (j <= i) {  // slots up to the current frame are filled in
                kids.push(s('rect', { x: x + 2, y: TY, width: 75, height: 40, rx: 7, style: `fill:color-mix(in srgb, var(--${VAR[k]}) 22%, var(--panel));stroke:var(--${VAR[k]})`, 'stroke-width': j === i ? 3 : 1.5 }),  // a filled slot tinted in the color of the process that ran, with a thicker outline for the current slot
                  s('text', { x: x + 39.5, y: TY + 16, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: `fill:var(--${VAR[k]})` }, k === 'L' ? 'low' : 'high'),  // the slot's first line: low or high
                  s('text', { x: x + 39.5, y: TY + 33, 'text-anchor': 'middle', 'font-size': 12.5 }, txt));  // the slot's second line: what happened, such as "CAS → 0" or "spins"
              } else kids.push(s('rect', { x: x + 2, y: TY, width: 75, height: 40, rx: 7, class: 's-panel', 'stroke-dasharray': '4 4', 'stroke-width': 1 }));  // future slots are drawn as empty dashed boxes
              const mk = MARK[mode][j];  // mk is the interrupt that starts this slot, if any
              if (mk && j <= i) kids.push(s('line', { x1: x, y1: TY - 4, x2: x, y2: TY + 44, style: 'stroke:var(--intr)', 'stroke-width': 2.5 }),  // a reached slot with an interrupt gets an interrupt-colored line at its left edge
                s('text', { x: x + 4, y: TY - 6, 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--intr)' }, '↓ ' + mk));  // and a small label above it naming the event (disk, timer or wake-up)
            });  // ends the loop over slots
            svg.replaceChildren(...kids);  // replaces the whole drawing with the new pieces
          }  // ends draw()
          /* Phone layout (viewBox 360 wide, rendered near 1:1): the two process boxes stack, the wait-for
             relations become labelled pills instead of arcs, and the timeline uses short slot labels. */
          const SHORT = { spin: ['work', 'CAS→0', 'wakes', 'CAS→1', 'spin', 'spin', 'spin…'], block: ['work', 'CAS→0', 'wakes', 'sleep', 'bolt=0', 'CAS→0', 'bolt=0'] };  // SHORT: shorter slot labels for the phone layout, where each slot is much slimmer
          function drawNarrow(i) {  // the phone-layout version of draw(): same frame, stacked for a small screen
            const f = F[mode][i], kids = [];  // f is the frame to draw; kids collects the pieces
            ['L', 'H'].forEach((k, r) => {  // draws the two process boxes one above the other (r is the row)
              const [st, doing] = f[k], x = 6, y = 6 + r * 70;  // st and doing as before; each box sits 70 units below the previous one
              const stc = st === run ? 'ok' : st === rdy ? 'warn' : 'panel';  // the same state pill colors as the wide layout
              kids.push(s('rect', { x, y, width: 348, height: 62, rx: 12, style: `fill:var(--panel-2);stroke:var(--${VAR[k]});opacity:${st === blk ? 0.75 : 1}`, 'stroke-width': st === run ? 3.5 : 2, 'stroke-dasharray': st === blk ? '7 5' : null }),  // the process box, full width, faded and dashed when Blocked
                rich({ x: x + 12, y: y + 22, 'font-size': 15, 'font-weight': 800, style: `fill:var(--${VAR[k]})` }, [...nm(k), k === 'L' ? '  ·  priority 1 (low)' : '  ·  priority 9 (high)']),  // the process name with its priority
                s('rect', { x: x + 12, y: y + 31, width: 78, height: 22, rx: 11, class: 's-' + stc, 'stroke-width': 1.5 }),  // the state pill
                s('text', { x: x + 51, y: y + 46.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, st),  // the state word
                s('text', { x: x + 98, y: y + 47, 'font-size': 13.5 }, doing));  // what the process is doing
            });  // ends the loop over processes
            [['top', f.top], ['bot', f.bot]].forEach(([which, cls], r) => {  // the wait-for relations, drawn as labeled pills instead of curved arrows
              if (!cls) return;  // skips a relation this frame does not have
              const col = cls === 'muted' ? 'var(--muted)' : `var(--${cls})`, y = 146 + r * 26;  // col is the pill color and y its row
              const parts = which === 'top' ? (mode === 'block' ? [...nm('H'), ' sleeps until bolt is released'] : [...nm('H'), ' waits for bolt (held by ', ...nm('L'), ')'])  // the top relation's text: high sleeps until bolt is free, or high waits for bolt held by low
                : [...nm('L'), ' waits for the processor (held by ', ...nm('H'), ')'];  // the bottom relation's text: low waits for the processor held by high
              kids.push(s('rect', { x: 6, y, width: 348, height: 22, rx: 7, style: `fill:var(--panel);stroke:${col}`, 'stroke-width': 1.5, 'stroke-dasharray': cls === 'bad' ? null : '5 3' }),  // the pill outline, solid for a deadlock relation and dashed otherwise
                rich({ x: 180, y: y + 15.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, style: `fill:${col}` }, parts));  // the relation text, with subscripts
            });  // ends the loop over relations
            const RY = 202;  // RY is the height of the lock row
            kids.push(s('rect', { x: 6, y: RY, width: 348, height: 28, rx: 8, class: 's-mem', 'stroke-width': 2 }),  // the memory box for the lock
              f.who ? rich({ x: 180, y: RY + 19, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: 's-monot' }, ['bolt = 1, held by ', ...nm(f.who)])  // if held: bolt = 1 and who holds it
                : s('text', { x: 180, y: RY + 19, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: 's-monot' }, 'bolt = 0, free'),  // otherwise: bolt = 0, free
              s('rect', { x: 6, y: RY + 34, width: 348, height: 28, rx: 8, class: f.dead ? 's-bad' : f.ok ? 's-ok' : 's-os', 'stroke-width': 2 }),  // the dispatcher box below it, colored the same way as in the wide layout
              s('text', { x: 180, y: RY + 53, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: f.dead ? 'fill:var(--bad)' : '' }, f.dead ? 'DEADLOCK: each waits for the other, forever' : 'Dispatcher: highest-priority Ready runs'));  // the dispatcher text, slightly shortened to fit
            const TY = RY + 108, SW = 348 / 7;  // TY is the height of the timeline; SW is the width of one of the 7 slots
            kids.push(s('text', { x: 6, y: TY - 28, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.05em' }, 'PROCESSOR TIMELINE →'));  // a heading over the timeline
            SLOT[mode].forEach(([k], j) => {  // one slot per timeline step
              const x = 6 + j * SW;  // x is the slot's left edge
              if (j <= i) {  // slots up to the current frame are filled in
                kids.push(s('rect', { x: x + 1.5, y: TY, width: SW - 3, height: 40, rx: 6, style: `fill:color-mix(in srgb, var(--${VAR[k]}) 22%, var(--panel));stroke:var(--${VAR[k]})`, 'stroke-width': j === i ? 3 : 1.5 }),  // a filled slot tinted in the color of the process that ran
                  s('text', { x: x + SW / 2, y: TY + 16, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: `fill:var(--${VAR[k]})` }, k === 'L' ? 'low' : 'high'),  // first line: low or high
                  s('text', { x: x + SW / 2, y: TY + 33, 'text-anchor': 'middle', 'font-size': 12.5 }, SHORT[mode][j]));  // second line: the short label from SHORT
              } else kids.push(s('rect', { x: x + 1.5, y: TY, width: SW - 3, height: 40, rx: 6, class: 's-panel', 'stroke-dasharray': '4 4', 'stroke-width': 1 }));  // future slots are empty dashed boxes
              const mk = MARK[mode][j];  // mk is the interrupt that starts this slot, if any
              if (mk && j <= i) kids.push(s('line', { x1: x, y1: TY - 4, x2: x, y2: TY + 44, style: 'stroke:var(--intr)', 'stroke-width': 2.5 }),  // an interrupt-colored line at the slot's left edge
                s('text', { x: x + 3, y: TY - 7, 'font-size': 12, 'font-weight': 800, style: 'fill:var(--intr)' }, '↓ ' + mk));  // and a small label naming the event
            });  // ends the loop over slots
            svg.replaceChildren(...kids);  // replaces the whole drawing
          }  // ends the phone-layout drawing function
          if (ctx.narrow) svg.setAttribute('viewBox', '0 0 360 356');  // on a phone-width screen, gives the drawing a taller, slimmer shape (360 wide) to match that layout
          /* "you are the dispatcher" panel: live only on the last spin frames. One box holds the prompt, then the result. */
          const dMsg = h('div', { class: 'grow', style: { minWidth: 0 } });  // dMsg holds the dispatcher panel's message; it takes the spare width
          const bH = h('button', { class: 'btn sm', type: 'button', style: { borderColor: 'var(--accent)', color: 'var(--accent)' }, html: '<span>Run P<sub>high</sub></span>', onclick: () => pick('H') });  // button: hand the processor to P-high
          const bL = h('button', { class: 'btn sm', type: 'button', style: { borderColor: 'var(--proc)', color: 'var(--proc)' }, html: '<span>Run P<sub>low</sub></span>', onclick: () => pick('L') });  // button: hand the processor to P-low
          const dBox = h('div', { class: 'vbox row nw', style: { gap: '10px', minHeight: '64px' } }, dMsg, h('div', { class: 'stack gap-s' }, bH, bL));  // dBox is the "you are the dispatcher" panel: the message beside the two buttons
          const dSay = (cls, html) => { dBox.className = 'vbox row nw ' + cls; dMsg.innerHTML = html; };  // dSay(cls, html): recolors the panel and changes its message
          function pick(k) {  // pick(k): the student chooses who runs at a timer interrupt
            if (!(mode === 'spin' && cur >= 4)) return;  // only allowed in spin mode from frame 5 on (index 4), when the timer keeps firing
            if (k === 'H') { extra++; dSay('warn', `By the rule, ${HI} runs and spends its whole turn spinning; compare_and_swap keeps returning 1. Turns you have handed it: <b>${extra}</b>. bolt is still 1.`); }  // choosing high follows the rule: it spins through its turn again, and the count of wasted turns goes up
            else dSay('bad', `<b>Not allowed.</b> ${HI} is Ready and outranks ${LO}. Priority scheduling always runs the highest-priority Ready process, and spinning keeps ${HI} Ready, so ${LO} never gets a turn.`);  // choosing low breaks the rule: high is Ready and outranks low, so low never gets a turn
          }  // ends pick()
          function paintDisp(i) {  // paintDisp(i): updates the dispatcher panel for frame i; runs on every player step
            const live = mode === 'spin' && i >= 4;  // live is true when the choice is open (spin mode, frame 5 or later)
            bH.disabled = bL.disabled = !live;  // the buttons work only while the choice is open
            if (live && extra) return;  // keeps the student's last result on screen while they are still choosing
            if (!live) extra = 0;  // leaving the live frames resets the count of handed turns
            dSay(live ? 'info' : '', live ? '<b>You are the dispatcher.</b> Another timer interrupt! Who runs next? Try both.'  // the prompt: an invitation to choose when live
              : mode === 'spin' ? '<b>You are the dispatcher</b> at each timer interrupt, from player step 5 on: you choose who runs next.' : 'Here the waiter sleeps, so the dispatcher never faces an impossible choice.');  // otherwise a note on when the choice opens, or in sleep mode why there is no impossible choice
          }  // ends paintDisp()
          const player = ctx.ui.player({ count: 7, interval: 2800, render: (i) => { cur = i; (ctx.narrow ? drawNarrow : draw)(i); paintDisp(i); return F[mode][i].cap; } });  // the player: 7 frames, 2.8 s apart; each step records the frame, draws the right layout, updates the panel and returns the caption
          const seg = ctx.ui.seg([{ value: 'spin', label: 'Waiter spins (hardware lock)' }, { value: 'block', label: 'Waiter sleeps (preview)' }], 'spin', (v) => { mode = v; player.reset(); });  // mode buttons: the waiter spins (hardware lock) or sleeps (a preview of the next section); switching restarts the player
          el.append(h('div', { class: 'split l fill' },  // page layout: a slimmer text column on the left and the animation on the right
            h('div', { class: 'stack' },  // the left column stacks the explanation
              h('p', { class: 'lead m0', html: 'On one processor, busy waiting plus priorities can freeze two processes for good.' }),  // opening paragraph: on one processor, busy waiting plus priorities can freeze two processes for good
              h('p', { class: 'm0 small', html: '<b>Priority scheduling</b> means the dispatcher always runs the highest-priority process that is Ready. A spinning process counts as Ready: it is busy running a loop, not asleep.' }),  // paragraph: priority scheduling runs the highest-priority Ready process, and a spinner counts as Ready
              h('p', { class: 'm0 small', html: `The recipe: ${LO} takes the lock. ${HI} wakes up (say, its disk read finishes), takes the processor away from ${LO}, then needs the same lock.` }),  // paragraph: the recipe, low takes the lock, high wakes, takes the processor and then needs the same lock
              h('div', { class: 'callout bad m0 small', 'data-label': 'The trap', html: `${HI} cannot continue until ${LO} runs <code>bolt = 0</code>. ${LO} cannot run while ${HI} is Ready. Each waits for the other: a <span class="t">deadlock</span>.` }),  // trap box: each waits for the other, which is a deadlock
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'The machine-instruction lock does not know about priorities or sleeping. Keep spinlocks for very short waits, and let longer waits sleep instead (flip the switch ' + (ctx.narrow ? 'below' : 'on the right') + ').' }),  // why box: keep spinlocks for short waits; the hint points to the mode switch below on phones, on the right otherwise
              h('p', { class: 'm0 small muted', html: 'Notice that nothing here is buggy: the lock and the scheduler each follow their own rules exactly. Only the combination is fatal.' })),  // closing note: neither the lock nor the scheduler is buggy; only the combination is fatal
            h('div', { class: 'stack gap-s' },  // the right column holds the animation
              seg,  // the mode buttons
              h('div', { class: 'card white tight' }, svg),  // the drawing on a white card
              player.el,  // the player controls and caption
              dBox)));  // the dispatcher panel closes the column
        },  // ends render() for step 8
      },  // ends step 8

      /* ============ 9. Recap: sort the scorecard + key facts (recap) ============ */
      {  // opens step 9
        title: 'Recap: the scorecard for hardware locks',  // step 9 title: the recap scorecard for hardware locks
        kind: 'recap',  // kind 'recap': a review page, always on the core path
        render(el, ctx) {  // render() for step 9: builds the scorecard and flip cards
          const { h } = ctx;  // only HTML elements are needed
          /* [statement, 0 = advantage | 1 = disadvantage, why] in a deliberately mixed order */
          const ITEMS = [  // ITEMS: the scorecard statements, each with its correct answer and the reason shown after sorting
            ['Works for any number of processes', 0, 'Every process runs the same short loop on the same lock word. A tenth process needs no new code.'],  // statement: works for any number of processes (an advantage)
            ['Waiting processes keep using processor time', 1, '<b>Busy waiting.</b> A spinner runs compare_and_swap over and over, burning its processor while producing nothing.'],  // statement: waiting processes keep using processor time (a disadvantage: busy waiting)
            ['Simple, so it is easy to check that it is correct', 0, 'One loop around one atomic instruction. Compare that with the careful flag juggling of the software approaches in 5.1.'],  // statement: simple, so easy to check (an advantage)
            ['A waiting process can be passed over again and again', 1, '<b>Starvation is possible.</b> When the lock comes free, the winner is whoever’s instruction reaches memory first. No queue, no fairness.'],  // statement: a waiter can be passed over again and again (a disadvantage: starvation)
            ['Works on one processor, or on several that share main memory', 0, 'The atomic instruction works on the shared memory word itself, so it does not matter whether rivals interleave or truly overlap.'],  // statement: works on one processor or several sharing memory (an advantage)
            ['Can protect many critical sections, each with its own lock word', 0, 'Give each resource its own variable (<code>bolt_printer</code>, <code>bolt_queue</code>). Users of different resources never block each other.'],  // statement: many critical sections, each with its own lock word (an advantage)
            ['A high-priority spinner can shut out the low-priority lock holder', 1, '<b>Deadlock is possible.</b> On one processor with priority scheduling, the spinner stays Ready forever, so the holder never runs to release the lock.'],  // statement: a high-priority spinner can shut out the low-priority holder (a disadvantage: deadlock)
          ];  // closes ITEMS
          const got = ITEMS.map(() => null);  // got records each row's result: null until answered, then true or false
          const score = h('span', { class: 'chip' });  // score is the chip showing how many rows are sorted correctly
          const say = verdict(ctx);  // say is the verdict box that shows the reason after each choice
          const rows = ITEMS.map(([txt, ans, why], k) => {  // rows: builds one scorecard row per statement
            const mk = (lab, v, col) => h('button', { class: 'btn sm', type: 'button', style: { borderColor: `var(--${col})`, color: `var(--${col})` }, onclick: () => choose(k, v) }, lab);  // mk(lab, v, col): builds an answer button in a given color that records choice v for this row
            const row = h('div', { class: 'sb-row', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' } : null }, h('span', { html: txt, style: ctx.narrow ? { gridColumn: '1 / -1' } : null }), mk('Advantage', 0, 'ok'), mk('Disadvantage', 1, 'bad'));  // the row: statement plus Advantage and Disadvantage buttons; on a phone-width screen the statement spans the full width above them
            return row;  // returns the finished row
          });  // ends the row builder
          function choose(k, v) {  // choose(k, v): runs when the student sorts row k as advantage (0) or disadvantage (1)
            const [txt, ans, why] = ITEMS[k];  // looks up the row's statement, correct answer and reason
            got[k] = v === ans;  // records whether the choice was right
            rows[k].className = 'sb-row ' + (got[k] ? 'good' : 'oops');  // colors the row green or red
            const right = got.filter((g) => g === true).length;  // right counts the rows sorted correctly so far
            score.className = 'chip ' + (right === ITEMS.length ? 'ok' : 'accent');  // the score chip turns green once every row is right
            score.textContent = `${right} / ${ITEMS.length} sorted correctly`;  // updates the score text
            if (right === ITEMS.length) say.say('ok', '<b>Scorecard complete.</b> Four advantages (any number of processes, one or many processors, simple, many critical sections) and three disadvantages (busy waiting, starvation, deadlock).');  // when all rows are right: a summary of the four advantages and three disadvantages
            else say.say(got[k] ? 'ok' : 'bad', `<b>${got[k] ? 'Right' : 'Not quite'}: it is ${ans ? 'a disadvantage' : 'an advantage'}.</b> ${why}`);  // otherwise: says right or not quite, names the correct answer and shows the reason
          }  // ends choose()
          score.textContent = `0 / ${ITEMS.length} sorted correctly`;  // starting score text before any row is answered
          say.say('info', 'Sort each statement about the machine-instruction approach (compare_and_swap or exchange). The reason appears here.');  // starting instruction in the verdict box
          el.append(h('div', { class: 'split r fill' },  // page layout: a split with the wider column on the left for the scorecard
            h('div', { class: 'card stack gap-s' },  // left card: the scorecard
              h('div', { class: 'row' }, h('h3', { class: 'm0' }, 'Sort the scorecard'), h('span', { class: 'grow' }), score),  // heading row: the title, a spacer and the score chip
              ...rows, say),  // all the statement rows, then the verdict box
            h('div', { class: 'stack gap-s' },  // right column: facts to remember
              h('h3', { class: 'm0' }, 'Six facts to keep'),  // heading for the flip cards
              h('p', { class: 'small muted m0' }, 'Say the answer out loud, then click the card to check.'),  // instruction: answer out loud first, then click to check
              ctx.ui.flipcards([  // flip cards: a question on the front, the answer on the back
                ['When does switching off interrupts work?', 'Only on a single processor, and only for kernel code. Other processors carry on regardless.'],  // flip card: when switching interrupts off works
                ['What makes an instruction atomic?', 'Its read and write of one memory word happen as one step. Nothing can get in between.'],  // flip card: what makes an instruction atomic
                ['What does compare_and_swap return?', 'Always the OLD value. It stores newval only if that old value equals testval.'],  // flip card: what compare_and_swap returns
                ['The exchange invariant', 'bolt + key<sub>1</sub> + … + key<sub>n</sub> = n. There is only one 0, so at most one process is inside.'],  // flip card: the exchange invariant
                ['What is busy waiting?', 'Testing the lock again and again in a loop, using processor time and doing no useful work.'],  // flip card: what busy waiting is
                ['Why can priorities cause deadlock?', 'The high-priority spinner is always Ready, so the low-priority holder never runs to unlock.'],  // flip card: why priorities can cause deadlock
              ], { cols: 2, height: 108 }),  // laid out in two columns, each card 108px tall
              h('div', { class: 'callout tip m0 small', 'data-label': 'Next up', html: 'Semaphores (5.4) let a waiting process sleep instead of spin, so it stops burning processor time and cannot shut out the lock holder the way a spinner can.' }))));  // next-up box: semaphores let a waiter sleep instead of spin
        },  // ends render() for step 9
      },  // ends step 9

      /* ============ 10. Check yourself (quiz) ============ */
      {  // opens step 10, the section quiz
        title: 'Check yourself',  // step 10 title
        kind: 'check',  // kind 'check': the quiz page whose first-try score counts toward mastery
        quiz: [  // quiz: the questions; the shell's quiz engine draws them, checks answers and shows feedback
          { q: 'On a computer with a single processor, why does switching interrupts off before a critical section give mutual exclusion?',  // question 1 (multiple choice): why switching interrupts off gives mutual exclusion on one processor
            choices: ['Without interrupts the running process cannot be switched out, so no other process runs until it switches them back on', 'It locks the shared variables in memory so that other processes cannot read them', 'The hardware throws away every interrupt that arrives, so the operating system never runs', 'It tells every other processor to pause until interrupts are switched back on'],  // the four choices; the first is correct
            answer: 0,  // the index of the correct choice
            feedback: [null, 'Memory is not locked at all. The method works only because no other process gets the processor.', 'Interrupts are not thrown away. They are held as pending and delivered once interrupts are back on.', 'Switching interrupts off affects only the processor that does it. That is exactly why the method fails on a multiprocessor.'],  // feedback for each wrong choice (null for the right one): memory is not locked, interrupts are not lost, other processors are unaffected
            why: 'On one processor, a process loses the processor only through an OS call or an interrupt. With interrupts off (and no OS calls inside), nothing can switch it out, so nothing else can run and get into the critical section.' },  // explanation shown after answering: only an OS call or an interrupt can take the processor away
          { type: 'multi', q: 'Which statements about using interrupt disabling for mutual exclusion are true? Select all that apply.',  // question 2 (select all): which statements about interrupt disabling are true
            choices: ['While interrupts are off, the processor cannot interleave other processes, so efficiency can suffer', 'It does not work on a multiprocessor', 'Device interrupts that arrive while interrupts are off are lost for good', 'Switching interrupts off is a privileged instruction, available only to the kernel', 'It forces processes on other processors to wait'],  // the five statements to choose from
            answer: [0, 1, 3],  // the correct set: lost efficiency, fails on a multiprocessor, and privileged
            why: 'The two costs are lost efficiency (no interleaving, devices wait) and failure on multiprocessors, since the other processors are not affected. Arriving interrupts are held as pending, not lost, and ordinary programs are not allowed to switch interrupts off.' },  // explanation: the two costs; interrupts are held, not lost; ordinary programs cannot switch them off
          { type: 'tf', q: 'The line <code>if (bolt == 0) bolt = 1;</code> is a safe lock, because it is only one line of code.',  // question 3 (true or false): one line of source code makes a safe lock
            answer: false,  // the statement is false
            why: 'One line of source code can be several machine actions: here a read of bolt and then a separate write. Another process can run between them, see bolt = 0 too, and both get in. Only an atomic instruction closes that gap.' },  // explanation: one source line can be a separate read and write, so another process can get between them
          { q: 'The shared word holds 5. A process executes <code>old = compare_and_swap(&word, 5, 9);</code>. What happens?',  // question 4 (multiple choice): the result of compare_and_swap when the word matches testval
            choices: ['old is 5, and word now holds 9', 'old is 9, and word now holds 9', 'old is 5, and word still holds 5', 'old is 1 (meaning success), and word now holds 9'],  // the four choices; the first is correct
            answer: 0,  // the index of the correct choice
            feedback: [null, 'compare_and_swap returns the value it found (the old value), not the new one.', 'The word matched testval (5 = 5), so the new value 9 is written.', 'This version returns the old value, not a success flag. A caller learns about success by comparing the returned value with testval.'],  // feedback for each wrong choice: it returns the old value; the match means the write happens; there is no success flag
            why: 'compare_and_swap reads the word (5), compares it with testval (5), and because they match, writes newval (9). It always returns the old value, so old = 5.' },  // explanation: read 5, compare with 5, match, write 9, return the old value 5
          { type: 'num', q: 'The shared word holds 3. A process executes <code>compare_and_swap(&word, 0, 1)</code>. What value does the instruction return?',  // question 5 (calculate): the return value of compare_and_swap when the word does not match testval
            answer: 3, tol: 0,  // the answer is 3, with no tolerance for other values
            hint: 'Does 3 match testval? Either way, what does compare_and_swap always return?',  // hint shown on request: whatever happens, what does the instruction always return?
            why: 'The old value 3 does not equal testval 0, so nothing is written and the word stays 3. The instruction still returns the old value: 3.' },  // explanation: no match, nothing written, and the old value 3 is still returned
          { type: 'tf', q: 'In the compare_and_swap spinlock, a process that gets 1 back from compare_and_swap has just entered its critical section.',  // question 6 (true or false): getting 1 back means the process just entered
            answer: false,  // the statement is false
            why: 'Getting 1 back means the word already held 1: someone else holds the lock, and nothing was written. The process loops and tests again. It enters only when it gets 0 back, which means it just changed bolt from 0 to 1 itself.' },  // explanation: 1 means someone else holds the lock; entry happens only on getting 0 back
          { type: 'order', q: 'Put the actions of a single compare_and_swap(word, testval, newval) instruction in order.',  // question 7 (put in order): the micro-steps of one compare_and_swap instruction
            items: ['Read the memory word into oldval', 'Compare oldval with testval', 'If they are equal, write newval into the word', 'Return oldval to the caller'],  // the four micro-steps, which the quiz shuffles for the student to reorder
            why: 'Read, compare, conditionally write, return the old value. All four happen inside one atomic instruction, so no other access to the word can come between them.' },  // explanation: read, compare, conditionally write, return, all inside one atomic instruction
          { type: 'num', q: 'Six processes share a lock built with the exchange instruction (bolt starts at 0, and each process starts every attempt with its private key set to 1). Right now one process is inside its critical section and the other five are waiting in their exchange loops. What is key<sub>1</sub> + key<sub>2</sub> + … + key<sub>6</sub>?',  // question 8 (calculate): the sum of six keys in the exchange lock while one process is inside
            answer: 5, tol: 0,  // the answer is 5, exactly
            hint: 'Use the invariant bolt + Σ key<sub>i</sub> = n. What is bolt while someone is inside?',  // hint: use the invariant and ask what bolt is while someone is inside
            why: 'The invariant says bolt + Σ key<sub>i</sub> = n = 6. With a process inside, bolt = 1, so the keys add to 5: the holder’s key is 0, and each waiter keeps swapping its 1 for bolt’s 1, so the other five keys are 1.' },  // explanation: bolt is 1, so the keys add to 5; the holder's key is 0 and each waiter's is 1
          { type: 'match', q: 'Match each idea with its description.',  // question 9 (match the pairs): each idea with its description
            pairs: [['Interrupt disabling', 'Prevents switches on one processor'], ['compare_and_swap', 'Conditional write; returns old value'], ['exchange', 'Swaps a register with a memory word'], ['Busy waiting', 'Looping on a test, wasting CPU time'], ['Starvation', 'A waiter passed over indefinitely']],  // the five pairs: interrupt disabling, compare_and_swap, exchange, busy waiting, starvation
            why: 'Interrupt disabling blocks switches on one processor. compare_and_swap and exchange are the two atomic instructions. Busy waiting and starvation are two of the costs of spinlocks built from them.' },  // explanation: one prevention method, two atomic instructions, and two costs of spinlocks
          { type: 'num', q: 'Four processes each run on their own processor of a shared-memory multiprocessor. P1 holds a spinlock for 40 µs, and during that entire time the other three processes spin on it. How much processor time is spent spinning, in microseconds?',  // question 10 (calculate): processor time wasted by three processors spinning for 40 microseconds
            answer: 120, tol: 0, unit: 'µs',  // the answer is 120, exactly, shown with the unit µs
            why: 'Three processors each spin for the full 40 µs: 3 × 40 = 120 µs of processor time that does no useful work. That waste is the cost of busy waiting.' },  // explanation: 3 times 40 is 120 microseconds of processor time doing no useful work
          { q: 'One processor, priority scheduling. Low-priority P1 holds a compare_and_swap lock and is preempted inside its critical section by high-priority P2, which then spins on the same lock. What happens?',  // question 11 (multiple choice): what happens when a high-priority spinner preempts the low-priority lock holder
            choices: ['P2 spins forever and P1 never runs again: a deadlock', 'A timer interrupt soon gives P1 a turn, so P2 only waits a little longer', 'compare_and_swap notices that the holder is paused and hands the lock to P2', 'Both get into their critical sections, so mutual exclusion is broken'],  // the four choices; the first (deadlock) is correct
            answer: 0,  // the index of the correct choice
            feedback: [null, 'At each timer interrupt the dispatcher again picks the highest-priority Ready process. A spinning P2 is still Ready, so P1 is never chosen.', 'The instruction knows nothing about processes or who holds the lock. It only compares and writes one word.', 'The lock still keeps P2 out: it keeps getting 1 back. The failure here is that nobody makes progress, not that both get in.'],  // feedback for each wrong choice: the timer does not help, the instruction knows nothing of holders, and both are not inside
            why: 'P2 needs P1 to release bolt, and P1 needs P2 to give up the processor. Spinning keeps P2 Ready, so under priority scheduling P1 never runs. Each waits for the other forever. P2 keeps running, yet this is deadlock, not livelock (5.1): no change in timing can end it.' },  // explanation: each waits for the other forever, and no change in timing can end it, so it is deadlock rather than livelock
          { type: 'bucket', q: 'Machine-instruction locks: advantage or disadvantage?',  // question 12 (sort into groups): advantage or disadvantage of machine-instruction locks
            buckets: ['Advantage', 'Disadvantage'],  // the two groups
            items: [['Works for any number of processes', 0], ['Busy waiting uses processor time', 1], ['Works on a multiprocessor with shared memory', 0], ['Starvation is possible', 1], ['Simple, so easy to verify', 0], ['Supports many critical sections, one variable each', 0], ['Deadlock is possible under priority scheduling', 1]],  // the seven items, each tagged with its correct group (0 advantage, 1 disadvantage)
            why: 'Advantages: any number of processes, one or many processors sharing memory, simple to verify, many critical sections. Disadvantages: busy waiting, possible starvation (the next winner is arbitrary), possible deadlock (the priority scenario).' },  // explanation: the four advantages and three disadvantages
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the steps list
    notes: `${/* notes: the printable summary of this section, written as HTML; it appears in the notes drawer and the print view */''}
      <h3>5.3 Mutual Exclusion: Hardware Support</h3>${/* notes heading with the section number and title */''}
      <p>Every lock comes down to two moves on a shared <b>lock variable</b> (here <code>bolt</code>: 0 = free, 1 = taken): <b>look</b> (is it 0?) and <b>lock</b> (set it to 1). If another process reaches bolt in the gap between them, it also sees 0 and both enter their critical sections. The software approaches of 5.1 cope using ordinary reads and writes, but the code is subtle. Hardware helps in two ways: (1) switch off interrupts so nothing else can run (one processor only), or (2) special machine instructions that look and lock in one indivisible step, so there is no gap.</p>${/* notes paragraph: every lock is a look and a lock on bolt, and hardware can close the gap in two ways */''}

      <h4>Route 1: interrupt disabling (uniprocessor)</h4>${/* notes heading for route 1, interrupt disabling */''}
      <p>On a <b>uniprocessor</b>, processes never truly overlap; they only <b>interleave</b>. A running process keeps the processor until it either calls an OS service or an <b>interrupt</b> arrives and the OS decides to switch. So a process that switches interrupts off before its critical section, and makes no OS calls inside it, cannot be switched out. No other process can run, so none can enter, and no lock variable is needed.</p>${/* notes paragraph: on one processor, a process with interrupts off and no OS calls cannot be switched out */''}
      <pre>while (true) {${/* shown code, line 1 of the interrupt-disabling outline: the endless loop */''}
    disable interrupts;  /* no switch can happen from here on */${/* shown code, line 2: switch interrupts off */''}
    /* critical section */  /* use the shared data */${/* shown code, line 3: the critical section */''}
    enable interrupts;  /* switching allowed again */${/* shown code, line 4: switch interrupts back on */''}
    /* remainder */  /* other work */${/* shown code, line 5: the remainder */''}
}</pre>${/* shown code, line 6: closes the loop and the code block */''}
      <p>Interrupts that arrive while they are off are not lost: the hardware keeps them <b>pending</b> and delivers them as soon as interrupts are switched back on.</p>${/* notes paragraph: interrupts that arrive while off are held pending, not lost */''}
      <p><b>Two costs.</b></p>${/* notes lead-in for the two costs */''}
      <ul>${/* starts the list of the two costs */''}
        <li><b>Efficiency.</b> While interrupts are off, the processor cannot interleave other processes or serve devices; a finished disk read must wait. Worked example: interrupts go off at t = 10 µs for a 20 µs critical section (until 30 µs); a device interrupt arriving at 18 µs waits 30 − 18 = 12 µs. Longer critical sections delay more events, for longer.</li>${/* cost 1, efficiency, with a worked example of one device interrupt's waiting time */''}
        <li><b>It fails on a multiprocessor.</b> Switching interrupts off affects only the processor that does it. Processes on other processors are already running and can reach the shared data at the same instant, so mutual exclusion is not guaranteed.</li>${/* cost 2: it fails on a multiprocessor because the other processors keep running */''}
      </ul>${/* ends the list of costs */''}
      <p>Switching interrupts off is a <b>privileged instruction</b> (kernel only), and even the kernel keeps such stretches very short.</p>${/* notes paragraph: switching interrupts off is privileged and kept short */''}

      <h4>Route 2: special machine instructions</h4>${/* notes heading for route 2, special machine instructions */''}
      <p>The hardware fact underneath: memory serves one access to a given location at a time; other accesses to the same location wait. Processor designers built instructions that perform <b>two actions on one word</b> (such as a read and a write, or a read and a test) within a single instruction cycle. Because they cannot be interrupted part-way and no other access to that word can come between the two actions, they are <b>atomic</b>.</p>${/* notes paragraph: memory serves one access per word at a time, so two-action instructions can be atomic */''}
      <p>Common mistake: <code>if (bolt == 0) bolt = 1;</code> (or <code>while (bolt == 1) ; bolt = 1;</code>) looks like one action but is two separate memory accesses, a read and then a write. If P1 reads 0, then P2 reads 0, then both write 1, both are inside. An atomic instruction closes exactly this gap.</p>${/* notes paragraph: the common mistake of thinking a one-line test and set is a single action */''}

      <h4>compare_and_swap (compare and exchange)</h4>${/* notes heading for compare_and_swap */''}
      <pre>int compare_and_swap(int *word, int testval, int newval) {${/* shown code, line 1 of compare_and_swap: its header with the word, testval and newval */''}
    int oldval;${/* shown code, line 2: room for the old value */''}
    oldval = *word;  /* 1. read the word */${/* shown code, line 3: read the word */''}
    if (oldval == testval)  /* 2. compare with the expected value */${/* shown code, line 4: compare it with testval */''}
        *word = newval;  /* 3. equal? write the new value */${/* shown code, line 5: write newval if they matched */''}
    return oldval;  /* 4. always return the OLD value */${/* shown code, line 6: always return the old value */''}
}  /* all one atomic instruction */</pre>${/* shown code, line 7: closing brace; all one atomic instruction */''}
      <p>It always returns the old value, whether or not it wrote. The caller compares the result with testval: equal means the write happened; anything else means memory was left untouched. Examples: word = 5, <code>compare_and_swap(&amp;word, 5, 9)</code> returns 5 and leaves 9 in word. Word = 3, <code>compare_and_swap(&amp;word, 0, 1)</code> returns 3 and leaves word at 3.</p>${/* notes paragraph: how to read the result, with two worked examples */''}
      <p><b>The spinlock:</b></p>${/* notes lead-in for the spinlock code */''}
      <pre>int bolt = 0;  /* shared: 0 free, 1 taken */${/* shown code, line 1 of the spinlock: the shared lock word */''}
void P(int i) {${/* shown code, line 2: the procedure every process runs */''}
    while (true) {${/* shown code, line 3: the endless loop */''}
        while (compare_and_swap(&amp;bolt, 0, 1) == 1)${/* shown code, line 4: keep trying while compare_and_swap returns 1 */''}
            ;  /* got 1: taken, test again */${/* shown code, line 5: the empty loop body, test again */''}
        /* critical section */  /* got 0: bolt is now 1, mine */${/* shown code, line 6: the critical section, reached on getting 0 */''}
        bolt = 0;  /* unlock */${/* shown code, line 7: unlock */''}
        /* remainder */${/* shown code, line 8: the remainder */''}
    }${/* shown code, line 9: closes the endless loop */''}
}</pre>${/* shown code, line 10: closes P and the code block */''}
      <p>Only a process that finds bolt = 0 leaves the loop, and finding it sets bolt to 1 in the same atomic step, so every other process sees 1 and keeps waiting. Getting 1 back does not mean success: it means someone else holds the lock.</p>${/* notes paragraph: why only one process can leave the loop, and what getting 1 back means */''}

      <h4>The exchange instruction</h4>${/* notes heading for the exchange instruction */''}
      <pre>void exchange(int *reg, int *mem) {  /* a register, a memory word */${/* shown code, line 1 of exchange: its header, a register and a memory word */''}
    int temp;${/* shown code, line 2: scratch space */''}
    temp = *mem;   /* copy the memory word aside */${/* shown code, line 3: copy the memory word aside */''}
    *mem = *reg;   /* register value goes to memory */${/* shown code, line 4: the register value goes to memory */''}
    *reg = temp;   /* old memory value to register */${/* shown code, line 5: the old memory value goes to the register */''}
}  /* all one atomic instruction */</pre>${/* shown code, line 6: closing brace; all one atomic instruction */''}
      <p>Each process keeps a private <b>key</b> and swaps it with the shared bolt until it pulls out the 0:</p>${/* notes lead-in: each process swaps a private key with bolt until it pulls out the 0 */''}
      <pre>int bolt = 0;${/* shown code, line 1 of the exchange lock: the shared lock word */''}
void P(int i) {${/* shown code, line 2: the procedure every process runs */''}
    while (true) {${/* shown code, line 3: the endless loop */''}
        int keyi = 1;  /* fresh key for each attempt */${/* shown code, line 4: a fresh key of 1 for each attempt */''}
        do exchange(&amp;keyi, &amp;bolt); /* swap my key with bolt, atomically */${/* shown code, line 5: swap the key with bolt atomically */''}
        while (keyi != 0);  /* no 0 pulled out? swap again */${/* shown code, line 6: repeat until the key holds the 0 */''}
        /* critical section */  /* I hold the only 0 */${/* shown code, line 7: the critical section */''}
        bolt = 0;  /* put the 0 back: unlock */${/* shown code, line 8: put the 0 back to unlock */''}
        /* remainder */${/* shown code, line 9: the remainder */''}
    }${/* shown code, line 10: closes the endless loop */''}
}</pre>${/* shown code, line 11: closes P and the code block */''}
      <p><b>The invariant</b> (a fact that stays true after every step). With n processes, <b>bolt + key<sub>1</sub> + … + key<sub>n</sub> = n</b>. Exchanges only move values around, so the sum never changes and there is exactly one 0 in the whole system. (A process outside the loop counts as key 1, the value its next attempt starts with; a waiter always holds 1.) If bolt = 0, no process is in its critical section. If bolt = 1, exactly one process is inside: the one whose key is 0. Worked example: 6 processes, one inside and five waiting, so bolt = 1 and the keys add up to 6 − 1 = 5. A bug that writes bolt = 0 while the lock is held creates a second 0 (the sum drops), and then two processes can get in.</p>${/* notes paragraph: the invariant, what bolt 0 or 1 means, a worked example with six processes, and how a bug breaks it */''}

      <h4>Busy waiting and starvation</h4>${/* notes heading for busy waiting and starvation */''}
      <p><b>Busy waiting (spin waiting):</b> a process that finds the lock taken keeps executing the test in a loop, using processor time and doing no useful work. On a multiprocessor, each spinner wastes its own processor. Worked example: 4 processes on 4 processors; P1 holds the lock for 40 µs while the other 3 spin the whole time: 3 × 40 = 120 µs of processor time wasted. On a uniprocessor it is worse: the spinner uses up its turn while the holder, the only process that can release the lock, is not running. The waste grows with the number of waiters and the length of the critical section.</p>${/* notes paragraph: busy waiting, with the 120 microsecond worked example and why one processor is worse */''}
      <p><b>Starvation:</b> when the lock is released, all spinners race and whichever instruction reaches memory first wins. The hardware keeps no queue and no record of who waited longest, so the choice is arbitrary and some process could lose indefinitely. With fewer rivals a process wins more often, but there is still no guarantee (a releaser that loops straight back can beat it again). Starvation differs from deadlock: the system keeps making progress; only the starved process is stuck.</p>${/* notes paragraph: starvation comes from an arbitrary race with no queue, and differs from deadlock */''}

      <h4>Deadlock with priorities</h4>${/* notes heading for the priority deadlock */''}
      <p>On one processor with <b>priority scheduling</b> (always run the highest-priority Ready process): low-priority P<sub>low</sub> takes the lock; high-priority P<sub>high</sub> becomes Ready (say, its disk read finishes) and preempts P<sub>low</sub> inside its critical section; P<sub>high</sub> then tries the same lock and spins. A spinning process is still Ready, so at every timer interrupt the dispatcher picks P<sub>high</sub> again. P<sub>high</sub> waits for P<sub>low</sub> to release bolt; P<sub>low</sub> waits for P<sub>high</sub> to release the processor: a <b>deadlock</b>. If the waiter slept (was Blocked) instead of spinning, P<sub>low</sub> would run, unlock, and P<sub>high</sub> would be woken. That is the idea behind semaphores (5.4).</p>${/* notes paragraph: the priority deadlock step by step, and how sleeping instead of spinning avoids it */''}

      <h4>Scorecard: machine-instruction approach</h4>${/* notes heading for the scorecard table */''}
      <table>${/* starts the scorecard table */''}
        <tr><th>Advantages</th><th>Disadvantages</th></tr>${/* table header row: advantages and disadvantages */''}
        <tr><td>Works for any number of processes</td><td>Busy waiting: waiting processes consume processor time</td></tr>${/* table row: any number of processes versus busy waiting */''}
        <tr><td>Works on a uniprocessor or on multiple processors sharing main memory</td><td>Starvation is possible: the next process to enter is chosen arbitrarily</td></tr>${/* table row: one or many processors versus possible starvation */''}
        <tr><td>Simple, so easy to verify</td><td>Deadlock is possible: a high-priority spinner can shut out a low-priority holder</td></tr>${/* table row: simple to verify versus possible deadlock */''}
        <tr><td>Supports multiple critical sections, each with its own lock variable</td><td></td></tr>${/* table row: many critical sections, with no matching disadvantage */''}
      </table>${/* ends the scorecard table */''}
      <p><b>The two routes compared:</b> interrupt disabling works only on a uniprocessor, only in the kernel, and stalls everything else; atomic instructions work wherever memory is shared, at the price of busy waiting, possible starvation and the priority deadlock.</p>`,  // closing notes paragraph comparing the two routes; ends the notes text
  });  // closes the section object passed to Guide.section
})();  // ends the wrapping function and runs it immediately
