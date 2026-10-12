/* =====================================================================
   11.2 Organization of the I/O Function
   Original teaching material. Shared models (the technique race, the DMA
   transfer, the bus-cycle counts) and small drawing helpers live inside
   this IIFE (no globals).
   ===================================================================== */
(function () {
  /* ---------- the three-technique race (step 3) ----------
     Time is counted in ticks. Per word: programmed I/O = 1 tick to send the
     command + D ticks of polling + 1 tick to move the word. Interrupt-driven
     = 1 command tick, D ticks of other work, H ticks of interrupt overhead,
     1 tick to move the word (the next command is sent from the handler).
     DMA = 4 setup ticks (one per item), then the device delivers a word every
     D ticks and the DMA module steals the last tick of each period (worst
     case: the processor needed the bus then), then one completion interrupt. */
  const SETUP = 4;
  function race(kind, N, D, H) {
    const a = [];
    const push = (k, n) => { for (let i = 0; i < n; i++) a.push(k); };
    let ints = 0;
    if (kind === 'pio') for (let w = 0; w < N; w++) { push('cmd', 1); push('poll', D); push('move', 1); }
    if (kind === 'int') {
      push('cmd', 1);
      for (let w = 0; w < N; w++) { push('free', D); push('int', H); ints++; push('move', 1); if (w < N - 1) push('cmd', 1); }
    }
    if (kind === 'dma') { push('cmd', SETUP); for (let w = 0; w < N; w++) { push('free', D - 1); push('pause', 1); } push('int', H); ints++; }
    const c = (k) => a.filter((x) => x === k).length;
    return { acts: a, end: a.length, free: c('free'), io: a.length - c('free'), ints, pause: c('pause'), poll: c('poll'), viaCpu: kind === 'dma' ? 0 : N };
  }

  /* ---------- one DMA block transfer, cycle by cycle (step 5) ----------
     Memory has 32 words: 0-7 kernel, 8-23 P1's locked buffer, 24-31 P2's data.
     Cycles 0-3: the processor writes the four items. From cycle 4 P2 runs; the device
     handles one word every DEV cycles; the DMA module steals one bus cycle per word.
     P2 pauses only when the stage it is on needs the bus in a stolen cycle. */
  const DEV = 3, BUF = [8, 23];
  const STAGE = { F: ['fetch an instruction', 1, 'fetch instruction'], D: ['decode it', 0, 'decode'], O: ['fetch an operand', 1, 'fetch operand'], X: ['execute', 0, 'execute'], W: ['write a result to memory', 1, 'write result'] };
  const MIX = ['FDX', 'FDOX', 'FDXW', 'FDX', 'FDOXW', 'FDOX'];
  const DEVDATA = { 3: 'FROMDISK', 5: 'FROM-NET' }, DEVNAME = { 3: 'Disk', 5: 'Network card' };
  function dmaCheck(f) {
    const end = f.start + f.n - 1;
    if (end > 31) return `The block would need words up to ${end}, but memory ends at 31.`;
    if (f.start < BUF[0]) return `Words ${f.start}–${Math.min(end, 7)} hold <b>kernel code</b>. ${f.op === 'READ' ? 'Reading the device into them would overwrite the OS itself.' : 'Sending them to a device would leak the kernel.'}`;
    if (end > BUF[1]) return `Words ${Math.max(f.start, 24)}–${end} belong to <b>P2</b>. ${f.op === 'READ' ? 'The DMA module would overwrite P2’s data.' : 'P1 would be sending another process’s data.'}`;
    return '';
  }
  function dmaRun(f) {
    const stream = []; MIX.forEach((m) => stream.push(...m.split(''))); while (stream.length < 80) stream.push(...stream.slice(0, 18));
    const mem = []; for (let a = 0; a < 32; a++) mem.push(a < 8 ? 'k' : a > 23 ? 'p' : f.op === 'WRITE' ? 'OUTGOING-MESSAGE'[a - 8] : '·');
    const st = { reg: { op: '', dev: '', addr: '', count: '' }, mem, got: '', cyc: [], stolen: 0, paused: 0, words: 0, ints: 0, hot: -1, cur: -1, cpu: ['P1 running (OS code)', 'cpu', 'about to set up DMA'], devTxt: 'idle', p: 0 };
    const snap = (cap) => JSON.parse(JSON.stringify(Object.assign({}, st, { cap })));
    const frames = [snap('Nothing sent yet. This DMA logic sits beside the device, so each word needs just one bus cycle. Press ▶ or Next to watch the setup, then the transfer, one cycle per frame.')];
    const E = 4 + DEV * f.n, data = DEVDATA[f.dev], dname = DEVNAME[f.dev].toLowerCase();
    const items = [['op', f.op, `the direction, <b>${f.op}</b> (${f.op === 'READ' ? 'device → memory' : 'memory → device'})`], ['dev', '#' + f.dev, `the device address, <b>#${f.dev}</b> (${dname})`],
      ['addr', String(f.start), `the start address <b>${f.start}</b> into the address register`], ['count', String(f.n), `the word count <b>${f.n}</b> into the count register`]];
    for (let c = 0; c <= E; c++) {
      let cap, rec;
      st.hot = -1;
      if (c < 4) {
        const [k, v, txt] = items[c];
        st.reg[k] = v; if (c === 2) st.cur = f.start;
        st.cpu = ['setting up DMA', 'cpu', `item ${c + 1} of 4, for P1`];
        rec = { owner: 'P', proc: 'S', paused: false };
        cap = `<b>Cycle ${c}.</b> The processor, running OS code for P1, writes ${txt}. Setup uses the bus like any other write.`;
        if (c === 3) { st.devTxt = f.op === 'READ' ? 'reading word 1' : 'waiting for word 1'; cap += ' Setup done: the OS now blocks P1 and dispatches P2 (switch time not shown).'; }
      } else if (c < E) {
        const k = c - 4, wordNo = Math.floor(k / DEV) + 1;
        const steal = f.op === 'READ' ? k % DEV === DEV - 1 : k % DEV === 0;
        const sg = stream[st.p], [what, bus, short] = STAGE[sg];
        const paused = steal && !!bus;
        if (paused) st.paused++; else st.p++;
        let busTxt = '';
        if (steal) {
          const a = f.start + wordNo - 1;
          st.stolen++; st.hot = a; st.words = wordNo;
          if (f.op === 'READ') { st.mem[a] = data[wordNo - 1]; busTxt = `The ${dname} has word ${wordNo} ready. The DMA module takes the bus for this one cycle and writes “${data[wordNo - 1]}” into memory[${a}].`; }
          else { busTxt = `The DMA module takes the bus for this one cycle and reads memory[${a}] (“${st.mem[a]}”) for the ${dname}.`; st.got += st.mem[a]; }
          st.reg.addr = String(a + 1); st.reg.count = String(f.n - wordNo); st.cur = wordNo < f.n ? a + 1 : -1;
          busTxt += ` Address register → ${a + 1}, count register → ${f.n - wordNo}.`;
          st.devTxt = f.op === 'READ' ? (wordNo < f.n ? 'reading word ' + (wordNo + 1) : 'done') : 'writing word ' + wordNo;
        } else st.devTxt = f.op === 'READ' ? 'reading word ' + wordNo : 'writing word ' + st.words;
        st.cpu = paused ? ['P2 paused', 'warn', 'needs bus: ' + short] : ['P2 running', 'proc', short];
        rec = { owner: steal ? 'D' : bus ? 'P' : '-', proc: paused ? '‖' : sg, paused };
        cap = `<b>Cycle ${c}.</b> ` + (steal ? busTxt + (paused ? ` P2 needed the bus to <b>${what}</b>, so it simply waits this one cycle: no context is saved and no interrupt happens.` : ` P2 only had to <b>${what}</b>, which happens inside the processor, so this steal cost it nothing.`)
          : `P2 runs: <b>${what}</b>${bus ? ' (it uses the bus)' : ' (no bus needed)'}. The ${dname} is ${st.devTxt}.`);
      } else {
        st.ints = 1; st.devTxt = 'done';
        st.cpu = ['interrupt', 'intr', 'handler: P1 → Ready'];
        rec = { owner: '-', proc: 'I', paused: false };
        cap = `<b>Count is 0.</b> The DMA module raises <b>one</b> completion interrupt. The handler checks the DMA status and moves P1 to Ready. Totals: ${f.n} word${f.n > 1 ? 's' : ''}, ${st.stolen} stolen cycle${st.stolen > 1 ? 's' : ''}, P2 paused ${st.paused} time${st.paused === 1 ? '' : 's'}, 4 setup cycles, 1 interrupt.`;
      }
      st.cyc.push(rec);
      frames.push(snap(cap));
    }
    return frames;
  }

  /* ---------- the requesting process's view (step 2) ----------
     Each frame: who is Running, Ready, Blocked; which transition arrows light up;
     what the processor and the I/O hardware are doing; words in P1's buffer; interrupts so far. */
  const F = (run, ready, blocked, arrow, cpu, io, mem, ints, cap) => ({ run, ready, blocked, arrow, cpu, io, mem, ints, cap });
  const PV = {
    pio: [
      F('P1', ['P2'], [], [], ['OS code for P1: send READ (word 1)', 'cpu'], ['reading word 1', 'io'], 0, 0, '<b>P1 calls read() for 2 words.</b> The OS code runs on P1’s behalf and sends the first read command to the I/O module. (Blocking or not makes no difference here: the processor itself will be stuck polling.)'),
      F('P1', ['P2'], [], [], ['polling: status? busy … busy … busy', 'warn'], ['reading word 1', 'io'], 0, 0, '<b>Busy waiting.</b> The processor reads the status register again and again. P1 stays Running (the spinning is charged to it) and P2 waits in Ready, although the processor achieves nothing.'),
      F('P1', ['P2'], [], [], ['ready: copy word 1 to memory, send READ', 'mem'], ['reading word 2', 'io'], 1, 0, 'The status finally says ready. The processor copies word 1 from the module’s data register into P1’s buffer and sends the next command.'),
      F('P1', ['P2'], [], [], ['polling again: busy … busy … busy', 'warn'], ['reading word 2', 'io'], 1, 0, 'The loop starts over for word 2. Every word costs one full device wait of processor time.'),
      F('P1', ['P2'], [], [], ['ready: copy word 2 to memory', 'mem'], ['idle', 'muted'], 2, 0, 'Word 2 is copied. The block is complete, and not a single interrupt was used.'),
      F('P1', ['P2'], [], [], ['P1 carries on with its data', 'proc'], ['idle', 'muted'], 2, 0, '<b>read() returns.</b> P2 never got the processor. A timer interrupt could have let P2 run for a while, but P1 would go back to spinning afterwards: the waiting time is wasted either way.'),
    ],
    int: [
      F('P1', ['P2'], [], [], ['OS code for P1: send READ (word 1)', 'cpu'], ['reading word 1', 'io'], 0, 0, '<b>P1 calls read() for 2 words.</b> The OS sends the first read command. This is a <span class="t">blocking system call</span>: P1 cannot go on until the data arrives.'),
      F('P2', [], ['P1'], ['blk', 'disp'], ['OS: P1 → Blocked, dispatch P2', 'os'], ['reading word 1', 'io'], 0, 0, 'Because P1 must wait, the next instructions the processor runs are the OS’s: it moves P1 to the <span class="t">Blocked state</span> and dispatches P2 (a <span class="t">process switch</span>).'),
      F('P2', [], ['P1'], [], ['P2 does useful work', 'proc'], ['reading word 1', 'io'], 0, 0, 'The device works and the processor runs P2. Nobody polls.'),
      F('P2', [], ['P1'], [], ['I/O interrupt: copy word 1, send READ', 'intr'], ['reading word 2', 'io'], 1, 1, '<b>Interrupt.</b> P2’s context is saved, the <span class="t">interrupt handler</span> copies word 1 into P1’s buffer and sends the next command, then P2 resumes. P1 stays Blocked: its request is only half done.'),
      F('P2', [], ['P1'], [], ['P2 does useful work', 'proc'], ['reading word 2', 'io'], 1, 1, 'P2 carries on while the device fetches word 2.'),
      F('P2', ['P1'], [], ['wake'], ['I/O interrupt: copy word 2; P1 → Ready', 'intr'], ['idle', 'muted'], 2, 2, 'Second interrupt: word 2 is copied and the request is complete, so the OS moves P1 from Blocked to <span class="t">Ready</span>. Two words cost two interrupts.'),
      F('P1', ['P2'], [], ['pre', 'disp'], ['P1: read() returns with its data', 'proc'], ['idle', 'muted'], 2, 2, 'Later the scheduler picks P1 again (when exactly depends on the scheduling policy of chapter 9). read() returns and P1 uses its data.'),
    ],
    intNB: [
      F('P1', ['P2'], [], [], ['OS code for P1: send READ (word 1)', 'cpu'], ['reading word 1', 'io'], 0, 0, '<b>P1 makes an <span class="t">asynchronous I/O request</span>.</b> The OS sends the first read command and returns to P1 at once; the transfer goes on without P1.'),
      F('P1', ['P2'], [], [], ['P1 keeps doing its own work', 'proc'], ['reading word 1', 'io'], 0, 0, 'P1 keeps running. It must not use its buffer yet: the data is not there.'),
      F('P1', ['P2'], [], [], ['I/O interrupt: copy word 1, send READ', 'intr'], ['reading word 2', 'io'], 1, 1, '<b>Interrupt.</b> The handler copies word 1 and sends the next command, then P1 resumes where it was.'),
      F('P1', ['P2'], [], [], ['P1 keeps doing its own work', 'proc'], ['reading word 2', 'io'], 1, 1, 'P1 works on while the device fetches word 2.'),
      F('P1', ['P2'], [], [], ['I/O interrupt: copy word 2; mark done', 'intr'], ['idle', 'muted'], 2, 2, 'The second interrupt completes the request. The OS records that it is done, for example by setting a flag or queuing a notification for P1.'),
      F('P1', ['P2'], [], [], ['P1 sees “done” and uses its data', 'proc'], ['idle', 'muted'], 2, 2, 'P1 checks, sees the request has finished and uses the data. P1 never blocked, but the processor still took one interrupt per word.'),
    ],
    dma: [
      F('P1', ['P2'], [], [], ['OS code for P1: give DMA its 4 items', 'cpu'], ['armed; device reading word 1', 'accent'], 0, 0, '<b>P1 calls read() for 2 words.</b> The OS gives the DMA module four items: read, which device, where in memory, how many words. That is the whole setup.'),
      F('P2', [], ['P1'], ['blk', 'disp'], ['OS: P1 → Blocked, dispatch P2', 'os'], ['device reading word 1', 'accent'], 0, 0, 'P1 must wait, so the OS blocks it and dispatches P2, exactly as with interrupt-driven I/O.'),
      F('P2', [], ['P1'], [], ['P2 runs (1 bus cycle borrowed)', 'proc'], ['word 1 → memory', 'accent'], 1, 0, 'The DMA module writes word 1 straight into P1’s buffer, borrowing the bus for one cycle (<span class="t">cycle stealing</span>). No interrupt, no saved context: at worst P2 pauses for that one cycle.'),
      F('P2', [], ['P1'], [], ['P2 runs (1 bus cycle borrowed)', 'proc'], ['word 2 → memory; count = 0', 'accent'], 2, 0, 'Word 2 goes the same way. The processor has still not touched a single word.'),
      F('P2', ['P1'], [], ['wake'], ['completion interrupt: P1 → Ready', 'intr'], ['done', 'muted'], 2, 1, 'Only now does the DMA module interrupt: once, for the whole block. The handler checks the status and moves P1 to Ready.'),
      F('P1', ['P2'], [], ['pre', 'disp'], ['P1: read() returns with its data', 'proc'], ['done', 'muted'], 2, 1, 'When P1 is dispatched, its data is already in memory. One interrupt per block, however many words it holds.'),
    ],
    dmaNB: [
      F('P1', ['P2'], [], [], ['OS code for P1: give DMA its 4 items', 'cpu'], ['armed; device reading word 1', 'accent'], 0, 0, '<b>P1 makes an asynchronous request.</b> The OS gives the DMA module its four items and returns to P1 at once, before any data has moved.'),
      F('P1', ['P2'], [], [], ['P1 runs (1 bus cycle borrowed)', 'proc'], ['word 1 → memory', 'accent'], 1, 0, 'P1 keeps working while the DMA module stores word 1 by stealing one bus cycle.'),
      F('P1', ['P2'], [], [], ['P1 runs (1 bus cycle borrowed)', 'proc'], ['word 2 → memory; count = 0', 'accent'], 2, 0, 'Word 2 follows. Still no interrupt.'),
      F('P1', ['P2'], [], [], ['completion interrupt: mark done', 'intr'], ['done', 'muted'], 2, 1, 'One completion interrupt. The OS records that P1’s request has finished.'),
      F('P1', ['P2'], [], [], ['P1 sees “done” and uses its data', 'proc'], ['done', 'muted'], 2, 1, 'P1 checks, sees the request finished and uses the data: one interrupt for the block, and P1 never stopped.'),
    ],
  };

  Guide.section({
    id: '11.2',
    title: 'Organization of the I/O Function',
    short: 'Organizing I/O',
    summary: 'Three I/O techniques seen by the OS, six steps that freed the processor, and how DMA uses the bus.',
    objectives: [
      'Compare programmed I/O, interrupt-driven I/O and DMA by what the processor and the requesting process do while a block moves.',
      'Place each technique in the two-question classification: interrupts or not, through the processor or straight to memory.',
      'Trace the six-step evolution of the I/O function, from direct device control to I/O processors.',
      'Set up a DMA transfer with its four parameters and explain when cycle stealing makes the processor pause.',
      'Count system-bus transfers per word for the detached, integrated and I/O-bus DMA configurations.',
    ],
    terms: [
      ['I/O controller (device controller)', 'A simple I/O module: circuitry that drives one kind of device, turning short commands from the processor into the exact signals and timing that device needs.'],
      ['Asynchronous I/O request', 'An I/O request that starts the transfer and returns at once. The OS finishes the transfer in the background and later reports that it is done (a flag, an event or a signal); until then the process must not use its buffer.'],
      ['Nonblocking I/O call', 'A call that never makes the caller wait: it returns at once with whatever it could do right now, perhaps only part of the data, or a “would block” error (EAGAIN) if nothing was ready. It leaves no transfer running, so the program simply calls again later.'],
      ['Interrupt overhead', 'The processor time an interrupt costs on top of the useful work it leads to: saving the context, finding the cause, entering and leaving the handler, and restoring the context.'],
      ['I/O channel', 'An I/O module that is a small processor with its own specialized instruction set. It fetches and runs an I/O program stored in main memory, so it can carry out a whole sequence of I/O operations without the CPU.'],
      ['I/O program (channel program)', 'A list of I/O instructions that the OS places in main memory for an I/O channel to execute, for example: seek, read a block, check the result, read the next block.'],
      ['I/O processor', 'An I/O module with its own processor and its own local memory: a small computer in its own right that runs the day-to-day control of many devices with very little help from the CPU.'],
      ['Local memory', 'Memory that belongs to an I/O processor itself, separate from main memory, where it keeps its own programs and data buffers.'],
      ['Single-bus detached DMA', 'A DMA configuration in which the processor, memory, the DMA module and the I/O modules all share one system bus, so each word crosses that bus twice: I/O module → DMA module, then DMA module → memory (the reverse for output).'],
      ['Single-bus integrated DMA-I/O', 'A DMA configuration in which the DMA logic is built into an I/O module or wired to one or more I/O modules by a private path, so each word crosses the system bus only once.'],
      ['I/O bus', 'A separate bus that links many I/O modules to one DMA module. Words reach the DMA module without touching the system bus, the DMA module needs only one I/O-side connection, and a new device just plugs into the I/O bus.'],
      ['Bus master', 'A device that can take control of a bus and start its own transfers. Most modern devices (for example on PCI Express) contain their own DMA logic and act as bus masters.'],
      ['IOMMU', 'Hardware between devices and main memory that translates and checks the addresses a device uses for DMA, so a device can reach only the memory the OS has granted to it.'],
    ],
    css: `
      .sec-11-2 .mw0 > * { min-width: 0; }
      .sec-11-2 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; }
      .sec-11-2 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-11-2 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-11-2 .chores { margin: 0; padding-left: 22px; }
      .sec-11-2 .chores li { margin: 3px 0; }
      .sec-11-2 .cls { display: grid; grid-template-columns: 132px minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
      .sec-11-2 .cls .hd { font-size: 13.5px; font-weight: 750; color: var(--ink-2); display: flex; align-items: center; justify-content: center; text-align: center; padding: 4px 6px; background: var(--panel-3); border-radius: 10px; line-height: 1.3; }
      .sec-11-2 .cls .cell { min-height: 74px; border-radius: 12px; border: 2px solid var(--line-2); background: var(--panel); font: inherit; font-weight: 800; font-size: 16px; cursor: pointer; color: var(--ink); padding: 6px 8px; line-height: 1.25; }
      .sec-11-2 .cls .cell small { display: block; font-weight: 600; font-size: 13px; color: var(--muted); margin-top: 3px; }
      .sec-11-2 .cls .cell.pio { border-color: var(--warn); }
      .sec-11-2 .cls .cell.int { border-color: var(--intr); }
      .sec-11-2 .cls .cell.dma { border-color: var(--accent); }
      .sec-11-2 .cls .cell.none { border-style: dashed; color: var(--muted); }
      .sec-11-2 .cls .cell:hover { background: var(--panel-2); }
      .sec-11-2 .cls .cell.on { background: var(--accent-bg); box-shadow: 0 0 0 3px var(--hl); }
    `,
    steps: [
      /* ============ 1. Big picture + the two-question classification ============ */
      {
        title: 'Who does the I/O work?',
        kind: 'story',
        render(el, ctx) {
          const { h } = ctx;
          const CELLS = {
            pio: ['Programmed I/O', 'No interrupts, and every word passes through the processor. The processor sends a command, then reads the module’s <span class="t">status register</span> in a loop (<span class="t">busy waiting</span>) until the word is ready, and copies the word itself. Simple hardware, wasted processor time.', ''],
            int: ['Interrupt-driven I/O', 'The I/O module raises an <span class="t">interrupt</span> when it is ready, so the processor can do other work instead of polling. But every word still passes through a processor register, and every word costs one interrupt.', ''],
            none: ['The empty corner', 'Direct transfer with no interrupts is not one of the three standard techniques: polling for the end of a block puts the processor back to checking a status bit. The classic design pairs direct transfer with one completion interrupt. (Some very fast modern devices are polled for completion, when checking costs less than taking an interrupt.)', 'bad'],
            dma: ['Direct memory access (DMA)', 'A <span class="t">DMA module</span> moves the whole block straight between the I/O module and memory, borrowing the bus one cycle at a time. The processor works only at the start (four parameters) and at the end (one interrupt).', 'ok'],
          };
          const say = h('div', { class: 'narr', html: '<b>Click a cell.</b> Each technique answers two yes/no questions: does the I/O module interrupt the processor, and does the data travel through the processor or straight to memory?' });
          const btns = {};
          const cell = (k, label, sub) => (btns[k] = h('button', { class: 'cell ' + k, type: 'button', onclick: () => pick(k) }, label, h('small', {}, sub)));
          function pick(k) {
            Object.entries(btns).forEach(([kk, b]) => b.classList.toggle('on', kk === k));
            const [t, txt, tone] = CELLS[k];
            say.className = 'narr' + (tone ? ' ' + tone : '');
            say.innerHTML = '<b>' + t + '.</b> ' + txt;
          }
          const grid = h('div', { class: 'cls' },
            h('div', {}), h('div', { class: 'hd' }, 'No interrupts'), h('div', { class: 'hd' }, 'Uses interrupts'),
            h('div', { class: 'hd' }, 'Data goes through the processor'), cell('pio', 'Programmed I/O', 'processor polls'), cell('int', 'Interrupt-driven I/O', 'one interrupt per word'),
            h('div', { class: 'hd' }, 'Data goes straight to memory'), cell('none', '(no standard technique)', 'why is it empty?'), cell('dma', 'DMA', 'one interrupt per block'));
          el.append(h('div', { class: 'split l fill mw0' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'lead m0', html: 'Every I/O operation needs the same four chores done. Deciding <b>which hardware does each chore</b> is what organizing the I/O function means.' }),
              h('ol', { class: 'chores', html: '<li><b>Command</b> the device: tell it what to do.</li><li><b>Wait</b> until the device is ready.</li><li><b>Carry</b> each word between the device and memory.</li><li><b>Notice</b> that the whole job is finished.</li>' }),
              h('p', { class: 'm0 small', html: 'Chapter 1 (section 1.7) showed the three classic answers inside the hardware. Here you add the operating system’s view: what happens to the <span class="t">process</span> that asked, how hardware took the chores away from the processor one by one, and how many bus cycles a DMA design costs.' }),
              h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'Forty boxes are coming from a warehouse. You can stand at the loading dock and watch for each box (programmed I/O), go back to your desk and walk down each time the dock bell rings (interrupt-driven), or give a forklift driver a slip that says <i>bring in, from which supplier, to which shelf, how many</i> and get one call when all forty are shelved (DMA).' })),
            h('div', { class: 'card white stack', style: { gap: '12px', alignSelf: 'start' } },
              h('h3', { class: 'm0' }, 'Two questions sort the techniques'),
              grid, say,
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Every chore the hardware takes over is processor time handed back to running programs. That is the thread running through this whole section.' }))));
        },
      },
      /* ============ 2. The OS view: what happens to the process that asked ============ */
      {
        title: 'What happens to the process that asked?',
        kind: 'learn',
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          /* geometry: wide = three state boxes side by side; slim = stacked */
          const G = slim ? {
            vb: '0 0 360 470', fs: 15, ts: 14,
            box: { Ready: [46, 4, 300, 76], Running: [46, 120, 300, 76], Blocked: [46, 236, 300, 76] }, tw: 70, th: 30, ty: 50, tdx: 80,
            arr: { disp: [[150, 82], [150, 118], 158, 105, 'start'], pre: [[250, 118], [250, 82], 258, 105, 'start'], blk: [[150, 198], [150, 234], 158, 221, 'start'] },
            wake: ['M46,274 C10,274 10,42 46,42', 12, 160, 'rotate(-90 12 160)'],
            cpuBox: [6, 322, 348, 70], ioBox: [6, 398, 348, 68], line1: 20, line2: 44, line3: 62, buf: [272, 30, 34], bufY: 8,
          } : {
            vb: '0 0 1100 238', fs: 17, ts: 16,
            box: { Ready: [20, 6, 300, 104], Running: [400, 6, 300, 104], Blocked: [780, 6, 300, 104] }, tw: 92, th: 40, ty: 64, tdx: 108,
            arr: { disp: [[322, 38], [398, 38], 360, 26, 'middle'], pre: [[398, 84], [322, 84], 360, 102, 'middle'], blk: [[702, 58], [778, 58], 740, 46, 'middle'] },
            wake: ['M930,110 C930,130 170,130 170,110', 550, 139, null],
            cpuBox: [20, 148, 520, 88], ioBox: [580, 148, 500, 88], line1: 22, line2: 52, line3: 76, buf: [930, 40, 50], bufY: 28,
          };
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Process states of P1 and P2, and what the processor and the I/O hardware are doing' });
          const BOXCLS = { Ready: 's-panel', Running: 's-cpu', Blocked: 's-warn' };
          const LBL = { disp: 'dispatch', pre: 'preempt', blk: 'block' };
          let tech = 'pio', blocking = true;
          const frames = () => PV[tech === 'pio' ? 'pio' : tech + (blocking ? '' : 'NB')];
          function draw(f) {
            const n = [];
            const where = { Ready: f.ready, Running: f.run ? [f.run] : [], Blocked: f.blocked };
            Object.entries(G.box).forEach(([name, [x, y, w, hh]]) => {
              n.push(s('rect', { x, y, width: w, height: hh, rx: 14, class: BOXCLS[name], 'stroke-width': 2 }));
              n.push(s('text', { x: x + 12, y: y + 24, 'font-size': G.fs, 'font-weight': 800 }, name));
              const list = where[name], cx0 = x + w / 2 - ((list.length - 1) * G.tdx) / 2 + (slim ? 40 : 0);
              list.forEach((p, i) => {
                const cx = cx0 + i * G.tdx;
                n.push(s('rect', { x: cx - G.tw / 2, y: y + G.ty - G.th / 2, width: G.tw, height: G.th, rx: 9, class: p === 'P1' ? 's-proc' : 's-panel', 'stroke-width': p === 'P1' ? 3 : 2 }));
                n.push(s('text', { x: cx, y: y + G.ty + 6, 'text-anchor': 'middle', 'font-size': G.fs, 'font-weight': 800, style: p === 'P1' ? 'fill:var(--proc)' : null }, p));
              });
            });
            Object.entries(G.arr).forEach(([k, [a, b, lx, ly, anc]]) => {
              const on = f.arrow.includes(k);
              n.push(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: on ? '' : 's-muted', style: on ? 'stroke:var(--accent);stroke-width:4' : null, 'marker-end': on ? 'url(#arr-accent)' : 'url(#arr-muted)' }));
              n.push(s('text', { x: lx, y: ly, 'text-anchor': anc, 'font-size': 13, class: on ? '' : 's-sub', style: on ? 'fill:var(--accent);font-weight:800' : null }, LBL[k]));
            });
            const wOn = f.arrow.includes('wake');
            n.push(s('path', { d: G.wake[0], fill: 'none', class: wOn ? '' : 's-muted', style: wOn ? 'stroke:var(--accent);stroke-width:4;fill:none' : null, 'marker-end': wOn ? 'url(#arr-accent)' : 'url(#arr-muted)' }));
            n.push(s('text', { x: G.wake[1], y: G.wake[2], 'text-anchor': 'middle', 'font-size': 13, transform: G.wake[3] || null, class: wOn ? '' : 's-sub', style: wOn ? 'fill:var(--accent);font-weight:800' : null }, 'request done'));
            const panel = (bx, title, act, tone, extra) => {
              const [x, y, w, hh] = bx;
              n.push(s('rect', { x, y, width: w, height: hh, rx: 12, class: 's-panel', 'stroke-width': 1.5 }));
              n.push(s('text', { x: x + 12, y: y + G.line1, 'font-size': G.ts - 1, 'font-weight': 800, class: 's-sub' }, title));
              n.push(s('text', { x: x + 12, y: y + G.line2, 'font-size': G.ts, 'font-weight': 700, style: `fill:var(--${tone})` }, act));
              if (extra) n.push(s('text', { x: x + 12, y: y + G.line3, 'font-size': 13, class: 's-sub' }, extra));
            };
            panel(G.cpuBox, 'PROCESSOR', f.cpu[0], f.cpu[1], 'interrupts so far: ' + f.ints);
            panel(G.ioBox, tech === 'dma' ? 'DMA MODULE + I/O MODULE' : 'I/O MODULE', f.io[0], f.io[1], slim ? null : 'P1’s buffer in memory →');
            const [bx0, bw, bstep] = G.buf;
            for (let i = 0; i < 2; i++) {
              const x = bx0 + i * bstep, y = G.ioBox[1] + G.bufY, full = i < f.mem;
              n.push(s('rect', { x, y, width: bw, height: bw, rx: 7, class: full ? 's-mem' : 's-panel', 'stroke-width': 2, style: full ? null : 'stroke-dasharray:4 3' }));
              n.push(s('text', { x: x + bw / 2, y: y + bw / 2 + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: full ? '' : 's-sub', style: full ? 'fill:var(--mem)' : null }, full ? 'w' + (i + 1) : '–'));
            }
            svg.replaceChildren(...n);
          }
          const player = ctx.ui.player({ count: frames().length, interval: 2600, render: (i) => { const f = frames()[i]; draw(f); return f.cap; } });
          function changed() {
            player.stop(); player.setCount(frames().length); player.go(0);
          }
          const techSeg = ctx.ui.seg([{ value: 'pio', label: 'Programmed I/O' }, { value: 'int', label: 'Interrupt-driven' }, { value: 'dma', label: 'DMA' }], tech, (v) => { tech = v; syncCall(); changed(); });
          const callSeg = ctx.ui.seg([{ value: 1, label: 'Blocking request' }, { value: 0, label: 'Asynchronous request' }], 1, (v) => { blocking = !!v; changed(); });
          function syncCall() {
            const asyncBtn = callSeg.querySelectorAll('button')[1];
            asyncBtn.disabled = tech === 'pio';
            asyncBtn.title = tech === 'pio' ? 'In this programmed-I/O example the requesting process itself polls the device, so it can only wait: choose Interrupt-driven or DMA to see an asynchronous request' : '';
            if (tech === 'pio' && !blocking) { blocking = true; callSeg.set(1); }
          }
          syncCall();
          changed();
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { gap: '10px 16px' } }, techSeg, callSeg),
            h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),
            player.el,
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'The <b>request type</b>, not the technique, decides whether the process waits. Blocking: it moves to Blocked. Asynchronous: it runs on and is told later. (A <span class="t">nonblocking I/O call</span> just returns what is ready, maybe nothing, and starts no transfer.) Only programmed I/O keeps the processor waiting.' })));
        },
      },
      /* ============ 3. The race, with the processor's time accounted for ============ */
      {
        title: 'Race: where does the processor’s time go?',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const TECH = [['pio', 'Programmed I/O', 'warn'], ['int', 'Interrupt-driven', 'intr'], ['dma', 'DMA', 'accent']];
          const KIND = { cmd: ['command / setup', 'cpu'], poll: ['polling (busy waiting)', 'warn'], move: ['moving a word', 'mem'], int: ['interrupt overhead', 'intr'], free: ['P2 does useful work', 'proc'], pause: ['paused by a stolen cycle', 'accent'] };
          let N = 8, D = 10, H = 4, R = {}, tMax = 1, gen = 0;
          const lanes = TECH.map(([k, name, col]) => {
            const head = h('div', { class: 'stack', style: { gap: '2px' } });
            const svg = s('svg', { viewBox: '0 0 600 44', width: '100%', preserveAspectRatio: 'none', style: { height: '44px', display: 'block' }, role: 'img', 'aria-label': name + ': processor time line' });
            const info = h('div', { class: 'xs', style: { lineHeight: '1.45' } });
            const row = h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'minmax(0,1fr)' : '150px minmax(0,1fr) 250px', gap: ctx.narrow ? '4px' : '14px', alignItems: 'center' } }, head, svg, info);
            return { k, name, col, head, svg, info, row };
          });
          const verdict = h('div', { class: 'callout why m0 small', 'data-label': 'What the numbers say' });
          function compute() { TECH.forEach(([k]) => (R[k] = race(k, N, D, H))); tMax = Math.max(...TECH.map(([k]) => R[k].end)); }
          function paint(cut) {
            lanes.forEach((L) => {
              const S = R[L.k], n = [], W = 600 / tMax;
              let t = 0;
              while (t < S.end && t < cut) {
                const k = S.acts[t]; let e = t;
                while (e < S.end && e < cut && S.acts[e] === k) e++;
                n.push(s('rect', { x: t * W, y: 3, width: Math.max((e - t) * W, 0.8), height: 38, style: `fill:var(--${KIND[k][1]});opacity:${k === 'free' ? 0.5 : 0.9}` }));
                t = e;
              }
              if (cut >= S.end && S.end < tMax) n.push(s('rect', { x: S.end * W, y: 3, width: (Math.min(cut, tMax) - S.end) * W, height: 38, style: 'fill:var(--panel-3);stroke:var(--line-2);stroke-width:1' }));
              n.push(s('rect', { x: 0, y: 3, width: 600, height: 38, style: 'fill:none;stroke:var(--line-2);stroke-width:1' }));
              if (cut < tMax) n.push(s('line', { x1: cut * W, y1: 0, x2: cut * W, y2: 44, style: 'stroke:var(--ink);stroke-width:2' }));
              L.svg.replaceChildren(...n);
              const done = cut >= S.end;
              L.head.innerHTML = `<b style="color:var(--${L.col})">${L.name}</b><span class="xs ${done ? '' : 'muted'}">${done ? 'transfer done at t = <b>' + S.end + '</b>' : 'running…'}</span>`;
              L.info.innerHTML = `Processor on I/O: <b>${S.io}</b> ticks (${Math.round(100 * S.io / S.end)}%)<br>P2 useful work: <b style="color:var(--proc)">${S.free}</b> ticks · interrupts: <b>${S.ints}</b><br>Words through the processor: <b>${S.viaCpu}</b>${L.k === 'dma' ? ' · stolen: <b>' + S.pause + '</b>' : ''}`;
            });
          }
          function explain() {
            const a = R.pio, b = R.int, c = R.dma, pct = (x) => Math.round(100 * x.free / x.end) + '%';
            let t = `Processor ticks spent on this transfer: polling <b>${a.io}</b>, interrupts <b>${b.io}</b>, DMA <b>${c.io}</b>. `;
            if (N === 1 && c.io > b.io) t += `With a single word, DMA’s fixed cost (${SETUP} setup + 1 stolen + ${H} interrupt = ${c.io}) is more than interrupt-driven I/O’s cost for that word (1 command + ${H} interrupt + 1 move = ${b.io}): DMA pays off for <b>multi-word</b> blocks.`;
            else if (H > D) t += `Interrupt overhead (${H}) is longer than the device’s wait per word (${D}), so interrupt-driven I/O costs the processor <b>more</b> than polling and even finishes later (t = ${b.end} vs ${a.end}). Fast block devices therefore use DMA.`;
            else t += `During its transfer, DMA leaves P2 <b>${pct(c)}</b> of the processor, interrupt-driven I/O ${pct(b)} and polling ${pct(a)}. ` + (c.end <= a.end ? `DMA also finishes first (t = ${c.end}), because the device never waits for an interrupt handler.` : `Polling finishes first here (t = ${a.end} vs ${c.end}): with so few words DMA’s fixed setup and interrupt are not yet paid back, yet polling ties up the processor completely.`);
            verdict.innerHTML = t;
          }
          function full() { gen++; compute(); paint(tMax); explain(); }
          function animate() {
            const g = ++gen; compute(); explain();
            const t0 = performance.now(), dur = 4200;
            ctx.raf((now) => { if (g !== gen) return false; const cut = Math.min(tMax, Math.floor(((now - t0) / dur) * tMax)); paint(cut); return cut < tMax; });
          }
          const sN = ctx.ui.slider({ label: 'Words (N)', min: 1, max: 16, value: N, onInput: (v) => { N = v; full(); } });
          const sD = ctx.ui.slider({ label: 'Device time per word (D)', min: 1, max: 20, value: D, format: (v) => v + ' t', onInput: (v) => { D = v; full(); } });
          const sH = ctx.ui.slider({ label: 'Interrupt overhead (H)', min: 1, max: 10, value: H, format: (v) => v + ' t', onInput: (v) => { H = v; full(); } });
          const preset = (label, n, d, hh) => h('button', { class: 'btn sm', type: 'button', onclick: () => { N = n; D = d; H = hh; sN.set(n); sD.set(d); sH.set(hh); full(); } }, label);
          const legend = h('div', { class: 'row xs', style: { gap: '4px 14px' } }, ...Object.values(KIND).map(([t, col]) => h('span', { class: 'row', style: { gap: '5px' } }, h('i', { style: { display: 'inline-block', width: '14px', height: '12px', borderRadius: '3px', background: `var(--${col})`, opacity: col === 'proc' ? 0.5 : 0.9 } }), t)),
            h('span', { class: 'row', style: { gap: '5px' } }, h('i', { style: { display: 'inline-block', width: '14px', height: '12px', borderRadius: '3px', background: 'var(--panel-3)', border: '1px solid var(--line-2)' } }), 'transfer already over'));
          full();
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'grid-3', style: { gap: '8px 20px' } }, sN, sD, sH),
            h('div', { class: 'row', style: { gap: '8px' } }, h('button', { class: 'btn primary sm', type: 'button', onclick: animate }, 'Animate ▶'),
              h('span', { class: 'xs muted' }, 'Try:'), preset('Slow device', 8, 10, 4), preset('Fast device', 8, 1, 4), preset('One word', 1, 10, 4), preset('Costly interrupts', 8, 4, 10)),
            h('div', { class: 'card white stack', style: { gap: '14px', padding: '12px 14px' } }, ...lanes.map((L) => L.row), legend),
            verdict,
            h('p', { class: 'xs muted m0', html: 'Model, in ticks: sending a command 1 · moving a word through the processor 1 · DMA setup 4 (one per item) · each DMA word steals one bus cycle (DMA logic beside the device), counted as a 1-tick pause (worst case) · another process, P2, is always ready to run · process-switch time is left out.' })));
        },
      },
      /* ============ 4. Six steps in the evolution of the I/O function ============ */
      {
        title: 'Six steps that freed the processor',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const CHORES = [['Drive the device’s signals and timing', 2], ['Wait until the device is ready', 3], ['Carry each word to or from memory', 4], ['Issue each command of a multi-step job', 5], ['Run the routine control of many devices', 6]];
          const STAGES = [
            ['Processor controls the device', 'drives the signals itself', 'cpu', '<b>Stage 1: the processor controls the device directly.</b> Its own program sets the device’s control lines and reads its signals, so it must know every detail of the device and does every chore itself.', 'Very early computers worked like this, and a tiny microcontroller that toggles a pin to talk to a sensor still does.'],
            ['A controller is added', 'polls the status', 'warn', '<b>Stage 2: a controller, or I/O module, is added.</b> The processor now sends short commands and the <span class="t">I/O controller</span> turns them into the device’s signals. The processor still uses programmed I/O without interrupts, so it polls; but the device’s details are hidden from it.', 'Simple polled controllers are still common in small embedded devices.'],
            ['Interrupts are added', 'handles every word', 'intr', '<b>Stage 3: the same set-up, now with interrupts.</b> The processor no longer waits for the device: it starts an operation, does other work, and is interrupted when the device is ready. Every word still passes through the processor.', 'Still a good fit for slow character devices, where one interrupt per character is cheap.'],
            ['DMA: direct access to memory', 'setup + 1 interrupt', 'accent', '<b>Stage 4: the I/O module gets direct control of memory (DMA).</b> A whole block moves without the processor, which is involved only at the start (the four parameters) and at the end (one interrupt).', 'The original IBM PC (1981) had a separate DMA controller chip; today most devices carry their own DMA logic and act as <span class="t">bus masters</span>.'],
            ['The module becomes an I/O channel', 'starts channel programs', 'os', '<b>Stage 5: the I/O module becomes an <span class="t">I/O channel</span>,</b> a processor with its own specialized instruction set. The CPU places an <span class="t">I/O program</span> in main memory and tells the channel to run it; the channel carries out the whole sequence (seek, read, check …) and interrupts only when all of it is done.', 'IBM mainframes used channels from the late 1950s, long before PCs had DMA, and mainframes still have channel subsystems: the six stages are a logical progression, not a strict timeline.'],
            ['The module becomes an I/O processor', 'rarely involved', 'ok', '<b>Stage 6: the I/O module becomes an <span class="t">I/O processor</span>.</b> It has its own <span class="t">local memory</span> and is a computer in its own right, so it can run a large set of devices, such as many interactive terminals, with minimal CPU involvement.', 'The same idea today: an SSD controller or a smart network card contains its own processor cores and memory.'],
          ];
          const G = slim ? {
            vb: '0 0 360 462', fs: 14,
            cpu: [10, 10, 150, 70], mem: [200, 10, 150, 90], prog: [212, 50, 126, 38], act: [10, 452],
            bus: [10, 350, 130], busLbl: [160, 122, 'start'], cpuStub: 85, memStub: 275,
            mod: [90, 190, 180, 100], modStub: 180, chip: [102, 240, 156, 32],
            dev1: [120, 380, 120, 40], devs: [[5, 380], [95, 380], [185, 380], [275, 380]], devW: 80, devH: 40,
            direct: 'M40,80 V400 H120', directLbl: [48, 300, 'CPU drives the device directly'],
            intr: 'M90,270 H30 V80', intrLbl: [22, 200, 'rotate(-90 22 200)'],
            dma: 'M150,190 V140 H275 V104', dmaLbl: [190, 168, 'to memory'],
            fetch: 'M340,90 C362,140 330,186 272,206', fetchLbl: [286, 172, 'fetch'],
            fanFrom: [180, 290],
          } : {
            vb: '0 0 660 318', fs: 15,
            cpu: [20, 14, 160, 90], mem: [220, 14, 170, 90], prog: [236, 52, 138, 40], act: [110, 132],
            bus: [20, 640, 150], busLbl: [640, 142, 'end'], cpuStub: 100, memStub: 305,
            mod: [250, 196, 200, 100], modStub: 350, chip: [266, 246, 168, 34],
            dev1: [520, 222, 120, 50], devs: [[520, 176], [520, 210], [520, 244], [520, 278]], devW: 120, devH: 28,
            direct: 'M60,104 V247 H520', directLbl: [290, 238, 'CPU drives the device’s signals directly'],
            intr: 'M250,282 H40 V104', intrLbl: [146, 300, null],
            dma: 'M320,196 V160 H305 V108', dmaLbl: [364, 180, 'straight to memory'],
            fetch: 'M390,72 C480,72 486,190 452,212', fetchLbl: [478, 120, 'fetches the I/O program'],
            fanFrom: [450, 246],
          };
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'How the I/O hardware grows over six stages' });
          const box = ([x, y, w, hh], cls, sw = 2) => s('rect', { x, y, width: w, height: hh, rx: 12, class: cls, 'stroke-width': sw });
          const txt = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'font-size': G.fs, 'text-anchor': 'middle' }, o), t);
          function draw(k) {
            const st = k + 1, n = [];
            n.push(s('line', { x1: G.bus[0], y1: G.bus[2], x2: G.bus[1], y2: G.bus[2], style: 'stroke:var(--line-2);stroke-width:8;stroke-linecap:round' }));
            n.push(s('text', { x: G.busLbl[0], y: G.busLbl[1], 'text-anchor': G.busLbl[2], 'font-size': 13, class: 's-sub' }, 'system bus'));
            n.push(s('line', { x1: G.cpuStub, y1: G.cpu[1] + G.cpu[3], x2: G.cpuStub, y2: G.bus[2], style: 'stroke:var(--line-2);stroke-width:3' }));
            n.push(s('line', { x1: G.memStub, y1: G.mem[1] + G.mem[3], x2: G.memStub, y2: G.bus[2], style: 'stroke:var(--line-2);stroke-width:3' }));
            n.push(box(G.cpu, 's-cpu'), txt(G.cpu[0] + G.cpu[2] / 2, G.cpu[1] + 28, 'CPU', { 'font-weight': 800 }));
            n.push(box(G.mem, 's-mem'), txt(G.mem[0] + G.mem[2] / 2, G.mem[1] + 28, 'Main memory', { 'font-weight': 800 }));
            n.push(s('text', { x: G.act[0], y: G.act[1], 'font-size': 13, 'font-weight': 700, style: `fill:var(--${STAGES[k][2]})` }, (slim ? 'CPU: ' : '') + STAGES[k][1]));
            if (st === 5) { n.push(box(G.prog, 's-os', 1.5), txt(G.prog[0] + G.prog[2] / 2, G.prog[1] + 25, 'I/O program', { 'font-size': 13, 'font-weight': 700, style: 'fill:var(--os)' })); }
            if (st === 1) {
              n.push(s('path', { d: G.direct, fill: 'none', style: 'stroke:var(--cpu);stroke-width:4;fill:none', 'marker-end': 'url(#arr-cpu)' }));
              n.push(s('text', { x: G.directLbl[0], y: G.directLbl[1], 'font-size': 13, 'font-weight': 700, 'text-anchor': slim ? 'start' : 'middle', style: 'fill:var(--cpu)' }, G.directLbl[2]));
            } else {
              const title = st <= 3 ? 'I/O module' : st === 4 ? 'I/O module + DMA' : st === 5 ? 'I/O channel' : 'I/O processor';
              n.push(s('line', { x1: G.modStub, y1: G.bus[2], x2: G.modStub, y2: G.mod[1], style: 'stroke:var(--line-2);stroke-width:3' }));
              n.push(box(G.mod, st >= 5 ? 's-os' : 's-io', st >= 4 ? 3 : 2), txt(G.mod[0] + G.mod[2] / 2, G.mod[1] + 28, title, { 'font-weight': 800 }));
              if (st === 2) n.push(txt(G.mod[0] + G.mod[2] / 2, G.mod[1] + 58, '(controller)', { 'font-size': 13, class: 's-sub' }));
              if (st === 5) n.push(box(G.chip, 's-panel', 1.5), txt(G.chip[0] + G.chip[2] / 2, G.chip[1] + 22, 'own instruction set', { 'font-size': 13, 'font-weight': 700 }));
              if (st === 6) n.push(box(G.chip, 's-mem', 1.5), txt(G.chip[0] + G.chip[2] / 2, G.chip[1] + 22, 'local memory + CPU', { 'font-size': 13, 'font-weight': 700, style: 'fill:var(--mem)' }));
              if (st >= 3) {
                n.push(s('path', { d: G.intr, fill: 'none', style: 'stroke:var(--intr);stroke-width:2.5;stroke-dasharray:6 4;fill:none', 'marker-end': 'url(#arr-intr)' }));
                n.push(s('text', { x: G.intrLbl[0], y: G.intrLbl[1], 'font-size': 13, 'font-weight': 700, 'text-anchor': 'middle', transform: G.intrLbl[2] || null, style: 'fill:var(--intr)' }, st >= 5 ? 'interrupt (per whole job)' : st === 4 ? 'interrupt (per block)' : 'interrupt (per word)'));
              }
              if (st >= 4) {
                n.push(s('path', { d: G.dma, fill: 'none', style: 'stroke:var(--mem);stroke-width:4;fill:none', 'marker-end': 'url(#arr-mem)' }));
                n.push(s('text', { x: G.dmaLbl[0], y: G.dmaLbl[1], 'font-size': 13, 'font-weight': 700, style: 'fill:var(--mem)' }, G.dmaLbl[2]));
              }
              if (st === 5) {
                n.push(s('path', { d: G.fetch, fill: 'none', style: 'stroke:var(--os);stroke-width:2.5;stroke-dasharray:5 3;fill:none', 'marker-end': 'url(#arr-os)' }));
                n.push(s('text', { x: G.fetchLbl[0], y: G.fetchLbl[1], 'font-size': 13, 'font-weight': 700, style: 'fill:var(--os)' }, G.fetchLbl[2]));
              }
              const devs = st === 6 ? G.devs.map(([x, y], i) => [x, y, G.devW, G.devH, slim ? 'Term ' + (i + 1) : 'Terminal ' + (i + 1)]) : [[...G.dev1, 'Device']];
              devs.forEach(([x, y, w, hh, label]) => {
                const [fx, fy] = G.fanFrom;
                n.push(s('line', { x1: fx, y1: fy, x2: slim ? x + w / 2 : x, y2: slim ? y : y + hh / 2, style: 'stroke:var(--io);stroke-width:2' }));
                n.push(box([x, y, w, hh], 's-io'), txt(x + w / 2, y + hh / 2 + 5, label, { 'font-size': st === 6 ? 13 : G.fs, 'font-weight': 700 }));
              });
            }
            if (st === 1) n.push(box(G.dev1, 's-io'), txt(G.dev1[0] + G.dev1[2] / 2, G.dev1[1] + G.dev1[3] / 2 + 5, 'Device', { 'font-weight': 700 }));
            svg.replaceChildren(...n);
          }
          const rows = CHORES.map(([t]) => h('tr', {}, h('td', {}, t), h('td', { style: { whiteSpace: 'nowrap' } })));
          const meter = h('i', { style: { background: 'var(--cpu)' } }), meterTxt = h('div', { class: 'small' }), era = h('p', { class: 'xs muted m0' });
          function table(k) {
            const st = k + 1;
            let left = 0;
            CHORES.forEach(([, move], i) => {
              const onCpu = st < move; if (onCpu) left++;
              rows[i].className = move === st ? 'on' : '';
              rows[i].lastChild.innerHTML = onCpu ? '<span class="chip cpu">CPU</span>' : '<span class="chip io">I/O hardware</span>';
            });
            meter.style.width = (100 * left / CHORES.length) + '%';
            meterTxt.innerHTML = `Chores still on the CPU: <b>${left} of ${CHORES.length}</b>`;
            era.innerHTML = STAGES[k][4];
          }
          const player = ctx.ui.player({ count: 6, interval: 3600, render: (k) => { draw(k); table(k); return STAGES[k][3]; } });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'split r grow', style: { gap: '14px', height: 'auto' } },
              h('div', { class: 'card white', style: { padding: '6px 10px', display: 'grid', placeItems: 'center' } }, svg),
              h('div', { class: 'card stack', style: { gap: '8px' } },
                h('h4', { class: 'm0' }, 'Who does each chore?'),
                h('table', { class: 'tbl compact' }, h('tbody', {}, ...rows)),
                meterTxt, h('div', { class: 'meter' }, meter), era)),
            player.el));
        },
      },
      /* ============ 5. Lab: set up a DMA transfer, then watch cycle stealing ============ */
      {
        title: 'Lab: program the DMA module, watch it steal cycles',
        kind: 'lab',
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const f = { op: 'READ', dev: 3, start: 10, n: 6 };
          let frames = [];
          const G = slim ? {
            vb: '0 0 360 356', fs: 13, cpu: [6, 6, 170, 72], devB: [184, 6, 170, 72], dma: [30, 84, 324, 76], regs: [[38, 106], [196, 106], [38, 132], [196, 132]], regW: 150, regH: 22,
            bus: 178, busLbl: null, stubs: [180], link: [269, 78, 269, 84], cpuRiser: [16, 78], memStub: 180,
            row0: 198, rowH: 28, rowGap: 34, cell0: 60, cellW: 34, cellStep: 37, rowLbl: ['0', '8', '16', '24'], lblX: 54, colHead: false, legendY: 346,
          } : {
            vb: '0 0 650 244', fs: 14, cpu: [10, 6, 190, 70], devB: [480, 6, 160, 70], dma: [215, 6, 250, 70], regs: [[225, 28], [345, 28], [225, 50], [345, 50]], regW: 112, regH: 20,
            bus: 96, busLbl: [640, 90], stubs: [105, 340], link: [465, 41, 480, 41], memStub: 340,
            row0: 122, rowH: 26, rowGap: 30, cell0: 110, cellW: 62, cellStep: 66, rowLbl: ['0–7 kernel', '8–15 P1', '16–23 P1', '24–31 P2'], lblX: 102, colHead: true, legendY: null,
          };
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Processor, DMA module, device, system bus and a 32-word memory' });
          const strip = s('svg', { viewBox: slim ? '0 0 360 58' : '0 0 650 58', width: '100%', role: 'img', 'aria-label': 'Who used the bus in each cycle, and what the processor did' });
          const stats = h('div', { class: 'xs', style: { lineHeight: '1.45' } });
          const REG = [['op', 'R/W'], ['dev', 'Device'], ['addr', 'Address'], ['count', 'Count']];
          const T = (x, y, str, o = {}) => s('text', Object.assign({ x, y, 'font-size': G.fs }, o), str);
          function draw(i) {
            const F = frames[i], P = frames[i - 1], n = [], last = F.cyc[F.cyc.length - 1];
            const busCol = last ? (last.owner === 'P' ? 'var(--cpu)' : last.owner === 'D' ? 'var(--accent)' : 'var(--line-2)') : 'var(--line-2)';
            n.push(s('line', { x1: 6, y1: G.bus, x2: slim ? 354 : 644, y2: G.bus, style: `stroke:${busCol};stroke-width:8;stroke-linecap:round` }));
            if (G.busLbl) n.push(T(G.busLbl[0], G.busLbl[1], 'system bus', { 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }));
            G.stubs.forEach((x) => n.push(s('line', { x1: x, y1: G.bus - 22, x2: x, y2: G.bus, style: 'stroke:var(--line-2);stroke-width:3' })));
            n.push(s('line', { x1: G.memStub, y1: G.bus, x2: G.memStub, y2: G.row0 - (G.colHead ? 16 : 6), style: 'stroke:var(--line-2);stroke-width:3' }));
            if (G.link) n.push(s('line', { x1: G.link[0], y1: G.link[1], x2: G.link[2], y2: G.link[3], style: 'stroke:var(--io);stroke-width:3' }));
            if (G.cpuRiser) n.push(s('line', { x1: G.cpuRiser[0], y1: G.cpuRiser[1], x2: G.cpuRiser[0], y2: G.bus, style: 'stroke:var(--line-2);stroke-width:3' }));
            const [cx, cy, cw, ch] = G.cpu;
            n.push(s('rect', { x: cx, y: cy, width: cw, height: ch, rx: 12, class: 's-cpu', 'stroke-width': 2 }));
            n.push(T(cx + 10, cy + 19, 'PROCESSOR', { 'font-size': 12.5, 'font-weight': 800, class: 's-sub' }));
            n.push(T(cx + 10, cy + 41, F.cpu[0], { 'font-weight': 800, style: `fill:var(--${F.cpu[1]})` }));
            n.push(T(cx + 10, cy + 60, F.cpu[2], { 'font-size': 13, class: 's-sub' }));
            const [dx, dy, dw, dh] = G.devB;
            n.push(s('rect', { x: dx, y: dy, width: dw, height: dh, rx: 12, class: 's-io', 'stroke-width': 2 }));
            n.push(T(dx + 10, dy + 19, (slim ? DEVNAME[f.dev].split(' ')[0] : DEVNAME[f.dev]) + ' #' + f.dev, { 'font-size': 13, 'font-weight': 800 }));
            n.push(T(dx + 10, dy + 41, F.devTxt, { 'font-weight': 700, style: 'fill:var(--io)' }));
            n.push(T(dx + 10, dy + 60, f.op === 'READ' ? 'sent: ' + DEVDATA[f.dev].slice(0, F.words) : 'received: ' + F.got, { 'font-size': 13, class: 's-sub s-monot' }));
            const [mx, my, mw, mh] = G.dma;
            n.push(s('rect', { x: mx, y: my, width: mw, height: mh, rx: 12, class: 's-accent', 'stroke-width': 2 }));
            n.push(T(mx + 10, my + 17, 'DMA MODULE', { 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--accent)' }));
            REG.forEach(([k, label], j) => {
              const [rx, ry] = G.regs[j], hot = P && P.reg[k] !== F.reg[k];
              n.push(s('rect', { x: rx, y: ry, width: G.regW, height: G.regH, rx: 6, class: 's-panel', 'stroke-width': 1.2, style: hot ? 'fill:var(--hl)' : null }));
              n.push(T(rx + 6, ry + G.regH / 2 + 4.5, label + ': ' + (F.reg[k] || '–'), { 'font-size': 13, 'font-weight': 700, class: 's-monot' }));
            });
            if (G.colHead) for (let col = 0; col < 8; col++) n.push(T(G.cell0 + col * G.cellStep + G.cellW / 2, G.row0 - 5, '+' + col, { 'font-size': 12.5, 'text-anchor': 'middle', class: 's-sub' }));
            for (let a = 0; a < 32; a++) {
              const r = Math.floor(a / 8), col = a % 8, x = G.cell0 + col * G.cellStep, y = G.row0 + r * G.rowGap;
              const inBlock = a >= f.start && a < f.start + f.n, kern = a < 8, p2 = a > 23;
              const filled = f.op === 'READ' && inBlock && F.mem[a] !== '·';
              n.push(s('rect', { x, y, width: G.cellW, height: G.rowH, rx: 5, class: kern ? 's-os' : filled ? 's-mem' : 's-panel', 'stroke-width': inBlock ? 3 : 1.2,
                style: (inBlock ? 'stroke:var(--accent);' : p2 ? 'stroke-dasharray:3 3;' : '') + (a === F.hot ? 'fill:var(--hl);' : '') }));
              n.push(T(x + G.cellW / 2, y + G.rowH / 2 + 5, F.mem[a], { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: 's-monot' + (kern || p2 || F.mem[a] === '·' ? ' s-sub' : '') }));
              if (a === F.cur) n.push(s('rect', { x: x + 5, y: y + G.rowH - 6, width: G.cellW - 10, height: 3.5, rx: 1.5, style: 'fill:var(--accent)' }));
            }
            G.rowLbl.forEach((t, r) => n.push(T(G.lblX, G.row0 + r * G.rowGap + G.rowH / 2 + 5, t, { 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, class: r === 1 || r === 2 ? '' : 's-sub' })));
            if (G.legendY) n.push(T(6, G.legendY, 'Row 0 = kernel · rows 8, 16 = P1’s buffer · row 24 = P2', { 'font-size': 13, class: 's-sub' }));
            svg.replaceChildren(...n);
            drawStrip(F);
            stats.innerHTML = `Words moved <b>${F.words} / ${f.n}</b> · stolen cycles <b style="color:var(--accent)">${F.stolen}</b> · P2 paused <b style="color:var(--warn)">${F.paused}</b> · harmless steals <b style="color:var(--ok)">${F.stolen - F.paused}</b> · interrupts <b style="color:var(--intr)">${F.ints}</b>`;
          }
          function drawStrip(F) {
            const all = frames[frames.length - 1].cyc, W = slim ? 360 : 650, x0 = 40, cw = (W - x0 - 4) / all.length, n = [];
            n.push(T(0, 22, 'bus', { 'font-size': 13, 'font-weight': 800 }), T(0, 48, 'CPU', { 'font-size': 13, 'font-weight': 800 }));
            all.forEach((c, j) => {
              const x = x0 + j * cw, seen = j < F.cyc.length, op = seen ? 1 : 0.15;
              const bc = c.owner === 'P' ? 's-cpu' : c.owner === 'D' ? 's-accent' : 's-panel';
              const pc = c.proc === 'S' ? 's-cpu' : c.proc === '‖' ? 's-warn' : c.proc === 'I' ? 's-intr' : 's-proc';
              n.push(s('rect', { x: x + 1, y: 8, width: cw - 2, height: 20, rx: 3, class: bc, 'stroke-width': 1, style: 'opacity:' + op }));
              n.push(s('rect', { x: x + 1, y: 34, width: cw - 2, height: 20, rx: 3, class: pc, 'stroke-width': 1, style: 'opacity:' + op }));
              if (cw >= 16 && seen) {
                n.push(T(x + cw / 2, 23, c.owner === '-' ? '' : c.owner, { 'font-size': 12.5, 'font-weight': 800, 'text-anchor': 'middle' }));
                n.push(T(x + cw / 2, 49, c.proc, { 'font-size': 12.5, 'font-weight': 800, 'text-anchor': 'middle' }));
              }
            });
            if (F.cyc.length) n.push(s('rect', { x: x0 + (F.cyc.length - 1) * cw, y: 4, width: cw, height: 54, rx: 4, style: 'fill:none;stroke:var(--ink);stroke-width:2' }));
            strip.replaceChildren(...n);
          }
          const msg = h('div', { class: 'narr small' });
          const player = ctx.ui.player({ count: 1, interval: 1500, render: (i) => { if (!frames.length) return ''; draw(i); return frames[i].cap; } });
          function rebuild() {
            const bad = dmaCheck(f);
            msg.className = 'narr small ' + (bad ? 'bad' : 'ok');
            msg.innerHTML = bad ? '<b>The OS refuses.</b> ' + bad : `<b>Accepted.</b> Words ${f.start}–${f.start + f.n - 1} lie inside P1’s locked buffer (8–23).`;
            frames = bad ? [Object.assign(dmaRun({ op: f.op, dev: f.dev, start: 8, n: 1 })[0], { cap: 'Nothing is sent. Choose a block inside P1’s buffer (words 8–23) to run the transfer.' })] : dmaRun(f);
            player.stop(); player.setCount(frames.length); player.go(0);
          }
          const item = (num, title, hint, control) => h('div', { class: 'stack', style: { gap: '4px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '6px' } }, h('b', { class: 'small' }, num + '. ' + title), h('span', { class: 'xs muted', html: hint })), control);
          const opSeg = ctx.ui.seg([{ value: 'READ', label: 'Read: device → memory' }, { value: 'WRITE', label: 'Write: memory → device' }], f.op, (v) => { f.op = v; rebuild(); });
          const devSeg = ctx.ui.seg([{ value: 3, label: 'Disk (#3)' }, { value: 5, label: 'Network card (#5)' }], f.dev, (v) => { f.dev = v; rebuild(); });
          const sStart = ctx.ui.slider({ label: 'Start', min: 0, max: 31, value: f.start, onInput: (v) => { f.start = v; rebuild(); } });
          const sN = ctx.ui.slider({ label: 'Words', min: 1, max: 8, value: f.n, onInput: (v) => { f.n = v; rebuild(); } });
          rebuild();
          el.append(h('div', { class: 'split l fill mw0', style: { gridTemplateColumns: slim ? null : 'minmax(0,4fr) minmax(0,7fr)', gap: '16px' } },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'small m0', html: 'You are the OS serving P1’s request: give the <span class="t">DMA module</span> its four items, then step through the transfer cycle by cycle.' }),
              item(1, 'Read or write?', 'direction', opSeg),
              item(2, 'Which device?', 'device address', devSeg),
              item(3, 'Where in memory?', '→ <span class="t">address register</span>', sStart),
              item(4, 'How many words?', '→ <span class="t">count register</span>', sN),
              msg,
              h('div', { class: 'callout why m0 small', 'data-label': 'The OS’s job', html: 'The DMA module checks nothing: it writes wherever its address register points. So the OS gives it only a buffer the process owns and keeps those frames in memory (<span class="t">frame locking</span>) until the interrupt. Modern machines add an <span class="t">IOMMU</span> as a hardware guard.' })),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg),
              h('div', { class: 'card white stack', style: { padding: '6px 10px', gap: '2px', flex: 'none' } }, strip, stats),
              player.el)));
        },
      },
      /* ============ 6. Three DMA configurations and their bus cycles ============ */
      {
        title: 'DMA configurations: count the bus cycles',
        kind: 'compare',
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          /* boxes: [x, y, w, h, label, class]; lines: [x1, y1, x2, y2, style]; hops: [path, medium] */
          const GEO = slim ? {
            vb: '0 0 360 228', bus: [10, 350, 64], fs: 14,
            common: [[10, 6, 120, 38, 'Processor', 's-cpu'], [230, 6, 120, 38, 'Memory', 's-mem']], stubs: [[70, 44, 70, 64], [290, 44, 290, 64]],
            det: { boxes: [[10, 96, 104, 40, 'DMA', 's-accent'], [128, 96, 104, 40, 'I/O A', 's-io'], [246, 96, 104, 40, 'I/O B', 's-io'], [128, 176, 104, 40, 'Disk', 's-panel'], [246, 176, 104, 40, 'Printer', 's-panel']], lines: [[62, 64, 62, 96], [180, 64, 180, 96], [298, 64, 298, 96], [180, 136, 180, 176, 'io'], [298, 136, 298, 176, 'io']], hops: ['M180,96 V64 H62 V96', 'M62,96 V64 H290 V44'] },
            integ: { boxes: [[10, 96, 150, 40, 'DMA A', 's-accent'], [10, 170, 150, 40, 'I/O A', 's-io'], [200, 96, 150, 40, 'DMA B', 's-accent'], [200, 170, 70, 40, 'I/O B', 's-io'], [280, 170, 70, 40, 'I/O C', 's-io']],
              lines: [[85, 64, 85, 96], [275, 64, 275, 96], [85, 136, 85, 170, 'io'], [275, 136, 235, 170, 'io'], [275, 136, 315, 170, 'io']], hops: ['M85,170 V138', 'M85,96 V64 H290 V44'] },
            iobus: { boxes: [[105, 96, 150, 40, 'DMA', 's-accent'], [10, 180, 78, 40, 'I/O A', 's-io'], [97, 180, 78, 40, 'I/O B', 's-io'], [184, 180, 78, 40, 'I/O C', 's-io'], [271, 180, 78, 40, 'I/O D', 's-io']],
              lines: [[180, 64, 180, 96], [180, 136, 180, 160, 'io'], [49, 160, 49, 180, 'io'], [136, 160, 136, 180, 'io'], [223, 160, 223, 180, 'io'], [310, 160, 310, 180, 'io']], iobus: [10, 350, 160], iobusLbl: [350, 154], hops: ['M49,180 V160 H180 V138', 'M180,96 V64 H290 V44'] },
          } : {
            vb: '0 0 1100 240', bus: [20, 1080, 70], fs: 15,
            common: [[30, 8, 170, 42, 'Processor', 's-cpu'], [880, 8, 190, 42, 'Main memory', 's-mem']], stubs: [[115, 50, 115, 70], [975, 50, 975, 70]],
            det: { boxes: [[300, 100, 160, 50, 'DMA module', 's-accent'], [520, 100, 160, 50, 'I/O module A', 's-io'], [720, 100, 160, 50, 'I/O module B', 's-io'], [540, 186, 120, 44, 'Disk', 's-panel'], [740, 186, 120, 44, 'Printer', 's-panel']], lines: [[380, 70, 380, 100], [600, 70, 600, 100], [800, 70, 800, 100], [600, 150, 600, 186, 'io'], [800, 150, 800, 186, 'io']], hops: ['M600,100 V70 H380 V100', 'M380,100 V70 H975 V50'] },
            integ: { boxes: [[260, 100, 160, 50, 'DMA module A', 's-accent'], [260, 180, 160, 46, 'I/O module A', 's-io'], [560, 100, 200, 50, 'DMA module B', 's-accent'], [500, 180, 140, 46, 'I/O module B', 's-io'], [680, 180, 140, 46, 'I/O module C', 's-io']],
              lines: [[340, 70, 340, 100], [660, 70, 660, 100], [340, 150, 340, 180, 'io'], [660, 150, 570, 180, 'io'], [660, 150, 750, 180, 'io']], hops: ['M340,180 V152', 'M340,100 V70 H975 V50'] },
            iobus: { boxes: [[400, 100, 160, 50, 'DMA module', 's-accent'], [250, 190, 150, 46, 'I/O module A', 's-io'], [440, 190, 150, 46, 'I/O module B', 's-io'], [630, 190, 150, 46, 'I/O module C', 's-io'], [820, 190, 150, 46, 'I/O module D', 's-io']],
              lines: [[480, 70, 480, 100], [480, 150, 480, 172, 'io'], [325, 172, 325, 190, 'io'], [515, 172, 515, 190, 'io'], [705, 172, 705, 190, 'io'], [895, 172, 895, 190, 'io']], iobus: [240, 1000, 172], iobusLbl: [1000, 164], hops: ['M325,190 V172 H480 V152', 'M480,100 V70 H975 V50'] },
          };
          const CONF = {
            det: { name: 'Single-bus detached DMA', hop1: 'system bus', sys: 2, links: 'none: it reaches every I/O module over the system bus', add: 'plug into the system bus', why: 'Cheap and simple, but every word crosses the system bus twice: up to two lost processor cycles per word.' },
            integ: { name: 'Single-bus integrated DMA-I/O', hop1: 'private link', sys: 1, links: 'one private link per attached I/O module', add: 'needs a new link, or more DMA logic', why: 'The DMA logic sits beside its I/O modules, so the first move stays off the system bus: one cycle per word.' },
            iobus: { name: 'I/O bus', hop1: 'I/O bus', sys: 1, links: 'one: the I/O bus', add: 'plug into the I/O bus', why: 'One system-bus cycle per word too, yet the DMA module needs a single I/O-side link and new devices just plug in.' },
          };
          let cf = 'det', N = 4;
          const svg = s('svg', { viewBox: GEO.vb, width: '100%', role: 'img', 'aria-label': 'DMA configuration and the path one word takes to memory' });
          const counters = h('div', { class: 'stack', style: { gap: '6px' } });
          const T = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'font-size': GEO.fs, 'text-anchor': 'middle' }, o), t);
          function counts(k) {
            let sys = 0, other = 0;
            for (let j = 1; j <= k; j++) { if ((j - 1) % 2 === 0 && CONF[cf].hop1 !== 'system bus') other++; else sys++; }
            return { sys, other, words: Math.floor(k / 2) };
          }
          function draw(k) {
            const G = GEO[cf], n = [];
            n.push(s('line', { x1: GEO.bus[0], y1: GEO.bus[2], x2: GEO.bus[1], y2: GEO.bus[2], style: 'stroke:var(--line-2);stroke-width:8;stroke-linecap:round' }));
            n.push(slim ? T(180, GEO.bus[2] - 8, 'system bus', { 'font-size': 13, class: 's-sub' }) : T(GEO.bus[1], GEO.bus[2] - 9, 'system bus', { 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }));
            if (G.iobus) { n.push(s('line', { x1: G.iobus[0], y1: G.iobus[2], x2: G.iobus[1], y2: G.iobus[2], style: 'stroke:var(--io);stroke-width:6;stroke-linecap:round' })); n.push(T(G.iobusLbl[0], G.iobusLbl[1], 'I/O bus', { 'text-anchor': 'end', 'font-size': 13, style: 'fill:var(--io)' })); }
            [...GEO.stubs, ...G.lines].forEach(([x1, y1, x2, y2, c]) => n.push(s('line', { x1, y1, x2, y2, style: `stroke:var(--${c === 'io' ? 'io' : 'line-2'});stroke-width:3` })));
            [...GEO.common, ...G.boxes].forEach(([x, y, w, hh, label, cls]) => { n.push(s('rect', { x, y, width: w, height: hh, rx: 10, class: cls, 'stroke-width': 2 })); n.push(T(x + w / 2, y + hh / 2 + 5, label, { 'font-weight': 700 })); });
            if (k > 0) {
              const hop = (k - 1) % 2, sysHop = hop === 1 || CONF[cf].hop1 === 'system bus';
              n.push(s('path', { d: G.hops[hop], fill: 'none', style: `fill:none;stroke:var(--${sysHop ? 'accent' : 'ok'});stroke-width:5;stroke-linejoin:round`, 'marker-end': `url(#arr-${sysHop ? 'accent' : 'ok'})` }));
            }
            svg.replaceChildren(...n);
          }
          function paintCounters(k) {
            const c = counts(k), tot = CONF[cf].sys * N;
            const line = (label, v, col) => h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '8px' } }, h('span', { class: 'small' }, label), h('b', { style: { color: `var(--${col})`, fontSize: '18px' } }, String(v)));
            counters.replaceChildren(
              line('System-bus cycles so far', c.sys + ' / ' + tot, 'accent'),
              line('Transfers off the system bus', c.other, 'ok'),
              line('Words in memory', c.words + ' / ' + N, 'mem'),
              h('div', { class: 'xs muted' }, `Each system-bus cycle is one the processor may lose: up to ${tot} for this block.`));
          }
          function caption(k) {
            const C = CONF[cf];
            if (k === 0) return `<b>${C.name}.</b> A block of ${N} word${N > 1 ? 's' : ''} waits in I/O module A. Each word must travel I/O module → DMA module → memory. Press ▶ to watch.`;
            const w = Math.ceil(k / 2), hop = (k - 1) % 2;
            let t = hop === 0 ? `<b>Word ${w}, first move:</b> I/O module A → DMA module over the <b>${C.hop1}</b>. ` + (C.hop1 === 'system bus' ? 'That is a system-bus cycle, stolen from the processor.' : 'The system bus is not touched.')
              : `<b>Word ${w}, second move:</b> DMA module → memory over the <b>system bus</b>: one stolen cycle.`;
            if (k === 2 * N) t += ` <b>Block done:</b> ${N} word${N > 1 ? 's' : ''} used ${C.sys * N} system-bus cycle${C.sys * N > 1 ? 's' : ''}, ${C.sys} per word.`;
            return t;
          }
          const player = ctx.ui.player({ count: 2 * N + 1, interval: 1200, render: (k) => { draw(k); paintCounters(k); return caption(k); } });
          function changed() { player.stop(); player.setCount(2 * N + 1); player.go(0); }
          function watchTab(p) {
            const seg = ctx.ui.seg([{ value: 'det', label: slim ? 'Detached' : 'Single-bus detached' }, { value: 'integ', label: slim ? 'Integrated' : 'Single-bus integrated' }, { value: 'iobus', label: 'I/O bus' }], cf, (v) => { cf = v; changed(); });
            const sl = ctx.ui.slider({ label: 'Words in the block', min: 1, max: 8, value: N, onInput: (v) => { N = v; changed(); } });
            sl.style.minWidth = slim ? '0' : '320px';
            p.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
              h('div', { class: 'row', style: { gap: '10px 20px' } }, seg, sl),
              h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg),
              h('div', { class: 'split r', style: { height: 'auto', gap: '14px' } }, player.el, h('div', { class: 'card tight' }, counters))));
            changed();
            return () => player.stop();
          }
          function compareTab(p) {
            const rows = Object.entries(CONF).map(([k, C]) => h('tr', { class: k === cf ? 'on' : '' }, h('td', { html: '<b>' + C.name + '</b>' }), h('td', { class: 'num' }, String(C.sys)), h('td', { class: 'num' }, `${C.sys} × ${N} = ${C.sys * N}`), h('td', {}, C.links), h('td', {}, C.add)));
            p.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
              h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, ...['Configuration', 'Bus cycles per word', `For ${N} words`, 'DMA module’s I/O-side links', 'Adding a device'].map((t) => h('th', {}, t)))), h('tbody', {}, ...rows)),
              h('div', { class: 'grid-3', style: { gap: '10px' } }, ...Object.values(CONF).map((C) => h('div', { class: 'card tight small', html: '<b>' + C.name + '.</b> ' + C.why }))),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why the count matters', html: 'Every system-bus cycle the DMA module takes is a cycle the processor cannot use the bus. Halving the system-bus traffic per word halves the number of bus cycles the processor can lose during a transfer.' }),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Today', html: 'Most modern devices (for example on PCI Express) carry their own DMA logic and act as <span class="t">bus masters</span>, which is the integrated idea taken to its end: there is no separate shared DMA module to cross.' })));
          }
          el.append(ctx.ui.tabs([{ label: 'Watch the words move', render: watchTab }, { label: 'Compare all three', render: compareTab }]));
        },
      },
      /* ============ 7. Recap ============ */
      {
        title: 'Recap: six things to remember',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['Two questions classify the techniques', 'Interrupts? Data through the processor or straight to memory? <b>Programmed I/O</b>: no, through. <b>Interrupt-driven</b>: yes, through. <b>DMA</b>: yes, direct.'],
              ['What happens to the process that asked?', '<b>Blocking</b> request: the OS blocks it and runs another process until the I/O finishes. <b>Asynchronous</b>: it keeps running and is told later that the transfer is done. (<b>Nonblocking</b> only means “do not wait”.) Programmed I/O busy-waits either way.'],
              ['The six steps of I/O evolution', '1 CPU drives the device · 2 controller, polled · 3 interrupts · 4 DMA · 5 I/O channel runs an I/O program from main memory · 6 I/O processor with local memory.'],
              ['Channel or I/O processor?', 'A <b>channel</b> executes I/O instructions it fetches from main memory. An <b>I/O processor</b> also has its own local memory: a computer in its own right that runs many devices.'],
              ['Four DMA items, then cycle stealing', 'Read or write · device address · start address · word count. Then it steals bus cycles word by word; the processor pauses only if it needs the bus then, saving nothing.'],
              ['System-bus cycles per word', 'Single-bus detached: <b>2</b>. Integrated DMA-I/O: <b>1</b>. I/O bus: <b>1</b>, and the DMA module needs only one I/O-side link.'],
            ], { cols: ctx.narrow ? 1 : 3, height: 186 }),
            ctx.h('div', { class: 'callout why m0 small', 'data-label': 'The thread through it all', html: 'Each design moves one more chore from the processor into I/O hardware, and the OS’s job shifts from doing the transfer to setting it up safely and reacting to its completion.' })));
        },
      },
      /* ============ 8. Check yourself ============ */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'A process makes a <b>blocking</b> read() that the OS carries out with interrupt-driven I/O. What happens right after the read command is sent to the I/O module?',
            choices: ['The processor checks the module’s status register in a loop until the first word is ready.', 'The OS moves the process to the Blocked state and dispatches another ready process.', 'The process keeps running, and the OS tells it later that the data has arrived.', 'The OS swaps the process out to disk until the whole block has been transferred.'],
            answer: 1,
            feedback: ['That is programmed I/O. With interrupts the processor does not poll.', null, 'That describes an asynchronous request, which returns at once and reports completion later. A blocking call means the process cannot continue without its data.', 'Waiting for I/O makes a process Blocked, not suspended. Swapping out is a separate memory decision.'],
            why: 'A blocking call means the process cannot go on, so the next code the processor runs is the OS’s: it blocks the process and schedules another one. The completion interrupt later lets the OS make it Ready again.' },
          { type: 'tf', q: 'A program puts a pipe in nonblocking mode and calls read() while the pipe is empty (the writer still has it open). The call returns at once, and the OS fills the program’s buffer later, when data arrives.', answer: false,
            why: 'Nonblocking only means “do not wait”: with nothing to read, read() fails at once with a would-block error (EAGAIN) and starts nothing, so the program must call it again. Filling the buffer later and reporting completion is what an asynchronous request (for example POSIX aio_read) does.' },
          { type: 'tf', q: 'When a DMA module steals a bus cycle, the processor is delayed only if it needs the bus in that same cycle, and it saves no context.', answer: true,
            why: 'Cycle stealing is not an interrupt. The processor merely pauses for that one bus cycle, and only if it needed the bus at that moment (to fetch or store); nothing is saved and no handler runs.' },
          { type: 'order', q: 'Put the six steps in the evolution of the I/O function in order, earliest first.',
            items: ['The processor directly controls each peripheral device', 'A controller (I/O module) is added and the processor uses programmed I/O without interrupts', 'Interrupts are added, so the processor no longer waits for the device', 'The I/O module gets direct access to memory (DMA)', 'The I/O module becomes an I/O channel that runs an I/O program held in main memory', 'The I/O module becomes an I/O processor with its own local memory'],
            why: 'Each step takes one more chore off the processor: device details, then waiting, then moving each word, then sequencing whole I/O jobs, then the routine control of many devices.' },
          { type: 'match', q: 'Match each design to its description.',
            pairs: [['Single-bus detached DMA', 'Every word crosses the system bus twice'], ['Single-bus integrated DMA-I/O', 'DMA logic is built into an I/O module or wired to a few by private links'], ['I/O bus configuration', 'One DMA interface serves all I/O modules through a separate bus'], ['Bus master device', 'A device with its own DMA logic that starts its own transfers']],
            why: 'Detached DMA uses the shared system bus for both moves; integrated and I/O-bus designs keep the device-to-DMA move off it; a bus master builds the DMA logic into the device itself.' },
          { type: 'num', q: 'A disk sends a 512-word block to memory through a <b>single-bus detached</b> DMA module. How many system-bus transfers does the block need?', answer: 1024, tol: 0, unit: 'transfers',
            why: 'Each word crosses the system bus twice (I/O module → DMA module, then DMA module → memory): 2 × 512 = 1024. An integrated or I/O-bus design would need 512.' },
          { type: 'num', q: 'Interrupt-driven I/O moves a 10-word block. For each word the processor spends 1 tick sending the command, 5 ticks of interrupt overhead and 1 tick moving the word. How many processor ticks does the transfer cost in total?', answer: 70, tol: 0, unit: 'ticks',
            why: '(1 + 5 + 1) × 10 = 70 ticks. With DMA the same block costs one setup, at most one stolen tick per word, and a single interrupt.' },
          { type: 'bucket', q: 'Which technique does each description fit?', buckets: ['Programmed I/O', 'Interrupt-driven I/O', 'DMA'],
            items: [['The processor reads a status register in a loop until the device is ready', 0], ['The I/O module never interrupts the processor', 0], ['Each word passes through the processor, but no time is spent checking status', 1], ['The processor takes one interrupt for every word', 1], ['The processor hands over direction, device, start address and word count, then leaves', 2], ['One interrupt arrives after the whole block is in memory', 2]],
            why: 'Programmed I/O polls and is never interrupted; interrupt-driven I/O moves every word itself, one interrupt each; DMA needs only a setup and one interrupt per block.' },
          { type: 'multi', q: 'Which items does the processor give a DMA module to start a block transfer? Choose all that apply.',
            choices: ['Whether to read or write', 'The ID of the process that asked', 'The address of the I/O device', 'The starting location in memory', 'The scheduling priority of the transfer', 'The number of words to move'], answer: [0, 2, 3, 5],
            why: 'Direction, device, where in memory and how many words: that is all the DMA module needs. Which process asked is the OS’s business, kept in the OS’s own tables.' },
          { q: 'What makes an I/O processor different from an I/O channel?',
            choices: ['An I/O processor raises interrupts, while a channel has to be polled by the CPU.', 'An I/O processor can move data directly into memory, while a channel cannot.', 'A channel has a specialized instruction set, while an I/O processor runs no program.', 'An I/O processor has its own local memory and is a computer in its own right.'],
            answer: 3,
            feedback: ['Both interrupt the CPU when their work is done; polling belongs to the second step of the evolution.', 'Both build on DMA and move data straight to memory.', 'The first half is true, but an I/O processor runs programs too, from its own local memory; it is the more capable of the two.', null],
            why: 'A channel executes an I/O program it fetches from main memory. An I/O processor adds local memory of its own, so it can run the routine control of many devices with minimal CPU involvement.' },
          { q: 'A device can deliver a new word every microsecond, but each interrupt costs the processor about 4 microseconds. Why is interrupt-driven I/O a poor way to move a large block from it?',
            choices: ['Each interrupt costs more than the short wait it replaces, so even polling would be cheaper.', 'The device must wait for the processor to finish polling before it may send the next word.', 'Interrupts can be used only by character devices, never by devices that move blocks.', 'The DMA module would steal so many bus cycles that the interrupts could not be served.'],
            answer: 0,
            feedback: [null, 'Interrupt-driven I/O does not poll; the device waits for the interrupt handler instead.', 'Any device can interrupt; the trouble is the cost per word, not the kind of device.', 'There is no DMA module in interrupt-driven I/O: every word goes through the processor.'],
            why: 'With one interrupt per word, a fast device makes the overhead dominate. A block from a fast device is a job for DMA: one setup and one interrupt for the whole block.' },
          { q: 'Why must the OS keep the frames of a DMA buffer locked in memory until the transfer ends?',
            choices: ['Locked frames sit in a faster region of memory, so the processor can read the arriving words sooner.', 'The DMA module can reach only frames whose lock bit is set; every other frame is invisible to it.', 'The DMA module uses physical addresses, so if the page moved it would write into someone else’s frame.', 'Locking stops the processor from pausing whenever the DMA module steals a bus cycle for the buffer.'],
            answer: 2,
            feedback: ['Locking does not change memory speed; it only stops the page from being replaced or moved.', 'The DMA module never looks at lock bits; it writes wherever its address register points.', null, 'Whether the processor pauses depends on whether it needs the bus in that cycle, not on locking.'],
            why: 'The DMA module was given a physical start address. If the OS replaced or moved that page mid-transfer, the module would keep writing into a frame that now belongs to another page or process.' },
        ],
      },
    ],
    notes: `
      <h3>Organization of the I/O function</h3>
      <p>Every I/O operation needs four chores done: <b>command</b> the device, <b>wait</b> until it is ready, <b>carry</b> each word between the device and memory, and <b>notice</b> that the job is finished. Organizing the I/O function means deciding which hardware does each chore. The long-term trend is to move these chores off the processor so it can run programs instead.</p>

      <h4>The three techniques</h4>
      <ul>
        <li><b>Programmed I/O.</b> The processor sends a command to the I/O module on behalf of a process, then repeatedly reads the module's status register (polling, busy waiting) until the operation is done, and copies each word itself. The module never interrupts.</li>
        <li><b>Interrupt-driven I/O.</b> The processor sends the command and goes on with other work. When the module is ready it raises an interrupt; the handler copies the word and sends the next command. Every word still passes through the processor, and every word costs one interrupt.</li>
        <li><b>Direct memory access (DMA).</b> A DMA module moves a whole block straight between the I/O module and memory. The processor is involved only at the start (setup) and at the end (one completion interrupt).</li>
      </ul>
      <table>
        <tr><th></th><th>No interrupts</th><th>Uses interrupts</th></tr>
        <tr><th>Transfer goes through the processor</th><td>Programmed I/O</td><td>Interrupt-driven I/O</td></tr>
        <tr><th>Direct I/O-to-memory transfer</th><td>(not a standard technique)</td><td>DMA</td></tr>
      </table>
      <p>The empty corner would mean moving data straight to memory but polling for the end, which gives back much of the gain, so the classic design pairs direct transfer with a completion interrupt. (Some very fast modern devices are polled for completion, when checking costs less than taking an interrupt.)</p>

      <h4>What happens to the process that asked</h4>
      <ul>
        <li><b>Blocking call:</b> the process cannot continue without its data, so the next code the processor runs is the OS's. It moves the process to the Blocked state and dispatches another ready process. When the I/O finishes (after the last per-word interrupt, or the single DMA interrupt) the OS moves the process to Ready.</li>
        <li><b>Asynchronous request:</b> the call starts the transfer and returns at once, and the requesting process keeps running; the OS finishes the transfer in the background and reports later (a flag, an event or a signal) that it has finished. The process must not use the buffer before then.</li>
        <li>With <b>programmed I/O</b> the request type makes no difference: the processor itself is stuck in the polling loop, so no other work gets done (a timer interrupt could preempt the process, but it goes back to spinning later).</li>
      </ul>
      <p><b>Nonblocking is not the same as asynchronous.</b> A <b>nonblocking call</b> only promises not to wait: it returns at once with whatever it could do right now (perhaps only part of the data) or, if nothing was ready, a "would block" error (EAGAIN in POSIX). It leaves no transfer running, so the program must call again later. Example: a nonblocking read() on an empty pipe whose writer is still open fails with EAGAIN; a byte written afterwards is obtained only by a new read(). An <b>asynchronous request</b> (POSIX aio_read, Windows overlapped I/O in section 11.10) hands the whole transfer to the OS, which completes it in the background and reports completion; the buffer is filled without another call.</p>

      <h4>Where the processor's time goes: a worked example</h4>
      <p>Model in ticks: sending a command 1, moving a word through the processor 1, interrupt overhead H (saving the context, finding the cause, entering and leaving the handler), DMA setup 4 (one per item), each DMA word costs at most one stolen tick. For N words and a device that needs D ticks per word:</p>
      <ul>
        <li>Programmed I/O: processor time on I/O = N(D + 2), all of it, because the waiting is spent polling.</li>
        <li>Interrupt-driven: processor time on I/O = N(H + 2); the D ticks per word are free for other work. The transfer ends at N(D + H + 2) because the device idles while each handler runs.</li>
        <li>DMA: processor time on I/O = 4 + N + H (setup, stolen ticks, one interrupt); the transfer ends at 4 + ND + H.</li>
      </ul>
      <p>Example: N = 8, D = 10, H = 4 gives 96, 48 and 16 processor ticks. Programmed I/O leaves nothing for other processes; DMA leaves the most and also finishes first (t = 88, against 96 and 128). Two special cases: if H &gt; D (a fast device), interrupt-driven I/O costs <i>more</i> than polling, which is why fast block devices use DMA; and for a single word DMA's fixed cost (4 + 1 + H) is more than interrupt-driven I/O's cost for that word (1 + H + 1), so DMA pays off for multi-word blocks.</p>

      <h4>The evolution of the I/O function, in six steps</h4>
      <ol>
        <li>The processor directly controls a peripheral device (it drives the device's signals itself).</li>
        <li>A controller or I/O module is added. The processor uses programmed I/O without interrupts, but no longer needs to know the device's details.</li>
        <li>The same configuration with interrupts: the processor no longer waits for the device.</li>
        <li>The I/O module gets direct control of memory through DMA: a block moves without the processor, except at the start and the end.</li>
        <li>The I/O module becomes an <b>I/O channel</b>: a processor with a specialized I/O instruction set. The CPU places an <b>I/O program</b> (channel program) in <b>main memory</b> and tells the channel to run it; the channel performs the whole sequence and interrupts only when it is done.</li>
        <li>The I/O module becomes an <b>I/O processor</b>: it has its own <b>local memory</b> and is a computer in its own right. It can control a large set of devices (for example many terminals) with minimal CPU involvement.</li>
      </ol>
      <p>Each step frees the processor from one more chore: device signals (2), waiting (3), carrying each word (4), issuing each command of a multi-step job (5), and the routine control of many devices (6). The steps are a logical progression, not a strict timeline: IBM mainframes had channels from the late 1950s, decades before the original IBM PC (1981) used a separate DMA controller chip. Today most devices do their own DMA as <b>bus masters</b> (devices that take control of the bus and start their own transfers), and SSD controllers or smart network cards contain their own processor cores and memory, the I/O-processor idea.</p>

      <h4>DMA in detail</h4>
      <p>To start a transfer the processor gives the DMA module four items: <b>read or write</b>, the <b>address of the I/O device</b>, the <b>starting location in memory</b> (loaded into the address register) and the <b>number of words</b> (loaded into the count register). The DMA module then moves the block one word at a time over the bus, adding 1 to the address register and subtracting 1 from the count register after each word. When the count reaches 0 it sends one interrupt to the processor.</p>
      <p><b>Cycle stealing:</b> for each bus transfer the DMA module takes the bus for one bus cycle (one per word in most layouts, two with detached DMA; see below). If the processor needs the bus in that cycle (to fetch an instruction or an operand, or to write a result) it simply pauses for one cycle; if it is busy inside itself (decoding, executing) the steal costs nothing. This is not an interrupt: no context is saved and no handler runs. The processor runs a little slower, but far less than if it moved every word itself.</p>
      <p>The DMA module checks nothing; it writes to the physical addresses it was given. So the OS gives it only a buffer the requesting process owns and keeps those frames locked in memory (frame locking) until the completion interrupt; otherwise a page moved mid-transfer would have its frame overwritten. Modern machines also add an IOMMU, hardware that limits which memory a device may reach.</p>

      <h4>DMA configurations</h4>
      <table>
        <tr><th>Configuration</th><th>How it is wired</th><th>System-bus cycles per word</th></tr>
        <tr><td>Single-bus, detached DMA</td><td>Processor, memory, DMA module and I/O modules all share one system bus.</td><td>2 (I/O module → DMA module, DMA module → memory)</td></tr>
        <tr><td>Single-bus, integrated DMA-I/O</td><td>DMA logic is part of an I/O module, or linked to one or more I/O modules by a private path.</td><td>1 (DMA module → memory)</td></tr>
        <tr><td>I/O bus</td><td>A separate I/O bus links all I/O modules to one DMA module.</td><td>1; the DMA module needs only one I/O-side interface, and new devices just plug into the I/O bus</td></tr>
      </table>
      <p>Example: a 512-word block needs 2 × 512 = 1024 system-bus transfers with detached DMA and 512 with either of the other two. Every system-bus cycle the DMA module uses is one the processor may lose, so fewer system-bus cycles per word means less slowdown during a transfer.</p>`,
  });
})();
