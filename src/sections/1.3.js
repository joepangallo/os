/* =====================================================================
   Section 1.3 — Instruction Execution
   The fetch / execute loop, the PC and IR, the four kinds of instruction,
   and a complete register-level trace of a tiny 16-bit accumulator machine.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- shared helpers for the tiny 16-bit accumulator machine ---------- */
  const hex = (n, d = 4) => (n >>> 0).toString(16).toUpperCase().padStart(d, '0').slice(-d);
  const bin = (n, bits = 16) => (n >>> 0).toString(2).padStart(bits, '0').slice(-bits).replace(/(.{4})(?=.)/g, '$1 ');
  // the three opcodes the classic example uses (the real machine has room for 16)
  const OPS = {
    1: { mn: 'LOAD', verb: 'Load AC from memory', short: (a) => 'AC ← [' + hex(a, 3) + ']' },
    2: { mn: 'STORE', verb: 'Store AC to memory', short: (a) => '[' + hex(a, 3) + '] ← AC' },
    5: { mn: 'ADD', verb: 'Add to AC from memory', short: (a) => 'AC ← AC + [' + hex(a, 3) + ']' },
  };
  const opOf = (w) => (w >>> 12) & 0xF;
  const addrOf = (w) => w & 0xFFF;
  // sign-magnitude data words: bit 15 = sign, bits 0-14 = magnitude
  const toInt = (w) => ((w & 0x8000) ? -(w & 0x7FFF) : (w & 0x7FFF));
  const fromInt = (v) => (v < 0 ? 0x8000 | (Math.min(-v, 0x7FFF)) : Math.min(v, 0x7FFF));
  const signed = (w) => { const v = toInt(w); return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v); };
  const parseHex = (s) => { const t = String(s || '').trim().replace(/^0x/i, ''); return /^[0-9a-fA-F]{1,4}$/.test(t) ? parseInt(t, 16) : null; };

  /* ---------- the classic 3-instruction program, as register-level frames ----------
     Program: 300: 1940 (load AC from 940), 301: 5941 (add [941] to AC), 302: 2941 (store AC to 941).
     Data:    940: 0003, 941: 0002.  Result: 941 = 0005, PC = 303.
     Each micro frame is the machine state AFTER that micro-step.
     stage: -1 = not started, 0..5 = F1 E1 F2 E2 F3 E3, 6 = finished.
     ch = what changed (highlighted), bus = active bus traffic, cell = memory cell being accessed. */
  const f = (pc, ir, ac, mar, mbr, m941, stage, ch, bus, cell, cap) => ({ pc, ir, ac, mar, mbr, m941, stage, ch: ch ? ch.split(' ') : [], bus: bus ? bus.split(' ') : [], cell, cap });
  const N = null;
  const MICRO = [
    f(0x300, N, N, N, N, 0x0002, -1, '', '', N, '<b>Start.</b> The program sits at 300–302 and its two numbers at 940 and 941 (all values are hex). In an instruction word the first hex digit is the opcode (1 = load AC, 5 = add to AC, 2 = store AC) and the other three are an address. The PC holds 300, so the first fetch comes from there.'),
    f(0x300, N, N, 0x300, N, 0x0002, 0, 'mar', 'addr', 0x300, '<b>Fetch 1 · address out.</b> The PC’s value, 300, is copied into the MAR, which puts it on the address lines: “send me the word at 300.”'),
    f(0x300, N, N, 0x300, 0x1940, 0x0002, 0, 'mbr', 'addr read', 0x300, '<b>Fetch 1 · word comes back.</b> Memory reads cell 300 and sends its contents, 1940, over the data lines into the MBR.'),
    f(0x301, 0x1940, N, 0x300, 0x1940, 0x0002, 0, 'ir pc', '', N, '<b>Fetch 1 · into the IR.</b> The word moves from the MBR into the IR, and the PC is incremented to 301 so it points at the next instruction.'),
    f(0x301, 0x1940, N, 0x940, 0x1940, 0x0002, 1, 'mar', 'addr', 0x940, '<b>Execute 1 · decode.</b> The processor decodes the IR, splitting 1940 into its opcode (1 = “load AC from memory”) and its address field (940). To fetch that operand, 940 goes into the MAR.'),
    f(0x301, 0x1940, N, 0x940, 0x0003, 0x0002, 1, 'mbr', 'addr read', 0x940, '<b>Execute 1 · operand arrives.</b> Memory returns the word stored at 940, which is 0003, into the MBR.'),
    f(0x301, 0x1940, 0x0003, 0x940, 0x0003, 0x0002, 1, 'ac', '', N, '<b>Execute 1 · done.</b> The MBR is copied into the AC, so AC = 0003. One complete instruction cycle (fetch + execute) is finished. Notice the PC already says 301.'),
    f(0x301, 0x1940, 0x0003, 0x301, 0x0003, 0x0002, 2, 'mar', 'addr', 0x301, '<b>Fetch 2 · address out.</b> The next cycle starts exactly like the first: PC (301) → MAR → address lines.'),
    f(0x301, 0x1940, 0x0003, 0x301, 0x5941, 0x0002, 2, 'mbr', 'addr read', 0x301, '<b>Fetch 2 · word comes back.</b> Memory sends back 5941, the word stored at 301.'),
    f(0x302, 0x5941, 0x0003, 0x301, 0x5941, 0x0002, 2, 'ir pc', '', N, '<b>Fetch 2 · into the IR.</b> 5941 replaces the old instruction in the IR, and the PC steps on to 302.'),
    f(0x302, 0x5941, 0x0003, 0x941, 0x5941, 0x0002, 3, 'mar', 'addr', 0x941, '<b>Execute 2 · decode.</b> Opcode 5 means “add to AC from memory”, address 941. The processor sends 941 out through the MAR.'),
    f(0x302, 0x5941, 0x0003, 0x941, 0x0002, 0x0002, 3, 'mbr', 'addr read', 0x941, '<b>Execute 2 · operand arrives.</b> The word at 941, 0002, lands in the MBR.'),
    f(0x302, 0x5941, 0x0005, 0x941, 0x0002, 0x0002, 3, 'ac alu', '', N, '<b>Execute 2 · add.</b> The ALU adds the MBR to the AC: 3 + 2 = 5, and the sum replaces the AC’s old value. AC = 0005.'),
    f(0x302, 0x5941, 0x0005, 0x302, 0x0002, 0x0002, 4, 'mar', 'addr', 0x302, '<b>Fetch 3 · address out.</b> PC (302) → MAR → address lines.'),
    f(0x302, 0x5941, 0x0005, 0x302, 0x2941, 0x0002, 4, 'mbr', 'addr read', 0x302, '<b>Fetch 3 · word comes back.</b> Memory returns 2941, the word stored at 302.'),
    f(0x303, 0x2941, 0x0005, 0x302, 0x2941, 0x0002, 4, 'ir pc', '', N, '<b>Fetch 3 · into the IR.</b> 2941 goes into the IR and the PC moves on to 303.'),
    f(0x303, 0x2941, 0x0005, 0x941, 0x0005, 0x0002, 5, 'mar mbr', 'addr', 0x941, '<b>Execute 3 · decode.</b> Opcode 2 means “store AC to memory”, address 941. This time the processor fills <i>both</i> helpers: MAR ← 941 and MBR ← AC (0005).'),
    f(0x303, 0x2941, 0x0005, 0x941, 0x0005, 0x0005, 5, 'm941', 'addr write', 0x941, '<b>Execute 3 · write.</b> The MBR’s word travels out over the data lines and memory stores it at 941. The old 0002 is overwritten.'),
    f(0x303, 0x2941, 0x0005, 0x941, 0x0005, 0x0005, 6, '', '', N, '<b>Finished.</b> Three instruction cycles, six stages: cell 941 now holds 0005 (3 + 2) and the PC holds 303, ready to fetch whatever comes next.'),
  ];
  // the "6 big steps" view: the state after each whole stage, with everything that changed during it
  const BIG = [
    [0, '', '', N, MICRO[0].cap],
    [3, 'mar mbr ir pc', 'addr read', 0x300, '<b>Step 1 · Fetch.</b> The PC holds 300, so the word at 300 (1940) is loaded into the IR, and the PC goes up to 301.'],
    [6, 'mar mbr ac', 'addr read', 0x940, '<b>Step 2 · Execute.</b> The first hex digit of 1940 (opcode 1) says “load AC”; the other three (940) say from where. AC ← 0003.'],
    [9, 'mar mbr ir pc', 'addr read', 0x301, '<b>Step 3 · Fetch.</b> The word at 301 (5941) is loaded into the IR; the PC goes up to 302.'],
    [12, 'mar mbr ac alu', 'addr read', 0x941, '<b>Step 4 · Execute.</b> Opcode 5 = add to AC from memory. The old AC (3) plus the word at 941 (2) gives 5. AC ← 0005.'],
    [15, 'mar mbr ir pc', 'addr read', 0x302, '<b>Step 5 · Fetch.</b> The word at 302 (2941) is loaded into the IR; the PC goes up to 303.'],
    [17, 'mar mbr m941', 'addr write', 0x941, '<b>Step 6 · Execute.</b> Opcode 2 = store AC to memory. The AC (0005) is written into 941. Done: 941 holds 0005 and the PC holds 303.'],
  ].map(([k, ch, bus, cell, cap]) => Object.assign({}, MICRO[k], { ch: ch ? ch.split(' ') : [], bus: bus ? bus.split(' ') : [], cell, cap, stage: k === 0 ? -1 : MICRO[k].stage }));

  Guide.section({
    id: '1.3',
    title: 'Instruction Execution',
    short: 'Instruction execution',
    summary: 'How a processor runs a program: fetch, execute, repeat, traced on a tiny 16-bit accumulator machine.',
    objectives: [
      'Describe the instruction cycle as a fetch stage followed by an execute stage, repeated until the processor halts.',
      'Explain how the program counter and instruction register work together during a fetch, and how a jump changes the flow.',
      'Sort instructions into the four categories: processor-memory, processor-I/O, data processing and control.',
      'Decode a 16-bit instruction word of a simple accumulator machine and trace a short program register by register, including the MAR and MBR.',
      'Explain why direct memory access (DMA) frees the processor from moving I/O data word by word.',
    ],
    terms: [
      ['Program', 'An ordered list of instructions stored in memory. The processor carries them out one after another.'],
      ['Instruction', 'A single, very small command the processor knows how to perform, stored in memory as a pattern of bits (for example, “add the number at address 941 to the accumulator”).'],
      ['Instruction cycle', 'Everything the processor does for one instruction: fetch it from memory, then execute it. The cycle repeats until the processor halts.'],
      ['Fetch stage', 'The first half of every instruction cycle: the processor reads the instruction whose address is in the program counter into the instruction register, then increments the program counter.'],
      ['Execute stage', 'The second half of every instruction cycle: the processor decodes the instruction in the instruction register and carries out the action it specifies.'],
      ['Halt', 'The end of the instruction-cycle loop. It happens when the machine is switched off, when an error it cannot recover from occurs, or when the program runs an instruction that tells the processor to stop.'],
      ['Register', 'A tiny, extremely fast storage slot inside the processor. Each one holds a single value, such as an address or a number being worked on.'],
      ['Program counter (PC)', 'The register that holds the address of the next instruction to fetch. It is incremented after every fetch unless an instruction changes it.'],
      ['Instruction register (IR)', 'The register that holds the instruction just fetched, so the processor can decode it and carry it out.'],
      ['Accumulator (AC)', 'The main working register of a simple processor. Numbers loaded from memory and the results of arithmetic are kept here temporarily.'],
      ['Opcode', 'Short for operation code: the group of bits in an instruction that says which operation to perform, such as load, store or add.'],
      ['Address field', 'The bits of an instruction that name the memory location the instruction works with.'],
      ['Word', 'The fixed-size group of bits that the processor and memory store and move as one unit; each numbered memory cell holds one word. In the machine in this section a word is 16 bits.'],
      ['Hexadecimal (hex)', 'Base-16 notation using the digits 0–9 and A–F. Each hex digit stands for exactly four bits, so a 16-bit word is written as four hex digits.'],
      ['Sign-magnitude', 'A way of storing a signed number: the leftmost bit is the sign (0 = positive, 1 = negative) and the remaining bits hold the size of the number.'],
      ['Memory address register (MAR)', 'The register that holds the address of the memory location the processor is about to read or write.'],
      ['Memory buffer register (MBR)', 'The register that holds the word just read from memory, or the word about to be written to memory.'],
      ['Arithmetic logic unit (ALU)', 'The execution unit that does the actual arithmetic (add, subtract) and logic (AND, OR, NOT) on values held in registers. A simple processor has one; a modern core has several.'],
      ['Jump', 'A control instruction that puts a new address into the program counter, so the next fetch comes from somewhere other than the next address in order.'],
      ['Direct memory access (DMA)', 'A way of moving data in which an I/O module reads or writes main memory itself, so the processor does not have to handle every word of the transfer.'],
    ],

    css: `
      .sec-1-3 .mono { font-variant-numeric: tabular-nums; }
      .sec-1-3 svg .s-hl { fill: var(--hl); stroke: var(--warn); }
      .sec-1-3 svg .hot { cursor: pointer; }
      .sec-1-3 svg .hot:hover rect, .sec-1-3 svg .hot:hover path.shape { stroke-width: 3.5; }
      .sec-1-3 svg .dim { opacity: .35; }
      .sec-1-3 svg .on-cpu { fill: var(--cpu); }
      .sec-1-3 .reg { display: grid; grid-template-columns: 54px minmax(0, 1fr); align-items: center; gap: 8px; }
      .sec-1-3 .reg .nm { font-weight: 800; font-size: 14px; color: var(--cpu); }
      .sec-1-3 .reg .val { font-family: var(--mono); font-weight: 700; font-size: 16px; background: var(--panel); border: 2px solid var(--cpu); border-radius: 8px; padding: 3px 10px; min-height: 34px; display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; white-space: nowrap; }
      .sec-1-3 .reg .val.chg { background: var(--hl); border-color: var(--warn); }
      .sec-1-3 .bits { display: grid; grid-template-columns: repeat(16, minmax(0, 1fr)); gap: 4px; }
      .sec-1-3 .bits.lab span { font-size: 12.5px; font-weight: 800; text-align: center; border-bottom: 3px solid currentColor; padding-bottom: 1px; white-space: nowrap; overflow: hidden; }
      .sec-1-3 .bits.hx span { font-family: var(--mono); font-size: 13px; font-weight: 700; text-align: center; color: var(--muted); border-top: 2px solid var(--line-2); padding-top: 1px; }
      .sec-1-3 .bit { height: 42px; border-radius: 8px; border: 2px solid var(--line-2); background: var(--panel-2); font-family: var(--mono); font-size: 19px; font-weight: 800; cursor: pointer; padding: 0; color: var(--ink); min-width: 0; }
      .sec-1-3 .bit:hover { filter: brightness(1.06); transform: translateY(-1px); }
      .sec-1-3 .bit.nib { margin-right: 5px; }
      .sec-1-3 .bit.op { border-color: var(--accent); background: var(--accent-bg); }
      .sec-1-3 .bit.ad { border-color: var(--mem); background: var(--mem-bg); }
      .sec-1-3 .bit.sg { border-color: var(--warn); background: var(--warn-bg); }
      .sec-1-3 .bit.mg { border-color: var(--cpu); background: var(--cpu-bg); }
      .sec-1-3 .cell-in { width: 72px; height: 32px; font-family: var(--mono); font-size: 16px; font-weight: 700; text-align: center; border: 2px solid var(--line-2); border-radius: 8px; background: var(--panel); color: var(--ink); text-transform: uppercase; padding: 0 4px; }
      .sec-1-3 .cell-in:focus { border-color: var(--accent); outline: none; }
      .sec-1-3 .cell-in.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-1-3 .mrow { display: grid; grid-template-columns: 38px 76px minmax(0, 1fr); gap: 8px; align-items: center; padding: 2px 6px; border-radius: 9px; border: 2px solid transparent; }
      .sec-1-3 .mrow.pc { background: var(--cpu-bg); border-color: var(--cpu); }
      .sec-1-3 .mrow .hint { font-family: var(--mono); font-size: 13px; line-height: 1.2; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sec-1-3 .mrow .hint .was { font-family: var(--font); font-size: 12.5px; font-weight: 700; color: var(--warn); }
      .sec-1-3 .cell-in.wr { border-color: var(--warn); background: var(--hl); }
      .sec-1-3 .mrow.just .cell-in { outline: 3px solid var(--warn); outline-offset: 1px; }
      .sec-1-3 .live-key { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 2px solid var(--warn); background: var(--hl); vertical-align: -1px; margin-right: 4px; }
    `,

    steps: [
      /* ---------------- 1. Big picture: the fetch / execute loop ---------------- */
      {
        title: 'One tiny loop runs every program',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          const INFO = {
            start: ['Start', 'When the machine is switched on or reset, the <span class="t">program counter (PC)</span> is set to the address of the first instruction to run.'],
            fetch: ['Fetch stage', 'Read the instruction whose address is in the PC from memory into the <span class="t">instruction register (IR)</span>, then add 1 to the PC so it points at the next one.'],
            exec: ['Execute stage', '<b>Decode</b> the instruction sitting in the IR (work out what its bits ask for), then do it: move data, do arithmetic, talk to a device, or change the PC.'],
            loop: ['Back to fetch', 'The moment one instruction is finished, the next fetch begins automatically, from whatever address the PC now holds. One fetch plus one execute is one full instruction cycle.'],
            halt: ['Halt', 'The loop only ends when the processor is switched off, hits an error it cannot recover from, or executes an instruction that tells it to stop. Nothing else breaks the cycle.'],
          };
          const svg = s('svg', { viewBox: '0 0 540 300', width: '100%', style: { maxHeight: '300px', display: 'block' }, role: 'img', 'aria-label': 'The basic instruction cycle: start, fetch stage, execute stage, back to fetch, or halt' });
          const infoT = h('div', { class: 'b', style: { color: 'var(--chc)' } });
          const infoB = h('div', { class: 'small' });
          const info = h('div', { class: 'card tight', style: { minHeight: '92px' } }, infoT, infoB);
          const counter = h('span', { class: 'chip cpu mono' });
          let phase = 0, count = 0, timer = null, picked = null;
          const show = (k) => { picked = k; infoT.textContent = INFO[k][0]; infoB.innerHTML = INFO[k][1]; draw(); };
          function pill(key, x, y, label, act) {
            return s('g', { class: 'hot', onclick: () => show(key) },
              s('rect', { x, y, width: 116, height: 40, rx: 20, class: act ? 's-hl' : 's-panel', 'stroke-width': act ? 4 : 2 }),
              s('text', { x: x + 58, y: y + 26, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, 'letter-spacing': '.06em' }, label));
          }
          function stage(key, x, cls, title, l1, l2, act) {
            return s('g', { class: 'hot', onclick: () => show(key) },
              act ? s('rect', { x: x - 7, y: 89, width: 224, height: 124, rx: 21, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-dasharray': '7 5' }) : null,
              s('rect', { x, y: 96, width: 210, height: 110, rx: 16, class: cls, 'stroke-width': act ? 4 : 2.5 }),
              s('text', { x: x + 105, y: 134, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 18, 'letter-spacing': '.04em' }, title),
              s('text', { x: x + 105, y: 162, 'text-anchor': 'middle', 'font-size': 14.5, class: 's-sub' }, l1),
              s('text', { x: x + 105, y: 182, 'text-anchor': 'middle', 'font-size': 14.5, class: 's-sub' }, l2));
          }
          function draw() {
            svg.replaceChildren(
              pill('start', 67, 14, 'START', phase === 0 && timer),
              s('line', { x1: 125, y1: 56, x2: 125, y2: 90, class: 's-line', 'marker-end': 'url(#arr)' }),
              stage('fetch', 20, 's-mem', 'FETCH STAGE', 'Read the next instruction', 'from memory into the IR', phase === 1),
              s('line', { x1: 232, y1: 151, x2: 303, y2: 151, class: 's-line', 'marker-end': 'url(#arr)' }),
              stage('exec', 310, 's-cpu', 'EXECUTE STAGE', 'Decode the instruction', 'and carry it out', phase === 2),
              s('g', { class: 'hot', onclick: () => show('loop') },
                s('path', { d: 'M415 208 V250 H125 V214', class: 's-line', 'marker-end': 'url(#arr)', 'stroke-width': phase === 2 && timer ? 3.5 : 2 }),
                s('rect', { x: 190, y: 238, width: 160, height: 24, rx: 12, class: 's-panel', 'stroke-width': 1 }),
                s('text', { x: 270, y: 255, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'next instruction')),
              s('line', { x1: 415, y1: 94, x2: 415, y2: 60, class: 's-line', 'marker-end': 'url(#arr)' }),
              pill('halt', 357, 14, 'HALT', phase === 3),
              s('text', { x: 270, y: 290, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'one fetch + one execute = one instruction cycle'),
            );
            counter.textContent = 'Instructions completed: ' + count;
            runBtn.innerHTML = timer ? 'Pause' : (phase === 3 ? 'Start again' : 'Run the loop');
          }
          const tick = () => {
            if (phase === 3) { phase = 0; count = 0; }
            if (phase === 0 || phase === 2) { if (phase === 2) count++; phase = 1; show('fetch'); } else { phase = 2; show('exec'); }
          };
          const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
          const runBtn = h('button', { class: 'btn primary', onclick: () => { if (timer) { stop(); draw(); } else { if (phase === 3) { phase = 0; count = 0; } timer = ctx.every(900, tick); tick(); } } });
          const stepBtn = h('button', { class: 'btn', onclick: () => { stop(); tick(); } }, 'One stage');
          // Halt = the instruction being handled is a halt instruction: it is executed (and counted), then the loop ends.
          // From the fetch stage it still passes through execute first, matching the diagram (HALT leaves from EXECUTE).
          const haltBtn = h('button', { class: 'btn', onclick: () => { stop(); if (phase === 1 || phase === 2) count++; phase = 3; show('halt'); infoB.innerHTML += ` <b>Stopped after ${count} instruction${count === 1 ? '' : 's'}.</b>`; } }, 'Halt');
          show('start');
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', html: `
              <p class="lead m0">A <span class="t">program</span> is just a list of <span class="t">instructions</span> stored in memory. The processor brings it to life with one tiny loop.</p>
              <p class="m0">Each trip around the loop is one <span class="t">instruction cycle</span>, and in its basic form it has two stages: <b>fetch</b> the next instruction from memory, then <b>execute</b> it. The processor repeats this, billions of times a second, until it <span class="t">halts</span>. (Section 1.4 adds a third stage: a check for interrupts.)</p>
              <div class="callout analogy m0" data-label="Analogy">A cook with a sticky-note bookmark reads the recipe line it marks, slides the note down a line, then does what the line said. “Go back to step 3” moves the note instead.</div>
              <div class="callout why m0" data-label="Why it matters">Every program, the operating system included, runs on this loop, so everything later builds on it.</div>
              <div class="row gap-s"><span class="xs muted b">COMING UP:</span><span class="chip cpu">trace a real program</span><span class="chip mem">decode 16-bit words</span><span class="chip accent">write your own</span></div>` }),
            h('div', { class: 'card white stack', style: { justifyContent: 'center' } },
              svg, info,
              h('div', { class: 'row' }, runBtn, stepBtn, haltBtn, h('span', { class: 'grow' }), counter))));
        },
      },

      /* ---------------- 2. Fetch: PC and IR, plus a jump ---------------- */
      {
        title: 'Fetch: the program counter points the way',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const PROG = {
            100: { t: 'Load AC from address 200', k: ['mem', 'processor–memory'] },
            101: { t: 'Add 1 to AC', k: ['cpu', 'data processing'] },
            102: { t: 'Store AC to address 200', k: ['mem', 'processor–memory'] },
            103: { t: 'Send AC to the display', k: ['io', 'processor–I/O'] },
            104: { t: 'Jump to 100', k: ['os', 'control'] },
          };
          let st;
          const reset = () => { st = { pc: 100, ir: null, irAt: null, ac: 0, m200: 0, disp: '–', next: 'fetch', trail: [[100, '']], cycles: 0, chg: [] }; };
          reset();
          const narr = h('div', { class: 'small', style: { minHeight: '64px' } });
          const trail = h('div', { class: 'row gap-s', style: { minHeight: '30px' } });
          const regPC = h('div', { class: 'val' }), regIR = h('div', { class: 'val', style: { fontSize: '14.5px' } }), regAC = h('div', { class: 'val' });
          const disp = h('div', { class: 'big mono center', style: { color: 'var(--io)' } });
          const rows = {};
          const tbody = h('tbody');
          const addrs = [100, 101, 102, 103, 104, 200];
          const NW = ctx.narrow;
          addrs.forEach((a) => {
            const ptr = h('span', { class: 'chip cpu', style: { visibility: 'hidden' } }, NW ? '←PC' : '← PC');
            const cell = h('td', { class: 'mono' });
            const r = NW
              ? h('tr', {}, h('td', { class: 'mono b', style: { whiteSpace: 'nowrap' } }, String(a), ' ', ptr), cell)
              : h('tr', {}, h('td', { class: 'mono b' }, String(a)), cell,
                h('td', {}, a === 200 ? h('span', { class: 'chip' }, 'data (a counter)') : h('span', { class: 'chip ' + PROG[a].k[0] }, PROG[a].k[1])), h('td', { style: { width: '74px' } }, ptr));
            rows[a] = { r, cell, ptr };
            tbody.append(r);
          });
          function paint(msg) {
            regPC.textContent = st.pc; regIR.textContent = st.ir ? st.ir.t : '(empty)'; regAC.textContent = st.ac;
            regPC.classList.toggle('chg', st.chg.includes('pc')); regIR.classList.toggle('chg', st.chg.includes('ir')); regAC.classList.toggle('chg', st.chg.includes('ac'));
            disp.textContent = st.disp;
            addrs.forEach((a) => {
              const R = rows[a];
              R.cell.textContent = a === 200 ? String(st.m200) : PROG[a].t;
              R.r.classList.toggle('on', a === st.irAt && st.next === 'execute');
              R.ptr.style.visibility = a === st.pc ? 'visible' : 'hidden';
            });
            trail.replaceChildren(h('span', { class: 'xs muted b' }, 'PC so far:'), ...st.trail.slice(-9).map(([v, how], i, arr) => h('span', { class: 'chip mono ' + (how === 'jump' ? 'warn' : i === arr.length - 1 ? 'cpu' : '') }, (how === 'jump' ? '↩ ' : '') + v)));
            if (msg != null) narr.innerHTML = msg;
            fetchBtn.classList.toggle('primary', st.next === 'fetch'); execBtn.classList.toggle('primary', st.next === 'execute');
            cyc.textContent = 'Cycles completed: ' + st.cycles;
          }
          function fetch() {
            if (st.next !== 'fetch') { st.chg = []; paint('<b style="color:var(--warn)">Not yet.</b> The IR already holds an instruction that has not run. Fetching now would overwrite it and that instruction would be skipped. Execute first.'); return; }
            const from = st.pc;
            st.ir = PROG[from]; st.irAt = from; st.pc = from + 1; st.next = 'execute'; st.chg = ['ir', 'pc']; st.trail.push([st.pc, 'inc']);
            paint(`<b>Fetch.</b> The PC held <b>${from}</b>, so the processor read the instruction stored at ${from} into the IR, then added 1 to the PC. The PC now says <b>${st.pc}</b>: the <i>next</i> instruction, not this one.`);
          }
          function execute() {
            if (st.next !== 'execute') { st.chg = []; paint('<b style="color:var(--warn)">Nothing to execute.</b> Every cycle starts with a fetch: the IR must first be filled with the instruction the PC points at.'); return; }
            const a = st.irAt; let msg;
            if (a === 100) { st.ac = st.m200; st.chg = ['ac']; msg = `Copied the number at address 200 (${st.m200}) into the AC. Data moved <b>memory → processor</b>.`; }
            if (a === 101) { st.ac += 1; st.chg = ['ac']; msg = `The processor added 1 to the AC, which now holds ${st.ac}. Pure arithmetic: <b>data processing</b>.`; }
            if (a === 102) { st.m200 = st.ac; st.chg = []; msg = `Copied the AC (${st.ac}) back into memory at address 200. Data moved <b>processor → memory</b>.`; }
            if (a === 103) { st.disp = String(st.ac); st.chg = []; msg = `Sent the AC (${st.ac}) out to the display, an I/O device. That is <b>processor–I/O</b> traffic.`; }
            if (a === 104) { st.pc = 100; st.chg = ['pc']; st.trail.push([100, 'jump']); msg = 'A <span class="t">jump</span> is a <b>control</b> instruction: it overwrote the PC with 100 instead of letting it count on to 105. The next fetch returns to the top, so the program loops forever.'; }
            st.next = 'fetch'; st.cycles++;
            paint(`<b>Execute.</b> ${msg}`);
          }
          const fetchBtn = h('button', { class: 'btn', onclick: fetch }, 'Fetch');
          const execBtn = h('button', { class: 'btn', onclick: execute }, 'Execute');
          const cyc = h('span', { class: 'chip mono' });
          const reg = (nm, v, tip) => h('div', { class: 'reg', title: tip }, h('span', { class: 'nm' }, nm), v);
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'lead m0', html: 'Two <span class="t">registers</span> (the processor’s tiny storage slots, met in 1.1) drive the fetch; a third holds data.' }),
              h('ul', { class: 'm0 small', style: { paddingLeft: '20px' }, html: '<li>The <span class="t" data-t="Program counter (PC)">PC</span> holds the <i>address</i> of the next instruction.</li><li>The <span class="t" data-t="Instruction register (IR)">IR</span> holds the instruction just fetched, while it is decoded and carried out.</li><li>The <span class="t" data-t="Accumulator (AC)">AC</span> holds the number being worked on.</li>' }),
              h('p', { class: 'm0 small', html: 'Each fetch copies the word at the PC’s address into the IR, then adds 1 to the PC (1, because here each instruction fills exactly one memory word). So, unless an instruction says otherwise, a program runs in address order: 100, 101, 102…' }),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Try this' }, 'Alternate Fetch and Execute for a full lap. Which instruction breaks the PC’s count-up-by-one habit, and how?'),
              h('div', { class: 'card tight', style: { borderLeft: '4px solid var(--chc)' } }, h('h4', {}, 'What just happened'), narr),
              trail),
            h('div', { class: 'card white stack', style: { gap: '12px', justifyContent: 'center' } },
              h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,3fr) minmax(0,2fr)', gap: '12px' } },
                h('div', { class: 'card cpu tight stack', style: { gap: '6px' } }, h('h4', { class: 'm0', style: { color: 'var(--cpu)' } }, 'Processor'),
                  reg('PC', regPC, 'Program counter'), reg('IR', regIR, 'Instruction register'), reg('AC', regAC, 'Accumulator')),
                h('div', { class: 'card io tight stack', style: { gap: '4px', justifyContent: 'center' } }, h('h4', { class: 'm0', style: { color: 'var(--io)' } }, 'Display (I/O)'), disp)),
              h('div', { class: 'card mem tight', style: { padding: '8px' } },
                h('table', { class: 'tbl' + (NW ? ' compact' : '') }, h('thead', {}, h('tr', {}, h('th', {}, 'Address'), h('th', {}, 'Memory contents'), NW ? null : h('th', {}, 'Kind'), NW ? null : h('th', {}, ''))), tbody)),
              h('div', { class: 'row' }, fetchBtn, execBtn, h('button', { class: 'btn ghost', onclick: () => { reset(); paint('Reset. The PC holds 100, the address of the first instruction.'); } }, 'Reset'), h('span', { class: 'grow' }), cyc))));
          paint('The PC holds <b>100</b>. Press <b>Fetch</b>, then <b>Execute</b>, and keep alternating. Watch the PC and the trail below. What happens when the instruction at 104 runs?');
        },
      },

      /* ---------------- 3. The four categories of instruction ---------------- */
      {
        title: 'What can one instruction do? Four kinds',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const CATS = [
            ['mem', 'Processor–memory', 'Copy a word between the processor and main memory, in either direction.', 'load AC from 940 · store AC to 941'],
            ['io', 'Processor–I/O', 'Copy data between the processor and an I/O module (keyboard, disk, network card…).', 'read a key code · send a byte to a printer'],
            ['cpu', 'Data processing', 'Do arithmetic or logic on data: add, subtract, AND, OR, shift, compare.', 'AC ← AC + 1 · AC ← NOT AC'],
            ['os', 'Control', 'Change the order of execution by loading a new address into the PC. Loops and if-statements need this.', 'jump to 100 · skip if AC = 0'],
          ];
          const ITEMS = [
            ['Copy the word at address 940 into the AC.', [0], 'Data travels from memory into a processor register.'],
            ['Send the character held in the AC to the printer’s I/O module.', [1], 'The other end of the transfer is an I/O module, not memory.'],
            ['Subtract register R2 from register R1.', [2], 'Pure arithmetic on values already inside the processor.'],
            ['Continue at address 500 instead of the next address.', [3], 'It puts 500 into the PC, changing which instruction comes next.'],
            ['Write the AC into memory location 941.', [0], 'Data travels from a register out to memory: still processor–memory.'],
            ['Read the keyboard module’s status into the AC.', [1], 'The processor is talking to an I/O module to learn whether a key is waiting.'],
            ['Flip every bit of the AC (logical NOT).', [2], 'A logic operation on data is data processing.'],
            ['If the AC is zero, skip the next instruction.', [3], 'Skipping pushes the PC past an instruction: a decision about what runs next.'],
            ['Add the word at address 941 to the AC.', [0, 2], 'It does both: it reads a word from memory <i>and</i> adds it. Real instructions often combine categories.'],
          ];
          let i = 0, score = 0, answered = false;
          const res = [];
          const track = h('div', { class: 'row gap-s' });
          const paintTrack = () => track.replaceChildren(h('span', { class: 'xs muted b' }, 'Your answers:'), ...ITEMS.map((_, k) => h('span', { class: 'chip ' + (res[k] === true ? 'ok' : res[k] === false ? 'bad' : ''), style: { minWidth: '30px', justifyContent: 'center', outline: k === i ? '2px solid var(--chc)' : 'none' } }, res[k] === true ? '✓' : res[k] === false ? '✗' : String(k + 1))));
          const qText = h('div', { style: { fontSize: '20px', fontWeight: 700, lineHeight: 1.35, minHeight: '56px' } });
          const prog = h('span', { class: 'chip mono' });
          const fb = h('div', { class: 'card tight small', style: { minHeight: '84px' } });
          const nextBtn = h('button', { class: 'btn primary', onclick: () => { if (i < ITEMS.length - 1) { i++; paint(); } else { i = 0; score = 0; res.length = 0; paint(); } } });
          const btns = CATS.map((c, k) => h('button', { class: 'btn ' + c[0], style: { justifyContent: 'flex-start', minHeight: '50px', fontSize: '17px' }, onclick: () => answer(k) }, c[1]));
          function paint() {
            answered = false;
            qText.textContent = '“' + ITEMS[i][0] + '”';
            btns.forEach((b) => { b.disabled = false; b.classList.remove('on'); });
            fb.innerHTML = '<span class="muted">Which kind of instruction is this? Pick a category.</span>';
            nextBtn.style.visibility = 'hidden';
            prog.textContent = `Instruction ${i + 1} of ${ITEMS.length} · score ${score}`;
            paintTrack();
          }
          function answer(k) {
            if (answered) return;
            answered = true;
            const [, good, why] = ITEMS[i];
            const ok = good.includes(k);
            if (ok) score++;
            res[i] = ok; paintTrack();
            btns.forEach((b, j) => { b.disabled = true; if (good.includes(j)) b.classList.add('on'); });
            const names = good.map((g) => CATS[g][1]).join(' + ');
            fb.innerHTML = (ok ? '<b style="color:var(--ok)">✓ Correct.</b> ' : `<b style="color:var(--bad)">✗ Not quite.</b> It is <b>${names}</b>. `) + why;
            prog.textContent = `Instruction ${i + 1} of ${ITEMS.length} · score ${score}`;
            nextBtn.textContent = i < ITEMS.length - 1 ? 'Next instruction →' : `Done: ${score}/${ITEMS.length}. Play again`;
            nextBtn.style.visibility = 'visible';
          }
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'lead m0', html: 'Every <span class="t">instruction</span> spells out one action. Almost any action falls into one of four categories:' }),
              h('div', { class: 'grid-2', style: { gap: '10px' } }, CATS.map((c) => h('div', { class: 'card tight ' + c[0] }, h('div', { class: 'b', style: { color: `var(--${c[0]})` } }, c[1]), h('div', { class: 'small' }, c[2]), h('div', { class: 'xs mono', style: { marginTop: '4px', color: `var(--${c[0]})` } }, 'e.g. ' + c[3])))),
              h('div', { class: 'callout warn m0', 'data-label': 'Not always just one' }, 'A single instruction may mix categories. “Add the word at 941 to the AC” first reads memory (processor–memory) and then adds (data processing).')),
            h('div', { class: 'card white stack', style: { gap: '14px', justifyContent: 'center' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Sort it'), prog),
              qText,
              h('div', { class: 'grid-2', style: { gap: '10px' } }, btns),
              fb,
              h('div', { class: 'row', style: { minHeight: '36px' } }, nextBtn),
              track)));
          paint();
        },
      },

      /* ---------------- 4. The hypothetical 16-bit machine + decoder ---------------- */
      {
        title: 'Meet a tiny 16-bit machine',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          let word = 0x1940, mode = 'instr';
          const inp = h('input', { type: 'text', maxlength: 4, spellcheck: 'false', 'aria-label': 'Word in hexadecimal', class: 'mono', style: { width: '92px', height: '38px', fontSize: '20px', fontWeight: 800, textAlign: 'center', borderRadius: '10px', border: '2px solid var(--line-2)', background: 'var(--panel)', color: 'var(--ink)', textTransform: 'uppercase' } });
          const labels = h('div', { class: 'bits lab' });
          const bitsRow = h('div', { class: 'bits' });
          const hexRow = h('div', { class: 'bits hx' });
          const bitBtns = [];
          for (let b = 15; b >= 0; b--) {
            const btn = h('button', { type: 'button', class: 'bit', title: 'bit ' + b + ' (click to flip)', onclick: () => { word ^= (1 << b); paint(true); } });
            bitBtns.push(btn); bitsRow.append(btn);
          }
          const rdI = h('div', { class: 'card tight small' }), rdD = h('div', { class: 'card tight small' });
          const seg = ctx.ui.seg([{ value: 'instr', label: 'as an instruction' }, { value: 'data', label: 'as a number' }], mode, (v) => { mode = v; paint(false); });
          function paint(syncInput) {
            if (syncInput) inp.value = hex(word);
            inp.style.borderColor = 'var(--line-2)';
            const isI = mode === 'instr';
            bitBtns.forEach((btn, k) => {
              const bitNo = 15 - k;
              btn.textContent = (word >> bitNo) & 1;
              btn.className = 'bit ' + (isI ? (k < 4 ? 'op' : 'ad') : (k < 1 ? 'sg' : 'mg')) + (k % 4 === 3 && k < 15 ? ' nib' : '');
            });
            labels.replaceChildren(...(isI
              ? [h('span', { style: { gridColumn: 'span 4', color: 'var(--accent)' } }, ctx.narrow ? 'opcode' : 'opcode · 4 bits'), h('span', { style: { gridColumn: 'span 12', color: 'var(--mem)' } }, 'address · 12 bits')]
              : [h('span', { style: { gridColumn: 'span 1', color: 'var(--warn)' } }, ctx.narrow ? '±' : 'sign'), h('span', { style: { gridColumn: 'span 15', color: 'var(--cpu)' } }, 'magnitude · 15 bits')]));
            hexRow.replaceChildren(...[3, 2, 1, 0].map((n) => h('span', { style: { gridColumn: 'span 4' } }, (ctx.narrow ? '' : 'hex ') + hex((word >> (n * 4)) & 0xF, 1))));
            const op = opOf(word), ad = addrOf(word), O = OPS[op];
            rdI.style.opacity = isI ? 1 : 0.55; rdD.style.opacity = isI ? 0.55 : 1;
            rdI.innerHTML = `<h4 class="m0">Read as an instruction</h4>
              <div>Opcode <b class="mono">${bin(op, 4)}</b> = ${op} → ${O ? '<b>' + O.verb + '</b>' : '<span style="color:var(--warn)">not one of our three opcodes</span>'}</div>
              <div>Address <b class="mono">${hex(ad, 3)}</b> hex = ${ad.toLocaleString('en-US')} decimal</div>
              <div class="mt" style="margin-top:6px">${O ? 'Meaning: <b class="mono">' + O.short(ad) + '</b>' : 'The machine has room for 16 opcodes; this example only defines 1, 2 and 5.'}</div>`;
            rdD.innerHTML = `<h4 class="m0">Read as a number</h4>
              <div>Sign bit <b class="mono">${(word >> 15) & 1}</b> → ${(word & 0x8000) ? 'negative' : 'positive'}</div>
              <div>Magnitude (15 bits) = ${(word & 0x7FFF).toLocaleString('en-US')}</div>
              <div style="margin-top:6px">Value: <b class="mono">${signed(word)}</b>${(word & 0x7FFF) === 0 && (word & 0x8000) ? ' (a “negative zero”)' : ''}</div>`;
          }
          inp.addEventListener('input', () => { const v = parseHex(inp.value); if (v == null) { inp.style.borderColor = 'var(--bad)'; return; } word = v; paint(false); });
          const presets = [['1940', 0x1940], ['5941', 0x5941], ['2941', 0x2941], ['0003', 0x0003], ['8005', 0x8005]].map(([t, v]) => h('button', { class: 'btn sm mono', onclick: () => { word = v; paint(true); } }, t));
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'lead m0', html: 'To watch the cycle in full detail we use a made-up machine, small enough to hold in your head.' }),
              h('ul', { class: 'm0 small', style: { paddingLeft: '20px' }, html: `
                <li>Memory is a row of numbered cells, each holding a 16-bit <span class="t">word</span>.</li>
                <li>An instruction word = a 4-bit <span class="t">opcode</span> + a 12-bit <span class="t">address field</span>.</li>
                <li>A data word = 1 sign bit + a 15-bit magnitude (<span class="t">sign-magnitude</span>).</li>
                <li>Registers: <b>PC</b>, <b>IR</b> and one <span class="t">accumulator (AC)</span> for the data being worked on.</li>` }),
              h('table', { class: 'tbl compact', html: '<thead><tr><th>Opcode</th><th>Hex</th><th>What it does</th></tr></thead><tbody><tr><td class="mono">0001</td><td class="mono">1</td><td>Load AC from memory</td></tr><tr><td class="mono">0010</td><td class="mono">2</td><td>Store AC to memory</td></tr><tr><td class="mono">0101</td><td class="mono">5</td><td>Add to AC from memory</td></tr></tbody>' }),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why 16 and 4096?' }, h('span', { html: '4 opcode bits make 2<sup>4</sup> = <b>16</b> patterns, so up to 16 operations. 12 address bits make 2<sup>12</sup> = <b>4,096</b> patterns, so an instruction can name any of 4,096 (4K) words directly.' })),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Every number in this example is <span class="t">hex</span> (base 16). Address 940 means 9×256 + 4×16 = 2,368 in decimal, not nine hundred forty.' })),
            h('div', { class: 'card white stack', style: { gap: '10px', justifyContent: 'center' } },
              h('div', { class: 'row' }, h('span', { class: 'b' }, 'Word (hex):'), inp, h('span', { class: 'xs muted' }, 'try'), ...presets),
              h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Read the 16 bits'), seg, h('span', { class: 'xs muted' }, 'Click any bit to flip it.')),
              h('div', { class: 'stack', style: { gap: '4px' } }, labels, bitsRow, hexRow),
              h('div', { class: 'grid-2', style: { gap: '10px' } }, rdI, rdD),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Same bits, two meanings', html: 'Memory cannot tell instructions from numbers. A word acts as an instruction when the PC fetches it, and as data when an instruction’s address field points at it. Hex helps because each hex digit is exactly four bits: the first digit is the opcode, the last three the address.' }))));
          paint(true);
        },
      },

      /* ---------------- 5. The full register-level simulator ---------------- */
      {
        title: 'Watch the machine add 3 + 2, register by register',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const NW = ctx.narrow;
          let fmt = 'hex', detail = 'micro';
          // geometry: a wide side-by-side layout, and a tall single-column one for phones
          const L = NW ? {
            vb: '0 0 380 912', trk: (i) => [6 + (i % 3) * 125, 2 + Math.floor(i / 3) * 34, 118, 28],
            cpu: [4, 74, 372, 474], mem: [4, 626, 372, 282], title: 98, mtitle: 650,
            reg: { pc: [16, 124], ir: [16, 188], ac: [16, 252], mar: [16, 316], mbr: [16, 380], alu: [16, 444] }, rw: 348,
            dec: [16, 518, 538],
            bus: { addr: { x1: 110, y1: 550, x2: 110, y2: 622, tag: [110, 574], lab: [120, 610, 'start'], text: 'address lines' },
                   data: { x1: 270, y1: 550, x2: 270, y2: 622, tag: [270, 574], lab: [280, 610, 'start'], text: 'data lines' } },
            busT: null, row0: 680, rstep: 34, rh: 30, rx: 12, rw2: 356, ax: 52, cx: 190, px: 330, gx: null, hy: 672,
          } : {
            vb: '0 0 1152 356', trk: (i) => [13 + i * 190, 2, 176, 30],
            cpu: [8, 44, 544, 308], mem: [720, 44, 424, 308], title: 68, mtitle: 68,
            reg: { pc: [24, 92], ir: [24, 178], ac: [24, 264], mar: [296, 92], mbr: [296, 178], alu: [296, 264] }, rw: 240,
            dec: [24, 340, null],
            bus: { addr: { x1: 538, y1: 120, x2: 718, y2: 120, tag: [628, 120], lab: [628, 150, 'middle'], text: 'address lines' },
                   data: { x1: 538, y1: 206, x2: 718, y2: 206, tag: [628, 206], lab: [628, 236, 'middle'], text: 'data lines' } },
            busT: [628, 70], row0: 100, rstep: 35, rh: 31, rx: 732, rw2: 400, ax: 776, cx: 900, px: 1028, gx: 1124, hy: 92,
          };
          const PROGW = [0x1940, 0x5941, 0x2941];
          const svg = s('svg', { viewBox: L.vb, width: '100%', role: 'img', 'aria-label': 'Processor registers, system bus and main memory during the example program' });
          const T = (x, y, str, o = {}) => s('text', Object.assign({ x, y }, o), str);
          function wtext(v, bits, x, y, size, instr) {
            if (v == null) return T(x, y, '—', { 'text-anchor': 'middle', 'font-size': size, class: 's-sub s-monot' });
            const str = fmt === 'hex' ? hex(v, bits / 4) : bin(v, bits);
            const sz = fmt === 'hex' ? size : Math.min(size, bits === 16 ? 15.5 : 16);
            if (!instr) return T(x, y, str, { 'text-anchor': 'middle', 'font-size': sz, 'font-weight': 700, class: 's-monot' });
            const cut = fmt === 'hex' ? 1 : 4;
            return s('text', { x, y, 'text-anchor': 'middle', 'font-size': sz, 'font-weight': 700, class: 's-monot' },
              s('tspan', { style: 'fill:var(--accent)' }, str.slice(0, cut)), s('tspan', { style: 'fill:var(--mem)' }, str.slice(cut)));
          }
          function reg(F, key, name, full, content) {
            const [x, y] = L.reg[key], chg = F.ch.includes(key);
            return s('g', {},
              s('text', { x, y }, s('tspan', { style: 'fill:var(--cpu)', 'font-weight': 800, 'font-size': 15 }, name), s('tspan', { class: 's-sub', 'font-size': 12.5, dx: 8 }, full)),
              s('rect', { x, y: y + 8, width: L.rw, height: 40, rx: 8, class: chg ? 's-hl' : 's-panel', 'stroke-width': chg ? 3 : 2, style: chg ? '' : 'stroke:var(--cpu)' }),
              content(x + L.rw / 2, y + 35));
          }
          function bus(key, on, inward, val, bits) {
            const b = L.bus[key];
            const [ax, ay, bx, by] = inward ? [b.x2, b.y2, b.x1, b.y1] : [b.x1, b.y1, b.x2, b.y2];
            const tagW = fmt === 'hex' ? 60 : (bits === 16 ? 164 : 124);
            return s('g', {},
              s('line', { x1: ax, y1: ay, x2: bx, y2: by, 'stroke-width': on ? 4 : 2, 'stroke-dasharray': on ? null : '5 6', 'marker-end': on ? 'url(#arr-accent)' : null, style: on ? 'stroke:var(--accent)' : 'stroke:var(--line-2)' }),
              on && val != null ? s('g', {}, s('rect', { x: b.tag[0] - tagW / 2, y: b.tag[1] - 13, width: tagW, height: 26, rx: 13, class: 's-accent', 'stroke-width': 2 }),
                T(b.tag[0], b.tag[1] + 5, fmt === 'hex' ? hex(val, bits / 4) : bin(val, bits), { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 's-monot' })) : null,
              T(b.lab[0], b.lab[1], b.text, { 'text-anchor': b.lab[2], 'font-size': 12.5, class: 's-sub' }));
          }
          function draw(F) {
            const mem = { 0x300: 0x1940, 0x301: 0x5941, 0x302: 0x2941, 0x940: 0x0003, 0x941: F.m941 };
            const kids = [];
            ['Fetch 1', 'Execute 1', 'Fetch 2', 'Execute 2', 'Fetch 3', 'Execute 3'].forEach((t, i) => {
              const [x, y, w, hh] = L.trk(i), cur = F.stage === i, done = F.stage > i;
              kids.push(s('rect', { x, y, width: w, height: hh, rx: hh / 2, class: cur ? 's-accent' : done ? 's-ok' : 's-panel', 'stroke-width': cur ? 3 : 1.5 }),
                T(x + w / 2, y + hh / 2 + 5, (done ? '✓ ' : '') + t, { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: `fill:var(--${cur ? 'accent' : done ? 'ok' : 'muted'})` }));
            });
            const [cx, cy, cw, chh] = L.cpu, [mx, my, mw, mh] = L.mem;
            kids.push(s('rect', { x: cx, y: cy, width: cw, height: chh, rx: 16, class: 's-cpu', 'stroke-width': 2, style: 'fill-opacity:.55' }),
              T(cx + 16, L.title, 'PROCESSOR', { 'font-size': 13, 'font-weight': 800, 'letter-spacing': '.08em', style: 'fill:var(--cpu)' }),
              s('rect', { x: mx, y: my, width: mw, height: mh, rx: 16, class: 's-mem', 'stroke-width': 2, style: 'fill-opacity:.55' }),
              T(mx + 16, L.mtitle, 'MAIN MEMORY', { 'font-size': 13, 'font-weight': 800, 'letter-spacing': '.08em', style: 'fill:var(--mem)' }));
            kids.push(reg(F, 'pc', 'PC', 'program counter', (x, y) => wtext(F.pc, 12, x, y, 20)),
              reg(F, 'ir', 'IR', 'instruction register', (x, y) => wtext(F.ir, 16, x, y, 20, true)),
              reg(F, 'ac', 'AC', 'accumulator', (x, y) => wtext(F.ac, 16, x, y, 20)),
              reg(F, 'mar', 'MAR', 'memory address register', (x, y) => wtext(F.mar, 12, x, y, 20)),
              reg(F, 'mbr', 'MBR', 'memory buffer register', (x, y) => wtext(F.mbr, 16, x, y, 20, PROGW.includes(F.mbr))),
              reg(F, 'alu', 'ALU', 'arithmetic logic unit', (x, y) => F.ch.includes('alu')
                ? T(x, y, fmt === 'hex' ? '0003 + 0002 = 0005' : '11 + 10 = 101', { 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, class: 's-monot' })
                : T(x, y, 'idle', { 'text-anchor': 'middle', 'font-size': 15, class: 's-sub' })));
            const execLike = F.stage % 2 === 1 || F.stage === 6;
            if (F.ir != null && execLike) {
              const O = OPS[opOf(F.ir)], a = hex(addrOf(F.ir), 3);
              if (L.dec[2]) kids.push(T(L.dec[0], L.dec[1], `Decoded IR: opcode ${opOf(F.ir)} = ${O.verb[0].toLowerCase() + O.verb.slice(1)}`, { 'font-size': 14, 'font-weight': 700 }), T(L.dec[0], L.dec[2], `address field = ${a}`, { 'font-size': 14, 'font-weight': 700 }));
              else kids.push(T(L.dec[0], L.dec[1], `Decoded IR:  opcode ${opOf(F.ir)} = ${O.verb[0].toLowerCase() + O.verb.slice(1)}  ·  address field = ${a}`, { 'font-size': 14.5, 'font-weight': 700 }));
            } else kids.push(T(L.dec[0], L.dec[1], F.stage < 0 ? 'Waiting to start.' : 'Fetch stage: bringing in the next instruction.', { 'font-size': 14, class: 's-sub' }));
            if (L.busT) kids.push(T(L.busT[0], L.busT[1], 'SYSTEM BUS', { 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, 'letter-spacing': '.08em', class: 's-sub' }));
            kids.push(bus('addr', F.bus.includes('addr'), false, F.mar, 12),
              bus('data', F.bus.includes('read') || F.bus.includes('write'), F.bus.includes('read'), F.mbr, 16));
            kids.push(T(L.ax, L.hy, fmt === 'hex' ? 'ADDRESS' : (NW ? 'ADDR (HEX)' : 'ADDRESS (HEX)'), { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 800, class: 's-sub' }), T(L.cx, L.hy, 'CONTENTS', { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 800, class: 's-sub' }));
            let y = L.row0;
            [0x300, 0x301, 0x302, 0x303, 'gap', 0x940, 0x941].forEach((a) => {
              if (a === 'gap') { kids.push(T(L.cx, y + 16, '⋮  other memory  ⋮', { 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' })); y += 25; return; }
              const hot = F.cell === a, wrote = a === 0x941 && F.ch.includes('m941');
              const mid = y + L.rh / 2;
              kids.push(s('rect', { x: L.rx, y, width: L.rw2, height: L.rh, rx: 7, class: wrote ? 's-hl' : hot ? 's-accent' : 's-panel', 'stroke-width': hot || wrote ? 3 : 1 }),
                T(L.ax, mid + 6, hex(a, 3), { 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, class: 's-monot' }),
                a === 0x303 ? T(L.cx, mid + 5, '(next instruction)', { 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }) : wtext(mem[a], 16, L.cx, mid + 6, 17, a < 0x303));
              if (F.pc === a) kids.push(s('rect', { x: L.px - 27, y: mid - 11, width: 54, height: 22, rx: 11, class: 's-cpu', 'stroke-width': 1.5 }), T(L.px, mid + 5, '← PC', { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--cpu)' }));
              // plain-language meaning of each program word (wide layout only; phones have no room beside the PC tag)
              const GLOSS = { 0x300: 'load 940', 0x301: 'add 941', 0x302: 'store 941', 0x940: 'data', 0x941: 'data' };
              if (L.gx && GLOSS[a]) kids.push(T(L.gx, mid + 5, GLOSS[a], { 'text-anchor': 'end', 'font-size': 12, 'font-weight': 700, class: 's-sub' }));
              y += L.rstep;
            });
            svg.replaceChildren(...kids);
          }
          const frames = () => (detail === 'micro' ? MICRO : BIG);
          const player = ctx.ui.player({ count: frames().length, render: (i) => { draw(frames()[i]); return frames()[i].cap; }, interval: 2600 });
          const segD = ctx.ui.seg([{ value: 'micro', label: NW ? 'Micro-steps' : 'Micro-steps (with MAR / MBR)' }, { value: 'big', label: NW ? '6 stages' : '6 stages only' }], detail, (v) => {
            // keep the student's place: big step k shows the state of micro frame AT[k]
            const AT = [0, 3, 6, 9, 12, 15, 17], cur = player.index;
            const to = v === 'big' ? AT.reduce((best, m, k) => (m <= cur ? k : best), 0) : (AT[cur] || 0);
            detail = v; player.setCount(frames().length); player.go(to);
          });
          const segF = ctx.ui.seg([{ value: 'hex', label: 'Hex' }, { value: 'bin', label: 'Binary' }], fmt, (v) => { fmt = v; player.refresh(); });
          const bar = h('div', { class: 'row', style: { justifyContent: 'space-between' } },
            h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Detail'), segD),
            h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Show words in'), segF),
            h('span', { class: 'xs muted', html: '<span class="t">MAR</span> = address going to memory · <span class="t">MBR</span> = word coming from or going to memory' }));
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } }, bar, NW ? player.el : null, svg, NW ? null : player.el));
        },
      },

      /* ---------------- 6. Predict, then check ---------------- */
      {
        title: 'Predict, then check: freeze-frame questions',
        kind: 'predict',
        render(el, ctx) {
          const { h } = ctx;
          const QS = [
            ['Right after the <b>second fetch</b>, what does the PC hold?', ['301', '302', '303', '941'], 1,
              'The second fetch reads the instruction at 301 and then increments the PC, so it holds 302.'],
            ['During the <b>second execute</b>, what is in the IR?', ['1940', '5941', '2941', '0005'], 1,
              'The IR keeps the instruction fetched from 301 (5941) until the next fetch replaces it.'],
            ['What is in the AC right after the <b>second execute</b>?', ['0002', '0003', '0005', '5941'], 2,
              'The load put 3 in the AC; the add then added the 2 stored at 941, giving 5.'],
            ['During the <b>first execute</b>, which address does the MAR send to memory?', ['300', '301', '940', '941'], 2,
              'The address field of 1940 is 940, and loading the AC needs the word stored there.'],
            ['When the program ends, what is stored in cell <b>941</b>?', ['0002', '0003', '0005', '2941'], 2,
              'The store (2941) wrote the AC’s value over the old 0002, so 941 now holds 0005.'],
            ['How many times does the processor <b>read</b> memory in the whole run?', ['3', '5', '6', '8'], 1,
              'Three instruction fetches plus two operand reads (940 and 941). The store is a write, not a read.'],
          ];
          const picked = [];
          const score = h('span', { class: 'chip mono' });
          const paintScore = () => { const done = picked.filter((x) => x != null).length; const right = picked.filter((x, k) => x === QS[k][2]).length; score.textContent = `${right} right of ${done} answered`; };
          const cards = QS.map(([q, opts, ans, why], k) => {
            const fb = h('div', { class: 'small', style: { minHeight: '44px' } }, h('span', { class: 'muted' }, 'Commit to an answer first.'));
            const btns = opts.map((o, j) => h('button', { class: 'btn sm mono', style: { minWidth: '62px' }, onclick: () => {
              if (picked[k] != null) return;
              picked[k] = j;
              btns.forEach((b, jj) => {
                if (jj === ans) Object.assign(b.style, { borderColor: 'var(--ok)', background: 'var(--ok-bg)', color: 'var(--ok)' });
                else if (jj === j) Object.assign(b.style, { borderColor: 'var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)' });
                else b.style.opacity = '.5';
              });
              fb.innerHTML = (j === ans ? '<b style="color:var(--ok)">✓ Yes.</b> ' : `<b style="color:var(--bad)">✗ It is ${opts[ans]}.</b> `) + why;
              paintScore();
            } }, o));
            const reset = () => { btns.forEach((b) => { b.style.cssText = 'min-width:62px'; }); fb.innerHTML = '<span class="muted">Commit to an answer first.</span>'; };
            const card = h('div', { class: 'card tight stack', style: { gap: '8px' } }, h('div', { style: { fontWeight: 650, lineHeight: 1.35, minHeight: '46px' }, html: `<span class="chip accent" style="margin-right:6px">Q${k + 1}</span>${q}` }), h('div', { class: 'row gap-s' }, btns), fb);
            card.reset = reset;
            return card;
          });
          const prog = [['300', '1940', 'load'], ['301', '5941', 'add'], ['302', '2941', 'store'], ['940', '0003', 'data'], ['941', '0002', 'data']];
          const LEAD = 'Freeze the machine at one moment and say what is inside. Work it out from the program below.';
          const HINT = '<span class="chip ok" style="margin-right:6px">Hint</span>While an instruction executes, the PC already points one past it (this program has no jumps), and the IR keeps an instruction until the next fetch replaces it.';
          const lead = h('p', { class: 'lead m0', html: LEAD });
          const hintBtn = h('button', { class: 'btn sm', onclick: () => { const on = !hintBtn.classList.contains('on'); hintBtn.classList.toggle('on', on); lead.innerHTML = on ? HINT : LEAD; lead.style.fontSize = on ? '16px' : ''; } }, 'Hint');
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
            lead,
            h('div', { class: 'row', style: { justifyContent: 'space-between' } },
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b' }, 'PROGRAM:'), ...prog.map(([a, w, t]) => h('span', { class: 'chip ' + (t === 'data' ? 'mem' : 'cpu') + ' mono' }, `${a}: ${w}`, h('span', { class: 'xs', style: { fontFamily: 'var(--font)', fontWeight: 600, opacity: 0.8 } }, t))), h('span', { class: 'chip mono' }, 'PC starts at 300')),
              h('div', { class: 'row gap-s' }, score, hintBtn, h('button', { class: 'btn sm ghost', onclick: () => { picked.length = 0; cards.forEach((c) => c.reset()); paintScore(); } }, 'Start over'))),
            h('div', { class: 'grid-3 grow', style: { gap: '12px', gridAutoRows: ctx.narrow ? 'auto' : '1fr' } }, cards)));
          paintScore();
        },
      },

      /* ---------------- 7. Lab: write and run your own tiny program ---------------- */
      {
        title: 'Lab: program the machine yourself',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const PA = [0x300, 0x301, 0x302, 0x303, 0x304, 0x305], DA = [0x940, 0x941, 0x942, 0x943];
          const PRESETS = [
            ['3 + 2', [0x1940, 0x5941, 0x2941, 0, 0, 0], [3, 2, 0, 0], 0x941],
            ['Add three numbers', [0x1940, 0x5941, 0x5942, 0x2943, 0, 0], [3, 2, 4, 0], 0x943],
            ['Double a number', [0x1940, 0x5940, 0x2941, 0, 0, 0], [7, 0, 0, 0], 0x941],
            ['A negative number', [0x1940, 0x5941, 0x2942, 0, 0, 0], [0x8005, 2, 0, 0], 0x942],
          ];
          // src = the words the student typed (their program + data). The boxes show LIVE memory while the machine runs;
          // Reset (or any edit) reloads memory from src, so a program that rewrote itself gets its original words back.
          const inputs = {}, hints = {}, rows = {}, src = {};
          const mk = (a) => {
            const inp = h('input', { type: 'text', maxlength: 4, spellcheck: 'false', class: 'cell-in', 'aria-label': 'Contents of address ' + hex(a, 3) });
            inp.addEventListener('input', () => { src[a] = inp.value; resetMachine('Memory edited, so the machine was reset and your program reloaded. Press Step or Run.'); });
            inputs[a] = inp; hints[a] = h('span', { class: 'hint' });
            rows[a] = h('div', { class: 'mrow' }, h('span', { class: 'mono b' }, hex(a, 3)), inp, hints[a]);
            return rows[a];
          };
          const image = () => { const m = new Map(); [...PA, ...DA].forEach((a) => m.set(a, parseHex(src[a]) ?? 0)); return m; };
          const meaning = (a, w) => (DA.includes(a) ? '= ' + (signed(w) || '0') : w === 0 ? 'halt (stop)' : OPS[opOf(w)] ? OPS[opOf(w)].short(addrOf(w)) : 'opcode ' + opOf(w) + ': unknown here');
          let M;
          const regs = h('div', { class: 'row gap-s' });
          const log = h('div', { class: 'log grow', style: { minHeight: '120px' } });
          const verdict = h('div', { class: 'card tight small', style: { minHeight: '58px' } });
          const sel = h('select', { class: 'mono', style: { font: 'inherit', fontSize: '15px', padding: '4px 6px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--panel)', color: 'var(--ink)' } }, DA.map((a) => h('option', { value: a }, hex(a, 3))));
          const pred = h('input', { type: 'text', maxlength: 4, class: 'cell-in', placeholder: '????', 'aria-label': 'Your predicted value in hex' });
          function resetMachine(msg) {
            M = { pc: 0x300, ir: null, ac: 0, mem: image(), halted: false, cycles: 0, why: '', wrote: null, selfMod: '', selfModAt: null };
            log.replaceChildren(h('div', { class: 'muted' }, msg || 'Ready. PC = 300.'));
            Object.values(rows).forEach((r) => r.classList.remove('flash'));   // no leftover glow from before the reset
            paint();
          }
          function paint() {
            regs.replaceChildren(...[['PC', hex(M.pc, 3)], ['IR', M.ir == null ? '––––' : hex(M.ir)], ['AC', hex(M.ac) + ' (' + (signed(M.ac) || '0') + ')']].map(([n, v]) => h('span', { class: 'chip cpu mono' }, n + ' ' + v)), h('span', { class: 'chip mono' }, 'cycles ' + M.cycles));
            // every box shows the word in memory NOW, decoded fresh on every paint (so a rewritten instruction shows its new meaning)
            [...PA, ...DA].forEach((a) => {
              const orig = parseHex(src[a]), live = M.mem.get(a) ?? 0, changed = live !== (orig ?? 0), inp = inputs[a];
              const shown = changed ? hex(live) : (src[a] ?? '');
              if (inp.value !== shown) inp.value = shown;   // unchanged cells keep exactly what the student typed
              inp.classList.toggle('bad', !changed && orig == null);
              inp.classList.toggle('wr', changed);
              hints[a].replaceChildren(!changed && orig == null ? 'not a hex word' : meaning(a, live),
                ...(changed ? [h('br'), h('span', { class: 'was' }, 'changed · was ' + (orig == null ? '????' : hex(orig)))] : []));
              rows[a].classList.toggle('pc', PA.includes(a) && !M.halted && M.pc === a);
              rows[a].classList.toggle('just', M.wrote === a);
            });
            if (!M.halted) verdict.innerHTML = M.selfMod || '<span class="muted">Type your prediction, then press <b>Run to the end</b> (or step one cycle at a time).</span>';
            else {
              const cell = +sel.value, v = M.mem.get(cell) ?? 0, p = parseHex(pred.value);
              verdict.innerHTML = `<b>${M.why}</b> Cell ${hex(cell, 3)} holds <b class="mono">${hex(v)}</b> (${signed(v) || '0'}). ` +
                (p == null ? 'You did not enter a prediction.' : p === v ? '<b style="color:var(--ok)">✓ Your prediction was right.</b>' : `<b style="color:var(--bad)">✗ You predicted ${hex(p)}.</b> Step through again and watch the AC.`) +
                (M.selfModAt != null ? ` <span style="color:var(--warn)">Along the way the program rewrote its own instruction at ${hex(M.selfModAt, 3)}.</span>` : '');
            }
          }
          function cycle() {
            if (M.halted) return;
            const at = M.pc, w = M.mem.get(at) ?? 0, op = opOf(w), a = addrOf(w);
            M.ir = w; M.pc = (at + 1) & 0xFFF; M.cycles++; M.wrote = null;
            let line;
            if (op === 0) { M.halted = true; M.why = `Halted after ${M.cycles} cycles.`; line = 'halt: the machine stops'; }
            else if (op === 1) { M.ac = M.mem.get(a) ?? 0; line = `load: AC ← [${hex(a, 3)}] = ${hex(M.ac)}`; }
            else if (op === 2) {
              const old = M.mem.get(a) ?? 0;
              M.mem.set(a, M.ac); M.wrote = a;
              line = `store: [${hex(a, 3)}] ← AC = ${hex(M.ac)}`;
              if (PA.includes(a)) {
                // a store into the program area: the program has just rewritten one of its own instructions
                line += old === M.ac ? ' (an instruction cell, but it already held that word)' : ` (it overwrote the instruction ${hex(old)}!)`;
                if (old !== M.ac) {
                  M.selfModAt = a;
                  const when = a === M.pc ? 'The very next fetch' : a > M.pc ? `When the PC reaches ${hex(a, 3)}, the fetch` : `Cell ${hex(a, 3)} has already run, but any later fetch from it`;
                  M.selfMod = `<b style="color:var(--warn)">The program rewrote itself.</b> Cell ${hex(a, 3)} held the instruction <b class="mono">${hex(old)}</b>; the store replaced it with <b class="mono">${hex(M.ac)}</b>. Instructions and data share one memory, so the processor cannot tell them apart. ${when} gets the new word: <span class="mono">${meaning(a, M.ac)}</span>. Reset puts your program back.`;
                }
              }
            }
            else if (op === 5) {
              const sum = toInt(M.ac) + toInt(M.mem.get(a) ?? 0);
              M.ac = fromInt(sum);
              line = `add: AC ← AC + [${hex(a, 3)}] = ${hex(M.ac)}` + (Math.abs(sum) > 0x7FFF ? ' (overflow: too big for 15 bits)' : '');
            } else { M.halted = true; M.why = `Stopped: opcode ${op} is not one this lab understands.`; line = `opcode ${op}? unknown, machine stops`; }
            if (!M.halted && M.cycles >= 40) { M.halted = true; M.why = 'Stopped after 40 cycles.'; }
            if (M.cycles === 1) log.replaceChildren();
            log.append(h('div', {}, h('b', {}, `#${M.cycles}  `), `fetch ${hex(at, 3)}: ${hex(w)} → `, line));
            log.scrollTop = log.scrollHeight;
            paint();
            const r = M.wrote != null && rows[M.wrote];
            if (r) { r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash'); }   // one-shot glow on the cell just written
          }
          const load = (k) => { const [, P, D, cell] = PRESETS[k]; PA.forEach((a, i) => { src[a] = hex(P[i]); }); DA.forEach((a, i) => { src[a] = hex(D[i]); }); sel.value = cell; pred.value = ''; resetMachine('Loaded “' + PRESETS[k][0] + '”. Predict, then run.'); };
          sel.addEventListener('change', () => paint());
          pred.addEventListener('input', () => { if (M.halted) paint(); });
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Load an example:'), PRESETS.map((p, k) => h('button', { class: 'btn sm', onclick: () => load(k) }, p[0]))),
              h('div', { class: 'grid-2', style: { gap: '10px', alignItems: 'start' } },
                h('div', { class: 'card mem tight stack', style: { gap: '4px' } }, h('h4', { class: 'm0' }, 'Program (edit any word)'), PA.map(mk)),
                h('div', { class: 'stack', style: { gap: '10px' } },
                  h('div', { class: 'card mem tight stack', style: { gap: '4px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } }, h('h4', { class: 'm0' }, 'Data'), h('span', { class: 'xs muted', title: 'The boxes show memory as it is right now. Reset puts back the words you typed.' }, h('span', { class: 'live-key' }), 'changed by the program')), DA.map(mk)),
                  h('div', { class: 'card tight xs', html: '<b>Opcodes:</b> 1 = load AC · 2 = store AC · 5 = add to AC. <b>0000</b> = halt, a stop code added just for this lab. Numbers use sign-magnitude, so 8005 is −5.' }))),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Challenge' }, 'Start from “3 + 2”. Change exactly one instruction so that cell 941 ends up holding 0006. Predict first, then run it.',
                ctx.ui.reveal('Show one answer', '<div class="small" style="margin-top:4px">Change 301 from <b class="mono">5941</b> to <b class="mono">5940</b>: the add reads 940 again, so AC = 3 + 3 = 6 and the store writes 0006 into 941.</div>'))),
            h('div', { class: 'card white stack', style: { gap: '10px' } },
              h('h4', { class: 'm0' }, '1 · Predict'),
              h('div', { class: 'row gap-s small' }, 'When it halts, cell', sel, 'will hold', pred, h('span', { class: 'xs muted' }, '(hex)')),
              h('h4', { class: 'm0' }, '2 · Run'),
              h('div', { class: 'row gap-s' }, h('button', { class: 'btn', onclick: cycle }, 'Step one cycle'), h('button', { class: 'btn primary', onclick: () => { let n = 0; while (!M.halted && n++ < 50) cycle(); } }, 'Run to the end'), h('button', { class: 'btn ghost', title: 'Stop, set PC = 300 and reload memory with the words you typed', onclick: () => resetMachine('Reset. Memory reloaded with the words you typed; PC = 300.') }, 'Reset')),
              regs, log, verdict)));
          load(0);
        },
      },

      /* ---------------- 8. I/O: through the processor, or DMA ---------------- */
      {
        title: 'Moving I/O data: through the processor, or around it',
        kind: 'compare',
        render(el, ctx) {
          const { h, s } = ctx;
          let mode = 'cpu';
          // geometry: a wide triangle layout, and a taller one for phones (I/O module above memory)
          const G = ctx.narrow ? {
            vb: '0 0 320 400', fs: 13, cpu: [10, 6, 300, 92], cT: [160, 28], cS: [160, 52], meter: [60, 62, 200], cP: [160, 90],
            io: [10, 142, 200, 92], ioT: [110, 162], ioS: [110, 226], ioW: (j) => [21 + j * 31, 176],
            mem: [10, 300, 200, 92], mT: [110, 320], mS: [110, 384], mW: (j) => [21 + j * 31, 334],
            path: { A: [[150, 140], [150, 100]], B: [[270, 100], [270, 346], [212, 346]], C: [[110, 236], [110, 298]] }, mid: { B: [270, 222] },
            labA: [180, 118, 'start'], labB: [262, 250, 'end'], dma: [136, 272, 'start'],
          } : {
            vb: '0 0 460 250', fs: 12.5, cpu: [140, 6, 180, 92], cT: [230, 28], cS: [230, 51], meter: [160, 61, 140], cP: [230, 89],
            io: [6, 146, 190, 98], ioT: [101, 166], ioS: [101, 230], ioW: (j) => [17 + j * 28, 178],
            mem: [264, 146, 190, 98], mT: [359, 166], mS: [359, 230], mW: (j) => [275 + j * 28, 178],
            path: { A: [[80, 144], [170, 100]], B: [[290, 100], [380, 144]], C: [[198, 195], [262, 195]] }, mid: {},
            labA: [90, 112, 'end'], labB: [370, 112, 'start'], dma: [230, 176, 'middle'],
          };
          const svg = s('svg', { viewBox: G.vb, width: '100%', style: ctx.narrow ? { display: 'block' } : { maxHeight: '300px', display: 'block' }, role: 'img', 'aria-label': 'Processor, I/O module and main memory, with the path each data word takes' });
          const spent = h('span', { class: 'chip cpu mono' }), ran = h('span', { class: 'chip ok mono' });
          const T = (x, y, str, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle' }, o), str);
          // derive everything about frame i from scratch
          function state(i) {
            if (mode === 'cpu') {
              if (i === 0) return { left: 6, filled: 0, tok: null, spent: 0, prog: 0, cpu: 'ready' };
              const k = Math.ceil(i / 2), part1 = i % 2 === 1;
              return { left: 6 - k, filled: part1 ? k - 1 : k, tok: part1 ? ['A', 'in', 'w' + k] : ['B', 'out', 'w' + k], spent: i, prog: 0, cpu: part1 ? 'reading word ' + k : 'storing word ' + k };
            }
            if (i === 0) return { left: 6, filled: 0, tok: null, spent: 0, prog: 0, cpu: 'ready' };
            if (i === 1) return { left: 6, filled: 0, tok: ['A', 'down', 'cmd'], spent: 1, prog: 0, cpu: 'sending a command' };
            if (i <= 7) return { left: 7 - i, filled: i - 1, tok: ['C', 'out', 'w' + (i - 1)], spent: 1, prog: 3 * (i - 1), cpu: 'running your program' };
            return { left: 0, filled: 6, tok: ['A', 'in', 'done', 'intr'], spent: 2, prog: 18, cpu: 'noting “done”' };
          }
          const CAP = {
            cpu: (i) => i === 0 ? 'Six words must travel from a disk’s I/O module into memory. In this mode the processor carries every word itself.'
              : i === 12 ? '<b>Done, but costly.</b> 12 instruction cycles went into copying 6 words, and your program ran none of its own. A real disk block holds thousands of words.'
              : i % 2 ? `<b>Word ${Math.ceil(i / 2)}, part 1.</b> The processor executes an input instruction: the word moves from the I/O module into a processor register.`
              : `<b>Word ${i / 2}, part 2.</b> A store instruction copies it from the register into memory. Two full instruction cycles per word, while your program waits.`,
            dma: (i) => i === 0 ? 'Same job, but now the I/O module is allowed to read and write main memory by itself.'
              : i === 1 ? '<b>Set-up.</b> The processor sends one command to the I/O module: “copy 6 words into memory starting at address 700.” Then it goes back to its own work.'
              : i <= 7 ? `<b>Word ${i - 1}</b> goes straight from the I/O module into memory. Meanwhile the processor keeps executing your program.`
              : '<b>Done.</b> The I/O module tells the processor the transfer is finished (with an <span class="t">interrupt</span>, the topic of 1.4). The processor spent only 2 steps on the whole transfer.',
          };
          function arrow(key, on, rev, cls) {
            const pts = rev ? G.path[key].slice().reverse() : G.path[key];
            return s('polyline', { points: pts.map((p) => p.join(',')).join(' '), fill: 'none', 'stroke-width': on ? 3.5 : 2, 'stroke-dasharray': on ? null : '5 5', 'marker-end': on ? `url(#arr-${cls || 'accent'})` : null, style: `stroke:var(--${on ? (cls || 'accent') : 'line-2'})` });
          }
          const box = ([x, y, w, hh], cls) => s('rect', { x, y, width: w, height: hh, rx: 14, class: cls, 'stroke-width': 2 });
          const title = ([x, y], str, col) => T(x, y, str, { 'font-size': G.fs, 'font-weight': 800, 'letter-spacing': '.07em', style: `fill:var(--${col})` });
          const sub = ([x, y], str) => T(x, y, str, { 'font-size': G.fs, class: 's-sub' });
          function draw(i) {
            const S = state(i), tok = S.tok, kids = [], [mx0, my0, mw] = G.meter;
            kids.push(box(G.cpu, 's-cpu'), title(G.cT, 'PROCESSOR', 'cpu'), T(G.cS[0], G.cS[1], S.cpu, { 'font-size': G.fs + 1.5, 'font-weight': 700 }),
              s('rect', { x: mx0, y: my0, width: mw, height: 10, rx: 5, class: 's-panel', 'stroke-width': 1 }),
              S.prog ? s('rect', { x: mx0, y: my0, width: mw * S.prog / 18, height: 10, rx: 5, style: 'fill:var(--ok)' }) : null,
              sub(G.cP, 'your program: ' + S.prog + ' instructions'));
            kids.push(box(G.io, 's-io'), title(G.ioT, 'I/O MODULE · DISK', 'io'), sub(G.ioS, 'words waiting: ' + S.left),
              box(G.mem, 's-mem'), title(G.mT, 'MAIN MEMORY', 'mem'), sub(G.mS, 'buffer at 700–705'));
            for (let j = 0; j < 6; j++) {
              const waiting = j >= 6 - S.left, got = j < S.filled, [ix, iy] = G.ioW(j), [qx, qy] = G.mW(j);
              kids.push(s('rect', { x: ix, y: iy, width: 24, height: 24, rx: 5, class: waiting ? 's-io' : 's-panel', 'stroke-width': waiting ? 2 : 1, 'stroke-dasharray': waiting ? null : '3 3' }),
                waiting ? T(ix + 12, iy + 17, String(j + 1), { 'font-size': 12, 'font-weight': 800 }) : null,
                s('rect', { x: qx, y: qy, width: 24, height: 24, rx: 5, class: got ? 's-mem' : 's-panel', 'stroke-width': got ? 2 : 1 }),
                got ? T(qx + 12, qy + 17, String(j + 1), { 'font-size': 12, 'font-weight': 800 }) : null);
            }
            const on = (k) => tok && tok[0] === k;
            const lab = ([x, y, anc]) => [T(x, y, 'via the', { 'font-size': 12, 'text-anchor': anc, class: 's-sub' }), T(x, y + 14, 'processor', { 'font-size': 12, 'text-anchor': anc, class: 's-sub' })];
            kids.push(arrow('A', on('A'), tok && tok[1] === 'down', tok && tok[3]), arrow('B', on('B')), arrow('C', on('C')), ...lab(G.labA), ...lab(G.labB),
              T(G.dma[0], G.dma[1], 'DMA', { 'font-size': 12, 'font-weight': 800, 'text-anchor': G.dma[2], style: `fill:var(--${mode === 'dma' ? 'accent' : 'muted'})` }));
            if (tok) {
              const P = G.path[tok[0]], [mx, my] = G.mid[tok[0]] || [(P[0][0] + P[P.length - 1][0]) / 2, (P[0][1] + P[P.length - 1][1]) / 2], w = tok[2].length * 8 + 16;
              kids.push(s('rect', { x: mx - w / 2, y: my - 11, width: w, height: 22, rx: 11, class: tok[3] ? 's-intr' : 's-accent', 'stroke-width': 2 }), T(mx, my + 5, tok[2], { 'font-size': 12.5, 'font-weight': 800, class: 's-monot' }));
            }
            svg.replaceChildren(...kids);
            spent.textContent = 'processor steps on the transfer: ' + S.spent;
            ran.textContent = 'your program ran: ' + S.prog;
          }
          const count = () => (mode === 'cpu' ? 13 : 9);
          const player = ctx.ui.player({ count: count(), render: (i) => { draw(i); return CAP[mode](i); }, interval: 1300 });
          const seg = ctx.ui.seg([{ value: 'cpu', label: 'Processor carries every word' }, { value: 'dma', label: 'Direct memory access (DMA)' }], mode, (v) => { mode = v; player.setCount(count()); });
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'lead m0', html: 'Data for an I/O device can travel two ways.' }),
              h('p', { class: 'm0 small', html: '<b>Through the processor.</b> A processor–I/O instruction works like a load or store, but it names a device instead of a memory cell. Data moves directly between the processor and that device’s <span class="t">I/O module</span> (the circuit that runs it).' }),
              h('p', { class: 'm0 small', html: '<b>Around the processor.</b> For bulk transfers, the processor can let the I/O module read or write main memory itself. This is <span class="t">direct memory access (DMA)</span>: the processor is relieved of the copying and keeps executing instructions.' }),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters' }, 'Copying a disk block word by word burns thousands of instruction cycles that compute nothing. DMA gives that time back.'),
              h('table', { class: 'tbl compact', html: '<thead><tr><th></th><th>Through the processor</th><th>DMA</th></tr></thead><tbody><tr><td class="b">Who moves each word</td><td>the processor, one instruction at a time</td><td>the I/O module</td></tr><tr><td class="b">Processor meanwhile</td><td>busy copying</td><td>runs other instructions</td></tr></tbody>' }),
              h('p', { class: 'xs muted m0' }, 'Preview only: 1.7 covers DMA in detail, and 1.4 covers the “done” signal.')),
            h('div', { class: 'card white stack', style: { gap: '10px' } },
              h('div', { class: 'row gap-s' }, seg),
              h('div', { class: 'row gap-s' }, spent, ran),
              h('div', { class: 'grow', style: { display: 'grid', placeItems: 'center' } }, svg),
              player.el)));
        },
      },

      /* ---------------- 9. Recap ---------------- */
      {
        title: 'Recap: eight things to remember',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          const trace = [['F', '300 → IR = 1940', 'PC = 301'], ['E', 'AC ← [940]', 'AC = 0003'], ['F', '301 → IR = 5941', 'PC = 302'], ['E', 'AC ← AC + [941]', 'AC = 0005'], ['F', '302 → IR = 2941', 'PC = 303'], ['E', '[941] ← AC', '941 = 0005']];
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. If you hesitate, revisit that step.'),
            ctx.ui.flipcards([
              ['The two stages of every instruction cycle', '<div><b>Fetch</b>: the instruction at the PC’s address goes into the IR, and PC + 1. <b>Execute</b>: decode it, do it. Repeat until halt.</div>'],
              ['What the PC holds, and when it changes', '<div>The address of the <i>next</i> instruction. Here it goes up by 1 after each fetch (one word per instruction), unless a control instruction such as a jump loads a new address.</div>'],
              ['When does the loop stop?', '<div>Only on a halt: the power goes off, an unrecoverable error occurs, or the program executes an instruction that says stop.</div>'],
              ['The four kinds of instruction', '<div>Processor–memory, processor–I/O, data processing and control. One instruction can combine several.</div>'],
              ['Decode the word 5941', '<div>Opcode 5 (0101) = add to AC from memory; address 941. So AC ← AC + the word at 941.</div>'],
              ['Why 16 opcodes and 4,096 words?', '<div>4 opcode bits give 2<sup>4</sup> = 16 patterns. 12 address bits give 2<sup>12</sup> = 4,096 addresses (4K).</div>'],
              ['The jobs of the MAR and the MBR', '<div>MAR: the address about to be read or written. MBR: the word just read from memory, or about to be written to it.</div>'],
              ['What DMA buys you', '<div>An I/O module moves data to or from memory itself, so the processor is freed from the transfer and keeps running programs.</div>'],
            ], { cols: 4, height: 138 }),
            h('div', { class: 'card tight' },
              h('h4', {}, 'The whole example program in one line (F = fetch, E = execute)'),
              h('div', { class: 'row gap-s' }, trace.map(([k, a, b], i) => [
                h('span', { class: 'chip ' + (k === 'F' ? 'mem' : 'cpu') + ' mono', title: k === 'F' ? 'fetch' : 'execute' }, k + (Math.floor(i / 2) + 1), h('span', { style: { fontWeight: 600 } }, ' ' + a), h('b', {}, ' · ' + b)),
                i < trace.length - 1 ? h('span', { class: 'muted' }, '→') : null]))),
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake' }, 'Thinking the PC points at the instruction that is running. It already points at the next one: the increment happens during the fetch, before execution starts.')));
        },
      },

      /* ---------------- 10. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'A processor has just finished the execute stage of an ordinary add instruction. What does it do next?',
            choices: ['Starts a new fetch, from the address now held in the program counter', 'Executes the same instruction again, because it is still in the instruction register', 'Halts, because every instruction cycle ends in a halt', 'Waits for the operating system to hand it the next instruction'], answer: 0,
            feedback: [null, 'The IR keeps the old instruction only until the next fetch overwrites it. Nothing makes the processor run it a second time.', 'Halt is not part of every cycle. The loop stops only when the power goes off, an unrecoverable error occurs, or a halt instruction is executed.', 'The hardware loop needs no help: the next fetch begins automatically. The operating system is itself just a program run by this same loop.'],
            why: 'The instruction cycle is a loop (fetch, execute, fetch, execute…). The next fetch starts straight away from the address in the PC, and the loop ends only on a halt.' },
          { type: 'tf', q: 'On a word-addressed teaching machine where every instruction fills exactly one memory word, the program counter goes up by one after every fetch unless an instruction changes it, so instructions run in address order.', answer: true,
            why: 'Each fetch moves the PC past the instruction it just read. Here that instruction is one word, so the step is 1; a real processor adds the instruction’s length in addressable units (on a byte-addressed machine, 4 for a 4-byte instruction). Only control instructions, such as a jump, break the address order.' },
          { type: 'order', q: 'A tiny accumulator machine runs 300: 1940 (load AC from 940), 301: 5941 (add from 941), 302: 2941 (store to 941). Put its six stages in order.',
            items: ['Fetch 1940 from 300 into the IR', 'Load the AC with the word at 940', 'Fetch 5941 from 301 into the IR', 'Add the word at 941 to the AC', 'Fetch 2941 from 302 into the IR', 'Store the AC into 941'],
            why: 'Every instruction cycle is fetch then execute, and the PC walks 300 → 301 → 302 → 303 along the way.' },
          { type: 'bucket', q: 'Sort each instruction into its category: processor–memory (Memory), processor–I/O (I/O), data processing, or control.',
            buckets: ['Memory', 'I/O', 'Data processing', 'Control'],
            items: [['Store the AC into address 941', 0], ['Read a byte from the keyboard module', 1], ['Multiply two registers', 2], ['If the AC is zero, skip the next instruction', 3], ['Shift the AC one bit left', 2]],
            why: 'Transfers with memory, transfers with an I/O module, arithmetic or logic on data, and changes to the order of execution (to the PC) are the four categories.' },
          { type: 'num', q: 'An instruction format has a 4-bit opcode field. How many different opcodes can it express?', answer: 16,
            why: 'Four bits can form 2<sup>4</sup> = 16 different patterns, so at most 16 operations.' },
          { type: 'num', q: 'An instruction format has a 12-bit address field. How many memory words can one instruction address directly?', answer: 4096, unit: 'words',
            why: 'Twelve bits can form 2<sup>12</sup> = 4,096 patterns, often written 4K.' },
          { type: 'num', q: 'A different 16-bit machine uses 6 bits for the opcode and the remaining bits for the address. How many words can an instruction address directly?', answer: 1024, unit: 'words',
            hint: 'How many bits are left for the address?',
            why: '16 − 6 = 10 address bits, and 2<sup>10</sup> = 1,024.' },
          { q: 'On a machine whose opcodes are 1 = load AC, 2 = store AC and 5 = add to AC (the first hex digit of a 16-bit word), what does the word 2941 (hex) do?',
            choices: ['Load the AC from address 941', 'Store the AC into address 941', 'Add the word at 941 to the AC', 'Jump to address 941'], answer: 1,
            feedback: ['Load is opcode 1 (0001); this word starts with 2.', null, 'Add is opcode 5 (0101); this word starts with 2.', 'None of these opcodes is a jump; the leading 2 means store.'],
            why: 'The first hex digit is the 4-bit opcode (2 = 0010 = store AC to memory) and the other three digits are the address, 941.' },
          { type: 'multi', q: 'In a simple accumulator machine, which of these happen during the <b>fetch</b> stage?',
            choices: ['The PC’s value is copied into the MAR', 'The instruction word arrives in the MBR and is moved into the IR', 'The PC is incremented', 'The AC gets a new value', 'A data word is written into memory'], answer: [0, 1, 2],
            why: 'Fetch only brings the instruction in and advances the PC. Changing the AC or writing data to memory happens in the execute stage.' },
          { type: 'match', q: 'An accumulator machine runs 300: 1940 (load AC from 940), 301: 5941 (add from 941), 302: 2941 (store to 941), with 0003 at 940 and 0002 at 941. Match each register to the value it holds right after the <b>second execute</b> (the add).',
            pairs: [['PC', '302'], ['IR', '5941'], ['AC', '0005'], ['MAR', '941'], ['MBR', '0002']],
            why: 'The add was fetched from 301, so the PC has already moved on to 302 and 5941 sits in the IR. To execute it, the MAR carried the address field 941 to memory, the MBR received the operand 0002, and the ALU made AC = 3 + 2 = 0005.' },
          { type: 'num', q: 'A 16-bit data word uses sign-magnitude: 1 sign bit (1 = negative) and a 15-bit magnitude. What decimal value is the word 8005 (hex)?', answer: -5,
            why: '8005 hex is 1000 0000 0000 0101: the sign bit is 1 (negative) and the other 15 bits hold 5, so the value is −5.' },
          { q: 'What is the main benefit of direct memory access (DMA)?',
            choices: ['It makes each instruction cycle shorter', 'An I/O module moves data to or from memory itself, so the processor is freed from the transfer', 'It lets the processor skip the fetch stage', 'It stores programs inside the I/O module'], answer: 1,
            feedback: ['DMA does not change the instruction cycle; it takes the processor out of the copying work.', null, 'Every instruction the processor runs must still be fetched.', 'Programs still live in main memory; DMA is about moving data.'],
            why: 'With DMA the processor only sets up the transfer and is told when it is done; the I/O module moves the words directly to or from memory.' },
        ],
      },
    ],

    notes: `
<h3>1. A program and the instruction cycle</h3>
<p>A <b>program</b> is an ordered list of <b>instructions</b> stored in main memory. The processor runs it by repeating one loop. The work done for a single instruction is called one <b>instruction cycle</b>, and in its simplest form it has two stages:</p>
<ul>
<li><b>Fetch stage:</b> read the next instruction from memory into the processor.</li>
<li><b>Execute stage:</b> <b>decode</b> the instruction (work out what its bits ask for) and carry out that action.</li>
</ul>
<p>Then the next fetch begins automatically. The loop only stops at a <b>halt</b>: the machine is switched off, an error it cannot recover from occurs, or the program executes an instruction that tells the processor to stop.</p>
<p><b>START</b> → <b>FETCH</b> the next instruction → <b>EXECUTE</b> it → back to FETCH … → <b>HALT</b></p>
<p>Section 1.4 adds a third stage after execute, the <b>interrupt stage</b>, in which the processor checks whether a device is asking for attention.</p>
<h3>2. The fetch stage: program counter and instruction register</h3>
<p>Two <b>registers</b> (tiny, very fast storage slots inside the processor) run the fetch:</p>
<ul>
<li>The <b>program counter (PC)</b> holds the <i>address</i> of the next instruction to fetch.</li>
<li>The <b>instruction register (IR)</b> holds the instruction just fetched while it is decoded and executed.</li>
</ul>
<p>At the start of every cycle the processor fetches the instruction whose address is in the PC and places it in the IR. It then increments the PC (by 1 here, since each instruction fills one word; a byte-addressed machine adds the instruction’s length in bytes), so unless something says otherwise, instructions run in address order (100, 101, 102, …). While an instruction executes, the PC already points at the one after it.</p>
<p>A <b>jump</b> is how “otherwise” happens: executing it overwrites the PC with a new address, so the next fetch comes from somewhere else. Loops and if-statements are built this way.</p>
<h3>3. The four categories of instruction</h3>
<table>
<tr><th>Category</th><th>What it does</th><th>Examples</th></tr>
<tr><td>Processor–memory</td><td>Copies data between the processor and main memory, in either direction.</td><td>Load the AC from 940; store the AC into 941.</td></tr>
<tr><td>Processor–I/O</td><td>Copies data between the processor and an I/O module (the circuit that runs a device).</td><td>Send a byte to the printer; read the keyboard’s status.</td></tr>
<tr><td>Data processing</td><td>Performs arithmetic or logic on data.</td><td>Add, subtract, AND, NOT, shift.</td></tr>
<tr><td>Control</td><td>Changes the order of execution by loading a new address into the PC.</td><td>Jump to 500; skip the next instruction if the AC is zero.</td></tr>
</table>
<p>One instruction can combine several categories. “Add the word at 941 to the AC” reads memory (processor–memory) and then adds (data processing).</p>
<h3>4. A hypothetical 16-bit accumulator machine</h3>
<ul>
<li>Memory is a sequence of 16-bit <b>words</b>, each with an address.</li>
<li>Instruction format: a 4-bit <b>opcode</b> (which operation) followed by a 12-bit <b>address field</b> (which memory word).</li>
<li>Data format: 1 sign bit (0 = positive, 1 = negative) followed by a 15-bit magnitude (<b>sign-magnitude</b>).</li>
<li>Registers: PC, IR, and one <b>accumulator (AC)</b> that holds the data being worked on. PC and MAR hold 12-bit addresses; IR, AC and MBR hold 16-bit words.</li>
</ul>
<table>
<tr><th>Opcode (binary)</th><th>Hex</th><th>Meaning</th></tr>
<tr><td>0001</td><td>1</td><td>Load AC from memory</td></tr>
<tr><td>0010</td><td>2</td><td>Store AC to memory</td></tr>
<tr><td>0101</td><td>5</td><td>Add to AC from memory</td></tr>
</table>
<p><b>Capacity:</b> 4 opcode bits give 2<sup>4</sup> = 16 different opcodes. 12 address bits give 2<sup>12</sup> = 4,096 (4K) directly addressable words. In general, k bits give 2<sup>k</sup> patterns; a 16-bit instruction with a 6-bit opcode would leave 10 address bits, reaching 2<sup>10</sup> = 1,024 words.</p>
<p><b>Hexadecimal</b> is used because each hex digit is exactly four bits. So the first hex digit of an instruction word is its opcode and the last three are its address. Worked example: 1940 hex = 0001 1001 0100 0000 → opcode 0001 (load AC), address 940. Note that 940 is hex: 9×256 + 4×16 = 2,368 in decimal. As a data word, 8005 hex = 1000 0000 0000 0101 → sign 1 (negative), magnitude 5, value −5.</p>
<p>Memory cannot tell instructions from data. A word acts as an instruction when the PC fetches it, and as data when an instruction’s address field points at it. One consequence: a store whose address points into the program area overwrites an instruction, so the program changes itself. The next time the PC reaches that cell, the processor fetches and runs the new word, not the one the programmer wrote.</p>
<h3>5. Tracing the example program (3 + 2)</h3>
<p>Memory before the run: program at 300: <b>1940</b>, 301: <b>5941</b>, 302: <b>2941</b>; data at 940: <b>0003</b>, 941: <b>0002</b>. The PC starts at 300. Three instruction cycles make six stages ([x] means “the word stored at address x”):</p>
<table>
<tr><th>#</th><th>Stage</th><th>What happens</th><th>PC</th><th>IR</th><th>AC</th><th>941</th></tr>
<tr><td>1</td><td>Fetch</td><td>[300] → IR</td><td>301</td><td>1940</td><td>–</td><td>0002</td></tr>
<tr><td>2</td><td>Execute</td><td>Load: AC ← [940]</td><td>301</td><td>1940</td><td>0003</td><td>0002</td></tr>
<tr><td>3</td><td>Fetch</td><td>[301] → IR</td><td>302</td><td>5941</td><td>0003</td><td>0002</td></tr>
<tr><td>4</td><td>Execute</td><td>Add: AC ← AC + [941]</td><td>302</td><td>5941</td><td>0005</td><td>0002</td></tr>
<tr><td>5</td><td>Fetch</td><td>[302] → IR</td><td>303</td><td>2941</td><td>0005</td><td>0002</td></tr>
<tr><td>6</td><td>Execute</td><td>Store: [941] ← AC</td><td>303</td><td>2941</td><td>0005</td><td>0005</td></tr>
</table>
<p>Result: cell 941 holds 0005 and the PC holds 303. The PC went 300 → 301 → 302 → 303, one step per fetch, and only cell 941 changed. Notice that right after the second fetch the PC is already 302 while 5941 waits in the IR: an instruction stays in the IR until the next fetch replaces it.</p>
<h4>The MAR and MBR inside each stage</h4>
<p>The processor talks to memory through two more registers. The <b>memory address register (MAR)</b> holds the address about to be read or written; the <b>memory buffer register (MBR)</b> holds the word just read, or about to be written.</p>
<ul>
<li><b>Fetch:</b> MAR ← PC; memory sends the addressed word into the MBR; IR ← MBR; PC ← PC + 1.</li>
<li><b>Execute a load or add:</b> MAR ← address field of the IR; memory sends the operand into the MBR; then AC ← MBR (load), or the <b>arithmetic logic unit (ALU)</b> computes AC ← AC + MBR (add).</li>
<li><b>Execute a store:</b> MAR ← address field; MBR ← AC; memory writes the MBR’s word at that address.</li>
</ul>
<p>Counting memory traffic in the example: 5 reads (3 instruction fetches plus 2 operand reads, from 940 and 941) and 1 write (the store into 941).</p>
<h3>6. Moving data to and from I/O</h3>
<p>Processor–I/O instructions exchange data <b>directly between the processor and an I/O module</b>. They work like a load or store, except that they name a device (an I/O address) instead of a memory cell. For large transfers this is wasteful: every word costs the processor whole instruction cycles (an input instruction plus a store).</p>
<p>With <b>direct memory access (DMA)</b>, the processor instead lets the I/O module read from or write to main memory itself. The processor sends one command to set up the transfer, the I/O module moves the words, and it tells the processor when it is finished (using an interrupt, covered in section 1.4). The processor is relieved of the transfer and keeps executing other instructions. Section 1.7 covers DMA in detail.</p>
<h3>Common mistakes</h3>
<ul>
<li>Thinking the PC points at the instruction currently running. It already points at the next one.</li>
<li>Calling a jump “data processing”. It changes the PC, so it is a control instruction.</li>
<li>Thinking the loop needs help to continue. After every execute, the next fetch starts by itself; only a halt stops it.</li>
</ul>`,
  });
})();
