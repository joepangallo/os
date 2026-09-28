/* =====================================================================
   Section 3.4 — Process Control
   The two processor modes and what the kernel does in kernel mode,
   the five steps of process creation, the three ways the OS regains
   control (interrupt, trap, supervisor call), and the difference
   between a cheap mode switch and a full seven-step process switch.
   Helpers live in the IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {
  /* ------------------------------------------------------------------
     Shared helpers
     ------------------------------------------------------------------ */
  /* Write a titled message into a feedback box (kinds: ok, bad, info, warn). */
  const say = (box, kind, title, html) => {
    box.className = 'msg ' + (kind || '');
    box.innerHTML = (title ? `<b>${title}</b>` : '') + (html || '');
  };

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
  const GEO = {
    wide: {
      vb: [680, 300], valX: 62, valW: 136, cpu: [6, 6, 202, 188],
      mem: { box: [6, 204, 202, 90], title: [18, 226], val: [18, 236, 178], sub: [18, 284] },
      lanes: { run: [222, 6, 452, 66, 464, 'Running', 'the process on the CPU'], ready: [222, 80, 452, 66, 234, 'Ready', 'queue'],
        blocked: [222, 154, 452, 66, 234, 'Blocked on', 'disk I/O'], rs: [222, 228, 452, 66, 234, 'Ready/', 'Suspend'] },
      slot: (ln, i) => [[344, 452, 560][i], { run: 6, ready: 80, blocked: 154, rs: 228 }[ln] + 5],
      save: ['M210,32 L336,32', 272, 24], restore: ['M340,50 L214,50', 276, 67],
    },
    /* narrow: 340 units wide so that 13-unit text still renders near 12 px on a phone;
       queue lanes carry a one-line label above a full-width row of PCB slots */
    narrow: {
      vb: [340, 542], valX: 58, valW: 136, cpu: [6, 6, 200, 188], oneLine: true,
      mem: { box: [6, 202, 328, 52], title: [18, 233], val: [168, 214, 158], sub: null },
      lanes: { run: [212, 6, 122, 188, 222, 'Running', 'on the CPU'], ready: [6, 262, 328, 86, 16, 'Ready', 'queue'],
        blocked: [6, 356, 328, 86, 16, 'Blocked', 'on disk I/O'], rs: [6, 450, 328, 86, 16, 'Ready/Suspend', 'queue'] },
      slot: (ln, i) => (ln === 'run' ? [221, 72] : [[12, 120, 228][i], { ready: 262, blocked: 356, rs: 450 }[ln] + 26]),
      save: ['M208,170 L248,134', 284, 162], restore: ['M248,134 L210,170', 288, 162],
    },
  };
  const REG_TXT = {
    pc: { P1: 'P1: 0x1A40', P2: 'P2: 0x0C18', OS: 'OS handler' },
    sp: { P1: 'P1’s stack', P2: 'P2’s stack', OS: 'kernel stack' },
    regs: { P1: 'P1’s values', P2: 'P2’s values', OS: 'OS scratch' },
  };
  const OTHERS = { P3: 'Blocked', P4: 'Ready/Suspend', P5: 'Ready' };
  function switchScene(ctx) {
    const { s } = ctx;
    const G = ctx.narrow ? GEO.narrow : GEO.wide;
    const svg = s('svg', { viewBox: `0 0 ${G.vb[0]} ${G.vb[1]}`, width: '100%', role: 'img', 'aria-label': 'CPU registers, the memory map, and the process queues during a process switch' });
    for (const [key, [x, y, w, hgt, lx, l1, l2]] of Object.entries(G.lanes)) {
      const run = key === 'run';
      svg.append(s('rect', { x, y, width: w, height: hgt, rx: 12, class: run ? 's-cpu' : 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': run ? '6 4' : null }));
      if (G.oneLine && !run) svg.append(s('text', { x: lx, y: y + 19, 'font-size': 14, 'font-weight': 800 }, l1, s('tspan', { 'font-size': 13, 'font-weight': 400, class: 's-sub' }, ' ' + l2)));
      else svg.append(s('text', { x: lx, y: y + 30, 'font-size': 14, 'font-weight': 800, style: run ? 'fill:var(--cpu)' : null }, l1),
        s('text', { x: lx, y: y + 48, 'font-size': 13, class: 's-sub' }, l2));
    }
    /* CPU register panel */
    const [cx, cy, cw, ch] = G.cpu;
    const cpuBox = s('rect', { x: cx, y: cy, width: cw, height: ch, rx: 12, class: 's-cpu', 'stroke-width': 2 });
    svg.append(cpuBox, s('text', { x: cx + 12, y: cy + 22, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'CPU registers'));
    const rows = {};
    [['pc', 'PC', 40], ['sp', 'SP', 76], ['regs', 'Regs', 112], ['mode', 'PSW', 148]].forEach(([k, lab, y]) => {
      const r = s('rect', { x: G.valX, y, width: G.valW, height: 28, rx: 7, 'stroke-width': 1.5 });
      const t = s('text', { x: G.valX + G.valW / 2, y: y + 19, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 });
      svg.append(s('text', { x: 18, y: y + 19, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, lab), r, t);
      rows[k] = { r, t };
    });
    /* memory map */
    const M = G.mem;
    const memR = s('rect', { x: M.val[0], y: M.val[1], width: M.val[2], height: 28, rx: 7, class: 's-mem', 'stroke-width': 1.5 });
    const memT = s('text', { x: M.val[0] + M.val[2] / 2, y: M.val[1] + 19, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 });
    svg.append(s('rect', { x: M.box[0], y: M.box[1], width: M.box[2], height: M.box[3], rx: 12, class: 's-panel', 'stroke-width': 1.5 }),
      s('text', { x: M.title[0], y: M.title[1], 'font-size': 14, 'font-weight': 800, style: 'fill:var(--mem)' }, 'Memory map in use'), memR, memT,
      M.sub ? s('text', { x: M.sub[0], y: M.sub[1], 'font-size': 13, class: 's-sub' }, 'what memory is reachable') : null);
    const arrows = s('g');
    svg.append(arrows);
    /* PCB boxes */
    const pcbs = {};
    ['P3', 'P4', 'P5', 'P1', 'P2'].forEach((id) => {
      const r = s('rect', { x: 0, y: 0, width: 104, height: 56, rx: 10, 'stroke-width': 2 });
      const a = s('text', { x: 52, y: 20, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'PCB ' + id);
      const b = s('text', { x: 52, y: 37, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 });
      const c = s('text', { x: 52, y: 52, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' });
      const g = s('g', { class: 'pcbg' }, r, a, b, c);
      svg.append(g);
      pcbs[id] = { g, r, b, c, star: id === 'P1' || id === 'P2' };
    });
    let first = true;
    const set = (st) => {
      const hl = new Set(st.hl || []);
      ['pc', 'sp', 'regs'].forEach((k) => { const o = st.cpu[k]; rows[k].r.setAttribute('class', o === 'OS' ? 's-os' : 's-proc'); rows[k].t.textContent = REG_TXT[k][o]; });
      rows.mode.r.setAttribute('class', st.cpu.mode === 'kernel' ? 's-os' : 's-proc');
      rows.mode.t.textContent = st.cpu.mode + ' mode';
      cpuBox.setAttribute('class', 's-cpu' + (hl.has('cpu') ? ' chg' : '') + (st.cpuBad ? ' lost' : ''));
      memR.setAttribute('class', 's-mem' + (hl.has('mem') ? ' chg' : ''));
      memT.textContent = st.mem + '’s page table';
      for (const [ln, ids] of Object.entries(st.lanes)) ids.forEach((id, i) => {
        const g = pcbs[id].g, [x, y] = G.slot(ln, i);
        if (first) g.style.transition = 'none';
        g.style.transform = `translate(${x}px, ${y}px)`;
      });
      for (const [id, p] of Object.entries(pcbs)) {
        const info = (st.pcb && st.pcb[id]) || { st: OTHERS[id], ctx: 'saved' };
        p.b.textContent = info.st;
        p.c.textContent = info.ctx === 'cpu' ? 'context in CPU' : info.ctx === 'lost' ? 'context LOST' : 'context saved';
        p.c.style.fill = info.ctx === 'lost' ? 'var(--bad)' : '';
        p.r.setAttribute('class', (p.star ? 's-proc' : 's-panel') + (info.sel ? ' sel' : '') + (hl.has(id) ? ' chg' : ''));
      }
      if (first) { svg.getBoundingClientRect(); Object.values(pcbs).forEach((p) => { p.g.style.transition = ''; }); first = false; }
      arrows.replaceChildren();
      const arrow = (spec, label) => arrows.append(s('path', { d: spec[0], class: 's-line', 'stroke-width': 2.5, style: 'stroke:var(--proc)', 'marker-end': 'url(#arr-proc)' }),
        s('text', { x: spec[1], y: spec[2], 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--proc)' }, label));
      if (st.arrow === 'save') arrow(G.save, 'save');
      if (st.arrow === 'restore') arrow(G.restore, 'restore');
    };
    return { svg, set };
  }
  /* legend row shown under the scene */
  const SCENE_LEGEND = (ctx) => ctx.h('div', { class: 'row small', style: { gap: '16px' } },
    ctx.h('span', { html: '<span class="legend-sq" style="background:var(--proc-bg);border-color:var(--proc)"></span>belongs to a process' }),
    ctx.h('span', { html: '<span class="legend-sq" style="background:var(--os-bg);border-color:var(--os)"></span>belongs to the OS' }),
    ctx.h('span', { html: '<span class="legend-sq" style="border-color:var(--accent);border-width:2.5px"></span>changed in this step' }));

  Guide.section({
    id: '3.4',
    title: 'Process Control',
    short: 'Process control',
    summary: 'How the OS stays in charge: two processor modes, creating a process, and switching between processes.',
    objectives: [
      'Explain what user mode and kernel mode are, why the processor has both, and how the mode bit changes.',
      'Name the main jobs of an OS kernel in process, memory and I/O management plus its support functions.',
      'Walk through the five steps the OS takes to create a new process.',
      'Classify an event as an interrupt, a trap or a supervisor call, and predict whether it leads to a process switch.',
      'Tell a mode switch from a process switch, and put the seven steps of a process switch in order.',
    ],
    terms: [
      ['User mode', 'The less-privileged processor mode in which ordinary programs run. Privileged instructions and protected memory, such as the OS’s own tables, are off limits.'],
      ['Kernel mode', 'The more-privileged processor mode in which the OS kernel runs: every instruction may be executed and every part of memory reached. Also called system mode or control mode.'],
      ['Privileged instruction', 'An instruction the hardware accepts only in kernel mode, such as disabling interrupts, setting the timer, starting I/O on a device or halting the processor. Tried in user mode, it causes a trap.'],
      ['Kernel', 'The core of the operating system. It stays in main memory, runs in kernel mode and does the essential work: managing processes, memory and I/O, and handling interrupts.'],
      ['Program status word (PSW)', 'A processor register describing the running program’s status: condition codes, whether interrupts are enabled, and the mode bit that says user or kernel mode.'],
      ['Mode bit', 'A bit in the program status word recording whether the processor is in user mode or kernel mode. The hardware consults it before every privileged instruction.'],
      ['System call (supervisor call)', 'A deliberate request from a running program for an OS service, such as opening a file. A special instruction switches the processor to kernel mode and enters the OS at a fixed, pre-arranged address.'],
      ['Interrupt', 'A signal caused by something outside the instruction being executed (the clock, an I/O device, the memory system) that makes the processor pause the running program and run an OS handler.'],
      ['Trap', 'An entry into the OS caused by an error or exception in the instruction just executed, such as dividing by zero or trying a privileged instruction in user mode.'],
      ['Interrupt handler', 'The OS routine that runs when an interrupt or trap is accepted. It works out what happened and deals with it, then returns or asks for a process switch.'],
      ['Clock interrupt', 'An interrupt from the system timer, fired at regular intervals. It lets the OS check whether the running process has used up its time slice.'],
      ['Time slice', 'A short, fixed amount of processor time a process may use before the OS switches the processor to another process. Also called a quantum.'],
      ['Memory fault', 'An interrupt raised when the running program refers to a valid address whose contents are not in main memory right now. The OS must fetch that part from disk first. In a paging system it is called a page fault.'],
      ['Mode switch', 'A change of the processor between user mode and kernel mode, for example on an interrupt and again on return. The same process stays Running, so it is cheap.'],
      ['Process switch', 'Taking the processor away from the running process and giving it to another: save one context, update PCBs and queues, change the memory map, restore the other context. Also called a context switch.'],
      ['Context (processor state)', 'Everything the processor needs to resume a program exactly where it stopped: the program counter, the PSW, the stack pointer and the other registers.'],
      ['Process identifier (PID)', 'A number the OS assigns to a process that no other current process has. Every table and queue refers to the process by it.'],
      ['Process control block (PCB)', 'The OS’s record for one process: identification, the saved processor state, and control information such as state, priority, queue links and resources owned.'],
      ['Process image', 'All the pieces that make up one process: its program code, its data, its stacks and its PCB.'],
      ['Process table', 'The OS’s master list of processes, one entry per process, each leading to that process’s image and PCB.'],
    ],

    /* Scoped CSS: every selector starts with .sec-3-4 */
    css: `
      /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width */
      .sec-3-4 .step-eyebrow { contain: inline-size; }
      .sec-3-4 .msg { border-radius: 10px; padding: 9px 12px; background: var(--panel-2); border: 1px solid var(--line); font-size: 15px; line-height: 1.45; }
      .sec-3-4 .msg > b:first-child { display: block; margin-bottom: 2px; }
      .sec-3-4 .msg.ok { border-color: var(--ok); background: var(--ok-bg); }
      .sec-3-4 .msg.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-3-4 .msg.info { border-color: var(--accent); background: var(--accent-bg); }
      .sec-3-4 .msg.warn { border-color: var(--warn); background: var(--warn-bg); }
      .sec-3-4 svg .hot { cursor: pointer; }
      .sec-3-4 svg .hot .fr { transition: stroke-width .15s; }
      .sec-3-4 svg .hot:hover .fr { stroke-width: 3.5; }
      .sec-3-4 svg .hot.on .fr { stroke: var(--accent); stroke-width: 3.5; }
      .sec-3-4 svg .hot:focus { outline: none; }
      .sec-3-4 svg .hot:focus-visible .fr { stroke: var(--accent); stroke-width: 4; }
      .sec-3-4 svg .tag { transition: transform .5s ease; }
      .sec-3-4 svg .kb rect { transition: fill .2s, stroke .2s; }
      .sec-3-4 svg .kb.on rect { fill: var(--accent-bg); stroke: var(--accent); stroke-width: 3; }
      .sec-3-4 .psw { display: inline-flex; align-items: stretch; border: 2px solid var(--cpu); border-radius: 10px; overflow: hidden; font-size: 13.5px; line-height: 1.3; }
      .sec-3-4 .psw > span { display: flex; align-items: center; padding: 5px 10px; border-left: 1px solid color-mix(in srgb, var(--cpu) 35%, transparent); background: var(--cpu-bg); white-space: nowrap; }
      .sec-3-4 .psw > span:first-child { border-left: 0; font-weight: 800; color: var(--cpu); }
      .sec-3-4 .psw .mbit { font-weight: 800; transition: background .2s, color .2s; }
      .sec-3-4 .psw .mbit.u { background: var(--proc-bg); color: var(--proc); }
      .sec-3-4 .psw .mbit.k { background: var(--os-bg); color: var(--os); }
      .sec-3-4 .ins { justify-content: flex-start; width: 100%; height: 44px; font-size: 14px; font-weight: 600; gap: 8px; overflow: hidden; }
      .sec-3-4 .ins code { font-size: 13px; font-weight: 800; flex: none; }
      .sec-3-4 .ins span { overflow: hidden; text-overflow: ellipsis; }
      .sec-3-4 .flow { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr); gap: 4px; align-items: stretch; }
      .sec-3-4 .flow .ar { align-self: center; color: var(--muted); font-weight: 800; }
      .sec-3-4 .fbox { border: 2px solid var(--line); border-radius: 10px; padding: 5px 8px; background: var(--panel-2); font-size: 13.5px; line-height: 1.3; opacity: .4; transition: opacity .2s, background .2s, border-color .2s; min-height: 62px; }
      .sec-3-4 .fbox .lbl { display: block; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
      .sec-3-4 .fbox.lit { opacity: 1; }
      .sec-3-4 .fbox.ok { border-color: var(--ok); background: var(--ok-bg); }
      .sec-3-4 .fbox.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-3-4 .fbox.os { border-color: var(--os); background: var(--os-bg); }
      .sec-3-4 .bin { border: 2px solid var(--line); border-radius: 12px; padding: 9px 12px; background: var(--panel); cursor: pointer; display: flex; flex-direction: column; gap: 3px; min-height: 0; transition: border-color .15s, background .15s; }
      .sec-3-4 .bin:hover { border-color: var(--accent); }
      .sec-3-4 .bin.flash-bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-3-4 .bin.flash-ok { border-color: var(--ok); background: var(--ok-bg); }
      .sec-3-4 .bin .blurb { font-size: 13px; color: var(--muted); line-height: 1.3; }
      .sec-3-4 .bin li.late::marker { color: var(--warn); }
      .sec-3-4 .bin ul:empty::before { content: 'click here to file the current job'; display: block; margin-left: -18px; margin-top: 6px; font-size: 13px; font-style: italic; color: var(--muted); }
      .sec-3-4 .bin li.fresh { animation: fadein .35s ease both; }
      .sec-3-4 .jobcard { font-size: 20px; font-weight: 750; line-height: 1.35; min-height: 84px; display: flex; align-items: center; }
      .sec-3-4 .stepbtn { justify-content: flex-start; width: 100%; height: auto; min-height: 38px; padding-top: 4px; padding-bottom: 4px; white-space: normal; text-align: left; line-height: 1.25; font-size: 15px; gap: 10px; }
      .sec-3-4 .stepbtn .num { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; background: var(--panel-3); font-size: 13px; font-weight: 800; color: var(--ink-2); flex: none; }
      .sec-3-4 .stepbtn.done { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); }
      .sec-3-4 .stepbtn.done .num { background: var(--ok); color: var(--panel); }
      .sec-3-4 .stepbtn.bad { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); }
      .sec-3-4 .pan { border: 1.5px dashed var(--line-2); border-radius: 10px; padding: 7px 10px; background: var(--panel-2); min-width: 0; min-height: 0; transition: border-color .25s, background .25s; }
      .sec-3-4 .pan.live { border-style: solid; border-color: color-mix(in srgb, var(--proc) 55%, transparent); background: var(--panel); }
      .sec-3-4 .ptitle { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-bottom: 5px; }
      .sec-3-4 .sb { display: inline-grid; place-items: center; width: 19px; height: 19px; border-radius: 50%; background: var(--panel-3); color: var(--ink-2); font-size: 12px; letter-spacing: 0; }
      .sec-3-4 .pan.live .sb { background: var(--proc); color: var(--panel); }
      .sec-3-4 .mcol { display: flex; flex-direction: column; gap: 4px; height: 150px; }
      .sec-3-4 .mblk { display: flex; align-items: center; border-radius: 6px; padding: 0 8px; font-size: 13px; font-weight: 700; border: 1.5px solid var(--line-2); min-height: 0; }
      .sec-3-4 .mblk.os { background: var(--os-bg); border-color: var(--os); color: var(--os); }
      .sec-3-4 .mblk.pr { background: var(--proc-bg); border-color: var(--proc); }
      .sec-3-4 .mblk.free { border-style: dashed; color: var(--muted); font-weight: 600; }
      .sec-3-4 .mblk.new { gap: 4px; padding: 3px 4px; border-width: 2.5px; }
      .sec-3-4 .mblk.new span { flex: 1; display: grid; place-items: center; height: 100%; background: var(--panel); border-radius: 4px; font-size: 13px; }
      .sec-3-4 .pcol .lbl { font-size: 12px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--proc); margin-bottom: 2px; }
      .sec-3-4 .kv { display: flex; gap: 6px; font-size: 13.5px; line-height: 1.4; min-width: 0; }
      .sec-3-4 .kv .k { color: var(--muted); flex: none; }
      .sec-3-4 .kv .v { font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sec-3-4 .kv .v.muted { font-weight: 500; }
      .sec-3-4 .ans { height: 34px; padding: 0 12px; font-size: 14.5px; }
      .sec-3-4 .ans.right { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); }
      .sec-3-4 .ans.wrong { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); }
      .sec-3-4 .ans.late { border-color: var(--warn); background: var(--warn-bg); color: var(--warn); }
      .sec-3-4 .evtext { font-size: 18px; font-weight: 650; line-height: 1.4; min-height: 76px; }
      .sec-3-4 .qlab { font-size: 13px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
      .sec-3-4 .dots { display: flex; gap: 5px; align-items: center; }
      .sec-3-4 .dots span { width: 22px; height: 9px; border-radius: 5px; background: var(--panel-3); }
      .sec-3-4 .dots span.ok { background: var(--ok); }
      .sec-3-4 .dots span.late { background: var(--warn); }
      .sec-3-4 .dots span.cur { outline: 2px solid var(--accent); outline-offset: 1px; }
      .sec-3-4 .lane { display: flex; flex-direction: column; gap: 7px; min-height: 0; }
      .sec-3-4 .acts { display: grid; gap: 2px 10px; }
      .sec-3-4 .act { display: flex; align-items: center; gap: 6px; font-size: 13.5px; line-height: 1.3; padding: 2px 6px; border-radius: 6px; color: var(--muted); min-width: 0; }
      .sec-3-4 .act .ck { width: 14px; flex: none; font-weight: 800; color: var(--ok); }
      .sec-3-4 .act .c { margin-left: auto; font-family: var(--mono); font-size: 12.5px; color: var(--muted); flex: none; }
      .sec-3-4 .act.done { color: var(--ink); }
      .sec-3-4 .act.cur { color: var(--ink); background: var(--accent-bg); font-weight: 700; }
      .sec-3-4 .legend-sq { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 1.5px solid; vertical-align: -1px; margin-right: 4px; }
      .sec-3-4 svg .pcbg { transition: transform .6s ease; }
      .sec-3-4 svg .chg { stroke: var(--accent); stroke-width: 3.5; }
      .sec-3-4 svg .sel { stroke: var(--accent); stroke-width: 3.5; stroke-dasharray: 6 3; }
      .sec-3-4 svg .lost { fill: var(--bad-bg); stroke: var(--bad); stroke-width: 3.5; }
      .sec-3-4 .act .n { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 6px; background: var(--panel-3); font-size: 12.5px; font-weight: 800; color: var(--ink-2); flex: none; }
      .sec-3-4 .act.cur .n { background: var(--accent); color: var(--panel); }
      .sec-3-4 .tickgrid { display: grid; gap: 4px; }
      .sec-3-4 .tickgrid i { display: block; height: 36px; border-radius: 4px; background: var(--os-bg); border: 1.5px solid color-mix(in srgb, var(--os) 45%, transparent); transition: background .2s, border-color .2s; }
      .sec-3-4 .tickgrid i.ps { background: var(--warn-bg); border: 2px solid var(--warn); }
    `,

    steps: [
      /* ============ 1. Big picture: three ways the OS keeps control ============ */
      {
        title: 'Staying in charge: how the OS controls processes',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          /* wide: CPU on the left of the two bands; narrow (phones): CPU bar on top, bands stacked below */
          const G = ctx.narrow
            ? { vb: [380, 352], user: [6, 58, 368, 150], userLbl: [18, 196], kern: [6, 238, 368, 108], kernLbl: [18, 262], kb: [[14, 134, 254], 274, 112],
              pw: 84, px: [13, 105, 197, 289], py: 100, gate: [6, 374, 222], pill: [120, 140], cpu: [6, 6, 368, 44], cpuT: [[40, 34], [140, 34], [250, 34], [322, 34]] }
            : { vb: [620, 300], user: [118, 8, 494, 124], userLbl: [130, 122], kern: [118, 168, 494, 124], kernLbl: [130, 190], kb: [[132, 292, 452], 202, 148],
              pw: 104, px: [132, 248, 364, 480], py: 40, gate: [118, 612, 150], pill: [296, 140], cpu: [8, 98, 96, 104], cpuT: [[56, 124], [56, 150], [56, 169], [56, 186]] };
          const PW = G.pw, PY = G.py;
          const PROCS = [{ id: 'P1', name: 'editor', x: G.px[0] }, { id: 'P2', name: 'browser', x: G.px[1] }, { id: 'P3', name: 'music', x: G.px[2] }];
          const svg = s('svg', { viewBox: `0 0 ${G.vb[0]} ${G.vb[1]}`, width: '100%', role: 'img', 'aria-label': 'User processes above the privilege boundary, the OS kernel below it, and the CPU' });
          /* the two bands: user mode above, kernel mode below */
          svg.append(
            s('rect', { x: G.user[0], y: G.user[1], width: G.user[2], height: G.user[3], rx: 14, class: 's-panel', 'stroke-width': 1.5 }),
            s('text', { x: G.userLbl[0], y: G.userLbl[1], 'font-size': 13, 'font-weight': 800, class: 's-sub' }, ctx.narrow ? 'USER MODE · ordinary programs' : 'USER MODE · ordinary programs run here'),
            s('rect', { x: G.kern[0], y: G.kern[1], width: G.kern[2], height: G.kern[3], rx: 14, class: 's-os', 'stroke-width': 1.5 }),
            s('text', { x: G.kernLbl[0], y: G.kernLbl[1], 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }, ctx.narrow ? 'KERNEL MODE · only the kernel' : 'KERNEL MODE · only the OS kernel runs here'));
          /* kernel parts that light up */
          const kb = {};
          const [kbx, kby, kbw] = G.kb;
          [['table', kbx[0], 'Process table', 'and PCBs'], ['sched', kbx[1], 'Scheduler and', 'dispatcher'], ['intr', kbx[2], 'Interrupt', 'handlers']].forEach(([id, x, a, b]) => {
            kb[id] = s('g', { class: 'kb' },
              s('rect', { x, y: kby, width: kbw, height: 60, rx: 10, class: 's-panel', 'stroke-width': 1.5 }),
              s('text', { x: x + kbw / 2, y: kby + 26, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, a),
              s('text', { x: x + kbw / 2, y: kby + 45, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, b));
            svg.append(kb[id]);
          });
          /* ordinary user processes */
          PROCS.forEach((p) => svg.append(s('g', {},
            s('rect', { x: p.x, y: PY, width: PW, height: 56, rx: 10, class: 's-proc', 'stroke-width': 2 }),
            s('text', { x: p.x + PW / 2, y: PY + 24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, p.id),
            s('text', { x: p.x + PW / 2, y: PY + 44, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, p.name))));
          /* hotspot: the privilege gate on the boundary */
          const [gx0, gx1, gy] = G.gate, [pillX, pillW] = G.pill;
          const gate = s('g', { class: 'hot', 'data-id': 'modes', role: 'button', tabindex: 0, 'aria-label': 'The privilege gate' },
            s('rect', { x: gx0, y: gy - 14, width: gx1 - gx0, height: 28, fill: 'transparent' }),
            s('line', { x1: gx0, y1: gy, x2: gx1, y2: gy, class: 's-line', 'stroke-dasharray': '7 5' }),
            s('rect', { x: pillX, y: gy - 12, width: pillW, height: 24, rx: 12, class: 'fr s-os', 'stroke-width': 2 }),
            s('text', { x: pillX + pillW / 2, y: gy + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }, 'privilege gate'));
          /* hotspot: a new process waiting to be created */
          const p4x = G.px[3];
          const p4r = s('rect', { x: p4x, y: PY, width: PW, height: 56, rx: 10, class: 'fr s-panel', 'stroke-width': 2, 'stroke-dasharray': '6 4' });
          const p4a = s('text', { x: p4x + PW / 2, y: PY + 24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, '+ new');
          const p4b = s('text', { x: p4x + PW / 2, y: PY + 44, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'process');
          const create = s('g', { class: 'hot', 'data-id': 'create', role: 'button', tabindex: 0, 'aria-label': 'Create a new process' }, p4r, p4a, p4b);
          /* hotspot: the CPU (click to switch processes) */
          const T = G.cpuT;
          const cpuRun = s('text', { x: T[1][0], y: T[1][1], 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'runs P1');
          const cpuMode = s('text', { x: T[3][0], y: T[3][1], 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'user');
          const cpu = s('g', { class: 'hot', 'data-id': 'switch', role: 'button', tabindex: 0, 'aria-label': 'The CPU: switch to another process' },
            s('rect', { x: G.cpu[0], y: G.cpu[1], width: G.cpu[2], height: G.cpu[3], rx: 12, class: 'fr s-cpu', 'stroke-width': 2 }),
            s('text', { x: T[0][0], y: T[0][1], 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'CPU'),
            cpuRun,
            s('text', { x: T[2][0], y: T[2][1], 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'mode bit:'),
            cpuMode);
          /* the "on CPU" tab that sits on the running process */
          const tag = s('g', { class: 'tag' },
            s('rect', { x: 0, y: PY - 12, width: 64, height: 22, rx: 6, class: 's-cpu', 'stroke-width': 1.5 }),
            s('text', { x: 32, y: PY + 4, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'on CPU'));
          svg.append(gate, create, cpu, tag);

          const INFO = {
            modes: ['Privilege: two modes', 'The processor runs ordinary programs in <span class="t">user mode</span>, where dangerous instructions and the OS’s own memory are off limits. Only the kernel runs in <span class="t">kernel mode</span>. Control crosses the line only through doors the OS set up in advance, each leading to an OS handler (lit up below).', 'Only the referee may stop the clock or change the rules. The players cannot, however much they would like to.'],
            create: ['Birth: creating a process', 'Before a program can run it must become a process: the OS gives it an identifier, space for its image, a filled-in <span class="t">PCB</span> (the OS’s record of it) and a place in a queue. Five steps, always in that order. P4 now takes turns on the CPU too.', 'A new player is registered, given a shirt number and put on the bench before coming onto the pitch.'],
            switch: ['Hand-off: switching processes', 'Whenever the OS gets the processor back (by an interrupt, a trap or a system call) it may hand it to another process: save one <span class="t">context</span> (the register values), restore another. The OS does this in kernel mode. Click the CPU again to switch again.', 'A substitution: the whistle stops play, one player walks off with a note of where they were, another comes on.'],
          };
          const info = h('div', { class: 'msg info', style: { minHeight: '118px' } });
          let running = 0, gen = 0;
          const placeTag = () => { tag.style.transform = `translate(${PROCS[running].x + PW / 2 - 32}px, 0px)`; cpuRun.textContent = 'runs ' + PROCS[running].id; };
          const pick = (id) => {
            [gate, create, cpu].forEach((g) => g.classList.toggle('on', g.dataset.id === id));
            Object.entries(kb).forEach(([k, g]) => g.classList.toggle('on', (id === 'create' && k === 'table') || (id === 'switch' && k === 'sched') || (id === 'modes' && k === 'intr')));
            /* once created, P4 is an ordinary Ready process and joins the rotation */
            if (id === 'create' && PROCS.length === 3) { p4r.setAttribute('class', 'fr s-proc'); p4r.removeAttribute('stroke-dasharray'); p4a.textContent = 'P4'; p4b.textContent = 'new: Ready'; PROCS.push({ id: 'P4', name: 'new', x: p4x }); }
            if (id === 'switch') {
              /* the OS itself does the switch, so the mode bit reads kernel for a moment */
              const my = ++gen;
              cpuMode.textContent = 'kernel'; cpuMode.style.fill = 'var(--os)';
              running = (running + 1) % PROCS.length; placeTag();
              if (PROCS.length === 4) p4b.textContent = 'new';
              ctx.after(700, () => { if (my !== gen) return; cpuMode.textContent = 'user'; cpuMode.style.fill = 'var(--proc)'; });
            }
            const [t, txt, pitch] = INFO[id];
            say(info, 'info', t, `${txt}<div class="small" style="margin-top:6px"><b>On the pitch:</b> ${pitch}</div>`);
          };
          [gate, create, cpu].forEach((g) => {
            g.addEventListener('click', () => pick(g.dataset.id));
            g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(g.dataset.id); } });
          });
          placeTag();
          say(info, 'info', 'Click a part of the picture', 'Try the <b>privilege gate</b> on the boundary, the dashed <b>new process</b>, and the <b>CPU</b> box. Each one is a job this section teaches.');

          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'While a program runs, the processor is busy executing <i>its</i> instructions, not the operating system’s. So how does the OS stay in charge of the whole machine?' }),
              h('p', { class: 'm0', html: 'Three things work together. Hardware <b>privilege</b> keeps programs away from what they must not touch. The OS controls how every process is <b>born</b>. And it can take the processor back and <b>hand it</b> to another process.' }),
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A referee in a football match. The players (processes) do the playing, but only the referee can stop the clock, register a new player or bring on a substitute. The whistle that halts play is an <span class="t">interrupt</span>.' }),
              h('div', { class: 'card tight small', html: '<b>In this section you will</b> try a forbidden instruction and watch it trap, sort the <span class="t">kernel</span>’s jobs, build a process in five steps, classify the events that hand control to the OS, and compare a cheap <span class="t">mode switch</span> with a full <span class="t">process switch</span>.' })),
            h('div', { class: 'card white stack' },
              h('h4', { class: 'm0' }, 'Three ways the OS keeps control'),
              svg,
              h('div', { class: 'row small', style: { gap: '16px' } },
                h('span', { html: '<span class="legend-sq" style="background:var(--cpu-bg);border-color:var(--cpu)"></span>processor (CPU)' }),
                h('span', { html: '<span class="legend-sq" style="background:var(--proc-bg);border-color:var(--proc)"></span>user processes' }),
                h('span', { html: '<span class="legend-sq" style="background:var(--os-bg);border-color:var(--os)"></span>operating system kernel' })),
              info)));
        },
      },

      /* ============ 2. User mode vs kernel mode: the privilege gate ============ */
      {
        title: 'Two modes: the privilege gate',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          /* kind: ok = ordinary, mem = protected memory, priv = privileged instruction, sys = system call */
          const INS = [
            { code: 'ADD R1,R2', what: 'add two registers', kind: 'ok', why: 'Plain arithmetic on the program’s own registers cannot harm anyone else.' },
            { code: 'LOAD R3,x', what: 'read its own variable', kind: 'ok', why: 'The address lies inside the program’s own memory, so the memory hardware lets it through.' },
            { code: 'STORE PCB', what: 'write into a PCB', kind: 'mem', why: 'Every PCB, even the program’s own, lives in the OS’s protected memory. A program that could write there could, for example, raise its own priority or point its record at another process’s memory.' },
            { code: 'INT OFF', what: 'disable interrupts', kind: 'priv', why: 'With interrupts off, the clock could never interrupt this program, so it could keep the processor forever.',
              kAct: 'executes it: interrupts now off', kEnd: 'OS updates a table undisturbed', kSay: 'In kernel mode it just runs. The OS switches interrupts off for a few instructions while it updates a table that an interrupt handler also uses, then switches them back on.' },
            { code: 'SET TIMER', what: 'reprogram the clock', kind: 'priv', why: 'The timer is how the OS takes the processor back. A program that could stretch it would never be stopped.',
              kSay: 'In kernel mode it just runs. The OS does exactly this before it hands the processor to a process: it sets the timer so that the next clock interrupt will end that process’s time slice.' },
            { code: 'IO START', what: 'drive the disk directly', kind: 'priv', why: 'Going straight to the disk would bypass file permissions and collide with other programs using the same device.',
              kSay: 'In kernel mode it just runs. This is how the OS carries out a program’s read request: it has already checked the permissions, so now it drives the device itself.' },
            { code: 'HALT', what: 'stop the processor', kind: 'priv', why: 'One program must never be able to stop the machine for everyone else.',
              kAct: 'executes it: the processor stops', kEnd: 'idle until the next interrupt', kSay: 'In kernel mode it runs, so the processor stops fetching instructions. The OS uses this only when no process is Ready at all, and the next interrupt wakes the processor up again.' },
            { code: 'SYSCALL', what: 'ask the OS to read a file', kind: 'sys', why: '' },
          ];
          let mode = 'user', gen = 0;
          const mb = h('span', { class: 'mbit u' }, 'mode bit: user');
          const ie = h('span', {}, 'interrupts: on');
          const psw = h('div', { class: 'psw', title: 'Program status word' }, h('span', {}, 'PSW'), ctx.narrow ? null : h('span', {}, 'flags: Z=0 C=0'), ie, mb);
          const setMode = (m) => { mb.className = 'mbit ' + (m === 'user' ? 'u' : 'k'); mb.textContent = 'mode bit: ' + m; };
          const setIE = (on) => { ie.textContent = 'interrupts: ' + (on ? 'on' : 'off'); ie.style.color = on ? '' : 'var(--intr)'; ie.style.fontWeight = on ? '' : '800'; };
          const boxes = [0, 1, 2, 3].map(() => h('div', { class: 'fbox' }));
          const LBL = ['1 · Decode', '2 · Check', '3 · Act', '4 · Result'];
          const flow = h('div', { class: 'flow' });
          boxes.forEach((b, i) => { if (i) flow.append(h('span', { class: 'ar' }, '→')); flow.append(b); });
          if (ctx.narrow) { flow.style.gridTemplateColumns = 'minmax(0,1fr) minmax(0,1fr)'; flow.querySelectorAll('.ar').forEach((a) => a.remove()); }
          const out = h('div', { class: 'msg', style: { minHeight: '104px' } });
          const btns = [];
          const paintIdle = () => {
            boxes.forEach((b, i) => { b.className = 'fbox'; b.innerHTML = `<span class="lbl">${LBL[i]}</span>${['fetch the instruction', 'look at the mode bit', 'run it, or trap', 'what happens next'][i]}`; });
            say(out, 'info', mode === 'user' ? 'The editor is running in user mode' : 'The OS kernel is running in kernel mode',
              mode === 'user' ? 'Click an instruction to make the editor try it. Each click starts a fresh run of the editor.' : 'Now the very same instructions are tried by the kernel itself. Watch what changes.');
          };
          const run = (k) => {
            const ins = INS[k], my = ++gen;
            btns.forEach((b, j) => b.classList.toggle('on', j === k));
            setMode(mode); setIE(true);
            /* the four stages as [class, text]; the mode bit changes at stage 3 (and back at stage 4) */
            let st, verdict, modeAt3 = mode, modeAt4 = mode;
            if (mode === 'kernel') {
              st = [['os', `<code>${ins.code}</code>`], ['ok', ins.kind === 'sys' ? 'kernel mode: no door needed' : 'mode bit = kernel: all allowed'],
                ['os', ins.kind === 'sys' ? 'calls its own routine directly' : ins.kAct || 'executes it'], ['os', ins.kEnd || 'the OS carries on']];
              verdict = ins.kind === 'sys'
                ? ['info', 'Not needed here', 'Kernel code simply calls its own routines. The system call exists as the one safe door for <i>user</i> programs.']
                : ['ok', 'Allowed', ins.kind === 'ok' ? 'Ordinary instructions run in either mode.' : ins.kSay || 'In kernel mode the very same instruction just runs: the OS may write any of its own tables, including every PCB.'];
            } else if (ins.kind === 'ok') {
              st = [['ok', `<code>${ins.code}</code>`], ['ok', 'ordinary instruction ✓'], ['ok', 'executes in user mode'], ['ok', 'the editor carries on']];
              verdict = ['ok', 'Allowed', ins.why];
            } else if (ins.kind === 'sys') {
              st = [['ok', `<code>${ins.code}</code>`], ['ok', 'the one legal door ✓'], ['os', 'mode bit → kernel; OS reads the file'], ['ok', 'return: mode bit → user']];
              verdict = ['ok', 'Allowed, the proper way', 'The program cannot do privileged work itself, so it asks. The <span class="t">system call</span> instruction sets the <span class="t">mode bit</span> to kernel and jumps to a fixed OS entry point, so the program cannot pick which kernel code runs. The OS checks the request, does the work, and a return instruction puts the processor back in user mode.'];
              modeAt3 = 'kernel'; modeAt4 = 'user';
            } else {
              st = [['ok', `<code>${ins.code}</code>`], ['bad', ins.kind === 'mem' ? 'address is protected ✗' : 'privileged in user mode ✗'], ['bad', 'TRAP: mode bit → kernel, jump to OS'], ['os', 'OS ends the editor']];
              verdict = ['bad', 'Trapped', `${ins.why} The hardware refuses and raises a <span class="t">trap</span>, which hands control to the OS in kernel mode. The OS normally terminates the offending process.`];
              modeAt3 = 'kernel'; modeAt4 = 'kernel';
            }
            boxes.forEach((b, i) => { b.className = 'fbox'; b.innerHTML = `<span class="lbl">${LBL[i]}</span>${st[i][1]}`; });
            say(out, 'info', 'Running…', `The ${mode === 'user' ? 'editor' : 'kernel'} tries <code>${ins.code}</code> (${ins.what}).`);
            [0, 1, 2, 3].forEach((i) => ctx.after(i * 260, () => {
              if (my !== gen) return;
              boxes[i].className = 'fbox lit ' + st[i][0];
              if (i === 2) { setMode(modeAt3); if (mode === 'kernel' && ins.code === 'INT OFF') setIE(false); }
              if (i === 3) { setMode(modeAt4); say(out, verdict[0], verdict[1], verdict[2]); }
            }));
          };
          INS.forEach((ins, k) => btns.push(h('button', { class: 'btn ins', type: 'button', onclick: () => run(k), html: `<code>${ins.code}</code><span>${ins.what}</span>` })));
          const seg = ctx.ui.seg([{ value: 'user', label: 'Editor (user mode)' }, { value: 'kernel', label: 'OS kernel (kernel mode)' }], mode, (v) => {
            mode = v; gen++; setMode(v); setIE(true); btns.forEach((b) => b.classList.remove('on')); paintIdle();
          });
          paintIdle();

          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'The processor is always in one of two modes, and the mode decides what the running code may do.' }),
              h('div', { class: 'grid-2' },
                h('div', { class: 'card proc tight', html: '<h4 style="color:var(--proc)">User mode</h4><p class="small m0">Less privileged. Ordinary programs run here. <span class="t">Privileged instructions</span> and protected memory are off limits.</p>' }),
                h('div', { class: 'card os tight', html: '<h4 style="color:var(--os)">Kernel mode</h4><p class="small m0">More privileged. The OS kernel runs here: any instruction, any memory. Also called <b>system mode</b> or <b>control mode</b>.</p>' })),
              h('p', { class: 'small m0', html: 'How does the processor know the mode? A single <span class="t">mode bit</span> in the <span class="t">program status word (PSW)</span>. It flips to kernel only on an <span class="t">interrupt</span>, a <span class="t">trap</span> or a <span class="t">system call</span>, and each of those lands at an OS entry point chosen in advance. When the OS is done, a return instruction reloads the saved PSW, which flips the bit back to user.' }),
              h('div', { class: 'callout why m0', 'data-label': 'Why two modes?', html: 'The OS keeps its own tables, such as every process’s <span class="t">PCB</span>, in protected memory. If any program could rewrite them or turn off the clock, one bug or one attacker could take over the whole machine.' })),
            h('div', { class: 'card white stack', style: { gap: '10px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Who is running?'), seg),
              h('div', { class: 'row' }, psw),
              h('div', { class: 'grid-2', style: { gap: '6px 10px' } }, ...btns),
              flow, out)));
        },
      },

      /* ============ 3. The kernel's jobs: a sorting game ============ */
      {
        title: 'The kernel’s job list: sort it into four families',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const FAM = [
            { id: 'proc', name: 'Process management', cls: 'proc', blurb: 'creating, running and coordinating processes',
              hint: 'Process management is about the life of processes: creating them, choosing who runs, switching, coordinating and keeping their PCBs.' },
            { id: 'mem', name: 'Memory management', cls: 'mem', blurb: 'deciding what lives where in main memory',
              hint: 'Memory management is about which parts of main memory each process gets and what is kept on disk instead.' },
            { id: 'io', name: 'I/O management', cls: 'io', blurb: 'sharing devices and moving data to and from them',
              hint: 'I/O management is about devices: who may use which one, and how data travels to and from them.' },
            { id: 'sup', name: 'Support functions', cls: 'os', blurb: 'services that every other part relies on',
              hint: 'Support functions are the kernel’s housekeeping services that the other three families lean on: interrupts, accounting, monitoring.' },
          ];
          const JOBS = [
            ['Creating and terminating processes', 'proc', 'Building a new process and tearing it down at the end is process management at its most basic.'],
            ['Swapping a process out to disk and back', 'mem', 'Swapping decides which process images occupy main memory, so it is memory management.'],
            ['Handling interrupts', 'sup', 'Every other part of the kernel depends on interrupts reaching the right handler, so this is a support function.'],
            ['Managing buffers for data on its way to or from a device', 'io', 'Buffers smooth out the speed difference between devices and processes. That is I/O management.'],
            ['Scheduling and dispatching processes', 'proc', 'Choosing which Ready process runs next, and starting it, is process management.'],
            ['Allocating memory space to a process', 'mem', 'Handing out regions of main memory is memory management.'],
            ['Accounting: recording who used how much', 'sup', 'Recording processor time and other usage per process or user supports billing, limits and tuning. It is a support function.'],
            ['Switching the processor between processes', 'proc', 'Saving one context and restoring another is a process-management job. The last steps of this section are all about it.'],
            ['Assigning I/O channels and devices to processes', 'io', 'Deciding which process may use which device or channel is I/O management.'],
            ['Managing pages and segments', 'mem', 'Pages and segments are the pieces in which memory is divided and mapped, so they belong to memory management.'],
            ['Process synchronization and inter-process communication', 'proc', 'Coordinating processes and letting them exchange messages is process management.'],
            ['Monitoring the system’s load and health', 'sup', 'Watching load, errors and performance serves the whole system: a support function.'],
            ['Managing process control blocks', 'proc', 'Creating, updating and linking PCBs is the core bookkeeping of process management.'],
          ];
          let idx = 0, tries = 0, first = 0;
          const card = h('div', { class: 'jobcard' });
          const counter = h('span', { class: 'chip accent' });
          const meter = h('div', { class: 'meter grow' }, h('i', { style: { width: '0%' } }));
          const scoreEl = h('span', { class: 'small b' });
          const fb = h('div', { class: 'msg', style: { minHeight: '104px' } });
          const bins = FAM.map((f) => {
            const list = h('ul', { style: { margin: '2px 0 0', paddingLeft: '18px', fontSize: '13.5px', lineHeight: '1.3' } });
            const b = h('div', { class: 'bin', role: 'button', tabindex: 0, 'aria-label': 'Put the job into ' + f.name },
              h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'chip ' + f.cls }, f.name)),
              h('div', { class: 'blurb' }, f.blurb), list);
            b.list = list; b.fam = f;
            b.addEventListener('click', () => drop(b));
            b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(b); } });
            return b;
          });
          const flashBin = (b, cls) => { b.classList.remove('flash-ok', 'flash-bad'); b.classList.add(cls); ctx.after(650, () => b.classList.remove(cls)); };
          const paint = () => {
            counter.textContent = idx < JOBS.length ? `Job ${idx + 1} of ${JOBS.length}` : 'All sorted';
            meter.firstChild.style.width = (idx / JOBS.length) * 100 + '%';
            scoreEl.textContent = `Right first time: ${first}`;
            if (idx < JOBS.length) card.textContent = JOBS[idx][0];
            else card.innerHTML = `<span>All ${JOBS.length} jobs sorted. <span style="color:var(--ok)">${first} of ${JOBS.length}</span> right first time.</span>`;
          };
          const place = (late) => {
            const [text, fam] = JOBS[idx];
            const b = bins.find((x) => x.fam.id === fam);
            b.list.append(h('li', { class: 'fresh' + (late ? ' late' : '') }, text));
            flashBin(b, 'flash-ok');
            idx++; tries = 0;
            paint();
            if (idx === JOBS.length) say(fb, 'ok', 'Done: the kernel’s job list', 'Notice what every job has in common: it touches shared tables (PCBs, page tables, buffers) or the hardware itself (the timer, device controllers). That is exactly why the kernel does them in <b>kernel mode</b>, where nothing else can interfere.');
          };
          const drop = (b) => {
            if (idx >= JOBS.length) { say(fb, 'info', 'All sorted', 'Press <b>Start over</b> to sort the jobs again.'); return; }
            const [text, fam, why] = JOBS[idx];
            if (b.fam.id === fam) {
              if (!tries) first++;
              say(fb, 'ok', tries ? 'Right on the second try' : 'Right', `<i>${text}</i> → <b>${b.fam.name}</b>. ${why}`);
              place(tries > 0);
            } else if (tries === 0) {
              tries = 1;
              flashBin(b, 'flash-bad');
              say(fb, 'bad', `Not ${b.fam.name.toLowerCase()}`, `${b.fam.hint} Does this job fit that description? Try another family.`);
            } else {
              const right = FAM.find((f) => f.id === fam);
              flashBin(b, 'flash-bad');
              say(fb, 'warn', `It belongs to ${right.name}`, `${why} It has been filed there for you, marked in amber.`);
              place(true);
            }
          };
          const reset = () => { idx = 0; tries = 0; first = 0; bins.forEach((b) => b.list.replaceChildren()); paint(); say(fb, 'info', 'Click a family', 'Read the job on the card, then click the family box where it belongs. A wrong click gives you a hint and a second try.'); };
          reset();

          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'The <span class="t">kernel</span> is the part of the OS that stays in main memory and runs in <span class="t">kernel mode</span>. Its many jobs fall into four families.' }),
              h('div', { class: 'card stack', style: { gap: '6px' } }, h('div', { class: 'row' }, counter), card),
              fb,
              h('div', { class: 'row nw' }, meter, scoreEl, h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Start over')),
              h('div', { class: 'callout tip small m0', 'data-label': 'How to decide', html: 'Ask what the job is really looking after: the processes themselves, main memory, the devices, or a service that the other three families rely on.' })),
            h('div', { class: 'grid-2', style: { gridAutoRows: ctx.narrow ? 'auto' : 'minmax(0, 1fr)', height: ctx.narrow ? 'auto' : '100%' } }, ...bins)));
        },
      },

      /* ============ 4. Process creation: build it in the right order ============ */
      {
        title: 'Creating a process in five steps',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const ST = [
            { label: 'Assign a unique process identifier',
              did: 'The new process gets <b>PID 31</b>, a number no other current process has, and a new entry in the <span class="t">process table</span>. From now on every table and queue refers to it by this number.' },
            { label: 'Allocate space for the process image',
              did: (room) => `Space is set aside for every part of the <span class="t">process image</span>: the program code and data (its user address space), its stack, and the PCB itself. The sizes come from defaults for this kind of program or from what the creator asks for. ${room ? 'Main memory has room, so the image goes there.' : 'Main memory is full, so the image is placed in the swap area on disk for now.'}`,
              early: 'Space for whom? First the new process needs an identity: a PID and a slot in the process table. Everything else is recorded under that number.' },
            { label: 'Initialize the process control block',
              did: (room) => `The PCB is filled in. <b>Identification:</b> PID, parent’s PID, user. <b>Processor state:</b> zeros, except the program counter (entry point) and stack pointer (new stack). <b>Control:</b> state = ${room ? 'Ready' : 'Ready/Suspend'} (the OS admits it at once, so its New stage from section 3.2 ends here), default priority, no resources yet (unless requested or inherited from the parent).`,
              early: 'The PCB lives inside the process image, and no space for the image has been allocated yet. There is nowhere to write it.' },
            { label: 'Set the linkages (put it in a queue)',
              did: (room) => `The PCB is linked onto the tail of the <b>${room ? 'Ready' : 'Ready/Suspend'} list</b>. Now the scheduler can find it${room ? ' and will dispatch it in its turn.' : '; it can run once it is brought into main memory.'}`,
              early: 'Putting the process in a queue announces that it may run. But its PCB has not been filled in yet (no program counter, no state), so the dispatcher would load a blank record and jump nowhere.' },
            { label: 'Create or expand other data structures',
              did: 'Extra bookkeeping is set up, for example a new record in the <b>accounting file</b> that will track the processor time this process uses.',
              early: 'Not yet. The standard sequence builds the core first: a process the scheduler can find. Extra bookkeeping such as accounting records comes last.' },
          ];
          const SHOWN = [2, 0, 4, 1, 3]; // buttons appear in this shuffled order
          let done = 0, room = true, slips = 0;
          const mkPan = (n, title) => { const body = h('div'); const p = h('div', { class: 'pan' }, h('div', { class: 'ptitle' }, h('span', { class: 'sb' }, String(n)), title), body); p.body = body; return p; };
          const pA = mkPan(1, 'Process table'), pB = mkPan(2, 'Memory and disk'), pC = mkPan(3, 'PCB of the new process'), pD = mkPan(4, 'Queues'), pE = mkPan(5, 'Accounting file');
          const pans = [pA, pB, pC, pD, pE];
          const chip = (cls, t) => h('span', { class: 'chip ' + cls }, t);
          const arrow = () => h('span', { class: 'muted b' }, '→');
          const draw = (flashN) => {
            pans.forEach((p, i) => p.classList.toggle('live', done > i));
            /* 1. process table */
            const rows = [['12', 'desktop', 'memory'], ['17', 'editor', 'memory'], ['23', 'browser', 'memory'], ['5', 'backup', 'disk']];
            if (done >= 1) rows.push(['31', 'music', done >= 2 ? (room ? 'memory' : 'disk') : '—']);
            pA.body.replaceChildren(h('table', { class: 'tbl compact' },
              h('tr', {}, h('th', {}, 'PID'), h('th', {}, 'Program'), h('th', {}, 'Image in')),
              ...rows.map((r) => h('tr', { class: r[0] === '31' ? 'on' : '' }, ...r.map((c) => h('td', {}, c))))));
            /* 2. memory and disk */
            const img = h('div', { class: 'mblk pr new', style: { flex: '1.4' } }, h('b', { style: { padding: '0 4px' } }, '31'), h('span', {}, 'code+data'), h('span', {}, 'stack'), h('span', {}, 'PCB'));
            const mem = [h('div', { class: 'mblk os', style: { flex: '1' } }, 'OS kernel'), h('div', { class: 'mblk pr', style: { flex: '1' } }, 'PID 12'), h('div', { class: 'mblk pr', style: { flex: '1' } }, 'PID 17'),
              h('div', { class: 'mblk pr', style: { flex: room ? '1' : '2.4' } }, 'PID 23')];
            if (room) mem.push(done >= 2 ? img : h('div', { class: 'mblk free', style: { flex: '1.4' } }, 'free space'));
            pB.body.replaceChildren(h('div', { class: 'mcol' }, ...mem),
              h('div', { class: 'row', style: { gap: '6px', marginTop: '6px' } }, h('span', { class: 'small b' }, 'Disk swap area:'), chip('proc', 'PID 5'),
                !room && done >= 2 ? chip('accent', 'PID 31 image') : null, room ? null : h('span', { class: 'xs muted' }, done >= 2 ? '' : '(memory full)')));
            /* 3. PCB */
            if (done < 2) pC.body.replaceChildren(h('p', { class: 'small muted m0' }, 'No space for a PCB yet: it is part of the process image.'));
            else {
              const f = done >= 3;
              const v = (x) => (f ? x : '—');
              const col = (title, list) => h('div', { class: 'pcol' }, h('div', { class: 'lbl' }, title),
                ...list.map(([k, val]) => h('div', { class: 'kv' }, h('span', { class: 'k' }, k), h('span', { class: 'v' + (val === '—' ? ' muted' : '') }, val))));
              pC.body.replaceChildren(h('div', { class: 'grid-3', style: { gap: '10px' } },
                col('Identification', [['PID', v('31')], ['Parent', v('PID 12')], ['User ID', v('1004')]]),
                col('Processor state', [['PC', v('entry 0x0400')], ['SP', v('top of stack')], ['Others', v('all 0')], ['PSW', v('user mode')]]),
                col('Process control', [['State', v(room ? 'Ready' : 'Ready/Suspend')], ['Priority', v('default')], ['Owns', v('nothing yet')], ['Next in queue', done >= 4 ? 'none (tail)' : '—']])));
            }
            /* 4. queues */
            const q = (name, ids, add) => h('div', { class: 'row', style: { gap: '5px', marginBottom: '4px' } }, h('span', { class: 'small b', style: { width: '112px' } }, name),
              ...ids.flatMap((id, i) => [i ? arrow() : null, chip('proc', id)]), add ? arrow() : null, add ? chip('accent', '31') : null);
            pD.body.replaceChildren(q('Running', ['12'], false), q('Ready', ['17', '23'], done >= 4 && room), q('Ready/Suspend', ['5'], done >= 4 && !room));
            /* 5. accounting: one record per process, the new one last */
            pE.body.replaceChildren(h('div', { class: 'row', style: { gap: '5px' } }, chip('', '12: 2.6 s'), chip('', '17: 4.2 s'), chip('', '23: 9.8 s'), chip('', '5: 1.1 s'), done >= 5 ? chip('accent', '31: 0 s') : null));
            if (flashN) { const p = pans[flashN - 1]; p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash'); }
            /* buttons */
            btns.forEach((b) => {
              const k = b.k, isDone = k < done;
              b.classList.toggle('done', isDone);
              b.querySelector('.num').textContent = isDone ? String(k + 1) : '?';
            });
            progress.textContent = `${done} of 5 steps · wrong picks: ${slips}`;
          };
          const fb = h('div', { class: 'msg', style: { minHeight: '112px' } });
          const progress = h('span', { class: 'small b muted' });
          const btns = SHOWN.map((k) => {
            const b = h('button', { class: 'btn stepbtn', type: 'button', onclick: () => choose(k) }, h('span', { class: 'num' }, '?'), h('span', {}, ST[k].label));
            b.k = k; return b;
          });
          const choose = (k) => {
            const b = btns.find((x) => x.k === k);
            if (done >= 5) { say(fb, 'info', 'Process 31 is built', 'Press <b>Start over</b> to build it again, or change the memory setting.'); return; }
            if (k < done) { say(fb, 'info', 'Already done', `Step ${k + 1} is finished. Which step comes next?`); return; }
            if (k === done) {
              done++;
              const d = typeof ST[k].did === 'function' ? ST[k].did(room) : ST[k].did;
              draw(k + 1);
              if (done < 5) say(fb, 'ok', `Step ${k + 1} · ${ST[k].label}`, d);
              else say(fb, 'ok', 'Step 5 done: process 31 exists', `${d} ${room ? 'When it is dispatched' : 'Once swapped in, it becomes Ready; when dispatched'}, its PCB’s processor state is loaded, so it starts at its entry point in user mode.`);
              return;
            }
            slips++;
            b.classList.add('bad'); ctx.after(700, () => b.classList.remove('bad'));
            draw();
            say(fb, 'bad', 'Not yet', ST[k].early);
          };
          const reset = () => { done = 0; slips = 0; draw(); say(fb, 'info', 'Which step comes first?', 'Click the step the OS must do next. The numbered panels fill in as you go; each number shows which step fills that panel.'); };
          const seg = ctx.ui.seg([{ value: true, label: 'Memory has room' }, { value: false, label: 'Memory is full' }], room, (v) => { room = v; reset(); });
          reset();

          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: 'The desktop (PID 12) asks the OS to start <b>Music</b>. You are the OS: pick the step that comes next.' }),
              seg,
              h('div', { class: 'stack', style: { gap: '6px', flex: 'none' } }, ...btns),
              fb,
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, progress, h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Start over'))),
            h('div', { class: 'card white', style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)', gap: '10px', alignContent: 'start' } },
              pA, pB, h('div', { style: { gridColumn: '1 / -1' } }, pC), pD, pE)));
        },
      },

      /* ============ 5. Interrupt, trap or supervisor call? (event sorter) ============ */
      {
        title: 'Interrupt, trap or system call? Sort the events',
        kind: 'predict',
        render(el, ctx) {
          const { h } = ctx;
          const TYPES = ['Interrupt', 'Trap', 'Supervisor call'];
          const FATES = ['Keeps running', '→ Ready', '→ Blocked', '→ Exit'];
          /* type: index into TYPES, fate: index into FATES (what happens to the process that was running) */
          const EV = [
            { text: 'The system timer fires. The running process P1 has now used its whole time slice.', type: 0, fate: 1,
              why: 'A <b>clock interrupt</b>: it comes from the timer, not from P1’s instruction. P1 is out of time, so the OS puts it back in Ready and dispatches another process.' },
            { text: 'P1 divides a number by zero. It has not arranged any way to handle that error.', type: 1, fate: 3,
              why: 'A <b>trap</b>: the error comes from P1’s own instruction. With no handler of its own, the error is fatal, so the OS moves P1 to Exit and gives the processor to someone else.' },
            { text: 'P2 calls open() on a file, and the OS has to read the file’s directory entry from disk first.', type: 2, fate: 2,
              why: 'A <b>supervisor call</b>: P2 asked on purpose. The OS starts the disk read and, since P2 cannot continue without it, blocks P2 and dispatches another process.' },
            { text: 'The disk finishes a read that P3 (Blocked) was waiting for. P3 is no more urgent than the running P1.', type: 0, fate: 0,
              why: 'An <b>I/O interrupt</b>. The OS moves P3 from Blocked to Ready, then asks whether to preempt P1. P3 is no more urgent, so P1 resumes: a mode switch into the kernel and back, no process switch.' },
            { text: 'The running P2 jumps to a part of its own program that is still on disk, not yet in main memory.', type: 0, fate: 2,
              typeHint: 'The instruction itself is perfectly valid. The problem is a fact about memory, outside the instruction: that part of the program simply is not loaded yet.',
              why: 'A <b>memory fault</b>, which counts as an interrupt: nothing is wrong with the instruction; the code is just not in memory. The OS starts reading it in, blocks P2 until the read finishes, and runs someone else.' },
            { text: 'P1 asks the OS for the current time of day.', type: 2, fate: 0,
              why: 'A <b>supervisor call</b> the OS can answer at once from its own clock. P1 goes straight back to running: a mode switch into the kernel and back, no process switch.' },
            { text: 'P4, running in user mode, tries to switch interrupts off.', type: 1, fate: 3,
              why: 'A <b>trap</b>: the instruction is privileged and the mode bit says user. The OS treats it as a fatal error and terminates P4.' },
            { text: 'A network message arrives for P5, which was Blocked waiting for it. P5 is more urgent than the running P1.', type: 0, fate: 1,
              why: 'An <b>I/O interrupt</b>. P5 becomes Ready, and because it is more urgent than P1, the OS preempts P1 (back to Ready) and dispatches P5.' },
          ];
          const WRONG_TYPE = {
            '0-1': 'An interrupt comes from outside the running instruction. Here the instruction itself went wrong.',
            '0-2': 'The program asked for this on purpose. Nobody asks for an interrupt.',
            '1-0': 'A trap means the current instruction caused an error. This event comes from outside the instruction: a device, the clock or the memory system.',
            '1-2': 'Nothing went wrong here. The program deliberately asked the OS for a service.',
            '2-0': 'The running program did not ask for anything. This came from outside it.',
            '2-1': 'The program did not ask for this. Its instruction failed.',
          };
          const WRONG_FATE = [
            'Can the running process really carry on straight away? Is it out of time, waiting for something, finished, or pushed aside?',
            '“Ready” means able to run, just not right now. Is that the situation here?',
            '“Blocked” means waiting for some event, such as a disk read. Is the process actually waiting for anything?',
            '“Exit” means the process is finished for good. Did anything end it?',
          ];
          let i = 0, st = null, firstT = 0, firstF = 0, res = [];
          const dots = h('div', { class: 'dots', title: 'Green: both right first time. Amber: needed a second try.' });
          const paintDots = () => dots.replaceChildren(...EV.map((_, k) => h('span', { class: (res[k] || '') + (k === i ? ' cur' : '') })));
          const count = h('span', { class: 'chip accent' });
          const scores = h('span', { class: 'small b muted' });
          const evtext = h('div', { class: 'evtext' });
          const fb = h('div', { class: 'msg', style: { minHeight: '150px' } });
          const next = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { if (i < EV.length && st.type.done && st.fate.done) { i++; show(); } } }, 'Next event →');
          const tBtns = TYPES.map((t, k) => h('button', { class: 'btn ans', type: 'button', onclick: () => answer('type', k) }, t));
          const fBtns = FATES.map((t, k) => h('button', { class: 'btn ans', type: 'button', onclick: () => answer('fate', k) }, t));
          const paintScore = () => { scores.textContent = `Right first time: ${firstT} mechanisms · ${firstF} outcomes`; paintDots(); };
          const show = () => {
            [...tBtns, ...fBtns].forEach((b) => b.classList.remove('right', 'wrong', 'late'));
            paintScore();
            if (i >= EV.length) {
              count.textContent = 'All done';
              evtext.innerHTML = `All ${EV.length} events sorted. Mechanism right first time: <span style="color:var(--ok)">${firstT}/${EV.length}</span>, outcome: <span style="color:var(--ok)">${firstF}/${EV.length}</span>.`;
              say(fb, 'ok', 'The pattern', 'The OS only regains the processor through an interrupt, a trap or a supervisor call. Whether a <span class="t">process switch</span> follows depends on the running process: if it can carry on, the OS just returns (a mode switch); if it is out of time, waiting, finished or outranked, the OS switches.');
              next.disabled = true; return;
            }
            st = { type: { done: false, tries: 0 }, fate: { done: false, tries: 0 } };
            count.textContent = `Event ${i + 1} of ${EV.length}`;
            evtext.textContent = EV[i].text;
            next.disabled = true;
            say(fb, 'info', 'Two questions', 'First: which mechanism handed control to the OS? Second: what happens to the process that was running?');
          };
          const answer = (which, k) => {
            if (i >= EV.length) return;
            const ev = EV[i], s = st[which], right = ev[which], list = which === 'type' ? tBtns : fBtns;
            if (s.done) return;
            if (k === right) {
              s.done = true; list[k].classList.add(s.tries ? 'late' : 'right');
              if (!s.tries) { if (which === 'type') firstT++; else firstF++; }
            } else {
              s.tries++; list[k].classList.add('wrong');
              if (s.tries >= 2) { s.done = true; list[right].classList.add('late'); }
            }
            paintScore();
            if (st.type.done && st.fate.done) {
              const sw = ev.fate !== 0;
              res[i] = st.type.tries || st.fate.tries ? 'late' : 'ok'; paintDots();
              say(fb, sw ? 'warn' : 'ok', `${TYPES[ev.type]} · ${FATES[ev.fate].replace('→ ', 'moves to ')} · ${sw ? 'process switch' : 'mode switch only'}`, ev.why);
              next.disabled = false;
            } else if (k === right || s.done) {
              say(fb, 'ok', k === right ? 'Right' : `The answer is “${which === 'type' ? TYPES[right] : FATES[right]}”`, 'Now answer the other question.');
            } else if (which === 'type') {
              say(fb, 'bad', `Not a ${TYPES[k].toLowerCase()}`, (ev.typeHint && right === 0) ? ev.typeHint : WRONG_TYPE[k + '-' + right]);
            } else {
              say(fb, 'bad', 'Think again', WRONG_FATE[k]);
            }
          };
          const reset = () => { i = 0; firstT = 0; firstF = 0; res = []; show(); };
          show();

          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'm0', html: 'The OS is just software: it can act only when it gets the processor back. That happens in exactly three ways.' }),
              h('table', { class: 'tbl compact' },
                h('tr', {}, h('th', {}, 'Mechanism'), h('th', {}, 'Caused by'), h('th', {}, 'Examples')),
                h('tr', {}, h('td', { class: 'b' }, h('span', { class: 't' }, 'Interrupt')), h('td', {}, 'something outside the current instruction'), h('td', { html: '<span class="t">clock interrupt</span> (time slice up), I/O interrupt (a device finished), <span class="t">memory fault</span>' })),
                h('tr', {}, h('td', { class: 'b' }, h('span', { class: 't' }, 'Trap')), h('td', {}, 'an error or exception in the current instruction'), h('td', {}, 'divide by zero, privileged instruction in user mode')),
                h('tr', {}, h('td', { class: 'b', html: '<span class="t">Supervisor call</span><div class="xs muted" style="font-weight:600">(system call)</div>' }), h('td', {}, 'an explicit request by the program'), h('td', {}, 'open a file, read data, ask the time'))),
              h('div', { class: 'callout tip small m0', 'data-label': 'Traps come in two kinds', html: '<b>Fatal</b>: the OS ends the process, which moves to Exit. <b>Recoverable</b>: the OS fixes or reports the problem, and the process may carry on.' }),
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'If the running process can simply carry on, the OS returns to it: only a <span class="t">mode switch</span> happened. Any other outcome needs a full process switch, which costs far more.' })),
            h('div', { class: 'card white stack', style: { gap: '10px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, count, scores),
              evtext,
              h('div', {}, h('div', { class: 'qlab' }, '1 · What handed control to the OS?'), h('div', { class: 'row', style: { gap: '8px' } }, ...tBtns)),
              h('div', {}, h('div', { class: 'qlab' }, '2 · What happens to the process that was running?'), h('div', { class: 'row', style: { gap: '8px' } }, ...fBtns)),
              fb,
              h('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: 'auto' } }, h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Start over'), dots, next))));
        },
      },

      /* ============ 6. Mode switch vs process switch (side by side) ============ */
      {
        title: 'Mode switch vs process switch',
        kind: 'compare',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          /* time (illustrative units) reached at the end of each frame; lane B sets the pace */
          const T = [4, 5, 6, 8, 9, 10, 12, 13, 15, 17, 24];
          const A_ACTS = [['Enter kernel (mode switch)', 1], ['Handler: slice not used up', 1], ['Return to P1 (mode switch)', 1]];
          const B_ACTS = [['Enter kernel (mode switch)', 1], ['Handler: slice is used up', 1], ['1 · Save P1’s context', 2], ['2 · Update P1’s PCB', 1], ['3 · P1 → Ready queue', 1],
            ['4 · Select P2', 2], ['5 · Update P2’s PCB', 1], ['6 · Switch memory map', 2], ['7 · Restore P2’s context', 2]];
          const CAP = [
            '<b>Two identical starts.</b> In both lanes P1 has run for 4 units in user mode. Then the <span class="t">clock interrupt</span> fires.',
            '<b>Mode switch into the kernel.</b> When P1’s current instruction finishes, the processor notices the pending interrupt. The hardware saves P1’s program counter and PSW, sets the mode bit to kernel and jumps to the clock handler. P1 is still the Running process: nothing about it has changed.',
            '<b>The handler decides.</b> Lane A: P1 still has time left in its <span class="t">time slice</span>, so there is nothing more to do. Lane B: P1’s slice is used up, so the OS must switch processes.',
            '<b>Lane A is finished:</b> a return instruction restores P1’s PC and PSW, the mode bit goes back to user, and P1 carries on. Lane B starts the switch: step 1 copies P1’s whole <span class="t">context</span> (the PC and PSW the hardware put aside, plus every other register) into P1’s PCB.',
            'Lane B, step 2: update P1’s PCB (state Running → Ready, the reason, the time it used). Meanwhile lane A is running P1’s code.',
            'Lane B, step 3: link P1’s PCB into the Ready queue.',
            'Lane B, step 4: the scheduler chooses the next process to run: P2.',
            'Lane B, step 5: update P2’s PCB: state Ready → Running.',
            'Lane B, step 6: update the memory-management structures so that addresses now lead to P2’s memory, not P1’s.',
            'Lane B, step 7: load P2’s saved context into the registers. The mode bit returns to user and P2 runs. The whole switch cost 13 units of OS work against 3.',
            '<b>The bill after 24 units.</b> Lane A: 3 units of OS work, 21 of useful work. Lane B: 13 units of OS work, only 11 useful. On top of that, P2 then runs slowly for a while because the <span class="t" data-t="cache memory">cache</span> still holds P1’s data. (Units are illustrative; the ratio is the point.)',
          ];
          const NW = ctx.narrow, VBW = NW ? 320 : 540, X0 = 10, CW = NW ? 12.5 : 21.5, NC = 24;
          const cellX = (c) => X0 + c * CW;
          const mkLane = (key, title, sub, acts, cols) => {
            const svg = s('svg', { viewBox: `0 0 ${VBW} 66`, width: '100%', role: 'img', 'aria-label': 'Timeline of who uses the processor in lane ' + key });
            const chips = h('div', { class: 'row', style: { gap: '6px' } });
            const list = h('div', { class: 'acts', style: { gridTemplateColumns: `repeat(${ctx.narrow ? 1 : cols}, minmax(0, 1fr))`, gridAutoFlow: ctx.narrow ? 'row' : 'column', gridTemplateRows: ctx.narrow ? 'none' : `repeat(${Math.ceil(acts.length / cols)}, auto)` } });
            const items = acts.map(([t, c]) => { const it = h('div', { class: 'act' }, h('span', { class: 'ck' }), h('span', {}, t), h('span', { class: 'c' }, '+' + c)); list.append(it); return it; });
            const cost = h('span', { class: 'small b' });
            const meter = h('div', { class: 'meter grow' }, h('i', { style: { width: '0%' } }));
            const note = h('div', { class: 'small', style: { minHeight: '0' } });
            const card = h('div', { class: 'card white lane' },
              h('div', {}, h('h3', { class: 'm0', style: { fontSize: '17px' } }, title), h('div', { class: 'small muted' }, sub)),
              svg, chips, list, note, h('div', { class: 'row nw', style: { marginTop: 'auto' } }, cost, meter));
            return { svg, chips, items, cost, meter, note, card, acts };
          };
          const A = mkLane('A', 'A · Mode switch only', 'Clock tick; P1 has time left in its slice', A_ACTS, 1);
          const B = mkLane('B', 'B · Mode switch + process switch', 'Clock tick; P1’s time slice is used up', B_ACTS, 2);
          const drawGantt = (L, cells, t) => {
            /* the empty timeline, then one bar per run of the same owner, labelled P1, kernel or P2 */
            const kids = [s('rect', { x: X0, y: 20, width: NC * CW, height: 26, rx: 5, class: 's-panel', 'stroke-width': 1.2, 'stroke-dasharray': '4 3' })];
            for (let c = 0; c < t;) {
              let e = c; while (e + 1 < t && cells(e + 1) === cells(c)) e++;
              const os = cells(c) === 'OS', x = cellX(c) + 1, w = cellX(e + 1) - cellX(c) - 2;
              kids.push(s('rect', { x, y: 20, width: w, height: 26, rx: 5, class: os ? 's-os' : 's-proc', 'stroke-width': 1.8 }));
              if (e > c && w >= 24) kids.push(s('text', { x: x + w / 2, y: 38, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:' + (os ? 'var(--os)' : 'var(--proc)') }, os ? (w >= 48 ? 'kernel' : 'OS') : cells(c)));
              c = e + 1;
            }
            for (let c = 0; c <= NC; c += 4) kids.push(s('line', { x1: cellX(c), y1: 47, x2: cellX(c), y2: 51, class: 's-line', 'stroke-width': 1.2 }), s('text', { x: cellX(c), y: 64, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(c)));
            kids.push(s('path', { d: `M${cellX(4) - 6},4 L${cellX(4) + 6},4 L${cellX(4)},14 Z`, style: 'fill:var(--intr)' }),
              s('text', { x: cellX(4) + 10, y: 14, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--intr)' }, 'clock interrupt'));
            kids.push(s('line', { x1: cellX(t), y1: 16, x2: cellX(t), y2: 50, stroke: 'var(--accent)', 'stroke-width': 2.5 }));
            L.svg.replaceChildren(...kids);
          };
          const chip = (cls, t) => h('span', { class: 'chip ' + cls }, t);
          const drawLane = (L, f, doneAt) => {
            let units = 0;
            L.items.forEach((it, k) => {
              const d = f >= k + 1 && k < doneAt + 1;
              it.className = 'act' + (f === k + 1 ? ' cur' : d ? ' done' : '');
              it.firstChild.textContent = d ? '✓' : '';
              if (d) units += L.acts[k][1];
            });
            L.cost.textContent = `OS work: ${units} unit${units === 1 ? '' : 's'}`;
            L.meter.firstChild.style.width = (units / 13) * 100 + '%';
            return units;
          };
          const render = (f) => {
            const t = T[f];
            /* lane A: P1 0-3, OS 4-6, P1 after */
            drawGantt(A, (c) => (c >= 4 && c <= 6 ? 'OS' : 'P1'), t);
            drawGantt(B, (c) => (c < 4 ? 'P1' : c <= 16 ? 'OS' : 'P2'), t);
            drawLane(A, f, 2);
            drawLane(B, f, 8);
            const aK = f >= 1 && f <= 2, bK = f >= 1 && f <= 8;
            A.chips.replaceChildren(chip(aK ? 'os' : 'proc', 'mode: ' + (aK ? 'kernel' : 'user')), chip(aK ? 'os' : 'cpu', 'CPU runs: ' + (aK ? 'OS' : 'P1')), chip('proc', 'P1: Running'), chip('', 'P2: Ready'));
            B.chips.replaceChildren(chip(bK ? 'os' : 'proc', 'mode: ' + (bK ? 'kernel' : 'user')), chip(bK ? 'os' : 'cpu', 'CPU runs: ' + (f >= 9 ? 'P2' : bK ? 'OS' : 'P1')),
              chip(f >= 4 ? '' : 'proc', 'P1: ' + (f >= 4 ? 'Ready' : 'Running')), chip(f >= 7 ? 'proc' : '', 'P2: ' + (f >= 7 ? 'Running' : 'Ready')));
            A.note.innerHTML = f >= 3 ? '<div class="callout tip m0" data-label="Notice">P1 never left the Running state. Only the <b>mode</b> changed: into the kernel and straight back. That is why a mode switch is cheap.</div>' : '';
            B.note.innerHTML = f >= 10 ? '<div class="small muted">Every one of steps 1–7 touches memory the OS must read or write. The next step shows them one by one.</div>' : '';
            return CAP[f];
          };
          const legend = h('div', { class: 'row small', style: { gap: '14px' } },
            h('span', { html: '<span class="legend-sq" style="background:var(--proc-bg);border-color:var(--proc)"></span>a process running its own code (user mode)' }),
            h('span', { html: '<span class="legend-sq" style="background:var(--os-bg);border-color:var(--os)"></span>the OS working (kernel mode)' }),
            h('span', { class: 'muted' }, 'Time in illustrative units'));
          const player = ctx.ui.player({ count: CAP.length, render, interval: 2600 });
          const lanes = h('div', { class: 'grid-2 grow', style: { gap: '14px' } }, A.card, B.card);

          /* ---- second view: add up the cost over 100 clock ticks (slider-driven) ---- */
          const MODE_COST = 3, SWITCH_COST = 13, TICKS = 100;
          const cells = Array.from({ length: TICKS }, () => h('i', { style: NW ? { height: '26px' } : {} }));
          const tickGrid = h('div', { class: 'tickgrid', style: { gridTemplateColumns: `repeat(${NW ? 10 : 20}, minmax(0, 1fr))` } }, ...cells);
          const sum = h('div', { class: 'msg info' });
          const meterMode = h('div', { class: 'meter grow' }, h('i', { style: { background: 'var(--os)' } }));
          const meterSw = h('div', { class: 'meter grow' }, h('i', { style: { background: 'var(--warn)' } }));
          const lblMode = h('span', { class: 'small b', style: { width: NW ? '84px' : '92px', textAlign: 'right', whiteSpace: 'nowrap' } });
          const lblSw = h('span', { class: 'small b', style: { width: NW ? '84px' : '92px', textAlign: 'right', whiteSpace: 'nowrap' } });
          const paintTicks = (n) => {
            const sw = Math.floor(TICKS / n), only = TICKS - sw, work = sw * SWITCH_COST + only * MODE_COST;
            cells.forEach((c, i) => { c.className = (i + 1) % n === 0 ? 'ps' : ''; });
            const div = TICKS % n === 0 ? `100 ÷ ${n} = <b>${sw}</b>` : `100 ÷ ${n} = ${ctx.util.fmt(TICKS / n, 1)}, so <b>${sw}</b> whole slices end`;
            say(sum, 'info', `${n === 1 ? 'Every tick' : `Every ${n}${['', '', 'nd', 'rd'][n] || 'th'} tick`} ends a time slice`,
              `${div} ⇒ ${sw} process switch${sw === 1 ? '' : 'es'}. The other 100 − ${sw} = <b>${only}</b> ticks are only a mode switch into the kernel and back.<br>OS work: ${sw} × ${SWITCH_COST} + ${only} × ${MODE_COST} = <b>${work} units</b>.`);
            meterMode.firstChild.style.width = (TICKS * MODE_COST / (TICKS * SWITCH_COST)) * 100 + '%';
            meterSw.firstChild.style.width = (work / (TICKS * SWITCH_COST)) * 100 + '%';
            lblMode.textContent = TICKS * MODE_COST + ' units'; lblSw.textContent = work + ' units';
          };
          const slider = ctx.ui.slider({ label: 'Clock ticks per time slice', min: 1, max: 10, step: 1, value: 5, format: (v) => `${v} tick${v === 1 ? '' : 's'}`, onInput: (v) => paintTicks(+v) });
          const calc = h('div', { class: 'split fill', style: { display: 'none', gap: '18px' } },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('h3', { class: 'm0' }, 'Add it up over 100 clock ticks'),
              h('p', { class: 'small m0', html: 'Suppose the only interrupts are clock ticks and every process uses its whole <span class="t">time slice</span>. Each tick costs a mode switch (3 units, as in lane A). The tick that ends a slice costs a full process switch instead (13 units, as in lane B).' }),
              slider, sum,
              h('div', { class: 'callout tip small m0', 'data-label': 'Try it', html: 'Drag to <b>1 tick</b>: every interrupt now ends a slice, so all 100 are process switches. Drag to <b>10 ticks</b>: only 10 are, and the OS work drops to 400 units.' }),
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'Shorter slices mean more process switches, so more of the processor goes to OS work. Longer slices waste less, but every other process waits longer for its turn. Picking the slice is a balance.' })),
            h('div', { class: 'card white stack', style: { gap: '10px' } },
              h('h4', { class: 'm0' }, 'The 100 clock interrupts in time order, one square each'),
              tickGrid,
              h('div', { class: 'row small', style: { gap: '14px' } },
                h('span', { html: '<span class="legend-sq" style="background:var(--os-bg);border-color:var(--os)"></span>mode switch only (3 units)' }),
                h('span', { html: '<span class="legend-sq" style="background:var(--warn-bg);border-color:var(--warn)"></span>ends a slice: process switch (13 units)' })),
              h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'small', style: { width: NW ? '92px' : '172px' } }, NW ? 'No slice ends' : 'If no tick ended a slice'), meterMode, lblMode),
              h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'small', style: { width: NW ? '92px' : '172px' } }, NW ? 'Your slice' : 'With your slice length'), meterSw, lblSw),
              h('p', { class: 'small muted m0', html: 'Why 13 and not 3 + 13? A slice-ending tick still enters the kernel, but it leaves by restoring <i>another</i> process instead of returning to the old one, so lane B’s 13 units already include the trip in.' })));
          paintTicks(5);
          const view = ctx.ui.seg([{ value: 'one', label: 'One clock tick' }, { value: 'many', label: '100 clock ticks' }], 'one', (v) => {
            const many = v === 'many';
            if (many) player.stop();
            lanes.style.display = many ? 'none' : '';
            player.el.style.display = many ? 'none' : '';
            legend.style.display = many ? 'none' : '';
            calc.style.display = many ? '' : 'none';
            ctx.refit();
          });
          view.style.marginLeft = 'auto';
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '10px' } }, legend, view),
            lanes, calc,
            player.el));
        },
      },

      /* ============ 7. The seven steps of a process switch (animated) ============ */
      {
        title: 'The seven steps of a process switch',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const REASONS = {
            timeout: { lane: 'ready', st: 'Ready', label: 'Time slice up', why: 'its time slice ran out',
              trig: 'the <b>clock interrupt</b> fires: P1’s time slice is used up.', where: 'Ready queue', extra: 'It goes to the back of the line, behind P5.' },
            io: { lane: 'blocked', st: 'Blocked', label: 'Waits for disk', why: 'waiting for a disk read',
              trig: 'P1 makes a <b>system call</b> to read from the disk, and it cannot continue until the data arrives.', where: 'queue of processes blocked on the disk', extra: 'It stays there until the disk’s interrupt announces that its data has arrived.' },
            suspend: { lane: 'rs', st: 'Ready/Suspend', label: 'Swapped out', why: 'swapped out to free memory',
              trig: 'a <b>clock interrupt</b> ends P1’s turn, and memory is so short that the OS decides to swap P1 out to disk.', where: 'Ready/Suspend queue', extra: 'Its memory image is written out to disk, freeing room for others.' },
          };
          const LIST = ['Enter the kernel (a mode switch)', 'Save the context of the processor', 'Update the PCB of the running process', 'Move that PCB to the right queue',
            'Select another process to run', 'Update the PCB of the selected process', 'Update memory-management structures', 'Restore the context of the selected process'];
          let reason = 'timeout';
          const stateAt = (f, R) => {
            const lanes = { run: ['P1'], ready: ['P2', 'P5'], blocked: ['P3'], rs: ['P4'] };
            if (f >= 4) { lanes.run = []; lanes[R.lane] = lanes[R.lane].concat('P1'); }
            if (f >= 6) { lanes.run = ['P2']; lanes.ready = lanes.ready.filter((x) => x !== 'P2'); }
            const cpu = f === 0 ? { pc: 'P1', sp: 'P1', regs: 'P1', mode: 'user' } : f === 1 ? { pc: 'OS', sp: 'OS', regs: 'P1', mode: 'kernel' }
              : f < 8 ? { pc: 'OS', sp: 'OS', regs: 'OS', mode: 'kernel' } : { pc: 'P2', sp: 'P2', regs: 'P2', mode: 'user' };
            const HL = [[], ['cpu'], ['P1', 'cpu'], ['P1'], ['P1'], ['P2'], ['P2'], ['mem'], ['cpu', 'P2']];
            return {
              lanes, cpu, mem: f >= 7 ? 'P2' : 'P1', arrow: f === 2 ? 'save' : f === 8 ? 'restore' : null, hl: HL[f],
              pcb: { P1: { st: f < 3 ? 'Running' : R.st, ctx: f < 2 ? 'cpu' : 'saved' }, P2: { st: f < 6 ? 'Ready' : 'Running', ctx: f < 8 ? 'saved' : 'cpu', sel: f === 5 } },
            };
          };
          const caption = (f, R) => [
            `<b>Before.</b> P1 is Running in user mode, so the CPU registers hold P1’s values. P2 and P5 wait in the Ready queue. Then ${R.trig}`,
            `<b>Into the kernel.</b> ${R.lane === 'blocked' ? 'The system call instruction hands control to the OS:' : 'When P1’s current instruction finishes, the processor notices the pending interrupt:'} the hardware saves P1’s program counter and PSW, sets the mode bit to kernel and jumps into the OS. So far this is only a mode switch: P1 is still the Running process.`,
            '<b>Step 1 · Save the context of the processor.</b> The OS copies P1’s program counter, stack pointer, PSW and other registers into P1’s PCB. Now the OS can use the registers without destroying anything.',
            `<b>Step 2 · Update the PCB of the running process.</b> P1’s state changes from Running to ${R.st}. The OS also records why (${R.why}) and adds the processor time P1 just used to its accounting fields.`,
            `<b>Step 3 · Move the PCB to the right queue.</b> P1’s PCB joins the ${R.where}. ${R.extra}`,
            '<b>Step 4 · Select another process.</b> The scheduler looks at the Ready queue and picks P2, the process at its head. How it chooses is the job of scheduling, a topic of its own.',
            '<b>Step 5 · Update the PCB of the selected process.</b> P2’s state changes from Ready to Running.',
            '<b>Step 6 · Update the memory-management structures.</b> The memory map now points to P2’s <b>page table</b> (the table that turns a process’s addresses into real memory locations), so every address P2 uses reaches P2’s memory and nothing else.',
            '<b>Step 7 · Restore the context of the selected process.</b> P2’s saved program counter, stack pointer, PSW and registers are loaded back into the CPU. The mode bit is user again and P2 carries on exactly where it stopped.',
          ][f];
          const scene = switchScene(ctx);
          const items = LIST.map((t, k) => h('div', { class: 'act', style: { padding: '4px 8px', fontSize: '14.5px' } }, h('span', { class: 'ck' }), h('span', { class: 'n' }, k ? String(k) : '·'), h('span', {}, t)));
          const render = (f) => {
            const R = REASONS[reason];
            scene.set(stateAt(f, R));
            items.forEach((it, k) => { it.className = 'act' + (f === k + 1 ? ' cur' : f > k + 1 ? ' done' : ''); it.firstChild.textContent = f > k + 1 ? '✓' : ''; });
            return caption(f, R);
          };
          const player = ctx.ui.player({ count: 9, render, interval: 2800 });
          const seg = ctx.ui.seg(Object.entries(REASONS).map(([value, r]) => ({ value, label: r.label })), reason, (v) => { reason = v; player.reset(); });
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 1fr) 372px', gap: '20px' } },
            h('div', { class: 'card white stack', style: { gap: '10px' } }, scene.svg, SCENE_LEGEND(ctx), player.el),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', {}, h('h4', { class: 'm0', style: { marginBottom: '6px' } }, 'Why is P1 leaving the CPU?'), seg),
              h('div', { class: 'card tight stack', style: { gap: '2px' } }, ...items),
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Thinking every interrupt means a process switch. Every interrupt causes a <b>mode switch</b>, but the OS often just returns to the process it interrupted.' }))));
        },
      },

      /* ============ 8. Your turn: perform the switch in a safe order ============ */
      {
        title: 'Your turn: perform a process switch',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const LABEL = [null, 'Save the context of the processor', 'Update the PCB of the running process', 'Move that PCB to the appropriate queue',
            'Select another process to run', 'Update the PCB of the selected process', 'Update memory-management structures', 'Restore the context of the selected process'];
          const DID = [null,
            'P1’s program counter, stack pointer, PSW and other registers are now safe in its PCB. The OS can use the registers freely.',
            'P1’s PCB now says <b>Blocked</b>, with the reason (waiting for disk block 812) and the processor time it used.',
            'P1’s PCB joins the queue of processes blocked on the disk. When the disk interrupt reports the data has arrived, the OS will move it to Ready.',
            'The scheduler looks at the Ready queue and picks <b>P2</b>, the process at its head.',
            'P2’s PCB now says <b>Running</b>.',
            'The memory map now points to P2’s page table, so P2’s addresses reach P2’s memory and nothing else.',
            'P2’s saved registers are back in the CPU, the mode bit is user, and P2 carries on exactly where it stopped.',
          ];
          const DEPS = { 1: [], 2: [1], 3: [2], 4: [3], 5: [4], 6: [4], 7: [5, 6] };
          const SHOWN = [4, 1, 7, 3, 6, 2, 5];
          const HL = [[], ['P1', 'cpu'], ['P1'], ['P1'], ['P2'], ['P2'], ['mem'], ['cpu', 'P2']];
          let D = new Set(), last = 0, slips = 0, bad = false;
          const scene = switchScene(ctx);
          const stateFrom = () => {
            const lanes = { run: ['P1'], ready: ['P2', 'P5'], blocked: ['P3'], rs: ['P4'] };
            if (D.has(3)) { lanes.run = []; lanes.blocked = ['P3', 'P1']; }
            if (D.has(5)) { lanes.run = ['P2']; lanes.ready = ['P5']; }
            const cpu = D.has(7) ? { pc: 'P2', sp: 'P2', regs: 'P2', mode: 'user' } : { pc: 'OS', sp: 'OS', regs: D.has(1) ? 'OS' : 'P1', mode: 'kernel' };
            return {
              lanes, cpu, mem: D.has(6) ? 'P2' : 'P1', arrow: last === 1 ? 'save' : last === 7 ? 'restore' : null, hl: bad ? [] : HL[last], cpuBad: bad,
              pcb: { P1: { st: D.has(2) ? 'Blocked' : 'Running', ctx: D.has(1) ? 'saved' : 'cpu' }, P2: { st: D.has(5) ? 'Running' : 'Ready', ctx: D.has(7) ? 'cpu' : 'saved', sel: D.has(4) && !D.has(5) } },
            };
          };
          const fb = h('div', { class: 'msg', style: { minHeight: '92px' } });
          const progress = h('span', { class: 'small b muted' });
          const btns = SHOWN.map((k) => { const b = h('button', { class: 'btn stepbtn', type: 'button', style: { fontSize: '14.5px' }, onclick: () => choose(k) }, h('span', { class: 'num' }, '?'), h('span', {}, LABEL[k])); b.k = k; return b; });
          const draw = () => {
            scene.set(stateFrom());
            btns.forEach((b) => { const d = D.has(b.k); b.classList.toggle('done', d); b.querySelector('.num').textContent = d ? String(b.k) : '?'; });
            progress.textContent = `${D.size} of 7 steps · wrong picks: ${slips}`;
          };
          const whyNot = (k) => {
            if (!D.has(1)) return k === 7
              ? ['Disaster averted', 'Loading P2’s values now would overwrite the registers, which still hold P1’s unsaved values. P1’s work in progress would be lost for good and it could never resume. (Nothing was changed: try again.)']
              : ['Save first', 'Every instruction the OS runs uses the registers, and right now they still hold P1’s values. Unless those are copied into P1’s PCB before anything else, they get overwritten and P1 can never resume where it stopped.'];
            if (k === 3) return ['Update the PCB first', 'P1’s PCB still says Running. Filing a PCB marked Running in the Blocked queue would leave the OS’s records contradicting themselves.'];
            if (k === 4) return ['Finish with P1 first', 'P1’s PCB must be updated and filed in its queue, so the scheduler chooses from an up-to-date picture of who is waiting where.'];
            if (k === 5 || k === 6) return ['Select a process first', k === 5 ? 'Update which PCB? No process has been chosen to run yet.' : 'Switch the memory map to whose memory? No process has been chosen to run yet.'];
            if (k === 7) {
              if (!D.has(4)) return ['Restore whose context?', 'No process has been chosen yet. Restoring is always the very last step, because it hands the processor over.'];
              return ['Not yet', `Restoring the context hands the processor to P2 at once. ${!D.has(6) ? 'P1’s memory map is still in force, so P2’s addresses would land in P1’s memory. ' : ''}${!D.has(5) ? 'P2’s PCB still says Ready, so the records would be wrong. ' : ''}Finish the bookkeeping first.`];
            }
            return ['Not yet', 'Something must happen before this step.'];
          };
          const choose = (k) => {
            if (D.has(7)) { say(fb, 'info', 'Switch complete', 'Press <b>Start over</b> to try again.'); return; }
            if (D.has(k)) { say(fb, 'info', 'Already done', `“${LABEL[k]}” is finished. What comes next?`); return; }
            const b = btns.find((x) => x.k === k);
            if (DEPS[k].every((d) => D.has(d))) {
              const early6 = k === 6 && !D.has(5);
              D.add(k); last = k; bad = false;
              draw();
              if (k === 7) say(fb, 'ok', `Switch complete, with ${slips} wrong pick${slips === 1 ? '' : 's'}`, `${DID[7]} All seven steps are done: P1 waits safely for the disk, and P2 runs.`);
              else say(fb, 'ok', LABEL[k], DID[k] + (early6 ? ' <i>Fine: a real kernel may do this before or after updating P2’s PCB; the usual list updates the PCB first.</i>' : ''));
              return;
            }
            slips++;
            const [t, msg] = whyNot(k);
            b.classList.add('bad'); ctx.after(700, () => b.classList.remove('bad'));
            if (k === 7 && !D.has(1)) { bad = true; draw(); ctx.after(900, () => { bad = false; draw(); }); } else draw();
            say(fb, 'bad', t, msg);
          };
          const reset = () => { D = new Set(); last = 0; slips = 0; bad = false; draw(); say(fb, 'info', 'The OS is in kernel mode. What first?', 'Click the seven steps in an order that keeps both processes safe. A wrong pick changes nothing, but you will see what it would have broken.'); };
          reset();
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 1fr) 400px', gap: '20px' } },
            h('div', { class: 'card white stack', style: { gap: '10px' } }, scene.svg, SCENE_LEGEND(ctx), fb),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'P1 just made a <span class="t">system call</span> to read the disk, so it must wait. The OS is already in kernel mode. <b>Switch the processor to P2</b> safely.' }),
              ...btns,
              h('div', { class: 'callout tip small m0', 'data-label': 'Tip', html: 'Before each click, ask: <i>what would be lost or wrong if I did this now?</i>' }),
              h('div', { class: 'row nw', style: { justifyContent: 'space-between', marginTop: 'auto' } }, progress, h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Start over')))));
        },
      },

      /* ============ 9. Recap ============ */
      {
        title: 'Recap: six ideas about process control',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          const arrow = () => h('span', { class: 'muted b', style: { fontSize: '20px', alignSelf: 'center' } }, '→');
          const flow = h('div', { class: 'row nw', style: { gap: '8px', alignItems: 'stretch' } },
            h('div', { class: 'box intr small', style: { flex: '1' }, html: '<b>An event</b><br>interrupt, trap or supervisor call' }), arrow(),
            h('div', { class: 'box os small', style: { flex: '1' }, html: '<b>Mode switch</b><br>save PC + PSW, enter the kernel' }), arrow(),
            h('div', { class: 'box small', style: { flex: '1' }, html: '<b>OS handles it</b><br>can the process carry on?' }), arrow(),
            h('div', { class: 'stack', style: { flex: '1.5', gap: '6px' } },
              h('div', { class: 'box proc small', html: '<b>Yes:</b> return to it (mode switch back)' }),
              h('div', { class: 'box cpu small', html: '<b>No:</b> full process switch, 7 steps' })));
          if (ctx.narrow) { flow.className = 'stack'; flow.querySelectorAll('.muted.b').forEach((a) => a.remove()); }
          el.append(h('div', { class: 'stack fill', style: { gap: '14px' } },
            h('p', { class: 'lead m0' }, 'Say each answer aloud, then flip. The strip below ties it together; next, section 3.5 asks where OS code itself runs.'),
            ctx.ui.flipcards([
              ['User mode vs kernel mode', 'User mode: ordinary programs; no privileged instructions, no protected memory. Kernel (system, control) mode: the OS kernel; anything goes. The mode bit in the PSW records which.'],
              ['How does the mode change?', 'User → kernel only through an interrupt, a trap or a system call, each entering the OS at a fixed address. Kernel → user when the OS executes a return instruction.'],
              ['The kernel’s four job families', 'Process management, memory management, I/O management, and support functions such as interrupt handling, accounting and monitoring.'],
              ['Creating a process: five steps', '1 assign a unique PID · 2 allocate space for the image · 3 initialize the PCB · 4 set the linkages (e.g. the Ready list) · 5 create or expand other structures.'],
              ['Three ways the OS gets control', 'Interrupt: from outside the instruction (clock, I/O, memory fault). Trap: an error in the instruction. Supervisor call: the program asks.'],
              ['Mode switch vs process switch', 'Mode switch: into the kernel and back; the same process keeps running. Process switch: save context, update PCB, queue it, select, update PCB, memory map, restore.'],
            ], { cols: 3, height: 142 }),
            h('div', { class: 'card', style: { marginTop: 'auto' } }, h('h4', {}, 'The big picture in one strip'), flow)));
        },
      },

      /* ============ 10. Check yourself ============ */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Which of these can a program running in <b>user mode</b> do on its own, without trapping to the OS?',
            choices: ['Add two numbers held in its own registers', 'Disable interrupts', 'Set the mode bit to kernel', 'Write into another process’s PCB'], answer: 0,
            feedback: [null, 'Disabling interrupts is a privileged instruction: a program that could do it would never be interrupted, so it could keep the processor forever.',
              'User code can never flip the mode bit directly. Only an interrupt, a trap or a system call switches the processor to kernel mode.',
              'PCBs live in the OS’s protected memory, so the access is refused and traps.'],
            why: 'Arithmetic on a program’s own registers harms nobody, so user mode allows it. Anything that could take control away from the OS or reach its tables is privileged or protected.' },
          { type: 'tf', q: 'The processor keeps track of whether it is in user mode or kernel mode with a bit in the program status word (PSW).', answer: true,
            why: 'The mode bit lives in the PSW. The hardware checks it before every privileged instruction and every access to protected memory.' },
          { type: 'multi', q: 'Which of these switch the processor from user mode to kernel mode?',
            choices: ['A clock interrupt', 'A system call', 'A divide-by-zero trap', 'A return-from-interrupt instruction', 'Adding two registers'], answer: [0, 1, 2],
            why: 'Interrupts, traps and system calls all enter the kernel at a pre-arranged address. The return instruction goes the other way, kernel to user, and ordinary arithmetic changes nothing.' },
          { type: 'bucket', q: 'Sort these kernel functions into their family: <b>process</b>, <b>memory</b> or <b>I/O</b> management, or <b>support</b> functions.', buckets: ['Process', 'Memory', 'I/O', 'Support'],
            items: [['Scheduling and dispatching', 0], ['Swapping', 1], ['Buffer management', 2], ['Interrupt handling', 3], ['Assigning devices to processes', 2]],
            why: 'Process management runs the life of processes; memory management decides what lives where in memory; I/O management shares devices and moves data; support functions such as interrupt handling and accounting serve the rest.' },
          { type: 'order', q: 'Put the steps the OS takes to <b>create a process</b> in order.',
            items: ['Assign a unique process identifier', 'Allocate space for the process image', 'Initialize the process control block', 'Set the linkages, such as putting it in the Ready list', 'Create or expand other data structures, such as accounting records'],
            why: 'Identity first (PID and process-table entry), then space for the image, then the PCB inside it is filled in, then the process is linked into a queue where the scheduler can find it, and finally extra bookkeeping.' },
          { q: 'When the OS initializes a brand-new process’s PCB, which set of values is typical?',
            choices: ['State Ready, program counter at the program’s entry point, no resources owned yet', 'State Running, registers copied from the parent, all of the parent’s open files',
              'State Blocked until the user types something, program counter at 0', 'State Exit, so the scheduler ignores it until the linkages are set'], answer: 0,
            feedback: [null, 'A new process is not Running yet: it waits in a queue until the dispatcher picks it. (Some systems do let a child inherit things such as open files from its parent, but the new PCB never starts in the Running state.)', 'Nothing is being waited for, so it is not Blocked. It is Ready (or Ready/Suspend if it starts on disk), and its program counter points at the program’s entry point.', 'Exit is for processes that have finished, not ones about to start.'],
            why: 'Most processor-state fields start at zero, the program counter points to the entry point and the stack pointer to the new stack. The state is Ready (or Ready/Suspend), since the OS admits the process as it creates it; the priority is the default, and it owns no resources unless it asked for some or inherits them from its parent.' },
          { type: 'match', q: 'Match each event to what hands control to the OS.',
            pairs: [['The timer signals that a time slice is over', 'Clock interrupt'], ['A program asks the OS to open a file', 'Supervisor call'], ['An instruction tries to divide by zero', 'Trap'],
              ['A program refers to code that is not yet in main memory', 'Memory fault'], ['A disk controller reports a finished transfer', 'I/O interrupt']],
            why: 'Interrupts (clock, I/O, memory fault) come from outside the current instruction, a trap comes from an error in it, and a supervisor call is a deliberate request.' },
          { type: 'tf', q: 'Every interrupt causes a process switch.', answer: false,
            why: 'Every interrupt causes a mode switch into the kernel. If the interrupted process can carry on, for example because its time slice is not used up, the OS simply returns to it.' },
          { type: 'order', q: 'Put the seven steps of a full <b>process switch</b> in order.',
            items: ['Save the context of the processor', 'Update the PCB of the running process', 'Move that PCB to the appropriate queue', 'Select another process to run',
              'Update the PCB of the selected process', 'Update memory-management data structures', 'Restore the context of the selected process'],
            why: 'Save first so nothing is overwritten, finish the old process’s paperwork, choose, prepare the new process and its memory map, and restore its registers last because that hands over the processor.' },
          { q: 'Why is a mode switch much cheaper than a process switch?',
            choices: ['Only a little processor state is saved and the same process continues, so no process states, queues or memory maps change', 'A mode switch does not involve the kernel at all',
              'A mode switch runs on a separate processor', 'The hardware saves nothing at all during a mode switch'], answer: 0,
            feedback: [null, 'It does: a mode switch is exactly the move into (and out of) the kernel.', 'No second processor is involved; the same processor changes mode.', 'The hardware does save a little state (at least the program counter and PSW) so it can return.'],
            why: 'A mode switch saves and restores a small amount of state. A process switch also rewrites two PCBs, moves queue entries, runs the scheduler, changes the memory map, and leaves the caches full of the old process’s data.' },
          { type: 'mc', q: 'A program executes an instruction that divides by zero and the OS treats it as fatal. What happens to the process?',
            choices: ['It moves to Exit and another process is dispatched', 'It moves to Blocked until the error clears', 'It keeps running in kernel mode', 'It is moved to the Ready queue to try again later'], answer: 0,
            feedback: [null, 'Blocked is for waiting on an event; there is nothing to wait for.', 'User programs never continue in kernel mode; the OS takes over.', 'A fatal error ends the process rather than retrying it.'],
            why: 'A trap enters the OS. If the error is fatal the OS terminates the process (Exit) and switches to another process; a recoverable trap may let it continue.' },
          { type: 'num', q: 'The timer interrupts every 2 ms, the time slice is 10 ms, and every process always uses its full slice. Out of every 100 clock interrupts, how many cause <b>only</b> a mode switch (no process switch)?',
            answer: 80, tol: 0, unit: 'interrupts',
            why: 'A slice lasts 10 ÷ 2 = 5 ticks, so every 5th interrupt ends a slice and triggers a process switch: 100 ÷ 5 = 20. The other 100 − 20 = 80 are handled with a mode switch into the kernel and straight back.' },
        ],
      },
    ],

    notes: `
      <h3>Process control: how the OS stays in charge</h3>
      <p>While a program runs, the processor executes its instructions, not the OS’s. The OS keeps control through hardware <b>privilege</b> (two processor modes), careful <b>creation</b> of every process, and the power to take the processor back and <b>switch</b> it to another process.</p>

      <h4>1. Modes of execution</h4>
      <ul>
        <li><b>User mode</b> (less privileged): ordinary programs run here. They cannot execute <b>privileged instructions</b> (disable interrupts, set the timer, start I/O, halt, change the mode) or touch <b>protected memory</b> such as the OS’s tables.</li>
        <li><b>Kernel mode</b> (also <b>system mode</b> or <b>control mode</b>, more privileged): the OS kernel runs here and may execute any instruction and reach any memory. The OS uses privileged instructions itself: it sets the timer before dispatching a process, and halts the processor only when nothing is Ready.</li>
        <li><b>Why two modes?</b> The OS’s data, such as every PCB and the process table, must be protected. If any program could rewrite them or switch off the clock, one bug or one attacker could take over the machine.</li>
        <li><b>How the processor knows:</b> a <b>mode bit</b> in the <b>program status word (PSW)</b>, checked before every privileged instruction and protected access. A violation causes a <b>trap</b>, and the OS usually ends the offending process.</li>
        <li><b>How the mode changes:</b> user → kernel only on an <b>interrupt</b>, a <b>trap</b> or a <b>system call</b>, each entering the OS at an address fixed in advance. (The processor checks for a pending interrupt at the end of every instruction.) Kernel → user when the OS executes a return instruction that restores the saved PSW. A system call (supervisor call) is the legal way to get privileged work done: the program asks and the OS does the work.</li>
      </ul>

      <h4>2. What the kernel does</h4>
      <p>The <b>kernel</b> is the core of the OS that stays in main memory and runs in kernel mode. Its typical functions:</p>
      <table>
        <tr><th>Family</th><th>Typical functions</th></tr>
        <tr><td>Process management</td><td>creation and termination; scheduling and dispatching; process switching; synchronization and inter-process communication; managing PCBs</td></tr>
        <tr><td>Memory management</td><td>allocating address space; swapping; page and segment management</td></tr>
        <tr><td>I/O management</td><td>buffer management; allocating I/O channels and devices to processes</td></tr>
        <tr><td>Support functions</td><td>interrupt handling; accounting; monitoring</td></tr>
      </table>

      <h4>3. Creating a process: five steps, in order</h4>
      <ol>
        <li><b>Assign a unique process identifier (PID)</b> and add an entry to the primary process table.</li>
        <li><b>Allocate space for the process</b>: every element of the process image (user address space for code and data, the stack(s), the PCB). Sizes come from defaults for that kind of program or from the creator’s request. If memory is full the image may start in the swap area on disk.</li>
        <li><b>Initialize the PCB.</b> Identification: PID, parent’s PID, user. Processor state: mostly zeros, except the program counter (program entry point) and stack pointers (new stacks). Process control: state = <b>Ready</b> (or <b>Ready/Suspend</b> if it starts on disk), default priority, no resources owned yet (unless requested or inherited from the parent).</li>
        <li><b>Set the appropriate linkages</b>, e.g. link the PCB onto the Ready (or Ready/Suspend) list.</li>
        <li><b>Create or expand other data structures</b>, e.g. an accounting record.</li>
      </ol>
      <p>Why this order: no space without an identity, no PCB before its space exists, and no queue entry while the PCB is blank.</p>

      <h4>4. When can the OS switch processes?</h4>
      <table>
        <tr><th>Mechanism</th><th>Cause</th><th>Examples</th></tr>
        <tr><td><b>Interrupt</b></td><td>an event outside the current instruction</td><td><b>Clock interrupt</b>: time slice used up → process to Ready, another runs. <b>I/O interrupt</b>: waiting processes move Blocked → Ready; the OS resumes the current process or preempts it for a more urgent one. <b>Memory fault</b>: a valid address not in main memory; the OS brings it in and blocks the process meanwhile.</td></tr>
        <tr><td><b>Trap</b></td><td>an error or exception in the current instruction</td><td>Divide by zero, privileged instruction in user mode. <b>Fatal</b> (e.g. the program has no handler for it): process → Exit, another is dispatched. <b>Recoverable</b>: the OS recovers or informs the process, which may continue.</td></tr>
        <tr><td><b>Supervisor call</b></td><td>an explicit request by the program</td><td>Open a file, read data, ask the time. If the service must wait (e.g. a disk read) the process is Blocked; otherwise it continues.</td></tr>
      </table>

      <h4>5. Mode switch vs process switch</h4>
      <p>On an interrupt, trap or system call the hardware saves the program counter and PSW, sets the mode bit to kernel and jumps to the handler: a <b>mode switch</b>. The same process is still Running. If it can continue, the OS returns: PC and PSW are restored and the mode goes back to user. <b>Every interrupt causes a mode switch; only some cause a process switch.</b> A mode switch is cheap. A <b>process switch</b> also rewrites two PCBs, moves queue entries, runs the scheduler and changes the memory map, and the new process then runs slowly for a while because the caches hold the old process’s data.</p>

      <h4>6. The seven steps of a process switch</h4>
      <ol>
        <li><b>Save the context of the processor</b> (PC, PSW, stack pointer, other registers) into the running process’s PCB. First, because the OS’s own code will overwrite the registers.</li>
        <li><b>Update the PCB of the running process</b>: new state (Ready, Blocked, Ready/Suspend or Exit), the reason, accounting such as time used.</li>
        <li><b>Move that PCB to the appropriate queue</b>: Ready, Blocked on event <i>i</i>, or Ready/Suspend.</li>
        <li><b>Select another process</b> to run.</li>
        <li><b>Update the PCB of the selected process</b>: state = Running.</li>
        <li><b>Update memory-management data structures</b> so addresses lead to the new process’s memory.</li>
        <li><b>Restore the context of the selected process</b> (mode bit back to user). Last, because it hands over the processor.</li>
      </ol>
      <p>A bad order breaks things: restoring before saving destroys the old registers; queueing a PCB that still says Running leaves contradictory records; restoring before the memory map is switched lets the new process reach the old one’s memory.</p>

      <h4>Worked example</h4>
      <p>The timer interrupts every 2 ms, the slice is 10 ms, and every process uses its whole slice. A slice lasts 10 ÷ 2 = 5 ticks, so of every 100 clock interrupts, 100 ÷ 5 = <b>20</b> cause a process switch and <b>80</b> cause only a mode switch. With illustrative costs of 3 units for a mode-switch-only tick and 13 for a slice-ending tick (13 already includes entering the kernel), OS work = 20 × 13 + 80 × 3 = <b>500 units</b> per 100 ticks; with 1 tick per slice it would be 100 × 13 = 1,300. Shorter slices mean more switching overhead; longer slices mean longer waits for everyone else. With a 1 ms tick and a 20 ms slice: 1,000 ÷ 20 = 50 switches per second, 950 mode-switch-only interrupts.</p>`,
  });
})();
