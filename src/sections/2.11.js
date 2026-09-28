/* Section 2.11 — Android
   Original teaching material. Built step by step. */
Guide.section({
  id: '2.11',
  title: 'Android',
  short: 'Android',
  summary: 'Android\'s layered stack, Binder and the HAL, Dalvik vs ART, activities, and power-saving alarms and wakelocks.',
  objectives: [
    'Describe what Android is, where it came from, and the range of devices it runs on today.',
    'Name the five layers of the Android software stack (applications, application framework, system libraries, Android runtime, Linux kernel) and say what each provides.',
    'Trace a request from an app through Binder IPC, the Android system services and the hardware abstraction layer down to a Linux device driver.',
    'Compare the Dalvik virtual machine with ART, explaining just-in-time versus ahead-of-time compilation and their trade-offs.',
    'Explain activities and the back stack, and how alarms and wakelocks let Android sleep to save battery without missing work.',
  ],
  terms: [
    ['Android', 'A Linux-based operating system first built for touchscreen phones and tablets and now also used in TVs, cars, watches and embedded devices. It began at a start-up, Android Inc., which Google bought in 2005.'],
    ['Open Handset Alliance (OHA)', 'A group of phone makers, chip makers, mobile carriers and software companies, led by Google, formed in 2007 to create open standards for mobile devices. It launched Android as its shared, open-source platform.'],
    ['Application framework', 'The layer of Android that app developers program against: a set of Java/Kotlin services and classes (activity manager, window manager, content providers, notification manager and more) that give every app the same building blocks.'],
    ['Activity manager', 'The framework service that starts and stops activities, keeps each task\'s back stack, and decides what the user sees when they switch apps or press Back.'],
    ['Content provider', 'A framework component through which one app shares some of its data (such as contacts or calendar events) with other apps, using a standard query interface with permission checks.'],
    ['SQLite', 'A small but complete SQL database engine that runs as a library inside the app that uses it and keeps each database in one ordinary file.'],
    ['Surface manager', 'The system library that combines the drawing surfaces (windows) of every visible app, the status bar and the keyboard into the one image shown on the display.'],
    ['Bionic libc', 'Android\'s own standard C library (functions such as malloc, printf and open). It is smaller and quicker to load than the GNU C library used on desktop Linux.'],
    ['Dalvik virtual machine', 'Android\'s original virtual machine for app code. It ran .dex bytecode by interpreting it and, from 2010, compiling busy parts just in time. ART replaced it in Android 5.0 (2014).'],
    ['Dalvik executable (.dex)', 'The compact bytecode format Android apps ship in. Build tools convert compiled Java or Kotlin classes into .dex files, which both Dalvik and ART can run.'],
    ['Android runtime (ART)', 'The runtime that replaced Dalvik. It turns an app\'s .dex bytecode into native machine code: at first all of it at install time; since Android 7.0, by JIT while the app runs plus ahead-of-time compiling of its most-used code while the phone is idle.'],
    ['Just-in-time compilation (JIT)', 'Translating bytecode into machine code while the program runs, usually only for the parts that run often. Unless the results are saved, the same work is redone every time the program runs.'],
    ['Ahead-of-time compilation (AOT)', 'Translating bytecode into machine code before the program runs (on Android, when the app is installed or while the phone is idle), so no translation is needed when it launches.'],
    ['Binder (Binder IPC)', 'Android\'s main interprocess communication mechanism: a Linux kernel driver plus libraries that let code in one process call a method on an object in another process as if it were a local call, with the caller\'s identity attached.'],
    ['Android system services', 'Long-running Android processes that own the device\'s shared resources, mainly the system server (activity, window, power, location and other managers) and the media server (camera, audio, video). Apps reach them through Binder.'],
    ['Android HAL', 'Android\'s hardware abstraction layer: standard interfaces (camera, audio, GPS, sensors and more) that each hardware vendor implements for its own chips, so the layers above never depend on which parts are inside a device. Unlike the Windows HAL (section 2.7), which hides a platform\'s wiring inside the kernel, it sits above the kernel\'s drivers.'],
    ['Activity', 'One screen of an Android app with a single focused job, such as an inbox list or a compose-message screen. An app is usually made of several activities.'],
    ['Back stack', 'The last-in, first-out list of activities the user has opened in one task. Starting an activity pushes it on top; pressing Back removes the top one and shows the one beneath.'],
    ['Wakelock (wake lock)', 'A request by an app to keep the device from going to sleep. While any wakelock is held the processor (and, for some types, the screen) stays on; the device may sleep only when none is held.'],
    ['Alarm (AlarmManager)', 'An Android addition to the Linux kernel that lets an app schedule work for a set time; apps request one through the AlarmManager class. The kernel programs a hardware timer that keeps running during sleep, so an alarm can wake a sleeping device.'],
  ],

  css: `
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width and the page scrolls sideways */
    .sec-2-11 .step-eyebrow { contain: inline-size; }
    .sec-2-11 .hot { cursor: pointer; outline: none; }
    .sec-2-11 .hot .fr { transition: stroke-width .15s, opacity .2s; }
    .sec-2-11 .hot:hover .fr, .sec-2-11 .hot:focus-visible .fr { stroke-width: 3.5; }
    .sec-2-11 .hot.sel .fr { stroke-width: 4; }
    .sec-2-11 .info { display: flex; flex-direction: column; gap: 8px; }
    .sec-2-11 .info h3 { margin: 0; }
    .sec-2-11 .info p { font-size: 15.5px; line-height: 1.45; margin: 0; }
    .sec-2-11 .eg { font-size: 14.5px; line-height: 1.4; padding: 7px 11px; border-radius: 10px; background: var(--panel-3); border-left: 4px solid var(--chc); }
    .sec-2-11 .eg b { color: var(--chc); }
    .sec-2-11 .ms-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
    .sec-2-11 .ms { display: flex; flex-direction: column; gap: 2px; padding: 7px 8px; border-radius: 10px; background: var(--panel-2); border: 1px solid var(--line); border-top: 4px solid var(--chc); }
    .sec-2-11 .ms b { font-size: 15px; color: var(--chc); }
    .sec-2-11 .ms span { font-size: 13px; line-height: 1.3; color: var(--ink-2); }
    .sec-2-11 .laygrid { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 10px; height: 100%; }
    .sec-2-11 .laygrid > .lay:nth-child(1), .sec-2-11 .laygrid > .lay:nth-child(2), .sec-2-11 .laygrid > .lay:nth-child(5) { grid-column: 1 / -1; }
    .sec-2-11 .lay { display: flex; flex-direction: column; gap: 6px; align-items: stretch; text-align: left; padding: 8px 12px; border-radius: 12px; border: 2px solid color-mix(in srgb, var(--lc) 45%, transparent); border-left: 6px solid var(--lc); cursor: pointer; font: inherit; color: var(--ink); min-height: 0; transition: border-color .15s, box-shadow .15s; }
    .sec-2-11 .lay:hover { border-color: var(--lc); box-shadow: 0 0 0 2px color-mix(in srgb, var(--lc) 25%, transparent); }
    .sec-2-11 .lay.wrong { animation: sec211shake .6s; border-color: var(--bad); }
    @keyframes sec211shake { 0%, 100% { box-shadow: inset 0 0 0 0 transparent; } 20%, 60% { box-shadow: inset 0 0 0 4px var(--bad); background: var(--bad-bg); } 40%, 80% { box-shadow: inset 0 0 0 1px var(--bad); } }
    .sec-2-11 .layhead { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .sec-2-11 .layhead b { font-size: 16px; color: var(--lc); }
    .sec-2-11 .laychips { display: flex; flex-wrap: wrap; gap: 5px; align-content: flex-start; }
    .sec-2-11 .laychips .chip { font-size: 12.5px; white-space: normal; }
    .sec-2-11 .itemcard { padding: 20px 20px; border-radius: 14px; background: var(--panel); border: 2px solid var(--chc); box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 4px; }
    .sec-2-11 .iname { font-size: 28px; font-weight: 800; line-height: 1.2; letter-spacing: -.01em; }
    .sec-2-11 .fbbox { min-height: 0; }
    .sec-2-11 .fbbox .callout { font-size: 16px; line-height: 1.5; }
    .sec-2-11 .mdot { width: 14px; height: 8px; border-radius: 9px; background: var(--panel-3); display: inline-block; }
    .sec-2-11 .mdot.cur { background: var(--chc); }
    .sec-2-11 .mdot.ok { background: var(--ok); }
    .sec-2-11 .mdot.warn { background: var(--warn); }
    .sec-2-11 .tok { transition: transform .55s ease; pointer-events: none; }
    .sec-2-11 .pipe { display: flex; align-items: stretch; gap: 6px; }
    .sec-2-11 .pipe > .box { flex: 1; padding: 6px 8px; min-width: 0; display: grid; place-items: center; line-height: 1.25; }
    .sec-2-11 .pipe-arrow { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: none; line-height: 1.1; }
    .sec-2-11 .box.accent { border-color: var(--accent); background: var(--accent-bg); }   /* the shell has no accent box */
    .sec-2-11 .route { gap: 3px; }
    .sec-2-11 .route .chip { padding-left: 7px; padding-right: 7px; }
    .sec-2-11 .rt-tbl td, .sec-2-11 .rt-tbl th { vertical-align: middle; padding-top: 3px; padding-bottom: 3px; }
    .sec-2-11 .rt-tbl .chip { white-space: normal; line-height: 1.3; padding: 2px 8px; }
    .sec-2-11 .rt-tbl .col-on { background: color-mix(in srgb, var(--chc) 10%, var(--panel)); }
    .sec-2-11 .rt-tbl th.col-on { color: var(--chc); }
    .sec-2-11 .kpi { display: flex; flex-direction: column; padding: 5px 10px; border-radius: 10px; border: 1px solid var(--line); border-left: 5px solid var(--kc); background: var(--panel-2); }
    .sec-2-11 .kpi.on { background: var(--panel); box-shadow: 0 0 0 2px var(--kc); }
    .sec-2-11 .kpi .kv { font-size: 24px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .sec-2-11 .act-grid { display: grid; grid-template-columns: minmax(0, 330px) 290px minmax(0, 1fr); gap: 22px; height: 100%; }
    .sec-2-11 .phone { width: 270px; height: 520px; border: 9px solid var(--ink-2); border-radius: 30px; background: var(--panel); display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow); }
    .sec-2-11 .ph-status { display: flex; justify-content: space-between; padding: 3px 14px; font-size: 12.5px; font-weight: 700; color: var(--ink-2); background: var(--panel-2); }
    .sec-2-11 .ph-screen { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    .sec-2-11 .ph-bar { display: flex; justify-content: space-between; align-items: baseline; padding: 10px 12px; font-size: 16px; border-bottom: 1px solid var(--line); }
    .sec-2-11 .ph-bar.home { background: var(--panel-3); color: var(--ink-2); font-weight: 700; font-size: 15px; }
    .sec-2-11 .ph-body { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; min-height: 0; }
    .sec-2-11 .ph-msg { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; text-align: left; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel-2); cursor: pointer; font: inherit; font-size: 14px; color: var(--ink); }
    .sec-2-11 .ph-msg:hover { border-color: var(--proc); }
    .sec-2-11 .ph-msg span { font-size: 13.5px; color: var(--ink-2); }
    .sec-2-11 .ph-field { padding: 6px 9px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel-2); font-size: 13.5px; color: var(--ink-2); }
    .sec-2-11 .ph-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .sec-2-11 .ph-photo { aspect-ratio: 1; border-radius: 10px; border: 0; cursor: pointer; opacity: .75; }
    .sec-2-11 .ph-photo:hover { opacity: 1; outline: 3px solid var(--ink); }
    .sec-2-11 .ph-home { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding: 20px 14px; }
    .sec-2-11 .ph-icon { display: flex; flex-direction: column; align-items: center; gap: 4px; border: 0; background: none; cursor: pointer; color: var(--ink); font: inherit; }
    .sec-2-11 .ph-icon:disabled { opacity: .45; cursor: default; }
    .sec-2-11 .ph-ico { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; color: var(--panel); font-weight: 900; font-size: 20px; }
    .sec-2-11 .ph-nav { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--line); background: var(--panel-2); }
    .sec-2-11 .ph-navb { border: 0; background: none; padding: 9px 0; font: inherit; font-size: 15px; font-weight: 700; color: var(--ink-2); cursor: pointer; }
    .sec-2-11 .ph-navb:hover { color: var(--accent); background: var(--panel-3); }
    .sec-2-11 .bs-stack { display: flex; flex-direction: column; gap: 6px; }
    .sec-2-11 .bs-card { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 10px; border: 1.5px solid color-mix(in srgb, var(--ac) 45%, transparent); border-left: 6px solid var(--ac); background: var(--panel-2); font-size: 15px; }
    .sec-2-11 .bs-card.top { background: var(--acb); box-shadow: 0 0 0 2px var(--ac); }
    .sec-2-11 .bs-empty { padding: 10px; border: 2px dashed var(--line-2); border-radius: 10px; text-align: center; }
    .sec-2-11 .bs-log { flex: 1; font-size: 13px; font-family: var(--font); }
    .sec-2-11 .wl-grid { display: grid; grid-template-columns: minmax(0, 412px) minmax(0, 1fr); gap: 20px; height: 100%; }
    .sec-2-11 .wl-tbl { font-size: 13.5px; }
    .sec-2-11 .wl-tbl th, .sec-2-11 .wl-tbl td { padding: 3px 7px; font-size: 13.5px; }
    .sec-2-11 .wl-tbl th { font-size: 12px; text-transform: none; letter-spacing: 0; }
    .sec-2-11 .wl-narr { font-size: 15px; line-height: 1.45; padding: 9px 12px; border-radius: 10px; background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); min-height: 66px; }
    .sec-2-11 .wl-narr b { color: var(--chc); }
    .sec-2-11 .wl-mini { flex: none; width: 30px; height: 50px; border-radius: 7px; border: 3px solid var(--ink-2); display: grid; place-items: center; font-size: 11px; font-weight: 900; color: var(--muted); background: var(--panel-3); transition: background .2s; }
    .sec-2-11 .wl-mini.bright { background: var(--hl); border-color: var(--warn); }
    .sec-2-11 .wl-mini.dim { background: color-mix(in srgb, var(--hl) 40%, var(--panel-3)); border-color: var(--warn); }
    .sec-2-11 .rc-strip { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .sec-2-11 .rc-strip .box { padding: 5px 10px; font-size: 14.5px; }
    .sec-2-11 .rc-lab { width: 170px; letter-spacing: .05em; }
    .sec-2-11 .rc-arr { color: var(--chc); font-weight: 900; }
    /* phone (narrow) variants: the shell only restacks .split/.grid-*, so the custom layouts opt in via a .nar class */
    .sec-2-11 .nar.act-grid, .sec-2-11 .nar.wl-grid { grid-template-columns: minmax(0, 1fr); height: auto; }
    .sec-2-11 .nar.pipe { flex-wrap: wrap; }
    .sec-2-11 .nar.ms-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .sec-2-11 .nar.pipe > .box { flex: 1 1 38%; }
    .sec-2-11 .nar.laygrid { height: auto; grid-template-rows: none; grid-auto-rows: minmax(84px, auto); }
  `,

  steps: [
    /* ---------------- 1. Big picture: what Android is, where it came from, where it runs ---------------- */
    {
      title: 'A Linux kernel in billions of pockets',
      kind: 'story',
      render(el, ctx) {
        const { h, s } = ctx;
        const DEV = [
          { id: 'phone', name: 'Phones', ed: 'Android',
            what: 'Where Android started. A phone has a touch screen, a cellular radio, cameras, GPS and a small battery, and it runs apps from thousands of different developers. Almost every idea in this section, from sandboxed apps to aggressive sleeping, comes from these constraints.',
            diff: 'Touch input, telephony and the tightest battery budget.' },
          { id: 'tablet', name: 'Tablets', ed: 'Android',
            what: 'The same operating system as a phone on a bigger screen. Apps adapt because the framework\'s resource manager hands them a wider layout when the screen is larger, so one app can serve both devices.',
            diff: 'Larger layouts chosen automatically; often no cellular radio.' },
          { id: 'tv', name: 'TVs', ed: 'Android TV / Google TV',
            what: 'Television sets and streaming boxes run Android with a "lean-back" interface you drive with a remote control instead of your finger. Video playback leans heavily on the media framework and on hardware video decoders.',
            diff: 'Remote-control input, big-screen interface, plugged into the wall.' },
          { id: 'car', name: 'Cars', ed: 'Android Automotive',
            what: 'Android Automotive runs directly on a car\'s dashboard computer for maps, music and climate controls. Car makers add hardware modules for vehicle parts, such as speed sensors and air conditioning, behind the same kind of hardware abstraction layer phones use.',
            diff: 'Extra hardware interfaces for the vehicle; driving-safe interface rules.' },
          { id: 'watch', name: 'Watches', ed: 'Wear OS',
            what: 'Wear OS is a version of Android tuned for tiny screens and even tinier batteries. The power-saving features you meet in step 7 matter even more on a device whose battery is a small fraction of a phone\'s, yet must still last all day.',
            diff: 'Very small screen and battery; mostly glanceable screens.' },
          { id: 'iot', name: 'Embedded', ed: 'kiosks, IoT and more',
            what: 'Payment terminals, kiosks, smart displays, fitness machines and other embedded or Internet-of-Things gadgets often run Android because it is open source and already comes with drivers, a touch interface toolkit and a huge pool of developers.',
            diff: 'One dedicated job; the maker controls every app on it.' },
        ];
        let cur = 0;
        const icon = (id, cx, cy) => {
          const c = 's-io';
          if (id === 'phone') return [s('rect', { x: cx - 15, y: cy - 27, width: 30, height: 54, rx: 6, class: c, 'stroke-width': 2.5 }), s('circle', { cx, cy: cy + 20, r: 2.5, class: 's-line' })];
          if (id === 'tablet') return [s('rect', { x: cx - 26, y: cy - 30, width: 52, height: 60, rx: 7, class: c, 'stroke-width': 2.5 }), s('circle', { cx, cy: cy + 24, r: 2.5, class: 's-line' })];
          if (id === 'tv') return [s('rect', { x: cx - 34, y: cy - 24, width: 68, height: 40, rx: 4, class: c, 'stroke-width': 2.5 }), s('path', { d: `M${cx - 12} ${cy + 28} L${cx + 12} ${cy + 28} M${cx} ${cy + 16} L${cx} ${cy + 28}`, class: 's-line' })];
          if (id === 'car') return [s('path', { d: `M${cx - 36} ${cy + 12} L${cx - 36} ${cy - 2} L${cx - 22} ${cy - 4} L${cx - 12} ${cy - 18} L${cx + 14} ${cy - 18} L${cx + 24} ${cy - 4} L${cx + 36} ${cy - 1} L${cx + 36} ${cy + 12} Z`, class: c, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),
            s('circle', { cx: cx - 20, cy: cy + 13, r: 7, class: 's-panel', 'stroke-width': 2.5 }), s('circle', { cx: cx + 20, cy: cy + 13, r: 7, class: 's-panel', 'stroke-width': 2.5 })];
          if (id === 'watch') return [s('rect', { x: cx - 9, y: cy - 30, width: 18, height: 60, rx: 5, class: 's-panel', 'stroke-width': 2 }), s('circle', { cx, cy, r: 17, class: c, 'stroke-width': 2.5 })];
          return [s('rect', { x: cx - 24, y: cy - 16, width: 48, height: 36, rx: 6, class: c, 'stroke-width': 2.5 }), s('path', { d: `M${cx + 12} ${cy - 16} L${cx + 12} ${cy - 30}`, class: 's-line' }), s('circle', { cx: cx + 12, cy: cy - 31, r: 3, class: 's-line' }),
            s('circle', { cx: cx - 10, cy: cy + 2, r: 3, class: 's-line' }), s('circle', { cx, cy: cy + 2, r: 3, class: 's-line' }), s('circle', { cx: cx + 10, cy: cy + 2, r: 3, class: 's-line' })];
        };
        const NW = ctx.narrow;   // phones: 3 × 2 grid of devices so the labels stay readable
        const svg = s('svg', { viewBox: NW ? '0 0 300 236' : '0 0 600 118', width: '100%' });
        const head = h('h3', {});
        const what = h('p', {});
        const diff = h('div', { class: 'eg' });
        function draw() {
          svg.replaceChildren(...DEV.map((d, i) => {
            const cx = 50 + (NW ? i % 3 : i) * 100, oy = NW ? Math.floor(i / 3) * 118 : 0, on = i === cur;
            return s('g', { class: 'hot' + (on ? ' sel' : ''), role: 'button', tabindex: 0, 'aria-label': d.name, onclick: () => show(i), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); } } },
              s('rect', { class: 'fr ' + (on ? 's-accent' : 's-panel'), x: cx - 46, y: 4 + oy, width: 92, height: 110, rx: 12, 'stroke-width': 2 }),
              ...icon(d.id, cx, 46 + oy),
              s('text', { x: cx, y: 102 + oy, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': on ? 800 : 650, style: on ? 'fill:var(--accent)' : '' }, d.name));
          }));
        }
        function show(i) {
          cur = i;
          const d = DEV[i];
          head.innerHTML = `${d.name} <span class="chip io" style="vertical-align:3px">${d.ed}</span>`;
          what.innerHTML = d.what;
          diff.innerHTML = '<b>What changes: </b>' + d.diff;
          draw();
        }
        const MIL = [['2003', 'Android Inc. founded as a small start-up'], ['2005', 'Google buys Android Inc.'], ['2007', 'Announced with the Open Handset Alliance'], ['2008', 'First phone on sale; code open-sourced'], ['Today', 'Most-used mobile OS: about 7 in 10 phones']];
        const left = h('div', { class: 'stack', style: { gap: '10px' } },
          h('p', { class: 'lead m0', html: 'A phone is a small computer that must respond instantly, run apps from strangers safely, and last all day on a tiny battery.' }),
          h('p', { class: 'm0', html: '<span class="t">Android</span> meets those demands on most of the world\'s phones. Underneath, it runs the <b>Linux kernel</b> (section 2.10); on top, it adds its own layers for touch screens, apps and battery life. Google leads its development, but the code is open source, and the <span class="t">Open Handset Alliance</span> of phone makers, chip makers and carriers builds devices from it.' }),
          h('div', { class: 'ms-strip' + (ctx.narrow ? ' nar' : '') }, ...MIL.map(([y, t]) => h('div', { class: 'ms' }, h('b', {}, y), h('span', {}, t)))),
          h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A theatre. The wiring and fire exits (the Linux kernel) serve every show. The house crew offers services any production can book: lights, sound, ushers (Android\'s framework). Each show (an app) brings its own script and cast, but must ask the crew instead of rewiring the stage.' }));
        const right = h('div', { class: 'card white stack', style: { gap: '10px' } },
          h('h4', { class: 'm0' }, 'Where Android runs today: click a device'),
          svg,
          h('div', { class: 'info grow' }, head, what, diff),
          h('div', { style: { borderTop: '1px dashed var(--line-2)', paddingTop: '8px' } },
            h('h4', {}, 'The same on every device, and what you will explore'),
            h('div', { class: 'row gap-s' },
              h('span', { class: 'chip proc' }, '2 · five-layer stack'), h('span', { class: 'chip os' }, '4 · Binder, services, HAL'),
              h('span', { class: 'chip cpu' }, '5 · Dalvik → ART'), h('span', { class: 'chip accent' }, '6 · activities'), h('span', { class: 'chip warn' }, '7 · alarms + wakelocks'))));
        el.append(h('div', { class: 'split fill' }, left, right));
        show(0);
      },
    },

    /* ---------------- 2. The software stack: every layer and component is clickable ---------------- */
    {
      title: 'The classic Android software stack: click every part',
      kind: 'explore',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h, s } = ctx;
        const COL = (c) => (c === 'lib' ? { band: 's-panel', ink: 'var(--ink-2)', bg: 'var(--panel-3)', chip: '' } : { band: 's-' + c, ink: `var(--${c})`, bg: `var(--${c}-bg)`, chip: c });
        const L = { apps: ['Applications', 'Java / Kotlin', 'proc'], fw: ['Application framework', 'Java / Kotlin', 'accent'], libs: ['System libraries', 'C / C++', 'lib'], rt: ['Android runtime', 'C++ / Java', 'cpu'], kernel: ['Linux kernel', 'C', 'os'] };
        const P = {
          apps: { layer: 'apps', name: 'Applications', job: 'The programs people actually use: home screen, dialer, contacts, SMS, email, calendar, maps, browser, plus everything installed from an app store. Most built-in apps are ordinary apps: you can replace the default SMS, browser or even home-screen app with one you install. Each app runs in its own Linux process under its own user ID, so apps are sandboxed (walled off) from each other.', eg: 'Maps asks the location manager where you are, then draws the map with the view system.' },
          fw: { layer: 'fw', name: 'Application framework', job: 'The toolkit every app is built from: the Java/Kotlin classes and services that developers call. It is Android\'s <span class="t" data-t="API">API</span>: the set of classes and calls a program is allowed to use. Many of these managers are thin stand-ins inside the app; the real work happens in system service processes that the app reaches through Binder (step 4).', eg: 'Because every app uses the same framework, the Back button, notifications and permissions behave the same in all of them.' },
          am: { layer: 'fw', name: 'Activity manager', job: 'Starts, pauses and stops each app\'s screens (<span class="t">activities</span>), keeps the back stack so Back returns to the right screen, and decides which background apps can be ended when memory runs low.', eg: 'You tap an email notification: the activity manager starts the email app\'s "read message" screen on top of the stack.' },
          wm: { layer: 'fw', name: 'Window manager', job: 'Decides which windows exist and how they are arranged: which app is in front, the status bar, dialogs, split screen, rotation. It sits on top of the surface manager library, which does the actual combining of pixels.', eg: 'You rotate the phone and every visible window is resized and re-laid out.' },
          cp: { layer: 'fw', name: 'Content providers', job: 'Let an app publish some of its data for other apps through one standard query interface, with permission checks, instead of letting them open its files. Contacts, calendar events and the media gallery are all shared this way.', eg: 'A chat app lists your friends by querying the Contacts provider, never the contacts database file itself.' },
          vs: { layer: 'fw', name: 'View system', job: 'The ready-made visual building blocks of every screen: buttons, text boxes, lists, grids, images, even an embedded web view. It also delivers each touch to the element under your finger.', eg: 'The "Send" button in a messaging app is a view object from this system.' },
          nm: { layer: 'fw', name: 'Notification manager', job: 'Lets any app show alerts in the status bar and notification shade (icon, text, sound, vibration), even when the app is not on screen.', eg: '"New message from Sam" appears at the top of the screen while you are playing a game.' },
          pm: { layer: 'fw', name: 'Package manager', job: 'Installs, updates and removes apps, and keeps a record of every installed app: its name, version, components and the permissions it asked for. Other parts of Android consult this record.', eg: 'Installing an app from the store: the package manager unpacks it, records its permissions and has its code prepared for the runtime.' },
          tm: { layer: 'fw', name: 'Telephony manager', job: 'Gives apps controlled access to the phone side of the device: call state, mobile network type, signal strength, and SIM and carrier details.', eg: 'A podcast app pauses itself when the telephony manager reports an incoming call.' },
          rm: { layer: 'fw', name: 'Resource manager', job: 'Hands apps everything that is not code: text strings, images, colours and screen layouts. It picks the right version automatically for the device\'s language, screen size and orientation.', eg: 'One app shows Spanish text on a phone set to Spanish and a two-column layout on a tablet, with no code change.' },
          lm: { layer: 'fw', name: 'Location manager', job: 'Tells apps where the device is, blending GPS satellites, Wi-Fi networks and cell towers, and can alert an app when the device enters or leaves an area.', eg: 'A ride-sharing app asks for a location update every few seconds while you wait for your car.' },
          xmpp: { layer: 'fw', name: 'XMPP service (early Android)', job: 'XMPP (Extensible Messaging and Presence Protocol) is an open standard for instant messaging. Early Android used an XMPP-based service to keep one always-open connection to Google\'s servers, so servers could <b>push</b> messages to apps instead of every app checking for news on its own. It was removed early on and is not part of today\'s Android.', eg: 'A new-message alert arrives even though the chat app is not running. Today\'s push-notification service grew out of this idea.' },
          libs: { layer: 'libs', name: 'System libraries', job: 'Native code written in C and C++ for jobs that must be fast: graphics, media, databases, web rendering and the basic C library. Apps rarely call them directly; they reach them through the framework.', eg: 'Drawing a scrolling list at 60 frames per second relies on the surface manager and OpenGL ES libraries.' },
          surf: { layer: 'libs', name: 'Surface manager', job: 'Each app draws into its own off-screen surface. The surface manager combines the surfaces of every visible app, the status bar and the keyboard into the single image shown on the display.', eg: 'A video playing in a small floating window over your map: two surfaces, combined into one picture.' },
          gl: { layer: 'libs', name: 'OpenGL ES', job: 'OpenGL for Embedded Systems: the standard interface for fast 2D and 3D graphics using the phone\'s graphics processor (GPU).', eg: 'A 3D racing game draws every frame through OpenGL ES (or its newer relative, Vulkan).' },
          media: { layer: 'libs', name: 'Media framework', job: 'Codecs and players for recording and playing audio and video, and for decoding images, in common formats such as MP3, AAC, H.264, JPEG and PNG, using hardware decoders when the chip has them.', eg: 'Your music app hands an MP3 file to the media framework, which decodes it into sound samples.' },
          sqlite: { layer: 'libs', name: 'SQLite', job: '<span class="t">SQLite</span> is a small but complete SQL database engine that runs as a library inside the app\'s own process and stores each database in one ordinary file. No separate database server is needed.', eg: 'Your text messages and contacts are stored in SQLite databases behind their content providers.' },
          webkit: { layer: 'libs', name: 'WebKit browser engine (early Android)', job: 'The engine that turns HTML, CSS and JavaScript into a laid-out page. Early Android built its browser and in-app web views on WebKit. Later versions replaced it with a web view built on Chromium, a descendant of WebKit.', eg: 'A shopping app shows its help pages inside a web view drawn by the browser engine.' },
          libc: { layer: 'libs', name: 'Bionic libc', job: '<span class="t">Bionic libc</span> is Android\'s own standard C library: the functions such as malloc, printf and open that all C code needs. It was written to be small, fast to load into many processes at once, and under a permissive licence.', eg: 'Every native library above it, including SQLite and the media codecs, calls into Bionic.' },
          rt: { layer: 'rt', name: 'Android runtime', job: 'Runs the apps\' code. Apps ship as .dex <b>bytecode</b> (instructions for an imaginary, portable machine), not as machine code for a real processor, so something on the phone must turn it into instructions the processor can execute. Each app runs in its own process with its own runtime instance, so one crashing app cannot take down another.', eg: 'Step 5 compares the two runtimes Android has used: Dalvik and ART.' },
          core: { layer: 'rt', name: 'Core libraries', job: 'Most of the standard Java class library (strings, collections, files, networking, threads), so app code written in Java or Kotlin finds the classes it expects.', eg: 'An app sorts a list with the same collection classes a desktop Java program would use.' },
          art: { layer: 'rt', name: 'ART (formerly the Dalvik VM)', job: 'The engine that executes .dex bytecode. The original <span class="t">Dalvik virtual machine</span> interpreted it and compiled busy parts just in time. Since Android 5.0, <span class="t">ART</span> compiles it to native machine code ahead of time (from 7.0 mixed with JIT).', eg: 'Install an app, and ART prepares its machine code so it starts quickly (step 5).' },
          kernel: { layer: 'kernel', name: 'Linux kernel', job: 'The foundation: the same kernel as desktop and server Linux, with some Android additions. It owns the hardware and provides drivers, memory, process and power management, networking and security. Everything above runs in user mode and must ask the kernel for these services.', eg: 'Android picked Linux for its mature drivers, strong process isolation and large developer community.' },
          drv: { layer: 'kernel', name: 'Device drivers', job: 'Kernel code that operates each piece of hardware: display, camera, Bluetooth, flash storage, USB, keypad, Wi-Fi and audio. Phone makers supply many of these for their own chips.', eg: 'The camera driver programs the image sensor when a photo is taken (step 4 follows that request).' },
          binder: { layer: 'kernel', name: 'Binder IPC driver', job: 'The kernel half of <span class="t">Binder</span>, Android\'s interprocess communication system. Because processes cannot read each other\'s memory, messages between an app and a system service must pass through this driver, which also stamps each message with the sender\'s identity.', eg: 'Every call from an app to a system service crosses this driver.' },
          pwr: { layer: 'kernel', name: 'Power management', job: 'Linux power management plus two Android additions: <b>alarms</b>, which can wake a sleeping device at a set time, and <b>wakelocks</b>, which keep it awake while important work is in progress.', eg: 'Step 7 lets you run the phone for an hour with and without a wakelock.' },
          mem: { layer: 'kernel', name: 'Memory management', job: 'Gives every process its own protected virtual memory. When memory runs short, Android ends background apps the user is least likely to miss, instead of swapping them to slow flash storage.', eg: 'An app you have not opened for hours is quietly ended to make room for the camera.' },
          proc: { layer: 'kernel', name: 'Process management', job: 'Creates processes and threads and schedules them on the processor cores. Every app is a separate Linux process (section 4.7 looks inside).', eg: 'Music keeps playing while you browse because both apps\' threads get turns on the cores.' },
          net: { layer: 'kernel', name: 'Networking', job: 'The full Linux network stack: Wi-Fi and mobile data connections, TCP/IP and sockets, shared by every app.', eg: 'The phone switches from Wi-Fi to mobile data while a download continues.' },
          sec: { layer: 'kernel', name: 'Security', job: 'Linux user IDs and file permissions keep apps apart: each app runs as its own user, so it cannot read another app\'s private files. Extra mandatory access-control rules (SELinux) restrict even system processes.', eg: 'A game cannot read your banking app\'s data, even if both are open.' },
        };
        // geometry: bands [id, x, y, w, h] and tiles [id, x, y, w, h, line1, line2]
        // Wide screens get the classic side-by-side stack; phones get a taller, 3-column version so its text stays readable.
        const NW = ctx.narrow;
        const FW = [['am', 'Activity', 'manager'], ['wm', 'Window', 'manager'], ['cp', 'Content', 'providers'], ['vs', 'View', 'system'], ['nm', 'Notification', 'manager'],
          ['pm', 'Package', 'manager'], ['tm', 'Telephony', 'manager'], ['rm', 'Resource', 'manager'], ['lm', 'Location', 'manager'], ['xmpp', 'XMPP service', 'early Android']];
        const LIBS = [['surf', 'Surface', 'manager'], ['gl', 'OpenGL ES', '3D graphics'], ['media', 'Media', 'framework'], ['sqlite', 'SQLite', 'database'], ['webkit', 'WebKit engine', 'early Android'], ['libc', 'Bionic', 'libc']];
        // tiles that belonged to early Android only; drawn dashed so the classic layout is not mistaken for today's
        const EARLY = new Set(['xmpp', 'webkit']);
        const KERN = [['pwr', 'Power', 'management'], ['mem', 'Memory', 'management'], ['proc', 'Process', 'management'], ['net', 'Networking', 'TCP/IP, Wi-Fi'], ['sec', 'Security', 'user IDs, SELinux']];
        const T = [];
        let BANDS, VH, appPos;
        if (!NW) {
          BANDS = [['apps', 4, 4, 652, 82], ['fw', 4, 94, 652, 134], ['libs', 4, 236, 426, 134], ['rt', 438, 236, 218, 134], ['kernel', 4, 378, 652, 130]];
          VH = 534;
          appPos = (i) => [12 + i * 80, 30, 74, 46];
          FW.forEach(([id, a, b], i) => T.push([id, 12 + (i % 5) * 129, 122 + Math.floor(i / 5) * 52, 120, 46, a, b]));
          LIBS.forEach(([id, a, b], i) => T.push([id, 12 + (i % 3) * 139, 264 + Math.floor(i / 3) * 52, 130, 46, a, b]));
          T.push(['core', 446, 264, 202, 46, 'Core libraries', 'Java class library']);
          T.push(['art', 446, 316, 202, 46, 'ART', '(formerly Dalvik VM)']);
          T.push(['drv', 12, 406, 484, 46, 'Device drivers', 'display · camera · Bluetooth · flash · USB · keypad · Wi-Fi · audio']);
          T.push(['binder', 504, 406, 144, 46, 'Binder', 'IPC driver']);
          KERN.forEach(([id, a, b], i) => T.push([id, 12 + i * 129, 458, 120, 44, a, b]));
        } else {
          const col3 = (i) => 12 + (i % 3) * 115;           // three 106-wide columns inside a 352-wide band
          BANDS = [['apps', 4, 4, 352, 114], ['fw', 4, 126, 352, 230], ['libs', 4, 364, 352, 130], ['rt', 4, 502, 352, 80], ['kernel', 4, 590, 352, 184]];
          VH = 800;
          appPos = (i) => [12 + (i % 4) * 86, 28 + Math.floor(i / 4) * 44, 78, 38];
          FW.forEach(([id, a, b], i) => T.push([id, col3(i), 154 + Math.floor(i / 3) * 50, 106, 44, a, b]));
          LIBS.forEach(([id, a, b], i) => T.push([id, col3(i), 392 + Math.floor(i / 3) * 50, 106, 44, a, b]));
          T.push(['core', 12, 530, 164, 44, 'Core libraries', 'Java class library']);
          T.push(['art', 184, 530, 164, 44, 'ART', '(formerly Dalvik VM)']);
          T.push(['drv', 12, 618, 336, 46, 'Device drivers', 'display · camera · Wi-Fi · audio · USB…']);
          [['binder', 'Binder', 'IPC driver']].concat(KERN).forEach(([id, a, b], i) => T.push([id, col3(i), 672 + Math.floor(i / 3) * 50, 106, 44, a, b]));
        }
        const APPS = ['Home', 'Phone', 'Contacts', 'SMS', 'Email', 'Calendar', 'Maps', 'Browser'];
        const total = Object.keys(P).length;
        const seen = new Set();
        let cur = null;
        const svg = s('svg', { viewBox: `0 0 ${NW ? 360 : 660} ${VH}`, width: '100%', style: { display: 'block' } });
        const info = h('div', { class: 'info grow' });
        const meterI = h('i', { style: { width: '0%' } });
        const count = h('span', { class: 'small b' });
        const hotAttrs = (id) => ({ class: 'hot' + (cur === id ? ' sel' : ''), role: 'button', tabindex: 0, 'aria-label': P[id].name,
          onclick: () => pick(id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); } } });
        function draw() {
          const kids = [];
          BANDS.forEach(([id, x, y, w, hh]) => {
            const c = COL(L[id][2]);
            kids.push(s('g', hotAttrs(id),
              s('rect', { class: 'fr ' + c.band, x, y, width: w, height: hh, rx: 12, 'stroke-width': 2, style: cur === id ? '' : 'stroke-opacity:.55' }),
              s('text', { x: x + 12, y: y + 18, 'font-size': 13, 'font-weight': 800, 'letter-spacing': '.06em', style: `fill:${c.ink}` }, L[id][0].toUpperCase()),
              id === 'rt' ? null : s('text', { x: x + w - 12, y: y + 18, 'font-size': 12.5, 'text-anchor': 'end', class: 's-sub' }, L[id][1]),
              seen.has(id) ? s('text', { x: x + w - 12 - (id === 'rt' ? 0 : L[id][1].length * 6.4 + 10), y: y + 18, 'font-size': 13, 'text-anchor': 'end', style: 'fill:var(--ok)', 'font-weight': 900 }, '✓') : null));
          });
          kids.push(s('text', { x: 8, y: VH - 7, 'font-size': 13, class: 's-sub' }, NW ? 'Classic layout · dashed tiles: early Android only' : 'The classic layout Android was designed with. Dashed tiles: early Android only (later removed or replaced).'));
          APPS.forEach((a, i) => { const [ax, ay, aw, ah] = appPos(i); kids.push(s('g', { style: 'pointer-events:none' },
            s('rect', { x: ax, y: ay, width: aw, height: ah, rx: 9, style: 'fill:var(--panel);stroke:var(--proc)', 'stroke-width': 1.5 }),
            s('text', { x: ax + aw / 2, y: ay + ah / 2 + 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 650 }, a))); });
          T.forEach(([id, x, y, w, hh, a, b]) => {
            const c = COL(id === 'drv' ? 'io' : L[P[id].layer][2]);
            const on = cur === id;
            const wide = id === 'drv';
            kids.push(s('g', hotAttrs(id),
              s('rect', { class: 'fr', x, y, width: w, height: hh, rx: 9, 'stroke-width': 2, 'stroke-dasharray': EARLY.has(id) ? '5 4' : null, style: `fill:${on ? c.bg : 'var(--panel)'};stroke:${c.ink}` }),
              s('text', { x: x + w / 2, y: y + (wide ? 19 : 20), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 750 }, a),
              s('text', { x: x + w / 2, y: y + (wide ? 37 : 37), 'text-anchor': 'middle', 'font-size': 13, class: EARLY.has(id) ? null : 's-sub', style: EARLY.has(id) ? 'fill:var(--warn);font-weight:700;font-style:italic' : null }, b),
              seen.has(id) ? s('g', {}, s('circle', { cx: x + w - 3, cy: y + 3, r: 7.5, style: 'fill:var(--ok);stroke:var(--panel)', 'stroke-width': 1.5 }),
                s('text', { x: x + w - 3, y: y + 7, 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 900, style: 'fill:var(--panel)' }, '✓')) : null));
          });
          svg.replaceChildren(...kids);
        }
        function pick(id) {
          cur = id; seen.add(id);
          const p = P[id], lay = L[p.layer];
          info.innerHTML = '';
          info.append(
            h('h3', { html: p.name }),
            h('div', { class: 'row gap-s' }, h('span', { class: 'chip ' + COL(lay[2]).chip }, lay[0]), h('span', { class: 'chip' }, lay[1])),
            h('p', { html: p.job }),
            h('div', { class: 'eg', html: '<b>Example: </b>' + p.eg }));
          paint();
        }
        function paint() {
          meterI.style.width = (seen.size / total) * 100 + '%';
          count.textContent = `Explored ${seen.size} / ${total} parts`;
          draw();
        }
        info.append(h('h3', {}, 'How to read the stack'),
          h('p', { html: 'Read it from the bottom up. The <b>Linux kernel</b> owns the hardware. Above it sit fast native <b>system libraries</b> written in C/C++ and the <b>Android runtime</b> that runs app code. The <span class="t">application framework</span> packages all of that into a Java/Kotlin API, and the <b>applications</b> at the top are built only from that API.' }),
          h('p', { html: 'Each layer uses the services of the layers beneath it and hides their details from the layers above. An app never talks to the camera chip; it asks the framework, which works its way down.' }),
          h('div', { class: 'callout tip m0', 'data-label': 'Try it', html: 'Click every tile and every layer\'s name bar. Colours: <span class="chip proc">apps</span> <span class="chip accent">framework</span> <span class="chip">libraries</span> <span class="chip cpu">runtime</span> <span class="chip os">kernel</span> <span class="chip io">drivers</span>' }));
        el.append(h('div', { class: 'split r fill' },
          h('div', { style: { display: 'flex', alignItems: 'center' } }, svg),
          h('div', { class: 'card white stack', style: { gap: '10px' } }, info,
            h('div', { style: { borderTop: '1px dashed var(--line-2)', paddingTop: '8px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '4px' } }, count, h('span', { class: 'xs muted' }, 'a ✓ marks parts you have opened')), h('div', { class: 'meter' }, meterI)))));
        paint();
      },
    },

    /* ---------------- 3. Component matcher: click the layer each part lives in ---------------- */
    {
      title: 'Which layer does it live in? Build the stack',
      kind: 'lab',
      render(el, ctx) {
        const { h } = ctx;
        const LAY = [
          { id: 'apps', name: 'Applications', lang: 'Java / Kotlin', c: 'proc', desc: 'the programs the user opens and taps: email, maps, contacts, games' },
          { id: 'fw', name: 'Application framework', lang: 'Java / Kotlin', c: 'accent', desc: 'the services apps call through the Android API: the managers, content providers and view system' },
          { id: 'libs', name: 'System libraries', lang: 'C / C++', c: 'lib', desc: 'fast native code: graphics, media, the database engine, the browser engine and the C library' },
          { id: 'rt', name: 'Android runtime', lang: 'C++ / Java', c: 'cpu', desc: 'the parts that execute app code: ART (formerly Dalvik) and the core Java libraries' },
          { id: 'kernel', name: 'Linux kernel', lang: 'C', c: 'os', desc: 'code running in kernel mode: drivers, memory, processes, power, networking and security' },
        ];
        const ITEMS = [
          { n: 'SQLite database engine', d: 'Stores an app\'s structured data in a single file.', a: 'libs', why: 'SQLite is native C code that runs inside the app\'s own process as a library. Apps usually reach it through framework classes.', hint: 'It is written in C and runs inside the app as a library.' },
          { n: 'Activity manager', d: 'Starts app screens and keeps the back stack.', a: 'fw', why: 'It is a framework service. Every app uses it through the standard Java/Kotlin API.', hint: 'App developers call it through the Android API.' },
          { n: 'Camera driver', d: 'Programs the image-sensor hardware.', a: 'kernel', why: 'Drivers operate hardware directly, so they run inside the Linux kernel in kernel mode.', hint: 'It has to touch the hardware itself.' },
          { n: 'Contacts app', d: 'Lets you browse and edit phone numbers.', a: 'apps', why: 'It is an ordinary application, built from the framework like any app you could install. It shares its data through a content provider.', hint: 'It is something the user opens from the home screen.' },
          { n: 'Turning .dex bytecode into machine code', c: '.dex → machine code', d: 'Makes app code runnable on the processor.', a: 'rt', why: 'That is the runtime\'s job: Dalvik did it while the app ran, ART does it mostly ahead of time.', hint: 'Apps ship as bytecode. Which layer executes it?' },
          { n: 'Notification manager', d: 'Puts alerts in the status bar for any app.', a: 'fw', why: 'It is a framework service with a Java/Kotlin API, so every app posts notifications the same way.', hint: 'Apps call it through the standard API.' },
          { n: 'Wakelocks and alarms', d: 'Keep the device awake, or wake it at a set time.', a: 'kernel', why: 'They are Android\'s additions to Linux power management, built into the kernel. Framework classes are only the doorway to them.', hint: 'Only the layer that controls the hardware can stop the processor from sleeping or wake it up.' },
          { n: 'WebKit browser engine (early Android)', c: 'WebKit engine', d: 'Lays out web pages and runs their scripts.', a: 'libs', why: 'The browser engine is a large native C++ library that the browser app and in-app web views are built on.', hint: 'It is a big piece of native C++ code shared by several apps.' },
          { n: 'Content providers', d: 'Share one app\'s data with other apps.', a: 'fw', why: 'Content providers are a framework component: apps publish and query shared data through the standard API.', hint: 'Apps use it through the Java/Kotlin API.' },
          { n: 'Binder IPC driver', d: 'Carries messages between processes.', a: 'kernel', why: 'Only the kernel can move data between two processes\' protected memory, so the core of Binder is a kernel driver.', hint: 'Two processes cannot see each other\'s memory. Which layer can?' },
          { n: 'Core Java libraries', d: 'Strings, collections, files and threads for app code.', a: 'rt', why: 'The core libraries ship with the Android runtime, so Java and Kotlin code finds the standard classes it expects.', hint: 'They sit next to the engine that runs Java/Kotlin code.' },
          { n: 'Bionic libc', d: 'malloc, printf, open: the basic C functions.', a: 'libs', why: 'Bionic is Android\'s standard C library, the lowest of the native libraries. Every other native library calls it.', hint: 'It is a C library that other native code links against.' },
          { n: 'Maps app', d: 'Shows where you are and plans routes.', a: 'apps', why: 'Maps is an application. It uses the location manager and view system from the framework beneath it.', hint: 'The user taps its icon to open it.' },
        ];
        const colOf = (c) => (c === 'lib' ? 'var(--ink-2)' : `var(--${c})`);
        let order = ITEMS.map((_, i) => i), idx = 0, tries = 0, done = false, placed = [];
        const pos = h('h4', { class: 'm0' });
        const dots = h('div', { class: 'row gap-s' });
        const itemCard = h('div', { class: 'itemcard' });
        const fb = h('div', { class: 'fbbox' });
        const nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => advance() }, 'Next item ▶');
        const again = h('button', { class: 'btn', type: 'button', onclick: () => restart(true) }, 'Shuffle and start over');
        const layBtns = {};
        const chipBox = {};
        LAY.forEach((l) => {
          chipBox[l.id] = h('div', { class: 'laychips' });
          layBtns[l.id] = h('button', { class: 'lay', type: 'button', style: { '--lc': colOf(l.c), background: l.c === 'lib' ? 'var(--panel-2)' : `var(--${l.c}-bg)` }, onclick: () => choose(l.id) },
            h('div', { class: 'layhead' }, h('b', {}, l.name), h('span', { class: 'xs muted' }, l.lang)), chipBox[l.id]);
        });
        const tally = h('div', { class: 'small muted' });
        function paintDots() {
          const fin = placed.filter(Boolean);
          tally.innerHTML = fin.length ? `Placed <b>${fin.length}</b> of ${order.length} · first-try correct: <b style="color:var(--ok)">${fin.filter((p) => p.first).length}</b>` : 'Every wrong click explains what that layer really holds, so a miss still teaches you something.';
          dots.replaceChildren(...order.map((_, k) => {
            const p = placed[k];
            return h('span', { class: 'mdot' + (k === idx && !p ? ' cur' : '') + (p ? (p.first ? ' ok' : ' warn') : '') });
          }));
        }
        function showItem() {
          const it = ITEMS[order[idx]];
          tries = 0; done = false;
          pos.textContent = `Item ${idx + 1} of ${order.length}`;
          itemCard.innerHTML = `<div class="xs muted b" style="letter-spacing:.06em">WHERE DOES THIS LIVE?</div><div class="iname">${it.n}</div><div class="small muted">${it.d}</div>`;
          fb.innerHTML = `<div class="callout m0" data-label="Your move">Click the layer ${ctx.narrow ? 'below' : 'on the right'} where this part belongs. The stack fills up as you go.</div>`;
          nextBtn.disabled = true;
          paintDots();
        }
        function choose(id) {
          if (idx >= order.length) return;
          if (done) { ctx.toast('Press "Next item" to continue.'); return; }
          const it = ITEMS[order[idx]];
          const L = LAY.find((l) => l.id === id), R = LAY.find((l) => l.id === it.a);
          tries++;
          if (id === it.a) {
            done = true;
            placed[idx] = { first: tries === 1 };
            chipBox[id].append(h('span', { class: 'chip fade-in ' + (tries === 1 ? 'ok' : 'warn') }, it.c || it.n));
            fb.innerHTML = `<div class="callout tip m0" data-label="${tries === 1 ? 'Correct, first try' : 'Correct'}"><b>${R.name}.</b> ${it.why}</div>`;
            nextBtn.disabled = false;
            nextBtn.textContent = idx === order.length - 1 ? 'See my result ▶' : 'Next item ▶';
          } else {
            layBtns[id].classList.remove('wrong'); void layBtns[id].offsetWidth; layBtns[id].classList.add('wrong'); ctx.after(900, () => layBtns[id].classList.remove('wrong'));
            fb.innerHTML = `<div class="callout bad m0" data-label="Not the ${L.name.toLowerCase()}">That layer holds ${L.desc}. <b>Hint:</b> ${it.hint}</div>`;
          }
          paintDots();
        }
        function advance() {
          if (!done) return;
          idx++;
          if (idx < order.length) { showItem(); return; }
          const first = placed.filter((p) => p.first).length;
          pos.textContent = 'Stack complete';
          itemCard.innerHTML = `<div class="xs muted b" style="letter-spacing:.06em">YOUR RESULT</div><div class="iname">${first} of ${order.length} on the first try</div><div class="small muted">Green chips were placed first time; amber ones needed another go.</div>`;
          fb.innerHTML = `<div class="callout why m0" data-label="The pattern">Things you <b>open</b> are apps. Things apps <b>call through the API</b> are framework. <b>Native C/C++ helpers</b> are libraries. Whatever <b>executes app code</b> is the runtime. Anything that <b>touches hardware or needs kernel mode</b> is the kernel.</div>`;
          nextBtn.disabled = true; nextBtn.textContent = 'Next item ▶';
          paintDots();
        }
        function restart(shuffle) {
          order = shuffle ? ctx.util.shuffle(ITEMS.map((_, i) => i)) : ITEMS.map((_, i) => i);
          idx = 0; placed = [];
          Object.values(chipBox).forEach((b) => b.replaceChildren());
          showItem();
        }
        const left = h('div', { class: 'stack fill', style: { gap: '12px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, pos, dots),
          itemCard, h('div', { class: 'grow stack', style: { gap: '10px' } }, fb,
          ctx.ui.reveal('Stuck? Show the rule of thumb', '<p class="small m0">Ask: does the user <b>open</b> it (app)? Do apps <b>call it through the Java/Kotlin API</b> (framework)? Is it a <b>native C/C++ helper</b> (library)? Does it <b>execute app code</b> (runtime)? Does it <b>touch hardware or need kernel mode</b> (kernel)?</p>')),
          tally, h('div', { class: 'row' }, nextBtn, again));
        const right = h('div', { class: 'laygrid' + (ctx.narrow ? ' nar' : '') }, layBtns.apps, layBtns.fw, layBtns.libs, layBtns.rt, layBtns.kernel);
        el.append(h('div', { class: 'split l fill' }, left, right));
        restart(false);
      },
    },

    /* ---------------- 4. System architecture: follow a request through Binder, services, HAL, kernel ---------------- */
    {
      title: 'Follow a request: from a tap down to the hardware',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        const COLX = [72, 201, 330, 459, 588];            // centres of the five HAL / kernel / hardware columns
        const SVC = { cam: 94, aud: 245, loc: 418 };      // centres of the three service tiles
        const APPX = { cam: 120, aud: 330, loc: 540 };
        const Y = { app: 92, binder: 108, svc: 204, hal: 296, drv: 374, hw: 452 };   // token sits on each box's top edge so it never hides a label
        const SC = {
          cam: { label: 'Take a photo', short: 'Photo', sname: 'Camera service', app: 'Camera app', api: 'framework: Camera API', col: 0, svc: 'cam', hal: 'Camera HAL', drv: 'Camera driver', hw: 'Image sensor',
            caps: [
              '<b>App.</b> The Camera app\'s code calls the framework: "take a picture with the back camera". The framework class it calls is only a <b>proxy</b> (a stand-in). The real camera code runs in a different process.',
              '<b>Binder.</b> The proxy packs the request into a Binder transaction. The Binder driver in the kernel copies it into the camera service\'s process and stamps it with the caller\'s identity (its Linux user ID).',
              '<b>System service.</b> The camera service (historically part of the media server process) receives the call. It checks that this app was granted the camera permission, then configures the camera.',
              '<b>HAL.</b> The service calls the camera HAL: a standard camera interface that every phone maker implements for its own chip. The service code is the same on every phone.',
              '<b>Kernel.</b> The phone maker\'s HAL module talks to the camera driver in the Linux kernel through ordinary system calls.',
              '<b>Hardware.</b> The driver programs the image sensor, which captures the picture.',
              '<b>Back up.</b> The image data travels back the same way: driver → HAL → camera service.',
              '<b>Done.</b> Binder carries the result back to the app\'s process, which shows the photo. The app never touched the hardware or the driver itself.'] },
          aud: { label: 'Play a song', short: 'Song', sname: 'Audio service', app: 'Music app', api: 'framework: MediaPlayer', col: 1, svc: 'aud', hal: 'Audio HAL', drv: 'Audio driver', hw: 'Speaker',
            caps: [
              '<b>App.</b> The Music app asks the framework\'s media player to play a song file. Again, the framework object in the app is only a proxy.',
              '<b>Binder.</b> The request crosses into the media server process through Binder, with the app\'s identity attached.',
              '<b>System service.</b> The media service decodes the song with the media framework library, and the audio service mixes it with any other sound that is playing, such as a notification ding.',
              '<b>HAL.</b> The mixed sound goes to the audio HAL, the standard audio interface the phone maker implemented for its sound chip.',
              '<b>Kernel.</b> The HAL module hands the sound samples to the audio driver in the kernel.',
              '<b>Hardware.</b> The driver feeds the samples to the sound hardware and you hear the song.',
              '<b>Back up.</b> Status flows back up: the service reports "playing" (and later "finished").',
              '<b>Done.</b> Binder delivers the reply to the app, which updates its play button. Two apps can make sound at once because one service does the mixing.'] },
          loc: { label: 'Find my location', short: 'Location', sname: 'Location service', app: 'Maps app', api: 'framework: LocationManager', col: 2, svc: 'loc', hal: 'GNSS HAL', drv: 'GPS driver', hw: 'GPS chip',
            caps: [
              '<b>App.</b> The Maps app asks the location manager where the device is. The location manager inside the app is a proxy for the real one.',
              '<b>Binder.</b> The request goes through Binder to the system server, the process that hosts most of Android\'s managers.',
              '<b>System service.</b> The location manager service checks that Maps holds a location permission, then switches the GPS on if no other app already has it on.',
              '<b>HAL.</b> The service talks to the GNSS HAL (GNSS covers GPS and other satellite systems), implemented by the chip vendor.',
              '<b>Kernel.</b> The vendor\'s HAL module drives the GPS receiver through its kernel driver.',
              '<b>Hardware.</b> The GPS chip listens to satellites and works out a position.',
              '<b>Back up.</b> The position travels back up to the location service, which can share one reading with every app that asked.',
              '<b>Done.</b> Binder delivers the position to Maps, which moves the blue dot. One GPS chip serves many apps through one service.'] },
        };
        const HALS = ['Camera HAL', 'Audio HAL', 'GNSS HAL', 'Graphics HAL'];
        const DRVS = ['Camera driver', 'Audio driver', 'GPS driver', 'Display driver', 'Binder driver'];
        const HWS = ['Image sensor', 'Speaker', 'GPS chip', 'Display'];
        let sc = 'cam';
        // Layers, bottom to top: back (band backgrounds) → trail (dashed route) → fore (tiles + labels) → token.
        // Tiles sit above the trail, so the route shows as "wires" between boxes and never runs through their text.
        const back = s('g', {}), fore = s('g', {});
        const trail = s('polyline', { fill: 'none', style: 'stroke:var(--accent)', 'stroke-width': 3, 'stroke-dasharray': '6 5', 'stroke-linecap': 'round' });
        const tok = s('g', { class: 'tok' }, s('circle', { r: 12, style: 'fill:var(--accent);stroke:var(--panel)', 'stroke-width': 3 }), s('text', { y: 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 900, style: 'fill:var(--accent-ink)' }, '▼'));
        const NW = ctx.narrow;   // phones get a single-column drawing of just the chosen request, so its text stays readable
        const svg = s('svg', { viewBox: NW ? '0 0 360 426' : '0 0 660 500', width: '100%', style: { display: 'block' } }, back, trail, fore, tok);
        const HALO = { 's-proc': 'var(--proc-bg)', 's-os': 'var(--os-bg)', 's-panel': 'var(--panel-2)', 's-accent': 'var(--accent-bg)' };
        const halo = (cls) => `paint-order:stroke;stroke:${HALO[cls]};stroke-width:5px;stroke-linejoin:round`;
        let B, F;   // arrays being filled for the back and fore layers
        const band = (x, y, w, hh, cls, label, note) => {
          B.push(s('rect', { x, y, width: w, height: hh, rx: 12, class: cls, 'stroke-width': 1.5, style: 'stroke-opacity:.6' }));
          F.push(s('text', { x: x + 12, y: y + 17, 'font-size': 12.5, 'font-weight': 800, 'letter-spacing': '.06em', class: 's-sub', style: halo(cls) }, label));
          if (note) F.push(s('text', { x: x + w - 12, y: y + 17, 'font-size': 12.5, 'text-anchor': 'end', class: 's-sub', style: halo(cls) }, note));
        };
        const binderBar = (x, y, w, hh, on, cx, text) => {
          B.push(s('rect', { x, y, width: w, height: hh, rx: hh / 2, class: 's-accent', 'stroke-width': on ? 3.5 : 1.8 }));
          F.push(s('text', { x: cx, y: y + hh / 2 + 6, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, style: halo('s-accent') }, text));
        };
        const tile = (cx, y, w, hh, l1, l2, stroke, on, dim) => s('g', { opacity: dim ? 0.45 : 1 },
          s('rect', { x: cx - w / 2, y, width: w, height: hh, rx: 9, 'stroke-width': on ? 3.5 : 1.8, style: `fill:${on ? `var(--${stroke}-bg)` : 'var(--panel)'};stroke:var(--${stroke})` }),
          s('text', { x: cx, y: y + (l2 ? hh / 2 - 3 : hh / 2 + 5), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': on ? 800 : 650 }, l1),
          l2 ? s('text', { x: cx, y: y + hh / 2 + 14, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, l2) : null);
        const route = h('div', { class: 'row route' });
        const HOPS = [['app', 'App'], ['binder', 'Binder'], ['svc', 'Service'], ['hal', 'HAL'], ['drv', 'Driver'], ['hw', 'Hardware']];
        function finish(i, nodes) {   // shared: paint the layers, the trail so far and the token
          back.replaceChildren(...B); fore.replaceChildren(...F);
          trail.setAttribute('points', nodes.slice(0, Math.min(i, 5) + 1).map((p) => p.join(',')).join(' '));
          const [tx, ty] = i <= 5 ? nodes[i] : i === 6 ? nodes[2] : nodes[0];
          tok.style.transform = `translate(${tx}px, ${ty}px)`;
          tok.lastChild.textContent = i <= 5 ? '▼' : '▲';
        }
        function draw(i) {
          const c = SC[sc], col = c.col;
          const at = ['app', 'binder', 'svc', 'hal', 'drv', 'hw', 'svc', 'app'][i];
          const reached = i <= 5 ? i : 5;
          const bOn = at === 'binder' || i === 7;
          route.replaceChildren(...HOPS.flatMap(([id, lab], k) => [k ? h('span', { class: 'muted b' }, i >= 6 ? '←' : '→') : null,
            h('span', { class: 'chip ' + (id === at && (i <= 5 || k !== 1) ? 'accent' : k <= reached ? 'ok' : ''), title: [c.app, 'Binder', c.sname, c.hal, c.drv, c.hw][k] }, lab)]).filter(Boolean));
          B = []; F = [];
          if (NW) return drawNarrow(i, c, at, bOn);
          band(4, 6, 652, 94, 's-proc', 'APPLICATIONS + FRAMEWORK', 'each app is its own process');
          Object.keys(SC).forEach((k) => {
            const on = k === sc && at === 'app';
            F.push(s('g', { opacity: k === sc ? 1 : 0.4 },
              s('rect', { x: APPX[k] - 98, y: 30, width: 196, height: 62, rx: 10, 'stroke-width': on ? 3.5 : 1.8, style: `fill:${on ? 'var(--proc-bg)' : 'var(--panel)'};stroke:var(--proc)` }),
              s('text', { x: APPX[k], y: 55, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, SC[k].app),
              s('text', { x: APPX[k], y: 77, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, SC[k].api)));
          });
          binderBar(4, 108, 652, 34, bOn, 330, 'BINDER IPC: the main door between processes, carried by the Binder driver in the kernel');
          band(4, 150, 652, 112, 's-os', 'ANDROID SYSTEM SERVICES', 'separate, trusted processes');
          B.push(s('rect', { x: 12, y: 172, width: 312, height: 82, rx: 10, class: 's-panel', 'stroke-width': 1.5 }), s('rect', { x: 336, y: 172, width: 312, height: 82, rx: 10, class: 's-panel', 'stroke-width': 1.5 }));
          F.push(s('text', { x: 22, y: 189, 'font-size': 13, 'font-weight': 800, style: halo('s-panel') }, 'Media server'), s('text', { x: 346, y: 189, 'font-size': 13, 'font-weight': 800, style: halo('s-panel') }, 'System server'));
          const svcOn = at === 'svc';
          F.push(tile(SVC.cam, 204, 144, 44, 'Camera service', null, 'os', svcOn && sc === 'cam', sc !== 'cam'),
            tile(SVC.aud, 204, 142, 44, 'Audio + media', null, 'os', svcOn && sc === 'aud', sc !== 'aud'),
            tile(SVC.loc, 204, 144, 44, 'Location service', null, 'os', svcOn && sc === 'loc', sc !== 'loc'),
            tile(569, 204, 142, 44, 'Activity, window,', 'power, package…', 'os', false, true));
          band(4, 272, 652, 70, 's-panel', 'HARDWARE ABSTRACTION LAYER (HAL)', 'written by the chip or phone maker');
          HALS.forEach((n, k) => F.push(tile(COLX[k], 296, 120, 38, n, null, 'accent', at === 'hal' && k === col, k !== col)));
          band(4, 350, 652, 70, 's-os', 'LINUX KERNEL', 'kernel mode');
          DRVS.forEach((n, k) => F.push(tile(COLX[k], 374, 120, 38, n, null, k === 4 ? 'accent' : 'io', (at === 'drv' && k === col) || (k === 4 && bOn), k !== col && !(k === 4 && bOn))));
          band(4, 428, 652, 68, 's-panel', 'HARDWARE', null);
          HWS.forEach((n, k) => F.push(tile(COLX[k], 452, 120, 38, n, null, 'io', at === 'hw' && k === col, k !== col)));
          // column 5 holds the Binder driver, which is pure software: it has no HAL above it and no device below it
          F.push(s('text', { x: COLX[4], y: 468, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'Binder needs no'),
            s('text', { x: COLX[4], y: 484, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'HAL and no device'));
          finish(i, [[APPX[sc], Y.app], [APPX[sc], Y.binder], [SVC[c.svc], Y.svc], [COLX[col], Y.hal], [COLX[col], Y.drv], [COLX[col], Y.hw]]);
          return c.caps[i];
        }
        function drawNarrow(i, c, at, bOn) {   // phone layout: one column per tier for the chosen request only
          const CX = 150, BX = 305;         // main chain down the left; the Binder driver sits at the right of the kernel tier
          const PROC = { cam: 'media server', aud: 'media server', loc: 'system server' }[sc];
          band(4, 4, 352, 74, 's-proc', 'APP + FRAMEWORK', 'own process');
          F.push(tile(CX, 26, 210, 46, c.app, c.api, 'proc', at === 'app', false));
          binderBar(4, 86, 352, 32, bOn, 200, 'BINDER IPC (via the kernel)');
          band(4, 126, 352, 74, 's-os', 'SYSTEM SERVICE', 'in the ' + PROC);
          F.push(tile(CX, 148, 210, 46, c.sname, null, 'os', at === 'svc', false));
          band(4, 208, 352, 66, 's-panel', 'HAL', 'vendor-written');
          F.push(tile(CX, 230, 210, 38, c.hal, null, 'accent', at === 'hal', false));
          band(4, 282, 352, 66, 's-os', 'LINUX KERNEL', null);
          F.push(tile(CX, 304, 210, 38, c.drv, null, 'io', at === 'drv', false), tile(BX, 304, 90, 38, 'Binder drv', null, 'accent', bOn, !bOn));
          band(4, 356, 352, 66, 's-panel', 'HARDWARE', null);
          F.push(tile(CX, 378, 210, 38, c.hw, null, 'io', at === 'hw', false));
          finish(i, [[CX, 72], [CX, 86], [CX, 148], [CX, 230], [CX, 304], [CX, 378]]);
          return c.caps[i];
        }
        const player = ctx.ui.player({ count: 8, render: draw, interval: 2300, speed: false });
        const seg = ctx.ui.seg(Object.keys(SC).map((k) => ({ value: k, label: SC[k].short })), sc, (v) => { sc = v; player.reset(); });
        const right = h('div', { class: 'stack', style: { gap: '10px' } },
          h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Pick a request to follow'), seg),
          player.el,
          h('div', { class: 'card tight' }, h('h4', {}, 'Route · green = passed · purple = here now'), route),
          h('div', { class: 'callout why m0 small', 'data-label': 'Why this design?', html: '<b>Safety:</b> apps never touch hardware. Every request passes one checkable door, <span class="t" data-t="Binder">Binder</span>, into a trusted <span class="t" data-t="Android system services">system service</span> that checks permissions and shares each device among apps.<br><b>Portability:</b> each phone maker writes modules for the standard <span class="t" data-t="Android HAL">HAL</span> interfaces, so the services above are identical on every phone.' }));
        el.append(h('div', { class: 'split r fill' }, h('div', { style: { display: 'flex', alignItems: 'center' } }, svg), right));
      },
    },

    /* ---------------- 5. Dalvik JIT vs ART AOT: when does bytecode become machine code? ---------------- */
    {
      title: 'Dalvik vs ART: when does app code become machine code?',
      kind: 'compare',
      render(el, ctx) {
        const { h, s } = ctx;
        // Illustrative work model (processor work done ON BATTERY, arbitrary units):
        //   Dalvik:  install 1, every launch 5 (interpret + JIT again; JIT results are lost when the process ends)
        //   ART AOT: install 12 (compile everything), every launch 1 (just run machine code)
        //   Hybrid:  install 1, launches 1-3 cost 3 (ART's faster interpreter + JIT, while recording a profile), then the
        //            hot code is compiled while the phone charges (not on battery); later launches cost 1.5 because the
        //            rarely used code that was not compiled still runs in the interpreter
        const RT = {
          dalvik: { name: 'Dalvik VM', short: 'Dalvik', era: 'Android 1.0 – 4.4', col: 'var(--warn)', work: (n) => 1 + 5 * n,
            install: 'Only checks and lightly optimizes the .dex file, so installs are quick.',
            launch: 'Interprets the bytecode; from Android 2.2 a <span class="t" data-t="Just-in-time compilation">just-in-time (JIT)</span> compiler turns busy code into machine code. That work is lost when the app exits, so it is redone every launch.' },
          aot: { name: 'ART, ahead of time', short: 'ART AOT', era: 'Android 5.0 – 6.0', col: 'var(--cpu)', work: (n) => 12 + n,
            install: 'The phone compiles the whole app into native machine code and stores it (<span class="t" data-t="Ahead-of-time compilation">ahead of time, AOT</span>). Installs are slow and use extra storage.',
            launch: 'Runs the stored machine code at once; nothing is left to translate. But every OS update meant recompiling every app (a long "Optimizing apps" screen).' },
          hyb: { name: 'ART, hybrid', short: 'ART hybrid', era: 'Android 7.0 and later', col: 'var(--accent)', work: (n) => 1 + 3 * Math.min(n, 3) + 1.5 * Math.max(0, n - 3),
            install: 'Compiles little or nothing, so installs are quick and storage stays modest.',
            launch: 'Early launches run on ART\'s faster interpreter and JIT while it records which code is hot (a profile). While the phone idles on the charger, that hot code is compiled ahead of time.' },
        };
        const ROWS = [
          ['Install time', { dalvik: ['short', 'ok'], aot: ['long', 'bad'], hyb: ['short', 'ok'] }],
          ['Storage for code', { dalvik: ['small', 'ok'], aot: ['large', 'bad'], hyb: ['medium', 'warn'] }],
          ['Launch speed', { dalvik: ['slower', 'bad'], aot: ['fast', 'ok'], hyb: ['fast once warm', 'ok'] }],
          ['Battery per launch', { dalvik: ['higher', 'bad'], aot: ['low', 'ok'], hyb: ['low once warm', 'ok'] }],
          ['After an OS update', { dalvik: ['quick', 'ok'], aot: ['recompile all', 'bad'], hyb: ['quick', 'ok'] }],
        ];
        let sel = 'aot', n = 10;
        const PIPE = [['Java or Kotlin source', 'proc'], ['compiler', null], ['.class bytecode', ''], ['dex tool', null], ['classes.dex in the app package', 'accent'], ['install', null], ['<span>machine code… but <i>when?</i></span>', 'cpu']];
        const pipe = h('div', { class: 'pipe' + (ctx.narrow ? ' nar' : '') }, ...PIPE.map(([a, c]) => c === null
          ? h('div', { class: 'pipe-arrow' }, h('span', { class: 'xs muted b' }, a), h('span', { class: 'b', style: { color: 'var(--chc)', fontSize: '18px' } }, '→'))
          : h('div', { class: 'box small ' + c, html: a })));
        const what = h('div', { class: 'card tight stack', style: { gap: '4px', flex: 'none' } });
        const tbl = h('table', { class: 'tbl compact rt-tbl', style: { flex: 'none' } });
        function paintLeft() {
          const r = RT[sel];
          what.innerHTML = `<div class="row" style="justify-content:space-between"><b style="color:${r.col}">${r.name}</b><span class="xs muted b">${r.era}</span></div>
            <div class="small"><b>At install:</b> ${r.install}</div><div class="small"><b>At each launch:</b> ${r.launch}</div>`;
          tbl.innerHTML = '<tr><th></th>' + Object.keys(RT).map((k) => `<th class="${k === sel ? 'col-on' : ''}">${RT[k].short}</th>`).join('') + '</tr>' +
            ROWS.map(([lab, v]) => `<tr><td class="b">${lab}</td>` + Object.keys(RT).map((k) => `<td class="${k === sel ? 'col-on' : ''}"><span class="chip ${v[k][1]}">${v[k][0]}</span></td>`).join('') + '</tr>').join('');
        }
        // chart: cumulative work on battery vs launches
        const NW = ctx.narrow;   // phones get a narrower drawing so the axis labels stay readable
        const CW = NW ? 340 : 540, CH = 238;
        const X0 = NW ? 36 : 44, X1 = CW - 14, Y0 = 200, Y1 = 12, NMAX = 30, WMAX = 160;
        const px = (k) => X0 + (k * (X1 - X0)) / NMAX, py = (w) => Y0 - (w * (Y0 - Y1)) / WMAX;
        const chart = s('svg', { viewBox: `0 0 ${CW} ${CH}`, width: '100%', style: { display: 'block', flex: 'none' } });
        const readout = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' } });
        const verdict = h('p', { class: 'small m0' });
        function drawChart() {
          const kids = [];
          for (let w = 0; w <= WMAX; w += 40) kids.push(s('line', { x1: X0, x2: X1, y1: py(w), y2: py(w), class: 's-muted', 'stroke-width': 1 }), s('text', { x: X0 - 8, y: py(w) + 4, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, String(w)));
          for (let k = 0; k <= NMAX; k += 5) kids.push(s('text', { x: px(k), y: Y0 + 17, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(k)));
          kids.push(s('text', { x: (X0 + X1) / 2, y: CH - 3, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'times the app has been opened →'));
          kids.push(s('line', { x1: px(n), x2: px(n), y1: Y1 - 4, y2: Y0, style: 'stroke:var(--ink-2)', 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }));
          const order = Object.keys(RT).filter((k) => k !== sel).concat(sel);
          order.forEach((k) => {
            const r = RT[k], on = k === sel;
            const pts = ctx.util.range(NMAX + 1).map((i) => `${px(i)},${py(r.work(i))}`).join(' ');
            kids.push(s('polyline', { points: pts, fill: 'none', style: `stroke:${r.col}`, 'stroke-width': on ? 4 : 2.2, opacity: on ? 1 : 0.5, 'stroke-linejoin': 'round' }));
            kids.push(s('circle', { cx: px(n), cy: py(r.work(n)), r: on ? 6.5 : 4.5, style: `fill:${r.col};stroke:var(--panel)`, 'stroke-width': 2 }));
          });
          Object.keys(RT).forEach((k, i) => {
            const r = RT[k];
            kids.push(s('g', { opacity: k === sel ? 1 : 0.7 }, s('rect', { x: X0 + 12, y: 16 + i * 21, width: 22, height: 5, rx: 2, style: `fill:${r.col}` }),
              s('text', { x: X0 + 42, y: 23 + i * 21, 'font-size': 14, 'font-weight': k === sel ? 800 : 600, style: 'paint-order:stroke;stroke:var(--panel);stroke-width:5px;stroke-linejoin:round' }, r.name)));
          });
          kids.push(s('line', { x1: px(3), x2: px(3), y1: py(RT.aot.work(3)) - 6, y2: py(84), class: 's-line', 'stroke-width': 1.2 }),
            s('text', { x: px(3) - 6, y: py(90), 'font-size': 13, class: 's-sub', style: 'paint-order:stroke;stroke:var(--panel);stroke-width:5px;stroke-linejoin:round' }, NW ? 'launch 3: AOT pays off' : 'launch 3: AOT has repaid its install cost'));
          chart.replaceChildren(...kids);
          readout.replaceChildren(...Object.keys(RT).map((k) => h('div', { class: 'kpi' + (k === sel ? ' on' : ''), style: { '--kc': RT[k].col } },
            h('span', { class: 'xs b muted' }, RT[k].name), h('span', { class: 'kv' }, ctx.util.fmt(RT[k].work(n), RT[k].work(n) % 1 ? 1 : 0)), h('span', { class: 'xs muted' }, 'units on battery'))));
          const d = RT.dalvik.work(n), a = RT.aot.work(n), y = RT.hyb.work(n);
          const p1 = n === 0 ? 'Just installed: ART AOT has already spent 12 units compiling; the others spent 1.'
            : n < 3 ? `After ${n} launch${n > 1 ? 'es' : ''}, Dalvik has still done less work (${d}) than pure AOT (${a}): the big install cost has not been repaid yet.`
              : `After ${n} launches, AOT has done ${d - a} units less work than Dalvik, and the gap grows by 4 units every launch.`;
          const p2 = n === 0 ? '' : n < 13 ? ` Hybrid (${ctx.util.fmt(y, y % 1 ? 1 : 0)}) is lowest so far: quick install, then compiled while charging.`
            : n === 13 ? ' Hybrid and pure AOT are now level.' : ' Pure AOT now edges ahead of hybrid (it compiled everything), but hybrid kept installs fast and storage small.';
          verdict.innerHTML = p1 + p2;
        }
        const seg = ctx.ui.seg([{ value: 'dalvik', label: 'Dalvik VM' }, { value: 'aot', label: 'ART AOT' }, { value: 'hyb', label: 'ART hybrid' }], sel, (v) => { sel = v; paintLeft(); drawChart(); });
        const slider = ctx.ui.slider({ label: 'Times opened', min: 0, max: NMAX, value: n, onInput: (v) => { n = v; drawChart(); } });
        el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
          pipe,
          h('div', { class: 'split grow' },
            h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Pick a runtime'), seg), what, tbl,
              h('p', { class: 'small m0', html: '<b>Bytecode</b> (the <span class="t" data-t="Dalvik executable">.dex</span> file) is portable code no processor can run directly. An <b>interpreter</b> performs it step by step on every run (slow); a <b>compiler</b> turns it into machine code once. Dalvik and ART differ only in <b>when</b> they compile.' })),
            h('div', { class: 'card white stack', style: { gap: '8px' } },
              h('h4', { class: 'm0' }, 'Processor work on battery (illustrative units)'), chart, slider, readout, verdict))));
        paintLeft(); drawChart();
      },
    },

    /* ---------------- 6. Activities and the back stack: a working phone ---------------- */
    {
      title: 'Activities and the back stack: drive the phone',
      kind: 'explore',
      render(el, ctx) {
        const { h } = ctx;
        const MSG = [
          { from: 'Prof. Diaz', subj: 'Lab moved to Friday', body: 'Hi all, this week\'s OS lab moves to Friday at 10:00 in room 214. Bring a charged laptop.' },
          { from: 'Campus IT', subj: 'Password expires soon', body: 'Your campus password expires in 5 days. Change it from the student portal.' },
          { from: 'Sam', subj: 'Photos from the hike', body: 'Great hike on Saturday! Send me your photos when you get a chance.' },
        ];
        const ACT = { inbox: ['Inbox', 'Email'], read: ['Read message', 'Email'], compose: ['Compose', 'Email'], picker: ['Pick a photo', 'Gallery'] };
        const APPC = { Email: 'proc', Gallery: 'accent' };
        let stack = [], home = false, log = [];
        const screen = h('div', { class: 'ph-screen' });
        const stackEl = h('div', { class: 'bs-stack' });
        const logEl = h('div', { class: 'log bs-log' });
        const depth = h('span', { class: 'chip accent' });
        const say = (m) => { log.push(m); if (log.length > 40) log.shift(); };
        function push(id, data, why) { stack.push({ id, data: data || {} }); home = false; say(`<b>push</b> ${ACT[id][0]} <span class="muted">(${ACT[id][1]})</span>: ${why}`); paint(); }
        function pop(why) {
          const top = stack.pop();
          say(`<b>pop</b> ${ACT[top.id][0]}: ${why}`);
          if (!stack.length) { home = true; say('Back stack empty, so the <b>home screen</b> shows.'); }
          paint();
          return top;
        }
        function back() {
          if (home) { ctx.toast('Already on the home screen.'); return; }
          if (!stack.length) return;
          pop('you pressed Back');
        }
        function goHome() {
          if (home) return;
          home = true;
          say('<b>Home</b>: the Email task moves to the background. Its back stack is <b>kept</b>.');
          paint();
        }
        function openEmail() {
          if (stack.length) { home = false; say(`Email icon: the task returns with its stack intact; <b>${ACT[stack[stack.length - 1].id][0]}</b> is on screen again.`); paint(); }
          else push('inbox', null, 'launching Email starts its first activity');
        }
        const btn = (label, fn, cls) => h('button', { class: 'btn sm ' + (cls || ''), type: 'button', onclick: fn }, label);
        function drawScreen() {
          screen.innerHTML = '';
          if (home) {
            const icons = [['Email', 'proc', openEmail], ['Gallery', 'accent', null], ['Maps', 'mem', null], ['Music', 'io', null], ['Phone', 'ok', null], ['Camera', 'cpu', null]];
            screen.append(h('div', { class: 'ph-bar home' }, 'Home screen'),
              h('div', { class: 'ph-home' }, ...icons.map(([n, c, fn]) => h('button', { class: 'ph-icon', type: 'button', disabled: !fn, onclick: fn || null },
                h('span', { class: 'ph-ico', style: { background: `var(--${c})` } }, n[0]), h('span', { class: 'xs' }, n)))),
              h('p', { class: 'xs muted center m0' }, stack.length ? 'Email is still in the background. Tap it.' : 'Tap Email to launch it.'));
            return;
          }
          const top = stack[stack.length - 1];
          const [title, app] = ACT[top.id];
          const bar = h('div', { class: 'ph-bar', style: { background: `var(--${APPC[app]}-bg)`, color: `var(--${APPC[app]})` } }, h('b', {}, title), h('span', { class: 'xs' }, app + ' app'));
          const body = h('div', { class: 'ph-body' });
          if (top.id === 'inbox') {
            MSG.forEach((m, i) => body.append(h('button', { class: 'ph-msg', type: 'button', onclick: () => push('read', { m: i }, 'you opened a message') }, h('b', {}, m.from), h('span', {}, m.subj))));
            body.append(h('div', { class: 'grow' }), btn('+ Compose', () => push('compose', { reply: null }, 'you tapped Compose'), 'primary'));
          } else if (top.id === 'read') {
            const m = MSG[top.data.m];
            body.append(h('div', { class: 'xs muted' }, 'From ' + m.from), h('b', {}, m.subj), h('p', { class: 'small m0' }, m.body), h('div', { class: 'grow' }),
              btn('↩ Reply', () => push('compose', { reply: top.data.m }, 'you tapped Reply'), 'primary'));
          } else if (top.id === 'compose') {
            const r = top.data.reply;
            body.append(h('div', { class: 'ph-field' }, 'To: ' + (r == null ? '' : MSG[r].from)), h('div', { class: 'ph-field' }, 'Subject: ' + (r == null ? '' : 'Re: ' + MSG[r].subj)),
              h('div', { class: 'ph-field grow' }, r == null ? 'Write your message…' : 'Thanks, see you Friday!'),
              h('div', { class: 'xs b', style: { color: top.data.photos ? 'var(--ok)' : 'var(--muted)' } }, top.data.photos ? `✓ ${top.data.photos} photo${top.data.photos > 1 ? 's' : ''} attached` : 'No attachments'),
              h('div', { class: 'row gap-s' }, btn('Attach photo', () => push('picker', null, 'Compose asked the Gallery app for a photo')), btn('Send', () => { pop('Compose finishes itself after sending'); ctx.toast('Message sent'); }, 'primary')));
          } else if (top.id === 'picker') {
            body.append(h('p', { class: 'xs muted m0' }, 'This screen belongs to a different app, yet it sits on Email\'s back stack.'),
              h('div', { class: 'ph-grid' }, ...['cpu', 'mem', 'io', 'os', 'proc', 'thread'].map((c, i) => h('button', { class: 'ph-photo', type: 'button', 'aria-label': 'Photo ' + (i + 1), style: { background: `var(--${c})` },
                onclick: () => { pop('the picker finishes and returns the chosen photo'); const t = stack[stack.length - 1]; if (t && t.id === 'compose') { t.data.photos = (t.data.photos || 0) + 1; paint(); } } }))));
          }
          screen.append(bar, body);
        }
        function paint() {
          drawScreen();
          depth.textContent = `depth ${stack.length}`;
          stackEl.replaceChildren(...(stack.length ? stack.slice().reverse().map((a, k) => {
            const [title, app] = ACT[a.id];
            const top = k === 0;
            return h('div', { class: 'bs-card' + (top && !home ? ' top fade-in' : ''), style: { '--ac': `var(--${APPC[app]})`, '--acb': `var(--${APPC[app]}-bg)` } },
              h('div', {}, h('b', {}, title), ' ', h('span', { class: 'xs muted' }, app + ' app')),
              h('span', { class: 'xs b', style: { color: top && !home ? 'var(--ok)' : 'var(--muted)' } }, top ? (home ? 'top, in background' : '▶ on screen') : 'stopped, waiting'));
          }) : [h('div', { class: 'bs-empty small muted' }, 'Empty: no activities in this task.')]));
          logEl.innerHTML = log.map((l) => `<div>${l}</div>`).join('');
          logEl.scrollTop = logEl.scrollHeight;
        }
        const phone = h('div', { class: 'phone' }, h('div', { class: 'ph-status' }, h('span', {}, '9:41'), h('span', {}, '▮▮▮ 82%')), screen,
          h('div', { class: 'ph-nav' }, h('button', { type: 'button', class: 'ph-navb', 'aria-label': 'Back', onclick: back }, '◁ Back'), h('button', { type: 'button', class: 'ph-navb', 'aria-label': 'Home', onclick: goHome }, '○ Home')));
        const left = h('div', { class: 'stack', style: { gap: '10px' } },
          h('p', { class: 'm0', html: 'An <span class="t">activity</span> is one screen of an app with one focused job. An email app might have three: the inbox, a message reader and a compose screen.' }),
          h('p', { class: 'm0', html: 'The framework\'s <span class="t">activity manager</span> keeps the activities you open for one job (a <b>task</b>) in a <span class="t">back stack</span>. Starting one <b>pushes</b> it on top; <b>Back</b> pops the top one and the screen beneath returns.' }),
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'An activity is not an app or a process. One app has several activities, and one back stack can hold screens from <b>different</b> apps: attach a photo and see.' }),
          h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'A phone shows one screen at a time. Because the OS, not each app, keeps this history, Back works the same way everywhere, even across apps. (Section 4.7 shows what happens to stopped activities.)' }));
        const right = h('div', { class: 'stack', style: { gap: '8px', minHeight: 0 } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Back stack (top first)'), depth),
          stackEl, h('h4', { class: 'm0' }, 'What just happened'), logEl,
          h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'Open the first message → <b>Reply</b> → <b>Attach photo</b>. Four activities from two apps are now stacked. Press <b>Back</b> twice and count what is left. Then press <b>Home</b> and tap Email again.' }));
        el.append(h('div', { class: 'act-grid fill' + (ctx.narrow ? ' nar' : '') }, left, h('div', { style: { display: 'grid', placeItems: 'center' } }, phone), right));
        push('inbox', null, 'you launched Email, which starts its first activity');
      },
    },

    /* ---------------- 7. Power lab: alarms and wakelocks over one hour ---------------- */
    {
      title: 'Power lab: sleep, alarms and wakelocks',
      kind: 'lab',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h, s } = ctx;
        // One simulated hour, minute by minute. At 0:00 you start downloading an album in a music app and put the
        // phone down. The screen times out after 1 minute. The download needs 10 minutes of awake time.
        // Illustrative drain (% of battery per minute): asleep 0.01; awake processor 0.10; radio downloading +0.15;
        // screen dim +0.20; screen bright +0.50; keyboard light +0.05.
        const TIMEOUT = 1, NEED = 10, ALARM_AT = 45, MIN = 60;
        const LOCKS = {
          none: { label: 'None', desc: 'The app holds no wakelock.' },
          partial: { label: 'Partial', desc: 'Processor on; screen and keyboard light may turn off.' },
          dim: { label: 'Screen dim', desc: 'Processor on; screen kept on but dimmed.' },
          bright: { label: 'Screen bright', desc: 'Processor on; screen kept at full brightness.' },
          full: { label: 'Full', desc: 'Processor on; screen bright; keyboard light on.' },
        };
        let lock = 'partial', forget = false, alarm = true, t = 0, timer = null;
        function simulate(o) {   // o = { lock, forget }; the alarm setting is shared
          const rows = []; let done = 0, finish = null, used = 0;
          const lk = o.lock;
          for (let m = 0; m < MIN; m++) {
            const held = lk !== 'none' && (o.forget || finish === null);
            const alarmNow = alarm && m === ALARM_AT;
            let screen = 'off';
            if (m < TIMEOUT || alarmNow) screen = 'bright';
            else if (held && (lk === 'bright' || lk === 'full')) screen = 'bright';
            else if (held && lk === 'dim') screen = 'dim';
            const kbd = held && lk === 'full';
            const awake = screen !== 'off' || held;
            const dl = awake && finish === null;
            if (dl) { done++; if (done === NEED) finish = m + 1; }
            const drain = (awake ? 0.10 : 0.01) + (dl ? 0.15 : 0) + (screen === 'bright' ? 0.5 : screen === 'dim' ? 0.2 : 0) + (kbd ? 0.05 : 0);
            used += drain;
            rows.push({ m, screen, awake, held, kbd, dl, alarmNow, done, used });
          }
          return { rows, finish, used };
        }
        const mmss = (m) => `0:${String(m).padStart(2, '0')}`;
        const wlTable = `<table class="tbl compact wl-tbl"><tr><th>Type</th><th>Processor</th><th>Screen</th><th>Keyboard</th></tr>
          <tr><td class="b">Partial</td><td>on</td><td>off</td><td>off</td></tr>
          <tr><td class="b">Screen dim</td><td>on</td><td>dim</td><td>off</td></tr>
          <tr><td class="b">Screen bright</td><td>on</td><td>bright</td><td>off</td></tr>
          <tr><td class="b">Full</td><td>on</td><td>bright</td><td>bright</td></tr></table>`;
        const left = h('div', { class: 'stack', style: { gap: '9px' } },
          h('p', { class: 'small m0', html: 'Asleep, a phone\'s screen is off and its processor suspended, drawing almost nothing. Goal: sleep as much as possible <b>without missing work</b>. Android adds two features to Linux:' }),
          h('div', { class: 'card tight small', html: '<b style="color:var(--intr)">Alarms.</b> An app asks the AlarmManager for work at a set time. The kernel sets the <span class="t" data-t="Alarm">alarm</span> in a hardware timer that keeps running in sleep, so it can <b>wake</b> the device.' }),
          h('div', { class: 'card tight small stack', style: { gap: '6px' }, html: '<div><b style="color:var(--os)">Wakelocks.</b> An app that must keep working holds a <span class="t">wakelock</span>, requested from the framework\'s power manager; the phone may sleep only when <b>no</b> wakelock is held. Four classic types:</div>' + wlTable }),
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Forgetting to release a wakelock keeps the phone awake for nothing: a classic battery-drain bug.' }));
        // ---- timeline drawing
        const NW = ctx.narrow, VW = NW ? 400 : 712;   // phones get a narrower drawing so its text stays readable
        const X0 = NW ? 76 : 100, X1 = VW - 12, PX = (X1 - X0) / MIN;
        const RY = { screen: 6, cpu: 36, lock: 66, dl: 96 }, RH = 22, BT = 132, BB = 232;
        const by = (b) => BB - ((b - 50) / 50) * (BB - BT);
        const svg = s('svg', { viewBox: `0 0 ${VW} 258`, width: '100%', style: { display: 'block' } });
        function segs(rows, key) {   // merge consecutive minutes with the same value
          const out = []; rows.forEach((r) => { const v = key(r); const last = out[out.length - 1]; if (last && last.v === v) last.b = r.m + 1; else out.push({ v, a: r.m, b: r.m + 1 }); });
          return out;
        }
        function bar(y, sg, style, text) {
          return sg.map((g) => { const x = X0 + g.a * PX, w = (g.b - g.a) * PX; const st = style(g.v); const tx = text(g.v);
            if (!st) return null;
            return s('g', {}, s('rect', { x, y, width: w, height: RH, rx: 3, style: st }), tx && w > tx.length * 7.5 + 8 ? s('text', { x: x + w / 2, y: y + 15.5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, tx) : null); }).filter(Boolean);
        }
        function drawSvg(sim) {
          const k = [];
          [['Screen', RY.screen], ['Processor', RY.cpu], ['Wakelock', RY.lock], ['Download', RY.dl]].forEach(([l, y]) => {
            k.push(s('text', { x: 0, y: y + 16, 'font-size': 13.5, 'font-weight': 700 }, l), s('rect', { x: X0, y, width: X1 - X0, height: RH, rx: 4, style: 'fill:var(--panel-3)' }));
          });
          k.push(...bar(RY.screen, segs(sim.rows, (r) => r.screen), (v) => (v === 'bright' ? 'fill:var(--hl);stroke:var(--warn)' : v === 'dim' ? 'fill:color-mix(in srgb, var(--hl) 40%, var(--panel-3));stroke:var(--warn);stroke-dasharray:4 3' : ''), (v) => (v === 'off' ? '' : v)));
          k.push(...bar(RY.cpu, segs(sim.rows, (r) => r.awake), (v) => (v ? 'fill:var(--cpu-bg);stroke:var(--cpu)' : ''), (v) => (v ? 'awake' : '')));
          k.push(...bar(RY.lock, segs(sim.rows, (r) => r.held), (v) => (v ? 'fill:var(--os-bg);stroke:var(--os)' : ''), (v) => (v ? 'held' : '')));
          k.push(...bar(RY.dl, segs(sim.rows, (r) => r.dl), (v) => (v ? 'fill:var(--io-bg);stroke:var(--io)' : ''), (v) => (v ? 'downloading' : '')));
          if (!sim.rows[MIN - 1].awake) k.push(s('text', { x: X1 - 6, y: RY.cpu + 15.5, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'asleep'));
          if (!sim.rows[MIN - 1].held) k.push(s('text', { x: X1 - 6, y: RY.lock + 15.5, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'none held'));
          const pct = Math.round((sim.rows[MIN - 1].done / NEED) * 100);
          k.push(s('text', { x: X1 - 6, y: RY.dl + 15.5, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 800, style: `fill:var(--${pct === 100 ? 'ok' : 'bad'})` }, NW ? pct + '%' : pct + '% by 1:00'));
          // battery chart
          k.push(s('text', { x: 0, y: NW ? by(62.5) + 5 : (BT + BB) / 2 + 5, 'font-size': 13.5, 'font-weight': 700 }, 'Battery'));   // on phones, keep clear of the 75% tick label
          [100, 75, 50].forEach((b) => k.push(s('line', { x1: X0, x2: X1, y1: by(b), y2: by(b), class: 's-muted', 'stroke-width': 1 }), s('text', { x: X0 - 6, y: by(b) + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, b + '%')));
          const pts = [`${X0},${by(100)}`].concat(sim.rows.map((r) => `${X0 + (r.m + 1) * PX},${by(100 - r.used)}`));
          k.push(s('polyline', { points: pts.join(' '), fill: 'none', style: 'stroke:var(--ok)', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
          for (let m = 0; m <= MIN; m += NW ? 20 : 10) k.push(s('text', { x: X0 + m * PX, y: 252, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, m === 60 ? '1:00' : mmss(m)));
          if (alarm) k.push(s('line', { x1: X0 + ALARM_AT * PX, x2: X0 + ALARM_AT * PX, y1: 2, y2: BB, style: 'stroke:var(--intr)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }),
            s('text', { x: X0 + ALARM_AT * PX - 5, y: BB - 6, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--intr)' }, NW ? 'alarm' : 'alarm 0:45'));
          if (sim.finish) k.push(s('line', { x1: X0 + sim.finish * PX, x2: X0 + sim.finish * PX, y1: RY.dl, y2: BB, style: 'stroke:var(--ok)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }),
            s('text', { x: X0 + sim.finish * PX + 5, y: BB - 6, 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--ok)' }, NW ? 'done' : `download done ${mmss(sim.finish)}`));
          const rem = t === 0 ? 100 : 100 - sim.rows[t - 1].used;
          k.push(s('line', { x1: X0 + t * PX, x2: X0 + t * PX, y1: 0, y2: BB + 4, style: 'stroke:var(--ink)', 'stroke-width': 2 }),
            s('circle', { cx: X0 + t * PX, cy: by(rem), r: 5.5, style: 'fill:var(--ok);stroke:var(--panel)', 'stroke-width': 2 }));
          svg.replaceChildren(...k);
        }
        // ---- narration + readout for the moment under the playhead
        const narr = h('div', { class: 'wl-narr' });
        const chips = h('div', { class: 'row gap-s' });
        const mini = h('div', { class: 'wl-mini' });
        function narrate(sim) {
          const fin = sim.finish;
          if (t >= MIN) {
            const pct = Math.round((sim.rows[MIN - 1].done / NEED) * 100);
            const base = simulate({ lock: 'partial', forget: false });
            const ratio = sim.used / base.used;
            const verdict = lock === 'none' ? 'Cheapest, but the job never finished. Sleeping too eagerly is a failure too.'
              : forget ? `The same work as a partial wakelock released on time, but ${ctx.util.fmt(ratio, 1)}× the battery. Always release a wakelock as soon as the work is done.`
                : lock === 'partial' ? 'The best choice for background work: the job finished, then the phone slept.'
                  : `The job finished, but keeping the screen on cost ${ctx.util.fmt(ratio, 1)}× the battery of a partial wakelock. Screen wakelocks are for things the user is watching.`;
            return `<b>After one hour:</b> download ${fin ? 'finished at ' + mmss(fin) : 'only ' + pct + '% done'}, battery used <b>${ctx.util.fmt(sim.used, 2)}%</b>. ${verdict}`;
          }
          const r = sim.rows[t];
          const prev = t > 0 ? sim.rows[t - 1] : null;
          const pctNow = Math.round(((prev ? prev.done : 0) / NEED) * 100);
          if (t < TIMEOUT) return `<b>${mmss(t)}.</b> You start downloading an album and put the phone down. The screen stays on for its 1-minute timeout; while the screen is on, Android itself keeps the phone awake.`;
          if (r.alarmNow) return `<b>${mmss(t)}.</b> The calendar alarm fires. The kernel's alarm timer wakes the phone${prev && !prev.awake ? ' even though it was asleep' : ''}, and the reminder lights the screen for a minute.${r.dl ? ' While the processor is awake any app can run, so the stalled download creeps forward too.' : ''}`;
          if (r.held && r.dl) return `<b>${mmss(t)}.</b> ` + {
            partial: 'The screen has timed out, but the music app holds a <b>partial</b> wakelock, so the processor and radio keep downloading in the dark.',
            dim: 'The <b>screen dim</b> wakelock keeps the processor running and the screen on but dimmed: extra battery for no benefit to a download.',
            bright: 'The <b>screen bright</b> wakelock keeps the screen at full brightness: the download works, but the screen is the biggest drain.',
            full: 'The <b>full</b> wakelock keeps the processor, a bright screen and the keyboard light on: the most expensive choice.' }[lock];
          if (r.held) return `<b>${mmss(t)}.</b> The download finished at ${mmss(fin)}, but the app <b>never released</b> its wakelock. The phone stays awake doing nothing.`;
          if (!r.awake && fin && t >= fin) return `<b>${mmss(t)}.</b> The download finished at ${mmss(fin)} and the app released its wakelock. Nothing holds the phone awake, so it sleeps and the battery line goes almost flat.`;
          if (!r.awake) return `<b>${mmss(t)}.</b> No wakelock is held, so once the screen timed out Android suspended the phone. The download is frozen at ${pctNow}%, and the battery barely moves.`;
          return `<b>${mmss(t)}.</b> The processor is awake.`;
        }
        function paint() {
          const sim = simulate({ lock, forget });
          drawSvg(sim);
          const r = sim.rows[Math.min(t, MIN - 1)];
          const done = t === 0 ? 0 : sim.rows[t - 1].done;
          const rem = t === 0 ? 100 : 100 - sim.rows[t - 1].used;
          const live = t < MIN;
          mini.className = 'wl-mini ' + (live ? r.screen : 'off');
          mini.textContent = live && !r.awake ? 'z z' : '';
          const liveChips = live ? [
            h('span', { class: 'chip ' + (r.screen === 'off' ? '' : 'warn') }, 'screen ' + r.screen),
            h('span', { class: 'chip ' + (r.awake ? 'cpu' : '') }, r.awake ? 'processor awake' : 'asleep'),
            h('span', { class: 'chip ' + (r.held ? 'os' : '') }, r.held ? 'wakelock held' : 'no wakelock')] : [];
          chips.replaceChildren(
            h('span', { class: 'chip' }, t >= MIN ? '1:00' : mmss(t)),
            ...liveChips,
            h('span', { class: 'chip ' + (done >= NEED ? 'ok' : 'io') }, `download ${Math.round((done / NEED) * 100)}%`),
            h('span', { class: 'chip ok' }, `battery ${ctx.util.fmt(rem, 2)}%`));
          narr.innerHTML = narrate(sim);
          forgetBtn.disabled = lock === 'none';
        }
        function setT(v) { t = ctx.util.clamp(Math.round(v), 0, MIN); slider.set(t, false); paint(); }
        function stop() { if (timer) clearInterval(timer); timer = null; playBtn.textContent = '▶ Play the hour'; }
        function play() {
          if (timer) { stop(); return; }
          if (t >= MIN) setT(0);
          playBtn.textContent = '■ Pause';
          timer = ctx.every(110, () => { setT(t + 1); if (t >= MIN) stop(); });
        }
        const seg = ctx.ui.seg(Object.keys(LOCKS).map((k) => ({ value: k, label: LOCKS[k].label, title: LOCKS[k].desc })), lock, (v) => { lock = v; if (v === 'none') { forget = false; forgetBtn.classList.remove('on'); forgetBtn.setAttribute('aria-pressed', 'false'); } paint(); });
        const forgetBtn = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'false', onclick: () => { forget = !forget; forgetBtn.classList.toggle('on', forget); forgetBtn.setAttribute('aria-pressed', String(forget)); paint(); } }, 'App forgets to release it');
        const alarmBtn = h('button', { class: 'btn sm on', type: 'button', 'aria-pressed': 'true', onclick: () => { alarm = !alarm; alarmBtn.classList.toggle('on', alarm); alarmBtn.setAttribute('aria-pressed', String(alarm)); paint(); } }, 'Calendar alarm at 0:45');
        const playBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: play }, '▶ Play the hour');
        const slider = ctx.ui.slider({ label: 'Time', min: 0, max: MIN, value: 0, format: (v) => (v >= MIN ? '1:00' : mmss(v)), onInput: (v) => { stop(); setT(v); } });
        const right = h('div', { class: 'stack', style: { gap: '8px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Music app\'s wakelock'), seg),
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'row gap-s' }, forgetBtn, alarmBtn), playBtn),
          svg,
          slider,
          h('div', { class: 'row nw', style: { gap: '10px', alignItems: 'center' } }, mini, h('div', { style: { minWidth: 0 } }, chips)),
          narr);
        el.append(h('div', { class: 'wl-grid fill' + (ctx.narrow ? ' nar' : '') }, left, right));
        paint();
      },
    },

    /* ---------------- 8. Recap ---------------- */
    {
      title: 'Recap: six things to remember about Android',
      kind: 'recap',
      render(el, ctx) {
        const { h } = ctx;
        const strip = (label, parts) => h('div', { class: 'rc-strip' }, h('span', { class: 'xs muted b rc-lab' }, label),
          ...parts.flatMap(([t, c], i) => [i ? h('span', { class: 'rc-arr' }, '→') : null, h('span', { class: 'box ' + c }, t)]).filter(Boolean));
        el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
          h('div', { class: 'card white stack', style: { gap: '8px' } },
            strip('THE STACK, TOP DOWN', [['Applications', 'proc'], ['Application framework', 'accent'], ['System libraries + Android runtime', 'cpu'], ['Linux kernel', 'os']]),
            strip('A REQUEST TRAVELS', [['App + framework', 'proc'], ['Binder IPC', 'accent'], ['System services', 'os'], ['HAL', ''], ['Kernel driver', 'io'], ['Hardware', 'io']])),
          h('p', { class: 'm0 muted small' }, 'Say each answer out loud before you flip the card.'),
          ctx.ui.flipcards([
            ['What is Android, and where did it come from?', 'A Linux-based OS first built for touchscreen phones and tablets. Android Inc. built it; Google bought it in 2005; it is open source (Open Handset Alliance) and now runs TVs, cars, watches and embedded devices.'],
            ['Name the five layers of the software stack.', 'Applications; the application framework (the Java/Kotlin API of managers and content providers); native system libraries; the Android runtime; the Linux kernel.'],
            ['How does an app take a photo?', 'Framework proxy → Binder IPC → camera service (a system service) → camera HAL written by the vendor → camera driver in the kernel → sensor. The app never touches hardware.'],
            ['Dalvik vs ART?', 'Both run .dex bytecode. Dalvik interpreted it and redid its JIT compiling on every run. ART compiles ahead of time (all at install in 5.0–6.0; the hot code, while charging, since 7.0): faster launches and better battery, at the cost of compile time and storage.'],
            ['Activity and back stack?', 'An activity is one screen of an app. Opening one pushes it onto the back stack; Back pops it. One stack can hold screens from several apps.'],
            ['Alarm vs wakelock?', 'Android\'s two kernel power additions. An alarm wakes a sleeping device at a set time. A wakelock (partial, screen dim, screen bright, full) stops it sleeping while held.'],
          ], { cols: 3, height: 172 })));
      },
    },

    /* ---------------- 9. Check yourself ---------------- */
    {
      title: 'Check yourself: Android',
      kind: 'check',
      quiz: [
        { q: 'Where did Android come from?',
          choices: ['Google designed it from scratch in 2007 as part of Chrome OS', 'A start-up, Android Inc., created it, and Google bought the company in 2005', 'The Open Handset Alliance bought it from a phone maker in 2008', 'It is a phone edition of Windows NT that Google licensed'], answer: 1,
          feedback: ['Google did not start it, and Chrome OS is a separate, later product. Google bought an existing start-up.', null, 'Google formed the alliance in 2007 to develop Android as an open platform; the alliance did not buy it from anyone.', 'Android is built on the Linux kernel, not on Windows NT.'],
          why: 'Android Inc. was a small start-up. Google bought it in 2005, and in 2007 Google and the Open Handset Alliance unveiled Android as an open-source, Linux-based platform.' },
        { type: 'order', q: 'A camera app takes a photo. Put the layers the request passes through in order, starting from the app.',
          items: ['App and application framework', 'Binder IPC', 'Android system service (camera service)', 'Hardware abstraction layer (camera HAL)', 'Linux kernel (camera driver)'],
          why: 'The framework proxy in the app sends the call through Binder to the camera service, which uses the vendor\'s camera HAL module, which drives the camera driver in the kernel.' },
        { type: 'bucket', q: 'Which layer of the Android software stack provides each component?',
          buckets: ['Framework', 'Libraries', 'Runtime', 'Kernel'],
          items: [['Activity manager', 0], ['Surface manager', 1], ['SQLite', 1], ['ART', 2], ['Camera driver', 3], ['Wakelocks', 3]],
          why: 'Services apps call through the Java/Kotlin API are framework; native C/C++ helpers such as SQLite and the surface manager are system libraries; whatever executes app code (ART, with the core Java libraries) is the runtime; drivers and power management run in the kernel.' },
        { type: 'match', q: 'Match each application-framework component to its job.',
          pairs: [['Activity manager', 'Starts app screens and keeps the back stack'], ['Content providers', 'Share one app\'s data with other apps'], ['Package manager', 'Installs apps and records their permissions'], ['Resource manager', 'Supplies strings and layouts for the device\'s language and screen'], ['Location manager', 'Reports where the device is'], ['Notification manager', 'Shows alerts in the status bar']],
          why: 'Each manager owns one job and offers it to every app through the same API, which is why all apps behave consistently.' },
        { q: 'What is the key difference between the Dalvik virtual machine and ART?',
          choices: ['ART runs Java source code directly, while Dalvik ran machine code', 'ART compiles an app\'s .dex bytecode into machine code ahead of time (originally at install), while Dalvik translated it while the app ran', 'Dalvik compiled apps at install time, while ART compiles only while the app runs', 'ART dropped the .dex format, so apps now arrive from the store as machine code'], answer: 1,
          feedback: ['Neither runs source code: both start from .dex bytecode produced by the build tools.', null, 'That is backwards. Dalvik interpreted and compiled just in time; ART introduced ahead-of-time compilation.', 'Apps still ship as .dex bytecode, and ART compiles it on the device.'],
          why: 'Dalvik repeated its translation work (interpreting plus JIT) every time an app ran. ART does the translation ahead of time and stores the machine code, so launches are faster and each run costs less battery.' },
        { type: 'multi', q: 'Compared with Dalvik, which were costs of ART\'s original compile-everything-at-install approach? Select all that apply.',
          choices: ['Longer app installs', 'More storage used for compiled code', 'Slower app launches', 'Every app had to be recompiled after a system update', 'More battery used each time the app runs'], answer: [0, 1, 3],
          why: 'Compiling everything up front takes time and space and must be redone when the OS changes. In exchange, launches are faster and each run needs less processor work, which saves battery. Later ART versions mix JIT and AOT to cut those costs.' },
        { type: 'tf', q: 'A wakelock is the Android feature that wakes a sleeping phone at a scheduled time.', answer: false,
          why: 'That is an alarm. A wakelock does the opposite job: while an app holds one, the phone is not allowed to go to sleep.' },
        { q: 'A podcast app must keep downloading after the screen turns off, and nobody is looking at the phone. Which wakelock fits best?',
          choices: ['A full wakelock', 'A partial wakelock', 'A screen bright wakelock', 'No wakelock: downloads continue while the phone sleeps'], answer: 1,
          feedback: ['A full wakelock also keeps the screen bright and the keyboard light on: wasted battery when nobody is watching.', null, 'This keeps the screen at full brightness, which a background download does not need.', 'A sleeping phone suspends its processor, so the download would freeze until something woke it.'],
          why: 'A partial wakelock keeps only the processor running and lets the screen turn off, exactly what background work needs. The app should release it as soon as the download finishes.' },
        { type: 'num', q: 'A user opens the Email app\'s inbox, opens a message, taps Reply, then taps Attach photo, which opens the Gallery app\'s photo picker. They then press Back twice. How many activities are left on the back stack?',
          answer: 2, tol: 0, unit: 'activities',
          why: 'Four activities were pushed: inbox, message, compose, picker. Each Back pops one, so 4 − 2 = 2 remain: the message on top of the inbox.' },
        { type: 'num', q: 'A phone uses 1% of its battery per hour while asleep, but 8% per hour while a partial wakelock keeps the processor awake. An app forgets to release its wakelock for 6 hours overnight. How many extra percentage points of battery does the bug cost?',
          answer: 42, tol: 0, unit: 'points',
          why: 'Awake: 6 × 8 = 48 points. Asleep it would have used 6 × 1 = 6 points. The bug costs 48 − 6 = 42 percentage points.' },
        { type: 'tf', q: 'Because Android runs on Linux, an ordinary app can open the camera\'s device driver directly to take a picture.', answer: false,
          why: 'Apps never talk to drivers. The request goes through the framework and Binder to the camera service, which uses the camera HAL, which talks to the driver. That path lets the service check permissions and share the camera among apps.' },
        { q: 'Why does Android put a hardware abstraction layer (HAL) between its system services and the kernel drivers?',
          choices: ['So apps can reach hardware faster by skipping the kernel', 'So each vendor can implement standard interfaces for its own chips, keeping the services above identical on every device', 'Because the Linux kernel cannot run device drivers', 'To translate .dex bytecode into machine code'], answer: 1,
          feedback: ['Apps cannot call the HAL, and it does not bypass the kernel: it sits above the drivers.', null, 'Linux runs drivers perfectly well; the HAL sits on top of them.', 'That is the Android runtime\'s job, not the HAL\'s.'],
          why: 'Phone makers use different chips. By writing HAL modules for standard interfaces, they plug their hardware in without changing the services, and Android can be updated without rewriting their code.' },
      ],
    },

  ],

  notes: `
    <h3>What Android is</h3>
    <p><b>Android</b> is an operating system built on the <b>Linux kernel</b>, first designed for touchscreen mobile devices such as phones and tablets. It is the world's most widely used mobile OS. It began at a small start-up, <b>Android Inc.</b>, which <b>Google bought in 2005</b>. In 2007 Google and the <b>Open Handset Alliance</b> (phone makers, chip makers, carriers and software firms) announced it as an open platform; in 2008 the first Android phone went on sale and the <b>open-source</b> code was released. The same core now also runs TVs, cars, watches (Wear OS) and embedded or Internet-of-Things devices.</p>

    <h3>The software stack: five layers</h3>
    <p>This is the classic layout Android was designed with. Two of its parts belonged to early Android only: the XMPP service (removed early on) and the WebKit browser engine (later replaced by a Chromium-based web view).</p>
    <svg viewBox="0 0 520 176" width="520" height="176" role="img" aria-label="Android software stack">
      <rect x="4" y="4" width="512" height="32" rx="6" fill="#d6f3f9" stroke="#0891b2"/><text x="260" y="25" text-anchor="middle" font-size="13" font-weight="700" fill="#151c2c">Applications (Java / Kotlin)</text>
      <rect x="4" y="42" width="512" height="32" rx="6" fill="#e8e7fd" stroke="#4f46e5"/><text x="260" y="63" text-anchor="middle" font-size="13" font-weight="700" fill="#151c2c">Application framework (Java / Kotlin API)</text>
      <rect x="4" y="80" width="330" height="44" rx="6" fill="#f5f7fb" stroke="#69738c"/><text x="169" y="100" text-anchor="middle" font-size="13" font-weight="700" fill="#151c2c">System libraries (C / C++)</text><text x="169" y="116" text-anchor="middle" font-size="10.5" fill="#3d4760">surface mgr · OpenGL ES · media · SQLite · WebKit · Bionic</text>
      <rect x="340" y="80" width="176" height="44" rx="6" fill="#e1eaff" stroke="#2563eb"/><text x="428" y="100" text-anchor="middle" font-size="13" font-weight="700" fill="#151c2c">Android runtime</text><text x="428" y="116" text-anchor="middle" font-size="11" fill="#3d4760">ART + core libraries</text>
      <rect x="4" y="130" width="512" height="42" rx="6" fill="#eee5ff" stroke="#7c3aed"/><text x="260" y="149" text-anchor="middle" font-size="13" font-weight="700" fill="#151c2c">Linux kernel (C)</text><text x="260" y="165" text-anchor="middle" font-size="11" fill="#3d4760">drivers · Binder · power · memory · processes · networking · security</text>
    </svg>
    <table>
      <tr><th>Layer</th><th>What it provides</th></tr>
      <tr><td><b>Applications</b></td><td>The programs users open: home screen, dialer, contacts, SMS, email, calendar, maps, browser and everything installed later. Each app runs in its own Linux process under its own user ID (a sandbox). Most built-in apps can be replaced.</td></tr>
      <tr><td><b>Application framework</b></td><td>The API developers program against. <b>Activity manager</b>: activities and the back stack. <b>Window manager</b>: arranges windows. <b>Package manager</b>: installs apps, records permissions. <b>Telephony manager</b>: calls, network, SIM. <b>Content providers</b>: share one app's data with others. <b>Resource manager</b>: strings and layouts for the language and screen. <b>View system</b>: buttons, lists, text boxes. <b>Location manager</b>: device position. <b>Notification manager</b>: status-bar alerts. <b>XMPP service</b> (Extensible Messaging and Presence Protocol; early Android only): pushed server messages to apps over one shared connection.</td></tr>
      <tr><td><b>System libraries</b></td><td>Native C/C++ code: <b>surface manager</b> (combines all apps' surfaces into the screen image), <b>OpenGL ES</b> (graphics), <b>media framework</b> (codecs), <b>SQLite</b> (in-app SQL database stored in one file), <b>WebKit</b> (browser engine in early Android; later replaced by a Chromium-based web view), <b>Bionic libc</b> (Android's small C library).</td></tr>
      <tr><td><b>Android runtime</b></td><td>Executes app code: <b>ART</b> (formerly the Dalvik VM) plus the <b>core</b> Java <b>libraries</b>. Each app has its own runtime instance.</td></tr>
      <tr><td><b>Linux kernel</b></td><td>Owns the hardware: device drivers, the <b>Binder IPC driver</b>, power management (with Android's alarms and wakelocks), memory, process management, networking and security (per-app user IDs).</td></tr>
    </table>
    <p><b>Rule of thumb for placing a component:</b> things users open are applications; services apps call through the API are framework; native C/C++ helpers are libraries; whatever executes app code is the runtime; anything that touches hardware or needs kernel mode is in the kernel.</p>

    <h3>System architecture: how a request travels</h3>
    <p>Seen as running processes, Android has five tiers: <b>applications and framework → Binder IPC → Android system services → hardware abstraction layer (HAL) → Linux kernel</b>.</p>
    <ul>
      <li><b>Binder IPC</b> is Android's main interprocess communication mechanism. Framework objects inside an app are often only <b>proxies</b>; calling them sends a Binder transaction that the kernel's Binder driver delivers to another process, stamped with the caller's identity (Linux user ID).</li>
      <li><b>Android system services</b> are trusted processes that own shared resources: mainly the <b>system server</b> (activity, window, power, package, location and other manager services) and the <b>media server</b> (camera, audio and media services). They check permissions and share each device among apps.</li>
      <li>The <b>HAL</b> is a set of standard interfaces (camera, audio, GNSS/GPS, graphics, sensors) that each vendor implements for its own chips, so the services above are identical on every device.</li>
    </ul>
    <p><b>Example, taking a photo:</b> Camera app → framework Camera API (proxy) → Binder → camera service (checks the camera permission) → camera HAL (vendor module) → camera driver in the kernel → image sensor; the image returns up the same path. Music and location requests work the same way. Apps never touch drivers directly.</p>

    <h3>From source code to machine code: Dalvik and ART</h3>
    <p>Developers write Java or Kotlin. A compiler produces <b>.class</b> bytecode, and a dex tool converts it into <b>.dex</b> (<b>Dalvik executable</b>) format, packed into the app package (APK). One .dex file holds all of an app's classes and shares their repeated strings and constants, so it is compact and quick to load. <b>Bytecode</b> is portable code that no processor runs directly: an <b>interpreter</b> performs it one instruction at a time on every run (slow), while a <b>compiler</b> translates it into machine code once. The runtime must still turn .dex bytecode into machine code; the question is <b>when</b>.</p>
    <ul>
      <li><b>Dalvik VM (Android 1.0 to 4.4):</b> interprets the bytecode, and from Android 2.2 a <b>just-in-time (JIT)</b> compiler turns busy code into machine code, work that is repeated on every launch.</li>
      <li><b>ART with ahead-of-time (AOT) compilation (optional in 4.4, standard in 5.0 and 6.0):</b> the whole app is compiled to native machine code at install time and stored. Launches are faster and each run needs less processor work, so <b>battery life improves</b>. The costs: <b>longer installs</b>, <b>more storage</b>, and every app had to be recompiled after a system update.</li>
      <li><b>ART hybrid (Android 7.0 on):</b> early runs use ART's faster interpreter and JIT while it records the hot code (a profile); that code is compiled ahead of time while the phone idles on the charger. Installs stay quick and there is no long recompile after updates.</li>
    </ul>
    <table>
      <tr><th></th><th>Dalvik</th><th>ART (AOT)</th><th>ART (hybrid)</th></tr>
      <tr><td>Install time</td><td>short</td><td>long</td><td>short</td></tr>
      <tr><td>Storage for code</td><td>small</td><td>large</td><td>medium</td></tr>
      <tr><td>Launch speed</td><td>slower</td><td>fast</td><td>fast once warm</td></tr>
      <tr><td>Battery per launch</td><td>higher</td><td>low</td><td>low once warm</td></tr>
      <tr><td>After an OS update</td><td>quick</td><td>recompile all apps</td><td>quick</td></tr>
    </table>
    <p><b>Worked example (illustrative units of processor work on battery):</b> suppose Dalvik costs 1 unit to install and 5 per launch, while AOT costs 12 to install and 1 per launch. After n launches Dalvik has used 1 + 5n and AOT 12 + n. AOT is cheaper once 12 + n &lt; 1 + 5n, that is n &gt; 2.75, so from the <b>third launch</b> on; after 10 launches the totals are 51 versus 22.</p>

    <h3>Activities and the back stack</h3>
    <p>An <b>activity</b> is a single visual user-interface component of an app: one screen with one focused job, such as an email inbox, a message reader or a compose screen. An app usually has several. The <b>activity manager</b> keeps the activities a user opens for one job (a <b>task</b>) in a <b>back stack</b> (last in, first out): starting an activity <b>pushes</b> it on top, and pressing <b>Back pops</b> the top one so the one beneath returns. Home keeps the stack in the background. One stack can hold activities from <b>different apps</b>: an email app's compose screen can launch the Gallery app's photo picker, which sits on top of it. <b>Example:</b> inbox, message, compose and picker are pushed (4); two presses of Back leave 2 (message on top of inbox). Activity states and how Android manages their processes are covered in Section 4.7.</p>

    <h3>Power management: alarms and wakelocks</h3>
    <p>A sleeping phone turns off the screen and suspends the processor, drawing almost no power. Android's goal is to sleep as much as possible without missing work. It adds two features to Linux's power management:</p>
    <ul>
      <li><b>Alarms:</b> an app asks the framework's <b>AlarmManager</b> for work at a set time. The alarm is implemented in the Linux kernel using a hardware timer that keeps running during sleep, so it can <b>wake the device</b>; the app does its work and the device sleeps again.</li>
      <li><b>Wakelocks:</b> they <b>prevent the system from sleeping</b>. An app that must keep working requests a wakelock through the framework's power manager; the device may sleep only when no wakelock is held. The kernel exposes wakelocks to user space as files (/sys/power/wake_lock and wake_unlock).</li>
    </ul>
    <table>
      <tr><th>Wakelock type</th><th>Processor</th><th>Screen</th><th>Keyboard light</th></tr>
      <tr><td>Partial</td><td>on</td><td>off</td><td>off</td></tr>
      <tr><td>Screen dim</td><td>on</td><td>dim</td><td>off</td></tr>
      <tr><td>Screen bright</td><td>on</td><td>bright</td><td>off</td></tr>
      <tr><td>Full</td><td>on</td><td>bright</td><td>bright</td></tr>
    </table>
    <p>Background work that nobody watches (a download, music playback) needs only a <b>partial</b> wakelock; the screen types are for things the user is looking at (newer Android versions steer apps toward a keep-screen-on setting for that). The classic bug is <b>forgetting to release</b> a wakelock, which keeps the phone awake doing nothing. With no wakelock, a background job freezes while the phone sleeps.</p>
    <p><b>Worked example:</b> asleep a phone uses 1% of its battery per hour; awake under a partial wakelock, 8% per hour. A wakelock left held for 6 hours overnight costs 6 × 8 = 48 points instead of 6 × 1 = 6, an extra <b>42 percentage points</b>.</p>`,
});
