// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 2.3 — Major Achievements
   The four big ideas every modern OS is built on: the process, memory
   management, information protection and security, and scheduling and
   resource management. Original teaching material, built step by step. Shared helpers live in the IIFE so nothing leaks
   into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in an arrow function that runs once, right away, so its names stay private to this file
  /* ------------------------------------------------------------------
     Shared helpers
     ------------------------------------------------------------------ */
  const PAGE = 1024;                 // bytes per page in the paging lab (1 KB)

  /* tiny SVG builders (Guide.s is the shell's SVG element factory) */
  const S = (tag, props, ...kids) => Guide.s(tag, props, ...kids);  // S(tag, props, kids): short name for the guide's SVG builder (SVG is the browser's drawing format); makes one shape
  const R = (x, y, w, hh, cls, o) => S('rect', Object.assign({ x, y, width: w, height: hh, rx: 10, class: cls, 'stroke-width': 2 }, o || {}));  // R(x, y, w, hh, cls, o): draws a rounded rectangle at (x, y) with a colour class; o can override any attribute
  const T = (x, y, str, o = {}) => S('text', { x, y, 'text-anchor': o.a || 'middle', 'font-size': o.fs || 15, 'font-weight': o.fw || 600, class: o.cls || null, style: o.st || null }, str);  // T(x, y, str, o): draws a text label, centred by default; o sets alignment, size, weight, class and inline style
  const stroke = (col, o) => ({ class: 's-line', style: col ? `stroke:var(--${col})` : null, 'stroke-width': o.w || 2.5, 'stroke-dasharray': o.dash || null, 'marker-end': o.head === false ? null : `url(#arr${col ? '-' + col : ''})` });  // stroke(col, o): the shared line style: colour from a theme variable, width, optional dashes and an arrowhead at the end
  const LN = (x1, y1, x2, y2, col, o = {}) => S('line', Object.assign({ x1, y1, x2, y2 }, stroke(col, o)));  // LN(x1, y1, x2, y2, col, o): draws a straight line or arrow between two points using the shared stroke style
  const PA = (d, col, o = {}) => S('path', Object.assign({ d }, stroke(col, o)));  // PA(d, col, o): draws a curved or bent arrow from an SVG path string d, with the same stroke style
  const OK = 'fill:var(--ok)', BAD = 'fill:var(--bad)';  // inline styles that colour text green (success) or red (failure) in the demos
  /* phones: keep dense diagrams readable by giving them a minimum width inside a sideways scroller */
  const fitWide = (ctx, svg, minW) => {  // fitWide(ctx, svg, minW): on a phone-width screen, wraps a diagram so it keeps a readable width and scrolls sideways
    if (!ctx.narrow) return svg;  // on a normal-width screen the diagram is returned untouched and simply scales to fit
    svg.style.minWidth = minW + 'px';  // on a phone, stops the drawing from shrinking below minW pixels
    return Guide.h('div', {}, Guide.h('div', { class: 'hscroll' }, svg), Guide.h('div', { class: 'xs muted' }, '↔ swipe sideways to see the whole diagram'));  // puts the drawing in a sideways scroller and adds a small hint telling the student to swipe
  };  // ends fitWide

  /* ------------------------------------------------------------------
     Step 1 hub: four mini-demos. draw(withIt, frame) → [svgNodes, caption]
     Every demo has 4 frames and the same story in both modes, so the
     student can flip "Without it / With it" and compare the endings.
     ------------------------------------------------------------------ */
  const HUB = [  // HUB: the four mini-demos on step 1, one per major achievement, each drawn with and without the idea
    { name: 'The process', col: 'proc', where: 'Steps 2–4',  // demo 1: the process; col picks its colour and where names the steps that cover it later
      solves: 'Programs share one processor without losing their place.',  // one-line summary of what the process idea solves, shown on the demo's tile
      draw(w, i) {  // draw(w, i): builds frame i (0-3) of the process demo; w is true in "With it" mode; returns [shapes, caption]
        const run = i === 1 ? 'Compiler' : 'Editor';  // the Compiler holds the processor only in frame 1; the Editor runs in every other frame
        const pc = i === 0 ? '42' : i === 1 ? '4' : w ? '42' : '4';  // the program counter shown: 42 for the Editor, 4 after the Compiler ran, and in the final frames 42 only if it was saved
        const bad = !w && i >= 2;  // bad is true in the last two frames of "Without it" mode, when the Editor resumes at the wrong place
        const saved = { Editor: w && i >= 1 ? 'PC 42 · R1 7' : null, Compiler: w && i >= 2 ? 'PC 4 · R1 3' : null };  // the saved context each program's record holds; in "Without it" mode nothing is ever saved
        const prog = (name, y) => {  // prog(name, y): draws one program's box at height y, with its status and its saved-context panel
          const on = name === run;  // on is true for the program currently holding the processor
          return [R(300, y, 284, 96, 's-proc', { 'stroke-width': on ? 3.5 : 1.5 }),  // the program's box, drawn with a thicker outline while it runs
            T(318, y + 40, name, { a: 'start', fs: 17, fw: 800 }),  // the program's name in bold at the top left of its box
            T(318, y + 66, on ? (bad ? 'running ✗' : 'running') : 'paused', { a: 'start', fs: 14, cls: on ? null : 's-sub', st: on && bad ? BAD : null }),  // status line: running (marked with a cross in red when it resumed wrongly) or a grey "paused"
            R(438, y + 12, 134, 72, 's-panel', { rx: 8, 'stroke-dasharray': w ? null : '5 4' }),  // the inner panel for the saved context, dashed when there is no place to save anything
            T(505, y + 34, w ? 'saved context' : 'no saved context', { fs: 12.5, cls: 's-sub' }),  // label on the panel: "saved context" or "no saved context"
            T(505, y + 62, saved[name] || (w ? '(empty)' : '—'), { fs: 14, fw: 700, cls: 's-monot' })];  // the saved values themselves in a fixed-width font, or "(empty)" / a dash when nothing is saved
        };  // ends prog
        const n = [R(16, 40, 190, 150, 's-cpu'), T(111, 72, 'Processor', { fs: 17, fw: 800 }),  // n collects this frame's shapes, starting with the processor box and its title
          T(111, 102, 'running:', { fs: 13.5, cls: 's-sub' }), T(111, 124, run, { fs: 16, fw: 750 }),  // the processor shows which program is currently running on it
          T(111, 166, 'PC = ' + pc, { fs: 22, fw: 800, cls: 's-monot', st: bad ? BAD : 'fill:var(--cpu)' }),  // the program counter value, drawn large; it turns red when it holds the wrong program's position
          ...prog('Editor', 12), ...prog('Compiler', 122), LN(206, 115, 294, run === 'Editor' ? 62 : 170, 'cpu')];  // adds both program boxes and an arrow from the processor to whichever program is running
        if (i === 1 || i === 2) n.push(T(111, 28, 'timer interrupt', { fs: 14, fw: 800, st: 'fill:var(--intr)' }));  // in frames 2 and 3 a "timer interrupt" label above the processor shows why the switch happens
        if (i === 3) n.push(T(111, 222, w ? '✓ resumes correctly' : '✗ resumes in the wrong place', { fs: 14.5, fw: 800, st: w ? OK : BAD }));  // in the last frame a verdict line appears: resumed correctly, or resumed in the wrong place
        const cap = [  // cap picks the caption for this frame from the list below
          'The <b>Editor</b> is running. The processor\'s program counter (PC) says its next instruction is line 42, and register R1 holds 7.',  // caption for frame 1: the Editor is running with PC 42 and R1 = 7
          w ? 'A timer interrupt arrives. The OS first copies the Editor\'s <b>context</b> (PC 42, register R1 = 7) into the Editor\'s own record. Then the Compiler starts at its line 1 and runs lines 1 to 3, so the PC now reads 4 and R1 holds 3.'  // frame 2 "With it": the OS saves the Editor's context before the Compiler runs lines 1-3
            : 'A timer interrupt arrives and the Compiler starts at its line 1. Nobody writes down where the Editor stopped. The Compiler runs lines 1 to 3, so the PC now reads 4 and R1 holds 3.',  // frame 2 "Without it": the Compiler starts and nobody records where the Editor stopped
          w ? 'Another interrupt: time to switch back. The OS saves the Compiler\'s context (PC 4, R1 = 3) as well, then reloads the Editor\'s saved values, so the PC is 42 again.'  // frame 3 "With it": the OS saves the Compiler's context and reloads the Editor's saved values
            : 'Time to switch back to the Editor. The only values left in the processor are the Compiler\'s: PC 4, R1 = 3.',  // frame 3 "Without it": only the Compiler's values are left in the processor
          w ? '<b>✓ The Editor carries on at line 42</b> with R1 = 7 again, as if it had never been paused. Giving every running program a record like this is the heart of the process idea.'  // frame 4 "With it": the Editor resumes at line 42, the core of the process idea
            : '<b>✗ The Editor jumps to line 4</b> of its own code, holding the Compiler\'s R1 value, and produces garbage or crashes. Hand-written switching code in early systems was full of bugs like this.'][i];  // frame 4 "Without it": the Editor jumps to the wrong line and crashes; [i] picks this frame's caption
        return [n, cap];  // hands the shapes and the caption back to the player that shows them
      } },  // ends draw() and the process demo
    { name: 'Memory management', col: 'mem', where: 'Steps 5–6',  // demo 2: memory management, explored in steps 5-6
      solves: 'Every program gets its own memory, safe from the others.',  // one-line summary of what memory management solves, shown on the demo's tile
      draw(w, i) {  // draw(w, i): builds frame i of the memory demo, where a bug in Program A tries to write into Program B
        const X = (a) => 20 + a * 0.112;  // X(a) turns a memory address (0-5000) into a horizontal pixel position in the drawing
        const n = [T(20, 34, 'Main memory', { a: 'start', fw: 800 }),  // n starts with the "Main memory" heading
          R(X(0), 60, X(1000) - X(0), 70, 's-os', { rx: 6 }), T(X(500), 101, 'OS', { fw: 800 }),  // the OS region occupies addresses 0-999 at the left of the memory bar
          R(X(1000), 60, X(3000) - X(1000), 70, 's-proc', { rx: 6, 'stroke-width': i >= 1 ? 3 : 2 }),  // Program A's region, 1000-2999, outlined more heavily once its bug comes into play
          T(X(2000), 91, 'Program A', { fw: 800 }), T(X(2000), 113, 'has a bug', { fs: 13, cls: 's-sub' }),  // Program A's name and the note that it has a bug
          R(X(3000), 60, X(5000) - X(3000), 70, 's-proc', { rx: 6 }), T(X(4350), 101, 'Program B', { fw: 800 }),  // Program B's region, 3000-4999, and its name
          R(X(3380), 78, 36, 34, !w && i >= 2 ? 's-bad' : 's-mem', { rx: 5 }), T(X(3380) + 18, 100, 'data', { fs: 12.5, fw: 700 })];  // a small box for B's data near address 3500, turned red once A's stray store has overwritten it
        [0, 1000, 3000, 5000].forEach((a) => n.push(LN(X(a), 132, X(a), 142, '', { head: false, w: 1.5 }),  // draws a tick mark under each region boundary on the memory bar
          T(X(a), 158, String(a), { fs: 12.5, cls: 's-sub', a: a === 0 ? 'start' : a === 5000 ? 'end' : 'middle' })));  // labels each tick with its address, aligned so the first and last labels stay inside the drawing
        if (i >= 1) {  // from frame 2 onward, draw A's attempted store
          const stop = w && i >= 2;  // stop is true when the hardware blocks the store ("With it" mode, frames 3-4)
          n.push(PA(stop ? `M${X(2000)},58 C 270,18 330,18 ${X(3000) - 6},62` : `M${X(2000)},58 C 280,10 390,10 ${X(3530)},76`, 'intr', { dash: '6 4' }),  // a dashed curved arrow from A: it stops at B's boundary if blocked, otherwise it reaches B's data
            T(318, 20, 'store to address 3500', { fs: 13.5, fw: 700, st: 'fill:var(--intr)' }));  // label over the arrow naming the bad address, 3500
        }  // ends the stray-store drawing
        if (i >= 2 && w) n.push(LN(X(3000), 48, X(3000), 142, 'bad', { head: false, w: 5 }),  // "With it": a thick red wall at address 3000 where the hardware check stops the store
          T(300, 192, 'Hardware check: 3500 is outside A\'s region (1000–2999) → blocked', { fs: 13.5, fw: 700, st: BAD }));  // red explanation under the bar: 3500 lies outside A's region, so the store is blocked
        if (i >= 2 && !w) n.push(T(300, 192, 'No check: the store lands in B\'s data', { fs: 13.5, fw: 700, st: BAD }));  // "Without it": red note that nothing checks the address and the store lands in B's data
        if (i === 3) n.push(T(300, 218, w ? '✓ The OS stops A; B is untouched' : '✗ B crashes later, though B has no bug', { fs: 15, fw: 800, st: w ? OK : BAD }));  // last frame verdict: the OS stops only A, or B crashes later through no fault of its own
        const cap = [  // cap picks the caption for this frame from the list below
          'Programs A and B share main memory. A owns addresses 1000–2999 and B owns 3000–4999. Program A has a bug.',  // caption for frame 1: how memory is divided between A and B
          'The bug makes A compute a wrong address, 3500, and try to store a value there. That address belongs to B.',  // caption for frame 2: the bug produces the address 3500, which belongs to B
          w ? 'The hardware checks every address A uses against A\'s own region. 3500 is outside it, so the store is <b>blocked</b> and the OS is interrupted.'  // frame 3 "With it": the hardware checks the address and blocks the store
            : 'Nothing checks the address, so the store goes through and <b>overwrites B\'s data</b>.',  // frame 3 "Without it": nothing checks the address, so B's data is overwritten
          w ? '<b>✓ The OS stops only A</b> and reports the error. B never notices. Keeping programs out of each other\'s memory is the first job of memory management.'  // frame 4 "With it": only A is stopped, the first job of memory management
            : '<b>✗ B later reads its own data and crashes</b>, even though B has no bug. Tracking down the real culprit is a nightmare.'][i];  // frame 4 "Without it": B crashes later and the real culprit is hard to find
        return [n, cap];  // hands the shapes and the caption back to the player
      } },  // ends draw() and the memory management demo
    { name: 'Protection and security', col: 'os', where: 'Step 7',  // demo 3: protection and security, explored in step 7
      solves: 'Users and programs reach only what they are allowed to.',  // one-line summary of what protection and security solves, shown on the demo's tile
      draw(w, i) {  // draw(w, i): builds frame i of the security demo, where Ben tries to read Ana's payroll file
        const benBad = !w && i === 3;  // benBad is true in the last "Without it" frame, when Ben has managed to read the salaries
        const n = [R(16, 22, 130, 70, 's-panel'), T(81, 52, 'Ana', { fs: 16, fw: 800 }), T(81, 74, 'owns payroll', { fs: 13, cls: 's-sub' }),  // n starts with Ana's box, labelled as the owner of the payroll file
          R(16, 140, 130, 70, benBad ? 's-bad' : 's-panel', { 'stroke-width': i >= 1 ? 3 : 2 }), T(81, 170, 'Ben', { fs: 16, fw: 800 }),  // Ben's box, outlined heavily once he acts and turned red if he gets in
          T(81, 192, benBad ? 'sees salaries ✗' : 'no permission', { fs: 13, cls: benBad ? null : 's-sub', st: benBad ? BAD : null }),  // Ben's status: "no permission" in grey, or "sees salaries" in red once the file has leaked
          R(226, 56, 170, 118, 's-os'), T(311, 86, 'Operating system', { fw: 800 }),  // the operating system box in the middle, standing between the users and the file
          T(311, 112, w ? 'checks access' : 'no access checks', { fs: 13.5, cls: 's-sub' }),  // the OS box says whether this OS checks access or not, depending on the mode
          R(470, 70, 114, 90, 's-io'), T(527, 108, 'payroll', { fs: 16, fw: 800, cls: 's-monot' }), T(527, 132, 'salaries', { fs: 13, cls: 's-sub' })];  // the payroll file on the right, holding the salaries
        if (i >= 1) n.push(LN(146, 164, 222, 138, 'proc'), T(188, 180, 'read payroll', { fs: 12.5, fw: 700, st: 'fill:var(--proc)' }));  // from frame 2 onward, an arrow from Ben to the OS labelled with his request to read payroll
        if (i >= 2 && w) n.push(T(311, 146, 'allowed: Ana only', { fs: 13.5, fw: 700, cls: 's-monot', st: 'fill:var(--os)' }));  // "With it", frame 3 on: the OS shows its access list, which allows Ana only
        if (i >= 2 && !w) n.push(LN(396, 115, 466, 115, 'io'), T(431, 104, 'opens', { fs: 13, fw: 700 }));  // "Without it", frame 3 on: an arrow shows the OS simply opening the file
        if (i === 3 && !w) n.push(PA('M500,162 Q 330,236 150,192', 'bad', { dash: '6 4' }));  // "Without it", last frame: a red dashed path carries the salaries back to Ben
        if (i === 3 && w) n.push(T(400, 208, '✓ refused and logged', { fs: 15, fw: 800, st: OK }), PA('M236,174 Q 214,216 150,202', 'bad'));  // "With it", last frame: a green "refused and logged" verdict and a red arrow bouncing the request back to Ben
        const cap = [  // cap picks the caption for this frame from the list below
          'Ana and Ben share one computer. The file <b>payroll</b> belongs to Ana, and Ben has no permission to read it.',  // caption for frame 1: payroll belongs to Ana and Ben has no permission
          'Ben\'s program asks the operating system to open payroll for reading.',  // caption for frame 2: Ben's program asks the OS to open payroll
          w ? 'The OS looks up who may read payroll. Only Ana is on the list.' : 'This OS has no access checks, so it simply opens the file for Ben.',  // frame 3 caption: the OS checks the list ("With it") or opens the file without checking ("Without it")
          w ? '<b>✓ The request is refused and recorded.</b> Ana\'s data stays private. Controlling who may use what, and proving who is asking, is protection and security.'  // frame 4 "With it": the request is refused and recorded, which is protection and security
            : '<b>✗ Ben reads every salary.</b> Confidentiality is lost, and nothing even records that it happened.'][i];  // frame 4 "Without it": Ben reads every salary and nothing records it
        return [n, cap];  // hands the shapes and the caption back to the player
      } },  // ends draw() and the security demo
    { name: 'Scheduling and resource management', col: 'cpu', where: 'Step 8',  // demo 4: scheduling and resource management, explored in step 8
      solves: 'Decides who runs next, and for how long.',  // one-line summary of what scheduling solves, shown on the demo's tile
      draw(w, i) {  // draw(w, i): builds frame i of the scheduling demo, a timeline of a long job and a keystroke
        const X = (t) => 130 + t * 40;  // X(t) turns a time in seconds into a horizontal pixel position on the timeline
        const bar = (t0, t1, y, cls) => R(X(t0), y, Math.max(4, X(t1) - X(t0)), 36, cls, { rx: 5 });  // bar(t0, t1, y, cls): draws a coloured bar from time t0 to t1 on one row; at least 4 pixels wide so short bits stay visible
        const n = [T(120, 57, 'Report job', { a: 'end', fw: 750 }), T(120, 119, 'Editor', { a: 'end', fw: 750 }),  // n starts with the row labels: the report job on top, the editor below
          LN(130, 158, 576, 158, '', { head: false, w: 1.5 }),  // the time axis along the bottom of the timeline
          R(398, 4, 14, 14, 's-proc', { rx: 3 }), T(418, 16, 'running', { a: 'start', fs: 12.5, cls: 's-sub' }),  // legend square and label: teal bars (the process colour) mean running
          R(488, 4, 14, 14, 's-warn', { rx: 3 }), T(508, 16, 'waiting', { a: 'start', fs: 12.5, cls: 's-sub' })];  // legend square and label: amber bars mean waiting
        [0, 2, 4, 6, 8, 10].forEach((t) => n.push(LN(X(t), 154, X(t), 162, '', { head: false, w: 1.5 }), T(X(t), 180, t + ' s', { fs: 12.5, cls: 's-sub' })));  // tick marks and labels every 2 seconds along the time axis
        if (i < 2) n.push(bar(0, 1.2, 34, 's-proc'));  // frames 1-2: only the first 1.2 s of the report job has run so far
        else if (w) n.push(bar(0, 1.5, 34, 's-proc'), bar(1.6, 10.1, 34, 's-proc'), bar(1.2, 1.5, 96, 's-warn'), bar(1.5, 1.6, 96, 's-proc'));  // "With it": the report runs until its 0.5 s slice ends at 1.5 s, the editor runs 1.5-1.6 s, then the report finishes
        else n.push(bar(0, 10, 34, 's-proc'), bar(1.2, 10, 96, 's-warn'), bar(10, 10.1, 96, 's-proc'));  // "Without it": the report runs straight to 10 s while the editor waits, running only at the very end
        if (i >= 1) n.push(LN(X(1.2), 90, X(1.2), 140, 'intr', { head: false }), T(X(1.2) + 8, 90, 'key pressed', { a: 'start', fs: 13, fw: 700, st: 'fill:var(--intr)' }));  // from frame 2: a vertical marker at 1.2 s where the key is pressed
        if (i >= 2) n.push(w ? T(X(1.6) + 10, 119, 'waits 0.3 s, then runs 0.1 s', { a: 'start', fs: 13, fw: 700 })  // from frame 3, "With it": a label says the editor waited only 0.3 s before its 0.1 s of work
          : T(X(5.6), 119, 'waiting 8.8 s', { fs: 13, fw: 700 }));  // "Without it": a label says the editor waited 8.8 s
        if (i === 3) n.push(T(350, 214, w ? '✓ response time 0.4 s' : '✗ response time 8.9 s', { fs: 16, fw: 800, st: w ? OK : BAD }));  // last frame verdict: response time 0.4 s with time slices, 8.9 s without
        const cap = [  // cap picks the caption for this frame from the list below
          'A long <b>report job</b> starts. It needs 10 seconds of processor time.',  // caption for frame 1: the long report job starts and needs 10 s of processor time
          'At 1.2 s a user presses a key in an editor. Showing that character needs only 0.1 s of processor time.',  // caption for frame 2: a key is pressed at 1.2 s and needs only 0.1 s of work
          w ? 'This OS hands out short <b>time slices</b> (0.5 s here) in turn. When the report\'s slice ends at 1.5 s, the editor gets the processor.'  // frame 3 "With it": time slices of 0.5 s let the editor in when the report's slice ends
            : 'This OS lets a job keep the processor until it finishes, so the editor waits in line behind the report.',  // frame 3 "Without it": the report keeps the processor until it finishes
          w ? '<b>✓ The character appears at 1.6 s</b>, 0.4 s after the key press, and the report still ends at 10.1 s. Deciding who runs next, and for how long, is scheduling.'  // frame 4 "With it": the character appears 0.4 s after the key press, which is what scheduling achieves
            : '<b>✗ The character appears at 10.1 s.</b> The user waited almost 9 seconds for one keystroke, and the report finished only 0.1 s sooner than it would have with time slices.'][i];  // frame 4 "Without it": the user waits almost 9 s for one keystroke
        return [n, cap];  // hands the shapes and the caption back to the player
      } },  // ends draw() and the scheduling demo
  ];  // closes the HUB list of four demos

  Guide.section({  // registers this section with the guide; the object below holds everything the section shows
    id: '2.3',  // the section number, used in links, the progress list and saved progress
    title: 'Major Achievements',  // the full title shown at the top of every step
    short: 'Major achievements',  // the short name used in the side menu and progress list
    summary: 'Four ideas every modern OS rests on: processes, memory management, protection and security, and scheduling.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Name the four major achievements in OS design and the problem each one solved.',  // objective 1: name the four achievements and the problem each solved
      'Define a process in four equivalent ways, list its three parts, and explain how the OS uses a process list, base and limit registers to switch between processes safely.',  // objective 2: define a process, its parts, and how the OS switches between processes safely
      'Explain why multiprogramming, time sharing and real-time transaction systems made the process concept necessary, and recognise the four kinds of errors that appear without it.',  // objective 3: why the process concept became necessary and the errors that appear without it
      'List the five storage-management responsibilities of an OS and translate a virtual address (page number + offset) into a real address or a page fault.',  // objective 4: storage-management duties and translating a virtual address with paging
      'Classify security problems by the goal they violate (availability, confidentiality, data integrity, authenticity) and describe how the OS uses queues and interrupts to schedule processes fairly and efficiently.',  // objective 5: the four security goals and scheduling with queues and interrupts
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Process', 'A program in execution: the program\'s code and data together with everything the OS needs to run it, pause it and later resume it exactly where it stopped.'],  // glossary entry: process
      ['Execution context', 'Everything the OS must remember to stop a process and later restart it as if nothing happened: the processor register values (including the program counter), priority, open files, pending I/O and so on. Also called the process state (here "state" means these saved details).'],  // glossary entry: execution context (also called the process state)
      ['Process list', 'A table the OS keeps with one entry per process. Each entry points to where the process lives in memory and may hold part or all of its saved execution context (the rest can be kept with the process itself).'],  // glossary entry: process list
      ['Base register', 'A processor register that holds the starting address of the memory region belonging to the running process. Addresses the process uses are counted from this point.'],  // glossary entry: base register
      ['Limit register', 'A processor register that holds the size of the running process\'s memory region. The hardware refuses any address at or beyond this size, so a process cannot reach outside its own region.'],  // glossary entry: limit register
      ['Mutual exclusion', 'Allowing only one process at a time to use a shared resource or run a piece of code that touches shared data.'],  // glossary entry: mutual exclusion
      ['Deadlock', 'A situation in which two or more processes each hold something the other one needs and wait for it, so none of them can ever continue.'],  // glossary entry: deadlock
      ['Virtual memory', 'A scheme in which each program uses its own logical addresses, as if it had a large private memory, while the OS and hardware map those addresses onto real main memory and onto disk.'],  // glossary entry: virtual memory
      ['Paging', 'Dividing every process into equal, fixed-size blocks called pages, and main memory into page-sized slots called page frames (frames). Any page can be loaded into any free frame, or kept on disk until it is needed.'],  // glossary entry: paging, pages and page frames
      ['Page table', 'The table the OS keeps for each process that says, for every page, which frame of main memory holds it or that it is currently only on disk. The MMU consults it on every memory access.'],  // glossary entry: page table
      ['Virtual address', 'An address as a program sees it. With paging it is made of a page number and an offset (the position inside that page).'],  // glossary entry: virtual address
      ['Real address', 'An actual location in main memory, found by combining the frame that holds the page with the offset. Also called a physical address.'],  // glossary entry: real (physical) address
      ['Memory management unit (MMU)', 'Hardware between the processor and main memory that translates every virtual address into a real address, and interrupts the OS when the page needed is not in main memory.'],  // glossary entry: memory management unit (MMU)
      ['Page fault', 'The interrupt raised when a program uses an address whose page is not in main memory. The OS reads the page in from disk, updates the page table and lets the program retry.'],  // glossary entry: page fault
      ['File system', 'The part of the OS that keeps information for the long term in named files on secondary storage, so it survives after programs end and the power goes off.'],  // glossary entry: file system
      ['Availability (security goal)', 'A security goal: the system and its data stay usable by authorized users whenever they need them, protected against anything that would interrupt service, such as a flood of fake requests.'],  // glossary entry: availability as a security goal
      ['Confidentiality', 'A security goal: only people and programs with permission can read the data.'],  // glossary entry: confidentiality
      ['Data integrity', 'A security goal: data cannot be changed, added to or deleted except by those allowed to do so.'],  // glossary entry: data integrity
      ['Authenticity', 'A security goal: the system can check that users really are who they claim to be, and that messages and data really come from where they say.'],  // glossary entry: authenticity
      ['Round-robin', 'A scheduling method that gives each ready process a short turn on the processor in circular order; a process whose turn runs out goes to the back of the line.'],  // glossary entry: round-robin scheduling
    ],  // closes the terms list

    css: ` /* css: the style rules for this section only, written as one text block that the guide adds to the page */
      /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width */
      .sec-2-3 .step-eyebrow { contain: inline-size; } /* stops the one-line step label above the title from forcing the whole page wider on a small screen */
      .sec-2-3 .hscroll { overflow-x: auto; contain: inline-size; padding-bottom: 4px; } /* the sideways scroller used by fitWide: scrolls horizontally without widening the page, with room for the scrollbar */
      /* step 1 hub tiles (each tile sets --c to its semantic colour) */
      .sec-2-3 .hub-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } /* lays the four demo tiles out as a two-column grid with small gaps */
      .sec-2-3 .hub-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left; padding: 10px 12px; border-radius: 12px; border: 2px solid var(--line); border-top: 5px solid var(--c); background: var(--panel); cursor: pointer; color: var(--ink); font: inherit; min-height: 104px; } /* each demo tile: a clickable card with a thick coloured top border in the demo's own colour */
      .sec-2-3 .hub-tile:hover { border-color: var(--c); } /* hovering a tile outlines it in its colour to show it can be clicked */
      .sec-2-3 .hub-tile.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 12%, var(--panel)); box-shadow: 0 0 0 1px var(--c); } /* the selected tile gets a coloured outline and a light tint of its colour so the student sees which demo is open */
      .sec-2-3 .hub-tile .n { font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: var(--c); } /* the small "Idea 1" label: tiny capitals in the tile's colour */
      .sec-2-3 .hub-tile b { font-size: 16.5px; line-height: 1.2; } /* the demo name in the tile, slightly larger than body text */
      .sec-2-3 .hub-tile .sv { font-size: 14px; color: var(--ink-2); line-height: 1.35; } /* the one-line summary in the tile, in a softer text colour */
      .sec-2-3 .demo-card { gap: 8px; } /* spaces the parts of the demo card evenly */
      .sec-2-3 .demo-card .player-cap { min-height: 4.5em; } /* keeps the caption area tall enough for the longest caption so the demo does not jump between frames */
      /* step 2 definition buttons + diagram dimming */
      .sec-2-3 .defbtn { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 10px; align-items: start; text-align: left; padding: 8px 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; font: inherit; font-size: 15.5px; line-height: 1.35; color: var(--ink); } /* each definition button on step 2: a number badge beside the text, drawn as a clickable card */
      .sec-2-3 .defbtn .k { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: var(--proc-bg); color: var(--proc); font-weight: 900; font-size: 14px; } /* the number badge on a definition button: a small rounded square in the process colour */
      .sec-2-3 .defbtn:hover { border-color: var(--proc); } /* hovering a definition button outlines it in the process colour */
      .sec-2-3 .defbtn.on { border-color: var(--proc); background: color-mix(in srgb, var(--proc) 11%, var(--panel)); box-shadow: 0 0 0 1px var(--proc); } /* the chosen definition button gets a process-coloured outline and tint so the student sees which one is active */
      .sec-2-3 svg .g { transition: opacity .25s; } /* diagram groups fade smoothly instead of switching instantly when a definition is picked */
      .sec-2-3 svg .g.dim { opacity: .2; } /* a dimmed group of the diagram drops to 20% opacity so the highlighted parts stand out */
      /* step 3 error gallery */
      .sec-2-3 .dev { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 10px; align-items: start; padding: 8px 12px; } /* a numbered row in the step 3 lists: a badge column beside the text */
      .sec-2-3 .dev .k { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-weight: 900; font-size: 14px; background: var(--panel-3); color: var(--ink-2); } /* the row's number badge: a small grey rounded square */
      .sec-2-3 .dev b { display: block; font-size: 15.5px; } /* the row's heading in bold on its own line */
      .sec-2-3 .dev div > span { display: block; font-size: 14px; color: var(--ink-2); line-height: 1.35; } /* the row's explanation under the heading in a softer colour */
      .sec-2-3 .opt { text-align: left; display: flex; flex-direction: column; gap: 2px; padding: 8px 11px; border: 2px solid var(--line); border-radius: 11px; background: var(--panel); cursor: pointer; font: inherit; color: var(--ink); } /* an answer button in the step 3 game: a card with a bold name and a short description stacked */
      .sec-2-3 .opt b { font-size: 15px; } /* the answer's name in bold */
      .sec-2-3 .opt span { font-size: 13px; color: var(--ink-2); line-height: 1.3; } /* the answer's description in small softer text */
      .sec-2-3 .opt:hover:not(:disabled) { border-color: var(--chc); } /* hovering an answer that can still be picked outlines it in the chapter colour */
      .sec-2-3 .opt:disabled { cursor: default; } /* once answered, the buttons no longer show a hand pointer */
      .sec-2-3 .opt.right { border-color: var(--ok); background: var(--ok-bg); } /* the correct answer turns green after the student answers */
      .sec-2-3 .opt.wrong { border-color: var(--bad); background: var(--bad-bg); } /* a wrong pick turns red */
      .sec-2-3 .fb { border-radius: 10px; padding: 8px 12px; font-size: 15px; line-height: 1.45; background: var(--panel-2); border: 1px solid var(--line); } /* the feedback box under a question: a light grey rounded panel */
      .sec-2-3 .fb.ok { background: var(--ok-bg); border-color: color-mix(in srgb, var(--ok) 45%, transparent); } /* feedback for a correct answer: green background and border */
      .sec-2-3 .fb.bad { background: var(--bad-bg); border-color: color-mix(in srgb, var(--bad) 45%, transparent); } /* feedback for a wrong answer: red background and border */
      .sec-2-3 .scen { font-size: 16px; line-height: 1.45; min-height: 104px; } /* the scenario card in step 3: larger text and a fixed minimum height so the layout does not jump between cases */
      /* step 6 paging lab */
      .sec-2-3 .va-in { font: inherit; font-family: var(--mono); font-size: 17px; width: 116px; height: 36px; border-radius: 10px; border: 2px solid var(--line-2); padding: 0 10px; background: var(--panel); color: var(--ink); } /* the virtual-address input box in the paging lab: fixed-width digits, sized to fit a four-digit address */
      .sec-2-3 .brk { font-size: 15px; line-height: 1.5; display: flex; flex-direction: column; gap: 2px; } /* the address breakdown card: lines stacked with a little space between */
      .sec-2-3 .brk .pg { color: var(--cpu); font-weight: 800; } /* the page number in the breakdown, shown bold in the processor colour */
      .sec-2-3 .brk .of { color: var(--mem); font-weight: 800; } /* the offset in the breakdown, shown bold in the memory colour */
      .sec-2-3 .brk .res { margin-top: 4px; padding-top: 6px; border-top: 1px dashed var(--line-2); font-weight: 650; } /* the result line of the breakdown, set off by a dashed line above it */
      /* step 7 security goals board */
      .sec-2-3 .goal { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 10px; align-items: start; padding: 8px 12px; } /* a security goal card: a badge column beside the text */
      .sec-2-3 .goal .k { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-weight: 900; font-size: 13px; background: var(--os-bg); color: var(--os); } /* the goal card's badge: a small rounded square in the OS colour */
      .sec-2-3 .goal b { display: block; font-size: 15.5px; } /* the goal card's name in bold on its own line */
      .sec-2-3 .goal span.d { display: block; font-size: 14px; color: var(--ink-2); line-height: 1.35; } /* the goal card's description under the name in a softer colour */
      .sec-2-3 .gcol { display: flex; flex-direction: column; gap: 5px; padding: 8px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; color: var(--ink); min-height: 206px; } /* a goal column in step 7: a clickable box that collects the incidents the student files under it */
      .sec-2-3 .gcol:hover, .sec-2-3 .gcol:focus-visible { border-color: var(--os); outline: none; } /* hovering or keyboard-focusing a goal column outlines it in the OS colour */
      .sec-2-3 .gcol.done { cursor: default; } /* once every incident is filed, the columns stop showing a hand pointer */
      .sec-2-3 .gcol.done:hover { border-color: var(--line); } /* and stop lighting up on hover */
      .sec-2-3 .gcol .gn { font-weight: 800; font-size: 14.5px; color: var(--os); } /* the goal's name at the top of its column, bold in the OS colour */
      .sec-2-3 .gcol .gh { font-size: 12.5px; color: var(--muted); margin-bottom: 2px; } /* the one-line hint under the goal name, small and grey */
      .sec-2-3 .gchip { display: block; font-size: 13px; font-weight: 700; padding: 3px 7px; border-radius: 7px; border: 1.5px solid; line-height: 1.3; } /* a filed incident inside a column: a small bordered label */
      .sec-2-3 .gchip.ok { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); } /* an incident filed under the right goal: green label */
      .sec-2-3 .gchip.bad { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); } /* an incident filed under the wrong goal: red label */
      /* step 8 scheduling queues */
      .sec-2-3 .osrow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; } /* the row of four OS handler labels above the step 8 diagram, in four equal columns */
      .sec-2-3 .osrow span { text-align: center; font-size: 13px; font-weight: 700; padding: 5px 4px; border-radius: 8px; border: 1.5px solid color-mix(in srgb, var(--os) 35%, transparent); color: var(--ink-2); background: var(--panel); transition: background .2s, color .2s; line-height: 1.25; } /* each handler label: small centred text in a faint OS-coloured border; colour changes fade smoothly */
      .sec-2-3 .osrow span.on { background: var(--os); border-color: var(--os); color: var(--accent-ink); } /* the handler currently working is filled solid in the OS colour so the student sees which part of the OS is active */
      .sec-2-3 .ctl h4 { margin: 0 0 4px; } /* the small headings over each group of event buttons in step 8 */
      .sec-2-3 .hub-key { margin-top: auto; padding-top: 8px; border-top: 1px dashed var(--line-2); color: var(--ink-2); line-height: 1.4; } /* the "Key idea" line at the bottom of the step 1 demo card, pushed to the bottom and set off by a dashed line */
    `,  // end of the css text block

    steps: [  // steps: the list of pages in this section, in the order the student sees them
      /* ---------------- 1. Big picture: the four achievements hub ---------------- */
      {  // step 1 starts: the hub of four demos
        title: 'Four ideas every modern operating system is built on',  // step 1 title shown at the top of the page
        kind: 'story',  // kind: 'story' labels this step as a guided story in the step's small heading
        render(el, ctx) {  // render(el, ctx): builds step 1 when the student arrives; el is the page area, ctx holds the guide's helpers
          const { h, s } = ctx;  // h makes ordinary page elements and s makes SVG shapes; both come from the guide
          let cur = 0, mode = 'without', player = null;  // cur is the open demo (0-3), mode is "without" or "with", and player is the current frame player
          const tiles = HUB.map((d, k) => h('button', { class: 'hub-tile', type: 'button', style: { '--c': `var(--${d.col})` }, onclick: () => { cur = k; build(); } },  // makes one clickable tile per demo, coloured with its theme colour; clicking a tile opens that demo
            h('span', { class: 'n' }, 'Idea ' + (k + 1)), h('b', {}, d.name), h('span', { class: 'sv' }, d.solves)));  // each tile shows "Idea N", the demo name and its one-line summary
          const head = h('div', { class: 'row', style: { justifyContent: 'space-between' } });  // head is the row above the demo that holds its title and a chip naming the steps that cover it
          const seg = ctx.ui.seg([{ value: 'without', label: 'Without it' }, { value: 'with', label: 'With it' }], mode, (v) => { mode = v; build(); });  // the "Without it / With it" switch; flipping it rebuilds the demo in the other mode
          const svg = s('svg', { viewBox: '0 0 600 232', width: '100%', role: 'img', 'aria-label': 'Mini demonstration' });  // the drawing area for the demo frames, 600 by 232 units, scaled to the card width
          const slot = h('div');  // slot holds the player's controls and caption
          const KEY = [  // KEY: the key idea for each demo, shown under the drawing
            'A <b>process</b> is a program plus its data plus a saved record of exactly where it is, so the OS can pause and resume it at will.',  // key idea for the process demo
            'The OS gives each process its own region of memory and has the hardware check every address the process uses.',  // key idea for the memory management demo
            'The OS checks every request against who is asking and what that user or program is allowed to do.',  // key idea for the security demo
            'The OS keeps queues of waiting processes and uses interrupts and time slices to decide who runs next.',  // key idea for the scheduling demo
          ];  // closes the KEY list
          const keyEl = h('div', { class: 'small hub-key' });  // keyEl is the "Key idea" line at the bottom of the demo card
          function build() {  // build(): redraws the right-hand card whenever the student picks a tile or flips the switch
            const d = HUB[cur];  // d is the demo currently chosen
            keyEl.innerHTML = '<b>Key idea:</b> ' + KEY[cur];  // writes the chosen demo's key idea into the bottom line
            head.innerHTML = `<h3 class="m0">${d.name}</h3><span class="chip ${d.col}">explored in ${d.where.toLowerCase()}</span>`;  // writes the demo's title and a coloured chip saying which steps explore it
            tiles.forEach((t, j) => t.classList.toggle('on', j === cur));  // highlights the chosen tile and un-highlights the others
            if (player) player.stop();  // stops the old player so its timer does not keep running after the rebuild
            player = ctx.ui.player({ count: 4, speed: false, interval: 2600, render: (i) => { const [nodes, cap] = d.draw(mode === 'with', i); svg.replaceChildren(...nodes); return cap; } });  // makes a 4-frame player; each frame calls the demo's draw(), puts the shapes in the SVG and shows the caption
            slot.replaceChildren(player.el);  // puts the new player's controls into the slot, replacing the old ones
          }  // ends build()
          const left = h('div', { class: 'stack' },  // left: the column with the introduction, the four tiles and the analogy
            h('p', { class: 'lead m0', html: 'Juggling many programs and users at once (section 2.2) forced <b>four major achievements</b> in OS design. Pick one to see what goes wrong without it.' }),  // introduction paragraph: why the four achievements were needed
            h('div', { class: 'hub-grid' }, tiles),  // the grid holding the four demo tiles
            h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A hospital runs on the same four ideas: a chart saying where each patient\'s treatment stands (<b>process</b>), a bed per patient (<b>memory</b>), locked records and ID badges (<b>security</b>), and triage deciding who is seen next (<b>scheduling</b>).' }));  // analogy box: a hospital runs on the same four ideas
          const right = h('div', { class: 'card white stack demo-card' }, head,  // right: the demo card with its title row, switch, drawing, player and key idea
            h('div', { class: 'row' }, seg, h('span', { class: 'small muted' }, 'Play the story, then flip the switch and play it again.')),  // the switch and a short instruction to play the story, flip, and play again
            fitWide(ctx, svg, 520), slot, keyEl);  // the drawing (scrollable on a phone), the player and the key idea line
          el.append(h('div', { class: 'split l fill' }, left, right));  // puts the two columns side by side on the page
          build();  // draws the first demo straight away so the card is not empty
        },  // ends render() for step 1
      },  // ends step 1
      /* ---------------- 2. Four definitions of a process, one anatomy diagram ---------------- */
      {  // step 2 starts: four definitions of a process and one diagram
        title: 'What exactly is a process? Four ways to say it',  // step 2 title shown at the top of the page
        kind: 'explore',  // kind: 'explore' marks this as a step where the student clicks to explore
        render(el, ctx) {  // render(el, ctx): builds step 2 when the student arrives
          const { h, s } = ctx;  // takes the page-element and SVG builders from the guide
          const G = {};                                  // highlight groups of the diagram
          const g = (key, ...kids) => (G[key] = s('g', { class: 'g' }, ...kids));  // g(key, kids): groups shapes under one name and remembers the group in G so it can be dimmed or highlighted later
          const part = (x, y, hh, a, b, bcls) => [R(x, y, 160, hh, 's-panel', { rx: 6 }), T(x + 80, y + (b ? hh / 2 - 1 : hh / 2 + 5), a, { fs: 13.5, fw: 700 }), b ? T(x + 80, y + hh / 2 + 16, b, { fs: 12.5, cls: bcls || 's-sub' }) : null];  // part(): draws one labelled compartment inside a process box, with an optional second line of small text
          const proc = (n, x, file, ctxTxt, res) => [  // proc(n, x, file, ctxTxt, res): draws process n at x with its code, data file, saved context, resources and thread
            g('p' + n, R(x, 120, 294, 172, 's-proc'), T(x + 12, 142, 'Process ' + n, { a: 'start', fw: 800 })),  // the outer process box and its "Process n" heading, remembered as group pN
            g('code' + n, R(x + 12, 150, 160, 38, 's-panel', { rx: 6 }), T(x + 92, 166, 'program code', { fs: 13.5, fw: 700 })),  // the program code compartment, remembered as group codeN
            g('data' + n, ...part(x + 12, 194, 32, 'data: ' + file, null)),  // the data compartment, naming the file this process is working on; remembered as group dataN
            g('ctx' + n, ...part(x + 12, 232, 52, 'context', ctxTxt, 's-monot')),  // the context compartment with the saved PC and register values in a fixed-width font; group ctxN
            g('res' + n, T(x + 234, 162, 'resources', { fs: 12.5, cls: 's-sub' }),  // the resources column, headed "resources"; group resN
              ...res.map((r, k) => [R(x + 186, 170 + k * 38, 96, 30, 's-mem', { rx: 7 }), T(x + 234, 190 + k * 38, r, { fs: 12.5, fw: 700 })])),  // one small green box per resource the process holds (its memory and its open file)
            g('thread' + n, LN(x + 30, 179, x + 154, 179, 'thread', { w: 2.5 }))];  // a line across the code compartment standing for the thread, the path the PC walks; group threadN, ends proc()
          const svg = s('svg', { viewBox: '0 0 640 314', width: '100%', role: 'img', 'aria-label': 'Anatomy of two processes' },  // the step 2 drawing, 640 by 314 units, labelled for screen readers as the anatomy of two processes
            s('g', { transform: 'translate(0,14)' }, R(8, 94, 624, 204, 's-mem', { rx: 14, 'stroke-width': 1.5 }), T(22, 112, 'Main memory', { a: 'start', fs: 13, fw: 800, st: 'fill:var(--mem)' }),  // shifts the memory part down 14 units; a big green box labelled "Main memory" holds both processes
              ...proc(1, 18, 'notes.txt', 'PC 212 · R1 7', ['memory', 'notes.txt']),  // process 1: working on notes.txt, stopped at PC 212, holding memory and notes.txt
              ...proc(2, 326, 'todo.txt', 'PC 48 · R1 0', ['memory', 'todo.txt'])),  // process 2: the same program working on todo.txt, stopped at PC 48
            g('cpu', R(14, 8, 290, 58, 's-cpu'), T(28, 32, 'Processor', { a: 'start', fw: 800 }), T(28, 54, 'running Process 1 · PC = 212', { a: 'start', fs: 13.5, cls: 's-monot' })),  // the processor box at the top left, currently running process 1; group cpu
            g('disk', R(336, 8, 290, 58, 's-io'), T(350, 32, 'Disk', { a: 'start', fw: 800 }), T(350, 54, 'program file "editor": just instructions', { a: 'start', fs: 13 })),  // the disk box at the top right holding the program file, which is only instructions; group disk
            g('run', LN(160, 68, 160, 130, 'cpu'), T(168, 96, 'runs', { a: 'start', fs: 13, fw: 700, st: 'fill:var(--cpu)' })),  // an arrow from the processor down into process 1 labelled "runs"; group run
            g('load', LN(350, 68, 296, 130, 'io'), LN(480, 68, 480, 130, 'io'), T(422, 96, 'load', { fs: 13, fw: 700, st: 'fill:var(--io)' })));  // two arrows from the disk into the two processes labelled "load"; group load; ends the drawing
          const DEFS = [  // DEFS: the four definitions of a process; on lists the diagram groups each one keeps lit
            { q: 'A program in execution.', on: ['cpu', 'run', 'disk', 'load', 'p1', 'code1', 'data1', 'ctx1'],  // definition 1: a program in execution; lights the processor, the disk and process 1
              t: 'Alive, not just stored', x: 'A <b>program</b> is a passive file of instructions on disk. It becomes a <span class="t">process</span> when the OS loads it into memory and the processor starts carrying out its instructions. The recipe is not the cooking.' },  // its title and explanation: a stored program only becomes a process once it is loaded and running
            { q: 'An instance of a program running on a computer.', on: ['disk', 'load', 'p1', 'code1', 'data1', 'ctx1', 'p2', 'code2', 'data2', 'ctx2'],  // definition 2: an instance of a running program; lights both processes and the disk
              t: 'One program, many copies', x: 'One program can run several times at once. Two windows of the same editor are two processes: same code, but each has its own data (notes.txt vs todo.txt) and its own place in the code (PC 212 vs PC 48).' },  // its title and explanation: two copies of one editor share code but have their own data and PC
            { q: 'The entity that can be assigned to and executed on a processor.', on: ['cpu', 'run', 'p1', 'ctx1'],  // definition 3: the thing a processor can be assigned to; lights the processor and process 1's context
              t: 'What the scheduler sees', x: 'To the part of the OS that shares out the processor, a process is simply the thing it can hand the processor to. It picks one process, loads that process\'s saved context into the registers and lets it run.' },  // its title and explanation: how the part of the OS that shares out the processor sees a process
            { q: 'A unit of activity with a single sequential thread of execution, a current state and an associated set of system resources.', on: ['p1', 'code1', 'thread1', 'ctx1', 'res1'],  // definition 4: a thread of execution, a current state and a set of resources; lights process 1's parts
              t: 'The ingredients', x: 'One <b style="color:var(--thread)">thread of execution</b>: the path the PC walks through the code, one instruction after another (section 2.4 allows several per process). A <b>current state</b>: the <span class="t" data-t="execution context">context</span> (PC, registers, status). A set of <b style="color:var(--mem)">resources</b>: memory, open files, devices.' },  // its title and explanation: names the three ingredients and colours each one to match the diagram
          ];  // closes the DEFS list
          const title = h('h3', { class: 'm0' });  // title: heading above the explanation, filled in when a definition is picked
          const expl = h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.45' } });  // expl: the paragraph that explains the chosen definition
          const btns = DEFS.map((d, k) => h('button', { class: 'defbtn', type: 'button', onclick: () => pick(k) }, h('span', { class: 'k' }, String(k + 1)), h('span', { html: '“' + d.q + '”' })));  // one numbered button per definition, showing the definition in quotation marks; clicking one calls pick()
          function pick(k) {  // pick(k): shows definition k: highlights its button, dims unrelated diagram parts and writes its explanation
            btns.forEach((b, j) => b.classList.toggle('on', j === k));  // marks button k as chosen and clears the others
            Object.entries(G).forEach(([key, node]) => node.classList.toggle('dim', !DEFS[k].on.includes(key)));  // dims every diagram group that is not in this definition's on list
            title.innerHTML = `<span class="chip proc">Definition ${k + 1}</span> ${DEFS[k].t}`;  // writes a "Definition N" chip and the definition's title into the heading
            expl.innerHTML = DEFS[k].x;  // writes the definition's explanation under the heading
          }  // ends pick()
          el.append(h('div', { class: 'split l fill' },  // lays step 2 out as two columns side by side
            h('div', { class: 'stack' },  // left column: the instructions, the four buttons and the analogy
              h('p', { class: 'm0', html: 'Ask four experts to define a <span class="t">process</span> and you may hear four different sentences. They all describe the same thing from different angles. <b>Click each one.</b>' }),  // instruction paragraph: four experts, four sentences, one idea; click each one
              h('div', { class: 'stack gap-s' }, btns),  // the stack of four definition buttons
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A recipe in a cookbook is a <b>program</b>. A cook working through it is a <b>process</b>: they know which step they are on, have ingredients out and are using the oven. Two cooks making the same recipe are two processes.' })),  // analogy box: a recipe is a program, a cook working through it is a process
            h('div', { class: 'card white stack', style: { gap: '10px' } }, fitWide(ctx, svg, 560), title, expl,  // right column: the drawing, then the heading and explanation of the chosen definition
              h('p', { class: 'small muted', style: { margin: 'auto 0 0' }, html: 'Every process has the same three parts: <b>program code</b>, <b>data</b> and an <b>execution context</b>. Step 4 shows where the OS keeps them.' }))));  // footnote naming the three parts of every process and pointing ahead to step 4; closes both columns
          pick(0);  // shows definition 1 straight away so the right column is filled in
        },  // ends render() for step 2
      },  // ends step 2
      /* ---------------- 3. Why processes were needed: three pressures, four kinds of bugs ---------------- */
      {  // step 3 starts: a game where the student names the kind of bug in each story
        title: 'Why the process idea was needed: name that bug',  // step 3 title shown at the top of the page
        kind: 'lab',  // kind: 'lab' labels this step as a hands-on lab
        render(el, ctx) {  // render(el, ctx): builds step 3 when the student arrives
          const { h } = ctx;  // takes the page-element builder from the guide
          const FAM = [  // FAM: the four families of error that appeared before the process idea, as [name, description]
            ['Improper synchronization', 'A program waits for a signal from another activity, and the signal is lost, sent twice, or not waited for.'],  // family 0: improper synchronization, a signal lost, sent twice or not waited for
            ['Failed mutual exclusion', 'Two programs use the same shared resource at the same time when only one at a time should.'],  // family 1: failed mutual exclusion, two programs inside one shared resource at once
            ['Nondeterminate program operation', 'Results change from run to run because they depend on how programs happen to interleave.'],  // family 2: nondeterminate operation, results that depend on timing
            ['Deadlock', 'Programs each hold something and wait for what another holds, so none can ever go on.'],  // family 3: deadlock, programs each waiting for what another holds
          ];  // closes FAM
          const CASES = [  // CASES: eight short stories; a is the index of the right family, hint helps after a wrong pick, why explains
            { a: 1, x: 'Two booking clerks\' programs both read <i>seat 14C: free</i> at the same moment. Each marks the seat sold, and two passengers are given the same seat.',  // case 1: two booking clerks sell the same seat (answer: mutual exclusion)
              hint: 'Were two programs inside the same shared record at once?', why: 'Reading and updating the seat record must be done by one program at a time. Both got in together, so this is failed <b>mutual exclusion</b>.' },  // hint and explanation for the double-booked seat
            { a: 3, x: 'Program A has the disk and is waiting for the printer. Program B has the printer and is waiting for the disk. Neither ever finishes.',  // case 2: two programs each hold the device the other waits for (answer: deadlock)
              hint: 'Is anyone stuck waiting for something another program is holding?', why: 'Each holds what the other needs and waits for it forever: a <b>deadlock</b>.' },  // hint and explanation for the disk and printer standoff
            { a: 0, x: 'A program asks for a block to be read from disk and is meant to sleep until the disk signals <i>done</i>. That signal is lost, so the program sleeps forever.',  // case 3: a lost "done" signal leaves a program asleep forever (answer: synchronization)
              hint: 'Nobody is holding anything here. What went wrong with the wake-up signal?', why: 'The program was right to wait for an event, but the signal that should have woken it went missing: improper <b>synchronization</b>.' },  // hint and explanation for the lost wake-up signal
            { a: 2, x: 'A payroll program gives different totals on Monday and Tuesday for exactly the same input. On Tuesday another program changed a shared memory area at a different moment.',  // case 4: payroll totals change from day to day with the same input (answer: nondeterminate)
              hint: 'Same input, different output. What decided the result?', why: 'The result depended on how the programs happened to interleave, not on the input: <b>nondeterminate</b> operation.' },  // hint and explanation for the changing payroll totals
            { a: 0, x: 'A program starts working on a buffer before the disk has finished filling it, so it computes with half-old, half-new data.',  // case 5: a program uses a buffer before the disk finished filling it (answer: synchronization)
              hint: 'Should the program have waited for some event first?', why: 'It had to wait for the disk\'s <i>buffer full</i> signal before starting. The two activities were not <b>synchronized</b>.' },  // hint and explanation for the half-filled buffer
            { a: 1, x: 'Two users edit the same shared file at once. Each saves their own version, and the second save silently wipes out the first user\'s changes.',  // case 6: two users save the same file and one set of changes is lost (answer: mutual exclusion)
              hint: 'Should the updates have happened one at a time?', why: 'Updating the file needed one writer at a time. With both inside at once, one update was lost: failed <b>mutual exclusion</b>.' },  // hint and explanation for the lost file update
            { a: 2, x: 'A bug shows up about once in a thousand runs, and it vanishes whenever a programmer adds print statements to hunt for it.',  // case 7: a rare bug that vanishes when print statements are added (answer: nondeterminate)
              hint: 'What changes when you add print statements? The timing.', why: 'Print statements change the timing, and this bug depends on timing: <b>nondeterminate</b> operation. Such bugs are notoriously hard to reproduce.' },  // hint and explanation for the timing-dependent bug
            { a: 3, x: 'Two bank transfers run at once. One locks account X and waits to lock account Y. The other has already locked Y and waits for X. Both hang forever.',  // case 8: two bank transfers each lock one account and wait for the other (answer: deadlock)
              hint: 'Two programs, each holding one thing and waiting for the other\'s.', why: 'A circular wait on locks that will never be released: a <b>deadlock</b>.' },  // hint and explanation for the circular wait on locks
          ];  // closes CASES
          let k = 0, first = 0, tried = false;  // k is the current case, first counts right answers on the first try, tried notes a wrong pick on this case
          const prog = h('span', { class: 'chip' });  // prog: chip showing which case the student is on
          const score = h('span', { class: 'chip ok' });  // score: green chip showing the first-try score
          const scen = h('div', { class: 'card tight scen' });  // scen: the card that shows the current story
          const fb = h('div', { class: 'fb' });  // fb: the feedback box under the answer buttons
          const next = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { k++; show(); } });  // next: the button that moves to the next case; disabled until the right answer is found
          const opts = FAM.map(([n, d], j) => h('button', { class: 'opt', type: 'button', onclick: () => choose(j) }, h('b', {}, n), h('span', {}, d)));  // one answer button per family, with its name and description; clicking calls choose()
          const optGrid = h('div', { class: 'grid-2', style: { gap: '8px' } }, opts);  // lays the four answer buttons out in a two-column grid
          function show() {  // show(): displays the current case, or the final score after the last one
            if (k >= CASES.length) {  // after the last case, show the result instead of a story
              scen.innerHTML = `<div class="big" style="color:var(--ok)">${first} / ${CASES.length}</div><div>correct on the first try. All four families come from the same root: several activities sharing one processor and shared data, switched at unpredictable moments, with no clean way to describe each one.</div>`;  // final card: the first-try score and the common root of all four kinds of bugs
              opts.forEach((o) => { o.disabled = true; o.classList.remove('right', 'wrong'); });  // turns every answer button off and clears its colour
              fb.className = 'fb'; fb.innerHTML = 'The fix was the <b>process</b>: a tidy package the OS can pause, resume, protect and coordinate. Chapter 5 returns to mutual exclusion and synchronization in depth.';  // closing feedback: the process was the fix, and chapter 5 returns to these problems
              prog.textContent = 'Done'; score.textContent = `Score ${first}`;  // the chips now read "Done" and the final score
              next.textContent = 'Play again'; next.onclick = () => { k = 0; first = 0; next.onclick = () => { k++; show(); }; show(); };  // turns the Next button into "Play again", which restarts at case 1 and restores its normal action
              next.disabled = false; return;  // enables the button and stops here
            }  // ends the end-of-game branch
            tried = false;  // a new case starts with no wrong picks yet
            prog.textContent = `Case ${k + 1} of ${CASES.length}`; score.textContent = `First-try score ${first}`;  // updates the progress chip and the running first-try score
            scen.innerHTML = CASES[k].x;  // puts the story of the current case into the scenario card
            opts.forEach((o) => { o.disabled = false; o.classList.remove('right', 'wrong'); });  // re-enables all answer buttons and clears last case's colours
            fb.className = 'fb'; fb.innerHTML = '<span class="muted">Which family of error is this? Pick one.</span>';  // resets the feedback box to the prompt asking which family this is
            next.textContent = k === CASES.length - 1 ? 'See result' : 'Next case →'; next.disabled = true;  // labels the Next button ("See result" on the last case) and disables it until the student is right
          }  // ends show()
          function choose(j) {  // choose(j): runs when the student clicks answer j
            const c = CASES[k];  // c is the current case
            if (j === c.a) {  // the student picked the right family
              if (!tried) first++;  // counts it toward the score only if there was no wrong pick first
              opts[j].classList.add('right'); opts.forEach((o) => (o.disabled = true));  // marks the clicked answer green and locks all the buttons so the case is finished
              fb.className = 'fb ok'; fb.innerHTML = '<b>✓ ' + FAM[j][0] + '.</b> ' + c.why;  // turns the feedback box green, names the family and explains why it fits
              score.textContent = `First-try score ${first}`; next.disabled = false;  // updates the score chip and enables the Next button
            } else {  // otherwise the pick was wrong
              tried = true; opts[j].classList.add('wrong'); opts[j].disabled = true;  // remembers the miss for scoring, marks the button red and disables it so it cannot be picked again
              fb.className = 'fb bad'; fb.innerHTML = '<b>✗ Not ' + FAM[j][0].toLowerCase() + '.</b> Hint: ' + c.hint;  // turns the feedback box red, says which family it is not and shows the case's hint
            }  // ends the right/wrong branches
          }  // ends choose()
          el.append(h('div', { class: 'split l fill' },  // lays step 3 out as two columns side by side
            h('div', { class: 'stack' },  // left column: the background story and the list of three kinds of systems
              h('p', { class: 'm0', html: 'In the 1960s three kinds of system all had to switch one processor among many activities, at moments chosen by <span class="t">interrupts</span> rather than by the programs themselves:' }),  // intro paragraph: in the 1960s three kinds of system switched one processor at moments set by interrupts
              ...[['1', 'Multiprogrammed batch', 'Keep the processor and I/O devices busy: when one job waits for I/O, switch to another.'],  // system 1: multiprogrammed batch, which switches jobs while one waits for I/O
                ['2', 'Time sharing', 'Answer many interactive users quickly by giving each a short turn in rotation.'],  // system 2: time sharing, which gives many interactive users short turns
                ['3', 'Real-time transaction systems', 'Many users query and update one shared database, such as airline seats, and expect answers within seconds.']]  // system 3: real-time transaction systems sharing one database, such as airline seats
                .map(([n, t, d]) => h('div', { class: 'card dev' }, h('span', { class: 'k' }, n), h('div', {}, h('b', {}, t), h('span', {}, d)))),  // turns each of the three into a numbered row with a badge, a bold name and a description
              h('div', { class: 'callout why m0', 'data-label': 'The trouble', html: 'Switching code written case by case, with no clean model of a half-finished program, bred timing bugs that are hard to reproduce. They fall into <b>four families</b>, from failed <span class="t">mutual exclusion</span> to <span class="t">deadlock</span>. Sort the cases on the right.' })),  // "The trouble" box: case-by-case switching code bred timing bugs in four families; sort the cases
            h('div', { class: 'card white stack', style: { gap: '10px' } },  // right column: the game card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Name that bug'), h('div', { class: 'row' }, prog, score)),  // game header: the "Name that bug" title with the progress and score chips
              scen, optGrid, fb, h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: 'auto' } }, next))));  // the story card, the four answer buttons, the feedback box and the Next button at the bottom; closes both columns
          show();  // shows the first case straight away
        },  // ends render() for step 3
      },  // ends step 3
      /* ---------------- 4. Process list, base/limit registers, context switching ---------------- */
      {  // step 4 starts: the process list, base and limit registers, and a context switch you can trigger
        title: 'Inside the OS: the process list and a context switch',  // step 4 title shown at the top of the page
        kind: 'lab',  // kind: 'lab' labels this step as a hands-on lab
        core: true, // on the shorter core path
        render(el, ctx) {  // render(el, ctx): builds step 4 when the student arrives
          const { h, s } = ctx;  // takes the page-element and SVG builders from the guide
          const CODE = [['+5', '+5', '+5', '+5', '+5', 'jmp 0'], ['+100', '+100', '+100', '+100', '+100', 'jmp 0']];  // CODE: the tiny programs of A and B; A adds 5 five times, B adds 100 five times, then each jumps back to 0
          let st, busy = false, gen = 0;                   // gen: bumped by Reset so a switch in progress stops
          const fresh = () => ({ regs: { idx: 0, pc: 0, base: 2000, limit: 600, r1: 0 }, hl: [], check: null, badBlock: false,  // fresh(): the starting state: A running with base 2000 and limit 600, B ready at base 4000 with limit 400
            rows: [{ n: 'A', base: 2000, limit: 600, pc: 0, r1: 0, inc: 5, state: 'running' }, { n: 'B', base: 4000, limit: 400, pc: 0, r1: 0, inc: 100, state: 'ready' }] });  // rows: the two process list entries, each with its region, saved PC and R1, step size and state
          const svg = s('svg', { viewBox: '0 0 660 400', width: '100%', role: 'img', 'aria-label': 'Processor registers and main memory with the process list' });  // the drawing for step 4, 660 by 400 units: registers on the left, main memory on the right
          const logEl = h('div', { class: 'log grow' });  // logEl: the running log under the drawing where each action is described
          const log = (html) => { logEl.append(h('div', { html })); logEl.scrollTop = logEl.scrollHeight; };  // log(html): adds one line to the log and scrolls it so the newest line is visible
          function draw() {  // draw(): redraws the whole diagram from the current state st; called after every action
            const r = st.regs, HL = new Set(st.hl);  // r is the register set; HL is the set of parts to highlight this time
            const hlr = (x, y, w, hh) => R(x, y, w, hh, '', { rx: 6, style: 'fill:var(--hl);stroke:none', opacity: 0.8 });  // hlr(): draws a yellow highlight rectangle behind a part that just changed
            const n = [R(8, 8, 226, 262, 's-cpu'), T(20, 34, 'Processor registers', { a: 'start', fw: 800 })];  // n starts with the processor box and its "Processor registers" heading
            if (HL.has('regs')) n.push(hlr(14, 50, 214, 204));  // if the registers just changed, highlight the whole register panel
            [['Process index', r.idx], ['PC', r.pc], ['Base', r.base], ['Limit', r.limit], ['R1', r.r1]].forEach(([nm, v], k) => {  // draws the five registers: process index, PC, base, limit and R1, one per row
              const y = 50 + k * 40;  // each register row sits 40 units below the previous one
              n.push(T(20, y + 24, nm, { a: 'start', fs: 14.5, fw: 700 }), R(146, y + 4, 80, 30, 's-panel', { rx: 6 }), T(186, y + 25, String(v), { fs: 15, fw: 800, cls: 's-monot' }));  // the register's name on the left and its current value in a box on the right
            });  // ends the register rows
            n.push(R(8, 282, 226, 110, 's-panel'), T(20, 306, 'Hardware address check', { a: 'start', fs: 13.5, fw: 800 }));  // a panel under the registers for the hardware address check
            const c = st.check || { ok: true, a: 'every address < limit?', b: 'real = base + address', c: 'done on every access' };  // c is the last check to show, or a general reminder of the rule before any instruction has run
            n.push(T(20, 334, c.a, { a: 'start', fs: 14, fw: 700, cls: 's-monot', st: st.check ? (c.ok ? OK : BAD) : null }),  // first line of the check: the address compared with the limit, green if it passed and red if it failed
              T(20, 360, c.b, { a: 'start', fs: 13.5, cls: 's-monot' }), T(20, 382, c.c, { a: 'start', fs: 13, cls: 's-sub' }));  // second line: how the real address is formed from the base, and a note on when the check happens
            n.push(R(248, 8, 404, 384, 's-mem', { rx: 12 }), T(262, 30, 'Main memory', { a: 'start', fw: 800, st: 'fill:var(--mem)' }),  // the big main memory box on the right with its heading
              R(260, 40, 380, 126, 's-os', { rx: 8 }), T(272, 62, 'OS region: the process list', { a: 'start', fs: 14, fw: 800, st: 'fill:var(--os)' }));  // the OS region at the top of memory, which holds the process list
            const COL = [282, 320, 370, 422, 478, 532, 596];  // COL: the x positions of the seven columns of the process list table
            ['idx', 'proc', 'base', 'limit', 'PC', 'R1', 'state'].forEach((t, j) => n.push(T(COL[j], 86, t, { fs: 12.5, fw: 700, cls: 's-sub' })));  // writes the column headings: idx, proc, base, limit, PC, R1, state
            st.rows.forEach((w, i) => {  // draws one row of the process list for each process
              const y = 94 + i * 34, live = w.state === 'running';  // rows sit 34 units apart; live is true for the process currently running
              n.push(R(266, y, 368, 28, 's-panel', { rx: 6, 'stroke-width': 1 }));  // the row's background strip
              if (HL.has('row' + i)) n.push(hlr(266, y, 368, 28));  // highlights the row if the OS is reading or writing this entry right now
              [i, w.n, w.base, w.limit, live ? 'in CPU' : w.pc, live ? 'in CPU' : w.r1, w.state[0].toUpperCase() + w.state.slice(1)].forEach((v, j) => n.push(T(COL[j], y + 19, String(v),  // the row's values; a running process's PC and R1 show "in CPU", because the live values are in the registers
                { fs: live && (j === 4 || j === 5) ? 12.5 : 13.5, fw: j === 1 || j === 6 ? 800 : 650, cls: live && (j === 4 || j === 5) ? 's-sub' : (j >= 2 && j <= 5 ? 's-monot' : null), st: j === 6 && live ? 'fill:var(--ok)' : null })));  // sizes and styles each value: fixed-width digits for numbers, bold name and state, green "Running"
            });  // ends the process list rows
            st.rows.forEach((w, i) => {  // draws each process's own region of memory below the OS region
              const y = 178 + i * 108, on = r.idx === i && w.state === 'running';  // each region sits 108 units below the previous; on is true for the process the processor is running
              const edge = on && st.badBlock ? { 'stroke-width': 3.5, style: 'stroke:var(--bad)' } : { 'stroke-width': on ? 3.5 : 1.5 };  // edge: a thick outline for the running process, turned red if it just tried to reach outside its region
              n.push(R(260, y, 380, 98, 's-proc', Object.assign({ rx: 8 }, edge)), T(272, y + 22, `Process ${w.n}: program + data`, { a: 'start', fs: 14, fw: 800 }),  // the region box with its "Process A: program + data" heading
                T(628, y + 22, `starts at ${w.base}, size ${w.limit}`, { a: 'end', fs: 12.5, cls: 's-sub' }));  // the region's start address (base) and size (limit) at its top right
              const at = on ? r.pc : w.pc;  // at is the instruction to mark: the live PC for the running process, the saved PC for the paused one
              CODE[i].forEach((code, j) => {  // draws the six instructions of this process's code
                const x = 272 + j * 48, cur = j === at;  // each instruction box is 48 units to the right of the previous; cur marks the one at the PC
                n.push(R(x, y + 34, 44, 34, cur ? (on ? 's-cpu' : 's-panel') : 's-panel', { rx: 5, 'stroke-width': cur ? 3 : 1.2, 'stroke-dasharray': cur && !on ? '5 3' : null }),  // the instruction box: blue and bold if it is next for the running process, dashed if it is where a paused one stopped
                  T(x + 22, y + 56, code, { fs: 13, fw: 700, cls: 's-monot' }),  // the instruction text, such as +5 or jmp 0
                  T(x + 22, y + 86, cur ? '▲ ' + j : String(j), { fs: cur ? 13 : 12.5, fw: cur ? 800 : 600, cls: cur ? null : 's-sub', st: cur ? (on ? 'fill:var(--cpu)' : 'fill:var(--muted)') : null }));  // the instruction number under the box, with an up-arrow under the current one
              });  // ends the instructions
              n.push(R(564, y + 34, 64, 34, 's-mem', { rx: 5 }), T(596, y + 56, 'data', { fs: 13, fw: 700 }),  // a green box for the process's data at the end of its region
                T(596, y + 86, on ? 'running' : 'paused', { fs: 12.5, fw: 700, st: on ? 'fill:var(--ok)' : null, cls: on ? null : 's-sub' }));  // under the data box: "running" in green or a grey "paused"
            });  // ends the process regions
            svg.replaceChildren(...n);  // replaces everything in the drawing with the new shapes
          }  // ends draw()
          const btns = [];  // btns keeps every control button so they can all be disabled together
          const btn = (label, cls, fn) => { const b = h('button', { class: 'btn sm ' + cls, type: 'button', onclick: () => { if (!busy) fn(); } }, label); btns.push(b); return b; };  // btn(label, cls, fn): makes a button that runs fn only when no switch is in progress, and records it in btns
          const setBusy = (v) => { busy = v; btns.forEach((b) => (b.disabled = v)); };  // setBusy(v): marks the lab busy or free and disables or enables every button to match
          function run() {  // run(): executes one instruction of the running process when the student clicks the run button
            const r = st.regs, w = st.rows[r.idx], code = CODE[r.idx][r.pc], real = r.base + r.pc;  // reads the running process's entry, the instruction at the PC and the real address base + PC
            st.check = { ok: true, a: `${r.pc} < limit ${r.limit} ✓`, b: `real = ${r.base} + ${r.pc} = ${real}`, c: `fetches "${code}" for ${w.n}` };  // records a passing check to show: PC is under the limit, the real address, and what was fetched
            st.badBlock = false; st.hl = [];  // clears any old red outline and highlights
            if (code === 'jmp 0') { r.pc = 0; log(`<b>${w.n}</b> fetches from ${real}: jump back to 0. PC = 0.`); }  // a jump sends the PC back to 0, and the log says so
            else { r.r1 += w.inc; r.pc += 1; log(`<b>${w.n}</b> fetches from ${real}: add ${w.inc}. R1 = ${r.r1}, PC = ${r.pc}.`); }  // any other instruction adds the process's step to R1 and moves the PC on by one, and the log says so
            draw();  // redraws the diagram with the new register values
          }  // ends run()
          async function sw() {  // sw(): an animated context switch; async lets it pause between stages with ctx.sleep
            setBusy(true); const g = gen, live = () => ctx.alive && g === gen;  // locks the buttons; live() is false once the step is left or Reset is pressed, so the animation stops
            const r = st.regs, cur = r.idx, nx = 1 - cur, a = st.rows[cur], b = st.rows[nx];  // cur is the running process's index and nx the other one; a and b are their process list entries
            st.check = null; st.badBlock = false;  // clears the check panel and any red outline
            a.pc = r.pc; a.r1 = r.r1; a.state = 'ready'; st.hl = ['regs', 'row' + cur]; draw();  // saves the live PC and R1 into the running process's entry, marks it ready and highlights the copy
            log(`<span style="color:var(--intr)"><b>Interrupt.</b></span> OS saves ${a.n}'s context (PC ${a.pc}, R1 ${a.r1}) in entry ${cur}.`);  // log line: an interrupt arrives and the OS saves the old process's context in its entry
            await ctx.sleep(900); if (!live()) return;  // waits 0.9 s so the student can follow, then stops if the step was left or reset
            st.hl = ['row' + nx]; draw(); log(`OS picks the next process: ${b.n} (entry ${nx}).`);  // highlights the other entry and logs that the OS picked it to run next
            await ctx.sleep(900); if (!live()) return;  // waits again, stopping if the step was left or reset
            Object.assign(r, { idx: nx, pc: b.pc, base: b.base, limit: b.limit, r1: b.r1 }); b.state = 'running'; st.hl = ['regs', 'row' + nx]; draw();  // loads the chosen process's index, PC, base, limit and R1 into the registers and marks it running
            log(`OS loads ${b.n}'s context: index ${nx}, PC ${b.pc}, base ${b.base}, limit ${b.limit}, R1 ${b.r1}. <b>${b.n} runs.</b>`);  // log line: the OS loaded the new context and the new process now runs
            await ctx.sleep(700); if (!live()) return;  // a shorter pause before finishing, stopping if the step was left or reset
            st.hl = []; draw(); setBusy(false);  // clears the highlights, redraws and unlocks the buttons; the switch is complete
          }  // ends sw()
          function bad() {  // bad(): runs when the student clicks "Bad address"; the running process tries to reach past its region
            const r = st.regs, w = st.rows[r.idx], addr = r.limit + 50;  // picks an address 50 beyond the limit so it is clearly outside the process's block
            st.check = { ok: false, a: `${addr} < limit ${r.limit}? ✗`, b: 'access blocked', c: 'interrupt: OS takes over' };  // records a failed check to show: the comparison fails, the access is blocked and the OS is interrupted
            st.badBlock = true; st.hl = []; draw();  // turns on the red outline around the running process and redraws
            log(`<span style="color:var(--bad)"><b>${w.n} tries address ${addr}</b></span>, past its limit of ${r.limit}. The hardware refuses and interrupts the OS, which would normally end ${w.n} with a bounds error. (Here it lets ${w.n} carry on.)`);  // log line: the hardware refuses the address and interrupts the OS; the lab lets the process carry on
          }  // ends bad()
          function reset() { gen++; setBusy(false); st = fresh(); logEl.replaceChildren(); log('A is running from the start of its block. B is ready and has never run.'); draw(); }  // reset(): stops any switch in progress (gen changes), unlocks the buttons, restores the start state and clears the log
          el.append(h('div', { class: 'split l fill' },  // lays step 4 out as two columns side by side
            h('div', { class: 'stack' },  // left column: the explanation, the buttons and the tips
              h('p', { class: 'm0', html: 'A process has three parts: the executable <b>program</b>, its <b>data</b>, and its <span class="t">execution context</span> (what the OS needs to pause and resume it). A typical OS stores them like this:' }),  // intro paragraph: the three parts of a process and how a typical OS stores them
              h('ul', { class: 'small m0', html: '<li>The <span class="t">process list</span> has one entry per process: where the process is in memory, plus its saved context while it is not running (some systems keep part of it with the process instead).</li><li>Each process owns a block of memory holding its program and data.</li><li><b>Process index</b> names the running entry, the <b>PC</b> counts from the start of the block, and the <span class="t">base register</span> and <span class="t">limit register</span> give the block\'s start and size.</li>' }),  // bullet list: the process list, each process's memory block, and the index, PC, base and limit registers
              h('div', { class: 'row', style: { gap: '8px' } }, btn('Run 1 instruction', 'primary', run), btn('Interrupt: switch', 'os', sw), btn('Bad address', 'intr', bad), h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset')),  // the four controls: run one instruction, trigger a context switch, try a bad address, and reset
              h('div', { class: 'callout tip m0', 'data-label': 'Try this', html: 'Run A three times, switch, run B twice, switch back. A resumes at PC 3 with R1 = 15, exactly where it stopped.' }),  // "Try this" box: a sequence that shows A resuming exactly where it stopped
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'A <b>context switch</b> never copies the program or its data: it saves and reloads only a few register values.' })),  // "Common mistake" box: a context switch saves and reloads only register values, never the program itself
            h('div', { class: 'stack' }, fitWide(ctx, svg, 600), logEl)));  // right column: the drawing (scrollable on a phone) and the log under it; closes both columns
          reset();  // puts the lab in its starting state and draws it
        },  // ends render() for step 4
      },  // ends step 4
      /* ---------------- 5. Memory management: five responsibilities, two tools ---------------- */
      {  // step 5 starts: the five memory-management jobs of an OS and which tool handles each
        title: 'Memory management: five jobs the OS must do',  // step 5 title shown at the top of the page
        kind: 'explore',  // kind: 'explore' marks this as a step where the student clicks to explore
        render(el, ctx) {  // render(el, ctx): builds step 5 when the student arrives
          const { h, s } = ctx;  // takes the page-element and SVG builders from the guide
          const frameGrid = (hot) => {  // frameGrid(hot): draws a 2-by-6 grid of memory blocks; the block numbers in hot are shown as newly given to P
            const own = { 1: 'P', 4: 'P', 9: 'P' }, os = [0, 6], other = [2, 7, 10];  // which blocks already belong to process P, to the OS, and to other programs; the rest are free
            const out = [];  // out collects the shapes of the grid
            for (let k = 0; k < 12; k++) {  // goes through the 12 blocks one at a time
              const x = 170 + (k % 6) * 74, y = 40 + Math.floor(k / 6) * 84, isNew = hot.includes(k);  // places block k in one of two rows of six; isNew is true if it is being handed to P now
              const cls = os.includes(k) ? 's-os' : other.includes(k) ? 's-panel' : own[k] || isNew ? (isNew ? 's-ok' : 's-proc') : 's-panel';  // picks the block's colour: OS, other program, P's own, newly given (green), or free
              out.push(R(x, y, 66, 72, cls, { rx: 7, 'stroke-width': isNew ? 3 : 1.5, 'stroke-dasharray': !os.includes(k) && !other.includes(k) && !own[k] && !isNew ? '4 3' : null }),  // the block itself, drawn thicker when new and dashed when free
                T(x + 33, y + 42, os.includes(k) ? 'OS' : other.includes(k) ? 'other' : own[k] ? 'P' : isNew ? '+P' : 'free', { fs: 13.5, fw: 700, cls: own[k] || isNew || os.includes(k) ? null : 's-sub' }));  // the block's label: OS, other, P, +P for a new one, or free
            }  // ends the loop over the blocks
            return out;  // hands back the grid's shapes
          };  // ends frameGrid
          const JOBS = [  // JOBS: the five memory-management responsibilities, each with an explanation, example, what goes wrong without it and a picture
            { n: 'Process isolation', tools: ['Virtual memory'],  // job 1: process isolation, handled by virtual memory
              x: 'Each process gets its own space. The OS (with hardware help) stops any process from reading or changing another process\'s instructions or data.',  // explanation: the OS, with hardware help, keeps each process out of every other process's space
              eg: 'A crashing browser tab cannot scribble over your music player\'s memory.',  // everyday example: a crashing browser tab cannot damage the music player
              wo: 'one buggy program could corrupt every other program, or the OS itself.',  // without it: one buggy program could corrupt every other program or the OS
              draw: () => [R(20, 50, 220, 130, 's-proc'), T(130, 80, 'Process A', { fw: 800 }), R(40, 96, 180, 32, 's-panel', { rx: 6 }), T(130, 117, 'code', { fs: 13.5 }), R(40, 136, 180, 32, 's-panel', { rx: 6 }), T(130, 157, 'data', { fs: 13.5 }),  // picture, left half: Process A with its code and data
                R(380, 50, 220, 130, 's-proc'), T(490, 80, 'Process B', { fw: 800 }), R(400, 96, 180, 32, 's-panel', { rx: 6 }), T(490, 117, 'code', { fs: 13.5 }), R(400, 136, 180, 32, 's-panel', { rx: 6 }), T(490, 157, 'data', { fs: 13.5 }),  // picture, right half: Process B with its code and data
                LN(310, 36, 310, 196, 'bad', { head: false, w: 6 }), PA('M222,150 C 260,150 280,150 300,150', 'intr', { dash: '6 4' }), T(310, 216, '✗ A cannot reach into B', { fs: 14.5, fw: 800, st: BAD }), T(310, 24, 'separate address spaces', { fs: 13.5, cls: 's-sub' })] },  // picture: a red wall between them, A's dashed arrow stopping at it, and the labels
            { n: 'Automatic allocation and management', tools: ['Virtual memory'],  // job 2: automatic allocation and management, handled by virtual memory
              x: 'Programs get memory as they need it and return it when done, with no programmer deciding where it physically goes. Pieces of one program can sit anywhere in memory.',  // explanation: programs get memory as they need it and pieces can sit anywhere
              eg: 'Opening another browser tab simply gets more memory; nobody picks addresses by hand.',  // everyday example: a new browser tab simply gets more memory
              wo: 'programmers would have to plan where every program sits in memory, and redo that plan whenever anything changed.',  // without it: programmers would have to plan where every program sits
              draw: () => [R(10, 70, 130, 96, 's-proc'), T(75, 104, 'Process P', { fw: 800 }), T(75, 130, '"I need 2 more', { fs: 13 }), T(75, 148, 'blocks"', { fs: 13 }),  // picture: process P asks for two more blocks
                LN(142, 118, 166, 118, 'os'), ...frameGrid([5, 8]), T(392, 222, 'New blocks (+P) come from wherever memory is free', { fs: 13.5, cls: 's-sub' })] },  // picture: an arrow into the block grid, where the two new blocks come from wherever memory is free
            { n: 'Support of modular programming', tools: ['Virtual memory'],  // job 3: support of modular programming, handled by virtual memory
              x: 'Programmers build programs from separate modules. The OS lets each module be created, removed, or grow and shrink on its own, while the program runs.',  // explanation: each module can be created, removed, grown or shrunk while the program runs
              eg: 'A word processor loads its spell-checker module only when you first use it.',  // everyday example: a word processor loads its spell checker only when first used
              wo: 'a program would have to be loaded as one fixed lump, needed parts or not.',  // without it: a program would be loaded as one fixed lump
              draw: () => [R(20, 60, 170, 110, 's-proc'), T(105, 104, 'main', { fs: 16, fw: 800, cls: 's-monot' }), T(105, 128, 'module', { fs: 13, cls: 's-sub' }),  // picture: the main module
                R(230, 60, 150, 80, 's-proc'), R(230, 140, 150, 34, 's-ok', { rx: 6, 'stroke-dasharray': '5 3' }), T(305, 96, 'math', { fs: 16, fw: 800, cls: 's-monot' }), T(305, 118, 'module', { fs: 13, cls: 's-sub' }), T(305, 162, 'grows', { fs: 13, fw: 700, st: OK }),  // picture: a math module with a green dashed extension showing that it grows
                R(420, 60, 180, 110, 's-proc', { 'stroke-dasharray': '6 4' }), T(510, 104, 'spell', { fs: 16, fw: 800, cls: 's-monot' }), T(510, 128, 'loaded on demand', { fs: 13, cls: 's-sub' }),  // picture: a dashed spell module loaded on demand
                LN(190, 100, 226, 100, 'proc'), LN(380, 100, 416, 100, 'proc'), T(310, 212, 'Each module is its own piece that can come, go or change size', { fs: 13.5, cls: 's-sub' })] },  // picture: arrows linking the modules and a note that each can come, go or change size
            { n: 'Protection and access control', tools: ['Virtual memory', 'File system'],  // job 4: protection and access control, handled by both virtual memory and the file system
              x: 'Sharing is useful (one copy of a library for every program), but the OS must control who may read, write or run each piece of memory, and each file.',  // explanation: sharing is useful, but the OS must control who may read, write or run each piece
              eg: 'Every running program shares one copy of the system library, yet none of them can change it.',  // everyday example: every program shares one copy of the system library but none can change it
              wo: 'either nothing can be shared (wasteful copies everywhere) or everything is (anyone can change anything).',  // without it: either nothing can be shared or anyone can change anything
              draw: () => [R(20, 20, 160, 70, 's-proc'), T(100, 61, 'Process A', { fw: 800 }), R(440, 20, 160, 70, 's-proc'), T(520, 61, 'Process B', { fw: 800 }),  // picture: processes A and B at the top
                R(210, 140, 200, 70, 's-mem'), T(310, 172, 'shared library', { fw: 800 }), T(310, 194, 'read + run only', { fs: 13, cls: 's-sub' }),  // picture: the shared library below, marked read and run only
                LN(120, 92, 236, 138, 'ok'), T(150, 128, 'run ✓', { fs: 13.5, fw: 800, st: OK }), LN(470, 92, 390, 138, 'ok'), T(468, 128, 'run ✓', { fs: 13.5, fw: 800, st: OK }),  // picture: green arrows showing both processes may run the library
                PA('M560,92 C 560,170 480,188 414,182', 'bad', { dash: '6 4' }), T(548, 196, 'write ✗', { fs: 13.5, fw: 800, st: BAD })] },  // picture: a red dashed arrow showing B's attempt to write to it is refused
            { n: 'Long-term storage', tools: ['File system'],  // job 5: long-term storage, handled by the file system
              x: 'Many users and programs need information kept for months or years, long after the program that made it has ended and the machine has been switched off.',  // explanation: information must last long after the program ends and the machine is switched off
              eg: 'Your essay is still there tomorrow after you shut the laptop down.',  // everyday example: your essay is still there tomorrow
              wo: 'all work would vanish whenever a program ended or the power went off.',  // without it: all work would vanish when a program ended or the power went off
              draw: () => [R(20, 40, 250, 150, 's-mem', { 'stroke-dasharray': '6 4' }), T(145, 72, 'Main memory', { fw: 800 }), T(145, 96, 'volatile', { fs: 13, cls: 's-sub' }),  // picture: main memory drawn dashed and labelled volatile
                T(145, 132, 'power off →', { fs: 14, fw: 700, st: BAD }), T(145, 156, 'contents gone', { fs: 14, fw: 700, st: BAD }),  // picture: red note that its contents are gone at power off
                R(350, 40, 250, 150, 's-io'), T(475, 72, 'Disk: file system', { fw: 800 }), ...['essay.docx', 'budget.xlsx', 'photos/'].map((f, k) => T(475, 104 + k * 24, f, { fs: 14, cls: 's-monot' })),  // picture: the disk with a file system holding three example files
                T(475, 182, '✓ still there next year', { fs: 14, fw: 800, st: OK }), LN(272, 115, 346, 115, 'io'), T(309, 106, 'save', { fs: 13, fw: 700 })] },  // picture: a green "still there next year" note and a save arrow from memory to disk
          ];  // closes the JOBS list
          const svg = s('svg', { viewBox: '0 0 620 232', width: '100%', role: 'img', 'aria-label': 'Illustration of the selected memory-management job' });  // the drawing for the chosen job, 620 by 232 units
          const title = h('div', { class: 'row', style: { justifyContent: 'space-between' } });  // title: the row holding the job's name and its tool chips
          const expl = h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.45' } });  // expl: the paragraph that explains the chosen job
          const eg = h('p', { class: 'small m0 muted' });  // eg: the everyday example line, in grey
          const wo = h('p', { class: 'small m0' });  // wo: the "Without it" line
          const btns = JOBS.map((j, k) => h('button', { class: 'defbtn', type: 'button', style: { alignItems: 'center' }, onclick: () => pick(k) }, h('span', { class: 'k', style: { background: 'var(--mem-bg)', color: 'var(--mem)' } }, String(k + 1)), h('b', { style: { fontSize: '15.5px' } }, j.n)));  // one numbered button per job with a green badge; clicking one calls pick()
          /* predict-then-reveal: the student names the tool before the chips appear */
          const TOOL = [['vm', 'Virtual memory', 'mem'], ['fs', 'File system', 'io'], ['both', 'Both', '']];  // TOOL: the three guesses the student can make: virtual memory, file system, or both, with their colours
          const WHY = { vm: 'this job concerns main memory while programs are running.', fs: 'this job is about keeping named information after programs end and the power goes off.',  // WHY: the reason shown after a guess, one for each tool
            both: 'pieces of memory and files both need rules about who may read, write or run them.' };  // reason for "both": memory pieces and files both need access rules; closes WHY
          const key = (j) => (j.tools.length > 1 ? 'both' : j.tools[0] === 'File system' ? 'fs' : 'vm');  // key(j): works out the right guess for a job from its tools list
          const guessed = {};  // guessed remembers the student's guess for each job, so each job can be guessed only once
          let cur = 0;  // cur is the job currently shown
          const gBtns = TOOL.map(([v, label, col]) => h('button', { class: 'btn sm ' + col, type: 'button', onclick: () => { if (guessed[cur] == null) { guessed[cur] = v; pick(cur); } } }, label));  // the three guess buttons; each records the first guess for the current job and redraws it
          const gfb = h('p', { class: 'small m0' });  // gfb: the line that says whether the guess was right
          function pick(k) {  // pick(k): shows job k: its button, name, tool chips, picture and text
            const j = JOBS[k], ans = key(j), g = guessed[k];  // j is the job, ans the right guess and g the student's guess so far
            cur = k;  // remembers which job is showing so the guess buttons apply to it
            btns.forEach((b, i) => { b.classList.toggle('on', i === k); b.style.borderColor = i === k ? 'var(--mem)' : ''; b.style.boxShadow = i === k ? '0 0 0 1px var(--mem)' : ''; b.style.background = i === k ? 'color-mix(in srgb, var(--mem) 10%, var(--panel))' : ''; });  // outlines and tints the chosen job button in the memory colour and clears the others
            const chips = g == null ? '<span class="chip">tool: ?</span>' : j.tools.map((t) => `<span class="chip ${t === 'File system' ? 'io' : 'mem'}">${t}</span>`).join('');  // the tool chips stay a grey "tool: ?" until the student has guessed, then show the real tools
            title.innerHTML = `<h3 class="m0">${k + 1}. ${j.n}</h3><span class="row" style="gap:6px">${chips}</span>`;  // writes the job's number, name and chips into the title row
            svg.replaceChildren(...j.draw());  // draws the job's picture into the SVG
            expl.innerHTML = j.x; eg.innerHTML = '<b>Everyday example:</b> ' + j.eg;  // writes the explanation and the everyday example
            wo.innerHTML = '<b style="color:var(--warn)">Without it:</b> ' + j.wo;  // writes the "Without it" line with its label in the warning colour
            gBtns.forEach((b, i) => { b.disabled = g != null; b.classList.toggle('on', g === TOOL[i][0]); });  // once a guess is made, the three guess buttons lock and the one the student chose stays lit
            const done = Object.keys(guessed).length, right = Object.keys(guessed).filter((i) => guessed[i] === key(JOBS[i])).length;  // done counts the jobs guessed so far; right counts the guesses that matched the real tool
            gfb.innerHTML = g == null ? '<span class="muted">Commit to an answer; the chips above then show the tool that meets this job.</span>'  // before a guess: a grey prompt asking the student to commit to an answer
              : (g === ans ? '<b style="color:var(--ok)">✓ Right:</b> ' : `<b style="color:var(--bad)">✗ The answer is ${ans === 'both' ? 'both tools' : ans === 'fs' ? 'the file system' : 'virtual memory'}:</b> `) + WHY[ans] +  // after a guess: a green "Right" or a red line naming the real tool, followed by the reason
                (done === JOBS.length ? ` <b>${right} / ${JOBS.length}</b> matched.` : '');  // after the last of the five jobs, adds the overall "N / 5 matched" score
          }  // ends pick()
          el.append(h('div', { class: 'split l fill' },  // lays step 5 out as two columns side by side
            h('div', { class: 'stack' },  // left column: the introduction, the five job buttons and the two-tools box
              h('p', { class: 'm0', html: 'Users want to run many programs at once, and programmers want memory to just work. That hands the OS <b>five storage-management jobs</b>. Click each one, then name the tool that meets it:' }),  // intro paragraph: running many programs at once hands the OS five storage jobs; click and name the tool
              h('div', { class: 'stack gap-s' }, btns),  // the stack of five job buttons
              h('div', { class: 'callout why m0', 'data-label': 'Two tools do the work', html: '<span class="t">Virtual memory</span> lets each program use its own logical addresses, without caring how much real memory exists or where its pieces sit. The <span class="t">file system</span> keeps information for the long term in named files.' })),  // "Two tools do the work" box: what virtual memory and the file system each provide
            h('div', { class: 'card white stack', style: { gap: '10px' } }, title, fitWide(ctx, svg, 540), expl, wo, eg,  // right column: the job's title, picture, explanation, "Without it" line and example
              h('div', { class: 'stack', style: { gap: '6px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px dashed var(--line-2)' } },  // a strip at the bottom of the card, set off by a dashed line, for the guess
                h('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, h('b', { class: 'small' }, 'Which tool meets this job?'), ...gBtns), gfb))));  // the question "Which tool meets this job?", the three guess buttons and the feedback line; closes both columns
          pick(0);  // shows job 1 straight away so the card is filled in
        },  // ends render() for step 5
      },  // ends step 5
      /* ---------------- 6. Paging lab: virtual address → page table → frame or page fault ---------------- */
      {  // step 6 starts: the paging lab, where a virtual address is translated or causes a page fault
        title: 'Paging lab: follow a virtual address to memory',  // step 6 title shown at the top of the page
        kind: 'lab',  // kind: 'lab' labels this step as a hands-on lab
        core: true, // on the shorter core path
        render(el, ctx) {  // render(el, ctx): builds step 6 when the student arrives
          const { h, s } = ctx;  // takes the page-element and SVG builders from the guide
          const NP = 8, NF = 6;  // the program has NP = 8 pages but memory has only NF = 6 frames, so some pages must wait on disk
          let st, busy = false, gen = 0;                   // gen: bumped by Reset so a page-fault handler in progress stops
          const fresh = () => ({ table: [3, 0, null, 5, null, 1, null, null], frames: [1, 5, null, 0, null, 3], order: [1, 5, 0, 3], faults: 0, n: 0, va: null, res: null, hl: {} });  // fresh(): start state: table maps each page to a frame or null (on disk), frames says which page each frame holds, order lists pages oldest first
          const svg = s('svg', { viewBox: '0 0 660 460', width: '100%', role: 'img', 'aria-label': 'Processor, MMU with page table, main memory frames and disk' });  // the lab drawing, 660 by 460 units: processor, MMU with page table, memory frames and disk
          const input = h('input', { class: 'va-in', type: 'number', min: 0, max: 9999, value: '5000', 'aria-label': 'Virtual address', onkeydown: (e) => { if (e.key === 'Enter') go(); } });  // the box where the student types a virtual address (0-9999); pressing Enter translates it
          const brk = h('div', { class: 'card tight brk' });  // brk: the card that shows how the address splits into page number and offset
          const say = h('div', { class: 'fb' });  // say: the feedback box that narrates what the MMU and the OS do
          const stats = h('div', { class: 'row', style: { gap: '6px' } });  // stats: the row of chips counting translations and page faults
          const handleBtn = h('button', { class: 'btn sm intr', type: 'button', onclick: () => { if (!busy && st.res && st.res.kind === 'fault') handle(); } }, 'Let the OS handle the page fault');  // the button that lets the OS handle a page fault; it works only while a fault is waiting
          const rowY = (p) => 86 + p * 45 + 19, frameY = (f) => 34 + f * 46 + 20;  // rowY(p) and frameY(f): the vertical middle of page table row p and of memory frame f, used to aim the arrows
          function draw() {  // draw(): redraws the whole lab from the current state; called after every change
            const r = st.res || {}, H = st.hl;  // r is the latest translation result and H says which row, frame or disk page to highlight
            const n = [R(8, 176, 120, 96, 's-cpu'), T(68, 204, 'Processor', { fw: 800 }), T(68, 228, 'virtual address', { fs: 12.5, cls: 's-sub' }),  // n starts with the processor box, which shows the virtual address being used
              T(68, 256, st.va == null ? '—' : String(st.va), { fs: 17, fw: 800, cls: 's-monot', st: 'fill:var(--cpu)' }), LN(128, 224, 148, 224, 'cpu'),  // the address itself (a dash before any), and an arrow from the processor into the MMU
              R(150, 8, 164, 444, 's-cpu'), T(232, 32, 'MMU', { fw: 800 }), T(232, 52, 'page table', { fs: 12.5, cls: 's-sub' }),  // the tall MMU box with its "page table" subtitle
              T(184, 76, 'page', { fs: 12.5, fw: 700, cls: 's-sub' }), T(258, 76, 'where', { fs: 12.5, fw: 700, cls: 's-sub' })];  // column headings of the page table: page and where
            for (let p = 0; p < NP; p++) {  // draws one page table row for each of the 8 pages
              const y = 86 + p * 45, f = st.table[p], on = H.row === p;  // rows sit 45 units apart; f is the frame holding page p (or null); on is true if this row is highlighted
              n.push(R(160, y, 144, 38, on ? 's-accent' : 's-panel', { rx: 6, 'stroke-width': on ? 3 : 1 }), T(184, y + 25, String(p), { fs: 15, fw: 800 }),  // the row's box, lit up when it is the row being looked up, and the page number
                T(258, y + 25, f == null ? 'on disk' : 'frame ' + f, { fs: 14, fw: 700, st: f == null ? 'fill:var(--io)' : 'fill:var(--mem)' }));  // the row's answer: "frame N" in green, or "on disk" in orange
            }  // ends the page table rows
            n.push(T(400, 24, 'Main memory', { a: 'start', fw: 800, st: 'fill:var(--mem)' }));  // the "Main memory" heading
            for (let f = 0; f < NF; f++) {  // draws each of the 6 memory frames
              const y = 34 + f * 46, p = st.frames[f], on = H.frame === f;  // frames sit 46 units apart; p is the page held in frame f (or null); on is true if highlighted
              n.push(R(400, y, 140, 40, p == null ? 's-panel' : 's-mem', { rx: 6, 'stroke-width': on ? 3.5 : 1.5, 'stroke-dasharray': p == null ? '5 4' : null, style: on ? 'stroke:var(--ok)' : null }),  // the frame's box: green if it holds a page, dashed if free, outlined in green when just used
                T(470, y + 26, `frame ${f}: ${p == null ? 'free' : 'page ' + p}`, { fs: 13.5, fw: 700, cls: p == null ? 's-sub' : null }),  // the frame's label: "frame N: page P" or "frame N: free"
                T(548, y + 26, `${f * PAGE}–${f * PAGE + PAGE - 1}`, { a: 'start', fs: 12.5, cls: 's-monot s-sub' }));  // the range of real addresses the frame covers, for example 1024-2047 for frame 1
            }  // ends the frames
            n.push(R(392, 322, 260, 130, 's-io'), T(406, 346, 'Disk (secondary memory)', { a: 'start', fs: 14, fw: 800 }));  // the disk box at the bottom right
            [...Array(NP).keys()].filter((p) => st.table[p] == null).forEach((p, k) => {  // draws a small box for every page that is not in memory
              const x = 406 + k * 61, on = H.disk === p;  // disk boxes sit side by side; on is true for the page being read in
              n.push(R(x, 364, 56, 44, on ? 's-intr' : 's-panel', { rx: 6, 'stroke-width': on ? 3 : 1.2 }), T(x + 28, 383, 'page ' + p, { fs: 12.5, fw: 700 }), T(x + 28, 400, 'blk ' + (50 + p), { fs: 12.5, cls: 's-monot s-sub' }));  // the disk box shows the page number and its disk block, lit red while it is needed
            });  // ends the disk pages
            n.push(T(522, 436, 'pages not in memory wait here', { fs: 12.5, cls: 's-sub' }));  // caption under the disk: pages not in memory wait here
            if (r.kind === 'hit' && H.frame === r.f) {  // after a successful translation, draw the arrow from the page table row to its frame
              const y1 = rowY(r.p), y2 = frameY(r.f);  // y1 is the row's height, y2 the frame's height
              /* two-line label in the gap between the MMU and memory, on the side of the frame the line does not pass */
              const ly = y1 >= y2 ? y2 - 24 : y2 + 18;  // puts the label above the frame if the line comes from below, and below if it comes from above
              n.push(LN(304, y1, 396, y2, 'mem'), T(357, ly, 'real', { fs: 12.5, fw: 700, st: 'fill:var(--mem)' }), T(357, ly + 14, 'address', { fs: 12.5, fw: 700, st: 'fill:var(--mem)' }));  // a green line from the row to the frame with the label "real address"
            }  // ends the hit arrow
            if (r.kind === 'fault' && H.disk === r.p) n.push(PA(`M304,${rowY(r.p)} C 350,${rowY(r.p)} 350,386 388,386`, 'intr', { dash: '6 4' }), T(388, 406, 'disk address', { a: 'end', fs: 12.5, fw: 700, st: 'fill:var(--intr)' }));  // during a page fault, a red dashed curve runs from the row to the disk, labelled "disk address"
            svg.replaceChildren(...n);  // replaces everything in the drawing with the new shapes
            stats.innerHTML = `<span class="chip">translations: ${st.n}</span><span class="chip intr">page faults: ${st.faults}</span>`;  // updates the chips: number of translations and number of page faults
            handleBtn.style.display = r.kind === 'fault' && !busy ? '' : 'none';  // shows the "handle the page fault" button only while a fault is waiting and the OS is not already busy
          }  // ends draw()
          function explain() {  // explain(): fills the breakdown card for the latest address
            const r = st.res, va = st.va;  // r is the latest result and va the virtual address
            if (r.kind === 'bad') {  // an address beyond the program's 8 pages gets a short error breakdown
              brk.innerHTML = `<div class="mono">${va} ÷ 1024 = page ${Math.floor(va / PAGE)}</div><div class="res" style="color:var(--bad)">✗ This program only has pages 0–7 (addresses 0–8191).</div>`;  // shows which page it would be and says the program only has pages 0-7
              return;  // stops here for a bad address
            }  // ends the bad-address branch
            const bits = va.toString(2).padStart(13, '0');  // the address written as 13 binary digits, enough for 8 pages of 1024 bytes
            brk.innerHTML = `<div><span class="mono">${va} = ${r.p} × 1024 + ${r.off}</span> → page <span class="pg">${r.p}</span>, offset <span class="of">${r.off}</span></div>` +  // first line: the address as page times 1024 plus offset, with page and offset coloured
              `<div class="mono">binary: <span class="pg">${bits.slice(0, 3)}</span> <span class="of">${bits.slice(3)}</span></div>` +  // second line: the same address in binary, top 3 bits (page) and low 10 bits (offset) coloured to match
              '<div class="xs muted">1024 = 2<sup>10</sup>, so the hardware simply splits the bits: low 10 bits = offset.</div>' +  // note: because 1024 is a power of two, the hardware splits the bits instead of dividing
              (r.kind === 'hit' ? `<div class="res" style="color:var(--mem)">page ${r.p} → frame ${r.f} → real address ${r.f} × 1024 + ${r.off} = <b>${r.real}</b></div>`  // a hit ends with the full sum: page to frame to real address
                : `<div class="res" style="color:var(--intr)">page ${r.p} → on disk → <b>page fault</b></div>`);  // a fault ends with the page on disk and the words "page fault"
          }  // ends explain()
          function translate(va, restart) {  // translate(va, restart): looks up va in the page table; restart is true when the OS retries after a fault
            st.va = va; if (!restart) st.n++;  // records the address and counts a new translation unless it is a retry
            if (!(va >= 0 && va < NP * PAGE)) {  // if the address is outside the program's 8 pages
              st.res = { kind: 'bad' }; st.hl = {};  // the result is "bad" and nothing is highlighted
              say.className = 'fb bad'; say.innerHTML = `<b>Address ${va} is outside the program.</b> Page ${Math.floor(va / PAGE)} does not exist, so the MMU interrupts the OS, which stops the program. Paging protects memory as well as placing it.`;  // feedback: the page does not exist, so the OS stops the program; paging also protects memory
            } else {  // otherwise the address is inside the program
              const p = Math.floor(va / PAGE), off = va % PAGE, f = st.table[p];  // splits the address into page p and offset off, and looks up the frame f for that page
              if (f == null) {  // no frame means the page is on disk
                st.res = { kind: 'fault', p, off }; st.hl = { row: p, disk: p }; st.faults++;  // records a page fault, highlights the table row and the disk page, and counts the fault
                say.className = 'fb bad'; say.innerHTML = `The table says page ${p} is <b>on disk</b>, not in main memory. The MMU cannot finish the translation, so it raises a <span class="t">page fault</span>.`;  // feedback: the MMU cannot finish the translation, so it raises a page fault
              } else {  // otherwise the page is in memory
                st.res = { kind: 'hit', p, off, f, real: f * PAGE + off }; st.hl = { row: p, frame: f };  // records a hit with the real address frame times 1024 plus offset, and highlights the row and the frame
                if (!restart) { say.className = 'fb ok'; say.innerHTML = `Page ${p} is in frame ${f}. The MMU swaps the page number for the frame number and keeps the offset: <b>${f * PAGE + off}</b>. The program never sees this <span class="t">real address</span>.`; }  // on a first try, the feedback explains the swap of page number for frame number (a retry writes its own message)
              }  // ends the hit/fault choice
            }  // ends the inside/outside choice
            explain(); draw();  // updates the breakdown card and redraws the lab
          }  // ends translate()
          async function handle() {  // handle(): the OS's page-fault handler, animated in stages; runs when the student clicks the handle button
            const { p, off } = st.res; busy = true; const g = gen, live = () => ctx.alive && g === gen;  // takes the faulting page and offset, locks the lab, and sets up live() so the handler stops if the step is left or reset
            say.className = 'fb bad'; say.innerHTML = `<b>Page fault interrupt.</b> The OS takes over and blocks the process while it reads page ${p} from disk block ${50 + p}.`;  // feedback: the OS takes over and blocks the process while it reads the page from its disk block
            draw(); await ctx.sleep(1200); if (!live()) return;  // redraws, waits 1.2 s so the student can read, then stops if the step was left or reset
            let f = st.frames.indexOf(null), note;  // looks for a free frame; f is -1 if every frame is in use
            if (f < 0) { const v = st.order.shift(); f = st.table[v]; st.table[v] = null; note = `No frame is free, so the OS evicts page ${v}, the one in memory longest (saved to disk if changed).`; }  // if memory is full, evicts the page that has been in memory longest (the front of order) and frees its frame
            else note = `Frame ${f} is free.`;  // otherwise the note simply says which frame is free
            st.frames[f] = p; st.table[p] = f; st.order.push(p); st.hl = { row: p, frame: f };  // loads the page into the frame, updates both tables, puts the page at the back of order, and highlights it
            say.innerHTML = `${note} The OS copies page ${p} into frame ${f} and updates the page table.`;  // feedback: which frame was used, and that the page table has been updated
            draw(); await ctx.sleep(1200); if (!live()) return;  // redraws and waits again, stopping if the step was left or reset
            busy = false; translate(st.va, true);  // unlocks the lab and retries the same address; this time the translation succeeds
            say.className = 'fb ok'; say.innerHTML = `The instruction restarts. Now the MMU finds page ${p} in frame ${f}: real address ${f} × 1024 + ${off} = <b>${f * PAGE + off}</b>.`;  // feedback: the instruction restarts and the MMU now finds the page, giving the real address
          }  // ends handle()
          function go(v) { if (busy) return; const va = v != null ? v : Math.round(Number(input.value)); if (!Number.isFinite(va) || va < 0) return; input.value = String(va); translate(va); }  // go(v): translates v (a "Try" button) or the typed address; ignored while the handler is busy or if the value is not a valid number
          function reset() { gen++; busy = false; st = fresh(); say.className = 'fb'; say.innerHTML = 'Pick an address above. Try the ones that land <b>on disk</b>, then keep going until memory is full.'; brk.innerHTML = '<div class="muted">The page number and offset will appear here.</div>'; draw(); }  // reset(): stops any handler in progress, restores the start state, and resets the prompt and breakdown card
          el.append(h('div', { class: 'split l fill' },  // lays step 6 out as two columns side by side
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the explanation, the address controls, the breakdown and the feedback
              h('p', { class: 'm0', html: '<span class="t">Paging</span> cuts every program into fixed-size <b>pages</b> (here 1,024 bytes) and main memory into same-size <b>frames</b>. A <span class="t">virtual address</span> is a page number plus an offset. On every access the <span class="t">memory management unit (MMU)</span> looks it up in the <span class="t">page table</span>.' }),  // intro paragraph: pages, frames, virtual addresses and the MMU's lookup in the page table
              h('div', { class: 'row', style: { gap: '8px' } }, input, h('button', { class: 'btn primary sm', type: 'button', onclick: () => go() }, 'Translate'), h('button', { class: 'btn ghost sm', type: 'button', onclick: reset }, 'Reset')),  // the address box with Translate and Reset buttons
              h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small muted' }, 'Try:'), ...[1300, 3100, 5000, 2600, 7000, 9000].map((v) => h('button', { class: 'btn sm', type: 'button', onclick: () => go(v) }, String(v)))),  // a row of ready-made addresses to try, chosen to show hits, page faults and an address outside the program
              brk, say, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, stats, handleBtn),  // the breakdown card, the feedback box, and a row with the counters and the handle-fault button
              h('p', { class: 'small m0', style: { marginTop: 'auto', paddingLeft: '10px', borderLeft: '4px solid var(--mem)', color: 'var(--ink-2)' }, html: '<b style="color:var(--ink)">Why it matters:</b> this program has 8 pages but memory has only 6 frames, and it still runs, because pages not in use wait on disk. That is <span class="t">virtual memory</span>.' })),  // "Why it matters" note: 8 pages run in 6 frames because unused pages wait on disk, which is virtual memory
            fitWide(ctx, svg, 600)));  // right column: the lab drawing (scrollable on a phone); closes both columns
          reset();  // puts the lab in its starting state and draws it
        },  // ends render() for step 6
      },  // ends step 6
      /* ---------------- 7. Protection and security: sort incidents by the goal they break ---------------- */
      {  // step 7 starts: sort security incidents by the goal each one breaks
        title: 'Protection and security: which goal was broken?',  // step 7 title shown at the top of the page
        kind: 'explore',  // kind: 'explore' marks this as a step where the student clicks to explore
        render(el, ctx) {  // render(el, ctx): builds step 7 when the student arrives
          const { h } = ctx;  // takes the page-element builder from the guide
          const GOALS = [  // GOALS: the four security goals as [name, description, short hint shown in its column]
            ['Availability', 'Systems and data are up and usable whenever authorized users need them.', 'kept from service'],  // goal 0: availability, systems usable whenever authorized users need them
            ['Confidentiality', 'Only those with permission can read the data.', 'read by the wrong people'],  // goal 1: confidentiality, only permitted readers
            ['Data integrity', 'Data is changed only by those allowed to, in allowed ways.', 'changed by the wrong people'],  // goal 2: data integrity, changed only by those allowed to
            ['Authenticity', 'Users really are who they claim, and messages really come from where they say.', 'faked identity or origin'],  // goal 3: authenticity, identities and origins are real
          ];  // closes GOALS
          const INC = [  // INC: eight incidents to sort; g is the index of the goal each one breaks, why explains the answer
            { g: 1, t: 'Stolen laptop', x: 'A laptop holding an unencrypted list of customers\' card numbers is stolen from a car.', why: 'Private data can now be read by people with no right to see it. Nothing was changed, and the owners can still work: <b>confidentiality</b>.' },  // incident 1: a stolen laptop with unencrypted card numbers (confidentiality)
            { g: 3, t: 'Guessed password', x: 'An attacker guesses a weak password and logs in. The system treats them as the real account owner.', why: 'The system failed to verify who the user really was: <b>authenticity</b>. (What the intruder does next may break other goals too.)' },  // incident 2: a guessed password lets an attacker log in as someone else (authenticity)
            { g: 0, t: 'Runaway program', x: 'One program grabs all the memory and processor time, so everyone else\'s work grinds to a halt.', why: 'Nobody\'s data was read or changed, but authorized users could not get service: <b>availability</b>.' },  // incident 3: a runaway program starves everyone else (availability)
            { g: 2, t: 'Altered log', x: 'Malware quietly changes the amounts recorded in a bank\'s transaction log.', why: 'The records were modified by someone not allowed to: <b>data integrity</b>.' },  // incident 4: malware alters a bank's transaction log (data integrity)
            { g: 3, t: 'Fake email', x: 'An email that claims to come from the IT department, asking you to reset your password, really comes from an outsider.', why: 'The message lied about where it came from: <b>authenticity</b>.' },  // incident 5: an email pretending to come from the IT department (authenticity)
            { g: 1, t: 'Snooping program', x: 'A program reads another user\'s private messages because the OS never checked whether it had permission.', why: 'Data was read by a program without the right to read it: <b>confidentiality</b>.' },  // incident 6: a program reads private messages without a permission check (confidentiality)
            { g: 0, t: 'Flooded server', x: 'Thousands of fake requests per second swamp a college\'s registration server, so real students cannot sign up.', why: 'The service was knocked out for legitimate users (a denial-of-service attack): <b>availability</b>.' },  // incident 7: a flood of fake requests knocks out a registration server (availability, denial of service)
            { g: 2, t: 'Infected program file', x: 'A virus alters a program file on disk so that it also runs hidden code every time it starts.', why: 'Software was modified without permission: <b>data integrity</b>.' },  // incident 8: a virus modifies a program file on disk (data integrity)
          ];  // closes INC
          let k = 0, right = 0;  // k is the incident being sorted and right counts correct first answers
          const placed = GOALS.map(() => []);  // placed holds, for each goal column, the incidents already filed there
          const inc = h('div', { class: 'card tight', style: { minHeight: '84px' } });  // inc: the card that shows the current incident
          const fb = h('div', { class: 'fb', style: { minHeight: '66px' } });  // fb: the feedback box, kept at a fixed minimum height so the layout does not jump
          const prog = h('span', { class: 'chip' }), score = h('span', { class: 'chip ok' });  // prog: chip showing progress; score: green chip showing correct answers
          const again = h('button', { class: 'btn sm primary', type: 'button', style: { display: 'none' }, onclick: () => { k = 0; right = 0; placed.forEach((p) => (p.length = 0)); show(); } }, 'Play again');  // "Play again" button, hidden until every incident is sorted; it empties the columns and starts over
          const cols = GOALS.map(([n], j) => {  // cols: one clickable column per goal
            const c = h('div', { class: 'gcol', style: ctx.narrow ? { minHeight: '120px' } : null, role: 'button', tabindex: 0, 'aria-label': 'Put it under ' + n, onclick: () => assign(j), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); assign(j); } } });  // each column works by mouse click or by Enter or Space from the keyboard, and is announced to screen readers
            return c;  // hands back the column
          });  // closes the columns list
          function paintCols() {  // paintCols(): redraws every column's contents
            cols.forEach((c, j) => {  // goes through the four columns
              c.replaceChildren(h('span', { class: 'gn' }, GOALS[j][0]), h('span', { class: 'gh' }, GOALS[j][2]),  // each column shows the goal's name and hint
                ...placed[j].map((p) => h('span', { class: 'gchip ' + (p.ok ? 'ok' : 'bad') }, (p.ok ? '✓ ' : '✗ ') + p.t)));  // followed by a green or red label for every incident already filed there
              c.classList.toggle('done', k >= INC.length);  // once all incidents are sorted, the columns stop reacting to clicks and hover
            });  // ends the loop over the columns
          }  // ends paintCols()
          function show() {  // show(): updates the progress chip, score, incident card and columns
            prog.textContent = k < INC.length ? `Incident ${k + 1} of ${INC.length}` : 'All sorted';  // progress chip: which incident, or "All sorted" at the end
            score.textContent = `right first time: ${right}`;  // score chip: how many were right first time
            inc.innerHTML = k < INC.length ? `<b>${INC[k].t}.</b> ${INC[k].x}` : `<b>${right} of ${INC.length}</b> right first time. Each column now holds two incidents: every goal can be broken in more than one way, and one attack can break several goals.`;  // the incident card shows the next incident, or the final score and the lesson that goals can be broken many ways
            if (k === 0) { fb.className = 'fb'; fb.innerHTML = '<span class="muted">Click the column for the goal this incident breaks.</span>'; }  // on the first incident, the feedback box shows the instruction
            again.style.display = k >= INC.length ? '' : 'none';  // the "Play again" button appears only after the last incident
            paintCols();  // redraws the columns
          }  // ends show()
          function assign(j) {  // assign(j): runs when the student clicks column j for the current incident
            if (k >= INC.length) return;  // does nothing once all incidents are sorted
            const c = INC[k], ok = c.g === j;  // c is the current incident and ok is true if the student chose its goal
            placed[c.g].push({ t: c.t, ok }); if (ok) right++;  // files the incident under its real goal, marked right or wrong, and counts a right answer
            fb.className = 'fb ' + (ok ? 'ok' : 'bad');  // colours the feedback box green or red
            fb.innerHTML = (ok ? '<b>✓ Right.</b> ' : `<b>✗ Not ${GOALS[j][0].toLowerCase()}.</b> `) + c.why;  // feedback: "Right" or "Not <goal>", followed by the explanation
            k++; show();  // moves on to the next incident and updates the page
          }  // ends assign()
          el.append(h('div', { class: 'split l fill' },  // lays step 7 out as two columns side by side
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column: the introduction, the four goals and the common-mistake box
              h('p', { class: 'm0', html: 'When many users share a machine and networks join machines, the OS must control who may use what, and check who is asking. Security has <b>four goals</b>:' }),  // intro paragraph: sharing machines means the OS must control access; security has four goals
              ...GOALS.map(([n, d], j) => h('div', { class: 'card goal' }, h('span', { class: 'k' }, ['Av', 'C', 'I', 'Au'][j]), h('div', {}, h('b', { html: `<span class="t" data-t="${n === 'Availability' ? 'Availability (security goal)' : n}">${n}</span>` }), h('span', { class: 'd' }, d)))),  // one card per goal with a short badge (Av, C, I, Au), the goal's glossary term and its description
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Mixing up confidentiality and integrity. <b>Reading</b> data you should not breaks confidentiality; <b>changing</b> it breaks integrity.' })),  // "Common mistake" box: reading breaks confidentiality, changing breaks integrity
            h('div', { class: 'card white stack', style: { gap: '10px' } },  // right column: the sorting game
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Sort the incidents'), h('div', { class: 'row' }, prog, score)),  // game header: "Sort the incidents" with the progress and score chips
              inc, h('div', { style: { display: 'grid', gap: '8px', gridTemplateColumns: `repeat(${ctx.narrow ? 2 : 4}, minmax(0, 1fr))` } }, cols), fb, h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: 'auto' } }, again))));  // incident card, the goal columns (four across, or two on a small screen), feedback and Play again; closes both columns
          show();  // shows the first incident straight away
        },  // ends render() for step 7
      },  // ends step 7
      /* ---------------- 8. Scheduling and resource management: queues, service calls, interrupts ---------------- */
      {  // step 8 starts: a lab where events flow through the OS's queues and handlers
        title: 'Scheduling: queues, service calls and interrupts',  // step 8 title shown at the top of the page
        kind: 'lab',  // kind: 'lab' labels this step as a hands-on lab
        render(el, ctx) {  // render(el, ctx): builds step 8 when the student arrives
          const { h, s } = ctx;  // takes the page-element and SVG builders from the guide
          const CAP = 4;                                   // processes that fit in main memory
          let st, busy = false, gen = 0;                   // gen: bumped by Reset so an event chain already in flight stops
          const fresh = () => ({ run: 'P1', rq: ['P2', 'P3'], dq: ['P4'], pq: [], lt: ['P5', 'P6'], next: 7, done: 0, sw: 0, moved: null, path: null });  // fresh(): start state: P1 running, P2 and P3 ready, P4 waiting for I/O, P5 and P6 waiting to be admitted
          const inMem = () => (st.run ? 1 : 0) + st.rq.length + st.dq.length + st.pq.length;  // inMem(): counts the processes in main memory: the running one plus everyone in the ready and I/O queues
          const svg = s('svg', { viewBox: '0 0 660 322', width: '100%', role: 'img', 'aria-label': 'Long-term, short-term and I/O queues feeding the processor' });  // the lab drawing, 660 by 322 units: the long-term, short-term and I/O queues feeding the processor
          const HN = ['Service call handler', 'Interrupt handler', 'Long-term scheduler', 'Short-term scheduler'];  // HN: the four parts of the OS that handle events, shown as labels above the drawing
          const hEls = HN.map((n) => h('span', {}, n));  // hEls: one label element per handler, lit up while that handler is working
          const say = h('div', { class: 'fb', style: { minHeight: '70px' } });  // say: the feedback box that narrates each event, kept at a fixed height so the page does not jump
          const stats = h('div', { class: 'row', style: { gap: '6px' } });  // stats: the row of chips counting processes in memory, finished jobs and dispatches
          const lit = (i) => hEls.forEach((e, j) => e.classList.toggle('on', j === i));  // lit(i): lights handler label i and turns the others off; -1 turns all of them off
          const PATHS = {  // PATHS: the arrow for each kind of move, as [SVG path, colour]
            timeout: ['M540,94 C 530,66 120,66 96,104', 'warn'], diskDone: ['M52,186 C 52,150 60,126 90,126', 'io'], prnDone: ['M20,290 L8,290 L8,140 Q 8,126 22,126 L90,126', 'io'],  // paths for a timeout (processor back to the ready queue), and for disk and printer completions (back to the ready queue)
            dispatch: ['M472,126 L508,126', 'cpu'], toDisk: ['M560,160 L478,204', 'proc'], toPrn: ['M600,160 L478,286', 'proc'], admit: ['M92,48 C 66,56 66,112 88,120', 'mem'], exit: ['M630,94 L630,74', 'ok'],  // paths for a dispatch (queue to processor), a trip to the disk or printer queue, an admission, and an exit
          };  // closes PATHS
          function draw() {  // draw(): redraws the queues, the processor and the arrows from the current state
            const n = [];  // n collects the shapes for this drawing
            const tok = (x, y, name) => [R(x, y, 54, 34, 's-proc', { rx: 8, style: st.moved === name ? 'fill:var(--hl)' : null, 'stroke-width': st.moved === name ? 3 : 2 }), T(x + 27, y + 23, name, { fs: 14.5, fw: 800 })];  // tok(x, y, name): draws one process as a small labelled token, filled yellow if it just moved
            const lane = (y, label) => { n.push(R(92, y, 380, 44, 's-panel', { rx: 10, 'stroke-width': 1.5 }), T(472, y - 7, label, { a: 'end', fs: 13, fw: 700, cls: 's-sub' })); };  // lane(y, label): draws one queue as a long rounded strip with its name above the right end
            lane(26, 'Long-term queue: new jobs waiting to be admitted'); lane(104, 'Short-term queue: ready, served round-robin');  // draws the long-term queue and the short-term (ready) queue
            lane(186, 'I/O queue: waiting for the disk'); lane(268, 'I/O queue: waiting for the printer');  // draws the disk queue and the printer queue
            st.lt.forEach((p, i) => n.push(...tok(98 + i * 62, 31, p)));  // places the tokens of processes waiting to be admitted, left to right
            st.rq.forEach((p, i) => n.push(...tok(412 - i * 62, 109, p)));  // places the ready tokens right to left, so the front of the queue sits next to the processor
            st.dq.forEach((p, i) => n.push(...tok(98 + i * 62, 191, p)));  // places the tokens waiting for the disk
            st.pq.forEach((p, i) => n.push(...tok(98 + i * 62, 273, p)));  // places the tokens waiting for the printer
            n.push(R(512, 94, 140, 66, 's-cpu'), T(582, 112, 'Processor', { fs: 13.5, fw: 800 }));  // the processor box to the right of the ready queue
            if (st.run) n.push(...tok(555, 119, st.run)); else n.push(T(582, 142, 'idle', { fs: 14, fw: 700, cls: 's-sub' }));  // shows the running process's token inside the processor, or "idle" if nothing is running
            n.push(R(20, 186, 64, 44, 's-io'), T(52, 213, 'Disk', { fs: 14, fw: 800 }), R(20, 268, 64, 44, 's-io'), T(52, 295, 'Printer', { fs: 13.5, fw: 800 }),  // the disk and printer boxes at the left end of their queues
              LN(90, 208, 86, 208, 'io', { w: 2 }), LN(90, 290, 86, 290, 'io', { w: 2 }), LN(540, 48, 478, 48, 'muted', { w: 2 }), T(546, 53, 'new jobs', { a: 'start', fs: 13, fw: 700, cls: 's-sub' }));  // short links from each device to its queue, and an arrow bringing new jobs into the long-term queue
            Object.entries(PATHS).forEach(([k, [d, col]]) => {  // draws the arrows from PATHS
              const on = st.path === k, fixed = ['dispatch', 'toDisk', 'toPrn', 'admit'].includes(k);  // on is true for the move that just happened; fixed arrows are always shown as the normal routes
              if (on || fixed) n.push(PA(d, on ? col : 'muted', { w: on ? 3.5 : 2, dash: on && !fixed ? '7 4' : null }));  // the move that just happened is drawn thick, dashed and coloured; fixed routes are drawn thin and grey
            });  // ends the arrows loop
            if (st.path === 'exit') n.push(T(630, 68, 'finished', { fs: 13, fw: 800, st: OK }));  // after an exit, a green "finished" label appears above the processor
            svg.replaceChildren(...n);  // replaces everything in the drawing with the new shapes
            stats.innerHTML = `<span class="chip">in memory: ${inMem()} of ${CAP}</span><span class="chip ok">finished: ${st.done}</span><span class="chip cpu">dispatches: ${st.sw}</span>`;  // updates the chips: processes in memory out of CAP, finished jobs, and dispatches
          }  // ends draw()
          const btns = [];  // btns keeps every event button so they can all be disabled together
          const btn = (label, cls, fn) => { const b = h('button', { class: 'btn sm ' + cls, type: 'button', onclick: () => { if (!busy) run(fn); } }, label); btns.push(b); return b; };  // btn(label, cls, fn): makes an event button that runs fn through run() when nothing else is in progress
          async function run(fn) { const g = gen; busy = true; btns.forEach((b) => (b.disabled = true)); await fn(); if (!ctx.alive || g !== gen) return; busy = false; btns.forEach((b) => (b.disabled = false)); }  // run(fn): locks the buttons, waits for the whole event chain to finish, then unlocks them unless the step was left or reset
          const beat = async (hi, path, moved, html) => { const g = gen; lit(hi); st.path = path; st.moved = moved; say.className = 'fb'; say.innerHTML = html; draw(); await ctx.sleep(1000); return ctx.alive && g === gen; };  // beat(): one stage of an animation: lights a handler, draws a move, shows a message, waits 1 s, and reports whether to go on
          async function dispatch() {  // dispatch(): the short-term scheduler picks the next process to run
            if (st.run) return true;  // if something is already running there is nothing to do
            if (!st.rq.length) return beat(3, null, null, 'The short-term queue is empty, so the <b>processor sits idle</b> until an interrupt brings a process back.');  // with no ready process, the processor sits idle until an interrupt brings one back
            st.run = st.rq.shift(); st.sw++;  // takes the process at the front of the ready queue, puts it on the processor and counts a dispatch
            return beat(3, 'dispatch', st.run, `The short-term scheduler <b>dispatches ${st.run}</b>, the process at the front of the ready queue.`);  // shows the dispatch arrow and explains it
          }  // ends dispatch()
          async function admit() {  // admit(): the long-term scheduler lets a waiting job into memory if there is room
            if (!st.lt.length || inMem() >= CAP) return true;  // nothing to do if no job waits or memory already holds CAP processes
            const p = st.lt.shift(); st.rq.push(p);  // moves the first waiting job to the back of the ready queue
            return beat(2, 'admit', p, `Memory has room, so the long-term scheduler <b>admits ${p}</b>: the OS gives it a share of main memory, and it joins the back of the short-term queue.`);  // shows the admission arrow and explains that the job now has memory
          }  // ends admit()
          const needRun = () => { if (st.run) return false; lit(-1); say.className = 'fb bad'; say.innerHTML = 'Nothing is running, so there is no process to make that request.'; return true; };  // needRun(): for service calls; if nothing is running it explains that no process can make the request
          const EV = {  // EV: what happens for each event button
            timer: async () => { if (!st.run) { lit(1); say.className = 'fb'; say.innerHTML = 'Timer interrupt, but the processor is idle: nothing to preempt.'; return; }  // timer: with nothing running, there is nothing to preempt, so it just says so
              const p = st.run; st.run = null; st.rq.push(p);  // otherwise the running process is taken off the processor and sent to the back of the ready queue
              if (await beat(1, 'timeout', p, `<b>Timer interrupt.</b> ${p}'s time slice is used up. The OS saves its context and sends it to the <b>back</b> of the short-term queue. Round-robin: everyone gets a turn.`)) await dispatch(); },  // explains the timeout and round-robin, then dispatches the next process
            disk: async () => { if (needRun()) return; const p = st.run; st.run = null; st.dq.push(p);  // read disk: the running process leaves the processor and joins the disk queue
              if (await beat(0, 'toDisk', p, `<b>Service call.</b> ${p} asks the OS to read the disk. It cannot go on until the data arrives, so it joins the <b>disk queue</b>.`)) await dispatch(); },  // explains the service call, then dispatches the next process
            prn: async () => { if (needRun()) return; const p = st.run; st.run = null; st.pq.push(p);  // print: the running process leaves the processor and joins the printer queue
              if (await beat(0, 'toPrn', p, `<b>Service call.</b> ${p} asks the OS to print. It waits in the <b>printer queue</b> until the printer is done with it.`)) await dispatch(); },  // explains the service call, then dispatches the next process
            exit: async () => { if (needRun()) return; const p = st.run; st.run = null; st.done++;  // exit: the running process finishes and is counted
              if (!(await beat(0, 'exit', null, `<b>Service call.</b> ${p} tells the OS it is finished. The OS reclaims its memory.`))) return;  // explains that the OS reclaims its memory; stops if the step was left or reset
              if (await admit()) await dispatch(); },  // the freed memory may let a waiting job in, and then the next process is dispatched
            diskDone: async () => { if (!st.dq.length) { lit(1); say.className = 'fb'; say.innerHTML = 'No process is waiting for the disk, so there is no disk interrupt to handle.'; return; }  // disk done: with nobody waiting for the disk there is no interrupt to handle
              const p = st.dq.shift(); st.rq.push(p);  // otherwise the first process in the disk queue moves to the ready queue
              if (await beat(1, 'diskDone', p, `<b>Disk interrupt.</b> ${p}'s data has arrived, so ${p} is ready again and joins the short-term queue.`)) await dispatch(); },  // explains the disk interrupt, then dispatches if the processor is idle
            prnDone: async () => { if (!st.pq.length) { lit(1); say.className = 'fb'; say.innerHTML = 'No process is waiting for the printer, so there is no printer interrupt to handle.'; return; }  // printer done: with nobody waiting for the printer there is no interrupt to handle
              const p = st.pq.shift(); st.rq.push(p);  // otherwise the first process in the printer queue moves to the ready queue
              if (await beat(1, 'prnDone', p, `<b>Printer interrupt.</b> ${p}'s output is printed, so ${p} is ready again and joins the short-term queue.`)) await dispatch(); },  // explains the printer interrupt, then dispatches if the processor is idle
            job: async () => { if (st.lt.length >= 6) { lit(-1); say.className = 'fb'; say.innerHTML = 'The long-term queue is full in this demo. Let some processes finish first.'; return; }  // new job: the demo caps the long-term queue at six jobs
              const p = 'P' + st.next++; st.lt.push(p);  // creates the next process name (P7, P8, ...) and adds it to the long-term queue
              if (!(await beat(2, null, p, `New job <b>${p}</b> arrives and joins the long-term queue. ${inMem() >= CAP ? 'Memory already holds ' + CAP + ' processes; admitting more would overcommit it, so ' + p + ' must wait.' : 'There is room in memory, so it can be admitted.'}`))) return;  // explains the arrival and whether memory has room or the job must wait
              if (await admit()) await dispatch(); },  // tries to admit it and then dispatches if the processor is idle
          };  // closes EV
          function reset() { gen++; busy = false; btns.forEach((b) => (b.disabled = false)); st = fresh(); lit(-1); say.className = 'fb'; say.innerHTML = 'P1 is running. Fire an event on the left: every event goes to the OS, which then decides who runs next.'; draw(); }  // reset(): stops any event chain in progress, unlocks buttons, restores the start state and shows the intro message
          const group = (label, ...b) => h('div', { class: 'ctl' }, h('h4', {}, label), h('div', { class: 'row', style: { gap: '6px' } }, b));  // group(label, buttons): a small heading over a row of buttons
          el.append(h('div', { class: 'split l fill' },  // lays step 8 out as two columns side by side
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column: the goals of scheduling and the event buttons
              h('p', { class: 'm0', html: 'The OS shares the processor, memory and I/O devices among many active processes. Scheduling aims at three goals:' }),  // intro paragraph: the OS shares the processor, memory and devices, aiming at three goals
              ...[['Fairness', 'Processes competing for the same resource, especially similar jobs, get roughly equal access. <span class="t">Round-robin</span> gives every ready process a turn.'],  // goal 1: fairness, with round-robin as an example
                ['Differential responsiveness', 'Jobs with different needs get different treatment, decided as things change: e.g. quickly run a process that is holding an I/O device, so it finishes with the device and frees it for others.'],  // goal 2: differential responsiveness, treating jobs with different needs differently
                ['Efficiency', 'Maximize throughput, minimize response time and, in time sharing, serve as many users as possible.']]  // goal 3: efficiency: throughput, response time and number of users served
                .map(([t, d], j) => h('div', { class: 'card dev' }, h('span', { class: 'k', style: { background: 'var(--cpu-bg)', color: 'var(--cpu)' } }, String(j + 1)), h('div', {}, h('b', {}, t), h('span', { html: d })))),  // turns each goal into a numbered row with a blue badge
              group('Service calls from the running process', btn('Read disk', 'proc', EV.disk), btn('Print', 'proc', EV.prn), btn('Exit', 'proc', EV.exit)),  // buttons for the running process's service calls: read disk, print, exit
              group('Interrupts from hardware', btn('Timer', 'intr', EV.timer), btn('Disk done', 'intr', EV.diskDone), btn('Printer done', 'intr', EV.prnDone)),  // buttons for hardware interrupts: timer, disk done, printer done
              h('div', { class: 'row', style: { gap: '6px' } }, btn('New job arrives', 'mem', EV.job), h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset'))),  // the new-job button and the reset button
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the handler labels, the drawing, feedback and counters
              h('div', { class: 'osrow' }, hEls), fitWide(ctx, svg, 600), say, stats,  // handler labels row, the drawing (scrollable on a phone), the feedback box and the chips
              h('p', { class: 'small m0', style: { color: 'var(--ink-2)' }, html: 'Every event reaches the OS as either a <b>service call</b> (the running process asks for something) or an <b>interrupt</b> (hardware signals). After handling it, the OS decides which process runs next: here by round-robin, though many systems pick by priority instead.' }))));  // closing note: every event is a service call or an interrupt, and the OS then picks who runs next; closes both columns
          reset();  // puts the lab in its starting state and draws it
        },  // ends render() for step 8
      },  // ends step 8
      /* ---------------- 9. Recap ---------------- */
      {  // step 9 starts: a recap in eight flip cards
        title: 'Recap: the four achievements in eight cards',  // step 9 title shown at the top of the page
        kind: 'recap',  // kind: 'recap' labels this step as a recap
        render(el, ctx) {  // render(el, ctx): builds step 9 when the student arrives
          const CARDS = [  // CARDS: the eight recap cards as [front question, back answer]
              ['The four major achievements', 'The <b>process</b>, <b>memory management</b>, <b>information protection and security</b>, and <b>scheduling and resource management</b>.'],  // card 1: the four major achievements
              ['Four ways to define a process', 'A program in execution · an instance of a running program · the entity assigned to and executed on a processor · a unit of activity with one sequential thread, a current state and a set of resources.'],  // card 2: the four definitions of a process
              ['Why processes? 3 pressures, 4 bug families', 'Multiprogrammed batch, time sharing, real-time transactions. Bugs: improper synchronization, failed mutual exclusion, nondeterminate operation, deadlock.'],  // card 3: three pressures and four bug families
              ['A process has three parts. Where do they live?', 'Program + data + execution context. Each process-list entry locates the process and saves its context; base and limit registers fence in the running process.'],  // card 4: the three parts of a process and where they live
              ['Five storage-management jobs', 'Process isolation · automatic allocation and management · support of modular programming · protection and access control · long-term storage. Tools: virtual memory and file systems.'],  // card 5: the five storage-management jobs and the two tools
              ['1 KB pages. Address 5000; page 4 is in frame 2. Real address?', '5000 = 4 × 1024 + 904, so page 4, offset 904 → 2 × 1024 + 904 = <b>2952</b>. Had page 4 been on disk: a page fault.'],  // card 6: a worked paging example, address 5000 with page 4 in frame 2
              ['Four security goals', '<b>Availability</b> (there when needed) · <b>confidentiality</b> (read only by the allowed) · <b>data integrity</b> (changed only by the allowed) · <b>authenticity</b> (identity and origin are genuine).'],  // card 7: the four security goals in a phrase each
              ['Scheduling: 3 goals, 3 kinds of queue', 'Fairness, differential responsiveness, efficiency. Long-term queue (new jobs not yet admitted to memory), short-term queue (ready, often round-robin), one I/O queue per device.'],  // card 8: the three scheduling goals and the three kinds of queue
          ];  // closes CARDS
          el.append(ctx.h('div', { class: 'stack fill' },  // step 9 layout: an instruction line above a grid of flip cards
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. If one surprises you, revisit its step.'),  // instruction: say each answer aloud before flipping
            ctx.ui.flipcards(CARDS.map(([f, bk]) => [f, '<div>' + bk + '</div>']), { cols: 4, height: 222 })));  // builds the flip cards (click to turn over) in four columns, each tall enough for its answer; closes the layout
        },  // ends render() for step 9
      },  // ends step 9
      /* ---------------- 10. Check yourself ---------------- */
      {  // step 10 starts: the end-of-section quiz, drawn by the guide's quiz engine
        title: 'Check yourself',  // step 10 title shown at the top of the page
        kind: 'check',  // kind: 'check' labels this step as a self-check
        quiz: [  // quiz: the list of questions; each has a type (multiple choice if none is given), the answer and an explanation (why)
          { q: 'Which of these is <b>not</b> one of the four major achievements in operating-system design?',  // question 1 (multiple choice): which is not one of the four achievements
            choices: ['The process', 'Memory management', 'The graphical user interface', 'Scheduling and resource management'], answer: 2,  // the four choices; answer 2 (counting from 0) is the graphical user interface
            feedback: ['The process is the first of the four achievements.', 'Memory management is one of the four.', null, 'Scheduling and resource management is one of the four.'],  // feedback for each wrong choice; null marks the right one, which needs none
            why: 'The four are the process, memory management, information protection and security, and scheduling and resource management. Graphical interfaces matter to users, but they are not on this list.' },  // explanation shown after answering: the list of four, which leaves out graphical interfaces
          { type: 'multi', q: 'Which statements are valid definitions of a <b>process</b>?',  // question 2 (select all): which statements define a process
            choices: ['A program in execution', 'The file on disk that holds a program\'s machine code', 'The entity that can be assigned to and executed on a processor', 'A unit of activity with a single sequential thread of execution, a current state and an associated set of system resources'], answer: [0, 2, 3],  // choices; the program file on disk is the one that does not fit
            why: 'A program file on disk is passive: just instructions. It becomes a process only when it is loaded and running, with a current position, register values and resources of its own.' },  // explanation: a file on disk is passive until it is loaded and running
          { type: 'multi', q: 'Which developments pushed designers to invent a clean process concept?',  // question 3 (select all): which developments pushed designers toward the process concept
            choices: ['Multiprogrammed batch operation', 'Time sharing', 'Real-time transaction systems', 'Serial processing, where each user booked the whole machine and ran one program at a time'], answer: [0, 1, 2],  // choices; serial processing is the odd one out
            why: 'All three had to switch one processor among many activities at unpredictable moments. Ad hoc switching code led to timing bugs, and the process was the cure. Serial processing ran one program at a time with no switching, so it never faced these problems.' },  // explanation: all three switched one processor at unpredictable moments; serial processing never switched
          { type: 'match', q: 'Match each bug to its family of error.',  // question 4 (match): pair each bug story with its family of error
            pairs: [['Each of two programs holds one lock and waits for the other\'s', 'Deadlock'], ['Two clerks\' programs both sell seat 14C', 'Failed mutual exclusion'], ['A lost "I/O done" signal leaves a program asleep forever', 'Improper synchronization'], ['Same input, different output, depending on timing', 'Nondeterminate operation']],  // the four bug stories and their families
            why: 'Waiting on each other forever is deadlock. Two programs in a shared record at once is failed mutual exclusion. A lost or badly handled signal is improper synchronization. Results that depend on interleaving are nondeterminate.' },  // explanation: how to recognise each family
          { type: 'order', q: 'Put the steps of a switch from process A to process B in order.',  // question 5 (put in order): the steps of a context switch from A to B
            items: ['An interrupt hands control to the OS', 'The OS saves A\'s context (PC and other registers) in A\'s process-list entry', 'The OS chooses B as the next process to run', 'The OS loads B\'s saved context into the registers, including base and limit', 'B carries on exactly where it last stopped'],  // the five steps in the right order (the quiz shuffles them for the student)
            why: 'Control must reach the OS first; A\'s context is saved before anything overwrites the registers; then the OS picks B and restores B\'s context, so B resumes seamlessly.' },  // explanation: why control reaches the OS first and A is saved before anything else happens
          { type: 'tf', q: 'When the OS switches from process A to process B, it copies A\'s program code and data out of main memory to make room for B.', answer: false,  // question 6 (true or false): a switch copies A's code and data out of memory (false)
            why: 'A context switch saves and reloads only a few register values (the execution context). Code and data stay where they are in memory.' },  // explanation: only a few register values are saved and reloaded
          { type: 'num', q: 'A running process has base register = 4000 and limit register = 500. What is the <b>largest</b> address, counted from the start of its block, that it may use?', answer: 499, tol: 0,  // question 7 (calculate): largest legal relative address with limit 500 (answer 499, no tolerance)
            why: 'The block covers relative addresses 0 to 499 (real addresses 4000 to 4499). Any address of 500 or more reaches the limit, so the hardware refuses it and interrupts the OS.' },  // explanation: the block covers 0-499; 500 or more reaches the limit and is refused
          { type: 'bucket', q: 'Which tool mainly meets each memory-management need?', buckets: ['Virtual memory', 'File system'],  // question 8 (sort into groups): which tool mainly meets each memory need
            items: [['Keeping one process out of another\'s memory', 0], ['Giving a program more memory while it runs', 0], ['Keeping a report after the power is switched off', 1], ['Letting a module grow or shrink while the program runs', 0], ['Storing information under a name so it can be found next month', 1]],  // the five needs, each tagged 0 for virtual memory or 1 for the file system
            why: 'Virtual memory handles isolation, automatic allocation and modular programming while programs run. Long-term, named storage that survives power-off is the file system\'s job.' },  // explanation: virtual memory for running programs, the file system for long-term named storage
          { type: 'num', q: 'Pages are 1,024 bytes. A program uses virtual address 3000, and the page table maps that page to frame 7. What real address does the MMU produce?', answer: 8120, tol: 0,  // question 9 (calculate): translate virtual address 3000 with page 2 in frame 7 (answer 8120)
            why: '3000 = 2 × 1024 + 952, so page 2, offset 952. Page 2 is in frame 7, so the real address is 7 × 1024 + 952 = 7168 + 952 = 8120.' },  // explanation: the full working, page 2 offset 952, then 7 times 1024 plus 952
          { q: 'A program uses an address whose page the page table marks as <b>on disk</b>. What happens next?',  // question 10 (multiple choice): what happens when the page is on disk
            choices: ['The processor reads the byte straight from the disk', 'The MMU raises a page fault; the OS loads the page into a frame, updates the page table, and the instruction is retried', 'The program is always terminated for a bounds violation', 'The MMU uses the virtual address as the real address'], answer: 1,  // choices; answer 1 is the page fault followed by loading, updating and retrying
            feedback: ['The processor can only reach main memory directly; the page must be brought in first.', null, 'The address is legal, the page is just not in memory yet. Only addresses outside the program lead to termination.', 'That would land on some other process\'s memory. The MMU never skips translation.'],  // feedback for each wrong choice: the processor cannot read disk directly, the address is legal, and translation is never skipped
            why: 'A page fault is an interrupt: the OS fetches the missing page from disk (sending another page back if no frame is free), fixes the table, and the instruction restarts.' },  // explanation: a page fault is an interrupt that the OS handles before the instruction restarts
          { type: 'match', q: 'Match each security incident to the goal it breaks.',  // question 11 (match): pair each security incident with the goal it breaks
            pairs: [['A flood of fake requests keeps real users off a web server', 'Availability'], ['A stranger reads an unencrypted backup of patient records', 'Confidentiality'], ['Malware changes the numbers in a company\'s accounts', 'Data integrity'], ['An attacker logs in with a stolen password and is treated as the owner', 'Authenticity']],  // the four incidents and their goals
            why: 'Availability is about access to service; confidentiality about who can read; integrity about who can change; authenticity about genuine identity and origin.' },  // explanation: what each of the four goals protects
          { type: 'match', q: 'Match each scheduling term to its meaning.',  // question 12 (match): pair each scheduling term with its meaning
            pairs: [['Fairness', 'Competing processes get roughly equal access'], ['Differential responsiveness', 'Jobs with different needs are treated differently'], ['Efficiency', 'High throughput, quick response, many users served'], ['Long-term queue', 'New jobs not yet admitted to main memory'], ['Short-term queue', 'Ready processes in memory, often served round-robin']],  // the three goals and two queues with their meanings
            why: 'The three goals guide the choices; the queues are where waiting processes sit. I/O queues, one per device, hold processes waiting for that device.' },  // explanation: goals guide the choices and queues hold waiting processes, with one I/O queue per device
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the steps list

    notes: `${/* notes: the section's summary text, shown in the Notes panel that the student can open from the top bar */''}
      <h3>The four major achievements</h3>${/* heading for the notes on the four major achievements */''}
      <p>Serving many programs and users at once forced four ideas every modern OS rests on:</p>${/* notes paragraph: many programs and users at once forced four ideas */''}
      <ul>${/* start of the list of the four achievements */''}
        <li><b>The process</b>: programs take turns on one processor without losing their place.</li>${/* notes list item: the process */''}
        <li><b>Memory management</b>: each program gets its own memory, safe from others.</li>${/* notes list item: memory management */''}
        <li><b>Information protection and security</b>: everyone reaches only what they are allowed to.</li>${/* notes list item: information protection and security */''}
        <li><b>Scheduling and resource management</b>: the OS decides who runs next, for how long, and who gets each device.</li>${/* notes list item: scheduling and resource management */''}
      </ul>${/* end of the list of achievements */''}

      <h3>What a process is</h3>${/* heading for the notes on what a process is */''}
      <p>Four definitions, one idea seen from different angles:</p>${/* notes paragraph: four definitions, one idea */''}
      <ol>${/* start of the numbered list of definitions */''}
        <li><b>A program in execution.</b> A program is a passive file of instructions; it becomes a process once it is loaded and running.</li>${/* definition 1 in the notes: a program in execution */''}
        <li><b>An instance of a program running on a computer.</b> One program can run as several processes, each with its own data and position.</li>${/* definition 2 in the notes: an instance of a running program */''}
        <li><b>The entity that can be assigned to and executed on a processor.</b> The scheduler's view: the thing it hands the processor to.</li>${/* definition 3 in the notes: what the processor is assigned to */''}
        <li><b>A unit of activity characterized by a single sequential thread of execution, a current state and an associated set of system resources.</b> Thread = the path the PC walks through the code; state = the context; resources = memory, files, devices.</li>${/* definition 4 in the notes: one thread, a current state and resources, each explained */''}
      </ol>${/* end of the numbered list of definitions */''}

      <h3>Why the process concept was needed</h3>${/* heading for the notes on why the process concept was needed */''}
      <p>Three developments all had to switch one processor among many activities, at moments chosen by interrupts rather than by the programs:</p>${/* notes paragraph: three developments that switched one processor at moments set by interrupts */''}
      <ul>${/* start of the list of three developments */''}
        <li><b>Multiprogrammed batch operation</b>: keep the processor and devices busy by switching jobs when one waits for I/O.</li>${/* notes list item: multiprogrammed batch operation */''}
        <li><b>Time sharing</b>: answer many interactive users quickly by giving each a short turn in rotation.</li>${/* notes list item: time sharing */''}
        <li><b>Real-time transaction systems</b>: many users query and update one shared database (e.g. airline seats) and expect answers in seconds.</li>${/* notes list item: real-time transaction systems */''}
      </ul>${/* end of the list of developments */''}
      <p>Case-by-case switching code, with no clean model of a half-finished program, produced timing bugs in four families:</p>${/* notes paragraph: case-by-case switching code produced four families of timing bugs */''}
      <table>${/* start of the table of error families */''}
        <tr><th>Error</th><th>What goes wrong</th><th>Example</th></tr>${/* table header row: error, what goes wrong, example */''}
        <tr><td>Improper synchronization</td><td>A program waits for a signal from another activity, and the signal is lost, duplicated or not waited for.</td><td>A lost "disk done" signal leaves a program asleep forever.</td></tr>${/* table row: improper synchronization and the lost "disk done" signal */''}
        <tr><td>Failed mutual exclusion</td><td>Two programs use a shared resource at the same time when only one should.</td><td>Two clerks both read "seat 14C free" and both sell it.</td></tr>${/* table row: failed mutual exclusion and the double-sold seat */''}
        <tr><td>Nondeterminate program operation</td><td>Results depend on how programs happen to interleave, not only on the input.</td><td>Same input, different totals on different days.</td></tr>${/* table row: nondeterminate operation and the changing totals */''}
        <tr><td>Deadlock</td><td>Programs each hold something and wait for what another holds, so none can continue.</td><td>A holds the disk, wants the printer; B holds the printer, wants the disk.</td></tr>${/* table row: deadlock and the disk and printer standoff */''}
      </table>${/* end of the error table */''}

      <h3>The parts of a process and how the OS stores them</h3>${/* heading for the notes on the parts of a process */''}
      <p>A process has three parts: an <b>executable program</b>, the <b>associated data</b> it works on, and its <b>execution context</b> (or process state): what the OS needs to pause it and resume it exactly where it stopped, such as register values, the program counter, priority and whether it awaits I/O.</p>${/* notes paragraph: program, data and execution context, and what the context holds */''}
      <p>A typical implementation:</p>${/* notes paragraph: introduces a typical implementation */''}
      <ul>${/* start of the implementation list */''}
        <li>The OS keeps a <b>process list</b> with one entry per process. The entry points to the process's memory block and holds part or all of its saved context (the rest can live with the process).</li>${/* notes list item: the process list and what each entry holds */''}
        <li>Each process owns a block of memory holding its program and data.</li>${/* notes list item: each process owns a memory block */''}
        <li>Processor registers describe the running process: the <b>process index</b> (which list entry is running), the <b>program counter</b> (next instruction, counted from the start of the block), the <b>base register</b> (start address of the block) and the <b>limit register</b> (size of the block).</li>${/* notes list item: the process index, program counter, base and limit registers */''}
        <li>Each address must be less than the limit, and is added to the base. With base 2000 and limit 600, addresses 0–599 are legal: 3 becomes 2003, while 650 is refused and the OS is interrupted.</li>${/* notes list item: the address check with base 2000 and limit 600 as a worked example */''}
      </ul>${/* end of the implementation list */''}
      <p><b>Switching from A to B:</b> an interrupt gives the OS control; it saves A's context in A's entry, chooses B, and loads B's context (including base and limit) into the registers. B resumes where it stopped; no program or data is copied, only register values.</p>${/* notes paragraph: the steps of a switch from A to B, which copies only register values */''}
      <h3>Memory management: five responsibilities</h3>${/* heading for the notes on the five memory-management jobs */''}
      <ol>${/* start of the numbered list of memory jobs */''}
        <li><b>Process isolation</b>: stop processes from reading or changing each other's instructions and data.</li>${/* memory job 1 in the notes: process isolation */''}
        <li><b>Automatic allocation and management</b>: hand out and reclaim memory as needed; programmers never pick physical locations.</li>${/* memory job 2 in the notes: automatic allocation and management */''}
        <li><b>Support of modular programming</b>: modules can be created, removed or resized as the program runs.</li>${/* memory job 3 in the notes: support of modular programming */''}
        <li><b>Protection and access control</b>: allow useful sharing (one library copy for all) while controlling who may read, write or run each piece of memory and each file.</li>${/* memory job 4 in the notes: protection and access control */''}
        <li><b>Long-term storage</b>: keep information for long periods, after programs end and the power is off.</li>${/* memory job 5 in the notes: long-term storage */''}
      </ol>${/* end of the numbered list of memory jobs */''}
      <p>Two tools meet these needs. <b>Virtual memory</b> lets each program address memory logically, whatever the real memory size or layout (jobs 1 to 4). Many processes can then share memory, and a program can even be larger than main memory. The <b>file system</b> keeps information in named files on secondary storage (jobs 4 and 5).</p>${/* notes paragraph: virtual memory covers jobs 1 to 4 and the file system covers jobs 4 and 5 */''}

      <h3>Paging and virtual-memory addressing</h3>${/* heading for the notes on paging and virtual-memory addressing */''}
      <p><b>Paging</b> divides every process into equal, fixed-size <b>pages</b> and main memory into same-size <b>page frames</b>. A page can sit in any free frame or stay on disk until needed, so a program's pieces need not be side by side. Each process has a <b>page table</b> recording, for every page, the frame that holds it or that it is on disk. A <b>virtual address</b> is a page number plus an offset within that page:</p>${/* notes paragraph: pages, frames, the page table, and a virtual address as page plus offset */''}
      <pre>page   = address ÷ page size  (whole part)${/* shown formula, line 1: the page number is the whole part of address divided by page size */''}
offset = address − page × page size${/* shown formula, line 2: the offset is what is left over inside the page */''}
real   = frame × page size + offset</pre>${/* shown formula, line 3: the real address is the frame's start plus the offset */''}
      <p><b>Worked example</b> (1,024-byte pages): virtual address 5000 = 4 × 1024 + 904, so page 4, offset 904. If the page table says page 4 is in frame 2, the real address is 2 × 1024 + 904 = <b>2952</b>. Since 1,024 = 2<sup>10</sup>, the hardware just splits the address: the low 10 bits are the offset, the rest the page number.</p>${/* notes paragraph: the worked example 5000 → page 4, offset 904 → real address 2952, and the bit-splitting shortcut */''}
      <p>The processor issues virtual addresses; the <b>memory management unit (MMU)</b> translates each one using the page table. If the page is in main memory, the result is a <b>real address</b> in main memory. If the page is on disk, it leads to a disk address instead: the MMU raises a <b>page fault</b>; the OS blocks the process, reads the page into a free frame (if none is free, it first evicts a page, e.g. the one in memory longest), updates the table, and the instruction is retried. An address beyond the last page is an error that stops the program.</p>${/* notes paragraph: the MMU's two outcomes, a real address or a page fault that the OS handles */''}
      <svg viewBox="0 0 520 110" width="100%">${/* start of a small diagram in the notes (fixed colours so it prints well): processor, MMU, memory and disk */''}
        <rect x="0" y="0" width="520" height="110" rx="8" fill="#ffffff"/>${/* diagram: white background panel */''}
        <rect x="6" y="30" width="96" height="44" rx="8" fill="#e1eaff" stroke="#2563eb"/><text style="fill:#151c2c" x="54" y="57" text-anchor="middle" font-size="13">Processor</text>${/* diagram: the processor box */''}
        <line x1="102" y1="52" x2="182" y2="52" stroke="#3d4760" stroke-width="2"/><text style="fill:#151c2c" x="142" y="44" text-anchor="middle" font-size="11">virtual address</text>${/* diagram: the virtual address line from the processor to the MMU */''}
        <rect x="182" y="30" width="96" height="44" rx="8" fill="#e1eaff" stroke="#2563eb"/><text style="fill:#151c2c" x="230" y="57" text-anchor="middle" font-size="13">MMU</text>${/* diagram: the MMU box */''}
        <line x1="278" y1="44" x2="378" y2="20" stroke="#059669" stroke-width="2"/><text style="fill:#151c2c" x="318" y="22" text-anchor="middle" font-size="11">real address</text>${/* diagram: the green real-address line up to main memory */''}
        <rect x="378" y="4" width="136" height="34" rx="8" fill="#d7f5e8" stroke="#059669"/><text style="fill:#151c2c" x="446" y="26" text-anchor="middle" font-size="13">Main memory</text>${/* diagram: the main memory box */''}
        <line x1="278" y1="62" x2="378" y2="88" stroke="#ea580c" stroke-width="2"/><text style="fill:#151c2c" x="318" y="94" text-anchor="middle" font-size="11">disk address</text>${/* diagram: the orange disk-address line down to secondary memory */''}
        <rect x="378" y="70" width="136" height="34" rx="8" fill="#ffe8d6" stroke="#ea580c"/><text style="fill:#151c2c" x="446" y="92" text-anchor="middle" font-size="13">Secondary memory</text>${/* diagram: the secondary memory box */''}
      </svg>${/* end of the notes diagram */''}

      <h3>Information protection and security</h3>${/* heading for the notes on information protection and security */''}
      <p>The OS must control access to shared programs, data and devices. Four goals:</p>${/* notes paragraph: the OS controls access to shared things, with four goals */''}
      <ul>${/* start of the list of security goals */''}
        <li><b>Availability</b>: the system and its data are usable whenever authorized users need them (broken by a flood of fake requests).</li>${/* notes list item: availability, broken by a flood of fake requests */''}
        <li><b>Confidentiality</b>: only those with permission can read the data (broken by a stolen unencrypted laptop).</li>${/* notes list item: confidentiality, broken by a stolen unencrypted laptop */''}
        <li><b>Data integrity</b>: data is changed only by those allowed to (broken by malware altering records).</li>${/* notes list item: data integrity, broken by malware altering records */''}
        <li><b>Authenticity</b>: users are who they claim and messages come from where they say (broken by a forged email).</li>${/* notes list item: authenticity, broken by a forged email */''}
      </ul>${/* end of the list of security goals */''}
      <p>Common mistake: <i>reading</i> data you should not breaks confidentiality; <i>changing</i> it breaks integrity.</p>${/* notes paragraph: the common mix-up between confidentiality (reading) and integrity (changing) */''}

      <h3>Scheduling and resource management</h3>${/* heading for the notes on scheduling and resource management */''}
      <p>The OS shares the processor, memory and devices among active processes, aiming at three goals:</p>${/* notes paragraph: the OS shares resources among processes with three goals */''}
      <ul>${/* start of the list of scheduling goals */''}
        <li><b>Fairness</b>: processes competing for the same resource, especially jobs of the same kind, get roughly equal and fair access.</li>${/* notes list item: fairness */''}
        <li><b>Differential responsiveness</b>: jobs with different needs get different treatment, decided as conditions change; e.g. quickly run a process that holds an I/O device so it frees the device for others.</li>${/* notes list item: differential responsiveness */''}
        <li><b>Efficiency</b>: maximize throughput, minimize response time and, in time sharing, serve as many users as possible.</li>${/* notes list item: efficiency */''}
      </ul>${/* end of the list of scheduling goals */''}
      <p>Key elements of a typical scheduler:</p>${/* notes paragraph: introduces the key parts of a typical scheduler */''}
      <ul>${/* start of the list of scheduler parts */''}
        <li><b>Long-term queue</b>: new jobs waiting to be admitted. Admission gives a job main memory, so the OS admits jobs only when that will not overcommit memory or the processor.</li>${/* notes list item: the long-term queue and why admission must not overcommit memory */''}
        <li><b>Short-term queue</b>: processes in main memory and ready to run. The short-term scheduler (dispatcher) picks the next one, often by <b>round-robin</b>: each gets a short time slice in turn, and a process whose slice ends goes to the back of the line. Another common policy picks by priority.</li>${/* notes list item: the short-term queue, the dispatcher, round-robin and priority */''}
        <li><b>I/O queues</b>: one per device, holding processes waiting for that device.</li>${/* notes list item: one I/O queue per device */''}
        <li>Every event reaches the OS as a <b>service call</b> (the running process asks, e.g. to read the disk or exit) or an <b>interrupt</b> (timer or device); then the OS picks who runs next.</li>${/* notes list item: every event is a service call or an interrupt, then the OS picks who runs next */''}
      </ul>${/* end of the list of scheduler parts */''}
    `,  // end of the notes text
  });  // closes the object passed to Guide.section
})();  // ends the wrapper function and runs it immediately
