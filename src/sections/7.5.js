// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   7A (id 7.5) Loading and Linking
   Original teaching material. Helpers shared by several steps live
   inside this IIFE, so nothing leaks into the global scope.
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file

  /* An SVG group that acts as a button: click, Enter or Space runs onAct. */
  function hotGroup(ctx, onAct, label, ...kids) {  // hotGroup(ctx, onAct, label, ...kids): bundles SVG shapes into one clickable group that the keyboard can also reach
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // builds the SVG group (g); tabindex 0 lets Tab reach it, and role button plus the label tell screen readers what it is
    g.addEventListener('click', onAct);  // a mouse click on any shape in the group runs the action
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });  // Enter or Space runs the same action from the keyboard; preventDefault stops Space from scrolling the page
    return g;  // hands the finished group back so the caller can put it in the drawing
  }  // ends hotGroup

  /* Multi-line SVG text: one tspan per line, lh units apart. */
  function mtext(s, x, y, lines, attrs = {}, lh = 17) {  // mtext(s, x, y, lines, attrs, lh): writes several lines of SVG text, since SVG text never wraps by itself
    const t = s('text', Object.assign({ x, y }, attrs));  // creates one text element at (x, y), adding any extra settings such as size or alignment from attrs
    [].concat(lines).forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));  // adds one tspan (a line inside SVG text) per line; every line after the first moves down by lh units
    return t;  // hands back the finished multi-line label
  }  // ends mtext

  /* Narration box: tone is '', 'ok', 'bad' or 'warn'. */
  function narrate(box, html, tone) {  // narrate(box, html, tone): writes a message into a narration box and colours it by its tone
    box.className = 'narr' + (tone ? ' ' + tone : '');  // resets the box's classes to narr plus the tone (ok = green, bad = red, warn = amber), so old colours never linger
    box.innerHTML = html;  // puts the message into the box; it may contain bold text and code tags
  }  // ends narrate

  /* The toy module used by every loading step: nine words that add 2 to a counter until it reaches 6.
     An entry with `a` has an address field (relative to the start of the module); an entry with `data`
     is a plain number. `sym` is the name the programmer used for that address. */
  const LOOP = [  // LOOP: the nine-word toy program that the absolute, relocatable and swapping steps all load
    { op: 'LOAD', a: 6, sym: 'count', note: 'put count in the accumulator' },  // word 0: LOAD count, whose address field 6 points at the count data word
    { op: 'ADD', a: 7, sym: 'step', note: 'add step to it' },  // word 1: ADD step, whose address field 7 points at the step data word
    { op: 'STORE', a: 6, sym: 'count', note: 'save the result as the new count' },  // word 2: STORE count writes the new total back into word 6
    { op: 'SUB', a: 8, sym: 'limit', note: 'subtract limit (count − limit)' },  // word 3: SUB limit, whose address field 8 points at the limit word; the result is count minus the limit
    { op: 'JNEG', a: 0, sym: 'top', note: 'negative, so count < limit: go back to word 0' },  // word 4: JNEG 0 jumps back to the top of the loop while the result is negative (sym top means word 0)
    { op: 'HALT', note: 'count has reached limit: stop' },  // word 5: HALT, the one instruction with no address field, ends the program
    { data: 0, name: 'count', note: 'data: the counter, starts at 0' },  // word 6: the data word count, which starts at 0
    { data: 2, name: 'step', note: 'data: the plain number 2' },  // word 7: the data word step, the plain number 2 added on each pass
    { data: 6, name: 'limit', note: 'data: the plain number 6' },  // word 8: the data word limit, the plain number 6; it looks like an address but must never be adjusted
  ];  // closes the LOOP list
  /* The relocation dictionary is computed, never typed: every word that holds an address. */
  const RELOC = LOOP.map((w, i) => (w.a != null ? i : -1)).filter((i) => i >= 0);  // RELOC: the word numbers of every LOOP entry with an address field (0 to 4), worked out from LOOP rather than typed
  /* Contents of word i when the address field holds base + a (base 0 = relative form). */
  const wordText = (w, base) => (w.data != null ? String(w.data) : w.a != null ? `${w.op} ${w.a + base}` : w.op);  // wordText(w, base): how word w reads when its address field holds base + a; data words show their number, HALT shows itself

  /* Runs the toy module on a tiny accumulator machine. mem maps an absolute address to an entry
     {op, a (absolute)} or {data}. Returns the trace of executed instructions and the final count. */
  function runLoop(mem, start, limitSteps = 60) {  // runLoop(mem, start, limitSteps): actually runs the toy program from a memory map, to prove where its references land
    let pc = start, acc = 0, steps = 0;  // pc is the program counter (the next word to run), acc the accumulator, steps a safety counter
    const trace = [];  // trace collects the address of every instruction that runs, in order
    const val = (x) => { const w = mem.get(x); return w && w.data != null ? w.data : NaN; };  // val(x): the number stored at address x, or NaN (not a number) when that address holds no data word
    while (steps++ < limitSteps) {  // runs at most limitSteps instructions, so a broken program can never freeze the page
      const w = mem.get(pc);  // fetches the word at the program counter
      if (!w || w.op == null) return { trace, ok: false, why: 'ran into a word that is not an instruction' };  // stops with a failure if the program counter lands on empty memory or on a data word
      trace.push(pc);  // records that this instruction ran
      if (w.op === 'HALT') return { trace, ok: true };  // HALT ends the run successfully
      if (w.op === 'LOAD') acc = val(w.a);  // LOAD copies the data at its address into the accumulator
      else if (w.op === 'ADD') acc += val(w.a);  // ADD adds the data at its address to the accumulator
      else if (w.op === 'SUB') acc -= val(w.a);  // SUB subtracts the data at its address from the accumulator
      else if (w.op === 'STORE') { const t = mem.get(w.a); if (!t || t.data == null) return { trace, ok: false, why: 'tried to store into a word that is not data' }; t.data = acc; }  // STORE writes the accumulator into its address, failing if that address does not hold a data word
      if (w.op === 'JNEG' && acc < 0) pc = w.a; else pc++;  // JNEG jumps to its address when the accumulator is negative; every other instruction just moves on to the next word
    }  // ends the run loop
    return { trace, ok: false, why: 'never stopped' };  // reaching the step limit means the program never halted, which counts as a failure
  }  // ends runLoop

  Guide.section({  // registers this section with the guide; the object below holds everything the section shows
    id: '7.5',  // the section id, used in links, the progress list and saved progress
    label: '7A',  // the label printed for this appendix in menus and headings, in place of the id
    title: 'Loading and Linking',  // the full title shown at the top of every step
    short: 'Loading and linking',  // the short name used in the side menu and progress list
    summary: 'How separate object modules become one load module, and how a loader turns it into a process.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Trace a program from source files through object modules, the linker, the load module and the loader to a process image in main memory.',  // objective 1: trace a program from source files all the way to a process image
      'Compare absolute loading, relocatable loading (with a relocation dictionary) and dynamic run-time loading, and say which survives being swapped back in at a new address.',  // objective 2: compare the three loading methods and which survives a swap to a new address
      'Name the four times at which addresses can be bound and who does the conversion at each.',  // objective 3: name the four binding times and who converts the addresses at each
      'Compute where each module starts in a load module and rewrite internal and external references.',  // objective 4: compute module start addresses and rewrite references after linking
      'Contrast static linking with load-time and run-time dynamic linking, including shared libraries.',  // objective 5: static linking versus the two kinds of dynamic linking
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Object module', 'The output of compiling or assembling one source file: machine code and data numbered from 0, plus a table of the names it defines and the outside names it still needs.'],  // glossary entry: object module
      ['Load module', 'The single file a linker produces from a set of object modules, laid end to end; it is what the loader copies into memory.'],  // glossary entry: load module
      ['Linker', 'A program that combines object modules into one load module, working out where each module starts and replacing references between modules with addresses.'],  // glossary entry: linker
      ['Loader', 'The part of the operating system that copies a load module into main memory, fixes up its addresses as needed, and so builds the process image.'],  // glossary entry: loader
      ['Symbolic address', 'A name such as count or average that a programmer uses in place of a number; a translator or linker later replaces it with an address.'],  // glossary entry: symbolic address
      ['Relative address', 'An address counted from the start of a module or program (its first word is 0), so it says how far into the program something is, not where it sits in memory.'],  // glossary entry: relative address
      ['Address binding', 'The moment an address in a program is fixed to a real location in main memory. It can happen when the code is written, when it is compiled, when it is loaded, or each time it runs.'],  // glossary entry: address binding and its four possible moments
      ['Absolute loading', 'Loading in which every address in the load module is already a real memory address, so the module must always be placed at the one location it was built for.'],  // glossary entry: absolute loading
      ['Relocatable loading', 'Loading in which the load module holds relative addresses and the loader adds the load address to each of them as it copies the program into memory.'],  // glossary entry: relocatable loading
      ['Relocation dictionary', 'A list, made by the assembler or compiler and carried in the module, of every word that contains an address, so the loader knows exactly which words to adjust.'],  // glossary entry: relocation dictionary
      ['Dynamic run-time loading', 'Loading in which the program keeps its relative addresses even in memory; the processor hardware adds the base register to each address as the instruction runs.'],  // glossary entry: dynamic run-time loading
      ['External reference', 'A use, in one module, of a name defined in a different module, such as a call to a routine in another file. It stays a symbol until the modules are linked.'],  // glossary entry: external reference
      ['Linkage editor', 'A linker that does all the linking in advance, producing one relocatable load module that already contains every module it needs.'],  // glossary entry: linkage editor
      ['Static linking', 'Linking everything, including library routines, into the load module before it runs, so the program carries its own copy of each routine.'],  // glossary entry: static linking
      ['Dynamic linking', 'Deferring the linking of some external modules until after the load module is made, so the load module keeps some unresolved references to be filled in at load time or run time.'],  // glossary entry: dynamic linking
      ['Load-time dynamic linking', 'Dynamic linking done while the program is being loaded: for each reference to an outside module, the loader finds that module, loads it and links it.'],  // glossary entry: load-time dynamic linking
      ['Run-time dynamic linking', 'Dynamic linking postponed until the program actually calls a missing module: only then does the OS find it, load it and link it.'],  // glossary entry: run-time dynamic linking
      ['Shared library', 'A file of routines that the OS links into programs dynamically; one copy in memory can serve many processes. Called a .so file on Linux and a dynamic link library (DLL, .dll) on Windows.'],  // glossary entry: shared library, with its Linux and Windows names
      ['Dynamic link library (DLL)', 'Windows name for a shared library: a file of routines linked into programs at load time or run time, with one copy in memory shared by many processes.'],  // glossary entry: dynamic link library (DLL), the Windows term
    ],  // closes the glossary terms list
    css: ` /* css: this section's own style rules, added to the page when the section loads; each starts with .sec-7-5 so it touches only this section */
      .sec-7-5 .split > *, .sec-7-5 .grid-2 > *, .sec-7-5 .grid-3 > *, .sec-7-5 .cols > * { min-width: 0; } /* lets grid columns and cells shrink below their content width, so a wide table or drawing cannot stretch the layout */
      .sec-7-5 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 8px 12px; font-size: 15px; line-height: 1.45; } /* the narration box: a tinted panel with a thick left stripe in the chapter colour, rounded corners and easy-to-read text */
      .sec-7-5 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* green narration box, used when every reference lands where it should */
      .sec-7-5 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* red narration box, used when something breaks */
      .sec-7-5 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); } /* amber narration box, used for a warning such as a module still tied to one address */
      .sec-7-5 .hot { cursor: pointer; } /* clickable diagram shapes (made by hotGroup) show the pointing-hand cursor */
      .sec-7-5 .hot:focus { outline: none; } /* removes the browser's default focus rectangle from those shapes, which would look odd around SVG */
      .sec-7-5 .hot:focus-visible > :first-child { stroke-width: 4; } /* instead, keyboard focus thickens the border of the group's first shape, so keyboard users still see where they are */
      .sec-7-5 .tx-ok { fill: var(--ok); } .sec-7-5 .tx-bad { fill: var(--bad); } .sec-7-5 .tx-acc { fill: var(--accent); } /* colour classes for SVG text: green (ok), red (bad) and the accent indigo */
      .sec-7-5 .tx-mem { fill: var(--mem); } .sec-7-5 .tx-os { fill: var(--os); } .sec-7-5 .tx-io { fill: var(--io); } .sec-7-5 .tx-proc { fill: var(--proc); } /* more SVG text colours: memory green, OS purple, I/O orange and process teal */
      .sec-7-5 .c-ok { color: var(--ok); } .sec-7-5 .c-bad { color: var(--bad); } .sec-7-5 .c-acc { color: var(--accent); } /* colour classes for ordinary page text: green, red and the accent indigo */
      .sec-7-5 .c-mem { color: var(--mem); } .sec-7-5 .c-os { color: var(--os); } .sec-7-5 .c-io { color: var(--io); } .sec-7-5 .c-warn { color: var(--warn); } /* more page text colours: memory, OS, I/O and the amber warning colour */
      .sec-7-5 .snip { font-family: var(--mono); font-size: 13.5px; line-height: 1.45; background: var(--panel-3); border-radius: 8px; padding: 6px 9px; white-space: pre; overflow-x: auto; margin: 0; } /* .snip: the code snippet boxes; fixed-width font, grey panel, line breaks kept exactly, sideways scrolling if a line is too long */
      .sec-7-5 .addr { font-family: var(--mono); font-weight: 700; } /* .addr: bold fixed-width text for printing an address */
      .sec-7-5 table.tbl td.mono, .sec-7-5 table.tbl td .mono { font-size: 14px; } /* makes fixed-width text inside tables slightly smaller so the address columns fit */
      .sec-7-5 table.tbl tr.bad td { background: var(--bad-bg); } /* a table row marked bad gets a pale red fill, for a reference that misses */
      .sec-7-5 table.tbl tr.ok td { background: var(--ok-bg); } /* a table row marked ok gets a pale green fill, for a reference that lands correctly */
      .sec-7-5 .cols { display: grid; gap: 14px; } /* .cols: a grid with 14px gaps; each place that uses it sets its own column sizes */
      .sec-7-5 table.tbl.tight th, .sec-7-5 table.tbl.tight td { padding: 3px 8px; } /* a tight table uses smaller cell padding so a nine-row program table fits on one slide */
    `,  // end of the css text
    steps: [  // steps: the slides of this section, in the order the student sees them
      /* ---------------- 1. Big picture: the trip from source code to process ---------------- */
      {  // step 1 begins
        title: 'From source files to a running process',  // the title shown at the top of step 1
        kind: 'story',  // a story step, labelled Big Picture above the title
        render(el, ctx) {  // render(el, ctx): draws this step into el when the slide opens; ctx is the guide's toolbox for the step
          const { h, s } = ctx;  // pulls out h (builds page elements) and s (builds SVG drawing elements) from the toolbox
          const MAIN = 60, STATS = 40, AT = 3000, CALL_AVG = 12, CALL_PRINT = 20;  // the example's numbers: main module 60 words, stats module 40 words, loaded at 3000, calls at words 12 and 20
          const AVG = MAIN; // after linking, average starts right after main.o
          const STAGES = [  // STAGES: the eight boxes of the diagram, each with its key, name, position and the text shown when it is chosen
            { k: 'src', name: 'Source files', file: 1, x: 75, sub: 'main.c, stats.c',  // stage 1: the source files, a file box at the far left whose small label names the two files
              body: `Two files a programmer wrote. <code>main.c</code> calls <code>average</code>, which is defined in the other file, and <code>print</code>, which lives in a library. Nothing has an address yet, only names.`,  // explanation for stage 1: two hand-written files that use names only, no addresses yet
              snip: [['main.c', 'avg = average(marks, 3);\nprint(avg);'], ['stats.c', 'int average(int m[], int n) {\n  ...\n}']] },  // snippets for stage 1: the line that calls average and print, and the start of the average function
            { k: 'comp', name: 'Compiler / assembler', tool: 1, x: 225, lines: ['Compiler /', 'assembler'],  // stage 2: the compiler or assembler, a tool drawn as a pill with a two-line label
              body: `Translates <b>one file at a time</b> into machine code. Inside its own file it numbers the words from 0, so it can fill in those addresses. It cannot know where <code>average</code> or <code>print</code> will end up, so it leaves them as <span class="t">symbolic addresses</span> (plain names).`,  // explanation for stage 2: one file at a time; outside names are left as symbolic addresses
              snip: [['input → output', 'main.c  → main.o\nstats.c → stats.o']] },  // snippet for stage 2: which source file becomes which object module
            { k: 'obj', name: 'Object modules', file: 1, x: 380, sub: 'main.o, stats.o',  // stage 3: the two object modules
              body: `Each <span class="t">object module</span> is numbered from its own word 0: main.o is ${MAIN} words long, stats.o is ${STATS}. Each carries a table of the names it defines and the names it still needs.`,  // explanation for stage 3: each module numbered from its own word 0, with tables of names defined and needed
              snip: [['main.o', `length ${MAIN}\n${CALL_AVG}: CALL average  ?\n${CALL_PRINT}: CALL print    ?\nneeds: average, print`], ['stats.o', `length ${STATS}\n 0: average begins\ndefines: average @ 0\nneeds: nothing`]] },  // snippets for stage 3: each module's length, its unresolved calls marked with ?, and its defines and needs lists
            { k: 'link', name: 'Linker', tool: 1, x: 535, lines: ['Linker'],  // stage 4: the linker, a one-line tool pill
              body: `The <span class="t">linker</span> lays main.o at words 0–${MAIN - 1} and stats.o right after it, at ${MAIN}–${MAIN + STATS - 1}. Now it knows <code>average</code> starts at ${AVG}, so <code>CALL average</code> becomes <code>CALL ${AVG}</code>. <code>print</code> comes from a library: a static linker copies it in now, a dynamic one leaves the name for later.`,  // explanation for stage 4: modules laid end to end, the call to average resolved, print left for static or dynamic linking
              snip: [['what the linker computes', `main.o  starts at 0\nstats.o starts at 0 + ${MAIN} = ${AVG}\naverage → ${AVG}`]] },  // snippet for stage 4: the sum that gives the second module's start address
            { k: 'lm', name: 'Load module', file: 1, x: 690, sub: 'prog',  // stage 5: the load module, the single file named prog
              body: `One <span class="t">load module</span> of ${MAIN + STATS} words, numbered 0–${MAIN + STATS - 1}. Its addresses still count from its own start, because nobody knows yet where in memory it will go. Here <code>print</code> is left open, to be linked dynamically.`,  // explanation for stage 5: one 100-word module that still counts addresses from its own start, with print left open
              snip: [['prog', `${CALL_AVG}: CALL ${AVG}     average, resolved\n${CALL_PRINT}: CALL print  to be linked later\n${AVG}: average begins`]] },  // snippet for stage 5: the call to average now holds a number, the call to print still holds a name
            { k: 'loader', name: 'Loader (OS)', tool: 1, os: 1, x: 845, lines: ['Loader', '(part of the OS)'],  // stage 6: the loader, drawn in OS purple (os flag) because it is part of the operating system
              body: `The <span class="t">loader</span> finds free memory (say, starting at ${AT}), copies the load module there, makes its addresses work at that spot, and attaches the library that holds <code>print</code>. The next steps show three ways to handle the addresses.`,  // explanation for stage 6: find room at the load address, copy, fix the addresses and attach the library
              snip: [['the loader’s jobs', `find room   → ${AT}–${AT + MAIN + STATS - 1}\ncopy prog   into that room\nfix addresses (3 methods, next)\nlink print  from the shared library`]] },  // snippet for stage 6: the loader's four jobs, with the memory range it chose
            { k: 'img', name: 'Process image', mem: 1, x: 1035, sub: 'in main memory',  // stage 7: the process image in main memory, drawn as a wider green box
              body: `The program now sits at ${AT}–${AT + MAIN + STATS - 1}, wrapped in a <span class="t">process image</span>: code and data, a stack, and the process control block (chapter 3). The call to <code>average</code> reaches ${AT} + ${AVG} = <b>${AT + AVG}</b>.`,  // explanation for stage 7: the program inside its process image, and the real address the call to average now reaches
              snip: [['main memory', `${AT}: main begins\n${AT + CALL_AVG}: CALL → reaches ${AT + AVG}\n${AT + AVG}: average begins\n${AT + MAIN + STATS - 1}: last word of prog`]] },  // snippet for stage 7: a small memory map of where main, the call and average sit at real addresses
            { k: 'dyn', name: 'Shared library', file: 1, dyn: 1, x: 845, sub: 'libio.so',  // stage 8: the shared library, drawn off the main path below the loader (dyn flag)
              body: `A <span class="t">shared library</span> such as <code>libio.so</code> (Linux) or <code>io.dll</code> (Windows) holds <code>print</code>. It is not copied into prog. It joins when prog is loaded or the first time <code>print</code> is called, and one copy in memory serves every program that uses it.`,  // explanation for stage 8: the library is not copied in; it joins at load or on the first call and is shared
              snip: [['libio.so', 'print begins\n... shared by every\nprocess that calls print']] },  // snippet for stage 8: the library holding print, shared by every process that calls it
          ];  // closes the STAGES list
          // two layouts: one row across the slide, or a column on a small screen
          const SLIM = ctx.narrow;  // SLIM is the guide's phone-width flag: true on a small screen, where the diagram is drawn as a column
          const svg = s('svg', { viewBox: SLIM ? '0 0 340 430' : '0 0 1150 182', width: '100%' });  // the SVG (the browser's drawing format) canvas: a tall 340 x 430 area on a phone, a wide 1150 x 182 strip otherwise
          const shapes = {};  // shapes: each stage's rectangle stored by key, so the chosen one can be outlined more thickly later
          const geo = (st, i) => {  // geo(st, i): works out the centre, width and height of stage st, the i-th box, for the current layout
            const w = st.tool ? (SLIM ? 170 : 120) : st.mem ? (SLIM ? 220 : 200) : st.dyn && SLIM ? 104 : SLIM ? 200 : 130;  // width: tools 120 (170 on a phone), the process image 200 (220), the library 104 on a phone, other files 130 (200)
            const ht = st.tool ? (SLIM ? 40 : 50) : st.mem ? (SLIM ? 50 : 76) : (SLIM ? 46 : 62);  // height: tools 50 (40 on a phone), the process image 76 (50), file boxes 62 (46)
            if (!SLIM) return { x: st.x, y: st.dyn ? 148 : 62, w, ht };  // wide layout: every box sits in one row at its own x; the shared library drops to a second row below
            if (st.dyn) return { x: 286, y: 323, w, ht };  // phone layout: the shared library sits off to the right, beside the lower boxes
            return { x: 120, y: 26 + i * 58, w, ht };  // phone layout: the other boxes stack in one column, 58 units apart
          };  // ends geo
          const G = STAGES.map(geo);  // G: the computed position and size of every stage, in STAGES order
          // arrows from each stage to the next one along the main path
          for (let i = 0; i < 6; i++) {  // draws the six arrows that join stages 1 to 7 along the main path
            const a = G[i], b = G[i + 1];  // a is the box the arrow leaves, b the box it points at
            svg.append(SLIM  // adds one straight line, chosen for the layout
              ? s('line', { x1: a.x, y1: a.y + a.ht / 2 + 1, x2: b.x, y2: b.y - b.ht / 2 - 4, class: 's-line', 'marker-end': 'url(#arr)' })  // phone layout: from the bottom edge of one box down to the top edge of the next, with an arrowhead
              : s('line', { x1: a.x + a.w / 2 + 2, y1: a.y, x2: b.x - b.w / 2 - 4, y2: b.y, class: 's-line', 'marker-end': 'url(#arr)' }));  // wide layout: from the right edge of one box across to the left edge of the next
          }  // ends the arrow loop
          // the shared library joins the process image at load or run time
          const D = G[7], P = G[6];  // D is the shared library's box and P the process image's box
          svg.append(s('path', { d: SLIM ? `M${D.x},${D.y + D.ht / 2} C${D.x},${P.y} ${P.x + P.w / 2 + 30},${P.y} ${P.x + P.w / 2 + 4},${P.y}` : 'M925,148 C990,148 1035,132 1035,102', class: 's-line', fill: 'none', 'stroke-dasharray': '6 5', 'marker-end': 'url(#arr-proc)', style: 'stroke:var(--proc)' }),  // a dashed teal curve from the library to the process image, worked out from the boxes on a phone, fixed points otherwise
            SLIM ? mtext(s, 288, 398, ['joins at load', 'or run time'], { 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 15)  // phone layout: the "joins at load or run time" label under the library box
              : mtext(s, 1046, 134, ['joins at load', 'or run time'], { 'font-size': 13, class: 's-sub' }, 15));  // wide layout: the same label to the right of the curve
          STAGES.forEach((st, i) => {  // draws every stage box, with its label, as one clickable group
            const { x, y, w, ht } = G[i];  // takes this stage's centre, width and height from G
            const cls = st.tool ? (st.os ? 's-os' : 's-accent') : st.mem ? 's-mem' : st.dyn ? 's-proc' : 's-panel';  // colour: the loader in OS purple, other tools in indigo, the process image green, the library teal, files neutral
            const shape = s('rect', { x: x - w / 2, y: y - ht / 2, width: w, height: ht, rx: st.tool ? ht / 2 : 8, class: cls, 'stroke-width': 2 });  // the box itself, centred on (x, y); tools get fully rounded ends, files get softly rounded corners
            const kids = [shape];  // kids: the parts of this clickable group, starting with the box
            const nameSize = SLIM ? (st.dyn ? 13 : 15) : 15.5;  // the font size of the stage name, a little smaller for the side library box on a phone
            if (st.tool) kids.push(mtext(s, x, y + (st.lines.length === 1 || SLIM ? 5 : -3), SLIM ? [st.lines.join(' ')] : st.lines, { 'text-anchor': 'middle', 'font-size': st.lines.length === 1 ? 16 : 14, 'font-weight': 700 }, 16));  // a tool gets its label lines, joined into one line on a phone, larger when the label is a single word
            else kids.push(s('text', { x, y: y - (SLIM ? 2 : 4), 'text-anchor': 'middle', 'font-size': nameSize, 'font-weight': 800 }, st.name),  // a file box gets its bold name just above the middle
              s('text', { x, y: y + (SLIM ? 15 : 16), 'text-anchor': 'middle', 'font-size': SLIM ? 12.5 : 13, class: 's-sub s-monot' }, st.sub));  // and under it, in grey fixed-width type, the small label such as the file names
            shapes[st.k] = shape;  // remembers the box under the stage's key so pick() can thicken it
            svg.append(hotGroup(ctx, () => pick(i), st.name, ...kids));  // wraps the parts in a clickable group; clicking it or pressing Enter shows this stage's details
          });  // ends the loop over stages
          svg.append(SLIM ? mtext(s, 228, 22, ['written', 'by people'], { 'font-size': 13, class: 's-sub' }, 15) : s('text', { x: 75, y: 120, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'written by people'),  // the "written by people" note beside the source files (phone) or under them (wide)
            SLIM ? s('text', { x: 120, y: 418, 'text-anchor': 'middle', 'font-size': 13, class: 'tx-mem', 'font-weight': 700 }, 'a process') : s('text', { x: 1035, y: 18, 'text-anchor': 'middle', 'font-size': 13, class: 'tx-mem', 'font-weight': 700 }, 'a process'));  // the green "a process" label below the process image (phone) or above it (wide)
          const title = h('div', { class: 'b', style: { fontSize: '17px' } });  // title: the bold heading of the details card, filled with the chosen stage's name
          const body = h('p', { class: 'small m0', style: { lineHeight: '1.5' } });  // body: the paragraph that explains the chosen stage
          const snips = h('div', { class: 'row', style: { gap: '10px', alignItems: 'stretch', flexDirection: SLIM ? 'column' : 'row' } });  // snips: the row of code snippets for the chosen stage, stacked in a column on a phone
          const count = h('span', { class: 'xs muted' });  // count: the small "stage 3 of 8" counter
          let cur = 0;  // cur: the position of the stage now shown in the details card
          function pick(i) {  // pick(i): shows stage i in the details card and outlines its box; runs on a box click and on Previous or Next
            cur = (i + STAGES.length) % STAGES.length;  // wraps around both ends, so Previous on stage 1 goes to stage 8 and Next on stage 8 returns to stage 1
            const st = STAGES[cur];  // st: the data of the chosen stage
            title.innerHTML = st.name;  // puts the stage name in the card's heading
            body.innerHTML = st.body;  // puts the stage explanation in the card's paragraph
            snips.replaceChildren(...st.snip.map(([lab, txt]) => h('div', { style: { flex: SLIM ? 'none' : '1 1 0', minWidth: '0' } },  // replaces the snippets: each gets a box that shares the row equally, or takes its natural size in the phone column
              h('div', { class: 'xs b muted', style: { marginBottom: '2px' } }, lab), h('pre', { class: 'snip' }, txt))));  // each snippet is a small grey label over a pre box (pre keeps line breaks and spaces exactly) holding the text
            count.textContent = `stage ${cur + 1} of ${STAGES.length}`;  // updates the counter under the heading
            for (const [k, sh] of Object.entries(shapes)) sh.setAttribute('stroke-width', k === st.k ? 4.5 : 2);  // gives the chosen stage's box a thick 4.5 border and every other box the normal 2
          }  // ends pick
          const nav = h('div', { class: 'row', style: { gap: '6px', marginLeft: 'auto' } }, count,  // nav: the counter and the two buttons, pushed to the right end of the heading row
            h('button', { class: 'btn sm', 'aria-label': 'Previous stage', onclick: () => pick(cur - 1) }, '◀'),  // Previous button: an arrow only, with a label that screen readers announce
            h('button', { class: 'btn sm', 'aria-label': 'Next stage', onclick: () => pick(cur + 1) }, 'Next stage ▶'));  // Next stage button
          pick(0);  // shows stage 1 as soon as the slide opens
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // puts the step on screen: one column that fills the step's height
            h('p', { class: 'lead m0', html: 'A program on disk is just a file. To run, it must become a process: its code and data copied into main memory at real addresses, every reference pointing at the right word. Click each stage to follow one small program on that trip.' }),  // opening paragraph: a file on disk must become a process, and each stage can be clicked
            h('div', { class: 'card white', style: { padding: '6px 10px', flex: 'none' } }, svg),  // a white card holding the diagram; flex none keeps it at its natural height
            h('div', { class: 'split r grow', style: { gap: '16px' } },  // under it, two columns, the left one wider, taking all the remaining height
              h('div', { class: 'card stack', style: { gap: '8px', padding: '10px 14px' } }, h('div', { class: SLIM ? 'row' : 'row nw' }, title, nav), body, snips),  // the details card: heading row (title and buttons, allowed to wrap on a phone), the explanation, then the snippets
              h('div', { class: 'stack', style: { gap: '10px' } },  // the right column holds two callouts
                h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'Authors each write a chapter, number its pages from 1, and cite other chapters by title. An editor binds the chapters into one book, works out where each one now starts, and turns “see the sorting chapter” into “see page 301”. That editor is the linker.' }),  // analogy callout: chapter authors cite each other by title, and the editor who binds them plays the linker
                h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Real software is built from separately compiled modules. Linking and loading make those pieces work together, wherever memory has room.' })))));  // why-it-matters callout: real software is built from separate modules; this also closes the whole layout
        },  // ends render for step 1
      },  // ends step 1
      /* ---------------- 2. Absolute loading: one program, one fixed place ---------------- */
      {  // step 2 begins
        title: 'Absolute loading: real addresses, one fixed place',  // the title shown at the top of step 2
        kind: 'explore',  // an explore step, labelled Explore above the title
        render(el, ctx) {  // render(el, ctx): builds step 2 when its slide opens
          const { h } = ctx;  // pulls out h, the page element builder
          const ORG = 1000, INS_AT = 3;  // ORG: the one start address the program is built for; INS_AT: the word where a new instruction is slipped in
          const NEW = { op: 'OUT', a: 6, sym: 'count', note: 'print count (the new line)', added: true };  // NEW: the extra instruction OUT count, which prints count; added marks it as the new line in the table
          let mode = 'prog', inserted = false;  // mode: who turned names into numbers (prog = the programmer, asm = the assembler); inserted: whether NEW is in place
          const SLIM = ctx.narrow; // a small screen gets shorter column labels
          // where every name lives when the program starts at ORG: top is word 0, data names are their own word
          const layout = (prog) => {  // layout(prog): a table of where each name really sits when the program starts at ORG
            const m = { top: ORG };  // top, the loop's first word, is always at ORG
            prog.forEach((w, i) => { if (w.name) m[w.name] = ORG + i; });  // each data word's name sits at ORG plus its position in the program
            return m;  // hands back the table of names
          };  // ends layout
          const before = layout(LOOP);  // before: where every name sat before any insertion (count 1006, step 1007, limit 1008)
          const nameAt = (prog, x) => {  // nameAt(prog, x): what an address x really lands on in the current program, used to name a wrong target
            const w = prog[x - ORG];  // finds the word at x by counting from ORG
            if (!w) return 'outside the program';  // an address past either end of the program lands outside it
            return w.name ? w.name : w.op;  // a data word is named by its name, an instruction by its operation
          };  // ends nameAt
          const tbody = h('tbody');  // tbody: the table body that draw() fills with one row per word
          const symRow = h('div', { class: 'row', style: { gap: '6px' } });  // symRow: the row of chips that shows where each name sits
          const out = h('div', { class: 'narr' });  // out: the narration box under the table
          function draw() {  // draw(): rebuilds the table, the chips and the message; runs at the start and after every switch or button press
            const prog = inserted ? [...LOOP.slice(0, INS_AT), NEW, ...LOOP.slice(INS_AT)] : LOOP;  // prog: the program as it now stands, either LOOP or LOOP with NEW slipped in before word 3
            const now = layout(prog);  // now: where each name sits in that program
            let wrong = 0, total = 0;  // wrong counts the old address fields that now miss; total counts all old address fields
            tbody.replaceChildren(...prog.map((w, i) => {  // builds one table row per word of the program
              const at = ORG + i;  // at: the real memory address of this word
              let wrote, holds, status = '', cls = w.added ? 'on' : '';  // wrote, holds and status fill the row's cells; the new word's row is highlighted (class on)
              if (w.data != null) {  // a data word
                wrote = mode === 'prog' ? String(w.data) : `${w.name}: ${w.data}`;  // the programmer wrote just the number, or with the assembler a labelled line such as count: 0
                holds = String(w.data);  // the module holds the plain number either way
                status = `<span class="muted">data: ${w.name}</span>`;  // status: a grey note naming the data word
              } else if (w.a == null) {  // an instruction with no address field (HALT)
                wrote = holds = w.op;  // written and held exactly as its operation name
              } else {  // an instruction with an address field
                if (!w.added) total++;  // counts every old address field, leaving out the new word
                // a hand-written operand was typed against the layout that existed when it was written
                const typed = mode === 'prog' ? (w.added ? now[w.sym] : before[w.sym]) : now[w.sym];  // typed: the number in the field; hand-typed old words keep the old layout, while the assembler always uses the new one
                wrote = mode === 'prog' ? `${w.op} ${typed}` : `${i === 0 ? 'top: ' : ''}${w.op} ${w.sym}`;  // wrote: the number itself when hand-typed, or the name when the assembler converts (word 0 also shows its top label)
                holds = `${w.op} ${typed}`;  // holds: what the module really contains, the operation and that number
                if (typed === now[w.sym]) status = `<span class="c-ok b">✓</span> ${SLIM ? '' : 'reaches '}${w.sym}`;  // if the number still matches where the name sits, a green tick says it reaches that name
                else { wrong++; cls = 'bad'; status = `<span class="c-bad b">✗</span> ${SLIM ? '' : 'hits '}${nameAt(prog, typed)}${SLIM ? ` (${w.sym} at ${now[w.sym]})` : `; ${w.sym} moved to ${now[w.sym]}`}`; }  // otherwise it counts as wrong, the row turns red, and the note says what it hits instead and where the name moved
              }  // ends the three kinds of word
              const nw = { whiteSpace: 'nowrap' };  // nw: a style that keeps a cell's text on one line
              return h('tr', { class: cls }, h('td', { class: 'mono' }, String(at)), h('td', { class: 'mono', style: nw }, wrote), h('td', { class: 'mono b', style: nw }, holds), h('td', { class: 'small', html: status }));  // the row: address, what was written, what the module holds (bold), and where it really points
            }));  // ends the row building
            symRow.replaceChildren(h('span', { class: 'xs b muted' }, mode === 'prog' ? 'Where each name now sits:' : 'Symbol table (start 1000):'),  // the chip row's label: where each name now sits, or the assembler's symbol table for a start of 1000
              ...['top', 'count', 'step', 'limit'].map((k) => h('span', { class: 'chip ' + (now[k] !== before[k] ? 'warn' : 'accent') }, `${k} = ${now[k]}`)));  // one chip per name with its address, amber if it moved since the insert and indigo if it did not
            if (!inserted) narrate(out, `All ${total} address fields reach the right word, but only because the program sits at <b>${ORG}</b>. Now insert an instruction and watch what happens to the words below it.`, '');  // message before any insert: every field is right, but only because the program sits at 1000
            else if (mode === 'prog') narrate(out, `Every word below the new one moved down by one. <b>${wrong} of the ${total}</b> old address fields now point at the wrong word, and nothing warns you: each must be found and retyped by hand.`, 'bad');  // message after an insert with hand-typed numbers (red): how many old fields now point at the wrong word
            else narrate(out, `The words still moved, but the programmer only typed names. Re-assembling recomputed all <b>${total + 1}</b> address fields, so nothing is fixed by hand. The module is still bound to <b>${ORG}</b>: it cannot run anywhere else.`, 'warn');  // message after an insert with the assembler (amber): every field recomputed, yet the module is still bound to 1000
          }  // ends draw
          const seg = ctx.ui.seg([{ value: 'prog', label: 'Programmer types numbers' }, { value: 'asm', label: 'Assembler converts names' }], mode, (v) => { mode = v; draw(); });  // seg: a two-button switch between hand-typed numbers and assembler-converted names; switching redraws the table
          const insBtn = h('button', { class: 'btn sm primary', onclick: () => { inserted = !inserted; insBtn.textContent = inserted ? 'Undo the insert' : 'Insert “OUT count” at word 3'; draw(); } }, 'Insert “OUT count” at word 3');  // the insert button: adds or removes OUT count at word 3, changes its own label to match, then redraws
          draw();  // draws the table for the first time
          el.append(h('div', { class: 'split l fill' },  // puts the step on screen in two columns, the left one smaller
            h('div', { class: 'stack', style: { gap: '10px' } },  // the left column holds the explanation
              h('p', { class: 'm0', html: 'In <span class="t">absolute loading</span> every address in the load module is already a real main-memory address. The loader just copies the module, always to the exact spot it was written for. Those addresses are fixed (<i>bound</i>) at one of two times:' }),  // intro paragraph: what absolute loading means and that its addresses are bound at one of two times
              h('ul', { class: 'm0 small', style: { lineHeight: '1.5' }, html: '<li><b>Programming time:</b> the programmer types the numbers themselves, such as <code>LOAD 1006</code>.</li><li><b>Compile or assembly time:</b> the programmer writes a <span class="t">symbolic address</span> (<code>LOAD count</code>) and states where the program will start; the assembler turns every name into a real address.</li>' }),  // bulleted list: the two binding times, programming time and compile or assembly time, each with an example
              h('div', { class: 'callout warn m0 small', 'data-label': 'Two drawbacks', html: '1. It can run at only one place; if that memory is busy, it must wait. 2. Any change that shifts code moves every later address. Assembling from names cures the second drawback, never the first.' }),  // warning callout: the two drawbacks, one fixed place and shifted addresses after any change
              h('div', { class: 'callout tip m0 small', 'data-label': 'Still in use', html: 'Start-up code that runs from read-only memory never moves, so it is still built for one fixed address.' }),  // tip callout: start-up code in read-only memory is still built this way
              h('p', { class: 'xs muted m0', html: 'Toy machine: one accumulator; <code>JNEG</code> jumps if the accumulator is negative. The loop adds 2 to count until it reaches 6.' })),  // small note: how the toy machine's JNEG works and what the loop does
            h('div', { class: 'stack', style: { gap: '8px' } },  // the right column holds the interactive part
              h('div', { class: 'row', style: { gap: '8px', justifyContent: 'space-between' } }, seg, insBtn),  // the mode switch and the insert button at opposite ends of one row
              h('table', { class: 'tbl compact tight' }, h('thead', {}, h('tr', {}, h('th', {}, SLIM ? 'Addr.' : 'Address'), h('th', {}, SLIM ? 'Wrote' : 'Programmer wrote'), h('th', {}, SLIM ? 'Holds' : 'Module holds'), h('th', {}, SLIM ? 'Points to' : 'Where it really points'))), tbody),  // the program table with its column headings, shortened on a phone; draw() fills its body
              symRow, out)));  // the name chips and the narration box under the table; this closes the layout
        },  // ends render for step 2
      },  // ends step 2
      /* ---------------- 3. Relocatable loading: the loader walks the relocation dictionary ---------------- */
      {  // step 3 begins
        title: 'Relocatable loading: the loader patches every address',  // the title shown at the top of step 3
        kind: 'explore',  // an explore step
        render(el, ctx) {  // render(el, ctx): builds step 3 when its slide opens
          const { h } = ctx;  // pulls out h, the page element builder
          let L = 2400;  // L: the load address the loader picks, 2400 to start; the slider changes it
          const tbody = h('tbody');  // tbody: the table body showing each word on disk and in memory
          const dictRow = h('div', { class: 'row', style: { gap: '6px' } });  // dictRow: the row of chips listing the relocation dictionary
          const N = RELOC.length;  // N: how many words the dictionary lists (5)
          // frame 0: module only; 1: copied unchanged; 2..N+1: patch dictionary entry f-2; N+2: done
          const COUNT = N + 3;  // COUNT: the number of animation frames, one for the module, one for the copy, one per entry and one for the result
          function render(f) {  // render(f): draws frame f of the animation and returns its caption; the player calls it on every frame change
            const copied = f >= 1, patched = Math.max(0, Math.min(N, f - 1)), cur = f >= 2 && f <= N + 1 ? RELOC[f - 2] : -1;  // copied is true from frame 1 on; patched counts the entries already applied; cur is the word patched in this frame, or -1
            const done = new Set(RELOC.slice(0, patched));  // done: the words whose address field already has L added, including the one patched in this frame
            tbody.replaceChildren(...LOOP.map((w, i) => {  // builds one table row per word of the program
              const inDict = RELOC.includes(i);  // inDict: whether this word is listed in the relocation dictionary
              const memTxt = !copied ? '—' : wordText(w, done.has(i) ? L : 0);  // memTxt: what memory holds, a dash before the copy, the relative form until patched, then the form with L added
              const cls = i === cur ? 'on' : '';  // the word being patched in this frame is highlighted
              return h('tr', { class: cls },  // the row itself
                h('td', { class: 'mono' }, String(i)),  // the word number within the module
                h('td', { class: 'mono', style: { whiteSpace: 'nowrap' } }, wordText(w, 0)),  // the word as it sits in the load module on disk, with its relative address
                h('td', { class: 'center', html: inDict ? '<span class="c-acc b">✓</span>' : '<span class="muted">–</span>' }),  // a tick when the word is in the dictionary, a dash when it is not
                ctx.narrow ? null : h('td', { class: 'mono' }, String(L + i)),  // the real memory address, L plus the word number; this column is left out on a phone
                h('td', { class: 'mono b', style: { whiteSpace: 'nowrap' }, html: done.has(i) ? `<span class="c-ok">${memTxt}</span>` : memTxt }));  // what memory holds, in bold and turned green once that word has been patched
            }));  // ends the row building
            dictRow.replaceChildren(h('span', { class: 'xs b muted' }, 'Relocation dictionary:'),  // the label at the start of the dictionary row
              ...RELOC.map((j, k) => h('span', { class: 'chip ' + (j === cur ? 'warn' : k < patched ? 'ok' : 'accent') }, 'word ' + j)));  // one chip per entry: amber for the one being patched now, green for those done, indigo for those still waiting
            if (f === 0) return `The <b>load module</b> on disk: 9 words with <b>relative</b> addresses (counted from word 0), plus a <b>relocation dictionary</b> listing the ${N} words that hold an address. The loader has chosen <b>L = ${L}</b>.`;  // caption for the first frame (f = 0): the module on disk, its relative addresses, its dictionary and the chosen L
            if (f === 1) return `First the loader <b>copies</b> all 9 words into memory at ${L}–${L + 8}, unchanged. Right now <code>LOAD 6</code> at ${L} would read memory address 6, far outside the program.`;  // caption for the second frame (f = 1): the plain copy, and why LOAD 6 would now read the wrong place
            if (cur >= 0) { const w = LOOP[cur]; return `Dictionary entry ${f - 1} of ${N}: word ${cur}. Its address field holds ${w.a}, so the loader writes ${w.a} + ${L} = <b>${w.a + L}</b>. Now <code>${w.op} ${w.a + L}</code> reaches ${w.sym === 'top' ? 'word 0, the top of the loop' : w.sym} at its real home.`; }  // caption for each patching frame: which entry, the sum the loader works out, and what the word now reaches
            const mem = new Map(LOOP.map((w, i) => [L + i, w.data != null ? { data: w.data } : { op: w.op, a: w.a != null ? w.a + L : undefined }]));  // final frame: builds a memory map of the patched program at L so it can really be run
            const r = runLoop(mem, L);  // runs the patched program with runLoop
            return `Done: ${N} words patched, and the ${9 - N} words <b>not</b> in the dictionary (HALT and the data) left alone. Running it now executes ${r.trace.length} instructions and leaves count = <b>${mem.get(L + 6).data}</b>.`;  // caption for the final frame: patched and untouched words, how many instructions ran, and the final count
          }  // ends render
          const player = ctx.ui.player({ count: COUNT, render, interval: 1700 });  // player: the step-by-step animation with play, pause and step buttons, advancing every 1.7 seconds when playing
          const slider = ctx.ui.slider({ label: 'Load address L', min: 200, max: 4000, step: 100, value: L, onInput: (v) => { L = v; player.refresh(); } });  // slider for L from 200 to 4000 in steps of 100; moving it redraws the current frame with the new sums
          el.append(h('div', { class: 'split l fill' },  // puts the step on screen in two columns, the left one smaller
            h('div', { class: 'stack', style: { gap: '10px' } },  // the left column holds the explanation
              h('p', { class: 'm0', html: '<span class="t">Relocatable loading</span> waits until load time. The assembler or compiler numbers every address from the start of the module, so it produces <span class="t">relative addresses</span>, and it writes a <span class="t">relocation dictionary</span>: the list of every word that holds an address.' }),  // intro paragraph: relocatable loading, relative addresses and the relocation dictionary
              h('p', { class: 'm0', html: 'When the loader places the module at address <b>L</b>, it walks the dictionary and adds L to each listed word. Every other word is copied untouched.' }),  // paragraph: the loader adds L to each listed word and copies every other word as it is
              h('div', { class: 'callout why m0 small', 'data-label': 'Why the loader needs a list', html: 'Word 8 holds 6 (the limit) and word 0 holds <code>LOAD 6</code>. A loader looking at bits cannot tell an address from a plain number. Adding L to word 8 would quietly change the limit to 6 + L.' }),  // why callout: the loader cannot tell an address from a plain number, so it needs the list
              h('div', { class: 'callout warn m0 small', 'data-label': 'The catch', html: 'After patching, the words in memory hold real addresses for L. If the process is swapped out, it must come back to the very same place. The next step shows why.' }),  // warning callout: once patched, the program must come back to the same place after a swap
              h('p', { class: 'small muted m0', html: '<b>Try it:</b> drag L and step through again. The dictionary never changes with L; only the sums do.' })),  // hint: drag L and step through again; only the sums change
            h('div', { class: 'stack', style: { gap: '8px' } },  // the right column holds the slider, table and player
              slider,  // the load address slider
              h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, ...(ctx.narrow ? ['Word', 'Module', 'Dict.', 'Memory, L + word'] : ['Word', 'Load module', 'In dict.', 'Memory addr.', 'Memory holds']).map((x) => h('th', {}, x)))), tbody),  // the table with its headings, a shorter four-column set on a phone; render fills its body
              dictRow, player.el)));  // the dictionary chips and the player under the table; this closes the layout
        },  // ends render for step 3
      },  // ends step 3
      /* ---------------- 4. Lab: the same module under three loaders, then swapped ---------------- */
      {  // step 4 begins
        title: 'Swap it out, bring it back: which loader survives?',  // the title shown at the top of step 4
        kind: 'lab',  // a lab step, labelled Hands-on Lab
        core: true,  // core: this step is part of the shorter core path through the course
        render(el, ctx) {  // render(el, ctx): builds step 4 when its slide opens
          const { h, s } = ctx;  // pulls out h (page elements) and s (SVG elements)
          const BUILT_FOR = 1000;  // BUILT_FOR: the address the absolute version of the program was assembled for
          // memory, drawn as blocks (not to scale); the two "place" blocks are where P can live
          const BLOCKS = [  // BLOCKS: the strips of the memory map, each with its address range and its position in the drawing
            { lo: 0, hi: 999, x: 8, w: 84, name: 'OS', cls: 's-os' },  // the OS at addresses 0 to 999, in purple
            { lo: 1000, hi: 1199, x: 96, w: 128, place: true },  // the first place where the program P can live, 1000 to 1199
            { lo: 1200, hi: 2399, x: 228, w: 84, name: 'process B', cls: 's-panel' },  // another process, B, at 1200 to 2399
            { lo: 2400, hi: 2599, x: 316, w: 128, place: true },  // the second place where P can live, 2400 to 2599
            { lo: 2600, hi: 3999, x: 448, w: 84, name: 'process D', cls: 's-panel' },  // another process, D, at 2600 to 3999
          ];  // closes the BLOCKS list
          const MODES = {  // MODES: the three loading methods, each with its switch label and the explanation shown in the method card
            abs: { label: 'Absolute', html: 'The module was assembled for <b>1000</b>: its words hold real addresses. The loader only copies.' },  // absolute: real addresses for 1000, and the loader only copies
            rel: { label: 'Relocatable', html: 'The words hold relative addresses plus a relocation dictionary. The loader adds the load address <b>once</b>, while loading.' },  // relocatable: relative addresses plus a dictionary, patched once while loading
            run: { label: 'Dynamic run-time', html: '<span class="t">Dynamic run-time loading</span>: the words keep relative addresses even in memory. On every memory reference the processor adds the <span class="t">base register</span>, which the OS sets to where the process sits now.' },  // dynamic run-time: relative addresses stay, and the processor adds the base register on every reference
          };  // closes MODES
          let mode = 'abs', st;  // mode: the method now chosen; st: the state of the story (where P is, whether it has run)
          const reset = () => { st = { phase: 'disk', at0: null, at1: null, ran: false, seen: { in: {}, back: {} } }; };  // reset(): back to the start, with P on disk, no load address, nothing run and an empty results table
          const cur = () => (st.phase === 'back' ? st.at1 : st.phase === 'in' ? st.at0 : null);  // cur(): where P sits now, the return address after a swap back, the first address after loading, or null on disk
          const other = (p) => (p === 1000 ? 2400 : 1000);  // other(p): the other of the two places, so P can come back somewhere new
          const ePresent = () => (st.phase === 'out' || st.phase === 'back') && st.at1 !== st.at0;  // ePresent(): true once P is swapped out, because process E takes P's old place, unless P later came back there
          function spaceOwner(lo) { if (cur() === lo) return 'P'; if (ePresent() && lo === st.at0) return 'E'; return 'free'; }  // spaceOwner(lo): who holds the place that starts at lo, P, process E or nobody
          // what the address field of a word holds in memory, and the address the hardware finally uses
          const stored = (a) => (mode === 'abs' ? BUILT_FOR + a : mode === 'rel' ? st.at0 + a : a);  // stored(a): the number in an address field in memory, fixed for 1000, patched for the first load address, or left relative
          const eff = (a) => (mode === 'run' ? stored(a) + cur() : stored(a));  // eff(a): the address the hardware finally uses; with run-time loading it adds the base register, the current start
          function owner(x) {  // owner(x): names what sits at address x, for the Lands on column
            const c = cur();  // c: where P sits now
            if (c != null && x >= c && x <= c + 8) { const w = LOOP[x - c]; return `P word ${x - c} (${w.name || w.op})`; }  // an address inside P's nine words is named by its word number and contents
            const b = BLOCKS.find((q) => x >= q.lo && x <= q.hi);  // otherwise, finds the memory block that holds x
            if (!b) return 'outside memory';  // an address past the last block is outside memory
            if (!b.place) return b.name;  // a block that never changes is named directly, such as the OS or process B
            const o = spaceOwner(b.lo);  // one of P's two places: who is in it now
            return o === 'E' ? 'process E' : o === 'P' ? 'unused space' : 'free memory';  // process E, unused space inside P's own place, or free memory
          }  // ends owner
          const svg = s('svg', { viewBox: '0 0 660 116', width: '100%' });  // svg: the memory map drawing
          const tbody = h('tbody');  // tbody: the table of P's five address-holding words
          const modeCard = h('div', { class: 'card tight small', style: { lineHeight: '1.45' } });  // modeCard: the card that explains the chosen method
          const btns = h('div', { class: 'row', style: { gap: '6px' } });  // btns: the action buttons, which change with where P is in the story
          const out = h('div', { class: 'narr' });  // out: the narration box
          const chips = h('div', { class: 'row', style: { gap: '6px' } });  // chips: where P is, and the base register or patch status
          const score = h('table', { class: 'tbl compact' });  // score: the results table, one row per method, for the first load and the return after a swap
          function drawMap(rows) {  // drawMap(rows): redraws the memory map; after a run, rows adds a count of the references that land in each block
            // a row of blocks on the slide; a column of blocks on a small screen
            const SLIM = ctx.narrow;  // SLIM is the guide's phone-width flag
            svg.setAttribute('viewBox', SLIM ? '0 0 340 288' : '0 0 660 116');  // resizes the drawing area: a tall column of blocks on a phone, one wide row otherwise
            const kids = [s('text', { x: SLIM ? 108 : 270, y: 14, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx-mem' }, 'Main memory (not to scale)')];  // kids: the drawing's parts, starting with the green heading "Main memory (not to scale)"
            BLOCKS.forEach((b, i) => {  // draws each memory block
              let cls = b.cls, name = b.name;  // starts from the block's own colour and name
              if (b.place) {  // one of P's two places is coloured by whoever is in it now
                const o = spaceOwner(b.lo);  // o: who is in this place now, P, process E or nobody
                cls = o === 'P' ? 's-proc' : o === 'E' ? 's-warn' : 's-panel';  // colour: teal for P, amber for process E, neutral when free
                name = o === 'P' ? 'P (our program)' : o === 'E' ? 'process E' : 'free';  // label: "P (our program)", "process E" or "free"
              }  // ends the special case for P's places
              const g = SLIM ? { x: 8, y: 24 + i * 42, w: 200, h: 36 } : { x: b.x, y: 26, w: b.w, h: 58 };  // g: where this block is drawn, one under another on a phone, side by side at its own x otherwise
              kids.push(s('rect', { x: g.x, y: g.y, width: g.w, height: g.h, rx: 6, class: cls, 'stroke-width': 2, 'stroke-dasharray': b.place && spaceOwner(b.lo) === 'free' ? '5 4' : null }),  // the block's rectangle in its colour; a free place gets a dashed border so it reads as empty
                s('text', { x: g.x + g.w / 2, y: g.y + (SLIM ? 16 : 26), 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, name),  // the block's name in bold
                s('text', { x: g.x + g.w / 2, y: g.y + (SLIM ? 31 : 46), 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub s-monot' }, `${b.lo}–${b.hi}`));  // its address range under the name, in grey fixed-width type
              // after a run, mark how many references landed in this block
              if (rows) {  // only after a run: shows how many of P's references landed in this block
                const hit = rows.filter((r) => r.e >= b.lo && r.e <= b.hi);  // hit: the references whose final address falls inside this block
                if (hit.length) {  // draws a mark only for blocks that some reference reached
                  const good = hit.every((r) => r.ok), n = `${hit.length} ref${hit.length > 1 ? 's' : ''}`;  // good: whether every reference here was correct; n: the count written as "1 ref" or "3 refs"
                  kids.push(SLIM  // adds the mark, placed for the layout
                    ? s('text', { x: 216, y: g.y + 23, 'font-size': 13.5, 'font-weight': 800, class: good ? 'tx-ok' : 'tx-bad' }, `${good ? '✓' : '✗'} ${n} here`)  // phone layout: a green tick or red cross with the count, to the right of the block
                    : s('text', { x: g.x + g.w / 2, y: 104, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, class: good ? 'tx-ok' : 'tx-bad' }, `${good ? '✓' : '✗'} ${n} land here`));  // wide layout: the same mark centred under the block
                }  // ends the check for references in this block
              }  // ends the after-a-run marks
            });  // ends the loop over blocks
            const onDisk = st.phase === 'disk' || st.phase === 'out';  // onDisk: whether the disk holds P, as the load module before loading or as its saved image after a swap out
            const d = SLIM ? { x: 8, y: 236, w: 200, h: 48 } : { x: 552, y: 20, w: 100, h: 70 };  // d: where the disk box goes, under the blocks on a phone, at the right end otherwise
            kids.push(s('rect', { x: d.x, y: d.y, width: d.w, height: d.h, rx: 10, class: 's-io', 'stroke-width': 2 }),  // the orange disk box
              s('text', { x: d.x + d.w / 2, y: d.y + 19, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, class: 'tx-io' }, 'Disk'),  // its bold "Disk" heading
              s('text', { x: d.x + d.w / 2, y: d.y + (SLIM ? 37 : 42), 'text-anchor': 'middle', 'font-size': 12.5 }, (onDisk ? (st.phase === 'disk' ? 'load module' : 'P’s image') : '—') + (SLIM && st.phase === 'out' ? ' (swapped out)' : '')),  // what the disk holds now: the load module, P's saved image, or a dash; a phone adds "(swapped out)" on this line
              SLIM ? null : s('text', { x: d.x + d.w / 2, y: d.y + 58, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, st.phase === 'out' ? 'swapped out' : ''));  // wide layout: a grey "swapped out" line under it while P is out of memory (left out on a phone)
            svg.replaceChildren(...kids.filter(Boolean));  // puts all the parts into the drawing, dropping the empty spot left out on a phone
          }  // ends drawMap
          function draw() {  // draw(): rebuilds the whole lab (table, map, results, chips, buttons, message) after every click
            const c = cur();  // c: where P sits now, or null
            modeCard.innerHTML = MODES[mode].html;  // shows the chosen method's explanation in the method card
            let rows = null;  // rows: the five address-holding words with what they hold and where they land; stays null while P is on disk
            if (c != null) {  // P is in memory
              rows = LOOP.slice(0, 5).map((w, i) => ({ w, i, sv: stored(w.a), e: eff(w.a), ok: eff(w.a) === c + w.a }));  // for words 0 to 4: the stored field, the address finally used, and whether it is P's own start plus the relative address
              tbody.replaceChildren(...rows.map((r) => h('tr', { class: st.ran ? (r.ok ? 'ok' : 'bad') : '' },  // one table row per word, green or red once the program has run
                h('td', { class: 'mono' }, String(c + r.i)),  // the word's real address in memory
                h('td', { class: 'mono b', style: { whiteSpace: 'nowrap' } }, `${r.w.op} ${r.sv}`),  // what the word holds: the operation and its stored address field, in bold
                h('td', { class: 'mono', style: { whiteSpace: 'nowrap' } }, !st.ran ? '—' : mode === 'run' ? `${r.sv} + ${c} = ${r.e}` : String(r.e)),  // the address used: a dash before running; with run-time loading it shows the base register sum
                h('td', { class: 'small', html: !st.ran ? '<span class="muted">run to see</span>' : (r.ok ? '<span class="c-ok b">✓</span> ' : '<span class="c-bad b">✗</span> ') + owner(r.e) }))));  // where it lands: "run to see" before running, then a tick or cross and what sits at that address
            } else tbody.replaceChildren(h('tr', {}, h('td', { colspan: 4, class: 'muted small' }, st.phase === 'out' ? 'P is on disk. Bring it back in to see its words.' : 'Nothing loaded yet.')));  // P is not in memory: one grey row saying it is swapped out on disk or not loaded yet
            drawMap(st.ran ? rows : null);  // redraws the memory map, with the landing marks only after a run
            if (st.ran) st.seen[st.phase][mode] = rows.every((r) => r.ok);  // after a run, records in the results table whether this method worked at this point in the story
            const cell = (ph, m) => { const v = st.seen[ph][m]; return h('td', { class: 'center', html: v == null ? '<span class="muted">?</span>' : v ? '<span class="c-ok b">✓ works</span>' : '<span class="c-bad b">✗ breaks</span>' }); };  // cell(ph, m): one results cell, a grey ? until tried, then "works" in green or "breaks" in red
            score.replaceChildren(h('thead', {}, h('tr', {}, h('th', {}, 'Method'), h('th', {}, st.at0 != null ? 'Loaded at ' + st.at0 : 'First load'), h('th', {}, st.at1 != null ? 'Back at ' + st.at1 : 'Back after swap'))),  // the results table's headings, which name the actual load and return addresses once they are known
              h('tbody', {}, ...Object.entries(MODES).map(([m, d]) => h('tr', { class: m === mode ? 'on' : '' }, h('td', { class: 'b' }, d.label), cell('in', m), cell('back', m)))));  // one row per method, the current method highlighted, with its first-load and back-after-swap results
            chips.replaceChildren(  // the chips under the table
              h('span', { class: 'chip proc' }, c != null ? `P is at ${c}–${c + 8}` : 'P is not in memory'),  // where P sits now, or that it is not in memory
              mode === 'run' ? h('span', { class: 'chip cpu' }, 'base register = ' + (c != null ? c : '—')) : h('span', { class: 'chip' }, mode === 'abs' ? 'addresses fixed for 1000' : st.at0 != null ? `words patched for ${st.at0}` : 'not patched yet'));  // run-time: the base register value; otherwise whether the addresses are fixed for 1000 or patched for the load address
            const B = (txt, fn, cls = 'btn sm') => h('button', { class: cls, onclick: () => { fn(); draw(); } }, txt);  // B(txt, fn, cls): makes a button that runs fn and then redraws the lab
            const list = [];  // list: the buttons that make sense at this point in the story
            if (st.phase === 'disk') list.push(B('Load at 1000', () => { st.phase = 'in'; st.at0 = 1000; }, 'btn sm primary'), B('Load at 2400', () => { st.phase = 'in'; st.at0 = 2400; }, 'btn sm primary'));  // on disk: two choices of where to load P
            if ((st.phase === 'in' || st.phase === 'back') && !st.ran) list.push(B('Run one pass', () => { st.ran = true; }, 'btn sm primary'));  // in memory and not yet run: a button to run one pass of the loop
            if (st.phase === 'in') list.push(B('Swap out to disk', () => { st.phase = 'out'; st.ran = false; }));  // after the first load: a button to swap P out to disk
            if (st.phase === 'out') list.push(B(`Swap in at ${other(st.at0)}`, () => { st.phase = 'back'; st.at1 = other(st.at0); }, 'btn sm primary'), B(`Wait for E, then swap in at ${st.at0}`, () => { st.phase = 'back'; st.at1 = st.at0; }));  // swapped out: bring P back at the other place, or wait for E to leave and bring it back to the same place
            list.push(B('Start over', reset, 'btn sm ghost'));  // a Start over button is always there
            btns.replaceChildren(...list);  // shows the chosen buttons
            narrate(out, story(c, rows), st.ran ? (rows.every((r) => r.ok) ? 'ok' : 'bad') : '');  // writes the story so far in the narration box, green if every reference worked, red if any missed
          }  // ends draw
          function story(c, rows) {  // story(c, rows): the message for the current point in the story and the current method
            if (st.phase === 'disk') return mode === 'abs' ? 'The load module is on disk. It was assembled for address <b>1000</b>. Choose where the loader puts it.' : 'The load module is on disk. Choose where the loader puts it.';  // on disk: invites the student to choose a load address (noting the 1000 build address for the absolute version)
            if (st.phase === 'out') return `Swapped out: P’s image is saved to disk <b>exactly as it was in memory</b>, and process E has moved into ${st.at0}–${st.at0 + 199}. ` +  // swapped out: the image is saved exactly as it was, and process E has taken P's old place
              (mode === 'rel' ? `Notice that its words still hold addresses patched for ${st.at0}.` : 'Where should P come back?');  // for relocatable loading, points out that the words still hold addresses patched for the old place
            const how = st.phase === 'in'  // how: one sentence on what the loader or OS did to put P where it is
              ? (mode === 'abs' ? `The loader copied the words unchanged.` : mode === 'rel' ? `The loader added ${c} to the 5 words in the dictionary.` : `The loader copied the words unchanged and the OS set the base register to ${c}.`)  // after the first load: copied as is, patched by adding the address, or copied with the base register set
              : (mode === 'run' ? `The image came back unchanged; the OS simply set the base register to ${c}.` : `The image came back unchanged, ${st.at1 === st.at0 ? 'to the same place (after waiting for E to leave).' : 'to a new place.'}`);  // after a swap back: the image came back unchanged, and only the base register moves with it in run-time loading
            if (!st.ran) return `P is in memory at <b>${c}</b>. ${how} Run one pass to see where its references land.`;  // before running: says where P is and asks the student to run one pass
            const bad = rows.filter((r) => !r.ok);  // bad: the references that missed
            if (!bad.length) {  // every reference landed correctly
              const mem = new Map(LOOP.map((w, i) => [c + i, w.data != null ? { data: w.data } : { op: w.op, a: w.a != null ? eff(w.a) : undefined }]));  // builds a memory map of P using the addresses the hardware really uses, so the loop can be run for real
              runLoop(mem, c);  // runs the loop to the end, which changes count in that map
              const luck = st.phase === 'back' && mode !== 'run' ? (mode === 'rel' ? ' It works only because P came back to the very place it was patched for, after waiting for E.' : ' It works only because P is back at 1000, the one address it was built for.') : '';  // luck: for absolute or relocatable loading after a swap, explains it only worked because P came back to its old place
              return `<b>All 5 references land on the right words.</b> Running the loop to the end leaves count = ${mem.get(c + 6).data}, as intended.` + (mode === 'run' ? ' The price: an addition on every reference, done by the hardware.' : luck);  // the success message with the final count, plus the cost of run-time loading or the luck note
            }  // ends the success case
            const st0 = bad.find((r) => r.w.op === 'STORE'), j = bad.find((r) => r.w.op === 'JNEG');  // st0: a missed STORE, which would damage someone else's memory; j: a missed jump
            return `<b>${bad.length} of 5 references miss.</b> <code>${bad[0].w.op} ${bad[0].e}</code> reaches ${owner(bad[0].e)} instead of P.` +  // the failure message: how many missed, and where the first one really lands
              (st0 ? ` <code>STORE ${st0.e}</code> would write into ${owner(st0.e)}.` : '') + (j && !j.ok ? ` <code>JNEG ${j.e}</code> would jump out of P.` : '') +  // adds what the missed STORE would overwrite and that the missed jump leaves P
              (mode === 'rel' ? ' Patching happened once, at the first load; nothing redoes it.' : mode === 'abs' ? ' The addresses were bound for 1000, long before loading.' : '');  // and the reason for this method: patched only once, or bound to 1000 before loading
          }  // ends story
          const seg = ctx.ui.seg(Object.entries(MODES).map(([value, m]) => ({ value, label: m.label })), mode, (v) => { mode = v; draw(); });  // seg: the three-button method switch; switching replays the same story under the new method
          reset(); draw();  // sets up the starting state and draws the lab
          el.append(h('div', { class: 'split l fill' },  // puts the step on screen in two columns, the left one smaller
            h('div', { class: 'stack', style: { gap: '9px' } },  // the left column holds the controls and messages
              h('p', { class: 'm0', html: 'One 9-word program, P, three loaders. Load it, run it, swap it out, bring it back. <b>Switch the method at any point</b>: the same story replays under the new method.' }),  // intro paragraph: one program, three loaders, and the method can be switched at any point
              seg, modeCard, btns, out,  // the method switch, the method card, the action buttons and the narration box
              h('div', { class: 'stack', style: { gap: '4px', marginTop: 'auto' } }, h('h4', { class: 'm0' }, 'Your results so far (fill it in by running)'), score)),  // the results table, pushed to the bottom of the column (marginTop auto) under its heading
            h('div', { class: 'stack', style: { gap: '8px' } },  // the right column holds the map and the reference table
              h('div', { class: 'card white', style: { padding: '6px 8px', flex: 'none' } }, svg),  // a white card holding the memory map
              h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', {}, 'Address'), h('th', {}, 'Holds'), h('th', {}, 'Address used'), h('th', {}, 'Lands on'))), tbody),  // the reference table with its four headings; draw() fills its body
              chips,  // the location and base register chips
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Only run-time binding lets the OS put a swapped-out process back wherever there is room, or slide processes together to close gaps. The base register addition is the first, simplest form of the address translation that paging and virtual memory build on.' }))));  // why callout: only run-time binding lets a process come back anywhere, the first step toward paging; this closes the layout
        },  // ends render for step 4
      },  // ends step 4
      /* ---------------- 5. The four binding times side by side ---------------- */
      {  // step 5 begins
        title: 'When does an address become real? Four binding times',  // the title shown at the top of step 5
        kind: 'compare',  // a compare step, labelled Compare
        render(el, ctx) {  // render(el, ctx): builds step 5 when its slide opens
          const { h } = ctx;  // pulls out h, the page element builder
          const ORG = 1000, L = 2400, w = LOOP[0];  // the example: the program built for 1000, loaded at 2400, following its first word, LOAD count
          const abs = ORG + w.a, rel = w.a, ld = L + w.a;  // abs: the real address of count when bound for 1000; rel: its relative address; ld: its address after loading at 2400
          const STAGES = ['Source code', 'Object / load module', 'Memory, after loading', 'As the instruction runs'];  // STAGES: the four points in a program's life where the address can be seen, one box each
          const TIMES = [  // TIMES: the four binding times, each with who converts, what the module holds, whether it can move, and the four boxes' text
            { k: 'prog', label: 'Programming time', at: 0, who: 'The programmer', holds: 'Real addresses', move: 'No: always at 1000',  // programming time: at 0 means the address is already real in the source code; the programmer converts; it never leaves 1000
              cells: [`LOAD ${abs}`, `LOAD ${abs}`, `LOAD ${abs}`, `uses ${abs}`], why: `The programmer typed the real address ${abs}. Every later stage just carries that number along.` },  // the real address appears at every stage, and the explanation says the programmer typed it
            { k: 'comp', label: 'Compile / assembly time', at: 1, who: 'The compiler or assembler', holds: 'Real addresses', move: 'No: always at 1000',  // compile or assembly time: real from the second stage, the module (at 1); the translator converts; still fixed at 1000
              cells: ['LOAD count', `LOAD ${abs}`, `LOAD ${abs}`, `uses ${abs}`], why: `The programmer wrote a name. Told that the program starts at ${ORG}, the assembler replaced count with ${abs}.` },  // the source holds the name count, and every later stage holds the real address the assembler worked out
            { k: 'load', label: 'Load time', at: 2, who: 'The loader', holds: 'Relative addresses + relocation dictionary', move: 'No, once loaded',  // load time: real from the third stage, memory after loading (at 2); the loader converts using the relocation dictionary
              cells: ['LOAD count', `LOAD ${rel}`, `LOAD ${ld}`, `uses ${ld}`], why: `The module holds the relative address ${rel}. The loader placed it at ${L} and patched the word to ${ld}.` },  // name in the source, relative address in the module, patched address in memory, which is what runs
            { k: 'run', label: 'Run time', at: 3, who: 'The processor hardware, on every reference', holds: 'Relative addresses, even in memory', move: 'Yes, at any time',  // run time: real only at the last stage, as the instruction runs (at 3); the hardware converts, so the process can move any time
              cells: ['LOAD count', `LOAD ${rel}`, `LOAD ${rel}`, `${rel} + base ${L} = ${ld}`], why: `The word in memory still says ${rel}. Each time it runs, the hardware adds the base register (${L} now). Move the process and only the base register changes.` },  // the word keeps its relative address even in memory, and the base register sum happens only as it runs
          ];  // closes TIMES
          let sel = 3;  // sel: the binding time now chosen, run time to start
          const row = h('div', { class: 'cols', style: { gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr', gap: '6px', alignItems: 'stretch' } });  // row: the four stage boxes with arrow columns between them (a single column on a phone)
          const why = h('div', { class: 'narr' });  // why: the narration box explaining the chosen binding time
          const tbody = h('tbody');  // tbody: the summary table body, one row per binding time
          function draw() {  // draw(): redraws the stage boxes, the explanation and the table for the chosen binding time
            const t = TIMES[sel];  // t: the chosen binding time
            const kids = [];  // kids: the boxes and arrows to show
            STAGES.forEach((name, i) => {  // one box per stage
              const bound = i === t.at, real = i >= t.at;  // bound: this is the stage where the address becomes real; real: the address is real at this stage or later
              kids.push(h('div', { class: 'box ' + (bound ? 'accent' : real ? 'mem' : ''), style: { textAlign: 'left', padding: '6px 10px', borderWidth: bound ? '3px' : '2px' } },  // the box: thick indigo where binding happens, green once real, neutral before that
                h('div', { class: 'xs b muted' }, `${i + 1}. ${name}`),  // small heading with the stage number and name
                h('div', { class: 'mono b', style: { fontSize: '16px', margin: '3px 0' } }, t.cells[i]),  // what the program holds at this stage, in large fixed-width type
                h('div', { class: 'xs', html: bound ? '<span class="c-acc b">← bound here</span>' : real ? '<span class="c-mem">real address</span>' : '<span class="muted">not yet a real address</span>' })));  // a note: "bound here", "real address" or "not yet a real address"
              if (i < 3) kids.push(h('div', { class: 'b muted center', style: { alignSelf: 'center' } }, ctx.narrow ? '↓' : '→'));  // an arrow after each of the first three boxes, pointing down on a phone and right otherwise
            });  // ends the loop over stages
            row.replaceChildren(...kids);  // shows the new boxes
            narrate(why, `<b>${t.label}.</b> ${t.why}`, '');  // explains the chosen binding time in the narration box
            tbody.replaceChildren(...TIMES.map((x, i) => h('tr', { class: i === sel ? 'on' : '' }, h('td', { class: 'b' }, x.label), h('td', {}, x.who), ctx.narrow ? null : h('td', {}, x.holds), h('td', {}, x.move))));  // one table row per binding time, the chosen one highlighted; the Module holds column is left out on a phone
          }  // ends draw
          const seg = ctx.ui.seg(TIMES.map((x, i) => ({ value: i, label: x.label })), sel, (v) => { sel = v; draw(); });  // seg: a four-button switch for the binding times; choosing one redraws
          draw();  // draws the first view
          // a small sorting game: name the binding time in each scenario
          const SC = [  // SC: the scenarios of the sorting game, each with its text and the number of the right binding time
            ['For a tiny machine with no operating system, a programmer types <code>JUMP 7731</code> straight into the code.', 0],  // scenario 1: a hand-typed jump address on a machine with no OS (programming time)
            ['As a program is copied into memory at 5200, a routine adds 5200 to every word on its relocation list.', 2],  // scenario 2: a routine adds the load address to listed words while copying (load time)
            ['An assembler reads “start at 4000” at the top of the file and turns every label into an address in the 4000s.', 1],  // scenario 3: the assembler reads the start address and converts every label (assembly time)
            ['The OS moves a process to a new spot and changes only its base register; the code itself is untouched.', 3],  // scenario 4: the OS moves a process by changing only its base register (run time)
          ];  // closes SC
          let qi = 0, right = 0, answered = false, picked = -1;  // qi: the scenario now shown; right: correct answers so far; answered: whether it has been answered; picked: the chosen button
          const qText = h('p', { class: 'small m0', style: { minHeight: '62px' } });  // qText: the paragraph holding the scenario, kept a fixed minimum height so the buttons do not jump
          const qBtns = h('div', { class: 'grid-2', style: { gap: '6px' } });  // qBtns: the four answer buttons in a two-column grid
          const qFb = h('div', { class: 'small', style: { minHeight: '40px' } });  // qFb: the feedback line under the buttons
          function drawQ() {  // drawQ(): shows the current scenario, its answer buttons and the feedback
            const [txt, ans] = SC[qi];  // txt is the scenario text and ans the number of its right answer
            qText.innerHTML = `<b>${qi + 1} of ${SC.length}.</b> ${txt}`;  // writes the scenario with its number, for example "2 of 4."
            qBtns.replaceChildren(...TIMES.map((x, i) => h('button', { class: 'btn sm' + (answered && i === ans ? ' on' : answered && i === picked ? ' intr' : ''), onclick: () => {  // one button per binding time; after answering, the right one is lit and a wrong pick is outlined in red
              if (answered) return;  // a scenario can be answered only once
              answered = true; picked = i; if (i === ans) right++;  // records the answer and adds to the score if it is right
              qFb.innerHTML = (i === ans ? '<span class="c-ok b">✓ Right.</span> ' : `<span class="c-bad b">✗ Not quite: it is ${TIMES[ans].label.toLowerCase()}.</span> `) + `Converted by: ${TIMES[ans].who.toLowerCase()}. Score: ${right} of ${qi + 1}.`;  // feedback: right, or the correct binding time, then who converts the address and the running score
              drawQ();  // redraws the buttons to show the right and wrong picks
            } }, x.label)));  // ends the click handler; the button's label is the binding time's name
            if (!answered) qFb.innerHTML = '<span class="muted">Pick the binding time.</span>';  // before an answer, a grey prompt asks the student to pick
            next.disabled = !answered;  // Next stays disabled until the scenario is answered
            next.textContent = qi === SC.length - 1 ? 'Start again' : 'Next scenario';  // on the last scenario, the button offers to start again
          }  // ends drawQ
          const next = h('button', { class: 'btn sm primary', onclick: () => { if (qi === SC.length - 1) { qi = 0; right = 0; } else qi++; answered = false; drawQ(); } }, 'Next scenario');  // the Next button: moves to the next scenario, or back to the first with the score reset after the last
          drawQ();  // shows the first scenario
          el.append(h('div', { class: 'stack fill', style: { gap: '9px' } },  // puts the step on screen as one column filling the step's height
            h('p', { class: 'm0', html: 'Every address must become a real location at some point. <span class="t">Address binding</span> is that moment. Pick a binding time and follow <code>LOAD count</code> through the four stages.' }),  // intro paragraph: what address binding is, and the invitation to follow LOAD count through the four stages
            seg, row, why,  // the switch, the stage boxes and the explanation
            h('div', { class: 'split r grow', style: { gap: '16px' } },  // under them, two columns taking the remaining height
              h('table', { class: 'tbl compact', style: { alignSelf: 'start' } }, h('thead', {}, h('tr', {}, h('th', {}, 'Binding time'), h('th', {}, 'Who converts'), ctx.narrow ? null : h('th', {}, 'Module holds'), h('th', {}, 'Can it move later?'))), tbody),  // the summary table: binding time, who converts, what the module holds (not on a phone), and whether it can move
              h('div', { class: 'card tight stack', style: { gap: '6px' } }, h('h4', { class: 'm0' }, 'Which binding time is it?'), qText, qBtns, h('div', { class: 'row nw', style: { gap: '8px', alignItems: 'flex-start' } }, h('div', { class: 'grow' }, qFb), next)))));  // the game card: heading, scenario, answer buttons, then the feedback beside the Next button; this closes the layout
        },  // ends render for step 5
      },  // ends step 5
      /* ---------------- 6. Lab: the linker lays modules end to end and rewrites references ---------------- */
      {  // step 6 begins
        title: 'Linker lab: lay the modules end to end',  // the title shown at the top of step 6
        kind: 'lab',  // a lab step, labelled Hands-on Lab
        core: true,  // core: part of the shorter core path
        render(el, ctx) {  // render(el, ctx): builds step 6 when its slide opens
          const { h, s } = ctx;  // pulls out h (page elements) and s (SVG elements)
          const MODS = {  // MODS: the three object modules; each reference has its position (at) and either another module (ext) or an internal address (rel)
            A: { role: 'main program', len: 300, cls: 's-accent', tx: 'tx-acc', refs: [{ at: 40, op: 'CALL', ext: 'B' }, { at: 120, op: 'CALL', ext: 'C' }, { at: 200, op: 'JUMP', rel: 60 }] },  // module A, the main program, 300 words: calls B and C, and jumps to its own word 60
            B: { role: 'sort routine', len: 250, cls: 's-proc', tx: 'tx-proc', refs: [{ at: 30, op: 'LOAD', rel: 210 }, { at: 180, op: 'CALL', ext: 'C' }] },  // module B, the sort routine, 250 words: loads its own word 210 and calls C
            C: { role: 'print routine', len: 120, cls: 's-mem', tx: 'tx-mem', refs: [{ at: 90, op: 'JUMP', rel: 15 }] },  // module C, the print routine, 120 words: jumps to its own word 15
          };  // closes MODS
          const CHALLENGES = [['C', 250], ['A', 370], ['B', 420], ['A', 120]];  // CHALLENGES: target start addresses for the puzzle, each [module, address], solved by reordering
          let order = ['A', 'B', 'C'], ci = 0, moved = null;  // order: the order the linker places the modules in; ci: the current challenge; moved: the module just moved
          const total = Object.values(MODS).reduce((a, m) => a + m.len, 0);  // total: the length of the whole load module, the sum of the three lengths (670)
          const startOf = (k) => order.slice(0, order.indexOf(k)).reduce((a, q) => a + MODS[q].len, 0);  // startOf(k): where module k starts, the total length of the modules placed before it
          const listEl = h('div', { class: 'stack', style: { gap: '8px' } });  // listEl: the column of module cards with their up and down buttons
          const svg = s('svg', { viewBox: '0 0 300 452', width: '100%' });  // svg: the drawing of the load module
          const tbody = h('tbody');  // tbody: the table of every reference before and after linking
          const formula = h('div', { class: 'narr' });  // formula: the narration box with the start address sums
          const chal = h('div', { class: 'small' });  // chal: the challenge line
          function move(k, d) {  // move(k, d): moves module k one place up (d = -1) or down (d = 1)
            const i = order.indexOf(k), j = i + d;  // i is the module's current place and j the place it moves to
            if (j < 0 || j >= order.length) return;  // ignores a move past either end of the list
            [order[i], order[j]] = [order[j], order[i]];  // swaps the two modules in the order
            moved = k; draw();  // remembers which module moved, so its card can flash, and redraws
          }  // ends move
          function draw() {  // draw(): redraws the module list, the drawing, the table, the sums and the challenge after every move
            // left: the object modules in the order the linker will place them
            listEl.replaceChildren(...order.map((k, i) => {  // one card per module, in the current order
              const m = MODS[k];  // m: this module's data
              return h('div', { class: 'card tight' + (k === moved ? ' flash' : ''), style: { padding: '7px 10px' } },  // the card; the module that just moved gets the flash effect
                h('div', { class: 'row nw', style: { gap: '6px' } },  // the card's top row stays on one line
                  h('span', { class: 'b', style: { fontSize: '17px' } }, `${k}`), h('span', { class: 'small muted grow' }, `${m.role}, length ${m.len}`),  // the module's letter in large bold type, then its role and length in grey
                  h('button', { class: 'btn sm', 'aria-label': `Move ${k} up`, disabled: i === 0, onclick: () => move(k, -1) }, '↑'),  // the up button, disabled for the first module
                  h('button', { class: 'btn sm', 'aria-label': `Move ${k} down`, disabled: i === order.length - 1, onclick: () => move(k, 1) }, '↓')),  // the down button, disabled for the last module; this closes the card's top row
                h('div', { class: 'mono xs', style: { lineHeight: '1.5', marginTop: '2px' }, html: m.refs.map((r) => `${r.at}: ${r.op} ${r.ext || r.rel} <span class="muted">${r.ext ? '(external)' : '(internal)'}</span>`).join('<br>') }));  // the module's references, one per line, each with its position, operation, target and an (external) or (internal) tag
            }));  // ends the module cards
            // middle: the load module, drawn to scale, with every reference arrow
            const Y0 = 24, SC = 418 / total, X = 46, W = 160, yOf = (a) => Y0 + a * SC;  // drawing scale: Y0 is the top, SC the height per word so 670 words fit in 418 units, X and W the bar; yOf(a) gives an address's height
            const kids = [s('text', { x: X + W / 2, y: 14, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, `Load module (${total} words)`)];  // kids: the drawing's parts, starting with the heading that gives the load module's length
            const arrows = [];  // arrows: the reference arrows, kept apart so they can be drawn on top of the blocks
            let ai = 0;  // ai: counts the arrows, so each one bends a little further out than the last
            order.forEach((k) => {  // draws each module in the current order
              const m = MODS[k], st = startOf(k);  // m: the module's data; st: where it starts in the load module
              kids.push(s('rect', { x: X, y: yOf(st), width: W, height: m.len * SC, class: m.cls, 'stroke-width': 2 }),  // the module's block, its height to scale with its length and its own colour
                s('text', { x: X + 8, y: yOf(st) + 22, 'font-size': 20, 'font-weight': 800, class: m.tx }, k),  // the module's letter in large type at the top of its block
                s('text', { x: X - 6, y: yOf(st) + 5, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, class: 's-monot' }, String(st)));  // its start address, to the left of the block's top edge
              m.refs.forEach((r) => {  // one arrow for each reference inside this module
                const at = st + r.at, tgt = r.ext ? startOf(r.ext) : st + r.rel, y1 = yOf(at), y2 = yOf(tgt), xk = X + W + 14 + ai * 14;  // at: the reference's address after linking; tgt: its target, the other module's start or this module's start plus rel
                kids.push(s('circle', { cx: X + W, cy: y1, r: 3.5, style: 'fill:var(--ink-2)' }),  // a small dot on the block's right edge where the reference sits
                  s('text', { x: X + W - 7, y: y1 + 4.5, 'text-anchor': 'end', 'font-size': 13, class: 's-monot' }, `${at}: ${r.op} ${tgt}`));  // the linked instruction written beside the dot, for example 40: CALL 300
                arrows.push(s('path', { d: `M${X + W},${y1} C${xk},${y1} ${xk},${y2} ${X + W + 3},${y2}`, fill: 'none', class: 's-line', 'stroke-dasharray': r.ext ? null : '5 4', style: r.ext ? 'stroke:var(--accent)' : '', 'marker-end': r.ext ? 'url(#arr-accent)' : 'url(#arr)' }));  // a curved arrow from the reference to its target: solid indigo for a call to another module, dashed grey for an internal one
                ai++;  // moves on to the next arrow's bend position
              });  // ends the loop over this module's references
            });  // ends the loop over modules
            kids.push(s('text', { x: X - 6, y: yOf(total) + 5, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, class: 's-monot' }, String(total)));  // the load module's total length, written at its bottom edge
            svg.replaceChildren(...kids, ...arrows);  // puts the blocks and labels into the drawing, then the arrows on top
            // right: every reference, before and after linking
            const rows = [];  // rows: the reference table's rows
            order.forEach((k) => MODS[k].refs.forEach((r) => {  // goes through every reference of every module, in the current order
              const st = startOf(k), tgt = r.ext ? startOf(r.ext) : st + r.rel;  // st: the module's start; tgt: the reference's target after linking
              rows.push(h('tr', {}, h('td', { class: 'mono', style: { whiteSpace: 'nowrap' } }, `${st + r.at}`, ctx.narrow ? null : h('span', { class: 'muted' }, ` (${k}+${r.at})`)), h('td', { class: 'mono', style: { whiteSpace: 'nowrap' } }, `${r.op} ${r.ext || r.rel}`), h('td', { class: 'mono b', style: { whiteSpace: 'nowrap' } }, `${r.op} ${tgt}`),  // row: the address after linking (with module plus offset, except on a phone), the object module form and the linked form
                h('td', { class: 'small', html: r.ext ? `${r.ext} starts at ${tgt}` : `${st} + ${r.rel}` })));  // last cell: why, either where the called module starts or the start plus the relative address
            }));  // ends the loop over references
            tbody.replaceChildren(...rows);  // shows the new table rows
            let acc = 0;  // acc: a running total of module lengths, which gives each next module's start
            const sums = order.map((k, i) => { const t = i === 0 ? `<b>${k}</b> at 0` : i === 1 ? `<b>${k}</b> at ${acc} (the length of ${order[0]})` : `<b>${k}</b> at ${order.slice(0, i).map((q) => MODS[q].len).join(' + ')} = ${acc}`; acc += MODS[k].len; return t; });  // sums: one phrase per module showing how its start is found, 0, the first length, or the sum of all earlier lengths
            narrate(formula, `Each module starts where the ones before it end: ${sums.join('; ')}. A reference to relative address x inside a module becomes start + x.`, '');  // writes the sums in the formula box, with the general rule that relative address x becomes start + x
            const [ck, cv] = CHALLENGES[ci], done = startOf(ck) === cv;  // ck and cv: the module and start address the current challenge asks for; done: whether the current order meets it
            chal.innerHTML = `<b>Challenge ${ci + 1} of ${CHALLENGES.length}:</b> reorder so that <b>${ck}</b> starts at <b>${cv}</b>. ` +  // the challenge line: which module must start where
              (done ? `<span class="c-ok b">✓ Solved: ${order.join(', ')}.</span>` : `<span class="muted">Now ${ck} starts at ${startOf(ck)}.</span>`);  // then either a green "Solved" with the winning order, or where that module starts now
            nextBtn.disabled = !done;  // the Next challenge button works only once the challenge is solved
            moved = null;  // clears the flash marker so the card flashes only right after a move
          }  // ends draw
          const nextBtn = h('button', { class: 'btn sm primary', onclick: () => { ci = (ci + 1) % CHALLENGES.length; draw(); } }, 'Next challenge');  // the Next challenge button: moves to the next challenge, wrapping back to the first, and redraws
          draw();  // draws the first view
          el.append(h('div', { class: 'cols fill', style: { gridTemplateColumns: 'minmax(0,330fr) minmax(0,320fr) minmax(0,470fr)', gap: '16px' } },  // puts the step on screen in three columns: module list, drawing, and table, in proportions 330 : 320 : 470
            h('div', { class: 'stack', style: { gap: '8px' } },  // the left column
              h('p', { class: 'small m0', html: 'The <span class="t">linker</span> places object modules one after another. Inside a module, addresses count from its own word 0; an <span class="t">external reference</span> is just a name. Use the arrows to change the order.' }),  // intro paragraph: the linker places modules one after another, and external references are just names
              listEl,  // the module cards with their arrow buttons
              h('div', { class: 'callout tip m0 small', 'data-label': 'In general', html: 'Modules A, B, C of lengths L, M, N: A starts at 0, B at <b>L</b>, C at <b>L + M</b>. Relative address x inside B becomes <b>L + x</b>, and a call to B becomes a jump to <b>L</b>.' })),  // general rule callout: start addresses L and L + M for lengths L, M, N, and how references change
            h('div', { class: 'card white', style: { padding: '6px', display: 'grid', placeItems: 'center' } }, svg),  // the middle column: a white card that centres the drawing
            h('div', { class: 'stack', style: { gap: '8px' } },  // the right column
              h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', {}, 'Address'), h('th', {}, 'Object module'), h('th', {}, 'Load module'), h('th', {}, 'Why'))), tbody),  // the reference table with its four headings; draw() fills its body
              formula,  // the formula box with the start address sums
              h('div', { class: 'card tight stack', style: { gap: '6px' } }, chal, h('div', { class: 'row' }, nextBtn)),  // the challenge card with its Next button
              h('p', { class: 'xs muted m0', html: 'Solid arrows: calls to another module (external). Dashed: jumps and loads inside a module (internal), which move with their module.' }))));  // a small key to the arrows: solid for calls to another module, dashed for references inside one; this closes the layout
        },  // ends render for step 6
      },  // ends step 6
      /* ---------------- 7. Static vs dynamic linking: a library update and shared memory ---------------- */
      {  // step 7 begins
        title: 'Static or dynamic linking? A library update arrives',  // the title shown at the top of step 7
        kind: 'compare',  // a compare step, labelled Compare
        render(el, ctx) {  // render(el, ctx): builds step 7 when its slide opens
          const { h } = ctx;  // pulls out h, the page element builder
          const LIB = 600;  // LIB: the size of the shared text library, libtext, in KB (kilobytes)
          const APPS0 = [['Editor', 300], ['Mail', 250], ['Viewer', 200]];  // APPS0: the three apps and their own code sizes in KB
          let mode = 'static', lib, apps, last;  // mode: static or dynamic linking; lib: the newest library version on disk; apps: each app's state; last: the latest message
          function reset() {  // reset(): puts both versions of the story back at the start
            lib = 1;  // only version 1 of the library (the buggy one) exists
            apps = APPS0.map(([name, code]) => ({ name, code, linked: 1, running: true, uses: 1 }));  // each app starts running, built with version 1 and using version 1
            last = mode === 'static'  // the opening message, which depends on the kind of linking
              ? 'Each app was built by a linkage editor, so each file carries its own copy of libtext v1 (which has a bug). All three are running. Now ship the fix.'  // static: each app file contains its own copy of the buggy library
              : 'Each app holds only an unresolved reference to libtext. When it was loaded, the loader found libtext v1 (which has a bug) and linked it. Now ship the fix.';  // dynamic: each app holds only a reference, and the loader linked version 1 when it started
          }  // ends reset
          const cards = h('div', { class: 'grid-3', style: { gap: '10px' } });  // cards: the three app cards in a row
          const memBox = h('div', { class: 'card tight stack', style: { gap: '6px' } });  // memBox: the card showing main memory used by the running apps
          const out = h('div', { class: 'narr' });  // out: the narration box
          const vchip = (v) => (v == null ? h('span', { class: 'chip' }, 'not running') : h('span', { class: 'chip ' + (v === 1 ? 'bad' : 'ok') }, v === 1 ? 'libtext v1 (bug)' : 'libtext v2 (fixed)'));  // vchip(v): a chip naming the library version in use, red for the buggy v1, green for the fixed v2, plain when not running
          function act(fn) { fn(); draw(); }  // act(fn): runs a change and then redraws, used by every button
          function draw() {  // draw(): redraws the app cards, the memory bar and the message
            cards.replaceChildren(...apps.map((a) => h('div', { class: 'card tight stack', style: { gap: '5px', padding: '8px 10px' } },  // one card per app
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('span', { class: 'b' }, a.name), h('span', { class: 'chip ' + (a.running ? 'proc' : '') }, a.running ? 'running' : 'stopped')),  // top row: the app's name and a running or stopped chip
              h('div', { class: 'xs muted' }, mode === 'static' ? `file: ${a.code} + ${LIB} (lib v${a.linked}) = ${a.code + LIB} KB` : `file: ${a.code} KB (no libtext inside)`),  // the app file's size: code plus its own library copy when static, or code only when dynamic
              h('div', {}, vchip(a.running ? a.uses : null)),  // the chip for the library version the running copy uses
              h('div', { class: 'row', style: { gap: '5px' } },  // the card's buttons
                h('button', { class: 'btn sm', onclick: () => act(() => {  // Start or Stop button
                  if (a.running) { a.running = false; a.uses = null; last = `${a.name} stopped; its memory is freed.`; }  // stopping frees the app's memory and clears the version it used
                  else { a.running = true; a.uses = mode === 'static' ? a.linked : lib; last = mode === 'static' ? `${a.name} started with the copy inside its own file: libtext v${a.linked}.` : `${a.name} started. The loader found the newest libtext on disk (v${lib}) and linked it${lib === 2 ? ': the fix arrived with no relinking' : ''}.`; }  // starting: static apps use the copy inside their file; dynamic apps get whatever version is newest on disk
                }) }, a.running ? 'Stop' : 'Start'),  // the button says Stop while running and Start while stopped
                mode === 'static' ? h('button', { class: 'btn sm', disabled: a.linked === lib, onclick: () => act(() => { a.linked = lib; last = `The linkage editor rebuilt ${a.name}, copying libtext v${lib} into its file. ${a.running ? 'The running copy still uses v' + a.uses + ' until it restarts.' : 'It will use v' + lib + ' next time it starts.'}`; }) }, 'Relink') : null))));  // static only: a Relink button that copies the newest library into the file; a running app keeps its old copy until restarted
            const run = apps.filter((a) => a.running);  // run: the apps now running
            const versions = [...new Set(run.map((a) => a.uses))];  // versions: the different library versions in use by running apps
            const codeKB = run.reduce((s0, a) => s0 + a.code, 0);  // codeKB: memory used by the running apps' own code
            const libKB = mode === 'static' ? LIB * run.length : LIB * versions.length;  // libKB: library memory, one copy per running app when static, one shared copy per version when dynamic
            const tot = codeKB + libKB, other = mode === 'static' ? codeKB + (run.length ? LIB : 0) : codeKB + LIB * run.length;  // tot: total memory now; other: what the same apps would need with the other kind of linking
            const MAX = 2600, pct = (kb) => (100 * kb) / MAX + '%';  // MAX: the KB that fills the whole memory bar; pct(kb) turns a size into a share of the bar's width
            const segs = [];  // segs: the coloured pieces of the memory bar
            run.forEach((a) => { segs.push(h('div', { class: 'xs b', title: a.name, style: { width: pct(a.code), background: 'var(--proc-bg)', borderRight: '2px solid var(--proc)', display: 'grid', placeItems: 'center' } }, a.name[0]));  // for each running app, a teal piece sized by its code and labelled with its first letter
              if (mode === 'static') segs.push(h('div', { class: 'xs b', style: { width: pct(LIB), background: a.uses === 1 ? 'var(--bad-bg)' : 'var(--ok-bg)', borderRight: '2px solid var(--line-2)', display: 'grid', placeItems: 'center' } }, `lib v${a.uses}`)); });  // static: each app also gets its own library piece, red for v1 and green for v2
            if (mode === 'dynamic') versions.forEach((v) => segs.push(h('div', { class: 'xs b', style: { width: pct(LIB), background: v === 1 ? 'var(--bad-bg)' : 'var(--ok-bg)', borderRight: '2px solid var(--line-2)', display: 'grid', placeItems: 'center' }, title: 'one shared copy' }, `lib v${v}`)));  // dynamic: one library piece per version in use, shared by every app that uses it
            memBox.replaceChildren(  // fills the memory card
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Main memory used by the running apps'), h('span', { class: 'b mono', style: { whiteSpace: 'nowrap' } }, `${tot} KB`)),  // heading row: the card's title and the total KB
              h('div', { class: 'row nw', style: { gap: '0', height: '26px', flex: 'none', borderRadius: '8px', overflow: 'hidden', background: 'var(--panel-3)' } }, ...segs),  // the memory bar itself, a grey track holding the coloured pieces
              h('div', { class: 'xs muted', html: `Code ${codeKB} KB + libtext ${libKB} KB (${mode === 'static' ? run.length + ' private cop' + (run.length === 1 ? 'y' : 'ies') : versions.length === 2 ? 'v1 and v2 both in use' : versions.length + ' shared cop' + (versions.length === 1 ? 'y' : 'ies')}). ${mode === 'static' ? 'Dynamic, one shared copy' : 'Static linking'}: <b>${other} KB</b>.` }));  // a small note: code KB plus library KB with how many copies, then what the other kind of linking would need; closes the card
            narrate(out, last, '');  // shows the latest message in the narration box
            shipBtn.disabled = lib === 2;  // the Ship button is disabled once version 2 has shipped
          }  // ends draw
          const shipBtn = h('button', { class: 'btn sm primary', onclick: () => act(() => {  // the Ship button: puts the fixed library, version 2, on disk
            lib = 2;  // version 2 is now the newest on disk
            last = mode === 'static' ? 'libtext v2 is on disk, but every app file still contains its own v1 copy. Nothing changes until each app is relinked and restarted.' : 'libtext v2 replaced v1 on disk. Running apps keep the v1 they linked at load time; restart any app (Stop, then Start) and it picks up v2 with no relinking.';  // message: static apps change nothing until relinked and restarted; dynamic apps pick up v2 at their next start
          }) }, 'Ship libtext v2 (bug fix)');  // ends the click handler; the button's label
          const seg = ctx.ui.seg([{ value: 'static', label: 'Static linking' }, { value: 'dynamic', label: 'Dynamic linking' }], mode, (v) => { mode = v; reset(); draw(); });  // seg: the switch between static and dynamic linking; switching restarts the story under the new method
          reset(); draw();  // sets up the starting state and draws it
          el.append(h('div', { class: 'split l fill' },  // puts the step on screen in two columns, the left one smaller
            h('div', { class: 'stack', style: { gap: '9px' } },  // the left column holds the explanation
              h('p', { class: 'm0', html: 'A <span class="t">linkage editor</span> does <span class="t">static linking</span>: it builds one relocatable load module that contains everything, library routines included.' }),  // paragraph: a linkage editor does static linking, copying library routines into the load module
              h('p', { class: 'm0', html: '<span class="t">Dynamic linking</span> leaves some external references unresolved in the load module. In <span class="t">load-time dynamic linking</span> the loader settles them: for each reference to an outside (target) module, it finds that module, loads it and links it.' }),  // paragraph: dynamic linking leaves references open, and the loader settles them in load-time dynamic linking
              h('div', { class: 'callout why m0 small', 'data-label': 'Three payoffs of dynamic linking', html: '<b>1.</b> Update the target module (say, an OS utility library) and programs use the new version without being relinked. <b>2.</b> One copy of the code in memory serves every program: a <span class="t">shared library</span>, a .so file on Linux, a <span class="t">DLL</span> on Windows. <b>3.</b> Independent developers can extend the system by shipping their own library modules for programs to link to, with no need to rebuild the OS.' }),  // why callout: the three payoffs, updates without relinking, one shared copy, and modules others can add
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Thinking a running program switches versions instantly. It keeps the copy it linked; it sees an update the next time it loads.' })),  // warning callout: a running program keeps the library copy it linked until its next load
            h('div', { class: 'stack', style: { gap: '9px' } },  // the right column holds the interactive part
              h('div', { class: 'row', style: { gap: '8px', justifyContent: 'space-between' } }, seg, h('div', { class: 'row', style: { gap: '6px' } }, shipBtn, h('button', { class: 'btn sm ghost', onclick: () => { reset(); draw(); } }, 'Reset'))),  // the method switch on the left, the Ship and Reset buttons on the right
              cards, memBox, out,  // the app cards, the memory card and the narration box
              h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Static'), h('th', {}, 'Dynamic'))), h('tbody', {},  // the summary table, with an empty corner cell and the Static and Dynamic headings
                ...[['Library code inside each program file', 'yes', 'no, only a reference'], ['Library copies in memory, 3 apps running', '3', '1 (per version in use)'], ['A library fix reaches a program', 'after relink + restart', 'at its next load'], ['Program runs if the library file is missing', 'yes', 'no: fails at load or first call']]  // its four rows: library inside the file, copies in memory, when a fix arrives, and whether the app runs without the library file
                  .map(([a, b, c]) => h('tr', {}, h('td', { class: 'b' }, a), h('td', {}, b), h('td', {}, c))))))));  // turns each row into table cells, its first column in bold; this closes the layout
        },  // ends render for step 7
      },  // ends step 7
      /* ---------------- 8. Run-time dynamic linking: load a module only when it is called ---------------- */
      {  // step 8 begins
        title: 'Run-time dynamic linking: only what you actually call',  // the title shown at the top of step 8
        kind: 'explore',  // an explore step
        render(el, ctx) {  // render(el, ctx): builds step 8 when its slide opens
          const { h } = ctx;  // pulls out h, the page element builder
          const CORE = 800;  // CORE: the size of PhotoApp's main program in KB, which is always loaded
          const MODS = [  // MODS: the four optional modules PhotoApp refers to, each with its size and the button text that calls it
            { k: 'filters', label: 'Filters', kb: 300, act: 'Apply a filter' },  // the filters module, 300 KB
            { k: 'print', label: 'Print', kb: 200, act: 'Print' },  // the print module, 200 KB
            { k: 'pdf', label: 'PDF export', kb: 500, act: 'Export a PDF' },  // the PDF export module, 500 KB
            { k: 'spell', label: 'Spell check', kb: 150, act: 'Check spelling' },  // the spell check module, 150 KB
          ];  // closes MODS
          const PH = ['finding…', 'loading…', 'linking…'];  // PH: the three phases shown on a module's box while it is brought in
          let gen = 0, busy, lt, rt, used;  // gen: a counter that cancels old animations on reset; busy: an animation is running; lt and rt: the two columns; used: modules called
          const side = () => ({ started: false, loaded: new Set(), pending: null, phase: '', log: [] });  // side(): a fresh state for one column: not started, nothing loaded, nothing pending, no phase, an empty log
          function reset() { gen++; busy = false; lt = side(); rt = side(); used = new Set(); }  // reset(): bumps gen so any running animation stops, then clears both columns and the list of used modules
          const kbOf = (sd) => (sd.started ? CORE : 0) + MODS.filter((m) => sd.loaded.has(m.k)).reduce((a, m) => a + m.kb, 0);  // kbOf(sd): the memory one column holds, the core once started plus every module loaded so far
          const MAXKB = CORE + MODS.reduce((a, m) => a + m.kb, 0);  // MAXKB: the memory with everything loaded, which fills the meter
          const colEls = [0, 1].map(() => ({ boxes: h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${ctx.narrow ? 3 : 5}, minmax(0,1fr))`, gap: '6px' } }), meter: h('div', { class: 'meter', style: { height: '12px' } }, h('i')), kb: h('span', { class: 'mono b' }), log: h('div', { class: 'log', style: { height: '96px' } }) }));  // colEls: each column's parts: module boxes (3 per row on a phone, 5 otherwise), a meter, a KB readout and a log box
          const actRow = h('div', { class: 'row', style: { gap: '6px' } });  // actRow: the row of action buttons
          const out = h('div', { class: 'narr' });  // out: the narration box
          function drawSide(sd, c) {  // drawSide(sd, c): redraws one column (c) from its state (sd)
            const box = (label, kb, state, ph) => h('div', { class: 'box ' + (state === 'in' ? 'mem' : state === 'busy' ? 'warn pulse' : ''), style: { padding: '5px 4px', borderStyle: state === 'disk' ? 'dashed' : 'solid', fontSize: '13.5px', opacity: state === 'disk' ? '.75' : '1' } },  // box(label, kb, state, ph): one module box, green when in memory, pulsing amber while being brought in, dashed and faded on disk
              h('div', { class: 'b' }, label), h('div', { class: 'xs muted' }, state === 'busy' ? ph : state === 'in' ? `${kb} KB` : 'on disk'));  // its name, and under it the current phase, its size in KB, or "on disk"
            c.boxes.replaceChildren(box('Core', CORE, sd.started ? 'in' : 'disk'),  // the core box first
              ...MODS.map((m) => box(m.label, m.kb, sd.loaded.has(m.k) ? 'in' : sd.pending === m.k ? 'busy' : 'disk', sd.phase)));  // then one box per optional module, in memory, being brought in, or on disk
            const kb = kbOf(sd);  // kb: the memory this column holds
            c.meter.firstChild.style.width = (100 * kb) / MAXKB + '%';  // stretches the meter bar to that share of the maximum
            c.kb.textContent = kb + ' KB';  // writes the KB total in the column's heading
            c.log.replaceChildren(...sd.log.slice(-4).map((l) => h('div', { html: l })));  // shows only the last four log lines
            c.log.scrollTop = c.log.scrollHeight;  // keeps the log scrolled to its newest line
          }  // ends drawSide
          function draw() {  // draw(): redraws both columns and the action buttons
            drawSide(lt, colEls[0]); drawSide(rt, colEls[1]);  // the load-time column on the left, the run-time column on the right
            actRow.replaceChildren(  // the action buttons
              h('button', { class: 'btn sm primary', disabled: busy || lt.started, onclick: startApp }, 'Start PhotoApp'),  // Start PhotoApp, disabled while an animation runs or once the app has started
              ...MODS.map((m) => h('button', { class: 'btn sm', disabled: busy || !lt.started, onclick: () => call(m) }, m.act)),  // one button per optional module, usable only after the app starts and while nothing is running
              h('button', { class: 'btn sm ghost', onclick: () => { reset(); draw(); story(); } }, 'Reset'));  // Reset: clears both columns and the message
          }  // ends draw
          const listOf = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);  // listOf(xs): joins names into a readable list such as "Print, PDF export and Spell check"
          function story() {  // story(): writes the message for the current state
            if (!lt.started) return narrate(out, 'Both columns run the same program, PhotoApp, which references four optional modules. Start it and watch what each method loads.', '');  // before starting: both columns run the same program; start it
            if (lt.loaded.size < MODS.length) return narrate(out, `Load-time linking must find, load and link all ${MODS.length} referenced modules before PhotoApp can run. Run-time linking started at once with only the ${CORE} KB core; its ${MODS.length} references stay open until they are called.`, '');  // while the load-time column is still loading: it must bring in every module first, while the run-time column already runs
            const a = kbOf(lt), b = kbOf(rt), unused = MODS.filter((m) => !used.has(m.k));  // a and b: memory held by each column; unused: modules never called
            narrate(out, `You have used <b>${used.size} of ${MODS.length}</b> modules. Load-time linking holds <b>${a} KB</b>; run-time linking holds <b>${b} KB</b>` +  // how many modules were used and each column's memory
              (a > b ? `, a saving of ${a - b} KB: ${listOf(unused.map((m) => m.label))} ${unused.length === 1 ? 'was' : 'were'} never called.` : ': the same, because every module has now been called.'), a > b ? 'ok' : '');  // then the saving and which modules were never called, or that both match once everything has been called (green when saving)
          }  // ends story
          async function startApp() {  // startApp(): starts PhotoApp in both columns; async means it can pause with await while the animation plays
            const g = gen; busy = true;  // g remembers the current reset count; busy disables the buttons until the start finishes
            lt.started = rt.started = true;  // both columns now have the core program in memory
            lt.log.push('<b>load</b>: core program, 800 KB'); rt.log.push('<b>load</b>: core program, 800 KB');  // both logs record loading the 800 KB core
            rt.log.push('4 references left unresolved: ready to run');  // the run-time column is ready at once, with its four references still open
            draw(); story();  // redraws and updates the message
            for (const m of MODS) {  // the load-time column now brings in every module, one after another
              lt.pending = m.k;  // marks this module as the one being brought in
              for (const p of PH) { lt.phase = p; draw(); await ctx.sleep(260); if (!ctx.alive || g !== gen) return; }  // shows finding, loading and linking for 0.26 seconds each; quits if the slide was left or Reset was pressed
              lt.pending = null; lt.loaded.add(m.k); lt.log.push(`loader: found, loaded, linked <b>${m.label}</b> (${m.kb} KB)`);  // the module is now in memory, and the log records it
            }  // ends the loop over modules
            lt.log.push('ready to run');  // only now is the load-time column ready to run
            busy = false; draw(); story();  // frees the buttons and redraws
          }  // ends startApp
          async function call(m) {  // call(m): the student uses one feature, which calls module m
            const g = gen; busy = true; used.add(m.k);  // g remembers the reset count; busy disables the buttons; the module is recorded as used
            lt.log.push(`call ${m.label} → already linked, runs at once`);  // in the load-time column the module is already linked, so it runs at once
            if (rt.loaded.has(m.k)) rt.log.push(`call ${m.label} → already linked, runs at once`);  // in the run-time column it also runs at once if an earlier call already brought it in
            else {  // otherwise the first call has to wait
              rt.log.push(`call ${m.label} → <span class="c-bad">not in memory</span>: the OS steps in`);  // the log says the module is not in memory and the OS steps in
              rt.pending = m.k;  // marks the module as being brought in
              for (const p of PH) { rt.phase = p; draw(); await ctx.sleep(420); if (!ctx.alive || g !== gen) return; }  // shows the three phases for 0.42 seconds each, the pause of a first call; quits if the slide was left or reset
              rt.pending = null; rt.loaded.add(m.k);  // the module is now in memory
              rt.log.push(`OS found, loaded, linked <b>${m.label}</b> (${m.kb} KB); the call goes ahead`);  // the log records it, and the call goes ahead
            }  // ends the first-call case
            busy = false; draw(); story();  // frees the buttons, redraws and updates the message
          }  // ends call
          reset(); draw(); story();  // sets up the starting state, draws both columns and writes the first message
          const col = (i, title, sub) => h('div', { class: 'card stack', style: { gap: '7px', padding: '10px 12px' } },  // col(i, title, sub): builds the card for column i, with its title and a one-line description
            h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('span', { class: 'b', html: title }), colEls[i].kb),  // the card's heading row: the method's name on the left, the KB readout on the right
            h('div', { class: 'xs muted', html: sub }), colEls[i].boxes, colEls[i].meter, colEls[i].log);  // then the description, the module boxes, the meter and the log
          el.append(h('div', { class: 'stack fill', style: { gap: '7px' } },  // puts the step on screen as one column filling the step's height
            h('p', { class: 'm0', html: '<span class="t">Run-time dynamic linking</span> waits even longer than load time. The program starts with references to outside modules still open. Only when it actually <b>calls</b> one that is not in memory does the OS find it, load it and link it.' }),  // intro paragraph: run-time dynamic linking leaves references open until a module is actually called
            actRow,  // the action buttons
            h('div', { class: 'grid-2', style: { gap: '12px' } },  // the two columns side by side (one above the other on a phone)
              col(0, '<span class="t">Load-time dynamic linking</span>', 'Every referenced module is found, loaded and linked before the program runs.'),  // left column: load-time dynamic linking, where every module comes in before the program runs
              col(1, 'Run-time dynamic linking', 'A module is found, loaded and linked the first time it is called.')),  // right column: run-time dynamic linking, where a module comes in on its first call
            out,  // the narration box under the columns
            h('div', { class: 'grid-2', style: { gap: '12px' } },  // two callouts side by side
              h('div', { class: 'callout warn m0 small', 'data-label': 'The trade-off', html: 'The first call to each module pauses while the OS loads it; load-time linking pays that cost up front instead. Today a program can also ask for a library by name while running (dlopen on Linux, LoadLibrary on Windows).' }),  // trade-off callout: the pause on each first call, and asking for a library by name while running
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake: look-alike names', html: '<b>Dynamic run-time loading</b> is about addresses: the base register is added on every reference. <b>Run-time dynamic linking</b> is about modules: a missing one is brought in on its first call.' }))));  // common-mistake callout: dynamic run-time loading (addresses) versus run-time dynamic linking (modules); closes the layout
        },  // ends render for step 8
      },  // ends step 8
      /* ---------------- 9. Recap ---------------- */
      {  // step 9 begins
        title: 'Recap: eight ideas to carry away',  // the title shown at the top of step 9
        kind: 'recap',  // a recap step, labelled Recap
        render(el, ctx) {  // render(el, ctx): builds step 9 when its slide opens
          const { h } = ctx;  // pulls out h, the page element builder
          const flipAll = (on) => ctx.$$('.flip').forEach((c) => c.classList.toggle('on', on));  // flipAll(on): turns every card on this slide face up (true) or face down (false)
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // puts the step on screen as one column filling the step's height
            h('div', { class: 'row', style: { gap: '8px' } }, h('p', { class: 'm0 muted small grow' }, 'Say each answer out loud before you flip the card. Click a card again to flip it back.'),  // a top row with the instruction to answer each card out loud before flipping it
              h('button', { class: 'btn sm', onclick: () => flipAll(true) }, 'Flip all'), h('button', { class: 'btn sm ghost', onclick: () => flipAll(false) }, 'Hide all')),  // the Flip all and Hide all buttons at the end of that row
            ctx.ui.flipcards([  // the grid of flip cards, each written as [front, back]
              ['The trip from source to process', 'Source files → compiler or assembler → object modules → linker → load module → loader → process image in main memory. A shared library may join at load time or at run time.'],  // card: the whole trip from source files to a process image, and when a shared library joins
              ['Absolute loading', 'Addresses are already real when the module is made, bound by the programmer or by the assembler. The loader only copies. The module runs at one place only, and shifting code changes every later address.'],  // card: absolute loading, real addresses made early, one place only
              ['Relocatable loading', 'Relative addresses plus a relocation dictionary. The loader adds the load address to every listed word, once. After that the program cannot move: swapped out, it must come back to the same place.'],  // card: relocatable loading, patched once by the loader, so it must come back to the same place
              ['Dynamic run-time loading', 'Relative addresses stay in memory. The hardware adds the base register on every reference, so a process can be swapped back in anywhere. The cost: one addition per reference, done by hardware.'],  // card: dynamic run-time loading, the base register added on every reference
              ['The four binding times', 'Programming time (the programmer), compile or assembly time (the translator), load time (the loader), run time (the processor, on each reference).'],  // card: the four binding times and who converts at each
              ['What a linker computes', 'It lays object modules end to end. With A, B, C of lengths L, M, N in that order: A starts at 0, B at L and C at L + M. Relative address x inside B becomes L + x; a call to B becomes a jump to L.'],  // card: the linker's start address rule for modules of lengths L, M and N
              ['Static vs dynamic linking', 'A linkage editor copies every module in ahead of time. Dynamic linking leaves references open, so library updates arrive without relinking, one copy is shared, and others can add modules.'],  // card: static versus dynamic linking and the three payoffs of dynamic linking
              ['Load-time vs run-time dynamic linking', 'Load time: the loader finds, loads and links every target module before the program runs. Run time: this happens on the first call, so memory holds only the modules actually used.'],  // card: load-time versus run-time dynamic linking
            ], { cols: 4, height: 218 })));  // closes the card list: four cards per row, each at least 218 pixels tall; closes the layout
        },  // ends render for step 9
      },  // ends step 9
      /* ---------------- 10. Quiz ---------------- */
      {  // step 10 begins: the quiz
        title: 'Check yourself: loading and linking',  // the title shown at the top of the quiz step
        kind: 'check',  // a check step, labelled Check Yourself
        quiz: [  // quiz: the questions, which the guide's quiz engine draws and marks
          { type: 'order', q: 'Put the stages that turn a program into a running process in order.',  // quiz question 1 (put in order): the stages from source files to a process
            items: ['A programmer writes the source files', 'A compiler or assembler turns each file into an object module', 'A linker combines the object modules into one load module', 'A loader copies the load module into main memory', 'The process image is in memory, ready to run'],  // the five stages, listed here in the right order; the quiz shuffles them
            why: 'Each source file is translated separately into an object module; the linker joins the modules into a load module; the loader places that module in memory, which builds the process image.' },  // explanation shown after answering: who does what at each stage
          { q: 'Every address in a load module is a real main-memory address that is correct only if the module starts at address 4000. Which kind of loading does this module need?',  // quiz question 2 (multiple choice): a module with real addresses for 4000 needs which kind of loading
            choices: ['Relocatable loading', 'Absolute loading', 'Dynamic run-time loading', 'Run-time dynamic linking'], answer: 1,  // the four choices; the right one, absolute loading, is number 1 (counting from 0)
            feedback: ['Relocatable loading needs relative addresses and a relocation dictionary; this module has real addresses with no list of what to adjust.', null, 'Run-time loading keeps relative addresses and adds a base register; this module’s addresses are already real.', 'That is about when outside modules are linked, not how the module’s own addresses are fixed.'],  // feedback for each wrong choice, saying why it does not fit; null marks the right one
            why: 'A module whose addresses are already real can only be copied to the one place it was built for, which is absolute loading.' },  // explanation: real addresses can only be copied to the one place they were built for
          { type: 'num', q: 'A relocatable load module is placed in main memory starting at address 7300. One word listed in its relocation dictionary holds the relative address 148. What value does the loader store in that word?', answer: 7448, tol: 0,  // quiz question 3 (calculate): the patched value of a listed word, relative 148 loaded at 7300, exactly 7448
            why: 'The loader adds the load address to every word on the relocation list: 148 + 7300 = 7448.' },  // explanation: add the load address to the relative address
          { type: 'tf', q: 'A relocation dictionary lists every word of a module, and the loader adds the load address to all of them.', answer: false,  // quiz question 4 (true or false): the dictionary lists every word; the answer is false
            why: 'It lists only the words that contain addresses. Adding the load address to a plain number, such as a loop limit, would silently change it.' },  // explanation: only address words are listed, or plain numbers such as a limit would be changed
          { q: 'A process was loaded with relocatable loading at address 2000 and has since been swapped out. Only the region starting at 5000 is free now. What happens if its saved image is copied there unchanged?',  // quiz question 5 (multiple choice): what happens when a relocatable image comes back at a new address
            choices: ['The loader automatically patches the listed words again for 5000, so every address follows the move.', 'The processor adds 5000 to each address as the program runs, so the process works at its new place.', 'It works, because the image still holds relative addresses, and those do not depend on location.', 'Its address fields still point into the region near 2000, so it reads and writes the wrong memory.'], answer: 3,  // the four choices; the right one, number 3, says its fields still point near the old place
            feedback: ['Patching happens once, at load time; the swapped image is copied back as it was, and its relative addresses are gone.', 'That is dynamic run-time loading, which needs relative addresses to be kept in memory; here they were already turned into real ones.', 'After relocatable loading the words in memory hold real addresses for 2000, not relative ones.', null],  // feedback for each wrong choice: no re-patching, no base register, and no relative addresses left in memory
            why: 'Relocatable loading binds addresses at load time. Once patched, the image is tied to that place, so a swapped-out process must come back to the same location.' },  // explanation: relocatable loading binds at load time, so the process must return to the same place
          { type: 'num', q: 'Under dynamic run-time loading, a process’s base register holds 12000. An instruction in memory refers to relative address 356. Which physical address does the processor access?', answer: 12356, tol: 0,  // quiz question 6 (calculate): base register 12000 plus relative address 356, exactly 12356
            why: 'The hardware adds the base register to the relative address on each reference: 12000 + 356 = 12356. Move the process and only the base register changes.' },  // explanation: the hardware adds the base register on each reference
          { type: 'match', q: 'Match each address binding time to who turns addresses into real ones.',  // quiz question 7 (match the pairs): each binding time with who converts the addresses
            pairs: [['Programming time', 'The programmer, by writing real addresses into the code'], ['Compile or assembly time', 'The compiler or assembler, converting symbolic addresses'], ['Load time', 'The loader, adding the load address to relative addresses'], ['Run time', 'The processor hardware, on every memory reference']],  // the four pairs: programmer, translator, loader and hardware
            why: 'The later the binding, the more freedom the OS has to place and move the program, and the more work is left for the loader or the hardware.' },  // explanation: later binding gives the OS more freedom and leaves more work for the loader or hardware
          { type: 'num', q: 'A linker joins three object modules in the order A, B, C. Module A is 1,200 words long, B is 800 words and C is 500 words. The load module is numbered from address 0. At which address does C start?', answer: 2000, tol: 0,  // quiz question 8 (calculate): where module C starts after A (1200) and B (800), exactly 2000
            why: 'Each module starts where the ones before it end: C starts after A and B, at 1200 + 800 = 2000.' },  // explanation: C starts after the lengths of A and B added together
          { type: 'num', q: 'A linker joins object modules A (1,200 words), B (800 words) and C (500 words) in that order. Inside B, an instruction refers to B’s own relative address 75. The load module is numbered from 0. Which address does that instruction hold there?', answer: 1275, tol: 0,  // quiz question 9 (calculate): relative address 75 inside B after linking, exactly 1275
            why: 'B starts at 1200, the length of A, so relative address 75 inside B becomes 1200 + 75 = 1275.' },  // explanation: B starts at the length of A, so add 75 to 1200
          { q: 'In an object module, how does a call to a routine that is defined in a different module appear before linking?',  // quiz question 10 (multiple choice): how a call to another module's routine looks before linking
            choices: ['As a symbol, the routine’s name, still to be resolved', 'As the routine’s real main-memory address', 'As an address relative to the start of the calling module', 'As a relocation dictionary entry of the other module'], answer: 0,  // the four choices; the right one, number 0, is the routine's name as a symbol
            feedback: [null, 'Nobody knows where the routine will be in memory until much later.', 'The routine is not in the calling module, so no offset inside that module can point to it.', 'The dictionary lists words inside a module that hold addresses; it does not name routines in other modules.'],  // feedback for each wrong choice: no real address yet, no offset inside the caller, not a dictionary entry
            why: 'This is an external reference. The compiler cannot know where another module will be placed, so it leaves the name for the linker (or, with dynamic linking, the loader or OS) to resolve.' },  // explanation: this is an external reference, left as a name for the linker, loader or OS to resolve
          { type: 'bucket', q: 'Sort each statement under the kind of linking it describes.', buckets: ['Static linking', 'Dynamic linking'],  // quiz question 11 (sort into groups): statements under static or dynamic linking
            items: [['Done in advance by a linkage editor', 0], ['The load module still contains unresolved references', 1], ['Each program file carries its own copy of the library code', 0], ['An updated library is picked up without relinking the program', 1], ['One copy of a library in memory serves many programs', 1], ['The program still runs if the library file is later deleted', 0]],  // the six statements, each with the number of its group (0 = static, 1 = dynamic)
            why: 'Static linking copies library code into each program ahead of time. Dynamic linking defers that work, so programs share one copy and pick up updates, but need the library present.' },  // explanation: static linking copies library code in ahead of time; dynamic linking shares and updates but needs the file
          { type: 'multi', q: 'Which statements about run-time dynamic linking are true?',  // quiz question 12 (select all): which statements about run-time dynamic linking are true
            choices: ['A module is found, loaded and linked the first time the program calls it.', 'Memory is spent only on the modules the program actually calls.', 'Every referenced module is loaded before the program starts.', 'The first call to a module can take longer than later calls.', 'The program must be relinked whenever a library changes.'],  // the five statements to judge
            answer: [0, 1, 3],  // the true ones are numbers 0, 1 and 3
            why: 'Run-time dynamic linking waits for the first call, so unused modules never take memory, at the cost of a pause on that first call. Loading everything before the start is load-time dynamic linking; relinking after a library change is a static-linking chore.' },  // explanation: modules come in on first call, saving memory at the cost of a pause; the false ones describe other methods
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the steps list
    notes: `${/* notes: the printable reading notes for this section, written as HTML inside backticks */''}
<h3>From source files to a running process</h3>${/* notes heading for part 1: from source files to a running process */''}
<p>Creating a process starts with putting a program into main memory and building its process image. Real programs are made of several separately compiled or assembled modules, so they must also be <b>linked</b>: references between the modules, and references to library routines, must be turned into addresses. Library routines are either copied into the program or left as shared code that the OS supplies when the program loads or runs.</p>${/* notes paragraph: why programs must be loaded and linked, and the two ways library routines are handled */''}
<p><b>The pipeline:</b> source files → compiler or assembler → <b>object modules</b> → <b>linker</b> → <b>load module</b> → <b>loader</b> → process image in main memory. A shared (dynamic) library can join at load time or at run time.</p>${/* notes paragraph: the pipeline from source files to a process image, with the shared library joining late */''}
<ul>${/* start of the notes list of the three key pieces */''}
<li><b>Object module:</b> the translation of one source file. Its code and data are numbered from its own word 0; names it needs from elsewhere (external references) are left as symbols, listed with the names it defines.</li>${/* notes bullet: what an object module contains and how it numbers its words */''}
<li><b>Load module:</b> one file made by the linker from all the object modules, laid end to end.</li>${/* notes bullet: the load module the linker makes */''}
<li><b>Loader:</b> the part of the OS that copies the load module into memory and makes its addresses work there.</li>${/* notes bullet: the loader, the part of the OS that places the module */''}
</ul>${/* end of the notes list */''}
<p>Example: main.o (60 words) calls average (in stats.o, 40 words) and print (in a library). The linker puts main.o at 0–59 and stats.o at 60–99, so <code>CALL average</code> becomes <code>CALL 60</code>. Loaded at 3000, that call reaches 3060.</p>${/* notes example: the two modules from step 1, linked and then loaded at 3000 */''}

<h3>Absolute loading</h3>${/* notes heading for part 2: absolute loading */''}
<p>Every address in the load module is already a real memory address, so the loader only copies it, always to the same place. The binding happens either at <b>programming time</b> (the programmer writes real addresses, e.g. <code>LOAD 1006</code>) or at <b>compile or assembly time</b> (the programmer writes symbolic addresses such as <code>LOAD count</code> and the assembler converts them, given the start address).</p>${/* notes paragraph: real addresses, copied to one place, bound at programming time or assembly time */''}
<p><b>Drawbacks:</b> the module runs at one place only, and any change that shifts code moves every later address. With hand-written addresses, inserting one instruction at word 3 of a 9-word loop left 4 of its 5 address fields pointing at the wrong word; assembling from names recomputes them all, but the module is still tied to one address.</p>${/* notes paragraph: the two drawbacks, with the result of the insert experiment from step 2 */''}

<h3>Relocatable loading</h3>${/* notes heading for part 3: relocatable loading */''}
<p>The assembler or compiler produces <b>relative addresses</b> (counted from the module's start, word 0) plus a <b>relocation dictionary</b>: a list of every word that contains an address. When the loader places the module at address L, it adds L to each listed word and copies all other words unchanged. The dictionary is needed because a loader cannot tell an address from a plain number by looking at it (word 0 holding <code>LOAD 6</code> and word 8 holding the number 6 look alike).</p>${/* notes paragraph: relative addresses, the relocation dictionary, and why the loader needs the list */''}
<p><b>Example:</b> loaded at L = 2400, <code>LOAD 6</code> becomes <code>LOAD 2406</code> and <code>JNEG 0</code> becomes <code>JNEG 2400</code>; the data 0, 2, 6 stay as they are.</p>${/* notes example: which words change when the toy loop is loaded at 2400, and which stay as they are */''}
<p><b>Drawback:</b> once patched, the image in memory holds real addresses for L. If the process is swapped out, it must be brought back to the same place.</p>${/* notes paragraph: the drawback, a patched image must come back to the same place */''}

<h3>Dynamic run-time loading</h3>${/* notes heading for part 4: dynamic run-time loading */''}
<p>The load module keeps its relative addresses even after it is in memory. The real address is computed only when an instruction actually runs: the processor hardware adds the <b>base register</b> (which the OS sets to where the process currently sits) to each address. Example: base register 2400, <code>LOAD 6</code> reaches 2406. The process can be swapped out and brought back <b>anywhere</b>; the OS just sets the base register to the new start. The cost is an addition on every memory reference, done by hardware so it is fast.</p>${/* notes paragraph: relative addresses stay in memory and the base register is added as each instruction runs */''}
<table>${/* start of the notes table that sums up the swapping lab from step 4 */''}
<tr><th>Loaded at 1000, swapped out, back at 2400</th><th>First run at 1000</th><th>Run after coming back at 2400</th></tr>${/* table header: the story (loaded at 1000, swapped out, back at 2400) and its two moments */''}
<tr><td>Absolute (built for 1000)</td><td>works</td><td>breaks: still uses 1000–1008</td></tr>${/* table row: absolute loading works at first and breaks after coming back */''}
<tr><td>Relocatable</td><td>works</td><td>breaks: words were patched for 1000</td></tr>${/* table row: relocatable loading works at first and breaks after coming back */''}
<tr><td>Dynamic run-time</td><td>works</td><td>works: base register = 2400</td></tr>${/* table row: dynamic run-time loading works both times */''}
</table>${/* end of the swapping table */''}

<h3>Address binding times</h3>${/* notes heading for part 5: address binding times */''}
<table>${/* start of the notes table of the four binding times */''}
<tr><th>Binding time</th><th>What happens</th><th>Can the program move later?</th></tr>${/* table header: binding time, what happens, and whether the program can move later */''}
<tr><td>Programming time</td><td>The programmer writes actual physical addresses.</td><td>No</td></tr>${/* table row: programming time */''}
<tr><td>Compile or assembly time</td><td>The compiler or assembler converts symbolic references into physical addresses.</td><td>No</td></tr>${/* table row: compile or assembly time */''}
<tr><td>Load time</td><td>The loader converts relative addresses to physical ones while loading.</td><td>No, once loaded</td></tr>${/* table row: load time */''}
<tr><td>Run time</td><td>Relative addresses are kept; the processor hardware converts them on each reference.</td><td>Yes</td></tr>${/* table row: run time, the only one that lets the program move */''}
</table>${/* end of the binding times table */''}

<h3>Linking</h3>${/* notes heading for part 6: linking */''}
<p>The linker takes a set of object modules and produces one load module that is their <b>contiguous concatenation</b>. Inside an object module, references to its own code and data are relative to that module's start; references to other modules (<b>external references</b>) appear only as symbols. If modules A, B and C have lengths L, M and N, then in the load module A starts at 0, <b>B at L</b> and <b>C at L + M</b>. A reference to relative address x inside B becomes <b>L + x</b>, and a call to B becomes a jump to <b>L</b>.</p>${/* notes paragraph: the load module is the modules laid end to end, and the start address rule for lengths L, M and N */''}
<p><b>Worked example:</b> A = 300, B = 250, C = 120 words, in the order A, B, C. B starts at 300, C at 300 + 250 = 550, and the load module is 670 words. A call to C becomes <code>CALL 550</code>; <code>LOAD 210</code> inside B becomes <code>LOAD 510</code>; <code>JUMP 15</code> inside C becomes <code>JUMP 565</code>. In the order B, C, A, C would start at 250 and A at 370.</p>${/* notes worked example: the three modules from the linker lab, their start addresses and three rewritten references */''}

<h3>Static and dynamic linking</h3>${/* notes heading for part 7: static and dynamic linking */''}
<p>A <b>linkage editor</b> performs <b>static linking</b>: it produces a single relocatable load module containing everything, library routines included. <b>Dynamic linking</b> defers the linking of some external modules until after the load module is created, so the load module still holds unresolved references to them.</p>${/* notes paragraph: what a linkage editor does, and how dynamic linking leaves references unresolved */''}
<p><b>Load-time dynamic linking:</b> the load module is read into memory, and every reference to an external (target) module makes the loader find that module, load it and link it. Benefits: (1) when a target module, such as an OS utility, is updated, programs use the new version automatically without being relinked; (2) one copy of the target code, kept in a dynamic link library, is shared by many programs; (3) independent developers can extend the system with new modules. A program that is already running keeps the version it linked; it picks up an update at its next load.</p>${/* notes paragraph: load-time dynamic linking and its three benefits */''}
<p>Example: three apps of 300, 250 and 200 KB all use a 600 KB library. Statically linked, the three running apps need 750 + 3 × 600 = 2,550 KB of memory; dynamically linked to one shared copy, 750 + 600 = 1,350 KB.</p>${/* notes example: memory needed by three apps with static linking versus one shared library copy */''}
<p><b>Run-time dynamic linking:</b> some linking is postponed until execution. When the program calls a module that is not yet present, the OS finds it, loads it and links it, and then the call proceeds. Benefit: memory is used only for modules the program actually calls; the price is a pause on the first call to each one. Example: an 800 KB program with optional modules of 300, 200, 500 and 150 KB that only ever prints holds 800 + 200 = 1,000 KB with run-time linking, against 1,950 KB with load-time linking.</p>${/* notes paragraph: run-time dynamic linking, its benefit and its cost, with the PhotoApp numbers */''}
<p><b>Today's names:</b> shared libraries are .so files on Linux and other UNIX-like systems and dynamic link libraries (DLLs, .dll files) on Windows. Programs can also request a library explicitly while running (for example dlopen on Linux, LoadLibrary on Windows), and many systems postpone looking up each library function until its first call.</p>${/* notes paragraph: the names shared libraries go by on Linux and Windows, and loading a library by name while running */''}
<p><b>Do not mix up the look-alike names.</b> <i>Dynamic run-time loading</i> is about addresses: relative addresses stay in memory and the base register is added on every reference. <i>Run-time dynamic linking</i> is about modules: a module that is not yet present is found, loaded and linked on its first call.</p>${/* notes paragraph: how to tell dynamic run-time loading apart from run-time dynamic linking */''}
`,  // end of the notes text
  });  // ends the object passed to Guide.section
})();  // ends the wrapping function and runs it at once
