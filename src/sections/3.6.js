// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 3.6 — UNIX SVR4 Process Management
   The OS-inside-the-user-process model, system vs user processes,
   the nine UNIX process states and their transitions, process 0 and
   process 1, the three-part process image (user-level, register and
   system-level context), the process table entry vs the U area, and
   process creation with fork().
   Everything lives inside this IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  /* ------------------------------------------------------------------
     The nine UNIX SVR4 states: display names, seven-state equivalents,
     positions on the transition diagram, and plain-language details.
     ------------------------------------------------------------------ */
  const ST = {  // ST: the nine UNIX process states, keyed by a short id; every step reads names, colours and diagram positions from here
    ur:  { name: 'User Running', lines: ['User Running'], seven: 'Running', sub: 'User Running', x: 300, y: 44, cls: 's-cpu', cls7: 's-cpu', mem: 'main memory', run: 'Now: it holds the processor (user mode).' },  // User Running: executing its own program; seven means its name in the seven-state model; x, y is its box's centre on the diagram
    kr:  { name: 'Kernel Running', lines: ['Kernel Running'], seven: 'Running', sub: 'Kernel Running', x: 300, y: 168, cls: 's-os', cls7: 's-cpu', mem: 'main memory', run: 'Now: it holds the processor (kernel mode).' },  // Kernel Running: the same process running kernel code; violet on the UNIX diagram but blue like Running in the seven-state view
    rim: { name: 'Ready to Run, in Memory', lines: ['Ready to Run,', 'in Memory'], seven: 'Ready', sub: 'Ready in Memory', x: 300, y: 290, cls: 's-proc', cls7: 's-proc', mem: 'main memory', run: 'As soon as the scheduler picks it.' },  // Ready to Run, in Memory: waiting only for the processor; mem says where its image is, run says when it can run
    pre: { name: 'Preempted', lines: ['Preempted'], note: '≈ Ready, in Memory', seven: 'Ready', sub: 'Preempted', x: 560, y: 44, cls: 's-proc', cls7: 's-proc', mem: 'main memory', run: 'As soon as the scheduler picks it again.' },  // Preempted: note puts a small "about the same as Ready, in Memory" line under its name on the diagram
    asl: { name: 'Asleep in Memory', lines: ['Asleep', 'in Memory'], seven: 'Blocked', sub: 'Asleep in Memory', x: 90, y: 168, cls: 's-warn', cls7: 's-warn', mem: 'main memory', run: 'Only after its event happens.' },  // Asleep in Memory: waiting for an event with its image still in main memory; drawn in the warning colour
    rsw: { name: 'Ready to Run, Swapped', lines: ['Ready to Run,', 'Swapped'], seven: 'Ready/Suspend', sub: 'Ready, Swapped', x: 300, y: 410, cls: 's-proc', cls7: 's-proc', dash: true, mem: 'disk (swapped out)', run: 'Only after the swapper brings it back into memory.' },  // Ready to Run, Swapped: ready but on disk; dash: true draws its box with a dashed border
    ssw: { name: 'Sleeping, Swapped', lines: ['Sleeping,', 'Swapped'], seven: 'Blocked/Suspend', sub: 'Sleeping, Swapped', x: 90, y: 410, cls: 's-warn', cls7: 's-warn', dash: true, mem: 'disk (swapped out)', run: 'Only after its event happens AND it is swapped back in.' },  // Sleeping, Swapped: waiting for an event and on disk, also dashed
    cre: { name: 'Created', lines: ['Created'], seven: 'New', sub: 'Created', x: 560, y: 290, cls: 's-panel', cls7: 's-panel', mem: 'being set up by the kernel', run: 'Not yet: the kernel is still building it.' },  // Created: just made by fork() and still being set up, drawn in plain grey
    zom: { name: 'Zombie', lines: ['Zombie'], seven: 'Exit', sub: 'Zombie', x: 560, y: 168, cls: 's-panel', cls7: 's-panel', mem: 'memory freed, record kept', run: 'Never again: it has finished.' },  // Zombie: finished, with only a record left, also plain grey
  };  // closes the ST table
  const ST_INFO = {  // ST_INFO: the longer explanation shown when the student clicks a state on step 2
    ur: 'The process holds the processor and is executing <b>its own program’s instructions</b> in user mode. It leaves this state only by entering the kernel: it makes a system call, an interrupt arrives, or its instruction causes an exception (a fault, such as dividing by zero). All three move it to Kernel Running.',  // explanation of User Running and the three ways out of it
    kr: 'The <b>same process</b> holds the processor, but it is now executing <b>kernel code</b> in kernel mode, on its own kernel stack, because it made a system call or an interrupt arrived. From here it can return to user mode, go to sleep, be preempted on the way back to user mode, or exit.',  // explanation of Kernel Running: the same process running kernel code, and where it can go next
    rim: 'The process is in main memory and could run this instant. It is only waiting for the scheduler to choose it. When chosen, it resumes inside the kernel (Kernel Running), exactly where it stopped.',  // explanation of Ready to Run, in Memory
    pre: 'The process had finished its kernel work and was <b>about to return to user mode</b>, but the kernel found a more important process ready to run and switched to it instead. It waits in the <b>same queue</b> as the Ready to Run, in Memory processes; when chosen again it goes straight back to User Running.',  // explanation of Preempted: it was about to return to user mode when a more important process was chosen
    asl: 'The process cannot continue until some <b>event</b> happens: disk data arriving, a key being pressed, a child finishing. Giving it the processor would be pointless. Its image is still in main memory. This is a blocked state.',  // explanation of Asleep in Memory, a blocked state
    rsw: 'The process is ready to run, but its image is <b>out on disk</b>. Before the kernel can schedule it, the swapper (process 0) must copy it back into main memory.',  // explanation of Ready to Run, Swapped: the swapper must bring it back first
    ssw: 'The process is waiting for an event <b>and</b> its image has been swapped out to disk to free memory. Two things stand between it and the processor. This is a blocked state.',  // explanation of Sleeping, Swapped: two things stand between it and the processor
    cre: 'The process has just been made by <code>fork()</code>. It exists (it has a process table entry and an ID) but is not ready to run yet. If there is enough memory it becomes Ready to Run in Memory; otherwise Ready to Run, Swapped.',  // explanation of Created and the two ways it can leave
    zom: 'The process has called <code>exit</code>. It no longer exists as a running program and its memory is released, but it leaves a small record (exit status and usage times) in the process table for its <b>parent</b> to collect.',  // explanation of Zombie and the record it leaves for its parent
  };  // closes ST_INFO

  /* Transitions: [id, from, to, path, labelX, labelY, anchor, 'label|second line'] */
  const TR = [  // TR: the sixteen arrows of the transition diagram; path is the SVG drawing command for the line, the rest place its label
    ['fork', null, 'cre', 'M716,290 L636,290', 676, 281, 'middle', 'fork'],  // fork: from nothing into Created, drawn coming in from the right edge
    ['enough', 'cre', 'rim', 'M486,290 L376,290', 431, 281, 'middle', 'enough memory'],  // enough memory: Created to Ready to Run, in Memory
    ['notEnough', 'cre', 'rsw', 'M505,317 L352,383', 446, 376, 'start', 'not enough|memory'],  // not enough memory: Created to Ready to Run, Swapped (a "|" in the label starts a second line)
    ['reschedule', 'rim', 'kr', 'M300,263 L300,196', 292, 236, 'end', 'reschedule'],  // reschedule: Ready to Run, in Memory up to Kernel Running
    ['syscall', 'ur', 'kr', 'M284,71 L284,140', 276, 100, 'end', 'system call,|interrupt'],  // system call or interrupt: User Running down to Kernel Running
    ['ret', 'kr', 'ur', 'M316,141 L316,72', 324, 100, 'start', 'return|to user'],  // return to user: Kernel Running back up to User Running
    ['preempt', 'kr', 'pre', 'M374,150 L497,72', 448, 128, 'start', 'preempt'],  // preempt: Kernel Running to Preempted
    ['preRet', 'pre', 'ur', 'M486,44 L376,44', 431, 35, 'middle', 'return to user'],  // return to user: Preempted straight to User Running
    ['exit', 'kr', 'zom', 'M374,168 L485,168', 430, 160, 'middle', 'exit'],  // exit: Kernel Running to Zombie
    ['sleep', 'kr', 'asl', 'M226,168 L165,168', 195, 160, 'middle', 'sleep'],  // sleep: Kernel Running to Asleep in Memory
    ['wakeupMem', 'asl', 'rim', 'M140,195 L236,262', 184, 250, 'end', 'wakeup'],  // wakeup: Asleep in Memory to Ready to Run, in Memory
    ['swapOutSleep', 'asl', 'ssw', 'M90,196 L90,382', 98, 292, 'start', 'swap out'],  // swap out: Asleep in Memory down to Sleeping, Swapped
    ['wakeupSw', 'ssw', 'rsw', 'M165,410 L225,410', 195, 401, 'middle', 'wakeup'],  // wakeup: Sleeping, Swapped to Ready to Run, Swapped
    ['swapOutReady', 'rim', 'rsw', 'M286,318 L286,382', 278, 338, 'end', 'swap out'],  // swap out: Ready to Run, in Memory down to Ready to Run, Swapped
    ['swapIn', 'rsw', 'rim', 'M314,382 L314,318', 322, 372, 'start', 'swap in'],  // swap in: Ready to Run, Swapped back up to Ready to Run, in Memory
    ['intr', 'kr', 'kr', 'M346,195 C 348,240 410,228 375,185', 398, 222, 'start', 'interrupt,|interrupt return'],  // interrupt and interrupt return: a curved loop from Kernel Running back to itself
  ];  // closes the TR table
  const TR_BY = Object.fromEntries(TR.map((t) => [t[0], { id: t[0], from: t[1], to: t[2], label: t[7].replace('|', ' ') }]));  // TR_BY: the same arrows looked up by id, with from, to and a one-line label (the "|" replaced by a space)
  const TR_INFO = {  // TR_INFO: the explanation shown when the student clicks an arrow, or takes it in the drive mode
    fork: 'A parent process calls <code>fork()</code>. The kernel builds a brand-new child process, which starts life in <b>Created</b>.',  // explanation of fork: a parent asks for a child, which starts in Created
    enough: 'There is room in main memory, so the new process becomes <b>Ready to Run, in Memory</b> and joins the processes waiting for the processor.',  // explanation of enough memory
    notEnough: 'On a system that swaps, if memory is short the new process is not loaded yet: it becomes <b>Ready to Run, Swapped</b> and waits on disk.',  // explanation of not enough memory on a system that swaps
    reschedule: 'The scheduler picks this process. It gets the processor in <b>Kernel Running</b>, because every UNIX process leaves and regains the processor from inside the kernel.',  // explanation of reschedule: a process always regains the processor inside the kernel
    syscall: 'The program makes a <b>system call</b>, an interrupt arrives, or an instruction causes an exception (fault). The processor switches to kernel mode, and the <b>same process</b> now runs kernel code. No process switch is needed.',  // explanation of system call or interrupt: a mode switch, with no process switch
    ret: 'The kernel has finished its work, so the process <b>returns to user mode</b> and carries on with its own program.',  // explanation of return to user
    preempt: 'On the way back to user mode the kernel notices a <b>more important process is ready</b>. It preempts this one: the process goes to Preempted and a process switch happens. This return-to-user moment is the only place this kernel preempts.',  // explanation of preempt: the only point where this kernel forces a switch
    preRet: 'The scheduler picks the preempted process again. Its kernel work was already finished, so it goes <b>straight back to user mode</b>.',  // explanation of return to user from Preempted
    exit: 'The process calls <code>exit</code> (a system call, so it is in the kernel). The kernel releases its memory and resources and leaves a <b>Zombie</b> record for the parent.',  // explanation of exit and the Zombie record
    sleep: 'The process must wait for an event, such as data from the disk. It <b>sleeps</b> inside the kernel, and the kernel switches to another process. This switch is <b>voluntary</b> (the process gives up the processor itself), so it is allowed in the middle of kernel code.',  // explanation of sleep: a voluntary switch, allowed in the middle of kernel code
    wakeupMem: 'The awaited event happens (the disk data arrives). The kernel <b>wakes</b> the process: it is now Ready to Run, in Memory.',  // explanation of wakeup while in memory
    swapOutSleep: 'Memory is tight. The swapper copies a sleeping process out to disk: it could not use the processor anyway, so it is a good victim.',  // explanation of swapping out a sleeping process
    wakeupSw: 'The event happens while the process is on disk. It is now ready, but <b>still swapped out</b>: Ready to Run, Swapped.',  // explanation of wakeup while swapped out
    swapOutReady: 'To make room, the swapper can also move a ready process out to disk. It stays ready, but must be swapped back in before it can run.',  // explanation of swapping out a ready process
    swapIn: 'The swapper copies the process back into main memory. Now the scheduler can pick it.',  // explanation of swap in
    intr: 'While a process is in kernel mode an interrupt can arrive. The kernel handles it and returns to what it was doing: the process <b>stays in Kernel Running</b> the whole time.',  // explanation of an interrupt arriving in kernel mode: the process stays in Kernel Running
  };  // closes TR_INFO

  /* Build the transition diagram.  o.onState(id), o.onArrow(id) make parts clickable. */
  function stateDiagram(ctx, o = {}) {  // stateDiagram(): builds the nine-state diagram used on steps 2 and 3; the options can make states and arrows clickable
    const { s } = ctx;  // pulls out ctx.s, the guide helper that creates one SVG element (SVG is the browser's drawing format)
    const W = 144, H = 50;  // W and H: the width and height of every state box
    const svg = s('svg', { viewBox: '0 0 720 450', width: '100%', class: 'sd', role: 'img', 'aria-label': 'UNIX SVR4 process state transition diagram' });  // the empty SVG, 720 by 450 drawing units, stretched to the width of its card
    const back = s('g'), arrowLayer = s('g'), stateLayer = s('g');  // three layers (g = SVG group): background first, arrows next, state boxes last so they sit on top
    svg.append(back, arrowLayer, stateLayer);  // adds the three layers in that order
    back.append(  // fills the background layer
      s('line', { x1: 0, y1: 350, x2: 720, y2: 350, class: 'divide' }),  // a dashed line across the diagram: above it images are in main memory, below it they are on disk
      s('text', { x: 714, y: 342, 'text-anchor': 'end', class: 'zone' }, 'in main memory ↑'),  // label just above the line: in main memory
      s('text', { x: 714, y: 366, 'text-anchor': 'end', class: 'zone' }, 'swapped out to disk ↓'));  // label just below the line: swapped out to disk
    const ar = {}, st = {};  // ar and st will hold each arrow's and each state's parts, so they can be restyled later
    TR.forEach(([id, , , d, lx, ly, anchor, text]) => {  // draws each arrow from the TR table
      const ln = s('path', { d, class: 'ln', 'marker-end': 'url(#arr)' });  // the arrow's line with an arrowhead at its end
      const lab = s('text', { x: lx, y: ly, 'text-anchor': anchor, class: 'lab' });  // the arrow's label, placed and aligned as the table says
      text.split('|').forEach((t, i) => lab.append(s('tspan', { x: lx, dy: i ? 15 : 0 }, t)));  // splits the label at "|" into lines, each 15 units under the one before
      const g = s('g', { class: 'ar' + (o.onArrow ? ' hot' : ''), 'data-id': id }, ln, s('path', { d, class: 'hit' }), lab);  // groups the line, a wide invisible copy (easier to click) and the label; "hot" marks it clickable
      if (o.onArrow) g.addEventListener('click', () => o.onArrow(id));  // if the caller asked for it, clicking the arrow reports its id
      arrowLayer.append(g);  // adds the arrow to the arrow layer
      ar[id] = { g, ln };  // remembers the arrow's group and line
    });  // ends the loop over the arrows
    for (const [id, m] of Object.entries(ST)) {  // draws each of the nine states
      const rect = s('rect', { x: m.x - W / 2, y: m.y - H / 2, width: W, height: H, rx: 12, class: m.cls });  // the state's rounded box, centred on its x, y position and coloured by its class
      const nm = s('text', { x: m.x, y: m.y, class: 'nm' });  // the text element for the state's name, filled in later by setView()
      const sub = s('text', { x: m.x, y: m.y + 13, class: 'sub' });  // the text element for the small grey line under the name (its seven-state detail or note)
      const g = s('g', { class: 'st' + (m.dash ? ' dash' : '') + (o.onState ? ' hot' : ''), 'data-id': id }, rect, nm, sub);  // groups box and text; "dash" gives swapped-out states a dashed border and "hot" marks the state clickable
      if (o.onState) g.addEventListener('click', () => o.onState(id));  // if the caller asked for it, clicking the state reports its id
      stateLayer.append(g);  // adds the state to the top layer
      st[id] = { g, rect, nm, sub };  // remembers the state's group, box and two text elements
    }  // ends the loop over the states
    const api = {  // api: the handle returned to each step, with the drawing and functions to restyle it
      svg,  // the finished SVG, ready to place on the page
      view: 'unix',  // which naming the boxes currently show: "unix" or "seven"
      setView(v) {  // setView(v): relabels and recolours every box with its UNIX name or its seven-state name
        api.view = v;  // remembers the chosen view
        for (const [id, m] of Object.entries(ST)) {  // goes through the nine states
          const x = st[id];  // x holds this state's box and texts
          x.rect.setAttribute('class', v === 'seven' ? m.cls7 : m.cls);  // picks the box colour for the chosen view
          x.nm.replaceChildren();  // empties the name text before writing it again
          if (v === 'seven') {  // seven-state view: the seven-state name large, the UNIX name small underneath
            x.nm.setAttribute('y', m.y - 7);  // moves the name up a little to leave room for the second line
            x.nm.classList.toggle('long', m.seven.length > 12);  // long seven-state names such as Blocked/Suspend get a slightly smaller font
            x.nm.textContent = m.seven;  // writes the seven-state name
            x.sub.textContent = m.sub;  // writes the UNIX name under it
          } else {  // UNIX view
            x.nm.classList.remove('long');  // back to the normal font size
            x.sub.textContent = m.note || '';  // the small second line shows the note, if the state has one (only Preempted does)
            if (m.note) { x.nm.setAttribute('y', m.y - 7); x.nm.textContent = m.lines[0]; }  // with a note, the name moves up and is written on one line above it
            else if (m.lines.length === 1) { x.nm.setAttribute('y', m.y); x.nm.textContent = m.lines[0]; }  // a one-line name sits in the middle of the box
            else { x.nm.setAttribute('y', m.y - 8); m.lines.forEach((t, i) => x.nm.append(s('tspan', { x: m.x, dy: i ? 17 : 0 }, t))); }  // a two-line name is written as two lines (tspan = one line of SVG text), centred as a pair
          }  // ends the choice of view
        }  // ends the loop over the states
      },  // ends setView()
      arrow(id, cls) {  // arrow(id, cls): restyles one arrow; cls is on (just taken), used (taken earlier), dim, avail (can be taken now) or nothing
        const a = ar[id]; if (!a) return;  // finds the arrow; an unknown id is ignored
        a.g.classList.remove('on', 'used', 'dim', 'avail');  // clears any earlier style from it
        if (cls) a.g.classList.add(cls);  // adds the new style, if one was given
        a.ln.setAttribute('marker-end', cls === 'on' ? 'url(#arr-accent)' : cls === 'used' ? 'url(#arr-ok)' : cls === 'avail' ? 'url(#arr-proc)' : 'url(#arr)');  // gives the arrowhead the same colour as the line: accent for on, green for used, teal for avail, plain otherwise
      },  // ends arrow()
      arrows(fn) { Object.keys(ar).forEach((id) => api.arrow(id, fn(id))); },  // arrows(fn): restyles every arrow; fn receives each id and returns the style it should get
      state(id, cls) { const x = st[id]; if (!x) return; x.g.classList.remove('on', 'dim', 'seen'); if (cls) x.g.classList.add(cls); },  // state(id, cls): restyles one state box as on (current), seen (visited), dim or plain
      states(fn) { Object.keys(st).forEach((id) => api.state(id, fn(id))); },  // states(fn): restyles every state box; fn returns the style for each id
    };  // ends the api object
    api.setView(o.view || 'unix');  // draws the labels once, with the view the caller asked for (UNIX names by default)
    return api;  // hands the api back to the step
  }  // ends stateDiagram()

  /* Legend shown under the transition diagram (steps 2 and 3). */
  const diagramKey = (ctx) => ctx.h('div', { class: 's36-key xs', html: '<span><i></i>solid box: image in main memory</span><span><i class="k-dash"></i>dashed box: image swapped out to disk</span><span>arrow: a transition, labelled with its cause</span>' });  // diagramKey(): the legend under the diagram: solid box in memory, dashed box on disk, and what an arrow means

  /* ------------------------------------------------------------------
     fork() scene: the kernel's view (process table, memory images,
     open-file counts), redrawn from scratch for each frame f:
       f.slot  'free' | 'reserved' | 'pid' | 'ready'   (process table slot 3)
       f.image true once the child's image has been copied
       f.files 1 or 2 (users of each open file)
       f.hot   which part to highlight: 'slot' | 'image' | 'files' | null
     ------------------------------------------------------------------ */
  function forkScene(ctx) {  // forkScene(): builds the step 6 picture of the kernel's tables during fork(); draw(f) repaints it for one frame
    const { s } = ctx;  // pulls out ctx.s, the SVG element maker
    const svg = s('svg', { viewBox: '0 0 560 252', width: '100%', role: 'img', 'aria-label': 'Kernel tables during fork: process table, memory images and open files' });  // the empty SVG, 560 by 252 drawing units, with a spoken description for screen readers
    const T = (x, y, txt, o = {}) => s('text', Object.assign({ x, y, 'font-size': 13 }, o), txt);  // T(): a short helper that makes one text label at x, y (font size 13 unless the options say otherwise)
    function draw(f) {  // draw(f): repaints the whole picture from the frame object f every time the player moves
      const kids = [];  // kids collects every shape for this frame
      // ---- process table ----
      kids.push(T(8, 16, 'Process table', { 'font-weight': 800 }));  // heading over the process table column
      const rows = [['0', 'PID 0 · swapper'], ['1', 'PID 1 · init'], ['2', 'PID 812 · parent'], ['3', null], ['4', null]];  // the five process-table slots: 0 is the swapper, 1 is init, 2 is the parent (PID 812); slots 3 and 4 start empty
      rows.forEach(([slot, txt], i) => {  // draws each slot
        const y = 26 + i * 36;  // y is this slot's top edge
        let label = txt, cls = 's-panel', extra = {};  // label and colour start at their defaults (grey panel); extra is spare room for more text options
        if (i === 2) cls = 's-proc';  // the parent's slot is teal, like a user process
        if (i === 3) {  // slot 3 is the one fork() fills in, so its look follows the frame
          if (f.slot === 'reserved') { label = 'reserved…'; cls = 's-accent'; }  // step 1: the kernel has claimed the slot but it holds no process yet
          else if (f.slot === 'pid') { label = 'PID 813 · child'; cls = 's-proc'; }  // step 2 onward: the slot now carries the child's ID, 813
          else if (f.slot === 'ready') { label = 'PID 813 · child'; cls = 's-proc'; }  // from step 5: the child is ready to run, shown the same way
          else if (f.slot === 'zombie') { label = 'PID 813 · zombie'; cls = 's-panel'; }  // after the child exits, the slot holds only a zombie record
        }  // ends the slot 3 choices
        const hot = i === 3 && f.hot === 'slot';  // hot is true when this frame highlights slot 3
        kids.push(s('rect', { x: 8, y, width: 190, height: 30, rx: 7, class: cls + (hot ? ' s36-hot' : ''), 'stroke-width': hot ? 3.5 : 1.5 }),  // the slot's rounded box, with a thick accent border while highlighted
          T(18, y + 20, slot, { class: 's-sub', 'font-weight': 800 }),  // the slot number in grey on the left
          T(36, y + 20, label || 'free', Object.assign({ 'font-weight': label ? 700 : 400 }, label ? {} : { class: 's-sub' }, extra)));  // the slot's contents, or a grey "free" when it is empty
      });  // ends the loop over the slots
      if (f.cSt) kids.push(T(8, 222, 'slot 3 status: ' + f.cSt, { 'font-weight': 700, style: f.hot === 'slot' && f.slot !== 'pid' ? 'fill:var(--accent)' : 'fill:var(--ink-2)' }));  // once the child exists, a line under the table spells out slot 3's state, in the accent colour while it is being changed
      // ---- memory images ----
      kids.push(T(214, 16, 'Main memory', { 'font-weight': 800 }));  // heading over the memory column
      const img = (x, who, on, hot) => {  // img(): draws one process image in main memory; on says whether it exists and hot whether to highlight it
        const gone = (a, b) => [s('rect', { x, y: 26, width: 104, height: 160, rx: 9, class: 's-muted', 'stroke-dasharray': '6 4', 'stroke-width': hot ? 3 : 1.5 }), T(x + 52, 104, a, { 'text-anchor': 'middle', class: 's-sub' }), T(x + 52, 121, b, { 'text-anchor': 'middle', class: 's-sub' })];  // gone(): an empty dashed outline with two grey lines of text, used when there is no image to show
        if (on === 'freed') return gone('image freed', '(zombie)');  // after exit the child's image has been freed, leaving only the zombie record in the table
        if (!on) return gone('no child', 'image yet');  // before step 3 there is no child image yet
        const parts = [s('rect', { x, y: 26, width: 104, height: 160, rx: 9, class: 's-proc', 'stroke-width': hot ? 3.5 : 2 }), T(x + 52, 45, who, { 'text-anchor': 'middle', 'font-weight': 800 })];  // a real image: a teal outline with the owner's name at the top
        ['text', 'data', 'user stack'].forEach((seg, k) => parts.push(  // inside it, three smaller boxes for its parts: text (the program's instructions), data and user stack
          s('rect', { x: x + 8, y: 54 + k * 43, width: 88, height: 36, rx: 6, class: 's-mem', 'stroke-width': 1.5 }),  // the box for one part
          T(x + 52, 77 + k * 43, seg, { 'text-anchor': 'middle', 'font-weight': 650 })));  // the part's name, centred in its box
        return parts;  // hands back the image's shapes
      };  // ends img()
      kids.push(...img(214, 'PID 812', true, false), ...img(340, f.cImg === 'ls' ? '813 · now ls' : 'PID 813', f.cImg === 'freed' ? 'freed' : f.image, f.hot === 'image'));  // draws the parent's image and the child's (renamed "now ls" after exec, freed after exit)
      if (f.image && f.hot === 'image' && !f.cImg) kids.push(s('line', { x1: 319, y1: 106, x2: 336, y2: 106, class: 's-line', 'marker-end': 'url(#arr-accent)', style: 'stroke:var(--accent)' }), T(327, 22, 'copy', { 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--accent)' }));  // while the copy is happening, an accent arrow labelled "copy" points from the parent's image to the child's
      // shared memory: one region, linked (not copied)
      kids.push(s('line', { x1: 266, y1: 186, x2: 296, y2: 212, class: 's-line', 'stroke-dasharray': '4 3' }));  // a dashed link from the parent's image down to the shared memory region
      // exec and exit both detach the child from the shared region
      if (f.image && !f.cImg) kids.push(s('line', { x1: 392, y1: 186, x2: 362, y2: 212, class: 's-line', 'stroke-dasharray': '4 3' }));  // once the child exists (and until exec or exit), a second dashed link joins the child to the same region
      kids.push(s('rect', { x: 242, y: 212, width: 174, height: 32, rx: 7, class: 's-io', 'stroke-width': f.hot === 'image' ? 3 : 1.5 }),  // the shared memory box under the two images, highlighted during the copy step
        T(329, 233, f.image ? 'shared memory (1 copy)' : 'shared memory', { 'text-anchor': 'middle', 'font-weight': 700 }));  // its label: after fork it says there is still only one copy
      // ---- open files ----
      kids.push(T(458, 16, 'Open files', { 'font-weight': 800 }));  // heading over the open-files column
      ['terminal', 'notes.txt'].forEach((name, k) => {  // draws the two files the parent has open: its terminal and a text file
        const y = 26 + k * 72, hot = f.hot === 'files';  // y is this file's top edge; hot is true when this frame highlights the files
        kids.push(s('rect', { x: 458, y, width: 96, height: 60, rx: 8, class: 's-io', 'stroke-width': hot ? 3.5 : 1.5 }),  // the file's box, with a thick border while highlighted
          T(506, y + 23, name, { 'text-anchor': 'middle', 'font-weight': 700 }),  // the file's name
          T(506, y + 45, 'count: ' + f.files, { 'text-anchor': 'middle', 'font-weight': 800, style: hot ? 'fill:var(--accent)' : '' }));  // its count of users: 1 before fork, 2 once the child shares it (shown in the accent colour while highlighted)
      });  // ends the loop over the files
      kids.push(T(506, 184, 'shared by parent', { 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }), T(506, 200, f.files > 1 ? 'and child' : 'only', { 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }));  // a two-line note under the files: shared by the parent only, or by parent and child
      svg.replaceChildren(...kids);  // swaps the new drawing into the SVG in one step, so it never flickers half-drawn
    }  // ends draw()
    return { svg, draw };  // hands back the drawing and its draw() function
  }  // ends forkScene()

  Guide.section({  // registers this section with the guide: its title, glossary terms, styles, the nine steps and the notes
    id: '3.6',  // the section number; the guide uses it for the address, the menu and the CSS class sec-3-6
    title: 'UNIX SVR4 Process Management',  // the full title shown at the top of the section
    short: 'UNIX SVR4 processes',  // the short title used where space is tight
    summary: 'A real OS up close: UNIX SVR4’s nine process states, its three-part process image, and fork().',  // a one-sentence summary: nine states, a three-part image and fork()
    objectives: [  // learning objectives: what the student should be able to do after this section
      'Explain how UNIX SVR4 runs most kernel code inside user processes, and tell system processes from user processes.',  // objective 1: how SVR4 runs kernel code inside user processes, and system versus user processes
      'Name the nine UNIX process states, map each onto the seven-state model, and explain why Preempted is a separate state.',  // objective 2: name the nine states, map them to the seven-state model, and explain Preempted
      'Trace a process through the UNIX transition diagram, including sleeping, swapping, preemption and becoming a zombie.',  // objective 3: trace a process through the transition diagram
      'Describe the process image as user-level, register and system-level context, and say which fields live in the process table entry and which in the U area.',  // objective 4: the three kinds of context, and process table entry versus U area
      'List the six things the kernel does during fork(), name its three choices afterwards, and predict what a program that calls fork() prints.',  // objective 5: the six steps of fork(), its three choices afterwards, and predicting a fork program's output
    ],  // ends the objectives list
    terms: [  // glossary terms for this section: each is [term, definition]; dotted words in the steps show these definitions
      ['UNIX System V Release 4 (SVR4)', 'An influential release of AT&T’s UNIX, from the late 1980s, that combined features of several UNIX families. Its process design is the classic UNIX model.'],  // glossary entry: defines SVR4, the classic UNIX release this section studies
      ['System call', 'A request a running program makes to the kernel for a service it may not perform itself, such as reading a file. It switches the processor into kernel mode.'],  // glossary entry: defines a system call
      ['System process', 'In UNIX, a process that runs only in kernel mode and carries out operating-system housekeeping, such as allocating memory or swapping processes in and out.'],  // glossary entry: defines a UNIX system process
      ['User process', 'In UNIX, a process that runs a user’s program in user mode and switches into kernel mode, still as the same process, whenever it makes a system call, causes an exception (fault) or an interrupt arrives.'],  // glossary entry: defines a UNIX user process
      ['Nonpreemptible kernel', 'A kernel that never forces a process off the processor while that process is executing kernel code; forced switches wait for a safe point, such as the return to user mode. A process may still give up the processor voluntarily in the kernel, by sleeping.'],  // glossary entry: defines a nonpreemptible kernel
      ['Preempted state', 'The UNIX state of a process that was about to return from kernel mode to user mode when the kernel switched to a more important process instead. It waits just like a ready process.'],  // glossary entry: defines the Preempted state
      ['Zombie', 'A process that has finished. Its memory is gone, but a small record (its exit status and usage totals) stays in the process table until its parent collects it.'],  // glossary entry: defines a zombie process
      ['Swapper (process 0)', 'The first process, built by the kernel itself when the system boots. It is a system process whose job is to move process images between main memory and disk.'],  // glossary entry: defines the swapper, process 0
      ['init (process 1)', 'The second process, created by process 0 at boot. Every other process is its descendant; it starts a process for each user who logs in.'],  // glossary entry: defines init, process 1
      ['User-level context', 'The part of a UNIX process image the program itself sees: its machine instructions (text), its data, its user stack and any shared memory.'],  // glossary entry: defines user-level context
      ['Register context', 'The processor register values that belong to a process: program counter, processor status register, stack pointer and general-purpose registers. Saved when the process stops running.'],  // glossary entry: defines register context
      ['System-level context', 'The part of a UNIX process image only the kernel uses: the process table entry, the U area, the per-process region table and the kernel stack.'],  // glossary entry: defines system-level context
      ['Process table entry', 'The kernel’s always-reachable record for one process: its state, IDs, priority, pending signals, the event it sleeps on and where its image is.'],  // glossary entry: defines the process table entry
      ['U area (user area)', 'A per-process kernel record holding information the kernel needs only while that process is running, such as its open-file table and system-call parameters.'],  // glossary entry: defines the U area
      ['Per-process region table', 'A kernel table describing the memory regions (text, data, stack) of one process: how its virtual addresses map to physical memory and whether each region is read-only or writable.'],  // glossary entry: defines the per-process region table
      ['Kernel stack', 'A second, private stack a process uses while it executes kernel code, holding the kernel functions’ local variables and return addresses.'],  // glossary entry: defines the kernel stack
      ['Shared memory', 'A region of memory that two or more processes can all read and write, used to pass data between them quickly.'],  // glossary entry: defines shared memory
      ['Signal', 'A short software notification the kernel delivers to a process, such as “your child has finished” or “please terminate”.'],  // glossary entry: defines a signal
      ['fork()', 'The UNIX system call that creates a new process as an almost exact copy of the caller. It returns the child’s process ID to the parent and 0 to the child.'],  // glossary entry: defines fork()
      ['exec', 'A family of UNIX system calls that replaces the calling process’s program with a new program loaded from a file. The process ID stays the same.'],  // glossary entry: defines the exec family of calls
    ],  // ends the glossary terms

    css: ` /* the section's own style rules start here; the guide adds them to the page when the section is registered */
      /* ---- the nine-state transition diagram ---- */
      /* shell workaround: the eyebrow is nowrap, and this long section title would force the canvas wider than a phone */
      .sec-3-6 .step-eyebrow { contain: inline-size; } /* stops the step's small heading line from forcing the page wider than a phone screen */
      .sec-3-6 svg.sd { display: block; max-height: 100%; } /* the state diagram fills its card's width but never grows taller than the space it has */
      .sec-3-6 .sd .divide { stroke: var(--line-2); stroke-width: 1.5; stroke-dasharray: 6 5; } /* the dashed memory/disk dividing line: thin and grey */
      .sec-3-6 .sd .zone { font-size: 13px; font-weight: 700; fill: var(--muted); } /* the "in main memory" and "swapped out to disk" labels: small, bold, grey */
      .sec-3-6 .st rect { stroke-width: 2.2; transition: stroke-width .15s, opacity .2s; } /* state box outlines: medium thickness, changing smoothly when a box is picked or dimmed */
      .sec-3-6 .st.dash rect { stroke-dasharray: 7 4; } /* swapped-out states get a dashed outline, matching the legend */
      .sec-3-6 .st text { text-anchor: middle; dominant-baseline: central; pointer-events: none; } /* state text is centred on its box, and clicks pass through the text to the box underneath */
      .sec-3-6 .st text.nm { font-size: 15px; font-weight: 800; } /* the state's name: large and bold */
      .sec-3-6 .st text.nm.long { font-size: 13.5px; } /* long seven-state names get a slightly smaller font so they fit the box */
      .sec-3-6 .st text.sub { font-size: 12.5px; font-weight: 600; fill: var(--muted); } /* the small grey line under the name */
      .sec-3-6 .st.hot { cursor: pointer; } /* clickable state boxes show a pointing-hand cursor */
      .sec-3-6 .st.hot:hover rect { stroke-width: 3.5; } /* hovering over a clickable state thickens its outline */
      .sec-3-6 .st.on rect { stroke-width: 5; } /* the current state gets a very thick outline */
      .sec-3-6 .st.seen rect { stroke-width: 3; } /* states visited earlier keep a medium-thick outline */
      .sec-3-6 .st.dim { opacity: .32; } /* dimmed states fade into the background so the chosen ones stand out */
      .sec-3-6 .ar .ln { fill: none; stroke: var(--ink-2); stroke-width: 2; opacity: .8; } /* arrow lines: grey, 2 units wide, slightly see-through */
      .sec-3-6 .ar .hit { fill: none; stroke: transparent; stroke-width: 16; } /* the wide invisible copy of each arrow that makes it easy to click */
      .sec-3-6 .ar .lab { font-size: 13px; font-weight: 650; fill: var(--ink-2); } /* arrow labels: small, semi-bold, dark grey */
      .sec-3-6 .ar.hot { cursor: pointer; } /* clickable arrows show a pointing-hand cursor */
      .sec-3-6 .ar.hot:hover .ln { stroke: var(--accent); opacity: 1; stroke-width: 3; } /* hovering over a clickable arrow turns it accent-coloured and thicker */
      .sec-3-6 .ar.on .ln { stroke: var(--accent); opacity: 1; stroke-width: 3.5; } /* the arrow just taken (or picked) is thick and accent-coloured */
      .sec-3-6 .ar.on .lab { fill: var(--accent); font-weight: 800; } /* and its label turns accent-coloured and bold */
      .sec-3-6 .ar.used .ln { stroke: var(--ok); opacity: .9; stroke-width: 2.5; } /* arrows taken earlier turn green */
      .sec-3-6 .ar.avail .ln { stroke: var(--proc); opacity: 1; stroke-width: 3; stroke-dasharray: 6 4; } /* arrows the student may take next are teal and dashed */
      .sec-3-6 .ar.avail .lab { fill: var(--proc); font-weight: 800; } /* and their labels are teal and bold */
      .sec-3-6 .ar.dim { opacity: .28; } /* dimmed arrows fade into the background */
      .sec-3-6 .diag-card { display: grid; place-items: center; align-content: center; gap: 10px; padding: 8px 10px; } /* the card holding the diagram centres it and its legend */
      .sec-3-6 .s36-key { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 18px; color: var(--ink-2); font-weight: 600; } /* the legend row: small items, centred, wrapping onto a second line if needed */
      .sec-3-6 .s36-key i { display: inline-block; width: 24px; height: 14px; border: 2px solid var(--ink-2); border-radius: 4px; vertical-align: -2px; margin-right: 6px; } /* the little sample box drawn in front of each legend item */
      .sec-3-6 .s36-key i.k-dash { border-style: dashed; } /* the dashed sample box, for swapped-out states */
      /* ---- step 1: mode timeline ---- */
      .sec-3-6 .lane-u { fill: var(--panel-2); stroke: var(--line); } /* the user-mode lane of the step 1 timeline: light grey */
      .sec-3-6 .lane-k { fill: color-mix(in srgb, var(--os-bg) 70%, transparent); stroke: color-mix(in srgb, var(--os) 30%, transparent); } /* the kernel-mode lane: a faint violet wash with a faint violet border */
      .sec-3-6 .seg rect { stroke-width: 2; transition: stroke-width .15s; } /* timeline blocks: medium outline that changes smoothly */
      .sec-3-6 .seg.hot { cursor: pointer; } /* timeline blocks are clickable */
      .sec-3-6 .seg.hot:hover rect { stroke-width: 3.2; } /* hovering over a block thickens its outline */
      .sec-3-6 .seg.on rect { stroke-width: 4.5; stroke: var(--accent); } /* the block being explained gets a thick accent outline */
      .sec-3-6 .sw-tick { stroke: var(--intr); stroke-width: 2.5; } /* the red tick marks where a process switch happens */
      .sec-3-6 .s36-cap { min-height: 5.6em; } /* gives caption boxes a fixed minimum height so the layout does not jump as captions change length */
      /* ---- step 2: explorer ---- */
      .sec-3-6 .s36-detail { flex: 1; min-height: 0; } /* the step 2 detail card grows to fill the space under the controls */
      .sec-3-6 .s36-detail h3 { margin-bottom: 6px; } /* a little space under the detail card's heading */
      /* ---- step 3: tour / drive ---- */
      .sec-3-6 .s36-trail { row-gap: 4px; } /* the step 3 path strip: rows of chips a little apart */
      .sec-3-6 .s36-trail .chip { font-size: 12.5px; padding: 0 7px; } /* smaller chips in the path strip */
      .sec-3-6 .s36-miss { padding-left: 20px; } /* indents the step 3 missions list */
      .sec-3-6 .s36-miss li.done { color: var(--ok); font-weight: 700; } /* a finished mission turns green and bold */
      /* ---- step 4: image layers ---- */
      .sec-3-6 .s36-band { padding: 8px 10px; } /* the three layer bands on step 4 get tight padding */
      .sec-3-6 .s36-bandh { gap: 6px; margin-bottom: 6px; } /* the band's heading row: small gap and a little space underneath */
      .sec-3-6 .s36-piece { font-size: 14px; padding: 6px 6px; min-height: 48px; cursor: pointer; line-height: 1.2; color: var(--ink); transition: opacity .2s, box-shadow .15s; } /* the clickable image pieces on step 4: readable size, at least 48 pixels tall, fading and glowing smoothly */
      .sec-3-6 .s36-piece:hover { box-shadow: 0 0 0 2px var(--accent); } /* hovering over a piece draws an accent ring around it */
      .sec-3-6 .s36-piece.on { box-shadow: 0 0 0 3px var(--accent); } /* the picked piece keeps a thicker accent ring */
      .sec-3-6 .s36-piece.dim { opacity: .4; } /* pieces not involved in the chosen moment fade out */
      /* ---- step 5: sort game ---- */
      .sec-3-6 .s36-field { font-size: 24px; font-weight: 800; letter-spacing: -.01em; color: var(--chc); min-height: 32px; } /* the field name being sorted on step 5: large, bold, in the highlight colour */
      .sec-3-6 .s36-fb { min-height: 4.4em; font-size: 14.5px; } /* the feedback box keeps a fixed minimum height so the buttons do not jump */
      .sec-3-6 .s36-bins { grid-template-columns: minmax(0, 5fr) minmax(0, 3fr) minmax(0, 5fr); } /* the three bins: the "Both" column is thinner than the two main ones */
      .sec-3-6 .s36-chips { align-content: flex-start; row-gap: 5px; } /* sorted chips gather at the top of each bin, a little apart */
      .sec-3-6 .s36-chips:empty::before { content: 'Sorted fields land here.'; font-size: 13px; color: var(--muted); } /* an empty bin shows a grey hint that sorted fields land there */
      .sec-3-6 .s36-chip { border: 0; cursor: pointer; font-family: inherit; } /* sorted chips are buttons without a border that can be clicked to review them */
      .sec-3-6 .s36-ok { color: var(--ok); font-weight: 800; } /* the "Right" word in feedback: green and bold */
      .sec-3-6 .s36-bad { color: var(--bad); font-weight: 800; } /* the "Not ..." words in feedback: red and bold */
      .sec-3-6 .card.accent { background: var(--accent-bg); border-color: color-mix(in srgb, var(--accent) 35%, transparent); } /* an accent-tinted card style used by the bins */
      /* ---- step 6: fork ---- */
      .sec-3-6 .s36-var { font-weight: 800; font-size: 14px; padding: 1px 9px; border-radius: 7px; background: var(--hl); } /* the pid = value badge on step 6: bold on a highlighted background */
      .sec-3-6 .s36-var:empty { display: none; } /* the badge disappears while it has nothing to show */
      .sec-3-6 .s36-empty { border: 2px dashed var(--line-2); border-radius: 10px; height: 191px; display: grid; place-items: center; color: var(--muted); font-size: 14.5px; } /* the dashed empty box shown where the child's code will appear, the same height as a code panel so nothing jumps */
      .sec-3-6 .s36-term { font-size: 13.5px; background: var(--panel-3); border-radius: 10px; padding: 6px 10px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; } /* the terminal strip: small code font on grey, with the printed lines side by side */
      .sec-3-6 .s36-out { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 0 7px; } /* each printed line sits in its own small white box */
      .sec-3-6 .s36-fork pre.code { flex: none; } /* the code panels on step 6 keep their natural height instead of stretching */
      .sec-3-6 svg .s36-hot { stroke: var(--accent); } /* highlighted parts of the fork picture get an accent outline */
      .sec-3-6 .s36-six { gap: 5px; } /* the row of six numbered step chips: small gaps */
      .sec-3-6 .s36-six .chip { font-size: 12.5px; padding: 1px 7px; } /* and small chips */
      /* ---- step 7: predict ---- */
      .sec-3-6 .s36-n { width: 40px; padding: 0; font-size: 15px; } /* the number buttons 1 to 8 on step 7: small and square */
      .sec-3-6 .s36-n.s36-right { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); } /* after checking, the right number's button turns green */
      .sec-3-6 .callout.os { background: var(--os-bg); border-color: var(--os); } /* a violet callout style used for the note about process 0 and init */
      .sec-3-6 .callout.os::before { color: var(--os); } /* its small heading is violet too */
    `,  // end of the section's style rules

    steps: [  // the nine steps of the section, in order
      /* ---------------- 1. Big picture: the kernel runs inside user processes ---------------- */
      {  // step 1 (Big Picture): in SVR4 the kernel runs inside user processes, shown on a mode timeline
        title: 'UNIX SVR4: the kernel runs inside your processes',  // the title shown at the top of step 1
        kind: 'story',  // kind "story" labels the step as the Big Picture and keeps it in the short course path
        html: `${/* the step's fixed HTML, placed on the page before render() runs */''}
          <div class="split l fill">${/* two columns, the left one smaller (on a phone they stack) */''}
            <div class="stack">${/* left column: the explanation */''}
              <p class="lead m0">In <span class="t">SVR4</span>, most of the operating system runs <b>inside your own processes</b>: <span class="t" data-t="Execution within user processes">design 2 of section 3.5</span>.</p>${/* opening paragraph: in SVR4 most of the OS runs inside your own processes, design 2 from section 3.5 */''}
              <p class="m0">There is no separate “OS process” to send requests to. On a <span class="t">system call</span> or an <span class="t">interrupt</span>, the <b>same process</b> flips from <span class="t">user mode</span> into <span class="t">kernel mode</span> and runs the kernel’s code itself.</p>${/* paragraph: no separate OS process; the same process flips into kernel mode on a system call or interrupt */''}
              <div class="grid-2">${/* two cards side by side */''}
                <div class="card os tight">${/* violet card for system processes */''}
                  <h4>System processes</h4>${/* its heading */''}
                  <p class="small m0">Run <b>only in kernel mode</b>, executing OS housekeeping code such as memory allocation and swapping. Example: process 0, the <span class="t">swapper</span>.</p>${/* system processes run only in kernel mode, doing housekeeping such as swapping */''}
                </div>${/* end of the system-process card */''}
                <div class="card proc tight">${/* teal card for user processes */''}
                  <h4>User processes</h4>${/* its heading */''}
                  <p class="small m0">Run programs and utilities in <b>user mode</b>, and switch to <b>kernel mode</b> to run kernel instructions on a system call, an exception (fault) or an interrupt.</p>${/* user processes run programs in user mode and switch to kernel mode on a system call, fault or interrupt */''}
                </div>${/* end of the user-process card */''}
              </div>${/* end of the two cards */''}
              <div class="callout analogy m0" data-label="Analogy">A library lends you a staff badge. You walk into the back room yourself, follow the library’s procedure, then hand the badge back. Same person, extra privileges, the library’s rules.</div>${/* analogy box: a borrowed staff badge in a library */''}
            </div>${/* end of the left column */''}
            <div class="card white stack s36-tl"></div>${/* right column: an empty white card that render() fills with the timeline */''}
          </div>`,  // end of the two-column layout and of the step's HTML
        render(el, ctx) {  // render(): builds the timeline inside that card when the student arrives on step 1
          const { h, s } = ctx;  // pulls out ctx.h (page element maker) and ctx.s (SVG element maker)
          const host = el.querySelector('.s36-tl');  // finds the empty card the HTML left for the timeline
          const U = { y: 16, hh: 44 }, K = { y: 118, hh: 44 };  // U and K: the top edge and height of the user-mode lane and of the kernel-mode lane
          // [id, lane, x1, x2, line1, line2, colour class, narration]
          const SEGS = [  // SEGS: the seven moments on the timeline, each a block in one lane with a caption
            ['a', 'u', 104, 200, 'PID 812', 'editor code', 's-proc', '<b>PID 812 in user mode.</b> The editor runs its own instructions. It can touch only its own memory, and privileged instructions are off limits.'],  // moment 1: PID 812, an editor, runs its own code in user mode
            ['b', 'k', 200, 290, 'PID 812', 'kernel code', 's-proc', '<b>Still PID 812, now in kernel mode.</b> The editor called <code>read()</code>. The processor switched to kernel mode and PID 812 itself runs the kernel’s file-reading code on its own kernel stack. No other process was needed.'],  // moment 2: the same PID 812 runs the kernel's read code after calling read()
            ['c', 'k', 290, 380, 'PID 0', 'swapper', 's-os', '<b>PID 0, the swapper: a system process.</b> PID 812 went to sleep to wait for the disk, so the kernel switched processes. The swapper runs only in kernel mode and moves process images between memory and disk. It never runs user code.'],  // moment 3: PID 0, the swapper, a system process, runs while PID 812 sleeps
            ['d', 'k', 380, 446, 'PID 905', 'resumes', 's-proc', '<b>PID 905 resumes inside the kernel.</b> The scheduler picked PID 905. A UNIX process always gets the processor back in kernel mode, exactly where it stopped, and only then returns to user mode.'],  // moment 4: PID 905 resumes inside the kernel, where it stopped
            ['e', 'u', 446, 540, 'PID 905', 'compiler code', 's-proc', '<b>PID 905 in user mode.</b> The compiler runs its own code, as PID 812 did at the start.'],  // moment 5: PID 905, a compiler, runs its own code in user mode
            ['f', 'k', 540, 612, 'PID 905', 'interrupt', 's-proc', '<b>PID 905 handles an interrupt that is not even its own.</b> The disk finishes PID 812’s read and interrupts. The kernel runs the handler inside whichever process is running (PID 905): it wakes PID 812, which becomes ready. No process switch needed.'],  // moment 6: PID 905 handles the disk interrupt meant for PID 812, without a process switch
            ['g', 'u', 612, 672, 'PID 905', '', 's-proc', '<b>Back to PID 905’s own code.</b> The interrupt return puts it back where it was. PID 812 will run again when the scheduler picks it.'],  // moment 7: PID 905 is back in its own code
          ];  // ends SEGS
          const svg = s('svg', { viewBox: '0 0 680 222', width: '100%', role: 'img', 'aria-label': 'Timeline of one processor switching between user mode and kernel mode' });  // the empty timeline drawing, 680 by 222 units
          svg.append(  // adds the fixed background parts
            s('rect', { x: 100, y: U.y - 8, width: 576, height: U.hh + 16, rx: 10, class: 'lane-u' }),  // the grey user-mode lane
            s('rect', { x: 100, y: K.y - 8, width: 576, height: K.hh + 16, rx: 10, class: 'lane-k' }),  // the violet kernel-mode lane under it
            s('text', { x: 90, y: U.y + 17, 'text-anchor': 'end', 'font-weight': 800, 'font-size': 15 }, 'User'),  // the word "User" at the left of the top lane
            s('text', { x: 90, y: U.y + 34, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'mode'),  // with "mode" underneath
            s('text', { x: 90, y: K.y + 17, 'text-anchor': 'end', 'font-weight': 800, 'font-size': 15, style: 'fill:var(--os)' }, 'Kernel'),  // the word "Kernel" at the left of the lower lane, in violet
            s('text', { x: 90, y: K.y + 34, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'mode'),  // with "mode" underneath
            s('line', { x1: 104, y1: 198, x2: 668, y2: 198, class: 's-line', 'marker-end': 'url(#arr)' }),  // the time axis along the bottom, with an arrowhead
            s('text', { x: 104, y: 216, 'font-size': 13, class: 's-sub' }, 'time →  (one processor, a few milliseconds)'),  // its caption: time runs to the right on one processor, over a few milliseconds
          );  // ends the background parts
          // mode-change connectors between the lanes
          [[200, 'down', 'system call'], [446, 'up', 'return'], [540, 'down', 'interrupt'], [612, 'up', 'return']].forEach(([x, dir, lab]) => {  // four dashed arrows where the mode changes: a system call down, a return up, an interrupt down, a return up
            svg.append(s('line', { x1: x, y1: dir === 'down' ? U.y + U.hh : K.y, x2: x, y2: dir === 'down' ? K.y - 2 : U.y + U.hh + 2, class: 's-line', 'stroke-dasharray': '4 3', 'marker-end': 'url(#arr)' }),  // each arrow runs from one lane to the other at time x
              s('text', { x: x + 6, y: 94, 'font-size': 13, 'font-weight': 650, style: 'fill:var(--ink-2)' }, lab));  // with its cause written between the lanes
          });  // ends the mode-change arrows
          // process switches happen inside the kernel lane
          [290, 380].forEach((x) => svg.append(  // two red ticks in the kernel lane at the moments the processor switches process
            s('line', { x1: x, y1: K.y - 6, x2: x, y2: K.y + K.hh + 6, class: 'sw-tick' }),  // the tick itself, a short red line across the kernel lane
            s('text', { x, y: K.y + K.hh + 22, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--intr)' }, 'switch')));  // the word "switch" under each tick
          const segEls = {};  // segEls will hold each block's group, so it can be highlighted later
          SEGS.forEach(([id, lane, x1, x2, l1, l2, cls]) => {  // draws each moment as a block
            const L = lane === 'u' ? U : K;  // L is the lane the block sits in
            const cx = (x1 + x2) / 2;  // cx is the middle of the block
            const g = s('g', { class: 'seg hot', 'data-click': id },  // a clickable group for the block
              s('rect', { x: x1 + 1.5, y: L.y, width: x2 - x1 - 3, height: L.hh, rx: 7, class: cls }),  // the block's rectangle, teal for a user process and violet for the swapper
              s('text', { x: cx, y: l2 ? L.y + 18 : L.y + 27, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, l1),  // the process ID in bold (centred if there is no second line)
              l2 ? s('text', { x: cx, y: L.y + 34, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, l2) : null);  // the second line in grey, such as "editor code", when there is one
            g.addEventListener('click', () => pick(SEGS.findIndex((q) => q[0] === id)));  // clicking the block jumps the caption to that moment
            svg.append(g);  // adds the block to the drawing
            segEls[id] = g;  // remembers the block's group under its id
          });  // ends the loop over the blocks
          const cap = h('div', { class: 'player-cap s36-cap' });  // the caption box under the timeline, with a fixed minimum height
          const count = h('span', { class: 'xs muted b' });  // the small "Moment n of 7" counter
          const prev = h('button', { class: 'btn sm', type: 'button', onclick: () => pick(cur - 1) }, '◀ Back');  // the Back button, one moment earlier
          const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => pick(cur + 1) }, 'Next moment ▶');  // the Next moment button, one moment later
          let cur = 0;  // cur is the moment being explained, starting at the first
          function pick(i) {  // pick(i): shows moment i: highlights its block and writes its caption
            cur = ctx.util.clamp(i, 0, SEGS.length - 1);  // keeps i between the first and last moment (clamp = limit a number to a range)
            SEGS.forEach(([id], k) => segEls[id].classList.toggle('on', k === cur));  // gives only the chosen block the "on" style
            cap.innerHTML = SEGS[cur][7];  // shows that moment's caption
            count.textContent = `Moment ${cur + 1} of ${SEGS.length}`;  // updates the counter
            prev.disabled = cur === 0; next.disabled = cur === SEGS.length - 1;  // greys out Back on the first moment and Next on the last
          }  // ends pick()
          host.append(  // fills the right-hand card
            h('h4', { class: 'm0' }, 'One processor: who runs, and in which mode? Click any block.'),  // its heading, inviting the student to click any block
            svg,  // the timeline drawing
            h('div', { class: 'row' }, prev, next, count),  // a row with the Back and Next buttons and the counter
            cap,  // the caption box
            h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'Getting help from the kernel costs only a cheap <b>mode switch</b> inside the same process. A full <span class="t">process switch</span> happens only when the process has to wait, is preempted or ends.' }));  // "why it matters" box: help from the kernel costs only a mode switch; a process switch happens only when the process waits, is preempted or ends
          pick(0);  // starts on the first moment
        },  // ends render() for step 1
      },  // ends step 1

      /* ---------------- 2. Explore the nine states and their seven-state equivalents ---------------- */
      {  // step 2 (Explore): the nine states on one clickable diagram, next to the seven-state model
        title: 'Nine states on one map',  // the title shown at the top of step 2
        kind: 'explore',  // kind "explore" labels it as an Explore step
        render(el, ctx) {  // render(): builds step 2 when the student arrives on it
          const { h } = ctx;  // pulls out ctx.h, the page element maker
          const GROUPS = [  // GROUPS: the seven-state names, the UNIX states each one covers, and how the two match
            ['Running', ['ur', 'kr'], 'Split by <b>mode</b>: User Running executes the program’s own code, Kernel Running executes kernel code on the process’s behalf. Either way the process holds the processor.'],  // Running covers User Running and Kernel Running, split by mode
            ['Ready', ['rim', 'pre'], 'Split in two. <b>Ready to Run, in Memory</b> and <b>Preempted</b> are essentially the same state: both wait only for the processor, and the scheduler keeps them in <b>one queue</b>. Preempted is drawn apart to stress that preemption happens only as a process returns from kernel mode to user mode.'],  // Ready covers Ready to Run, in Memory and Preempted, which share one queue
            ['Blocked', ['asl'], '<b>Asleep in Memory</b> is the Blocked state: waiting for an event, image still in main memory.'],  // Blocked is Asleep in Memory
            ['Ready/Suspend', ['rsw'], '<b>Ready to Run, Swapped</b>: ready to go, but the image is on disk and must be swapped in first.'],  // Ready/Suspend is Ready to Run, Swapped
            ['Blocked/Suspend', ['ssw'], '<b>Sleeping, Swapped</b>: waiting for an event and swapped out to disk.'],  // Blocked/Suspend is Sleeping, Swapped
            ['New', ['cre'], '<b>Created</b> is the New state: the process exists but is not yet ready to run.'],  // New is Created
            ['Exit', ['zom'], '<b>Zombie</b> is the Exit state: the process is gone, but a record stays behind for its parent.'],  // Exit is Zombie
          ];  // ends GROUPS
          const groupOf = (id) => GROUPS.findIndex((g) => g[1].includes(id));  // groupOf(id): finds which seven-state group a UNIX state belongs to
          const dia = stateDiagram(ctx, { onState: (id) => pickState(id), onArrow: (id) => pickArrow(id) });  // builds the diagram with clickable states and arrows
          const detail = h('div', { class: 'card white s36-detail' });  // the white card on the right that explains whatever was clicked
          const gbtns = GROUPS.map(([seven], gi) => h('button', { class: 'btn sm', type: 'button', onclick: () => pickGroup(gi) }, seven));  // one button per seven-state name, which picks that group
          const view = ctx.ui.seg([{ value: 'unix', label: 'UNIX names' }, { value: 'seven', label: 'Seven-state names' }], 'unix', (v) => dia.setView(v));  // a switch between UNIX names and seven-state names on the diagram boxes
          const mark = (gi) => gbtns.forEach((b, k) => b.classList.toggle('on', k === gi));  // mark(gi): highlights group button gi and no other (-1 clears them all)
          function pickState(id) {  // pickState(id): runs when the student clicks a state box
            const m = ST[id];  // m holds the state's details from ST
            dia.states((x) => (x === id ? 'on' : null));  // only the clicked state is marked "on"
            dia.arrows((a) => (TR_BY[a].from === id || TR_BY[a].to === id ? null : 'dim'));  // arrows into or out of that state stay clear; every other arrow is dimmed
            mark(groupOf(id));  // lights up the seven-state button this state belongs to
            let extra = '';  // extra will hold an additional callout for two special states
            if (id === 'pre') extra = `<div class="callout why small m0 mt" data-label="Why a separate state?">The traditional UNIX kernel is <span class="t" data-t="Nonpreemptible kernel">nonpreemptible</span>: it never <b>forces</b> a process off the processor mid-kernel, only as it is about to return to user mode, the moment this state marks. (Sleeping in the kernel is <b>voluntary</b>, so it is allowed.) Real-time work suffers: an urgent process may wait for a long system call to finish.</div>`;  // for Preempted: a box explaining that the kernel forces a switch only on the way back to user mode
            if (id === 'kr') extra = `<div class="callout warn small m0 mt" data-label="Common mistake">Kernel Running does <b>not</b> mean “the kernel process is running”. It is the same user process, executing kernel code in kernel mode.</div>`;  // for Kernel Running: a "common mistake" box, since it is the same user process, not a kernel process
            detail.innerHTML = `<h3>${m.name}</h3><div class="row gap-s mb"><span class="chip accent">seven-state: ${m.seven}</span><span class="chip mem">${m.mem}</span></div><p class="small m0">${ST_INFO[id]}</p>${extra}`;  // fills the detail card: the name, chips for its seven-state name and where its image is, the explanation and any extra box
          }  // ends pickState()
          function pickArrow(id) {  // pickArrow(id): runs when the student clicks an arrow
            const t = TR_BY[id];  // t holds the arrow's from, to and label
            dia.arrows((a) => (a === id ? 'on' : 'dim'));  // only the clicked arrow is marked "on"; all others are dimmed
            dia.states((x) => (x === t.from || x === t.to ? 'seen' : 'dim'));  // its two end states are marked "seen"; the rest are dimmed
            mark(-1);  // clears the seven-state buttons
            const route = t.from ? (t.from === t.to ? `${ST[t.from].name} → itself` : `${ST[t.from].name} → ${ST[t.to].name}`) : `(nothing) → ${ST[t.to].name}`;  // route: the arrow written as "from → to", "→ itself" for the interrupt loop, or "(nothing) →" for fork
            detail.innerHTML = `<h3>“${t.label}”</h3><div class="row gap-s mb"><span class="chip proc">${route}</span></div><p class="small m0">${TR_INFO[id]}</p>`;  // fills the detail card with the arrow's label, its route and the explanation
          }  // ends pickArrow()
          function pickGroup(gi) {  // pickGroup(gi): runs when the student clicks a seven-state button
            const [seven, ids, txt] = GROUPS[gi];  // looks up the group's name, its UNIX states and its explanation
            dia.states((x) => (ids.includes(x) ? 'on' : 'dim'));  // the group's states are marked "on"; the others are dimmed
            dia.arrows(() => null);  // every arrow goes back to its plain style
            mark(gi);  // highlights the clicked button
            detail.innerHTML = `<h3>Seven-state “${seven}”</h3><div class="row gap-s mb">${ids.map((i) => `<span class="chip accent">${ST[i].name}</span>`).join('')}</div><p class="small m0">${txt}</p>` +  // fills the detail card with the group's heading, a chip per UNIX state and the explanation
              `<table class="tbl compact small mt"><tr><th>UNIX state</th><th>Where is its image?</th><th>When can it run?</th></tr>${ids.map((i) => `<tr><td class="b">${ST[i].name}</td><td>${ST[i].mem}</td><td>${ST[i].run}</td></tr>`).join('')}</table>`;  // followed by a small table: for each UNIX state, where its image is and when it can run
          }  // ends pickGroup()
          el.append(h('div', { class: 'split r fill' },  // lays out step 2 in two columns, the left one wider
            h('div', { class: 'card white diag-card' }, dia.svg, diagramKey(ctx)),  // left column: the diagram and its legend on a white card
            h('div', { class: 'stack' },  // right column
              h('div', { class: 'row' }, view, h('span', { class: 'xs muted' }, 'Click any state or arrow.')),  // the name switch, with a hint to click any state or arrow
              h('div', { class: 'stack gap-s' }, h('h4', { class: 'm0' }, 'Seven-state model → UNIX: pick a state'), h('div', { class: 'row gap-s' }, ...gbtns)),  // the row of seven-state buttons under a small heading
              detail)));  // the detail card; the brackets close the layout
          pickState('pre');  // starts by explaining Preempted, the state that most needs explaining
        },  // ends render() for step 2
      },  // ends step 2

      /* ---------------- 3. The life of a process: guided tour, then drive it yourself ---------------- */
      {  // step 3 (Hands-on Lab): a guided tour of one process's life, then a mode where the student drives it
        title: 'One life, fork to zombie: watch it, then drive it',  // the title shown at the top of step 3
        kind: 'lab',  // kind "lab" labels it as a Hands-on Lab
        core: true,  // core: true keeps this step in the short course path
        render(el, ctx) {  // render(): builds step 3 when the student arrives on it
          const { h } = ctx;  // pulls out ctx.h, the page element maker
          const dia = stateDiagram(ctx, { onArrow: (id) => { if (mode === 'drive' && OUT(cur).includes(id)) take(id); } });  // builds the diagram; in drive mode, clicking an arrow that leaves the current state takes that move
          const TOUR = [  // TOUR: the guided tour's frames, each [state reached, arrow taken, caption]
            [null, null, '<b>Before birth.</b> Your shell (the parent) wants to run a program. Every UNIX process is born the same way: an existing process calls <code>fork()</code>. Only process 0 is different: the kernel builds it by hand at boot.'],  // frame 1: before birth, no state yet; every process is made by fork() except process 0
            ['cre', 'fork', '<b>fork → Created.</b> The kernel gives the child a process table entry and a new ID and copies the parent’s image. The child is not ready to run yet.'],  // frame 2: fork creates the child in Created
            ['rim', 'enough', '<b>enough memory → Ready to Run, in Memory.</b> There is room in main memory, so the child joins the processes waiting for the processor.'],  // frame 3: there is enough memory, so it becomes Ready to Run, in Memory
            ['kr', 'reschedule', '<b>reschedule → Kernel Running.</b> The scheduler picks the child. It starts inside the kernel, finishing its return from <code>fork()</code>.'],  // frame 4: the scheduler picks it and it starts in Kernel Running
            ['ur', 'ret', '<b>return to user → User Running.</b> The child now runs its own program in user mode.'],  // frame 5: it returns to user mode and runs its own program
            ['kr', 'syscall', '<b>system call → Kernel Running.</b> The program calls <code>read()</code> to get file data. Same process, now executing kernel code.'],  // frame 6: it calls read() and enters Kernel Running
            ['asl', 'sleep', '<b>sleep → Asleep in Memory.</b> The data must come from the disk, which takes milliseconds. The process sleeps on that event and the kernel runs someone else.'],  // frame 7: it sleeps waiting for the disk
            ['ssw', 'swapOutSleep', '<b>swap out → Sleeping, Swapped.</b> Memory is tight. The swapper picks this sleeper (it could not run anyway) and copies its image to disk.'],  // frame 8: memory is tight, so the sleeping process is swapped out
            ['rsw', 'wakeupSw', '<b>wakeup → Ready to Run, Swapped.</b> The disk data arrives. The process is ready now, but its image is still on disk.'],  // frame 9: the data arrives, but the image is still on disk: Ready to Run, Swapped
            ['rim', 'swapIn', '<b>swap in → Ready to Run, in Memory.</b> The swapper brings the image back into main memory, so the scheduler may pick it.'],  // frame 10: the swapper brings it back into memory
            ['kr', 'reschedule', '<b>reschedule → Kernel Running.</b> Picked again, it resumes inside the kernel exactly where it fell asleep, and finishes the <code>read()</code> call.'],  // frame 11: picked again, it resumes in the kernel and finishes read()
            ['ur', 'ret', '<b>return to user → User Running.</b> <code>read()</code> hands back the data and the program carries on.'],  // frame 12: it returns to user mode with the data
            ['kr', 'syscall', '<b>interrupt → Kernel Running.</b> A clock interrupt arrives while the program runs. The kernel handles it inside this process and finds that the process has used up its time slice.'],  // frame 13: a clock interrupt carries it into Kernel Running and its time slice is used up
            ['pre', 'preempt', '<b>preempt → Preempted.</b> On its way back to user mode, the kernel sees that another ready process now deserves the processor more, and switches to it. This return-to-user moment is the only place this kernel preempts.'],  // frame 14: on the way back to user mode it is preempted
            ['ur', 'preRet', '<b>return to user → User Running.</b> Later the scheduler picks it again. Its kernel work was already done, so it goes straight back to its own code.'],  // frame 15: picked again, it goes straight back to user mode
            ['kr', 'syscall', '<b>system call → Kernel Running.</b> The program has finished its work and calls <code>exit()</code>.'],  // frame 16: it calls exit()
            ['zom', 'exit', '<b>exit → <span class="t">Zombie</span>.</b> The kernel frees its memory and closes its files but keeps a small record (exit status, times used). When the parent collects it with <code>wait()</code>, the record goes too.'],  // frame 17: it becomes a Zombie until the parent collects its record with wait()
          ];  // ends TOUR
          const DRIVE_LABEL = { fork: 'fork()', enough: 'enough memory', notEnough: 'not enough memory', reschedule: 'scheduler picks it', syscall: 'system call or interrupt', ret: 'return to user', preempt: 'preempt', preRet: 'scheduler picks it again', exit: 'exit()', sleep: 'sleep (wait for disk)', wakeupMem: 'the event happens', swapOutSleep: 'swap out', wakeupSw: 'the event happens', swapOutReady: 'swap out', swapIn: 'swap in', intr: 'interrupt' };  // DRIVE_LABEL: the wording of each move's button in drive mode, keyed by arrow id
          const MISSIONS = [  // MISSIONS: five goals for drive mode, each [task, test]; the test looks at the states and arrows visited so far
            ['Run the new process’s own code: reach User Running.', (v) => v.st.includes('ur')],  // mission 1: reach User Running
            ['Put it to sleep, then get it swapped out while asleep.', (v) => v.st.includes('ssw')],  // mission 2: get swapped out while asleep (reach Sleeping, Swapped)
            ['Bring it back from disk all the way to User Running.', (v) => { const k = v.st.indexOf('ssw'); return k >= 0 && v.st.indexOf('ur', k) > k; }],  // mission 3: after Sleeping, Swapped, reach User Running again
            ['Get it preempted, then let it resume its own code.', (v) => v.tr.includes('preRet')],  // mission 4: take the Preempted to User Running arrow
            ['End its life: reach Zombie.', (v) => v.st.includes('zom')],  // mission 5: reach Zombie
          ];  // ends MISSIONS
          const OUT = (st) => (st === null ? ['fork'] : TR.filter((t) => t[1] === st && t[0] !== 'fork').map((t) => t[0]));  // OUT(st): the arrows that leave state st; before birth the only move is fork
          // done: missions completed so far; kept across "Start a new process", cleared only by Reset
          let mode = 'tour', cur = null, visit = { st: [], tr: [] }, player = null, trailMax = 17;  // mode is "tour" or "drive"; cur is the current state; visit lists states and arrows taken; trailMax caps the path strip
          const done = new Set();  // done holds the numbers of the missions completed so far
          const status = h('div', { class: 'row gap-s' });  // the row of chips that says where the process is now
          const trail = h('div', { class: 'row gap-s s36-trail' });  // the strip that shows the path taken so far
          const body = h('div', { class: 'stack grow' });  // the area that holds either the tour's player or the drive controls
          function paint(st, tr, seenStates, usedArrows, avail = []) {  // paint(): restyles the diagram and fills the status and path strip; avail lists moves the student may take next
            dia.states((x) => (x === st ? 'on' : seenStates.includes(x) ? 'seen' : null));  // the current state is "on" and states visited earlier are "seen"
            dia.arrows((a) => (a === tr ? 'on' : avail.includes(a) ? 'avail' : usedArrows.includes(a) ? 'used' : null));  // the latest arrow is "on", moves open now are "avail" (teal, dashed) and arrows taken earlier are "used" (green)
            status.innerHTML = st ? `<span class="chip accent">now: ${ST[st].name}</span><span class="chip">seven-state: ${ST[st].seven}</span><span class="chip mem">${ST[st].mem}</span>`  // status chips: the current state, its seven-state name and where its image is
              : '<span class="chip">no process yet</span>';  // before fork there is nothing to show but "no process yet"
            const path = seenStates.concat(st ? [st] : []);  // path is every state visited, ending with the current one
            const shown = path.length > trailMax ? path.slice(1 - trailMax) : path;  // a long path is cut to its most recent part so the strip fits
            trail.innerHTML = '<span class="xs muted b">Path so far (green arrows; bold indigo = latest move):</span>' + (path.length > shown.length ? '<span class="xs muted">…</span>' : '') +  // writes the path strip heading, plus "…" if the start was cut off
              (shown.map((x, k) => `<span class="chip ${k === shown.length - 1 && st ? 'accent' : ''}">${ST[x].sub}</span>`).join('<span class="xs muted">→</span>') || '<span class="xs muted">(empty)</span>');  // then one chip per state joined by arrows, the newest in the accent colour, or "(empty)"
          }  // ends paint()
          function tour() {  // tour(): sets up the guided tour
            player = ctx.ui.player({ count: TOUR.length, interval: 2600, speed: false, render: (i) => {  // a step player through the TOUR frames, 2.6 seconds apart, without speed buttons
              const past = TOUR.slice(1, i);  // past: the frames already shown, leaving out the first one, which has no state
              paint(TOUR[i][0], TOUR[i][1], past.map((f) => f[0]), past.map((f) => f[1]));  // paints the frame's state and arrow, with the earlier states and arrows marked as visited
              return TOUR[i][2];  // returns the caption for the player to show
            } });  // ends the player setup
            body.append(player.el,  // puts the player in the body area
              h('div', { class: 'callout tip small m0', 'data-label': 'Watch for this', html: 'Every trip onto or off the processor passes through <b>Kernel Running</b>. A process is always switched out from inside the kernel, and it always resumes inside the kernel.' }));  // followed by a tip: every trip onto or off the processor passes through Kernel Running
          }  // ends tour()
          const btns = h('div', { class: 'row gap-s' });  // the row of move buttons in drive mode
          const cap = h('div', { class: 'player-cap s36-cap' });  // the caption box that explains each move in drive mode
          const mlist = h('ol', { class: 'small s36-miss m0' });  // the numbered missions list
          function drawDrive(msg) {  // drawDrive(msg): repaints drive mode after every move, with msg as the new caption
            const past = visit.st.slice(0, -1);  // past: every visited state except the current one
            paint(cur, visit.tr[visit.tr.length - 1] || null, past, visit.tr, OUT(cur));  // paints the current state and latest arrow, with the open moves shown as teal dashed arrows
            btns.replaceChildren(...OUT(cur).map((id) => h('button', { class: 'btn sm proc', type: 'button', onclick: () => take(id) }, DRIVE_LABEL[id])));  // one teal button per open move, labelled from DRIVE_LABEL
            if (cur === 'ur') btns.append(h('button', { class: 'btn sm ghost', type: 'button', onclick: () => whyNot('ur') }, 'Switch it out right now?'));  // in User Running, an extra button asks whether the kernel could switch it out right now
            if (cur === 'kr') btns.append(h('button', { class: 'btn sm ghost', type: 'button', onclick: () => whyNot('kr') }, 'Force it out mid-kernel?'));  // in Kernel Running, an extra button asks whether the kernel could force it out mid-kernel
            if (cur === 'zom') btns.append(h('button', { class: 'btn sm primary', type: 'button', onclick: () => resetDrive(false) }, 'Start a new process'));  // at Zombie, a button starts a new process
            mlist.replaceChildren(...MISSIONS.map(([t], i) => h('li', { class: done.has(i) ? 'done' : '' }, (done.has(i) ? '✓ ' : '') + t)));  // rewrites the missions list, ticking and colouring the ones already done
            if (msg) cap.innerHTML = msg;  // shows the new caption, if one was given
          }  // ends drawDrive()
          function take(id) {  // take(id): moves the process along arrow id, from a button or by clicking the arrow
            const t = TR_BY[id];  // t holds the arrow's details
            const before = done.size;  // before remembers how many missions were done, to spot a new one
            cur = t.to; visit.st.push(cur); visit.tr.push(id);  // the arrow's end becomes the current state, and both are added to the visit record
            MISSIONS.forEach(([, ok], i) => { if (ok(visit)) done.add(i); });  // checks every mission's test and records any that now pass
            let msg = TR_INFO[id];  // the caption starts with the arrow's explanation
            if (done.size > before) msg += done.size === MISSIONS.length ? ' <b>All five missions complete!</b>' : ` <b>Mission done (${done.size}/5).</b>`;  // a newly finished mission adds "Mission done" (or "All five missions complete!") to it
            drawDrive(msg);  // repaints drive mode
          }  // ends take()
          function whyNot(st) {  // whyNot(st): answers the two "could the kernel switch it out?" buttons
            cap.innerHTML = st === 'ur'  // the answer depends on where the process is
              ? '<b>Not from here.</b> While a process runs its own code, the kernel is not running at all. A clock interrupt (or a system call) must first carry the process into Kernel Running; only then can the kernel decide to switch.'  // from User Running: the kernel is not running, so an interrupt or system call must bring the process into the kernel first
              : '<b>Not by force.</b> This kernel is <span class="t" data-t="Nonpreemptible kernel">nonpreemptible</span>: it never forces a process off the processor in the middle of kernel code, because kernel tables might be half-updated. It waits until the process is about to return to user mode: the <b>preempt</b> arrow. A process can leave mid-kernel only <b>voluntarily</b>, by going to sleep to wait for an event (the <b>sleep</b> arrow).';  // from Kernel Running: never by force mid-kernel, only at the preempt point or voluntarily by sleeping
          }  // ends whyNot()
          function resetDrive(all) {  // resetDrive(all): starts drive mode over with no process; all also clears the missions
            if (all) done.clear();  // clears the finished missions only on a full reset
            cur = null; visit = { st: [], tr: [] };  // no current state and an empty visit record
            drawDrive(all || !done.size ? 'Press <b>fork()</b> to create a process, then choose each move. The dashed teal arrows show the moves open to you.'  // redraws, with a first-time prompt to press fork()
              : 'A brand-new process: press <b>fork()</b> again. Missions you already completed stay ticked.');  // or, when missions are already done, a note that they stay ticked
          }  // ends resetDrive()
          function setMode(v) {  // setMode(v): switches between the guided tour and drive mode
            if (player) { player.stop(); player = null; }  // stops and forgets any running tour player
            mode = v; trailMax = 17; trail.style.display = v === 'tour' ? '' : 'none'; body.replaceChildren();  // records the mode, resets the path length, hides the path strip in drive mode and empties the body area
            if (v === 'tour') tour();  // tour mode: build the tour
            else {  // drive mode
              body.append(h('div', { class: 'card tight' }, h('h4', {}, 'Missions'), mlist),  // a card with the missions list
                h('div', { class: 'stack gap-s' }, h('div', { class: 'row' }, h('span', { class: 'xs muted b grow' }, 'CHOOSE WHAT HAPPENS NEXT (or click a dashed arrow)'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => resetDrive(true) }, '↺ Reset')), btns), cap);  // a row with a "choose what happens next" label and a Reset button, then the move buttons and the caption
              resetDrive(false);  // starts with no process
            }  // ends the drive-mode setup
          }  // ends setMode()
          el.append(h('div', { class: 'split r fill' },  // lays out step 3 in two columns, the left one wider
            h('div', { class: 'card white diag-card' }, dia.svg, diagramKey(ctx)),  // left column: the diagram and its legend on a white card
            h('div', { class: 'stack' },  // right column
              ctx.ui.seg([{ value: 'tour', label: 'Guided tour' }, { value: 'drive', label: 'You drive' }], 'tour', setMode),  // the switch between Guided tour and You drive; changing it calls setMode()
              status, body, trail)));  // the status chips, the body area and the path strip; the brackets close the layout
          setMode('tour');  // starts in tour mode
        },  // ends render() for step 3
      },  // ends step 3

      /* ---------------- 4. The process image: three layers of context ---------------- */
      {  // step 4 (Explore): the process image as three layers of context
        title: 'The process image: three layers of context',  // the title shown at the top of step 4
        kind: 'explore',  // kind "explore" labels it as an Explore step
        html: `${/* the step's fixed HTML, placed on the page before render() runs */''}
          <div class="split l fill">${/* two columns, the left one smaller */''}
            <div class="stack">${/* left column: the explanation */''}
              <p class="lead m0">Everything that makes up a UNIX process is its <span class="t">process image</span>. SVR4 sorts it into three kinds of <b>context</b>.</p>${/* opening paragraph: SVR4 sorts the process image into three kinds of context */''}
              <div class="card proc tight"><b>1. <span class="t">User-level context</span></b><br><span class="small">What the program itself can see and change: its instructions, data and stack.</span></div>${/* teal card 1: user-level context, what the program itself sees */''}
              <div class="card cpu tight"><b>2. <span class="t">Register context</span></b><br><span class="small">The processor’s registers while this process runs. Saved when it stops, reloaded when it resumes.</span></div>${/* blue card 2: register context, the processor's registers for this process */''}
              <div class="card os tight"><b>3. <span class="t">System-level context</span></b><br><span class="small">The kernel’s private bookkeeping about this process. User code can never touch it.</span></div>${/* violet card 3: system-level context, the kernel's private bookkeeping */''}
              <div class="callout warn small m0" data-label="Common mistake">Picturing the register context as a table in memory. While the process runs, it <b>is</b> the processor’s live registers. The kernel copies it into memory when the process enters the kernel or is switched out, and reloads it to resume.</div>${/* "common mistake" box: while the process runs, its register context is the live registers, not a table in memory */''}
            </div>${/* end of the left column */''}
            <div class="stack s36-img"></div>${/* right column: an empty area that render() fills with the clickable image */''}
          </div>`,  // end of the two-column layout and of the step's HTML
        render(el, ctx) {  // render(): builds the clickable process image when the student arrives on step 4
          const { h } = ctx;  // pulls out ctx.h, the page element maker
          const host = el.querySelector('.s36-img');  // finds the empty area the HTML left for the image
          const LAYERS = [  // LAYERS: the three layers, each [colour, name, short description, its four pieces as id, name, explanation]
            ['proc', 'User-level context', 'the program’s own view', [  // layer 1, teal: user-level context, the program's own view
              ['text', 'Process text', 'The program’s <b>executable machine instructions</b>. Normally read-only, so a bug cannot overwrite the code.'],  // piece: the process text, the program's machine instructions
              ['data', 'Process data', 'The <b>data the program’s code works on</b>: its variables and other values that only this process can reach.'],  // piece: the process data the code works on
              ['ustack', 'User stack', 'Arguments, local variables and return addresses for the functions the process calls <b>while in user mode</b>. It grows with each call and shrinks with each return.'],  // piece: the user stack, used for calls in user mode
              ['shm', 'Shared memory', 'A region that <b>several processes can all access</b>, used to pass data quickly. There is one physical copy; each sharing process maps it into its own image.'],  // piece: shared memory, one physical copy mapped by several processes
            ]],  // ends the user-level pieces
            ['cpu', 'Register context', 'where the processor was', [  // layer 2, blue: register context, where the processor was
              ['pc', 'Program counter', 'The <b>address of the next instruction</b> to execute: in the program text while in user mode, in kernel code while in kernel mode.'],  // piece: the program counter, the address of the next instruction
              ['psr', 'Processor status register', 'The <b>hardware status</b> when the process last ran: condition codes, the current mode, interrupt settings. Its exact format depends on the hardware.'],  // piece: the processor status register, including the current mode
              ['sp', 'Stack pointer', 'Points to the <b>top of the stack in use</b>: the user stack in user mode, the kernel stack in kernel mode.'],  // piece: the stack pointer, pointing at the user or kernel stack
              ['gpr', 'General-purpose registers', 'The <b>working registers</b> the code was using. Their number and size depend on the hardware.'],  // piece: the general-purpose working registers
            ]],  // ends the register pieces
            ['os', 'System-level context', 'what only the kernel sees', [  // layer 3, violet: system-level context, what only the kernel sees
              ['pte', 'Process table entry', 'The kernel’s record of this process that is <b>always accessible to the kernel</b>, even while the process sleeps or is swapped out: its state, IDs, priority, pending signals and more.'],  // piece: the process table entry, always reachable by the kernel
              ['uarea', 'U area', 'The <b>user area</b>: information the kernel needs <b>only while this process is running</b>, such as its open files and system-call parameters. It can be swapped out with the rest of the image.'],  // piece: the U area, needed only while the process runs
              ['region', 'Per-process region table', 'Maps this process’s <b>virtual addresses to physical memory</b>, region by region (text, data, stack), with a permission field saying read-only, read-write or read-execute.'],  // piece: the per-process region table, mapping virtual addresses to physical memory
              ['kstack', 'Kernel stack', 'The stack used while the process executes <b>kernel code</b>: the frames of the kernel functions it has called. Separate from the user stack, so user code cannot corrupt it.'],  // piece: the kernel stack, used while running kernel code
            ]],  // ends the system-level pieces
          ];  // ends LAYERS
          const SCEN = [  // SCEN: five moments in a process's life, each [label, pieces involved, explanation]
            ['Its code calls a function', ['text', 'pc', 'ustack', 'sp'], 'The program counter walks through the <b>process text</b>; the call pushes a frame onto the <b>user stack</b> and moves the stack pointer. All in user mode.'],  // moment: its code calls a function (text, program counter, user stack, stack pointer)
            ['It touches virtual address 0x4000', ['region', 'data'], 'The address is virtual. The <b>per-process region table</b> tells the kernel (and memory hardware) which physical memory backs it and whether this access is allowed.'],  // moment: it touches a virtual address (region table, data)
            ['It calls read() on an open file', ['uarea', 'kstack', 'pc'], 'Now in kernel mode: the kernel’s functions run on the <b>kernel stack</b>, and the <b>U area</b> supplies the open-file table and the I/O parameters of this call.'],  // moment: it calls read() on an open file (U area, kernel stack, program counter)
            ['It is switched out', ['pc', 'psr', 'sp', 'gpr', 'pte'], 'The whole <b>register context</b> is saved, and the <b>process table entry</b> records the new state so the kernel can find and resume the process later.'],  // moment: it is switched out (all four registers are saved, plus the process table entry)
            ['Its disk data arrives while it sleeps', ['pte'], 'The kernel must find who was waiting, even if they are swapped out. Only the <b>process table entry</b> (with its event descriptor) is guaranteed to be in memory.'],  // moment: its disk data arrives while it sleeps (only the process table entry is sure to be in memory)
          ];  // ends SCEN
          const pieces = {};  // pieces will hold each piece's button, keyed by id
          const detail = h('div', { class: 'player-cap s36-cap' });  // the caption box under the image that explains the chosen piece or moment
          const sbtns = SCEN.map(([lab], i) => h('button', { class: 'btn sm', type: 'button', onclick: () => scen(i) }, lab));  // one button per moment
          function light(ids) { Object.entries(pieces).forEach(([id, b]) => { b.classList.toggle('on', ids.includes(id)); b.classList.toggle('dim', ids.length > 0 && !ids.includes(id)); }); }  // light(ids): highlights the listed pieces and fades all others (with an empty list nothing fades)
          function piece(layer, id, name, txt) {  // piece(): runs when the student clicks one piece of the image
            light([id]); sbtns.forEach((b) => b.classList.remove('on'));  // highlights just that piece and un-highlights the moment buttons
            const nm = ['Process table entry', 'U area', 'Per-process region table', 'Kernel stack', 'Shared memory', 'Program counter'].includes(name) ? `<span class="t">${name}</span>` : name;  // names that have a glossary entry are wrapped as dotted terms so they show a definition
            detail.innerHTML = `<b>${nm}</b> <span class="chip ${layer[0]}">${layer[1]}</span><br>${txt}`;  // the caption: the piece's name, a chip naming its layer, and the explanation
          }  // ends piece()
          function scen(i) {  // scen(i): runs when the student picks moment i
            light(SCEN[i][1]); sbtns.forEach((b, k) => b.classList.toggle('on', k === i));  // highlights that moment's pieces and its button
            detail.innerHTML = `<b>Scenario: ${SCEN[i][0]}.</b> ${SCEN[i][2]}`;  // the caption: the moment's label and explanation
          }  // ends scen()
          const bands = LAYERS.map((L) => h('div', { class: 'card tight s36-band ' + L[0] },  // builds one coloured band per layer
            h('div', { class: 'row s36-bandh' }, h('b', {}, L[1]), h('span', { class: 'xs muted' }, '· ' + L[2])),  // the band's heading: layer name in bold and a short grey description
            h('div', { class: 'grid-4 gap-s' }, ...L[3].map(([id, name, txt]) => (pieces[id] = h('button', { class: 'box ' + L[0] + ' s36-piece', type: 'button', onclick: () => piece(L, id, name, txt) }, name))))));  // a row of four piece buttons; each is stored in pieces and calls piece() when clicked
          host.append(  // fills the right-hand area
            h('h4', { class: 'm0' }, 'One UNIX process image: click any piece'),  // its heading, inviting the student to click any piece
            ...bands,  // the three layer bands
            h('div', { class: 'row gap-s', style: { alignItems: 'center' } }, h('span', { class: 'xs muted b' }, 'OR PICK A MOMENT:'), ...sbtns),  // a row labelled "or pick a moment" with the five moment buttons
            detail);  // the caption box
          scen(2);  // starts on the read() moment, which touches pieces from two layers
        },  // ends render() for step 4
      },  // ends step 4

      /* ---------------- 5. Sort game: process table entry or U area? ---------------- */
      {  // step 5 (Hands-on Lab): a sorting game, process table entry or U area for each field
        title: 'Process table entry or U area? Sort the fields',  // the title shown at the top of step 5
        kind: 'lab',  // kind "lab" labels it as a Hands-on Lab
        render(el, ctx) {  // render(): builds step 5 when the student arrives on it
          const { h } = ctx;  // pulls out ctx.h, the page element maker
          const BINS = ['Process table entry', 'Both', 'U area'];  // BINS: the three places a field can go
          const BCLS = ['os', 'accent', 'proc'];  // BCLS: the colour style for each bin (violet, accent, teal)
          // [field name, bin (0 = process table entry, 1 = both, 2 = U area), why]
          const F = [  // F: the 21 fields, each [name, correct bin, why]
            ['Process status', 0, 'The current state (Created, Asleep in Memory, Zombie…). The scheduler and the swapper check it for every process, running or not.'],  // field for the process table: the process status
            ['Pointers to U area and memory', 0, 'The kernel must find a process’s U area and its text, data and stack even when it is not running, for example to swap it in or out.'],  // field for the process table: pointers to the U area and memory
            ['Process size', 0, 'Tells the kernel how much space to find when it swaps the process in or out.'],  // field for the process table: the process size
            ['Process IDs (own and parent)', 0, 'Its own ID and its parent’s ID, set when the process is created. Needed to deliver signals and to leave the zombie record for the right parent.'],  // field for the process table: the process's own and parent's IDs
            ['Event descriptor', 0, 'Records the event a sleeping process waits for. When the event happens the kernel must find every matching sleeper, even swapped-out ones.'],  // field for the process table: the event descriptor a sleeper waits on
            ['Priority', 0, 'The scheduler compares the priorities of all ready processes, and a ready process is by definition not running.'],  // field for the process table: the priority
            ['Signal (pending signals)', 0, 'Signals sent to the process but not yet handled. A signal can arrive at any time, even while the process is asleep on disk.'],  // field for the process table: pending signals
            ['P_link', 0, 'Pointer to the next process in the ready queue. It only matters while the process is waiting in that queue, not while it runs.'],  // field for the process table: P_link, the next process in the ready queue
            ['Memory status', 0, 'Is the image in main memory or swapped out, and is it locked in memory? The swapper reads this for every process.'],  // field for the process table: memory status (in memory or swapped, locked or not)
            ['User IDs (real and effective)', 1, 'Kept in both. The kernel needs them while the process runs (what may its system calls do?) and while it does not (who may send it a signal?).'],  // field kept in both: the real and effective user IDs
            ['Timers', 1, 'Kept in both, for different jobs: the process table’s timers track execution time, kernel resource use and user-set alarms; the U area’s record user-mode and kernel-mode time of the process and its children.'],  // field kept in both: timers, used for different jobs in each
            ['Process table pointer', 2, 'Points back to this process’s process table entry, tying the two halves of the kernel’s record together.'],  // field for the U area: the pointer back to the process table entry
            ['Signal-handler array', 2, 'For each kind of signal, what this process wants done: exit, ignore, or run one of its own functions. Consulted when the signal is acted on, while the process runs.'],  // field for the U area: the signal-handler array
            ['Control terminal', 2, 'The login terminal this process is attached to, if any.'],  // field for the U area: the control terminal
            ['Error field', 2, 'Records the error, if any, from the system call being executed.'],  // field for the U area: the error from the current system call
            ['Return value', 2, 'Holds the result of the system call being executed.'],  // field for the U area: the return value of the current system call
            ['I/O parameters', 2, 'For the I/O in progress: how much data to move, the source or target address in user space, and the file offset.'],  // field for the U area: the I/O parameters
            ['File parameters', 2, 'The current directory and current root: where this process’s file names are looked up.'],  // field for the U area: the current directory and root
            ['User file descriptor table', 2, 'The files this process has open. When it calls read() on descriptor 3, the kernel looks up entry 3 here.'],  // field for the U area: the table of open files
            ['Limit fields', 2, 'Limits on the size of the process and on how large a file it may write.'],  // field for the U area: size limits
            ['Permission modes', 2, 'A mask applied to the permissions of files the process creates.'],  // field for the U area: the permission mask for new files
          ];  // ends F
          let round = 0, order = [], k = 0, res = {};  // round counts games played; order is the shuffled field order; k is the field being asked; res records right or wrong per field
          const count = h('span', { class: 'chip accent' });  // the chip showing "Field n of 21"
          const score = h('span', { class: 'xs muted b' });  // the small score line
          const fname = h('div', { class: 's36-field' });  // the big name of the field being sorted
          const fb = h('div', { class: 'player-cap s36-fb' });  // the feedback box, which explains each answer
          const abtns = BINS.map((b, bi) => h('button', { class: 'btn ' + BCLS[bi], type: 'button', onclick: () => answer(bi) }, b));  // the three answer buttons, one per bin, each calling answer() with its bin number
          const again = h('button', { class: 'btn sm primary', type: 'button', onclick: () => start(round + 1) }, 'Play again (new order)');  // the Play again button, which starts a new round in a different order
          const binEls = BINS.map(() => h('div', { class: 'row gap-s s36-chips' }));  // one area per bin where sorted field chips are collected
          function start(r) {  // start(r): begins round r
            round = r; order = ctx.util.shuffle(ctx.util.range(F.length), ctx.util.seeded(7 + r)); k = 0; res = {};  // shuffles the 21 fields with a seeded random generator, so each round has its own fixed order; clears the progress
            binEls.forEach((b) => b.replaceChildren());  // empties the three bins
            fb.innerHTML = 'Decide where the kernel keeps each field. Ask yourself: <b>does the kernel need it even when the process is not running?</b>';  // the opening hint: does the kernel need this field even when the process is not running?
            show();  // shows the first field
          }  // ends start()
          function show() {  // show(): updates the score and puts up the next field, or the end of the round
            const right = Object.values(res).filter(Boolean).length, done = Object.keys(res).length;  // right counts first-time correct answers; done counts fields answered so far
            score.textContent = `${right} of ${done} right first time` + (done ? ' · click a sorted chip to review it' : '');  // the score line, with a hint that sorted chips can be clicked to review them
            if (k >= F.length) {  // after the last field: the end of the round
              count.textContent = 'All 21 sorted';  // the counter says all 21 are sorted
              fname.innerHTML = right === F.length ? 'Perfect sort!' : `Done: ${right} / ${F.length} right.`;  // the big text becomes "Perfect sort!" or the final score
              abtns.forEach((b) => (b.disabled = true));  // disables the answer buttons
              again.style.display = '';  // shows Play again
              return;  // stops here
            }  // ends the end-of-round branch
            again.style.display = 'none';  // hides Play again during a round
            abtns.forEach((b) => (b.disabled = false));  // enables the answer buttons
            count.textContent = `Field ${k + 1} of ${F.length}`;  // the counter, such as "Field 4 of 21"
            fname.textContent = F[order[k]][0];  // the big text shows the next field's name, in shuffled order
          }  // ends show()
          function answer(bi) {  // answer(bi): runs when the student clicks bin bi
            if (k >= F.length) return;  // ignores clicks after the round is over
            const i = order[k], [name, bin, why] = F[i];  // looks up the current field: its number, name, correct bin and explanation
            const ok = bin === bi;  // ok is true if the student chose the right bin
            res[i] = ok;  // records the result for this field
            const chip = h('button', { class: 'chip ' + (ok ? 'ok' : 'bad') + ' s36-chip', type: 'button', title: why, onclick: () => { fb.innerHTML = `<b>${name}</b> → ${BINS[bin]}. ${why}`; } }, (ok ? '✓ ' : '✗ ') + name);  // a chip for the field with a tick or cross; clicking it later shows the explanation again
            binEls[bin].append(chip);  // the chip always lands in the correct bin, so the bins build up the right answer
            fb.innerHTML = (ok ? '<span class="s36-ok">✓ Right.</span> ' : `<span class="s36-bad">✗ Not ${BINS[bi]}.</span> `) + `<b>${name}</b> belongs in <b>${BINS[bin]}</b>. ${why}`;  // feedback: right, or which bin was wrong, then where the field belongs and why
            k++;  // moves on to the next field
            show();  // and shows it
          }  // ends answer()
          el.append(h('div', { class: 'stack fill' },  // lays out step 5 as one column filling the step
            h('div', { class: 'split r', style: { height: 'auto' } },  // a top row of two columns, only as tall as its contents
              h('div', { class: 'card white stack gap-s' },  // left: a white card for the game
                h('div', { class: 'row' }, count, score),  // the counter and score
                fname,  // the field name
                h('div', { class: 'row' }, ...abtns, again),  // the three answer buttons and Play again
                fb),  // the feedback box
              h('div', { class: 'stack' },  // right: background help
                h('div', { class: 'callout why small m0', 'data-label': 'Why split the record in two?', html: 'Main memory was scarce. The small <span class="t">process table entry</span> stays in memory at all times, so the kernel can schedule, wake or signal any process. The <span class="t">U area</span> is needed only while its process runs, so it can be swapped out with the rest of the image.' }),  // "why split the record in two?" box: memory was scarce, so only the small, always-needed part stays in memory
                ctx.ui.reveal('Show the rule of thumb', '<div class="callout tip small m0" data-label="Rule of thumb">Needed when the process is <b>not</b> running (asleep, swapped out, waiting in a queue)? Process table entry. Needed only while it runs its own system calls? U area.</div>'))),  // a button that reveals the rule of thumb when clicked
            h('div', { class: 'grid-3 grow s36-bins' }, ...BINS.map((b, bi) => h('div', { class: 'card tight stack gap-s ' + BCLS[bi] }, h('h4', { class: 'm0' }, b), binEls[bi])))));  // below, the three bins side by side, filling the rest of the step; the brackets close the layout
          start(0);  // starts round 0
        },  // ends render() for step 5
      },  // ends step 5

      /* ---------------- 6. fork() step by step ---------------- */
      {  // step 6 (Explore): fork() step by step, with the code of both processes and the kernel's tables
        title: 'fork(): what the kernel does, step by step',  // the title shown at the top of step 6
        kind: 'explore',  // kind "explore" labels it as an Explore step
        core: true,  // core: true keeps this step in the short course path
        render(el, ctx) {  // render(): builds step 6 when the student arrives on it
          const { h } = ctx;  // pulls out ctx.h, the page element maker
          // each line: [code, plain-language comment]; padded so comments line up
          const LINES = [  // LINES: the C program shown to the student, each line with a plain-language comment
            ['pid_t pid;', 'room for fork’s answer'],  // shown code, line 1: declares pid, the variable that will hold fork's answer
            ['pid = fork();', 'ask the kernel: clone me'],  // shown code, line 2: the fork() call that asks the kernel to clone the process
            ['if (pid == 0) {', '0 means: I am the child'],  // shown code, line 3: tests whether fork returned 0, which means "I am the child"
            ['  printf("child\\n");', 'only the child prints this'],  // shown code, line 4: only the child prints "child"
            ['  execlp("ls","ls",NULL);', 'child becomes the ls program'],  // shown code, line 5: the child replaces its program with ls
            ['} else {', 'not 0: I am the parent'],  // shown code, line 6: otherwise this is the parent
            ['  printf("parent\\n");', 'only the parent prints this'],  // shown code, line 7: only the parent prints "parent"
            ['  wait(NULL);', 'sleep until the child ends'],  // shown code, line 8: the parent sleeps until the child ends
            ['}', 'end of if/else'],  // shown code, line 9: closes the if/else
          ];  // ends LINES
          const SRC = LINES.map(([c, m]) => c.padEnd(27) + '// ' + m).join('\n');  // SRC: the program text, each code line padded to the same width so the comments line up
          function panel(who, pid) {  // panel(): builds one process's box: a title chip, its state, its pid value and its own copy of the code
            const st = h('span', { class: 'chip' });  // the chip that shows the process's state
            const v = h('span', { class: 's36-var mono' });  // the badge that shows its value of pid
            const code = ctx.ui.code(SRC, { lang: 'c', fontSize: 13 });  // a code block with C syntax colouring; lines can be marked as running or dimmed
            const empty = h('div', { class: 's36-empty' }, 'No child yet: fork() has not created it.');  // the dashed placeholder shown before the child exists
            const el = h('div', { class: 'stack gap-s' }, h('div', { class: 'row gap-s' }, h('span', { class: 'chip proc' }, `${who} · PID ${pid}`), st, h('span', { class: 'grow' }), v), code, empty);  // the panel: a row with name, PID, state and pid value, then the code (and the placeholder)
            return { el, st, v, code, empty };  // hands back the panel and the parts that change
          }  // ends panel()
          const P = panel('Parent', 812), C = panel('Child', 813);  // P is the parent's panel (PID 812) and C the child's (PID 813)
          P.empty.remove();  // the parent always exists, so its placeholder is removed
          const term = h('div', { class: 's36-term mono' });  // the terminal strip that shows what has been printed
          const scene = forkScene(ctx);  // builds the kernel-tables picture defined near the top of this file
          const STEPS6 = ['slot', 'PID', 'copy image', 'file counts', 'Ready to Run', 'return values'];  // STEPS6: short names for the six things the kernel does during fork()
          const chips = STEPS6.map((t, i) => h('span', { class: 'chip', html: `<b>${i + 1}</b>&nbsp;${t}` }));  // one numbered chip per step, highlighted as the walkthrough reaches it
          const base = { k: 0, pSt: 'User Running', cSt: null, slot: 'free', image: false, files: 1, hot: null, pVar: '?', cVar: '?', pL: [2], cL: [], cDim: false, out: [] };  // base: the starting frame, with the parent in User Running on line 2, no child, one user per file and nothing printed
          const CH = [  // CH: the frames up to the end of fork's six steps, each [changes to the previous frame, caption]
            [{}, '<b>Before.</b> Process 812 runs its own code in user mode and is about to execute line 2, <code>pid = fork();</code>. Watch the kernel’s tables: process table, main memory and open files.'],  // frame 1: before, the parent is about to call fork()
            [{ pSt: 'Kernel Running' }, '<b><span class="t">fork()</span> is a system call.</b> Process 812 switches into kernel mode. Everything that follows is done by the kernel, running inside the parent process.'],  // frame 2: fork() is a system call, so the parent enters Kernel Running
            [{ k: 1, slot: 'reserved', hot: 'slot' }, '<b>(1) Allocate a slot</b> in the process table for the new process. Slot 3 is free, so the kernel claims it. (With no free slot, fork would fail.)'],  // frame 3: step 1, a process-table slot is reserved
            [{ k: 2, slot: 'pid', hot: 'slot' }, '<b>(2) Assign a unique process ID</b> to the child: <b>813</b>. No other current process has this number.'],  // frame 4: step 2, the child gets its own ID, 813
            [{ k: 3, image: true, cSt: 'Created', hot: 'image' }, '<b>(3) Copy the parent’s process image</b> (text, data, stack), so the child starts as an exact twin. The one exception is <span class="t">shared memory</span>: it is not copied; the child simply shares it too. (Modern kernels delay the copying: parent and child share pages until one of them writes, called copy-on-write.)'],  // frame 5: step 3, the parent's image is copied and the child is Created; shared memory is shared, not copied
            [{ k: 4, files: 2, hot: 'files' }, '<b>(4) Increment the counters of every file the parent has open.</b> The child inherits them, so each file now has two users and stays open until both are done.'],  // frame 6: step 4, each open file's count goes up to 2
            [{ k: 5, slot: 'ready', cSt: 'Ready to Run', hot: 'slot' }, '<b>(5) Put the child in the Ready to Run state.</b> From now on the scheduler may choose it like any other process.'],  // frame 7: step 5, the child becomes Ready to Run
            [{ k: 6, pVar: '813', cVar: '0', cL: [2], hot: null }, '<b>(6) Return the child’s ID to the parent and 0 to the child.</b> The parent’s <code>pid</code> becomes 813; the child’s copy will read 0. That single difference is how the twins tell themselves apart. <b>Next, the kernel must choose who runs: pick one of its three options below.</b>'],  // frame 8: step 6, the parent gets 813 and the child gets 0; now the kernel must choose who runs
          ];  // ends CH
          // after step 6 the kernel has three options; each is its own four-frame branch
          const LS = 'notes.txt  report.c';  // LS: what the ls program prints, the two file names in the directory
          const EXEC = (extra) => '<b>fork, then exec.</b> The child calls <code>execlp()</code>, one of the <span class="t">exec</span> calls: its program is replaced by <code>ls</code>. Same process, same PID 813, brand-new code; ls prints the directory listing.' + extra;  // EXEC(): the caption for the exec frame, with extra text added at the end
          const ZOMB = '<b>ls finishes: exit → Zombie.</b> The kernel frees the child’s image and closes its files (both counts drop back to 1), but slot 3 keeps a small record with the exit status.';  // ZOMB: the caption for the child's exit, which leaves a Zombie record
          const BR = {  // BR: the three endings after fork's six steps, one four-frame list per choice the kernel can make
            parent: [  // choice 1: stay in the parent
              [{ pSt: 'User Running', pL: [6, 7], out: ['parent'] }, '<b>Choice: stay in the parent.</b> The kernel returns to user mode in the parent, at the point of the fork call. Its pid is 813, not 0, so it takes the <b>else</b> branch and prints “parent”. The child waits in Ready to Run.'],  // frame: the parent returns to user mode, takes the else branch and prints "parent"
              [{ pSt: 'Asleep in Memory', cSt: 'User Running', pL: [8], cL: [3, 4], out: ['parent', 'child'] }, '<b>The child gets its turn.</b> The parent calls <code>wait()</code> and sleeps until its child ends, so the scheduler picks the child. It starts where the parent was, at the return from fork(). Its pid is 0, so it prints “child”.'],  // frame: the parent sleeps in wait(), so the child runs and prints "child"
              [{ cL: [5], cDim: true, cImg: 'ls', hot: 'image', out: ['parent', 'child', LS] }, EXEC(' Every command you type in a shell starts this way.')],  // frame: the child execs ls, its code is dimmed except the exec line, and ls prints the listing
              [{ pSt: 'Ready to Run', cSt: 'Zombie', slot: 'zombie', cImg: 'freed', files: 1, hot: 'slot', cL: [], out: ['parent', 'child', LS] }, ZOMB + ' The child’s exit also wakes the parent. When it runs, its <code>wait()</code> collects that record and slot 3 is free again.'],  // frame: ls exits; the child becomes a Zombie, the file counts drop to 1 and the parent is woken
            ],  // ends choice 1
            child: [  // choice 2: switch to the child
              [{ pSt: 'Ready to Run', cSt: 'User Running', pL: [2], cL: [3, 4], out: ['child'] }, '<b>Choice: switch to the child.</b> The parent is left in Ready to Run. The child starts at the same point in the code as the parent, the return from fork(). Its pid is 0, so it prints “child” first.'],  // frame: the child runs first and prints "child" while the parent waits in Ready to Run
              [{ cL: [5], cDim: true, cImg: 'ls', hot: 'image', out: ['child', LS] }, EXEC(' The parent is still waiting its turn.')],  // frame: the child execs ls, which prints the listing
              [{ cSt: 'Zombie', slot: 'zombie', cImg: 'freed', files: 1, hot: 'slot', cL: [], out: ['child', LS] }, ZOMB + ' The parent has not even printed yet.'],  // frame: ls exits and the child becomes a Zombie before the parent has printed anything
              [{ pSt: 'User Running', pL: [6, 7, 8], hot: null, out: ['child', LS, 'parent'] }, '<b>At last the parent runs.</b> fork() returns 813, so it prints “parent”. Its <code>wait()</code> finds the zombie child at once, collects the record and returns. The same lines as the other choices, in a <b>different order</b>.'],  // frame: the parent finally runs, prints "parent" and collects the zombie at once
            ],  // ends choice 2
            other: [  // choice 3: run another process
              [{ pSt: 'Ready to Run', pL: [2], out: [] }, '<b>Choice: switch to another process.</b> A more important process (say PID 905) is ready, so the kernel runs it. Parent and child are <b>both</b> left in Ready to Run, each paused at the return from fork(). Nothing new is printed.'],  // frame: another process runs; parent and child both wait in Ready to Run and nothing is printed
              [{ pSt: 'User Running', pL: [6, 7], out: ['parent'] }, '<b>Later the scheduler picks one of the two</b>, here the parent: it returns to user mode at the fork call and prints “parent”. It could just as well have picked the child first.'],  // frame: later the parent is picked and prints "parent"
              [{ pSt: 'Asleep in Memory', cSt: 'User Running', pL: [8], cL: [3, 4], out: ['parent', 'child'] }, '<b>The child runs.</b> The parent sleeps in <code>wait()</code>; the scheduler picks the child, whose pid is 0, so it prints “child”.'],  // frame: the parent sleeps in wait() and the child prints "child"
              [{ cL: [5], cDim: true, cImg: 'ls', hot: 'image', out: ['parent', 'child', LS] }, EXEC(' The choice changes the line order, not the count (on a terminal, as here).')],  // frame: the child execs ls, which prints the listing
            ],  // ends choice 3
          };  // ends BR
          const FR = [];  // FR will hold the complete frames for fork's six steps
          CH.reduce((acc, [chg, cap]) => { const f = Object.assign({}, acc, chg, { cap, now: chg.k || 0 }); FR.push(f); return f; }, base);  // builds each complete frame by laying its changes over the previous one; now records which of the six steps is active
          const FB = {};  // FB will hold the complete frames for each ending
          Object.entries(BR).forEach(([key, list]) => {  // builds the frames of each ending in the same way
            FB[key] = [];  // starts an empty list for this ending
            list.reduce((acc, [chg, cap]) => { const f = Object.assign({}, acc, { hot: null }, chg, { cap, now: 0 }); FB[key].push(f); return f; }, FR[FR.length - 1]);  // each ending starts from fork's last frame; the highlight is cleared unless the frame sets one
          });  // ends the loop over the endings
          let choice = 'parent';  // choice is the ending the student has picked; it starts with "stay in the parent"
          const frameAt = (i) => (i < FR.length ? FR[i] : FB[choice][i - FR.length]);  // frameAt(i): frame i of the whole walkthrough, the fork frames followed by the chosen ending
          function draw(f) {  // draw(f): paints every part of the step for frame f and returns its caption; the player calls it on each frame
            chips.forEach((c, i) => { c.className = 'chip ' + (i + 1 === f.now ? 'accent' : i + 1 <= f.k ? 'ok' : ''); });  // the six step chips: the active step in the accent colour, finished steps green, the rest plain
            scene.draw(f);  // repaints the kernel-tables picture
            P.st.textContent = f.pSt; P.v.textContent = 'pid = ' + f.pVar;  // the parent's state chip and its pid value
            P.code.clear(); P.code.mark(f.pL);  // clears the parent's highlighted code lines, then marks the ones running now
            const alive = !!f.cSt;  // alive is true once the child exists
            C.code.style.display = alive ? '' : 'none'; C.empty.style.display = alive ? 'none' : '';  // shows the child's code only once it exists, and the dashed placeholder before that
            C.st.textContent = alive ? f.cSt + (f.cImg === 'ls' ? ' (now ls)' : '') : 'does not exist';  // the child's state chip, with "(now ls)" after exec, or "does not exist"
            C.v.textContent = alive ? 'pid = ' + f.cVar : '';  // the child's pid value, blank before it exists
            C.code.clear();  // clears the child's highlighted code lines
            // after exec only line 5 is still "this program"; after exit none of it is
            if (f.cDim) C.code.mark(ctx.util.range(9).map((i) => i + 1).filter((n) => f.cSt === 'Zombie' || n !== 5), 'dim');  // after exec, every line except the exec line is dimmed (all of them once the child is a zombie)
            C.code.mark(f.cL);  // marks the child's lines running now
            term.innerHTML = '<span class="xs muted b">TERMINAL</span> ' + (f.out.length ? f.out.map((o) => `<span class="s36-out">${o}</span>`).join('') : '<span class="muted">(nothing printed yet)</span>');  // the terminal strip: every line printed so far, or "(nothing printed yet)"
            return f.cap;  // returns the caption for the player to show
          }  // ends draw()
          const player = ctx.ui.player({ count: FR.length + 4, interval: 3200, speed: false, render: (i) => draw(frameAt(i)) });  // the step player: the eight fork frames plus four for the chosen ending, 3.2 seconds apart, without speed buttons
          const pickChoice = ctx.ui.seg([{ value: 'parent', label: 'Stay in the parent' }, { value: 'child', label: 'Switch to the child' }, { value: 'other', label: 'Run another process' }], 'parent',  // the switch for the kernel's three choices
            (v) => { choice = v; player.stop(); player.go(FR.length); });  // changing the choice stops the player and jumps to the first frame of the new ending
          el.append(h('div', { class: 'split fill' },  // lays out step 6 in two equal columns
            h('div', { class: 'stack gap-s s36-fork' }, P.el, C.el, term),  // left: the parent's panel, the child's panel and the terminal
            h('div', { class: 'stack gap-s' }, h('div', { class: 'row gap-s s36-six' }, ...chips), h('div', { class: 'card white tight' }, scene.svg), player.el,  // right: the six step chips, the kernel-tables picture on a white card, and the player
              h('div', { class: 'card tight stack gap-s s36-choice' }, h('span', { class: 'xs muted b' }, 'AFTER ITS SIX STEPS THE KERNEL CHOOSES WHO RUNS NEXT. TRY ALL THREE:'), pickChoice))));  // under the player, a card asking the student to try all three of the kernel's choices; the brackets close the layout
        },  // ends render() for step 6
      },  // ends step 6

      /* ---------------- 7. Predict: how many lines does a fork program print? ---------------- */
      {  // step 7 (Predict): guess how many lines a fork program prints, then see its process family tree
        title: 'Predict the output, then see the family tree',  // the title shown at the top of step 7
        kind: 'predict',  // kind "predict" labels it as a Predict step
        render(el, ctx) {  // render(): builds step 7 when the student arrives on it
          const { h, s } = ctx;  // pulls out ctx.h (page element maker) and ctx.s (SVG element maker)
          // code lines [code, comment]; tree nodes [id, parent, which fork made it, what it prints]
          const PUZ = [  // PUZ: five small programs; each has code lines, the tree of processes it makes, an edge legend and an explanation
            { label: 'One fork', code: [['fork();', 'ask for a child'], ['printf("hi\\n");', 'print one line']],  // puzzle 1: one fork, then one printf
              nodes: [['P', null, 0, 'hi'], ['C1', 'P', 1, 'hi']], legend: ['fork()'],  // its tree: the program P and one child, each printing "hi"
              why: '<code>fork()</code> returns twice: once in the parent and once in the new child. Both carry on from the line after it, so “hi” appears <b>2</b> times.' },  // explanation: fork returns twice, so "hi" appears 2 times
            { label: 'Two forks', code: [['fork();', 'ask for a child'], ['fork();', 'ask for another child'], ['printf("hi\\n");', 'print one line']],  // puzzle 2: two forks, then one printf
              nodes: [['P', null, 0, 'hi'], ['C1', 'P', 1, 'hi'], ['C2', 'P', 2, 'hi'], ['C3', 'C1', 2, 'hi']], legend: ['1st fork()', '2nd fork()'],  // its tree: four processes, each printing "hi"
              why: 'The first fork makes 2 processes, and <b>both</b> run the second fork, so each makes a child: <b>4</b> processes, 4 lines. n forks in a row give 2ⁿ processes.' },  // explanation: both processes run the second fork, so 4 processes; n forks give 2 to the power n
            { label: 'A, then B', code: [['fork();', 'ask for a child'], ['printf("A\\n");', 'print A'], ['fork();', 'ask for another child'], ['printf("B\\n");', 'print B']],  // puzzle 3: fork, print A, fork, print B
              nodes: [['P', null, 0, 'A B'], ['C1', 'P', 1, 'A B'], ['C2', 'P', 2, 'B'], ['C3', 'C1', 2, 'B']], legend: ['1st fork()', '2nd fork()'],  // its tree: two processes print A and B, two newer ones print only B
              why: 'Two processes print A. Then both fork, making four, and all four print B: 2 + 4 = <b>6</b> lines. The second-generation children start after the first printf, so they never print A.',  // explanation: 2 A lines plus 4 B lines make 6
              note: 'On a terminal: 6. Sent to a <b>file or pipe</b>, output is buffered inside the process, so the second fork copies the unwritten “A”: <b>8</b> lines. <code>fflush(stdout)</code> before <code>fork()</code> keeps it at 6.' },  // an extra note shown after the answer: sent to a file or pipe, buffering makes it 8
            { label: 'if (fork()==0)', code: [['if (fork() == 0)', 'fork; was the result 0?'], ['    fork();', 'only if the result was 0'], ['printf("X\\n");', 'print one line']],  // puzzle 4: fork inside an if, so only the child forks again
              nodes: [['P', null, 0, 'X'], ['C1', 'P', 1, 'X'], ['C2', 'C1', 2, 'X']], legend: ['fork() in the if', 'inner fork()'],  // its tree: parent, child and grandchild, each printing "X"
              why: 'In the parent, fork returns the child’s ID (not 0), so the parent skips the inner fork. In the child it returns 0, so the child forks once more. Parent, child and grandchild print: <b>3</b> lines.' },  // explanation: the parent skips the inner fork, the child does not, so 3 lines
            { label: 'Loop ×3', code: [['for (i = 0; i < 3; i++)', 'repeat three times'], ['    fork();', 'ask for a child'], ['printf("hi\\n");', 'print one line']],  // puzzle 5: fork three times in a loop
              nodes: [['P', null, 0, 'hi'], ['C1', 'P', 1, 'hi'], ['C2', 'P', 2, 'hi'], ['C3', 'P', 3, 'hi'], ['C4', 'C1', 2, 'hi'], ['C5', 'C1', 3, 'hi'], ['C6', 'C2', 3, 'hi'], ['C7', 'C4', 3, 'hi']], legend: ['pass i = 0', 'pass i = 1', 'pass i = 2'],  // its tree: eight processes, each printing "hi"
              why: 'A child starts inside the loop with its parent’s value of <code>i</code>, so it joins the remaining passes. Every pass doubles the crowd: 1 → 2 → 4 → 8, so <b>8</b> lines.' },  // explanation: each child joins the remaining passes, so the count doubles each pass: 8 lines
          ];  // ends PUZ
          const ECOL = ['', 'var(--cpu)', 'var(--proc)', 'var(--io)'];  // ECOL: the colour of a tree edge for each fork call (first, second, third)
          let pz = 0, guess = null;  // pz is the puzzle shown; guess is the student's number, none yet
          const codeHost = h('div');  // the area that holds the puzzle's code block
          const nbtns = ctx.util.range(8).map((i) => h('button', { class: 'btn sm s36-n', type: 'button', onclick: () => predict(i + 1) }, String(i + 1)));  // eight number buttons, 1 to 8, each calling predict() with its number
          const verdict = h('div', { class: 'player-cap s36-cap' });  // the verdict box under the buttons
          const svg = s('svg', { viewBox: '0 0 600 300', width: '100%', role: 'img', 'aria-label': 'Process family tree' });  // the family-tree drawing, 600 by 300 units
          const outRow = h('div', { class: 's36-term mono' });  // the terminal strip under the tree
          const legend = h('div', { class: 'row gap-s' });  // the edge-colour legend under the tree
          const total = (p) => p.nodes.reduce((n, x) => n + x[3].split(' ').length, 0);  // total(p): the right answer, counting every word each process prints
          const box = (x, y, w, hh, cls, l1, l2) => [s('rect', { x: x - w / 2, y, width: w, height: hh, rx: 8, class: cls, 'stroke-width': 2 }),  // box(): draws one tree node, a rounded box with one or two lines of text, centred on x
            s('text', { x, y: l2 ? y + 16 : y + 21, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, l1),  // the bold first line, centred when there is no second line
            l2 ? s('text', { x, y: y + 31, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, l2) : null].filter(Boolean);  // the grey second line, if there is one; empty parts are dropped
          function drawTree(show) {  // drawTree(show): draws the tree; with show false only the program and a "predict first" box appear
            const p = PUZ[pz], kids = [];  // p is the current puzzle; kids collects the shapes
            // the ancestors every process shares
            [[80, 'PID 0 · swapper', 's-os'], [250, 'PID 1 · init', 's-os'], [420, 'your shell', 's-proc']].forEach(([x, t, c], i) => {  // the ancestors every process shares: the swapper, init and your shell, left to right
              kids.push(...box(x, 6, 144, 32, c, t));  // draws each ancestor's box
              if (i < 2) kids.push(s('line', { x1: x + 74, y1: 22, x2: x + 94, y2: 22, class: 's-line', 'marker-end': 'url(#arr)' }));  // and an arrow from each of the first two to the next one
            });  // ends the ancestors
            kids.push(s('text', { x: 80, y: 54, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'built at boot'),  // grey notes under the ancestors: the swapper is built at boot
              s('text', { x: 250, y: 54, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'ancestor of all'),  // init is the ancestor of all processes
              s('path', { d: 'M420,38 C 420,56 320,50 304,66', class: 's-line', 'marker-end': 'url(#arr)' }));  // a curved arrow from your shell down to the program's own tree
            // lay out the program's own tree: leaves left to right, parents centred over children
            const N = p.nodes.map(([id, par, fk, pr]) => ({ id, par, fk, pr, kids: [] }));  // N: the puzzle's processes as objects, each with its id, parent, the fork that made it, what it prints, and a list for its children
            const by = Object.fromEntries(N.map((n) => [n.id, n]));  // by: the same processes looked up by id
            N.forEach((n) => n.par && by[n.par].kids.push(n));  // adds every process to its parent's list of children
            let slot = 0;  // slot counts the leaf positions handed out so far, left to right
            const place = (n, d) => { n.d = d; if (!n.kids.length) n.x = slot++; else { n.kids.forEach((k) => place(k, d + 1)); n.x = (n.kids[0].x + n.kids[n.kids.length - 1].x) / 2; } };  // place(): a recursive layout (a function that calls itself for each child): leaves get the next slot, parents sit centred over their children
            place(N[0], 0);  // lays out the whole tree starting from the program P at depth 0
            const X = (n) => 300 + (n.x - (slot - 1) / 2) * 118, Y = (n) => 70 + n.d * 57;  // X and Y turn a node's slot and depth into drawing positions, centring the tree around x = 300
            if (!show) {  // before the student predicts: hide the answer
              kids.push(...box(300, 70, 104, 40, 's-accent', 'P', 'your program'),  // only the program's own box, labelled "your program"
                s('rect', { x: 230, y: 140, width: 140, height: 60, rx: 10, class: 's-muted', 'stroke-dasharray': '6 4' }),  // and a dashed box below it
                s('text', { x: 300, y: 175, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: 's-sub' }, '? predict first'));  // saying "? predict first"
            } else {  // after the prediction: the full tree
              N.forEach((n) => n.kids.forEach((k) => kids.push(s('line', { x1: X(n), y1: Y(n) + 40, x2: X(k), y2: Y(k), style: `stroke:${ECOL[k.fk]};stroke-width:2.5` }))));  // a line from each parent to each child, coloured by which fork call made the child
              N.forEach((n) => kids.push(...box(X(n), Y(n), 104, 40, n.id === 'P' ? 's-accent' : 's-proc', n.id, 'prints ' + n.pr)));  // a box for every process, the program in the accent colour, each saying what it prints
            }  // ends the choice between hidden and shown
            svg.replaceChildren(...kids);  // swaps the new drawing into the SVG in one step
            legend.innerHTML = show ? '<span class="xs muted b">EDGE COLOUR = WHICH CALL MADE THE CHILD:</span>' + p.legend.map((t, i) => `<span class="chip ${['cpu', 'proc', 'io'][i]}">${t}</span>`).join('') : '';  // the edge-colour legend appears only once the tree is shown
            const lines = [];  // lines will list every line the program prints, in the order of the printf calls
            p.code.forEach(([c]) => { const m = c.match(/printf\("(\w+)/); if (m) p.nodes.forEach((n) => { if (n[3].split(' ').includes(m[1])) lines.push(m[1]); }); });  // for each printf in the code, adds one line for every process that prints that word
            outRow.innerHTML = '<span class="xs muted b">TERMINAL</span> ' + (show ? lines.map((l) => `<span class="s36-out">${l}</span>`).join('') + `<span class="xs muted">${lines.length} lines · the order may vary between runs; on a terminal the count does not</span>` : '<span class="muted">(run hidden until you predict)</span>');  // the terminal strip: the printed lines with a note that order may vary, or "(run hidden until you predict)"
            // a puzzle whose count depends on buffering swaps the common-mistake callout for its note once revealed
            const withNote = show && !!p.note;  // withNote is true when the answer is shown and this puzzle has a buffering note
            mistake.style.display = withNote ? 'none' : '';  // that note replaces the "common mistake" box
            noteBox.style.display = withNote ? '' : 'none';  // and the note box appears in its place
            if (withNote) noteBox.innerHTML = p.note;  // fills in the note's text
          }  // ends drawTree()
          function load(i) {  // load(i): shows puzzle i when the student picks it
            pz = i; guess = null;  // records the puzzle and clears the guess
            const pad = Math.max(...PUZ[i].code.map(([c]) => c.length)) + 2;  // pad: the width of the longest code line plus 2, so the comments line up
            codeHost.replaceChildren(ctx.ui.code(PUZ[i].code.map(([c, m]) => c.padEnd(pad) + '// ' + m).join('\n'), { lang: 'c', fontSize: 14 }));  // puts the puzzle's code in the code area, each line padded and followed by its comment
            nbtns.forEach((b) => b.classList.remove('on', 'ok', 'bad'));  // clears the highlight from the number buttons
            verdict.innerHTML = 'Count every line printed by <b>every</b> process. The output goes to a <b>terminal</b>, so each line appears as soon as it is printed. Commit to a number, then check.';  // the verdict box's prompt: count the lines from every process, then commit to a number
            drawTree(false);  // draws the tree with the answer hidden
          }  // ends load()
          function predict(n) {  // predict(n): runs when the student clicks number n
            guess = n;  // records the guess
            const ans = total(PUZ[pz]);  // works out the right answer
            nbtns.forEach((b, i) => { b.classList.toggle('on', i + 1 === n); b.classList.toggle('s36-right', i + 1 === ans); });  // marks the button clicked and turns the right answer's button green
            verdict.innerHTML = (n === ans ? '<span class="s36-ok">✓ Correct: ' + ans + ' lines.</span> ' : `<span class="s36-bad">✗ You said ${n}; it prints ${ans}.</span> `) + PUZ[pz].why;  // the verdict: correct, or what was guessed and what it really prints, then the explanation
            drawTree(true);  // reveals the full tree and the terminal output
          }  // ends predict()
          const mistake = h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Thinking only the original process runs the lines after <code>fork()</code>. Parent and child <b>both</b> continue from the same spot, so every later line runs in both, including any later forks.' });  // "common mistake" box: after fork both processes run every later line
          const noteBox = h('div', { class: 'callout why small m0', 'data-label': 'Why the count can change', style: { display: 'none' } });  // the box for a puzzle's buffering note, hidden until needed
          const pick = ctx.ui.seg(PUZ.map((p, i) => ({ value: i, label: p.label })), 0, load);  // the switch that picks one of the five puzzles; choosing one calls load()
          el.append(h('div', { class: 'split l fill' },  // lays out step 7 in two columns, the left one smaller
            h('div', { class: 'stack' },  // left column
              pick, codeHost,  // the puzzle switch and the code
              h('div', { class: 'stack gap-s' }, h('b', {}, 'How many lines will it print in total?'), h('div', { class: 'row gap-s' }, ...nbtns)),  // the question "how many lines will it print in total?" with the eight number buttons
              verdict,  // the verdict box
              h('div', { class: 'callout os small m0', 'data-label': 'Where every tree starts', html: 'fork() can only copy an existing process, so at boot the kernel builds <span class="t">process 0</span> (the swapper) by hand. Process 0 creates <span class="t">process 1</span>, <b>init</b>, the ancestor of every other process. init starts a process for each user who logs in, which becomes that user’s shell.' })),  // violet box: every tree starts at process 0, built by hand at boot, which creates init
            h('div', { class: 'stack gap-s' },  // right column
              h('div', { class: 'card white tight' }, svg), legend, outRow, mistake, noteBox)));  // the family tree on a white card, then the legend, the terminal strip and the two callouts; the brackets close the layout
          load(0);  // starts with the first puzzle
        },  // ends render() for step 7
      },  // ends step 7

      /* ---------------- 8. Recap ---------------- */
      {  // step 8 (Recap): eight flip cards about UNIX processes
        title: 'Recap: eight ideas about UNIX processes',  // the title shown at the top of step 8
        kind: 'recap',  // kind "recap" labels it as the Recap and keeps it in the short course path
        render(el, ctx) {  // render(): builds step 8 when the student arrives on it
          const { h } = ctx;  // pulls out ctx.h, the page element maker
          el.append(h('div', { class: 'stack fill' },  // lays out step 8 as one column filling the step
            h('p', { class: 'lead m0' }, 'Say each answer out loud, then flip the card to check yourself.'),  // opening line: say each answer before flipping the card
            ctx.ui.flipcards([  // the guide's flip cards: a prompt on the front, the answer on the back
              ['Where does the kernel run?', 'Mostly <b>inside user processes</b>: a system call or interrupt switches the same process into kernel mode.'],  // card 1: where the kernel runs, mostly inside user processes
              ['System vs user processes', 'System processes run <b>only in kernel mode</b> (housekeeping such as swapping). User processes run programs in user mode and enter kernel mode on system calls, exceptions and interrupts.'],  // card 2: system processes versus user processes
              ['The nine states', 'User Running · Kernel Running · Ready to Run, in Memory · Preempted · Asleep in Memory · Ready to Run, Swapped · Sleeping, Swapped · Created · Zombie.'],  // card 3: the list of the nine states
              ['Why a Preempted state?', 'It works like Ready in Memory, but shows that the <b>nonpreemptible</b> kernel forces a switch only as a process returns to user mode (sleeping in the kernel is voluntary). That rules out real-time use.'],  // card 4: why Preempted is a separate state
              ['Process 0 and process 1', 'The kernel builds <b>process 0</b> (the swapper) at boot. It creates <b>process 1</b> (init), the ancestor of every other process.'],  // card 5: process 0 and process 1
              ['Three kinds of context', '<b>User-level</b>: text, data, user stack, shared memory. <b>Register</b>: PC, status register, SP, general registers. <b>System-level</b>: process table entry, U area, region table, kernel stack.'],  // card 6: the three kinds of context and their parts
              ['Process table entry vs U area', 'Process table entry: <b>always reachable</b> (state, IDs, priority, signals, event). U area: needed <b>only while running</b> (open files, system-call data).'],  // card 7: process table entry versus U area
              ['fork() in six steps', 'Slot, unique PID, copy the image (not shared memory), bump file counters, Ready to Run, return the child’s PID to the parent and 0 to the child. Then run the parent, the child or another process.'],  // card 8: the six steps of fork() and the three choices after it
            ].map(([f, b]) => [f, `<div>${b}</div>`]), { cols: 4, height: 184 }),  // wraps each answer in its own block, and lays the cards out four across
            h('div', { class: 'callout why m0', 'data-label': 'The one-sentence version', html: 'A UNIX process is a user program that borrows kernel mode whenever it needs the OS, moves through nine states that refine the seven-state model, carries three layers of context, and is born when <code>fork()</code> clones its parent.' })));  // "one-sentence version" box: the whole section in a single sentence; the brackets close the layout
        },  // ends render() for step 8
      },  // ends step 8

      /* ---------------- 9. Check yourself ---------------- */
      {  // step 9 (Check Yourself): the section quiz, drawn by the guide from the questions below
        title: 'Check yourself',  // the title shown at the top of step 9
        kind: 'check',  // kind "check" labels it as the quiz step
        quiz: [  // the quiz questions; the guide builds the question screens, checks answers and saves progress
          { q: 'In UNIX SVR4, what happens when a user process makes a system call?',  // quiz question 1 (multiple choice): what happens when a user process makes a system call
            choices: ['The same process switches into kernel mode and executes the kernel’s code itself', 'The request is passed to a separate kernel process, which runs it and replies', 'The process is swapped out to disk until the kernel has finished', 'The swapper (process 0) executes the call on the process’s behalf'],  // choices: the same process runs kernel code (right); a separate kernel process; swapped out; the swapper runs it
            answer: 0,  // the right answer is choice 0
            feedback: [null, 'SVR4 does not use a separate “OS process” for services; the kernel code runs inside the calling process.', 'A system call needs no swapping. The process simply changes mode and keeps running, now in the kernel.', 'The swapper only moves process images between memory and disk; it does not run other processes’ system calls.'],  // feedback for each wrong choice
            why: 'SVR4 runs most of the OS within the environment of the user process: a system call is just a switch to kernel mode inside the same process, with no process switch needed.' },  // explanation: a system call is just a switch to kernel mode inside the same process
          { type: 'tf', q: 'A UNIX system process runs in user mode most of the time and switches into kernel mode only for system calls.', answer: false,  // quiz question 2 (true or false): a system process runs mostly in user mode? False
            why: 'That describes a user process. A system process runs only in kernel mode and executes OS code for housekeeping, such as memory allocation and swapping.' },  // explanation: that describes a user process; system processes run only in kernel mode
          { type: 'match', q: 'Match each UNIX process state to its meaning.',  // quiz question 3 (match pairs): each UNIX state with its meaning
            pairs: [['Asleep in Memory', 'Waiting for an event; image in main memory'], ['Sleeping, Swapped', 'Waiting for an event; image on disk'], ['Ready to Run, Swapped', 'Could run, but must be swapped in first'], ['Created', 'Just made by fork(); not yet ready to run'], ['Zombie', 'Finished; leaves a record for its parent'], ['Preempted', 'Was returning to user mode when the kernel switched away']],  // the six pairs of state and meaning
            why: 'Two questions sort most states: can it run (ready or waiting for an event)? And where is its image (main memory or disk)? Created, Zombie and Preempted mark birth, death and the preemption point.' },  // explanation: can it run, and where is its image? Those two questions sort most states
          { q: 'Why does UNIX show Preempted as a state separate from Ready to Run, in Memory?',  // quiz question 4 (multiple choice): why Preempted is drawn as a separate state
            choices: ['To stress that preemption happens only when a process is about to return from kernel mode to user mode', 'Because a preempted process is kept on disk until it runs again', 'Because a preempted process jumps ahead of every other ready process', 'Because a preempted process must restart its system call from the beginning'],  // choices: preemption happens only on the return to user mode (right); on disk; jumps the queue; restarts its call
            answer: 0,  // the right answer is choice 0
            feedback: [null, 'A preempted process stays in main memory; being on disk is what the Swapped states describe.', 'Nothing in the model gives it priority; it waits like any ready process.', 'Its kernel work was already finished, which is exactly why it returns straight to User Running.'],  // feedback for each wrong choice
            why: 'The two states are essentially the same kind of waiting. Keeping Preempted separate shows that the traditional kernel is nonpreemptible: it never forces a process off the processor in the middle of kernel code, only at the return to user mode (a process may still give it up voluntarily by sleeping in the kernel). That also makes it unsuitable for real-time work.' },  // explanation: the two states are the same kind of waiting; the separate state marks the only forced-switch point
          { type: 'multi', q: 'Which of these correctly map a UNIX state onto the seven-state model?',  // quiz question 5 (select all): which UNIX states map correctly onto the seven-state model
            choices: ['User Running and Kernel Running → Running', 'Preempted → Blocked', 'Sleeping, Swapped → Blocked/Suspend', 'Created → New', 'Zombie → Ready/Suspend'],  // choices: two correct mappings to Running, New and Blocked/Suspend, and two wrong ones (Preempted, Zombie)
            answer: [0, 2, 3],  // the right answers are choices 0, 2 and 3
            why: 'Running splits by mode into User Running and Kernel Running. Preempted is a kind of Ready (not Blocked), and Zombie corresponds to Exit.' },  // explanation: Preempted is a kind of Ready and Zombie is Exit
          { type: 'bucket', q: 'Where does the kernel keep each field: in the process table entry or in the U area?',  // quiz question 6 (sort into buckets): process table entry or U area for each field
            buckets: ['Process table entry', 'U area'],  // the two buckets
            items: [['Event descriptor', 0], ['Signal (sent but not yet handled)', 0], ['Memory status', 0], ['Signal-handler array', 1], ['User file descriptor table', 1]],  // items: three process-table fields and two U-area fields
            why: 'The process table entry holds what the kernel needs even when the process is not running (to schedule, wake or swap it). The U area holds what is needed only while the process runs its own system calls.' },  // explanation: needed when not running goes in the process table; needed only while running goes in the U area
          { type: 'bucket', q: 'Which part of the UNIX process image does each item belong to?',  // quiz question 7 (sort into buckets): which layer of context each item belongs to
            buckets: ['User-level', 'Register', 'System-level'],  // the three buckets: user-level, register, system-level
            items: [['Process text', 0], ['Program counter', 1], ['Processor status register', 1], ['Kernel stack', 2], ['Per-process region table', 2]],  // items: process text, program counter, status register, kernel stack, region table
            why: 'User-level context is what the program itself sees, register context is the processor’s registers for this process, and system-level context is the kernel’s private bookkeeping about it.' },  // explanation: what each layer of context holds
          { type: 'order', q: 'Put the kernel’s work during fork() in order.',  // quiz question 8 (put in order): the kernel's six steps during fork()
            items: ['Allocate a slot in the process table', 'Assign a unique process ID to the child', 'Copy the parent’s process image, except shared memory', 'Increment the counters of files the parent has open', 'Put the child in the Ready to Run state', 'Return the child’s ID to the parent and 0 to the child'],  // the six steps, listed here in the right order; the quiz shuffles them
            why: 'The kernel first reserves a slot and an ID, then builds the child as a copy of the parent (sharing, not copying, shared memory), accounts for the inherited open files, makes the child ready, and finally returns two different values.' },  // explanation: slot and ID first, then copy, file counts, Ready to Run and the two return values
          { type: 'num', q: 'How many lines does this program print in total?',  // quiz question 9 (number): lines printed by the if (fork() == 0) fork(); program
            code: 'if (fork() == 0)   // fork; did it return 0?\n    fork();        // runs only where it returned 0\nprintf("X\\n");     // print one line', answer: 3, tol: 0, unit: 'lines',  // the code shown with the question; the answer is exactly 3 lines
            why: 'fork() returns the new child’s ID (never 0) in the parent and 0 in the child. So the parent skips the inner fork, while the child runs it and makes a grandchild. Parent, child and grandchild each print X once: 3 lines.' },  // explanation: the parent skips the inner fork and the child makes a grandchild
          { type: 'multi', q: 'A UNIX kernel has just completed all of its work for a <code>fork()</code> call. Which of these may it do next?',  // quiz question 10 (select all): what the kernel may do right after fork()
            choices: ['Return to the parent in user mode, at the point of the fork call', 'Switch to the child, which starts executing at the return from fork()', 'Switch to some other process, leaving both parent and child Ready to Run', 'Start the child at the first line of its program’s main function', 'Hold the child in the Created state until the parent calls wait()'],  // choices: stay in the parent, switch to the child, run another process, and two wrong ideas
            answer: [0, 1, 2],  // the right answers are choices 0, 1 and 2
            why: 'The kernel may stay in the parent, switch to the child, or run another process. The child never starts from the top of its program: it resumes at the return from fork(), and it is already Ready to Run, not Created.' },  // explanation: the child resumes at the return from fork() and is already Ready to Run
          { type: 'num', q: 'How many lines (counting both A and B) does this program print in total? Assume the output goes to a terminal, so each <code>printf</code> that ends in <code>\\n</code> is written out at once.',  // quiz question 11 (number): lines printed by fork, print A, fork, print B, with output to a terminal
            code: 'fork();          // ask for a child\nprintf("A\\n");   // print A\nfork();          // ask for another child\nprintf("B\\n");   // print B', answer: 6, tol: 0, unit: 'lines',  // the code shown with the question; the answer is exactly 6 lines
            why: 'Every process alive runs each later fork, so each fork doubles the count. Two processes exist when A is printed (2 lines). Both then fork, making 4 processes, and all 4 print B (4 lines): 2 + 4 = 6. <b>Why the count can change:</b> sent to a file or pipe, the output is buffered inside each process, the second fork copies the unwritten “A”, and 8 lines appear; <code>fflush(stdout)</code> before <code>fork()</code> prevents that.' },  // explanation: 2 A lines plus 4 B lines, and why buffering to a file would give 8
          { q: 'Which process does the kernel build by hand when the system boots, rather than creating it with fork()?',  // quiz question 12 (multiple choice): which process the kernel builds by hand at boot
            choices: ['Process 0, the swapper', 'Process 1, init', 'The first login shell', 'The first program a user runs'],  // choices: process 0 the swapper (right), init, the first login shell, the first user program
            answer: 0,  // the right answer is choice 0
            feedback: [null, 'init is process 1: it is created by process 0, and it is the ancestor of every other process.', 'Login shells are started (indirectly) by init, long after boot.', 'User programs are always created by fork() from an existing process.'],  // feedback for each wrong choice
            why: 'Process 0 (the swapper) is hand-made at boot. It creates process 1 (init), from which every other process descends; init starts a process for each user who logs in.' },  // explanation: process 0 is hand-made and creates init, the ancestor of every other process
        ],  // ends the quiz questions
      },  // ends step 9
    ],  // ends the list of steps

    notes: `${/* the section notes start here: a plain summary the student can open from the Notes button at any time */''}
      <h3>1. Where the kernel runs in UNIX SVR4</h3>${/* notes heading 1: where the kernel runs in SVR4 */''}
      <p>In SVR4 <b>most of the OS executes inside the environment of a user process</b>. On a system call, exception or interrupt the <b>same process</b> switches to kernel mode and runs kernel code on its own kernel stack: a cheap mode switch, not a process switch. Interrupts are handled inside whichever process is running.</p>${/* notes paragraph: most of the OS runs inside user processes, so a system call is only a mode switch */''}
      <ul>${/* start of the list of the two kinds of process */''}
        <li><b>System processes</b> run <b>only in kernel mode</b>, executing OS housekeeping code such as memory allocation and swapping (e.g. process 0, the swapper).</li>${/* list item: system processes run only in kernel mode */''}
        <li><b>User processes</b> run programs and utilities in <b>user mode</b>, and switch to <b>kernel mode</b> to execute kernel instructions on a system call, exception or interrupt.</li>${/* list item: user processes run in user mode and enter kernel mode when needed */''}
      </ul>${/* end of the list */''}

      <h3>2. The nine UNIX process states</h3>${/* notes heading 2: the nine states */''}
      <table>${/* start of the table of states */''}
        <tr><th>UNIX state</th><th>Meaning</th><th>Seven-state</th></tr>${/* table header row: UNIX state, meaning, seven-state name */''}
        <tr><td>User Running</td><td>Executing its own program in user mode.</td><td rowspan="2">Running</td></tr>${/* table row: User Running (with Kernel Running, maps to Running) */''}
        <tr><td>Kernel Running</td><td>The same process executing kernel code in kernel mode.</td></tr>${/* table row: Kernel Running */''}
        <tr><td>Ready to Run, in Memory</td><td>Ready to run as soon as the kernel schedules it.</td><td rowspan="2">Ready</td></tr>${/* table row: Ready to Run, in Memory (with Preempted, maps to Ready) */''}
        <tr><td>Preempted</td><td>Was returning from kernel mode to user mode, but the kernel preempted it and switched to another process.</td></tr>${/* table row: Preempted */''}
        <tr><td>Asleep in Memory</td><td>Cannot run until an event occurs; image in main memory.</td><td>Blocked</td></tr>${/* table row: Asleep in Memory, maps to Blocked */''}
        <tr><td>Ready to Run, Swapped</td><td>Ready, but the swapper must bring it into main memory first.</td><td>Ready/Suspend</td></tr>${/* table row: Ready to Run, Swapped, maps to Ready/Suspend */''}
        <tr><td>Sleeping, Swapped</td><td>Waiting for an event and swapped out to disk.</td><td>Blocked/Suspend</td></tr>${/* table row: Sleeping, Swapped, maps to Blocked/Suspend */''}
        <tr><td>Created</td><td>Newly created, not yet ready to run.</td><td>New</td></tr>${/* table row: Created, maps to New */''}
        <tr><td>Zombie</td><td>No longer exists, but leaves a record (exit status, usage times) for its parent to collect.</td><td>Exit</td></tr>${/* table row: Zombie, maps to Exit */''}
      </table>${/* end of the table */''}
      <p>Running is split by mode; Ready is split into Ready to Run, in Memory and Preempted (below, “Ready in Memory” and “Ready, Swapped” are short for the two Ready to Run states). Those two are essentially the same state (one queue for the scheduler), but Preempted is kept apart to stress that preemption happens <b>only as a process is about to return from kernel mode to user mode</b>. The traditional kernel is <b>nonpreemptible</b>: it never <b>forces</b> a process off the processor in the middle of kernel code (involuntary preemption waits until the process is about to return to user mode), which makes it unsuitable for real-time work. This does not mean no switch can happen in kernel mode: a process that <b>sleeps</b> inside the kernel to wait for an event gives up the processor <b>voluntarily</b>, and the kernel switches to another process right there.</p>${/* notes paragraph: why Preempted is separate, what a nonpreemptible kernel is, and why sleeping in the kernel is still allowed */''}

      <h3>3. Transitions and a typical life</h3>${/* notes heading 3: transitions and a typical life */''}
      <ul>${/* start of the list of transitions */''}
        <li><b>fork</b> → Created; <b>enough memory</b> → Ready in Memory; <b>not enough memory</b> (swapping systems) → Ready, Swapped.</li>${/* list item: fork, then enough memory or not enough memory */''}
        <li><b>reschedule</b>: Ready in Memory → Kernel Running. <b>return to user</b>: Kernel Running → User Running. <b>system call / interrupt</b>: User Running → Kernel Running; an interrupt in the kernel returns to Kernel Running.</li>${/* list item: reschedule, return to user, and system call or interrupt */''}
        <li><b>sleep</b>: Kernel Running → Asleep in Memory. <b>wakeup</b>: Asleep in Memory → Ready in Memory; Sleeping, Swapped → Ready, Swapped.</li>${/* list item: sleep and the two kinds of wakeup */''}
        <li><b>swap out</b>: Asleep → Sleeping, Swapped; Ready in Memory → Ready, Swapped. <b>swap in</b>: Ready, Swapped → Ready in Memory.</li>${/* list item: swap out and swap in */''}
        <li><b>preempt</b>: Kernel Running → Preempted; <b>return to user</b>: Preempted → User Running. <b>exit</b>: Kernel Running → Zombie.</li>${/* list item: preempt, return to user from Preempted, and exit */''}
      </ul>${/* end of the list */''}
      <p>A process is always switched out, and always resumes, inside the kernel (Kernel Running).</p>${/* notes paragraph: a process is always switched out and resumed inside the kernel */''}

      <h3>4. Process 0 and process 1</h3>${/* notes heading 4: process 0 and process 1 */''}
      <p><b>Process 0</b>, the <b>swapper</b>, is built by the kernel at boot. It spawns <b>process 1</b>, <b>init</b>, the ancestor of every other process. init creates a user process for each interactive user who logs in (the user’s shell). Every process except process 0 is created by <code>fork()</code>, which needs an existing process to copy.</p>${/* notes paragraph: the swapper is built at boot and creates init, the ancestor of all */''}
      <h3>5. The process image: three kinds of context</h3>${/* notes heading 5: the three kinds of context */''}
      <ul>${/* start of the list of contexts */''}
        <li><b>User-level context</b>: process text (executable machine instructions), process data, user stack (arguments, locals, return addresses in user mode), shared memory (one physical copy, mapped by every sharer).</li>${/* list item: user-level context and its four parts */''}
        <li><b>Register context</b>: program counter, processor status register (hardware status, including mode), stack pointer (user or kernel stack), general-purpose registers. Copied to memory when the process enters the kernel or is switched out.</li>${/* list item: register context and its four registers */''}
        <li><b>System-level context</b>: process table entry (always accessible to the kernel), U area (needed only while the process runs), per-process region table (virtual-to-physical mapping plus permission field: read-only, read-write, read-execute), kernel stack (frames of kernel functions called in kernel mode).</li>${/* list item: system-level context and its four parts */''}
      </ul>${/* end of the list */''}

      <h3>6. Process table entry versus U area</h3>${/* notes heading 6: process table entry versus U area */''}
      <p><b>Process table entry</b>: process status; pointers to the U area and memory; process size; user IDs (real, effective); process IDs (own, parent); event descriptor (event a sleeper awaits); priority; signal (sent, not yet handled); timers (execution time, resource use, alarm); <b>P_link</b> (next in the ready queue); memory status (in memory or swapped; locked).</p>${/* notes paragraph: the fields kept in the process table entry */''}
      <p><b>U area</b>: process table pointer; user IDs; timers (user- and kernel-mode time of the process and its children); signal-handler array (exit, ignore or run a function); control terminal; error field; return value (of a system call); I/O parameters; file parameters (current directory and root); user file descriptor table (open files); limit fields; permission modes fields.</p>${/* notes paragraph: the fields kept in the U area */''}
      <p>User IDs and timers appear in both. <b>Rule of thumb:</b> needed even when the process is not running (to schedule, wake, signal or swap it)? Process table entry, which always stays in memory. Needed only while it runs its own system calls? U area, which can be swapped out.</p>${/* notes paragraph: fields kept in both, and the rule of thumb */''}

      <h3>7. Process creation with fork()</h3>${/* notes heading 7: process creation with fork() */''}
      <p>A process is created by the system call <code>pid = fork();</code>. In kernel mode, inside the parent, the kernel:</p>${/* notes paragraph: fork() runs in kernel mode inside the parent, in six steps */''}
      <ol>${/* start of the numbered list of steps */''}
        <li>allocates a slot in the process table for the new process;</li>${/* step 1: allocate a process-table slot */''}
        <li>assigns a unique process ID to the child;</li>${/* step 2: assign a unique process ID */''}
        <li>copies the parent’s process image, except any shared memory (shared, not copied);</li>${/* step 3: copy the parent's image, except shared memory */''}
        <li>increments the counters of files the parent has open (the child owns them too);</li>${/* step 4: increment the counts of open files */''}
        <li>assigns the child to the Ready to Run state;</li>${/* step 5: make the child Ready to Run */''}
        <li>returns the ID of the child to the parent, and 0 to the child.</li>${/* step 6: return the child's ID to the parent and 0 to the child */''}
      </ol>${/* end of the list */''}
      <p>Then the kernel chooses one of three options: <b>stay in the parent</b> (it returns to user mode at the point of the fork call); <b>switch to the child</b> (it starts at the return from <code>fork()</code>, not at the top of its program); or <b>switch to another process</b> (parent and child both stay Ready to Run). The choice changes the order of output, never the amount (with output to a terminal; see section 8). The return value tells them apart (0 = child; the child’s ID = parent; −1 = failure). Typically the child calls <code>exec</code> to load a new program (same PID), and the parent’s <code>wait()</code> sleeps until the child exits, then collects its zombie record. Real kernels defer copying (copy-on-write) with the same visible effect.</p>${/* notes paragraph: the three choices after fork, exec, wait and the meaning of the return value */''}
      <pre>pid = fork();                         /* clone the caller */${/* shown code, line 1: pid = fork() clones the calling process */''}
if (pid == 0) execlp("ls","ls",NULL); /* child: become ls  */${/* shown code, line 2: the child becomes the ls program */''}
else wait(NULL);                      /* parent: wait      */</pre>${/* shown code, line 3: the parent waits for the child to finish */''}

      <h3>8. Counting processes and printed lines</h3>${/* notes heading 8: counting processes and printed lines */''}
      <p>After a fork <b>both</b> processes run every later line, including later forks, so n forks in a row give 2ⁿ processes (three forks, then printf: 8 lines). <code>fork(); printf("A\\n"); fork(); printf("B\\n");</code> prints 2 A + 4 B = 6 lines. <code>if (fork() == 0) fork(); printf("X\\n");</code> prints 3 lines (parent, child, grandchild). Line order may vary between runs; with output to a terminal, the count cannot.</p>${/* notes paragraph: every process runs every later line, with worked counts for three programs */''}
      <h4>Why the count can change: output buffering</h4>${/* notes subheading: why the count can change when output is buffered */''}
      <p>These counts assume the output goes to a <b>terminal</b>. There the C library writes each line as soon as <code>printf</code> prints its <code>\\n</code> (line buffering). If the output is <b>redirected to a file or a pipe</b>, the library switches to full buffering: printed text waits in a buffer in the process’s own memory until the buffer fills or the process exits. Because <code>fork()</code> copies that memory, it also copies any text still waiting. In the A/B program each of the two processes still holds an unwritten “A\\n” at the second fork, so all four processes end up writing A and B: 4 A + 4 B = <b>8</b> lines. Calling <code>fflush(stdout)</code> just before <code>fork()</code> empties the buffer first and restores the count of 6. (For the same reason, a buffered line printed just before <code>exec</code> can vanish: exec replaces the memory that held it.)</p>`,  // notes paragraph: buffering to a file or pipe copies unwritten text at fork, giving 8 lines instead of 6; the end of the notes text
  });  // closes the object passed to Guide.section
})();  // ends the wrapper function and runs it straight away
