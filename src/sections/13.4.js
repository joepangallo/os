/* =====================================================================
   13.4 TinyOS
   Original teaching material. Helpers shared by several steps live inside
   this IIFE (no globals).
   ===================================================================== */
(function () {
  // hot(): an SVG group that behaves like a button (click, Enter or Space).
  function hot(s, label, act, ...kids) {
    return s('g', {
      class: 'hot', role: 'button', tabindex: 0, 'aria-label': label,
      onclick: act,
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } },
    }, ...kids);
  }

  // The sensor field used in step 1: position of each mote and the next hop toward the base station (0).
  const FIELD = [
    null,
    { x: 180, y: 92, up: 0 }, { x: 180, y: 222, up: 0 }, { x: 300, y: 46, up: 1 }, { x: 302, y: 150, up: 1 },
    { x: 312, y: 262, up: 2 }, { x: 424, y: 96, up: 4 }, { x: 430, y: 206, up: 4 }, { x: 540, y: 52, up: 6 },
    { x: 556, y: 150, up: 6 }, { x: 548, y: 262, up: 7 },
  ];
  const BASE = { x: 62, y: 156 };
  // The same tree drawn top-down for small screens (base station at the top).
  const FIELD_S = [
    null,
    { x: 90, y: 116 }, { x: 250, y: 116 }, { x: 40, y: 206 }, { x: 140, y: 206 },
    { x: 290, y: 206 }, { x: 70, y: 296 }, { x: 200, y: 296 }, { x: 40, y: 386 },
    { x: 130, y: 386 }, { x: 250, y: 386 },
  ];
  const BASE_S = { x: 170, y: 36 };
  const pathOf = (m) => { const p = [m]; while (p[p.length - 1] !== 0) p.push(FIELD[p[p.length - 1]].up); return p; };
  const relaysFor = (m) => FIELD.reduce((n, f, k) => n + (k && k !== m && pathOf(k).includes(m) ? 1 : 0), 0);

  // The sense-and-send application of step 3: the module, the configuration, and what every line does.
  const MOD_SRC = `
module SenseC {
  uses interface Boot;
  uses interface SplitControl as RadioControl;
  uses interface Timer<TMilli>;
  uses interface Read<uint16_t> as Sensor;
  uses interface AMSend;
  uses interface Leds;
}
implementation {
  uint16_t latest;
  message_t pkt;
  task void senseTask() { call Sensor.read(); }
  task void sendTask() {
    uint16_t* p = call AMSend.getPayload(&pkt, sizeof(uint16_t));
    *p = latest;
    call AMSend.send(AM_BROADCAST_ADDR, &pkt, sizeof(uint16_t));
  }
  event void Boot.booted() { call RadioControl.start(); }
  event void RadioControl.startDone(error_t e) { call Timer.startPeriodic(1000); }
  event void RadioControl.stopDone(error_t e) { }
  event void Timer.fired() { post senseTask(); }
  event void Sensor.readDone(error_t e, uint16_t v) { latest = v; post sendTask(); }
  event void AMSend.sendDone(message_t* m, error_t e) { call Leds.led0Toggle(); }
}`;
  const MOD_NOTES = [
    ['spec', 'Starts a <b>module</b> named SenseC: a component whose behaviour is written as nesC code. The braces hold its specification, the list of interfaces it uses and provides.'],
    ['spec', 'SenseC <b>uses</b> Boot. Some other component must provide it, and SenseC will receive its booted event when the mote has finished starting up.'],
    ['spec', 'SplitControl is the standard on/off interface for hardware that takes time to switch on. <code>as RadioControl</code> gives it a local name so the code reads clearly.'],
    ['spec', 'A timer that counts in milliseconds. SenseC can start it, and is told each time it fires.'],
    ['spec', 'Read is the general “take one reading” interface; here a reading is a 16-bit number. SenseC calls it Sensor.'],
    ['spec', 'Sends Active Message packets, the basic radio packet format of TinyOS.'],
    ['spec', 'Turns the mote’s LEDs on and off, a cheap way to show that something happened.'],
    ['spec', 'End of the specification. SenseC <b>provides</b> no interfaces: it is the top of this application, so no other component calls it.'],
    ['impl', 'The implementation: the module’s variables, tasks and event handlers.'],
    ['data', 'A variable for the newest reading. Its 2 bytes are reserved when the program is compiled: there is no malloc.'],
    ['data', 'The buffer for one radio packet, also reserved at compile time. During a send its address is lent to the radio component.'],
    ['task', 'A <b>task</b>. When the scheduler runs it, it calls the read command, which starts a sensor reading and returns at once. The value is not ready yet: it will arrive in readDone.'],
    ['task', 'A second task, which sends the latest reading.'],
    ['task', 'Asks the radio component where the data area (payload) of the packet buffer starts.'],
    ['task', 'Copies the reading into the packet.'],
    ['task', 'Starts sending the packet to every neighbour in range (the broadcast address). The command returns at once; the radio chip works on its own and sendDone will report the end.'],
    ['task', 'sendTask ends. It ran to completion without ever waiting for the radio.'],
    ['event', 'Handler for the <b>booted</b> event, the first of our code to run. It asks for the radio to be switched on and returns.'],
    ['event', 'The second half of that split-phase start: the radio is now on. Start a timer that fires every 1000 ms. (Real code would first check <code>e</code> for an error.)'],
    ['event', 'Never needed here, but required: a component that uses an interface must handle <b>every</b> event of it, so an empty handler is written.'],
    ['event', 'Each second the timer fires. TinyOS signals Timer.fired from a task of the timer system that delivers every client’s fired event in turn, so the handler does not do the work itself: it <b>posts</b> senseTask and returns at once.'],
    ['event', 'The second half of the read: the value arrives. Store it and post sendTask.'],
    ['event', 'The second half of the send: the packet has gone and <code>pkt</code> may be reused. Toggle an LED as a heartbeat.'],
    ['impl', 'End of the module. There is no main loop and no waiting anywhere: the module only reacts to events.'],
  ];
  const CFG_SRC = `
configuration SenseAppC { }
implementation {
  components MainC, LedsC, ActiveMessageC, SenseC;
  components new TimerMilliC();
  components new DemoSensorC() as SensorC;
  components new AMSenderC(AM_SENSE);
  SenseC.Boot -> MainC.Boot;
  SenseC.RadioControl -> ActiveMessageC.SplitControl;
  SenseC.Timer -> TimerMilliC.Timer;
  SenseC.Sensor -> SensorC.Read;
  SenseC.AMSend -> AMSenderC.AMSend;
  SenseC.Leds -> LedsC.Leds;
}`;
  const CFG_NOTES = [
    ['spec', 'A <b>configuration</b> named SenseAppC. The empty braces mean it neither provides nor uses any interface: it is the top level of the whole program.'],
    ['impl', 'A configuration’s implementation holds no ordinary code, only a list of components and the wires between them.'],
    ['list', 'The components this application needs. MainC boots the mote, LedsC drives the LEDs, ActiveMessageC is the radio stack and SenseC is our module.'],
    ['list', '<code>new</code> makes a fresh instance of a generic component: a timer of our own. Other components can make their own instances without interfering.'],
    ['list', 'An instance of the board’s default sensor, renamed SensorC. On each type of mote DemoSensorC leads to whatever real sensor that board has, so the application stays portable.'],
    ['list', 'An instance of the packet sender for one message type. AM_SENSE is a small number, defined in a header, that tells receivers what kind of packet this is.'],
    ['wire', 'A <b>wire</b>: SenseC uses Boot and MainC provides it. The arrow always points from the user to the provider.'],
    ['wire', 'SenseC’s RadioControl is wired to the radio stack’s SplitControl, so <code>RadioControl.start()</code> switches the radio on.'],
    ['wire', 'The timer interface goes to our timer instance.'],
    ['wire', 'Sensor goes to the sensor’s Read interface.'],
    ['wire', 'Packets go to our sender instance.'],
    ['wire', 'And the LEDs go to LedsC.'],
    ['impl', 'Done. The compiler follows these wires, and the wires inside every component they name, down to the hardware, and keeps only what it reaches.'],
  ];
  const NOTE_KIND = { spec: ['specification', 'os'], impl: ['structure', 'accent'], data: ['variable', 'mem'], task: ['task', 'proc'], event: ['event handler', 'intr'], list: ['components', 'os'], wire: ['wiring', 'io'] };

  // codeTour(): a listing on the left and, on the right, what the clicked line does (every line has a note).
  function codeTour(ctx, src, notes, intro, start, below, side) {
    const { h } = ctx;
    const code = ctx.ui.code(src, { lang: 'c', fontSize: 13 });
    code.style.margin = '0'; code.style.flexShrink = '0';
    const lines = String(src).replace(/^\n+|\s+$/g, '').split('\n');
    const head = h('div', { class: 'row gap-s' });
    const text = h('div', { class: 'mono small', style: { background: 'var(--panel-3)', borderRadius: '8px', padding: '6px 10px', overflowWrap: 'anywhere' } });
    const note = h('p', { class: 'm0', style: { fontSize: '16px', lineHeight: 1.45 } });
    let cur = start || 1;
    function pick(n) {
      cur = ctx.util.clamp(n, 1, lines.length);
      code.mark(cur);
      const [k, c] = NOTE_KIND[notes[cur - 1][0]];
      head.innerHTML = `<span class="chip">line ${cur} of ${lines.length}</span><span class="chip ${c}">${k}</span>`;
      text.textContent = lines[cur - 1].trim();
      note.innerHTML = notes[cur - 1][1];
    }
    code.querySelectorAll('.ln').forEach((ln, i) => {
      ln.style.cursor = 'pointer'; ln.setAttribute('role', 'button'); ln.tabIndex = 0;
      ln.addEventListener('click', () => pick(i + 1));
      ln.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i + 1); } });
    });
    const el = h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 1fr) 370px', gap: '16px', height: '100%' } },
      h('div', { class: 'stack' }, code, below || null),
      h('div', { class: 'stack', style: { gap: '10px' } }, h('p', { class: 'small m0', html: intro }), head, text, note,
        h('div', { class: 'row', style: { marginTop: '2px' } },
          h('button', { class: 'btn sm', type: 'button', onclick: () => pick(cur - 1) }, '◀ Previous line'),
          h('button', { class: 'btn sm primary', type: 'button', onclick: () => pick(cur + 1) }, 'Next line ▶')),
        side || null));
    pick(cur);
    return el;
  }

  // The six wires of SenseAppC: interface type, SenseC's local name, provider, commands and events.
  const WIRES = [
    { type: 'Boot', local: 'Boot', prov: 'MainC', cmds: [], evts: [['booted()', 'The mote has finished starting up; the application’s own code begins here.']],
      note: 'Boot has an event but no commands: nobody asks MainC to boot, it just announces when booting is over.' },
    { type: 'SplitControl', local: 'RadioControl', prov: 'ActiveMessageC', cmds: [['start()', 'Switch the radio on.'], ['stop()', 'Switch it off.']], evts: [['startDone(error)', 'The radio is now on.'], ['stopDone(error)', 'The radio is now off.']],
      note: 'Powering up a radio chip takes time, so on/off is split-phase: a command starts it, an event says it is finished.' },
    { type: 'Timer<TMilli>', local: 'Timer', prov: 'TimerMilliC', cmds: [['startPeriodic(dt)', 'Fire every dt milliseconds.'], ['startOneShot(dt)', 'Fire once, dt milliseconds from now.'], ['stop()', 'Cancel the timer.']], evts: [['fired()', 'The time is up.']],
      note: 'The classic two-way interface: the user starts the timer with a command and hears back through an event.' },
    { type: 'Read<uint16_t>', local: 'Sensor', prov: 'SensorC', cmds: [['read()', 'Start one measurement.']], evts: [['readDone(error, value)', 'Here is the measurement.']],
      note: 'A measurement can take from microseconds to tenths of a second, so it is split-phase too.' },
    { type: 'AMSend', local: 'AMSend', prov: 'AMSenderC', cmds: [['send(addr, msg, len)', 'Start sending a packet.'], ['cancel(msg)', 'Try to stop a send in progress.'], ['getPayload(msg, len)', 'Where the data goes inside the packet.']], evts: [['sendDone(msg, error)', 'The packet has gone; the buffer is yours again.']],
      note: 'Until sendDone arrives, the packet buffer belongs to the radio stack and must not be changed.' },
    { type: 'Leds', local: 'Leds', prov: 'LedsC', cmds: [['led0On(), led0Off(), led0Toggle()', 'Control LED 0 (the same exist for LEDs 1 and 2).']], evts: [],
      note: 'Leds has commands only: switching an LED is instant, so there is nothing to report back.' },
  ];
  const COMPS = {
    SenseC: ['module', 'proc', 'Your application logic, written as nesC code (see the Module tab). It uses six interfaces and provides none, so it sits at the top of the program.'],
    MainC: ['TinyOS component', 'os', 'Starts the mote: it initializes the hardware and the scheduler, then signals Boot.booted.'],
    ActiveMessageC: ['TinyOS configuration', 'os', 'The radio stack. It is itself a configuration that wires many smaller components, all the way down to the driver for the radio chip.'],
    TimerMilliC: ['generic component', 'os', 'Each <code>new TimerMilliC()</code> is one virtual timer of its own. Underneath, all of them share a single hardware timer.'],
    SensorC: ['generic component', 'os', 'DemoSensorC, renamed: the board’s default sensor, offered through the standard Read interface.'],
    AMSenderC: ['generic component', 'os', 'A packet sender for one message type. Several senders share the one radio; a queue underneath lets them take turns.'],
    LedsC: ['TinyOS component', 'os', 'Drives the LED pins of the board.'],
    SenseAppC: ['configuration', 'accent', 'The configuration: it names the seven components and draws the six wires between them. It contains no code of its own.'],
  };

  // The mote simulator of step 5, following the TinyOS 2.x model. One tick is one illustrative time unit;
  // currents are illustrative (TelosB-like) in mA.
  const MOTE = { period: 30, first: 6, adc: 5, radio: 6,
    len: { senseTask: 3, sendTask: 3, logTask: 3, crunchTask: 6, firedTask: 1, readDoneTask: 1, sendDoneTask: 1, notifyTask: 1 } };
  const AMPS = { cpu: 2, sleep: 0.005, adc: 0.5, radio: 20 };
  // Low-level interrupt handlers (async code): they run at once, even inside a task, and only post a task.
  const IRQS = {
    timer: ['T', 'timer compare interrupt', 'async event void Alarm.fired() { post firedTask(); }', 'firedTask'],
    adc: ['R', 'A/D conversion-done interrupt', 'async event void Adc.dataReady(v) { sample = v; post readDoneTask(); }', 'readDoneTask'],
    radio: ['S', 'radio transmit-done interrupt', 'async event void Radio.txDone() { post sendDoneTask(); }', 'sendDoneTask'],
    button: ['B', 'button interrupt', 'async event void Pin.fired() { post notifyTask(); }', 'notifyTask'],
  };
  // The tasks those handlers post. Each signals one completion event, so the application's handler runs inside a task.
  const EVTASKS = {
    firedTask: ['T', 'Timer.fired', 'event void Timer.fired() { post senseTask(); }', 'senseTask'],
    readDoneTask: ['R', 'Sensor.readDone', 'event void Sensor.readDone(e, v) { latest = v; post sendTask(); }', 'sendTask'],
    sendDoneTask: ['S', 'AMSend.sendDone', 'event void AMSend.sendDone(m, e) { call Leds.led0Toggle(); }', null],
    notifyTask: ['B', 'Button.notify', 'event void Button.notify(s) { post logTask(); }', 'logTask'],
  };
  const TASKS = {
    senseTask: 'task void senseTask() { call Sensor.read(); }',
    sendTask: 'task void sendTask() { fill pkt; call AMSend.send(…); }',
    logTask: 'task void logTask() { presses++; save the count; }',
    crunchTask: 'task void crunchTask() { average the last 64 readings; }',
  };
  function makeMote() {
    const m = { t: 0, queue: [], run: null, irq: [], adcFrom: -1, adcAt: -1, radioFrom: -1, radioAt: -1, nextTimer: MOTE.first,
      btn: false, hist: [], q: { cpu: 0, sleep: 0, adc: 0, radio: 0 }, awake: 0, sent: 0, led: false };
    m.post = (name) => { if (m.queue.includes(name)) return false; m.queue.push(name); return true; };
    m.tick = () => {
      const t = m.t, said = [];
      const adcOn = t >= m.adcFrom && t < m.adcAt, radioOn = t >= m.radioFrom && t < m.radioAt;
      const wasAsleep = !m.hist.length || m.hist[m.hist.length - 1].cpu === 'sleep';
      if (t === m.nextTimer) { m.irq.push('timer'); m.nextTimer += MOTE.period; }
      if (t === m.adcAt) m.irq.push('adc');
      if (t === m.radioAt) m.irq.push('radio');
      if (m.btn) { m.irq.push('button'); m.btn = false; }
      let rec, tone = '';
      if (m.irq.length) {
        const k = m.irq.shift(), [letter, nm, code, posts] = IRQS[k];
        rec = { cpu: 'isr', name: nm, letter, code, pre: m.run ? m.run.name : null };
        said.push(`The <b>${nm}</b> handler runs` + (m.run ? `, cutting into <b>${m.run.name}</b>, which is paused for this tick only.` : wasAsleep ? ', waking the CPU from sleep.' : '.'));
        if (k === 'radio') { m.sent++; said.push('The packet is on its way.'); }
        said.push(m.post(posts) ? `This <code>async</code> handler only posts <b>${posts}</b>, which joins the tail of the queue; ${EVTASKS[posts][1]} will be signalled when that task runs.`
          : `Its post of ${posts} fails: that task is already waiting in the queue.`);
        tone = 'intr';
      } else {
        if (!m.run && m.queue.length) { const nm = m.queue.shift(); m.run = { name: nm, left: MOTE.len[nm] }; said.push(`The scheduler takes <b>${nm}</b> from the head of the queue.`); }
        if (m.run) {
          const r = m.run, ev = EVTASKS[r.name];
          r.left--;
          rec = ev ? { cpu: 'task', name: r.name, ev: ev[0], code: `task void ${r.name}() { signal ${ev[1]}(…); }  →  ${ev[2]}` } : { cpu: 'task', name: r.name, code: TASKS[r.name] };
          if (r.left > 0) said.push(`<b>${r.name}</b> runs (${r.left} more tick${r.left === 1 ? '' : 's'}). No other task can start until it returns` + (m.queue.length ? `; waiting: ${m.queue.join(', ')}.` : '.'));
          else {
            m.run = null;
            if (ev) {
              said.push(`<b>${r.name}</b> signals <b>${ev[1]}</b>, so the application’s event handler runs inside this task.`);
              if (r.name === 'sendDoneTask') { m.led = !m.led; said.push('The packet buffer is free again and the LED toggles. Nothing is posted.'); }
              if (ev[3]) said.push(m.post(ev[3]) ? `The handler posts <b>${ev[3]}</b> and returns.` : `The handler’s post of ${ev[3]} fails: that task is already waiting in the queue.`);
            } else if (r.name === 'senseTask') { m.adcFrom = t + 1; m.adcAt = t + 1 + MOTE.adc; said.push('senseTask calls <code>Sensor.read()</code>: the A/D conversion starts and the call returns at once, so the task finishes. The value will arrive later in an event (split-phase).'); }
            else if (r.name === 'sendTask') { m.radioFrom = t + 1; m.radioAt = t + 1 + MOTE.radio; said.push('sendTask fills the packet and calls <code>AMSend.send()</code>: the radio starts transmitting on its own, and the task finishes.'); }
            else said.push(`<b>${r.name}</b> runs to completion and returns.`);
          }
          tone = 'ok';
        } else {
          rec = { cpu: 'sleep', name: 'asleep', code: null };
          said.push('The task queue is empty, so the scheduler puts the CPU to sleep.' +
            (adcOn ? ' The sensor keeps converting on its own.' : '') + (radioOn ? ' The radio keeps transmitting on its own.' : '') +
            (!adcOn && !radioOn ? ` Next timer interrupt: tick ${m.nextTimer}.` : ''));
        }
      }
      rec.t = t; rec.adc = adcOn; rec.radio = radioOn;
      m.hist.push(rec);
      if (rec.cpu === 'sleep') m.q.sleep += AMPS.sleep; else { m.q.cpu += AMPS.cpu; m.awake++; }
      if (adcOn) m.q.adc += AMPS.adc;
      if (radioOn) m.q.radio += AMPS.radio;
      m.t++;
      return { html: `<b>Tick ${t}.</b> ` + said.join(' '), tone };
    };
    return m;
  }

  // Step 6 panels: a dedicated resource, a virtualized timer, and a shared bus behind an arbiter.
  function resDedicated(ctx, p) {
    const { h, s } = ctx;
    const slim = ctx.narrow;
    const svg = s('svg', { viewBox: slim ? '0 0 340 300' : '0 0 620 220', width: '100%' });
    const box = (x, y, w, hh, cls, t1, t2) => [s('rect', { x, y, width: w, height: hh, rx: 12, class: cls, 'stroke-width': 2.5 }),
      s('text', { x: x + w / 2, y: y + (t2 ? 30 : 28), 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, t1),
      t2 ? s('text', { x: x + w / 2, y: y + 50, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 }, t2) : null];
    if (slim) svg.append(...box(20, 10, 300, 64, 's-os', 'Timer system', 'the one owner'),
      s('line', { x1: 170, y1: 76, x2: 170, y2: 136, style: 'stroke:var(--os)', 'stroke-width': 4, 'marker-end': 'url(#arr-os)' }),
      s('text', { x: 182, y: 110, 'font-size': 13, 'font-weight': 700 }, 'exclusive wire'),
      ...box(20, 142, 300, 64, 's-cpu', 'Hardware timer', 'compare register + interrupt'),
      ...box(20, 222, 90, 40, 's-panel', 'Radio'), ...box(125, 222, 90, 40, 's-panel', 'SenseC'), ...box(230, 222, 90, 40, 's-panel', 'Flash'),
      s('text', { x: 170, y: 286, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, '✗ not wired to it: they ask the owner'));
    else svg.append(...box(20, 70, 190, 70, 's-os', 'Timer system', 'the one owner'),
      ...box(400, 70, 200, 70, 's-cpu', 'Hardware timer', 'compare register + interrupt'),
      s('line', { x1: 212, y1: 105, x2: 394, y2: 105, style: 'stroke:var(--os)', 'stroke-width': 4, 'marker-end': 'url(#arr-os)' }),
      s('text', { x: 304, y: 94, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'exclusive wire'),
      ...box(30, 168, 120, 44, 's-panel', 'Radio'), ...box(170, 168, 120, 44, 's-panel', 'SenseC'),
      s('text', { x: 306, y: 188, 'font-size': 13, class: 's-sub' }, '✗ not wired to the hardware timer:'),
      s('text', { x: 306, y: 206, 'font-size': 13, class: 's-sub' }, 'they ask the owner for virtual timers'),
      ...box(30, 8, 120, 44, 's-panel', 'Flash'), s('text', { x: 170, y: 36, 'font-size': 13, class: 's-sub' }, '✗ no access either'));
    p.append(h('div', { class: 'stack', style: { gap: '10px' } },
      h('h3', { class: 'm0' }, 'Dedicated: exactly one user'),
      h('div', { class: 'card white tight' }, svg),
      h('p', { class: 'm0', html: 'A <span class="t">dedicated resource</span> is wired to a single component, so there is never any contention and no arbiter is needed. Many low-level pieces are dedicated, such as a hardware timer’s compare register (it raises an interrupt when the count reaches a set value) or an interrupt line.' }),
      h('div', { class: 'callout why small m0', 'data-label': 'Layers', html: 'An owner often turns around and offers a friendlier service on top. The timer system owns one dedicated hardware timer and hands out as many <span class="t" data-t="virtualized resource">virtual timers</span> as the application asks for. Open <b>Virtualized</b> to watch it.' })));
  }
  function resVirtual(ctx, p) {
    const { h, s } = ctx;
    const CL = [['A', 250, 'proc'], ['B', 400, 'thread'], ['C', 1000, 'io']];
    let next, fired;
    const VW = ctx.narrow ? 360 : 620;
    const svg = s('svg', { viewBox: `0 0 ${VW} 150`, width: '100%' });
    const tbl = h('table', { class: 'tbl compact' });
    const alarm = h('div', { class: 'big', style: { fontSize: '30px' } });
    const narr = h('div', { class: 'narr', style: { minHeight: '66px' } });
    const X = (ms) => 70 + ms / 1500 * (VW - 90);
    function reset() { next = { A: 250, B: 400, C: 1000 }; fired = []; narr.innerHTML = 'Three components each created their own timer. Underneath there is only one hardware timer, so the virtualizer sets its alarm to the <b>earliest</b> deadline: 250 ms, client A.'; draw(); }
    function advance() {
      const at = Math.min(...Object.values(next));
      if (at > 1500) { narr.innerHTML = 'That is enough for this picture. Press Reset to start again.'; return; }
      const who = CL.filter(([c]) => next[c] === at).map(([c]) => c);
      fired.push([at, who]);
      who.forEach((c) => { next[c] += CL.find((x) => x[0] === c)[1]; });
      const nx = Math.min(...Object.values(next)), nw = CL.filter(([c]) => next[c] === nx).map(([c]) => c);
      narr.innerHTML = `The hardware alarm fires at <b>${at} ms</b>. The virtualizer finds ${who.length > 1 ? 'clients <b>' + who.join(' and ') + '</b> both due: each gets its own fired event, one after the other' : 'client <b>' + who[0] + '</b> due and signals its fired event'}, moves ${who.length > 1 ? 'their' : 'its'} next deadline forward, then re-arms the hardware for the earliest deadline still pending: <b>${nx} ms</b> (${nw.join(' and ')}).`;
      draw();
    }
    function draw() {
      const hw = Math.min(...Object.values(next));
      alarm.textContent = hw + ' ms';
      tbl.replaceChildren(h('thead', {}, h('tr', {}, ...['Client', 'Period', 'Next deadline', 'Fired so far'].map((x) => h('th', {}, x)))),
        h('tbody', {}, ...CL.map(([c, per, cls]) => h('tr', { class: next[c] === hw ? 'on' : '' },
          h('td', {}, h('span', { class: 'chip ' + cls }, 'timer ' + c)), h('td', {}, per + ' ms'), h('td', { class: 'num' }, next[c] + ' ms'),
          h('td', { class: 'num' }, String(fired.filter(([, w]) => w.includes(c)).length))))));
      const kids = [];
      [...CL.map(([c, , cls]) => [c, cls]), ['hardware', 'cpu']].forEach(([c, cls], i) => {
        const y = 18 + i * 30;
        kids.push(s('text', { x: 62, y: y + 5, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, c === 'hardware' ? 'hardware' : 'timer ' + c));
        kids.push(s('line', { x1: 70, y1: y, x2: VW - 10, y2: y, class: 's-muted', 'stroke-dasharray': '3 5' }));
        fired.forEach(([at, w]) => { if (c === 'hardware' || w.includes(c)) kids.push(s('circle', { cx: X(at), cy: y, r: 7, class: 's-' + cls, 'stroke-width': 2 })); });
        if (c !== 'hardware' && next[c] <= 1500) kids.push(s('circle', { cx: X(next[c]), cy: y, r: 7, class: 's-panel', 'stroke-dasharray': '3 2', 'stroke-width': 2 }));
      });
      (ctx.narrow ? [0, 500, 1000, 1500] : [0, 250, 500, 750, 1000, 1250, 1500]).forEach((ms) => kids.push(s('text', { x: X(ms), y: 144, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(ms))));
      svg.replaceChildren(...kids);
    }
    p.append(h('div', { class: 'stack', style: { gap: '10px' } },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Virtualized: three timers on one'),
        h('div', { class: 'row gap-s' }, h('button', { class: 'btn sm primary', type: 'button', onclick: advance }, 'Advance to next alarm ▸'), h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Reset'))),
      h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 1fr) 150px', gap: '12px', height: 'auto' } }, tbl,
        h('div', { class: 'card tight cpu center' }, h('div', { class: 'xs b', style: { color: 'var(--cpu)' } }, 'HARDWARE ALARM'), alarm, h('div', { class: 'xs muted' }, 'earliest deadline'))),
      h('div', { class: 'card white tight' }, svg), narr));
    reset();
  }
  function resShared(ctx, p) {
    const { h } = ctx;
    const NM = ['Radio', 'Flash', 'Sensor'], CLS = ['io', 'mem', 'proc'];
    let owner, wait, policy = 'fcfs';
    const cards = h('div', { class: 'grid-3', style: { gap: '10px' } });
    const arb = h('div', { class: 'card tight os stack', style: { gap: '4px' } });
    const bus = h('div', { class: 'card tight stack', style: { gap: '4px' } });
    const narr = h('div', { class: 'narr', style: { minHeight: '64px' } });
    const log = h('div', { class: 'log grow', style: { minHeight: '40px', fontSize: '13px' } });
    const say = (html, tone) => { narr.className = 'narr ' + (tone || ''); narr.innerHTML = html; log.prepend(h('div', {}, html.replace(/<[^>]+>/g, ''))); };
    function pickNext(released) {
      if (!wait.length) return null;
      if (policy === 'fcfs') return wait[0];
      for (let k = 1; k <= NM.length; k++) { const c = (released + k) % NM.length; if (wait.includes(c)) return c; }
      return null;
    }
    function request(c) {
      if (owner === null && !wait.length) { owner = c; say(`<b>${NM[c]}</b> calls request(). The bus is free, so the arbiter signals <b>granted</b> to ${NM[c]} (and the bus is powered up).`, 'ok'); }
      else { wait.push(c); say(`<b>${NM[c]}</b> calls request(). The bus belongs to ${NM[owner]}, so the request waits; it is number ${wait.length} in line.`); }
      draw();
    }
    function release(c) {
      owner = null;
      const n = pickNext(c);
      if (n === null) say(`<b>${NM[c]}</b> calls release(). Nobody is waiting, so the bus goes back to its default owner, a power manager that switches it off to save energy.`);
      else {
        wait.splice(wait.indexOf(n), 1); owner = n;
        const why = policy === 'fcfs' ? `${NM[n]} asked first among those waiting` : `in the circular order Radio → Flash → Sensor → Radio, ${NM[n]} is the first waiting client after ${NM[c]}`;
        say(`<b>${NM[c]}</b> calls release(). The arbiter signals <b>granted</b> to <b>${NM[n]}</b>, because ${why}.`, 'ok');
      }
      draw();
    }
    function draw() {
      cards.replaceChildren(...NM.map((n, c) => {
        const st = owner === c ? ['owns the bus', 'ok'] : wait.includes(c) ? ['waiting (' + (wait.indexOf(c) + 1) + ')', 'warn'] : ['idle', ''];
        return h('div', { class: 'card tight stack', style: { gap: '6px', borderColor: `var(--${CLS[c]})` } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, n), h('span', { class: 'chip ' + st[1] }, st[0])),
          h('div', { class: 'row gap-s' },
            h('button', { class: 'btn sm', type: 'button', disabled: owner === c || wait.includes(c), onclick: () => request(c) }, 'request'),
            h('button', { class: 'btn sm', type: 'button', disabled: owner !== c, onclick: () => release(c) }, 'release')));
      }));
      arb.replaceChildren(h('div', { class: 'xs b', style: { color: 'var(--os)' } }, 'ARBITER · ' + (policy === 'fcfs' ? 'FIRST COME, FIRST SERVED' : 'ROUND ROBIN')),
        h('div', { class: 'small' }, 'Waiting, in order of arrival: ', h('b', {}, wait.length ? wait.map((c) => NM[c]).join(', ') : 'nobody')));
      bus.replaceChildren(h('div', { class: 'xs b muted' }, 'SHARED SPI BUS'),
        h('div', { class: 'small' }, owner === null ? 'No owner: switched off by its power manager' : h('span', {}, 'In use by ', h('b', {}, NM[owner]))));
    }
    function reset(msg) { owner = null; wait = []; log.innerHTML = ''; say(msg || 'The radio chip, the flash chip and a sensor share one SPI bus (a simple serial link from the microcontroller to its chips), and only one may use it at a time. Press <b>request</b> on a client, or run the example.'); draw(); }
    function example() {
      reset('Example: Sensor holds the bus; Flash asks, then Radio asks; then Sensor releases.');
      request(2); request(1); request(0); release(2);
    }
    const seg = ctx.ui.seg([{ value: 'fcfs', label: 'First come, first served' }, { value: 'rr', label: 'Round robin' }], policy, (v) => { policy = v; draw(); say(v === 'fcfs' ? 'Policy: the request that has waited longest is granted next (a FIFO arbiter).' : 'Policy: after a release, the arbiter checks the clients in a fixed circular order, starting just after the one that released.'); });
    p.append(h('div', { class: 'stack', style: { gap: '9px', height: '100%' } },
      h('div', { class: 'row', style: { gap: '8px' } }, seg, h('button', { class: 'btn sm primary', type: 'button', onclick: example }, 'Run the example'), h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset')),
      cards, h('div', { class: 'grid-2', style: { gap: '10px' } }, arb, bus), narr, log));
    reset();
  }

  Guide.section({
    id: '13.4',
    title: 'TinyOS',
    short: 'TinyOS',
    summary: 'TinyOS runs sensor motes with wired components, a FIFO task queue, split-phase events and sleep when idle.',
    objectives: [
      'Describe a wireless sensor network, what a mote contains, and the goals an operating system for motes must meet.',
      'Explain why TinyOS has no separate kernel, no processes and no virtual memory, and how one program image is built from components.',
      'Read a nesC wiring: tell modules from configurations, and the commands of an interface from its events.',
      'Trace how tasks, interrupt handlers and split-phase operations share one processor and one stack, and why the mote sleeps whenever the task queue is empty.',
      'Tell dedicated, virtualized and shared resources apart, predict an arbiter’s grants, and estimate battery life from a duty cycle.',
    ],
    terms: [
      ['Wireless sensor network (WSN)', 'A network of many small, battery-powered computers spread over an area. Each one measures something in the physical world and radios its readings, often relayed hop by hop, to a collection point.'],
      ['Mote (sensor node)', 'One small computer in a wireless sensor network: a microcontroller with a few kilobytes of RAM and some flash memory, plus sensors, a low-power radio and a battery.'],
      ['Base station (sink)', 'The collection point of a sensor network. It receives the readings the motes send and passes them on to an ordinary computer or the internet.'],
      ['TinyOS', 'An open-source operating system for wireless sensor motes, begun at UC Berkeley around 2000. It is a library of small components that is compiled together with one application into a single program image.'],
      ['nesC', 'The dialect of C that TinyOS and its applications are written in. It adds components, interfaces and wiring to C, and its compiler analyses the whole program at once.'],
      ['Component (nesC component)', 'A building block of a TinyOS program. It provides some interfaces and uses others, and it can reach the rest of the system only through those interfaces.'],
      ['Interface (nesC interface)', 'A named, two-way contract between two components. It lists the commands the user may call and the events the provider will signal back.'],
      ['Command (nesC command)', 'A function in an interface that the user of the interface calls and the provider implements. Commands travel down toward the hardware and ask for something, such as “start a timer” or “send this packet”.'],
      ['Event (nesC event)', 'A function in an interface that the provider signals and the user must implement. Events travel up toward the application and report that something happened, such as “the timer fired” or “the packet was sent”.'],
      ['Module (nesC module)', 'A component whose behaviour is written as nesC code: its variables, the commands it implements, its event handlers and its tasks.'],
      ['Configuration (nesC configuration)', 'A component that contains no ordinary code. It names other components and wires their interfaces together; it can itself be used as a component.'],
      ['Wiring', 'Connecting an interface that one component uses to a component that provides it. Wiring is written in a configuration and fixed when the program is compiled.'],
      ['Task (TinyOS task)', 'A function that is posted to run later. The scheduler keeps posted tasks in a first-in, first-out queue and runs each one to completion; tasks never preempt one another.'],
      ['Run to completion', 'Once a task starts, it keeps the processor until it returns. Interrupt handlers may cut in briefly, but no other task runs in the middle.'],
      ['Split-phase operation', 'A long operation divided into two halves: a command starts it and returns at once, and an event later reports that it has finished. Nobody blocks while waiting.'],
      ['Duty cycle', 'The fraction of time a device is awake and drawing full power. A mote whose processor and radio are on 1 % of the time has a 1 % duty cycle.'],
      ['Dedicated resource', 'A hardware resource that exactly one component ever uses, so no sharing rules are needed.'],
      ['Virtualized resource', 'A resource that software splits into logical copies so that each client seems to have its own, as when many software timers run on one hardware timer.'],
      ['Shared resource', 'A resource that several clients must take turns using, one at a time, under the control of an arbiter.'],
      ['Arbiter', 'The component that decides which client may use a shared resource next. Clients call request and release; the arbiter signals granted to the client it picks, following a policy such as first-come-first-served or round robin.'],
    ],
    css: `
      .sec-13-4 .hot { cursor: pointer; }
      .sec-13-4 .hot:focus { outline: none; }
      .sec-13-4 .hot:focus-visible .hb { stroke: var(--accent); stroke-width: 4; }
      .sec-13-4 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; }
      .sec-13-4 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-13-4 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-13-4 .narr.intr { border-left-color: var(--intr); background: var(--intr-bg); }
      .sec-13-4 .grid-2 > *, .sec-13-4 .grid-3 > * { min-width: 0; }
      .sec-13-4 pre.code { line-height: 1.4; }
    `,
    steps: [
      /* ---------------- 1. Big picture: sensor networks and motes ---------------- */
      {
        title: 'Thousands of tiny computers in a field',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:10px">
              <p class="lead m0">Picture a vineyard dotted with two hundred matchbox-sized computers. Each one checks the soil every few minutes and radios the reading home, for a year or more on two AA batteries.</p>
              <p class="m0">That is a <span class="t">wireless sensor network</span>. Each node, called a <span class="t">mote</span>, is a tiny <span class="t">microcontroller</span> with sensors and a low-power radio. Most motes are too far from home to reach it directly, so readings hop from mote to mote until they reach the <span class="t">base station</span>, which hands them to an ordinary computer.</p>
              <p class="m0">A desktop operating system would not even fit on such a device. <span class="t">TinyOS</span>, an open-source system begun at UC Berkeley around 2000, was designed from scratch for it.</p>
              <div class="callout analogy m0" data-label="Analogy">A bucket brigade across a field: nobody can carry the bucket all the way to the barn, so each person passes it to a neighbour who is a little closer.</div>
              <div class="row gap-s small"><span class="chip io">follow a reading hop by hop</span><span class="chip os">wire components</span><span class="chip proc">run the task queue</span><span class="chip intr">share a bus</span><span class="chip ok">stretch a battery</span></div>
            </div>
            <div class="card stack wsn-host" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const host = ctx.$('.wsn-host');
          function network(p) {
            const slim = ctx.narrow, POS = slim ? FIELD_S : FIELD, B = slim ? BASE_S : BASE;
            const svg = s('svg', { viewBox: slim ? '0 0 340 440' : '0 0 620 310', width: '100%' });
            const narr = h('div', { class: 'narr', style: { minHeight: '92px' } });
            let sel = 9;
            function draw() {
              const path = pathOf(sel), on = new Set();
              for (let k = 0; k + 1 < path.length; k++) on.add(path[k] + '-' + path[k + 1]);
              const kids = [];
              FIELD.forEach((f, k) => {
                if (!f) return;
                const a = POS[k], to = f.up ? POS[f.up] : B, lit = on.has(k + '-' + f.up);
                const dx = to.x - a.x, dy = to.y - a.y, len = Math.hypot(dx, dy);
                const cut = f.up ? 25 : len * Math.min(48 / Math.max(Math.abs(dx), 1e-6), 34 / Math.max(Math.abs(dy), 1e-6));
                kids.push(s('line', { x1: a.x, y1: a.y, x2: lit ? to.x - dx / len * cut : to.x, y2: lit ? to.y - dy / len * cut : to.y, class: lit ? '' : 's-muted', style: lit ? 'stroke:var(--io)' : '', 'stroke-width': lit ? 4 : 1.5, 'stroke-dasharray': lit ? '' : '5 6', 'marker-end': lit ? 'url(#arr-io)' : '' }));
              });
              kids.push(s('rect', { x: B.x - 44, y: B.y - 30, width: 88, height: 60, rx: 10, class: 's-os', 'stroke-width': 2.5 }));
              kids.push(s('text', { x: B.x, y: B.y - 4, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, 'Base'));
              kids.push(s('text', { x: B.x, y: B.y + 15, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, 'station'));
              FIELD.forEach((f, k) => {
                if (!f) return;
                const inPath = path.includes(k), me = k === sel, a = POS[k];
                kids.push(hot(s, 'Mote ' + k, () => { sel = k; draw(); },
                  s('circle', { class: 'hb ' + (me ? 's-io' : inPath ? 's-warn' : 's-panel'), cx: a.x, cy: a.y, r: 21, 'stroke-width': me ? 3.5 : 2 }),
                  s('text', { x: a.x, y: a.y + 6, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 17 }, String(k))));
              });
              kids.push(s('text', slim ? { x: 170, y: 432, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 } : { x: 610, y: 304, 'text-anchor': 'end', class: 's-sub', 'font-size': 13 }, 'dashed = radio link toward the base station'));
              svg.replaceChildren(...kids);
              const hops = path.length - 1, relay = relaysFor(sel);
              const route = path.map((k) => (k ? String(k) : 'base')).join(' → ');
              narr.innerHTML = `<b>Mote ${sel}</b>: its reading needs <b>${hops} hop${hops === 1 ? '' : 's'}</b> (${route}). ` +
                (relay ? `Mote ${sel} also forwards the readings of <b>${relay}</b> other mote${relay === 1 ? '' : 's'}, so its radio is on more often and its battery drains faster.`
                  : `No other mote routes through it, so its radio only carries its own readings.`) +
                ' Click any mote.';
            }
            draw();
            p.append(h('div', { class: 'stack', style: { gap: '8px' } }, svg, narr));
          }
          const parts = [
            ['Microcontroller', 'cpu', '16-bit, 8 MHz', 'Runs TinyOS and the application. It sleeps most of the time.'],
            ['RAM', 'mem', '10 KB', 'Every variable, buffer and the single stack must fit here.'],
            ['Flash', 'mem', '48 KB', 'Holds the program image: TinyOS plus the application. A separate 1 MB flash chip stores data.'],
            ['Radio', 'io', '250 kbit/s', 'Low-power, short range (tens of metres). The biggest energy user when on.'],
            ['Sensors', 'io', 'light · heat · humidity', 'Read through an analog-to-digital converter.'],
            ['Battery', 'warn', '2 × AA', 'No wall socket, and often nobody comes to change it.'],
          ];
          const tabs = ctx.ui.tabs([
            { label: 'The network', render: network },
            { label: 'Inside a mote', render: (p) => {
              p.append(h('div', { class: 'stack', style: { gap: '10px' } },
                h('p', { class: 'small m0' }, 'A typical mote of the mid-2000s (TelosB-class). Older MICA-class motes had even less: 4 KB of RAM.'),
                h('div', { class: 'grid-3', style: { gap: '10px' } }, ...parts.map(([n, c, v, d]) => h('div', { class: 'box ' + c, style: { textAlign: 'left', padding: '8px 10px' } },
                  h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, n), h('span', { class: 'chip ' + c }, v)),
                  h('div', { class: 'small', style: { fontWeight: 500, marginTop: '4px' } }, d)))),
                h('div', { class: 'callout why small m0', 'data-label': 'Scale', html: 'A laptop with 16 GB of RAM has about <b>1.7 million times</b> the memory of this mote. Everything a conventional OS takes for granted has to be rethought.' })));
            } },
            { label: 'What the OS must do', render: (p) => {
              const goals = [
                ['ok', 'Use almost no power', 'Keep the processor and radio asleep nearly all the time and wake only when something happens.'],
                ['mem', 'Fit in a tiny memory', 'A few kilobytes of RAM leaves no room for big tables or one stack per thread.'],
                ['proc', 'Handle concurrency', 'Sensing, computing, sending and relaying for neighbours all overlap, and radio data must be caught in time.'],
                ['intr', 'Be robust', 'Run unattended for months, with nobody nearby to press reset.'],
                ['os', 'Fit many designs', 'Many mote designs and many applications: build only the parts each one needs.'],
              ];
              p.append(h('div', { class: 'stack', style: { gap: '8px' } }, ...goals.map(([c, t, d], i) => h('div', { class: 'row nw', style: { gap: '12px', alignItems: 'flex-start' } },
                h('span', { class: 'chip ' + c, style: { minWidth: '28px', justifyContent: 'center' } }, String(i + 1)),
                h('div', {}, h('b', {}, t), h('div', { class: 'small' }, d))))));
            } },
          ]);
          host.append(tabs);
        },
      },

      /* ---------------- 2. What TinyOS leaves out ---------------- */
      {
        title: 'Not a conventional operating system',
        kind: 'learn',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:10px">
              <p class="lead m0">TinyOS drops most of what you have learned to expect from an operating system.</p>
              <p class="m0">There is no <span class="t">kernel</span> running underneath an application. TinyOS is a library of small software <span class="t" data-t="component">components</span> (timers, radio, sensors, LEDs). You write your application as components too, and the compiler joins your components with exactly the TinyOS components they use into <b>one program image</b>.</p>
              <div class="row nw" style="gap:6px;font-size:13.5px">
                <div class="box proc grow">your app components</div><b>+</b>
                <div class="box os grow">TinyOS components it uses</div><b>→</b>
                <div class="box cpu grow">one image in flash</div>
              </div>
              <p class="m0">Components nobody uses are left out, so the system is only as big as the application needs: blinking an LED from a timer takes a few kilobytes of code and well under a kilobyte of RAM.</p>
              <div class="callout warn small m0" data-label="Common mistake">Picturing TinyOS as a tiny Linux that loads programs. A mote runs exactly one image; to change the program you build a new image and reprogram the mote.</div>
            </div>
            <div class="stack lo-host"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const FEAT = [
            ['Kernel / user mode', 'The kernel runs in a privileged mode; applications run in user mode and enter the kernel through system calls.', 'No boundary. Application and OS components run together, at one privilege level, and call each other with ordinary function calls.', 'Only one trusted program runs on a mote, and many microcontrollers have no protection hardware anyway. Skipping the boundary saves time and code.'],
            ['Processes', 'Many independent programs, each with its own address space, run side by side.', 'Exactly one application, and it is the whole system. There is nothing to create, switch or kill.', 'A mote does one job for its whole life, so the machinery for many programs would be pure overhead.'],
            ['Threads with stacks', 'Every thread owns a stack big enough for its deepest call chain, often several kilobytes.', 'One stack, shared by every task and interrupt handler. Tasks run to completion, so they never need a stack of their own.', 'RAM. Try the stack budget tab: a handful of thread stacks would eat most of a mote’s memory. (TinyOS 2.1 added an optional thread library for those who accept that cost.)'],
            ['Virtual memory', 'An MMU translates addresses through page tables; pages move between RAM and disk.', 'None. Programs use physical addresses directly.', 'The microcontroller has no MMU and the mote has no disk to page to.'],
            ['Dynamic allocation', 'The heap grows and shrinks at run time (malloc and free).', 'All memory is reserved when the program is compiled, so the compiler reports exactly how much RAM the image needs.', 'A failed allocation in month five, with nobody nearby, is far worse than a compile-time error. No heap also means no fragmentation.'],
            ['Run-time loading', 'Programs and libraries are loaded from a file system while the system runs.', 'The whole program is compiled at once; unused components are dropped and calls between components can be inlined.', 'Smaller, faster code, and the compiler can check the whole program, for example for data races.'],
          ];
          const host = ctx.$('.lo-host');
          function leftOut(p) {
            let cur = 0;
            const detail = h('div', { class: 'stack', style: { gap: '8px' } });
            const btns = FEAT.map((f, i) => h('button', { class: 'btn sm', type: 'button', onclick: () => show(i) }, f[0]));
            function show(i) {
              cur = i; btns.forEach((b, j) => b.classList.toggle('on', j === cur));
              const [name, conv, tiny, why] = FEAT[i];
              detail.replaceChildren(
                h('h3', { class: 'm0' }, name),
                h('div', { class: 'card tight' }, h('div', { class: 'xs b muted' }, 'CONVENTIONAL OS'), h('div', { style: { fontSize: '15.5px' } }, conv)),
                h('div', { class: 'card tight os' }, h('div', { class: 'xs b', style: { color: 'var(--os)' } }, 'TINYOS'), h('div', { style: { fontSize: '15.5px' } }, tiny)),
                h('div', { class: 'callout why m0', 'data-label': 'Why', style: { fontSize: '15.5px' } }, why));
              detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');
            }
            p.append(h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'small m0' }, 'Click a feature every desktop OS has to see what TinyOS does instead, and why.'),
              h('div', { class: 'grid-3', style: { gap: '8px' } }, ...btns), detail));
            show(0);
          }
          function budget(p) {
            const DATA = 1200, ONE = 256;
            let ram = 10240, n = 6, stk = 512;
            const bars = h('div', { class: 'stack', style: { gap: '12px' } });
            const msg = h('div', { class: 'narr' });
            const bar = (label, parts, total) => {
              const used = parts.reduce((a, b) => a + b[1], 0), over = used > total;
              return h('div', { class: 'stack', style: { gap: '4px' } },
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, label),
                  h('span', { class: 'chip ' + (over ? 'bad' : 'ok') }, `${used.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} bytes · ${Math.round(used / total * 100)}%`)),
                h('div', { style: { display: 'flex', height: '26px', borderRadius: '8px', overflow: 'hidden', background: 'var(--panel-3)', border: '1px solid var(--line)' } },
                  ...parts.map(([nm, b, c]) => h('div', { title: nm + ': ' + b + ' bytes', style: { width: Math.min(100, b / total * 100) + '%', background: `var(--${c})`, opacity: 0.85, borderRight: '2px solid var(--panel)' } }))));
            };
            function draw() {
              const thr = DATA + n * stk, tiny = DATA + ONE;
              bars.replaceChildren(
                bar(`One thread per activity (${n} stacks)`, [['data and buffers', DATA, 'mem'], ...Array.from({ length: n }, (_, k) => ['stack ' + (k + 1), stk, 'thread'])], ram),
                bar('TinyOS (one shared stack)', [['data and buffers', DATA, 'mem'], ['shared stack', ONE, 'proc']], ram));
              const fits = thr <= ram;
              msg.className = 'narr ' + (fits ? '' : 'bad');
              msg.innerHTML = `Threads: ${DATA.toLocaleString('en-US')} + ${n} × ${stk} = <b>${thr.toLocaleString('en-US')} bytes</b>${fits ? ` (${Math.round(thr / ram * 100)}% of RAM)` : ': <b>does not fit</b>'}. ` +
                `TinyOS: ${DATA.toLocaleString('en-US')} + ${ONE} = <b>${tiny.toLocaleString('en-US')} bytes</b> (${Math.round(tiny / ram * 100)}%), however many activities overlap.`;
            }
            const ramSeg = ctx.ui.seg([{ value: 4096, label: '4 KB RAM' }, { value: 10240, label: '10 KB RAM' }], ram, (v) => { ram = v; draw(); });
            const stkSeg = ctx.ui.seg([128, 256, 512].map((v) => ({ value: v, label: v + ' B' })), stk, (v) => { stk = v; draw(); });
            const nSl = ctx.ui.slider({ label: 'Activities', min: 1, max: 12, value: n, onInput: (v) => { n = v; draw(); } });
            p.append(h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'row', style: { gap: '14px' } }, ramSeg, h('span', { class: 'small b' }, 'Stack each'), stkSeg),
              nSl, bars, msg,
              h('p', { class: 'xs muted m0' }, 'Illustrative sizes: 1,200 bytes of variables and radio buffers, 256 bytes for the one shared stack. A thread stack must cover its deepest call chain plus an interrupt arriving at the worst moment, and with no MMU an overflow silently corrupts memory, so programmers size stacks generously.')));
            draw();
          }
          host.append(h('div', { class: 'grow' }, ctx.ui.tabs([{ label: 'What is left out', render: leftOut }, { label: 'The stack budget', render: budget }])),
            h('p', { class: 'xs muted m0' }, 'History: the last TinyOS release (2.1.2) appeared in 2012. Newer systems such as Contiki-NG, RIOT and Zephyr now run many sensor devices, but TinyOS remains the classic example of an OS shaped entirely by tiny hardware.'));
        },
      },

      /* ---------------- 3. Components, interfaces, commands and events ---------------- */
      {
        title: 'Components wired by interfaces',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          function diagram(p) {
            const W = 700, H = 436;
            const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' });
            const detail = h('div', { class: 'stack', style: { gap: '8px' } });
            const intro = h('p', { class: 'small m0', html: 'TinyOS programs are built from <span class="t" data-t="component">components</span> written in <span class="t">nesC</span>. A component <b>provides</b> some <span class="t" data-t="interface">interfaces</span> and <b>uses</b> others. The user of an interface calls its <span class="t" data-t="command">commands</span> and must handle all its <span class="t" data-t="event">events</span>; the provider does the opposite. A <span class="t" data-t="configuration">configuration</span> does the <span class="t">wiring</span>. Click any box or label.' });
            const wid = WIRES.map((w) => Math.max(78, 20 + w.prov.length * 8.5));
            const gap = (660 - wid.reduce((a, b) => a + b, 0)) / (WIRES.length - 1);
            const px = []; wid.reduce((x, wd) => { px.push(x); return x + wd + gap; }, 20);
            const PY = 316, PH = 58, SX = 190, SW = 320, SY = 50, SH = 64;
            let sel = { kind: 'wire', i: 2 };
            const pick = (v) => { sel = v; draw(); };
            const listBox = h('div', { class: 'stack', style: { gap: '6px', width: '100%' } });
            function drawList() {
              const b = (label, on, cls, act) => h('button', { class: 'btn sm ' + cls + (on ? ' on' : ''), type: 'button', onclick: act }, label);
              listBox.replaceChildren(
                b('configuration SenseAppC', sel.name === 'SenseAppC', '', () => pick({ kind: 'comp', name: 'SenseAppC' })),
                b('SenseC (module): uses …', sel.name === 'SenseC', 'proc', () => pick({ kind: 'comp', name: 'SenseC' })),
                ...WIRES.map((w, i) => h('div', { class: 'row nw', style: { gap: '6px' } },
                  b(w.type, sel.kind === 'wire' && sel.i === i, 'mono', () => pick({ kind: 'wire', i })), h('span', {}, '→'),
                  b(w.prov, sel.name === w.prov, 'os', () => pick({ kind: 'comp', name: w.prov })))));
              showDetail();
            }
            function draw() {
              if (ctx.narrow) { drawList(); return; }
              const kids = [];
              kids.push(hot(s, 'Configuration SenseAppC', () => pick({ kind: 'comp', name: 'SenseAppC' }),
                s('rect', { class: 'hb', x: 6, y: 6, width: W - 12, height: H - 12, rx: 16, style: 'fill:transparent;stroke:var(--accent)', 'stroke-width': sel.name === 'SenseAppC' ? 3.5 : 2, 'stroke-dasharray': '8 6' }),
                s('text', { x: 20, y: 30, 'font-weight': 800, 'font-size': 15, style: 'fill:var(--accent)' }, 'configuration SenseAppC')));
              WIRES.forEach((w, i) => {
                const x1 = SX + 26 + i * (SW - 52) / (WIRES.length - 1), y1 = SY + SH, x2 = px[i] + wid[i] / 2, y2 = PY;
                const on = sel.kind === 'wire' && sel.i === i;
                const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
                kids.push(s('line', { x1, y1, x2, y2, style: on ? 'stroke:var(--accent)' : 'stroke:var(--line-2)', 'stroke-width': on ? 4 : 2.5 }));
                if (on) {
                  const o = 14, a = 26;
                  if (w.cmds.length) kids.push(s('line', { x1: x1 + nx * o + ux * a, y1: y1 + ny * o + uy * a, x2: x2 + nx * o - ux * a, y2: y2 + ny * o - uy * a, style: 'stroke:var(--cpu)', 'stroke-width': 3, 'marker-end': 'url(#arr-cpu)' }));
                  if (w.evts.length) kids.push(s('line', { x1: x2 - nx * o - ux * a, y1: y2 - ny * o - uy * a, x2: x1 - nx * o + ux * a, y2: y1 - ny * o + uy * a, style: 'stroke:var(--intr)', 'stroke-width': 3, 'marker-end': 'url(#arr-intr)' }));
                }
                const ly = i % 2 ? 236 : 168, lx = x1 + (ly - y1) / dy * dx, lw = w.type.length * 7.6 + 16;
                kids.push(hot(s, 'Interface ' + w.type, () => pick({ kind: 'wire', i }),
                  s('rect', { class: 'hb ' + (on ? 's-accent' : 's-panel'), x: lx - lw / 2, y: ly - 14, width: lw, height: 26, rx: 13, 'stroke-width': on ? 2.5 : 1.5 }),
                  s('text', { x: lx, y: ly + 4, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'mono' }, w.type)));
              });
              kids.push(hot(s, 'Module SenseC', () => pick({ kind: 'comp', name: 'SenseC' }),
                s('rect', { class: 'hb s-proc', x: SX, y: SY, width: SW, height: SH, rx: 12, 'stroke-width': sel.name === 'SenseC' ? 4 : 2.5 }),
                s('text', { x: SX + SW / 2, y: SY + 28, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 18 }, 'SenseC'),
                s('text', { x: SX + SW / 2, y: SY + 49, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 }, 'module · your code · uses 6 interfaces')));
              WIRES.forEach((w, i) => {
                const me = sel.name === w.prov;
                kids.push(hot(s, 'Component ' + w.prov, () => pick({ kind: 'comp', name: w.prov }),
                  s('rect', { class: 'hb s-os', x: px[i], y: PY, width: wid[i], height: PH, rx: 10, 'stroke-width': me ? 4 : 2 }),
                  s('text', { x: px[i] + wid[i] / 2, y: PY + 34, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14 }, w.prov)));
              });
              kids.push(s('text', { x: W / 2, y: PY + PH + 22, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 }, 'TinyOS components that provide the interfaces'));
              kids.push(s('line', { x1: 150, y1: 408, x2: 150, y2: 424, style: 'stroke:var(--cpu)', 'stroke-width': 3, 'marker-end': 'url(#arr-cpu)' }),
                s('text', { x: 162, y: 422, 'font-size': 13 }, 'commands (called down)'),
                s('line', { x1: 390, y1: 424, x2: 390, y2: 408, style: 'stroke:var(--intr)', 'stroke-width': 3, 'marker-end': 'url(#arr-intr)' }),
                s('text', { x: 402, y: 422, 'font-size': 13 }, 'events (signalled up)'));
              svg.replaceChildren(...kids);
              showDetail();
            }
            const list = (items, cls, empty) => items.length
              ? h('div', { class: 'stack', style: { gap: '3px' } }, ...items.map(([sig, d]) => h('div', { class: 'small' }, h('code', { style: { color: `var(--${cls})` } }, sig), ' ', d)))
              : h('div', { class: 'small muted' }, empty);
            function showDetail() {
              if (sel.kind === 'wire') {
                const w = WIRES[sel.i];
                detail.replaceChildren(
                  h('div', { class: 'row gap-s' }, h('span', { class: 'chip accent' }, 'interface'), h('span', { class: 'chip proc' }, 'used by SenseC as ' + w.local), h('span', { class: 'chip os' }, 'provided by ' + w.prov)),
                  h('h3', { class: 'm0 mono' }, w.type),
                  h('div', { class: 'card tight cpu' }, h('div', { class: 'xs b', style: { color: 'var(--cpu)' } }, '↓ COMMANDS: SenseC calls, ' + w.prov + ' implements'), list(w.cmds, 'cpu', 'none')),
                  h('div', { class: 'card tight intr' }, h('div', { class: 'xs b', style: { color: 'var(--intr)' } }, '↑ EVENTS: ' + w.prov + ' signals, SenseC must handle'), list(w.evts, 'intr', 'none')),
                  h('p', { class: 'small m0' }, w.note));
              } else {
                const [k, c, d] = COMPS[sel.name];
                detail.replaceChildren(h('div', { class: 'row gap-s' }, h('span', { class: 'chip ' + c }, k)), h('h3', { class: 'm0 mono' }, sel.name), h('p', { class: 'm0', style: { fontSize: '16px' }, html: d }));
              }
            }
            p.append(h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 1fr) 390px', gap: '16px', height: '100%' } },
              h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center' } }, ctx.narrow ? listBox : svg), h('div', { class: 'stack', style: { gap: '10px' } }, intro, detail)));
            draw();
          }
          el.append(ctx.ui.tabs([
            { label: 'Wiring diagram', render: diagram },
            { label: 'The module (SenseC)', render: (p) => p.append(codeTour(ctx, MOD_SRC, MOD_NOTES, 'A <span class="t" data-t="module">module</span> is a component written as code. SenseC samples a sensor every second and radios each reading. Click any line to see what it does (error checks are left out to keep it short).', 12, null,
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Expecting <code>call Sensor.read()</code> to return the reading. It only <b>starts</b> the measurement; the value arrives later as an argument of readDone.' }))) },
            { label: 'The configuration (SenseAppC)', render: (p) => p.append(codeTour(ctx, CFG_SRC, CFG_NOTES, 'A <span class="t" data-t="configuration">configuration</span> holds no code: it lists components and wires them together. Click any line to see what it does.', 7,
              h('div', { class: 'card tight stack', style: { gap: '8px' } }, h('h4', { class: 'm0' }, 'Configurations nest'),
                h('div', { class: 'box accent', style: { textAlign: 'left', padding: '6px 10px' } }, h('div', { class: 'small b' }, 'SenseAppC (configuration)'),
                  h('div', { class: 'row nw', style: { gap: '8px', marginTop: '6px', alignItems: 'stretch' } },
                    h('div', { class: 'box proc small', style: { flex: 'none' } }, 'SenseC (module)'),
                    h('div', { class: 'box os small grow', style: { textAlign: 'left' } }, 'ActiveMessageC (configuration)',
                      h('div', { class: 'box os small', style: { marginTop: '6px', textAlign: 'left', fontWeight: 600 } }, 'radio-stack components …',
                        h('div', { class: 'box io small', style: { marginTop: '6px', fontWeight: 600 } }, 'radio chip driver (module that touches the hardware)')))))),
              h('div', { class: 'callout why small m0', 'data-label': 'Why wire at compile time', html: 'Every call’s destination is known before the mote ever runs, so the compiler can drop unused components, inline small functions and warn about data races.' }))) },
          ]));
        },
      },

      /* ---------------- 4. Tasks, interrupts and split-phase calls: predict the scheduler ---------------- */
      {
        title: 'Tasks, interrupts and split-phase calls',
        kind: 'predict',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">Two kinds of running code, and one rule for anything slow.</p>
              <div class="card tight proc"><b>Tasks: deferred work.</b> <span class="small"><code>post t();</code> puts <span class="t" data-t="TinyOS task">task</span> t at the tail of a first-in, first-out queue. When nothing else runs, the scheduler takes the head task and lets it <span class="t">run to completion</span>. Tasks never preempt each other. With the queue empty, the scheduler puts the microcontroller to sleep until the next interrupt.</span></div>
              <div class="card tight intr"><b>Interrupt handlers: right now.</b> <span class="small">An <span class="t">interrupt</span> runs its handler at once, even in the middle of a task, on the same stack. Good handlers are short: grab the data, post a task, return.</span></div>
              <div class="card tight io"><b>Split-phase calls: never wait.</b> <span class="small">A command starts a slow job (sensor, radio) and returns at once; an event reports completion later. Nobody blocks, so nobody needs a stack of their own. This is a <span class="t">split-phase operation</span>.</span></div>
              <p class="xs muted m0">TinyOS 2.x detail: completion events such as fired, readDone and sendDone are signalled from a small task that the low-level interrupt handler posts, so only that low-level handler cuts into a running task. Code that can run inside an interrupt must be marked <code>async</code>. The lab in the next step works this way.</p>
            </div>
            <div class="stack ps-host" style="gap:10px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const SC = [
            { q: 'Task A is running and still needs a few time units. A hardware timer interrupt arrives. What happens?',
              ch: ['The interrupt waits until A returns; then its handler runs.', 'The handler runs at once; then A carries on where it stopped.', 'A goes to the back of the task queue and the handler runs.'], a: 1,
              why: 'Interrupt handlers preempt tasks. The handler runs immediately and briefly on the same stack; when it returns, A resumes exactly where it was. A is never re-queued.',
              seg: [['t', 0, 2, 'A'], ['i', 2, 3, 'handler'], ['t', 3, 5, 'A resumes'], ['z', 5, 8, 'sleep']] },
            { q: 'Task A is running. Task B is already waiting in the queue. While running, A posts task C. When A returns, which task runs next?',
              ch: ['B, because it was posted first.', 'C, because it was posted most recently.', 'A again, until the queue is empty.'], a: 0,
              why: 'The task queue is first-in, first-out. B was posted before C, so B runs next and C waits its turn. Posting only appends to the tail.',
              seg: [['t', 0, 3, 'A posts C'], ['t', 3, 5, 'B'], ['t', 5, 7, 'C'], ['z', 7, 8, '']] },
            { q: 'Task A is running when an interrupt arrives. The handler posts task D and returns. What runs now?',
              ch: ['D, at once, because it came from an interrupt.', 'D and A take turns, one time unit each.', 'The rest of A; D runs when its turn in the queue comes.'], a: 2,
              why: 'Posting never preempts anything. D joins the tail of the queue; A, which was only paused by the handler, finishes first.',
              seg: [['t', 0, 2, 'A'], ['i', 2, 3, 'posts D'], ['t', 3, 5, 'A resumes'], ['t', 5, 7, 'D'], ['z', 7, 8, '']] },
            { q: 'The last task returns and the task queue is empty. What does the scheduler do?',
              ch: ['Loops, checking the queue again and again.', 'Puts the microcontroller into a low-power sleep until an interrupt.', 'Restarts the application from Boot.booted.'], a: 1,
              why: 'Checking an empty queue in a loop would be busy waiting and would drain the battery. The scheduler sleeps the microcontroller; any interrupt wakes it.',
              seg: [['t', 0, 2, 'A'], ['z', 2, 6, 'asleep'], ['i', 6, 7, 'wake'], ['t', 7, 8, '…']] },
            { q: 'Task A runs a calculation that takes 2 seconds. Meanwhile a packet arrives and the radio handler posts a task to process it. What happens?',
              ch: ['The packet task waits up to 2 seconds, and so does every other task.', 'After a time quantum the scheduler preempts A and runs the packet task.', 'The packet is lost, because interrupts are switched off while a task runs.'], a: 0,
              why: 'There is no time slicing between tasks. The handler still runs and saves the packet, but its task waits until A returns. The cure: split long work into short chunks, each ending by posting the next.',
              seg: [['t', 0, 3, 'A (long)'], ['i', 3, 4, 'packet'], ['t', 4, 7, 'A continues'], ['t', 7, 8, 'pkt']] },
          ];
          const host = ctx.$('.ps-host');
          let cur = 0;
          const answered = SC.map(() => null);
          const prompt = h('p', { class: 'm0', style: { fontSize: '16px', minHeight: '48px' } });
          const choices = h('div', { class: 'stack', style: { gap: '6px' } });
          const verdict = h('div', { class: 'narr', style: { minHeight: '66px' } });
          const TW = ctx.narrow ? 36 : 60, VW = 74 + 8 * TW + 6;
          const svg = s('svg', { viewBox: `0 0 ${VW} 122`, width: '100%' });
          const seg = ctx.ui.seg(SC.map((_, i) => ({ value: i, label: 'Scenario ' + (i + 1) })), 0, (v) => { cur = v; show(); });
          function timeline(sc) {
            const X = (t) => 74 + t * TW, LY = { i: 18, t: 52, z: 86 }, kids = [];
            [['i', 'interrupt'], ['t', 'tasks'], ['z', 'sleep']].forEach(([k, n]) => kids.push(s('text', { x: 66, y: LY[k] + 19, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, n)));
            kids.push(s('line', { x1: 74, y1: 118, x2: X(8), y2: 118, class: 's-line' }));
            sc.seg.forEach(([k, a, b, lab]) => {
              kids.push(s('rect', { x: X(a) + 1, y: LY[k], width: X(b) - X(a) - 2, height: 26, rx: 6, class: k === 'i' ? 's-intr' : k === 't' ? 's-proc' : 's-muted', 'stroke-width': 1.5 }));
              if (lab && lab.length * 7.2 <= X(b) - X(a)) kids.push(s('text', { x: (X(a) + X(b)) / 2, y: LY[k] + 18, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, lab));
            });
            svg.replaceChildren(...kids);
          }
          function show() {
            const sc = SC[cur], got = answered[cur];
            prompt.textContent = sc.q;
            choices.replaceChildren(...sc.ch.map((c, i) => h('button', {
              class: 'btn' + (got == null ? '' : i === sc.a ? ' on' : i === got ? ' danger' : ''), type: 'button',
              style: { height: 'auto', minHeight: '38px', whiteSpace: 'normal', justifyContent: 'flex-start', textAlign: 'left', padding: '6px 12px' },
              onclick: () => { answered[cur] = i; show(); } }, String.fromCharCode(65 + i) + '. ' + c)));
            if (got == null) {
              verdict.className = 'narr'; verdict.textContent = 'Commit to an answer first; then the timeline appears.';
              svg.replaceChildren(s('text', { x: VW / 2, y: 64, 'text-anchor': 'middle', class: 's-sub', 'font-size': 14 }, 'timeline hidden until you answer'));
            } else {
              verdict.className = 'narr ' + (got === sc.a ? 'ok' : 'bad');
              verdict.innerHTML = `<b>${got === sc.a ? 'Right.' : 'Not quite: the answer is ' + String.fromCharCode(65 + sc.a) + '.'}</b> ${sc.why}`;
              timeline(sc);
            }
          }
          host.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Predict the scheduler'), h('span', { class: 'small muted' }, 'time units are illustrative')),
            seg, prompt, choices, verdict, h('div', { class: 'card white tight' }, svg));
          show();
        },
      },

      /* ---------------- 5. The mote simulator ---------------- */
      {
        title: 'Run a mote: tasks, events and sleep',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const SHORT = { senseTask: 'sense', sendTask: 'send', logTask: 'log', crunchTask: 'crunch', firedTask: 'fired', readDoneTask: 'readDone', sendDoneTask: 'sendDone', notifyTask: 'notify' };
          const WN = ctx.narrow ? 22 : 36, TW = 15, X0 = 96, VW = X0 + WN * TW + 8;
          let m, playing = false, gen = 0;
          const svg = s('svg', { viewBox: `0 0 ${VW} 204`, width: '100%' });
          const narr = h('div', { class: 'narr', style: { minHeight: '68px', flex: 'none' } });
          const log = h('div', { class: 'log grow', style: { fontSize: '13px' } });
          const cpuChip = h('span', { class: 'chip' }), cpuCode = h('div', { class: 'mono small', style: { background: 'var(--panel-3)', borderRadius: '8px', padding: '5px 9px', minHeight: '29px', overflowWrap: 'anywhere' } });
          const cpuInfo = h('div', { class: 'small muted' });
          const qRow = h('div', { class: 'row nw', style: { gap: '5px' } });
          const runChip = h('div', { class: 'small' });
          const eBar = h('div', { style: { display: 'flex', height: '18px', borderRadius: '7px', overflow: 'hidden', background: 'var(--panel-3)', border: '1px solid var(--line)' } });
          const eText = h('div', { class: 'small', style: { lineHeight: 1.4 } });
          const EC = [['cpu', 'CPU', 'cpu'], ['radio', 'radio', 'io'], ['adc', 'sensor', 'warn'], ['sleep', 'sleep', 'ok']];
          function lanes() {
            const ws = Math.max(0, m.t - WN), kids = [], LY = [8, 42, 76, 110, 144];
            ['interrupts', 'tasks', 'CPU asleep', 'sensor A/D', 'radio'].forEach((n, i) => kids.push(s('text', { x: X0 - 8, y: LY[i] + 18, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, n)));
            const X = (tt) => X0 + (tt - ws) * TW;
            const runs = (lane, keyOf) => {
              let cur = null;
              const flush = () => { if (cur) lane(cur); cur = null; };
              for (let tt = ws; tt < m.t; tt++) {
                const k = keyOf(m.hist[tt]);
                if (cur && k === cur.k) cur.b = tt + 1; else { flush(); if (k) cur = { k, a: tt, b: tt + 1 }; }
              }
              flush();
            };
            const block = (y, cls, label, dashed) => (g) => {
              const w = (g.b - g.a) * TW;
              kids.push(s('rect', { x: X(g.a) + 1, y, width: w - 2, height: 26, rx: 5, class: cls, 'stroke-width': 1.5, 'stroke-dasharray': dashed ? '3 3' : null }));
              const txt = typeof label === 'function' ? label(g) : label;
              if (txt && txt.length * 7.4 + 4 <= w) kids.push(s('text', { x: X(g.a) + w / 2, y: y + 18, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, txt));
            };
            for (let tt = ws; tt < m.t; tt++) {
              const r = m.hist[tt];
              if (r.cpu === 'isr') {
                kids.push(s('rect', { x: X(tt) + 1, y: LY[0], width: TW - 2, height: 26, rx: 4, class: 's-intr', 'stroke-width': 1.5 }));
                kids.push(s('text', { x: X(tt) + TW / 2, y: LY[0] + 18, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, r.letter));
              } else if (r.ev) {  // a one-tick task that signals an event
                kids.push(s('rect', { x: X(tt) + 1, y: LY[1], width: TW - 2, height: 26, rx: 4, class: 's-os', 'stroke-width': 1.5 }));
                kids.push(s('text', { x: X(tt) + TW / 2, y: LY[1] + 18, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, r.ev));
              }
            }
            runs(block(LY[1], 's-proc', (g) => SHORT[g.k]), (r) => (r.cpu === 'task' && !r.ev ? r.name : null));
            runs(block(LY[1], 's-muted', '', true), (r) => (r.cpu === 'isr' && r.pre ? 'p:' + r.pre : null));
            runs(block(LY[2], 's-ok', 'asleep'), (r) => (r.cpu === 'sleep' ? 'z' : null));
            runs(block(LY[3], 's-warn', 'A/D busy'), (r) => (r.adc ? 'a' : null));
            runs(block(LY[4], 's-io', 'sending'), (r) => (r.radio ? 'r' : null));
            kids.push(s('line', { x1: X0, y1: 176, x2: X0 + WN * TW, y2: 176, class: 's-line' }));
            for (let tt = ws; tt <= ws + WN; tt++) if (tt % 5 === 0) kids.push(s('line', { x1: X(tt), y1: 172, x2: X(tt), y2: 180, class: 's-line' }), s('text', { x: X(tt), y: 197, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(tt)));
            kids.push(s('line', { x1: X(m.t), y1: 2, x2: X(m.t), y2: 176, style: 'stroke:var(--accent)', 'stroke-width': 2, 'stroke-dasharray': '4 3' }));
            svg.replaceChildren(...kids);
          }
          function panel() {
            const last = m.hist[m.hist.length - 1];
            if (!last) { cpuChip.className = 'chip'; cpuChip.textContent = 'not started'; cpuCode.textContent = 'Press Step or Play.'; }
            else {
              cpuChip.className = 'chip ' + (last.cpu === 'isr' ? 'intr' : last.ev ? 'os' : last.cpu === 'task' ? 'proc' : 'ok');
              cpuChip.textContent = last.cpu === 'isr' ? 'async interrupt handler' : last.ev ? 'task signalling an event' : last.cpu === 'task' ? 'running a task' : 'asleep';
              cpuCode.textContent = last.code || 'low-power sleep: only an interrupt can wake it';
            }
            cpuInfo.textContent = `Next tick ${m.t} · timer due at ${m.nextTimer} · packets sent ${m.sent} · LED ${m.led ? 'on' : 'off'}`;
            const slots = [];
            for (let k = 0; k < 4; k++) {
              const nm = m.queue[k];
              slots.push(h('div', { class: 'box ' + (nm ? (EVTASKS[nm] ? 'os' : 'proc') : ''), title: nm || null, style: { flex: '1', minWidth: '0', padding: '4px 1px', fontSize: '12.5px', borderStyle: nm ? 'solid' : 'dashed', opacity: nm ? 1 : 0.6, overflow: 'hidden', whiteSpace: 'nowrap' } }, nm ? SHORT[nm] : (k === 0 ? 'empty' : '·')));
            }
            if (m.queue.length > 4) slots.push(h('span', { class: 'small b' }, '+' + (m.queue.length - 4)));
            // on a small screen the HEAD/TAIL labels move under the row so that every task name fits in its slot
            if (ctx.narrow) qRow.replaceChildren(...slots);
            else qRow.replaceChildren(h('span', { class: 'xs b muted' }, 'HEAD'), ...slots, h('span', { class: 'xs b muted' }, 'TAIL'));
            runChip.innerHTML = m.run ? `Started but not finished: <b>${m.run.name}</b> (${m.run.left} tick${m.run.left === 1 ? '' : 's'} left).` : 'No task in progress.';
            const tot = EC.reduce((a, [k]) => a + m.q[k], 0);
            eBar.replaceChildren(...EC.map(([k, n, c]) => h('div', { title: n, style: { width: (tot ? m.q[k] / tot * 100 : 0) + '%', background: `var(--${c})` } })));
            const pc = (k) => (tot ? (m.q[k] / tot * 100).toFixed(m.q[k] / tot < 0.01 ? 2 : 1) : '0') + '%';
            eText.innerHTML = EC.map(([k, n, c]) => `<span class="chip ${c}">${n} ${pc(k)}</span>`).join(' ') +
              `<div style="margin-top:5px">CPU awake <b>${m.awake}</b> of ${m.t} ticks (${m.t ? Math.round(m.awake / m.t * 100) : 0}%) · average <b>${m.t ? ctx.util.fmt(tot / m.t, 2) : '0'} mA</b></div>`;
          }
          function say(r) { narr.className = 'narr ' + (r.tone || ''); narr.innerHTML = r.html; log.prepend(h('div', {}, r.html.replace(/<[^>]+>/g, ''))); while (log.children.length > 60) log.lastChild.remove(); }
          function draw() { lanes(); panel(); }
          function step() { say(m.tick()); draw(); }
          function reset() {
            gen++; playing = false; paintPlay();
            m = makeMote(); log.innerHTML = '';
            narr.className = 'narr';
            narr.innerHTML = 'The mote is asleep. Its timer will interrupt at tick 6. Press <b>Step</b> to advance one tick, or <b>Play</b>.';
            draw();
          }
          const bPlay = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { playing = !playing; paintPlay(); } });
          function paintPlay() { bPlay.textContent = playing ? 'Pause' : '▶ Play'; }
          const bIrq = h('button', { class: 'btn sm intr', type: 'button', onclick: () => {
            if (m.btn) { say({ html: '<b>Button pressed again</b> before the first press was handled. Its interrupt is already pending, so the two presses make a single interrupt.', tone: 'intr' }); return; }
            m.btn = true;
            // handlers run one per tick: interrupts already waiting, and any hardware interrupt due this tick, go first
            const at = m.t + m.irq.length + [m.nextTimer, m.adcAt, m.radioAt].filter((x) => x === m.t).length;
            say({ html: `<b>Button pressed.</b> Its interrupt will be handled at tick ${at}${at > m.t ? ', after the interrupt' + (at - m.t > 1 ? 's' : '') + ' already due' : ''}${m.run ? `, in the middle of <b>${m.run.name}</b>` : ''}; Button.notify comes later, from the task that handler posts.`, tone: 'intr' });
          } }, 'Interrupt: button');
          const bLong = h('button', { class: 'btn sm proc', type: 'button', onclick: () => {
            const ok = m.post('crunchTask');
            say(ok ? { html: `Some component posts <b>crunchTask</b> (a ${MOTE.len.crunchTask}-tick calculation). It joins the tail of the queue at position ${m.queue.length}.`, tone: 'ok' }
              : { html: '<b>Post fails.</b> crunchTask is already waiting in the queue, and TinyOS 2.x keeps just one slot for each task, so the second post returns FAIL.', tone: 'bad' });
            panel();
          } }, '+ Post crunchTask (6 ticks)');
          ctx.every(450, () => { if (playing) step(); });
          const controls = h('div', { class: 'row', style: { gap: '8px' } },
            h('button', { class: 'btn sm', type: 'button', onclick: () => { playing = false; paintPlay(); step(); } }, 'Step ▸'), bPlay,
            h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Reset'),
            h('span', { style: { width: '6px' } }), bIrq, bLong);
          const card = (...kids) => h('div', { class: 'card tight stack', style: { gap: '6px', flex: 'none' } }, ...kids);
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 1fr) 390px', gap: '16px' } },
            h('div', { class: 'stack', style: { gap: '8px' } }, controls,
              h('div', { class: 'card white tight', style: { padding: '6px 8px', flex: 'none' } }, svg),
              h('div', { class: 'xs muted' }, 'Red blocks are low-level async interrupt handlers (T = timer, R = sensor A/D, S = radio, B = button): they cut in at once and only post a task. The violet task with the same letter signals the event (Timer.fired, Sensor.readDone, AMSend.sendDone, Button.notify) when the queue reaches it. Dashed = task paused by an interrupt. One cycle is squeezed into 30 ticks.'),
              narr, log),
            h('div', { class: 'stack', style: { gap: '8px' } },
              card(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'CPU on the last tick'), cpuChip), cpuCode, cpuInfo),
              card(h('h4', { class: 'm0' }, 'Task queue (first in, first out)'), qRow, ctx.narrow ? h('div', { class: 'xs muted' }, 'Head on the left, tail on the right.') : null, runChip),
              card(h('h4', { class: 'm0' }, 'Where the charge went (illustrative)'), eBar, eText),
              h('div', { class: 'card tight small', style: { lineHeight: 1.35, flex: 'none' } }, h('b', {}, 'Try these'),
                h('ol', { class: 'm0', style: { paddingLeft: '20px' } },
                  h('li', {}, 'Play one cycle. What uses most of the charge?'),
                  h('li', {}, 'Post crunchTask, then interrupt while it runs.'),
                  h('li', {}, 'Post crunchTask near tick 34: Timer.fired waits.'),
                  h('li', {}, 'Post crunchTask twice in a row.'))))));
          reset();
          return () => { gen++; playing = false; };
        },
      },

      /* ---------------- 6. Resources: dedicated, virtualized, shared ---------------- */
      {
        title: 'Sharing scarce hardware: three kinds of resource',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const KINDS = [
            ['dedicated', 'Dedicated', 'cpu', 'One component owns it for good, such as a hardware timer’s compare register. No sharing rules needed.'],
            ['virtual', 'Virtualized', 'proc', 'Software turns one resource into many copies: every new TimerMilliC() is a virtual timer of its own.'],
            ['shared', 'Shared', 'io', 'Clients take turns, one at a time, and an arbiter decides who is next, as on the SPI bus of the radio and flash chips.'],
          ];
          const PANEL = { dedicated: resDedicated, virtual: resVirtual, shared: resShared };
          const host = h('div', { class: 'stack', style: { height: '100%' } });
          let cur = 'shared', cleanup = null;
          const btns = KINDS.map(([k, n, c, d]) => h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false',
            style: { height: 'auto', whiteSpace: 'normal', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '8px 12px', gap: '2px' },
            onclick: () => show(k) },
            h('span', { class: 'row gap-s' }, h('span', { class: 'chip ' + c }, n)), h('span', { class: 'small', style: { fontWeight: 500 } }, d)));
          function show(k) {
            if (typeof cleanup === 'function') cleanup();
            cur = k;
            btns.forEach((b, i) => { b.classList.toggle('on', KINDS[i][0] === k); b.setAttribute('aria-pressed', KINDS[i][0] === k ? 'true' : 'false'); });
            host.innerHTML = '';
            cleanup = PANEL[k](ctx, host);
            ctx.refit();
          }
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 380px) minmax(0, 1fr)', gap: '20px' } },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: 'One radio, one bus, a few hardware timers, and many components that want them. TinyOS 2.x sorts every resource into three kinds:' }),
              ...btns,
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Confusing an <span class="t">arbiter</span> with the task scheduler. The scheduler picks the next <i>task</i>; an arbiter picks which <i>client</i> may use one <span class="t">shared resource</span>.' })),
            host));
          show(cur);
          return () => { if (typeof cleanup === 'function') cleanup(); };
        },
      },

      /* ---------------- 7. Duty cycle and battery life ---------------- */
      {
        title: 'Why sleeping matters: duty cycle and battery life',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const fmt = ctx.util.fmt;
          const DUTY = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
          let v = 6, cap = 2500, ia = 20, is = 0.005;
          const duty = () => DUTY[v] / 100;
          const life = (d) => cap / (d * ia + (1 - d) * is);
          const pct = (d) => Number((d * 100).toPrecision(6)) + ' %';
          const sig = (x) => String(Number(x.toPrecision(5)));
          const num = (x, dg) => Number(x.toFixed(dg)).toLocaleString('en-US');
          const human = (hrs) => { const dd = hrs / 24, yy = dd / 365; return yy >= 1 ? num(yy, 1) + ' years' : dd >= 2 ? num(dd, dd >= 100 ? 0 : 1) + ' days' : num(hrs, 1) + ' hours'; };
          const big = h('div', { class: 'big' }), sub = h('div', { class: 'small muted' });
          const formula = h('div', { class: 'card tight mono', style: { fontSize: '14.5px', lineHeight: 1.6 } });
          const split = h('div', { style: { display: 'flex', height: '16px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--line)' } });
          const splitTxt = h('div', { class: 'small' });
          const note = h('div', { class: 'narr', style: { minHeight: '46px' } });
          const CW = ctx.narrow ? 380 : 560;
          const svg = s('svg', { viewBox: `0 0 ${CW} 250`, width: '100%' });
          const XL = 70, XR = CW - 32, YT = 12, YB = 212;
          const lx = (d) => XL + (Math.log10(d * 100) + 2) / 4 * (XR - XL);
          const LYMIN = -1, LYMAX = Math.log10(36500);
          const ly = (hrs) => YB - (ctx.util.clamp(Math.log10(hrs / 24), LYMIN, LYMAX) - LYMIN) / (LYMAX - LYMIN) * (YB - YT);
          function chart() {
            const kids = [s('line', { x1: XL, y1: YB, x2: XR, y2: YB, class: 's-line' }), s('line', { x1: XL, y1: YT, x2: XL, y2: YB, class: 's-line' })];
            [[1, '1 day'], [30, '1 month'], [365, '1 year'], [3650, '10 years']].forEach(([dd, lab]) => {
              const y = ly(dd * 24);
              kids.push(s('line', { x1: XL, y1: y, x2: XR, y2: y, class: 's-muted', 'stroke-dasharray': '3 5' }), s('text', { x: XL - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, lab));
            });
            [0.0001, 0.001, 0.01, 0.1, 1].forEach((d) => kids.push(s('text', { x: lx(d), y: YB + 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, pct(d))));
            kids.push(s('text', { x: (XL + XR) / 2, y: YB + 36, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'duty cycle (time awake), log scale'));
            const pts = [];
            for (let k = 0; k <= 80; k++) { const d = Math.pow(10, k / 20 - 4); pts.push(`${k ? 'L' : 'M'}${lx(d).toFixed(1)} ${ly(life(d)).toFixed(1)}`); }
            kids.push(s('path', { d: pts.join(' '), style: 'fill:none;stroke:var(--chc)', 'stroke-width': 3 }));
            kids.push(s('text', { x: XR, y: ly(3650 * 24) - 6, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, ctx.narrow ? 'self-discharge limit' : 'beyond ~10 years, battery self-discharge rules'));
            const d = duty(), hr = life(d);
            kids.push(s('circle', { cx: lx(d), cy: ly(hr), r: 8, class: 's-accent', 'stroke-width': 3 }));
            svg.replaceChildren(...kids);
          }
          function update() {
            const d = duty(), act = d * ia, slp = (1 - d) * is, avg = act + slp, hr = cap / avg;
            const avgS = sig(avg);
            big.textContent = human(hr);
            sub.textContent = `= ${num(hr, 0)} hours = ${num(hr / 24, 0)} days`;
            formula.innerHTML = `I<sub>avg</sub> = d × I<sub>awake</sub> + (1 − d) × I<sub>idle</sub><br>= ${pct(d)} × ${ia} mA + ${pct(1 - d)} × ${is < 0.1 ? num(is * 1000, 0) + ' µA' : is + ' mA'}<br>= <b>${avgS} mA</b><br>life = ${num(cap, 0)} mAh ÷ ${avgS} mA = <b>${num(hr, 0)} h</b>`;
            split.replaceChildren(h('div', { style: { width: act / avg * 100 + '%', background: 'var(--io)' } }), h('div', { style: { width: slp / avg * 100 + '%', background: is > 1 ? 'var(--bad)' : 'var(--ok)' } }));
            splitTxt.innerHTML = `Awake part <b>${fmt(act / avg * 100, 1)} %</b> of the average · idle part <b>${fmt(slp / avg * 100, 1)} %</b>`;
            const yrs = hr / 24 / 365;
            if (is > 1) { note.className = 'narr bad'; note.innerHTML = 'Idling <b>awake</b> instead of sleeping: the idle term now dominates, and no duty cycle can save the battery. This is what TinyOS avoids by sleeping whenever the task queue is empty.'; }
            else if (slp > act) { note.className = 'narr'; note.innerHTML = 'At this low duty cycle the <b>sleep</b> current is now the larger part of the average: shaving microamps off sleep mode is what matters here.' + (yrs > 10 ? ' (Past ten years, the battery’s own self-discharge ends its life first.)' : ''); }
            else if (yrs > 10) { note.className = 'narr'; note.innerHTML = 'On paper this lasts over ten years, but real batteries slowly discharge on their own, so the battery ages out first.'; }
            else { note.className = 'narr ok'; note.innerHTML = 'The awake time still dominates the average, so halving the duty cycle roughly doubles the lifetime.'; }
            chart();
          }
          const dSl = ctx.ui.slider({ label: 'Duty cycle', min: 0, max: DUTY.length - 1, value: v, format: (x) => DUTY[x] + ' %', onInput: (x) => { v = x; update(); } });
          const aSl = ctx.ui.slider({ label: 'Awake current', min: 5, max: 30, value: ia, format: (x) => x + ' mA', onInput: (x) => { ia = x; update(); } });
          const bSeg = ctx.ui.seg([{ value: 2500, label: '2 × AA · 2,500 mAh' }, { value: 225, label: 'Coin cell · 225 mAh' }], cap, (x) => { cap = x; update(); });
          const iSeg = ctx.ui.seg([{ value: 0.005, label: 'Idle = sleep (5 µA)' }, { value: 2, label: 'Idle = stay awake (2 mA)' }], is, (x) => { is = x; update(); });
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' } },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: 'A mote’s battery life depends almost entirely on how much of the time it is awake. That fraction is its <span class="t">duty cycle</span>, d. Averaged over time, the current drawn and the lifetime are:' }),
              formula, dSl, aSl,
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'Battery'), bSeg),
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'When idle'), iSeg),
              h('p', { class: 'xs muted m0' }, 'Illustrative numbers for a TelosB-class mote: about 20 mA with the radio on, about 5 µA asleep, about 2 mA idling with the processor awake. Real lifetimes also depend on temperature, voltage cut-off and the battery’s self-discharge.'),
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'This is why TinyOS sleeps whenever the task queue is empty, and why sensor networks also switch the radio off between messages: a radio that merely <i>listens</i> draws about as much current as one that transmits.' })),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'flex-end' } }, h('div', {}, h('h4', { class: 'm0' }, 'Estimated lifetime'), big), sub),
              h('div', { class: 'card white tight', style: { padding: '6px 8px' } }, svg), split, splitTxt, note)));
          update();
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: TinyOS in eight cards',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['Why can’t a mote run a desktop-style OS?', 'A few kilobytes of RAM, tens of kilobytes of flash and a battery that must last months: no room for per-thread stacks and no energy to stay awake.'],
              ['What runs on a mote?', 'One program image: the application’s components plus only the TinyOS components they wire in. No separate kernel, no processes, no virtual memory, no malloc.'],
              ['Command or event?', 'Commands go down: the user of an interface calls them, the provider implements them. Events go up: the provider signals them, the user must handle every one.'],
              ['Module or configuration?', 'A module holds nesC code. A configuration holds only a list of components and the wires between them, written user -> provider.'],
              ['The rules for tasks', 'Posted to a first-in, first-out queue, run to completion, never preempt each other. Interrupt handlers may cut in briefly.'],
              ['Why split-phase?', 'A command starts slow work and returns at once; an event reports the end. Nobody blocks, so one shared stack is enough.'],
              ['Three kinds of resource', 'Dedicated: one owner. Virtualized: many logical copies of one resource. Shared: clients take turns; an arbiter answers request with granted, and the owner calls release.'],
              ['Battery life in one line', 'I<sub>avg</sub> = d × I<sub>awake</sub> + (1 − d) × I<sub>sleep</sub>, and lifetime = capacity ÷ I<sub>avg</sub>. Sleeping whenever the queue is empty is what makes years possible.'],
            ], { cols: ctx.narrow ? 2 : 4, height: 228 })));
        },
      },

      /* ---------------- 9. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'On a TinyOS mote, a task is running when a hardware interrupt arrives. What happens?',
            choices: ['The interrupt is held back until the task returns, and then its handler runs.', 'The task is moved to the tail of the task queue so that the handler can run.', 'The handler runs at once, and then the task continues from where it stopped.', 'The scheduler starts the next queued task while the handler is running.'],
            answer: 2,
            feedback: ['That is how tasks treat other tasks. Interrupt handlers do cut into a running task.', 'Tasks are never re-queued. The paused task simply resumes when the handler returns.', null, 'The processor does one thing at a time: after the handler returns, the interrupted task finishes before any other task starts.'],
            why: 'Interrupt handlers preempt tasks. The handler runs briefly on the same stack (in TinyOS 2.x it is short async code that typically just posts a task); when it returns, the task carries on exactly where it was.' },
          { q: 'Task A is running and task B is already waiting in the TinyOS task queue. While running, A posts task C. Which task runs as soon as A returns?',
            choices: ['C, because it was posted most recently.', 'A again, because it was the one that posted C.', 'Whichever of B and C needs less time.', 'B, because it was posted before C.'],
            answer: 3,
            feedback: ['Most recent first would be a stack. The task queue is first-in, first-out.', 'A has finished; posting C does not make A run again.', 'The default TinyOS scheduler does not look at task lengths; it is strictly first-in, first-out.', null],
            why: 'TinyOS keeps posted tasks in a first-in, first-out queue. B was posted first, so B runs next and C waits its turn.' },
          { type: 'tf', q: 'In TinyOS, a running task can be preempted by another task that the scheduler considers more important.', answer: false,
            why: 'Tasks run to completion and never preempt one another; the default scheduler is plain first-in, first-out. Only interrupt handlers can cut into a running task.' },
          { type: 'multi', q: 'Which of these does a TinyOS mote <b>not</b> have? Select all that apply.',
            choices: ['A separate kernel running in a privileged mode', 'Virtual memory with page tables', 'A queue of posted tasks', 'Run-time memory allocation with malloc', 'Components joined by wiring'], answer: [0, 1, 3],
            why: 'TinyOS compiles the application and the OS components it needs into one image with no kernel boundary, no virtual memory and no run-time allocation. It does have a task queue, and it is built entirely from wired components.' },
          { type: 'match', q: 'Match each nesC idea to its description.',
            pairs: [['Command', 'Called by an interface’s user, implemented by its provider'], ['Event', 'Signalled by an interface’s provider, handled by its user'], ['Module', 'A component whose behaviour is written as code'], ['Configuration', 'A component that only lists components and wires them'], ['Task', 'A function posted to run later, to completion']],
            why: 'Commands go down and events come up through an interface. Modules hold code; configurations hold only wiring; tasks are deferred work run by the scheduler.' },
          { type: 'order', q: 'Put one sense-and-send cycle of a TinyOS mote in order.',
            items: ['The timer interrupt posts a task, which signals Timer.fired; its handler posts a sensing task', 'The sensing task calls read(), which starts the sensor and returns at once', 'The conversion-done interrupt posts a task, which signals readDone with the value; its handler posts a sending task', 'The sending task calls send(), which starts the radio and returns at once', 'The radio interrupt posts a task, which signals sendDone: the packet has gone', 'The task queue is empty, so the processor sleeps until the next interrupt'],
            why: 'Each slow step is split-phase: a command starts it inside a task; later a hardware interrupt posts a task that signals the completion event, and that event’s handler posts the next task. In between, the processor sleeps.' },
          { type: 'bucket', q: 'Sort each example by the kind of resource it is in TinyOS 2.x.', buckets: ['Dedicated', 'Virtualized', 'Shared'],
            items: [['A hardware timer’s compare register, owned only by the timer system', 0], ['Each new TimerMilliC() an application creates', 1], ['A serial (SPI) bus that the radio chip and the flash chip take turns using', 2], ['An interrupt line wired to exactly one component', 0], ['A flash chip that a data logger and a settings store both need, one at a time', 2]],
            why: 'A dedicated resource has one owner; a virtualized one gives every client its own logical copy (virtual timers on one hardware timer); a shared one is used by one client at a time under an arbiter.' },
          { type: 'num', q: 'A mote draws 20 mA when awake and 0.005 mA asleep, and it is awake 1 % of the time. What is its average current, in mA? (Give three decimal places.)', answer: 0.205, tol: 0.001, unit: 'mA',
            why: 'I<sub>avg</sub> = 0.01 × 20 + 0.99 × 0.005 = 0.2 + 0.00495 = 0.20495 mA, about 0.205 mA.' },
          { type: 'num', q: 'A mote’s average current is 0.25 mA. How many hours will a 2,500 mAh battery last, ignoring self-discharge?', answer: 10000, tol: 1, unit: 'h',
            why: 'Lifetime = capacity ÷ average current = 2,500 mAh ÷ 0.25 mA = 10,000 hours, a little over 416 days.' },
          { q: 'Why does TinyOS use split-phase operations instead of calls that wait until a device finishes?',
            choices: ['Split-phase calls make the sensor and radio chips themselves work faster.', 'Waiting calls need a stack for every waiting activity, and RAM is tiny.', 'C has no way to write a call that waits until a device finishes.', 'Split-phase calls remove the need for components to handle events.'],
            answer: 1,
            feedback: ['The hardware takes as long as it takes; split-phase only changes what the software does meanwhile.', null, 'Blocking calls are common in C programs on other systems; the reason is memory, not the language.', 'The opposite: the second half of every split-phase operation arrives as an event that must be handled.'],
            why: 'A call that waits needs a thread whose stack holds its state during the wait. Split-phase code keeps no waiting stack, so one shared stack serves the whole mote.' },
          { q: 'A round-robin arbiter controls a bus shared by clients 1, 2 and 3, checked in that circular order. Client 3 holds the bus; client 2 requests it, then client 1 does. Client 3 releases. Who is granted the bus?',
            choices: ['Client 1, the first waiting client after 3 in circular order.', 'Client 2, because its request arrived before client 1’s.', 'Client 3 again, because it was the most recent owner.', 'Nobody, because a released bus is always powered down first.'],
            answer: 0,
            feedback: [null, 'That would be a first-come-first-served arbiter, which looks at arrival order instead of the circular order.', 'A client that has released the bus no longer holds a request, so it cannot be granted.', 'The bus is handed to its power manager only when nobody is waiting.'],
            why: 'Round robin starts looking just after the client that released: after 3 comes 1, which is waiting, so client 1 gets granted.' },
          { type: 'tf', q: 'In a nesC configuration, the line <code>App.Timer -> TimerMilliC.Timer</code> means that App uses the Timer interface and TimerMilliC provides it.', answer: true,
            why: 'The wiring arrow always points from the user to the provider: App calls the timer’s commands, and TimerMilliC implements them and signals fired back to App.' },
        ],
      },
    ],
    notes: `
      <h3>Wireless sensor networks and motes</h3>
      <p>A <b>wireless sensor network (WSN)</b> is a large number of small, battery-powered computers spread over an area. Each node, called a <b>mote</b>, measures something physical and radios its readings toward a <b>base station</b> (the sink), which passes them to an ordinary computer. Readings are relayed hop by hop; motes near the base station relay for many others and use more energy.</p>
      <p>A typical mote of the mid-2000s (TelosB-class) has a 16-bit microcontroller at 8 MHz, 10 KB of RAM, 48 KB of program flash (plus a separate 1 MB flash chip for data), a low-power radio of 250 kbit/s with a range of tens of metres, a few sensors and two AA cells. Older MICA-class motes had only 4 KB of RAM.</p>
      <p>An operating system for motes must: (1) use almost no power, sleeping nearly all the time; (2) fit in a tiny memory; (3) handle concurrency, since sensing, computing, sending and relaying overlap; (4) be robust, running unattended for months; (5) support many hardware designs and applications, building only what each needs.</p>

      <h3>TinyOS is not a conventional OS</h3>
      <p><b>TinyOS</b> is an open-source OS for motes, begun at UC Berkeley around 2000 (last release 2.1.2 in 2012; newer systems such as Contiki-NG, RIOT and Zephyr now run many sensor devices). It is a library of small software components. The application is written as components too, and the compiler joins them with exactly the TinyOS components they use into <b>one program image</b>, which is loaded into the mote's flash. Unused components are left out; blinking an LED from a timer needs a few kilobytes of code and well under a kilobyte of RAM.</p>
      <table>
        <tr><th>Conventional OS</th><th>TinyOS</th><th>Why</th></tr>
        <tr><td>Kernel and user modes, system calls</td><td>No boundary: one privilege level, ordinary function calls</td><td>One trusted program; often no protection hardware</td></tr>
        <tr><td>Many processes</td><td>One application, which is the whole system</td><td>A mote does one job</td></tr>
        <tr><td>Threads, each with its own stack</td><td>One stack shared by all tasks and handlers</td><td>RAM: a few thread stacks would fill it</td></tr>
        <tr><td>Virtual memory</td><td>None: physical addresses</td><td>No MMU, no disk</td></tr>
        <tr><td>Run-time allocation (malloc)</td><td>All memory reserved at compile time</td><td>No failures months later; no fragmentation</td></tr>
        <tr><td>Programs loaded at run time</td><td>Whole program compiled at once</td><td>Smaller code; the compiler can inline and check for data races</td></tr>
      </table>
      <p>Illustrative stack budget: six 512-byte thread stacks plus 1,200 bytes of data need 4,272 bytes (42 % of 10 KB); TinyOS needs 1,200 + 256 = 1,456 bytes (14 %). TinyOS 2.1 added an optional thread library for those who accept that cost.</p>

      <h3>Components, interfaces, commands and events (nesC)</h3>
      <p>TinyOS is written in <b>nesC</b>, a dialect of C. A <b>component</b> <i>provides</i> some interfaces and <i>uses</i> others, and reaches the rest of the system only through them. An <b>interface</b> is two-way:</p>
      <ul>
        <li><b>Commands</b> go down: the <i>user</i> of the interface calls them and the <i>provider</i> implements them (start a timer, send a packet, read a sensor).</li>
        <li><b>Events</b> go up: the <i>provider</i> signals them and the <i>user</i> must implement a handler for every one, even an empty one (timer fired, packet sent, reading done).</li>
      </ul>
      <p>Examples: Boot has only an event (booted) and Leds only commands; Timer's main commands are startPeriodic, startOneShot and stop, and its event is fired; Read has read/readDone; AMSend has send/sendDone; SplitControl has start/stop and startDone/stopDone.</p>
      <p>There are two kinds of component. A <b>module</b> is written as nesC code: variables, tasks, command implementations and event handlers. A <b>configuration</b> contains no ordinary code: it lists components and <b>wires</b> them, writing <code>User.Interface -> Provider.Interface</code> (the arrow points from user to provider). Configurations can contain other configurations, all the way down to modules that touch the hardware. Generic components are instantiated with <code>new</code>, e.g. <code>new TimerMilliC()</code> gives a timer of one's own. In the example, module SenseC uses six interfaces and configuration SenseAppC wires them to MainC, ActiveMessageC, TimerMilliC, a sensor, AMSenderC and LedsC. Wiring is fixed at compile time, so the compiler knows where every call goes.</p>

      <h3>Tasks, interrupt handlers and split-phase operations</h3>
      <ul>
        <li><b>Tasks</b> are deferred work. <code>post t();</code> puts task t at the tail of a first-in, first-out queue. The scheduler runs the task at the head <b>to completion</b>. Tasks never preempt one another and, with the default scheduler, have no priorities; a long task delays every other task, so long work should be split into short tasks that post the next piece. In TinyOS 2.x each task has one queue slot, so posting a task that is already waiting fails.</li>
        <li><b>Interrupt handlers</b> run the moment hardware interrupts, even in the middle of a task, on the same stack; when they return, the task resumes where it stopped. Good handlers are short: save the data, post a task, return. A task posted by a handler waits its turn in the queue. In TinyOS 2.x, completion events such as fired, readDone and sendDone are signalled from a task that the low-level handler posts, so these events never cut into another task and a long task delays them too; only code marked <code>async</code> may run inside an interrupt.</li>
        <li><b>Split-phase operations</b>: a command starts a slow job (sensor reading, packet send, radio power-up) and returns at once; an event reports completion later. Nobody waits, so nobody needs a stack of their own: one stack serves the whole mote. A common mistake is expecting <code>read()</code> to return the value; the value arrives in readDone.</li>
        <li>When the task queue is empty, the scheduler puts the microcontroller into <b>low-power sleep</b> until the next interrupt.</li>
      </ul>
      <p>One sense-and-send cycle in TinyOS 2.x: the timer's compare interrupt posts a task that signals Timer.fired, whose handler posts senseTask → senseTask calls read() and finishes → the processor sleeps while the sensor converts → the conversion-done interrupt posts a task that signals readDone, whose handler stores the value and posts sendTask → sendTask calls send() and finishes → the processor sleeps while the radio transmits → the radio interrupt posts a task that signals sendDone, whose handler toggles an LED → the queue is empty, so the processor sleeps until the next timer interrupt. In the illustrative simulation the CPU is awake 12 ticks of each 30, yet the radio uses about 82 % of the charge although it is on for only 6 ticks.</p>

      <h3>Resources in TinyOS 2.x</h3>
      <ul>
        <li><b>Dedicated</b>: exactly one component uses it, so no sharing rules are needed (a hardware timer's compare register, an interrupt line).</li>
        <li><b>Virtualized</b>: software gives every client its own logical copy. Every <code>new TimerMilliC()</code> is a virtual timer; the timer system keeps each client's next deadline and sets the one hardware alarm to the <i>earliest</i>. With periods 250, 400 and 1000 ms the alarm fires at 250 (A), 400 (B), 500 (A), 750 (A), 800 (B), 1000 (A and C), 1200 (B)...</li>
        <li><b>Shared</b>: clients take turns, one at a time (an SPI bus, the serial link the microcontroller uses to reach the radio chip and the data flash chip). An <b>arbiter</b> decides: a client calls <code>request</code>, is told <code>granted</code> by an event, uses the resource and calls <code>release</code>. A first-come-first-served arbiter grants the longest-waiting request; a round-robin arbiter checks clients in a fixed circular order starting just after the one that released. Example: clients 1, 2, 3; client 3 holds the bus, 2 requests, then 1; when 3 releases, FCFS grants 2 and round robin grants 1. When nobody wants the resource, its default owner (a power manager) can switch it off.</li>
      </ul>
      <p>An arbiter is not the task scheduler: the scheduler picks the next task, the arbiter picks which client may use one shared resource.</p>

      <h3>Duty cycle and battery life</h3>
      <p>The <b>duty cycle</b> d is the fraction of time the mote is awake. Average current and lifetime:</p>
      <p><b>I<sub>avg</sub> = d × I<sub>awake</sub> + (1 − d) × I<sub>sleep</sub></b> and <b>lifetime = capacity ÷ I<sub>avg</sub></b>.</p>
      <p>Worked example (illustrative TelosB-class numbers: 20 mA awake, 5 µA = 0.005 mA asleep, two AA cells of 2,500 mAh). At d = 1 %: I<sub>avg</sub> = 0.01 × 20 + 0.99 × 0.005 = 0.2 + 0.00495 = 0.20495 mA, so the lifetime is 2,500 ÷ 0.20495 ≈ 12,198 hours ≈ 508 days ≈ 1.4 years. Always awake (d = 100 %): 2,500 ÷ 20 = 125 hours, about 5 days. If the processor idles awake at 2 mA instead of sleeping, d = 1 % gives 0.01 × 20 + 0.99 × 2 = 2.18 mA and only about 48 days. At very low duty cycles (below about 0.025 %) the sleep current becomes the larger part of the average, and beyond about ten years the battery's own self-discharge sets the limit. A radio that only listens draws about as much as one that transmits, which is why sensor networks also switch the radio off between messages.</p>
    `,
  });
})();
