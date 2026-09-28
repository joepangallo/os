// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 4.3 — Multicore and Multithreading
   Amdahl's law, real-world overheads, the four kinds of multicore-friendly
   software, and how a game engine was re-threaded for many cores.
   ===================================================================== */
Guide.section({  // registers section 4.3 with the guide; everything inside this call (text, terms, styles, steps) describes the section
  id: '4.3',  // id: the section number, used in the page address, the table of contents and the progress records
  title: 'Multicore and Multithreading',  // title: the full section name shown at the top of every step
  short: 'Multicore & threads',  // short: the compact name used in tight lists such as the home page's section list
  summary: "How much faster software runs on many cores: Amdahl's law, overheads, app types, game-engine threading.",  // summary: the one-line description shown under the section name on the chapter overview
  objectives: [  // objectives: what a student should be able to do after this section; listed in the printable version
    "Calculate the speedup of a program on N cores with Amdahl's law, and explain why the serial fraction puts a ceiling on it.",  // objective 1: compute speedup with Amdahl's law and explain the ceiling set by the serial part
    'Explain why real software can stop improving, or even slow down, as cores are added (communication, work distribution, cache coherence).',  // objective 2: explain why adding cores can stop helping or even hurt in real software
    'Classify software into the four kinds that benefit from multicore: multithreaded native, multiprocess, Java and multi-instance applications.',  // objective 3: sort software into the four kinds of applications that gain from multicore
    'Compare coarse-grained, fine-grained and hybrid threading, using the way the Valve game engine was rebuilt for multicore.',  // objective 4: compare coarse-grained, fine-grained and hybrid threading using the game-engine case study
  ],  // closes the objectives list
  terms: [  // terms: glossary entries as [term, definition] pairs; they fill the glossary and the dotted-underline pop-ups
    ['Multicore processor', 'A single chip that holds two or more independent processing units (cores). Each core can run its own thread at the same moment as the others.'],  // glossary entry: defines a multicore processor (several cores on one chip)
    ['Speedup', 'How many times faster a job finishes on N processors than on one: the time on one processor divided by the time on N processors.'],  // glossary entry: defines speedup as time on one processor divided by time on N processors
    ["Amdahl's law", 'A formula for the best speedup N processors can give when only part of a program can run in parallel: speedup = 1 / ((1 − f) + f / N).'],  // glossary entry: defines Amdahl's law and gives its formula
    ['Parallel fraction (f)', "The share of a program's one-processor running time that can be split perfectly across any number of processors. Amdahl's law assumes this part costs nothing extra to split."],  // glossary entry: defines the parallel fraction f, the part of the work that splits across cores
    ['Serial fraction', 'The share of the running time, 1 − f, that must run one step after another on a single processor. Adding cores does not shorten it at all.'],  // glossary entry: defines the serial fraction 1 - f, the part that extra cores cannot shorten
    ['Parallel efficiency', 'Speedup divided by the number of processors: the average share of each core\'s time spent on useful work. 100% would mean no core ever waits or wastes effort.'],  // glossary entry: defines parallel efficiency as speedup divided by the number of cores
    ['Diminishing returns', 'The pattern in which each extra core adds less speedup than the one before, because the serial part never shrinks.'],  // glossary entry: defines diminishing returns, each extra core adding less than the last
    ['Scalability', 'How well a program keeps getting faster as processors are added. Software that scales well gains close to N times on N cores.'],  // glossary entry: defines scalability, how well speed keeps growing as cores are added
    ['Parallel overhead', 'Extra work that exists only because a job was split up: threads communicating, work being divided and handed out, threads waiting for each other, and caches being kept coherent.'],  // glossary entry: defines parallel overhead, the extra work created only by splitting a job up
    ['Multithreaded native application', 'Software made of a small number of processes, each running many threads, compiled to the machine\'s own instructions (native code). Examples: Lotus Domino, Siebel CRM.'],  // glossary entry: defines a multithreaded native application (few processes, many threads each)
    ['Multiprocess application', 'Software built from many separate single-threaded processes that the OS can place on different cores. Examples: Oracle database, SAP, PeopleSoft.'],  // glossary entry: defines a multiprocess application (many single-threaded processes)
    ['Java virtual machine (JVM)', 'The program that runs Java code and manages its memory and threads. It is itself multithreaded: garbage collection (freeing unused memory), just-in-time compilation (turning Java code into machine instructions while it runs) and the application\'s threads can all run on different cores.'],  // glossary entry: defines the Java virtual machine and why it keeps several cores busy on its own
    ['Multi-instance application', 'Running several copies (instances) of the same program at once, often each in its own virtual machine, so the cores stay busy even if one copy could not use them.'],  // glossary entry: defines a multi-instance application (several copies of one program running at once)
    ['Coarse-grained threading', 'Giving each whole module of a program (for example rendering, AI or physics) its own thread, so each module runs on its own core. Each module stays single-threaded inside.'],  // glossary entry: defines coarse-grained threading (one thread per whole module)
    ['Timeline thread', 'In a coarse-grained game engine, the thread that keeps the module threads in step, synchronizing them once per frame so that, for example, rendering uses the positions physics has just computed.'],  // glossary entry: defines the timeline thread that keeps the module threads in step each frame
    ['Fine-grained threading', 'Splitting many similar or identical pieces of work, such as the iterations of one loop over an array, into small tasks spread across all the cores.'],  // glossary entry: defines fine-grained threading (many small similar tasks spread over all cores)
    ['Hybrid threading (game engines)', 'A game-engine strategy: use fine-grained threading only for the systems that benefit from it and leave the other systems single-threaded. (Not the same as the combined user-level/kernel-level thread model.)'],  // glossary entry: defines hybrid threading in a game engine and warns it differs from the hybrid thread model
    ['Single-writer, multiple-readers lock', 'A lock with two modes: any number of threads may hold it at once to read, but a thread that wants to write must hold it alone. It suits data that is read far more often than it is changed.'],  // glossary entry: defines a single-writer, multiple-readers lock
    ['Lock-free data structure', 'A shared structure (such as a queue) that threads update with an atomic instruction such as compare_and_swap, which changes a memory word only if it still holds the value the thread expects. If another thread got there first, the update simply retries. No lock is ever taken, so no thread sleeps waiting for another to release one.'],  // glossary entry: defines a lock-free data structure built on compare-and-swap retries
    ['Scene list', 'In a game renderer, the list of objects visible from one viewpoint (the main camera, a reflection, a shadow) that must be drawn this frame.'],  // glossary entry: defines a scene list, the objects to draw from one viewpoint this frame
  ],  // closes the terms list

  css: ` /* css: style rules for this section only; the guide adds them to the page once when the section is registered */
    .sec-4-3 .num { font-variant-numeric: tabular-nums; } /* numbers use equal-width digits so readouts do not shift sideways as their values change */
    .sec-4-3 .step-eyebrow { flex-wrap: wrap; row-gap: 2px; }   /* long section title: let the eyebrow wrap on phones instead of widening the page */
    .sec-4-3 .fl { font-size: 15px; padding: 1px 8px; border-radius: 7px; opacity: .22; border-left: 4px solid transparent; transition: opacity .25s, background .25s; } /* one line of the step 2 formula: small, faint at first, with a colored left edge that can light up; changes fade in */
    .sec-4-3 .fl.seen { opacity: 1; } /* a formula line that has already been reached becomes fully visible */
    .sec-4-3 .fl.on { background: var(--cpu-bg); border-left-color: var(--cpu); } /* the formula line being explained right now gets the processor color as a background and left bar */
    .sec-4-3 .p43-in { font: inherit; font-family: var(--mono); font-size: 18px; width: 140px; height: 40px; border-radius: 10px; border: 2px solid var(--line-2); padding: 0 10px; background: var(--panel); color: var(--ink); } /* the number-entry box in the practice step: monospaced digits, fixed size, rounded border */
    .sec-4-3 .p43-in:focus { outline: none; border-color: var(--chc); } /* when the student clicks into the entry box, its border turns the chapter color instead of the default outline */
    .sec-4-3 .pp { width: 28px; height: 28px; border-radius: 8px; border: 2px solid var(--line-2); background: var(--panel); font-size: 13px; font-weight: 800; color: var(--ink-2); cursor: pointer; } /* a small square problem-number button used to jump between practice problems */
    .sec-4-3 .pp.on { border-color: var(--chc); color: var(--chc); } /* the practice problem currently open gets a chapter-colored border and number */
    .sec-4-3 .pp.ok { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); } /* a problem answered correctly turns green */
    .sec-4-3 .pp.warn { background: var(--warn-bg); border-color: var(--warn); color: var(--warn); } /* a problem answered with a warning (close but not right) turns amber */
    .sec-4-3 .pp.bad { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); } /* a problem answered wrongly turns red */
    .sec-4-3 .pp.on.ok, .sec-4-3 .pp.on.warn, .sec-4-3 .pp.on.bad { box-shadow: 0 0 0 2px var(--chc); } /* the open problem keeps a chapter-colored ring even after it has been colored by its result */
    .sec-4-3 .sortcard { text-align: left; font: inherit; font-size: 14.5px; line-height: 1.35; padding: 10px 12px; border-radius: 10px; border: 2px solid var(--line); background: var(--panel); color: var(--ink); cursor: grab; } /* a card to be sorted in the classify activity: left-aligned text, rounded border, grab cursor to hint it can be dragged */
    .sec-4-3 .sortcard:hover { border-color: var(--chc); } /* hovering a sort card outlines it in the chapter color */
    .sec-4-3 .sortcard.sel { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--chc) 35%, transparent); } /* the selected sort card gets a tinted background and a soft ring so the student sees which card will move */
    .sec-4-3 .bk { cursor: pointer; min-height: 136px; border-width: 2px; border-style: dashed; } /* a bucket (drop target) in the classify activity: dashed border, pointer cursor and a minimum height to drop into */
    .sec-4-3 .bk:hover { border-color: var(--chc); } /* hovering a bucket outlines it in the chapter color, showing it can receive the selected card */
  `,  // end of the section's style rules

  steps: [  // steps: the list of screens in this section, shown one at a time as the student presses Next
    /* ---------------- 1. Big picture: more cores, but not proportionally faster ---------------- */
    {  // step 1 begins: the big-picture opener
      title: 'Eight cores, eight times faster? Not quite',  // step 1 title: asks whether eight cores make a program eight times faster
      kind: 'story',  // kind 'story' labels the step as the Big Picture and keeps it on the short route through the guide
      render(el, ctx) {  // render(el, ctx) builds step 1 when the student arrives; el is the step's box, ctx holds the guide's helpers
        const { h, s } = ctx;  // h builds ordinary page elements and s builds SVG (the browser's drawing format) elements
        const left = h('div', { class: 'stack', html: `${/* left column: a stack of paragraphs written as HTML text */''}
          <p class="lead m0">A chip with eight cores can run eight threads at the same instant. Does your program therefore finish eight times sooner? Almost never. This section explains exactly why.</p>${/* opening paragraph: poses the question of whether eight cores mean eight times faster */''}
          <p class="m0">Sections 4.1 and 4.2 split a program into threads, and kernel-level threads can use several cores at once. Now we measure the payoff: the <span class="t">speedup</span> a real program gets from a <span class="t">multicore processor</span>.</p>${/* paragraph linking back to the thread sections and introducing speedup and multicore processors */''}
          <div class="callout analogy m0" data-label="Analogy">Ten friends help you cook lasagna for a party. Chopping gets ten times faster because everyone chops at once. But the dish still bakes for 40 minutes in your one oven, however many friends you have. The oven time is the <b>serial</b> part of the job.</div>${/* analogy box: friends chop in parallel but the single oven bakes serially */''}
          <div><h4>In this section you will</h4>${/* heading for the list of goals for this section */''}
          <ul class="small m0">${/* starts the bulleted goals list */''}
            <li>calculate speedup with Amdahl's law and find its ceiling,</li>${/* goal: calculate speedup and its ceiling */''}
            <li>see why real software can get <i>slower</i> with too many cores,</li>${/* goal: see why software can get slower with too many cores */''}
            <li>sort real applications into four multicore-friendly kinds,</li>${/* goal: sort applications into four multicore-friendly kinds */''}
            <li>re-thread a game engine the way Valve did.</li>${/* goal: re-thread a game engine the way the case study did */''}
          </ul></div>` });  // end of the goals list and of the left column's HTML

        // ---- right: a 100-second job, 10 s serial + 90 s parallel, on N cores
        const NW = ctx.narrow, FS = NW ? 1.1 : 1;   // phones: narrower drawing, slightly larger text
        const SER = 10, PAR = 90, X0 = NW ? 60 : 70, X1 = NW ? 364 : 566, PX = (X1 - X0) / 100;  // the job's numbers (10 s serial, 90 s parallel) and the drawing's left and right edges; PX turns seconds into drawing units
        const svg = s('svg', { viewBox: NW ? '0 0 380 290' : '0 0 600 290', width: '100%', role: 'img', 'aria-label': 'Timeline of the job on the chosen number of cores' });  // the SVG timeline drawing; its width depends on screen size, and aria-label describes it to screen readers
        const finish = h('div', { class: 'big num' });  // big readout for when the job finishes, filled in by draw()
        const speed = h('div', { class: 'big num', style: { color: 'var(--cpu)' } });  // big readout for the speedup, shown in the processor color
        const say = h('p', { class: 'small m0' });  // a sentence under the readouts explaining the current result in words
        function draw(n) {  // draw(n) redraws the timeline and readouts for n cores; runs at start and whenever a core-count button is pressed
          const inf = n === Infinity;  // inf is true when the student picked the infinity button
          const lanes = inf ? 16 : n;  // how many lanes (one per core) to draw; infinity is shown as 16 lanes
          const top = 18, areaH = 226, gap = lanes > 8 ? 2 : 6;  // drawing area top, height, and the gap between lanes (smaller gaps when there are many lanes)
          const lh = Math.min(40, (areaH - gap * (lanes - 1)) / lanes);  // height of each lane: the area shared evenly among lanes, but never taller than 40 units
          const parT = inf ? 0.6 : PAR / n;          // with "infinite" cores draw a tiny sliver
          const done = SER + (inf ? 0 : PAR / n);  // done: the job's finishing time in seconds, the serial 10 s plus each core's share of the 90 s
          const kids = [];  // kids collects every shape of the new drawing before it replaces the old one
          for (let i = 0; i < lanes; i++) {  // loops once per core lane, top to bottom
            const y = top + i * (lh + gap);  // y: the top edge of this lane
            kids.push(s('rect', { x: X0, y, width: X1 - X0, height: lh, rx: 4, class: 's-panel', 'stroke-width': 1 }));  // the empty gray background bar for this core's lane
            const lab = inf ? (i === 0 ? 'core 1' : i === lanes - 1 ? (NW ? 'core ∞' : '… core ∞') : '') : (lanes <= 8 || i % 3 === 0 || i === lanes - 1) ? 'core ' + (i + 1) : '';  // the lane's label: every lane when there are few, only some when there are many, and "core infinity" at the bottom
            if (lab) kids.push(s('text', { x: X0 - 8, y: y + lh / 2 + 5, 'text-anchor': 'end', 'font-size': (lanes > 8 ? 12 : 14) * FS, class: 's-sub' }, lab));  // draws the label, right-aligned just left of the lane, if this lane gets one
            if (i === 0) kids.push(s('rect', { x: X0, y, width: SER * PX, height: lh, rx: 4, class: 's-warn', 'stroke-width': 2 }));  // only core 1 runs the serial part, so only lane 1 gets the amber serial block
            kids.push(s('rect', { x: X0 + SER * PX, y, width: Math.max(2, parT * PX), height: lh, rx: 4, class: 's-cpu', 'stroke-width': lanes > 8 ? 1 : 2 }));  // every lane gets a blue block for its share of the parallel work, starting where the serial block ends (at least 2 units wide)
          }  // ends the loop over core lanes
          if (lanes <= 4) {  // with 4 or fewer lanes there is room to write labels inside the blocks
            if (SER * PX > 44) kids.push(s('text', { x: X0 + SER * PX / 2, y: top + lh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13 * FS, 'font-weight': 700 }, 'serial'));  // writes "serial" in the middle of core 1's amber block if the block is wide enough to hold the word
            if (parT * PX > 70) kids.push(s('text', { x: X0 + (SER + parT / 2) * PX, y: top + lh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13 * FS, 'font-weight': 700 }, (n === 1 ? '90 s parallel' : ctx.util.fmt(parT, 2) + ' s each')));  // writes the parallel time inside core 1's blue block ("90 s parallel" or "22.5 s each") when it is wide enough
          }  // ends the in-block labels
          // finish marker + axis
          const fx = X0 + done * PX, axisY = top + areaH + 14;  // fx: where the job finishes on the time axis; axisY: how far down the time axis sits, just below the lanes
          kids.push(s('line', { x1: fx, y1: top - 6, x2: fx, y2: axisY, class: 's-line', 'stroke-dasharray': '5 4', style: { stroke: 'var(--ok)' } }));  // a dashed green vertical line at the finishing time, crossing all the lanes
          kids.push(s('text', { x: Math.min(fx + 6, X1 - 60), y: top + 2, 'font-size': 13 * FS, 'font-weight': 800, style: { fill: 'var(--ok)' } }, 'done'));  // the word "done" beside the finish line, pulled left if it would run off the drawing's right edge
          kids.push(s('line', { x1: X0, y1: axisY, x2: X1, y2: axisY, class: 's-line' }));  // the horizontal time axis along the bottom of the drawing
          for (let t = 0; t <= 100; t += 20) {  // places a tick every 20 seconds from 0 to 100
            kids.push(s('line', { x1: X0 + t * PX, y1: axisY, x2: X0 + t * PX, y2: axisY + 5, class: 's-line' }));  // the small tick mark on the axis
            kids.push(s('text', { x: X0 + t * PX, y: axisY + 20, 'text-anchor': NW && t === 100 ? 'end' : 'middle', 'font-size': 13 * FS, class: 's-sub' }, t + ' s'));  // the tick label such as "40 s"; on phones the last label is right-aligned so it stays inside the drawing
          }  // ends the tick loop
          svg.replaceChildren(...kids);  // swaps all the new shapes into the SVG in one step, replacing the previous drawing
          finish.textContent = ctx.util.fmt(done, 2) + ' s';  // shows the finishing time in seconds in the "finishes after" readout
          speed.textContent = ctx.util.fmt(100 / done, 2) + '×';  // shows the speedup (100 s divided by the finishing time) in the speedup readout
          say.innerHTML = inf  // picks the explanation sentence for the current core count
            ? 'With unlimited cores the 90 s of parallel work shrinks to almost nothing, but the 10 s serial part is untouched. The job can never beat 10 s, so the speedup can never beat <b>10×</b>.'  // infinity case: the parallel part vanishes but the 10 s serial part caps the speedup at 10 times
            : n === 1  // otherwise checks for the single-core case
              ? 'One core does everything: 10 s of serial work, then 90 s of parallel-friendly work. Pick more cores above.'  // one core: explains that it runs the 10 s serial and 90 s parallel parts in turn, and invites the student to add cores
              : `The 90 s of parallel work splits into ${n} pieces of ${ctx.util.fmt(PAR / n, 2)} s, yet the 10 s serial part still runs alone. 100 ÷ ${ctx.util.fmt(done, 2)} = <b>${ctx.util.fmt(100 / done, 2)}×</b>, not ${n}×.`;  // two or more cores: shows how the parallel part splits and why the speedup is less than n
        }  // ends draw()
        const seg = ctx.ui.seg([1, 2, 4, 8, 16, { value: Infinity, label: '∞' }].map((v) => (typeof v === 'object' ? v : { value: v, label: String(v) })), 4, draw);  // the row of core-count buttons 1, 2, 4, 8, 16 and infinity; starts on 4 and calls draw() on every press
        draw(4);  // draws the 4-core picture right away so the step is not empty when it opens
        const right = h('div', { class: 'card white stack', style: { gap: '8px' } },  // right column: a white card holding the controls, drawing and readouts
          h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // top row of the card: title on the left, core buttons on the right
            h('div', {}, h('h4', { class: 'm0' }, 'Try it: one 100-second job'), h('div', { class: 'small muted' }, h('span', { class: 'chip warn' }, '10 s serial'), ' + ', h('span', { class: 'chip cpu' }, '90 s parallel'))),  // the card title plus two colored chips naming the 10 s serial and 90 s parallel parts
            h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b' }, 'Cores:'), seg)),  // the "Cores:" label next to the button row
          svg,  // the timeline drawing
          h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'auto auto' : 'auto auto minmax(0, 1fr)', gap: '8px 18px', alignItems: 'center' } },  // a grid for the readouts: three columns on wide screens, two on phones so the sentence gets its own row
            h('div', {}, h('div', { class: 'xs muted b' }, 'FINISHES AFTER'), finish),  // the "finishes after" label above its big number
            h('div', {}, h('div', { class: 'xs muted b' }, 'SPEEDUP'), speed),  // the "speedup" label above its big number
            ctx.narrow ? h('div', { style: { gridColumn: '1 / -1' } }, say) : say));  // the explanation sentence: on phones it spans the whole grid row, otherwise it sits in the third column
        el.append(h('div', { class: 'split l fill' }, left, right));  // puts the left text column and the right interactive card side by side (stacked on phones)
      },  // ends render() for step 1
    },  // ends step 1

    /* ---------------- 2. Amdahl's law derived, frame by frame ---------------- */
    {  // step 2 begins: a frame-by-frame derivation of Amdahl's law
      title: "Amdahl's law, built one frame at a time",  // step 2 title: building the law one frame at a time
      kind: 'learn',  // kind 'learn' labels this as a teaching step
      render(el, ctx) {  // render(el, ctx) builds step 2 when the student arrives on it
        const { h, s } = ctx; const fmt = ctx.util.fmt;  // takes the element builders from ctx, and fmt, which rounds a number and formats it for display
        // phones get a narrow drawing (viewBox close to the rendered width) so labels stay readable
        const NW = ctx.narrow, FS = NW ? 1.1 : 1;  // NW is true on small screens; FS enlarges the drawing's text slightly there
        const F = 0.9, T = 100, X0 = NW ? 74 : 118, X1 = NW ? 370 : 1080, PX = (X1 - X0) / T;  // the example job: f = 0.9, T = 100 ms; X0 and X1 are the timeline's edges and PX turns milliseconds into drawing units
        const svg = s('svg', { viewBox: NW ? '0 0 380 178' : '0 0 1100 178', width: '100%', role: 'img', 'aria-label': 'One-core and N-core timelines of the same job' });  // the SVG that shows the one-core row above the N-core lanes
        const lines = [  // lines: the five formula lines revealed one by one as the frames advance
          'T<sub>1</sub> = (1 − f)·T + f·T = T',  // formula line 1: time on one core is the serial part plus the parallel part, which is all of T
          'T<sub>N</sub> = (1 − f)·T + f·T / N',  // formula line 2: time on N cores divides only the parallel part by N
          'Speedup = T<sub>1</sub> / T<sub>N</sub> = T / ((1 − f)·T + f·T / N)',  // formula line 3: speedup is the one-core time divided by the N-core time
          'Speedup = <b>1 / ((1 − f) + f / N)</b>',  // formula line 4: after cancelling T, Amdahl's law itself
          'As N → ∞: Speedup → <b>1 / (1 − f)</b>',  // formula line 5: the ceiling the speedup approaches as N grows without limit
        ].map((x) => h('div', { class: 'fl mono', html: x }));  // turns each formula string into a monospaced line element styled by the section's .fl rule
        const nums = h('div', { class: 'grid-2', style: { gap: '8px 14px' } });  // a two-column grid for the four number readouts under the drawing
        const frames = [  // frames: one entry per animation step; n = cores drawn, upto = last formula line shown, cur = line highlighted, cap = caption
          { n: 1, upto: -1, cur: -1, cap: 'Every program has two kinds of work. The <span class="t">parallel fraction</span> f can be shared among any number of cores at no extra cost. The rest, 1 − f, is the <span class="t">serial fraction</span>: it must run one step at a time. Here f = 0.9 and the job takes T = 100 ms on one core.' },  // frame 1: introduces the parallel and serial fractions with f = 0.9 and T = 100 ms
          { n: 1, upto: 0, cur: 0, cap: 'On <b>one core</b> the two parts simply add up: 10 ms serial + 90 ms parallel = 100 ms. In symbols, T<sub>1</sub> = (1 − f)T + fT = T.' },  // frame 2: on one core the two parts simply add up to T
          { n: 2, upto: 1, cur: 1, cap: 'Give it <b>2 cores</b>. Only the parallel part is divided: 90 ÷ 2 = 45 ms on each core. The serial 10 ms is not divided at all. T<sub>2</sub> = 10 + 45 = 55 ms.' },  // frame 3: with 2 cores only the parallel part is halved, giving 55 ms
          { n: 2, upto: 2, cur: 2, cap: '<span class="t">Speedup</span> compares the two times: how many times faster is N cores than one? T<sub>1</sub> ÷ T<sub>2</sub> = 100 ÷ 55 = <b>1.82×</b>. Twice the cores, but not twice as fast, because the serial 10 ms did not shrink.' },  // frame 4: defines speedup and computes 100 / 55 = 1.82 times
          { n: 2, upto: 3, cur: 3, cap: 'Divide the top and the bottom of that fraction by T: every T cancels. What is left is <span class="t">Amdahl\'s law</span>, which needs only f and N, not the job length. Check: 1 / (0.1 + 0.9 / 2) = 1 / 0.55 = <b>1.82×</b>.' },  // frame 5: cancelling T turns the fraction into Amdahl's law, checked against 1.82
          { n: 4, upto: 3, cur: 3, cap: '<b>4 cores:</b> 10 + 90/4 = 32.5 ms, so the speedup is 1 / (0.1 + 0.225) = <b>3.08×</b>. Twice the cores of the last frame, but not twice the speedup.' },  // frame 6: 4 cores give 3.08 times, not double the previous speedup
          { n: 8, upto: 3, cur: 3, cap: '<b>8 cores:</b> 10 + 11.25 = 21.25 ms, a speedup of <b>4.71×</b>. Eight times the hardware, under five times the speed. <span class="t" data-t="Parallel efficiency">Efficiency</span> = speedup ÷ N = 4.71 ÷ 8 = 59%: on average each core does useful work only 59% of the time.' },  // frame 7: 8 cores give 4.71 times and an efficiency of only 59%
          { n: 64, upto: 3, cur: 3, cap: '<b>64 cores:</b> 10 + 1.41 = 11.41 ms, only <b>8.77×</b>. The parallel part is now a sliver; almost all the time is the serial 10 ms. Each extra core buys less than the one before: <span class="t">diminishing returns</span>.' },  // frame 8: 64 cores give 8.77 times, showing diminishing returns
          { n: Infinity, upto: 4, cur: 4, cap: 'Let N grow without limit. f/N shrinks toward 0, so the time never drops below the serial 10 ms. The speedup can never pass 1 / (1 − f) = 1 / 0.1 = <b>10×</b>, not even with a million cores.' },  // frame 9: with unlimited cores the speedup approaches the 10 times ceiling
          { n: Infinity, upto: 4, cur: -1, cap: 'Two lessons. <b>1.</b> When f is small, extra cores barely help. <b>2.</b> Even when f is large, returns diminish and the speedup flattens at 1 / (1 − f). The way to go faster is to <b>shrink the serial part</b>.' },  // frame 10: the two lessons, ending with "shrink the serial part"
        ];  // closes the frames list
        function draw(fr) {  // draw(fr) redraws the picture, formula highlights and readouts for one frame, and returns that frame's caption
          const inf = fr.n === Infinity, k = [];  // inf marks the unlimited-cores frames; k collects the new shapes
          const tN = (1 - F) * T + (inf ? 0 : F * T / fr.n);  // tN: the job's time on this frame's number of cores (serial 10 ms plus the parallel 90 ms divided by N)
          // row 1: one core
          k.push(s('text', { x: X0 - 10, y: 30, 'text-anchor': 'end', 'font-weight': 700, 'font-size': 15 * FS }, '1 core'));  // the "1 core" label to the left of the top row
          k.push(s('rect', { x: X0, y: 8, width: (1 - F) * T * PX, height: 34, rx: 5, class: 's-warn', 'stroke-width': 2 }));  // the amber serial block of the one-core row (10 ms wide)
          k.push(s('rect', { x: X0 + (1 - F) * T * PX, y: 8, width: F * T * PX, height: 34, rx: 5, class: 's-cpu', 'stroke-width': 2 }));  // the blue parallel block of the one-core row (90 ms wide), right after the serial block
          k.push(s('text', { x: X0 + 5 * PX, y: 30, 'text-anchor': 'middle', 'font-size': 13 * FS, 'font-weight': 700 }, NW ? '10' : '10 ms'));  // labels the serial block with its length (just "10" on phones to save room)
          k.push(s('text', { x: X0 + 55 * PX, y: 30, 'text-anchor': 'middle', 'font-size': 13 * FS, 'font-weight': 700 }, 'parallel part: 90 ms'));  // labels the parallel block "parallel part: 90 ms"
          // row 2: N cores
          if (fr.n > 1) {  // the N-core lanes are drawn only once the frame has more than one core
            const lanes = inf ? 8 : Math.min(fr.n, 8), top = 54, area = 90, gap = 3;  // draws at most 8 lanes (8 for unlimited too); top and area place them below the one-core row
            const lh = (area - gap * (lanes - 1)) / lanes;  // lh: the height of each lane so all lanes fit the area with small gaps
            const pw = inf ? 2 : Math.max(2, F * T / fr.n * PX);  // pw: width of each lane's parallel share; a 2-unit sliver for unlimited cores so it is still visible
            k.push(s('text', { x: X0 - 10, y: top + area / 2 - 2, 'text-anchor': 'end', 'font-weight': 700, 'font-size': (NW ? 13.5 : 15) * FS }, inf ? '∞ cores' : fr.n + ' cores'));  // the core-count label to the left of the lanes, such as "8 cores" or "infinity cores"
            if (lanes < fr.n) k.push(s('text', { x: X0 - 10, y: top + area / 2 + 16, 'text-anchor': 'end', 'font-size': 12 * FS, class: 's-sub' }, NW ? '(8 shown)' : '(8 lanes shown)'));  // when there are more cores than lanes, notes that only 8 lanes are shown
            for (let i = 0; i < lanes; i++) {  // loops over the lanes to draw
              const y = top + i * (lh + gap);  // y: the top edge of this lane
              k.push(s('rect', { x: X0, y, width: X1 - X0, height: lh, rx: 3, class: 's-panel', 'stroke-width': 1 }));  // the lane's gray background bar
              if (i === 0) k.push(s('rect', { x: X0, y, width: (1 - F) * T * PX, height: lh, rx: 3, class: 's-warn', 'stroke-width': 2 }));  // only the first lane carries the serial block, because serial work runs on one core
              k.push(s('rect', { x: X0 + (1 - F) * T * PX, y, width: pw, height: lh, rx: 3, class: 's-cpu', 'stroke-width': 1.5 }));  // each lane's blue parallel share, starting after the serial part
            }  // ends the lane loop
            const fx = X0 + tN * PX;  // fx: the x position of this frame's finishing time
            k.push(s('line', { x1: fx, y1: top - 6, x2: fx, y2: top + area + 4, class: 's-line', 'stroke-dasharray': '5 4', style: { stroke: 'var(--ok)' } }));  // a dashed green line marking when the N-core run finishes
            k.push(s('text', { x: fx + 8, y: top + 18, 'font-size': 15 * FS, 'font-weight': 800, style: { fill: 'var(--ok)' } }, 'T' + (inf ? '∞' : '') + ' = ' + fmt(tN, 2) + ' ms'));  // the finishing time written beside that line, such as "T = 55 ms"
          } else {  // otherwise (the one-core frames) there are no lanes to draw
            k.push(s('text', { x: X0, y: 104, 'font-size': 15 * FS, class: 's-sub' }, NW ? 'Only one core so far.' : 'Only one core so far. The next frames add more.'));  // a gray note in the empty space saying that only one core is shown so far
          }  // ends the one-core versus N-core choice
          k.push(s('line', { x1: X0, y1: 152, x2: X1, y2: 152, class: 's-line' }));  // the time axis under the drawing
          for (let t = 0; t <= 100; t += NW ? 20 : 10) k.push(s('text', { x: X0 + t * PX, y: 171, 'text-anchor': NW && t === 100 ? 'end' : 'middle', 'font-size': 13 * FS, class: 's-sub' }, t + (t === 100 ? ' ms' : '')));  // axis labels every 10 ms (every 20 ms on phones), with "ms" added only to the last one
          svg.replaceChildren(...k);  // replaces the old drawing with the new shapes in one step
          lines.forEach((l, i) => { l.classList.toggle('seen', i <= fr.upto); l.classList.toggle('on', i === fr.cur); });  // lights up the formula lines: lines up to "upto" become visible, and only the "cur" line gets the highlight
          const sp = T / tN;  // sp: this frame's speedup, the one-core time divided by the N-core time
          const cell = (lab, val, cls) => h('div', {}, h('div', { class: 'xs muted b' }, lab), h('div', { class: 'num b', style: { fontSize: '26px', color: cls ? `var(--${cls})` : null } }, val));  // cell(): builds one readout, a small gray label above a large number, optionally in a theme color
          nums.replaceChildren(cell('CORES (N)', inf ? '∞' : String(fr.n)), cell('TIME ON N CORES', fmt(tN, 2) + ' ms'), cell('SPEEDUP', fmt(sp, 2) + '×', 'cpu'), cell('EFFICIENCY', inf ? '→ 0%' : Math.round(sp / fr.n * 100) + '%'));  // fills the four readouts: cores, time on N cores, speedup (blue) and efficiency (speedup divided by N)
          return fr.cap;  // hands the frame's caption back to the player, which shows it above the controls
        }  // ends draw() for step 2
        const player = ctx.ui.player({ count: frames.length, render: (i) => draw(frames[i]), interval: 3600 });  // the frame player (play, pause, back, next buttons); it calls draw() for each frame and auto-advances every 3.6 s
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // lays out step 2 as a vertical stack filling the step area
          h('div', { class: 'card white tight' }, svg),  // top: the timeline drawing in a white card
          h('div', { class: 'split r', style: { height: 'auto', gap: '14px' } },  // middle row: the formula lines on the wider left, the number readouts on the right
            h('div', { class: 'card tight stack', style: { gap: '3px' } }, h('h4', { class: 'm0' }, 'The formula, line by line'), ...lines),  // card listing "The formula, line by line" followed by the five formula lines
            h('div', { class: 'card tight' }, nums)),  // card holding the four number readouts
          player.el));  // bottom: the player's caption and controls; closes the stack
      },  // ends render() for step 2
    },  // ends step 2

    /* ---------------- 3. Amdahl lab: sliders, bars and the speedup curve ---------------- */
    {  // step 3 begins: the hands-on Amdahl lab
      title: "Amdahl lab: drag f and N, watch the ceiling",  // step 3 title: drag f and N and watch the ceiling
      kind: 'lab',  // kind 'lab' labels this as a hands-on lab
      core: true,  // core: true keeps this step on the short (core) route through the guide
      render(el, ctx) {  // render(el, ctx) builds step 3 when the student arrives on it
        const { h, s } = ctx; const fmt = ctx.util.fmt;  // takes the element builders and the number formatter from ctx
        const amdahl = (f, n) => 1 / ((1 - f) + f / n);  // amdahl(f, n): Amdahl's law, the speedup of a job with parallel fraction f on n cores
        let f = 0.9, N = 8;  // the lab's current settings, changed by the sliders: f = 0.9 and N = 8 cores to start
        // ---------- chart (right)
        const NW = ctx.narrow, FS = NW ? 1.1 : 1;   // phones: narrower chart geometry so the labels stay legible
        const W = NW ? 380 : 660, H = NW ? 340 : 492, L = NW ? 52 : 58, R = NW ? 366 : 640, TOP = 12, B = NW ? 286 : 440;  // chart size and margins: W and H are the drawing size, L and R the left and right edges of the plot, TOP and B its top and bottom
        const chart = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Speedup versus number of cores for several parallel fractions' });  // the SVG chart of speedup against number of cores
        const clipId = 'c43-' + Math.random().toString(36).slice(2, 7);  // a random id for the chart's clipping region, so it cannot clash with any other id on the page
        const xs = (n) => L + (Math.log2(n) / 10) * (R - L);  // xs(n): turns a core count into an x position on a log scale, where each grid line doubles N (1 up to 1024)
        const niceUp = (v) => { const p = 10 ** Math.floor(Math.log10(v)); for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p; return 10 * p; };  // niceUp(v): rounds v up to a tidy number (1, 1.2, 1.5, 2, 2.5 ... times a power of ten) for the top of the y axis
        const niceStep = (v) => { const p = 10 ** Math.floor(Math.log10(v)); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p; return 10 * p; };  // niceStep(v): rounds v up to a tidy step (1, 2, 2.5, 5 or 10 times a power of ten) for spacing the y grid lines
        const REF = [0.5, 0.75, 0.9, 0.95, 0.99];  // REF: the other values of f drawn as gray reference curves beside the student's curve
        function curvePath(ff, ys) {  // curvePath(ff, ys): builds the SVG path text for Amdahl's curve with parallel fraction ff
          let d = '';  // d collects the path commands as text
          for (let i = 0; i <= 200; i++) { const n = 2 ** (i / 20); d += (i ? 'L' : 'M') + xs(n).toFixed(1) + ' ' + ys(amdahl(ff, n)).toFixed(1); }  // samples 201 points from 1 to 1024 cores, evenly spaced on the log scale, joining them with straight segments
          return d;  // returns the finished path text
        }  // ends curvePath()
        function drawChart() {  // drawChart(): redraws the whole chart; runs whenever a slider or jump button changes f or N
          const ymax = niceUp(Math.max(3, amdahl(f, 1024) * 1.12));  // ymax: the top of the y axis, a tidy value a bit above the speedup at 1024 cores (at least 3)
          const ys = (v) => B - (v / ymax) * (B - TOP);  // ys(v): turns a speedup value into a y position (larger speedups sit higher)
          const k = [s('defs', {}, s('clipPath', { id: clipId }, s('rect', { x: L, y: TOP, width: R - L, height: B - TOP })))];  // k starts with a clipping rectangle so curves are cut off at the edges of the plot area
          const st = niceStep(ymax / 5);  // st: the spacing between horizontal grid lines, about five lines up the axis
          for (let v = 0; v <= ymax + 1e-9; v += st) {  // one horizontal grid line and label per step from 0 to the top of the axis
            k.push(s('line', { x1: L, y1: ys(v), x2: R, y2: ys(v), class: 's-muted', style: { strokeWidth: 1 } }));  // a thin gray horizontal grid line
            k.push(s('text', { x: L - 8, y: ys(v) + 5, 'text-anchor': 'end', 'font-size': 13 * FS, class: 's-sub' }, fmt(v, 1)));  // the y-axis number for that grid line, written just left of the plot
          }  // ends the horizontal grid loop
          for (let e = 0; e <= 10; e++) {  // one vertical grid line for each power of two from 1 to 1024 cores
            k.push(s('line', { x1: xs(2 ** e), y1: TOP, x2: xs(2 ** e), y2: B, class: 's-muted', style: { strokeWidth: 1 } }));  // a thin gray vertical grid line
            if (!NW || e % 2 === 0) k.push(s('text', { x: xs(2 ** e), y: B + 18, 'text-anchor': 'middle', 'font-size': 13 * FS, class: 's-sub' }, String(2 ** e)));  // the core count under that line; on phones only every other one, so the numbers do not overlap
          }  // ends the vertical grid loop
          k.push(s('text', { x: (L + R) / 2, y: B + 40, 'text-anchor': 'middle', 'font-size': 14 * FS, 'font-weight': 700 }, 'cores N  (each grid line doubles N)'));  // the x-axis title under the plot, explaining that each grid line doubles N
          k.push(s('text', { x: NW ? 12 : 16, y: (TOP + B) / 2, 'text-anchor': 'middle', 'font-size': 14 * FS, 'font-weight': 700, transform: `rotate(-90 ${NW ? 12 : 16} ${(TOP + B) / 2})` }, 'speedup'));  // the y-axis title "speedup", turned on its side along the left edge
          const g = s('g', { 'clip-path': `url(#${clipId})` });  // g: a group whose drawing is clipped to the plot area, so curves never spill over the axes
          let dI = ''; for (let i = 0; i <= 200; i++) { const n = 2 ** (i / 20); dI += (i ? 'L' : 'M') + xs(n).toFixed(1) + ' ' + ys(n).toFixed(1); }  // builds the ideal line speedup = N (perfect scaling), sampled like the curves
          g.append(s('path', { d: dI, class: 's-line', 'stroke-dasharray': '6 5', style: { stroke: 'var(--ok)' } }));  // draws that ideal line dashed in green
          const labels = [];  // labels collects the "f = ..." name tags for the reference curves, placed after all curves are drawn
          REF.forEach((rf) => {  // for each reference value of f
            if (Math.abs(rf - f) < 0.005) return;  // skips a reference curve that matches the student's own f, since the thick blue curve already shows it
            g.append(s('path', { d: curvePath(rf, ys), class: 's-muted', 'stroke-width': 2 }));  // draws the gray reference curve for this f
            const end = amdahl(rf, 1024);  // end: that curve's speedup at the right edge of the chart (1024 cores)
            if (end <= ymax) labels.push({ x: R - 4, y: ys(end) - 6, t: 'f = ' + rf });  // if the curve ends inside the chart, its label goes at the right edge just above the curve's end
            else { const n = rf / (1 / ymax - (1 - rf)); if (n > 0 && n < 1024) labels.push({ x: Math.min(R - 56 * FS, xs(n) + 6), y: TOP + 14, t: 'f = ' + rf, top: true }); }  // otherwise solves for the core count where the curve leaves the top of the chart and puts the label there
          });  // ends the reference-curve loop
          if (f < 1) {  // a ceiling exists only when some work is serial (f below 1)
            const cap = 1 / (1 - f);  // cap: the ceiling 1/(1 - f), the most speedup any number of cores can give
            if (cap <= ymax) {  // draws the ceiling only if it fits on the chart
              g.append(s('line', { x1: L, y1: ys(cap), x2: R, y2: ys(cap), class: 's-line', 'stroke-dasharray': '3 4', style: { stroke: 'var(--warn)' } }));  // a dotted amber horizontal line at the ceiling
              k.push(s('text', { x: L + 8, y: ys(cap) - 7, 'font-size': 13 * FS, 'font-weight': 800, style: { fill: 'var(--warn)' } }, 'ceiling 1/(1−f) = ' + fmt(cap, 1) + '×'));  // labels the ceiling line with its value, such as "ceiling 1/(1-f) = 10x"
            }  // ends the fits-on-chart check
          }  // ends the ceiling drawing
          g.append(s('path', { d: curvePath(f, ys), class: 's-line', 'stroke-width': 4, style: { stroke: 'var(--cpu)' } }));  // the student's curve for the current f: thick and blue, drawn last so it sits on top
          k.push(g);  // adds the clipped group of lines and curves to the chart
          const shown = [];  // shown remembers where labels have been placed so far
          labels.forEach((lb) => { if (shown.some((o) => Math.abs(lb.y - o.y) < 14 * FS && Math.abs(lb.x - o.x) < 56 * FS)) return; shown.push(lb); k.push(s('text', { x: lb.x, y: lb.y, 'text-anchor': lb.top ? 'start' : 'end', 'font-size': 13.5 * FS, class: 's-sub' }, lb.t)); });  // places each reference label unless it would overlap one already placed
          const sp = amdahl(f, N), px = xs(N), py = ys(Math.min(sp, ymax));  // sp: the speedup at the student's N; px, py: the chart point for it (held at the top edge if off the chart)
          k.push(s('circle', { cx: px, cy: py, r: 7, class: 's-cpu', 'stroke-width': 3 }));  // a blue dot marking the student's current N on their curve
          const right = px > R - (NW ? 130 : 150);  // right is true when the dot is near the right edge, so its label goes on the left instead
          k.push(s('text', { x: right ? px - 12 : px + 12, y: right ? py - 14 : py + 22, 'text-anchor': right ? 'end' : 'start', 'font-size': 15 * FS, 'font-weight': 800, style: { fill: 'var(--cpu)' } }, `N = ${N}: ${fmt(sp, 2)}×`));  // the dot's label, such as "N = 8: 4.71x", placed on whichever side has room
          chart.replaceChildren(...k);  // replaces the old chart with the new shapes in one step
        }  // ends drawChart()
        // ---------- left: controls + readouts + time bars
        const bigS = h('div', { class: 'big num', style: { color: 'var(--cpu)' } });  // the big speedup readout, in blue
        const eff = h('div', { class: 'num b', style: { fontSize: '26px' } });  // the efficiency readout (speedup divided by N, as a percentage)
        const ceil = h('div', { class: 'num b', style: { fontSize: '26px', color: 'var(--warn)' } });  // the ceiling readout, in amber
        const BW = NW ? 380 : 470;  // BW: the width of the small time-bar drawing (smaller on phones)
        const bars = s('svg', { viewBox: `0 0 ${BW} 84`, width: '100%', role: 'img', 'aria-label': 'Time on one core versus time on N cores' });  // the small SVG comparing time on one core with time on N cores
        const insight = h('div', { class: 'callout why small m0', 'data-label': 'What this tells you' });  // an explanation box ("What this tells you") that update() rewrites for the current f and N
        function drawBars() {  // drawBars(): redraws the two time bars for the current f and N
          const X = NW ? 84 : 92, WB = BW - X - 10, k = [];  // X: where the bars start (after their labels); WB: the full bar width standing for the one-core time
          const row = (y, lab, ser, par) => {  // row(): draws one labeled bar made of an amber serial part and a blue parallel part
            k.push(s('text', { x: X - 8, y: y + 19, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 700 }, lab));  // the row's label, right-aligned before the bar
            k.push(s('rect', { x: X, y, width: Math.max(1.5, ser * WB), height: 28, rx: 4, class: 's-warn', 'stroke-width': 1.5 }));  // the amber serial part, never thinner than 1.5 units so it stays visible
            k.push(s('rect', { x: X + ser * WB, y, width: Math.max(1.5, par * WB), height: 28, rx: 4, class: 's-cpu', 'stroke-width': 1.5 }));  // the blue parallel part right after it, also kept at least 1.5 units wide
          };  // ends row()
          row(4, '1 core', 1 - f, f);  // top bar: one core, serial part 1 - f and parallel part f of the full width
          if (f * WB > 120) k.push(s('text', { x: X + (1 - f) * WB + f * WB / 2, y: 23, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, 'parallel ' + fmt(f * 100, 0) + '%'));  // writes "parallel 90%" inside the top bar's blue part if it is wide enough
          if ((1 - f) * WB > 70) k.push(s('text', { x: X + (1 - f) * WB / 2, y: 23, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, 'serial ' + fmt((1 - f) * 100, 0) + '%'));  // writes "serial 10%" inside the top bar's amber part if it is wide enough
          row(44, N + (N === 1 ? ' core' : ' cores'), 1 - f, f / N);  // bottom bar: N cores, the same serial part but the parallel part shrunk to f / N
          const tot = (1 - f) + f / N, lx = X + tot * WB + 6;  // tot: time on N cores as a share of the one-core time; lx: where its label goes, just past the end of the bottom bar
          k.push(s('text', { x: Math.min(lx, BW - 4), y: 64, 'text-anchor': lx > BW - 118 ? 'end' : 'start', 'font-size': 13, 'font-weight': 800 }, fmt(tot * 100, 1) + '% of the time'));  // writes that share, such as "21.3% of the time", flipping to right-aligned when it would run off the edge
          bars.replaceChildren(...k);  // replaces the old bars with the new ones in one step
        }  // ends drawBars()
        const sF = ctx.ui.slider({ label: 'Parallel fraction f', min: 0, max: 1, step: 0.01, value: f, format: (v) => v.toFixed(2), onInput: (v) => { f = v; update(); } });  // slider for the parallel fraction f, from 0 to 1 in steps of 0.01; moving it stores the new f and calls update()
        const toN = (p) => Math.max(1, Math.round(2 ** (p / 10)));  // toN(p): turns a slider position 0-100 into a core count on a doubling scale (0 gives 1 core, 100 gives 1024)
        const sN = ctx.ui.slider({ label: 'Cores N', min: 0, max: 100, step: 1, value: 30, format: (p) => String(toN(p)), onInput: (p) => { N = toN(p); update(); } });  // slider for the number of cores; it starts at position 30, which is 8 cores, and shows the core count, not the position
        const setN = (n) => { N = n; sN.input.value = Math.round(10 * Math.log2(n)); update(); };  // setN(n): jumps to exactly n cores and moves the slider knob to the matching position; used by the quick buttons
        const quick = h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b' }, 'Jump to N ='),  // a row of quick-jump buttons, starting with its "Jump to N =" label
          ...[2, 4, 8, 16, 64].map((n) => h('button', { class: 'btn sm', type: 'button', onclick: () => setN(n) }, String(n))),  // one small button each for 2, 4, 8, 16 and 64 cores
          h('button', { class: 'btn sm primary', type: 'button', onclick: () => setN(1000) }, 'What if N = 1000?'));  // a highlighted button that jumps to 1000 cores to show how little is gained beyond the ceiling
        function update() {  // update(): refreshes every readout and both drawings; runs at start and after every slider move or jump
          const sp = amdahl(f, N);  // sp: the speedup for the current f and N
          sN.querySelector('output').textContent = String(N);  // writes the exact N next to the cores slider (the slider's own label would round 1000 to 1024)
          bigS.textContent = fmt(sp, 2) + '×';  // shows the speedup in the big blue readout
          const e = (sp / N) * 100; eff.textContent = (e < 10 ? fmt(e, 1) : Math.round(e)) + '%';  // e: parallel efficiency as a percentage; shown with one decimal place when below 10%
          ceil.textContent = f >= 1 ? 'none' : fmt(1 / (1 - f), 1) + '×';  // shows the ceiling 1/(1 - f), or "none" when f = 1 and there is no serial part
          if (f >= 1) insight.innerHTML = 'With f = 1 there is no serial part, so the speedup equals N: perfect scaling. Real programs always have some serial work (starting up, combining results), so this is the dream case.';  // f = 1: explains perfect scaling and why real programs never quite reach it
          else if (f <= 0) insight.innerHTML = 'With f = 0 nothing can be shared, so extra cores do nothing at all: the speedup stays 1×.';  // f = 0: explains that nothing can be shared, so the speedup stays at 1
          else {  // any f between 0 and 1: the usual explanation
            const cap = 1 / (1 - f);  // cap: the ceiling for this f
            const pc = (sp / cap) * 100;  // pc: how much of the ceiling the current N reaches, as a percentage
            insight.innerHTML = `You reach <b>${pc > 99 ? fmt(pc, 1) : Math.round(pc)}%</b> of the ceiling.` + (N < 1000 ? ` Even 1000 cores would give only ${fmt(amdahl(f, 1000), 2)}×.` : ' No number of extra cores can take you past it.') + ` Halve the serial part (${fmt((1 - f) * 100, 1)}% → ${fmt((1 - f) * 50, 1)}%) and the ceiling doubles to ${fmt(2 * cap, 1)}×.`;  // writes the share of the ceiling reached, the speedup 1000 cores would give, and how halving the serial part doubles the ceiling
          }  // ends the choice of explanation
          drawBars(); drawChart();  // redraws the time bars and the chart with the new settings
        }  // ends update()
        const stat = (lab, node) => h('div', {}, h('div', { class: 'xs muted b' }, lab), node);  // stat(): builds a readout with a small gray label above the value element
        const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the lab's controls and readouts stacked vertically
          h('p', { class: 'small m0', html: 'Reminder: <span class="t">Amdahl\'s law</span> predicts speedup = 1 / ((1 − f) + f / N) on N cores, where f is the share of the one-core running time that can run in parallel. Move the sliders; the chart shows the whole curve for your f (thick blue) next to other values of f (grey).' }),  // a reminder of Amdahl's law and of what the thick blue and gray curves mean
          sF, sN, quick,  // the f slider, the N slider and the quick-jump buttons
          h('div', { class: 'row', style: { gap: '26px', alignItems: 'flex-end' } }, stat('SPEEDUP', bigS), stat('EFFICIENCY', eff), stat('CEILING (N → ∞)', ceil)),  // the row of three readouts: speedup, efficiency and ceiling
          h('div', { class: 'card white tight' }, bars),  // the time-bar drawing in a white card
          insight);  // the explanation box; closes the left column
        update();  // fills in every readout and drawing once so the lab starts filled in
        const key = (sw, lab) => h('span', { class: 'row', style: { gap: '6px' } }, h('span', { style: Object.assign({ display: 'inline-block', width: '26px', height: 0 }, sw) }), h('span', { class: 'xs b' }, lab));  // key(): builds one legend entry, a short line sample in a given style next to its label
        const legend = h('div', { class: 'row', style: { gap: '16px', justifyContent: 'center' } },  // the legend under the chart, centered
          key({ borderTop: '4px solid var(--cpu)' }, 'your f'), key({ borderTop: '2px solid var(--line-2)' }, 'other values of f'),  // legend entries for the student's curve (thick blue) and the other values of f (thin gray)
          key({ borderTop: '2px dashed var(--ok)' }, 'ideal: speedup = N'), key({ borderTop: '2px dotted var(--warn)' }, 'ceiling 1/(1 − f)'));  // legend entries for the ideal dashed line and the dotted ceiling line
        el.append(h('div', { class: 'split l fill' }, left, h('div', { class: 'card white tight stack', style: { gap: '4px', justifyContent: 'center' } }, chart, legend)));  // places the controls on the left and the chart with its legend on the right (stacked on phones)
      },  // ends render() for step 3
    },  // ends step 3

    /* ---------------- 4. Predict-then-check number puzzles ---------------- */
    {  // step 4 begins: eight predict-then-check number puzzles
      title: 'Predict, then check: eight speedup puzzles',  // step 4 title
      kind: 'predict',  // kind 'predict' labels this as a Predict step
      render(el, ctx) {  // render(el, ctx) builds step 4 when the student arrives on it
        const { h, s } = ctx; const fmt = ctx.util.fmt;  // takes the element builders and the number formatter from ctx
        const amdahl = (f, n) => 1 / ((1 - f) + f / n);  // amdahl(f, n): the same Amdahl's law formula, used here to compute the correct answers
        const C = [  // C: the eight puzzles; kind says what is asked (speedup, time, ceiling or reverse), q is the question, work the worked answer
          { kind: 'speedup', f: 0.9, n: 8, q: 'A photo filter can run 90% of its work in parallel. What speedup do <b>8 cores</b> give?',  // puzzle 1 (speedup): a photo filter, 90% parallel, on 8 cores
            work: ['1 − f = 0.1 and f / N = 0.9 / 8 = 0.1125', 'Speedup = 1 / (0.1 + 0.1125) = 1 / 0.2125', '= <b>4.71×</b>'],  // worked answer for puzzle 1, three lines ending at 4.71 times
            lesson: 'On 8 cores the serial 10% fills almost half of the remaining running time (0.1 out of 0.2125), so eight cores give under five times the speed.' },  // lesson for puzzle 1: the serial 10% takes almost half of the remaining time
          { kind: 'speedup', f: 0.95, n: 16, q: 'A video encoder spends 95% of its time on frames that any core can encode. What speedup will <b>16 cores</b> give?',  // puzzle 2 (speedup): a video encoder, 95% parallel, on 16 cores
            work: ['1 − f = 0.05 and f / N = 0.95 / 16 = 0.059375', 'Speedup = 1 / (0.05 + 0.059375) = 1 / 0.109375', '= <b>9.14×</b>'],  // worked answer for puzzle 2, ending at 9.14 times
            lesson: 'Sixteen cores, yet only about 9 times faster: the 5% serial part now costs almost as much time as the whole parallel part.' },  // lesson for puzzle 2: the 5% serial part costs almost as much as all the parallel work
          { kind: 'speedup', f: 0.5, n: 1000, q: 'Half of a report generator is serial. What speedup do <b>1000 cores</b> give?',  // puzzle 3 (speedup): a half-serial report generator on 1000 cores
            work: ['1 − f = 0.5 and f / N = 0.5 / 1000 = 0.0005', 'Speedup = 1 / 0.5005', '= <b>2.00×</b> (1.998)'],  // worked answer for puzzle 3, ending at just under 2 times
            lesson: 'A thousand cores cannot even double the speed of a half-serial program; its ceiling is 1 / 0.5 = 2×.' },  // lesson for puzzle 3: a half-serial program can never even double its speed
          { kind: 'speedup', f: 0.99, n: 100, q: 'A weather simulation is 99% parallel. What speedup do <b>100 cores</b> give?',  // puzzle 4 (speedup): a weather simulation, 99% parallel, on 100 cores
            work: ['1 − f = 0.01 and f / N = 0.99 / 100 = 0.0099', 'Speedup = 1 / (0.01 + 0.0099) = 1 / 0.0199', '= <b>50.25×</b>'],  // worked answer for puzzle 4, ending at 50.25 times
            lesson: 'Even at 99% parallel, 100 cores deliver only half of the ideal 100×. At large N, a 1% serial part is a big deal.' },  // lesson for puzzle 4: at large N even a 1% serial part halves the ideal speedup
          { kind: 'speedup', f: 0.75, n: 4, q: 'A build tool compiles files in parallel, but 25% of its time is serial linking. What speedup do <b>4 cores</b> give?',  // puzzle 5 (speedup): a build tool with 25% serial linking, on 4 cores
            work: ['1 − f = 0.25 and f / N = 0.75 / 4 = 0.1875', 'Speedup = 1 / (0.25 + 0.1875) = 1 / 0.4375', '= <b>2.29×</b>'],  // worked answer for puzzle 5, ending at 2.29 times
            lesson: 'Efficiency is 2.29 / 4 = 57%, so over 40% of the 4-core chip is wasted by a quarter of serial work.' },  // lesson for puzzle 5: 57% efficiency, so over 40% of the chip is wasted
          { kind: 'time', unit: 's', ans: 30 + 170 / 8, q: 'A job takes <b>200 s</b> on one core, and <b>30 s</b> of that is serial. How many seconds does it take on <b>8 cores</b>?',  // puzzle 6 (time): a 200 s job with 30 s serial, on 8 cores; the answer 51.25 s is computed right here
            work: ['Serial part: 30 s (it cannot shrink)', 'Parallel part: 200 − 30 = 170 s, split 8 ways = 21.25 s', 'Total = 30 + 21.25 = <b>51.25 s</b> (speedup 200 / 51.25 = 3.90×)'],  // worked answer for puzzle 6: keep the 30 s, split the 170 s eight ways, add them
            lesson: 'The law works in seconds too: keep the serial time as it is and divide only the parallel time by N.' },  // lesson for puzzle 6: the law works in seconds as well as in fractions
          { kind: 'ceiling', f: 0.8, q: 'A program is 80% parallel. With an <b>unlimited</b> number of cores, what is the best speedup it can ever reach?',  // puzzle 7 (ceiling): the best possible speedup of an 80% parallel program
            work: ['With unlimited cores, f / N shrinks to 0', 'Speedup → 1 / (1 − f) = 1 / 0.2', '= <b>5×</b>'],  // worked answer for puzzle 7: with f / N at 0 the speedup tends to 5 times
            lesson: 'The ceiling depends only on the serial fraction: 20% serial means never more than 5×, whatever the hardware.' },  // lesson for puzzle 7: the ceiling depends only on the serial fraction
          { kind: 'reverse', ans: 0.875 / 0.9375, q: 'Your manager wants an <b>8×</b> speedup on <b>16 cores</b>. What is the smallest parallel fraction f that can deliver it? (Answer as a decimal, such as 0.8.)',  // puzzle 8 (reverse): the smallest f that gives 8 times on 16 cores; the answer 0.933 is computed here
            work: ['Need 1 / ((1 − f) + f / 16) = 8, so (1 − f) + f / 16 = 1 / 8 = 0.125', 'Rearrange: 1 − f × (15/16) = 0.125, so f × 0.9375 = 0.875', 'f = 0.875 / 0.9375 = <b>0.933</b> (93.3% parallel)'],  // worked answer for puzzle 8: set the formula equal to 8 and solve for f
            lesson: 'Just half the ideal speedup on 16 cores already demands that over 93% of the work be parallel. With f = 0.90 you would get only 1 / (0.1 + 0.05625) = 6.4×.' },  // lesson for puzzle 8: even half the ideal speedup needs over 93% parallel work
        ];  // closes the puzzle list
        C.forEach((c) => { if (c.kind === 'speedup') { c.ans = amdahl(c.f, c.n); c.unit = '×'; } if (c.kind === 'ceiling') { c.ans = 1 / (1 - c.f); c.unit = '×'; } if (c.kind === 'reverse') c.unit = ''; });  // fills in each puzzle's correct answer and unit: speedup and ceiling answers come from the formula, reverse answers have no unit
        const state = C.map(() => ({ guess: '', res: null }));  // state: the student's typed guess and result (ok, warn, bad or none yet) for each puzzle, kept while they move between puzzles
        let cur = 0;  // cur: which puzzle is showing (0 is the first)
        const pills = h('div', { class: 'row', style: { gap: '5px' } });  // the row of numbered puzzle buttons
        const counter = h('div', { class: 'xs muted b' });  // the "PUZZLE n OF 8" label
        const qText = h('p', { class: 'lead m0' });  // the question text, in large type
        const chips = h('div', { class: 'row', style: { gap: '6px' } });  // chips showing the puzzle's given values, such as f and N
        const input = h('input', { type: 'number', step: 'any', class: 'p43-in', 'aria-label': 'Your prediction' });  // the number box where the student types a prediction, styled by the section's .p43-in rule
        const unit = h('span', { class: 'b' });  // the unit shown after the box ("times faster", "seconds" or "(fraction)")
        const score = h('div', { class: 'small muted' });  // a running score line under the buttons
        const out = h('div', { class: 'stack', style: { gap: '10px' } });  // the right-hand area, rebuilt by renderOut() with the tip or the worked answer
        const bCheck = h('button', { class: 'btn primary', type: 'button', onclick: () => check() }, 'Check my prediction');  // the Check button grades the typed prediction
        const bPrev = h('button', { class: 'btn', type: 'button', onclick: () => show(cur - 1) }, '← Previous');  // the Previous button moves to the previous puzzle
        const bNext = h('button', { class: 'btn', type: 'button', onclick: () => show(cur + 1) }, 'Next →');  // the Next button moves to the next puzzle
        ctx.on(input, 'keydown', (e) => { if (e.key === 'Enter') check(); });  // pressing Enter in the number box also checks the prediction
        ctx.on(input, 'input', () => { state[cur].guess = input.value; });  // saves what the student types for the current puzzle as they type it
        // a fraction near 1 is graded on absolute distance: 0.90 instead of 0.933 is a big miss (it only gives 6.4×)
        const grade = (c, g) => { if (c.kind === 'reverse') { const d = Math.abs(g - c.ans); return d <= 0.005 ? 'ok' : d <= 0.02 ? 'warn' : 'bad'; } const rel = Math.abs(g - c.ans) / c.ans; return rel <= 0.03 ? 'ok' : rel <= 0.15 ? 'warn' : 'bad'; };  // grade(c, g): rates guess g as ok, warn or bad; reverse puzzles use absolute distance, others use percent error (3% and 15% limits)
        const NW = ctx.narrow, VW = NW ? 380 : 600;   // phones: narrower drawings so the labels stay legible
        function numberLine(c, g) {  // numberLine(c, g): draws a number line showing the student's guess, the answer and (for speedup puzzles) the ceiling
          const svg = s('svg', { viewBox: `0 0 ${VW} 100`, width: '100%', role: 'img', 'aria-label': 'Your guess compared with the answer' });  // the number-line SVG, described for screen readers
          const cap = c.kind === 'speedup' ? 1 / (1 - c.f) : null;  // cap: the ceiling 1/(1 - f), but only for speedup puzzles
          const max = c.kind === 'reverse' ? 1 : Math.max(g, c.ans, cap && cap < c.ans * 2.5 ? cap : 0) * 1.2;  // max: the right end of the line, 1 for fractions, otherwise a bit beyond the largest of guess, answer and a nearby ceiling
          const X0 = NW ? 18 : 24, X1 = VW - X0, LY = 54, xs = (v) => X0 + Math.min(1, Math.max(0, v / max)) * (X1 - X0);  // the line's ends X0 and X1, its height LY, and xs(v), which turns a value into an x position clamped to the line
          const anchor = (x) => (x > VW - (NW ? 70 : 100) ? 'end' : x < (NW ? 70 : 100) ? 'start' : 'middle');  // anchor(x): chooses left, right or centered text alignment so labels near either edge stay inside the drawing
          const k = [s('line', { x1: X0, y1: LY, x2: X1, y2: LY, class: 's-line' })];  // k starts with the number line itself
          for (let i = 0; i <= 4; i++) { const v = max * i / 4; k.push(s('line', { x1: xs(v), y1: LY - 4, x2: xs(v), y2: LY + 4, class: 's-line' })); k.push(s('text', { x: xs(v), y: 97, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, fmt(v, c.kind === 'reverse' ? 2 : 1))); }  // five evenly spaced tick marks with their values (two decimals for fractions, one otherwise)
          if (cap && cap <= max) { k.push(s('line', { x1: xs(cap), y1: LY - 12, x2: xs(cap), y2: LY + 8, class: 's-line', 'stroke-dasharray': '3 3', style: { stroke: 'var(--warn)' } })); k.push(s('text', { x: xs(cap), y: 13, 'text-anchor': anchor(xs(cap)), 'font-size': 12.5, 'font-weight': 700, style: { fill: 'var(--warn)' } }, 'ceiling ' + fmt(cap, 1))); }  // for speedup puzzles, a dashed amber mark labeled with the ceiling, if the ceiling fits on the line
          k.push(s('circle', { cx: xs(g), cy: LY, r: 7, class: 's-cpu', 'stroke-width': 3 }));  // a blue dot on the line at the student's guess
          k.push(s('text', { x: xs(g), y: 34, 'text-anchor': anchor(xs(g)), 'font-size': 13.5, 'font-weight': 800, style: { fill: 'var(--cpu)' } }, '▼ you ' + fmt(g, 3)));  // the label "you" with the guess above the blue dot
          k.push(s('circle', { cx: xs(c.ans), cy: LY, r: 5, style: { fill: 'var(--ok)', stroke: 'none' } }));  // a smaller green dot at the correct answer
          k.push(s('text', { x: xs(c.ans), y: 78, 'text-anchor': anchor(xs(c.ans)), 'font-size': 13.5, 'font-weight': 800, style: { fill: 'var(--ok)' } }, '▲ answer ' + fmt(c.ans, c.kind === 'reverse' ? 3 : 2)));  // the label "answer" with the correct value below the green dot
          svg.replaceChildren(...k);  // puts all the shapes into the number-line SVG
          return svg;  // gives the finished number line back to renderOut()
        }  // ends numberLine()
        // one-core vs N-core bar picture of the puzzle (the N-core bar is a "?" until checked)
        function picture(c, solved) {  // picture(c, solved): draws the job as a one-core bar and an N-core bar; before checking, the N-core bar is a "?"
          const svg = s('svg', { viewBox: `0 0 ${VW} 78`, width: '100%', role: 'img', 'aria-label': 'Serial and parallel parts of the job' });  // the bar-picture SVG, described for screen readers
          const X = NW ? 80 : 96, WB = VW - X - (NW ? 8 : 24), k = [];  // X: where the bars start after their labels; WB: the full bar width; k collects the shapes
          const ser = c.kind === 'time' ? 30 / 200 : c.kind === 'reverse' ? (solved ? 1 - c.ans : null) : 1 - c.f;  // ser: the serial share of the job; unknown (null) for the reverse puzzle until it is solved, because f is the answer
          const n = c.kind === 'speedup' ? c.n : c.kind === 'time' ? 8 : c.kind === 'reverse' ? 16 : Infinity;  // n: how many cores the bottom bar stands for (8 for the time puzzle, 16 for the reverse one, infinity for the ceiling one)
          const row = (y, lab) => k.push(s('text', { x: X - 10, y: y + 19, 'text-anchor': 'end', 'font-size': NW ? 13 : 13.5, 'font-weight': 700 }, lab));  // row(): writes a bar's label to the left of it
          row(4, '1 core'); row(44, n === Infinity ? '∞ cores' : n + ' cores');  // labels the two bars "1 core" and "n cores"
          if (ser == null) {  // when the serial share is still unknown
            k.push(s('rect', { x: X, y: 4, width: WB, height: 28, rx: 4, class: 's-panel', 'stroke-width': 1.5 }));  // draws the one-core bar as a plain gray box
            k.push(s('text', { x: X + WB / 2, y: 23, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, NW ? 'serial ? + parallel ? (find f)' : 'serial ? + parallel ?  (that is what you must find)'));  // writes inside it that the serial and parallel parts are what the student must find
          } else {  // otherwise the split is known
            k.push(s('rect', { x: X, y: 4, width: ser * WB, height: 28, rx: 4, class: 's-warn', 'stroke-width': 1.5 }));  // the amber serial part of the one-core bar
            k.push(s('rect', { x: X + ser * WB, y: 4, width: (1 - ser) * WB, height: 28, rx: 4, class: 's-cpu', 'stroke-width': 1.5 }));  // the blue parallel part of the one-core bar
            k.push(s('text', { x: X + ser * WB + (1 - ser) * WB / 2, y: 23, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, 'parallel ' + fmt((1 - ser) * 100, 1) + '%'));  // writes the parallel percentage inside the blue part
          }  // ends the one-core bar
          if (solved && ser != null) {  // once the prediction has been checked and the split is known, the N-core bar can be drawn
            const par = n === Infinity ? 0 : (1 - ser) / n;  // par: the parallel part's share after splitting across n cores (nothing left with unlimited cores)
            k.push(s('rect', { x: X, y: 44, width: ser * WB, height: 28, rx: 4, class: 's-warn', 'stroke-width': 1.5 }));  // the N-core bar's amber serial part, the same length as before
            k.push(s('rect', { x: X + ser * WB, y: 44, width: Math.max(2, par * WB), height: 28, rx: 4, class: 's-cpu', 'stroke-width': 1.5 }));  // the N-core bar's shrunken blue parallel part, at least 2 units wide
            k.push(s('text', { x: X + (ser + par) * WB + 8, y: 63, 'font-size': 13, 'font-weight': 800 }, fmt((ser + par) * 100, 1) + (NW ? '% of 1-core time' : '% of the one-core time')));  // writes what share of the one-core time the N-core run takes, just past the end of the bar
          } else {  // before checking, the N-core bar stays hidden
            k.push(s('rect', { x: X, y: 44, width: WB, height: 28, rx: 4, class: 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));  // a dashed gray empty box in place of the N-core bar
            k.push(s('text', { x: X + WB / 2, y: 63, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: 's-sub' }, '?'));  // a "?" in the middle of that box
          }  // ends the N-core bar
          svg.replaceChildren(...k);  // puts the shapes into the SVG
          return h('div', { class: 'card white tight' }, svg);  // returns the drawing wrapped in a white card
        }  // ends picture()
        function renderOut() {  // renderOut(): fills the right-hand area, a tip before checking or the full worked answer after it
          const c = C[cur], st = state[cur];  // c: the current puzzle; st: the student's saved guess and result for it
          if (!st.res) {  // not yet checked: show guidance instead of the answer
            const tip = c.kind === 'time' ? 'Keep the serial seconds, divide only the parallel seconds by N, then add.'  // tip for the time puzzle: keep the serial seconds, divide only the parallel seconds
              : c.kind === 'reverse' ? 'Set the formula equal to the target speedup and solve for f. The answer is between 0 and 1. Near 1, small changes in f matter a lot, so only answers within ±0.005 count as spot on here.'  // tip for the reverse puzzle: set the formula equal to the target and solve, and why the tolerance is tight
                : c.kind === 'ceiling' ? 'Unlimited cores means f / N becomes 0. What is left in the formula?'  // tip for the ceiling puzzle: with unlimited cores f / N becomes 0
                  : `Sanity check before you type: the answer must be below N = ${c.n} and below the ceiling 1 / (1 − f) = ${fmt(1 / (1 - c.f), 1)}.`;  // tip for speedup puzzles: a sanity check that the answer must be below both N and the ceiling
            out.replaceChildren(  // replaces the right-hand area with three pieces
              h('div', { class: 'card', html: '<h4>Your move</h4><p class="m0">Commit to a number first, even a rough one. Guessing before calculating is what trains your intuition. The worked answer will appear here.</p>' }),  // a "Your move" card urging the student to commit to a guess before calculating
              h('div', {}, h('h4', {}, 'Picture it'), picture(c, false)),  // the unsolved bar picture under the heading "Picture it"
              h('div', { class: 'callout tip m0', 'data-label': 'Tip' }, tip));  // the tip box chosen above
            return;  // stops here, since there is no result to show yet
          }  // ends the not-yet-checked case
          const verdict = { ok: ['Spot on!', 'ok'], warn: ['Close.', 'warn'], bad: ['Not quite.', 'bad'] }[st.res];  // verdict: the heading text and color for the result, such as "Close." in amber
          const g = parseFloat(st.guess);  // g: the student's guess as a number
          out.replaceChildren(  // replaces the right-hand area with the result
            h('div', { class: 'row', style: { gap: '10px', alignItems: 'baseline' } }, h('span', { class: 'b', style: { fontSize: '22px', color: `var(--${verdict[1]})` } }, verdict[0]),  // a row with the verdict in large colored type
              h('span', { class: 'small muted' }, `You said ${fmt(g, 3)}${c.unit}; the answer is ${fmt(c.ans, c.kind === 'reverse' ? 3 : 2)}${c.unit} (${fmt(Math.abs(g - c.ans) / c.ans * 100, 1)}% away).`)),  // a line comparing the guess with the answer and giving the percent difference
            h('div', { class: 'card white tight' }, numberLine(c, g)),  // the number line with the guess, the answer and the ceiling
            h('div', { class: 'card tight stack', style: { gap: '3px' } }, h('h4', { class: 'm0' }, 'Worked answer'), ...c.work.map((w, i) => h('div', { class: 'mono small', html: (i + 1) + '. ' + w }))),  // the numbered worked-answer lines in a card
            picture(c, true),  // the bar picture, now with the N-core bar drawn in
            h('div', { class: 'callout why m0 small', 'data-label': 'The lesson' }, c.lesson));  // the lesson for this puzzle in a "The lesson" box; closes the result
        }  // ends renderOut()
        function check() {  // check(): grades the student's prediction; runs on the Check button or the Enter key
          const c = C[cur], raw = parseFloat(input.value);  // c: the current puzzle; raw: the number typed in the box
          if (!isFinite(raw)) { ctx.toast('Type a number first.'); input.focus(); return; }  // if the box is empty or not a number, shows a short pop-up message and puts the cursor back in the box
          let g = raw;  // g: the guess to grade, possibly adjusted on the next line
          if (c.kind === 'reverse' && g > 1 && g <= 100) g = g / 100;   // accept "93.3" meaning 93.3%
          state[cur].guess = String(g);  // stores the guess for this puzzle
          state[cur].res = grade(c, g);  // grades it and stores the result (ok, warn or bad)
          paint();  // redraws the step to show the result
        }  // ends check()
        function paint() {  // paint(): redraws the left panel for the current puzzle and then the right-hand area
          const c = C[cur], st = state[cur];  // c: the current puzzle; st: its saved state
          counter.textContent = `PUZZLE ${cur + 1} OF ${C.length}`;  // updates the "PUZZLE n OF 8" label
          qText.innerHTML = c.q;  // shows the question text
          chips.replaceChildren(...(c.kind === 'speedup' ? [h('span', { class: 'chip cpu' }, 'f = ' + c.f), h('span', { class: 'chip' }, 'N = ' + c.n)]  // chips for speedup puzzles show f and N
            : c.kind === 'ceiling' ? [h('span', { class: 'chip cpu' }, 'f = ' + c.f), h('span', { class: 'chip' }, 'N → ∞')]  // chips for the ceiling puzzle show f and N tending to infinity
              : c.kind === 'time' ? [h('span', { class: 'chip warn' }, '30 s serial'), h('span', { class: 'chip cpu' }, '170 s parallel'), h('span', { class: 'chip' }, 'N = 8')]  // chips for the time puzzle show the 30 s serial, 170 s parallel and N = 8
                : [h('span', { class: 'chip ok' }, 'target 8×'), h('span', { class: 'chip' }, 'N = 16')]));  // chips for the reverse puzzle show the 8 times target and N = 16
          input.value = st.guess;  // puts back whatever the student had typed for this puzzle
          unit.textContent = c.unit === '×' ? '× faster' : c.unit === 's' ? 'seconds' : '(fraction)';  // shows the unit words after the box to match the kind of answer
          bPrev.disabled = cur === 0; bNext.disabled = cur === C.length - 1;  // disables Previous on the first puzzle and Next on the last
          pills.replaceChildren(...C.map((_, i) => h('button', { type: 'button', class: 'pp ' + (state[i].res || '') + (i === cur ? ' on' : ''), onclick: () => show(i), 'aria-label': 'Puzzle ' + (i + 1) }, String(i + 1))));  // rebuilds the numbered buttons, colored by each puzzle's result and ringed for the current one
          const done = state.filter((x) => x.res).length, good = state.filter((x) => x.res === 'ok').length;  // done: how many puzzles have been checked; good: how many were spot on
          score.textContent = done ? `${good} of ${done} answered spot on (within 3%).` : 'Within 3% counts as spot on; within 15% counts as close.';  // shows the score, or explains the 3% and 15% limits before anything is checked
          renderOut();  // redraws the right-hand area
        }  // ends paint()
        function show(i) { cur = ctx.util.clamp(i, 0, C.length - 1); paint(); }  // show(i): moves to puzzle i (kept within 1 to 8) and repaints
        const left = h('div', { class: 'card stack', style: { gap: '12px' } },  // left panel: a card holding the puzzle, the input and the buttons
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, counter, pills),  // top row: the puzzle counter on the left, the numbered buttons on the right
          qText, chips,  // the question and its chips
          h('div', { class: 'row' }, h('span', { class: 'b' }, 'My prediction:'), input, unit),  // the "My prediction:" row with the number box and its unit
          h('div', { class: 'row' }, bCheck, bPrev, bNext),  // the Check, Previous and Next buttons
          score);  // the score line; closes the left panel
        const tool = h('div', { class: 'card cpu' }, h('h4', {}, 'The tool'), h('div', { class: 'mono b', style: { fontSize: '18px' } }, 'Speedup = 1 / ((1 − f) + f / N)'),  // a blue card with the formula under "The tool"
          h('p', { class: 'small m0 mt' }, 'Time on N cores, as a share of the one-core time, is (1 − f) + f / N. Speedup is 1 divided by that share.'));  // a short reminder of what the formula's bottom half means; closes the tool card
        el.append(h('div', { class: 'split l fill' }, h('div', { class: 'stack' }, left, tool), out));  // places the puzzle and tool on the left and the answer area on the right (stacked on phones)
        paint();  // draws the first puzzle so the step opens ready to use
      },  // ends render() for step 4
    },  // ends step 4

    /* ---------------- 5. Overhead: when more cores make it slower ---------------- */
    {  // step 5 begins: what overhead does to speedup in real software
      title: 'Real software: when more cores make it slower',  // step 5 title
      kind: 'explore',  // kind 'explore' labels this as an Explore step
      render(el, ctx) {  // render(el, ctx) builds step 5 when the student arrives on it
        const { h, s } = ctx; const fmt = ctx.util.fmt;  // takes the element builders and the number formatter from ctx
        let f = 0.9, c = 0.01;  // the current settings: parallel fraction f = 0.9 and overhead c = 1% of the one-core time for each extra core
        const ideal = (n) => 1 / ((1 - f) + f / n);  // ideal(n): pure Amdahl's law speedup on n cores, with no overhead
        const real = (n) => 1 / ((1 - f) + f / n + c * (n - 1));  // real(n): the same formula with an overhead term c for every core beyond the first added to the running time
        const NW = ctx.narrow, FS = NW ? 1.1 : 1;   // phones: narrower chart geometry so the labels stay legible
        const W = NW ? 380 : 660, H = NW ? 330 : 434, L = NW ? 50 : 56, R = NW ? 366 : 640, TOP = 10, B = NW ? 282 : 386;  // chart size and edges: W and H are the drawing size, L and R the plot's left and right edges, TOP and B its top and bottom
        const chart = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Ideal and real speedup versus number of cores' });  // the SVG chart comparing ideal and real speedup
        const xs = (n) => L + ((n - 1) / 63) * (R - L);  // xs(n): turns a core count from 1 to 64 into an x position on an ordinary (evenly spaced) scale
        const niceUp = (v) => { const p = 10 ** Math.floor(Math.log10(v)); for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p; return 10 * p; };  // niceUp(v): rounds v up to a tidy number for the top of the y axis
        const peakN = () => { let best = 1; for (let n = 2; n <= 64; n++) if (real(n) > real(best) + 1e-12) best = n; return best; };  // peakN(): tries every core count from 1 to 64 and returns the first one with the highest real speedup
        const bigPeak = h('div', { class: 'num b', style: { fontSize: '26px', color: 'var(--ok)' } });  // readout for the best speedup and the core count where it happens, in green
        const big64 = h('div', { class: 'num b', style: { fontSize: '26px', color: 'var(--bad)' } });  // readout for the real speedup at 64 cores, in red when it is past the peak
        const bigIdeal = h('div', { class: 'num b', style: { fontSize: '26px', color: 'var(--cpu)' } });  // readout for what Amdahl's law alone would promise at 64 cores, in blue
        const say = h('div', { class: 'callout warn small m0', 'data-label': 'What you see' });  // an explanation box ("What you see") that draw() rewrites for the current settings
        function draw() {  // draw(): redraws the chart, readouts and explanation; runs at start and whenever a slider or preset changes
          const ymax = niceUp(Math.max(2, ideal(64) * 1.1));  // ymax: the top of the y axis, a tidy value above the ideal speedup at 64 cores
          const ys = (v) => B - (v / ymax) * (B - TOP);  // ys(v): turns a speedup into a y position
          const pk = peakN(), k = [];  // pk: the core count with the best real speedup; k collects the new shapes
          const tie = pk < 64 && Math.abs(real(pk + 1) - real(pk)) < 1e-9;   // e.g. f = 0.9, 1%: 9 and 10 cores give exactly the same speedup
          const pkLab = tie ? `${pk}–${pk + 1}` : String(pk);  // pkLab: the peak written as a range such as "9-10" when two core counts tie, otherwise a single number
          if (pk < 64) {  // shades the region past the peak only if the peak comes before 64 cores
            k.push(s('rect', { x: xs(pk), y: TOP, width: R - xs(pk), height: B - TOP, style: { fill: 'var(--bad-bg)', stroke: 'none' } }));  // a pale red rectangle covering every core count beyond the peak
            k.push(s('text', { x: R - 8, y: B - 12, 'text-anchor': 'end', 'font-size': 13.5 * FS, 'font-weight': 800, style: { fill: 'var(--bad)' } }, NW ? 'past the peak: slower' : 'past the peak: extra cores no longer pay off'));  // a red label in that region saying extra cores no longer pay off
          }  // ends the shading
          const step = ymax / 5;  // step: the spacing between the six horizontal grid lines
          for (let i = 0; i <= 5; i++) { const v = step * i; k.push(s('line', { x1: L, y1: ys(v), x2: R, y2: ys(v), class: 's-muted', style: { strokeWidth: 1 } })); k.push(s('text', { x: L - 8, y: ys(v) + 5, 'text-anchor': 'end', 'font-size': 13 * FS, class: 's-sub' }, fmt(v, 1))); }  // draws each horizontal grid line with its speedup value at the left
          (NW ? [1, 16, 32, 48, 64] : [1, 8, 16, 24, 32, 40, 48, 56, 64]).forEach((n) => { k.push(s('line', { x1: xs(n), y1: TOP, x2: xs(n), y2: B, class: 's-muted', style: { strokeWidth: 1 } })); k.push(s('text', { x: xs(n), y: B + 18, 'text-anchor': 'middle', 'font-size': 13 * FS, class: 's-sub' }, String(n))); });  // draws vertical grid lines with core-count labels (fewer on phones so they do not crowd)
          k.push(s('text', { x: (L + R) / 2, y: B + 42, 'text-anchor': 'middle', 'font-size': 14 * FS, 'font-weight': 700 }, 'cores N'));  // the x-axis title "cores N"
          k.push(s('text', { x: NW ? 12 : 16, y: (TOP + B) / 2, 'text-anchor': 'middle', 'font-size': 14 * FS, 'font-weight': 700, transform: `rotate(-90 ${NW ? 12 : 16} ${(TOP + B) / 2})` }, 'speedup'));  // the y-axis title "speedup", turned on its side
          let dI = '', dR = '';  // dI and dR will hold the path text for the ideal and the real curves
          for (let n = 1; n <= 64; n += 0.5) { dI += (n === 1 ? 'M' : 'L') + xs(n).toFixed(1) + ' ' + ys(ideal(n)).toFixed(1); dR += (n === 1 ? 'M' : 'L') + xs(n).toFixed(1) + ' ' + ys(real(n)).toFixed(1); }  // samples both curves every half core from 1 to 64, adding one path segment per sample
          k.push(s('path', { d: dI, class: 's-line', 'stroke-width': 3, 'stroke-dasharray': '7 5', style: { stroke: 'var(--cpu)' } }));  // draws the ideal Amdahl curve dashed in blue
          k.push(s('path', { d: dR, class: 's-line', 'stroke-width': 4, style: { stroke: 'var(--ink)' } }));  // draws the real curve with overhead as a thick dark line
          k.push(s('text', { x: xs(64) - 6, y: ys(ideal(64)) - 10, 'text-anchor': 'end', 'font-size': 13.5 * FS, 'font-weight': 800, style: { fill: 'var(--cpu)' } }, "Amdahl's law (no overhead)"));  // labels the ideal curve "Amdahl's law (no overhead)" near its right end
          const px = xs(pk), py = ys(real(pk));  // px, py: the chart position of the peak
          k.push(s('circle', { cx: px, cy: py, r: 8, class: 's-ok', 'stroke-width': 3 }));  // a green circle marking the peak on the real curve
          if (pk < 64) {  // when the peak comes before 64 cores
            k.push(s('text', { x: px + (pk > 44 ? -12 : 12), y: py - 12, 'text-anchor': pk > 44 ? 'end' : 'start', 'font-size': 15 * FS, 'font-weight': 800, style: { fill: 'var(--ok)' } }, `peak: ${pkLab} cores, ${fmt(real(pk), 2)}×`));  // labels the peak with its core count and speedup, placed left of the dot if the dot is far right
            const endY = ys(real(64));  // endY: the height of the real curve at 64 cores
            k.push(s('text', { x: xs(64) - 6, y: Math.min(B - 30 * FS, endY + (endY > ys(ideal(64)) + 30 ? -10 : 22)), 'text-anchor': 'end', 'font-size': 13.5 * FS, 'font-weight': 800 }, 'with overhead'));  // labels the real curve "with overhead" near its end, above or below it so it does not collide with the ideal label
          } else {  // otherwise the real curve is still rising at 64 cores
            k.push(s('text', { x: px - 12, y: py + 26, 'text-anchor': 'end', 'font-size': 14 * FS, 'font-weight': 800, style: { fill: 'var(--ok)' } }, NW ? `still climbing: ${fmt(real(64), 2)}×` : `with overhead: still climbing, ${fmt(real(64), 2)}× at 64`));  // labels the end point saying the curve is still climbing and giving its speedup at 64 cores
          }  // ends the peak labels
          chart.replaceChildren(...k);  // replaces the old chart with the new shapes in one step
          bigPeak.textContent = `${fmt(real(pk), 2)}× @ ${pkLab}`;  // fills the best readout, such as "5.26x @ 9-10"
          big64.textContent = fmt(real(64), 2) + '×';  // fills the 64-core readout
          big64.style.color = pk >= 64 ? 'var(--ok)' : 'var(--bad)';  // colors the 64-core readout green when there is no peak before 64, red when it is past the peak
          bigIdeal.textContent = fmt(ideal(64), 2) + '×';  // fills the Amdahl-at-64 readout
          if (c === 0) say.innerHTML = 'With zero overhead the two curves are the same: this is pure Amdahl, the best case. Now push the overhead slider up a little.';  // zero overhead: the two curves match; invites the student to raise the overhead
          else if (pk >= 64) say.innerHTML = `Overhead is tiny compared with the parallel work, so the program keeps gaining all the way to 64 cores (${fmt(real(64), 1)}×). It <span class="t" data-t="Scalability">scales</span> well.`;  // no peak before 64: the program scales well; the word "scales" links to the glossary term
          else say.innerHTML = `Up to <b>${pk} cores</b>, each new core saves more time than it costs${tie ? ` (core ${pk + 1} exactly breaks even)` : ''}. Beyond that, coordinating costs more than the core adds: at 64 cores it runs at only ${fmt(real(64), 2)}×${real(64) < 1 ? ', slower than a single core' : ''}. Amdahl's law alone never predicts a drop; only overhead can.`;  // otherwise: explains the peak, what 64 cores give, and that only overhead (never Amdahl alone) makes speedup drop
        }  // ends draw()
        const sF = ctx.ui.slider({ label: 'Parallel fraction f', min: 0.5, max: 1, step: 0.001, value: f, format: (v) => v.toFixed(3), onInput: (v) => { f = v; seg.set(null); draw(); } });  // slider for f from 0.5 to 1 in steps of 0.001; moving it clears the preset buttons and redraws
        const sC = ctx.ui.slider({ label: 'Overhead per extra core', min: 0, max: 2, step: 0.01, value: c * 100, format: (v) => v.toFixed(2) + '%', onInput: (v) => { c = v / 100; seg.set(null); draw(); } });  // slider for the overhead per extra core from 0% to 2%; stored as a fraction, then the chart is redrawn
        const PRE = { typical: [0.9, 0.01], chatty: [0.95, 0.02], dbms: [0.999, 0.0001] };  // PRE: the three preset programs as [f, overhead] pairs: a typical app, one that shares a lot of data, and a well-scaling database
        const seg = ctx.ui.seg([{ value: 'typical', label: 'Typical app' }, { value: 'chatty', label: 'Shares a lot of data' }, { value: 'dbms', label: 'Scales well (e.g. a DBMS)' }], 'typical', (v) => { [f, c] = PRE[v]; sF.set(f); sC.set(c * 100); draw(); });  // the preset buttons; pressing one loads its f and overhead into both sliders and redraws
        const stat = (lab, node) => h('div', {}, h('div', { class: 'xs muted b' }, lab), node);  // stat(): builds a readout with a small gray label above the value
        const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column: explanation, the three overhead causes, sliders and readouts
          h('p', { class: 'm0 small', html: 'Amdahl\'s law assumes that splitting work is free. Real programs pay a <span class="t">parallel overhead</span> that grows with every core added:' }),  // intro sentence: Amdahl's law assumes splitting work is free, but real programs pay parallel overhead
          h('div', { class: 'stack small', style: { gap: '5px' }, html:  // a small list of the three causes of overhead
            '<div><span class="chip intr">communication</span> threads swap results and wait for each other</div>' +  // overhead cause 1: communication between threads
            '<div><span class="chip intr">distributing work</span> cutting the job up and handing out the pieces</div>' +  // overhead cause 2: cutting up and handing out the work
            '<div><span class="chip intr">cache coherence</span> keeping cached copies of shared data consistent</div>' }),  // overhead cause 3: keeping cached copies of shared data consistent (cache coherence)
          sF, sC,  // the two sliders
          h('div', { class: 'row', style: { gap: '22px' } }, stat('BEST (CORES)', bigPeak), stat('AT 64 CORES', big64), stat('AMDAHL AT 64', bigIdeal)),  // the row of three readouts: best, at 64 cores and Amdahl at 64
          say,  // the "What you see" explanation box
          h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'Not everything hits the wall. Database management systems and Java server applications can scale well: they serve many independent requests at once, so almost all of the work is parallel (f close to 1) and each extra core simply takes on more requests.' }));  // a "Why it matters" box: databases and Java servers scale well because their requests are independent; closes the column
        draw();  // draws the chart once so the step opens filled in
        el.append(h('div', { class: 'split l fill' }, left, h('div', { class: 'card white tight stack', style: { gap: '6px' } },  // places the left column beside a white card holding the chart (stacked on phones)
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'Try a kind of program:'), seg),  // top of the card: "Try a kind of program:" with the preset buttons
          chart,  // the chart
          h('div', { class: 'xs muted center', html: 'Toy model used here (time as a share of the one-core time): <span class="mono">(1 − f) + f / N + overhead × (N − 1)</span>' }))));  // a footnote giving the toy formula used for the real curve; closes the card and the layout
      },  // ends render() for step 5
    },  // ends step 5

    /* ---------------- 6. Four kinds of software that gain from multicore + sorting game ---------------- */
    {  // step 6 begins: the four kinds of multicore-friendly software, with a sorting game
      title: 'Four kinds of software that put many cores to work',  // step 6 title
      kind: 'lab',  // kind 'lab' labels this as a hands-on lab
      types: [  // types: the four kinds of software; name, glossary term, a one-line shape, a description and examples; render() reads them
        { name: 'Multithreaded native', term: 'Multithreaded native application', shape: 'A few processes, each running many threads.',  // kind 0: multithreaded native, a few processes each with many threads
          desc: 'The OS spreads the threads of one process across all the cores. The code is compiled to run directly on the hardware.', ex: ['Lotus Domino', 'Siebel CRM'] },  // description and examples of the multithreaded native kind
        { name: 'Multiprocess', term: 'Multiprocess application', shape: 'Many processes, one thread each.',  // kind 1: multiprocess, many single-threaded processes
          desc: 'The OS simply runs different single-threaded processes on different cores at the same time.', ex: ['Oracle database', 'SAP', 'PeopleSoft'] },  // description and examples of the multiprocess kind
        { name: 'Java', term: 'Java virtual machine (JVM)', shape: 'Java code plus a multithreaded runtime.',  // kind 2: Java, code running on a multithreaded runtime
          desc: 'Java makes threads easy, and the JVM itself runs many threads (garbage collection, compiling). Java EE application servers serve many requests at once.', ex: ['Java EE servers', 'the JVM'] },  // description and examples of the Java kind
        { name: 'Multi-instance', term: 'Multi-instance application', shape: 'Several copies of the same program.',  // kind 3: multi-instance, several copies of one program
          desc: 'Even a program that cannot use many cores itself gains: run several instances at once, often each in its own virtual machine for isolation.', ex: ['copies in parallel VMs'] },  // description and example of the multi-instance kind
      ],  // closes the types list
      items: [  // items: the nine cards for the sorting game; b is the index of the correct kind, hint is shown after a correct drop
        { name: 'Lotus Domino', text: 'one server process running hundreds of threads', b: 0, hint: 'A single process with a great many threads is the signature of a multithreaded native application.' },  // card: a server with one process and hundreds of threads (belongs to multithreaded native)
        { name: 'Siebel CRM', text: 'a handful of heavily threaded server processes', b: 0, hint: 'Few processes, each with many threads: multithreaded native.' },  // card: a few heavily threaded server processes (multithreaded native)
        { name: 'Oracle database', text: 'many cooperating background processes, one thread each', b: 1, hint: 'Many separate single-threaded processes: a multiprocess application.' },  // card: a database made of many single-threaded background processes (multiprocess)
        { name: 'SAP', text: 'a pool of single-threaded work processes', b: 1, hint: 'Each work process has just one thread; the parallelism comes from having many processes.' },  // card: a pool of single-threaded work processes (multiprocess)
        { name: 'PeopleSoft', text: 'many single-threaded server processes', b: 1, hint: 'Lots of one-thread processes: multiprocess.' },  // card: many single-threaded server processes (multiprocess)
        { name: 'Java EE server', text: 'an application server handling hundreds of web requests', b: 2, hint: 'Java application servers rely on the multithreaded Java platform to serve many requests at once.' },  // card: a Java application server handling hundreds of web requests (belongs to Java)
        { name: 'The JVM', text: 'runs garbage collection and code compiling next to your program', b: 2, hint: 'The Java virtual machine is itself multithreaded, so even a simple Java program keeps several cores busy.' },  // card: the JVM running garbage collection and compiling beside the program (Java)
        { name: 'Video converter ×4', text: 'four copies of a single-threaded converter, each in its own VM', b: 3, hint: 'One copy uses one core; four copies in parallel virtual machines use four. That is multi-instance.' },  // card: four copies of a single-threaded video converter, each in its own virtual machine (multi-instance)
        { name: 'Web-shop hosting', text: '12 virtual machines, each running a copy of the same shop', b: 3, hint: 'Many instances of the same application side by side: multi-instance.' },  // card: twelve virtual machines each running the same web shop (multi-instance)
      ],  // closes the items list
      render(el, ctx) {  // render(el, ctx) builds step 6 when the student arrives on it
        const { h, s } = ctx; const TY = this.types; const IT = this.items;  // takes the builders from ctx; TY and IT are this step's types and items lists (this refers to the step object)
        const wave = (x, y, n) => { let d = `M${x} ${y}`; for (let i = 0; i < n; i++) d += ' q 5 4 0 8 q -5 4 0 8'; return s('path', { d, style: { fill: 'none', stroke: 'var(--thread)', strokeWidth: 2.5 } }); };  // wave(x, y, n): draws a wavy vertical line, the guide's picture of one thread, with n S-shaped bends
        function diagram(i) {  // diagram(i): draws the small picture of kind i (processes as boxes, threads as wavy lines)
          const svg = s('svg', { viewBox: '0 6 250 104', width: '100%', role: 'img', 'aria-label': TY[i].shape });  // the diagram's SVG; its screen-reader label is the kind's one-line shape
          const k = [];  // k collects the diagram's shapes
          if (i === 0) {  // kind 0, multithreaded native: one big process
            k.push(s('rect', { x: 8, y: 6, width: 234, height: 104, rx: 10, class: 's-proc', 'stroke-width': 2 }), s('text', { x: 18, y: 24, 'font-size': 13, 'font-weight': 700 }, 'process'));  // a large teal box labeled "process"
            for (let t = 0; t < 11; t++) k.push(wave(30 + t * 19, 34, 4));  // eleven threads inside that one process
          } else if (i === 1) {  // kind 1, multiprocess
            for (let p = 0; p < 6; p++) { k.push(s('rect', { x: 8 + p * 40, y: 22, width: 32, height: 84, rx: 7, class: 's-proc', 'stroke-width': 2 })); k.push(wave(24 + p * 40, 36, 4)); }  // six tall process boxes side by side, each holding a single thread
            k.push(s('text', { x: 8, y: 15, 'font-size': 13, 'font-weight': 700 }, '6 processes'));  // the label "6 processes" above them
          } else if (i === 2) {  // kind 2, Java
            k.push(s('rect', { x: 8, y: 6, width: 234, height: 104, rx: 10, class: 's-os', 'stroke-width': 2 }), s('text', { x: 18, y: 24, 'font-size': 13, 'font-weight': 700 }, 'JVM'));  // a large purple box labeled "JVM", standing for the Java runtime
            for (let t = 0; t < 5; t++) k.push(wave(30 + t * 22, 36, 4));  // five application threads on the left of the box
            [['GC', 160], ['JIT', 205]].forEach(([lab, x]) => { k.push(wave(x, 36, 3)); k.push(s('text', { x, y: 102, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 }, lab)); });  // two extra threads on the right, labeled GC (garbage collection) and JIT (just-in-time compiling)
            k.push(s('text', { x: 72, y: 102, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 }, 'app threads'));  // the label "app threads" under the five application threads
          } else {  // kind 3, multi-instance
            for (let v = 0; v < 3; v++) {  // three virtual machines side by side
              const x = 8 + v * 80;  // x: the left edge of this virtual machine
              k.push(s('rect', { x, y: 6, width: 74, height: 104, rx: 9, class: 's-panel', 'stroke-width': 2, 'stroke-dasharray': '5 3' }), s('text', { x: x + 37, y: 22, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 }, 'VM ' + (v + 1)));  // a dashed box labeled "VM 1", "VM 2" or "VM 3"
              k.push(s('rect', { x: x + 16, y: 32, width: 42, height: 70, rx: 7, class: 's-proc', 'stroke-width': 2 }), wave(x + 37, 42, 3));  // inside each VM, one process box with one thread: a copy of the same single-threaded program
            }  // ends the VM loop
          }  // ends the choice of diagram
          svg.replaceChildren(...k);  // puts the shapes into the SVG
          return svg;  // returns the finished diagram
        }  // ends diagram()
        const learn = (p) => {  // learn(p): fills the first tab, "Meet the four kinds", inside panel p
          p.append(h('div', { class: 'stack', style: { gap: '12px' } },  // a vertical stack for the tab's content
            h('div', { class: 'grid-4' }, ...TY.map((t, i) => h('div', { class: 'card stack', style: { gap: '6px' } },  // four equal columns, one card per kind of software
              h('div', { class: 'b', style: { fontSize: '17px' } }, h('span', { class: 't', 'data-t': t.term }, t.name)),  // the kind's name in bold, underlined as a glossary term so hovering shows its definition
              h('div', { class: 'card white tight' }, diagram(i)),  // the kind's diagram in a white card
              h('div', { class: 'small b' }, t.shape),  // the kind's one-line shape in bold
              h('div', { class: 'small' }, t.desc),  // the kind's description
              h('div', { class: 'row', style: { gap: '4px' } }, ...t.ex.map((e) => h('span', { class: 'chip proc' }, e)))))),  // the kind's examples as small teal chips; closes the card and the grid
            h('div', { class: 'callout why small m0', 'data-label': 'The common thread', html: 'In all four cases the OS ends up with many runnable threads to place on different cores. What differs is who made them: the application itself, many processes, the Java runtime, or extra copies of the program (often each in its own virtual machine: a software copy of a whole computer, with its own operating system).' })));  // a closing box: in all four cases the OS gets many runnable threads, and what differs is who made them
        };  // ends learn()
        const game = (p) => {  // game(p): fills the second tab, the sorting game, inside panel p
          let sel = null, placed = new Set(), mistakes = 0;  // game state: sel = the card picked up (none yet), placed = cards already sorted, mistakes = wrong drops
          const tray = h('div', { class: 'grid-3', style: { gap: '8px' } });  // tray: a three-column grid holding the cards still to sort
          const buckets = TY.map((t, i) => h('div', { class: 'card tight bk', 'data-b': i, role: 'button', tabindex: 0, onclick: () => drop(i) }, h('div', { class: 'b small' }, t.name), h('div', { class: 'xs muted' }, t.shape), h('div', { class: 'stack bk-items', style: { gap: '4px', marginTop: '6px' } })));  // buckets: one clickable, keyboard-focusable drop box per kind, with its name, shape and a list for sorted cards
          buckets.forEach((b, i) => { ctx.on(b, 'dragover', (e) => e.preventDefault()); ctx.on(b, 'drop', (e) => { e.preventDefault(); const id = +e.dataTransfer.getData('text/plain'); if (!isNaN(id)) { sel = id; drop(i); } }); ctx.on(b, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(i); } }); });  // makes each bucket accept dragged cards (reading the card number from the drag) and respond to Enter or Space
          const msg = h('div', { class: 'callout tip small m0', 'data-label': 'How to play' }, 'Click a card, then click the kind of software it is (or drag the card onto it).');  // the message box that explains how to play and then gives feedback after each drop
          const prog = h('span', { class: 'small b' });  // the progress line, such as "3 / 9 sorted, 1 slip"
          function paintTray() {  // paintTray(): redraws the tray of unsorted cards and the progress line
            tray.replaceChildren(...IT.map((it, id) => placed.has(id) ? null : h('button', { type: 'button', class: 'sortcard' + (sel === id ? ' sel' : ''), draggable: 'true', onclick: () => { sel = sel === id ? null : id; paintTray(); },  // one button per unsorted card, highlighted if it is picked up; clicking picks it up or puts it back down
              ondragstart: (e) => { e.dataTransfer.setData('text/plain', String(id)); } }, h('b', {}, it.name), ' · ' + it.text)).filter(Boolean));  // starting a drag stores the card's number so the bucket's drop handler knows which card arrived
            if (placed.size === IT.length) tray.replaceChildren(h('div', { class: 'card', style: { gridColumn: '1 / -1' }, html: `<b>All sorted${mistakes ? ` with ${mistakes} slip${mistakes > 1 ? 's' : ''}` : ' with no mistakes'}.</b> Notice that the clue is always the <i>shape</i>: how many processes, how many threads each, and whether the copies are separate instances.` }));  // when every card is sorted, the tray is replaced by a summary of mistakes and a reminder that the clue is the shape
            prog.textContent = `${placed.size} / ${IT.length} sorted · ${mistakes} slip${mistakes === 1 ? '' : 's'}`;  // updates the progress line
          }  // ends paintTray()
          function drop(bi) {  // drop(bi): tries to place the picked-up card into bucket bi; runs on a click, key press or drag-drop on a bucket
            if (sel == null) { msg.className = 'callout tip small m0'; msg.dataset.label = 'How to play'; msg.textContent = 'First click a card, then click the kind of software it belongs to.'; return; }  // no card picked up yet: reminds the student to click a card first
            const it = IT[sel], box = buckets[bi];  // it: the card being placed; box: the bucket it is going into
            if (it.b === bi) {  // the right bucket
              placed.add(sel);  // marks the card as sorted
              box.querySelector('.bk-items').append(h('div', { class: 'chip ok', style: { whiteSpace: 'normal' } }, '✓ ' + it.name));  // adds a green chip with the card's name inside the bucket
              msg.className = 'callout tip small m0'; msg.dataset.label = 'Correct'; msg.innerHTML = `<b>${it.name}</b>: ${it.hint}`;  // turns the message green and shows the card's hint explaining why it belongs there
              sel = null;  // puts the card down, so nothing is picked up
            } else {  // the wrong bucket
              mistakes++;  // counts a mistake
              box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');  // restarts the bucket's flash animation (reading offsetWidth forces the browser to notice the class was removed)
              msg.className = 'callout bad small m0'; msg.dataset.label = 'Not that one'; msg.innerHTML = `<b>${it.name}</b> is not ${TY[bi].name.toLowerCase()}. Clue: ${it.text}.`;  // turns the message red and repeats the card's clue; the card stays picked up for another try
            }  // ends the right-or-wrong choice
            paintTray();  // redraws the tray and progress
          }  // ends drop()
          const reset = h('button', { class: 'btn sm', type: 'button', onclick: () => { sel = null; placed = new Set(); mistakes = 0; buckets.forEach((b) => b.querySelector('.bk-items').replaceChildren()); msg.className = 'callout tip small m0'; msg.dataset.label = 'How to play'; msg.textContent = 'Click a card, then click the kind of software it is (or drag the card onto it).'; paintTray(); } }, 'Start over');  // the "Start over" button: clears every sorted card, the mistakes and the message, then redraws the tray
          paintTray();  // draws the tray for the first time
          p.append(h('div', { class: 'stack', style: { gap: '10px' } }, tray, h('div', { class: 'grid-4' }, ...buckets), h('div', { class: 'split r3', style: { height: 'auto', alignItems: 'center', gap: '14px' } }, msg, h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, prog, reset))));  // lays out the game: tray on top, the four buckets below, then the message beside the progress and reset button
        };  // ends game()
        el.append(h('div', { class: 'fill' }, ctx.ui.tabs([{ label: 'Meet the four kinds', render: learn }, { label: 'Sort them: which kind is it?', render: game }])));  // builds the two tabs, "Meet the four kinds" and "Sort them", and puts them in the step
      },  // ends render() for step 6
    },  // ends step 6

    /* ---------------- 7. Valve: coarse vs fine vs hybrid threading on a 4-core frame ---------------- */
    {  // step 7 begins: re-threading a game engine on four cores (coarse, fine or hybrid)
      title: 'A game engine on four cores: coarse, fine or hybrid?',  // step 7 title
      kind: 'lab',  // kind 'lab' labels this as a hands-on lab
      core: true,  // core: true keeps this step on the short route
      sys: [  // sys: the engine's six systems; w = work in milliseconds per frame, ab = short label, cls = color
        { id: 'render', name: 'Rendering', ab: 'R', w: 12, cls: 'cpu' }, { id: 'physics', name: 'Physics', ab: 'Ph', w: 6, cls: 'io' },  // rendering (12 ms, the biggest) and physics (6 ms)
        { id: 'ai', name: 'AI', ab: 'AI', w: 2, cls: 'proc' }, { id: 'particles', name: 'Particles', ab: 'Pa', w: 2, cls: 'thread' },  // AI (2 ms) and particles (2 ms)
        { id: 'sound', name: 'Sound', ab: 'S', w: 1, cls: 'os' }, { id: 'logic', name: 'Game logic', ab: 'L', w: 1, cls: 'mem' },  // sound (1 ms) and game logic (1 ms), 24 ms of work in all
      ],  // closes the systems list
      render(el, ctx) {  // render(el, ctx) builds step 7 when the student arrives on it
        const { h, s } = ctx; const fmt = ctx.util.fmt; const SYS = this.sys;  // takes the builders, the number formatter and this step's systems list
        const CORES = 4, SYNC = 0.5, TOTAL = 24, BEST_HYB = 7.5;  // CORES = 4; SYNC = 0.5 ms wait added after each piece of split work; TOTAL = 24 ms of work; BEST_HYB = the best hybrid frame time
        let mode = 'single', sel = null;  // mode: the chosen threading strategy (starts as one thread); sel: the system picked up in coarse mode
        const assign = { render: 0, physics: 0, ai: 1, particles: 1, sound: 2, logic: 2 };  // assign: which core each system runs on in coarse mode (the student can change this)
        const split = new Set(['render']);  // split: the systems chosen for fine-grained splitting in hybrid mode (starts with rendering)
        function schedule() {  // schedule(): works out which core runs which piece of work and when, for the current strategy
          const lanes = [[], [], [], []], t = [0, 0, 0, 0];  // lanes: the list of work blocks on each of the four cores; t: how busy each core is so far
          const put = (c, sy, dur, kind) => { lanes[c].push({ sy, start: t[c], dur, kind }); t[c] += dur; };  // put(): adds a block to core c starting when that core is free, and moves the core's clock forward
          if (mode === 'single') SYS.forEach((sy) => put(0, sy, sy.w, 'work'));  // one thread: every system runs one after another on core 1
          else if (mode === 'coarse') SYS.forEach((sy) => put(assign[sy.id], sy, sy.w, 'work'));  // coarse: each whole system runs on the core it is assigned to
          else {  // fine or hybrid
            const cut = mode === 'fine' ? SYS : SYS.filter((sy) => split.has(sy.id));  // cut: the systems to split across cores (all six in fine mode, only the chosen ones in hybrid mode)
            cut.forEach((sy) => { for (let c = 0; c < CORES; c++) { put(c, sy, sy.w / CORES, 'work'); put(c, sy, SYNC, 'sync'); } });  // each split system gives every core a quarter of its work followed by a 0.5 ms sync wait, where the cores meet up
            SYS.filter((sy) => !cut.includes(sy)).sort((a, b) => b.w - a.w).forEach((sy) => { const c = t.indexOf(Math.min(...t)); put(c, sy, sy.w, 'work'); });  // the systems left whole go, biggest first, to whichever core is least busy at that moment
          }  // ends the choice of strategy
          return { lanes, loads: t, frame: Math.max(...t) };  // returns each core's blocks, how busy each core is, and the frame time (when the busiest core finishes)
        }  // ends schedule()
        // ---------- Gantt chart
        const NW = ctx.narrow;   // phones: a narrow drawing so the labels stay legible
        const X0 = NW ? 58 : 74, X1 = NW ? 370 : 644, PX = (X1 - X0) / TOTAL, LY = 26, LH = NW ? 42 : 50, GAP = NW ? 10 : 12;  // Gantt chart geometry: X0 and X1 are the time axis ends, PX turns ms into drawing units, LY/LH/GAP place the four lanes
        const gantt = s('svg', { viewBox: NW ? '0 0 380 262' : '0 0 660 300', width: '100%', role: 'img', 'aria-label': 'Timeline of one frame on four cores' });  // the Gantt chart (a timeline with one row per core) showing one frame on four cores
        const cmp = s('svg', { viewBox: NW ? '0 0 380 118' : '0 0 660 118', width: '100%', role: 'img', 'aria-label': 'Frame time of each strategy you have tried' });  // the small comparison chart of frame times for the strategies tried so far
        const CL = NW ? 100 : 130, CB = NW ? 108 : 140, CW = NW ? 220 : 450;   // comparison chart: label edge, bar start, bar width
        const best = { single: null, coarse: null, fine: null, hybrid: null };  // best: the latest frame time for each strategy, or null until the student tries it
        const MODES = [['single', 'One thread'], ['coarse', 'Coarse-grained'], ['fine', 'Fine-grained'], ['hybrid', 'Hybrid']];  // MODES: the four strategies, each with the label shown in the comparison chart
        function drawCmp() {  // drawCmp(): redraws the comparison chart; runs on every repaint
          const k = [s('text', { x: 0, y: 14, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, NW ? 'LATEST FRAME TIME PER STRATEGY' : 'YOUR LATEST FRAME TIME FOR EACH STRATEGY')];  // k starts with the chart's heading
          MODES.forEach(([m, lab], i) => {  // one row per strategy
            const y = 26 + i * 23, v = best[m], on = m === mode;  // y: the row's top; v: its latest frame time; on: whether it is the strategy showing now
            k.push(s('text', { x: CL, y: y + 14, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': on ? 800 : 500 }, lab));  // the strategy's name to the left of its bar, bold for the current one
            k.push(s('rect', { x: CB, y, width: CW, height: 18, rx: 4, class: 's-panel', 'stroke-width': 1 }));  // an empty gray track the full width of 24 ms
            if (v != null) { k.push(s('rect', { x: CB, y, width: CW * v / TOTAL, height: 18, rx: 4, class: on ? 's-accent' : 's-cpu', 'stroke-width': on ? 2 : 1 })); k.push(s('text', { x: CB + 6 + CW * v / TOTAL, y: y + 14, 'font-size': 13, 'font-weight': 800 }, fmt(v, 2) + ' ms')); }  // if tried: a bar as long as the frame time (highlighted for the current strategy) with the time written after it
            else k.push(s('text', { x: CB + 8, y: y + 14, 'font-size': 13, class: 's-sub' }, 'not tried yet'));  // if not tried yet: says so in gray inside the track
          });  // ends the row loop
          cmp.replaceChildren(...k);  // replaces the old comparison chart with the new one
        }  // ends drawCmp()
        function drawGantt(sc) {  // drawGantt(sc): draws the schedule sc as a timeline with one lane per core
          const k = [];  // k collects the chart's shapes
          for (let c = 0; c < CORES; c++) {  // one lane per core
            const y = LY + c * (LH + GAP);  // y: the top edge of this core's lane
            const lane = s('rect', { x: X0, y, width: X1 - X0, height: LH, rx: 6, class: 's-panel' + (mode === 'coarse' ? ' hot' : ''), 'stroke-width': mode === 'coarse' && sel ? 2 : 1, style: mode === 'coarse' ? { cursor: 'pointer' } : null,  // the lane background; in coarse mode it has a pointer cursor and a thicker border once a system is picked up
              onclick: () => moveTo(c), ondragover: (e) => e.preventDefault(), ondrop: (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) { sel = id; moveTo(c); } } });  // clicking a lane, or dropping a dragged system button on it, moves the picked-up system to that core
            k.push(lane, s('text', { x: X0 - 10, y: y + LH / 2 + 5, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 700 }, 'Core ' + (c + 1)));  // adds the lane and its "Core n" label on the left
            sc.lanes[c].forEach((b) => {  // draws every block of work on this core
              const x = X0 + b.start * PX, w = b.dur * PX;  // x: where the block starts; w: how wide it is
              if (b.kind === 'sync') { k.push(s('rect', { x, y: y + 3, width: w, height: LH - 6, rx: 2, class: 's-intr', 'stroke-width': 1 })); return; }  // a sync block is drawn as a thin red rectangle, then the loop moves on to the next block
              const g = s('g', { style: mode === 'coarse' ? { cursor: 'pointer' } : null, onclick: mode === 'coarse' ? (e) => { e.stopPropagation(); sel = b.sy.id; paint(); } : null });  // a group for a work block; in coarse mode clicking it picks up that system (without also triggering the lane's click)
              g.append(s('rect', { x: x + 0.5, y: y + 3, width: Math.max(1, w - 1), height: LH - 6, rx: 5, class: 's-' + b.sy.cls, 'stroke-width': sel === b.sy.id && mode === 'coarse' ? 4 : 2 }));  // the work block in its system's color, drawn thicker when that system is picked up
              const lab = w > b.sy.name.length * 8 + 8 ? b.sy.name : w > b.sy.ab.length * 9 + 4 ? b.sy.ab : '';  // lab: the full system name if it fits, otherwise its short form, otherwise nothing
              if (lab) g.append(s('text', { x: x + w / 2, y: y + LH / 2 + 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, style: { pointerEvents: 'none' } }, lab));  // writes the label in the middle of the block; the text ignores clicks so the block underneath receives them
              k.push(g);  // adds the block's group to the chart
            });  // ends this core's blocks
          }  // ends the lane loop
          const fx = X0 + sc.frame * PX, axY = LY + CORES * (LH + GAP) - GAP + 12;  // fx: where the frame finishes; axY: how far down the time axis sits, just under the last lane
          k.push(s('line', { x1: X0, y1: axY, x2: X1, y2: axY, class: 's-line' }));  // the time axis
          for (let m = 0; m <= TOTAL; m += 4) k.push(s('text', { x: X0 + m * PX + (m === TOTAL ? 8 : 0), y: axY + 18, 'text-anchor': m === TOTAL ? 'end' : 'middle', 'font-size': 13, class: 's-sub' }, m + (m === TOTAL ? ' ms' : '')));  // labels every 4 ms from 0 to 24, with "ms" on the last one
          k.push(s('line', { x1: fx, y1: 8, x2: fx, y2: axY, class: 's-line', 'stroke-width': 2.5, 'stroke-dasharray': '6 4', style: { stroke: 'var(--bad)' } }));  // a dashed red line at the frame's finishing time
          k.push(s('text', { x: Math.min(fx + 6, X1 - 4), y: 16, 'text-anchor': fx > X1 - 120 ? 'end' : 'start', 'font-size': 13.5, 'font-weight': 800, style: { fill: 'var(--bad)' } }, 'frame done: ' + fmt(sc.frame, 2) + ' ms'));  // the label "frame done: ... ms" beside that line, flipped to the left near the right edge
          gantt.replaceChildren(...k);  // replaces the old Gantt chart with the new one
        }  // ends drawGantt()
        // ---------- controls + readouts
        const modeText = {  // modeText: the explanation shown in the card for each strategy
          single: '<b>Before multicore:</b> the whole game loop is one thread, so each frame runs the systems one after another on a single core. There is nothing to arrange.',  // explanation for one thread: every system runs in turn on one core
          coarse: '<span class="t">Coarse-grained threading</span>: each whole module runs as one thread on its own core; a <span class="t">timeline thread</span> keeps them in step each frame. <b>Drag a system button (under the chart) onto a core</b>, or click it, then a core.',  // explanation for coarse-grained threading, with how to drag systems onto cores
          fine: '<span class="t">Fine-grained threading</span>: split each system\'s work, like a loop over every object, into small pieces spread over all cores. All cores finish one system, meet at a sync point, then start the next. Every system is split automatically.',  // explanation for fine-grained threading: every system split, with a sync point after each
          hybrid: '<span class="t" data-t="Hybrid threading (game engines)">Hybrid threading</span>: split only the systems worth splitting and leave the others single-threaded. <b>Click the buttons under the chart to toggle split / whole.</b>',  // explanation for hybrid threading, with how to toggle each system between split and whole
        };  // closes modeText
        const explain = h('div', { class: 'small' });  // the card that shows the current strategy's explanation
        const ctrls = h('div', { class: 'row', style: { gap: '6px', justifyContent: 'center', minHeight: '66px', alignContent: 'center' } });  // the row of system buttons or chips under the Gantt chart, rebuilt for each strategy
        const bigF = h('div', { class: 'big num' });  // the big frame-time readout
        const fps = h('div', { class: 'num b', style: { fontSize: '24px' } });  // the frames-per-second readout
        const spd = h('div', { class: 'num b', style: { fontSize: '24px', color: 'var(--cpu)' } });  // the speedup readout, in blue
        const use = h('div', { class: 'num b', style: { fontSize: '24px' } });  // the "cores busy" readout, the share of the four cores' time spent on work
        const say = h('div', { class: 'callout why small m0', 'data-label': 'What happened' });  // the "What happened" box describing the current schedule
        // what Valve actually measured or concluded for each strategy (the toy numbers above are idealised)
        const VERDICT = {  // VERDICT: what the real engine rebuild found for each strategy, next to the toy result
          single: 'This is what Valve had to move away from: all of a frame\'s work done by one thread, one system after another, however many cores the chip has.',  // one thread: the starting point the engine had to move away from
          coarse: 'On two processors: up to 2× only in contrived tests, about <b>1.2×</b> in real gameplay, since each frame still waits for its slowest module.',  // coarse: only about 1.2 times faster in real play on two processors
          fine: 'Hard to apply well: each small unit of work takes a varying time, and keeping outcomes and their consequences in the right order made the code complex.',  // fine: hard to apply because task times vary and ordering got complex
          hybrid: 'The <b>most promising</b>, expected to scale best to 8 or 16 cores. Sound mixing (little user input, its own data, not tied to the frame) stays on one core; rendering spreads over many threads.',  // hybrid: the most promising, expected to scale to 8 or 16 cores
        };  // closes VERDICT
        const verdict = h('div', { class: 'callout tip small m0', 'data-label': "What Valve found" });  // the green box showing the verdict for the current strategy
        function moveTo(c) {  // moveTo(c): moves the picked-up system to core c; used only in coarse mode
          if (mode !== 'coarse') return;  // does nothing outside coarse mode
          if (!sel) { ctx.toast('First pick a system (click it), then click a core.'); return; }  // if no system is picked up, shows a short pop-up explaining what to do first
          assign[sel] = c; sel = null; paint();  // records the new core, puts the system down and repaints
        }  // ends moveTo()
        function paintCtrls() {  // paintCtrls(): rebuilds the explanation and the row under the chart for the current strategy
          explain.innerHTML = modeText[mode];  // shows the strategy's explanation
          if (mode === 'coarse') ctrls.replaceChildren(...SYS.map((sy) => h('button', { type: 'button', class: `btn sm ${sy.cls}` + (sel === sy.id ? ' on' : ''), draggable: 'true', title: 'Drag onto a core, or click then click a core',  // coarse: one draggable button per system showing its time and core; clicking picks it up or puts it down
            onclick: () => { sel = sel === sy.id ? null : sy.id; paint(); }, ondragstart: (e) => e.dataTransfer.setData('text/plain', sy.id) }, `${sy.name} ${sy.w} ms → Core ${assign[sy.id] + 1}`)));  // the click and drag handlers for those buttons, and their text such as "Physics 6 ms to Core 1"
          else if (mode === 'hybrid') ctrls.replaceChildren(...SYS.map((sy) => h('button', { type: 'button', class: `btn sm ${sy.cls}` + (split.has(sy.id) ? ' on' : ''), 'aria-pressed': split.has(sy.id),  // hybrid: one toggle button per system plus a chip saying red means sync overhead
            onclick: () => { if (split.has(sy.id)) split.delete(sy.id); else split.add(sy.id); paint(); } }, split.has(sy.id) ? `✓ split: ${sy.name}` : `whole: ${sy.name}`)), h('span', { class: 'chip intr' }, 'red = sync overhead'));  // clicking a toggle adds the system to, or removes it from, the split set and repaints
          else ctrls.replaceChildren(...SYS.map((sy) => h('span', { class: 'chip ' + sy.cls }, `${sy.name} ${sy.w} ms`)), ...(mode === 'fine' ? [h('span', { class: 'chip intr' }, 'sync overhead')] : []));  // one thread and fine: plain chips naming each system and its time (fine adds a sync overhead chip)
        }  // ends paintCtrls()
        function narrate(sc) {  // narrate(sc): picks the "What happened" text for the current schedule
          const busiest = sc.loads.indexOf(Math.max(...sc.loads));  // busiest: the number of the core with the most work
          if (mode === 'single') return `Everything runs on Core 1: ${TOTAL} ms per frame (about ${fmt(1000 / TOTAL, 0)} frames per second) while three cores sit idle.`;  // one thread: 24 ms per frame while three cores sit idle
          if (mode === 'coarse' && sel) return `Now click a core lane in the chart to move <b>${SYS.find((x) => x.id === sel).name}</b> there (or click the button again to cancel).`;  // coarse with a system picked up: tells the student to click a core lane
          if (mode === 'coarse') return sc.frame > 12.001  // coarse: depends on whether the best possible 12 ms has been reached
            ? `The frame ends when the busiest core finishes: Core ${busiest + 1} has ${fmt(sc.frame, 1)} ms of work. Move systems to even out the cores. Can you reach 12 ms?`  // not yet: names the busiest core and challenges the student to reach 12 ms
            : '12 ms (2×) is the best coarse threading can do: Rendering alone takes 12 ms and cannot be split, so the other cores sit partly idle, even in this toy where modules never wait for each other.';  // reached: explains that the unsplittable 12 ms Rendering block limits coarse threading to 2 times
          if (mode === 'fine') return `All cores stay busy, but each of the 6 sync points costs ${SYNC} ms on every core: 3 of the 9 ms are pure overhead. Splitting a 1 ms system like Sound costs more than it saves.`;  // fine: every core stays busy, but the six sync points waste 3 of the 9 ms
          if (!split.has('render')) return 'Rendering is still whole, so no frame can be shorter than 12 ms. Split it.';  // hybrid with Rendering left whole: the frame cannot beat 12 ms
          if (!split.has('physics')) return 'Now Physics (6 ms) is the longest whole task and holds up the frame. What if you split it too?';  // hybrid with Physics whole: Physics now holds up the frame
          if (sc.frame > BEST_HYB + 1e-9) return 'Each split system adds a sync point to every core. The small systems gain almost nothing from splitting. Try leaving them whole.';  // hybrid with too many small systems split: their sync points cost more than they save
          return `Best mix: split the two big systems and let the four small ones run whole, side by side on different cores. ${BEST_HYB} ms, ${fmt(TOTAL / BEST_HYB, 1)}× faster than one core, the best of all four strategies.`;  // hybrid at the best mix: 7.5 ms, the fastest of all four strategies
        }  // ends narrate()
        function paint() {  // paint(): recomputes the schedule and redraws everything; runs after every choice the student makes
          const sc = schedule();  // sc: the new schedule
          best[mode] = sc.frame;  // records this strategy's latest frame time for the comparison chart
          drawGantt(sc); paintCtrls(); drawCmp();  // redraws the timeline, the controls under it and the comparison chart
          bigF.textContent = fmt(sc.frame, 2) + ' ms';  // shows the frame time in milliseconds
          fps.textContent = fmt(1000 / sc.frame, 0);  // shows frames per second, 1000 ms divided by the frame time
          spd.textContent = fmt(TOTAL / sc.frame, 2) + '×';  // shows the speedup against 24 ms on one thread
          use.textContent = Math.round((TOTAL / (CORES * sc.frame)) * 100) + '%';  // shows how busy the four cores are: total work divided by four times the frame time, as a percentage
          say.innerHTML = narrate(sc);  // writes the "What happened" text
          verdict.innerHTML = VERDICT[mode];  // writes the verdict for this strategy
          verdict.dataset.label = mode === 'single' ? 'The starting point' : 'What Valve found';  // retitles the verdict box: "The starting point" for one thread, otherwise the real engine's findings
        }  // ends paint()
        const seg = ctx.ui.seg([{ value: 'single', label: 'One thread' }, { value: 'coarse', label: 'Coarse-grained' }, { value: 'fine', label: 'Fine-grained' }, { value: 'hybrid', label: 'Hybrid' }], mode, (v) => { mode = v; sel = null; paint(); });  // the four strategy buttons; choosing one sets the mode, puts down any picked-up system and repaints
        const stat = (lab, node) => h('div', {}, h('div', { class: 'xs muted b' }, lab), node);  // stat(): builds a readout with a small gray label above the value
        const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column: intro, strategy buttons, explanation and readouts
          h('p', { class: 'small m0' }, 'Valve rebuilt its Source game engine for multicore chips. Try its choices on one toy frame (a single screen image; games draw dozens per second): six systems, 24 ms of work, 4 cores.'),  // intro: the engine was rebuilt for multicore; try its choices on one toy frame of 24 ms on 4 cores
          seg,  // the strategy buttons
          h('div', { class: 'card tight' }, explain),  // the explanation card
          h('div', { class: 'row', style: { gap: '18px', alignItems: 'flex-end' } }, stat('FRAME TIME', bigF), stat('FRAMES/S', fps), stat('SPEEDUP', spd), stat('CORES BUSY', use)),  // the row of four readouts: frame time, frames per second, speedup and cores busy
          say, verdict);  // the "What happened" and verdict boxes; closes the left column
        el.append(h('div', { class: 'split l fill' }, left, h('div', { class: 'card white tight stack', style: { gap: '8px', justifyContent: 'center' } }, gantt, ctrls, cmp)));  // places the left column beside a white card with the Gantt chart, the controls and the comparison chart
        paint();  // draws the one-thread schedule so the step opens filled in
      },  // ends render() for step 7
    },  // ends step 7

    /* ---------------- 8. Inside the re-threaded renderer (step-through) ---------------- */
    {  // step 8 begins: a step-through of how the renderer was re-threaded
      title: 'Inside the re-threaded renderer, step by step',  // step 8 title
      kind: 'explore',  // kind 'explore' labels this as an Explore step
      render(el, ctx) {  // render(el, ctx) builds step 8 when the student arrives on it
        const { h, s } = ctx;  // takes the element builders from ctx
        // times are in ms, sized so rendering on ONE core takes 12 ms, the same Rendering block as the previous step
        // (scene lists 1.8 + 1.5 + 1.2 ms, then 15 per-object tasks of 0.5 ms). Lanes show the first 5 ms of the frame;
        // phones get a narrow, taller drawing (queue, render thread and GPU move below the lanes)
        const NW = ctx.narrow;  // NW is true on small screens, where the drawing is taller and the queue moves below the lanes
        const LX = NW ? 62 : 72, LW = NW ? 308 : 440, TU = 5, PX = LW / TU, LY = NW ? 66 : 78, LH = NW ? 40 : 54, LG = NW ? 10 : 14;  // lane geometry: LX and LW are the lanes' left edge and width, TU = the 5 ms shown, PX turns ms into units, LY/LH/LG place the lanes
        const laneY = (c) => LY + c * (LH + LG);  // laneY(c): the top edge of core c's lane
        const LISTS = [{ c: 0, d: 1.8, lab: 'Main view' }, { c: 1, d: 1.5, lab: 'Reflection' }, { c: 2, d: 1.2, lab: 'Shadows' }];  // LISTS: the three scene lists and how long each takes (main view 1.8 ms, reflection 1.5 ms, shadows 1.2 ms), one per core
        const NOBJ = 15, OD = 0.5;   // per-object tasks: 15 of 0.5 ms each
        const r1 = (v) => Math.round(v * 10) / 10;   // keep sums like 1.8 + 0.5 exact to one decimal
        // 'barrier' = start after all lists; 'busy' = each core pulls work as soon as it is free
        function objTasks(busy) {  // objTasks(busy): hands the 15 per-object tasks to cores, each going to whichever core is free first
          const free = busy ? [1.8, 1.5, 1.2, 0.3] : [1.8, 1.8, 1.8, 1.8], out = [];  // free: when each core can start; with busy, each core starts as soon as its list is done (core 4 almost at once), otherwise all wait until 1.8 ms
          for (let i = 0; i < NOBJ; i++) { const c = free.indexOf(Math.min(...free)); out.push({ c, s: free[c], d: OD }); free[c] = r1(free[c] + OD); }  // gives each task to the earliest-free core and moves that core's free time on by 0.5 ms
          return out;  // returns the list of placed tasks
        }  // ends objTasks()
        const single = () => { const out = []; let t0 = 0; LISTS.forEach((l) => { out.push({ c: 0, s: t0, d: l.d, lab: l.lab, list: true }); t0 = r1(t0 + l.d); }); for (let i = 0; i < NOBJ; i++) out.push({ c: 0, s: r1(t0 + i * OD), d: OD }); return out; };  // single(): everything on core 1, the three lists one after another and then the 15 object tasks (12 ms in all)
        const par = (busy) => LISTS.map((l) => ({ c: l.c, s: 0, d: l.d, lab: l.lab, list: true })).concat(objTasks(busy));  // par(busy): the three lists at once on cores 1 to 3, followed by the per-object tasks placed by objTasks()
        const F = [  // F: the eight frames of the step-through; world/read/q/rt control what the picture shows, goal picks the highlighted goal
          { tasks: single(), world: 0, read: 0, q: 0, rt: 0, goal: -1, cap: '<b>The problem.</b> Rendering is the biggest system in a frame (the 12 ms block of the previous step), so it is where Valve\'s re-threading mattered most. On one thread it builds a list of visible objects for each view, prepares every object and produces the drawing commands for the graphics card (GPU), one job after another, while three cores sit idle.' },  // frame 1: the single-threaded renderer, with three cores idle
          { tasks: [], world: 2, read: 1, q: 0, rt: 0, goal: 0, cap: '<b>Many readers, one writer.</b> Threads read the shared world data about 95% of the time and write it at most 5%. Locking the whole world for each thread was far too slow, so a <span class="t">single-writer, multiple-readers lock</span> lets any number of readers in together; only a writer needs it alone. While a frame is built nobody writes, so readers never wait.' },  // frame 2: the single-writer, multiple-readers lock on the world data
          { tasks: par(false).filter((x) => x.list), world: 1, read: 1, q: 0, rt: 0, goal: 1, cap: 'Build a <span class="t">scene list</span> for each view in parallel: the main camera view of the world, its reflection in the water, and the shadow view. The lists do not depend on each other, so each is a task on its own core. Core 4 has nothing to do yet.' },  // frame 3: the three scene lists built in parallel, with core 4 idle
          { tasks: par(false), world: 1, read: 0, q: 0, rt: 0, goal: 1, cap: 'Each object then needs work of its own: the bone transformations that pose every character in every scene, plus graphics simulation such as particle effects, overlapped with this work instead of waiting its turn. These many near-identical tasks are spread over all four cores: fine-grained threading inside the renderer.' },  // frame 4: per-object work spread over all four cores (fine-grained threading)
          { tasks: par(false), world: 1, read: 0, q: 6, rt: 0, goal: 2, cap: 'Many threads now "draw" in parallel: each finished task appends its drawing commands to a shared queue. A lock would make workers wait in line, so the queue is a <span class="t">lock-free data structure</span>: an append is an atomic compare_and_swap (simply retried if another worker got there first), so no worker is ever put to sleep.' },  // frame 5: finished tasks append drawing commands to a lock-free queue
          { tasks: par(false), world: 1, read: 0, q: 3, rt: 1, goal: 3, cap: 'The graphics API (the library a program calls to command the GPU) accepted commands from one thread at a time, in order. Rather than put a lock around every call, exactly <b>one render thread</b> owns the API: it drains the queue and submits the commands. (It shares a core with the workers; it is drawn apart here.)' },  // frame 6: one render thread owns the graphics interface and drains the queue
          { tasks: par(true), world: 1, read: 0, q: 3, rt: 1, goal: 4, cap: '<b>Keep every thread busy.</b> Workers pull the next task from a shared task list the moment they are free. Core 4 starts on per-object work as soon as the first objects are known, the idle gap disappears, and rendering ends at 3.3 ms instead of 3.8 ms.' },  // frame 7: workers pull tasks as soon as they are free, cutting rendering to 3.3 ms
          { tasks: par(true), world: 2, read: 0, q: 3, rt: 1, goal: 5, cap: 'The whole design: many readers with at most one writer, parallel scene lists, fine-grained per-object work, a lock-free queue and a single owner for the graphics API. Rendering takes 3.3 ms instead of 12 ms, close to the ideal 12 ÷ 4 = 3 ms, and the cores are about 91% busy, against 25% when one thread did it all.' },  // frame 8: the whole design, 3.3 ms instead of 12 ms with the cores about 91% busy
        ];  // closes the frames list
        const GOALS = ['Many readers, one writer', 'Split the work across all cores', 'Avoid locking (lock-free queue)', 'One thread owns the graphics API', 'Keep every thread busy'];  // GOALS: the five design goals listed beside the drawing and ticked off as the frames advance
        const svg = s('svg', { viewBox: NW ? '0 0 380 414' : '0 0 760 366', width: '100%', role: 'img', 'aria-label': 'Renderer threads, queue and GPU' });  // the step's SVG drawing of the world data, the four cores, the queue, the render thread and the GPU
        const goalList = h('div', { class: 'stack', style: { gap: '6px' } });  // the list of goals shown beside the drawing
        const util = h('div', { class: 'num b', style: { fontSize: '26px' } });  // the "cores busy" readout
        const finish = h('div', { class: 'small muted' });  // a small gray line giving when rendering finishes
        function draw(fr) {  // draw(fr): redraws the picture for frame fr; the player calls it at every frame
          const k = [];  // k collects the new shapes
          k.push(s('rect', { x: LX, y: 6, width: LW, height: 44, rx: 10, class: 's-mem', 'stroke-width': fr.world === 2 ? 4 : 2 }));  // the green "Game world data" box at the top, with a thicker border in frames that are about it
          k.push(s('text', { x: LX + LW / 2, y: 26, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Game world data'));  // its title "Game world data"
          k.push(s('text', { x: LX + LW / 2, y: 43, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, fr.world ? (NW ? 'many readers · no writer this frame' : 'many readers at once · no writer while this frame is built') : 'positions, models, textures'));  // its subtitle: what it holds, or that many threads read it and nobody writes during this frame
          for (let c = 0; c < 4; c++) {  // one lane per core
            const y = laneY(c);  // y: the top of this core's lane
            k.push(s('rect', { x: LX, y, width: LW, height: LH, rx: 6, class: 's-panel', 'stroke-width': 1 }));  // the lane's gray background
            k.push(s('text', { x: LX - 8, y: y + LH / 2 + 5, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 700, style: { fill: 'var(--cpu)' } }, 'Core ' + (c + 1)));  // the "Core n" label on the left, in the processor color
            const rx = LX + (NW ? 30 + c * 75 : 30 + c * 110);  // rx: where this core's read arrow comes down from the world data
            if (fr.read) k.push(s('line', { x1: rx, y1: 52, x2: rx, y2: y - 2, class: 's-line', 'stroke-dasharray': '4 4', 'marker-end': 'url(#arr-mem)', style: { stroke: 'var(--mem)' } }));  // in the reader frames, a dashed green arrow from the world data down to this core
          }  // ends the lane loop
          fr.tasks.forEach((tk) => {  // draws each task block of this frame
            if (tk.s >= TU) return;  // skips any task that starts after the 5 ms window
            const x = LX + tk.s * PX, y = laneY(tk.c) + 4, w = Math.min(tk.d, TU - tk.s) * PX;  // x and y: where the block goes; w: its width, cut off at the edge of the window
            k.push(s('rect', { x: x + 1, y, width: w - 2, height: LH - 8, rx: 4, class: tk.list ? 's-accent' : 's-thread', 'stroke-width': 1.5 }));  // scene-list blocks are indigo and per-object blocks pink
            if (tk.lab && w > 50) k.push(s('text', { x: x + w / 2, y: y + LH / 2 + 1, 'text-anchor': 'middle', 'font-size': NW ? 12.5 : 13.5, 'font-weight': 700 }, tk.lab));  // writes the scene list's name inside its block if the block is wide enough
          });  // ends the task loop
          const end = fr.tasks.length ? Math.max(...fr.tasks.map((x) => x.s + x.d)) : 0;  // end: when the last task finishes (0 if there are no tasks)
          if (fr.tasks.length && end > TU) {  // if the work runs past the 5 ms window (the one-thread frame)
            for (let c = 1; c < 4; c++) k.push(s('text', { x: LX + LW / 2, y: laneY(c) + LH / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'idle'));  // writes "idle" in the lanes of cores 2 to 4
            k.push(s('text', { x: LX + LW, y: laneY(3) + LH + 20, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, style: { fill: 'var(--bad)' } }, NW ? 'Core 1 runs on until 12 ms →' : 'Core 1 runs on, off the chart, until 12 ms →'));  // notes in red that core 1 carries on beyond the chart until 12 ms
          }  // ends the past-the-window case
          if (fr.tasks.length && end < TU) {  // if the work finishes inside the window
            k.push(s('line', { x1: LX + end * PX, y1: LY - 4, x2: LX + end * PX, y2: laneY(3) + LH + 4, class: 's-line', 'stroke-dasharray': '5 3', style: { stroke: 'var(--ok)' } }));  // a dashed green line at the finishing time
            k.push(s('text', { x: LX + end * PX + 4, y: laneY(3) + LH + 20, 'font-size': 13.5, 'font-weight': 800, style: { fill: 'var(--ok)' } }, (NW ? '' : 'done at ') + ctx.util.fmt(end, 1) + ' ms'));  // its label, such as "done at 3.3 ms"
          }  // ends the finish marker
          if (fr.goal === 1 && !fr.tasks.some((x) => x.c === 3)) k.push(s('text', { x: LX + LW / 2, y: laneY(3) + LH / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'idle'));  // in the scene-list frame, marks core 4 as idle because it has no list to build
          // lock-free queue, render thread and GPU: a column on the right (wide) or rows below the lanes (phones)
          const thr = { class: 's-line', 'marker-end': 'url(#arr-thread)', style: { stroke: 'var(--thread)' } };  // thr: shared style for the pink arrows that carry drawing commands
          const rtBox = (x, y, w, hh) => k.push(s('rect', { x, y, width: w, height: hh, rx: 10, class: 's-thread', 'stroke-width': fr.rt ? 4 : 1.5, style: fr.rt ? null : { opacity: 0.45 } }));  // rtBox(): draws the render-thread box, faded until the frame where the render thread appears
          const gpuBox = (x, y, w, hh) => k.push(s('rect', { x, y, width: w, height: hh, rx: 10, class: 's-io', 'stroke-width': fr.rt ? 3 : 1.5, style: fr.rt ? null : { opacity: 0.45 } }));  // gpuBox(): draws the GPU box in the input/output color, also faded until that frame
          const txt = (x, y, t, o = {}) => k.push(s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, o), t));  // txt(): writes a centered bold label, with optional extra settings
          if (!NW) {  // wide screens: the queue, render thread and GPU sit in a column to the right of the lanes
            const QX = 552, QY = LY, QH = 4 * LH + 3 * LG;  // QX, QY: the queue's position; QH: its height, matching the four lanes
            txt(QX + 30, QY - 18, 'lock-free'); txt(QX + 30, QY - 4, 'queue');  // labels the queue "lock-free queue" on two lines above it
            k.push(s('rect', { x: QX, y: QY, width: 60, height: QH, rx: 8, class: 's-panel', 'stroke-width': fr.goal === 2 ? 4 : 1.5 }));  // the queue's outline, thicker in the frame about the lock-free queue
            for (let i = 0; i < 8; i++) k.push(s('rect', { x: QX + 10, y: QY + QH - 12 - (i + 1) * 28, width: 40, height: 22, rx: 4, class: i < fr.q ? 's-thread' : 's-muted', 'stroke-width': 1.5 }));  // eight slots stacked from the bottom; the first q of them are filled pink as commands arrive
            if (fr.q) for (let c = 0; c < 4; c++) k.push(s('line', Object.assign({ x1: LX + LW + 2, y1: laneY(c) + LH / 2, x2: QX - 4, y2: laneY(c) + LH / 2 }, thr)));  // once the queue is in use, an arrow from each core's lane into the queue
            rtBox(648, LY, 106, 104);  // the render-thread box to the right of the queue
            txt(701, LY + 44, 'Render', { 'font-size': 14 }); txt(701, LY + 62, 'thread', { 'font-size': 14 }); txt(701, LY + 82, '(only one)', { 'font-size': 13, 'font-weight': 400, class: 's-sub' });  // labels the box "Render thread (only one)" on three lines
            gpuBox(648, LY + 150, 106, QH - 150);  // the GPU box below the render thread, filling the rest of the column
            txt(701, LY + 196, 'Graphics'); txt(701, LY + 214, 'API → GPU');  // labels it "Graphics API to GPU"
            if (fr.rt) {  // once the render thread exists (from frame 6 on), draw the arrows it uses
              k.push(s('line', Object.assign({ x1: QX + 62, y1: LY + 52, x2: 644, y2: LY + 52 }, thr)));  // a pink arrow from the queue into the render thread: it drains the queue
              k.push(s('line', { x1: 701, y1: LY + 106, x2: 701, y2: LY + 146, class: 's-line', 'marker-end': 'url(#arr-io)', style: { stroke: 'var(--io)' } }));  // an orange arrow from the render thread down to the GPU: it submits the commands
            }  // ends the render-thread arrows
          } else {  // phones: the queue, render thread and GPU are laid out in rows under the lanes instead
            const QY = laneY(3) + LH + 46;                      // queue row under the lanes
            txt(LX, QY - 8, 'lock-free queue', { 'text-anchor': 'start', 'font-size': 13 });  // labels the queue row "lock-free queue"
            k.push(s('rect', { x: LX, y: QY, width: LW, height: 36, rx: 8, class: 's-panel', 'stroke-width': fr.goal === 2 ? 4 : 1.5 }));  // the queue's outline, a wide short bar, thicker in the frame about the lock-free queue
            for (let i = 0; i < 8; i++) k.push(s('rect', { x: LX + 7 + i * 37.5, y: QY + 6, width: 32, height: 24, rx: 4, class: i < fr.q ? 's-thread' : 's-muted', 'stroke-width': 1.5 }));  // eight slots in a row; the first q of them are filled pink as commands arrive
            if (fr.q) k.push(s('path', Object.assign({ d: `M26 ${laneY(3) + LH + 4} V${QY + 18} H${LX - 4}`, fill: 'none' }, thr)));  // once the queue is in use, an arrow from the lanes down and across into the queue
            const RY = QY + 56;  // RY: the row under the queue for the render thread and GPU
            rtBox(LX, RY, 144, 50); txt(LX + 72, RY + 22, 'Render thread', { 'font-size': 14 }); txt(LX + 72, RY + 40, '(only one)', { 'font-size': 13, 'font-weight': 400, class: 's-sub' });  // the render-thread box with its "Render thread (only one)" label
            gpuBox(LX + 164, RY, 144, 50); txt(LX + 236, RY + 22, 'Graphics API'); txt(LX + 236, RY + 40, '→ GPU');  // the GPU box beside it, labeled "Graphics API to GPU"
            if (fr.rt) {  // once the render thread exists, draw its arrows
              k.push(s('line', Object.assign({ x1: LX + 72, y1: QY + 38, x2: LX + 72, y2: RY - 4 }, thr)));  // a pink arrow from the queue down into the render thread
              k.push(s('line', { x1: LX + 146, y1: RY + 25, x2: LX + 160, y2: RY + 25, class: 's-line', 'marker-end': 'url(#arr-io)', style: { stroke: 'var(--io)' } }));  // an orange arrow from the render thread across to the GPU
            }  // ends the render-thread arrows
          }  // ends the wide-versus-phone layout choice
          k.push(s('text', { x: LX, y: laneY(3) + LH + 20, 'font-size': 13.5, class: 's-sub' }, 'time (ms) →'));  // a gray "time (ms)" note under the lanes showing that time runs left to right
          svg.replaceChildren(...k);  // replaces the old drawing with the new shapes in one step
          goalList.replaceChildren(...GOALS.map((g, i) => h('div', { class: 'row nw small', style: { gap: '8px', opacity: i <= fr.goal ? 1 : 0.4, fontWeight: i === fr.goal ? 800 : 500 } },  // rebuilds the goal list: goals reached so far are fully visible, and the current goal is bold
            h('span', { class: 'chip ' + (i <= fr.goal ? 'ok' : ''), style: { minWidth: '26px', justifyContent: 'center' } }, i <= fr.goal ? '✓' : String(i + 1)), g)));  // each goal's badge is a green tick once reached, otherwise its number
          if (fr.tasks.length) {  // when the frame has tasks, compute the readouts
            const busy = fr.tasks.reduce((a, x) => a + x.d, 0);  // busy: the total time the cores spend on tasks
            util.textContent = Math.round((busy / (4 * end)) * 100) + '%';  // cores busy: total task time divided by four cores times the finishing time, as a percentage
            finish.textContent = fr.tasks.every((x) => x.c === 0) ? 'Rendering done at 12 ms: all of it on one core.' : `Rendering done at ${ctx.util.fmt(end, 1)} ms (one core alone: 12 ms).`;  // the finish line: 12 ms on one core, or the parallel finishing time compared with 12 ms
          } else { util.textContent = '–'; finish.textContent = 'No work scheduled yet in this frame.'; }  // with no tasks (the lock frame), shows a dash and says nothing is scheduled yet
          return fr.cap;  // hands the frame's caption to the player
        }  // ends draw() for step 8
        const player = ctx.ui.player({ count: F.length, render: (i) => draw(F[i]), interval: 4200 });  // the frame player; it calls draw() for each of the eight frames and auto-advances every 4.2 s
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // lays out step 8 as a vertical stack filling the step area
          h('div', { class: 'split r3', style: { height: 'auto', gap: '14px', flex: '1', minHeight: 0 } },  // a row with the drawing taking two thirds and the goals card one third, growing to fill the space
            h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center' } }, svg),  // the drawing, centered in a white card
            h('div', { class: 'card stack', style: { gap: '10px' } }, h('h4', { class: 'm0' }, 'Design goals'), goalList,  // the goals card, starting with its heading and the goal list
              h('div', {}, h('div', { class: 'xs muted b' }, 'CORES BUSY IN THIS FRAME'), util, finish),  // the "cores busy in this frame" readout and the finish line
              h('div', { class: 'row', style: { gap: '5px', marginTop: 'auto' } }, h('span', { class: 'chip accent' }, 'scene-list task'), h('span', { class: 'chip thread' }, 'per-object task'), h('span', { class: 'chip mem' }, 'shared world data')))),  // a color key at the bottom of the card: scene-list task, per-object task, shared world data; closes the row
          player.el));  // the player's caption and controls; closes the stack
      },  // ends render() for step 8
    },  // ends step 8

    /* ---------------- 9. Recap ---------------- */
    {  // step 9 begins: the recap
      title: 'Recap: six ideas to carry with you',  // step 9 title
      kind: 'recap',  // kind 'recap' labels this as a Recap and keeps it on the short route
      render(el, ctx) {  // render(el, ctx) builds step 9 when the student arrives on it
        const { h } = ctx;  // takes the element builder from ctx
        el.append(h('div', { class: 'stack fill', style: { gap: '14px' } },  // lays out the recap as a vertical stack
          h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } },  // top row: an instruction on the left and the formula card on the right
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // instruction: say each answer aloud before flipping the card
            h('div', { class: 'card cpu tight row', style: { gap: '14px' } }, h('span', { class: 'xs b muted' }, "AMDAHL'S LAW"), h('span', { class: 'mono b', style: { fontSize: '19px' } }, 'Speedup = 1 / ((1 − f) + f / N)'))),  // a blue card holding Amdahl's law as a reminder
          ctx.ui.flipcards([  // flipcards(): a grid of cards showing a question on the front and the answer on the back when clicked
            ['What do f and 1 − f mean?', '<span><b>f</b> is the share of the one-core running time that can be spread perfectly over any number of cores. <b>1 − f</b> is inherently serial and never shrinks.</span>'],  // card 1: what f and 1 - f mean
            ['What is the ceiling on speedup?', '<span>As N → ∞, speedup → <b>1 / (1 − f)</b>. With f = 0.9 a program can never run more than 10× faster, however many cores you add.</span>'],  // card 2: the ceiling on speedup
            ['Why can a real program get slower with more cores?', '<span>Overhead grows with every core: <b>communication</b>, <b>distributing the work</b> and <b>cache coherence</b>. Past a peak, each new core costs more than it gives.</span>'],  // card 3: why a real program can get slower with more cores
            ['Name the four kinds of multicore-friendly software.', '<span><b>Multithreaded native</b> (Lotus Domino, Siebel CRM), <b>multiprocess</b> (Oracle, SAP, PeopleSoft), <b>Java</b> (the JVM, Java EE servers) and <b>multi-instance</b> (copies, often in VMs).</span>'],  // card 4: the four kinds of multicore-friendly software with examples
            ['Coarse vs fine vs hybrid threading?', '<span><b>Coarse:</b> one whole module per thread (only about 1.2× in real play). <b>Fine:</b> many similar small tasks over all cores (hard to manage). <b>Hybrid:</b> fine-grained only where it pays, single-threaded elsewhere: the winner.</span>'],  // card 5: coarse versus fine versus hybrid threading
            ["The re-threaded renderer's ideas?", '<span>Scene lists for each view built <b>in parallel</b>, per-object work (bone transformations) spread over all cores, a <b>single-writer, multiple-readers</b> lock for world data, <b>lock-free</b> queues, and <b>one thread</b> owning the graphics API.</span>'],  // card 6: the main ideas of the re-threaded renderer
          ], { cols: 3, height: 206 })));  // closes the card list; three columns of cards, each 206 px tall
      },  // ends render() for step 9
    },  // ends step 9

    /* ---------------- 10. Check yourself ---------------- */
    {  // step 10 begins: the end-of-section quiz
      title: 'Check yourself',  // step 10 title
      kind: 'check',  // kind 'check' labels this as Check Yourself and keeps it on the short route
      quiz: [  // quiz: the questions; the guide's quiz engine draws them, grades answers and shows feedback
        { q: "In Amdahl's law, speedup = 1 / ((1 − f) + f / N). What does <b>f</b> stand for?",  // question 1 (multiple choice): what f stands for in Amdahl's law
          choices: ['The fraction of the running time that must run on a single processor', 'The fraction of the running time that can be split perfectly across any number of processors', 'The fraction of the processors that are busy at any moment', 'The clock frequency of each core'],  // the four choices; the second one is correct
          answer: 1,  // answer: 1 means the second choice (counting starts at 0)
          feedback: ['That is 1 − f, the serial fraction. f is the part that can be shared out.', null, 'That describes how busy the hardware is, not a property of the program.', "Amdahl's law says nothing about clock speed; f is a share of the running time."],  // feedback for each wrong choice; null for the correct one
          why: 'f is the parallel fraction: the part of the one-processor running time that can be divided among N processors with no scheduling overhead. The rest, 1 − f, is inherently serial.' },  // why: the full explanation shown after answering
        { type: 'num', q: "A program is 90% parallelizable (f = 0.9). According to Amdahl's law, what speedup does it get on <b>8</b> processors? (Two decimal places.)", answer: 4.71, tol: 0.02, unit: '×',  // question 2 (calculate): speedup with f = 0.9 on 8 processors; answers within 0.02 of 4.71 count
          why: '1 / (0.1 + 0.9 / 8) = 1 / (0.1 + 0.1125) = 1 / 0.2125 ≈ 4.71. Eight processors, less than five times faster.' },  // why: the worked calculation
        { q: 'A game engine uses <b>hybrid</b> threading. Which system is the best candidate to leave <b>single-threaded</b>, running whole on one core?',  // question 3 (multiple choice): which system hybrid threading should leave single-threaded
          choices: ['Scene rendering, the biggest system in each frame', 'Computing the bone transformations of every character in every scene', 'Building the scene lists for the main view, a reflection and the shadows', 'Sound mixing, a small system with little user interaction that works on its own data'],  // the choices: rendering, bone transformations, scene lists, sound mixing
          answer: 3,  // answer: the fourth choice, sound mixing
          feedback: ['Rendering is the system that most needs spreading over many threads; left whole, it alone would set the frame time.', 'Many near-identical, independent calculations are the classic case for fine-grained threading, not for a single thread.', 'Each view\'s list is independent of the others, so the lists are built in parallel rather than on one thread.', null],  // feedback on each wrong choice
          why: 'Hybrid threading splits only the systems that gain from splitting. A small, self-contained system such as sound mixing runs well whole on one core, while big systems such as rendering are spread over many threads.' },  // why: hybrid threading splits only the systems that gain from splitting
        { type: 'num', q: 'A program is 80% parallel (f = 0.8). With an <b>unlimited</b> number of processors, what is the largest speedup it can ever reach?', answer: 5, tol: 0.01, unit: '×',  // question 4 (calculate): the ceiling for f = 0.8 with unlimited processors, which is 5
          why: 'As N grows, f / N shrinks to 0, so speedup approaches 1 / (1 − f) = 1 / 0.2 = 5. The serial 20% sets the ceiling.' },  // why: f / N shrinks to zero, leaving 1 / (1 - f)
        { type: 'num', q: 'A job takes 100 s on one core, and 20 s of it is inherently serial. The rest parallelizes perfectly. How many seconds does it take on <b>4</b> cores?', answer: 40, tol: 0.1, unit: 's',  // question 5 (calculate): time on 4 cores for a 100 s job with 20 s serial, which is 40 s
          why: 'The serial 20 s stays; the parallel 80 s is split four ways into 20 s. Total 20 + 20 = 40 s, a speedup of 2.5×.' },  // why: keep the serial 20 s and split the 80 s four ways
        { type: 'tf', q: 'If 90% of a program can run in parallel, 1000 processors will make it roughly 900 times faster.', answer: false,  // question 6 (true or false): false, because 90% parallel is capped at 10 times
          why: 'The serial 10% caps the speedup at 1 / (1 − 0.9) = 10×. With 1000 processors Amdahl\'s law gives only about 9.9×.' },  // why: the ceiling 1 / (1 - 0.9) = 10 times
        { type: 'multi', q: 'Which of these are sources of overhead that can make a real multithreaded program <b>slower</b> as more cores are added? Select all that apply.',  // question 7 (select all that apply): which items are overhead that slows a program as cores are added
          choices: ['Threads communicating and waiting for each other', 'Cutting the job into pieces and handing the pieces out to the threads', "Keeping the cores' cached copies of shared data coherent", 'Each core having a smaller share of the parallel work to do', 'The serial part shrinking as cores are added'],  // the five options: communication, handing out work, cache coherence, a smaller share each, the serial part shrinking
          answer: [0, 1, 2],  // answer: the first three options
          why: 'Communication, distributing the work and cache coherence all cost more as cores are added. A smaller share of parallel work per core is the benefit, not a cost, and the serial part never shrinks at all.' },  // why: the three kinds of overhead, and why the last two are not costs
        { type: 'bucket', q: 'Sort each application into the kind of multicore-friendly software it is.',  // question 8 (sort into groups): place each application in one of the four kinds
          buckets: ['Multithreaded native', 'Multiprocess', 'Java', 'Multi-instance'],  // the four group names
          items: [['Lotus Domino', 0], ['Siebel CRM', 0], ['Oracle database', 1], ['SAP', 1], ['PeopleSoft', 1], ['A Java EE application server', 2], ['Several copies of one program, each in its own virtual machine', 3]],  // the seven items as [name, correct group] pairs
          why: 'A few processes with many threads each: multithreaded native. Many single-threaded processes: multiprocess. The multithreaded JVM and Java EE servers: Java. Running extra copies side by side: multi-instance.' },  // why: the shape clue for each kind
        { type: 'match', q: 'Match each threading strategy used in game engines with its description.',  // question 9 (match the pairs): each game-engine threading strategy with its description
          pairs: [['Coarse-grained threading', 'Each whole module, such as rendering or AI, gets its own thread'], ['Fine-grained threading', 'Many similar tasks, such as the iterations of one loop, are spread over all cores'], ['Hybrid threading', 'Fine-grained threading for some systems, single threads for the others']],  // the three strategy and description pairs
          why: 'Coarse splits by module, fine splits one kind of work into many small pieces, and hybrid mixes the two, choosing per system.' },  // why: coarse splits by module, fine by small tasks, hybrid mixes per system
        { q: 'A game frame on a 4-core chip has a 12 ms rendering module and 12 ms of other, smaller modules. Using <b>coarse-grained</b> threading only (a module can never be split) and assuming modules never wait for each other, what is the shortest possible frame time?',  // question 10 (multiple choice): the shortest coarse-grained frame with an unsplittable 12 ms rendering module
          choices: ['3 ms', '6 ms', '12 ms', '24 ms'], answer: 2,  // the choices 3, 6, 12 and 24 ms; the answer is the third, 12 ms
          feedback: ['3 ms is 12 ÷ 4, but coarse threading never splits a module across cores.', '6 ms would need all 24 ms of work shared perfectly, but the 12 ms rendering module cannot be split.', null, '24 ms is the one-core time; putting modules on different cores already helps.'],  // feedback on each wrong choice of question 10
          why: 'With coarse threading a frame cannot finish before its biggest module does, so 12 ms is the floor, however the other modules are arranged.' },  // why: a coarse-grained frame cannot finish before its biggest module does
        { q: 'Threads in a game engine read the shared world data about 95% of the time and write it at most 5% of the time. Which way of protecting that data suits this pattern best?',  // question 11 (multiple choice): how to protect world data that is read 95% of the time
          choices: ['A single-writer, multiple-readers lock: readers hold it together, a writer holds it alone', 'One ordinary lock around the whole world that every thread must take, whether it reads or writes', 'A private copy of the whole world for every thread, merged at the end of each frame', 'No protection at all, because writes are rare'],  // the choices: a single-writer, multiple-readers lock, one big lock, private copies, no protection
          answer: 0,  // answer: the first choice
          feedback: [null, 'That makes readers wait for other readers even though reading together is safe; locking the whole world this way proved far too slow.', 'Copying the whole world for every thread wastes memory and time, and merging conflicting changes is hard.', 'Even a rare write can leave a reader seeing half-changed data; a writer still needs the data to itself.'],  // feedback on each wrong choice of question 11
          why: 'Reads do not interfere with each other, so letting all readers in together removes almost all waiting. Only the rare writer needs exclusive access.' },  // why: readers do not interfere with each other, so only the rare writer needs the data alone
        { type: 'order', q: 'Put the steps for building one frame in a renderer re-threaded for multicore in order.',  // question 12 (put in order): the steps of building one frame in the re-threaded renderer
          items: ['Scene lists are built in parallel, one for each view (main camera, reflection, shadows)', 'Per-object work, such as bone transformations, is spread over all the cores', 'Workers append their drawing commands to a lock-free queue', 'The single render thread drains the queue and submits the commands to the GPU'],  // the four steps in their correct order; the quiz engine shuffles them for the student
          why: 'First find what is visible in each view, then do the work each of those objects needs, queue the resulting drawing commands without locks, and let the one thread that owns the graphics API feed the GPU.' },  // why: find what is visible, do each object's work, queue the commands, then feed the GPU
      ],  // closes the quiz list
    },  // ends step 10

  ],  // closes the steps list

  notes: `${/* notes: the section's reading notes as HTML, shown in the Notes panel on any step of this section */''}
    <h3>More cores, but not proportionally more speed</h3>${/* notes heading: more cores, but not proportionally more speed */''}
    <p>A multicore processor puts several independent cores on one chip, so several threads can run at the same instant. Doubling the cores rarely doubles the speed of a program, because some of every program's work cannot be shared out. <b>Speedup</b> measures the gain: the time a job takes on one processor divided by the time it takes on N processors.</p>${/* notes paragraph: what a multicore processor is and how speedup is measured */''}
    <p>Analogy: friends can chop vegetables for a lasagna in parallel, but it still bakes for the same time in your one oven. The oven time is the serial part of the job.</p>${/* notes paragraph: the lasagna and oven analogy for the serial part */''}

    <h3>Amdahl's law</h3>${/* notes heading: Amdahl's law */''}
    <p>Split the one-processor running time T into two parts. A fraction <b>f</b> (the parallel fraction) can be divided among any number of processors perfectly, with no scheduling overhead. The rest, <b>1 − f</b> (the serial fraction), must run one step at a time and does not shrink however many processors you have.</p>${/* notes paragraph: splitting the running time into the parallel fraction f and the serial fraction 1 - f */''}
    <ul>${/* starts the list of formulas */''}
      <li>Time on one processor: T<sub>1</sub> = (1 − f)T + fT = T</li>${/* formula: time on one processor */''}
      <li>Time on N processors: T<sub>N</sub> = (1 − f)T + fT / N (only the parallel part is divided)</li>${/* formula: time on N processors, where only the parallel part is divided */''}
      <li>Speedup = T<sub>1</sub> / T<sub>N</sub> = <b>1 / ((1 − f) + f / N)</b> (T cancels out)</li>${/* formula: speedup, after T cancels out */''}
      <li>Ceiling: as N → ∞, f / N → 0, so speedup → <b>1 / (1 − f)</b></li>${/* formula: the ceiling as N grows without limit */''}
      <li>Efficiency = speedup / N: how much of each core does useful work</li>${/* formula: efficiency as speedup divided by N */''}
    </ul>${/* ends the formula list */''}
    <table>${/* starts the table of results for f = 0.9 and T = 100 ms */''}
      <tr><th>Cores N (f = 0.9, T = 100 ms)</th><th>Time on N cores</th><th>Speedup</th><th>Efficiency</th></tr>${/* table header: cores, time, speedup, efficiency */''}
      <tr><td>1</td><td>10 + 90 = 100 ms</td><td>1×</td><td>100%</td></tr>${/* table row: 1 core, 100 ms, 1 times, 100% */''}
      <tr><td>2</td><td>10 + 45 = 55 ms</td><td>1.82×</td><td>91%</td></tr>${/* table row: 2 cores, 55 ms, 1.82 times, 91% */''}
      <tr><td>4</td><td>10 + 22.5 = 32.5 ms</td><td>3.08×</td><td>77%</td></tr>${/* table row: 4 cores, 32.5 ms, 3.08 times, 77% */''}
      <tr><td>8</td><td>10 + 11.25 = 21.25 ms</td><td>4.71×</td><td>59%</td></tr>${/* table row: 8 cores, 21.25 ms, 4.71 times, 59% */''}
      <tr><td>64</td><td>10 + 1.41 = 11.41 ms</td><td>8.77×</td><td>14%</td></tr>${/* table row: 64 cores, 11.41 ms, 8.77 times, 14% */''}
      <tr><td>∞</td><td>10 ms</td><td>10× (the ceiling)</td><td>→ 0%</td></tr>${/* table row: unlimited cores, 10 ms, the 10 times ceiling */''}
    </table>${/* ends the results table */''}
    <p><b>Two lessons.</b> (1) When f is small, extra processors barely help. (2) Even when f is large, each extra core adds less than the one before (diminishing returns) and the speedup flattens at 1 / (1 − f). To go faster, shrink the serial part: halving it doubles the ceiling.</p>${/* notes paragraph: the two lessons, and that halving the serial part doubles the ceiling */''}
    <h4>Worked examples</h4>${/* notes subheading: worked examples */''}
    <ul>${/* starts the list of worked examples */''}
      <li>f = 0.95, N = 16: 1 / (0.05 + 0.059375) = 1 / 0.109375 ≈ <b>9.14×</b></li>${/* worked example: f = 0.95 on 16 cores gives 9.14 times */''}
      <li>f = 0.9, N = 8: 1 / (0.1 + 0.1125) ≈ <b>4.71×</b>; the ceiling is 10×, and 1000 cores give about 9.91×</li>${/* worked example: f = 0.9 on 8 cores gives 4.71 times, with the ceiling and the 1000-core result */''}
      <li>f = 0.5, N = 1000: 1 / 0.5005 ≈ <b>2.00×</b> (ceiling 2×)</li>${/* worked example: f = 0.5 on 1000 cores gives just 2 times */''}
      <li>f = 0.99, N = 100: 1 / 0.0199 ≈ <b>50.25×</b>, half of the ideal 100×</li>${/* worked example: f = 0.99 on 100 cores gives 50.25 times */''}
      <li>f = 0.75, N = 4: 1 / 0.4375 ≈ <b>2.29×</b> (efficiency 57%)</li>${/* worked example: f = 0.75 on 4 cores gives 2.29 times at 57% efficiency */''}
      <li>f = 0.8, unlimited cores: 1 / 0.2 = <b>5×</b></li>${/* worked example: f = 0.8 with unlimited cores gives 5 times */''}
      <li>In seconds: 200 s on one core with 30 s serial, on 8 cores: 30 + 170 / 8 = <b>51.25 s</b>. Likewise 100 s with 20 s serial on 4 cores: 20 + 80 / 4 = <b>40 s</b>.</li>${/* worked examples in seconds: 51.25 s and 40 s */''}
      <li>Working backwards: 8× on 16 cores needs (1 − f) + f / 16 = 0.125, so f × 15/16 = 0.875 and f = <b>0.933</b> (93.3% parallel).</li>${/* worked example going backwards: 8 times on 16 cores needs f = 0.933 */''}
    </ul>${/* ends the worked examples */''}
    <h3>Real software: overhead can make it slower</h3>${/* notes heading: overhead can make real software slower */''}
    <p>Amdahl's law is a best case, because it assumes that splitting work is free. Real programs pay a <b>parallel overhead</b> that grows with the number of cores:</p>${/* notes paragraph: Amdahl's law is a best case that treats splitting as free */''}
    <ul>${/* starts the list of overhead sources */''}
      <li><b>Communication</b>: threads exchange results and wait for each other at synchronization points.</li>${/* overhead source: communication and waiting at synchronization points */''}
      <li><b>Distribution of work</b>: the job must be cut into pieces and handed out; more cores mean more pieces.</li>${/* overhead source: cutting up and handing out the work */''}
      <li><b>Cache coherence</b>: when cores share data, the hardware must keep every core's cached copy consistent, which costs extra memory traffic.</li>${/* overhead source: cache coherence and the extra memory traffic it causes */''}
    </ul>${/* ends the overhead list */''}
    <p>So real performance often rises, <b>peaks</b>, and then <b>falls</b> as cores are added: past the peak each new core costs more than it contributes. A simple illustrative model: time = (1 − f) + f / N + overhead × (N − 1). With f = 0.9 and 1% overhead per extra core, the best is about 3.57× at 9 or 10 cores, and 64 cores manage only 1.34×. Amdahl's law on its own never predicts a slowdown (its speedup always rises with N); only overhead can.</p>${/* notes paragraph: speed rises, peaks and falls; the toy overhead model and its numbers */''}
    <p>Not all software hits this wall. <b>Database management systems</b> and <b>Java applications</b> are examples that can scale well on multicore: they serve many independent requests at once, so almost all of the work is parallel (f close to 1) and each extra core simply takes on more requests.</p>${/* notes paragraph: databases and Java applications scale well because their requests are independent */''}

    <h3>Four kinds of applications that benefit from multicore</h3>${/* notes heading: four kinds of applications that benefit from multicore */''}
    <table>${/* starts the table of the four kinds */''}
      <tr><th>Kind</th><th>Shape</th><th>Examples</th></tr>${/* table header: kind, shape, examples */''}
      <tr><td>Multithreaded native applications</td><td>A few processes, each with many threads; compiled to run directly on the hardware</td><td>Lotus Domino, Siebel CRM</td></tr>${/* table row: multithreaded native applications */''}
      <tr><td>Multiprocess applications</td><td>Many processes, each single-threaded; the OS runs them on different cores</td><td>Oracle database, SAP, PeopleSoft</td></tr>${/* table row: multiprocess applications */''}
      <tr><td>Java applications</td><td>Java supports threads directly and the Java virtual machine is itself multithreaded (garbage collection, compiling); Java EE application servers serve many requests in parallel</td><td>Java EE application servers, the JVM</td></tr>${/* table row: Java applications */''}
      <tr><td>Multi-instance applications</td><td>Several copies of the same program run at once, often each in its own virtual machine for isolation; helps even if one copy cannot use many cores</td><td>Copies running in parallel virtual machines</td></tr>${/* table row: multi-instance applications */''}
    </table>${/* ends the table of kinds */''}
    <p>In every case the OS ends up with many runnable threads to place on different cores; the difference is who created them.</p>${/* notes paragraph: in every case the OS gets many threads; only who created them differs */''}

    <h3>Game engine example: re-threading Valve's Source engine</h3>${/* notes heading: the game-engine re-threading example */''}
    <p>Valve rebuilt its Source game engine to use multicore chips and weighed three threading strategies:</p>${/* notes paragraph: the engine weighed three threading strategies */''}
    <ul>${/* starts the list of strategies */''}
      <li><b>Coarse-grained threading</b>: each module (rendering, AI, physics and so on) is its own single thread on its own processor, and a <b>timeline thread</b> keeps the module threads in step each frame. Simple, but a frame cannot finish before its biggest module does. Valve saw up to 2× on two processors only in contrived cases; in real gameplay the gain was about <b>1.2×</b>.</li>${/* strategy: coarse-grained threading and its real-world gain of about 1.2 times */''}
      <li><b>Fine-grained threading</b>: many similar or identical tasks, such as the iterations of a loop over an array, are spread across all processors. Cores stay busy, but every split adds coordination overhead, and Valve found it hard to use well: each unit of work takes a variable time, and keeping outcomes and their consequences in order made the code complex.</li>${/* strategy: fine-grained threading and why it was hard to use well */''}
      <li><b>Hybrid threading</b>: fine-grained threading for the systems worth splitting, single threading for the others. Valve found this the <b>most promising</b>, expected to scale best to 8 or 16 processors. Sound mixing (little user interaction, its own data, not tied to the frame) stays on one processor; scene rendering is spread over many threads.</li>${/* strategy: hybrid threading, the most promising, with sound on one core and rendering spread out */''}
    </ul>${/* ends the strategy list */''}
    <table>${/* starts the table of toy frame times from the four-core lab */''}
      <tr><th>Toy frame: 24 ms of work, 4 cores, 0.5 ms sync per split</th><th>Frame time</th></tr>${/* table header: the toy frame's assumptions and its frame time */''}
      <tr><td>One thread</td><td>24 ms</td></tr>${/* table row: one thread, 24 ms */''}
      <tr><td>Coarse-grained (best arrangement; the 12 ms renderer is the floor)</td><td>12 ms (2×)</td></tr>${/* table row: coarse-grained, 12 ms at best */''}
      <tr><td>Fine-grained (every system split; 3 ms of the frame is sync overhead)</td><td>9 ms</td></tr>${/* table row: fine-grained, 9 ms with 3 ms of sync overhead */''}
      <tr><td>Hybrid (split only rendering and physics)</td><td>7.5 ms (3.2×)</td></tr>${/* table row: hybrid, 7.5 ms */''}
    </table>${/* ends the toy frame table */''}
    <h4>Inside the re-threaded renderer</h4>${/* notes subheading: inside the re-threaded renderer */''}
    <ol>${/* starts the numbered list of renderer techniques */''}
      <li><b>Many readers, one writer</b>: threads read the shared world data about 95% of the time and write it at most 5%. Locking the whole world for each thread was far too slow, so a <b>single-writer, multiple-readers lock</b> lets any number of readers in together; only a writer needs exclusive access.</li>${/* technique 1: the single-writer, multiple-readers lock on world data */''}
      <li><b>Scene lists</b> (the visible objects) for several views are built in parallel: the world from the main camera, its reflection in water, a shadow view.</li>${/* technique 2: scene lists for several views built in parallel */''}
      <li><b>Per-object work</b>, such as the bone transformations of every character in every scene, is spread over all cores, and graphics simulation (such as particles) is overlapped with it.</li>${/* technique 3: per-object work such as bone transformations spread over all cores */''}
      <li>Several threads "draw" in parallel, appending drawing commands to a <b>lock-free queue</b> (an atomic compare_and_swap per append, retried on a clash), so no thread sleeps on a lock.</li>${/* technique 4: drawing commands appended to a lock-free queue */''}
      <li>A <b>single render thread</b> owns the graphics API (which took commands from one thread at a time), drains the queue and submits to the GPU in order.</li>${/* technique 5: one render thread owns the graphics API and feeds the GPU */''}
    </ol>${/* ends the list of techniques */''}
    <p>Goals: avoid locking, share data that is mostly read, keep every thread busy (workers pull the next task the moment they are free), and give the graphics API one owner. In the step-through model, the 12 ms of rendering work that one core needs (the same Rendering block as the four-core lab) finishes in about 3.3 ms on four cores, close to the ideal 12 ÷ 4 = 3 ms, with the cores about 91% busy instead of 25%.</p>`,  // notes paragraph: the design goals and the 12 ms to 3.3 ms result; end of the notes text
});  // ends the section object and the call that registers section 4.3
