/* Chapter metadata: titles, colours, overview text and objectives.
   Section content lives in sections/<id>.js. */
Guide.chapter({
  num: 1,
  title: 'Computer System Overview',
  tagline: 'You cannot understand a manager without knowing what it manages. First, meet the machine.',
  intro: '<p>An operating system is software that runs on real hardware and spends its whole life managing that hardware. This chapter opens the box: the four basic parts of a computer, how the processor grew from one simple chip into today’s chips that hold several processors (called cores), how it runs one instruction after another, and how <span class="t">interrupts</span> let slow devices call for attention. It then shows why memory is built in layers, from small and fast to big and slow, with a <span class="t" data-t="Cache memory">cache</span> at the top; how <span class="t">direct memory access</span> lets a device move bulk data without the processor; and how several processors or cores share one machine.</p>',
  objectives: [
    'Name the basic elements of a computer and describe how the system bus connects them.',
    'Describe how the microprocessor grew into multicore systems on a chip.',
    'Trace the fetch and execute steps a processor repeats for every instruction.',
    'Explain what an interrupt is and why it keeps the processor from wasting time.',
    'Use locality to explain the memory hierarchy and how a cache speeds up memory access.',
    'Compare programmed I/O, interrupt-driven I/O and direct memory access (DMA).',
    'Describe symmetric multiprocessors and multicore chips.',
  ],
  terms: [
    ['Operating system (OS)', 'The software that manages a computer\'s hardware resources and provides services and a convenient environment for application programs.'],
    ['Interrupt', 'A signal that makes the processor pause its current work, run a handler for some event (such as an I/O device finishing), and then resume.'],
    ['Processor', 'The part of the computer that fetches instructions from memory and carries them out; when there is only one, it is often called the CPU.'],
    ['Register', 'A tiny, very fast storage slot inside the processor that holds a value, an address or control information the processor is working with right now.'],
    ['Program counter (PC)', 'The processor register that holds the memory address of the next instruction to fetch.'],
    ['Instruction register (IR)', 'The processor register that holds the instruction currently being decoded and executed.'],
    ['Main memory', 'The volatile memory that holds the instructions and data of running programs, organised as a row of numbered cells; a cell’s number is its address.'],
    ['System bus', 'The shared set of wires that carries addresses, data and control signals between the processor, main memory and I/O modules.'],
    ['I/O module', 'The hardware that connects the computer to an external device such as a disk or keyboard and moves data between them, using small buffers.'],
    ['Cache memory', 'A small, fast memory between the processor and main memory that keeps copies of recently used memory contents so that most accesses finish quickly.'],
    ['Direct memory access (DMA)', 'A way of moving a block of data between an I/O device and main memory without the processor handling each word; the processor is interrupted once when the block is done.'],
    ['Core', 'One complete processor (registers, control and execution unit) on a chip that may hold several of them; a chip with two or more is a multicore chip.'],
    ['Secondary memory', 'Large, permanent, much slower storage such as a disk or solid-state drive, reached through an I/O module rather than directly by the processor.'],
  ],
  css: `
    .sec-ch1 .ch1-mapwrap { display: grid; place-items: center; padding: 8px 10px; }
    .sec-ch1 .ch1-hot { cursor: pointer; transition: opacity .2s; outline: none; }
    .sec-ch1 .ch1-hot:hover .fr, .sec-ch1 .ch1-hot:focus-visible .fr { stroke-width: 3.5; }
    .sec-ch1 .ch1-map.picked .ch1-hot:not(.sel) { opacity: .35; }
    .sec-ch1 .ch1-hot.sel .fr { stroke-width: 4; }
    .sec-ch1 .ch1-info { min-height: 296px; }
    .sec-ch1 .ch1-four .box { font-size: 15px; padding: 6px 8px; }
    .sec-ch1 .ch1-four { margin: 4px 0 10px; gap: 8px; }
    .sec-ch1 .ch1-relax { margin-top: 10px; padding: 6px 10px; border-radius: 8px; background: var(--panel-2); color: var(--ink-2); }
    .sec-ch1 .ch1-sec { background: color-mix(in srgb, var(--chc) 14%, var(--panel)); color: var(--ink); }
    .sec-ch1 .ch1-secs { margin-top: 4px; }
    .sec-ch1 .ch1-bars { display: flex; flex-direction: column; gap: 8px; }
    .sec-ch1 .ch1-row { display: grid; grid-template-columns: 150px minmax(0, 1fr) 150px; align-items: center; gap: 12px; padding: 13px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel-2); cursor: pointer; text-align: left; font-size: 15px; color: var(--ink); }
    .sec-ch1 .ch1-row:hover { border-color: var(--chc); }
    .sec-ch1 .ch1-row.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); }
    .sec-ch1 .ch1-name { font-weight: 700; }
    .sec-ch1 .ch1-track { height: 14px; border-radius: 99px; background: var(--panel-3); overflow: hidden; }
    .sec-ch1 .ch1-track > i { display: block; height: 100%; border-radius: 99px; transition: width .3s; }
    .sec-ch1 .ch1-val { font-size: 14px; text-align: right; color: var(--ink-2); }
    @media (max-width: 760px) {
      .sec-ch1 .ch1-row { grid-template-columns: minmax(0, 1fr) auto; row-gap: 4px; }
      .sec-ch1 .ch1-track { grid-column: 1 / -1; grid-row: 2; }
    }
    .sec-ch1 .ch1-ans { font-size: 14.5px; line-height: 1.4; padding: 6px 12px; border-radius: 10px; border-left: 5px solid var(--line-2); background: var(--panel-2); }
    .sec-ch1 .ch1-ans.intr { border-left-color: var(--intr); } .sec-ch1 .ch1-ans.intr b { color: var(--intr); }
    .sec-ch1 .ch1-ans.mem { border-left-color: var(--mem); } .sec-ch1 .ch1-ans.mem b { color: var(--mem); }
    .sec-ch1 .ch1-ans.cpu { border-left-color: var(--cpu); } .sec-ch1 .ch1-ans.cpu b { color: var(--cpu); }
  `,
  steps: [
    {
      title: 'A computer at a glance: click every part',
      kind: 'story',
      render(el, ctx) {
        const { h } = ctx;
        const SEC = { '1.1': 'Basic Elements', '1.2': 'Evolution of the Microprocessor', '1.3': 'Instruction Execution', '1.4': 'Interrupts', '1.5': 'The Memory Hierarchy', '1.6': 'Cache Memory', '1.7': 'Direct Memory Access', '1.8': 'Multiprocessor and Multicore', ch2: 'Chapter 2: OS Overview' };
        const PARTS = [
          { id: 'registers', name: 'Registers', col: 'cpu', tag: 'inside the processor',
            what: 'Tiny storage slots built into the processor, far faster than memory. The <b>program counter (PC)</b> holds the address of the next instruction; the <b>instruction register (IR)</b> holds the one being carried out. The <b>memory address register (MAR)</b> and <b>memory buffer register (MBR)</b> hold the address and the data of one memory read or write. I/O AR and I/O BR (I/O address and I/O buffer registers) do the same job for a device.',
            pic: 'The notepad in your hand, compared with a filing cabinet down the hall.', secs: ['1.1', '1.3'] },
          { id: 'alu', name: 'Execution unit (ALU)', col: 'cpu', tag: 'inside the processor',
            what: 'The circuitry that actually computes. Its main part is the <b>arithmetic logic unit (ALU)</b>, which adds, subtracts, compares and shifts values held in registers. The processor spends its entire life in one loop: fetch the next instruction from memory, then execute it here.',
            pic: 'The calculator on the desk: fast, but useless until someone hands it numbers.', secs: ['1.1', '1.3'] },
          { id: 'cores', name: 'More cores', col: 'cpu', tag: 'multicore chip',
            what: 'A modern chip usually holds several complete processors, called <b>cores</b>. Each core has its own registers and execution unit, and all of them share one main memory. Keeping every core busy without letting them collide becomes the operating system\'s problem.',
            pic: 'Four cooks sharing one pantry: more cooking gets done, but they must not grab the same jar at once.', secs: ['1.2', '1.8'] },
          { id: 'cache', name: 'Cache', col: 'mem', tag: 'small and very fast',
            what: 'A small, very fast memory that keeps copies of the memory contents the processor used recently, betting that it will need them again soon. When the bet pays off (a <b>hit</b>) the slow trip to main memory is skipped. The hardware decides what to copy in and what to replace, without help from programs.',
            pic: 'The few books you keep on your desk instead of walking to the library each time.', secs: ['1.5', '1.6'] },
          { id: 'memory', name: 'Main memory', col: 'mem', tag: 'big, slower, volatile',
            what: 'Holds the instructions and data of every running program in numbered cells; a cell’s number is its <b>address</b>. It is volatile: cut the power and it forgets everything. Far larger than the cache, but each access costs the processor many cycles of waiting.',
            pic: 'A long wall of numbered mailboxes; the address tells you which box to open.', secs: ['1.1', '1.5'] },
          { id: 'os', name: 'The operating system', col: 'os', tag: 'software, not a box',
            what: 'There is no separate OS chip. The OS is a program: its core, the <b>kernel</b>, sits in main memory and runs on the very same processor as your programs. It gets control back whenever an interrupt fires or a program asks it for a service.',
            pic: 'A stage manager who is also one of the actors, stepping in between scenes.', secs: ['1.4', 'ch2'] },
          { id: 'bus', name: 'System bus', col: 'accent', tag: 'the shared highway',
            what: 'The set of shared wires that links the processor, memory and I/O modules. It carries three kinds of signal: <b>address</b> lines (where), <b>data</b> lines (what) and <b>control</b> lines (read or write, and when). Only one transfer can use it at a time.',
            pic: 'A single road between the factory, the warehouse and the loading dock.', secs: ['1.1'] },
          { id: 'io', name: 'I/O modules and devices', col: 'io', tag: 'the outside world',
            what: 'Each I/O module looks after one kind of external device: a disk, the keyboard, the screen, the network. It has small buffers that hold data in transit. Disks also serve as <b>secondary memory</b>: huge and permanent, but thousands of times slower than main memory.',
            pic: 'The loading dock, where goods enter and leave the factory at their own slow pace.', secs: ['1.1', '1.5', '1.7'] },
          { id: 'interrupt', name: 'Interrupt request line', col: 'intr', tag: 'a tap on the shoulder',
            what: 'A signal from an I/O module to the processor. Instead of the processor asking "are you done yet?" over and over, the device raises an <b>interrupt</b> when it needs attention. The processor finishes its current instruction, runs a short piece of OS code for the event (its <b>handler</b>), then carries on where it left off.',
            pic: 'A doorbell: you get on with your work until it rings, instead of checking the door every minute.', secs: ['1.4'] },
          { id: 'dma', name: 'Direct memory access (DMA)', col: 'io', tag: 'bulk transfers',
            what: 'For a large transfer, such as reading a whole file, a DMA module copies the data straight between the device and main memory over the bus. The processor only sets the transfer up, goes back to useful work, and receives one interrupt when the whole block has arrived.',
            pic: 'Hiring movers: you write down what goes where, then carry on while they haul the boxes.', secs: ['1.7'] },
        ];
        const hot = (id, inner) => `<g class="hot ch1-hot" data-part="${id}" tabindex="0" role="button" aria-label="${PARTS.find((p) => p.id === id).name}">${inner}</g>`;
        const reg = (x, y, t) => `<rect x="${x}" y="${y}" width="74" height="26" rx="6" class="s-panel"/><text x="${x + 37}" y="${y + 18}" text-anchor="middle" class="s-monot" font-size="13" font-weight="700">${t}</text>`;
        const devs = ['Disk', 'Keyboard', 'Screen', 'Network'].map((d, i) => `<rect x="${40 + i * 66}" y="424" width="58" height="36" rx="8" class="s-io" stroke-width="1.5"/><text x="${69 + i * 66}" y="447" text-anchor="middle" font-size="13">${d === 'Keyboard' ? 'Keys' : d}</text><line x1="${69 + i * 66}" y1="404" x2="${69 + i * 66}" y2="424" class="s-line" stroke-width="1.5"/>`).join('');
        const svg = `
<svg viewBox="0 0 660 476" width="100%" class="ch1-map" role="img" aria-label="Diagram of a computer: processor chip, main memory, system bus and I/O modules">
  <rect x="40" y="6" width="384" height="224" rx="16" class="s-panel" stroke-dasharray="6 4"/>
  <text x="54" y="25" font-size="13" font-weight="800" class="s-sub">PROCESSOR CHIP</text>
  ${hot('registers', `<rect class="fr s-cpu" x="54" y="34" width="172" height="136" rx="10" stroke-width="2"/><text x="66" y="54" font-size="14" font-weight="800">Registers</text>${reg(66, 64, 'PC')}${reg(144, 64, 'IR')}${reg(66, 98, 'MAR')}${reg(144, 98, 'MBR')}${reg(66, 132, 'I/O AR')}${reg(144, 132, 'I/O BR')}`)}
  ${hot('alu', `<rect class="fr s-cpu" x="236" y="34" width="90" height="136" rx="10" stroke-width="2"/><text x="281" y="90" text-anchor="middle" font-size="14" font-weight="800">Execution</text><text x="281" y="108" text-anchor="middle" font-size="14" font-weight="800">unit</text><text x="281" y="128" text-anchor="middle" font-size="13" class="s-sub">(ALU)</text>`)}
  ${hot('cores', `<rect class="fr s-panel" x="334" y="34" width="80" height="136" rx="10" stroke-width="1.5" stroke-dasharray="4 3"/>${[0, 1, 2].map((k) => `<rect x="342" y="${42 + k * 42}" width="64" height="34" rx="7" class="s-cpu" stroke-width="1.5"/><text x="374" y="${64 + k * 42}" text-anchor="middle" font-size="13" font-weight="700">Core ${k + 2}</text>`).join('')}`)}
  ${hot('cache', `<rect class="fr s-mem" x="54" y="180" width="360" height="40" rx="10" stroke-width="2"/><text x="234" y="205" text-anchor="middle" font-size="14" font-weight="700">Cache: fast copies of recently used memory</text>`)}
  ${hot('memory', `<rect class="fr s-mem" x="448" y="6" width="204" height="224" rx="14" stroke-width="2"/><text x="550" y="28" text-anchor="middle" font-size="15" font-weight="800">Main memory</text>
    <rect x="462" y="94" width="176" height="40" rx="7" class="s-panel"/><text x="550" y="119" text-anchor="middle" font-size="13">program instructions</text>
    <rect x="462" y="140" width="176" height="36" rx="7" class="s-panel"/><text x="550" y="163" text-anchor="middle" font-size="13">program data</text>
    <rect x="462" y="182" width="176" height="36" rx="7" class="s-panel" stroke-dasharray="4 3"/><text x="550" y="205" text-anchor="middle" font-size="13" class="s-sub">free space</text>`)}
  ${hot('os', `<rect class="fr s-os" x="462" y="40" width="176" height="48" rx="8" stroke-width="2"/><text x="550" y="61" text-anchor="middle" font-size="14" font-weight="800">OS kernel</text><text x="550" y="79" text-anchor="middle" font-size="13" class="s-sub">code + tables</text>`)}
  <line x1="232" y1="230" x2="232" y2="262" class="s-line" stroke-width="3"/>
  <line x1="550" y1="230" x2="550" y2="262" class="s-line" stroke-width="3"/>
  <line x1="170" y1="296" x2="170" y2="330" class="s-line" stroke-width="3"/>
  ${hot('bus', `<rect class="fr s-accent" x="40" y="262" width="612" height="34" rx="17" stroke-width="2"/><text x="346" y="284" text-anchor="middle" font-size="14" font-weight="800">System bus: address · data · control lines</text>`)}
  ${hot('io', `<rect class="fr s-io" x="40" y="330" width="260" height="74" rx="12" stroke-width="2"/><text x="56" y="356" font-size="15" font-weight="800">I/O module</text><text x="56" y="378" font-size="13" class="s-sub">talks to devices</text>${[0, 1, 2, 3].map((k) => `<rect x="${186 + k * 26}" y="352" width="20" height="26" rx="4" class="s-panel"/>`).join('')}<text x="236" y="394" text-anchor="middle" font-size="13" class="s-sub">buffers</text>${devs}`)}
  ${hot('interrupt', `<path d="M40 367 H20 V104 H50" fill="none" stroke="transparent" stroke-width="16"/><path class="fr" d="M40 367 H20 V104 H48" fill="none" style="stroke:var(--intr)" stroke-width="2.5" stroke-dasharray="7 5" marker-end="url(#arr-intr)"/><text x="12" y="236" transform="rotate(-90 12 236)" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--intr)">interrupt request</text>`)}
  ${hot('dma', `<path d="M300 346 H592 V236" fill="none" stroke="transparent" stroke-width="16"/><path class="fr" d="M300 346 H592 V238" fill="none" style="stroke:var(--io)" stroke-width="3" stroke-dasharray="9 5" marker-end="url(#arr-io)"/><text x="446" y="336" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--io)">DMA transfer</text><text x="446" y="366" text-anchor="middle" font-size="13" class="s-sub">device ↔ memory, no CPU</text>`)}
  <text x="490" y="430" text-anchor="middle" font-size="14" class="s-sub">Click any part to learn</text>
  <text x="490" y="450" text-anchor="middle" font-size="14" class="s-sub">what it does.</text>
</svg>`;
        const info = h('div', { class: 'card white ch1-info', 'aria-live': 'polite' });
        const count = h('span', { class: 'small muted' });
        let cur = -1;
        const chips = (secs) => secs.map((s) => `<span class="chip ch1-sec">${s === 'ch2' ? '' : s + ' '}${SEC[s]}</span>`).join(' ');
        function show(i) {
          cur = i;
          const map = el.querySelector('.ch1-map');
          map.classList.toggle('picked', i >= 0);
          el.querySelectorAll('.ch1-hot').forEach((g) => g.classList.toggle('sel', i >= 0 && g.dataset.part === PARTS[i].id));
          if (i < 0) {
            info.innerHTML = `<h3>Four basic elements</h3>
              <p class="small">Every computer is built from four kinds of part:</p>
              <div class="grid-2 ch1-four"><span class="box cpu">Processor</span><span class="box mem">Main memory</span><span class="box io">I/O modules</span><span class="box">System bus</span></div>
              <p class="small m0">The <span class="t">operating system</span> is not a fifth box: it is software in memory that runs on the processor and manages the rest.</p>
              <p class="small m0 ch1-relax"><b>PC, MAR, ALU, DMA…?</b> Do not worry about these names yet. Each part tells you which section (1.1 to 1.8) teaches it.</p>`;
            count.textContent = PARTS.length + ' parts to explore';
          } else {
            const p = PARTS[i];
            info.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="m0">${p.name}</h3><span class="chip ${p.col}">${p.tag}</span></div>
              <p class="small mt">${p.what}</p>
              <p class="small muted"><b>Picture it:</b> ${p.pic}</p>
              <div class="xs muted b">WHERE YOU WILL LEARN IT</div><div class="row gap-s ch1-secs">${chips(p.secs)}</div>`;
            count.textContent = `Part ${i + 1} of ${PARTS.length}`;
          }
          ctx.refit();
        }
        const tourNext = h('button', { class: 'btn primary sm', type: 'button', onclick: () => show((cur + 1) % PARTS.length) }, 'Next part ▶');
        const tourPrev = h('button', { class: 'btn sm', type: 'button', onclick: () => show(cur <= 0 ? PARTS.length - 1 : cur - 1) }, '◀ Previous');
        const reset = h('button', { class: 'btn sm', type: 'button', onclick: () => show(-1) }, 'Overview');
        count.style.marginLeft = 'auto';
        const left = h('div', { class: 'card white ch1-mapwrap', html: svg });
        const right = h('div', { class: 'stack' },
          h('p', { class: 'lead m0' }, 'An OS manages hardware, so start by meeting the hardware.'),
          info,
          h('div', { class: 'row' }, tourPrev, tourNext, reset, count),
          h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Every later chapter is about sharing these few parts among many programs at once: processor time, memory space and I/O devices.' }));
        el.append(h('div', { class: 'split r fill' }, left, right));
        el.querySelectorAll('.ch1-hot').forEach((g) => {
          const i = PARTS.findIndex((p) => p.id === g.dataset.part);
          ctx.on(g, 'click', () => show(i));
          ctx.on(g, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); } });
        });
        show(-1);
      },
    },
    {
      title: 'The speed gap that shapes this whole chapter',
      kind: 'explore',
      render(el, ctx) {
        const { h } = ctx;
        // typical orders of magnitude, in nanoseconds; human scale stretches 1 ns into 1 second
        const ROWS = [
          { name: 'Register', col: 'cpu', ns: 0.3, real: '≈ 0.3 ns', human: '0.3 seconds: a blink', lost: 'none, because reading a register is part of the instruction itself', fix: 'Nothing to fix: registers sit inside the processor, which is why every instruction works on them.', secs: '1.1 · 1.3' },
          { name: 'Cache', col: 'mem', ns: 1, real: '≈ 1 ns', human: '1 second: a heartbeat', lost: 'about one instruction', fix: 'The cache keeps copies of recently used memory contents right next to the processor, so most accesses finish this fast.', secs: '1.5 · 1.6' },
          { name: 'Main memory', col: 'mem', ns: 100, real: '≈ 100 ns', human: 'about 1.7 minutes', lost: 'about 100 instructions', fix: 'Too slow to visit on every instruction. But programs tend to reuse the same data and data stored near it, so a small, fast cache holding copies hides most of the delay. Section 1.5 calls this <i>locality</i>.', secs: '1.5 · 1.6' },
          { name: 'Solid-state drive', col: 'io', ns: 1e5, real: '≈ 100 µs', human: 'about 28 hours', lost: 'about 100,000 instructions', fix: 'The processor must never idle this long. It starts the transfer and runs other work. A helper circuit (direct memory access, DMA) copies the data into memory, then the device sends a “done” signal (an interrupt).', secs: '1.4 · 1.7' },
          { name: 'Hard disk', col: 'io', ns: 5e6, real: '≈ 5 ms', human: 'about 2 months', lost: 'about 5 million instructions', fix: 'Same remedy, even more important: the processor runs millions of other instructions while the disk arm moves, and a “done” signal (an interrupt) tells it when the data is ready.', secs: '1.4 · 1.7' },
          { name: 'Next keypress', col: 'io', ns: 2e8, real: '≈ 200 ms', human: 'about 6 years', lost: 'about 200 million instructions', fix: 'A human is the slowest device of all. The keyboard sends a “key pressed” signal (an interrupt) for each key, so the processor never waits for you.', secs: '1.4' },
        ];
        let mode = 'real', cur = 2;
        const pct = (ns) => Math.max(3, ((Math.log10(ns) + 1) / 9.5) * 100);
        const bars = ROWS.map((r, i) => {
          const val = h('span', { class: 'ch1-val mono' });
          const b = h('button', { class: 'ch1-row', type: 'button', onclick: () => pick(i) },
            h('span', { class: 'ch1-name' }, r.name),
            h('span', { class: 'ch1-track' }, h('i', { style: { width: pct(r.ns) + '%', background: `var(--${r.col})` } })),
            val);
          b.val = val;
          return b;
        });
        const detail = h('div', { class: 'card white', 'aria-live': 'polite' });
        function paint() {
          bars.forEach((b, i) => { b.classList.toggle('on', i === cur); b.val.textContent = mode === 'real' ? ROWS[i].real : ROWS[i].human.split(':')[0]; });
          const r = ROWS[cur];

          detail.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="m0">${r.name}</h3><span class="chip ${r.col}">${r.real}</span></div>
            <p class="small mt m0"><b>At human scale:</b> ${r.human}.</p>
            <p class="small"><b>Work lost per wait:</b> ${r.lost}.</p>
            <p class="small m0"><b>What this chapter does about it:</b> ${r.fix}</p>
            <div class="xs muted b mt">LEARN IT IN SECTION ${r.secs}</div>`;
          ctx.refit();
        }
        function pick(i) { cur = i; paint(); }
        const seg = ctx.ui.seg([{ value: 'real', label: 'Real time' }, { value: 'human', label: 'If 1 ns lasted 1 second' }], mode, (v) => { mode = v; paint(); });
        const left = h('div', { class: 'stack' },
          h('p', { class: 'lead m0' }, 'The processor is fast, and almost everything it talks to is slow. How slow? Click a row to find out.'),
          h('div', { class: 'row' }, seg, h('span', { class: 'xs muted' }, 'Typical values, log-scale bars, about one simple instruction per ns.')),
          h('div', { class: 'ch1-bars' }, ...bars));
        const right = h('div', { class: 'stack' },
          detail,
          h('h4', { class: 'm0' }, 'Three answers you will meet'),
          h('div', { class: 'ch1-ans intr', html: '<b>Do not wait.</b> Slow devices work in the background and signal when done (interrupts, DMA). <span class="xs muted">1.4 · 1.7</span>' }),
          h('div', { class: 'ch1-ans mem', html: '<b>Keep it close.</b> Copy busy data into a small, fast cache. <span class="xs muted">1.5 · 1.6</span>' }),
          h('div', { class: 'ch1-ans cpu', html: '<b>Add workers.</b> Put several processors (cores) in one machine. <span class="xs muted">1.8</span>' }),
          h('div', { class: 'callout warn m0', style: { fontSize: '15px' }, 'data-label': 'The key insight', html: 'A processor that stops to wait for a disk wastes millions of instructions. Most designs in this chapter exist to prevent that.' }));
        el.append(h('div', { class: 'split r fill' }, left, right));
        paint();
      },
    },
  ],
  notes: `
    <h3>How Chapter 1 fits together</h3>
    <p>An operating system is a manager, and this chapter introduces what it manages. Everything here is hardware, but each topic returns later as an OS problem.</p>
    <h4>The parts (1.1, 1.2)</h4>
    <p>A computer has four basic elements. The <b>processor</b> does the work, using <b>registers</b> (tiny, very fast storage slots such as the program counter and instruction register). <b>Main memory</b> holds running programs and their data. <b>I/O modules</b> connect external devices such as disks, keyboards and network cards. The <b>system bus</b> ties them together by carrying addresses, data and control signals. Section 1.2 shows how the processor grew from one simple chip into chips holding several cores, graphics units and other specialised processors.</p>
    <h4>The heartbeat (1.3, 1.4)</h4>
    <p>A processor repeats one loop for its whole life: <b>fetch</b> the instruction whose address is in the program counter, then <b>execute</b> it. Section 1.4 adds a third stage to that loop: after each instruction the processor checks for an <b>interrupt</b>. Interrupts let a slow device announce that it has finished, so the processor can run other programs instead of waiting. The same mechanism is how the OS regains control, which makes it the foundation for everything in Chapters 2 to 5.</p>
    <h4>The speed gap (1.5, 1.6)</h4>
    <p>Fast memory is expensive and small; cheap memory is large and slow. The <b>memory hierarchy</b> stacks them: registers, cache, main memory, then disks. It works because programs show <b>locality</b>: they tend to reuse the same and nearby addresses. A <b>cache</b> exploits locality by keeping copies of recently used memory blocks next to the processor, so most accesses finish at cache speed.</p>
    <h4>Moving data in bulk (1.7)</h4>
    <p>There are three ways to do I/O. With <b>programmed I/O</b> the processor keeps checking the device and wastes its time. With <b>interrupt-driven I/O</b> it does other work until the device interrupts, but it still copies every word itself. With <b>direct memory access (DMA)</b> a separate module copies a whole block between the device and memory, and the processor is interrupted only once at the end.</p>
    <h4>More than one processor (1.8)</h4>
    <p>A <b>symmetric multiprocessor</b> has several similar processors sharing one memory and one set of I/O devices, all controlled by one OS. A <b>multicore</b> chip puts several such processors (cores) on one chip, often with some cache levels shared. More processors mean more work at once, and also a new problem that Chapters 4 and 5 tackle: keeping them from interfering with each other.</p>
    <h4>The common theme</h4>
    <p>The processor is far faster than memory and devices. Interrupts and DMA stop it from waiting on devices, the cache stops it from waiting on memory, and multiple cores add raw capacity. An OS is built on top of all three ideas.</p>`,
});
Guide.chapter({
  num: 2,
  title: 'Operating System Overview',
  tagline: 'What an operating system is for, where it came from, and how real ones are built.',
  intro: '<p>Every operating system (OS) chases three goals: make the computer convenient to use, use its hardware efficiently, and stay able to evolve. This chapter shows how those goals drove seventy years of history, from machines with no OS at all to <span class="t" data-t="Batch system">batch</span>, <span class="t" data-t="Multiprogramming">multiprogrammed</span> and <span class="t" data-t="Time sharing">time-sharing</span> systems (each is explained in 2.2). It then covers the big ideas inside every modern OS, how systems survive faults and use many cores, and tours Windows, UNIX, Linux and Android.</p>',
  objectives: [
    'Summarize the objectives and functions of an operating system.',
    'Trace the evolution from serial processing to batch, multiprogrammed and time-sharing systems.',
    'Explain the major achievements: processes, memory management, protection and security, and scheduling.',
    'Describe the developments that led to modern operating systems and how systems tolerate faults.',
    'Discuss OS design issues for multiprocessor and multicore computers.',
    'Compare the structure of Windows, traditional and modern UNIX, Linux and Android.',
  ],
  terms: [
    ['Kernel', 'The central part of the operating system that stays in main memory and holds its most frequently used functions; it runs with full access to the hardware.'],
    ['Application programming interface (API)', 'The set of calls a program can make, in source code, to libraries and the operating system, such as opening a file or creating a window.'],
    ['Application binary interface (ABI)', 'The agreement at the level of compiled code between a program and the system: the system call interface plus the user ISA, including how arguments are passed and how data is laid out.'],
    ['Instruction set architecture (ISA)', 'The set of machine instructions a processor understands; it is the boundary between hardware and software, with a privileged part reserved for the OS.'],
    ['Utilities', 'System programs supplied with the OS, such as compilers, command shells and file tools, that make programming and managing the computer easier.'],
    ['Serial processing', 'The earliest way of using a computer: no operating system, with each programmer booking the machine and loading and running a program by hand.'],
    ['Resident monitor', 'The small program at the heart of an early batch system; it stays in memory, loads each job in turn, runs it, and regains control when the job ends.'],
    ['Job control language (JCL)', 'Special instructions placed with a batch job that tell the monitor what to do, for example which compiler to load and which data to use.'],
    ['Batch system', 'A system that collects jobs into a batch and runs them one after another under the control of a monitor program, with no human operator between jobs.'],
    ['Multiprogramming', 'Keeping several programs in main memory at once and switching the processor to another one whenever the running program must wait, typically for I/O.'],
    ['Time sharing', 'Sharing one computer among many interactive users by giving each a short slice of processor time in turn, so every user gets a quick response.'],
    ['User mode', 'The restricted processor mode in which ordinary programs run; privileged instructions and protected memory areas are off limits.'],
    ['Kernel mode', 'The privileged processor mode in which the operating system runs; all instructions and all memory are available.'],
  ],
  css: `
    .sec-ch2 .ch2-stack { display: flex; flex-direction: column; gap: 6px; }
    .sec-ch2 .ch2-layer { border: 2px solid var(--line-2); background: var(--panel-2); border-radius: 12px; padding: 11px 16px; cursor: pointer; transition: opacity .2s, box-shadow .2s; display: flex; flex-direction: column; gap: 5px; }
    .sec-ch2 .ch2-layer:hover { box-shadow: 0 0 0 2px color-mix(in srgb, var(--chc) 45%, transparent); }
    .sec-ch2 .ch2-lt { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
    .sec-ch2 .ch2-lt b { font-size: 16px; }
    .sec-ch2 .ch2-extra { display: flex; flex-wrap: wrap; gap: 5px; }
    .sec-ch2 .ch2-extra:empty { display: none; }
    .sec-ch2 .c-user { border-style: dashed; }
    .sec-ch2 .c-proc { border-color: var(--proc); background: var(--proc-bg); }
    .sec-ch2 .c-util { border-color: var(--accent); background: var(--accent-bg); }
    .sec-ch2 .c-os { border-color: var(--os); background: var(--os-bg); }
    .sec-ch2 .c-hw { border-color: var(--cpu); background: var(--cpu-bg); }
    .sec-ch2 .ch2-layer.sel { box-shadow: 0 0 0 3px var(--chc); }
    .sec-ch2 .ch2-layer.dim { opacity: .38; }
    .sec-ch2 .ch2-if { display: flex; align-items: center; gap: 8px; padding-left: 14px; border-left: 3px dashed var(--line-2); margin-left: 18px; }
    .sec-ch2 .ch2-iftag { font: 800 13px var(--mono); padding: 2px 10px; border-radius: 999px; border: 1.5px solid var(--ink-2); background: var(--panel); color: var(--ink); cursor: pointer; }
    .sec-ch2 .ch2-iftag:hover, .sec-ch2 .ch2-iftag.on { background: var(--chc); border-color: var(--chc); color: var(--panel); }
    .sec-ch2 .ch2-managed { box-shadow: 0 0 0 2px var(--os); }
    .sec-ch2 .ch2-detail { min-height: 150px; }
    .sec-ch2 .ch2-svcs { display: flex; flex-wrap: wrap; gap: 6px; }
    .sec-ch2 .ch2-strip { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 4px; }
    .sec-ch2 .ch2-slot { height: 38px; border-radius: 8px; display: grid; place-items: center; font-weight: 800; font-size: 14px; border: 2px solid var(--line); }
    .sec-ch2 .ch2-slot.os { background: var(--os-bg); border-color: var(--os); color: var(--os); }
    .sec-ch2 .ch2-slot.proc { background: var(--proc-bg); border-color: var(--proc); color: var(--proc); }
    .sec-ch2 .ch2-slot.empty { border-style: dashed; background: transparent; }
    .sec-ch2 .ch2-slot.now { box-shadow: 0 0 0 3px var(--hl); }
    .sec-ch2 .ch2-cap { min-height: 66px; }
    .sec-ch2 .ch2-ev { display: flex; flex-direction: column; padding: 8px 12px; border-left: 4px solid var(--chc); background: var(--panel-2); border-radius: 10px; }
    .sec-ch2 .ch2-eras { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
    .sec-ch2 .ch2-era { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; text-align: left; padding: 8px 10px; border: 1px solid var(--line); border-top: 4px solid var(--line-2); border-radius: 10px; background: var(--panel-2); cursor: pointer; color: var(--ink); font-size: 15px; line-height: 1.25; }
    .sec-ch2 .ch2-era:hover { border-color: var(--chc); }
    .sec-ch2 .ch2-era.past { border-top-color: color-mix(in srgb, var(--chc) 45%, var(--line)); }
    .sec-ch2 .ch2-era.on { border-color: var(--chc); border-top-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); }
    .sec-ch2 .ch2-dot { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--panel-3); font-size: 12.5px; font-weight: 800; margin-bottom: 3px; }
    .sec-ch2 .ch2-era.on .ch2-dot { background: var(--chc); color: var(--panel); }
    .sec-ch2 .ch2-tl { display: grid; grid-template-columns: repeat(24, minmax(0, 1fr)); gap: 3px; margin: 10px 0; }
    .sec-ch2 .ch2-mid { height: auto; min-height: 244px; }
    .sec-ch2 .ch2-meter { width: 120px; display: inline-block; }
    .sec-ch2 .ch2-c { height: 38px; border-radius: 5px; display: grid; place-items: center; font: 800 13px var(--mono); border: 1.5px solid transparent; }
    .sec-ch2 .ch2-c.job { background: var(--proc-bg); border-color: var(--proc); color: var(--proc); }
    .sec-ch2 .ch2-c.os { background: var(--os-bg); border-color: var(--os); color: var(--os); }
    .sec-ch2 .ch2-c.warn { background: var(--warn-bg); border-color: var(--warn); }
    .sec-ch2 .ch2-c.wait { background: transparent; border: 1.5px dashed var(--line-2); }
    .sec-ch2 .ch2-key { display: inline-block; width: 16px; height: 16px; margin-left: 6px; }
    @media (max-width: 760px) {
      .sec-ch2 .ch2-eras { gap: 5px; }
      .sec-ch2 .ch2-era { align-items: center; padding: 6px 4px; }
      .sec-ch2 .ch2-era b, .sec-ch2 .ch2-era .xs { display: none; }
      .sec-ch2 .ch2-era .ch2-dot { margin: 0; }
      .sec-ch2 .ch2-tl { gap: 2px; }
      .sec-ch2 .ch2-c { height: 26px; font-size: 10px; border-width: 1px; }
      .sec-ch2 .ch2-mid { min-height: 0; }
    }
  `,
  steps: [
    {
      title: 'Where does the operating system sit?',
      kind: 'story',
      render(el, ctx) {
        const { h } = ctx;
        const LAYERS = [
          { id: 'user', name: 'End user', col: 'user', sub: 'uses applications',
            d: 'The person at the keyboard or touchscreen. A user sees only applications and never needs to know how the hardware works. That is the whole point of the layers below.' },
          { id: 'apps', name: 'Application programs', col: 'proc', sub: 'browser, editor, game',
            d: 'Programs written to solve the user\'s problem. They are written against the interfaces below them, so the same program can run on many different machines.' },
          { id: 'utils', name: 'Utilities and libraries', col: 'util', sub: 'compilers, shells, file tools, common routines',
            d: 'System programs and shared libraries that come with the OS. They make programming and system administration easier, and they call into the kernel on the application\'s behalf.' },
          { id: 'os', name: 'Operating system', col: 'os', sub: 'its core part is called the kernel',
            d: 'The layer that owns the hardware. It hides device details behind simple services, decides which program gets which resource, and protects programs from one another. Only the OS may use the processor’s privileged instructions: the special ones that control the hardware directly.' },
          { id: 'hw', name: 'Computer hardware', col: 'hw', sub: '',
            d: 'The processor, memory, I/O devices and storage from Chapter 1. Hardware understands only machine instructions and electrical signals.' },
        ];
        const IFACES = {
          api: { name: 'API: application programming interface', d: 'The set of calls a program can make, in source code, to libraries and the OS: open a file, create a window, send a message. Code written to an API can be recompiled for any system that offers the same API.' },
          abi: { name: 'ABI: application binary interface', d: 'The same agreement at the level of compiled machine code: how arguments are passed, how system services are requested, how data is laid out. A compiled program runs on any system with the same ABI and ISA without being rebuilt.' },
          isa: { name: 'ISA: instruction set architecture', d: 'The machine instructions a processor understands, and the boundary between software and hardware. Ordinary programs may use the user part of the ISA; the privileged system part is reserved for the OS.' },
        };
        const SERVICES = [
          ['Program development', 'Editors, compilers and debuggers ship with the system (strictly as utilities), so nobody has to build tools before writing code.', 'You write, compile and debug a program with tools that came with your computer.'],
          ['Program execution', 'Starting a program takes many steps: load instructions and data into memory, set up I/O, prepare other resources. The OS does all of them for you.', 'You double-click an icon and the program simply starts.'],
          ['Access to I/O devices', 'Every device has its own commands and quirks. The OS hides them behind a few uniform operations such as read and write.', 'Your program saves "a file" without caring whether it lands on an SSD or a USB stick.'],
          ['Controlled access to files', 'The OS understands how data is laid out on storage devices and enforces who may read or change each file.', 'A classmate on the same machine cannot open your private folder.'],
          ['System access', 'On a shared or networked system, the OS decides who may use the system at all, and which resources each user may touch.', 'Logging in with a password before you see your desktop.'],
          ['Error detection and response', 'Hardware faults and software mistakes (dividing by zero, touching forbidden memory) must be caught and handled with as little damage as possible.', 'One program crashes, the OS ends it, and everything else keeps running.'],
          ['Accounting', 'The OS records who used how much of each resource, which helps tune performance and, on shared systems, bill users.', 'A task manager showing each program\'s processor and memory use.'],
        ];
        const MOMENTS = [
          ['OS', 'The OS is running. It picks program <b>A</b> and hands it the processor.'],
          ['A', 'A runs. Notice that the OS is <b>not running at all</b> now: there is only one processor, and A has it.'],
          ['OS', 'A timer interrupt fires. The hardware jumps into the OS, which is back in control.'],
          ['B', 'The OS saved A\'s state and gave the processor to <b>B</b>.'],
          ['OS', 'B asks to read a file. That request is a call into the OS, so the OS runs again.'],
          ['OS', 'The OS tells the disk to start reading, marks B as waiting, and picks A again.'],
          ['A', 'A carries on while the disk works in the background.'],
          ['OS', 'The disk interrupts: B\'s data is ready. The OS marks B as ready to run again. It regains control only through interrupts and calls like these.'],
        ];
        let view = 'layers', selLayer = null, selIf = null, selSvc = 0, moment = 0;
        const layerEls = {};
        const mkLayer = (l) => {
          const extra = h('div', { class: 'ch2-extra' });
          const b = h('div', { class: 'ch2-layer c-' + l.col, 'data-l': l.id, role: 'button', tabindex: 0, 'aria-label': l.name },
            h('div', { class: 'ch2-lt' }, h('b', {}, l.name), ...(l.sub ? [h('span', { class: 'xs muted' }, l.sub)] : [])), extra);
          b.extra = extra;
          layerEls[l.id] = b;
          const act = () => { if (view !== 'layers') { view = 'layers'; seg.set('layers'); } selLayer = l.id; selIf = null; paint(); };
          ctx.on(b, 'click', act);
          ctx.on(b, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
          return b;
        };
        const ifTags = {};
        const ifRow = (keys, label) => h('div', { class: 'ch2-if' },
          ...keys.map((k) => (ifTags[k] = h('button', { class: 'ch2-iftag', type: 'button', onclick: () => { if (view !== 'layers') { view = 'layers'; seg.set('layers'); } selIf = k; selLayer = null; paint(); } }, k.toUpperCase()))),
          h('span', { class: 'xs muted' }, label));
        const L = Object.fromEntries(LAYERS.map((l) => [l.id, l]));
        const stack = h('div', { class: 'ch2-stack' },
          mkLayer(L.user),
          mkLayer(L.apps),
          ifRow(['api', 'abi'], 'where programs call libraries and the OS'),
          mkLayer(L.utils),
          mkLayer(L.os),
          ifRow(['isa'], 'where software meets hardware'),
          mkLayer(L.hw));
        const hwChips = [['cpu', 'Processor'], ['mem', 'Main memory'], ['io', 'I/O devices'], ['io', 'Storage']].map(([c, t]) => h('span', { class: 'chip ' + c }, t));
        layerEls.hw.extra.append(...hwChips);
        const right = h('div', { class: 'stack ch2-right' });
        const seg = ctx.ui.seg([
          { value: 'layers', label: 'The layers' }, { value: 'iface', label: 'OS as interface' },
          { value: 'res', label: 'OS as resource manager' }, { value: 'evolve', label: 'Built to evolve' }],
        view, (v) => { view = v; selLayer = null; selIf = null; paint(); });
        const focus = { layers: null, iface: ['user', 'apps', 'os'], res: ['os', 'hw'], evolve: ['os'] };
        function paintLeft() {
          const f = focus[view];
          Object.entries(layerEls).forEach(([id, e]) => {
            e.classList.toggle('dim', !!f && !f.includes(id));
            e.classList.toggle('sel', (view === 'layers' && selLayer === id) || (!!f && id === 'os'));
          });
          Object.entries(ifTags).forEach(([k, t]) => t.classList.toggle('on', selIf === k));
          const ex = layerEls.os.extra;
          ex.innerHTML = '';
          if (view === 'iface') SERVICES.forEach((s, i) => ex.append(h('span', { class: 'chip ' + (i === selSvc ? 'os' : '') }, s[0])));
          if (view === 'res') ex.append(...['processor time', 'memory space', 'devices', 'files'].map((t) => h('span', { class: 'chip os' }, 'decides: ' + t)));
          if (view === 'evolve') ex.append(...['version 1', '→ new hardware', '→ new services', '→ fixes'].map((t, i) => h('span', { class: 'chip ' + (i ? '' : 'os') }, t)));
          hwChips.forEach((c) => c.classList.toggle('ch2-managed', view === 'res'));
        }
        function paintRight() {
          right.innerHTML = '';
          if (view === 'layers') {
            const item = selLayer ? L[selLayer] : selIf ? IFACES[selIf] : null;
            right.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'A stack of layers'), h('span', { class: 'chip accent' }, 'click any layer')),
              h('p', { class: 'small m0' }, 'Each layer uses only the layer below it, through an agreed interface. That separation lets the same application run on many machines, and lets the hardware change without rewriting every program.'),
              h('div', { class: 'card white ch2-detail', 'aria-live': 'polite' }, item
                ? h('div', {}, h('h3', {}, item.name), h('p', { class: 'small m0', html: item.d }))
                : h('p', { class: 'small muted m0' }, 'Pick a layer on the left, or one of the interface labels API, ABI or ISA, to see what it is.')),
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A restaurant: diners (users) order from a menu (applications), waiters carry the orders (libraries), the kitchen manager (OS) runs the kitchen, and the stoves and fridges (hardware) do the physical work.' }),
              h('div', { class: 'card tight small' }, h('h4', {}, 'Who works at which layer'), h('div', { html: '<b>End user:</b> only applications. <b>Application programmer:</b> the API and utilities. <b>OS designer:</b> the bare hardware and its ISA.' })));
          } else if (view === 'iface') {
            const s = SERVICES[selSvc];
            right.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Services the OS offers'), h('span', { class: 'chip ok' }, 'goal: convenience')),
              h('div', { class: 'ch2-svcs' }, ...SERVICES.map((x, i) => h('button', { class: 'btn sm ' + (i === selSvc ? 'on' : ''), type: 'button', onclick: () => { selSvc = i; paint(); } }, x[0]))),
              h('div', { class: 'card white ch2-detail', 'aria-live': 'polite' }, h('h3', {}, s[0]), h('p', { class: 'small', html: s[1] }), h('p', { class: 'small muted m0', html: '<b>Example:</b> ' + s[2] })),
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'Without these services every program would need its own disk driver, its own file format and its own error handling. The OS writes them once for everyone.' }));
          } else if (view === 'res') {
            const strip = h('div', { class: 'ch2-strip' }, ...MOMENTS.map((m, i) => h('span', { class: 'ch2-slot ' + (i <= moment ? (m[0] === 'OS' ? 'os' : 'proc') : 'empty') + (i === moment ? ' now' : '') }, i <= moment ? m[0] : '')));
            right.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'The manager that must let go'), h('span', { class: 'chip ok' }, 'goal: efficiency')),
              h('p', { class: 'small m0' }, 'The OS shares out the hardware. The twist: the OS is itself a program, so while a program runs, the OS is not running. Step through who holds the processor.'),
              h('div', { class: 'card white stack', style: { gap: '8px' } },
                h('div', { class: 'xs muted b' }, 'WHO HOLDS THE ONE PROCESSOR, MOMENT BY MOMENT'), strip,
                h('p', { class: 'small m0 ch2-cap', html: MOMENTS[moment][1] }),
                h('div', { class: 'row' },
                  h('button', { class: 'btn sm', type: 'button', disabled: moment === 0, onclick: () => { moment = 0; paint(); } }, 'Restart'),
                  h('button', { class: 'btn sm primary', type: 'button', disabled: moment >= MOMENTS.length - 1, onclick: () => { moment = Math.min(MOMENTS.length - 1, moment + 1); paint(); } }, 'Next moment ▶'),
                  h('span', { class: 'xs muted' }, `moment ${moment + 1} of ${MOMENTS.length}`))),
              h('table', { class: 'tbl compact', html: '<tr><th>Resource</th><th>What the OS decides</th></tr><tr><td>Processor</td><td>which program runs next, and for how long</td></tr><tr><td>Main memory</td><td>which program gets which region</td></tr><tr><td>I/O devices</td><td>who may use each device, and when</td></tr><tr><td>Files</td><td>who may read or change each file</td></tr>' }));
          } else {
            right.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Built to change'), h('span', { class: 'chip ok' }, 'goal: ability to evolve')),
              h('p', { class: 'small m0' }, 'An OS lives for decades, so it must absorb change without being rewritten. Three forces keep changing it:'),
              h('div', { class: 'ch2-ev' }, h('b', {}, 'New and upgraded hardware'), h('span', { class: 'small' }, 'New kinds of devices, more cores, bigger memories. The OS must learn to drive and exploit them.')),
              h('div', { class: 'ch2-ev' }, h('b', {}, 'New services'), h('span', { class: 'small' }, 'Users expect new features: new file systems, networking, security tools.')),
              h('div', { class: 'ch2-ev' }, h('b', {}, 'Fixes'), h('span', { class: 'small' }, 'Every large OS has faults that are found over time, and some fixes introduce new faults.')),
              h('div', { class: 'callout why m0', 'data-label': 'Design lesson', html: 'Build the OS from modules with clear interfaces and good documentation, so one part can be replaced without breaking the rest.' }));
          }
        }
        function paint() { paintLeft(); paintRight(); ctx.refit(); }
        el.append(h('div', { class: 'split r fill' }, h('div', { class: 'stack' }, seg, stack,
          h('p', { class: 'xs muted m0' }, 'API: the calls a program makes in its source code. ABI: the same agreement for compiled code. ISA: the machine instructions the hardware understands.')), right));
        paint();
      },
    },
    {
      title: 'How each fix created the next era',
      kind: 'explore',
      render(el, ctx) {
        const { h } = ctx;
        // strip codes: S setup, M monitor/OS, W waiting for I/O (processor idle), I idle, anything else = useful work
        const ERAS = [
          { name: 'Serial processing', years: 'late 1940s to mid-1950s', secs: '2.2',
            strip: 'SSSSSJJWWJJWWJSSIIIIIIII', note: 'Most of the booking goes on setup, and the unused end of it is simply lost.', pic: 'Booking a tennis court by the hour: finish early and the court sits empty; run over and you are sent off mid-game.',
            how: 'There is no operating system. A programmer books the machine for a block of time on a sign-up sheet, loads the program by hand from punched cards, and reads the result from lights or a printer.',
            waste: 'Book an hour and finish in 45 minutes, and the rest of the hour is wasted. Much of each booking also goes on <b>setup</b>: loading the compiler, the program and the libraries by hand.',
            fix: 'Let a program load and run the jobs one after another, with no human in between.' },
          { name: 'Simple batch systems', years: 'mid-1950s', secs: '2.2',
            strip: 'MJWWWJMJWWWJMJWWWJMJWWWJ', note: 'Each job computes briefly, then the processor idles while the job waits for I/O.', pic: 'A stage manager who sends the next act on the moment the last one leaves, but who cannot stop an act from standing around waiting for a prop.',
            how: 'An operator collects jobs into a batch. A program that stays in memory, the <span class="t">resident monitor</span>, reads each job and the short orders that come with it (its <span class="t">job control language</span>), runs it, and takes control back when it ends. New hardware guards the monitor: jobs run in a restricted <span class="t">user mode</span> and cannot touch its memory, while the monitor runs in an all-powerful <span class="t">kernel mode</span>; a timer stops any job that runs too long.',
            waste: 'Setup is gone, but whenever the running job waits for a tape or disk, the processor sits idle. For typical business jobs, that can be most of the time.',
            fix: 'Keep several jobs in memory, and when one waits for I/O, switch to another.' },
          { name: 'Multiprogrammed batch', years: '1960s', secs: '2.2 · 2.3',
            strip: 'MAABBCCMAABBCMABBCCIMABC', note: 'While job A waits for I/O, B or C runs. The processor idles only when every job is waiting.', pic: 'A cook with three dishes on the go: while one simmers, she chops vegetables for the next instead of watching the pot.',
            how: 'Memory holds several jobs at once (<span class="t">multiprogramming</span>). When the running job has to wait for I/O, the OS gives the processor to another job that is ready. This needs interrupts, a way to keep each job’s memory apart (memory management) and a rule for picking the next job (scheduling).',
            waste: 'The processor is now busy nearly all the time, but a user still hands in a job and waits hours for the output, with no way to interact with the running program.',
            fix: 'Let many users at terminals share the processor in short turns.' },
          { name: 'Time-sharing systems', years: '1960s onward', secs: '2.2 · 2.3',
            strip: 'M111M222M333M444M111M222', note: 'Users 1 to 4 take turns. More time goes on switching, but every user gets a turn every few slots.', pic: 'A chess master playing twenty boards at once, one move per board, so fast that every opponent feels watched.',
            how: 'Many users type at terminals connected to one computer. In <span class="t">time sharing</span> the OS gives each user a short slice of processor time in rotation, so quickly that everyone feels they have the machine to themselves.',
            waste: 'The goal changes from keeping the processor busy to answering each user quickly. New problems appear: protecting each user\'s files and memory from the others, and sharing devices fairly.',
            fix: 'These problems shaped the big ideas of section 2.3: the process (a running program the OS keeps track of), memory management, protection and scheduling.' },
          { name: 'Modern systems', years: '1990s to today', secs: '2.4 to 2.11',
            strip: 'MABCABMCABCAMBCABMCABCAB', note: 'One core shown. A multicore chip runs several strips like this at the same time.', pic: 'A busy kitchen with several cooks (cores), each juggling several dishes, all sharing one pantry.',
            how: 'Programs split into several paths of execution (threads), machines with many processors or cores sharing one memory, small kernels that move most services outside, and systems that keep running when a part fails. Sections 2.4 to 2.6 explain these ideas; Windows, UNIX, Linux and Android are all built from them.',
            waste: 'With many cores, the new challenge is keeping every core busy without the programs and the OS itself tripping over one another.',
            fix: 'That challenge is the common theme of the rest of this guide: processes, threads and concurrency.' },
        ];
        let cur = 0;
        const eraBtns = ERAS.map((e, i) => h('button', { class: 'ch2-era', type: 'button', onclick: () => { cur = i; paint(); } },
          h('span', { class: 'ch2-dot' }, String(i + 1)), h('b', {}, e.name), h('span', { class: 'xs muted' }, e.years)));
        const what = h('div', { class: 'card white' });
        const stripBox = h('div', { class: 'card' });
        const waste = h('div', { class: 'callout bad m0', 'data-label': 'The waste or the new problem' });
        const fix = h('div', { class: 'callout tip m0', 'data-label': 'The fix that opened the next era' });
        const secs = h('span', { class: 'xs muted b' });
        const prev = h('button', { class: 'btn sm', type: 'button', onclick: () => { cur = Math.max(0, cur - 1); paint(); } }, '◀ Earlier');
        const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { cur = Math.min(ERAS.length - 1, cur + 1); paint(); } }, 'Next era ▶');
        const KIND = { S: ['warn', 'setup'], M: ['os', 'OS / monitor'], W: ['wait', 'waiting for I/O'], I: ['wait', 'idle'] };
        function paint() {
          const e = ERAS[cur];
          eraBtns.forEach((b, i) => { b.classList.toggle('on', i === cur); b.classList.toggle('past', i < cur); });
          what.innerHTML = `<h3>${e.name} <span class="xs muted">${e.years}</span></h3><p class="small">${e.how}</p><p class="small muted m0"><b>Picture it:</b> ${e.pic}</p>`;
          const cells = e.strip.split('');
          const useful = cells.filter((c) => !KIND[c]).length;
          stripBox.innerHTML = '';
          stripBox.append(
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted b' }, 'PROCESSOR TIME, SLOT BY SLOT (ILLUSTRATIVE)'),
              h('span', { class: 'row gap-s small b' }, `useful work: ${useful} of ${cells.length} slots (${Math.round((useful / cells.length) * 100)}%)`, h('span', { class: 'meter ch2-meter' }, h('i', { style: { width: (useful / cells.length) * 100 + '%' } })))),
            h('div', { class: 'ch2-tl' }, ...cells.map((c) => h('span', { class: 'ch2-c ' + (KIND[c] ? KIND[c][0] : 'job'), title: KIND[c] ? KIND[c][1] : 'program running' }, KIND[c] ? (c === 'M' ? 'M' : '') : (c === 'J' ? '' : c)))),
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small' }, e.note),
              h('span', { class: 'row gap-s xs' }, h('span', { class: 'ch2-c job ch2-key' }), 'program', h('span', { class: 'ch2-c os ch2-key' }), 'OS or monitor', h('span', { class: 'ch2-c warn ch2-key' }), 'setup', h('span', { class: 'ch2-c wait ch2-key' }), 'idle')));
          waste.innerHTML = e.waste;
          fix.innerHTML = e.fix;
          secs.textContent = (e.secs.length > 3 ? 'LEARN IT IN SECTIONS ' : 'LEARN IT IN SECTION ') + e.secs;
          prev.disabled = cur === 0; next.disabled = cur === ERAS.length - 1;
          ctx.refit();
        }
        el.append(h('div', { class: 'stack fill' },
          h('div', { class: 'ch2-eras' }, ...eraBtns),
          h('div', { class: 'split ch2-mid' }, what, h('div', { class: 'stack' }, waste, fix)),
          stripBox,
          h('div', { class: 'row' }, prev, next, secs)));
        paint();
      },
    },
  ],
  notes: `
    <h3>How Chapter 2 fits together</h3>
    <p>Chapter 1 described the hardware. Chapter 2 asks what software must sit on top of it, why it looks the way it does, and how real systems are organised.</p>
    <h4>What an OS is for (2.1)</h4>
    <p>An OS has three objectives: <b>convenience</b>, <b>efficiency</b> and the <b>ability to evolve</b>. As an <b>interface</b> it offers services (program development and execution, I/O and file access, system access, error handling, accounting) through agreed boundaries: the API for source code, the ABI for compiled code and the ISA between software and hardware. As a <b>resource manager</b> it hands out processor time, memory, devices and files, even though it is itself a program that must give up the processor and win it back through interrupts.</p>
    <h4>How we got here (2.2)</h4>
    <p>Each era fixed the waste of the one before. <b>Serial processing</b> lost time to manual setup and booking. <b>Simple batch</b> systems added a resident monitor, plus the hardware it needed (memory protection, a timer, privileged instructions, user and kernel mode). <b>Multiprogramming</b> kept the processor busy during I/O waits, and <b>time sharing</b> gave interactive users quick responses.</p>
    <h4>The big ideas (2.3, 2.4)</h4>
    <p>Section 2.3 names the achievements that made this work: the <b>process</b>, <b>memory management</b> (including virtual memory), <b>information protection and security</b>, and <b>scheduling and resource management</b>. Section 2.4 adds the developments behind modern systems: microkernels, multithreading, symmetric multiprocessing, distributed systems and object-oriented design.</p>
    <h4>Staying up and scaling out (2.5, 2.6)</h4>
    <p>Fault tolerance (2.5) measures reliability and availability, classifies faults as permanent, transient or intermittent, and answers them with redundancy and OS tools such as process isolation and checkpoints. Section 2.6 lists the extra problems when several processors or cores share one OS: running kernel code on many processors at once, scheduling, synchronization, memory management and reliability.</p>
    <h4>Real systems (2.7 to 2.11)</h4>
    <p>The chapter ends with case studies: Windows, traditional UNIX, modern UNIX variants, Linux and Android. Look for the same ideas in each: a kernel, user and kernel mode, processes and threads, and a modular structure designed to evolve.</p>
    <h4>Why it matters next</h4>
    <p>The process, introduced here as the answer to multiprogramming and time sharing, is the subject of Chapter 3.</p>`,
});
Guide.chapter({
  num: 3,
  title: 'Process Description and Control',
  tagline: 'The process is the idea everything else is built on. Here is how the OS describes and controls every one.',
  intro: '<p>A program on disk is just a file. Running it creates a <span class="t">process</span>: a program in execution that the OS can start, pause, resume and protect. This chapter models a process\'s life as states and transitions, shows the tables and the <span class="t">process control block</span> the OS keeps for each process, and explains how processes are created and switched. It ends with where the OS\'s own code runs and how UNIX SVR4 puts it all together.</p>',
  objectives: [
    'Define a process and explain how it relates to its process control block.',
    'Explain the two-state, five-state and suspend process models and their transitions.',
    'Describe the tables and data structures the OS uses to manage processes.',
    'Explain process creation, mode switching and process switching.',
    'Compare the ways the OS\'s own code can be executed.',
    'Describe process management in UNIX SVR4.',
  ],
  terms: [
    ['Process control block (PCB)', 'The data structure the OS keeps for each process, holding its identifier, state, saved registers, priority, memory pointers and other information needed to manage it.'],
    ['Process', 'A program in execution: the running program together with its current state, its memory and the resources the OS has given it. The OS schedules and manages work in units of processes.'],
    ['Process image', 'Everything that makes up a process in memory: its program code, its data, its stack and its process control block (attributes).'],
    ['Process state', 'The condition a process is in at a given moment, such as New, Ready, Running, Blocked or Exit, which tells the OS what the process can do next.'],
    ['Dispatch', 'The act of choosing a Ready process and giving it the processor, by loading its saved register values so its instructions start executing.'],
    ['Blocked state', 'The state of a process that cannot continue until some event happens, such as an I/O operation completing; it is not eligible to run even if the processor is free.'],
    ['Swapping', 'Moving all or part of a process image from main memory out to disk (and later back) to free memory for other processes.'],
    ['Suspended process', 'A process that has been set aside, usually by swapping its image out of main memory to disk; it cannot run until it is explicitly brought back.'],
    ['Process switch', 'Taking the processor away from one process and giving it to another: the OS saves the first process\'s state in its PCB and restores the state of the next one.'],
  ],
  css: `
    .sec-ch3 .ch3-scene { display: grid; place-items: center; padding: 8px 10px; }
    .sec-ch3 .ch3-pcb .tbl td { padding: 3px 9px; }
    .sec-ch3 .ch3-pcb .tbl td:first-child { width: 38%; }
    .sec-ch3 .ch3-empty td { color: var(--muted); }
    .sec-ch3 .player-cap { min-height: 66px; }
  `,
  steps: [
    {
      title: 'The life of a process, from launch to exit',
      kind: 'story',
      render(el, ctx) {
        const { h } = ctx;
        // one frame per moment in the life of process 7; pcb fields: [label, value]
        const F = [
          { st: null, img: 'none', cpu: 'other', sec: '3.1', pcb: null,
            cap: '<b>A program is not a process.</b> On disk, <i>editor</i> is just a file of instructions. Nothing about it is running, and the OS keeps no record for it.' },
          { st: 'new', img: 'none', cpu: 'other', sec: '3.4', edge: null, changed: ['PID', 'State'],
            pcb: { PID: '7', State: 'New', PC: '(not set)', Priority: 'normal', Memory: 'being allocated', 'Open files': 'none', 'CPU time': '0 ms' },
            cap: 'You launch the editor. The OS <b>creates a process</b>: it assigns an identifier (PID 7), builds a <b>process control block (PCB)</b> for it, and marks it <b>New</b>.' },
          { st: 'new', img: 'mem', load: true, cpu: 'other', sec: '3.3', changed: ['PC', 'Memory'],
            pcb: { PID: '7', State: 'New', PC: '0x4000 (entry)', Priority: 'normal', Memory: 'code, data, stack', 'Open files': 'none', 'CPU time': '0 ms' },
            cap: 'The OS loads the code and data into memory and sets up a <b>stack</b> (scratch space for the program’s function calls and local variables). Code, data, stack and PCB together form the <b>process image</b>.' },
          { st: 'ready', edge: 'admit', img: 'mem', cpu: 'other', sec: '3.2', changed: ['State'],
            pcb: { PID: '7', State: 'Ready', PC: '0x4000 (entry)', Priority: 'normal', Memory: 'code, data, stack', 'Open files': 'none', 'CPU time': '0 ms' },
            cap: '<b>Admit.</b> The process joins the Ready queue. It could run right now; it is just waiting for its turn on the processor.' },
          { st: 'running', edge: 'dispatch', img: 'mem', cpu: 'p7', sec: '3.2 · 3.4', changed: ['State'],
            pcb: { PID: '7', State: 'Running', PC: 'live in the processor', Priority: 'normal', Memory: 'code, data, stack', 'Open files': 'none', 'CPU time': 'counting' },
            cap: '<b>Dispatch.</b> The OS loads the process\'s registers into the processor. Its instructions now execute; the program counter moves through its code. (If it runs past its time limit, a <b>timeout</b> sends it back to Ready.)' },
          { st: 'blocked', edge: 'wait', img: 'mem', cpu: 'other', sec: '3.2', changed: ['State', 'PC', 'Open files', 'CPU time'],
            pcb: { PID: '7', State: 'Blocked (disk)', PC: '0x4130 (saved)', Priority: 'normal', Memory: 'code, data, stack', 'Open files': 'notes.txt', 'CPU time': '12 ms' },
            cap: '<b>Event wait.</b> It asks to read <i>notes.txt</i> and cannot continue until the disk delivers. The OS saves its registers in the PCB, marks it <b>Blocked</b>, and runs another process.' },
          { st: 'blocked', susp: true, img: 'disk', swap: true, cpu: 'other', sec: '3.2', changed: ['State', 'Memory'],
            pcb: { PID: '7', State: 'Blocked/Suspend', PC: '0x4130 (saved)', Priority: 'normal', Memory: 'swapped out to disk', 'Open files': 'notes.txt', 'CPU time': '12 ms' },
            cap: 'Memory is tight, so the OS <b>swaps</b> this blocked process\'s image out to disk to make room. It is now <b>Blocked/Suspend</b>: still waiting, and out of memory.' },
          { st: 'ready', susp: true, edge: 'occur', img: 'disk', cpu: 'other', sec: '3.2', changed: ['State'],
            pcb: { PID: '7', State: 'Ready/Suspend', PC: '0x4130 (saved)', Priority: 'normal', Memory: 'swapped out to disk', 'Open files': 'notes.txt', 'CPU time': '12 ms' },
            cap: '<b>Event occurs.</b> The disk interrupts: the data has arrived. The process waits for nothing now, but its image is still on disk, so it becomes <b>Ready/Suspend</b>.' },
          { st: 'ready', img: 'mem', load: true, arc: 'swap back in', cpu: 'other', sec: '3.2', changed: ['State', 'Memory'],
            pcb: { PID: '7', State: 'Ready', PC: '0x4130 (saved)', Priority: 'normal', Memory: 'code, data, stack', 'Open files': 'notes.txt', 'CPU time': '12 ms' },
            cap: '<b>Activate.</b> When memory frees up, the OS swaps the image back in. The process is <b>Ready</b> again and waits its turn for the processor.' },
          { st: 'running', edge: 'dispatch', img: 'mem', cpu: 'p7', sec: '3.4', changed: ['State', 'PC'],
            pcb: { PID: '7', State: 'Running', PC: 'restored: 0x4130', Priority: 'normal', Memory: 'code, data, stack', 'Open files': 'notes.txt', 'CPU time': 'counting' },
            cap: '<b>Process switch.</b> The OS restores the exact register values saved in the PCB, so the process carries on at 0x4130 as if it had never stopped.' },
          { st: 'exit', edge: 'release', img: 'freed', cpu: 'other', sec: '3.2 · 3.4', changed: ['State', 'Memory', 'Open files', 'CPU time'],
            pcb: { PID: '7', State: 'Exit', PC: '(finished)', Priority: 'normal', Memory: 'released', 'Open files': 'closed', 'CPU time': '30 ms' },
            cap: '<b>Release.</b> You close the editor. The OS frees its memory and closes its files, keeps the PCB briefly for accounting, then deletes it. Every step was done by OS code: where that code runs is section 3.5.' },
        ];
        const N = { new: [20, 20, 'New'], ready: [190, 20, 'Ready'], running: [380, 20, 'Running'], exit: [556, 20, 'Exit'], blocked: [285, 112, 'Blocked'] };
        const E = {
          admit: ['M124 40 H186', 155, 31, 'admit', 'middle'], dispatch: ['M294 33 H376', 335, 25, 'dispatch', 'middle'],
          timeout: ['M380 49 H298', 339, 66, 'timeout', 'middle'], release: ['M484 40 H552', 518, 31, 'release', 'middle'],
          wait: ['M432 60 L380 110', 446, 96, 'event wait', 'start'], occur: ['M298 112 L248 62', 272, 96, 'event occurs', 'end'],
        };
        const svgWrap = h('div', { class: 'card white ch3-scene' });
        function draw(f) {
          const node = (k) => { const [x, y, t] = N[k]; const on = f.st === k; return `<rect x="${x}" y="${y}" width="104" height="40" rx="20" class="${on ? 's-proc' : 's-panel'}" stroke-width="${on ? 3 : 1.5}"/><text x="${x + 52}" y="${y + 25}" text-anchor="middle" font-size="14" font-weight="${on ? 800 : 600}">${t}</text>`; };
          const edge = (k) => { const [d, lx, ly, t, an] = E[k]; const on = f.edge === k; return `<path d="${d}" fill="none" class="${on ? '' : 's-muted'}" style="${on ? 'stroke:var(--proc)' : ''}" stroke-width="${on ? 3 : 2}" marker-end="url(#arr-${on ? 'proc' : 'muted'})"/><text x="${lx}" y="${ly}" text-anchor="${an}" font-size="13" ${on ? 'font-weight="800" style="fill:var(--proc)"' : 'class="s-sub"'}>${t}</text>`; };
          const img7 = f.img === 'mem'
            ? `<rect x="556" y="222" width="92" height="116" rx="8" class="s-proc" stroke-width="2"/><text x="602" y="240" text-anchor="middle" font-size="13" font-weight="800">process 7</text>${['code', 'data', 'stack'].map((t, i) => `<rect x="566" y="${248 + i * 29}" width="72" height="24" rx="5" class="s-panel"/><text x="602" y="${265 + i * 29}" text-anchor="middle" font-size="13">${t}</text>`).join('')}`
            : `<rect x="556" y="222" width="92" height="116" rx="8" class="s-panel" stroke-dasharray="5 4"/><text x="602" y="284" text-anchor="middle" font-size="13" class="s-sub">free</text>`;
          const pcbRows = ['PCB 3', 'PCB 5'].concat(f.pcb ? ['PCB 7'] : []).map((t, i) => `<rect x="354" y="${262 + i * 24}" width="90" height="20" rx="4" class="${t === 'PCB 7' ? 's-proc' : 's-panel'}"/><text x="399" y="${277 + i * 24}" text-anchor="middle" font-size="13" font-weight="${t === 'PCB 7' ? 800 : 400}">${t}</text>`).join('');
          const arc = f.load || f.swap ? `<path d="${f.load ? 'M150 222 C 230 168, 470 164, 590 218' : 'M590 218 C 470 164, 230 168, 150 222'}" fill="none" style="stroke:var(--io)" stroke-width="3" stroke-dasharray="8 5" marker-end="url(#arr-io)"/><text x="486" y="174" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--io)">${f.arc || (f.load ? 'load into memory' : 'swap out to disk')}</text>` : '';
          svgWrap.innerHTML = `<svg viewBox="0 0 680 360" width="100%" role="img" aria-label="Five-state diagram with disk, processor and memory">
            ${Object.keys(E).map(edge).join('')}${Object.keys(N).map(node).join('')}
            ${!f.susp ? '' : f.st === 'ready' ? '<rect x="184" y="14" width="116" height="52" rx="24" fill="none" style="stroke:var(--io)" stroke-width="2.5" stroke-dasharray="6 4"/><text x="180" y="82" text-anchor="end" font-size="13" font-weight="800" style="fill:var(--io)">+ suspended</text>' : '<rect x="279" y="106" width="116" height="52" rx="24" fill="none" style="stroke:var(--io)" stroke-width="2.5" stroke-dasharray="6 4"/><text x="272" y="137" text-anchor="end" font-size="13" font-weight="800" style="fill:var(--io)">+ suspended</text>'}
            <rect x="20" y="190" width="150" height="160" rx="14" class="s-io" stroke-width="2"/><text x="95" y="212" text-anchor="middle" font-size="14" font-weight="800">Disk</text>
            <rect x="34" y="224" width="122" height="34" rx="6" class="s-panel"/><text x="95" y="246" text-anchor="middle" font-size="13">editor (program)</text>
            ${f.img === 'disk' ? '<rect x="34" y="268" width="122" height="66" rx="6" class="s-proc" stroke-dasharray="5 3" stroke-width="2"/><text x="95" y="296" text-anchor="middle" font-size="13" font-weight="800">process 7 image</text><text x="95" y="316" text-anchor="middle" font-size="13" class="s-sub">(swapped out)</text>' : ''}
            <rect x="186" y="190" width="130" height="160" rx="14" class="s-cpu" stroke-width="2"/><text x="251" y="212" text-anchor="middle" font-size="14" font-weight="800">Processor</text>
            <text x="251" y="252" text-anchor="middle" font-size="13" class="s-sub">now running</text>
            <text x="251" y="280" text-anchor="middle" font-size="${f.cpu === 'p7' ? 20 : 14}" font-weight="800" ${f.cpu === 'p7' ? 'style="fill:var(--proc)"' : ''}>${f.cpu === 'p7' ? 'process 7' : 'another process'}</text>
            ${f.cpu === 'p7' ? '<text x="251" y="306" text-anchor="middle" font-size="13" class="s-sub">PC points into</text><text x="251" y="324" text-anchor="middle" font-size="13" class="s-sub">the editor code</text>' : ''}
            <rect x="332" y="190" width="328" height="160" rx="14" class="s-mem" stroke-width="2"/><text x="496" y="212" text-anchor="middle" font-size="14" font-weight="800">Main memory</text>
            <rect x="344" y="222" width="110" height="116" rx="8" class="s-os" stroke-width="2"/><text x="399" y="241" text-anchor="middle" font-size="13" font-weight="800">OS: process</text><text x="399" y="256" text-anchor="middle" font-size="13" font-weight="800">table</text>${pcbRows}
            <rect x="466" y="222" width="80" height="116" rx="8" class="s-panel"/><text x="506" y="276" text-anchor="middle" font-size="13" class="s-sub">process</text><text x="506" y="292" text-anchor="middle" font-size="13" class="s-sub">3 image</text>
            ${img7}${arc}
          </svg>`;
        }
        const pcbBox = h('div', { class: 'card stack ch3-pcb', style: { gap: '8px' } });
        function paintPcb(f) {
          pcbBox.innerHTML = '';
          pcbBox.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'PCB of process 7'), h('span', { class: 'chip proc' }, 'learn it in ' + f.sec)));
          const rows = f.pcb || { PID: '', State: '', PC: '', Priority: '', Memory: '', 'Open files': '', 'CPU time': '' };
          pcbBox.append(h('table', { class: 'tbl compact' + (f.pcb ? '' : ' ch3-empty'), html: Object.entries(rows).map(([k, v]) => `<tr class="${(f.changed || []).includes(k) ? 'on' : ''}"><td class="b">${k}</td><td>${v || '—'}</td></tr>`).join('') }),
            h('p', { class: 'xs muted m0' }, f.pcb ? 'Highlighted rows just changed in this step.' : 'No PCB exists yet: a program on disk has no state, no saved registers and no memory.'),
            h('div', { class: 'callout why m0 small', 'data-label': 'Why the PCB matters', html: 'It holds everything needed to stop this process and later resume it exactly where it left off. Lose the PCB and the process is lost.' }));
        }
        const player = ctx.ui.player({ count: F.length, interval: 3400, render: (i) => { draw(F[i]); paintPcb(F[i]); return F[i].cap; } });
        el.append(h('div', { class: 'stack fill' }, h('div', { class: 'split r grow' }, svgWrap, pcbBox), player.el));
      },
    },
  ],
  notes: `
    <h3>How Chapter 3 fits together</h3>
    <p>Chapter 2 showed that multiprogramming and time sharing need a way to keep many programs in progress at once. The answer is the <b>process</b>, and this chapter describes it from four angles: what it is, what states it passes through, how the OS records it, and how the OS controls it.</p>
    <h4>What a process is (3.1)</h4>
    <p>A process is a program in execution. The OS tracks each one with a <b>process control block (PCB)</b> holding its identifier, state, priority, program counter, memory pointers, saved register values (context), I/O status and accounting information. Saving the program counter and context data in the PCB is what lets the OS interrupt a process and later resume it.</p>
    <h4>Its life story (3.2)</h4>
    <p>From the processor's point of view, running processes produce interleaved <b>traces</b> of instructions, with a small <b>dispatcher</b> switching between them. Process models grow step by step. The <b>two-state</b> model (Running, Not Running) cannot tell waiting processes from ready ones, so the <b>five-state</b> model adds New, Ready, Blocked and Exit, with transitions such as admit, dispatch, timeout, event wait, event occurs and release. When memory fills up, the OS may <b>swap</b> processes to disk, giving the <b>suspend</b> states: Ready/Suspend and Blocked/Suspend.</p>
    <h4>How the OS records it (3.3)</h4>
    <p>The OS keeps memory, I/O, file and process tables. Each process has a <b>process image</b>: program code, data, stack and PCB. The PCB's contents fall into three groups: process identification, processor state information and process control information.</p>
    <h4>How the OS controls it (3.4)</h4>
    <p>The processor has a <b>user mode</b> and a <b>kernel mode</b>. Creating a process takes five steps, from assigning an identifier to building the other data structures. The OS can regain control through an interrupt, a trap or a system call. A <b>mode switch</b> is cheap; a full <b>process switch</b> must save one process's context in its PCB, update queues and restore another's.</p>
    <h4>Where the OS itself runs (3.5) and a real example (3.6)</h4>
    <p>The OS kernel may run outside all processes, inside each user process, or as a set of separate system processes. UNIX SVR4 mostly runs OS code inside user processes, refines the seven-state model into nine process states, splits each process image into user-level, register and system-level context, and creates processes with the <b>fork</b> call.</p>
    <h4>Why it matters next</h4>
    <p>Chapter 4 splits the process in two: the resource owner (still the process) and the unit that runs (the thread).</p>`,
});
Guide.chapter({
  num: 4,
  title: 'Threads',
  tagline: 'One process, several paths of execution: why that helps, and how real systems build it.',
  intro: '<p>A process bundles two separate ideas: owning resources and being scheduled to run. <span class="t">Threads</span> pull them apart, so one process can run several independent paths of execution that share its memory and files. This chapter compares threads managed by a library inside the program (user-level) with threads managed by the kernel (kernel-level), uses a short formula, Amdahl\'s law, to measure what multicore chips can really gain, and tours thread management in Windows, Solaris, Linux, Android and Mac OS X (today\'s macOS).</p>',
  objectives: [
    'Distinguish the process (the unit that owns resources) from the thread (the unit that runs).',
    'Describe thread states, thread operations and why threads must synchronize.',
    'Compare user-level threads, kernel-level threads and combined approaches.',
    'Use Amdahl\'s law to estimate the speedup multithreaded software can get from more cores.',
    'Describe thread management in Windows, Solaris, Linux, Android and Mac OS X (Grand Central Dispatch).',
  ],
  terms: [
    ['Thread', 'A single path of execution inside a process, with its own program counter, registers, stack and state; all threads of a process share its code, data and resources.'],
    ['Multithreading', 'The ability of an operating system to support several concurrent threads of execution within a single process.'],
    ['Thread control block (TCB)', 'The small record kept for each thread, holding its state, priority and saved register values while it is not running.'],
    ['Stack', 'A region of memory that grows and shrinks as functions are called and return, holding return addresses, parameters and local variables; each thread has its own.'],
    ['Heap', 'The region of a process\'s memory used for data allocated while the program runs; it is shared by all threads of the process.'],
    ['Address space', 'The range of memory addresses a process may use; every thread in the process works within the same address space.'],
  ],
  css: `
    .sec-ch4 .ch4-scene { display: grid; place-items: center; padding: 6px 8px; }
    .sec-ch4 .ch4-hot, .sec-ch4 .ch4-add { cursor: pointer; outline: none; transition: opacity .2s; }
    .sec-ch4 .ch4-hot:hover .fr, .sec-ch4 .ch4-hot:focus-visible .fr { stroke-width: 3; stroke: var(--chc); }
    .sec-ch4 .ch4-map.picked .ch4-hot:not(.sel) { opacity: .45; }
    .sec-ch4 .ch4-hot.sel .fr { stroke-width: 3.5; stroke: var(--chc); }
    .sec-ch4 .ch4-add:hover rect { stroke: var(--chc); }
    .sec-ch4 .ch4-info { min-height: 210px; }
    .sec-ch4 .ch4-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 10px; height: 100%; }
    .sec-ch4 .ch4-item { display: flex; flex-direction: column; justify-content: space-between; gap: 6px; padding: 9px 11px; border: 1.5px solid var(--line); border-radius: 12px; background: var(--panel-2); }
    .sec-ch4 .ch4-item.ok { border-color: var(--ok); background: var(--ok-bg); }
    .sec-ch4 .ch4-item.bad { border-color: var(--bad); background: var(--bad-bg); }
    .sec-ch4 .ch4-name { font-weight: 700; font-size: 15px; line-height: 1.3; }
    .sec-ch4 .ch4-why { min-height: 16px; font-weight: 700; }
    .sec-ch4 .ch4-item.ok .ch4-why { color: var(--ok); }
    .sec-ch4 .ch4-item.bad .ch4-why { color: var(--bad); }
    .sec-ch4 .ch4-last { min-height: 128px; }
    @media (max-width: 760px) {
      .sec-ch4 .ch4-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: auto; height: auto; }
    }
    .sec-ch4 .ch4-pick.proc { background: var(--proc); color: var(--panel); }
    .sec-ch4 .ch4-pick.thread { background: var(--thread); color: var(--panel); }
  `,
  steps: [
    {
      title: 'One process, many threads: what they share',
      kind: 'story',
      render(el, ctx) {
        const { h } = ctx;
        const PARTS = {
          code: ['Code', 'shared', 'All threads run the same program code, but each can be at a different place in it at the same moment. Watch the T badges.'],
          data: ['Global data', 'shared', 'Global variables are visible to every thread. One thread can leave a result for another without asking the OS, which is fast, and also why two threads updating the same variable can clash (Chapter 5).'],
          heap: ['Heap', 'shared', 'Memory allocated while the program runs belongs to the process, so any thread holding a pointer to it can use it.'],
          files: ['Open files', 'shared', 'A file opened by one thread is open for all of them. If the autosave thread opens report.doc, the print thread can read it too.'],
          pcb: ['Process control block', 'shared', 'The process\'s own record: its address space (the range of memory addresses it may use), the resources it owns and its access rights. Threads come and go inside it.'],
          tcb: ['Thread control block (TCB)', 'private', 'The small record the OS keeps for each thread: its execution state (Running, Ready or Blocked), its priority, and room to save its registers while it is not running. Section 4.1 covers it.'],
          regs: ['Registers and program counter', 'private', 'Each thread is at its own point in the code, so each needs its own register values, above all its own program counter.'],
          stack: ['Stack', 'private', 'Each thread calls functions on its own, so each needs its own stack of return addresses and local variables. The bars show how deep its calls go right now.'],
        };
        const FNS = ['main()', 'readKeys()', 'drawScreen()', 'spellCheck()', 'autosave()', 'printPage()'];
        const DEPTH = { 'main()': 1, 'readKeys()': 2, 'drawScreen()': 3, 'spellCheck()': 3, 'autosave()': 2, 'printPage()': 2 };
        const TH = [
          { role: 'reads keystrokes', seq: [['readKeys()', 0], ['drawScreen()', 0], ['readKeys()', 1], ['readKeys()', 0]] },
          { role: 'checks spelling', seq: [['spellCheck()', 0], ['spellCheck()', 0], ['drawScreen()', 0], ['spellCheck()', 0]] },
          { role: 'autosaves', seq: [['autosave()', 0], ['autosave()', 1], ['autosave()', 1], ['autosave()', 1]] },
          { role: 'prints', seq: [['printPage()', 0], ['printPage()', 1], ['printPage()', 1], ['drawScreen()', 0]] },
        ];
        let n = 3, t = 0, sel = null, playing = true;
        const hot = (id, inner) => `<g class="hot ch4-hot${sel === id ? ' sel' : ''}" data-p="${id}" tabindex="0" role="button" aria-label="${PARTS[id][0]}">${inner}</g>`;
        const box = (x, y, w, hh, cls, title, sub) => `<rect class="fr ${cls}" x="${x}" y="${y}" width="${w}" height="${hh}" rx="9" stroke-width="1.5"/><text x="${x + 12}" y="${y + 22}" font-size="14" font-weight="800">${title}</text>${sub ? `<text x="${x + 12}" y="${y + 41}" font-size="13" class="s-sub">${sub}</text>` : ''}`;
        const wrap = h('div', { class: 'card white ch4-scene' });
        function states() {
          const cur = TH.slice(0, n).map((th, i) => { const [fn, blk] = th.seq[(t + i) % th.seq.length]; return { fn, blk, i }; });
          const cand = cur.filter((c) => !c.blk);
          const run = cand.length ? cand[t % cand.length].i : -1;
          return cur.map((c) => ({ ...c, st: c.blk ? 'Blocked' : c.i === run ? 'Running' : 'Ready' }));
        }
        function draw() {
          const S = states();
          const codeLines = FNS.map((f, k) => {
            const y = 104 + k * 21;
            const here = S.filter((s) => s.fn === f);
            return `<text x="36" y="${y}" font-size="13" class="s-monot">${f}</text>` + here.map((s, j) => `<rect x="${150 + j * 29}" y="${y - 13}" width="26" height="17" rx="5" class="s-thread" stroke-width="${s.st === 'Running' ? 2.5 : 1}"/><text x="${163 + j * 29}" y="${y}" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--thread)">T${s.i + 1}</text>`).join('');
          }).join('');
          const threads = [0, 1, 2, 3].map((i) => {
            const x = 22 + i * 156, y = 280;
            if (i >= n) return `<g class="ch4-add" data-add="${i + 1}" role="button" tabindex="0" aria-label="Add thread"><rect x="${x}" y="${y}" width="146" height="172" rx="12" class="s-panel" stroke-dasharray="6 5"/><text x="${x + 73}" y="${y + 90}" text-anchor="middle" font-size="14" class="s-sub">+ add thread ${i + 1}</text></g>`;
            const s = S[i];
            const bars = Array.from({ length: DEPTH[s.fn] }, (_, k) => `<rect x="${x + 70}" y="${y + 154 - k * 12}" width="60" height="9" rx="3" class="s-thread" stroke-width="1"/>`).join('');
            return `<rect x="${x}" y="${y}" width="146" height="172" rx="12" class="s-thread" stroke-width="${s.st === 'Running' ? 3 : 1.5}"/>
              <text x="${x + 10}" y="${y + 20}" font-size="14" font-weight="800">Thread ${i + 1}</text><text x="${x + 10}" y="${y + 37}" font-size="13" class="s-sub">${TH[i].role}</text>
              ${hot('tcb', `<rect class="fr s-panel" x="${x + 8}" y="${y + 46}" width="130" height="30" rx="6"/><text x="${x + 16}" y="${y + 66}" font-size="13">TCB: <tspan font-weight="800" style="fill:var(--${s.st === 'Running' ? 'ok' : s.st === 'Blocked' ? 'intr' : 'ink-2'})">${s.st}</tspan></text>`)}
              ${hot('regs', `<rect class="fr s-panel" x="${x + 8}" y="${y + 82}" width="130" height="30" rx="6"/><text x="${x + 16}" y="${y + 102}" font-size="13" class="s-monot">PC→${s.fn.replace('()', '')}</text>`)}
              ${hot('stack', `<rect class="fr s-panel" x="${x + 8}" y="${y + 118}" width="130" height="46" rx="6"/><text x="${x + 16}" y="${y + 146}" font-size="13">Stack</text>${bars}`)}`;
          }).join('');
          wrap.innerHTML = `<svg viewBox="0 0 660 470" width="100%" class="ch4-map${sel ? ' picked' : ''}" role="img" aria-label="A process with shared code, data, heap and files, and one to four threads each with its own TCB, registers and stack">
            <rect x="6" y="6" width="648" height="458" rx="16" class="s-proc" stroke-width="2"/>
            <text x="22" y="30" font-size="13" font-weight="800" style="fill:var(--proc)">PROCESS: ONE ADDRESS SPACE, ONE SET OF RESOURCES</text>
            <text x="22" y="52" font-size="13" font-weight="800" class="s-sub">SHARED BY EVERY THREAD</text>
            ${hot('code', `<rect class="fr s-panel" x="22" y="60" width="252" height="192" rx="9" stroke-width="1.5"/><text x="34" y="80" font-size="14" font-weight="800">Code</text>${codeLines}`)}
            ${hot('data', box(288, 60, 170, 92, 's-panel', 'Global data', 'document text'))}
            ${hot('heap', box(288, 160, 170, 92, 's-panel', 'Heap', 'run-time memory'))}
            ${hot('files', box(470, 60, 170, 92, 's-panel', 'Open files', 'report.doc'))}
            ${hot('pcb', box(470, 160, 170, 92, 's-os', 'Process PCB', 'address space, rights'))}
            <text x="22" y="272" font-size="13" font-weight="800" class="s-sub">PRIVATE TO EACH THREAD</text>
            ${threads}
          </svg>`;
        }
        const act = (e) => {
          const g = e.target.closest && e.target.closest('.ch4-hot, .ch4-add');
          if (!g) return;
          if (g.dataset.add) setN(+g.dataset.add); else pick(g.dataset.p);
        };
        ctx.on(wrap, 'click', act);
        ctx.on(wrap, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(e); } });
        const info = h('div', { class: 'card white ch4-info', 'aria-live': 'polite' });
        function paintInfo() {
          if (!sel) {
            info.innerHTML = '<h3>The idea</h3><p class="small m0">A word processor is one process: one program, one document, one set of files. Inside it, several <span class="t">threads</span> run independently: one reads your keystrokes while another checks spelling. Each thread box shows its <b>TCB</b> (thread control block: the small record the OS keeps for each thread, holding its state), its program counter and its stack. Click any part of the picture: is it shared, or does each thread get its own?</p>';
            return;
          }
          const [name, kind, d] = PARTS[sel];
          info.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="m0">${name}</h3><span class="chip ${kind === 'shared' ? 'proc' : 'thread'}">${kind === 'shared' ? 'shared by all threads' : 'one per thread'}</span></div><p class="small mt m0">${d}</p>`;
        }
        function pick(id) { sel = sel === id ? null : id; draw(); paintInfo(); ctx.refit(); }
        const seg = ctx.ui.seg([1, 2, 3, 4].map((k) => ({ value: k, label: k + (k === 1 ? ' thread' : ' threads') })), n, (v) => setN(v));
        function setN(v) { n = v; seg.set(v); draw(); }
        const playBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { playing = !playing; paintPlay(); } });
        const paintPlay = () => { playBtn.textContent = playing ? 'Pause motion' : 'Resume motion'; };
        const stepBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { t++; draw(); } }, 'Step once');
        ctx.every(1300, () => { if (playing) { t++; draw(); } });
        const right = h('div', { class: 'stack' },
          h('div', { class: 'row' }, seg),
          h('div', { class: 'row' }, playBtn, stepBtn, h('span', { class: 'xs muted' }, 'one core: one thread runs at a time')),
          info,
          h('div', { class: 'callout why m0 small', 'data-label': 'Why threads?', html: 'Compared with separate processes, threads are quicker to create, quicker to end and quicker to switch between, and they share memory without asking the kernel.' }),
          h('div', { class: 'callout warn m0 small', 'data-label': 'The catch', html: 'Because threads share everything, one can trample another\'s data. Keeping them in step is the subject of Chapter 5.' }));
        el.append(h('div', { class: 'split r fill' }, wrap, right));
        paintPlay(); draw(); paintInfo();
      },
    },
    {
      title: 'Shared or private? Sort the parts of a process',
      kind: 'explore',
      render(el, ctx) {
        const { h } = ctx;
        // [item, 0 = shared by all threads, 1 = private to each thread, reason]
        const ITEMS = [
          ['Program code', 0, 'There is one copy of the program; every thread executes instructions from it.'],
          ['Program counter', 1, 'Each thread is at its own place in the code, so each has its own program counter.'],
          ['Global variables', 0, 'They live in the process\'s data area, visible to every thread.'],
          ['Stack', 1, 'Each thread makes its own function calls, so each needs its own stack.'],
          ['Open files', 0, 'Files belong to the process; a file one thread opens is open for all of them.'],
          ['Register values', 1, 'Each thread has its own saved register set, restored when it is next run.'],
          ['Heap (memory requested while running)', 0, 'Memory the program asks for while it runs belongs to the process as a whole, so any thread holding its address can use it.'],
          ['Execution state (Running, Ready, Blocked)', 1, 'One thread can be blocked on the disk while another runs, so state is kept per thread.'],
          ['Address space', 0, 'All threads live inside the same address space; that is what makes sharing cheap.'],
          ['Local variables of the current function', 1, 'Locals live on the stack, and each thread has its own stack.'],
          ['Process identifier (PID)', 0, 'The PID names the process, and every thread in it belongs to that one process.'],
          ['Where to return when the current function ends', 1, 'That return address is saved on the stack when the function is called, and each thread has its own stack.'],
        ];
        const ans = ITEMS.map(() => null);
        const score = h('div', { class: 'big' });
        const scoreSub = h('div', { class: 'small muted' });
        const last = h('div', { class: 'card white ch4-last', 'aria-live': 'polite' });
        const cards = ITEMS.map((it, i) => {
          const why = h('div', { class: 'xs ch4-why' });
          const mk = (v, label) => h('button', { class: 'btn sm ' + (v ? 'thread' : 'proc'), type: 'button', onclick: () => answer(i, v) }, label);
          const btns = [mk(0, 'Shared'), mk(1, 'Private')];
          const c = h('div', { class: 'ch4-item' }, h('div', { class: 'ch4-name' }, it[0]), h('div', { class: 'row gap-s' }, ...btns), why);
          c.why = why; c.btns = btns;
          return c;
        });
        function answer(i, v) {
          ans[i] = v;
          const ok = v === ITEMS[i][1];
          last.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="m0">${ITEMS[i][0]}</h3><span class="chip ${ok ? 'ok' : 'bad'}">${ok ? '✓ correct' : '✗ not quite'}</span></div>
            <p class="small mt m0"><b>${ITEMS[i][1] ? 'Private to each thread.' : 'Shared by all threads.'}</b> ${ITEMS[i][2]}</p>`;
          paint();
        }
        function paint() {
          let right = 0, done = 0;
          cards.forEach((c, i) => {
            const a = ans[i];
            c.classList.remove('ok', 'bad');
            c.btns.forEach((b, v) => b.classList.toggle('ch4-pick', a === v));
            if (a === null) { c.why.textContent = ''; return; }
            done++;
            const ok = a === ITEMS[i][1];
            if (ok) right++;
            c.classList.add(ok ? 'ok' : 'bad');
            c.why.textContent = ok ? (a ? '✓ private' : '✓ shared') : (ITEMS[i][1] ? '✗ it is private' : '✗ it is shared');
          });
          score.textContent = `${right} / ${ITEMS.length}`;
          scoreSub.textContent = done < ITEMS.length ? `${done} of ${ITEMS.length} sorted. Change an answer any time.` : right === ITEMS.length ? 'All correct. You can tell a process from a thread.' : 'All sorted. Fix the red ones.';
          ctx.refit();
        }
        const reset = h('button', { class: 'btn sm', type: 'button', onclick: () => { ans.fill(null); last.innerHTML = '<p class="small muted m0">Your explanation for each answer appears here.</p>'; paint(); } }, 'Start over');
        last.innerHTML = '<p class="small muted m0">Your explanation for each answer appears here.</p>';
        el.append(h('div', { class: 'split r fill' },
          h('div', { class: 'ch4-grid' }, ...cards),
          h('div', { class: 'stack' },
            h('p', { class: 'lead m0' }, 'For each part of a multithreaded process, decide: is there one copy for the whole process, or one per thread?'),
            h('div', { class: 'row', style: { alignItems: 'baseline' } }, score, h('span', { class: 'small b' }, 'correct')), scoreSub,
            last,
            h('div', { class: 'callout tip m0 small', 'data-label': 'Rule of thumb', html: 'Whatever a thread needs to keep its own place in the program (program counter, registers, stack, state) is private. Everything the program owns (code, data, files, memory) is shared.' }),
            h('div', { class: 'row' }, reset))));
        paint();
      },
    },
  ],
  notes: `
    <h3>How Chapter 4 fits together</h3>
    <p>Chapter 3 treated the process as one thing. This chapter splits it into two ideas: the process as the owner of resources (address space, files, devices) and the <b>thread</b> as the unit that is scheduled and runs.</p>
    <h4>The idea (4.1)</h4>
    <p>In a multithreaded process, all threads share the code, data, heap, open files and address space. Each thread keeps its own program counter, registers, stack, execution state and a small <b>thread control block</b>. Compared with separate processes, threads are quicker to create, end and switch between, and they communicate through shared memory without calling the kernel. Threads have states (Running, Ready, Blocked) and operations (spawn, block, unblock, finish). Because they share data, they must <b>synchronize</b>, which leads straight into Chapter 5.</p>
    <h4>Who manages threads (4.2)</h4>
    <p><b>User-level threads</b> live in a library inside the process. Switching them needs no kernel help, but one blocking system call can stall them all and they cannot run on two processors at once. <b>Kernel-level threads</b> are known to the OS, so they can block independently and run in parallel, at the cost of a mode switch per thread switch. <b>Combined</b> designs map many user threads onto a smaller or equal number of kernel threads.</p>
    <h4>What more cores can buy (4.3)</h4>
    <p><b>Amdahl's law</b> limits the speedup: if a fraction f of a program can run in parallel on N processors, speedup = 1 / ((1 − f) + f / N). Even a small serial part caps the gain. Worked example: with f = 0.9 and N = 8, speedup = 1 / (0.1 + 0.1125) ≈ 4.7, far short of 8.</p>
    <h4>Real systems (4.4 to 4.8)</h4>
    <p>Each case study answers the same questions differently. <b>Windows</b> builds processes and threads as objects and gives threads a larger set of states. <b>Solaris</b> layers user threads, lightweight processes and kernel threads. <b>Linux</b> treats both as tasks created by clone, with flags choosing what is shared. <b>Android</b> organises apps into components and processes with a life cycle. <b>Mac OS X Grand Central Dispatch</b> lets programmers submit blocks of work to queues and leaves thread management to the system.</p>
    <h4>Why it matters next</h4>
    <p>Threads and processes that share data can interfere with one another. Chapter 5 shows how to keep them correct.</p>`,
});
Guide.chapter({
  num: 5,
  title: 'Concurrency: Mutual Exclusion and Synchronization',
  tagline: 'When threads share data, timing decides the result. Here is how to make them take turns safely.',
  intro: '<p>When several processes or threads are in progress at the same time (<span class="t">concurrency</span>) and share data, the result can depend on the exact order in which their instructions happen to interleave. This chapter first tries to make two processes take turns using nothing but ordinary reads and writes, then steps back to see how timing produces a <span class="t">race condition</span> and what any correct solution must guarantee. It then builds stronger tools for <span class="t">mutual exclusion</span> and synchronization: special hardware instructions, semaphores, monitors and message passing, ending with the classic readers/writers problem.</p>',
  objectives: [
    'Explain race conditions, the OS concerns they raise and the requirements for mutual exclusion.',
    'Trace software solutions to mutual exclusion, including Dekker\'s and Peterson\'s algorithms.',
    'Explain hardware support: disabling interrupts and special atomic instructions.',
    'Use semaphores, monitors and message passing to synchronize processes.',
    'Solve the producer/consumer and readers/writers problems.',
  ],
  terms: [
    ['Concurrency', 'Several processes or threads being in progress at the same time, either taking turns on one processor or running at once on several, and possibly sharing data and resources.'],
    ['Multiprocessing', 'Managing many processes on a computer with several processors that share main memory, so that processes can truly run at the same instant.'],
    ['Distributed processing', 'Managing many processes spread across several separate computers, each with its own memory, that cooperate over a network.'],
    ['Interleaving', 'Running several processes on one processor by switching between them, so their instructions take turns rather than running at the same instant.'],
    ['Overlapping', 'Running several processes at literally the same moment on different processors.'],
    ['Atomic operation', 'One or more steps carried out as a single indivisible unit: no other process can see a halfway state or cut in partway through.'],
    ['Critical section', 'A piece of code that uses a shared resource and must not run while another process is running its own code for that same resource.'],
    ['Deadlock', 'Two or more processes are each waiting for something that only another member of the group can provide, so none of them can ever proceed.'],
    ['Livelock', 'Two or more processes keep changing state in reaction to each other, staying busy but never getting any useful work done.'],
    ['Mutual exclusion', 'The rule that while one process is inside a critical section for a shared resource, no other process may be inside one for the same resource.'],
    ['Race condition', 'Several processes or threads read and write shared data, and the final result depends on the exact timing of their steps.'],
    ['Starvation', 'A process that is able to run is passed over again and again, indefinitely, even though the system as a whole keeps making progress.'],
  ],
  css: `
    .sec-ch5 .ch5-vis { display: grid; place-items: center; padding: 8px 10px; flex: 1; min-height: 0; }
    .sec-ch5 .ch5-cap { min-height: 70px; }
    .sec-ch5 .ch5-slide { gap: 14px; }
    .sec-ch5 .ch5-slide .ui-slider { flex: 0 0 330px; }
    .sec-ch5 .ch5-slide output { display: none; }
    .sec-ch5 .ch5-now { flex: 1; min-height: 42px; line-height: 1.4; }
    @media (max-width: 760px) {
      .sec-ch5 .ch5-slide { flex-wrap: wrap; }
      .sec-ch5 .ch5-slide .ui-slider { flex: 1 1 100%; }
      .sec-ch5 .ch5-terms { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    .sec-ch5 .ch5-ctx { display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 9px 12px; border: 1px solid var(--line); border-left: 4px solid var(--line-2); border-radius: 10px; background: var(--panel-2); cursor: pointer; color: var(--ink); font-size: 15.5px; line-height: 1.35; }
    .sec-ch5 .ch5-ctx:hover { border-color: var(--chc); }
    .sec-ch5 .ch5-ctx.on { border-color: var(--chc); border-left-color: var(--chc); background: color-mix(in srgb, var(--chc) 9%, var(--panel)); }
    .sec-ch5 .ch5-n { flex: none; display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--panel-3); font-weight: 800; font-size: 13px; }
    .sec-ch5 .ch5-ctx.on .ch5-n { background: var(--chc); color: var(--panel); }
    .sec-ch5 .ch5-d { display: block; margin-top: 4px; font-weight: 400; }
    .sec-ch5 .ch5-sc { min-height: 150px; border-left: 5px solid var(--chc); }
    .sec-ch5 .ch5-text { font-size: 18px; line-height: 1.5; margin-top: 6px !important; }
    .sec-ch5 .ch5-terms { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .sec-ch5 .ch5-term { white-space: normal; height: auto; min-height: 40px; padding: 4px 10px; line-height: 1.2; }
    .sec-ch5 .ch5-term.ok { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
    .sec-ch5 .ch5-term.bad { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
    .sec-ch5 .ch5-fb { min-height: 96px; }
    .sec-ch5 .ch5-list { display: flex; flex-direction: column; gap: 6px; }
    .sec-ch5 .ch5-row { display: flex; align-items: center; gap: 10px; text-align: left; padding: 7px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); cursor: pointer; color: var(--ink); font-size: 14.5px; font-weight: 600; }
    .sec-ch5 .ch5-row:hover { border-color: var(--chc); }
    .sec-ch5 .ch5-row.on { border-color: var(--chc); box-shadow: 0 0 0 1px var(--chc); background: color-mix(in srgb, var(--chc) 8%, var(--panel)); }
  `,
  steps: [
    {
      title: 'Where concurrency comes from',
      kind: 'story',
      render(el, ctx) {
        const { h } = ctx;
        const MODES = {
          mp: { label: 'Multiprogramming', cap: '<span class="t">Multiprogramming</span>: <b>one processor, many processes.</b> Their instructions <b>interleave</b>: only one runs at any instant, but all of them are in progress, and the OS decides who goes next.' },
          mproc: { label: 'Multiprocessing', cap: '<span class="t">Multiprocessing</span>: <b>several processors sharing one memory.</b> Instructions can now <b>overlap</b>: two processes really do run at the same instant, and both can touch the same memory.' },
          dist: { label: 'Distributed processing', cap: '<span class="t">Distributed processing</span>: <b>separate computers joined by a network</b>, each with its own memory. Processes on different machines run at the same time and cooperate by sending messages.' },
        };
        const CTX = [
          ['Multiple applications', 'Multiprogramming lets many separate applications share the processor. They were written independently, yet they compete for the same processor, memory, files and devices.', 'A browser, a music player and a download all running on your laptop.'],
          ['Structured applications', 'Good design often splits one application into cooperating parts. Once a program is written as a set of concurrent processes or threads, those parts must coordinate.', 'A web server that handles each visitor with its own thread.'],
          ['Operating system structure', 'Operating systems are themselves built as sets of processes and threads, so the OS faces exactly the same problems as the programs it runs.', 'Kernel threads that write data to disk and handle the network in the background.'],
        ];
        let mode = 'mp', pickCtx = 0, at = 205;
        const nowTxt = h('div', { class: 'small ch5-now' });
        const vis = h('div', { class: 'card white ch5-vis' });
        const cap = h('div', { class: 'player-cap ch5-cap' });
        // segments: [lane, start, length, process]
        const SEGS = {
          mp: [[0, 0, 60, 'A'], [0, 60, 50, 'B'], [0, 110, 70, 'C'], [0, 180, 50, 'A'], [0, 230, 60, 'B'], [0, 290, 40, 'C'], [0, 330, 60, 'A'], [0, 390, 50, 'B']],
          mproc: [[0, 0, 150, 'A'], [0, 150, 120, 'C'], [0, 270, 170, 'A'], [1, 0, 110, 'B'], [1, 110, 170, 'D'], [1, 280, 160, 'E'], [2, 0, 150, 'E'], [2, 150, 130, 'B'], [2, 280, 160, 'C']],
          dist: [[0, 0, 200, 'A'], [0, 200, 240, 'B'], [1, 0, 260, 'C'], [1, 260, 180, 'D'], [2, 0, 140, 'E'], [2, 140, 300, 'F']],
        };
        function drawVis() {
          const lanes = mode === 'mp' ? ['Processor'] : mode === 'mproc' ? ['Processor 1', 'Processor 2', 'Processor 3'] : ['Computer 1', 'Computer 2', 'Computer 3'];
          const y0 = mode === 'mp' ? 70 : 48, gap = 76, X = 150;
          let svg = '';
          if (mode === 'mp') svg += `<rect x="${X}" y="178" width="440" height="72" rx="12" class="s-mem" stroke-width="1.5"/><text x="${X + 14}" y="200" font-size="13" font-weight="800">Main memory: every process is loaded and in progress</text>${['A', 'B', 'C'].map((p, i) => `<rect x="${X + 14 + i * 142}" y="210" width="130" height="30" rx="7" class="s-proc" stroke-width="1.5"/><text x="${X + 79 + i * 142}" y="230" text-anchor="middle" font-size="13" font-weight="800">process ${p}</text>`).join('')}`;
          if (mode === 'mproc') svg += `<rect x="600" y="30" width="30" height="${gap * 2 + 60}" rx="8" class="s-mem" stroke-width="1.5"/><text x="615" y="${30 + gap + 34}" text-anchor="middle" font-size="13" font-weight="800" transform="rotate(-90 615 ${30 + gap + 30})">shared memory</text>`;
          lanes.forEach((ln, i) => {
            const y = y0 + i * gap;
            if (mode === 'dist') svg += `<rect x="4" y="${y - 8}" width="${X + 452}" height="58" rx="10" class="s-panel" stroke-dasharray="5 4"/><text x="12" y="${y + 44}" font-size="13" class="s-sub">own memory</text>`;
            svg += `<text x="12" y="${y + 27}" font-size="14" font-weight="800">${ln}</text>`;
            if (mode === 'mproc') svg += `<line x1="${X + 440}" y1="${y + 21}" x2="598" y2="${y + 21}" class="s-muted" stroke-dasharray="3 3"/>`;
          });
          const running = [];
          SEGS[mode].forEach(([ln, st, len, p]) => {
            const y = y0 + ln * gap;
            const on = at >= st && at < st + len;
            if (on) running.push(p);
            svg += `<rect x="${X + st + 1}" y="${y + 4}" width="${len - 2}" height="34" rx="7" class="s-proc" stroke-width="${on ? 3 : 1.5}" style="fill-opacity:${on ? 1 : 0.35}"/><text x="${X + st + len / 2}" y="${y + 26}" text-anchor="middle" font-size="14" font-weight="800">${p}</text>`;
          });
          svg += `<line x1="${X + at}" y1="${y0 - 14}" x2="${X + at}" y2="${y0 + (lanes.length - 1) * gap + 50}" style="stroke:var(--chc)" stroke-width="2.5" stroke-dasharray="5 3"/><text x="${X + at}" y="${y0 - 20}" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--chc)">this instant</text>`;
          const all = [...new Set(SEGS[mode].map((g) => g[3]))].sort();
          const waiting = all.filter((p) => !running.includes(p));
          running.sort();
          nowTxt.innerHTML = `At this instant: <b>${running.join(', ')}</b> ${running.length > 1 ? 'run at the same time' : 'runs'}${waiting.length ? `; ${waiting.join(', ')} ${mode === 'mp' ? 'are in progress but waiting' : (waiting.length > 1 ? 'are' : 'is') + ' not running at this instant'}` : ''}.`;
          if (mode === 'dist') svg += `<path d="M${X + 200} ${y0 + 42} L${X + 260} ${y0 + gap + 2}" class="s-line" style="stroke:var(--io)" stroke-dasharray="5 4" marker-end="url(#arr-io)"/><path d="M${X + 140} ${y0 + 2 * gap} L${X + 90} ${y0 + gap + 40}" class="s-line" style="stroke:var(--io)" stroke-dasharray="5 4" marker-end="url(#arr-io)"/><text x="${X + 300}" y="${y0 + gap - 14}" font-size="13" font-weight="800" style="fill:var(--io)">messages over the network</text>`;
          const yb = y0 + lanes.length * gap - 10;
          svg += `<line x1="${X}" y1="${yb}" x2="${X + 440}" y2="${yb}" class="s-line" marker-end="url(#arr)"/><text x="${X + 440}" y="${yb + 20}" text-anchor="end" font-size="13" class="s-sub">time →</text>`;
          vis.innerHTML = `<svg viewBox="0 0 640 300" width="100%" role="img" aria-label="${MODES[mode].label} timeline">${svg}</svg>`;
          cap.innerHTML = MODES[mode].cap;
        }
        const seg = ctx.ui.seg(Object.entries(MODES).map(([value, m]) => ({ value, label: m.label })), mode, (v) => { mode = v; drawVis(); ctx.refit(); });
        const ctxBox = h('div', { class: 'stack', style: { gap: '8px' } });
        function paintCtx() {
          ctxBox.innerHTML = '';
          CTX.forEach(([name, d, ex], i) => {
            const on = i === pickCtx;
            ctxBox.append(h('button', { class: 'ch5-ctx' + (on ? ' on' : ''), type: 'button', onclick: () => { pickCtx = i; paintCtx(); ctx.refit(); } },
              h('span', { class: 'ch5-n' }, String(i + 1)),
              h('span', {}, h('b', {}, name), ...(on ? [h('span', { class: 'small ch5-d' }, d, ' ', h('i', { class: 'muted' }, 'Example: ' + ex))] : []))));
          });
        }
        el.append(h('div', { class: 'split r fill' },
          h('div', { class: 'stack' }, h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Three ways to run many processes:'), seg), vis,
            h('div', { class: 'row nw ch5-slide' }, ctx.ui.slider({ label: 'Move the instant', min: 0, max: 439, value: at, format: () => '', onInput: (v) => { at = v; drawVis(); } }), nowTxt), cap),
          h('div', { class: 'stack' },
            h('h4', { class: 'm0', html: 'Three places <span class="t">concurrency</span> comes from' }),
            ctxBox,
            h('div', { class: 'callout warn m0 small', 'data-label': 'The key point', html: 'Interleaved on one processor or overlapping on several, the relative speed of processes cannot be predicted. Every problem in this chapter grows from that one fact.' }),
            h('div', { class: 'card tight small' }, h('h4', {}, 'Two words to keep'), h('div', { html: '<b>Interleaving:</b> processes take turns on one processor. <b>Overlapping:</b> processes run at literally the same moment on different processors. Both cause the same problems.' })))));
        drawVis(); paintCtx();
      },
    },
    {
      title: 'Name that problem: seven words for this chapter',
      kind: 'explore',
      render(el, ctx) {
        const { h } = ctx;
        const TERMS = {
          'Atomic operation': 'One or more steps carried out as a single indivisible unit: no other process can see a halfway state or cut in partway through.',
          'Critical section': 'A piece of code that uses a shared resource and must not run while another process is running its own code for that same resource.',
          'Deadlock': 'Two or more processes are each waiting for something that only another member of the group can provide, so none of them can ever proceed.',
          'Livelock': 'Two or more processes keep changing state in reaction to each other, staying busy but never getting any useful work done.',
          'Mutual exclusion': 'The rule that while one process is inside a critical section for a shared resource, no other process may be inside one for the same resource.',
          'Race condition': 'Several processes or threads read and write shared data, and the final result depends on the exact timing of their steps.',
          'Starvation': 'A process that is able to run is passed over again and again, indefinitely, even though the system as a whole keeps making progress.',
        };
        const SC = [
          { short: 'The shared counter', term: 'Race condition', text: 'Two threads each add 1 to a shared counter that holds 5. Both read 5, both compute 6, both write 6. One addition has vanished, and on another run, with different timing, the answer comes out right.' },
          { short: 'Printer and scanner', term: 'Deadlock', text: 'Thread 1 has locked the printer and is waiting for the scanner. Thread 2 has locked the scanner and is waiting for the printer. Neither will give up what it holds, so neither will ever move again.' },
          { short: 'Check and change in one step', term: 'Atomic operation', text: 'A special processor instruction reads a memory word, checks it and writes a new value in one indivisible step. No other processor can ever catch the word after the check but before the write.' },
          { short: 'The long job', term: 'Starvation', text: 'A scheduler always runs the shortest waiting job next. A long report keeps getting overtaken by a steady stream of short jobs. The system is busy and nothing is stuck, yet the report never runs.' },
          { short: 'Three lines of banking code', term: 'Critical section', text: 'Three lines in a banking program read an account balance, subtract a withdrawal and write the new balance back. These particular lines must never run for the same account in two threads at once.' },
          { short: 'The narrow corridor', term: 'Livelock', text: 'Two polite people meet in a narrow corridor. Both step left, then both step right, then both step left again. They never stop moving, yet neither ever gets past the other.' },
          { short: 'The changing-room key', term: 'Mutual exclusion', text: 'A shop\'s only changing room has one key on a hook. Whoever holds the key is inside; everyone else waits until it is back on the hook. There is never more than one person inside.' },
        ];
        const names = Object.keys(TERMS);
        const ans = SC.map(() => null);
        let cur = 0;
        const scCard = h('div', { class: 'card white ch5-sc', 'aria-live': 'polite' });
        const fb = h('div', { class: 'ch5-fb' });
        const termBtns = names.map((n) => h('button', { class: 'btn ch5-term', type: 'button', onclick: () => choose(n) }, n));
        const list = h('div', { class: 'ch5-list' });
        const score = h('span', { class: 'big' });
        const nextBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => go(nextOpen()) }, 'Next scenario ▶');
        const nextOpen = () => { for (let k = 1; k <= SC.length; k++) { const j = (cur + k) % SC.length; if (ans[j] !== SC[j].term) return j; } return (cur + 1) % SC.length; };
        function choose(n) { ans[cur] = n; paint(); }
        function go(i) { cur = i; paint(); }
        function paint() {
          const sc = SC[cur], a = ans[cur], ok = a === sc.term;
          scCard.innerHTML = `<div class="xs muted b">SCENARIO ${cur + 1} OF ${SC.length}: ${sc.short.toUpperCase()}</div><p class="ch5-text m0">${sc.text}</p>`;
          termBtns.forEach((b) => { b.classList.toggle('ok', a === b.textContent && ok); b.classList.toggle('bad', a === b.textContent && !ok); });
          fb.className = 'ch5-fb callout m0 small ' + (a === null ? '' : ok ? 'tip' : 'bad');
          fb.setAttribute('data-label', a === null ? 'Your move' : ok ? 'Correct: ' + sc.term : 'Not quite');
          fb.innerHTML = a === null ? 'Which word names what is happening in this scenario? Pick one of the seven.'
            : ok ? TERMS[sc.term]
            : `<b>${a}</b> means: ${TERMS[a]} Does that match the story? Try another word.`;
          list.innerHTML = '';
          SC.forEach((x, i) => {
            const st = ans[i] === null ? '' : ans[i] === x.term ? 'ok' : 'bad';
            list.append(h('button', { class: 'ch5-row' + (i === cur ? ' on' : ''), type: 'button', onclick: () => go(i) },
              h('span', { class: 'ch5-n' }, String(i + 1)), h('span', { class: 'grow' }, x.short),
              st ? h('span', { class: 'chip ' + st }, st === 'ok' ? '✓ ' + x.term : '✗ ' + ans[i]) : h('span', { class: 'xs muted' }, 'not answered')));
          });
          const right = SC.filter((x, i) => ans[i] === x.term).length;
          score.textContent = `${right} / ${SC.length}`;
          ctx.refit();
        }
        el.append(h('div', { class: 'split r fill' },
          h('div', { class: 'stack' }, scCard, h('div', { class: 'ch5-terms' }, ...termBtns), fb, h('div', { class: 'row' }, nextBtn),
            h('div', { class: 'card tight small ch5-groups' }, h('h4', {}, 'How the seven fit together'),
              h('div', { html: '<b style="color:var(--bad)">Things that go wrong:</b> race condition, deadlock, livelock, starvation.<br><b style="color:var(--ok)">Ideas that prevent them:</b> find the critical sections, enforce mutual exclusion on them, and build that guarantee from atomic operations.' }))),
          h('div', { class: 'stack' },
            h('div', { class: 'row', style: { alignItems: 'baseline' } }, score, h('span', { class: 'small b' }, 'matched'), h('span', { class: 'xs muted' }, 'click a row to revisit it'),
              h('button', { class: 'btn sm', type: 'button', style: { marginLeft: 'auto', alignSelf: 'center' }, onclick: () => { ans.fill(null); go(0); } }, 'Start over')),
            list,
            h('div', { class: 'callout why m0 small', 'data-label': 'Where you will use them', html: 'Section 5.1 enforces mutual exclusion in software alone; 5.2 explains races and the rules any solution must meet. Sections 5.3 to 5.7 build stronger tools that avoid deadlock and starvation.' }))));
        paint();
      },
    },
  ],
  notes: `
    <h3>How Chapter 5 fits together</h3>
    <p>Chapters 3 and 4 gave us many processes and threads in progress at once. This chapter deals with the price: when they share data, the result can depend on timing. Concurrency arises in three contexts: <b>multiple applications</b> sharing a machine, <b>structured applications</b> built as cooperating parts, and the <b>operating system's own structure</b>. It appears whether processes are interleaved on one processor (<b>multiprogramming</b>), overlapped on several (<b>multiprocessing</b>) or spread across machines (<b>distributed processing</b>).</p>
    <h4>The vocabulary</h4>
    <p>A <b>race condition</b> happens when the outcome depends on who gets to shared data first. The code that touches shared data is a <b>critical section</b>, and <b>mutual exclusion</b> means at most one process is inside it at a time. <b>Atomic operations</b> are the indivisible building blocks used to enforce it. A careless solution can cause <b>deadlock</b> (everyone waits for everyone), <b>livelock</b> (everyone stays busy but nobody progresses) or <b>starvation</b> (one process is passed over forever).</p>
    <h4>Getting it right in software (5.1) and why it is hard (5.2)</h4>
    <p>Section 5.1 builds mutual exclusion from ordinary instructions through a series of flawed attempts, ending with <b>Dekker's</b> and <b>Peterson's</b> algorithms. Section 5.2 steps back to the principles: a simple example of a race, the OS concerns, the three ways processes interact (competition, cooperation by sharing, cooperation by communication) and the six requirements any mutual exclusion solution must meet.</p>
    <h4>Help from the hardware (5.3)</h4>
    <p>On one processor, disabling interrupts protects a critical section. On multiprocessors, special atomic instructions such as <b>compare_and_swap</b> and <b>exchange</b> do the job, at the cost of busy waiting and a risk of starvation.</p>
    <h4>Higher-level tools (5.4 to 5.6)</h4>
    <p><b>Semaphores</b> (5.4) are counters with atomic semWait and semSignal operations that block instead of spinning; they solve mutual exclusion and the <b>producer/consumer</b> problem. <b>Monitors</b> (5.5) package shared data with its procedures and condition variables so mutual exclusion is automatic. <b>Message passing</b> (5.6) replaces shared data with send and receive, and works across machines.</p>
    <h4>A classic test (5.7)</h4>
    <p>The <b>readers/writers</b> problem lets many readers share data at once but gives writers exclusive access, and shows how the choice of priority can starve one side.</p>`,
});
