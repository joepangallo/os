/* =====================================================================
   13.1 Embedded Systems
   Original teaching material. Shared data and small helpers live inside
   this IIFE (no globals).
   ===================================================================== */
(function () {
  /* Rounded early-2020s yearly shipment estimates, used only for an order-of-magnitude comparison. */
  const MCU_PER_YEAR = 30e9;   // microcontrollers shipped per year (roughly)
  const PC_PER_YEAR = 0.26e9;  // desktop and laptop PCs shipped per year (roughly)
  const PHONE_PER_YEAR = 1.2e9; // smartphones shipped per year (roughly)

  /* Small pictograms for the "spot the embedded computers" step (viewBox 0 0 64 40, theme-aware classes). */
  const PICT = {
    tv: '<rect x="6" y="3" width="52" height="28" rx="3" class="s-panel"/><rect x="10" y="7" width="44" height="20" rx="1" class="s-cpu"/><path d="M26 36h12M32 31v5" class="s-line"/>',
    console: '<rect x="6" y="4" width="38" height="14" rx="3" class="s-panel"/><circle cx="37" cy="11" r="2.2" class="s-cpu"/><rect x="22" y="24" width="36" height="14" rx="7" class="s-panel"/><circle cx="30" cy="31" r="2" class="s-cpu"/><circle cx="50" cy="31" r="2" class="s-io"/>',
    camera: '<rect x="10" y="10" width="44" height="26" rx="4" class="s-panel"/><rect x="16" y="5" width="12" height="6" rx="1" class="s-panel"/><circle cx="34" cy="23" r="9" class="s-cpu"/><circle cx="34" cy="23" r="4" class="s-panel"/>',
    thermo: '<circle cx="32" cy="20" r="17" class="s-panel"/><circle cx="32" cy="20" r="10" class="s-io"/><path d="M32 20l6-5" class="s-line"/>',
    micro: '<rect x="4" y="6" width="56" height="30" rx="3" class="s-panel"/><rect x="8" y="10" width="34" height="22" rx="2" class="s-cpu"/><path d="M48 13h8M48 19h8M48 25h8" class="s-line"/>',
    washer: '<rect x="14" y="2" width="36" height="37" rx="4" class="s-panel"/><path d="M14 10h36" class="s-line"/><circle cx="32" cy="24" r="10" class="s-cpu"/><circle cx="21" cy="6" r="1.8" class="s-io"/>',
    printer: '<rect x="18" y="3" width="28" height="12" class="s-panel"/><rect x="8" y="13" width="48" height="18" rx="3" class="s-panel"/><rect x="18" y="28" width="28" height="10" class="s-panel"/><circle cx="48" cy="20" r="2" class="s-ok"/>',
    laptop: '<rect x="12" y="4" width="40" height="26" rx="2" class="s-panel"/><rect x="15" y="7" width="34" height="20" class="s-cpu"/><path d="M6 33h52l-4 5H10z" class="s-panel"/>',
    shelf: '<rect x="14" y="2" width="36" height="37" class="s-panel"/><path d="M14 14h36M14 26h36M19 4v10M23 4v10M28 6v8M19 16v10M24 16v10M39 28v11M43 28v11" class="s-line"/>',
    switch: '<rect x="22" y="3" width="20" height="34" rx="3" class="s-panel"/><rect x="28" y="10" width="8" height="12" rx="2" class="s-panel"/>',
    timer: '<rect x="28" y="2" width="8" height="5" rx="1" class="s-panel"/><circle cx="32" cy="22" r="15" class="s-panel"/><path d="M32 22l-7-6M32 9v3M45 22h-3M32 35v-3M19 22h3" class="s-line"/>',
    ecu: '<rect x="16" y="8" width="32" height="24" rx="3" class="s-cpu"/><path d="M20 8V3M28 8V3M36 8V3M44 8V3M20 32v5M28 32v5M36 32v5M44 32v5" class="s-line"/>',
    abs: '<circle cx="26" cy="20" r="17" class="s-panel"/><circle cx="26" cy="20" r="8" class="s-panel"/><rect x="46" y="13" width="10" height="14" rx="2" class="s-io"/>',
    airbag: '<circle cx="32" cy="20" r="17" class="s-panel"/><circle cx="32" cy="20" r="7" class="s-intr"/><path d="M15 20h10M39 20h10M32 27v10" class="s-line"/>',
    info: '<rect x="8" y="5" width="48" height="30" rx="3" class="s-panel"/><path d="M14 28l10-10 8 6 12-12" class="s-line"/><circle cx="44" cy="12" r="3" class="s-io"/>',
    tpms: '<circle cx="32" cy="21" r="17" class="s-panel"/><circle cx="32" cy="21" r="10" class="s-panel"/><rect x="28" y="6" width="8" height="6" rx="1" class="s-io"/>',
    door: '<path d="M10 37V14L22 4h32v33z" class="s-panel"/><path d="M14 16l10-8h26v12H14z" class="s-cpu"/><path d="M42 27h8" class="s-line"/>',
    park: '<rect x="4" y="16" width="26" height="16" rx="4" class="s-panel"/><path d="M36 16q5 8 0 16M43 12q8 12 0 24M50 9q10 15 0 30" class="s-line"/>',
    key: '<rect x="20" y="6" width="22" height="30" rx="8" class="s-panel"/><circle cx="31" cy="15" r="3" class="s-cpu"/><circle cx="31" cy="26" r="3" class="s-cpu"/><path d="M45 12q4 4 0 8M50 9q7 7 0 14" class="s-line"/>',
    seat: '<path d="M18 3h10v21h20v8H18z" class="s-panel"/><path d="M24 32v6M44 32v6" class="s-line"/>',
    pace: '<rect x="6" y="8" width="28" height="24" rx="10" class="s-panel"/><path d="M11 20h4l2-5 3 10 2-5h5" class="s-line"/><path d="M34 20c10 0 10-12 22-10" class="s-line"/>',
    pump: '<rect x="8" y="2" width="14" height="20" rx="4" class="s-mem"/><path d="M15 22v7h15" class="s-line"/><rect x="30" y="15" width="28" height="23" rx="3" class="s-panel"/><rect x="34" y="19" width="15" height="8" class="s-cpu"/>',
    robot: '<rect x="8" y="32" width="20" height="6" class="s-panel"/><path d="M18 32l4-16 22-6 10 10" class="s-line"/><circle cx="22" cy="16" r="3.5" class="s-io"/><circle cx="44" cy="10" r="3.5" class="s-io"/>',
    plant: '<rect x="8" y="4" width="22" height="33" rx="6" class="s-panel"/><path d="M30 29h26" class="s-line"/><path d="M38 23l10 12V23l-10 12z" class="s-io"/>',
    copier: '<path d="M10 12l6-8h32l6 8z" class="s-panel"/><rect x="6" y="12" width="52" height="24" rx="3" class="s-panel"/><rect x="42" y="17" width="11" height="7" class="s-cpu"/>',
    plane: '<path d="M4 21q4-4 12-4h38q6 2 0 6H16q-8 0-12-2z" class="s-panel"/><path d="M30 17L22 4h6l12 13zM30 23l-8 13h6l12-13zM51 17l4-8h4l-1 8z" class="s-panel"/>',
    sat: '<rect x="26" y="14" width="12" height="12" class="s-panel"/><rect x="4" y="16" width="20" height="8" class="s-cpu"/><rect x="40" y="16" width="20" height="8" class="s-cpu"/><path d="M32 14V8" class="s-line"/><circle cx="32" cy="6" r="3" class="s-panel"/>',
    server: '<rect x="14" y="2" width="36" height="36" rx="2" class="s-panel"/><path d="M14 12h36M14 22h36M14 32h36" class="s-line"/><circle cx="44" cy="7" r="1.6" class="s-ok"/><circle cx="44" cy="17" r="1.6" class="s-ok"/><circle cx="44" cy="27" r="1.6" class="s-ok"/>',
  };

  /* Application areas, in the order they are usually listed. */
  const AREAS = ['Consumer electronics', 'Household appliances', 'Automotive', 'Industrial control', 'Medical devices', 'Office automation', 'Aerospace and defense'];

  /* The three scenes. v: 'emb' = has an embedded computer, 'gen' = a general-purpose computer, 'no' = no computer at all. a: index into AREAS. */
  const SCENES = [
    { key: 'home', label: 'Home', cols: '5fr 4fr 3fr', zones: [
      { name: 'Living room', cols: 2, items: [
        { p: 'tv', n: 'Smart TV', v: 'emb', a: 0, t: 'Decodes the video stream, draws the menus and answers the remote control. Its main chip runs a full operating system (often Linux-based); small microcontrollers look after the power supply and backlight.' },
        { p: 'console', n: 'Game console', v: 'emb', a: 0, t: 'A powerful computer, but sealed and dedicated to games: you cannot install any system or program you like. Even its controller has a microcontroller that reads the buttons and sends them by radio.' },
        { p: 'camera', n: 'Digital camera', v: 'emb', a: 0, t: 'Reads millions of light sensors, focuses the lens with tiny motors and compresses each photo. Special-purpose image hardware does the heavy work so a shot takes a fraction of a second.' },
        { p: 'thermo', n: 'Thermostat', v: 'emb', a: 1, t: 'Measures the room temperature, compares it with the temperature you chose, and switches the heating on or off. You will run one yourself later in this section.' },
        { p: 'switch', n: 'Light switch', v: 'no', t: 'A plain wall switch is a mechanical contact that closes the lamp circuit. No computer, no software. (Smart switches controlled from an app do contain one.)' },
        { p: 'shelf', n: 'Bookshelf', v: 'no', t: 'Wood and books. Nothing to compute here.' },
      ] },
      { name: 'Kitchen and laundry', cols: 2, items: [
        { p: 'micro', n: 'Microwave oven', v: 'emb', a: 1, t: 'Reads the keypad, counts down the time and switches the power. Mechanical door switches also cut the power when the door opens, so a software bug alone cannot run it open.' },
        { p: 'washer', n: 'Washing machine', v: 'emb', a: 1, t: 'Runs each wash programme in order: fill, heat, wash, drain, spin. It checks the water level and the drum balance, and many models weigh the load to choose the amount of water.' },
        { p: 'timer', n: 'Wind-up kitchen timer', v: 'no', t: 'A spring and a few gears count down and ring a bell. Clever mechanics, but no computer.' },
      ] },
      { name: 'Study', cols: 1, items: [
        { p: 'laptop', n: 'Laptop', v: 'gen', t: 'A general-purpose computer: you install whatever programs you like, so it is not an embedded system. (It still hides embedded microcontrollers in its keyboard, battery and storage drive.)' },
        { p: 'printer', n: 'Printer', v: 'emb', a: 5, t: 'Receives page data over the network, then drives the paper motors and the print head (or laser) in exact time with each other, and reports jams and empty trays.' },
      ] },
    ] },
    { key: 'car', label: 'Car', cols: '1fr 1fr', zones: [
      { name: 'Under the hood', cols: 2, items: [
        { p: 'ecu', n: 'Engine control unit', v: 'emb', a: 2, t: 'Reads the crankshaft position, the air flow and the exhaust oxygen, then times every fuel injection and every spark to within microseconds.' },
        { p: 'abs', n: 'Anti-lock brakes', v: 'emb', a: 2, t: 'Watches all four wheel speeds and pulses the brake pressure of any wheel about to lock, so the driver can still steer during an emergency stop.' },
      ] },
      { name: 'Cabin', cols: 3, items: [
        { p: 'info', n: 'Infotainment screen', v: 'emb', a: 2, t: 'Maps, music and calls. Unlike most car computers it uses an application processor with a full operating system (often Linux- or Android-based).' },
        { p: 'airbag', n: 'Airbag controller', v: 'emb', a: 2, t: 'Reads crash sensors and decides within a few hundredths of a second whether to fire the airbags. It must never fire by mistake and never fail to fire in a real crash.' },
        { p: 'seat', n: 'Manually adjusted seat', v: 'no', t: 'A lever and a spring: no electronics at all. (Power seats that remember each driver’s position do have their own controller.)' },
      ] },
      { name: 'Wheels and doors', cols: 2, items: [
        { p: 'tpms', n: 'Tire-pressure sensor', v: 'emb', a: 2, t: 'A tiny battery-powered sensor inside each tire measures the pressure and radios it to the car. It sleeps nearly all the time, so its battery lasts for years.' },
        { p: 'door', n: 'Door and window module', v: 'emb', a: 2, t: 'Runs the window motor and the door lock. It senses the motor current and reverses the window if it meets resistance, so it cannot trap a hand.' },
      ] },
      { name: 'Outside the car', cols: 2, items: [
        { p: 'park', n: 'Parking sensors', v: 'emb', a: 2, t: 'Send ultrasonic pulses and time the echoes to measure the distance to an obstacle, then beep faster as you get closer.' },
        { p: 'key', n: 'Key fob', v: 'emb', a: 2, t: 'A microcontroller and a radio. Each press sends a coded message that changes every time, so a recorded message cannot simply be replayed to open the car.' },
      ] },
    ] },
    { key: 'world', label: 'Beyond the home', cols: '1fr 1fr', zones: [
      { name: 'Hospital', cols: 2, items: [
        { p: 'pace', n: 'Pacemaker', v: 'emb', a: 4, t: 'Senses each heartbeat and sends a small electrical pulse when a beat comes late. It runs for years on one sealed battery, so every microamp counts.' },
        { p: 'pump', n: 'Infusion pump', v: 'emb', a: 4, t: 'Pushes medicine into a vein at an exact rate and sounds an alarm on a blockage or an air bubble. A wrong dose can kill, so safety rules every design choice.' },
      ] },
      { name: 'Factory', cols: 2, items: [
        { p: 'robot', n: 'Industrial robot arm', v: 'emb', a: 3, t: 'Moves each joint along a planned path, reading joint sensors and updating its motor commands hundreds to thousands of times a second.' },
        { p: 'plant', n: 'Chemical-plant controller', v: 'emb', a: 3, t: 'Keeps the temperatures, pressures and flows of a reactor inside safe limits by opening and closing valves, around the clock, for decades.' },
      ] },
      { name: 'Office', cols: 2, items: [
        { p: 'copier', n: 'Office copier', v: 'emb', a: 5, t: 'Scans, stores, prints, sorts and staples pages and reports paper jams. Several embedded processors inside it work together.' },
        { p: 'server', n: 'Data-centre server', v: 'gen', t: 'A general-purpose computer that runs whatever its owners install, so it is not an embedded system. (Its disks, power supplies and network cards do contain embedded controllers.)' },
      ] },
      { name: 'Air and space', cols: 2, items: [
        { p: 'plane', n: 'Flight-control computer', v: 'emb', a: 6, t: 'Turns the pilot’s stick movements into commands for the wing and tail surfaces (“fly-by-wire”). Several computers run side by side and check each other.' },
        { p: 'sat', n: 'Satellite', v: 'emb', a: 6, t: 'Points its antennas and solar panels, manages its power and talks to the ground. It must survive radiation and extreme cold for years with no chance of repair.' },
      ] },
    ] },
  ];

  /* The thermostat lab's deliberately simple model (one tick = one simulated minute).
     Room: T += -loss × (T − outside) + gain × power.  Sensor: 0.5 V + 10 mV per °C.
     A/D: 10 bits over 0–3.3 V, rounded to the nearest step.  D/A: 8 bits (codes 0–255). */
  const TH = { out: 5, loss: 0.01, lossWin: 0.025, gain: 0.25, vref: 3.3, adcMax: 1023, kp: 0.6, ki: 0.02, band: 0.5, t0: 15 };
  const sensorV = (T) => 0.5 + 0.01 * T;
  const adcCode = (T) => Math.max(0, Math.min(TH.adcMax, Math.round(sensorV(T) / TH.vref * (TH.adcMax + 1))));
  const codeToC = (c) => (c * TH.vref / (TH.adcMax + 1) - 0.5) / 0.01;

  Guide.section({
    id: '13.1',
    title: 'Embedded Systems',
    short: 'Embedded systems',
    summary: 'Most computers hide inside products, each doing one job by sensing and acting on the physical world.',
    objectives: [
      'Define an embedded system and recognise one inside everyday products, from washing machines to cars and pacemakers.',
      'Describe the ways embedded systems differ in size, cost, quality requirements, lifetime, environment and behaviour.',
      'Name the elements of an embedded system and trace its feedback loop from sensor through A/D conversion, computation and D/A conversion to actuator.',
      'Explain how a microcontroller differs from a microprocessor, and an application processor from a dedicated processor.',
      'Explain what makes a system deeply embedded and why battery-powered sensor nodes must sleep most of the time.',
    ],
    terms: [
      ['Embedded system', 'A combination of computer hardware and software, and often mechanical or other parts, designed to perform one dedicated function. It is usually part of a larger product, such as the anti-lock braking system of a car.'],
      ['General-purpose computer', 'A computer built to run whatever programs its user chooses, such as a laptop, desktop or server. The opposite of a computer dedicated to one job.'],
      ['Electronic control unit (ECU)', 'The car industry’s name for an embedded computer that controls one part of a vehicle, such as the engine, the brakes or the airbags.'],
      ['Microprocessor', 'A processor on a single chip. On its own it cannot run a program: main memory, the clock and most I/O sit in separate chips around it.'],
      ['Microcontroller (MCU)', 'A whole small computer on one chip: a processor, nonvolatile memory for the program, RAM for data, a clock and I/O such as timers, serial ports and A/D converters.'],
      ['Application processor', 'A powerful processor, usually the heart of a system on a chip, that runs a full operating system such as Linux or Android and many apps. Phones, tablets and car infotainment units use them.'],
      ['Dedicated processor', 'A processor devoted to one task or a few fixed tasks, such as running a washing machine’s wash cycles. Its program rarely or never changes.'],
      ['Deeply embedded system', 'A dedicated system built around a microcontroller that its user cannot program, usually with no operating system or only a tiny one. Sensor nodes are typical examples.'],
      ['Wireless sensor network (WSN)', 'Many small battery-powered nodes that each measure something (temperature, moisture, vibration) and send their readings by radio to each other or to a gateway.'],
      ['Firmware', 'The program stored in a device’s nonvolatile memory (flash or ROM) that runs the device. It starts by itself when the power comes on.'],
      ['Flash memory', 'Nonvolatile memory that can be erased and rewritten electrically, a block at a time. Most microcontrollers keep their program in on-chip flash.'],
      ['A/D converter (analog-to-digital converter)', 'A circuit that measures an analog voltage, such as a sensor’s output, and turns it into a number the processor can use. A 10-bit converter gives one of 1,024 possible numbers.'],
      ['D/A converter (digital-to-analog converter)', 'A circuit that turns a number from the processor into an analog voltage, for example to set the power of a heater or the speed of a motor.'],
      ['Field-programmable gate array (FPGA)', 'A chip full of logic blocks whose wiring can be configured after manufacture, so engineers can build custom hardware circuits without making a new chip.'],
      ['Application-specific integrated circuit (ASIC)', 'A chip designed and manufactured for one particular job. Fast, small and cheap in large volumes, but its circuit can never be changed.'],
      ['Diagnostic port', 'A connector through which a technician’s tool reads the state and fault records of the system being controlled (the engine, for example), not only of its computer.'],
      ['Electromechanical backup', 'A mechanical or electrical mechanism that keeps the system safe, or keeps it working in a limited way, when the computer fails.'],
      ['Feedback loop', 'A cycle in which sensors measure the physical world, the computer decides, actuators act, the world changes, and the sensors measure again.'],
      ['Setpoint', 'The target value a control system tries to hold, such as 21 °C on a thermostat.'],
      ['Hybrid system', 'A system whose behaviour mixes continuous change (a temperature, a speed) with separate discrete events (a switch flips, a gear changes). A pure discrete-event system reacts only to separate events.'],
    ],
    css: `
      .sec-13-1 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; }
      .sec-13-1 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-13-1 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-13-1 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); }
      .sec-13-1 .mw0 > * { min-width: 0; }
      .sec-13-1 .phr { display: inline; font: inherit; color: inherit; background: var(--panel-3); border: 1.5px solid var(--line-2); border-radius: 7px; padding: 0 5px; margin: 1px 0; cursor: pointer; line-height: 1.6; text-align: left; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
      .sec-13-1 .phr:hover { border-color: var(--chc); }
      .sec-13-1 .phr.on { background: var(--hl); border-color: var(--chc); }
      .sec-13-1 .phr i { font-style: normal; font-weight: 800; color: var(--chc); margin-right: 3px; }
      .sec-13-1 .abs-frame { position: relative; border: 2px dashed var(--line-2); border-radius: 16px; padding: 22px 12px 10px; transition: border-color .25s, background .25s; }
      .sec-13-1 .abs-frame.lit { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 7%, transparent); }
      .sec-13-1 .abs-tag { position: absolute; top: -11px; left: 14px; background: var(--panel); padding: 0 8px; font-size: 13px; font-weight: 800; color: var(--muted); border-radius: 6px; }
      .sec-13-1 .abs-frame.lit .abs-tag { color: var(--chc); }
      .sec-13-1 .abs-grid { display: grid; grid-template-columns: minmax(0, 1fr) 118px minmax(0, 1fr); grid-template-rows: auto auto auto; gap: 6px 4px; align-items: center; }
      .sec-13-1 .abs-box { border: 2px solid var(--line-2); background: var(--panel-2); border-radius: 11px; padding: 6px 9px; text-align: center; font-weight: 700; font-size: 15px; line-height: 1.25; transition: box-shadow .25s, transform .25s; }
      .sec-13-1 .abs-box small { display: block; font-size: 12.5px; font-weight: 600; color: var(--muted); }
      .sec-13-1 .abs-box.io { border-color: var(--io); background: var(--io-bg); }
      .sec-13-1 .abs-box.cpu { border-color: var(--cpu); background: var(--cpu-bg); }
      .sec-13-1 .abs-box.lit { box-shadow: 0 0 0 4px var(--hl); transform: scale(1.03); }
      .sec-13-1 .arw { text-align: center; font-size: 22px; font-weight: 800; color: var(--ink-2); line-height: 1; }
      .sec-13-1 .arw small { display: block; font-size: 12.5px; font-weight: 600; color: var(--muted); }
      .sec-13-1 .arw.lit { color: var(--chc); }
      .sec-13-1 .dots { display: flex; flex-wrap: wrap; gap: 3px; align-content: flex-start; }
      .sec-13-1 .dots i { width: 9px; height: 9px; border-radius: 2px; background: var(--io); opacity: .8; }
      .sec-13-1 .dots i.pc { background: var(--cpu); opacity: 1; width: 9px; }
      .sec-13-1 .roof { height: 34px; clip-path: polygon(50% 0, 100% 100%, 0 100%); background: var(--panel-3); margin: 0 4px -6px; display: grid; place-items: end center; padding-bottom: 6px; font-size: 12.5px; font-weight: 800; letter-spacing: .08em; color: var(--muted); }
      .sec-13-1 .zones { display: grid; gap: 8px; align-content: start; }
      .sec-13-1 .zone { border: 1.5px solid var(--line); border-radius: 12px; background: var(--panel-2); padding: 6px 8px 8px; min-width: 0; }
      .sec-13-1 .zone h4 { margin: 0 0 5px; }
      .sec-13-1 .zitems { display: grid; gap: 6px; }
      .sec-13-1 .obj { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 9px 4px 7px; border: 1.5px solid var(--line-2); border-radius: 10px; background: var(--panel); cursor: pointer; font: inherit; color: var(--ink); min-width: 0; }
      .sec-13-1 .obj svg { width: 70px; height: 44px; flex: none; }
      .sec-13-1 .obj .pict * { stroke-width: 1.8; }
      .sec-13-1 .obj > span { font-size: 13px; font-weight: 700; line-height: 1.2; text-align: center; }
      .sec-13-1 .obj:hover { border-color: var(--chc); }
      .sec-13-1 .obj.emb { border-color: var(--ok); background: var(--ok-bg); }
      .sec-13-1 .obj.gen { border-color: var(--warn); background: var(--warn-bg); }
      .sec-13-1 .obj.no { border-style: dashed; background: var(--panel-2); }
      .sec-13-1 .obj.sel { box-shadow: 0 0 0 3px var(--hl); }
      .sec-13-1 .obj .badge { position: absolute; top: 2px; right: 6px; font-size: 14px; font-weight: 800; }
      .sec-13-1 .obj.emb .badge { color: var(--ok); } .sec-13-1 .obj.gen .badge { color: var(--warn); } .sec-13-1 .obj.no .badge { color: var(--muted); }
      .sec-13-1 .area-chips { display: flex; flex-wrap: wrap; gap: 5px; }
      .sec-13-1 .area-chips .chip { opacity: .55; }
      .sec-13-1 .area-chips .chip.ok { opacity: 1; }
      .sec-13-1 .dims { display: flex; flex-direction: column; gap: 4px; }
      .sec-13-1 .dim { display: grid; grid-template-columns: 172px minmax(0, 1fr); align-items: center; gap: 2px 12px; padding: 4px 8px; border: 1.5px solid transparent; border-radius: 10px; background: none; font: inherit; color: var(--ink); text-align: left; cursor: pointer; width: 100%; }
      .sec-13-1 .dim:hover { background: var(--panel-2); }
      .sec-13-1 .dim.on { background: var(--accent-bg); border-color: var(--accent); }
      .sec-13-1 .dim .dl { font-size: 15px; font-weight: 700; line-height: 1.2; }
      .sec-13-1 .trk { position: relative; height: 16px; border-radius: 99px; background: linear-gradient(to right, var(--panel-3), color-mix(in srgb, var(--chc) 22%, var(--panel-3))); }
      .sec-13-1 .mk { position: absolute; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: var(--panel); border: 1.5px solid var(--line-2); font-size: 11px; font-weight: 800; color: var(--muted); display: grid; place-items: center; transition: left .35s; }
      .sec-13-1 .mk.on { width: 26px; height: 26px; margin: -13px 0 0 -13px; background: var(--chc); border-color: var(--chc); color: var(--accent-ink); font-size: 13px; z-index: 2; }
      .sec-13-1 .dims.slim .dim { grid-template-columns: minmax(0, 1fr); }
      .sec-13-1 .dims.slim .ends { grid-column: 1; }
      .sec-13-1 .ends { grid-column: 2; display: flex; justify-content: space-between; font-size: 12.5px; color: var(--muted); font-weight: 600; line-height: 1.2; }
      .sec-13-1 .org g.hot { cursor: pointer; }
      .sec-13-1 .org g.hot rect { stroke-width: 2; transition: stroke-width .2s; }
      .sec-13-1 .org g.hot:hover rect, .sec-13-1 .org g.hot:focus rect { stroke-width: 3.5; }
      .sec-13-1 .org g.hot:focus { outline: none; }
      .sec-13-1 .org g.hot.on rect { stroke-width: 4; filter: drop-shadow(0 0 5px var(--hl)); }
      .sec-13-1 .org g.hot.trace rect { stroke: var(--accent); stroke-width: 4.5; }
      .sec-13-1 .org .lp { stroke: var(--accent); stroke-width: 2.5; fill: none; }
      .sec-13-1 .org .lp.dim { stroke: var(--line-2); }
      .sec-13-1 .chain { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 16px; position: relative; }
      .sec-13-1 .chain.slim { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px 12px; }
      .sec-13-1 .lk { position: relative; border: 2px solid var(--line-2); border-radius: 10px; background: var(--panel-2); padding: 5px 6px; text-align: center; min-width: 0; }
      .sec-13-1 .lk .k { font-size: 12.5px; font-weight: 800; letter-spacing: .04em; color: var(--muted); text-transform: uppercase; }
      .sec-13-1 .lk .v { font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.3; white-space: nowrap; }
      .sec-13-1 .lk .d { font-size: 12.5px; color: var(--ink-2); line-height: 1.25; }
      .sec-13-1 .lk.io { border-color: var(--io); background: var(--io-bg); }
      .sec-13-1 .lk.cpu { border-color: var(--cpu); background: var(--cpu-bg); }
      .sec-13-1 .lk.ok { border-color: var(--ok); background: var(--ok-bg); }
      .sec-13-1 .lk.intr { border-color: var(--intr); background: var(--intr-bg); }
      .sec-13-1 .chain:not(.slim) .lk:not(:last-child)::after { content: '→'; position: absolute; right: -15px; top: 50%; transform: translateY(-50%); font-weight: 800; color: var(--ink-2); font-size: 15px; }
      .sec-13-1 .backarrow { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; border: 2px dashed var(--line-2); border-top: 0; border-radius: 0 0 12px 12px; margin: -6px 40px 0; padding: 4px 8px 2px; line-height: 1.3; }
      .sec-13-1 .board { display: grid; grid-template-columns: minmax(0, 7fr) 34px minmax(0, 5fr); align-items: center; gap: 0; padding: 16px; border-radius: 14px; background: color-mix(in srgb, var(--mem) 10%, var(--panel-2)); border: 1.5px solid color-mix(in srgb, var(--mem) 30%, var(--line)); min-height: 230px; }
      .sec-13-1 .board.slim { grid-template-columns: minmax(0, 1fr); gap: 10px; }
      .sec-13-1 .chipx { position: relative; border: 2.5px solid var(--cpu); background: var(--cpu-bg); border-radius: 10px; padding: 24px 12px 12px; display: flex; flex-direction: column; gap: 8px; min-height: 120px; justify-content: center; }
      .sec-13-1 .chipx::before, .sec-13-1 .chipx::after, .sec-13-1 .xchip::before { content: ''; position: absolute; left: 14px; right: 14px; height: 6px; background: repeating-linear-gradient(to right, var(--ink-2) 0 4px, transparent 4px 11px); opacity: .55; }
      .sec-13-1 .chipx::before, .sec-13-1 .xchip::before { top: -8px; }
      .sec-13-1 .chipx::after { bottom: -8px; }
      .sec-13-1 .chipx > .tag { position: absolute; top: 4px; left: 10px; font-size: 12.5px; font-weight: 800; letter-spacing: .05em; color: var(--cpu); }
      .sec-13-1 .core { border: 2px solid var(--cpu); border-radius: 8px; background: var(--panel); padding: 6px; text-align: center; font-weight: 800; font-size: 15px; }
      .sec-13-1 .onchip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
      .sec-13-1 .part { font: inherit; font-size: 13.5px; font-weight: 700; line-height: 1.2; padding: 6px 4px; border-radius: 8px; border: 2px solid var(--line-2); background: var(--panel); color: var(--ink); cursor: pointer; text-align: center; min-width: 0; }
      .sec-13-1 .part small { display: block; font-size: 12.5px; font-weight: 600; color: var(--muted); }
      .sec-13-1 .part.mem { border-color: var(--mem); } .sec-13-1 .part.io { border-color: var(--io); } .sec-13-1 .part.cpu { border-color: var(--cpu); }
      .sec-13-1 .part:hover { box-shadow: 0 0 0 3px var(--hl); }
      .sec-13-1 .bus { align-self: stretch; display: flex; align-items: center; justify-content: center; }
      .sec-13-1 .bus i { display: block; width: 100%; height: 0; border-top: 5px double var(--ink-2); opacity: .5; }
      .sec-13-1 .bus.off i { opacity: .1; }
      .sec-13-1 .exts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 10px; align-content: center; min-height: 80px; }
      .sec-13-1 .xchip { position: relative; }
      .sec-13-1 .xchip > .part { width: 100%; background: var(--panel-2); }
      .sec-13-1 .tier { display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: center; gap: 8px; text-align: left; font: inherit; color: var(--ink); background: var(--panel); border: 2px solid var(--line-2); border-radius: 12px; padding: 7px 10px; cursor: pointer; width: 100%; }
      .sec-13-1 .tier:hover { border-color: var(--chc); }
      .sec-13-1 .tier.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 8%, var(--panel)); }
      .sec-13-1 .tier .ic { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; font-weight: 800; font-size: 15px; }
      .sec-13-1 .tier b { display: block; font-size: 15px; line-height: 1.25; }
      .sec-13-1 .tier span.s { font-size: 13px; color: var(--muted); }
      .sec-13-1 .ebar { display: flex; flex: none; height: 18px; border-radius: 6px; overflow: hidden; background: var(--panel-3); }
      .sec-13-1 .ebar i { display: block; height: 100%; transition: width .3s; }
    `,
    steps: [
      {
        title: 'The computers you never see',
        kind: 'story',
        html: `
          <div class="split l fill mw0">
            <div class="stack" style="gap:10px">
              <p class="lead m0">Most computers do not look like computers. They hide inside cars, washers, printers and pacemakers, each doing one job for the product around it.</p>
              <div class="card white" style="font-size:16px;line-height:1.5;padding:10px 14px">
                <div class="xs muted b" style="margin-bottom:4px">DEFINITION · CLICK EACH PART</div>
                An <span class="t">embedded system</span> is
                <button type="button" class="phr" data-k="0"><i>1</i>a combination of computer hardware and software,</button>
                <button type="button" class="phr" data-k="1"><i>2</i>and perhaps mechanical or other parts,</button>
                <button type="button" class="phr" data-k="2"><i>3</i>designed to perform one dedicated function,</button>
                <button type="button" class="phr" data-k="3"><i>4</i>usually as part of a larger system or product.</button>
              </div>
              <div class="callout analogy m0" data-label="Analogy">A laptop is a multi-tool: you decide what it does today. An embedded computer is the gear inside a clock: one job, all day, for the life of the product.</div>
              <h4 class="m0" style="margin-top:2px">In this section you will</h4>
              <div class="row gap-s small"><span class="chip io">spot hidden computers</span><span class="chip warn">compare requirements</span><span class="chip cpu">open up the box</span><span class="chip ok">run a feedback loop</span><span class="chip mem">build a microcontroller</span></div>
            </div>
            <div class="card stack" style="gap:10px">
              <h4 class="m0">Example: the anti-lock braking system (ABS) of a car</h4>
              <div class="abs-frame">
                <span class="abs-tag">THE CAR · the larger product</span>
                <div class="abs-grid">
                  <div class="abs-box io" data-p="sen">Wheel-speed sensor<small>measures how fast the wheel turns</small></div>
                  <div class="arw" data-a="1">→<small>speed</small></div>
                  <div class="abs-box cpu" data-p="ctl">ABS controller<small>microcontroller + its program</small></div>
                  <div class="arw" data-a="4">↑</div>
                  <div class="xs muted center b" style="line-height:1.3">↻ the loop repeats many times a second</div>
                  <div class="arw" data-a="2">↓<small>release · hold · reapply</small></div>
                  <div class="abs-box" data-p="brk">Brake at the wheel<small>caliper squeezes the disc</small></div>
                  <div class="arw" data-a="3">←<small>pressure</small></div>
                  <div class="abs-box io" data-p="hyd">Hydraulic unit<small>valves and a pump</small></div>
                </div>
              </div>
              <div class="narr abs-cap" style="min-height:76px"></div>
              <div class="card white tight stack" style="gap:6px">
                <div class="row" style="justify-content:space-between"><b class="small">How many are there?</b><span class="xs muted">rounded early-2020s yearly shipments</span></div>
                <div class="row nw" style="gap:12px;align-items:flex-start"><div class="dots" style="flex:1"></div><div class="small cnt" style="width:250px;flex:none;line-height:1.4"></div></div>
              </div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const PARTS = [
            { lit: ['ctl'], frame: false, cap: '<b>Hardware and software.</b> The ABS controller is a small sealed box holding a <span class="t">microcontroller</span> and the program in its memory. That program never changes while you drive; it was written for this one job.' },
            { lit: ['hyd', 'brk'], frame: false, cap: '<b>Mechanical parts.</b> Software alone cannot stop a car. The controller works through a hydraulic unit (electrically switched valves and a small pump) that changes the brake pressure at each wheel.' },
            { lit: ['sen', 'ctl', 'hyd', 'brk'], arrows: true, frame: false, cap: '<b>One dedicated function.</b> Watch each wheel; if one slows much faster than the car (it is about to lock and skid), briefly release its brake pressure, then reapply it. That is the whole job, repeated many times a second.' },
            { lit: [], frame: true, cap: '<b>Part of a larger product.</b> Nobody buys “an ABS computer”. The driver just presses the brake pedal; the controller quietly does its work inside the car, next to dozens of other embedded computers.' },
          ];
          const btns = ctx.$$('.phr'), cap = ctx.$('.abs-cap'), frame = ctx.$('.abs-frame');
          function show(k) {
            const p = PARTS[k];
            btns.forEach((b) => b.classList.toggle('on', +b.dataset.k === k));
            ctx.$$('.abs-box').forEach((b) => b.classList.toggle('lit', p.lit.includes(b.dataset.p)));
            ctx.$$('.arw').forEach((a) => a.classList.toggle('lit', !!p.arrows));
            frame.classList.toggle('lit', p.frame);
            cap.innerHTML = p.cap;
          }
          btns.forEach((b) => { b.onclick = () => show(+b.dataset.k); });
          show(0);
          const ratio = MCU_PER_YEAR / PC_PER_YEAR;
          const n = Math.round(ratio);
          const dots = ctx.$('.dots');
          dots.append(h('i', { class: 'pc', title: 'one PC' }), ...ctx.util.range(n).map(() => h('i')));
          ctx.$('.cnt').innerHTML = `<b style="color:var(--cpu)">■ 1 PC</b> for every <b style="color:var(--io)">■ about ${n} microcontrollers</b>: about ${ctx.util.fmt(MCU_PER_YEAR / 1e9, 0)} billion a year against ${ctx.util.fmt(PC_PER_YEAR / 1e9, 2)} billion PCs (and ${ctx.util.fmt(PHONE_PER_YEAR / 1e9, 1)} billion phones, each full of embedded chips itself).`;
        },
      },

      {
        title: 'Spot the embedded computers',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const VERDICT = {
            emb: { cls: 'emb', badge: '✓', chip: 'ok', label: 'Embedded computer inside' },
            gen: { cls: 'gen', badge: '!', chip: 'warn', label: 'General-purpose computer: a trap' },
            no: { cls: 'no', badge: '–', chip: '', label: 'No computer at all' },
          };
          const FACT = {
            home: 'An ordinary home holds dozens of embedded computers: in the remote controls, the toothbrush, the smoke alarm, the router and every charger brick that negotiates its voltage.',
            car: 'This car shows only a handful. A typical new car has dozens of <span class="t" data-t="electronic control unit">electronic control units</span>, and some high-end models carry more than 100, linked by in-car networks.',
            world: 'Medicine, factories, offices, aircraft and spacecraft all depend on embedded computers. Here a failure can cost lives or millions, so their requirements are far stricter than a TV’s.',
          };
          const seen = new Set();
          let scene = 0, sel = null;
          const all = SCENES.flatMap((sc, si) => sc.zones.flatMap((z) => z.items.map((it) => Object.assign({ si }, it))));
          const sceneEl = h('div', { class: 'stack', style: { gap: '8px' } });
          const factEl = h('div', { class: 'callout why small', 'data-label': 'Did you know', style: { margin: 'auto 0 0' } });
          const nameEl = h('b', { style: { fontSize: '18px' } });
          const verdEl = h('span', { class: 'chip' });
          const textEl = h('p', { class: 'm0', style: { fontSize: '15px', lineHeight: '1.45' } });
          const areaEl = h('div', { class: 'small' });
          const countEl = h('div', { class: 'small' });
          const meter = h('i', { style: { width: '0%' } });
          const chips = AREAS.map((a) => h('span', { class: 'chip' }, a));
          const btnOf = new Map();
          const seg = ctx.ui.seg(SCENES.map((s, i) => ({ value: i, label: s.label })), scene, (v) => { scene = v; drawScene(); paint(); });
          function drawScene() {
            const sc = SCENES[scene];
            btnOf.clear();
            const zones = h('div', { class: 'zones', style: { gridTemplateColumns: ctx.narrow ? 'minmax(0, 1fr)' : sc.cols.split(' ').map((c) => 'minmax(0, ' + c + ')').join(' ') } },
              ...sc.zones.map((z) => h('div', { class: 'zone' }, h('h4', {}, z.name),
                h('div', { class: 'zitems', style: { gridTemplateColumns: `repeat(${ctx.narrow ? 3 : z.cols}, minmax(0, 1fr))` } },
                  ...z.items.map((it) => {
                    const b = h('button', { type: 'button', class: 'obj', 'aria-label': it.n, onclick: () => inspect(it) },
                      h('span', { class: 'badge' }),
                      ctx.s('svg', { viewBox: '0 0 64 40', class: 'pict', 'aria-hidden': 'true', html: PICT[it.p] }),
                      h('span', {}, it.n));
                    btnOf.set(it, b);
                    return b;
                  })))));
            sceneEl.replaceChildren(...(sc.key === 'home' && !ctx.narrow ? [h('div', { class: 'roof' }, 'HOME')] : []), zones);
            factEl.innerHTML = FACT[sc.key];
          }
          function inspect(it) {
            seen.add(it.n);
            sel = it;
            paint();
          }
          function paint() {
            btnOf.forEach((b, it) => {
              const on = seen.has(it.n), V = VERDICT[it.v];
              b.className = 'obj' + (on ? ' ' + V.cls : '') + (sel === it ? ' sel' : '');
              b.querySelector('.badge').textContent = on ? V.badge : '';
            });
            if (sel) {
              const V = VERDICT[sel.v];
              nameEl.textContent = sel.n;
              verdEl.className = 'chip ' + V.chip;
              verdEl.textContent = V.label;
              textEl.innerHTML = sel.t;
              areaEl.innerHTML = sel.v === 'emb' ? 'Application area: <b>' + AREAS[sel.a] + '</b>' : '<span class="muted">Not counted as an embedded system.</span>';
            } else {
              nameEl.textContent = 'Click anything that might hide a computer';
              verdEl.className = 'chip'; verdEl.textContent = 'not inspected';
              textEl.innerHTML = 'Look carefully: some objects contain an <span class="t">embedded system</span>, some contain no computer at all, and a few are <span class="t" data-t="general-purpose computer">general-purpose computers</span>, which do not count.';
              areaEl.textContent = '';
            }
            const embHere = all.filter((it) => it.si === scene && it.v === 'emb');
            const embAll = all.filter((it) => it.v === 'emb');
            const foundHere = embHere.filter((it) => seen.has(it.n)).length, foundAll = embAll.filter((it) => seen.has(it.n)).length;
            countEl.innerHTML = `Embedded computers found in this scene: <b>${foundHere} of ${embHere.length}</b><br>In all three scenes: <b>${foundAll} of ${embAll.length}</b>`;
            meter.style.width = (100 * foundAll / embAll.length) + '%';
            chips.forEach((c, i) => { c.className = 'chip' + (embAll.some((it) => it.a === i && seen.has(it.n)) ? ' ok' : ''); });
          }
          function reset() { seen.clear(); sel = null; paint(); }
          el.append(h('div', { class: 'split r fill mw0' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Where are the computers?'), seg),
              sceneEl, factEl),
            h('div', { class: 'card stack', style: { gap: '9px' } },
              h('h4', { class: 'm0' }, 'What is inside?'),
              h('div', { class: 'card white stack', style: { gap: '6px', minHeight: '178px', padding: '10px 14px' } },
                h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' } }, nameEl, verdEl), textEl, areaEl),
              countEl, h('div', { class: 'meter' }, meter),
              h('div', { class: 'xs muted b' }, 'APPLICATION AREAS YOU HAVE FOUND'),
              h('div', { class: 'area-chips' }, ...chips),
              h('div', { class: 'row', style: { marginTop: 'auto', justifyContent: 'flex-end' } }, h('button', { class: 'btn sm', type: 'button', onclick: reset }, '↻ Start over')))));
          drawScene();
          paint();
        },
      },

      {
        title: 'One label, wildly different requirements',
        kind: 'compare',
        render(el, ctx) {
          const { h } = ctx;
          const QUAL = ['Safety', 'Reliability', 'Real-time', 'Flexibility', 'Legislation'];
          const DIMS = [
            { n: 'Size', lo: 'one tiny chip', hi: 'large networked system',
              g: 'Embedded systems range from a single chip in a greeting card to a factory floor full of networked controllers.' },
            { n: 'Cost pressure', lo: 'price hardly matters', hi: 'every cent counts',
              g: 'For a product sold by the million, saving a few cents per unit is real money. For a one-off system, getting it right matters far more than the price.' },
            { n: 'Quality requirements', lo: 'relaxed', hi: 'very strict',
              g: 'How strict the demands are, and which ones: <b>safety</b>, <b>reliability</b>, <b>real-time</b> behaviour, <b>flexibility</b> (updates, new features) and <b>legislation</b> (laws and certification). They usually come in combinations.' },
            { n: 'Lifetime', lo: 'a couple of years', hi: 'decades',
              g: 'Some products are replaced after two or three years. Others must keep working for decades, long after their chips have stopped being made.' },
            { n: 'Environment', lo: 'mild, indoors', hi: 'harsh',
              g: 'Many embedded systems live far from an air-conditioned office: in heat and cold, vibration, humidity, dust or radiation.' },
            { n: 'Workload', lo: 'slow and steady', hi: 'fast and changing',
              g: 'The work itself: a static or a changing load, slow or fast events, and whether it is heavy on computing or on interfacing with sensors and actuators.' },
            { n: 'Model of computation', lo: 'discrete events', hi: 'hybrid, continuous',
              g: 'How the behaviour is best described: as reactions to separate events (a discrete-event system), or as continuous physical change mixed with events (a <span class="t">hybrid system</span>).' },
          ];
          const DEV = [
            { n: 'Fitness band', k: 'B', q: [3, 4], v: [
              [8, 'One small board: a microcontroller, a few sensors and a radio.'],
              [90, 'Sold by the million in a crowded market, so cents matter.'],
              [30, 'A crash is annoying, not dangerous. Radio laws apply, and updates add features.'],
              [20, 'Usually replaced after two or three years.'],
              [40, 'Sweat, rain and knocks, but no extremes.'],
              [25, 'Count steps, show the time, sync now and then: light work, mostly interfacing.'],
              [15, 'Separate events: a step, a button press, an incoming message.'] ] },
            { n: 'Pacemaker', k: 'P', q: [0, 1, 2, 4], v: [
              [15, 'A few grams: everything sits in a small sealed case.'],
              [25, 'An expensive medical device. Reliability matters far more than price.'],
              [94, 'A missed beat can kill, and medical regulators must approve the device.'],
              [66, 'Must work for many years inside the body; replacing it means surgery.'],
              [60, 'Warm, wet and salty inside the body, so it is sealed against fluids.'],
              [15, 'About one beat a second: little computing, mostly sensing and pulsing.'],
              [35, 'Mostly events (a beat sensed, a timer expiring) against the heart’s continuous rhythm.'] ] },
            { n: 'Engine controller', k: 'E', q: [0, 1, 2, 4], v: [
              [35, 'A sealed box of electronics, one of dozens of ECUs networked in the car.'],
              [77, 'Built into millions of cars, so saving a few cents each adds up.'],
              [84, 'A late spark damages the engine, and emissions laws are strict.'],
              [77, 'Must outlast the car itself, often 15 years or more.'],
              [88, 'Under the hood: heat, cold, vibration, damp and electrical noise.'],
              [88, 'Hundreds of fuel and spark events a second, at a speed that keeps changing.'],
              [90, 'Hybrid: continuous engine physics plus discrete events such as gear changes.'] ] },
            { n: 'Mars rover', k: 'R', q: [0, 1, 2, 3], v: [
              [95, 'A large system: several computers, instruments, cameras and motors.'],
              [10, 'A one-off mission: reliability beats price every time.'],
              [100, 'No repair is possible, so everything is checked again and again. New software can still be sent from Earth.'],
              [90, 'Designed for years; some rovers have kept working for over a decade.'],
              [100, 'Radiation, dust, and nights far below freezing.'],
              [70, 'Long quiet spells, then heavy image processing to plan the next drive.'],
              [80, 'Hybrid: wheels, arm and temperatures change continuously; modes switch in steps.'] ] },
          ];
          function profiles(panel) {
            let dev = 2, dim = 2;
            const rows = DIMS.map((d, i) => {
              const marks = DEV.map((x) => h('span', { class: 'mk' }, x.k));
              const b = h('button', { type: 'button', class: 'dim', onclick: () => { dim = i; paint(); } },
                h('span', { class: 'dl' }, (i + 1) + ' · ' + d.n), h('span', { class: 'trk' }, ...marks),
                h('span', { class: 'ends' }, h('span', {}, d.lo), h('span', {}, d.hi)));
              return { b, marks };
            });
            const seg = ctx.ui.seg(DEV.map((x, i) => ({ value: i, label: x.n })), dev, (v) => { dev = v; paint(); });
            const dName = h('h3', { class: 'm0' }), dGen = h('p', { class: 'm0 small' }), who = h('div', { class: 'row gap-s' }), why = h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.45' } }), qual = h('div', { class: 'row gap-s' });
            function paint() {
              rows.forEach((r, i) => {
                r.b.classList.toggle('on', i === dim);
                r.marks.forEach((m, j) => { m.style.left = 'calc(13px + (100% - 26px) * ' + DEV[j].v[i][0] / 100 + ')'; m.classList.toggle('on', j === dev); m.title = DEV[j].n; });
              });
              const D = DIMS[dim], X = DEV[dev];
              dName.textContent = (dim + 1) + ' · ' + D.n;
              dGen.innerHTML = D.g;
              who.replaceChildren(h('span', { class: 'chip accent' }, X.k + ' = ' + X.n), h('span', { class: 'xs muted b' }, D.n.toUpperCase()));
              why.textContent = X.v[dim][1];
              qual.replaceChildren(...(dim === 2 ? QUAL.map((q, i) => h('span', { class: 'chip ' + (X.q.includes(i) ? 'ok' : '') }, (X.q.includes(i) ? '✓ ' : '') + q)) : []));
            }
            panel.append(h('div', { class: 'split r fill mw0', style: { gap: '18px' } },
              h('div', { class: 'stack', style: { gap: '6px' } }, seg, h('div', { class: 'dims' + (ctx.narrow ? ' slim' : '') }, ...rows.map((r) => r.b))),
              h('div', { class: 'card stack', style: { gap: '8px' } }, dName, dGen,
                h('div', { class: 'card white stack', style: { gap: '6px', padding: '10px 12px', minHeight: '128px' } }, who, why, qual),
                h('div', { class: 'callout why small', style: { margin: 'auto 0 0' }, 'data-label': 'Why it matters', html: 'One operating system cannot suit all of these. A pacemaker’s software must be tiny, proven and frugal; a rover’s must survive radiation and accept updates from Earth. Embedded OSs are chosen, or cut down, to fit each device.' }))));
            paint();
          }
          const ITEMS = [
            ['Infusion pump in a hospital ward', 0, 'A wrong dose can injure or kill a patient, so alarms, double checks and certification come first.'],
            ['Musical greeting card', 1, 'It sells for a few dollars and is thrown away. The sound chip inside can cost only a few cents.'],
            ['Soil-moisture sensor buried in a field for five years', 2, 'Nobody will dig it up to change the battery, so it must sip energy and sleep almost all the time.'],
            ['Spark timing in an engine controller', 3, 'At 6,000 rpm the crankshaft turns 36° every millisecond, so a spark that is a fraction of a millisecond late fires at the wrong moment.'],
            ['Railway level-crossing gate controller', 0, 'Whatever fails, the gates must end up down and the lights flashing (a fail-safe design). Lives depend on it.'],
            ['Talking toy that sells for $10', 1, 'The whole toy costs ten dollars in the shop, so the electronics budget is a few dimes.'],
            ['Wildlife tracking collar', 2, 'It must report its position for a year or more on one battery, far from any charger.'],
            ['Drone stabiliser', 3, 'It reads its gyroscope and corrects the four motor speeds hundreds or thousands of times a second; a late correction and the drone tips over.'],
          ];
          const BK = ['Safety', 'Cost', 'Power', 'Real-time timing'];
          function sorter(panel) {
            let order = [], pos = 0, score = 0;
            const nameEl = h('div', { style: { fontSize: '21px', fontWeight: 800, lineHeight: 1.25 } });
            const countEl = h('span', { class: 'chip warn' });
            const fb = h('div', { class: 'narr', style: { minHeight: '92px' } });
            const scoreEl = h('b', { class: 'num' });
            const lists = BK.map(() => h('div', { class: 'stack', style: { gap: '4px' } }));
            const btns = BK.map((b, i) => h('button', { type: 'button', class: 'btn', style: { width: '100%' }, onclick: () => drop(i) }, b));
            function deal() {
              if (pos >= order.length) {
                nameEl.textContent = score === order.length ? 'All ' + order.length + ' right!' : 'Done: ' + score + ' of ' + order.length + ' right';
                countEl.textContent = 'finished';
                btns.forEach((b) => { b.disabled = true; });
                return;
              }
              nameEl.textContent = ITEMS[order[pos]][0];
              countEl.textContent = (pos + 1) + ' of ' + order.length;
            }
            function drop(i) {
              if (pos >= order.length) return;
              const it = ITEMS[order[pos]], ok = it[1] === i;
              if (ok) score++;
              lists[it[1]].append(h('span', { class: 'chip ' + (ok ? 'ok' : 'bad'), style: { whiteSpace: 'normal', lineHeight: 1.3, padding: '2px 9px' }, text: (ok ? '✓ ' : '✗ ') + it[0] }));
              fb.className = 'narr ' + (ok ? 'ok' : 'bad');
              fb.innerHTML = (ok ? '<b>Right.</b> ' : `<b>Not quite.</b> ${BK[i]} matters too, but <b>${BK[it[1]].toLowerCase()}</b> dominates here. `) + it[2];
              scoreEl.textContent = score + ' / ' + (pos + 1);
              pos++;
              deal();
            }
            function reset() {
              order = ctx.util.shuffle(ITEMS.map((_, i) => i)); pos = 0; score = 0;
              lists.forEach((l) => l.replaceChildren());
              btns.forEach((b) => { b.disabled = false; });
              fb.className = 'narr';
              fb.innerHTML = 'Real devices care about several requirements at once. Pick the one that <b>dominates</b> the design.';
              scoreEl.textContent = '0 / 0';
              deal();
            }
            panel.append(h('div', { class: 'split l fill mw0', style: { gap: '18px' } },
              h('div', { class: 'stack', style: { gap: '10px' } },
                h('div', { class: 'card warn stack', style: { gap: '4px', minHeight: '110px', justifyContent: 'center', background: 'var(--warn-bg)', borderColor: 'var(--warn)' } },
                  h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted b' }, 'WHICH REQUIREMENT DOMINATES?'), countEl), nameEl),
                fb,
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small' }, 'Score: ', scoreEl), h('button', { class: 'btn sm', type: 'button', onclick: reset }, '↻ Shuffle and play again')),
                h('div', { class: 'grid-2 small', style: { gap: '4px 12px', lineHeight: 1.35 } },
                  h('div', { html: '<b>Safety:</b> nobody is hurt, even when a part fails.' }), h('div', { html: '<b>Cost:</b> the price of every unit made.' }),
                  h('div', { html: '<b>Power:</b> energy used, so battery life.' }), h('div', { html: '<b>Real-time:</b> the right result at the right moment.' })),
                h('div', { class: 'callout warn small', style: { margin: 'auto 0 0' }, 'data-label': 'Common mistake', html: 'Answering “safety” every time. Safety matters for nearly every device here. Ask instead: if the designers ignored one requirement, which one would make this product fail first?' })),
              h('div', { class: 'grid-2', style: { alignItems: 'start', gap: '10px' } },
                ...BK.map((b, i) => h('div', { class: 'card tight stack', style: { gap: '6px', minHeight: '178px' } }, btns[i], lists[i])))));
            reset();
          }
          el.append(ctx.ui.tabs([
            { label: 'Seven ways they differ', render: profiles },
            { label: 'Game: what matters most?', render: sorter },
          ]));
        },
      },

      {
        title: 'Open the box: the elements of an embedded system',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const C = {
            env: { n: 'Environment', sub: 'the physical system being controlled', cls: 's-ok',
              t: 'The physical system the computer watches and steers. The loop closes through it: actuators change it, and sensors measure the change.',
              ex: 'The engine itself: air, fuel, combustion and a spinning crankshaft.' },
            sen: { n: 'Sensors', sub: 'measure the world', cls: 's-io', term: 'Sensor',
              t: 'Measure something physical (temperature, pressure, speed, position, light). Most produce an analog voltage that rises and falls with the quantity.',
              ex: 'Crankshaft position, air flow, coolant temperature, throttle position and the oxygen left in the exhaust.' },
            ad: { n: 'A/D', sub: 'converter', cls: 's-io', term: 'A/D converter',
              t: 'Samples a sensor’s voltage and turns it into a number. A 10-bit converter has 2¹⁰ = 1,024 possible values, so a 0–3.3 V range is cut into steps of about ' + ctx.util.fmt(3300 / 1024, 1) + ' mV.',
              ex: 'Turns the coolant sensor’s voltage into a number the program can look up in its tables.' },
            proc: { n: 'Processor', sub: 'runs the program', cls: 's-cpu',
              t: 'Runs the control program, round after round. In most embedded systems it is a microcontroller, often with no operating system or only a small real-time one.',
              ex: 'A 32-bit microcontroller works out the fuel amount and the spark timing for every cylinder, every engine cycle.' },
            mem: { n: 'Memory', sub: 'flash + RAM', cls: 's-mem',
              t: 'Nonvolatile memory (flash or ROM) holds the program and fixed tables and survives power-off. RAM holds the changing data while the system runs.',
              ex: 'Flash holds the program plus calibration maps: tables of fuel and spark settings for each engine speed and load.' },
            sw: { n: 'Software', sub: 'firmware', cls: 's-os',
              t: 'Written for this one job and stored as firmware. It starts by itself at power-on and is changed rarely, if ever, once the product ships.',
              ex: 'The engine-management program. A workshop can update it, and some newer cars receive updates over the air.' },
            da: { n: 'D/A', sub: 'converter', cls: 's-io', term: 'D/A converter',
              t: 'Turns a number from the program into a voltage that drives an actuator. Many actuators are simply switched on and off by digital outputs instead, with the timing setting the effect.',
              ex: 'Injectors and spark coils are switched on and off by digital outputs at moments timed to the microsecond; a rapidly switched output sets the throttle motor’s average power.' },
            act: { n: 'Actuators', sub: 'act on the world', cls: 's-io', term: 'Actuator',
              t: 'Act on the physical world: motors, valves, heaters, pumps, relays, lights, loudspeakers.',
              ex: 'Fuel injectors, ignition coils, the electronic throttle and the cooling fan.' },
            hmi: { n: 'Human interface', sub: 'lights, buttons, display', cls: 's-io',
              t: 'Lets people see and steer the system: buttons, knobs, indicator lights, a small display, a beep. Often very simple, sometimes absent.',
              ex: 'The check-engine warning light and the readings shown on the dashboard.' },
            diag: { n: 'Diagnostic port', sub: 'for a technician’s tool', cls: 's-io', term: 'Diagnostic port',
              t: 'A connector for a technician’s tool. It reports on the system being controlled, not only on the computer: faults seen, sensor readings, stored error codes.',
              ex: 'The OBD-II socket under the dashboard (required on US cars since the 1996 model year) reports faults such as a misfiring cylinder.' },
            hw: { n: 'Special-purpose HW', sub: 'FPGA · ASIC · analog', cls: 's-cpu',
              t: 'Hardware for jobs software would do too slowly or too unreliably: an <span class="t">FPGA</span> (reconfigurable logic), an <span class="t">ASIC</span> (a custom chip) or nondigital circuits.',
              ex: 'A dedicated timing unit fires the injector and spark pulses with microsecond precision while the processor computes the next values.' },
            emb: { n: 'Backup & safety', sub: 'electromechanical', cls: 's-warn', term: 'Electromechanical backup',
              t: 'If the computer fails, mechanical or simple electrical parts keep the system safe or let it carry on in a limited way.',
              ex: 'If the electronic throttle fails, springs pull the throttle to a fixed, slightly open position so the car can limp to a garage.' },
            aux: { n: 'Auxiliary systems', sub: 'power supply · cooling', cls: 's-panel',
              t: 'Keep the electronics alive: a power supply that turns a battery or the mains into clean, steady voltages, and cooling where heat demands it.',
              ex: 'Regulators turn the car’s noisy 12 V supply (which sags while the engine starts) into steady low voltages; the case sheds under-hood heat.' },
          };
          const LOOP = ['env', 'sen', 'ad', 'proc', 'da', 'act'];
          const W = ctx.narrow
            ? { vb: [360, 632], box: { env: [10, 8, 300, 44], sen: [10, 74, 300, 44], ad: [10, 140, 300, 44], proc: [10, 210, 300, 40], mem: [10, 256, 146, 44], sw: [164, 256, 146, 44], da: [10, 326, 300, 44], act: [10, 392, 300, 44],
                hmi: [10, 462, 166, 46], diag: [184, 462, 166, 46], hw: [10, 518, 166, 46], emb: [184, 518, 166, 46], aux: [10, 574, 340, 46] },
              core: [4, 202, 312, 106],
              loop: ['M160 52V74', 'M160 118V140', 'M160 184V202', 'M160 308V326', 'M160 370V392', 'M310 414H338V30H312'], links: [] }
            : { vb: [680, 470], box: { env: [10, 404, 660, 56], sen: [10, 178, 118, 64], ad: [144, 182, 78, 56], proc: [250, 160, 180, 44], mem: [250, 210, 86, 46], sw: [344, 210, 86, 46], da: [458, 182, 78, 56], act: [552, 178, 118, 64],
                hmi: [250, 40, 180, 50], diag: [10, 40, 180, 50], hw: [250, 296, 180, 50], emb: [460, 296, 140, 50], aux: [490, 40, 180, 50] },
              core: [240, 146, 200, 120],
              loop: ['M66 404V242', 'M128 210H144', 'M222 210H240', 'M440 210H458', 'M536 210H552', 'M611 242V404'],
              links: ['M340 90V146', 'M190 65H215V170H240', 'M340 296V266', 'M570 296V242', 'M580 90V120H420V146'] };
          const svg = s('svg', { viewBox: '0 0 ' + W.vb.join(' '), width: '100%', class: 'org', role: 'group', 'aria-label': 'Organization of an embedded system' });
          const groups = {};
          function draw() {
            const kids = [];
            const [cx, cy, cw, chh] = W.core;
            kids.push(s('rect', { x: cx, y: cy, width: cw, height: chh, rx: 14, class: 's-muted', 'stroke-dasharray': '6 5' }));
            kids.push(s('text', { x: cx + 8, y: cy - 4, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'the computer'));
            W.links.forEach((d) => kids.push(s('path', { d, class: 's-line', 'stroke-dasharray': '5 4', 'marker-end': 'url(#arr-muted)' })));
            W.loop.forEach((d, i) => kids.push(s('path', { d, class: 'lp', 'data-i': i, 'marker-end': 'url(#arr-accent)' })));
            Object.keys(W.box).forEach((k) => {
              const [x, y, w, bh] = W.box[k], c = C[k];
              const g = s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': c.n, onclick: () => pick(k), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(k); } } },
                s('rect', { x, y, width: w, height: bh, rx: 10, class: c.cls }),
                s('text', { x: x + w / 2, y: y + bh / 2 - 2, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, c.n),
                s('text', { x: x + w / 2, y: y + bh / 2 + 14, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, c.sub));
              groups[k] = g;
              kids.push(g);
            });
            if (!ctx.narrow) kids.push(s('text', { x: 340, y: 392, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--accent)' }, '↻ feedback loop: the world → sensors → computer → actuators → the world'));
            svg.replaceChildren(...kids);
          }
          const nameEl = h('h3', { class: 'm0' }), tEl = h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.45' } }), exEl = h('p', { class: 'm0 small', style: { lineHeight: '1.45' } });
          const cap = h('div', { class: 'narr', style: { minHeight: '64px' } });
          let gen = 0, cur = 'sen';
          function pick(k) {
            gen++;
            cur = k;
            ctx.$$('.org .lp').forEach((p) => p.classList.remove('dim'));
            show(k);
            cap.className = 'narr';
            cap.innerHTML = 'Click any box. Press <b>Trace the loop</b> to follow one reading all the way round.';
          }
          function show(k, tracing) {
            const c = C[k];
            Object.entries(groups).forEach(([q, g]) => { g.classList.toggle('on', q === k && !tracing); g.classList.toggle('trace', !!tracing && q === k); });
            nameEl.innerHTML = c.term ? `<span class="t" data-t="${c.term}">${c.n === 'A/D' || c.n === 'D/A' ? c.n + ' converter' : c.n}</span>` : c.n;
            tEl.innerHTML = c.t;
            exEl.innerHTML = '<b>In a car’s engine controller:</b> ' + c.ex;
          }
          const STEPS = [
            'The driver presses the accelerator and more air rushes into the engine: the <b>environment</b> has changed.',
            'The air-flow <b>sensor</b>’s output voltage rises with the new air flow.',
            'The <b>A/D converter</b> turns the sensor’s voltage into a number.',
            'The <b>processor</b> runs the program: more air, so more fuel and a new spark timing.',
            'The output stage (a <b>D/A converter</b> or timed digital switch) turns the decision into an electrical signal.',
            'The <b>actuators</b> (injectors, spark coils) act, and the engine responds. Back to the start: the loop never stops.',
          ];
          async function trace() {
            const g = ++gen;
            cap.className = 'narr ok';
            for (let i = 0; i < LOOP.length; i++) {
              show(LOOP[i], true);
              ctx.$$('.org .lp').forEach((p) => p.classList.toggle('dim', +p.dataset.i !== i));
              cap.innerHTML = `<b>${i + 1} of ${LOOP.length}.</b> ` + STEPS[i];
              await ctx.sleep(1700);
              if (!ctx.alive || g !== gen) return;
            }
            ctx.$$('.org .lp').forEach((p) => p.classList.remove('dim'));
            show(cur);
            cap.innerHTML = 'That is the <span class="t">feedback loop</span>. Everything else on the diagram supports it: people, technicians, special hardware, backup and power.';
          }
          draw();
          const traceBtn = h('button', { class: 'btn primary sm', type: 'button', onclick: trace }, '▶ Trace the loop');
          const side = h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'm0', html: 'Inside every embedded system sits a computer, wrapped in hardware that connects it to the world. Click each box.' }),
            h('div', { class: 'card white stack', style: { gap: '7px', minHeight: ctx.narrow ? '0' : '232px' } }, nameEl, tEl, exEl),
            h('div', { class: 'row' }, traceBtn, h('button', { class: 'btn sm', type: 'button', onclick: () => pick('sen') }, '↻ Reset')),
            cap,
            h('div', { class: 'callout why small', style: { margin: 'auto 0 0' }, 'data-label': 'Why it matters', html: 'An embedded system exists to run this loop, on time, for years. That is why its operating system, if it has one at all, must be small, react quickly and reach devices directly (section 13.2).' }));
          const fig = h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center', padding: '8px' } }, svg);
          el.append(h('div', { class: 'split l fill mw0' }, ...(ctx.narrow ? [fig, side] : [side, fig])));
          pick('sen');
        },
      },

      {
        title: 'Lab: run a thermostat’s feedback loop',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const N = 180;
          let S = 21, mode = 'onoff', win = false, running = true, st;
          function init() { st = { t: 0, T: TH.t0, Tr: TH.t0, on: 0, I: 0, P: 0, code: adcCode(TH.t0), Tm: codeToC(adcCode(TH.t0)), dac: 0, why: '', hist: [] }; }
          /* one pass round the loop: read the sensor, decide, drive the heater, let the room respond */
          function tick() {
            const code = adcCode(st.T), Tm = codeToC(code), e = S - Tm;
            let P, why;
            if (mode === 'onoff') {
              const was = st.on;
              if (Tm < S - TH.band) st.on = 1; else if (Tm > S + TH.band) st.on = 0;
              P = st.on; st.dac = null;
              why = Tm < S - TH.band ? `Measured ${ctx.util.fmt(Tm, 1)} °C is below ${ctx.util.fmt(S - TH.band, 1)} °C, so the relay is <b>ON</b>.`
                : Tm > S + TH.band ? `Measured ${ctx.util.fmt(Tm, 1)} °C is above ${ctx.util.fmt(S + TH.band, 1)} °C, so the relay is <b>OFF</b>.`
                : `Measured ${ctx.util.fmt(Tm, 1)} °C is inside the band ${ctx.util.fmt(S - TH.band, 1)}–${ctx.util.fmt(S + TH.band, 1)} °C, so the relay <b>stays ${was ? 'ON' : 'OFF'}</b>. The band stops it clicking every minute.`;
            } else {
              const u0 = TH.kp * e + st.I;
              if (!(u0 >= 1 && e > 0) && !(u0 <= 0 && e < 0)) st.I += TH.ki * e;
              const raw = TH.kp * e + st.I, u = Math.max(0, Math.min(1, raw));
              st.dac = Math.round(u * 255); P = st.dac / 255;
              why = `Error = ${ctx.util.fmt(S, 1)} − ${ctx.util.fmt(Tm, 1)} = ${e >= 0 ? '+' : '−'}${ctx.util.fmt(Math.abs(e), 1)} °C. Power = 60 % per °C × error + running correction ${ctx.util.fmt(st.I * 100, 0)} % = ${Math.round(raw * 100)} %${raw > 1 ? ', capped at 100 %' : raw < 0 ? ', raised to 0 %' : ''}. So the D/A gets code <b>${st.dac}</b> (${Math.round(P * 100)} % power).`;
            }
            st.code = code; st.Tm = Tm; st.Tr = st.T; st.P = P; st.why = why;
            st.hist.push([st.t, st.T, P]);
            if (st.hist.length > N + 1) st.hist.shift();
            const loss = win ? TH.lossWin : TH.loss;
            st.T += -loss * (st.T - TH.out) + TH.gain * P;
            st.t++;
          }
          const LK = ['room', 'sen', 'ad', 'ctl', 'out', 'heat'].reduce((o, k) => { o[k] = { v: h('div', { class: 'v' }), d: h('div', { class: 'd' }) }; return o; }, {});
          const lk = (k, cls, label) => h('div', { class: 'lk ' + cls }, h('div', { class: 'k' }, label), LK[k].v, LK[k].d);
          const chain = h('div', { class: 'chain' + (ctx.narrow ? ' slim' : '') },
            lk('room', 'ok', 'Room'), lk('sen', 'io', 'Sensor'), lk('ad', 'io', 'A/D'), lk('ctl', 'cpu', 'Controller'), lk('out', 'io', 'Output'), lk('heat', 'intr', 'Heater'));
          const G = ctx.narrow ? { w: 360, h: 236, l: 40, r: 8, t: 10, strip: 34 } : { w: 680, h: 252, l: 46, r: 10, t: 10, strip: 38 };
          const svg = s('svg', { viewBox: `0 0 ${G.w} ${G.h}`, width: '100%' });
          const TMIN = 12, TMAX = 26, plotB = G.h - G.strip - 30, stripT = plotB + 10, stripB = stripT + G.strip;
          const xOf = (t, t0) => G.l + ((t - t0) / N) * (G.w - G.l - G.r);
          const yOf = (T) => G.t + (1 - (T - TMIN) / (TMAX - TMIN)) * (plotB - G.t);
          function chart() {
            const t0 = Math.max(0, st.t - N), kids = [];
            for (let T = TMIN; T <= TMAX; T += 2) {
              kids.push(s('line', { x1: G.l, x2: G.w - G.r, y1: yOf(T), y2: yOf(T), class: 's-muted', 'stroke-width': 1 }));
              kids.push(s('text', { x: G.l - 6, y: yOf(T) + 4, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, T + '°'));
            }
            kids.push(s('rect', { x: G.l, y: stripT, width: G.w - G.l - G.r, height: G.strip, class: 's-panel', 'stroke-width': 1 }));
            kids.push(s('text', { x: G.l - 6, y: stripT + G.strip / 2 + 4, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'heat'));
            const hz = st.hist.filter((p) => p[0] >= t0);
            if (hz.length) {
              const dx = (G.w - G.l - G.r) / N;
              hz.forEach((p) => { if (p[2] > 0) kids.push(s('rect', { x: xOf(p[0], t0), y: stripB - p[2] * G.strip, width: dx + 0.3, height: p[2] * G.strip, style: 'fill:var(--intr);opacity:.75' })); });
              kids.push(s('polyline', { points: hz.map((p) => `${xOf(p[0], t0)},${yOf(Math.max(TMIN, Math.min(TMAX, p[1])))}`).join(' '), style: 'fill:none;stroke:var(--io);stroke-width:3' }));
            }
            kids.push(s('line', { x1: G.l, x2: G.w - G.r, y1: yOf(S), y2: yOf(S), style: 'stroke:var(--ok);stroke-width:2', 'stroke-dasharray': '7 5' }));
            kids.push(s('text', { x: G.w - G.r - 4, y: yOf(S) - 6, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--ok)' }, 'setpoint ' + ctx.util.fmt(S, 1) + ' °C'));
            kids.push(s('text', { x: G.l, y: G.h - 4, 'font-size': 13, class: 's-sub' }, `minute ${t0}`));
            kids.push(s('text', { x: G.w - G.r, y: G.h - 4, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, `minute ${t0 + N}`));
            svg.replaceChildren(...kids);
          }
          const narr = h('div', { class: 'narr', style: { minHeight: '86px' } });
          function paint() {
            const f1 = (x) => ctx.util.fmt(x, 1);
            LK.room.v.textContent = f1(st.Tr) + ' °C'; LK.room.d.textContent = win ? 'window open' : 'true temperature';
            LK.sen.v.textContent = ctx.util.fmt(sensorV(st.Tr), 3) + ' V'; LK.sen.d.textContent = '10 mV per °C';
            LK.ad.v.textContent = 'code ' + st.code; LK.ad.d.textContent = '10-bit, 0–3.3 V';
            LK.ctl.v.textContent = f1(st.Tm) + ' °C'; LK.ctl.d.textContent = 'measured';
            LK.out.v.textContent = mode === 'onoff' ? (st.on ? 'relay ON' : 'relay OFF') : 'D/A ' + (st.dac == null ? 0 : st.dac);
            LK.out.d.textContent = mode === 'onoff' ? 'one digital pin' : '8-bit: 0–255';
            LK.heat.v.textContent = Math.round(st.P * 100) + ' %'; LK.heat.d.textContent = 'of full power';
            const cap = TH.out + TH.gain / (win ? TH.lossWin : TH.loss);
            narr.className = 'narr' + (cap < S ? ' warn' : '');
            narr.innerHTML = (st.t ? `<b>Minute ${st.t}.</b> ` + st.why : 'Press <b>▶ Run</b>: each tick the microcontroller reads the sensor once, decides, and sets the heater.')
              + (cap < S ? ` <br><b>Window open:</b> even 100 % power can only hold about ${f1(cap)} °C, below the setpoint. A loop cannot beat a too-weak actuator.` : '');
            playBtn.textContent = running ? '‖ Pause' : '▶ Run';
            chart();
          }
          const playBtn = h('button', { class: 'btn primary sm', type: 'button', style: { minWidth: '92px' }, onclick: () => { running = !running; paint(); } });
          const winBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { win = !win; winBtn.classList.toggle('on', win); winBtn.textContent = win ? 'Close the window' : 'Open a window'; paint(); } }, 'Open a window');
          const stepBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { running = false; tick(); paint(); } }, 'Step');
          const resetBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { init(); paint(); } }, '↻ Reset');
          const sp = ctx.ui.slider({ label: 'Setpoint', min: 15, max: 25, step: 0.5, value: S, format: (v) => ctx.util.fmt(v, 1) + ' °C', onInput: (v) => { S = v; paint(); } });
          const seg = ctx.ui.seg([{ value: 'onoff', label: 'On/off relay' }, { value: 'smooth', label: 'Smooth (D/A)' }], mode, (v) => { mode = v; st.I = 0; paint(); });
          init();
          ctx.every(125, () => { if (running) { tick(); paint(); } });
          el.append(h('div', { class: 'split l3 fill mw0', style: { gap: '18px' } },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: 'A thermostat is the simplest embedded control system. Once a simulated minute its microcontroller goes round the <span class="t">feedback loop</span> (read, decide, act) to hold the room at the <span class="t">setpoint</span>.' }),
              sp, h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Controller'), seg),
              h('div', { class: 'row gap-s' }, playBtn, stepBtn, winBtn, resetBtn),
              narr,
              h('div', { class: 'callout tip xs', style: { margin: 'auto 0 0', lineHeight: 1.4 }, 'data-label': 'A simple model, clearly simplified', html: `Outside stays at ${TH.out} °C. The room loses ${TH.loss * 100} % of its indoor-outdoor difference each minute (${TH.lossWin * 100} % with the window open); full heater power adds ${TH.gain} °C per minute. Real rooms are slower and messier.` })),
            h('div', { class: 'stack', style: { gap: '8px' } },
              chain, h('div', { class: 'backarrow' }, 'the heater warms the room, and the sensor measures it again ↺'),
              h('div', { class: 'card white', style: { padding: '8px 10px' } },
                h('div', { class: 'row small', style: { gap: '14px', marginBottom: '4px' } },
                  h('span', { html: '<b style="color:var(--io)">━</b> room temperature' }), h('span', { html: '<b style="color:var(--ok)">┅</b> setpoint' }), h('span', { html: '<b style="color:var(--intr)">▆</b> heater power' }), h('span', { class: 'muted xs' }, 'last 180 simulated minutes')),
                svg),
              h('div', { class: 'grid-3 small', style: { gap: '8px', lineHeight: 1.35 } },
                h('div', { class: 'card tight', html: '<b>1.</b> Let the relay run: the room swings inside a band around the setpoint.' }),
                h('div', { class: 'card tight', html: '<b>2.</b> Switch to <b>Smooth</b>: the D/A sets part power and the swings fade.' }),
                h('div', { class: 'card tight', html: '<b>3.</b> Open a window: the heater hits 100 % and still loses.' })))));
          paint();
        },
      },

      {
        title: 'Microprocessor or microcontroller? Build one',
        kind: 'compare',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const PARTS = [
            { k: 'flash', n: 'Program memory', sub: 'flash / ROM', cls: 'mem' },
            { k: 'ram', n: 'Data memory', sub: 'RAM', cls: 'mem' },
            { k: 'clk', n: 'Clock', sub: 'oscillator', cls: 'cpu' },
            { k: 'tmr', n: 'Timers', sub: 'count, alarm', cls: 'io' },
            { k: 'ser', n: 'Serial ports', sub: 'UART · SPI · I²C', cls: 'io' },
            { k: 'adc', n: 'A/D converter', sub: 'analog in', cls: 'io' },
          ];
          const on = new Set(PARTS.map((p) => p.k));
          const chipParts = h('div', { class: 'onchip' }), exts = h('div', { class: 'exts' }), bus = h('div', { class: 'bus' }, h('i'));
          const chipTag = h('span', { class: 'tag' });
          const board = h('div', { class: 'board' + (ctx.narrow ? ' slim' : '') },
            h('div', { class: 'chipx' }, chipTag, h('div', { class: 'core' }, 'Processor core'), chipParts), bus, exts);
          const verdict = h('div', { class: 'narr', style: { minHeight: '112px' } });
          const countEl = h('div', { class: 'big', style: { fontSize: '34px' } });
          const memEl = h('div', { class: 'small' });
          function part(p) {
            return h('button', { type: 'button', class: 'part ' + p.cls + ' fade-in', title: on.has(p.k) ? 'Move off the chip' : 'Move onto the processor chip', onclick: () => { if (on.has(p.k)) on.delete(p.k); else on.add(p.k); paint(); } },
              p.n, h('small', {}, p.sub));
          }
          function paint() {
            chipParts.replaceChildren(...PARTS.filter((p) => on.has(p.k)).map(part));
            const off = PARTS.filter((p) => !on.has(p.k));
            exts.replaceChildren(...(off.length ? off.map((p) => h('div', { class: 'xchip' }, part(p))) : [h('div', { class: 'small muted center', style: { gridColumn: '1 / -1' } }, 'No other chips needed: everything is inside.')]));
            bus.classList.toggle('off', !off.length);
            const n = 1 + off.length;
            countEl.textContent = n;
            chipTag.textContent = on.size === PARTS.length ? 'MICROCONTROLLER CHIP' : on.size === 0 ? 'MICROPROCESSOR CHIP' : 'PROCESSOR CHIP';
            const ramOn = on.has('ram'), flashOn = on.has('flash');
            memEl.innerHTML = (ramOn ? 'RAM on the chip: room for <b>kilobytes</b> (a few megabytes in the biggest chips).' : 'RAM in separate chips: room for <b>gigabytes</b>.') + '<br>' + (flashOn ? 'Program in on-chip flash: it starts the moment power comes on.' : 'Program in a separate memory chip (or loaded from storage).');
            let v;
            if (on.size === PARTS.length) v = ['ok', '<b>A microcontroller.</b> A whole small computer on one chip: processor, program memory, RAM, clock and I/O. One chip means low cost, little board space and little power, but memory is limited to what fits on the chip.'];
            else if (on.size === 0) v = ['', '<b>A microprocessor system.</b> The chip is only the processor. Memory, clock and every I/O function are separate chips wired across the board: room for gigabytes of memory, at the price of more chips, more space and more power.'];
            else if (!ramOn && !flashOn && on.has('clk') && on.has('tmr') && on.has('ser')) v = ['warn', '<b>In between, and very common.</b> Clock, timers and I/O on the chip; RAM and program storage outside. A phone’s <span class="t">system on a chip (SoC)</span> works like this: gigabytes of RAM in a separate chip (often stacked on top of it), software loaded from separate flash storage.'];
            else v = ['warn', `<b>In between.</b> ${on.size} of ${PARTS.length} parts are on the processor chip. Real chips sit anywhere along this line; the two ends have names: <b>microprocessor</b> (just the processor) and <b>microcontroller</b> (everything).`];
            verdict.className = 'narr ' + v[0];
            verdict.innerHTML = v[1];
          }
          const preset = (all) => { on.clear(); if (all) PARTS.forEach((p) => on.add(p.k)); paint(); };
          const TBL = `
            <table class="tbl compact">
              <tr><th></th><th>Microprocessor <span class="xs">(desktop or laptop CPU)</span></th><th>Microcontroller <span class="xs">(the Arduino Uno’s chip)</span></th></tr>
              <tr><td class="b">Speed</td><td>a few GHz</td><td>16 MHz (others: a few MHz to a few hundred)</td></tr>
              <tr><td class="b">Memory</td><td>GB of RAM, in separate chips</td><td>32 KB flash, 2 KB RAM (others: up to a few MB; the biggest car chips, over 10 MB of flash)</td></tr>
              <tr><td class="b">Price</td><td>tens to hundreds of dollars</td><td>cents to a few dollars</td></tr>
              <tr><td class="b">Power</td><td>about 10 W to over 100 W</td><td>milliwatts; microwatts asleep</td></tr>
              <tr><td class="b">Software</td><td>a general-purpose OS</td><td>no OS, or a small real-time one</td></tr>
            </table>`;
          el.append(h('div', { class: 'split l fill mw0', style: { gap: '20px' } },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'A <span class="t">microprocessor</span> is just the processor. A <span class="t">microcontroller</span> packs a whole small computer onto one chip. <b>Click any part</b> on the board to move it onto the processor chip or off it.' }),
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Jump to:'), h('button', { class: 'btn sm cpu', type: 'button', onclick: () => preset(false) }, 'Microprocessor system'), h('button', { class: 'btn sm mem', type: 'button', onclick: () => preset(true) }, 'Microcontroller')),
              verdict,
              h('div', { class: 'row nw', style: { gap: '14px', alignItems: 'center' } },
                h('div', { class: 'center', style: { flex: 'none' } }, countEl, h('div', { class: 'xs muted b' }, 'CHIPS ON THE BOARD')),
                h('div', { class: 'card white tight grow' }, memEl)),
              h('div', { class: 'callout why small', style: { margin: 'auto 0 0' }, 'data-label': 'Why it matters', html: 'With 2 KB of RAM there is no room for a desktop operating system. A microcontroller runs one program, or a tiny real-time OS, loaded from its own <span class="t">flash memory</span> as <span class="t">firmware</span>. The embedded OSs in the rest of this chapter are built to fit chips like this.' })),
            h('div', { class: 'stack', style: { gap: '12px' } }, board, h('div', { html: TBL }))));
          paint();
        },
      },

      {
        title: 'Three kinds of embedded processor',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const TIERS = [
            { n: 'Application processor', term: 'Application processor', ic: 'AP', cls: 'cpu', s: 'a full OS and many apps',
              t: 'Runs a full operating system such as Linux or Android and many apps, usually on several cores at GHz speeds with gigabytes of RAM, as the heart of a system on a chip. Its software changes often: users install apps and updates arrive.',
              ex: ['smartphone', 'tablet', 'smart TV', 'car infotainment unit', 'smartwatch'] },
            { n: 'Dedicated processor', term: 'Dedicated processor', ic: 'DP', cls: 'io', s: 'one task, or a few',
              t: 'Devoted to one task or a few fixed ones. Its program is set when the product ships and changes rarely, if ever. Usually a microcontroller, sometimes running a small real-time OS.',
              ex: ['washing machine controller', 'microwave oven', 'printer engine', 'engine control unit', 'anti-lock brakes'] },
            { n: 'Deeply embedded', term: 'Deeply embedded system', ic: 'DE', cls: 'mem', s: 'hidden, frugal, closed to its user',
              t: 'A dedicated system built on a microcontroller that its user cannot program at all, usually with no OS or only a tiny one. Many are sensors that report over a network and live on a battery for years.',
              ex: ['tire-pressure sensor', 'smoke alarm', 'node of a wireless sensor network', 'electronic shelf label'] },
          ];
          let tier = 0;
          const tierBtns = TIERS.map((T, i) => h('button', { type: 'button', class: 'tier', onclick: () => { tier = i; paintTier(); } },
            h('span', { class: 'ic box ' + T.cls, style: { padding: 0 } }, T.ic), h('span', {}, h('b', {}, T.n), h('span', { class: 's' }, T.s))));
          const tName = h('h3', { class: 'm0' }), tText = h('p', { class: 'm0', style: { fontSize: '15px', lineHeight: '1.45' } }), tEx = h('div', { class: 'row gap-s' });
          function paintTier() {
            const T = TIERS[tier];
            tierBtns.forEach((b, i) => b.classList.toggle('on', i === tier));
            tName.innerHTML = `<span class="t" data-t="${T.term}">${T.n}</span>`;
            tText.textContent = T.t;
            tEx.replaceChildren(...T.ex.map((x) => h('span', { class: 'chip ' + T.cls }, x)));
          }
          /* sensor-node battery model (typical, rounded figures) */
          const CAP = 2500, AWAKE = 20, SLEEP = 0.005;
          const PERIODS = [[1, '1 second'], [10, '10 seconds'], [60, '1 minute'], [600, '10 minutes'], [3600, '1 hour']];
          let pi = 2, awakeMs = 50, never = false;
          const lifeEl = h('div', { class: 'big', style: { fontSize: '34px' } }), avgEl = h('div', { class: 'small' }), noteEl = h('div', { class: 'small', style: { minHeight: '40px' } });
          const barW = h('i', { style: { background: 'var(--intr)' } }), barS = h('i', { style: { background: 'var(--mem)' } });
          function dur(hours) {
            if (hours < 48) return ctx.util.fmt(hours, 0) + ' hours';
            const d = hours / 24;
            if (d < 60) return ctx.util.fmt(d, 0) + ' days';
            if (d < 730) return ctx.util.fmt(d / 30.44, 0) + ' months';
            return ctx.util.fmt(d / 365.25, 1) + ' years';
          }
          function calc() {
            const per = PERIODS[pi][0], duty = never ? 1 : Math.min(1, (awakeMs / 1000) / per);
            const wake = AWAKE * duty, sleep = SLEEP * (1 - duty), avg = wake + sleep, hours = CAP / avg;
            lifeEl.textContent = dur(hours);
            avgEl.innerHTML = never
              ? `Always awake: average current <b>${AWAKE} mA</b>, so ${CAP} mAh ÷ ${AWAKE} mA = ${ctx.util.fmt(hours, 0)} hours.`
              : `Awake ${awakeMs} ms of every ${PERIODS[pi][1]} = <b>${ctx.util.fmt(duty * 100, duty < 0.001 ? 4 : 2)} %</b> of the time. Average current = ${AWAKE} mA × ${ctx.util.fmt(duty, 6)} + ${SLEEP * 1000} µA × ${ctx.util.fmt(1 - duty, 4)} ≈ <b>${ctx.util.fmt(avg * 1000, 1)} µA</b>.`;
            barW.style.width = (100 * wake / avg) + '%'; barS.style.width = (100 * sleep / avg) + '%';
            noteEl.innerHTML = hours / 24 / 365.25 > 10
              ? 'That is on paper. AA cells slowly lose charge on their own (self-discharge), which caps real life at roughly ten years.'
              : never ? 'Five days and the battery is flat. That is why deeply embedded nodes spend nearly all their time asleep.' : 'Sleep longer between reports, or wake for less time, and the battery lasts far longer.';
          }
          const sP = ctx.ui.slider({ label: 'Report every', min: 0, max: PERIODS.length - 1, step: 1, value: pi, format: (v) => PERIODS[v][1], onInput: (v) => { pi = v; calc(); } });
          const sA = ctx.ui.slider({ label: 'Awake per report', min: 10, max: 500, step: 10, value: awakeMs, format: (v) => v + ' ms', onInput: (v) => { awakeMs = v; calc(); } });
          const neverBtn = h('button', { type: 'button', class: 'btn sm', onclick: () => { never = !never; neverBtn.classList.toggle('on', never); neverBtn.textContent = never ? 'Let it sleep again' : 'Never sleep'; calc(); } }, 'Never sleep');
          el.append(h('div', { class: 'split fill mw0', style: { gap: '20px' } },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'Embedded processors range from phone-class chips that run whole operating systems to tiny, hidden controllers. Click a kind.' }),
              h('div', { class: ctx.narrow ? 'stack' : 'grid-3', style: { gap: '8px' } }, ...tierBtns),
              h('div', { class: 'card white stack grow', style: { gap: '8px', padding: '10px 14px' } }, tName, tText, tEx),
              h('div', { class: 'callout analogy small m0', 'data-label': 'One phone, both kinds', html: 'A smartphone’s application processor runs Android or iOS, while dedicated processors inside the same phone run the cellular modem, the Wi-Fi radio, the camera and the battery charger.' })),
            h('div', { class: 'card stack', style: { gap: '9px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'A sensor node on two AA cells'), neverBtn),
              h('p', { class: 'm0 small', html: `A node in a <span class="t" data-t="wireless sensor network">wireless sensor network</span> wakes, measures, radios its reading and sleeps again. Typical figures: ${AWAKE} mA awake (processor and radio on), ${SLEEP * 1000} µA asleep, ${CAP.toLocaleString('en-US')} mAh battery.` }),
              sP, sA,
              h('div', { class: 'card white stack', style: { gap: '5px', padding: '10px 14px' } },
                h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'baseline' } }, h('span', { class: 'xs muted b' }, 'BATTERY LIFE'), lifeEl),
                avgEl,
                h('div', { class: 'ebar' }, barW, barS),
                h('div', { class: 'row xs muted', style: { gap: '14px' } }, h('span', { html: '<b style="color:var(--intr)">■</b> charge spent awake' }), h('span', { html: '<b style="color:var(--mem)">■</b> charge spent asleep' }))),
              noteEl,
              h('div', { class: 'callout why small', style: { margin: 'auto 0 0' }, 'data-label': 'Why it matters', html: 'Letting the processor sleep is the most important job of a node’s software. TinyOS (section 13.4) is built around it.' }))));
          paintTier();
          calc();
        },
      },

      {
        title: 'Recap: six ideas to keep',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['What is an embedded system?', 'Computer <b>hardware and software</b>, often with mechanical parts, built for <b>one dedicated function</b>, usually inside a <b>larger product</b>. Example: a car’s anti-lock brakes.'],
              ['Name the seven ways embedded systems differ.', '<b>Size</b> · <b>cost</b> · <b>quality requirements</b> (safety, reliability, real-time, flexibility, legislation) · <b>lifetime</b> · <b>environment</b> · <b>workload</b> · <b>model of computation</b> (discrete-event to hybrid).'],
              ['Trace the feedback loop.', 'Environment → <b>sensors</b> → <b>A/D</b> → processor, memory and software → <b>D/A</b> → <b>actuators</b> → environment. Around it: human interface, diagnostic port, FPGA/ASIC, backup and safety, power and cooling.'],
              ['Microprocessor or microcontroller?', '<b>Microprocessor</b>: just the processor; memory, clock and I/O are other chips. <b>Microcontroller</b>: processor, flash, RAM, clock, timers, serial ports and A/D on <b>one cheap, frugal chip</b>.'],
              ['Application or dedicated processor?', '<b>Application processor</b>: a full OS such as Linux or Android, many apps, GHz and GB. <b>Dedicated processor</b>: one or a few fixed tasks, usually a microcontroller.'],
              ['What makes a system deeply embedded?', 'A microcontroller-based dedicated system its user <b>cannot program</b>, with <b>no OS or a tiny one</b>. Often a battery-powered networked sensor that <b>sleeps</b> almost all the time.'],
            ], { cols: ctx.narrow ? 1 : 3, height: 180 }),
            h('div', { class: 'callout tip m0', 'data-label': 'Where this leads', html: 'Section 13.2 asks what an operating system for such devices must do differently, section 13.3 shows how Linux is slimmed down for embedded use, and section 13.4 looks at TinyOS, built for the tiny sensor nodes of a wireless sensor network.' })));
        },
      },

      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Which of these is <b>not</b> an embedded system?',
            choices: ['The controller that runs a washer’s wash cycles', 'The computer that decides when airbags fire', 'A laptop that runs whatever programs you install', 'The computer in a printer that times the paper motors'],
            answer: 2,
            feedback: ['A washing-machine controller does one dedicated job inside a larger product: a classic embedded system.', 'An airbag controller is a dedicated computer inside a car, one of its many electronic control units.', null, 'The printer’s controller is built into the printer and does one job (driving the print mechanism), so it is embedded.'],
            why: 'An embedded system is dedicated to one function inside a larger product. A laptop is a general-purpose computer: its user decides what it runs.' },
          { type: 'tf', q: 'Most of the processors made each year end up in general-purpose computers such as PCs and servers.', answer: false,
            why: 'Roughly 30 billion microcontrollers ship a year against about a quarter of a billion PCs: around a hundred microcontrollers for every PC, before even counting the other embedded chips.' },
          { type: 'order', q: 'Put one pass of a thermostat’s feedback loop in order, starting with the room.',
            items: ['The room’s temperature changes', 'The sensor’s output voltage follows the temperature', 'The A/D converter turns the voltage into a number', 'The processor compares the number with the setpoint and decides', 'The output stage (a D/A converter or a relay) drives the heater', 'The heater warms the room, and the loop begins again'],
            why: 'A feedback loop runs environment → sensor → A/D → computation → D/A (or switch) → actuator → environment, over and over.' },
          { type: 'match', q: 'Match each element of an embedded system to its job.',
            pairs: [['A/D converter', 'Turns a sensor’s voltage into a number'], ['D/A converter', 'Turns a number into a voltage for an actuator'], ['Diagnostic port', 'Lets a technician read faults of the controlled system'], ['FPGA or ASIC', 'Special hardware for extra speed or reliability'], ['Electromechanical backup', 'Keeps things safe if the computer fails'], ['Auxiliary systems', 'Supply power and cooling']],
            why: 'Converters bridge the analog world and the digital computer; the diagnostic port serves technicians; special hardware, backup and auxiliary systems support the main loop.' },
          { type: 'multi', q: 'Which of these are normally found on a single microcontroller chip?',
            choices: ['A processor core', 'Flash memory that holds the program', 'Gigabytes of RAM', 'Timers and serial ports', 'A hard disk', 'An A/D converter'], answer: [0, 1, 3, 5],
            why: 'A microcontroller holds a processor, nonvolatile program memory, a little RAM (kilobytes), a clock and I/O such as timers, serial ports and A/D converters. Gigabytes of RAM and disks do not fit on such a chip.' },
          { type: 'num', q: 'A 10-bit A/D converter measures voltages from 0 to 3.3 V. How wide is each step, in millivolts? (two decimals)', answer: 3.22, tol: 0.01, unit: 'mV',
            why: 'A 10-bit converter has 2¹⁰ = 1,024 steps. 3,300 mV ÷ 1,024 ≈ 3.22 mV per step.' },
          { type: 'num', q: 'A wireless sensor node draws 20 mA while awake and 5 µA while asleep. It wakes for 100 ms every 10 seconds. What is its average current, in µA? (nearest whole number)', answer: 205, tol: 1, unit: 'µA',
            why: 'It is awake 0.1 s ÷ 10 s = 1 % of the time. Average = 20 mA × 0.01 + 0.005 mA × 0.99 = 0.2 + 0.00495 ≈ 0.205 mA = 205 µA.' },
          { q: 'Why does an embedded system have a <b>diagnostic port</b>?',
            choices: ['It lets the user install new apps on the device', 'It supplies backup power if the main supply fails', 'It turns every sensor voltage into a number for the processor', 'It reports on the controlled system too, such as engine faults'],
            answer: 3,
            feedback: ['Users of embedded systems usually cannot install apps; the port is for technicians’ tools.', 'Backup power belongs to the auxiliary systems (power supply), not the diagnostic port.', 'That is the job of the A/D converter.', null],
            why: 'A diagnostic port lets a technician’s tool read stored faults and readings about the system being controlled (a misfiring cylinder, for example), not only about the computer.' },
          { type: 'bucket', q: 'Sort each processor: application processor or dedicated processor?',
            buckets: ['Application processor', 'Dedicated processor'],
            items: [['Main chip of a smartphone running Android', 0], ['Car infotainment unit running Linux', 0], ['Tablet that runs many apps', 0], ['Microwave oven controller', 1], ['Engine control unit', 1], ['Printer engine controller', 1], ['Washing-machine controller', 1]],
            why: 'Application processors run full operating systems such as Linux or Android and many apps. Dedicated processors do one or a few fixed tasks, usually on a microcontroller.' },
          { q: 'A microcontroller differs from a microprocessor mainly because it…',
            choices: ['runs at a far higher clock speed than a desktop or laptop CPU', 'puts memory, clock and I/O on the same chip as the processor', 'can be programmed only in assembly language, never in C', 'always needs a full operating system such as Linux to run'],
            answer: 1,
            feedback: ['The reverse: microcontrollers usually run at MHz speeds, desktop CPUs at GHz.', null, 'Microcontrollers are usually programmed in C or C++ (and other languages too).', 'Many microcontrollers run no OS at all, or only a tiny real-time one.'],
            why: 'A microcontroller is a whole small computer on one chip: processor, program memory, RAM, clock and I/O. A microprocessor is just the processor, with everything else in separate chips.' },
          { q: 'Which description best fits a <b>deeply embedded</b> system?',
            choices: ['A phone chip that runs Android and the apps its owner installs', 'A desktop PC used for one program only, such as a cash register', 'A server that runs many virtual machines for different customers', 'A battery-powered sensor node that its user cannot program'],
            answer: 3,
            feedback: ['That is an application processor: it runs a full OS and user-installed apps.', 'A PC used for one job is still general-purpose hardware with a full OS; it is not deeply embedded.', 'A server is a general-purpose computer.', null],
            why: 'Deeply embedded systems are microcontroller-based, dedicated, not programmable by their users, and run no OS or a tiny one, often as networked sensors on batteries.' },
          { q: 'An engine controller must fire each spark at an exact crankshaft angle, hundreds of times a second. Which requirement does this describe most directly?',
            choices: ['Real-time behaviour', 'Low unit cost', 'Flexibility for updates', 'A long lifetime'],
            answer: 0,
            feedback: [null, 'Cost matters for engine controllers, but this sentence is about timing.', 'Flexibility is about changing the software or features, not about timing.', 'Lifetime is about how many years the system must last, not about timing.'],
            why: 'A result that is right but late is wrong here: at 6,000 rpm the crankshaft turns 36° every millisecond, so the spark must fire on time. That is a real-time requirement.' },
        ],
      },
    ],
    notes: `
      <h3>Embedded systems: the computers you never see</h3>
      <p>An <b>embedded system</b> is a combination of computer hardware and software, often with mechanical or other parts, designed to perform <b>one dedicated function</b>, usually as part of a <b>larger product</b>. Example: a car’s anti-lock brakes (ABS). A wheel-speed sensor reports each wheel’s speed, a controller (microcontroller plus program) spots a wheel about to lock, and a hydraulic unit (valves, pump) releases and reapplies its brake pressure many times a second. Embedded processors far outnumber the rest: roughly 30 billion microcontrollers ship a year against about 0.26 billion PCs (30 ÷ 0.26 ≈ 115 per PC) and 1.2 billion phones. A <b>general-purpose computer</b> (laptop, server) runs whatever its user installs, so it is <i>not</i> embedded, though it contains embedded controllers.</p>
      <p><b>Application areas:</b> consumer electronics (TVs, cameras, game consoles); household appliances (washers, microwave ovens, thermostats); automotive (engine control, ABS, airbags, tire-pressure sensors; a typical new car has dozens of ECUs, some high-end models over 100); industrial control (robot arms, process control); medical devices (pacemakers, infusion pumps); office automation (printers, copiers); aerospace and defense (flight control, satellites).</p>

      <h4>Seven ways embedded systems differ</h4>
      <ol>
        <li><b>Size</b>: one tiny chip to a large networked system.</li>
        <li><b>Cost</b>: cents matter for mass products, much less for one-off systems.</li>
        <li><b>Quality requirements</b>, relaxed to very strict and usually combined: <b>safety</b>, <b>reliability</b>, <b>real-time</b>, <b>flexibility</b> (updates), <b>legislation</b> (laws, certification).</li>
        <li><b>Lifetime</b>: two or three years to decades.</li>
        <li><b>Environment</b>: mild indoors to heat, cold, vibration, humidity, radiation.</li>
        <li><b>Workload</b> (application characteristics): static or changing load, slow or fast, compute- or interface-intensive.</li>
        <li><b>Model of computation</b>: <b>discrete-event</b> (separate events) to <b>hybrid</b> (continuous change mixed with events).</li>
      </ol>
      <p>A fitness band is tiny, cost-driven, short-lived and event-driven; a pacemaker is safety-critical, regulated and long-lived; an engine controller is cost-driven yet real-time, harsh-environment and hybrid; a Mars rover is large, extremely reliable, radiation-exposed and updatable from Earth. Often one requirement <b>dominates</b>: safety (infusion pump, level-crossing gate), cost (greeting card, $10 toy), power (buried soil sensor, wildlife collar) or real-time timing (spark timing: at 6,000 rpm the crankshaft turns 36° per millisecond; a drone stabiliser).</p>

      <h4>Elements of an embedded system (car engine controller in brackets)</h4>
      <ul>
        <li><b>Sensors</b> measure the world, usually as a voltage (crankshaft position, air flow, coolant temperature).</li>
        <li><b>A/D converter</b> turns a voltage into a number. 10 bits = 1,024 steps; over 0–3.3 V each step is 3,300 ÷ 1,024 ≈ 3.22 mV.</li>
        <li><b>Processor, memory, software</b>: usually a microcontroller; flash/ROM holds the program and tables, RAM the changing data; the firmware has one job (fuel and spark timing).</li>
        <li><b>D/A converter</b> turns a number into a voltage for an actuator; many actuators are instead switched by timed digital outputs (injector pulses).</li>
        <li><b>Actuators</b> act on the world: motors, valves, heaters, relays (injectors, ignition coils, throttle).</li>
        <li><b>Human interface</b>: lights, buttons, small display (check-engine light).</li>
        <li><b>Diagnostic port</b>: a technician’s tool reads faults of the <i>controlled system</i>, not just the computer (OBD-II socket, required on US cars since the 1996 model year).</li>
        <li><b>Special-purpose hardware</b>: FPGA (reconfigurable logic), ASIC (custom chip) or nondigital circuits, for speed or reliability (a pulse-timing unit).</li>
        <li><b>Electromechanical backup and safety</b> keeps things safe if the computer fails (springs pull the throttle to a “limp-home” position).</li>
        <li><b>Auxiliary systems</b>: power supply and cooling (12 V regulated to steady low voltages).</li>
      </ul>
      <p>The <b>feedback loop</b>: environment → sensors → A/D → computation → D/A → actuators → environment → sensors again.</p>

      <h4>The thermostat lab (a simple model)</h4>
      <p>Outside 5 °C; each minute the room loses 1 % of its indoor-outdoor difference (2.5 % with a window open); full heater power adds 0.25 °C. Sensor: 0.5 V + 10 mV per °C, read by a 10-bit A/D over 0–3.3 V. Example: 21 °C → 0.710 V → 0.710 ÷ 3.3 × 1,024 ≈ 220.3 → code 220 → 20.90 °C (one step ≈ 0.32 °C). <b>On/off</b>: a digital pin drives a relay, on below setpoint − 0.5 °C, off above setpoint + 0.5 °C, unchanged in between, so the room swings in a band. <b>Smooth</b>: an 8-bit D/A (0–255) sets power = 60 % per °C × error + a running correction, limited to 0–100 %. With the window open, 100 % power holds only 5 + 0.25 ÷ 0.025 = 15 °C: no program beats a too-weak actuator.</p>

      <h4>Microprocessor versus microcontroller</h4>
      <p>A <b>microprocessor</b> is a processor on one chip; memory, clock and I/O are separate chips. A <b>microcontroller</b> puts processor, nonvolatile program memory (flash/ROM), RAM, clock and I/O (timers, serial ports, A/D) on one chip: slow (MHz to a few hundred MHz), small (KB to a few MB; the biggest car chips hold over 10 MB of flash), cheap (cents to dollars), frugal (milliwatts, microwatts asleep). Arduino Uno’s chip: 16 MHz, 32 KB flash, 2 KB RAM; a desktop CPU: GHz, gigabytes of separate RAM, tens of watts or more. A phone’s system on a chip sits in between.</p>

      <h4>Application, dedicated and deeply embedded</h4>
      <p><b>Application processors</b> run a full OS such as Linux or Android and many apps (phones, tablets, infotainment). <b>Dedicated processors</b> do one or a few fixed tasks (washer, microwave, printer engine, engine control); one phone holds both kinds. A <b>deeply embedded system</b> is microcontroller-based, dedicated, not programmable by its user, with no OS or a tiny one, often a battery-powered node of a <b>wireless sensor network</b>.</p>
      <p><b>Battery life.</b> 20 mA awake, 5 µA asleep, 2,500 mAh. Awake 50 ms per minute: fraction 0.05 ÷ 60 ≈ 0.00083; average ≈ 20 × 0.00083 + 0.005 ≈ 0.0217 mA; life ≈ 2,500 ÷ 0.0217 ≈ 115,000 h ≈ 13.2 years on paper (self-discharge caps it near ten). Never sleeping: 2,500 ÷ 20 = 125 h, about 5 days. Awake 100 ms every 10 s (1 %): 0.2 + 0.00495 ≈ 0.205 mA = 205 µA.</p>`,
  });
})();
