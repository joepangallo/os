// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 1.3 — Instruction Execution
   The fetch / execute loop, the PC and IR, the four kinds of instruction,
   and a complete register-level trace of a tiny 16-bit accumulator machine.
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  'use strict';  // turns on strict mode: the browser reports common mistakes as errors instead of silently ignoring them

  /* ---------- shared helpers for the tiny 16-bit accumulator machine ---------- */
  const hex = (n, d = 4) => (n >>> 0).toString(16).toUpperCase().padStart(d, '0').slice(-d);  // hex(n, d): writes n as d uppercase hexadecimal digits (4 by default), e.g. 2369 becomes "0941"
  const bin = (n, bits = 16) => (n >>> 0).toString(2).padStart(bits, '0').slice(-bits).replace(/(.{4})(?=.)/g, '$1 ');  // bin(n, bits): writes n as 16 binary digits with a space after every group of 4, so long words stay readable
  // the three opcodes the classic example uses (the real machine has room for 16)
  const OPS = {  // OPS: the instruction set of the tiny machine, looked up by opcode number (1, 2 and 5)
    1: { mn: 'LOAD', verb: 'Load AC from memory', short: (a) => 'AC ← [' + hex(a, 3) + ']' },  // opcode 1 = LOAD: its name, a plain description, and short(a) which writes the action as "AC ← [address]"
    2: { mn: 'STORE', verb: 'Store AC to memory', short: (a) => '[' + hex(a, 3) + '] ← AC' },  // opcode 2 = STORE: copies the accumulator into the memory cell named by the address field
    5: { mn: 'ADD', verb: 'Add to AC from memory', short: (a) => 'AC ← AC + [' + hex(a, 3) + ']' },  // opcode 5 = ADD: adds the word at the given address to the accumulator and keeps the sum there
  };  // closes the OPS table
  const opOf = (w) => (w >>> 12) & 0xF;  // opOf(w): shifts the 16-bit word right by 12 places to keep only its top 4 bits, the opcode
  const addrOf = (w) => w & 0xFFF;  // addrOf(w): keeps only the bottom 12 bits of the word (a bit mask), which form the address field
  // sign-magnitude data words: bit 15 = sign, bits 0-14 = magnitude
  const toInt = (w) => ((w & 0x8000) ? -(w & 0x7FFF) : (w & 0x7FFF));  // toInt(w): reads a data word as a signed number; if bit 15 is set the value is negative
  const fromInt = (v) => (v < 0 ? 0x8000 | (Math.min(-v, 0x7FFF)) : Math.min(v, 0x7FFF));  // fromInt(v): the reverse of toInt, turning a number into a sign-magnitude word and capping its size at 15 bits
  const signed = (w) => { const v = toInt(w); return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v); };  // signed(w): shows a data word as a signed number with a + or − in front, for the value hints next to memory
  const parseHex = (s) => { const t = String(s || '').trim().replace(/^0x/i, ''); return /^[0-9a-fA-F]{1,4}$/.test(t) ? parseInt(t, 16) : null; };  // parseHex(s): turns typed text such as "1940" or "0x1940" into a number, or null if it is not 1 to 4 hex digits

  /* ---------- the classic 3-instruction program, as register-level frames ----------
     Program: 300: 1940 (load AC from 940), 301: 5941 (add [941] to AC), 302: 2941 (store AC to 941).
     Data:    940: 0003, 941: 0002.  Result: 941 = 0005, PC = 303.
     Each micro frame is the machine state AFTER that micro-step.
     stage: -1 = not started, 0..5 = F1 E1 F2 E2 F3 E3, 6 = finished.
     ch = what changed (highlighted), bus = active bus traffic, cell = memory cell being accessed. */
  const f = (pc, ir, ac, mar, mbr, m941, stage, ch, bus, cell, cap) => ({ pc, ir, ac, mar, mbr, m941, stage, ch: ch ? ch.split(' ') : [], bus: bus ? bus.split(' ') : [], cell, cap });  // f(...): builds one animation frame object from its parts; the ch and bus lists arrive as space-separated text
  const N = null;  // N is short for null, meaning "empty" or "not used in this frame", to keep the frame table readable
  const MICRO = [  // MICRO: the 19 small frames of the step-by-step trace of the three-instruction program
    f(0x300, N, N, N, N, 0x0002, -1, '', '', N, '<b>Start.</b> The program sits at 300–302 and its two numbers at 940 and 941 (all values are hex). In an instruction word the first hex digit is the opcode (1 = load AC, 5 = add to AC, 2 = store AC) and the other three are an address. The PC holds 300, so the first fetch comes from there.'),  // frame 0: nothing has run yet; the caption explains where the program and data sit and how to read a word
    f(0x300, N, N, 0x300, N, 0x0002, 0, 'mar', 'addr', 0x300, '<b>Fetch 1 · address out.</b> The PC’s value, 300, is copied into the MAR, which puts it on the address lines: “send me the word at 300.”'),  // fetch 1, part 1: the PC value 300 is copied into the MAR and goes out on the address lines
    f(0x300, N, N, 0x300, 0x1940, 0x0002, 0, 'mbr', 'addr read', 0x300, '<b>Fetch 1 · word comes back.</b> Memory reads cell 300 and sends its contents, 1940, over the data lines into the MBR.'),  // fetch 1, part 2: memory sends the word 1940 from cell 300 back into the MBR
    f(0x301, 0x1940, N, 0x300, 0x1940, 0x0002, 0, 'ir pc', '', N, '<b>Fetch 1 · into the IR.</b> The word moves from the MBR into the IR, and the PC is incremented to 301 so it points at the next instruction.'),  // fetch 1, part 3: 1940 moves into the IR and the PC is incremented to 301
    f(0x301, 0x1940, N, 0x940, 0x1940, 0x0002, 1, 'mar', 'addr', 0x940, '<b>Execute 1 · decode.</b> The processor decodes the IR, splitting 1940 into its opcode (1 = “load AC from memory”) and its address field (940). To fetch that operand, 940 goes into the MAR.'),  // execute 1, part 1: the IR is decoded (opcode 1 = load) and the operand address 940 goes into the MAR
    f(0x301, 0x1940, N, 0x940, 0x0003, 0x0002, 1, 'mbr', 'addr read', 0x940, '<b>Execute 1 · operand arrives.</b> Memory returns the word stored at 940, which is 0003, into the MBR.'),  // execute 1, part 2: memory returns 0003 from cell 940 into the MBR
    f(0x301, 0x1940, 0x0003, 0x940, 0x0003, 0x0002, 1, 'ac', '', N, '<b>Execute 1 · done.</b> The MBR is copied into the AC, so AC = 0003. One complete instruction cycle (fetch + execute) is finished. Notice the PC already says 301.'),  // execute 1, part 3: the MBR is copied into the AC, which now holds 0003; the first instruction cycle is done
    f(0x301, 0x1940, 0x0003, 0x301, 0x0003, 0x0002, 2, 'mar', 'addr', 0x301, '<b>Fetch 2 · address out.</b> The next cycle starts exactly like the first: PC (301) → MAR → address lines.'),  // fetch 2, part 1: the PC (301) goes into the MAR, exactly like the first fetch
    f(0x301, 0x1940, 0x0003, 0x301, 0x5941, 0x0002, 2, 'mbr', 'addr read', 0x301, '<b>Fetch 2 · word comes back.</b> Memory sends back 5941, the word stored at 301.'),  // fetch 2, part 2: memory returns 5941, the second instruction
    f(0x302, 0x5941, 0x0003, 0x301, 0x5941, 0x0002, 2, 'ir pc', '', N, '<b>Fetch 2 · into the IR.</b> 5941 replaces the old instruction in the IR, and the PC steps on to 302.'),  // fetch 2, part 3: 5941 goes into the IR and the PC moves on to 302
    f(0x302, 0x5941, 0x0003, 0x941, 0x5941, 0x0002, 3, 'mar', 'addr', 0x941, '<b>Execute 2 · decode.</b> Opcode 5 means “add to AC from memory”, address 941. The processor sends 941 out through the MAR.'),  // execute 2, part 1: opcode 5 (add) is decoded and address 941 goes into the MAR
    f(0x302, 0x5941, 0x0003, 0x941, 0x0002, 0x0002, 3, 'mbr', 'addr read', 0x941, '<b>Execute 2 · operand arrives.</b> The word at 941, 0002, lands in the MBR.'),  // execute 2, part 2: the operand 0002 from cell 941 arrives in the MBR
    f(0x302, 0x5941, 0x0005, 0x941, 0x0002, 0x0002, 3, 'ac alu', '', N, '<b>Execute 2 · add.</b> The ALU adds the MBR to the AC: 3 + 2 = 5, and the sum replaces the AC’s old value. AC = 0005.'),  // execute 2, part 3: the ALU adds 3 + 2 and the AC now holds 0005
    f(0x302, 0x5941, 0x0005, 0x302, 0x0002, 0x0002, 4, 'mar', 'addr', 0x302, '<b>Fetch 3 · address out.</b> PC (302) → MAR → address lines.'),  // fetch 3, part 1: the PC (302) goes into the MAR
    f(0x302, 0x5941, 0x0005, 0x302, 0x2941, 0x0002, 4, 'mbr', 'addr read', 0x302, '<b>Fetch 3 · word comes back.</b> Memory returns 2941, the word stored at 302.'),  // fetch 3, part 2: memory returns 2941, the third instruction
    f(0x303, 0x2941, 0x0005, 0x302, 0x2941, 0x0002, 4, 'ir pc', '', N, '<b>Fetch 3 · into the IR.</b> 2941 goes into the IR and the PC moves on to 303.'),  // fetch 3, part 3: 2941 goes into the IR and the PC moves on to 303
    f(0x303, 0x2941, 0x0005, 0x941, 0x0005, 0x0002, 5, 'mar mbr', 'addr', 0x941, '<b>Execute 3 · decode.</b> Opcode 2 means “store AC to memory”, address 941. This time the processor fills <i>both</i> helpers: MAR ← 941 and MBR ← AC (0005).'),  // execute 3, part 1: opcode 2 (store) is decoded; the MAR gets 941 and the MBR gets a copy of the AC
    f(0x303, 0x2941, 0x0005, 0x941, 0x0005, 0x0005, 5, 'm941', 'addr write', 0x941, '<b>Execute 3 · write.</b> The MBR’s word travels out over the data lines and memory stores it at 941. The old 0002 is overwritten.'),  // execute 3, part 2: memory writes 0005 into cell 941, replacing the old 0002
    f(0x303, 0x2941, 0x0005, 0x941, 0x0005, 0x0005, 6, '', '', N, '<b>Finished.</b> Three instruction cycles, six stages: cell 941 now holds 0005 (3 + 2) and the PC holds 303, ready to fetch whatever comes next.'),  // last frame: the run is finished, cell 941 holds 0005 and the PC holds 303
  ];  // closes the MICRO frame list
  // the "6 big steps" view: the state after each whole stage, with everything that changed during it
  const BIG = [  // BIG: the shorter "6 big steps" view, one frame per whole fetch or execute stage
    [0, '', '', N, MICRO[0].cap],  // big step 0: reuses the starting frame and its caption unchanged
    [3, 'mar mbr ir pc', 'addr read', 0x300, '<b>Step 1 · Fetch.</b> The PC holds 300, so the word at 300 (1940) is loaded into the IR, and the PC goes up to 301.'],  // big step 1 (fetch): shows MICRO frame 3 with everything the whole first fetch changed highlighted
    [6, 'mar mbr ac', 'addr read', 0x940, '<b>Step 2 · Execute.</b> The first hex digit of 1940 (opcode 1) says “load AC”; the other three (940) say from where. AC ← 0003.'],  // big step 2 (execute): the load; AC receives 0003 from cell 940
    [9, 'mar mbr ir pc', 'addr read', 0x301, '<b>Step 3 · Fetch.</b> The word at 301 (5941) is loaded into the IR; the PC goes up to 302.'],  // big step 3 (fetch): the second instruction, 5941, is fetched and the PC moves to 302
    [12, 'mar mbr ac alu', 'addr read', 0x941, '<b>Step 4 · Execute.</b> Opcode 5 = add to AC from memory. The old AC (3) plus the word at 941 (2) gives 5. AC ← 0005.'],  // big step 4 (execute): the add; the ALU is highlighted as AC becomes 0005
    [15, 'mar mbr ir pc', 'addr read', 0x302, '<b>Step 5 · Fetch.</b> The word at 302 (2941) is loaded into the IR; the PC goes up to 303.'],  // big step 5 (fetch): the third instruction, 2941, is fetched and the PC moves to 303
    [17, 'mar mbr m941', 'addr write', 0x941, '<b>Step 6 · Execute.</b> Opcode 2 = store AC to memory. The AC (0005) is written into 941. Done: 941 holds 0005 and the PC holds 303.'],  // big step 6 (execute): the store writes 0005 into cell 941, which ends the program
  ].map(([k, ch, bus, cell, cap]) => Object.assign({}, MICRO[k], { ch: ch ? ch.split(' ') : [], bus: bus ? bus.split(' ') : [], cell, cap, stage: k === 0 ? -1 : MICRO[k].stage }));  // turns each row into a full frame: copies the MICRO frame and swaps in this step's highlights, bus, cell and caption

  Guide.section({  // registers this section with the guide shell, which builds its slides, glossary and quiz from the object below
    id: '1.3',  // section number; the shell uses it for the slide keys, the colours and the contents list
    title: 'Instruction Execution',  // full section title shown at the top of every step
    short: 'Instruction execution',  // short title used in tight spots such as the chapter list on the home page
    summary: 'How a processor runs a program: fetch, execute, repeat, traced on a tiny 16-bit accumulator machine.',  // one-sentence summary shown next to the section on its chapter overview page
    objectives: [  // learning objectives, printed in the printable version of the guide
      'Describe the instruction cycle as a fetch stage followed by an execute stage, repeated until the processor halts.',  // objective 1: the instruction cycle as fetch then execute, repeated until a halt
      'Explain how the program counter and instruction register work together during a fetch, and how a jump changes the flow.',  // objective 2: how the PC and IR cooperate during a fetch, and how a jump redirects the program
      'Sort instructions into the four categories: processor-memory, processor-I/O, data processing and control.',  // objective 3: sorting instructions into the four categories
      'Decode a 16-bit instruction word of a simple accumulator machine and trace a short program register by register, including the MAR and MBR.',  // objective 4: decoding a 16-bit word and tracing a short program register by register
      'Explain why direct memory access (DMA) frees the processor from moving I/O data word by word.',  // objective 5: why direct memory access takes the word-by-word I/O work off the processor
    ],  // closes the objectives list
    terms: [  // key terms: each pair is [term, definition]; they feed the glossary drawer and the chapter flash cards
      ['Program', 'An ordered list of instructions stored in memory. The processor carries them out one after another.'],  // glossary entry: defines a program as an ordered list of instructions in memory
      ['Instruction', 'A single, very small command the processor knows how to perform, stored in memory as a pattern of bits (for example, “add the number at address 941 to the accumulator”).'],  // glossary entry: defines an instruction as one small command stored as bits
      ['Instruction cycle', 'Everything the processor does for one instruction: fetch it from memory, then execute it. The cycle repeats until the processor halts.'],  // glossary entry: defines the instruction cycle (fetch, then execute, repeated)
      ['Fetch stage', 'The first half of every instruction cycle: the processor reads the instruction whose address is in the program counter into the instruction register, then increments the program counter.'],  // glossary entry: defines the fetch stage, including the PC increment
      ['Execute stage', 'The second half of every instruction cycle: the processor decodes the instruction in the instruction register and carries out the action it specifies.'],  // glossary entry: defines the execute stage (decode, then carry out)
      ['Halt', 'The end of the instruction-cycle loop. It happens when the machine is switched off, when an error it cannot recover from occurs, or when the program runs an instruction that tells the processor to stop.'],  // glossary entry: defines halt and the three ways the loop can end
      ['Register', 'A tiny, extremely fast storage slot inside the processor. Each one holds a single value, such as an address or a number being worked on.'],  // glossary entry: defines a register as a tiny fast storage slot inside the processor
      ['Program counter (PC)', 'The register that holds the address of the next instruction to fetch. It is incremented after every fetch unless an instruction changes it.'],  // glossary entry: defines the program counter (PC)
      ['Instruction register (IR)', 'The register that holds the instruction just fetched, so the processor can decode it and carry it out.'],  // glossary entry: defines the instruction register (IR)
      ['Accumulator (AC)', 'The main working register of a simple processor. Numbers loaded from memory and the results of arithmetic are kept here temporarily.'],  // glossary entry: defines the accumulator (AC), the main working register
      ['Opcode', 'Short for operation code: the group of bits in an instruction that says which operation to perform, such as load, store or add.'],  // glossary entry: defines the opcode, the bits that choose the operation
      ['Address field', 'The bits of an instruction that name the memory location the instruction works with.'],  // glossary entry: defines the address field of an instruction
      ['Word', 'The fixed-size group of bits that the processor and memory store and move as one unit; each numbered memory cell holds one word. In the machine in this section a word is 16 bits.'],  // glossary entry: defines a word, the fixed-size unit (16 bits in this section)
      ['Hexadecimal (hex)', 'Base-16 notation using the digits 0–9 and A–F. Each hex digit stands for exactly four bits, so a 16-bit word is written as four hex digits.'],  // glossary entry: defines hexadecimal and why one hex digit equals four bits
      ['Sign-magnitude', 'A way of storing a signed number: the leftmost bit is the sign (0 = positive, 1 = negative) and the remaining bits hold the size of the number.'],  // glossary entry: defines sign-magnitude, the way this machine stores negative numbers
      ['Memory address register (MAR)', 'The register that holds the address of the memory location the processor is about to read or write.'],  // glossary entry: defines the memory address register (MAR)
      ['Memory buffer register (MBR)', 'The register that holds the word just read from memory, or the word about to be written to memory.'],  // glossary entry: defines the memory buffer register (MBR)
      ['Arithmetic logic unit (ALU)', 'The execution unit that does the actual arithmetic (add, subtract) and logic (AND, OR, NOT) on values held in registers. A simple processor has one; a modern core has several.'],  // glossary entry: defines the arithmetic logic unit (ALU)
      ['Jump', 'A control instruction that puts a new address into the program counter, so the next fetch comes from somewhere other than the next address in order.'],  // glossary entry: defines a jump, which puts a new address in the PC
      ['Direct memory access (DMA)', 'A way of moving data in which an I/O module reads or writes main memory itself, so the processor does not have to handle every word of the transfer.'],  // glossary entry: defines direct memory access (DMA)
    ],  // closes the terms list

    css: ` /* styles used only by this section; the shell adds them to the page once, when the section registers */
      .sec-1-3 .mono { font-variant-numeric: tabular-nums; } /* gives every digit the same width so register values do not shift sideways as they change */
      .sec-1-3 svg .s-hl { fill: var(--hl); stroke: var(--warn); } /* a highlighted SVG shape (SVG is the browser's drawing format): yellow fill with an orange edge marks the active part */
      .sec-1-3 svg .hot { cursor: pointer; } /* clickable parts of a diagram show a pointing-hand cursor so students know they can click them */
      .sec-1-3 svg .hot:hover rect, .sec-1-3 svg .hot:hover path.shape { stroke-width: 3.5; } /* hovering a clickable diagram part thickens its outline, a hint that it will respond to a click */
      .sec-1-3 svg .dim { opacity: .35; } /* fades a diagram part that is not involved right now so the active parts stand out */
      .sec-1-3 svg .on-cpu { fill: var(--cpu); } /* fills an SVG shape with the processor colour */
      .sec-1-3 .reg { display: grid; grid-template-columns: 54px minmax(0, 1fr); align-items: center; gap: 8px; } /* one register row: a fixed 54px name column on the left and the value box filling the rest */
      .sec-1-3 .reg .nm { font-weight: 800; font-size: 14px; color: var(--cpu); } /* register names (PC, IR, AC) in bold, in the processor colour */
      .sec-1-3 .reg .val { font-family: var(--mono); font-weight: 700; font-size: 16px; background: var(--panel); border: 2px solid var(--cpu); border-radius: 8px; padding: 3px 10px; min-height: 34px; display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; white-space: nowrap; } /* the register value box: monospace digits in a bordered box that never wraps or grows wider than its column */
      .sec-1-3 .reg .val.chg { background: var(--hl); border-color: var(--warn); } /* a register that just changed turns yellow with an orange border so the eye goes straight to it */
      .sec-1-3 .bits { display: grid; grid-template-columns: repeat(16, minmax(0, 1fr)); gap: 4px; } /* the 16-bit word editor: 16 equal columns, one per bit */
      .sec-1-3 .bits.lab span { font-size: 12.5px; font-weight: 800; text-align: center; border-bottom: 3px solid currentColor; padding-bottom: 1px; white-space: nowrap; overflow: hidden; } /* label row above the bits (opcode, address, sign, magnitude): small bold text with a coloured underline */
      .sec-1-3 .bits.hx span { font-family: var(--mono); font-size: 13px; font-weight: 700; text-align: center; color: var(--muted); border-top: 2px solid var(--line-2); padding-top: 1px; } /* hex row below the bits: shows the hex digit each group of four bits makes, in muted monospace text */
      .sec-1-3 .bit { height: 42px; border-radius: 8px; border: 2px solid var(--line-2); background: var(--panel-2); font-family: var(--mono); font-size: 19px; font-weight: 800; cursor: pointer; padding: 0; color: var(--ink); min-width: 0; } /* one clickable bit button: tall rounded box with a large 0 or 1 in monospace */
      .sec-1-3 .bit:hover { filter: brightness(1.06); transform: translateY(-1px); } /* hovering a bit brightens it and lifts it slightly, showing that it can be clicked */
      .sec-1-3 .bit.nib { margin-right: 5px; } /* adds a small gap after every fourth bit so the word visibly splits into hex-digit groups */
      .sec-1-3 .bit.op { border-color: var(--accent); background: var(--accent-bg); } /* opcode bits get the accent colour so the operation part of an instruction stands out */
      .sec-1-3 .bit.ad { border-color: var(--mem); background: var(--mem-bg); } /* address bits get the memory colour */
      .sec-1-3 .bit.sg { border-color: var(--warn); background: var(--warn-bg); } /* the sign bit of a data word gets the warning colour */
      .sec-1-3 .bit.mg { border-color: var(--cpu); background: var(--cpu-bg); } /* the magnitude bits of a data word get the processor colour */
      .sec-1-3 .cell-in { width: 72px; height: 32px; font-family: var(--mono); font-size: 16px; font-weight: 700; text-align: center; border: 2px solid var(--line-2); border-radius: 8px; background: var(--panel); color: var(--ink); text-transform: uppercase; padding: 0 4px; } /* a memory cell input box in the program editor: fixed width, monospace, centred, always uppercase hex */
      .sec-1-3 .cell-in:focus { border-color: var(--accent); outline: none; } /* the cell box being typed in gets an accent-coloured border instead of the browser's default outline */
      .sec-1-3 .cell-in.bad { border-color: var(--bad); background: var(--bad-bg); } /* a cell holding text that is not valid hex turns red so the student sees the mistake at once */
      .sec-1-3 .mrow { display: grid; grid-template-columns: 38px 76px minmax(0, 1fr); gap: 8px; align-items: center; padding: 2px 6px; border-radius: 9px; border: 2px solid transparent; } /* one memory row in the editor: address, the input box, then a hint explaining what the word means */
      .sec-1-3 .mrow.pc { background: var(--cpu-bg); border-color: var(--cpu); } /* the row the PC points at is tinted in the processor colour, marking the next instruction to fetch */
      .sec-1-3 .mrow .hint { font-family: var(--mono); font-size: 13px; line-height: 1.2; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } /* the hint text (for example "LOAD 940"): one line in monospace, cut off with "..." if too long */
      .sec-1-3 .mrow .hint .was { font-family: var(--font); font-size: 12.5px; font-weight: 700; color: var(--warn); } /* the "was ..." note inside a hint, showing a cell's old value, in bold warning-coloured text */
      .sec-1-3 .cell-in.wr { border-color: var(--warn); background: var(--hl); } /* a cell the running program has written to gets the highlight colour */
      .sec-1-3 .mrow.just .cell-in { outline: 3px solid var(--warn); outline-offset: 1px; } /* the cell written by the most recent step also gets a thick orange outline */
      .sec-1-3 .live-key { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 2px solid var(--warn); background: var(--hl); vertical-align: -1px; margin-right: 4px; } /* the small yellow square in the legend that explains what the highlight colour means */
    `,  // end of the section's CSS text

    steps: [  // steps: the list of screens in this section, shown in order as the student presses Next
      /* ---------------- 1. Big picture: the fetch / execute loop ---------------- */
      {  // step 1 object starts here
        title: 'One tiny loop runs every program',  // step 1 title shown at the top of the screen
        kind: 'story',  // kind "story" labels the step as the Big Picture and keeps it on the core path
        render(el, ctx) {  // render(el, ctx): builds step 1 inside el each time the step is opened; ctx holds the shell's helpers
          const { h, s } = ctx;  // takes the two element builders from ctx: h makes HTML elements, s makes SVG elements
          const INFO = {  // INFO: the explanation shown in the card under the diagram for each clickable part of the loop
            start: ['Start', 'When the machine is switched on or reset, the <span class="t">program counter (PC)</span> is set to the address of the first instruction to run.'],  // explanation for START: what the PC is set to when the machine is switched on or reset
            fetch: ['Fetch stage', 'Read the instruction whose address is in the PC from memory into the <span class="t">instruction register (IR)</span>, then add 1 to the PC so it points at the next one.'],  // explanation for the fetch stage: read the instruction at the PC into the IR, then add 1 to the PC
            exec: ['Execute stage', '<b>Decode</b> the instruction sitting in the IR (work out what its bits ask for), then do it: move data, do arithmetic, talk to a device, or change the PC.'],  // explanation for the execute stage: decode the instruction in the IR, then carry it out
            loop: ['Back to fetch', 'The moment one instruction is finished, the next fetch begins automatically, from whatever address the PC now holds. One fetch plus one execute is one full instruction cycle.'],  // explanation for the loop arrow: the next fetch begins as soon as one instruction finishes
            halt: ['Halt', 'The loop only ends when the processor is switched off, hits an error it cannot recover from, or executes an instruction that tells it to stop. Nothing else breaks the cycle.'],  // explanation for HALT: the three things that can end the loop
          };  // closes the INFO table
          const svg = s('svg', { viewBox: '0 0 540 300', width: '100%', style: { maxHeight: '300px', display: 'block' }, role: 'img', 'aria-label': 'The basic instruction cycle: start, fetch stage, execute stage, back to fetch, or halt' });  // the loop diagram itself, an SVG drawing 540 by 300 units that scales to the card width
          const infoT = h('div', { class: 'b', style: { color: 'var(--chc)' } });  // title line of the explanation card, in the chapter colour
          const infoB = h('div', { class: 'small' });  // body text of the explanation card
          const info = h('div', { class: 'card tight', style: { minHeight: '92px' } }, infoT, infoB);  // the explanation card; its minimum height stops the layout jumping when the text length changes
          const counter = h('span', { class: 'chip cpu mono' });  // a chip that shows how many instructions the loop has completed so far
          let phase = 0, count = 0, timer = null, picked = null;  // phase: 0 start, 1 fetch, 2 execute, 3 halted; count = instructions done; timer = the running interval; picked = the part clicked
          const show = (k) => { picked = k; infoT.textContent = INFO[k][0]; infoB.innerHTML = INFO[k][1]; draw(); };  // show(k): fills the explanation card for part k and redraws the diagram; used by clicks and by the animation
          function pill(key, x, y, label, act) {  // pill(...): draws a rounded START or HALT button at (x, y); act makes it highlighted
            return s('g', { class: 'hot', onclick: () => show(key) },  // the pill is a clickable group; clicking it shows that part's explanation
              s('rect', { x, y, width: 116, height: 40, rx: 20, class: act ? 's-hl' : 's-panel', 'stroke-width': act ? 4 : 2 }),  // the pill's rounded rectangle, highlighted with a thicker border when act is true
              s('text', { x: x + 58, y: y + 26, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, 'letter-spacing': '.06em' }, label));  // the pill's label, centred inside it
          }  // ends pill()
          function stage(key, x, cls, title, l1, l2, act) {  // stage(...): draws one of the two big stage boxes (fetch or execute) with a title and two lines of text
            return s('g', { class: 'hot', onclick: () => show(key) },  // the stage box is a clickable group; clicking it shows that stage's explanation
              act ? s('rect', { x: x - 7, y: 89, width: 224, height: 124, rx: 21, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-dasharray': '7 5' }) : null,  // when the stage is active, a dashed accent outline is drawn around the box
              s('rect', { x, y: 96, width: 210, height: 110, rx: 16, class: cls, 'stroke-width': act ? 4 : 2.5 }),  // the stage box itself, filled in the memory or processor colour passed in cls
              s('text', { x: x + 105, y: 134, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 18, 'letter-spacing': '.04em' }, title),  // the stage title, such as FETCH STAGE
              s('text', { x: x + 105, y: 162, 'text-anchor': 'middle', 'font-size': 14.5, class: 's-sub' }, l1),  // first line of the stage's description
              s('text', { x: x + 105, y: 182, 'text-anchor': 'middle', 'font-size': 14.5, class: 's-sub' }, l2));  // second line of the stage's description
          }  // ends stage()
          function draw() {  // draw(): rebuilds the whole diagram from the current phase; runs after every click and every animation tick
            svg.replaceChildren(  // replaceChildren swaps in a fresh set of shapes, so the old drawing is cleared in one go
              pill('start', 67, 14, 'START', phase === 0 && timer),  // START pill, highlighted only while the loop is running and has just started
              s('line', { x1: 125, y1: 56, x2: 125, y2: 90, class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from START down to the fetch stage; url(#arr) uses the arrowhead the shell defines once for the page
              stage('fetch', 20, 's-mem', 'FETCH STAGE', 'Read the next instruction', 'from memory into the IR', phase === 1),  // the fetch stage box, highlighted during phase 1
              s('line', { x1: 232, y1: 151, x2: 303, y2: 151, class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from fetch across to execute
              stage('exec', 310, 's-cpu', 'EXECUTE STAGE', 'Decode the instruction', 'and carry it out', phase === 2),  // the execute stage box, highlighted during phase 2
              s('g', { class: 'hot', onclick: () => show('loop') },  // the loop-back arrow is clickable too, so the student can read about "back to fetch"
                s('path', { d: 'M415 208 V250 H125 V214', class: 's-line', 'marker-end': 'url(#arr)', 'stroke-width': phase === 2 && timer ? 3.5 : 2 }),  // the path from the bottom of execute, along the bottom and up into fetch; thicker while the loop is running
                s('rect', { x: 190, y: 238, width: 160, height: 24, rx: 12, class: 's-panel', 'stroke-width': 1 }),  // a small label box sitting on the loop-back arrow
                s('text', { x: 270, y: 255, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'next instruction')),  // the label text "next instruction"
              s('line', { x1: 415, y1: 94, x2: 415, y2: 60, class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from the top of execute up to HALT
              pill('halt', 357, 14, 'HALT', phase === 3),  // HALT pill, highlighted once the loop has stopped
              s('text', { x: 270, y: 290, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'one fetch + one execute = one instruction cycle'),  // caption under the diagram: one fetch plus one execute makes one instruction cycle
            );  // ends the replaceChildren call
            counter.textContent = 'Instructions completed: ' + count;  // updates the counter chip with the number of instructions completed
            runBtn.innerHTML = timer ? 'Pause' : (phase === 3 ? 'Start again' : 'Run the loop');  // the Run button's label depends on the state: Pause while running, Start again after a halt
          }  // ends draw()
          const tick = () => {  // tick(): moves the loop forward one stage; the timer calls it every 900 ms while running
            if (phase === 3) { phase = 0; count = 0; }  // after a halt, the next tick starts over from zero
            if (phase === 0 || phase === 2) { if (phase === 2) count++; phase = 1; show('fetch'); } else { phase = 2; show('exec'); }  // from start or execute, go to fetch (counting the instruction just executed); from fetch, go to execute
          };  // ends tick()
          const stop = () => { if (timer) { clearInterval(timer); timer = null; } };  // stop(): cancels the repeating timer if one is running
          const runBtn = h('button', { class: 'btn primary', onclick: () => { if (timer) { stop(); draw(); } else { if (phase === 3) { phase = 0; count = 0; } timer = ctx.every(900, tick); tick(); } } });  // Run/Pause button: pauses if running; otherwise starts ticking every 900 ms (ctx.every stops it when the step closes)
          const stepBtn = h('button', { class: 'btn', onclick: () => { stop(); tick(); } }, 'One stage');  // "One stage" button: stops any running loop and advances exactly one stage
          // Halt = the instruction being handled is a halt instruction: it is executed (and counted), then the loop ends.
          // From the fetch stage it still passes through execute first, matching the diagram (HALT leaves from EXECUTE).
          const haltBtn = h('button', { class: 'btn', onclick: () => { stop(); if (phase === 1 || phase === 2) count++; phase = 3; show('halt'); infoB.innerHTML += ` <b>Stopped after ${count} instruction${count === 1 ? '' : 's'}.</b>`; } }, 'Halt');  // Halt button: stops the loop, counts the instruction being handled, and reports how many ran
          show('start');  // fills the explanation card with the START text when the step first opens
          el.append(h('div', { class: 'split l fill' },  // builds the page: a two-column layout with the text on the left and the diagram card on the right
            h('div', { class: 'stack', html: `${/* left column: introduction text written as HTML */''}
              <p class="lead m0">A <span class="t">program</span> is just a list of <span class="t">instructions</span> stored in memory. The processor brings it to life with one tiny loop.</p>${/* intro paragraph: a program is a list of instructions and one loop brings it to life */''}
              <p class="m0">Each trip around the loop is one <span class="t">instruction cycle</span>, and in its basic form it has two stages: <b>fetch</b> the next instruction from memory, then <b>execute</b> it. The processor repeats this, billions of times a second, until it <span class="t">halts</span>. (Section 1.4 adds a third stage: a check for interrupts.)</p>${/* paragraph: the two stages of the instruction cycle, and a pointer to the interrupt stage in section 1.4 */''}
              <div class="callout analogy m0" data-label="Analogy">A cook with a sticky-note bookmark reads the recipe line it marks, slides the note down a line, then does what the line said. “Go back to step 3” moves the note instead.</div>${/* analogy box: a cook moving a bookmark down a recipe, standing in for the program counter */''}
              <div class="callout why m0" data-label="Why it matters">Every program, the operating system included, runs on this loop, so everything later builds on it.</div>${/* "why it matters" box: every program, the operating system too, runs on this loop */''}
              <div class="row gap-s"><span class="xs muted b">COMING UP:</span><span class="chip cpu">trace a real program</span><span class="chip mem">decode 16-bit words</span><span class="chip accent">write your own</span></div>` }),  // a row of chips previewing the rest of the section; the backtick ends the intro HTML
            h('div', { class: 'card white stack', style: { justifyContent: 'center' } },  // right column: a white card holding the diagram, the explanation card and the controls
              svg, info,  // the loop diagram and the explanation card under it
              h('div', { class: 'row' }, runBtn, stepBtn, haltBtn, h('span', { class: 'grow' }), counter))));  // button row: Run, One stage and Halt, a spacer that pushes the counter chip to the right, then the counter
        },  // ends render() for step 1
      },  // ends step 1

      /* ---------------- 2. Fetch: PC and IR, plus a jump ---------------- */
      {  // step 2 object starts here: the fetch stage, the PC and the IR, and a jump
        title: 'Fetch: the program counter points the way',  // step 2 title
        kind: 'explore',  // kind "explore": a step the student plays with rather than just reads
        core: true,  // core: true keeps this step on the shorter core path through the guide
        render(el, ctx) {  // render(el, ctx): builds step 2 each time it is opened
          const { h } = ctx;  // takes the HTML element builder h from ctx
          const PROG = {  // PROG: the five-instruction program in memory, keyed by address
            100: { t: 'Load AC from address 200', k: ['mem', 'processor–memory'] },  // address 100: load the counter at 200 into the AC; t is the text shown, k is its category chip [colour, label]
            101: { t: 'Add 1 to AC', k: ['cpu', 'data processing'] },  // address 101: add 1 to the AC, a data processing instruction
            102: { t: 'Store AC to address 200', k: ['mem', 'processor–memory'] },  // address 102: store the AC back to address 200, a processor-memory instruction
            103: { t: 'Send AC to the display', k: ['io', 'processor–I/O'] },  // address 103: send the AC to the display, a processor-I/O instruction
            104: { t: 'Jump to 100', k: ['os', 'control'] },  // address 104: jump back to 100, a control instruction that makes the program loop
          };  // closes the PROG table
          let st;  // st holds the whole machine state for this step; reset() fills it
          const reset = () => { st = { pc: 100, ir: null, irAt: null, ac: 0, m200: 0, disp: '–', next: 'fetch', trail: [[100, '']], cycles: 0, chg: [] }; };  // reset(): PC at 100, empty IR, AC and the counter at 0, blank display, next action "fetch", the PC trail restarted
          reset();  // sets up the starting state when the step opens
          const narr = h('div', { class: 'small', style: { minHeight: '64px' } });  // the "What just happened" text box; its minimum height keeps the layout steady
          const trail = h('div', { class: 'row gap-s', style: { minHeight: '30px' } });  // the trail of PC values shown under the explanation
          const regPC = h('div', { class: 'val' }), regIR = h('div', { class: 'val', style: { fontSize: '14.5px' } }), regAC = h('div', { class: 'val' });  // the value boxes for the three registers; the IR box uses smaller text because it holds a whole sentence
          const disp = h('div', { class: 'big mono center', style: { color: 'var(--io)' } });  // the display device's screen, showing the last number sent to it in large monospace digits
          const rows = {};  // rows remembers each memory row's parts by address, so paint() can update them
          const tbody = h('tbody');  // the table body that will hold the memory rows
          const addrs = [100, 101, 102, 103, 104, 200];  // the addresses shown in the memory table: the five instructions and the data cell at 200
          const NW = ctx.narrow;  // NW is true on a phone-width screen, where the table drops two columns to fit
          addrs.forEach((a) => {  // builds one table row per address
            const ptr = h('span', { class: 'chip cpu', style: { visibility: 'hidden' } }, NW ? '←PC' : '← PC');  // the "← PC" marker chip, hidden until the PC points at this row
            const cell = h('td', { class: 'mono' });  // the table cell that shows what is stored at this address
            const r = NW  // on a small screen the row has two cells: the address with its PC marker, then the contents
              ? h('tr', {}, h('td', { class: 'mono b', style: { whiteSpace: 'nowrap' } }, String(a), ' ', ptr), cell)  // small-screen row: address and marker share the first cell
              : h('tr', {}, h('td', { class: 'mono b' }, String(a)), cell,  // full-width row: address, contents, a category chip, and the PC marker in its own column
                h('td', {}, a === 200 ? h('span', { class: 'chip' }, 'data (a counter)') : h('span', { class: 'chip ' + PROG[a].k[0] }, PROG[a].k[1])), h('td', { style: { width: '74px' } }, ptr));  // the category chip is "data (a counter)" for address 200, otherwise the instruction's category from PROG
            rows[a] = { r, cell, ptr };  // saves the row's parts under its address for later updates
            tbody.append(r);  // adds the row to the table body
          });  // ends the loop that builds the rows
          function paint(msg) {  // paint(msg): copies the state onto the screen; runs after every button press, with an optional explanation
            regPC.textContent = st.pc; regIR.textContent = st.ir ? st.ir.t : '(empty)'; regAC.textContent = st.ac;  // writes the PC, the instruction text in the IR (or "(empty)"), and the AC into their boxes
            regPC.classList.toggle('chg', st.chg.includes('pc')); regIR.classList.toggle('chg', st.chg.includes('ir')); regAC.classList.toggle('chg', st.chg.includes('ac'));  // highlights each register box that changed in the last action
            disp.textContent = st.disp;  // shows the last value sent to the display
            addrs.forEach((a) => {  // updates every memory row
              const R = rows[a];  // R is this address's saved row parts
              R.cell.textContent = a === 200 ? String(st.m200) : PROG[a].t;  // address 200 shows the counter value; every other row shows its instruction text
              R.r.classList.toggle('on', a === st.irAt && st.next === 'execute');  // highlights the instruction row that sits in the IR waiting to be executed
              R.ptr.style.visibility = a === st.pc ? 'visible' : 'hidden';  // shows the "← PC" marker only on the row whose address the PC holds
            });  // ends the row update loop
            trail.replaceChildren(h('span', { class: 'xs muted b' }, 'PC so far:'), ...st.trail.slice(-9).map(([v, how], i, arr) => h('span', { class: 'chip mono ' + (how === 'jump' ? 'warn' : i === arr.length - 1 ? 'cpu' : '') }, (how === 'jump' ? '↩ ' : '') + v)));  // rebuilds the PC trail from its last 9 values; a jump shows in the warning colour with a return arrow
            if (msg != null) narr.innerHTML = msg;  // replaces the explanation text when a message was given
            fetchBtn.classList.toggle('primary', st.next === 'fetch'); execBtn.classList.toggle('primary', st.next === 'execute');  // makes the button for the correct next action the primary (filled) button, a hint about what comes next
            cyc.textContent = 'Cycles completed: ' + st.cycles;  // updates the chip that counts completed instruction cycles
          }  // ends paint()
          function fetch() {  // fetch(): runs when the student presses Fetch
            if (st.next !== 'fetch') { st.chg = []; paint('<b style="color:var(--warn)">Not yet.</b> The IR already holds an instruction that has not run. Fetching now would overwrite it and that instruction would be skipped. Execute first.'); return; }  // a second fetch before executing is refused with a warning, because it would overwrite the unexecuted instruction
            const from = st.pc;  // from remembers the address being fetched
            st.ir = PROG[from]; st.irAt = from; st.pc = from + 1; st.next = 'execute'; st.chg = ['ir', 'pc']; st.trail.push([st.pc, 'inc']);  // copies the instruction into the IR, adds 1 to the PC, marks execute as next, and adds the new PC to the trail
            paint(`<b>Fetch.</b> The PC held <b>${from}</b>, so the processor read the instruction stored at ${from} into the IR, then added 1 to the PC. The PC now says <b>${st.pc}</b>: the <i>next</i> instruction, not this one.`);  // explains the fetch, stressing that the PC now points at the next instruction, not this one
          }  // ends fetch()
          function execute() {  // execute(): runs when the student presses Execute
            if (st.next !== 'execute') { st.chg = []; paint('<b style="color:var(--warn)">Nothing to execute.</b> Every cycle starts with a fetch: the IR must first be filled with the instruction the PC points at.'); return; }  // pressing Execute with nothing fetched is refused with a reminder that every cycle starts with a fetch
            const a = st.irAt; let msg;  // a is the address of the instruction in the IR; msg will hold the explanation
            if (a === 100) { st.ac = st.m200; st.chg = ['ac']; msg = `Copied the number at address 200 (${st.m200}) into the AC. Data moved <b>memory → processor</b>.`; }  // address 100 (load): copies the counter at 200 into the AC, a memory to processor move
            if (a === 101) { st.ac += 1; st.chg = ['ac']; msg = `The processor added 1 to the AC, which now holds ${st.ac}. Pure arithmetic: <b>data processing</b>.`; }  // address 101 (add 1): increases the AC by one, pure data processing
            if (a === 102) { st.m200 = st.ac; st.chg = []; msg = `Copied the AC (${st.ac}) back into memory at address 200. Data moved <b>processor → memory</b>.`; }  // address 102 (store): copies the AC back into address 200, a processor to memory move
            if (a === 103) { st.disp = String(st.ac); st.chg = []; msg = `Sent the AC (${st.ac}) out to the display, an I/O device. That is <b>processor–I/O</b> traffic.`; }  // address 103 (output): sends the AC to the display, processor-I/O traffic
            if (a === 104) { st.pc = 100; st.chg = ['pc']; st.trail.push([100, 'jump']); msg = 'A <span class="t">jump</span> is a <b>control</b> instruction: it overwrote the PC with 100 instead of letting it count on to 105. The next fetch returns to the top, so the program loops forever.'; }  // address 104 (jump): overwrites the PC with 100 and marks the trail, so the next fetch returns to the top
            st.next = 'fetch'; st.cycles++;  // every execute sets fetch as the next action and counts one finished cycle
            paint(`<b>Execute.</b> ${msg}`);  // shows the explanation on screen
          }  // ends execute()
          const fetchBtn = h('button', { class: 'btn', onclick: fetch }, 'Fetch');  // the Fetch button
          const execBtn = h('button', { class: 'btn', onclick: execute }, 'Execute');  // the Execute button
          const cyc = h('span', { class: 'chip mono' });  // the chip that shows how many cycles are complete
          const reg = (nm, v, tip) => h('div', { class: 'reg', title: tip }, h('span', { class: 'nm' }, nm), v);  // reg(nm, v, tip): builds one labelled register row; tip is the full name shown on hover
          el.append(h('div', { class: 'split l fill' },  // builds the page: text on the left, the machine on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: explanation, tip, narration and PC trail
              h('p', { class: 'lead m0', html: 'Two <span class="t">registers</span> (the processor’s tiny storage slots, met in 1.1) drive the fetch; a third holds data.' }),  // intro sentence: two registers drive the fetch and a third holds data
              h('ul', { class: 'm0 small', style: { paddingLeft: '20px' }, html: '<li>The <span class="t" data-t="Program counter (PC)">PC</span> holds the <i>address</i> of the next instruction.</li><li>The <span class="t" data-t="Instruction register (IR)">IR</span> holds the instruction just fetched, while it is decoded and carried out.</li><li>The <span class="t" data-t="Accumulator (AC)">AC</span> holds the number being worked on.</li>' }),  // bullet list defining the PC, IR and AC; data-t links each short name to its glossary entry
              h('p', { class: 'm0 small', html: 'Each fetch copies the word at the PC’s address into the IR, then adds 1 to the PC (1, because here each instruction fills exactly one memory word). So, unless an instruction says otherwise, a program runs in address order: 100, 101, 102…' }),  // paragraph: why the PC goes up by exactly 1 and why programs run in address order
              h('div', { class: 'callout tip m0 small', 'data-label': 'Try this' }, 'Alternate Fetch and Execute for a full lap. Which instruction breaks the PC’s count-up-by-one habit, and how?'),  // "Try this" box: asks which instruction breaks the count-up-by-one habit
              h('div', { class: 'card tight', style: { borderLeft: '4px solid var(--chc)' } }, h('h4', {}, 'What just happened'), narr),  // the "What just happened" card that holds the narration box
              trail),  // the PC trail sits at the bottom of the left column
            h('div', { class: 'card white stack', style: { gap: '12px', justifyContent: 'center' } },  // right column: a white card with the processor, the display, the memory table and the buttons
              h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,3fr) minmax(0,2fr)', gap: '12px' } },  // a two-column grid: processor on the left (wider), display on the right
                h('div', { class: 'card cpu tight stack', style: { gap: '6px' } }, h('h4', { class: 'm0', style: { color: 'var(--cpu)' } }, 'Processor'),  // the processor card with its heading
                  reg('PC', regPC, 'Program counter'), reg('IR', regIR, 'Instruction register'), reg('AC', regAC, 'Accumulator')),  // the PC, IR and AC register rows inside the processor card
                h('div', { class: 'card io tight stack', style: { gap: '4px', justifyContent: 'center' } }, h('h4', { class: 'm0', style: { color: 'var(--io)' } }, 'Display (I/O)'), disp)),  // the display card, representing an I/O device, with its heading and screen
              h('div', { class: 'card mem tight', style: { padding: '8px' } },  // the memory card that holds the table
                h('table', { class: 'tbl' + (NW ? ' compact' : '') }, h('thead', {}, h('tr', {}, h('th', {}, 'Address'), h('th', {}, 'Memory contents'), NW ? null : h('th', {}, 'Kind'), NW ? null : h('th', {}, ''))), tbody)),  // the memory table; on a small screen it uses the compact style and omits the Kind and marker columns
              h('div', { class: 'row' }, fetchBtn, execBtn, h('button', { class: 'btn ghost', onclick: () => { reset(); paint('Reset. The PC holds 100, the address of the first instruction.'); } }, 'Reset'), h('span', { class: 'grow' }), cyc))));  // button row: Fetch, Execute, and Reset (which restores the starting state), then the cycle counter on the right
          paint('The PC holds <b>100</b>. Press <b>Fetch</b>, then <b>Execute</b>, and keep alternating. Watch the PC and the trail below. What happens when the instruction at 104 runs?');  // first paint when the step opens, with instructions for what to do
        },  // ends render() for step 2
      },  // ends step 2

      /* ---------------- 3. The four categories of instruction ---------------- */
      {  // step 3 object starts here: sorting instructions into the four categories
        title: 'What can one instruction do? Four kinds',  // step 3 title
        kind: 'lab',  // kind "lab": a hands-on activity, here a sorting game
        render(el, ctx) {  // render(el, ctx): builds step 3 each time it is opened
          const { h } = ctx;  // takes the HTML element builder h from ctx
          const CATS = [  // CATS: the four categories, each as [colour name, title, description, example instructions]
            ['mem', 'Processor–memory', 'Copy a word between the processor and main memory, in either direction.', 'load AC from 940 · store AC to 941'],  // category 0, processor-memory: copying words between the processor and main memory
            ['io', 'Processor–I/O', 'Copy data between the processor and an I/O module (keyboard, disk, network card…).', 'read a key code · send a byte to a printer'],  // category 1, processor-I/O: copying data between the processor and an I/O module
            ['cpu', 'Data processing', 'Do arithmetic or logic on data: add, subtract, AND, OR, shift, compare.', 'AC ← AC + 1 · AC ← NOT AC'],  // category 2, data processing: arithmetic and logic on data
            ['os', 'Control', 'Change the order of execution by loading a new address into the PC. Loops and if-statements need this.', 'jump to 100 · skip if AC = 0'],  // category 3, control: changing the order of execution by loading a new address into the PC
          ];  // closes the CATS list
          const ITEMS = [  // ITEMS: the nine instructions to sort, each as [text, list of correct category numbers, explanation]
            ['Copy the word at address 940 into the AC.', [0], 'Data travels from memory into a processor register.'],  // item 1: a load from address 940, which is processor-memory
            ['Send the character held in the AC to the printer’s I/O module.', [1], 'The other end of the transfer is an I/O module, not memory.'],  // item 2: sending a character to the printer's module, which is processor-I/O
            ['Subtract register R2 from register R1.', [2], 'Pure arithmetic on values already inside the processor.'],  // item 3: subtracting one register from another, which is data processing
            ['Continue at address 500 instead of the next address.', [3], 'It puts 500 into the PC, changing which instruction comes next.'],  // item 4: continuing at address 500, which is control
            ['Write the AC into memory location 941.', [0], 'Data travels from a register out to memory: still processor–memory.'],  // item 5: writing the AC into memory, still processor-memory even though data flows outward
            ['Read the keyboard module’s status into the AC.', [1], 'The processor is talking to an I/O module to learn whether a key is waiting.'],  // item 6: reading the keyboard module's status, which is processor-I/O
            ['Flip every bit of the AC (logical NOT).', [2], 'A logic operation on data is data processing.'],  // item 7: flipping every bit of the AC, a logic operation and so data processing
            ['If the AC is zero, skip the next instruction.', [3], 'Skipping pushes the PC past an instruction: a decision about what runs next.'],  // item 8: skipping the next instruction when the AC is zero, which is control
            ['Add the word at address 941 to the AC.', [0, 2], 'It does both: it reads a word from memory <i>and</i> adds it. Real instructions often combine categories.'],  // item 9: an add from memory, which counts as two categories at once (memory and data processing)
          ];  // closes the ITEMS list
          let i = 0, score = 0, answered = false;  // i = the current item, score = correct first answers, answered = whether this item has been answered yet
          const res = [];  // res records right (true) or wrong (false) for each item, for the answer track
          const track = h('div', { class: 'row gap-s' });  // the row of numbered chips that shows how each item went
          const paintTrack = () => track.replaceChildren(h('span', { class: 'xs muted b' }, 'Your answers:'), ...ITEMS.map((_, k) => h('span', { class: 'chip ' + (res[k] === true ? 'ok' : res[k] === false ? 'bad' : ''), style: { minWidth: '30px', justifyContent: 'center', outline: k === i ? '2px solid var(--chc)' : 'none' } }, res[k] === true ? '✓' : res[k] === false ? '✗' : String(k + 1))));  // paintTrack(): redraws the chips as a tick, a cross or the item number, outlining the current item
          const qText = h('div', { style: { fontSize: '20px', fontWeight: 700, lineHeight: 1.35, minHeight: '56px' } });  // the instruction being sorted, shown in large bold text
          const prog = h('span', { class: 'chip mono' });  // the chip that shows "Instruction n of 9" and the score
          const fb = h('div', { class: 'card tight small', style: { minHeight: '84px' } });  // the feedback card that explains the right answer; its minimum height keeps the layout still
          const nextBtn = h('button', { class: 'btn primary', onclick: () => { if (i < ITEMS.length - 1) { i++; paint(); } else { i = 0; score = 0; res.length = 0; paint(); } } });  // Next button: moves to the next item, or after the last one resets everything to play again
          const btns = CATS.map((c, k) => h('button', { class: 'btn ' + c[0], style: { justifyContent: 'flex-start', minHeight: '50px', fontSize: '17px' }, onclick: () => answer(k) }, c[1]));  // one button per category, coloured to match its card; clicking it answers with that category
          function paint() {  // paint(): shows the current item with every button enabled and the feedback reset; runs for each new item
            answered = false;  // a new item has not been answered yet
            qText.textContent = '“' + ITEMS[i][0] + '”';  // puts the instruction text on screen inside quotation marks
            btns.forEach((b) => { b.disabled = false; b.classList.remove('on'); });  // re-enables every category button and clears the previous item's highlighting
            fb.innerHTML = '<span class="muted">Which kind of instruction is this? Pick a category.</span>';  // prompt text in the feedback card before an answer is picked
            nextBtn.style.visibility = 'hidden';  // hides the Next button until the student answers
            prog.textContent = `Instruction ${i + 1} of ${ITEMS.length} · score ${score}`;  // updates the progress chip
            paintTrack();  // redraws the answer track
          }  // ends paint()
          function answer(k) {  // answer(k): runs when the student clicks category button k
            if (answered) return;  // ignores extra clicks after the first answer to this item
            answered = true;  // records that this item is answered
            const [, good, why] = ITEMS[i];  // pulls the correct categories and the explanation out of the current item
            const ok = good.includes(k);  // the answer is right if k is one of the correct categories
            if (ok) score++;  // only a correct answer adds to the score
            res[i] = ok; paintTrack();  // records the result and redraws the track
            btns.forEach((b, j) => { b.disabled = true; if (good.includes(j)) b.classList.add('on'); });  // locks every button and highlights the correct one or two
            const names = good.map((g) => CATS[g][1]).join(' + ');  // names of the correct categories, joined with " + " for the two-category item
            fb.innerHTML = (ok ? '<b style="color:var(--ok)">✓ Correct.</b> ' : `<b style="color:var(--bad)">✗ Not quite.</b> It is <b>${names}</b>. `) + why;  // feedback: a green tick or a red cross naming the right answer, followed by the explanation
            prog.textContent = `Instruction ${i + 1} of ${ITEMS.length} · score ${score}`;  // updates the progress chip with the new score
            nextBtn.textContent = i < ITEMS.length - 1 ? 'Next instruction →' : `Done: ${score}/${ITEMS.length}. Play again`;  // the Next button offers the next item, or shows the final score and offers another round
            nextBtn.style.visibility = 'visible';  // shows the Next button now that the item is answered
          }  // ends answer()
          el.append(h('div', { class: 'split fill' },  // builds the page: two equal columns
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the four categories explained
              h('p', { class: 'lead m0', html: 'Every <span class="t">instruction</span> spells out one action. Almost any action falls into one of four categories:' }),  // intro sentence: almost every action falls into one of four categories
              h('div', { class: 'grid-2', style: { gap: '10px' } }, CATS.map((c) => h('div', { class: 'card tight ' + c[0] }, h('div', { class: 'b', style: { color: `var(--${c[0]})` } }, c[1]), h('div', { class: 'small' }, c[2]), h('div', { class: 'xs mono', style: { marginTop: '4px', color: `var(--${c[0]})` } }, 'e.g. ' + c[3])))),  // a 2 by 2 grid of cards, one per category, with its title, description and an example
              h('div', { class: 'callout warn m0', 'data-label': 'Not always just one' }, 'A single instruction may mix categories. “Add the word at 941 to the AC” first reads memory (processor–memory) and then adds (data processing).')),  // warning box: one instruction can mix categories, using the add-from-memory example
            h('div', { class: 'card white stack', style: { gap: '14px', justifyContent: 'center' } },  // right column: the sorting game card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Sort it'), prog),  // header row: the "Sort it" heading and the progress chip
              qText,  // the instruction being sorted
              h('div', { class: 'grid-2', style: { gap: '10px' } }, btns),  // the four category buttons in a 2 by 2 grid
              fb,  // the feedback card
              h('div', { class: 'row', style: { minHeight: '36px' } }, nextBtn),  // the row holding the Next button; its minimum height keeps things still while the button is hidden
              track)));  // the answer track at the bottom
          paint();  // shows the first item when the step opens
        },  // ends render() for step 3
      },  // ends step 3

      /* ---------------- 4. The hypothetical 16-bit machine + decoder ---------------- */
      {  // step 4 object starts here: the 16-bit word and how it is read as an instruction or a number
        title: 'Meet a tiny 16-bit machine',  // step 4 title
        kind: 'explore',  // kind "explore": the student flips bits and types words to see what they mean
        render(el, ctx) {  // render(el, ctx): builds step 4 each time it is opened
          const { h } = ctx;  // takes the HTML element builder h from ctx
          let word = 0x1940, mode = 'instr';  // word = the 16-bit word being shown (starts at 1940, "load AC from 940"); mode = read it as an instruction or as data
          const inp = h('input', { type: 'text', maxlength: 4, spellcheck: 'false', 'aria-label': 'Word in hexadecimal', class: 'mono', style: { width: '92px', height: '38px', fontSize: '20px', fontWeight: 800, textAlign: 'center', borderRadius: '10px', border: '2px solid var(--line-2)', background: 'var(--panel)', color: 'var(--ink)', textTransform: 'uppercase' } });  // the text box where a word can be typed in hex, up to 4 characters, shown in uppercase
          const labels = h('div', { class: 'bits lab' });  // the row of labels above the bits (opcode and address, or sign and magnitude)
          const bitsRow = h('div', { class: 'bits' });  // the row of 16 bit buttons
          const hexRow = h('div', { class: 'bits hx' });  // the row of hex digits below the bits
          const bitBtns = [];  // bitBtns keeps the 16 bit buttons in order from bit 15 (leftmost) to bit 0
          for (let b = 15; b >= 0; b--) {  // makes one button per bit, starting with bit 15 so the most significant bit is on the left
            const btn = h('button', { type: 'button', class: 'bit', title: 'bit ' + b + ' (click to flip)', onclick: () => { word ^= (1 << b); paint(true); } });  // a bit button: clicking it flips that bit with XOR (^=) and repaints, updating the hex box too
            bitBtns.push(btn); bitsRow.append(btn);  // saves the button and adds it to the row
          }  // ends the bit-button loop
          const rdI = h('div', { class: 'card tight small' }), rdD = h('div', { class: 'card tight small' });  // two explanation cards: rdI reads the word as an instruction, rdD reads it as a number
          const seg = ctx.ui.seg([{ value: 'instr', label: 'as an instruction' }, { value: 'data', label: 'as a number' }], mode, (v) => { mode = v; paint(false); });  // a two-option switch (ctx.ui.seg) to choose instruction or number; changing it repaints without touching the hex box
          function paint(syncInput) {  // paint(syncInput): redraws the bits, labels and explanations; syncInput also rewrites the hex box
            if (syncInput) inp.value = hex(word);  // rewrites the hex box when the change came from a bit click rather than from typing
            inp.style.borderColor = 'var(--line-2)';  // resets the hex box border in case it was showing an error
            const isI = mode === 'instr';  // isI is true when the word is being read as an instruction
            bitBtns.forEach((btn, k) => {  // updates each bit button
              const bitNo = 15 - k;  // k counts buttons from the left, so the bit number is 15 - k
              btn.textContent = (word >> bitNo) & 1;  // shows the bit's value, 0 or 1, found by shifting the word right and keeping the lowest bit
              btn.className = 'bit ' + (isI ? (k < 4 ? 'op' : 'ad') : (k < 1 ? 'sg' : 'mg')) + (k % 4 === 3 && k < 15 ? ' nib' : '');  // colours the bit (opcode or address when read as an instruction, sign or magnitude as a number) and adds a gap every 4 bits
            });  // ends the bit update loop
            labels.replaceChildren(...(isI  // rebuilds the label row to match the reading
              ? [h('span', { style: { gridColumn: 'span 4', color: 'var(--accent)' } }, ctx.narrow ? 'opcode' : 'opcode · 4 bits'), h('span', { style: { gridColumn: 'span 12', color: 'var(--mem)' } }, 'address · 12 bits')]  // instruction reading: "opcode" spans 4 columns in the accent colour and "address" spans 12 in the memory colour
              : [h('span', { style: { gridColumn: 'span 1', color: 'var(--warn)' } }, ctx.narrow ? '±' : 'sign'), h('span', { style: { gridColumn: 'span 15', color: 'var(--cpu)' } }, 'magnitude · 15 bits')]));  // number reading: a 1-column "sign" label (just "±" on a small screen) and a 15-column "magnitude" label
            hexRow.replaceChildren(...[3, 2, 1, 0].map((n) => h('span', { style: { gridColumn: 'span 4' } }, (ctx.narrow ? '' : 'hex ') + hex((word >> (n * 4)) & 0xF, 1))));  // rebuilds the hex row: one hex digit under each group of 4 bits, taken from the word 4 bits at a time
            const op = opOf(word), ad = addrOf(word), O = OPS[op];  // splits the word into its opcode and address and looks the opcode up in OPS (O is undefined if unknown)
            rdI.style.opacity = isI ? 1 : 0.55; rdD.style.opacity = isI ? 0.55 : 1;  // dims whichever explanation card does not match the chosen reading, but keeps both visible for comparison
            rdI.innerHTML = `<h4 class="m0">Read as an instruction</h4>${/* fills the instruction card, starting with its heading */''}
              <div>Opcode <b class="mono">${bin(op, 4)}</b> = ${op} → ${O ? '<b>' + O.verb + '</b>' : '<span style="color:var(--warn)">not one of our three opcodes</span>'}</div>${/* instruction card line: the 4 opcode bits, their value, and the operation name (or a warning if it is not 1, 2 or 5) */''}
              <div>Address <b class="mono">${hex(ad, 3)}</b> hex = ${ad.toLocaleString('en-US')} decimal</div>${/* instruction card line: the 12-bit address in hex and in decimal */''}
              <div class="mt" style="margin-top:6px">${O ? 'Meaning: <b class="mono">' + O.short(ad) + '</b>' : 'The machine has room for 16 opcodes; this example only defines 1, 2 and 5.'}</div>`;  // instruction card line: the meaning in short form, or a note that only three of the 16 opcodes are defined here
            rdD.innerHTML = `<h4 class="m0">Read as a number</h4>${/* fills the number card, starting with its heading */''}
              <div>Sign bit <b class="mono">${(word >> 15) & 1}</b> → ${(word & 0x8000) ? 'negative' : 'positive'}</div>${/* number card line: the sign bit and whether it makes the value negative or positive */''}
              <div>Magnitude (15 bits) = ${(word & 0x7FFF).toLocaleString('en-US')}</div>${/* number card line: the size of the number from the 15 magnitude bits, in decimal */''}
              <div style="margin-top:6px">Value: <b class="mono">${signed(word)}</b>${(word & 0x7FFF) === 0 && (word & 0x8000) ? ' (a “negative zero”)' : ''}</div>`;  // number card line: the signed value, noting the odd "negative zero" that sign-magnitude allows
          }  // ends paint()
          inp.addEventListener('input', () => { const v = parseHex(inp.value); if (v == null) { inp.style.borderColor = 'var(--bad)'; return; } word = v; paint(false); });  // typing in the hex box: a valid word repaints at once; invalid text turns the border red and changes nothing
          const presets = [['1940', 0x1940], ['5941', 0x5941], ['2941', 0x2941], ['0003', 0x0003], ['8005', 0x8005]].map(([t, v]) => h('button', { class: 'btn sm mono', onclick: () => { word = v; paint(true); } }, t));  // preset buttons that load the three program words and two data words (0003 and 8005, which is −5) with one click
          el.append(h('div', { class: 'split l fill' },  // builds the page: a two-column layout with the machine description on the left
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column: how the made-up machine is organised
              h('p', { class: 'lead m0', html: 'To watch the cycle in full detail we use a made-up machine, small enough to hold in your head.' }),  // intro sentence: why the guide uses a small made-up machine
              h('ul', { class: 'm0 small', style: { paddingLeft: '20px' }, html: `${/* bullet list describing the machine, written as HTML */''}
                <li>Memory is a row of numbered cells, each holding a 16-bit <span class="t">word</span>.</li>${/* bullet: memory is numbered cells of 16-bit words */''}
                <li>An instruction word = a 4-bit <span class="t">opcode</span> + a 12-bit <span class="t">address field</span>.</li>${/* bullet: an instruction word is a 4-bit opcode plus a 12-bit address field */''}
                <li>A data word = 1 sign bit + a 15-bit magnitude (<span class="t">sign-magnitude</span>).</li>${/* bullet: a data word is a sign bit plus a 15-bit magnitude */''}
                <li>Registers: <b>PC</b>, <b>IR</b> and one <span class="t">accumulator (AC)</span> for the data being worked on.</li>` }),  // bullet: the three registers, PC, IR and AC; the backtick ends the list
              h('table', { class: 'tbl compact', html: '<thead><tr><th>Opcode</th><th>Hex</th><th>What it does</th></tr></thead><tbody><tr><td class="mono">0001</td><td class="mono">1</td><td>Load AC from memory</td></tr><tr><td class="mono">0010</td><td class="mono">2</td><td>Store AC to memory</td></tr><tr><td class="mono">0101</td><td class="mono">5</td><td>Add to AC from memory</td></tr></tbody>' }),  // small table of the three opcodes in binary and hex with what each does
              h('div', { class: 'callout why m0 small', 'data-label': 'Why 16 and 4096?' }, h('span', { html: '4 opcode bits make 2<sup>4</sup> = <b>16</b> patterns, so up to 16 operations. 12 address bits make 2<sup>12</sup> = <b>4,096</b> patterns, so an instruction can name any of 4,096 (4K) words directly.' })),  // "why" box: 4 bits give 16 opcodes and 12 bits give 4,096 addresses
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Every number in this example is <span class="t">hex</span> (base 16). Address 940 means 9×256 + 4×16 = 2,368 in decimal, not nine hundred forty.' })),  // "common mistake" box: every number here is hex, so 940 is 2,368 in decimal
            h('div', { class: 'card white stack', style: { gap: '10px', justifyContent: 'center' } },  // right column: the interactive word decoder card
              h('div', { class: 'row' }, h('span', { class: 'b' }, 'Word (hex):'), inp, h('span', { class: 'xs muted' }, 'try'), ...presets),  // row with the hex text box and the preset buttons
              h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Read the 16 bits'), seg, h('span', { class: 'xs muted' }, 'Click any bit to flip it.')),  // row with the instruction/number switch and a hint to click bits
              h('div', { class: 'stack', style: { gap: '4px' } }, labels, bitsRow, hexRow),  // the three bit rows stacked: labels, bit buttons, hex digits
              h('div', { class: 'grid-2', style: { gap: '10px' } }, rdI, rdD),  // the two explanation cards side by side
              h('div', { class: 'callout tip m0 small', 'data-label': 'Same bits, two meanings', html: 'Memory cannot tell instructions from numbers. A word acts as an instruction when the PC fetches it, and as data when an instruction’s address field points at it. Hex helps because each hex digit is exactly four bits: the first digit is the opcode, the last three the address.' }))));  // tip box: memory cannot tell instructions from numbers; how a word is used decides what it means
          paint(true);  // first paint when the step opens, filling the hex box with 1940
        },  // ends render() for step 4
      },  // ends step 4

      /* ---------------- 5. The full register-level simulator ---------------- */
      {  // step 5 object starts here: the full register-level simulator of the three-instruction program
        title: 'Watch the machine add 3 + 2, register by register',  // step 5 title
        kind: 'explore',  // kind "explore": the student steps through the animation at their own pace
        core: true,  // core: true keeps this key step on the core path
        render(el, ctx) {  // render(el, ctx): builds step 5 each time it is opened
          const { h, s } = ctx;  // takes both builders from ctx: h for HTML, s for SVG
          const NW = ctx.narrow;  // NW is true on a phone-width screen, which switches to the tall one-column drawing
          let fmt = 'hex', detail = 'micro';  // fmt = show values in hex or binary; detail = small micro-steps or the six big steps
          // geometry: a wide side-by-side layout, and a tall single-column one for phones
          const L = NW ? {  // L holds every position in the drawing; this first set is the tall layout for phone-width screens
            vb: '0 0 380 912', trk: (i) => [6 + (i % 3) * 125, 2 + Math.floor(i / 3) * 34, 118, 28],  // tall layout: the drawing's size, and trk(i) which places the six stage pills in a 3 by 2 grid
            cpu: [4, 74, 372, 474], mem: [4, 626, 372, 282], title: 98, mtitle: 650,  // tall layout: processor box on top, memory box below it, and the y positions of their titles
            reg: { pc: [16, 124], ir: [16, 188], ac: [16, 252], mar: [16, 316], mbr: [16, 380], alu: [16, 444] }, rw: 348,  // tall layout: where each register box goes, one under another, and how wide they are (rw)
            dec: [16, 518, 538],  // tall layout: where the decode line goes under the registers
            bus: { addr: { x1: 110, y1: 550, x2: 110, y2: 622, tag: [110, 574], lab: [120, 610, 'start'], text: 'address lines' },  // tall layout: the address lines run straight down from the processor to memory, with their label position
                   data: { x1: 270, y1: 550, x2: 270, y2: 622, tag: [270, 574], lab: [280, 610, 'start'], text: 'data lines' } },  // tall layout: the data lines run down beside them
            busT: null, row0: 680, rstep: 34, rh: 30, rx: 12, rw2: 356, ax: 52, cx: 190, px: 330, gx: null, hy: 672,  // tall layout: memory row positions and sizes (row0, rstep, rh) and the x of each memory column
          } : {  // the second set of positions is the wide, side-by-side layout
            vb: '0 0 1152 356', trk: (i) => [13 + i * 190, 2, 176, 30],  // wide layout: the drawing's size, and trk(i) which lines the six stage pills up in one row
            cpu: [8, 44, 544, 308], mem: [720, 44, 424, 308], title: 68, mtitle: 68,  // wide layout: processor box on the left, memory box on the right
            reg: { pc: [24, 92], ir: [24, 178], ac: [24, 264], mar: [296, 92], mbr: [296, 178], alu: [296, 264] }, rw: 240,  // wide layout: registers in two columns of three (PC, IR, AC on the left; MAR, MBR, ALU on the right)
            dec: [24, 340, null],  // wide layout: where the decode line goes
            bus: { addr: { x1: 538, y1: 120, x2: 718, y2: 120, tag: [628, 120], lab: [628, 150, 'middle'], text: 'address lines' },  // wide layout: the address lines run across from the processor to memory
                   data: { x1: 538, y1: 206, x2: 718, y2: 206, tag: [628, 206], lab: [628, 236, 'middle'], text: 'data lines' } },  // wide layout: the data lines run across below them
            busT: [628, 70], row0: 100, rstep: 35, rh: 31, rx: 732, rw2: 400, ax: 776, cx: 900, px: 1028, gx: 1124, hy: 92,  // wide layout: the "system bus" title position and the memory row positions and columns
          };  // closes the two layout choices
          const PROGW = [0x1940, 0x5941, 0x2941];  // PROGW: the three instruction words of the program, used to label memory rows as instructions
          const svg = s('svg', { viewBox: L.vb, width: '100%', role: 'img', 'aria-label': 'Processor registers, system bus and main memory during the example program' });  // the SVG drawing of processor, bus and memory; its viewBox is the layout's coordinate space
          const T = (x, y, str, o = {}) => s('text', Object.assign({ x, y }, o), str);  // T(...): shortcut that makes an SVG text element at (x, y) with any extra attributes
          function wtext(v, bits, x, y, size, instr) {  // wtext(v, bits, ...): draws a register or memory value in hex or binary, splitting an instruction into opcode and address colours
            if (v == null) return T(x, y, '—', { 'text-anchor': 'middle', 'font-size': size, class: 's-sub s-monot' });  // an empty register shows a dash
            const str = fmt === 'hex' ? hex(v, bits / 4) : bin(v, bits);  // the value as text in the chosen format, using as many hex digits as the bit width needs
            const sz = fmt === 'hex' ? size : Math.min(size, bits === 16 ? 15.5 : 16);  // binary text is long, so its font size is capped to fit the box
            if (!instr) return T(x, y, str, { 'text-anchor': 'middle', 'font-size': sz, 'font-weight': 700, class: 's-monot' });  // a data value is drawn as plain bold text
            const cut = fmt === 'hex' ? 1 : 4;  // cut = how many characters make up the opcode: 1 hex digit or 4 binary digits
            return s('text', { x, y, 'text-anchor': 'middle', 'font-size': sz, 'font-weight': 700, class: 's-monot' },  // an instruction is drawn as one text element with two coloured parts
              s('tspan', { style: 'fill:var(--accent)' }, str.slice(0, cut)), s('tspan', { style: 'fill:var(--mem)' }, str.slice(cut)));  // the opcode part in the accent colour, the address part in the memory colour
          }  // ends wtext()
          function reg(F, key, name, full, content) {  // reg(F, key, name, full, content): draws one register box for frame F; content draws the value inside it
            const [x, y] = L.reg[key], chg = F.ch.includes(key);  // looks up the register's position, and whether this frame changed it
            return s('g', {},  // the register is a group of shapes
              s('text', { x, y }, s('tspan', { style: 'fill:var(--cpu)', 'font-weight': 800, 'font-size': 15 }, name), s('tspan', { class: 's-sub', 'font-size': 12.5, dx: 8 }, full)),  // the label above the box: the short name in bold processor colour, then the full name in grey
              s('rect', { x, y: y + 8, width: L.rw, height: 40, rx: 8, class: chg ? 's-hl' : 's-panel', 'stroke-width': chg ? 3 : 2, style: chg ? '' : 'stroke:var(--cpu)' }),  // the value box, highlighted yellow when this frame changed the register
              content(x + L.rw / 2, y + 35));  // draws the value centred in the box
          }  // ends reg()
          function bus(key, on, inward, val, bits) {  // bus(key, on, inward, val, bits): draws the address or data lines, active or idle, with the value they carry
            const b = L.bus[key];  // b holds this bus's position from the layout
            const [ax, ay, bx, by] = inward ? [b.x2, b.y2, b.x1, b.y1] : [b.x1, b.y1, b.x2, b.y2];  // inward means traffic flows toward the processor, so the arrow's start and end are swapped
            const tagW = fmt === 'hex' ? 60 : (bits === 16 ? 164 : 124);  // width of the value tag on the line: wider for binary
            return s('g', {},  // the bus is a group of shapes
              s('line', { x1: ax, y1: ay, x2: bx, y2: by, 'stroke-width': on ? 4 : 2, 'stroke-dasharray': on ? null : '5 6', 'marker-end': on ? 'url(#arr-accent)' : null, style: on ? 'stroke:var(--accent)' : 'stroke:var(--line-2)' }),  // the line: thick with an accent arrowhead when active, thin and dashed when idle
              on && val != null ? s('g', {}, s('rect', { x: b.tag[0] - tagW / 2, y: b.tag[1] - 13, width: tagW, height: 26, rx: 13, class: 's-accent', 'stroke-width': 2 }),  // when active and carrying a value, a rounded tag sits on the line
                T(b.tag[0], b.tag[1] + 5, fmt === 'hex' ? hex(val, bits / 4) : bin(val, bits), { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 's-monot' })) : null,  // the value on the tag, in hex or binary
              T(b.lab[0], b.lab[1], b.text, { 'text-anchor': b.lab[2], 'font-size': 12.5, class: 's-sub' }));  // the bus's name, "address lines" or "data lines"
          }  // ends bus()
          function draw(F) {  // draw(F): rebuilds the whole drawing for frame F; runs every time the student moves to another frame
            const mem = { 0x300: 0x1940, 0x301: 0x5941, 0x302: 0x2941, 0x940: 0x0003, 0x941: F.m941 };  // mem: the five memory cells in play; only cell 941 changes during the run
            const kids = [];  // kids collects every shape before they are added to the drawing in one go
            ['Fetch 1', 'Execute 1', 'Fetch 2', 'Execute 2', 'Fetch 3', 'Execute 3'].forEach((t, i) => {  // draws the six stage pills (Fetch 1 to Execute 3) across the top
              const [x, y, w, hh] = L.trk(i), cur = F.stage === i, done = F.stage > i;  // each pill's position; cur means this stage is running now, done means it is finished
              kids.push(s('rect', { x, y, width: w, height: hh, rx: hh / 2, class: cur ? 's-accent' : done ? 's-ok' : 's-panel', 'stroke-width': cur ? 3 : 1.5 }),  // the pill: accent colour for the current stage, green for finished ones, grey for those still to come
                T(x + w / 2, y + hh / 2 + 5, (done ? '✓ ' : '') + t, { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: `fill:var(--${cur ? 'accent' : done ? 'ok' : 'muted'})` }));  // the pill's label, with a tick in front when finished
            });  // ends the stage pill loop
            const [cx, cy, cw, chh] = L.cpu, [mx, my, mw, mh] = L.mem;  // takes the position and size of the processor box and the memory box from the layout
            kids.push(s('rect', { x: cx, y: cy, width: cw, height: chh, rx: 16, class: 's-cpu', 'stroke-width': 2, style: 'fill-opacity:.55' }),  // the big processor box, a lightly tinted rounded rectangle
              T(cx + 16, L.title, 'PROCESSOR', { 'font-size': 13, 'font-weight': 800, 'letter-spacing': '.08em', style: 'fill:var(--cpu)' }),  // its PROCESSOR title
              s('rect', { x: mx, y: my, width: mw, height: mh, rx: 16, class: 's-mem', 'stroke-width': 2, style: 'fill-opacity:.55' }),  // the big memory box
              T(mx + 16, L.mtitle, 'MAIN MEMORY', { 'font-size': 13, 'font-weight': 800, 'letter-spacing': '.08em', style: 'fill:var(--mem)' }));  // its MAIN MEMORY title
            kids.push(reg(F, 'pc', 'PC', 'program counter', (x, y) => wtext(F.pc, 12, x, y, 20)),  // the PC register box, holding a 12-bit address
              reg(F, 'ir', 'IR', 'instruction register', (x, y) => wtext(F.ir, 16, x, y, 20, true)),  // the IR register box, drawn with the opcode and address in different colours
              reg(F, 'ac', 'AC', 'accumulator', (x, y) => wtext(F.ac, 16, x, y, 20)),  // the AC register box, holding a 16-bit data word
              reg(F, 'mar', 'MAR', 'memory address register', (x, y) => wtext(F.mar, 12, x, y, 20)),  // the MAR register box, holding the 12-bit address being sent to memory
              reg(F, 'mbr', 'MBR', 'memory buffer register', (x, y) => wtext(F.mbr, 16, x, y, 20, PROGW.includes(F.mbr))),  // the MBR register box; its word is coloured as an instruction when it is one of the program's instructions
              reg(F, 'alu', 'ALU', 'arithmetic logic unit', (x, y) => F.ch.includes('alu')  // the ALU box shows the sum only in the frame where the addition happens
                ? T(x, y, fmt === 'hex' ? '0003 + 0002 = 0005' : '11 + 10 = 101', { 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, class: 's-monot' })  // the addition itself, 3 + 2 = 5, written in hex or in binary (11 + 10 = 101)
                : T(x, y, 'idle', { 'text-anchor': 'middle', 'font-size': 15, class: 's-sub' })));  // every other frame the ALU box just says "idle"
            const execLike = F.stage % 2 === 1 || F.stage === 6;  // execLike is true during an execute stage (odd stage numbers) or after the program finishes
            if (F.ir != null && execLike) {  // during execute, a line under the registers shows how the IR was decoded
              const O = OPS[opOf(F.ir)], a = hex(addrOf(F.ir), 3);  // looks up the operation and writes the address field as 3 hex digits
              if (L.dec[2]) kids.push(T(L.dec[0], L.dec[1], `Decoded IR: opcode ${opOf(F.ir)} = ${O.verb[0].toLowerCase() + O.verb.slice(1)}`, { 'font-size': 14, 'font-weight': 700 }), T(L.dec[0], L.dec[2], `address field = ${a}`, { 'font-size': 14, 'font-weight': 700 }));  // tall layout: the decode explanation is split over two lines
              else kids.push(T(L.dec[0], L.dec[1], `Decoded IR:  opcode ${opOf(F.ir)} = ${O.verb[0].toLowerCase() + O.verb.slice(1)}  ·  address field = ${a}`, { 'font-size': 14.5, 'font-weight': 700 }));  // wide layout: the decode explanation fits on one line
            } else kids.push(T(L.dec[0], L.dec[1], F.stage < 0 ? 'Waiting to start.' : 'Fetch stage: bringing in the next instruction.', { 'font-size': 14, class: 's-sub' }));  // outside execute, the line says either "Waiting to start." or that a fetch is in progress
            if (L.busT) kids.push(T(L.busT[0], L.busT[1], 'SYSTEM BUS', { 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, 'letter-spacing': '.08em', class: 's-sub' }));  // wide layout only: the "SYSTEM BUS" heading above the lines between processor and memory
            kids.push(bus('addr', F.bus.includes('addr'), false, F.mar, 12),  // the address lines light up when this frame uses them, carrying the MAR value toward memory
              bus('data', F.bus.includes('read') || F.bus.includes('write'), F.bus.includes('read'), F.mbr, 16));  // the data lines light up on a read (arrow toward the processor) or a write (arrow toward memory), carrying the MBR value
            kids.push(T(L.ax, L.hy, fmt === 'hex' ? 'ADDRESS' : (NW ? 'ADDR (HEX)' : 'ADDRESS (HEX)'), { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 800, class: 's-sub' }), T(L.cx, L.hy, 'CONTENTS', { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 800, class: 's-sub' }));  // column headings over the memory rows: ADDRESS (noted as hex when words are shown in binary) and CONTENTS
            let y = L.row0;  // y is the top of the next memory row to draw
            [0x300, 0x301, 0x302, 0x303, 'gap', 0x940, 0x941].forEach((a) => {  // draws the memory rows: the four program addresses, a gap, then the two data cells
              if (a === 'gap') { kids.push(T(L.cx, y + 16, '⋮  other memory  ⋮', { 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' })); y += 25; return; }  // the gap row: a note that other memory sits between the program and the data
              const hot = F.cell === a, wrote = a === 0x941 && F.ch.includes('m941');  // hot = memory is being accessed at this address now; wrote = this frame just wrote cell 941
              const mid = y + L.rh / 2;  // mid is the vertical centre of the row
              kids.push(s('rect', { x: L.rx, y, width: L.rw2, height: L.rh, rx: 7, class: wrote ? 's-hl' : hot ? 's-accent' : 's-panel', 'stroke-width': hot || wrote ? 3 : 1 }),  // the row background: yellow when just written, accent colour when being accessed
                T(L.ax, mid + 6, hex(a, 3), { 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, class: 's-monot' }),  // the address, in hex
                a === 0x303 ? T(L.cx, mid + 5, '(next instruction)', { 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }) : wtext(mem[a], 16, L.cx, mid + 6, 17, a < 0x303));  // cell 303 is labelled "(next instruction)"; other cells show their word, program words in instruction colours
              if (F.pc === a) kids.push(s('rect', { x: L.px - 27, y: mid - 11, width: 54, height: 22, rx: 11, class: 's-cpu', 'stroke-width': 1.5 }), T(L.px, mid + 5, '← PC', { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--cpu)' }));  // the "← PC" tag appears on the row whose address the PC holds
              // plain-language meaning of each program word (wide layout only; phones have no room beside the PC tag)
              const GLOSS = { 0x300: 'load 940', 0x301: 'add 941', 0x302: 'store 941', 0x940: 'data', 0x941: 'data' };  // GLOSS: a short reminder of what each word means, such as "load 940"
              if (L.gx && GLOSS[a]) kids.push(T(L.gx, mid + 5, GLOSS[a], { 'text-anchor': 'end', 'font-size': 12, 'font-weight': 700, class: 's-sub' }));  // wide layout only: the reminder sits at the right end of the row
              y += L.rstep;  // moves y down to the next row
            });  // ends the memory row loop
            svg.replaceChildren(...kids);  // swaps all the new shapes into the drawing at once
          }  // ends draw()
          const frames = () => (detail === 'micro' ? MICRO : BIG);  // frames() returns the frame list for the chosen detail level: MICRO or BIG
          const player = ctx.ui.player({ count: frames().length, render: (i) => { draw(frames()[i]); return frames()[i].cap; }, interval: 2600 });  // the shell's step player (Play, Pause, Next, Previous); on each frame it redraws and returns the caption to show
          const segD = ctx.ui.seg([{ value: 'micro', label: NW ? 'Micro-steps' : 'Micro-steps (with MAR / MBR)' }, { value: 'big', label: NW ? '6 stages' : '6 stages only' }], detail, (v) => {  // detail switch: micro-steps (showing the MAR and MBR) or just the six stages; shorter labels on a small screen
            // keep the student's place: big step k shows the state of micro frame AT[k]
            const AT = [0, 3, 6, 9, 12, 15, 17], cur = player.index;  // AT maps each big step to its micro frame; cur is the frame being shown now
            const to = v === 'big' ? AT.reduce((best, m, k) => (m <= cur ? k : best), 0) : (AT[cur] || 0);  // switching to big steps finds the last big step at or before this micro frame; switching back jumps to that big step's micro frame
            detail = v; player.setCount(frames().length); player.go(to);  // saves the new detail level, gives the player the new frame count, and jumps to the matching frame
          });  // ends the detail switch
          const segF = ctx.ui.seg([{ value: 'hex', label: 'Hex' }, { value: 'bin', label: 'Binary' }], fmt, (v) => { fmt = v; player.refresh(); });  // format switch: hex or binary; changing it redraws the current frame
          const bar = h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // the bar of controls above the drawing
            h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Detail'), segD),  // the detail switch with its label
            h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Show words in'), segF),  // the format switch with its label
            h('span', { class: 'xs muted', html: '<span class="t">MAR</span> = address going to memory · <span class="t">MBR</span> = word coming from or going to memory' }));  // a one-line key explaining what the MAR and MBR carry
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } }, bar, NW ? player.el : null, svg, NW ? null : player.el));  // builds the page; on a phone-width screen the player sits above the drawing, otherwise below it
        },  // ends render() for step 5
      },  // ends step 5

      /* ---------------- 6. Predict, then check ---------------- */
      {  // step 6 object starts here: predict the machine state at chosen moments, then check
        title: 'Predict, then check: freeze-frame questions',  // step 6 title
        kind: 'predict',  // kind "predict": the student commits to an answer before seeing it
        render(el, ctx) {  // render(el, ctx): builds step 6 each time it is opened
          const { h } = ctx;  // takes the HTML element builder h from ctx
          const QS = [  // QS: six freeze-frame questions, each as [question, choices, index of the right choice, explanation]
            ['Right after the <b>second fetch</b>, what does the PC hold?', ['301', '302', '303', '941'], 1,  // question 1: the PC right after the second fetch (answer 302)
              'The second fetch reads the instruction at 301 and then increments the PC, so it holds 302.'],  // explanation 1: the fetch reads 301 and then increments the PC
            ['During the <b>second execute</b>, what is in the IR?', ['1940', '5941', '2941', '0005'], 1,  // question 2: what the IR holds during the second execute (answer 5941)
              'The IR keeps the instruction fetched from 301 (5941) until the next fetch replaces it.'],  // explanation 2: the IR keeps an instruction until the next fetch replaces it
            ['What is in the AC right after the <b>second execute</b>?', ['0002', '0003', '0005', '5941'], 2,  // question 3: the AC after the second execute (answer 0005)
              'The load put 3 in the AC; the add then added the 2 stored at 941, giving 5.'],  // explanation 3: the load gave 3 and the add added 2
            ['During the <b>first execute</b>, which address does the MAR send to memory?', ['300', '301', '940', '941'], 2,  // question 4: which address the MAR sends during the first execute (answer 940)
              'The address field of 1940 is 940, and loading the AC needs the word stored there.'],  // explanation 4: 940 is the address field of 1940
            ['When the program ends, what is stored in cell <b>941</b>?', ['0002', '0003', '0005', '2941'], 2,  // question 5: what cell 941 holds when the program ends (answer 0005)
              'The store (2941) wrote the AC’s value over the old 0002, so 941 now holds 0005.'],  // explanation 5: the store wrote the AC over the old 0002
            ['How many times does the processor <b>read</b> memory in the whole run?', ['3', '5', '6', '8'], 1,  // question 6: how many memory reads happen in the whole run (answer 5)
              'Three instruction fetches plus two operand reads (940 and 941). The store is a write, not a read.'],  // explanation 6: three instruction fetches plus two operand reads; the store is a write
          ];  // closes the QS list
          const picked = [];  // picked records which choice the student picked for each question
          const score = h('span', { class: 'chip mono' });  // the chip that shows the running score
          const paintScore = () => { const done = picked.filter((x) => x != null).length; const right = picked.filter((x, k) => x === QS[k][2]).length; score.textContent = `${right} right of ${done} answered`; };  // paintScore(): counts answered questions and right answers, and shows them in the chip
          const cards = QS.map(([q, opts, ans, why], k) => {  // builds one card per question
            const fb = h('div', { class: 'small', style: { minHeight: '44px' } }, h('span', { class: 'muted' }, 'Commit to an answer first.'));  // the feedback line under the choices, asking the student to commit first
            const btns = opts.map((o, j) => h('button', { class: 'btn sm mono', style: { minWidth: '62px' }, onclick: () => {  // one button per choice
              if (picked[k] != null) return;  // only the first pick counts; later clicks on this question are ignored
              picked[k] = j;  // records the pick
              btns.forEach((b, jj) => {  // colours the choices once an answer is picked
                if (jj === ans) Object.assign(b.style, { borderColor: 'var(--ok)', background: 'var(--ok-bg)', color: 'var(--ok)' });  // the correct choice turns green
                else if (jj === j) Object.assign(b.style, { borderColor: 'var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)' });  // a wrong pick turns red
                else b.style.opacity = '.5';  // the other choices fade out
              });  // ends the colouring loop
              fb.innerHTML = (j === ans ? '<b style="color:var(--ok)">✓ Yes.</b> ' : `<b style="color:var(--bad)">✗ It is ${opts[ans]}.</b> `) + why;  // feedback: a green "Yes" or a red message naming the right answer, then the explanation
              paintScore();  // updates the score chip
            } }, o));  // ends the choice button's click handler; o is the button's label
            const reset = () => { btns.forEach((b) => { b.style.cssText = 'min-width:62px'; }); fb.innerHTML = '<span class="muted">Commit to an answer first.</span>'; };  // reset(): clears the colours and restores the prompt, so the question can be tried again
            const card = h('div', { class: 'card tight stack', style: { gap: '8px' } }, h('div', { style: { fontWeight: 650, lineHeight: 1.35, minHeight: '46px' }, html: `<span class="chip accent" style="margin-right:6px">Q${k + 1}</span>${q}` }), h('div', { class: 'row gap-s' }, btns), fb);  // the question card: a numbered chip and the question, the choice buttons, then the feedback
            card.reset = reset;  // attaches reset() to the card so the page's reset button can reach it
            return card;  // hands the card back to the list of cards
          });  // ends the card builder
          const prog = [['300', '1940', 'load'], ['301', '5941', 'add'], ['302', '2941', 'store'], ['940', '0003', 'data'], ['941', '0002', 'data']];  // prog: the program and data as [address, word, meaning], shown as a reference table
          const LEAD = 'Freeze the machine at one moment and say what is inside. Work it out from the program below.';  // LEAD: the intro sentence above the questions
          const HINT = '<span class="chip ok" style="margin-right:6px">Hint</span>While an instruction executes, the PC already points one past it (this program has no jumps), and the IR keeps an instruction until the next fetch replaces it.';  // HINT: a reminder that the PC already points past the running instruction and the IR holds it until the next fetch
          const lead = h('p', { class: 'lead m0', html: LEAD });  // the intro paragraph, which the Hint button swaps with the hint text
          const hintBtn = h('button', { class: 'btn sm', onclick: () => { const on = !hintBtn.classList.contains('on'); hintBtn.classList.toggle('on', on); lead.innerHTML = on ? HINT : LEAD; lead.style.fontSize = on ? '16px' : ''; } }, 'Hint');  // Hint button: toggles between the intro and the hint, using slightly smaller text for the longer hint
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // builds the page: one column of rows
            lead,  // the intro or hint paragraph at the top
            h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // a row holding the program reference on the left and the controls on the right
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b' }, 'PROGRAM:'), ...prog.map(([a, w, t]) => h('span', { class: 'chip ' + (t === 'data' ? 'mem' : 'cpu') + ' mono' }, `${a}: ${w}`, h('span', { class: 'xs', style: { fontFamily: 'var(--font)', fontWeight: 600, opacity: 0.8 } }, t))), h('span', { class: 'chip mono' }, 'PC starts at 300')),  // the program as chips (address: word and its meaning), data in the memory colour, plus a chip saying the PC starts at 300
              h('div', { class: 'row gap-s' }, score, hintBtn, h('button', { class: 'btn sm ghost', onclick: () => { picked.length = 0; cards.forEach((c) => c.reset()); paintScore(); } }, 'Start over'))),  // the score chip, the Hint button, and a Start over button that clears every answer
            h('div', { class: 'grid-3 grow', style: { gap: '12px', gridAutoRows: ctx.narrow ? 'auto' : '1fr' } }, cards)));  // the six question cards in a 3-column grid, with equal row heights except on a small screen
          paintScore();  // shows "0 right of 0 answered" when the step opens
        },  // ends render() for step 6
      },  // ends step 6

      /* ---------------- 7. Lab: write and run your own tiny program ---------------- */
      {  // step 7 object starts here: the lab where students write and run their own program
        title: 'Lab: program the machine yourself',  // step 7 title
        kind: 'lab',  // kind "lab": a hands-on activity
        render(el, ctx) {  // render(el, ctx): builds step 7 each time it is opened
          const { h } = ctx;  // takes the HTML element builder h from ctx
          const PA = [0x300, 0x301, 0x302, 0x303, 0x304, 0x305], DA = [0x940, 0x941, 0x942, 0x943];  // PA = the six program addresses (300-305); DA = the four data addresses (940-943)
          const PRESETS = [  // PRESETS: ready-made examples, each as [button label, six program words, four data words, the cell holding the answer]
            ['3 + 2', [0x1940, 0x5941, 0x2941, 0, 0, 0], [3, 2, 0, 0], 0x941],  // preset "3 + 2": the same program as the earlier steps, with the answer stored in 941
            ['Add three numbers', [0x1940, 0x5941, 0x5942, 0x2943, 0, 0], [3, 2, 4, 0], 0x943],  // preset "Add three numbers": load, add, add, then store the total in 943
            ['Double a number', [0x1940, 0x5940, 0x2941, 0, 0, 0], [7, 0, 0, 0], 0x941],  // preset "Double a number": adds cell 940 to itself, so 7 becomes 14 in 941
            ['A negative number', [0x1940, 0x5941, 0x2942, 0, 0, 0], [0x8005, 2, 0, 0], 0x942],  // preset "A negative number": adds −5 (8005 in sign-magnitude) and 2, storing −3 in 942
          ];  // closes the PRESETS list
          // src = the words the student typed (their program + data). The boxes show LIVE memory while the machine runs;
          // Reset (or any edit) reloads memory from src, so a program that rewrote itself gets its original words back.
          const inputs = {}, hints = {}, rows = {}, src = {};  // inputs, hints and rows hold each memory row's parts by address; src holds the words the student typed
          const mk = (a) => {  // mk(a): builds one editable memory row for address a
            const inp = h('input', { type: 'text', maxlength: 4, spellcheck: 'false', class: 'cell-in', 'aria-label': 'Contents of address ' + hex(a, 3) });  // the text box for the word stored at this address, up to 4 hex digits
            inp.addEventListener('input', () => { src[a] = inp.value; resetMachine('Memory edited, so the machine was reset and your program reloaded. Press Step or Run.'); });  // typing in any box saves the text and resets the machine, so the run always starts from the edited program
            inputs[a] = inp; hints[a] = h('span', { class: 'hint' });  // saves the box and makes an empty hint for this address
            rows[a] = h('div', { class: 'mrow' }, h('span', { class: 'mono b' }, hex(a, 3)), inp, hints[a]);  // the row: address, text box, then the hint explaining the word
            return rows[a];  // hands the row back so it can be placed on the page
          };  // ends mk()
          const image = () => { const m = new Map(); [...PA, ...DA].forEach((a) => m.set(a, parseHex(src[a]) ?? 0)); return m; };  // image(): builds the machine's memory from the typed words; a blank or invalid box counts as 0
          const meaning = (a, w) => (DA.includes(a) ? '= ' + (signed(w) || '0') : w === 0 ? 'halt (stop)' : OPS[opOf(w)] ? OPS[opOf(w)].short(addrOf(w)) : 'opcode ' + opOf(w) + ': unknown here');  // meaning(a, w): the hint text; data cells show their signed value, 0 means halt, known opcodes show their short form
          let M;  // M holds the running machine's state; resetMachine() fills it
          const regs = h('div', { class: 'row gap-s' });  // the row of register chips above the memory
          const log = h('div', { class: 'log grow', style: { minHeight: '120px' } });  // the run log, one line per cycle; it grows to fill the spare space
          const verdict = h('div', { class: 'card tight small', style: { minHeight: '58px' } });  // the verdict card that reports the result and checks the prediction
          const sel = h('select', { class: 'mono', style: { font: 'inherit', fontSize: '15px', padding: '4px 6px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--panel)', color: 'var(--ink)' } }, DA.map((a) => h('option', { value: a }, hex(a, 3))));  // a drop-down list to choose which data cell to predict (940 to 943)
          const pred = h('input', { type: 'text', maxlength: 4, class: 'cell-in', placeholder: '????', 'aria-label': 'Your predicted value in hex' });  // the text box for the student's predicted value, in hex
          function resetMachine(msg) {  // resetMachine(msg): puts the PC back at 300, empties the IR and AC, reloads memory from the typed words, and clears the log
            M = { pc: 0x300, ir: null, ac: 0, mem: image(), halted: false, cycles: 0, why: '', wrote: null, selfMod: '', selfModAt: null };  // the fresh machine state; the halted flag, cycle count and self-rewrite notes all start empty
            log.replaceChildren(h('div', { class: 'muted' }, msg || 'Ready. PC = 300.'));  // the log restarts with a message (by default "Ready. PC = 300.")
            Object.values(rows).forEach((r) => r.classList.remove('flash'));   // no leftover glow from before the reset
            paint();  // repaints the page with the fresh state
          }  // ends resetMachine()
          function paint() {  // paint(): copies the machine state onto the page; runs after every cycle and every reset
            regs.replaceChildren(...[['PC', hex(M.pc, 3)], ['IR', M.ir == null ? '––––' : hex(M.ir)], ['AC', hex(M.ac) + ' (' + (signed(M.ac) || '0') + ')']].map(([n, v]) => h('span', { class: 'chip cpu mono' }, n + ' ' + v)), h('span', { class: 'chip mono' }, 'cycles ' + M.cycles));  // the register chips: PC, IR (dashes when empty), AC in hex with its signed value, plus the cycle count
            // every box shows the word in memory NOW, decoded fresh on every paint (so a rewritten instruction shows its new meaning)
            [...PA, ...DA].forEach((a) => {  // updates every memory row
              const orig = parseHex(src[a]), live = M.mem.get(a) ?? 0, changed = live !== (orig ?? 0), inp = inputs[a];  // orig = the typed word, live = what memory holds now, changed = the running program has overwritten this cell
              const shown = changed ? hex(live) : (src[a] ?? '');  // a changed cell shows its new word; an unchanged one keeps the student's text
              if (inp.value !== shown) inp.value = shown;   // unchanged cells keep exactly what the student typed
              inp.classList.toggle('bad', !changed && orig == null);  // an unchanged box with text that is not hex gets the red "bad" style
              inp.classList.toggle('wr', changed);  // a cell the program has written gets the highlight style
              hints[a].replaceChildren(!changed && orig == null ? 'not a hex word' : meaning(a, live),  // the hint: an error for bad text, otherwise the meaning of the live word
                ...(changed ? [h('br'), h('span', { class: 'was' }, 'changed · was ' + (orig == null ? '????' : hex(orig)))] : []));  // for a changed cell, a second line in the hint shows the old value
              rows[a].classList.toggle('pc', PA.includes(a) && !M.halted && M.pc === a);  // the row the PC points at is tinted, as long as the machine has not halted
              rows[a].classList.toggle('just', M.wrote === a);  // the row written by the latest cycle gets the extra outline
            });  // ends the row update loop
            if (!M.halted) verdict.innerHTML = M.selfMod || '<span class="muted">Type your prediction, then press <b>Run to the end</b> (or step one cycle at a time).</span>';  // while running, the verdict shows the self-rewrite warning if there is one, or instructions to predict and run
            else {  // once halted, the verdict reports the result
              const cell = +sel.value, v = M.mem.get(cell) ?? 0, p = parseHex(pred.value);  // reads the chosen cell, its value, and the student's prediction
              verdict.innerHTML = `<b>${M.why}</b> Cell ${hex(cell, 3)} holds <b class="mono">${hex(v)}</b> (${signed(v) || '0'}). ` +  // the verdict starts with why the machine stopped and the value in the chosen cell
                (p == null ? 'You did not enter a prediction.' : p === v ? '<b style="color:var(--ok)">✓ Your prediction was right.</b>' : `<b style="color:var(--bad)">✗ You predicted ${hex(p)}.</b> Step through again and watch the AC.`) +  // then says whether the prediction was right, wrong, or missing
                (M.selfModAt != null ? ` <span style="color:var(--warn)">Along the way the program rewrote its own instruction at ${hex(M.selfModAt, 3)}.</span>` : '');  // and adds a warning if the program rewrote one of its own instructions along the way
            }  // ends the halted branch
          }  // ends paint()
          function cycle() {  // cycle(): runs one full instruction cycle (fetch plus execute); Step calls it once, Run calls it repeatedly
            if (M.halted) return;  // a halted machine does nothing more
            const at = M.pc, w = M.mem.get(at) ?? 0, op = opOf(w), a = addrOf(w);  // fetch: reads the word at the PC and splits it into opcode and address
            M.ir = w; M.pc = (at + 1) & 0xFFF; M.cycles++; M.wrote = null;  // the word goes into the IR, the PC moves on by one (wrapping round within 12 bits), and the cycle is counted
            let line;  // line will hold this cycle's log text
            if (op === 0) { M.halted = true; M.why = `Halted after ${M.cycles} cycles.`; line = 'halt: the machine stops'; }  // opcode 0 is treated as halt in this lab: the machine stops
            else if (op === 1) { M.ac = M.mem.get(a) ?? 0; line = `load: AC ← [${hex(a, 3)}] = ${hex(M.ac)}`; }  // opcode 1, load: copies the word at the address into the AC
            else if (op === 2) {  // opcode 2, store: copies the AC into memory
              const old = M.mem.get(a) ?? 0;  // old keeps the cell's previous word so a self-rewrite can be reported
              M.mem.set(a, M.ac); M.wrote = a;  // writes the AC into the cell and remembers which cell was written
              line = `store: [${hex(a, 3)}] ← AC = ${hex(M.ac)}`;  // the log line for the store
              if (PA.includes(a)) {  // checks whether the store landed inside the program area
                // a store into the program area: the program has just rewritten one of its own instructions
                line += old === M.ac ? ' (an instruction cell, but it already held that word)' : ` (it overwrote the instruction ${hex(old)}!)`;  // the log notes whether the instruction there really changed
                if (old !== M.ac) {  // only a real change counts as a self-rewrite
                  M.selfModAt = a;  // remembers where the program rewrote itself
                  const when = a === M.pc ? 'The very next fetch' : a > M.pc ? `When the PC reaches ${hex(a, 3)}, the fetch` : `Cell ${hex(a, 3)} has already run, but any later fetch from it`;  // works out when the rewritten cell will matter: the next fetch, a later fetch, or only if it runs again
                  M.selfMod = `<b style="color:var(--warn)">The program rewrote itself.</b> Cell ${hex(a, 3)} held the instruction <b class="mono">${hex(old)}</b>; the store replaced it with <b class="mono">${hex(M.ac)}</b>. Instructions and data share one memory, so the processor cannot tell them apart. ${when} gets the new word: <span class="mono">${meaning(a, M.ac)}</span>. Reset puts your program back.`;  // the warning shown in the verdict: which instruction was replaced, why that is possible, and what it now means
                }  // ends the real-change branch
              }  // ends the program-area check
            }  // ends the store branch
            else if (op === 5) {  // opcode 5, add: adds the word at the address to the AC
              const sum = toInt(M.ac) + toInt(M.mem.get(a) ?? 0);  // adds the two values as signed numbers, reading both from sign-magnitude
              M.ac = fromInt(sum);  // stores the sum back in the AC in sign-magnitude form (capped at 15 bits)
              line = `add: AC ← AC + [${hex(a, 3)}] = ${hex(M.ac)}` + (Math.abs(sum) > 0x7FFF ? ' (overflow: too big for 15 bits)' : '');  // the log line for the add, noting an overflow when the true sum does not fit in 15 bits
            } else { M.halted = true; M.why = `Stopped: opcode ${op} is not one this lab understands.`; line = `opcode ${op}? unknown, machine stops`; }  // any other opcode stops the machine with an explanation
            if (!M.halted && M.cycles >= 40) { M.halted = true; M.why = 'Stopped after 40 cycles.'; }  // a safety limit: a program that never halts is stopped after 40 cycles
            if (M.cycles === 1) log.replaceChildren();  // the first cycle clears the "Ready" message from the log
            log.append(h('div', {}, h('b', {}, `#${M.cycles}  `), `fetch ${hex(at, 3)}: ${hex(w)} → `, line));  // adds this cycle's log line: the cycle number, the address and word fetched, and what it did
            log.scrollTop = log.scrollHeight;  // scrolls the log to the bottom so the newest line is always visible
            paint();  // repaints the registers, memory rows and verdict
            const r = M.wrote != null && rows[M.wrote];  // r is the memory row that was just written, if any
            if (r) { r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash'); }   // one-shot glow on the cell just written
          }  // ends cycle()
          const load = (k) => { const [, P, D, cell] = PRESETS[k]; PA.forEach((a, i) => { src[a] = hex(P[i]); }); DA.forEach((a, i) => { src[a] = hex(D[i]); }); sel.value = cell; pred.value = ''; resetMachine('Loaded “' + PRESETS[k][0] + '”. Predict, then run.'); };  // load(k): copies preset k into the boxes, selects its answer cell, clears the prediction, and resets the machine
          sel.addEventListener('change', () => paint());  // choosing another cell in the drop-down repaints, so the verdict reports that cell
          pred.addEventListener('input', () => { if (M.halted) paint(); });  // editing the prediction after a halt repaints so the verdict re-checks it
          el.append(h('div', { class: 'split r fill' },  // builds the page: a wide left column for memory and a right column for predicting and running
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: examples, memory editor and challenge
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Load an example:'), PRESETS.map((p, k) => h('button', { class: 'btn sm', onclick: () => load(k) }, p[0]))),  // row of preset buttons, one per example
              h('div', { class: 'grid-2', style: { gap: '10px', alignItems: 'start' } },  // two columns: program memory on the left, data memory and a reminder card on the right
                h('div', { class: 'card mem tight stack', style: { gap: '4px' } }, h('h4', { class: 'm0' }, 'Program (edit any word)'), PA.map(mk)),  // program card: its heading and one editable row for each address 300-305
                h('div', { class: 'stack', style: { gap: '10px' } },  // the right-hand stack
                  h('div', { class: 'card mem tight stack', style: { gap: '4px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } }, h('h4', { class: 'm0' }, 'Data'), h('span', { class: 'xs muted', title: 'The boxes show memory as it is right now. Reset puts back the words you typed.' }, h('span', { class: 'live-key' }), 'changed by the program')), DA.map(mk)),  // data card: its heading, a legend for the "changed by the program" highlight, and rows for 940-943
                  h('div', { class: 'card tight xs', html: '<b>Opcodes:</b> 1 = load AC · 2 = store AC · 5 = add to AC. <b>0000</b> = halt, a stop code added just for this lab. Numbers use sign-magnitude, so 8005 is −5.' }))),  // reminder card: the three opcodes, the lab-only halt code 0000, and how negative numbers are written
              h('div', { class: 'callout tip m0 small', 'data-label': 'Challenge' }, 'Start from “3 + 2”. Change exactly one instruction so that cell 941 ends up holding 0006. Predict first, then run it.',  // challenge box: change one instruction of "3 + 2" so cell 941 ends up holding 0006
                ctx.ui.reveal('Show one answer', '<div class="small" style="margin-top:4px">Change 301 from <b class="mono">5941</b> to <b class="mono">5940</b>: the add reads 940 again, so AC = 3 + 3 = 6 and the store writes 0006 into 941.</div>'))),  // a reveal button (ctx.ui.reveal) that shows one possible answer only when clicked
            h('div', { class: 'card white stack', style: { gap: '10px' } },  // right column: the predict and run card
              h('h4', { class: 'm0' }, '1 · Predict'),  // heading for part 1, predicting the result
              h('div', { class: 'row gap-s small' }, 'When it halts, cell', sel, 'will hold', pred, h('span', { class: 'xs muted' }, '(hex)')),  // the prediction sentence: "When it halts, cell [list] will hold [box] (hex)"
              h('h4', { class: 'm0' }, '2 · Run'),  // heading for part 2, running the program
              h('div', { class: 'row gap-s' }, h('button', { class: 'btn', onclick: cycle }, 'Step one cycle'), h('button', { class: 'btn primary', onclick: () => { let n = 0; while (!M.halted && n++ < 50) cycle(); } }, 'Run to the end'), h('button', { class: 'btn ghost', title: 'Stop, set PC = 300 and reload memory with the words you typed', onclick: () => resetMachine('Reset. Memory reloaded with the words you typed; PC = 300.') }, 'Reset')),  // buttons: Step one cycle, Run to the end (at most 50 cycles, as a guard), and Reset
              regs, log, verdict)));  // the register chips, the run log and the verdict card under the buttons
          load(0);  // loads the "3 + 2" example when the step opens
        },  // ends render() for step 7
      },  // ends step 7

      /* ---------------- 8. I/O: through the processor, or DMA ---------------- */
      {  // step 8 object starts here: moving I/O data through the processor compared with DMA
        title: 'Moving I/O data: through the processor, or around it',  // step 8 title
        kind: 'compare',  // kind "compare": two ways of doing the same job, side by side
        render(el, ctx) {  // render(el, ctx): builds step 8 each time it is opened
          const { h, s } = ctx;  // takes both builders from ctx: h for HTML, s for SVG
          let mode = 'cpu';  // mode is "cpu" (the processor copies every word) or "dma" (the I/O module writes memory itself)
          // geometry: a wide triangle layout, and a taller one for phones (I/O module above memory)
          const G = ctx.narrow ? {  // G holds every position in the drawing; this first set is the taller layout for phone-width screens
            vb: '0 0 320 400', fs: 13, cpu: [10, 6, 300, 92], cT: [160, 28], cS: [160, 52], meter: [60, 62, 200], cP: [160, 90],  // tall layout: drawing size, font size, the processor box, its text positions, and the progress meter
            io: [10, 142, 200, 92], ioT: [110, 162], ioS: [110, 226], ioW: (j) => [21 + j * 31, 176],  // tall layout: the I/O module box, its text, and ioW(j) which places its six waiting words
            mem: [10, 300, 200, 92], mT: [110, 320], mS: [110, 384], mW: (j) => [21 + j * 31, 334],  // tall layout: the memory box, its text, and mW(j) which places the six buffer slots
            path: { A: [[150, 140], [150, 100]], B: [[270, 100], [270, 346], [212, 346]], C: [[110, 236], [110, 298]] }, mid: { B: [270, 222] },  // tall layout: the three arrow routes (A: I/O to processor, B: processor to memory, C: I/O straight to memory)
            labA: [180, 118, 'start'], labB: [262, 250, 'end'], dma: [136, 272, 'start'],  // tall layout: where the "via the processor" and "DMA" labels go
          } : {  // the second set of positions is the wide triangle layout
            vb: '0 0 460 250', fs: 12.5, cpu: [140, 6, 180, 92], cT: [230, 28], cS: [230, 51], meter: [160, 61, 140], cP: [230, 89],  // wide layout: drawing size, font size, the processor box at the top centre, and the progress meter
            io: [6, 146, 190, 98], ioT: [101, 166], ioS: [101, 230], ioW: (j) => [17 + j * 28, 178],  // wide layout: the I/O module box at the bottom left and its word slots
            mem: [264, 146, 190, 98], mT: [359, 166], mS: [359, 230], mW: (j) => [275 + j * 28, 178],  // wide layout: the memory box at the bottom right and its buffer slots
            path: { A: [[80, 144], [170, 100]], B: [[290, 100], [380, 144]], C: [[198, 195], [262, 195]] }, mid: {},  // wide layout: the three arrow routes, each a straight line
            labA: [90, 112, 'end'], labB: [370, 112, 'start'], dma: [230, 176, 'middle'],  // wide layout: where the arrow labels go
          };  // closes the two layout choices
          const svg = s('svg', { viewBox: G.vb, width: '100%', style: ctx.narrow ? { display: 'block' } : { maxHeight: '300px', display: 'block' }, role: 'img', 'aria-label': 'Processor, I/O module and main memory, with the path each data word takes' });  // the SVG drawing of processor, I/O module and memory
          const spent = h('span', { class: 'chip cpu mono' }), ran = h('span', { class: 'chip ok mono' });  // two chips under the drawing: processor steps spent on the transfer, and program instructions that ran
          const T = (x, y, str, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle' }, o), str);  // T(...): shortcut for a centred SVG text element at (x, y)
          // derive everything about frame i from scratch
          function state(i) {  // state(i): works out everything shown in frame i from nothing, so any frame can be jumped to directly
            if (mode === 'cpu') {  // the through-the-processor mode
              if (i === 0) return { left: 6, filled: 0, tok: null, spent: 0, prog: 0, cpu: 'ready' };  // frame 0: six words waiting, nothing moved, the processor ready
              const k = Math.ceil(i / 2), part1 = i % 2 === 1;  // k is the word being moved; odd frames are part 1 (input), even frames part 2 (store)
              return { left: 6 - k, filled: part1 ? k - 1 : k, tok: part1 ? ['A', 'in', 'w' + k] : ['B', 'out', 'w' + k], spent: i, prog: 0, cpu: part1 ? 'reading word ' + k : 'storing word ' + k };  // each word takes two frames: first into the processor, then out to memory; every frame costs a processor step
            }  // ends the through-the-processor mode
            if (i === 0) return { left: 6, filled: 0, tok: null, spent: 0, prog: 0, cpu: 'ready' };  // DMA mode, frame 0: the same starting point
            if (i === 1) return { left: 6, filled: 0, tok: ['A', 'down', 'cmd'], spent: 1, prog: 0, cpu: 'sending a command' };  // DMA frame 1: the processor sends one command down to the I/O module, costing one step
            if (i <= 7) return { left: 7 - i, filled: i - 1, tok: ['C', 'out', 'w' + (i - 1)], spent: 1, prog: 3 * (i - 1), cpu: 'running your program' };  // DMA frames 2-7: one word per frame goes straight into memory while the program runs 3 instructions per frame
            return { left: 0, filled: 6, tok: ['A', 'in', 'done', 'intr'], spent: 2, prog: 18, cpu: 'noting “done”' };  // DMA last frame: the I/O module signals "done" back to the processor, costing one more step (2 in total)
          }  // ends state()
          const CAP = {  // CAP: the caption for each frame, one function per mode
            cpu: (i) => i === 0 ? 'Six words must travel from a disk’s I/O module into memory. In this mode the processor carries every word itself.'  // through-the-processor caption, frame 0: the processor will carry every word itself
              : i === 12 ? '<b>Done, but costly.</b> 12 instruction cycles went into copying 6 words, and your program ran none of its own. A real disk block holds thousands of words.'  // last frame caption: 12 cycles went into 6 words and the program ran nothing
              : i % 2 ? `<b>Word ${Math.ceil(i / 2)}, part 1.</b> The processor executes an input instruction: the word moves from the I/O module into a processor register.`  // odd frames: part 1, an input instruction moves the word into a register
              : `<b>Word ${i / 2}, part 2.</b> A store instruction copies it from the register into memory. Two full instruction cycles per word, while your program waits.`,  // even frames: part 2, a store instruction copies it to memory while the program waits
            dma: (i) => i === 0 ? 'Same job, but now the I/O module is allowed to read and write main memory by itself.'  // DMA caption, frame 0: the I/O module may now write memory by itself
              : i === 1 ? '<b>Set-up.</b> The processor sends one command to the I/O module: “copy 6 words into memory starting at address 700.” Then it goes back to its own work.'  // DMA frame 1 caption: the processor gives one command and goes back to its own work
              : i <= 7 ? `<b>Word ${i - 1}</b> goes straight from the I/O module into memory. Meanwhile the processor keeps executing your program.`  // DMA frames 2-7 caption: each word goes straight into memory while the processor keeps working
              : '<b>Done.</b> The I/O module tells the processor the transfer is finished (with an <span class="t">interrupt</span>, the topic of 1.4). The processor spent only 2 steps on the whole transfer.',  // DMA last caption: the module signals completion with an interrupt, the topic of section 1.4
          };  // closes the CAP table
          function arrow(key, on, rev, cls) {  // arrow(key, on, rev, cls): draws one of the three routes, active or idle, reversed if rev is true
            const pts = rev ? G.path[key].slice().reverse() : G.path[key];  // the route's points, reversed when the traffic flows the other way
            return s('polyline', { points: pts.map((p) => p.join(',')).join(' '), fill: 'none', 'stroke-width': on ? 3.5 : 2, 'stroke-dasharray': on ? null : '5 5', 'marker-end': on ? `url(#arr-${cls || 'accent'})` : null, style: `stroke:var(--${on ? (cls || 'accent') : 'line-2'})` });  // a polyline (a line through several points): thick with an arrowhead when active, dashed when idle
          }  // ends arrow()
          const box = ([x, y, w, hh], cls) => s('rect', { x, y, width: w, height: hh, rx: 14, class: cls, 'stroke-width': 2 });  // box(...): draws a rounded rectangle for one of the three units
          const title = ([x, y], str, col) => T(x, y, str, { 'font-size': G.fs, 'font-weight': 800, 'letter-spacing': '.07em', style: `fill:var(--${col})` });  // title(...): draws a unit's bold title in its colour
          const sub = ([x, y], str) => T(x, y, str, { 'font-size': G.fs, class: 's-sub' });  // sub(...): draws a unit's grey status line
          function draw(i) {  // draw(i): rebuilds the drawing for frame i; the step player calls it on every frame
            const S = state(i), tok = S.tok, kids = [], [mx0, my0, mw] = G.meter;  // S is this frame's state; kids collects the shapes; the meter's position comes from the layout
            kids.push(box(G.cpu, 's-cpu'), title(G.cT, 'PROCESSOR', 'cpu'), T(G.cS[0], G.cS[1], S.cpu, { 'font-size': G.fs + 1.5, 'font-weight': 700 }),  // the processor box, its title, and what it is doing now
              s('rect', { x: mx0, y: my0, width: mw, height: 10, rx: 5, class: 's-panel', 'stroke-width': 1 }),  // the empty track of the progress meter
              S.prog ? s('rect', { x: mx0, y: my0, width: mw * S.prog / 18, height: 10, rx: 5, style: 'fill:var(--ok)' }) : null,  // the green fill of the meter, showing how much of the 18-instruction program has run
              sub(G.cP, 'your program: ' + S.prog + ' instructions'));  // the text under the meter with the instruction count
            kids.push(box(G.io, 's-io'), title(G.ioT, 'I/O MODULE · DISK', 'io'), sub(G.ioS, 'words waiting: ' + S.left),  // the I/O module box with its title and the number of words still waiting
              box(G.mem, 's-mem'), title(G.mT, 'MAIN MEMORY', 'mem'), sub(G.mS, 'buffer at 700–705'));  // the memory box with its title and the address range of the buffer (700-705)
            for (let j = 0; j < 6; j++) {  // draws the six word slots in the module and the six slots in memory
              const waiting = j >= 6 - S.left, got = j < S.filled, [ix, iy] = G.ioW(j), [qx, qy] = G.mW(j);  // waiting = still in the module; got = already in memory; plus both slots' positions
              kids.push(s('rect', { x: ix, y: iy, width: 24, height: 24, rx: 5, class: waiting ? 's-io' : 's-panel', 'stroke-width': waiting ? 2 : 1, 'stroke-dasharray': waiting ? null : '3 3' }),  // the module's slot: solid when the word is still waiting, dashed when it has left
                waiting ? T(ix + 12, iy + 17, String(j + 1), { 'font-size': 12, 'font-weight': 800 }) : null,  // the waiting word's number
                s('rect', { x: qx, y: qy, width: 24, height: 24, rx: 5, class: got ? 's-mem' : 's-panel', 'stroke-width': got ? 2 : 1 }),  // the memory slot: filled once the word has arrived
                got ? T(qx + 12, qy + 17, String(j + 1), { 'font-size': 12, 'font-weight': 800 }) : null);  // the arrived word's number
            }  // ends the slot loop
            const on = (k) => tok && tok[0] === k;  // on(k): true when this frame's moving item uses route k
            const lab = ([x, y, anc]) => [T(x, y, 'via the', { 'font-size': 12, 'text-anchor': anc, class: 's-sub' }), T(x, y + 14, 'processor', { 'font-size': 12, 'text-anchor': anc, class: 's-sub' })];  // lab(...): the two-line "via the processor" label beside a route
            kids.push(arrow('A', on('A'), tok && tok[1] === 'down', tok && tok[3]), arrow('B', on('B')), arrow('C', on('C')), ...lab(G.labA), ...lab(G.labB),  // the three arrows (A reverses for the DMA command and turns interrupt-coloured for "done"), plus their labels
              T(G.dma[0], G.dma[1], 'DMA', { 'font-size': 12, 'font-weight': 800, 'text-anchor': G.dma[2], style: `fill:var(--${mode === 'dma' ? 'accent' : 'muted'})` }));  // the "DMA" label on the direct route, bright in DMA mode and grey otherwise
            if (tok) {  // when something is moving in this frame, a labelled token is drawn on its route
              const P = G.path[tok[0]], [mx, my] = G.mid[tok[0]] || [(P[0][0] + P[P.length - 1][0]) / 2, (P[0][1] + P[P.length - 1][1]) / 2], w = tok[2].length * 8 + 16;  // the token sits at the route's middle (or a set point on the bent tall-layout route) and is sized to its text
              kids.push(s('rect', { x: mx - w / 2, y: my - 11, width: w, height: 22, rx: 11, class: tok[3] ? 's-intr' : 's-accent', 'stroke-width': 2 }), T(mx, my + 5, tok[2], { 'font-size': 12.5, 'font-weight': 800, class: 's-monot' }));  // the token: a rounded tag, interrupt-coloured for the "done" signal, with its label (w1, cmd, done...) inside
            }  // ends the token drawing
            svg.replaceChildren(...kids);  // swaps all the new shapes into the drawing at once
            spent.textContent = 'processor steps on the transfer: ' + S.spent;  // updates the chip that counts processor steps spent on the transfer
            ran.textContent = 'your program ran: ' + S.prog;  // updates the chip that counts program instructions that ran meanwhile
          }  // ends draw()
          const count = () => (mode === 'cpu' ? 13 : 9);  // count(): 13 frames for the through-the-processor mode, 9 for DMA
          const player = ctx.ui.player({ count: count(), render: (i) => { draw(i); return CAP[mode](i); }, interval: 1300 });  // the shell's step player: each frame redraws the picture and shows the caption for the current mode
          const seg = ctx.ui.seg([{ value: 'cpu', label: 'Processor carries every word' }, { value: 'dma', label: 'Direct memory access (DMA)' }], mode, (v) => { mode = v; player.setCount(count()); });  // mode switch: choosing the other mode gives the player its new frame count and starts again from frame 0
          el.append(h('div', { class: 'split l fill' },  // builds the page: text on the left, the animation card on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the two ways I/O data can travel
              h('p', { class: 'lead m0', html: 'Data for an I/O device can travel two ways.' }),  // intro sentence: data for an I/O device can take two routes
              h('p', { class: 'm0 small', html: '<b>Through the processor.</b> A processor–I/O instruction works like a load or store, but it names a device instead of a memory cell. Data moves directly between the processor and that device’s <span class="t">I/O module</span> (the circuit that runs it).' }),  // paragraph: through the processor, where an I/O instruction names a device instead of a memory cell
              h('p', { class: 'm0 small', html: '<b>Around the processor.</b> For bulk transfers, the processor can let the I/O module read or write main memory itself. This is <span class="t">direct memory access (DMA)</span>: the processor is relieved of the copying and keeps executing instructions.' }),  // paragraph: around the processor, which is direct memory access (DMA)
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters' }, 'Copying a disk block word by word burns thousands of instruction cycles that compute nothing. DMA gives that time back.'),  // "why it matters" box: word-by-word copying wastes thousands of cycles, and DMA gives that time back
              h('table', { class: 'tbl compact', html: '<thead><tr><th></th><th>Through the processor</th><th>DMA</th></tr></thead><tbody><tr><td class="b">Who moves each word</td><td>the processor, one instruction at a time</td><td>the I/O module</td></tr><tr><td class="b">Processor meanwhile</td><td>busy copying</td><td>runs other instructions</td></tr></tbody>' }),  // small comparison table: who moves each word, and what the processor does meanwhile
              h('p', { class: 'xs muted m0' }, 'Preview only: 1.7 covers DMA in detail, and 1.4 covers the “done” signal.')),  // note that sections 1.7 and 1.4 cover DMA and the "done" signal in full
            h('div', { class: 'card white stack', style: { gap: '10px' } },  // right column: the animation card
              h('div', { class: 'row gap-s' }, seg),  // the mode switch
              h('div', { class: 'row gap-s' }, spent, ran),  // the two counter chips
              h('div', { class: 'grow', style: { display: 'grid', placeItems: 'center' } }, svg),  // the drawing, centred in the leftover space
              player.el)));  // the player controls at the bottom
        },  // ends render() for step 8
      },  // ends step 8

      /* ---------------- 9. Recap ---------------- */
      {  // step 9 object starts here: the recap
        title: 'Recap: eight things to remember',  // step 9 title
        kind: 'recap',  // kind "recap": a summary step, kept on the core path
        render(el, ctx) {  // render(el, ctx): builds step 9 each time it is opened
          const { h } = ctx;  // takes the HTML element builder h from ctx
          const trace = [['F', '300 → IR = 1940', 'PC = 301'], ['E', 'AC ← [940]', 'AC = 0003'], ['F', '301 → IR = 5941', 'PC = 302'], ['E', 'AC ← AC + [941]', 'AC = 0005'], ['F', '302 → IR = 2941', 'PC = 303'], ['E', '[941] ← AC', '941 = 0005']];  // trace: the six stages of the example program as [F or E, what happened, the result]
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // builds the page: one column
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. If you hesitate, revisit that step.'),  // instruction to answer out loud before flipping each card
            ctx.ui.flipcards([  // the flip cards (ctx.ui.flipcards): each pair is [front question, back answer]
              ['The two stages of every instruction cycle', '<div><b>Fetch</b>: the instruction at the PC’s address goes into the IR, and PC + 1. <b>Execute</b>: decode it, do it. Repeat until halt.</div>'],  // card: the two stages of every instruction cycle
              ['What the PC holds, and when it changes', '<div>The address of the <i>next</i> instruction. Here it goes up by 1 after each fetch (one word per instruction), unless a control instruction such as a jump loads a new address.</div>'],  // card: what the PC holds and when it changes
              ['When does the loop stop?', '<div>Only on a halt: the power goes off, an unrecoverable error occurs, or the program executes an instruction that says stop.</div>'],  // card: the only ways the loop stops
              ['The four kinds of instruction', '<div>Processor–memory, processor–I/O, data processing and control. One instruction can combine several.</div>'],  // card: the four kinds of instruction
              ['Decode the word 5941', '<div>Opcode 5 (0101) = add to AC from memory; address 941. So AC ← AC + the word at 941.</div>'],  // card: decoding the word 5941
              ['Why 16 opcodes and 4,096 words?', '<div>4 opcode bits give 2<sup>4</sup> = 16 patterns. 12 address bits give 2<sup>12</sup> = 4,096 addresses (4K).</div>'],  // card: why 4 opcode bits give 16 operations and 12 address bits give 4,096 words
              ['The jobs of the MAR and the MBR', '<div>MAR: the address about to be read or written. MBR: the word just read from memory, or about to be written to it.</div>'],  // card: the jobs of the MAR and the MBR
              ['What DMA buys you', '<div>An I/O module moves data to or from memory itself, so the processor is freed from the transfer and keeps running programs.</div>'],  // card: what DMA buys the processor
            ], { cols: 4, height: 138 }),  // closes the card list; shows them in 4 columns, each 138px tall
            h('div', { class: 'card tight' },  // a card showing the whole program trace in one row
              h('h4', {}, 'The whole example program in one line (F = fetch, E = execute)'),  // its heading, explaining F and E
              h('div', { class: 'row gap-s' }, trace.map(([k, a, b], i) => [  // one chip per stage, joined by arrows
                h('span', { class: 'chip ' + (k === 'F' ? 'mem' : 'cpu') + ' mono', title: k === 'F' ? 'fetch' : 'execute' }, k + (Math.floor(i / 2) + 1), h('span', { style: { fontWeight: 600 } }, ' ' + a), h('b', {}, ' · ' + b)),  // a chip labelled F1, E1, F2 and so on (fetch in the memory colour, execute in the processor colour) with its action and result
                i < trace.length - 1 ? h('span', { class: 'muted' }, '→') : null]))),  // an arrow after every chip except the last
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake' }, 'Thinking the PC points at the instruction that is running. It already points at the next one: the increment happens during the fetch, before execution starts.')));  // "common mistake" box: the PC already points at the next instruction while the current one runs
        },  // ends render() for step 9
      },  // ends step 9

      /* ---------------- 10. Check yourself ---------------- */
      {  // step 10 object starts here: the section quiz
        title: 'Check yourself',  // step 10 title
        kind: 'check',  // kind "check": the Check Yourself quiz, kept on the core path and counted for mastery
        quiz: [  // quiz: the shell turns this list of questions into the interactive quiz
          { q: 'A processor has just finished the execute stage of an ordinary add instruction. What does it do next?',  // question 1 (multiple choice): what the processor does right after an execute stage
            choices: ['Starts a new fetch, from the address now held in the program counter', 'Executes the same instruction again, because it is still in the instruction register', 'Halts, because every instruction cycle ends in a halt', 'Waits for the operating system to hand it the next instruction'], answer: 0,  // choices; answer: 0 marks the first as right (a new fetch from the PC's address)
            feedback: [null, 'The IR keeps the old instruction only until the next fetch overwrites it. Nothing makes the processor run it a second time.', 'Halt is not part of every cycle. The loop stops only when the power goes off, an unrecoverable error occurs, or a halt instruction is executed.', 'The hardware loop needs no help: the next fetch begins automatically. The operating system is itself just a program run by this same loop.'],  // feedback for each wrong choice (null for the right one): IR is not re-run, halt is not in every cycle, no OS help needed
            why: 'The instruction cycle is a loop (fetch, execute, fetch, execute…). The next fetch starts straight away from the address in the PC, and the loop ends only on a halt.' },  // explanation shown after answering: the cycle loops until a halt
          { type: 'tf', q: 'On a word-addressed teaching machine where every instruction fills exactly one memory word, the program counter goes up by one after every fetch unless an instruction changes it, so instructions run in address order.', answer: true,  // question 2 (true or false): the PC goes up by one per fetch on a one-word-per-instruction machine
            why: 'Each fetch moves the PC past the instruction it just read. Here that instruction is one word, so the step is 1; a real processor adds the instruction’s length in addressable units (on a byte-addressed machine, 4 for a 4-byte instruction). Only control instructions, such as a jump, break the address order.' },  // explanation: why the step is 1 here, how real processors add the instruction length, and that jumps break the order
          { type: 'order', q: 'A tiny accumulator machine runs 300: 1940 (load AC from 940), 301: 5941 (add from 941), 302: 2941 (store to 941). Put its six stages in order.',  // question 3 (put in order): the six stages of the three-instruction program
            items: ['Fetch 1940 from 300 into the IR', 'Load the AC with the word at 940', 'Fetch 5941 from 301 into the IR', 'Add the word at 941 to the AC', 'Fetch 2941 from 302 into the IR', 'Store the AC into 941'],  // the items, listed in their correct order; the quiz shuffles them for the student
            why: 'Every instruction cycle is fetch then execute, and the PC walks 300 → 301 → 302 → 303 along the way.' },  // explanation: fetch then execute each time, with the PC walking from 300 to 303
          { type: 'bucket', q: 'Sort each instruction into its category: processor–memory (Memory), processor–I/O (I/O), data processing, or control.',  // question 4 (sort into groups): instructions into the four categories
            buckets: ['Memory', 'I/O', 'Data processing', 'Control'],  // the four group names
            items: [['Store the AC into address 941', 0], ['Read a byte from the keyboard module', 1], ['Multiply two registers', 2], ['If the AC is zero, skip the next instruction', 3], ['Shift the AC one bit left', 2]],  // the items, each with the number of its correct group
            why: 'Transfers with memory, transfers with an I/O module, arithmetic or logic on data, and changes to the order of execution (to the PC) are the four categories.' },  // explanation: the four categories in one sentence
          { type: 'num', q: 'An instruction format has a 4-bit opcode field. How many different opcodes can it express?', answer: 16,  // question 5 (calculate): how many opcodes a 4-bit field can express (16)
            why: 'Four bits can form 2<sup>4</sup> = 16 different patterns, so at most 16 operations.' },  // explanation: 2 to the power 4 is 16
          { type: 'num', q: 'An instruction format has a 12-bit address field. How many memory words can one instruction address directly?', answer: 4096, unit: 'words',  // question 6 (calculate): how many words a 12-bit address field can reach (4,096)
            why: 'Twelve bits can form 2<sup>12</sup> = 4,096 patterns, often written 4K.' },  // explanation: 2 to the power 12 is 4,096, often written 4K
          { type: 'num', q: 'A different 16-bit machine uses 6 bits for the opcode and the remaining bits for the address. How many words can an instruction address directly?', answer: 1024, unit: 'words',  // question 7 (calculate): a 16-bit word with a 6-bit opcode leaves how many addressable words (1,024)
            hint: 'How many bits are left for the address?',  // hint shown to help: count the bits left over for the address
            why: '16 − 6 = 10 address bits, and 2<sup>10</sup> = 1,024.' },  // explanation: 10 address bits give 1,024 words
          { q: 'On a machine whose opcodes are 1 = load AC, 2 = store AC and 5 = add to AC (the first hex digit of a 16-bit word), what does the word 2941 (hex) do?',  // question 8 (multiple choice): what the word 2941 does
            choices: ['Load the AC from address 941', 'Store the AC into address 941', 'Add the word at 941 to the AC', 'Jump to address 941'], answer: 1,  // choices; answer: 1 marks "store the AC into 941" as right
            feedback: ['Load is opcode 1 (0001); this word starts with 2.', null, 'Add is opcode 5 (0101); this word starts with 2.', 'None of these opcodes is a jump; the leading 2 means store.'],  // feedback for each wrong choice: load is 1, add is 5, and none of these opcodes is a jump
            why: 'The first hex digit is the 4-bit opcode (2 = 0010 = store AC to memory) and the other three digits are the address, 941.' },  // explanation: first hex digit is the opcode, the other three the address
          { type: 'multi', q: 'In a simple accumulator machine, which of these happen during the <b>fetch</b> stage?',  // question 9 (select all that apply): what happens during the fetch stage
            choices: ['The PC’s value is copied into the MAR', 'The instruction word arrives in the MBR and is moved into the IR', 'The PC is incremented', 'The AC gets a new value', 'A data word is written into memory'], answer: [0, 1, 2],  // choices; the first three are right (PC to MAR, word into MBR then IR, PC incremented)
            why: 'Fetch only brings the instruction in and advances the PC. Changing the AC or writing data to memory happens in the execute stage.' },  // explanation: changing the AC and writing data belong to the execute stage
          { type: 'match', q: 'An accumulator machine runs 300: 1940 (load AC from 940), 301: 5941 (add from 941), 302: 2941 (store to 941), with 0003 at 940 and 0002 at 941. Match each register to the value it holds right after the <b>second execute</b> (the add).',  // question 10 (match the pairs): each register's value right after the second execute
            pairs: [['PC', '302'], ['IR', '5941'], ['AC', '0005'], ['MAR', '941'], ['MBR', '0002']],  // the pairs: PC 302, IR 5941, AC 0005, MAR 941, MBR 0002
            why: 'The add was fetched from 301, so the PC has already moved on to 302 and 5941 sits in the IR. To execute it, the MAR carried the address field 941 to memory, the MBR received the operand 0002, and the ALU made AC = 3 + 2 = 0005.' },  // explanation: how each register got its value during the add
          { type: 'num', q: 'A 16-bit data word uses sign-magnitude: 1 sign bit (1 = negative) and a 15-bit magnitude. What decimal value is the word 8005 (hex)?', answer: -5,  // question 11 (calculate): the decimal value of the sign-magnitude word 8005 (−5)
            why: '8005 hex is 1000 0000 0000 0101: the sign bit is 1 (negative) and the other 15 bits hold 5, so the value is −5.' },  // explanation: the sign bit is 1 and the magnitude is 5
          { q: 'What is the main benefit of direct memory access (DMA)?',  // question 12 (multiple choice): the main benefit of DMA
            choices: ['It makes each instruction cycle shorter', 'An I/O module moves data to or from memory itself, so the processor is freed from the transfer', 'It lets the processor skip the fetch stage', 'It stores programs inside the I/O module'], answer: 1,  // choices; answer: 1 marks "the I/O module moves the data itself" as right
            feedback: ['DMA does not change the instruction cycle; it takes the processor out of the copying work.', null, 'Every instruction the processor runs must still be fetched.', 'Programs still live in main memory; DMA is about moving data.'],  // feedback for each wrong choice: DMA does not shorten cycles, skip fetches, or store programs
            why: 'With DMA the processor only sets up the transfer and is told when it is done; the I/O module moves the words directly to or from memory.' },  // explanation: the processor only sets up the transfer and is told when it is done
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the steps list

    notes: `${/* notes: the written summary of the section, opened with the Notes button and included in the printable guide */''}
<h3>1. A program and the instruction cycle</h3>${/* heading for part 1 of the notes: programs and the instruction cycle */''}
<p>A <b>program</b> is an ordered list of <b>instructions</b> stored in main memory. The processor runs it by repeating one loop. The work done for a single instruction is called one <b>instruction cycle</b>, and in its simplest form it has two stages:</p>${/* notes paragraph: a program is a list of instructions, and one instruction cycle has two stages */''}
<ul>${/* start of the list of the two stages */''}
<li><b>Fetch stage:</b> read the next instruction from memory into the processor.</li>${/* list item: the fetch stage */''}
<li><b>Execute stage:</b> <b>decode</b> the instruction (work out what its bits ask for) and carry out that action.</li>${/* list item: the execute stage, including what decoding means */''}
</ul>${/* end of the two-stage list */''}
<p>Then the next fetch begins automatically. The loop only stops at a <b>halt</b>: the machine is switched off, an error it cannot recover from occurs, or the program executes an instruction that tells the processor to stop.</p>${/* notes paragraph: the next fetch starts automatically and only a halt ends the loop */''}
<p><b>START</b> → <b>FETCH</b> the next instruction → <b>EXECUTE</b> it → back to FETCH … → <b>HALT</b></p>${/* notes line: the whole loop written as one chain from START to HALT */''}
<p>Section 1.4 adds a third stage after execute, the <b>interrupt stage</b>, in which the processor checks whether a device is asking for attention.</p>${/* notes paragraph: section 1.4 adds an interrupt stage after execute */''}
<h3>2. The fetch stage: program counter and instruction register</h3>${/* heading for part 2 of the notes: the PC and IR during a fetch */''}
<p>Two <b>registers</b> (tiny, very fast storage slots inside the processor) run the fetch:</p>${/* notes paragraph: introduces registers as the two slots that run the fetch */''}
<ul>${/* start of the PC and IR list */''}
<li>The <b>program counter (PC)</b> holds the <i>address</i> of the next instruction to fetch.</li>${/* list item: the PC holds the address of the next instruction */''}
<li>The <b>instruction register (IR)</b> holds the instruction just fetched while it is decoded and executed.</li>${/* list item: the IR holds the instruction being decoded and executed */''}
</ul>${/* end of the PC and IR list */''}
<p>At the start of every cycle the processor fetches the instruction whose address is in the PC and places it in the IR. It then increments the PC (by 1 here, since each instruction fills one word; a byte-addressed machine adds the instruction’s length in bytes), so unless something says otherwise, instructions run in address order (100, 101, 102, …). While an instruction executes, the PC already points at the one after it.</p>${/* notes paragraph: the fetch copies into the IR and then increments the PC, so instructions run in address order */''}
<p>A <b>jump</b> is how “otherwise” happens: executing it overwrites the PC with a new address, so the next fetch comes from somewhere else. Loops and if-statements are built this way.</p>${/* notes paragraph: a jump overwrites the PC, which is how loops and if-statements are built */''}
<h3>3. The four categories of instruction</h3>${/* heading for part 3 of the notes: the four categories of instruction */''}
<table>${/* start of the categories table */''}
<tr><th>Category</th><th>What it does</th><th>Examples</th></tr>${/* table header row: category, what it does, examples */''}
<tr><td>Processor–memory</td><td>Copies data between the processor and main memory, in either direction.</td><td>Load the AC from 940; store the AC into 941.</td></tr>${/* table row: processor-memory instructions */''}
<tr><td>Processor–I/O</td><td>Copies data between the processor and an I/O module (the circuit that runs a device).</td><td>Send a byte to the printer; read the keyboard’s status.</td></tr>${/* table row: processor-I/O instructions */''}
<tr><td>Data processing</td><td>Performs arithmetic or logic on data.</td><td>Add, subtract, AND, NOT, shift.</td></tr>${/* table row: data processing instructions */''}
<tr><td>Control</td><td>Changes the order of execution by loading a new address into the PC.</td><td>Jump to 500; skip the next instruction if the AC is zero.</td></tr>${/* table row: control instructions */''}
</table>${/* end of the categories table */''}
<p>One instruction can combine several categories. “Add the word at 941 to the AC” reads memory (processor–memory) and then adds (data processing).</p>${/* notes paragraph: one instruction can combine categories, with the add-from-memory example */''}
<h3>4. A hypothetical 16-bit accumulator machine</h3>${/* heading for part 4 of the notes: the made-up 16-bit accumulator machine */''}
<ul>${/* start of the list describing the machine */''}
<li>Memory is a sequence of 16-bit <b>words</b>, each with an address.</li>${/* list item: memory is a sequence of addressed 16-bit words */''}
<li>Instruction format: a 4-bit <b>opcode</b> (which operation) followed by a 12-bit <b>address field</b> (which memory word).</li>${/* list item: the instruction format, 4-bit opcode plus 12-bit address field */''}
<li>Data format: 1 sign bit (0 = positive, 1 = negative) followed by a 15-bit magnitude (<b>sign-magnitude</b>).</li>${/* list item: the data format, sign bit plus 15-bit magnitude */''}
<li>Registers: PC, IR, and one <b>accumulator (AC)</b> that holds the data being worked on. PC and MAR hold 12-bit addresses; IR, AC and MBR hold 16-bit words.</li>${/* list item: the registers and how many bits each one holds */''}
</ul>${/* end of the machine description list */''}
<table>${/* start of the opcode table */''}
<tr><th>Opcode (binary)</th><th>Hex</th><th>Meaning</th></tr>${/* opcode table header row */''}
<tr><td>0001</td><td>1</td><td>Load AC from memory</td></tr>${/* opcode table row: 1 = load AC */''}
<tr><td>0010</td><td>2</td><td>Store AC to memory</td></tr>${/* opcode table row: 2 = store AC */''}
<tr><td>0101</td><td>5</td><td>Add to AC from memory</td></tr>${/* opcode table row: 5 = add to AC */''}
</table>${/* end of the opcode table */''}
<p><b>Capacity:</b> 4 opcode bits give 2<sup>4</sup> = 16 different opcodes. 12 address bits give 2<sup>12</sup> = 4,096 (4K) directly addressable words. In general, k bits give 2<sup>k</sup> patterns; a 16-bit instruction with a 6-bit opcode would leave 10 address bits, reaching 2<sup>10</sup> = 1,024 words.</p>${/* notes paragraph: how many opcodes and addresses a given number of bits allows, with the 6-bit opcode example */''}
<p><b>Hexadecimal</b> is used because each hex digit is exactly four bits. So the first hex digit of an instruction word is its opcode and the last three are its address. Worked example: 1940 hex = 0001 1001 0100 0000 → opcode 0001 (load AC), address 940. Note that 940 is hex: 9×256 + 4×16 = 2,368 in decimal. As a data word, 8005 hex = 1000 0000 0000 0101 → sign 1 (negative), magnitude 5, value −5.</p>${/* notes paragraph: why hex is used, with 1940 and 8005 decoded step by step */''}
<p>Memory cannot tell instructions from data. A word acts as an instruction when the PC fetches it, and as data when an instruction’s address field points at it. One consequence: a store whose address points into the program area overwrites an instruction, so the program changes itself. The next time the PC reaches that cell, the processor fetches and runs the new word, not the one the programmer wrote.</p>${/* notes paragraph: memory cannot tell instructions from data, so a store into the program area changes the program */''}
<h3>5. Tracing the example program (3 + 2)</h3>${/* heading for part 5 of the notes: tracing the 3 + 2 program */''}
<p>Memory before the run: program at 300: <b>1940</b>, 301: <b>5941</b>, 302: <b>2941</b>; data at 940: <b>0003</b>, 941: <b>0002</b>. The PC starts at 300. Three instruction cycles make six stages ([x] means “the word stored at address x”):</p>${/* notes paragraph: memory contents before the run and what [x] means */''}
<table>${/* start of the trace table */''}
<tr><th>#</th><th>Stage</th><th>What happens</th><th>PC</th><th>IR</th><th>AC</th><th>941</th></tr>${/* trace table header: stage number, stage, action, then PC, IR, AC and cell 941 */''}
<tr><td>1</td><td>Fetch</td><td>[300] → IR</td><td>301</td><td>1940</td><td>–</td><td>0002</td></tr>${/* trace row 1: the first fetch */''}
<tr><td>2</td><td>Execute</td><td>Load: AC ← [940]</td><td>301</td><td>1940</td><td>0003</td><td>0002</td></tr>${/* trace row 2: the load puts 0003 in the AC */''}
<tr><td>3</td><td>Fetch</td><td>[301] → IR</td><td>302</td><td>5941</td><td>0003</td><td>0002</td></tr>${/* trace row 3: the second fetch */''}
<tr><td>4</td><td>Execute</td><td>Add: AC ← AC + [941]</td><td>302</td><td>5941</td><td>0005</td><td>0002</td></tr>${/* trace row 4: the add makes the AC 0005 */''}
<tr><td>5</td><td>Fetch</td><td>[302] → IR</td><td>303</td><td>2941</td><td>0005</td><td>0002</td></tr>${/* trace row 5: the third fetch */''}
<tr><td>6</td><td>Execute</td><td>Store: [941] ← AC</td><td>303</td><td>2941</td><td>0005</td><td>0005</td></tr>${/* trace row 6: the store writes 0005 into 941 */''}
</table>${/* end of the trace table */''}
<p>Result: cell 941 holds 0005 and the PC holds 303. The PC went 300 → 301 → 302 → 303, one step per fetch, and only cell 941 changed. Notice that right after the second fetch the PC is already 302 while 5941 waits in the IR: an instruction stays in the IR until the next fetch replaces it.</p>${/* notes paragraph: the result, and that the PC is already 302 while 5941 waits in the IR */''}
<h4>The MAR and MBR inside each stage</h4>${/* small heading: the MAR and MBR inside each stage */''}
<p>The processor talks to memory through two more registers. The <b>memory address register (MAR)</b> holds the address about to be read or written; the <b>memory buffer register (MBR)</b> holds the word just read, or about to be written.</p>${/* notes paragraph: what the MAR and MBR each hold */''}
<ul>${/* start of the list of register moves per stage */''}
<li><b>Fetch:</b> MAR ← PC; memory sends the addressed word into the MBR; IR ← MBR; PC ← PC + 1.</li>${/* list item: the register moves during a fetch */''}
<li><b>Execute a load or add:</b> MAR ← address field of the IR; memory sends the operand into the MBR; then AC ← MBR (load), or the <b>arithmetic logic unit (ALU)</b> computes AC ← AC + MBR (add).</li>${/* list item: the register moves while executing a load or an add, where the ALU does the adding */''}
<li><b>Execute a store:</b> MAR ← address field; MBR ← AC; memory writes the MBR’s word at that address.</li>${/* list item: the register moves while executing a store */''}
</ul>${/* end of the register-move list */''}
<p>Counting memory traffic in the example: 5 reads (3 instruction fetches plus 2 operand reads, from 940 and 941) and 1 write (the store into 941).</p>${/* notes paragraph: counting the example's memory traffic, 5 reads and 1 write */''}
<h3>6. Moving data to and from I/O</h3>${/* heading for part 6 of the notes: moving data to and from I/O */''}
<p>Processor–I/O instructions exchange data <b>directly between the processor and an I/O module</b>. They work like a load or store, except that they name a device (an I/O address) instead of a memory cell. For large transfers this is wasteful: every word costs the processor whole instruction cycles (an input instruction plus a store).</p>${/* notes paragraph: processor-I/O instructions, and why they are wasteful for large transfers */''}
<p>With <b>direct memory access (DMA)</b>, the processor instead lets the I/O module read from or write to main memory itself. The processor sends one command to set up the transfer, the I/O module moves the words, and it tells the processor when it is finished (using an interrupt, covered in section 1.4). The processor is relieved of the transfer and keeps executing other instructions. Section 1.7 covers DMA in detail.</p>${/* notes paragraph: how DMA works and where sections 1.4 and 1.7 pick it up */''}
<h3>Common mistakes</h3>${/* heading for the common mistakes part of the notes */''}
<ul>${/* start of the common mistakes list */''}
<li>Thinking the PC points at the instruction currently running. It already points at the next one.</li>${/* common mistake: thinking the PC points at the running instruction */''}
<li>Calling a jump “data processing”. It changes the PC, so it is a control instruction.</li>${/* common mistake: calling a jump data processing */''}
<li>Thinking the loop needs help to continue. After every execute, the next fetch starts by itself; only a halt stops it.</li>${/* common mistake: thinking the loop needs help to continue */''}
</ul>`,  // end of the list and the end of the notes text
  });  // closes the section object and the Guide.section call
})();  // closes and immediately runs the wrapper function opened at the top of the file
