// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 3.4 — Process Control
   The two processor modes and what the kernel does in kernel mode,
   the five steps of process creation, the three ways the OS regains
   control (interrupt, trap, supervisor call), and the difference
   between a cheap mode switch and a full seven-step process switch.
   Helpers live in the IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in an arrow function that runs once, right away, so its names stay private to this file
  /* ------------------------------------------------------------------
     Shared helpers
     ------------------------------------------------------------------ */
  /* Write a titled message into a feedback box (kinds: ok, bad, info, warn). */
  const say = (box, kind, title, html) => {  // say(box, kind, title, html): writes a message into a feedback box; kind picks its colour (ok, bad, info or warn)
    box.className = 'msg ' + (kind || '');  // sets the box's classes to msg plus the kind, so the section's CSS gives it the matching colour
    box.innerHTML = (title ? `<b>${title}</b>` : '') + (html || '');  // puts the bold title (if there is one) in front of the message text
  };  // ends say()

  /* ------------------------------------------------------------------
     The process-switch scene shared by steps 7 and 8: a CPU register
     panel, the memory map in use, and four lanes (Running, Ready,
     Blocked on disk I/O, Ready/Suspend) whose PCBs glide between lanes.
     scene.set(state) redraws everything from one plain state object:
       lanes: { run:[ids], ready:[ids], blocked:[ids], rs:[ids] }
       pcb:   { P1:{st, ctx, sel}, P2:{...} }   (P3–P5 never change)
       cpu:   { pc, sp, regs: 'P1'|'P2'|'OS', mode: 'user'|'kernel' }
       mem:   'P1'|'P2'    arrow: null|'save'|'restore'    hl: [keys]
     ------------------------------------------------------------------ */
  /* Two geometries: wide (CPU on the left, four stacked lanes on the right) and
     narrow for phones (CPU beside a tall Running lane, then full-width queue lanes). */
  const GEO = {  // GEO: two sets of positions and sizes for the process-switch drawing
    wide: {  // wide: the set used on a normal wide screen
      vb: [680, 300], valX: 62, valW: 136, cpu: [6, 6, 202, 188],  // drawing size 680 x 300, where the register value boxes sit (x and width), and the CPU panel box
      mem: { box: [6, 204, 202, 90], title: [18, 226], val: [18, 236, 178], sub: [18, 284] },  // the memory-map box, its title, its value box and the grey subtitle under it
      lanes: { run: [222, 6, 452, 66, 464, 'Running', 'the process on the CPU'], ready: [222, 80, 452, 66, 234, 'Ready', 'queue'],  // lanes: each is [x, y, width, height, label x, label line 1, label line 2]; here the Running and Ready lanes
        blocked: [222, 154, 452, 66, 234, 'Blocked on', 'disk I/O'], rs: [222, 228, 452, 66, 234, 'Ready/', 'Suspend'] },  // the Blocked on disk I/O lane and the Ready/Suspend lane
      slot: (ln, i) => [[344, 452, 560][i], { run: 6, ready: 80, blocked: 154, rs: 228 }[ln] + 5],  // slot(ln, i): where the i-th PCB in lane ln goes: one of three x positions, and 5 units below the lane's top
      save: ['M210,32 L336,32', 272, 24], restore: ['M340,50 L214,50', 276, 67],  // the save and restore arrows: each is [path, label x, label y]
    },  // ends the wide set
    /* narrow: 340 units wide so that 13-unit text still renders near 12 px on a phone;
       queue lanes carry a one-line label above a full-width row of PCB slots */
    narrow: {  // the set for phone-width screens: a tall drawing with the CPU beside the Running lane
      vb: [340, 542], valX: 58, valW: 136, cpu: [6, 6, 200, 188], oneLine: true,  // drawing size 340 x 542, register box position, CPU panel; oneLine says queue labels fit on one line
      mem: { box: [6, 202, 328, 52], title: [18, 233], val: [168, 214, 158], sub: null },  // the memory-map box spans the whole width and has no subtitle
      lanes: { run: [212, 6, 122, 188, 222, 'Running', 'on the CPU'], ready: [6, 262, 328, 86, 16, 'Ready', 'queue'],  // the Running lane is a tall box beside the CPU; the Ready lane spans the full width below
        blocked: [6, 356, 328, 86, 16, 'Blocked', 'on disk I/O'], rs: [6, 450, 328, 86, 16, 'Ready/Suspend', 'queue'] },  // the Blocked and Ready/Suspend lanes, also full width
      slot: (ln, i) => (ln === 'run' ? [221, 72] : [[12, 120, 228][i], { ready: 262, blocked: 356, rs: 450 }[ln] + 26]),  // slot: the Running lane has one spot; each queue lane has three spots in a row under its label
      save: ['M208,170 L248,134', 284, 162], restore: ['M248,134 L210,170', 288, 162],  // the save and restore arrows become short diagonals between the CPU and the Running lane
    },  // ends the phone set
  };  // closes GEO
  const REG_TXT = {  // REG_TXT: the text in each register row, depending on who the registers belong to (P1, P2 or the OS)
    pc: { P1: 'P1: 0x1A40', P2: 'P2: 0x0C18', OS: 'OS handler' },  // program counter: P1's or P2's next instruction address, or the OS handler's code
    sp: { P1: 'P1’s stack', P2: 'P2’s stack', OS: 'kernel stack' },  // stack pointer: whose stack is in use
    regs: { P1: 'P1’s values', P2: 'P2’s values', OS: 'OS scratch' },  // other registers: whose values they hold
  };  // closes REG_TXT
  const OTHERS = { P3: 'Blocked', P4: 'Ready/Suspend', P5: 'Ready' };  // OTHERS: the states of P3, P4 and P5, which never change in this scene
  function switchScene(ctx) {  // switchScene(ctx): builds the process-switch drawing and returns it with set(), which redraws it from a state
    const { s } = ctx;  // takes s out of ctx: s works like h but builds SVG (drawing) elements
    const G = ctx.narrow ? GEO.narrow : GEO.wide;  // G: the phone or wide positions, chosen by the screen size
    const svg = s('svg', { viewBox: `0 0 ${G.vb[0]} ${G.vb[1]}`, width: '100%', role: 'img', 'aria-label': 'CPU registers, the memory map, and the process queues during a process switch' });  // svg: the drawing itself; aria-label describes it for screen readers
    for (const [key, [x, y, w, hgt, lx, l1, l2]] of Object.entries(G.lanes)) {  // goes over each lane with its key and positions
      const run = key === 'run';  // run: whether this is the Running lane
      svg.append(s('rect', { x, y, width: w, height: hgt, rx: 12, class: run ? 's-cpu' : 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': run ? '6 4' : null }));  // the lane box: dashed and processor-coloured for Running, a plain panel for the queues
      if (G.oneLine && !run) svg.append(s('text', { x: lx, y: y + 19, 'font-size': 14, 'font-weight': 800 }, l1, s('tspan', { 'font-size': 13, 'font-weight': 400, class: 's-sub' }, ' ' + l2)));  // phone queue lanes: a one-line label, a bold name followed by a grey description
      else svg.append(s('text', { x: lx, y: y + 30, 'font-size': 14, 'font-weight': 800, style: run ? 'fill:var(--cpu)' : null }, l1),  // otherwise a two-line label; the Running lane's name is in the processor colour
        s('text', { x: lx, y: y + 48, 'font-size': 13, class: 's-sub' }, l2));  // the second label line, in grey
    }  // ends the loop over lanes
    /* CPU register panel */
    const [cx, cy, cw, ch] = G.cpu;  // cx, cy, cw, ch: the CPU panel's position and size
    const cpuBox = s('rect', { x: cx, y: cy, width: cw, height: ch, rx: 12, class: 's-cpu', 'stroke-width': 2 });  // cpuBox: the CPU panel box, kept so set() can outline it when it changes
    svg.append(cpuBox, s('text', { x: cx + 12, y: cy + 22, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'CPU registers'));  // adds the panel and its "CPU registers" title
    const rows = {};  // rows: the four register rows, kept so set() can update them
    [['pc', 'PC', 40], ['sp', 'SP', 76], ['regs', 'Regs', 112], ['mode', 'PSW', 148]].forEach(([k, lab, y]) => {  // makes each register row, [key, label, y]: PC, SP, Regs and PSW
      const r = s('rect', { x: G.valX, y, width: G.valW, height: 28, rx: 7, 'stroke-width': 1.5 });  // r: the row's value box
      const t = s('text', { x: G.valX + G.valW / 2, y: y + 19, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 });  // t: the value text, centred in the box
      svg.append(s('text', { x: 18, y: y + 19, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, lab), r, t);  // adds the grey label on the left, then the box and its text
      rows[k] = { r, t };  // remembers the box and text under the row's key
    });  // ends the loop over register rows
    /* memory map */
    const M = G.mem;  // M: the memory-map positions
    const memR = s('rect', { x: M.val[0], y: M.val[1], width: M.val[2], height: 28, rx: 7, class: 's-mem', 'stroke-width': 1.5 });  // memR: the value box that names the page table in use
    const memT = s('text', { x: M.val[0] + M.val[2] / 2, y: M.val[1] + 19, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 });  // memT: the text inside that box
    svg.append(s('rect', { x: M.box[0], y: M.box[1], width: M.box[2], height: M.box[3], rx: 12, class: 's-panel', 'stroke-width': 1.5 }),  // adds the memory-map panel
      s('text', { x: M.title[0], y: M.title[1], 'font-size': 14, 'font-weight': 800, style: 'fill:var(--mem)' }, 'Memory map in use'), memR, memT,  // its "Memory map in use" title, then the value box and text
      M.sub ? s('text', { x: M.sub[0], y: M.sub[1], 'font-size': 13, class: 's-sub' }, 'what memory is reachable') : null);  // the grey subtitle, only when this layout has room for it
    const arrows = s('g');  // arrows: a group that holds the save and restore arrows; set() empties and refills it
    svg.append(arrows);  // adds the arrow group to the drawing
    /* PCB boxes */
    const pcbs = {};  // pcbs: the five PCB boxes, looked up by process name
    ['P3', 'P4', 'P5', 'P1', 'P2'].forEach((id) => {  // builds one PCB group per process; P1 and P2 come last so they are drawn on top when they glide past others
      const r = s('rect', { x: 0, y: 0, width: 104, height: 56, rx: 10, 'stroke-width': 2 });  // r: the box, drawn at 0,0; the group's transform later moves it into its lane slot
      const a = s('text', { x: 52, y: 20, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'PCB ' + id);  // a: the title "PCB Pn"
      const b = s('text', { x: 52, y: 37, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 });  // b: the state line
      const c = s('text', { x: 52, y: 52, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' });  // c: the context line, in grey
      const g = s('g', { class: 'pcbg' }, r, a, b, c);  // g: the group holding all four; class pcbg makes every move glide (a CSS transition)
      svg.append(g);  // adds the group to the drawing
      pcbs[id] = { g, r, b, c, star: id === 'P1' || id === 'P2' };  // remembers the parts; star marks P1 and P2, the two processes the switch is about
    });  // ends the loop over PCBs
    let first = true;  // first: true until the first set(), so the first placement jumps into place instead of gliding
    const set = (st) => {  // set(st): redraws everything from one state object; steps 7 and 8 call it for every frame
      const hl = new Set(st.hl || []);  // hl: the set of keys to outline as "changed in this step"
      ['pc', 'sp', 'regs'].forEach((k) => { const o = st.cpu[k]; rows[k].r.setAttribute('class', o === 'OS' ? 's-os' : 's-proc'); rows[k].t.textContent = REG_TXT[k][o]; });  // PC, SP and Regs rows: the value box takes the owner's colour (OS or process) and the matching REG_TXT text
      rows.mode.r.setAttribute('class', st.cpu.mode === 'kernel' ? 's-os' : 's-proc');  // PSW row: OS colour in kernel mode, process colour in user mode
      rows.mode.t.textContent = st.cpu.mode + ' mode';  // PSW text: "user mode" or "kernel mode"
      cpuBox.setAttribute('class', 's-cpu' + (hl.has('cpu') ? ' chg' : '') + (st.cpuBad ? ' lost' : ''));  // CPU panel: outlined when changed (chg) and red when its context is lost (cpuBad, used by step 8's warning)
      memR.setAttribute('class', 's-mem' + (hl.has('mem') ? ' chg' : ''));  // memory value box: outlined when it changed in this step
      memT.textContent = st.mem + '’s page table';  // memory text: whose page table is in use
      for (const [ln, ids] of Object.entries(st.lanes)) ids.forEach((id, i) => {  // goes over every lane and every PCB listed in it
        const g = pcbs[id].g, [x, y] = G.slot(ln, i);  // g: that PCB's group; x, y: its slot in this lane
        if (first) g.style.transition = 'none';  // on the very first draw, the glide is switched off so the PCBs start in place
        g.style.transform = `translate(${x}px, ${y}px)`;  // moves the group to its slot; the CSS transition on pcbg makes the move glide
      });  // ends the loop over lanes
      for (const [id, p] of Object.entries(pcbs)) {  // updates the text and colour of every PCB
        const info = (st.pcb && st.pcb[id]) || { st: OTHERS[id], ctx: 'saved' };  // info: the state given for this PCB, or for P3-P5 their fixed state with a saved context
        p.b.textContent = info.st;  // the state line
        p.c.textContent = info.ctx === 'cpu' ? 'context in CPU' : info.ctx === 'lost' ? 'context LOST' : 'context saved';  // the context line: in the CPU, LOST, or saved
        p.c.style.fill = info.ctx === 'lost' ? 'var(--bad)' : '';  // the context line turns red when the context is lost
        p.r.setAttribute('class', (p.star ? 's-proc' : 's-panel') + (info.sel ? ' sel' : '') + (hl.has(id) ? ' chg' : ''));  // box colour: process colours for P1 and P2, plain panel for the others; sel adds a dashed outline, chg an accent one
      }  // ends the loop over PCBs
      if (first) { svg.getBoundingClientRect(); Object.values(pcbs).forEach((p) => { p.g.style.transition = ''; }); first = false; }  // after the first draw: asking for the size makes the browser place everything now, then the glide is switched back on
      arrows.replaceChildren();  // removes the arrows from the last frame
      const arrow = (spec, label) => arrows.append(s('path', { d: spec[0], class: 's-line', 'stroke-width': 2.5, style: 'stroke:var(--proc)', 'marker-end': 'url(#arr-proc)' }),  // arrow(spec, label): draws a process-coloured arrow with an arrowhead along spec's path
        s('text', { x: spec[1], y: spec[2], 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--proc)' }, label));  // plus its bold label in the same colour
      if (st.arrow === 'save') arrow(G.save, 'save');  // draws the "save" arrow (registers into the PCB) when this frame asks for it
      if (st.arrow === 'restore') arrow(G.restore, 'restore');  // draws the "restore" arrow (PCB into the registers) when this frame asks for it
    };  // ends set()
    return { svg, set };  // hands back the drawing and its set() function
  }  // ends switchScene()
  /* legend row shown under the scene */
  const SCENE_LEGEND = (ctx) => ctx.h('div', { class: 'row small', style: { gap: '16px' } },  // SCENE_LEGEND(ctx): builds the colour key shown under the switch scene in steps 7 and 8
    ctx.h('span', { html: '<span class="legend-sq" style="background:var(--proc-bg);border-color:var(--proc)"></span>belongs to a process' }),  // key item: process colours mean it belongs to a process
    ctx.h('span', { html: '<span class="legend-sq" style="background:var(--os-bg);border-color:var(--os)"></span>belongs to the OS' }),  // key item: OS colours mean it belongs to the OS
    ctx.h('span', { html: '<span class="legend-sq" style="border-color:var(--accent);border-width:2.5px"></span>changed in this step' }));  // key item: an accent outline means it changed in this step; closes the row

  Guide.section({  // registers section 3.4 with the guide; the object below describes everything the section shows
    id: '3.4',  // id: the section number the guide uses in links, menus and saved progress
    title: 'Process Control',  // title: the full name shown at the top of the section
    short: 'Process control',  // short: the shorter name used in the contents list
    summary: 'How the OS stays in charge: two processor modes, creating a process, and switching between processes.',  // summary: one-sentence description shown in the contents
    objectives: [  // objectives: the learning goals shown when the section opens
      'Explain what user mode and kernel mode are, why the processor has both, and how the mode bit changes.',  // goal 1: user mode and kernel mode, and how the mode bit changes
      'Name the main jobs of an OS kernel in process, memory and I/O management plus its support functions.',  // goal 2: the kernel's main jobs
      'Walk through the five steps the OS takes to create a new process.',  // goal 3: the five steps of creating a process
      'Classify an event as an interrupt, a trap or a supervisor call, and predict whether it leads to a process switch.',  // goal 4: sorting events into interrupt, trap or supervisor call, and predicting a process switch
      'Tell a mode switch from a process switch, and put the seven steps of a process switch in order.',  // goal 5: mode switch versus process switch, and the seven steps in order
    ],  // closes the objectives list
    terms: [  // terms: glossary entries as [term, definition] pairs; they fill the glossary and the dotted-underline pop-ups
      ['User mode', 'The less-privileged processor mode in which ordinary programs run. Privileged instructions and protected memory, such as the OS’s own tables, are off limits.'],  // glossary entry: defines user mode
      ['Kernel mode', 'The more-privileged processor mode in which the OS kernel runs: every instruction may be executed and every part of memory reached. Also called system mode or control mode.'],  // glossary entry: defines kernel mode and its other names
      ['Privileged instruction', 'An instruction the hardware accepts only in kernel mode, such as disabling interrupts, setting the timer, starting I/O on a device or halting the processor. Tried in user mode, it causes a trap.'],  // glossary entry: defines a privileged instruction, with examples
      ['Kernel', 'The core of the operating system. It stays in main memory, runs in kernel mode and does the essential work: managing processes, memory and I/O, and handling interrupts.'],  // glossary entry: defines the kernel
      ['Program status word (PSW)', 'A processor register describing the running program’s status: condition codes, whether interrupts are enabled, and the mode bit that says user or kernel mode.'],  // glossary entry: defines the program status word, including the mode bit
      ['Mode bit', 'A bit in the program status word recording whether the processor is in user mode or kernel mode. The hardware consults it before every privileged instruction.'],  // glossary entry: defines the mode bit
      ['System call (supervisor call)', 'A deliberate request from a running program for an OS service, such as opening a file. A special instruction switches the processor to kernel mode and enters the OS at a fixed, pre-arranged address.'],  // glossary entry: defines a system call (supervisor call)
      ['Interrupt', 'A signal caused by something outside the instruction being executed (the clock, an I/O device, the memory system) that makes the processor pause the running program and run an OS handler.'],  // glossary entry: defines an interrupt
      ['Trap', 'An entry into the OS caused by an error or exception in the instruction just executed, such as dividing by zero or trying a privileged instruction in user mode.'],  // glossary entry: defines a trap
      ['Interrupt handler', 'The OS routine that runs when an interrupt or trap is accepted. It works out what happened and deals with it, then returns or asks for a process switch.'],  // glossary entry: defines an interrupt handler
      ['Clock interrupt', 'An interrupt from the system timer, fired at regular intervals. It lets the OS check whether the running process has used up its time slice.'],  // glossary entry: defines a clock interrupt
      ['Time slice', 'A short, fixed amount of processor time a process may use before the OS switches the processor to another process. Also called a quantum.'],  // glossary entry: defines a time slice (quantum)
      ['Memory fault', 'An interrupt raised when the running program refers to a valid address whose contents are not in main memory right now. The OS must fetch that part from disk first. In a paging system it is called a page fault.'],  // glossary entry: defines a memory fault (a page fault under paging)
      ['Mode switch', 'A change of the processor between user mode and kernel mode, for example on an interrupt and again on return. The same process stays Running, so it is cheap.'],  // glossary entry: defines a mode switch and why it is cheap
      ['Process switch', 'Taking the processor away from the running process and giving it to another: save one context, update PCBs and queues, change the memory map, restore the other context. Also called a context switch.'],  // glossary entry: defines a process switch (context switch)
      ['Context (processor state)', 'Everything the processor needs to resume a program exactly where it stopped: the program counter, the PSW, the stack pointer and the other registers.'],  // glossary entry: defines a context (the processor state)
      ['Process identifier (PID)', 'A number the OS assigns to a process that no other current process has. Every table and queue refers to the process by it.'],  // glossary entry: defines a process identifier (PID)
      ['Process control block (PCB)', 'The OS’s record for one process: identification, the saved processor state, and control information such as state, priority, queue links and resources owned.'],  // glossary entry: defines the process control block (PCB)
      ['Process image', 'All the pieces that make up one process: its program code, its data, its stacks and its PCB.'],  // glossary entry: defines a process image
      ['Process table', 'The OS’s master list of processes, one entry per process, each leading to that process’s image and PCB.'],  // glossary entry: defines the process table
    ],  // closes the terms list

    /* Scoped CSS: every selector starts with .sec-3-4 */
    css: ` /* css: style rules for this section only; every selector starts with .sec-3-4 so it cannot affect other sections */
      /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width */
      .sec-3-4 .step-eyebrow { contain: inline-size; } /* on phones, keeps the one-line label above the step title from forcing the page wider than the screen */
      .sec-3-4 .msg { border-radius: 10px; padding: 9px 12px; background: var(--panel-2); border: 1px solid var(--line); font-size: 15px; line-height: 1.45; } /* msg: a feedback box, rounded and padded with a pale background and easy-to-read 15px text */
      .sec-3-4 .msg > b:first-child { display: block; margin-bottom: 2px; } /* a message's bold title sits on its own line above the text */
      .sec-3-4 .msg.ok { border-color: var(--ok); background: var(--ok-bg); } /* an ok message is green */
      .sec-3-4 .msg.bad { border-color: var(--bad); background: var(--bad-bg); } /* a bad message is red */
      .sec-3-4 .msg.info { border-color: var(--accent); background: var(--accent-bg); } /* an info message uses the accent colour */
      .sec-3-4 .msg.warn { border-color: var(--warn); background: var(--warn-bg); } /* a warn message is amber */
      .sec-3-4 svg .hot { cursor: pointer; } /* clickable parts of a drawing (class hot) show a hand pointer */
      .sec-3-4 svg .hot .fr { transition: stroke-width .15s; } /* the outline (class fr) of a clickable part changes thickness smoothly */
      .sec-3-4 svg .hot:hover .fr { stroke-width: 3.5; } /* hovering a clickable part thickens its outline */
      .sec-3-4 svg .hot.on .fr { stroke: var(--accent); stroke-width: 3.5; } /* the part the student picked (class on) gets a thick accent outline */
      .sec-3-4 svg .hot:focus { outline: none; } /* hides the browser's default focus ring on drawing parts */
      .sec-3-4 svg .hot:focus-visible .fr { stroke: var(--accent); stroke-width: 4; } /* keyboard focus shows an even thicker accent outline instead, so keyboard users can see where they are */
      .sec-3-4 svg .tag { transition: transform .5s ease; } /* the "on CPU" tab (class tag) glides for half a second when it moves to another process */
      .sec-3-4 svg .kb rect { transition: fill .2s, stroke .2s; } /* kernel parts (class kb) change colour smoothly when they light up */
      .sec-3-4 svg .kb.on rect { fill: var(--accent-bg); stroke: var(--accent); stroke-width: 3; } /* a lit kernel part: accent fill and a thick accent outline */
      .sec-3-4 .psw { display: inline-flex; align-items: stretch; border: 2px solid var(--cpu); border-radius: 10px; overflow: hidden; font-size: 13.5px; line-height: 1.3; } /* psw: step 2's program status word display, a row of cells inside a rounded processor-coloured frame */
      .sec-3-4 .psw > span { display: flex; align-items: center; padding: 5px 10px; border-left: 1px solid color-mix(in srgb, var(--cpu) 35%, transparent); background: var(--cpu-bg); white-space: nowrap; } /* each cell of the PSW: centred text, padding, a thin divider on its left, processor tint, no line breaks */
      .sec-3-4 .psw > span:first-child { border-left: 0; font-weight: 800; color: var(--cpu); } /* the first cell (the word PSW): no divider, bold, processor colour */
      .sec-3-4 .psw .mbit { font-weight: 800; transition: background .2s, color .2s; } /* mbit: the mode-bit cell, bold, with colours that fade when it flips */
      .sec-3-4 .psw .mbit.u { background: var(--proc-bg); color: var(--proc); } /* mode bit in user mode: process colours */
      .sec-3-4 .psw .mbit.k { background: var(--os-bg); color: var(--os); } /* mode bit in kernel mode: OS colours */
      .sec-3-4 .ins { justify-content: flex-start; width: 100%; height: 44px; font-size: 14px; font-weight: 600; gap: 8px; overflow: hidden; } /* ins: the instruction buttons, left-aligned, full width, 44px tall, extra text hidden */
      .sec-3-4 .ins code { font-size: 13px; font-weight: 800; flex: none; } /* the instruction's code: bold and never squeezed */
      .sec-3-4 .ins span { overflow: hidden; text-overflow: ellipsis; } /* the instruction's description is cut short with "..." if it does not fit */
      .sec-3-4 .flow { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr); gap: 4px; align-items: stretch; } /* flow: the four stage boxes with arrow columns between them, seven grid columns in all */
      .sec-3-4 .flow .ar { align-self: center; color: var(--muted); font-weight: 800; } /* the arrows between stages: vertically centred, grey and bold */
      .sec-3-4 .fbox { border: 2px solid var(--line); border-radius: 10px; padding: 5px 8px; background: var(--panel-2); font-size: 13.5px; line-height: 1.3; opacity: .4; transition: opacity .2s, background .2s, border-color .2s; min-height: 62px; } /* fbox: a stage box, faded to 40% until its stage is reached, with smooth colour changes and a fixed minimum height */
      .sec-3-4 .fbox .lbl { display: block; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); } /* a stage box's label (such as "1 · Decode"): small, bold, uppercase and grey, on its own line */
      .sec-3-4 .fbox.lit { opacity: 1; } /* a stage that has been reached (class lit) is fully visible */
      .sec-3-4 .fbox.ok { border-color: var(--ok); background: var(--ok-bg); } /* a stage that went fine turns green */
      .sec-3-4 .fbox.bad { border-color: var(--bad); background: var(--bad-bg); } /* a stage that failed (the refusal) turns red */
      .sec-3-4 .fbox.os { border-color: var(--os); background: var(--os-bg); } /* a stage where the kernel acts takes the OS colours */
      .sec-3-4 .bin { border: 2px solid var(--line); border-radius: 12px; padding: 9px 12px; background: var(--panel); cursor: pointer; display: flex; flex-direction: column; gap: 3px; min-height: 0; transition: border-color .15s, background .15s; } /* bin: a family box in step 3's sorting game; clickable, contents stacked, colours change smoothly */
      .sec-3-4 .bin:hover { border-color: var(--accent); } /* hovering a family box gives it an accent border */
      .sec-3-4 .bin.flash-bad { border-color: var(--bad); background: var(--bad-bg); } /* after a wrong click the box flashes red */
      .sec-3-4 .bin.flash-ok { border-color: var(--ok); background: var(--ok-bg); } /* when a job is filed the box flashes green */
      .sec-3-4 .bin .blurb { font-size: 13px; color: var(--muted); line-height: 1.3; } /* blurb: the grey line under each family name that says what the family covers */
      .sec-3-4 .bin li.late::marker { color: var(--warn); } /* a job filed for the student after two misses gets an amber bullet */
      .sec-3-4 .bin ul:empty::before { content: 'click here to file the current job'; display: block; margin-left: -18px; margin-top: 6px; font-size: 13px; font-style: italic; color: var(--muted); } /* an empty family list shows an italic hint: click here to file the current job */
      .sec-3-4 .bin li.fresh { animation: fadein .35s ease both; } /* a newly filed job (class fresh) fades in */
      .sec-3-4 .jobcard { font-size: 20px; font-weight: 750; line-height: 1.35; min-height: 84px; display: flex; align-items: center; } /* jobcard: the job waiting to be sorted, in large type, with a minimum height so the layout stays still */
      .sec-3-4 .stepbtn { justify-content: flex-start; width: 100%; height: auto; min-height: 38px; padding-top: 4px; padding-bottom: 4px; white-space: normal; text-align: left; line-height: 1.25; font-size: 15px; gap: 10px; } /* stepbtn: the step buttons in steps 4 and 8; left-aligned, full width, text may wrap after the number badge */
      .sec-3-4 .stepbtn .num { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; background: var(--panel-3); font-size: 13px; font-weight: 800; color: var(--ink-2); flex: none; } /* the small square number badge on a step button (it shows ? until the step is done) */
      .sec-3-4 .stepbtn.done { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); } /* a finished step button turns green */
      .sec-3-4 .stepbtn.done .num { background: var(--ok); color: var(--panel); } /* its number badge turns solid green with light text */
      .sec-3-4 .stepbtn.bad { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); } /* a wrongly picked step button flashes red */
      .sec-3-4 .pan { border: 1.5px dashed var(--line-2); border-radius: 10px; padding: 7px 10px; background: var(--panel-2); min-width: 0; min-height: 0; transition: border-color .25s, background .25s; } /* pan: a step 4 panel; dashed outline and pale background until its step has happened */
      .sec-3-4 .pan.live { border-style: solid; border-color: color-mix(in srgb, var(--proc) 55%, transparent); background: var(--panel); } /* a filled-in panel (class live): solid process-tinted border and a white background */
      .sec-3-4 .ptitle { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-bottom: 5px; } /* ptitle: a panel's title row, small, bold, uppercase and grey, starting with its step number */
      .sec-3-4 .sb { display: inline-grid; place-items: center; width: 19px; height: 19px; border-radius: 50%; background: var(--panel-3); color: var(--ink-2); font-size: 12px; letter-spacing: 0; } /* sb: the round step-number badge in a panel title */
      .sec-3-4 .pan.live .sb { background: var(--proc); color: var(--panel); } /* once the panel is live, its badge turns solid process colour */
      .sec-3-4 .mcol { display: flex; flex-direction: column; gap: 4px; height: 150px; } /* mcol: the main memory column in panel 2, blocks stacked top to bottom in a fixed 150px height */
      .sec-3-4 .mblk { display: flex; align-items: center; border-radius: 6px; padding: 0 8px; font-size: 13px; font-weight: 700; border: 1.5px solid var(--line-2); min-height: 0; } /* mblk: one memory block, a rounded bordered strip with a bold label */
      .sec-3-4 .mblk.os { background: var(--os-bg); border-color: var(--os); color: var(--os); } /* the OS kernel's memory block, in OS colours */
      .sec-3-4 .mblk.pr { background: var(--proc-bg); border-color: var(--proc); } /* a process's memory block, in process colours */
      .sec-3-4 .mblk.free { border-style: dashed; color: var(--muted); font-weight: 600; } /* free space: a dashed grey block */
      .sec-3-4 .mblk.new { gap: 4px; padding: 3px 4px; border-width: 2.5px; } /* the new process's image: thicker border, with its parts shown inside */
      .sec-3-4 .mblk.new span { flex: 1; display: grid; place-items: center; height: 100%; background: var(--panel); border-radius: 4px; font-size: 13px; } /* the parts of the new image (code+data, stack, PCB) share the width as small white cells */
      .sec-3-4 .pcol .lbl { font-size: 12px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--proc); margin-bottom: 2px; } /* column headings in the PCB panel (Identification and so on): small uppercase in the process colour */
      .sec-3-4 .kv { display: flex; gap: 6px; font-size: 13.5px; line-height: 1.4; min-width: 0; } /* kv: one "name value" line in the PCB panel */
      .sec-3-4 .kv .k { color: var(--muted); flex: none; } /* the field name, in grey, never squeezed */
      .sec-3-4 .kv .v { font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } /* the field value, bold, kept on one line and cut with "..." if too long */
      .sec-3-4 .kv .v.muted { font-weight: 500; } /* a value that is not filled in yet (a dash) is not bold */
      .sec-3-4 .ans { height: 34px; padding: 0 12px; font-size: 14.5px; } /* ans: the answer buttons in step 5, 34px tall */
      .sec-3-4 .ans.right { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); } /* a right answer turns green */
      .sec-3-4 .ans.wrong { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); } /* a wrong answer turns red */
      .sec-3-4 .ans.late { border-color: var(--warn); background: var(--warn-bg); color: var(--warn); } /* an answer found only after a miss (or shown after two) turns amber */
      .sec-3-4 .evtext { font-size: 18px; font-weight: 650; line-height: 1.4; min-height: 76px; } /* evtext: the event to classify, in large type with a minimum height so the buttons below stay still */
      .sec-3-4 .qlab { font-size: 13px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; } /* qlab: the small uppercase label above each row of answer buttons */
      .sec-3-4 .dots { display: flex; gap: 5px; align-items: center; } /* dots: the row of progress marks, one per event */
      .sec-3-4 .dots span { width: 22px; height: 9px; border-radius: 5px; background: var(--panel-3); } /* each progress mark is a small grey pill */
      .sec-3-4 .dots span.ok { background: var(--ok); } /* green mark: both answers right the first time */
      .sec-3-4 .dots span.late { background: var(--warn); } /* amber mark: this event needed a second try */
      .sec-3-4 .dots span.cur { outline: 2px solid var(--accent); outline-offset: 1px; } /* the current event's mark gets an accent outline */
      .sec-3-4 .lane { display: flex; flex-direction: column; gap: 7px; min-height: 0; } /* lane: a step 6 lane card, its parts stacked top to bottom */
      .sec-3-4 .acts { display: grid; gap: 2px 10px; } /* acts: the grid of actions listed in a lane */
      .sec-3-4 .act { display: flex; align-items: center; gap: 6px; font-size: 13.5px; line-height: 1.3; padding: 2px 6px; border-radius: 6px; color: var(--muted); min-width: 0; } /* act: one action line (also used for step 7's list), grey until it is done */
      .sec-3-4 .act .ck { width: 14px; flex: none; font-weight: 800; color: var(--ok); } /* the tick column at the start of an action line */
      .sec-3-4 .act .c { margin-left: auto; font-family: var(--mono); font-size: 12.5px; color: var(--muted); flex: none; } /* the cost (such as +2) at the right end, in small grey fixed-width type */
      .sec-3-4 .act.done { color: var(--ink); } /* a finished action is shown in full-strength text */
      .sec-3-4 .act.cur { color: var(--ink); background: var(--accent-bg); font-weight: 700; } /* the action happening now gets an accent background and bold text */
      .sec-3-4 .legend-sq { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 1.5px solid; vertical-align: -1px; margin-right: 4px; } /* legend-sq: the small colour square used in the keys */
      .sec-3-4 svg .pcbg { transition: transform .6s ease; } /* PCB groups in the switch scene glide for 0.6 s when they move between lanes */
      .sec-3-4 svg .chg { stroke: var(--accent); stroke-width: 3.5; } /* chg: an accent outline on anything that changed in this step */
      .sec-3-4 svg .sel { stroke: var(--accent); stroke-width: 3.5; stroke-dasharray: 6 3; } /* sel: a dashed accent outline on the process the scheduler has just selected */
      .sec-3-4 svg .lost { fill: var(--bad-bg); stroke: var(--bad); stroke-width: 3.5; } /* lost: red fill and outline when a context has been lost */
      .sec-3-4 .act .n { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 6px; background: var(--panel-3); font-size: 12.5px; font-weight: 800; color: var(--ink-2); flex: none; } /* n: the numbered square at the start of each line in step 7's list */
      .sec-3-4 .act.cur .n { background: var(--accent); color: var(--panel); } /* the current line's number square turns solid accent */
      .sec-3-4 .tickgrid { display: grid; gap: 4px; } /* tickgrid: the grid of 100 clock-tick squares in step 6's second view */
      .sec-3-4 .tickgrid i { display: block; height: 36px; border-radius: 4px; background: var(--os-bg); border: 1.5px solid color-mix(in srgb, var(--os) 45%, transparent); transition: background .2s, border-color .2s; } /* each tick square: OS tint and border, meaning a mode switch only */
      .sec-3-4 .tickgrid i.ps { background: var(--warn-bg); border: 2px solid var(--warn); } /* a tick that ends a time slice (class ps) is amber, meaning a process switch */
    `,  // end of the section's CSS text

    steps: [  // steps: the list of screens in this section, shown one at a time with Next and Back
      /* ============ 1. Big picture: three ways the OS keeps control ============ */
      {  // opens step 1
        title: 'Staying in charge: how the OS controls processes',  // step 1 title
        kind: 'story',  // kind story: the big-picture step, which the core path always keeps
        render(el, ctx) {  // render(el, ctx): builds the clickable overview drawing when step 1 is shown
          const { h, s } = ctx;  // takes h (builds HTML elements) and s (builds SVG drawing elements) out of ctx
          /* wide: CPU on the left of the two bands; narrow (phones): CPU bar on top, bands stacked below */
          const G = ctx.narrow  // G: positions and sizes; the first set is for phone-width screens, with the CPU as a bar on top
            ? { vb: [380, 352], user: [6, 58, 368, 150], userLbl: [18, 196], kern: [6, 238, 368, 108], kernLbl: [18, 262], kb: [[14, 134, 254], 274, 112],  // phone: drawing size, user-mode band, kernel-mode band, their labels and the kernel parts' positions
              pw: 84, px: [13, 105, 197, 289], py: 100, gate: [6, 374, 222], pill: [120, 140], cpu: [6, 6, 368, 44], cpuT: [[40, 34], [140, 34], [250, 34], [322, 34]] }  // phone: process box width, x and y, the gate line and its pill, and the CPU bar with its text spots
            : { vb: [620, 300], user: [118, 8, 494, 124], userLbl: [130, 122], kern: [118, 168, 494, 124], kernLbl: [130, 190], kb: [[132, 292, 452], 202, 148],  // wide: a 620 x 300 drawing with the two bands stacked to the right of the CPU, and the kernel parts
              pw: 104, px: [132, 248, 364, 480], py: 40, gate: [118, 612, 150], pill: [296, 140], cpu: [8, 98, 96, 104], cpuT: [[56, 124], [56, 150], [56, 169], [56, 186]] };  // wide: process box width, x and y, the gate line and its pill, and the CPU box on the left
          const PW = G.pw, PY = G.py;  // PW and PY: the width and the top edge of every process box
          const PROCS = [{ id: 'P1', name: 'editor', x: G.px[0] }, { id: 'P2', name: 'browser', x: G.px[1] }, { id: 'P3', name: 'music', x: G.px[2] }];  // PROCS: the three user processes present from the start, with their x positions
          const svg = s('svg', { viewBox: `0 0 ${G.vb[0]} ${G.vb[1]}`, width: '100%', role: 'img', 'aria-label': 'User processes above the privilege boundary, the OS kernel below it, and the CPU' });  // svg: the drawing; aria-label describes it for screen readers
          /* the two bands: user mode above, kernel mode below */
          svg.append(  // adds the two bands to the drawing
            s('rect', { x: G.user[0], y: G.user[1], width: G.user[2], height: G.user[3], rx: 14, class: 's-panel', 'stroke-width': 1.5 }),  // the user-mode band, a plain panel
            s('text', { x: G.userLbl[0], y: G.userLbl[1], 'font-size': 13, 'font-weight': 800, class: 's-sub' }, ctx.narrow ? 'USER MODE · ordinary programs' : 'USER MODE · ordinary programs run here'),  // its label, shortened on phones
            s('rect', { x: G.kern[0], y: G.kern[1], width: G.kern[2], height: G.kern[3], rx: 14, class: 's-os', 'stroke-width': 1.5 }),  // the kernel-mode band, in OS colours
            s('text', { x: G.kernLbl[0], y: G.kernLbl[1], 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }, ctx.narrow ? 'KERNEL MODE · only the kernel' : 'KERNEL MODE · only the OS kernel runs here'));  // its label, shortened on phones; closes the list of band parts
          /* kernel parts that light up */
          const kb = {};  // kb: the kernel parts, kept by ID so pick() can light them up
          const [kbx, kby, kbw] = G.kb;  // unpacks the kernel parts' x positions, their shared y and their width
          [['table', kbx[0], 'Process table', 'and PCBs'], ['sched', kbx[1], 'Scheduler and', 'dispatcher'], ['intr', kbx[2], 'Interrupt', 'handlers']].forEach(([id, x, a, b]) => {  // makes the three kernel parts, each [id, x, label line 1, label line 2]
            kb[id] = s('g', { class: 'kb' },  // each part is a group with class kb, so the CSS can light it
              s('rect', { x, y: kby, width: kbw, height: 60, rx: 10, class: 's-panel', 'stroke-width': 1.5 }),  // the part's box
              s('text', { x: x + kbw / 2, y: kby + 26, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, a),  // the first label line
              s('text', { x: x + kbw / 2, y: kby + 45, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, b));  // the second label line; closes the group
            svg.append(kb[id]);  // adds the part to the drawing
          });  // ends the loop over kernel parts
          /* ordinary user processes */
          PROCS.forEach((p) => svg.append(s('g', {},  // adds one group per user process; its box and labels follow
            s('rect', { x: p.x, y: PY, width: PW, height: 56, rx: 10, class: 's-proc', 'stroke-width': 2 }),  // the process box
            s('text', { x: p.x + PW / 2, y: PY + 24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, p.id),  // the process ID in bold
            s('text', { x: p.x + PW / 2, y: PY + 44, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, p.name))));  // the program name in grey; closes the group and the loop
          /* hotspot: the privilege gate on the boundary */
          const [gx0, gx1, gy] = G.gate, [pillX, pillW] = G.pill;  // unpacks the gate line's two ends and height, and the pill's x and width
          const gate = s('g', { class: 'hot', 'data-id': 'modes', role: 'button', tabindex: 0, 'aria-label': 'The privilege gate' },  // gate: a clickable group (data-id "modes") that acts as a button and takes keyboard focus
            s('rect', { x: gx0, y: gy - 14, width: gx1 - gx0, height: 28, fill: 'transparent' }),  // an invisible strip along the line so it is easy to click
            s('line', { x1: gx0, y1: gy, x2: gx1, y2: gy, class: 's-line', 'stroke-dasharray': '7 5' }),  // the dashed line itself: the boundary between user mode and kernel mode
            s('rect', { x: pillX, y: gy - 12, width: pillW, height: 24, rx: 12, class: 'fr s-os', 'stroke-width': 2 }),  // the pill-shaped label box (class fr gets the hover and picked outlines)
            s('text', { x: pillX + pillW / 2, y: gy + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }, 'privilege gate'));  // the "privilege gate" text; closes the group
          /* hotspot: a new process waiting to be created */
          const p4x = G.px[3];  // p4x: the x position of the fourth slot, where the new process appears
          const p4r = s('rect', { x: p4x, y: PY, width: PW, height: 56, rx: 10, class: 'fr s-panel', 'stroke-width': 2, 'stroke-dasharray': '6 4' });  // p4r: the dashed placeholder box, kept so pick() can turn it into a real process
          const p4a = s('text', { x: p4x + PW / 2, y: PY + 24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, '+ new');  // p4a: the "+ new" text, which later becomes "P4"
          const p4b = s('text', { x: p4x + PW / 2, y: PY + 44, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'process');  // p4b: the "process" text, which later shows P4's state
          const create = s('g', { class: 'hot', 'data-id': 'create', role: 'button', tabindex: 0, 'aria-label': 'Create a new process' }, p4r, p4a, p4b);  // create: the clickable group (data-id "create") around the placeholder
          /* hotspot: the CPU (click to switch processes) */
          const T = G.cpuT;  // T: the positions of the four text lines inside the CPU box
          const cpuRun = s('text', { x: T[1][0], y: T[1][1], 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'runs P1');  // cpuRun: the "runs P1" text, updated on every switch
          const cpuMode = s('text', { x: T[3][0], y: T[3][1], 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'user');  // cpuMode: the mode-bit value, "user" in the process colour to start with
          const cpu = s('g', { class: 'hot', 'data-id': 'switch', role: 'button', tabindex: 0, 'aria-label': 'The CPU: switch to another process' },  // cpu: the clickable group (data-id "switch") for the CPU box
            s('rect', { x: G.cpu[0], y: G.cpu[1], width: G.cpu[2], height: G.cpu[3], rx: 12, class: 'fr s-cpu', 'stroke-width': 2 }),  // the CPU box (class fr gets the hover and picked outlines)
            s('text', { x: T[0][0], y: T[0][1], 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'CPU'),  // the "CPU" title
            cpuRun,  // the "runs ..." line
            s('text', { x: T[2][0], y: T[2][1], 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'mode bit:'),  // the grey "mode bit:" label
            cpuMode);  // the mode-bit value; closes the group
          /* the "on CPU" tab that sits on the running process */
          const tag = s('g', { class: 'tag' },  // tag: the "on CPU" tab; class tag makes it glide when it moves
            s('rect', { x: 0, y: PY - 12, width: 64, height: 22, rx: 6, class: 's-cpu', 'stroke-width': 1.5 }),  // the tab's box, drawn at x 0; placeTag() slides it over the running process
            s('text', { x: 32, y: PY + 4, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'on CPU'));  // the "on CPU" text; closes the tab group
          svg.append(gate, create, cpu, tag);  // adds the three clickable parts and the tab to the drawing

          const INFO = {  // INFO: for each clickable part, [title, explanation, football comparison]
            modes: ['Privilege: two modes', 'The processor runs ordinary programs in <span class="t">user mode</span>, where dangerous instructions and the OS’s own memory are off limits. Only the kernel runs in <span class="t">kernel mode</span>. Control crosses the line only through doors the OS set up in advance, each leading to an OS handler (lit up below).', 'Only the referee may stop the clock or change the rules. The players cannot, however much they would like to.'],  // the privilege gate: two modes, and doors set up in advance
            create: ['Birth: creating a process', 'Before a program can run it must become a process: the OS gives it an identifier, space for its image, a filled-in <span class="t">PCB</span> (the OS’s record of it) and a place in a queue. Five steps, always in that order. P4 now takes turns on the CPU too.', 'A new player is registered, given a shirt number and put on the bench before coming onto the pitch.'],  // the new process: an identifier, space, a PCB and a queue place, in five steps
            switch: ['Hand-off: switching processes', 'Whenever the OS gets the processor back (by an interrupt, a trap or a system call) it may hand it to another process: save one <span class="t">context</span> (the register values), restore another. The OS does this in kernel mode. Click the CPU again to switch again.', 'A substitution: the whistle stops play, one player walks off with a note of where they were, another comes on.'],  // the CPU: the OS takes the processor back and switches context
          };  // closes INFO
          const info = h('div', { class: 'msg info', style: { minHeight: '118px' } });  // info: the message box under the drawing, with a minimum height so it does not jump
          let running = 0, gen = 0;  // running: which entry of PROCS is on the CPU; gen: a counter that cancels an older delayed reset
          const placeTag = () => { tag.style.transform = `translate(${PROCS[running].x + PW / 2 - 32}px, 0px)`; cpuRun.textContent = 'runs ' + PROCS[running].id; };  // placeTag(): slides the "on CPU" tab over the running process and updates "runs Pn"
          const pick = (id) => {  // pick(id): handles a click on one of the three parts
            [gate, create, cpu].forEach((g) => g.classList.toggle('on', g.dataset.id === id));  // marks the clicked part as picked and the other two as not
            Object.entries(kb).forEach(([k, g]) => g.classList.toggle('on', (id === 'create' && k === 'table') || (id === 'switch' && k === 'sched') || (id === 'modes' && k === 'intr')));  // lights the matching kernel part: creating uses the process table, switching the scheduler, the gate the interrupt handlers
            /* once created, P4 is an ordinary Ready process and joins the rotation */
            if (id === 'create' && PROCS.length === 3) { p4r.setAttribute('class', 'fr s-proc'); p4r.removeAttribute('stroke-dasharray'); p4a.textContent = 'P4'; p4b.textContent = 'new: Ready'; PROCS.push({ id: 'P4', name: 'new', x: p4x }); }  // the first time "create" is clicked, the dashed box becomes a solid P4 marked "new: Ready" and joins the rotation
            if (id === 'switch') {  // when the CPU is clicked, switch to the next process
              /* the OS itself does the switch, so the mode bit reads kernel for a moment */
              const my = ++gen;  // my: this click's number, so the timer below can tell whether a newer click came in
              cpuMode.textContent = 'kernel'; cpuMode.style.fill = 'var(--os)';  // the mode bit reads kernel, in the OS colour, while the OS does the switch
              running = (running + 1) % PROCS.length; placeTag();  // moves to the next process in turn and slides the tab over it
              if (PROCS.length === 4) p4b.textContent = 'new';  // once P4 exists, its label goes back to just "new", since its state now changes as it takes turns
              ctx.after(700, () => { if (my !== gen) return; cpuMode.textContent = 'user'; cpuMode.style.fill = 'var(--proc)'; });  // 0.7 s later, unless another click came in, the mode bit goes back to user
            }  // ends the switch branch
            const [t, txt, pitch] = INFO[id];  // unpacks the part's title, explanation and football comparison
            say(info, 'info', t, `${txt}<div class="small" style="margin-top:6px"><b>On the pitch:</b> ${pitch}</div>`);  // shows them in the info box, with the comparison on its own line
          };  // ends pick()
          [gate, create, cpu].forEach((g) => {  // wires up each of the three clickable parts
            g.addEventListener('click', () => pick(g.dataset.id));  // a click picks it
            g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(g.dataset.id); } });  // Enter or Space on a focused part picks it too, so the drawing works from the keyboard
          });  // ends the wiring loop
          placeTag();  // puts the "on CPU" tab over P1 when the step opens
          say(info, 'info', 'Click a part of the picture', 'Try the <b>privilege gate</b> on the boundary, the dashed <b>new process</b>, and the <b>CPU</b> box. Each one is a job this section teaches.');  // the starting message: which three parts to try

          el.append(h('div', { class: 'split l fill' },  // builds the layout: class l gives the text column less width than the drawing
            h('div', { class: 'stack' },  // left column, stacked top to bottom
              h('p', { class: 'lead m0', html: 'While a program runs, the processor is busy executing <i>its</i> instructions, not the operating system’s. So how does the OS stay in charge of the whole machine?' }),  // lead paragraph: while a program runs, how can the OS stay in charge?
              h('p', { class: 'm0', html: 'Three things work together. Hardware <b>privilege</b> keeps programs away from what they must not touch. The OS controls how every process is <b>born</b>. And it can take the processor back and <b>hand it</b> to another process.' }),  // paragraph: three things work together, privilege, birth and hand-off
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A referee in a football match. The players (processes) do the playing, but only the referee can stop the clock, register a new player or bring on a substitute. The whistle that halts play is an <span class="t">interrupt</span>.' }),  // analogy callout: the OS as a referee, and the whistle as an interrupt
              h('div', { class: 'card tight small', html: '<b>In this section you will</b> try a forbidden instruction and watch it trap, sort the <span class="t">kernel</span>’s jobs, build a process in five steps, classify the events that hand control to the OS, and compare a cheap <span class="t">mode switch</span> with a full <span class="t">process switch</span>.' })),  // a card listing what the student will do in this section; closes the left column
            h('div', { class: 'card white stack' },  // right column: a white card holding the drawing
              h('h4', { class: 'm0' }, 'Three ways the OS keeps control'),  // the heading over the drawing
              svg,  // the drawing itself
              h('div', { class: 'row small', style: { gap: '16px' } },  // the colour key row
                h('span', { html: '<span class="legend-sq" style="background:var(--cpu-bg);border-color:var(--cpu)"></span>processor (CPU)' }),  // key item: processor colours
                h('span', { html: '<span class="legend-sq" style="background:var(--proc-bg);border-color:var(--proc)"></span>user processes' }),  // key item: user process colours
                h('span', { html: '<span class="legend-sq" style="background:var(--os-bg);border-color:var(--os)"></span>operating system kernel' })),  // key item: OS kernel colours; closes the key row
              info)));  // the info box; closes the layout
        },  // ends render() for step 1
      },  // closes step 1

      /* ============ 2. User mode vs kernel mode: the privilege gate ============ */
      {  // opens step 2
        title: 'Two modes: the privilege gate',  // step 2 title
        kind: 'explore',  // kind explore: a step for free clicking and exploring
        render(el, ctx) {  // render(el, ctx): builds the privilege-gate simulator when step 2 is shown
          const { h } = ctx;  // takes h, the element-building helper, out of ctx
          /* kind: ok = ordinary, mem = protected memory, priv = privileged instruction, sys = system call */
          const INS = [  // INS: the eight instructions the student can try, each with its code, what it does, its kind and why
            { code: 'ADD R1,R2', what: 'add two registers', kind: 'ok', why: 'Plain arithmetic on the program’s own registers cannot harm anyone else.' },  // ADD: ordinary arithmetic on the program's own registers
            { code: 'LOAD R3,x', what: 'read its own variable', kind: 'ok', why: 'The address lies inside the program’s own memory, so the memory hardware lets it through.' },  // LOAD: reading the program's own variable, also ordinary
            { code: 'STORE PCB', what: 'write into a PCB', kind: 'mem', why: 'Every PCB, even the program’s own, lives in the OS’s protected memory. A program that could write there could, for example, raise its own priority or point its record at another process’s memory.' },  // STORE PCB: writing into a PCB, which lives in protected memory
            { code: 'INT OFF', what: 'disable interrupts', kind: 'priv', why: 'With interrupts off, the clock could never interrupt this program, so it could keep the processor forever.',  // INT OFF: switching interrupts off, a privileged instruction; kAct, kEnd, kSay are the texts used when the kernel runs it
              kAct: 'executes it: interrupts now off', kEnd: 'OS updates a table undisturbed', kSay: 'In kernel mode it just runs. The OS switches interrupts off for a few instructions while it updates a table that an interrupt handler also uses, then switches them back on.' },  // what the stages and verdict say when the kernel switches interrupts off
            { code: 'SET TIMER', what: 'reprogram the clock', kind: 'priv', why: 'The timer is how the OS takes the processor back. A program that could stretch it would never be stopped.',  // SET TIMER: reprogramming the clock, privileged
              kSay: 'In kernel mode it just runs. The OS does exactly this before it hands the processor to a process: it sets the timer so that the next clock interrupt will end that process’s time slice.' },  // why the kernel itself sets the timer before dispatching a process
            { code: 'IO START', what: 'drive the disk directly', kind: 'priv', why: 'Going straight to the disk would bypass file permissions and collide with other programs using the same device.',  // IO START: driving the disk directly, privileged
              kSay: 'In kernel mode it just runs. This is how the OS carries out a program’s read request: it has already checked the permissions, so now it drives the device itself.' },  // why the kernel may drive the device once it has checked the request
            { code: 'HALT', what: 'stop the processor', kind: 'priv', why: 'One program must never be able to stop the machine for everyone else.',  // HALT: stopping the processor, privileged
              kAct: 'executes it: the processor stops', kEnd: 'idle until the next interrupt', kSay: 'In kernel mode it runs, so the processor stops fetching instructions. The OS uses this only when no process is Ready at all, and the next interrupt wakes the processor up again.' },  // what the stages and verdict say when the kernel halts the processor
            { code: 'SYSCALL', what: 'ask the OS to read a file', kind: 'sys', why: '' },  // SYSCALL: the system call, the one legal way to ask the OS for privileged work
          ];  // closes INS
          let mode = 'user', gen = 0;  // mode: who is running, 'user' (the editor) or 'kernel'; gen: a counter that cancels an older animation
          const mb = h('span', { class: 'mbit u' }, 'mode bit: user');  // mb: the mode-bit cell of the PSW display
          const ie = h('span', {}, 'interrupts: on');  // ie: the interrupts cell of the PSW display
          const psw = h('div', { class: 'psw', title: 'Program status word' }, h('span', {}, 'PSW'), ctx.narrow ? null : h('span', {}, 'flags: Z=0 C=0'), ie, mb);  // psw: the program status word display: its name, the flags (left out on phones), interrupts and mode bit
          const setMode = (m) => { mb.className = 'mbit ' + (m === 'user' ? 'u' : 'k'); mb.textContent = 'mode bit: ' + m; };  // setMode(m): repaints the mode-bit cell for user or kernel mode
          const setIE = (on) => { ie.textContent = 'interrupts: ' + (on ? 'on' : 'off'); ie.style.color = on ? '' : 'var(--intr)'; ie.style.fontWeight = on ? '' : '800'; };  // setIE(on): repaints the interrupts cell; "off" shows in bold interrupt colour
          const boxes = [0, 1, 2, 3].map(() => h('div', { class: 'fbox' }));  // boxes: the four stage boxes of the check
          const LBL = ['1 · Decode', '2 · Check', '3 · Act', '4 · Result'];  // LBL: the four stage labels
          const flow = h('div', { class: 'flow' });  // flow: the row that holds the stages with arrows between them
          boxes.forEach((b, i) => { if (i) flow.append(h('span', { class: 'ar' }, '→')); flow.append(b); });  // puts an arrow in front of every stage box except the first
          if (ctx.narrow) { flow.style.gridTemplateColumns = 'minmax(0,1fr) minmax(0,1fr)'; flow.querySelectorAll('.ar').forEach((a) => a.remove()); }  // on phones the stages form a 2 x 2 grid and the arrows are removed
          const out = h('div', { class: 'msg', style: { minHeight: '104px' } });  // out: the message box that gives the result
          const btns = [];  // btns: the instruction buttons, filled in further down
          const paintIdle = () => {  // paintIdle(): resets the stage boxes to their general descriptions and says who is running
            boxes.forEach((b, i) => { b.className = 'fbox'; b.innerHTML = `<span class="lbl">${LBL[i]}</span>${['fetch the instruction', 'look at the mode bit', 'run it, or trap', 'what happens next'][i]}`; });  // each stage box gets its label and a general description of that stage
            say(out, 'info', mode === 'user' ? 'The editor is running in user mode' : 'The OS kernel is running in kernel mode',  // message title: the editor in user mode or the kernel in kernel mode
              mode === 'user' ? 'Click an instruction to make the editor try it. Each click starts a fresh run of the editor.' : 'Now the very same instructions are tried by the kernel itself. Watch what changes.');  // message text: what to click, or a note that the kernel now tries the same instructions
          };  // ends paintIdle()
          const run = (k) => {  // run(k): plays the four-stage check for instruction k
            const ins = INS[k], my = ++gen;  // ins: the instruction being tried; my: this run's number, so an older run's timers can stop
            btns.forEach((b, j) => b.classList.toggle('on', j === k));  // marks the clicked instruction's button as pressed
            setMode(mode); setIE(true);  // each run starts from a fresh PSW: the current mode with interrupts on
            /* the four stages as [class, text]; the mode bit changes at stage 3 (and back at stage 4) */
            let st, verdict, modeAt3 = mode, modeAt4 = mode;  // st: the four stages as [colour, text]; verdict: [kind, title, text]; modeAt3/modeAt4: the mode bit at stages 3 and 4
            if (mode === 'kernel') {  // when the kernel is the one running
              st = [['os', `<code>${ins.code}</code>`], ['ok', ins.kind === 'sys' ? 'kernel mode: no door needed' : 'mode bit = kernel: all allowed'],  // kernel stages 1-2: the code, then a check that always passes (a system call needs no door here)
                ['os', ins.kind === 'sys' ? 'calls its own routine directly' : ins.kAct || 'executes it'], ['os', ins.kEnd || 'the OS carries on']];  // kernel stages 3-4: it calls its own routine or executes the instruction, then carries on
              verdict = ins.kind === 'sys'  // the kernel's verdict depends on the kind of instruction
                ? ['info', 'Not needed here', 'Kernel code simply calls its own routines. The system call exists as the one safe door for <i>user</i> programs.']  // a system call from the kernel: not needed, since kernel code calls its routines directly
                : ['ok', 'Allowed', ins.kind === 'ok' ? 'Ordinary instructions run in either mode.' : ins.kSay || 'In kernel mode the very same instruction just runs: the OS may write any of its own tables, including every PCB.'];  // anything else: allowed, with the instruction's own kernel text if it has one
            } else if (ins.kind === 'ok') {  // when the editor tries an ordinary instruction
              st = [['ok', `<code>${ins.code}</code>`], ['ok', 'ordinary instruction ✓'], ['ok', 'executes in user mode'], ['ok', 'the editor carries on']];  // all four stages are green: decoded, allowed, executed, the editor carries on
              verdict = ['ok', 'Allowed', ins.why];  // verdict: allowed, with the reason it is harmless
            } else if (ins.kind === 'sys') {  // when the editor makes a system call
              st = [['ok', `<code>${ins.code}</code>`], ['ok', 'the one legal door ✓'], ['os', 'mode bit → kernel; OS reads the file'], ['ok', 'return: mode bit → user']];  // stages: the one legal door, the mode bit goes to kernel while the OS works, then the return sets it back to user
              verdict = ['ok', 'Allowed, the proper way', 'The program cannot do privileged work itself, so it asks. The <span class="t">system call</span> instruction sets the <span class="t">mode bit</span> to kernel and jumps to a fixed OS entry point, so the program cannot pick which kernel code runs. The OS checks the request, does the work, and a return instruction puts the processor back in user mode.'];  // verdict: allowed the proper way, with how the system call enters the OS at a fixed entry point
              modeAt3 = 'kernel'; modeAt4 = 'user';  // the mode bit reads kernel at stage 3 and user again at stage 4
            } else {  // otherwise the editor tried something privileged or protected
              st = [['ok', `<code>${ins.code}</code>`], ['bad', ins.kind === 'mem' ? 'address is protected ✗' : 'privileged in user mode ✗'], ['bad', 'TRAP: mode bit → kernel, jump to OS'], ['os', 'OS ends the editor']];  // stages: the check fails, a trap switches to kernel mode, and the OS ends the editor
              verdict = ['bad', 'Trapped', `${ins.why} The hardware refuses and raises a <span class="t">trap</span>, which hands control to the OS in kernel mode. The OS normally terminates the offending process.`];  // verdict: trapped, with the reason it is forbidden
              modeAt3 = 'kernel'; modeAt4 = 'kernel';  // the mode bit reads kernel at stage 3 and stays kernel
            }  // ends the choice of stages
            boxes.forEach((b, i) => { b.className = 'fbox'; b.innerHTML = `<span class="lbl">${LBL[i]}</span>${st[i][1]}`; });  // fills the four boxes with this run's texts, still faded
            say(out, 'info', 'Running…', `The ${mode === 'user' ? 'editor' : 'kernel'} tries <code>${ins.code}</code> (${ins.what}).`);  // a "Running..." message naming who tries which instruction
            [0, 1, 2, 3].forEach((i) => ctx.after(i * 260, () => {  // lights the stages one by one, 0.26 s apart (ctx.after timers stop when the student leaves the step)
              if (my !== gen) return;  // stops if a newer run has started since
              boxes[i].className = 'fbox lit ' + st[i][0];  // lights stage i in its colour
              if (i === 2) { setMode(modeAt3); if (mode === 'kernel' && ins.code === 'INT OFF') setIE(false); }  // at stage 3 the mode bit updates; when the kernel runs INT OFF, interrupts also show off
              if (i === 3) { setMode(modeAt4); say(out, verdict[0], verdict[1], verdict[2]); }  // at stage 4 the mode bit takes its final value and the verdict appears
            }));  // ends the timed stages
          };  // ends run()
          INS.forEach((ins, k) => btns.push(h('button', { class: 'btn ins', type: 'button', onclick: () => run(k), html: `<code>${ins.code}</code><span>${ins.what}</span>` })));  // makes one button per instruction, showing its code and what it does
          const seg = ctx.ui.seg([{ value: 'user', label: 'Editor (user mode)' }, { value: 'kernel', label: 'OS kernel (kernel mode)' }], mode, (v) => {  // seg: a switch between the editor (user mode) and the OS kernel (kernel mode)
            mode = v; gen++; setMode(v); setIE(true); btns.forEach((b) => b.classList.remove('on')); paintIdle();  // switching sets the mode, cancels any running check, resets the PSW, unpresses the buttons and shows the idle view
          });  // ends the switch's change handler
          paintIdle();  // shows the idle view when the step opens

          el.append(h('div', { class: 'split l fill' },  // builds the layout: class l gives the text column less width than the simulator
            h('div', { class: 'stack' },  // left column, stacked top to bottom
              h('p', { class: 'lead m0', html: 'The processor is always in one of two modes, and the mode decides what the running code may do.' }),  // lead paragraph: the processor is always in one of two modes
              h('div', { class: 'grid-2' },  // two cards side by side
                h('div', { class: 'card proc tight', html: '<h4 style="color:var(--proc)">User mode</h4><p class="small m0">Less privileged. Ordinary programs run here. <span class="t">Privileged instructions</span> and protected memory are off limits.</p>' }),  // user mode card: less privileged, no privileged instructions or protected memory
                h('div', { class: 'card os tight', html: '<h4 style="color:var(--os)">Kernel mode</h4><p class="small m0">More privileged. The OS kernel runs here: any instruction, any memory. Also called <b>system mode</b> or <b>control mode</b>.</p>' })),  // kernel mode card: more privileged, also called system or control mode; closes the pair
              h('p', { class: 'small m0', html: 'How does the processor know the mode? A single <span class="t">mode bit</span> in the <span class="t">program status word (PSW)</span>. It flips to kernel only on an <span class="t">interrupt</span>, a <span class="t">trap</span> or a <span class="t">system call</span>, and each of those lands at an OS entry point chosen in advance. When the OS is done, a return instruction reloads the saved PSW, which flips the bit back to user.' }),  // paragraph: the mode bit in the PSW, what flips it to kernel, and how a return flips it back
              h('div', { class: 'callout why m0', 'data-label': 'Why two modes?', html: 'The OS keeps its own tables, such as every process’s <span class="t">PCB</span>, in protected memory. If any program could rewrite them or turn off the clock, one bug or one attacker could take over the whole machine.' })),  // why-two-modes callout: the OS tables must be protected; closes the left column
            h('div', { class: 'card white stack', style: { gap: '10px' } },  // right column: a white card holding the simulator
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Who is running?'), seg),  // heading row: "Who is running?" and the switch
              h('div', { class: 'row' }, psw),  // the PSW display
              h('div', { class: 'grid-2', style: { gap: '6px 10px' } }, ...btns),  // the instruction buttons in two columns
              flow, out)));  // the stage row and the result message; closes the layout
        },  // ends render() for step 2
      },  // closes step 2

      /* ============ 3. The kernel's jobs: a sorting game ============ */
      {  // opens step 3
        title: 'The kernel’s job list: sort it into four families',  // step 3 title
        kind: 'lab',  // kind lab: a hands-on step
        render(el, ctx) {  // render(el, ctx): builds the kernel-job sorting game when step 3 is shown
          const { h } = ctx;  // takes h, the element-building helper, out of ctx
          const FAM = [  // FAM: the four families of kernel jobs, each with ID, name, colour, a short blurb and a hint for wrong picks
            { id: 'proc', name: 'Process management', cls: 'proc', blurb: 'creating, running and coordinating processes',  // process management family
              hint: 'Process management is about the life of processes: creating them, choosing who runs, switching, coordinating and keeping their PCBs.' },  // hint: it is about the life of processes
            { id: 'mem', name: 'Memory management', cls: 'mem', blurb: 'deciding what lives where in main memory',  // memory management family
              hint: 'Memory management is about which parts of main memory each process gets and what is kept on disk instead.' },  // hint: it is about who gets which part of memory
            { id: 'io', name: 'I/O management', cls: 'io', blurb: 'sharing devices and moving data to and from them',  // I/O management family
              hint: 'I/O management is about devices: who may use which one, and how data travels to and from them.' },  // hint: it is about devices and moving data
            { id: 'sup', name: 'Support functions', cls: 'os', blurb: 'services that every other part relies on',  // support functions family
              hint: 'Support functions are the kernel’s housekeeping services that the other three families lean on: interrupts, accounting, monitoring.' },  // hint: housekeeping services the other three lean on
          ];  // closes FAM
          const JOBS = [  // JOBS: the 13 kernel jobs to sort, each [job, right family, explanation]
            ['Creating and terminating processes', 'proc', 'Building a new process and tearing it down at the end is process management at its most basic.'],  // job: creating and terminating processes (process management)
            ['Swapping a process out to disk and back', 'mem', 'Swapping decides which process images occupy main memory, so it is memory management.'],  // job: swapping (memory management)
            ['Handling interrupts', 'sup', 'Every other part of the kernel depends on interrupts reaching the right handler, so this is a support function.'],  // job: handling interrupts (support)
            ['Managing buffers for data on its way to or from a device', 'io', 'Buffers smooth out the speed difference between devices and processes. That is I/O management.'],  // job: managing device buffers (I/O management)
            ['Scheduling and dispatching processes', 'proc', 'Choosing which Ready process runs next, and starting it, is process management.'],  // job: scheduling and dispatching (process management)
            ['Allocating memory space to a process', 'mem', 'Handing out regions of main memory is memory management.'],  // job: allocating memory space (memory management)
            ['Accounting: recording who used how much', 'sup', 'Recording processor time and other usage per process or user supports billing, limits and tuning. It is a support function.'],  // job: accounting (support)
            ['Switching the processor between processes', 'proc', 'Saving one context and restoring another is a process-management job. The last steps of this section are all about it.'],  // job: switching the processor between processes (process management)
            ['Assigning I/O channels and devices to processes', 'io', 'Deciding which process may use which device or channel is I/O management.'],  // job: assigning I/O channels and devices (I/O management)
            ['Managing pages and segments', 'mem', 'Pages and segments are the pieces in which memory is divided and mapped, so they belong to memory management.'],  // job: managing pages and segments (memory management)
            ['Process synchronization and inter-process communication', 'proc', 'Coordinating processes and letting them exchange messages is process management.'],  // job: synchronization and inter-process communication (process management)
            ['Monitoring the system’s load and health', 'sup', 'Watching load, errors and performance serves the whole system: a support function.'],  // job: monitoring load and health (support)
            ['Managing process control blocks', 'proc', 'Creating, updating and linking PCBs is the core bookkeeping of process management.'],  // job: managing process control blocks (process management)
          ];  // closes JOBS
          let idx = 0, tries = 0, first = 0;  // idx: the number of the current job; tries: wrong clicks on it so far; first: jobs sorted right on the first try
          const card = h('div', { class: 'jobcard' });  // card: shows the job waiting to be sorted
          const counter = h('span', { class: 'chip accent' });  // counter: the chip that says "Job n of 13"
          const meter = h('div', { class: 'meter grow' }, h('i', { style: { width: '0%' } }));  // meter: the progress bar
          const scoreEl = h('span', { class: 'small b' });  // scoreEl: the "Right first time" count
          const fb = h('div', { class: 'msg', style: { minHeight: '104px' } });  // fb: the feedback message box
          const bins = FAM.map((f) => {  // bins: builds one clickable box per family
            const list = h('ul', { style: { margin: '2px 0 0', paddingLeft: '18px', fontSize: '13.5px', lineHeight: '1.3' } });  // list: the bulleted list of jobs already filed in this family
            const b = h('div', { class: 'bin', role: 'button', tabindex: 0, 'aria-label': 'Put the job into ' + f.name },  // b: the family box; it acts as a button and takes keyboard focus
              h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'chip ' + f.cls }, f.name)),  // the family's name as a coloured chip
              h('div', { class: 'blurb' }, f.blurb), list);  // the grey blurb, then the job list
            b.list = list; b.fam = f;  // remembers the list and the family on the box so drop() can use them
            b.addEventListener('click', () => drop(b));  // a click drops the current job into this box
            b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(b); } });  // Enter or Space does the same from the keyboard
            return b;  // hands back the finished box
          });  // ends the loop that builds the boxes
          const flashBin = (b, cls) => { b.classList.remove('flash-ok', 'flash-bad'); b.classList.add(cls); ctx.after(650, () => b.classList.remove(cls)); };  // flashBin(b, cls): flashes a family box green or red for 0.65 s
          const paint = () => {  // paint(): updates the counter, progress bar, score and job card
            counter.textContent = idx < JOBS.length ? `Job ${idx + 1} of ${JOBS.length}` : 'All sorted';  // counter: "Job n of 13", or "All sorted" at the end
            meter.firstChild.style.width = (idx / JOBS.length) * 100 + '%';  // the progress bar fills in step with the jobs done
            scoreEl.textContent = `Right first time: ${first}`;  // the first-try score
            if (idx < JOBS.length) card.textContent = JOBS[idx][0];  // the job card shows the next job
            else card.innerHTML = `<span>All ${JOBS.length} jobs sorted. <span style="color:var(--ok)">${first} of ${JOBS.length}</span> right first time.</span>`;  // or, at the end, a summary of first-try answers
          };  // ends paint()
          const place = (late) => {  // place(late): files the current job under its right family (amber bullet if late) and moves to the next job
            const [text, fam] = JOBS[idx];  // unpacks the current job's text and right family
            const b = bins.find((x) => x.fam.id === fam);  // finds the right family's box
            b.list.append(h('li', { class: 'fresh' + (late ? ' late' : '') }, text));  // adds the job to that list; class fresh makes it fade in
            flashBin(b, 'flash-ok');  // flashes that box green
            idx++; tries = 0;  // moves on to the next job with a fresh try count
            paint();  // redraws the counter, bar, score and card
            if (idx === JOBS.length) say(fb, 'ok', 'Done: the kernel’s job list', 'Notice what every job has in common: it touches shared tables (PCBs, page tables, buffers) or the hardware itself (the timer, device controllers). That is exactly why the kernel does them in <b>kernel mode</b>, where nothing else can interfere.');  // after the last job, a closing message: every job touches shared tables or hardware, hence kernel mode
          };  // ends place()
          const drop = (b) => {  // drop(b): runs when a family box is clicked
            if (idx >= JOBS.length) { say(fb, 'info', 'All sorted', 'Press <b>Start over</b> to sort the jobs again.'); return; }  // once every job is sorted, a click just points to Start over
            const [text, fam, why] = JOBS[idx];  // unpacks the current job's text, right family and explanation
            if (b.fam.id === fam) {  // the box clicked is the right family
              if (!tries) first++;  // counts toward the score only on the first try
              say(fb, 'ok', tries ? 'Right on the second try' : 'Right', `<i>${text}</i> → <b>${b.fam.name}</b>. ${why}`);  // feedback: right (or right on the second try), the job, its family and why
              place(tries > 0);  // files the job, amber if it took a second try
            } else if (tries === 0) {  // a first wrong click
              tries = 1;  // remembers the miss
              flashBin(b, 'flash-bad');  // flashes the clicked box red
              say(fb, 'bad', `Not ${b.fam.name.toLowerCase()}`, `${b.fam.hint} Does this job fit that description? Try another family.`);  // feedback: what the clicked family covers, and a nudge to try another
            } else {  // a second wrong click
              const right = FAM.find((f) => f.id === fam);  // looks up the right family
              flashBin(b, 'flash-bad');  // flashes the clicked box red
              say(fb, 'warn', `It belongs to ${right.name}`, `${why} It has been filed there for you, marked in amber.`);  // feedback: where the job belongs and why; it is filed there for the student
              place(true);  // files it with an amber bullet
            }  // ends the right/wrong branches
          };  // ends drop()
          const reset = () => { idx = 0; tries = 0; first = 0; bins.forEach((b) => b.list.replaceChildren()); paint(); say(fb, 'info', 'Click a family', 'Read the job on the card, then click the family box where it belongs. A wrong click gives you a hint and a second try.'); };  // reset(): empties every family list, zeroes the counts, redraws and shows the starting hint
          reset();  // sets up the game when the step opens

          el.append(h('div', { class: 'split l fill' },  // builds the layout: class l gives the text column less width than the family boxes
            h('div', { class: 'stack' },  // left column, stacked top to bottom
              h('p', { class: 'lead m0', html: 'The <span class="t">kernel</span> is the part of the OS that stays in main memory and runs in <span class="t">kernel mode</span>. Its many jobs fall into four families.' }),  // lead paragraph: the kernel stays in memory, runs in kernel mode, and its jobs fall into four families
              h('div', { class: 'card stack', style: { gap: '6px' } }, h('div', { class: 'row' }, counter), card),  // a card with the job counter and the job to sort
              fb,  // the feedback box
              h('div', { class: 'row nw' }, meter, scoreEl, h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Start over')),  // a row that never wraps: progress bar, score and Start over
              h('div', { class: 'callout tip small m0', 'data-label': 'How to decide', html: 'Ask what the job is really looking after: the processes themselves, main memory, the devices, or a service that the other three families rely on.' })),  // tip callout: ask what the job is really looking after; closes the left column
            h('div', { class: 'grid-2', style: { gridAutoRows: ctx.narrow ? 'auto' : 'minmax(0, 1fr)', height: ctx.narrow ? 'auto' : '100%' } }, ...bins)));  // right column: a 2 x 2 grid of family boxes that share the height on wide screens and take their natural height on phones
        },  // ends render() for step 3
      },  // closes step 3

      /* ============ 4. Process creation: build it in the right order ============ */
      {  // opens step 4
        title: 'Creating a process in five steps',  // step 4 title
        kind: 'lab',  // kind lab: a hands-on step
        render(el, ctx) {  // render(el, ctx): builds the process-creation lab when step 4 is shown
          const { h } = ctx;  // takes h, the element-building helper, out of ctx
          const ST = [  // ST: the five creation steps in their correct order, each with a label, what it did, and why it is too early
            { label: 'Assign a unique process identifier',  // step 1 label: assign a unique process identifier
              did: 'The new process gets <b>PID 31</b>, a number no other current process has, and a new entry in the <span class="t">process table</span>. From now on every table and queue refers to it by this number.' },  // what step 1 did: PID 31 and a new process table entry
            { label: 'Allocate space for the process image',  // step 2 label: allocate space for the process image
              did: (room) => `Space is set aside for every part of the <span class="t">process image</span>: the program code and data (its user address space), its stack, and the PCB itself. The sizes come from defaults for this kind of program or from what the creator asks for. ${room ? 'Main memory has room, so the image goes there.' : 'Main memory is full, so the image is placed in the swap area on disk for now.'}`,  // what step 2 did, written as a function of room so it can say main memory or the swap area
              early: 'Space for whom? First the new process needs an identity: a PID and a slot in the process table. Everything else is recorded under that number.' },  // why step 2 is too early: the process needs an identity first
            { label: 'Initialize the process control block',  // step 3 label: initialize the process control block
              did: (room) => `The PCB is filled in. <b>Identification:</b> PID, parent’s PID, user. <b>Processor state:</b> zeros, except the program counter (entry point) and stack pointer (new stack). <b>Control:</b> state = ${room ? 'Ready' : 'Ready/Suspend'} (the OS admits it at once, so its New stage from section 3.2 ends here), default priority, no resources yet (unless requested or inherited from the parent).`,  // what step 3 did: the PCB's three groups filled in, with state Ready or Ready/Suspend
              early: 'The PCB lives inside the process image, and no space for the image has been allocated yet. There is nowhere to write it.' },  // why step 3 is too early: the PCB lives in the image, which has no space yet
            { label: 'Set the linkages (put it in a queue)',  // step 4 label: set the linkages
              did: (room) => `The PCB is linked onto the tail of the <b>${room ? 'Ready' : 'Ready/Suspend'} list</b>. Now the scheduler can find it${room ? ' and will dispatch it in its turn.' : '; it can run once it is brought into main memory.'}`,  // what step 4 did: linked onto the tail of the Ready (or Ready/Suspend) list
              early: 'Putting the process in a queue announces that it may run. But its PCB has not been filled in yet (no program counter, no state), so the dispatcher would load a blank record and jump nowhere.' },  // why step 4 is too early: the dispatcher would load a blank PCB
            { label: 'Create or expand other data structures',  // step 5 label: create or expand other data structures
              did: 'Extra bookkeeping is set up, for example a new record in the <b>accounting file</b> that will track the processor time this process uses.',  // what step 5 did: a new accounting record
              early: 'Not yet. The standard sequence builds the core first: a process the scheduler can find. Extra bookkeeping such as accounting records comes last.' },  // why step 5 is too early: extra bookkeeping comes last
          ];  // closes ST
          const SHOWN = [2, 0, 4, 1, 3]; // buttons appear in this shuffled order
          let done = 0, room = true, slips = 0;  // done: how many steps are finished (always in order); room: whether memory has room; slips: wrong picks
          const mkPan = (n, title) => { const body = h('div'); const p = h('div', { class: 'pan' }, h('div', { class: 'ptitle' }, h('span', { class: 'sb' }, String(n)), title), body); p.body = body; return p; };  // mkPan(n, title): builds a panel with a numbered title and an empty body, reachable as p.body
          const pA = mkPan(1, 'Process table'), pB = mkPan(2, 'Memory and disk'), pC = mkPan(3, 'PCB of the new process'), pD = mkPan(4, 'Queues'), pE = mkPan(5, 'Accounting file');  // the five panels: process table, memory and disk, PCB, queues, accounting file
          const pans = [pA, pB, pC, pD, pE];  // pans: the five panels in step order
          const chip = (cls, t) => h('span', { class: 'chip ' + cls }, t);  // chip(cls, t): makes a small coloured label
          const arrow = () => h('span', { class: 'muted b' }, '→');  // arrow(): a grey arrow used between queue entries
          const draw = (flashN) => {  // draw(flashN): redraws all five panels; flashN is the panel just filled, which gets a flash
            pans.forEach((p, i) => p.classList.toggle('live', done > i));  // a panel counts as live (solid border) once the step with its number is done
            /* 1. process table */
            const rows = [['12', 'desktop', 'memory'], ['17', 'editor', 'memory'], ['23', 'browser', 'memory'], ['5', 'backup', 'disk']];  // rows: the process table's existing entries, each [PID, program, where its image is]
            if (done >= 1) rows.push(['31', 'music', done >= 2 ? (room ? 'memory' : 'disk') : '—']);  // after step 1, PID 31 (music) appears; where its image is fills in after step 2 (memory or disk)
            pA.body.replaceChildren(h('table', { class: 'tbl compact' },  // replaces panel 1's contents with a compact table
              h('tr', {}, h('th', {}, 'PID'), h('th', {}, 'Program'), h('th', {}, 'Image in')),  // the header row: PID, Program, Image in
              ...rows.map((r) => h('tr', { class: r[0] === '31' ? 'on' : '' }, ...r.map((c) => h('td', {}, c))))));  // one row per process; the new PID 31 row is highlighted (class on); closes the table
            /* 2. memory and disk */
            const img = h('div', { class: 'mblk pr new', style: { flex: '1.4' } }, h('b', { style: { padding: '0 4px' } }, '31'), h('span', {}, 'code+data'), h('span', {}, 'stack'), h('span', {}, 'PCB'));  // img: the new image's memory block, with its PID and its three parts
            const mem = [h('div', { class: 'mblk os', style: { flex: '1' } }, 'OS kernel'), h('div', { class: 'mblk pr', style: { flex: '1' } }, 'PID 12'), h('div', { class: 'mblk pr', style: { flex: '1' } }, 'PID 17'),  // mem: the other memory blocks, starting with the OS kernel, PID 12 and PID 17
              h('div', { class: 'mblk pr', style: { flex: room ? '1' : '2.4' } }, 'PID 23')];  // PID 23's block, which grows to fill the space when memory is full; closes the list
            if (room) mem.push(done >= 2 ? img : h('div', { class: 'mblk free', style: { flex: '1.4' } }, 'free space'));  // with room, the last block is free space until step 2 places the new image there
            pB.body.replaceChildren(h('div', { class: 'mcol' }, ...mem),  // fills panel 2 with the memory column
              h('div', { class: 'row', style: { gap: '6px', marginTop: '6px' } }, h('span', { class: 'small b' }, 'Disk swap area:'), chip('proc', 'PID 5'),  // then the disk swap area row: its label and PID 5's swapped-out image
                !room && done >= 2 ? chip('accent', 'PID 31 image') : null, room ? null : h('span', { class: 'xs muted' }, done >= 2 ? '' : '(memory full)')));  // with memory full, the new image appears on disk after step 2, and "(memory full)" shows before; closes the row
            /* 3. PCB */
            if (done < 2) pC.body.replaceChildren(h('p', { class: 'small muted m0' }, 'No space for a PCB yet: it is part of the process image.'));  // before step 2 the PCB panel only says there is no space for a PCB yet
            else {  // from step 2 on, the PCB panel shows its three columns
              const f = done >= 3;  // f: whether the PCB has been filled in (step 3 done)
              const v = (x) => (f ? x : '—');  // v(x): shows the value once filled in, a dash before that
              const col = (title, list) => h('div', { class: 'pcol' }, h('div', { class: 'lbl' }, title),  // col(title, list): one column of the PCB, a heading then one name/value line per field
                ...list.map(([k, val]) => h('div', { class: 'kv' }, h('span', { class: 'k' }, k), h('span', { class: 'v' + (val === '—' ? ' muted' : '') }, val))));  // each line: the field name in grey, the value in bold (plain for a dash)
              pC.body.replaceChildren(h('div', { class: 'grid-3', style: { gap: '10px' } },  // fills panel 3 with three columns
                col('Identification', [['PID', v('31')], ['Parent', v('PID 12')], ['User ID', v('1004')]]),  // identification column: PID, parent and user ID
                col('Processor state', [['PC', v('entry 0x0400')], ['SP', v('top of stack')], ['Others', v('all 0')], ['PSW', v('user mode')]]),  // processor state column: program counter at the entry point, stack pointer, other registers, PSW in user mode
                col('Process control', [['State', v(room ? 'Ready' : 'Ready/Suspend')], ['Priority', v('default')], ['Owns', v('nothing yet')], ['Next in queue', done >= 4 ? 'none (tail)' : '—']])));  // process control column: state, priority, resources, and next-in-queue once step 4 links it at the tail
            }  // ends the PCB branch
            /* 4. queues */
            const q = (name, ids, add) => h('div', { class: 'row', style: { gap: '5px', marginBottom: '4px' } }, h('span', { class: 'small b', style: { width: '112px' } }, name),  // q(name, ids, add): one queue row: its name, its PCBs joined by arrows, and PID 31 at the end when add is true
              ...ids.flatMap((id, i) => [i ? arrow() : null, chip('proc', id)]), add ? arrow() : null, add ? chip('accent', '31') : null);  // the PCB chips with arrows between them, plus the new 31 chip in accent colour when added
            pD.body.replaceChildren(q('Running', ['12'], false), q('Ready', ['17', '23'], done >= 4 && room), q('Ready/Suspend', ['5'], done >= 4 && !room));  // fills panel 4: after step 4, PID 31 joins the Ready queue if memory had room, or Ready/Suspend if not
            /* 5. accounting: one record per process, the new one last */
            pE.body.replaceChildren(h('div', { class: 'row', style: { gap: '5px' } }, chip('', '12: 2.6 s'), chip('', '17: 4.2 s'), chip('', '23: 9.8 s'), chip('', '5: 1.1 s'), done >= 5 ? chip('accent', '31: 0 s') : null));  // fills panel 5: each process's accounting record; PID 31's record appears after step 5
            if (flashN) { const p = pans[flashN - 1]; p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash'); }  // flashes the panel just filled: remove the class, read offsetWidth so the browser notices, add it again
            /* buttons */
            btns.forEach((b) => {  // updates each step button
              const k = b.k, isDone = k < done;  // k: the step this button stands for; isDone: whether that step is finished
              b.classList.toggle('done', isDone);  // a finished step's button turns green
              b.querySelector('.num').textContent = isDone ? String(k + 1) : '?';  // its badge shows the step number once done, a question mark before
            });  // ends the loop over buttons
            progress.textContent = `${done} of 5 steps · wrong picks: ${slips}`;  // the progress line: steps done and wrong picks
          };  // ends draw()
          const fb = h('div', { class: 'msg', style: { minHeight: '112px' } });  // fb: the feedback message box
          const progress = h('span', { class: 'small b muted' });  // progress: the "n of 5 steps" line
          const btns = SHOWN.map((k) => {  // btns: one button per step, in the mixed-up SHOWN order
            const b = h('button', { class: 'btn stepbtn', type: 'button', onclick: () => choose(k) }, h('span', { class: 'num' }, '?'), h('span', {}, ST[k].label));  // each button has a "?" badge and the step's label; clicking it tries step k
            b.k = k; return b;  // remembers which step the button stands for
          });  // ends the loop that builds the buttons
          const choose = (k) => {  // choose(k): runs when the button for step k is clicked
            const b = btns.find((x) => x.k === k);  // b: the button that was clicked
            if (done >= 5) { say(fb, 'info', 'Process 31 is built', 'Press <b>Start over</b> to build it again, or change the memory setting.'); return; }  // once all five steps are done, a click just says so
            if (k < done) { say(fb, 'info', 'Already done', `Step ${k + 1} is finished. Which step comes next?`); return; }  // clicking a finished step asks for the next one instead
            if (k === done) {  // the click is the correct next step
              done++;  // counts it as done
              const d = typeof ST[k].did === 'function' ? ST[k].did(room) : ST[k].did;  // d: the step's "did" text, filled in for the memory setting when it is a function
              draw(k + 1);  // redraws, flashing the panel this step fills
              if (done < 5) say(fb, 'ok', `Step ${k + 1} · ${ST[k].label}`, d);  // steps 1-4: a success message naming the step and what it did
              else say(fb, 'ok', 'Step 5 done: process 31 exists', `${d} ${room ? 'When it is dispatched' : 'Once swapped in, it becomes Ready; when dispatched'}, its PCB’s processor state is loaded, so it starts at its entry point in user mode.`);  // step 5: the process now exists, and when dispatched it starts at its entry point in user mode
              return;  // stops here
            }  // ends the correct-step branch
            slips++;  // otherwise the pick came too early: count the slip
            b.classList.add('bad'); ctx.after(700, () => b.classList.remove('bad'));  // the button flashes red for 0.7 s
            draw();  // redraws the panels (nothing changed)
            say(fb, 'bad', 'Not yet', ST[k].early);  // explains why that step cannot happen yet
          };  // ends choose()
          const reset = () => { done = 0; slips = 0; draw(); say(fb, 'info', 'Which step comes first?', 'Click the step the OS must do next. The numbered panels fill in as you go; each number shows which step fills that panel.'); };  // reset(): back to no steps and no slips, redraws, and asks which step comes first
          const seg = ctx.ui.seg([{ value: true, label: 'Memory has room' }, { value: false, label: 'Memory is full' }], room, (v) => { room = v; reset(); });  // seg: a switch between memory having room and memory being full; switching starts over
          reset();  // sets up the lab when the step opens

          el.append(h('div', { class: 'split l fill' },  // builds the layout: class l gives the controls less width than the panels
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column, stacked top to bottom
              h('p', { class: 'm0', html: 'The desktop (PID 12) asks the OS to start <b>Music</b>. You are the OS: pick the step that comes next.' }),  // paragraph: the desktop (PID 12) asks to start Music, and the student plays the OS
              seg,  // the memory switch
              h('div', { class: 'stack', style: { gap: '6px', flex: 'none' } }, ...btns),  // the five step buttons, stacked
              fb,  // the feedback box
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, progress, h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Start over'))),  // the progress line and Start over; closes the left column
            h('div', { class: 'card white', style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)', gap: '10px', alignContent: 'start' } },  // right column: a white card with the panels in two columns (one on phones)
              pA, pB, h('div', { style: { gridColumn: '1 / -1' } }, pC), pD, pE)));  // panels 1 and 2, then the PCB panel across both columns, then panels 4 and 5; closes the layout
        },  // ends render() for step 4
      },  // closes step 4

      /* ============ 5. Interrupt, trap or supervisor call? (event sorter) ============ */
      {  // opens step 5
        title: 'Interrupt, trap or system call? Sort the events',  // step 5 title
        kind: 'predict',  // kind predict: the step's label says Predict
        render(el, ctx) {  // render(el, ctx): builds the event sorter when step 5 is shown
          const { h } = ctx;  // takes h, the element-building helper, out of ctx
          const TYPES = ['Interrupt', 'Trap', 'Supervisor call'];  // TYPES: the three mechanisms that hand control to the OS
          const FATES = ['Keeps running', '→ Ready', '→ Blocked', '→ Exit'];  // FATES: the four things that can happen to the process that was running
          /* type: index into TYPES, fate: index into FATES (what happens to the process that was running) */
          const EV = [  // EV: the eight events, each with its right mechanism, right outcome and explanation
            { text: 'The system timer fires. The running process P1 has now used its whole time slice.', type: 0, fate: 1,  // event 1: the timer fires and P1's slice is used up (interrupt; P1 goes to Ready)
              why: 'A <b>clock interrupt</b>: it comes from the timer, not from P1’s instruction. P1 is out of time, so the OS puts it back in Ready and dispatches another process.' },  // explanation for event 1
            { text: 'P1 divides a number by zero. It has not arranged any way to handle that error.', type: 1, fate: 3,  // event 2: P1 divides by zero with no handler (trap; P1 exits)
              why: 'A <b>trap</b>: the error comes from P1’s own instruction. With no handler of its own, the error is fatal, so the OS moves P1 to Exit and gives the processor to someone else.' },  // explanation for event 2
            { text: 'P2 calls open() on a file, and the OS has to read the file’s directory entry from disk first.', type: 2, fate: 2,  // event 3: P2 opens a file that must be read from disk (supervisor call; P2 blocks)
              why: 'A <b>supervisor call</b>: P2 asked on purpose. The OS starts the disk read and, since P2 cannot continue without it, blocks P2 and dispatches another process.' },  // explanation for event 3
            { text: 'The disk finishes a read that P3 (Blocked) was waiting for. P3 is no more urgent than the running P1.', type: 0, fate: 0,  // event 4: the disk finishes for P3, which is not more urgent (interrupt; P1 keeps running)
              why: 'An <b>I/O interrupt</b>. The OS moves P3 from Blocked to Ready, then asks whether to preempt P1. P3 is no more urgent, so P1 resumes: a mode switch into the kernel and back, no process switch.' },  // explanation for event 4: a mode switch and back, no process switch
            { text: 'The running P2 jumps to a part of its own program that is still on disk, not yet in main memory.', type: 0, fate: 2,  // event 5: P2 jumps to code still on disk (memory fault, an interrupt; P2 blocks)
              typeHint: 'The instruction itself is perfectly valid. The problem is a fact about memory, outside the instruction: that part of the program simply is not loaded yet.',  // typeHint: a special hint for a wrong mechanism pick, since this event is easy to mistake for a trap
              why: 'A <b>memory fault</b>, which counts as an interrupt: nothing is wrong with the instruction; the code is just not in memory. The OS starts reading it in, blocks P2 until the read finishes, and runs someone else.' },  // explanation for event 5
            { text: 'P1 asks the OS for the current time of day.', type: 2, fate: 0,  // event 6: P1 asks for the time of day (supervisor call; P1 keeps running)
              why: 'A <b>supervisor call</b> the OS can answer at once from its own clock. P1 goes straight back to running: a mode switch into the kernel and back, no process switch.' },  // explanation for event 6: answered at once, only a mode switch
            { text: 'P4, running in user mode, tries to switch interrupts off.', type: 1, fate: 3,  // event 7: P4 tries to switch interrupts off in user mode (trap; P4 exits)
              why: 'A <b>trap</b>: the instruction is privileged and the mode bit says user. The OS treats it as a fatal error and terminates P4.' },  // explanation for event 7
            { text: 'A network message arrives for P5, which was Blocked waiting for it. P5 is more urgent than the running P1.', type: 0, fate: 1,  // event 8: a network message arrives for the more urgent P5 (interrupt; P1 goes to Ready)
              why: 'An <b>I/O interrupt</b>. P5 becomes Ready, and because it is more urgent than P1, the OS preempts P1 (back to Ready) and dispatches P5.' },  // explanation for event 8: P5 preempts P1
          ];  // closes EV
          const WRONG_TYPE = {  // WRONG_TYPE: a hint for each wrong mechanism, keyed "picked-right" by index into TYPES
            '0-1': 'An interrupt comes from outside the running instruction. Here the instruction itself went wrong.',  // picked interrupt, but it was a trap
            '0-2': 'The program asked for this on purpose. Nobody asks for an interrupt.',  // picked interrupt, but it was a supervisor call
            '1-0': 'A trap means the current instruction caused an error. This event comes from outside the instruction: a device, the clock or the memory system.',  // picked trap, but it was an interrupt
            '1-2': 'Nothing went wrong here. The program deliberately asked the OS for a service.',  // picked trap, but it was a supervisor call
            '2-0': 'The running program did not ask for anything. This came from outside it.',  // picked supervisor call, but it was an interrupt
            '2-1': 'The program did not ask for this. Its instruction failed.',  // picked supervisor call, but it was a trap
          };  // closes WRONG_TYPE
          const WRONG_FATE = [  // WRONG_FATE: a hint for each wrong outcome, by index into FATES
            'Can the running process really carry on straight away? Is it out of time, waiting for something, finished, or pushed aside?',  // hint after wrongly picking "Keeps running"
            '“Ready” means able to run, just not right now. Is that the situation here?',  // hint after wrongly picking Ready
            '“Blocked” means waiting for some event, such as a disk read. Is the process actually waiting for anything?',  // hint after wrongly picking Blocked
            '“Exit” means the process is finished for good. Did anything end it?',  // hint after wrongly picking Exit
          ];  // closes WRONG_FATE
          let i = 0, st = null, firstT = 0, firstF = 0, res = [];  // i: the event number; st: progress on its two questions; firstT, firstF: first-try counts; res: each event's mark
          const dots = h('div', { class: 'dots', title: 'Green: both right first time. Amber: needed a second try.' });  // dots: the row of progress marks; its title explains the colours on hover
          const paintDots = () => dots.replaceChildren(...EV.map((_, k) => h('span', { class: (res[k] || '') + (k === i ? ' cur' : '') })));  // paintDots(): redraws the marks, coloured by result, with the current event outlined
          const count = h('span', { class: 'chip accent' });  // count: the chip that says "Event n of 8"
          const scores = h('span', { class: 'small b muted' });  // scores: the first-try score line
          const evtext = h('div', { class: 'evtext' });  // evtext: the event description
          const fb = h('div', { class: 'msg', style: { minHeight: '150px' } });  // fb: the feedback message box
          const next = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { if (i < EV.length && st.type.done && st.fate.done) { i++; show(); } } }, 'Next event →');  // next: the Next event button, which works only once both questions are answered
          const tBtns = TYPES.map((t, k) => h('button', { class: 'btn ans', type: 'button', onclick: () => answer('type', k) }, t));  // tBtns: the three mechanism buttons
          const fBtns = FATES.map((t, k) => h('button', { class: 'btn ans', type: 'button', onclick: () => answer('fate', k) }, t));  // fBtns: the four outcome buttons
          const paintScore = () => { scores.textContent = `Right first time: ${firstT} mechanisms · ${firstF} outcomes`; paintDots(); };  // paintScore(): updates the score line and the progress marks
          const show = () => {  // show(): shows the current event, or the final summary after the last one
            [...tBtns, ...fBtns].forEach((b) => b.classList.remove('right', 'wrong', 'late'));  // clears every answer button's colour
            paintScore();  // updates the score line and marks
            if (i >= EV.length) {  // after the last event, show the summary
              count.textContent = 'All done';  // the chip reads "All done"
              evtext.innerHTML = `All ${EV.length} events sorted. Mechanism right first time: <span style="color:var(--ok)">${firstT}/${EV.length}</span>, outcome: <span style="color:var(--ok)">${firstF}/${EV.length}</span>.`;  // both first-try scores out of 8
              say(fb, 'ok', 'The pattern', 'The OS only regains the processor through an interrupt, a trap or a supervisor call. Whether a <span class="t">process switch</span> follows depends on the running process: if it can carry on, the OS just returns (a mode switch); if it is out of time, waiting, finished or outranked, the OS switches.');  // a closing message: the three ways in, and when a process switch follows
              next.disabled = true; return;  // disables Next and stops
            }  // ends the summary branch
            st = { type: { done: false, tries: 0 }, fate: { done: false, tries: 0 } };  // st: a fresh start for this event, neither question answered, no tries
            count.textContent = `Event ${i + 1} of ${EV.length}`;  // the chip shows the event number
            evtext.textContent = EV[i].text;  // the event's text
            next.disabled = true;  // Next stays off until both questions are answered
            say(fb, 'info', 'Two questions', 'First: which mechanism handed control to the OS? Second: what happens to the process that was running?');  // a message explaining the two questions
          };  // ends show()
          const answer = (which, k) => {  // answer(which, k): handles a click on answer k for question which ('type' or 'fate')
            if (i >= EV.length) return;  // does nothing after the last event
            const ev = EV[i], s = st[which], right = ev[which], list = which === 'type' ? tBtns : fBtns;  // ev: the event; s: this question's progress; right: the correct answer; list: this question's buttons
            if (s.done) return;  // does nothing if this question is already settled
            if (k === right) {  // the answer is right
              s.done = true; list[k].classList.add(s.tries ? 'late' : 'right');  // settles the question; the button turns green on the first try, amber after a miss
              if (!s.tries) { if (which === 'type') firstT++; else firstF++; }  // a first-try answer adds to the mechanism or the outcome score
            } else {  // the answer is wrong
              s.tries++; list[k].classList.add('wrong');  // counts the try and turns the button red
              if (s.tries >= 2) { s.done = true; list[right].classList.add('late'); }  // after two misses the question closes and the right answer is shown in amber
            }  // ends the right/wrong branches
            paintScore();  // updates the score line and marks
            if (st.type.done && st.fate.done) {  // both questions are now settled
              const sw = ev.fate !== 0;  // sw: true when the outcome is anything but "keeps running", which means a process switch
              res[i] = st.type.tries || st.fate.tries ? 'late' : 'ok'; paintDots();  // records the event's mark: amber if either question needed a retry, else green
              say(fb, sw ? 'warn' : 'ok', `${TYPES[ev.type]} · ${FATES[ev.fate].replace('→ ', 'moves to ')} · ${sw ? 'process switch' : 'mode switch only'}`, ev.why);  // feedback title names the mechanism, the outcome and the kind of switch; the explanation follows
              next.disabled = false;  // turns Next on
            } else if (k === right || s.done) {  // one question is settled (right, or closed after two misses)
              say(fb, 'ok', k === right ? 'Right' : `The answer is “${which === 'type' ? TYPES[right] : FATES[right]}”`, 'Now answer the other question.');  // says right, or gives the answer, and asks for the other question
            } else if (which === 'type') {  // a wrong mechanism
              say(fb, 'bad', `Not a ${TYPES[k].toLowerCase()}`, (ev.typeHint && right === 0) ? ev.typeHint : WRONG_TYPE[k + '-' + right]);  // hint: the event's own typeHint when it is really an interrupt, else the hint for this mix-up
            } else {  // a wrong outcome
              say(fb, 'bad', 'Think again', WRONG_FATE[k]);  // hint for that outcome
            }  // ends the feedback choices
          };  // ends answer()
          const reset = () => { i = 0; firstT = 0; firstF = 0; res = []; show(); };  // reset(): back to the first event with all scores and marks cleared
          show();  // shows the first event when the step opens

          el.append(h('div', { class: 'split fill' },  // builds the layout: two equal columns
            h('div', { class: 'stack' },  // left column, stacked top to bottom
              h('p', { class: 'm0', html: 'The OS is just software: it can act only when it gets the processor back. That happens in exactly three ways.' }),  // paragraph: the OS acts only when it gets the processor back, in exactly three ways
              h('table', { class: 'tbl compact' },  // a table summarising the three mechanisms
                h('tr', {}, h('th', {}, 'Mechanism'), h('th', {}, 'Caused by'), h('th', {}, 'Examples')),  // header row: Mechanism, Caused by, Examples
                h('tr', {}, h('td', { class: 'b' }, h('span', { class: 't' }, 'Interrupt')), h('td', {}, 'something outside the current instruction'), h('td', { html: '<span class="t">clock interrupt</span> (time slice up), I/O interrupt (a device finished), <span class="t">memory fault</span>' })),  // interrupt row: caused outside the instruction; clock, I/O, memory fault
                h('tr', {}, h('td', { class: 'b' }, h('span', { class: 't' }, 'Trap')), h('td', {}, 'an error or exception in the current instruction'), h('td', {}, 'divide by zero, privileged instruction in user mode')),  // trap row: caused by an error in the instruction; divide by zero, privileged instruction
                h('tr', {}, h('td', { class: 'b', html: '<span class="t">Supervisor call</span><div class="xs muted" style="font-weight:600">(system call)</div>' }), h('td', {}, 'an explicit request by the program'), h('td', {}, 'open a file, read data, ask the time'))),  // supervisor call row: an explicit request; open, read, ask the time; closes the table
              h('div', { class: 'callout tip small m0', 'data-label': 'Traps come in two kinds', html: '<b>Fatal</b>: the OS ends the process, which moves to Exit. <b>Recoverable</b>: the OS fixes or reports the problem, and the process may carry on.' }),  // tip callout: fatal traps end the process, recoverable ones may let it carry on
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'If the running process can simply carry on, the OS returns to it: only a <span class="t">mode switch</span> happened. Any other outcome needs a full process switch, which costs far more.' })),  // why-it-matters callout: carrying on needs only a mode switch, anything else a process switch; closes the left column
            h('div', { class: 'card white stack', style: { gap: '10px' } },  // right column: a white card holding the sorter
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, count, scores),  // top row: the event counter and the scores
              evtext,  // the event text
              h('div', {}, h('div', { class: 'qlab' }, '1 · What handed control to the OS?'), h('div', { class: 'row', style: { gap: '8px' } }, ...tBtns)),  // question 1 label and the mechanism buttons
              h('div', {}, h('div', { class: 'qlab' }, '2 · What happens to the process that was running?'), h('div', { class: 'row', style: { gap: '8px' } }, ...fBtns)),  // question 2 label and the outcome buttons
              fb,  // the feedback box
              h('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: 'auto' } }, h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Start over'), dots, next))));  // bottom row: Start over, the progress marks and Next; closes the layout
        },  // ends render() for step 5
      },  // closes step 5

      /* ============ 6. Mode switch vs process switch (side by side) ============ */
      {  // opens step 6
        title: 'Mode switch vs process switch',  // step 6 title
        kind: 'compare',  // kind compare: the step's label says Compare
        core: true,  // core: keeps this step on the shorter core path
        render(el, ctx) {  // render(el, ctx): builds the side-by-side comparison and the 100-tick calculator when step 6 is shown
          const { h, s } = ctx;  // takes h (HTML elements) and s (SVG drawing elements) out of ctx
          /* time (illustrative units) reached at the end of each frame; lane B sets the pace */
          const T = [4, 5, 6, 8, 9, 10, 12, 13, 15, 17, 24];  // T: the time reached at the end of each of the 11 animation frames
          const A_ACTS = [['Enter kernel (mode switch)', 1], ['Handler: slice not used up', 1], ['Return to P1 (mode switch)', 1]];  // A_ACTS: lane A's three actions, each [name, cost in units]
          const B_ACTS = [['Enter kernel (mode switch)', 1], ['Handler: slice is used up', 1], ['1 · Save P1’s context', 2], ['2 · Update P1’s PCB', 1], ['3 · P1 → Ready queue', 1],  // B_ACTS: lane B's nine actions: into the kernel, the handler's decision, then the seven switch steps with their costs
            ['4 · Select P2', 2], ['5 · Update P2’s PCB', 1], ['6 · Switch memory map', 2], ['7 · Restore P2’s context', 2]];  // lane B's steps 4 to 7; closes the list
          const CAP = [  // CAP: the caption shown for each of the 11 frames
            '<b>Two identical starts.</b> In both lanes P1 has run for 4 units in user mode. Then the <span class="t">clock interrupt</span> fires.',  // frame 1 caption: both lanes start the same, then the clock interrupt fires
            '<b>Mode switch into the kernel.</b> When P1’s current instruction finishes, the processor notices the pending interrupt. The hardware saves P1’s program counter and PSW, sets the mode bit to kernel and jumps to the clock handler. P1 is still the Running process: nothing about it has changed.',  // frame 2 caption: the hardware's mode switch into the kernel; P1 is still Running
            '<b>The handler decides.</b> Lane A: P1 still has time left in its <span class="t">time slice</span>, so there is nothing more to do. Lane B: P1’s slice is used up, so the OS must switch processes.',  // frame 3 caption: the handler decides; lane A has time left, lane B does not
            '<b>Lane A is finished:</b> a return instruction restores P1’s PC and PSW, the mode bit goes back to user, and P1 carries on. Lane B starts the switch: step 1 copies P1’s whole <span class="t">context</span> (the PC and PSW the hardware put aside, plus every other register) into P1’s PCB.',  // frame 4 caption: lane A returns to P1; lane B saves P1's whole context
            'Lane B, step 2: update P1’s PCB (state Running → Ready, the reason, the time it used). Meanwhile lane A is running P1’s code.',  // frame 5 caption: lane B updates P1's PCB
            'Lane B, step 3: link P1’s PCB into the Ready queue.',  // frame 6 caption: lane B puts P1's PCB in the Ready queue
            'Lane B, step 4: the scheduler chooses the next process to run: P2.',  // frame 7 caption: lane B's scheduler picks P2
            'Lane B, step 5: update P2’s PCB: state Ready → Running.',  // frame 8 caption: lane B marks P2 Running
            'Lane B, step 6: update the memory-management structures so that addresses now lead to P2’s memory, not P1’s.',  // frame 9 caption: lane B switches the memory map to P2
            'Lane B, step 7: load P2’s saved context into the registers. The mode bit returns to user and P2 runs. The whole switch cost 13 units of OS work against 3.',  // frame 10 caption: lane B restores P2's context; 13 units of OS work against 3
            '<b>The bill after 24 units.</b> Lane A: 3 units of OS work, 21 of useful work. Lane B: 13 units of OS work, only 11 useful. On top of that, P2 then runs slowly for a while because the <span class="t" data-t="cache memory">cache</span> still holds P1’s data. (Units are illustrative; the ratio is the point.)',  // frame 11 caption: the totals after 24 units, plus the cache slowdown that follows a switch
          ];  // closes CAP
          const NW = ctx.narrow, VBW = NW ? 320 : 540, X0 = 10, CW = NW ? 12.5 : 21.5, NC = 24;  // NW: phone-width screen; VBW: drawing width; X0: left margin; CW: width of one time unit; NC: 24 units on the timeline
          const cellX = (c) => X0 + c * CW;  // cellX(c): the x position where time unit c starts
          const mkLane = (key, title, sub, acts, cols) => {  // mkLane(key, title, sub, acts, cols): builds one lane card and returns its parts
            const svg = s('svg', { viewBox: `0 0 ${VBW} 66`, width: '100%', role: 'img', 'aria-label': 'Timeline of who uses the processor in lane ' + key });  // svg: the lane's timeline drawing
            const chips = h('div', { class: 'row', style: { gap: '6px' } });  // chips: the row of status chips (mode, what the CPU runs, process states)
            const list = h('div', { class: 'acts', style: { gridTemplateColumns: `repeat(${ctx.narrow ? 1 : cols}, minmax(0, 1fr))`, gridAutoFlow: ctx.narrow ? 'row' : 'column', gridTemplateRows: ctx.narrow ? 'none' : `repeat(${Math.ceil(acts.length / cols)}, auto)` } });  // list: the grid of actions, filled column by column in cols columns on wide screens, one column on phones
            const items = acts.map(([t, c]) => { const it = h('div', { class: 'act' }, h('span', { class: 'ck' }), h('span', {}, t), h('span', { class: 'c' }, '+' + c)); list.append(it); return it; });  // items: one line per action with a tick spot, its name and its cost
            const cost = h('span', { class: 'small b' });  // cost: the running total of OS work
            const meter = h('div', { class: 'meter grow' }, h('i', { style: { width: '0%' } }));  // meter: a bar showing that total
            const note = h('div', { class: 'small', style: { minHeight: '0' } });  // note: a spot for a remark that appears near the end
            const card = h('div', { class: 'card white lane' },  // card: the lane card that holds everything
              h('div', {}, h('h3', { class: 'm0', style: { fontSize: '17px' } }, title), h('div', { class: 'small muted' }, sub)),  // the lane's heading and grey subtitle
              svg, chips, list, note, h('div', { class: 'row nw', style: { marginTop: 'auto' } }, cost, meter));  // then the timeline, chips, action list, note, and a bottom row with the cost and bar
            return { svg, chips, items, cost, meter, note, card, acts };  // hands back the parts so render() can update them
          };  // ends mkLane()
          const A = mkLane('A', 'A · Mode switch only', 'Clock tick; P1 has time left in its slice', A_ACTS, 1);  // A: lane A, a mode switch only, its actions in one column
          const B = mkLane('B', 'B · Mode switch + process switch', 'Clock tick; P1’s time slice is used up', B_ACTS, 2);  // B: lane B, a mode switch plus a process switch, its actions in two columns
          const drawGantt = (L, cells, t) => {  // drawGantt(L, cells, t): draws lane L's timeline up to time t as a Gantt chart (a bar chart over time); cells(c) says who owns unit c
            /* the empty timeline, then one bar per run of the same owner, labelled P1, kernel or P2 */
            const kids = [s('rect', { x: X0, y: 20, width: NC * CW, height: 26, rx: 5, class: 's-panel', 'stroke-width': 1.2, 'stroke-dasharray': '4 3' })];  // kids: the drawing parts, starting with the empty dashed timeline
            for (let c = 0; c < t;) {  // walks along the time units up to t
              let e = c; while (e + 1 < t && cells(e + 1) === cells(c)) e++;  // e: stretches forward to the last unit that has the same owner, so one bar covers the whole run
              const os = cells(c) === 'OS', x = cellX(c) + 1, w = cellX(e + 1) - cellX(c) - 2;  // os: whether this run belongs to the OS; x and w: the bar's position and width
              kids.push(s('rect', { x, y: 20, width: w, height: 26, rx: 5, class: os ? 's-os' : 's-proc', 'stroke-width': 1.8 }));  // the bar, in OS or process colours
              if (e > c && w >= 24) kids.push(s('text', { x: x + w / 2, y: 38, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:' + (os ? 'var(--os)' : 'var(--proc)') }, os ? (w >= 48 ? 'kernel' : 'OS') : cells(c)));  // a label inside the bar when it is wide enough: "kernel" or "OS", or the process name
              c = e + 1;  // jumps to the first unit after this run
            }  // ends the walk along the timeline
            for (let c = 0; c <= NC; c += 4) kids.push(s('line', { x1: cellX(c), y1: 47, x2: cellX(c), y2: 51, class: 's-line', 'stroke-width': 1.2 }), s('text', { x: cellX(c), y: 64, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(c)));  // tick marks and numbers every 4 units under the timeline
            kids.push(s('path', { d: `M${cellX(4) - 6},4 L${cellX(4) + 6},4 L${cellX(4)},14 Z`, style: 'fill:var(--intr)' }),  // a red triangle at time 4 marking the clock interrupt
              s('text', { x: cellX(4) + 10, y: 14, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--intr)' }, 'clock interrupt'));  // its "clock interrupt" label
            kids.push(s('line', { x1: cellX(t), y1: 16, x2: cellX(t), y2: 50, stroke: 'var(--accent)', 'stroke-width': 2.5 }));  // an accent line at time t, marking "now"
            L.svg.replaceChildren(...kids);  // replaces the old drawing with the new parts
          };  // ends drawGantt()
          const chip = (cls, t) => h('span', { class: 'chip ' + cls }, t);  // chip(cls, t): makes a small coloured label
          const drawLane = (L, f, doneAt) => {  // drawLane(L, f, doneAt): ticks lane L's actions that are finished by frame f and returns the OS work so far
            let units = 0;  // units: the OS work added up so far
            L.items.forEach((it, k) => {  // goes over each action line
              const d = f >= k + 1 && k < doneAt + 1;  // d: action k counts from frame k + 1 on, as long as it is one of this lane's actions (k up to doneAt)
              it.className = 'act' + (f === k + 1 ? ' cur' : d ? ' done' : '');  // class: cur while the action is happening in this frame, done once it is past
              it.firstChild.textContent = d ? '✓' : '';  // a tick for done actions
              if (d) units += L.acts[k][1];  // adds the action's cost to the total
            });  // ends the loop over actions
            L.cost.textContent = `OS work: ${units} unit${units === 1 ? '' : 's'}`;  // the cost text, with "unit" or "units" as needed
            L.meter.firstChild.style.width = (units / 13) * 100 + '%';  // the bar's width compares this total with lane B's full 13 units
            return units;  // returns the total
          };  // ends drawLane()
          const render = (f) => {  // render(f): draws frame f; the player calls it and shows the caption it returns
            const t = T[f];  // t: the time reached at this frame
            /* lane A: P1 0-3, OS 4-6, P1 after */
            drawGantt(A, (c) => (c >= 4 && c <= 6 ? 'OS' : 'P1'), t);  // lane A's timeline: the kernel owns units 4-6, P1 the rest
            drawGantt(B, (c) => (c < 4 ? 'P1' : c <= 16 ? 'OS' : 'P2'), t);  // lane B's timeline: P1 before unit 4, the OS from 4 to 16, then P2
            drawLane(A, f, 2);  // ticks lane A's actions (three of them, last index 2)
            drawLane(B, f, 8);  // ticks lane B's actions (nine of them, last index 8)
            const aK = f >= 1 && f <= 2, bK = f >= 1 && f <= 8;  // aK, bK: whether lane A or lane B is in kernel mode in this frame
            A.chips.replaceChildren(chip(aK ? 'os' : 'proc', 'mode: ' + (aK ? 'kernel' : 'user')), chip(aK ? 'os' : 'cpu', 'CPU runs: ' + (aK ? 'OS' : 'P1')), chip('proc', 'P1: Running'), chip('', 'P2: Ready'));  // lane A's chips: mode, what the CPU runs, P1 Running and P2 Ready
            B.chips.replaceChildren(chip(bK ? 'os' : 'proc', 'mode: ' + (bK ? 'kernel' : 'user')), chip(bK ? 'os' : 'cpu', 'CPU runs: ' + (f >= 9 ? 'P2' : bK ? 'OS' : 'P1')),  // lane B's chips: mode, and whether the CPU runs P1, the OS or P2
              chip(f >= 4 ? '' : 'proc', 'P1: ' + (f >= 4 ? 'Ready' : 'Running')), chip(f >= 7 ? 'proc' : '', 'P2: ' + (f >= 7 ? 'Running' : 'Ready')));  // P1 becomes Ready and P2 Running as lane B's switch goes on
            A.note.innerHTML = f >= 3 ? '<div class="callout tip m0" data-label="Notice">P1 never left the Running state. Only the <b>mode</b> changed: into the kernel and straight back. That is why a mode switch is cheap.</div>' : '';  // lane A's note from frame 4: P1 never left Running, only the mode changed
            B.note.innerHTML = f >= 10 ? '<div class="small muted">Every one of steps 1–7 touches memory the OS must read or write. The next step shows them one by one.</div>' : '';  // lane B's note at the end: every step touches memory, and the next screen shows each one
            return CAP[f];  // hands the caption for this frame to the player
          };  // ends render()
          const legend = h('div', { class: 'row small', style: { gap: '14px' } },  // legend: the colour key above the lanes
            h('span', { html: '<span class="legend-sq" style="background:var(--proc-bg);border-color:var(--proc)"></span>a process running its own code (user mode)' }),  // key item: a process running its own code in user mode
            h('span', { html: '<span class="legend-sq" style="background:var(--os-bg);border-color:var(--os)"></span>the OS working (kernel mode)' }),  // key item: the OS working in kernel mode
            h('span', { class: 'muted' }, 'Time in illustrative units'));  // a grey reminder that the time units are illustrative; closes the key
          const player = ctx.ui.player({ count: CAP.length, render, interval: 2600 });  // player: the guide's step player (Play, Pause, Back and Next plus a caption) that steps through 11 frames, 2.6 s apart
          const lanes = h('div', { class: 'grid-2 grow', style: { gap: '14px' } }, A.card, B.card);  // lanes: the two lane cards side by side

          /* ---- second view: add up the cost over 100 clock ticks (slider-driven) ---- */
          const MODE_COST = 3, SWITCH_COST = 13, TICKS = 100;  // the costs used by the calculator: 3 units per mode-switch tick, 13 per slice-ending tick, over 100 ticks
          const cells = Array.from({ length: TICKS }, () => h('i', { style: NW ? { height: '26px' } : {} }));  // cells: 100 small squares, one per clock tick (taller on phones)
          const tickGrid = h('div', { class: 'tickgrid', style: { gridTemplateColumns: `repeat(${NW ? 10 : 20}, minmax(0, 1fr))` } }, ...cells);  // tickGrid: the squares in rows of 20 (10 on phones), in time order
          const sum = h('div', { class: 'msg info' });  // sum: the message box that shows the arithmetic
          const meterMode = h('div', { class: 'meter grow' }, h('i', { style: { background: 'var(--os)' } }));  // meterMode: the bar for the cost if no tick ever ended a slice
          const meterSw = h('div', { class: 'meter grow' }, h('i', { style: { background: 'var(--warn)' } }));  // meterSw: the bar for the cost with the chosen slice length
          const lblMode = h('span', { class: 'small b', style: { width: NW ? '84px' : '92px', textAlign: 'right', whiteSpace: 'nowrap' } });  // lblMode: the number next to the first bar
          const lblSw = h('span', { class: 'small b', style: { width: NW ? '84px' : '92px', textAlign: 'right', whiteSpace: 'nowrap' } });  // lblSw: the number next to the second bar
          const paintTicks = (n) => {  // paintTicks(n): recolours the squares and redoes the sums for a slice of n ticks
            const sw = Math.floor(TICKS / n), only = TICKS - sw, work = sw * SWITCH_COST + only * MODE_COST;  // sw: whole slices that end (each a process switch); only: the other ticks; work: the total OS work in units
            cells.forEach((c, i) => { c.className = (i + 1) % n === 0 ? 'ps' : ''; });  // every n-th square turns amber (class ps), marking the tick that ends a slice
            const div = TICKS % n === 0 ? `100 ÷ ${n} = <b>${sw}</b>` : `100 ÷ ${n} = ${ctx.util.fmt(TICKS / n, 1)}, so <b>${sw}</b> whole slices end`;  // div: the division written out; when it is not exact, it shows the decimal and how many whole slices end
            say(sum, 'info', `${n === 1 ? 'Every tick' : `Every ${n}${['', '', 'nd', 'rd'][n] || 'th'} tick`} ends a time slice`,  // message title, such as "Every 5th tick ends a time slice", with the right ending (2nd, 3rd, 4th...)
              `${div} ⇒ ${sw} process switch${sw === 1 ? '' : 'es'}. The other 100 − ${sw} = <b>${only}</b> ticks are only a mode switch into the kernel and back.<br>OS work: ${sw} × ${SWITCH_COST} + ${only} × ${MODE_COST} = <b>${work} units</b>.`);  // message text: the number of process switches, the mode-switch-only ticks, and the total OS work worked out
            meterMode.firstChild.style.width = (TICKS * MODE_COST / (TICKS * SWITCH_COST)) * 100 + '%';  // the first bar: 300 units, measured against the worst case of 1,300
            meterSw.firstChild.style.width = (work / (TICKS * SWITCH_COST)) * 100 + '%';  // the second bar: the OS work for this slice length, against the same 1,300
            lblMode.textContent = TICKS * MODE_COST + ' units'; lblSw.textContent = work + ' units';  // the numbers beside the two bars
          };  // ends paintTicks()
          const slider = ctx.ui.slider({ label: 'Clock ticks per time slice', min: 1, max: 10, step: 1, value: 5, format: (v) => `${v} tick${v === 1 ? '' : 's'}`, onInput: (v) => paintTicks(+v) });  // slider: clock ticks per time slice, from 1 to 10, starting at 5; moving it redoes the sums
          const calc = h('div', { class: 'split fill', style: { display: 'none', gap: '18px' } },  // calc: the second view (the calculator), hidden until "100 clock ticks" is chosen
            h('div', { class: 'stack', style: { gap: '10px' } },  // calculator's left column, stacked top to bottom
              h('h3', { class: 'm0' }, 'Add it up over 100 clock ticks'),  // heading: add it up over 100 clock ticks
              h('p', { class: 'small m0', html: 'Suppose the only interrupts are clock ticks and every process uses its whole <span class="t">time slice</span>. Each tick costs a mode switch (3 units, as in lane A). The tick that ends a slice costs a full process switch instead (13 units, as in lane B).' }),  // paragraph: the assumptions, and the costs of 3 and 13 units taken from lanes A and B
              slider, sum,  // the slider and the arithmetic message
              h('div', { class: 'callout tip small m0', 'data-label': 'Try it', html: 'Drag to <b>1 tick</b>: every interrupt now ends a slice, so all 100 are process switches. Drag to <b>10 ticks</b>: only 10 are, and the OS work drops to 400 units.' }),  // try-it callout: drag to 1 tick and to 10 ticks and compare
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'Shorter slices mean more process switches, so more of the processor goes to OS work. Longer slices waste less, but every other process waits longer for its turn. Picking the slice is a balance.' })),  // why-it-matters callout: short slices waste more on switching, long slices make others wait; closes the column
            h('div', { class: 'card white stack', style: { gap: '10px' } },  // calculator's right column: a white card
              h('h4', { class: 'm0' }, 'The 100 clock interrupts in time order, one square each'),  // heading over the grid of 100 squares
              tickGrid,  // the grid of squares
              h('div', { class: 'row small', style: { gap: '14px' } },  // the key for the squares
                h('span', { html: '<span class="legend-sq" style="background:var(--os-bg);border-color:var(--os)"></span>mode switch only (3 units)' }),  // key item: mode switch only (3 units)
                h('span', { html: '<span class="legend-sq" style="background:var(--warn-bg);border-color:var(--warn)"></span>ends a slice: process switch (13 units)' })),  // key item: ends a slice, a process switch (13 units); closes the key
              h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'small', style: { width: NW ? '92px' : '172px' } }, NW ? 'No slice ends' : 'If no tick ended a slice'), meterMode, lblMode),  // bar row 1: a label (shorter on phones), the bar with no slice ends, and its number
              h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'small', style: { width: NW ? '92px' : '172px' } }, NW ? 'Your slice' : 'With your slice length'), meterSw, lblSw),  // bar row 2: a label, the bar for the chosen slice length, and its number
              h('p', { class: 'small muted m0', html: 'Why 13 and not 3 + 13? A slice-ending tick still enters the kernel, but it leaves by restoring <i>another</i> process instead of returning to the old one, so lane B’s 13 units already include the trip in.' })));  // a note on why a slice-ending tick costs 13 and not 3 + 13; closes the calculator
          paintTicks(5);  // fills in the calculator for the starting value of 5 ticks
          const view = ctx.ui.seg([{ value: 'one', label: 'One clock tick' }, { value: 'many', label: '100 clock ticks' }], 'one', (v) => {  // view: a switch between the one-tick animation and the 100-tick calculator
            const many = v === 'many';  // many: true when the calculator view is chosen
            if (many) player.stop();  // leaving the animation stops it if it was playing
            lanes.style.display = many ? 'none' : '';  // hides the two lanes in calculator view
            player.el.style.display = many ? 'none' : '';  // hides the player controls in calculator view
            legend.style.display = many ? 'none' : '';  // hides the lane key in calculator view
            calc.style.display = many ? '' : 'none';  // shows the calculator only in calculator view
            ctx.refit();  // asks the guide to re-check that the step still fits on the screen
          });  // ends the view switch's handler
          view.style.marginLeft = 'auto';  // pushes the view switch to the right end of its row
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the step as one full-height stack
            h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '10px' } }, legend, view),  // top row: the lane key and the view switch
            lanes, calc,  // the lanes and the calculator (only one is visible at a time)
            player.el));  // the player controls at the bottom; closes the stack
        },  // ends render() for step 6
      },  // closes step 6

      /* ============ 7. The seven steps of a process switch (animated) ============ */
      {  // opens step 7
        title: 'The seven steps of a process switch',  // step 7 title
        kind: 'explore',  // kind explore: a step for free clicking and exploring
        render(el, ctx) {  // render(el, ctx): builds the animated seven-step process switch when step 7 is shown
          const { h } = ctx;  // takes h, the element-building helper, out of ctx
          const REASONS = {  // REASONS: three reasons P1 may leave the CPU, each with its lane, new state, button label and texts
            timeout: { lane: 'ready', st: 'Ready', label: 'Time slice up', why: 'its time slice ran out',  // time slice up: P1 goes to the Ready lane
              trig: 'the <b>clock interrupt</b> fires: P1’s time slice is used up.', where: 'Ready queue', extra: 'It goes to the back of the line, behind P5.' },  // the trigger, destination and extra sentence for the time-slice case
            io: { lane: 'blocked', st: 'Blocked', label: 'Waits for disk', why: 'waiting for a disk read',  // waiting for the disk: P1 goes to the Blocked lane
              trig: 'P1 makes a <b>system call</b> to read from the disk, and it cannot continue until the data arrives.', where: 'queue of processes blocked on the disk', extra: 'It stays there until the disk’s interrupt announces that its data has arrived.' },  // the trigger, destination and extra sentence for the disk case
            suspend: { lane: 'rs', st: 'Ready/Suspend', label: 'Swapped out', why: 'swapped out to free memory',  // swapped out: P1 goes to the Ready/Suspend lane
              trig: 'a <b>clock interrupt</b> ends P1’s turn, and memory is so short that the OS decides to swap P1 out to disk.', where: 'Ready/Suspend queue', extra: 'Its memory image is written out to disk, freeing room for others.' },  // the trigger, destination and extra sentence for the swap case
          };  // closes REASONS
          const LIST = ['Enter the kernel (a mode switch)', 'Save the context of the processor', 'Update the PCB of the running process', 'Move that PCB to the right queue',  // LIST: the eight checklist lines beside the scene: entering the kernel, then the seven steps
            'Select another process to run', 'Update the PCB of the selected process', 'Update memory-management structures', 'Restore the context of the selected process'];  // the last four checklist lines; closes the list
          let reason = 'timeout';  // reason: the reason chosen, starting with the time slice
          const stateAt = (f, R) => {  // stateAt(f, R): works out the whole scene for frame f of the animation, for reason R
            const lanes = { run: ['P1'], ready: ['P2', 'P5'], blocked: ['P3'], rs: ['P4'] };  // the starting lanes: P1 running, P2 and P5 ready, P3 blocked, P4 ready/suspend
            if (f >= 4) { lanes.run = []; lanes[R.lane] = lanes[R.lane].concat('P1'); }  // from frame 4 (step 3) P1 leaves the Running lane and joins the end of its reason's lane
            if (f >= 6) { lanes.run = ['P2']; lanes.ready = lanes.ready.filter((x) => x !== 'P2'); }  // from frame 6 (step 5) P2 leaves the Ready queue and runs
            const cpu = f === 0 ? { pc: 'P1', sp: 'P1', regs: 'P1', mode: 'user' } : f === 1 ? { pc: 'OS', sp: 'OS', regs: 'P1', mode: 'kernel' }  // registers: frame 0 all P1's in user mode; frame 1 the PC and SP point into the OS while the others still hold P1's values
              : f < 8 ? { pc: 'OS', sp: 'OS', regs: 'OS', mode: 'kernel' } : { pc: 'P2', sp: 'P2', regs: 'P2', mode: 'user' };  // frames 2-7 all the OS's in kernel mode; frame 8 all P2's in user mode
            const HL = [[], ['cpu'], ['P1', 'cpu'], ['P1'], ['P1'], ['P2'], ['P2'], ['mem'], ['cpu', 'P2']];  // HL: which parts get the "changed" outline in each frame
            return {  // hands back the scene state for this frame
              lanes, cpu, mem: f >= 7 ? 'P2' : 'P1', arrow: f === 2 ? 'save' : f === 8 ? 'restore' : null, hl: HL[f],  // lanes, registers, the memory map (P2's from frame 7), the save arrow at frame 2, the restore arrow at frame 8, and outlines
              pcb: { P1: { st: f < 3 ? 'Running' : R.st, ctx: f < 2 ? 'cpu' : 'saved' }, P2: { st: f < 6 ? 'Ready' : 'Running', ctx: f < 8 ? 'saved' : 'cpu', sel: f === 5 } },  // P1's and P2's PCB states and where their contexts are; P2 gets the dashed "selected" outline at frame 5
            };  // closes the state object
          };  // ends stateAt()
          const caption = (f, R) => [  // caption(f, R): the caption for frame f, filled in for reason R
            `<b>Before.</b> P1 is Running in user mode, so the CPU registers hold P1’s values. P2 and P5 wait in the Ready queue. Then ${R.trig}`,  // frame 0 caption: before the switch, then what triggers it
            `<b>Into the kernel.</b> ${R.lane === 'blocked' ? 'The system call instruction hands control to the OS:' : 'When P1’s current instruction finishes, the processor notices the pending interrupt:'} the hardware saves P1’s program counter and PSW, sets the mode bit to kernel and jumps into the OS. So far this is only a mode switch: P1 is still the Running process.`,  // frame 1 caption: into the kernel by system call or interrupt; so far only a mode switch
            '<b>Step 1 · Save the context of the processor.</b> The OS copies P1’s program counter, stack pointer, PSW and other registers into P1’s PCB. Now the OS can use the registers without destroying anything.',  // frame 2 caption: step 1, save P1's context into its PCB
            `<b>Step 2 · Update the PCB of the running process.</b> P1’s state changes from Running to ${R.st}. The OS also records why (${R.why}) and adds the processor time P1 just used to its accounting fields.`,  // frame 3 caption: step 2, update P1's PCB with its new state and the reason
            `<b>Step 3 · Move the PCB to the right queue.</b> P1’s PCB joins the ${R.where}. ${R.extra}`,  // frame 4 caption: step 3, move P1's PCB to the right queue
            '<b>Step 4 · Select another process.</b> The scheduler looks at the Ready queue and picks P2, the process at its head. How it chooses is the job of scheduling, a topic of its own.',  // frame 5 caption: step 4, the scheduler picks P2
            '<b>Step 5 · Update the PCB of the selected process.</b> P2’s state changes from Ready to Running.',  // frame 6 caption: step 5, P2's PCB says Running
            '<b>Step 6 · Update the memory-management structures.</b> The memory map now points to P2’s <b>page table</b> (the table that turns a process’s addresses into real memory locations), so every address P2 uses reaches P2’s memory and nothing else.',  // frame 7 caption: step 6, the memory map switches to P2's page table
            '<b>Step 7 · Restore the context of the selected process.</b> P2’s saved program counter, stack pointer, PSW and registers are loaded back into the CPU. The mode bit is user again and P2 carries on exactly where it stopped.',  // frame 8 caption: step 7, P2's context is restored and it carries on
          ][f];  // picks frame f's caption from the list
          const scene = switchScene(ctx);  // scene: the shared process-switch drawing built by switchScene()
          const items = LIST.map((t, k) => h('div', { class: 'act', style: { padding: '4px 8px', fontSize: '14.5px' } }, h('span', { class: 'ck' }), h('span', { class: 'n' }, k ? String(k) : '·'), h('span', {}, t)));  // items: the checklist lines, each with a tick spot, a number (a dot for entering the kernel) and its text
          const render = (f) => {  // render(f): draws frame f; the player calls it and shows the caption it returns
            const R = REASONS[reason];  // R: the reason chosen with the switch
            scene.set(stateAt(f, R));  // redraws the scene for this frame
            items.forEach((it, k) => { it.className = 'act' + (f === k + 1 ? ' cur' : f > k + 1 ? ' done' : ''); it.firstChild.textContent = f > k + 1 ? '✓' : ''; });  // the checklist: the current line highlighted, earlier lines ticked
            return caption(f, R);  // returns the caption
          };  // ends render()
          const player = ctx.ui.player({ count: 9, render, interval: 2800 });  // player: the guide's step player running 9 frames, 2.8 s apart when playing
          const seg = ctx.ui.seg(Object.entries(REASONS).map(([value, r]) => ({ value, label: r.label })), reason, (v) => { reason = v; player.reset(); });  // seg: a switch between the three reasons; changing it restarts the animation at frame 0
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 1fr) 372px', gap: '20px' } },  // builds the layout: the scene beside a 372px side column (one column on phones)
            h('div', { class: 'card white stack', style: { gap: '10px' } }, scene.svg, SCENE_LEGEND(ctx), player.el),  // a white card with the scene, its colour key and the player
            h('div', { class: 'stack', style: { gap: '10px' } },  // the side column, stacked top to bottom
              h('div', {}, h('h4', { class: 'm0', style: { marginBottom: '6px' } }, 'Why is P1 leaving the CPU?'), seg),  // the heading "Why is P1 leaving the CPU?" with the reason switch under it
              h('div', { class: 'card tight stack', style: { gap: '2px' } }, ...items),  // the checklist card
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Thinking every interrupt means a process switch. Every interrupt causes a <b>mode switch</b>, but the OS often just returns to the process it interrupted.' }))));  // common-mistake callout: every interrupt is a mode switch, not always a process switch; closes the layout
        },  // ends render() for step 7
      },  // closes step 7

      /* ============ 8. Your turn: perform the switch in a safe order ============ */
      {  // opens step 8
        title: 'Your turn: perform a process switch',  // step 8 title
        kind: 'lab',  // kind lab: a hands-on step
        core: true,  // core: keeps this step on the shorter core path
        render(el, ctx) {  // render(el, ctx): builds the "perform the switch yourself" lab when step 8 is shown
          const { h } = ctx;  // takes h, the element-building helper, out of ctx
          const LABEL = [null, 'Save the context of the processor', 'Update the PCB of the running process', 'Move that PCB to the appropriate queue',  // LABEL: the seven step names, numbered 1 to 7 (slot 0 is unused)
            'Select another process to run', 'Update the PCB of the selected process', 'Update memory-management structures', 'Restore the context of the selected process'];  // the names of steps 4 to 7; closes the list
          const DID = [null,  // DID: what each step did, shown after a correct pick (slot 0 is unused)
            'P1’s program counter, stack pointer, PSW and other registers are now safe in its PCB. The OS can use the registers freely.',  // step 1 done: P1's registers are safe in its PCB
            'P1’s PCB now says <b>Blocked</b>, with the reason (waiting for disk block 812) and the processor time it used.',  // step 2 done: P1's PCB says Blocked, with the reason and time used
            'P1’s PCB joins the queue of processes blocked on the disk. When the disk interrupt reports the data has arrived, the OS will move it to Ready.',  // step 3 done: P1's PCB is in the disk queue
            'The scheduler looks at the Ready queue and picks <b>P2</b>, the process at its head.',  // step 4 done: the scheduler picked P2
            'P2’s PCB now says <b>Running</b>.',  // step 5 done: P2's PCB says Running
            'The memory map now points to P2’s page table, so P2’s addresses reach P2’s memory and nothing else.',  // step 6 done: the memory map points to P2's page table
            'P2’s saved registers are back in the CPU, the mode bit is user, and P2 carries on exactly where it stopped.',  // step 7 done: P2's registers are back and it carries on
          ];  // closes DID
          const DEPS = { 1: [], 2: [1], 3: [2], 4: [3], 5: [4], 6: [4], 7: [5, 6] };  // DEPS: the steps that must be done before each step; 5 and 6 both need only 4, so either may come first, and 7 needs both
          const SHOWN = [4, 1, 7, 3, 6, 2, 5];  // SHOWN: the mixed-up order in which the step buttons appear
          const HL = [[], ['P1', 'cpu'], ['P1'], ['P1'], ['P2'], ['P2'], ['mem'], ['cpu', 'P2']];  // HL: the parts outlined as changed after each step
          let D = new Set(), last = 0, slips = 0, bad = false;  // D: the set of finished steps; last: the latest one; slips: wrong picks; bad: true during the brief lost-context warning
          const scene = switchScene(ctx);  // scene: the shared process-switch drawing built by switchScene()
          const stateFrom = () => {  // stateFrom(): builds the scene state from the steps finished so far
            const lanes = { run: ['P1'], ready: ['P2', 'P5'], blocked: ['P3'], rs: ['P4'] };  // the starting lanes: P1 running, P2 and P5 ready, P3 blocked, P4 ready/suspend
            if (D.has(3)) { lanes.run = []; lanes.blocked = ['P3', 'P1']; }  // after step 3, P1 leaves the Running lane and joins the disk queue behind P3
            if (D.has(5)) { lanes.run = ['P2']; lanes.ready = ['P5']; }  // after step 5, P2 leaves the Ready queue and runs
            const cpu = D.has(7) ? { pc: 'P2', sp: 'P2', regs: 'P2', mode: 'user' } : { pc: 'OS', sp: 'OS', regs: D.has(1) ? 'OS' : 'P1', mode: 'kernel' };  // registers: P2's in user mode after step 7; before that the OS's in kernel mode, though Regs keeps P1's values until step 1
            return {  // hands back the scene state
              lanes, cpu, mem: D.has(6) ? 'P2' : 'P1', arrow: last === 1 ? 'save' : last === 7 ? 'restore' : null, hl: bad ? [] : HL[last], cpuBad: bad,  // lanes, registers, memory map, the save or restore arrow for the latest step, outlines (none during the warning) and the red CPU warning
              pcb: { P1: { st: D.has(2) ? 'Blocked' : 'Running', ctx: D.has(1) ? 'saved' : 'cpu' }, P2: { st: D.has(5) ? 'Running' : 'Ready', ctx: D.has(7) ? 'cpu' : 'saved', sel: D.has(4) && !D.has(5) } },  // P1's and P2's PCB states and where their contexts are; P2 shows as selected after step 4 until step 5
            };  // closes the state object
          };  // ends stateFrom()
          const fb = h('div', { class: 'msg', style: { minHeight: '92px' } });  // fb: the feedback message box
          const progress = h('span', { class: 'small b muted' });  // progress: the "n of 7 steps" line
          const btns = SHOWN.map((k) => { const b = h('button', { class: 'btn stepbtn', type: 'button', style: { fontSize: '14.5px' }, onclick: () => choose(k) }, h('span', { class: 'num' }, '?'), h('span', {}, LABEL[k])); b.k = k; return b; });  // btns: one button per step in SHOWN order, each with a "?" badge and its name; clicking tries step k
          const draw = () => {  // draw(): redraws the scene and the buttons
            scene.set(stateFrom());  // redraws the scene from the steps done
            btns.forEach((b) => { const d = D.has(b.k); b.classList.toggle('done', d); b.querySelector('.num').textContent = d ? String(b.k) : '?'; });  // finished steps' buttons turn green and show their number
            progress.textContent = `${D.size} of 7 steps · wrong picks: ${slips}`;  // the progress line: steps done and wrong picks
          };  // ends draw()
          const whyNot = (k) => {  // whyNot(k): returns [title, explanation] saying why step k cannot be done yet
            if (!D.has(1)) return k === 7  // before the context is saved, restoring P2's (step 7) would be a disaster
              ? ['Disaster averted', 'Loading P2’s values now would overwrite the registers, which still hold P1’s unsaved values. P1’s work in progress would be lost for good and it could never resume. (Nothing was changed: try again.)']  // the disaster message: P1's unsaved register values would be overwritten for good
              : ['Save first', 'Every instruction the OS runs uses the registers, and right now they still hold P1’s values. Unless those are copied into P1’s PCB before anything else, they get overwritten and P1 can never resume where it stopped.'];  // any other step before saving: save first, because the OS's own work overwrites the registers
            if (k === 3) return ['Update the PCB first', 'P1’s PCB still says Running. Filing a PCB marked Running in the Blocked queue would leave the OS’s records contradicting themselves.'];  // step 3 before step 2: a PCB that still says Running must not go in the Blocked queue
            if (k === 4) return ['Finish with P1 first', 'P1’s PCB must be updated and filed in its queue, so the scheduler chooses from an up-to-date picture of who is waiting where.'];  // step 4 before step 3: finish P1's paperwork so the scheduler sees an up-to-date picture
            if (k === 5 || k === 6) return ['Select a process first', k === 5 ? 'Update which PCB? No process has been chosen to run yet.' : 'Switch the memory map to whose memory? No process has been chosen to run yet.'];  // step 5 or 6 before step 4: no process has been chosen yet
            if (k === 7) {  // step 7 too early
              if (!D.has(4)) return ['Restore whose context?', 'No process has been chosen yet. Restoring is always the very last step, because it hands the processor over.'];  // no process chosen yet, so there is no context to restore
              return ['Not yet', `Restoring the context hands the processor to P2 at once. ${!D.has(6) ? 'P1’s memory map is still in force, so P2’s addresses would land in P1’s memory. ' : ''}${!D.has(5) ? 'P2’s PCB still says Ready, so the records would be wrong. ' : ''}Finish the bookkeeping first.`];  // chosen but the bookkeeping is unfinished: names what is still missing (memory map, PCB)
            }  // ends the step 7 case
            return ['Not yet', 'Something must happen before this step.'];  // a general message for any other case
          };  // ends whyNot()
          const choose = (k) => {  // choose(k): runs when the button for step k is clicked
            if (D.has(7)) { say(fb, 'info', 'Switch complete', 'Press <b>Start over</b> to try again.'); return; }  // once the switch is complete, a click just says so
            if (D.has(k)) { say(fb, 'info', 'Already done', `“${LABEL[k]}” is finished. What comes next?`); return; }  // clicking a finished step asks for the next one instead
            const b = btns.find((x) => x.k === k);  // b: the button that was clicked
            if (DEPS[k].every((d) => D.has(d))) {  // every step this one depends on is done, so it is allowed
              const early6 = k === 6 && !D.has(5);  // early6: step 6 before step 5, which is allowed but not the usual order
              D.add(k); last = k; bad = false;  // marks the step done, remembers it as the latest, and clears any warning
              draw();  // redraws the scene and buttons
              if (k === 7) say(fb, 'ok', `Switch complete, with ${slips} wrong pick${slips === 1 ? '' : 's'}`, `${DID[7]} All seven steps are done: P1 waits safely for the disk, and P2 runs.`);  // after step 7: switch complete, with the number of wrong picks
              else say(fb, 'ok', LABEL[k], DID[k] + (early6 ? ' <i>Fine: a real kernel may do this before or after updating P2’s PCB; the usual list updates the PCB first.</i>' : ''));  // other steps: the step name and what it did, with a note when 6 came before 5
              return;  // stops here
            }  // ends the allowed branch
            slips++;  // otherwise the pick was too early: count the slip
            const [t, msg] = whyNot(k);  // gets the title and explanation for this mistake
            b.classList.add('bad'); ctx.after(700, () => b.classList.remove('bad'));  // the button flashes red for 0.7 s
            if (k === 7 && !D.has(1)) { bad = true; draw(); ctx.after(900, () => { bad = false; draw(); }); } else draw();  // restoring before saving turns the CPU red for 0.9 s to show the lost context; nothing really changes
            say(fb, 'bad', t, msg);  // shows why the step cannot happen yet
          };  // ends choose()
          const reset = () => { D = new Set(); last = 0; slips = 0; bad = false; draw(); say(fb, 'info', 'The OS is in kernel mode. What first?', 'Click the seven steps in an order that keeps both processes safe. A wrong pick changes nothing, but you will see what it would have broken.'); };  // reset(): clears every step and slip, redraws, and asks what the OS does first
          reset();  // sets up the lab when the step opens
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 1fr) 400px', gap: '20px' } },  // builds the layout: the scene beside a 400px column of buttons (one column on phones)
            h('div', { class: 'card white stack', style: { gap: '10px' } }, scene.svg, SCENE_LEGEND(ctx), fb),  // a white card with the scene, its colour key and the feedback box
            h('div', { class: 'stack', style: { gap: '8px' } },  // the side column, stacked top to bottom
              h('p', { class: 'm0', html: 'P1 just made a <span class="t">system call</span> to read the disk, so it must wait. The OS is already in kernel mode. <b>Switch the processor to P2</b> safely.' }),  // paragraph: P1 made a system call to read the disk; switch the processor to P2 safely
              ...btns,  // the seven step buttons
              h('div', { class: 'callout tip small m0', 'data-label': 'Tip', html: 'Before each click, ask: <i>what would be lost or wrong if I did this now?</i>' }),  // tip callout: ask what would be lost or wrong before each click
              h('div', { class: 'row nw', style: { justifyContent: 'space-between', marginTop: 'auto' } }, progress, h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Start over')))));  // the progress line and Start over; closes the layout
        },  // ends render() for step 8
      },  // closes step 8

      /* ============ 9. Recap ============ */
      {  // opens step 9
        title: 'Recap: six ideas about process control',  // step 9 title
        kind: 'recap',  // kind recap: the summary step, always kept on the core path
        render(el, ctx) {  // render(el, ctx): builds the recap cards and the summary strip when step 9 is shown
          const { h } = ctx;  // takes h, the element-building helper, out of ctx
          const arrow = () => h('span', { class: 'muted b', style: { fontSize: '20px', alignSelf: 'center' } }, '→');  // arrow(): a large grey arrow for the summary strip
          const flow = h('div', { class: 'row nw', style: { gap: '8px', alignItems: 'stretch' } },  // flow: the summary strip in one row: event, mode switch, the OS decides, then one of two outcomes
            h('div', { class: 'box intr small', style: { flex: '1' }, html: '<b>An event</b><br>interrupt, trap or supervisor call' }), arrow(),  // strip box: an event (interrupt, trap or supervisor call)
            h('div', { class: 'box os small', style: { flex: '1' }, html: '<b>Mode switch</b><br>save PC + PSW, enter the kernel' }), arrow(),  // strip box: the mode switch that saves PC and PSW and enters the kernel
            h('div', { class: 'box small', style: { flex: '1' }, html: '<b>OS handles it</b><br>can the process carry on?' }), arrow(),  // strip box: the OS handles it and asks whether the process can carry on
            h('div', { class: 'stack', style: { flex: '1.5', gap: '6px' } },  // a small stack holding the two outcomes
              h('div', { class: 'box proc small', html: '<b>Yes:</b> return to it (mode switch back)' }),  // outcome yes: return to the same process with a mode switch back
              h('div', { class: 'box cpu small', html: '<b>No:</b> full process switch, 7 steps' })));  // outcome no: a full seven-step process switch; closes the strip
          if (ctx.narrow) { flow.className = 'stack'; flow.querySelectorAll('.muted.b').forEach((a) => a.remove()); }  // on phones the strip becomes a vertical stack and its arrows are removed
          el.append(h('div', { class: 'stack fill', style: { gap: '14px' } },  // builds the step as one full-height stack
            h('p', { class: 'lead m0' }, 'Say each answer aloud, then flip. The strip below ties it together; next, section 3.5 asks where OS code itself runs.'),  // lead paragraph: say each answer aloud, and a pointer to section 3.5
            ctx.ui.flipcards([  // the guide's flip cards: each shows a prompt and turns over to its answer when clicked
              ['User mode vs kernel mode', 'User mode: ordinary programs; no privileged instructions, no protected memory. Kernel (system, control) mode: the OS kernel; anything goes. The mode bit in the PSW records which.'],  // card: user mode versus kernel mode, and the mode bit
              ['How does the mode change?', 'User → kernel only through an interrupt, a trap or a system call, each entering the OS at a fixed address. Kernel → user when the OS executes a return instruction.'],  // card: how the mode changes in each direction
              ['The kernel’s four job families', 'Process management, memory management, I/O management, and support functions such as interrupt handling, accounting and monitoring.'],  // card: the kernel's four job families
              ['Creating a process: five steps', '1 assign a unique PID · 2 allocate space for the image · 3 initialize the PCB · 4 set the linkages (e.g. the Ready list) · 5 create or expand other structures.'],  // card: the five steps of creating a process
              ['Three ways the OS gets control', 'Interrupt: from outside the instruction (clock, I/O, memory fault). Trap: an error in the instruction. Supervisor call: the program asks.'],  // card: the three ways the OS gets control
              ['Mode switch vs process switch', 'Mode switch: into the kernel and back; the same process keeps running. Process switch: save context, update PCB, queue it, select, update PCB, memory map, restore.'],  // card: mode switch versus process switch
            ], { cols: 3, height: 142 }),  // closes the card list; three columns of cards, each 142px tall
            h('div', { class: 'card', style: { marginTop: 'auto' } }, h('h4', {}, 'The big picture in one strip'), flow)));  // a card at the bottom holding the summary strip; closes the stack
        },  // ends render() for step 9
      },  // closes step 9

      /* ============ 10. Check yourself ============ */
      {  // opens step 10
        title: 'Check yourself',  // step 10 title
        kind: 'check',  // kind check: the quiz step; the guide saves the best first-try score for this section
        quiz: [  // quiz: the questions, run by the guide's quiz engine; type picks the format, and no type means multiple choice
          { q: 'Which of these can a program running in <b>user mode</b> do on its own, without trapping to the OS?',  // quiz question 1 (multiple choice): what a user-mode program may do without trapping
            choices: ['Add two numbers held in its own registers', 'Disable interrupts', 'Set the mode bit to kernel', 'Write into another process’s PCB'], answer: 0,  // its four choices; answer 0: adding its own registers
            feedback: [null, 'Disabling interrupts is a privileged instruction: a program that could do it would never be interrupted, so it could keep the processor forever.',  // feedback for choosing "disable interrupts"
              'User code can never flip the mode bit directly. Only an interrupt, a trap or a system call switches the processor to kernel mode.',  // feedback for choosing "set the mode bit"
              'PCBs live in the OS’s protected memory, so the access is refused and traps.'],  // feedback for choosing "write another process's PCB"; closes the feedback list
            why: 'Arithmetic on a program’s own registers harms nobody, so user mode allows it. Anything that could take control away from the OS or reach its tables is privileged or protected.' },  // why: harmless work is allowed, anything that threatens the OS is not
          { type: 'tf', q: 'The processor keeps track of whether it is in user mode or kernel mode with a bit in the program status word (PSW).', answer: true,  // quiz question 2 (true or false): the mode bit lives in the PSW (true)
            why: 'The mode bit lives in the PSW. The hardware checks it before every privileged instruction and every access to protected memory.' },  // why: the hardware checks it before privileged instructions and protected accesses
          { type: 'multi', q: 'Which of these switch the processor from user mode to kernel mode?',  // quiz question 3 (pick all that apply): what switches user mode to kernel mode
            choices: ['A clock interrupt', 'A system call', 'A divide-by-zero trap', 'A return-from-interrupt instruction', 'Adding two registers'], answer: [0, 1, 2],  // five choices; the interrupt, the system call and the trap are right
            why: 'Interrupts, traps and system calls all enter the kernel at a pre-arranged address. The return instruction goes the other way, kernel to user, and ordinary arithmetic changes nothing.' },  // why: all three enter the kernel at a fixed address; the return goes the other way
          { type: 'bucket', q: 'Sort these kernel functions into their family: <b>process</b>, <b>memory</b> or <b>I/O</b> management, or <b>support</b> functions.', buckets: ['Process', 'Memory', 'I/O', 'Support'],  // quiz question 4 (sort into buckets): kernel functions into four families, with the bucket names
            items: [['Scheduling and dispatching', 0], ['Swapping', 1], ['Buffer management', 2], ['Interrupt handling', 3], ['Assigning devices to processes', 2]],  // the five functions, each with its right bucket
            why: 'Process management runs the life of processes; memory management decides what lives where in memory; I/O management shares devices and moves data; support functions such as interrupt handling and accounting serve the rest.' },  // why: a one-line summary of each family
          { type: 'order', q: 'Put the steps the OS takes to <b>create a process</b> in order.',  // quiz question 5 (put in order): the five steps of creating a process
            items: ['Assign a unique process identifier', 'Allocate space for the process image', 'Initialize the process control block', 'Set the linkages, such as putting it in the Ready list', 'Create or expand other data structures, such as accounting records'],  // the five steps, listed in the right order (the quiz shuffles them)
            why: 'Identity first (PID and process-table entry), then space for the image, then the PCB inside it is filled in, then the process is linked into a queue where the scheduler can find it, and finally extra bookkeeping.' },  // why: identity, space, PCB, queue, then extra bookkeeping
          { q: 'When the OS initializes a brand-new process’s PCB, which set of values is typical?',  // quiz question 6 (multiple choice): the typical values in a brand-new PCB
            choices: ['State Ready, program counter at the program’s entry point, no resources owned yet', 'State Running, registers copied from the parent, all of the parent’s open files',  // choices a and b: Ready with the entry point, or Running with the parent's registers
              'State Blocked until the user types something, program counter at 0', 'State Exit, so the scheduler ignores it until the linkages are set'], answer: 0,  // choices c and d: Blocked, or Exit; answer 0
            feedback: [null, 'A new process is not Running yet: it waits in a queue until the dispatcher picks it. (Some systems do let a child inherit things such as open files from its parent, but the new PCB never starts in the Running state.)', 'Nothing is being waited for, so it is not Blocked. It is Ready (or Ready/Suspend if it starts on disk), and its program counter points at the program’s entry point.', 'Exit is for processes that have finished, not ones about to start.'],  // feedback for each wrong choice
            why: 'Most processor-state fields start at zero, the program counter points to the entry point and the stack pointer to the new stack. The state is Ready (or Ready/Suspend), since the OS admits the process as it creates it; the priority is the default, and it owns no resources unless it asked for some or inherits them from its parent.' },  // why: zeros except PC and SP, state Ready (or Ready/Suspend), default priority, no resources
          { type: 'match', q: 'Match each event to what hands control to the OS.',  // quiz question 7 (match): each event to what hands control to the OS
            pairs: [['The timer signals that a time slice is over', 'Clock interrupt'], ['A program asks the OS to open a file', 'Supervisor call'], ['An instruction tries to divide by zero', 'Trap'],  // first three pairs: timer, open a file, divide by zero
              ['A program refers to code that is not yet in main memory', 'Memory fault'], ['A disk controller reports a finished transfer', 'I/O interrupt']],  // last two pairs: code not in memory, disk transfer finished
            why: 'Interrupts (clock, I/O, memory fault) come from outside the current instruction, a trap comes from an error in it, and a supervisor call is a deliberate request.' },  // why: interrupts come from outside the instruction, traps from errors in it, calls are requests
          { type: 'tf', q: 'Every interrupt causes a process switch.', answer: false,  // quiz question 8 (true or false): every interrupt causes a process switch (false)
            why: 'Every interrupt causes a mode switch into the kernel. If the interrupted process can carry on, for example because its time slice is not used up, the OS simply returns to it.' },  // why: every interrupt is a mode switch; often the OS just returns
          { type: 'order', q: 'Put the seven steps of a full <b>process switch</b> in order.',  // quiz question 9 (put in order): the seven steps of a process switch
            items: ['Save the context of the processor', 'Update the PCB of the running process', 'Move that PCB to the appropriate queue', 'Select another process to run',  // steps 1 to 4
              'Update the PCB of the selected process', 'Update memory-management data structures', 'Restore the context of the selected process'],  // steps 5 to 7
            why: 'Save first so nothing is overwritten, finish the old process’s paperwork, choose, prepare the new process and its memory map, and restore its registers last because that hands over the processor.' },  // why: save first, finish the old process, choose, prepare the new one, restore last
          { q: 'Why is a mode switch much cheaper than a process switch?',  // quiz question 10 (multiple choice): why a mode switch is much cheaper than a process switch
            choices: ['Only a little processor state is saved and the same process continues, so no process states, queues or memory maps change', 'A mode switch does not involve the kernel at all',  // choices a and b
              'A mode switch runs on a separate processor', 'The hardware saves nothing at all during a mode switch'], answer: 0,  // choices c and d; answer 0
            feedback: [null, 'It does: a mode switch is exactly the move into (and out of) the kernel.', 'No second processor is involved; the same processor changes mode.', 'The hardware does save a little state (at least the program counter and PSW) so it can return.'],  // feedback for each wrong choice
            why: 'A mode switch saves and restores a small amount of state. A process switch also rewrites two PCBs, moves queue entries, runs the scheduler, changes the memory map, and leaves the caches full of the old process’s data.' },  // why: a process switch also rewrites PCBs, queues and the memory map, and cools the caches
          { type: 'mc', q: 'A program executes an instruction that divides by zero and the OS treats it as fatal. What happens to the process?',  // quiz question 11 (multiple choice, type written out): what happens after a fatal divide by zero
            choices: ['It moves to Exit and another process is dispatched', 'It moves to Blocked until the error clears', 'It keeps running in kernel mode', 'It is moved to the Ready queue to try again later'], answer: 0,  // its four choices; answer 0: Exit, and another process runs
            feedback: [null, 'Blocked is for waiting on an event; there is nothing to wait for.', 'User programs never continue in kernel mode; the OS takes over.', 'A fatal error ends the process rather than retrying it.'],  // feedback for each wrong choice
            why: 'A trap enters the OS. If the error is fatal the OS terminates the process (Exit) and switches to another process; a recoverable trap may let it continue.' },  // why: a fatal trap ends the process; a recoverable one may let it go on
          { type: 'num', q: 'The timer interrupts every 2 ms, the time slice is 10 ms, and every process always uses its full slice. Out of every 100 clock interrupts, how many cause <b>only</b> a mode switch (no process switch)?',  // quiz question 12 (type a number): with a 2 ms tick and a 10 ms slice, how many of 100 interrupts are mode switches only
            answer: 80, tol: 0, unit: 'interrupts',  // the answer is exactly 80, shown with the unit "interrupts"
            why: 'A slice lasts 10 ÷ 2 = 5 ticks, so every 5th interrupt ends a slice and triggers a process switch: 100 ÷ 5 = 20. The other 100 − 20 = 80 are handled with a mode switch into the kernel and straight back.' },  // why: 5 ticks per slice gives 20 process switches, leaving 80
        ],  // closes the quiz list
      },  // closes step 10
    ],  // closes the list of steps

    notes: `${/* notes: the section's reference text, opened with the Notes button in the top bar */''}
      <h3>Process control: how the OS stays in charge</h3>${/* heading for the notes: how the OS stays in charge */''}
      <p>While a program runs, the processor executes its instructions, not the OS’s. The OS keeps control through hardware <b>privilege</b> (two processor modes), careful <b>creation</b> of every process, and the power to take the processor back and <b>switch</b> it to another process.</p>${/* notes paragraph: privilege, creation and switching */''}

      <h4>1. Modes of execution</h4>${/* notes part 1 heading: modes of execution */''}
      <ul>${/* starts the list about modes */''}
        <li><b>User mode</b> (less privileged): ordinary programs run here. They cannot execute <b>privileged instructions</b> (disable interrupts, set the timer, start I/O, halt, change the mode) or touch <b>protected memory</b> such as the OS’s tables.</li>${/* list item: user mode and what it forbids */''}
        <li><b>Kernel mode</b> (also <b>system mode</b> or <b>control mode</b>, more privileged): the OS kernel runs here and may execute any instruction and reach any memory. The OS uses privileged instructions itself: it sets the timer before dispatching a process, and halts the processor only when nothing is Ready.</li>${/* list item: kernel mode, its other names, and how the OS uses privileged instructions */''}
        <li><b>Why two modes?</b> The OS’s data, such as every PCB and the process table, must be protected. If any program could rewrite them or switch off the clock, one bug or one attacker could take over the machine.</li>${/* list item: why two modes are needed */''}
        <li><b>How the processor knows:</b> a <b>mode bit</b> in the <b>program status word (PSW)</b>, checked before every privileged instruction and protected access. A violation causes a <b>trap</b>, and the OS usually ends the offending process.</li>${/* list item: the mode bit in the PSW, and the trap on a violation */''}
        <li><b>How the mode changes:</b> user → kernel only on an <b>interrupt</b>, a <b>trap</b> or a <b>system call</b>, each entering the OS at an address fixed in advance. (The processor checks for a pending interrupt at the end of every instruction.) Kernel → user when the OS executes a return instruction that restores the saved PSW. A system call (supervisor call) is the legal way to get privileged work done: the program asks and the OS does the work.</li>${/* list item: how the mode changes in each direction, and the system call as the legal way in */''}
      </ul>${/* closes the list */''}

      <h4>2. What the kernel does</h4>${/* notes part 2 heading: what the kernel does */''}
      <p>The <b>kernel</b> is the core of the OS that stays in main memory and runs in kernel mode. Its typical functions:</p>${/* notes paragraph: what the kernel is */''}
      <table>${/* starts the table of the kernel's job families */''}
        <tr><th>Family</th><th>Typical functions</th></tr>${/* table header row: Family, Typical functions */''}
        <tr><td>Process management</td><td>creation and termination; scheduling and dispatching; process switching; synchronization and inter-process communication; managing PCBs</td></tr>${/* table row: process management */''}
        <tr><td>Memory management</td><td>allocating address space; swapping; page and segment management</td></tr>${/* table row: memory management */''}
        <tr><td>I/O management</td><td>buffer management; allocating I/O channels and devices to processes</td></tr>${/* table row: I/O management */''}
        <tr><td>Support functions</td><td>interrupt handling; accounting; monitoring</td></tr>${/* table row: support functions */''}
      </table>${/* closes the table */''}

      <h4>3. Creating a process: five steps, in order</h4>${/* notes part 3 heading: creating a process in five steps */''}
      <ol>${/* starts the numbered list of creation steps */''}
        <li><b>Assign a unique process identifier (PID)</b> and add an entry to the primary process table.</li>${/* creation step 1: assign a unique PID and add a process table entry */''}
        <li><b>Allocate space for the process</b>: every element of the process image (user address space for code and data, the stack(s), the PCB). Sizes come from defaults for that kind of program or from the creator’s request. If memory is full the image may start in the swap area on disk.</li>${/* creation step 2: allocate space for every part of the image */''}
        <li><b>Initialize the PCB.</b> Identification: PID, parent’s PID, user. Processor state: mostly zeros, except the program counter (program entry point) and stack pointers (new stacks). Process control: state = <b>Ready</b> (or <b>Ready/Suspend</b> if it starts on disk), default priority, no resources owned yet (unless requested or inherited from the parent).</li>${/* creation step 3: initialize the PCB's three groups */''}
        <li><b>Set the appropriate linkages</b>, e.g. link the PCB onto the Ready (or Ready/Suspend) list.</li>${/* creation step 4: set the linkages, such as the Ready list */''}
        <li><b>Create or expand other data structures</b>, e.g. an accounting record.</li>${/* creation step 5: create or expand other data structures */''}
      </ol>${/* closes the numbered list */''}
      <p>Why this order: no space without an identity, no PCB before its space exists, and no queue entry while the PCB is blank.</p>${/* notes paragraph: why the creation steps must come in this order */''}

      <h4>4. When can the OS switch processes?</h4>${/* notes part 4 heading: when the OS can switch processes */''}
      <table>${/* starts the table of the three mechanisms */''}
        <tr><th>Mechanism</th><th>Cause</th><th>Examples</th></tr>${/* table header row: Mechanism, Cause, Examples */''}
        <tr><td><b>Interrupt</b></td><td>an event outside the current instruction</td><td><b>Clock interrupt</b>: time slice used up → process to Ready, another runs. <b>I/O interrupt</b>: waiting processes move Blocked → Ready; the OS resumes the current process or preempts it for a more urgent one. <b>Memory fault</b>: a valid address not in main memory; the OS brings it in and blocks the process meanwhile.</td></tr>${/* table row: interrupts (clock, I/O, memory fault) and what each does to the process */''}
        <tr><td><b>Trap</b></td><td>an error or exception in the current instruction</td><td>Divide by zero, privileged instruction in user mode. <b>Fatal</b> (e.g. the program has no handler for it): process → Exit, another is dispatched. <b>Recoverable</b>: the OS recovers or informs the process, which may continue.</td></tr>${/* table row: traps, fatal or recoverable */''}
        <tr><td><b>Supervisor call</b></td><td>an explicit request by the program</td><td>Open a file, read data, ask the time. If the service must wait (e.g. a disk read) the process is Blocked; otherwise it continues.</td></tr>${/* table row: supervisor calls, and when they block the process */''}
      </table>${/* closes the table */''}

      <h4>5. Mode switch vs process switch</h4>${/* notes part 5 heading: mode switch versus process switch */''}
      <p>On an interrupt, trap or system call the hardware saves the program counter and PSW, sets the mode bit to kernel and jumps to the handler: a <b>mode switch</b>. The same process is still Running. If it can continue, the OS returns: PC and PSW are restored and the mode goes back to user. <b>Every interrupt causes a mode switch; only some cause a process switch.</b> A mode switch is cheap. A <b>process switch</b> also rewrites two PCBs, moves queue entries, runs the scheduler and changes the memory map, and the new process then runs slowly for a while because the caches hold the old process’s data.</p>${/* notes paragraph: what the hardware does on entry, and why a process switch costs so much more */''}

      <h4>6. The seven steps of a process switch</h4>${/* notes part 6 heading: the seven steps of a process switch */''}
      <ol>${/* starts the numbered list of switch steps */''}
        <li><b>Save the context of the processor</b> (PC, PSW, stack pointer, other registers) into the running process’s PCB. First, because the OS’s own code will overwrite the registers.</li>${/* switch step 1: save the context, first because OS code overwrites the registers */''}
        <li><b>Update the PCB of the running process</b>: new state (Ready, Blocked, Ready/Suspend or Exit), the reason, accounting such as time used.</li>${/* switch step 2: update the running process's PCB */''}
        <li><b>Move that PCB to the appropriate queue</b>: Ready, Blocked on event <i>i</i>, or Ready/Suspend.</li>${/* switch step 3: move that PCB to the right queue */''}
        <li><b>Select another process</b> to run.</li>${/* switch step 4: select another process */''}
        <li><b>Update the PCB of the selected process</b>: state = Running.</li>${/* switch step 5: update the selected process's PCB */''}
        <li><b>Update memory-management data structures</b> so addresses lead to the new process’s memory.</li>${/* switch step 6: update the memory-management structures */''}
        <li><b>Restore the context of the selected process</b> (mode bit back to user). Last, because it hands over the processor.</li>${/* switch step 7: restore the selected process's context, last because it hands over the processor */''}
      </ol>${/* closes the numbered list */''}
      <p>A bad order breaks things: restoring before saving destroys the old registers; queueing a PCB that still says Running leaves contradictory records; restoring before the memory map is switched lets the new process reach the old one’s memory.</p>${/* notes paragraph: what goes wrong when the steps are done in a bad order */''}

      <h4>Worked example</h4>${/* notes heading: a worked example */''}
      <p>The timer interrupts every 2 ms, the slice is 10 ms, and every process uses its whole slice. A slice lasts 10 ÷ 2 = 5 ticks, so of every 100 clock interrupts, 100 ÷ 5 = <b>20</b> cause a process switch and <b>80</b> cause only a mode switch. With illustrative costs of 3 units for a mode-switch-only tick and 13 for a slice-ending tick (13 already includes entering the kernel), OS work = 20 × 13 + 80 × 3 = <b>500 units</b> per 100 ticks; with 1 tick per slice it would be 100 × 13 = 1,300. Shorter slices mean more switching overhead; longer slices mean longer waits for everyone else. With a 1 ms tick and a 20 ms slice: 1,000 ÷ 20 = 50 switches per second, 950 mode-switch-only interrupts.</p>`,  // notes paragraph: the 2 ms tick, 10 ms slice arithmetic and the cost of short slices; end of the notes text
  });  // closes the section description and the Guide.section call
})();  // ends the wrapper function and runs it straight away
