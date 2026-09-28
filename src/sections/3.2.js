// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 3.2 — Process States
   Traces and the dispatcher, the two-state model, creation and
   termination, the five-state model, queues, and suspension
   (the seven-state model). Helpers live in the IIFE so nothing
   leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  /* ------------------------------------------------------------------
     Shared helpers: state names, diagram layouts, the diagram builder
     ------------------------------------------------------------------ */
  const NAME = { nr: 'Not Running', new: 'New', ready: 'Ready', running: 'Running', blocked: 'Blocked', exit: 'Exit', rs: 'Ready/Suspend', bs: 'Blocked/Suspend', sus: 'Suspend' };  // NAME maps each short state key (nr, rs, bs...) to the full label printed inside that state's box
  const SHAPE = { nr: 's-panel', new: 's-panel', ready: 's-proc', running: 's-cpu', blocked: 's-warn', exit: 's-panel', rs: 's-proc', bs: 's-warn', sus: 's-panel' };  // SHAPE picks a colour class per state: Running uses the CPU blue, Ready the process teal, Blocked the caution colour
  const SUSPENDED = ['rs', 'bs', 'sus'];  // SUSPENDED lists the states whose process has been moved out of main memory; their boxes get a dashed border
  const L = (x1, y1, x2, y2) => `M${x1},${y1} L${x2},${y2}`;  // L(x1, y1, x2, y2): builds the SVG (the browser's drawing format) path text for a straight line between two points

  /* Each layout: vb = viewBox size, w/h = state box size, st = box centres,
     ar = arrows as [id, path, labelX, labelY, anchor, label, dashed?]. */
  const MODELS = {  // MODELS holds the drawing layout of every state diagram in this section, keyed by model name
    two: {  // layout "two": the two-state model (Not Running and Running) used in step 3
      vb: [560, 170], w: 150, h: 52,  // drawing area 560 by 170 units; each state box is 150 wide and 52 tall
      st: { nr: [170, 85], running: [400, 85] },  // centre points of the two boxes: Not Running on the left, Running on the right
      ar: [  // the four arrows of the two-state model, one row per arrow
        ['enter', L(14, 85, 95, 85), 54, 74, 'middle', 'enter'],  // arrow "enter": a new process comes in from the left edge and joins Not Running
        ['dispatch', L(245, 72, 325, 72), 285, 60, 'middle', 'dispatch'],  // arrow "dispatch": the upper arrow that carries a process from Not Running to Running
        ['pause', L(325, 98, 245, 98), 285, 119, 'middle', 'pause'],  // arrow "pause": the lower arrow back from Running to Not Running when the process is interrupted
        ['exit', L(475, 85, 546, 85), 510, 74, 'middle', 'exit'],  // arrow "exit": leaves Running to the right when the process finishes
      ],  // closes the arrow list of the two-state layout
    },  // closes the "two" layout
    five: {  // layout "five": the five-state model (New, Ready, Running, Blocked, Exit)
      vb: [480, 330], w: 120, h: 46,  // drawing area 480 by 330 units with 120 by 46 state boxes
      st: { new: [70, 55], ready: [140, 165], running: [340, 165], exit: [410, 55], blocked: [240, 290] },  // box centres: New top left, Exit top right, Ready and Running across the middle, Blocked at the bottom
      ar: [  // the arrows of the five-state model
        ['create', L(70, 2, 70, 32), 80, 17, 'start', 'create'],  // arrow "create": a short line from the top edge into New, showing the process being created
        ['admit', L(88, 78, 118, 142), 96, 114, 'end', 'admit'],  // arrow "admit": New to Ready, when the OS agrees to take on the process
        ['dispatch', L(200, 154, 280, 154), 240, 145, 'middle', 'dispatch'],  // arrow "dispatch": Ready to Running, when the dispatcher hands the processor to this process
        ['timeout', L(280, 176, 200, 176), 240, 195, 'middle', 'timeout'],  // arrow "timeout": Running back to Ready when the process's time slice runs out
        ['release', L(365, 142, 395, 78), 388, 116, 'start', 'release'],  // arrow "release": Running to Exit when the process finishes or is stopped
        ['wait', L(318, 188, 268, 267), 300, 236, 'start', 'event wait'],  // arrow "event wait": Running down to Blocked when the process must wait for something such as I/O
        ['occurs', L(212, 267, 162, 188), 180, 236, 'end', 'event occurs'],  // arrow "event occurs": Blocked back up to Ready once the awaited event has happened
        ['killReady', 'M150,142 C 175,72 240,55 350,55', 262, 44, 'middle', 'terminated', true],  // dashed curved arrow: a Ready process can be terminated directly (for example, killed by its parent)
        ['killBlocked', 'M300,295 C 470,300 470,150 430,78', 452, 306, 'end', 'terminated', true],  // dashed curved arrow: a Blocked process can also be terminated without ever running again
      ],  // closes the arrow list of the five-state layout
    },  // closes the "five" layout
    /* the first attempt at suspension: ONE Suspend state (six states in all) */
    one: {  // layout "one": the six-state model with a single Suspend state for processes swapped out to disk
      vb: [500, 262], w: 112, h: 40,  // drawing area 500 by 262 units with 112 by 40 boxes
      st: { new: [75, 45], exit: [425, 45], ready: [190, 135], running: [385, 135], sus: [75, 235], blocked: [300, 235] },  // box centres: New and Exit on top, Ready and Running in the middle, Suspend and Blocked at the bottom
      ar: [  // the arrows of the one-Suspend-state model
        ['create', L(75, 2, 75, 23), 85, 15, 'start', 'create'],  // arrow "create" into New from the top edge
        ['admit', L(105, 65, 158, 113), 124, 97, 'end', 'admit'],  // arrow "admit": New to Ready
        ['dispatch', L(246, 126, 327, 126), 287, 118, 'middle', 'dispatch'],  // arrow "dispatch": Ready to Running
        ['timeout', L(329, 144, 248, 144), 288, 162, 'middle', 'timeout'],  // arrow "timeout": Running back to Ready
        ['release', L(410, 115, 425, 67), 425, 96, 'start', 'release'],  // arrow "release": Running to Exit
        ['wait', L(370, 155, 325, 213), 356, 192, 'start', 'event wait'],  // arrow "event wait": Running down to Blocked
        ['occurs', L(275, 215, 218, 157), 238, 192, 'end', 'event occurs'],  // arrow "event occurs": Blocked back up to Ready
        ['activate', L(105, 215, 160, 157), 116, 190, 'end', 'activate'],  // arrow "activate": Suspend back to Ready, bringing a process back into memory
        ['suspend', L(242, 235, 133, 235), 187, 227, 'middle', 'suspend'],  // arrow "suspend": Blocked to Suspend, swapping a waiting process out to disk to free memory
      ],  // closes the arrow list of the "one" layout
    },  // closes the "one" layout
    /* the fix, zoomed in: the four "waiting? / in memory?" states plus Running (New and Exit left out) */
    split: {  // layout "split": a close-up of the four suspended and unsuspended waiting states plus Running
      vb: [540, 236], w: 124, h: 40,  // drawing area 540 by 236 units with 124 by 40 boxes
      st: { rs: [72, 55], ready: [272, 55], running: [468, 55], bs: [72, 200], blocked: [272, 200] },  // box centres: Ready/Suspend, Ready and Running on top; Blocked/Suspend and Blocked below
      ar: [  // the arrows of the close-up layout
        ['activate', L(134, 47, 208, 47), 171, 39, 'middle', 'activate'],  // arrow "activate": Ready/Suspend to Ready, bringing a ready process back into memory
        ['suspendR', L(210, 63, 136, 63), 173, 80, 'middle', 'suspend'],  // arrow "suspend": Ready to Ready/Suspend, swapping a ready process out to disk
        ['dispatch', L(334, 47, 404, 47), 369, 39, 'middle', 'dispatch'],  // arrow "dispatch": Ready to Running
        ['timeout', L(406, 63, 336, 63), 371, 80, 'middle', 'timeout'],  // arrow "timeout": Running back to Ready
        ['wait', L(440, 75, 320, 178), 400, 138, 'start', 'event wait'],  // arrow "event wait": Running down to Blocked
        ['occurs', L(272, 180, 272, 77), 264, 135, 'end', 'event occurs'],  // arrow "event occurs": Blocked up to Ready when the awaited event happens
        ['suspendB', L(208, 192, 136, 192), 172, 184, 'middle', 'suspend'],  // arrow "suspend": Blocked to Blocked/Suspend, swapping a waiting process out to disk
        ['activateB', L(136, 210, 208, 210), 172, 228, 'middle', 'activate'],  // arrow "activate": Blocked/Suspend back to Blocked, returning it to memory while it still waits
        ['occursS', L(72, 180, 72, 77), 80, 135, 'start', 'event occurs'],  // arrow "event occurs": Blocked/Suspend up to Ready/Suspend, the event came while the process was on disk
      ],  // closes the arrow list of the "split" layout
    },  // closes the "split" layout
    seven: {  // layout "seven": the full seven-state model with two suspended states
      vb: [600, 345], w: 132, h: 42,  // drawing area 600 by 345 units with 132 by 42 boxes
      st: { new: [80, 50], exit: [510, 50], rs: [80, 175], ready: [290, 175], running: [495, 175], bs: [80, 300], blocked: [290, 300] },  // box centres: New and Exit on top, the Ready row in the middle, the Blocked row at the bottom
      ar: [  // the arrows of the seven-state model
        ['create', L(80, 2, 80, 29), 90, 15, 'start', 'create'],  // arrow "create" into New from the top edge
        ['admit', L(146, 64, 244, 154), 176, 104, 'end', 'admit'],  // arrow "admit": New to Ready when memory is available
        ['admitS', L(80, 71, 80, 154), 88, 116, 'start', 'admit'],  // arrow "admit": New straight down to Ready/Suspend when the OS admits a process but keeps it on disk
        ['activate', L(146, 167, 224, 167), 185, 159, 'middle', 'activate'],  // arrow "activate": Ready/Suspend to Ready
        ['suspendR', L(224, 185, 146, 185), 185, 202, 'middle', 'suspend'],  // arrow "suspend": Ready to Ready/Suspend
        ['dispatch', L(356, 167, 429, 167), 392, 159, 'middle', 'dispatch'],  // arrow "dispatch": Ready to Running
        ['timeout', L(429, 185, 356, 185), 392, 202, 'middle', 'timeout'],  // arrow "timeout": Running back to Ready
        ['release', L(500, 154, 508, 71), 512, 116, 'start', 'release'],  // arrow "release": Running to Exit
        ['wait', L(460, 196, 340, 279), 412, 250, 'start', 'event wait'],  // arrow "event wait": Running down to Blocked
        ['occurs', L(290, 279, 290, 196), 282, 242, 'end', 'event occurs'],  // arrow "event occurs": Blocked up to Ready
        ['suspendB', L(224, 293, 146, 293), 185, 285, 'middle', 'suspend'],  // arrow "suspend": Blocked to Blocked/Suspend
        ['activateB', L(146, 309, 224, 309), 185, 327, 'middle', 'activate'],  // arrow "activate": Blocked/Suspend back to Blocked
        ['occursS', L(80, 279, 80, 196), 88, 242, 'start', 'event occurs'],  // arrow "event occurs": Blocked/Suspend up to Ready/Suspend
        ['suspendRun', 'M455,154 C 420,95 190,95 120,154', 300, 103, 'middle', 'suspend'],  // curved arrow "suspend": Running straight to Ready/Suspend, used when the OS needs memory right now
      ],  // closes the arrow list of the seven-state layout
      note: [596, 340, 'Any state → Exit if the process is killed'],  // note printed in the bottom right corner instead of drawing a kill arrow from every state
    },  // closes the "seven" layout
  };  // closes the MODELS table

  /* Build a state diagram.  o.onArrow(id) / o.onState(id) make parts clickable,
     o.counts adds a count bubble to every state.  Returns an API to recolour it. */
  function diagram(ctx, key, o = {}) {  // diagram(ctx, key, o): draws the state diagram named key from MODELS and returns controls to recolour it later
    const { s } = ctx;  // pulls out ctx.s, the guide's helper that creates one SVG element with its attributes and children
    const M = MODELS[key];  // M is the layout (sizes, box centres and arrows) of the requested model
    const svg = s('svg', { viewBox: `0 0 ${M.vb[0]} ${M.vb[1]}`, width: '100%', class: 'sd', role: 'img', 'aria-label': o.label || 'process state diagram' });  // the outer SVG element; its viewBox matches the layout size and it stretches to the full width of its box
    const arrowLayer = s('g'), stateLayer = s('g'), top = s('g');  // three layers, drawn in order: arrows first, state boxes over them, then notes and warning marks on top
    svg.append(arrowLayer, stateLayer, top);  // puts the layers into the SVG so later items paint over earlier ones
    const ar = {}, st = {};  // ar and st remember each drawn arrow and box by id so the step code can recolour them later
    M.ar.forEach(([id, d, lx, ly, anchor, text, dash]) => {  // draws every arrow of the layout, unpacking its id, path, label position, label alignment, text and dashed flag
      const ln = s('path', { d, class: 'ln', 'marker-end': 'url(#arr)' });  // the visible line of the arrow, ending in the standard arrowhead
      const g = s('g', { class: 'ar' + (dash ? ' dash' : '') + (o.onArrow ? ' hot' : ''), 'data-id': id },  // a group for the arrow; "dash" makes it dashed and "hot" shows a pointer cursor when the arrow can be clicked
        ln, s('path', { d, class: 'hit' }), s('text', { x: lx, y: ly, 'text-anchor': anchor }, text));  // inside the group: the visible line, a wide invisible copy that is easier to click, and the arrow's label
      if (o.onArrow) g.addEventListener('click', () => o.onArrow(id));  // when the step asked for clickable arrows, a click reports this arrow's id back to the step
      arrowLayer.append(g);  // adds the finished arrow to the arrow layer
      ar[id] = { g, ln };  // records the group and its line so arrow() can restyle them later
    });  // ends the loop over the arrows
    for (const [id, [x, y]] of Object.entries(M.st)) {  // draws every state box, reading each state's id and centre point from the layout
      const w = M.w, h = M.h;  // w and h are the box width and height, the same for every box in this layout
      const g = s('g', { class: 'st' + (SUSPENDED.includes(id) ? ' dash' : '') + (o.onState ? ' hot' : ''), 'data-id': id },  // a group for the state; suspended states get a dashed border, clickable ones a pointer cursor
        s('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 12, class: SHAPE[id] }),  // the rounded rectangle, centred on (x, y) and coloured by the SHAPE class for this state
        s('text', { x, y: o.counts ? y - 7 : y + 1, class: 'nm' }, NAME[id]));  // the state's name; it moves up a little when a count line has to fit underneath
      let cnt = null;  // cnt will hold the "N processes" text under the name, if this diagram shows counts
      if (o.counts) {  // only diagrams built with o.counts show how many processes sit in each state
        cnt = s('text', { x, y: y + 12, class: 'cnt s-sub' }, 'empty');  // the count text starts as "empty" in the muted colour, just below the state's name
        g.append(cnt);  // adds the count text inside the state's group
      }  // ends the count setup
      if (o.onState) g.addEventListener('click', () => o.onState(id));  // when states are clickable, a click reports this state's id back to the step
      stateLayer.append(g);  // adds the finished box to the state layer
      st[id] = { g, cnt, x, y };  // records the group, its count text and its centre so later code can find them
    }  // ends the loop over the states
    if (M.note) top.append(s('text', { x: M.note[0], y: M.note[1], 'text-anchor': 'end', class: 'note' }, M.note[2]));  // if the layout has a note, it is printed right-aligned at the given point in the top layer
    const ghostLayer = s('g');  // ghostLayer holds the temporary red "not allowed" arrow drawn by ghost()
    top.append(ghostLayer);  // places that layer on top so the warning arrow is never hidden behind a box
    // point on the edge of box (cx,cy) in the direction of (tx,ty)
    const edge = (cx, cy, tx, ty) => {  // edge(): finds where a line from a box's centre toward another point leaves the box, so arrows start at the border
      const dx = tx - cx, dy = ty - cy;  // dx and dy are how far the target point is from the box centre in each direction
      const k = Math.min((M.w / 2) / Math.abs(dx || 1e-9), (M.h / 2) / Math.abs(dy || 1e-9));  // k scales that offset until it just touches the box's side or its top/bottom, whichever comes first
      return [cx + dx * k, cy + dy * k];  // returns the point on the box border
    };  // ends edge()
    const api = {  // api: the set of controls the step code uses to change this diagram after it is drawn
      svg,  // the SVG element itself, so the step can place it on the page
      has: (id) => !!ar[id],  // has(id): true if this diagram contains an arrow with that id
      arrow(id, cls) {  // arrow(id, cls): restyles one arrow as "on" (current move), "used" (already taken), "dim", or plain
        const a = ar[id]; if (!a) return;  // finds the arrow; a missing id is ignored quietly
        a.g.classList.remove('on', 'used', 'dim');  // clears any earlier highlight
        if (cls) a.g.classList.add(cls);  // adds the new style, if one was given
        a.ln.setAttribute('marker-end', cls === 'on' ? 'url(#arr-accent)' : cls === 'used' ? 'url(#arr-ok)' : 'url(#arr)');  // swaps the arrowhead to match: accent colour when on, green when used, the normal head otherwise
      },  // ends arrow()
      arrows(fn) { Object.keys(ar).forEach((id) => api.arrow(id, fn(id))); },  // arrows(fn): restyles every arrow, asking fn which style each id should get
      state(id, cls) { const x = st[id]; if (!x) return; x.g.classList.remove('on', 'dim', 'fresh'); if (cls) x.g.classList.add(cls); },  // state(id, cls): clears the old style of one box, then applies "on", "dim" or "fresh" if given
      states(fn) { Object.keys(st).forEach((id) => api.state(id, fn(id))); },  // states(fn): restyles every box, asking fn which style each id should get
      count(id, n) { if (st[id] && st[id].cnt) st[id].cnt.textContent = n ? `${n} process${n === 1 ? '' : 'es'}` : 'empty'; },  // count(id, n): writes "1 process", "3 processes" or "empty" under a state's name
      /* a red dashed "forbidden" arrow between two states, bent to one side */
      ghost(from, to, bend = 40) {  // ghost(from, to, bend): draws a curved red dashed arrow with an X to show a move between states is not allowed
        ghostLayer.replaceChildren();  // removes any earlier warning arrow first, so only one shows at a time
        const A = st[from], B = st[to];  // A and B are the start and end boxes of the forbidden move
        if (!A || !B || from === to) return;  // stops if either state is not in this diagram or both are the same
        const [x1, y1] = edge(A.x, A.y, B.x, B.y), [x2, y2] = edge(B.x, B.y, A.x, A.y);  // starting point on A's border facing B, and ending point on B's border facing A
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;  // len is the straight-line distance between those two points (1 if they coincide, to avoid dividing by zero)
        const qx = (x1 + x2) / 2 + bend * (y2 - y1) / len, qy = (y1 + y2) / 2 - bend * (x2 - x1) / len;  // the control point that bends the curve sideways by "bend" units, at right angles to the straight line
        const mx = 0.25 * x1 + 0.5 * qx + 0.25 * x2, my = 0.25 * y1 + 0.5 * qy + 0.25 * y2;  // the point halfway along the curve, where the X mark is placed
        ghostLayer.append(  // adds three parts to the warning layer
          s('path', { d: `M${x1},${y1} Q${qx},${qy} ${x2},${y2}`, class: 'ghost', 'marker-end': 'url(#arr-bad)' }),  // the curved dashed red line ending in a red arrowhead
          s('circle', { cx: mx, cy: my, r: 13, style: 'fill:var(--panel);stroke:var(--bad);stroke-width:2' }),  // a small circle with a red outline that sits on the middle of the curve
          s('text', { x: mx, y: my + 1, class: 'ghostx', style: 'fill:var(--bad);font-size:17px' }, '✗'));  // the red X drawn inside that circle
      },  // ends ghost()
      clearGhost() { ghostLayer.replaceChildren(); },  // clearGhost(): removes the red warning arrow
    };  // closes the api object
    return api;  // hands the controls back to the step that drew the diagram
  }  // ends diagram()

  /* Data for step 5: why processes are created and why they end.
     Each creation reason: [name, what it means].  Each termination reason:
     [name, what it means, a scenario that illustrates exactly this reason]. */
  const CREATE = [  // CREATE: the four reasons a process gets created, each as [name, meaning]; used in step 5
    ['New batch job', 'A job that was submitted earlier (and saved on disk or tape) is picked up, and the OS creates a process to run it.'],  // creation reason 1: a batch job that was stored earlier gets picked up
    ['Interactive log-on', 'A user signs in at a terminal, and the OS creates a process for that user’s session.'],  // creation reason 2: a user signs in and gets a session process
    ['Created by the OS to provide a service', 'The OS starts a process on a program’s behalf, for example to manage printing, so the program does not have to wait.'],  // creation reason 3: the OS starts a helper process, such as one that handles printing
    ['Spawned by an existing process', 'A running program asks the OS to create another process, for example to split up work or run something in parallel.'],  // creation reason 4: a running process asks for a new child process
  ];  // closes the CREATE list
  const CREATE_SCEN = [  // CREATE_SCEN: practice situations for step 5, each paired with the number of the creation reason it shows
    ['An overnight payroll job, submitted earlier in the day, reaches the front of the batch queue.', 0],  // scenario: an overnight payroll job reaches the front of the queue (a new batch job)
    ['A student types a username and password at a terminal and is accepted.', 1],  // scenario: a student signs in at a terminal (an interactive log-on)
    ['A program asks to print a long report. The OS starts a separate process to feed the printer so the program can carry on.', 2],  // scenario: the OS starts a printer-feeding process for a program (created to provide a service)
    ['A web server creates a new process to handle each client that connects to it.', 3],  // scenario: a web server makes one process per client (spawned by an existing process)
    ['Someone connects to a server over the network and signs in to get a command prompt.', 1],  // scenario: a remote user signs in over the network (another interactive log-on)
    ['You type a command into a shell, and the shell asks the OS to create a process that runs the command.', 3],  // scenario: a shell starts a process for a typed command (spawned by an existing process)
  ];  // closes the CREATE_SCEN list
  const TERM = [  // TERM: the reasons a process ends, each as [name, meaning, example situation]; used in step 5
    ['Normal completion', 'The process reached the end of its work and told the OS it is done.', 'A program finishes writing its output file and calls the OS service that says “I am finished”.'],  // termination reason: normal completion, with an example of a program finishing its output
    ['Time limit exceeded', 'The process went past its total time limit. The limit may count wall-clock time, processor time used, or (for an interactive process) time since the user last typed anything.','A batch job was given a budget of 10 minutes of processor time and has now used all 10.'],  // termination reason: time limit exceeded, with an example of a batch job using up its processor budget
    ['Memory unavailable', 'The process needs more memory than the system can give it.', 'A program asks for a 64 GB table on a machine that can never supply that much memory.'],  // termination reason: memory unavailable, with an example of asking for far more memory than exists
    ['Bounds violation', 'The process tried to reach a memory location it is not allowed to use.', 'A buggy loop runs past the end of an array and reads an address outside the process’s own memory area.'],  // termination reason: bounds violation, with an example of a loop running past the end of an array
    ['Protection error', 'The process tried to use a resource in a way it is not permitted to, such as writing to a read-only file.', 'A process that may only read a file tries to write into it.'],  // termination reason: protection error, with an example of writing to a read-only file
    ['Arithmetic error', 'A calculation the hardware cannot complete, such as dividing by zero or producing a number too large to store.', 'A division instruction runs with a divisor of zero.'],  // termination reason: arithmetic error, with an example of dividing by zero
    ['Time overrun', 'The process waited for some event longer than the maximum wait that was set.', 'A process is waiting for a reply from a server. Its maximum wait of 30 seconds passes and no reply has arrived.'],  // termination reason: time overrun, with an example of waiting too long for a server reply
    ['I/O failure', 'An input or output operation went wrong and could not be completed.', 'The program asks to read a file that does not exist, so the read cannot be carried out.'],  // termination reason: I/O failure, with an example of reading a file that does not exist
    ['Invalid instruction', 'The process tried to execute a bit pattern that is not a real instruction.', 'After a bad jump, the processor tries to execute bytes of text data as if they were an instruction.'],  // termination reason: invalid instruction, with an example of jumping into text data
    ['Privileged instruction', 'The process tried to execute an instruction reserved for the OS.', 'An ordinary program tries to run the instruction that switches off interrupts.'],  // termination reason: privileged instruction, with an example of a program trying to switch off interrupts
    ['Data misuse', 'A piece of data is the wrong type or was never given a value before use.', 'A program reads a variable before any value was ever stored in it.'],  // termination reason: data misuse, with an example of reading a variable that was never set
    ['Operator or OS intervention', 'A person operating the system, or the OS itself, decides to stop the process.', 'The OS detects that several processes are stuck waiting for each other forever and kills one of them to break the jam.'],  // termination reason: operator or OS intervention, with an example of the OS breaking a deadlock by killing one process
    ['Parent termination', 'The parent process ended, and this OS automatically ends everything the parent created.', 'Process X ends. On this system, ending a process also ends every child it created, including this one.'],  // termination reason: parent termination, with an example of a child ended because its parent ended
    ['Parent request', 'The parent process asked the OS to end one of its children.', 'A browser decides that a helper process it started is no longer needed and asks the OS to end it.'],  // termination reason: parent request, with an example of a browser asking the OS to end a helper process
  ];  // closes the TERM list

  /* Data for steps 8 and 9: what triggers each arrow of the seven-state model */
  const TR7 = {  // TR7: for each arrow id of the seven-state model, its label (from → to) and what makes the OS take it
    create: ['Null → New', 'A process is created: a batch job, a log-on, an OS service, or spawning by another process.'],  // create: how a process comes into existence and enters New
    admit: ['New → Ready', 'The OS admits the new process into main memory because there is room for it.'],  // admit: New to Ready because memory has room
    admitS: ['New → Ready/Suspend', 'Memory is tight, so the OS finishes creating the process but parks it on disk. Keeping a pool of ready work on disk lets the OS refill memory quickly later.'],  // admitS: New to Ready/Suspend when memory is tight, keeping a stock of ready work on disk
    activate: ['Ready/Suspend → Ready', 'There is room in memory, or no Ready process is left in memory, or this process is more important than those in memory, so the OS swaps it back in.'],  // activate: the three situations in which a Ready/Suspend process is brought back into memory
    suspendR: ['Ready → Ready/Suspend', 'Normally the OS would rather swap out a Blocked process. It may swap out a Ready one when that is the only way to free a big enough block of memory, or when the Ready one is low priority.'],  // suspendR: why the OS would, unusually, swap out a process that is ready to run
    dispatch: ['Ready → Running', 'The dispatcher chooses the process. Only processes that are in main memory can be dispatched.'],  // dispatch: only processes already in main memory can be given the processor
    timeout: ['Running → Ready', 'The time slice ends, or a more important process preempts it.'],  // timeout: the time slice ends or a more important process takes over
    release: ['Running → Exit', 'The process finishes, or is aborted while it runs.'],  // release: the process finishes or is aborted while running
    wait: ['Running → Blocked', 'The process requests I/O (or another event) and must wait for it.'],  // wait: the process asks for I/O or another event and must wait
    occurs: ['Blocked → Ready', 'The awaited event happens while the process is still in main memory.'],  // occurs: the awaited event arrives while the process is still in memory
    suspendB: ['Blocked → Blocked/Suspend', 'The usual suspension: memory is needed, and a blocked process cannot use its memory anyway, so it is swapped out to disk. The OS may do this even when Ready processes exist, if the running or a ready process needs more memory to perform well.'],  // suspendB: the usual case, swapping out a blocked process that cannot use its memory anyway
    activateB: ['Blocked/Suspend → Blocked', 'Unusual, because the process still cannot run. The OS might do it when memory frees up and this process is important and its event is expected very soon.'],  // activateB: the rare move back into memory while still blocked, when its event is expected soon
    occursS: ['Blocked/Suspend → Ready/Suspend', 'The awaited event happens while the process is on disk. It is no longer waiting, but it stays on disk until it is activated.'],  // occursS: the event arrives while the process is on disk, so it becomes ready but stays on disk
    suspendRun: ['Running → Ready/Suspend', 'The OS preempts the running process and swaps it straight out, for example because a more important process on disk has just become ready and needs the memory.'],  // suspendRun: the running process is preempted and swapped straight out to make room for a more important one
  };  // closes the TR7 table
  const SUSP_CHAR = [  // SUSP_CHAR: the four defining features of a suspended process, each as [short name, explanation]
    ['Not available to run', 'A suspended process cannot be dispatched right away, even if the processor is idle.'],  // feature 1: a suspended process cannot be dispatched, even when the processor is idle
    ['Waiting is a separate question', 'It may or may not also be waiting for an event. If it is, the event can occur while it is suspended, and that alone still does not let it run.'],  // feature 2: being suspended and waiting for an event are two separate conditions
    ['Put there by an agent', 'Something deliberately suspended it to keep it from running: the process itself, its parent, or the OS.'],  // feature 3: some agent (the process, its parent or the OS) put it there on purpose
    ['Only the agent releases it', 'It stays suspended until that agent explicitly orders it back.'],  // feature 4: only that same agent can release it
  ];  // closes the SUSP_CHAR list
  const SUSP_WHY = [  // SUSP_WHY: the reasons a process may be suspended, each as [name, explanation]
    ['Swapping', 'The OS needs to free main memory so it can bring in a process that is ready to run.'],  // reason: swapping, to free memory for a process that is ready to run
    ['Other OS reason', 'The OS may set aside a background or utility process, or one it suspects of causing a problem.'],  // reason: other OS decisions, such as setting aside a background job or a suspected troublemaker
    ['Interactive user request', 'A user may pause a program, for example to debug it or while a resource it uses is being fixed.'],  // reason: a user pauses the program, for instance to debug it
    ['Timing', 'A process that runs periodically (such as a monitoring job) can be suspended until its next turn comes round.'],  // reason: timing, for a periodic job that waits for its next turn
    ['Parent process request', 'A parent may suspend a child to inspect or change it, or to coordinate several children.'],  // reason: a parent suspends its child to inspect or coordinate it
  ];  // closes the SUSP_WHY list

  /* Small DOM helpers used by the simulators */
  const actGrid = (ctx, cols, ...btns) => ctx.h('div', { class: 'acts', style: { gridTemplateColumns: `repeat(${ctx.narrow ? 2 : cols}, minmax(0, 1fr))` } }, ...btns);  // actGrid(): builds a grid of action buttons with the given number of columns, only 2 on a small screen
  const tokCls = (state) => 'tok' + ({ running: ' run', blocked: ' blk', new: ' new', exit: ' ex', rs: ' sus', bs: ' blk sus' }[state] || '');  // tokCls(state): picks the CSS classes for a process token so its colour and border match its current state
  function say(box, kind, head, html) {  // say(box, kind, head, html): writes a message into a feedback box, styled as ok, bad, info or plain
    box.className = 'msg ' + (kind || '');  // sets the box's style from the kind of message (for example green for ok, red for bad)
    box.innerHTML = (head ? `<b class="h">${head}</b>` : '') + html;  // writes an optional bold heading followed by the message text
  }  // ends say()

  Guide.section({  // registers this section with the guide shell, which builds its pages from the object below
    id: '3.2',  // the section number, used in page addresses and the table of contents
    title: 'Process States',  // the section's full title shown at the top of each of its pages
    short: 'Process states',  // a shorter title used in tight spaces such as the chapter list on the home page
    summary: 'Follow a process from creation to exit through the two-, five- and seven-state models and their queues.',  // one-sentence summary shown next to the section on its chapter's overview page
    objectives: [  // objectives: what the student should be able to do after this section, listed in the printable notes
      'Read an interleaved instruction trace and explain what the dispatcher does between processes.',  // objective 1: reading a trace and explaining the dispatcher's job
      'Draw the two-state and five-state models and name the event behind every transition.',  // objective 2: drawing the two- and five-state models and naming each transition's cause
      'List the reasons a process is created or terminated, and explain parent/child spawning.',  // objective 3: reasons for process creation and termination, including parent and child
      'Explain why the OS keeps ready and blocked queues, and why one queue per event helps.',  // objective 4: why the OS keeps ready and blocked queues, and why one queue per event helps
      'Explain why processes are swapped out, why a single Suspend state falls short, and use the seven-state model with Ready/Suspend and Blocked/Suspend.',  // objective 5: swapping, the weakness of one Suspend state, and the seven-state model
    ],  // closes the objectives list
    terms: [  // terms: the glossary entries for this section, each as [term, definition]; marked words on the pages link to them
      ['Trace', 'The list of instruction addresses a process executes, in the order it executes them. Comparing traces shows how the processor moves between processes.'],  // glossary entry: defines a trace
      ['Dispatcher', 'A small piece of OS code that switches the processor from one process to another: it records where the old process stopped and starts the next chosen process where that one left off.'],  // glossary entry: defines the dispatcher
      ['Timeout', 'The OS takes the processor from a running process because it has used up its allowed slice of time. The process goes back to Ready.'],  // glossary entry: defines a timeout
      ['Two-state model', 'The simplest process model: each process is either Running or Not Running, and all not-running processes wait in one queue.'],  // glossary entry: defines the two-state model
      ['Five-state model', 'A process model with the states New, Ready, Running, Blocked and Exit. It separates processes that could run from those waiting for an event.'],  // glossary entry: defines the five-state model
      ['New state', 'The OS has just created the process (it has an identifier and a control block) but has not yet admitted it into the group of processes allowed to run. Usually its program is not yet loaded into main memory.'],  // glossary entry: defines the New state
      ['Ready state', 'The process could run right now; it is only waiting for its turn on the processor.'],  // glossary entry: defines the Ready state
      ['Running state', 'The process is executing on the processor at this moment. On a single processor at most one process is Running.'],  // glossary entry: defines the Running state
      ['Blocked state', 'The process cannot run until some event happens, such as an I/O operation finishing. Also called the Waiting state.'],  // glossary entry: defines the Blocked state (also called Waiting)
      ['Exit state', 'The process has finished or been aborted. It will never run again, although the OS may keep its records for a short while.'],  // glossary entry: defines the Exit state
      ['Preemption', 'Taking the processor away from a running process that did not ask to stop, for example because a more important process has become ready.'],  // glossary entry: defines preemption
      ['Process spawning', 'One process asking the OS to create another process.'],  // glossary entry: defines process spawning
      ['Parent process', 'A process that has created (spawned) another process.'],  // glossary entry: defines a parent process
      ['Child process', 'A process that was created by another process, called its parent.'],  // glossary entry: defines a child process
      ['Ready queue', 'The list of processes in the Ready state. The dispatcher picks the next process to run from it.'],  // glossary entry: defines the ready queue
      ['Blocked queue', 'A list of processes in the Blocked state. An OS may keep one list for every blocked process, or a separate list for each kind of event.'],  // glossary entry: defines a blocked queue
      ['Swapping', 'Moving all or part of a process from main memory out to disk (and later back in) so the memory can be used by other processes.'],  // glossary entry: defines swapping
      ['Suspended process', 'A process that has been set aside, typically by swapping it out to disk, and is not available to run until something explicitly brings it back. The simplest design uses one Suspend state; a better one splits it into Ready/Suspend and Blocked/Suspend.'],  // glossary entry: defines a suspended process
      ['Ready/Suspend state', 'The process is swapped out to disk but is not waiting for any event: it could run as soon as it is brought back into main memory.'],  // glossary entry: defines the Ready/Suspend state
      ['Blocked/Suspend state', 'The process is swapped out to disk and is also waiting for an event, so two things stand between it and the processor.'],  // glossary entry: defines the Blocked/Suspend state
    ],  // closes the terms list

    css: ` /* css: style rules for this section; the shell adds them to the page, and every rule starts with .sec-3-2 so it only affects these pages */
      /* ---- state diagrams (SVG) ---- */
      .sec-3-2 svg.sd { display: block; } /* each state diagram sits on its own line instead of flowing beside text */
      .sec-3-2 .st rect { stroke-width: 2.2; transition: stroke-width .15s, opacity .2s; } /* state boxes get a medium outline that thickens smoothly when highlighted */
      .sec-3-2 .st.dash rect { stroke-dasharray: 7 4; } /* suspended states get a dashed outline so "on disk" is visible at a glance */
      .sec-3-2 .st text.nm { font-size: 15px; font-weight: 800; text-anchor: middle; dominant-baseline: central; pointer-events: none; } /* state names: bold and centred inside the box; clicks pass through the text to the box beneath */
      .sec-3-2 .st[data-id="rs"] text.nm, .sec-3-2 .st[data-id="bs"] text.nm { font-size: 13.5px; } /* the long names Ready/Suspend and Blocked/Suspend get slightly smaller text so they fit in their boxes */
      .sec-3-2 .st text.cnt { font-size: 12.5px; font-weight: 700; text-anchor: middle; dominant-baseline: central; pointer-events: none; } /* the count line ("2 processes") under a state's name: small, bold, centred, not clickable */
      .sec-3-2 .st.hot { cursor: pointer; } /* a clickable state shows the hand-shaped pointer */
      .sec-3-2 .st.hot:hover rect { stroke-width: 3.5; } /* hovering over a clickable state thickens its outline as a hint */
      .sec-3-2 .st.on rect { stroke-width: 4.5; } /* the currently selected state gets the thickest outline */
      .sec-3-2 .st.fresh rect { stroke-width: 4; } /* a state that just received a process gets a thick outline for a moment */
      .sec-3-2 .st.dim { opacity: .3; } /* states that do not matter right now fade to 30 percent opacity */
      .sec-3-2 .ar .ln { fill: none; stroke: var(--ink-2); stroke-width: 2; opacity: .85; } /* arrow lines: no fill, a mid-tone ink colour and slight transparency so boxes stand out */
      .sec-3-2 .ar.dash .ln { stroke-dasharray: 6 5; } /* dashed arrows (the terminate paths) use a dash pattern */
      .sec-3-2 .ar .hit { fill: none; stroke: transparent; stroke-width: 16; pointer-events: stroke; } /* the invisible wide copy of each arrow catches clicks near the line, so the thin line is easy to hit */
      .sec-3-2 .ar.hot { cursor: pointer; } /* a clickable arrow shows the hand-shaped pointer */
      .sec-3-2 .ar text { font-size: 13.5px; font-weight: 700; fill: var(--ink-2); } /* arrow labels: bold and slightly smaller than state names */
      .sec-3-2 .ar.hot:hover .ln { stroke-width: 3; } /* hovering over a clickable arrow thickens its line */
      .sec-3-2 .ar.used .ln { stroke: var(--ok); opacity: 1; } /* arrows already taken turn solid green */
      .sec-3-2 .ar.used text { fill: var(--ok); } /* labels of arrows already taken turn green too */
      .sec-3-2 .ar.on .ln { stroke: var(--accent); stroke-width: 3; opacity: 1; } /* the arrow for the move happening right now is drawn thick and solid in the accent colour */
      .sec-3-2 .ar.on text { fill: var(--accent); } /* its label turns the accent colour too */
      .sec-3-2 .ar.dim { opacity: .18; } /* arrows that do not matter at this moment fade almost out of sight */
      .sec-3-2 .ghost { fill: none; stroke: var(--bad); stroke-width: 2.5; stroke-dasharray: 5 5; } /* the red "not allowed" arrow drawn by ghost(): red, dashed and slightly thick, with no fill */
      .sec-3-2 .ghostx { font-size: 26px; font-weight: 900; text-anchor: middle; dominant-baseline: central; } /* the X mark on that arrow: large, heavy and centred on its circle */
      .sec-3-2 svg .note { font-size: 13px; fill: var(--muted); font-style: italic; } /* the small note inside a diagram ("Any state → Exit...") is italic and muted so it reads as an aside */

      /* ---- process tokens and lanes (DOM) ---- */
      .sec-3-2 .tok { width: 48px; height: 34px; border-radius: 9px; border: 2px solid var(--proc); background: var(--proc-bg); /* a process token (the small labelled chip that moves between queue lanes): a rounded chip in the process colour with a bold label; later lines finish the rule */
        font-weight: 800; font-size: 15px; cursor: pointer; color: var(--ink); display: inline-flex; align-items: center; /* continues the token rule: bold text, pointer cursor, contents centred with a flexible box layout */
        justify-content: center; flex: none; padding: 0; position: relative; } /* ends the token rule: fixed size in a row, no padding, and a positioned base so its corner tag can sit on it */
      .sec-3-2 .tok.sel { outline: 3px solid var(--accent); outline-offset: 2px; } /* the token the student has selected gets an accent outline with a small gap around it */
      .sec-3-2 .tok.run { border-color: var(--cpu); background: var(--cpu-bg); } /* the running process's token takes the CPU blue */
      .sec-3-2 .tok.blk { border-color: var(--warn); background: var(--warn-bg); } /* a blocked process's token takes the caution colour */
      .sec-3-2 .tok.new { border-color: var(--line-2); background: var(--panel); } /* a brand-new process's token is plain grey, not yet part of the ready pool */
      .sec-3-2 .tok.ex { opacity: .5; border-style: dashed; border-color: var(--line-2); background: var(--panel-2); } /* a finished process's token fades, with a dashed grey border */
      .sec-3-2 .tok.sus { border-style: dashed; } /* a suspended process's token gets a dashed border, the same sign used for suspended states in the diagrams */
      .sec-3-2 .tok.skip { border-color: var(--bad); background: var(--bad-bg); } /* a token the dispatcher checked for nothing (it was not really ready) is shown in red */
      .sec-3-2 .tok .tag { position: absolute; top: -9px; right: -8px; font-size: 10.5px; font-weight: 800; line-height: 1; /* the tiny tag (for example "disk") pinned to a token's top right corner; the rule continues below */
        padding: 2px 4px; border-radius: 6px; background: var(--io); color: var(--panel); } /* continues the tag rule: small padding, rounded corners, I/O colour background with light text */
      .sec-3-2 .lane { display: grid; grid-template-columns: 112px minmax(0, 1fr); align-items: center; gap: 10px; /* a lane: one row holding a label on the left and a line of tokens on the right; the rule continues below */
        border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px; background: var(--panel-2); min-height: 50px; } /* continues the lane rule: thin border, rounded corners, light background and a minimum height */
      .sec-3-2 .lane .lbl { font-weight: 800; font-size: 14px; line-height: 1.2; } /* a lane's label (Ready, Running...) is bold */
      .sec-3-2 .lane .lbl small { display: block; font-weight: 600; color: var(--muted); font-size: 12.5px; } /* the small second line under a lane's label is muted and a little lighter */
      .sec-3-2 .lane .toks { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; min-height: 36px; } /* the token area of a lane lays tokens out in a row that wraps onto more lines when full */
      .sec-3-2 .lane.cpu { border-color: color-mix(in srgb, var(--cpu) 45%, transparent); background: var(--cpu-bg); } /* the processor lane is tinted CPU blue so the running spot stands out */
      .sec-3-2 .lane.sm { min-height: 42px; padding: 4px 10px; } /* a compact lane with less height and padding, used when many lanes must fit on one page */
      .sec-3-2 .lane.sm .toks { min-height: 32px; } /* the token area inside a compact lane is shorter too */
      .sec-3-2 .lane.sm .tok { height: 30px; width: 44px; font-size: 14px; } /* tokens inside a compact lane are a little smaller */
      .sec-3-2 .tok.ev2, .sec-3-2 .lane.sm .tok.ev2 { width: 66px; height: 40px; flex-direction: column; line-height: 1.05; font-size: 14px; } /* event tokens are wider and taller so the event's name fits on a second line under the process name */
      .sec-3-2 .tok.ev2 .evn { font-size: 11px; font-weight: 700; color: var(--io); } /* the event name under an event token's label: small and in the I/O colour */
      .sec-3-2 .lane.hit { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-bg); } /* the lane that just received a process is outlined in the accent colour with a soft glow */
      .sec-3-2 .lane .empty { font-size: 13px; color: var(--muted); font-style: italic; } /* the word "empty" in a lane with no tokens is small, muted and italic */

      /* ---- narration box ---- */
      .sec-3-2 .msg { border-radius: 10px; padding: 9px 12px; background: var(--panel-2); border: 1px solid var(--line); /* the narration box that explains each move: rounded, padded, light background; the rule continues below */
        font-size: 15px; line-height: 1.45; } /* continues the narration box rule: comfortable font size and line spacing */
      .sec-3-2 .msg.ok { border-color: var(--ok); background: var(--ok-bg); } /* a narration box reporting success gets a green border and background */
      .sec-3-2 .msg.bad { border-color: var(--bad); background: var(--bad-bg); } /* a narration box reporting a refused move gets a red border and background */
      .sec-3-2 .msg.info { border-color: var(--accent); background: var(--accent-bg); } /* a narration box with neutral information gets an accent-coloured border and background */
      .sec-3-2 .msg b.h { display: block; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 2px; } /* the narration box's heading ("Refused", "Done"...) is a small uppercase line above the text */
      .sec-3-2 .msg.ok b.h { color: var(--ok); } .sec-3-2 .msg.bad b.h { color: var(--bad); } .sec-3-2 .msg.info b.h { color: var(--accent); } /* the heading takes the colour that matches the box: green, red or accent */

      /* ---- processes A, B, C (three shades of the process colour) + dispatcher ---- */
      .sec-3-2 svg .fA { fill: color-mix(in srgb, var(--proc) 16%, var(--panel)); stroke: var(--proc); } /* process A's shade in drawings: the lightest mix of the process colour */
      .sec-3-2 svg .fB { fill: color-mix(in srgb, var(--proc) 40%, var(--panel)); stroke: var(--proc); } /* process B's shade in drawings: a medium mix of the process colour */
      .sec-3-2 svg .fC { fill: color-mix(in srgb, var(--proc) 64%, var(--panel)); stroke: var(--proc); } /* process C's shade in drawings: the darkest mix of the process colour */
      .sec-3-2 svg .fD { fill: var(--os-bg); stroke: var(--os); } /* the dispatcher's shade in drawings: the OS violet, since the dispatcher belongs to the OS */
      .sec-3-2 svg .fGap { fill: var(--panel-2); stroke: var(--line-2); stroke-dasharray: 4 4; } /* a gap in a drawing (no process running) is a grey dashed box */
      .sec-3-2 .cA { background: color-mix(in srgb, var(--proc) 16%, var(--panel)); border-color: var(--proc); } /* the same light shade as process A, for ordinary page elements instead of drawings */
      .sec-3-2 .cB { background: color-mix(in srgb, var(--proc) 40%, var(--panel)); border-color: var(--proc); } /* the same medium shade as process B, for ordinary page elements */
      .sec-3-2 .cC { background: color-mix(in srgb, var(--proc) 64%, var(--panel)); border-color: var(--proc); } /* the same dark shade as process C, for ordinary page elements */
      .sec-3-2 .cD { background: var(--os-bg); border-color: var(--os); } /* the dispatcher's violet, for ordinary page elements */
      .sec-3-2 .mreg { cursor: pointer; } /* a clickable memory region in the memory map drawing shows the hand-shaped pointer */
      .sec-3-2 .mreg rect { stroke-width: 2; transition: stroke-width .15s; } /* memory regions have a medium outline that changes thickness smoothly */
      .sec-3-2 .mreg:hover rect { stroke-width: 3.5; } /* hovering over a memory region thickens its outline */
      .sec-3-2 .mreg.on rect { stroke-width: 4.5; } /* the selected memory region gets the thickest outline */
      .sec-3-2 .addr { display: inline-flex; align-items: center; justify-content: center; height: 30px; border-radius: 8px; /* an address chip in a process's trace list: rounded, outlined, in the fixed-width code font; continues below */
        border: 2px solid var(--line-2); font-family: var(--mono); font-weight: 700; font-size: 14.5px; } /* continues the address chip rule: grey border and bold fixed-width digits */
      .sec-3-2 .addr.flag { border-color: var(--io); box-shadow: 0 0 0 2px var(--io-bg); } /* the address where a process asks for I/O is outlined in the I/O colour with a glow */

      /* ---- combined trace list (step 3) ---- */
      .sec-3-2 .trgrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-flow: column; grid-template-rows: repeat(13, 17px); column-gap: 10px; row-gap: 1px; } /* the combined trace list: 4 columns filled top to bottom, 13 short rows each */
      .sec-3-2 .tr { display: grid; grid-template-columns: 24px 11px minmax(0, 1fr); align-items: center; gap: 6px; font-family: var(--mono); /* one row of the trace list: cycle number, colour swatch, address; the rule continues below */
        font-size: 13.5px; line-height: 17px; padding: 0 6px; border-radius: 5px; white-space: nowrap; } /* continues the trace row rule: fixed-width font, tight line height, and no wrapping */
      .sec-3-2 .tr .n { color: var(--muted); text-align: right; font-size: 12.5px; } /* the cycle number at the start of a row is muted and right-aligned */
      .sec-3-2 .tr .sw { width: 11px; height: 12px; border-radius: 3px; border: 1.5px solid; } /* the small colour swatch that shows which process (or the dispatcher) ran this cycle */
      .sec-3-2 .tr .ev { font-family: var(--font); font-size: 11.5px; font-weight: 800; color: var(--intr); margin-left: 6px; } /* the red "I/O" or "timeout" tag after an address, showing why the process lost the processor there */
      .sec-3-2 .tr { cursor: pointer; } /* trace rows can be clicked to jump the animation to that cycle */
      .sec-3-2 .tr:hover { background: var(--panel-3); opacity: 1; } /* hovering over a trace row highlights it */
      .sec-3-2 .tr.fut { opacity: .25; } /* rows for cycles the animation has not reached yet are faded */
      .sec-3-2 .tr.fut:hover { opacity: .7; } /* a faded future row comes back partly when hovered, so the student can see what is clickable */
      .sec-3-2 .tr.cur { background: var(--accent-bg); font-weight: 800; } /* the row for the current cycle is bold with an accent background */
      .sec-3-2 svg .cell { stroke-width: 1.2; cursor: pointer; } /* the timeline cells in the drawing, one per cycle, are clickable */
      .sec-3-2 svg .cell.fut { opacity: .22; } /* timeline cells for cycles not yet reached are faded */
      .sec-3-2 svg .curbox { fill: none; stroke: var(--accent); stroke-width: 3; } /* the accent frame drawn around the current cycle's cell in the timeline */

      /* ---- step 5: reason buttons and the parent/child tree ---- */
      .sec-3-2 .rgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; } /* grid of reason buttons in step 5: two equal columns */
      .sec-3-2 .rbtn { height: 34px; font-size: 14px; justify-content: flex-start; padding: 0 10px; } /* each reason button: fixed height with its text aligned left */
      .sec-3-2 .rbtn.done { border-color: var(--ok); color: var(--ok); background: var(--ok-bg); } /* a reason the student matched correctly turns green */
      .sec-3-2 .rbtn.wrong { border-color: var(--bad); color: var(--bad); background: var(--bad-bg); } /* a reason the student picked wrongly turns red */
      .sec-3-2 .scen { font-size: 18px; line-height: 1.45; font-weight: 600; } /* the scenario text the student must classify: large and semi-bold so it reads first */
      .sec-3-2 .trow { display: flex; align-items: center; gap: 8px; padding: 3px 8px; border-radius: 9px; cursor: pointer; /* one row of the parent/child process tree, drawn as a full-width button; the rule continues below */
        border: 2px solid transparent; background: none; width: 100%; text-align: left; font-size: 15px; color: var(--ink); min-height: 38px; } /* continues the tree row rule: transparent border and background, left-aligned text */
      .sec-3-2 .trow:hover { background: var(--panel-2); } /* hovering over a tree row gives it a light background */
      .sec-3-2 .trow.sel { border-color: var(--accent); background: var(--accent-bg); } /* the selected tree row gets an accent border and background */
      .sec-3-2 .trow.dead { opacity: .55; } /* rows of processes that have ended are faded */
      .sec-3-2 .trow .branch { color: var(--muted); font-family: var(--mono); white-space: pre; } /* the branch lines drawn with characters in front of each child keep their spacing in a fixed-width font */
      .sec-3-2 .trow .pn { font-weight: 800; padding: 2px 10px; border-radius: 8px; border: 2px solid var(--proc); background: var(--proc-bg); } /* the process name in a tree row sits in a pill in the process colour */
      .sec-3-2 .trow.dead .pn { border-style: dashed; border-color: var(--line-2); background: var(--panel-2); text-decoration: line-through; } /* the name of an ended process gets a dashed grey pill and is crossed out */

      /* ---- step 8: memory slots, disk, and the suspend matrix ---- */
      .sec-3-2 .slots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; } /* the memory slots in step 8: three equal columns */
      .sec-3-2 .slot { border: 2px solid var(--mem); background: var(--mem-bg); border-radius: 10px; min-height: 60px; display: flex; /* one memory slot: a green-bordered box that centres the process inside it; the rule continues below */
        flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 4px; } /* continues the memory slot rule: stacks its contents vertically with a small gap */
      .sec-3-2 .slot.free { border-style: dashed; background: transparent; border-color: var(--line-2); color: var(--muted); font-size: 13px; font-style: italic; } /* an empty memory slot has a dashed grey border and italic muted text */
      .sec-3-2 .slot .sl, .sec-3-2 .dsk .sl { font-size: 12px; font-weight: 700; color: var(--ink-2); } /* small labels inside memory slots and the disk area */
      .sec-3-2 .dsk { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; } /* the disk area stacks a token over its label */
      .sec-3-2 .cpustat { font-weight: 800; font-size: 15px; } /* the line that says what the processor is doing: bold */
      .sec-3-2 .cpustat.idle { color: var(--bad); } /* when no process can use the processor, the status line turns red: the processor sits idle */
      .sec-3-2 .cpustat.busy { color: var(--cpu); } /* when a process is running, the status line takes the CPU blue */
      .sec-3-2 .mx { display: grid; grid-template-columns: 110px repeat(2, minmax(0, 1fr)); gap: 8px; align-items: stretch; } /* the suspend matrix: a label column plus two equal columns ("in memory" and "on disk") */
      .sec-3-2 .mx .hd { font-size: 13px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; display: flex; align-items: center; } /* matrix headings: small, bold, muted uppercase text, vertically centred */
      .sec-3-2 .mx .hd.c { justify-content: center; text-align: center; } /* column headings of the matrix are centred over their column */
      .sec-3-2 .mx .box { display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 15px; padding: 10px; } /* a matrix cell: its contents stacked and centred in the middle of the box */
      .sec-3-2 .mx .box small { font-weight: 500; font-size: 12.5px; color: var(--ink-2); } /* the small explanation line inside a matrix cell is lighter and smaller */
      .sec-3-2 .mx .box.sus { border-style: dashed; } /* matrix cells for suspended states get a dashed border, matching the diagrams */

      /* ---- misc ---- */
      .sec-3-2 .acts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; } /* grid of action buttons for the simulators: four equal columns by default */
      .sec-3-2 .acts .btn { padding: 0 6px; } /* buttons in that grid get less side padding so their labels fit */
      .sec-3-2 .kv { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; font-size: 15px; align-items: baseline; } /* a two-column list of labels and values, like a small table without borders */
      .sec-3-2 .goal { display: flex; gap: 5px; flex-wrap: wrap; } /* the row of goal markers that shows which moves still have to be tried */
      .sec-3-2 .goal span { width: 26px; height: 26px; border-radius: 7px; display: inline-grid; place-items: center; font-size: 13px; /* one goal marker: a small rounded square with a centred number; the rule continues below */
        font-weight: 800; border: 2px solid var(--line-2); color: var(--muted); background: var(--panel); } /* continues the goal marker rule: bold muted digit on a plain background with a grey border */
      .sec-3-2 .goal span.done { background: var(--ok); border-color: var(--ok); color: var(--panel); } /* a goal already reached is filled green */
      .sec-3-2 .goal span.cur { border-color: var(--accent); color: var(--accent); } /* the goal being worked on right now is outlined in the accent colour */
    `,  // end of this section's style rules

    steps: [  // steps: the pages of this section, in the order the student sees them
      /* ============ 1. Big picture: why states? (growing diagram) ============ */
      {  // step 1 starts: the big picture of why an OS keeps process states
        title: 'One processor, many processes: why states?',  // page heading for step 1
        kind: 'story',  // "story" puts the label Big Picture above the page heading
        render(el, ctx) {  // render(el, ctx): builds this page when the student opens it; el is the page body and ctx the guide's helpers
          const { h } = ctx;  // pulls out ctx.h, the helper that creates an ordinary page element with its attributes and children
          const INFO = {  // INFO: two descriptions per state, one in OS terms and one in terms of a clinic with one doctor
            nr: ['Every process that is not on the processor, lumped together in one line.', 'Everyone who is not with the doctor. Waiting room, lab and front desk all count as one group.'],  // Not Running explained: everyone away from the processor in one group, like everyone not with the doctor
            new: ['The OS has built the process’s records but has not yet let it compete for the processor.', 'You just walked in and are filling in forms at the front desk. The clinic knows your name but has not accepted you as a patient yet.'],  // New explained: records exist but the process is not yet accepted, like filling in forms at the front desk
            ready: ['Able to run right now; only waiting for its turn on the processor.', 'You are in the waiting room. The moment the doctor is free, you can go in.'],  // Ready explained: can run as soon as the processor is free, like sitting in the waiting room
            running: ['Executing instructions on the processor. One processor means at most one Running process.', 'You are in the exam room with the doctor. With one doctor, only one patient can be in there.'],  // Running explained: on the processor now, like the one patient in the exam room
            blocked: ['Cannot continue until some event happens, such as a disk read finishing.', 'You were sent for a blood test. Even if the doctor is free, there is nothing to discuss until the results come back.'],  // Blocked explained: waiting for an event such as a disk read, like waiting for blood test results
            exit: ['Finished or aborted. It will never run again, though its records may linger briefly.', 'You have been discharged. The clinic keeps your file open a little longer to finish the paperwork.'],  // Exit explained: finished and never runs again, like a discharged patient whose file is being closed
            rs: ['Swapped out to disk but not waiting for anything: it can run once it is brought back into memory.', 'The waiting room was full, so you were sent to the overflow annex across the street. You could be seen, but first you must walk back over.'],  // Ready/Suspend explained: on disk but not waiting, like being sent to an overflow annex
            bs: ['Swapped out to disk and still waiting for an event.', 'You are waiting for lab results and were moved to the annex. Two separate things keep you from the doctor.'],  // Blocked/Suspend explained: on disk and waiting, like waiting for lab results in the annex
          };  // closes the INFO table
          const MODEL = {  // MODEL: for each diagram size, a caption and the list of states that model adds
            two: ['Two states: the simplest possible bookkeeping.', ['nr', 'running']],  // the two-state model: the starting point, it adds Not Running and Running
            five: ['Five states: Not Running splits into Ready and Blocked; New and Exit are added.', ['new', 'ready', 'blocked', 'exit']],  // the five-state model: splits Not Running and adds New and Exit
            seven: ['Seven states: two suspended states for processes swapped out to disk.', ['rs', 'bs']],  // the seven-state model: adds the two suspended states
          };  // closes the MODEL table
          const wrap = h('div', { style: { height: ctx.narrow ? 'auto' : '300px', display: 'grid', placeItems: 'center' } });  // wrap is the box that holds the diagram; it is 300 pixels tall on a wide screen and grows as needed on a small one
          const desc = h('p', { class: 'small muted m0' });  // desc is the small grey caption above the diagram
          const info = h('div', { class: 'msg info', style: { minHeight: '108px' } });  // info is the explanation box under the diagram, tall enough that it does not jump when the text changes
          let d = null, cur = 'five';  // d is the diagram currently drawn; cur is the model shown first (five states)
          const pick = (id) => {  // pick(id): runs when the student clicks a state box
            d.states((x) => (x === id ? 'on' : ''));  // highlights the clicked state and clears every other one
            say(info, 'info', `${NAME[id]} · in the OS`, `${INFO[id][0]}<div class="small" style="margin-top:6px"><b>In the clinic:</b> ${INFO[id][1]}</div>`);  // fills the info box with that state's OS meaning and its clinic comparison
          };  // ends pick()
          const show = (key) => {  // show(key): draws the chosen model; runs at first and whenever the student picks another model
            cur = key;  // remembers which model is showing
            d = diagram(ctx, key, { onState: pick, label: MODEL[key][0] });  // draws a new diagram whose state boxes can be clicked, labelled for screen readers with the model's caption
            d.svg.style.height = ctx.narrow ? 'auto' : '300px';  // fixes the drawing's height on a wide screen so switching models does not shift the page
            d.svg.setAttribute('width', '100%');  // makes the drawing fill the width of its box
            wrap.replaceChildren(d.svg);  // swaps the new drawing in place of the old one
            d.states((id) => (MODEL[key][1].includes(id) ? 'fresh' : ''));  // gives the states this model adds a thick outline
            desc.textContent = MODEL[key][0] + ' Thick outlines mark the states this model adds.';  // sets the caption to the model's description plus a note on what the thick outlines mean
            say(info, 'info', 'Click a state', 'Click any box in the diagram to see what the state means to the OS, and what it would mean for a patient in the clinic.');  // resets the info box to a prompt that asks the student to click a state
          };  // ends show()
          const seg = ctx.ui.seg([{ value: 'two', label: 'Two states' }, { value: 'five', label: 'Five states' }, { value: 'seven', label: 'Seven states' }], cur, show);  // three-way switch (Two, Five, Seven states); choosing one calls show()
          show(cur);  // draws the starting model as soon as the page opens
          el.append(h('div', { class: 'split l fill' },  // lays the page out in two columns: text on the left, the growing diagram on the right
            h('div', { class: 'stack' },  // left column: a stack of paragraphs and boxes
              h('p', { class: 'lead m0', html: 'A computer may host hundreds of processes but only a few processors. At any instant almost every process is <i>not</i> running. The OS needs a compact way to record where each one stands and what can happen to it next.' }),  // opening paragraph: many processes, few processors, so the OS needs a record of each one's situation
              h('p', { class: 'm0', html: 'That record is the process’s <b>state</b>, kept in its <span class="t">process control block (PCB)</span>. A <b>state model</b> lists the possible states and the events that move a process from one state to another.' }),  // paragraph: defines a process's state and a state model; the marked term links to its glossary entry
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'Picture a small clinic with <b>one doctor</b> (the processor). Patients (processes) wait, go in one at a time, get sent off for lab tests, and are eventually discharged. Click the states in the diagram to see each one in clinic terms.' }),  // analogy box: the clinic with one doctor that the rest of the page uses
              h('div', { class: 'card tight small', html: '<b>In this section you will</b> follow the processor through three interleaved programs, see why two states are not enough, play the OS in the five-state model, and swap processes out when memory runs short.' })),  // preview box: what the student will do in this section
            h('div', { class: 'card white stack' },  // right column: a white card holding the diagram
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'A model that grows'), seg),  // the card's header row: the title "A model that grows" on the left, the model switch on the right
              desc, wrap, info)));  // then the caption, the diagram and the explanation box, which close both columns
        },  // ends render() for step 1
      },  // end of step 1

      /* ============ 2. Traces and the dispatcher (clickable memory map) ============ */
      {  // step 2 starts: traces and the dispatcher, shown with a clickable memory map
        title: 'Traces: the footprints a process leaves',  // page heading for step 2
        kind: 'learn',  // "learn" puts the label Learn above the page heading
        render(el, ctx) {  // render(): builds step 2 when the student opens it
          const { h, s } = ctx;  // pulls out the helpers for page elements (h) and SVG drawing elements (s)
          const R = {  // R: the four memory regions in the map, each with its name, colour, position, start address and trace
            D: { name: 'Dispatcher', cls: 'D', top: 28, ht: 52, addr: '100', list: [[100, 101, 102, 103, 104, 105]], rows: ['every switch'],  // the dispatcher: OS code at address 100 whose six instructions run on every switch between processes
              text: 'The dispatcher is OS code, not a user process. The same six instructions run <b>every time</b> the processor moves from one process to another: note where the old process stopped, choose the next one, and jump to where that one left off.' },  // explanation shown when the dispatcher is clicked: it saves where the old process stopped and starts the next one
            A: { name: 'Process A', cls: 'A', top: 116, ht: 76, addr: '5000', list: [[5000, 5001, 5002, 5003, 5004, 5005], [5006, 5007, 5008, 5009, 5010, 5011]], rows: ['1st turn', '2nd turn'],  // process A: starts at 5000 and runs in two turns of six instructions
              text: 'From A’s own point of view these 12 instructions simply run one after another. In reality the processor is taken away after 5005 and does other work before 5006. A cannot tell: its registers are restored exactly as it left them.' },  // explanation for A: from its own view its instructions run straight through, even though it is paused after 5005
            B: { name: 'Process B', cls: 'B', top: 218, ht: 42, addr: '8000', list: [[8000, 8001, 8002, 8003]], rows: ['1st turn'], flag: 8003,  // process B: starts at 8000, gets one turn, and its last instruction (8003) is flagged as an I/O request
              text: 'B’s trace is short. Its fourth instruction, at <b>8003</b>, asks for I/O (say, a disk read). B cannot continue until the device answers, so it gives up the processor after only 4 of its 6 allowed cycles.' },  // explanation for B: the I/O request at 8003 makes it give up the processor after only 4 cycles
            C: { name: 'Process C', cls: 'C', top: 286, ht: 76, addr: '12000', list: [[12000, 12001, 12002, 12003, 12004, 12005], [12006, 12007, 12008, 12009, 12010, 12011]], rows: ['1st turn', '2nd turn'],  // process C: starts at 12000 and, like A, runs in two turns of six
              text: 'Like A, C is cut off after six instructions (a timeout) and later resumes at 12006 as if nothing had happened.' },  // explanation for C: it is cut off by a timeout and later resumes at 12006
          };  // closes the R table
          const svg = s('svg', { viewBox: '0 0 250 386', width: '100%', style: 'max-height:386px;max-width:250px;justify-self:center' });  // the memory map drawing, 250 by 386 units, kept from growing larger than that and centred in its column
          svg.append(s('text', { x: 165, y: 18, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, 'Main memory'));  // title "Main memory" over the map
          [[80, 36], [192, 26], [260, 26]].forEach(([y, ht]) => svg.append(  // three grey gaps between the regions stand for memory holding other things
            s('rect', { x: 90, y, width: 150, height: ht, class: 'fGap' }),  // each gap is a dashed grey box
            s('text', { x: 165, y: y + ht / 2 + 5, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 }, '⋯ other contents ⋯')));  // the gap's label "other contents", centred in the box
          const groups = {};  // groups remembers each region's drawing group so a click can highlight it
          for (const [k, r] of Object.entries(R)) {  // draws one clickable region for each entry in R
            const g = s('g', { class: 'mreg hot', role: 'button', tabindex: 0, 'aria-label': r.name },  // the region's group acts as a button that the keyboard can reach and screen readers can name
              s('rect', { x: 90, y: r.top, width: 150, height: r.ht, rx: 6, class: 'f' + r.cls }),  // the region's box, in that process's shade (or violet for the dispatcher)
              s('text', { x: 165, y: r.top + r.ht / 2 + 5, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, r.name),  // the region's name, centred in the box
              s('text', { x: 82, y: r.top + 14, 'text-anchor': 'end', class: 's-monot', 'font-size': 14, 'font-weight': 700 }, r.addr));  // the region's start address, printed in a fixed-width font just left of the box; this closes the group
            g.addEventListener('click', () => pick(k));  // clicking a region shows its trace in the panel on the right
            g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(k); } });  // pressing Enter or Space on a focused region does the same, so the map also works from the keyboard
            groups[k] = g; svg.append(g);  // remembers the group for highlighting and adds it to the drawing
          }  // ends the loop over the memory regions
          svg.append(s('text', { x: 82, y: 380, 'text-anchor': 'end', class: 's-sub', 'font-size': 12.5 }, 'address ↓'));  // small caption at the bottom: addresses grow downward in this map
          const panel = h('div', { class: 'stack', style: { gap: '10px' } });  // panel is the right-hand area where the chosen region's trace appears
          function pick(k) {  // pick(k): shows the trace of region k (D, A, B or C); runs on a click and once when the page opens
            Object.entries(groups).forEach(([x, g]) => g.classList.toggle('on', x === k));  // outlines the chosen region and clears the outline from the others
            const r = R[k];  // r is the chosen region's data from R
            panel.replaceChildren(...[  // replaces the panel's contents with the pieces below (empty pieces are dropped at the end)
              h('h3', { class: 'm0' }, k === 'D' ? 'The dispatcher’s code' : `${r.name}’s own trace`),  // heading: "The dispatcher's code" or "Process X's own trace"
              ...r.list.map((row, i) => h('div', { class: 'stack', style: { gap: '4px' } },  // one block per turn the process gets, each holding a small label and a grid of addresses
                h('div', { class: 'xs muted b' }, r.rows[i]),  // the turn's label, such as "1st turn" or "every switch"
                h('div', { style: { display: 'grid', gap: '6px', gridTemplateColumns: `repeat(${ctx.narrow ? 3 : 6}, minmax(0,1fr))` } },  // the address grid: six across on a wide screen, three across on a small one
                  row.map((a) => h('span', { class: 'addr c' + r.cls + (a === r.flag ? ' flag' : ''), title: a === r.flag ? 'I/O request' : '' }, String(a)))))),  // one chip per address in the process's shade; B's I/O address gets the orange highlight and a tooltip
              r.flag ? h('div', { class: 'row gap-s' }, h('span', { class: 'chip io' }, '8003 = I/O request'), h('span', { class: 'xs muted' }, 'B must now wait for the device')) : null,  // only for B: a chip saying 8003 is an I/O request and a note that B must now wait for the device
              h('p', { class: 'm0 small', html: r.text })].filter(Boolean));  // the region's explanation paragraph; this closes the list of panel contents
          }  // ends pick()
          pick('A');  // starts the page with process A selected
          el.append(h('div', { class: 'split l fill' },  // lays the page out in two columns: explanation on the left, memory map and trace on the right
            h('div', { class: 'stack' },  // left column: a stack of paragraphs and boxes
              h('p', { class: 'lead m0', html: 'To see how the OS juggles processes, watch the processor’s <span class="t" data-t="Program counter (PC)">program counter</span> (PC): the register that holds the address of the next instruction.' }),  // opening paragraph: the program counter holds the address of the next instruction, so it shows where the processor is
              h('p', { class: 'm0', html: 'The ordered list of addresses that one process executes is that process’s <span class="t">trace</span>. A small OS routine called the <span class="t">dispatcher</span> switches the processor from one process to another.' }),  // paragraph: defines a trace and the dispatcher; both marked terms link to the glossary
              h('div', { class: 'card tight stack gap-s' },  // a small card that sets up the experiment
                h('h4', { class: 'm0' }, 'The experiment'),  // the card's heading: "The experiment"
                h('ul', { class: 'm0 small', html: '<li>Processes A, B and C sit in memory at <b>5000</b>, <b>8000</b> and <b>12000</b>. The dispatcher sits at <b>100</b> and is 6 instructions long (100–105).</li><li>The OS lets a process run at most <b>6 instruction cycles</b>. Then a <b>timer interrupt</b> (a signal from the hardware clock) ends its turn: a <span class="t">timeout</span>.</li><li>B’s <b>4th</b> instruction requests I/O, so B stops early and must wait.</li>' })),  // the experiment's rules: where each process sits, the 6-cycle limit enforced by a timer interrupt, and B's early I/O request
              h('div', { class: 'callout tip m0 small', 'data-label': 'Try it', html: 'Click each region of memory to see the trace that program would record about itself.' })),  // tip box: asks the student to click each memory region
            h('div', { class: 'card white', style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'minmax(0,1fr)' : '250px minmax(0,1fr)', gap: '14px 18px', alignItems: 'start', alignContent: 'space-between' } }, svg, panel,  // right column: a white card with the map and the trace panel side by side (stacked on a small screen)
              h('div', { class: 'callout why m0 small', 'data-label': 'Two points of view', style: { gridColumn: '1 / -1' }, html: 'Each process only ever sees its <b>own</b> trace, as if it had the processor to itself. The processor sees all the traces <b>interleaved</b>, with the dispatcher’s code between them. The next step shows exactly that combined view.' }))));  // a box across the full card width: each process sees only its own trace, the processor sees them interleaved
        },  // ends render() for step 2
      },  // end of step 2

      /* ============ 3. The interleaved trace, cycle by cycle (player) ============ */
      {  // step 3 starts: the interleaved trace played one instruction cycle at a time
        title: 'Interleaved: what the processor actually sees',  // page heading for step 3
        kind: 'explore',  // "explore" puts the label Explore above the page heading
        render(el, ctx) {  // render(): builds step 3 when the student opens it
          const { h, s } = ctx;  // pulls out the helpers for page elements (h) and SVG drawing elements (s)
          // segments of the combined trace: [who, first address, length, how the turn ends]
          const SEGS = [['A', 5000, 6, 'timeout'], ['D', 100, 6], ['B', 8000, 4, 'io'], ['D', 100, 6], ['C', 12000, 6, 'timeout'],  // SEGS: the combined trace as nine turns in a row, each as [who ran, first address, how many cycles, why it ended]
            ['D', 100, 6], ['A', 5006, 6, 'timeout'], ['D', 100, 6], ['C', 12006, 6, 'timeout']];  // the last four turns: dispatcher, A resumes at 5006, dispatcher, C resumes at 12006; closes SEGS
          // process states + ready queue (front first) while each segment runs; pick = whom the dispatcher chooses
          const SNAP = [  // SNAP: the state of each process and the ready queue during each of the nine turns
            { A: 'Running', B: 'Ready', C: 'Ready', q: ['B', 'C'] },  // turn 1: A runs while B and C wait in the ready queue
            { A: 'Ready', B: 'Ready', C: 'Ready', q: ['B', 'C', 'A'], pick: 'B' },  // turn 2: A timed out and joined the back of the queue; the dispatcher picks B
            { A: 'Ready', B: 'Running', C: 'Ready', q: ['C', 'A'] },  // turn 3: B runs
            { A: 'Ready', B: 'Blocked', C: 'Ready', q: ['C', 'A'], pick: 'C' },  // turn 4: B asked for I/O and is now Blocked; the dispatcher picks C
            { A: 'Ready', B: 'Blocked', C: 'Running', q: ['A'] },  // turn 5: C runs
            { A: 'Ready', B: 'Blocked', C: 'Ready', q: ['A', 'C'], pick: 'A' },  // turn 6: C timed out and joined the queue; the dispatcher picks A
            { A: 'Running', B: 'Blocked', C: 'Ready', q: ['C'] },  // turn 7: A runs its second turn
            { A: 'Ready', B: 'Blocked', C: 'Ready', q: ['C', 'A'], pick: 'C' },  // turn 8: A timed out again; the dispatcher picks C
            { A: 'Ready', B: 'Blocked', C: 'Running', q: ['A'] },  // turn 9: C runs its second turn; B is still waiting for its device
          ];  // closes the SNAP list
          const START0 = { A: 'Ready', B: 'Ready', C: 'Ready', q: ['A', 'B', 'C'] };  // START0: the situation before cycle 1, with all three processes ready and queued in order A, B, C
          const TOTAL = { A: 12, B: 4, C: 12 };  // TOTAL: how many instructions each process runs in the whole trace, used to show its progress
          const CY = [];  // CY will hold one entry per instruction cycle (52 in all)
          SEGS.forEach(([who, start, n, end], si) => { for (let k = 0; k < n; k++) CY.push({ n: CY.length + 1, who, addr: start + k, k: k + 1, len: n, end: k === n - 1 ? end : null, seg: si }); });  // unrolls each turn into its cycles, recording cycle number, who ran, the address, the position in the turn and any ending

          /* --- timeline (one cell per instruction cycle; wraps into 4 rows of 13 on phones) --- */
          const X0 = 20, CW = 20, PER = ctx.narrow ? 13 : 52, RH = 96, ROWS = 52 / PER;  // drawing sizes: left margin, cell width, cells per row (52, or 13 on a small screen), row height, number of rows
          const pos = (n) => [X0 + ((n - 1) % PER) * CW, Math.floor((n - 1) / PER) * RH];  // pos(n): the top-left corner of cycle n's cell, wrapping onto a new row after PER cells
          const tl = s('svg', { viewBox: `0 0 ${X0 * 2 + PER * CW} ${ROWS * RH - 6}`, width: '100%' });  // the timeline SVG, sized to fit all its rows
          let player = null;                      // created below; cells and rows jump the player to their cycle
          const jump = (n) => { if (player) { player.stop(); player.go(n); } };  // jump(n): stops any autoplay and moves the animation to cycle n; used by clicks on cells and trace rows
          const cells = CY.map((c) => { const [x, y] = pos(c.n); const r = s('rect', { x: x + 1, y: y + 20, width: CW - 2, height: 30, rx: 3, class: 'cell f' + c.who }); r.addEventListener('click', () => jump(c.n)); return r; });  // builds one clickable cell per cycle, coloured with the shade of the process or dispatcher that ran it
          tl.append(...cells);  // adds all the cells to the timeline
          let segStart = 0;  // segStart counts how many cycles come before the turn being labelled
          SEGS.forEach(([who, , n, end]) => {  // walks through the turns to add labels and ending marks
            for (let a = segStart + 1; a <= segStart + n;) {           // one label per row-piece of the segment
              const rowEnd = Math.min(segStart + n, Math.ceil(a / PER) * PER);  // rowEnd is the last cycle of this piece: the end of the turn or the end of the row, whichever comes first
              const [x1, y] = pos(a), x2 = pos(rowEnd)[0] + CW;  // x1 and x2 are the left and right edges of the piece; y is its row
              tl.append(s('text', { x: (x1 + x2) / 2, y: y + 13, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: who === 'D' ? 'fill:var(--os)' : 'fill:var(--proc)' }, who === 'D' ? (rowEnd - a >= 3 ? 'Dispatcher' : 'D') : who));  // label above the piece: the process letter in teal, or "Dispatcher" in violet ("D" if the piece is too short)
              tl.append(s('text', { x: x1 + 3, y: y + 66, 'font-size': 12.5, class: 's-sub' }, String(a)));  // the piece's first cycle number, printed small under the cells
              a = rowEnd + 1;  // moves on to the next piece of the turn
            }  // ends the loop over row pieces
            if (end) {  // turns that end with a timeout or I/O request get a red mark after their last cell
              const [xl, y] = pos(segStart + n), x2 = xl + CW;  // x2 is the right edge of the turn's last cell
              tl.append(s('line', { x1: x2, y1: y + 16, x2: x2, y2: y + 76, style: 'stroke:var(--intr);stroke-width:2' }),  // a red vertical line after the cell, then a label under it: "I/O request" or "timeout"
                s('text', { x: x2, y: y + 88, 'text-anchor': end === 'io' ? 'middle' : x2 < 70 ? 'start' : 'end', 'font-size': 12, 'font-weight': 800, style: 'fill:var(--intr)' }, end === 'io' ? 'I/O request' : 'timeout'));  // the label is centred for I/O, and pushed right or left so it stays inside the drawing near the edges
            }  // ends the ending mark
            segStart += n;  // moves past this turn's cycles
          });  // ends the loop over turns
          const [xz, yz] = pos(52);  // position of the last cell, cycle 52
          tl.append(s('text', { x: xz + CW - 2, y: yz + 66, 'font-size': 12.5, 'text-anchor': 'end', class: 's-sub' }, '52'));  // prints "52" under the last cell so the student sees the total count
          const curBox = s('rect', { x: 0, y: 17, width: CW + 2, height: 36, rx: 4, class: 'curbox', style: 'display:none' });  // curBox is the accent frame that sits around the current cycle's cell; hidden until the animation starts
          tl.append(curBox);  // adds the frame on top of the cells

          /* --- combined trace list (4 columns x 13 rows) --- */
          const rows = CY.map((c) => h('div', { class: 'tr', role: 'button', tabindex: 0, title: `Jump to cycle ${c.n}`, onclick: () => jump(c.n), onkeydown: (e) => { if (e.key === 'Enter') jump(c.n); } },  // the combined trace list: one clickable row per cycle that jumps the animation there
            h('span', { class: 'n' }, String(c.n)), h('span', { class: 'sw c' + c.who }),  // each row shows the cycle number and a colour swatch for who ran it
            h('span', {}, String(c.addr), c.end ? h('span', { class: 'ev' }, c.end === 'io' ? 'I/O' : 'timeout') : null)));  // then the address, with a red "I/O" or "timeout" tag on the cycle where a turn ended
          const grid = h('div', { class: 'trgrid', style: ctx.narrow ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'repeat(26, 17px)' } : null }, rows);  // the grid of rows: 4 columns of 13, or 2 columns of 26 on a small screen

          /* --- right-now panel --- */
          const nowTop = h('div', { class: 'row', style: { justifyContent: 'space-between' } });  // top of the "right now" panel: holds the current cycle's heading and details
          const stTbl = h('table', { class: 'tbl compact' });  // stTbl is the table of each process's state and progress
          const queue = h('div', { class: 'row gap-s' });  // queue shows the ready queue as a row of chips
          const ovh = h('div', { class: 'small' });  // ovh shows how much processor time went to the dispatcher so far
          const chipFor = (st) => `<span class="chip ${st === 'Running' ? 'cpu' : st === 'Blocked' ? 'warn' : 'proc'}">${st}</span>`;  // chipFor(st): a coloured chip for a state name: blue for Running, caution colour for Blocked, teal otherwise
          function draw(i) {  // draw(i): updates the timeline, trace list and "right now" panel to show the situation after cycle i
            const c = i ? CY[i - 1] : null;  // c is the cycle just executed, or nothing when i is 0 (before the first cycle)
            const snap = c ? SNAP[c.seg] : START0;  // snap is the process states and ready queue for that cycle's turn (or the starting situation)
            cells.forEach((r, j) => r.classList.toggle('fut', j >= i));  // fades the timeline cells for cycles that have not happened yet
            rows.forEach((r, j) => { r.classList.toggle('fut', j >= i); r.classList.toggle('cur', j === i - 1); });  // fades future rows in the trace list and highlights the row of the current cycle
            if (c) { const [x, y] = pos(c.n); curBox.style.display = ''; curBox.setAttribute('x', x - 1); curBox.setAttribute('y', y + 17); } else curBox.style.display = 'none';  // moves the accent frame onto the current cycle's cell, or hides it before cycle 1
            const done = { A: 0, B: 0, C: 0 };  // done counts how many instructions each process has executed so far
            CY.slice(0, i).forEach((x) => { if (x.who !== 'D') done[x.who]++; });  // counts every cycle up to now that belonged to A, B or C (dispatcher cycles are skipped)
            // on the last cycle of a turn, show the move the event causes (Running → Ready or Running → Blocked)
            const after = c && c.end ? (c.end === 'io' ? 'Blocked' : 'Ready') : null;  // after is the state the process moves to at the end of its turn: Blocked for I/O, Ready for a timeout
            const q = snap.q.concat(after === 'Ready' ? [c.who] : []);  // q is the ready queue to show; a process that just timed out is added at the back
            nowTop.innerHTML = c  // fills the top of the panel, depending on whether a cycle has run yet
              ? `<div><div class="xs muted b">CYCLE</div><div class="big" style="font-size:30px">${c.n}</div></div><div><div class="xs muted b">PC</div><div class="big mono" style="font-size:30px">${c.addr}</div></div><div><div class="xs muted b">OWNER</div><span class="chip ${c.who === 'D' ? 'os' : 'proc'}" style="font-size:14.5px">${c.who === 'D' ? 'Dispatcher (OS)' : 'Process ' + c.who}</span></div>`  // after a cycle: three big figures, the cycle number, the program counter value, and who owns the processor
              : '<div><div class="xs muted b">CYCLE</div><div class="big" style="font-size:30px">0</div></div><div class="small muted" style="max-width:250px">Nothing has run yet. Press Play or Next.</div>';  // before cycle 1: the number 0 and a hint to press Play or Next
            stTbl.innerHTML = '<tr><th>Process</th><th>State</th><th>Done</th></tr>' + ['A', 'B', 'C'].map((p) =>  // rebuilds the state table: a header row, then one row per process
              `<tr${c && c.who === p ? ' class="on"' : ''}><td><b>${p}</b></td><td>${chipFor(snap[p])}${after && c.who === p ? ` <span class="muted">→</span> ${chipFor(after)}` : ''}</td><td class="mono">${done[p]} / ${TOTAL[p]}</td></tr>`).join('');  // each row: the process letter, its state chip (with an arrow to its next state at a turn's end), and its progress
            queue.innerHTML = '<span class="xs muted b">READY QUEUE (front first)</span>' + (q.length ? q.map((p) => `<span class="chip proc">${p}</span>`).join('') : '<span class="xs muted">empty</span>') +  // shows the ready queue from front to back as chips, or "empty"
              (snap.pick ? `<span class="chip os">dispatcher picks ${snap.pick}</span>` : '');  // and, while the dispatcher runs, a violet chip naming the process it is about to pick
            const nd = CY.slice(0, i).filter((x) => x.who === 'D').length;  // nd counts how many of the cycles so far were spent in the dispatcher
            ovh.innerHTML = `<span class="xs muted b">DISPATCHER OVERHEAD SO FAR</span> <b>${nd}</b> of <b>${i}</b> cycles` + (i ? ` = <b>${Math.round((nd / i) * 100)}%</b>` : '');  // shows that count and its share of all cycles so far as a percentage
          }  // ends draw()
          function caption(i) {  // caption(i): returns the sentence that explains cycle i; the player shows it above its controls
            if (i === 0) return '<b>Before cycle 1.</b> All three processes are Ready and A is first in line. Press <b>Play</b>, step one cycle at a time, or click any cycle to jump to it.';  // before cycle 1: everything is Ready, with a hint on how to use the controls
            const c = CY[i - 1];  // c is the cycle being explained
            if (c.who === 'D') {  // cycles run by the dispatcher get their own explanations
              const pk = SNAP[c.seg].pick;  // pk is the process the dispatcher is about to choose
              if (c.k === 1) return `<b>Cycle ${c.n}: the dispatcher starts</b> at address 100. No user process is running; the OS owns the processor while it picks the next process.` + (c.seg === 3 ? ' B is Blocked, so it is not in the ready queue and cannot be picked.' : '');  // first dispatcher cycle: the OS owns the processor; in the switch after B's I/O it also notes B cannot be picked
              if (c.k === c.len) return `<b>Cycle ${c.n}:</b> the dispatcher’s last instruction (105) hands the processor to <b>${pk}</b> by jumping to ${pk}’s next instruction.`;  // last dispatcher cycle: instruction 105 jumps to the chosen process's next instruction
              return `<b>Cycle ${c.n}:</b> dispatcher instruction ${c.addr} (${c.k} of 6). Necessary work, but no user program makes progress during it.`;  // the dispatcher cycles in between: needed work, but no user program advances
            }  // ends the dispatcher case
            if (c.end === 'io') return `<b>Cycle ${c.n}: B executes 8003, an I/O request.</b> The request is a call into the OS, so the OS takes over. B cannot go on until the device answers, so it becomes <b>Blocked</b> after only 4 cycles, and the dispatcher runs next.`;  // B's I/O request at 8003: the OS takes over and B becomes Blocked after only 4 cycles
            if (c.end === 'timeout' && i === 52) return '<b>Cycle 52: C executes 12011; its time is up.</b> A ran 12 cycles, B 4, C 12, the dispatcher 24 (46%). That overhead is huge only because these turns are tiny: a real time slice lasts milliseconds, or millions of instructions.';  // the final cycle: totals for each process and the dispatcher's 46 percent share, with why real slices are far longer
            if (c.end === 'timeout') return `<b>Cycle ${c.n}: ${c.who} executes ${c.addr}, its 6th cycle.</b> The timer interrupt fires: a <b>timeout</b>. ${c.who} goes to the back of the ready queue and the dispatcher takes over.`;  // any other timeout: the timer interrupt fires and the process goes to the back of the ready queue
            const resumed = c.addr !== { A: 5000, B: 8000, C: 12000 }[c.who];  // resumed is true when this turn does not start at the process's first address, meaning it was paused before
            if (c.k === 1) return `<b>Cycle ${c.n}: ${c.who} ${resumed ? 'resumes' : 'starts'}</b> at ${c.addr}${resumed ? ', exactly where it was stopped' : ''}. It may use up to 6 cycles.`;  // first cycle of a turn: the process starts, or resumes exactly where it stopped
            return `<b>Cycle ${c.n}:</b> ${c.who} executes the instruction at ${c.addr} (cycle ${c.k} of its 6).`;  // any other cycle: which instruction the process runs and how far through its 6 cycles it is
          }  // ends caption()
          player = ctx.ui.player({ count: CY.length + 1, interval: 700, render: (i) => { draw(i); return caption(i); } });  // creates the step player: 53 positions (before cycle 1 plus 52 cycles), 0.7 seconds each when playing
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the page as a vertical stack that fills the available height
            h('div', { class: 'card white tight' }, tl),  // top: the timeline drawing in a white card
            h('div', { class: 'split r grow', style: { gap: '14px' } },  // middle: two columns, the trace list on the left and the "right now" panel on the right
              h('div', { class: 'card stack gap-s' }, h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'baseline' } },  // left card, header row: the list's title and a hint on the right
                h('h4', { class: 'm0' }, 'Combined trace · cycle and address'), h('span', { class: 'xs muted' }, 'click any cycle to jump there')), grid),  // title "Combined trace", the click hint, then the grid of trace rows
              h('div', { class: 'card stack gap-s' }, nowTop, stTbl, queue, ovh)),  // right card: cycle figures, state table, ready queue and dispatcher overhead
            player.el));  // bottom: the player's controls and caption, which close the page layout
        },  // ends render() for step 3
      },  // end of step 3

      /* ============ 4. The two-state model and its flaw (queue simulator) ============ */
      {  // step 4 starts: the two-state model, with a queue simulator that exposes its weakness
        title: 'The two-state model, and where it breaks',  // page heading for step 4
        kind: 'explore',  // "explore" puts the label Explore above the page heading
        render(el, ctx) {  // render(): builds step 4 when the student opens it
          const { h } = ctx;  // pulls out the helper that creates page elements
          const d = diagram(ctx, 'two', { label: 'Two-state model: Not Running and Running' });  // draws the two-state diagram (not clickable here); arrows are lit up as the student acts
          let S;  // S will hold the whole simulator state
          const reset = () => { S = { q: [{ id: 'P2', w: true }, { id: 'P3', w: false }, { id: 'P4', w: true }], run: { id: 'P1', w: false }, out: [], next: 5, wasted: 0, idle: 0, skip: [] }; };  // reset(): starts over with P1 running and P2, P3, P4 queued; P2 and P4 are waiting for the disk (w: true)
          const laneQ = h('div', { class: 'toks' }), laneR = h('div', { class: 'toks' }), laneX = h('div', { class: 'toks' });  // the token areas of the three lanes: the not-running queue, the processor and the finished list
          const msg = h('div', { class: 'msg', style: { minHeight: '92px' } });  // msg is the narration box that explains each action
          const stats = h('div', { class: 'row gap-s' });  // stats shows the counters of wasted checks and idle moments
          const tok = (p, extra = '') => h('span', { class: 'tok' + extra, style: { cursor: 'default' } }, p.id, p.w ? h('span', { class: 'tag' }, 'disk') : null);  // tok(p, extra): a process token with a "disk" tag if the process is waiting for the disk
          function paint(arrow) {  // paint(arrow): redraws the lanes, counters and diagram, lighting up the arrow of the action just taken
            laneQ.replaceChildren(...(S.q.length ? S.q.map((p) => tok(p, S.skip.includes(p.id) ? ' skip' : '')) : [h('span', { class: 'empty' }, 'empty')]));  // fills the queue lane; tokens the dispatcher just skipped are shown in red
            laneR.replaceChildren(S.run ? tok(S.run, ' run') : h('span', { class: 'empty' }, 'idle: no process running'));  // fills the processor lane with the running process, or says the processor is idle
            laneX.replaceChildren(...(S.out.length ? S.out.map((p) => tok(p, ' ex')) : [h('span', { class: 'empty' }, 'none yet')]));  // fills the finished lane, or says none yet
            stats.innerHTML = `<span class="chip ${S.wasted ? 'bad' : ''}">useless checks: ${S.wasted}</span><span class="chip ${S.idle ? 'bad' : ''}">times the processor sat idle: ${S.idle}</span>`;  // shows the two counters; each turns red once it is above zero
            d.arrows((id) => (id === arrow ? 'on' : ''));  // lights up the arrow for this action and dims no others
            d.states((id) => (id === 'running' && S.run ? 'on' : ''));  // highlights the Running box while a process is on the processor
          }  // ends paint()
          const busy = () => { say(msg, 'bad', 'Refused', `The processor is busy running <b>${S.run.id}</b>. With one processor only one process can be Running. Pause it or let it exit first.`); paint(); };  // busy(): refuses an action because a process is already running (one processor, one Running process)
          const none = () => { say(msg, 'bad', 'Refused', 'Nothing is running right now, so there is no process to pause or finish. Dispatch one first.'); paint(); };  // none(): refuses Pause or Exit because nothing is running
          const act = {  // act: what each simulator button does
            enter() {  // enter(): creates a new process and adds it to the queue
              if (S.q.length + (S.run ? 1 : 0) >= 7) { say(msg, 'bad', 'Queue full', 'Seven processes is plenty for this demo. Let one exit first.'); return paint(); }  // limits the demo to seven processes so the lanes do not overflow
              const p = { id: 'P' + S.next++, w: false }; S.q.push(p); S.skip = [];  // makes the next numbered process, not waiting for anything, adds it at the back and clears the red skip marks
              say(msg, 'ok', 'Enter', `<b>${p.id}</b> is created and joins the <b>back</b> of the queue of not-running processes.`); paint('enter');  // explains the move and lights the "enter" arrow
            },  // ends enter()
            dispatch() {  // dispatch(): gives the processor to the first queued process that can actually run
              if (S.run) return busy();  // refused if something is already running
              if (!S.q.length) { say(msg, 'bad', 'Nothing to run', 'The queue is empty, so the processor has nothing to do.'); return paint(); }  // refused if the queue is empty
              S.skip = [];  // clears the red marks from the previous dispatch
              const i = S.q.findIndex((p) => !p.w);  // i is the position of the first queued process that is not waiting for the disk
              if (i < 0) {  // no such process: every queued process is waiting
                S.skip = S.q.map((p) => p.id); S.wasted += S.q.length; S.idle++;  // marks them all as checked for nothing, adds to the wasted count, and counts one idle moment
                say(msg, 'bad', 'Stuck', `The dispatcher checked all ${S.q.length} queued processes and <b>every one is waiting for the disk</b>. Nothing can run, so the processor sits idle, and the OS wasted time finding that out.`);  // explains that the dispatcher looked through the whole queue and found nothing it could run
                return paint();  // redraws and stops here
              }  // ends the case where nothing can run
              S.skip = S.q.slice(0, i).map((p) => p.id); S.wasted += i;  // marks the waiting processes in front of the chosen one as skipped and counts those useless checks
              S.run = S.q.splice(i, 1)[0];  // takes the chosen process out of the queue and puts it on the processor
              say(msg, i ? 'bad' : 'ok', i ? 'Dispatch, the hard way' : 'Dispatch',  // the narration is red when processes had to be skipped, green when the front process could run
                i ? `The front of the queue was <b>${S.skip.join(', ')}</b>, still waiting for the disk. Running ${i > 1 ? 'them' : 'it'} would be pointless, so the dispatcher had to skip ${i > 1 ? 'them' : 'it'} and search further back before dispatching <b>${S.run.id}</b>.`  // skipped case: names the waiting processes the dispatcher had to pass over before finding one to run
                  : `The process at the front of the queue, <b>${S.run.id}</b>, can run, so the dispatcher gives it the processor.`);  // easy case: the process at the front of the queue could run
              paint('dispatch');  // redraws and lights the "dispatch" arrow
            },  // ends dispatch()
            pause() {  // pause(): the running process's time is up
              if (!S.run) return none();  // refused if nothing is running
              const p = S.run; S.run = null; S.q.push(p); S.skip = [];  // moves the running process to the back of the queue and frees the processor
              say(msg, 'ok', 'Pause', `<b>${p.id}</b>’s time is up. It goes to the back of the queue and the processor is free.`); paint('pause');  // explains the move and lights the "pause" arrow
            },  // ends pause()
            io() {  // io(): the running process asks for a disk read
              if (!S.run) return none();  // refused if nothing is running
              const p = S.run; p.w = true; S.run = null; S.q.push(p); S.skip = [];  // marks the running process as waiting for the disk, frees the processor and sends it to the back of the one queue
              say(msg, 'info', 'Request I/O', `<b>${p.id}</b> asks for a disk read and must wait. The only place for it is the same queue, marked as waiting. Look at the diagram: it used the same <b>pause</b> arrow. This model cannot tell “my time is up” from “I am waiting for the disk”.`);  // explains that it took the same pause arrow: the two-state model cannot tell a timeout from waiting for I/O
              paint('pause');  // redraws and lights the "pause" arrow, the only way back in this model
            },  // ends io()
            exit() {  // exit(): the running process finishes
              if (!S.run) return none();  // refused if nothing is running
              const p = S.run; S.run = null; S.out.push(p); S.skip = [];  // moves the running process to the finished lane and frees the processor
              say(msg, 'ok', 'Exit', `<b>${p.id}</b> finishes and leaves the system for good.`); paint('exit');  // explains the move and lights the "exit" arrow
            },  // ends exit()
            disk() {  // disk(): the disk finishes its work, so every process that was waiting for it can run again
              const ws = S.q.filter((p) => p.w); S.skip = [];  // ws lists the queued processes that were waiting for the disk
              if (!ws.length) { say(msg, 'info', 'Disk finishes', 'No process in the queue was waiting for the disk, so nothing changes.'); return paint(); }  // if none were waiting, nothing changes and the narration says so
              ws.forEach((p) => (p.w = false));  // clears the waiting mark on each of them
              say(msg, 'info', 'Disk finishes', `<b>${ws.map((p) => p.id).join(', ')}</b> can run again. The OS had to hunt for ${ws.length > 1 ? 'them' : 'it'} inside the one big queue and clear the waiting marks.`);  // names the processes that can run again and points out the OS had to search the whole queue to find them
              paint();  // redraws the lanes
            },  // ends disk()
          };  // closes the act table
          const B = (label, fn, cls = 'btn sm') => h('button', { class: cls, type: 'button', onclick: fn }, label);  // B(label, fn, cls): makes one small button that runs fn when clicked
          const intro = () => say(msg, '', '', 'Start by pressing <b>Dispatch</b> while P1 is running. Then <b>Pause</b> P1 and <b>Dispatch</b> again: notice P2 at the front is waiting for the disk. Try <b>Request I/O</b> too.');  // intro(): the starting narration that suggests which buttons to try first
          reset(); paint(); intro();  // sets up the starting situation, draws it and shows the intro text as soon as the page opens
          el.append(h('div', { class: 'split fill' },  // lays the page out in two equal columns
            h('div', { class: 'stack' },  // left column: a stack of text and the diagram
              h('p', { class: 'lead m0', html: 'The simplest model says a process is either <span class="t" data-t="Running state">Running</span> or Not Running. That is the <span class="t">two-state model</span>.' }),  // opening paragraph: a process is either Running or Not Running; both marked terms link to the glossary
              h('div', { class: 'card white tight' }, d.svg),  // the two-state diagram in a white card
              h('p', { class: 'm0 small', html: 'Not-running processes wait in <b>one queue</b>. <b>Enter</b>: a new process joins the back. <b>Dispatch</b>: the processor is given to a process from the queue. <b>Pause</b>: the running process is interrupted and rejoins the back. <b>Exit</b>: the running process finishes and leaves.' }),  // paragraph: what each of the four arrows does to the single queue
              h('div', { class: 'callout warn m0 small', 'data-label': 'The flaw', html: 'Some not-running processes are <b>waiting for I/O</b> and could not run even if chosen. With only one queue, the dispatcher cannot simply take the front: it must search past them. The fix, next: split Not Running into <b>Ready</b> and <b>Blocked</b>.' })),  // warning box: the flaw, processes waiting for I/O clog the one queue, and the fix of splitting it
            h('div', { class: 'card stack' },  // right column: the simulator card
              h('div', { class: 'lane' }, h('div', { class: 'lbl', html: 'Queue<small>Not Running · front on the left</small>' }), laneQ),  // the queue lane, labelled with its front on the left
              h('div', { class: 'lane cpu' }, h('div', { class: 'lbl', html: 'Processor<small>Running</small>' }), laneR),  // the processor lane, tinted blue
              h('div', { class: 'lane' }, h('div', { class: 'lbl', html: 'Exited<small>gone for good</small>' }), laneX),  // the lane for processes that have exited
              actGrid(ctx, 4,  // the action buttons in a four-column grid
                B('Enter new', act.enter), B('Dispatch', act.dispatch, 'btn sm primary'), B('Pause (timeout)', act.pause), B('Exit (finish)', act.exit),  // first row: Enter, Dispatch (the main button), Pause and Exit
                B('Request I/O', act.io, 'btn sm io'), B('Disk finishes', act.disk, 'btn sm io'), B('Reset', () => { reset(); paint(); intro(); }, 'btn sm')),  // second row: Request I/O and Disk finishes (in the I/O colour), then Reset, which starts the demo over
              stats, msg,  // the counters and the narration box
              h('div', { class: 'row gap-s xs muted', style: { marginTop: 'auto' } },  // a legend pinned to the bottom of the card, explaining the two special token looks
                h('span', { class: 'tok', style: { cursor: 'default', width: '40px', height: '28px' } }, 'P', h('span', { class: 'tag' }, 'disk')), 'waiting for a disk read',  // legend item: a token with a "disk" tag means it is waiting for a disk read
                h('span', { class: 'tok skip', style: { cursor: 'default', width: '40px', height: '28px' } }, 'P'), 'checked by the dispatcher for nothing'))));  // legend item: a red token means the dispatcher checked it for nothing; this closes the whole layout
        },  // ends render() for step 4
      },  // end of step 4

      /* ============ 5. Creation and termination (classification games + spawn tree) ============ */
      {  // step 5 starts: why processes are created and why they end, as matching games plus a family tree
        title: 'Why processes are born, and why they end',  // page heading for step 5
        kind: 'lab',  // "lab" puts the label Hands-on Lab above the page heading
        render(el, ctx) {  // render(): builds step 5 when the student opens it
          const { h } = ctx;  // pulls out the helper that creates page elements
          /* a scenario-classification game: read a scenario, click the reason that explains it */
          function game(reasons, scen, order, o) {  // game(reasons, scen, order, o): builds a matching game where the student picks the reason behind each scenario
            let idx = 0, tries = 0, first = 0, solvedNow = false;  // idx is the scenario being shown, tries the wrong picks on it, first the count right on the first try, solvedNow whether it is solved
            const done = new Set();  // done remembers which reasons have been matched correctly at least once
            const btns = reasons.map((r, i) => h('button', { class: 'btn rbtn', type: 'button', onclick: () => choose(i) }, r[0]));  // one button per reason, labelled with the reason's name; a click checks the answer
            const head = h('div', { class: 'row', style: { justifyContent: 'space-between' } });  // head is the header row with the question number and the first-try score
            const text = h('div', { class: 'scen' });  // text holds the scenario being classified
            const fb = h('div', { class: 'msg', style: { minHeight: o.fbH || '96px' } });  // fb is the feedback box under the buttons
            const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { if (idx >= order.length) { idx = 0; first = 0; done.clear(); } else idx++; tries = 0; show(); } });  // the Next button: moves to the next scenario, or starts the whole game over after the last one
            const bar = h('i', { style: { width: '0%' } }), barTxt = h('div', { class: 'xs muted b' });  // bar is the filled part of the progress meter and barTxt the words above it
            const meter = h('div', { class: 'stack', style: { gap: '4px', marginTop: 'auto' } }, barTxt, h('div', { class: 'meter' }, bar));  // meter is the progress bar block, pushed to the bottom of its column
            const upd = () => { const n = Math.min(idx + (solvedNow ? 1 : 0), order.length); bar.style.width = (n / order.length) * 100 + '%'; barTxt.textContent = `MATCHED SO FAR: ${n} OF ${order.length}`; };  // upd(): sets the meter to the number of scenarios matched so far
            function show() {  // show(): displays the current scenario, or the finished screen
              solvedNow = false; upd();  // resets the solved flag and updates the meter
              btns.forEach((b, i) => { b.classList.remove('wrong'); b.classList.toggle('done', !!o.persist && done.has(i)); });  // clears red marks; in games with o.persist, reasons already matched stay green
              if (idx >= order.length) {  // after the last scenario, the finished screen
                head.innerHTML = `<h4 class="m0">All ${order.length} matched</h4><span class="chip ok">${first} of ${order.length} on the first try</span>`;  // header: "All N matched" plus how many were right on the first try
                text.textContent = 'Every scenario is matched to its reason.';  // replaces the scenario text with a closing line
                say(fb, 'ok', 'Finished', o.finish);  // shows the game's closing message
                next.textContent = 'Start over'; next.disabled = false; return;  // turns the Next button into "Start over" and stops here
              }  // ends the finished screen
              head.innerHTML = `<h4 class="m0">${o.ask} · ${idx + 1} of ${order.length}</h4><span class="chip">${first} right first try</span>`;  // header: the game's question, which scenario this is, and the first-try score so far
              text.textContent = scen[order[idx]][0];  // shows the scenario text
              say(fb, '', '', o.hint);  // shows the game's hint in the feedback box
              next.textContent = idx === order.length - 1 ? 'Finish ▶' : 'Next scenario ▶'; next.disabled = true;  // labels the Next button ("Finish" on the last scenario) and disables it until the scenario is solved
            }  // ends show()
            function choose(i) {  // choose(i): runs when the student clicks reason i
              if (idx >= order.length || solvedNow) return;  // ignored after the game ends or once this scenario is already solved
              const ans = scen[order[idx]][1];  // ans is the number of the correct reason for this scenario
              btns.forEach((b) => b.classList.remove('wrong'));  // clears red marks from earlier wrong picks
              if (i === ans) {  // a correct pick
                solvedNow = true; if (!tries) first++; done.add(i);  // marks it solved, counts a first-try success if there were no misses, and remembers the reason
                btns[i].classList.add('done');  // turns the chosen button green
                say(fb, 'ok', tries ? 'Right (on a later try)' : 'Right', `<b>${reasons[i][0]}</b>: ${reasons[i][1]}`);  // confirms the answer and repeats what the reason means
                head.querySelector('.chip').textContent = `${first} right first try`;  // updates the first-try score in the header
                next.disabled = false; upd();  // enables Next and moves the meter forward
              } else {  // a wrong pick
                tries++; btns[i].classList.add('wrong');  // counts the miss and turns the button red
                say(fb, 'bad', 'Not this one', `<b>${reasons[i][0]}</b> means: ${reasons[i][1]} Read the scenario again and try another reason.`);  // explains what the chosen reason actually means and asks the student to try again
              }  // ends the wrong-pick case
            }  // ends choose()
            show();  // shows the first scenario straight away
            return { btns, head, text, fb, next, meter };  // hands back the parts so the caller can arrange them on the page
          }  // ends game()

          /* ---- tab 1: creation ---- */
          const tabCreate = (p) => {  // tabCreate(p): fills the first tab, on process creation, inside panel p
            const g = game(CREATE, CREATE_SCEN, [0, 1, 2, 3, 4, 5], { ask: 'Why was this process created?', hint: 'Pick one of the four reasons above.', finish: 'All four reasons in action. Remember that the fourth, spawning, is how most processes on a modern desktop are born.' });  // a creation game over all six scenarios with its question, hint and closing message
            p.append(h('div', { class: 'split fill' },  // lays the tab out in two columns
              h('div', { class: 'stack gap-s' },  // left column: the reasons
                h('p', { class: 'm0', html: 'Each new process gets a <span class="t">process control block (PCB)</span> and memory. Four kinds of event typically create one:' }),  // paragraph: a new process gets a control block and memory, and four kinds of event create one
                ...CREATE.map(([n, d], i) => h('div', { class: 'card tight small' }, h('b', {}, `${i + 1}. ${n}. `), d)),  // one small card per creation reason, numbered 1 to 4
                h('div', { class: 'callout why m0 small', 'data-label': 'Spawning', html: 'Reason 4 is <span class="t">process spawning</span>: the creator is the <span class="t">parent process</span>, the new one its <span class="t">child process</span>. Build a family tree in the next tab.' })),  // box: reason 4 is spawning, which introduces the terms parent process and child process
              h('div', { class: 'card white stack' }, g.head, g.text, h('div', { class: 'stack gap-s' }, ...g.btns), g.fb, h('div', { class: 'row' }, g.next), g.meter)));  // right column: the game card with header, scenario, reason buttons, feedback, Next button and meter
          };  // ends tabCreate()

          /* ---- tab 2: parent and child ---- */
          const tabSpawn = (p) => {  // tabSpawn(p): fills the second tab, a family tree where processes spawn and end children
            const NAMES = ['editor', 'compiler', 'print helper', 'browser', 'browser tab', 'downloader', 'music player', 'backup tool', 'viewer'];  // NAMES: the names handed out to new child processes, in turn
            let nodes, sel, k, cascade = true;  // nodes is the list of processes, sel the selected one, k how many names were used, cascade whether children die with their parent
            const reset = () => { nodes = [{ id: 0, name: 'shell', parent: null, alive: true, why: '' }]; sel = 0; k = 0; };  // reset(): starts over with a single process, the shell, selected
            const tree = h('div', { class: 'stack', style: { gap: '4px' } });  // tree is the column of rows that draws the family tree
            const msg = h('div', { class: 'msg', style: { minHeight: '100px' } });  // msg is the narration box for this tab
            const kids = (id) => nodes.filter((n) => n.parent === id);  // kids(id): lists the direct children of process id
            function end(n, why, log) {  // end(n, why, log): marks process n as ended for the given reason and records it in log
              n.alive = false; n.why = why; log.push(`${n.name} (${why})`);  // sets the process as not alive, stores the reason and adds a line to the log
              kids(n.id).filter((c) => c.alive).forEach((c) => { if (cascade) end(c, 'parent termination', log); });  // when cascade is on, every living child also ends, for the reason "parent termination", and so on down the tree
            }  // ends end()
            function paint() {  // paint(): redraws the family tree
              const rows = [];  // rows collects each process with its depth in the tree
              const walk = (n, depth) => { rows.push([n, depth]); kids(n.id).forEach((c) => walk(c, depth + 1)); };  // walk(): visits a process and then all its children, one level deeper, so the list comes out in tree order
              walk(nodes[0], 0);  // starts the walk from the shell at the root
              tree.replaceChildren(...rows.map(([n, depth]) => h('button', { type: 'button', class: 'trow' + (n.id === sel ? ' sel' : '') + (n.alive ? '' : ' dead'), onclick: () => { sel = n.id; paint(); } },  // one button per process; the selected one is highlighted, ended ones are faded, and a click selects it
                h('span', { class: 'branch' }, depth ? '   '.repeat(depth - 1) + '└─' : ''),  // the branch drawing: indentation plus a corner line, deeper for grandchildren
                h('span', { class: 'pn' }, n.name),  // the process name in its pill
                h('span', { class: 'xs muted' }, n.alive ? (n.parent == null ? 'the first process here' : `child of ${nodes[n.parent].name}`) : `ended: ${n.why}`))));  // a small note: "the first process here", "child of ...", or why it ended
            }  // ends paint()
            const S = () => nodes[sel];  // S(): returns the selected process
            const act = {  // act: what each tree button does
              spawn() {  // spawn(): the selected process creates a child
                if (!S().alive) return say(msg, 'bad', 'Refused', `${S().name} has ended, and an ended process cannot create anything.`);  // refused if the selected process has already ended
                if (nodes.filter((n) => n.alive).length >= 7 || nodes.length >= 10) return say(msg, 'bad', 'That is enough', 'The tree is full for this demo. Press Reset to start again.');  // refused once the tree is big enough for the demo
                const c = { id: nodes.length, name: NAMES[k++ % NAMES.length], parent: sel, alive: true, why: '' };  // makes a child with the next name, whose parent is the selected process
                nodes.push(c);  // adds it to the list
                say(msg, 'ok', 'Spawned', `<b>${S().name}</b> asked the OS to create <b>${c.name}</b>. ${S().name} is the parent; ${c.name} is its child, a separate process with its own PCB. Both keep running.`); paint();  // explains that the parent asked the OS for a new process with its own control block, and both keep running
              },  // ends spawn()
              finish() {  // finish(): the selected process ends normally
                if (!S().alive) return say(msg, 'bad', 'Refused', `${S().name} has already ended.`);  // refused if it already ended
                const log = []; const n = S(); end(n, 'normal completion', log);  // ends the selected process with "normal completion", collecting any children that end with it
                say(msg, 'info', 'Ended', `<b>${n.name}</b> finished normally. ` + (log.length > 1 ? `Because this OS ends a parent’s children too, these also ended: ${log.slice(1).join(', ')}.` : kids(n.id).some((c) => c.alive) ? 'Its children keep running without their parent (UNIX-like systems hand such orphans to another process to look after).' : '')); paint();  // explains the result: either the children that also ended, or that the children live on as orphans
              },  // ends finish()
              kill() {  // kill(): the selected process's parent asks the OS to end it
                const n = S();  // n is the selected process
                if (!n.alive) return say(msg, 'bad', 'Refused', `${n.name} has already ended.`);  // refused if it already ended
                if (n.parent == null || !nodes[n.parent].alive) return say(msg, 'bad', 'Refused', `${n.name} has no living parent to make the request.`);  // refused if it has no parent, or its parent has ended, since nobody can make the request
                const log = []; end(n, 'parent request', log);  // ends it with the reason "parent request", collecting any children that end with it
                say(msg, 'info', 'Parent request', `<b>${nodes[n.parent].name}</b> asked the OS to end its child <b>${n.name}</b>.` + (log.length > 1 ? ` The cascade also ended: ${log.slice(1).join(', ')}.` : '')); paint();  // explains which parent made the request and lists any children ended by the cascade
              },  // ends kill()
            };  // closes the act table
            const seg = ctx.ui.seg([{ value: true, label: 'Children end too' }, { value: false, label: 'Children live on' }], cascade, (v) => { cascade = v; });  // two-way switch: whether ending a parent also ends its children, stored in cascade
            reset(); paint();  // sets up the starting tree and draws it
            say(msg, '', '', 'Select a process in the tree, then spawn children, finish one, or have a parent end its child.');  // the starting narration: select a process, then use the buttons
            p.append(h('div', { class: 'split fill' },  // lays the tab out in two columns
              h('div', { class: 'stack' },  // left column: explanation, switch, buttons and narration
                h('p', { class: 'm0', html: 'A process can ask the OS to create another process: <span class="t">process spawning</span>. The pair is called <b>parent</b> and <b>child</b>, and a child can spawn children of its own, so processes form a family tree.' }),  // paragraph: spawning, parent and child, and how this builds a family tree
                h('div', { class: 'card tight stack gap-s' }, h('div', { class: 'small b' }, 'When a parent ends, this OS makes its children…'), seg),  // a small card holding the cascade question and its switch
                h('div', { class: 'row' },  // the row of tree buttons
                  h('button', { class: 'btn sm primary', type: 'button', onclick: act.spawn }, 'Spawn a child'),  // main button: spawn a child of the selected process
                  h('button', { class: 'btn sm', type: 'button', onclick: act.finish }, 'Finish normally'),  // button: the selected process finishes normally
                  h('button', { class: 'btn sm', type: 'button', onclick: act.kill }, 'Parent ends this child'),  // button: the selected process's parent ends it
                  h('button', { class: 'btn sm', type: 'button', onclick: () => { reset(); paint(); say(msg, '', '', 'Fresh start: just the shell.'); } }, 'Reset')),  // button: reset the tree to just the shell
                msg,  // the narration box
                h('div', { class: 'callout why m0 small', 'data-label': 'Two termination reasons live here', html: '<b>Parent termination</b>: on systems that choose to, ending a parent also ends all of its children. <b>Parent request</b>: a parent usually has the authority to ask the OS to end any child it created.' })),  // box: the two termination reasons this tab demonstrates, parent termination and parent request
              h('div', { class: 'card white stack gap-s' }, h('h4', { class: 'm0' }, 'Process family tree (click to select)'), tree)));  // right column: the family tree in a white card
          };  // ends tabSpawn()

          /* ---- tab 3: termination ---- */
          const tabTerm = (p) => {  // tabTerm(p): fills the third tab, a matching game for the fourteen termination reasons
            const g = game(TERM.map(([n, d]) => [n, d]), TERM.map(([, , s], i) => [s, i]), [5, 0, 7, 3, 13, 9, 1, 11, 4, 8, 12, 2, 10, 6],  // a game with each reason's name and meaning as buttons, each reason's example as a scenario, in a mixed-up fixed order
              { persist: true, ask: 'Why was this process ended?', hint: 'Click the reason that fits best.', finish: 'You have seen all fourteen reasons. The ones in the middle of the list are the process doing something illegal, which the hardware or OS catches.', fbH: '118px' });  // options: matched reasons stay green, plus the question, hint, closing message and a taller feedback box
            p.append(h('div', { class: 'split fill' },  // lays the tab out in two columns
              h('div', { class: 'card stack gap-s' },  // left column: the reason buttons
                h('h4', { class: 'm0' }, 'Fourteen reasons a process ends'), h('div', { class: 'rgrid', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0,1fr)' } : null }, ...g.btns),  // heading and the grid of fourteen reason buttons, two columns (one on a small screen)
                h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '<b>Time limit exceeded</b> is about running too long in total. <b>Time overrun</b> is about <i>waiting</i> too long for an event.' })),  // warning box: time limit exceeded means running too long, time overrun means waiting too long
              h('div', { class: 'card white stack' }, g.head, g.text, g.fb, h('div', { class: 'row' }, g.next), g.meter)));  // right column: header, scenario, feedback, Next button and meter
          };  // ends tabTerm()

          el.append(ctx.ui.tabs([  // puts the three tabs on the page; each tab builds its content when opened
            { label: 'Creation: 4 reasons', render: tabCreate },  // tab 1: the four creation reasons
            { label: 'Parent and child', render: tabSpawn },  // tab 2: the parent and child family tree
            { label: 'Termination: 14 reasons', render: tabTerm },  // tab 3: the fourteen termination reasons
          ]));  // closes the tab list
        },  // ends render() for step 5
      },  // end of step 5

      /* ============ 6. Be the OS: five-state simulator ============ */
      {  // step 6 starts: the student plays the OS and moves processes through the five states
        title: 'Be the OS: drive processes through five states',  // page heading for step 6
        kind: 'lab',  // "lab" puts the label Hands-on Lab above the page heading
        core: true,  // core: true keeps this step on the shorter core path through the guide
        render(el, ctx) {  // render(): builds step 6 when the student opens it
          const { h } = ctx;  // pulls out the helper that creates page elements
          const TRIG = {  // TRIG: for each arrow of the five-state model, its label and the event that causes it
            create: ['Null → New', 'A process is created for one of the four reasons: a batch job, a log-on, an OS service, or spawning by another process.'],  // create: a process is created for one of the four reasons
            admit: ['New → Ready', 'The OS is prepared to take on one more process. Most systems cap the number of processes, or the memory promised to them, so that the machine is not overloaded. Until there is room, the process waits in New.'],  // admit: the OS agrees to take one more process, since systems cap how many they run at once
            dispatch: ['Ready → Running', 'The processor is free and the dispatcher chooses this process from the ready queue.'],  // dispatch: the processor is free and the dispatcher picks this process
            timeout: ['Running → Ready', 'The process used up its time slice (a <span class="t">timeout</span>), or the OS took the processor for a more important process (<span class="t">preemption</span>). Occasionally a process gives up the processor voluntarily.'],  // timeout: the time slice is used up or a more important process preempts it
            wait: ['Running → Blocked', 'The running process asks for something it must wait for: an I/O operation, a message, or a resource that is busy.'],  // wait: the process asks for something it must wait for, such as I/O
            occurs: ['Blocked → Ready', 'The event the process was waiting for happens, for example its disk read completes. It rejoins the ready queue.'],  // occurs: the awaited event happens and the process rejoins the ready queue
            release: ['Running → Exit', 'The process finishes its work, or is aborted while it runs (say, after a protection error).'],  // release: the process finishes or is aborted while running
            killReady: ['Ready → Exit', 'Another party ends the process while it waits its turn, for example its parent terminates it.'],  // killReady: another party ends the process while it is Ready
            killBlocked: ['Blocked → Exit', 'Another party ends the process while it waits for an event, for example its parent terminates it.'],  // killBlocked: another party ends the process while it is Blocked
          };  // closes the TRIG table
          const ORDER = ['create', 'admit', 'dispatch', 'timeout', 'wait', 'occurs', 'release', 'killReady', 'killBlocked'];  // ORDER: the nine transitions in the order the progress chips list them
          let lanes, sel, used, last, nextId, triedBR;  // the simulator's state: processes per lane, the selected token, transitions used, the last one taken, the next id, and whether Blocked → Running was tried
          const reset = () => { lanes = { new: ['P5'], ready: ['P2', 'P3'], running: ['P1'], blocked: ['P4'], exit: [] }; sel = null; used = new Set(); last = null; nextId = 6; triedBR = false; };  // reset(): the starting situation with P1 running, P2 and P3 ready, P4 blocked, P5 new, and nothing used yet
          const stateOf = (id) => Object.keys(lanes).find((k) => lanes[k].includes(id));  // stateOf(id): finds which lane (state) a process is in right now
          const move = (id, to) => { const f = stateOf(id); lanes[f] = lanes[f].filter((x) => x !== id); lanes[to].push(id); };  // move(id, to): takes the process out of its current lane and adds it to the back of lane "to"
          const msg = h('div', { class: 'msg', style: { minHeight: '128px' } });  // msg is the narration box under the diagram
          const d = diagram(ctx, 'five', { counts: true, label: 'Five-state model', onArrow: (a) => { d.clearGhost(); paint(a); say(msg, 'info', TRIG[a][0], TRIG[a][1]); }, onState: (s) => { d.clearGhost(); paint(); d.state(s, 'on'); say(msg, 'info', NAME[s], `${ctx.util.esc(({ new: 'Created but not yet admitted.', ready: 'Could run now; waiting for the processor.', running: 'On the processor right now (at most one).', blocked: 'Waiting for an event; cannot use the processor even if it is free.', exit: 'Finished or killed; never runs again.' })[s])} It holds <b>${lanes[s].length}</b> process${lanes[s].length === 1 ? '' : 'es'} now.`); } });  // draws the five-state diagram with counts; clicking an arrow explains its trigger, clicking a state describes it and how many processes it holds
          const laneEls = {};  // laneEls will hold the token area of each lane, keyed by state
          const progress = h('div', { class: 'row gap-s' });  // progress shows chips for the transitions used so far and the forbidden-move challenge
          function paint(hl) {  // paint(hl): redraws lanes, counts, diagram colours and progress; hl is an arrow to highlight for a moment
            for (const k of Object.keys(lanes)) {  // goes through every lane
              laneEls[k].replaceChildren(...(lanes[k].length ? lanes[k].map((id) => h('button', { type: 'button', class: tokCls(k) + (id === sel ? ' sel' : ''), onclick: () => { sel = sel === id ? null : id; d.clearGhost(); paint(); }, 'aria-label': `Select ${id}` }, id))  // fills the lane with one clickable token per process, coloured by state; clicking selects it or unselects it
                : [h('span', { class: 'empty' }, k === 'running' ? 'processor idle' : 'empty')]));  // an empty lane says "empty", and the Running lane says "processor idle"
              d.count(k, lanes[k].length);  // updates the count under that state's box in the diagram
            }  // ends the loop over lanes
            d.arrows((a) => (a === (hl || last) ? 'on' : used.has(a) ? 'used' : ''));  // the arrow just taken (or the one pointed at) is lit up, arrows already used are green, the rest plain
            d.states((s) => (sel && stateOf(sel) === s ? 'on' : ''));  // the state of the selected token is highlighted in the diagram
            progress.innerHTML = `<span class="chip ${used.size === 9 ? 'ok' : 'accent'}">transitions used: ${used.size} / 9</span>` +  // progress chips: the overall count of transitions used out of 9, green once all are done
              ORDER.map((a) => `<span class="chip ${used.has(a) ? 'ok' : ''}" style="${used.has(a) ? '' : 'opacity:.6'}">${TRIG[a][0]}</span>`).join('') +  // then one chip per transition, green once used and faded until then
              `<span class="chip ${triedBR ? 'ok' : 'warn'}">${triedBR ? '✓ tried' : 'try'} the forbidden Blocked → Running</span>`;  // and a final chip for the challenge of trying the forbidden Blocked → Running move
          }  // ends paint()
          const ok = (arrow, head, html) => { used.add(arrow); last = arrow; sel = null; say(msg, 'ok', head, html); paint(); };  // ok(): records a successful transition, clears the selection, shows the green narration and redraws
          const no = (html, from, to) => { say(msg, 'bad', 'Refused', html); paint(); if (from && to) d.ghost(from, to); };  // no(): shows a red refusal and, when given two states, draws the red "not allowed" arrow between them
          const gone = (id) => no(`<b>${id}</b> has exited. The OS may keep its records briefly (for example so its parent can collect results), but it will never run again.`);  // gone(id): refuses any action on a process that has exited, since it will never run again
          function act(a) {  // act(a): carries out transition a on the selected process, or refuses it with a reason
            d.clearGhost();  // clears any red arrow left from the last refusal
            if (a === 'create') {  // Create needs no selected process
              if (Object.keys(lanes).filter((k) => k !== 'exit').reduce((n, k) => n + lanes[k].length, 0) >= 8) return no('Eight live processes is plenty for this simulator. Finish or terminate some first.');  // refuses when eight processes are already alive, to keep the lanes readable
              const id = 'P' + nextId++; lanes.new.push(id);  // makes a new numbered process and adds it to New
              return ok('create', 'Null → New', `<b>${id}</b> is created. The OS has built its PCB, but it is not yet admitted to compete for the processor.`);  // records the "create" transition and explains that the control block exists but the process is not admitted yet
            }  // ends the Create case
            let id = sel;  // id is the process to act on: the selected one if any
            if (!id) id = { dispatch: lanes.ready[0], timeout: lanes.running[0], wait: lanes.running[0], release: lanes.running[0], admit: lanes.new[0], occurs: lanes.blocked[0] }[a];  // with nothing selected, picks the obvious process for each action (the front of the queue, the running one...)
            if (!id) return no('Select a process first: click one of the tokens in the lanes, then choose what happens to it.');  // still nobody to act on: asks the student to select a token first
            const st = stateOf(id), run = lanes.running[0];  // st is the process's current state, run the process on the processor (if any)
            if (st === 'exit') return gone(id);  // an exited process cannot take part in anything
            if (a === 'admit') {  // Admit
              if (st !== 'new') return no(`<b>${id}</b> is already ${NAME[st]}. Only a New process can be admitted.`);  // only a New process can be admitted
              move(id, 'ready'); return ok('admit', 'New → Ready (admit)', `<b>${id}</b> is admitted and joins the back of the ready queue.`);  // moves it to Ready and records the "admit" transition
            }  // ends the Admit case
            if (a === 'dispatch') {  // Dispatch
              if (st === 'blocked') { triedBR = true; return no(`<b>No Blocked → Running arrow.</b> ${id} is waiting for an event. If it got the processor it would still be stuck, so the processor would be wasted. When its event occurs it goes to <b>Ready</b> first and waits its turn like everyone else.`, 'blocked', 'running'); }  // a Blocked process cannot be dispatched: records the challenge as tried, explains why, and draws the forbidden arrow
              if (st === 'new') return no(`<b>${id}</b> has not been admitted yet. The dispatcher only chooses from the ready queue.`, 'new', 'running');  // a New process has not been admitted, so the dispatcher cannot pick it; the forbidden arrow is shown
              if (st === 'running') return no(`<b>${id}</b> is already running.`);  // a process that is already running needs no dispatch
              if (run) return no(`The processor is busy running <b>${run}</b>. With one processor, only one process can be Running. Time it out, or let it block or finish first.`);  // refused when another process holds the one processor
              move(id, 'running'); return ok('dispatch', 'Ready → Running (dispatch)', `The dispatcher gives the processor to <b>${id}</b>.` + (lanes.ready.length ? ` Still waiting in the ready queue: ${lanes.ready.join(', ')}.` : ''));  // moves it to Running, records "dispatch", and lists who is still waiting in the ready queue
            }  // ends the Dispatch case
            if (a === 'timeout') {  // Timeout
              if (st !== 'running') return no(`Only the Running process can time out: a timeout means the OS takes the processor from whoever is using it. <b>${id}</b> is ${NAME[st]}.`);  // only the running process can time out
              move(id, 'ready'); return ok('timeout', 'Running → Ready (timeout)', `<b>${id}</b>’s time slice is used up. It goes to the <b>back</b> of the ready queue; the processor is now free.`);  // moves it to the back of the ready queue and records "timeout"
            }  // ends the Timeout case
            if (a === 'wait') {  // Event wait
              if (st === 'ready') return no(`<b>${id}</b> is not executing, so it cannot ask for I/O. Only the running process can issue a request that makes it wait.`, 'ready', 'blocked');  // a Ready process is not executing, so it cannot make a request; the forbidden arrow is shown
              if (st !== 'running') return no(`Only the running process can start waiting for an event. <b>${id}</b> is ${NAME[st]}.`);  // any other non-running process is refused too
              move(id, 'blocked'); return ok('wait', 'Running → Blocked (event wait)', `<b>${id}</b> asks for a disk read and must wait for it. It moves to Blocked and frees the processor for someone else.`);  // moves the running process to Blocked and records "wait"
            }  // ends the Event wait case
            if (a === 'occurs') {  // Event occurs
              if (st !== 'blocked') return no(`<b>${id}</b> is not waiting for anything, so there is no event to occur for it.`);  // only a Blocked process has an event to wait for
              move(id, 'ready'); return ok('occurs', 'Blocked → Ready (event occurs)', `The disk read for <b>${id}</b> has finished. It joins the ready queue; it does <b>not</b> jump straight onto the processor.`);  // moves it to Ready, not straight to Running, and records "occurs"
            }  // ends the Event occurs case
            if (a === 'release') {  // Release
              if (st !== 'running') return no(`Release means the running process ends. <b>${id}</b> is ${NAME[st]}, not running. To end it from outside, use Terminate.`);  // only the running process can release; ending another one is what Terminate is for
              move(id, 'exit'); return ok('release', 'Running → Exit (release)', `<b>${id}</b> finishes and releases the processor for good.`);  // moves it to Exit and records "release"
            }  // ends the Release case
            if (a === 'kill') {  // Terminate
              if (st === 'new') return no('The five-state model lists no New → Exit transition: the usual cases are a Running process ending, or a parent ending a Ready or Blocked child. (The seven-state model later allows Exit from any state.)');  // refused for a New process: the five-state model has no New → Exit arrow
              move(id, 'exit');  // moves the process to Exit
              if (st === 'running') return ok('release', 'Running → Exit (aborted)', `<b>${id}</b> is aborted while running. That uses the same Running → Exit arrow as a normal finish.`);  // a running process being aborted uses the same arrow as a normal finish
              return ok(st === 'ready' ? 'killReady' : 'killBlocked', `${NAME[st]} → Exit (terminated)`, `<b>${id}</b> never gets to finish: its parent (or the OS) terminates it while it is ${NAME[st]}.`);  // otherwise records the dashed terminate arrow from Ready or Blocked and explains who ended it
            }  // ends the Terminate case
          }  // ends act()
          const B = (label, a, cls = 'btn sm') => h('button', { class: cls, type: 'button', onclick: () => act(a) }, label);  // B(label, a, cls): makes a button that runs transition a
          const lane = (k, lbl, sub, extra = '') => { laneEls[k] = h('div', { class: 'toks' }); return h('div', { class: 'lane' + extra }, h('div', { class: 'lbl', html: `${lbl}<small>${sub}</small>` }), laneEls[k]); };  // lane(k, lbl, sub, extra): builds one lane with its label and subtitle, and remembers its token area in laneEls
          reset();  // sets up the starting situation
          el.append(h('div', { class: 'split l fill' },  // lays the page out in two columns: diagram and narration on the left, lanes and buttons on the right
            h('div', { class: 'stack' }, h('div', { class: 'card white tight' }, d.svg), msg),  // left column: the diagram in a white card, then the narration box
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: a stack of instructions, lanes, buttons and progress
              h('div', { class: 'row nw', style: { alignItems: 'flex-start', gap: '12px' } },  // top row: instructions beside a Reset button, kept on one line
                h('p', { class: 'm0 small grow', html: 'You are the OS. <b>Click a process</b>, then a transition. With nothing selected, a button acts on the obvious process (Dispatch takes the front of the ready queue). Click diagram arrows for real-world triggers.' }),  // instructions: click a process, then a transition; with nothing selected the obvious process is used
                h('button', { class: 'btn sm', type: 'button', onclick: () => { reset(); d.clearGhost(); paint(); say(msg, '', '', 'Reset to the starting situation.'); } }, 'Reset')),  // Reset button: restores the starting situation and removes any red arrow
              lane('new', 'New', 'created, not admitted'), lane('ready', 'Ready queue', 'front on the left'), lane('running', 'Running', 'the one processor', ' cpu'),  // lanes for New, the ready queue and Running (tinted blue)
              lane('blocked', 'Blocked', 'waiting for an event'), lane('exit', 'Exit', 'finished or killed'),  // lanes for Blocked and Exit
              actGrid(ctx, 4, B('Create', 'create'), B('Admit', 'admit'), B('Dispatch', 'dispatch', 'btn sm primary'), B('Timeout', 'timeout'),  // first row of buttons: Create, Admit, Dispatch (the main one) and Timeout
                B('Event wait', 'wait'), B('Event occurs', 'occurs'), B('Release', 'release'), B('Terminate', 'kill', 'btn sm danger')),  // second row: Event wait, Event occurs, Release, and Terminate in the danger colour
              progress)));  // the progress chips close the right column and the layout
          paint();  // draws the starting situation
          say(msg, '', '', 'This is the <span class="t">five-state model</span>. P1 is <span class="t" data-t="Running state">Running</span>, P2 and P3 are <span class="t" data-t="Ready state">Ready</span>, P4 is <span class="t" data-t="Blocked state">Blocked</span> on the disk and P5 is <span class="t" data-t="New state">New</span>. Use all nine arrows (finished processes go to <span class="t" data-t="Exit state">Exit</span>), and try the move the model forbids: dispatching a Blocked process.');  // starting narration: who is in which state, and the goal of using all nine arrows plus trying the forbidden one
        },  // ends render() for step 6
      },  // end of step 6

      /* ============ 7. Queues: one blocked queue or many; priority ready queues ============ */
      {  // step 7 starts: one blocked queue versus one queue per event, plus priority ready queues
        title: 'Queues: one line for blocked processes, or many?',  // page heading for step 7
        kind: 'compare',  // "compare" puts the label Compare above the page heading
        render(el, ctx) {  // render(): builds step 7 when the student opens it
          const { h } = ctx;  // pulls out the helper that creates page elements
          const EV = { disk: 'disk', prn: 'printer', key: 'keyboard' };  // EV: the three events a process can wait for, with the name shown on its token
          const tk = (p, extra = '') => h('span', { class: 'tok ev2' + extra, style: { cursor: 'default' } }, p.id, p.ev ? h('span', { class: 'evn' }, EV[p.ev]) : null);  // tk(p, extra): a tall token showing the process name and, under it, the event it waits for
          const emptyEl = (t) => h('span', { class: 'empty' }, t || 'empty');  // emptyEl(t): the italic placeholder for an empty lane, "empty" unless another text is given

          /* ---- tab 1: one blocked queue versus one queue per event ---- */
          const tabBlocked = (panel) => {  // tabBlocked(panel): fills the first tab, which runs the same events against two queue designs side by side
            const START = [['P1', 'disk'], ['P2', 'key'], ['P3', 'disk'], ['P4', 'prn'], ['P5', 'key'], ['P6', 'disk'], ['P7', 'prn'], ['P8', 'disk']];  // START: eight blocked processes and the event each one waits for (disk, keyboard or printer)
            let one, many, readyL, readyR, costL, costR, skipped;  // the tab's state: both designs' blocked lists, both ready queues, how many control blocks each design touched, and the ones checked for nothing
            const reset = () => {  // reset(): refills both designs with the same eight blocked processes
              one = START.map(([id, ev]) => ({ id, ev }));  // design 1 gets them all in a single list
              many = { disk: [], prn: [], key: [] }; one.forEach((p) => many[p.ev].push({ ...p }));  // design 2 sorts copies of them into one list per event
              readyL = []; readyR = []; costL = 0; costR = 0; skipped = [];  // empties both ready queues and zeroes both counters
            };  // ends reset()
            const L = { blocked: h('div', { class: 'toks' }), ready: h('div', { class: 'toks' }), cost: h('span', { class: 'chip bad' }) };  // L: the parts of the design 1 card: its blocked lane, its ready lane and its red cost counter
            const R = { disk: h('div', { class: 'toks' }), prn: h('div', { class: 'toks' }), key: h('div', { class: 'toks' }), ready: h('div', { class: 'toks' }), cost: h('span', { class: 'chip ok' }) };  // R: the parts of the design 2 card: a lane per event, its ready lane and its green cost counter
            const laneR = {};  // laneR will hold the whole lane for each event in design 2, so the lane just used can be outlined
            const msgL = h('div', { class: 'msg small', style: { minHeight: '64px' } }), msgR = h('div', { class: 'msg small', style: { minHeight: '64px' } });  // one narration box under each design
            function paint(hit) {  // paint(hit): redraws both designs; hit names the event queue to outline in design 2
              L.blocked.replaceChildren(...(one.length ? one.map((p) => tk(p, ' blk' + (skipped.includes(p.id) ? ' skip' : ''))) : [emptyEl()]));  // design 1's blocked lane, with the processes checked for nothing shown in red
              L.ready.replaceChildren(...(readyL.length ? readyL.map((p) => tk({ id: p.id })) : [emptyEl()]));  // design 1's ready lane
              for (const e of Object.keys(EV)) { R[e].replaceChildren(...(many[e].length ? many[e].map((p) => tk(p, ' blk')) : [emptyEl()])); laneR[e].classList.toggle('hit', e === hit); }  // design 2's event lanes, each outlined when it is the one the last event used
              R.ready.replaceChildren(...(readyR.length ? readyR.map((p) => tk({ id: p.id })) : [emptyEl()]));  // design 2's ready lane
              L.cost.textContent = `PCBs touched: ${costL}`; R.cost.textContent = `PCBs touched: ${costR}`;  // both counters: how many process control blocks (PCBs) each design had to look at
            }  // ends paint()
            function fire(ev) {  // fire(ev): an event happens, and both designs wake the processes waiting for it
              const n = one.length, woke = one.filter((p) => p.ev === ev);  // n is the length of design 1's list and woke the processes in it waiting for this event
              one = one.filter((p) => p.ev !== ev); skipped = one.map((p) => p.id); costL += n; readyL.push(...woke);  // design 1: removes the woken ones, marks the rest as checked for nothing, adds n to its cost and moves the woken to Ready
              const w2 = many[ev]; many[ev] = []; costR += w2.length; readyR.push(...w2);  // design 2: takes the whole queue for this event, adds only its length to the cost and moves it to Ready
              say(msgL, woke.length ? 'bad' : '', `Scanned ${n} PCB${n === 1 ? '' : 's'}`, n ? `The OS checked every blocked process to find those waiting for the ${EV[ev]}: ${woke.length ? woke.map((p) => p.id).join(', ') + ' woke up' : 'none were'}. The red ones were checked for nothing.` : 'No blocked processes left.');  // design 1's narration: it scanned every blocked process to find the right ones
              say(msgR, 'ok', `Went straight to the ${EV[ev]} queue`, w2.length ? `Every process in that queue was waiting for exactly this event, so the OS moved all ${w2.length} (${w2.map((p) => p.id).join(', ')}) to Ready without looking at anyone else.` : `The ${EV[ev]} queue is empty, so there was nothing to do and nothing to search.`);  // design 2's narration: it went straight to the right queue and looked at nobody else
              paint(ev);  // redraws, outlining the queue that was used
            }  // ends fire()
            const lane = (lbl, sub, toks, cls = '') => h('div', { class: 'lane sm ' + cls }, h('div', { class: 'lbl', html: `${lbl}<small>${sub}</small>` }), toks);  // lane(lbl, sub, toks, cls): builds a compact lane with a label and subtitle
            ['disk', 'prn', 'key'].forEach((e) => (laneR[e] = lane(`${EV[e][0].toUpperCase() + EV[e].slice(1)} queue`, 'blocked', R[e])));  // builds design 2's three event lanes, titled "Disk queue", "Printer queue" and "Keyboard queue"
            reset(); paint();  // fills both designs and draws them when the tab opens
            say(msgL, '', '', 'One list holds every blocked process, whatever it is waiting for.');  // design 1's starting narration: one list holds everything
            say(msgR, '', '', 'A separate list for each event: disk, printer, keyboard.');  // design 2's starting narration: one list per event
            panel.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // lays the tab out as a stack that fills the panel
              h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Make an event happen:'),  // the top row of event buttons
                h('button', { class: 'btn sm io', type: 'button', onclick: () => fire('disk') }, 'Disk read finishes'),  // button: a disk read finishes
                h('button', { class: 'btn sm io', type: 'button', onclick: () => fire('prn') }, 'Printer finishes'),  // button: the printer finishes
                h('button', { class: 'btn sm io', type: 'button', onclick: () => fire('key') }, 'Key pressed'),  // button: a key is pressed
                h('button', { class: 'btn sm', type: 'button', onclick: () => { reset(); paint(); say(msgL, '', '', 'Refilled: eight blocked processes again.'); say(msgR, '', '', 'Refilled: eight blocked processes again.'); } }, 'Refill')),  // button: refill both designs with the starting eight processes
              h('div', { class: 'split grow', style: { gap: '14px' } },  // the two designs side by side
                h('div', { class: 'card stack gap-s' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Design 1: one blocked queue'), L.cost),  // design 1 card: its title and red cost counter
                  lane('Blocked queue', 'everyone waiting', L.blocked), lane('Ready queue', 'woken processes', L.ready), msgL,  // its blocked lane, its ready lane and its narration
                  h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', style: { marginTop: 'auto' }, html: 'A busy system may have hundreds of blocked processes. With one <span class="t">blocked queue</span>, every event means a search through all of them. With one queue per event, the OS just moves one whole list to Ready.' })),  // box pinned to the bottom: with hundreds of blocked processes, a single list means a search on every event
                h('div', { class: 'card stack gap-s' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Design 2: one queue per event'), R.cost),  // design 2 card: its title and green cost counter
                  laneR.disk, laneR.prn, laneR.key, lane('Ready queue', 'woken processes', R.ready), msgR))));  // its three event lanes, its ready lane and its narration, which close the layout
          };  // ends tabBlocked()

          /* ---- tab 2: priority ready queues ---- */
          const tabPrio = (panel) => {  // tabPrio(panel): fills the second tab, ready queues with priority levels
            const PN = ['High', 'Medium', 'Low'];  // PN: the names of the three priority levels, index 0 being the highest
            let lanes, run, nextId, hist, prio = 0, preempt = true;  // the tab's state: the three queues, the running process, the next id, the dispatch history, the chosen priority and whether preemption is on
            const reset = () => { lanes = [[], [{ id: 'P2', p: 1 }, { id: 'P3', p: 1 }], [{ id: 'P4', p: 2 }]]; run = { id: 'P1', p: 1 }; nextId = 5; hist = [run]; };  // reset(): P1 (Medium) running, P2 and P3 in the Medium queue, P4 in the Low queue, High empty
            const histEl = h('div', { class: 'row gap-s' });  // histEl shows the recent order in which processes got the processor
            const laneEls = [0, 1, 2].map(() => h('div', { class: 'toks' }));  // one token area per priority queue
            const runEl = h('div', { class: 'toks' });  // runEl is the token area for the processor
            const msg = h('div', { class: 'msg', style: { minHeight: '104px' } });  // msg is the narration box
            const pTok = (p, extra = '') => h('span', { class: 'tok' + extra, style: { cursor: 'default', width: '58px' } }, p.id, h('span', { class: 'tag', style: { background: 'var(--accent)' } }, PN[p.p][0]));  // pTok(p, extra): a token with a tag showing the first letter of its priority (H, M or L)
            function paint() {  // paint(): redraws the queues, the processor and the history
              laneEls.forEach((e, i) => e.replaceChildren(...(lanes[i].length ? lanes[i].map((p) => pTok(p)) : [emptyEl()])));  // fills each priority queue with its tokens, or "empty"
              runEl.replaceChildren(run ? pTok(run, ' run') : emptyEl('processor idle'));  // shows the running process, or "processor idle"
              histEl.innerHTML = hist.slice(-9).map((p, i, a) => `<span class="chip ${i === a.length - 1 ? 'accent' : ''}">${p.id} · ${PN[p.p]}</span>`).join('<span class="muted">→</span>');  // shows the last nine dispatches as chips joined by arrows, the newest one highlighted
            }  // ends paint()
            const pickNext = () => { const i = lanes.findIndex((l) => l.length); const p = i < 0 ? null : lanes[i].shift(); if (p) hist.push(p); return p; };  // pickNext(): takes the front of the highest non-empty queue, records it in the history and returns it
            const act = {  // act: what each button in this tab does
              add() {  // add(): a new process with the chosen priority becomes ready
                if (lanes.flat().length + (run ? 1 : 0) >= 9) return say(msg, 'bad', 'Full', 'Nine processes is plenty. Finish or dispatch some first.');  // refused once nine processes exist, to keep the lanes readable
                const p = { id: 'P' + nextId++, p: prio }; lanes[prio].push(p);  // makes the new process and puts it at the back of its priority's queue
                if (preempt && run && prio < run.p) {  // with preemption on, a higher-priority arrival takes the processor from a lower-priority runner
                  const old = run; lanes[old.p].push(old); run = pickNext();  // the old runner goes back to its queue and the dispatcher picks again, which finds the new arrival
                  say(msg, 'info', 'Preemption', `<b>${p.id}</b> (${PN[prio]}) became ready while <b>${old.id}</b> (${PN[old.p]}) was running. The OS <b>preempts</b> ${old.id}: Running → Ready, back of the ${PN[old.p]} queue, and dispatches ${run.id}.`);  // explains the preemption: who arrived, who was pushed back, and who now runs
                } else say(msg, 'ok', 'New ready process', `<b>${p.id}</b> joins the back of the ${PN[prio]} ready queue.` + (run && prio < run.p ? ' Preemption is off, so the running process keeps the processor until it times out.' : ''));  // otherwise just reports the new process; with preemption off it notes the runner keeps the processor
                paint();  // redraws
              },  // ends add()
              dispatch() {  // dispatch(): gives the free processor to the next process by priority
                if (run) return say(msg, 'bad', 'Refused', `The processor is busy with <b>${run.id}</b>. Time it out or let it finish first.`);  // refused if a process is already running
                run = pickNext();  // picks from the highest non-empty queue
                if (!run) return say(msg, 'bad', 'Nothing ready', 'All three ready queues are empty.');  // refused if every queue is empty
                say(msg, 'ok', 'Dispatch', `The dispatcher checks the High queue first, then Medium, then Low, and takes the front of the first non-empty one: <b>${run.id}</b> (${PN[run.p]}).`); paint();  // explains the search order High, Medium, Low and names the chosen process
              },  // ends dispatch()
              timeout() {  // timeout(): the running process's time slice ends
                if (!run) return say(msg, 'bad', 'Refused', 'Nothing is running.');  // refused if nothing is running
                const old = run; lanes[old.p].push(old); run = null;  // puts it at the back of its own priority's queue and frees the processor
                say(msg, 'ok', 'Timeout', `<b>${old.id}</b> goes to the back of the ${PN[old.p]} queue. Press Dispatch to see who goes next.`); paint();  // explains the move and suggests pressing Dispatch next
              },  // ends timeout()
              finish() {  // finish(): the running process ends
                if (!run) return say(msg, 'bad', 'Refused', 'Nothing is running.');  // refused if nothing is running
                say(msg, 'ok', 'Release', `<b>${run.id}</b> finishes and exits.`); run = null; paint();  // reports the exit, frees the processor and redraws
              },  // ends finish()
            };  // closes the act table
            reset(); paint();  // sets up and draws the starting situation
            say(msg, '', '', 'Add a High-priority process while a Medium one is running and watch what preemption does. Then dispatch repeatedly and notice Low waits until the higher queues are empty.');  // starting narration: what to try first to see preemption and how Low waits
            const B = (t, f, c = 'btn sm') => h('button', { class: c, type: 'button', onclick: f }, t);  // B(t, f, c): makes a small button with text t that runs f
            panel.append(h('div', { class: 'split fill' },  // lays the tab out in two columns
              h('div', { class: 'stack' },  // left column: explanation and controls
                h('p', { class: 'm0', html: 'With one <span class="t">ready queue</span>, the dispatcher simply takes the front. Many systems give processes <b>priorities</b> and keep <b>one ready queue per priority level</b>. The dispatcher always serves the highest non-empty level.' }),  // paragraph: one ready queue per priority, with the dispatcher serving the highest non-empty level
                h('div', { class: 'card tight stack gap-s' },  // a card holding the controls
                  h('div', { class: 'row' }, h('span', { class: 'small b' }, 'New process priority'), ctx.ui.seg(PN.map((n, i) => ({ value: i, label: n })), prio, (v) => (prio = v))),  // switch for the priority of the next new process
                  h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Preemptive?'), ctx.ui.seg([{ value: true, label: 'Yes' }, { value: false, label: 'No' }], preempt, (v) => (preempt = v))),  // switch that turns preemption on or off
                  h('div', { class: 'row' }, B('New ready process', act.add, 'btn sm primary'), B('Dispatch', act.dispatch), B('Timeout', act.timeout), B('Finish', act.finish),  // the buttons: new ready process (the main one), Dispatch, Timeout, Finish
                    B('Reset', () => { reset(); paint(); say(msg, '', '', 'Back to the start.'); }, 'btn sm'))),  // and Reset, which returns to the starting situation; this closes the controls card
                msg,  // the narration box
                h('div', { class: 'callout warn m0 small', 'data-label': 'Watch out', html: 'If high-priority work keeps arriving, low-priority processes may wait a very long time. Real schedulers often raise the priority of a process that has waited too long.' })),  // warning box: a stream of high-priority work can starve low-priority processes, so real schedulers raise their priority over time
              h('div', { class: 'card stack gap-s' },  // right column: the queues card
                h('h4', { class: 'm0' }, 'Ready queues by priority'),  // the card's heading
                ...PN.map((n, i) => h('div', { class: 'lane' }, h('div', { class: 'lbl', html: `${n}<small>${['served first', 'served second', 'served last'][i]}</small>` }), laneEls[i])),  // one lane per priority level, labelled served first, second or last
                h('div', { class: 'lane cpu' }, h('div', { class: 'lbl', html: 'Running<small>the processor</small>' }), runEl),  // the processor lane, tinted blue
                h('p', { class: 'small muted m0', html: 'The letter on each process is its priority. A timed-out or preempted process returns to the back of <b>its own</b> priority queue.' }),  // note: the letter on each token is its priority, and a process always returns to its own level's queue
                h('div', { class: 'card white tight stack gap-s', style: { marginTop: 'auto' } }, h('h4', { class: 'm0' }, 'Who got the processor, in order (latest 9)'), histEl))));  // a white card pinned to the bottom with the dispatch history; this closes the layout
          };  // ends tabPrio()

          el.append(ctx.ui.tabs([  // puts the two tabs on the page
            { label: 'Blocked: one queue vs one per event', render: tabBlocked },  // tab 1: one blocked queue versus one per event
            { label: 'Ready: priority queues', render: tabPrio },  // tab 2: priority ready queues
          ]));  // closes the tab list
        },  // ends render() for step 7
      },  // end of step 7

      /* ============ 8. Swapping and the single Suspend state (bring-one-back game) ============ */
      {  // step 8 starts: swapping, and a game showing why one Suspend state is not enough
        title: 'Out of room: swapping and one Suspend state',  // page heading for step 8
        kind: 'explore',  // "explore" puts the label Explore above the page heading
        render(el, ctx) {  // render(): builds step 8 when the student opens it
          const { h } = ctx;  // pulls out the helper that creates page elements
          const tally = { one: { u: 0, w: 0 }, two: { u: 0, w: 0 } };  // tally counts useful and wasted swaps separately for the one-state and two-state designs
          let mode = 'one', round = 0, d, mem, disk, phase, last;  // the game's state: the design in use, the round number, the diagram, memory, disk, the phase of the round and the last arrow
          const diagWrap = h('div'), diagCap = h('div', { class: 'xs muted b' });  // diagWrap holds the diagram and diagCap the small caption above it
          const cpu = h('div', { class: 'cpustat' });  // cpu is the line that says whether the processor is running something or idle
          const slots = h('div', { class: 'slots' }), diskEl = h('div', { class: 'toks' });  // slots shows the three memory slots and diskEl the processes on disk
          const msg = h('div', { class: 'msg', style: { minHeight: '104px' } });  // msg is the narration box
          const tallyEl = h('div', { class: 'row gap-s' });  // tallyEl shows the useful and wasted counts for both designs
          const nextBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { newRound(); paint(); intro(); } }, 'Next round ▶');  // the Next round button starts a fresh round; it is enabled only when a round is finished
          /* memory holds three Blocked processes; three more wait on disk, and the events of one or two of those have already happened */
          function newRound() {  // newRound(): sets up a new round with three blocked processes in memory and three on disk
            round++;  // counts the round
            const rnd = ctx.util.seeded(round * 97 + 13);  // a seeded random generator (the same seed always gives the same numbers), so each round number always plays out the same way
            mem = ['P1', 'P2', 'P3'].map((id) => ({ id, st: 'blocked' }));  // memory: P1, P2 and P3, all Blocked
            disk = ['P4', 'P5', 'P6'].map((id) => ({ id, done: false }));  // disk: P4, P5 and P6, none marked as having had their event yet
            ctx.util.shuffle([0, 1, 2], rnd).slice(0, rnd() < 0.5 ? 1 : 2).forEach((k) => (disk[k].done = true));  // picks one or two of the disk processes at random and marks their events as already done
            phase = 'out'; last = null;  // the round starts in the "swap one out" phase with no arrow highlighted
          }  // ends newRound()
          function setDiagram() {  // setDiagram(): draws the diagram that matches the chosen design
            d = diagram(ctx, mode === 'one' ? 'one' : 'split', { label: mode === 'one' ? 'Five-state model plus a single Suspend state' : 'Ready/Suspend and Blocked/Suspend beside Ready, Blocked and Running' });  // the one-Suspend-state layout, or the close-up with Ready/Suspend and Blocked/Suspend
            diagWrap.replaceChildren(d.svg);  // puts the diagram on the page in place of the old one
            diagCap.textContent = mode === 'one' ? 'FIRST ATTEMPT: FIVE STATES + ONE SUSPEND STATE' : 'THE FIX: TWO SUSPEND STATES (NEW AND EXIT NOT SHOWN)';  // sets the caption above it: first attempt or the fix
          }  // ends setDiagram()
          const hidden = () => mode === 'one' && phase !== 'done';     // one Suspend state: the OS cannot see who is still waiting
          const diskLabel = (p) => (mode === 'two' ? NAME[p.done ? 'rs' : 'bs'] : hidden() ? 'Suspend' : p.done ? 'event done' : 'still waiting');  // diskLabel(p): the words under a disk token: the state's name, "Suspend" when hidden, or the truth after the round
          const diskCls = (p) => 'tok sus' + (hidden() ? ' new' : p.done ? '' : ' blk');  // diskCls(p): the look of a disk token: grey when hidden, caution colour when still waiting, teal when its event is done
          function paint() {  // paint(): redraws the memory slots, disk, processor line, tallies and diagram
            slots.replaceChildren(...[0, 1, 2].map((i) => {  // builds the three memory slots
              const p = mem[i];  // p is the process in this slot, if any
              if (!p) return h('div', { class: 'slot free' }, 'free slot');  // an empty slot shows "free slot"
              return h('div', { class: 'slot' }, h('button', { type: 'button', class: tokCls(p.st), onclick: () => clickMem(p), 'aria-label': 'Swap out ' + p.id }, p.id), h('span', { class: 'sl' }, p.note || NAME[p.st]));  // a filled slot shows a clickable token (to swap it out) and its state under it
            }));  // ends the slot list
            diskEl.replaceChildren(...disk.map((p) => h('span', { class: 'dsk' },  // builds one entry per process on disk
              h('button', { type: 'button', class: diskCls(p), onclick: () => clickDisk(p), 'aria-label': 'Bring back ' + p.id }, p.id), h('span', { class: 'sl' }, diskLabel(p)))));  // a clickable token (to bring it back) with its label under it
            const run = mem.find((p) => p && p.st === 'running');  // run is the process in memory that is running, if any
            cpu.className = 'cpustat ' + (run ? 'busy' : 'idle');  // colours the processor line blue when busy, red when idle
            cpu.textContent = run ? `Processor: running ${run.id}` : phase === 'done' ? 'Processor still IDLE' : 'Processor IDLE: every process in memory is Blocked';  // the processor line's text: who is running, or why the processor is idle
            tallyEl.innerHTML = ['one', 'two'].map((m) => `<span class="chip ${tally[m].w ? 'bad' : tally[m].u ? 'ok' : ''}">${m === 'one' ? 'One state' : 'Two states'}: ${tally[m].u} useful · ${tally[m].w} wasted</span>`).join('');  // the tally chips for both designs: red once any swap was wasted, green once any was useful
            nextBtn.disabled = phase !== 'done';  // enables Next round only when the round is finished
            const sus = mode === 'one' ? 'suspend' : 'suspendB';  // sus is the id of the "suspend" arrow in the current diagram
            d.arrows((a) => (a === last ? 'on' : phase !== 'out' && a === sus ? (phase === 'in' ? 'on' : 'used') : a === 'dispatch' && run ? 'used' : ''));  // lights the diagram: the last arrow taken, the suspend arrow during and after the swap out, and dispatch once something runs
          }  // ends paint()
          const intro = () => say(msg, 'info', `Round ${round} · step 1 of 2`, 'All three processes in memory are <b>Blocked</b> waiting for the disk, so nothing can run and nothing new fits. <b>Click one of them</b> to swap it out to disk and free its slot.');  // intro(): the narration for the start of a round, asking the student to swap one blocked process out
          function clickMem(p) {  // clickMem(p): runs when the student clicks a process in memory
            if (phase !== 'out') return say(msg, 'bad', 'Not now', phase === 'in' ? 'A slot is already free. Now choose a process on disk to bring back.' : 'This round is over. Press <b>Next round</b>, or switch designs.');  // only allowed in the first phase; otherwise explains what to do instead
            mem[mem.indexOf(p)] = null;  // empties the process's memory slot
            disk.push({ id: p.id, done: false });  // adds it to the disk, still waiting
            phase = 'in';  // moves on to the "bring one back" phase
            say(msg, 'info', `Round ${round} · step 2 of 2`, `<b>${p.id}</b> is copied out to disk (${mode === 'one' ? 'Blocked → Suspend' : 'Blocked → Blocked/Suspend'}) and its slot is free. Now <b>click a process on disk</b> to bring back. ` + (mode === 'one'  // explains which transition just happened and asks the student to pick a process on disk
              ? 'While they sat on disk, the disk reads of some of them finished, but with one Suspend state they all look the same.'  // with one Suspend state: some disk reads finished, but every suspended process looks the same
              : 'This time the OS records whether each suspended process is still waiting.'));  // with two suspend states: the OS records whether each one is still waiting
            paint();  // redraws
          }  // ends clickMem()
          function clickDisk(p) {  // clickDisk(p): runs when the student clicks a process on disk
            if (phase === 'out') return say(msg, 'bad', 'No room yet', 'Memory is full (3 of 3 slots). Swap a Blocked process out first.');  // refused while memory is still full
            if (phase === 'done') return say(msg, 'bad', 'Round over', 'Press <b>Next round</b> to try again, or switch designs.');  // refused after the round is over
            const one = mode === 'one', slot = mem.indexOf(null);  // one is true for the one-Suspend-state design; slot is the free memory slot
            disk = disk.filter((q) => q !== p);  // takes the process off the disk
            phase = 'done';  // the round is over after this choice
            if (p.done) {  // its event had already happened, so it can run
              mem[slot] = { id: p.id, st: 'running' }; tally[mode].u++; last = 'activate';  // it goes into memory as Running, counts as a useful swap, and the activate arrow lights up
              say(msg, 'ok', one ? 'Useful swap, by luck' : 'Right choice', one  // the narration's heading depends on the design: lucky with one state, a sound choice with two
                ? `<b>${p.id}</b>’s disk read had already finished, so it arrives Ready and the dispatcher runs it. But the OS could not have known: in one Suspend state they all looked alike. The labels on disk now show the truth.`  // one state: it worked, but the OS could not have known which process to pick
                : `<b>${p.id}</b> was in <b>Ready/Suspend</b>, so the OS knew its event had happened. Activate (Ready/Suspend → Ready) brings it in, and the dispatcher runs it.`);  // two states: it was in Ready/Suspend, so the OS knew its event had happened
            } else {  // its event had not happened yet
              mem[slot] = { id: p.id, st: 'blocked', note: 'still Blocked' }; tally[mode].w++; last = one ? 'activate' : 'activateB';  // it goes into memory still Blocked, counts as a wasted swap, and the matching activate arrow lights up
              say(msg, 'bad', 'Wasted swap', one  // the narration's heading: a wasted swap
                ? `<b>${p.id}</b> is still waiting for its disk read. The activate arrow promises Ready, yet ${p.id} lands in memory Blocked: a slow disk transfer bought nothing and the processor is still idle. The labels on disk now show what the OS could not see.`  // one state: the slow transfer bought nothing, because the OS could not see it was still waiting
                : `<b>${p.id}</b> was in <b>Blocked/Suspend</b>: still waiting. Bringing it in (Blocked/Suspend → Blocked) fills the slot with a process that cannot run. The labels warned you; pick a Ready/Suspend one.`);  // two states: it was in Blocked/Suspend, so the labels warned against it
            }  // ends the wasted case
            paint();  // redraws
          }  // ends clickDisk()
          const seg = ctx.ui.seg([{ value: 'one', label: 'One Suspend state' }, { value: 'two', label: 'Two suspend states' }], mode, (v) => { mode = v; setDiagram(); newRound(); paint(); intro(); });  // two-way switch between the one-state and two-state designs; switching redraws the diagram and starts a new round
          setDiagram(); newRound(); paint(); intro();  // draws the diagram, sets up round 1, paints it and shows the intro as soon as the page opens
          el.append(h('div', { class: 'split fill' },  // lays the page out in two equal columns
            h('div', { class: 'stack' },  // left column: explanation
              h('p', { class: 'lead m0', html: 'I/O is far slower than the processor, so every process in main memory can end up <b>Blocked</b> at once while the processor sits idle.' }),  // opening paragraph: slow I/O can leave every process in memory Blocked while the processor idles
              h('p', { class: 'm0 small', html: 'Adding memory helps only for a while, because programs grow to fill it. The OS’s answer is <span class="t">swapping</span>: move all or part of a blocked process out to disk, into a <span class="t" data-t="Suspended process">Suspend</span> state, and use the freed memory for a process that can run. Bringing a suspended process back into memory is called <b>activating</b> it. Swapping is itself I/O, but the disk is usually the fastest I/O device, so it normally pays off.' }),  // paragraph: swapping moves a blocked process to disk (Suspend) and activating brings it back
              h('div', { class: 'card white tight stack gap-s' }, diagCap, diagWrap)),  // the diagram card with its caption; this closes the left column
            h('div', { class: 'card stack', style: { gap: '10px' } },  // right column: the game card
              h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'You are the OS'), seg),  // header row: "You are the OS" and the design switch (allowed to wrap on a small screen)
              h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { justifyContent: 'space-between' } }, cpu, nextBtn),  // second row: the processor line and the Next round button
              h('div', { class: 'lane' }, h('div', { class: 'lbl', html: 'Main memory<small>room for 3</small>' }), slots),  // the memory lane with room for three processes
              h('div', { class: 'lane' }, h('div', { class: 'lbl', html: 'Disk<small>suspended</small>' }), diskEl),  // the disk lane holding the suspended processes
              msg,  // the narration box
              h('div', { class: 'callout warn m0 small', 'data-label': 'The catch', html: 'Every process in Suspend was Blocked when it left memory. Its event may have happened since, and a single Suspend state cannot say which. Compare the wasted swaps of the two designs.' }),  // warning box: a single Suspend state cannot say whose event has happened since it left memory
              h('div', { class: 'row', style: { marginTop: 'auto' } }, tallyEl))));  // the tally chips pinned to the bottom of the card; this closes the layout
        },  // ends render() for step 8
      },  // end of step 8

      /* ============ 9. Suspension: the memory-pressure lab + seven-state model ============ */
      {  // step 9 starts: a memory-pressure lab driven through the seven-state model
        title: 'Seven states: Ready/Suspend and Blocked/Suspend',  // page heading for step 9
        kind: 'lab',  // "lab" puts the label Hands-on Lab above the page heading
        core: true,  // core: true keeps this step on the shorter core path through the guide
        render(el, ctx) {  // render(): builds step 9 when the student opens it
          const { h } = ctx;  // pulls out the helper that creates page elements
          const GOALS = [  // GOALS: six guided tasks, each as [the arrow it needs, the instruction shown to the student]
            ['suspendB', 'Make room: select a Blocked process and press <b>Suspend</b> (Blocked → Blocked/Suspend).'],  // goal 1: suspend a Blocked process to free a slot
            ['admit', '<b>Admit</b> the New process into the free slot (New → Ready).'],  // goal 2: admit the New process into that slot
            ['dispatch', 'Put the idle processor to work: <b>Dispatch</b> (Ready → Running).'],  // goal 3: dispatch it so the processor stops idling
            ['occursS', 'The disk finishes for the process on disk: select it, press <b>Event occurs</b> (Blocked/Suspend → Ready/Suspend).'],  // goal 4: the event arrives for the process on disk, making it Ready/Suspend
            ['release', 'Let the running process finish with <b>Release</b> (Running → Exit). That frees its slot.'],  // goal 5: the running process finishes, freeing its slot
            ['activate', 'Bring the ready process back from disk: <b>Activate</b> (Ready/Suspend → Ready).'],  // goal 6: activate the ready process from disk
          ];  // closes the GOALS list
          let P, sel, used, last, nextId;  // the lab's state: the processes, the selected one, the arrows used, the last arrow and the next id
          const reset = () => { P = [{ id: 'P1', st: 'blocked', slot: 0 }, { id: 'P2', st: 'blocked', slot: 1 }, { id: 'P3', st: 'blocked', slot: 2 }, { id: 'P4', st: 'new', slot: null }]; sel = null; used = new Set(); last = null; nextId = 5; };  // reset(): P1, P2 and P3 fill memory as Blocked, P4 waits in New, and nothing is used yet
          const inMem = () => P.filter((p) => ['ready', 'running', 'blocked'].includes(p.st));  // inMem(): the processes that occupy a memory slot (Ready, Running or Blocked)
          const byId = (id) => P.find((p) => p.id === id);  // byId(id): finds a process by its name
          const room = () => inMem().length < 3;  // room(): true while fewer than three processes are in memory
          const enterMem = (p, st) => { const taken = inMem().map((q) => q.slot); p.slot = [0, 1, 2].find((i) => !taken.includes(i)); p.st = st; };  // enterMem(p, st): puts p into the first free memory slot and gives it state st
          const cap = h('div', { class: 'msg info small', style: { minHeight: '84px' } });  // cap is the box that explains the trigger of the arrow just used or clicked
          const d = diagram(ctx, 'seven', { label: 'Seven-state model', onArrow: (a) => { paint(a); say(cap, 'info', TR7[a][0], TR7[a][1]); } });  // draws the seven-state diagram; clicking an arrow highlights it and explains what triggers it
          const goalRow = h('div', { class: 'goal' }), goalText = h('div', { class: 'small', style: { minHeight: '42px' } });  // goalRow shows the six goal markers and goalText the current goal's instruction
          const cpu = h('div', { class: 'cpustat' }), exitL = h('div', { class: 'xs muted' });  // cpu is the processor line and exitL the list of exited processes
          const newL = h('div', { class: 'toks' }), slots = h('div', { class: 'slots' }), disk = h('div', { class: 'toks' });  // the token areas for New, the three memory slots and the disk
          const msg = h('div', { class: 'msg small', style: { minHeight: '84px' } });  // msg is the narration box for the student's actions
          function paint(hl) {  // paint(hl): redraws the whole lab; hl is an arrow to highlight for a moment
            const tb = (p) => h('button', { type: 'button', class: tokCls(p.st) + (p.id === sel ? ' sel' : ''), onclick: () => { sel = sel === p.id ? null : p.id; paint(); }, 'aria-label': 'Select ' + p.id }, p.id);  // tb(p): a clickable token for process p that selects or unselects it
            const news = P.filter((p) => p.st === 'new');  // news are the processes still in New
            newL.replaceChildren(...(news.length ? news.map(tb) : [h('span', { class: 'empty' }, 'none')]));  // fills the New area, or "none"
            slots.replaceChildren(...[0, 1, 2].map((i) => { const p = inMem().find((q) => q.slot === i); return p ? h('div', { class: 'slot' }, tb(p), h('span', { class: 'sl' }, NAME[p.st])) : h('div', { class: 'slot free' }, 'free slot'); }));  // fills each memory slot with its process and state name, or shows it as free
            const onDisk = P.filter((p) => p.st === 'rs' || p.st === 'bs');  // onDisk are the suspended processes
            disk.replaceChildren(...(onDisk.length ? onDisk.map((p) => h('span', { class: 'dsk' }, tb(p), h('span', { class: 'sl' }, NAME[p.st]))) : [h('span', { class: 'empty' }, 'nothing swapped out')]));  // fills the disk area with each one and its state name, or "nothing swapped out"
            const run = P.find((p) => p.st === 'running'), rdy = P.find((p) => p.st === 'ready');  // run is the running process and rdy any Ready one
            cpu.className = 'cpustat ' + (run ? 'busy' : 'idle');  // colours the processor line blue when busy, red when idle
            cpu.textContent = run ? `Processor: running ${run.id}` : rdy ? `Processor IDLE, yet ${rdy.id} is Ready` : 'Processor IDLE: nothing in memory can run';  // the processor line's text; it points out when the processor idles even though a process is Ready
            const ex = P.filter((p) => p.st === 'exit');  // ex are the processes that have exited
            exitL.textContent = ex.length ? 'Exited: ' + ex.map((p) => p.id).join(', ') : 'Exited: none';  // lists them under the lanes
            const k = GOALS.findIndex(([a]) => !used.has(a));  // k is the first goal not yet reached
            goalRow.replaceChildren(h('b', { class: 'small', style: { marginRight: '4px' } }, 'Goals'), ...GOALS.map(([a], i) => h('span', { class: used.has(a) ? 'done' : i === k ? 'cur' : '', title: TR7[a][0] }, used.has(a) ? '✓' : String(i + 1))));  // redraws the goal markers: a tick for each goal reached, the current one outlined, the rest numbered
            goalText.innerHTML = k < 0 ? '<b>All six goals done.</b> Now explore the rest: suspend a Ready or Running process, admit a new arrival while memory is full, or activate a Blocked/Suspend process.' : `<b>Goal ${k + 1}:</b> ${GOALS[k][1]}`;  // shows the current goal's instruction, or suggestions for free exploration after all six
            d.arrows((a) => (a === (hl || last) ? 'on' : used.has(a) ? 'used' : ''));  // lights the diagram: the arrow just taken, arrows used before in green
            d.states((s) => (sel && byId(sel).st === s ? 'on' : ''));  // highlights the state of the selected token
          }  // ends paint()
          const ok = (a, html) => { used.add(a); last = a; sel = null; say(msg, 'ok', TR7[a][0], html); say(cap, 'info', TR7[a][0], TR7[a][1]); paint(); };  // ok(): records a successful transition, clears the selection, fills both boxes and redraws
          const no = (html) => { say(msg, 'bad', 'Refused', html); paint(); };  // no(): shows a red refusal and redraws
          const FULL = 'Main memory is full (3 of 3 slots). Suspend a process or let one finish first.';  // FULL: the refusal used whenever a move needs a memory slot and none is free
          function act(a) {  // act(a): carries out action a on the selected process, or refuses it with a reason
            if (a === 'create') {  // Create needs no selected process
              if (P.filter((p) => p.st !== 'exit').length >= 7) return no('Seven live processes is plenty for this lab.');  // refused once seven live processes exist
              const p = { id: 'P' + nextId++, st: 'new', slot: null }; P.push(p);  // makes a new process in New
              return ok('create', `<b>${p.id}</b> arrives and waits in New to be admitted.`);  // records "create" and says it waits to be admitted
            }  // ends the Create case
            let id = sel;  // id is the process to act on: the selected one if any
            if (!id) { const f = (st) => (P.find((p) => p.st === st) || {}).id; id = { dispatch: f('ready'), timeout: f('running'), wait: f('running'), release: f('running'), admit: f('new'), activate: f('rs'), occurs: f('bs') || f('blocked') }[a]; }  // with nothing selected, picks the obvious process for each action, looking for the first one in the matching state
            if (!id) return no('Select a process first: click a token in New, in memory, or on disk.');  // still nobody to act on: asks the student to select a token
            const p = byId(id), st = p.st;  // p is the process and st its current state
            if (st === 'exit') return no(`<b>${id}</b> has exited and will never run again.`);  // an exited process cannot take part in anything
            const out = (to) => { p.slot = null; p.st = to; };  // out(to): takes p out of its memory slot and gives it state "to" (used when it goes to disk)
            switch (a) {  // chooses what to do by the button pressed
              case 'suspend':  // Suspend
                if (st === 'blocked') { out('bs'); return ok('suspendB', `<b>${id}</b> is swapped out to disk. Its slot is free, and it is still waiting for the disk.`); }  // a Blocked process goes to Blocked/Suspend, the usual case
                if (st === 'ready') { out('rs'); return ok('suspendR', `<b>${id}</b> could have run, but it is swapped out anyway. Usually a Blocked process is the better choice.`); }  // a Ready process goes to Ready/Suspend, allowed but usually a worse choice
                if (st === 'running') { out('rs'); return ok('suspendRun', `<b>${id}</b> is preempted and swapped straight out to disk. The processor is now idle.`); }  // a Running process is preempted and goes straight to Ready/Suspend
                if (st === 'new') return no(`<b>${id}</b> is not in memory yet, so there is nothing to swap out. (When memory is full, Admit sends it straight to disk.)`);  // a New process is not in memory, so there is nothing to swap out
                return no(`<b>${id}</b> is already on disk.`);  // anything else is already on disk
              case 'activate':  // Activate
                if (st !== 'rs' && st !== 'bs') return no(`Activate brings a suspended process back from disk. <b>${id}</b> is ${NAME[st]}, not on disk.`);  // only a suspended process can be activated
                if (!room()) return no(FULL);  // refused when memory is full
                if (st === 'rs') { enterMem(p, 'ready'); return ok('activate', `<b>${id}</b> is swapped back into memory and joins the ready queue.`); }  // from Ready/Suspend it comes back as Ready
                enterMem(p, 'blocked'); return ok('activateB', `<b>${id}</b> is back in memory but <b>still Blocked</b>: it holds a slot without being able to run. Usually a poor trade.`);  // from Blocked/Suspend it comes back still Blocked, which wastes a slot
              case 'admit':  // Admit
                if (st !== 'new') return no(`Only a New process can be admitted. <b>${id}</b> is ${NAME[st]}.`);  // only a New process can be admitted
                if (room()) { enterMem(p, 'ready'); return ok('admit', `<b>${id}</b> is admitted into a free memory slot and is Ready.`); }  // with room, it enters memory as Ready
                out('rs'); return ok('admitS', `Memory is full, so <b>${id}</b> is admitted straight to disk as Ready/Suspend.`);  // with memory full, it is admitted straight to disk as Ready/Suspend
              case 'dispatch':  // Dispatch
                if (st === 'rs') return no(`<b>${id}</b> is ready but on disk. Only processes in main memory can run: Activate it first.`);  // a Ready/Suspend process must be activated before it can run
                if (st === 'blocked' || st === 'bs') return no(`<b>${id}</b> is waiting for an event, and no arrow leads from a Blocked state to Running.`);  // no arrow leads from a Blocked state to Running
                if (st !== 'ready') return no(`Only a Ready process can be dispatched. <b>${id}</b> is ${NAME[st]}.`);  // only a Ready process can be dispatched
                if (P.some((q) => q.st === 'running')) return no('The processor is already busy.');  // refused when the processor is already busy
                p.st = 'running'; return ok('dispatch', `<b>${id}</b> gets the processor. No more idle time.`);  // gives the process the processor
              case 'occurs':  // Event occurs
                if (st === 'blocked') { p.st = 'ready'; return ok('occurs', `The disk read for <b>${id}</b> completes. It is in memory, so it becomes Ready.`); }  // a Blocked process in memory becomes Ready
                if (st === 'bs') { p.st = 'rs'; return ok('occursS', `The disk read for <b>${id}</b> completes while it is on disk. It becomes <b>Ready/Suspend</b>: runnable, but still out of memory.`); }  // a Blocked/Suspend process becomes Ready/Suspend: runnable but still on disk
                return no(`<b>${id}</b> is not waiting for any event.`);  // anything else is not waiting for an event
              case 'wait':  // Event wait
                if (st !== 'running') return no(`Only the running process can start waiting for an event. <b>${id}</b> is ${NAME[st]}.`);  // only the running process can start waiting
                p.st = 'blocked'; return ok('wait', `<b>${id}</b> asks for a disk read and blocks. It keeps its memory slot while it waits.`);  // it becomes Blocked but keeps its memory slot while it waits
              case 'timeout':  // Timeout
                if (st !== 'running') return no(`Only the running process can time out. <b>${id}</b> is ${NAME[st]}.`);  // only the running process can time out
                p.st = 'ready'; return ok('timeout', `<b>${id}</b>’s time slice ends. It goes back to Ready and stays in memory.`);  // it goes back to Ready and stays in memory
              case 'release':  // Release
                if (st !== 'running') return no(`Only the running process can finish. <b>${id}</b> is ${NAME[st]}.`);  // only the running process can finish
                out('exit'); return ok('release', `<b>${id}</b> finishes. Its memory slot is free again.`);  // it goes to Exit and its memory slot is freed
            }  // ends the switch over actions
            return null;  // an unknown action does nothing
          }  // ends act()
          const B = (t, a, c = 'btn sm') => h('button', { class: c, type: 'button', onclick: () => act(a) }, t);  // B(t, a, c): makes a button with text t that runs action a
          const tabs = ctx.ui.tabs([  // the left side of the page is a set of tabs
            { label: 'Diagram', render: (p) => p.append(h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white tight' }, d.svg), cap)) },  // tab "Diagram": the seven-state diagram in a white card with the trigger explanation under it
            { label: 'Two suspend states', render: (p) => p.append(h('div', { class: 'stack' },  // tab "Two suspend states": why the single Suspend state was split
              h('p', { class: 'm0 small', html: 'With a single Suspend state, the OS could not tell which processes on disk were still waiting, so it sometimes fetched one that still could not run.' }),  // paragraph: one Suspend state hid which processes on disk were still waiting
              h('p', { class: 'm0 small', html: 'The fix is to track <b>two independent facts</b> about every process: is it waiting for an event, and is it in main memory? Four combinations give four states. Add New, Running and Exit, and you have the <b>seven-state model</b>.' }),  // paragraph: tracking "waiting?" and "in memory?" separately gives four states, seven with New, Running and Exit
              h('div', { class: 'mx' }, h('span'), h('div', { class: 'hd c' }, 'not waiting'), h('div', { class: 'hd c' }, 'waiting for an event'),  // the 2 by 2 matrix: an empty corner, then the two column headings
                h('div', { class: 'hd' }, 'in main memory'), h('div', { class: 'box proc', html: 'Ready<small>can be dispatched</small>' }), h('div', { class: 'box', style: { borderColor: 'var(--warn)', background: 'var(--warn-bg)' }, html: 'Blocked<small>in memory, waiting</small>' }),  // first row "in main memory": Ready (teal) and Blocked (caution colour)
                h('div', { class: 'hd' }, 'on disk'), h('div', { class: 'box proc sus', html: '<span class="t" data-t="Ready/Suspend state">Ready/Suspend</span><small>must be activated first</small>' }), h('div', { class: 'box sus', style: { borderColor: 'var(--warn)', background: 'var(--warn-bg)' }, html: '<span class="t" data-t="Blocked/Suspend state">Blocked/Suspend</span><small>two obstacles</small>' })),  // second row "on disk": Ready/Suspend and Blocked/Suspend with dashed borders; both names link to the glossary
              h('div', { class: 'callout tip m0 small', 'data-label': 'Rule of thumb', html: 'Only processes in main memory can be dispatched. The OS prefers to swap out Blocked processes, and to swap in Ready/Suspend ones.' }))) },  // tip box: only in-memory processes can run; swap out Blocked ones and swap in Ready/Suspend ones
            { label: 'Characteristics', render: (p) => p.append(h('div', { class: 'stack' },  // tab "Characteristics": what defines a suspended process
              h('p', { class: 'm0', html: 'What makes a <span class="t">suspended process</span> different from a merely blocked one:' }),  // paragraph introducing the list; the marked term links to the glossary
              h('div', { class: 'grid-2' }, ...SUSP_CHAR.map(([t, x], i) => h('div', { class: 'card tight' }, h('div', { class: 'b' }, `${i + 1}. ${t}`), h('div', { class: 'small' }, x)))),  // one numbered card for each of the four characteristics in SUSP_CHAR, two per row
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '“Suspended” does not mean “waiting for I/O”. Blocked is about an <b>event</b>; suspended is about being <b>set aside</b> (usually out of memory). A process can be either, both, or neither.' }))) },  // warning box: suspended is about being set aside, blocked is about an event, and they are independent
            { label: 'Reasons', render: (p) => p.append(h('div', { class: 'stack' },  // tab "Reasons": why a process may be suspended
              h('p', { class: 'm0', html: 'Memory pressure (<span class="t">swapping</span>) is the main reason, but not the only one:' }),  // paragraph: memory pressure is the main reason but not the only one
              h('table', { class: 'tbl compact', html: '<tr><th>Reason</th><th>What is going on</th></tr>' + SUSP_WHY.map(([r, x]) => `<tr><td><b>${r}</b></td><td>${x}</td></tr>`).join('') }),  // a compact table built from SUSP_WHY, one row per reason
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Whatever the reason, the OS uses the same two states, Ready/Suspend and Blocked/Suspend, and the process stays there until whoever suspended it says otherwise.' }))) },  // box: whatever the reason, the same two suspended states are used until the suspending agent releases the process
          ]);  // closes the tab list
          reset(); paint();  // sets up the starting situation and draws it
          say(msg, '', '', 'All three processes in memory wait for the disk, so the processor is idle and there is no room to admit P4 into memory. <b>Click a process, then an action</b> (with nothing selected, a button picks the obvious process). Follow the goals.');  // starting narration: memory is full of Blocked processes, the processor idles and P4 cannot be admitted
          say(cap, 'info', 'Seven-state model', '<b>Reminder:</b> to free memory the OS can <b>suspend</b> a process by <span class="t">swapping</span> it out to disk; <b>activating</b> it brings it back. Click any arrow to see what triggers it. Arrows you use in the lab turn green; the latest one is highlighted.');  // starting explanation box: a reminder of what suspend and activate mean and how the arrow colours work
          el.append(h('div', { class: 'split fill', style: { gap: '18px' } }, tabs,  // lays the page out in two columns: the tabs on the left, the lab card on the right
            h('div', { class: 'card stack', style: { gap: '8px' } },  // right column: the lab card
              h('div', { class: 'stack', style: { gap: '4px' } }, goalRow, goalText),  // the goal markers and the current goal's instruction
              h('div', { class: 'grid-2', style: { alignItems: 'center' } }, h('div', { class: 'stack', style: { gap: '2px' } }, cpu, exitL),  // a two-column row: the processor line and exited list on the left
                h('div', { class: 'lane sm' }, h('div', { class: 'lbl', html: 'New<small>not yet admitted</small>' }), newL)),  // and the compact New lane on the right
              h('div', { class: 'lane' }, h('div', { class: 'lbl', html: 'Main memory<small>room for 3</small>' }), slots),  // the memory lane with its three slots
              h('div', { class: 'lane' }, h('div', { class: 'lbl', html: 'Disk<small>swapped out</small>' }), disk),  // the disk lane with the suspended processes
              actGrid(ctx, 5,  // the action buttons in a five-column grid
                B('Suspend', 'suspend', 'btn sm primary'), B('Activate', 'activate', 'btn sm primary'), B('Admit', 'admit'), B('Dispatch', 'dispatch'), B('Event occurs', 'occurs'),  // first row: Suspend and Activate (the main buttons here), Admit, Dispatch, Event occurs
                B('Event wait', 'wait'), B('Timeout', 'timeout'), B('Release', 'release'), B('New arrives', 'create'),  // second row: Event wait, Timeout, Release, New arrives
                h('button', { class: 'btn sm', type: 'button', onclick: () => { reset(); paint(); say(msg, '', '', 'Back to the start: memory full of Blocked processes.'); } }, 'Reset')),  // and Reset, which returns to the starting situation
              msg,  // the narration box
              h('div', { class: 'row gap-s xs muted', style: { marginTop: 'auto' } }, h('span', { class: 'tok', style: { width: '38px', height: '26px', fontSize: '12.5px', cursor: 'default' } }, 'P'), 'solid: in memory',  // legend pinned to the bottom: a solid token means the process is in memory
                h('span', { class: 'tok sus', style: { width: '38px', height: '26px', fontSize: '12.5px', cursor: 'default' } }, 'P'), 'dashed: suspended on disk',  // a dashed token means it is suspended on disk
                h('span', { class: 'tok blk', style: { width: '38px', height: '26px', fontSize: '12.5px', cursor: 'default' } }, 'P'), 'orange: waiting'))));  // an orange token means it is waiting for an event; this closes the layout
        },  // ends render() for step 9
      },  // end of step 9

      /* ============ 10. Recap ============ */
      {  // step 10 starts: the recap with flip cards
        title: 'Recap: eight ideas to carry with you',  // page heading for step 10
        kind: 'recap',  // "recap" puts the label Recap above the page heading
        render(el, ctx) {  // render(): builds step 10 when the student opens it
          const { h } = ctx;  // pulls out the helper that creates page elements
          el.append(h('div', { class: 'stack fill' },  // lays the page out as a stack that fills the available height
            h('p', { class: 'lead m0' }, 'Say each answer out loud, then flip the card. Next, section 3.3 opens up the OS’s tables and the full PCB.'),  // opening line: say each answer aloud before flipping, and a pointer to section 3.3
            ctx.ui.flipcards([  // flip cards: the guide helper shows a question on the front and its answer on the back when clicked
              ['Traces and the dispatcher', 'A trace is the list of addresses a process executes. The dispatcher is OS code that switches processes. In the A/B/C example it used 24 of the first 52 cycles.'],  // card: traces and the dispatcher, with the 24 of 52 cycles from the example
              ['Why two states fail', 'One Not Running queue mixes processes that could run with ones waiting for I/O, so the dispatcher has to search. Fix: split it into Ready and Blocked.'],  // card: why the two-state model fails and how splitting Not Running fixes it
              ['The five states', 'New → Ready → Running → Exit, plus Blocked. Timeout: Running → Ready. Event wait: Running → Blocked. Event occurs: Blocked → Ready.'],  // card: the five states and the three main transitions between them
              ['Why no Blocked → Running?', 'A blocked process is still waiting, so the processor would be wasted on it. When its event occurs it goes to Ready and waits its turn.'],  // card: why there is no Blocked → Running arrow
              ['Four ways to be born', 'A new batch job, an interactive log-on, the OS providing a service, or spawning by an existing process (parent and child).'],  // card: the four reasons a process is created
              ['Fourteen ways to end', 'Normal completion, or trouble: time limit, memory, bounds, protection, arithmetic, time overrun, I/O, invalid or privileged instruction, data misuse, operator/OS, or the parent.'],  // card: the fourteen reasons a process ends, listed briefly
              ['One queue per event', 'When an event occurs, the OS moves that event’s whole queue to Ready instead of scanning every blocked process. Priorities can get one ready queue each.'],  // card: one queue per event, and one ready queue per priority
              ['Swapping and suspension', 'Swap Blocked processes to disk to free memory. One Suspend state cannot tell who is still waiting, so use two: Ready/Suspend and Blocked/Suspend. Only in-memory Ready processes can run.'],  // card: swapping, and why two suspended states beat one
            ], { cols: 4, height: 182 }),  // closes the card list: four columns of cards, each 182 pixels tall
            h('div', { class: 'callout why m0', 'data-label': 'The one-sentence version', html: 'A process’s state records <b>whether it could use the processor right now</b> and <b>whether it is in main memory</b>; every transition is the OS reacting to an event such as a timeout, an I/O request, an I/O completion, or a shortage of memory.' })));  // box: the one-sentence summary of what a state records and what causes each transition
        },  // ends render() for step 10
      },  // end of step 10

      /* ============ 11. Check yourself ============ */
      {  // step 11 starts: the end-of-section quiz
        title: 'Check yourself',  // page heading for step 11
        kind: 'check',  // "check" puts the label Check Yourself above the page heading
        quiz: [  // quiz: the questions; the guide's quiz engine draws them, checks answers and shows feedback
          { q: 'In the five-state model, which transition can <b>never</b> happen?', choices: ['Ready → Running', 'Blocked → Running', 'Running → Blocked', 'Blocked → Ready'], answer: 1,  // question 1 (multiple choice): which five-state transition can never happen; the answer is Blocked → Running
            feedback: ['This is dispatch, the normal way a process gets the processor.', null, 'This happens whenever a running process requests I/O or waits for another event.', 'This happens when the event a blocked process is waiting for occurs.'],  // feedback for each wrong choice: when dispatch, event wait and event occurs really happen
            why: 'A blocked process is still waiting for its event, so handing it the processor would waste it. When the event occurs it moves to Ready and waits its turn like everyone else.' },  // explanation shown after answering: a blocked process would waste the processor
          { type: 'num', q: 'Processes A (at 5000), B (at 8000) and C (at 12000) share one processor with a 6-instruction dispatcher at address 100. Each process may run at most 6 instruction cycles before a timeout, and B requests I/O on its 4th instruction. A runs first, then B, then C. At which cycle number does C execute its first instruction?',  // question 2 (calculate): the cycle at which C runs its first instruction in the A/B/C trace
            answer: 23, tol: 0, why: 'A uses cycles 1–6, the dispatcher 7–12, B 13–16 (then it blocks for I/O), the dispatcher 17–22. So C starts at cycle 23, at address 12000.' },  // the answer is 23, with no tolerance, followed by the cycle-by-cycle working
          { type: 'num', q: 'Three processes share one processor. A 6-instruction dispatcher runs between turns, each turn lasts at most 6 instruction cycles, and one process blocks for I/O after 4. Over the first 52 instruction cycles the dispatcher runs 4 times. What percentage of those 52 cycles is dispatcher overhead? Round to the nearest whole percent.',  // question 3 (calculate): the dispatcher's share of the first 52 cycles as a percentage
            answer: 46, tol: 1, unit: '%', why: '4 × 6 = 24 dispatcher cycles, and 24 ÷ 52 ≈ 0.46, so about 46%. It is this high only because 6-instruction turns are tiny; a real slice lasts milliseconds, which is millions of instructions, so real dispatch overhead is a small fraction.' },  // the answer is 46 percent, within 1, with why real overhead is far smaller
          { type: 'match', q: 'Match each five-state transition to the event that typically causes it.',  // question 4 (match the pairs): each five-state transition with the event that causes it
            pairs: [['New → Ready', 'The OS is prepared to take on another process'], ['Ready → Running', 'The dispatcher chooses the process'], ['Running → Ready', 'The time slice runs out'], ['Running → Blocked', 'The process requests I/O'], ['Blocked → Ready', 'The awaited event occurs']],  // the five pairs, from admit to event occurs
            why: 'Admit, dispatch, timeout, event wait and event occurs: each arrow in the model is the OS reacting to one kind of event.' },  // explanation: each arrow is the OS reacting to one kind of event
          { type: 'bucket', q: 'Is each event a reason a process is <b>created</b> or a reason one is <b>terminated</b>?', buckets: ['Creation', 'Termination'],  // question 5 (sort into groups): is each event a creation reason or a termination reason
            items: [['A user logs on at a terminal', 0], ['The process divides by zero', 1], ['A running program asks the OS to start a helper process', 0], ['The process tries to run an instruction reserved for the OS', 1],  // the first four items, each with the number of its correct group
              ['A batch job reaches the front of the job queue', 0], ['The process waits longer than allowed for an event', 1]],  // the last two items; closes the item list
            why: 'The four creation reasons are a new batch job, an interactive log-on, the OS providing a service, and spawning. Dividing by zero (arithmetic error), running a privileged instruction, and waiting too long for an event (time overrun) are all termination reasons.' },  // explanation: the creation reasons and the termination reasons behind the items
          { q: 'A process that is only allowed to <i>read</i> a file tries to <i>write</i> to it, and the OS ends the process. Which termination reason is this?', choices: ['Bounds violation', 'Protection error', 'Data misuse', 'Privileged instruction'], answer: 1,  // question 6 (multiple choice): writing to a read-only file; the answer is protection error
            feedback: ['A bounds violation is touching a memory location outside the area the process may use, not misusing a file.', null, 'Data misuse means data of the wrong type, or data that was never given a value.', 'A privileged instruction is an instruction reserved for the OS, not a file operation.'],  // feedback for each wrong choice: what bounds violation, data misuse and privileged instruction really mean
            why: 'Using a resource, such as a file, in a way the process is not permitted to is a protection error.' },  // explanation: misusing a resource such as a file is a protection error
          { type: 'match', q: 'Match each reason for suspending a process to the situation it describes.',  // question 7 (match the pairs): each reason for suspension with a situation
            pairs: [['Swapping', 'Main memory must be freed to bring in a process that is ready to run'], ['Other OS reason', 'The OS sets aside a background utility, or a process it suspects of causing a problem'],  // pairs for swapping and other OS reasons
              ['Interactive user request', 'A person pauses a program in order to debug it'], ['Timing', 'A monitoring job that runs once an hour waits for its next run'], ['Parent process request', 'A process wants to examine or change one of the processes it created']],  // pairs for user request, timing and parent request
            why: 'Swapping (memory pressure) is the most common reason, but the OS, a user, the clock or a parent can also set a process aside. Whatever the reason, it stays suspended until whoever suspended it releases it.' },  // explanation: swapping is the most common reason, and the suspending agent decides when it ends
          { type: 'multi', q: 'Which statements describe a <b>suspended</b> process?', choices: ['It is not immediately available for execution', 'It may or may not be waiting for an event', 'An agent put it there: itself, its parent, or the OS', 'It leaves the state only when that agent orders it', 'It is always waiting for I/O', 'It has been terminated and its PCB deleted'], answer: [0, 1, 2, 3],  // question 8 (select all): the four defining characteristics of a suspended process, plus two false statements
            why: 'Those four are the defining characteristics. Suspension is independent of waiting (so “always waiting for I/O” is wrong), and a suspended process still exists: it can be brought back.' },  // explanation: suspension is separate from waiting, and a suspended process still exists
          { type: 'order', q: 'A process is swapped out to disk while it waits for a disk read, and the read completes while it is still on disk. Put its moves in order.', items: ['Dispatched for the first time (Running)', 'Requests a disk read (Blocked)', 'Swapped out to disk (Blocked/Suspend)', 'The disk read completes (Ready/Suspend)', 'Swapped back into main memory (Ready)', 'Dispatched again (Running)'],  // question 9 (put in order): the six moves of a process suspended while waiting for a disk read
            why: 'Running → Blocked → Blocked/Suspend → Ready/Suspend → Ready → Running. The read completes while the process is on disk, so it becomes Ready/Suspend, not Ready; and it must reach Ready in main memory before it can run, because no arrow leads from a Blocked state straight to Running.' },  // explanation: the full path, and why the process becomes Ready/Suspend rather than Ready
          { q: 'Why do many operating systems keep a separate blocked queue for each kind of event?', choices: ['So a blocked process can be dispatched directly from its event queue', 'So that when an event occurs, the OS can move the whole matching queue to Ready without scanning every blocked process', 'So each device gets its own processor', 'Because a single queue cannot hold more than a few processes'], answer: 1,  // question 10 (multiple choice): why keep one blocked queue per event; the answer is to wake a whole queue without scanning
            feedback: ['Blocked processes are never dispatched; they must become Ready first.', null, 'Queues are bookkeeping lists; they do not create processors.', 'One queue can be as long as needed. The problem is the time it takes to search it.'],  // feedback for each wrong choice: blocked processes are never dispatched, queues do not create processors, length is not the issue
            why: 'With one queue per event, every process in the matching queue is waiting for exactly that event, so the OS can wake them all at once without searching.' },  // explanation: everyone in a matching queue waits for exactly that event
          { q: 'Every process in main memory is Blocked waiting for I/O, and the processor sits idle. What does the OS typically do?', choices: ['Dispatch one of the blocked processes anyway', 'Swap a blocked process out to disk (Blocked/Suspend) to make room for a process that can run', 'Terminate all of the blocked processes', 'Wait for one of the I/O operations to finish and leave memory as it is'], answer: 1,  // question 11 (multiple choice): all of memory is Blocked and the processor idles; the answer is to swap one out
            feedback: ['A blocked process cannot use the processor; that would waste it.', null, 'Waiting for I/O is normal, not a reason to end a process.', 'That leaves the processor idle, which is exactly the problem swapping solves.'],  // feedback for each wrong choice: dispatching a blocked process, terminating them, or just waiting
            why: 'Swapping a blocked process out frees memory, so the OS can admit a new process or bring back a Ready/Suspend one and keep the processor busy.' },  // explanation: swapping out frees memory so the processor can be kept busy
          { type: 'tf', q: 'In the two-state model, processes waiting for I/O share one Not Running queue with processes that could run. Even so, the dispatcher can always simply take the process at the front of that queue.', answer: false,  // question 12 (true or false): the two-state dispatcher can always take the front of its queue; the answer is false
            why: 'The front process may be waiting for I/O and unable to run, so the dispatcher must search past it. That flaw is why Not Running is split into Ready and Blocked.' },  // explanation: the front process may be waiting for I/O, which is why Not Running was split
        ],  // closes the quiz list
      },  // end of step 11
    ],  // closes the steps list

    notes: `${/* notes: the section's summary text, shown in the Section notes panel and in the printable version */''}
      <h3>Why an OS tracks process states</h3>${/* notes heading: why an OS tracks process states */''}
      <p>A machine holds many processes but has few processors, so most processes are not running at any instant. The OS records each process's <b>state</b> in its PCB. A <b>state model</b> lists the states and the events that move a process between them (think of a one-doctor clinic: waiting room, exam room, lab tests, discharge).</p>${/* notes paragraph: few processors, many processes, so the state record and the state model, with the clinic comparison */''}

      <h3>Traces and the dispatcher</h3>${/* notes heading: traces and the dispatcher */''}
      <p>A process's <b>trace</b> is the ordered list of instruction addresses it executes (the values its program counter takes). The <b>dispatcher</b> is a small piece of OS code that switches the processor from one process to another.</p>${/* notes paragraph: defines a trace and the dispatcher */''}
      <p><b>Example.</b> A, B and C are loaded at 5000, 8000 and 12000; the dispatcher is at 100 and is 6 instructions long (100–105). A process may run at most 6 instruction cycles before a timer interrupt ends its turn (a <b>timeout</b>). B's 4th instruction (8003) requests I/O. Each process sees only its own trace; the processor sees them interleaved:</p>${/* notes paragraph: sets up the A, B, C example and its rules */''}
      <table>${/* start of the notes table that lists the interleaved trace turn by turn */''}
        <tr><th>Cycles</th><th>Running</th><th>Addresses</th><th>How the turn ends</th></tr>${/* table header: cycles, who runs, addresses, how the turn ends */''}
        <tr><td>1–6</td><td>A</td><td>5000–5005</td><td>timeout; A back to Ready</td></tr>${/* turn 1: A runs 5000-5005 and times out */''}
        <tr><td>7–12</td><td>Dispatcher</td><td>100–105</td><td>chooses B</td></tr>${/* turn 2: the dispatcher chooses B */''}
        <tr><td>13–16</td><td>B</td><td>8000–8003</td><td>I/O request; B becomes Blocked</td></tr>${/* turn 3: B runs 8000-8003 and blocks for I/O */''}
        <tr><td>17–22</td><td>Dispatcher</td><td>100–105</td><td>chooses C (B is not eligible)</td></tr>${/* turn 4: the dispatcher chooses C, since B is not eligible */''}
        <tr><td>23–28</td><td>C</td><td>12000–12005</td><td>timeout</td></tr>${/* turn 5: C runs 12000-12005 and times out */''}
        <tr><td>29–34</td><td>Dispatcher</td><td>100–105</td><td>chooses A</td></tr>${/* turn 6: the dispatcher chooses A */''}
        <tr><td>35–40</td><td>A</td><td>5006–5011</td><td>timeout</td></tr>${/* turn 7: A resumes at 5006 and times out */''}
        <tr><td>41–46</td><td>Dispatcher</td><td>100–105</td><td>chooses C</td></tr>${/* turn 8: the dispatcher chooses C */''}
        <tr><td>47–52</td><td>C</td><td>12006–12011</td><td>timeout</td></tr>${/* turn 9: C resumes at 12006 and times out */''}
      </table>${/* end of the trace table */''}
      <p><b>Worked numbers.</b> In 52 cycles A ran 12, B 4, C 12 and the dispatcher 4 × 6 = 24, so overhead = 24 ÷ 52 ≈ 46%. It is high only because the slices are tiny: a real slice lasts milliseconds, which is millions of instructions. C first runs at cycle 23 (6 + 6 + 4 + 6 = 22 cycles come before it). A resumed process continues exactly where it stopped (A at 5006).</p>${/* notes paragraph: the worked numbers, 46 percent overhead and C first running at cycle 23 */''}

      <h3>The two-state model</h3>${/* notes heading: the two-state model */''}
      <p>Each process is <b>Running</b> or <b>Not Running</b>; not-running processes wait in one queue. <b>Enter</b>: a new process joins the back. <b>Dispatch</b>: a queued process gets the processor. <b>Pause</b>: the running process is interrupted and rejoins the back. <b>Exit</b>: the running process finishes.</p>${/* notes paragraph: the two states and the four transitions */''}
      <p><b>The flaw:</b> some queued processes are waiting for I/O and cannot run, so the dispatcher must search past them instead of taking the front. Fix: split Not Running into <b>Ready</b> and <b>Blocked</b>.</p>${/* notes paragraph: the flaw of the single queue and the fix */''}

      <h3>Why processes are created</h3>${/* notes heading: why processes are created */''}
      <ol>${/* start of the numbered list of creation reasons */''}
        <li><b>New batch job</b>: a previously submitted job is picked up.</li>${/* creation reason: new batch job */''}
        <li><b>Interactive log-on</b>: a user signs in at a terminal.</li>${/* creation reason: interactive log-on */''}
        <li><b>Created by the OS to provide a service</b>: e.g. to manage printing.</li>${/* creation reason: created by the OS to provide a service */''}
        <li><b>Spawned by an existing process</b>: a program asks the OS for another process.</li>${/* creation reason: spawned by an existing process */''}
      </ol>${/* end of the creation list */''}
      <p><b>Process spawning</b>: the creator is the <b>parent process</b>, the new one the <b>child process</b>; children can spawn children, forming a tree.</p>${/* notes paragraph: spawning, parent and child, and the family tree */''}

      <h3>Why processes are terminated (14 reasons)</h3>${/* notes heading: the fourteen termination reasons */''}
      <table>${/* start of the termination table */''}
        <tr><th>Reason</th><th>Meaning</th></tr>${/* table header: reason and meaning */''}
        <tr><td>Normal completion</td><td>Finished; told the OS it is done.</td></tr>${/* row: normal completion */''}
        <tr><td>Time limit exceeded</td><td>Ran longer in total than allowed (wall-clock time, processor time, or time since an interactive user last typed).</td></tr>${/* row: time limit exceeded, and the three ways the limit can be counted */''}
        <tr><td>Memory unavailable</td><td>Needs more memory than the system can give.</td></tr>${/* row: memory unavailable */''}
        <tr><td>Bounds violation</td><td>Reached a memory location it may not use.</td></tr>${/* row: bounds violation */''}
        <tr><td>Protection error</td><td>Used a resource in a forbidden way (writing a read-only file).</td></tr>${/* row: protection error */''}
        <tr><td>Arithmetic error</td><td>Division by zero, overflow.</td></tr>${/* row: arithmetic error */''}
        <tr><td>Time overrun</td><td><i>Waited</i> for an event longer than the set maximum.</td></tr>${/* row: time overrun, which is about waiting too long */''}
        <tr><td>I/O failure</td><td>An I/O operation failed (e.g. file not found).</td></tr>${/* row: I/O failure */''}
        <tr><td>Invalid instruction</td><td>Executed something that is not an instruction.</td></tr>${/* row: invalid instruction */''}
        <tr><td>Privileged instruction</td><td>Executed an instruction reserved for the OS.</td></tr>${/* row: privileged instruction */''}
        <tr><td>Data misuse</td><td>Wrong type of data, or data never initialised.</td></tr>${/* row: data misuse */''}
        <tr><td>Operator or OS intervention</td><td>Stopped by an operator or the OS (e.g. to break a deadlock).</td></tr>${/* row: operator or OS intervention */''}
        <tr><td>Parent termination</td><td>The parent ended, and the OS ends its children too.</td></tr>${/* row: parent termination */''}
        <tr><td>Parent request</td><td>The parent asked the OS to end this child.</td></tr>${/* row: parent request */''}
      </table>${/* end of the termination table */''}
      <h3>The five-state model</h3>${/* notes heading: the five-state model */''}
      <figure>${/* start of the figure holding a fixed drawing of the five-state model for the notes */''}
        <svg viewBox="0 0 480 330" width="100%" style="max-width:430px" role="img" aria-label="Five-state process model">${/* the drawing, the same layout as the "five" model in MODELS, labelled for screen readers */''}
          <defs><marker id="n32a" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#3d4760"/></marker></defs>${/* defines the arrowhead used by every arrow in this drawing */''}
          <g fill="none" stroke="#3d4760" stroke-width="1.8">${/* group of arrow lines: no fill, a dark grey stroke */''}
            <path d="M70,2 L70,32" marker-end="url(#n32a)"/><path d="M88,78 L118,142" marker-end="url(#n32a)"/>${/* arrows: create into New, and admit from New to Ready */''}
            <path d="M200,154 L280,154" marker-end="url(#n32a)"/><path d="M280,176 L200,176" marker-end="url(#n32a)"/>${/* arrows: dispatch from Ready to Running, and timeout back again */''}
            <path d="M365,142 L395,78" marker-end="url(#n32a)"/><path d="M318,188 L268,267" marker-end="url(#n32a)"/>${/* arrows: release from Running to Exit, and event wait from Running to Blocked */''}
            <path d="M212,267 L162,188" marker-end="url(#n32a)"/>${/* arrow: event occurs, from Blocked back to Ready */''}
            <path d="M150,142 C 175,72 240,55 350,55" stroke-dasharray="6 5" marker-end="url(#n32a)"/>${/* dashed curve: a Ready process terminated directly */''}
            <path d="M300,295 C 470,300 470,150 430,78" stroke-dasharray="6 5" marker-end="url(#n32a)"/>${/* dashed curve: a Blocked process terminated directly */''}
          </g>${/* end of the arrow group */''}
          <g stroke-width="2">${/* group of state boxes, each with a medium outline */''}
            <rect x="10" y="32" width="120" height="46" rx="12" fill="#f5f7fb" stroke="#8a94ae"/>${/* box for New, in plain grey */''}
            <rect x="350" y="32" width="120" height="46" rx="12" fill="#f5f7fb" stroke="#8a94ae"/>${/* box for Exit, in plain grey */''}
            <rect x="80" y="142" width="120" height="46" rx="12" fill="#d6f3f9" stroke="#0891b2"/>${/* box for Ready, in the process teal */''}
            <rect x="280" y="142" width="120" height="46" rx="12" fill="#e1eaff" stroke="#2563eb"/>${/* box for Running, in the CPU blue */''}
            <rect x="180" y="267" width="120" height="46" rx="12" fill="#fff0d1" stroke="#b45309"/>${/* box for Blocked, in the caution colour */''}
          </g>${/* end of the box group */''}
          <g font-size="15" font-weight="700" text-anchor="middle" fill="#151c2c">${/* group of state names: bold, centred and dark */''}
            <text x="70" y="60">New</text><text x="410" y="60">Exit</text><text x="140" y="170">Ready</text><text x="340" y="170">Running</text><text x="240" y="295">Blocked</text>${/* the five state names, each placed in the middle of its box */''}
          </g>${/* end of the name group */''}
          <g font-size="13" fill="#3d4760">${/* group of arrow labels: smaller and dark grey */''}
            <text x="80" y="17">create</text><text x="96" y="114" text-anchor="end">admit</text><text x="240" y="145" text-anchor="middle">dispatch</text>${/* labels: create, admit and dispatch */''}
            <text x="240" y="195" text-anchor="middle">timeout</text><text x="388" y="116">release</text><text x="300" y="236">event wait</text>${/* labels: timeout, release and event wait */''}
            <text x="180" y="236" text-anchor="end">event occurs</text><text x="262" y="44" text-anchor="middle">terminated</text><text x="452" y="306" text-anchor="end">terminated</text>${/* labels: event occurs and the two terminated labels */''}
          </g>${/* end of the label group */''}
        </svg>${/* end of the drawing */''}
      </figure>${/* end of the figure */''}
      <ul>${/* start of the list describing each of the five states */''}
        <li><b>New</b>: PCB built but not yet admitted, and usually not yet in main memory (lets the OS cap how many processes compete).</li>${/* state: New, and why admitting later lets the OS cap how many processes compete */''}
        <li><b>Ready</b>: could run now; waiting only for the processor.</li>${/* state: Ready */''}
        <li><b>Running</b>: executing; at most one per processor.</li>${/* state: Running */''}
        <li><b>Blocked</b> (Waiting): cannot run until an event occurs.</li>${/* state: Blocked, also called Waiting */''}
        <li><b>Exit</b>: finished or aborted; records may be kept briefly, then deleted.</li>${/* state: Exit */''}
      </ul>${/* end of the state list */''}
      <table>${/* start of the table of five-state transitions and their triggers */''}
        <tr><th>Transition</th><th>Typical trigger</th></tr>${/* table header: transition and typical trigger */''}
        <tr><td>Null → New</td><td>A process is created.</td></tr>${/* row: Null to New, a process is created */''}
        <tr><td>New → Ready (admit)</td><td>The OS is prepared to take on another process.</td></tr>${/* row: admit */''}
        <tr><td>Ready → Running (dispatch)</td><td>The dispatcher chooses it.</td></tr>${/* row: dispatch */''}
        <tr><td>Running → Exit (release)</td><td>It finishes or is aborted.</td></tr>${/* row: release */''}
        <tr><td>Running → Ready</td><td><b>Timeout</b>, or <b>preemption</b> by a more important process.</td></tr>${/* row: timeout or preemption */''}
        <tr><td>Running → Blocked (event wait)</td><td>It requests I/O or another event.</td></tr>${/* row: event wait */''}
        <tr><td>Blocked → Ready (event occurs)</td><td>The awaited event happens.</td></tr>${/* row: event occurs */''}
        <tr><td>Ready / Blocked → Exit</td><td>Killed from outside, e.g. by its parent.</td></tr>${/* row: a Ready or Blocked process killed from outside */''}
      </table>${/* end of the transition table */''}
      <p><b>No Blocked → Running arrow:</b> a blocked process is still waiting, so the processor would be wasted on it; after its event it becomes Ready first. Only a Running process can time out, block or release.</p>${/* notes paragraph: why there is no Blocked to Running arrow, and which moves only a Running process can make */''}

      <h3>Queues</h3>${/* notes heading: queues */''}
      <p>The dispatcher takes processes from the <b>ready queue</b>; waiting processes sit in <b>blocked queues</b>.</p>${/* notes paragraph: the ready queue and the blocked queues */''}
      <ul>${/* start of the list comparing queue designs */''}
        <li><b>One blocked queue</b>: on every event the OS scans all blocked processes to find the ones waiting for it.</li>${/* design: one blocked queue, scanned on every event */''}
        <li><b>One queue per event</b>: the whole matching queue moves to Ready at once. Example: 8 blocked, 4 waiting for the disk: a disk completion costs 8 checks with one queue, 4 moves with per-event queues.</li>${/* design: one queue per event, with the worked example of 8 checks versus 4 moves */''}
        <li><b>Priority ready queues</b>: one per priority level; the dispatcher serves the highest non-empty level. With preemption, a newly ready higher-priority process takes the processor. Low-priority work may wait a long time.</li>${/* design: priority ready queues, preemption, and the risk that low-priority work waits */''}
      </ul>${/* end of the queue list */''}

      <h3>Swapping and the single Suspend state</h3>${/* notes heading: swapping and the single Suspend state */''}
      <p>I/O is far slower than the processor, so every process in memory may be Blocked at once: the processor idles and there is no room to admit more. More memory helps only briefly, since programs grow to fill it. <b>Swapping</b> moves all or part of a process from main memory to disk so the space can hold a process that can run. Swapping is itself I/O, but the disk is usually the fastest I/O device, so it normally pays off.</p>${/* notes paragraph: why every process can end up Blocked, and how swapping helps */''}
      <p><b>First attempt: one Suspend state.</b> Add Suspend to the five-state model with two arrows: Blocked → Suspend (suspend) when memory is needed, and Suspend → Ready (activate) to bring a process back. <b>The flaw:</b> every suspended process was Blocked when it left, and its event may or may not have happened since. One state cannot record which, so the OS may spend a disk transfer bringing back a process that still cannot run.</p>${/* notes paragraph: the one-Suspend-state design and its flaw */''}
      <h3>The seven-state model</h3>${/* notes heading: the seven-state model */''}
      <p>Track two independent facts, <b>waiting or not</b> and <b>in memory or on disk</b>: Ready, Blocked, <b>Ready/Suspend</b> (on disk, not waiting) and <b>Blocked/Suspend</b> (on disk, still waiting). With New, Running and Exit, that makes seven states.</p>${/* notes paragraph: two independent facts give four states, seven with New, Running and Exit */''}
      <table>${/* start of the table of the new seven-state transitions */''}
        <tr><th>New transition</th><th>When it happens</th></tr>${/* table header: new transition and when it happens */''}
        <tr><td>Blocked → Blocked/Suspend</td><td>Usual choice when memory is needed: a blocked process cannot use its memory anyway.</td></tr>${/* row: Blocked to Blocked/Suspend, the usual choice */''}
        <tr><td>Blocked/Suspend → Ready/Suspend</td><td>The event occurs while on disk (not Ready yet).</td></tr>${/* row: Blocked/Suspend to Ready/Suspend, the event arrives while on disk */''}
        <tr><td>Ready/Suspend → Ready (activate)</td><td>No Ready process in memory, or it has higher priority.</td></tr>${/* row: activate from Ready/Suspend */''}
        <tr><td>Ready → Ready/Suspend</td><td>Only way to free enough memory, or it is low priority.</td></tr>${/* row: Ready to Ready/Suspend, the rarer suspension */''}
        <tr><td>New → Ready/Suspend or Ready</td><td>Admit to disk when memory is tight, into memory when there is room.</td></tr>${/* row: admitting to disk or into memory */''}
        <tr><td>Blocked/Suspend → Blocked (activate)</td><td>Unusual: it is important and its event is due soon.</td></tr>${/* row: activating a still-blocked process, which is unusual */''}
        <tr><td>Running → Ready/Suspend</td><td>Preempted and swapped out for a more important process.</td></tr>${/* row: Running straight to Ready/Suspend */''}
        <tr><td>Any state → Exit</td><td>Killed, e.g. by its parent or the OS.</td></tr>${/* row: any state to Exit */''}
      </table>${/* end of the seven-state table */''}
      <p>Only processes in main memory can be dispatched. The OS prefers to swap out Blocked processes and to swap in Ready/Suspend ones.</p>${/* notes paragraph: only in-memory processes can run, and the OS's swap-out and swap-in preferences */''}
      <h4>Characteristics of a suspended process</h4>${/* notes subheading: characteristics of a suspended process */''}
      <ol>${/* start of the numbered list of characteristics */''}
        <li>It is not immediately available for execution.</li>${/* characteristic 1: not immediately available to run */''}
        <li>It may or may not be waiting for an event; if it is, the event occurring does not by itself let it run.</li>${/* characteristic 2: may or may not be waiting for an event */''}
        <li>An agent put it there to stop it running: itself, its parent, or the OS.</li>${/* characteristic 3: an agent put it there */''}
        <li>It stays suspended until that agent orders its removal.</li>${/* characteristic 4: only that agent releases it */''}
      </ol>${/* end of the characteristics list */''}
      <h4>Reasons for suspending a process</h4>${/* notes subheading: reasons for suspending a process */''}
      <ul>${/* start of the list of suspension reasons */''}
        <li><b>Swapping</b>: free memory for a process that is ready to run.</li>${/* reason: swapping */''}
        <li><b>Other OS reason</b>: a background process, or one suspected of causing a problem.</li>${/* reason: other OS reasons */''}
        <li><b>Interactive user request</b>: e.g. pausing a program to debug it.</li>${/* reason: an interactive user request */''}
        <li><b>Timing</b>: a periodic process waits for its next interval.</li>${/* reason: timing */''}
        <li><b>Parent process request</b>: to examine, modify or coordinate a child.</li>${/* reason: a parent's request */''}
      </ul>`,  // end of the reasons list and of the notes text
  });  // closes the section object passed to Guide.section
})();  // ends the wrapper function and runs it immediately
