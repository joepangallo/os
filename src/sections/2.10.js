/* Section 2.10 — Linux
   Original teaching material. Built step by step (see AUTHORING.txt). */
Guide.section({
  id: '2.10',
  title: 'Linux',
  short: 'Linux',
  summary: 'How a 1991 student kernel became Linux: free under the GPL, monolithic, yet built from loadable modules.',
  objectives: [
    'Tell the story of Linux: who started it, when, on what hardware, and why a free license and the GNU tools let it succeed.',
    'Explain why Linux counts as a monolithic kernel even though it is built from loadable modules, and compare it with a microkernel.',
    'Describe the two key properties of Linux modules, dynamic linking and stacking, and predict when the kernel refuses to load or unload a module.',
    'Read an entry of the module table: name, size, usecount, flags, exported symbols and dependencies.',
    'Name the main components of the Linux kernel and trace which ones handle a key press, an arriving network packet and a file read.',
  ],
  terms: [
    ['Linux', 'A free, open-source, UNIX-like operating-system kernel started by Linus Torvalds in 1991. The name is also used loosely for whole systems built around that kernel.'],
    ['Open source', 'Software whose source code is published so that anyone may read it, change it and share it, under the terms of its license.'],
    ['GNU General Public License (GPL)', 'The free-software license Linux uses. Anyone may run, study, change and share the code, but whoever passes a copy on, changed or not, must pass on the same freedoms and make the source code available.'],
    ['Copyleft', 'A license rule that uses copyright to keep software free: any version you distribute must carry the same license, so nobody can turn shared code into a closed product.'],
    ['Free Software Foundation (FSF)', 'A nonprofit founded in 1985 by Richard Stallman to promote software that users are free to run, study, change and share. It supports the GNU project and wrote the GPL.'],
    ['GNU project', 'An effort begun in 1983 to build a complete, free, UNIX-like operating system. By 1991 it had a compiler, a shell, a C library, editors and utilities, but no finished kernel. GNU stands for "GNU\'s Not Unix".'],
    ['Monolithic kernel', 'A kernel that holds almost the whole operating system (scheduling, memory management, file systems, networking, device drivers) as one large program that runs in kernel mode in one shared address space, so its parts can call each other directly.'],
    ['Microkernel', 'A small kernel that keeps only the essential core (address spaces, interprocess communication, basic scheduling) and runs every other OS service as a server process in user mode.'],
    ['Loadable module', 'A relatively independent block of kernel code, usually doing one job such as a device driver, a file system or a network protocol, that can be loaded into and removed from the kernel while the system runs. It is not a separate process: it runs in kernel mode on behalf of the current process.'],
    ['Dynamic linking', 'Connecting a module to the kernel while the kernel is in memory and running: every name the module uses is looked up and replaced by its real address. The module can later be unlinked and removed, all without a reboot.'],
    ['Stackable modules', 'Modules arranged in a hierarchy in which a lower module acts as a library for the client modules above it. The kernel counts these references, so it can load prerequisites first and refuse to remove a module that others still need.'],
    ['Module table', 'The kernel\'s linked list of loaded modules. Each entry records the module\'s name, size, usecount, flags, the symbols it exports and the modules it depends on.'],
    ['Usecount (use count)', 'A counter in a module\'s table entry. It goes up when an operation that uses the module\'s functions starts and down when that operation ends. The module cannot be unloaded while it is above zero.'],
    ['Symbol table (exported symbols)', 'The list of names (functions and variables) that the core kernel and loaded modules make available to other modules, each with its address in memory. A newly loaded module is linked against it.'],
    ['Signal', 'A short software notice the kernel delivers to a process to report an event, such as Ctrl+C being pressed (SIGINT) or a child process ending. The process may handle it, ignore it, or be stopped by it.'],
    ['Traps and faults', 'Events the processor raises by itself while running an instruction, such as a page fault, a divide by zero or an illegal instruction. Like an interrupt, each one switches the processor into kernel mode to run a handler.'],
    ['Character device', 'A device that sends or receives data as a stream of bytes, one after another, such as a keyboard, a terminal or a mouse. A character device driver operates it.'],
    ['Block device', 'A device, such as a hard disk, an SSD or a USB flash drive, that stores data in fixed-size numbered blocks. A block device driver operates it.'],
    ['Network interface controller (NIC)', 'The hardware that connects a computer to a network, such as an Ethernet port or a Wi-Fi chip. It sends and receives packets and raises an interrupt when one arrives.'],
    ['System call', 'A request from a running program to the kernel for a service, such as reading a file. A special instruction switches the processor into kernel mode and enters the kernel at a fixed, pre-arranged point.'],
  ],

  css: `
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width and the page scrolls sideways */
    .sec-2-10 .step-eyebrow { contain: inline-size; }
    .sec-2-10 .hot { cursor: pointer; outline: none; }
    .sec-2-10 .hot .fr { transition: stroke-width .15s, opacity .2s; }
    .sec-2-10 .hot:hover .fr, .sec-2-10 .hot:focus-visible .fr { stroke-width: 3.5; }
    .sec-2-10 .hot.sel .fr { stroke-width: 4; }
    .sec-2-10 .p15 { font-size: 15.5px; line-height: 1.45; }
    .sec-2-10 .p15 p { margin: 0 0 8px; }
    .sec-2-10 .lbl { font-size: 12.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
    .sec-2-10 .eg { font-size: 14.5px; line-height: 1.4; padding: 7px 11px; border-radius: 10px; background: var(--panel-3); border-left: 4px solid var(--chc); }
    .sec-2-10 .eg b { color: var(--chc); }
    /* step 1: facts + device spectrum */
    .sec-2-10 .fact { display: grid; grid-template-columns: 132px minmax(0, 1fr); gap: 12px; align-items: center; padding: 9px 12px; }
    .sec-2-10 .fact b { font-size: 15.5px; }
    .sec-2-10 .fact span { font-size: 14.5px; line-height: 1.4; color: var(--ink-2); }
    .sec-2-10 .devs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
    .sec-2-10 .dev { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px 7px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; font: inherit; color: var(--ink); transition: border-color .15s, background .15s; }
    .sec-2-10 .dev svg { width: 46px; height: 42px; fill: none; stroke: var(--ink-2); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .sec-2-10 .dev b { font-size: 14px; line-height: 1.2; text-align: center; }
    .sec-2-10 .dev:hover { border-color: var(--chc); }
    .sec-2-10 .dev.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); }
    .sec-2-10 .dev.on svg { stroke: var(--chc); }
    .sec-2-10 .scale { height: 6px; border-radius: 9px; background: linear-gradient(90deg, color-mix(in srgb, var(--chc) 18%, transparent), var(--chc)); }
    .sec-2-10 .trs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
    .sec-2-10 .tr { font-size: 13.5px; font-weight: 700; text-align: center; padding: 5px 6px; border-radius: 9px; border: 1.5px dashed var(--line-2); color: var(--muted); line-height: 1.25; transition: all .2s; }
    .sec-2-10 .tr.on { border-style: solid; border-color: var(--ok); background: var(--ok-bg); color: var(--ok); }
    .sec-2-10 .nrw .devs { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .sec-2-10 .nrw .trs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sec-2-10 .nrw .fact { grid-template-columns: 1fr; gap: 2px; }
    /* step 2: timeline */
    .sec-2-10 .tl8 { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 8px; position: relative; flex: none; }
    .sec-2-10 .tl8::before { content: ''; position: absolute; left: 3%; right: 3%; top: 50%; height: 3px; background: var(--line-2); border-radius: 3px; }
    .sec-2-10 .tlc { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 7px 9px; min-height: 74px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; font: inherit; color: var(--ink); text-align: left; transition: border-color .15s, background .15s; }
    .sec-2-10 .tlc .yr { font-size: 15px; font-weight: 800; color: var(--chc); line-height: 1.2; }
    .sec-2-10 .tlc .tt { font-size: 13.5px; line-height: 1.25; color: var(--ink-2); font-weight: 650; }
    .sec-2-10 .tlc:hover { border-color: var(--chc); }
    .sec-2-10 .tlc.past { border-color: color-mix(in srgb, var(--chc) 35%, var(--line)); }
    .sec-2-10 .tlc.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 11%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); }
    .sec-2-10 .gauge { display: grid; grid-template-columns: 128px minmax(0, 1fr); gap: 4px 12px; align-items: center; }
    .sec-2-10 .gauge .gl { font-size: 14px; font-weight: 700; }
    .sec-2-10 .gauge .gv { grid-column: 2; font-size: 13.5px; color: var(--ink-2); line-height: 1.3; }
    .sec-2-10 .seg5 { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; }
    .sec-2-10 .seg5 i { height: 11px; border-radius: 4px; background: var(--panel-3); transition: background .25s; }
    .sec-2-10 .seg5 i.on { background: var(--chc); }
    .sec-2-10 .ings { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    .sec-2-10 .ing { font-size: 13.5px; font-weight: 700; padding: 6px 9px; border-radius: 9px; border: 1.5px dashed var(--line-2); color: var(--muted); line-height: 1.3; transition: all .25s; }
    .sec-2-10 .ing.on { border-style: solid; border-color: var(--ok); background: var(--ok-bg); color: var(--ok); }
    .sec-2-10 .ing.new { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 35%, transparent); }
    .sec-2-10 .nrw .tl8 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sec-2-10 .nrw .tl8::before { display: none; }
    /* step 3: GNU stack + GPL game */
    .sec-2-10 .lays { display: flex; flex-direction: column; gap: 6px; }
    .sec-2-10 .lay { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 10px; border: 2px solid var(--line-2); font-size: 15px; line-height: 1.3; min-height: 37px; }
    .sec-2-10 .lay small { font-size: 13.5px; color: var(--ink-2); font-weight: 400; }
    .sec-2-10 .lay.u { border-color: color-mix(in srgb, var(--proc) 60%, transparent); background: var(--proc-bg); }
    .sec-2-10 .lay.k { border-color: var(--os); background: var(--os-bg); }
    .sec-2-10 .lay.miss { border-style: dashed; border-color: var(--bad); background: var(--bad-bg); color: var(--bad); }
    .sec-2-10 .lay.hw { background: var(--panel-3); }
    .sec-2-10 .who { font-size: 12.5px; font-weight: 800; letter-spacing: .04em; padding: 1px 8px; border-radius: 99px; background: var(--panel); color: var(--ink-2); white-space: nowrap; }
    .sec-2-10 .lay.k .who { color: var(--os); }
    .sec-2-10 .lay.miss .who { color: var(--bad); }
    .sec-2-10 .scen { font-size: 17px; line-height: 1.45; padding: 12px 14px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--line); min-height: 104px; }
    .sec-2-10 .gdots { display: flex; gap: 6px; }
    .sec-2-10 .gdots i { width: 26px; height: 8px; border-radius: 9px; background: var(--panel-3); }
    .sec-2-10 .gdots i.cur { background: var(--chc); }
    .sec-2-10 .gdots i.ok { background: var(--ok); }
    .sec-2-10 .gdots i.bad { background: var(--bad); }
    .sec-2-10 .fb .callout { font-size: 15px; line-height: 1.45; }
    /* step 4: kernel designs */
    .sec-2-10 .tok { transition: transform .55s ease, opacity .25s; pointer-events: none; }
    .sec-2-10 .prow { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 9px; font-size: 14.5px; line-height: 1.38; align-items: start; }
    .sec-2-10 .prow span { color: var(--ink-2); }
    .sec-2-10 .vd { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; font-weight: 900; font-size: 14px; background: var(--panel-3); color: var(--ink-2) !important; }
    .sec-2-10 .vd.ok { background: var(--ok-bg); color: var(--ok) !important; }
    .sec-2-10 .vd.bad { background: var(--bad-bg); color: var(--bad) !important; }
    .sec-2-10 .vd.warn { background: var(--warn-bg); color: var(--warn) !important; }
    .sec-2-10 .score { display: flex; align-items: center; gap: 10px; }
    .sec-2-10 .score b { font-size: 30px; font-weight: 800; color: var(--chc); min-width: 1.2ch; text-align: center; font-variant-numeric: tabular-nums; line-height: 1; }
    .sec-2-10 .score span { font-size: 14px; line-height: 1.25; color: var(--ink-2); font-weight: 650; }
    /* step 5: modules, linking, stacking */
    .sec-2-10 .prop { display: flex; flex-direction: column; gap: 3px; padding: 9px 12px; }
    .sec-2-10 .prop b { font-size: 16px; color: var(--os); }
    .sec-2-10 .prop span { font-size: 14.5px; line-height: 1.4; }
    .sec-2-10 .mnode { cursor: pointer; }
    .sec-2-10 .mnode rect { transition: stroke-width .15s; }
    .sec-2-10 .mnode:hover rect { stroke-width: 3.5; }
    /* step 6: module lab */
    .sec-2-10 .lab { grid-template-columns: minmax(0, 382fr) minmax(0, 746fr); }
    .sec-2-10 .drow { display: flex; align-items: center; gap: 6px; padding: 3px 7px; border-radius: 9px; border: 1.5px solid transparent; min-height: 40px; }
    .sec-2-10 .drow.in { background: var(--os-bg); border-color: color-mix(in srgb, var(--os) 40%, transparent); }
    .sec-2-10 .drow .nm { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
    .sec-2-10 .drow .nm b { font-family: var(--mono); font-size: 14px; }
    .sec-2-10 .drow .nm span { font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sec-2-10 .drow .btn.sm { height: 28px; padding: 0 8px; font-size: 13px; font-family: var(--mono); }
    .sec-2-10 .mt { display: flex; flex-direction: column; gap: 4px; position: relative; }
    .sec-2-10 .mt::before { content: ''; position: absolute; left: 12px; top: 30px; bottom: 9px; width: 2px; background: color-mix(in srgb, var(--os) 55%, transparent); }
    .sec-2-10 .mrow { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 4px; align-items: center; position: relative; }
    .sec-2-10 .mrail { position: relative; height: 100%; display: grid; place-items: center; z-index: 1; }
    .sec-2-10 .mrail i { width: 10px; height: 10px; border-radius: 50%; background: var(--os); }
    .sec-2-10 .mrail b { position: absolute; top: -10px; font-size: 11px; line-height: 1; color: var(--os); }
    .sec-2-10 .mcols, .sec-2-10 .mbox { display: grid; grid-template-columns: 96px 72px 66px minmax(0, 1fr) 96px 134px; gap: 6px; align-items: center; }
    .sec-2-10 .mcols { font-size: 12.5px; font-weight: 800; letter-spacing: .02em; color: var(--muted); padding: 0 8px; }
    .sec-2-10 .mbox { padding: 2px 8px; min-height: 34px; border-radius: 9px; border: 1.5px solid color-mix(in srgb, var(--os) 50%, transparent); background: var(--os-bg); font-size: 13px; line-height: 1.25; }
    .sec-2-10 .mbox.new { border-color: var(--chc); box-shadow: 0 0 0 2px color-mix(in srgb, var(--chc) 30%, transparent); }
    .sec-2-10 .mbox .mono { font-size: 13px; overflow-wrap: anywhere; }
    .sec-2-10 .mbox .nmc b { font-family: var(--mono); font-size: 14px; display: block; }
    .sec-2-10 .mcols > :nth-child(2), .sec-2-10 .mcols > :nth-child(3), .sec-2-10 .mbox > :nth-child(2), .sec-2-10 .mbox > :nth-child(3) { text-align: center; }
    .sec-2-10 .mbox .uc { font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .sec-2-10 .mbox .uc.hot { color: var(--warn); }
    .sec-2-10 .mhead, .sec-2-10 .mnull { font-family: var(--mono); font-size: 13px; color: var(--muted); padding-left: 30px; line-height: 16px; position: relative; }
    .sec-2-10 .mhead::before, .sec-2-10 .mnull::before { content: ''; position: absolute; left: 8px; top: 3px; width: 10px; height: 10px; border-radius: 3px; background: var(--muted); }
    .sec-2-10 .mempty { font-size: 14.5px; color: var(--muted); padding: 10px 8px 10px 30px; font-style: italic; }
    .sec-2-10 .labout { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 10px; min-height: 0; }
    .sec-2-10 .labout .log { font-size: 13px; }
    .sec-2-10 .labout .log .c { color: var(--ink); font-weight: 700; }
    .sec-2-10 .labout .log .ok { color: var(--ok); }
    .sec-2-10 .labout .log .bad { color: var(--bad); }
    .sec-2-10 .labout .log .mu { color: var(--muted); }
    .sec-2-10 .mis { display: flex; flex-direction: column; gap: 3px; font-size: 13.5px; line-height: 1.3; }
    .sec-2-10 .mis div { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 6px; color: var(--ink-2); }
    .sec-2-10 .mis div.done { color: var(--ok); font-weight: 700; }
    .sec-2-10 .nrw .mcols { display: none; }
    .sec-2-10 .nrw .mbox { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sec-2-10 .nrw .mbox > div { text-align: left !important; }
    .sec-2-10 .nrw .labout { grid-template-columns: 1fr; }
    .sec-2-10 .nrw .labout .log { max-height: 160px; }
    /* step 7: kernel components map */
    .sec-2-10 .kgrid { grid-template-columns: minmax(0, 690fr) minmax(0, 438fr); }
    .sec-2-10 .kmap .hot:hover rect.fr { stroke-width: 3.5; }
    .sec-2-10 .kinfo h3 { margin: 0; }
    .sec-2-10 .kinfo p { font-size: 15.5px; line-height: 1.45; margin: 0; }
    /* phones: label each lab cell, since the column headers are hidden */
    .sec-2-10 .nrw .mbox > div::before { content: attr(data-l); display: block; font-size: 12.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); font-family: var(--font); }
  `,

  steps: [
    /* ---------------- 1. Big picture: what Linux is + where it runs ---------------- */
    {
      title: 'Linux: from a student\'s hobby to almost everywhere',
      kind: 'story',
      render(el, ctx) {
        const { h } = ctx;
        if (ctx.narrow) el.classList.add('nrw');
        const TRAITS = [
          ['free', 'Free and open source'], ['mod', 'Highly modular'], ['cfg', 'Easily configured'], ['port', 'Runs on many platforms'],
        ];
        const ICON = {
          emb: '<rect x="6" y="22" width="36" height="14" rx="3"/><path d="M12 22 L9 7 M36 22 L39 7"/><circle cx="14" cy="29" r="1.6"/><circle cx="20" cy="29" r="1.6"/><path d="M28 29h8"/>',
          phone: '<rect x="15" y="4" width="18" height="36" rx="4"/><path d="M21 35h6"/>',
          laptop: '<rect x="10" y="8" width="28" height="20" rx="2"/><path d="M5 33h38l-3 4H8z"/>',
          server: '<rect x="9" y="5" width="30" height="9" rx="2"/><rect x="9" y="17" width="30" height="9" rx="2"/><rect x="9" y="29" width="30" height="9" rx="2"/><path d="M14 9.5h8M14 21.5h8M14 33.5h8"/>',
          superc: '<rect x="3" y="7" width="10" height="31" rx="1.5"/><rect x="15" y="7" width="10" height="31" rx="1.5"/><rect x="27" y="7" width="10" height="31" rx="1.5"/><rect x="39" y="7" width="6" height="31" rx="1.5"/><path d="M6 13h4M18 13h4M30 13h4M6 19h4M18 19h4M30 19h4"/>',
        };
        const DEV = [
          { ic: 'emb', name: 'Embedded devices', eg: 'routers, smart TVs, cars',
            run: 'A home router or a smart TV has a small processor and little memory. Its maker builds a cut-down Linux kernel that holds only the drivers that one circuit board needs and stores it in flash memory. You never see Linux, but it is running the device.',
            tr: ['cfg', 'free', 'port'], fit: '<b>Easily configured:</b> everything the device does not need is simply left out. <b>Free:</b> no license fee to pay on millions of units.' },
          { ic: 'phone', name: 'Phones and tablets', eg: 'every Android device',
            run: 'Every Android phone runs a Linux kernel underneath the Android software you see (that story is section 2.11). Phone makers add kernel code for their own camera, radio and touch screen.',
            tr: ['port', 'mod', 'free'], fit: '<b>Runs on many platforms:</b> phones use ARM processors, not the Intel chip Linux was first written for.' },
          { ic: 'laptop', name: 'Laptops and desktops', eg: 'Ubuntu, Fedora, Debian…',
            run: 'A <em>distribution</em> such as Ubuntu or Fedora bundles the kernel with the GNU tools, a desktop and applications. Plug in a new mouse or USB stick and the matching driver is added to the running kernel on the spot.',
            tr: ['mod', 'free'], fit: '<b>Highly modular:</b> support for thousands of devices is on the disk, but only what you use is loaded into memory.' },
          { ic: 'server', name: 'Servers and the cloud', eg: 'web servers, cloud machines',
            run: 'Most web servers, and most virtual machines rented in public clouds, run Linux. Companies read, tune and fix the source code themselves instead of waiting for a vendor.',
            tr: ['free', 'cfg', 'mod'], fit: '<b>Free and open source:</b> no per-machine fee, and anyone can inspect the code or fix a bug.' },
          { ic: 'superc', name: 'Super\u00ADcomputers', eg: 'the world\'s fastest machines',
            run: 'For years now, every one of the world\'s 500 fastest supercomputers has run Linux, spreading one job over many thousands of processors.',
            tr: ['free', 'cfg', 'port'], fit: '<b>Open source:</b> research labs rebuild and tune the kernel for their own custom hardware.' },
        ];
        let cur = 0;
        const btns = DEV.map((d, i) => h('button', { class: 'dev', type: 'button', onclick: () => show(i), 'aria-label': d.name },
          h('span', { html: `<svg viewBox="0 0 48 44" aria-hidden="true">${ICON[d.ic]}</svg>` }), h('b', {}, d.name), h('span', { class: 'xs muted center' }, d.eg)));
        const head = h('h3', { class: 'm0' });
        const run = h('p', { class: 'p15 m0' });
        const trs = TRAITS.map(([id, label]) => h('div', { class: 'tr', dataset: { id } }, label));
        const fit = h('div', { class: 'eg' });
        function show(i) {
          cur = i; const d = DEV[i];
          btns.forEach((b, j) => b.classList.toggle('on', j === i));
          head.textContent = d.name;
          run.innerHTML = d.run;
          trs.forEach((t) => t.classList.toggle('on', d.tr.includes(t.dataset.id)));
          fit.innerHTML = d.fit;
          ctx.refit();
        }
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack' },
            h('p', { class: 'lead m0', html: 'In 1991 a computer science student in Finland wrote a small kernel for his own PC and shared it on the Internet. That kernel, <span class="t">Linux</span>, now runs in routers, phones, laptops, the cloud and the world\'s fastest supercomputers.' }),
            h('div', { class: 'card tight fact' }, h('b', {}, 'UNIX-like'), h('span', {}, 'It follows the design and commands of UNIX (sections 2.8 and 2.9), but was written from scratch and contains no original UNIX code.')),
            h('div', { class: 'card tight fact' }, h('b', {}, 'Free and open'), h('span', { html: 'It is <span class="t">open source</span>: anyone may read, change and share it under the <span class="t">GNU General Public License (GPL)</span>.' })),
            h('div', { class: 'card tight fact' }, h('b', {}, 'Monolithic, yet modular'), h('span', { html: 'A <span class="t">monolithic kernel</span> (one big program), yet built from parts that can be plugged in and pulled out while it runs.' })),
            h('div', { class: 'callout analogy m0', 'data-label': 'Analogy' }, 'One engine design powers scooters and freight trucks alike: parts are added or left out to fit each vehicle.')),
          h('div', { class: 'card white stack', style: { gap: '10px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Where does Linux run? Click a device'), h('span', { class: 'xs muted' }, 'smallest → largest')),
            h('div', { class: 'devs' }, ...btns),
            h('div', { class: 'scale' }),
            h('div', { class: 'stack', style: { gap: '8px' } }, head, run),
            h('div', { class: 'stack', style: { gap: '5px' } }, h('span', { class: 'lbl' }, 'Which traits make it fit here?'), h('div', { class: 'trs' }, ...trs)),
            fit,
            h('div', { class: 'row xs muted', style: { marginTop: 'auto', gap: '6px', borderTop: '1px dashed var(--line-2)', paddingTop: '8px' } },
              h('b', {}, 'COMING UP:'), h('span', {}, 'the history  →  why it won  →  kernel designs  →  modules, hands-on  →  a tour of the kernel')))));
        show(cur);
      },
    },
    /* ---------------- 2. Timeline: 1983 groundwork to today ---------------- */
    {
      title: '1991 onward: how a hobby kernel grew up',
      kind: 'explore',
      render(el, ctx) {
        const { h } = ctx;
        if (ctx.narrow) el.classList.add('nrw');
        const ING = [['gnu', 'GNU tools fill in the rest of the system'], ['net', 'Helpers found over the Internet'], ['gpl', 'A free license (the GPL)'], ['mod', 'Modular, portable design']];
        const E = [
          { y: '1983–85', t: 'The groundwork: GNU and the FSF', ing: 'gnu', g: null,
            x: 'Programmer Richard Stallman launched the <span class="t">GNU project</span> in 1983 to build a complete UNIX-like operating system that everyone would be free to use, study, change and share. In 1985 he set up the <span class="t">Free Software Foundation (FSF)</span> to support it. Over the next few years GNU produced a compiler, a shell, a C library, editors and dozens of utilities.',
            w: 'By 1991 GNU had nearly everything a working system needs except one piece: a finished kernel.' },
          { y: '1991', t: 'A student\'s kernel', ing: 'net', g: [[1, 'one student'], [1, 'one: the Intel 80386 PC'], [1, 'his PC and a few hobbyists\'']],
            x: 'Linus Torvalds, a computer science student at the University of Helsinki in Finland, got a PC built around Intel\'s 32-bit 80386 processor (a chip first sold in 1985) and began writing a UNIX-like kernel for it, partly to learn how the chip worked. In 1991 he announced the project on the Internet and put the code online for anyone to download.',
            w: 'Posting the code in the open invited strangers to test it, report bugs and send fixes. Collaborators around the world joined in.' },
          { y: '1992', t: 'Free under the GPL', ing: 'gpl', g: [[2, 'dozens of volunteers'], [1, 'one: the 386 PC'], [2, 'hobbyists and universities']],
            x: 'Torvalds released Linux under the <span class="t">GNU General Public License (GPL)</span>. Anyone may use, study, change and share it, and whoever passes on a changed version must share those changes on the same terms. Together with the GNU tools, Linux made a complete free operating system, and the first <em>distributions</em> (kernel plus tools, ready to install) appeared.',
            w: 'No improvement could ever be locked away, so every contributor built on everyone else\'s work.' },
          { y: '1994', t: 'Version 1.0', ing: null, g: [[2, 'dozens of regular contributors'], [1, 'mainly 386 PCs'], [2, 'PC users, via distributions']],
            x: 'After about two and a half years of work by a growing crowd of volunteers, Linux 1.0 was released (March 1994): a stable kernel for 386 PCs with networking built in.',
            w: 'A stable version made Linux practical for real work, not just for experiments.' },
          { y: 'Mid 1990s', t: 'Beyond the PC', ing: 'mod', g: [[3, 'hundreds'], [3, 'several families'], [3, 'PCs and the first servers']],
            x: 'The kernel gained loadable modules, so a driver could be added while the system runs, and it was ported to processor families other than Intel\'s, such as Alpha, SPARC and MIPS. Version 2.0 (1996) could use several processors in one machine.',
            w: 'This modular, portable design is what later let Linux spread to so many different kinds of hardware.' },
          { y: '2000s', t: 'Servers, companies, gadgets', ing: null, g: [[4, 'thousands, many paid by companies'], [4, 'many families'], [4, 'servers, routers, TVs']],
            x: 'Linux became a favourite for web servers. Companies began paying engineers to improve it, and manufacturers built it into routers, TVs and other embedded devices, trimming it to fit each one.',
            w: 'Paid, professional work showed that a free, community-built kernel could be trusted with serious jobs.' },
          { y: '2008', t: 'Linux in your pocket', ing: null, g: [[4, 'thousands'], [4, 'many, now including phone chips'], [5, 'phones and tablets too']],
            x: 'The first Android phones went on sale with a Linux kernel underneath. Billions of phones and tablets have run Linux since then (section 2.11).',
            w: 'Linux became one of the most widely used kernels in the world, mostly inside devices whose owners never see it.' },
          { y: 'Today', t: 'Everywhere, built by thousands', ing: null, g: [[5, 'thousands every year'], [5, 'about twenty families'], [5, 'embedded chips to supercomputers']],
            x: 'A new kernel version appears roughly every nine or ten weeks, with changes from thousands of developers at hundreds of companies and organisations; Torvalds still coordinates the work. Linux runs on about twenty processor families, from tiny embedded chips to every one of the world\'s 500 fastest supercomputers.',
            w: 'The rest of this section shows how one kernel stretches that far: a monolithic design, built from loadable modules.' },
        ];
        let cur = 0;
        const cards = E.map((e, i) => h('button', { class: 'tlc', type: 'button', onclick: () => show(i) }, h('span', { class: 'yr' }, e.y), h('span', { class: 'tt' }, e.t)));
        const yr = h('span', { class: 'lbl' });
        const tt = h('h3', { class: 'm0' });
        const tx = h('p', { class: 'm0', style: { lineHeight: '1.6' } });
        const why = h('div', { class: 'callout why m0', 'data-label': 'Why it mattered' });
        const prev = h('button', { class: 'btn sm', type: 'button', onclick: () => show(cur - 1) }, '◀ Earlier');
        const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => show(cur + 1) }, 'Later ▶');
        const GL = ['People writing it', 'Processor families', 'Where it runs'];
        const gauges = GL.map((l) => { const segs = [0, 1, 2, 3, 4].map(() => h('i')); const v = h('span', { class: 'gv' }); return { segs, v, el: h('div', { class: 'gauge' }, h('span', { class: 'gl' }, l), h('div', { class: 'seg5' }, ...segs), v) }; });
        const gNote = h('p', { class: 'small muted m0' });
        const ings = ING.map(([id, label]) => h('div', { class: 'ing', dataset: { id } }, label));
        function show(i) {
          cur = ctx.util.clamp(i, 0, E.length - 1); const e = E[cur];
          cards.forEach((c, j) => { c.classList.toggle('on', j === cur); c.classList.toggle('past', j < cur); });
          yr.textContent = e.y; tt.textContent = e.t; tx.innerHTML = e.x; why.innerHTML = e.w;
          gauges.forEach((g, k) => { const lv = e.g ? e.g[k][0] : 0; g.segs.forEach((s, j) => s.classList.toggle('on', j < lv)); g.v.textContent = e.g ? e.g[k][1] : '—'; });
          gNote.textContent = e.g ? 'Rough, qualitative levels: how big Linux had grown by this point.' : 'Linux does not exist yet. The gauges start to fill in 1991.';
          const have = new Set(E.slice(0, cur + 1).map((x) => x.ing).filter(Boolean));
          ings.forEach((n) => { n.classList.toggle('on', have.has(n.dataset.id)); n.classList.toggle('new', n.dataset.id === e.ing); });
          prev.disabled = cur === 0; next.disabled = cur === E.length - 1;
          ctx.refit();
        }
        el.append(h('div', { class: 'stack fill' },
          h('div', { class: 'tl8' }, ...cards),
          h('div', { class: 'split r grow' },
            h('div', { class: 'card white stack', style: { gap: '10px' } }, h('div', { class: 'stack', style: { gap: '2px' } }, yr, tt), tx, why,
              h('div', { class: 'row', style: { marginTop: 'auto' } }, prev, next, h('span', { class: 'xs muted' }, 'or click any card above'))),
            h('div', { class: 'card stack', style: { gap: '12px' } },
              h('span', { class: 'lbl' }, 'Linux at this point'), ...gauges.map((g) => g.el), gNote,
              h('div', { class: 'stack', style: { gap: '6px', marginTop: 'auto' } }, h('span', { class: 'lbl' }, 'Ingredients of success, collected so far'), h('div', { class: 'ings' }, ...ings))))));
        show(0);
      },
    },
    /* ---------------- 3. Why it won: the missing kernel + the GPL deal ---------------- */
    {
      title: 'Why it won: a free license and the GNU tools',
      kind: 'learn',
      render(el, ctx) {
        const { h } = ctx;
        /* left: the layers of a complete system, before and after Linux */
        const LAYERS = [
          ['u', 'Your programs', 'editors such as GNU Emacs, games, tools', 'GNU + others'],
          ['u', 'Shell', 'bash, the command line you type into', 'GNU'],
          ['u', 'Basic commands', 'ls, cp, mv, grep and friends', 'GNU'],
          ['u', 'C library', 'printf() and friends; wraps system calls', 'GNU'],
          ['u', 'Compiler', 'GCC, which builds all of the above', 'GNU'],
        ];
        const lays = h('div', { class: 'lays' });
        const cap = h('div', { class: 'callout m0 p15' });
        let mode = 'before';
        function paintStack() {
          const kernel = mode === 'before'
            ? h('div', { class: 'lay miss' }, h('div', { html: '<b>Kernel: missing</b> <small style="color:inherit">GNU\'s own kernel was not ready yet</small>' }), h('span', { class: 'who' }, 'GAP'))
            : h('div', { class: 'lay k flash' }, h('div', { html: '<b>Kernel: Linux</b> <small>by Torvalds and collaborators worldwide</small>' }), h('span', { class: 'who' }, 'LINUX'));
          lays.replaceChildren(
            ...LAYERS.map(([c, n, d, w]) => h('div', { class: 'lay ' + c }, h('div', { html: `<b>${n}</b> <small>${d}</small>` }), h('span', { class: 'who' }, w))),
            kernel,
            h('div', { class: 'lay hw' }, h('div', { html: '<b>Hardware</b> <small>an Intel 80386 PC in 1991</small>' }), h('span', { class: 'who' }, 'CHIPS')));
          cap.className = 'callout m0 p15 ' + (mode === 'before' ? 'bad' : 'tip');
          cap.setAttribute('data-label', mode === 'before' ? 'A system with a hole in it' : 'A complete, free system');
          cap.innerHTML = mode === 'before'
            ? 'The <span class="t">GNU project</span> had built almost every layer, but tools cannot run without a kernel underneath. Its own kernel was still far from finished, so the free system could not stand on its own.'
            : 'Linux filled the gap. Because it was UNIX-like, the GNU tools ran on it with little change, and GCC could even compile Linux itself. That pairing is why some people call the whole system <b>GNU/Linux</b>; strictly, <b>Linux</b> is just the kernel.';
          ctx.refit();
        }
        const seg = ctx.ui.seg([{ value: 'before', label: 'GNU alone, 1991' }, { value: 'after', label: 'GNU + Linux, 1992' }], mode, (v) => { mode = v; paintStack(); });

        /* right: the GPL deal, one scenario at a time */
        const SC = [
          { q: 'You download the Linux source code and read it to learn how the scheduler works.', a: true,
            why: 'The GPL guarantees the freedom to <b>study</b> the code. Publishing the source is the whole point.' },
          { q: 'You change the kernel for your own robot and never give the robot, or the code, to anyone.', a: true,
            why: 'The duty to share only applies when you <b>distribute</b> the software. Private changes may stay private.' },
          { q: 'Your company sells a router running a changed Linux kernel and keeps those kernel changes secret.', a: false,
            why: 'Selling the router distributes the kernel, so buyers must be able to get its source code, <b>including your changes</b>, under the GPL.' },
          { q: 'You sell USB sticks with a Linux distribution on them.', a: true,
            why: '"Free" means <b>freedom</b>, not zero price. You may charge for copies, as long as buyers get the same freedoms and the source.' },
          { q: 'You copy part of the Linux kernel into a new program and release it under a license that forbids sharing.', a: false,
            why: 'This is <span class="t">copyleft</span>: distributed work built from GPL code must stay under the GPL, so shared code can never be turned into a closed product.' },
        ];
        let qi = 0; const res = SC.map(() => null);
        const dots = h('div', { class: 'gdots' });
        const box = h('div', { class: 'scen' });
        const fb = h('div', { class: 'fb' });
        const bYes = h('button', { class: 'btn ok', type: 'button', style: { borderColor: 'var(--ok)', color: 'var(--ok)' }, onclick: () => answer(true) }, '✓ Allowed');
        const bNo = h('button', { class: 'btn', type: 'button', style: { borderColor: 'var(--bad)', color: 'var(--bad)' }, onclick: () => answer(false) }, '✗ Not allowed');
        const bNext = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { qi = (qi + 1) % (SC.length + 1); if (qi === 0) res.fill(null); paintQ(); } });
        function answer(v) {
          if (qi >= SC.length || res[qi] !== null) return;
          res[qi] = v === SC[qi].a; paintQ();
        }
        function paintQ() {
          dots.replaceChildren(...SC.map((_, i) => h('i', { class: res[i] === true ? 'ok' : res[i] === false ? 'bad' : i === qi ? 'cur' : '' })));
          if (qi >= SC.length) {
            const n = res.filter(Boolean).length;
            box.innerHTML = `<div class="lbl">All five done</div><b>You judged ${n} of ${SC.length} correctly.</b> The GPL in one line: use, study, change and share freely, and if you pass the software on, pass on the same freedoms and the source code too.`;
            fb.replaceChildren(); bYes.disabled = bNo.disabled = true; bNext.textContent = '↺ Start again'; bNext.style.display = '';
          } else {
            const s = SC[qi], done = res[qi] !== null;
            box.innerHTML = `<div class="lbl">Scenario ${qi + 1} of ${SC.length}</div>${s.q}`;
            bYes.disabled = bNo.disabled = done;
            fb.replaceChildren(done ? h('div', { class: 'callout m0 ' + (res[qi] ? 'tip' : 'bad'), 'data-label': (res[qi] ? 'Correct: ' : 'Not quite: ') + (s.a ? 'allowed' : 'not allowed'), html: s.why }) : h('p', { class: 'small muted m0' }, 'Decide, then read why.'));
            bNext.textContent = qi === SC.length - 1 ? 'See the summary ▶' : 'Next scenario ▶';
            bNext.style.display = done ? '' : 'none';
          }
          ctx.refit();
        }
        el.append(h('div', { class: 'split fill' },
          h('div', { class: 'card white stack', style: { gap: '10px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'The layers of a complete system'), seg),
            lays, cap),
          h('div', { class: 'card stack', style: { gap: '10px' } },
            h('h3', { class: 'm0', html: 'The <span class="t">GPL</span> deal: allowed or not?' }),
            h('p', { class: 'small m0' }, 'Linux is free and open source under the GNU General Public License. For each case, decide whether the license allows it.'),
            dots, box, h('div', { class: 'row' }, bYes, bNo), fb, h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, bNext),
            h('div', { class: 'row', style: { marginTop: 'auto', gap: '6px', paddingTop: '8px', borderTop: '1px dashed var(--line-2)' } },
              h('span', { class: 'lbl' }, 'The deal:'), ...['run', 'study', 'change', 'share'].map((x) => h('span', { class: 'chip ok' }, x)),
              h('span', { class: 'small' }, '+ pass the same freedoms on')))));
        paintStack(); paintQ();
      },
    },
    /* ---------------- 4. Compare: monolithic vs microkernel vs Linux ---------------- */
    {
      title: 'Monolithic, microkernel, or Linux\'s middle way?',
      kind: 'compare',
      render(el, ctx) {
        const { h, s } = ctx;
        const BY = 148; // y of the user/kernel boundary in the diagram
        const DES = {
          mono: { label: 'Monolithic', name: 'Monolithic kernel',
            sum: 'A <span class="t">monolithic kernel</span> puts the whole OS into one big program in kernel space. Its parts call each other directly, as ordinary functions, and they all share one address space.',
            rows: [['ok', 'Request speed:', 'fast. One trip into the kernel and back; the parts call each other directly.'], ['bad', 'A driver bug:', 'can crash everything, because there are no walls between the parts.'], ['bad', 'Adding a driver:', 'rebuild the kernel and restart the machine.'], ['', 'Examples:', 'traditional UNIX kernels; the earliest Linux, before modules.']],
            wp: { app: [105, 30], fs: [322, 214], drv: [442, 214] },
            path: [['fs', 'A system call traps into the kernel, and the file-system code runs.'], ['drv', 'The file system calls the disk driver: an ordinary function call inside the kernel.'], ['disk', 'The driver tells the disk to read the block.'], ['fs', 'The driver returns the data to the file system.'], ['app', 'The kernel returns to the app with the data.']],
            end: 'Everything happened inside one program, using plain function calls. That is why monolithic kernels are fast.',
            crash: ['The disk driver follows a bad pointer and scribbles over kernel memory.', 'Every part runs in kernel mode in one shared address space, so nothing stops the damage. The whole system stops and must be restarted.'] },
          micro: { label: 'Microkernel', name: 'Microkernel',
            sum: 'A <span class="t">microkernel</span> keeps only message passing, address spaces and basic scheduling. File systems and drivers are ordinary server processes in user space.',
            rows: [['warn', 'Request speed:', 'slower. One request becomes several messages, each a trip into and out of the kernel.'], ['ok', 'A driver bug:', 'contained. A crashed server is restarted while the rest keeps running.'], ['ok', 'Adding a driver:', 'start a new server process; the kernel is untouched.'], ['', 'Examples:', 'MINIX 3, QNX, seL4.']],
            wp: { app: [86, 30], k: [320, 188], fs: [240, 30], drv: [394, 30] },
            path: [['k', 'The request must travel as a message, so the app traps into the microkernel.'], ['fs', 'The microkernel delivers the message to the file-server process.'], ['k', 'The file server sends a message asking the disk-driver server for the block.'], ['drv', 'The microkernel delivers it to the disk-driver server.'], ['disk', 'The driver server operates the disk.'], ['k', 'It sends the data back in a reply message.'], ['fs', 'The microkernel delivers the reply to the file server.'], ['k', 'The file server sends its own reply to the app.'], ['app', 'The microkernel delivers it, and read() returns.']],
            end: 'Each message is one trip through the kernel (two crossings: in and out), plus a switch between processes. That extra work is the price of the walls between the parts.',
            crash: ['The disk-driver server crashes.', 'It was only a user process in its own address space. The microkernel and the other servers keep running; the driver server is restarted and the file server simply retries.'] },
          linux: { label: 'Linux: modular monolithic', name: 'Linux: monolithic, built from modules',
            sum: 'One big kernel program, like a monolithic kernel, but much of it (file systems, drivers, protocols) comes as <span class="t">loadable modules</span> that are linked in while the system runs.',
            rows: [['ok', 'Request speed:', 'fast. A loaded module is called directly, exactly like built-in code.'], ['bad', 'A driver bug:', 'can crash everything. A module runs in kernel mode with full privileges.'], ['ok', 'Adding a driver:', 'load a module into the running kernel; no rebuild, no restart.'], ['', 'Examples:', 'Linux; many other modern kernels also load drivers while running.']],
            wp: { app: [105, 30], fs: [311, 214], drv: [431, 214] },
            path: [['fs', 'A system call traps into the kernel, and the vfat file-system module runs.'], ['drv', 'vfat\'s request is passed down (through the kernel\'s block layer) to the usb_storage driver module: direct function calls, just like built-in code.'], ['disk', 'The driver tells the USB stick to read the block.'], ['fs', 'The driver returns the data to vfat.'], ['app', 'The kernel returns to the app with the data.']],
            end: 'Exactly like a monolithic kernel. Once it is linked in, a module is simply part of the one kernel program.',
            crash: ['A bug in the usb_storage module writes over kernel memory.', 'The module runs in kernel mode inside the one shared address space, so it can damage anything. Linux can sometimes survive by killing just the current process (an "oops"), but a serious bug stops the whole system (a "kernel panic").'] },
        };
        const st = { d: 'mono', lit: null, crash: 0, disk: false };
        const cnt = { x: 0, m: 0 };
        let run = 0;
        const svg = s('svg', { viewBox: '0 0 640 392', width: '100%' });
        const gS = s('g', {});
        const tok = s('circle', { r: 9, cx: 0, cy: 0, class: 'tok', style: 'fill:var(--chc);stroke:var(--panel);stroke-width:3;opacity:0' });
        svg.append(gS, tok);
        function R(key, x, y, w, hh, cls, lines, o = {}) {
          const over = st.over[key];
          const lit = st.lit === key || (key === 'disk' && st.disk);
          const styl = [over ? '' : (o.style || ''), lit ? 'stroke:var(--chc)' : ''].filter(Boolean).join(';') || null;
          const g = s('g', { opacity: o.op || null });
          g.append(s('rect', { x, y, width: w, height: hh, rx: 10, class: over || cls, 'stroke-width': lit ? 4 : 2, 'stroke-dasharray': o.dash || null, style: styl }));
          const n = lines.length, lh = 17, y0 = y + hh / 2 - ((n - 1) * lh) / 2 + 5;
          lines.forEach((t, i) => g.append(s('text', { x: x + w / 2, y: y0 + i * lh, 'text-anchor': 'middle', 'font-size': i ? 13 : 14.5, 'font-weight': i ? 400 : 700, class: i ? 's-sub' : null, style: o.mono && !i ? 'font-family:var(--mono)' : null }, t)));
          return g;
        }
        function paint() {
          const d = st.d, dead = st.crash === 2 && d !== 'micro';
          st.over = {};
          if (st.crash) st.over.drv = st.crash === 2 && d === 'micro' ? 's-ok' : 's-intr';
          if (dead) st.over.block = 's-intr';
          const k = [
            s('text', { x: 10, y: 141, 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '1' }, 'USER SPACE ↑'),
            s('line', { x1: 4, y1: BY, x2: 636, y2: BY, class: 's-line', 'stroke-dasharray': '7 5' }),
            s('text', { x: 10, y: 167, 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '1' }, 'KERNEL SPACE ↓'),
            s('text', { x: 632, y: 141, 'font-size': 13, 'text-anchor': 'end', class: 's-sub' }, 'system-call boundary'),
            s('line', { x1: 4, y1: 322, x2: 636, y2: 322, class: 's-muted', 'stroke-width': 1.5 }),
            s('text', { x: 10, y: 344, 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '1' }, 'HARDWARE'),
          ];
          const op = dead ? 0.4 : null;
          if (d === 'micro') {
            k.push(R('app', 16, 30, 140, 80, 's-proc', ['App', 'calls read()']),
              R('fs', 170, 30, 140, 80, 's-proc', ['File server', 'user process']),
              R('drv', 324, 30, 140, 80, 's-proc', st.crash === 2 ? ['Disk driver', 'restarted ✓'] : ['Disk driver', 'server process']),
              R('net', 478, 30, 146, 80, 's-proc', ['Network', 'server process']),
              R('k', 190, 188, 260, 104, 's-os', ['Microkernel', 'passes messages · address', 'spaces · basic scheduling']),
              R('disk', 342, 334, 104, 50, 's-io', ['Disk']));
          } else {
            const lin = d === 'linux', bw = lin ? 478 : 608;
            k.push(R('app', 30, 30, 150, 80, 's-proc', ['App', 'calls read()'], { op }));
            k.push(s('rect', { x: 16, y: 180, width: bw, height: 124, rx: 12, class: st.over.block || 's-os', 'stroke-width': 2 }));
            k.push(s('text', { x: 30, y: 201, 'font-size': 13.5, 'font-weight': 700, style: dead ? 'fill:var(--intr)' : null },
              dead ? 'KERNEL PANIC: the whole system is down' : lin ? 'Core kernel + loaded modules: one address space' : 'One big kernel program: one address space, all in kernel mode'));
            const P = 'fill:var(--panel)';
            if (lin) {
              k.push(R('sch', 28, 214, 104, 78, 's-os', ['Scheduler'], { style: P }), R('mem', 142, 214, 104, 78, 's-os', ['Memory', 'manager'], { style: P }),
                R('fs', 256, 214, 110, 78, 's-os', ['vfat', 'file system', 'MODULE'], { style: P, dash: '6 4', mono: true }),
                R('drv', 376, 214, 110, 78, 's-io', ['usb_storage', 'driver', 'MODULE'], { dash: '6 4', mono: true }),
                s('rect', { x: 506, y: 180, width: 118, height: 124, rx: 12, class: 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }),
                s('text', { x: 565, y: 203, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'Not loaded:'),
                s('text', { x: 565, y: 219, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'still on disk'),
                ...['bluetooth.ko', 'nfs.ko', 'btrfs.ko'].map((m, i) => s('text', { x: 565, y: 246 + i * 19, 'text-anchor': 'middle', 'font-size': 13, style: 'font-family:var(--mono)' }, m)),
                R('disk', 376, 334, 110, 50, 's-io', ['USB stick']));
            } else {
              k.push(...[['sch', ['Scheduler']], ['mem', ['Memory', 'manager']], ['fs', ['File', 'system']], ['drv', ['Disk', 'driver']], ['net', ['Network', 'stack']]].map(([key, t], i) => R(key, 28 + i * 120, 214, 108, 78, 's-os', t, { style: P })),
                R('disk', 388, 334, 108, 50, 's-io', ['Disk']));
            }
          }
          gS.replaceChildren(...k);
          cX.textContent = cnt.x; cM.textContent = cnt.m;
        }
        const cX = h('b', {}, '0'), cM = h('b', {}, '0');
        const status = h('div', { class: 'callout m0 p15' });
        function say(cls, label, html) { status.className = 'callout m0 p15 ' + cls; status.setAttribute('data-label', label); status.innerHTML = html; ctx.refit(); }
        function idle() {
          if (st.d === 'linux') say('warn', 'Common mistake', 'Modules do not turn Linux into a microkernel. A loaded module becomes part of the one kernel program: same address space, same kernel mode, no messages.');
          else say('tip', 'Try it', 'Send a <code>read()</code> request and watch the counters. Then crash the disk driver and see how far the damage spreads.');
        }
        function place(key) { const p = DES[st.d].wp[key]; tok.style.transform = `translate(${p[0]}px, ${p[1]}px)`; }
        function reset() { run++; st.lit = null; st.crash = 0; st.disk = false; cnt.x = 0; cnt.m = 0; tok.style.opacity = 0; paint(); idle(); }
        async function sendRead() {
          const my = ++run, d = DES[st.d];
          st.crash = 0; st.disk = false; st.lit = 'app'; cnt.x = 0; cnt.m = 0;
          tok.style.transition = 'none'; place('app'); tok.style.opacity = 1; tok.getBoundingClientRect(); tok.style.transition = '';
          paint(); say('', 'Step 1', 'The app calls <code>read()</code> to get data from a file.');
          let at = 'app', n = 1;
          for (const [to, msg] of d.path) {
            await ctx.sleep(1000); if (!ctx.alive || my !== run) return;
            n++;
            if (to === 'disk') { st.disk = true; paint(); say('', 'Step ' + n, msg); continue; }
            st.disk = false;
            const a = d.wp[at], b = d.wp[to];
            if ((a[1] < BY) !== (b[1] < BY)) cnt.x++;
            if (to === 'k') cnt.m++;
            at = to; st.lit = to; place(to); paint(); say('', 'Step ' + n, msg);
          }
          await ctx.sleep(1000); if (!ctx.alive || my !== run) return;
          st.lit = null; tok.style.opacity = 0; paint();
          say(st.d === 'micro' ? 'warn' : 'tip', 'Result', `<b>${cnt.x} crossings, ${cnt.m} messages.</b> ${d.end}`);
        }
        async function crash() {
          const my = ++run, d = DES[st.d];
          tok.style.opacity = 0; st.lit = null; st.disk = false; st.crash = 1; cnt.x = 0; cnt.m = 0; paint();
          say('bad', 'Crash, stage 1', d.crash[0]);
          await ctx.sleep(1300); if (!ctx.alive || my !== run) return;
          st.crash = 2; paint();
          say(st.d === 'micro' ? 'tip' : 'bad', 'Crash, stage 2', d.crash[1]);
        }
        const cardH = h('h3', { class: 'm0' }), cardS = h('p', { class: 'small m0' }), rowsEl = h('div', { class: 'stack', style: { gap: '7px' } });
        function paintCard() {
          const d = DES[st.d]; cardH.textContent = d.name; cardS.innerHTML = d.sum;
          rowsEl.replaceChildren(...d.rows.map(([v, k, t]) => h('div', { class: 'prow' }, h('span', { class: 'vd ' + v }, v === 'ok' ? '✓' : v === 'bad' ? '✗' : v === 'warn' ? '!' : '•'), h('div', {}, h('b', {}, k), ' ', h('span', {}, t)))));
        }
        const seg = ctx.ui.seg(Object.entries(DES).map(([value, d]) => ({ value, label: d.label })), st.d, (v) => { st.d = v; paintCard(); reset(); });
        el.append(h('div', { class: 'split r fill' },
          h('div', { class: 'card white stack', style: { gap: '8px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Choose a design'), seg),
            svg,
            h('div', { class: 'row', style: { gap: '8px', marginTop: 'auto' } },
              h('button', { class: 'btn primary sm', type: 'button', onclick: sendRead }, '▶ Send a read() request'),
              h('button', { class: 'btn danger sm', type: 'button', onclick: crash }, 'Crash the disk driver'),
              h('button', { class: 'btn ghost sm', type: 'button', onclick: reset }, '↺ Reset'))),
          h('div', { class: 'stack' },
            h('div', { class: 'card stack', style: { gap: '8px' } }, cardH, cardS, rowsEl),
            h('div', { class: 'grid-2', style: { gap: '10px' } },
              h('div', { class: 'card tight score' }, cX, h('span', {}, 'user ↔ kernel crossings')),
              h('div', { class: 'card tight score' }, cM, h('span', {}, 'messages between processes'))),
            status)));
        paintCard(); reset();
      },
    },
    /* ---------------- 5. Loadable modules: dynamic linking + stacking ---------------- */
    {
      title: 'Loadable modules: plugging code into a running kernel',
      kind: 'explore',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h, s } = ctx;
        const T = (x, y, t, o) => s('text', Object.assign({ x, y, 'font-size': 13 }, o || {}), t);
        const MONO = 'font-family:var(--mono)';
        const LBL = { 'font-weight': 800, class: 's-sub', 'letter-spacing': '1' };
        /* ---- tab 1: watch usb_storage being loaded, linked, used and unloaded ---- */
        function linkTab(p) {
          const svg = s('svg', { viewBox: '0 0 680 300', width: '100%' });
          const SYM = [['printk', '0xc01a2f40', 'core kernel'], ['usb_register_driver', '0xf8a01200', 'usbcore'], ['usb_submit_urb', '0xf8a03480', 'usbcore']];
          const NEW = ['usb_stor_probe1', '0xf8b10a60', 'usb_storage'];
          const NEEDS = [['usb_register_driver', '0xf8a01200'], ['usb_submit_urb', '0xf8a03480'], ['printk', '0xc01a2f40']];
          const CAP = [
            '<b>Before.</b> The kernel is running and the <code>usbcore</code> module is already loaded: its entry is in the module table and its exported functions are in the symbol table. You plug in a USB flash drive, but no loaded code knows how to drive it.',
            '<b>1. Read the file.</b> A loader command (<code>insmod</code>) reads <code>usb_storage.ko</code> from disk. It holds machine code plus a list of names the code calls but does not contain: its <b>unresolved symbols</b>.',
            '<b>2. Copy it in.</b> The kernel sets aside some kernel memory and copies the module\'s code and data into it. The system keeps running the whole time: there is no reboot.',
            '<b>3. Link it: <span class="t">dynamic linking</span>.</b> Each unresolved name is looked up in the kernel\'s <span class="t">symbol table</span>, and its real address is written into every place the module calls it. A call to <code>usb_register_driver</code> now jumps straight into usbcore.',
            '<b>4. Record it.</b> An entry for usb_storage goes at the <b>front</b> of the <span class="t">module table</span> (a linked list). It notes that usb_storage depends on usbcore, so usbcore can no longer be removed. Its own exported symbols join the symbol table, ready for modules stacked above it.',
            '<b>5. Start it.</b> The module\'s init function runs once. It calls <code>usb_register_driver</code> to tell usbcore "send me any USB storage device". usbcore hands over the flash drive, which now shows up as a disk.',
            '<b>In use.</b> A program (<code>cp</code>) copies a file from the stick. Its <code>read()</code> system calls lead the kernel to call the module\'s functions, in kernel mode, <b>on behalf of that process</b>. The module never becomes a process of its own and sends no messages: the kernel simply calls it.',
            '<b>Unload.</b> Once the stick is unmounted and nothing uses the module, <code>rmmod</code> runs its exit function, removes its symbols, unlinks its node from the list and frees its memory. Again, no reboot.',
          ];
          function draw(i) {
            const inMem = i >= 2 && i <= 6, linked = i >= 3 && i <= 6, listed = i >= 4 && i <= 6;
            const k = [
              T(8, 14, 'ON DISK', LBL), T(190, 14, 'KERNEL MEMORY (THE KERNEL KEEPS RUNNING THROUGHOUT)', LBL),
              s('rect', { x: 4, y: 22, width: 174, height: 272, rx: 12, class: 's-panel', 'stroke-width': 1.5 }),
              s('rect', { x: 186, y: 22, width: 490, height: 272, rx: 12, class: 's-os', 'stroke-width': 1.5, style: 'fill:none' }),
              s('rect', { x: 10, y: 32, width: 162, height: 150, rx: 8, class: 's-io', 'stroke-width': i === 1 ? 4 : 2, style: i === 1 ? 'stroke:var(--chc)' : null }),
              T(91, 52, 'usb_storage.ko', { 'text-anchor': 'middle', 'font-weight': 800, style: MONO }),
              T(91, 71, 'machine code + data', { 'text-anchor': 'middle', class: 's-sub' }),
              s('line', { x1: 18, y1: 82, x2: 164, y2: 82, class: 's-muted', 'stroke-width': 1 }),
              T(17, 101, 'unresolved names:', { 'font-weight': 700, style: 'fill:var(--intr)' }),
              ...NEEDS.map(([n], j) => T(17, 122 + j * 19, n, { style: MONO })),
              T(90, 208, i === 7 ? 'still on disk, ready' : 'stays on disk; a copy', { 'text-anchor': 'middle', class: 's-sub' }),
              T(90, 226, i === 7 ? 'for next time' : 'is made in memory', { 'text-anchor': 'middle', class: 's-sub' }),
              /* usbcore (already loaded) */
              s('rect', { x: 468, y: 34, width: 198, height: 106, rx: 10, class: 's-os', 'stroke-width': 2, 'stroke-dasharray': '6 4', style: 'fill:var(--panel)' }),
              T(478, 54, 'usbcore (module)', { 'font-weight': 800, style: MONO }),
              T(478, 74, 'contains and exports:', { class: 's-sub' }),
              T(478, 94, 'usb_register_driver()', { style: MONO }), T(478, 112, 'usb_submit_urb()', { style: MONO }),
            ];
            if (i === 1 || i === 2) k.push(s('line', { x1: 173, y1: 100, x2: 195, y2: 100, 'stroke-width': 3, style: 'stroke:var(--chc)', 'marker-end': 'url(#arr-accent)' }));
            if (inMem) {
              k.push(s('rect', { x: 198, y: 34, width: 262, height: 106, rx: 10, class: 's-os', 'stroke-width': i === 2 || i >= 5 ? 4 : 2, 'stroke-dasharray': '6 4', style: 'fill:var(--panel)' + (i === 2 || i >= 5 ? ';stroke:var(--chc)' : '') }),
                T(208, 54, 'usb_storage (module)', { 'font-weight': 800, style: MONO }),
                T(208, 74, 'its calls → target address', { class: 's-sub' }),
                ...NEEDS.map(([n, a], j) => [T(208, 94 + j * 18, n, { style: MONO }), T(450, 94 + j * 18, linked ? a : '????', { 'text-anchor': 'end', 'font-weight': 700, style: MONO + ';fill:var(' + (linked ? '--ok' : '--intr') + ')' })]).flat());
              if (i === 5) k.push(T(450, 54, 'init() ran ✓', { 'text-anchor': 'end', 'font-weight': 700, style: 'fill:var(--ok)' }));
              if (i === 6) k.push(T(450, 54, 'running for cp', { 'text-anchor': 'end', 'font-weight': 700, style: 'fill:var(--proc)' }));
            } else if (i !== 1) {
              k.push(s('rect', { x: 198, y: 34, width: 262, height: 106, rx: 10, class: 's-muted', 'stroke-dasharray': '4 5' }), T(329, 92, i === 7 ? 'memory freed' : 'free kernel memory', { 'text-anchor': 'middle', class: 's-sub' }));
            } else {
              k.push(s('rect', { x: 198, y: 34, width: 262, height: 106, rx: 10, class: 's-muted', 'stroke-dasharray': '4 5' }), T(329, 92, 'about to be filled…', { 'text-anchor': 'middle', class: 's-sub' }));
            }
            /* symbol table */
            const rows = SYM.concat(listed ? [NEW] : []);
            k.push(s('rect', { x: 198, y: 150, width: 338, height: 140, rx: 10, class: 's-panel', 'stroke-width': 1.5 }),
              T(208, 168, 'KERNEL SYMBOL TABLE', LBL),
              T(208, 188, 'name', { class: 's-sub' }), T(366, 188, 'address', { class: 's-sub' }), T(456, 188, 'from', { class: 's-sub' }));
            rows.forEach(([n, a, f], j) => {
              const y = 208 + j * 20, hot = (i === 3 && j < 3) || (i === 4 && j === 3);
              if (hot) k.push(s('rect', { x: 202, y: y - 14, width: 330, height: 19, rx: 4, style: 'fill:var(--accent-bg);stroke:var(--accent)', 'stroke-width': 1 }));
              k.push(T(208, y, n, { style: MONO }), T(366, y, a, { style: MONO }), T(456, y, f, {}));
            });
            /* module list: a linked list, newest node first */
            const nodes = listed ? ['usb_storage', 'usbcore'] : ['usbcore'];
            k.push(s('rect', { x: 546, y: 150, width: 120, height: 140, rx: 10, class: 's-panel', 'stroke-width': 1.5 }), T(553, 168, 'MODULE TABLE', Object.assign({}, LBL, { 'letter-spacing': '0' })), T(556, 188, 'head', { class: 's-sub', style: MONO }));
            const ptr = (y0) => [s('line', { x1: 606, y1: y0, x2: 606, y2: y0 + 6, class: 's-line', 'stroke-width': 1.5 }), s('path', { d: `M600 ${y0 + 5} L612 ${y0 + 5} L606 ${y0 + 11} Z`, style: 'fill:var(--ink-2)' })];
            let y = 192;
            nodes.forEach((n, j) => {
              k.push(...ptr(y)); y += 12;
              const hot = i === 4 && j === 0;
              k.push(s('rect', { x: 552, y, width: 108, height: 22, rx: 6, class: 's-os', 'stroke-width': hot ? 3 : 1.5, style: hot ? 'stroke:var(--chc)' : null }), T(606, y + 16, n, { 'text-anchor': 'middle', style: MONO }));
              y += 22;
            });
            k.push(...ptr(y), T(606, y + 26, 'NULL', { 'text-anchor': 'middle', class: 's-sub', style: MONO }));
            svg.replaceChildren(...k);
          }
          const player = ctx.ui.player({ count: CAP.length, render: (i) => { draw(i); return CAP[i]; }, interval: 3400 });
          p.append(h('div', { class: 'stack', style: { gap: '8px' } }, svg, player.el));
        }
        /* ---- tab 2: a real module stack; click a module to see what it needs and what needs it ---- */
        function stackTab(p) {
          const N = {
            uas: { x: 160, y: 8, w: 110, d: 'A faster way of talking to USB disks. It reuses code from usb_storage and from usbcore.' },
            usb_storage: { x: 24, y: 80, w: 140, d: 'The driver for USB flash drives and USB disks.' },
            xhci_hcd: { x: 250, y: 80, w: 110, d: 'The driver for the USB controller chip, the hardware behind the USB ports.' },
            usbcore: { x: 24, y: 152, w: 336, d: 'The USB core: code that every USB driver needs, such as registering a driver or sending a request to a device.' },
            vfat: { x: 420, y: 80, w: 100, d: 'The VFAT file system, the format most USB sticks use.' },
            msdos: { x: 540, y: 80, w: 100, d: 'The older MS-DOS file system, a close cousin of VFAT.' },
            fat: { x: 440, y: 152, w: 180, d: 'Shared code for every file system in the FAT family.' },
          };
          const E = [['uas', 'usb_storage', 180, 140], ['uas', 'usbcore', 230, 230], ['usb_storage', 'usbcore', 94, 94], ['xhci_hcd', 'usbcore', 305, 305], ['vfat', 'fat', 470, 490], ['msdos', 'fat', 590, 570]];
          let sel = 'usbcore';
          const svg = s('svg', { viewBox: '0 0 660 196', width: '100%' });
          const info = h('div', { class: 'card white tight stack', style: { gap: '5px' } });
          function paint() {
            const needs = E.filter((e) => e[0] === sel).map((e) => e[1]);
            const by = E.filter((e) => e[1] === sel).map((e) => e[0]);
            const k = [T(420, 14, 'Click any module.', { 'font-weight': 700 }), T(420, 32, 'Arrow = "uses code from"', { class: 's-sub' }), T(420, 50, 'green = what it needs', { style: 'fill:var(--ok)', 'font-weight': 700 }), T(420, 68, 'orange = what needs it', { style: 'fill:var(--warn)', 'font-weight': 700 })];
            E.forEach(([a, b, x1, x2]) => {
              const col = a === sel ? '--ok' : b === sel ? '--warn' : null;
              k.push(s('line', { x1, y1: N[a].y + 40, x2, y2: N[b].y - 3, 'stroke-width': col ? 3 : 2, class: col ? null : 's-muted', style: col ? `stroke:var(${col})` : null, 'marker-end': col === '--ok' ? 'url(#arr-ok)' : col === '--warn' ? 'url(#arr-warn)' : 'url(#arr-muted)' }));
            });
            Object.entries(N).forEach(([n, o]) => {
              const c = n === sel ? 's-accent' : needs.includes(n) ? 's-ok' : by.includes(n) ? 's-warn' : 's-os';
              k.push(s('g', { class: 'mnode hot', role: 'button', tabindex: 0, 'aria-label': n, onclick: () => { sel = n; paint(); }, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel = n; paint(); } } },
                s('rect', { x: o.x, y: o.y, width: o.w, height: 40, rx: 9, class: c, 'stroke-width': n === sel ? 3.5 : 2 }),
                T(o.x + o.w / 2, o.y + 25, n, { 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 14.5, style: MONO })));
            });
            svg.replaceChildren(...k);
            const refs = by.length;
            info.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { class: 'mono' }, sel), h('span', { class: 'chip ' + (refs ? 'warn' : 'ok') }, 'reference count ' + refs)),
              h('p', { class: 'small m0' }, N[sel].d),
              h('div', { class: 'small', html: `<span class="chip ok">needs</span> ${needs.length ? needs.join(', ') : 'nothing below it: it is a bottom library'} &nbsp; <span class="chip warn">needed by</span> ${by.length ? by.join(', ') : 'no other module'}` }),
              h('div', { class: 'small b', style: { color: refs ? 'var(--warn)' : 'var(--ok)' } }, refs ? `rmmod ${sel}: refused while ${by.join(', ')} ${by.length > 1 ? 'are' : 'is'} loaded.` : `rmmod ${sel}: allowed, provided nothing is using it right now (usecount 0).`));
            ctx.refit();
          }
          paint();
          p.append(h('div', { class: 'stack', style: { gap: '10px' } },
            svg, info,
            h('div', { class: 'grid-2', style: { gap: '10px' } },
              h('div', { class: 'card tight small' }, h('b', {}, 'No duplicated code. '), 'Shared code (every USB driver needs usbcore) is written and loaded once, in a lower module.'),
              h('div', { class: 'card tight small' }, h('b', {}, 'Safe loading and unloading. '), 'Counted references let the kernel load prerequisites first and refuse to remove a module others need.'))));
        }
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'lead m0', html: 'A <span class="t">loadable module</span> is a relatively independent block of kernel code that does one specific job.' }),
            h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'chip os' }, 'vfat · file system'), h('span', { class: 'chip io' }, 'usb_storage · driver'), h('span', { class: 'chip accent' }, 'bluetooth · protocol')),
            h('p', { class: 'p15 m0', html: 'Modules are loaded into the kernel and removed from it <b>while the system runs</b>. A loaded module is not a separate process: its code runs in <span class="t">kernel mode</span> on behalf of whichever process is running, for example during that process\'s <span class="t">system call</span>.' }),
            h('div', { class: 'card os prop' }, h('b', {}, '1 · Dynamic linking'), h('span', {}, 'A module is loaded and linked into the kernel while the kernel is in memory and running, and can be unlinked and removed at any time. Watch it in the first tab.')),
            h('div', { class: 'card os prop' }, h('b', { html: '2 · <span class="t">Stackable modules</span>' }), h('span', { html: 'Modules form a hierarchy: a lower module is a library for the client modules above it, and the kernel counts those references. See the second tab.' })),
            h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters' }, 'The disk holds drivers for thousands of devices, but memory holds only the ones in use right now.')),
          ctx.ui.tabs([{ label: 'Watch a module load', render: linkTab }, { label: 'See the stack', render: stackTab }])));
      },
    },
    /* ---------------- 6. The module table, one entry field by field ---------------- */
    {
      title: 'The module table: one entry, field by field',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        const T = (x, y, t, o) => s('text', Object.assign({ x, y, 'font-size': 13 }, o || {}), t);
        const MONO = 'font-family:var(--mono)';
        const LBL = { 'font-weight': 800, class: 's-sub', 'letter-spacing': '1' };
        /* the fields of usb_storage's entry, top to bottom */
        const F = [
          { k: 'next', l: 'next', title: 'next: the link to the next entry',
            x: 'The module table is a <b>linked list</b>. Each entry holds the address of the next entry, and the last one holds NULL. The kernel walks the list from <code>module_list</code> to find a module, and a newly loaded module goes at the front.',
            eg: 'usb_storage\'s <code>next</code> points at usbcore\'s entry, because usbcore was loaded before it.' },
          { k: 'name', l: 'name', title: 'name',
            x: 'The module\'s name. Commands such as <code>rmmod</code> and <code>lsmod</code> find an entry by walking the list and comparing names.',
            eg: '<code>rmmod usb_storage</code> looks for the entry whose name is "usb_storage".' },
          { k: 'size', l: 'size', title: 'size',
            x: 'How much kernel memory the module\'s code and data take up. The kernel needs it to free exactly that memory when the module is removed, and <code>lsmod</code> reports it.',
            eg: '80 KB: the copy of usb_storage.ko\'s code and data that now sits in kernel memory.' },
          { k: 'use', l: 'usecount', title: 'usecount',
            x: 'Counts the operations using the module\'s functions right now: +1 when one starts, −1 when it ends. While it is above 0, the kernel refuses to unload the module, because its code may still be running.',
            eg: 'Two reads start and one ends: 0 + 2 − 1 = 1. Try it with the buttons.' },
          { k: 'flags', l: 'flags', title: 'flags: the module\'s state',
            x: 'Status bits recording what state the module is in: still loading (its init function has not finished), live, or being removed. The kernel checks them so that nothing calls into a half-loaded or half-removed module.',
            eg: () => st.gone ? 'none any more: the entry has been removed from the table.' : st.flag === 'LOADING' ? 'LOADING: usb_storage\'s init function is still running, so no work may start yet.' : st.flag === 'GOING' ? 'GOING: rmmod has begun, so no new work may start while the exit function runs.' : 'LIVE: init has run, and usb_storage is ready for work.' },
          { k: 'syms', l: 'symbol table', hint: 'syms, nsyms', title: 'Symbol table: what it offers others',
            x: 'The module\'s exported symbols: the name of each function or variable it offers to other modules, with the address where it lives (nsyms says how many). A newly loaded module\'s unresolved names are looked up in these tables.',
            eg: 'uas calls <code>usb_stor_adjust_quirks()</code>, so it was linked to the address listed here.' },
          { k: 'deps', l: 'dependencies', hint: 'deps, ndeps', title: 'Dependencies: what it relies on',
            x: 'The modules this one relies on, because it calls their exported symbols (ndeps says how many). They must stay loaded for as long as this module is loaded.',
            eg: 'usb_storage calls <code>usb_register_driver()</code> in usbcore, so usbcore is on this list.' },
          { k: 'refs', l: 'used by', hint: 'refs', title: 'Used by: who relies on it',
            x: 'The reverse direction: the loaded modules stacked on this one. While this list is not empty, <code>rmmod</code> is refused, because those modules would be left calling freed memory.',
            eg: () => st.uas ? 'uas is stacked on usb_storage, so usb_storage can be removed only after uas.' : 'uas has been unloaded, so this list is empty and no longer blocks <code>rmmod usb_storage</code>.' },
        ];
        const FK = Object.fromEntries(F.map((f) => [f.k, f]));
        const RH = 42, RY = (i) => 120 + i * RH;
        let st, run = 0;
        const fresh = () => ({ use: 0, uas: true, gone: false, flag: 'LIVE', sel: 'next', bad: null });
        const svg = s('svg', { viewBox: '0 0 640 474', width: '100%' });
        const arrow = (x1, x2, y) => s('line', { x1, y1: y, x2, y2: y, class: 's-muted', 'stroke-width': 1.5, 'marker-end': 'url(#arr-muted)' });
        function draw() {
          const k = [], hl = new Set();
          if (st.sel === 'next' || st.sel === 'deps') hl.add('usbcore');
          if (st.sel === 'refs') hl.add('uas');
          /* top: the whole list, newest first */
          k.push(T(8, 41, 'module_list', { class: 's-sub', style: MONO }));
          const W = { uas: 70, usb_storage: 128, usbcore: 100 }, pos = {};
          let x = 96;
          [st.uas && 'uas', !st.gone && 'usb_storage', 'usbcore'].filter(Boolean).forEach((n) => {
            k.push(arrow(x, x + 18, 36)); x += 24; pos[n] = x;
            const hot = hl.has(n);
            k.push(s('rect', { x, y: 20, width: W[n], height: 32, rx: 8, class: n === 'usb_storage' ? 's-accent' : 's-os', 'stroke-width': hot ? 3.5 : 1.5, style: hot ? 'stroke:var(--chc)' : null }),
              T(x + W[n] / 2, 41, n, { 'text-anchor': 'middle', 'font-weight': 700, style: MONO }));
            x += W[n] + 4;
          });
          k.push(arrow(x, x + 18, 36), T(x + 24, 41, 'NULL', { class: 's-sub', style: MONO }));
          if (!st.gone) k.push(...[[pos.usb_storage, 14], [pos.usb_storage + W.usb_storage, 404]].map(([a, b]) => s('line', { x1: a, y1: 52, x2: b, y2: 80, class: 's-muted', 'stroke-dasharray': '4 4' })));
          /* the zoomed-in entry */
          const ent = s('g', {});
          if (st.gone) ent.append(s('rect', { x: 12, y: 80, width: 392, height: 384, rx: 12, class: 's-muted', 'stroke-dasharray': '6 5', style: 'fill:none' }),
            T(208, 250, 'Entry unlinked from the list', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 18, style: 'fill:var(--intr)' }),
            T(208, 276, 'its 80 KB of kernel memory is free again', { 'text-anchor': 'middle', class: 's-sub', 'font-size': 14 }),
            T(208, 302, 'Press Reset to load it again.', { 'text-anchor': 'middle', class: 's-sub', 'font-size': 14 }));
          else ent.append(s('rect', { x: 12, y: 80, width: 392, height: 384, rx: 12, class: 's-accent', 'stroke-width': 2 }),
            T(24, 104, 'usb_storage\'s entry, zoomed in', { 'font-weight': 800 }));
          if (!st.gone) F.forEach((f, i) => {
            const y = RY(i), on = st.sel === f.k, bad = st.bad === f.k;
            const g = s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': 'Field: ' + f.l,
              onclick: () => pick(f.k), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(f.k); } } });
            g.append(s('rect', { x: 22, y, width: 372, height: RH - 4, rx: 7, class: 'fr ' + (bad ? 's-intr' : 's-panel'), 'stroke-width': on ? 3.5 : 1.5, style: on ? 'stroke:var(--chc)' : null }));
            if (f.hint) g.append(T(34, y + 16, f.l, { 'font-weight': 700, 'font-size': 14 }), T(34, y + 31, f.hint, { class: 's-sub', style: MONO }));
            else g.append(T(34, y + 24, f.l, { 'font-weight': 700, 'font-size': 14 }));
            const V = (t, o) => T(196, y + 24, t, o);
            if (f.k === 'next') g.append(V('→ usbcore\'s entry', { style: MONO }));
            if (f.k === 'name') g.append(V('"usb_storage"', { style: MONO }));
            if (f.k === 'size') g.append(V('80 KB'));
            if (f.k === 'use') g.append(T(196, y + 26, String(st.use), { 'font-size': 20, 'font-weight': 800, style: 'fill:var(' + (st.use ? '--warn' : '--ok') + ')' }), T(222, y + 24, st.use ? 'operations using it now' : 'nothing is using it', { class: 's-sub' }));
            if (f.k === 'flags') g.append(s('rect', { x: 196, y: y + 9, width: 76, height: 20, rx: 10, class: st.flag === 'LIVE' ? 's-ok' : st.flag === 'LOADING' ? 's-warn' : 's-intr', 'stroke-width': 1.5 }), T(234, y + 24, st.flag, { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 13 }));
            if (f.k === 'syms') g.append(V('2 exported, listed at right →'));
            if (f.k === 'deps') g.append(V('usbcore', { style: MONO }), T(262, y + 24, '(ndeps = 1)', { class: 's-sub' }));
            if (f.k === 'refs') g.append(V(st.uas ? 'uas' : '(empty)', { style: MONO + (st.uas ? '' : ';fill:var(--muted)') }));
            ent.append(g);
          });
          k.push(ent);
          /* right: the flags states and the module's own symbol table */
          const side = s('g', { opacity: st.gone ? 0.3 : null });
          side.append(s('rect', { x: 420, y: 80, width: 212, height: 142, rx: 10, class: 's-panel', 'stroke-width': st.sel === 'flags' ? 3.5 : 1.5, style: st.sel === 'flags' ? 'stroke:var(--chc)' : null }), T(432, 104, 'FLAGS: ITS STATE', LBL));
          [['LOADING', 'being set up', 's-warn'], ['LIVE', 'in normal use', 's-ok'], ['GOING', 'being removed', 's-intr']].forEach(([f, d, c], j) => {
            const on = st.flag === f && !st.gone, y = 118 + j * 32;
            side.append(s('rect', { x: 432, y, width: 80, height: 24, rx: 12, class: on ? c : 's-muted', 'stroke-width': on ? 2 : 1, style: on ? null : 'fill:none', 'stroke-dasharray': on ? null : '3 3' }),
              T(472, y + 17, f, { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 12.5, class: on ? null : 's-sub' }), T(522, y + 17, d, { class: on ? null : 's-sub', 'font-weight': on ? 700 : 400 }));
          });
          const sy = RY(5) + (RH - 4) / 2;
          side.append(s('rect', { x: 420, y: 250, width: 212, height: 136, rx: 10, class: 's-panel', 'stroke-width': st.sel === 'syms' ? 3.5 : 1.5, style: st.sel === 'syms' ? 'stroke:var(--chc)' : null }),
            T(432, 274, 'ITS SYMBOL TABLE', LBL),
            ...[['usb_stor_probe1', '0xf8b10a60'], ['usb_stor_adjust_quirks', '0xf8b10c20']].map(([n, a], j) => [T(432, 302 + j * 42, n, { style: MONO, 'font-weight': 700 }), T(432, 319 + j * 42, 'at address ' + a, { class: 's-sub', style: MONO })]).flat(),
            s('line', { x1: 396, y1: sy, x2: 416, y2: sy, class: 's-line', 'stroke-width': 1.5, 'marker-end': 'url(#arr)' }));
          k.push(side);
          if (!st.gone) k.push(T(420, 420, 'Click any field to see', { class: 's-sub' }), T(420, 437, 'what it is for.', { class: 's-sub' }));
          svg.replaceChildren(...k);
        }
        const infoH = h('h3', { class: 'm0' }), infoP = h('p', { class: 'p15 m0' }), infoE = h('div', { class: 'eg' });
        function paintInfo() { const f = FK[st.sel]; infoH.textContent = f.title; infoP.innerHTML = f.x; infoE.innerHTML = '<b>In this entry:</b> ' + (typeof f.eg === 'function' ? f.eg() : f.eg); }
        function pick(key) { st.sel = key; draw(); paintInfo(); ctx.refit(); }
        const useB = h('b', {}, '0'), flagChip = h('span', { class: 'chip' }), refChip = h('span', { class: 'chip' });
        const status = h('div', { class: 'callout m0 small' });
        function say(cls, label, html) { status.className = 'callout m0 small ' + cls; status.setAttribute('data-label', label); status.innerHTML = html; }
        function paint() {
          useB.textContent = st.use;
          flagChip.className = 'chip ' + (st.gone ? '' : st.flag === 'LIVE' ? 'ok' : st.flag === 'LOADING' ? 'warn' : 'bad');
          flagChip.textContent = st.gone ? 'not loaded' : 'flags: ' + st.flag;
          refChip.className = 'chip ' + (st.uas ? 'warn' : 'ok'); refChip.textContent = 'used by: ' + (st.uas ? 'uas' : 'nobody');
          draw(); paintInfo(); ctx.refit();
        }
        const notLoaded = () => say('', 'Not loaded', 'usb_storage has been unloaded, so nothing can use it. Press <b>Reset</b> to load it again.');
        function start() {
          if (st.gone) return notLoaded(), paint();
          if (st.flag !== 'LIVE') { say('warn', 'Not ready', 'The flags do not say LIVE, so the kernel will not start new work in this module.'); return paint(); }
          st.use++; st.bad = null; st.sel = 'use';
          say('tip', 'usecount +1', `A process started reading from the stick, which runs usb_storage's functions. usecount is now <b>${st.use}</b>.`); paint();
        }
        function end() {
          if (st.gone) return notLoaded(), paint();
          st.sel = 'use'; st.bad = null;
          if (!st.use) say('', 'Nothing to end', 'No read is in progress, and a count can never drop below 0.');
          else { st.use--; say('tip', 'usecount −1', `A read finished. usecount is now <b>${st.use}</b>${st.use ? '.' : ': nothing is using the module.'}`); }
          paint();
        }
        function rmUas() {
          st.bad = null; st.sel = 'refs';
          if (!st.uas) say('', 'Already unloaded', 'uas is no longer in the module table.');
          else { st.uas = false; say('tip', 'rmmod uas: done', 'Nothing depended on uas and nothing was using it, so it was unloaded. usb_storage\'s <b>used by</b> list is now empty.'); }
          paint();
        }
        function rmSt() {
          const my = ++run;
          if (st.gone) { say('', 'Already unloaded', 'usb_storage is no longer in the module table.'); return paint(); }
          if (st.uas) { st.bad = 'refs'; st.sel = 'refs'; say('bad', 'rmmod usb_storage: refused', '<code>Module usb_storage is in use by: uas</code><br>Its <b>used by</b> list is not empty: uas calls its functions. Unload uas first.'); return paint(); }
          if (st.use) { st.bad = 'use'; st.sel = 'use'; say('bad', 'rmmod usb_storage: refused', `<code>Module usb_storage is in use</code><br>Its usecount is ${st.use}: ${st.use > 1 ? 'reads are' : 'a read is'} still running its code. End ${st.use > 1 ? 'them' : 'it'} first.`); return paint(); }
          st.bad = null; st.flag = 'GOING'; st.sel = 'flags';
          say('tip', 'rmmod usb_storage: unloading…', 'usecount is 0 and nobody uses it. Its flags change to GOING so no new work can start, and its exit function runs.'); paint();
          ctx.after(1300, () => { if (my !== run) return; st.gone = true; say('tip', 'rmmod usb_storage: done', 'Its exit function ran and its entry was unlinked: the pointer that led to it now leads straight to usbcore. Its symbols left the symbol table and its 80 KB were freed.'); paint(); });
        }
        function reset() {
          const my = ++run, wasGone = st && st.gone;
          st = fresh();
          if (wasGone) { st.flag = 'LOADING'; st.sel = 'flags'; say('', 'modprobe uas', 'modprobe loaded usb_storage again, then uas on top. While usb_storage\'s init function runs, its flags say LOADING and no work may start…'); ctx.after(1100, () => { if (my !== run) return; st.flag = 'LIVE'; say('tip', 'Ready again', 'init finished, so the flags now say LIVE. Start some reads, then try to unload usb_storage.'); paint(); }); }
          else say('', 'Try the rules', 'Start and end some reads, then try to unload usb_storage. What must happen before the kernel agrees?');
          paint();
        }
        const B = (label, fn, cls = 'btn sm') => h('button', { class: cls, type: 'button', onclick: fn }, label);
        el.append(h('div', { class: 'split r fill' },
          h('div', { class: 'card white stack', style: { gap: '4px' } },
            h('span', { class: 'lbl', html: 'Kernel memory: the <span class="t">module table</span>, and one entry up close' }), svg),
          h('div', { class: 'stack', style: { gap: '10px' } },
            h('div', { class: 'card white stack', style: { gap: '8px' } }, infoH, infoP, infoE),
            h('div', { class: 'card stack', style: { gap: '8px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Try the rules on this entry'), B('↺ Reset', reset, 'btn ghost sm')),
              h('div', { class: 'row', style: { gap: '10px' } }, h('div', { class: 'score' }, useB, h('span', { html: '<span class="t">usecount</span>' })), flagChip, refChip),
              h('div', { class: 'grid-2', style: { gap: '6px' } }, B('+ A read starts', start), B('− A read ends', end),
                h('button', { class: 'btn sm danger mono', type: 'button', onclick: rmUas }, 'rmmod uas'), h('button', { class: 'btn sm danger mono', type: 'button', onclick: rmSt }, 'rmmod usb_storage')),
              status))));
        reset();
      },
    },
    /* ---------------- 7. Lab: the module table, insmod / modprobe / rmmod ---------------- */
    {
      title: 'Lab: load and unload modules yourself',
      kind: 'lab',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h } = ctx;
        if (ctx.narrow) el.classList.add('nrw');
        const M = {
          /* deps: the modules it needs; calls: one symbol it uses from each of them (all real exports) */
          usbcore: { sz: 332, d: 'shared USB core code', deps: [], calls: {}, ex: ['usb_register_driver', 'usb_add_hcd'] },
          xhci_hcd: { sz: 340, d: 'USB controller (ports)', deps: ['usbcore'], calls: { usbcore: 'usb_add_hcd' }, ex: ['xhci_init_driver'] },
          usb_storage: { sz: 80, d: 'USB flash drives, disks', deps: ['usbcore'], calls: { usbcore: 'usb_register_driver' }, ex: ['usb_stor_probe1', 'usb_stor_adjust_quirks'] },
          uas: { sz: 32, d: 'faster USB disk protocol', deps: ['usb_storage', 'usbcore'], calls: { usb_storage: 'usb_stor_adjust_quirks', usbcore: 'usb_register_driver' }, ex: [] },
          fat: { sz: 88, d: 'shared FAT code', deps: [], calls: {}, ex: ['fat_fill_super'] },
          vfat: { sz: 24, d: 'usual USB stick format', deps: ['fat'], calls: { fat: 'fat_fill_super' }, ex: [] },
        };
        const NAMES = Object.keys(M);
        const STICK = ['xhci_hcd', 'usb_storage', 'vfat']; // what a mounted stick keeps busy
        const MIS = ['Make insmod fail: a prerequisite is missing', 'Mount the USB stick', 'Try rmmod on a module that another one needs', 'Try rmmod on a module the mounted stick uses', 'Unmount, then unload every module'];
        let st;
        const isIn = (n) => st.list.includes(n);
        const usersOf = (n) => st.list.filter((x) => M[x].deps.includes(n));
        const logEl = h('div', { class: 'log' });
        const why = h('div', { class: 'callout m0 small' });
        const diskEl = h('div', { class: 'stack', style: { gap: '3px' } });
        const tableEl = h('div', { class: 'mt' });
        const misEl = h('div', { class: 'mis' });
        const stickChip = h('span', { class: 'chip' });
        const code = (x) => '<code>' + x + '</code>';
        function log(cmd, lines) {
          logEl.append(h('div', {}, h('div', { class: 'c' }, '$ ' + cmd), ...lines.map(([cls, t]) => h('div', { class: cls }, t))));
          logEl.scrollTop = logEl.scrollHeight;
        }
        function explain(cls, label, html) { why.className = 'callout m0 small ' + cls; why.setAttribute('data-label', label); why.innerHTML = html; }
        function fresh() {
          st = { list: [], use: {}, loading: {}, mounted: false, fresh: null, done: MIS.map(() => false), cheered: false };
          logEl.replaceChildren(h('div', { class: 'mu' }, '# the kernel has just booted with no modules loaded'));
          explain('', 'Your goal', 'Get the USB stick mounted, then clean up, while you watch the <span class="t">module table</span> (the kernel\'s list of loaded modules) and each <span class="t">usecount</span> (how many current users a module has). Your three commands:<br>• <b>insmod</b> loads exactly the one module you name.<br>• <b>modprobe</b> also loads whatever that module needs, first.<br>• <b>rmmod</b> unloads one module, if the kernel agrees.<br>(On a real system, plugging in the stick makes the kernel run modprobe for you.) Start the way many people do: press <b>insmod</b> on <b>usb_storage</b>.');
        }
        function load(n) {
          st.list.unshift(n); st.use[n] = 0; st.loading[n] = true; st.fresh = n;
          ctx.after(900, () => { if (st.loading[n]) { delete st.loading[n]; paint(); } });
        }
        function insmod(n) {
          const miss = M[n].deps.filter((d) => !isIn(d));
          if (miss.length) {
            log(`insmod ${n}.ko`, [['bad', `insmod: ERROR: could not insert module ${n}.ko: Unknown symbol in module`]]);
            explain('bad', 'Refused: dynamic linking failed', `<b>${n}</b> calls ${code(M[n].calls[miss[0]] + '()')}, which lives in <b>${miss[0]}</b>. Because ${miss.join(' and ')} ${miss.length > 1 ? 'are' : 'is'} not loaded, that name is not in the kernel symbol table, so the loader has no address to fill in. Load ${miss.join(' and ')} first, or use ${code('modprobe')}.`);
            st.done[0] = true;
          } else {
            load(n);
            log(`insmod ${n}.ko`, [['ok', 'ok: linked and added at the front of the module table']]);
            explain('tip', 'Loaded', `<b>${n}</b> was copied into kernel memory and linked against ${M[n].deps.length ? 'the symbols it needs from ' + M[n].deps.join(' and ') : 'the core kernel'}. Its entry went to the <b>front</b> of the module table with usecount 0${M[n].ex.length ? ', and it now exports ' + M[n].ex.map(code).join(', ') : ''}.`);
          }
          after();
        }
        function order(n, out = []) { M[n].deps.slice().reverse().forEach((d) => order(d, out)); if (!out.includes(n)) out.push(n); return out; }
        function modprobe(n) {
          const todo = order(n).filter((x) => !isIn(x));
          if (!todo.length) { log(`modprobe ${n}`, [['mu', '(already loaded: nothing to do)']]); explain('', 'Nothing to do', `<b>${n}</b> is already in the module table.`); return after(); }
          todo.forEach(load);
          log(`modprobe ${n}`, todo.map((x) => ['ok', `insmod ${x}.ko ... ok`]));
          explain('tip', todo.length > 1 ? 'Loaded, prerequisites first' : 'Loaded', todo.length > 1
            ? `${code('modprobe')} looked <b>${n}</b> up in the dependency list (a file called modules.dep) and loaded the stack from the bottom up: ${todo.map((x) => '<b>' + x + '</b>').join(' → ')}. Each could then be linked against the ones below it.`
            : `<b>${n}</b> needs nothing that is not already loaded, so ${code('modprobe')} simply inserted it, exactly like ${code('insmod')}.`);
          after();
        }
        function rmmod(n) {
          const users = usersOf(n);
          if (users.length) {
            log(`rmmod ${n}`, [['bad', `rmmod: ERROR: Module ${n} is in use by: ${users.join(' ')}`]]);
            explain('bad', 'Refused: stackable modules', `<b>${users.join(' and ')}</b> ${users.length > 1 ? 'call' : 'calls'} functions inside <b>${n}</b>. Removing it would leave those calls pointing at freed memory, so the kernel refuses. Remove ${users.join(' and ')} first.`);
            st.done[2] = true;
          } else if (st.use[n] > 0) {
            log(`rmmod ${n}`, [['bad', `rmmod: ERROR: Module ${n} is in use`]]);
            explain('bad', 'Refused: usecount is not zero', `<b>${n}</b> has usecount ${st.use[n]}: the mounted USB stick is still using its code. Unmount the stick first, and the count drops back to 0.`);
            st.done[3] = true;
          } else {
            st.list = st.list.filter((x) => x !== n); delete st.use[n]; delete st.loading[n];
            log(`rmmod ${n}`, [['ok', 'ok: exit ran, unlinked, memory freed']]);
            explain('tip', 'Unloaded', `No loaded module depended on <b>${n}</b> and its usecount was 0, so its entry was unlinked from the module table and its memory freed. The file is still on disk for next time.`);
          }
          after();
        }
        function mount() {
          const cmd = 'mount /dev/sdb1 /media/usb', dev = 'mount: /media/usb: special device /dev/sdb1 does not exist';
          if (st.mounted) { log(cmd, [['mu', 'mount: /media/usb: already mounted']]); explain('', 'Already mounted', 'The stick is already mounted.'); }
          else if (!isIn('xhci_hcd')) { log(cmd, [['bad', dev]]); explain('bad', 'No USB port', 'The USB controller driver, <b>xhci_hcd</b>, is not loaded, so the kernel cannot even see the USB port, let alone the stick.'); }
          else if (!isIn('usb_storage')) { log(cmd, [['bad', dev]]); explain('bad', 'No driver for the stick', 'The controller sees a new USB device, but no driver has claimed it. Load <b>usb_storage</b> so that the stick shows up as a disk.'); }
          else if (!isIn('vfat')) { log(cmd, [['bad', 'mount: /media/usb: unknown filesystem type \'vfat\'']]); explain('bad', 'No file system', 'The stick is formatted as VFAT, and the <b>vfat</b> file-system module is not loaded.'); }
          else {
            st.mounted = true; STICK.forEach((x) => st.use[x]++); st.done[1] = true;
            log(cmd, [['ok', 'ok: files now under /media/usb']]);
            explain('tip', 'Mounted', 'The mounted stick is an ongoing user of <b>xhci_hcd</b> (the port), <b>usb_storage</b> (the device) and <b>vfat</b> (its file system), so each of their usecounts went from 0 to 1.');
          }
          after();
        }
        function umount() {
          if (!st.mounted) { log('umount /media/usb', [['mu', 'umount: /media/usb: not mounted']]); explain('', 'Not mounted', 'The stick is not mounted.'); }
          else { st.mounted = false; STICK.forEach((x) => st.use[x]--); log('umount /media/usb', [['ok', 'ok']]); explain('tip', 'Unmounted', 'The stick no longer uses <b>xhci_hcd</b>, <b>usb_storage</b> or <b>vfat</b>, so all three usecounts are back to 0.'); }
          after();
        }
        function after() {
          if (st.done[1] && !st.list.length && !st.mounted) st.done[4] = true;
          if (st.done.every(Boolean) && !st.cheered) { st.cheered = true; explain('tip', 'Lab complete', 'You saw every rule in action: <b>dynamic linking</b> fails when a needed symbol is missing, <b>stacking</b> blocks removing a module that others call into, a nonzero <b>usecount</b> blocks removal while the module is busy, and everything loads and unloads while the kernel keeps running.'); }
          paint();
        }
        function paint() {
          diskEl.replaceChildren(...NAMES.map((n) => h('div', { class: 'drow' + (isIn(n) ? ' in' : '') },
            h('div', { class: 'nm' }, h('b', {}, n + '.ko'), h('span', {}, M[n].d)),
            ...(isIn(n) ? [h('span', { class: 'chip os' }, 'loaded'), h('button', { class: 'btn sm danger', type: 'button', onclick: () => rmmod(n) }, 'rmmod')]
              : [h('button', { class: 'btn sm', type: 'button', onclick: () => insmod(n) }, 'insmod'), h('button', { class: 'btn sm', type: 'button', onclick: () => modprobe(n) }, 'modprobe')]))));
          stickChip.className = 'chip ' + (st.mounted ? 'ok' : 'warn');
          stickChip.textContent = st.mounted ? 'mounted' : 'not mounted';
          const none = () => h('span', { class: 'muted' }, '(none)');
          const rows = st.list.map((n) => {
            const users = usersOf(n), u = st.use[n] || 0;
            return h('div', { class: 'mrow' }, h('div', { class: 'mrail' }, h('b', {}, '▼'), h('i')),
              h('div', { class: 'mbox' + (st.loading[n] ? ' new' : '') },
                h('div', { class: 'nmc', 'data-l': 'name · size' }, h('b', {}, n), h('span', { class: 'xs muted' }, M[n].sz + ' KB')),
                h('div', { class: 'uc' + (u ? ' hot' : ''), 'data-l': 'usecount' }, String(u)),
                h('div', { 'data-l': 'flags' }, h('span', { class: 'chip ' + (st.loading[n] ? 'warn' : 'ok') }, st.loading[n] ? 'loading' : 'live')),
                h('div', { class: 'mono', 'data-l': 'exports' }, M[n].ex.length ? M[n].ex.map((x) => h('div', {}, x)) : none()),
                h('div', { class: 'mono', 'data-l': 'depends on' }, M[n].deps.length ? M[n].deps.map((x) => h('div', {}, x)) : none()),
                h('div', { 'data-l': 'used by' }, users.length ? [h('b', {}, users.length + ' · '), users.join(', ')] : none())));
          });
          tableEl.replaceChildren(
            h('div', { class: 'mrow' }, h('span'), h('div', { class: 'mcols' }, ...['NAME · SIZE', 'USECOUNT', 'FLAGS', 'EXPORTED SYMBOLS', 'DEPENDS ON', 'USED BY'].map((t) => h('span', {}, t)))),
            h('div', { class: 'mhead' }, 'module_list (head of the list)'),
            ...(rows.length ? rows : [h('div', { class: 'mempty' }, 'Empty: no modules are loaded yet.')]),
            h('div', { class: 'mnull' }, 'NULL (end of the list)'));
          misEl.replaceChildren(...MIS.map((m, i) => h('div', { class: st.done[i] ? 'done' : '' }, h('span', {}, st.done[i] ? '✓' : '☐'), h('span', {}, m))));
          ctx.refit();
          logEl.scrollTop = logEl.scrollHeight;
        }
        fresh();
        el.append(h('div', { class: 'split lab fill' },
          h('div', { class: 'stack', style: { gap: '10px' } },
            h('div', { class: 'card tight stack', style: { gap: '4px' } }, h('span', { class: 'lbl' }, 'Module files on disk (/lib/modules)'), diskEl),
            h('div', { class: 'card tight row nw', style: { gap: '7px' } }, h('b', { class: 'small' }, 'USB stick'), stickChip, h('span', { class: 'grow' }),
              h('button', { class: 'btn sm primary', type: 'button', onclick: mount }, 'mount'), h('button', { class: 'btn sm', type: 'button', onclick: umount }, 'umount')),
            h('div', { class: 'card tight stack', style: { gap: '4px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Missions'), h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { fresh(); paint(); } }, '↺ Reset lab')), misEl)),
          h('div', { class: 'stack', style: { gap: '10px' } },
            h('div', { class: 'card white tight stack', style: { gap: '6px' } }, h('span', { class: 'lbl' }, 'Kernel memory: the module table, a linked list with the newest module first'), tableEl),
            h('div', { class: 'labout grow' }, logEl, why))));
        paint();
      },
    },
    /* ---------------- 7. The kernel components map + traces ---------------- */
    {
      title: 'Inside the Linux kernel: a map of its components',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        const B = {
          user: { r: [4, 4, 682, 76], c: 's-panel', name: 'User level: processes and threads',
            x: 'Ordinary programs (a shell, a browser, an editor) run up here in user mode, each as one or more processes and threads. They cannot touch the hardware or the kernel\'s memory directly. To get anything done, they ask the kernel through system calls.',
            eg: 'Saving a file in your editor is a user-level process asking the kernel for help.' },
          sys: { r: [4, 92, 682, 40], c: 's-os', t: ['System calls: the doorway from user level into the kernel'], name: 'System calls',
            x: 'The fixed set of entry points, or <span class="t">system calls</span> (a few hundred in Linux), through which a program asks for a service: open, read, write, fork, kill and so on. A special instruction switches the processor into kernel mode and jumps to the matching handler.',
            eg: '<code>read(fd, buf, n)</code> asks for n bytes from a file the program has open.' },
          sig: { r: [12, 178, 104, 86], c: 's-intr', t: ['Signals'], name: 'Signals',
            x: 'A <span class="t">signal</span> is the kernel\'s short notice to a process that something happened: a key combination, a timer running out, a child ending, a bad memory access. The process can catch it with its own handler, ignore it, or accept the default action (often: being ended).',
            eg: 'Pressing <b>Ctrl+C</b> sends the SIGINT signal to the program in the foreground.' },
          sched: { r: [124, 178, 104, 86], c: 's-proc', t: ['Processes', 'and scheduler'], name: 'Processes and scheduler',
            x: 'Creates and ends processes and threads, and decides many times per second which ready one runs next on each processor. It puts processes to sleep while they wait and wakes them when the wait is over. (Linux processes and threads: section 4.6.)',
            eg: 'A process waiting for the disk is put to sleep, and another one gets the processor.' },
          vm: { r: [236, 178, 104, 86], c: 's-mem', t: ['Virtual', 'memory'], name: 'Virtual memory',
            x: 'Gives every process its own private address space, split into pages, and maps each page onto a <b>page frame</b>: a same-sized slot of real memory (typically 4 KB). Pages come in from disk on demand; rarely used ones go out.',
            eg: 'Two programs can both use address 0x400000 without clashing: each maps it to different physical memory.' },
          fs: { r: [460, 178, 104, 86], c: 's-os', t: ['File', 'systems'], name: 'File systems',
            x: 'Turn raw disk blocks into named files and folders and check who may use them. Linux supports many formats (ext4, btrfs, vfat, network file systems) behind one common interface, and keeps recently used file data in memory.',
            eg: 'Opening <code>notes.txt</code>: the file system finds which disk blocks hold it.' },
          net: { r: [572, 178, 104, 86], c: 's-os', t: ['Network', 'protocols'], name: 'Network protocols',
            x: 'Carry out the rules of network communication, such as IP (addresses and routing) and TCP (reliable, in-order streams). Programs use them through sockets.',
            eg: 'TCP puts arriving packets back in order and asks again for any that went missing.' },
          trap: { r: [12, 282, 104, 86], c: 's-intr', t: ['Traps and', 'faults'], name: 'Traps and faults',
            x: 'Handles <span class="t">traps and faults</span>: exceptions the processor raises by itself while running an instruction: a page fault, a divide by zero, an illegal instruction. The fix may be invisible (bring in the missing page) or fatal for the process (send it a signal).',
            eg: 'Touching a page that is still on disk causes a page fault, and virtual memory brings the page in.' },
          intr: { r: [124, 282, 104, 86], c: 's-intr', t: ['Interrupts'], name: 'Interrupts',
            x: 'Handles interrupt requests from devices: the kernel stops what the processor was doing, runs that device\'s interrupt handler, then carries on. Urgent work happens at once; longer work is put off until a little later.',
            eg: 'The network card signals "a packet arrived", and its handler runs within microseconds.' },
          phys: { r: [236, 282, 104, 86], c: 's-mem', t: ['Physical', 'memory'], name: 'Physical memory',
            x: 'Manages the real RAM, which is divided into page frames: fixed-size slots (typically 4 KB) that each hold one page. It keeps track of which frames are free, hands them out to processes, to the kernel itself and to caches, and takes them back.',
            eg: 'When a process needs a new page, a free page frame is taken from here.' },
          chr: { r: [348, 282, 104, 86], c: 's-io', t: ['Character', 'device drivers'], name: 'Character device drivers',
            x: 'Operate <span class="t">character devices</span>, which deliver data as a stream of bytes: keyboards, terminals, mice, serial ports. Programs reach them almost directly (the dashed arrow): a read() on a terminal goes from the system call to the driver, with no file system finding disk blocks in between.',
            eg: 'The terminal driver collects your keystrokes into a line of input.' },
          blk: { r: [460, 282, 104, 86], c: 's-io', t: ['Block', 'device drivers'], name: 'Block device drivers',
            x: 'Operate <span class="t">block devices</span>, which store data in fixed-size blocks that can be read in any order: hard disks, SSDs, USB sticks. Requests wait in a queue and may be reordered for speed.',
            eg: 'The SSD driver fetches the blocks the file system asked for.' },
          netdrv: { r: [572, 282, 104, 86], c: 's-io', t: ['Network', 'device drivers'], name: 'Network device drivers',
            x: 'Operate network interface controllers: hand outgoing packets to the card and collect incoming ones from it.',
            eg: 'The Wi-Fi driver passes each packet it receives up to the network protocols.' },
          cpu: { r: [12, 426, 216, 50], c: 's-cpu', t: ['CPU (processor)'], name: 'CPU (hardware)',
            x: 'Runs both user code and kernel code. The kernel gets control of it through system calls, traps and interrupts, and shares it out through the scheduler.', eg: 'A four-core laptop can run four threads at literally the same moment.' },
          mem: { r: [236, 426, 104, 50], c: 's-mem', t: ['System', 'memory'], name: 'System memory (hardware)',
            x: 'The RAM chips that hold the kernel, its caches and every process\'s pages.', eg: 'Managed by the physical memory component just above it.' },
          term: { r: [348, 426, 104, 50], c: 's-io', t: ['Terminal'], name: 'Terminal (hardware)',
            x: 'A keyboard and screen, or a terminal window: a classic character device.', eg: 'Driven by the character device drivers just above it.' },
          disk: { r: [460, 426, 104, 50], c: 's-io', t: ['Disk'], name: 'Disk (hardware)',
            x: 'A hard disk, SSD or USB stick: a block device that keeps data when the power is off.', eg: 'Driven by the block device drivers just above it.' },
          nic: { r: [572, 426, 104, 50], c: 's-io', t: ['NIC'], name: 'Network interface controller (hardware)',
            x: 'The <span class="t">network interface controller (NIC)</span>: the Ethernet or Wi-Fi hardware that sends and receives packets.', eg: 'Driven by the network device drivers just above it.' },
        };
        let mode = 'explore', sel = 'sys', trace = null, tabsEl = null;
        const svg = s('svg', { viewBox: '0 0 690 490', width: '100%', class: 'kmap' });
        const T = (x, y, t, o) => s('text', Object.assign({ x, y, 'font-size': 13 }, o || {}), t);
        function pick(k) { if (mode !== 'explore' && tabsEl) tabsEl.show(0); sel = k; draw(); paintInfo(); }
        function draw() {
          const seen = {}, now = new Set();
          if (trace) { trace.f.slice(0, trace.i + 1).forEach((fr, j) => fr.k.forEach((k) => { seen[k] = j + 1; })); trace.f[trace.i].k.forEach((k) => now.add(k)); }
          const k = [
            s('rect', { x: 4, y: 144, width: 682, height: 240, rx: 12, 'stroke-width': 2, style: 'fill:none;stroke:var(--os)' }),
            T(16, 166, 'KERNEL (everything in this box runs in kernel mode)', { 'font-weight': 800, 'letter-spacing': '1', style: 'fill:var(--os)' }),
            s('rect', { x: 4, y: 396, width: 682, height: 90, rx: 12, class: 's-panel', 'stroke-width': 1 }),
            T(16, 416, 'HARDWARE', { 'font-weight': 800, 'letter-spacing': '1', class: 's-sub' }),
            ...[[288, 264, 282], [512, 264, 282], [624, 264, 282], [64, 368, 426], [176, 368, 426], [288, 368, 426], [400, 368, 426], [512, 368, 426], [624, 368, 426]].map(([x, y1, y2]) => s('line', { x1: x, y1, x2: x, y2, class: 's-muted' })),
            s('line', { x1: 400, y1: 132, x2: 400, y2: 276, class: 's-muted', 'stroke-dasharray': '5 4', 'marker-end': 'url(#arr-muted)' }),
            T(392, 222, 'direct', { class: 's-sub', 'text-anchor': 'middle', transform: 'rotate(-90 392 222)' }),
          ];
          Object.entries(B).forEach(([key, b]) => {
            const [x, y, w, hh] = b.r;
            const on = mode === 'explore' ? key === sel : now.has(key);
            const dim = trace && !seen[key];
            const g = s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': b.name, opacity: dim ? 0.38 : null,
              onclick: () => pick(key), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(key); } } });
            g.append(s('rect', { x, y, width: w, height: hh, rx: 10, class: 'fr ' + b.c, 'stroke-width': on ? 4 : 2, style: on ? 'stroke:var(--chc)' : null }));
            if (key === 'user') {
              g.append(T(16, 30, 'USER LEVEL: processes and threads', { 'font-weight': 800, 'letter-spacing': '1', class: 's-sub' }),
                ...['shell', 'browser', 'editor'].map((n, j) => [s('rect', { x: 330 + j * 116, y: 20, width: 100, height: 44, rx: 9, class: 's-proc', 'stroke-width': 2 }), T(380 + j * 116, 47, n, { 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 14 })]).flat());
            } else {
              const n = b.t.length, y0 = y + hh / 2 - ((n - 1) * 17) / 2 + 5;
              b.t.forEach((t, j) => g.append(T(x + w / 2, y0 + j * 17, t, { 'text-anchor': 'middle', 'font-weight': j ? 400 : 700, 'font-size': j ? 13 : 14, class: j ? 's-sub' : null })));
            }
            if (seen[key]) g.append(s('circle', { cx: x + w - 12, cy: y + 12, r: 10, style: 'fill:var(--chc)' }), T(x + w - 12, y + 16.5, String(seen[key]), { 'text-anchor': 'middle', 'font-weight': 800, style: 'fill:var(--panel)' }));
            k.push(g);
          });
          svg.replaceChildren(...k);
        }
        const info = h('div', { class: 'card white stack kinfo', style: { gap: '10px' } });
        function paintInfo() {
          const b = B[sel];
          info.replaceChildren(h('h3', {}, b.name), h('p', { html: b.x }), h('div', { class: 'eg', html: '<b>Example:</b> ' + b.eg }));
          ctx.refit();
        }
        function exploreTab(p) {
          mode = 'explore'; trace = null; draw(); paintInfo();
          p.append(h('div', { class: 'stack', style: { gap: '10px' } }, info,
            h('p', { class: 'small muted m0', html: 'Colours follow the guide: <span class="chip proc">processes</span> <span class="chip mem">memory</span> <span class="chip io">devices and drivers</span> <span class="chip intr">interrupts, traps, signals</span> <span class="chip os">kernel services</span>' }),
            h('div', { class: 'callout tip m0 small', 'data-label': 'Where modules plug in' }, 'File systems, network protocols and the three kinds of device drivers are the parts most often loaded as modules. Scheduling, memory management, interrupt handling, signals and system calls stay in the core kernel.')));
        }
        const TR = {
          key: [
            { k: ['term'], c: '<b>You press a key.</b> The keyboard, part of the terminal hardware, sends a code and raises an interrupt request to the processor.' },
            { k: ['intr', 'cpu'], c: '<b>Interrupts.</b> The CPU pauses whatever was running, switches to kernel mode and runs the handler registered for the keyboard.' },
            { k: ['chr'], c: '<b>Character device drivers.</b> The terminal driver reads the character and adds it to the terminal\'s input buffer, one byte at a time.' },
            { k: ['sched'], c: '<b>Processes and scheduler.</b> Your shell was asleep, waiting for input. The driver wakes it, and the scheduler puts it back among the ready processes.' },
            { k: ['sys', 'user'], c: '<b>System calls.</b> When the shell next runs, its <code>read()</code> call returns with the character, back in user mode, and the shell shows it on screen.' },
            { k: ['sig'], c: '<b>A twist: Ctrl+C.</b> If you pressed Ctrl+C, the terminal driver passes on no character. Instead the kernel sends a <b>signal</b> (SIGINT) to the program in the foreground, which normally ends it.' },
          ],
          pkt: [
            { k: ['nic'], c: '<b>A packet arrives.</b> The network card receives it, copies it into a buffer in system memory by <span class="t">DMA</span> (without the CPU\'s help), and raises an interrupt.' },
            { k: ['intr', 'cpu'], c: '<b>Interrupts.</b> The CPU stops what it was doing and runs the network card\'s interrupt handler in kernel mode.' },
            { k: ['netdrv'], c: '<b>Network device drivers.</b> The card\'s driver collects the packet from the buffer and passes it up to the protocols.' },
            { k: ['net'], c: '<b>Network protocols.</b> IP checks the address; TCP puts the data in order, acknowledges it, and finds the connection (socket) it belongs to.' },
            { k: ['phys'], c: '<b>Physical memory.</b> The data waits in that socket\'s receive buffer, in page frames the kernel owns.' },
            { k: ['sched'], c: '<b>Processes and scheduler.</b> Your browser was asleep inside <code>recv()</code>, waiting for data. It is woken and made ready to run.' },
            { k: ['sys', 'user'], c: '<b>System calls.</b> <code>recv()</code> copies the data into the browser\'s own memory and returns. The web page keeps loading.' },
          ],
          file: [
            { k: ['user', 'sys'], c: '<b>The editor calls <code>read(fd, buf, 4096)</code>.</b> A special instruction traps into kernel mode, and the system-call layer runs the read handler.' },
            { k: ['fs'], c: '<b>File systems.</b> The file system works out which disk blocks hold that part of the file and checks whether they are already cached in memory.' },
            { k: ['vm', 'phys'], c: '<b>Not cached.</b> The memory manager hands over a free page frame to hold the data when it arrives.' },
            { k: ['blk', 'disk'], c: '<b>Block device drivers.</b> The disk driver queues a request to read those blocks, and the disk gets to work.' },
            { k: ['sched'], c: '<b>Processes and scheduler.</b> Disks are slow, so the editor is put to sleep and another process gets the CPU.' },
            { k: ['disk', 'intr', 'cpu'], c: '<b>Interrupts.</b> The disk finishes and raises an interrupt. The driver marks the request done, and the editor is made ready again.' },
            { k: ['trap', 'vm'], c: '<b>Traps and faults.</b> Suppose the page holding <code>buf</code> was not in memory yet. Copying into it causes a page fault; virtual memory brings the page in, and the copy carries on.' },
            { k: ['sys', 'user'], c: '<b>Back to user mode.</b> <code>read()</code> returns the number of bytes it read, and the editor has its data.' },
          ],
        };
        function traceTab(p) {
          mode = 'trace';
          let which = 'key', player = null;
          const holder = h('div', {});
          const SHORT = { user: 'process', sys: 'system call', sig: 'signals', sched: 'scheduler', vm: 'virtual memory', fs: 'file system', net: 'protocols', trap: 'trap', intr: 'interrupt', phys: 'physical memory', chr: 'character driver', blk: 'block driver', netdrv: 'network driver', cpu: 'CPU', mem: 'memory', term: 'terminal', disk: 'disk', nic: 'NIC' };
          const pathEl = h('div', { class: 'small', style: { lineHeight: '1.5' } });
          function build() {
            const F = TR[which];
            player = ctx.ui.player({ count: F.length, interval: 3400, speed: false, render: (i) => { trace = { f: F, i }; draw(); pathEl.innerHTML = '<b>Path so far:</b> ' + F.slice(0, i + 1).map((fr, j) => `<b style="color:var(--chc)">${j + 1}</b> ${fr.k.map((k) => SHORT[k]).join(' + ')}`).join(' → '); return F[i].c; } });
            holder.replaceChildren(player.el);
            ctx.refit();
          }
          const seg = ctx.ui.seg([{ value: 'key', label: 'A key press' }, { value: 'pkt', label: 'A packet arrives' }, { value: 'file', label: 'A file is read' }], which, (v) => { if (player) player.stop(); which = v; build(); });
          build();
          p.append(h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'small m0' }, 'Pick an event, then step through it. The numbers on the map show the order in which the kernel\'s parts get involved.'),
            seg, holder, pathEl,
            h('div', { class: 'callout why m0 small', 'data-label': 'Notice' }, 'In every event the kernel sits in the middle: hardware reaches it through interrupts, and processes reach it only through system calls.')));
          return () => { if (player) player.stop(); mode = 'explore'; trace = null; };
        }
        tabsEl = ctx.ui.tabs([{ label: 'Explore the parts', render: exploreTab }, { label: 'Trace what happens when…', render: traceTab }]);
        el.append(h('div', { class: 'split kgrid fill' },
          h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center' } }, svg),
          tabsEl));
      },
    },
    /* ---------------- 8. Recap ---------------- */
    {
      title: 'Recap: eight things to remember about Linux',
      kind: 'recap',
      render(el, ctx) {
        const { h } = ctx;
        el.append(h('div', { class: 'stack fill' },
          h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. If one surprises you, revisit that step.'),
          h('div', { class: 'grow' }, ctx.ui.flipcards([
            ['Who started Linux, when, and on what?', 'Linus Torvalds, a Finnish computer science student, in 1991: a UNIX-like kernel for his Intel 80386 PC, posted on the Internet so that others could join in.'],
            ['Why did Linux succeed?', 'It was free under the GNU GPL, it completed the FSF\'s GNU tools into a whole free system, collaborators worldwide improved it, and its modular, portable design runs almost anywhere.'],
            ['The GPL deal, in one line', 'Use, study, change and share it freely. If you distribute it, changed or not, pass on the same freedoms and the source code (copyleft).'],
            ['Monolithic, yet modular?', 'All kernel code runs in kernel mode in one address space and calls itself directly (monolithic), but much of it comes as loadable modules added and removed while the system runs.'],
            ['Dynamic linking', 'A module is loaded and linked into the kernel while it runs: its unresolved names get real addresses from the kernel symbol table. It can be unlinked and removed at any time.'],
            ['Stackable modules', 'Modules form a hierarchy: lower ones are libraries for the clients above. Counted references let the kernel load prerequisites first and refuse to remove a module that others need.'],
            ['What does a module-table entry hold?', 'Name, size, usecount, flags, its symbol table (exported names and addresses) and its dependencies. Entries form a linked list, newest first. rmmod needs usecount 0 and no module stacked on it.'],
            ['Name the kernel\'s components', 'Signals, system calls, processes and scheduler, virtual memory, file systems, network protocols, character, block and network device drivers, traps and faults, physical memory, interrupts.'],
          ], { cols: 4, height: 228 }))));
      },
    },
    /* ---------------- 9. Check yourself ---------------- */
    {
      title: 'Check yourself: Linux',
      kind: 'check',
      quiz: [
        { q: 'Linux was first written for which kind of computer?',
          choices: ['A DEC PDP-7 minicomputer', 'A Cray supercomputer', 'A PC built around Intel\'s 80386 processor', 'An ARM-based smartphone'], answer: 2,
          feedback: ['That is where the original UNIX was born, around 1969, not Linux.', 'Linux runs the fastest supercomputers today, but it began on one student\'s PC.', null, 'Phones came much later: Linux reached them through Android in 2008.'],
          why: 'In 1991 Linus Torvalds, a computer science student in Finland, wrote a UNIX-like kernel for his own IBM-compatible PC with an Intel 80386 processor and shared it on the Internet.' },
        { q: 'In the early 1990s, what did the GNU project and Linux each contribute to a complete free operating system?',
          choices: ['Linux had the tools; GNU supplied the kernel', 'GNU had the compiler, shell, C library and utilities; Linux supplied the missing kernel', 'GNU wrote the GPL specially for Linux once Linux was finished', 'Nothing: Linux was a complete system on its own from day one'], answer: 1,
          feedback: ['It was the other way round: GNU\'s own kernel was not ready.', null, 'The FSF published the GPL in 1989, two years before Linux existed; Linux adopted it in 1992.', 'A kernel alone gives you no compiler, no shell and no commands; the GNU tools filled those layers.'],
          why: 'The FSF\'s GNU project had built almost every layer of a UNIX-like system except a finished kernel. Linux filled that gap, which is a big part of why it succeeded.' },
        { type: 'tf', q: 'Under the GNU GPL, a company that sells a device running a modified Linux kernel must make the source code of its kernel changes available to the people who buy the device.', answer: true,
          why: 'Distributing GPL software, changed or not, brings the copyleft duty: recipients must be able to get the source code, including the changes, under the same license.' },
        { q: 'Which of these is <b>not</b> stored in a module\'s entry in the Linux module table?',
          choices: ['The module\'s usecount', 'The symbols the module exports, with their addresses', 'The modules it depends on', 'The ID of the process in which the module runs'], answer: 3,
          feedback: ['It is stored: the usecount counts the operations using the module right now, and the kernel checks it before unloading.', 'It is stored: the module\'s own symbol table lists each exported name with its address, so later modules can link against them.', 'It is stored: the dependency list lets the kernel keep needed modules loaded and refuse unsafe removals.', null],
          why: 'A module is not a process, so it has no process ID: its code runs in kernel mode on behalf of whichever process calls it. An entry holds the name, size, usecount, flags, exported symbols and dependencies, plus a pointer to the next entry.' },
        { type: 'multi', q: 'Which statements about a Linux loadable module are true? Select all that apply.',
          choices: ['It runs in kernel mode', 'It can be loaded and unloaded while the system is running', 'It runs as a separate process with its own address space', 'It usually implements one function, such as a driver, a file system or a network protocol', 'It communicates with the rest of the kernel only by sending messages'], answer: [0, 1, 3],
          why: 'A module is linked into the kernel and runs in kernel mode on behalf of the current process. It is not a process of its own, and it uses ordinary function calls, not messages. That is why modules do not turn Linux into a microkernel.' },
        { type: 'order', q: 'Put the life of a Linux loadable module into the correct order, from loading to unloading.',
          items: ['The module file (.ko) is read from disk', 'Its code and data are copied into kernel memory', 'Each unresolved name gets its real address from the kernel symbol table', 'Its init function runs and registers the module', 'Operations call its functions, so its usecount rises above 0', 'Its usecount falls back to 0, and rmmod unloads it'],
          why: 'Each step needs the one before it: code must be in memory before it can be linked, linked (every call pointing at a real address) before init can safely run, registered before anyone can use it, and idle before it can be removed.' },
        { type: 'tf', q: 'In the Linux module table, a module whose usecount is 0 can always be unloaded with rmmod.', answer: false,
          why: 'The usecount only counts operations using the module right now. The kernel also checks the modules stacked on it: with usb_storage loaded, <code>rmmod usbcore</code> is refused ("in use by: usb_storage") even at usecount 0, because usb_storage calls usbcore\'s functions.' },
        { type: 'num', q: 'A module\'s usecount is 0. Five operations that use its functions start, and then two of them finish. What is its usecount now?', answer: 3, tol: 0,
          why: 'The usecount rises by 1 when an operation using the module starts and falls by 1 when it ends: 0 + 5 − 2 = 3. The module cannot be unloaded until the count is back to 0.' },
        { type: 'num', q: 'In a microkernel system, an app sends a read request to a user-mode file server, which sends its own request to a user-mode disk-driver server. Each request gets a reply. How many messages are passed in total?', answer: 4, tol: 0,
          why: 'Two requests (app → file server, file server → driver) plus two replies (driver → file server, file server → app) make 4 messages, each a trip into and out of the kernel. A monolithic kernel such as Linux does the same work with direct function calls.' },
        { type: 'match', q: 'Match each Linux kernel component to its job.',
          pairs: [['Signals', 'Tell a process that an event happened, such as Ctrl+C'], ['Processes and scheduler', 'Decide which ready process runs next'], ['Virtual memory', 'Map each process\'s addresses onto real page frames'], ['Traps and faults', 'Handle errors the processor itself detects, such as a page fault'], ['Block device drivers', 'Read and write fixed-size blocks on disks'], ['Network protocols', 'Carry out rules such as IP and TCP']],
          why: 'Each component owns one kind of work. Signals and traps both deal with events, but signals are notices sent to processes, while traps are raised by the processor itself.' },
        { type: 'bucket', q: 'Which kernel design does each statement describe?', buckets: ['Monolithic / Linux', 'Microkernel'],
          items: [['All services share one address space', 0], ['Drivers run as user-mode processes', 1], ['A request needs several messages', 1], ['A buggy driver can crash everything', 0], ['Parts call each other directly', 0], ['A crashed driver can be restarted', 1]],
          why: 'Monolithic kernels, Linux included, trade isolation for speed: one address space and direct calls. Microkernels trade speed for isolation: services are separate processes that talk by messages.' },
        { q: 'A network packet arrives and the network card raises an interrupt. Which kernel component takes the packet from the card first?',
          choices: ['Network device drivers', 'Network protocols', 'File systems', 'Signals'], answer: 0,
          feedback: [null, 'The protocols (IP, then TCP) work on the packet next, after the driver hands it up.', 'File systems manage files on storage devices, not packets.', 'Signals notify processes; they do not move data.'],
          why: 'The interrupt handler belongs to the card\'s network device driver, which collects the packet and passes it up to the network protocols. Only then is the waiting process woken.' },
      ],
    },
  ],

  notes: `
    <h3>Linux in brief</h3>
    <p><b>Linux</b> is a free, open-source, UNIX-like operating-system kernel: it follows the design and commands of UNIX but contains no UNIX code. It is <b>monolithic, yet built from loadable modules</b>, and it runs on routers, phones, laptops, cloud servers and every one of the world's 500 fastest supercomputers. Its winning traits: free and open source, highly modular, easily configured, and able to run on many platforms.</p>
    <h3>History</h3>
    <ul>
      <li><b>1983–1985:</b> Richard Stallman launches the <b>GNU project</b> (a complete, free UNIX-like system) and founds the <b>Free Software Foundation (FSF)</b>. By 1991 GNU has a compiler (GCC), a shell (bash), a C library, editors and utilities, but no finished kernel.</li>
      <li><b>1991:</b> <b>Linus Torvalds</b>, a computer science student at the University of Helsinki in Finland, writes a UNIX-like kernel for his PC with a 32-bit <b>Intel 80386</b> processor and posts it on the Internet. Volunteers worldwide join in.</li>
      <li><b>1992:</b> Linux is released under the <b>GNU GPL</b>. With the GNU tools it forms a complete free system, and the first distributions (kernel plus tools, ready to install) appear.</li>
      <li><b>1994:</b> version 1.0 for 386 PCs, with networking. <b>Mid 1990s:</b> loadable modules; ports to Alpha, SPARC and MIPS; version 2.0 (1996) uses several processors.</li>
      <li><b>2000s:</b> servers, paid company developers, embedded devices. <b>2008:</b> Android phones ship with a Linux kernel (section 2.11). <b>Today:</b> a release every nine or ten weeks, thousands of developers, about twenty processor families.</li>
    </ul>
    <h3>Why Linux succeeded</h3>
    <ul>
      <li><b>Free software under the GPL:</b> anyone may run, study, change and share the code. Whoever distributes it, changed or not, must pass on the same freedoms and make the source available. This rule is <b>copyleft</b>: improvements can never be locked away. "Free" means freedom, not zero price.</li>
      <li><b>The GNU tools</b> supplied every layer except the kernel, so Linux completed a usable system (hence "GNU/Linux" for the whole system; strictly, Linux is only the kernel).</li>
      <li>Collaboration over the Internet, and a modular, portable design.</li>
    </ul>
    <p><b>GPL cases.</b> Allowed: reading the source, changing it privately without distributing it, selling copies (with the source). Not allowed: shipping a device with a changed kernel while hiding the changes, or putting GPL code into a program under a license that forbids sharing.</p>
    <h3>Monolithic, microkernel and Linux</h3>
    <p>A <b>monolithic kernel</b> runs all OS services (scheduling, memory, file systems, drivers, networking) as one big program in kernel mode, in one address space, and its parts call each other directly. A <b>microkernel</b> keeps only message passing, address spaces and basic scheduling in the kernel and runs file systems and drivers as user-mode server processes. <b>Linux is monolithic, but structured as a collection of loadable modules.</b> Modules do not make it a microkernel: a loaded module shares the kernel's address space and privileges, so a buggy one can crash the system (an "oops" may kill only the current process; a "kernel panic" stops everything).</p>
    <table>
      <tr><th></th><th>Monolithic</th><th>Microkernel</th><th>Linux</th></tr>
      <tr><td>Request speed</td><td>Fast: direct calls</td><td>Slower: messages</td><td>Fast: direct calls</td></tr>
      <tr><td>A driver bug</td><td>Can crash everything</td><td>Contained; server restarted</td><td>Can crash everything</td></tr>
      <tr><td>Adding a driver</td><td>Rebuild and restart</td><td>Start a server process</td><td>Load a module, no restart</td></tr>
    </table>
    <p><b>Worked example.</b> Reading a file in a monolithic kernel (or Linux) costs 2 user/kernel crossings (the system call in, the return out) and 0 messages. In a microkernel where the app asks a file server, which asks a disk-driver server, there are 2 requests + 2 replies = <b>4 messages</b>, each going into and out of the kernel: <b>8 crossings</b>.</p>
    <h3>Loadable modules</h3>
    <p>A <b>loadable module</b> is a relatively independent block of kernel code that usually does one job: a file system (vfat), a device driver (usb_storage) or a network protocol (bluetooth). It can be loaded and unloaded while the system runs, and it is <b>not a separate process</b>: its code runs in kernel mode on behalf of the current process, for example during that process's system call. Two key properties:</p>
    <ol>
      <li><b>Dynamic linking.</b> A module can be loaded and linked into the kernel while the kernel is in memory and running, and unlinked and removed at any time. Loading: read the .ko file from disk → copy its code and data into kernel memory → give each name it calls but does not contain its real address from the kernel <b>symbol table</b> → enter it at the front of the module table with its dependencies → run its init function. Unloading runs its exit function, removes its symbols, unlinks its entry and frees its memory.</li>
      <li><b>Stackable modules.</b> Modules form a hierarchy: a lower module is a library for the client modules above it (usb_storage and xhci_hcd use usbcore; uas uses usb_storage; vfat uses fat), and the kernel counts these references. Shared code therefore exists only once, and the kernel can load prerequisites first and refuse to remove a module that others still need.</li>
    </ol>
    <h3>The module table</h3>
    <p>The kernel keeps its loaded modules in a <b>linked list</b>, newest first. Each entry records:</p>
    <table>
      <tr><th>Field</th><th>What it records</th></tr>
      <tr><td>next</td><td>Address of the next entry (NULL at the end of the list)</td></tr>
      <tr><td>name</td><td>The module's name; rmmod and lsmod find entries by it</td></tr>
      <tr><td>size</td><td>Kernel memory its code and data occupy, freed on unload</td></tr>
      <tr><td>usecount</td><td>Operations using it right now: +1 when one starts, −1 when it ends</td></tr>
      <tr><td>flags</td><td>Its state: loading (init still running), live, or going (being removed)</td></tr>
      <tr><td>symbol table (syms, nsyms)</td><td>The names it exports, each with its address</td></tr>
      <tr><td>dependencies (deps, ndeps)</td><td>The modules it relies on; the entry also lists the modules that rely on it (refs)</td></tr>
    </table>
    <ul>
      <li><b>rmmod is refused</b> if the usecount is above 0 <b>or</b> another loaded module depends on the target. Usecount 0 alone is not enough: with usb_storage loaded, <code>rmmod usbcore</code> fails ("in use by: usb_storage").</li>
      <li>Usecount example: start at 0, five operations begin and two end, so the usecount is 0 + 5 − 2 = 3.</li>
      <li><code>insmod</code> loads exactly one module and fails with "Unknown symbol" if a module it needs is missing. <code>modprobe</code> loads prerequisites first (for uas: usbcore, usb_storage, uas); the system runs it automatically when you plug in a device.</li>
      <li>Modern kernels merge the usecount and the references from other modules into one counter (the "Used by" number in lsmod); the rules are the same.</li>
    </ul>
    <h3>Kernel components</h3>
    <table>
      <tr><th>Component</th><th>Job</th></tr>
      <tr><td>System calls</td><td>The entry points through which processes ask the kernel for services</td></tr>
      <tr><td>Signals</td><td>Notify a process of an event (Ctrl+C sends SIGINT)</td></tr>
      <tr><td>Processes and scheduler</td><td>Create and end processes and threads; choose which runs next</td></tr>
      <tr><td>Virtual memory</td><td>Give each process its own address space, mapping its pages onto page frames</td></tr>
      <tr><td>File systems</td><td>Turn disk blocks into files and folders (ext4, vfat and more)</td></tr>
      <tr><td>Network protocols</td><td>Carry out IP, TCP and other protocols for sockets</td></tr>
      <tr><td>Character device drivers</td><td>Byte-stream devices: keyboards, terminals, mice</td></tr>
      <tr><td>Block device drivers</td><td>Fixed-size-block devices: disks, SSDs, USB sticks</td></tr>
      <tr><td>Network device drivers</td><td>Move packets to and from the network interface controller</td></tr>
      <tr><td>Traps and faults</td><td>Handle exceptions the processor raises itself (page fault, divide by zero)</td></tr>
      <tr><td>Physical memory</td><td>Track and hand out RAM's page frames (fixed-size slots, typically 4 KB)</td></tr>
      <tr><td>Interrupts</td><td>Run the handler when a device raises an interrupt</td></tr>
    </table>
    <p>Above the kernel sit user-level processes and threads; below it the hardware: CPU, system memory, terminal, disk and network interface controller (NIC). File systems, network protocols and device drivers are the parts most often loaded as modules.</p>
    <ul>
      <li><b>Key press:</b> interrupt → character (terminal) driver buffers the byte → scheduler wakes the shell → its read() returns. Ctrl+C instead sends a SIGINT signal.</li>
      <li><b>Packet arrives:</b> NIC copies it to memory by DMA and interrupts → network device driver takes it first → IP and TCP → socket buffer → scheduler wakes the browser → recv() returns.</li>
      <li><b>File read:</b> read() → file system (is it cached?) → a page frame is set aside → block driver asks the disk → another process runs meanwhile → disk interrupt → a page fault may bring in the buffer's page → read() returns.</li>
    </ul>`,
});
