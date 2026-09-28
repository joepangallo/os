/* =====================================================================
   Section 3.3 — Process Description
   How the OS records everything it manages: the four families of
   control tables (memory, I/O, file, process), the process image,
   the three groups of attributes in a process control block, the
   program status word (x86 EFLAGS), and why the PCB is the most
   important structure in the OS (queues + protection).
   Helpers live in the IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {
  Guide.section({
    id: '3.3',
    title: 'Process Description',
    short: 'Process description',
    summary: 'The tables the OS keeps, the parts of a process image, and everything a PCB records about a process.',
    objectives: [
      'Describe the four kinds of tables the OS keeps (memory, I/O, file and process) and explain why they must point at one another.',
      'Name the four parts of a process image and explain how paging lets some of it sit on disk.',
      'Sort PCB contents into process identification, processor state information and process control information.',
      'Explain how condition codes in the program status word (x86 EFLAGS) are set, and why they are saved with the process.',
      'Explain why the PCB is the most important OS data structure, how PCBs form queues, and how the OS protects them.',
    ],
    terms: [
      ['Memory table', 'An OS table that records which parts of main memory and of secondary memory (disk) are allocated to each process, the protection settings of each region (including shared ones), and whatever is needed to manage virtual memory.'],
      ['I/O table', 'An OS table that records every I/O device and channel (a small processor dedicated to running I/O transfers): whether it is free or assigned (and to whom), the status of any operation in progress, and the main-memory address used as the source or destination of the transfer.'],
      ['File table', 'An OS table that records which files exist, where each one is stored on secondary memory, its current status (for example open for writing) and its attributes. Often kept by a separate file management system.'],
      ['Process table', 'The OS table with one entry per process. Each entry holds a pointer that leads to that process’s image, and so to its process control block.'],
      ['Process image', 'The complete set of things that make up one process: its user program, its user data, its stack(s) and its process control block.'],
      ['Process control block (PCB)', 'The record the OS creates and maintains for each process, holding the attributes it needs to control it. Its elements (identifier, state, priority, program counter and the rest) fall into three groups: process identification, processor state information and process control information.'],
      ['User data', 'The part of a process image the program itself may change: its variables and working data, a user stack area, and any code that modifies itself.'],
      ['Frame (page frame)', 'A fixed-size slot of main memory (4 KB in this section\'s examples, so frame 4 covers addresses 0x4000–0x4FFF). With paging, a process is cut into pieces of the same size, called pages, and each page can be placed in any free frame.'],
      ['System stack', 'A last-in, first-out area in the process image that remembers calls in progress: the parameters and return addresses of procedure calls and system calls. (Section 3.5 also meets the separate system stack that a nonprocess kernel keeps for itself, outside every process image.)'],
      ['Process identification', 'The identifier part of the PCB: the ID of this process, the ID of the parent that created it, and the ID of the user it runs for.'],
      ['Processor state information', 'The part of the PCB that holds a copy of the processor registers for the process: user-visible registers, control and status registers, and stack pointers. It is saved when the process is interrupted and loaded back into the processor when it resumes.'],
      ['Process control information', 'The part of the PCB the OS uses to manage and coordinate the process: scheduling and state details, links to other PCBs, interprocess communication, privileges, memory-management pointers and resource use.'],
      ['User-visible register', 'A processor register that a program’s own machine instructions can name and use, such as a general-purpose data register.'],
      ['Control and status registers', 'Processor registers that steer execution and report on it, such as the program counter, the condition codes and the status bits (interrupts on or off, user or kernel mode).'],
      ['Condition codes', 'Bits the processor sets after an arithmetic or logic instruction to describe the result (sign, zero, carry, equal, overflow). Later instructions test them to decide whether to jump.'],
      ['EFLAGS', 'The 32-bit flags register of x86 processors, their version of the program status word. It holds the condition codes (carry, zero, sign, overflow and more) and control bits such as interrupt enable.'],
      ['Interprocess communication (IPC)', 'The ways separate processes exchange information, such as signals, messages and shared flags. The PCB records what is pending for each process.'],
      ['Process privileges', 'PCB entries that say what a process is allowed to do: which memory it may touch, which kinds of instructions it may execute and which system services it may use.'],
      ['Program status word (PSW)', 'A processor register (or set of registers) holding status about the running program: its condition codes, whether interrupts are enabled, and whether the processor is in user or kernel mode.'],
      ['Linked list', 'A chain of records in which each record holds a pointer to the next one. The OS builds its process queues by linking PCBs together this way.'],
    ],
    css: `
      .sec-3-3 .hot { cursor: pointer; }
      .sec-3-3 .hot:hover rect, .sec-3-3 .hot:focus rect { stroke-width: 3; }
      .sec-3-3 .hot:focus { outline: none; }
      .sec-3-3 .s33-split2 { grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr); }
      .sec-3-3 .card.s33-file { background: var(--accent-bg); border-color: color-mix(in srgb, var(--accent) 35%, transparent); }
      .sec-3-3 .btn.s33-file { border-color: var(--accent); color: var(--accent); }
      .sec-3-3 .s33-tc { padding: 10px 14px; }
      .sec-3-3 .s33-tc .tt { font-weight: 800; font-size: 17px; margin-bottom: 2px; }
      .sec-3-3 .s33-tc .sub { font-size: 13px; color: var(--ink-2); margin-bottom: 4px; }
      .sec-3-3 .s33-tc ul { margin: 0; padding-left: 18px; font-size: 14.5px; line-height: 1.38; }
      .sec-3-3 .s33-tc li { margin: 1px 0; }
      .sec-3-3 .tt.mem { color: var(--mem); } .sec-3-3 .tt.io { color: var(--io); }
      .sec-3-3 .tt.file { color: var(--accent); } .sec-3-3 .tt.proc { color: var(--proc); }
      .sec-3-3 .s33-q { font-size: 18px; font-weight: 650; line-height: 1.4; min-height: 78px; }
      .sec-3-3 .s33-ans { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .sec-3-3 .s33-ans .btn { height: 44px; width: 100%; }
      .sec-3-3 .s33-ans.locked .btn { pointer-events: none; }
      .sec-3-3 .btn.right { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
      .sec-3-3 .btn.wrong { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
      .sec-3-3 .s33-fb { min-height: 96px; font-size: 15px; line-height: 1.45; }
      .sec-3-3 .s33-fb .v { font-weight: 900; font-size: 16px; }
      .sec-3-3 .s33-fb .v.ok { color: var(--ok); } .sec-3-3 .s33-fb .v.bad { color: var(--bad); }
      .sec-3-3 .s33-dsplit { grid-template-columns: minmax(0, 330px) minmax(0, 1fr); gap: 18px; }
      .sec-3-3 .s33-dash table.tbl { font-size: 13.5px; }
      .sec-3-3 .s33-dash table.tbl th { font-size: 12.5px; padding: 3px 6px; }
      .sec-3-3 .s33-dash table.tbl td { padding: 3px 6px; white-space: nowrap; transition: background .15s, opacity .15s; }
      .sec-3-3 .s33-dash.nar table.tbl td { white-space: normal; }
      .sec-3-3 .s33-dash tr[role=button] { cursor: pointer; }
      .sec-3-3 .s33-dash tr[role=button]:hover td { background: var(--panel-3); }
      .sec-3-3 .s33-dash tr.sel td { background: var(--hl); font-weight: 700; }
      .sec-3-3 .s33-dash tr.lk td { background: var(--accent-bg); }
      .sec-3-3 .s33-dash.has-sel tr[role=button]:not(.sel):not(.lk) td { opacity: .42; }
      .sec-3-3 .s33-dash .th { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
      .sec-3-3 .s33-dash .th b { font-size: 15.5px; }
      .sec-3-3 .s33-sw { display: inline-block; width: 22px; height: 14px; border-radius: 4px; border: 1px solid var(--line-2); }
      .sec-3-3 .btn.s33-part { height: 46px; justify-content: flex-start; gap: 10px; white-space: normal; text-align: left; line-height: 1.2; }
      .sec-3-3 .btn.s33-part .s33-sw { flex: none; border-width: 2px; }
      .sec-3-3 .s33-psplit { grid-template-columns: minmax(0, 190px) minmax(0, 1fr); gap: 18px; }
      .sec-3-3 .s33-mini { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
      .sec-3-3 .s33-band { display: flex; flex-direction: column; gap: 3px; text-align: left; border: 2px solid var(--line-2); border-radius: 10px; padding: 8px 10px; background: var(--panel-2); cursor: pointer; color: var(--ink); line-height: 1.3; }
      .sec-3-3 .s33-band b { font-size: 15px; }
      .sec-3-3 .s33-band.proc { border-color: var(--proc); background: var(--proc-bg); flex: 3; }
      .sec-3-3 .s33-band.cpu { border-color: var(--cpu); background: var(--cpu-bg); flex: 5; }
      .sec-3-3 .s33-band.os { border-color: var(--os); background: var(--os-bg); flex: 6; }
      .sec-3-3 .s33-band.on { box-shadow: 0 0 0 3px var(--hl); }
      .sec-3-3 .s33-band:not(.on) { opacity: .7; }
      .sec-3-3 .s33-pcbt td { font-size: 14px; line-height: 1.35; }
      .sec-3-3 .s33-pcbt td.mono { font-size: 13px; }
      .sec-3-3 .s33-pcbt td:first-child { width: 20%; } .sec-3-3 .s33-pcbt td:nth-child(2) { width: 30%; }
      .sec-3-3 .s33-tray { display: flex; flex-wrap: wrap; gap: 6px; min-height: 30px; }
      .sec-3-3 .s33-bucket { display: flex; flex-direction: column; gap: 6px; cursor: pointer; min-height: 120px; padding: 10px 12px; }
      .sec-3-3 .s33-bucket.armed { outline: 2px dashed var(--line-2); outline-offset: 2px; }
      .sec-3-3 .s33-dropped { display: flex; flex-wrap: wrap; gap: 5px; }
      .sec-3-3 .s33-ok { color: var(--ok); font-weight: 800; } .sec-3-3 .s33-no { color: var(--bad); font-weight: 800; }
      .sec-3-3 .s33-fsplit { grid-template-columns: minmax(0, 350px) minmax(0, 1fr); gap: 20px; }
      .sec-3-3 .s33-fsplit > .stack > * { flex-shrink: 0; }
      .sec-3-3 .s33-at { border-collapse: collapse; font-size: 15px; }
      .sec-3-3 .s33-at td { padding: 1px 10px 1px 0; }
      .sec-3-3 .s33-at td.n { font-family: var(--mono); font-weight: 800; text-align: right; min-width: 3.5ch; }
      .sec-3-3 .s33-at td.m { font-family: var(--mono); letter-spacing: .04em; padding-left: 10px; }
      .sec-3-3 .s33-at tr.res td { border-top: 2px solid var(--line-2); font-weight: 800; }
      .sec-3-3 .s33-flag { padding: 7px 10px; }
      .sec-3-3 .s33-flag.set { background: var(--cpu-bg); border-color: var(--cpu); }
      .sec-3-3 .s33-fv { font-family: var(--mono); font-weight: 900; font-size: 22px; line-height: 1; }
      .sec-3-3 .s33-flag.set .s33-fv, .sec-3-3 .s33-flag.set b { color: var(--cpu); }
      .sec-3-3 .s33-fw { font-size: 13px; line-height: 1.35; margin-top: 3px; }
      .sec-3-3 .hot.dim { opacity: .38; }
      .sec-3-3 .hot.dim:hover, .sec-3-3 .hot.dim:focus { opacity: .8; }
      .sec-3-3 .s33-chal { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 5px 12px; }
      .sec-3-3 .s33-chal > div { white-space: nowrap; }
      .sec-3-3 .s33-qsplit { grid-template-columns: minmax(0, 312px) minmax(0, 1fr); gap: 18px; }
      .sec-3-3 .s33-qsplit > .stack > * { flex-shrink: 0; }
      .sec-3-3 .s33-qsplit > .stack > .grow { flex-shrink: 1; }
    `,
    steps: [
      /* ---------------- 1. Big picture: the OS as resource manager ---------------- */
      {
        title: 'The OS keeps the books: who has what?',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack">
              <p class="lead m0">A computer has a limited number of processors (this one has just one), a fixed amount of <span class="t">main memory</span> and a few devices, yet many <span class="t">processes</span> want them at the same time.</p>
              <p class="m0">The operating system is the manager in the middle. It hands each resource to a process and later takes it back, so at every moment it must be able to answer: <b>where</b> is each process, <b>what</b> does it hold, and <b>what</b> is it waiting for?</p>
              <div class="callout analogy m0" data-label="Analogy">A hotel front desk keeps a room chart, a log of borrowed equipment, tickets for bags in the storage room and a guest register. Without that paperwork nobody knows who has what. The OS keeps the same kind of paperwork, in tables.</div>
              <div class="callout why m0" data-label="In this section">You will open the OS's books: its four kinds of tables, the <span class="t">process image</span>, and the <span class="t">process control block</span> at the heart of it all.</div>
            </div>
            <div class="stack s33-fig"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const PROCS = [
            { id: 'p1', x: 12, name: 'P1 · editor', st: 'Running', rel: { cpu: 'h', kbd: 'h', m1: 'h' },
              info: '<b>P1 · editor: Running.</b> It has the processor right now, its image sits in main memory, and it owns the keyboard because its window has focus.' },
            { id: 'p2', x: 176, name: 'P2 · music', st: 'Blocked', rel: { disk: 'h', m2: 'h' },
              info: '<b>P2 · music player: Blocked.</b> Its image is in memory and the disk drive is reading the next part of a song for it. Until that read finishes, P2 cannot run even if the processor is idle.' },
            { id: 'p3', x: 340, name: 'P3 · backup', st: 'Ready/Suspend', rel: { swap: 'h', free: 'w' },
              info: '<b>P3 · backup: Ready/Suspend (swapped out).</b> Memory ran short, so the OS <span class="t" data-t="Swapping">swapped</span> P3\'s program, data and stack out to the swap area on disk. Only its PCB stays behind, among the OS tables, so the OS can still manage it. P3 cannot run until it is brought back in.' },
            { id: 'p4', x: 504, name: 'P4 · print job', st: 'Ready', rel: { prn: 'h', m4: 'h', cpu: 'w' },
              info: '<b>P4 · print job: Ready.</b> Its image is in memory and it has been given the printer. It could run right now; it is only waiting for the processor.' },
          ];
          const RES_INFO = {
            cpu: '<b>Processor.</b> It runs one process at a time: P1 now. P4 is ready and waiting for its turn.',
            mem: '<b>Main memory.</b> It holds the OS itself (tables included) and the images of P1, P2 and P4. Of P3, only its PCB is here, with the OS tables; the rest needs free space before it can come back.',
            kbd: '<b>Keyboard.</b> Assigned to P1, the process whose window has focus.',
            prn: '<b>Printer.</b> Assigned to P4. Any other process that wants it must wait until P4 releases it.',
            net: '<b>Network card.</b> Nobody holds it right now, so the OS records it as free.',
            disk: '<b>Disk drive.</b> Busy with a read for P2. It stores files, and part of it is a swap area holding the swapped-out image of P3, so the OS must track disk space per process too.',
          };
          const PART_RES = { cpu: 'cpu', kbd: 'kbd', prn: 'prn', disk: 'disk', swap: 'disk', m1: 'mem', m2: 'mem', m4: 'mem', free: 'mem' };
          const holders = (r) => PROCS.filter((p) => Object.keys(p.rel).some((k) => PART_RES[k] === r)).map((p) => p.id);
          let sel = null;
          const fig = el.querySelector('.s33-fig');
          const box = h('div', { class: 'card white tight grow', style: { display: 'grid', placeItems: 'center' } });
          const info = h('div', { class: 'card tight small', style: { minHeight: '86px' } });
          fig.append(box, info);

          function paint() {
            const sp = sel && sel.t === 'p' ? PROCS.find((p) => p.id === sel.id) : null;
            const procOn = (p) => !sel || (sel.t === 'p' ? sel.id === p.id : holders(sel.id).includes(p.id));
            const resOn = (r) => !sel || (sel.t === 'r' ? sel.id === r : Object.keys(sp.rel).some((k) => PART_RES[k] === r));
            const partOn = (pid, part) => !sel || (sel.t === 'p' ? sel.id === pid : PART_RES[part] === sel.id);
            const op = (on) => `opacity="${on ? 1 : 0.35}"`;
            const hi = (on) => (sel && on ? 'style="stroke:var(--proc)" stroke-width="3.5"' : 'stroke-width="2"');
            const badge = (x, y, text, pid, part, kind) => {
              const w = Math.round(text.length * 7.3 + 16), on = partOn(pid, part);
              const cls = kind === 'free' ? 's-panel' : 's-proc';
              return `<g ${op(on)}><rect x="${x}" y="${y}" width="${w}" height="22" rx="11" class="${cls}" stroke-width="${sel && on ? 2.5 : 1.5}" ${kind === 'w' ? 'stroke-dasharray="5 3"' : ''}/><text x="${x + w / 2}" y="${y + 15.5}" text-anchor="middle" font-size="13" font-weight="700">${text}</text></g>`;
            };
            // geometry: wide canvas vs phone (narrow) layout
            const G = ctx.narrow ? {
              vb: '0 0 400 648', procs: [[8, 8], [204, 8], [8, 74], [204, 74]], pw: 188, ph: 58, lab: [8, 156, 'Resources the OS hands out and tracks'], frame: [2, 166, 396, 430],
              cpu: [12, 178, 184, 100], cpuB: [[24, 212], [24, 244]], kbd: [204, 178, 184, 66], kbdB: [216, 208], prn: [204, 252, 184, 66], prnB: [216, 282],
              net: [204, 326, 184, 66], netB: [276, 356], mem: [12, 290, 184, 300], mx: 22, mw: 164, osY: 324, sY: [384, 434, 484], freeY: 534,
              disk: [204, 400, 184, 190], diskB: [212, 434], files: [216, 464, 160, 34], swapY: 516, p3: [216, 524, 160, 58], legend: 'row', legY: 612,
            } : {
              vb: '0 0 660 432', procs: [[12, 8], [176, 8], [340, 8], [504, 8]], pw: 146, ph: 62, lab: [10, 96, 'Resources the OS hands out and keeps track of (and so on, up to process Pn)'], frame: [4, 106, 652, 322],
              cpu: [20, 118, 132, 104], cpuB: [[32, 152], [32, 184]], kbd: [384, 118, 124, 92], kbdB: [396, 152], prn: [384, 222, 124, 92], prnB: [396, 256],
              net: [384, 326, 124, 94], netB: [424, 360], mem: [168, 118, 200, 302], mx: 182, mw: 172, osY: 152, sY: [212, 262, 312], freeY: 362,
              disk: [522, 118, 128, 302], diskB: [530, 152], files: [534, 186, 104, 70], swapY: 284, p3: [534, 294, 104, 112], legend: 'col', legY: 246,
            };
            const slot = (y, hh, label, pid, part) => {
              const on = partOn(pid, part);
              return `<g ${op(on)}><rect x="${G.mx}" y="${y}" width="${G.mw}" height="${hh}" rx="7" class="s-proc" ${hi(on && sel)}/><text x="${G.mx + G.mw / 2}" y="${y + hh / 2 + 5}" text-anchor="middle" font-size="14" font-weight="700">${label}</text></g>`;
            };
            const res = (id, [x, y, w, hh], cls, title, inner) => `<g class="hot" role="button" tabindex="0" data-r="${id}" aria-label="${title}" ${op(resOn(id))}><rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="12" class="${cls}" ${hi(resOn(id))}/><text x="${x + w / 2}" y="${y + 24}" text-anchor="middle" font-size="15" font-weight="800">${title}</text>${inner || ''}</g>`;
            const freeOn = partOn('p3', 'free');
            const p3sel = sp && sp.id === 'p3';
            const [fx, fy, fw, fh] = G.files, [qx, qy, qw, qh] = G.p3, mcx = G.mx + G.mw / 2;
            const legend = G.legend === 'col'
              ? `<g font-size="13"><rect x="22" y="${G.legY}" width="30" height="16" rx="8" class="s-proc" stroke-width="1.5"/><text x="60" y="${G.legY + 13}">holds / uses</text>
                <rect x="22" y="${G.legY + 28}" width="30" height="16" rx="8" class="s-proc" stroke-width="1.5" stroke-dasharray="5 3"/><text x="60" y="${G.legY + 41}">waiting for</text>
                <text x="22" y="${G.legY + 76}" class="s-sub">Click a process or</text><text x="22" y="${G.legY + 94}" class="s-sub">a resource box.</text>
                <text x="22" y="${G.legY + 126}" class="s-sub">Click it again to</text><text x="22" y="${G.legY + 144}" class="s-sub">see everything.</text></g>`
              : `<g font-size="13"><rect x="12" y="${G.legY}" width="30" height="16" rx="8" class="s-proc" stroke-width="1.5"/><text x="50" y="${G.legY + 13}">holds / uses</text>
                <rect x="170" y="${G.legY}" width="30" height="16" rx="8" class="s-proc" stroke-width="1.5" stroke-dasharray="5 3"/><text x="208" y="${G.legY + 13}">waiting for</text>
                <text x="12" y="${G.legY + 34}" class="s-sub">Tap a box to focus on it; tap again to see all.</text></g>`;
            box.innerHTML = `<svg viewBox="${G.vb}" width="100%" role="img" aria-label="Four processes and the resources the OS hands out to them">
              ${PROCS.map((p, i) => { const [x, y] = G.procs[i]; return `<g class="hot" role="button" tabindex="0" data-p="${p.id}" aria-label="${p.name}" ${op(procOn(p))}>
                <rect x="${x}" y="${y}" width="${G.pw}" height="${G.ph}" rx="12" class="s-proc" ${sel && procOn(p) ? 'stroke-width="3.5"' : 'stroke-width="2"'} ${p.id === 'p3' ? 'stroke-dasharray="7 4"' : ''}/>
                <text x="${x + G.pw / 2}" y="${y + 25}" text-anchor="middle" font-size="15" font-weight="800">${p.name}</text>
                <text x="${x + G.pw / 2}" y="${y + 46}" text-anchor="middle" font-size="13" class="s-sub">${p.st}</text></g>`; }).join('')}
              <text x="${G.lab[0]}" y="${G.lab[1]}" font-size="13" class="s-sub">${G.lab[2]}</text>
              <rect x="${G.frame[0]}" y="${G.frame[1]}" width="${G.frame[2]}" height="${G.frame[3]}" rx="14" fill="none" style="stroke:var(--os)" stroke-width="1.5" stroke-dasharray="6 5"/>
              ${res('cpu', G.cpu, 's-cpu', 'Processor', badge(...G.cpuB[0], 'P1 running', 'p1', 'cpu', 'h') + badge(...G.cpuB[1], 'P4 waiting', 'p4', 'cpu', 'w'))}
              ${res('mem', G.mem, 's-mem', 'Main memory',
                `<rect x="${G.mx}" y="${G.osY}" width="${G.mw}" height="52" rx="7" class="s-os" stroke-width="2"/><text x="${mcx}" y="${G.osY + 31}" text-anchor="middle" font-size="14" font-weight="700">OS code + its tables</text>`
                + slot(G.sY[0], 44, 'P1 image', 'p1', 'm1') + slot(G.sY[1], 44, 'P2 image', 'p2', 'm2') + slot(G.sY[2], 44, 'P4 image', 'p4', 'm4')
                + `<g ${op(freeOn)}><rect x="${G.mx}" y="${G.freeY}" width="${G.mw}" height="46" rx="7" class="${p3sel ? 's-warn' : 's-panel'}" stroke-width="2" stroke-dasharray="5 4"/><text x="${mcx}" y="${G.freeY + 28}" text-anchor="middle" font-size="13" ${p3sel ? 'font-weight="700"' : 'class="s-sub"'}>${p3sel ? 'P3 needs room here' : 'free space'}</text></g>`)}
              ${res('kbd', G.kbd, 's-io', 'Keyboard', badge(...G.kbdB, 'in use by P1', 'p1', 'kbd', 'h'))}
              ${res('prn', G.prn, 's-io', 'Printer', badge(...G.prnB, 'held by P4', 'p4', 'prn', 'h'))}
              ${res('net', G.net, 's-io', 'Network card', badge(...G.netB, 'free', null, 'net', 'free'))}
              ${res('disk', G.disk, 's-io', 'Disk drive', badge(...G.diskB, 'reading for P2', 'p2', 'disk', 'h')
                + `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="7" class="s-panel"/><text x="${fx + fw / 2}" y="${fy + fh / 2 + 5}" text-anchor="middle" font-size="13" class="s-sub">files</text>`
                + `<text x="${qx + qw / 2}" y="${G.swapY}" text-anchor="middle" font-size="13" font-weight="700">swap area</text>`
                + `<g ${op(partOn('p3', 'swap'))}><rect x="${qx}" y="${qy}" width="${qw}" height="${qh}" rx="7" class="s-proc" stroke-dasharray="6 4" ${hi(partOn('p3', 'swap') && sel)}/><text x="${qx + qw / 2}" y="${qy + qh / 2 - 2}" text-anchor="middle" font-size="14" font-weight="700">P3 image</text><text x="${qx + qw / 2}" y="${qy + qh / 2 + 16}" text-anchor="middle" font-size="13" class="s-sub">(swapped out)</text></g>`)}
              ${legend}
            </svg>`;
            info.innerHTML = !sel ? '<b>Everything at once.</b> Click any process (top row) or any resource box to see what the OS must remember about it.'
              : (sel.t === 'p' ? sp.info : RES_INFO[sel.id]) + ' <span class="muted">Every fact here is a row in one of the OS\'s tables.</span>';
          }
          function pick(t, id) { sel = sel && sel.t === t && sel.id === id ? null : { t, id }; paint(); }
          const hit = (e) => { const g = e.target.closest('[data-p],[data-r]'); if (!g) return false; if (g.dataset.p) pick('p', g.dataset.p); else pick('r', g.dataset.r); return true; };
          ctx.on(box, 'click', hit);
          ctx.on(box, 'keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && hit(e)) e.preventDefault(); });
          paint();
        },
      },
      /* ---------------- 2. The four families of OS tables + "which table?" game ---------------- */
      {
        title: 'Four kinds of tables the OS keeps',
        kind: 'learn',
        html: `
          <div class="split s33-split2 fill">
            <div class="stack gap-s">
              <p class="m0">To answer those questions, the OS keeps a <b>table of information about every entity it manages</b>. They fall into four families:</p>
              <div class="grid-2 grow" style="gap:10px">
                <div class="card mem s33-tc"><div class="tt mem"><span class="t">Memory tables</span></div><div class="sub">main memory and secondary (virtual) memory</div>
                  <ul><li>main memory given to each process</li><li>secondary memory (disk) holding each process's data</li><li>protection of each region: who may read or write it, including shared regions</li><li>what virtual memory needs (the scheme that keeps parts of a process on disk and brings them in when used)</li></ul></div>
                <div class="card io s33-tc"><div class="tt io"><span class="t">I/O tables</span></div><div class="sub">devices, and channels (small processors that run I/O transfers)</div>
                  <ul><li>each device and channel: free, or assigned to which process</li><li>the status of the operation in progress</li><li>the main-memory address that is the source or destination of the transfer</li></ul></div>
                <div class="card s33-file s33-tc"><div class="tt file"><span class="t">File tables</span></div><div class="sub">files · often run by a file management system</div>
                  <ul><li>which files exist</li><li>where each is stored on secondary memory</li><li>current status: open? by whom? for writing?</li><li>attributes: owner, permissions, size</li></ul></div>
                <div class="card proc s33-tc"><div class="tt proc"><span class="t">Process tables</span></div><div class="sub">the processes themselves</div>
                  <ul><li>one entry for every process</li><li>each entry leads to the process's image and control block</li><li>other tables refer to processes by ID, so everything links back here</li></ul></div>
              </div>
            </div>
            <div class="card white stack s33-game" style="gap:10px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const KIND = { mem: 'Memory', io: 'I/O', file: 'File', proc: 'Process' };
          const DESC = { mem: 'Memory tables describe regions of main and secondary memory and who may use them.', io: 'I/O tables describe devices and channels and the transfers they are doing.', file: 'File tables describe files: where they are stored and who has them open.', proc: 'The process table lists the processes themselves, one entry each, leading to each image.' };
          const Q = [
            ['Is the printer free right now, or is some process using it?', 'io', 'Whether each device is free or assigned, and to whom, is exactly what an I/O table records.'],
            ['Which parts of main memory belong to process 12?', 'mem', 'Memory tables record how main memory has been handed out to processes.'],
            ['Where on the disk is the file <i>report.pdf</i> stored?', 'file', 'A file table records where each file lives on secondary memory.'],
            ['Where is the image of process 7, so the OS can reach its control block?', 'proc', 'The process table has one entry per process, and that entry leads to the process image.'],
            ['A disk read just finished. At which memory address should its data land?', 'io', 'An I/O table keeps the main-memory location used as the source or destination of each transfer.'],
            ['May process 9 write into the memory region it shares with process 4?', 'mem', 'Protection attributes of memory regions, including shared ones, live in the memory tables.'],
            ['Is <i>budget.xlsx</i> open at the moment, and if so by whom?', 'file', 'The current status of each file (open or closed, by whom, how) is kept in the file table.'],
            ['Which pieces of process 3 are out on disk rather than in main memory?', 'mem', 'Memory tables also cover secondary memory and the information needed to manage virtual memory.'],
            ['How many processes exist right now, and which entry belongs to process 15?', 'proc', 'The process table lists every process, one entry each.'],
          ];
          const game = el.querySelector('.s33-game');
          let i = 0, right = 0, tried = false;
          function paint() {
            game.innerHTML = '';
            game.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Which table answers it?'), h('span', { class: 'chip accent' }, i < Q.length ? `Question ${i + 1} of ${Q.length}` : 'Done')));
            if (i >= Q.length) {
              game.append(h('div', { class: 'grow stack', style: { justifyContent: 'center', alignItems: 'center', textAlign: 'center' } },
                h('div', { class: 'big' }, `${right} / ${Q.length}`),
                h('p', { class: 'm0' }, 'right on the first try.'),
                h('p', { class: 'small muted m0', html: right === Q.length ? 'Perfect: you can already tell the four families apart.' : 'Look back at the four cards for any you missed, then try again.' }),
                h('button', { class: 'btn primary', type: 'button', onclick: () => { i = 0; right = 0; tried = false; paint(); } }, 'Play again')));
              return;
            }
            const [q, ans, why] = Q[i];
            game.append(h('p', { class: 'small muted m0' }, 'The OS needs to answer this. Which family of tables does it look in?'), h('div', { class: 's33-q', html: q }));
            const fb = h('div', { class: 'card tight s33-fb grow', html: '<span class="muted">Pick one. Right on the first try counts toward your score.</span>' });
            const next = h('button', { class: 'btn primary', type: 'button', disabled: true, onclick: () => { i++; tried = false; paint(); } }, i === Q.length - 1 ? 'See score ▶' : 'Next question ▶');
            const grid = h('div', { class: 's33-ans' });
            Object.entries(KIND).forEach(([k, lab]) => {
              grid.append(h('button', { class: 'btn ' + (k === 'file' ? 's33-file' : k), type: 'button', 'data-k': k, onclick: () => {
                if (grid.classList.contains('locked')) return;
                const b = grid.querySelector(`[data-k="${k}"]`);
                if (k === ans) {
                  if (!tried) right++;
                  b.classList.add('right'); grid.classList.add('locked'); next.disabled = false;
                  fb.innerHTML = `<div class="v ok">✓ ${KIND[ans]} tables</div>${why}`;
                } else {
                  tried = true; b.classList.add('wrong');
                  fb.innerHTML = `<div class="v bad">✗ Not the ${KIND[k]} tables</div>${DESC[k]} Is this question really about a device, a region of memory, a file, or a process itself? Try again.`;
                }
              } }, lab + ' tables'));
            });
            game.append(grid, fb, h('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: 'auto' } }, h('span', { class: 'small muted' }, `${right} right so far`), next));
          }
          paint();
        },
      },
      /* ---------------- 3. Cross-linked dashboard of the four tables ---------------- */
      {
        title: 'The tables point at one another',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const T = [
            { key: 'proc', title: 'Process table', color: 'proc', note: 'one entry per process', cols: ['PID', 'Program', 'State', 'Image at'], rows: [
              { id: 'p1', pid: 1, c: ['1', 'editor', 'Running', 'frames 0, 1'], say: '<b>Process 1 · editor.</b> Its entry leads to its image. The memory table shows its code in frame 0, its data in frame 1 and a share of the library in frame 7. The I/O table gives it the keyboard, and the file table has <i>essay.txt</i> open for it.' },
              { id: 'p2', pid: 2, c: ['2', 'music', 'Blocked', 'frames 3, 4 + disk'], say: '<b>Process 2 · music.</b> Code and data are in frames 3 and 4; its stack page is out on disk block 88. Disk 0 is reading <i>song.mp3</i> (open for reading by process 2) straight into 0x4200, inside frame 4. Four tables, one process.' },
              { id: 'p3', pid: 3, c: ['3', 'backup', 'Ready/Suspend', 'disk 90–92'], say: '<b>Process 3 · backup.</b> Ready/Suspend (swapped out): its program, data and stack are on disk blocks 90–92, so it owns no frames (its PCB stays in the OS\'s memory). Its <i>backup.zip</i> stays open while it is swapped out.' },
              { id: 'p4', pid: 4, c: ['4', 'print job', 'Ready', 'frame 5'], say: '<b>Process 4 · print job.</b> Its image is in frame 5 and it shares the library in frame 7 with process 1. The I/O table shows the printer assigned to it.' },
            ] },
            { key: 'file', title: 'File table', color: 'accent', note: 'files on disk', cols: ['File', 'Blocks', 'Status', 'Owner'], rows: [
              { id: 'f1', own: [1], c: ['essay.txt', '210–213', 'open: 1, R/W', 'ana'], say: '<b>essay.txt</b> lives in disk blocks 210–213 and is open for reading and writing by process 1. Its owner attribute says it belongs to user ana.' },
              { id: 'f2', own: [2], x: ['disk'], c: ['song.mp3', '400–1379', 'open: 2, read', 'ana'], say: '<b>song.mp3</b> is open for reading by process 2, and disk 0 is fetching part of it right now. The file table and the I/O table describe the same transfer from two sides.' },
              { id: 'f3', own: [3], c: ['backup.zip', '1500–2600', 'open: 3, write', 'root'], say: '<b>backup.zip</b> is open for writing by process 3, even though process 3 is swapped out.' },
              { id: 'f4', own: [], c: ['notes.txt', '300–301', 'closed', 'ana'], say: '<b>notes.txt</b> exists, so the file table records its location and attributes, but no process has it open. It links to nothing else.' },
            ] },
            { key: 'mem', title: 'Memory table', color: 'mem', note: 'frames are 4 KB: frame 4 = 0x4000–0x4FFF', cols: ['Region', 'Owner', 'Where', 'Access'], rows: [
              { id: 'm1', own: [1], c: ['P1 code', '1', 'frame 0', 'read, execute'], say: '<b>Frame 0</b> holds the code of process 1. Its protection is read and execute only, so even a buggy program cannot overwrite its own instructions.' },
              { id: 'm2', own: [1], x: ['kbd'], c: ['P1 data', '1', 'frame 1', 'read, write'], say: '<b>Frame 1</b> (0x1000–0x1FFF) holds process 1\'s data. The keyboard\'s transfer address, 0x1800, lies inside it, so typed characters land in P1\'s own data.' },
              { id: 'm3', own: [2], c: ['P2 code', '2', 'frame 3', 'read, execute'], say: '<b>Frame 3</b> holds the code of process 2, protected as read and execute only.' },
              { id: 'm4', own: [2], x: ['disk'], c: ['P2 data', '2', 'frame 4', 'read, write'], say: '<b>Frame 4</b> (0x4000–0x4FFF) holds process 2\'s data. The I/O table says disk 0 is filling address 0x4200, which is inside this frame: a cross-reference from the I/O table into the memory table.' },
              { id: 'm5', own: [2], c: ['P2 stack', '2', 'disk blk 88', 'read, write'], say: '<b>Not every page is in main memory.</b> Process 2\'s stack page is on disk block 88 for now. The memory table records where, so the OS can bring it back when it is needed.' },
              { id: 'm6', own: [3], c: ['P3 image', '3', 'disk 90–92', 'read, write'], say: '<b>Process 3\'s image</b> (all but its PCB) is out on disk blocks 90–92. Memory tables cover secondary memory too, not just main memory.' },
              { id: 'm7', own: [4], c: ['P4 image', '4', 'frame 5', 'read, write'], say: '<b>Frame 5</b> holds the image of process 4.' },
              { id: 'm8', own: [1, 4], c: ['Shared lib', '1, 4', 'frame 7', 'read only'], say: '<b>One copy</b> of the library in frame 7 is shared by processes 1 and 4. Its protection attribute is read-only, which is what makes sharing it safe.' },
            ] },
            { key: 'io', title: 'I/O table', color: 'io', note: 'devices and channels', cols: ['Device', 'Status', 'For', 'Transfer'], rows: [
              { id: 'kbd', own: [1], x: ['m2'], c: ['Keyboard', 'assigned', '1', '→ 0x1800'], say: '<b>The keyboard</b> is assigned to process 1. Characters go to address 0x1800, which is inside frame 1: process 1\'s data.' },
              { id: 'disk', own: [2], x: ['m4', 'f2'], c: ['Disk 0', 'reading', '2', '→ 0x4200'], say: '<b>Disk 0</b> is reading for process 2: from <i>song.mp3</i> (file table) into 0x4200 in frame 4 (memory table). One I/O row points into two other tables.' },
              { id: 'prn', own: [4], c: ['Printer', 'assigned, idle', '4', '—'], say: '<b>The printer</b> is assigned to process 4 but idle. If process 1 asked for it now, the OS would find this row and make process 1 wait.' },
              { id: 'net', own: [], c: ['Network', 'free', '—', '—'], say: '<b>The network card</b> is free. No process holds it, so the OS can give it to the first process that asks.' },
            ] },
          ];
          const byId = {};
          T.forEach((t) => t.rows.forEach((r) => { byId[r.id] = r; }));
          const linked = (r) => (r.pid ? Object.values(byId).filter((x) => (x.own || []).includes(r.pid)).map((x) => x.id) : (r.own || []).map((n) => 'p' + n).concat(r.x || []));
          const say = h('div', { class: 'card white small grow', style: { lineHeight: '1.5' } });
          const dash = h('div', { class: 'grid-2 s33-dash' + (ctx.narrow ? ' nar' : ''), style: { alignItems: 'start', gap: '14px' } });
          const trs = {};
          let sel = null;
          const mkTable = (t) => {
            const tbl = h('table', { class: 'tbl compact' }, h('tr', {}, ...t.cols.map((c) => h('th', {}, c))));
            t.rows.forEach((r) => {
              const tr = h('tr', { role: 'button', tabindex: 0, 'aria-label': t.title + ': ' + r.c[0], onclick: () => pick(r.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(r.id); } } }, ...r.c.map((c) => h('td', {}, c)));
              trs[r.id] = tr; tbl.append(tr);
            });
            return h('div', {}, h('div', { class: 'th' }, h('span', { class: 'chip ' + t.color }, t.title), h('span', { class: 'xs muted' }, t.note)), tbl);
          };
          const tip = h('div', { class: 'callout tip small m0', 'data-label': 'Where the tables come from', html: 'At start-up the OS first learns its environment (how much main memory, which devices) from firmware, by probing the hardware, or from an administrator\'s settings. Only then can it build its tables, which themselves live in main memory and so are covered by memory management too.' });
          dash.append(h('div', { class: 'stack', style: { gap: '12px' } }, mkTable(T[0]), mkTable(T[1]), tip), h('div', { class: 'stack', style: { gap: '12px' } }, mkTable(T[2]), mkTable(T[3]),
            h('div', { class: 'row small', style: { gap: '8px' } }, h('span', { class: 's33-sw', style: { background: 'var(--hl)' } }), 'the row you clicked', h('span', { class: 's33-sw', style: { background: 'var(--accent-bg)', marginLeft: '8px' } }), 'rows linked to it')));
          function pick(id) {
            sel = sel === id ? null : id;
            const lk = sel ? linked(byId[sel]) : [];
            Object.entries(trs).forEach(([k, tr]) => { tr.classList.toggle('sel', k === sel); tr.classList.toggle('lk', lk.includes(k)); });
            dash.classList.toggle('has-sel', !!sel);
            say.innerHTML = sel ? byId[sel].say + `<div class="xs muted" style="margin-top:6px">${lk.length ? `Linked rows: ${lk.length}.` : 'No linked rows.'} Click the row again to clear.</div>` : '<b>Nothing selected.</b> Click any row in any table. Its row turns yellow and every row it is linked to in the other tables is shaded purple.';
          }
          el.append(h('div', { class: 'split s33-dsplit fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'Each table holds one slice of the truth. The slices only make sense together, so the tables are <b>cross-referenced</b>: they name processes by ID and point at each other\'s entries.' }),
              h('p', { class: 'm0 small', html: 'Memory is split into 4 KB <span class="t" data-t="Frame">frames</span>; 0x means hexadecimal, so frame 4 = 0x4000–0x4FFF.' }),
              say,
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'When process 2 ends, the OS must clean up every table that mentions it, or a frame, a device or a file stays assigned to a process that no longer exists.' })),
            dash));
          pick('p2');
        },
      },
      /* ---------------- 4. Build a process image; contiguous vs paged ---------------- */
      {
        title: 'Build a process image, then decide where it lives',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const PARTS = [
            { k: 'prog', name: 'User program', cls: 's-cpu', sw: 'var(--cpu-bg)', bd: 'var(--cpu)',
              say: '<b>User program.</b> The machine instructions the process executes, loaded from the program file on disk. Run the editor twice and you get two processes, each with its own image and PCB, though the code is identical.' },
            { k: 'data', name: 'User data', cls: 's-mem', sw: 'var(--mem-bg)', bd: 'var(--mem)',
              say: '<b><span class="t">User data</span>.</b> The part of the image the program may change: its variables and buffers, a user stack area, and (rarely) code that rewrites itself. It is what makes your copy of the editor differ from someone else\'s.' },
            { k: 'stack', name: 'Stack', cls: 's-warn', sw: 'var(--warn-bg)', bd: 'var(--warn)',
              say: '<b>Stack.</b> One or more last-in, first-out <span class="t" data-t="System stack">system stacks</span> that remember calls in progress: each procedure or system call pushes its parameters and return address, and each return pops them.' },
            { k: 'pcb', name: 'Process control block', cls: 's-accent', sw: 'var(--accent-bg)', bd: 'var(--accent)',
              say: '<b>Process control block (PCB).</b> Not part of the program: the attributes the OS needs to control the process (IDs, saved registers, state, priority, pointers). The program itself cannot change it.' },
          ];
          const P = Object.fromEntries(PARTS.map((p) => [p.k, p]));
          const added = new Set();
          let layout = 'contig', last = null;
          // frame contents per layout: [part, label] for process 7, or a plain string for other owners
          const LAYOUT = {
            contig: { 0: 'OS', 1: 'OS', 2: 'P3', 3: 'P3', 4: 'P5', 5: 'P5', 6: ['pcb', 'PCB'], 7: ['prog', 'program p0'], 8: ['prog', 'program p1'], 9: ['data', 'data p0'], 10: ['data', 'data p1'], 11: ['data', 'data p2'], 12: ['stack', 'stack'], 13: 'P9', 14: '', 15: '' },
            paged: { 0: 'OS', 1: 'OS', 2: 'P3', 3: ['pcb', 'PCB'], 4: 'P5', 5: ['data', 'data p0'], 6: '', 7: 'P9', 8: 'P3', 9: ['stack', 'stack'], 10: 'P5', 11: '', 12: ['prog', 'program p0'], 13: 'P9', 14: ['data', 'data p1'], 15: '' },
          };
          const ONDISK = { contig: [], paged: [['prog', 'program p1'], ['data', 'data p2']] };
          const MAP = {
            contig: [['image', 'frames 6–12'], ['starts at', '0x6000'], ['size', '7 frames'], ['on disk', 'nothing']],
            paged: [['PCB', 'frame 3'], ['program p0', 'frame 12'], ['program p1', 'disk'], ['data p0', 'frame 5'], ['data p1', 'frame 14'], ['data p2', 'disk'], ['stack', 'frame 9']],
          };
          const NW = ctx.narrow, FW = NW ? 180 : 132;
          const fx = NW ? (i) => 16 + (i < 8 ? 0 : 188) : (i) => 204 + (i < 8 ? 0 : 140), fy = NW ? (i) => 232 + (i % 8) * 36 : (i) => 64 + (i % 8) * 36;
          const svgBox = h('div', { class: 'card white tight grow', style: { display: 'grid', placeItems: 'center' } });
          const cap = h('div', { class: 'card tight small', style: { lineHeight: '1.45' } });
          const say = h('div', { class: 'card white small grow', style: { lineHeight: '1.5' } });
          const btns = {};
          const grid = h('div', { class: 'grid-2', style: { gap: '8px' } });
          PARTS.forEach((p) => {
            btns[p.k] = h('button', { class: 'btn s33-part', type: 'button', onclick: () => { added.add(p.k); last = p.k; paint(); } });
            grid.append(btns[p.k]);
          });
          const seg = ctx.ui.seg([{ value: 'contig', label: 'One contiguous block' }, { value: 'paged', label: 'Paged: scattered, some on disk' }], layout, (v) => { layout = v; paint(); });
          const reset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { added.clear(); last = null; layout = 'contig'; seg.set('contig'); paint(); } }, 'Start over');
          const count = h('span', { class: 'xs muted' });

          function piece(x, y, w, hh, part, label) {
            const on = added.has(part), tx = x + w / 2 + 8, ty = y + hh / 2 + 5;
            return on ? `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="6" class="${P[part].cls}" stroke-width="2.5"/><text x="${tx}" y="${ty}" text-anchor="middle" font-size="13" font-weight="800">${label}</text>`
              : `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="6" fill="none" style="stroke:var(--proc)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${tx}" y="${ty}" text-anchor="middle" font-size="13" class="s-sub">${label} ?</text>`;
          }
          function paint() {
            const L = LAYOUT[layout];
            let frames = '';
            for (let i = 0; i < 16; i++) {
              const v = L[i], x = fx(i), y = fy(i), W = FW, H = 31, tx = x + W / 2 + 8;
              if (Array.isArray(v)) frames += piece(x, y, W, H, v[0], v[1]);
              else if (v === 'OS') frames += `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="6" class="s-os" stroke-width="1.5"/><text x="${tx}" y="${y + 20}" text-anchor="middle" font-size="13">OS kernel</text>`;
              else if (v) frames += `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="6" class="s-panel" stroke-width="1.5"/><text x="${tx}" y="${y + 20}" text-anchor="middle" font-size="13" class="s-sub">process ${v.slice(1)}</text>`;
              else frames += `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="6" fill="none" class="s-muted" stroke-dasharray="4 4" stroke-width="1.5"/><text x="${tx}" y="${y + 20}" text-anchor="middle" font-size="13" class="s-sub">free</text>`;
              frames += `<text x="${x + 11}" y="${y + 20}" text-anchor="middle" font-size="13" class="s-sub">${i}</text>`;
            }
            const py = fy(layout === 'contig' ? 6 : 3) + 15.5;
            const ptRows = (x, y0, w) => ['P3', 'P5', 'P7', 'P9'].map((t, k) => `<rect x="${x}" y="${y0 + k * 26}" width="${w}" height="22" rx="5" class="${t === 'P7' ? 's-proc' : 's-panel'}" stroke-width="${t === 'P7' ? 2 : 1}"/><text x="${x + 10}" y="${y0 + 15.5 + k * 26}" font-size="13" font-weight="${t === 'P7' ? 800 : 400}">${t}${t === 'P7' ? ': image at →' : ''}</text>`).join('');
            const mapRows = (x0, x1, y0) => MAP[layout].map(([a, b], k) => `<text x="${x0}" y="${y0 + k * 18}" font-size="13">${a}</text><text x="${x1}" y="${y0 + k * 18}" text-anchor="end" font-size="13" font-weight="700">${b}</text>`).join('');
            const none = (x, y) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="13" class="s-sub">no pages of process 7 here: all of it is in main memory</text>`;
            if (NW) {
              const disk = ONDISK[layout].map(([part, label], k) => piece(16 + k * 188, 586, 180, 34, part, label)).join('');
              svgBox.innerHTML = `<svg viewBox="0 0 400 680" width="100%" role="img" aria-label="Memory frames holding the image of process 7">
                <text x="8" y="16" font-size="13" class="s-sub">Coloured = process 7; dashed = not added yet.</text>
                <rect x="8" y="28" width="188" height="162" rx="10" class="s-os" stroke-width="2"/><text x="102" y="48" text-anchor="middle" font-size="14" font-weight="800">Process table</text>
                ${ptRows(18, 60, 168)}
                <path d="M18 123 H4 V${py} H12" fill="none" style="stroke:var(--proc)" stroke-width="2.5" marker-end="url(#arr-proc)"/>
                <rect x="204" y="28" width="188" height="162" rx="10" class="s-panel" stroke-width="1.5"/><text x="298" y="48" text-anchor="middle" font-size="14" font-weight="800">P7 memory map</text>
                ${mapRows(214, 382, 72)}
                <text x="200" y="214" text-anchor="middle" font-size="14" font-weight="800">Main memory (frames 0–15, 4 KB each)</text>
                <rect x="8" y="222" width="384" height="300" rx="10" fill="none" style="stroke:var(--mem)" stroke-width="2"/>
                ${frames}
                <rect x="8" y="536" width="384" height="138" rx="12" class="s-io" stroke-width="2"/><text x="200" y="556" text-anchor="middle" font-size="14" font-weight="800">Disk (secondary memory)</text>
                <text x="16" y="578" font-size="13" font-weight="700">swap area</text>
                ${disk || none(200, 608)}
                <rect x="16" y="630" width="368" height="34" rx="7" class="s-panel" stroke-width="1.5"/><text x="200" y="652" text-anchor="middle" font-size="13"><tspan font-weight="700">program file</tspan> (photo editor code)</text>
              </svg>`;
            } else {
              const disk = ONDISK[layout].map(([part, label], k) => piece(522, 116 + k * 46, 170, 34, part, label)).join('');
              svgBox.innerHTML = `<svg viewBox="0 0 720 360" width="100%" role="img" aria-label="Memory frames holding the image of process 7">
                <text x="8" y="18" font-size="13" class="s-sub">Coloured pieces belong to process 7; dashed ones have not been added yet.</text>
                <rect x="8" y="34" width="170" height="140" rx="10" class="s-os" stroke-width="2"/><text x="93" y="55" text-anchor="middle" font-size="14" font-weight="800">Process table</text>
                ${ptRows(20, 66, 146)}
                <path d="M166 129 C 186 129, 180 ${py}, 200 ${py}" fill="none" style="stroke:var(--proc)" stroke-width="2.5" marker-end="url(#arr-proc)"/>
                <rect x="8" y="186" width="170" height="168" rx="10" class="s-panel" stroke-width="1.5"/><text x="93" y="206" text-anchor="middle" font-size="14" font-weight="800">P7 memory map</text>
                ${mapRows(20, 168, 228)}
                <text x="344" y="46" text-anchor="middle" font-size="14" font-weight="800">Main memory (frames 0–15, 4 KB each)</text>
                <rect x="196" y="54" width="296" height="300" rx="10" fill="none" style="stroke:var(--mem)" stroke-width="2"/>
                ${frames}
                <rect x="506" y="34" width="202" height="320" rx="12" class="s-io" stroke-width="2"/><text x="607" y="56" text-anchor="middle" font-size="14" font-weight="800">Disk</text>
                <text x="607" y="76" text-anchor="middle" font-size="13" class="s-sub">(secondary memory)</text>
                <text x="607" y="104" text-anchor="middle" font-size="13" font-weight="700">swap area</text>
                ${disk || '<text x="607" y="150" text-anchor="middle" font-size="13" class="s-sub">no pages of process 7 here:</text><text x="607" y="168" text-anchor="middle" font-size="13" class="s-sub">all of it is in main memory</text>'}
                <rect x="522" y="262" width="170" height="76" rx="7" class="s-panel" stroke-width="1.5"/><text x="607" y="292" text-anchor="middle" font-size="13" font-weight="700">program file</text><text x="607" y="312" text-anchor="middle" font-size="13" class="s-sub">(photo editor code)</text>
              </svg>`;
            }
            PARTS.forEach((p) => {
              const b = btns[p.k], on = added.has(p.k);
              b.innerHTML = `<span class="s33-sw" style="background:${p.sw};border-color:${p.bd}"></span>${p.name}${on ? ' ✓' : ''}`;
              b.classList.toggle('on', on);
            });
            const done = added.size === 4;
            say.innerHTML = (last ? P[last].say : `<b>Click a part</b> to add it to process 7's image. It appears in the memory diagram ${NW ? 'below' : 'on the right'}.`)
              + (done ? '<div style="margin-top:6px"><span class="s33-ok">✓ Complete:</span> that is the whole <b>process image</b>. Now compare both layouts.</div>' : '');
            count.textContent = `${added.size} of 4 parts added · click one to re-read it`;
            cap.innerHTML = layout === 'contig'
              ? '<b>One contiguous block.</b> The whole image fills one unbroken run of frames (6–12), so a single pointer to its start (0x6000) is enough. The catch: the OS must find one gap big enough, and the whole image must be brought in before the process can run.'
              : '<b>Paged.</b> The image is cut into equal-size pages, each placed in any free <span class="t" data-t="Frame">frame</span>. Pages not needed right now (program p1, data p2) wait on disk. The process table leads to the PCB, and the PCB points to the map of every page.';
            ctx.refit();
          }
          el.append(h('div', { class: 'split l3 fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'A <span class="t">process image</span> is everything that makes up one process. Build the image of process 7, a photo editor, by clicking its four parts:' }),
              grid, say,
              h('div', { class: 'callout why small m0', 'data-label': 'The location rule', html: 'The OS can manage a process only while at least its PCB is in main memory, and can <i>run</i> it only when the parts in use are there too. So it must track where every part of every image is.' }),
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, count, reset)),
            h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { class: 'small' }, 'Where does the image live?'), seg), svgBox, cap)));
          paint();
        },
      },
      /* ---------------- 5. Inside the PCB: three groups of attributes (+ sort game) ---------------- */
      {
        title: 'Inside the PCB: three groups of attributes',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const GROUPS = [
            { k: 'id', name: 'Process identification', short: 'Identification', color: 'proc', fields: ['process ID', 'parent ID', 'user ID'],
              intro: '<span class="t">Process identification</span>: numbers that say <b>who</b> this process is. They are small, but every other table uses them to refer to the process.',
              rows: [
                ['Process identifier', '7', 'A unique number for this process. The memory, I/O and file tables refer to the process by it, and it often doubles as its position in the process table.'],
                ['Parent identifier', '2 (the desktop shell)', 'The process that created this one. The OS uses it to keep the family tree and to tell the parent when this child ends.'],
                ['User identifier', '1004 (maria)', 'The user this process works for. It decides what the process may touch, for example which files it may open.'],
              ] },
            { k: 'cpu', name: 'Processor state information', short: 'Processor state', color: 'cpu', fields: ['user-visible registers', 'program counter', 'condition codes', 'status bits', 'stack pointers'],
              intro: '<span class="t">Processor state information</span> is a copy of the processor registers, saved when process 7 was last interrupted and loaded back when it resumes (while it runs, the values live in the processor itself). Three kinds: user-visible registers, <span class="t" data-t="Control and status registers">control and status registers</span> (the middle three rows) and stack pointers.',
              rows: [
                ['<span class="t">User-visible registers</span>', 'R0 = 42, R1 = 0x9A10, … R7', 'The general-purpose registers the program\'s own instructions use (often 8 to 32 of them).'],
                ['Program counter<div class="xs muted">control / status</div>', '0x7124', 'The address of the next instruction. Restoring it makes the process resume at exactly the right spot.'],
                ['Condition codes<div class="xs muted">control / status</div>', 'zero 0 · sign 1 · carry 0 · overflow 0', 'Result flags of the last arithmetic or logic instruction (sign, zero, carry, equal, overflow). A pending "jump if equal" depends on them.'],
                ['Status information<div class="xs muted">control / status</div>', 'interrupts enabled · user mode', 'Whether interrupts are enabled or disabled, and the execution mode. With the condition codes, these form the program status word.'],
                ['Stack pointers', 'user 0xCFF0 · system 0x0F80', 'Where the top of each stack is (the user stack and the stack the OS uses for this process), so calls in progress can return correctly.'],
              ] },
            { k: 'ctl', name: 'Process control information', short: 'Process control', color: 'os', fields: ['scheduling + state', 'data structuring', 'communication', 'privileges', 'memory management', 'resources used'],
              intro: '<span class="t">Process control information</span> is everything else the OS needs to <b>manage and coordinate</b> the process: when it may run, what it is linked to, what it may do and what it owns.',
              rows: [
                ['Scheduling and state', 'Blocked · priority 12 · waited 340 ms · waiting for: disk read', 'Its state, its priority, facts the scheduler uses (such as time spent waiting) and the event it is waiting for.'],
                ['Data structuring', 'next in disk queue → PCB 9 · parent → PCB 2 · children → 11, 12', 'Pointers to other PCBs: the queue it sits in and its parent and child links. This is how the OS builds lists and family trees.'],
                ['<span class="t">Interprocess communication</span>', '1 signal pending · 2 messages waiting', 'Flags, signals and messages exchanged with other processes.'],
                ['<span class="t">Process privileges</span>', 'own frames + shared lib (read-only) · no privileged instructions · print service allowed', 'Which memory it may access, which kinds of instructions it may execute, and which system services it may use.'],
                ['Memory management', '→ P7 memory map (page table)', 'Pointers to its segment and/or page tables: the maps that say where each piece of its memory is, in a frame or on disk.'],
                ['Resource ownership and utilization', 'open: photo.raw, settings.cfg · processor time 1.2 s', 'Resources it controls, such as open files, and a history of its use of the processor and other resources.'],
              ] },
          ];
          let tabs = null;
          const mini = h('div', { class: 's33-mini' });
          const paintMini = (cur) => {
            mini.innerHTML = '';
            mini.append(h('div', { class: 'xs muted b', style: { textAlign: 'center' } }, 'PCB of process 7'));
            GROUPS.forEach((g, i) => mini.append(h('button', { type: 'button', class: 's33-band ' + g.color + (cur === i ? ' on' : ''), onclick: () => tabs.show(i) },
              h('b', {}, g.short), h('span', { class: 'xs' }, g.fields.join(' · ')))));
            mini.append(h('div', { class: 'xs muted', style: { textAlign: 'center' }, html: cur === 3 ? 'Sort game: use the<br>three groups above.' : 'Click a band or a tab.' }));
          };
          const groupPanel = (g) => (p) => {
            p.append(h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0 small', html: g.intro }),
              h('table', { class: 'tbl compact s33-pcbt' },
                h('tr', {}, h('th', {}, 'Field'), h('th', {}, 'Value in PCB 7'), h('th', {}, 'What it is for')),
                ...g.rows.map(([f, v, w]) => h('tr', {}, h('td', { class: 'b', html: f }), h('td', { class: 'mono' }, v), h('td', { html: w })))),
              g.k === 'cpu' ? h('div', { class: 'callout why small m0', 'data-label': 'Why save them?', html: 'If process 7 is stopped between comparing two numbers and jumping on the result, the next process will overwrite the flags. Without the saved copy, process 7 would resume and take the wrong branch. The next step shows these flags inside x86\'s PSW, EFLAGS.' }) : null,
              g.k === 'id' ? h('div', { class: 'callout tip small m0', 'data-label': 'Cross-reference', html: 'In the OS’s tables, an I/O entry reads "Disk 0 · for 2" and a file entry reads "open: 2". That 2 is a process identifier. IDs are the glue between the tables.<br>The eight PCB elements of section 3.1 all fit these groups: the identifier here; program counter and context data under processor state; state, priority, memory pointers, I/O status and accounting under process control.' }) : null,
              g.k === 'id' ? h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'A process ID is not the program\'s name. Open the photo editor twice and you get two processes with two different IDs, two images and two PCBs, all running the same code.' }) : null,
              g.k === 'ctl' ? h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: '"Processor time used" sounds like processor state, but it is not a register. It is a usage record the OS keeps for scheduling and accounting, so it belongs to process control information.' }) : null));
          };
          const host = h('div', { style: { minHeight: 0, height: '100%' } });
          el.append(h('div', { class: 'split s33-psplit fill' }, mini, host));
          tabs = ctx.ui.tabs([
            ...GROUPS.map((g, i) => ({ label: `${i + 1} · ${g.short}`, render: groupPanel(g) })),
            { label: 'Sort game ▶', render: (p) => sortGame(p) },
          ], { onChange: (i) => paintMini(i) });
          host.append(tabs);
          function sortGame(p) {
            const ITEMS = [
              ['ID of this process', 0, 'It names the process, so it is identification.'],
              ['ID of the parent process', 0, 'Still an identifier, just of the process that created this one.'],
              ['ID of the user it runs for', 0, 'The user ID is part of process identification.'],
              ['Program counter', 1, 'It is a processor register, so it is saved with the processor state.'],
              ['Condition codes', 1, 'These result bits live in a processor register (the PSW).'],
              ['Interrupts enabled/disabled flag', 1, 'A status bit inside the processor, part of the PSW.'],
              ['Execution mode (user or kernel)', 1, 'The current mode is status information held in the processor.'],
              ['General-purpose register values', 1, 'User-visible registers are processor state.'],
              ['Process state (Ready, Blocked…)', 2, 'The scheduling state is not a register; the OS uses it to manage the process.'],
              ['Priority', 2, 'Priority is scheduling information: process control.'],
              ['Pointer to the next PCB in its queue', 2, 'A data-structuring link the OS uses to build queues.'],
              ['Pending signals and messages', 2, 'Interprocess communication belongs to process control.'],
              ['Pointer to its page table', 2, 'Memory-management information is process control.'],
              ['List of open files', 2, 'Resource ownership is process control information.'],
              ['Processor time used so far', 2, 'Tricky: it mentions the processor, but it is a usage record the OS keeps (resource utilization), not a register.'],
            ];
            const rnd = ctx.util.seeded(33);
            const order = ctx.util.shuffle(ITEMS.map((_, i) => i), rnd);
            const placed = new Map();
            const missed = new Set();
            let sel = null;
            const score = h('span', { class: 'chip accent' });
            const tray = h('div', { class: 's33-tray' });
            const fb = h('div', { class: 'card tight small', style: { minHeight: '48px' } });
            const bucketEls = GROUPS.map((g, b) => h('div', { class: `card ${g.color} s33-bucket`, role: 'button', tabindex: 0, 'aria-label': 'Put the selected field in ' + g.name, onclick: () => drop(b), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(b); } } }));
            function drop(b) {
              if (sel == null) { fb.innerHTML = '<b>First pick a field</b> from the tray, then click the group it belongs to.'; return; }
              const [text, ans, why] = ITEMS[sel];
              if (b === ans) {
                placed.set(sel, b);
                fb.innerHTML = `<span class="s33-ok">✓ ${text}</span> belongs to <b>${GROUPS[b].name}</b>. ${why}`;
                sel = null;
              } else {
                missed.add(sel);
                fb.innerHTML = `<span class="s33-no">✗ Not ${GROUPS[b].short.toLowerCase()}.</span> ${why.startsWith('Tricky') ? 'Think about who keeps it and why.' : 'Ask: is it a name, a processor register, or something the OS uses to manage the process?'}`;
                bucketEls[b].classList.remove('flash'); void bucketEls[b].offsetWidth; bucketEls[b].classList.add('flash');
              }
              paint();
            }
            function paint() {
              tray.innerHTML = '';
              const left = order.filter((i) => !placed.has(i));
              left.forEach((i) => tray.append(h('button', { type: 'button', class: 'btn sm' + (sel === i ? ' on' : ''), onclick: () => { sel = sel === i ? null : i; paint(); } }, ITEMS[i][0])));
              if (!left.length) tray.append(h('div', { class: 'small', html: `<b>All sorted!</b> ${ITEMS.length - missed.size} of ${ITEMS.length} placed right on the first try.` }));
              GROUPS.forEach((g, b) => {
                const el2 = bucketEls[b];
                el2.innerHTML = '';
                el2.append(h('div', { class: 'b small' }, g.name), h('div', { class: 's33-dropped' }, ...order.filter((i) => placed.get(i) === b).map((i) => h('span', { class: 'chip ' + g.color }, ITEMS[i][0]))));
                el2.classList.toggle('armed', sel != null);
              });
              score.textContent = `${placed.size} / ${ITEMS.length} sorted`;
            }
            const again = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { placed.clear(); missed.clear(); sel = null; fb.innerHTML = 'Pick a field, then click its group.'; paint(); } }, 'Start over');
            fb.innerHTML = 'Pick a field from the tray, then click the group it belongs to.';
            p.append(h('div', { class: 'stack fill', style: { gap: '8px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small', html: 'Which of the three groups does each field belong to?' }), h('div', { class: 'row' }, score, again)),
              tray, h('div', { class: 'grid-3 grow', style: { gap: '10px' } }, ...bucketEls), fb));
            paint();
          }
        },
      },
      /* ---------------- 6. The program status word: x86 EFLAGS lab ---------------- */
      {
        title: 'The program status word: watch EFLAGS change',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          let op = 'add', A = 200, B = 100;
          const sgn = (v) => (v > 127 ? v - 256 : v);
          const sn = (v) => (v < 0 ? '−' + -v : String(v));
          const bits8 = (v) => { const b = v.toString(2).padStart(8, '0'); return b.slice(0, 4) + ' ' + b.slice(4); };
          function alu() {
            const raw = op === 'add' ? A + B : A - B;
            const r = ((raw % 256) + 256) % 256;
            const sa = sgn(A), sb = sgn(B), sr = sgn(r);
            const CF = op === 'add' ? +(raw > 255) : +(A < B);
            const OF = op === 'add' ? +((A & 128) === (B & 128) && (r & 128) !== (A & 128)) : +((A & 128) !== (B & 128) && (r & 128) !== (A & 128));
            let ones = 0; for (let x = r; x; x >>= 1) ones += x & 1;
            return { raw, r, sa, sb, sr, CF, ZF: +(r === 0), SF: r >> 7, OF, PF: +(ones % 2 === 0), AF: +(((A ^ B ^ r) & 16) !== 0) };
          }
          // EFLAGS low 16 bits, from bit 15 down to bit 0: [label, key, kind]
          const LAYOUT = [['0', 'r15', 'res'], ['NT', 'NT', 'ctl'], ['IOPL', 'IOPL', 'ctl', 2], ['OF', 'OF', 'cc'], ['DF', 'DF', 'ctl'], ['IF', 'IF', 'ctl'], ['TF', 'TF', 'ctl'], ['SF', 'SF', 'cc'], ['ZF', 'ZF', 'cc'], ['0', 'r5', 'res'], ['AF', 'AF', 'cc'], ['0', 'r3', 'res'], ['PF', 'PF', 'cc'], ['1', 'r1', 'res'], ['CF', 'CF', 'cc']];
          const BITINFO = {
            CF: '<b>CF, carry (bit 0).</b> An unsigned result did not fit: a carry out of the top bit on ADD, or a borrow on SUB.',
            PF: '<b>PF, parity (bit 2).</b> 1 when the low byte of the result has an even number of 1 bits.',
            AF: '<b>AF, auxiliary carry (bit 4).</b> A carry out of bit 3, used by decimal (BCD) arithmetic instructions.',
            ZF: '<b>ZF, zero (bit 6).</b> The result was 0. After SUB or CMP this means the two values were equal.',
            SF: '<b>SF, sign (bit 7).</b> A copy of the top bit of the result: 1 means negative when read as a signed number.',
            TF: '<b>TF, trap (bit 8).</b> When 1, the processor raises a debug exception after every instruction, handing control to a debugger. That is how single-stepping works.',
            IF: '<b>IF, interrupt enable (bit 9).</b> When 1, the processor responds to (maskable) interrupt requests from devices; when 0 they wait. Ordinary programs are normally not allowed to change it; the OS is.',
            DF: '<b>DF, direction (bit 10).</b> Whether string instructions (which copy or scan a run of bytes) step up or down through memory.',
            OF: '<b>OF, overflow (bit 11).</b> A signed result did not fit (for 8-bit values: outside −128 to 127).',
            IOPL: '<b>IOPL, I/O privilege level (bits 12–13).</b> How privileged code must be to use I/O instructions directly.',
            NT: '<b>NT, nested task (bit 14).</b> Used by the processor\'s built-in hardware task-switching feature.',
            res: '<b>Reserved bit.</b> Fixed by the processor (bit 1 always reads 1, bits 3, 5 and 15 read 0).',
            high: '<b>Bits 16–31.</b> More control bits (RF resume, VM virtual-8086 mode, AC alignment check, VIF, VIP and ID) and, above bit 21, reserved bits.',
            guide: '<b>Click any bit to read its job.</b> This lab needs only the four condition codes CF, ZF, SF and OF (plus IF, which the OS uses). The faded bits NT, IOPL, DF, TF, AF and PF have other jobs you can skip for now.',
          };
          const DIM = new Set(['NT', 'IOPL', 'DF', 'TF', 'AF', 'PF', 'res']);
          let info = 'guide';
          const opSeg = ctx.ui.seg([{ value: 'add', label: 'ADD  A + B' }, { value: 'sub', label: 'SUB  A − B' }], op, (v) => { op = v; paint(); });
          const sA = ctx.ui.slider({ label: 'A', min: 0, max: 255, value: A, onInput: (v) => { A = v; paint(); } });
          const sB = ctx.ui.slider({ label: 'B', min: 0, max: 255, value: B, onInput: (v) => { B = v; paint(); } });
          const PRESETS = [['add', 5, 3], ['add', 200, 100], ['add', 100, 50], ['sub', 7, 7], ['sub', 3, 5], ['sub', 128, 1]];
          const presets = h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'xs muted b' }, 'TRY:'),
            ...PRESETS.map(([o, a, b]) => h('button', { class: 'btn sm', type: 'button', onclick: () => { op = o; A = a; B = b; opSeg.set(o); sA.set(a); sB.set(b); paint(); } }, `${a} ${o === 'add' ? '+' : '−'} ${b}`)));
          const arith = h('div', { class: 'card white tight s33-alu' });
          const strip = h('div', { class: 'card white tight', style: { padding: '6px 10px' } });
          const bitInfo = h('div', { class: 'small', style: { minHeight: '42px', marginTop: '2px' } });
          const cards = h('div', { class: 'grid-4', style: { gap: '8px' } });
          const CH = [
            ['ZF = 1 using <b>ADD</b>', (f) => op === 'add' && f.ZF],
            ['OF = 1, CF = 0', (f) => f.OF && !f.CF],
            ['CF = 1, OF = 0', (f) => f.CF && !f.OF],
            ['Show A = B with <b>SUB</b>', (f) => op === 'sub' && f.ZF],
          ];
          const won = new Set();
          const chal = h('div', { class: 'card tight s33-chal' });
          function paint() {
            const f = alu(), sym = op === 'add' ? '+' : '−';
            // signed reading in two's complement: top bit set → value − 256 (shown so the rule is visible)
            const sgnTxt = (u, sv) => `signed ${sn(sv)}` + (u > 127 ? ` <span class="xs">(${u} − 256)</span>` : '');
            arith.innerHTML = `<table class="s33-at"><tr><td>A</td><td class="n">${A}</td><td class="m">${bits8(A)}</td><td class="muted">${sgnTxt(A, f.sa)}</td></tr>
              <tr><td>${sym} B</td><td class="n">${B}</td><td class="m">${bits8(B)}</td><td class="muted">${sgnTxt(B, f.sb)}</td></tr>
              <tr class="res"><td>= result</td><td class="n">${f.r}</td><td class="m">${bits8(f.r)}</td><td class="muted">${sgnTxt(f.r, f.sr)}</td></tr></table>
              <div class="xs muted" style="margin-top:4px">Exact answer: ${A} ${sym} ${B} = ${f.raw}. Only 8 bits fit in the result register${f.raw !== f.r ? `, so it holds ${f.r}` : ''}.</div>`;
            const val = { ...f, TF: 0, IF: 1, DF: 0, NT: 0, IOPL: 0 };
            const NW = ctx.narrow, CW = NW ? 46 : 42;
            let x = NW ? 6 : 12, dy = 0, cells = '';
            LAYOUT.forEach(([lab, key, kind, span], i) => {
              if (NW && i === 7) { x = 6; dy = 84; }
              const w = (span || 1) * CW - 4, v = kind === 'res' ? lab : (key === 'IOPL' ? '00' : val[key]);
              const bitNo = 15 - i - (i > 2 ? 1 : 0);
              const on = kind === 'cc' && val[key] === 1;
              const cls = kind === 'cc' ? (on ? 's-cpu' : 's-panel') : kind === 'ctl' ? 's-os' : 's-panel';
              const ik = kind === 'res' ? 'res' : key;
              const dim = DIM.has(ik) && info !== ik ? ' dim' : '';
              cells += `<g class="hot${dim}" role="button" tabindex="0" data-b="${ik}" aria-label="${lab} bit">
                <text x="${x + w / 2}" y="${30 + dy}" text-anchor="middle" font-size="13" class="s-sub">${span ? '13–12' : bitNo}</text>
                <rect x="${x}" y="${36 + dy}" width="${w}" height="34" rx="6" class="${cls}" stroke-width="${on || info === ik ? 3 : 1.5}" ${info === ik ? 'style="stroke:var(--accent)"' : ''}/>
                <text x="${x + w / 2}" y="${59 + dy}" text-anchor="middle" font-size="17" font-weight="800" ${on ? 'style="fill:var(--cpu)"' : ''}>${v}</text>
                <text x="${x + w / 2}" y="${88 + dy}" text-anchor="middle" font-size="13" font-weight="${kind === 'cc' ? 800 : 500}" ${kind === 'res' ? 'class="s-sub"' : ''}>${kind === 'res' ? '·' : lab}</text></g>`;
              x += w + 4;
            });
            const VW = NW ? 380 : 720;
            strip.innerHTML = `<svg viewBox="0 0 ${VW} ${NW ? 180 : 96}" width="100%" role="img" aria-label="Low 16 bits of the EFLAGS register">
              <text x="${NW ? 6 : 12}" y="13" font-size="13" font-weight="800">EFLAGS, bits 15 → 0</text>
              ${NW ? '' : `<text x="372" y="13" text-anchor="middle" font-size="13"><tspan style="fill:var(--cpu)" font-weight="700">blue</tspan> = flag set · <tspan style="fill:var(--os)" font-weight="700">violet</tspan> = OS control bit · <tspan class="s-sub">faded</tspan> = not needed here</text>`}
              <g class="hot" role="button" tabindex="0" data-b="high"><text x="${VW - 12}" y="13" text-anchor="end" font-size="13" class="s-sub" ${info === 'high' ? 'style="fill:var(--accent)" font-weight="800"' : ''}>bits 16–31 ▸</text></g>
              ${cells}</svg>`;
            bitInfo.innerHTML = `<div>${BITINFO[info]}</div>` + (NW ? '<div class="xs muted">Blue = condition code set by the last result · violet = control bit set by the OS · faded = not needed in this lab.</div>' : '');
            const why = {
              CF: op === 'add' ? (f.CF ? `${A} + ${B} = ${f.raw}, more than 255: the carry out of bit 7 lands in CF.` : `${A} + ${B} = ${f.raw} fits in 8 bits (at most 255).`) : (f.CF ? `${A} is less than ${B} (unsigned), so a borrow was needed.` : `${A} ≥ ${B} (unsigned): no borrow needed.`),
              ZF: f.ZF ? (op === 'sub' ? 'The result is 0, so A and B are <b>equal</b>. "Jump if equal" tests this bit.' : (f.raw !== f.r ? `The 8-bit result is 0: the true sum ${f.raw} wrapped around to 0.` : 'The result is 0.')) : (op === 'sub' ? 'The result is not 0, so A ≠ B.' : 'The result is not 0.'),
              SF: f.SF ? `Bit 7 of the result is 1: read as signed, the result (${sn(f.sr)}) is negative.` : 'Bit 7 of the result is 0: as a signed number it is not negative.',
              OF: `Signed: ${sn(f.sa)} ${sym} ${f.sb < 0 ? '(' + sn(f.sb) + ')' : sn(f.sb)} = ${sn(op === 'add' ? f.sa + f.sb : f.sa - f.sb)}, ` + (f.OF ? 'outside −128…127, so the signed answer is wrong.' : 'which fits in −128…127.'),
            };
            cards.innerHTML = ['CF', 'ZF', 'SF', 'OF'].map((k) => `<div class="card tight s33-flag${f[k] ? ' set' : ''}"><div class="row" style="justify-content:space-between;align-items:baseline"><span><b>${k}</b> <span class="xs">${{ CF: 'carry', ZF: 'zero', SF: 'sign', OF: 'overflow' }[k]}</span></span><span class="s33-fv">${f[k]}</span></div><div class="s33-fw">${why[k]}</div></div>`).join('');
            CH.forEach(([, test], i) => { if (test(f)) won.add(i); });
            chal.innerHTML = `<div><b class="small">Challenges</b> <span class="chip ${won.size === CH.length ? 'ok' : 'accent'}">${won.size} / ${CH.length}</span></div>` +
              CH.map(([t], i) => `<div class="small">${won.has(i) ? '<span class="s33-ok">✓</span>' : '<span class="muted">○</span>'} ${t}</div>`).join('');
          }
          const pick = (e) => { const g = e.target.closest('[data-b]'); if (!g) return false; info = g.dataset.b; paint(); return true; };
          ctx.on(strip, 'click', pick);
          ctx.on(strip, 'keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && pick(e)) e.preventDefault(); });
          el.append(h('div', { class: 'split s33-fsplit fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: '<span class="t">Condition codes</span> and status bits share one register, the <span class="t">program status word (PSW)</span>. On x86 it is the 32-bit <span class="t">EFLAGS</span> register.' }),
              h('p', { class: 'm0 small', html: 'Arithmetic instructions set the condition codes; later instructions test them (<i>jump if zero</i>, <i>jump if carry</i>…). The lab uses 8-bit values, like x86\'s AL and BL registers.' }),
              h('div', { class: 'callout tip small m0', 'data-label': 'Negative numbers: two\'s complement', html: 'x86 does <b>not</b> use the sign-magnitude form from 1.3 (where 8005 hex meant −5). It uses <b>two\'s complement</b>: in 8 bits, a value whose top bit is 1 stands for <b>value − 256</b>. So 200 means 200 − 256 = −56, and 255 means −1.<br><b>CF</b> = the <i>unsigned</i> result did not fit in 0…255.<br><b>OF</b> = the <i>signed</i> result did not fit in −128…127.' }),
              h('div', { class: 'callout why small m0', 'data-label': 'Why the OS cares', html: 'The flags describe the <b>running</b> process\'s last result, so the OS saves EFLAGS in the PCB and restores it before the process runs again.' })),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, opSeg, presets),
              h('div', { class: 'grid-2', style: { gap: '18px' } }, sA, sB),
              arith, h('div', {}, strip, bitInfo), cards, chal)));
          paint();
        },
      },
      /* ---------------- 7. The PCB at the centre: queues of PCBs and protecting them ---------------- */
      {
        title: 'Every module touches PCBs: queues and protection',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const MODS = [['sched', 'Scheduler'], ['alloc', 'Resource allocator'], ['intr', 'Interrupt handlers'], ['perf', 'Performance monitor']];
          const INIT = () => ({ run: 5, ready: [3, 7, 9], disk: [12], cpu: { 3: 20, 5: 30, 7: 10, 9: 0, 12: 50 }, bad: null, lost: [], rewrite: false, lit: [], gate: false });
          let S = INIT(), mode = 'direct';
          const say = h('div', { class: 'card white small grow', style: { lineHeight: '1.5' } });
          const svgBox = h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center' } });
          const B = {};
          const act = (k, label, fn) => (B[k] = h('button', { class: 'btn sm', type: 'button', onclick: fn }, label));
          const stateOf = (p) => (S.run === p ? 'Running' : S.ready.includes(p) ? 'Ready' : 'Blocked');
          function narrate(html) { say.innerHTML = html; }
          function dispatch() {
            const p = S.ready.shift(); S.run = p; S.lit = ['sched'];
            narrate(`<b>Dispatch.</b> The scheduler unlinks PCB ${p} from the head of the ready queue (the head pointer now leads to ${S.ready.length ? 'PCB ' + S.ready[0] : 'nothing'}) and the dispatcher loads the processor state saved in it. Process ${p} runs. No PCB was copied or moved.`);
          }
          function timeout() {
            const p = S.run; S.run = null; S.cpu[p] += 10; S.ready.push(p); S.lit = ['intr', 'sched'];
            narrate(`<b>Time slice over.</b> A clock interrupt stops process ${p}. Its registers are saved in PCB ${p}, its state becomes Ready, and PCB ${p} is linked onto the tail of the ready queue: the old tail's <i>next</i> field now points at it.`);
          }
          function block() {
            const p = S.run; S.run = null; S.cpu[p] += 10; S.disk.push(p); S.lit = ['alloc', 'sched'];
            narrate(`<b>Waiting for the disk.</b> Process ${p} asked to read from the disk. The OS records the request, marks PCB ${p} Blocked (event: disk read) and links it onto the disk queue. Only a few <i>next</i> fields changed.`);
          }
          function done() {
            const p = S.disk.shift(); S.ready.push(p); S.lit = ['intr'];
            narrate(`<b>Disk finished.</b> The disk interrupt handler unlinks PCB ${p} from the disk queue, marks it Ready and links it onto the tail of the ready queue.`);
          }
          function monitor() {
            S.lit = ['perf'];
            narrate(`<b>Performance monitor.</b> It walks every PCB and reads its usage record (processor time so far): ${Object.entries(S.cpu).map(([p, t]) => `PCB ${p}: ${t} ms`).join(' · ')}.`);
          }
          function bug() {
            const t = S.ready[0] != null ? S.ready[0] : S.disk[0];
            const q = S.ready[0] != null ? S.ready : S.disk;
            S.lit = ['intr'];
            if (t == null) { narrate('The buggy handler found no queued PCB to damage this time. Put some processes in a queue first.'); return; }
            if (mode === 'handler') {
              S.gate = true;
              narrate(`<b>Stopped at the gate.</b> The same buggy routine asked the PCB handler to set PCB ${t}'s <i>next</i> field to 0xBAD. The handler sees that 0xBAD is no PCB's address, refuses, and records who asked, so the bug is easy to find. The queues are untouched.`);
              return;
            }
            S.bad = t; S.lost = q.slice(1);
            narrate(`<b>Corrupted!</b> A buggy disk interrupt handler wrote garbage (0xBAD) into PCB ${t}'s <i>next</i> field. ` + (S.lost.length ? `The queue now dead-ends at PCB ${t}: ${S.lost.length > 1 ? 'PCBs ' + S.lost.slice(0, -1).join(', ') + ' and ' + S.lost[S.lost.length - 1] : 'PCB ' + S.lost[0]} can never be reached, so ${S.lost.length > 1 ? 'they' : 'it'} will never run again, though nothing is wrong with ${S.lost.length > 1 ? 'them' : 'it'}.` : 'The next routine that walks this queue will follow a garbage pointer and crash.') + ' Which of dozens of routines did it? Nobody can tell.');
          }
          function redesign() {
            S.rewrite = true; S.lit = [];
            narrate(mode === 'direct'
              ? '<b>The PCB format changed</b> (say, one new field). Every routine that reads or writes PCBs directly must now be found, rewritten and re-tested: all four modules turn red.'
              : '<b>The PCB format changed.</b> Only the PCB handler knows the layout, so only it is rewritten. The four modules keep calling the handler exactly as before.');
          }
          const run = (fn) => () => { S.gate = false; S.rewrite = false; fn(); paint(); };
          act('disp', 'Dispatch next', run(dispatch)); act('tout', 'Time slice ends', run(timeout)); act('blk', 'Running process asks for disk', run(block));
          act('done', 'Disk finishes', run(done)); act('perf', 'Monitor reads PCBs', run(monitor));
          act('bug', '⚠ Buggy interrupt handler', run(bug)); act('redo', 'Change the PCB layout', run(redesign));
          B.bug.classList.add('intr');
          const modeSeg = ctx.ui.seg([{ value: 'direct', label: 'Any routine writes PCBs' }, { value: 'handler', label: 'Only the PCB handler' }], mode, (v) => { mode = v; S = INIT(); narrate(v === 'handler' ? '<b>Protected design.</b> Every PCB read or write now goes through one PCB handler whose only job is to guard PCBs. The price: a small detour on every access, and it works only if every other routine can be trusted to use it. Queues reset; try the buggy handler again.' : '<b>Open design.</b> Any OS routine may read and write PCBs directly. Queues were reset.'); paint(); });
          const reset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { S = INIT(); narrate('Reset: process 5 running, PCBs 3 → 7 → 9 in the ready queue, PCB 12 in the disk queue.'); paint(); } }, 'Reset');

          function pcb(x, y, p, w = 84) {
            const lost = S.lost.includes(p), bad = S.bad === p, c = x + w / 2;
            const q = S.ready.includes(p) ? S.ready : S.disk.includes(p) ? S.disk : null;
            const nxt = bad ? '0xBAD' : q ? (q[q.indexOf(p) + 1] != null ? q[q.indexOf(p) + 1] : 'null') : 'null';
            return `<rect x="${x}" y="${y}" width="${w}" height="64" rx="8" class="${lost || bad ? 's-bad' : 's-proc'}" stroke-width="2"/>
              <text x="${c}" y="${y + 19}" text-anchor="middle" font-size="14" font-weight="800">PCB ${p}</text>
              <text x="${c}" y="${y + 37}" text-anchor="middle" font-size="13" class="s-sub">${lost ? 'unreachable' : stateOf(p)}</text>
              <text x="${c}" y="${y + 55}" text-anchor="middle" font-size="13" font-weight="700" class="s-monot" ${bad ? 'style="fill:var(--bad)"' : ''}>next→${nxt === 'null' ? '∅' : nxt}</text>`;
          }
          // phone layout: each queue is a vertical column of PCBs
          function queueCol(xc, label, q) {
            let g = `<text x="${xc + 90}" y="284" text-anchor="middle" font-size="14" font-weight="800">${label}</text>
              <rect x="${xc + 50}" y="292" width="80" height="30" rx="6" class="s-panel" stroke-width="1.5"/><text x="${xc + 90}" y="312" text-anchor="middle" font-size="13" font-weight="700">head</text>`;
            let py = 322;
            q.forEach((p, i) => {
              const y = 342 + i * 84, broken = S.lost.includes(p);
              g += `<path d="M${xc + 90} ${py} L${xc + 90} ${y - 3}" class="${broken ? 's-muted' : 's-line'}" ${broken ? 'stroke-dasharray="4 4"' : ''} marker-end="url(#arr${broken ? '-muted' : ''})"/>` + pcb(xc + 30, y, p, 120);
              py = y + 64;
            });
            if (!q.length) g += `<text x="${xc + 90}" y="350" text-anchor="middle" font-size="13" class="s-sub">empty (head → ∅)</text>`;
            return g;
          }
          function queueRow(y, label, q) {
            let g = `<text x="160" y="${y - 10}" font-size="14" font-weight="800">${label}</text>
              <rect x="160" y="${y + 14}" width="54" height="36" rx="6" class="s-panel" stroke-width="1.5"/><text x="187" y="${y + 37}" text-anchor="middle" font-size="13" font-weight="700">head</text>`;
            let px = 214;
            q.forEach((p, i) => {
              const x = 238 + i * 104;
              const broken = S.lost.includes(p);
              g += `<path d="M${px} ${y + 32} L${x - 3} ${y + 32}" class="${broken ? 's-muted' : 's-line'}" ${broken ? 'stroke-dasharray="4 4"' : ''} marker-end="url(#arr${broken ? '-muted' : ''})"/>` + pcb(x, y, p);
              px = x + 84;
            });
            if (!q.length) g += `<text x="232" y="${y + 37}" font-size="13" class="s-sub">empty (head → ∅)</text>`;
            return g;
          }
          function paintNarrow() {
            const lit = (k) => S.lit.includes(k), red = S.rewrite && mode === 'direct';
            const mods = MODS.map(([k, n], i) => { const x = i % 2 ? 204 : 8, y = i < 2 ? 8 : 52;
              return `<rect x="${x}" y="${y}" width="188" height="36" rx="8" class="${red ? 's-bad' : 's-os'}" stroke-width="${lit(k) || red ? 3 : 1.5}" ${lit(k) ? 'style="stroke:var(--accent)"' : ''}/><text x="${x + 94}" y="${y + 23}" text-anchor="middle" font-size="${red ? 13 : 14}" font-weight="${lit(k) ? 800 : 600}">${n}${red ? ' ✗' : ''}</text>`; }).join('');
            const gate = mode === 'handler'
              ? `<rect x="8" y="98" width="384" height="36" rx="8" class="${S.rewrite ? 's-warn' : S.gate ? 's-ok' : 's-os'}" stroke-width="${S.lit.length || S.rewrite || S.gate ? 3 : 2}"/><text x="200" y="121" text-anchor="middle" font-size="13" font-weight="800">${S.rewrite ? 'PCB handler: rewritten (the only change)' : S.gate ? 'PCB handler: refused ✓ (0xBAD is no PCB)' : 'PCB handler: the only way to touch PCBs'}</text>`
              : `<text x="200" y="121" text-anchor="middle" font-size="13"><tspan font-weight="700" style="fill:var(--bad)">direct access:</tspan> any routine, any PCB field</text>`;
            const n = Math.max(S.ready.length, S.disk.length, 1), H = 342 + n * 84 + 6;
            svgBox.innerHTML = `<svg viewBox="0 0 400 ${H}" width="100%" role="img" aria-label="Ready and disk queues built from linked PCBs">
              ${mods}${gate}
              <rect x="4" y="146" width="392" height="${H - 150}" rx="12" fill="none" style="stroke:var(--line-2)" stroke-dasharray="6 5"/>
              <rect x="16" y="158" width="368" height="84" rx="12" class="s-cpu" stroke-width="2"/><text x="32" y="186" font-size="14" font-weight="800">Processor</text>
              <text x="32" y="206" font-size="13" class="s-sub">running:</text>
              ${S.run != null ? pcb(248, 168, S.run, 120) : '<text x="308" y="206" text-anchor="middle" font-size="13" class="s-sub">idle</text>'}
              <text x="200" y="262" text-anchor="middle" font-size="13" class="s-sub">arrows = the <tspan font-weight="700">next</tspan> field inside each PCB</text>
              ${queueCol(16, 'Ready queue', S.ready)}
              ${queueCol(204, 'Disk queue (Blocked)', S.disk)}
            </svg>`;
          }
          function paint() {
            const lit = (k) => S.lit.includes(k);
            if (ctx.narrow) { paintNarrow(); paintButtons(); return; }
            const mods = MODS.map(([k, n], i) => { const x = 10 + i * 188, red = S.rewrite && mode === 'direct';
              return `<rect x="${x}" y="8" width="176" height="38" rx="8" class="${red ? 's-bad' : 's-os'}" stroke-width="${lit(k) || red ? 3 : 1.5}" ${lit(k) ? 'style="stroke:var(--accent)"' : ''}/><text x="${x + 88}" y="32" text-anchor="middle" font-size="${red ? 13 : 14}" font-weight="${lit(k) ? 800 : 600}">${n}${red ? ' ✗' : ''}</text>`
                + (mode === 'direct' ? `<path d="M${x + 88} 46 L${x + 88} 100" class="${lit(k) ? '' : 's-muted'}" style="${lit(k) ? 'stroke:var(--accent);stroke-width:2.5' : ''}" stroke-dasharray="5 4" marker-end="url(#arr-${lit(k) ? 'accent' : 'muted'})"/>` : `<path d="M${x + 88} 46 L${x + 88} 58" class="s-muted"/>`); }).join('');
            const gate = mode === 'handler'
              ? `<rect x="10" y="60" width="740" height="34" rx="8" class="${S.rewrite ? 's-warn' : S.gate ? 's-ok' : 's-os'}" stroke-width="${S.lit.length || S.rewrite || S.gate ? 3 : 2}"/><text x="380" y="82" text-anchor="middle" font-size="14" font-weight="800">${S.rewrite ? 'PCB handler: rewritten for the new layout (the only change)' : S.gate ? 'PCB handler: request refused ✓ (0xBAD is not a PCB)' : 'PCB handler: the only routine allowed to read or write PCBs'}</text><path d="M380 94 L380 106" class="s-line" marker-end="url(#arr)"/>`
              : `<text x="380" y="72" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--bad)">direct access:</text><text x="380" y="89" text-anchor="middle" font-size="13" class="s-sub">any routine, any PCB field</text>`;
            svgBox.innerHTML = `<svg viewBox="0 0 760 360" width="100%" role="img" aria-label="Ready and disk queues built from linked PCBs">
              ${mods}${gate}
              <rect x="4" y="112" width="752" height="244" rx="12" fill="none" style="stroke:var(--line-2)" stroke-dasharray="6 5"/>
              <rect x="14" y="140" width="128" height="200" rx="12" class="s-cpu" stroke-width="2"/><text x="78" y="162" text-anchor="middle" font-size="14" font-weight="800">Processor</text>
              <text x="78" y="180" text-anchor="middle" font-size="13" class="s-sub">running:</text>
              ${S.run != null ? pcb(36, 196, S.run) : '<text x="78" y="232" text-anchor="middle" font-size="13" class="s-sub">idle</text>'}
              ${queueRow(152, 'Ready queue', S.ready)}
              ${queueRow(270, 'Disk queue (Blocked)', S.disk)}
              <text x="752" y="130" text-anchor="end" font-size="13" class="s-sub">arrows = the <tspan font-weight="700">next</tspan> field stored inside each PCB</text>
            </svg>`;
            paintButtons();
          }
          function paintButtons() {
            const broken = S.bad != null;
            B.disp.disabled = broken || S.run != null || !S.ready.length;
            B.tout.disabled = broken || S.run == null;
            B.blk.disabled = broken || S.run == null;
            B.done.disabled = broken || !S.disk.length;
            B.perf.disabled = broken;
            B.bug.disabled = broken;
            B.redo.disabled = broken;
            ctx.refit();
          }
          narrate('<b>Start here.</b> Process 5 is running. PCBs 3 → 7 → 9 wait in the ready queue and PCB 12 waits for the disk. Use the buttons to move processes, then try to break things.');
          el.append(h('div', { class: 'split s33-qsplit fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0 small', html: 'The PCB is the <b>most important data structure</b> in the OS. Scheduling, resource allocation, interrupt handling and performance monitoring all read or change PCBs. The OS\'s queues are <span class="t">linked lists</span> of PCBs.' }),
              ctx.narrow ? null : say,
              h('div', { class: 'callout warn small m0', 'data-label': 'The protection problem', html: 'If any routine may write PCBs, one bug can wreck them, and a PCB layout change ripples through every module. The fix: one <b>PCB handler</b>, the only routine allowed to touch PCBs. Its cost: a little speed, and trust that every routine uses it.' })),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'row', style: { gap: '6px' } }, B.disp, B.tout, B.blk, B.done, B.perf, h('span', { style: { flex: '1' } }), reset),
              svgBox,
              h('div', { class: 'row', style: { gap: '8px' } }, modeSeg, B.bug, B.redo),
              ctx.narrow ? say : null)));
          paint();
        },
      },
      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: eight things to remember',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. Next, section 3.4 shows how the OS creates and switches processes.'),
            ctx.ui.flipcards([
              ['What four kinds of tables does the OS keep?', 'Memory, I/O, file and process tables. They are cross-referenced: they name processes by ID and point into one another.'],
              ['What does a memory table record?', 'Main and secondary memory given to each process, the protection of each region (shared ones too), and what virtual memory needs.'],
              ['What does an I/O table record?', 'Each device or channel: free or assigned (to whom), the status of the operation in progress, and the memory address of the transfer.'],
              ['What are the four parts of a process image?', 'User program, user data, stack(s) and the process control block (the process\'s attributes).'],
              ['Contiguous or paged image?', 'Contiguous: one unbroken block and one pointer. Paged: pages in any free frames, some on disk, mapped page by page. Either way the PCB stays in main memory so the OS can manage the process.'],
              ['The three groups of PCB information?', 'Process identification, processor state information, and process control information.'],
              ['Why save EFLAGS (the PSW) in the PCB?', 'Its condition codes describe the process\'s own last result. Without the saved copy the process could resume and take the wrong branch.'],
              ['Why guard PCBs with one handler?', 'Nearly every module uses PCBs (queues are linked PCBs). One gate stops a buggy routine from wrecking them and confines layout changes to one place. Cost: a little speed, and trust that every routine uses it.'],
            ], { cols: 4, height: 230 })));
        },
      },
      /* ---------------- 9. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'The OS must decide whether the printer can be given to a process right now. Which table does it consult?',
            choices: ['A memory table', 'An I/O table', 'A file table', 'The process table'], answer: 1,
            feedback: ['Memory tables track main and secondary memory, not devices.', null, 'File tables track files on secondary memory, not the devices themselves.', 'The process table has one entry per process; it does not record who holds each device.'],
            why: 'I/O tables record every device and channel: whether it is free or assigned (and to which process), the status of any operation, and the memory address used for the transfer.' },
          { type: 'match', q: 'Match each OS table to something it records.',
            pairs: [['Memory table', 'Protection of a shared memory region'], ['I/O table', 'Memory address a disk transfer writes into'], ['File table', 'Where a file is stored on disk'], ['Process table', 'One entry per process, leading to its image']],
            why: 'Memory tables hold allocation and protection; I/O tables hold device status and transfer addresses; file tables hold existence, location, status and attributes of files; the process table is the list of processes.' },
          { type: 'multi', q: 'Which of these are parts of a process image?',
            choices: ['The user program', 'The user data', 'The stack', 'The process control block', 'The file table', 'The ready queue'], answer: [0, 1, 2, 3],
            why: 'A process image is the user program, user data, stack(s) and PCB. The file table and the ready queue are OS-wide structures, not part of any one process image.' },
          { type: 'bucket', q: 'Sort each PCB field into its group of attributes.',
            buckets: ['Identification', 'Processor state', 'Process control'],
            items: [['ID of the parent process', 0], ['Program counter', 1], ['Condition codes', 1], ['Priority', 2], ['List of open files', 2]],
            why: 'Identifiers name the process; register contents (including the PSW bits) are processor state; everything the OS uses to schedule, link, protect and account for the process is process control information.' },
          { type: 'tf', q: 'With paging, every page of a process image must stay in main memory for as long as the process exists.', answer: false,
            why: 'Pages can be spread over any free frames, and pages not needed right now can wait on disk. The memory tables record where each one is.' },
          { q: 'Process 7 is interrupted just after a compare instruction and before its "jump if equal". Where are its condition codes while other processes run?',
            choices: ['In its PCB, as part of the processor state information', 'In its user data, next to its variables', 'In the I/O table entry for the interrupting device', 'Nowhere: the flags are recomputed when process 7 resumes'], answer: 0,
            feedback: [null, 'User data is the program\'s own modifiable memory; the OS saves registers in the PCB instead.', 'The I/O table describes devices, not a process\'s registers.', 'The compare has already run; nothing would recompute the flags, so the jump would use another process\'s result.'],
            why: 'The PSW (EFLAGS on x86) is saved in the PCB when a process stops and restored before it runs again, so its pending jump sees its own result.' },
          { type: 'num', q: 'An 8-bit register computes 200 + 100. What value does the 8-bit result register hold (as an unsigned number)?', answer: 44, tol: 0,
            why: 'The true sum 300 needs 9 bits. Only the low 8 bits fit: 300 − 256 = 44, and the lost carry is recorded in the carry flag (CF = 1).' },
          { type: 'multi', q: 'An 8-bit ADD computes 100 + 50. Which of the flags CF, ZF, SF and OF are set afterwards?',
            choices: ['CF (carry)', 'ZF (zero)', 'SF (sign)', 'OF (overflow)'], answer: [2, 3],
            why: '150 fits in 8 unsigned bits, so CF = 0, and it is not 0, so ZF = 0. But 150 is 1001 0110: the top bit is 1 (SF = 1), and as signed numbers 100 + 50 exceeds 127, so OF = 1.' },
          { type: 'order', q: 'Put in order the lookups the OS follows to find where process 8\'s stack page is right now.',
            items: ['Use process ID 8 to find its entry in the process table', 'Follow that entry\'s pointer to the process image and its PCB', 'Read the memory-management pointer in the PCB (its page table)', 'Look up the stack page to find its frame, or its place on disk'],
            why: 'The process table leads to the image and PCB; the PCB\'s memory-management information points to the page table; the page table says where each page is. This chain is the cross-referencing between tables in action.' },
          { type: 'tf', q: 'Moving a process from the ready queue to a blocked queue normally means copying its whole PCB into the other queue.', answer: false,
            why: 'Queues are linked lists of PCBs. The OS only changes a few pointer fields; the PCB itself stays where it is.' },
          { q: 'Why do many operating systems make every routine go through a single handler to read or write PCBs?',
            choices: ['It makes each PCB access faster', 'A buggy routine cannot damage PCBs unchecked, and a change to the PCB layout only affects the handler', 'PCBs are stored on disk and need a special reader', 'It lets user programs edit their own PCBs safely'], answer: 1,
            feedback: ['It is actually a little slower: every access takes a detour through the handler.', null, 'PCBs are kept in main memory so the OS can reach them quickly.', 'User programs never edit PCBs; the handler is for OS routines.'],
            why: 'Nearly every OS module uses PCBs. A single guard routine catches bad requests in one place and hides the PCB layout. The trade-off: a small detour on each access, and it only helps if every other routine can be trusted to go through it.' },
          { q: 'An OS keeps a running total of the processor time each process has used, for scheduling and accounting. Where in the PCB does it belong?',
            choices: ['Process identification', 'Processor state information, since it is about the processor', 'Process control information (resource ownership and utilization)', 'Inside the saved program status word, next to the condition codes'], answer: 2,
            feedback: ['Identification holds only identifiers: of the process, of its parent and of its user.', 'Processor state is a copy of the register contents saved at an interrupt. A usage total is not a register; it is a record the OS keeps about the process.', null, 'The PSW holds condition codes and control bits such as interrupt enable and execution mode, not usage totals.'],
            why: 'Resource ownership and utilization is part of process control information: it lists resources the process controls (such as open files) and a history of its use of the processor and other resources, which the scheduler and accounting rely on.' },
        ],
      },
    ],
    notes: `
      <h3>The OS as the manager of resources</h3>
      <p>Many processes (P1 … Pn) compete for a few processors, a fixed amount of main memory and some I/O devices. The OS hands these out and takes them back, so it must always know <b>where each process is, what it holds and what it is waiting for</b>. Example: P1 runs and owns the keyboard; P2 is blocked while the disk reads for it; P3 is swapped out (only its PCB stays in main memory); P4 is ready, holds the printer and waits for the processor.</p>

      <h3>OS control structures: four families of tables</h3>
      <table>
        <tr><th>Table</th><th>What it records</th></tr>
        <tr><td><b>Memory tables</b></td><td>Main memory allocated to each process; secondary memory (disk) allocated to each process; protection attributes of regions, e.g. who may read or write a shared region; information needed to manage virtual memory.</td></tr>
        <tr><td><b>I/O tables</b></td><td>Each I/O device and channel (a small processor dedicated to I/O): available or assigned (to which process); status of the operation in progress; the main-memory location used as source or destination of the transfer.</td></tr>
        <tr><td><b>File tables</b></td><td>Which files exist; their location on secondary memory; current status (e.g. open for writing by process 3); attributes (owner, permissions, size). May be kept by a separate file management system.</td></tr>
        <tr><td><b>Process tables</b></td><td>One entry per process; each entry points to that process's image (and so its PCB).</td></tr>
      </table>
      <p><b>The tables are cross-referenced.</b> Memory, I/O and file tables name processes by ID, and I/O entries point into memory that the memory tables allocate. Example with 4 KB <b>frames</b> (fixed-size slots of main memory; frame 4 = 0x4000–0x4FFF in hexadecimal): "Disk 0 reads for process 2 into 0x4200" matches a memory row "frame 4 belongs to process 2" and a file row "song.mp3 open for reading by process 2". When a process ends, every table that mentions it must be updated. The tables themselves live in main memory, so memory management covers them too.</p>
      <p><b>Configuration comes first.</b> Before building tables, the OS must learn its environment (how much main memory, which I/O devices) from firmware, hardware probing or an administrator's settings.</p>

      <h3>The process image</h3>
      <ul>
        <li><b>User program</b>: the instructions to be executed.</li>
        <li><b>User data</b>: the modifiable part of user space: program data, a user stack area, and programs that may be modified.</li>
        <li><b>Stack</b>: one or more last-in, first-out system stacks holding parameters and return addresses of procedure and system calls.</li>
        <li><b>Process control block (PCB)</b>: the attributes the OS needs to control the process.</li>
      </ul>
      <svg viewBox="0 0 520 52" width="100%" role="img" aria-label="Process image = PCB + user program + user data + stack"><rect x="4" y="6" width="120" height="40" rx="6" fill="#e8e7fd" stroke="#4f46e5"/><text x="64" y="31" text-anchor="middle" font-size="13">PCB</text><rect x="128" y="6" width="130" height="40" rx="6" fill="#e1eaff" stroke="#2563eb"/><text x="193" y="31" text-anchor="middle" font-size="13">User program</text><rect x="262" y="6" width="130" height="40" rx="6" fill="#d7f5e8" stroke="#059669"/><text x="327" y="31" text-anchor="middle" font-size="13">User data</text><rect x="396" y="6" width="120" height="40" rx="6" fill="#fff0d1" stroke="#b45309"/><text x="456" y="31" text-anchor="middle" font-size="13">Stack</text></svg>
      <p><b>Location.</b> The image may be one <b>contiguous</b> block (one pointer to its start, but it needs one big enough gap and must be wholly loaded to run) or, with <b>paging</b>, cut into equal pages placed in any free frames, with pages not needed now left on disk. The OS can manage a process only if at least a small part of its image (the PCB) is in main memory, and the parts in use must be there for it to run. So the OS must know where every part of every image is: the process table points to each image, and the page tables map every page.</p>

      <h3>What a PCB holds: three groups</h3>
      <h4>1. Process identification</h4>
      <p>Identifiers of this process (often its index into the process table), of its parent (creator), and of the user. Two runs of one program = two processes, two IDs.</p>
      <h4>2. Processor state information</h4>
      <p>The register contents: in the processor while the process runs, saved in the PCB when it is interrupted, restored when it resumes. <b>User-visible registers</b> (often 8 to 32); <b>control and status registers</b>: the program counter, the <b>condition codes</b> (sign, zero, carry, equal, overflow) and status information (interrupts enabled/disabled, execution mode); and <b>stack pointers</b>. Condition codes and status bits usually share one register, the <b>program status word (PSW)</b>; on x86 it is the 32-bit <b>EFLAGS</b> register.</p>
      <h4>3. Process control information</h4>
      <ul>
        <li><b>Scheduling and state</b>: state, priority, scheduling data (e.g. time waiting), the event awaited.</li>
        <li><b>Data structuring</b>: pointers to other PCBs (queues, parent–child links).</li>
        <li><b>Interprocess communication</b>: flags, signals, messages.</li>
        <li><b>Process privileges</b>: memory it may access, instruction types it may execute, system services it may use.</li>
        <li><b>Memory management</b>: pointers to its segment and/or page tables.</li>
        <li><b>Resource ownership and utilization</b>: resources such as open files, and processor-use history. (Processor time used is control information, not processor state.)</li>
      </ul>

      <h3>The PSW in action: x86 EFLAGS</h3>
      <p>Key bits: CF carry (0), PF parity (2), AF auxiliary carry (4), ZF zero (6), SF sign (7), TF trap (8), IF interrupt enable (9), DF direction (10), OF overflow (11), IOPL I/O privilege level (12–13), NT nested task (14); bits 16–21 are more control bits, the rest reserved.</p>
      <p><b>Negative numbers on x86: two's complement.</b> The teaching machine in 1.3 used sign-magnitude (8005 hex = −5), but x86 stores negative numbers in <b>two's complement</b>. For 8 bits: if the top bit is 0 the value reads the same signed or unsigned (0 to 127); if the top bit is 1, the signed value is the unsigned value minus 256 (200 → −56, 255 → −1, 128 → −128). The same bit pattern can therefore be read two ways, which is why there are two "did not fit" flags: <b>CF</b> means the <i>unsigned</i> result did not fit in 0…255, and <b>OF</b> means the <i>signed</i> result did not fit in −128…127. The lab concentrates on CF, ZF, SF, OF (and IF); the other bits (NT, IOPL, DF, TF, AF, PF) have jobs this section does not need.</p>
      <p><b>Worked example (8 bits).</b> 200 + 100 = 300 needs 9 bits, so the register keeps 300 − 256 = <b>44</b> and <b>CF = 1</b>; ZF = 0, SF = 0, and as signed values −56 + 100 = 44 fits, so OF = 0. For 100 + 50 = 150 (1001 0110): CF = 0 and ZF = 0, but SF = 1 and <b>OF = 1</b>: two positives gave a signed sum above 127 (the register reads −106). After SUB, ZF = 1 means the values were <b>equal</b>; 3 − 5 needs a borrow (CF = 1) and leaves 254 (−2 signed, SF = 1).</p>
      <p>The flags describe the running process's own last result, so the OS saves EFLAGS in the PCB when stopping a process; otherwise a pending "jump if equal" could take the wrong branch.</p>

      <h3>The role of the PCB</h3>
      <p>The PCB is the <b>most important OS data structure</b>: virtually every module reads or modifies it (scheduling, resource allocation, interrupt processing, performance monitoring). The ready queue and blocked queues are <b>linked lists of PCBs</b>; moving a process between queues changes a few pointers, never copies the PCB.</p>
      <p><b>Protection problem:</b> (1) a bug in one routine, such as an interrupt handler, can damage PCBs, e.g. a garbage <i>next</i> pointer makes every later PCB in the queue unreachable; (2) a change to the PCB's structure affects every module that uses it. <b>Solution:</b> all routines go through a single <b>handler routine whose only job is to protect PCBs</b>, the sole arbiter of reads and writes. It checks requests, and a layout change means rewriting only the handler. <b>Trade-off:</b> a small performance cost on every access, and it helps only as far as the rest of the OS can be trusted to use it.</p>`,
  });
})();
