/* Section 2.4 — Developments Leading to Modern Operating Systems
   Original teaching material. Built step by step (see AUTHORING.txt). */
Guide.section({
  id: '2.4',
  title: 'Developments Leading to Modern Operating Systems',
  short: 'Modern OS developments',
  summary: 'Why OSs changed, and five answers: microkernels, threads, SMP, distributed OSs and object design.',
  objectives: [
    'Name the three forces (new hardware, new applications, new security threats) that pushed operating systems to change.',
    'Contrast a monolithic kernel with a microkernel, and explain why a microkernel is simpler, more flexible and suited to distributed systems.',
    'Define thread and process, explain when multithreading helps, and explain why a thread switch is cheaper than a process switch.',
    'Describe symmetric multiprocessing (SMP), its four potential advantages, and the difference between multiprogramming and multiprocessing.',
    'Explain what a distributed operating system and object-oriented design add to an operating system.',
  ],
  terms: [
    ['Monolithic kernel', 'A kernel that holds almost the whole operating system (scheduling, file systems, networking, device drivers, memory management and more) as one large program that runs as a single process in one shared address space.'],
    ['Microkernel', 'A small kernel that keeps only the essential core functions (address spaces, interprocess communication and basic scheduling) and leaves every other OS service to server processes that run in user mode.'],
    ['Address space', 'The range of memory addresses a process is allowed to use. The hardware, set up by the kernel, keeps each process inside its own address space, so one process cannot read or damage another\'s memory.'],
    ['Interprocess communication (IPC)', 'Any mechanism that lets separate processes exchange data; in a microkernel it is the kernel delivering messages from one process to another.'],
    ['Server process', 'In a microkernel system, an OS service such as a file system or a device driver that runs as an ordinary user-mode process and does its work when request messages arrive.'],
    ['Client/server computing', 'Organising work so that client programs send requests to server programs, often on other machines, which do the work and send back replies.'],
    ['Thread', 'A dispatchable unit of work inside a process. It has its own processor context (program counter and other registers) and its own stack, runs its instructions one after another, and can be interrupted so the processor can turn to another thread.'],
    ['Process', 'A collection of one or more threads together with the system resources they share: memory holding code and data, open files and devices. Informally, a program in execution.'],
    ['Multithreading', 'Dividing one process into several threads that can run concurrently, so one application can work on several independent tasks at once.'],
    ['Thread switch', 'Moving the processor from one thread to another thread of the same process. Only the processor context and the stack change, so it costs much less than a switch between processes.'],
    ['Process switch', 'Moving the processor from one process to another. Besides saving and loading registers, the OS must switch to the other process\'s address space, after which the processor\'s cached address translations and cached data no longer help. It is one kind of context switch.'],
    ['Symmetric multiprocessing (SMP)', 'A computer with two or more similar processors that share main memory and I/O and can each run any work, including the OS, under one integrated operating system; the term also covers the OS behaviour that exploits such hardware.'],
    ['Multiprocessing', 'Running processes on several processors, so that their execution can both take turns (interleave) and truly happen at the same instant (overlap).'],
    ['Incremental growth', 'Raising a system\'s performance by adding a part, such as one more processor, instead of replacing the whole machine.'],
    ['Scaling', 'Offering a family of machines that run the same software but differ in price and performance, for example by the number of processors they contain.'],
    ['Cluster', 'A group of interconnected, complete computers that work together as one unified computing resource.'],
    ['Distributed operating system', 'An operating system for a cluster of networked computers that gives the illusion of one single main memory and one single secondary-memory space, plus unified services such as a distributed file system.'],
    ['Distributed file system', 'A file system spread over several machines that users see as one ordinary tree of files and folders, without needing to know which machine stores each file.'],
    ['Object-oriented design', 'Building software from objects: self-contained modules that hide their inner data and are used only through defined interfaces. In an OS it gives a disciplined way to add modular extensions to a small kernel.'],
  ],

  css: `
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width and the page scrolls sideways */
    .sec-2-4 .step-eyebrow { contain: inline-size; }
    .sec-2-4 .xs-card { font-size: 13.5px; line-height: 1.35; padding: 7px 10px; }
    .sec-2-4 .ok-t { color: var(--ok); font-weight: 700; }
    .sec-2-4 .bad-t { color: var(--bad); font-weight: 800; }
    .sec-2-4 .player-cap { min-height: 66px; }
    /* step 3: kernel builder */
    .sec-2-4 .zone { border: 2px solid var(--line-2); border-radius: 12px; padding: 7px 10px 10px; display: flex; flex-direction: column; gap: 6px; min-height: 148px; transition: background .25s, border-color .25s; }
    .sec-2-4 .zone.user { background: var(--panel-2); border-style: dashed; }
    .sec-2-4 .zone.kern { background: var(--os-bg); border-color: var(--os); }
    .sec-2-4 .zone.kern.panic { background: var(--bad-bg); border-color: var(--bad); }
    .sec-2-4 .zone-lbl { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); }
    .sec-2-4 .zone-lbl .zl-note { text-transform: none; letter-spacing: 0; font-weight: 650; }
    .sec-2-4 .zone.kern .zone-lbl { color: var(--os); }
    .sec-2-4 .zone.kern.panic .zone-lbl { color: var(--bad); }
    .sec-2-4 .tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .sec-2-4 .svc { display: flex; flex-direction: column; justify-content: center; gap: 1px; min-height: 50px; padding: 5px 9px; border: 2px solid var(--os); border-radius: 10px; background: var(--panel); color: var(--ink); text-align: left; font: inherit; cursor: pointer; line-height: 1.25; transition: opacity .2s, transform .08s; }
    .sec-2-4 button.svc:hover { box-shadow: 0 0 0 2px color-mix(in srgb, var(--os) 40%, transparent); }
    .sec-2-4 button.svc:active { transform: translateY(1px); }
    .sec-2-4 .svc b { font-size: 14.5px; }
    .sec-2-4 .svc > span { font-size: 12.5px; color: var(--muted); }
    .sec-2-4 .svc.srv { border-style: dashed; background: var(--os-bg); }
    .sec-2-4 .svc.core { cursor: help; }
    .sec-2-4 .svc .lock { font-style: normal; font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--os); border: 1px solid var(--os); border-radius: 5px; padding: 0 4px; margin-right: 3px; vertical-align: 1px; }
    .sec-2-4 .svc.core { border-width: 3px; }
    .sec-2-4 .svc.app { border-color: var(--proc); background: var(--proc-bg); cursor: default; }
    .sec-2-4 .svc.dead { border-color: var(--bad); background: var(--bad-bg); border-style: solid; }
    .sec-2-4 .svc.down { opacity: .45; }
    .sec-2-4 .svc .st { font-size: 12.5px; }
    .sec-2-4 .hwstrip { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); }
    .sec-2-4 .kind-name { font-size: 22px; font-weight: 800; color: var(--os); line-height: 1.2; }
    .sec-2-4 .result { min-height: 118px; }
    .sec-2-4 .result .callout { font-size: 14.5px; line-height: 1.42; }
    .sec-2-4 .result .btn { margin-top: 6px; }
    .sec-2-4 .benefits { display: flex; flex-direction: column; gap: 4px; }
    .sec-2-4 .ben { display: grid; grid-template-columns: 22px 1fr; align-items: center; gap: 6px; padding: 4px 8px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel); font-size: 13.5px; line-height: 1.3; transition: background .25s, border-color .25s; }
    .sec-2-4 .ben .tick { font-weight: 900; color: var(--line-2); text-align: center; }
    .sec-2-4 .ben.on { border-color: color-mix(in srgb, var(--ok) 55%, transparent); background: var(--ok-bg); }
    .sec-2-4 .ben.on .tick { color: var(--ok); }
    /* step 4: process anatomy */
    .sec-2-4 .pgrid { display: grid; grid-template-columns: minmax(0, 3.1fr) minmax(0, 1fr); gap: 8px; }
    .sec-2-4 .pbox { display: flex; flex-direction: column; gap: 7px; padding: 8px 10px 10px; border: 2px solid var(--proc); border-radius: 12px; background: var(--proc-bg); min-width: 0; }
    .sec-2-4 .pbox > b, .sec-2-4 .pbox .row > b { font-size: 15px; }
    .sec-2-4 .shared { border-radius: 9px; padding: 6px 8px; background: color-mix(in srgb, var(--proc) 14%, var(--panel)); display: flex; flex-direction: column; gap: 5px; }
    .sec-2-4 .res-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
    .sec-2-4 .res { height: 30px; border-radius: 8px; border: 1px solid var(--proc); background: var(--panel); color: var(--ink); font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer; }
    .sec-2-4 .res:hover { background: var(--proc-bg); }
    .sec-2-4 .thr-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
    .sec-2-4 .thr-row.one { grid-template-columns: 1fr; }
    .sec-2-4 .thr { display: flex; flex-direction: column; gap: 2px; padding: 6px 7px; border: 2px solid var(--thread); border-radius: 10px; background: var(--thread-bg); color: var(--ink); font: inherit; text-align: left; cursor: pointer; min-width: 0; }
    .sec-2-4 .thr b { font-size: 14px; color: var(--thread); }
    .sec-2-4 .thr .chip { font-size: 11.5px; padding: 0 6px; }
    .sec-2-4 .thr.run { box-shadow: 0 0 0 3px color-mix(in srgb, var(--thread) 45%, transparent); background: var(--panel); }
    .sec-2-4 .thr .xs { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sec-2-4 .stk { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 5px; }
    .sec-2-4 .stk .meter { height: 7px; }
    .sec-2-4 .stk .meter > i { background: var(--thread); }
    .sec-2-4 .cpu-box { border: 2px solid var(--cpu); background: var(--cpu-bg); border-radius: 12px; padding: 8px 11px; display: flex; flex-direction: column; gap: 2px; font-size: 15px; }
    .sec-2-4 .chk { border: 1px solid var(--line); background: var(--panel-2); border-radius: 12px; padding: 7px 10px; display: flex; flex-direction: column; gap: 2px; }
    .sec-2-4 .ci { display: grid; grid-template-columns: 18px 1fr; gap: 4px; font-size: 13.5px; line-height: 1.3; }
    .sec-2-4 .ci span { font-weight: 900; text-align: center; color: var(--muted); }
    .sec-2-4 .ci.done span { color: var(--ok); }
    .sec-2-4 .ci.skip { opacity: .45; text-decoration: line-through; }
    /* step 5: server timeline */
    .sec-2-4 .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .sec-2-4 .kpis .big { font-size: 34px; color: var(--chc); }
    .sec-2-4 .lg { display: inline-flex; align-items: center; gap: 4px; }
    .sec-2-4 .sw { display: inline-block; width: 13px; height: 11px; border-radius: 3px; border: 1.5px solid; }
    .sec-2-4 .sw.run { background: var(--proc-bg); border-color: var(--proc); }
    .sec-2-4 .sw.ovh { background: var(--warn); border-color: var(--warn); }
    .sec-2-4 .sw.io { background: var(--io-bg); border-color: var(--io); }
    .sec-2-4 .sw.cpu { background: var(--cpu-bg); border-color: var(--cpu); }
    .sec-2-4 .sw.q { background: var(--panel-2); border-color: var(--line-2); border-style: dashed; }
    /* step 6: SMP */
    .sec-2-4 .mode-lbl { font-size: 14.5px; display: flex; align-items: center; gap: 8px; min-height: 24px; }
    .sec-2-4 .tight-list li { margin: 1px 0; line-height: 1.4; }
    /* step 7: object-oriented design */
    .sec-2-4 .kcore { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 8px 12px; border: 2.5px solid var(--os); border-radius: 12px; background: var(--os-bg); }
    .sec-2-4 .kcore > b { color: var(--os); font-size: 15.5px; }
    .sec-2-4 .slots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .sec-2-4 .slot { display: flex; flex-direction: column; gap: 5px; position: relative; }
    .sec-2-4 .slot::before { content: ''; position: absolute; left: 50%; top: -9px; height: 9px; border-left: 2px solid var(--os); }
    .sec-2-4 .iface { display: flex; flex-direction: column; min-height: 44px; padding: 4px 8px; border-radius: 8px; border: 1.5px solid var(--os); background: var(--panel); line-height: 1.3; }
    .sec-2-4 .iface b { font-size: 13.5px; color: var(--os); }
    .sec-2-4 .obj { min-height: 40px; display: grid; place-items: center; text-align: center; padding: 4px 6px; border-radius: 9px; border: 2px dashed var(--line-2); color: var(--muted); font-size: 13.5px; font-weight: 700; line-height: 1.25; }
    .sec-2-4 .slot.full .obj { border-style: solid; border-color: var(--os); background: var(--os-bg); color: var(--ink); }
    /* step 8: matching recap */
    .sec-2-4 .mprob { flex: none; display: grid; grid-template-columns: 30px minmax(0, 1fr); align-items: center; gap: 1px 10px; width: 100%; padding: 5px 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); color: var(--ink); font: inherit; font-size: 14.5px; line-height: 1.36; text-align: left; cursor: pointer; }
    .sec-2-4 .mprob:hover { border-color: var(--chc); }
    .sec-2-4 .mprob.sel { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); }
    .sec-2-4 .mprob.done { border-color: color-mix(in srgb, var(--ok) 55%, transparent); background: var(--ok-bg); }
    .sec-2-4 .mnum { grid-row: 1 / 3; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-weight: 800; font-size: 14px; background: var(--panel-3); color: var(--ink-2); }
    .sec-2-4 .mprob.done .mnum { background: var(--ok); color: var(--panel); }
    .sec-2-4 .mdev { justify-self: start; font-size: 12.5px; line-height: 1.4; }
    .sec-2-4 .mdevbtn { flex: none; height: 42px; border-radius: 11px; border: 2px solid var(--accent); background: var(--panel); color: var(--accent); font: inherit; font-size: 15.5px; font-weight: 750; cursor: pointer; }
    .sec-2-4 .mdevbtn:hover { background: var(--accent-bg); }
    .sec-2-4 .mdevbtn.sel { background: var(--accent); color: var(--accent-ink); }
    .sec-2-4 .mdevbtn.done { border-color: color-mix(in srgb, var(--ok) 55%, transparent); color: var(--ok); background: var(--ok-bg); cursor: default; }
    /* phones (narrow mode): simpler grids and the button version of the step-1 map */
    .sec-2-4 .nrw .tiles, .sec-2-4 .nrw .thr-row, .sec-2-4 .nrw .res-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sec-2-4 .nrw .pgrid { grid-template-columns: 1fr; }
    .sec-2-4 .nmap .nm-d, .sec-2-4 .nmap .nm-v { font: inherit; font-size: 14px; font-weight: 700; border-radius: 10px; padding: 7px 8px; cursor: pointer; color: var(--ink); }
    .sec-2-4 .nmap .nm-d { border: 2px solid var(--line-2); background: var(--panel-2); opacity: .7; line-height: 1.25; }
    .sec-2-4 .nmap .nm-d.cpu { border-color: var(--cpu); background: var(--cpu-bg); }
    .sec-2-4 .nmap .nm-d.proc { border-color: var(--proc); background: var(--proc-bg); }
    .sec-2-4 .nmap .nm-d.intr { border-color: var(--intr); background: var(--intr-bg); }
    .sec-2-4 .nmap .nm-d.on { opacity: 1; box-shadow: 0 0 0 2px var(--chc); }
    .sec-2-4 .nmap .nm-v { border: 1.5px solid var(--line-2); background: var(--panel-2); text-align: left; }
    .sec-2-4 .nmap .nm-v.on { border: 2px solid var(--accent); background: var(--accent-bg); color: var(--accent); }
    .sec-2-4 .info-line { flex: none; border-left: 4px solid var(--thread); background: var(--panel-2); border-radius: 8px; padding: 7px 11px; line-height: 1.4; min-height: 64px; }
  `,

  steps: [
    /* ---------------- 1. Big picture: three forces → five developments (clickable map) ---------------- */
    {
      title: 'Why operating systems had to change',
      kind: 'story',
      render(el, ctx) {
        const { h, s } = ctx;
        const DRIVERS = [
          { id: 'hw', name: 'New hardware', sub: 'processors, networks, memory', cls: 'cpu', links: ['smp', 'mt', 'dist'],
            changed: 'Machines gained <b>several processors</b>, processors became many times <b>faster</b>, <b>high-speed networks</b> linked computers together, and memory grew <b>larger and more varied</b>.',
            need: 'An OS written for one slow processor leaves the extra processors idle. It must spread work across many processors, keep a fast processor busy, and let networked machines cooperate.' },
          { id: 'app', name: 'New applications', sub: 'multimedia, Web, client/server', cls: 'proc', links: ['mt', 'micro', 'dist', 'ood'],
            changed: '<b>Multimedia</b> (sound and video that must play without stutter), <b>Internet and Web</b> access, and <b><span class="t">client/server computing</span></b>, where one server answers requests from many clients.',
            need: 'A server must juggle many requests at once, and new services must be added, replaced or spread over several machines without rebuilding the whole OS.' },
          { id: 'sec', name: 'New security threats', sub: 'viruses, worms, hacking', cls: 'intr', links: ['micro'],
            changed: 'Once computers joined the Internet, attackers anywhere could reach them: <b>viruses</b>, <b>worms</b> and ever cleverer <b>hacking techniques</b> followed.',
            need: 'The OS must protect itself and its users. Keeping the all-powerful kernel small, and running most services with limited rights, shrinks the damage one flaw can do.' },
        ];
        const DEVS = [
          { id: 'micro', name: 'Microkernel architecture', where: 'Steps 2 and 3', what: 'Keep only a tiny core in the kernel and run every other OS service as a separate process in user mode.' },
          { id: 'mt', name: 'Multithreading', where: 'Steps 4 and 5', what: 'Divide one process into several threads that can run concurrently, each working on an independent task.' },
          { id: 'smp', name: 'Symmetric multiprocessing', where: 'Step 6', what: 'Several similar processors share one memory under one OS, which runs work on all of them at the same time.' },
          { id: 'dist', name: 'Distributed operating system', where: 'Step 7', what: 'Make a cluster of networked computers look like one machine with one memory and one file system.' },
          { id: 'ood', name: 'Object-oriented design', where: 'Step 7', what: 'Build the OS from objects with clean interfaces, so it can be extended and customized without breaking it.' },
        ];
        const DY = [28, 124, 220], DH = 74;              // driver boxes (left column of the map)
        const VY = [26, 84, 142, 200, 258], VH = 46;     // development boxes (right column)
        let sel = { type: 'd', id: 'hw' };
        const svg = s('svg', { viewBox: '0 0 640 310', width: '100%', role: 'img', 'aria-label': 'Three forces linked to five developments' });
        const info = h('div', { class: 'card white stack', style: { gap: '6px', flex: '1', minHeight: '0' } });
        const linked = (d, v) => d.links.includes(v.id);
        function draw() {
          const kids = [];
          const litD = (d) => sel.type === 'd' ? sel.id === d.id : linked(d, DEVS.find((v) => v.id === sel.id));
          const litV = (v) => sel.type === 'v' ? sel.id === v.id : linked(DRIVERS.find((d) => d.id === sel.id), v);
          // links first so boxes sit on top
          DRIVERS.forEach((d, i) => DEVS.forEach((v, j) => {
            if (!linked(d, v)) return;
            const on = sel.type === 'd' ? sel.id === d.id : sel.id === v.id;
            const y1 = DY[i] + DH / 2, y2 = VY[j] + VH / 2;
            kids.push(s('path', { d: `M 222 ${y1} C 300 ${y1}, 320 ${y2}, 396 ${y2}`, fill: 'none', style: `stroke:${on ? `var(--${d.cls})` : 'var(--line-2)'}`, 'stroke-width': on ? 3.5 : 1.5, opacity: on ? 1 : 0.55, 'marker-end': on ? `url(#arr-${d.cls})` : null }));
          }));
          DRIVERS.forEach((d, i) => {
            const on = litD(d);
            kids.push(s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': d.name, onclick: () => pick('d', d.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick('d', d.id); } } },
              s('rect', { x: 8, y: DY[i], width: 214, height: DH, rx: 12, class: 's-' + d.cls, 'stroke-width': on ? 3.5 : 1.5, opacity: on ? 1 : 0.6 }),
              s('text', { x: 22, y: DY[i] + 30, 'font-size': 17, 'font-weight': 800 }, d.name),
              s('text', { x: 22, y: DY[i] + 52, 'font-size': 13, class: 's-sub' }, d.sub)));
          });
          DEVS.forEach((v, j) => {
            const on = litV(v);
            kids.push(s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': v.name, onclick: () => pick('v', v.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick('v', v.id); } } },
              s('rect', { x: 400, y: VY[j], width: 232, height: VH, rx: 10, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 3 : 1.5 }),
              s('text', { x: 516, y: VY[j] + 30, 'text-anchor': 'middle', 'font-size': 15.5, 'font-weight': on ? 800 : 600, style: on ? 'fill:var(--accent)' : '' }, v.name)));
          });
          kids.push(s('text', { x: 8, y: 15, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'FORCES'));
          kids.push(s('text', { x: 400, y: 15, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'DEVELOPMENTS'));
          svg.replaceChildren(...kids);
        }
        function paintInfo() {
          if (sel.type === 'd') {
            const d = DRIVERS.find((x) => x.id === sel.id);
            info.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="m0" style="color:var(--${d.cls})">${d.name}</h3><span class="xs muted">pushed toward ${d.links.length} development${d.links.length > 1 ? 's' : ''} (highlighted)</span></div>
              <p class="small m0"><b>What changed.</b> ${d.changed}</p>
              <p class="small m0"><b>What the OS had to learn.</b> ${d.need}</p>`;
          } else {
            const v = DEVS.find((x) => x.id === sel.id);
            const from = DRIVERS.filter((d) => linked(d, v));
            info.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="m0" style="color:var(--accent)">${v.name}</h3><span class="chip">${v.where}</span></div>
              <p class="small m0">${v.what}</p>
              <div class="row gap-s"><span class="small b">Pushed by:</span>${from.map((d) => `<span class="chip ${d.cls}">${d.name}</span>`).join('')}</div>`;
          }
        }
        // phones: the wide SVG map would shrink to unreadable text, so use plain buttons instead
        const nmap = h('div', { class: 'nmap' });
        function drawNarrow() {
          const litV = (v) => sel.type === 'v' ? sel.id === v.id : linked(DRIVERS.find((d) => d.id === sel.id), v);
          const litD = (d) => sel.type === 'd' ? sel.id === d.id : linked(d, DEVS.find((v) => v.id === sel.id));
          nmap.replaceChildren(
            h('div', { class: 'xs b muted' }, 'FORCES'),
            h('div', { class: 'grid-3', style: { gap: '6px' } }, ...DRIVERS.map((d) => h('button', { type: 'button', class: 'nm-d ' + d.cls + (litD(d) ? ' on' : ''), onclick: () => pick('d', d.id) }, d.name))),
            h('div', { class: 'xs b muted' }, 'DEVELOPMENTS'),
            ...DEVS.map((v) => h('button', { type: 'button', class: 'nm-v' + (litV(v) ? ' on' : ''), onclick: () => pick('v', v.id) }, v.name)));
        }
        function pick(type, id) { sel = { type, id }; if (ctx.narrow) drawNarrow(); else draw(); paintInfo(); }
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack' },
            h('p', { class: 'lead m0', html: 'The operating systems of the 1960s and 1970s were built for one slow processor, a room of terminals and users who mostly trusted each other. That world did not last.' }),
            h('p', { class: 'm0', html: 'Beyond the everyday changes of section 2.1, three forces pushed designers to rethink how an <span class="t">operating system</span> is built. <b>Click a force</b> in the map to see what changed, or <b>click a development</b> to see what pushed it.' }),
            h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A small diner becomes a busy food hall. It needs several cooks working at once, each cook juggling several orders, stations that can be swapped without closing the kitchen, and locks on the doors. Making the old kitchen bigger is not enough; it has to be <b>redesigned</b>.' }),
            h('p', { class: 'small muted m0', html: 'By the end of this section you can explain all five developments and say which problem each one solves.' })),
          h('div', { class: 'stack', style: { gap: '10px' } },
            ctx.narrow ? h('div', { class: 'card white tight stack', style: { gap: '6px' } }, nmap) : h('div', { class: 'card white tight', style: { padding: '8px 10px' } }, svg),
            info)));
        if (ctx.narrow) drawNarrow(); else draw();
        paintInfo();
      },
    },
    /* ---------------- 2. Monolithic kernel vs microkernel: follow one read request ---------------- */
    {
      title: 'Two blueprints: monolithic kernel vs microkernel',
      kind: 'compare',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h, s } = ctx;
        let mode = 'mono';
        // ---- geometry shared by both drawings (viewBox 640 x 292) ----
        const BOX = {
          app: { x: 14, y: 36, w: 138, h: 58, t: 'Text editor', sub: 'application', cls: 'proc' },
          app2: { x: 170, y: 36, w: 138, h: 58, t: 'Web browser', sub: 'application', cls: 'proc' },
          fs: { x: 170, y: 36, w: 138, h: 58, t: 'File server', sub: 'user-mode process', cls: 'os', dash: true },
          net: { x: 326, y: 36, w: 138, h: 58, t: 'Network server', sub: 'user-mode process', cls: 'os', dash: true },
          drv: { x: 482, y: 36, w: 144, h: 58, t: 'Disk driver', sub: 'user-mode process', cls: 'os', dash: true },
          disk: { x: 306, y: 250, w: 128, h: 36, t: 'Disk', cls: 'io' },
        };
        const DISK_AT = { mono: 306, micro: 490 };   // the disk sits under whichever part drives it
        const MONO_TILES = ['Scheduling', 'Memory mgmt', 'File system', 'Disk driver', 'Networking', 'IPC'];
        const monoTile = (i) => ({ x: 22 + i * 100, y: 166, w: 96, h: 42 });
        const MICRO_TILES = ['Address spaces', 'IPC', 'Basic scheduling'];
        const microTile = (i) => ({ x: 156 + i * 128, y: 166, w: 120, h: 42 });
        const cx = (b) => b.x + b.w / 2;
        // ---- the two request traces ----
        const TRACE = {
          mono: [
            { hi: ['app'], trips: 0, msgs: 0, cap: '<b>Start.</b> The text editor, a process in user mode, needs part of a file. It asks the OS with a system call, <code>read()</code>.' },
            { hi: ['app', 't2'], arrows: [['app', 't2']], trips: 1, msgs: 0, cap: 'The system call <b>traps into the kernel</b>: the processor switches to kernel mode and jumps to kernel code. That is 1 trip into the kernel. The file-system code, which lives inside the kernel, takes over.' },
            { hi: ['t2', 't3'], arrows: [['t2', 't3']], trips: 1, msgs: 0, cap: 'The file-system code calls the disk driver <b>directly, like calling a function</b>. No message is needed: both parts share one address space.' },
            { hi: ['t3', 'disk'], arrows: [['t3', 'disk']], trips: 1, msgs: 0, cap: 'The driver tells the disk what to read. The disk returns the data blocks to the driver.' },
            { hi: ['t2', 'app'], arrows: [['t2', 'app']], trips: 1, msgs: 0, cap: '<b>Done.</b> The kernel copies the data to the editor and returns to user mode. Cost: <b>1 trip into the kernel, 0 messages</b>. Fast, but every kernel part can touch every other part.' },
          ],
          micro: [
            { hi: ['app'], trips: 0, msgs: 0, cap: '<b>Start.</b> The editor needs part of a file. The file system is now a <b>separate process</b>, so the editor must send it a request <b>message</b>.' },
            { hi: ['app', 'ipc', 'fs'], arrows: [['app', 'ipc'], ['ipc', 'fs']], trips: 1, msgs: 1, cap: 'Every message travels <b>through the microkernel</b>: the editor traps into the kernel (switching to kernel mode) and IPC delivers the request to the file server. Message 1.' },
            { hi: ['fs', 'ipc', 'drv'], arrows: [['fs', 'ipc'], ['ipc', 'drv']], trips: 2, msgs: 2, cap: 'The file server works out which disk blocks hold the data, then sends a message to the disk-driver process, again through the kernel. Message 2.' },
            { hi: ['drv', 'disk'], arrows: [['drv', 'disk']], trips: 2, msgs: 2, cap: 'The disk-driver process operates the disk directly: the kernel has mapped the disk controller\'s registers into the driver\'s address space. The disk returns the data blocks.' },
            { hi: ['drv', 'ipc', 'fs'], arrows: [['drv', 'ipc'], ['ipc', 'fs']], trips: 3, msgs: 3, cap: 'The driver sends the data back to the file server in a reply message, through the kernel. Message 3.' },
            { hi: ['fs', 'ipc', 'app'], arrows: [['fs', 'ipc'], ['ipc', 'app']], trips: 4, msgs: 4, cap: '<b>Done.</b> The file server replies to the editor. Cost: <b>4 messages and 4 trips through the kernel</b> instead of 1. That overhead is the classic price of a microkernel.' },
          ],
        };
        const svg = s('svg', { viewBox: '0 0 640 292', width: '100%', role: 'img', 'aria-label': 'Kernel structure diagram' });
        const tally = h('div', { class: 'row gap-s' });
        function anchor(id) {
          if (BOX[id]) return BOX[id];
          if (id === 'ipc') return microTile(1);
          if (/^t\d$/.test(id)) return monoTile(+id[1]);
          return null;
        }
        function arrowPath(a, b) {
          const A = anchor(a), B = anchor(b);
          const down = A.y < B.y;
          const x1 = cx(A), y1 = down ? A.y + A.h : A.y, x2 = cx(B), y2 = down ? B.y : B.y + B.h;
          if (A.y === B.y) return `M ${x1} ${A.y} C ${x1} ${A.y - 22}, ${x2} ${B.y - 22}, ${x2} ${B.y - 3}`; // same row: arc over the top
          return `M ${x1} ${y1} L ${x2} ${y2 + (down ? -3 : 3)}`;
        }
        function box(b, lit, dim) {
          return s('g', { opacity: dim ? 0.45 : 1 },
            s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 10, class: 's-' + b.cls, 'stroke-width': lit ? 3.5 : 1.8, 'stroke-dasharray': b.dash ? '6 4' : null }),
            s('text', { x: cx(b), y: b.y + (b.sub ? 25 : 23), 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, b.t),
            b.sub ? s('text', { x: cx(b), y: b.y + 44, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, b.sub) : null);
        }
        function tile(r, label, lit) {
          return s('g', {},
            s('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 8, class: lit ? 's-accent' : 's-panel', 'stroke-width': lit ? 3 : 1.4 }),
            s('text', { x: r.x + r.w / 2, y: r.y + 26, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: lit ? 'fill:var(--accent)' : '' }, label));
        }
        function draw(i) {
          const f = TRACE[mode][i];
          BOX.disk.x = DISK_AT[mode];
          const lit = new Set(f.hi);
          const k = [
            s('rect', { x: 2, y: 2, width: 636, height: 110, rx: 12, class: 's-panel', 'stroke-width': 1, opacity: 0.7 }),
            s('text', { x: 14, y: 22, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'USER SPACE'),
            s('text', { x: 14, y: 138, 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--os)', 'letter-spacing': '.08em' }, 'KERNEL SPACE'),
            s('line', { x1: 2, y1: 120, x2: 638, y2: 120, class: 's-muted', 'stroke-dasharray': '8 6' }),
            s('text', { x: 14, y: 272, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'HARDWARE'),
          ];
          if (mode === 'mono') {
            k.push(s('rect', { x: 12, y: 146, width: 616, height: 88, rx: 12, class: 's-os', 'stroke-width': 2.5 }));
            k.push(s('text', { x: 618, y: 227, 'text-anchor': 'end', 'font-size': 12.5, style: 'fill:var(--os)', 'font-weight': 700 }, 'one big program · one address space'));
            MONO_TILES.forEach((t, j) => k.push(tile(monoTile(j), t, lit.has('t' + j))));
            k.push(box(BOX.app, lit.has('app')), box(BOX.app2, false, true));
          } else {
            k.push(s('rect', { x: 146, y: 146, width: 396, height: 88, rx: 12, class: 's-os', 'stroke-width': 2.5 }));
            k.push(s('text', { x: 534, y: 227, 'text-anchor': 'end', 'font-size': 12.5, style: 'fill:var(--os)', 'font-weight': 700 }, 'microkernel · small and privileged'));
            MICRO_TILES.forEach((t, j) => k.push(tile(microTile(j), t, j === 1 && lit.has('ipc'))));
            ['app', 'fs', 'drv', 'net'].forEach((id) => k.push(box(BOX[id], lit.has(id), id === 'net')));
          }
          k.push(box(BOX.disk, lit.has('disk')));
          (f.arrows || []).forEach(([a, b], j) => k.push(s('path', { d: arrowPath(a, b), fill: 'none', style: 'stroke:var(--accent)', 'stroke-width': 3, 'marker-end': 'url(#arr-accent)', class: 'fade-in' })));
          svg.replaceChildren(...k);
          tally.innerHTML = `<span class="chip os">trips into the kernel: ${f.trips}</span><span class="chip accent">messages: ${f.msgs}</span>`;
          return f.cap;
        }
        const player = ctx.ui.player({ count: TRACE.mono.length, render: draw, interval: 2200 });
        const seg = ctx.ui.seg([{ value: 'mono', label: 'Monolithic kernel' }, { value: 'micro', label: 'Microkernel' }], mode, (v) => { mode = v; player.setCount(TRACE[v].length); });
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack', style: { gap: '8px' } },
            h('h3', { class: 'm0', html: '<span class="t">Monolithic kernel</span>' }),
            h('p', { class: 'small m0', html: 'Almost the whole OS lives inside the <span class="t">kernel</span>: scheduling, the file system, networking, device drivers, memory management and more. It is <b>one large program</b> that runs as a single process in <b>one <span class="t">address space</span></b>, so any part can call any other part directly.' }),
            h('h3', { class: 'm0', style: { marginTop: '4px' }, html: '<span class="t">Microkernel</span>' }),
            h('p', { class: 'small m0', html: 'Only the essential core stays in the kernel: managing <b>address spaces</b>, <span class="t">interprocess communication (IPC)</span> and <b>basic scheduling</b>. Every other service runs as a separate <span class="t" data-t="server process">server process</span> in <span class="t">user mode</span>. Servers and applications cooperate by <b>sending messages</b>, and the microkernel delivers each one.' }),
            h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'A microkernel system does <b>not</b> offer fewer services. The same services exist; they have moved <b>out of the kernel</b> into user-mode processes.' }),
            h('p', { class: 'small muted m0', html: 'Pick a design, then press <b>Play</b> (or step with ▶) to follow one file read.' })),
          h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, tally),
            h('div', { class: 'card white tight', style: { padding: '6px 8px' } }, svg),
            player.el,
            h('div', { class: 'grid-2', style: { gap: '8px' } },
              h('div', { class: 'card tight xs-card', html: '<b>Monolithic:</b> <span class="ok-t">fast direct calls</span>, but one buggy part can corrupt or crash the whole kernel.' }),
              h('div', { class: 'card tight xs-card', html: '<b>Microkernel:</b> <span class="ok-t">small kernel, isolated services</span>, but every request costs extra messages.' })))));
      },
    },
    /* ---------------- 3. Lab: move services in or out of the kernel, then stress-test the design ---------------- */
    {
      title: 'Lab: build a kernel, then try to break it',
      kind: 'lab',
      render(el, ctx) {
        const { h } = ctx;
        const SVC = [
          { id: 'ipc', k: 'IPC', sub: 'messages', core: true, why: 'Servers can only talk by messages. If IPC left the kernel, nothing could deliver them, so the whole design would fall apart.' },
          { id: 'as', k: 'Address spaces', sub: 'protection', core: true, why: 'Deciding which memory each process may touch uses privileged hardware controls. If ordinary processes could change them, protection would mean nothing.' },
          { id: 'sched', k: 'Basic scheduling', sub: 'picks next', core: true, why: 'Something privileged must pick the next process or thread and switch the processor to it, including switching between the servers themselves.' },
          { id: 'vm', k: 'Memory manager', u: 'Memory server', sub: 'paging policy' },
          { id: 'fs', k: 'File system', u: 'File server', sub: 'files and folders' },
          { id: 'drv', k: 'Device drivers', u: 'Driver server', sub: 'run the devices' },
          { id: 'net', k: 'Networking', u: 'Network server', sub: 'network protocols' },
        ];
        const MOVABLE = SVC.filter((x) => !x.core).map((x) => x.id);
        if (ctx.narrow) el.classList.add('nrw');
        let where = {}; // id -> 'k' (kernel space) or 'u' (user space)
        let crash = null, fsVer = 1;
        const found = new Set();
        const setAll = (loc) => { MOVABLE.forEach((id) => (where[id] = loc)); SVC.filter((x) => x.core).forEach((x) => (where[x.id] = 'k')); };
        setAll('k');
        const userTiles = h('div', { class: 'tiles' });
        const kernTiles = h('div', { class: 'tiles' });
        const userZone = h('div', { class: 'zone user' }, h('div', { class: 'zone-lbl' }, h('span', {}, 'User space · user mode'), h('span', { class: 'zl-note' })), userTiles);
        const kernZone = h('div', { class: 'zone kern' }, h('div', { class: 'zone-lbl' }, h('span', {}, 'Kernel space · kernel mode'), h('span', { class: 'zl-note' })), kernTiles);
        const kind = h('div', { class: 'kind-name' });
        const kindSub = h('p', { class: 'small m0' });
        const meter = h('div', { class: 'meter' }, h('i'));
        const meterLbl = h('div', { class: 'xs muted' });
        const result = h('div', { class: 'result' });
        const benefits = h('div', { class: 'benefits' });
        const BEN = [
          ['simple', 'Simpler kernel', 'less privileged code to get right'],
          ['flex', 'Flexibility', 'add or replace a service without touching the kernel'],
          ['dist', 'Suits distributed systems', 'a remote server is reached by the same messages'],
          ['iso', 'Failures stay contained', 'a crashed server takes down only itself'],
        ];
        const presets = ctx.ui.seg([{ value: 'mono', label: 'Monolithic' }, { value: 'micro', label: 'Microkernel' }, { value: 'mixed', label: 'Mixed' }], 'mono', (v) => {
          if (v === 'mono') setAll('k');
          else if (v === 'micro') setAll('u');
          else { setAll('k'); where.drv = 'u'; where.fs = 'u'; }
          afterMove();
        });
        // after any change of design: clear old test results; reaching a pure microkernel earns the "simpler kernel" benefit
        function afterMove() {
          crash = null;
          if (design() === 'micro') say('tip', 'Simpler kernel', 'Only the 3 core parts still run in kernel mode, instead of all 7. Less privileged code means less code that must be perfect: the first microkernel benefit. Now run the three tests.');
          else say(null);
          paint();
        }
        const nIn = () => SVC.filter((x) => where[x.id] === 'k').length;
        const design = () => { const m = MOVABLE.filter((id) => where[id] === 'k').length; return m === MOVABLE.length ? 'mono' : m === 0 ? 'micro' : 'mixed'; };
        function tileFor(x) {
          const inK = where[x.id] === 'k';
          const dead = crash && ((crash === 'drv-u' && x.id === 'drv') || crash === 'drv-k');
          const label = inK ? x.k : x.u;
          const st = crash === 'drv-u' && x.id === 'drv' ? '<span class="st bad-t">✗ crashed</span>' : crash === 'drv-k' ? '<span class="st bad-t">✗ halted</span>' : (x.id === 'fs' && fsVer > 1 ? `<span class="st ok-t">v${fsVer} running</span>` : `<span>${x.sub}</span>`);
          return h('button', { type: 'button', class: 'svc' + (inK ? '' : ' srv') + (x.core ? ' core' : '') + (dead ? ' dead' : '') + (crash === 'drv-k' && !(x.id === 'drv') ? ' down' : ''), 'aria-label': (x.core ? 'Explain ' : 'Move ') + x.k, onclick: () => clickSvc(x), html: `<b>${label}</b>${x.core && crash !== 'drv-k' ? st.replace('<span>', '<span><i class="lock">core</i> ') : st}` });
        }
        function app(name) {
          const st = crash === 'drv-k' ? '<span class="st bad-t">✗ stopped</span>' : crash === 'drv-u' ? '<span class="st ok-t">✓ still running</span>' : '<span>application</span>';
          return h('div', { class: 'svc app' + (crash === 'drv-k' ? ' down' : '') , html: `<b>${name}</b>${st}` });
        }
        function paint() {
          userTiles.replaceChildren(app('Text editor'), app('Web browser'), ...SVC.filter((x) => where[x.id] === 'u').map(tileFor));
          kernTiles.replaceChildren(...SVC.filter((x) => where[x.id] === 'k').map(tileFor));
          kernZone.classList.toggle('panic', crash === 'drv-k');
          kernZone.querySelector('.zl-note').textContent = crash === 'drv-k' ? 'kernel panic: everything stops' : `${nIn()} part${nIn() > 1 ? 's' : ''}`;
          userZone.querySelector('.zl-note').textContent = 'click a service to move it';
          const d = design();
          presets.set(d);
          if (d === 'micro') found.add('simple');
          kind.textContent = d === 'mono' ? 'Monolithic kernel' : d === 'micro' ? 'Microkernel' : 'Mixed design';
          kindSub.innerHTML = d === 'mono' ? 'Every service runs in kernel mode inside one program. Direct calls are fast, but all of this code is trusted completely.'
            : d === 'micro' ? 'Only IPC, address spaces and basic scheduling remain in kernel mode. Everything else is an ordinary process that talks by messages.'
            : 'Some services moved out, some stayed in. Many real systems land somewhere in between.';
          meter.firstChild.style.width = (nIn() / SVC.length) * 100 + '%';
          meter.firstChild.style.background = nIn() > 4 ? 'var(--warn)' : 'var(--ok)';
          meterLbl.textContent = `Parts running in kernel mode: ${nIn()} of ${SVC.length}`;
          benefits.replaceChildren(...BEN.map(([id, t, sub]) => h('div', { class: 'ben' + (found.has(id) ? ' on' : '') }, h('span', { class: 'tick' }, found.has(id) ? '✓' : '○'), h('div', { html: `<b>${t}</b> <span class="muted">· ${sub}</span>` }))));
        }
        function say(kind, label, html) {
          if (!kind) { result.innerHTML = '<div class="callout m0" data-label="Try the tests">Pick a design, then run one of the tests. Can you light up all four microkernel benefits?</div>'; return; }
          result.innerHTML = `<div class="callout ${kind} m0 fade-in" data-label="${label}">${html}</div>`;
        }
        function clickSvc(x) {
          if (x.core) { say('warn', x.k + ' must stay in the kernel', x.why + ' A microkernel always keeps its three core functions.'); return; }
          where[x.id] = where[x.id] === 'k' ? 'u' : 'k';
          afterMove();
        }
        function testCrash() {
          if (where.drv === 'k') {
            crash = 'drv-k';
            say('bad', 'Whole system down', 'The buggy driver ran <b>inside the kernel</b>, in the same address space as everything else. It scribbled over kernel memory, the kernel had to halt, and <b>every</b> program stopped. One bad driver, one dead machine.');
          } else {
            crash = 'drv-u'; found.add('iso');
            say('tip', 'Contained', 'The driver was an ordinary process in its own address space, so the bug could only wreck <b>itself</b>. The kernel, the other servers and both applications keep running. <button class="btn sm" type="button" data-act="restart">Restart the driver server</button>');
          }
          paint();
        }
        function testUpgrade() {
          crash = null;
          if (where.fs === 'u') {
            fsVer++; found.add('flex');
            say('tip', 'Upgraded while running', `The old file server was stopped and version ${fsVer} started in its place, like any other program. The kernel was never touched and nothing had to be rebuilt.`);
          } else {
            say('warn', 'Upgrade means kernel surgery', 'The file system is part of the kernel program, so changing it means changing the kernel itself. Any mistake in the new code runs with full privileges, right next to everything else.');
          }
          paint();
        }
        function testRemote() {
          crash = null;
          if (where.fs === 'u') {
            found.add('dist');
            say('tip', 'Works across the network', 'The editor keeps sending exactly the same request <b>message</b>. The message system forwards it to a file server on another computer and brings back the reply. Local or remote, it looks the same to the client.');
          } else {
            say('warn', 'Not without a redesign', 'The file system is kernel code reached by <b>direct calls inside this machine</b>. There is no request message that could be forwarded to another computer.');
          }
          paint();
        }
        ctx.on(result, 'click', (e) => { if (e.target.closest('[data-act="restart"]')) { crash = null; say('tip', 'Back to normal', 'The driver server restarted like any program. Nobody had to reboot the machine.'); paint(); } });
        say(null);
        el.append(h('div', { class: 'split r fill' },
          h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'Start from a preset:'), presets),
            userZone, kernZone,
            h('div', { class: 'hwstrip' }, h('span', { class: 'xs b muted' }, 'HARDWARE'), h('span', { class: 'chip cpu' }, 'Processor'), h('span', { class: 'chip mem' }, 'Memory'), h('span', { class: 'chip io' }, 'Disk'), h('span', { class: 'chip io' }, 'Network card')),
            h('p', { class: 'small muted m0', html: 'Click any service to move it between the two spaces. The three <b>core</b> parts never leave the kernel; click one to find out why.' }),
            h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Code in kernel mode is trusted completely: a bug anywhere in it can damage anything. Every service moved out to user mode shrinks the part that must be perfect.' })),
          h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'card tight stack', style: { gap: '4px' } }, h('div', { class: 'xs muted b' }, 'YOUR DESIGN'), kind, kindSub, meter, meterLbl),
            h('div', { class: 'row gap-s' },
              h('button', { class: 'btn sm intr', type: 'button', onclick: testCrash }, 'Crash the drivers'),
              h('button', { class: 'btn sm os', type: 'button', onclick: testUpgrade }, 'Upgrade the file system'),
              h('button', { class: 'btn sm io', type: 'button', onclick: testRemote }, 'Use a remote file server')),
            result, benefits)));
        paint();
      },
    },
    /* ---------------- 4. Threads vs processes: anatomy + what a switch costs ---------------- */
    {
      title: 'Inside a process: threads share, each keeps its own',
      kind: 'explore',
      render(el, ctx) {
        const { h } = ctx;
        const TA = [
          { pc: '0x1040', sp: '0x7FF0', depth: 0.35 }, { pc: '0x1A48', sp: '0x6FF0', depth: 0.6 },
          { pc: '0x22C0', sp: '0x5FF0', depth: 0.2 }, { pc: '0x1A10', sp: '0x4FF0', depth: 0.5 },
        ];
        const TB = { pc: '0x0400', sp: '0x3FF0', depth: 0.45 };
        if (ctx.narrow) el.classList.add('nrw');
        const RES = [
          ['Code', 'The program\'s instructions. Every thread runs code from this one copy, often different parts of it at the same moment.'],
          ['Data', 'Global variables and the heap. Any thread can read and change them, which makes sharing easy (and, as Chapter 5 shows, risky).'],
          ['Open files', 'A file opened by one thread is open for all its sibling threads: they share one table of open files.'],
          ['Devices', 'I/O devices and connections the OS has given to the process, such as a network connection to a client.'],
        ];
        let n = 3, cur = { p: 'A', t: 0 }, last = null;
        const aThreads = h('div', { class: 'thr-row' });
        const bThread = h('div', { class: 'thr-row one' });
        const cpu = h('div', { class: 'cpu-box' });
        const chk = h('div', { class: 'chk' });
        const info = h('div', { class: 'info-line small' });
        const CHK = ['Save the old thread\'s registers (PC, SP, …)', 'Load the new thread\'s registers and stack pointer', 'Switch the memory map to another address space', 'Cold start: cached translations and data no longer help'];
        const ctxOf = (c) => (c.p === 'A' ? TA[c.t] : TB);
        function thrCard(p, i, t) {
          const run = cur.p === p && cur.t === i;
          return h('button', { type: 'button', class: 'thr' + (run ? ' run' : ''), 'aria-label': `Run process ${p} thread ${i + 1}`, onclick: () => dispatch({ p, t: i }) },
            h('b', {}, 'Thread ' + (i + 1)),
            h('span', { class: 'chip ' + (run ? 'ok' : ''), style: { alignSelf: 'flex-start' } }, run ? 'running' : 'ready'),
            h('div', { class: 'xs mono' }, 'PC ' + t.pc), h('div', { class: 'xs mono' }, 'SP ' + t.sp),
            h('div', { class: 'stk' }, h('span', { class: 'xs' }, 'stack'), h('div', { class: 'meter' }, h('i', { style: { width: t.depth * 100 + '%' } }))));
        }
        function paint() {
          aThreads.replaceChildren(...TA.slice(0, n).map((t, i) => thrCard('A', i, t)));
          bThread.replaceChildren(thrCard('B', 0, TB));
          const c = ctxOf(cur);
          cpu.innerHTML = `<div class="xs b" style="color:var(--cpu);letter-spacing:.08em">PROCESSOR</div><div class="b">Running: process ${cur.p} · thread ${cur.t + 1}</div><div class="mono small">PC ${c.pc} · SP ${c.sp}</div><div class="xs muted">memory map: process ${cur.p}'s address space</div>`;
          const need = last == null ? null : last === 'thread' ? 2 : 4;
          chk.innerHTML = `<div class="xs b muted" style="letter-spacing:.06em">${need == null ? 'WHAT A SWITCH COSTS' : last === 'thread' ? 'THREAD SWITCH: ' + need + ' OF 4 COSTS' : 'PROCESS SWITCH: ALL ' + need + ' COSTS'}</div>` +
            CHK.map((txt, i) => { const st = need == null ? 'idle' : i < need ? 'done' : 'skip'; return `<div class="ci ${st}"><span>${st === 'done' ? '✓' : st === 'skip' ? '–' : '○'}</span>${txt}</div>`; }).join('');
        }
        function dispatch(to) {
          if (to.p === cur.p && to.t === cur.t) { info.innerHTML = 'That thread is already running. Click a different thread to switch the processor to it.'; return; }
          const same = to.p === cur.p;
          const from = cur; cur = to; last = same ? 'thread' : 'process';
          info.innerHTML = same
            ? `<b style="color:var(--thread)"><span class="t">Thread switch</span></b> inside process ${to.p}: save thread ${from.t + 1}'s registers, load thread ${to.t + 1}'s. Code, data, open files and the memory map stay put, so there is little to do.`
            : `<b style="color:var(--proc)"><span class="t">Process switch</span></b> from ${from.p} to ${to.p}: besides the registers, the OS must switch to ${to.p}'s <span class="t">address space</span>, and the processor's cached address translations and data, built up for ${from.p}, no longer help. Much more work.`;
          paint();
        }
        const seg = ctx.ui.seg([1, 2, 3, 4].map((v) => ({ value: v, label: v + (v === 1 ? ' thread' : '') })), n, (v) => {
          n = v; if (cur.p === 'A' && cur.t >= n) cur = { p: 'A', t: 0 }; last = null;
          info.innerHTML = n === 1 ? 'With one thread the process can only do one thing at a time: this is the classic <b>single-threaded</b> process.' : `Process A now has <b>${n} threads</b>. Each has its own context and stack; all of them share the resources above.`;
          paint();
        });
        const resBtns = RES.map(([name, d]) => h('button', { type: 'button', class: 'res', onclick: () => { info.innerHTML = `<b style="color:var(--proc)">${name}</b> (shared): ${d}`; } }, name));
        info.innerHTML = 'Each thread keeps its own <b>processor context</b> and <b>stack</b>. Everything in the shaded area is shared. Click a resource to learn more, or click another thread to switch the processor to it.';
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack', style: { gap: '9px' } },
            h('p', { class: 'lead m0', html: 'A <span class="t">process</span> once had one thread, so it did one thing at a time. <span class="t">Multithreading</span> divides a process into several threads that can run concurrently.' }),
            h('div', { class: 'card thread tight', html: '<b><span class="t">Thread</span></b> = a <b>dispatchable unit of work</b>: what the scheduler actually picks to run. It has its own <b>processor context</b> (program counter, stack pointer, other registers) and its own <b>data area for a stack</b>. It runs its instructions one after another and is <b>interruptible</b>, so the processor can turn to another thread.' }),
            h('div', { class: 'card proc tight', html: '<b>Process</b> = a collection of <b>one or more threads</b> plus the <b>system resources</b> they share: memory holding code and data, open files and devices.' }),
            h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'Threads of one process share memory, so switching between them is cheap and they can cooperate through shared data. That pays off when an application has <b>independent tasks</b> that need not wait for each other.' })),
          h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'Threads in process A:'), seg),
            h('div', { class: 'pgrid' },
              h('div', { class: 'pbox' },
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, 'Process A · database server'), h('span', { class: 'xs muted' }, 'one address space')),
                h('div', { class: 'shared' }, h('div', { class: 'xs b', style: { color: 'var(--proc)', letterSpacing: '.06em' } }, 'SHARED BY ALL ITS THREADS'), h('div', { class: 'res-grid' }, ...resBtns)),
                aThreads),
              h('div', { class: 'pbox' },
                h('div', {}, h('b', {}, 'Process B'), h('div', { class: 'xs muted' }, 'web browser')),
                h('div', { class: 'shared' }, h('div', { class: 'xs', style: { lineHeight: 1.3 } }, 'its own code, data, files, devices')),
                bThread)),
            h('div', { class: 'grid-2', style: { gap: '8px', gridTemplateColumns: '2fr 3fr' } }, cpu, chk),
            info)));
        paint();
      },
    },
    /* ---------------- 5. Lab: a database server with one thread, a process per request, or a thread per request ---------------- */
    {
      title: 'Lab: a database server under load',
      kind: 'lab',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h, s } = ctx;
        const C1 = 2, W = 12, C2 = 2;                       // per request: work, disk wait, work (time units)
        const COST = { single: { create: 0, sw: 0 }, procs: { create: 5, sw: 2 }, threads: { create: 1, sw: 1 } };
        // deterministic one-CPU simulation; returns CPU segments, per-request segments and finish times
        function simServer(design) {
          const c = COST[design];
          const R = ['A', 'B', 'C', 'D'].map((id) => ({ id, phase: 0, readyAt: 0, started: false, done: null, segs: [] }));
          const cpu = [];
          const push = (arr, type, t0, t1, id) => { if (t1 > t0) arr.push({ type, t0, t1, id }); };
          let t = 0;
          if (design === 'single') {
            for (const r of R) {
              push(r.segs, 'queued', 0, t);
              push(r.segs, 'run', t, t + C1); push(cpu, 'run', t, t + C1, r.id); t += C1;
              push(r.segs, 'io', t, t + W); push(cpu, 'idle', t, t + W); t += W;
              push(r.segs, 'run', t, t + C2); push(cpu, 'run', t, t + C2, r.id); t += C2;
              r.done = t;
            }
          } else {
            let queue = R.slice();
            while (R.some((r) => r.done == null)) {
              queue.sort((a, b) => a.readyAt - b.readyAt || a.id.localeCompare(b.id));
              const r = queue.find((q) => q.readyAt <= t);
              if (!r) { const nt = Math.min(...queue.map((q) => q.readyAt)); push(cpu, 'idle', t, nt); t = nt; continue; }
              queue = queue.filter((q) => q !== r);
              push(r.segs, 'queued', r.readyAt, t);
              const ov = r.started ? c.sw : c.create;
              push(r.segs, 'ovh', t, t + ov); push(cpu, 'ovh', t, t + ov, r.id); t += ov;
              const burst = r.phase === 0 ? C1 : C2;
              push(r.segs, 'run', t, t + burst); push(cpu, 'run', t, t + burst, r.id); t += burst;
              r.started = true;
              if (r.phase === 0) { r.phase = 1; push(r.segs, 'io', t, t + W); r.readyAt = t + W; queue.push(r); } else r.done = t;
            }
          }
          const sum = (type) => cpu.filter((x) => x.type === type).reduce((a, x) => a + x.t1 - x.t0, 0);
          return { R, cpu, end: t, avg: R.reduce((a, r) => a + r.done, 0) / R.length, busy: sum('run'), ovh: sum('ovh') };
        }
        const SIM = { single: simServer('single'), procs: simServer('procs'), threads: simServer('threads') };
        const TMAX = 64, X0 = 74, X1 = 596, px = (u) => X0 + (u / TMAX) * (X1 - X0);
        const ROWY = { CPU: 32, A: 94, B: 136, C: 178, D: 220 }, RH = 30;
        const CLS = { run: 's-proc', ovh: 's-warn', io: 's-io', queued: 's-panel', idle: null };
        const svg = s('svg', { viewBox: '0 0 640 280', width: '100%', role: 'img', 'aria-label': 'Server timeline' });
        const stats = h('div', { class: 'stack', style: { gap: '6px' } });
        const cap = h('div', { class: 'info-line small', style: { borderLeftColor: 'var(--thread)' } });
        let design = 'single';
        function seg(x, yKey, cls) {
          const y = ROWY[yKey] + (yKey === 'CPU' ? -2 : 0), hh = yKey === 'CPU' ? RH + 2 : RH;
          const w = px(x.t1) - px(x.t0);
          const g = [s('rect', { x: px(x.t0) + 0.5, y, width: Math.max(1, w - 1), height: hh, rx: 4, class: cls, 'stroke-width': 1.3, 'stroke-dasharray': x.type === 'queued' ? '3 3' : null, style: x.type === 'ovh' ? 'fill:var(--warn)' : null })];
          if (x.type === 'run' && yKey === 'CPU' && w >= 14) g.push(s('text', { x: px(x.t0) + w / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, x.id));
          if (x.type === 'io' && w >= 60) g.push(s('text', { x: px(x.t0) + w / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': 12.5, style: 'fill:var(--io)', 'font-weight': 700 }, 'disk'));
          return g;
        }
        function draw() {
          const S = SIM[design];
          const k = [];
          for (let u = 0; u <= TMAX; u += 8) {
            k.push(s('line', { x1: px(u), y1: 14, x2: px(u), y2: 256, class: 's-muted', 'stroke-width': 1, opacity: 0.6 }));
            k.push(s('text', { x: px(u), y: 273, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(u)));
          }
          k.push(s('text', { x: 8, y: ROWY.CPU + 20, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'CPU'));
          k.push(s('line', { x1: 8, y1: 76, x2: 632, y2: 76, class: 's-muted', 'stroke-width': 1 }));
          S.cpu.forEach((x) => { if (x.type !== 'idle') k.push(...seg(x, 'CPU', CLS[x.type])); });
          S.cpu.filter((x) => x.type === 'idle' && px(x.t1) - px(x.t0) > 40).forEach((x) => k.push(s('text', { x: (px(x.t0) + px(x.t1)) / 2, y: ROWY.CPU + 19, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'idle')));
          S.R.forEach((r) => {
            k.push(s('text', { x: 8, y: ROWY[r.id] + 20, 'font-size': 13.5, 'font-weight': 700 }, 'Req ' + r.id));
            r.segs.forEach((x) => k.push(...seg(x, r.id, CLS[x.type])));
            k.push(s('text', { x: px(r.done) + 5, y: ROWY[r.id] + 20, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--ok)' }, '✓' + r.done));
          });
          svg.replaceChildren(...k);
          const pct = Math.round((S.busy / S.end) * 100);
          stats.innerHTML = `
            <div class="kpis">
              <div><div class="xs muted b">ALL FOUR DONE AT</div><div class="big">${S.end}</div></div>
              <div><div class="xs muted b">AVERAGE RESPONSE</div><div class="big">${ctx.util.fmt(S.avg, 1)}</div></div>
            </div>
            <div class="small">CPU doing useful work: <b>${S.busy} of ${S.end}</b> units (${pct}%)</div>
            <div class="meter"><i style="width:${pct}%;background:var(--proc)"></i></div>
            <div class="small">CPU spent creating and switching: <b style="color:var(--warn)">${S.ovh} units</b></div>`;
          const f = SIM.single, p = SIM.procs, t = SIM.threads;
          cap.innerHTML = design === 'single'
            ? `<b>One thread does everything.</b> While request A waits ${W} units for the disk, the whole server waits too: the CPU is idle and B, C and D stand in line. Everything is done only at ${f.end}.`
            : design === 'procs'
              ? `<b>One process per request.</b> While A waits for the disk, B can run, so the waits overlap and all four are done at ${p.end}. But creating a process (${COST.procs.create} units) and switching address spaces (${COST.procs.sw} units) cost <b>${p.ovh} units</b> of pure overhead.`
              : `<b>One thread per request, all in one process.</b> The waits overlap just as with processes, but creating a thread (${COST.threads.create} unit) and switching threads (${COST.threads.sw} unit) is cheap, so everything is done at ${t.end}, with only ${t.ovh} units of overhead. Busy servers go further: they create a <b>pool of threads</b> once, at start-up, and hand each new request to an idle thread.`;
        }
        const segCtl = ctx.ui.seg([{ value: 'single', label: 'Single-threaded' }, { value: 'procs', label: 'Process per request' }, { value: 'threads', label: 'Thread per request' }], design, (v) => { design = v; draw(); });
        if (!ctx.narrow) segCtl.style.flex = 'none';
        el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },
          h('div', { class: 'row' + (ctx.narrow ? '' : ' nw'), style: { justifyContent: 'space-between', gap: '16px' } },
            h('p', { class: 'small m0', html: 'Four clients send a request to a database server at the same moment. Each request needs <b>2 units</b> of processing, then <b>waits 12 units</b> for the disk, then <b>2 more units</b> to build the reply. One CPU. Pick a server design:' }),
            segCtl),
          h('div', { class: 'split r grow', style: { height: 'auto' } },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'card white tight', style: { padding: '6px 8px' } }, svg,
                h('div', { class: 'row gap-s xs', style: { marginTop: '2px' } },
                  h('span', { class: 'lg' }, h('i', { class: 'sw run' }), 'running'), h('span', { class: 'lg' }, h('i', { class: 'sw ovh' }), 'creating / switching'),
                  h('span', { class: 'lg' }, h('i', { class: 'sw io' }), 'waiting for disk'), h('span', { class: 'lg' }, h('i', { class: 'sw q' }), 'waiting for the CPU'), h('span', { class: 'muted' }, 'time in made-up units'))),
              cap,
              // one-line reminder so this lab also makes sense on the core path, which skips the step that defines threads
              h('p', { class: 'small muted m0', html: '<b>Recall:</b> a <span class="t">thread</span> is a unit of work, inside a process, that the scheduler runs.' })),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'card tight' }, stats),
              h('table', { class: 'tbl compact', html: `<tr><th></th><th>Thread</th><th>Process</th></tr>
                <tr><td>Create one</td><td class="b" style="color:var(--ok)">${COST.threads.create} unit</td><td class="b" style="color:var(--warn)">${COST.procs.create} units</td></tr>
                <tr><td>Switch to it</td><td class="b" style="color:var(--ok)">${COST.threads.sw} unit</td><td class="b" style="color:var(--warn)">${COST.procs.sw} units</td></tr>
                <tr><td>Share the server's data</td><td>directly: same memory</td><td>needs IPC or shared memory</td></tr>
                <tr><td>One crashes</td><td>can take down the whole server</td><td>only that process dies</td></tr>` }),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"Threads only help when there are several processors." Not so: this server has <b>one CPU</b>, yet threads win, because one request computes while the others wait for the disk.' })))));
        draw();
      },
    },
    /* ---------------- 6. SMP: multiprogramming vs multiprocessing timeline + the four advantages ---------------- */
    {
      title: 'SMP: several processors, one operating system',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        const BURSTS = [[4, 4, 3], [3, 5, 2], [5, 3, 2]];   // P1..P3: run, wait for I/O, run (time units)
        const FAIL_T = 5;
        // tick-by-tick simulation: first-come first-served ready queue, a process keeps its processor until it blocks or ends
        function simSMP(nCpu, fail) {
          const P = BURSTS.map((b, i) => ({ i, b, ph: 0, left: b[0], st: 'ready', done: null, row: [] }));
          const cpus = Array.from({ length: nCpu }, (_, k) => ({ k, cur: null, alive: true, row: [] }));
          const ready = [0, 1, 2];
          let t = 0, lost = null;
          for (; t < 60; t++) {
            if (fail && t === FAIL_T && cpus[1] && cpus[1].alive) {
              cpus[1].alive = false;
              if (cpus[1].cur != null) { lost = 'P' + (cpus[1].cur + 1); P[cpus[1].cur].st = 'ready'; ready.push(cpus[1].cur); cpus[1].cur = null; }
            }
            for (const c of cpus) if (c.alive && c.cur == null && ready.length) { c.cur = ready.shift(); P[c.cur].st = 'run'; }
            if (P.every((p) => p.st === 'done')) break;
            P.forEach((p) => { const c = cpus.find((q) => q.cur === p.i); p.row.push(p.st === 'run' ? 'C' + (c.k + 1) : p.st); });
            cpus.forEach((c) => c.row.push(!c.alive ? 'dead' : c.cur == null ? 'idle' : 'P' + (c.cur + 1)));
            const fin = [];
            P.forEach((p) => { if (p.st === 'run' || p.st === 'io') { p.left--; if (p.left === 0) fin.push(p); } });
            fin.sort((a, b) => a.i - b.i).forEach((p) => {
              if (p.st === 'run') cpus.find((q) => q.cur === p.i).cur = null;
              p.ph++;
              if (p.ph >= p.b.length) { p.st = 'done'; p.done = t + 1; }
              else if (p.ph % 2 === 1) { p.st = 'io'; p.left = p.b[p.ph]; }
              else { p.st = 'ready'; p.left = p.b[p.ph]; ready.push(p.i); }
            });
          }
          const busy = cpus.reduce((a, c) => a + c.row.filter((x) => x[0] === 'P').length, 0);
          const avail = cpus.reduce((a, c) => a + c.row.filter((x) => x !== 'dead').length, 0);
          return { P, cpus, end: t, busy, lost, util: busy / Math.max(1, avail) };
        }
        const runs = (row) => { const out = []; row.forEach((v, t) => { const l = out[out.length - 1]; if (l && l.v === v) l.t1 = t + 1; else out.push({ v, t0: t, t1: t + 1 }); }); return out; };
        let n = 1, fail = false, adv = null;
        const TMAX = 20, X0 = 76, X1 = 604, px = (u) => X0 + (u / TMAX) * (X1 - X0);
        const svg = s('svg', { viewBox: '0 0 640 268', width: '100%', role: 'img', 'aria-label': 'Processor timeline' });
        const modeLbl = h('div', { class: 'mode-lbl' });
        const resultLn = h('div', { class: 'row gap-s' });
        const info = h('div', { class: 'info-line small', style: { borderLeftColor: 'var(--cpu)', minHeight: '84px' } });
        function draw() {
          const R = simSMP(n, fail), base = simSMP(1, false);
          const k = [];
          for (let u = 0; u <= TMAX; u += 2) {
            k.push(s('line', { x1: px(u), y1: 8, x2: px(u), y2: 244, class: 's-muted', 'stroke-width': 1, opacity: 0.55 }));
            k.push(s('text', { x: px(u), y: 261, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(u)));
          }
          const PY = [12, 46, 80], CY = [140, 174, 208], H = 28;
          R.P.forEach((p, i) => {
            k.push(s('text', { x: 8, y: PY[i] + 19, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'P' + (i + 1)));
            runs(p.row).forEach((r) => {
              if (r.v === 'done') return;
              const x = px(r.t0) + 0.5, w = px(r.t1) - px(r.t0) - 1;
              const run = r.v[0] === 'C';
              k.push(s('rect', { x, y: PY[i], width: w, height: H, rx: 5, class: run ? 's-cpu' : r.v === 'io' ? 's-io' : 's-panel', 'stroke-width': 1.4, 'stroke-dasharray': r.v === 'ready' ? '3 3' : null }));
              const lbl = run ? (w > 70 ? 'on CPU ' + r.v[1] : w > 44 ? 'CPU ' + r.v[1] : 'C' + r.v[1]) : r.v === 'io' && w > 60 ? 'I/O wait' : '';
              if (lbl) k.push(s('text', { x: x + w / 2, y: PY[i] + 19, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: run ? 'fill:var(--cpu)' : 'fill:var(--io)' }, lbl));
            });
            k.push(s('text', { x: px(p.done) + 5, y: PY[i] + 19, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--ok)' }, '✓' + p.done));
          });
          k.push(s('line', { x1: 8, y1: 125, x2: 632, y2: 125, class: 's-muted', 'stroke-width': 1 }));
          [0, 1, 2].forEach((ci) => {
            k.push(s('text', { x: 8, y: CY[ci] + 19, 'font-size': 14, 'font-weight': 800, style: ci < n ? 'fill:var(--cpu)' : '', class: ci < n ? '' : 's-sub' }, 'CPU ' + (ci + 1)));
            if (ci >= n) {
              k.push(s('rect', { x: X0, y: CY[ci], width: X1 - X0, height: H, rx: 5, class: 's-muted', 'stroke-dasharray': '5 5', 'stroke-width': 1.2 }));
              k.push(s('text', { x: (X0 + X1) / 2, y: CY[ci] + 19, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'empty slot: no processor installed'));
              return;
            }
            runs(R.cpus[ci].row).forEach((r) => {
              const x = px(r.t0) + 0.5, w = px(r.t1) - px(r.t0) - 1;
              if (r.v === 'idle') { if (w > 50) k.push(s('text', { x: x + w / 2, y: CY[ci] + 19, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'idle')); return; }
              const dead = r.v === 'dead';
              k.push(s('rect', { x, y: CY[ci], width: w, height: H, rx: 5, class: dead ? 's-bad' : 's-proc', 'stroke-width': 1.4 }));
              k.push(s('text', { x: x + w / 2, y: CY[ci] + 19, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: dead ? 'fill:var(--bad)' : 'fill:var(--proc)' }, dead ? (w > 120 ? '✗ failed at t = ' + FAIL_T : '✗') : r.v));
            });
          });
          svg.replaceChildren(...k);
          const overlap = n > 1;
          modeLbl.innerHTML = overlap
            ? '<span class="chip cpu">Multiprocessing</span><span>interleaving <b>and</b> overlapping: bars in different rows run at the same instant</span>'
            : '<span class="chip proc">Multiprogramming</span><span>interleaving only: at any instant just one process is running</span>';
          const sp = base.end / R.end;
          resultLn.innerHTML = `<span class="chip ok">all done at t = ${R.end}</span><span class="chip">processors busy ${Math.round(R.util * 100)}% of the time</span><span class="chip accent">${n === 1 && !fail ? 'baseline' : 'speed-up ×' + ctx.util.fmt(sp, 2) + ' vs 1 CPU'}</span>`;
          failBtn.disabled = n === 1;
          failBtn.classList.toggle('on', fail && n > 1);
          advBtns.forEach((b) => b.classList.toggle('on', b.dataset.adv === adv));
          info.innerHTML = explain(R, base);
        }
        function explain(R, base) {
          const two = simSMP(2, false), three = simSMP(3, false);
          if (adv === 'perf') return `<b>Performance.</b> When work can run in parallel, several processors finish it sooner. The same three processes finish at <b>${two.end}</b> on two processors instead of <b>${base.end}</b> on one.`;
          if (adv === 'avail') return `<b>Availability.</b> Every processor can do every job, so losing one does not stop the machine. CPU 2 fails at t = ${FAIL_T} while running ${R.lost}; in this idealized model the OS rescues ${R.lost}, puts it back in the ready queue, and CPU 1 carries on. Done at <b>${R.end}</b> instead of ${two.end}: slower, but still working.`;
          if (adv === 'grow') return `<b><span class="t">Incremental growth</span>.</b> Need more speed? Add a processor instead of buying a new computer. A third processor moves the finish time from <b>${two.end}</b> to <b>${three.end}</b>.`;
          if (adv === 'scale') return `<b><span class="t">Scaling</span>.</b> A vendor can sell a family of machines with 1, 2 or 3 processors at different prices, all running the same software: finish times <b>${base.end}</b>, <b>${two.end}</b>, <b>${three.end}</b>. Notice the gains shrink: three processes that often wait for I/O cannot keep many processors busy.`;
          if (n === 1) return `With <b>one processor</b> the OS keeps the processor busy by switching to another process whenever one waits for I/O. The three processes <b>take turns</b>, and everything is done at <b>${R.end}</b>. Now try 2 processors.`;
          if (fail) return R.lost
            ? `CPU 2 fails at t = ${FAIL_T} while running ${R.lost}. In this idealized model the OS rescues ${R.lost} and puts it back in the ready queue, and the remaining processor${n > 2 ? 's pick' : ' picks'} it up. Everything is done at <b>${R.end}</b>: slower, but the machine keeps working.`
            : `CPU 2 fails at t = ${FAIL_T} while it happens to be idle, so no running work is lost; the other processors share what is left. Everything is done at <b>${R.end}</b>.`;
          return `With <b>${n} processors</b> the OS runs different processes (or different threads of one process) at the same instant, so the bars in different rows <b>overlap</b>. Everything is done at <b>${R.end}</b> instead of ${base.end}.`;
        }
        const segN = ctx.ui.seg([{ value: 1, label: '1 CPU' }, { value: 2, label: '2 CPUs' }, { value: 3, label: '3 CPUs' }], n, (v) => { n = v; if (n === 1) fail = false; adv = null; draw(); });
        const failBtn = h('button', { class: 'btn sm intr', type: 'button', onclick: () => { fail = !fail; adv = null; draw(); } }, 'Fail CPU 2 at t = ' + FAIL_T);
        const ADV = [['perf', 'Performance', 2, false], ['avail', 'Availability', 2, true], ['grow', 'Incremental growth', 3, false], ['scale', 'Scaling', 3, false]];
        const advBtns = ADV.map(([id, label, nn, ff]) => h('button', { class: 'btn sm', type: 'button', 'data-adv': id, onclick: () => { adv = id; n = nn; fail = ff; segN.set(n); draw(); } }, label));
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack', style: { gap: '8px' } },
            h('p', { class: 'm0', style: { fontSize: '17.5px', lineHeight: '1.45' }, html: '<span class="t">Symmetric multiprocessing (SMP)</span> names both a kind of hardware (section 1.8) and the OS behaviour that makes use of it. An SMP computer has:' }),
            h('ul', { class: 'small m0 tight-list', html: '<li><b>two or more similar processors</b> of comparable power,</li><li><b>sharing main memory and I/O</b> over a bus or other link, each reaching memory about equally fast,</li><li>each able to <b>do every job</b>, even run the OS (hence <i>symmetric</i>),</li><li>under <b>one integrated OS</b> that schedules work on all of them.</li>' }),
            h('div', { class: 'xs b muted', style: { letterSpacing: '.07em', marginTop: '2px' } }, 'FOUR POTENTIAL ADVANTAGES: CLICK ONE'),
            h('div', { class: 'grid-2', style: { gap: '6px' } }, ...advBtns),
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'These are <b>potential</b> advantages, not guarantees. They appear only if there is parallel work to do and the OS actually spreads it across the processors.' }),
            h('div', { class: 'card tight small', style: { lineHeight: '1.4' }, html: '<b style="color:var(--proc)"><span class="t">Multiprogramming</span></b> (one processor): processes are <b>interleaved</b>, so they only <i>seem</i> to run together. <b style="color:var(--cpu)"><span class="t">Multiprocessing</span></b> (several processors): they are interleaved <b>and overlapped</b>, truly running at the same instant.' })),
          h('div', { class: 'stack', style: { gap: '7px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, segN, failBtn),
            modeLbl,
            h('div', { class: 'card white tight', style: { padding: '6px 8px' } }, svg,
              h('div', { class: 'row gap-s xs' },
                h('span', { class: 'lg' }, h('i', { class: 'sw cpu' }), 'running on a processor'), h('span', { class: 'lg' }, h('i', { class: 'sw io' }), 'waiting for I/O'),
                h('span', { class: 'lg' }, h('i', { class: 'sw q' }), 'ready, waiting for a processor'), h('span', { class: 'lg' }, h('i', { class: 'sw run' }), 'process on this CPU'))),
            resultLn, info)));
        draw();
      },
    },
    /* ---------------- 7. Distributed OS + object-oriented design ---------------- */
    {
      title: 'Beyond one box: distributed OSs and object design',
      kind: 'learn',
      render(el, ctx) {
        const { h, s } = ctx;
        /* ---- left: a cluster with and without a distributed OS ---- */
        const FILES = [{ f: 'photos/', node: 0 }, { f: 'orders.db', node: 1 }, { f: 'logs/', node: 2 }];
        let unified = false, pickF = 1;
        const NX = [14, 186, 358], NW = 150;
        const svg = s('svg', { viewBox: '0 0 522 192', width: '100%', role: 'img', 'aria-label': 'A cluster of three computers' });
        const files = h('div', { class: 'row gap-s' });
        const dInfo = h('div', { class: 'info-line small', style: { borderLeftColor: 'var(--io)', minHeight: '62px' } });
        function drawCluster() {
          const k = [s('rect', { x: 206, y: 2, width: 110, height: 30, rx: 9, class: 's-proc', 'stroke-width': 2 }), s('text', { x: 261, y: 22, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'You')];
          if (unified) {
            k.push(s('rect', { x: 4, y: 50, width: 514, height: 112, rx: 14, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '7 5', opacity: 0.9 }));
            k.push(s('text', { x: 261, y: 67, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--accent)' }, 'ONE SYSTEM: one memory space · one file space'));
            k.push(s('line', { x1: 261, y1: 32, x2: 261, y2: 48, class: 's-line', 'marker-end': 'url(#arr)' }));
          } else {
            NX.forEach((x) => k.push(s('line', { x1: 261, y1: 32, x2: x + NW / 2, y2: 72, class: 's-line', 'stroke-dasharray': '4 3', 'marker-end': 'url(#arr)' })));
            k.push(s('text', { x: 92, y: 46, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'three logins'), s('text', { x: 430, y: 46, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'three file trees'));
          }
          NX.forEach((x, i) => {
            const hit = FILES[pickF].node === i;
            k.push(s('rect', { x, y: 74, width: NW, height: 82, rx: 10, class: 's-panel', 'stroke-width': 1.5 }));
            k.push(s('text', { x: x + 10, y: 91, 'font-size': 13, 'font-weight': 800 }, 'Node ' + (i + 1)));
            k.push(s('rect', { x: x + 10, y: 99, width: 56, height: 48, rx: 6, class: 's-mem', 'stroke-width': 1.3 }), s('text', { x: x + 38, y: 128, 'text-anchor': 'middle', 'font-size': 12.5, style: 'fill:var(--mem)', 'font-weight': 700 }, 'memory'));
            k.push(s('rect', { x: x + 74, y: 99, width: 66, height: 48, rx: 6, class: 's-io', 'stroke-width': hit ? 3.5 : 1.3 }), s('text', { x: x + 107, y: 119, 'text-anchor': 'middle', 'font-size': 12.5, style: 'fill:var(--io)', 'font-weight': 700 }, 'disk'), s('text', { x: x + 107, y: 137, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': hit ? 800 : 500, class: 's-monot' }, FILES.find((f) => f.node === i).f));
          });
          k.push(s('line', { x1: 40, y1: 172, x2: 482, y2: 172, class: 's-line', 'stroke-width': 3 }), s('text', { x: 261, y: 188, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, 'fast network'));
          NX.forEach((x) => k.push(s('line', { x1: x + NW / 2, y1: 156, x2: x + NW / 2, y2: 172, class: 's-line', 'stroke-width': 2 })));
          svg.replaceChildren(...k);
          files.replaceChildren(h('span', { class: 'xs b muted' }, unified ? 'ONE TREE:' : 'FILES:'), ...FILES.map((f, i) => h('button', { type: 'button', class: 'btn sm mono' + (i === pickF ? ' on' : ''), onclick: () => { pickF = i; drawCluster(); } }, unified ? '/' + f.f : 'node' + (f.node + 1) + ':/' + f.f)));
          const f = FILES[pickF];
          dInfo.innerHTML = unified
            ? `You open <code>/${f.f}</code> like a local file; the OS fetches it from <b>node ${f.node + 1}'s disk</b>. Programs likewise see one memory spanning all nodes.`
            : `You must know <code>${f.f}</code> is on <b>node ${f.node + 1}</b>, log in there and use its file tree; a program sees only its own node's memory.`;
        }
        const dSeg = ctx.ui.seg([{ value: false, label: 'Without a distributed OS' }, { value: true, label: 'With a distributed OS' }], unified, (v) => { unified = v; drawCluster(); });
        dSeg.style.alignSelf = 'flex-start';
        /* ---- right: object-oriented extension of a small kernel ---- */
        const SLOTS = [
          { id: 'fs', iface: 'File system', ops: 'open · read · write' },
          { id: 'net', iface: 'Network protocol', ops: 'send · receive' },
          { id: 'dev', iface: 'Device', ops: 'start · stop' },
        ];
        const OBJS = [
          { id: 'local', slot: 'fs', name: 'Local file system', why: 'Stores files on this machine\'s disk. It offers exactly the <b>open · read · write</b> interface, so every program can use it.' },
          { id: 'remote', slot: 'fs', name: 'Remote file system', why: 'Same interface, but each call is forwarded to a file server on another machine. Programs cannot tell the difference, which is how objects <b>ease building distributed tools</b>.' },
          { id: 'proto', slot: 'net', name: 'New network protocol', why: 'A new protocol object plugs into the <b>send · receive</b> interface. The kernel core is not edited, so it cannot be broken by the change.' },
          { id: 'drv', slot: 'dev', name: 'New device driver', why: 'Support for new hardware arrives as one more object behind the <b>start · stop</b> interface: the OS is <b>customized without disrupting its integrity</b>.' },
        ];
        const plugged = { fs: null, net: null, dev: null };
        let changed = null;   // the slot that just received an object (only it animates)
        const slotsEl = h('div', { class: 'slots' });
        const oInfo = h('div', { class: 'info-line small', style: { borderLeftColor: 'var(--os)', minHeight: '62px' } });
        const status = h('div', { class: 'row gap-s' });
        function drawObjs() {
          slotsEl.replaceChildren(...SLOTS.map((sl) => {
            const o = OBJS.find((x) => x.id === plugged[sl.id]);
            return h('div', { class: 'slot' + (o ? ' full' : '') },
              h('div', { class: 'iface' }, h('b', {}, sl.iface), h('span', { class: 'xs mono' }, sl.ops)),
              h('div', { class: 'obj' + (o && changed === sl.id ? ' fade-in' : '') }, o ? o.name : 'empty socket'));
          }));
          const nPl = Object.values(plugged).filter(Boolean).length;
          status.innerHTML = `<span class="chip os">objects plugged in: ${nPl}</span><span class="chip ok">kernel core changed: no ✓</span>`;
          objBtns.forEach((b) => b.classList.toggle('on', plugged[OBJS.find((o) => o.id === b.dataset.o).slot] === b.dataset.o));
        }
        const objBtns = OBJS.map((o) => h('button', { type: 'button', class: 'btn sm os', 'data-o': o.id, onclick: () => { plugged[o.slot] = o.id; changed = o.slot; oInfo.innerHTML = `<b>${o.name}</b>: ${o.why}`; drawObjs(); } }, '+ ' + o.name));
        oInfo.innerHTML = 'Plug objects into the small kernel. Each one must fit an <b>interface</b>: a fixed list of operations the rest of the system is allowed to call.';
        el.append(h('div', { class: 'split fill' },
          h('div', { class: 'card white stack', style: { gap: '7px' } },
            h('h3', { class: 'm0', html: '<span class="t">Distributed operating system</span>' }),
            h('p', { class: 'small m0', html: 'A <span class="t">cluster</span> is a group of complete computers on a fast network working together. A distributed OS gives the <b>illusion of one machine</b>: one main memory, one secondary-memory space, and unified services such as a <span class="t">distributed file system</span>.' }),
            dSeg, h('div', {}, svg), files, dInfo,
            h('p', { class: 'm0', style: { fontSize: '13.5px' }, html: '<b>Reality check:</b> still <b>less mature</b> than uniprocessor and SMP OSs.' })),
          h('div', { class: 'card white stack', style: { gap: '7px' } },
            h('h3', { class: 'm0', html: '<span class="t">Object-oriented design</span>' }),
            h('p', { class: 'small m0', html: 'Build the OS from <b>objects</b>: modules that hide their insides and are used only through a defined <b>interface</b>. A small kernel is then extended in a <b>disciplined, modular</b> way.' }),
            h('div', { class: 'kcore' }, h('b', {}, 'Small kernel core'), status),
            slotsEl,
            h('div', { class: 'row gap-s' }, ...objBtns),
            oInfo,
            h('ul', { class: 'small m0 tight-list', html: '<li>Adds <b>modular extensions</b> to a small kernel in a disciplined way.</li><li>Lets programmers <b>customize</b> the OS without disrupting system integrity.</li><li>Eases building <b>distributed tools</b> and full distributed OSs.</li>' }))));
        drawCluster(); drawObjs();
      },
    },
    /* ---------------- 8. Recap: match each development to the problem it solves ---------------- */
    {
      title: 'Recap: match each development to its problem',
      kind: 'recap',
      render(el, ctx) {
        const { h } = ctx;
        const DEV = {
          smp: 'Symmetric multiprocessing', ood: 'Object-oriented design', micro: 'Microkernel architecture', dist: 'Distributed operating system', mt: 'Multithreading',
        };
        const PROB = [
          { dev: 'micro', text: 'The kernel has grown huge. A bug in any driver can crash the whole machine, and every change means editing the kernel.',
            why: 'Keep only IPC, address spaces and basic scheduling in the kernel; run every other service as a user-mode server that talks by messages.' },
          { dev: 'mt', text: 'A database server must keep answering other clients while one client\'s request waits for the disk.',
            why: 'Give each request its own thread inside one process: threads are cheap to create and switch, and they share the server\'s data.' },
          { dev: 'smp', text: 'One processor cannot keep up with the load, and the machine must keep running even if a processor fails.',
            why: 'Several similar processors share memory under one OS: potential gains in performance, availability, incremental growth and scaling.' },
          { dev: 'dist', text: 'Users want a room of networked computers to behave like one machine with one memory and one set of files.',
            why: 'A distributed OS gives the illusion of a single main memory and a single secondary-memory space, with a distributed file system.' },
          { dev: 'ood', text: 'Developers want to extend and customize the OS without putting the integrity of the whole system at risk.',
            why: 'Objects with defined interfaces plug into a small kernel in a disciplined, modular way, and they ease building distributed tools.' },
        ];
        const ORDER = ['smp', 'ood', 'micro', 'dist', 'mt'];
        const matched = new Set();
        let selP = null, selD = null;
        const probCol = h('div', { class: 'stack', style: { gap: '5px', flex: 'none' } });
        const devCol = h('div', { class: 'stack', style: { gap: '7px' } });
        const fb = h('div', { class: 'info-line small', style: { borderLeftColor: 'var(--chc)', minHeight: '86px' } });
        const prog = h('span', { class: 'chip accent' });
        function paint() {
          probCol.replaceChildren(...PROB.map((p, i) => {
            const done = matched.has(i);
            return h('button', { type: 'button', class: 'mprob' + (done ? ' done' : '') + (selP === i ? ' sel' : ''), 'aria-label': 'Problem ' + (i + 1), onclick: () => { if (done) { fb.innerHTML = `<b>${DEV[p.dev]}</b>: ${p.why}`; return; } selP = selP === i ? null : i; check(); } },
              h('span', { class: 'mnum' }, done ? '✓' : String(i + 1)),
              h('span', { class: 'mtext' }, p.text),
              done ? h('span', { class: 'chip ok mdev' }, DEV[p.dev]) : null);
          }));
          devCol.replaceChildren(...ORDER.map((d) => {
            const done = PROB.some((p, i) => p.dev === d && matched.has(i));
            return h('button', { type: 'button', class: 'mdevbtn' + (done ? ' done' : '') + (selD === d ? ' sel' : ''), disabled: done, onclick: () => { selD = selD === d ? null : d; check(); } }, (done ? '✓ ' : '') + DEV[d]);
          }));
          prog.textContent = `${matched.size} / ${PROB.length} matched`;
        }
        function check() {
          if (selP != null && selD != null) {
            const p = PROB[selP];
            if (p.dev === selD) {
              matched.add(selP);
              fb.innerHTML = matched.size === PROB.length
                ? `<b style="color:var(--ok)">All five matched.</b> Three forces (new hardware, new applications, new security threats) pushed operating systems toward these five developments. Click any card to reread its explanation.`
                : `<b style="color:var(--ok)">Right: ${DEV[selD]}.</b> ${p.why}`;
            } else {
              fb.innerHTML = `<b style="color:var(--bad)">Not quite.</b> ${DEV[selD]} does not solve problem ${selP + 1}. Ask yourself: is the pain about the kernel's structure, one application doing many things, too little processor power, many machines, or safe extension?`;
            }
            selP = null; selD = null;
          } else if (selP != null) fb.innerHTML = `Problem ${selP + 1} selected. Now click the development that solves it.`;
          else if (selD != null) fb.innerHTML = `<b>${DEV[selD]}</b> selected. Now click the problem it solves.`;
          paint();
        }
        fb.innerHTML = 'Click a problem, then the development that answers it. Say the reason out loud before you click.';
        el.append(h('div', { class: 'split r fill' },
          h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Problems'), prog),
            probCol,
            h('div', { class: 'card tight small', style: { lineHeight: '1.4' } },
              h('div', { class: 'xs b muted', style: { letterSpacing: '.07em', marginBottom: '3px' } }, 'ALSO REMEMBER'),
              h('ul', { class: 'm0 tight-list', html: '<li>Three forces: <b>new hardware</b>, <b>new applications</b>, <b>new security threats</b>.</li><li>Multiprogramming <b>interleaves</b>; multiprocessing interleaves <b>and overlaps</b>.</li><li>A thread switch keeps the address space, so it is <b>cheaper</b> than a process switch.</li>' }))),
          h('div', { class: 'stack', style: { gap: '8px' } },
            h('h4', { class: 'm0', style: { lineHeight: '24px' } }, 'Developments'),
            devCol, fb,
            h('div', { class: 'row gap-s' },
              h('button', { type: 'button', class: 'btn sm', onclick: () => { PROB.forEach((_, i) => matched.add(i)); selP = selD = null; fb.innerHTML = 'All answers shown. Click any problem card to read why its development fits.'; paint(); } }, 'Show all answers'),
              h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { matched.clear(); selP = selD = null; fb.innerHTML = 'Fresh start. Click a problem, then the development that answers it.'; paint(); } }, 'Start over')),
            h('div', { class: 'card tight small', style: { lineHeight: '1.4' } },
              h('ul', { class: 'm0 tight-list', html: '<li>A microkernel keeps only <b>address spaces, IPC and basic scheduling</b>; other services run as user-mode servers.</li><li>Threads help even on <b>one</b> processor; with SMP, threads of one process can also run in parallel.</li>' })))));
        paint();
      },
    },
    /* ---------------- 9. Check yourself ---------------- */
    {
      title: 'Check yourself',
      kind: 'check',
      quiz: [
        { q: 'Which functions does a <b>microkernel</b> keep inside the kernel?',
          choices: ['Address-space management, interprocess communication (IPC) and basic scheduling', 'File systems, device drivers and networking', 'Every OS service, compiled into one large program with one address space', 'None: every OS service runs in user mode'],
          answer: 0,
          feedback: [null, 'Those are exactly the services a microkernel moves out of the kernel into user-mode server processes.', 'That describes a monolithic kernel, the opposite design.', 'Something privileged must still manage address spaces, deliver messages and switch the processor between processes.'],
          why: 'A microkernel keeps only the essential core (address spaces, IPC and basic scheduling). Everything else runs as server processes in user mode that communicate by messages.' },
        { type: 'multi', q: 'Which of these are benefits usually claimed for a <b>microkernel</b> design? Select all that apply.',
          choices: ['A simpler kernel, with less privileged code to get right', 'Flexibility: services can be added, replaced or removed without changing the kernel', 'A good fit for distributed systems, because local and remote servers are both reached by messages', 'Faster requests, because each request needs fewer trips through the kernel'],
          answer: [0, 1, 2],
          why: 'The first three are the classic benefits. The last is backwards: passing messages between user-mode servers usually means <b>more</b> trips through the kernel, which is the main performance cost of a microkernel.' },
        { type: 'order', q: 'In a microkernel system, put the steps of an application reading part of a file in order.',
          items: ['The application sends a request message to the file server', 'The microkernel delivers the message to the file server', 'The file server sends a message asking the disk-driver process for the blocks', 'The disk-driver process reads the blocks and replies to the file server', 'The file server sends the data back to the application in a reply message'],
          why: 'Every hop is a message delivered through the microkernel: request to the file server, request to the driver, the driver\'s reply, then the reply to the application.' },
        { q: 'Which of these does each <b>thread</b> keep for itself instead of sharing it with the other threads of its process?',
          choices: ['Its processor context (program counter and other registers) and its stack', 'The program code', 'The table of open files', 'The global variables and the heap'],
          answer: 0,
          feedback: [null, 'All threads of a process run code from the same copy of the program.', 'Open files belong to the process, so every thread in it can use them.', 'Global data and the heap live in the shared address space; any thread can reach them.'],
          why: 'A thread is a dispatchable unit of work: it needs its own saved registers and its own stack. The code, data, open files and devices belong to the process and are shared.' },
        { q: 'Why is switching the processor between two threads of the <b>same process</b> usually cheaper than switching between two <b>different processes</b>?',
          choices: ['The threads share one address space, so the memory map and cached translations stay valid; only the registers and stack pointer change', 'Threads have no registers of their own, so nothing needs to be saved', 'Threads cannot be interrupted, so switches only happen at convenient points', 'Thread switches are carried out entirely by the hardware'],
          answer: 0,
          feedback: [null, 'Each thread has its own processor context, and it must be saved and restored on every switch.', 'Threads are interruptible; that is what lets the processor turn to another thread at any moment.', 'Software (the OS or a thread library) still performs the switch.'],
          why: 'A process switch must also change the address space, which makes cached memory translations and data stale. Threads of one process skip that work.' },
        { type: 'num', q: 'Five requests reach a single-threaded file server at the same moment, and it handles them strictly one after another. Each request needs 3 ms of processing, then waits 10 ms for the disk, then needs 2 ms more processing. How many milliseconds pass before all 5 requests are finished?',
          answer: 75, tol: 0, unit: 'ms',
          why: 'One thread cannot overlap anything, so each request takes 3 + 10 + 2 = 15 ms and 5 × 15 = <b>75 ms</b>. A multithreaded server could process other requests during the disk waits.' },
        { type: 'tf', q: 'Multithreading is useful only on a computer that has more than one processor.',
          answer: false,
          why: 'Even with one processor, a multithreaded server lets one thread compute while others wait for I/O, so the waits overlap. Multithreading and SMP are independent ideas; on an SMP machine they combine well, because threads of one process can then run on different processors at the same instant.' },
        { type: 'match', q: 'Match each potential advantage of <b>symmetric multiprocessing</b> to its description.',
          pairs: [['Performance', 'Work that can run in parallel finishes sooner'], ['Availability', 'If one processor fails, the machine keeps running at reduced speed'], ['Incremental growth', 'Add a processor instead of replacing the whole machine'], ['Scaling', 'A vendor sells a range of machines with different numbers of processors and prices']],
          why: 'All four come from having several similar processors that can each do any job under one OS. They are potential advantages: they appear only when the OS spreads parallel work across the processors.' },
        { q: 'Three processes run on one machine. What can <b>multiprocessing</b> do that multiprogramming on a single processor cannot?',
          choices: ['Overlap them: two processes can execute at literally the same instant', 'Interleave them: switch between them so that all make progress', 'Keep all three in main memory at the same time', 'Run another process while one waits for I/O'],
          answer: 0,
          feedback: [null, 'Multiprogramming on one processor already interleaves processes.', 'Multiprogramming already keeps several programs in memory at once.', 'That is exactly what multiprogramming does on a single processor.'],
          why: 'On one processor, processes can only be interleaved. With several processors they are interleaved <b>and</b> overlapped: some truly run at the same time.' },
        { type: 'tf', q: 'A distributed operating system gives users the illusion of a single main memory and a single secondary-memory space across a cluster of computers.',
          answer: true,
          why: 'That is its defining goal, together with unified services such as a distributed file system. Such systems are still less mature than uniprocessor and SMP operating systems.' },
        { type: 'bucket', q: 'Which force behind modern operating systems does each change belong to?',
          buckets: ['New hardware', 'New applications', 'New security threats'],
          items: [['Several processors', 0], ['High-speed networks', 0], ['Multimedia', 1], ['Client/server computing', 1], ['Viruses and worms', 2]],
          why: 'Hardware changes (processors, speed, networks, memory), new kinds of applications, and Internet-borne attacks all forced operating-system designs to evolve.' },
        { q: 'What is the main contribution of <b>object-oriented design</b> to operating systems?',
          choices: ['A disciplined way to add modular extensions to a small kernel, so the OS can be customized without disrupting its integrity', 'Several identical processors running under one operating system', 'One process containing several threads that run concurrently', 'A cluster of computers made to look like one machine'],
          answer: 0,
          feedback: [null, 'That is symmetric multiprocessing.', 'That is multithreading.', 'That is a distributed operating system.'],
          why: 'Objects hide their internals and are used only through defined interfaces, so extensions plug into a small kernel cleanly. The same idea eases building distributed tools and full distributed OSs.' },
      ],
    },
  ],

  notes: `
<h3>Why operating systems had to change</h3>
<p>Early operating systems assumed one slow processor and trusted users. Three forces changed that:</p>
<ul>
<li><b>New hardware:</b> machines with several processors, much faster processors, high-speed network connections, and larger, more varied memory.</li>
<li><b>New applications:</b> multimedia (smooth sound and video), Internet and Web access, and client/server computing (clients send requests, servers do the work and reply).</li>
<li><b>New security threats:</b> once computers joined the Internet, attackers anywhere could reach them with viruses, worms and ever cleverer hacking techniques.</li>
</ul>
<p>Five developments answered these forces: <b>microkernel architecture</b>, <b>multithreading</b>, <b>symmetric multiprocessing (SMP)</b>, <b>distributed operating systems</b> and <b>object-oriented design</b>.</p>

<h3>Monolithic kernel vs microkernel</h3>
<p>A <b>monolithic kernel</b> holds almost the whole OS: scheduling, file systems, networking, device drivers, memory management and more. It is one large program that runs as a single process in one address space, so any part can call any other part directly, like a function call.</p>
<p>A <b>microkernel</b> keeps only the essential core in the kernel: <b>address spaces</b> (which memory each process may use), <b>interprocess communication (IPC)</b> and <b>basic scheduling</b>. Every other service (file system, device drivers, networking, the virtual-memory policy) runs as an ordinary <b>server process in user mode</b>. Applications and servers cooperate by sending <b>messages</b>, and the microkernel delivers each one. The OS offers the same services; they have simply moved out of the kernel.</p>
<p><b>One file read.</b> Monolithic: one system call into the kernel, where the file system calls the driver directly (1 trip, 0 messages). Microkernel: application → file server → disk-driver process → file server → application, each hop a message through the kernel (4 messages, 4 trips). That message passing is the classic performance price of a microkernel.</p>
<h4>Benefits of a microkernel</h4>
<ul>
<li><b>Simpler kernel:</b> far less code runs with full privileges, so there is less to get right.</li>
<li><b>Flexibility:</b> servers can be added, replaced or upgraded without changing the kernel.</li>
<li><b>Suits distributed environments:</b> a request message can be forwarded unchanged to a server on another machine, so local and remote servers look the same.</li>
<li><b>Contained failures:</b> a crashed driver server wrecks only its own address space; in a monolithic kernel the same bug can corrupt kernel memory and halt the whole machine.</li>
</ul>
<p>The three core functions stay in the kernel because each needs privilege: delivering messages, setting up address spaces, switching the processor.</p>

<h3>Threads and processes</h3>
<p><b>Multithreading</b> divides one process into several threads that can run concurrently.</p>
<ul>
<li><b>Thread:</b> a dispatchable unit of work (what the scheduler runs). It has its own <b>processor context</b> (program counter, stack pointer and other registers) and its own <b>data area for a stack</b>. It executes its instructions sequentially and is <b>interruptible</b>, so the processor can turn to another thread.</li>
<li><b>Process:</b> a collection of one or more threads plus the <b>system resources</b> they share: memory holding code and data, open files and devices.</li>
</ul>
<p><b>Thread switch vs process switch.</b> A thread switch within one process saves the old thread's registers and loads the new thread's registers and stack pointer (2 of 4 costs). A <b>process switch</b> must also switch the memory map to another <b>address space</b> (the range of memory a process may use), after which the processor's cached address translations and data no longer help (all 4 costs). So a thread switch is cheaper.</p>
<p>Multithreading pays off when an application has <b>independent tasks</b> that need not wait for each other, such as a database server answering many clients. It helps even on <b>one processor</b> (one thread computes while another waits for I/O). It is independent of SMP but combines well with it: threads of one process can then run on different processors at once.</p>

<h3>Worked example: a database server</h3>
<p>Four requests arrive together; each needs 2 units of processing, a 12-unit disk wait, then 2 more units, on one CPU. Illustrative costs: thread create 1 / switch 1; process create 5 / switch 2.</p>
<table>
<tr><th>Design</th><th>All done at</th><th>Average response</th><th>Overhead</th></tr>
<tr><td>Single-threaded</td><td>64</td><td>40</td><td>0, but the CPU is busy only 16 of 64 = 25%</td></tr>
<tr><td>Process per request</td><td>44</td><td>38</td><td>28 units</td></tr>
<tr><td>Thread per request</td><td>27</td><td>22.5</td><td>8 units</td></tr>
</table>
<p>Single-threaded total = number of requests × time per request. Example: 5 requests × (3 + 10 + 2) ms = 75 ms, and the processor is busy only 5 of every 15 ms ≈ 33.3%. Threads share the server's data directly; separate processes need IPC or shared memory to share it, but a crash in one process does not take down the others. Real servers often create a <b>thread pool</b> once, at start-up.</p>

<h3>Symmetric multiprocessing (SMP)</h3>
<p>SMP names both a hardware architecture and the OS behaviour that exploits it: two or more similar processors of comparable capability share main memory and I/O over a bus or other link, with about equal memory access time; each can perform every function, even run the OS (hence symmetric); and one integrated OS schedules processes or threads on all of them, hiding the multiple processors from users.</p>
<p><b>Potential advantages</b> over a single processor (they appear only if there is parallel work and the OS spreads it):</p>
<ul>
<li><b>Performance:</b> work that can run in parallel finishes sooner.</li>
<li><b>Availability:</b> the failure of one processor does not halt the machine; it continues at reduced performance.</li>
<li><b>Incremental growth:</b> add a processor to boost performance.</li>
<li><b>Scaling:</b> vendors offer a range of products with different price and performance based on the number of processors.</li>
</ul>
<p><b>Multiprogramming</b> on one processor <b>interleaves</b> processes: they take turns, so they only seem to run together. <b>Multiprocessing</b> on several processors <b>interleaves and overlaps</b> them: some truly run at the same instant. Example: three processes that compute, wait for I/O, then compute again finish at 19 on one CPU, 13 on two, 11 on three (I/O waits limit the gain).</p>

<h3>Distributed operating systems</h3>
<p>A <b>cluster</b> is a group of complete computers on a fast network working together as one resource. A <b>distributed operating system</b> gives the illusion of a single main memory and a single secondary-memory space, plus unified access facilities such as a <b>distributed file system</b>, so users need not know which machine stores a file. Distributed OSs are still less mature than uniprocessor and SMP operating systems.</p>

<h3>Object-oriented design</h3>
<p>Objects are modules that hide their internals and are used only through defined interfaces. In an OS this gives a disciplined way to add <b>modular extensions to a small kernel</b>, lets programmers <b>customize the OS without disrupting system integrity</b>, and <b>eases building distributed tools</b> and full distributed operating systems (a remote object can offer the same interface as a local one).</p>

<h3>Summary: development → problem it addresses</h3>
<p><b>Microkernel:</b> a huge, fragile kernel. <b>Multithreading:</b> one application juggling independent tasks cheaply. <b>SMP:</b> too little processing power; surviving a processor failure. <b>Distributed OS:</b> networked computers that should act as one. <b>Object-oriented design:</b> extending the OS safely.</p>
`,
});
