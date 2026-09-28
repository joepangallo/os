// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 1.1 — Basic Elements
   The four structural elements of a computer (processor, main memory,
   I/O modules, system bus), the registers the processor uses to exchange
   data with memory and I/O, memory as numbered cells, buffers, volatility.
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  'use strict';  // turns on strict mode: the browser reports common mistakes as errors instead of silently ignoring them

  /* ---------- small shared helpers ---------- */
  const bits = (n, w) => (n >>> 0).toString(2).padStart(w, '0').slice(-w);  // bits(n, w): writes the number n as w binary digits (e.g. 5 → "0101"), keeping only the last w digits
  const nib = (s) => s.replace(/(.{4})(?=.)/g, '$1 ');  // nib(s): puts a space after every group of 4 bits so long binary strings are easier to read
  const hex4 = (n) => (n >>> 0).toString(16).toUpperCase().padStart(4, '0').slice(-4);  // hex4(n): writes n as exactly 4 uppercase hexadecimal digits, the way the memory display shows words

  /* ---------- "follow the data" scenarios for step 5 ----------
     Each delta changes the machine state; registers, memory, buffers and the printer
     persist from frame to frame, while bus traffic (L), highlights and captions do not.
     L = { a: [text, dir], d: [...], c: [...] }  dir 'r' = away from the processor, 'l' = towards it. */
  const MEM0 = [12, 40, 7, 15, 3, 0, 77, 0];  // starting contents of the 8 memory cells (addresses 0-7) used by the step 5 animation
  const FLOWS = {  // FLOWS: the four animated scenarios for step 5, keyed by name: read, write, out and in
    read: { x: 504, steps: [  // scenario "read": the processor reads memory cell 6; x is where the arrows leave the processor in the drawing
      { cap: '<b>Goal:</b> the processor needs the number stored in memory cell 6. It cannot reach into memory itself; it has to ask over the system bus.' },  // frame 1 caption: states the goal before anything moves
      { reg: { mar: 6 }, chg: ['mar'], cap: '<b>Address into the MAR.</b> The processor puts the cell number, 6, into the memory address register. The MAR only ever holds a <i>where</i>.' },  // frame 2: 6 goes into the MAR (chg lists the registers to highlight as just changed)
      { L: { a: ['6', 'r'], c: ['READ', 'r'] }, cell: 6, cap: '<b>Request on the bus.</b> The 6 goes out on the address lines and the control lines say READ. Memory recognises the request and finds cell 6.' },  // frame 3: the address and a READ signal travel out on the bus (L = what each bus line carries, r = away from the CPU)
      { L: { d: ['77', 'l'] }, cell: 6, cap: '<b>Memory answers.</b> Memory copies the contents of cell 6, the value 77, onto the data lines. Reading erases nothing: cell 6 still holds 77.' },  // frame 4: memory puts the value 77 on the data lines, heading back toward the processor (l)
      { reg: { mbr: 77 }, chg: ['mbr'], exec: 'has 77 to use', cap: '<b>Data in the MBR.</b> The value lands in the memory buffer register. Now the execution unit can work with it, for example by adding it to another number.' },  // frame 5: 77 arrives in the MBR and the execution unit can use it
    ] },  // closes the frame list and the "read" scenario
    write: { x: 504, steps: [  // scenario "write": the processor stores 42 into memory cell 3
      { cap: '<b>Goal:</b> store the value 42 in memory cell 3, which currently holds 15.' },  // frame 1 caption: states the goal of the write
      { reg: { mar: 3, mbr: 42 }, chg: ['mar', 'mbr'], cap: '<b>Load both registers.</b> For a write, the processor fills the MAR with the <i>where</i> (3) and the MBR with the <i>what</i> (42) before anything moves.' },  // frame 2: the where (3) goes into the MAR and the what (42) into the MBR
      { L: { a: ['3', 'r'], d: ['42', 'r'], c: ['WRITE', 'r'] }, cell: 3, cap: '<b>Everything goes out together.</b> Address 3 on the address lines, 42 on the data lines and WRITE on the control lines.' },  // frame 3: address, data and a WRITE signal all go out on the bus together
      { mem: { 3: 42 }, cell: 3, chgCell: 3, cap: '<b>Memory stores it.</b> Cell 3 now holds 42. Its old value, 15, is overwritten and gone for good: each cell keeps only the latest value written to it.' },  // frame 4: cell 3 now holds 42 (mem lists memory cells whose values change in this frame)
    ] },  // closes the "write" scenario
    out: { x: 556, steps: [  // scenario "out": the processor sends the letter H to the printer (I/O device 2)
      { cap: '<b>Goal:</b> print the letter H. The printer is I/O device 2, looked after by I/O module 2.' },  // frame 1 caption: states the goal of the output transfer
      { reg: { ioar: 2, iobr: 'H' }, chg: ['ioar', 'iobr'], cap: '<b>Load the I/O pair.</b> The processor puts the device number, 2, in the I/O AR (I/O address register) and the letter H in the I/O BR (I/O buffer register). A device number is a <i>where</i>, just like a memory address.' },  // frame 2: the device number goes into the I/O AR and the letter into the I/O BR
      { L: { a: ['dev 2', 'r'], d: ['H', 'r'], c: ['I/O WRITE', 'r'] }, mod: 2, cap: '<b>Out over the bus.</b> The control lines say I/O WRITE, so memory ignores it. Every I/O module sees the device number, but only module 2 recognises its own and takes the letter.' },  // frame 3: the letter and an I/O WRITE signal cross the bus; only module 2 accepts it
      { buf2: ['H'], mod: 2, cap: '<b>Into the buffer.</b> Module 2 holds H in its internal buffer. As far as the processor is concerned, the transfer is finished, and it can move straight on.' },  // frame 4: the letter waits in module 2's buffer (buf2), and the processor is free to move on
      { buf2: [], printed: 'H', dev: 2, cap: '<b>At the device’s own pace.</b> The module feeds H from its buffer to the printer, which is millions of times slower than the processor. The buffer is what lets the two work at different speeds.' },  // frame 5: the module feeds the letter to the printer at the printer's own slow pace
    ] },  // closes the "out" scenario
    in: { x: 396, steps: [  // scenario "in": a key press already waiting in keyboard module 1 is copied into memory cell 7
      { buf1: ['q'], cap: '<b>Goal:</b> someone pressed the q key, and keyboard module 1 already holds it in a buffer. Bring it into memory cell 7 so a program can use it.' },  // frame 1: the letter q sits in module 1's buffer (buf1) before the transfer starts
      { reg: { ioar: 1 }, chg: ['ioar'], L: { a: ['dev 1', 'r'], c: ['I/O READ', 'r'] }, mod: 1, cap: '<b>Ask device 1.</b> The processor puts 1 in the I/O AR (I/O address register). It goes out on the address lines while the control lines say I/O READ.' },  // frame 2: the processor names device 1 in the I/O AR and sends an I/O READ signal
      { buf1: [], L: { d: ['q', 'l'] }, mod: 1, cap: '<b>The module answers.</b> Module 1 takes q out of its buffer and places it on the data lines.' },  // frame 3: the module empties its buffer onto the data lines
      { reg: { iobr: 'q' }, chg: ['iobr'], cap: '<b>Into the I/O BR.</b> The key arrives in the I/O buffer register. It is inside the processor now, but registers are few and constantly reused, so it must be stored in memory.' },  // frame 4: q arrives in the I/O BR inside the processor
      { reg: { mar: 7, mbr: 'q' }, chg: ['mar', 'mbr'], x: 504, cap: '<b>Switch to the memory pair.</b> The processor copies q into the MBR and puts the target address, 7, in the MAR.' },  // frame 5: the processor moves q to the MBR and the target address 7 to the MAR
      { L: { a: ['7', 'r'], d: ['q', 'r'], c: ['WRITE', 'r'] }, cell: 7, x: 504, cap: '<b>Write to memory.</b> Address 7, data q and a WRITE signal travel over the same shared bus.' },  // frame 6: address, data and a WRITE signal go to memory over the same bus
      { mem: { 7: 'q' }, cell: 7, chgCell: 7, cap: '<b>Done.</b> The key press travelled device → I/O module → processor → main memory. (Section 1.7 shows DMA, a shortcut that spares the processor from carrying every item.)' },  // frame 7: cell 7 now holds q, which ends the journey from key to memory
    ] },  // closes the "in" scenario
  };  // closes the FLOWS table
  function flowFrames(name) {  // flowFrames(name): turns one scenario's list of changes into complete snapshots, one per animation frame
    let st = { reg: { mar: null, mbr: null, ioar: null, iobr: null }, mem: MEM0.slice(), buf1: [], buf2: [], printed: '' };  // st holds the machine state carried from frame to frame; it starts with empty registers and the MEM0 memory
    return FLOWS[name].steps.map((d) => {  // builds one snapshot for every step of the chosen scenario, in order
      st = { reg: Object.assign({}, st.reg, d.reg || {}), mem: st.mem.slice(), buf1: d.buf1 || st.buf1, buf2: d.buf2 || st.buf2, printed: d.printed != null ? d.printed : st.printed };  // carries registers, buffers and printer output forward, applying only the values this step changes
      Object.entries(d.mem || {}).forEach(([a, v]) => { st.mem[a] = v; });  // copies each changed memory cell into this frame's copy of memory
      return Object.assign({}, st, { L: d.L || {}, chg: d.chg || [], cell: d.cell ?? -1, chgCell: d.chgCell ?? -1, mod: d.mod || 0, dev: d.dev || 0, exec: d.exec || 'idle', x: d.x || FLOWS[name].x, cap: d.cap });  // returns the full snapshot plus the per-frame extras (bus traffic, highlights, caption) with safe defaults
    });  // closes the map over the steps
  }  // closes flowFrames

  Guide.section({  // registers this section with the guide; the object below holds everything the section shows
    id: '1.1',  // the section number, used in links, the progress list and saved progress
    title: 'Basic Elements',  // the full title shown at the top of every step
    short: 'Basic elements',  // the short name used in the side menu and progress list
    summary: 'Processor, main memory, I/O modules and the system bus: the four parts that team up to run a program.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Name the four main structural elements of a computer and describe the job of each one.',  // objective 1: the four structural elements
      'Explain what the MAR, MBR, I/O AR and I/O BR hold, and which pair the processor uses for memory and which for I/O.',  // objective 2: the four exchange registers
      'Describe main memory as cells numbered 0 to n − 1 whose bit patterns can be read as instructions or as data.',  // objective 3: memory as numbered cells
      'Trace how a value travels over the system bus during a memory read, a memory write and an I/O transfer.',  // objective 4: tracing data over the system bus
      'Explain why main memory is volatile and why every I/O module needs internal buffers.',  // objective 5: volatility and I/O buffers
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Processor (CPU)', 'The part of the computer that controls everything the machine does and performs its data processing. When a computer has just one processor, it is usually called the central processing unit, or CPU.'],  // glossary entry: processor (CPU)
      ['Main memory', 'The memory that holds the programs being run and the data they use, organised as a long row of numbered cells. It is usually volatile. Also called real memory or primary memory.'],  // glossary entry: main memory
      ['Volatile memory', 'Memory that loses its contents when the power is switched off. Main memory is volatile; a disk is not.'],  // glossary entry: volatile memory
      ['I/O module', 'The hardware unit that moves data between the computer and its external environment (disks, network equipment, keyboards, screens), holding data in internal buffers on the way.'],  // glossary entry: I/O module
      ['System bus', 'The shared set of wires that lets the processor, main memory and I/O modules communicate. It carries addresses (where), data (what) and control signals (read or write, and when).'],  // glossary entry: system bus
      ['Register', 'A very small, very fast storage slot inside the processor that holds one value the processor is working with right now.'],  // glossary entry: register
      ['Memory address register (MAR)', 'The processor register that holds the address of the memory cell to be read or written next.'],  // glossary entry: memory address register (MAR)
      ['Memory buffer register (MBR)', 'The processor register that holds the data about to be written into memory, or the data just read out of memory.'],  // glossary entry: memory buffer register (MBR)
      ['I/O address register (I/O AR)', 'The processor register that names the particular I/O device the processor wants to exchange data with.'],  // glossary entry: I/O address register
      ['I/O buffer register (I/O BR)', 'The processor register that holds the data travelling between the processor and an I/O module, in either direction.'],  // glossary entry: I/O buffer register
      ['Program counter (PC)', 'The processor register that holds the memory address of the next instruction to fetch.'],  // glossary entry: program counter (PC)
      ['Instruction register (IR)', 'The processor register that holds the instruction currently being carried out.'],  // glossary entry: instruction register (IR)
      ['Execution unit', 'The circuitry inside the processor that carries out the work of instructions, such as adding, comparing or moving values. A modern processor core contains several.'],  // glossary entry: execution unit
      ['Address', 'The number that identifies one memory cell (or, for I/O, one device). In a memory with n cells the addresses run from 0 to n − 1.'],  // glossary entry: address
      ['Buffer', 'A small holding area where data waits for a short time while it travels between two parts that work at different speeds or at different moments.'],  // glossary entry: buffer
      ['Secondary memory', 'Large, permanent storage such as a disk or solid-state drive. It keeps its data without power but is much slower than main memory, and the processor reaches it through an I/O module.'],  // glossary entry: secondary memory
      ['Bit', 'A binary digit: a single 0 or 1. Everything in memory, instructions and data alike, is stored as patterns of bits.'],  // glossary entry: bit
      ['Instruction', 'One basic command for the processor, such as “add these two numbers”, stored in memory as a pattern of bits.'],  // glossary entry: instruction
      ['Data', 'The values a program works on (numbers, letters, pixels and so on), stored in memory as bit patterns just like instructions.'],  // glossary entry: data
    ],  // closes the key terms list
    css: ` /* style rules used only by this section; every selector starts with .sec-1-1 so it cannot affect other sections */
      .sec-1-1 .hot { cursor: pointer; outline: none; } /* clickable parts of the diagram show a pointer cursor and no browser focus outline */
      .sec-1-1 .hot .fr { transition: stroke-width .15s; } /* a part's frame line thickens smoothly (over 0.15 s) instead of jumping */
      .sec-1-1 .hot:hover .fr, .sec-1-1 .hot:focus-visible .fr { stroke-width: 3.5; } /* hovering over a part, or reaching it with the Tab key, thickens its frame */
      .sec-1-1 .hot.sel .fr { stroke-width: 4; } /* the selected part gets the thickest frame */
      .sec-1-1 .hot.rel .fr { stroke-width: 3.5; stroke-dasharray: 7 4; } /* parts related to the selected one get a dashed frame */
      .sec-1-1 .s1-cap { min-height: 5.9em; } /* reserves room for about six lines of caption so the layout does not jump as captions change */
      .sec-1-1 .s1-panel { justify-content: center; } /* centres the content of the side panel vertically */
      .sec-1-1 .s2-info ul { padding-left: 20px; } /* step 2 info panel: indents the bullet list of key facts a little less than the browser default */
      .sec-1-1 .s3-grid { display: grid; grid-template-columns: 64px minmax(0, 1fr) minmax(0, 1fr); gap: 8px; align-items: stretch; } /* step 3 where/what table: a grid with a slim label column and two equal columns (address, then data) */
      .sec-1-1 .s3-grid .hd { font-size: 12.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); align-self: end; text-align: center; } /* column headings of the step 3 table: small, bold, uppercase grey text resting at the bottom of the cell */
      .sec-1-1 .s3-grid .side { font-weight: 800; font-size: 14.5px; align-self: center; } /* row labels of the step 3 table (Memory, I/O): bold and centred vertically in their row */
      .sec-1-1 .s3-grid .box { padding: 6px 8px; line-height: 1.3; } /* the four register boxes in the table get tighter padding so the whole table stays compact */
      .sec-1-1 .s3-grid .box .xs { font-size: 13.5px; line-height: 1.25; } /* the short description under each register name uses slightly smaller, tighter text */
      .sec-1-1 .s3-task { font-size: 17.5px; line-height: 1.45; min-height: 2.9em; } /* task sentence of the step 3 puzzle: larger text with room for two lines so the game does not shift between scenarios */
      .sec-1-1 .s3-slots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } /* the four register slots sit in a 2 x 2 grid: MAR and MBR on top, I/O AR and I/O BR below */
      .sec-1-1 .s3-slot { display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: left; padding: 8px 14px; border-radius: 12px; border: 2px dashed var(--cpu); background: var(--cpu-bg); cursor: pointer; color: var(--ink); min-height: 62px; transition: border-color .15s, background .15s; } /* each register slot is a button with a dashed processor-blue frame, its name on the left and its value on the right */
      .sec-1-1 .s3-slot:hover { border-style: solid; } /* hovering a slot makes its frame solid, a hint that it can be clicked */
      .sec-1-1 .s3-slot .nm { font-size: 17px; color: var(--cpu); } /* the register name inside a slot, in the processor colour */
      .sec-1-1 .s3-slot .val { font-size: 24px; font-weight: 800; } /* the value placed in a slot, shown large and bold */
      .sec-1-1 .s3-slot.full { border-style: solid; border-color: var(--ok); background: var(--ok-bg); } /* a slot that already holds its value: solid green frame and green background */
      .sec-1-1 .s3-slot.nope { border-style: solid; border-color: var(--bad); background: var(--bad-bg); } /* a slot flashes red for a moment when the student drops a value into the wrong register */
      .sec-1-1 .s3-tray { min-height: 58px; } /* the tray of values still to place keeps its height when empty, so the feedback box below does not jump up */
      .sec-1-1 .s3-parcel { display: inline-flex; flex-direction: column; align-items: center; gap: 0; padding: 4px 14px; border-radius: 12px; border: 2px solid var(--line-2); background: var(--panel-2); cursor: pointer; color: var(--ink); line-height: 1.3; } /* each value to place is a small rounded card-button: the value on top, its description underneath */
      .sec-1-1 .s3-parcel b { font-size: 20px; } /* the value itself, in larger bold text */
      .sec-1-1 .s3-parcel:hover { border-color: var(--accent); } /* hovering a value card turns its frame the accent colour */
      .sec-1-1 .s3-parcel.on { border-color: var(--accent); background: var(--accent-bg); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); } /* the value the student has picked up: accent frame, tinted background and a soft glow ring around it */
      .sec-1-1 .s3-fb { min-height: 4.4em; } /* feedback box under the puzzle keeps room for about three lines so the layout stays still */
      .sec-1-1 .s3-fb.bad { border-color: var(--bad); background: var(--bad-bg); } /* feedback turns red when the attempt was wrong */
      .sec-1-1 .s3-fb.good { border-color: var(--ok); background: var(--ok-bg); } /* feedback turns green once every value of a scenario is in the right register */
      .sec-1-1 .s3-dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--line-2); } /* progress dots next to the scenario chip: small hollow circles, one per scenario */
      .sec-1-1 .s3-dot.on { border-color: var(--accent); background: var(--accent); } /* the dot for the current scenario is filled with the accent colour */
      .sec-1-1 .s3-dot.done { border-color: var(--ok); background: var(--ok); } /* dots for finished scenarios are filled green */
      .sec-1-1 .s4-read { font-size: 15.5px; line-height: 1.45; } /* step 4 readout under the slider (k bits gives n cells), in slightly smaller text */
      .sec-1-1 .s4-grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 5px; } /* step 4 memory grid: eight equal columns of cells */
      .sec-1-1 .s4-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; height: 46px; padding: 0 2px; border-radius: 8px; border: 1.5px solid var(--line-2); background: var(--panel-2); cursor: pointer; color: var(--ink); line-height: 1.2; } /* each memory cell is a button with its address stacked above its contents, both centred */
      .sec-1-1 .s4-grid.roomy .s4-cell { height: 64px; } /* with only 16 cells (k = 4) each cell is taller so the grid still fills the panel */
      .sec-1-1 .s4-grid:not(.roomy):not(.dense) .s4-cell { height: 52px; } /* with 32 cells (neither roomy nor dense) each cell is 52 pixels tall */
      .sec-1-1 .s4-grid.dense { gap: 4px; } /* with 64 cells the gap between cells shrinks a little */
      .sec-1-1 .s4-grid.dense .s4-cell { flex-direction: row; gap: 5px; height: 24px; } /* with 64 cells the address and contents sit side by side on a short row so all 64 cells fit */
      .sec-1-1 .s4-cell .ad { font-size: 12.5px; color: var(--muted); font-weight: 700; } /* the address number in a cell: small, bold and grey */
      .sec-1-1 .s4-cell .ct { font-size: 13.5px; font-weight: 700; } /* the contents (the word in hex) in a cell: small and bold */
      .sec-1-1 .s4-cell.r-i { background: var(--cpu-bg); border-color: color-mix(in srgb, var(--cpu) 45%, transparent); } /* cells holding instructions are tinted processor blue, matching the "instruction" chip above the grid */
      .sec-1-1 .s4-cell.r-d { background: var(--mem-bg); border-color: color-mix(in srgb, var(--mem) 45%, transparent); } /* cells holding data are tinted memory green, matching the "data" chip */
      .sec-1-1 .s4-cell.last { border-style: dashed; border-color: var(--accent); } /* the last cell (address n - 1) gets a dashed accent frame to point it out */
      .sec-1-1 .s4-cell:hover { border-color: var(--accent); } /* hovering a cell turns its frame the accent colour */
      .sec-1-1 .s4-cell.on { border: 2.5px solid var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); } /* the opened cell gets a thicker accent frame and a glow ring */
      .sec-1-1 .s4-detail { display: flex; flex-direction: column; gap: 6px; margin-top: auto; } /* detail card under the grid: a column that is pushed to the bottom of the panel (margin-top: auto) */
      .sec-1-1 .s4-reads { display: grid; grid-template-columns: 1fr 1fr 1.6fr; gap: 8px; } /* the three ways to read a word (number, two letters, instruction) side by side; the instruction column is widest */
      .sec-1-1 .s4-reads > div { display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--line); border-radius: 9px; padding: 4px 9px; min-width: 0; } /* each reading is a small bordered box stacking label, value and note; min-width 0 lets long text wrap instead of widening the grid */
      .sec-1-1 .s5 .player-cap { min-height: 4.1em; } /* step 5 caption keeps room for about four lines so the bus drawing does not jump as captions change */
      .sec-1-1 .s6-formula { font-size: 15.5px; line-height: 1.45; border-left: 5px solid var(--io); } /* step 6 formula card (keys per visit versus buffer size) with a thick I/O-orange bar down its left edge */
      .sec-1-1 .s6-flow { display: grid; grid-template-columns: minmax(0, 1fr) 22px minmax(0, 1.25fr) 22px minmax(0, 1fr); align-items: stretch; } /* step 6 keyboard, buffer, processor row: five columns (box, arrow, wider middle box, arrow, box) */
      .sec-1-1 .s6-arr { display: grid; place-items: center; font-size: 22px; font-weight: 800; color: var(--muted); } /* the arrow between two boxes: large, bold, grey and centred in its column */
      .sec-1-1 .s6-box { border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; min-height: 150px; } /* each of the three boxes is a rounded column with centred content and a minimum height so they line up */
      .sec-1-1 .s6-box h4 { margin: 0 !important; } /* headings inside the boxes lose their margins (!important beats the guide's general heading spacing) */
      .sec-1-1 .s6-box.dev { border: 2px dashed var(--io); background: var(--panel-2); } /* the keyboard box has a dashed I/O-coloured frame because the device sits outside the computer */
      .sec-1-1 .s6-box.io { border: 2px solid var(--io); background: var(--io-bg); } /* the I/O module box has a solid I/O frame and tinted background */
      .sec-1-1 .s6-box.cpu { border: 2px solid var(--cpu); background: var(--cpu-bg); justify-content: flex-start; } /* the processor box uses the processor colour and starts its content at the top */
      .sec-1-1 .s6-box.cpu .meter { width: 100%; } /* the timer bar in the processor box spans the full width of the box */
      .sec-1-1 .s6-box.cpu .meter > i { background: var(--cpu); } /* the timer bar fills in the processor colour, showing how close the next visit is */
      .sec-1-1 .s6-key { width: 52px; height: 52px; border-radius: 10px; border: 2px solid var(--line-2); border-bottom-width: 5px; background: var(--panel); display: grid; place-items: center; font-size: 26px; font-weight: 800; } /* the keyboard key: a square cap with a thicker bottom edge so it looks like a real key; it shows the latest letter */
      .sec-1-1 .s6-key.lost { border-color: var(--bad); color: var(--bad); background: var(--bad-bg); } /* the key turns red when that key press was lost because the buffer was full */
      .sec-1-1 .s6-slots { display: grid; grid-template-columns: repeat(4, 34px); gap: 5px; justify-content: center; min-height: 34px; } /* the buffer slots: a centred grid of four small columns (8 slots simply wrap onto a second row) */
      .sec-1-1 .s6-slots.one { grid-template-columns: 34px; } /* with a 1-slot buffer the grid has a single column */
      .sec-1-1 .s6-slots > span { height: 34px; border-radius: 7px; border: 1.5px solid var(--line-2); background: var(--panel); display: grid; place-items: center; font-family: var(--mono); font-weight: 800; font-size: 17px; } /* each buffer slot is a small rounded square showing one letter in a monospaced font */
      .sec-1-1 .s6-slots > span.full { background: var(--hl); border-color: var(--warn); } /* a slot holding a waiting key is filled with the highlight colour and gets a warning-coloured frame */
      .sec-1-1 .s6-line { font-size: 16px; letter-spacing: .06em; white-space: nowrap; overflow: hidden; line-height: 1.5; } /* the "typed" and "in memory" lines: one monospaced line that never wraps; extra letters are cut off */
      .sec-1-1 .s6-line .lbl { display: inline-block; width: 92px; font-family: var(--font); font-size: 12.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); } /* the label at the start of each line: fixed width, small uppercase grey text, so both lines of letters start at the same spot */
      .sec-1-1 .s6-line .c-ok { color: var(--ok); font-weight: 700; } /* letters that reached memory are shown in green */
      .sec-1-1 .s6-line .c-buf { color: var(--warn); font-weight: 700; } /* letters still waiting in the buffer are shown in the warning colour */
      .sec-1-1 .s6-line .c-lost { color: var(--bad); text-decoration: line-through; font-weight: 700; background: var(--bad-bg); } /* lost letters are red, struck through, on a red background */
      .sec-1-1 .s6-cap { min-height: 4.6em; } /* step 6 caption keeps room for about four and a half lines so the controls below stay put */
      .sec-1-1 .s6-ctl .seg { align-self: flex-start; } /* the two segmented button groups in the settings row keep their natural width instead of stretching */
      .sec-1-1 .s7-flow { display: grid; grid-template-columns: minmax(0, 1.25fr) 64px minmax(0, 1fr); gap: 8px; align-items: stretch; } /* step 7 row: memory card, I/O module, disk card in three columns (memory slightly wider) */
      .sec-1-1 .s7-cells { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; } /* the 8 memory cells of step 7 sit in four columns, so two rows */
      .sec-1-1 .s7-cell { height: 58px; border-radius: 9px; border: 1.5px solid var(--line-2); background: var(--panel); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.25; transition: background .25s; } /* each memory cell is a rounded box with address above contents; its background fades over 0.25 s when the power changes */
      .sec-1-1 .s7-cell b { font-size: 16px; } /* the contents text of a memory cell */
      .sec-1-1 .s7-cell.os { background: var(--os-bg); border-color: var(--os); } /* cells holding the OS use the operating-system colour */
      .sec-1-1 .s7-cell.prog { background: var(--proc-bg); border-color: var(--proc); } /* cells holding the editor program use the process colour */
      .sec-1-1 .s7-cell.word { background: var(--mem-bg); border-color: var(--mem); } /* cells holding words of the note use the memory colour */
      .sec-1-1 .s7-cell.unsaved { border-style: dashed; border-width: 2px; border-color: var(--warn); } /* a word typed but not yet saved gets a dashed warning-coloured frame */
      .sec-1-1 .s7-cell.dead { background: var(--panel-3); border-style: dotted; color: var(--muted); } /* with the power off every cell turns grey with a dotted frame and faded text */
      .sec-1-1 .s7-io { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border: 2px solid var(--io); border-radius: 12px; background: var(--io-bg); color: var(--io); } /* the I/O module between memory and disk: a centred column with an I/O-coloured frame */
      .sec-1-1 .s7-arrows { font-size: 24px; font-weight: 800; } /* the two-way arrow inside the I/O module, large and bold */
      .sec-1-1 .s7-file { display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 3px 9px; line-height: 1.3; } /* each file on the disk is a small bordered box stacking its name and a note */
      .sec-1-1 .s7-cap { min-height: 4.6em; } /* step 7 caption keeps room for about four and a half lines */
      .sec-1-1 .nar .s4-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } /* phone layout (the step adds class nar on a small screen): the step 4 memory grid drops to four columns */
      .sec-1-1 .nar .s4-grid .s4-cell { height: 46px; flex-direction: column; gap: 0; } /* phone layout: every cell keeps address above contents at one height, even with 64 cells */
      .sec-1-1 .nar .s4-reads { grid-template-columns: 1fr; } /* phone layout: the three readings of a word stack in one column */
      .sec-1-1 .nar .s6-flow { grid-template-columns: 1fr; gap: 2px; } /* phone layout: the step 6 keyboard, buffer, processor row stacks into one column */
      .sec-1-1 .nar .s6-arr { font-size: 20px; line-height: 1.2; } /* phone layout: the arrows (now pointing down) get slightly smaller */
      .sec-1-1 .nar .s6-box { min-height: 0; } /* phone layout: the step 6 boxes drop their minimum height to save space */
      .sec-1-1 .nar .s7-flow { grid-template-columns: 1fr; } /* phone layout: the step 7 memory, I/O, disk row stacks into one column */
      .sec-1-1 .nar .s7-io { flex-direction: row; gap: 8px; padding: 4px; } /* phone layout: the I/O module turns into a flat horizontal strip */
      .sec-1-1 .nar .s7-arrows { transform: rotate(90deg); } /* phone layout: the two-way arrow is turned 90 degrees so it points up and down between memory and disk */
      .sec-1-1 .s8-pt { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 10px; align-items: start; padding: 7px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel-2); font-size: 15.5px; line-height: 1.42; } /* step 8 recap point: a bordered card with a number badge on the left and the text on the right */
      .sec-1-1 .s8-pt > i { font-style: normal; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; background: var(--chc); color: var(--panel); font-weight: 800; font-size: 14px; } /* the number badge: a small rounded square in the chapter colour; font-style normal undoes the italics of the i tag */
      .sec-1-1 .s8-cols { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 10px; } /* step 8 match-up game: two columns, computer parts on the left (slimmer) and kitchen jobs on the right */
      .sec-1-1 .s8-it { text-align: left; min-height: 46px; padding: 5px 11px; border-radius: 10px; border: 2px solid var(--line); background: var(--panel); cursor: pointer; font-size: 14.5px; line-height: 1.3; color: var(--ink); } /* each match-up choice is a left-aligned framed button */
      .sec-1-1 .s8-it.l { font-weight: 750; } /* the computer-part buttons on the left use bolder text */
      .sec-1-1 .s8-it:hover:not(:disabled) { border-color: var(--accent); } /* hovering a choice that can still be clicked turns its frame the accent colour */
      .sec-1-1 .s8-it.on { border-color: var(--accent); background: var(--accent-bg); } /* the selected choice gets an accent frame and tinted background */
      .sec-1-1 .s8-it.ok { border-color: var(--ok); background: var(--ok-bg); color: var(--ink); cursor: default; } /* a matched pair turns green and shows a plain arrow cursor, since it can no longer be clicked */
      .sec-1-1 .s8-fb { min-height: 4.4em; margin-top: auto; } /* match-up feedback box: pushed to the bottom of the panel, with room for about three lines */
      .sec-1-1 .s8-fb.bad { border-color: var(--bad); background: var(--bad-bg); } /* feedback turns red after a wrong match */
      .sec-1-1 .s8-fb.good { border-color: var(--ok); background: var(--ok-bg); } /* feedback turns green when every pair has been matched */
    `,  // ends the section's style rules
    steps: [  // steps: the list of pages (steps) in this section, shown one at a time as the student presses Next
      /* ---------------- 1. Big picture: four parts, one team ---------------- */
      {  // opens step 1: the big-picture page with the four parts of a computer
        title: 'A computer is a team of four parts',  // step 1 title shown at the top of the page
        kind: 'story',  // kind "story" puts the "Big Picture" label above the title
        html: `${/* html: the fixed page content for step 1, written as HTML (the page-building language) inside backticks */''}
          <div class="split fill">${/* two-column layout that fills the page: the reading on the left, the interactive panel on the right */''}
            <div class="stack">${/* left column: a vertical stack of paragraphs */''}
              <p class="lead m0">A program is just a list of <span class="t">instructions</span> stored as numbers. To run it, a computer needs parts that hold it, act on it, carry it around and connect it to the outside world.</p>${/* opening paragraph: a program is a list of instructions stored as numbers (dotted words open a definition) */''}
              <p class="m0">Every computer, from a phone to a data-centre server, is built from processor, memory and I/O components, connected so that together they can <b>execute</b> (run) <b>programs</b>. Look inside and you always find four main structural elements: the <span class="t">processor</span>, <span class="t">main memory</span>, the <span class="t">I/O modules</span> and the <span class="t">system bus</span>.</p>${/* paragraph: every computer is built from four structural elements, each named and linked to the glossary */''}
              <div class="callout analogy m0" data-label="Analogy">A restaurant kitchen is organised the same way: a chef does the cooking, a counter holds what is in use, a pass window links to the outside, and one shared aisle carries every trip.</div>${/* analogy box: the restaurant kitchen that the step compares the computer with */''}
              <div class="callout why m0" data-label="Why it matters">An operating system spends its whole life managing these four parts. To understand the manager, first meet what it manages.</div>${/* "why it matters" box: an operating system exists to manage these four parts */''}
              <p class="small muted m0">By the end of this section you will be able to name each part, say which registers carry its traffic, and trace a value as it travels from memory or a device into the processor.</p>${/* small grey preview of what the student will be able to do by the end of the section */''}
            </div>${/* closes the left column */''}
            <div class="card white stack s1-panel"></div>${/* right column: an empty white card; render() below fills it with the clickable diagram */''}
          </div>`,  // closes the two-column layout and ends the step 1 HTML
        render(el, ctx) {  // render(el, ctx): runs each time step 1 is shown; el is the page area and ctx is the guide's toolbox for this step
          const { h } = ctx;  // takes h (the guide's helper that builds one HTML element from a tag, settings and children) out of ctx
          const panel = el.querySelector('.s1-panel');  // finds the empty white card from the HTML above, where the diagram and caption will go
          const V = {  // V: the text for the two views of the diagram, the real computer and the kitchen comparison
            computer: {  // computer view: labels and captions that use the real part names
              p: ['Processor (CPU)', 'controls the whole machine', 'and does the data processing'],  // processor block: its name plus two short lines about its job
              m: ['Main memory', 'holds the running programs', 'and their data (volatile)'],  // memory block: its name plus two short lines about what it holds
              b: 'System bus: the shared connection between every part',  // label written inside the long bus bar
              i: ['I/O modules', 'move data to and from', 'the outside world'],  // I/O block: its name plus two short lines about its job
              o: ['External environment', ['Disk', 'Network', 'Terminal']],  // outside-world block: its heading and the three devices drawn inside it
              cap: {  // cap: the longer caption shown under the diagram when a block is clicked, one per block
                p: 'The <b>processor</b> runs the programs: it fetches each instruction and carries it out. That is how it controls the operation of the whole computer and performs its data processing. When a machine has only one processor, it is usually called the <b>CPU</b> (central processing unit).',  // caption for the processor: it runs programs, and a single processor is called the CPU
                m: '<b>Main memory</b> stores the programs being run and the data they use. It is usually <b>volatile</b>: switch off the power and it forgets everything. You will also hear it called <b>real memory</b> or <b>primary memory</b>.',  // caption for main memory: it holds programs and data, forgets at power-off, and its other names
                b: 'The <b>system bus</b> provides communication among the processors, main memory and I/O modules. Every instruction, number and key press that moves between them travels over it.',  // caption for the system bus: the shared path every transfer uses
                i: '<b>I/O modules</b> move data between the computer and its external environment, in both directions. Each kind of device is looked after by an I/O module.',  // caption for I/O modules: they move data to and from the outside world
                o: 'The <b>external environment</b> is everything outside: secondary memory devices such as disks, communications equipment such as a network card, and terminals (a keyboard and screen).',  // caption for the outside world: disks, network equipment and terminals
              },  // closes the computer-view captions
            },  // closes the computer view
            kitchen: {  // kitchen view: the same five blocks with kitchen names, so the layout matches the computer view
              p: ['The chef', 'reads each recipe step', 'and does all the cooking'],  // processor block, kitchen name: the chef
              m: ['The counter', 'holds today’s recipes and', 'ingredients; wiped nightly'],  // memory block, kitchen name: the counter, wiped every night
              b: 'The one shared aisle that every single trip must use',  // bus bar label, kitchen name: the one shared aisle
              i: ['The pass window', 'where orders come in', 'and plates go out'],  // I/O block, kitchen name: the pass window
              o: ['Beyond the kitchen', ['Storeroom', 'Suppliers', 'Diners']],  // outside-world block, kitchen names: storeroom, suppliers and diners
              cap: {  // kitchen-view captions, one per block
                p: 'The <b>chef</b> reads the next recipe step, then chops, mixes and cooks. Every dish gets made because the chef carries out its recipe, just as every program runs because the processor carries out its instructions one by one.',  // caption for the chef: carries out each recipe step as the processor carries out instructions
                m: 'The <b>counter</b> holds exactly what today’s cooking needs, within arm’s reach. At closing time it is wiped clean, just as main memory is emptied when the power goes off.',  // caption for the counter: holds what is needed now and is wiped at closing, like volatile memory
                b: 'The <b>aisle</b> is shared: ingredients, dishes and orders all travel along it. That is the system bus: one common path that links every part.',  // caption for the aisle: one shared path for every trip, like the bus
                i: 'The <b>pass window</b> is the kitchen’s link to everything outside. Orders come in, plates go out, and a small shelf lets things wait until someone is free to carry them.',  // caption for the pass window: the link outside, with a shelf where things wait (a buffer)
                o: 'The <b>storeroom</b> is huge and keeps things overnight (like a disk), <b>suppliers</b> deliver from far away (like a network), and <b>diners</b> place orders and receive food (like a keyboard and screen).',  // caption for the world beyond the kitchen: storeroom as disk, suppliers as network, diners as terminal
              },  // closes the kitchen-view captions
            },  // closes the kitchen view
          };  // closes the V table
          let view = 'computer', sel = null;  // view remembers which view is showing; sel remembers which block was clicked last (null = none yet)
          const svg = ctx.s('svg', { viewBox: '0 0 540 330', width: '100%', role: 'img', 'aria-label': 'The four structural elements of a computer joined by the system bus' });  // creates the drawing area as SVG (the browser's drawing format); its 540 x 330 coordinate grid scales to the card width
          const cap = h('div', { class: 'player-cap s1-cap', 'aria-live': 'polite' });  // caption box under the diagram; aria-live makes screen readers announce each new caption
          const hot = (id, inner) => `<g class="hot${sel === id ? ' sel' : ''}" data-id="${id}" tabindex="0" role="button">${inner}</g>`;  // hot(id, inner): wraps one block's drawing in a group that can be clicked or reached with Tab; "sel" marks the chosen block
          const block = (id, x, y, w, hh, cls, lines) => hot(id, `<rect class="fr ${cls}" x="${x}" y="${y}" width="${w}" height="${hh}" rx="14" stroke-width="2"/>` +  // block(...): draws one labelled block (a rounded rectangle with class fr, the frame the CSS thickens) as a clickable group
            `<text x="${x + w / 2}" y="${y + 38}" text-anchor="middle" font-size="18" font-weight="800">${lines[0]}</text>` +  // block's first text line: the part name, large and bold, centred in the block
            `<text x="${x + w / 2}" y="${y + 64}" text-anchor="middle" font-size="14" class="s-sub">${lines[1]}</text>` +  // block's second text line: the first half of the job description, in the lighter sub-text style
            `<text x="${x + w / 2}" y="${y + 83}" text-anchor="middle" font-size="14" class="s-sub">${lines[2]}</text>`);  // block's third text line: the second half of the job description
          function draw() {  // draw(): redraws the whole diagram and caption; runs at start, when a block is clicked and when the view changes
            const d = V[view];  // d is the text set (computer or kitchen) for the view now showing
            const dev = d.o[1].map((t, k) => `<rect x="${278 + k * 84}" y="258" width="80" height="42" rx="9" class="s-io" stroke-width="1.5"/><text x="${318 + k * 84}" y="284" text-anchor="middle" font-size="13" font-weight="700">${t}</text>`).join('');  // builds the three small device boxes inside the outside-world block, 84 units apart
            svg.innerHTML =  // replaces everything inside the SVG with the freshly built drawing
              `<line x1="135" y1="118" x2="135" y2="152" class="s-line" stroke-width="3"/>` +  // connector line from the processor down to the bus
              `<line x1="405" y1="118" x2="405" y2="152" class="s-line" stroke-width="3"/>` +  // connector line from main memory down to the bus
              `<line x1="130" y1="192" x2="130" y2="220" class="s-line" stroke-width="3"/>` +  // connector line from the bus down to the I/O block
              `<line x1="250" y1="271" x2="272" y2="271" class="s-line" stroke-width="3"/>` +  // connector line from the I/O block across to the outside world
              block('p', 10, 8, 250, 110, 's-cpu', d.p) +  // processor block, top left, drawn in the processor colour
              block('m', 280, 8, 250, 110, 's-mem', d.m) +  // memory block, top right, drawn in the memory colour
              hot('b', `<rect class="fr s-accent" x="10" y="152" width="520" height="40" rx="20" stroke-width="2"/><text x="270" y="177" text-anchor="middle" font-size="15" font-weight="800">${d.b}</text>`) +  // the long rounded bus bar across the middle, also clickable
              block('i', 10, 220, 240, 102, 's-io', d.i) +  // I/O block, bottom left, in the I/O colour
              hot('o', `<rect class="fr s-panel" x="272" y="220" width="258" height="102" rx="14" stroke-width="1.5" stroke-dasharray="6 4"/><text x="401" y="244" text-anchor="middle" font-size="14" font-weight="800" class="s-sub">${d.o[0]}</text>${dev}`);  // outside-world block, bottom right, with a dashed frame to show it lies outside the computer
            cap.innerHTML = sel ? d.cap[sel] : (view === 'computer'  // caption: the clicked block's caption, or a starter hint when nothing has been clicked yet
              ? 'Click any block to learn its job. Then flip to the kitchen view: the layout stays the same, only the names change.'  // starter hint for the computer view
              : 'Same layout, kitchen names. Click any block to see why the comparison works.');  // starter hint for the kitchen view
          }  // ends draw()
          const pick = (e) => { const g = e.target.closest && e.target.closest('.hot'); if (!g) return; sel = g.dataset.id; draw(); };  // pick(e): finds the block group under the click, remembers it as selected and redraws
          svg.addEventListener('click', pick);  // a mouse click or tap on the drawing picks a block
          svg.addEventListener('pointerdown', (e) => { if (!e.isTrusted) pick(e); });  // the guide's automatic page checker "clicks" with a script-made pointerdown (isTrusted is false); this lets it pick too
          svg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });  // Enter or Space on a focused block picks it, so the diagram works from the keyboard; preventDefault stops Space scrolling the page
          const seg = ctx.ui.seg([{ value: 'computer', label: 'Computer view' }, { value: 'kitchen', label: 'Kitchen view' }], view, (v) => { view = v; draw(); });  // two-button switch (the guide's segmented control) for Computer view / Kitchen view; choosing one redraws
          panel.append(h('div', { class: 'row' }, seg, h('span', { class: 'small muted' }, 'Click a block')), svg, cap);  // puts the switch, a small hint, the drawing and the caption into the white card
          draw();  // draws the diagram for the first time when the step opens
        },  // ends render() for step 1
      },  // closes step 1
      /* ---------------- 2. Clickable top-level view ---------------- */
      {  // opens step 2: the clickable top-level view of a computer
        title: 'The top-level view: click every part',  // step 2 title
        kind: 'explore',  // kind "explore" labels the page as an Explore step
        core: true,  // core: true puts this step on the guide's shorter core route
        render(el, ctx) {  // render(el, ctx): builds the whole step 2 page each time it is shown
          const { h } = ctx;  // takes the element-building helper h out of ctx
          // [id, name, colour, what it does, key facts, kitchen analogy, related parts, data path]
          const P = {  // P: every clickable part of the diagram and what to show when it is clicked (fields listed in the comment above)
            cpu: ['Processor (CPU)', 'cpu', 'Controls the operation of the whole computer and performs its data processing. It is the element that <i>runs programs</i>, fetching instructions and carrying them out; memory stores them, the bus carries them, and I/O modules look after devices for it.',  // processor entry: name, colour, and what it does (it runs programs and so controls the machine)
              ['A machine with a single processor usually calls it the <b>CPU</b> (central processing unit).', 'Inside: registers (the small boxes; only six are drawn, a real processor has many more) and an execution unit.', 'It reaches memory and devices only through the system bus.'],  // processor key facts: the CPU name, what is inside it, and that it reaches everything through the bus
              'The chef, who reads the next recipe step and does the cooking.', ['bus']],  // processor kitchen analogy (the chef); clicking the processor also highlights the related bus
            pc: ['Program counter (PC)', 'cpu', 'Holds the memory address of the <b>next instruction</b> to fetch.',  // program counter entry: it holds the address of the next instruction to fetch
              ['After each fetch it normally moves on to the following address.', 'Section 1.3 shows it driving the fetch–execute cycle.'],  // program counter facts: it moves on after each fetch, and Section 1.3 shows it in action
              'A bookmark in the recipe book, marking which step comes next.', ['cells']],  // program counter analogy (a bookmark); its related part is the row of memory cells it points into
            ir: ['Instruction register (IR)', 'cpu', 'Holds the instruction that has just been fetched, while the processor works out what it means and carries it out.',  // instruction register entry: it holds the instruction just fetched while that instruction is carried out
              ['Its contents change once per instruction.', 'It works hand in hand with the PC (Section 1.3).'],  // instruction register facts: its contents change once per instruction and it works with the PC
              'The recipe card clipped above the stove for the step being cooked right now.', ['exec']],  // instruction register analogy (the recipe card over the stove); related part: the execution unit
            mar: ['Memory address register (MAR)', 'cpu', 'Holds the <b>address</b> of the memory cell for the next read or write. It says <i>where</i>.',  // MAR entry: it holds the address (the where) of the memory cell for the next read or write
              ['Its value goes out on the address lines of the bus.', 'It never holds the data itself, only the cell number.'],  // MAR facts: its value goes out on the address lines and it never holds the data itself
              'A slip naming which numbered spot on the counter to go to.', ['mem', 'bus'], 'mem'],  // MAR analogy (a slip naming a counter spot); related: memory and bus; the last "mem" draws its path to memory
            mbr: ['Memory buffer register (MBR)', 'cpu', 'Holds the <b>data</b> to be written into memory, or receives the data read from memory. It carries <i>what</i>.',  // MBR entry: it holds the data (the what) going to or coming from memory
              ['Its value travels on the data lines of the bus.', 'It pairs with the MAR: the MAR says where, the MBR says what.'],  // MBR facts: its value travels on the data lines and it pairs with the MAR
              'The tray that carries an ingredient to or from that counter spot.', ['mem', 'bus'], 'mem'],  // MBR analogy (the tray); related: memory and bus; its highlighted path also leads to memory
            ioar: ['I/O address register (I/O AR)', 'cpu', 'Specifies a <b>particular I/O device</b>: the one the processor wants to exchange data with.',  // I/O AR entry: it names the particular device the processor wants to talk to
              ['It is the I/O twin of the MAR.', 'Each device has its own number, so one bus can reach many devices.'],  // I/O AR facts: it is the I/O twin of the MAR, and device numbers let one bus reach many devices
              'A ticket saying which door an order goes to.', ['io', 'bus'], 'io'],  // I/O AR analogy (a door ticket); related: I/O module and bus; its path leads to the I/O module
            iobr: ['I/O buffer register (I/O BR)', 'cpu', 'Used for the <b>exchange of data</b> between an I/O module and the processor, in either direction.',  // I/O BR entry: it carries data between an I/O module and the processor, either way
              ['It is the I/O twin of the MBR.', 'A key press coming in, or a character going out, passes through here.'],  // I/O BR facts: it is the I/O twin of the MBR, used by key presses coming in and characters going out
              'The tray handed through the pass window.', ['io', 'bus'], 'io'],  // I/O BR analogy (the tray through the pass window); its path also leads to the I/O module
            exec: ['Execution unit', 'cpu', 'The circuitry that does the actual work of each instruction: arithmetic such as adding, comparisons, and moving values between registers.',  // execution unit entry: the circuitry that adds, compares and moves values
              ['It works only on values already inside the processor.', 'Anything from memory must first arrive in a register, for example the MBR.'],  // execution unit facts: it only works on values already inside the processor, such as the MBR
              'The chef’s hands, knife and stove.', ['mbr']],  // execution unit analogy (the chef's hands and stove); related part: the MBR
            bus: ['System bus', 'accent', 'Provides communication among the processor, main memory and the I/O modules. Every exchange between them travels along it.',  // system bus entry: the shared path between processor, memory and I/O modules
              ['It carries <b>address</b> signals (where), <b>data</b> (what) and <b>control</b> signals (read or write, and when).', 'It is shared, so normally only one transfer uses it at a time.'],  // system bus facts: it carries address, data and control signals, normally one transfer at a time
              'The one shared aisle that every trip in the kitchen must use.', ['cpu', 'mem', 'io']],  // system bus analogy (the shared aisle); related: processor, memory and I/O module
            mem: ['Main memory', 'mem', 'Stores the programs that are running and the data they are using.',  // main memory entry: it stores the running programs and their data
              ['Usually <b>volatile</b>: its contents vanish when the power goes off.', 'Also called <b>real memory</b> or <b>primary memory</b>.', 'Much slower than registers, much faster than a disk.'],  // main memory facts: volatile, its other names, and its speed compared with registers and disks
              'The counter: it holds what today’s cooking needs and is wiped clean at closing time.', ['cells']],  // main memory analogy (the counter); related part: the numbered cells inside it
            cells: ['Numbered cells', 'mem', 'Memory is a row of locations numbered 0, 1, 2 … up to <b>n − 1</b>. The number is the cell’s <b>address</b>; the bits stored in it are its <b>contents</b>.',  // numbered cells entry: cells numbered 0 to n - 1; the number is the address, the bits are the contents
              ['Every cell holds a binary number: a pattern of bits.', 'That pattern can be an <b>instruction</b> or <b>data</b>; it depends on how the processor uses it.'],  // numbered cells facts: every cell holds bits, which can be an instruction or data
              'A long row of numbered spots along the counter.', ['mem']],  // numbered cells analogy (numbered spots along the counter); related part: main memory
            io: ['I/O module', 'io', 'Moves data between the computer and its external environment: from devices to the processor and memory, and back out again.',  // I/O module entry: it moves data between the computer and the outside world
              ['It knows the details of its device, so the processor does not have to.', 'It contains internal <b>buffers</b> where data waits in transit.'],  // I/O module facts: it knows its device's details and holds data in buffers
              'The pass window between the kitchen and the outside world.', ['buf', 'dev']],  // I/O module analogy (the pass window); related: its buffers and the external devices
            buf: ['Buffers', 'io', 'Small holding areas inside the I/O module that keep data for a moment, until the other side is ready to take it.',  // buffers entry: small holding areas where data waits until the other side is ready
              ['They absorb the huge speed difference between the processor and devices.', 'Step 6 lets you experiment with one.'],  // buffers facts: they absorb the speed gap between processor and devices; step 6 lets you try one
              'The shelf in the pass window where plates wait for a server.', ['io']],  // buffers analogy (the shelf in the pass window); related part: the I/O module
            dev: ['External devices', 'io', 'The external environment: <b>secondary memory</b> devices such as disks, <b>communications equipment</b> such as network cards, and <b>terminals</b> (keyboard and screen).',  // external devices entry: disks, network equipment and terminals outside the computer
              ['A disk is permanent and huge, but far slower than main memory.', 'The processor never talks to a device directly, only to its I/O module.'],  // external devices facts: a disk is big and permanent but slow; the processor only talks to the module
              'The storeroom, the suppliers and the diners.', ['io']],  // external devices analogy (storeroom, suppliers, diners); related part: the I/O module
          };  // closes the P table of parts
          const ORDER = Object.keys(P);  // ORDER: the part ids in table order; the Tour button walks through them and the counter uses its length
          const hot = (id, inner) => `<g class="hot" data-id="${id}" tabindex="0" role="button" aria-label="${P[id][0]}">${inner}</g>`;  // hot(id, inner): wraps a part's drawing in a clickable, Tab-reachable group labelled with the part name for screen readers
          const reg = (id, x, y, ab, sub) => hot(id, `<rect class="fr s-panel" x="${x}" y="${y}" width="128" height="46" rx="8" stroke-width="2" style="stroke:var(--cpu)"/><text x="${x + 64}" y="${y + 20}" text-anchor="middle" class="s-monot" font-size="15" font-weight="800">${ab}</text><text x="${x + 64}" y="${y + 38}" text-anchor="middle" font-size="13" class="s-sub">${sub}</text>`);  // reg(...): draws one register as a small clickable box with its short name on top and its role underneath
          const rows = [['0', 'instruction', 'i'], ['1', 'instruction', 'i'], ['2', 'instruction', 'i'], ['3', 'data', 'd'], ['4', 'data', 'd'], null, ['n − 2', 'data', 'd'], ['n − 1', 'data', 'd']];  // rows: the memory cells drawn in the diagram as [address, what it holds, i or d]; null marks the dotted gap before n - 2
          let ry = 56;  // ry: the y position (distance down the drawing) of the next memory row, starting just under the headings
          const cellRows = rows.map((r) => {  // cellRows: builds the SVG for every memory row in the wide drawing, one after another
            if (!r) { const t = `<text x="448" y="${ry + 14}" text-anchor="middle" font-size="15" font-weight="800" class="s-sub">⋮</text><text x="549" y="${ry + 14}" text-anchor="middle" font-size="15" font-weight="800" class="s-sub">⋮</text>`; ry += 20; return t; }  // for the null gap: draws two vertical dots (one under each column) and moves down a little
            const t = `<rect x="388" y="${ry}" width="60" height="26" rx="5" class="s-panel"/><text x="418" y="${ry + 18}" text-anchor="middle" class="s-monot" font-size="13" font-weight="700">${r[0]}</text>` +  // a normal row: the address box on the left with its number in a monospaced font
              `<rect x="456" y="${ry}" width="186" height="26" rx="5" class="${r[2] === 'i' ? 's-cpu' : 's-mem'}" stroke-width="1"/><text x="549" y="${ry + 18}" text-anchor="middle" font-size="13">${r[1]}</text>`;  // and the contents box on the right, blue for an instruction or green for data
            ry += 29; return t;  // moves down to the next row and hands back this row's drawing
          }).join('');  // joins all the row drawings into one piece of SVG text
          const devs = ['Disk', 'Network', 'Terminal'].map((d, k) => `<rect x="548" y="${336 + k * 54}" width="106" height="42" rx="9" class="s-io" stroke-width="1.5"/><text x="601" y="${362 + k * 54}" text-anchor="middle" font-size="14" font-weight="700">${d}</text><line x1="532" y1="${357 + k * 54}" x2="548" y2="${357 + k * 54}" class="s-line" stroke-width="2"/>`).join('');  // devs: the three device boxes (disk, network, terminal) with short lines linking them to the I/O wiring
          const svg = ctx.s('svg', { viewBox: ctx.narrow ? '0 0 400 540' : '0 0 660 512', width: '100%', role: 'img', 'aria-label': 'Top-level view of a computer: processor with registers, system bus, main memory and an I/O module' });  // the SVG drawing area; phone-width screens get a tall coordinate grid, wider screens a wide one
          const WIDE = () =>  // WIDE(): builds the drawing for laptop and projector screens: processor left, bus in the middle, memory and I/O right
            `<line x1="290" y1="258" x2="314" y2="258" class="s-line" stroke-width="4"/><line x1="350" y1="150" x2="374" y2="150" class="s-line" stroke-width="4"/><line x1="350" y1="412" x2="374" y2="412" class="s-line" stroke-width="4"/>` +  // connector lines: processor to bus, bus to memory, bus to I/O module
            hot('cpu', `<rect class="fr s-cpu" x="6" y="110" width="284" height="296" rx="16" stroke-width="2"/><text x="20" y="134" font-size="14" font-weight="800" style="fill:var(--cpu)">PROCESSOR (CPU)</text>`) +  // the processor box, clickable, with its title in the processor colour
            reg('pc', 18, 146, 'PC', 'next instruction') + reg('ir', 152, 146, 'IR', 'being executed') +  // PC and IR registers side by side at the top of the processor
            reg('mar', 18, 202, 'MAR', 'memory address') + reg('mbr', 152, 202, 'MBR', 'memory data') +  // MAR and MBR registers in the second row
            reg('ioar', 18, 258, 'I/O AR', 'which device') + reg('iobr', 152, 258, 'I/O BR', 'I/O data') +  // I/O AR and I/O BR registers in the third row
            hot('exec', `<rect class="fr s-panel" x="18" y="318" width="262" height="74" rx="8" stroke-width="2" style="stroke:var(--cpu)"/><text x="149" y="349" text-anchor="middle" font-size="15" font-weight="800">Execution unit</text><text x="149" y="370" text-anchor="middle" font-size="13" class="s-sub">adds, compares, moves values</text>`) +  // the execution unit box across the bottom of the processor
            hot('bus', `<rect class="fr s-accent" x="314" y="6" width="36" height="500" rx="12" stroke-width="2"/><text x="332" y="256" transform="rotate(-90 332 256)" text-anchor="middle" font-size="14" font-weight="800" style="fill:var(--accent)">SYSTEM BUS</text>`) +  // the tall bus bar with its label written sideways (rotated -90 degrees)
            hot('mem', `<rect class="fr s-mem" x="374" y="6" width="280" height="298" rx="14" stroke-width="2"/><text x="388" y="30" font-size="14" font-weight="800" style="fill:var(--mem)">MAIN MEMORY</text><text x="418" y="49" text-anchor="middle" font-size="13" class="s-sub">address</text><text x="549" y="49" text-anchor="middle" font-size="13" class="s-sub">contents</text>`) +  // the main memory box with its title and the "address" and "contents" column headings
            hot('cells', `<rect class="fr" x="382" y="52" width="266" height="246" rx="8" fill="transparent" stroke-width="0" style="stroke:var(--mem)"/>${cellRows}`) +  // an invisible clickable frame around the memory rows, so the rows as a whole can be picked
            hot('io', `<rect class="fr s-io" x="374" y="318" width="150" height="188" rx="14" stroke-width="2"/><text x="388" y="342" font-size="14" font-weight="800" style="fill:var(--io)">I/O MODULE</text>`) +  // the I/O module box with its title
            hot('buf', `<rect class="fr" x="386" y="352" width="126" height="108" rx="8" fill="transparent" stroke-width="0" style="stroke:var(--io)"/>${[0, 1, 2, 3].map((k) => `<rect class="s-panel" x="${392 + (k % 2) * 58}" y="${358 + Math.floor(k / 2) * 40}" width="52" height="32" rx="6" stroke-width="1.5"/>`).join('')}<text x="449" y="454" text-anchor="middle" font-size="13" class="s-sub">buffers</text>`) +  // an invisible clickable frame around four small buffer squares, labelled "buffers"
            `<line x1="524" y1="412" x2="532" y2="412" class="s-line" stroke-width="2"/><line x1="532" y1="357" x2="532" y2="465" class="s-line" stroke-width="2"/>` +  // wiring from the I/O module out to the three devices
            `<text x="601" y="326" text-anchor="middle" font-size="13" class="s-sub">outside world</text>` +  // small "outside world" label above the devices
            hot('dev', `<rect class="fr" x="542" y="330" width="118" height="160" rx="10" fill="transparent" stroke-width="0" style="stroke:var(--io)"/>${devs}`) +  // an invisible clickable frame around the three device boxes
            `<text x="148" y="452" text-anchor="middle" font-size="14" class="s-sub">Click any box, register</text><text x="148" y="472" text-anchor="middle" font-size="14" class="s-sub">or the bus to explore it.</text>`;  // two lines of hint text under the processor telling the student to click the parts
          // phone layout: processor on top, bus across the middle, memory and I/O side by side below
          const regN = (id, x, y, ab, sub) => hot(id, `<rect class="fr s-panel" x="${x}" y="${y}" width="180" height="40" rx="8" stroke-width="2" style="stroke:var(--cpu)"/><text x="${x + 90}" y="${y + 17}" text-anchor="middle" class="s-monot" font-size="15" font-weight="800">${ab}</text><text x="${x + 90}" y="${y + 33}" text-anchor="middle" font-size="13" class="s-sub">${sub}</text>`);  // regN(...): the phone version of reg(), with wider, shorter register boxes
          const NARROW = () => {  // builds the drawing for phone-width screens: processor on top, bus across the middle, memory and I/O below
            let y = 318;  // y: the position of the next memory row in the phone drawing
            const rowsN = rows.map((r) => {  // rowsN: builds every memory row for the phone drawing, the same way as cellRows but smaller
              if (!r) { const t = `<text x="44" y="${y + 13}" text-anchor="middle" font-size="15" font-weight="800" class="s-sub">⋮</text><text x="150" y="${y + 13}" text-anchor="middle" font-size="15" font-weight="800" class="s-sub">⋮</text>`; y += 18; return t; }  // for the null gap: two vertical dots and a small step down
              const t = `<rect x="16" y="${y}" width="56" height="23" rx="5" class="s-panel"/><text x="44" y="${y + 16}" text-anchor="middle" class="s-monot" font-size="13" font-weight="700">${r[0]}</text>` +  // a normal row: the address box with its number
                `<rect x="78" y="${y}" width="144" height="23" rx="5" class="${r[2] === 'i' ? 's-cpu' : 's-mem'}" stroke-width="1"/><text x="150" y="${y + 16}" text-anchor="middle" font-size="13">${r[1]}</text>`;  // and the contents box, blue for an instruction or green for data
              y += 26; return t;  // moves down to the next row and hands back this row's drawing
            }).join('');  // joins all the phone rows into one piece of SVG text
            const devN = ['Disk', 'Network', 'Terminal'].map((d, k) => `<rect x="244" y="${414 + k * 38}" width="136" height="32" rx="8" class="s-io" stroke-width="1.5"/><text x="312" y="${435 + k * 38}" text-anchor="middle" font-size="14" font-weight="700">${d}</text><line x1="380" y1="${430 + k * 38}" x2="388" y2="${430 + k * 38}" class="s-line" stroke-width="2"/>`).join('');  // devN: the three device boxes stacked at the bottom right of the phone drawing
            return `<line x1="200" y1="218" x2="200" y2="226" class="s-line" stroke-width="4"/><line x1="116" y1="260" x2="116" y2="274" class="s-line" stroke-width="4"/><line x1="316" y1="260" x2="316" y2="274" class="s-line" stroke-width="4"/><line x1="388" y1="404" x2="388" y2="506" class="s-line" stroke-width="2"/>` +  // connector lines for the phone layout: processor to bus, bus to memory and to I/O, and the device wiring
              hot('cpu', `<rect class="fr s-cpu" x="6" y="6" width="388" height="212" rx="14" stroke-width="2"/><text x="18" y="28" font-size="14" font-weight="800" style="fill:var(--cpu)">PROCESSOR (CPU)</text>`) +  // the processor box across the top
              regN('pc', 16, 38, 'PC', 'next instruction') + regN('ir', 204, 38, 'IR', 'being executed') +  // PC and IR registers
              regN('mar', 16, 84, 'MAR', 'memory address') + regN('mbr', 204, 84, 'MBR', 'memory data') +  // MAR and MBR registers
              regN('ioar', 16, 130, 'I/O AR', 'which device') + regN('iobr', 204, 130, 'I/O BR', 'I/O data') +  // I/O AR and I/O BR registers
              hot('exec', `<rect class="fr s-panel" x="16" y="176" width="368" height="32" rx="8" stroke-width="2" style="stroke:var(--cpu)"/><text x="200" y="197" text-anchor="middle" font-size="14"><tspan font-weight="800">Execution unit</tspan><tspan class="s-sub"> · adds, compares, moves</tspan></text>`) +  // the execution unit as one flat bar with its job written beside the name
              hot('bus', `<rect class="fr s-accent" x="6" y="226" width="388" height="34" rx="12" stroke-width="2"/><text x="200" y="248" text-anchor="middle" font-size="14" font-weight="800" style="fill:var(--accent)">SYSTEM BUS</text>`) +  // the bus as a horizontal bar across the middle
              hot('mem', `<rect class="fr s-mem" x="6" y="274" width="226" height="258" rx="14" stroke-width="2"/><text x="18" y="294" font-size="14" font-weight="800" style="fill:var(--mem)">MAIN MEMORY</text><text x="44" y="312" text-anchor="middle" font-size="13" class="s-sub">address</text><text x="150" y="312" text-anchor="middle" font-size="13" class="s-sub">contents</text>`) +  // the main memory box, bottom left, with its column headings
              hot('cells', `<rect class="fr" x="12" y="300" width="214" height="224" rx="8" fill="transparent" stroke-width="0" style="stroke:var(--mem)"/>${rowsN}`) +  // the invisible clickable frame around the memory rows
              hot('io', `<rect class="fr s-io" x="244" y="274" width="150" height="130" rx="14" stroke-width="2"/><text x="256" y="294" font-size="14" font-weight="800" style="fill:var(--io)">I/O MODULE</text>`) +  // the I/O module box, bottom right
              hot('buf', `<rect class="fr" x="252" y="300" width="134" height="98" rx="8" fill="transparent" stroke-width="0" style="stroke:var(--io)"/>${[0, 1, 2, 3].map((k) => `<rect class="s-panel" x="${258 + (k % 2) * 62}" y="${304 + Math.floor(k / 2) * 36}" width="54" height="28" rx="6" stroke-width="1.5"/>`).join('')}<text x="319" y="392" text-anchor="middle" font-size="13" class="s-sub">buffers</text>`) +  // the invisible clickable frame around the four buffer squares
              hot('dev', `<rect class="fr" x="240" y="410" width="154" height="116" rx="10" fill="transparent" stroke-width="0" style="stroke:var(--io)"/>${devN}`);  // the invisible clickable frame around the device boxes
          };  // ends the phone drawing builder
          svg.innerHTML = (ctx.narrow ? NARROW() : WIDE()) + '<g class="s1-paths" style="pointer-events:none"></g>';  // draws the layout that fits the screen, plus an empty group for highlight paths that ignores clicks
          const paths = svg.querySelector('.s1-paths');  // paths: that empty group; show() draws the highlighted route of a register's value into it
          const ROWY = { mar: 225, mbr: 225, ioar: 281, iobr: 281 };  // ROWY: the y position of each exchange register's row in the wide drawing, where its path starts
          const COLX = { mar: 106, mbr: 294, ioar: 106, iobr: 294 };  // COLX: the x position (distance from the left) of each exchange register in the phone drawing
          const pathFor = (id, tgt) => (ctx.narrow  // pathFor(id, tgt): builds the route from a register across the bus to memory or the I/O module
            ? `M${COLX[id]} ${id.startsWith('io') ? 160 : 114} V243 H${tgt === 'mem' ? 116 : 316} V290`  // phone route: down from the register, along the bus, then down into memory or the I/O module
            : `M290 ${ROWY[id]} H332 V${tgt === "mem" ? 150 : 412} H392`);  // wide route: right from the register onto the bus, along it, then right into memory or the I/O module
          const seen = new Set();  // seen: the set of parts the student has already clicked, used for the progress meter
          const meter = h('div', { class: 'meter grow' }, h('i', { style: { width: '0%' } }));  // progress meter bar; its inner i element grows as more parts are explored
          const count = h('span', { class: 'small b num' });  // the "n / 14" counter next to the meter
          let last = -1;  // last: position in ORDER of the part shown last, so the Tour button knows which comes next (-1 = none)
          const tour = h('button', { type: 'button', class: 'btn sm', title: 'Show the next part in order', onclick: () => { last = (last + 1) % ORDER.length; show(ORDER[last]); } }, 'Tour ▶');  // Tour button: each press shows the next part in ORDER, wrapping round to the first after the last
          const info = h('div', { class: 'stack gap-s s2-info', 'aria-live': 'polite' });  // info panel beside the drawing; screen readers announce it each time a new part is shown
          function show(id) {  // show(id): displays one part's facts, highlights it and its related parts, and draws its data path; runs on every click
            seen.add(id); last = ORDER.indexOf(id);  // records the part as explored and remembers its place in ORDER so Tour continues from here
            svg.querySelectorAll('.hot').forEach((g) => { g.classList.toggle('sel', g.dataset.id === id); g.classList.toggle('rel', P[id][5].includes(g.dataset.id)); });  // marks the clicked part as selected (thick frame) and its related parts with a dashed frame
            const tgt = P[id][6];  // tgt: where this part's value travels ("mem" or "io"); only the four exchange registers have one
            paths.innerHTML = tgt ? `<path d="${pathFor(id, tgt)}" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" style="stroke:var(--accent);opacity:.4"/>` : '';  // draws a thick, faint accent line along the register's route across the bus, or clears the old one
            const [name, col, what, facts, ana] = P[id];  // unpacks the part's entry: name, colour, description, key facts and kitchen analogy
            info.innerHTML = `<div><span class="chip ${col}">${seen.size} of ${ORDER.length} explored</span></div><h3 class="m0">${name}</h3><p class="m0">${what}</p>` +  // fills the info panel: a chip with the explored count, the part name as a heading, and what it does
              `<ul class="small m0">${facts.map((f) => `<li>${f}</li>`).join('')}</ul><div class="callout analogy m0" data-label="Kitchen analogy">${ana}</div>`;  // then the key facts as a bullet list and the kitchen analogy in a callout box
            meter.firstChild.style.width = (seen.size / ORDER.length) * 100 + '%';  // stretches the meter to the share of parts explored so far
            count.textContent = `${seen.size} / ${ORDER.length}`;  // updates the counter next to the meter, e.g. "5 / 14"
            if (seen.size === ORDER.length) count.textContent = 'All ' + ORDER.length + ' ✓';  // once every part has been clicked the counter says "All 14" with a tick
          }  // ends show()
          const pick = (e) => { const g = e.target.closest && e.target.closest('.hot'); if (g) show(g.dataset.id); };  // pick(e): finds the clicked part group and shows it
          svg.addEventListener('click', pick);  // a mouse click or tap on the drawing shows that part
          svg.addEventListener('pointerdown', (e) => { if (!e.isTrusted) pick(e); });  // lets the guide's automatic checker click parts with a script-made pointerdown event
          svg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });  // Enter or Space on a focused part shows it, so the diagram also works from the keyboard
          info.innerHTML = `<h3 class="m0">Four elements, one picture</h3><p class="m0">This is the classic top-level view of a computer. The <span class="t">processor</span> is ${ctx.narrow ? 'at the top' : 'on the left'}, <span class="t">main memory</span> and an <span class="t">I/O module</span> ${ctx.narrow ? 'at the bottom' : 'on the right'}, and the <span class="t">system bus</span> joins them all.</p>` +  // starting text in the info panel before anything is clicked: a heading and where each element sits on screen
            `<p class="m0">The processor holds small, fast storage slots called <span class="t">registers</span>. Six are drawn here: two drive the running program (PC and IR) and four carry every exchange with memory and I/O. A real processor also has many others, for example registers that hold the numbers a program is working on.</p>` +  // starting text, paragraph 2: registers are small fast slots in the processor; six are drawn here
            `<div class="callout tip m0" data-label="Try this">Click all ${ORDER.length} parts. Clicking a register lights up the path its value takes across the bus.</div>` +  // starting text: a "Try this" tip to click every part and watch the register paths light up
            `<div class="row gap-s"><span class="chip cpu">processor + registers</span><span class="chip mem">memory</span><span class="chip io">I/O</span><span class="chip accent">bus</span></div>`;  // starting text: colour key chips for processor, memory, I/O and bus
          count.textContent = `0 / ${ORDER.length}`;  // the counter starts at "0 / 14"
          el.append(h('div', { class: 'split r fill' },  // puts the page together: a two-column layout filling the page, with the wider column (class r) on the left for the drawing
            h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center', padding: '10px' } }, svg),  // left: a white card that centres the SVG drawing
            h('div', { class: 'stack' }, h('div', { class: 'row nw' }, h('span', { class: 'small b muted' }, 'Explored'), meter, count, tour), info)));  // right: a row with the "Explored" label, meter, counter and Tour button, then the info panel
        },  // ends render() for step 2
      },  // closes step 2
      /* ---------------- 3. The four exchange registers: a placement puzzle ---------------- */
      {  // opens step 3: a puzzle about the four registers that exchange data
        title: 'Where and what: the four exchange registers',  // step 3 title
        kind: 'explore',  // kind "explore" labels the page as an Explore step
        html: `${/* the fixed HTML for step 3 */''}
          <div class="split l fill">${/* two-column layout: reading on the left, the puzzle in the wider right column (class l) */''}
            <div class="stack">${/* left column: a vertical stack */''}
              <p class="lead m0">Four of the processor’s <span class="t">registers</span> exist only to exchange data with the rest of the machine. They come in two pairs.</p>${/* opening paragraph: four registers exist only to exchange data, in two pairs */''}
              <div class="s3-grid">${/* start of the where/what table (a CSS grid of 3 columns) */''}
                <span></span><span class="hd">Where (address)</span><span class="hd">What (the data)</span>${/* table header row: an empty corner, then "Where (address)" and "What (the data)" */''}
                <span class="side" style="color:var(--mem)">Memory</span>${/* row label: Memory */''}
                <div class="box cpu"><b class="mono">MAR</b><div class="xs muted">cell for the next read or write</div></div>${/* table cell: the MAR, which names the cell for the next read or write */''}
                <div class="box cpu"><b class="mono">MBR</b><div class="xs muted">data to write, or data just read</div></div>${/* table cell: the MBR, which holds the data written or just read */''}
                <span class="side" style="color:var(--io)">I/O</span>${/* row label: I/O */''}
                <div class="box cpu"><b class="mono">I/O AR</b><div class="xs muted">which particular device</div></div>${/* table cell: the I/O AR, which names a particular device */''}
                <div class="box cpu"><b class="mono">I/O BR</b><div class="xs muted">data to or from an I/O module</div></div>${/* table cell: the I/O BR, which carries data to or from an I/O module */''}
              </div>${/* ends the where/what table */''}
              <p class="small m0">The <span class="t">memory address register (MAR)</span> names the memory cell for the next read or write; the <span class="t">memory buffer register (MBR)</span> holds the data to be written or receives the data read. The <span class="t">I/O AR</span> names a particular device; the <span class="t">I/O BR</span> carries data between an I/O module and the processor.</p>${/* paragraph: the full names and jobs of the four registers, each linked to the glossary */''}
              <div class="callout warn m0" data-label="Common mistake">Thinking the MAR holds data. An address register only ever says <i>where</i>. The value itself always rides in a buffer register.</div>${/* "common mistake" box: an address register never holds the data itself */''}
            </div>${/* closes the left column */''}
            <div class="card white stack s3-game"></div>${/* right column: an empty white card that render() fills with the placement game */''}
          </div>`,  // closes the layout and ends the step 3 HTML
        render(el, ctx) {  // render(el, ctx): builds the placement game each time step 3 is shown
          const { h } = ctx;  // takes the element-building helper h out of ctx
          const game = el.querySelector('.s3-game');  // game: the empty card from the HTML where the puzzle goes
          const REG = {  // REG: the four register slots as [name, role label, kind (addr or data), pair (mem or io)]
            mar: ['MAR', 'memory · where', 'addr', 'mem'], mbr: ['MBR', 'memory · what', 'data', 'mem'],  // the memory pair: MAR (memory, where) and MBR (memory, what)
            ioar: ['I/O AR', 'I/O · which device', 'addr', 'io'], iobr: ['I/O BR', 'I/O · what', 'data', 'io'],  // the I/O pair: I/O AR (which device) and I/O BR (I/O data)
          };  // closes REG
          const S = [  // S: the five scenarios; t = task text, p = values to place, done = message when solved
            { t: 'The processor needs the number in <b>memory cell 12</b>, which holds <b>305</b>.',  // scenario 1 task: read memory cell 12, which holds 305
              p: [['12', 'the cell to read', 'addr', ['mar']], ['305', 'the value that comes back', 'data', ['mbr']]],  // scenario 1 values: 12 is an address for the MAR, 305 is data for the MBR (each value lists the registers that accept it)
              done: 'Exactly. The MAR sends out <b>12</b> to say <i>where</i>; the word <b>305</b> comes back and lands in the MBR.' },  // scenario 1 solved message: the MAR says where, the value lands in the MBR
            { t: 'The program wants to <b>write the value 42</b> into <b>memory cell 7</b>.',  // scenario 2 task: write 42 into memory cell 7
              p: [['42', 'the value to store', 'data', ['mbr']], ['7', 'the cell to write', 'addr', ['mar']]],  // scenario 2 values: 42 goes to the MBR, 7 goes to the MAR
              done: 'Right. For a write the processor fills <i>both</i> registers before the transfer: MAR = 7 (where), MBR = 42 (what).' },  // scenario 2 solved message: a write fills both registers before the transfer
            { t: 'Send the letter <b>H</b> to the <b>printer</b>, which is I/O device number <b>2</b>.',  // scenario 3 task: send the letter H to the printer, device 2
              p: [['H', 'the character to print', 'data', ['iobr']], ['2', 'the printer’s device number', 'addr', ['ioar']]],  // scenario 3 values: H goes to the I/O BR, 2 goes to the I/O AR
              done: 'Yes. A device is not a memory cell, so the I/O pair is used: I/O AR = 2 picks the printer and I/O BR = H is the data.' },  // scenario 3 solved message: devices use the I/O pair, not the memory pair
            { t: 'Store the number <b>9</b> in <b>memory cell 9</b>. Same number, two different jobs.',  // scenario 4 task: store 9 in cell 9, the same number with two jobs
              p: [['9', 'the value to store', 'data', ['mbr']], ['9', 'the cell number', 'addr', ['mar']]],  // scenario 4 values: one 9 is data for the MBR, the other is an address for the MAR
              done: 'Well spotted. The bits are identical, but the register gives them their meaning: in the MAR, 9 is a <i>place</i>; in the MBR, 9 is a <i>value</i>.' },  // scenario 4 solved message: the register, not the bits, gives a number its meaning
            { t: 'The letter <b>q</b> is waiting at the <b>keyboard</b> (I/O device <b>1</b>). Bring it in, then store it in <b>memory cell 200</b>.',  // scenario 5 task: bring the letter q in from the keyboard (device 1) and store it in cell 200
              p: [['q', 'arriving from the keyboard', 'data', ['iobr', 'mbr']], ['200', 'where q will be kept', 'addr', ['mar']], ['1', 'which device to read', 'addr', ['ioar']], ['q', 'on its way to memory', 'data', ['iobr', 'mbr']]],  // scenario 5 values: q may go in the I/O BR or the MBR, 200 in the MAR, 1 in the I/O AR
              done: 'Complete trip! The key press came in through the I/O pair (I/O AR = 1, I/O BR = q) and went on to memory through the memory pair (MAR = 200, MBR = q).' },  // scenario 5 solved message: the key press used the I/O pair, then the memory pair
          ];  // closes the scenario list
          let si = 0, pick = -1, placed = {}, used = new Set();  // game state: si = current scenario, pick = chosen value (-1 = none), placed = register to value, used = values placed
          const head = h('div', { class: 'row' });  // head: the row with the scenario chip and progress dots
          const task = h('p', { class: 'm0 s3-task' });  // task: the paragraph that states the current job
          const slots = {};  // slots: the four register buttons, looked up by register id
          const slotWrap = h('div', { class: 's3-slots' });  // slotWrap: the 2 x 2 grid that holds the register buttons
          Object.keys(REG).forEach((r) => {  // makes one button per register, in REG order
            slots[r] = h('button', { type: 'button', class: 's3-slot', onclick: () => place(r) });  // each register slot is a button; clicking it tries to place the picked value there
            slotWrap.append(slots[r]);  // adds the button to the grid
          });  // ends the loop over registers
          const tray = h('div', { class: 'row s3-tray' });  // tray: the row of value cards still waiting to be placed
          const fb = h('div', { class: 'player-cap s3-fb', 'aria-live': 'polite' });  // fb: the feedback box; screen readers announce each new message
          const bReset = h('button', { type: 'button', class: 'btn sm', onclick: () => load(si) }, 'Reset scenario');  // "Reset scenario" button: reloads the current scenario from scratch
          const bNext = h('button', { type: 'button', class: 'btn sm primary', onclick: () => load(si + 1 >= S.length ? 0 : si + 1) });  // next button: goes to the next scenario, or back to the first after the last one
          game.append(head, task, slotWrap, h('div', { class: 'xs muted b' }, 'VALUES TO PLACE: click one, then click its register'), tray, fb, h('div', { class: 'row', style: { marginTop: 'auto' } }, bReset, h('span', { class: 'grow' }), bNext));  // puts the head, task, slots, a small instruction label, tray, feedback and buttons into the card
          function paint() {  // paint(): redraws the game from the state variables; runs after every change
            const sc = S[si];  // sc: the scenario now being played
            head.innerHTML = `<span class="chip accent">Scenario ${si + 1} of ${S.length}</span>` + S.map((_, k) => `<span class="s3-dot${k < si ? ' done' : k === si ? ' on' : ''}"></span>`).join('');  // draws the "Scenario n of 5" chip and one dot per scenario (done, current or still to come)
            task.innerHTML = sc.t;  // shows the task sentence
            Object.entries(REG).forEach(([r, [nm, role]]) => {  // updates each register slot from what has been placed
              const v = placed[r];  // v: the value placed in this register so far, if any
              slots[r].className = 's3-slot' + (v != null ? ' full' : '');  // marks the slot "full" once it holds a value (the CSS turns it green)
              slots[r].innerHTML = `<span class="stack gap-s" style="gap:0"><b class="mono nm">${nm}</b><span class="xs muted">${role}</span></span><span class="mono val">${v != null ? ctx.util.esc(v) : '—'}</span>`;  // writes the register name and role on the left and the value (or a dash) on the right; esc makes the value safe to show as text
            });  // ends the loop over slots
            tray.innerHTML = '';  // empties the tray before refilling it
            sc.p.forEach((p, k) => {  // goes through the scenario's values in order
              if (used.has(k)) return;  // skips values that have already been placed
              tray.append(h('button', { type: 'button', class: 's3-parcel' + (pick === k ? ' on' : ''), onclick: () => { pick = pick === k ? -1 : k; paint(); } },  // adds a value card button; clicking it picks the value up, or puts it down if it was already picked
                h('b', { class: 'mono' }, p[0]), h('span', { class: 'xs muted' }, p[1])));  // inside the card: the value in bold monospaced text and its short description underneath
            });  // ends the loop over values
            if (used.size === sc.p.length) tray.append(h('span', { class: 'chip ok' }, '✓ every value placed'));  // when every value is placed, the tray shows a green "every value placed" chip instead
            const complete = used.size === sc.p.length;  // complete is true once all of this scenario's values are in registers
            bNext.textContent = si === S.length - 1 && complete ? 'Start over' : 'Next scenario ▶';  // the next button reads "Start over" after the last scenario, otherwise "Next scenario"
            bNext.disabled = !complete;  // the next button stays disabled until the scenario is complete
          }  // ends paint()
          function say(html, cls) { fb.innerHTML = html; fb.className = 'player-cap s3-fb' + (cls ? ' ' + cls : ''); }  // say(html, cls): writes a message in the feedback box; cls "bad" or "good" colours the box red or green
          function place(r) {  // place(r): tries to put the picked value into register r; runs when a register slot is clicked
            const sc = S[si];  // sc: the current scenario
            if (pick < 0) { say(placed[r] != null ? `The ${REG[r][0]} already holds <b>${ctx.util.esc(placed[r])}</b> for this job.` : 'First click one of the values below, then click the register it belongs in.'); return; }  // no value picked yet: explains what to do (or what the register already holds) and stops
            const [v, d, kind, ok] = sc.p[pick];  // unpacks the picked value: v = the value, d = its description, kind = addr or data, ok = registers that accept it
            const [nm, , rk, rs] = REG[r];  // unpacks the clicked register: its name, its kind (addr or data) and its pair (mem or io)
            if (placed[r] != null) { say(`The ${nm} is already holding <b>${ctx.util.esc(placed[r])}</b> for this job. Try another register.`, 'bad'); return; }  // a register that is already filled cannot take a second value: red message and stop
            if (!ok.includes(r)) {  // wrong register for this value: explain why
              let why;  // why will hold the explanation
              if (kind !== rk) why = kind === 'addr' ? `<b>${v}</b> is a <i>where</i> (${d}). Where-values go in an address register: MAR for memory, I/O AR for a device.` : `<b>${v}</b> is the data itself (${d}). Address registers only say where; data travels in a buffer register (MBR or I/O BR).`;  // wrong kind: a where-value put in a data register, or a data value put in an address register
              else why = rs === 'mem' ? `Right kind of register, wrong pair. This part of the job involves an <b>I/O device</b>, so it uses the I/O AR / I/O BR pair.` : `Right kind of register, wrong pair. This part of the job involves a <b>memory cell</b>, so it uses the MAR / MBR pair.`;  // right kind but wrong pair: a memory value in an I/O register, or the other way round
              say('<b style="color:var(--bad)">Not the ' + nm + '.</b> ' + why, 'bad');  // shows the explanation in red
              slots[r].classList.add('nope'); ctx.after(600, () => slots[r].classList.remove('nope'));  // flashes the slot red, then clears it 0.6 s later (ctx.after is a timer the guide cancels if the student leaves the step)
              return;  // stops here after a wrong attempt
            }  // ends the wrong-register case
            placed[r] = v; used.add(pick); pick = -1;  // correct: stores the value in the register, marks the value used and puts nothing in the hand
            paint();  // redraws the game with the new value in place
            slots[r].classList.add('flash');  // makes the filled slot flash briefly (a shared guide animation)
            if (used.size === sc.p.length) say('<b style="color:var(--ok)">✓ Scenario solved.</b> ' + sc.done + (si === S.length - 1 ? ' <b>All five scenarios done.</b>' : ''), 'good');  // last value placed: green "Scenario solved" message, plus a note when all five scenarios are done
            else say(`<b style="color:var(--ok)">✓ ${nm} = ${ctx.util.esc(v)}.</b> ${rk === 'addr' ? 'An address register says where.' : 'A buffer register carries the data.'} Place the next value.`);  // otherwise: confirms the placement, reminds what that kind of register does, and asks for the next value
          }  // ends place()
          function load(n) {  // load(n): starts scenario n with empty registers and nothing picked
            si = n; pick = -1; placed = {}; used = new Set();  // resets the scenario number and all game state
            paint();  // draws the fresh scenario
            say('Click a value, then click the register that should hold it. Think: is it a <i>where</i> or a <i>what</i>? Memory or a device?');  // shows the starting instruction: decide whether each value is a where or a what, memory or device
          }  // ends load()
          load(0);  // starts the game at scenario 1 when the step opens
        },  // ends render() for step 3
      },  // closes step 3
      /* ---------------- 4. Main memory: numbered cells holding bit patterns ---------------- */
      {  // opens step 4: main memory as a row of numbered cells
        title: 'Main memory: a long row of numbered cells',  // step 4 title
        kind: 'explore',  // kind "explore" labels the page as an Explore step
        render(el, ctx) {  // render(el, ctx): builds the memory explorer each time step 4 is shown
          const { h } = ctx;  // takes the element-building helper h out of ctx
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          // a tiny program (cells 0-2), its data (8-10), some text (4) and leftover bits elsewhere
          const KNOWN = {  // KNOWN: the cells with a planned meaning, as address: [16-bit word in hex, i or d, explanation]
            0: [0x1008, 'i', 'an <b>instruction</b>: the program’s first step, “load the number in cell 8”.'],  // cell 0: hex 1008, the instruction "load the number in cell 8"
            1: [0x5009, 'i', 'an <b>instruction</b>: the second step, “add the number in cell 9”.'],  // cell 1: hex 5009, the instruction "add the number in cell 9"
            2: [0x200A, 'i', 'an <b>instruction</b>: the third step, “store the result in cell 10”.'],  // cell 2: hex 200A, the instruction "store the result in cell 10"
            4: [0x4869, 'd', '<b>data</b>: two letters of text, “Hi”. Each letter is kept as its number code: H = 72 (hex 48) and i = 105 (hex 69).'],  // cell 4: hex 4869, the text "Hi" stored as two letter codes
            8: [0x0019, 'd', '<b>data</b>: the first number the program adds. Hex 0019 = 1×16 + 9 = <b>25</b> in decimal.'],  // cell 8: hex 0019, the number 25 that the program adds
            9: [0x0011, 'd', '<b>data</b>: the second number the program adds. Hex 0011 = 1×16 + 1 = <b>17</b> in decimal.'],  // cell 9: hex 0011, the number 17 that the program adds
            10: [0x002A, 'd', '<b>data</b>: the result once the program has run. Hex 002A = 2×16 + 10 = <b>42</b>, and 25 + 17 = 42.'],  // cell 10: hex 002A, the result 42
          };  // closes KNOWN
          const rng = ctx.util.seeded(11);  // rng: a seeded random number generator, so the "random" leftover bits come out the same on every visit
          const LEFT = Array.from({ length: 64 }, (_, a) => (a > 10 && rng() < 0.3 ? Math.floor(rng() * 0x10000) : 0));  // LEFT: 64 cells of leftover bits; above cell 10, about 3 in 10 cells get a random 16-bit value, the rest are zero
          const word = (a) => (KNOWN[a] ? KNOWN[a][0] : LEFT[a]);  // word(a): the 16-bit contents of cell a, taken from KNOWN if planned, otherwise from LEFT
          const role = (a) => (KNOWN[a] ? KNOWN[a][1] : 'f');  // role(a): i (instruction), d (data) or f (free, unused) for cell a; the grid colours cells by it
          const OPS = { 1: 'load from cell', 2: 'store into cell', 5: 'add from cell' };  // OPS: the only operations this toy machine knows, by their first hex digit
          let k = 5, sel = 0;  // k = number of address bits (5 gives 32 cells to start); sel = the address of the opened cell
          const readout = h('div', { class: 'card tight s4-read' });  // readout card: shows how k bits turn into n cells
          const slider = ctx.ui.slider({ label: 'Address bits (k)', min: 4, max: 6, value: k, format: (v) => v + ' bits', onInput: (v) => { k = v; if (sel >= 1 << k) sel = 0; paint(); } });  // slider for k from 4 to 6 bits; moving it redraws the grid and closes a cell that no longer exists
          const grid = h('div', { class: 's4-grid' });  // grid: the box that holds one button per memory cell
          const detail = h('div', { class: 'card s4-detail', 'aria-live': 'polite' });  // detail: the card that explains the opened cell; screen readers announce changes
          el.append(h('div', { class: 'split l fill' },  // builds the page: a two-column layout with the grid in the wider right column
            h('div', { class: 'stack' },  // left column: a vertical stack of text and controls
              h('p', { class: 'lead m0', html: '<span class="t">Main memory</span> is a long row of storage cells. Each cell has a number, its <span class="t">address</span>, and holds a pattern of <span class="t">bits</span>.' }),  // opening paragraph: memory is a row of cells, each with an address and a bit pattern
              h('p', { class: 'm0', html: 'With <b>n</b> cells, the addresses run 0, 1, 2 … up to <b>n − 1</b>. To use a cell, the processor puts its address in the MAR; the bits that come back are the cell’s <b>contents</b>: an <span class="t">instruction</span> or <span class="t">data</span>.' }),  // paragraph: with n cells the addresses run 0 to n - 1, and the MAR is used to reach a cell
              slider, readout,  // the address-bits slider and its readout
              h('div', { class: 'callout warn m0', 'data-label': 'Two common mistakes', html: 'The last address is <b>n − 1</b>, not n, because counting starts at 0. And an address is not the contents: cell 5 does not hold 5; it holds whatever was last written there.' }),  // "two common mistakes" box: the last address is n - 1, and an address is not the contents
              h('div', { class: 'callout tip m0', 'data-label': 'Reading hex', html: 'The grid writes each cell in <b>hex</b> (base 16): one digit for every 4 bits, counting 0–9 and then A–F (A&nbsp;=&nbsp;10 … F&nbsp;=&nbsp;15). So hex 0019 = 1×16 + 9 = <b>25</b>.' })),  // "reading hex" box: how base-16 digits work, with the example 0019 = 25
            h('div', { class: 'card white stack' },  // right column: a white card with the grid
              h('div', { class: 'row' }, h('span', { class: 'chip cpu' }, 'instruction'), h('span', { class: 'chip mem' }, 'data'), h('span', { class: 'chip' }, 'unused'), h('span', { class: 'small muted' }, 'Click a cell to open it. Try 0–2 and 8–10, then 4.')),  // colour key chips (instruction, data, unused) and a hint about which cells to try
              grid, detail)));  // the grid of cells and the detail card below it
          let builtN = 0;  // builtN: how many cells the grid was last built with, so it is rebuilt only when k changes
          function paint() {  // paint(): updates the readout, grid and detail card; runs at start, on slider moves and on cell clicks
            const n = 1 << k;  // n = 2 to the power k, computed by shifting 1 left k places
            readout.innerHTML = `k = ${k} bits → n = 2<sup>${k}</sup> = <b>${n} cells</b>, addresses <b>0 to ${n - 1}</b>.<div class="xs muted">Toy cells hold 16 bits; real machines give every 8-bit byte its own address.</div>`;  // readout text: k bits give n cells with addresses 0 to n - 1, plus a note on real byte addresses
            if (builtN !== n) {  // rebuild the grid only when the number of cells has changed
              builtN = n;  // remembers the new cell count
              grid.className = 's4-grid' + (n === 64 ? ' dense' : '') + (n === 16 ? ' roomy' : '');  // picks the grid style: dense for 64 cells, roomy for 16, normal for 32
              grid.innerHTML = '';  // clears the old cells
              for (let a = 0; a < n; a++) {  // makes one button for every address from 0 to n - 1
                grid.append(h('button', { type: 'button', class: 's4-cell r-' + role(a) + (a === n - 1 ? ' last' : ''), 'data-a': a, title: a === n - 1 ? 'The last cell: address n − 1' : 'Cell ' + a, onclick: () => { sel = a; paint(); } },  // cell button coloured by its role, marked "last" if it is address n - 1; clicking opens that cell
                  h('span', { class: 'ad' }, String(a)), h('span', { class: 'mono ct' }, hex4(word(a)))));  // the button shows the address above the contents written as 4 hex digits
              }  // ends the loop over addresses
            }  // ends the rebuild
            grid.querySelectorAll('.s4-cell').forEach((b) => b.classList.toggle('on', +b.dataset.a === sel));  // marks only the opened cell as "on"
            const w = word(sel), op = w >>> 12, ad = w & 0xFFF, hi = w >>> 8, lo = w & 0xFF;  // splits the opened word: op = first 4 bits, ad = last 12 bits, hi and lo = its two 8-bit halves
            const pr = (c) => c >= 32 && c < 127;  // pr(c): true if the number c is the code of a printable letter or symbol (32 to 126)
            const txt = pr(hi) && pr(lo) ? '“' + String.fromCharCode(hi) + String.fromCharCode(lo) + '”' : '<span class="muted">not printable</span>';  // txt: the word read as two letters, or "not printable" if either half is not a letter code
            // the toy machine only knows operations 1, 2 and 5; any other first digit cannot run as an instruction
            const ins = OPS[op] ? `“${OPS[op]} ${ad}”` : '<span class="muted">no such operation</span>';  // ins: the word read as an instruction, if its first hex digit is a known operation
            const insSub = OPS[op] ? 'first 4 bits = operation, last 12 = cell' : `This toy machine has no operation ${op}, so this word can only be data.`;  // insSub: the note under the instruction reading, which says why a word cannot be an instruction
            const what = KNOWN[sel] ? KNOWN[sel][2] : (w ? '<b>unused</b>: leftover bits from an earlier program. No program is using them now.' : '<b>unused</b>: it holds all zeros. A cell is never truly empty; it always holds <i>some</i> bits.');  // what: the role of this cell, from KNOWN or a note about unused cells (a cell always holds some bits)
            detail.innerHTML = `<div class="row" style="justify-content:space-between"><b>Address ${sel}${sel === n - 1 ? ' <span class="chip accent">last cell = n − 1</span>' : ''}</b><span class="small muted mono">address in binary: ${bits(sel, k)}</span></div>` +  // detail card, first row: the address (with a "last cell" chip) and the address written in binary
              `<div class="small">Contents (16 bits): <b class="mono">${nib(bits(w, 16))}</b> <span class="muted">(hex ${hex4(w)})</span></div>` +  // the contents as 16 bits in groups of four, and in hex
              `<div class="s4-reads"><div><span class="xs muted b">AS A NUMBER</span><b class="mono">${w}</b><span class="xs muted">all 16 bits, in decimal</span></div><div><span class="xs muted b">AS TWO LETTERS</span><b>${txt}</b><span class="xs muted">each letter is stored as a number code (8 bits)</span></div><div><span class="xs muted b">AS AN INSTRUCTION</span><b class="small">${ins}</b><span class="xs muted">${insSub}</span></div></div>` +  // three readings of the same bits: as a decimal number, as two letters and as an instruction
              `<div class="small">Its role here: ${what}</div>`;  // the cell's role in this toy program
            ctx.refit();  // asks the guide to re-check that the page still fits without overflowing
          }  // ends paint()
          paint();  // draws the memory explorer for the first time when the step opens
        },  // ends render() for step 4
      },  // closes step 4
      /* ---------------- 5. Follow the data across the bus ---------------- */
      {  // opens step 5: an animated lab that follows data across the system bus
        title: 'Follow the data across the system bus',  // step 5 title
        kind: 'lab',  // kind "lab" labels the page as a Hands-on Lab
        core: true,  // core: true keeps this step on the guide's shorter core route
        render(el, ctx) {  // render(el, ctx): builds the bus animation each time step 5 is shown
          const { h } = ctx;  // takes the element-building helper h out of ctx
          const esc = ctx.util.esc;  // esc: the guide helper that makes text safe to put inside HTML or SVG (turns < and & into harmless codes)
          // two layouts share one drawing routine: wide (laptop / projector) and tall (phone)
          const G = ctx.narrow ? {  // G: every position and size for the drawing; this first set is the tall layout used on phone-width screens
            vb: '0 0 400 548', proc: [6, 6, 388, 150], regs: { mar: [18, 40], mbr: [146, 40], ioar: [18, 98], iobr: [146, 98] }, regW: 120, regH: 50, exec: [274, 40, 110, 108],  // phone: coordinate grid, processor box, register positions and sizes, execution unit box
            mem: [6, 250, 352, 108], cell: (i) => 16 + i * 42, cellY: 280, cellW: 38, cellH: 44, valFont: 17, addrY: 348, memNote: '',  // phone: memory box, where each of the 8 cells sits, cell size, value font size and where addresses go
            bus: [6, 170, 388, 66], lanes: { a: 188, d: 206, c: 224 }, labelX: 14, laneX: [80, 386], tokX: () => 250,  // phone: the bus box, the height of its three lines (address, data, control), label and line positions, token spot
            wires: [[77, 156, 77, 170], [205, 156, 205, 170], [200, 236, 200, 250], [380, 236, 380, 372], [100, 372, 380, 372], [100, 372, 100, 380], [300, 372, 300, 380]],  // phone: connector wires as [x1, y1, x2, y2] between the boxes and the bus
            mods: { 1: [6, 380], 2: [206, 380] }, modW: 188, slot: [42, 36, 160], devs: { 1: [6, 460, 188, 50], 2: [206, 460, 188, 50] }, devWires: [[100, 448, 100, 460], [300, 448, 300, 460]],  // phone: positions of the two I/O modules, their width, buffer slot spacing, the two devices and their wires
            legend: `<text x="200" y="538" text-anchor="middle" font-size="13"><tspan font-weight="800" style="fill:var(--accent)">address</tspan> = where · <tspan font-weight="800" style="fill:var(--accent)">data</tspan> = what · <tspan font-weight="800" style="fill:var(--accent)">control</tspan> = command</text>`,  // phone: a one-line colour legend under the drawing: address = where, data = what, control = command
          } : {  // the second set is the wide layout used on laptops and projectors
            vb: '0 0 1100 340', proc: [8, 8, 432, 160], regs: { mar: [24, 42], mbr: [164, 42], ioar: [24, 104], iobr: [164, 104] }, regW: 128, regH: 52, exec: [306, 42, 120, 114],  // wide: coordinate grid, processor box, register positions and sizes, execution unit box
            mem: [470, 8, 622, 160], cell: (i) => 488 + i * 74, cellY: 42, cellW: 66, cellH: 62, valFont: 21, addrY: 124, memNote: 'cells 0–7 (address under each cell)',  // wide: memory box, cell positions and sizes, value font size, address row and a note naming the cells
            bus: [8, 182, 1084, 68], lanes: { a: 198, d: 216, c: 234 }, labelX: 20, laneX: [96, 1080], tokX: (f) => f.x,  // wide: the bus box across the full width, its three line heights, labels, and the token spot taken from the scenario
            wires: [[88, 168, 88, 182], [228, 168, 228, 182], [780, 168, 780, 182], [565, 250, 565, 266], [895, 250, 895, 266]],  // wide: connector wires between the boxes and the bus
            mods: { 1: [470, 266], 2: [800, 266] }, modW: 190, slot: [46, 40, 168], devs: { 1: [676, 272, 106, 56], 2: [1004, 272, 88, 56] }, devWires: [[660, 300, 676, 300], [990, 300, 1004, 300]],  // wide: the two I/O modules side by side under the bus, with the keyboard and printer beside them
            legend: `<text x="16" y="283" font-size="13"><tspan font-weight="800" style="fill:var(--accent)">address</tspan> lines carry WHERE: a cell or a device number</text>` +  // wide legend line 1: address lines carry where (a cell or device number)
              `<text x="16" y="305" font-size="13"><tspan font-weight="800" style="fill:var(--accent)">data</tspan> lines carry WHAT: the value itself</text>` +  // wide legend line 2: data lines carry what (the value)
              `<text x="16" y="327" font-size="13"><tspan font-weight="800" style="fill:var(--accent)">control</tspan> lines carry the command: READ, WRITE …</text>`,  // wide legend line 3: control lines carry the command (READ, WRITE)
          };  // closes the two layouts
          const svg = ctx.s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Processor, main memory, two I/O modules and the system bus with its address, data and control lines' });  // the SVG drawing area, sized from the chosen layout's coordinate grid
          const val = (v) => (v == null ? '<tspan class="s-sub">—</tspan>' : esc(String(v)));  // val(v): shows a register value safely, or a grey dash when the register is empty
          const line = ([x1, y1, x2, y2], w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="s-line" stroke-width="${w}"/>`;  // line(...): draws one connector wire of the given thickness
          function reg(id, nm, f) {  // reg(id, nm, f): draws one exchange register for frame f; a register that just changed gets a thick frame and highlight fill
            const [x, y] = G.regs[id], on = f.chg.includes(id);  // x, y = where this register goes; on = whether this frame lists it as just changed
            return `<rect x="${x}" y="${y}" width="${G.regW}" height="${G.regH}" rx="9" class="s-panel" stroke-width="${on ? 3.5 : 2}" style="stroke:var(--cpu)${on ? ';fill:var(--hl)' : ''}"/>` +  // the register box, outlined in the processor colour
              `<text x="${x + 10}" y="${y + 18}" font-size="13" font-weight="800" class="s-monot" style="fill:var(--cpu)">${nm}</text>` +  // the register name in the top-left corner of its box
              `<text x="${x + G.regW / 2}" y="${y + G.regH - 9}" text-anchor="middle" font-size="21" font-weight="800" class="s-monot">${val(f.reg[id])}</text>`;  // the register's current value, large, in the middle of the box
          }  // ends reg()
          function token(x, lane, t) {  // token(x, lane, t): draws a small label riding on one bus line, e.g. "6 ->" going out or "<- 77" coming back
            const [txt, dir] = t;  // txt = what the line carries; dir = r (away from the processor) or l (towards it)
            const label = dir === 'l' ? '← ' + txt : txt + ' →';  // adds an arrow on the side the signal is heading
            const w = 18 + label.length * 8, y = G.lanes[lane];  // the label's width grows with its text; y is the height of its bus line
            return `<rect x="${x - w / 2}" y="${y - 9}" width="${w}" height="18" rx="9" class="s-accent" stroke-width="1.5" style="fill:var(--panel)"/>` +  // a rounded pill behind the label
              `<text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="13" font-weight="800" class="s-monot" style="fill:var(--accent)">${esc(label)}</text>`;  // the label text in the accent colour
          }  // ends token()
          function module(n, f) {  // module(n, f): draws I/O module n with its three buffer slots for frame f; a module in use gets a thick frame
            const [x, y] = G.mods[n], [P, W, LX] = G.slot, buf = n === 1 ? f.buf1 : f.buf2, on = f.mod === n;  // x, y = module position; P, W, LX = slot spacing, slot width, where the "buffer" label goes; buf = its buffer contents
            return `<rect x="${x}" y="${y}" width="${G.modW}" height="68" rx="12" class="s-io" stroke-width="${on ? 4 : 2}"/>` +  // the module box in the I/O colour
              `<text x="${x + 12}" y="${y + 19}" font-size="13" font-weight="800" style="fill:var(--io)">I/O MODULE ${n}</text>` +  // the module title, e.g. "I/O MODULE 1"
              [0, 1, 2].map((j) => `<rect x="${x + 12 + j * P}" y="${y + 28}" width="${W}" height="30" rx="6" class="s-panel" stroke-width="1.5"${buf[j] ? ' style="fill:var(--hl)"' : ''}/><text x="${x + 12 + W / 2 + j * P}" y="${y + 49}" text-anchor="middle" font-size="16" font-weight="800" class="s-monot">${buf[j] ? esc(buf[j]) : ''}</text>`).join('') +  // three buffer slots; a slot holding something is filled with the highlight colour and shows its letter
              `<text x="${x + LX}" y="${y + 49}" text-anchor="middle" font-size="13" class="s-sub">buffer</text>`;  // the word "buffer" beside the slots
          }  // ends module()
          function device(n, name, sub, on, lit) {  // device(n, name, sub, on, lit): draws the keyboard or printer; on = in use now, lit = has just printed
            const [x, y, w, hh] = G.devs[n];  // x, y, w, hh = the device box position and size
            return `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="9" class="s-panel" stroke-width="${on ? 3.5 : 1.5}" stroke-dasharray="5 3" style="stroke:var(--io)${lit ? ';fill:var(--hl)' : ''}"/>` +  // the device box with a dashed I/O-coloured frame, thicker when in use
              `<text x="${x + w / 2}" y="${y + hh / 2 - 4}" text-anchor="middle" font-size="14" font-weight="800">${name}</text><text x="${x + w / 2}" y="${y + hh / 2 + 14}" text-anchor="middle" font-size="13" class="s-sub">${sub}</text>`;  // the device name and a sub-line under it (its number, or what it has printed)
          }  // ends device()
          function draw(f) {  // draw(f): rebuilds the whole drawing for one animation frame f; runs every time the player changes frame
            const [px, py, pw, ph] = G.proc, [ex, ey, ew, eh] = G.exec, [mx, my, mw, mh] = G.mem, [bx, by, bw, bh] = G.bus;  // unpacks the boxes for the processor, execution unit, memory and bus
            let t = G.wires.map((w) => line(w, 4)).join('') + G.devWires.map((w) => line(w, 2)).join('');  // t collects the SVG text, starting with the thick wires and thinner device wires
            t += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="14" class="s-cpu" stroke-width="2"/><text x="${px + 14}" y="${py + 22}" font-size="14" font-weight="800" style="fill:var(--cpu)">PROCESSOR</text>`;  // adds the processor box and its title
            t += reg('mar', 'MAR', f) + reg('mbr', 'MBR', f) + reg('ioar', 'I/O AR', f) + reg('iobr', 'I/O BR', f);  // adds the four exchange registers
            t += `<rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" rx="9" class="s-panel" stroke-width="2" style="stroke:var(--cpu)"/><text x="${ex + ew / 2}" y="${ey + eh / 2 - 12}" text-anchor="middle" font-size="14" font-weight="800">Execution</text><text x="${ex + ew / 2}" y="${ey + eh / 2 + 6}" text-anchor="middle" font-size="14" font-weight="800">unit</text>` +  // adds the execution unit box and its two-line label
              `<text x="${ex + ew / 2}" y="${ey + eh / 2 + 30}" text-anchor="middle" font-size="13" class="s-sub">${esc(f.exec)}</text>`;  // and the line under it that says what it is doing in this frame (idle, or has a value to use)
            t += `<rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="14" class="s-mem" stroke-width="${f.cell >= 0 ? 3.5 : 2}"/><text x="${mx + 14}" y="${my + 22}" font-size="14" font-weight="800" style="fill:var(--mem)">MAIN MEMORY</text><text x="${mx + mw - 14}" y="${my + 22}" text-anchor="end" font-size="13" class="s-sub">${G.memNote}</text>`;  // adds the memory box (thicker when a cell is being used), its title and the note about cells
            f.mem.forEach((v, i) => {  // goes through the 8 memory cells
              const x = G.cell(i), on = f.cell === i, ch = f.chgCell === i;  // x = this cell's position; on = the cell being read or written; ch = the cell whose value just changed
              t += `<rect x="${x}" y="${G.cellY}" width="${G.cellW}" height="${G.cellH}" rx="8" class="s-panel" stroke-width="${on ? 3.5 : 1.5}" style="${on ? 'stroke:var(--accent)' : ''}${ch ? ';fill:var(--hl)' : ''}"/>` +  // the cell box: accent frame when in use, highlight fill when its value just changed
                `<text x="${x + G.cellW / 2}" y="${G.cellY + G.cellH / 2 + G.valFont * 0.36}" text-anchor="middle" font-size="${G.valFont}" font-weight="800" class="s-monot">${esc(String(v))}</text>` +  // the cell's value, centred in the box
                `<text x="${x + G.cellW / 2}" y="${G.addrY}" text-anchor="middle" font-size="14" font-weight="700" class="s-sub s-monot">${i}</text>`;  // the cell's address under the box
            });  // ends the loop over cells
            t += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="14" class="s-accent" stroke-width="2"/>`;  // adds the bus box
            [['a', 'address'], ['d', 'data'], ['c', 'control']].forEach(([k, nm]) => {  // goes through the three bus lines: address, data and control
              const on = !!f.L[k], y = G.lanes[k];  // on = whether this line carries something in this frame; y = its height in the drawing
              t += `<text x="${G.labelX}" y="${y + 4.5}" font-size="13" font-weight="800" style="fill:var(--accent)">${nm}</text>` +  // writes the line's name at its left end
                `<line x1="${G.laneX[0]}" y1="${y}" x2="${G.laneX[1]}" y2="${y}" stroke-width="${on ? 3 : 1.5}" stroke-dasharray="${on ? '0' : '5 5'}" style="stroke:${on ? 'var(--accent)' : 'var(--line-2)'}"/>`;  // draws the line: solid and bold while it carries something, thin and dashed while idle
            });  // ends the loop over bus lines
            Object.entries(f.L).forEach(([k, v]) => { t += token(G.tokX(f), k, v); });  // adds a token on each bus line that carries something in this frame
            t += module(1, f) + module(2, f);  // adds both I/O modules
            t += device(1, 'Keyboard', 'device 1', f.dev === 1, false) + device(2, 'Printer', f.printed ? 'printed: ' + esc(f.printed) : 'device 2', f.dev === 2, !!f.printed);  // adds the keyboard (device 1) and printer (device 2); the printer shows what it has printed so far
            t += G.legend;  // adds the colour legend
            svg.innerHTML = t;  // puts the finished drawing into the SVG
          }  // ends draw()
          let name = 'read', frames = flowFrames(name);  // name = the scenario on screen (memory read first); frames = its list of complete snapshots from flowFrames()
          const player = ctx.ui.player({ count: frames.length, interval: 3000, render: (i) => { draw(frames[i]); return frames[i].cap; } });  // the guide's step player (Restart, Back, Play, Next and speed buttons); each frame draws itself and returns its caption; Play waits 3 s per frame
          const seg = ctx.ui.seg([{ value: 'read', label: 'Memory read' }, { value: 'write', label: 'Memory write' }, { value: 'out', label: 'Output to printer' }, { value: 'in', label: 'Input from keyboard' }], name, (v) => {  // four-button switch to choose the transfer to watch
            name = v; frames = flowFrames(v); player.stop(); player.setCount(frames.length);  // choosing one loads that scenario's frames, stops playback and sends the player back to frame 1
          });  // ends the switch's change handler
          el.append(h('div', { class: 'stack fill s5', style: { gap: '10px' } },  // builds the page: a full-height stack with the s5 class (used by the caption CSS)
            h('div', { class: 'row' }, seg, h('span', { class: 'small muted' }, 'Pick a transfer, then press Play or step with ▶.')),  // top row: the scenario switch and a hint
            h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), player.el));  // the drawing in a white card, then the player controls with the caption
        },  // ends render() for step 5
      },  // closes step 5
      /* ---------------- 6. Why an I/O module needs buffers ---------------- */
      {  // opens step 6: a buffer simulator inside an I/O module
        title: 'Inside an I/O module: why buffers matter',  // step 6 title
        kind: 'explore',  // kind "explore" labels the page as an Explore step
        render(el, ctx) {  // render(el, ctx): builds the buffer simulator each time step 6 is shown
          const { h } = ctx;  // takes the element-building helper h out of ctx
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const TEXT = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG ';  // TEXT: the sentence the imaginary typist types over and over, one letter per key
          const TICK = 400; // one key every 0.4 s
          let B = 4, P = 5, tick = 0, pos = 0, buf = [], typed = [], mem = '', nTyped = 0, nOk = 0, nLost = 0, running = false, event = '';  // state: B = buffer slots, P = keys between processor visits, tick = keys so far, pos = place in TEXT, plus the lists and counters shown on screen
          const show = (c) => (c === ' ' ? '␣' : c);  // show(c): shows a space as a visible space symbol so the student can see it was typed
          const formula = h('div', { class: 'card tight s6-formula', 'aria-live': 'polite' });  // formula card: explains how many keys arrive between visits and how many are lost
          const keycap = h('div', { class: 's6-key mono' }, '·');  // the keyboard key cap that shows the latest letter typed
          const slots = h('div', { class: 's6-slots' });  // the buffer slots inside the I/O module box
          const fillTxt = h('div', { class: 'xs muted b' });  // the "n of B slots full" line under the buffer
          const meter = h('div', { class: 'meter' }, h('i', { style: { width: '0%' } }));  // the timer bar in the processor box that fills up until the next visit
          const cpuTxt = h('div', { class: 'small' });  // the processor status line: "Collecting now!" or how many keys until the next visit
          const typedLine = h('div', { class: 'mono s6-line' });  // the "typed" line: every key typed recently, coloured by what happened to it
          const memLine = h('div', { class: 'mono s6-line' });  // the "in memory" line: the letters that made it into memory
          const stats = h('div', { class: 'row s6-stats' });  // the row of count chips: typed, delivered, lost and waiting
          const cap = h('div', { class: 'player-cap s6-cap', 'aria-live': 'polite' });  // caption box describing the latest event; screen readers announce it
          const bRun = h('button', { type: 'button', class: 'btn sm primary', onclick: () => { running = !running; paint(); } });  // Start/Pause button: flips running on or off and redraws
          const bStep = h('button', { type: 'button', class: 'btn sm', onclick: () => { running = false; step(); } }, 'One key ▸');  // "One key" button: pauses and sends exactly one key, so the student can go slowly
          const bReset = h('button', { type: 'button', class: 'btn sm', onclick: () => reset() }, 'Reset');  // Reset button: clears everything and stops the typist
          const segB = ctx.ui.seg([{ value: 1, label: '1 slot' }, { value: 4, label: '4 slots' }, { value: 8, label: '8 slots' }], B, (v) => { B = v; reset(); });  // switch for the buffer size: 1, 4 or 8 slots; changing it starts again from zero
          const segP = ctx.ui.seg([{ value: 3, label: '1.2 s' }, { value: 5, label: '2 s' }, { value: 8, label: '3.2 s' }], P, (v) => { P = v; reset(); });  // switch for how often the processor visits: every 3, 5 or 8 keys (1.2 s, 2 s or 3.2 s); changing it starts again
          function step() {  // step(): one key arrives; runs every 0.4 s while running, or once per "One key" click
            tick++;  // counts one more key
            const rec = { ch: TEXT[pos % TEXT.length], st: 'buf' }; pos++; nTyped++;  // rec: the new key record (its letter and status "buf" = waiting); moves on in TEXT and counts it as typed
            typed.push(rec); if (typed.length > 40) typed.shift();  // adds it to the typed line, keeping only the last 40 keys
            if (buf.length < B) { buf.push(rec); event = `Key <b class="mono">${show(rec.ch)}</b> arrives and waits in the buffer.`; }  // room in the buffer: the key waits there, and the event text says so
            else { rec.st = 'lost'; nLost++; event = `<b style="color:var(--bad)">Buffer full!</b> Key <b class="mono">${show(rec.ch)}</b> had nowhere to wait and was lost.`; }  // buffer full: the key is marked lost, counted, and the event text says so in red
            if (tick % P === 0) {  // every P keys the processor visits the module
              const n = buf.length;  // n: how many keys are waiting at this visit
              buf.forEach((r) => { r.st = 'ok'; mem += r.ch; }); nOk += n; buf = [];  // every waiting key is delivered to memory and marked ok; the buffer is emptied
              if (mem.length > 40) mem = mem.slice(-40);  // keeps only the last 40 letters of memory on screen
              event += ` <b style="color:var(--cpu)">Processor visit:</b> it empties all ${n} waiting key${n === 1 ? '' : 's'} through the I/O BR into memory, then goes back to other work.`;  // adds the processor visit to the event text: it empties the buffer through the I/O BR, then leaves
            }  // ends the visit
            paint();  // redraws the simulator
          }  // ends step()
          function reset() {  // reset(): clears all counts and lists; runs at start, on Reset and when a setting changes
            running = false; // Reset (and every setting change) stops the typist: nothing arrives until the student presses Start again
            tick = 0; pos = 0; buf = []; typed = []; mem = ''; nTyped = 0; nOk = 0; nLost = 0;  // empties every counter and list
            event = 'Press <b>Start typing</b>, or <b>One key</b> to go slowly. The typist never waits: keys arrive whether or not anyone is ready for them.';  // starting caption: how to begin, and that the typist never waits for anyone
            paint();  // redraws the simulator
          }  // ends reset()
          function paint() {  // paint(): redraws every part of the simulator from the state; runs after each key and each change
            const lost = Math.max(0, P - B);  // lost: how many of every P keys cannot fit, since only B can wait between visits
            formula.innerHTML = `Between two visits <b>${P} keys</b> arrive (${(P * TICK / 1000).toFixed(1)} s ÷ 0.4 s). The buffer holds <b>${B}</b>. ` +  // formula text: P keys arrive between visits (P x 0.4 s) and the buffer holds B
              (lost ? `So <b style="color:var(--bad)">${lost} of every ${P}</b> keys are lost (${Math.round((lost / P) * 100)}%).` : `Everything fits, so <b style="color:var(--ok)">no key is lost</b>.`);  // then either how many of every P keys are lost (and the percentage) or that nothing is lost
            keycap.textContent = typed.length ? show(typed[typed.length - 1].ch) : '·';  // shows the latest letter on the key cap, or a dot before anything is typed
            keycap.classList.toggle('lost', !!typed.length && typed[typed.length - 1].st === 'lost');  // turns the key red if the latest key was lost
            slots.className = 's6-slots' + (B === 8 ? ' eight' : B === 1 ? ' one' : '');  // sets the slot grid style for 1, 4 or 8 slots
            slots.innerHTML = Array.from({ length: B }, (_, k) => `<span class="${buf[k] ? 'full' : ''}">${buf[k] ? show(buf[k].ch) : ''}</span>`).join('');  // draws B slots, filling the first ones with the waiting letters
            fillTxt.textContent = `${buf.length} of ${B} slots full`;  // writes how many slots are full
            meter.firstChild.style.width = ((tick % P) / P) * 100 + '%';  // fills the timer bar in proportion to how far we are between two visits
            cpuTxt.innerHTML = tick > 0 && tick % P === 0 ? '<b style="color:var(--cpu)">Collecting now!</b>' : `Next visit in ${P - (tick % P)} key${P - (tick % P) === 1 ? '' : 's'}`;  // processor status: "Collecting now!" on a visit, otherwise how many keys until the next visit
            typedLine.innerHTML = '<span class="lbl">typed</span>' + typed.map((r) => `<span class="c-${r.st}">${show(r.ch)}</span>`).join('');  // the typed line: its label, then each letter coloured by status (ok = green, buf = waiting, lost = red)
            memLine.innerHTML = '<span class="lbl">in memory</span>' + [...mem].map((c) => `<span class="c-ok">${show(c)}</span>`).join('');  // the in-memory line: its label, then every delivered letter in green
            stats.innerHTML = `<span class="chip">typed ${nTyped}</span><span class="chip ok">delivered ${nOk}</span><span class="chip bad">lost ${nLost}</span><span class="chip warn">waiting ${buf.length}</span>`;  // the four count chips
            cap.innerHTML = event;  // shows the latest event in the caption box
            bRun.innerHTML = running ? 'Pause' : '▶ Start typing';  // the Start button reads "Pause" while the typist is running
          }  // ends paint()
          ctx.every(TICK, () => { if (running) step(); });  // a timer that ticks every 0.4 s for as long as the step is open; each tick sends a key only while running
          el.append(h('div', { class: 'split l fill' },  // builds the page: a two-column layout with the simulator in the wider right column
            h('div', { class: 'stack' },  // left column: a vertical stack of text
              h('p', { class: 'lead m0', html: 'An <span class="t">I/O module</span> sits between the fast processor and a slow, unpredictable outside world.' }),  // opening paragraph: an I/O module sits between the fast processor and the slow outside world
              h('p', { class: 'm0', html: 'It moves data both ways: from external devices into the processor and memory, and back out again. Inside it are small <span class="t">buffers</span>: holding areas where data waits until the other side is ready.' }),  // paragraph: the module moves data both ways and keeps small buffers inside
              h('div', { class: 'callout why m0', 'data-label': 'Why buffers?', html: 'A typist manages a few keys per second; the processor does billions of steps per second and has other work. A key that arrives while the processor is busy elsewhere must wait somewhere, or it is lost. Output is the reverse: the processor drops a whole line into a printer module’s buffer at once and moves on while the printer catches up.' }),  // "why buffers?" box: a typist is slow, the processor is fast and busy, and output works in reverse
              formula,  // the formula card, updated by paint()
              h('p', { class: 'small muted m0' }, 'Try 4 slots and 2 s, then change one setting at a time and watch the lost count.')),  // small hint suggesting which settings to try first
            h('div', { class: 'card white stack s6-sim' },  // right column: a white card holding the simulator
              h('div', { class: 'grid-2 s6-ctl' }, h('div', { class: 'stack gap-s' }, h('span', { class: 'xs muted b' }, 'BUFFER SIZE IN THE I/O MODULE'), segB), h('div', { class: 'stack gap-s' }, h('span', { class: 'xs muted b' }, 'PROCESSOR VISITS EVERY'), segP)),  // the settings row: buffer-size switch and processor-visit switch, each with a small label
              h('div', { class: 's6-flow' },  // the flow row: keyboard, arrow, buffer, arrow, processor
                h('div', { class: 's6-box dev' }, h('h4', {}, 'Keyboard'), keycap, h('div', { class: 'xs muted' }, 'one key every 0.4 s')),  // keyboard box: heading, key cap and "one key every 0.4 s"
                h('div', { class: 's6-arr' }, ctx.narrow ? '↓' : '→'),  // arrow: points right on wide screens, down on a phone
                h('div', { class: 's6-box io' }, h('h4', {}, 'I/O module buffer'), slots, fillTxt),  // I/O module box: heading, buffer slots and the fill line
                h('div', { class: 's6-arr' }, ctx.narrow ? '↓' : '→'),  // second arrow, pointing to the processor
                h('div', { class: 's6-box cpu' }, h('h4', {}, 'Processor'), cpuTxt, meter, h('div', { class: 'xs muted' }, 'empties the whole buffer at each visit'))),  // processor box: heading, status line, timer bar and a note that each visit empties the whole buffer
              h('div', { class: 'card tight stack gap-s' }, typedLine, memLine),  // a small card with the typed line and the in-memory line
              stats, cap,  // the count chips and the caption
              h('div', { class: 'row', style: { marginTop: 'auto' } }, bRun, bStep, bReset, h('span', { class: 'small muted' }, 'Time is slowed right down so you can watch.')))));  // bottom row: Start/Pause, One key and Reset buttons, with a note that time is slowed down
          reset();  // sets everything to its starting state when the step opens
        },  // ends render() for step 6
      },  // closes step 6
      /* ---------------- 7. Volatile main memory vs permanent disk ---------------- */
      {  // opens step 7: what survives a power cut, main memory or the disk
        title: 'Pull the plug: memory forgets, the disk remembers',  // step 7 title
        kind: 'compare',  // kind "compare" labels the page as a Compare step
        html: `${/* the fixed HTML for step 7 */''}
          <div class="split l fill">${/* two-column layout: reading on the left, the simulator in the wider right column */''}
            <div class="stack">${/* left column: a vertical stack */''}
              <p class="lead m0">Switch a computer off and main memory forgets everything. That is what <span class="t">volatile memory</span> means.</p>${/* opening paragraph: switching off makes main memory forget; that is what volatile means */''}
              <p class="m0">Main memory needs power to hold its bits. A disk is <span class="t">secondary memory</span>: much slower, but it keeps its data with the power off. The processor reaches the disk only through an I/O module.</p>${/* paragraph: a disk is secondary memory, slower but permanent, reached through an I/O module */''}
              <table class="tbl compact">${/* comparison table of main memory and disk */''}
                <tr><th></th><th>Main memory</th><th>Disk</th></tr>${/* table header row: an empty corner, then Main memory and Disk */''}
                <tr><td class="b">Survives power-off?</td><td style="color:var(--bad)" class="b">No (volatile)</td><td style="color:var(--ok)" class="b">Yes</td></tr>${/* table row: survives power-off? No for memory (red), yes for disk (green) */''}
                <tr><td class="b">Speed</td><td>fast</td><td>far slower</td></tr>${/* table row: speed */''}
                <tr><td class="b">Typical size</td><td>gigabytes</td><td>hundreds of GB and up</td></tr>${/* table row: typical size */''}
                <tr><td class="b">Processor reaches it</td><td>over the bus</td><td>via an I/O module</td></tr>${/* table row: how the processor reaches each one */''}
              </table>${/* ends the table */''}
              <div class="callout warn m0" data-label="Common mistake">Mixing up “memory” and “storage”. A laptop sold with 16 GB memory and 512 GB storage has 16 GB of main memory (volatile) and a 512 GB drive (secondary memory, such as a disk).</div>${/* "common mistake" box: memory versus storage on a laptop's spec sheet */''}
            </div>${/* closes the left column */''}
            <div class="card white stack s7-sim"></div>${/* right column: an empty white card that render() fills with the power simulator */''}
          </div>`,  // closes the layout and ends the step 7 HTML
        render(el, ctx) {  // render(el, ctx): builds the power simulator each time step 7 is shown
          const { h } = ctx;  // takes the element-building helper h out of ctx
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const sim = el.querySelector('.s7-sim');  // sim: the empty card from the HTML where the simulator goes
          const WORDS = ['and', 'eggs', 'then', 'bread'];  // WORDS: the words added, in turn, each time the student presses "Type a word"
          let power, booted, note, saved, wi, lostWords, bootId = 0;  // state: power on/off, booted (OS loaded), note (words in memory), saved (words on disk), wi (next word), lostWords, bootId (start-up counter)
          const status = h('span', { class: 'chip' });  // status chip: power off, starting up, or running
          const bPower = h('button', { type: 'button', class: 'btn sm', onclick: () => togglePower() });  // power button: switches the computer on or off
          const memGrid = h('div', { class: 's7-cells' });  // the grid of 8 main-memory cells
          const disk = h('div', { class: 'stack gap-s s7-disk' });  // the list of files on the disk
          const ioBox = h('div', { class: 's7-io' }, h('b', {}, 'I/O'), h('span', { class: 'xs' }, 'module'), h('span', { class: 's7-arrows' }, '⇄'));  // the I/O module between memory and disk, with a two-way arrow; it flashes on every save or open
          const cap = h('div', { class: 'player-cap s7-cap', 'aria-live': 'polite' });  // caption box that explains what just happened; screen readers announce it
          const bType = h('button', { type: 'button', class: 'btn sm', onclick: () => typeWord() }, 'Type a word');  // "Type a word" button: adds the next word to the note in memory
          const bSave = h('button', { type: 'button', class: 'btn sm mem', onclick: () => save() }, 'Save to disk');  // "Save to disk" button, in the memory colour: copies the note out to the disk
          const bOpen = h('button', { type: 'button', class: 'btn sm io', onclick: () => openNote() }, 'Open note from disk');  // "Open note from disk" button, in the I/O colour: copies the saved note back into memory
          const bReset = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => reset() }, 'Reset');  // Reset button: puts the simulator back to its starting state
          sim.append(  // fills the simulator card
            h('div', { class: 'row' }, bPower, status, h('span', { class: 'grow' }), bReset),  // top row: power button and status chip on the left, Reset on the right
            h('div', { class: 's7-flow' },  // the memory, I/O module, disk row
              h('div', { class: 'card mem tight stack gap-s' }, h('h4', { class: 'm0' }, 'Main memory (8 cells)'), memGrid),  // memory card with its heading and the 8 cells
              ioBox,  // the I/O module in the middle
              h('div', { class: 'card io tight stack gap-s' }, h('h4', { class: 'm0' }, 'Disk (secondary memory)'), disk)),  // disk card with its heading and file list
            h('div', { class: 'row gap-s' }, h('span', { class: 'chip os' }, 'OS'), h('span', { class: 'chip proc' }, 'program'), h('span', { class: 'chip mem' }, 'your note (data)'), h('span', { class: 'chip warn' }, 'dashed = not saved yet')),  // colour key chips: OS, program, your note, and dashed = not saved yet
            h('div', { class: 'row' }, bType, bSave, bOpen), cap,  // the three action buttons, then the caption
            h('div', { class: 'callout why m0', 'data-label': 'Why the OS cares', html: 'Memory is volatile, so every start-up must first copy the OS from the disk into memory, and “saving” means copying your data out through an I/O module.' }));  // "why the OS cares" box: every start-up copies the OS from disk, and saving means copying data out
          function paint() {  // paint(): redraws the status, buttons, memory cells and disk from the state; runs after every action
            status.className = 'chip ' + (power ? 'ok' : 'bad');  // status chip turns green while powered, red when off
            status.textContent = power ? (booted ? 'Power on · running' : 'Power on · starting up…') : 'Power off';  // status text: power off, starting up, or running
            bPower.innerHTML = power ? 'Switch off' : 'Switch on';  // power button text: "Switch off" or "Switch on"
            bPower.className = 'btn sm ' + (power ? 'danger' : 'primary');  // power button colour: red (danger) while on, primary while off
            const cells = [];  // cells collects the HTML for the 8 memory cells
            for (let a = 0; a < 8; a++) {  // goes through memory cells 0 to 7
              let t = '', cls = 'empty';  // t = what the cell shows, cls = its style; empty to begin with
              if (!power) { t = ''; cls = 'dead'; }  // power off: every cell is dead (grey, no contents)
              else if (a < 2 && booted) { t = 'OS'; cls = 'os'; }  // after start-up, cells 0 and 1 hold the OS
              else if (a < 4 && booted) { t = 'editor'; cls = 'prog'; }  // after start-up, cells 2 and 3 hold the editor program
              else if (a >= 4 && note && note[a - 4] != null) { t = note[a - 4]; cls = 'word' + (saved[a - 4] === t ? '' : ' unsaved'); }  // cells 4 to 7 hold the note's words; a word not yet matching the saved copy is marked unsaved (dashed)
              cells.push(`<div class="s7-cell ${cls}"><span class="xs muted">${a}</span><b>${ctx.util.esc(t) || (power ? '' : '·')}</b></div>`);  // adds this cell's HTML: its address and its contents (a dot when the power is off)
            }  // ends the loop over cells
            memGrid.innerHTML = cells.join('');  // puts the 8 cells into the memory grid
            disk.innerHTML = `<div class="s7-file"><b>OS files</b><span class="xs muted">always there</span></div><div class="s7-file"><b>editor</b><span class="xs muted">program</span></div>` +  // disk list: the OS files and the editor, which are always on the disk
              `<div class="s7-file"><b>note.txt</b><span class="small mono">${saved.length ? ctx.util.esc(saved.join(' ')) : '<span class="muted">(empty)</span>'}</span></div>`;  // and note.txt with whatever was last saved, or "(empty)"
            const on = power && booted;  // on: the computer is powered and has finished starting up
            bType.disabled = !on || !note || note.length >= 4; bSave.disabled = !on || !note; bOpen.disabled = !on;  // buttons are usable only while running; Type also stops at 4 words, Save needs an open note
          }  // ends paint()
          function say(t) { cap.innerHTML = t; }  // say(t): writes a message into the caption box
          function typeWord() {  // typeWord(): adds the next word to the note in memory; runs on "Type a word"
            if (!note || note.length >= 4) return;  // does nothing if no note is open or all 4 note cells are full
            note.push(WORDS[wi % WORDS.length]); wi++;  // adds the next word from WORDS and moves on to the one after
            say(`You typed “${note[note.length - 1]}”. It exists only in main memory for now (dashed = <b>not saved</b>).`);  // explains that the new word exists only in memory (not saved yet)
            paint();  // redraws
          }  // ends typeWord()
          function save() {  // save(): copies the note to the disk; runs on "Save to disk"
            saved = note.slice();  // the disk copy becomes an exact copy of the note in memory
            ioBox.classList.remove('flash'); void ioBox.offsetWidth; ioBox.classList.add('flash');  // restarts the flash on the I/O module: remove the class, read offsetWidth so the browser notices, then add it again
            say('<b>Saved.</b> The processor sent the note through the I/O module to the disk. That copy will survive a power cut.');  // explains that the note went through the I/O module to the disk and will survive a power cut
            paint();  // redraws
          }  // ends save()
          function openNote() {  // openNote(): copies the saved note from the disk into memory; runs on "Open note from disk"
            note = saved.slice();  // memory gets a copy of what is saved on the disk
            ioBox.classList.remove('flash'); void ioBox.offsetWidth; ioBox.classList.add('flash');  // flashes the I/O module again to show the transfer
            say(`<b>Opened.</b> The note came back from the disk into memory: “${saved.join(' ')}”.` + (lostWords.length ? ` The words <b style="color:var(--bad)">${lostWords.map((w) => '“' + w + '”').join(' ')}</b> were never saved, so they are gone for good.` : ''));  // explains the note came back; lists any words that were never saved and are gone for good
            paint();  // redraws
          }  // ends openNote()
          function togglePower() {  // togglePower(): switches the computer off or on; runs on the power button
            if (power) {  // switching off:
              lostWords = (note || []).filter((w, i) => saved[i] !== w);  // lostWords: the words in memory that did not match the saved copy
              power = false; booted = false; note = null;  // memory loses everything: no power, not started, no note open
              say('<b>Power off.</b> All 8 cells of main memory lost their contents, even the OS itself. The disk kept everything that had been saved.' + (lostWords.length ? ` Unsaved words lost: <b style="color:var(--bad)">${lostWords.join(', ')}</b>.` : ''));  // explains that all 8 cells were wiped, even the OS, and lists the unsaved words that were lost
            } else {  // switching on:
              power = true; booted = false; const id = ++bootId;  // power returns but nothing is loaded yet; id numbers this start-up so an old one can be ignored
              say('<b>Power on.</b> Main memory starts out with nothing useful in it. The computer must copy the OS and the editor back in from the disk…');  // explains that memory starts empty and the OS must be copied in from the disk
              ctx.after(900, () => { if (id !== bootId || !power) return; booted = true; say('<b>Started.</b> The OS and the editor were copied from the disk into memory. Your note is <i>not</i> in memory any more: open it from the disk.'); paint(); });  // 0.9 s later (unless the power went off or a newer start-up began) the OS is loaded and the note must be opened again
            }  // ends the on/off choice
            paint();  // redraws
          }  // ends togglePower()
          function reset() {  // reset(): starting state, powered and running with "Buy milk" open and saved; runs at start and on Reset
            bootId++; power = true; booted = true; note = ['Buy', 'milk']; saved = ['Buy', 'milk']; wi = 0; lostWords = [];  // cancels any start-up in progress and restores every state variable
            say('The note “Buy milk” is open in memory and also saved on the disk. <b>Type a word or two</b>, then switch the power off without saving. What do you predict will survive?');  // starting caption: asks the student to type, switch off without saving and predict what survives
            paint();  // redraws
          }  // ends reset()
          reset();  // sets up the simulator when the step opens
        },  // ends render() for step 7
      },  // closes step 7
      /* ---------------- 8. Recap + kitchen match-up ---------------- */
      {  // opens step 8: recap of six ideas and a kitchen match-up game
        title: 'Recap: six ideas, then a kitchen match-up',  // step 8 title
        kind: 'recap',  // kind "recap" labels the page as a Recap step
        html: `${/* the fixed HTML for step 8 */''}
          <div class="split l fill">${/* two-column layout: the six points on the left, the game in the wider right column */''}
            <div class="stack gap-s">${/* left column: a tight vertical stack */''}
              <h3 class="m0">Six things to remember</h3>${/* heading: six things to remember */''}
              <div class="s8-pt"><i>1</i><div><b>Four elements.</b> A computer is a processor, main memory and I/O modules, joined by the system bus, all working together to execute programs.</div></div>${/* recap point 1: the four structural elements */''}
              <div class="s8-pt"><i>2</i><div><b>Processor (CPU).</b> Controls the whole machine and does all the data processing, using a few fast registers such as the PC and IR.</div></div>${/* recap point 2: the processor and its registers */''}
              <div class="s8-pt"><i>3</i><div><b>Where vs what.</b> The MAR (a memory cell) and I/O AR (a device) say <i>where</i>; the MBR and I/O BR carry the data itself.</div></div>${/* recap point 3: where (MAR, I/O AR) versus what (MBR, I/O BR) */''}
              <div class="s8-pt"><i>4</i><div><b>Main memory.</b> Cells numbered 0 to n − 1, each holding a bit pattern that may be an instruction or data. Volatile: wiped at power-off.</div></div>${/* recap point 4: memory cells 0 to n - 1, instruction or data, volatile */''}
              <div class="s8-pt"><i>5</i><div><b>I/O modules.</b> Move data between devices (disks, network equipment, terminals) and the processor or memory, using internal buffers.</div></div>${/* recap point 5: I/O modules, devices and buffers */''}
              <div class="s8-pt"><i>6</i><div><b>System bus.</b> The shared path that carries addresses, data and control signals between every part.</div></div>${/* recap point 6: the system bus carries addresses, data and control signals */''}
            </div>${/* closes the left column */''}
            <div class="card white stack s8-game"></div>${/* right column: an empty white card that render() fills with the match-up game */''}
          </div>`,  // closes the layout and ends the step 8 HTML
        render(el, ctx) {  // render(el, ctx): builds the match-up game each time step 8 is shown
          const { h } = ctx;  // takes the element-building helper h out of ctx
          const game = el.querySelector('.s8-game');  // game: the empty card from the HTML where the match-up goes
          const PAIRS = [  // PAIRS: seven matches as [computer part, kitchen job, hint used when a wrong match is tried]
            ['Processor (CPU)', 'The chef, who reads each step and does all the cooking', 'it carries out the instructions of every program'],  // pair: processor with the chef
            ['Main memory', 'The counter: holds what is in use, wiped clean at closing time', 'it holds what is in use right now and is volatile'],  // pair: main memory with the counter
            ['Disk (secondary memory)', 'The storeroom: huge, keeps things overnight, slow to reach', 'it is big, permanent and slow'],  // pair: disk with the storeroom
            ['I/O module', 'The pass window, with a shelf where orders and plates wait', 'it links to the outside world and has buffers'],  // pair: I/O module with the pass window
            ['System bus', 'The one shared aisle that every trip must use', 'it is the path shared by every part'],  // pair: system bus with the shared aisle
            ['MAR', 'A slip naming which numbered counter spot to use', 'it holds a <i>where</i>'],  // pair: MAR with the slip naming a counter spot
            ['MBR', 'The tray carrying an item to or from that spot', 'it holds a <i>what</i>'],  // pair: MBR with the tray
          ];  // closes PAIRS
          const ORDER = [4, 2, 6, 0, 5, 3, 1]; // fixed shuffle of the analogies, so no row gives its partner away
          let selL = -1, selR = -1, done = new Set();  // selL / selR: the chosen left and right buttons (-1 = none); done: the pairs matched so far
          const score = h('span', { class: 'chip accent' });  // score chip, e.g. "3 / 7 matched"
          const colL = h('div', { class: 'stack gap-s' });  // left column: the computer parts
          const colR = h('div', { class: 'stack gap-s' });  // right column: the kitchen jobs
          const fb = h('div', { class: 'player-cap s8-fb', 'aria-live': 'polite' });  // feedback box under the columns; screen readers announce it
          const bReset = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { selL = selR = -1; done = new Set(); say('Pick a part on the left, then the kitchen job on the right that matches it.'); paint(); } }, 'Start over');  // "Start over" button: clears every match and choice and resets the message
          game.append(h('div', { class: 'row' }, h('h3', { class: 'm0' }, 'Kitchen match-up'), score, h('span', { class: 'grow' }), bReset),  // puts the heading, score and Start over button in a row at the top of the card
            h('div', { class: 's8-cols' }, colL, colR), fb);  // then the two columns and the feedback box
          const say = (t, cls) => { fb.innerHTML = t; fb.className = 'player-cap s8-fb' + (cls ? ' ' + cls : ''); };  // say(t, cls): writes a message in the feedback box, coloured red or green by cls
          // build the buttons once; paint() only updates their state
          const btnL = PAIRS.map((p, i) => h('button', { type: 'button', class: 's8-it l', onclick: () => { selL = i; check(); } }));  // one button per computer part for the left column; clicking it selects that part and checks for a pair
          const btnR = PAIRS.map((p, i) => h('button', { type: 'button', class: 's8-it r', onclick: () => { selR = i; check(); } }, p[1]));  // one button per kitchen job for the right column; clicking it selects that job and checks for a pair
          colL.append(...btnL); colR.append(...ORDER.map((i) => btnR[i]));  // fills the left column in PAIRS order and the right column in the shuffled ORDER
          function paint() {  // paint(): refreshes every button's look and the score; runs after each click
            PAIRS.forEach((p, i) => {  // goes through all seven pairs
              const ok = done.has(i);  // ok: whether this pair is already matched
              btnL[i].className = 's8-it l' + (ok ? ' ok' : selL === i ? ' on' : ''); btnL[i].disabled = ok; btnL[i].textContent = (ok ? '✓ ' : '') + p[0];  // left button: green and disabled with a tick once matched, highlighted while selected
              btnR[i].className = 's8-it r' + (ok ? ' ok' : selR === i ? ' on' : ''); btnR[i].disabled = ok;  // right button: green and disabled once matched, highlighted while selected
            });  // ends the loop over pairs
            score.textContent = `${done.size} / ${PAIRS.length} matched`;  // updates the score chip
          }  // ends paint()
          function check() {  // check(): once one button on each side is chosen, decides whether they match
            if (selL >= 0 && selR >= 0) {  // only acts when both a part and a job have been chosen
              if (selL === selR) {  // same index on both sides means they belong together
                done.add(selL);  // records the match
                say(done.size === PAIRS.length ? '<b style="color:var(--ok)">All seven matched!</b> Kitchen and computer share one design: one worker who acts, fast space for work in progress, slow permanent storage, a hatch to the outside, one shared path.' : `<b style="color:var(--ok)">✓ Match.</b> ${PAIRS[selL][0]} ↔ ${PAIRS[selL][1].charAt(0).toLowerCase() + PAIRS[selL][1].slice(1)}.`, done.size === PAIRS.length ? 'good' : '');  // praise for this match, or a summary of the whole comparison when all seven are done
              } else {  // a wrong pairing:
                say(`<b style="color:var(--bad)">Not quite.</b> Think about what the ${PAIRS[selL][0]} does: ${PAIRS[selL][2]}. That kitchen job fits the <b>${PAIRS[selR][0]}</b> better.`, 'bad');  // explains what the chosen part really does and which part that kitchen job suits better
              }  // ends the right-or-wrong choice
              selL = selR = -1;  // clears both choices for the next try
            }  // ends the both-chosen case
            paint();  // redraws the buttons
          }  // ends check()
          say('Pick a part on the left, then the kitchen job on the right that matches it.');  // starting message: how to play
          paint();  // draws the buttons for the first time
        },  // ends render() for step 8
      },  // closes step 8
      /* ---------------- 9. Check yourself ---------------- */
      {  // opens step 9: the section quiz
        title: 'Check yourself',  // step 9 title
        kind: 'check',  // kind "check" labels the page as Check Yourself
        quiz: [  // quiz: the questions, which the guide's quiz engine turns into interactive cards and marks
          { q: 'Which structural element controls the operation of the computer and performs its data processing?',  // quiz question 1 (multiple choice): which element controls the computer and processes data
            choices: ['Main memory', 'The processor', 'The system bus', 'An I/O module'], answer: 1,  // the four choices; answer 1 means the second one, the processor (counting starts at 0)
            feedback: ['Main memory stores programs and data, but it never acts on them.', null, 'The bus only carries signals between the other parts.', 'An I/O module moves data to and from external devices; it does not run programs.'],  // feedback for each wrong choice, shown if the student picks it (null for the right answer)
            why: 'The processor (usually called the CPU when there is only one) runs programs by carrying out their instructions, and in doing so it controls the machine and performs the data processing. Memory stores, the bus carries, and I/O modules deal with devices.' },  // explanation shown after answering: the processor runs programs; the other parts store, carry or handle devices
          { type: 'multi', q: 'Which of these are among the four main structural elements of a computer?',  // quiz question 2 (select all): which are the four structural elements
            choices: ['Processor', 'Main memory', 'I/O modules', 'System bus', 'The operating system', 'The keyboard'], answer: [0, 1, 2, 3],  // six choices; the first four are correct, the OS and keyboard are not
            why: 'The four structural elements are the processor, main memory, I/O modules and the system bus. The operating system is software that runs on them, and a keyboard is an external device reached through an I/O module.' },  // explanation: the OS is software and a keyboard is an external device
          { type: 'match', q: 'Match each register to what it holds.',  // quiz question 3 (match the pairs): each register with what it holds
            pairs: [['MAR', 'The address of the memory cell for the next read or write'], ['MBR', 'Data just read from memory, or about to be written to it'], ['I/O AR', 'The number of the particular I/O device being addressed'], ['I/O BR', 'Data passing between an I/O module and the processor'], ['PC', 'The address of the next instruction to fetch']],  // the five register and description pairs, including the PC
            why: 'Address registers (MAR, I/O AR, and the PC for instructions) say <i>where</i>; buffer registers (MBR, I/O BR) carry the data itself.' },  // explanation: address registers say where, buffer registers carry the data
          { type: 'tf', q: 'Main memory keeps its contents when the computer is switched off.', answer: false,  // quiz question 4 (true or false): main memory keeps its contents when switched off; the answer is false
            why: 'Main memory is usually volatile: without power its bits are lost. Anything that must survive a shutdown has to be saved to secondary memory, such as a disk.' },  // explanation: memory is volatile, so data must be saved to secondary memory
          { type: 'num', q: 'A main memory has 4096 locations, numbered in the usual way. What is the address of the last location?', answer: 4095, tol: 0,  // quiz question 5 (calculate): the last address of a 4096-location memory, exactly 4095
            why: 'Addresses start at 0, so n locations have addresses 0 to n − 1. With n = 4096 the last address is 4096 − 1 = 4095.' },  // explanation: addresses run 0 to n - 1
          { type: 'num', q: 'A memory uses 10-bit addresses, and every possible address names a cell. How many cells can it have?', answer: 1024, tol: 0, unit: 'cells',  // quiz question 6 (calculate): how many cells 10-bit addresses can name, exactly 1024
            why: 'Each extra address bit doubles the count, so k bits give 2<sup>k</sup> addresses. 2<sup>10</sup> = 1024 cells, numbered 0 to 1023.' },  // explanation: k bits give 2 to the power k addresses
          { type: 'order', q: 'Put the steps of a memory read in order.',  // quiz question 7 (put in order): the steps of a memory read
            items: ['The processor places the cell’s address in the MAR', 'The address goes out on the bus with a READ control signal', 'Memory places a copy of that cell’s contents on the data lines', 'The value arrives in the MBR, ready for the processor to use'],  // the four steps in their correct order; the quiz engine shuffles them for the student
            why: 'The <i>where</i> goes out first (MAR → address lines, with READ); then the <i>what</i> comes back (data lines → MBR). Reading leaves the cell unchanged.' },  // explanation: the where goes out first, then the what comes back, and the cell is unchanged
          { type: 'bucket', q: 'Where is each thing found?', buckets: ['Processor', 'Main memory', 'I/O module'],  // quiz question 8 (sort into groups): whether each thing is in the processor, memory or an I/O module
            items: [['The MAR', 0], ['A running program’s instructions', 1], ['A key press waiting in a buffer', 2], ['The I/O BR', 0], ['The OS, once loaded at start-up', 1], ['Control logic for one kind of device', 2]],  // the six items, each with the number of its correct group
            why: 'Registers such as the MAR and I/O BR live inside the processor; running programs (the operating system included) live in main memory; an I/O module holds data in transit in its buffers and handles the details of its own device.' },  // explanation: registers are in the processor, programs in memory, buffered data and device logic in the module
          { q: 'A memory cell holds the bit pattern <span class="mono">0001 0000 0000 1000</span>. What is it?',  // quiz question 9 (multiple choice): is this bit pattern an instruction or data?
            choices: ['An instruction, because it starts with 0001', 'Data, because every bit pattern is a number', 'It could be an instruction or data; it depends on how the processor uses it', 'The cell’s own address, because every cell stores its address'], answer: 2,  // four choices; the right one says it depends on how the processor uses it
            feedback: ['Those first bits could name an operation, but the very same bits could be the number 4104. Nothing in the pattern says which.', 'The same bits could equally be fetched and carried out as an instruction.', null, 'A cell does not store its own address. The address is the cell’s position number; the contents are whatever bits were last written there.'],  // feedback for each wrong choice: the same bits could be a number, an instruction, and a cell does not store its address
            why: 'Memory cells hold plain bit patterns. A pattern acts as an instruction if the processor fetches it as one, and as data if a program reads it as a value.' },  // explanation: a pattern is an instruction if fetched as one, data if read as a value
          { q: 'The processor wants to send the letter A to the printer. Which registers does it fill?',  // quiz question 10 (multiple choice): which registers are filled to send the letter A to the printer
            choices: ['MAR with the printer’s number and MBR with the letter', 'I/O AR with the printer’s device number and I/O BR with the letter', 'PC with the printer’s number and IR with the letter', 'I/O BR with the printer’s number and I/O AR with the letter'], answer: 1,  // four choices; the right one uses the I/O AR for the device and the I/O BR for the letter
            feedback: ['The MAR/MBR pair is used for memory cells, not for devices.', null, 'The PC and IR steer the program’s own instructions; they are not used to exchange data with devices.', 'Swapped. The address register (I/O AR) says which device; the buffer register (I/O BR) carries the data.'],  // feedback for each wrong choice: memory pair, program registers, or the pair swapped round
            why: 'For I/O the processor uses the I/O pair: the I/O AR names the particular device (where) and the I/O BR holds the data being exchanged (what).' },  // explanation: the I/O AR names the device and the I/O BR holds the data
          { q: 'Why does an I/O module contain internal buffers?',  // quiz question 11 (multiple choice): why an I/O module has internal buffers
            choices: ['To store files permanently while the power is off', 'To hold data briefly until the other side (processor or device) is ready to take it', 'To make the external device itself run faster', 'To hold the instructions of the program that is running'], answer: 1,  // four choices; the right one is holding data until the other side is ready
            feedback: ['Permanent storage is secondary memory, such as a disk. Buffers are temporary holding areas.', null, 'A buffer cannot speed up a device; it only lets the fast side and the slow side each work at their own pace.', 'Running programs live in main memory, not in I/O modules.'],  // feedback for each wrong choice: buffers are not permanent storage, cannot speed up a device, do not hold programs
            why: 'Processors and devices work at very different speeds and moments. A buffer lets data wait briefly, so neither side has to be ready at exactly the same instant and nothing is lost.' },  // explanation: devices and processors work at different speeds, so data waits briefly
          { type: 'multi', q: 'Which of these are part of the external environment that I/O modules connect a computer to?',  // quiz question 12 (select all): what belongs to the external environment
            choices: ['A disk drive', 'A network card (communications equipment)', 'A keyboard and screen (a terminal)', 'Main memory', 'The MBR'], answer: [0, 1, 2],  // five choices; disk, network card and terminal are correct, main memory and the MBR are inside the computer
            why: 'The external environment includes secondary memory devices such as disks, communications equipment and terminals. Main memory and the processor’s registers are inside the computer itself; the processor reaches main memory directly over the system bus.' },  // explanation: the external environment is disks, communications equipment and terminals
        ],  // closes the quiz list
      },  // closes step 9
    ],  // closes the steps list
    notes: `${/* notes: the printable reading notes for this section, written as HTML inside backticks */''}
<h3>1. Four parts that work as a team</h3>${/* notes heading for part 1: four parts that work as a team */''}
<p>A computer consists of processor, memory and I/O components, connected so they can work together to <b>execute</b> (run) <b>programs</b>. At the top level there are four main structural elements:</p>${/* notes paragraph: a computer's parts work together to run programs; there are four structural elements */''}
<ul>${/* start of the bullet list of the four elements */''}
<li><b>Processor.</b> Controls the operation of the whole computer and performs its data processing. It runs programs by fetching their instructions and carrying them out. When a machine has just one processor it is usually called the <b>central processing unit (CPU)</b>.</li>${/* notes bullet: the processor controls the computer and is called the CPU when there is only one */''}
<li><b>Main memory.</b> Stores the programs being run and the data they use. It is usually <b>volatile</b>: when the power goes off, its contents are lost. Also called <b>real memory</b> or <b>primary memory</b>.</li>${/* notes bullet: main memory holds programs and data, is volatile, and its other names */''}
<li><b>I/O modules.</b> Move data between the computer and its <b>external environment</b>, in both directions. It consists of devices: <b>secondary memory devices</b> such as disks, <b>communications equipment</b> such as network cards, and <b>terminals</b> (keyboard and screen).</li>${/* notes bullet: I/O modules link the computer to disks, network equipment and terminals */''}
<li><b>System bus.</b> Provides communication among the processor(s), main memory and the I/O modules. It carries <b>address</b> signals (where), <b>data</b> (what) and <b>control</b> signals (read or write, and when).</li>${/* notes bullet: the system bus carries address, data and control signals between all parts */''}
</ul>${/* ends the bullet list of the four elements */''}
<svg viewBox="0 0 520 168" width="520" font-size="13">${/* start of a small notes diagram (SVG) of the four elements, with fixed colours so it prints well */''}
<rect x="4" y="28" width="192" height="132" rx="10" fill="#e1eaff" stroke="#2563eb"/><rect x="212" y="4" width="26" height="160" rx="6" fill="#e8e7fd" stroke="#4f46e5"/>${/* diagram: the processor box and the tall bus bar */''}
<rect x="254" y="4" width="262" height="86" rx="10" fill="#d7f5e8" stroke="#059669"/><rect x="254" y="100" width="262" height="64" rx="10" fill="#ffe8d6" stroke="#ea580c"/>${/* diagram: the main memory box and the I/O module box */''}
<path d="M196 94h16M238 47h16M238 132h16" stroke="#3d4760" stroke-width="3"/>${/* diagram: three short connector lines from the bus to each box */''}
<text x="14" y="48" font-weight="bold" style="fill:#2563eb">PROCESSOR (CPU)</text><text x="14" y="72" style="fill:#151c2c">PC, IR (run the program)</text><text x="14" y="94" style="fill:#151c2c">MAR, MBR (memory pair)</text><text x="14" y="116" style="fill:#151c2c">I/O AR, I/O BR (I/O pair)</text><text x="14" y="138" style="fill:#151c2c">execution unit</text>${/* diagram labels inside the processor: its registers in pairs and the execution unit */''}
<text x="225" y="84" transform="rotate(-90 225 84)" text-anchor="middle" font-weight="bold" style="fill:#4f46e5">SYSTEM BUS</text>${/* diagram label: SYSTEM BUS written sideways along the bar */''}
<text x="264" y="24" font-weight="bold" style="fill:#059669">MAIN MEMORY: cells 0 … n − 1</text><text x="264" y="46" style="fill:#151c2c">each cell: bits (instruction or data)</text><text x="264" y="68" style="fill:#151c2c">volatile; also real or primary memory</text>${/* diagram labels for main memory: cells 0 to n - 1, bits, volatile */''}
<text x="264" y="124" font-weight="bold" style="fill:#ea580c">I/O MODULE (with buffers)</text><text x="264" y="146" style="fill:#151c2c">→ disks, network equipment, terminals</text>${/* diagram labels for the I/O module: buffers and the devices it reaches */''}
</svg>${/* ends the notes diagram */''}
<h3>2. Registers inside the processor</h3>${/* notes heading for part 2: registers inside the processor */''}
<p>A <b>register</b> is a tiny, very fast storage slot inside the processor. The <b>program counter (PC)</b> holds the address of the next instruction to fetch and the <b>instruction register (IR)</b> holds the instruction being carried out (Section 1.3). The <b>execution unit</b> does the arithmetic, comparisons and moves. A real processor has many more registers, but four exist only to exchange data with the rest of the machine:</p>${/* notes paragraph: what a register is, the PC, the IR and the execution unit */''}
<table><tr><th></th><th>Where (address)</th><th>What (data)</th></tr>${/* notes table of the exchange registers: header row with Where and What columns */''}
<tr><td><b>Memory</b></td><td><b>MAR</b> (memory address register): the address in memory for the next read or write</td><td><b>MBR</b> (memory buffer register): the data to be written into memory, or the data just read from it</td></tr>${/* notes table row: the memory pair, MAR and MBR */''}
<tr><td><b>I/O</b></td><td><b>I/O AR</b> (I/O address register): specifies a particular I/O device</td><td><b>I/O BR</b> (I/O buffer register): the data exchanged between an I/O module and the processor</td></tr></table>${/* notes table row: the I/O pair, I/O AR and I/O BR */''}
<p>An address register never holds the data, and a buffer register never says where: the number 9 is a place in the MAR but a value in the MBR. Memory uses the MAR/MBR pair; devices use the I/O AR/I/O BR pair.</p>${/* notes paragraph: the same number is a place in the MAR but a value in the MBR */''}
<h3>3. Main memory as numbered cells</h3>${/* notes heading for part 3: main memory as numbered cells */''}
<p>Main memory is a set of locations numbered one after another. Each number is the location’s <b>address</b>; with n locations the addresses run from <b>0 to n − 1</b>. Each location holds a binary number, a pattern of <b>bits</b>, that can be an <b>instruction</b> or <b>data</b>. The bits do not label themselves: a pattern is an instruction if the processor fetches it as one, and data if a program uses it as a value. For example, 0001 0000 0000 1000 (hex 1008; one hex digit stands for 4 bits) is the number 4104, but in a toy machine whose instructions use the first 4 bits for the operation and the last 12 for a cell number it means “load from cell 8”. A cell is never truly empty; it always holds some bits. (Toy cells here hold 16 bits; real machines usually give each 8-bit byte its own address.)</p>${/* notes paragraph: addresses 0 to n - 1, and a bit pattern can be an instruction or data (with the 1008 example) */''}
<p><b>Reading hex.</b> Long bit patterns are easier to read in <b>hexadecimal</b> (base 16). Each hex digit stands for exactly 4 bits and counts 0–9 and then A–F, where A = 10 and F = 15. Each place is worth 16 times the place to its right, so hex 0019 = 1×16 + 9 = 25, hex 0011 = 17 and hex 002A = 2×16 + 10 = 42: the toy program’s 25 + 17 = 42, written in hex. <b>Text</b> is stored as numbers too: each letter has a number code (H = 72, i = 105), so the 16 bits of hex 4869 can also be read as the two letters “Hi”. If the first hex digit of a word is not an operation the machine knows, the word cannot run as an instruction and can only be data.</p>${/* notes paragraph: how to read hex, and how text is stored as number codes */''}
<p><b>Worked examples.</b> k address bits give 2<sup>k</sup> addresses. 5 bits → 2<sup>5</sup> = 32 cells, addresses 0 to 31. 10 bits → 1024 cells, 0 to 1023. A memory with 4096 locations has last address 4096 − 1 = 4095. Classic mistakes: saying the last address is n (it is n − 1), and confusing a cell’s address with its contents.</p>${/* notes paragraph: worked examples of k address bits giving 2 to the power k cells, and classic mistakes */''}
<h3>4. Following the data over the bus</h3>${/* notes heading for part 4: following the data over the bus */''}
<ol>${/* start of the numbered list of the four transfers */''}
<li><b>Memory read:</b> address → MAR; it goes out on the address lines with a READ signal; memory puts a copy of the cell’s contents on the data lines; the value lands in the MBR. The cell is unchanged.</li>${/* notes item: the steps of a memory read */''}
<li><b>Memory write:</b> address → MAR and value → MBR; address, data and WRITE go out together; memory stores the value; the old contents are gone.</li>${/* notes item: the steps of a memory write */''}
<li><b>Output to a device:</b> device number → I/O AR, data → I/O BR; the bus carries them with an I/O WRITE signal; only the module whose number matches takes the data into its buffer, then feeds the device at its own pace.</li>${/* notes item: the steps of output to a device */''}
<li><b>Input into memory:</b> device number → I/O AR with I/O READ; the module puts the buffered item on the data lines; it arrives in the I/O BR; the processor then writes it to memory using the MAR and MBR. (DMA, Section 1.7, spares the processor this chore.)</li>${/* notes item: the steps of input into memory, with a pointer to DMA later in the chapter */''}
</ol>${/* ends the numbered list of transfers */''}
<h3>5. Why I/O modules have buffers</h3>${/* notes heading for part 5: why I/O modules have buffers */''}
<p>An I/O module transfers data from external devices to the processor and memory, and back the other way. Devices are slow and unpredictable while the processor is fast and busy elsewhere, so the module holds data in <b>internal buffers</b> until the other side is ready. It also holds the control logic for its kind of device, sparing the processor the details. <b>Worked example:</b> one key arrives every 0.4 s and the processor empties the buffer every 2 s, so 2 ÷ 0.4 = 5 keys arrive between visits. A 4-slot buffer loses 5 − 4 = 1 key per visit (20%); an 8-slot buffer loses none. Output is the reverse: the processor drops a burst into the buffer at full speed and moves on while the module feeds the slow device. A buffer is temporary, not permanent storage.</p>${/* notes paragraph: buffers bridge the speed gap, with the worked example of keys lost between visits */''}
<h3>6. Volatile memory versus secondary memory</h3>${/* notes heading for part 6: volatile memory versus secondary memory */''}
<table><tr><th></th><th>Main memory</th><th>Disk (secondary memory)</th></tr>${/* notes comparison table: header row for main memory and disk */''}
<tr><td>Keeps data without power?</td><td>No (volatile)</td><td>Yes</td></tr>${/* notes table row: which keeps data without power */''}
<tr><td>Speed</td><td>Fast</td><td>Far slower</td></tr>${/* notes table row: speed */''}
<tr><td>Typical size</td><td>Gigabytes</td><td>Hundreds of GB and up</td></tr>${/* notes table row: typical size */''}
<tr><td>How the processor reaches it</td><td>Directly over the system bus</td><td>Through an I/O module</td></tr></table>${/* notes table row: how the processor reaches each one */''}
<p>Anything not saved to secondary memory is lost at power-off, even the OS, so every start-up begins by copying the OS from disk into main memory. In “16 GB memory, 512 GB storage”, the first figure is main memory and the second is secondary memory.</p>${/* notes paragraph: unsaved data and even the OS are lost at power-off; memory versus storage figures */''}
<h3>7. The kitchen analogy</h3>${/* notes heading for part 7: the kitchen analogy */''}
<p>Processor = the chef, who carries out every recipe step. Main memory = the counter: what is in use now, wiped at closing. Disk = the storeroom: huge, keeps things overnight, slow to reach. I/O module = the pass window, whose shelf (the buffer) lets orders and plates wait. System bus = the one shared aisle every trip uses. MAR = a slip naming a counter spot; MBR = the tray carrying the item.</p>`,  // notes paragraph: every part matched with its kitchen job; the backtick then ends the notes text
  });  // closes the section object and ends the call that registers it with the guide
})();  // closes the function that wraps the whole file and runs it straight away
