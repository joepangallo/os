// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Chapter metadata: titles, colours, overview text and objectives.
   Section content lives in sections/<id>.js. */
Guide.chapter({  // registers chapter 1 with the guide; Guide.chapter (in the shell script) stores this object and adds its CSS to the page
  num: 1,  // num: the chapter number; it sets the chapter's order, its color (--ch1) and its page addresses such as #ch1
  title: 'Computer System Overview',  // title shown on the chapter card, the chapter overview page and the top-bar tooltip
  tagline: 'You cannot understand a manager without knowing what it manages. First, meet the machine.',  // tagline: the one-sentence hook printed in the chapter color at the top of the chapter overview page
  intro: '<p>An operating system is software that runs on real hardware and spends its whole life managing that hardware. This chapter opens the box: the four basic parts of a computer, how the processor grew from one simple chip into today’s chips that hold several processors (called cores), how it runs one instruction after another, and how <span class="t">interrupts</span> let slow devices call for attention. It then shows why memory is built in layers, from small and fast to big and slow, with a <span class="t" data-t="Cache memory">cache</span> at the top; how <span class="t">direct memory access</span> lets a device move bulk data without the processor; and how several processors or cores share one machine.</p>',  // intro paragraph for the overview page; the span class="t" words are key terms that show a definition when pointed at
  objectives: [  // objectives: the list shown under "After this chapter you will be able to" on the overview page and in the printed guide
    'Name the basic elements of a computer and describe how the system bus connects them.',  // objective 1: name the basic parts of a computer and the bus that links them
    'Describe how the microprocessor grew into multicore systems on a chip.',  // objective 2: how the microprocessor grew into multicore chips
    'Trace the fetch and execute steps a processor repeats for every instruction.',  // objective 3: trace the fetch and execute steps of each instruction
    'Explain what an interrupt is and why it keeps the processor from wasting time.',  // objective 4: what an interrupt is and why it saves processor time
    'Use locality to explain the memory hierarchy and how a cache speeds up memory access.',  // objective 5: locality, the memory hierarchy and how a cache helps
    'Compare programmed I/O, interrupt-driven I/O and direct memory access (DMA).',  // objective 6: compare the three ways of doing I/O (programmed, interrupt-driven and DMA)
    'Describe symmetric multiprocessors and multicore chips.',  // objective 7: symmetric multiprocessors and multicore chips
  ],  // closes the objectives list
  terms: [  // terms: chapter-level glossary entries as [term, definition] pairs; a section's own definition wins if both exist
    ['Operating system (OS)', 'The software that manages a computer\'s hardware resources and provides services and a convenient environment for application programs.'],  // glossary entry: defines the operating system
    ['Interrupt', 'A signal that makes the processor pause its current work, run a handler for some event (such as an I/O device finishing), and then resume.'],  // glossary entry: defines an interrupt
    ['Processor', 'The part of the computer that fetches instructions from memory and carries them out; when there is only one, it is often called the CPU.'],  // glossary entry: defines the processor (CPU)
    ['Register', 'A tiny, very fast storage slot inside the processor that holds a value, an address or control information the processor is working with right now.'],  // glossary entry: defines a register
    ['Program counter (PC)', 'The processor register that holds the memory address of the next instruction to fetch.'],  // glossary entry: defines the program counter
    ['Instruction register (IR)', 'The processor register that holds the instruction currently being decoded and executed.'],  // glossary entry: defines the instruction register
    ['Main memory', 'The volatile memory that holds the instructions and data of running programs, organised as a row of numbered cells; a cell’s number is its address.'],  // glossary entry: defines main memory and what an address is
    ['System bus', 'The shared set of wires that carries addresses, data and control signals between the processor, main memory and I/O modules.'],  // glossary entry: defines the system bus
    ['I/O module', 'The hardware that connects the computer to an external device such as a disk or keyboard and moves data between them, using small buffers.'],  // glossary entry: defines an I/O module
    ['Cache memory', 'A small, fast memory between the processor and main memory that keeps copies of recently used memory contents so that most accesses finish quickly.'],  // glossary entry: defines cache memory
    ['Direct memory access (DMA)', 'A way of moving a block of data between an I/O device and main memory without the processor handling each word; the processor is interrupted once when the block is done.'],  // glossary entry: defines direct memory access (DMA)
    ['Core', 'One complete processor (registers, control and execution unit) on a chip that may hold several of them; a chip with two or more is a multicore chip.'],  // glossary entry: defines a core and a multicore chip
    ['Secondary memory', 'Large, permanent, much slower storage such as a disk or solid-state drive, reached through an I/O module rather than directly by the processor.'],  // glossary entry: defines secondary memory (disks and drives)
  ],  // closes the terms list
  css: ` /* css: style rules used only by chapter 1's overview steps; each rule starts with .sec-ch1, the class the canvas gets on these steps */
    .sec-ch1 .ch1-mapwrap { display: grid; place-items: center; padding: 8px 10px; } /* .ch1-mapwrap: centers the clickable computer diagram inside its card with a little padding */
    .sec-ch1 .ch1-hot { cursor: pointer; transition: opacity .2s; outline: none; } /* .ch1-hot: each clickable part of the diagram shows a hand cursor and fades smoothly; the default focus outline is removed */
    .sec-ch1 .ch1-hot:hover .fr, .sec-ch1 .ch1-hot:focus-visible .fr { stroke-width: 3.5; } /* hovering or keyboard-focusing a part thickens its outline (the .fr shape) so the student sees what they will pick */
    .sec-ch1 .ch1-map.picked .ch1-hot:not(.sel) { opacity: .35; } /* once a part is picked, every other part fades to 35% so the chosen one stands out */
    .sec-ch1 .ch1-hot.sel .fr { stroke-width: 4; } /* the chosen part keeps an even thicker outline */
    .sec-ch1 .ch1-info { min-height: 296px; } /* .ch1-info: the explanation card keeps a minimum height so the buttons under it do not jump between parts */
    .sec-ch1 .ch1-four .box { font-size: 15px; padding: 6px 8px; } /* the four "basic element" boxes in the overview card use slightly smaller text and padding */
    .sec-ch1 .ch1-four { margin: 4px 0 10px; gap: 8px; } /* spacing around the grid of four basic-element boxes */
    .sec-ch1 .ch1-relax { margin-top: 10px; padding: 6px 10px; border-radius: 8px; background: var(--panel-2); color: var(--ink-2); } /* .ch1-relax: the reassuring "do not worry about these names yet" note, on a light tinted strip */
    .sec-ch1 .ch1-sec { background: color-mix(in srgb, var(--chc) 14%, var(--panel)); color: var(--ink); } /* .ch1-sec: the section tags under each part, tinted with a light wash of the chapter color */
    .sec-ch1 .ch1-secs { margin-top: 4px; } /* a little space above the row of section tags */
    .sec-ch1 .ch1-bars { display: flex; flex-direction: column; gap: 8px; } /* .ch1-bars: the column of speed rows in step 2, stacked with 8px gaps */
    .sec-ch1 .ch1-row { display: grid; grid-template-columns: 150px minmax(0, 1fr) 150px; align-items: center; gap: 12px; padding: 13px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel-2); cursor: pointer; text-align: left; font-size: 15px; color: var(--ink); } /* .ch1-row: one clickable speed row laid out as name, bar and value in three columns */
    .sec-ch1 .ch1-row:hover { border-color: var(--chc); } /* hovering a speed row outlines it in the chapter color */
    .sec-ch1 .ch1-row.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); } /* the selected speed row gets a chapter-colored outline and a light tint of the same color */
    .sec-ch1 .ch1-name { font-weight: 700; } /* .ch1-name: the device name at the left of each row is bold */
    .sec-ch1 .ch1-track { height: 14px; border-radius: 99px; background: var(--panel-3); overflow: hidden; } /* .ch1-track: the rounded grey track that holds each speed bar */
    .sec-ch1 .ch1-track > i { display: block; height: 100%; border-radius: 99px; transition: width .3s; } /* the colored bar inside the track; its width is set by the script and changes smoothly */
    .sec-ch1 .ch1-val { font-size: 14px; text-align: right; color: var(--ink-2); } /* .ch1-val: the time value at the right of each row, right-aligned in secondary text */
    @media (max-width: 760px) { /* @media (max-width: 760px): these rules apply only when the window is 760px wide or less */
      .sec-ch1 .ch1-row { grid-template-columns: minmax(0, 1fr) auto; row-gap: 4px; } /* on a small window each row keeps the name and value on the first line */
      .sec-ch1 .ch1-track { grid-column: 1 / -1; grid-row: 2; } /* and moves the bar onto its own second line across the full row */
    } /* ends the small-window rules */
    .sec-ch1 .ch1-ans { font-size: 14.5px; line-height: 1.4; padding: 6px 12px; border-radius: 10px; border-left: 5px solid var(--line-2); background: var(--panel-2); } /* .ch1-ans: the three "answer" boxes in step 2, each with a thick colored left edge */
    .sec-ch1 .ch1-ans.intr { border-left-color: var(--intr); } .sec-ch1 .ch1-ans.intr b { color: var(--intr); } /* the "Do not wait" box is marked in interrupt red, including its bold heading */
    .sec-ch1 .ch1-ans.mem { border-left-color: var(--mem); } .sec-ch1 .ch1-ans.mem b { color: var(--mem); } /* the "Keep it close" box is marked in memory green */
    .sec-ch1 .ch1-ans.cpu { border-left-color: var(--cpu); } .sec-ch1 .ch1-ans.cpu b { color: var(--cpu); } /* the "Add workers" box is marked in processor blue */
  `,  // end of chapter 1's CSS text
  steps: [  // steps: the chapter's own overview steps, shown right after the chapter page and before section 1.1
    {  // step 1 of the chapter 1 overview
      title: 'A computer at a glance: click every part',  // title shown at the top of step 1
      kind: 'story',  // kind "story" labels the step "Big Picture" and keeps it on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the step when it is shown; el is the empty step area, ctx holds the shell's helpers
        const { h } = ctx;  // h is the helper that builds an HTML element from a tag name, attributes and children
        const SEC = { '1.1': 'Basic Elements', '1.2': 'Evolution of the Microprocessor', '1.3': 'Instruction Execution', '1.4': 'Interrupts', '1.5': 'The Memory Hierarchy', '1.6': 'Cache Memory', '1.7': 'Direct Memory Access', '1.8': 'Multiprocessor and Multicore', ch2: 'Chapter 2: OS Overview' };  // SEC: section numbers mapped to their titles, used to label the "where you will learn it" tags
        const PARTS = [  // PARTS: the ten clickable parts of the computer diagram, each with its color, short tag, explanation and picture
          { id: 'registers', name: 'Registers', col: 'cpu', tag: 'inside the processor',  // part "registers": processor storage, drawn in processor blue
            what: 'Tiny storage slots built into the processor, far faster than memory. The <b>program counter (PC)</b> holds the address of the next instruction; the <b>instruction register (IR)</b> holds the one being carried out. The <b>memory address register (MAR)</b> and <b>memory buffer register (MBR)</b> hold the address and the data of one memory read or write. I/O AR and I/O BR (I/O address and I/O buffer registers) do the same job for a device.',  // explanation of registers: the PC, IR, MAR, MBR and the two I/O registers
            pic: 'The notepad in your hand, compared with a filing cabinet down the hall.', secs: ['1.1', '1.3'] },  // everyday picture for registers (a notepad) and the sections that teach them
          { id: 'alu', name: 'Execution unit (ALU)', col: 'cpu', tag: 'inside the processor',  // part "alu": the execution unit
            what: 'The circuitry that actually computes. Its main part is the <b>arithmetic logic unit (ALU)</b>, which adds, subtracts, compares and shifts values held in registers. The processor spends its entire life in one loop: fetch the next instruction from memory, then execute it here.',  // explanation of the execution unit and its arithmetic logic unit
            pic: 'The calculator on the desk: fast, but useless until someone hands it numbers.', secs: ['1.1', '1.3'] },  // everyday picture (a desk calculator) and the sections that teach it
          { id: 'cores', name: 'More cores', col: 'cpu', tag: 'multicore chip',  // part "cores": the extra processors on a multicore chip
            what: 'A modern chip usually holds several complete processors, called <b>cores</b>. Each core has its own registers and execution unit, and all of them share one main memory. Keeping every core busy without letting them collide becomes the operating system\'s problem.',  // explanation of cores sharing one main memory
            pic: 'Four cooks sharing one pantry: more cooking gets done, but they must not grab the same jar at once.', secs: ['1.2', '1.8'] },  // everyday picture (cooks sharing a pantry) and the sections that teach cores
          { id: 'cache', name: 'Cache', col: 'mem', tag: 'small and very fast',  // part "cache": small, fast memory, drawn in memory green
            what: 'A small, very fast memory that keeps copies of the memory contents the processor used recently, betting that it will need them again soon. When the bet pays off (a <b>hit</b>) the slow trip to main memory is skipped. The hardware decides what to copy in and what to replace, without help from programs.',  // explanation of the cache and what a hit is
            pic: 'The few books you keep on your desk instead of walking to the library each time.', secs: ['1.5', '1.6'] },  // everyday picture (books on your desk) and the sections that teach caching
          { id: 'memory', name: 'Main memory', col: 'mem', tag: 'big, slower, volatile',  // part "memory": main memory
            what: 'Holds the instructions and data of every running program in numbered cells; a cell’s number is its <b>address</b>. It is volatile: cut the power and it forgets everything. Far larger than the cache, but each access costs the processor many cycles of waiting.',  // explanation of main memory, addresses and volatility
            pic: 'A long wall of numbered mailboxes; the address tells you which box to open.', secs: ['1.1', '1.5'] },  // everyday picture (numbered mailboxes) and the sections that teach memory
          { id: 'os', name: 'The operating system', col: 'os', tag: 'software, not a box',  // part "os": the operating system, drawn in OS purple
            what: 'There is no separate OS chip. The OS is a program: its core, the <b>kernel</b>, sits in main memory and runs on the very same processor as your programs. It gets control back whenever an interrupt fires or a program asks it for a service.',  // explanation that the OS is software whose kernel lives in memory
            pic: 'A stage manager who is also one of the actors, stepping in between scenes.', secs: ['1.4', 'ch2'] },  // everyday picture (a stage manager who also acts) and where it is taught
          { id: 'bus', name: 'System bus', col: 'accent', tag: 'the shared highway',  // part "bus": the system bus, drawn in the accent color
            what: 'The set of shared wires that links the processor, memory and I/O modules. It carries three kinds of signal: <b>address</b> lines (where), <b>data</b> lines (what) and <b>control</b> lines (read or write, and when). Only one transfer can use it at a time.',  // explanation of the address, data and control lines
            pic: 'A single road between the factory, the warehouse and the loading dock.', secs: ['1.1'] },  // everyday picture (a single road) and the section that teaches the bus
          { id: 'io', name: 'I/O modules and devices', col: 'io', tag: 'the outside world',  // part "io": I/O modules and their devices, drawn in I/O orange
            what: 'Each I/O module looks after one kind of external device: a disk, the keyboard, the screen, the network. It has small buffers that hold data in transit. Disks also serve as <b>secondary memory</b>: huge and permanent, but thousands of times slower than main memory.',  // explanation of I/O modules, buffers and secondary memory
            pic: 'The loading dock, where goods enter and leave the factory at their own slow pace.', secs: ['1.1', '1.5', '1.7'] },  // everyday picture (a loading dock) and the sections that teach I/O
          { id: 'interrupt', name: 'Interrupt request line', col: 'intr', tag: 'a tap on the shoulder',  // part "interrupt": the interrupt request line, drawn in interrupt red
            what: 'A signal from an I/O module to the processor. Instead of the processor asking "are you done yet?" over and over, the device raises an <b>interrupt</b> when it needs attention. The processor finishes its current instruction, runs a short piece of OS code for the event (its <b>handler</b>), then carries on where it left off.',  // explanation of how a device raises an interrupt and the handler runs
            pic: 'A doorbell: you get on with your work until it rings, instead of checking the door every minute.', secs: ['1.4'] },  // everyday picture (a doorbell) and the section that teaches interrupts
          { id: 'dma', name: 'Direct memory access (DMA)', col: 'io', tag: 'bulk transfers',  // part "dma": direct memory access
            what: 'For a large transfer, such as reading a whole file, a DMA module copies the data straight between the device and main memory over the bus. The processor only sets the transfer up, goes back to useful work, and receives one interrupt when the whole block has arrived.',  // explanation of how a DMA module moves a whole block without the processor
            pic: 'Hiring movers: you write down what goes where, then carry on while they haul the boxes.', secs: ['1.7'] },  // everyday picture (hiring movers) and the section that teaches DMA
        ];  // closes the PARTS list
        const hot = (id, inner) => `<g class="hot ch1-hot" data-part="${id}" tabindex="0" role="button" aria-label="${PARTS.find((p) => p.id === id).name}">${inner}</g>`;  // hot(id, inner): wraps one part's drawing in an SVG group that can be clicked or reached with Tab, labeled with the part's name
        const reg = (x, y, t) => `<rect x="${x}" y="${y}" width="74" height="26" rx="6" class="s-panel"/><text x="${x + 37}" y="${y + 18}" text-anchor="middle" class="s-monot" font-size="13" font-weight="700">${t}</text>`;  // reg(x, y, t): draws one register as a small labeled box at (x, y) in the diagram, with its name in fixed-width text
        const devs = ['Disk', 'Keyboard', 'Screen', 'Network'].map((d, i) => `<rect x="${40 + i * 66}" y="424" width="58" height="36" rx="8" class="s-io" stroke-width="1.5"/><text x="${69 + i * 66}" y="447" text-anchor="middle" font-size="13">${d === 'Keyboard' ? 'Keys' : d}</text><line x1="${69 + i * 66}" y1="404" x2="${69 + i * 66}" y2="424" class="s-line" stroke-width="1.5"/>`).join('');  // devs: draws the four device boxes (disk, keys, screen, network) under the I/O module, each joined to it by a short line
        const svg = `${/* svg: the computer diagram written as SVG text (SVG is the browser's drawing format); the ${...} parts insert drawings made above */''}
<svg viewBox="0 0 660 476" width="100%" class="ch1-map" role="img" aria-label="Diagram of a computer: processor chip, main memory, system bus and I/O modules">${/* the drawing's coordinate box is 660 x 476 and it stretches to its card's width; the label describes it for screen readers */''}
  <rect x="40" y="6" width="384" height="224" rx="16" class="s-panel" stroke-dasharray="6 4"/>${/* dashed outline around everything that sits on the processor chip */''}
  <text x="54" y="25" font-size="13" font-weight="800" class="s-sub">PROCESSOR CHIP</text>${/* small grey "PROCESSOR CHIP" label at the top-left of that outline */''}
  ${hot('registers', `<rect class="fr s-cpu" x="54" y="34" width="172" height="136" rx="10" stroke-width="2"/><text x="66" y="54" font-size="14" font-weight="800">Registers</text>${reg(66, 64, 'PC')}${reg(144, 64, 'IR')}${reg(66, 98, 'MAR')}${reg(144, 98, 'MBR')}${reg(66, 132, 'I/O AR')}${reg(144, 132, 'I/O BR')}`)}${/* clickable part: the registers box holding the six registers PC, IR, MAR, MBR, I/O AR and I/O BR */''}
  ${hot('alu', `<rect class="fr s-cpu" x="236" y="34" width="90" height="136" rx="10" stroke-width="2"/><text x="281" y="90" text-anchor="middle" font-size="14" font-weight="800">Execution</text><text x="281" y="108" text-anchor="middle" font-size="14" font-weight="800">unit</text><text x="281" y="128" text-anchor="middle" font-size="13" class="s-sub">(ALU)</text>`)}${/* clickable part: the execution unit (ALU) box next to the registers */''}
  ${hot('cores', `<rect class="fr s-panel" x="334" y="34" width="80" height="136" rx="10" stroke-width="1.5" stroke-dasharray="4 3"/>${[0, 1, 2].map((k) => `<rect x="342" y="${42 + k * 42}" width="64" height="34" rx="7" class="s-cpu" stroke-width="1.5"/><text x="374" y="${64 + k * 42}" text-anchor="middle" font-size="13" font-weight="700">Core ${k + 2}</text>`).join('')}`)}${/* clickable part: a dashed box with Core 2, Core 3 and Core 4, standing for the extra cores on the chip */''}
  ${hot('cache', `<rect class="fr s-mem" x="54" y="180" width="360" height="40" rx="10" stroke-width="2"/><text x="234" y="205" text-anchor="middle" font-size="14" font-weight="700">Cache: fast copies of recently used memory</text>`)}${/* clickable part: the cache strip along the bottom of the processor chip */''}
  ${hot('memory', `<rect class="fr s-mem" x="448" y="6" width="204" height="224" rx="14" stroke-width="2"/><text x="550" y="28" text-anchor="middle" font-size="15" font-weight="800">Main memory</text>${/* clickable part: the main memory box, which continues on the next lines */''}
    <rect x="462" y="94" width="176" height="40" rx="7" class="s-panel"/><text x="550" y="119" text-anchor="middle" font-size="13">program instructions</text>${/* inside main memory: the area for program instructions */''}
    <rect x="462" y="140" width="176" height="36" rx="7" class="s-panel"/><text x="550" y="163" text-anchor="middle" font-size="13">program data</text>${/* inside main memory: the area for program data */''}
    <rect x="462" y="182" width="176" height="36" rx="7" class="s-panel" stroke-dasharray="4 3"/><text x="550" y="205" text-anchor="middle" font-size="13" class="s-sub">free space</text>`)}${/* inside main memory: dashed free space, which closes the main memory part */''}
  ${hot('os', `<rect class="fr s-os" x="462" y="40" width="176" height="48" rx="8" stroke-width="2"/><text x="550" y="61" text-anchor="middle" font-size="14" font-weight="800">OS kernel</text><text x="550" y="79" text-anchor="middle" font-size="13" class="s-sub">code + tables</text>`)}${/* clickable part: the OS kernel block at the top of main memory (its code and tables) */''}
  <line x1="232" y1="230" x2="232" y2="262" class="s-line" stroke-width="3"/>${/* short vertical line joining the processor chip to the bus */''}
  <line x1="550" y1="230" x2="550" y2="262" class="s-line" stroke-width="3"/>${/* short vertical line joining main memory to the bus */''}
  <line x1="170" y1="296" x2="170" y2="330" class="s-line" stroke-width="3"/>${/* short vertical line joining the bus to the I/O module */''}
  ${hot('bus', `<rect class="fr s-accent" x="40" y="262" width="612" height="34" rx="17" stroke-width="2"/><text x="346" y="284" text-anchor="middle" font-size="14" font-weight="800">System bus: address · data · control lines</text>`)}${/* clickable part: the system bus, a long rounded bar labeled with its address, data and control lines */''}
  ${hot('io', `<rect class="fr s-io" x="40" y="330" width="260" height="74" rx="12" stroke-width="2"/><text x="56" y="356" font-size="15" font-weight="800">I/O module</text><text x="56" y="378" font-size="13" class="s-sub">talks to devices</text>${[0, 1, 2, 3].map((k) => `<rect x="${186 + k * 26}" y="352" width="20" height="26" rx="4" class="s-panel"/>`).join('')}<text x="236" y="394" text-anchor="middle" font-size="13" class="s-sub">buffers</text>${devs}`)}${/* clickable part: the I/O module with its four little buffers and the devices drawn by devs */''}
  ${hot('interrupt', `<path d="M40 367 H20 V104 H50" fill="none" stroke="transparent" stroke-width="16"/><path class="fr" d="M40 367 H20 V104 H48" fill="none" style="stroke:var(--intr)" stroke-width="2.5" stroke-dasharray="7 5" marker-end="url(#arr-intr)"/><text x="12" y="236" transform="rotate(-90 12 236)" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--intr)">interrupt request</text>`)}${/* clickable part: the dashed red interrupt line from the I/O module up to the registers; a wide see-through copy makes it easy to click */''}
  ${hot('dma', `<path d="M300 346 H592 V236" fill="none" stroke="transparent" stroke-width="16"/><path class="fr" d="M300 346 H592 V238" fill="none" style="stroke:var(--io)" stroke-width="3" stroke-dasharray="9 5" marker-end="url(#arr-io)"/><text x="446" y="336" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--io)">DMA transfer</text><text x="446" y="366" text-anchor="middle" font-size="13" class="s-sub">device ↔ memory, no CPU</text>`)}${/* clickable part: the dashed orange DMA arrow from the I/O module straight to main memory, also with a wide click area */''}
  <text x="490" y="430" text-anchor="middle" font-size="14" class="s-sub">Click any part to learn</text>${/* hint text in the empty corner, first line: click any part */''}
  <text x="490" y="450" text-anchor="middle" font-size="14" class="s-sub">what it does.</text>${/* hint text, second line */''}
</svg>`;  // end of the diagram's SVG text
        const info = h('div', { class: 'card white ch1-info', 'aria-live': 'polite' });  // info: the card on the right that explains the part the student picked; aria-live makes screen readers read changes aloud
        const count = h('span', { class: 'small muted' });  // count: the small "Part 3 of 10" label next to the tour buttons
        let cur = -1;  // cur: which part is shown now; -1 means the overview of the four basic elements
        const chips = (secs) => secs.map((s) => `<span class="chip ch1-sec">${s === 'ch2' ? '' : s + ' '}${SEC[s]}</span>`).join(' ');  // chips(secs): turns a list of section numbers into tags like "1.4 Interrupts" (chapter 2's tag shows its title only)
        function show(i) {  // show(i): shows part i in the info card and highlights it in the diagram; show(-1) shows the overview instead
          cur = i;  // remembers the choice so Next and Previous know where to go from
          const map = el.querySelector('.ch1-map');  // finds the diagram inside this step
          map.classList.toggle('picked', i >= 0);  // marks the diagram as "picked" when a part is chosen, which fades the other parts (see the CSS above)
          el.querySelectorAll('.ch1-hot').forEach((g) => g.classList.toggle('sel', i >= 0 && g.dataset.part === PARTS[i].id));  // gives the chosen part the "sel" class for its thick outline and takes it off every other part
          if (i < 0) {  // no part chosen: fill the info card with the overview
            info.innerHTML = `<h3>Four basic elements</h3>${/* overview heading: the four basic elements */''}
              <p class="small">Every computer is built from four kinds of part:</p>${/* overview text: every computer has four kinds of part */''}
              <div class="grid-2 ch1-four"><span class="box cpu">Processor</span><span class="box mem">Main memory</span><span class="box io">I/O modules</span><span class="box">System bus</span></div>${/* overview boxes: processor, main memory, I/O modules and system bus, each in its own color */''}
              <p class="small m0">The <span class="t">operating system</span> is not a fifth box: it is software in memory that runs on the processor and manages the rest.</p>${/* overview text: the OS is software in memory, not a fifth box */''}
              <p class="small m0 ch1-relax"><b>PC, MAR, ALU, DMA…?</b> Do not worry about these names yet. Each part tells you which section (1.1 to 1.8) teaches it.</p>`;  // overview note: do not worry about the register and unit names yet; each part names its section
            count.textContent = PARTS.length + ' parts to explore';  // the counter tells the student how many parts there are to explore
          } else {  // a part was chosen: fill the info card with that part's details
            const p = PARTS[i];  // p is the chosen part's entry in PARTS
            info.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="m0">${p.name}</h3><span class="chip ${p.col}">${p.tag}</span></div>${/* part card header: the part's name with its colored tag on the right */''}
              <p class="small mt">${p.what}</p>${/* part card text: the explanation */''}
              <p class="small muted"><b>Picture it:</b> ${p.pic}</p>${/* part card text: the everyday picture */''}
              <div class="xs muted b">WHERE YOU WILL LEARN IT</div><div class="row gap-s ch1-secs">${chips(p.secs)}</div>`;  // part card footer: "Where you will learn it" and the section tags
            count.textContent = `Part ${i + 1} of ${PARTS.length}`;  // the counter shows which part this is out of ten
          }  // ends the if/else
          ctx.refit();  // asks the shell to re-check that the step still fits now that the card's text changed
        }  // ends show()
        const tourNext = h('button', { class: 'btn primary sm', type: 'button', onclick: () => show((cur + 1) % PARTS.length) }, 'Next part ▶');  // "Next part" button: moves to the following part, wrapping back to the first after the last
        const tourPrev = h('button', { class: 'btn sm', type: 'button', onclick: () => show(cur <= 0 ? PARTS.length - 1 : cur - 1) }, '◀ Previous');  // "Previous" button: moves to the part before, wrapping to the last one from the overview or the first part
        const reset = h('button', { class: 'btn sm', type: 'button', onclick: () => show(-1) }, 'Overview');  // "Overview" button: goes back to the four basic elements
        count.style.marginLeft = 'auto';  // pushes the counter to the far right of its row
        const left = h('div', { class: 'card white ch1-mapwrap', html: svg });  // left: the white card holding the diagram
        const right = h('div', { class: 'stack' },  // right: the column with the lead sentence, the info card, the tour buttons and a callout
          h('p', { class: 'lead m0' }, 'An OS manages hardware, so start by meeting the hardware.'),  // lead sentence: meet the hardware first
          info,  // the info card built above
          h('div', { class: 'row' }, tourPrev, tourNext, reset, count),  // the row of tour buttons and the counter
          h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Every later chapter is about sharing these few parts among many programs at once: processor time, memory space and I/O devices.' }));  // "Why it matters" callout: later chapters are about sharing these parts among many programs
        el.append(h('div', { class: 'split r fill' }, left, right));  // puts the two columns on screen, the diagram on the larger left side
        el.querySelectorAll('.ch1-hot').forEach((g) => {  // wires up every clickable part of the diagram after it is on screen
          const i = PARTS.findIndex((p) => p.id === g.dataset.part);  // finds which PARTS entry this drawing belongs to from its data-part attribute
          ctx.on(g, 'click', () => show(i));  // clicking the part shows it; ctx.on also removes the listener when the student leaves the step
          ctx.on(g, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); } });  // pressing Enter or Space on a focused part shows it too, so the diagram works from the keyboard
        });  // ends the loop over clickable parts
        show(-1);  // starts on the overview when the step first opens
      },  // ends render() for step 1
    },  // closes step 1
    {  // step 2 of the chapter 1 overview
      title: 'The speed gap that shapes this whole chapter',  // title shown at the top of step 2
      kind: 'explore',  // kind "explore" labels the step "Explore"
      render(el, ctx) {  // render(el, ctx): builds the speed-gap step when it is shown
        const { h } = ctx;  // takes the element-building helper h out of ctx
        // typical orders of magnitude, in nanoseconds; human scale stretches 1 ns into 1 second
        const ROWS = [  // ROWS: six things the processor waits for, fastest to slowest, with real and human-scale times and the fix for each
          { name: 'Register', col: 'cpu', ns: 0.3, real: '≈ 0.3 ns', human: '0.3 seconds: a blink', lost: 'none, because reading a register is part of the instruction itself', fix: 'Nothing to fix: registers sit inside the processor, which is why every instruction works on them.', secs: '1.1 · 1.3' },  // row: a register, about 0.3 ns, the only thing with no wait at all
          { name: 'Cache', col: 'mem', ns: 1, real: '≈ 1 ns', human: '1 second: a heartbeat', lost: 'about one instruction', fix: 'The cache keeps copies of recently used memory contents right next to the processor, so most accesses finish this fast.', secs: '1.5 · 1.6' },  // row: the cache, about 1 ns
          { name: 'Main memory', col: 'mem', ns: 100, real: '≈ 100 ns', human: 'about 1.7 minutes', lost: 'about 100 instructions', fix: 'Too slow to visit on every instruction. But programs tend to reuse the same data and data stored near it, so a small, fast cache holding copies hides most of the delay. Section 1.5 calls this <i>locality</i>.', secs: '1.5 · 1.6' },  // row: main memory, about 100 ns, and how locality lets a cache hide the delay
          { name: 'Solid-state drive', col: 'io', ns: 1e5, real: '≈ 100 µs', human: 'about 28 hours', lost: 'about 100,000 instructions', fix: 'The processor must never idle this long. It starts the transfer and runs other work. A helper circuit (direct memory access, DMA) copies the data into memory, then the device sends a “done” signal (an interrupt).', secs: '1.4 · 1.7' },  // row: a solid-state drive, about 100 microseconds, and why DMA and interrupts are needed
          { name: 'Hard disk', col: 'io', ns: 5e6, real: '≈ 5 ms', human: 'about 2 months', lost: 'about 5 million instructions', fix: 'Same remedy, even more important: the processor runs millions of other instructions while the disk arm moves, and a “done” signal (an interrupt) tells it when the data is ready.', secs: '1.4 · 1.7' },  // row: a hard disk, about 5 ms
          { name: 'Next keypress', col: 'io', ns: 2e8, real: '≈ 200 ms', human: 'about 6 years', lost: 'about 200 million instructions', fix: 'A human is the slowest device of all. The keyboard sends a “key pressed” signal (an interrupt) for each key, so the processor never waits for you.', secs: '1.4' },  // row: waiting for the next key press, about 200 ms, the slowest of all
        ];  // closes the ROWS list
        let mode = 'real', cur = 2;  // mode says which times are shown (real or human-scale); cur is the selected row, starting on main memory
        const pct = (ns) => Math.max(3, ((Math.log10(ns) + 1) / 9.5) * 100);  // pct(ns): turns a time into a bar length on a log scale (each step is 10x slower), never shorter than 3%
        const bars = ROWS.map((r, i) => {  // bars: builds one clickable row for each entry in ROWS
          const val = h('span', { class: 'ch1-val mono' });  // val: the time text at the right end of the row, filled in by paint()
          const b = h('button', { class: 'ch1-row', type: 'button', onclick: () => pick(i) },  // the row itself is a button, so clicking it or pressing Enter selects that device
            h('span', { class: 'ch1-name' }, r.name),  // the device's name at the left
            h('span', { class: 'ch1-track' }, h('i', { style: { width: pct(r.ns) + '%', background: `var(--${r.col})` } })),  // the bar, colored for its kind of device and sized by pct()
            val);  // the time value goes last
          b.val = val;  // keeps a handle on the value so paint() can change its text
          return b;  // gives the finished row back to the list
        });  // ends the list of rows
        const detail = h('div', { class: 'card white', 'aria-live': 'polite' });  // detail: the card on the right that explains the selected row; screen readers read changes aloud
        function paint() {  // paint(): redraws the rows and the detail card; runs after every click or mode change
          bars.forEach((b, i) => { b.classList.toggle('on', i === cur); b.val.textContent = mode === 'real' ? ROWS[i].real : ROWS[i].human.split(':')[0]; });  // highlights the selected row and writes each row's time in the chosen mode (only the part before the colon for human-scale)
          const r = ROWS[cur];  // r is the selected row's data

          detail.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="m0">${r.name}</h3><span class="chip ${r.col}">${r.real}</span></div>${/* detail card header: the device name with its real time in a colored tag */''}
            <p class="small mt m0"><b>At human scale:</b> ${r.human}.</p>${/* detail card text: the same wait stretched to human scale */''}
            <p class="small"><b>Work lost per wait:</b> ${r.lost}.</p>${/* detail card text: how many instructions the processor could have run while waiting */''}
            <p class="small m0"><b>What this chapter does about it:</b> ${r.fix}</p>${/* detail card text: what this chapter does about that wait */''}
            <div class="xs muted b mt">LEARN IT IN SECTION ${r.secs}</div>`;  // detail card footer: which sections teach it
          ctx.refit();  // asks the shell to re-check that the step still fits after the text changed
        }  // ends paint()
        function pick(i) { cur = i; paint(); }  // pick(i): selects row i and redraws; called when a row is clicked
        const seg = ctx.ui.seg([{ value: 'real', label: 'Real time' }, { value: 'human', label: 'If 1 ns lasted 1 second' }], mode, (v) => { mode = v; paint(); });  // seg: the two-option switch (Real time / If 1 ns lasted 1 second); choosing one changes mode and redraws
        const left = h('div', { class: 'stack' },  // left: the column with the lead sentence, the switch and the speed rows
          h('p', { class: 'lead m0' }, 'The processor is fast, and almost everything it talks to is slow. How slow? Click a row to find out.'),  // lead sentence: the processor is fast and almost everything else is slow
          h('div', { class: 'row' }, seg, h('span', { class: 'xs muted' }, 'Typical values, log-scale bars, about one simple instruction per ns.')),  // the switch next to a small note about how the values and bars were chosen
          h('div', { class: 'ch1-bars' }, ...bars));  // the column of six speed rows
        const right = h('div', { class: 'stack' },  // right: the column with the detail card and the three kinds of answer
          detail,  // the detail card built above
          h('h4', { class: 'm0' }, 'Three answers you will meet'),  // small heading over the three answers
          h('div', { class: 'ch1-ans intr', html: '<b>Do not wait.</b> Slow devices work in the background and signal when done (interrupts, DMA). <span class="xs muted">1.4 · 1.7</span>' }),  // answer box 1 (interrupt red): do not wait, let slow devices signal when done
          h('div', { class: 'ch1-ans mem', html: '<b>Keep it close.</b> Copy busy data into a small, fast cache. <span class="xs muted">1.5 · 1.6</span>' }),  // answer box 2 (memory green): keep busy data close in a cache
          h('div', { class: 'ch1-ans cpu', html: '<b>Add workers.</b> Put several processors (cores) in one machine. <span class="xs muted">1.8</span>' }),  // answer box 3 (processor blue): add more processors or cores
          h('div', { class: 'callout warn m0', style: { fontSize: '15px' }, 'data-label': 'The key insight', html: 'A processor that stops to wait for a disk wastes millions of instructions. Most designs in this chapter exist to prevent that.' }));  // "The key insight" warning callout: waiting for a disk wastes millions of instructions
        el.append(h('div', { class: 'split r fill' }, left, right));  // puts the two columns on screen, the rows on the larger left side
        paint();  // draws the first picture, with main memory selected
      },  // ends render() for step 2
    },  // closes step 2
  ],  // closes chapter 1's steps list
  notes: `${/* notes: the chapter 1 summary shown in the Notes drawer (N key) on the overview steps */''}
    <h3>How Chapter 1 fits together</h3>${/* notes heading: how chapter 1 fits together */''}
    <p>An operating system is a manager, and this chapter introduces what it manages. Everything here is hardware, but each topic returns later as an OS problem.</p>${/* notes paragraph: the OS is a manager, and this chapter meets what it manages */''}
    <h4>The parts (1.1, 1.2)</h4>${/* notes heading: the parts (sections 1.1 and 1.2) */''}
    <p>A computer has four basic elements. The <b>processor</b> does the work, using <b>registers</b> (tiny, very fast storage slots such as the program counter and instruction register). <b>Main memory</b> holds running programs and their data. <b>I/O modules</b> connect external devices such as disks, keyboards and network cards. The <b>system bus</b> ties them together by carrying addresses, data and control signals. Section 1.2 shows how the processor grew from one simple chip into chips holding several cores, graphics units and other specialised processors.</p>${/* notes paragraph: the four basic elements, registers, and the growth of the processor */''}
    <h4>The heartbeat (1.3, 1.4)</h4>${/* notes heading: the heartbeat (sections 1.3 and 1.4) */''}
    <p>A processor repeats one loop for its whole life: <b>fetch</b> the instruction whose address is in the program counter, then <b>execute</b> it. Section 1.4 adds a third stage to that loop: after each instruction the processor checks for an <b>interrupt</b>. Interrupts let a slow device announce that it has finished, so the processor can run other programs instead of waiting. The same mechanism is how the OS regains control, which makes it the foundation for everything in Chapters 2 to 5.</p>${/* notes paragraph: the fetch-execute loop and the interrupt check added to it */''}
    <h4>The speed gap (1.5, 1.6)</h4>${/* notes heading: the speed gap (sections 1.5 and 1.6) */''}
    <p>Fast memory is expensive and small; cheap memory is large and slow. The <b>memory hierarchy</b> stacks them: registers, cache, main memory, then disks. It works because programs show <b>locality</b>: they tend to reuse the same and nearby addresses. A <b>cache</b> exploits locality by keeping copies of recently used memory blocks next to the processor, so most accesses finish at cache speed.</p>${/* notes paragraph: the memory hierarchy, locality and the cache */''}
    <h4>Moving data in bulk (1.7)</h4>${/* notes heading: moving data in bulk (section 1.7) */''}
    <p>There are three ways to do I/O. With <b>programmed I/O</b> the processor keeps checking the device and wastes its time. With <b>interrupt-driven I/O</b> it does other work until the device interrupts, but it still copies every word itself. With <b>direct memory access (DMA)</b> a separate module copies a whole block between the device and memory, and the processor is interrupted only once at the end.</p>${/* notes paragraph: programmed I/O, interrupt-driven I/O and DMA compared */''}
    <h4>More than one processor (1.8)</h4>${/* notes heading: more than one processor (section 1.8) */''}
    <p>A <b>symmetric multiprocessor</b> has several similar processors sharing one memory and one set of I/O devices, all controlled by one OS. A <b>multicore</b> chip puts several such processors (cores) on one chip, often with some cache levels shared. More processors mean more work at once, and also a new problem that Chapters 4 and 5 tackle: keeping them from interfering with each other.</p>${/* notes paragraph: symmetric multiprocessors and multicore chips */''}
    <h4>The common theme</h4>${/* notes heading: the common theme */''}
    <p>The processor is far faster than memory and devices. Interrupts and DMA stop it from waiting on devices, the cache stops it from waiting on memory, and multiple cores add raw capacity. An OS is built on top of all three ideas.</p>`,  // notes paragraph: interrupts, DMA, caches and cores all fight the speed gap; end of the notes text
});  // closes the chapter 1 object and the Guide.chapter call
Guide.chapter({  // registers chapter 2 with the guide
  num: 2,  // num: chapter 2, which sets its order, color (--ch2) and page addresses
  title: 'Operating System Overview',  // title shown on the chapter card, overview page and tooltip
  tagline: 'What an operating system is for, where it came from, and how real ones are built.',  // tagline printed in the chapter color on the overview page
  intro: '<p>Every operating system (OS) chases three goals: make the computer convenient to use, use its hardware efficiently, and stay able to evolve. This chapter shows how those goals drove seventy years of history, from machines with no OS at all to <span class="t" data-t="Batch system">batch</span>, <span class="t" data-t="Multiprogramming">multiprogrammed</span> and <span class="t" data-t="Time sharing">time-sharing</span> systems (each is explained in 2.2). It then covers the big ideas inside every modern OS, how systems survive faults and use many cores, and tours Windows, UNIX, Linux and Android.</p>',  // intro paragraph for the overview page; data-t names the glossary entry a short word should show
  objectives: [  // objectives shown on the overview page and in the printed guide
    'Summarize the objectives and functions of an operating system.',  // objective 1: the objectives and functions of an OS
    'Trace the evolution from serial processing to batch, multiprogrammed and time-sharing systems.',  // objective 2: the path from serial processing to batch, multiprogramming and time sharing
    'Explain the major achievements: processes, memory management, protection and security, and scheduling.',  // objective 3: the major achievements: processes, memory management, protection and scheduling
    'Describe the developments that led to modern operating systems and how systems tolerate faults.',  // objective 4: the developments behind modern systems and how they tolerate faults
    'Discuss OS design issues for multiprocessor and multicore computers.',  // objective 5: OS design issues for multiprocessor and multicore machines
    'Compare the structure of Windows, traditional and modern UNIX, Linux and Android.',  // objective 6: compare Windows, UNIX, Linux and Android
  ],  // closes the objectives list
  terms: [  // chapter 2's glossary entries as [term, definition] pairs
    ['Kernel', 'The central part of the operating system that stays in main memory and holds its most frequently used functions; it runs with full access to the hardware.'],  // glossary entry: defines the kernel
    ['Application programming interface (API)', 'The set of calls a program can make, in source code, to libraries and the operating system, such as opening a file or creating a window.'],  // glossary entry: defines the application programming interface (API)
    ['Application binary interface (ABI)', 'The agreement at the level of compiled code between a program and the system: the system call interface plus the user ISA, including how arguments are passed and how data is laid out.'],  // glossary entry: defines the application binary interface (ABI)
    ['Instruction set architecture (ISA)', 'The set of machine instructions a processor understands; it is the boundary between hardware and software, with a privileged part reserved for the OS.'],  // glossary entry: defines the instruction set architecture (ISA)
    ['Utilities', 'System programs supplied with the OS, such as compilers, command shells and file tools, that make programming and managing the computer easier.'],  // glossary entry: defines utilities
    ['Serial processing', 'The earliest way of using a computer: no operating system, with each programmer booking the machine and loading and running a program by hand.'],  // glossary entry: defines serial processing
    ['Resident monitor', 'The small program at the heart of an early batch system; it stays in memory, loads each job in turn, runs it, and regains control when the job ends.'],  // glossary entry: defines the resident monitor
    ['Job control language (JCL)', 'Special instructions placed with a batch job that tell the monitor what to do, for example which compiler to load and which data to use.'],  // glossary entry: defines job control language (JCL)
    ['Batch system', 'A system that collects jobs into a batch and runs them one after another under the control of a monitor program, with no human operator between jobs.'],  // glossary entry: defines a batch system
    ['Multiprogramming', 'Keeping several programs in main memory at once and switching the processor to another one whenever the running program must wait, typically for I/O.'],  // glossary entry: defines multiprogramming
    ['Time sharing', 'Sharing one computer among many interactive users by giving each a short slice of processor time in turn, so every user gets a quick response.'],  // glossary entry: defines time sharing
    ['User mode', 'The restricted processor mode in which ordinary programs run; privileged instructions and protected memory areas are off limits.'],  // glossary entry: defines user mode
    ['Kernel mode', 'The privileged processor mode in which the operating system runs; all instructions and all memory are available.'],  // glossary entry: defines kernel mode
  ],  // closes the terms list
  css: ` /* chapter 2's own style rules, scoped with .sec-ch2 to its overview steps */
    .sec-ch2 .ch2-stack { display: flex; flex-direction: column; gap: 6px; } /* .ch2-stack: the column of layers in step 1 (user, apps, utilities, OS, hardware), stacked with 6px gaps */
    .sec-ch2 .ch2-layer { border: 2px solid var(--line-2); background: var(--panel-2); border-radius: 12px; padding: 11px 16px; cursor: pointer; transition: opacity .2s, box-shadow .2s; display: flex; flex-direction: column; gap: 5px; } /* .ch2-layer: one clickable layer: thick border, tinted fill, rounded, with fades and glows that animate */
    .sec-ch2 .ch2-layer:hover { box-shadow: 0 0 0 2px color-mix(in srgb, var(--chc) 45%, transparent); } /* hovering a layer gives it a soft glow in the chapter color */
    .sec-ch2 .ch2-lt { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; } /* .ch2-lt: the layer's title line: its name and a short grey description side by side */
    .sec-ch2 .ch2-lt b { font-size: 16px; } /* the layer's name is 16px */
    .sec-ch2 .ch2-extra { display: flex; flex-wrap: wrap; gap: 5px; } /* .ch2-extra: the row of small tags inside a layer (such as the hardware parts or the OS services) */
    .sec-ch2 .ch2-extra:empty { display: none; } /* a layer with no tags hides its empty tag row so it does not take up space */
    .sec-ch2 .c-user { border-style: dashed; } /* the "End user" layer has a dashed border, since a person is not software */
    .sec-ch2 .c-proc { border-color: var(--proc); background: var(--proc-bg); } /* the applications layer is colored teal like processes */
    .sec-ch2 .c-util { border-color: var(--accent); background: var(--accent-bg); } /* the utilities and libraries layer uses the accent color */
    .sec-ch2 .c-os { border-color: var(--os); background: var(--os-bg); } /* the operating system layer is purple */
    .sec-ch2 .c-hw { border-color: var(--cpu); background: var(--cpu-bg); } /* the hardware layer is processor blue */
    .sec-ch2 .ch2-layer.sel { box-shadow: 0 0 0 3px var(--chc); } /* the selected layer gets a thick chapter-colored ring */
    .sec-ch2 .ch2-layer.dim { opacity: .38; } /* layers outside the current view's focus fade to 38% */
    .sec-ch2 .ch2-if { display: flex; align-items: center; gap: 8px; padding-left: 14px; border-left: 3px dashed var(--line-2); margin-left: 18px; } /* .ch2-if: the row between two layers that holds the interface tags, indented with a dashed line down its left */
    .sec-ch2 .ch2-iftag { font: 800 13px var(--mono); padding: 2px 10px; border-radius: 999px; border: 1.5px solid var(--ink-2); background: var(--panel); color: var(--ink); cursor: pointer; } /* .ch2-iftag: a clickable pill naming an interface (API, ABI, ISA) in bold fixed-width text */
    .sec-ch2 .ch2-iftag:hover, .sec-ch2 .ch2-iftag.on { background: var(--chc); border-color: var(--chc); color: var(--panel); } /* hovering an interface tag, or the chosen one, fills it with the chapter color */
    .sec-ch2 .ch2-managed { box-shadow: 0 0 0 2px var(--os); } /* .ch2-managed: in the resource-manager view, the hardware tags get a purple ring to show the OS manages them */
    .sec-ch2 .ch2-detail { min-height: 150px; } /* .ch2-detail: the explanation card keeps a minimum height so the page does not jump between choices */
    .sec-ch2 .ch2-svcs { display: flex; flex-wrap: wrap; gap: 6px; } /* .ch2-svcs: the row of service buttons in the "OS as interface" view, wrapping as needed */
    .sec-ch2 .ch2-strip { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 4px; } /* .ch2-strip: the eight-slot timeline of who holds the processor, as eight equal columns */
    .sec-ch2 .ch2-slot { height: 38px; border-radius: 8px; display: grid; place-items: center; font-weight: 800; font-size: 14px; border: 2px solid var(--line); } /* .ch2-slot: one moment in that timeline, a rounded 38px box with a bold label */
    .sec-ch2 .ch2-slot.os { background: var(--os-bg); border-color: var(--os); color: var(--os); } /* a slot where the OS holds the processor is purple */
    .sec-ch2 .ch2-slot.proc { background: var(--proc-bg); border-color: var(--proc); color: var(--proc); } /* a slot where a program holds the processor is teal */
    .sec-ch2 .ch2-slot.empty { border-style: dashed; background: transparent; } /* a slot not reached yet is an empty dashed box */
    .sec-ch2 .ch2-slot.now { box-shadow: 0 0 0 3px var(--hl); } /* the current moment gets a yellow highlight ring */
    .sec-ch2 .ch2-cap { min-height: 66px; } /* .ch2-cap: the caption under the timeline keeps a minimum height so the buttons do not jump */
    .sec-ch2 .ch2-ev { display: flex; flex-direction: column; padding: 8px 12px; border-left: 4px solid var(--chc); background: var(--panel-2); border-radius: 10px; } /* .ch2-ev: one of the three "forces of change" boxes, with a chapter-colored bar on its left */
    .sec-ch2 .ch2-eras { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; } /* .ch2-eras: the five era buttons across the top of step 2, in equal columns */
    .sec-ch2 .ch2-era { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; text-align: left; padding: 8px 10px; border: 1px solid var(--line); border-top: 4px solid var(--line-2); border-radius: 10px; background: var(--panel-2); cursor: pointer; color: var(--ink); font-size: 15px; line-height: 1.25; } /* .ch2-era: one era button: number, name and years stacked, left-aligned, with a thick top edge */
    .sec-ch2 .ch2-era:hover { border-color: var(--chc); } /* hovering an era button outlines it in the chapter color */
    .sec-ch2 .ch2-era.past { border-top-color: color-mix(in srgb, var(--chc) 45%, var(--line)); } /* eras already passed get a half-strength chapter-colored top edge, like a progress trail */
    .sec-ch2 .ch2-era.on { border-color: var(--chc); border-top-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); } /* the current era is outlined in the chapter color with a light tint of it */
    .sec-ch2 .ch2-dot { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--panel-3); font-size: 12.5px; font-weight: 800; margin-bottom: 3px; } /* .ch2-dot: the round number badge (1 to 5) at the top of each era button */
    .sec-ch2 .ch2-era.on .ch2-dot { background: var(--chc); color: var(--panel); } /* the current era's number badge is filled with the chapter color */
    .sec-ch2 .ch2-tl { display: grid; grid-template-columns: repeat(24, minmax(0, 1fr)); gap: 3px; margin: 10px 0; } /* .ch2-tl: the processor-time strip, 24 equal slots in a row */
    .sec-ch2 .ch2-mid { height: auto; min-height: 244px; } /* .ch2-mid: the middle row (era text and the two callouts) keeps a minimum height so the strip below does not jump */
    .sec-ch2 .ch2-meter { width: 120px; display: inline-block; } /* .ch2-meter: the small "useful work" meter next to the strip is 120px wide */
    .sec-ch2 .ch2-c { height: 38px; border-radius: 5px; display: grid; place-items: center; font: 800 13px var(--mono); border: 1.5px solid transparent; } /* .ch2-c: one slot of the processor-time strip, a small rounded box with a bold fixed-width letter */
    .sec-ch2 .ch2-c.job { background: var(--proc-bg); border-color: var(--proc); color: var(--proc); } /* a slot where a program does useful work is teal */
    .sec-ch2 .ch2-c.os { background: var(--os-bg); border-color: var(--os); color: var(--os); } /* a slot where the OS or monitor runs is purple */
    .sec-ch2 .ch2-c.warn { background: var(--warn-bg); border-color: var(--warn); } /* a setup slot (serial processing) is amber */
    .sec-ch2 .ch2-c.wait { background: transparent; border: 1.5px dashed var(--line-2); } /* a slot where the processor waits or sits idle is an empty dashed box */
    .sec-ch2 .ch2-key { display: inline-block; width: 16px; height: 16px; margin-left: 6px; } /* .ch2-key: the tiny color squares in the legend under the strip */
    @media (max-width: 760px) { /* @media (max-width: 760px): these rules apply only on windows 760px wide or less */
      .sec-ch2 .ch2-eras { gap: 5px; } /* small window: less space between era buttons */
      .sec-ch2 .ch2-era { align-items: center; padding: 6px 4px; } /* small window: era buttons center their content and use less padding */
      .sec-ch2 .ch2-era b, .sec-ch2 .ch2-era .xs { display: none; } /* small window: era buttons show only their number, hiding the name and years */
      .sec-ch2 .ch2-era .ch2-dot { margin: 0; } /* small window: the number badge loses its bottom margin */
      .sec-ch2 .ch2-tl { gap: 2px; } /* small window: less space between strip slots */
      .sec-ch2 .ch2-c { height: 26px; font-size: 10px; border-width: 1px; } /* small window: strip slots get shorter with smaller letters and thinner borders */
      .sec-ch2 .ch2-mid { min-height: 0; } /* small window: the middle row drops its minimum height */
    } /* ends the small-window rules */
  `,  // end of chapter 2's CSS text
  steps: [  // chapter 2's own overview steps
    {  // step 1 of the chapter 2 overview
      title: 'Where does the operating system sit?',  // title shown at the top of step 1
      kind: 'story',  // kind "story" labels it "Big Picture"
      render(el, ctx) {  // render(el, ctx): builds the layers step when it is shown
        const { h } = ctx;  // takes the element-building helper h out of ctx
        const LAYERS = [  // LAYERS: the five layers from the person at the top down to the hardware, each with a color class and explanation
          { id: 'user', name: 'End user', col: 'user', sub: 'uses applications',  // layer "user": the end user, with a dashed border
            d: 'The person at the keyboard or touchscreen. A user sees only applications and never needs to know how the hardware works. That is the whole point of the layers below.' },  // explanation of the end user
          { id: 'apps', name: 'Application programs', col: 'proc', sub: 'browser, editor, game',  // layer "apps": application programs
            d: 'Programs written to solve the user\'s problem. They are written against the interfaces below them, so the same program can run on many different machines.' },  // explanation of application programs
          { id: 'utils', name: 'Utilities and libraries', col: 'util', sub: 'compilers, shells, file tools, common routines',  // layer "utils": utilities and libraries
            d: 'System programs and shared libraries that come with the OS. They make programming and system administration easier, and they call into the kernel on the application\'s behalf.' },  // explanation of utilities and libraries
          { id: 'os', name: 'Operating system', col: 'os', sub: 'its core part is called the kernel',  // layer "os": the operating system and its kernel
            d: 'The layer that owns the hardware. It hides device details behind simple services, decides which program gets which resource, and protects programs from one another. Only the OS may use the processor’s privileged instructions: the special ones that control the hardware directly.' },  // explanation of what the OS layer does and its privileged instructions
          { id: 'hw', name: 'Computer hardware', col: 'hw', sub: '',  // layer "hw": the computer hardware
            d: 'The processor, memory, I/O devices and storage from Chapter 1. Hardware understands only machine instructions and electrical signals.' },  // explanation of the hardware layer
        ];  // closes the LAYERS list
        const IFACES = {  // IFACES: the three interfaces between layers, shown when their tag is clicked
          api: { name: 'API: application programming interface', d: 'The set of calls a program can make, in source code, to libraries and the OS: open a file, create a window, send a message. Code written to an API can be recompiled for any system that offers the same API.' },  // interface API: the calls a program makes in source code
          abi: { name: 'ABI: application binary interface', d: 'The same agreement at the level of compiled machine code: how arguments are passed, how system services are requested, how data is laid out. A compiled program runs on any system with the same ABI and ISA without being rebuilt.' },  // interface ABI: the same agreement for compiled machine code
          isa: { name: 'ISA: instruction set architecture', d: 'The machine instructions a processor understands, and the boundary between software and hardware. Ordinary programs may use the user part of the ISA; the privileged system part is reserved for the OS.' },  // interface ISA: the machine instructions, the boundary between software and hardware
        };  // closes the IFACES table
        const SERVICES = [  // SERVICES: the seven services an OS offers, each as [name, explanation, everyday example]
          ['Program development', 'Editors, compilers and debuggers ship with the system (strictly as utilities), so nobody has to build tools before writing code.', 'You write, compile and debug a program with tools that came with your computer.'],  // service: program development tools
          ['Program execution', 'Starting a program takes many steps: load instructions and data into memory, set up I/O, prepare other resources. The OS does all of them for you.', 'You double-click an icon and the program simply starts.'],  // service: program execution
          ['Access to I/O devices', 'Every device has its own commands and quirks. The OS hides them behind a few uniform operations such as read and write.', 'Your program saves "a file" without caring whether it lands on an SSD or a USB stick.'],  // service: access to I/O devices
          ['Controlled access to files', 'The OS understands how data is laid out on storage devices and enforces who may read or change each file.', 'A classmate on the same machine cannot open your private folder.'],  // service: controlled access to files
          ['System access', 'On a shared or networked system, the OS decides who may use the system at all, and which resources each user may touch.', 'Logging in with a password before you see your desktop.'],  // service: system access (who may log in)
          ['Error detection and response', 'Hardware faults and software mistakes (dividing by zero, touching forbidden memory) must be caught and handled with as little damage as possible.', 'One program crashes, the OS ends it, and everything else keeps running.'],  // service: error detection and response
          ['Accounting', 'The OS records who used how much of each resource, which helps tune performance and, on shared systems, bill users.', 'A task manager showing each program\'s processor and memory use.'],  // service: accounting of resource use
        ];  // closes the SERVICES list
        const MOMENTS = [  // MOMENTS: eight moments showing who holds the one processor, each as [holder, caption]
          ['OS', 'The OS is running. It picks program <b>A</b> and hands it the processor.'],  // moment 1: the OS picks program A
          ['A', 'A runs. Notice that the OS is <b>not running at all</b> now: there is only one processor, and A has it.'],  // moment 2: A runs, so the OS is not running at all
          ['OS', 'A timer interrupt fires. The hardware jumps into the OS, which is back in control.'],  // moment 3: a timer interrupt brings the OS back
          ['B', 'The OS saved A\'s state and gave the processor to <b>B</b>.'],  // moment 4: the OS saved A and gave the processor to B
          ['OS', 'B asks to read a file. That request is a call into the OS, so the OS runs again.'],  // moment 5: B asks to read a file, which calls into the OS
          ['OS', 'The OS tells the disk to start reading, marks B as waiting, and picks A again.'],  // moment 6: the OS starts the disk, marks B waiting and picks A
          ['A', 'A carries on while the disk works in the background.'],  // moment 7: A runs while the disk works
          ['OS', 'The disk interrupts: B\'s data is ready. The OS marks B as ready to run again. It regains control only through interrupts and calls like these.'],  // moment 8: the disk interrupts and B becomes ready again
        ];  // closes the MOMENTS list
        let view = 'layers', selLayer = null, selIf = null, selSvc = 0, moment = 0;  // the step's state: which view is shown, which layer or interface is picked, which service, and which moment
        const layerEls = {};  // layerEls: the on-screen element for each layer, looked up by its id
        const mkLayer = (l) => {  // mkLayer(l): builds the clickable box for layer l
          const extra = h('div', { class: 'ch2-extra' });  // extra: the empty row for tags inside the layer, filled later
          const b = h('div', { class: 'ch2-layer c-' + l.col, 'data-l': l.id, role: 'button', tabindex: 0, 'aria-label': l.name },  // the layer box acts as a button (role and tabindex let screen readers and the Tab key reach it)
            h('div', { class: 'ch2-lt' }, h('b', {}, l.name), ...(l.sub ? [h('span', { class: 'xs muted' }, l.sub)] : [])), extra);  // its title line: the bold name and, if there is one, the short grey description, followed by the tag row
          b.extra = extra;  // keeps a handle on the tag row for later
          layerEls[l.id] = b;  // stores the box so paint() can find it by id
          const act = () => { if (view !== 'layers') { view = 'layers'; seg.set('layers'); } selLayer = l.id; selIf = null; paint(); };  // act(): picking a layer switches back to "The layers" view if needed, selects it, clears any interface, and redraws
          ctx.on(b, 'click', act);  // clicking the layer picks it
          ctx.on(b, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });  // pressing Enter or Space on a focused layer picks it too
          return b;  // gives the finished layer box back
        };  // ends mkLayer
        const ifTags = {};  // ifTags: the on-screen tag button for each interface, by its key
        const ifRow = (keys, label) => h('div', { class: 'ch2-if' },  // ifRow(keys, label): builds the row between two layers holding interface tags and a short grey label
          ...keys.map((k) => (ifTags[k] = h('button', { class: 'ch2-iftag', type: 'button', onclick: () => { if (view !== 'layers') { view = 'layers'; seg.set('layers'); } selIf = k; selLayer = null; paint(); } }, k.toUpperCase()))),  // each tag is a button (API, ABI or ISA); clicking it switches to the layers view, selects that interface and redraws
          h('span', { class: 'xs muted' }, label));  // the grey label saying what happens at this boundary
        const L = Object.fromEntries(LAYERS.map((l) => [l.id, l]));  // L: the layers looked up by id, so the stack below can name them
        const stack = h('div', { class: 'ch2-stack' },  // stack: the full column of layers and interface rows, top to bottom
          mkLayer(L.user),  // the end user at the top
          mkLayer(L.apps),  // the application programs
          ifRow(['api', 'abi'], 'where programs call libraries and the OS'),  // the API and ABI row, where programs call libraries and the OS
          mkLayer(L.utils),  // the utilities and libraries
          mkLayer(L.os),  // the operating system
          ifRow(['isa'], 'where software meets hardware'),  // the ISA row, where software meets hardware
          mkLayer(L.hw));  // the hardware at the bottom
        const hwChips = [['cpu', 'Processor'], ['mem', 'Main memory'], ['io', 'I/O devices'], ['io', 'Storage']].map(([c, t]) => h('span', { class: 'chip ' + c }, t));  // hwChips: four colored tags naming the hardware parts
        layerEls.hw.extra.append(...hwChips);  // puts those tags inside the hardware layer
        const right = h('div', { class: 'stack ch2-right' });  // right: the column on the right, rebuilt by paintRight() for each view
        const seg = ctx.ui.seg([  // seg: the four-way switch between views of the OS; changing it clears the selection and redraws
          { value: 'layers', label: 'The layers' }, { value: 'iface', label: 'OS as interface' },  // options: the layers, and the OS as an interface
          { value: 'res', label: 'OS as resource manager' }, { value: 'evolve', label: 'Built to evolve' }],  // options: the OS as a resource manager, and the OS built to evolve
        view, (v) => { view = v; selLayer = null; selIf = null; paint(); });  // the starting view, and what happens when the student picks another
        const focus = { layers: null, iface: ['user', 'apps', 'os'], res: ['os', 'hw'], evolve: ['os'] };  // focus: which layers stay bright in each view (null means all of them)
        function paintLeft() {  // paintLeft(): updates the layer column to match the current view and selection
          const f = focus[view];  // f is the list of layers to keep bright in this view, or null to keep them all
          Object.entries(layerEls).forEach(([id, e]) => {  // goes through every layer box
            e.classList.toggle('dim', !!f && !f.includes(id));  // fades a layer that is not in this view's focus list
            e.classList.toggle('sel', (view === 'layers' && selLayer === id) || (!!f && id === 'os'));  // rings the picked layer in the layers view, or the OS layer in every other view, since the OS is the subject
          });  // ends the loop over layers
          Object.entries(ifTags).forEach(([k, t]) => t.classList.toggle('on', selIf === k));  // lights up the interface tag that is picked, if any
          const ex = layerEls.os.extra;  // ex is the tag row inside the OS layer, which changes with the view
          ex.innerHTML = '';  // empties it before filling it again
          if (view === 'iface') SERVICES.forEach((s, i) => ex.append(h('span', { class: 'chip ' + (i === selSvc ? 'os' : '') }, s[0])));  // interface view: one tag per service, with the chosen service colored purple
          if (view === 'res') ex.append(...['processor time', 'memory space', 'devices', 'files'].map((t) => h('span', { class: 'chip os' }, 'decides: ' + t)));  // resource view: tags listing what the OS decides (processor time, memory, devices, files)
          if (view === 'evolve') ex.append(...['version 1', '→ new hardware', '→ new services', '→ fixes'].map((t, i) => h('span', { class: 'chip ' + (i ? '' : 'os') }, t)));  // evolve view: tags showing version 1 followed by the three kinds of change
          hwChips.forEach((c) => c.classList.toggle('ch2-managed', view === 'res'));  // resource view: rings the hardware tags in purple to show the OS manages them
        }  // ends paintLeft()
        function paintRight() {  // paintRight(): rebuilds the right-hand column for the current view
          right.innerHTML = '';  // clears the column first
          if (view === 'layers') {  // view 1, "The layers":
            const item = selLayer ? L[selLayer] : selIf ? IFACES[selIf] : null;  // item is the picked layer or interface, or null if nothing is picked yet
            right.append(  // fills the column with, in order:
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'A stack of layers'), h('span', { class: 'chip accent' }, 'click any layer')),  // a heading with a "click any layer" tag
              h('p', { class: 'small m0' }, 'Each layer uses only the layer below it, through an agreed interface. That separation lets the same application run on many machines, and lets the hardware change without rewriting every program.'),  // a paragraph on why each layer only talks to the one below
              h('div', { class: 'card white ch2-detail', 'aria-live': 'polite' }, item  // the detail card: the picked item's name and explanation, or a hint telling the student what to click
                ? h('div', {}, h('h3', {}, item.name), h('p', { class: 'small m0', html: item.d }))  // the explanation shown when something is picked
                : h('p', { class: 'small muted m0' }, 'Pick a layer on the left, or one of the interface labels API, ABI or ISA, to see what it is.')),  // the hint shown when nothing is picked
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A restaurant: diners (users) order from a menu (applications), waiters carry the orders (libraries), the kitchen manager (OS) runs the kitchen, and the stoves and fridges (hardware) do the physical work.' }),  // "Analogy" callout: the layers as a restaurant
              h('div', { class: 'card tight small' }, h('h4', {}, 'Who works at which layer'), h('div', { html: '<b>End user:</b> only applications. <b>Application programmer:</b> the API and utilities. <b>OS designer:</b> the bare hardware and its ISA.' })));  // a small card on who works at which layer
          } else if (view === 'iface') {  // view 2, "OS as interface":
            const s = SERVICES[selSvc];  // s is the chosen service
            right.append(  // fills the column with, in order:
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Services the OS offers'), h('span', { class: 'chip ok' }, 'goal: convenience')),  // a heading with a "goal: convenience" tag
              h('div', { class: 'ch2-svcs' }, ...SERVICES.map((x, i) => h('button', { class: 'btn sm ' + (i === selSvc ? 'on' : ''), type: 'button', onclick: () => { selSvc = i; paint(); } }, x[0]))),  // one small button per service; clicking one selects it and redraws
              h('div', { class: 'card white ch2-detail', 'aria-live': 'polite' }, h('h3', {}, s[0]), h('p', { class: 'small', html: s[1] }), h('p', { class: 'small muted m0', html: '<b>Example:</b> ' + s[2] })),  // the detail card: the service's name, explanation and example
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'Without these services every program would need its own disk driver, its own file format and its own error handling. The OS writes them once for everyone.' }));  // "Why it matters" callout: the OS writes these services once for every program
          } else if (view === 'res') {  // view 3, "OS as resource manager":
            const strip = h('div', { class: 'ch2-strip' }, ...MOMENTS.map((m, i) => h('span', { class: 'ch2-slot ' + (i <= moment ? (m[0] === 'OS' ? 'os' : 'proc') : 'empty') + (i === moment ? ' now' : '') }, i <= moment ? m[0] : '')));  // strip: the eight timeline slots, filled up to the current moment and colored by who holds the processor
            right.append(  // fills the column with, in order:
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'The manager that must let go'), h('span', { class: 'chip ok' }, 'goal: efficiency')),  // a heading with a "goal: efficiency" tag
              h('p', { class: 'small m0' }, 'The OS shares out the hardware. The twist: the OS is itself a program, so while a program runs, the OS is not running. Step through who holds the processor.'),  // a paragraph: the OS is a program too, so it is not running while a program runs
              h('div', { class: 'card white stack', style: { gap: '8px' } },  // a white card holding the timeline and its controls
                h('div', { class: 'xs muted b' }, 'WHO HOLDS THE ONE PROCESSOR, MOMENT BY MOMENT'), strip,  // the card's small label and the timeline strip
                h('p', { class: 'small m0 ch2-cap', html: MOMENTS[moment][1] }),  // the caption for the current moment
                h('div', { class: 'row' },  // the row of controls
                  h('button', { class: 'btn sm', type: 'button', disabled: moment === 0, onclick: () => { moment = 0; paint(); } }, 'Restart'),  // "Restart" button: back to moment 1 (disabled when already there)
                  h('button', { class: 'btn sm primary', type: 'button', disabled: moment >= MOMENTS.length - 1, onclick: () => { moment = Math.min(MOMENTS.length - 1, moment + 1); paint(); } }, 'Next moment ▶'),  // "Next moment" button: moves one moment forward (disabled at the last moment)
                  h('span', { class: 'xs muted' }, `moment ${moment + 1} of ${MOMENTS.length}`))),  // the "moment 3 of 8" counter
              h('table', { class: 'tbl compact', html: '<tr><th>Resource</th><th>What the OS decides</th></tr><tr><td>Processor</td><td>which program runs next, and for how long</td></tr><tr><td>Main memory</td><td>which program gets which region</td></tr><tr><td>I/O devices</td><td>who may use each device, and when</td></tr><tr><td>Files</td><td>who may read or change each file</td></tr>' }));  // a small table of what the OS decides for each resource
          } else {  // view 4, "Built to evolve":
            right.append(  // fills the column with, in order:
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Built to change'), h('span', { class: 'chip ok' }, 'goal: ability to evolve')),  // a heading with a "goal: ability to evolve" tag
              h('p', { class: 'small m0' }, 'An OS lives for decades, so it must absorb change without being rewritten. Three forces keep changing it:'),  // a paragraph introducing the three forces of change
              h('div', { class: 'ch2-ev' }, h('b', {}, 'New and upgraded hardware'), h('span', { class: 'small' }, 'New kinds of devices, more cores, bigger memories. The OS must learn to drive and exploit them.')),  // force 1: new and upgraded hardware
              h('div', { class: 'ch2-ev' }, h('b', {}, 'New services'), h('span', { class: 'small' }, 'Users expect new features: new file systems, networking, security tools.')),  // force 2: new services
              h('div', { class: 'ch2-ev' }, h('b', {}, 'Fixes'), h('span', { class: 'small' }, 'Every large OS has faults that are found over time, and some fixes introduce new faults.')),  // force 3: fixes, which can bring new faults
              h('div', { class: 'callout why m0', 'data-label': 'Design lesson', html: 'Build the OS from modules with clear interfaces and good documentation, so one part can be replaced without breaking the rest.' }));  // "Design lesson" callout: build the OS from replaceable modules
          }  // ends the choice of view
        }  // ends paintRight()
        function paint() { paintLeft(); paintRight(); ctx.refit(); }  // paint(): redraws both columns, then asks the shell to check that the step still fits
        el.append(h('div', { class: 'split r fill' }, h('div', { class: 'stack' }, seg, stack,  // puts the step on screen: on the left the view switch, the layer stack and a note; on the right the detail column
          h('p', { class: 'xs muted m0' }, 'API: the calls a program makes in its source code. ABI: the same agreement for compiled code. ISA: the machine instructions the hardware understands.')), right));  // small note under the stack spelling out API, ABI and ISA
        paint();  // draws the first picture in "The layers" view
      },  // ends render() for step 1
    },  // closes step 1
    {  // step 2 of the chapter 2 overview
      title: 'How each fix created the next era',  // title shown at the top of step 2
      kind: 'explore',  // kind "explore" labels it "Explore"
      render(el, ctx) {  // render(el, ctx): builds the eras step when it is shown
        const { h } = ctx;  // takes the element-building helper h out of ctx
        // strip codes: S setup, M monitor/OS, W waiting for I/O (processor idle), I idle, anything else = useful work
        const ERAS = [  // ERAS: the five eras of operating systems, each with its dates, a 24-slot processor-time strip and its story
          { name: 'Serial processing', years: 'late 1940s to mid-1950s', secs: '2.2',  // era 1: serial processing, taught in 2.2
            strip: 'SSSSSJJWWJJWWJSSIIIIIIII', note: 'Most of the booking goes on setup, and the unused end of it is simply lost.', pic: 'Booking a tennis court by the hour: finish early and the court sits empty; run over and you are sent off mid-game.',  // its strip is mostly setup and idle slots; the note and the tennis-court picture explain the waste
            how: 'There is no operating system. A programmer books the machine for a block of time on a sign-up sheet, loads the program by hand from punched cards, and reads the result from lights or a printer.',  // how serial processing worked: no OS, machine booked by hand
            waste: 'Book an hour and finish in 45 minutes, and the rest of the hour is wasted. Much of each booking also goes on <b>setup</b>: loading the compiler, the program and the libraries by hand.',  // its waste: unused booking time and manual setup
            fix: 'Let a program load and run the jobs one after another, with no human in between.' },  // the fix that led to the next era: let a program run the jobs one after another
          { name: 'Simple batch systems', years: 'mid-1950s', secs: '2.2',  // era 2: simple batch systems
            strip: 'MJWWWJMJWWWJMJWWWJMJWWWJ', note: 'Each job computes briefly, then the processor idles while the job waits for I/O.', pic: 'A stage manager who sends the next act on the moment the last one leaves, but who cannot stop an act from standing around waiting for a prop.',  // its strip shows the processor idling while each job waits for I/O; the picture is a stage manager
            how: 'An operator collects jobs into a batch. A program that stays in memory, the <span class="t">resident monitor</span>, reads each job and the short orders that come with it (its <span class="t">job control language</span>), runs it, and takes control back when it ends. New hardware guards the monitor: jobs run in a restricted <span class="t">user mode</span> and cannot touch its memory, while the monitor runs in an all-powerful <span class="t">kernel mode</span>; a timer stops any job that runs too long.',  // how batch systems worked: the resident monitor, job control language, user and kernel mode, and a timer
            waste: 'Setup is gone, but whenever the running job waits for a tape or disk, the processor sits idle. For typical business jobs, that can be most of the time.',  // its waste: the processor still idles during I/O waits
            fix: 'Keep several jobs in memory, and when one waits for I/O, switch to another.' },  // the fix: keep several jobs in memory and switch when one waits
          { name: 'Multiprogrammed batch', years: '1960s', secs: '2.2 · 2.3',  // era 3: multiprogrammed batch
            strip: 'MAABBCCMAABBCMABBCCIMABC', note: 'While job A waits for I/O, B or C runs. The processor idles only when every job is waiting.', pic: 'A cook with three dishes on the go: while one simmers, she chops vegetables for the next instead of watching the pot.',  // its strip keeps the processor busy with jobs A, B and C; the picture is a cook with three dishes
            how: 'Memory holds several jobs at once (<span class="t">multiprogramming</span>). When the running job has to wait for I/O, the OS gives the processor to another job that is ready. This needs interrupts, a way to keep each job’s memory apart (memory management) and a rule for picking the next job (scheduling).',  // how multiprogramming works and what it needs (interrupts, memory management, scheduling)
            waste: 'The processor is now busy nearly all the time, but a user still hands in a job and waits hours for the output, with no way to interact with the running program.',  // its new problem: users still wait hours and cannot interact
            fix: 'Let many users at terminals share the processor in short turns.' },  // the fix: let many users at terminals share the processor in short turns
          { name: 'Time-sharing systems', years: '1960s onward', secs: '2.2 · 2.3',  // era 4: time-sharing systems
            strip: 'M111M222M333M444M111M222', note: 'Users 1 to 4 take turns. More time goes on switching, but every user gets a turn every few slots.', pic: 'A chess master playing twenty boards at once, one move per board, so fast that every opponent feels watched.',  // its strip rotates among users 1 to 4; the picture is a chess master playing many boards
            how: 'Many users type at terminals connected to one computer. In <span class="t">time sharing</span> the OS gives each user a short slice of processor time in rotation, so quickly that everyone feels they have the machine to themselves.',  // how time sharing works: short slices of processor time in rotation
            waste: 'The goal changes from keeping the processor busy to answering each user quickly. New problems appear: protecting each user\'s files and memory from the others, and sharing devices fairly.',  // its new problems: quick response, protecting users from each other, fair sharing
            fix: 'These problems shaped the big ideas of section 2.3: the process (a running program the OS keeps track of), memory management, protection and scheduling.' },  // what those problems led to: the big ideas of section 2.3
          { name: 'Modern systems', years: '1990s to today', secs: '2.4 to 2.11',  // era 5: modern systems
            strip: 'MABCABMCABCAMBCABMCABCAB', note: 'One core shown. A multicore chip runs several strips like this at the same time.', pic: 'A busy kitchen with several cooks (cores), each juggling several dishes, all sharing one pantry.',  // its strip shows one busy core; the picture is a kitchen with several cooks
            how: 'Programs split into several paths of execution (threads), machines with many processors or cores sharing one memory, small kernels that move most services outside, and systems that keep running when a part fails. Sections 2.4 to 2.6 explain these ideas; Windows, UNIX, Linux and Android are all built from them.',  // what modern systems add: threads, multiprocessors, small kernels and fault tolerance
            waste: 'With many cores, the new challenge is keeping every core busy without the programs and the OS itself tripping over one another.',  // its new challenge: keeping every core busy without collisions
            fix: 'That challenge is the common theme of the rest of this guide: processes, threads and concurrency.' },  // where this leads: processes, threads and concurrency in the rest of the guide
        ];  // closes the ERAS list
        let cur = 0;  // cur: which era is shown, starting with the first
        const eraBtns = ERAS.map((e, i) => h('button', { class: 'ch2-era', type: 'button', onclick: () => { cur = i; paint(); } },  // eraBtns: one button per era; clicking it selects that era and redraws
          h('span', { class: 'ch2-dot' }, String(i + 1)), h('b', {}, e.name), h('span', { class: 'xs muted' }, e.years)));  // each button shows the era's number badge, name and years
        const what = h('div', { class: 'card white' });  // what: the card that explains how the chosen era worked
        const stripBox = h('div', { class: 'card' });  // stripBox: the card that holds the processor-time strip, rebuilt for each era
        const waste = h('div', { class: 'callout bad m0', 'data-label': 'The waste or the new problem' });  // waste: the red callout for the chosen era's waste or new problem
        const fix = h('div', { class: 'callout tip m0', 'data-label': 'The fix that opened the next era' });  // fix: the green callout for the fix that opened the next era
        const secs = h('span', { class: 'xs muted b' });  // secs: the small "Learn it in section" label beside the buttons
        const prev = h('button', { class: 'btn sm', type: 'button', onclick: () => { cur = Math.max(0, cur - 1); paint(); } }, '◀ Earlier');  // "Earlier" button: moves back one era, stopping at the first
        const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { cur = Math.min(ERAS.length - 1, cur + 1); paint(); } }, 'Next era ▶');  // "Next era" button: moves forward one era, stopping at the last
        const KIND = { S: ['warn', 'setup'], M: ['os', 'OS / monitor'], W: ['wait', 'waiting for I/O'], I: ['wait', 'idle'] };  // KIND: what each strip letter means (setup, OS or monitor, waiting, idle); any other letter is useful program work
        function paint() {  // paint(): redraws everything for the chosen era; runs after every button press
          const e = ERAS[cur];  // e is the chosen era
          eraBtns.forEach((b, i) => { b.classList.toggle('on', i === cur); b.classList.toggle('past', i < cur); });  // marks the chosen era button as current and every earlier one as passed
          what.innerHTML = `<h3>${e.name} <span class="xs muted">${e.years}</span></h3><p class="small">${e.how}</p><p class="small muted m0"><b>Picture it:</b> ${e.pic}</p>`;  // fills the explanation card with the era's name, years, how it worked and its everyday picture
          const cells = e.strip.split('');  // cells: the era's strip split into its 24 single-letter slots
          const useful = cells.filter((c) => !KIND[c]).length;  // useful: how many slots are real program work (letters not listed in KIND)
          stripBox.innerHTML = '';  // empties the strip card before rebuilding it
          stripBox.append(  // rebuilds the strip card with three rows:
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted b' }, 'PROCESSOR TIME, SLOT BY SLOT (ILLUSTRATIVE)'),  // row 1: the small title "Processor time, slot by slot" on the left
              h('span', { class: 'row gap-s small b' }, `useful work: ${useful} of ${cells.length} slots (${Math.round((useful / cells.length) * 100)}%)`, h('span', { class: 'meter ch2-meter' }, h('i', { style: { width: (useful / cells.length) * 100 + '%' } })))),  // and the useful-work count, percentage and meter on the right
            h('div', { class: 'ch2-tl' }, ...cells.map((c) => h('span', { class: 'ch2-c ' + (KIND[c] ? KIND[c][0] : 'job'), title: KIND[c] ? KIND[c][1] : 'program running' }, KIND[c] ? (c === 'M' ? 'M' : '') : (c === 'J' ? '' : c)))),  // row 2: the 24 colored slots; M shows its letter, user numbers and job letters show theirs, J and gaps stay blank
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small' }, e.note),  // row 3: the era's note on the left
              h('span', { class: 'row gap-s xs' }, h('span', { class: 'ch2-c job ch2-key' }), 'program', h('span', { class: 'ch2-c os ch2-key' }), 'OS or monitor', h('span', { class: 'ch2-c warn ch2-key' }), 'setup', h('span', { class: 'ch2-c wait ch2-key' }), 'idle')));  // and a color key (program, OS or monitor, setup, idle) on the right
          waste.innerHTML = e.waste;  // fills the red callout with the era's waste
          fix.innerHTML = e.fix;  // fills the green callout with the era's fix
          secs.textContent = (e.secs.length > 3 ? 'LEARN IT IN SECTIONS ' : 'LEARN IT IN SECTION ') + e.secs;  // writes "section" or "sections" depending on whether more than one section is listed
          prev.disabled = cur === 0; next.disabled = cur === ERAS.length - 1;  // turns off Earlier on the first era and Next era on the last
          ctx.refit();  // asks the shell to re-check that the step still fits
        }  // ends paint()
        el.append(h('div', { class: 'stack fill' },  // puts the step on screen as one column:
          h('div', { class: 'ch2-eras' }, ...eraBtns),  // the five era buttons across the top
          h('div', { class: 'split ch2-mid' }, what, h('div', { class: 'stack' }, waste, fix)),  // the explanation card beside the two callouts
          stripBox,  // the processor-time strip card
          h('div', { class: 'row' }, prev, next, secs)));  // the Earlier and Next era buttons with the section label
        paint();  // draws the first era
      },  // ends render() for step 2
    },  // closes step 2
  ],  // closes chapter 2's steps list
  notes: `${/* notes: the chapter 2 summary shown in the Notes drawer on its overview steps */''}
    <h3>How Chapter 2 fits together</h3>${/* notes heading: how chapter 2 fits together */''}
    <p>Chapter 1 described the hardware. Chapter 2 asks what software must sit on top of it, why it looks the way it does, and how real systems are organised.</p>${/* notes paragraph: chapter 2 asks what software sits on the hardware and why */''}
    <h4>What an OS is for (2.1)</h4>${/* notes heading: what an OS is for (section 2.1) */''}
    <p>An OS has three objectives: <b>convenience</b>, <b>efficiency</b> and the <b>ability to evolve</b>. As an <b>interface</b> it offers services (program development and execution, I/O and file access, system access, error handling, accounting) through agreed boundaries: the API for source code, the ABI for compiled code and the ISA between software and hardware. As a <b>resource manager</b> it hands out processor time, memory, devices and files, even though it is itself a program that must give up the processor and win it back through interrupts.</p>${/* notes paragraph: the three objectives, the OS as interface (API, ABI, ISA) and as resource manager */''}
    <h4>How we got here (2.2)</h4>${/* notes heading: how we got here (section 2.2) */''}
    <p>Each era fixed the waste of the one before. <b>Serial processing</b> lost time to manual setup and booking. <b>Simple batch</b> systems added a resident monitor, plus the hardware it needed (memory protection, a timer, privileged instructions, user and kernel mode). <b>Multiprogramming</b> kept the processor busy during I/O waits, and <b>time sharing</b> gave interactive users quick responses.</p>${/* notes paragraph: each era fixed the waste of the one before */''}
    <h4>The big ideas (2.3, 2.4)</h4>${/* notes heading: the big ideas (sections 2.3 and 2.4) */''}
    <p>Section 2.3 names the achievements that made this work: the <b>process</b>, <b>memory management</b> (including virtual memory), <b>information protection and security</b>, and <b>scheduling and resource management</b>. Section 2.4 adds the developments behind modern systems: microkernels, multithreading, symmetric multiprocessing, distributed systems and object-oriented design.</p>${/* notes paragraph: processes, memory management, protection, scheduling and the developments behind modern systems */''}
    <h4>Staying up and scaling out (2.5, 2.6)</h4>${/* notes heading: staying up and scaling out (sections 2.5 and 2.6) */''}
    <p>Fault tolerance (2.5) measures reliability and availability, classifies faults as permanent, transient or intermittent, and answers them with redundancy and OS tools such as process isolation and checkpoints. Section 2.6 lists the extra problems when several processors or cores share one OS: running kernel code on many processors at once, scheduling, synchronization, memory management and reliability.</p>${/* notes paragraph: fault tolerance and the problems of many processors sharing one OS */''}
    <h4>Real systems (2.7 to 2.11)</h4>${/* notes heading: real systems (sections 2.7 to 2.11) */''}
    <p>The chapter ends with case studies: Windows, traditional UNIX, modern UNIX variants, Linux and Android. Look for the same ideas in each: a kernel, user and kernel mode, processes and threads, and a modular structure designed to evolve.</p>${/* notes paragraph: the case studies and the ideas to look for in each */''}
    <h4>Why it matters next</h4>${/* notes heading: why it matters next */''}
    <p>The process, introduced here as the answer to multiprogramming and time sharing, is the subject of Chapter 3.</p>`,  // notes paragraph: the process leads into chapter 3; end of the notes text
});  // closes the chapter 2 object and the Guide.chapter call
Guide.chapter({  // registers chapter 3 with the guide
  num: 3,  // num: chapter 3, which sets its order, color (--ch3) and page addresses
  title: 'Process Description and Control',  // title shown on the chapter card, overview page and tooltip
  tagline: 'The process is the idea everything else is built on. Here is how the OS describes and controls every one.',  // tagline printed in the chapter color on the overview page
  intro: '<p>A program on disk is just a file. Running it creates a <span class="t">process</span>: a program in execution that the OS can start, pause, resume and protect. This chapter models a process\'s life as states and transitions, shows the tables and the <span class="t">process control block</span> the OS keeps for each process, and explains how processes are created and switched. It ends with where the OS\'s own code runs and how UNIX SVR4 puts it all together.</p>',  // intro paragraph for the overview page, with key terms marked for pop-up definitions
  objectives: [  // objectives shown on the overview page and in the printed guide
    'Define a process and explain how it relates to its process control block.',  // objective 1: define a process and its process control block
    'Explain the two-state, five-state and suspend process models and their transitions.',  // objective 2: the two-state, five-state and suspend models
    'Describe the tables and data structures the OS uses to manage processes.',  // objective 3: the tables the OS uses to manage processes
    'Explain process creation, mode switching and process switching.',  // objective 4: process creation, mode switching and process switching
    'Compare the ways the OS\'s own code can be executed.',  // objective 5: the ways the OS's own code can run
    'Describe process management in UNIX SVR4.',  // objective 6: process management in UNIX SVR4
  ],  // closes the objectives list
  terms: [  // chapter 3's glossary entries as [term, definition] pairs
    ['Process control block (PCB)', 'The data structure the OS keeps for each process, holding its identifier, state, saved registers, priority, memory pointers and other information needed to manage it.'],  // glossary entry: defines the process control block (PCB)
    ['Process', 'A program in execution: the running program together with its current state, its memory and the resources the OS has given it. The OS schedules and manages work in units of processes.'],  // glossary entry: defines a process
    ['Process image', 'Everything that makes up a process in memory: its program code, its data, its stack and its process control block (attributes).'],  // glossary entry: defines the process image
    ['Process state', 'The condition a process is in at a given moment, such as New, Ready, Running, Blocked or Exit, which tells the OS what the process can do next.'],  // glossary entry: defines a process state
    ['Dispatch', 'The act of choosing a Ready process and giving it the processor, by loading its saved register values so its instructions start executing.'],  // glossary entry: defines dispatch
    ['Blocked state', 'The state of a process that cannot continue until some event happens, such as an I/O operation completing; it is not eligible to run even if the processor is free.'],  // glossary entry: defines the Blocked state
    ['Swapping', 'Moving all or part of a process image from main memory out to disk (and later back) to free memory for other processes.'],  // glossary entry: defines swapping
    ['Suspended process', 'A process that has been set aside, usually by swapping its image out of main memory to disk; it cannot run until it is explicitly brought back.'],  // glossary entry: defines a suspended process
    ['Process switch', 'Taking the processor away from one process and giving it to another: the OS saves the first process\'s state in its PCB and restores the state of the next one.'],  // glossary entry: defines a process switch
  ],  // closes the terms list
  css: ` /* chapter 3's own style rules, scoped with .sec-ch3 to its overview step */
    .sec-ch3 .ch3-scene { display: grid; place-items: center; padding: 8px 10px; } /* .ch3-scene: centers the process diagram inside its card with a little padding */
    .sec-ch3 .ch3-pcb .tbl td { padding: 3px 9px; } /* the rows of the PCB table use slightly tighter padding */
    .sec-ch3 .ch3-pcb .tbl td:first-child { width: 38%; } /* the field-name column of the PCB table takes 38% of the width */
    .sec-ch3 .ch3-empty td { color: var(--muted); } /* .ch3-empty: before a PCB exists, the table's cells are grey */
    .sec-ch3 .player-cap { min-height: 66px; } /* taller minimum caption in the animation player, so the longer captions here do not make the controls jump */
  `,  // end of chapter 3's CSS text
  steps: [  // chapter 3's own overview steps
    {  // step 1 of the chapter 3 overview (its only step)
      title: 'The life of a process, from launch to exit',  // title shown at the top of the step
      kind: 'story',  // kind "story" labels it "Big Picture"
      render(el, ctx) {  // render(el, ctx): builds the life-of-a-process animation when the step is shown
        const { h } = ctx;  // takes the element-building helper h out of ctx
        // one frame per moment in the life of process 7; pcb fields: [label, value]
        const F = [  // F: the eleven animation frames; each says which state is lit, where the image is, who runs, and the PCB values
          { st: null, img: 'none', cpu: 'other', sec: '3.1', pcb: null,  // frame 1: the program is only a file on disk; no state and no PCB yet
            cap: '<b>A program is not a process.</b> On disk, <i>editor</i> is just a file of instructions. Nothing about it is running, and the OS keeps no record for it.' },  // frame 1 caption: a program is not a process
          { st: 'new', img: 'none', cpu: 'other', sec: '3.4', edge: null, changed: ['PID', 'State'],  // frame 2: the process is created in the New state (changed lists the PCB rows to highlight)
            pcb: { PID: '7', State: 'New', PC: '(not set)', Priority: 'normal', Memory: 'being allocated', 'Open files': 'none', 'CPU time': '0 ms' },  // frame 2 PCB: PID 7 in state New with memory being allocated
            cap: 'You launch the editor. The OS <b>creates a process</b>: it assigns an identifier (PID 7), builds a <b>process control block (PCB)</b> for it, and marks it <b>New</b>.' },  // frame 2 caption: the OS creates the process, assigns PID 7 and builds its PCB
          { st: 'new', img: 'mem', load: true, cpu: 'other', sec: '3.3', changed: ['PC', 'Memory'],  // frame 3: the code and data are loaded into memory (load draws the loading arrow)
            pcb: { PID: '7', State: 'New', PC: '0x4000 (entry)', Priority: 'normal', Memory: 'code, data, stack', 'Open files': 'none', 'CPU time': '0 ms' },  // frame 3 PCB: the program counter now points at the entry address
            cap: 'The OS loads the code and data into memory and sets up a <b>stack</b> (scratch space for the program’s function calls and local variables). Code, data, stack and PCB together form the <b>process image</b>.' },  // frame 3 caption: loading code, data and stack forms the process image
          { st: 'ready', edge: 'admit', img: 'mem', cpu: 'other', sec: '3.2', changed: ['State'],  // frame 4: the admit arrow lights up and the process becomes Ready
            pcb: { PID: '7', State: 'Ready', PC: '0x4000 (entry)', Priority: 'normal', Memory: 'code, data, stack', 'Open files': 'none', 'CPU time': '0 ms' },  // frame 4 PCB: state Ready
            cap: '<b>Admit.</b> The process joins the Ready queue. It could run right now; it is just waiting for its turn on the processor.' },  // frame 4 caption: admitted, the process waits in the Ready queue
          { st: 'running', edge: 'dispatch', img: 'mem', cpu: 'p7', sec: '3.2 · 3.4', changed: ['State'],  // frame 5: the dispatch arrow lights up and process 7 is Running on the processor
            pcb: { PID: '7', State: 'Running', PC: 'live in the processor', Priority: 'normal', Memory: 'code, data, stack', 'Open files': 'none', 'CPU time': 'counting' },  // frame 5 PCB: state Running; the program counter is live in the processor
            cap: '<b>Dispatch.</b> The OS loads the process\'s registers into the processor. Its instructions now execute; the program counter moves through its code. (If it runs past its time limit, a <b>timeout</b> sends it back to Ready.)' },  // frame 5 caption: dispatch loads its registers; a timeout would send it back to Ready
          { st: 'blocked', edge: 'wait', img: 'mem', cpu: 'other', sec: '3.2', changed: ['State', 'PC', 'Open files', 'CPU time'],  // frame 6: the event-wait arrow lights up and the process becomes Blocked
            pcb: { PID: '7', State: 'Blocked (disk)', PC: '0x4130 (saved)', Priority: 'normal', Memory: 'code, data, stack', 'Open files': 'notes.txt', 'CPU time': '12 ms' },  // frame 6 PCB: blocked on the disk, with its program counter saved at 0x4130
            cap: '<b>Event wait.</b> It asks to read <i>notes.txt</i> and cannot continue until the disk delivers. The OS saves its registers in the PCB, marks it <b>Blocked</b>, and runs another process.' },  // frame 6 caption: it waits for notes.txt, so the OS saves its registers and runs another process
          { st: 'blocked', susp: true, img: 'disk', swap: true, cpu: 'other', sec: '3.2', changed: ['State', 'Memory'],  // frame 7: the image is swapped out to disk (susp adds the "suspended" ring, swap draws the arrow to disk)
            pcb: { PID: '7', State: 'Blocked/Suspend', PC: '0x4130 (saved)', Priority: 'normal', Memory: 'swapped out to disk', 'Open files': 'notes.txt', 'CPU time': '12 ms' },  // frame 7 PCB: state Blocked/Suspend, memory swapped out
            cap: 'Memory is tight, so the OS <b>swaps</b> this blocked process\'s image out to disk to make room. It is now <b>Blocked/Suspend</b>: still waiting, and out of memory.' },  // frame 7 caption: memory is tight, so the blocked process is swapped out
          { st: 'ready', susp: true, edge: 'occur', img: 'disk', cpu: 'other', sec: '3.2', changed: ['State'],  // frame 8: the event-occurs arrow lights up; the process is ready but still on disk
            pcb: { PID: '7', State: 'Ready/Suspend', PC: '0x4130 (saved)', Priority: 'normal', Memory: 'swapped out to disk', 'Open files': 'notes.txt', 'CPU time': '12 ms' },  // frame 8 PCB: state Ready/Suspend
            cap: '<b>Event occurs.</b> The disk interrupts: the data has arrived. The process waits for nothing now, but its image is still on disk, so it becomes <b>Ready/Suspend</b>.' },  // frame 8 caption: the disk data arrived, so it becomes Ready/Suspend
          { st: 'ready', img: 'mem', load: true, arc: 'swap back in', cpu: 'other', sec: '3.2', changed: ['State', 'Memory'],  // frame 9: the image is loaded back into memory, labeled "swap back in"
            pcb: { PID: '7', State: 'Ready', PC: '0x4130 (saved)', Priority: 'normal', Memory: 'code, data, stack', 'Open files': 'notes.txt', 'CPU time': '12 ms' },  // frame 9 PCB: state Ready with its memory back
            cap: '<b>Activate.</b> When memory frees up, the OS swaps the image back in. The process is <b>Ready</b> again and waits its turn for the processor.' },  // frame 9 caption: activate, the process is swapped in and waits its turn
          { st: 'running', edge: 'dispatch', img: 'mem', cpu: 'p7', sec: '3.4', changed: ['State', 'PC'],  // frame 10: dispatched again and Running
            pcb: { PID: '7', State: 'Running', PC: 'restored: 0x4130', Priority: 'normal', Memory: 'code, data, stack', 'Open files': 'notes.txt', 'CPU time': 'counting' },  // frame 10 PCB: the program counter is restored to 0x4130
            cap: '<b>Process switch.</b> The OS restores the exact register values saved in the PCB, so the process carries on at 0x4130 as if it had never stopped.' },  // frame 10 caption: the process switch restores the saved registers so it carries on where it stopped
          { st: 'exit', edge: 'release', img: 'freed', cpu: 'other', sec: '3.2 · 3.4', changed: ['State', 'Memory', 'Open files', 'CPU time'],  // frame 11: the release arrow lights up and the process reaches Exit
            pcb: { PID: '7', State: 'Exit', PC: '(finished)', Priority: 'normal', Memory: 'released', 'Open files': 'closed', 'CPU time': '30 ms' },  // frame 11 PCB: memory released, files closed, 30 ms of processor time used
            cap: '<b>Release.</b> You close the editor. The OS frees its memory and closes its files, keeps the PCB briefly for accounting, then deletes it. Every step was done by OS code: where that code runs is section 3.5.' },  // frame 11 caption: the OS frees everything, keeps the PCB briefly, then deletes it
        ];  // closes the frame list F
        const N = { new: [20, 20, 'New'], ready: [190, 20, 'Ready'], running: [380, 20, 'Running'], exit: [556, 20, 'Exit'], blocked: [285, 112, 'Blocked'] };  // N: the five state bubbles of the diagram, each as [x, y, label]
        const E = {  // E: the six transition arrows, each as [SVG path, label x, label y, label text, label alignment]
          admit: ['M124 40 H186', 155, 31, 'admit', 'middle'], dispatch: ['M294 33 H376', 335, 25, 'dispatch', 'middle'],  // arrows admit (New to Ready) and dispatch (Ready to Running)
          timeout: ['M380 49 H298', 339, 66, 'timeout', 'middle'], release: ['M484 40 H552', 518, 31, 'release', 'middle'],  // arrows timeout (Running back to Ready) and release (Running to Exit)
          wait: ['M432 60 L380 110', 446, 96, 'event wait', 'start'], occur: ['M298 112 L248 62', 272, 96, 'event occurs', 'end'],  // arrows event wait (Running down to Blocked) and event occurs (Blocked up to Ready)
        };  // closes the arrow table
        const svgWrap = h('div', { class: 'card white ch3-scene' });  // svgWrap: the white card that holds the diagram; draw() replaces its contents on every frame
        function draw(f) {  // draw(f): redraws the whole diagram for frame f
          const node = (k) => { const [x, y, t] = N[k]; const on = f.st === k; return `<rect x="${x}" y="${y}" width="104" height="40" rx="20" class="${on ? 's-proc' : 's-panel'}" stroke-width="${on ? 3 : 1.5}"/><text x="${x + 52}" y="${y + 25}" text-anchor="middle" font-size="14" font-weight="${on ? 800 : 600}">${t}</text>`; };  // node(k): draws one state bubble, filled teal and bolder if it is the frame's current state
          const edge = (k) => { const [d, lx, ly, t, an] = E[k]; const on = f.edge === k; return `<path d="${d}" fill="none" class="${on ? '' : 's-muted'}" style="${on ? 'stroke:var(--proc)' : ''}" stroke-width="${on ? 3 : 2}" marker-end="url(#arr-${on ? 'proc' : 'muted'})"/><text x="${lx}" y="${ly}" text-anchor="${an}" font-size="13" ${on ? 'font-weight="800" style="fill:var(--proc)"' : 'class="s-sub"'}>${t}</text>`; };  // edge(k): draws one arrow, thick and teal if it is the transition that just happened, faint grey otherwise
          const img7 = f.img === 'mem'  // img7: process 7's slot in main memory, holding code, data and stack when loaded
            ? `<rect x="556" y="222" width="92" height="116" rx="8" class="s-proc" stroke-width="2"/><text x="602" y="240" text-anchor="middle" font-size="13" font-weight="800">process 7</text>${['code', 'data', 'stack'].map((t, i) => `<rect x="566" y="${248 + i * 29}" width="72" height="24" rx="5" class="s-panel"/><text x="602" y="${265 + i * 29}" text-anchor="middle" font-size="13">${t}</text>`).join('')}`  // drawn when the image is in memory: a teal box with its code, data and stack parts
            : `<rect x="556" y="222" width="92" height="116" rx="8" class="s-panel" stroke-dasharray="5 4"/><text x="602" y="284" text-anchor="middle" font-size="13" class="s-sub">free</text>`;  // drawn otherwise: a dashed empty slot labeled "free"
          const pcbRows = ['PCB 3', 'PCB 5'].concat(f.pcb ? ['PCB 7'] : []).map((t, i) => `<rect x="354" y="${262 + i * 24}" width="90" height="20" rx="4" class="${t === 'PCB 7' ? 's-proc' : 's-panel'}"/><text x="399" y="${277 + i * 24}" text-anchor="middle" font-size="13" font-weight="${t === 'PCB 7' ? 800 : 400}">${t}</text>`).join('');  // pcbRows: the rows of the OS's process table; PCB 7 appears (in teal) only once the process exists
          const arc = f.load || f.swap ? `<path d="${f.load ? 'M150 222 C 230 168, 470 164, 590 218' : 'M590 218 C 470 164, 230 168, 150 222'}" fill="none" style="stroke:var(--io)" stroke-width="3" stroke-dasharray="8 5" marker-end="url(#arr-io)"/><text x="486" y="174" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--io)">${f.arc || (f.load ? 'load into memory' : 'swap out to disk')}</text>` : '';  // arc: the orange dashed arrow between disk and memory when the image is loaded in or swapped out
          svgWrap.innerHTML = `<svg viewBox="0 0 680 360" width="100%" role="img" aria-label="Five-state diagram with disk, processor and memory">${/* writes the diagram as SVG text into the card; the label describes it for screen readers */''}
            ${Object.keys(E).map(edge).join('')}${Object.keys(N).map(node).join('')}${/* first the six arrows, then the five state bubbles on top of them */''}
            ${!f.susp ? '' : f.st === 'ready' ? '<rect x="184" y="14" width="116" height="52" rx="24" fill="none" style="stroke:var(--io)" stroke-width="2.5" stroke-dasharray="6 4"/><text x="180" y="82" text-anchor="end" font-size="13" font-weight="800" style="fill:var(--io)">+ suspended</text>' : '<rect x="279" y="106" width="116" height="52" rx="24" fill="none" style="stroke:var(--io)" stroke-width="2.5" stroke-dasharray="6 4"/><text x="272" y="137" text-anchor="end" font-size="13" font-weight="800" style="fill:var(--io)">+ suspended</text>'}${/* a dashed orange "+ suspended" ring around Ready or Blocked when the process is swapped out */''}
            <rect x="20" y="190" width="150" height="160" rx="14" class="s-io" stroke-width="2"/><text x="95" y="212" text-anchor="middle" font-size="14" font-weight="800">Disk</text>${/* the disk box at the lower left */''}
            <rect x="34" y="224" width="122" height="34" rx="6" class="s-panel"/><text x="95" y="246" text-anchor="middle" font-size="13">editor (program)</text>${/* the editor program file on the disk */''}
            ${f.img === 'disk' ? '<rect x="34" y="268" width="122" height="66" rx="6" class="s-proc" stroke-dasharray="5 3" stroke-width="2"/><text x="95" y="296" text-anchor="middle" font-size="13" font-weight="800">process 7 image</text><text x="95" y="316" text-anchor="middle" font-size="13" class="s-sub">(swapped out)</text>' : ''}${/* process 7's image on the disk, shown only while it is swapped out */''}
            <rect x="186" y="190" width="130" height="160" rx="14" class="s-cpu" stroke-width="2"/><text x="251" y="212" text-anchor="middle" font-size="14" font-weight="800">Processor</text>${/* the processor box in the middle */''}
            <text x="251" y="252" text-anchor="middle" font-size="13" class="s-sub">now running</text>${/* label "now running" inside the processor */''}
            <text x="251" y="280" text-anchor="middle" font-size="${f.cpu === 'p7' ? 20 : 14}" font-weight="800" ${f.cpu === 'p7' ? 'style="fill:var(--proc)"' : ''}>${f.cpu === 'p7' ? 'process 7' : 'another process'}</text>${/* who is running: "process 7" in large teal text, or "another process" */''}
            ${f.cpu === 'p7' ? '<text x="251" y="306" text-anchor="middle" font-size="13" class="s-sub">PC points into</text><text x="251" y="324" text-anchor="middle" font-size="13" class="s-sub">the editor code</text>' : ''}${/* while process 7 runs, a note that its program counter points into the editor code */''}
            <rect x="332" y="190" width="328" height="160" rx="14" class="s-mem" stroke-width="2"/><text x="496" y="212" text-anchor="middle" font-size="14" font-weight="800">Main memory</text>${/* the main memory box at the right */''}
            <rect x="344" y="222" width="110" height="116" rx="8" class="s-os" stroke-width="2"/><text x="399" y="241" text-anchor="middle" font-size="13" font-weight="800">OS: process</text><text x="399" y="256" text-anchor="middle" font-size="13" font-weight="800">table</text>${pcbRows}${/* the OS's process table inside memory, with the PCB rows drawn above */''}
            <rect x="466" y="222" width="80" height="116" rx="8" class="s-panel"/><text x="506" y="276" text-anchor="middle" font-size="13" class="s-sub">process</text><text x="506" y="292" text-anchor="middle" font-size="13" class="s-sub">3 image</text>${/* another process's image, for comparison */''}
            ${img7}${arc}${/* process 7's memory slot and the disk arrow, drawn above */''}
          </svg>`;  // end of the SVG text
        }  // ends draw()
        const pcbBox = h('div', { class: 'card stack ch3-pcb', style: { gap: '8px' } });  // pcbBox: the card on the right that shows process 7's PCB as a table
        function paintPcb(f) {  // paintPcb(f): rebuilds the PCB card for frame f
          pcbBox.innerHTML = '';  // clears the card first
          pcbBox.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'PCB of process 7'), h('span', { class: 'chip proc' }, 'learn it in ' + f.sec)));  // card header: "PCB of process 7" with a tag naming the section that teaches this frame
          const rows = f.pcb || { PID: '', State: '', PC: '', Priority: '', Memory: '', 'Open files': '', 'CPU time': '' };  // rows: the frame's PCB values, or blank fields when no PCB exists yet
          pcbBox.append(h('table', { class: 'tbl compact' + (f.pcb ? '' : ' ch3-empty'), html: Object.entries(rows).map(([k, v]) => `<tr class="${(f.changed || []).includes(k) ? 'on' : ''}"><td class="b">${k}</td><td>${v || '—'}</td></tr>`).join('') }),  // the table: one row per field, highlighted if it changed in this frame, with a dash for an empty value
            h('p', { class: 'xs muted m0' }, f.pcb ? 'Highlighted rows just changed in this step.' : 'No PCB exists yet: a program on disk has no state, no saved registers and no memory.'),  // a note under the table: which rows just changed, or why there is no PCB yet
            h('div', { class: 'callout why m0 small', 'data-label': 'Why the PCB matters', html: 'It holds everything needed to stop this process and later resume it exactly where it left off. Lose the PCB and the process is lost.' }));  // "Why the PCB matters" callout: it holds everything needed to stop and resume the process
        }  // ends paintPcb()
        const player = ctx.ui.player({ count: F.length, interval: 3400, render: (i) => { draw(F[i]); paintPcb(F[i]); return F[i].cap; } });  // player: the shell's animation player with play, pause and step buttons; each frame redraws both panels and returns its caption
        el.append(h('div', { class: 'stack fill' }, h('div', { class: 'split r grow' }, svgWrap, pcbBox), player.el));  // puts the step on screen: diagram and PCB side by side, the player underneath
      },  // ends render() for the step
    },  // closes the step
  ],  // closes chapter 3's steps list
  notes: `${/* notes: the chapter 3 summary shown in the Notes drawer on its overview step */''}
    <h3>How Chapter 3 fits together</h3>${/* notes heading: how chapter 3 fits together */''}
    <p>Chapter 2 showed that multiprogramming and time sharing need a way to keep many programs in progress at once. The answer is the <b>process</b>, and this chapter describes it from four angles: what it is, what states it passes through, how the OS records it, and how the OS controls it.</p>${/* notes paragraph: the process as the answer to multiprogramming, seen from four angles */''}
    <h4>What a process is (3.1)</h4>${/* notes heading: what a process is (section 3.1) */''}
    <p>A process is a program in execution. The OS tracks each one with a <b>process control block (PCB)</b> holding its identifier, state, priority, program counter, memory pointers, saved register values (context), I/O status and accounting information. Saving the program counter and context data in the PCB is what lets the OS interrupt a process and later resume it.</p>${/* notes paragraph: the process control block and what it holds */''}
    <h4>Its life story (3.2)</h4>${/* notes heading: its life story (section 3.2) */''}
    <p>From the processor's point of view, running processes produce interleaved <b>traces</b> of instructions, with a small <b>dispatcher</b> switching between them. Process models grow step by step. The <b>two-state</b> model (Running, Not Running) cannot tell waiting processes from ready ones, so the <b>five-state</b> model adds New, Ready, Blocked and Exit, with transitions such as admit, dispatch, timeout, event wait, event occurs and release. When memory fills up, the OS may <b>swap</b> processes to disk, giving the <b>suspend</b> states: Ready/Suspend and Blocked/Suspend.</p>${/* notes paragraph: traces, the dispatcher, the two-state, five-state and suspend models */''}
    <h4>How the OS records it (3.3)</h4>${/* notes heading: how the OS records it (section 3.3) */''}
    <p>The OS keeps memory, I/O, file and process tables. Each process has a <b>process image</b>: program code, data, stack and PCB. The PCB's contents fall into three groups: process identification, processor state information and process control information.</p>${/* notes paragraph: the OS tables, the process image and the three groups of PCB contents */''}
    <h4>How the OS controls it (3.4)</h4>${/* notes heading: how the OS controls it (section 3.4) */''}
    <p>The processor has a <b>user mode</b> and a <b>kernel mode</b>. Creating a process takes five steps, from assigning an identifier to building the other data structures. The OS can regain control through an interrupt, a trap or a system call. A <b>mode switch</b> is cheap; a full <b>process switch</b> must save one process's context in its PCB, update queues and restore another's.</p>${/* notes paragraph: user and kernel mode, process creation, mode switches and process switches */''}
    <h4>Where the OS itself runs (3.5) and a real example (3.6)</h4>${/* notes heading: where the OS itself runs (3.5) and a real example (3.6) */''}
    <p>The OS kernel may run outside all processes, inside each user process, or as a set of separate system processes. UNIX SVR4 mostly runs OS code inside user processes, refines the seven-state model into nine process states, splits each process image into user-level, register and system-level context, and creates processes with the <b>fork</b> call.</p>${/* notes paragraph: three ways to run OS code, and process management in UNIX SVR4 */''}
    <h4>Why it matters next</h4>${/* notes heading: why it matters next */''}
    <p>Chapter 4 splits the process in two: the resource owner (still the process) and the unit that runs (the thread).</p>`,  // notes paragraph: chapter 4 splits the process into resource owner and thread; end of the notes text
});  // closes the chapter 3 object and the Guide.chapter call
Guide.chapter({  // registers chapter 4 with the guide
  num: 4,  // num: chapter 4, which sets its order, color (--ch4) and page addresses
  title: 'Threads',  // title shown on the chapter card, overview page and tooltip
  tagline: 'One process, several paths of execution: why that helps, and how real systems build it.',  // tagline printed in the chapter color on the overview page
  intro: '<p>A process bundles two separate ideas: owning resources and being scheduled to run. <span class="t">Threads</span> pull them apart, so one process can run several independent paths of execution that share its memory and files. This chapter compares threads managed by a library inside the program (user-level) with threads managed by the kernel (kernel-level), uses a short formula, Amdahl\'s law, to measure what multicore chips can really gain, and tours thread management in Windows, Solaris, Linux, Android and Mac OS X (today\'s macOS).</p>',  // intro paragraph for the overview page, with key terms marked for pop-up definitions
  objectives: [  // objectives shown on the overview page and in the printed guide
    'Distinguish the process (the unit that owns resources) from the thread (the unit that runs).',  // objective 1: the process owns resources, the thread runs
    'Describe thread states, thread operations and why threads must synchronize.',  // objective 2: thread states, operations and why threads must synchronize
    'Compare user-level threads, kernel-level threads and combined approaches.',  // objective 3: user-level, kernel-level and combined threads
    'Use Amdahl\'s law to estimate the speedup multithreaded software can get from more cores.',  // objective 4: use Amdahl's law to estimate the speedup from more cores
    'Describe thread management in Windows, Solaris, Linux, Android and Mac OS X (Grand Central Dispatch).',  // objective 5: thread management in Windows, Solaris, Linux, Android and Mac OS X
  ],  // closes the objectives list
  terms: [  // chapter 4's glossary entries as [term, definition] pairs
    ['Thread', 'A single path of execution inside a process, with its own program counter, registers, stack and state; all threads of a process share its code, data and resources.'],  // glossary entry: defines a thread
    ['Multithreading', 'The ability of an operating system to support several concurrent threads of execution within a single process.'],  // glossary entry: defines multithreading
    ['Thread control block (TCB)', 'The small record kept for each thread, holding its state, priority and saved register values while it is not running.'],  // glossary entry: defines the thread control block (TCB)
    ['Stack', 'A region of memory that grows and shrinks as functions are called and return, holding return addresses, parameters and local variables; each thread has its own.'],  // glossary entry: defines a stack
    ['Heap', 'The region of a process\'s memory used for data allocated while the program runs; it is shared by all threads of the process.'],  // glossary entry: defines the heap
    ['Address space', 'The range of memory addresses a process may use; every thread in the process works within the same address space.'],  // glossary entry: defines an address space
  ],  // closes the terms list
  css: ` /* chapter 4's own style rules, scoped with .sec-ch4 to its overview steps */
    .sec-ch4 .ch4-scene { display: grid; place-items: center; padding: 6px 8px; } /* .ch4-scene: centers the process diagram inside its card with a little padding */
    .sec-ch4 .ch4-hot, .sec-ch4 .ch4-add { cursor: pointer; outline: none; transition: opacity .2s; } /* clickable parts and the "add thread" slots show a hand cursor and fade smoothly; the default focus outline is removed */
    .sec-ch4 .ch4-hot:hover .fr, .sec-ch4 .ch4-hot:focus-visible .fr { stroke-width: 3; stroke: var(--chc); } /* hovering or keyboard-focusing a part draws its outline thicker and in the chapter color */
    .sec-ch4 .ch4-map.picked .ch4-hot:not(.sel) { opacity: .45; } /* once a part is picked, the other parts fade to 45% so the chosen one stands out */
    .sec-ch4 .ch4-hot.sel .fr { stroke-width: 3.5; stroke: var(--chc); } /* the picked part keeps a thick chapter-colored outline */
    .sec-ch4 .ch4-add:hover rect { stroke: var(--chc); } /* hovering an empty "add thread" slot outlines it in the chapter color */
    .sec-ch4 .ch4-info { min-height: 210px; } /* .ch4-info: the explanation card keeps a minimum height so the buttons above it do not jump */
    .sec-ch4 .ch4-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 10px; height: 100%; } /* .ch4-grid: the twelve sorting cards in step 2, as three columns of equal-height rows filling the left side */
    .sec-ch4 .ch4-item { display: flex; flex-direction: column; justify-content: space-between; gap: 6px; padding: 9px 11px; border: 1.5px solid var(--line); border-radius: 12px; background: var(--panel-2); } /* .ch4-item: one sorting card: name at the top, buttons in the middle, verdict at the bottom */
    .sec-ch4 .ch4-item.ok { border-color: var(--ok); background: var(--ok-bg); } /* a card answered right turns green */
    .sec-ch4 .ch4-item.bad { border-color: var(--bad); background: var(--bad-bg); } /* a card answered wrong turns red */
    .sec-ch4 .ch4-name { font-weight: 700; font-size: 15px; line-height: 1.3; } /* .ch4-name: the name of the part being sorted, bold */
    .sec-ch4 .ch4-why { min-height: 16px; font-weight: 700; } /* .ch4-why: the short verdict line keeps its height even when empty, so the cards do not change size */
    .sec-ch4 .ch4-item.ok .ch4-why { color: var(--ok); } /* the verdict on a right card is green */
    .sec-ch4 .ch4-item.bad .ch4-why { color: var(--bad); } /* the verdict on a wrong card is red */
    .sec-ch4 .ch4-last { min-height: 128px; } /* .ch4-last: the card explaining the latest answer keeps a minimum height so the column does not jump */
    @media (max-width: 760px) { /* @media (max-width: 760px): these rules apply only on windows 760px wide or less */
      .sec-ch4 .ch4-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: auto; height: auto; } /* small window: two columns of cards whose rows fit their content, and the grid grows instead of filling a fixed height */
    } /* ends the small-window rule */
    .sec-ch4 .ch4-pick.proc { background: var(--proc); color: var(--panel); } /* the chosen "Shared" button is filled solid teal (the process color) */
    .sec-ch4 .ch4-pick.thread { background: var(--thread); color: var(--panel); } /* the chosen "Private" button is filled solid pink (the thread color) */
  `,  // end of chapter 4's CSS text
  steps: [  // chapter 4's own overview steps
    {  // step 1 of the chapter 4 overview
      title: 'One process, many threads: what they share',  // title shown at the top of step 1
      kind: 'story',  // kind "story" labels it "Big Picture"
      render(el, ctx) {  // render(el, ctx): builds the process-and-threads diagram when the step is shown
        const { h } = ctx;  // takes the element-building helper h out of ctx
        const PARTS = {  // PARTS: every clickable part of the diagram as [name, shared or private, explanation]
          code: ['Code', 'shared', 'All threads run the same program code, but each can be at a different place in it at the same moment. Watch the T badges.'],  // part "code": shared; each thread can be at a different place in it
          data: ['Global data', 'shared', 'Global variables are visible to every thread. One thread can leave a result for another without asking the OS, which is fast, and also why two threads updating the same variable can clash (Chapter 5).'],  // part "data": shared global variables, fast to share but can clash
          heap: ['Heap', 'shared', 'Memory allocated while the program runs belongs to the process, so any thread holding a pointer to it can use it.'],  // part "heap": shared run-time memory
          files: ['Open files', 'shared', 'A file opened by one thread is open for all of them. If the autosave thread opens report.doc, the print thread can read it too.'],  // part "files": shared open files
          pcb: ['Process control block', 'shared', 'The process\'s own record: its address space (the range of memory addresses it may use), the resources it owns and its access rights. Threads come and go inside it.'],  // part "pcb": the process's own record, shared by all its threads
          tcb: ['Thread control block (TCB)', 'private', 'The small record the OS keeps for each thread: its execution state (Running, Ready or Blocked), its priority, and room to save its registers while it is not running. Section 4.1 covers it.'],  // part "tcb": the thread control block, one per thread
          regs: ['Registers and program counter', 'private', 'Each thread is at its own point in the code, so each needs its own register values, above all its own program counter.'],  // part "regs": registers and program counter, one set per thread
          stack: ['Stack', 'private', 'Each thread calls functions on its own, so each needs its own stack of return addresses and local variables. The bars show how deep its calls go right now.'],  // part "stack": one stack per thread
        };  // closes the PARTS table
        const FNS = ['main()', 'readKeys()', 'drawScreen()', 'spellCheck()', 'autosave()', 'printPage()'];  // FNS: the six functions of the pretend word processor, listed in the Code box
        const DEPTH = { 'main()': 1, 'readKeys()': 2, 'drawScreen()': 3, 'spellCheck()': 3, 'autosave()': 2, 'printPage()': 2 };  // DEPTH: how many stack frames each function uses, drawn as bars in each thread's stack
        const TH = [  // TH: the four threads; each has a role and a looping sequence of [function it is in, 1 if blocked]
          { role: 'reads keystrokes', seq: [['readKeys()', 0], ['drawScreen()', 0], ['readKeys()', 1], ['readKeys()', 0]] },  // thread 1 reads keystrokes and sometimes waits for a key
          { role: 'checks spelling', seq: [['spellCheck()', 0], ['spellCheck()', 0], ['drawScreen()', 0], ['spellCheck()', 0]] },  // thread 2 checks spelling and never blocks
          { role: 'autosaves', seq: [['autosave()', 0], ['autosave()', 1], ['autosave()', 1], ['autosave()', 1]] },  // thread 3 autosaves and is usually waiting on the disk
          { role: 'prints', seq: [['printPage()', 0], ['printPage()', 1], ['printPage()', 1], ['drawScreen()', 0]] },  // thread 4 prints and is often waiting on the printer
        ];  // closes the TH list
        let n = 3, t = 0, sel = null, playing = true;  // the step's state: n threads shown, t the animation tick, sel the picked part, and whether motion is playing
        const hot = (id, inner) => `<g class="hot ch4-hot${sel === id ? ' sel' : ''}" data-p="${id}" tabindex="0" role="button" aria-label="${PARTS[id][0]}">${inner}</g>`;  // hot(id, inner): wraps a drawing in an SVG group that can be clicked or reached with Tab; the picked one gets "sel"
        const box = (x, y, w, hh, cls, title, sub) => `<rect class="fr ${cls}" x="${x}" y="${y}" width="${w}" height="${hh}" rx="9" stroke-width="1.5"/><text x="${x + 12}" y="${y + 22}" font-size="14" font-weight="800">${title}</text>${sub ? `<text x="${x + 12}" y="${y + 41}" font-size="13" class="s-sub">${sub}</text>` : ''}`;  // box(...): draws a labeled rectangle with a title and optional grey subtitle, used for the shared parts
        const wrap = h('div', { class: 'card white ch4-scene' });  // wrap: the white card that holds the diagram; draw() replaces its contents
        function states() {  // states(): works out, for the current tick, where each thread is and whether it is Running, Ready or Blocked
          const cur = TH.slice(0, n).map((th, i) => { const [fn, blk] = th.seq[(t + i) % th.seq.length]; return { fn, blk, i }; });  // for each shown thread, picks its current function and blocked flag from its sequence (offset by its number)
          const cand = cur.filter((c) => !c.blk);  // cand: the threads that are not blocked and so could run
          const run = cand.length ? cand[t % cand.length].i : -1;  // run: which one of them runs on the single core this tick, taking turns as t grows (-1 if all are blocked)
          return cur.map((c) => ({ ...c, st: c.blk ? 'Blocked' : c.i === run ? 'Running' : 'Ready' }));  // labels each thread Blocked, Running or Ready
        }  // ends states()
        function draw() {  // draw(): redraws the whole diagram; runs on every tick and after every click
          const S = states();  // S: the thread states for this tick
          const codeLines = FNS.map((f, k) => {  // codeLines: one line per function in the Code box, followed by badges for the threads now inside it
            const y = 104 + k * 21;  // the line's height in the drawing
            const here = S.filter((s) => s.fn === f);  // here: the threads currently in this function
            return `<text x="36" y="${y}" font-size="13" class="s-monot">${f}</text>` + here.map((s, j) => `<rect x="${150 + j * 29}" y="${y - 13}" width="26" height="17" rx="5" class="s-thread" stroke-width="${s.st === 'Running' ? 2.5 : 1}"/><text x="${163 + j * 29}" y="${y}" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--thread)">T${s.i + 1}</text>`).join('');  // the function name, then a pink "T1", "T2"... badge for each thread there, with a thicker border for the running one
          }).join('');  // joins all the code lines into one piece of SVG text
          const threads = [0, 1, 2, 3].map((i) => {  // threads: the four thread slots along the bottom of the diagram
            const x = 22 + i * 156, y = 280;  // each slot's position, side by side
            if (i >= n) return `<g class="ch4-add" data-add="${i + 1}" role="button" tabindex="0" aria-label="Add thread"><rect x="${x}" y="${y}" width="146" height="172" rx="12" class="s-panel" stroke-dasharray="6 5"/><text x="${x + 73}" y="${y + 90}" text-anchor="middle" font-size="14" class="s-sub">+ add thread ${i + 1}</text></g>`;  // a slot beyond n is drawn as a dashed "+ add thread" box that can be clicked
            const s = S[i];  // s is this thread's state
            const bars = Array.from({ length: DEPTH[s.fn] }, (_, k) => `<rect x="${x + 70}" y="${y + 154 - k * 12}" width="60" height="9" rx="3" class="s-thread" stroke-width="1"/>`).join('');  // bars: one small bar per stack frame of the function it is in, stacked upward
            return `<rect x="${x}" y="${y}" width="146" height="172" rx="12" class="s-thread" stroke-width="${s.st === 'Running' ? 3 : 1.5}"/>${/* the thread's pink box, with a thicker border when it is running */''}
              <text x="${x + 10}" y="${y + 20}" font-size="14" font-weight="800">Thread ${i + 1}</text><text x="${x + 10}" y="${y + 37}" font-size="13" class="s-sub">${TH[i].role}</text>${/* its name and role */''}
              ${hot('tcb', `<rect class="fr s-panel" x="${x + 8}" y="${y + 46}" width="130" height="30" rx="6"/><text x="${x + 16}" y="${y + 66}" font-size="13">TCB: <tspan font-weight="800" style="fill:var(--${s.st === 'Running' ? 'ok' : s.st === 'Blocked' ? 'intr' : 'ink-2'})">${s.st}</tspan></text>`)}${/* clickable TCB row showing its state in green (Running), red (Blocked) or grey (Ready) */''}
              ${hot('regs', `<rect class="fr s-panel" x="${x + 8}" y="${y + 82}" width="130" height="30" rx="6"/><text x="${x + 16}" y="${y + 102}" font-size="13" class="s-monot">PC→${s.fn.replace('()', '')}</text>`)}${/* clickable registers row showing where its program counter points */''}
              ${hot('stack', `<rect class="fr s-panel" x="${x + 8}" y="${y + 118}" width="130" height="46" rx="6"/><text x="${x + 16}" y="${y + 146}" font-size="13">Stack</text>${bars}`)}`;  // clickable stack row with the stack bars
          }).join('');  // joins the four slots into one piece of SVG text
          wrap.innerHTML = `<svg viewBox="0 0 660 470" width="100%" class="ch4-map${sel ? ' picked' : ''}" role="img" aria-label="A process with shared code, data, heap and files, and one to four threads each with its own TCB, registers and stack">${/* writes the diagram as SVG text; "picked" fades the unpicked parts; the label describes it for screen readers */''}
            <rect x="6" y="6" width="648" height="458" rx="16" class="s-proc" stroke-width="2"/>${/* the teal outline of the whole process */''}
            <text x="22" y="30" font-size="13" font-weight="800" style="fill:var(--proc)">PROCESS: ONE ADDRESS SPACE, ONE SET OF RESOURCES</text>${/* title across the top: one address space, one set of resources */''}
            <text x="22" y="52" font-size="13" font-weight="800" class="s-sub">SHARED BY EVERY THREAD</text>${/* small label over the shared parts */''}
            ${hot('code', `<rect class="fr s-panel" x="22" y="60" width="252" height="192" rx="9" stroke-width="1.5"/><text x="34" y="80" font-size="14" font-weight="800">Code</text>${codeLines}`)}${/* clickable part: the Code box with its function lines and thread badges */''}
            ${hot('data', box(288, 60, 170, 92, 's-panel', 'Global data', 'document text'))}${/* clickable part: global data */''}
            ${hot('heap', box(288, 160, 170, 92, 's-panel', 'Heap', 'run-time memory'))}${/* clickable part: the heap */''}
            ${hot('files', box(470, 60, 170, 92, 's-panel', 'Open files', 'report.doc'))}${/* clickable part: open files */''}
            ${hot('pcb', box(470, 160, 170, 92, 's-os', 'Process PCB', 'address space, rights'))}${/* clickable part: the process PCB, drawn in OS purple */''}
            <text x="22" y="272" font-size="13" font-weight="800" class="s-sub">PRIVATE TO EACH THREAD</text>${/* small label over the per-thread parts */''}
            ${threads}${/* the thread slots built above */''}
          </svg>`;  // end of the SVG text
        }  // ends draw()
        const act = (e) => {  // act(e): handles a click or key press anywhere on the diagram
          const g = e.target.closest && e.target.closest('.ch4-hot, .ch4-add');  // finds the clickable part or "add thread" slot the event came from, if any
          if (!g) return;  // ignores clicks on empty space
          if (g.dataset.add) setN(+g.dataset.add); else pick(g.dataset.p);  // an "add thread" slot sets the thread count; any other part is picked
        };  // ends act
        ctx.on(wrap, 'click', act);  // listens for clicks on the whole card (one listener serves every part, even after redraws)
        ctx.on(wrap, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(e); } });  // pressing Enter or Space on a focused part works like a click
        const info = h('div', { class: 'card white ch4-info', 'aria-live': 'polite' });  // info: the explanation card on the right; screen readers read changes aloud
        function paintInfo() {  // paintInfo(): fills the explanation card for the picked part, or with the general idea if nothing is picked
          if (!sel) {  // nothing picked yet:
            info.innerHTML = '<h3>The idea</h3><p class="small m0">A word processor is one process: one program, one document, one set of files. Inside it, several <span class="t">threads</span> run independently: one reads your keystrokes while another checks spelling. Each thread box shows its <b>TCB</b> (thread control block: the small record the OS keeps for each thread, holding its state), its program counter and its stack. Click any part of the picture: is it shared, or does each thread get its own?</p>';  // show the general idea: a word processor as one process with several threads, and an invitation to click
            return;  // and stop here
          }  // ends the nothing-picked case
          const [name, kind, d] = PARTS[sel];  // unpacks the picked part's name, kind (shared or private) and explanation
          info.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="m0">${name}</h3><span class="chip ${kind === 'shared' ? 'proc' : 'thread'}">${kind === 'shared' ? 'shared by all threads' : 'one per thread'}</span></div><p class="small mt m0">${d}</p>`;  // shows the part's name with a teal "shared by all threads" or pink "one per thread" tag, then its explanation
        }  // ends paintInfo()
        function pick(id) { sel = sel === id ? null : id; draw(); paintInfo(); ctx.refit(); }  // pick(id): picks a part, or un-picks it if it was already picked, then redraws and re-checks the fit
        const seg = ctx.ui.seg([1, 2, 3, 4].map((k) => ({ value: k, label: k + (k === 1 ? ' thread' : ' threads') })), n, (v) => setN(v));  // seg: the switch for showing 1 to 4 threads
        function setN(v) { n = v; seg.set(v); draw(); }  // setN(v): changes the number of threads, keeps the switch in step (clicking an "add thread" slot also calls this) and redraws
        const playBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { playing = !playing; paintPlay(); } });  // playBtn: pauses or resumes the automatic motion of the threads
        const paintPlay = () => { playBtn.textContent = playing ? 'Pause motion' : 'Resume motion'; };  // paintPlay(): sets the play button's label to match whether motion is on
        const stepBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { t++; draw(); } }, 'Step once');  // stepBtn: moves the animation forward one tick by hand
        ctx.every(1300, () => { if (playing) { t++; draw(); } });  // every 1.3 seconds, if motion is on, advance one tick and redraw; ctx.every stops the timer when the student leaves
        const right = h('div', { class: 'stack' },  // right: the column of controls and explanations
          h('div', { class: 'row' }, seg),  // the thread-count switch
          h('div', { class: 'row' }, playBtn, stepBtn, h('span', { class: 'xs muted' }, 'one core: one thread runs at a time')),  // the motion buttons and a note that only one thread runs at a time on one core
          info,  // the explanation card
          h('div', { class: 'callout why m0 small', 'data-label': 'Why threads?', html: 'Compared with separate processes, threads are quicker to create, quicker to end and quicker to switch between, and they share memory without asking the kernel.' }),  // "Why threads?" callout: cheaper to create, end and switch than processes
          h('div', { class: 'callout warn m0 small', 'data-label': 'The catch', html: 'Because threads share everything, one can trample another\'s data. Keeping them in step is the subject of Chapter 5.' }));  // "The catch" callout: shared data can be trampled, which leads to chapter 5
        el.append(h('div', { class: 'split r fill' }, wrap, right));  // puts the step on screen: diagram on the larger left side, column on the right
        paintPlay(); draw(); paintInfo();  // sets the play label, draws the diagram and fills the explanation for the first time
      },  // ends render() for step 1
    },  // closes step 1
    {  // step 2 of the chapter 4 overview
      title: 'Shared or private? Sort the parts of a process',  // title shown at the top of step 2
      kind: 'explore',  // kind "explore" labels it "Explore"
      render(el, ctx) {  // render(el, ctx): builds the sorting activity when the step is shown
        const { h } = ctx;  // takes the element-building helper h out of ctx
        // [item, 0 = shared by all threads, 1 = private to each thread, reason]
        const ITEMS = [  // ITEMS: twelve parts of a multithreaded process to sort, each as [name, 0 shared or 1 private, reason]
          ['Program code', 0, 'There is one copy of the program; every thread executes instructions from it.'],  // item: program code, shared
          ['Program counter', 1, 'Each thread is at its own place in the code, so each has its own program counter.'],  // item: program counter, private
          ['Global variables', 0, 'They live in the process\'s data area, visible to every thread.'],  // item: global variables, shared
          ['Stack', 1, 'Each thread makes its own function calls, so each needs its own stack.'],  // item: stack, private
          ['Open files', 0, 'Files belong to the process; a file one thread opens is open for all of them.'],  // item: open files, shared
          ['Register values', 1, 'Each thread has its own saved register set, restored when it is next run.'],  // item: register values, private
          ['Heap (memory requested while running)', 0, 'Memory the program asks for while it runs belongs to the process as a whole, so any thread holding its address can use it.'],  // item: the heap, shared
          ['Execution state (Running, Ready, Blocked)', 1, 'One thread can be blocked on the disk while another runs, so state is kept per thread.'],  // item: execution state, private
          ['Address space', 0, 'All threads live inside the same address space; that is what makes sharing cheap.'],  // item: address space, shared
          ['Local variables of the current function', 1, 'Locals live on the stack, and each thread has its own stack.'],  // item: local variables, private
          ['Process identifier (PID)', 0, 'The PID names the process, and every thread in it belongs to that one process.'],  // item: the process identifier, shared
          ['Where to return when the current function ends', 1, 'That return address is saved on the stack when the function is called, and each thread has its own stack.'],  // item: the return address, private
        ];  // closes the ITEMS list
        const ans = ITEMS.map(() => null);  // ans: the student's answer for each item; null means not sorted yet
        const score = h('div', { class: 'big' });  // score: the big "7 / 12" count of right answers
        const scoreSub = h('div', { class: 'small muted' });  // scoreSub: the line under the score saying how far along the student is
        const last = h('div', { class: 'card white ch4-last', 'aria-live': 'polite' });  // last: the card that explains the answer just given; screen readers read it aloud
        const cards = ITEMS.map((it, i) => {  // cards: builds one sorting card per item
          const why = h('div', { class: 'xs ch4-why' });  // why: the short verdict line at the bottom of the card
          const mk = (v, label) => h('button', { class: 'btn sm ' + (v ? 'thread' : 'proc'), type: 'button', onclick: () => answer(i, v) }, label);  // mk(v, label): makes one answer button, teal for Shared and pink for Private, that records answer v
          const btns = [mk(0, 'Shared'), mk(1, 'Private')];  // the card's two buttons
          const c = h('div', { class: 'ch4-item' }, h('div', { class: 'ch4-name' }, it[0]), h('div', { class: 'row gap-s' }, ...btns), why);  // the card: the item's name, the two buttons in a row, then the verdict line
          c.why = why; c.btns = btns;  // keeps handles on the verdict line and buttons for paint()
          return c;  // gives the finished card back
        });  // ends the list of cards
        function answer(i, v) {  // answer(i, v): records answer v for item i, explains it, and redraws
          ans[i] = v;  // stores the answer
          const ok = v === ITEMS[i][1];  // ok is true when the answer matches the right one
          last.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="m0">${ITEMS[i][0]}</h3><span class="chip ${ok ? 'ok' : 'bad'}">${ok ? '✓ correct' : '✗ not quite'}</span></div>${/* explanation card: the item's name with a "correct" or "not quite" tag */''}
            <p class="small mt m0"><b>${ITEMS[i][1] ? 'Private to each thread.' : 'Shared by all threads.'}</b> ${ITEMS[i][2]}</p>`;  // then the right answer in bold and the reason
          paint();  // redraws the cards and the score
        }  // ends answer()
        function paint() {  // paint(): recolors every card and recounts the score
          let right = 0, done = 0;  // right counts correct answers, done counts sorted items
          cards.forEach((c, i) => {  // goes through every card
            const a = ans[i];  // a is this card's answer
            c.classList.remove('ok', 'bad');  // clears the old green or red color
            c.btns.forEach((b, v) => b.classList.toggle('ch4-pick', a === v));  // fills the button the student chose
            if (a === null) { c.why.textContent = ''; return; }  // an unsorted card shows no verdict and is skipped
            done++;  // counts it as sorted
            const ok = a === ITEMS[i][1];  // checks it against the right answer
            if (ok) right++;  // counts it if right
            c.classList.add(ok ? 'ok' : 'bad');  // colors the card green or red
            c.why.textContent = ok ? (a ? '✓ private' : '✓ shared') : (ITEMS[i][1] ? '✗ it is private' : '✗ it is shared');  // writes a short verdict: a check with the answer if right, or what it really is if wrong
          });  // ends the loop over cards
          score.textContent = `${right} / ${ITEMS.length}`;  // shows the score as right out of twelve
          scoreSub.textContent = done < ITEMS.length ? `${done} of ${ITEMS.length} sorted. Change an answer any time.` : right === ITEMS.length ? 'All correct. You can tell a process from a thread.' : 'All sorted. Fix the red ones.';  // progress line: how many are sorted, or a final message once all are sorted
          ctx.refit();  // asks the shell to re-check that the step still fits
        }  // ends paint()
        const reset = h('button', { class: 'btn sm', type: 'button', onclick: () => { ans.fill(null); last.innerHTML = '<p class="small muted m0">Your explanation for each answer appears here.</p>'; paint(); } }, 'Start over');  // "Start over" button: clears every answer, resets the explanation card and redraws
        last.innerHTML = '<p class="small muted m0">Your explanation for each answer appears here.</p>';  // the explanation card's starting hint
        el.append(h('div', { class: 'split r fill' },  // puts the step on screen:
          h('div', { class: 'ch4-grid' }, ...cards),  // on the left, the grid of twelve cards
          h('div', { class: 'stack' },  // on the right, a column holding:
            h('p', { class: 'lead m0' }, 'For each part of a multithreaded process, decide: is there one copy for the whole process, or one per thread?'),  // the task in one sentence
            h('div', { class: 'row', style: { alignItems: 'baseline' } }, score, h('span', { class: 'small b' }, 'correct')), scoreSub,  // the score with the word "correct"
            last,  // the explanation card
            h('div', { class: 'callout tip m0 small', 'data-label': 'Rule of thumb', html: 'Whatever a thread needs to keep its own place in the program (program counter, registers, stack, state) is private. Everything the program owns (code, data, files, memory) is shared.' }),  // "Rule of thumb" callout: what keeps a thread's place is private, what the program owns is shared
            h('div', { class: 'row' }, reset))));  // the Start over button
        paint();  // draws the starting score
      },  // ends render() for step 2
    },  // closes step 2
  ],  // closes chapter 4's steps list
  notes: `${/* notes: the chapter 4 summary shown in the Notes drawer on its overview steps */''}
    <h3>How Chapter 4 fits together</h3>${/* notes heading: how chapter 4 fits together */''}
    <p>Chapter 3 treated the process as one thing. This chapter splits it into two ideas: the process as the owner of resources (address space, files, devices) and the <b>thread</b> as the unit that is scheduled and runs.</p>${/* notes paragraph: the process splits into resource owner and thread */''}
    <h4>The idea (4.1)</h4>${/* notes heading: the idea (section 4.1) */''}
    <p>In a multithreaded process, all threads share the code, data, heap, open files and address space. Each thread keeps its own program counter, registers, stack, execution state and a small <b>thread control block</b>. Compared with separate processes, threads are quicker to create, end and switch between, and they communicate through shared memory without calling the kernel. Threads have states (Running, Ready, Blocked) and operations (spawn, block, unblock, finish). Because they share data, they must <b>synchronize</b>, which leads straight into Chapter 5.</p>${/* notes paragraph: what threads share and keep private, their states, and why they must synchronize */''}
    <h4>Who manages threads (4.2)</h4>${/* notes heading: who manages threads (section 4.2) */''}
    <p><b>User-level threads</b> live in a library inside the process. Switching them needs no kernel help, but one blocking system call can stall them all and they cannot run on two processors at once. <b>Kernel-level threads</b> are known to the OS, so they can block independently and run in parallel, at the cost of a mode switch per thread switch. <b>Combined</b> designs map many user threads onto a smaller or equal number of kernel threads.</p>${/* notes paragraph: user-level, kernel-level and combined threads compared */''}
    <h4>What more cores can buy (4.3)</h4>${/* notes heading: what more cores can buy (section 4.3) */''}
    <p><b>Amdahl's law</b> limits the speedup: if a fraction f of a program can run in parallel on N processors, speedup = 1 / ((1 − f) + f / N). Even a small serial part caps the gain. Worked example: with f = 0.9 and N = 8, speedup = 1 / (0.1 + 0.1125) ≈ 4.7, far short of 8.</p>${/* notes paragraph: Amdahl's law with a worked example showing why 8 cores give less than 8 times the speed */''}
    <h4>Real systems (4.4 to 4.8)</h4>${/* notes heading: real systems (sections 4.4 to 4.8) */''}
    <p>Each case study answers the same questions differently. <b>Windows</b> builds processes and threads as objects and gives threads a larger set of states. <b>Solaris</b> layers user threads, lightweight processes and kernel threads. <b>Linux</b> treats both as tasks created by clone, with flags choosing what is shared. <b>Android</b> organises apps into components and processes with a life cycle. <b>Mac OS X Grand Central Dispatch</b> lets programmers submit blocks of work to queues and leaves thread management to the system.</p>${/* notes paragraph: how Windows, Solaris, Linux, Android and Mac OS X each handle threads */''}
    <h4>Why it matters next</h4>${/* notes heading: why it matters next */''}
    <p>Threads and processes that share data can interfere with one another. Chapter 5 shows how to keep them correct.</p>`,  // notes paragraph: sharing data leads to chapter 5; end of the notes text
});  // closes the chapter 4 object and the Guide.chapter call
Guide.chapter({  // registers chapter 5 with the guide
  num: 5,  // num: chapter 5, which sets its order, color (--ch5) and page addresses
  title: 'Concurrency: Mutual Exclusion and Synchronization',  // title shown on the chapter card, overview page and tooltip
  tagline: 'When threads share data, timing decides the result. Here is how to make them take turns safely.',  // tagline printed in the chapter color on the overview page
  intro: '<p>When several processes or threads are in progress at the same time (<span class="t">concurrency</span>) and share data, the result can depend on the exact order in which their instructions happen to interleave. This chapter first tries to make two processes take turns using nothing but ordinary reads and writes, then steps back to see how timing produces a <span class="t">race condition</span> and what any correct solution must guarantee. It then builds stronger tools for <span class="t">mutual exclusion</span> and synchronization: special hardware instructions, semaphores, monitors and message passing, ending with the classic readers/writers problem.</p>',  // intro paragraph for the overview page, with key terms marked for pop-up definitions
  objectives: [  // objectives shown on the overview page and in the printed guide
    'Explain race conditions, the OS concerns they raise and the requirements for mutual exclusion.',  // objective 1: race conditions, the OS concerns and the requirements for mutual exclusion
    'Trace software solutions to mutual exclusion, including Dekker\'s and Peterson\'s algorithms.',  // objective 2: software solutions, including Dekker's and Peterson's algorithms
    'Explain hardware support: disabling interrupts and special atomic instructions.',  // objective 3: hardware support: disabling interrupts and atomic instructions
    'Use semaphores, monitors and message passing to synchronize processes.',  // objective 4: semaphores, monitors and message passing
    'Solve the producer/consumer and readers/writers problems.',  // objective 5: the producer/consumer and readers/writers problems
  ],  // closes the objectives list
  terms: [  // chapter 5's glossary entries as [term, definition] pairs
    ['Concurrency', 'Several processes or threads being in progress at the same time, either taking turns on one processor or running at once on several, and possibly sharing data and resources.'],  // glossary entry: defines concurrency
    ['Multiprocessing', 'Managing many processes on a computer with several processors that share main memory, so that processes can truly run at the same instant.'],  // glossary entry: defines multiprocessing
    ['Distributed processing', 'Managing many processes spread across several separate computers, each with its own memory, that cooperate over a network.'],  // glossary entry: defines distributed processing
    ['Interleaving', 'Running several processes on one processor by switching between them, so their instructions take turns rather than running at the same instant.'],  // glossary entry: defines interleaving
    ['Overlapping', 'Running several processes at literally the same moment on different processors.'],  // glossary entry: defines overlapping
    ['Atomic operation', 'One or more steps carried out as a single indivisible unit: no other process can see a halfway state or cut in partway through.'],  // glossary entry: defines an atomic operation
    ['Critical section', 'A piece of code that uses a shared resource and must not run while another process is running its own code for that same resource.'],  // glossary entry: defines a critical section
    ['Deadlock', 'Two or more processes are each waiting for something that only another member of the group can provide, so none of them can ever proceed.'],  // glossary entry: defines deadlock
    ['Livelock', 'Two or more processes keep changing state in reaction to each other, staying busy but never getting any useful work done.'],  // glossary entry: defines livelock
    ['Mutual exclusion', 'The rule that while one process is inside a critical section for a shared resource, no other process may be inside one for the same resource.'],  // glossary entry: defines mutual exclusion
    ['Race condition', 'Several processes or threads read and write shared data, and the final result depends on the exact timing of their steps.'],  // glossary entry: defines a race condition
    ['Starvation', 'A process that is able to run is passed over again and again, indefinitely, even though the system as a whole keeps making progress.'],  // glossary entry: defines starvation
  ],  // closes the terms list
  css: ` /* chapter 5's own style rules, scoped with .sec-ch5 to its overview steps */
    .sec-ch5 .ch5-vis { display: grid; place-items: center; padding: 8px 10px; flex: 1; min-height: 0; } /* .ch5-vis: the timeline card grows to fill the spare height and centers its drawing */
    .sec-ch5 .ch5-cap { min-height: 70px; } /* .ch5-cap: the caption under the timeline keeps a minimum height so the column does not jump between modes */
    .sec-ch5 .ch5-slide { gap: 14px; } /* .ch5-slide: the row holding the time slider and the "at this instant" text, with a 14px gap */
    .sec-ch5 .ch5-slide .ui-slider { flex: 0 0 330px; } /* the slider itself keeps a fixed 330px width in that row */
    .sec-ch5 .ch5-slide output { display: none; } /* hides the slider's number readout, since the text beside it says what is happening instead */
    .sec-ch5 .ch5-now { flex: 1; min-height: 42px; line-height: 1.4; } /* .ch5-now: the "at this instant" text takes the rest of the row and keeps room for two lines */
    @media (max-width: 760px) { /* @media (max-width: 760px): these rules apply only on windows 760px wide or less */
      .sec-ch5 .ch5-slide { flex-wrap: wrap; } /* small window: the slider and its text may wrap onto two lines */
      .sec-ch5 .ch5-slide .ui-slider { flex: 1 1 100%; } /* small window: the slider takes the full width of its line */
      .sec-ch5 .ch5-terms { grid-template-columns: repeat(2, minmax(0, 1fr)); } /* small window: the word buttons in step 2 go two per row instead of four */
    } /* ends the small-window rules */
    .sec-ch5 .ch5-ctx { display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 9px 12px; border: 1px solid var(--line); border-left: 4px solid var(--line-2); border-radius: 10px; background: var(--panel-2); cursor: pointer; color: var(--ink); font-size: 15.5px; line-height: 1.35; } /* .ch5-ctx: one clickable "where concurrency comes from" button: number badge beside the text, with a thick left edge */
    .sec-ch5 .ch5-ctx:hover { border-color: var(--chc); } /* hovering one of those buttons outlines it in the chapter color */
    .sec-ch5 .ch5-ctx.on { border-color: var(--chc); border-left-color: var(--chc); background: color-mix(in srgb, var(--chc) 9%, var(--panel)); } /* the chosen one gets a chapter-colored outline and left edge and a light tint of the same color */
    .sec-ch5 .ch5-n { flex: none; display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--panel-3); font-weight: 800; font-size: 13px; } /* .ch5-n: the round number badge used in the context buttons and the scenario list */
    .sec-ch5 .ch5-ctx.on .ch5-n { background: var(--chc); color: var(--panel); } /* the chosen context button's badge is filled with the chapter color */
    .sec-ch5 .ch5-d { display: block; margin-top: 4px; font-weight: 400; } /* .ch5-d: the description that opens under the chosen context's name, on its own line in normal weight */
    .sec-ch5 .ch5-sc { min-height: 150px; border-left: 5px solid var(--chc); } /* .ch5-sc: the scenario card in step 2 keeps a minimum height and has a thick chapter-colored left edge */
    .sec-ch5 .ch5-text { font-size: 18px; line-height: 1.5; margin-top: 6px !important; } /* .ch5-text: the scenario story in large, easy-to-read text */
    .sec-ch5 .ch5-terms { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; } /* .ch5-terms: the seven word buttons laid out four per row */
    .sec-ch5 .ch5-term { white-space: normal; height: auto; min-height: 40px; padding: 4px 10px; line-height: 1.2; } /* .ch5-term: each word button may wrap onto two lines and grows to fit */
    .sec-ch5 .ch5-term.ok { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); } /* a word button chosen correctly turns green */
    .sec-ch5 .ch5-term.bad { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); } /* a word button chosen wrongly turns red */
    .sec-ch5 .ch5-fb { min-height: 96px; } /* .ch5-fb: the feedback callout keeps a minimum height so the buttons around it do not jump */
    .sec-ch5 .ch5-list { display: flex; flex-direction: column; gap: 6px; } /* .ch5-list: the list of seven scenarios on the right, stacked with small gaps */
    .sec-ch5 .ch5-row { display: flex; align-items: center; gap: 10px; text-align: left; padding: 7px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); cursor: pointer; color: var(--ink); font-size: 14.5px; font-weight: 600; } /* .ch5-row: one clickable scenario row: number badge, short name and result, bold and left-aligned */
    .sec-ch5 .ch5-row:hover { border-color: var(--chc); } /* hovering a scenario row outlines it in the chapter color */
    .sec-ch5 .ch5-row.on { border-color: var(--chc); box-shadow: 0 0 0 1px var(--chc); background: color-mix(in srgb, var(--chc) 8%, var(--panel)); } /* the scenario on screen now gets a chapter-colored outline and a light tint */
  `,  // end of chapter 5's CSS text
  steps: [  // chapter 5's own overview steps
    {  // step 1 of the chapter 5 overview
      title: 'Where concurrency comes from',  // title shown at the top of step 1
      kind: 'story',  // kind "story" labels it "Big Picture"
      render(el, ctx) {  // render(el, ctx): builds the three-timelines step when it is shown
        const { h } = ctx;  // takes the element-building helper h out of ctx
        const MODES = {  // MODES: the three ways many processes can run, each with a switch label and a caption
          mp: { label: 'Multiprogramming', cap: '<span class="t">Multiprogramming</span>: <b>one processor, many processes.</b> Their instructions <b>interleave</b>: only one runs at any instant, but all of them are in progress, and the OS decides who goes next.' },  // mode "mp": multiprogramming, where one processor interleaves many processes
          mproc: { label: 'Multiprocessing', cap: '<span class="t">Multiprocessing</span>: <b>several processors sharing one memory.</b> Instructions can now <b>overlap</b>: two processes really do run at the same instant, and both can touch the same memory.' },  // mode "mproc": multiprocessing, where several processors overlap in time and share memory
          dist: { label: 'Distributed processing', cap: '<span class="t">Distributed processing</span>: <b>separate computers joined by a network</b>, each with its own memory. Processes on different machines run at the same time and cooperate by sending messages.' },  // mode "dist": distributed processing, where separate computers cooperate by messages
        };  // closes the MODES table
        const CTX = [  // CTX: the three places concurrency comes from, each as [name, explanation, example]
          ['Multiple applications', 'Multiprogramming lets many separate applications share the processor. They were written independently, yet they compete for the same processor, memory, files and devices.', 'A browser, a music player and a download all running on your laptop.'],  // context 1: multiple applications sharing one machine
          ['Structured applications', 'Good design often splits one application into cooperating parts. Once a program is written as a set of concurrent processes or threads, those parts must coordinate.', 'A web server that handles each visitor with its own thread.'],  // context 2: structured applications built as cooperating parts
          ['Operating system structure', 'Operating systems are themselves built as sets of processes and threads, so the OS faces exactly the same problems as the programs it runs.', 'Kernel threads that write data to disk and handle the network in the background.'],  // context 3: the operating system's own structure
        ];  // closes the CTX list
        let mode = 'mp', pickCtx = 0, at = 205;  // the step's state: which mode is shown, which context is open, and the instant on the timeline (0 to 439)
        const nowTxt = h('div', { class: 'small ch5-now' });  // nowTxt: the sentence saying which processes run at the chosen instant
        const vis = h('div', { class: 'card white ch5-vis' });  // vis: the white card holding the timeline drawing
        const cap = h('div', { class: 'player-cap ch5-cap' });  // cap: the caption under the timeline, styled like an animation player's caption
        // segments: [lane, start, length, process]
        const SEGS = {  // SEGS: for each mode, the blocks of processor time, each as [lane, start, length, process name]
          mp: [[0, 0, 60, 'A'], [0, 60, 50, 'B'], [0, 110, 70, 'C'], [0, 180, 50, 'A'], [0, 230, 60, 'B'], [0, 290, 40, 'C'], [0, 330, 60, 'A'], [0, 390, 50, 'B']],  // multiprogramming: A, B and C take turns on one lane
          mproc: [[0, 0, 150, 'A'], [0, 150, 120, 'C'], [0, 270, 170, 'A'], [1, 0, 110, 'B'], [1, 110, 170, 'D'], [1, 280, 160, 'E'], [2, 0, 150, 'E'], [2, 150, 130, 'B'], [2, 280, 160, 'C']],  // multiprocessing: five processes spread over three processor lanes at once
          dist: [[0, 0, 200, 'A'], [0, 200, 240, 'B'], [1, 0, 260, 'C'], [1, 260, 180, 'D'], [2, 0, 140, 'E'], [2, 140, 300, 'F']],  // distributed: six processes on three separate computers
        };  // closes the SEGS table
        function drawVis() {  // drawVis(): redraws the timeline for the current mode and instant; runs on every slider move and mode change
          const lanes = mode === 'mp' ? ['Processor'] : mode === 'mproc' ? ['Processor 1', 'Processor 2', 'Processor 3'] : ['Computer 1', 'Computer 2', 'Computer 3'];  // lanes: the row labels (one processor, three processors, or three computers)
          const y0 = mode === 'mp' ? 70 : 48, gap = 76, X = 150;  // y0 is where the first lane starts, gap is the space between lanes, X is where the time axis begins
          let svg = '';  // svg collects the drawing's SVG text piece by piece
          if (mode === 'mp') svg += `<rect x="${X}" y="178" width="440" height="72" rx="12" class="s-mem" stroke-width="1.5"/><text x="${X + 14}" y="200" font-size="13" font-weight="800">Main memory: every process is loaded and in progress</text>${['A', 'B', 'C'].map((p, i) => `<rect x="${X + 14 + i * 142}" y="210" width="130" height="30" rx="7" class="s-proc" stroke-width="1.5"/><text x="${X + 79 + i * 142}" y="230" text-anchor="middle" font-size="13" font-weight="800">process ${p}</text>`).join('')}`;  // multiprogramming only: a memory box showing all three processes loaded and in progress
          if (mode === 'mproc') svg += `<rect x="600" y="30" width="30" height="${gap * 2 + 60}" rx="8" class="s-mem" stroke-width="1.5"/><text x="615" y="${30 + gap + 34}" text-anchor="middle" font-size="13" font-weight="800" transform="rotate(-90 615 ${30 + gap + 30})">shared memory</text>`;  // multiprocessing only: a tall shared-memory bar at the right that every processor connects to
          lanes.forEach((ln, i) => {  // draws each lane in turn
            const y = y0 + i * gap;  // the lane's height in the drawing
            if (mode === 'dist') svg += `<rect x="4" y="${y - 8}" width="${X + 452}" height="58" rx="10" class="s-panel" stroke-dasharray="5 4"/><text x="12" y="${y + 44}" font-size="13" class="s-sub">own memory</text>`;  // distributed only: a dashed box around each computer's lane, labeled "own memory"
            svg += `<text x="12" y="${y + 27}" font-size="14" font-weight="800">${ln}</text>`;  // the lane's name at the left
            if (mode === 'mproc') svg += `<line x1="${X + 440}" y1="${y + 21}" x2="598" y2="${y + 21}" class="s-muted" stroke-dasharray="3 3"/>`;  // multiprocessing only: a dotted line from each processor lane to the shared memory bar
          });  // ends the loop over lanes
          const running = [];  // running: the processes whose block covers the chosen instant
          SEGS[mode].forEach(([ln, st, len, p]) => {  // draws every block of processor time for this mode
            const y = y0 + ln * gap;  // the block's lane height
            const on = at >= st && at < st + len;  // on is true if the chosen instant falls inside this block
            if (on) running.push(p);  // if so, that process is running right now
            svg += `<rect x="${X + st + 1}" y="${y + 4}" width="${len - 2}" height="34" rx="7" class="s-proc" stroke-width="${on ? 3 : 1.5}" style="fill-opacity:${on ? 1 : 0.35}"/><text x="${X + st + len / 2}" y="${y + 26}" text-anchor="middle" font-size="14" font-weight="800">${p}</text>`;  // the block: solid with a thick border if running, pale if not, labeled with the process name
          });  // ends the loop over blocks
          svg += `<line x1="${X + at}" y1="${y0 - 14}" x2="${X + at}" y2="${y0 + (lanes.length - 1) * gap + 50}" style="stroke:var(--chc)" stroke-width="2.5" stroke-dasharray="5 3"/><text x="${X + at}" y="${y0 - 20}" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--chc)">this instant</text>`;  // the dashed chapter-colored "this instant" line across every lane at the slider's position
          const all = [...new Set(SEGS[mode].map((g) => g[3]))].sort();  // all: every process name in this mode, sorted
          const waiting = all.filter((p) => !running.includes(p));  // waiting: the ones not running at this instant
          running.sort();  // sorts the running names so the sentence reads in order
          nowTxt.innerHTML = `At this instant: <b>${running.join(', ')}</b> ${running.length > 1 ? 'run at the same time' : 'runs'}${waiting.length ? `; ${waiting.join(', ')} ${mode === 'mp' ? 'are in progress but waiting' : (waiting.length > 1 ? 'are' : 'is') + ' not running at this instant'}` : ''}.`;  // writes the sentence: who runs now, and who is waiting (in progress) or simply not running at this instant
          if (mode === 'dist') svg += `<path d="M${X + 200} ${y0 + 42} L${X + 260} ${y0 + gap + 2}" class="s-line" style="stroke:var(--io)" stroke-dasharray="5 4" marker-end="url(#arr-io)"/><path d="M${X + 140} ${y0 + 2 * gap} L${X + 90} ${y0 + gap + 40}" class="s-line" style="stroke:var(--io)" stroke-dasharray="5 4" marker-end="url(#arr-io)"/><text x="${X + 300}" y="${y0 + gap - 14}" font-size="13" font-weight="800" style="fill:var(--io)">messages over the network</text>`;  // distributed only: two dashed orange arrows and a label showing messages sent over the network
          const yb = y0 + lanes.length * gap - 10;  // yb: the height of the time axis, just below the last lane
          svg += `<line x1="${X}" y1="${yb}" x2="${X + 440}" y2="${yb}" class="s-line" marker-end="url(#arr)"/><text x="${X + 440}" y="${yb + 20}" text-anchor="end" font-size="13" class="s-sub">time →</text>`;  // the time axis with an arrowhead and a "time" label
          vis.innerHTML = `<svg viewBox="0 0 640 300" width="100%" role="img" aria-label="${MODES[mode].label} timeline">${svg}</svg>`;  // writes the finished drawing into the card, labeled for screen readers with the mode's name
          cap.innerHTML = MODES[mode].cap;  // puts the mode's caption under the timeline
        }  // ends drawVis()
        const seg = ctx.ui.seg(Object.entries(MODES).map(([value, m]) => ({ value, label: m.label })), mode, (v) => { mode = v; drawVis(); ctx.refit(); });  // seg: the three-way switch between modes, built from MODES; changing it redraws and re-checks the fit
        const ctxBox = h('div', { class: 'stack', style: { gap: '8px' } });  // ctxBox: the column holding the three context buttons
        function paintCtx() {  // paintCtx(): rebuilds the three context buttons, opening the chosen one
          ctxBox.innerHTML = '';  // empties the column first
          CTX.forEach(([name, d, ex], i) => {  // goes through the three contexts
            const on = i === pickCtx;  // on is true for the one the student opened
            ctxBox.append(h('button', { class: 'ch5-ctx' + (on ? ' on' : ''), type: 'button', onclick: () => { pickCtx = i; paintCtx(); ctx.refit(); } },  // each context is a button; clicking it opens that one and redraws
              h('span', { class: 'ch5-n' }, String(i + 1)),  // its number badge
              h('span', {}, h('b', {}, name), ...(on ? [h('span', { class: 'small ch5-d' }, d, ' ', h('i', { class: 'muted' }, 'Example: ' + ex))] : []))));  // its bold name and, only if open, its explanation and example
          });  // ends the loop over contexts
        }  // ends paintCtx()
        el.append(h('div', { class: 'split r fill' },  // puts the step on screen as two columns:
          h('div', { class: 'stack' }, h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Three ways to run many processes:'), seg), vis,  // left: a label with the mode switch, then the timeline card
            h('div', { class: 'row nw ch5-slide' }, ctx.ui.slider({ label: 'Move the instant', min: 0, max: 439, value: at, format: () => '', onInput: (v) => { at = v; drawVis(); } }), nowTxt), cap),  // the slider row: "Move the instant" slider (its number hidden) beside the sentence; moving it redraws; then the caption
          h('div', { class: 'stack' },  // right: a column holding:
            h('h4', { class: 'm0', html: 'Three places <span class="t">concurrency</span> comes from' }),  // a small heading: three places concurrency comes from
            ctxBox,  // the three context buttons
            h('div', { class: 'callout warn m0 small', 'data-label': 'The key point', html: 'Interleaved on one processor or overlapping on several, the relative speed of processes cannot be predicted. Every problem in this chapter grows from that one fact.' }),  // "The key point" callout: the relative speed of processes cannot be predicted
            h('div', { class: 'card tight small' }, h('h4', {}, 'Two words to keep'), h('div', { html: '<b>Interleaving:</b> processes take turns on one processor. <b>Overlapping:</b> processes run at literally the same moment on different processors. Both cause the same problems.' })))));  // "Two words to keep" card: interleaving and overlapping
        drawVis(); paintCtx();  // draws the timeline and the context buttons for the first time
      },  // ends render() for step 1
    },  // closes step 1
    {  // step 2 of the chapter 5 overview
      title: 'Name that problem: seven words for this chapter',  // title shown at the top of step 2
      kind: 'explore',  // kind "explore" labels it "Explore"
      render(el, ctx) {  // render(el, ctx): builds the match-the-word activity when the step is shown
        const { h } = ctx;  // takes the element-building helper h out of ctx
        const TERMS = {  // TERMS: the seven key words of the chapter, each with its definition, used for feedback
          'Atomic operation': 'One or more steps carried out as a single indivisible unit: no other process can see a halfway state or cut in partway through.',  // definition: atomic operation
          'Critical section': 'A piece of code that uses a shared resource and must not run while another process is running its own code for that same resource.',  // definition: critical section
          'Deadlock': 'Two or more processes are each waiting for something that only another member of the group can provide, so none of them can ever proceed.',  // definition: deadlock
          'Livelock': 'Two or more processes keep changing state in reaction to each other, staying busy but never getting any useful work done.',  // definition: livelock
          'Mutual exclusion': 'The rule that while one process is inside a critical section for a shared resource, no other process may be inside one for the same resource.',  // definition: mutual exclusion
          'Race condition': 'Several processes or threads read and write shared data, and the final result depends on the exact timing of their steps.',  // definition: race condition
          'Starvation': 'A process that is able to run is passed over again and again, indefinitely, even though the system as a whole keeps making progress.',  // definition: starvation
        };  // closes the TERMS table
        const SC = [  // SC: seven short scenarios, each with a short name, the word that names it, and the story
          { short: 'The shared counter', term: 'Race condition', text: 'Two threads each add 1 to a shared counter that holds 5. Both read 5, both compute 6, both write 6. One addition has vanished, and on another run, with different timing, the answer comes out right.' },  // scenario: two threads updating a counter lose one addition (a race condition)
          { short: 'Printer and scanner', term: 'Deadlock', text: 'Thread 1 has locked the printer and is waiting for the scanner. Thread 2 has locked the scanner and is waiting for the printer. Neither will give up what it holds, so neither will ever move again.' },  // scenario: two threads each hold what the other needs (deadlock)
          { short: 'Check and change in one step', term: 'Atomic operation', text: 'A special processor instruction reads a memory word, checks it and writes a new value in one indivisible step. No other processor can ever catch the word after the check but before the write.' },  // scenario: one instruction that checks and changes a word in a single step (an atomic operation)
          { short: 'The long job', term: 'Starvation', text: 'A scheduler always runs the shortest waiting job next. A long report keeps getting overtaken by a steady stream of short jobs. The system is busy and nothing is stuck, yet the report never runs.' },  // scenario: a long job keeps being passed over (starvation)
          { short: 'Three lines of banking code', term: 'Critical section', text: 'Three lines in a banking program read an account balance, subtract a withdrawal and write the new balance back. These particular lines must never run for the same account in two threads at once.' },  // scenario: three lines that must not run twice at once for one account (a critical section)
          { short: 'The narrow corridor', term: 'Livelock', text: 'Two polite people meet in a narrow corridor. Both step left, then both step right, then both step left again. They never stop moving, yet neither ever gets past the other.' },  // scenario: two people in a corridor keep stepping aside in step (livelock)
          { short: 'The changing-room key', term: 'Mutual exclusion', text: 'A shop\'s only changing room has one key on a hook. Whoever holds the key is inside; everyone else waits until it is back on the hook. There is never more than one person inside.' },  // scenario: one key for one changing room (mutual exclusion)
        ];  // closes the SC list
        const names = Object.keys(TERMS);  // names: the seven words, in the order of the TERMS table, used to make the buttons
        const ans = SC.map(() => null);  // ans: the word the student picked for each scenario; null means not answered yet
        let cur = 0;  // cur: which scenario is on screen, starting with the first
        const scCard = h('div', { class: 'card white ch5-sc', 'aria-live': 'polite' });  // scCard: the card that shows the scenario story; screen readers read changes aloud
        const fb = h('div', { class: 'ch5-fb' });  // fb: the feedback callout under the word buttons
        const termBtns = names.map((n) => h('button', { class: 'btn ch5-term', type: 'button', onclick: () => choose(n) }, n));  // termBtns: one button per word; clicking one answers the current scenario
        const list = h('div', { class: 'ch5-list' });  // list: the column of scenario rows on the right
        const score = h('span', { class: 'big' });  // score: the big "3 / 7" count of matched scenarios
        const nextBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => go(nextOpen()) }, 'Next scenario ▶');  // "Next scenario" button: jumps to the next scenario not yet matched correctly
        const nextOpen = () => { for (let k = 1; k <= SC.length; k++) { const j = (cur + k) % SC.length; if (ans[j] !== SC[j].term) return j; } return (cur + 1) % SC.length; };  // nextOpen(): searches forward (wrapping around) for a scenario without a right answer, or just the next one if all are right
        function choose(n) { ans[cur] = n; paint(); }  // choose(n): records word n as the answer for the current scenario and redraws
        function go(i) { cur = i; paint(); }  // go(i): shows scenario i and redraws
        function paint() {  // paint(): redraws the scenario, buttons, feedback, list and score
          const sc = SC[cur], a = ans[cur], ok = a === sc.term;  // sc is the current scenario, a its answer, ok whether that answer is right
          scCard.innerHTML = `<div class="xs muted b">SCENARIO ${cur + 1} OF ${SC.length}: ${sc.short.toUpperCase()}</div><p class="ch5-text m0">${sc.text}</p>`;  // fills the scenario card with "Scenario 2 of 7" and the story
          termBtns.forEach((b) => { b.classList.toggle('ok', a === b.textContent && ok); b.classList.toggle('bad', a === b.textContent && !ok); });  // colors the chosen word button green if right or red if wrong, and clears the others
          fb.className = 'ch5-fb callout m0 small ' + (a === null ? '' : ok ? 'tip' : 'bad');  // sets the feedback box's color: plain before an answer, green if right, red if wrong
          fb.setAttribute('data-label', a === null ? 'Your move' : ok ? 'Correct: ' + sc.term : 'Not quite');  // sets the feedback box's label: "Your move", "Correct: ..." or "Not quite"
          fb.innerHTML = a === null ? 'Which word names what is happening in this scenario? Pick one of the seven.'  // feedback text: a prompt before any answer
            : ok ? TERMS[sc.term]  // or, if right, the word's definition
            : `<b>${a}</b> means: ${TERMS[a]} Does that match the story? Try another word.`;  // or, if wrong, what the chosen word really means and a nudge to try again
          list.innerHTML = '';  // empties the scenario list before rebuilding it
          SC.forEach((x, i) => {  // goes through all seven scenarios
            const st = ans[i] === null ? '' : ans[i] === x.term ? 'ok' : 'bad';  // st is "ok", "bad" or empty depending on that scenario's answer
            list.append(h('button', { class: 'ch5-row' + (i === cur ? ' on' : ''), type: 'button', onclick: () => go(i) },  // each row is a button that jumps to its scenario; the current one is marked "on"
              h('span', { class: 'ch5-n' }, String(i + 1)), h('span', { class: 'grow' }, x.short),  // the row shows the number badge and short name
              st ? h('span', { class: 'chip ' + st }, st === 'ok' ? '✓ ' + x.term : '✗ ' + ans[i]) : h('span', { class: 'xs muted' }, 'not answered')));  // and a green tag with the right word, a red tag with the wrong one, or "not answered"
          });  // ends the loop over scenarios
          const right = SC.filter((x, i) => ans[i] === x.term).length;  // right: how many scenarios have the correct word
          score.textContent = `${right} / ${SC.length}`;  // shows the score out of seven
          ctx.refit();  // asks the shell to re-check that the step still fits
        }  // ends paint()
        el.append(h('div', { class: 'split r fill' },  // puts the step on screen as two columns:
          h('div', { class: 'stack' }, scCard, h('div', { class: 'ch5-terms' }, ...termBtns), fb, h('div', { class: 'row' }, nextBtn),  // left: the scenario card, the word buttons, the feedback, and the Next scenario button
            h('div', { class: 'card tight small ch5-groups' }, h('h4', {}, 'How the seven fit together'),  // a small card on how the seven words fit together
              h('div', { html: '<b style="color:var(--bad)">Things that go wrong:</b> race condition, deadlock, livelock, starvation.<br><b style="color:var(--ok)">Ideas that prevent them:</b> find the critical sections, enforce mutual exclusion on them, and build that guarantee from atomic operations.' }))),  // its text: four things that go wrong, and three ideas that prevent them
          h('div', { class: 'stack' },  // right: a column holding:
            h('div', { class: 'row', style: { alignItems: 'baseline' } }, score, h('span', { class: 'small b' }, 'matched'), h('span', { class: 'xs muted' }, 'click a row to revisit it'),  // the score with "matched", a hint to click a row
              h('button', { class: 'btn sm', type: 'button', style: { marginLeft: 'auto', alignSelf: 'center' }, onclick: () => { ans.fill(null); go(0); } }, 'Start over')),  // and a "Start over" button that clears every answer and goes back to scenario 1
            list,  // the list of scenario rows
            h('div', { class: 'callout why m0 small', 'data-label': 'Where you will use them', html: 'Section 5.1 enforces mutual exclusion in software alone; 5.2 explains races and the rules any solution must meet. Sections 5.3 to 5.7 build stronger tools that avoid deadlock and starvation.' }))));  // "Where you will use them" callout: which sections use these words
        paint();  // draws the first scenario
      },  // ends render() for step 2
    },  // closes step 2
  ],  // closes chapter 5's steps list
  notes: `${/* notes: the chapter 5 summary shown in the Notes drawer on its overview steps */''}
    <h3>How Chapter 5 fits together</h3>${/* notes heading: how chapter 5 fits together */''}
    <p>Chapters 3 and 4 gave us many processes and threads in progress at once. This chapter deals with the price: when they share data, the result can depend on timing. Concurrency arises in three contexts: <b>multiple applications</b> sharing a machine, <b>structured applications</b> built as cooperating parts, and the <b>operating system's own structure</b>. It appears whether processes are interleaved on one processor (<b>multiprogramming</b>), overlapped on several (<b>multiprocessing</b>) or spread across machines (<b>distributed processing</b>).</p>${/* notes paragraph: the price of concurrency, its three contexts, and the three ways processes run at once */''}
    <h4>The vocabulary</h4>${/* notes heading: the vocabulary */''}
    <p>A <b>race condition</b> happens when the outcome depends on who gets to shared data first. The code that touches shared data is a <b>critical section</b>, and <b>mutual exclusion</b> means at most one process is inside it at a time. <b>Atomic operations</b> are the indivisible building blocks used to enforce it. A careless solution can cause <b>deadlock</b> (everyone waits for everyone), <b>livelock</b> (everyone stays busy but nobody progresses) or <b>starvation</b> (one process is passed over forever).</p>${/* notes paragraph: race conditions, critical sections, mutual exclusion, atomic operations, and three ways to fail */''}
    <h4>Getting it right in software (5.1) and why it is hard (5.2)</h4>${/* notes heading: software solutions (5.1) and why the problem is hard (5.2) */''}
    <p>Section 5.1 builds mutual exclusion from ordinary instructions through a series of flawed attempts, ending with <b>Dekker's</b> and <b>Peterson's</b> algorithms. Section 5.2 steps back to the principles: a simple example of a race, the OS concerns, the three ways processes interact (competition, cooperation by sharing, cooperation by communication) and the six requirements any mutual exclusion solution must meet.</p>${/* notes paragraph: the flawed attempts, Dekker's and Peterson's algorithms, and the requirements for a solution */''}
    <h4>Help from the hardware (5.3)</h4>${/* notes heading: help from the hardware (section 5.3) */''}
    <p>On one processor, disabling interrupts protects a critical section. On multiprocessors, special atomic instructions such as <b>compare_and_swap</b> and <b>exchange</b> do the job, at the cost of busy waiting and a risk of starvation.</p>${/* notes paragraph: disabling interrupts and atomic instructions such as compare_and_swap */''}
    <h4>Higher-level tools (5.4 to 5.6)</h4>${/* notes heading: higher-level tools (sections 5.4 to 5.6) */''}
    <p><b>Semaphores</b> (5.4) are counters with atomic semWait and semSignal operations that block instead of spinning; they solve mutual exclusion and the <b>producer/consumer</b> problem. <b>Monitors</b> (5.5) package shared data with its procedures and condition variables so mutual exclusion is automatic. <b>Message passing</b> (5.6) replaces shared data with send and receive, and works across machines.</p>${/* notes paragraph: semaphores, monitors and message passing */''}
    <h4>A classic test (5.7)</h4>${/* notes heading: a classic test (section 5.7) */''}
    <p>The <b>readers/writers</b> problem lets many readers share data at once but gives writers exclusive access, and shows how the choice of priority can starve one side.</p>`,  // notes paragraph: the readers/writers problem; end of the notes text
});  // closes the chapter 5 object and the Guide.chapter call
