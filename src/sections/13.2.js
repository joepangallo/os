/* =====================================================================
   Section 13.2 — Characteristics of Embedded Operating Systems
   When a device needs no OS, a small RTOS or an adapted general OS; the six
   traits that set an embedded OS apart (real-time and reactive operation,
   configurability, I/O device flexibility, streamlined protection, direct
   use of interrupts); adapting an existing OS versus a purpose-built one;
   and what a purpose-built real-time OS typically provides.
   Every size, latency and verdict on screen is computed by the code that
   draws it, so the words always match the pictures.
   ===================================================================== */
(() => {
  /* The six traits, in the order the section teaches them.
     [name, glossary term, colour class, general-purpose OS, embedded OS, example] */
  const TRAITS = [
    ['Real-time operation', 'real-time operation', 'intr',
      'Aims for good <b>average</b> speed and fairness. A slow answer is merely slow.',
      'A result is correct only if it arrives <b>on time</b>. The deadlines come from the physical thing being controlled, and many are hard.',
      'An engine controller must fire each spark plug at the right moment in the crankshaft’s turn; a perfect calculation that arrives late misfires.'],
    ['Reactive operation', 'reactive operation', 'io',
      'Mostly runs programs that a user started, and waits for that user.',
      'Exists to <b>respond to events</b> from the outside world, which arrive whenever they like. Designers plan for the worst moment, so the worst-case response time must be bounded.',
      'A crash sensor can fire while the airbag controller is busy logging data. The design must still meet the deadline in that worst case.'],
    ['Configurability', 'configurability', 'os',
      'One large build is shipped to everyone, with almost everything included.',
      'One OS must suit very different devices, so it is <b>built to order</b>: modules chosen at build time, conditional compilation, or object-oriented components.',
      'A door sensor’s build leaves out the file system, networking and display code completely, so it fits in 32 KB.'],
    ['I/O device flexibility', 'I/O device flexibility', 'mem',
      'Knows a fixed set of device classes (disks, displays, keyboards, network cards); drivers plug into kernel subsystems.',
      'Devices vary too much for any fixed set, so the OS treats device handling as <b>special tasks</b> that can be added or swapped per device.',
      'A 3D printer adds one task that drives its stepper motors. The kernel itself does not change.'],
    ['Streamlined protection', 'streamlined protection', 'proc',
      'Treats every program as untrusted: I/O instructions are privileged and every process lives behind memory walls.',
      'The software is fixed, tested and trusted, so protection is <b>kept light</b>: tasks may use I/O instructions directly, and memory protection may be minimal or absent.',
      'A sensor task reads the temperature converter’s register itself, with one instruction and no system call.'],
    ['Direct use of interrupts', 'direct use of interrupts', 'cpu',
      'User processes never touch interrupts. Only the kernel handles them and then, perhaps, wakes a process.',
      'Tasks may <b>attach their own handlers</b> to interrupts or be woken by them directly, skipping the trip through general kernel layers.',
      'A motor controller’s own handler runs the instant the shaft encoder pulses.'],
  ];

  /* ENGINE-BEGIN ------------------------------------------------------
     Interrupt-response model for step 4 (illustrative microseconds).
     dev/qa-13.2/engine.test.cjs extracts this block and checks the numbers. */
  const SPAN = 2000;
  const KERNELS = [
    { key: 'gp', name: 'General-purpose kernel', short: 'General kernel',
      off: [[300, 540], [850, 870], [1200, 1280], [1650, 1665]], entry: 4,
      layers: [['kernel driver', 10, 's-os'], ['wake + switch', 30, 's-proc']] },
    { key: 'rt', name: 'Purpose-built RTOS', short: 'RTOS',
      off: [[120, 124], [410, 416], [700, 703], [960, 965], [1240, 1244], [1530, 1536], [1810, 1813]], entry: 1,
      layers: [] },
  ];
  /* respond(k, t): an interrupt raised at time t on kernel k. If t falls inside an interrupts-off
     window [a, b), the processor cannot notice it until b. Then the hardware and kernel need k.entry
     to save state and reach a handler (interrupt latency = wait + entry). Every extra layer between
     that handler and the application's code adds its own time. */
  function respond(k, t) {
    const w = k.off.find(([a, b]) => t >= a && t < b);
    const wait = w ? w[1] - t : 0;
    const latency = wait + k.entry;
    const extra = k.layers.reduce((s, l) => s + l[1], 0);
    return { t, win: w || null, wait, latency, total: latency + extra };
  }
  /* stats(k): every whole-microsecond arrival time 0 .. SPAN-1, equally likely */
  function stats(k) {
    let sumL = 0, sumT = 0, worst = null, hit = 0;
    for (let t = 0; t < SPAN; t++) {
      const r = respond(k, t);
      sumL += r.latency; sumT += r.total; if (r.wait) hit++;
      if (!worst || r.total > worst.total) worst = r;
    }
    return { avgLatency: sumL / SPAN, avgTotal: sumT / SPAN, worst, hitShare: hit / SPAN };
  }
  /* ENGINE-END */
  /* the worked example in the notes quotes these, so the notes always match the step 4 lab */
  const longestOff = (k) => Math.max(...k.off.map(([a, b]) => b - a));
  const NOTE_G = stats(KERNELS[0]), NOTE_R = stats(KERNELS[1]);

  Guide.section({
    id: '13.2',
    title: 'Characteristics of Embedded Operating Systems',
    short: 'Embedded OS traits',
    summary: 'Six traits that set embedded OSs apart, and the choice between adapting Linux and a purpose-built RTOS.',
    objectives: [
      'Explain when a device needs no operating system, a small real-time OS, or an adapted general-purpose OS.',
      'Name and explain the six characteristics that set embedded operating systems apart from general-purpose ones.',
      'Show how build-time configuration keeps an OS image small, and how short interrupts-off intervals keep interrupt latency low.',
      'Compare adapting an existing OS such as Linux with using a purpose-built embedded OS, and choose between them for a device.',
      'List the typical features of a purpose-built real-time OS and name some real examples.',
    ],
    terms: [
      ['Embedded operating system', 'An operating system built to run inside a device that has one dedicated job, such as a router, a pump or a car controller. It gives up general-purpose features in exchange for small size, predictable timing and easy trimming.'],
      ['Bare-metal program (super loop)', 'Software for a simple device that runs with no operating system at all: one endless loop that reads inputs, computes and drives outputs, helped by a few interrupt handlers.'],
      ['Real-time operating system (RTOS)', 'An operating system whose services take a known, bounded amount of time, so that the designer can guarantee that tasks meet their deadlines.'],
      ['Microcontroller', 'A single chip holding a processor, flash memory for the program, RAM for data, a clock and I/O hardware such as timers and converters. Cheap and frugal with power, with kilobytes rather than gigabytes of memory.'],
      ['Memory footprint', 'How much memory a piece of software occupies on the device: flash (or ROM) for its code and constants, RAM for its changing data.'],
      ['Real-time operation', 'An embedded-OS trait: a result counts as correct only if it is delivered on time, because the deadlines are set by the physical system being controlled.'],
      ['Reactive operation', 'An embedded-OS trait: the software exists to respond to events from the outside world that can arrive at any moment, so its worst-case response time must be bounded and planned for.'],
      ['Configurability', 'An embedded-OS trait: the OS can easily be built to contain only the functions one device needs, by choosing modules at build time, by conditional compilation, or with object-oriented components.'],
      ['Conditional compilation', 'Telling the compiler to include or skip blocks of source code depending on configuration settings (for example with #if in C), so an unneeded feature never becomes part of the program at all.'],
      ['I/O device flexibility', 'An embedded-OS trait: because devices vary so widely, the OS does not build fixed device support into its kernel; device handling is done by special tasks that can be added or swapped for each device.'],
      ['Streamlined protection', 'An embedded-OS trait: because the software is fixed, tested and trusted, protection is kept light. Tasks may run I/O instructions themselves, and memory protection may be minimal or absent.'],
      ['Direct use of interrupts', 'An embedded-OS trait: application tasks may attach their own handlers to interrupts or be woken by them directly, instead of every interrupt being handled only deep inside the kernel.'],
      ['Interrupt latency', 'The time from the moment a device raises an interrupt to the moment the first instruction of its handler runs. Long stretches with interrupts disabled make the worst case long.'],
      ['Memory protection unit (MPU)', 'Simple protection hardware found on many microcontrollers. It marks a handful of memory regions as readable, writable or executable for the running task, but does not translate addresses the way an MMU does.'],
      ['Purpose-built embedded OS', 'An operating system designed from the start for embedded and real-time use, rather than cut down from a general-purpose OS.'],
      ['PREEMPT_RT', 'A set of Linux kernel changes that make almost all kernel code preemptible and run most interrupt handling in schedulable threads, so latency stays bounded. Kept outside the main kernel for many years, it was merged into mainline Linux in version 6.12 (2024).'],
      ['Memory pool (fixed-size partition)', 'Memory set aside in advance and cut into equal-size blocks. Taking or returning a block takes the same short time every time, and the pool has no external fragmentation (a request smaller than a block still wastes the rest of that block).'],
      ['Memory locking', 'Pinning a task’s code and data in main memory so they are never paged or swapped out, which removes page-fault delays from time-critical code.'],
      ['Timeout', 'A limit on how long a task will wait for something, such as a semaphore, a message or a device. When the time is up the wait ends with an error code instead of lasting forever.'],
    ],

    css: `
      .sec-13-2 svg { display: block; }
      .sec-13-2 svg .gl { stroke: var(--line); stroke-width: 1; }
      .sec-13-2 svg .ax { font-size: 13px; fill: var(--muted); }
      .sec-13-2 svg .lbl { font-size: 14px; font-weight: 800; }
      .sec-13-2 svg .bl { font-size: 13px; font-weight: 800; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
      .sec-13-2 .msg { border-radius: 10px; padding: 8px 12px; background: var(--panel-2); border: 1px solid var(--line); font-size: 15px; line-height: 1.45; }
      .sec-13-2 .msg.ok { border-color: var(--ok); background: var(--ok-bg); }
      .sec-13-2 .msg.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-13-2 .msg.warn { border-color: var(--warn); background: var(--warn-bg); }
      .sec-13-2 .msg.info { border-color: var(--accent); background: var(--accent-bg); }
      .sec-13-2 .num { font-variant-numeric: tabular-nums; }
      .sec-13-2 .grid-2 > *, .sec-13-2 .grid-3 > * { min-width: 0; }
    `,

    steps: [
      /* ---------------- 1. Big picture: how much OS does a device need? ---------------- */
      {
        title: 'One job, a tight budget: why embedded OSs differ',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          /* [button label, glossary term or null, colour, devices, low KB, high KB, explanation, hardware] */
          const LEVELS = [
            ['No OS at all', 'bare-metal program', 'mem', ['electric toothbrush', 'TV remote', 'kitchen timer'], 1, 32,
              'One job and one loop: read the buttons, drive the motor, sleep until the next interrupt. There is nothing to share or schedule, so an OS would only add size.',
              'A tiny microcontroller with a few KB of memory.'],
            ['Small real-time OS', 'real-time operating system', 'intr', ['drone flight controller', 'insulin pump', 'washing machine'], 16, 1024,
              'Several jobs with deadlines share one processor: read sensors, run a control loop, talk over a radio. A kernel of a few KB gives them tasks, priorities, timers and queues.',
              'A microcontroller with tens to hundreds of KB of memory.'],
            ['Adapted general OS', null, 'os', ['Wi-Fi router', 'smart TV', 'car dashboard screen'], 4096, 1048576,
              'Networking, file systems, a graphical screen, perhaps downloadable apps. Here it pays to start from a general-purpose OS such as Linux and trim it down.',
              'A faster processor with an MMU and megabytes to gigabytes of memory.'],
            ['Desktop OS', null, 'cpu', ['laptop', 'desktop PC'], 10485760, 67108864,
              'Runs whatever its users install and whatever device they plug in. Everything is included, because nobody knows in advance what will be needed.',
              'Gigabytes of memory and tens of gigabytes of storage.'],
          ];
          const W = ctx.narrow ? 340 : 600, LW = ctx.narrow ? 112 : 160, x0 = LW + 4, x1 = W - 12;
          const DEC = 8; /* 1 KB .. 100 GB is 8 decades of kilobytes */
          const X = (kb) => x0 + (Math.log10(kb) / DEC) * (x1 - x0);
          const RH = 40, top = 8, H = top + LEVELS.length * RH + 34;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Typical software size for each kind of device, on a logarithmic scale from 1 KB to 100 GB' });
          const detail = h('div', { class: 'card white stack', style: { gap: '6px', padding: '10px 14px' } });
          const btns = LEVELS.map((L, i) => h('button', { class: 'btn sm ' + L[2], type: 'button', onclick: () => pick(i) }, L[0]));
          let sel = 1;
          function draw() {
            svg.replaceChildren();
            [[1, '1 KB'], [1024, '1 MB'], [1048576, '1 GB'], [104857600, '100 GB']].forEach(([kb, lab]) => {
              svg.append(s('line', { x1: X(kb), x2: X(kb), y1: top - 4, y2: top + LEVELS.length * RH, class: 'gl' }));
              if (!(ctx.narrow && kb === 104857600)) svg.append(s('text', { x: X(kb), y: top + LEVELS.length * RH + 16, class: 'ax', 'text-anchor': kb === 1 ? 'start' : kb === 104857600 ? 'end' : 'middle' }, lab));
            });
            LEVELS.forEach((L, i) => {
              const y = top + i * RH, on = i === sel;
              svg.append(s('text', { x: 0, y: y + 25, class: 'lbl', style: on ? 'fill:var(--accent)' : 'fill:var(--ink-2);font-weight:600' }, (on ? '▸ ' : '') + L[0]));
              svg.append(s('rect', { x: X(L[4]), y: y + 8, width: Math.max(6, X(L[5]) - X(L[4])), height: RH - 16, rx: 5, class: 's-' + L[2], 'stroke-width': on ? 3 : 1, style: on ? '' : 'opacity:.45' }));
            });
            svg.append(s('text', { x: x1, y: H - 2, class: 'ax', 'text-anchor': 'end' }, 'software size, log scale (illustrative)'));
          }
          function pick(i) {
            sel = i;
            btns.forEach((b, j) => b.classList.toggle('on', j === i));
            const L = LEVELS[i];
            detail.replaceChildren(
              h('div', { class: 'row', style: { gap: '6px' } }, h('b', { style: { fontSize: '17px' }, html: L[1] ? `<span class="t" data-t="${L[1]}">${L[0]}</span>` : L[0] }), ...L[3].map((d) => h('span', { class: 'chip ' + L[2] }, d))),
              h('p', { class: 'm0', style: { fontSize: '15.5px' } }, L[6]),
              h('p', { class: 'small muted m0' }, h('b', {}, 'Hardware: '), L[7]));
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');
            draw();
          }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'lead m0', html: 'A toothbrush, a car’s brake controller and a Wi-Fi router all contain a computer. The OS on your laptop would be the wrong choice for almost all of them.' }),
              h('p', { class: 'm0', html: 'An <span class="t">embedded operating system</span> runs inside a device built for one dedicated job. It gives up what a desktop takes for granted (many users, strong walls between programs, support for any gadget) and gets what the device needs: a small <span class="t">memory footprint</span>, predictable timing, and easy trimming.' }),
              h('p', { class: 'm0', html: 'The simplest devices skip the OS entirely and run a <span class="t">bare-metal program (super loop)</span>. Once several jobs with deadlines share a <span class="t">microcontroller</span>, a small <span class="t">RTOS</span> starts to pay for itself.' }),
              h('div', { class: 'callout analogy small m0', 'data-label': 'Analogy', html: 'A desktop OS is a department store: it stocks everything, because it cannot know what each customer wants. An embedded OS is a food truck: it carries exactly what its one menu needs, and it serves fast.' })),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'card stack grow', style: { gap: '10px' } },
                h('h4', { class: 'm0' }, 'How much OS does a device need? Click a level.'),
                h('div', { class: 'row gap-s' }, ...btns),
                svg, detail),
              h('div', { class: 'row gap-s small' }, h('b', {}, 'In this section:'), h('span', { class: 'chip os' }, 'build an OS image to fit'), h('span', { class: 'chip intr' }, 'race an interrupt'), h('span', { class: 'chip proc' }, 'break the walls'), h('span', { class: 'chip io' }, 'adapt or build?')))));
          pick(sel);
        },
      },

      /* ---------------- 2. The six traits, and a matching game ---------------- */
      {
        title: 'Six traits that set an embedded OS apart',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const WHY = [
            'The software is part of a physical control loop. Physics does not wait: a late command is a wrong command.',
            'Nobody schedules a crash, a button press or a radio packet. The OS cannot choose when work arrives, only how fast it answers.',
            'Memory and energy cost money in each of millions of units. Code that is not there takes no space, uses no power and cannot fail.',
            'No kernel team could build in every sensor, motor and radio ever made. A task is easy to add without touching the kernel.',
            'Checks cost time, hardware and power. When the same tested code ships in every unit and users cannot add programs, the walls buy less.',
            'Every layer between the interrupt and the code that cares adds delay. Going direct gives the fastest possible response.',
          ];
          const WHERE = ['Step 4 here, and §10.2 Real-time scheduling', 'Step 4: race an interrupt', 'Step 3: build an image to fit', 'Step 5: devices as tasks', 'Step 5: break the walls', 'Step 4: race an interrupt'];
          /* [scenario, trait index, why] shown in a fixed shuffled order */
          const GAME = [
            ['The same kernel ships in a smartwatch and in a factory robot. The watch’s build leaves the motor-control and factory-network code out completely.', 2, 'Only the functions this device needs are built in: the OS is configured per product.'],
            ['A sensor task reads the temperature converter’s register with one ordinary instruction: no system call, no privilege check.', 4, 'A desktop OS would make I/O instructions privileged. Here the task is trusted, so it may do I/O itself.'],
            ['An engine controller computes the perfect moment to fire a spark plug, but the answer arrives after the piston has passed that point. The engine misfires.', 0, 'The value was right but late, so it was wrong: correctness depends on when the result is delivered.'],
            ['A drone’s balance loop must send new motor commands every millisecond. A command a few milliseconds late can flip the drone.', 0, 'A periodic deadline set by physics: being on time is part of being correct.'],
            ['A new lidar sensor is supported by adding one high-priority task that talks to it. The kernel’s own code is not touched.', 3, 'Device handling is a task that can be added per device, not a fixed kernel subsystem.'],
            ['A build setting compiles the file system out of the image for a sensor that never stores anything, saving 28 KB of flash.', 2, 'Conditional compilation is one of the standard ways to configure an embedded OS.'],
            ['A crash sensor may fire at any instant, even while the airbag controller is busy saving diagnostic data. The design must still meet the deadline at that worst moment.', 1, 'The software responds to outside events that arrive unpredictably, so the worst case must be bounded and planned for.'],
            ['When the shaft encoder pulses, a handler written by the application team runs immediately, without first passing through a general kernel driver layer.', 5, 'The application uses the interrupt directly, which a desktop OS would never allow a user process to do.'],
            ['A fridge controller’s tasks can all read and write every byte of memory, because one team wrote and tested all of the code together.', 4, 'Memory protection is minimal because the software is fixed and trusted.'],
          ];
          let sel = 0, g = 0, firstTry = 0, tried = false, done = false;
          const list = h('div', { class: 'stack', style: { gap: '6px' } });
          const btns = TRAITS.map((T, i) => h('button', { class: 'btn', type: 'button', style: { justifyContent: 'flex-start', height: '40px' }, onclick: () => { tabs.show(0); pick(i); }, html: `<span class="chip ${T[2]}">${i + 1}</span> ${T[0]}` }));
          list.append(...btns);
          const compare = h('div', { class: 'stack', style: { gap: '10px' } });
          function pick(i) {
            sel = i;
            btns.forEach((b, j) => b.classList.toggle('on', j === i));
            const T = TRAITS[i];
            compare.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },
                h('b', { style: { fontSize: '19px' }, html: `<span class="t" data-t="${T[1]}">${T[0]}</span>` }),
                h('span', { class: 'chip ' + T[2] }, `trait ${i + 1} of 6`)),
              h('div', { class: 'grid-2', style: { gap: '10px' } },
                h('div', { class: 'card tight' }, h('h4', { class: 'm0' }, 'General-purpose OS'), h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: T[3] })),
                h('div', { class: 'card tight ' + T[2] }, h('h4', { class: 'm0' }, 'Embedded OS'), h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: T[4] }))),
              h('div', { class: 'card white tight' }, h('h4', { class: 'm0' }, 'Example'), h('p', { class: 'm0', style: { fontSize: '15.5px' } }, T[5])),
              h('div', { class: 'callout why m0', 'data-label': 'Why embedded OSs do this', style: { fontSize: '15.5px' } }, WHY[i]),
              h('p', { class: 'small muted m0' }, h('b', {}, 'Try it: '), WHERE[i]));
            compare.classList.remove('fade-in'); void compare.offsetWidth; compare.classList.add('fade-in');
          }
          const game = h('div', { class: 'stack', style: { gap: '10px' } });
          function drawGame(answer) {
            game.replaceChildren();
            if (done) {
              game.append(h('div', { class: 'msg ok' }, h('b', {}, `Finished: ${firstTry} of ${GAME.length} right on the first try. `), 'Every scenario leans on one trait, though real devices show all six at once.'),
                h('button', { class: 'btn primary', type: 'button', onclick: () => { g = 0; firstTry = 0; tried = false; done = false; drawGame(null); } }, 'Play again'));
              return;
            }
            const [txt, ans, why] = GAME[g];
            game.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, `Scenario ${g + 1} of ${GAME.length}`), h('span', { class: 'chip ok' }, `first-try score ${firstTry}`)),
              h('div', { class: 'card white', style: { fontSize: '16px' } }, txt),
              h('p', { class: 'small muted m0' }, 'Which trait does it show most clearly?'),
              h('div', { class: 'grid-3', style: { gap: '6px' } }, ...TRAITS.map((T, i) => h('button', {
                class: 'btn sm' + (answer === i ? (i === ans ? ' on' : ' danger') : ''), type: 'button', style: { whiteSpace: 'normal', height: 'auto', minHeight: '34px', lineHeight: '1.2', padding: '4px 8px' },
                onclick: () => { if (answer === ans) return; if (!tried && i === ans) firstTry++; tried = true; drawGame(i); } }, T[0]))));
            if (answer == null) return;
            const right = answer === ans;
            game.append(h('div', { class: 'msg ' + (right ? 'ok' : 'bad') }, h('b', {}, right ? '✓ Yes: ' + TRAITS[ans][0] + '. ' : '✗ Not quite. '), right ? why : 'Look again: what is this scenario really about? Try another trait.'));
            if (right) game.append(h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { g++; tried = false; if (g >= GAME.length) done = true; drawGame(null); } }, g + 1 < GAME.length ? 'Next scenario ▶' : 'See my score')));
          }
          const tabs = ctx.ui.tabs([
            { label: 'Desktop vs embedded', render: (p) => { p.append(compare); } },
            { label: 'Spot the trait (game)', render: (p) => { p.append(game); } },
          ]);
          pick(0); drawGame(null);
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'Embedded OSs differ from desktop ones in six recurring ways. Click each to compare.' }),
              list,
              h('div', { class: 'callout tip small m0', 'data-label': 'Tip' }, 'Then open the game tab and match nine short scenarios to the trait each one shows.'),
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Treating the six as laws. They are tendencies: QNX, for example, keeps full memory protection, and safety-critical or internet-connected devices increasingly add protection back.' })),
            h('div', { class: 'card white stack' }, tabs)));
        },
      },

      /* ---------------- 3. Configurability: build only what the device needs ---------------- */
      {
        title: 'Configurability: build only what the device needs',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          /* illustrative module sizes: [key, button label, flash KB, RAM KB, config name, what it does, svg class] */
          const MODS = [
            ['core', 'Kernel core', 6, 1, 'CONFIG_KERNEL_CORE', 'interrupts, clock tick, start-up', 's-os', 'core'],
            ['tasks', 'Multitasking scheduler', 4, 3, 'CONFIG_MULTITASKING', 'several tasks with priorities', 's-proc', 'tasks'],
            ['timers', 'Timers and delays', 2, 1, 'CONFIG_TIMERS', 'wake on schedule, time out waits', 's-cpu', 'timers'],
            ['ipc', 'Queues and semaphores', 3, 1, 'CONFIG_QUEUES', 'tasks pass data and signals', 's-thread', 'queues'],
            ['radio', 'Low-power radio link', 14, 4, 'CONFIG_RADIO', 'short packets to a hub or remote', 's-io', 'radio'],
            ['net', 'TCP/IP and Wi-Fi', 110, 48, 'CONFIG_NET', 'talk to the internet', 's-io', 'TCP/IP + Wi-Fi'],
            ['fs', 'Flash file system', 28, 6, 'CONFIG_FLASH_FS', 'files that survive power-off', 's-mem', 'file system'],
            ['gui', 'Touch-screen GUI', 140, 64, 'CONFIG_GUI', 'draw a user interface', 's-accent', 'GUI'],
            ['mpu', 'MPU protection', 6, 2, 'CONFIG_MPU', 'wall tasks off from each other', 's-intr', 'MPU'],
            ['shell', 'Debug shell + logging', 16, 4, 'CONFIG_SHELL', 'type commands, record events', 's-warn', 'shell'],
          ];
          const M = Object.fromEntries(MODS.map((m) => [m[0], m]));
          /* devices: [label, flash budget KB, RAM budget KB, description, {needed module: reason}] */
          const DEVS = [
            ['Door sensor', 32, 8, 'Lives for years on a coin cell. Wakes when the door opens or every 10 minutes, sends one radio packet, sleeps. One job at a time.',
              { timers: 'it must wake every 10 minutes', radio: 'it must send its packet' }],
            ['Smart thermostat', 512, 160, 'Touch screen, Wi-Fi to a phone app, a weekly schedule kept in flash, and separate tasks (screen, network, heating) passing messages.',
              { tasks: 'screen, network and heating run as separate tasks', timers: 'the schedule needs alarms', ipc: 'its tasks pass messages', net: 'the phone app reaches it over Wi-Fi', fs: 'the schedule must survive a power cut', gui: 'it has a touch screen' }],
            ['Drone flight controller', 128, 32, 'Separate tasks for sensors, motors (every millisecond) and the pilot’s radio pass messages. Flight control must be walled off.',
              { tasks: 'sensors, control and radio run as separate tasks', timers: 'the control loop runs every millisecond', ipc: 'tasks pass readings and commands', radio: 'it must hear the pilot', mpu: 'flight control must be walled off' }],
          ];
          let dev = 0;
          let on = new Set(MODS.map((m) => m[0]));
          const mbtns = MODS.map((m) => h('button', {
            class: 'btn sm', type: 'button', disabled: m[0] === 'core' ? true : null, style: { justifyContent: 'space-between', width: '100%' },
            onclick: () => { if (on.has(m[0])) on.delete(m[0]); else on.add(m[0]); update(); },
            html: `<span>${m[0] === 'core' ? m[1] + ' (always)' : m[1]}</span><span class="xs muted num">${m[2]} KB</span>` }));
          const desc = h('p', { class: 'small m0' });
          const W = ctx.narrow ? 340 : 600;
          const bar = s('svg', { viewBox: `0 0 ${W} 74`, width: '100%', style: { flex: 'none' }, role: 'img', 'aria-label': 'Flash used by each included module, against the device’s flash budget' });
          const ramRow = h('div', { class: 'row nw small', style: { gap: '8px' } });
          const verdict = h('div', { class: 'msg', style: { minHeight: '64px' } });
          const cfgBox = h('div', {});
          function update() {
            const D = DEVS[dev], need = Object.keys(D[4]);
            const inc = MODS.filter((m) => on.has(m[0]));
            const flash = inc.reduce((a, m) => a + m[2], 0), ram = inc.reduce((a, m) => a + m[3], 0);
            mbtns.forEach((b, i) => { b.classList.toggle('on', on.has(MODS[i][0])); b.setAttribute('aria-pressed', String(on.has(MODS[i][0]))); });
            desc.innerHTML = `<b>${D[0]}</b> · flash ${D[1]} KB · RAM ${D[2]} KB. ${D[3]}`;
            /* stacked flash bar, scaled so both the budget and the image fit */
            const full = Math.max(flash, D[1]), x0 = 2, x1 = W - 2, X = (kb) => x0 + (kb / full) * (x1 - x0);
            bar.replaceChildren(s('text', { x: 0, y: 14, class: 'lbl' }, `Flash: ${flash} KB used of ${D[1]} KB`));
            let at = 0;
            inc.forEach((m) => {
              const a = X(at), b = X(at + m[2]);
              bar.append(s('rect', { x: a, y: 22, width: Math.max(1, b - a), height: 28, class: m[6], 'stroke-width': 1 }));
              const lab = m[7];
              if (b - a > lab.length * 8 + 6) bar.append(s('text', { x: (a + b) / 2, y: 36, class: 'bl' }, lab));
              at += m[2];
            });
            const bx = X(D[1]);
            bar.append(s('line', { x1: bx, x2: bx, y1: 18, y2: 56, style: `stroke:var(${flash > D[1] ? '--bad' : '--ok'});stroke-width:3` }),
              s('text', { x: bx > W - 70 ? W - 2 : bx < 70 ? 2 : bx, y: 70, class: 'ax', 'text-anchor': bx > W - 70 ? 'end' : bx < 70 ? 'start' : 'middle', style: `font-weight:800;fill:var(${flash > D[1] ? '--bad' : '--ok'})` }, `budget ${D[1]} KB`));
            const rp = Math.min(1, ram / D[2]);
            ramRow.replaceChildren(h('b', { style: { width: ctx.narrow ? '118px' : '150px', flex: 'none' } }, `RAM: ${ram} of ${D[2]} KB`),
              h('div', { class: 'meter grow', style: { height: '14px' } }, h('i', { style: { width: rp * 100 + '%', background: ram > D[2] ? 'var(--bad)' : 'var(--ok)' } })),
              h('span', { class: 'chip ' + (ram > D[2] ? 'bad' : 'ok'), style: { flex: 'none' } }, ram > D[2] ? `over by ${ram - D[2]} KB` : 'fits'));
            const missing = need.filter((k) => !on.has(k));
            const extra = inc.filter((m) => m[0] !== 'core' && !need.includes(m[0]));
            const over = flash > D[1] || ram > D[2];
            const names = (list) => list.map((m) => `<b>${m[1]}</b>`).join(', ');
            if (missing.length) {
              verdict.className = 'msg bad';
              verdict.innerHTML = `✗ <b>This build cannot do the job.</b> Missing ${missing.map((k) => `<b>${M[k][1]}</b> (${D[4][k]})`).join('; ')}.` + (over ? ' It is also too big for the chip.' : '');
            } else if (over) {
              verdict.className = 'msg bad';
              verdict.innerHTML = `✗ <b>Does not fit.</b> ${flash > D[1] ? `Flash is over by ${flash - D[1]} KB` : ''}${flash > D[1] && ram > D[2] ? ' and ' : ''}${ram > D[2] ? `RAM is over by ${ram - D[2]} KB` : ''}. Remove what this device never uses: ${names(extra)}.`;
            } else if (extra.length) {
              const xf = extra.reduce((a, m) => a + m[2], 0), xr = extra.reduce((a, m) => a + m[3], 0);
              verdict.className = 'msg warn';
              verdict.innerHTML = `It works and fits, but carries <b>dead weight</b>: ${names(extra)} (${xf} KB of flash, ${xr} KB of RAM) that this device never uses. Every extra module is more code to test and more to go wrong.`;
            } else {
              verdict.className = 'msg ok';
              verdict.innerHTML = `✓ <b>A minimal build:</b> everything the ${D[0].toLowerCase()} needs and nothing else. Flash ${flash} of ${D[1]} KB, RAM ${ram} of ${D[2]} KB.`;
            }
            const pad = (t, n) => t + ' '.repeat(Math.max(1, n - t.length));
            const src = MODS.map((m) => pad(`${m[4]}=${on.has(m[0]) ? 'y' : 'n'}`, ctx.narrow ? 22 : 23) + `# ${on.has(m[0]) ? 'built in' : 'left out'}` + (ctx.narrow ? '' : `: ${m[5]}`)).join('\n');
            const code = ctx.ui.code(src, { lang: 'c', fontSize: 13 });
            code.mark(MODS.map((m, i) => (on.has(m[0]) ? i + 1 : 0)).filter(Boolean), 'ok');
            code.mark(MODS.map((m, i) => (on.has(m[0]) ? 0 : i + 1)).filter(Boolean), 'dim');
            cfgBox.replaceChildren(code);
          }
          const devSeg = ctx.ui.seg(DEVS.map((d, i) => ({ value: i, label: d[0] })), dev, (v) => { dev = v; update(); });
          const snippet = ctx.ui.code(ctx.narrow ? `#if CONFIG_NET  // networking chosen?
  net_start();  // start TCP/IP
#endif          // else: never compiled` : `#if CONFIG_NET    // only if networking was chosen:
  net_start();    // start the TCP/IP stack
#endif            // otherwise the compiler skips it`, { lang: 'plain', fontSize: ctx.narrow ? 12.5 : 13 });
          update();
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? null : 'minmax(0, 470px) minmax(0, 1fr)' } },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: '<span class="t">Configurability</span>: one embedded OS must suit very different devices, so you build each image to order. It starts with <b>everything</b> in. Pick a device and trim.' }),
              devSeg, desc,
              h('div', { class: 'grid-2', style: { gap: '6px' } }, ...mbtns),
              h('div', { class: 'row gap-s' },
                h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { on = new Set(MODS.map((m) => m[0])); update(); } }, 'Include everything'),
                h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { on = new Set(['core']); update(); } }, 'Kernel core only'),
                h('span', { class: 'xs muted' }, 'Sizes are illustrative.')),
              h('p', { class: 'small m0', html: 'How does <code>=n</code> remove code? By <span class="t">conditional compilation</span>:' }),
              snippet),
            h('div', { class: 'card white stack', style: { gap: '8px' } },
              bar, ramRow, verdict,
              h('h4', { class: 'm0' }, 'The build configuration this produces'),
              cfgBox)));
        },
      },

      /* ---------------- 4. Reactive, real-time, direct interrupts: race an interrupt ---------------- */
      {
        title: 'An interrupt arrives: how soon does your code run?',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const [GP, RT] = KERNELS, SG = stats(GP), SR = stats(RT);
          const W = ctx.narrow ? 360 : 640, x0 = 4, x1 = W - 6, X = (us) => x0 + (us / SPAN) * (x1 - x0);
          const lanes = s('svg', { viewBox: `0 0 ${W} 190`, width: '100%', style: { flex: 'none' }, role: 'img', 'aria-label': 'Two timelines with interrupts-off stretches and the response to one interrupt' });
          const zoom = s('svg', { viewBox: `0 0 ${W} 112`, width: '100%', style: { flex: 'none' }, role: 'img', 'aria-label': 'Close-up of the response time to this interrupt on each kernel' });
          const narr = h('div', { class: 'msg', style: { minHeight: '120px' } });
          const tbody = h('tbody');
          const rng = ctx.util.seeded(13);
          let t = 420;
          const fmt1 = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1));
          function lane(k, r, y0) {
            const tot = r.total;
            lanes.append(s('text', { x: x0, y: y0 - 8, class: 'lbl' }, ctx.narrow ? k.short : k.name),
              s('text', { x: x1, y: y0 - 8, 'text-anchor': 'end', style: `font-size:13.5px;font-weight:800;fill:var(${tot > 10 ? '--bad' : '--ok'})` }, ctx.narrow ? `code runs at +${tot} µs` : `your code runs after ${tot} µs`),
              s('rect', { x: x0, y: y0, width: x1 - x0, height: 24, rx: 4, style: 'fill:var(--panel-3);stroke:var(--line)' }));
            k.off.forEach(([a, b]) => lanes.append(s('rect', { x: X(a), y: y0, width: Math.max(2.5, X(b) - X(a)), height: 24, style: 'fill:color-mix(in srgb, var(--bad) 40%, transparent);stroke:var(--bad);stroke-width:1' })));
            /* response bar under the track */
            let at = t;
            const seg = (len, cls) => { if (len <= 0) return; lanes.append(s('rect', { x: X(at), y: y0 + 30, width: Math.max(2.5, X(at + len) - X(at)), height: 12, class: cls, 'stroke-width': 1 })); at += len; };
            seg(r.wait, 's-bad'); seg(k.entry, 's-warn'); k.layers.forEach((l) => seg(l[1], l[2]));
            lanes.append(s('path', { d: `M${X(t) - 6},${y0 - 3} L${X(t) + 6},${y0 - 3} L${X(t)},${y0 + 7} Z`, style: 'fill:var(--intr)' }),
              s('line', { x1: X(t + tot) + 1.5, x2: X(t + tot) + 1.5, y1: y0 + 26, y2: y0 + 46, style: 'stroke:var(--ok);stroke-width:3' }));
          }
          function drawZoom(g, r) {
            const LW = ctx.narrow ? 104 : 128, zx0 = LW, zx1 = W - (ctx.narrow ? 46 : 70), MAX = 300, Z = (us) => zx0 + (Math.min(us, MAX) / MAX) * (zx1 - zx0);
            zoom.replaceChildren(s('text', { x: 0, y: 13, class: 'ax', style: 'font-weight:700' }, 'Close-up of this interrupt (0–300 µs)'));
            [0, 100, 200, 300].forEach((v) => zoom.append(s('line', { x1: Z(v), x2: Z(v), y1: 20, y2: 84, class: 'gl' }), s('text', { x: Z(v), y: 98, class: 'ax', 'text-anchor': 'middle' }, v + (v === 300 ? ' µs' : ''))));
            zoom.append(s('line', { x1: Z(10), x2: Z(10), y1: 18, y2: 86, style: 'stroke:var(--ok);stroke-width:2;stroke-dasharray:4 3' }), s('text', { x: Z(10) + 4, y: 110, class: 'ax', style: 'fill:var(--ok);font-weight:700' }, '10 µs'));
            [[GP, g, 26], [RT, r, 56]].forEach(([k, res, y]) => {
              zoom.append(s('text', { x: 0, y: y + 15, class: 'lbl', style: 'font-size:13.5px' }, k.short));
              let at = 0;
              const parts = [['wait', res.wait, 's-bad'], ['entry', k.entry, 's-warn'], ...k.layers.map((l) => [l[0], l[1], l[2]])];
              parts.forEach(([lab, len, cls]) => {
                if (len <= 0) return;
                const a = Z(at), b = Z(at + len);
                zoom.append(s('rect', { x: a, y, width: Math.max(2.5, b - a), height: 22, class: cls, 'stroke-width': 1 }));
                if (b - a > lab.length * 7.6 + 6) zoom.append(s('text', { x: (a + b) / 2, y: y + 11, class: 'bl' }, lab));
                at += len;
              });
              zoom.append(s('text', { x: Math.max(Z(at), Z(10)) + 6, y: y + 16, style: `font-size:13.5px;font-weight:800;fill:var(${res.total > 10 ? '--bad' : '--ok'})` }, res.total + ' µs'));
            });
          }
          function draw() {
            const g = respond(GP, t), r = respond(RT, t);
            lanes.replaceChildren();
            const step = ctx.narrow ? 500 : 250;
            for (let v = 0; v <= SPAN; v += step) lanes.append(s('line', { x1: X(v), x2: X(v), y1: 18, y2: 160, class: 'gl' }), s('text', { x: X(v), y: 182, class: 'ax', 'text-anchor': v === 0 ? 'start' : v === SPAN ? 'end' : 'middle' }, v + (v === SPAN ? ' µs' : '')));
            lane(GP, g, 26); lane(RT, r, 104);
            drawZoom(g, r);
            const lenG = g.win ? g.win[1] - g.win[0] : 0;
            narr.className = 'msg ' + (g.wait ? 'bad' : 'info');
            narr.innerHTML = (g.win
              ? `At <b>${t} µs</b> the general kernel is inside a <b>${lenG} µs</b> stretch with interrupts disabled, so the device waits <b>${g.wait} µs</b> before the processor even notices. `
              : `At <b>${t} µs</b> the general kernel happens to have interrupts enabled, so it notices at once. `)
              + `Entering the handler takes ${GP.entry} µs, the kernel driver ${GP.layers[0][1]} µs, and waking your process and switching to it ${GP.layers[1][1]} µs: your code starts after <b>${g.total} µs</b>. `
              + (r.win ? `The RTOS is in one of its tiny ${r.win[1] - r.win[0]} µs stretches, waits ${r.wait} µs, then ` : 'The RTOS notices at once and ')
              + `jumps in ${RT.entry} µs straight to your own handler: <b>${r.total} µs</b>.`;
            tbody.replaceChildren(...[[GP, g, SG], [RT, r, SR]].map(([k, res, st]) => h('tr', {},
              h('td', { class: 'b', style: { whiteSpace: 'nowrap' } }, ctx.narrow ? k.short.split(' ')[0] : k.short),
              ctx.narrow ? null : h('td', { class: 'num' }, res.latency + ' µs'),
              h('td', { class: 'num b', style: { whiteSpace: 'nowrap' } }, res.total + ' µs'),
              h('td', { class: 'num', style: { whiteSpace: 'nowrap' } }, fmt1(st.avgTotal) + ' µs'),
              h('td', { class: 'num b', style: { whiteSpace: 'nowrap', color: st.worst.total > 10 ? 'var(--bad)' : 'var(--ok)' } }, st.worst.total + ' µs'))));
          }
          const slider = ctx.ui.slider({ label: 'Interrupt arrives at', min: 0, max: SPAN - 5, step: 5, value: t, format: (v) => v + ' µs', onInput: (v) => { t = v; draw(); } });
          const go = (v) => { t = v; slider.set(v); draw(); };
          draw();
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? null : 'minmax(0, 440px) minmax(0, 1fr)' } },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'A sensor raises an <span class="t">interrupt</span>. Two things decide how soon the code that cares can react: how long interrupts may stay <span class="t" data-t="disabled interrupts">disabled</span>, and how many layers stand between the interrupt and that code.' }),
              slider,
              h('div', { class: 'row gap-s' },
                h('button', { class: 'btn sm', type: 'button', onclick: () => go(Math.floor(rng() * (SPAN / 5)) * 5) }, 'Random moment'),
                h('button', { class: 'btn sm danger', type: 'button', onclick: () => go(SG.worst.t) }, 'Worst moment for the general kernel')),
              narr,
              h('div', { class: 'callout why small m0', 'data-label': 'Why only the worst case counts', html: `<span class="t">Reactive operation</span>: you cannot choose when the interrupt comes. Averaged over every moment the general kernel looks fine (${fmt1(SG.avgTotal)} µs), but a deadline must also hold at the worst moment (${SG.worst.total} µs). An RTOS keeps every interrupts-off stretch tiny; a typical design target is an <span class="t">interrupt latency</span> under 10 µs.` })),
            h('div', { class: 'card white stack', style: { gap: '6px' } },
              lanes, zoom,
              h('div', { class: 'row gap-s xs' }, h('span', { class: 'chip bad' }, 'waiting: interrupts off'), h('span', { class: 'chip warn' }, 'entry'), h('span', { class: 'chip os' }, 'kernel driver'), h('span', { class: 'chip proc' }, 'wake + switch'), h('span', { class: 'chip ok' }, '| your code starts')),
              h('table', { class: 'tbl compact', style: { fontSize: '14px' } },
                h('thead', {}, h('tr', {}, ...(ctx.narrow ? ['', 'Code starts', 'Average', 'Worst'] : ['', 'Interrupt latency', 'Your code starts', 'Average', 'Worst case']).map((x) => h('th', {}, x)))),
                tbody),
              h('p', { class: 'xs muted m0' }, 'Illustrative times. Average and worst case cover every possible arrival moment.'))));
        },
      },

      /* ---------------- 5. Streamlined protection and devices as tasks ---------------- */
      {
        title: 'Thin walls: protection and devices',
        kind: 'compare',
        render(el, ctx) {
          const { h, s } = ctx;
          const MODES = [{ value: 'gp', label: 'Desktop OS' }, { value: 'emb', label: 'Embedded' }, { value: 'mpu', label: 'Embedded + MPU' }];
          const ACTS = [['io', 'Read the temperature sensor'], ['own', 'Write to its own buffer'], ['stray', 'Bug: a stray write into the motor task'], ['dev', 'Add support for a new lidar sensor']];
          /* [verdict class, headline, explanation, chips] for every mode and action */
          const OUT = {
            gp: {
              io: ['warn', 'A system call is required', 'In user mode the task may not touch the device: I/O instructions are <span class="t" data-t="privileged instruction">privileged</span>, and the device registers are not mapped into its address space. So it asks the kernel: the processor enters kernel mode, the driver checks the request and reads the register, then returns. Safe, but every reading pays for two mode switches and the driver.', ['2 mode switches', 'driver checks', 'safe']],
              own: ['ok', 'Allowed', 'The MMU translates the address to a page this process owns and lets the write through.', ['address translated', 'allowed']],
              stray: ['ok', 'Caught: protection fault', 'The motor task lives in a different address space. The stray address is not mapped for the sensor process, so the MMU raises a fault, the OS stops the buggy sensor process, and the motor keeps turning at 1200 rpm.', ['fault', 'bug contained']],
              dev: ['warn', 'A new kernel driver', 'Device support lives inside the kernel: someone writes a driver to the kernel’s driver interface, and it runs with full kernel privileges. A device that fits none of the kernel’s device classes means extra work.', ['kernel code', 'privileged']],
            },
            emb: {
              io: ['ok', 'A direct read', 'The task reads the sensor’s register itself, with one ordinary load instruction: no system call, no mode switch, no driver layer. Allowed because this code was written and tested together with everything else on the device.', ['1 instruction', 'fastest', 'trust required']],
              own: ['ok', 'Allowed', 'A plain store to memory. Nothing is checked, and nothing needs to be.', ['1 instruction', 'allowed']],
              stray: ['bad', 'Silent corruption', 'Nothing checks the address. The store lands on the motor task’s setpoint: 1200 rpm becomes 51966 rpm (0xCAFE). No error appears; the motor simply misbehaves, far from the line that caused it. This is the price of thin walls, and why such code is tested so hard.', ['no fault', 'motor corrupted', 'hard to debug']],
              dev: ['ok', 'One more device task', 'Add a task that owns the lidar’s registers and passes readings to the others through queues. The kernel does not change at all: device handling is just another task, often a high-priority one. That is <span class="t">I/O device flexibility</span>.', ['kernel unchanged', 'one more task']],
            },
            mpu: {
              io: ['ok', 'A direct read inside its region', 'The build grants this task an MPU region that covers the sensor’s registers, so the read is still one instruction. The MPU checks every access in hardware and adds no instructions.', ['1 instruction', 'checked in hardware']],
              own: ['ok', 'Allowed', 'The buffer lies inside the task’s own MPU region, so the store goes through.', ['1 instruction', 'allowed']],
              stray: ['ok', 'Caught by the MPU', 'The address is outside every region granted to the sensor task, so the MPU raises a fault. The kernel stops or restarts the sensor task; the motor’s setpoint is untouched.', ['MPU fault', 'bug contained']],
              dev: ['ok', 'A device task with its own region', 'As before, the lidar gets its own task, and the build grants that task, and only that task, an MPU region over the lidar’s registers.', ['kernel unchanged', 'one more task']],
            },
          };
          const N = ctx.narrow;
          const W = N ? 360 : 600, H = N ? 400 : 322;
          const R = (x, y, w, hh) => ({ x, y, w, h: hh, cx: x + w / 2, cy: y + hh / 2 });
          const L = N ? {
            K: R(6, 6, 348, 60), Kd: R(236, 20, 110, 36), Kl: R(118, 20, 110, 36),
            S: R(6, 94, 168, 140), Sc: R(16, 120, 148, 40), Sb: R(16, 176, 148, 40),
            M: R(186, 94, 168, 140), Mc: R(196, 120, 148, 40), Ms: R(196, 176, 148, 40),
            D: R(6, 262, 348, 72), Dt: R(14, 288, 106, 38), Dm: R(127, 288, 106, 38), Dl: R(240, 288, 106, 38),
            Lt: R(186, 350, 168, 40), modeY: 80,
            io: { gp: [['M140 120 L140 76 L236 40', 'call'], ['M291 56 L291 76 L180 76 L180 248 L100 248 L100 287', 'reg']], direct: [['M100 216 L100 287', 'reg']] },
            own: 'M90 160 L90 175', stray: { full: 'M90 216 L90 248 L270 248 L270 217', blocked: 'M90 216 L90 240', x: [90, 252] },
            dev: { gp: 'M173 56 L180 80 L180 248 L293 248 L293 287', task: 'M270 350 L293 327' },
          } : {
            K: R(10, 8, 580, 64), Kd: R(440, 24, 130, 36), Kl: R(300, 24, 130, 36),
            S: R(10, 104, 180, 150), Sc: R(22, 132, 156, 40), Sb: R(22, 186, 156, 40),
            M: R(210, 104, 180, 150), Mc: R(222, 132, 156, 40), Ms: R(222, 186, 156, 40),
            D: R(410, 104, 180, 206), Dt: R(422, 132, 156, 40), Dm: R(422, 186, 156, 40), Dl: R(422, 240, 156, 40),
            Lt: R(210, 268, 180, 44), modeY: 88,
            io: { gp: [['M150 132 L150 80 L440 42', 'call'], ['M560 60 L560 131', 'reg']], direct: [['M150 132 L150 92 L560 92 L560 131', 'reg']] },
            own: 'M100 172 L100 185', stray: { full: 'M100 226 L100 264 L300 264 L300 227', blocked: 'M100 226 L100 256', x: [100, 270] },
            dev: { gp: 'M365 60 L365 80 L400 80 L400 260 L421 260', task: 'M390 290 L400 290 L400 260 L421 260' },
          };
          let mode = 'emb', act = 'io';
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: { flex: 'none' }, role: 'img', 'aria-label': 'Memory map with the kernel, two tasks and the device registers, showing what one access does' });
          const out = h('div', { class: 'msg', style: { minHeight: '150px' } });
          const legend = h('p', { class: 'xs muted m0' });
          const box = (r, cls, label, opt = {}) => {
            const g = s('g', {});
            g.append(s('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 8, class: cls, style: opt.style || '', 'stroke-width': opt.sw || 1.5 }));
            if (label) g.append(s('text', { x: opt.center ? r.cx : r.x + 8, y: opt.center ? r.cy + 1 : r.y + 17, class: opt.center ? 'bl' : 'lbl', style: (opt.center ? '' : 'font-size:13.5px;') + (opt.tstyle || '') }, label));
            svg.append(g);
          };
          const path = (d, cls, marker) => svg.append(s('path', { d, style: `fill:none;stroke:var(--${cls});stroke-width:2.5`, 'marker-end': marker ? `url(#arr-${cls})` : null }));
          function draw() {
            svg.replaceChildren();
            const [vcls, head, text, chips] = OUT[mode][act];
            const wall = mode === 'gp' ? 'stroke:var(--ink-2);stroke-width:4' : 'stroke-dasharray:5 4';
            box(L.K, 's-os', mode === 'gp' ? 'Kernel (kernel mode)' : 'Kernel');
            if (!N) svg.append(s('text', { x: L.K.x + 8, y: L.K.y + 42, class: 'ax' }, 'scheduler · timers · queues'));
            if (mode === 'gp') {
              box(L.Kd, 's-panel', 'temp driver', { center: true });
              svg.append(s('line', { x1: 6, x2: W - 6, y1: L.modeY, y2: L.modeY, style: 'stroke:var(--os);stroke-width:1.5;stroke-dasharray:6 4' }));
              if (!N) svg.append(s('text', { x: W - 8, y: L.modeY - 4, 'text-anchor': 'end', class: 'ax', style: 'fill:var(--os);font-weight:700' }, '▲ kernel mode · user mode ▼'));
            }
            if (mode === 'gp' && act === 'dev') box(L.Kl, 's-accent', 'lidar driver', { center: true, sw: 2.5 });
            box(L.S, 's-proc', 'Sensor task', { style: mode === 'mpu' ? 'stroke:var(--ok);stroke-width:4' : wall });
            box(L.Sc, 's-panel', 'code', { center: true }); box(L.Sb, 's-panel', 'buffer', { center: true });
            box(L.M, 's-proc', 'Motor task', { style: mode === 'gp' ? wall : 'stroke-dasharray:5 4' });
            box(L.Mc, 's-panel', 'code', { center: true });
            const broken = mode === 'emb' && act === 'stray';
            box(L.Ms, broken ? 's-bad' : 's-panel', broken ? 'setpoint 51966 rpm!' : 'setpoint 1200 rpm', { center: true, tstyle: broken ? 'fill:var(--bad)' : '' });
            box(L.D, 's-io', N ? 'Devices' : 'Device registers');
            box(L.Dt, 's-panel', 'temp sensor', { center: true, style: mode === 'mpu' ? 'stroke:var(--ok);stroke-width:3' : '' });
            box(L.Dm, 's-panel', 'motor driver', { center: true });
            if (act === 'dev') {
              box(L.Dl, 's-accent', 'lidar', { center: true, sw: 2.5 });
              if (mode !== 'gp') box(L.Lt, 's-accent', 'Lidar task', { center: true, sw: 2.5 });
            }
            /* the access itself */
            if (act === 'io') (mode === 'gp' ? L.io.gp : L.io.direct).forEach(([d]) => path(d, mode === 'gp' ? 'os' : 'ok', true));
            if (act === 'own') path(L.own, 'ok', true);
            if (act === 'stray') {
              if (mode === 'emb') path(L.stray.full, 'bad', true);
              else { path(L.stray.blocked, 'bad', false); svg.append(s('text', { x: L.stray.x[0], y: L.stray.blocked.endsWith('240') ? 254 : 274, 'text-anchor': 'middle', style: 'font-size:22px;font-weight:900;fill:var(--bad)' }, '✗'), s('text', { x: L.stray.x[0] + 16, y: N ? 252 : 272, class: 'ax', style: 'fill:var(--bad);font-weight:800' }, mode === 'gp' ? 'MMU fault' : 'MPU fault')); }
            }
            if (act === 'dev') path(mode === 'gp' ? L.dev.gp : L.dev.task, 'accent', true);
            out.className = 'msg ' + vcls;
            out.replaceChildren(h('b', { style: { fontSize: '16.5px' } }, (vcls === 'bad' ? '✗ ' : vcls === 'ok' ? '✓ ' : '') + head), h('p', { class: 'm0', style: { marginTop: '4px', fontSize: '15px' }, html: text }),
              h('div', { class: 'row gap-s', style: { marginTop: '6px' } }, ...chips.map((c) => h('span', { class: 'chip ' + vcls }, c))));
            legend.innerHTML = mode === 'gp' ? 'Thick borders: separate address spaces enforced by the MMU. Dashed violet line: the user/kernel mode boundary.'
              : mode === 'emb' ? 'Dashed borders: no walls. Every task can read and write every address, including device registers.'
              : 'Green borders: the regions the MPU grants the sensor task while it runs. Everything else is off-limits to it.';
            actBtns.forEach((b, i) => b.classList.toggle('on', ACTS[i][0] === act));
          }
          const actBtns = ACTS.map(([k, lab]) => h('button', { class: 'btn' + (k === 'stray' ? ' danger' : ''), type: 'button', style: { justifyContent: 'flex-start', width: '100%' }, onclick: () => { act = k; draw(); } }, lab));
          const seg = ctx.ui.seg(MODES, mode, (v) => { mode = v; draw(); });
          draw();
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: N ? null : 'minmax(0, 470px) minmax(0, 1fr)' } },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'A desktop OS assumes programs may be buggy or hostile. An embedded device ships one fixed, tested set of tasks, so its OS can use <span class="t">streamlined protection</span>. Pick a protection level, then make the sensor task act.' }),
              seg,
              h('div', { class: 'stack', style: { gap: '6px' } }, ...actBtns),
              out),
            h('div', { class: 'card white stack', style: { gap: '8px' } },
              svg, legend,
              h('div', { class: 'callout tip small m0', 'data-label': 'The middle way', html: 'Many microcontrollers have no MMU, but some have a <span class="t">memory protection unit (MPU)</span>: a few protected regions, checked in hardware, with no address translation. FreeRTOS and Zephyr, for example, can use one.' }))));
        },
      },

      /* ---------------- 6. Two roads: adapt an existing OS or use a purpose-built one ---------------- */
      {
        title: 'Two roads: adapt a general OS, or build for the job',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const CHOICES = ['Adapt a general OS', 'Purpose-built RTOS', 'Both, on two processors'];
          /* [scenario, best choice, why] */
          const CASES = [
            ['A car dashboard screen with maps, music apps, Bluetooth phone pairing and a web browser, on a processor with 4 GB of RAM.', 0, 'Rich features and existing apps matter most, and memory is plentiful. Adapting Linux (or Android, which is built on Linux) brings all of that ready-made.'],
            ['An insulin pump on a microcontroller with 256 KB of flash and 64 KB of RAM. It must react to a sensor reading within 1 ms and run for a week on a small battery.', 1, 'Tiny memory, a hard deadline and a battery: a small purpose-built kernel fits where a general OS could not even start.'],
            ['A home Wi-Fi router with many network protocols, a firewall and a web admin page, on 128 MB of RAM.', 0, 'Linux already has mature networking and firewall code, and the router has the memory to run it. Many home routers do exactly this.'],
            ['An engine-control unit that must fire each spark plug at an exact crankshaft angle. At 6000 rpm the crankshaft turns one degree every 28 µs.', 1, 'Deadlines measured in microseconds, with a bounded worst case, are exactly what a purpose-built RTOS is designed for.'],
            ['A delivery robot: motor control every 100 µs, plus camera navigation, Wi-Fi and a touch screen.', 2, 'The two halves want different things. A common design runs an RTOS on a microcontroller for the motors and Linux on a bigger processor for vision and networking.'],
            ['A wireless soil sensor that must run for five years on a coin cell, with 32 KB of RAM.', 1, 'Energy and memory are both tiny. A purpose-built kernel, or no OS at all, is the realistic choice.'],
            ['A smart TV that must run streaming apps written by other companies.', 0, 'Other companies’ apps need a full, familiar platform (often Android TV or another Linux-based OS), and the timing needs are soft.'],
          ];
          let k = 0, pickd = null, score = 0, finished = false;
          const game = h('div', { class: 'stack', style: { gap: '8px' } });
          function draw() {
            game.replaceChildren();
            if (finished) {
              game.append(h('div', { class: 'msg ok' }, h('b', {}, `Done: ${score} of ${CASES.length} best fits. `), 'The pattern: big, feature-rich devices with soft timing adapt a general OS; small, battery-powered or hard-deadline devices use a purpose-built one; some devices use both.'),
                h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { k = 0; pickd = null; score = 0; finished = false; draw(); } }, 'Start again')));
              return;
            }
            const [txt, ans, why] = CASES[k];
            game.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, `Device ${k + 1} of ${CASES.length}: which road?`), h('span', { class: 'chip ok' }, `score ${score}`)),
              h('div', { class: 'card white tight', style: { fontSize: '16px' } }, txt),
              h('div', { class: 'grid-3', style: { gap: '6px' } }, ...CHOICES.map((c, i) => h('button', {
                class: 'btn' + (pickd == null ? '' : i === ans ? ' on' : i === pickd ? ' danger' : ''), type: 'button', disabled: pickd != null && i !== ans && i !== pickd ? true : null,
                onclick: () => { if (pickd != null) return; pickd = i; if (i === ans) score++; draw(); } }, c))));
            if (pickd == null) return;
            game.append(h('div', { class: 'msg ' + (pickd === ans ? 'ok' : 'bad') }, h('b', {}, pickd === ans ? '✓ Best fit. ' : `✗ Better: ${CHOICES[ans]}. `), why),
              h('div', { class: 'row' }, h('button', { class: 'btn primary sm', type: 'button', onclick: () => { k++; pickd = null; if (k >= CASES.length) finished = true; draw(); } }, k + 1 < CASES.length ? 'Next device ▶' : 'See my score')));
          }
          draw();
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('p', { class: 'm0', html: 'There are two ways to get an <span class="t">embedded operating system</span>: reshape one that already exists, or use one designed for the job from the start.' }),
            h('div', { class: 'grid-2', style: { gap: '12px' } },
              h('div', { class: 'card os tight small' },
                h('b', { style: { fontSize: '16.5px' } }, 'Road 1 · Adapt an existing OS (usually Linux)'),
                h('ul', { class: 'm0', style: { marginTop: '4px' }, html: '<li><b>Add real-time capability</b>: for Linux, the <span class="t">PREEMPT_RT</span> changes, part of the main kernel since version 6.12 (2024).</li><li><b>Streamline</b>: strip drivers and features the device lacks.</li><li><b>Add functions</b> embedded devices need: flash file systems, fast boot, watchdogs.</li>' }),
                h('p', { class: 'm0', html: '<b style="color:var(--ok)">✓</b> Familiar interface; a huge stock of drivers, libraries and tools; developers already know it.' }),
                h('p', { class: 'm0', html: '<b style="color:var(--bad)">✗</b> Not designed for real-time or tiny devices: the worst case is harder to bound, and it is larger, needing more memory, processor power and energy.' })),
              h('div', { class: 'card proc tight small' },
                h('b', { style: { fontSize: '16.5px', display: 'block' }, html: 'Road 2 · A <span class="t">purpose-built embedded OS</span>' }),
                h('p', { class: 'm0', style: { marginTop: '4px' } }, 'Designed from its first line for small, real-time devices: FreeRTOS, Zephyr, VxWorks, QNX, ThreadX, eCos and others.'),
                h('p', { class: 'm0', html: '<b style="color:var(--ok)">✓</b> Small and fast, with predictable task switches and interrupt response; runs on a microcontroller with kilobytes of memory.' }),
                h('p', { class: 'm0', html: '<b style="color:var(--bad)">✗</b> Fewer ready-made drivers and applications, its own interface to learn, and features such as networking or a GUI come as add-on components.' }),
                h('p', { class: 'm0 muted' }, 'Its typical features (next step): fast task switches, real-time scheduling, a small footprint, quick interrupt response, memory pools and locking, timing services.'))),
            h('div', { class: 'card grow' }, game)));
        },
      },

      /* ---------------- 7. What a purpose-built RTOS typically provides ---------------- */
      {
        title: 'Inside a purpose-built real-time OS',
        kind: 'learn',
        render(el, ctx) {
          const { h } = ctx;
          const bars = (rows) => h('div', { class: 'stack', style: { gap: '6px' } }, ...rows.map(([lab, parts]) => h('div', { class: 'stack', style: { gap: '2px' } },
            h('span', { class: 'small b' }, lab),
            h('div', { class: 'row nw', style: { gap: '3px' } }, ...parts.map(([p, w, c]) => h('span', { class: 'chip ' + c, style: { width: w + '%', justifyContent: 'center', borderRadius: '6px', flex: 'none' } }, p))))));
          /* memory pool demo: 8 equal blocks; a stack of free block numbers makes take and return one step each */
          let pool = [], freeList = [7, 6, 5, 4, 3, 2, 1, 0], poolMsg = 'Eight 64-byte blocks were set aside at start-up. Take some, then click a used block to return it.';
          const poolBox = h('div', { class: 'stack', style: { gap: '8px' } });
          function drawPool() {
            poolBox.replaceChildren(
              h('div', { class: 'row gap-s' }, ...Array.from({ length: 8 }, (_, i) => {
                const used = pool.includes(i);
                return h('button', { class: 'btn sm ' + (used ? 'on' : ''), type: 'button', style: { width: '52px' }, 'aria-label': `block ${i}, ${used ? 'in use' : 'free'}`,
                  onclick: () => { if (!used) return; pool = pool.filter((b) => b !== i); freeList.push(i); poolMsg = `Returned block ${i}: pushed back on the free list in one step.`; drawPool(); } }, used ? '■ ' + i : '□ ' + i);
              })),
              h('div', { class: 'row gap-s' },
                h('button', { class: 'btn sm primary', type: 'button', onclick: () => { if (!freeList.length) { poolMsg = 'Pool empty: the request fails at once (or waits with a timeout) instead of searching.'; } else { const b = freeList.pop(); pool.push(b); poolMsg = `Took block ${b} from the top of the free list in one step, with ${freeList.length} still free.`; } drawPool(); } }, 'Take a block'),
                h('span', { class: 'small muted' }, `${8 - freeList.length} in use · ${freeList.length} free`)),
              h('p', { class: 'small m0' }, poolMsg));
          }
          drawPool();
          const FEATS = [
            ['Fast, lightweight task switch', 'Switching tasks saves and restores very little. All tasks usually share one address space, so there is no memory map to change and no address-translation cache to flush, only registers.',
              () => bars([['Desktop process switch', [['registers', 22, 'cpu'], ['memory map', 30, 'mem'], ['cache and TLB refill', 44, 'warn']]], ['RTOS task switch', [['registers', 22, 'cpu']]]]), 'Illustrative proportions, not measurements.'],
            ['Real-time scheduler with the dispatcher inside', 'The scheduling policy is real-time: priority-based and preemptive, sometimes deadline-based (see §10.2). The <span class="t">dispatcher</span> is part of the scheduler, so choosing the next task and switching to it are one short, bounded step.',
              () => h('div', { class: 'row gap-s' }, h('span', { class: 'chip intr' }, 'event'), '→', h('span', { class: 'chip os' }, 'pick the highest-priority ready task'), '→', h('span', { class: 'chip proc' }, 'switch to it')), 'One bounded path, every time.'],
            ['Small size', 'A minimal kernel is a few KB to a few tens of KB of code, so it fits in a microcontroller’s flash with room to spare for the application. Optional parts are added only if the build asks for them.',
              () => bars([['Minimal RTOS kernel', [['a few KB', 12, 'ok']]], ['Embedded Linux kernel + files', [['megabytes', 60, 'warn']]]]), 'Not to scale: the real ratio is about a thousand to one.'],
            ['Quick response to external interrupts', 'Interrupts reach their handlers fast and, above all, within a known bound. A typical design target is an <span class="t">interrupt latency</span> under 10 µs.',
              () => h('div', { class: 'row gap-s' }, h('span', { class: 'chip intr' }, 'device signals'), '→', h('span', { class: 'chip warn' }, 'bounded, often < 10 µs'), '→', h('span', { class: 'chip ok' }, 'handler runs')), 'The interrupt lab (step 4) shows why the bound matters more than the average.'],
            ['Short, bounded interrupts-off intervals', 'Kernel code disables interrupts only for a handful of instructions at a time, for example while it relinks one list. Longer work runs with interrupts enabled, often handed to a task.',
              () => bars([['General kernel', [['off', 40, 'bad'], ['on', 56, 'ok']]], ['RTOS', [['off', 4, 'bad'], ['on', 92, 'ok']]]]), 'The longest red stretch sets the worst-case latency.'],
            ['Memory pools and memory locking', 'Memory is split in advance into fixed-size or variable-size partitions. Taking a block from a <span class="t">memory pool (fixed-size partition)</span> always costs the same short time, and the pool never suffers <span class="t">external fragmentation</span>. <span class="t">Memory locking</span> pins code and data in RAM, so a page fault can never delay a deadline.',
              () => poolBox, ''],
            ['Fast sequential files', 'Special sequential files that collect data at a high rate, such as a flight recorder logging every sensor sample. Space is reserved in advance and data is only ever appended, so a write never waits to find free space.',
              () => h('div', { class: 'row gap-s' }, ...['t=0 ms', 't=1 ms', 't=2 ms', 't=3 ms'].map((x) => h('span', { class: 'chip mem' }, x)), h('span', { class: 'chip' }, 'next → (reserved)')), 'Always append at the end, never search.'],
            ['Timing services', 'A real-time clock; most kernel calls finish in a bounded time; alarms and <span class="t">timeout</span>s; calls that delay a task by a fixed time or suspend and resume it; queues ordered by deadline; and a way to put an urgent message at the front of a queue.',
              () => ctx.ui.code(`result = semWait(data_ready, 5 ms);  // wait for new data, at most 5 ms
if (result == TIMEOUT)               // nothing arrived in time:
    use_last_good_value();           // fall back, never wait forever
delay(10 ms);                        // sleep 10 ms before the next reading`, { lang: 'c', fontSize: 13 }), 'A task that cannot be stuck waiting forever.'],
          ];
          const WHYF = [
            'Tasks may switch thousands of times a second on a slow processor. A cheap switch leaves more of each millisecond for real work, and its cost is predictable.',
            'A separate dispatching stage would add one more delay between “this task must run now” and “it runs”. Merging them keeps that path short and bounded.',
            'Flash and RAM are counted in kilobytes and paid for in every unit sold. A small kernel also means less code to test and verify.',
            'The device exists to react to the world (reactive operation), and a late reaction can be a wrong one (real-time operation).',
            'An interrupt that arrives during an interrupts-off stretch waits for the rest of it, so the longest stretch sets the worst-case latency.',
            'A general heap can slow down as memory fragments, and a page fault can stall a task for milliseconds. Pools and locking make memory timing predictable.',
            'A recorder that paused to search for free space would lose samples. Reserved, append-only storage keeps up with the stream.',
            'Deadlines are about time, so the OS must measure it, wake tasks on time, and cut off any wait that would last too long.',
          ];
          const EXL = [
            'Configurability: a header file, FreeRTOSConfig.h, switches features on and off with #define settings.',
            'Configurability: Kconfig options like the ones in the step 3 lab decide what goes into each image.',
            'Real-time operation in space: engineers fixed Pathfinder’s repeated resets from Earth by switching on priority inheritance.',
            'Streamlined protection is a tendency, not a rule: QNX keeps every process behind MMU-enforced walls.',
            'Small size and fast task switches: it is aimed at microcontrollers with kilobytes of memory.',
            'Configurability taken far: a configuration tool includes or excludes hundreds of individual options.',
          ];
          const EX = [
            ['FreeRTOS', 'A small open-source kernel for microcontrollers, under the MIT licence; its core is a handful of C source files.'],
            ['Zephyr', 'An open-source RTOS hosted by the Linux Foundation since 2016. Every build is configured with Kconfig, the same configuration system Linux uses.'],
            ['VxWorks', 'A commercial RTOS from Wind River, first released in 1987 and long used in aerospace. It ran NASA’s Mars Pathfinder lander (1997), whose priority-inversion bug is a classic case (§10.2).'],
            ['QNX', 'A commercial <span class="t">microkernel</span> RTOS, owned by BlackBerry (then named Research In Motion) since 2010 and common in cars. Its drivers run as user-mode processes, each in its own protected address space: an RTOS that keeps thick walls.'],
            ['ThreadX', 'A small RTOS for microcontrollers, created by Express Logic, later owned by Microsoft, and open source as Eclipse ThreadX since 2024.'],
            ['eCos', 'The “embedded configurable operating system”, an open-source RTOS from the late 1990s built around fine-grained build-time configuration of components.'],
          ];
          const inner = h('div', { class: 'stack', style: { gap: '10px' } });
          const detail = h('div', { class: 'card white fill' }, inner);
          const fbtns = FEATS.map((f, i) => h('button', { class: 'btn sm', type: 'button', style: { justifyContent: 'flex-start', width: '100%', height: 'auto', minHeight: '32px', whiteSpace: 'normal', textAlign: 'left' }, onclick: () => showF(i), html: `<span class="chip os" style="min-width:24px;justify-content:center">${i + 1}</span> ${f[0]}` }));
          const xbtns = EX.map((x, i) => h('button', { class: 'btn sm', type: 'button', onclick: () => showX(i) }, x[0]));
          const mark = (fi, xi) => { fbtns.forEach((b, j) => b.classList.toggle('on', j === fi)); xbtns.forEach((b, j) => b.classList.toggle('on', j === xi)); };
          function showF(i) {
            mark(i, -1);
            const [name, txt, vis, cap] = FEATS[i];
            inner.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '19px' } }, name), h('span', { class: 'chip os' }, `feature ${i + 1} of ${FEATS.length}`)),
              h('p', { class: 'm0', style: { fontSize: '16px' }, html: txt }),
              h('div', { class: 'card tight' }, vis(), cap ? h('p', { class: 'xs muted m0', style: { marginTop: '6px' } }, cap) : null),
              h('div', { class: 'callout why m0', 'data-label': 'Why an RTOS does this', style: { fontSize: '15.5px' } }, WHYF[i]));
            inner.classList.remove('fade-in'); void inner.offsetWidth; inner.classList.add('fade-in');
          }
          function showX(i) {
            mark(-1, i);
            inner.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '19px' } }, EX[i][0]), h('span', { class: 'chip proc' }, 'real example')),
              h('p', { class: 'm0', style: { fontSize: '16px' }, html: EX[i][1] }),
              h('div', { class: 'card tight', style: { fontSize: '15.5px' } }, h('h4', { class: 'm0' }, 'Link to this section'), EXL[i]),
              h('div', { class: 'callout tip small m0', 'data-label': 'Remember' }, 'Each offers most of the features on the left in some form; they differ in licence, size, protection and the hardware they support.'));
            inner.classList.remove('fade-in'); void inner.offsetWidth; inner.classList.add('fade-in');
          }
          showF(0);
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? null : 'minmax(0, 470px) minmax(0, 1fr)' } },
            h('div', { class: 'stack', style: { gap: '4px' } },
              h('p', { class: 'm0 small', html: 'A <span class="t">real-time operating system (RTOS)</span> designed for embedded use typically offers these eight features. Click each one, or a real example.' }),
              ...fbtns,
              h('h4', { class: 'm0', style: { marginTop: '4px' } }, 'Real examples'),
              h('div', { class: 'row gap-s' }, ...xbtns),
              h('div', { class: 'callout warn small m0', style: { marginTop: '6px' }, 'data-label': 'Common mistake', html: 'Thinking an RTOS makes code faster. It makes timing <b>predictable</b>; its average speed may even be lower than a general kernel’s.' })),
            detail));
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: what makes an embedded OS different',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill', style: { gap: '10px' } },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud, then click the card to check it.'),
            ctx.ui.flipcards([
              ['The six traits of an embedded OS?', 'Real-time operation, reactive operation, configurability, I/O device flexibility, streamlined protection, direct use of interrupts.'],
              ['Real-time versus reactive?', '<b>Real-time:</b> a result is correct only if it is on time. <b>Reactive:</b> outside events arrive at unpredictable moments, so the worst-case response must be bounded.'],
              ['How is an embedded OS configured?', 'Modules chosen at build or link time, <b>conditional compilation</b> (#if), or object-oriented components. Unused code never enters the image, but every configuration must be tested.'],
              ['Devices and interrupts?', 'Device handling is done by <b>tasks</b> that can be added per device, not fixed kernel subsystems. Tasks may attach their own interrupt handlers, skipping kernel layers.'],
              ['What sets the worst-case interrupt latency?', 'The <b>longest interrupts-off stretch</b> plus the entry time. An RTOS keeps those stretches tiny; a typical target is under 10 µs.'],
              ['Why can protection be thin, and what is the risk?', 'The code is fixed, tested and trusted, so tasks may do I/O directly and memory walls may be absent. A stray write then corrupts silently; an <b>MPU</b> is a light middle way.'],
              ['Adapt or purpose-build?', '<b>Adapt</b> (Linux + PREEMPT_RT): familiar, rich software, but larger and harder to bound. <b>Purpose-built</b> (FreeRTOS, Zephyr, VxWorks…): small, fast, predictable, fewer ready-made parts.'],
              ['Typical features of a purpose-built RTOS?', 'Fast task switch; real-time scheduler with the dispatcher inside; small size; quick interrupt response; short interrupts-off intervals; memory pools and locking; fast sequential files; timing services.'],
            ], { cols: ctx.narrow ? 1 : 4, height: 218 })));
        },
      },

      /* ---------------- 9. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Which statement best describes <b>real-time operation</b> in an embedded operating system?',
            choices: ['The OS runs every task as fast as the hardware allows it to.', 'A result counts as correct only if it arrives on time.', 'The OS shares the processor evenly among all of its tasks.', 'Every task must finish in less than ten microseconds.'], answer: 1,
            feedback: ['Speed alone does not make a system real-time: a fast system that is sometimes late still fails.', null, 'Fairness is a general-purpose goal; a real-time system favours whatever must meet its deadline.', 'Deadlines range from microseconds to seconds. What matters is meeting them, not one fixed number.'],
            why: 'In real-time operation, when a result is delivered is part of whether it is correct; the deadlines come from the physical system being controlled.' },
          { q: 'A crash sensor can fire at any instant, even while the controller is busy with other work, and the designers must plan for the worst possible moment. Which embedded-OS characteristic does this illustrate most directly?',
            choices: ['Configurability', 'Streamlined protection', 'Reactive operation', 'I/O device flexibility'], answer: 2,
            feedback: ['Configurability is about building only the needed functions into the image, not about when events arrive.', 'Streamlined protection is about keeping memory and I/O checks light.', null, 'I/O device flexibility is about handling very different devices as tasks.'],
            why: 'Reactive operation: the software responds to outside events that arrive unpredictably, so its worst-case response time must be bounded.' },
          { q: 'Why can an embedded OS often get away with <b>streamlined protection</b>?',
            choices: ['Embedded processors cannot raise memory protection faults.', 'Embedded tasks never contain bugs, so the checks would never fire anyway.', 'Users of the device install their own apps, so trust is shared.', 'Its software is fixed and tested, not supplied by unknown users.'], answer: 3,
            feedback: ['Many embedded processors have an MPU or MMU that can raise such faults. Even where the hardware exists, the OS keeps protection light because the code is trusted.', 'Embedded code certainly has bugs. The point is that it is tested together and trusted, while checks cost time and hardware.', 'The opposite: once users can install programs, as on a phone, strong protection becomes necessary.', null],
            why: 'A desktop OS must defend against unknown, possibly hostile programs. An embedded device runs one fixed set of tested code, so light protection is an acceptable trade for speed and simpler hardware.' },
          { type: 'tf', q: 'In a typical general-purpose OS, a user process may install its own interrupt handler and have it run directly when the device interrupts.', answer: false,
            why: 'Only the kernel handles interrupts in a general-purpose OS; it may then wake the process. Letting tasks use interrupts directly is a characteristic of embedded systems.' },
          { type: 'tf', q: 'A purpose-built RTOS usually makes the dispatcher part of the scheduler, so choosing the next task and switching to it happen in one short, bounded step.', answer: true,
            why: 'Merging the two removes a separate stage between “this task must run now” and “it runs”, keeping that path short and predictable.' },
          { type: 'multi', q: 'Which of these are standard ways to configure an embedded OS so that it contains only the functions a device needs? Select all that apply.',
            choices: ['Selecting OS modules at build or link time', 'Conditional compilation', 'Object-oriented components, with subclasses for each need', 'Paging unused kernel code out to disk at run time', 'Disabling interrupts during start-up'], answer: [0, 1, 2],
            why: 'Module selection, conditional compilation and object-oriented components all keep unneeded code out of the image. Paging is a run-time memory technique, and disabling interrupts has nothing to do with configuration.' },
          { type: 'num', q: 'An RTOS never keeps interrupts disabled for more than 6 µs at a time, and the processor needs 1 µs to save its state and jump to a handler. What is the worst-case interrupt latency, in µs?', answer: 7, tol: 0, unit: 'µs',
            why: 'In the worst case the interrupt arrives just as the longest interrupts-off stretch begins: 6 µs of waiting plus 1 µs of entry = 7 µs.' },
          { type: 'num', q: 'An OS image contains a 6 KB kernel core, a 4 KB scheduler, a 2 KB timer module and a 14 KB radio stack. The microcontroller has 32 KB of flash. How many KB are left for the application?', answer: 6, tol: 0, unit: 'KB',
            why: '6 + 4 + 2 + 14 = 26 KB for the OS image, and 32 − 26 = 6 KB remain.' },
          { type: 'bucket', q: 'Building an embedded OS by adapting an existing general-purpose OS such as Linux: advantage or disadvantage?', buckets: ['Advantage', 'Disadvantage'],
            items: [['Familiar programming interface', 0], ['Large stock of existing drivers and software', 0], ['Developers already know how to use it', 0], ['Needs more memory and processor power', 1], ['Not designed for real-time, so the worst case is harder to bound', 1], ['Larger code and higher energy use', 1]],
            why: 'Adapting brings a familiar interface and a huge software base, but the OS was not optimized for real-time or tiny devices, so it is larger and hungrier than a purpose-built one.' },
          { type: 'match', q: 'Match each feature of a purpose-built RTOS to the problem it addresses.',
            pairs: [['Memory pools of fixed-size blocks', 'Allocation time that never varies, and no external fragmentation'], ['Locking code and data in memory', 'No page-fault delays in time-critical code'], ['Short interrupts-off intervals', 'A low worst-case interrupt latency'], ['Timeouts on waits', 'A task can never be stuck waiting forever'], ['Fast sequential files', 'Logging data at a high rate without pausing']],
            why: 'Each feature removes one source of unpredictable delay, which is what a real-time system cares about most.' },
          { type: 'order', q: 'On a general-purpose OS, a device interrupts while the kernel has interrupts disabled. Put these events in order, from the interrupt to the user process that needs the data running.',
            items: ['The device raises an interrupt', 'The processor waits until interrupts are enabled again', 'The processor saves its state and enters the kernel’s handler', 'The kernel driver services the device and marks the process ready', 'The scheduler switches to the user process'],
            why: 'Waiting out an interrupts-off stretch, entering the handler, the driver, and the wake-up and switch all add up. An embedded OS shortens the first and may skip the last two by letting the task’s own handler run.' },
          { q: 'A delivery robot needs motor control every 100 µs, plus camera navigation, Wi-Fi and a touch screen. Which design is most common?',
            choices: ['An RTOS on a microcontroller for motors, Linux on another processor', 'Stock desktop Linux alone, since it has the most drivers and libraries', 'No operating system: one super loop that handles everything', 'A purpose-built RTOS alone, with a GUI written from scratch'], answer: 0,
            feedback: [null, 'A stock general-purpose kernel cannot guarantee a 100 µs control loop.', 'A super loop cannot sensibly run vision, networking and a GUI alongside a 100 µs loop.', 'Possible, but it gives up the ready-made networking, vision and GUI software a general OS brings.'],
            why: 'The two halves want different things, so many devices split them: a purpose-built RTOS for the hard deadlines and an adapted general OS for the rich features.' },
        ],
      },
    ],

    notes: `
      <h3>Characteristics of embedded operating systems</h3>
      <p>An <b>embedded operating system</b> runs inside a device built for one dedicated job (a router, a pump, a car controller). It gives up much of what a desktop OS offers in exchange for a small <b>memory footprint</b> (flash for code, RAM for data), predictable timing and easy trimming.</p>
      <h4>How much OS does a device need?</h4>
      <ul>
        <li><b>None:</b> a <b>bare-metal program (super loop)</b> reads inputs, computes and drives outputs forever, helped by a few interrupt handlers. Enough for one simple job on a tiny <b>microcontroller</b> (one chip with processor, flash, RAM, clock and I/O hardware).</li>
        <li><b>A small RTOS</b> (an OS whose services take a known, bounded time): several jobs with deadlines on one microcontroller, such as a drone flight controller. A kernel of a few KB gives tasks, priorities, timers and queues.</li>
        <li><b>An adapted general OS</b> (usually Linux) for rich devices such as routers and smart TVs, with megabytes to gigabytes of memory.</li>
      </ul>
      <h4>The six characteristics</h4>
      <table>
        <tr><th>Characteristic</th><th>General-purpose OS</th><th>Embedded OS</th></tr>
        <tr><td>Real-time operation</td><td>Good average speed and fairness.</td><td>A result is correct only if delivered on time; deadlines come from the physical system.</td></tr>
        <tr><td>Reactive operation</td><td>Runs programs a user started.</td><td>Responds to outside events at unpredictable moments, so the worst-case response must be bounded.</td></tr>
        <tr><td>Configurability</td><td>One big build for everyone.</td><td>Only the needed functions: modules chosen at build or link time, conditional compilation, or object-oriented components. Each configuration must be tested.</td></tr>
        <tr><td>I/O device flexibility</td><td>Fixed device classes; drivers are kernel subsystems.</td><td>Device handling is done by special tasks added per device.</td></tr>
        <tr><td>Streamlined protection</td><td>Privileged I/O; processes walled off by the MMU.</td><td>Trusted, tested code: tasks may do I/O directly; memory protection minimal or absent.</td></tr>
        <tr><td>Direct use of interrupts</td><td>Only the kernel handles interrupts.</td><td>Tasks may attach their own handlers, skipping kernel layers.</td></tr>
      </table>
      <p>These are tendencies, not laws: QNX keeps full memory protection, and connected or safety-critical devices often add protection back.</p>
      <h4>Configurability: a worked example (illustrative sizes)</h4>
      <p>Modules (flash/RAM in KB): kernel core 6/1 (always), multitasking 4/3, timers 2/1, queues 3/1, low-power radio 14/4, TCP/IP + Wi-Fi 110/48, flash file system 28/6, touch-screen GUI 140/64, MPU support 6/2, debug shell 16/4; all together 329/134.</p>
      <ul>
        <li><b>Door sensor</b> (budget 32/8) needs timers and radio: 6 + 2 + 14 = 22 KB flash and 1 + 1 + 4 = 6 KB RAM. Adding multitasking raises RAM to 9 KB: no longer fits.</li>
        <li><b>Smart thermostat</b> (512/160) needs multitasking, timers, queues, networking, file system, GUI: 293/124. <b>Drone controller</b> (128/32) needs multitasking, timers, queues, radio, MPU: 35/12.</li>
      </ul>
      <p><b>Conditional compilation</b>: code inside <code>#if CONFIG_NET ... #endif</code> is never compiled when CONFIG_NET is off, so it takes no flash. An unneeded module that fits is still dead weight: more to test, more to go wrong.</p>
      <h4>Interrupt latency</h4>
      <p><b>Interrupt latency</b> runs from a device raising an interrupt to the first instruction of its handler. An interrupt arriving while interrupts are disabled must wait, so <b>worst-case latency = longest interrupts-off stretch + entry time</b>.</p>
      <p>Example (illustrative): a general kernel with a ${longestOff(KERNELS[0])} µs longest stretch and ${KERNELS[0].entry} µs entry has a worst-case latency of ${NOTE_G.worst.latency} µs; its driver (${KERNELS[0].layers[0][1]} µs) and the wake-up and switch to the process (${KERNELS[0].layers[1][1]} µs) push the start of the application's code to ${NOTE_G.worst.total} µs. Averaged over all arrival moments, that code starts after only about ${Math.round(NOTE_G.avgTotal)} µs, but reactive operation means the worst case is what counts. An RTOS with a ${longestOff(KERNELS[1])} µs longest stretch and ${KERNELS[1].entry} µs entry has a worst case of ${NOTE_R.worst.latency} µs, and with direct use of interrupts the application's own handler starts right then. A typical RTOS target is under 10 µs.</p>
      <h4>Protection and devices</h4>
      <ul>
        <li>Desktop OS: reading a device register from user mode needs a system call (two mode switches plus the driver). Embedded OS: one ordinary instruction.</li>
        <li>A stray write into another task's data: an MMU faults and stops only the buggy process; no protection means silent corruption; a <b>memory protection unit (MPU)</b> (a few guarded regions, no address translation) faults and the kernel stops the faulty task.</li>
        <li>A new device: a desktop OS needs a privileged kernel driver; an embedded OS adds one task that owns the device's registers.</li>
      </ul>
      <h4>Two approaches</h4>
      <p><b>Adapt an existing OS</b> (usually Linux): add real-time capability, streamline it, add embedded functions. Linux's real-time changes, PREEMPT_RT, were kept outside the main kernel for many years and merged in version 6.12 (2024). Pros: familiar interface, huge stock of drivers and software. Cons: not designed for real-time or tiny devices, so the worst case is harder to bound; larger, needing more memory, processor power and energy.</p>
      <p><b>Purpose-built embedded OS</b>: designed from the start for embedded, real-time use. Pros: small, fast, predictable. Cons: fewer ready-made drivers and applications, its own interface, extras as add-ons. Rich devices with soft timing adapt Linux; small, battery-powered or hard-deadline devices use an RTOS; some products run both on two processors.</p>
      <h4>Typical features of a purpose-built RTOS</h4>
      <ol>
        <li>Fast, lightweight task switch (one shared address space: only registers change).</li>
        <li>Real-time scheduling, with the dispatcher built into the scheduler, so picking and switching to the next task is one short, bounded step.</li>
        <li>Small size (a few KB to tens of KB).</li>
        <li>Quick response to external interrupts.</li>
        <li>Short, bounded interrupts-off intervals.</li>
        <li>Memory partitions set up in advance, plus <b>memory locking</b> (never paged out).
          <ul>
            <li><b>Fixed-size block pools</b> (memory pools) cut memory into equal-size blocks kept on a free list. Taking or returning a block is a fixed, small number of steps, and the pool has no external fragmentation, because any free block fits any request the pool serves. The cost is internal fragmentation: a 20-byte request in a 64-byte pool wastes the other 44 bytes of its block.</li>
            <li><b>Variable-size partitions</b> give each request about the size it asks for, so less is wasted inside blocks. A suitable allocator can put an upper bound on how long an allocation takes, but variable sizes do not remove external fragmentation: free 32 bytes, used 32, free 32 holds 64 free bytes, yet a 48-byte request fails because no single gap is big enough.</li>
            <li>A fixed number of steps means a bounded, predictable cost, not an identical elapsed time on every call: cache misses and interrupts can still stretch a single call.</li>
          </ul>
        </li>
        <li>Special sequential files that accumulate data fast (append-only, space reserved).</li>
        <li>Timing services: real-time clock, bounded-time primitives, alarms and <b>timeouts</b> (no wait lasts forever), delay and suspend/resume, deadline-ordered queues, urgent messages at the front of a queue.</li>
      </ol>
      <p>Examples: FreeRTOS, Zephyr (configured with Kconfig), VxWorks (ran Mars Pathfinder), QNX (microkernel with full memory protection), ThreadX (now Eclipse ThreadX), eCos (build-time configuration).</p>
      <p><b>Common mistake:</b> "real-time means fast". It means predictable: a bounded worst case matters more than a good average.</p>`,
  });
})();
