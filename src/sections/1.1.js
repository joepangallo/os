/* =====================================================================
   Section 1.1 — Basic Elements
   The four structural elements of a computer (processor, main memory,
   I/O modules, system bus), the registers the processor uses to exchange
   data with memory and I/O, memory as numbered cells, buffers, volatility.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- small shared helpers ---------- */
  const bits = (n, w) => (n >>> 0).toString(2).padStart(w, '0').slice(-w);
  const nib = (s) => s.replace(/(.{4})(?=.)/g, '$1 ');
  const hex4 = (n) => (n >>> 0).toString(16).toUpperCase().padStart(4, '0').slice(-4);

  /* ---------- "follow the data" scenarios for step 5 ----------
     Each delta changes the machine state; registers, memory, buffers and the printer
     persist from frame to frame, while bus traffic (L), highlights and captions do not.
     L = { a: [text, dir], d: [...], c: [...] }  dir 'r' = away from the processor, 'l' = towards it. */
  const MEM0 = [12, 40, 7, 15, 3, 0, 77, 0];
  const FLOWS = {
    read: { x: 504, steps: [
      { cap: '<b>Goal:</b> the processor needs the number stored in memory cell 6. It cannot reach into memory itself; it has to ask over the system bus.' },
      { reg: { mar: 6 }, chg: ['mar'], cap: '<b>Address into the MAR.</b> The processor puts the cell number, 6, into the memory address register. The MAR only ever holds a <i>where</i>.' },
      { L: { a: ['6', 'r'], c: ['READ', 'r'] }, cell: 6, cap: '<b>Request on the bus.</b> The 6 goes out on the address lines and the control lines say READ. Memory recognises the request and finds cell 6.' },
      { L: { d: ['77', 'l'] }, cell: 6, cap: '<b>Memory answers.</b> Memory copies the contents of cell 6, the value 77, onto the data lines. Reading erases nothing: cell 6 still holds 77.' },
      { reg: { mbr: 77 }, chg: ['mbr'], exec: 'has 77 to use', cap: '<b>Data in the MBR.</b> The value lands in the memory buffer register. Now the execution unit can work with it, for example by adding it to another number.' },
    ] },
    write: { x: 504, steps: [
      { cap: '<b>Goal:</b> store the value 42 in memory cell 3, which currently holds 15.' },
      { reg: { mar: 3, mbr: 42 }, chg: ['mar', 'mbr'], cap: '<b>Load both registers.</b> For a write, the processor fills the MAR with the <i>where</i> (3) and the MBR with the <i>what</i> (42) before anything moves.' },
      { L: { a: ['3', 'r'], d: ['42', 'r'], c: ['WRITE', 'r'] }, cell: 3, cap: '<b>Everything goes out together.</b> Address 3 on the address lines, 42 on the data lines and WRITE on the control lines.' },
      { mem: { 3: 42 }, cell: 3, chgCell: 3, cap: '<b>Memory stores it.</b> Cell 3 now holds 42. Its old value, 15, is overwritten and gone for good: each cell keeps only the latest value written to it.' },
    ] },
    out: { x: 556, steps: [
      { cap: '<b>Goal:</b> print the letter H. The printer is I/O device 2, looked after by I/O module 2.' },
      { reg: { ioar: 2, iobr: 'H' }, chg: ['ioar', 'iobr'], cap: '<b>Load the I/O pair.</b> The processor puts the device number, 2, in the I/O AR (I/O address register) and the letter H in the I/O BR (I/O buffer register). A device number is a <i>where</i>, just like a memory address.' },
      { L: { a: ['dev 2', 'r'], d: ['H', 'r'], c: ['I/O WRITE', 'r'] }, mod: 2, cap: '<b>Out over the bus.</b> The control lines say I/O WRITE, so memory ignores it. Every I/O module sees the device number, but only module 2 recognises its own and takes the letter.' },
      { buf2: ['H'], mod: 2, cap: '<b>Into the buffer.</b> Module 2 holds H in its internal buffer. As far as the processor is concerned, the transfer is finished, and it can move straight on.' },
      { buf2: [], printed: 'H', dev: 2, cap: '<b>At the device’s own pace.</b> The module feeds H from its buffer to the printer, which is millions of times slower than the processor. The buffer is what lets the two work at different speeds.' },
    ] },
    in: { x: 396, steps: [
      { buf1: ['q'], cap: '<b>Goal:</b> someone pressed the q key, and keyboard module 1 already holds it in a buffer. Bring it into memory cell 7 so a program can use it.' },
      { reg: { ioar: 1 }, chg: ['ioar'], L: { a: ['dev 1', 'r'], c: ['I/O READ', 'r'] }, mod: 1, cap: '<b>Ask device 1.</b> The processor puts 1 in the I/O AR (I/O address register). It goes out on the address lines while the control lines say I/O READ.' },
      { buf1: [], L: { d: ['q', 'l'] }, mod: 1, cap: '<b>The module answers.</b> Module 1 takes q out of its buffer and places it on the data lines.' },
      { reg: { iobr: 'q' }, chg: ['iobr'], cap: '<b>Into the I/O BR.</b> The key arrives in the I/O buffer register. It is inside the processor now, but registers are few and constantly reused, so it must be stored in memory.' },
      { reg: { mar: 7, mbr: 'q' }, chg: ['mar', 'mbr'], x: 504, cap: '<b>Switch to the memory pair.</b> The processor copies q into the MBR and puts the target address, 7, in the MAR.' },
      { L: { a: ['7', 'r'], d: ['q', 'r'], c: ['WRITE', 'r'] }, cell: 7, x: 504, cap: '<b>Write to memory.</b> Address 7, data q and a WRITE signal travel over the same shared bus.' },
      { mem: { 7: 'q' }, cell: 7, chgCell: 7, cap: '<b>Done.</b> The key press travelled device → I/O module → processor → main memory. (Section 1.7 shows DMA, a shortcut that spares the processor from carrying every item.)' },
    ] },
  };
  function flowFrames(name) {
    let st = { reg: { mar: null, mbr: null, ioar: null, iobr: null }, mem: MEM0.slice(), buf1: [], buf2: [], printed: '' };
    return FLOWS[name].steps.map((d) => {
      st = { reg: Object.assign({}, st.reg, d.reg || {}), mem: st.mem.slice(), buf1: d.buf1 || st.buf1, buf2: d.buf2 || st.buf2, printed: d.printed != null ? d.printed : st.printed };
      Object.entries(d.mem || {}).forEach(([a, v]) => { st.mem[a] = v; });
      return Object.assign({}, st, { L: d.L || {}, chg: d.chg || [], cell: d.cell ?? -1, chgCell: d.chgCell ?? -1, mod: d.mod || 0, dev: d.dev || 0, exec: d.exec || 'idle', x: d.x || FLOWS[name].x, cap: d.cap });
    });
  }

  Guide.section({
    id: '1.1',
    title: 'Basic Elements',
    short: 'Basic elements',
    summary: 'Processor, main memory, I/O modules and the system bus: the four parts that team up to run a program.',
    objectives: [
      'Name the four main structural elements of a computer and describe the job of each one.',
      'Explain what the MAR, MBR, I/O AR and I/O BR hold, and which pair the processor uses for memory and which for I/O.',
      'Describe main memory as cells numbered 0 to n − 1 whose bit patterns can be read as instructions or as data.',
      'Trace how a value travels over the system bus during a memory read, a memory write and an I/O transfer.',
      'Explain why main memory is volatile and why every I/O module needs internal buffers.',
    ],
    terms: [
      ['Processor (CPU)', 'The part of the computer that controls everything the machine does and performs its data processing. When a computer has just one processor, it is usually called the central processing unit, or CPU.'],
      ['Main memory', 'The memory that holds the programs being run and the data they use, organised as a long row of numbered cells. It is usually volatile. Also called real memory or primary memory.'],
      ['Volatile memory', 'Memory that loses its contents when the power is switched off. Main memory is volatile; a disk is not.'],
      ['I/O module', 'The hardware unit that moves data between the computer and its external environment (disks, network equipment, keyboards, screens), holding data in internal buffers on the way.'],
      ['System bus', 'The shared set of wires that lets the processor, main memory and I/O modules communicate. It carries addresses (where), data (what) and control signals (read or write, and when).'],
      ['Register', 'A very small, very fast storage slot inside the processor that holds one value the processor is working with right now.'],
      ['Memory address register (MAR)', 'The processor register that holds the address of the memory cell to be read or written next.'],
      ['Memory buffer register (MBR)', 'The processor register that holds the data about to be written into memory, or the data just read out of memory.'],
      ['I/O address register (I/O AR)', 'The processor register that names the particular I/O device the processor wants to exchange data with.'],
      ['I/O buffer register (I/O BR)', 'The processor register that holds the data travelling between the processor and an I/O module, in either direction.'],
      ['Program counter (PC)', 'The processor register that holds the memory address of the next instruction to fetch.'],
      ['Instruction register (IR)', 'The processor register that holds the instruction currently being carried out.'],
      ['Execution unit', 'The circuitry inside the processor that carries out the work of instructions, such as adding, comparing or moving values. A modern processor core contains several.'],
      ['Address', 'The number that identifies one memory cell (or, for I/O, one device). In a memory with n cells the addresses run from 0 to n − 1.'],
      ['Buffer', 'A small holding area where data waits for a short time while it travels between two parts that work at different speeds or at different moments.'],
      ['Secondary memory', 'Large, permanent storage such as a disk or solid-state drive. It keeps its data without power but is much slower than main memory, and the processor reaches it through an I/O module.'],
      ['Bit', 'A binary digit: a single 0 or 1. Everything in memory, instructions and data alike, is stored as patterns of bits.'],
      ['Instruction', 'One basic command for the processor, such as “add these two numbers”, stored in memory as a pattern of bits.'],
      ['Data', 'The values a program works on (numbers, letters, pixels and so on), stored in memory as bit patterns just like instructions.'],
    ],
    css: `
      .sec-1-1 .hot { cursor: pointer; outline: none; }
      .sec-1-1 .hot .fr { transition: stroke-width .15s; }
      .sec-1-1 .hot:hover .fr, .sec-1-1 .hot:focus-visible .fr { stroke-width: 3.5; }
      .sec-1-1 .hot.sel .fr { stroke-width: 4; }
      .sec-1-1 .hot.rel .fr { stroke-width: 3.5; stroke-dasharray: 7 4; }
      .sec-1-1 .s1-cap { min-height: 5.9em; }
      .sec-1-1 .s1-panel { justify-content: center; }
      .sec-1-1 .s2-info ul { padding-left: 20px; }
      .sec-1-1 .s3-grid { display: grid; grid-template-columns: 64px minmax(0, 1fr) minmax(0, 1fr); gap: 8px; align-items: stretch; }
      .sec-1-1 .s3-grid .hd { font-size: 12.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); align-self: end; text-align: center; }
      .sec-1-1 .s3-grid .side { font-weight: 800; font-size: 14.5px; align-self: center; }
      .sec-1-1 .s3-grid .box { padding: 6px 8px; line-height: 1.3; }
      .sec-1-1 .s3-grid .box .xs { font-size: 13.5px; line-height: 1.25; }
      .sec-1-1 .s3-task { font-size: 17.5px; line-height: 1.45; min-height: 2.9em; }
      .sec-1-1 .s3-slots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .sec-1-1 .s3-slot { display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: left; padding: 8px 14px; border-radius: 12px; border: 2px dashed var(--cpu); background: var(--cpu-bg); cursor: pointer; color: var(--ink); min-height: 62px; transition: border-color .15s, background .15s; }
      .sec-1-1 .s3-slot:hover { border-style: solid; }
      .sec-1-1 .s3-slot .nm { font-size: 17px; color: var(--cpu); }
      .sec-1-1 .s3-slot .val { font-size: 24px; font-weight: 800; }
      .sec-1-1 .s3-slot.full { border-style: solid; border-color: var(--ok); background: var(--ok-bg); }
      .sec-1-1 .s3-slot.nope { border-style: solid; border-color: var(--bad); background: var(--bad-bg); }
      .sec-1-1 .s3-tray { min-height: 58px; }
      .sec-1-1 .s3-parcel { display: inline-flex; flex-direction: column; align-items: center; gap: 0; padding: 4px 14px; border-radius: 12px; border: 2px solid var(--line-2); background: var(--panel-2); cursor: pointer; color: var(--ink); line-height: 1.3; }
      .sec-1-1 .s3-parcel b { font-size: 20px; }
      .sec-1-1 .s3-parcel:hover { border-color: var(--accent); }
      .sec-1-1 .s3-parcel.on { border-color: var(--accent); background: var(--accent-bg); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); }
      .sec-1-1 .s3-fb { min-height: 4.4em; }
      .sec-1-1 .s3-fb.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-1-1 .s3-fb.good { border-color: var(--ok); background: var(--ok-bg); }
      .sec-1-1 .s3-dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--line-2); }
      .sec-1-1 .s3-dot.on { border-color: var(--accent); background: var(--accent); }
      .sec-1-1 .s3-dot.done { border-color: var(--ok); background: var(--ok); }
      .sec-1-1 .s4-read { font-size: 15.5px; line-height: 1.45; }
      .sec-1-1 .s4-grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 5px; }
      .sec-1-1 .s4-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; height: 46px; padding: 0 2px; border-radius: 8px; border: 1.5px solid var(--line-2); background: var(--panel-2); cursor: pointer; color: var(--ink); line-height: 1.2; }
      .sec-1-1 .s4-grid.roomy .s4-cell { height: 64px; }
      .sec-1-1 .s4-grid:not(.roomy):not(.dense) .s4-cell { height: 52px; }
      .sec-1-1 .s4-grid.dense { gap: 4px; }
      .sec-1-1 .s4-grid.dense .s4-cell { flex-direction: row; gap: 5px; height: 24px; }
      .sec-1-1 .s4-cell .ad { font-size: 12.5px; color: var(--muted); font-weight: 700; }
      .sec-1-1 .s4-cell .ct { font-size: 13.5px; font-weight: 700; }
      .sec-1-1 .s4-cell.r-i { background: var(--cpu-bg); border-color: color-mix(in srgb, var(--cpu) 45%, transparent); }
      .sec-1-1 .s4-cell.r-d { background: var(--mem-bg); border-color: color-mix(in srgb, var(--mem) 45%, transparent); }
      .sec-1-1 .s4-cell.last { border-style: dashed; border-color: var(--accent); }
      .sec-1-1 .s4-cell:hover { border-color: var(--accent); }
      .sec-1-1 .s4-cell.on { border: 2.5px solid var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); }
      .sec-1-1 .s4-detail { display: flex; flex-direction: column; gap: 6px; margin-top: auto; }
      .sec-1-1 .s4-reads { display: grid; grid-template-columns: 1fr 1fr 1.6fr; gap: 8px; }
      .sec-1-1 .s4-reads > div { display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--line); border-radius: 9px; padding: 4px 9px; min-width: 0; }
      .sec-1-1 .s5 .player-cap { min-height: 4.1em; }
      .sec-1-1 .s6-formula { font-size: 15.5px; line-height: 1.45; border-left: 5px solid var(--io); }
      .sec-1-1 .s6-flow { display: grid; grid-template-columns: minmax(0, 1fr) 22px minmax(0, 1.25fr) 22px minmax(0, 1fr); align-items: stretch; }
      .sec-1-1 .s6-arr { display: grid; place-items: center; font-size: 22px; font-weight: 800; color: var(--muted); }
      .sec-1-1 .s6-box { border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; min-height: 150px; }
      .sec-1-1 .s6-box h4 { margin: 0 !important; }
      .sec-1-1 .s6-box.dev { border: 2px dashed var(--io); background: var(--panel-2); }
      .sec-1-1 .s6-box.io { border: 2px solid var(--io); background: var(--io-bg); }
      .sec-1-1 .s6-box.cpu { border: 2px solid var(--cpu); background: var(--cpu-bg); justify-content: flex-start; }
      .sec-1-1 .s6-box.cpu .meter { width: 100%; }
      .sec-1-1 .s6-box.cpu .meter > i { background: var(--cpu); }
      .sec-1-1 .s6-key { width: 52px; height: 52px; border-radius: 10px; border: 2px solid var(--line-2); border-bottom-width: 5px; background: var(--panel); display: grid; place-items: center; font-size: 26px; font-weight: 800; }
      .sec-1-1 .s6-key.lost { border-color: var(--bad); color: var(--bad); background: var(--bad-bg); }
      .sec-1-1 .s6-slots { display: grid; grid-template-columns: repeat(4, 34px); gap: 5px; justify-content: center; min-height: 34px; }
      .sec-1-1 .s6-slots.one { grid-template-columns: 34px; }
      .sec-1-1 .s6-slots > span { height: 34px; border-radius: 7px; border: 1.5px solid var(--line-2); background: var(--panel); display: grid; place-items: center; font-family: var(--mono); font-weight: 800; font-size: 17px; }
      .sec-1-1 .s6-slots > span.full { background: var(--hl); border-color: var(--warn); }
      .sec-1-1 .s6-line { font-size: 16px; letter-spacing: .06em; white-space: nowrap; overflow: hidden; line-height: 1.5; }
      .sec-1-1 .s6-line .lbl { display: inline-block; width: 92px; font-family: var(--font); font-size: 12.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
      .sec-1-1 .s6-line .c-ok { color: var(--ok); font-weight: 700; }
      .sec-1-1 .s6-line .c-buf { color: var(--warn); font-weight: 700; }
      .sec-1-1 .s6-line .c-lost { color: var(--bad); text-decoration: line-through; font-weight: 700; background: var(--bad-bg); }
      .sec-1-1 .s6-cap { min-height: 4.6em; }
      .sec-1-1 .s6-ctl .seg { align-self: flex-start; }
      .sec-1-1 .s7-flow { display: grid; grid-template-columns: minmax(0, 1.25fr) 64px minmax(0, 1fr); gap: 8px; align-items: stretch; }
      .sec-1-1 .s7-cells { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
      .sec-1-1 .s7-cell { height: 58px; border-radius: 9px; border: 1.5px solid var(--line-2); background: var(--panel); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.25; transition: background .25s; }
      .sec-1-1 .s7-cell b { font-size: 16px; }
      .sec-1-1 .s7-cell.os { background: var(--os-bg); border-color: var(--os); }
      .sec-1-1 .s7-cell.prog { background: var(--proc-bg); border-color: var(--proc); }
      .sec-1-1 .s7-cell.word { background: var(--mem-bg); border-color: var(--mem); }
      .sec-1-1 .s7-cell.unsaved { border-style: dashed; border-width: 2px; border-color: var(--warn); }
      .sec-1-1 .s7-cell.dead { background: var(--panel-3); border-style: dotted; color: var(--muted); }
      .sec-1-1 .s7-io { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border: 2px solid var(--io); border-radius: 12px; background: var(--io-bg); color: var(--io); }
      .sec-1-1 .s7-arrows { font-size: 24px; font-weight: 800; }
      .sec-1-1 .s7-file { display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 3px 9px; line-height: 1.3; }
      .sec-1-1 .s7-cap { min-height: 4.6em; }
      .sec-1-1 .nar .s4-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .sec-1-1 .nar .s4-grid .s4-cell { height: 46px; flex-direction: column; gap: 0; }
      .sec-1-1 .nar .s4-reads { grid-template-columns: 1fr; }
      .sec-1-1 .nar .s6-flow { grid-template-columns: 1fr; gap: 2px; }
      .sec-1-1 .nar .s6-arr { font-size: 20px; line-height: 1.2; }
      .sec-1-1 .nar .s6-box { min-height: 0; }
      .sec-1-1 .nar .s7-flow { grid-template-columns: 1fr; }
      .sec-1-1 .nar .s7-io { flex-direction: row; gap: 8px; padding: 4px; }
      .sec-1-1 .nar .s7-arrows { transform: rotate(90deg); }
      .sec-1-1 .s8-pt { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 10px; align-items: start; padding: 7px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel-2); font-size: 15.5px; line-height: 1.42; }
      .sec-1-1 .s8-pt > i { font-style: normal; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; background: var(--chc); color: var(--panel); font-weight: 800; font-size: 14px; }
      .sec-1-1 .s8-cols { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 10px; }
      .sec-1-1 .s8-it { text-align: left; min-height: 46px; padding: 5px 11px; border-radius: 10px; border: 2px solid var(--line); background: var(--panel); cursor: pointer; font-size: 14.5px; line-height: 1.3; color: var(--ink); }
      .sec-1-1 .s8-it.l { font-weight: 750; }
      .sec-1-1 .s8-it:hover:not(:disabled) { border-color: var(--accent); }
      .sec-1-1 .s8-it.on { border-color: var(--accent); background: var(--accent-bg); }
      .sec-1-1 .s8-it.ok { border-color: var(--ok); background: var(--ok-bg); color: var(--ink); cursor: default; }
      .sec-1-1 .s8-fb { min-height: 4.4em; margin-top: auto; }
      .sec-1-1 .s8-fb.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-1-1 .s8-fb.good { border-color: var(--ok); background: var(--ok-bg); }
    `,
    steps: [
      /* ---------------- 1. Big picture: four parts, one team ---------------- */
      {
        title: 'A computer is a team of four parts',
        kind: 'story',
        html: `
          <div class="split fill">
            <div class="stack">
              <p class="lead m0">A program is just a list of <span class="t">instructions</span> stored as numbers. To run it, a computer needs parts that hold it, act on it, carry it around and connect it to the outside world.</p>
              <p class="m0">Every computer, from a phone to a data-centre server, is built from processor, memory and I/O components, connected so that together they can <b>execute</b> (run) <b>programs</b>. Look inside and you always find four main structural elements: the <span class="t">processor</span>, <span class="t">main memory</span>, the <span class="t">I/O modules</span> and the <span class="t">system bus</span>.</p>
              <div class="callout analogy m0" data-label="Analogy">A restaurant kitchen is organised the same way: a chef does the cooking, a counter holds what is in use, a pass window links to the outside, and one shared aisle carries every trip.</div>
              <div class="callout why m0" data-label="Why it matters">An operating system spends its whole life managing these four parts. To understand the manager, first meet what it manages.</div>
              <p class="small muted m0">By the end of this section you will be able to name each part, say which registers carry its traffic, and trace a value as it travels from memory or a device into the processor.</p>
            </div>
            <div class="card white stack s1-panel"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const panel = el.querySelector('.s1-panel');
          const V = {
            computer: {
              p: ['Processor (CPU)', 'controls the whole machine', 'and does the data processing'],
              m: ['Main memory', 'holds the running programs', 'and their data (volatile)'],
              b: 'System bus: the shared connection between every part',
              i: ['I/O modules', 'move data to and from', 'the outside world'],
              o: ['External environment', ['Disk', 'Network', 'Terminal']],
              cap: {
                p: 'The <b>processor</b> runs the programs: it fetches each instruction and carries it out. That is how it controls the operation of the whole computer and performs its data processing. When a machine has only one processor, it is usually called the <b>CPU</b> (central processing unit).',
                m: '<b>Main memory</b> stores the programs being run and the data they use. It is usually <b>volatile</b>: switch off the power and it forgets everything. You will also hear it called <b>real memory</b> or <b>primary memory</b>.',
                b: 'The <b>system bus</b> provides communication among the processors, main memory and I/O modules. Every instruction, number and key press that moves between them travels over it.',
                i: '<b>I/O modules</b> move data between the computer and its external environment, in both directions. Each kind of device is looked after by an I/O module.',
                o: 'The <b>external environment</b> is everything outside: secondary memory devices such as disks, communications equipment such as a network card, and terminals (a keyboard and screen).',
              },
            },
            kitchen: {
              p: ['The chef', 'reads each recipe step', 'and does all the cooking'],
              m: ['The counter', 'holds today’s recipes and', 'ingredients; wiped nightly'],
              b: 'The one shared aisle that every single trip must use',
              i: ['The pass window', 'where orders come in', 'and plates go out'],
              o: ['Beyond the kitchen', ['Storeroom', 'Suppliers', 'Diners']],
              cap: {
                p: 'The <b>chef</b> reads the next recipe step, then chops, mixes and cooks. Every dish gets made because the chef carries out its recipe, just as every program runs because the processor carries out its instructions one by one.',
                m: 'The <b>counter</b> holds exactly what today’s cooking needs, within arm’s reach. At closing time it is wiped clean, just as main memory is emptied when the power goes off.',
                b: 'The <b>aisle</b> is shared: ingredients, dishes and orders all travel along it. That is the system bus: one common path that links every part.',
                i: 'The <b>pass window</b> is the kitchen’s link to everything outside. Orders come in, plates go out, and a small shelf lets things wait until someone is free to carry them.',
                o: 'The <b>storeroom</b> is huge and keeps things overnight (like a disk), <b>suppliers</b> deliver from far away (like a network), and <b>diners</b> place orders and receive food (like a keyboard and screen).',
              },
            },
          };
          let view = 'computer', sel = null;
          const svg = ctx.s('svg', { viewBox: '0 0 540 330', width: '100%', role: 'img', 'aria-label': 'The four structural elements of a computer joined by the system bus' });
          const cap = h('div', { class: 'player-cap s1-cap', 'aria-live': 'polite' });
          const hot = (id, inner) => `<g class="hot${sel === id ? ' sel' : ''}" data-id="${id}" tabindex="0" role="button">${inner}</g>`;
          const block = (id, x, y, w, hh, cls, lines) => hot(id, `<rect class="fr ${cls}" x="${x}" y="${y}" width="${w}" height="${hh}" rx="14" stroke-width="2"/>` +
            `<text x="${x + w / 2}" y="${y + 38}" text-anchor="middle" font-size="18" font-weight="800">${lines[0]}</text>` +
            `<text x="${x + w / 2}" y="${y + 64}" text-anchor="middle" font-size="14" class="s-sub">${lines[1]}</text>` +
            `<text x="${x + w / 2}" y="${y + 83}" text-anchor="middle" font-size="14" class="s-sub">${lines[2]}</text>`);
          function draw() {
            const d = V[view];
            const dev = d.o[1].map((t, k) => `<rect x="${278 + k * 84}" y="258" width="80" height="42" rx="9" class="s-io" stroke-width="1.5"/><text x="${318 + k * 84}" y="284" text-anchor="middle" font-size="13" font-weight="700">${t}</text>`).join('');
            svg.innerHTML =
              `<line x1="135" y1="118" x2="135" y2="152" class="s-line" stroke-width="3"/>` +
              `<line x1="405" y1="118" x2="405" y2="152" class="s-line" stroke-width="3"/>` +
              `<line x1="130" y1="192" x2="130" y2="220" class="s-line" stroke-width="3"/>` +
              `<line x1="250" y1="271" x2="272" y2="271" class="s-line" stroke-width="3"/>` +
              block('p', 10, 8, 250, 110, 's-cpu', d.p) +
              block('m', 280, 8, 250, 110, 's-mem', d.m) +
              hot('b', `<rect class="fr s-accent" x="10" y="152" width="520" height="40" rx="20" stroke-width="2"/><text x="270" y="177" text-anchor="middle" font-size="15" font-weight="800">${d.b}</text>`) +
              block('i', 10, 220, 240, 102, 's-io', d.i) +
              hot('o', `<rect class="fr s-panel" x="272" y="220" width="258" height="102" rx="14" stroke-width="1.5" stroke-dasharray="6 4"/><text x="401" y="244" text-anchor="middle" font-size="14" font-weight="800" class="s-sub">${d.o[0]}</text>${dev}`);
            cap.innerHTML = sel ? d.cap[sel] : (view === 'computer'
              ? 'Click any block to learn its job. Then flip to the kitchen view: the layout stays the same, only the names change.'
              : 'Same layout, kitchen names. Click any block to see why the comparison works.');
          }
          const pick = (e) => { const g = e.target.closest && e.target.closest('.hot'); if (!g) return; sel = g.dataset.id; draw(); };
          svg.addEventListener('click', pick);
          svg.addEventListener('pointerdown', (e) => { if (!e.isTrusted) pick(e); });
          svg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });
          const seg = ctx.ui.seg([{ value: 'computer', label: 'Computer view' }, { value: 'kitchen', label: 'Kitchen view' }], view, (v) => { view = v; draw(); });
          panel.append(h('div', { class: 'row' }, seg, h('span', { class: 'small muted' }, 'Click a block')), svg, cap);
          draw();
        },
      },
      /* ---------------- 2. Clickable top-level view ---------------- */
      {
        title: 'The top-level view: click every part',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          // [id, name, colour, what it does, key facts, kitchen analogy, related parts, data path]
          const P = {
            cpu: ['Processor (CPU)', 'cpu', 'Controls the operation of the whole computer and performs its data processing. It is the element that <i>runs programs</i>, fetching instructions and carrying them out; memory stores them, the bus carries them, and I/O modules look after devices for it.',
              ['A machine with a single processor usually calls it the <b>CPU</b> (central processing unit).', 'Inside: registers (the small boxes; only six are drawn, a real processor has many more) and an execution unit.', 'It reaches memory and devices only through the system bus.'],
              'The chef, who reads the next recipe step and does the cooking.', ['bus']],
            pc: ['Program counter (PC)', 'cpu', 'Holds the memory address of the <b>next instruction</b> to fetch.',
              ['After each fetch it normally moves on to the following address.', 'Section 1.3 shows it driving the fetch–execute cycle.'],
              'A bookmark in the recipe book, marking which step comes next.', ['cells']],
            ir: ['Instruction register (IR)', 'cpu', 'Holds the instruction that has just been fetched, while the processor works out what it means and carries it out.',
              ['Its contents change once per instruction.', 'It works hand in hand with the PC (Section 1.3).'],
              'The recipe card clipped above the stove for the step being cooked right now.', ['exec']],
            mar: ['Memory address register (MAR)', 'cpu', 'Holds the <b>address</b> of the memory cell for the next read or write. It says <i>where</i>.',
              ['Its value goes out on the address lines of the bus.', 'It never holds the data itself, only the cell number.'],
              'A slip naming which numbered spot on the counter to go to.', ['mem', 'bus'], 'mem'],
            mbr: ['Memory buffer register (MBR)', 'cpu', 'Holds the <b>data</b> to be written into memory, or receives the data read from memory. It carries <i>what</i>.',
              ['Its value travels on the data lines of the bus.', 'It pairs with the MAR: the MAR says where, the MBR says what.'],
              'The tray that carries an ingredient to or from that counter spot.', ['mem', 'bus'], 'mem'],
            ioar: ['I/O address register (I/O AR)', 'cpu', 'Specifies a <b>particular I/O device</b>: the one the processor wants to exchange data with.',
              ['It is the I/O twin of the MAR.', 'Each device has its own number, so one bus can reach many devices.'],
              'A ticket saying which door an order goes to.', ['io', 'bus'], 'io'],
            iobr: ['I/O buffer register (I/O BR)', 'cpu', 'Used for the <b>exchange of data</b> between an I/O module and the processor, in either direction.',
              ['It is the I/O twin of the MBR.', 'A key press coming in, or a character going out, passes through here.'],
              'The tray handed through the pass window.', ['io', 'bus'], 'io'],
            exec: ['Execution unit', 'cpu', 'The circuitry that does the actual work of each instruction: arithmetic such as adding, comparisons, and moving values between registers.',
              ['It works only on values already inside the processor.', 'Anything from memory must first arrive in a register, for example the MBR.'],
              'The chef’s hands, knife and stove.', ['mbr']],
            bus: ['System bus', 'accent', 'Provides communication among the processor, main memory and the I/O modules. Every exchange between them travels along it.',
              ['It carries <b>address</b> signals (where), <b>data</b> (what) and <b>control</b> signals (read or write, and when).', 'It is shared, so normally only one transfer uses it at a time.'],
              'The one shared aisle that every trip in the kitchen must use.', ['cpu', 'mem', 'io']],
            mem: ['Main memory', 'mem', 'Stores the programs that are running and the data they are using.',
              ['Usually <b>volatile</b>: its contents vanish when the power goes off.', 'Also called <b>real memory</b> or <b>primary memory</b>.', 'Much slower than registers, much faster than a disk.'],
              'The counter: it holds what today’s cooking needs and is wiped clean at closing time.', ['cells']],
            cells: ['Numbered cells', 'mem', 'Memory is a row of locations numbered 0, 1, 2 … up to <b>n − 1</b>. The number is the cell’s <b>address</b>; the bits stored in it are its <b>contents</b>.',
              ['Every cell holds a binary number: a pattern of bits.', 'That pattern can be an <b>instruction</b> or <b>data</b>; it depends on how the processor uses it.'],
              'A long row of numbered spots along the counter.', ['mem']],
            io: ['I/O module', 'io', 'Moves data between the computer and its external environment: from devices to the processor and memory, and back out again.',
              ['It knows the details of its device, so the processor does not have to.', 'It contains internal <b>buffers</b> where data waits in transit.'],
              'The pass window between the kitchen and the outside world.', ['buf', 'dev']],
            buf: ['Buffers', 'io', 'Small holding areas inside the I/O module that keep data for a moment, until the other side is ready to take it.',
              ['They absorb the huge speed difference between the processor and devices.', 'Step 6 lets you experiment with one.'],
              'The shelf in the pass window where plates wait for a server.', ['io']],
            dev: ['External devices', 'io', 'The external environment: <b>secondary memory</b> devices such as disks, <b>communications equipment</b> such as network cards, and <b>terminals</b> (keyboard and screen).',
              ['A disk is permanent and huge, but far slower than main memory.', 'The processor never talks to a device directly, only to its I/O module.'],
              'The storeroom, the suppliers and the diners.', ['io']],
          };
          const ORDER = Object.keys(P);
          const hot = (id, inner) => `<g class="hot" data-id="${id}" tabindex="0" role="button" aria-label="${P[id][0]}">${inner}</g>`;
          const reg = (id, x, y, ab, sub) => hot(id, `<rect class="fr s-panel" x="${x}" y="${y}" width="128" height="46" rx="8" stroke-width="2" style="stroke:var(--cpu)"/><text x="${x + 64}" y="${y + 20}" text-anchor="middle" class="s-monot" font-size="15" font-weight="800">${ab}</text><text x="${x + 64}" y="${y + 38}" text-anchor="middle" font-size="13" class="s-sub">${sub}</text>`);
          const rows = [['0', 'instruction', 'i'], ['1', 'instruction', 'i'], ['2', 'instruction', 'i'], ['3', 'data', 'd'], ['4', 'data', 'd'], null, ['n − 2', 'data', 'd'], ['n − 1', 'data', 'd']];
          let ry = 56;
          const cellRows = rows.map((r) => {
            if (!r) { const t = `<text x="448" y="${ry + 14}" text-anchor="middle" font-size="15" font-weight="800" class="s-sub">⋮</text><text x="549" y="${ry + 14}" text-anchor="middle" font-size="15" font-weight="800" class="s-sub">⋮</text>`; ry += 20; return t; }
            const t = `<rect x="388" y="${ry}" width="60" height="26" rx="5" class="s-panel"/><text x="418" y="${ry + 18}" text-anchor="middle" class="s-monot" font-size="13" font-weight="700">${r[0]}</text>` +
              `<rect x="456" y="${ry}" width="186" height="26" rx="5" class="${r[2] === 'i' ? 's-cpu' : 's-mem'}" stroke-width="1"/><text x="549" y="${ry + 18}" text-anchor="middle" font-size="13">${r[1]}</text>`;
            ry += 29; return t;
          }).join('');
          const devs = ['Disk', 'Network', 'Terminal'].map((d, k) => `<rect x="548" y="${336 + k * 54}" width="106" height="42" rx="9" class="s-io" stroke-width="1.5"/><text x="601" y="${362 + k * 54}" text-anchor="middle" font-size="14" font-weight="700">${d}</text><line x1="532" y1="${357 + k * 54}" x2="548" y2="${357 + k * 54}" class="s-line" stroke-width="2"/>`).join('');
          const svg = ctx.s('svg', { viewBox: ctx.narrow ? '0 0 400 540' : '0 0 660 512', width: '100%', role: 'img', 'aria-label': 'Top-level view of a computer: processor with registers, system bus, main memory and an I/O module' });
          const WIDE = () =>
            `<line x1="290" y1="258" x2="314" y2="258" class="s-line" stroke-width="4"/><line x1="350" y1="150" x2="374" y2="150" class="s-line" stroke-width="4"/><line x1="350" y1="412" x2="374" y2="412" class="s-line" stroke-width="4"/>` +
            hot('cpu', `<rect class="fr s-cpu" x="6" y="110" width="284" height="296" rx="16" stroke-width="2"/><text x="20" y="134" font-size="14" font-weight="800" style="fill:var(--cpu)">PROCESSOR (CPU)</text>`) +
            reg('pc', 18, 146, 'PC', 'next instruction') + reg('ir', 152, 146, 'IR', 'being executed') +
            reg('mar', 18, 202, 'MAR', 'memory address') + reg('mbr', 152, 202, 'MBR', 'memory data') +
            reg('ioar', 18, 258, 'I/O AR', 'which device') + reg('iobr', 152, 258, 'I/O BR', 'I/O data') +
            hot('exec', `<rect class="fr s-panel" x="18" y="318" width="262" height="74" rx="8" stroke-width="2" style="stroke:var(--cpu)"/><text x="149" y="349" text-anchor="middle" font-size="15" font-weight="800">Execution unit</text><text x="149" y="370" text-anchor="middle" font-size="13" class="s-sub">adds, compares, moves values</text>`) +
            hot('bus', `<rect class="fr s-accent" x="314" y="6" width="36" height="500" rx="12" stroke-width="2"/><text x="332" y="256" transform="rotate(-90 332 256)" text-anchor="middle" font-size="14" font-weight="800" style="fill:var(--accent)">SYSTEM BUS</text>`) +
            hot('mem', `<rect class="fr s-mem" x="374" y="6" width="280" height="298" rx="14" stroke-width="2"/><text x="388" y="30" font-size="14" font-weight="800" style="fill:var(--mem)">MAIN MEMORY</text><text x="418" y="49" text-anchor="middle" font-size="13" class="s-sub">address</text><text x="549" y="49" text-anchor="middle" font-size="13" class="s-sub">contents</text>`) +
            hot('cells', `<rect class="fr" x="382" y="52" width="266" height="246" rx="8" fill="transparent" stroke-width="0" style="stroke:var(--mem)"/>${cellRows}`) +
            hot('io', `<rect class="fr s-io" x="374" y="318" width="150" height="188" rx="14" stroke-width="2"/><text x="388" y="342" font-size="14" font-weight="800" style="fill:var(--io)">I/O MODULE</text>`) +
            hot('buf', `<rect class="fr" x="386" y="352" width="126" height="108" rx="8" fill="transparent" stroke-width="0" style="stroke:var(--io)"/>${[0, 1, 2, 3].map((k) => `<rect class="s-panel" x="${392 + (k % 2) * 58}" y="${358 + Math.floor(k / 2) * 40}" width="52" height="32" rx="6" stroke-width="1.5"/>`).join('')}<text x="449" y="454" text-anchor="middle" font-size="13" class="s-sub">buffers</text>`) +
            `<line x1="524" y1="412" x2="532" y2="412" class="s-line" stroke-width="2"/><line x1="532" y1="357" x2="532" y2="465" class="s-line" stroke-width="2"/>` +
            `<text x="601" y="326" text-anchor="middle" font-size="13" class="s-sub">outside world</text>` +
            hot('dev', `<rect class="fr" x="542" y="330" width="118" height="160" rx="10" fill="transparent" stroke-width="0" style="stroke:var(--io)"/>${devs}`) +
            `<text x="148" y="452" text-anchor="middle" font-size="14" class="s-sub">Click any box, register</text><text x="148" y="472" text-anchor="middle" font-size="14" class="s-sub">or the bus to explore it.</text>`;
          // phone layout: processor on top, bus across the middle, memory and I/O side by side below
          const regN = (id, x, y, ab, sub) => hot(id, `<rect class="fr s-panel" x="${x}" y="${y}" width="180" height="40" rx="8" stroke-width="2" style="stroke:var(--cpu)"/><text x="${x + 90}" y="${y + 17}" text-anchor="middle" class="s-monot" font-size="15" font-weight="800">${ab}</text><text x="${x + 90}" y="${y + 33}" text-anchor="middle" font-size="13" class="s-sub">${sub}</text>`);
          const NARROW = () => {
            let y = 318;
            const rowsN = rows.map((r) => {
              if (!r) { const t = `<text x="44" y="${y + 13}" text-anchor="middle" font-size="15" font-weight="800" class="s-sub">⋮</text><text x="150" y="${y + 13}" text-anchor="middle" font-size="15" font-weight="800" class="s-sub">⋮</text>`; y += 18; return t; }
              const t = `<rect x="16" y="${y}" width="56" height="23" rx="5" class="s-panel"/><text x="44" y="${y + 16}" text-anchor="middle" class="s-monot" font-size="13" font-weight="700">${r[0]}</text>` +
                `<rect x="78" y="${y}" width="144" height="23" rx="5" class="${r[2] === 'i' ? 's-cpu' : 's-mem'}" stroke-width="1"/><text x="150" y="${y + 16}" text-anchor="middle" font-size="13">${r[1]}</text>`;
              y += 26; return t;
            }).join('');
            const devN = ['Disk', 'Network', 'Terminal'].map((d, k) => `<rect x="244" y="${414 + k * 38}" width="136" height="32" rx="8" class="s-io" stroke-width="1.5"/><text x="312" y="${435 + k * 38}" text-anchor="middle" font-size="14" font-weight="700">${d}</text><line x1="380" y1="${430 + k * 38}" x2="388" y2="${430 + k * 38}" class="s-line" stroke-width="2"/>`).join('');
            return `<line x1="200" y1="218" x2="200" y2="226" class="s-line" stroke-width="4"/><line x1="116" y1="260" x2="116" y2="274" class="s-line" stroke-width="4"/><line x1="316" y1="260" x2="316" y2="274" class="s-line" stroke-width="4"/><line x1="388" y1="404" x2="388" y2="506" class="s-line" stroke-width="2"/>` +
              hot('cpu', `<rect class="fr s-cpu" x="6" y="6" width="388" height="212" rx="14" stroke-width="2"/><text x="18" y="28" font-size="14" font-weight="800" style="fill:var(--cpu)">PROCESSOR (CPU)</text>`) +
              regN('pc', 16, 38, 'PC', 'next instruction') + regN('ir', 204, 38, 'IR', 'being executed') +
              regN('mar', 16, 84, 'MAR', 'memory address') + regN('mbr', 204, 84, 'MBR', 'memory data') +
              regN('ioar', 16, 130, 'I/O AR', 'which device') + regN('iobr', 204, 130, 'I/O BR', 'I/O data') +
              hot('exec', `<rect class="fr s-panel" x="16" y="176" width="368" height="32" rx="8" stroke-width="2" style="stroke:var(--cpu)"/><text x="200" y="197" text-anchor="middle" font-size="14"><tspan font-weight="800">Execution unit</tspan><tspan class="s-sub"> · adds, compares, moves</tspan></text>`) +
              hot('bus', `<rect class="fr s-accent" x="6" y="226" width="388" height="34" rx="12" stroke-width="2"/><text x="200" y="248" text-anchor="middle" font-size="14" font-weight="800" style="fill:var(--accent)">SYSTEM BUS</text>`) +
              hot('mem', `<rect class="fr s-mem" x="6" y="274" width="226" height="258" rx="14" stroke-width="2"/><text x="18" y="294" font-size="14" font-weight="800" style="fill:var(--mem)">MAIN MEMORY</text><text x="44" y="312" text-anchor="middle" font-size="13" class="s-sub">address</text><text x="150" y="312" text-anchor="middle" font-size="13" class="s-sub">contents</text>`) +
              hot('cells', `<rect class="fr" x="12" y="300" width="214" height="224" rx="8" fill="transparent" stroke-width="0" style="stroke:var(--mem)"/>${rowsN}`) +
              hot('io', `<rect class="fr s-io" x="244" y="274" width="150" height="130" rx="14" stroke-width="2"/><text x="256" y="294" font-size="14" font-weight="800" style="fill:var(--io)">I/O MODULE</text>`) +
              hot('buf', `<rect class="fr" x="252" y="300" width="134" height="98" rx="8" fill="transparent" stroke-width="0" style="stroke:var(--io)"/>${[0, 1, 2, 3].map((k) => `<rect class="s-panel" x="${258 + (k % 2) * 62}" y="${304 + Math.floor(k / 2) * 36}" width="54" height="28" rx="6" stroke-width="1.5"/>`).join('')}<text x="319" y="392" text-anchor="middle" font-size="13" class="s-sub">buffers</text>`) +
              hot('dev', `<rect class="fr" x="240" y="410" width="154" height="116" rx="10" fill="transparent" stroke-width="0" style="stroke:var(--io)"/>${devN}`);
          };
          svg.innerHTML = (ctx.narrow ? NARROW() : WIDE()) + '<g class="s1-paths" style="pointer-events:none"></g>';
          const paths = svg.querySelector('.s1-paths');
          const ROWY = { mar: 225, mbr: 225, ioar: 281, iobr: 281 };
          const COLX = { mar: 106, mbr: 294, ioar: 106, iobr: 294 };
          const pathFor = (id, tgt) => (ctx.narrow
            ? `M${COLX[id]} ${id.startsWith('io') ? 160 : 114} V243 H${tgt === 'mem' ? 116 : 316} V290`
            : `M290 ${ROWY[id]} H332 V${tgt === "mem" ? 150 : 412} H392`);
          const seen = new Set();
          const meter = h('div', { class: 'meter grow' }, h('i', { style: { width: '0%' } }));
          const count = h('span', { class: 'small b num' });
          let last = -1;
          const tour = h('button', { type: 'button', class: 'btn sm', title: 'Show the next part in order', onclick: () => { last = (last + 1) % ORDER.length; show(ORDER[last]); } }, 'Tour ▶');
          const info = h('div', { class: 'stack gap-s s2-info', 'aria-live': 'polite' });
          function show(id) {
            seen.add(id); last = ORDER.indexOf(id);
            svg.querySelectorAll('.hot').forEach((g) => { g.classList.toggle('sel', g.dataset.id === id); g.classList.toggle('rel', P[id][5].includes(g.dataset.id)); });
            const tgt = P[id][6];
            paths.innerHTML = tgt ? `<path d="${pathFor(id, tgt)}" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" style="stroke:var(--accent);opacity:.4"/>` : '';
            const [name, col, what, facts, ana] = P[id];
            info.innerHTML = `<div><span class="chip ${col}">${seen.size} of ${ORDER.length} explored</span></div><h3 class="m0">${name}</h3><p class="m0">${what}</p>` +
              `<ul class="small m0">${facts.map((f) => `<li>${f}</li>`).join('')}</ul><div class="callout analogy m0" data-label="Kitchen analogy">${ana}</div>`;
            meter.firstChild.style.width = (seen.size / ORDER.length) * 100 + '%';
            count.textContent = `${seen.size} / ${ORDER.length}`;
            if (seen.size === ORDER.length) count.textContent = 'All ' + ORDER.length + ' ✓';
          }
          const pick = (e) => { const g = e.target.closest && e.target.closest('.hot'); if (g) show(g.dataset.id); };
          svg.addEventListener('click', pick);
          svg.addEventListener('pointerdown', (e) => { if (!e.isTrusted) pick(e); });
          svg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });
          info.innerHTML = `<h3 class="m0">Four elements, one picture</h3><p class="m0">This is the classic top-level view of a computer. The <span class="t">processor</span> is ${ctx.narrow ? 'at the top' : 'on the left'}, <span class="t">main memory</span> and an <span class="t">I/O module</span> ${ctx.narrow ? 'at the bottom' : 'on the right'}, and the <span class="t">system bus</span> joins them all.</p>` +
            `<p class="m0">The processor holds small, fast storage slots called <span class="t">registers</span>. Six are drawn here: two drive the running program (PC and IR) and four carry every exchange with memory and I/O. A real processor also has many others, for example registers that hold the numbers a program is working on.</p>` +
            `<div class="callout tip m0" data-label="Try this">Click all ${ORDER.length} parts. Clicking a register lights up the path its value takes across the bus.</div>` +
            `<div class="row gap-s"><span class="chip cpu">processor + registers</span><span class="chip mem">memory</span><span class="chip io">I/O</span><span class="chip accent">bus</span></div>`;
          count.textContent = `0 / ${ORDER.length}`;
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center', padding: '10px' } }, svg),
            h('div', { class: 'stack' }, h('div', { class: 'row nw' }, h('span', { class: 'small b muted' }, 'Explored'), meter, count, tour), info)));
        },
      },
      /* ---------------- 3. The four exchange registers: a placement puzzle ---------------- */
      {
        title: 'Where and what: the four exchange registers',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack">
              <p class="lead m0">Four of the processor’s <span class="t">registers</span> exist only to exchange data with the rest of the machine. They come in two pairs.</p>
              <div class="s3-grid">
                <span></span><span class="hd">Where (address)</span><span class="hd">What (the data)</span>
                <span class="side" style="color:var(--mem)">Memory</span>
                <div class="box cpu"><b class="mono">MAR</b><div class="xs muted">cell for the next read or write</div></div>
                <div class="box cpu"><b class="mono">MBR</b><div class="xs muted">data to write, or data just read</div></div>
                <span class="side" style="color:var(--io)">I/O</span>
                <div class="box cpu"><b class="mono">I/O AR</b><div class="xs muted">which particular device</div></div>
                <div class="box cpu"><b class="mono">I/O BR</b><div class="xs muted">data to or from an I/O module</div></div>
              </div>
              <p class="small m0">The <span class="t">memory address register (MAR)</span> names the memory cell for the next read or write; the <span class="t">memory buffer register (MBR)</span> holds the data to be written or receives the data read. The <span class="t">I/O AR</span> names a particular device; the <span class="t">I/O BR</span> carries data between an I/O module and the processor.</p>
              <div class="callout warn m0" data-label="Common mistake">Thinking the MAR holds data. An address register only ever says <i>where</i>. The value itself always rides in a buffer register.</div>
            </div>
            <div class="card white stack s3-game"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const game = el.querySelector('.s3-game');
          const REG = {
            mar: ['MAR', 'memory · where', 'addr', 'mem'], mbr: ['MBR', 'memory · what', 'data', 'mem'],
            ioar: ['I/O AR', 'I/O · which device', 'addr', 'io'], iobr: ['I/O BR', 'I/O · what', 'data', 'io'],
          };
          const S = [
            { t: 'The processor needs the number in <b>memory cell 12</b>, which holds <b>305</b>.',
              p: [['12', 'the cell to read', 'addr', ['mar']], ['305', 'the value that comes back', 'data', ['mbr']]],
              done: 'Exactly. The MAR sends out <b>12</b> to say <i>where</i>; the word <b>305</b> comes back and lands in the MBR.' },
            { t: 'The program wants to <b>write the value 42</b> into <b>memory cell 7</b>.',
              p: [['42', 'the value to store', 'data', ['mbr']], ['7', 'the cell to write', 'addr', ['mar']]],
              done: 'Right. For a write the processor fills <i>both</i> registers before the transfer: MAR = 7 (where), MBR = 42 (what).' },
            { t: 'Send the letter <b>H</b> to the <b>printer</b>, which is I/O device number <b>2</b>.',
              p: [['H', 'the character to print', 'data', ['iobr']], ['2', 'the printer’s device number', 'addr', ['ioar']]],
              done: 'Yes. A device is not a memory cell, so the I/O pair is used: I/O AR = 2 picks the printer and I/O BR = H is the data.' },
            { t: 'Store the number <b>9</b> in <b>memory cell 9</b>. Same number, two different jobs.',
              p: [['9', 'the value to store', 'data', ['mbr']], ['9', 'the cell number', 'addr', ['mar']]],
              done: 'Well spotted. The bits are identical, but the register gives them their meaning: in the MAR, 9 is a <i>place</i>; in the MBR, 9 is a <i>value</i>.' },
            { t: 'The letter <b>q</b> is waiting at the <b>keyboard</b> (I/O device <b>1</b>). Bring it in, then store it in <b>memory cell 200</b>.',
              p: [['q', 'arriving from the keyboard', 'data', ['iobr', 'mbr']], ['200', 'where q will be kept', 'addr', ['mar']], ['1', 'which device to read', 'addr', ['ioar']], ['q', 'on its way to memory', 'data', ['iobr', 'mbr']]],
              done: 'Complete trip! The key press came in through the I/O pair (I/O AR = 1, I/O BR = q) and went on to memory through the memory pair (MAR = 200, MBR = q).' },
          ];
          let si = 0, pick = -1, placed = {}, used = new Set();
          const head = h('div', { class: 'row' });
          const task = h('p', { class: 'm0 s3-task' });
          const slots = {};
          const slotWrap = h('div', { class: 's3-slots' });
          Object.keys(REG).forEach((r) => {
            slots[r] = h('button', { type: 'button', class: 's3-slot', onclick: () => place(r) });
            slotWrap.append(slots[r]);
          });
          const tray = h('div', { class: 'row s3-tray' });
          const fb = h('div', { class: 'player-cap s3-fb', 'aria-live': 'polite' });
          const bReset = h('button', { type: 'button', class: 'btn sm', onclick: () => load(si) }, 'Reset scenario');
          const bNext = h('button', { type: 'button', class: 'btn sm primary', onclick: () => load(si + 1 >= S.length ? 0 : si + 1) });
          game.append(head, task, slotWrap, h('div', { class: 'xs muted b' }, 'VALUES TO PLACE: click one, then click its register'), tray, fb, h('div', { class: 'row', style: { marginTop: 'auto' } }, bReset, h('span', { class: 'grow' }), bNext));
          function paint() {
            const sc = S[si];
            head.innerHTML = `<span class="chip accent">Scenario ${si + 1} of ${S.length}</span>` + S.map((_, k) => `<span class="s3-dot${k < si ? ' done' : k === si ? ' on' : ''}"></span>`).join('');
            task.innerHTML = sc.t;
            Object.entries(REG).forEach(([r, [nm, role]]) => {
              const v = placed[r];
              slots[r].className = 's3-slot' + (v != null ? ' full' : '');
              slots[r].innerHTML = `<span class="stack gap-s" style="gap:0"><b class="mono nm">${nm}</b><span class="xs muted">${role}</span></span><span class="mono val">${v != null ? ctx.util.esc(v) : '—'}</span>`;
            });
            tray.innerHTML = '';
            sc.p.forEach((p, k) => {
              if (used.has(k)) return;
              tray.append(h('button', { type: 'button', class: 's3-parcel' + (pick === k ? ' on' : ''), onclick: () => { pick = pick === k ? -1 : k; paint(); } },
                h('b', { class: 'mono' }, p[0]), h('span', { class: 'xs muted' }, p[1])));
            });
            if (used.size === sc.p.length) tray.append(h('span', { class: 'chip ok' }, '✓ every value placed'));
            const complete = used.size === sc.p.length;
            bNext.textContent = si === S.length - 1 && complete ? 'Start over' : 'Next scenario ▶';
            bNext.disabled = !complete;
          }
          function say(html, cls) { fb.innerHTML = html; fb.className = 'player-cap s3-fb' + (cls ? ' ' + cls : ''); }
          function place(r) {
            const sc = S[si];
            if (pick < 0) { say(placed[r] != null ? `The ${REG[r][0]} already holds <b>${ctx.util.esc(placed[r])}</b> for this job.` : 'First click one of the values below, then click the register it belongs in.'); return; }
            const [v, d, kind, ok] = sc.p[pick];
            const [nm, , rk, rs] = REG[r];
            if (placed[r] != null) { say(`The ${nm} is already holding <b>${ctx.util.esc(placed[r])}</b> for this job. Try another register.`, 'bad'); return; }
            if (!ok.includes(r)) {
              let why;
              if (kind !== rk) why = kind === 'addr' ? `<b>${v}</b> is a <i>where</i> (${d}). Where-values go in an address register: MAR for memory, I/O AR for a device.` : `<b>${v}</b> is the data itself (${d}). Address registers only say where; data travels in a buffer register (MBR or I/O BR).`;
              else why = rs === 'mem' ? `Right kind of register, wrong pair. This part of the job involves an <b>I/O device</b>, so it uses the I/O AR / I/O BR pair.` : `Right kind of register, wrong pair. This part of the job involves a <b>memory cell</b>, so it uses the MAR / MBR pair.`;
              say('<b style="color:var(--bad)">Not the ' + nm + '.</b> ' + why, 'bad');
              slots[r].classList.add('nope'); ctx.after(600, () => slots[r].classList.remove('nope'));
              return;
            }
            placed[r] = v; used.add(pick); pick = -1;
            paint();
            slots[r].classList.add('flash');
            if (used.size === sc.p.length) say('<b style="color:var(--ok)">✓ Scenario solved.</b> ' + sc.done + (si === S.length - 1 ? ' <b>All five scenarios done.</b>' : ''), 'good');
            else say(`<b style="color:var(--ok)">✓ ${nm} = ${ctx.util.esc(v)}.</b> ${rk === 'addr' ? 'An address register says where.' : 'A buffer register carries the data.'} Place the next value.`);
          }
          function load(n) {
            si = n; pick = -1; placed = {}; used = new Set();
            paint();
            say('Click a value, then click the register that should hold it. Think: is it a <i>where</i> or a <i>what</i>? Memory or a device?');
          }
          load(0);
        },
      },
      /* ---------------- 4. Main memory: numbered cells holding bit patterns ---------------- */
      {
        title: 'Main memory: a long row of numbered cells',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          // a tiny program (cells 0-2), its data (8-10), some text (4) and leftover bits elsewhere
          const KNOWN = {
            0: [0x1008, 'i', 'an <b>instruction</b>: the program’s first step, “load the number in cell 8”.'],
            1: [0x5009, 'i', 'an <b>instruction</b>: the second step, “add the number in cell 9”.'],
            2: [0x200A, 'i', 'an <b>instruction</b>: the third step, “store the result in cell 10”.'],
            4: [0x4869, 'd', '<b>data</b>: two letters of text, “Hi”. Each letter is kept as its number code: H = 72 (hex 48) and i = 105 (hex 69).'],
            8: [0x0019, 'd', '<b>data</b>: the first number the program adds. Hex 0019 = 1×16 + 9 = <b>25</b> in decimal.'],
            9: [0x0011, 'd', '<b>data</b>: the second number the program adds. Hex 0011 = 1×16 + 1 = <b>17</b> in decimal.'],
            10: [0x002A, 'd', '<b>data</b>: the result once the program has run. Hex 002A = 2×16 + 10 = <b>42</b>, and 25 + 17 = 42.'],
          };
          const rng = ctx.util.seeded(11);
          const LEFT = Array.from({ length: 64 }, (_, a) => (a > 10 && rng() < 0.3 ? Math.floor(rng() * 0x10000) : 0));
          const word = (a) => (KNOWN[a] ? KNOWN[a][0] : LEFT[a]);
          const role = (a) => (KNOWN[a] ? KNOWN[a][1] : 'f');
          const OPS = { 1: 'load from cell', 2: 'store into cell', 5: 'add from cell' };
          let k = 5, sel = 0;
          const readout = h('div', { class: 'card tight s4-read' });
          const slider = ctx.ui.slider({ label: 'Address bits (k)', min: 4, max: 6, value: k, format: (v) => v + ' bits', onInput: (v) => { k = v; if (sel >= 1 << k) sel = 0; paint(); } });
          const grid = h('div', { class: 's4-grid' });
          const detail = h('div', { class: 'card s4-detail', 'aria-live': 'polite' });
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: '<span class="t">Main memory</span> is a long row of storage cells. Each cell has a number, its <span class="t">address</span>, and holds a pattern of <span class="t">bits</span>.' }),
              h('p', { class: 'm0', html: 'With <b>n</b> cells, the addresses run 0, 1, 2 … up to <b>n − 1</b>. To use a cell, the processor puts its address in the MAR; the bits that come back are the cell’s <b>contents</b>: an <span class="t">instruction</span> or <span class="t">data</span>.' }),
              slider, readout,
              h('div', { class: 'callout warn m0', 'data-label': 'Two common mistakes', html: 'The last address is <b>n − 1</b>, not n, because counting starts at 0. And an address is not the contents: cell 5 does not hold 5; it holds whatever was last written there.' }),
              h('div', { class: 'callout tip m0', 'data-label': 'Reading hex', html: 'The grid writes each cell in <b>hex</b> (base 16): one digit for every 4 bits, counting 0–9 and then A–F (A&nbsp;=&nbsp;10 … F&nbsp;=&nbsp;15). So hex 0019 = 1×16 + 9 = <b>25</b>.' })),
            h('div', { class: 'card white stack' },
              h('div', { class: 'row' }, h('span', { class: 'chip cpu' }, 'instruction'), h('span', { class: 'chip mem' }, 'data'), h('span', { class: 'chip' }, 'unused'), h('span', { class: 'small muted' }, 'Click a cell to open it. Try 0–2 and 8–10, then 4.')),
              grid, detail)));
          let builtN = 0;
          function paint() {
            const n = 1 << k;
            readout.innerHTML = `k = ${k} bits → n = 2<sup>${k}</sup> = <b>${n} cells</b>, addresses <b>0 to ${n - 1}</b>.<div class="xs muted">Toy cells hold 16 bits; real machines give every 8-bit byte its own address.</div>`;
            if (builtN !== n) {
              builtN = n;
              grid.className = 's4-grid' + (n === 64 ? ' dense' : '') + (n === 16 ? ' roomy' : '');
              grid.innerHTML = '';
              for (let a = 0; a < n; a++) {
                grid.append(h('button', { type: 'button', class: 's4-cell r-' + role(a) + (a === n - 1 ? ' last' : ''), 'data-a': a, title: a === n - 1 ? 'The last cell: address n − 1' : 'Cell ' + a, onclick: () => { sel = a; paint(); } },
                  h('span', { class: 'ad' }, String(a)), h('span', { class: 'mono ct' }, hex4(word(a)))));
              }
            }
            grid.querySelectorAll('.s4-cell').forEach((b) => b.classList.toggle('on', +b.dataset.a === sel));
            const w = word(sel), op = w >>> 12, ad = w & 0xFFF, hi = w >>> 8, lo = w & 0xFF;
            const pr = (c) => c >= 32 && c < 127;
            const txt = pr(hi) && pr(lo) ? '“' + String.fromCharCode(hi) + String.fromCharCode(lo) + '”' : '<span class="muted">not printable</span>';
            // the toy machine only knows operations 1, 2 and 5; any other first digit cannot run as an instruction
            const ins = OPS[op] ? `“${OPS[op]} ${ad}”` : '<span class="muted">no such operation</span>';
            const insSub = OPS[op] ? 'first 4 bits = operation, last 12 = cell' : `This toy machine has no operation ${op}, so this word can only be data.`;
            const what = KNOWN[sel] ? KNOWN[sel][2] : (w ? '<b>unused</b>: leftover bits from an earlier program. No program is using them now.' : '<b>unused</b>: it holds all zeros. A cell is never truly empty; it always holds <i>some</i> bits.');
            detail.innerHTML = `<div class="row" style="justify-content:space-between"><b>Address ${sel}${sel === n - 1 ? ' <span class="chip accent">last cell = n − 1</span>' : ''}</b><span class="small muted mono">address in binary: ${bits(sel, k)}</span></div>` +
              `<div class="small">Contents (16 bits): <b class="mono">${nib(bits(w, 16))}</b> <span class="muted">(hex ${hex4(w)})</span></div>` +
              `<div class="s4-reads"><div><span class="xs muted b">AS A NUMBER</span><b class="mono">${w}</b><span class="xs muted">all 16 bits, in decimal</span></div><div><span class="xs muted b">AS TWO LETTERS</span><b>${txt}</b><span class="xs muted">each letter is stored as a number code (8 bits)</span></div><div><span class="xs muted b">AS AN INSTRUCTION</span><b class="small">${ins}</b><span class="xs muted">${insSub}</span></div></div>` +
              `<div class="small">Its role here: ${what}</div>`;
            ctx.refit();
          }
          paint();
        },
      },
      /* ---------------- 5. Follow the data across the bus ---------------- */
      {
        title: 'Follow the data across the system bus',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const esc = ctx.util.esc;
          // two layouts share one drawing routine: wide (laptop / projector) and tall (phone)
          const G = ctx.narrow ? {
            vb: '0 0 400 548', proc: [6, 6, 388, 150], regs: { mar: [18, 40], mbr: [146, 40], ioar: [18, 98], iobr: [146, 98] }, regW: 120, regH: 50, exec: [274, 40, 110, 108],
            mem: [6, 250, 352, 108], cell: (i) => 16 + i * 42, cellY: 280, cellW: 38, cellH: 44, valFont: 17, addrY: 348, memNote: '',
            bus: [6, 170, 388, 66], lanes: { a: 188, d: 206, c: 224 }, labelX: 14, laneX: [80, 386], tokX: () => 250,
            wires: [[77, 156, 77, 170], [205, 156, 205, 170], [200, 236, 200, 250], [380, 236, 380, 372], [100, 372, 380, 372], [100, 372, 100, 380], [300, 372, 300, 380]],
            mods: { 1: [6, 380], 2: [206, 380] }, modW: 188, slot: [42, 36, 160], devs: { 1: [6, 460, 188, 50], 2: [206, 460, 188, 50] }, devWires: [[100, 448, 100, 460], [300, 448, 300, 460]],
            legend: `<text x="200" y="538" text-anchor="middle" font-size="13"><tspan font-weight="800" style="fill:var(--accent)">address</tspan> = where · <tspan font-weight="800" style="fill:var(--accent)">data</tspan> = what · <tspan font-weight="800" style="fill:var(--accent)">control</tspan> = command</text>`,
          } : {
            vb: '0 0 1100 340', proc: [8, 8, 432, 160], regs: { mar: [24, 42], mbr: [164, 42], ioar: [24, 104], iobr: [164, 104] }, regW: 128, regH: 52, exec: [306, 42, 120, 114],
            mem: [470, 8, 622, 160], cell: (i) => 488 + i * 74, cellY: 42, cellW: 66, cellH: 62, valFont: 21, addrY: 124, memNote: 'cells 0–7 (address under each cell)',
            bus: [8, 182, 1084, 68], lanes: { a: 198, d: 216, c: 234 }, labelX: 20, laneX: [96, 1080], tokX: (f) => f.x,
            wires: [[88, 168, 88, 182], [228, 168, 228, 182], [780, 168, 780, 182], [565, 250, 565, 266], [895, 250, 895, 266]],
            mods: { 1: [470, 266], 2: [800, 266] }, modW: 190, slot: [46, 40, 168], devs: { 1: [676, 272, 106, 56], 2: [1004, 272, 88, 56] }, devWires: [[660, 300, 676, 300], [990, 300, 1004, 300]],
            legend: `<text x="16" y="283" font-size="13"><tspan font-weight="800" style="fill:var(--accent)">address</tspan> lines carry WHERE: a cell or a device number</text>` +
              `<text x="16" y="305" font-size="13"><tspan font-weight="800" style="fill:var(--accent)">data</tspan> lines carry WHAT: the value itself</text>` +
              `<text x="16" y="327" font-size="13"><tspan font-weight="800" style="fill:var(--accent)">control</tspan> lines carry the command: READ, WRITE …</text>`,
          };
          const svg = ctx.s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Processor, main memory, two I/O modules and the system bus with its address, data and control lines' });
          const val = (v) => (v == null ? '<tspan class="s-sub">—</tspan>' : esc(String(v)));
          const line = ([x1, y1, x2, y2], w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="s-line" stroke-width="${w}"/>`;
          function reg(id, nm, f) {
            const [x, y] = G.regs[id], on = f.chg.includes(id);
            return `<rect x="${x}" y="${y}" width="${G.regW}" height="${G.regH}" rx="9" class="s-panel" stroke-width="${on ? 3.5 : 2}" style="stroke:var(--cpu)${on ? ';fill:var(--hl)' : ''}"/>` +
              `<text x="${x + 10}" y="${y + 18}" font-size="13" font-weight="800" class="s-monot" style="fill:var(--cpu)">${nm}</text>` +
              `<text x="${x + G.regW / 2}" y="${y + G.regH - 9}" text-anchor="middle" font-size="21" font-weight="800" class="s-monot">${val(f.reg[id])}</text>`;
          }
          function token(x, lane, t) {
            const [txt, dir] = t;
            const label = dir === 'l' ? '← ' + txt : txt + ' →';
            const w = 18 + label.length * 8, y = G.lanes[lane];
            return `<rect x="${x - w / 2}" y="${y - 9}" width="${w}" height="18" rx="9" class="s-accent" stroke-width="1.5" style="fill:var(--panel)"/>` +
              `<text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="13" font-weight="800" class="s-monot" style="fill:var(--accent)">${esc(label)}</text>`;
          }
          function module(n, f) {
            const [x, y] = G.mods[n], [P, W, LX] = G.slot, buf = n === 1 ? f.buf1 : f.buf2, on = f.mod === n;
            return `<rect x="${x}" y="${y}" width="${G.modW}" height="68" rx="12" class="s-io" stroke-width="${on ? 4 : 2}"/>` +
              `<text x="${x + 12}" y="${y + 19}" font-size="13" font-weight="800" style="fill:var(--io)">I/O MODULE ${n}</text>` +
              [0, 1, 2].map((j) => `<rect x="${x + 12 + j * P}" y="${y + 28}" width="${W}" height="30" rx="6" class="s-panel" stroke-width="1.5"${buf[j] ? ' style="fill:var(--hl)"' : ''}/><text x="${x + 12 + W / 2 + j * P}" y="${y + 49}" text-anchor="middle" font-size="16" font-weight="800" class="s-monot">${buf[j] ? esc(buf[j]) : ''}</text>`).join('') +
              `<text x="${x + LX}" y="${y + 49}" text-anchor="middle" font-size="13" class="s-sub">buffer</text>`;
          }
          function device(n, name, sub, on, lit) {
            const [x, y, w, hh] = G.devs[n];
            return `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="9" class="s-panel" stroke-width="${on ? 3.5 : 1.5}" stroke-dasharray="5 3" style="stroke:var(--io)${lit ? ';fill:var(--hl)' : ''}"/>` +
              `<text x="${x + w / 2}" y="${y + hh / 2 - 4}" text-anchor="middle" font-size="14" font-weight="800">${name}</text><text x="${x + w / 2}" y="${y + hh / 2 + 14}" text-anchor="middle" font-size="13" class="s-sub">${sub}</text>`;
          }
          function draw(f) {
            const [px, py, pw, ph] = G.proc, [ex, ey, ew, eh] = G.exec, [mx, my, mw, mh] = G.mem, [bx, by, bw, bh] = G.bus;
            let t = G.wires.map((w) => line(w, 4)).join('') + G.devWires.map((w) => line(w, 2)).join('');
            t += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="14" class="s-cpu" stroke-width="2"/><text x="${px + 14}" y="${py + 22}" font-size="14" font-weight="800" style="fill:var(--cpu)">PROCESSOR</text>`;
            t += reg('mar', 'MAR', f) + reg('mbr', 'MBR', f) + reg('ioar', 'I/O AR', f) + reg('iobr', 'I/O BR', f);
            t += `<rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" rx="9" class="s-panel" stroke-width="2" style="stroke:var(--cpu)"/><text x="${ex + ew / 2}" y="${ey + eh / 2 - 12}" text-anchor="middle" font-size="14" font-weight="800">Execution</text><text x="${ex + ew / 2}" y="${ey + eh / 2 + 6}" text-anchor="middle" font-size="14" font-weight="800">unit</text>` +
              `<text x="${ex + ew / 2}" y="${ey + eh / 2 + 30}" text-anchor="middle" font-size="13" class="s-sub">${esc(f.exec)}</text>`;
            t += `<rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="14" class="s-mem" stroke-width="${f.cell >= 0 ? 3.5 : 2}"/><text x="${mx + 14}" y="${my + 22}" font-size="14" font-weight="800" style="fill:var(--mem)">MAIN MEMORY</text><text x="${mx + mw - 14}" y="${my + 22}" text-anchor="end" font-size="13" class="s-sub">${G.memNote}</text>`;
            f.mem.forEach((v, i) => {
              const x = G.cell(i), on = f.cell === i, ch = f.chgCell === i;
              t += `<rect x="${x}" y="${G.cellY}" width="${G.cellW}" height="${G.cellH}" rx="8" class="s-panel" stroke-width="${on ? 3.5 : 1.5}" style="${on ? 'stroke:var(--accent)' : ''}${ch ? ';fill:var(--hl)' : ''}"/>` +
                `<text x="${x + G.cellW / 2}" y="${G.cellY + G.cellH / 2 + G.valFont * 0.36}" text-anchor="middle" font-size="${G.valFont}" font-weight="800" class="s-monot">${esc(String(v))}</text>` +
                `<text x="${x + G.cellW / 2}" y="${G.addrY}" text-anchor="middle" font-size="14" font-weight="700" class="s-sub s-monot">${i}</text>`;
            });
            t += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="14" class="s-accent" stroke-width="2"/>`;
            [['a', 'address'], ['d', 'data'], ['c', 'control']].forEach(([k, nm]) => {
              const on = !!f.L[k], y = G.lanes[k];
              t += `<text x="${G.labelX}" y="${y + 4.5}" font-size="13" font-weight="800" style="fill:var(--accent)">${nm}</text>` +
                `<line x1="${G.laneX[0]}" y1="${y}" x2="${G.laneX[1]}" y2="${y}" stroke-width="${on ? 3 : 1.5}" stroke-dasharray="${on ? '0' : '5 5'}" style="stroke:${on ? 'var(--accent)' : 'var(--line-2)'}"/>`;
            });
            Object.entries(f.L).forEach(([k, v]) => { t += token(G.tokX(f), k, v); });
            t += module(1, f) + module(2, f);
            t += device(1, 'Keyboard', 'device 1', f.dev === 1, false) + device(2, 'Printer', f.printed ? 'printed: ' + esc(f.printed) : 'device 2', f.dev === 2, !!f.printed);
            t += G.legend;
            svg.innerHTML = t;
          }
          let name = 'read', frames = flowFrames(name);
          const player = ctx.ui.player({ count: frames.length, interval: 3000, render: (i) => { draw(frames[i]); return frames[i].cap; } });
          const seg = ctx.ui.seg([{ value: 'read', label: 'Memory read' }, { value: 'write', label: 'Memory write' }, { value: 'out', label: 'Output to printer' }, { value: 'in', label: 'Input from keyboard' }], name, (v) => {
            name = v; frames = flowFrames(v); player.stop(); player.setCount(frames.length);
          });
          el.append(h('div', { class: 'stack fill s5', style: { gap: '10px' } },
            h('div', { class: 'row' }, seg, h('span', { class: 'small muted' }, 'Pick a transfer, then press Play or step with ▶.')),
            h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), player.el));
        },
      },
      /* ---------------- 6. Why an I/O module needs buffers ---------------- */
      {
        title: 'Inside an I/O module: why buffers matter',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const TEXT = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG ';
          const TICK = 400; // one key every 0.4 s
          let B = 4, P = 5, tick = 0, pos = 0, buf = [], typed = [], mem = '', nTyped = 0, nOk = 0, nLost = 0, running = false, event = '';
          const show = (c) => (c === ' ' ? '␣' : c);
          const formula = h('div', { class: 'card tight s6-formula', 'aria-live': 'polite' });
          const keycap = h('div', { class: 's6-key mono' }, '·');
          const slots = h('div', { class: 's6-slots' });
          const fillTxt = h('div', { class: 'xs muted b' });
          const meter = h('div', { class: 'meter' }, h('i', { style: { width: '0%' } }));
          const cpuTxt = h('div', { class: 'small' });
          const typedLine = h('div', { class: 'mono s6-line' });
          const memLine = h('div', { class: 'mono s6-line' });
          const stats = h('div', { class: 'row s6-stats' });
          const cap = h('div', { class: 'player-cap s6-cap', 'aria-live': 'polite' });
          const bRun = h('button', { type: 'button', class: 'btn sm primary', onclick: () => { running = !running; paint(); } });
          const bStep = h('button', { type: 'button', class: 'btn sm', onclick: () => { running = false; step(); } }, 'One key ▸');
          const bReset = h('button', { type: 'button', class: 'btn sm', onclick: () => reset() }, 'Reset');
          const segB = ctx.ui.seg([{ value: 1, label: '1 slot' }, { value: 4, label: '4 slots' }, { value: 8, label: '8 slots' }], B, (v) => { B = v; reset(); });
          const segP = ctx.ui.seg([{ value: 3, label: '1.2 s' }, { value: 5, label: '2 s' }, { value: 8, label: '3.2 s' }], P, (v) => { P = v; reset(); });
          function step() {
            tick++;
            const rec = { ch: TEXT[pos % TEXT.length], st: 'buf' }; pos++; nTyped++;
            typed.push(rec); if (typed.length > 40) typed.shift();
            if (buf.length < B) { buf.push(rec); event = `Key <b class="mono">${show(rec.ch)}</b> arrives and waits in the buffer.`; }
            else { rec.st = 'lost'; nLost++; event = `<b style="color:var(--bad)">Buffer full!</b> Key <b class="mono">${show(rec.ch)}</b> had nowhere to wait and was lost.`; }
            if (tick % P === 0) {
              const n = buf.length;
              buf.forEach((r) => { r.st = 'ok'; mem += r.ch; }); nOk += n; buf = [];
              if (mem.length > 40) mem = mem.slice(-40);
              event += ` <b style="color:var(--cpu)">Processor visit:</b> it empties all ${n} waiting key${n === 1 ? '' : 's'} through the I/O BR into memory, then goes back to other work.`;
            }
            paint();
          }
          function reset() {
            tick = 0; pos = 0; buf = []; typed = []; mem = ''; nTyped = 0; nOk = 0; nLost = 0;
            event = 'Press <b>Start typing</b>, or <b>One key</b> to go slowly. The typist never waits: keys arrive whether or not anyone is ready for them.';
            paint();
          }
          function paint() {
            const lost = Math.max(0, P - B);
            formula.innerHTML = `Between two visits <b>${P} keys</b> arrive (${(P * TICK / 1000).toFixed(1)} s ÷ 0.4 s). The buffer holds <b>${B}</b>. ` +
              (lost ? `So <b style="color:var(--bad)">${lost} of every ${P}</b> keys are lost (${Math.round((lost / P) * 100)}%).` : `Everything fits, so <b style="color:var(--ok)">no key is lost</b>.`);
            keycap.textContent = typed.length ? show(typed[typed.length - 1].ch) : '·';
            keycap.classList.toggle('lost', !!typed.length && typed[typed.length - 1].st === 'lost');
            slots.className = 's6-slots' + (B === 8 ? ' eight' : B === 1 ? ' one' : '');
            slots.innerHTML = Array.from({ length: B }, (_, k) => `<span class="${buf[k] ? 'full' : ''}">${buf[k] ? show(buf[k].ch) : ''}</span>`).join('');
            fillTxt.textContent = `${buf.length} of ${B} slots full`;
            meter.firstChild.style.width = ((tick % P) / P) * 100 + '%';
            cpuTxt.innerHTML = tick > 0 && tick % P === 0 ? '<b style="color:var(--cpu)">Collecting now!</b>' : `Next visit in ${P - (tick % P)} key${P - (tick % P) === 1 ? '' : 's'}`;
            typedLine.innerHTML = '<span class="lbl">typed</span>' + typed.map((r) => `<span class="c-${r.st}">${show(r.ch)}</span>`).join('');
            memLine.innerHTML = '<span class="lbl">in memory</span>' + [...mem].map((c) => `<span class="c-ok">${show(c)}</span>`).join('');
            stats.innerHTML = `<span class="chip">typed ${nTyped}</span><span class="chip ok">delivered ${nOk}</span><span class="chip bad">lost ${nLost}</span><span class="chip warn">waiting ${buf.length}</span>`;
            cap.innerHTML = event;
            bRun.innerHTML = running ? 'Pause' : '▶ Start typing';
          }
          ctx.every(TICK, () => { if (running) step(); });
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'An <span class="t">I/O module</span> sits between the fast processor and a slow, unpredictable outside world.' }),
              h('p', { class: 'm0', html: 'It moves data both ways: from external devices into the processor and memory, and back out again. Inside it are small <span class="t">buffers</span>: holding areas where data waits until the other side is ready.' }),
              h('div', { class: 'callout why m0', 'data-label': 'Why buffers?', html: 'A typist manages a few keys per second; the processor does billions of steps per second and has other work. A key that arrives while the processor is busy elsewhere must wait somewhere, or it is lost. Output is the reverse: the processor drops a whole line into a printer module’s buffer at once and moves on while the printer catches up.' }),
              formula,
              h('p', { class: 'small muted m0' }, 'Try 4 slots and 2 s, then change one setting at a time and watch the lost count.')),
            h('div', { class: 'card white stack s6-sim' },
              h('div', { class: 'grid-2 s6-ctl' }, h('div', { class: 'stack gap-s' }, h('span', { class: 'xs muted b' }, 'BUFFER SIZE IN THE I/O MODULE'), segB), h('div', { class: 'stack gap-s' }, h('span', { class: 'xs muted b' }, 'PROCESSOR VISITS EVERY'), segP)),
              h('div', { class: 's6-flow' },
                h('div', { class: 's6-box dev' }, h('h4', {}, 'Keyboard'), keycap, h('div', { class: 'xs muted' }, 'one key every 0.4 s')),
                h('div', { class: 's6-arr' }, ctx.narrow ? '↓' : '→'),
                h('div', { class: 's6-box io' }, h('h4', {}, 'I/O module buffer'), slots, fillTxt),
                h('div', { class: 's6-arr' }, ctx.narrow ? '↓' : '→'),
                h('div', { class: 's6-box cpu' }, h('h4', {}, 'Processor'), cpuTxt, meter, h('div', { class: 'xs muted' }, 'empties the whole buffer at each visit'))),
              h('div', { class: 'card tight stack gap-s' }, typedLine, memLine),
              stats, cap,
              h('div', { class: 'row', style: { marginTop: 'auto' } }, bRun, bStep, bReset, h('span', { class: 'small muted' }, 'Time is slowed right down so you can watch.')))));
          reset();
        },
      },
      /* ---------------- 7. Volatile main memory vs permanent disk ---------------- */
      {
        title: 'Pull the plug: memory forgets, the disk remembers',
        kind: 'compare',
        html: `
          <div class="split l fill">
            <div class="stack">
              <p class="lead m0">Switch a computer off and main memory forgets everything. That is what <span class="t">volatile memory</span> means.</p>
              <p class="m0">Main memory needs power to hold its bits. A disk is <span class="t">secondary memory</span>: much slower, but it keeps its data with the power off. The processor reaches the disk only through an I/O module.</p>
              <table class="tbl compact">
                <tr><th></th><th>Main memory</th><th>Disk</th></tr>
                <tr><td class="b">Survives power-off?</td><td style="color:var(--bad)" class="b">No (volatile)</td><td style="color:var(--ok)" class="b">Yes</td></tr>
                <tr><td class="b">Speed</td><td>fast</td><td>far slower</td></tr>
                <tr><td class="b">Typical size</td><td>gigabytes</td><td>hundreds of GB and up</td></tr>
                <tr><td class="b">Processor reaches it</td><td>over the bus</td><td>via an I/O module</td></tr>
              </table>
              <div class="callout warn m0" data-label="Common mistake">Mixing up “memory” and “storage”. A laptop sold with 16 GB memory and 512 GB storage has 16 GB of main memory (volatile) and a 512 GB drive (secondary memory, such as a disk).</div>
            </div>
            <div class="card white stack s7-sim"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const sim = el.querySelector('.s7-sim');
          const WORDS = ['and', 'eggs', 'then', 'bread'];
          let power, booted, note, saved, wi, lostWords, bootId = 0;
          const status = h('span', { class: 'chip' });
          const bPower = h('button', { type: 'button', class: 'btn sm', onclick: () => togglePower() });
          const memGrid = h('div', { class: 's7-cells' });
          const disk = h('div', { class: 'stack gap-s s7-disk' });
          const ioBox = h('div', { class: 's7-io' }, h('b', {}, 'I/O'), h('span', { class: 'xs' }, 'module'), h('span', { class: 's7-arrows' }, '⇄'));
          const cap = h('div', { class: 'player-cap s7-cap', 'aria-live': 'polite' });
          const bType = h('button', { type: 'button', class: 'btn sm', onclick: () => typeWord() }, 'Type a word');
          const bSave = h('button', { type: 'button', class: 'btn sm mem', onclick: () => save() }, 'Save to disk');
          const bOpen = h('button', { type: 'button', class: 'btn sm io', onclick: () => openNote() }, 'Open note from disk');
          const bReset = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => reset() }, 'Reset');
          sim.append(
            h('div', { class: 'row' }, bPower, status, h('span', { class: 'grow' }), bReset),
            h('div', { class: 's7-flow' },
              h('div', { class: 'card mem tight stack gap-s' }, h('h4', { class: 'm0' }, 'Main memory (8 cells)'), memGrid),
              ioBox,
              h('div', { class: 'card io tight stack gap-s' }, h('h4', { class: 'm0' }, 'Disk (secondary memory)'), disk)),
            h('div', { class: 'row gap-s' }, h('span', { class: 'chip os' }, 'OS'), h('span', { class: 'chip proc' }, 'program'), h('span', { class: 'chip mem' }, 'your note (data)'), h('span', { class: 'chip warn' }, 'dashed = not saved yet')),
            h('div', { class: 'row' }, bType, bSave, bOpen), cap,
            h('div', { class: 'callout why m0', 'data-label': 'Why the OS cares', html: 'Memory is volatile, so every start-up must first copy the OS from the disk into memory, and “saving” means copying your data out through an I/O module.' }));
          function paint() {
            status.className = 'chip ' + (power ? 'ok' : 'bad');
            status.textContent = power ? (booted ? 'Power on · running' : 'Power on · starting up…') : 'Power off';
            bPower.innerHTML = power ? 'Switch off' : 'Switch on';
            bPower.className = 'btn sm ' + (power ? 'danger' : 'primary');
            const cells = [];
            for (let a = 0; a < 8; a++) {
              let t = '', cls = 'empty';
              if (!power) { t = ''; cls = 'dead'; }
              else if (a < 2 && booted) { t = 'OS'; cls = 'os'; }
              else if (a < 4 && booted) { t = 'editor'; cls = 'prog'; }
              else if (a >= 4 && note && note[a - 4] != null) { t = note[a - 4]; cls = 'word' + (saved[a - 4] === t ? '' : ' unsaved'); }
              cells.push(`<div class="s7-cell ${cls}"><span class="xs muted">${a}</span><b>${ctx.util.esc(t) || (power ? '' : '·')}</b></div>`);
            }
            memGrid.innerHTML = cells.join('');
            disk.innerHTML = `<div class="s7-file"><b>OS files</b><span class="xs muted">always there</span></div><div class="s7-file"><b>editor</b><span class="xs muted">program</span></div>` +
              `<div class="s7-file"><b>note.txt</b><span class="small mono">${saved.length ? ctx.util.esc(saved.join(' ')) : '<span class="muted">(empty)</span>'}</span></div>`;
            const on = power && booted;
            bType.disabled = !on || !note || note.length >= 4; bSave.disabled = !on || !note; bOpen.disabled = !on;
          }
          function say(t) { cap.innerHTML = t; }
          function typeWord() {
            if (!note || note.length >= 4) return;
            note.push(WORDS[wi % WORDS.length]); wi++;
            say(`You typed “${note[note.length - 1]}”. It exists only in main memory for now (dashed = <b>not saved</b>).`);
            paint();
          }
          function save() {
            saved = note.slice();
            ioBox.classList.remove('flash'); void ioBox.offsetWidth; ioBox.classList.add('flash');
            say('<b>Saved.</b> The processor sent the note through the I/O module to the disk. That copy will survive a power cut.');
            paint();
          }
          function openNote() {
            note = saved.slice();
            ioBox.classList.remove('flash'); void ioBox.offsetWidth; ioBox.classList.add('flash');
            say(`<b>Opened.</b> The note came back from the disk into memory: “${saved.join(' ')}”.` + (lostWords.length ? ` The words <b style="color:var(--bad)">${lostWords.map((w) => '“' + w + '”').join(' ')}</b> were never saved, so they are gone for good.` : ''));
            paint();
          }
          function togglePower() {
            if (power) {
              lostWords = (note || []).filter((w, i) => saved[i] !== w);
              power = false; booted = false; note = null;
              say('<b>Power off.</b> All 8 cells of main memory lost their contents, even the OS itself. The disk kept everything that had been saved.' + (lostWords.length ? ` Unsaved words lost: <b style="color:var(--bad)">${lostWords.join(', ')}</b>.` : ''));
            } else {
              power = true; booted = false; const id = ++bootId;
              say('<b>Power on.</b> Main memory starts out with nothing useful in it. The computer must copy the OS and the editor back in from the disk…');
              ctx.after(900, () => { if (id !== bootId || !power) return; booted = true; say('<b>Started.</b> The OS and the editor were copied from the disk into memory. Your note is <i>not</i> in memory any more: open it from the disk.'); paint(); });
            }
            paint();
          }
          function reset() {
            bootId++; power = true; booted = true; note = ['Buy', 'milk']; saved = ['Buy', 'milk']; wi = 0; lostWords = [];
            say('The note “Buy milk” is open in memory and also saved on the disk. <b>Type a word or two</b>, then switch the power off without saving. What do you predict will survive?');
            paint();
          }
          reset();
        },
      },
      /* ---------------- 8. Recap + kitchen match-up ---------------- */
      {
        title: 'Recap: six ideas, then a kitchen match-up',
        kind: 'recap',
        html: `
          <div class="split l fill">
            <div class="stack gap-s">
              <h3 class="m0">Six things to remember</h3>
              <div class="s8-pt"><i>1</i><div><b>Four elements.</b> A computer is a processor, main memory and I/O modules, joined by the system bus, all working together to execute programs.</div></div>
              <div class="s8-pt"><i>2</i><div><b>Processor (CPU).</b> Controls the whole machine and does all the data processing, using a few fast registers such as the PC and IR.</div></div>
              <div class="s8-pt"><i>3</i><div><b>Where vs what.</b> The MAR (a memory cell) and I/O AR (a device) say <i>where</i>; the MBR and I/O BR carry the data itself.</div></div>
              <div class="s8-pt"><i>4</i><div><b>Main memory.</b> Cells numbered 0 to n − 1, each holding a bit pattern that may be an instruction or data. Volatile: wiped at power-off.</div></div>
              <div class="s8-pt"><i>5</i><div><b>I/O modules.</b> Move data between devices (disks, network equipment, terminals) and the processor or memory, using internal buffers.</div></div>
              <div class="s8-pt"><i>6</i><div><b>System bus.</b> The shared path that carries addresses, data and control signals between every part.</div></div>
            </div>
            <div class="card white stack s8-game"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const game = el.querySelector('.s8-game');
          const PAIRS = [
            ['Processor (CPU)', 'The chef, who reads each step and does all the cooking', 'it carries out the instructions of every program'],
            ['Main memory', 'The counter: holds what is in use, wiped clean at closing time', 'it holds what is in use right now and is volatile'],
            ['Disk (secondary memory)', 'The storeroom: huge, keeps things overnight, slow to reach', 'it is big, permanent and slow'],
            ['I/O module', 'The pass window, with a shelf where orders and plates wait', 'it links to the outside world and has buffers'],
            ['System bus', 'The one shared aisle that every trip must use', 'it is the path shared by every part'],
            ['MAR', 'A slip naming which numbered counter spot to use', 'it holds a <i>where</i>'],
            ['MBR', 'The tray carrying an item to or from that spot', 'it holds a <i>what</i>'],
          ];
          const ORDER = [4, 2, 6, 0, 5, 3, 1]; // fixed shuffle of the analogies, so no row gives its partner away
          let selL = -1, selR = -1, done = new Set();
          const score = h('span', { class: 'chip accent' });
          const colL = h('div', { class: 'stack gap-s' });
          const colR = h('div', { class: 'stack gap-s' });
          const fb = h('div', { class: 'player-cap s8-fb', 'aria-live': 'polite' });
          const bReset = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { selL = selR = -1; done = new Set(); say('Pick a part on the left, then the kitchen job on the right that matches it.'); paint(); } }, 'Start over');
          game.append(h('div', { class: 'row' }, h('h3', { class: 'm0' }, 'Kitchen match-up'), score, h('span', { class: 'grow' }), bReset),
            h('div', { class: 's8-cols' }, colL, colR), fb);
          const say = (t, cls) => { fb.innerHTML = t; fb.className = 'player-cap s8-fb' + (cls ? ' ' + cls : ''); };
          // build the buttons once; paint() only updates their state
          const btnL = PAIRS.map((p, i) => h('button', { type: 'button', class: 's8-it l', onclick: () => { selL = i; check(); } }));
          const btnR = PAIRS.map((p, i) => h('button', { type: 'button', class: 's8-it r', onclick: () => { selR = i; check(); } }, p[1]));
          colL.append(...btnL); colR.append(...ORDER.map((i) => btnR[i]));
          function paint() {
            PAIRS.forEach((p, i) => {
              const ok = done.has(i);
              btnL[i].className = 's8-it l' + (ok ? ' ok' : selL === i ? ' on' : ''); btnL[i].disabled = ok; btnL[i].textContent = (ok ? '✓ ' : '') + p[0];
              btnR[i].className = 's8-it r' + (ok ? ' ok' : selR === i ? ' on' : ''); btnR[i].disabled = ok;
            });
            score.textContent = `${done.size} / ${PAIRS.length} matched`;
          }
          function check() {
            if (selL >= 0 && selR >= 0) {
              if (selL === selR) {
                done.add(selL);
                say(done.size === PAIRS.length ? '<b style="color:var(--ok)">All seven matched!</b> Kitchen and computer share one design: one worker who acts, fast space for work in progress, slow permanent storage, a hatch to the outside, one shared path.' : `<b style="color:var(--ok)">✓ Match.</b> ${PAIRS[selL][0]} ↔ ${PAIRS[selL][1].charAt(0).toLowerCase() + PAIRS[selL][1].slice(1)}.`, done.size === PAIRS.length ? 'good' : '');
              } else {
                say(`<b style="color:var(--bad)">Not quite.</b> Think about what the ${PAIRS[selL][0]} does: ${PAIRS[selL][2]}. That kitchen job fits the <b>${PAIRS[selR][0]}</b> better.`, 'bad');
              }
              selL = selR = -1;
            }
            paint();
          }
          say('Pick a part on the left, then the kitchen job on the right that matches it.');
          paint();
        },
      },
      /* ---------------- 9. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Which structural element controls the operation of the computer and performs its data processing?',
            choices: ['Main memory', 'The processor', 'The system bus', 'An I/O module'], answer: 1,
            feedback: ['Main memory stores programs and data, but it never acts on them.', null, 'The bus only carries signals between the other parts.', 'An I/O module moves data to and from external devices; it does not run programs.'],
            why: 'The processor (usually called the CPU when there is only one) runs programs by carrying out their instructions, and in doing so it controls the machine and performs the data processing. Memory stores, the bus carries, and I/O modules deal with devices.' },
          { type: 'multi', q: 'Which of these are among the four main structural elements of a computer?',
            choices: ['Processor', 'Main memory', 'I/O modules', 'System bus', 'The operating system', 'The keyboard'], answer: [0, 1, 2, 3],
            why: 'The four structural elements are the processor, main memory, I/O modules and the system bus. The operating system is software that runs on them, and a keyboard is an external device reached through an I/O module.' },
          { type: 'match', q: 'Match each register to what it holds.',
            pairs: [['MAR', 'The address of the memory cell for the next read or write'], ['MBR', 'Data just read from memory, or about to be written to it'], ['I/O AR', 'The number of the particular I/O device being addressed'], ['I/O BR', 'Data passing between an I/O module and the processor'], ['PC', 'The address of the next instruction to fetch']],
            why: 'Address registers (MAR, I/O AR, and the PC for instructions) say <i>where</i>; buffer registers (MBR, I/O BR) carry the data itself.' },
          { type: 'tf', q: 'Main memory keeps its contents when the computer is switched off.', answer: false,
            why: 'Main memory is usually volatile: without power its bits are lost. Anything that must survive a shutdown has to be saved to secondary memory, such as a disk.' },
          { type: 'num', q: 'A main memory has 4096 locations, numbered in the usual way. What is the address of the last location?', answer: 4095, tol: 0,
            why: 'Addresses start at 0, so n locations have addresses 0 to n − 1. With n = 4096 the last address is 4096 − 1 = 4095.' },
          { type: 'num', q: 'A memory uses 10-bit addresses, and every possible address names a cell. How many cells can it have?', answer: 1024, tol: 0, unit: 'cells',
            why: 'Each extra address bit doubles the count, so k bits give 2<sup>k</sup> addresses. 2<sup>10</sup> = 1024 cells, numbered 0 to 1023.' },
          { type: 'order', q: 'Put the steps of a memory read in order.',
            items: ['The processor places the cell’s address in the MAR', 'The address goes out on the bus with a READ control signal', 'Memory places a copy of that cell’s contents on the data lines', 'The value arrives in the MBR, ready for the processor to use'],
            why: 'The <i>where</i> goes out first (MAR → address lines, with READ); then the <i>what</i> comes back (data lines → MBR). Reading leaves the cell unchanged.' },
          { type: 'bucket', q: 'Where is each thing found?', buckets: ['Processor', 'Main memory', 'I/O module'],
            items: [['The MAR', 0], ['A running program’s instructions', 1], ['A key press waiting in a buffer', 2], ['The I/O BR', 0], ['The OS, once loaded at start-up', 1], ['Control logic for one kind of device', 2]],
            why: 'Registers such as the MAR and I/O BR live inside the processor; running programs (the operating system included) live in main memory; an I/O module holds data in transit in its buffers and handles the details of its own device.' },
          { q: 'A memory cell holds the bit pattern <span class="mono">0001 0000 0000 1000</span>. What is it?',
            choices: ['An instruction, because it starts with 0001', 'Data, because every bit pattern is a number', 'It could be an instruction or data; it depends on how the processor uses it', 'The cell’s own address, because every cell stores its address'], answer: 2,
            feedback: ['Those first bits could name an operation, but the very same bits could be the number 4104. Nothing in the pattern says which.', 'The same bits could equally be fetched and carried out as an instruction.', null, 'A cell does not store its own address. The address is the cell’s position number; the contents are whatever bits were last written there.'],
            why: 'Memory cells hold plain bit patterns. A pattern acts as an instruction if the processor fetches it as one, and as data if a program reads it as a value.' },
          { q: 'The processor wants to send the letter A to the printer. Which registers does it fill?',
            choices: ['MAR with the printer’s number and MBR with the letter', 'I/O AR with the printer’s device number and I/O BR with the letter', 'PC with the printer’s number and IR with the letter', 'I/O BR with the printer’s number and I/O AR with the letter'], answer: 1,
            feedback: ['The MAR/MBR pair is used for memory cells, not for devices.', null, 'The PC and IR steer the program’s own instructions; they are not used to exchange data with devices.', 'Swapped. The address register (I/O AR) says which device; the buffer register (I/O BR) carries the data.'],
            why: 'For I/O the processor uses the I/O pair: the I/O AR names the particular device (where) and the I/O BR holds the data being exchanged (what).' },
          { q: 'Why does an I/O module contain internal buffers?',
            choices: ['To store files permanently while the power is off', 'To hold data briefly until the other side (processor or device) is ready to take it', 'To make the external device itself run faster', 'To hold the instructions of the program that is running'], answer: 1,
            feedback: ['Permanent storage is secondary memory, such as a disk. Buffers are temporary holding areas.', null, 'A buffer cannot speed up a device; it only lets the fast side and the slow side each work at their own pace.', 'Running programs live in main memory, not in I/O modules.'],
            why: 'Processors and devices work at very different speeds and moments. A buffer lets data wait briefly, so neither side has to be ready at exactly the same instant and nothing is lost.' },
          { type: 'multi', q: 'Which of these are part of the external environment that I/O modules connect a computer to?',
            choices: ['A disk drive', 'A network card (communications equipment)', 'A keyboard and screen (a terminal)', 'Main memory', 'The MBR'], answer: [0, 1, 2],
            why: 'The external environment includes secondary memory devices such as disks, communications equipment and terminals. Main memory and the processor’s registers are inside the computer itself; the processor reaches main memory directly over the system bus.' },
        ],
      },
    ],
    notes: `
<h3>1. Four parts that work as a team</h3>
<p>A computer consists of processor, memory and I/O components, connected so they can work together to <b>execute</b> (run) <b>programs</b>. At the top level there are four main structural elements:</p>
<ul>
<li><b>Processor.</b> Controls the operation of the whole computer and performs its data processing. It runs programs by fetching their instructions and carrying them out. When a machine has just one processor it is usually called the <b>central processing unit (CPU)</b>.</li>
<li><b>Main memory.</b> Stores the programs being run and the data they use. It is usually <b>volatile</b>: when the power goes off, its contents are lost. Also called <b>real memory</b> or <b>primary memory</b>.</li>
<li><b>I/O modules.</b> Move data between the computer and its <b>external environment</b>, in both directions. It consists of devices: <b>secondary memory devices</b> such as disks, <b>communications equipment</b> such as network cards, and <b>terminals</b> (keyboard and screen).</li>
<li><b>System bus.</b> Provides communication among the processor(s), main memory and the I/O modules. It carries <b>address</b> signals (where), <b>data</b> (what) and <b>control</b> signals (read or write, and when).</li>
</ul>
<svg viewBox="0 0 520 168" width="520" font-size="13">
<rect x="4" y="28" width="192" height="132" rx="10" fill="#e1eaff" stroke="#2563eb"/><rect x="212" y="4" width="26" height="160" rx="6" fill="#e8e7fd" stroke="#4f46e5"/>
<rect x="254" y="4" width="262" height="86" rx="10" fill="#d7f5e8" stroke="#059669"/><rect x="254" y="100" width="262" height="64" rx="10" fill="#ffe8d6" stroke="#ea580c"/>
<path d="M196 94h16M238 47h16M238 132h16" stroke="#3d4760" stroke-width="3"/>
<text x="14" y="48" font-weight="bold" style="fill:#2563eb">PROCESSOR (CPU)</text><text x="14" y="72" style="fill:#151c2c">PC, IR (run the program)</text><text x="14" y="94" style="fill:#151c2c">MAR, MBR (memory pair)</text><text x="14" y="116" style="fill:#151c2c">I/O AR, I/O BR (I/O pair)</text><text x="14" y="138" style="fill:#151c2c">execution unit</text>
<text x="225" y="84" transform="rotate(-90 225 84)" text-anchor="middle" font-weight="bold" style="fill:#4f46e5">SYSTEM BUS</text>
<text x="264" y="24" font-weight="bold" style="fill:#059669">MAIN MEMORY: cells 0 … n − 1</text><text x="264" y="46" style="fill:#151c2c">each cell: bits (instruction or data)</text><text x="264" y="68" style="fill:#151c2c">volatile; also real or primary memory</text>
<text x="264" y="124" font-weight="bold" style="fill:#ea580c">I/O MODULE (with buffers)</text><text x="264" y="146" style="fill:#151c2c">→ disks, network equipment, terminals</text>
</svg>
<h3>2. Registers inside the processor</h3>
<p>A <b>register</b> is a tiny, very fast storage slot inside the processor. The <b>program counter (PC)</b> holds the address of the next instruction to fetch and the <b>instruction register (IR)</b> holds the instruction being carried out (Section 1.3). The <b>execution unit</b> does the arithmetic, comparisons and moves. A real processor has many more registers, but four exist only to exchange data with the rest of the machine:</p>
<table><tr><th></th><th>Where (address)</th><th>What (data)</th></tr>
<tr><td><b>Memory</b></td><td><b>MAR</b> (memory address register): the address in memory for the next read or write</td><td><b>MBR</b> (memory buffer register): the data to be written into memory, or the data just read from it</td></tr>
<tr><td><b>I/O</b></td><td><b>I/O AR</b> (I/O address register): specifies a particular I/O device</td><td><b>I/O BR</b> (I/O buffer register): the data exchanged between an I/O module and the processor</td></tr></table>
<p>An address register never holds the data, and a buffer register never says where: the number 9 is a place in the MAR but a value in the MBR. Memory uses the MAR/MBR pair; devices use the I/O AR/I/O BR pair.</p>
<h3>3. Main memory as numbered cells</h3>
<p>Main memory is a set of locations numbered one after another. Each number is the location’s <b>address</b>; with n locations the addresses run from <b>0 to n − 1</b>. Each location holds a binary number, a pattern of <b>bits</b>, that can be an <b>instruction</b> or <b>data</b>. The bits do not label themselves: a pattern is an instruction if the processor fetches it as one, and data if a program uses it as a value. For example, 0001 0000 0000 1000 (hex 1008; one hex digit stands for 4 bits) is the number 4104, but in a toy machine whose instructions use the first 4 bits for the operation and the last 12 for a cell number it means “load from cell 8”. A cell is never truly empty; it always holds some bits. (Toy cells here hold 16 bits; real machines usually give each 8-bit byte its own address.)</p>
<p><b>Reading hex.</b> Long bit patterns are easier to read in <b>hexadecimal</b> (base 16). Each hex digit stands for exactly 4 bits and counts 0–9 and then A–F, where A = 10 and F = 15. Each place is worth 16 times the place to its right, so hex 0019 = 1×16 + 9 = 25, hex 0011 = 17 and hex 002A = 2×16 + 10 = 42: the toy program’s 25 + 17 = 42, written in hex. <b>Text</b> is stored as numbers too: each letter has a number code (H = 72, i = 105), so the 16 bits of hex 4869 can also be read as the two letters “Hi”. If the first hex digit of a word is not an operation the machine knows, the word cannot run as an instruction and can only be data.</p>
<p><b>Worked examples.</b> k address bits give 2<sup>k</sup> addresses. 5 bits → 2<sup>5</sup> = 32 cells, addresses 0 to 31. 10 bits → 1024 cells, 0 to 1023. A memory with 4096 locations has last address 4096 − 1 = 4095. Classic mistakes: saying the last address is n (it is n − 1), and confusing a cell’s address with its contents.</p>
<h3>4. Following the data over the bus</h3>
<ol>
<li><b>Memory read:</b> address → MAR; it goes out on the address lines with a READ signal; memory puts a copy of the cell’s contents on the data lines; the value lands in the MBR. The cell is unchanged.</li>
<li><b>Memory write:</b> address → MAR and value → MBR; address, data and WRITE go out together; memory stores the value; the old contents are gone.</li>
<li><b>Output to a device:</b> device number → I/O AR, data → I/O BR; the bus carries them with an I/O WRITE signal; only the module whose number matches takes the data into its buffer, then feeds the device at its own pace.</li>
<li><b>Input into memory:</b> device number → I/O AR with I/O READ; the module puts the buffered item on the data lines; it arrives in the I/O BR; the processor then writes it to memory using the MAR and MBR. (DMA, Section 1.7, spares the processor this chore.)</li>
</ol>
<h3>5. Why I/O modules have buffers</h3>
<p>An I/O module transfers data from external devices to the processor and memory, and back the other way. Devices are slow and unpredictable while the processor is fast and busy elsewhere, so the module holds data in <b>internal buffers</b> until the other side is ready. It also holds the control logic for its kind of device, sparing the processor the details. <b>Worked example:</b> one key arrives every 0.4 s and the processor empties the buffer every 2 s, so 2 ÷ 0.4 = 5 keys arrive between visits. A 4-slot buffer loses 5 − 4 = 1 key per visit (20%); an 8-slot buffer loses none. Output is the reverse: the processor drops a burst into the buffer at full speed and moves on while the module feeds the slow device. A buffer is temporary, not permanent storage.</p>
<h3>6. Volatile memory versus secondary memory</h3>
<table><tr><th></th><th>Main memory</th><th>Disk (secondary memory)</th></tr>
<tr><td>Keeps data without power?</td><td>No (volatile)</td><td>Yes</td></tr>
<tr><td>Speed</td><td>Fast</td><td>Far slower</td></tr>
<tr><td>Typical size</td><td>Gigabytes</td><td>Hundreds of GB and up</td></tr>
<tr><td>How the processor reaches it</td><td>Directly over the system bus</td><td>Through an I/O module</td></tr></table>
<p>Anything not saved to secondary memory is lost at power-off, even the OS, so every start-up begins by copying the OS from disk into main memory. In “16 GB memory, 512 GB storage”, the first figure is main memory and the second is secondary memory.</p>
<h3>7. The kitchen analogy</h3>
<p>Processor = the chef, who carries out every recipe step. Main memory = the counter: what is in use now, wiped at closing. Disk = the storeroom: huge, keeps things overnight, slow to reach. I/O module = the pass window, whose shelf (the buffer) lets orders and plates wait. System bus = the one shared aisle every trip uses. MAR = a slip naming a counter spot; MBR = the tray carrying the item.</p>`,
  });
})();
