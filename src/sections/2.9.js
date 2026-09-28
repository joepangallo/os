/* Section 2.9 — Modern Unix Systems
   Original teaching material. Built step by step (see AUTHORING.txt). */
Guide.section({
  id: '2.9',
  title: 'Modern Unix Systems',
  short: 'Modern UNIX',
  summary: 'Why UNIX was rebuilt around a small modular core, and the SVR4, BSD and Solaris 11 systems built that way.',
  objectives: [
    'Explain why the spread of many incompatible UNIX versions pushed designers toward a modular kernel: a small core of common facilities with clean interfaces where new parts plug in.',
    'Name the six plug-in points of a modern UNIX kernel (exec switch, virtual memory framework, vnode/vfs interface, block device switch, scheduler framework, STREAMS) and say what plugs into each.',
    'Describe System V Release 4: who built it, the four systems it combined, and the six major features it introduced.',
    'Trace the BSD line from 4.xBSD to FreeBSD, NetBSD, OpenBSD and macOS, and state BSD\'s lasting contributions.',
    'Describe Solaris 11 and its key features: a fully preemptable multithreaded kernel, full SMP support and an object-oriented file-system interface.',
  ],
  terms: [
    ['Modular kernel', 'A kernel organised as a small core of shared services plus separate modules that connect to the core through fixed, well-defined interfaces, so a module can be added or replaced without rewriting the core.'],
    ['Switch table', 'A table of pointers to functions with one row per implementation (one per device driver, per program file format, per file-system type). The core finds the right row and calls through it, so it never needs the details of any one implementation.'],
    ['Exec switch', 'The switch table used when a process starts a new program (the exec system call). Each row is a loader for one executable file format, such as a.out, COFF or ELF, and the kernel uses the loader that recognizes the file.'],
    ['Executable and Linkable Format (ELF)', 'The format for program and library files introduced with SVR4. It replaced the older a.out and COFF formats and is standard today on Linux, the BSDs and Solaris.'],
    ['Virtual memory framework', 'The part of a modern UNIX kernel that manages each process\'s address space as a set of mappings. Each kind of mapping (file, device or anonymous) supplies its own code for bringing its pages into memory.'],
    ['File mapping', 'A region of a process\'s address space whose contents come from a file. A page is read from the file the first time it is touched; program code is usually mapped this way.'],
    ['Anonymous mapping', 'A region of memory that is not backed by any named file, such as the heap or a stack. It starts out filled with zeros and, if it must leave main memory, it is written to swap space.'],
    ['Vnode', 'The kernel\'s in-memory object for one active file. It looks the same whatever file system the file lives on, and it points to that file system\'s table of operations (open, read, write, lookup and so on).'],
    ['Virtual file system (VFS)', 'The layer that lets many file-system types exist side by side behind one set of file system calls. Each mounted file system is represented by a vfs object and each active file by a vnode.'],
    ['Network File System (NFS)', 'Sun\'s way of using files stored on another computer across a network as if they were on a local disk. Sun created the vnode/vfs interface so NFS and local file systems could work side by side.'],
    ['Block device switch', 'The kernel table, indexed by a device\'s major number, that holds the entry points of every block-device driver, such as disk and tape drivers. Together with its twin for character devices, it is one of the oldest switch tables in UNIX.'],
    ['Scheduling class', 'A group of processes that share one scheduling policy and one band of priorities. SVR4 has a time-sharing class, a system class for kernel processes and a real-time class, each plugged into the scheduler framework.'],
    ['STREAMS', 'A framework for character I/O such as terminals and network connections. Data flows through a chain of modules between a process and a driver, and modules can be pushed onto or popped off the chain while it is in use.'],
    ['System V Release 4 (SVR4)', 'The UNIX release of 1989, developed jointly by AT&T and Sun Microsystems. It merged SVR3, 4.3BSD, Microsoft Xenix System V and SunOS on an almost completely rewritten kernel.'],
    ['Berkeley Software Distribution (BSD)', 'The versions of UNIX produced at the University of California, Berkeley, ending with 4.4BSD. BSD added paged virtual memory and TCP/IP networking with sockets, and its code lives on in FreeBSD, NetBSD, OpenBSD and macOS.'],
    ['Socket', 'The programming interface, introduced by BSD, through which a program opens a network connection and sends and receives data. It became the standard way programs use TCP/IP.'],
    ['Preemptive kernel', 'A kernel that can take the processor away from a process even while that process is running kernel code, so an urgent process does not have to wait for a whole system call to finish.'],
    ['Multithreaded kernel', 'A kernel whose own work is carried out by many kernel threads that can run at the same time on different processors, each piece of shared kernel data protected by its own small lock rather than one lock for everything.'],
    ['Symmetric multiprocessing (SMP)', 'A design in which two or more similar processors share main memory and devices, and any processor can run any work, including the kernel itself.'],
    ['Darwin', 'The open-source core of Apple\'s macOS. Its kernel joins the Mach microkernel, developed at Carnegie Mellon University, with a large body of code taken from FreeBSD.'],
  ],

  css: `
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width */
    .sec-2-9 .step-eyebrow { contain: inline-size; }
    .sec-2-9 .hot { cursor: pointer; outline: none; }
    .sec-2-9 .hot .fr { transition: stroke-width .15s, opacity .2s; }
    .sec-2-9 .hot:hover .fr, .sec-2-9 .hot:focus-visible .fr { stroke-width: 3.5; }
    .sec-2-9 .hot.sel .fr { stroke-width: 4; }
    .sec-2-9 .dimmer .hot:not(.sel) { opacity: .45; }
    .sec-2-9 .info { display: flex; flex-direction: column; gap: 8px; }
    .sec-2-9 .info h3 { margin: 0; }
    .sec-2-9 .info p { font-size: 15.5px; line-height: 1.45; margin: 0; }
    .sec-2-9 .eg { font-size: 14.5px; line-height: 1.4; padding: 7px 11px; border-radius: 10px; background: var(--panel-3); border-left: 4px solid var(--chc); }
    .sec-2-9 .eg b { color: var(--chc); }
    .sec-2-9 .kv { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; font-size: 14.5px; line-height: 1.4; align-items: baseline; }
    .sec-2-9 .kv b { white-space: nowrap; }
    .sec-2-9 .stat { display: flex; flex-direction: column; gap: 0; }
    .sec-2-9 .stat .xs { text-transform: uppercase; letter-spacing: .07em; font-weight: 800; color: var(--muted); }
    .sec-2-9 .stat .v { font-size: 26px; font-weight: 800; line-height: 1.15; font-variant-numeric: tabular-nums; }
    .sec-2-9 .ok-t { color: var(--ok); } .sec-2-9 .bad-t { color: var(--bad); } .sec-2-9 .warn-t { color: var(--warn); }

    /* step 1: one UNIX becomes many */
    .sec-2-9 .vgrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .sec-2-9 .vcell { border: 2px solid var(--line-2); border-radius: 10px; padding: 6px 10px; background: var(--panel); transition: opacity .3s, border-color .2s, background .2s; min-height: 66px; line-height: 1.3; }
    .sec-2-9 .vcell b { display: block; font-size: 15.5px; }
    .sec-2-9 .vcell .who { display: block; font-size: 13.5px; color: var(--ink-2); }
    .sec-2-9 .vcell .base { display: block; font-size: 12.5px; color: var(--muted); }
    .sec-2-9 .vcell.off { opacity: .16; border-style: dashed; }
    .sec-2-9 .vcell.new { border-color: var(--chc); box-shadow: 0 0 0 2px color-mix(in srgb, var(--chc) 25%, transparent); }
    .sec-2-9 .vcell.merge { border-color: var(--accent); background: var(--accent-bg); }
    .sec-2-9 .svr4 { display: flex; align-items: center; gap: 12px; border: 2px solid var(--os); background: var(--os-bg); border-radius: 12px; padding: 8px 12px; font-size: 15px; line-height: 1.35; transition: opacity .3s; }
    .sec-2-9 .svr4.off { opacity: .28; border-style: dashed; }
    .sec-2-9 .svr4 .tag { font-weight: 900; font-size: 18px; color: var(--os); white-space: nowrap; }
    .sec-2-9 .era-cap { font-size: 15.5px; line-height: 1.45; min-height: 68px; }

    /* step 2: tangle vs hub */
    .sec-2-9 .cmp-card { display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; }
    .sec-2-9 .cmp-card h4 { margin: 0; }
    .sec-2-9 .cmp-res { font-weight: 800; font-size: 15.5px; }
    .sec-2-9 .cmp-why { font-size: 14.5px; line-height: 1.4; color: var(--ink-2); min-height: 41px; }
    .sec-2-9 .tangle path { fill: none; stroke: var(--line-2); stroke-width: 1.6; }
    .sec-2-9 .badge text { font-size: 13px; font-weight: 800; fill: var(--panel); }

    /* step 3: the hub */
    .sec-2-9 .hub .chiptx { font-size: 13px; font-weight: 700; }
    .sec-2-9 .hub .chipr.lit { fill: var(--ok-bg); stroke: var(--ok); stroke-width: 2.5; }
    .sec-2-9 .hub .mod.good .fr { fill: var(--ok-bg); stroke: var(--ok); stroke-width: 4; }
    .sec-2-9 .hub .mod.wrong .fr { fill: var(--bad-bg); stroke: var(--bad); stroke-width: 4; }
    .sec-2-9 .plug { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 7px 10px; font-size: 14.5px; line-height: 1.38; align-items: start; }
    .sec-2-9 .plug .chip { justify-self: start; }
    .sec-2-9 .req { font-size: 18px; font-weight: 650; line-height: 1.4; padding: 12px 14px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); }
    .sec-2-9 .fb { font-size: 15px; line-height: 1.45; }
    .sec-2-9 .fb .verdict { font-weight: 900; font-size: 17px; margin-bottom: 2px; }
    .sec-2-9 .route-hint .kv { font-size: 14px; gap: 2px 10px; }
    .sec-2-9 .route-panel:has(.reveal-body.on) .route-how { display: none; }

    /* step 4: vnode/vfs hot-swap lab */
    .sec-2-9 .lab-log { flex: 1; font-size: 13.5px; }
    .sec-2-9 .lab-log > div { border-bottom: 0; padding: 2px 0; }
    .sec-2-9 .lab-log .cmd { color: var(--chc); font-weight: 800; }
    .sec-2-9 .lab-log .ok { color: var(--ok); font-weight: 700; }
    .sec-2-9 .lab-log .bad { color: var(--bad); font-weight: 700; }
    .sec-2-9 .lab-log .note { color: var(--ink-2); font-family: var(--font); font-size: 14px; }
    .sec-2-9 .btn .n { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--chc); color: var(--panel); font-size: 12.5px; font-weight: 900; }
    .sec-2-9 .btn.done { border-color: var(--ok); color: var(--ok); }
    .sec-2-9 .btn.done .n { background: var(--ok); }

    /* step 5: SVR4 */
    .sec-2-9 .ftiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .sec-2-9 .ftile { display: flex; align-items: center; gap: 10px; text-align: left; padding: 8px 10px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); color: var(--ink); font-size: 15px; font-weight: 700; line-height: 1.25; cursor: pointer; min-height: 52px; }
    .sec-2-9 .ftile:hover { border-color: var(--os); }
    .sec-2-9 .ftile .n { flex: none; display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: var(--os-bg); color: var(--os); font-weight: 900; font-size: 14px; }
    .sec-2-9 .ftile.on { border-color: var(--os); background: var(--os-bg); }
    .sec-2-9 .ftile.on .n { background: var(--os); color: var(--panel); }
    .sec-2-9 .det { display: flex; gap: 16px; align-items: flex-start; min-height: 150px; }
    .sec-2-9 .det h3 { margin: 0 0 4px; }
    .sec-2-9 .det p { margin: 0 0 6px; font-size: 16px; line-height: 1.45; }

    /* step 6: family tree */
    .sec-2-9 .split.gen { grid-template-columns: minmax(0, 8fr) minmax(0, 4fr); gap: 18px; }
    .sec-2-9 .tree .edge { fill: none; stroke: var(--line-2); stroke-width: 2; transition: stroke .2s; }
    .sec-2-9 .tree .edge.on { stroke: var(--accent); stroke-width: 3.5; }
    .sec-2-9 .tree .node .fr { fill: var(--panel-2); stroke: var(--line-2); }
    .sec-2-9 .tree .node.root .fr { fill: var(--os-bg); stroke: var(--os); }
    .sec-2-9 .tree .node.on .fr { fill: var(--accent-bg); stroke: var(--accent); stroke-width: 2.5; }
    .sec-2-9 .tree .node.sel .fr { stroke: var(--chc); stroke-width: 4; }
    .sec-2-9 .tree.tracing .node:not(.on) { opacity: .45; }
    .sec-2-9 .tree.tracing .edge:not(.on) { opacity: .4; }
    /* step 7: Solaris sims */
    .sec-2-9 .feat { display: flex; gap: 10px; align-items: flex-start; padding: 8px 12px; }
    .sec-2-9 .feat .n { flex: none; display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: var(--os); color: var(--panel); font-weight: 900; font-size: 14px; margin-top: 1px; }
    .sec-2-9 .feat p { margin: 0; font-size: 14.5px; line-height: 1.4; }
    .sec-2-9 .feat b { display: block; font-size: 16px; }
    .sec-2-9 .simcard { display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; }
    .sec-2-9 .simcard .hdr { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .sec-2-9 .simcard .seg button { font-size: 13.5px; padding: 4px 10px; }
    .sec-2-9 .simcap { font-size: 14.5px; line-height: 1.4; color: var(--ink-2); }
    .sec-2-9 .gantt text { font-size: 13px; }
    .sec-2-9 .gift { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; font-size: 14.5px; line-height: 1.35; align-items: baseline; }
  `,

  steps: [
    /* ---------------- 1. Big Picture: why UNIX needed a new kind of kernel ---------------- */
    {
      title: 'Too many UNIXes: why the kernel was rebuilt',
      kind: 'story',
      render(el, ctx) {
        const { h } = ctx;
        const V = [
          { n: 'Research UNIX', who: 'AT&T Bell Labs', base: 'the original', era: 1975 },
          { n: 'BSD', who: 'UC Berkeley', base: 'from Bell Labs code', era: 1980, merge: true },
          { n: 'System V', who: 'AT&T', base: 'from Bell Labs code', era: 1985, merge: true },
          { n: 'Xenix', who: 'Microsoft', base: 'from AT&T code', era: 1980, merge: true },
          { n: 'SunOS', who: 'Sun Microsystems', base: 'from BSD code', era: 1985, merge: true },
          { n: 'Ultrix', who: 'DEC', base: 'from BSD code', era: 1985 },
          { n: 'HP-UX', who: 'Hewlett-Packard', base: 'from AT&T code', era: 1985 },
          { n: 'AIX', who: 'IBM', base: 'from AT&T code', era: 1989 },
          { n: 'IRIX', who: 'Silicon Graphics', base: 'from AT&T code', era: 1989 },
        ];
        const CAP = {
          1975: '<b>1975.</b> One system: the UNIX that Bell Labs built. AT&T licenses its source code to universities for a small fee, so students can read and change a real operating system.',
          1980: '<b>1980.</b> Berkeley now ships its own version, BSD, with paged virtual memory. Microsoft licenses AT&T\'s code to build Xenix for small computers.',
          1985: '<b>1985.</b> AT&T sells System V, and computer makers build versions for their own hardware from AT&T\'s or Berkeley\'s code, each editing the kernel its own way.',
          1989: '<b>1989.</b> Still more versions. AT&T and Sun answer with <b>SVR4</b>, which merges four major lines on a kernel rebuilt around a small core with plug-in modules.',
        };
        const cells = V.map((v) => h('div', { class: 'vcell' }, h('b', v.n), h('span', { class: 'who' }, v.who), h('span', { class: 'base' }, v.base)));
        const banner = h('div', { class: 'svr4' },
          h('span', { class: 'tag' }, 'SVR4'),
          h('span', { html: '<b>1989 · AT&T + Sun.</b> Merges System V, BSD, Xenix and SunOS into one system on a rebuilt, modular kernel.' }));
        const count = h('div', { class: 'v' });
        const cap = h('div', { class: 'era-cap', style: { flex: '1 1 260px' } });
        function show(year) {
          V.forEach((v, i) => {
            const c = cells[i];
            c.classList.toggle('off', v.era > year);
            c.classList.toggle('new', v.era === year && year !== 1989);
            c.classList.toggle('merge', year === 1989 && !!v.merge);
          });
          banner.classList.toggle('off', year < 1989);
          count.textContent = V.filter((v) => v.era <= year).length;
          cap.innerHTML = CAP[year];
        }
        const seg = ctx.ui.seg([1975, 1980, 1985, 1989].map((y) => ({ value: y, label: String(y) })), 1975, show);
        const left = h('div', { class: 'stack' },
          h('p', { class: 'lead m0', html: 'By the late 1980s there was no single UNIX. There were many, and each company had changed the <span class="t">kernel</span> in its own way.' }),
          h('p', { class: 'm0', html: 'AT&T licensed the UNIX source code widely (section 2.8 tells that story). Each group added features by editing the kernel itself, so code written for one version needed work to move to another, and every addition made the kernel harder to change.' }),
          h('p', { class: 'm0', html: 'Designers answered with a new shape, the <span class="t">modular kernel</span>: a small core holds the services every part needs, and anything that comes in many varieties plugs into the core through a fixed interface.' }),
          h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'The electrical outlets in a building. The wiring in the walls is the core. Any appliance with the standard plug just works, and a new toaster never means rewiring the house.' }));
        const right = h('div', { class: 'card white stack', style: { gap: '10px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'One UNIX becomes many'), seg),
          h('div', { class: 'vgrid' }, cells),
          banner,
          h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '16px' } },
            h('div', { class: 'stat', style: { minWidth: '112px' } }, h('span', { class: 'xs' }, 'Versions'), count),
            cap),
          h('p', { class: 'xs muted m0' }, 'Pick a year. Faded boxes do not exist yet. Only a sample of the many versions is shown.'),
          h('div', { class: 'small', style: { marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--line)' }, html: '<b>Coming up:</b> the six plug-in points of a modern UNIX kernel, a live hot-swap, then three systems built this way: SVR4, the BSD family and Solaris 11.' }));
        el.append(h('div', { class: 'split l fill' }, left, right));
        show(1975);
      },
    },

    /* ---------------- 2. Compare: traditional tangle vs modern hub ---------------- */
    {
      title: 'Tangle or hub? Make one change and see what it touches',
      kind: 'compare',
      render(el, ctx) {
        const { h, s } = ctx;
        const BLOBS = ['system calls', 'file handling', 'buffer cache', 'program loader', 'memory mgmt', 'scheduler', 'clock & sleep', 'device drivers'];
        const LINKS = [[0, 1], [0, 3], [0, 5], [1, 2], [1, 4], [2, 7], [3, 4], [4, 5], [5, 6], [6, 0], [4, 7], [2, 4], [6, 3], [1, 5], [0, 7], [3, 6], [2, 5]];
        const MODS = [
          { n: 'exec switch', p: 'a.out · coff', x: 20, y: 6 },
          { n: 'VM framework', p: 'file · device · anon', x: 370, y: 6 },
          { n: 'vnode/vfs', p: 's5fs · FFS', x: 8, y: 89 },
          { n: 'block device switch', p: 'disk · tape', x: 382, y: 89 },
          { n: 'scheduler framework', p: 'time-sharing · system', x: 20, y: 172 },
          { n: 'STREAMS', p: 'network · tty', x: 370, y: 172 },
        ];
        const SC = [
          { label: 'New file system', touch: [0, 1, 2, 3], mod: 2, add: '+ NFS (network files)',
            trad: 'File handling assumed one on-disk layout, and that assumption leaked into open and read, the buffer cache (disk blocks kept in memory) and the program loader. Remote files break all of them.',
            modern: 'vnode/vfs already lists the operations a file system must supply. NFS brings its own open, read and lookup, and the core calls them through each file\'s <span class="t">vnode</span>.' },
          { label: 'New program format', touch: [3, 4, 0], mod: 0, add: '+ elf loader',
            trad: 'exec, the system call that starts a new program, knew exactly one program-file layout and built the memory image to match it, so a second format meant rewriting exec and memory management.',
            modern: 'The <span class="t">exec switch</span> asks each loader "is this file yours?". Supporting ELF means adding one loader; the exec system call itself does not change.' },
          { label: 'Real-time scheduling', touch: [5, 6, 0], mod: 4, add: '+ real-time class',
            trad: 'One built-in priority rule was spread over the scheduler, the clock code that recalculates every process\'s priority once a second, and the sleep code that sets a priority when a process blocks.',
            modern: 'Each <span class="t">scheduling class</span> sets its own members\' priorities; the core just runs the highest-priority ready process. A real-time class plugs in next to the others.' },
          { label: 'New disk driver', touch: [7], ok: true, mod: 3, add: '+ new disk driver',
            trad: 'The exception: even early UNIX reached drivers through a table, the block device switch. You wrote the driver and filled in one row.',
            modern: 'Exactly the same: fill one row of the <span class="t">block device switch</span>. Modern UNIX took this old trick and applied it everywhere.' },
        ];
        const bx = (i) => 18 + (i % 4) * 130, by = (i) => (i < 4 ? 46 : 158);
        const tradSvg = s('svg', { viewBox: '0 0 540 240', width: '100%' });
        const modSvg = s('svg', { viewBox: '0 0 540 240', width: '100%' });
        const tradRes = h('div', { class: 'cmp-res' }), tradWhy = h('div', { class: 'cmp-why' });
        const modRes = h('div', { class: 'cmp-res ok-t' }), modWhy = h('div', { class: 'cmp-why' });
        function drawTrad(sc) {
          const tangle = s('g', { class: 'tangle' }, LINKS.map(([a, b], k) => {
            const x1 = bx(a) + 58, y1 = by(a) + 27, x2 = bx(b) + 58, y2 = by(b) + 27;
            const mx = (x1 + x2) / 2 + ((k % 3) - 1) * 26, my = (y1 + y2) / 2 + ((k % 2) ? 24 : -24);
            return s('path', { d: `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}` });
          }));
          const blobs = BLOBS.map((n, i) => {
            const hit = sc.touch.includes(i);
            const cls = hit ? (sc.ok ? 's-ok' : 's-bad') : 's-panel';
            const g = s('g', {},
              s('rect', { x: bx(i), y: by(i), width: 116, height: 54, rx: 12, class: cls, 'stroke-width': hit ? 2.5 : 1.5 }),
              s('text', { x: bx(i) + 58, y: by(i) + (i === 7 ? 24 : 32), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, n));
            if (i === 7) g.append(s('text', { x: bx(i) + 58, y: by(i) + 42, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'via a switch table'));
            if (hit) g.append(s('g', { class: 'badge' },
              s('rect', { x: bx(i) + 76, y: by(i) - 11, width: 48, height: 22, rx: 11, style: `fill:var(${sc.ok ? '--ok' : '--bad'})` }),
              s('text', { x: bx(i) + 100, y: by(i) + 5, 'text-anchor': 'middle' }, sc.ok ? '+1 row' : 'edit')));
            return g;
          });
          tradSvg.replaceChildren(
            s('rect', { x: 4, y: 4, width: 532, height: 232, rx: 16, class: 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }),
            s('text', { x: 18, y: 28, 'font-size': 13.5, class: 's-sub' }, 'One big program: any part may call, or share data with, any other part'),
            tangle, ...blobs);
          tradRes.className = 'cmp-res ' + (sc.ok ? 'ok-t' : 'bad-t');
          tradRes.textContent = sc.ok ? 'Parts edited: 1 (one new table row)' : `Parts edited: ${sc.touch.length}, then rebuild and retest everything`;
          tradWhy.innerHTML = sc.trad;
        }
        function drawModern(sc) {
          const cx = 270, cy = 120;
          const spokes = MODS.map((m, i) => {
            const mx = m.x < 200 ? m.x + 150 : m.x, my = m.y + 31;
            const ang = Math.atan2(my - cy, mx - cx), ex = cx + 56 * Math.cos(ang), ey = cy + 56 * Math.sin(ang);
            const on = i === sc.mod;
            return s('g', {}, s('line', { x1: ex, y1: ey, x2: mx, y2: my, style: `stroke:var(${on ? '--ok' : '--line-2'})`, 'stroke-width': on ? 3 : 2 }),
              s('circle', { cx: ex, cy: ey, r: 4.5, style: `fill:var(--panel);stroke:var(${on ? '--ok' : '--os'})`, 'stroke-width': 2 }));
          });
          const mods = MODS.map((m, i) => {
            const on = i === sc.mod;
            const g = s('g', {},
              s('rect', { x: m.x, y: m.y, width: 150, height: 62, rx: 11, class: on ? 's-ok' : 's-panel', 'stroke-width': on ? 2.5 : 1.5 }),
              s('text', { x: m.x + 75, y: m.y + 19, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, m.n),
              s('text', { x: m.x + 75, y: m.y + 37, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, m.p));
            if (on) g.append(s('text', { x: m.x + 75, y: m.y + 55, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--ok)' }, sc.add));
            return g;
          });
          modSvg.replaceChildren(...spokes,
            s('circle', { cx, cy, r: 56, class: 's-os', 'stroke-width': 2.5 }),
            s('text', { x: cx, y: cy - 6, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, style: 'fill:var(--os)' }, 'core'),
            s('text', { x: cx, y: cy + 13, 'text-anchor': 'middle', 'font-size': 13 }, 'common'),
            s('text', { x: cx, y: cy + 29, 'text-anchor': 'middle', 'font-size': 13 }, 'facilities'),
            ...mods);
          modRes.textContent = 'Core edited: 0 lines. One module added.';
          modWhy.innerHTML = sc.modern;
        }
        function pick(i) { drawTrad(SC[i]); drawModern(SC[i]); }
        const seg = ctx.ui.seg(SC.map((sc, i) => ({ value: i, label: sc.label })), 0, pick);
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } },
            h('p', { class: 'lead m0', html: 'Pick a change. See what each kernel design has to touch.' }), seg),
          h('div', { class: 'grid-2 grow' },
            h('div', { class: 'card cmp-card' }, h('h4', 'Traditional kernel: one tangle'), tradSvg, tradRes, tradWhy),
            h('div', { class: 'card cmp-card' }, h('h4', { html: 'Modern <span class="t">modular kernel</span>: core + plug-ins' }), modSvg, modRes, modWhy)),
          h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'A change that stays inside one module is smaller, safer and can be tested alone, and the core that everyone depends on stays stable. The "edit" counts are illustrative: they show how far one change spreads, not exact line counts.' })));
        pick(0);
      },
    },

    /* ---------------- 3. Explore: the modern kernel hub (explore + route modes) ---------------- */
    {
      title: 'The modern UNIX kernel: a core with six plug-in points',
      kind: 'explore',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h, s } = ctx;
        // six modules around the core; side L = running programs, R = files and I/O
        const M = [
          { id: 'exec', n: 'exec switch', c: 'proc', x: 10, y: 20, chips: ['a.out', 'coff', 'elf'], role: 'starting programs in different file formats',
            what: 'Starts new programs. When a process calls exec, the kernel reads the start of the program file (its header) and offers the file to each loader in the <span class="t">exec switch</span> until one recognizes the format. That loader lays the program out in memory.',
            plug: ['The original UNIX program format, named after the assembler\'s default output file: just code, data and a symbol table.', 'Common Object File Format, used by System V before SVR4. It allows more sections and richer debugging information.', 'The <span class="t">Executable and Linkable Format (ELF)</span>, introduced with SVR4 and still the standard on Linux, the BSDs and Solaris.'],
            eg: 'Every command you run goes through the exec switch. Supporting a new format means adding one loader; exec itself never changes.' },
          { id: 'vm', n: 'VM framework', c: 'mem', x: 10, y: 198, chips: ['file', 'device', 'anon'], role: 'memory mappings and page faults',
            what: 'The <span class="t">virtual memory framework</span> treats each <span class="t">address space</span> as a list of mappings. On a page fault (a touch of a page that is not in memory yet) the core finds the mapping that holds the address and calls that mapping\'s own routine to supply the page.',
            plug: ['<span class="t">File mapping</span>: pages come from a file the first time they are touched. Program code is mapped this way.', 'Device mapping: a window onto a device\'s own memory, such as a graphics frame buffer.', '<span class="t">Anonymous mapping</span>: memory with no file behind it, such as the heap and stacks. It starts as zeros.'],
            eg: 'One address space mixes all three: code (file), heap and stack (anonymous) and perhaps a frame buffer (device).' },
          { id: 'sched', n: 'scheduler framework', c: 'cpu', x: 10, y: 376, chips: ['time-sharing', 'system'], role: 'choosing which process runs next',
            what: 'Decides which process runs next. The core dispatcher always runs the highest-priority ready process; each <span class="t">scheduling class</span> decides how the priorities of its own members are set and changed.',
            plug: ['Ordinary user processes. Priorities rise and fall with behaviour: a process that uses up its whole time slice (its turn on the processor) drops, one that often waits for input rises, so interactive programs stay responsive.', 'Kernel processes, such as the page-out daemon that frees memory. Fixed priorities above every time-sharing process.'],
            eg: 'SVR4 added a third class, real-time, with fixed priorities above both. Adding it did not change the dispatcher.' },
          { id: 'vfs', n: 'vnode/vfs interface', c: 'accent', x: 434, y: 20, chips: ['NFS', 'FFS', 's5fs', 'RFS'], role: 'files and file systems',
            what: 'Lets many file-system types live side by side. File system calls work only with <span class="t">vnode</span>s; each vnode points to the operation table of the file system that owns the file. Each mounted file system is a vfs object.',
            plug: ['<span class="t">Network File System (NFS)</span>: files that live on another computer.', 'Berkeley\'s Fast File System, which keeps related data close together on disk.', 'The original System V file system layout.', 'Remote File Sharing: AT&T\'s own network file system.'],
            eg: 'Your disk, a network share and a USB stick can all be open at once, each through its own file-system module.' },
          { id: 'bdev', n: 'block device switch', c: 'io', x: 434, y: 198, chips: ['disk', 'tape'], role: 'block devices such as disks and tapes',
            what: 'Reaches the drivers (the code that controls each kind of device) for devices that move data in fixed-size blocks. Each device is named by two numbers: the major number selects the driver\'s row in the <span class="t">block device switch</span>, and the minor number tells that driver which unit (which disk) to use.',
            plug: ['Disk drivers: read or write any numbered block.', 'Tape drivers: blocks in order along the tape, used for backups.'],
            eg: 'One of the oldest switches in UNIX (with its twin for character devices): even early versions found drivers this way. Modern UNIX copied the idea everywhere.' },
          { id: 'str', n: 'STREAMS', c: 'io', x: 434, y: 376, chips: ['network', 'tty'], role: 'terminals and network connections',
            what: '<span class="t">STREAMS</span> handles character I/O as a chain: a stream head next to the process, optional processing modules in the middle, and a driver at the far end. Modules can be pushed or popped while the stream is open.',
            plug: ['Network drivers, with protocol modules such as TCP/IP stacked above them.', 'Terminal drivers. "tty" is short for teletype, the typewriter-like terminals of early UNIX.'],
            eg: 'Pushing a module adds processing, such as line editing or a protocol, without changing the driver below or the program above.' },
        ];
        const CORE = { n: 'Common facilities (the core)', c: 'os', role: 'shared services, not a plug-in point',
          what: 'The small core holds services every other part needs, such as system-call entry, process and <span class="t">thread</span> management, <span class="t">interrupt</span> handling, locking and kernel memory allocation.',
          eg: 'The core knows nothing about any particular program format, memory source, file system, device or scheduling policy. It reaches all of them through the six interfaces around it.' };
        const cx = 320, cy = 240, R = 88;
        const svg = s('svg', { viewBox: '0 0 640 480', width: '100%', class: 'hub' });
        const chipEls = [], modEls = [];
        M.forEach((m, i) => {
          const ix = m.x < 300 ? m.x + 196 : m.x, iy = m.y + 42;
          const a = Math.atan2(iy - cy, ix - cx), ex = cx + R * Math.cos(a), ey = cy + R * Math.sin(a);
          svg.append(s('line', { x1: ex, y1: ey, x2: ix, y2: iy, class: 's-muted', 'stroke-width': 2.5 }),
            s('circle', { cx: ex, cy: ey, r: 6, style: 'fill:var(--panel);stroke:var(--os)', 'stroke-width': 2.5 }));
          const g = s('g', { class: 'hot mod', tabindex: 0, role: 'button', 'aria-label': m.n });
          g.append(s('rect', { x: m.x, y: m.y, width: 196, height: 84, rx: 13, class: 's-' + m.c + ' fr', 'stroke-width': 2 }),
            s('text', { x: m.x + 98, y: m.y + 26, 'text-anchor': 'middle', 'font-size': 16.5, 'font-weight': 800 }, m.n));
          const ws = m.chips.map((t) => 14 + t.length * 8), tot = ws.reduce((p, w) => p + w, 0) + (ws.length - 1) * 6;
          let x = m.x + 98 - tot / 2;
          chipEls[i] = m.chips.map((t, k) => {
            const r = s('rect', { x, y: m.y + 44, width: ws[k], height: 26, rx: 13, class: 's-panel chipr', 'stroke-width': 1.5 });
            g.append(r, s('text', { x: x + ws[k] / 2, y: m.y + 62, 'text-anchor': 'middle', class: 'chiptx s-monot' }, t));
            x += ws[k] + 6;
            return r;
          });
          modEls[i] = g;
          svg.append(g);
        });
        const coreG = s('g', { class: 'hot mod', tabindex: 0, role: 'button', 'aria-label': 'core' },
          s('circle', { cx, cy, r: R, class: 's-os fr', 'stroke-width': 2.5 }),
          s('text', { x: cx, y: cy - 30, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, style: 'fill:var(--os)' }, 'Common'),
          s('text', { x: cx, y: cy - 10, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, style: 'fill:var(--os)' }, 'facilities'),
          s('text', { x: cx, y: cy + 14, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'system calls · processes'),
          s('text', { x: cx, y: cy + 32, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'interrupts · locks'),
          s('text', { x: cx, y: cy + 50, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'kernel memory'));
        svg.append(coreG,
          s('text', { x: 108, y: 13, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'RUNNING PROGRAMS'),
          s('text', { x: 532, y: 13, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'FILES AND I/O'));
        const REQ = [
          { t: 'A shell starts a program whose file begins with an ELF header.', m: 0, k: 2, why: 'exec offers the file to each loader in the exec switch. The ELF loader recognizes the header and builds the new memory image.' },
          { t: 'A program opens a file stored on a server across the network.', m: 3, k: 0, why: 'The path crosses into an NFS mount, so the file\'s vnode points to NFS\'s operations. The system call code never learns the file is remote.' },
          { t: 'A program touches a page of its heap for the very first time.', m: 1, k: 2, why: 'The heap is an anonymous mapping. Its handler in the VM framework supplies a fresh page filled with zeros.' },
          { t: 'The kernel must write block 7,204 to the second disk.', m: 4, k: 0, why: 'The device\'s major number picks the disk driver\'s row in the block device switch; the minor number says which disk.' },
          { t: 'The page-out daemon, a kernel process, wakes up and needs a processor.', m: 2, k: 1, why: 'Kernel processes belong to the system scheduling class, whose fixed priorities outrank all time-sharing work.' },
          { t: 'Someone presses a key on a terminal.', m: 5, k: 1, why: 'The character enters through the terminal driver at the bottom of a stream and flows up through a line-editing module to the program.' },
          { t: 'A program maps a whole file into memory and reads it like an array.', m: 1, k: 0, why: 'That is a file mapping. On each first touch the VM framework asks the file\'s vnode to fetch the page from the file.' },
          { t: 'A text editor has used up its time slice and must let others run.', m: 2, k: 0, why: 'Ordinary processes are in the time-sharing class, which lowers the priority of a process that keeps using its whole slice.' },
          { t: 'A packet for an open connection arrives from the network card.', m: 5, k: 0, why: 'The network driver sits at the bottom of a stream; protocol modules above it pass the data up to the program.' },
        ];
        const panel = h('div', { class: 'stack grow route-panel', style: { gap: '10px' } });
        let mode = 'explore', qi = 0, tries = 0, score = 0, solved = false;
        const fb = h('div', { class: 'fb' });
        const scoreChip = h('span', { class: 'chip ok' });
        const nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => { if (qi >= REQ.length - 1) return summary(); qi++; routeShow(); } }, 'Next request');
        const againBtn = h('button', { class: 'btn', type: 'button', onclick: () => startRoute() }, 'Start over');
        const allG = () => modEls.concat([coreG]);
        function clearMarks() {
          allG().forEach((g) => g.classList.remove('sel', 'good', 'wrong'));
          chipEls.flat().forEach((r) => r.classList.remove('lit'));
          svg.classList.remove('dimmer');
        }
        function intro() {
          clearMarks();
          panel.replaceChildren(h('div', { class: 'info' },
            h('h3', 'A small core with six sockets'),
            h('p', { html: 'A modern UNIX kernel keeps a small core of <b>common facilities</b>. Around it sit six interfaces. Each one is a place where many different implementations can plug in: the chips inside each box.' }),
            h('p', { html: 'The left side is about <b>running programs</b> (loading them, giving them memory, choosing who runs). The right side is about <b>files and I/O</b>.' }),
            h('p', { html: 'The modules are still part of the kernel: they run in kernel mode and call the core directly. That makes this a <b>modular</b> kernel, not a microkernel: a microkernel would move such services out of the kernel into separate server processes running in <span class="t">user mode</span>.' }),
            h('div', { class: 'callout tip m0', 'data-label': 'Try it', html: 'Click any box, or the core, to see what it does and what plugs into it. Then switch to <b>Route a request</b> and play the kernel.' })));
        }
        function explore(i) {
          clearMarks();
          (i === 6 ? coreG : modEls[i]).classList.add('sel');
          svg.classList.add('dimmer');
          const m = i === 6 ? CORE : M[i];
          panel.replaceChildren(h('div', { class: 'info' },
            h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'chip ' + m.c }, i === 6 ? 'the core' : 'plug-in point'), h('h3', { class: 'm0' }, m.n)),
            h('p', { html: m.what }),
            m.chips ? h('div', { class: 'plug' }, m.chips.map((c, k) => [h('span', { class: 'chip mono ' + m.c }, c), h('span', { html: m.plug[k] })])) : null,
            h('div', { class: 'eg', html: '<b>Example.</b> ' + m.eg })));
          ctx.refit();
        }
        function paintScore() { scoreChip.textContent = `First-try right: ${score}`; }
        function routeShow() {
          clearMarks(); tries = 0; solved = false;
          fb.innerHTML = '<span class="muted">Click the part of the kernel that handles this request.</span>';
          nextBtn.disabled = true;
          nextBtn.textContent = qi >= REQ.length - 1 ? 'See my score' : 'Next request';
          paintScore();
          panel.replaceChildren(
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', `Request ${qi + 1} of ${REQ.length}`), scoreChip),
            h('div', { class: 'req', html: REQ[qi].t }), fb, h('div', { class: 'row' }, nextBtn, againBtn),
            h('div', { class: 'route-hint' }, ctx.ui.reveal('Need a hint?', h('div', { class: 'kv mt' }, M.map((m) => [h('b', m.n), h('span', m.role)])), { hideLabel: 'Hide hint' })),
            h('div', { class: 'callout why m0 route-how', style: { marginTop: 'auto' }, 'data-label': 'How the kernel routes', html: 'Every request enters the core first, through a system call, a page fault or an interrupt. The core then looks in the right <span class="t">switch table</span> and calls whatever implementation is plugged in there.' }));
        }
        function startRoute() { qi = 0; score = 0; routeShow(); }
        function summary() {
          clearMarks();
          const msg = score >= 8 ? 'Excellent: you think like the kernel.' : score >= 5 ? 'Good. Revisit the ones you missed in Explore mode.' : 'Switch to Explore, read each box, then try again.';
          panel.replaceChildren(h('div', { class: 'info' },
            h('h3', 'All requests routed'),
            h('div', { class: 'big' }, `${score} / ${REQ.length}`),
            h('p', { html: `right on the first try. ${msg}` }),
            h('div', { class: 'eg', html: '<b>Pattern.</b> Every request reached the right code through an interface, and the core never needed to know which implementation was on the other side.' }),
            h('div', { class: 'row' }, againBtn)));
        }
        function routeClick(i) {
          if (solved) return;
          const r = REQ[qi];
          if (i === r.m) {
            solved = true;
            if (tries === 0) score++;
            modEls[i].classList.add('good');
            chipEls[i][r.k].classList.add('lit');
            fb.innerHTML = `<div class="verdict ok-t">${tries === 0 ? 'Right, first try.' : 'Right.'}</div>${r.why}`;
            nextBtn.disabled = false;
            paintScore();
          } else {
            tries++;
            const g = i === 6 ? coreG : modEls[i], m = i === 6 ? CORE : M[i];
            g.classList.add('wrong');
            ctx.after(700, () => g.classList.remove('wrong'));
            fb.innerHTML = i === 6
              ? '<div class="verdict bad-t">Not the core.</div>Every request passes through the core, but the core only dispatches it. Which plug-in point holds the code that knows this particular kind of work?'
              : `<div class="verdict bad-t">Not that one.</div>The ${m.n} handles ${m.role}. What kind of thing does this request need?`;
          }
        }
        allG().forEach((g, i) => {
          const act = () => (mode === 'explore' ? explore(i) : routeClick(i));
          g.addEventListener('click', act);
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
        });
        const seg = ctx.ui.seg([{ value: 'explore', label: 'Explore the parts' }, { value: 'route', label: 'Route a request' }], 'explore', (v) => { mode = v; if (v === 'explore') intro(); else startRoute(); });
        el.append(h('div', { class: 'split r fill' },
          h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center', padding: '8px 10px' } }, svg),
          h('div', { class: 'stack' }, seg, panel)));
        intro();
      },
    },

    /* ---------------- 4. Lab: hot-swap a file system through vnode/vfs ---------------- */
    {
      title: 'Hot-swap lab: add a file system without touching the core',
      kind: 'lab',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h, s } = ctx;
        let loaded = false, mounted = false;
        const FS = [
          { n: 's5fs', at: '/', dev: 'disk 0' },
          { n: 'FFS', at: '/home', dev: 'disk 1' },
          { n: 'NFS', at: '/net/lab', dev: 'server "lab"' },
          { n: 'RFS', at: null, dev: null },
          { n: 'pcfs (FAT)', at: '/media/usb', dev: 'USB stick' },
        ];
        const fx = (i) => 20 + i * 124;
        const svg = s('svg', { viewBox: '0 0 640 300', width: '100%' });
        const ln = (x1, y1, x2, y2, act, dash) => s('line', { x1, y1, x2, y2, style: `stroke:var(${act ? '--chc' : '--line-2'})`, 'stroke-width': act ? 3.5 : 2, 'stroke-dasharray': dash ? '5 4' : null });
        const tx = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 14 }, o), t);
        function draw(p = {}) {
          const hl = p.fs != null || p.bad === 'vfs';
          const kids = [ln(320, 44, 320, 62, hl), ln(320, 100, 320, 118, hl)];
          FS.forEach((f, i) => {
            const x = fx(i) + 54, live = i < 4 || loaded, mnt = i === 4 ? mounted : !!f.at;
            kids.push(ln(320, 156, x, 184, p.fs === i, !live));
            if (f.dev) kids.push(ln(x, 228, x, 252, p.fs === i && (i !== 4 || mounted), !mnt));
          });
          kids.push(
            s('rect', { x: 160, y: 6, width: 320, height: 38, rx: 10, class: 's-proc', 'stroke-width': hl ? 3 : 2 }), tx(320, 30, 'program: open(path), then read(fd)', { 'font-weight': 700 }),
            s('rect', { x: 100, y: 62, width: 440, height: 38, rx: 10, class: 's-os', 'stroke-width': hl ? 3 : 2 }), tx(320, 86, 'system calls: open · read · write · close'),
            s('rect', { x: 100, y: 118, width: 440, height: 38, rx: 10, class: p.bad === 'vfs' ? 's-bad' : 's-os', 'stroke-width': hl ? 3 : 2 }), tx(320, 142, 'VFS layer: file-system types · mount table · vnodes'),
            s('path', { d: 'M92 64 H84 V154 H92', class: 's-line' }),
            s('text', { x: 72, y: 109, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, transform: 'rotate(-90 72 109)', style: 'fill:var(--os)' }, 'CORE'));
          FS.forEach((f, i) => {
            const x = fx(i), empty = i === 4 && !loaded, act = p.fs === i;
            const cls = empty ? 's-panel' : act ? (p.bad ? 's-bad' : 's-ok') : 's-accent';
            const sub = i === 4 ? (mounted ? 'at /media/usb' : loaded ? 'loaded, not mounted' : 'no FAT code yet') : f.at ? 'at ' + f.at : 'not mounted';
            kids.push(s('rect', { x, y: 184, width: 108, height: 44, rx: 10, class: cls, 'stroke-width': act ? 3 : 2, 'stroke-dasharray': empty ? '6 4' : null }),
              tx(x + 54, 202, empty ? 'empty slot' : f.n, { 'font-weight': 800, class: empty ? 's-sub' : null }),
              tx(x + 54, 220, sub, { 'font-size': 13, class: 's-sub' }));
            if (f.dev) kids.push(s('rect', { x: x + 6, y: 252, width: 96, height: 36, rx: 8, class: 's-io', 'stroke-width': p.fs === i && (i !== 4 || mounted) ? 3 : 1.5, opacity: i === 4 && !mounted ? 0.55 : 1 }), tx(x + 54, 275, f.dev, { 'font-size': 13.5 }));
            else kids.push(tx(x + 54, 275, 'no device', { 'font-size': 13, class: 's-sub' }));
          });
          svg.replaceChildren(...kids);
        }
        const log = h('div', { class: 'log lab-log' });
        const say = (lines) => { log.replaceChildren(...lines.map(([cls, html]) => h('div', { class: cls, html }))); };
        const typesV = h('div', { class: 'v' }), coreV = h('div', { class: 'v ok-t' }, '0');
        const tbody = h('tbody');
        function paintTable() {
          const rows = FS.filter((f, i) => f.at && (i < 4 || mounted));
          tbody.replaceChildren(...rows.map((f) => h('tr', { class: f.n.startsWith('pcfs') ? 'on' : null }, h('td', { class: 'mono' }, f.at), h('td', f.n.replace(' (FAT)', '')), h('td', f.dev))));
          typesV.textContent = loaded ? '5' : '4';
          bLoad.classList.toggle('done', loaded); bMount.classList.toggle('done', mounted);
        }
        const numBtn = (n, label, fn) => h('button', { class: 'btn', type: 'button', onclick: fn, html: `<span class="n">${n}</span>${label}` });
        const bLoad = numBtn(1, 'Load pcfs module', () => {
          if (loaded) { say([['note', 'pcfs is already loaded. Next: mount the stick.']]); return; }
          loaded = true; draw(); paintTable();
          say([['cmd', '$ modload pcfs'], ['', 'Kernel copies the pcfs code into kernel memory.'], ['', 'pcfs registers with VFS: type name "pcfs" + its vfs operations (mount, unmount, root, sync ...)'], ['', '... and its vnode operations (lookup, open, read, write, getattr ...).'], ['ok', 'Core code changed: 0 lines. VFS now knows 5 file-system types.']]);
        });
        const bMount = numBtn(2, 'Mount the stick', () => {
          if (!loaded) { draw({ bad: 'vfs' }); say([['cmd', '$ mount -F pcfs /dev/usb0 /media/usb'], ['', 'VFS searches its table of file-system types for "pcfs" ...'], ['bad', 'mount failed: unknown file system type "pcfs"'], ['note', 'The core has no FAT code of its own and never will. Load the module first (button 1).']]); return; }
          if (mounted) { say([['note', 'Already mounted at /media/usb. Now read /media/usb/photo.jpg.']]); return; }
          mounted = true; draw({ fs: 4 }); paintTable();
          say([['cmd', '$ mount -F pcfs /dev/usb0 /media/usb'], ['', 'VFS finds "pcfs" in its type table and calls pcfs\'s own mount operation.'], ['', 'pcfs reads the stick\'s FAT layout; VFS creates a vfs object for it and records /media/usb in the mount table.'], ['ok', 'Mounted. Core code changed: still 0 lines.']]);
        });
        const READS = [
          { p: '/home/ana/todo.txt', fs: 1 }, { p: '/net/lab/data.csv', fs: 2 }, { p: '/media/usb/photo.jpg', fs: 4 },
        ];
        function doRead(r) {
          const f = FS[r.fs], name = r.p.split('/').pop(), op = f.n.split(' ')[0].toLowerCase();
          const head = [['cmd', `fd = open("${r.p}"); read(fd, buf, n)`]];
          if (r.fs === 4 && !mounted) {
            draw({ fs: 0, bad: true });
            say(head.concat([['', 'open(): VFS walks the path / → media → usb. No file system is mounted at /media/usb,'], ['', 'so usb is just an empty folder on the root file system (s5fs on disk 0).'], ['bad', `open failed: ${name}: No such file or directory (read never runs)`], ['note', 'The stick is plugged in, but the kernel cannot read FAT yet. Load pcfs, then mount it.']]));
            return;
          }
          draw({ fs: r.fs });
          say(head.concat([['', `open(): VFS walks the path and crosses the mount point ${f.at} into the ${f.n.split(' ')[0]} file system.`], ['', `It gets the vnode for ${name}: v_op → ${op}_vnodeops, ${f.n.split(' ')[0]}'s table of operations. fd now refers to that vnode.`], ['', `read(fd): the kernel calls the vnode's read operation → ${op}_read() → ${f.dev}.`], ['ok', `Data returned. The system call code never knew which file system did the work.`]]));
        }
        const bReset = h('button', { class: 'btn ghost', type: 'button', onclick: () => { loaded = false; mounted = false; draw(); paintTable(); intro(); } }, 'Reset');
        function intro() { say([['note', 'Four file-system types are registered: s5fs, FFS, NFS and RFS. A FAT-formatted USB stick is plugged in.'], ['note', 'Try reading <b>/media/usb/photo.jpg</b> now, then load pcfs, mount the stick and read it again.']]); }
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack' },
            h('p', { class: 'm0', html: 'A USB stick formatted with FAT (a file-system layout from the PC world) arrives, and the kernel has no FAT code. Add support through the <span class="t">virtual file system (VFS)</span> interface without touching the core.' }),
            h('div', { class: 'card tight stack', style: { gap: '8px' } }, h('h4', 'Plug in the new file system'), h('div', { class: 'row' }, bLoad, bMount, bReset)),
            h('div', { class: 'card tight stack', style: { gap: '8px' } }, h('h4', 'Open and read a file'),
              h('div', { class: 'row', style: { gap: '8px' } }, READS.map((r) => h('button', { class: 'btn sm mono', type: 'button', onclick: () => doRead(r) }, r.p)))),
            h('table', { class: 'tbl compact' }, h('thead', h('tr', h('th', 'Mount point'), h('th', 'Type'), h('th', 'Stored on'))), tbody),
            h('div', { class: 'row', style: { gap: '28px' } },
              h('div', { class: 'stat' }, h('span', { class: 'xs' }, 'File-system types known'), typesV),
              h('div', { class: 'stat' }, h('span', { class: 'xs' }, 'Core lines changed'), coreV))),
          h('div', { class: 'stack' }, h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg), log)));
        draw(); paintTable(); intro();
      },
    },

    /* ---------------- 5. Learn: SVR4 merges the family ---------------- */
    {
      title: 'SVR4: AT&T and Sun put UNIX back together',
      kind: 'learn',
      render(el, ctx) {
        const { h, s } = ctx;
        const ANC = [
          { n: 'SVR3', sub: 'AT&T · commercial', t: 'SVR3 (AT&T, 1987): the System V trunk',
            b: 'AT&T\'s own commercial UNIX and the main line that SVR4 continued. It contributed <span class="t">STREAMS</span>, the modular framework for terminal and network I/O, and RFS, AT&T\'s Remote File Sharing.',
            eg: 'SVR4 kept System V\'s programming interfaces, so existing System V programs still ran.' },
          { n: '4.3BSD', sub: 'UC Berkeley · academic', t: '4.3BSD (UC Berkeley, 1986): the academic line',
            b: 'Berkeley\'s research-driven UNIX. It contributed TCP/IP networking with the <span class="t">socket</span> interface, the Fast File System (FFS), and user favourites such as the C shell and job control.',
            eg: 'With BSD features inside System V, customers no longer had to choose one family or the other.' },
          { n: 'Xenix System V', sub: 'Microsoft · commercial', t: 'Xenix System V (Microsoft): UNIX on the PC',
            b: 'Microsoft\'s UNIX for Intel-based personal computers, one of the most widely installed UNIX systems of the 1980s. SVR4 included compatibility so existing Xenix programs kept running on Intel machines.',
            eg: 'Bringing Xenix in meant the large base of PC UNIX users could move to SVR4.' },
          { n: 'SunOS', sub: 'Sun · commercial', t: 'SunOS (Sun Microsystems): the workstation line',
            b: 'Sun\'s BSD-based UNIX for its workstations. It contributed the vnode/vfs file-system interface, NFS, and a new virtual memory design built around mapping files into memory, plus shared libraries.',
            eg: 'Much of the modular kernel you explored in this section came to SVR4 from SunOS.' },
        ];
        const SVR4 = { t: 'System V Release 4 (1989): one UNIX again',
          b: '<span class="t">System V Release 4 (SVR4)</span> was developed jointly by AT&T and Sun Microsystems. It combined the four systems on the left and was an almost total rewrite of the System V kernel. It drew on commercial work (SVR3, Xenix, SunOS) and academic work (4.3BSD), and it was meant to be one uniform platform for commercial UNIX.',
          eg: 'Vendors ported it to everything from desktop machines with 32-bit microprocessors up to supercomputers. Click a feature on the right to see what was new.' };
        const FEAT = [
          { n: 'Real-time processing support', t: 'Real-time processing support',
            b: 'A real-time scheduling class whose processes get fixed priorities above every other class. A time-critical task, such as controlling a machine or playing audio, gets the processor within a short, predictable delay.',
            eg: 'Real-time processes outrank even the kernel\'s own system processes.' },
          { n: 'Process scheduling classes', t: 'Process scheduling classes',
            b: 'Scheduling is split into <span class="t">scheduling class</span>es, each with its own rules and its own band of priorities. SVR4 uses 160 priority levels: time-sharing 0 to 59, system 60 to 99 and real-time 100 to 159.',
            eg: 'The dispatcher simply runs the highest-priority ready process; each class decides how its own members\' priorities move.' },
          { n: 'Dynamically allocated data structures', t: 'Dynamically allocated data structures',
            b: 'Older kernels reserved fixed-size tables (for processes, open files and so on) when the kernel was built. A full table meant "no more processes" even with plenty of free memory, and a mostly empty table wasted memory. SVR4 allocates these structures as they are needed.',
            eg: 'The limit becomes the memory you actually have, not a number chosen when the kernel was compiled.' },
          { n: 'Virtual memory management', t: 'Virtual memory management',
            b: 'A new virtual memory system based on SunOS\'s design: each address space is a set of mappings of files, devices or anonymous memory, and programs can map files straight into memory.',
            eg: 'This is the virtual memory framework from the hub, with its file, device and anonymous mappings.' },
          { n: 'Virtual file system', t: 'Virtual file system',
            b: 'The vnode/vfs interface, so many file-system types (s5fs, FFS, NFS, RFS and more) work side by side behind the same system calls.',
            eg: 'Exactly what you used in the hot-swap lab to add pcfs without touching the core.' },
          { n: 'Preemptive kernel', t: 'Preemptive kernel',
            b: 'Earlier UNIX kernels ran a system call until it finished or blocked before switching to another process. SVR4 added preemption points: safe places inside long kernel paths where it checks for a more urgent process and, if one is waiting, switches to it right away.',
            eg: 'A <span class="t">preemptive kernel</span> keeps waiting times short, which real-time processes need.' },
        ];
        const det = h('div', { class: 'card det grow' });
        const svg = s('svg', { viewBox: '0 0 540 222', width: '100%' });
        const hot = [];
        function show(item, tag, cls) {
          det.replaceChildren(h('span', { class: 'chip ' + cls, style: { marginTop: '3px' } }, tag),
            h('div', {}, h('h3', item.t), h('p', { html: item.b }), h('div', { class: 'eg', html: item.eg })));
          ctx.refit();
        }
        function selAnc(i) { hot.forEach((g, k) => g.classList.toggle('sel', k === i)); svg.classList.add('dimmer'); tiles.forEach((b) => b.classList.remove('on')); i === 4 ? show(SVR4, 'the result', 'os') : show(ANC[i], 'ancestor', 'accent'); }
        ANC.forEach((a, i) => {
          const y = 6 + i * 54, ey = 87 + i * 16;
          svg.append(s('path', { d: `M208 ${y + 24} C 268 ${y + 24}, 272 ${ey}, 326 ${ey}`, class: 's-line', 'stroke-width': 2.2, 'marker-end': 'url(#arr-os)' }));
          const g = s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': a.n },
            s('rect', { x: 8, y, width: 200, height: 46, rx: 11, class: 's-accent fr', 'stroke-width': 2 }),
            s('text', { x: 20, y: y + 20, 'font-size': 16, 'font-weight': 800 }, a.n),
            s('text', { x: 20, y: y + 38, 'font-size': 13, class: 's-sub' }, a.sub));
          hot.push(g);
        });
        const g4 = s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': 'SVR4' },
          s('rect', { x: 332, y: 61, width: 200, height: 100, rx: 14, class: 's-os fr', 'stroke-width': 2.5 }),
          s('text', { x: 432, y: 97, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 900, style: 'fill:var(--os)' }, 'SVR4'),
          s('text', { x: 432, y: 121, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, '1989 · AT&T + Sun'),
          s('text', { x: 432, y: 141, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'kernel almost fully rewritten'));
        hot.push(g4);
        svg.append(...hot, s('text', { x: 432, y: 190, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'click any box'));
        hot.forEach((g, i) => { g.addEventListener('click', () => selAnc(i)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selAnc(i); } }); });
        const tiles = FEAT.map((f, i) => h('button', { class: 'ftile', type: 'button', onclick: () => {
          tiles.forEach((b, k) => b.classList.toggle('on', k === i)); hot.forEach((g) => g.classList.remove('sel')); svg.classList.remove('dimmer'); show(f, 'new in SVR4', 'os');
        } }, h('span', { class: 'n' }, String(i + 1)), h('span', f.n)));
        el.append(h('div', { class: 'stack fill' },
          h('p', { class: 'lead m0', html: 'In 1989, AT&T and Sun Microsystems pulled four major UNIX lines back into one system: <b>SVR4</b>.' }),
          h('div', { class: 'grid-2', style: { alignItems: 'stretch' } },
            h('div', { class: 'card white stack', style: { gap: '4px', padding: '10px 12px' } }, h('h4', 'Four systems went in'), svg),
            h('div', { class: 'card white stack', style: { gap: '8px', padding: '10px 12px' } }, h('h4', 'Six big features were new'), h('div', { class: 'ftiles' }, tiles))),
          det));
        hot[4].classList.add('sel'); show(SVR4, 'the result', 'os'); // start undimmed so all four ancestors read clearly
      },
    },

    /* ---------------- 6. Explore: the BSD line and the family tree ---------------- */
    {
      title: 'The BSD line and the UNIX family tree',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        const LANES = [['Apple', 34], ['Free BSDs', 116], ['Berkeley', 196], ['Bell Labs', 252], ['Sun, Oracle', 308], ['AT&T', 364], ['Microsoft', 416]];
        const N = {
          unix: { n: 'Research UNIX', yr: '1970 · Bell Labs', y: 252, x: 150, w: 128, p: [], t: 'Research UNIX (Bell Labs, from 1970)', b: 'Ken Thompson and Dennis Ritchie\'s system at AT&T\'s Bell Labs, running on a PDP-7 by 1970 and rewritten in C in 1973 (section 2.8 covers it). Its licensed source code seeded every branch on this map.' },
          bsd3: { n: 'early BSD', yr: '1978–81', y: 196, x: 226, w: 80, p: ['unix'], t: 'Early BSD (UC Berkeley, 1978 to 1981)', b: 'Berkeley began shipping its own additions to AT&T\'s UNIX as the Berkeley Software Distribution in 1978. 3BSD (1979) added paged virtual memory on DEC VAX computers, so programs could be larger than physical memory, and 4.1BSD (1981) refined it. Sun\'s first SunOS was built from this code.' },
          bsd42: { n: '4.2BSD', yr: '1983', y: 196, x: 320, w: 76, p: ['bsd3'], t: '4.2BSD (1983)', b: 'Built TCP/IP networking into the kernel, together with the <span class="t">socket</span> interface that programs still use today, and introduced the Fast File System (FFS).' },
          bsd43: { n: '4.3BSD', yr: '1986', y: 196, x: 410, w: 76, p: ['bsd42'], t: '4.3BSD (1986)', b: 'A faster, polished 4.2BSD. It fed into SVR4 and, together with Mach, into NeXTSTEP.' },
          bsd44: { n: '4.4BSD', yr: '1993–94', y: 196, x: 512, w: 84, p: ['bsd43'], t: '4.4BSD (1993 to 1994): the last one', b: 'The final release of the <span class="t">Berkeley Software Distribution (BSD)</span>; the Berkeley research group closed in 1995. A version with all AT&T code removed, 4.4BSD-Lite (1994), became the common base of the free BSDs.' },
          free: { n: 'FreeBSD', yr: '1993', y: 92, x: 470, w: 80, p: ['bsd44'], t: 'FreeBSD (1993)', b: 'Started in 1993 from Berkeley\'s freely released code (by way of 386BSD, a port to Intel PCs) and rebuilt on 4.4BSD-Lite in 1994. Aims at performance and ease of use. Widely used in servers and network appliances, and a major source of the BSD code inside macOS.' },
          net: { n: 'NetBSD', yr: '1993', y: 140, x: 562, w: 76, p: ['bsd44'], t: 'NetBSD (1993)', b: 'Also started in 1993 from the freely released Berkeley code and rebuilt on 4.4BSD-Lite. Aims at portability: the same code runs on an unusually wide range of hardware, from large servers to small embedded boards.' },
          open: { n: 'OpenBSD', yr: '1996', y: 140, x: 650, w: 80, p: ['net'], t: 'OpenBSD (1996)', b: 'Split from NetBSD with a strong focus on security and carefully audited code. Its best-known export is OpenSSH, the secure remote-login tool.' },
          mach: { n: 'Mach', yr: '1985 · CMU', y: 34, x: 280, w: 96, p: [], t: 'Mach (Carnegie Mellon University, 1985)', b: 'A research kernel that became the best-known microkernel: a small kernel that handles tasks, threads, messages and virtual memory, leaving other services to run on top of it.' },
          next: { n: 'NeXTSTEP', yr: '1989', y: 34, x: 400, w: 88, p: ['mach', 'bsd43'], t: 'NeXTSTEP (1989)', b: 'The system on Steve Jobs\'s NeXT computers: Mach combined with 4.3BSD code. Apple agreed to buy NeXT at the end of 1996 and built its next operating system from it.' },
          mac: { n: 'macOS', yr: '2001 · Apple', y: 34, x: 620, w: 104, p: ['next', 'free'], t: 'macOS (from 2001, Apple)', b: 'First released as Mac OS X in 2001. Its open-source core, <span class="t">Darwin</span>, has a kernel that joins the Mach microkernel with a large layer of FreeBSD code. The same foundation runs iPhones and iPads.' },
          sunos: { n: 'SunOS', yr: '1982', y: 308, x: 262, w: 76, p: ['bsd3'], t: 'SunOS (1982)', b: 'Sun Microsystems\' UNIX for its workstations, first built from 4.1BSD code and later updated with 4.2BSD and 4.3BSD features. Home of NFS and the vnode/vfs interface, which it later brought into SVR4.' },
          sol2: { n: 'Solaris 2', yr: '1992', y: 308, x: 520, w: 84, p: ['svr4'], t: 'Solaris 2 (1992)', b: 'Sun moves from its BSD-based SunOS to an SVR4 base and calls the result Solaris. Its kernel is multithreaded, built for machines with many processors.' },
          sol11: { n: 'Solaris 11', yr: '2011 · Oracle', y: 308, x: 636, w: 104, p: ['sol2'], t: 'Solaris 11 (2011, Oracle)', b: 'Oracle bought Sun in 2010 and released Solaris 11 in 2011: an SVR4-based UNIX with a fully preemptable multithreaded kernel, full SMP support and an object-oriented file-system interface. The next step shows those features at work.' },
          sysv: { n: 'System V', yr: '1983', y: 364, x: 250, w: 84, p: ['unix'], t: 'System V (AT&T, 1983)', b: 'AT&T\'s commercial UNIX line, licensed to computer makers who built their own versions on it.' },
          svr3: { n: 'SVR3', yr: '1987', y: 364, x: 350, w: 70, p: ['sysv'], t: 'SVR3 (1987)', b: 'Added STREAMS and Remote File Sharing (RFS), among other features.' },
          svr4: { n: 'SVR4', yr: '1989', y: 364, x: 450, w: 80, p: ['svr3', 'bsd43', 'xenix', 'sunos'], t: 'SVR4 (1989)', b: 'AT&T and Sun merge SVR3, 4.3BSD, Xenix System V and SunOS into one system. Solaris descends directly from it.' },
          xenix: { n: 'Xenix', yr: '1980 · Microsoft', y: 416, x: 200, w: 118, p: ['unix'], t: 'Xenix (Microsoft, 1980)', b: 'Microsoft\'s licensed UNIX for small computers, later based on System V and widely installed on Intel PCs. It fed into SVR4.' },
        };
        // hand-routed edges [from, to, path]
        const E = [
          ['unix', 'bsd3', 'M190 232 L214 216'], ['unix', 'sysv', 'M172 272 L232 344'], ['unix', 'xenix', 'M130 272 L178 396'],
          ['bsd3', 'bsd42', 'M266 196 H282'], ['bsd42', 'bsd43', 'M358 196 H372'], ['bsd43', 'bsd44', 'M448 196 H470'],
          ['bsd3', 'sunos', 'M232 216 L256 288'], ['bsd43', 'svr4', 'M414 216 L444 344'], ['bsd43', 'next', 'M404 176 L400 54'],
          ['bsd44', 'free', 'M500 176 L478 112'], ['bsd44', 'net', 'M530 176 L550 160'], ['net', 'open', 'M600 140 H610'],
          ['mach', 'next', 'M328 34 H356'], ['next', 'mac', 'M444 34 H568'], ['free', 'mac', 'M506 76 L596 54'],
          ['sysv', 'svr3', 'M292 364 H315'], ['svr3', 'svr4', 'M385 364 H410'], ['sunos', 'svr4', 'M300 312 C 380 312, 410 322, 430 344'],
          ['xenix', 'svr4', 'M259 416 C 380 416, 440 410, 450 384'], ['svr4', 'sol2', 'M476 344 L508 328'], ['sol2', 'sol11', 'M562 308 H584'],
        ];
        const svg = s('svg', { viewBox: '0 0 700 440', width: '100%', class: 'tree' });
        LANES.forEach(([t, y]) => svg.append(s('text', { x: 8, y: y + 5, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, t)));
        const edgeEls = E.map(([a, b, d]) => { const p = s('path', { d, class: 'edge' }); svg.append(p); return { a, b, p }; });
        const nodeEls = {};
        Object.entries(N).forEach(([id, nd]) => {
          const g = s('g', { class: 'hot node' + (id === 'unix' ? ' root' : ''), tabindex: 0, role: 'button', 'aria-label': nd.n },
            s('rect', { x: nd.x - nd.w / 2, y: nd.y - 20, width: nd.w, height: 40, rx: 12, class: 'fr', 'stroke-width': 2 }),
            s('text', { x: nd.x, y: nd.y - 3, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800 }, nd.n),
            s('text', { x: nd.x, y: nd.y + 13, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, nd.yr));
          g.addEventListener('click', () => pick(id));
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); } });
          nodeEls[id] = g; svg.append(g);
        });
        const info = h('div', { class: 'info' });
        function ancestors(id, acc = new Set()) { acc.add(id); N[id].p.forEach((q) => ancestors(q, acc)); return acc; }
        function trace(id) {
          const set = id ? ancestors(id) : new Set();
          svg.classList.toggle('tracing', !!id);
          Object.entries(nodeEls).forEach(([k, g]) => g.classList.toggle('on', set.has(k)));
          edgeEls.forEach((e) => e.p.classList.toggle('on', set.has(e.a) && set.has(e.b)));
        }
        function pick(id, keepTrace) {
          Object.entries(nodeEls).forEach(([k, g]) => g.classList.toggle('sel', k === id));
          if (!keepTrace) { trace(null); traceBtns.forEach((b) => b.classList.remove('on')); }
          info.replaceChildren(h('h3', { html: N[id].t }), h('p', { html: N[id].b }), h('p', { class: 'small muted m0' }, 'Click any box on the tree to read its story.'));
          ctx.refit();
        }
        const TR = [['mac', 'macOS'], ['sol11', 'Solaris 11'], ['open', 'OpenBSD'], ['free', 'FreeBSD']];
        const traceBtns = TR.map(([id, label]) => h('button', { class: 'btn sm', type: 'button', onclick: () => {
          traceBtns.forEach((b) => b.classList.toggle('on', b === traceBtns[TR.findIndex((t) => t[0] === id)])); trace(id); pick(id, true);
        } }, label));
        el.append(h('div', { class: 'split gen fill' },
          h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center', padding: '8px 10px' } }, svg),
          h('div', { class: 'stack', style: { gap: '10px' } },
            h('div', { class: 'stack', style: { gap: '6px' } }, h('h4', 'Trace a family line'), h('div', { class: 'row', style: { gap: '6px' } }, traceBtns)),
            h('div', { class: 'card grow', style: { padding: '10px 14px' } }, info),
            h('div', { class: 'card tight', style: { borderLeft: '4px solid var(--accent)' } },
              h('h4', 'What BSD gave every UNIX'),
              h('div', { class: 'gift' },
                h('b', 'Virtual memory'), h('span', 'paging, from 3BSD (1979)'),
                h('b', 'Networking'), h('span', 'TCP/IP in the kernel plus the socket interface, 4.2BSD (1983)'),
                h('b', 'Fast File System'), h('span', 'FFS, 4.2BSD (1983)'),
                h('b', 'Lives on in'), h('span', 'FreeBSD, NetBSD, OpenBSD and macOS'))))));
        traceBtns[0].click();
      },
    },

    /* ---------------- 7. Explore: Solaris 11 on many CPUs ---------------- */
    {
      title: 'Solaris 11: a preemptable, multithreaded kernel on many CPUs',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        const LOCKN = { f: 'files', m: 'mem', n: 'net', s: 'sched' };
        // each CPU runs one thread: U = user work, K = kernel work needing a lock
        const SCR = [
          [['U', 1], ['K', 3, 'f'], ['U', 2], ['K', 2, 'm'], ['U', 2]],
          [['K', 2, 'm'], ['U', 2], ['K', 2, 'n'], ['U', 3]],
          [['U', 2], ['K', 2, 'n'], ['U', 1], ['K', 3, 'f'], ['U', 1]],
          [['K', 2, 's'], ['U', 2], ['K', 2, 'f'], ['U', 2]],
        ];
        function simLocks(big, T) {
          const pos = SCR.map(() => ({ seg: 0, done: 0 })), holder = {}, since = {}, grid = SCR.map(() => []);
          let waits = 0; const fin = SCR.map(() => T);
          for (let t = 0; t < T; t++) {
            const want = [];
            SCR.forEach((sc, c) => { const g = sc[pos[c].seg]; if (g && g[0] === 'K') { const L = big ? 'G' : g[2]; if (holder[L] !== c) want.push([c, L]); } });
            want.sort((x, y) => (since[x[0]] ?? t) - (since[y[0]] ?? t) || x[0] - y[0]);
            want.forEach(([c, L]) => { if (holder[L] == null) { holder[L] = c; delete since[c]; } });
            SCR.forEach((sc, c) => {
              const P = pos[c], g = sc[P.seg];
              if (!g) { grid[c].push('-'); return; }
              if (g[0] === 'K' && holder[big ? 'G' : g[2]] !== c) { grid[c].push('W'); waits++; if (since[c] == null) since[c] = t; return; }
              grid[c].push(g[0] === 'K' ? 'K' + g[2] : 'U');
              if (++P.done >= g[1]) { if (g[0] === 'K') delete holder[big ? 'G' : g[2]]; P.seg++; P.done = 0; if (!sc[P.seg]) fin[c] = t + 1; }
            });
          }
          return { grid, waits, last: Math.max(...fin) };
        }
        // draw rows of tick states as merged blocks
        function gantt(svg, rows, labels, T, cw, style) {
          const kids = [];
          rows.forEach((row, r) => {
            const y = 4 + r * 30;
            kids.push(s('text', { x: 0, y: y + 18, 'font-weight': 700 }, labels[r]));
            let t = 0;
            while (t < T) {
              let k = t; while (k + 1 < T && row[k + 1] === row[t]) k++;
              const st = style(row[t]);
              if (st) {
                const w = (k - t + 1) * cw - 3;
                kids.push(s('rect', { x: 58 + t * cw, y, width: w, height: 26, rx: 6, class: st.cls, 'stroke-width': 1.5 }));
                if (st.label && w >= st.label.length * 6.6 + 4) kids.push(s('text', { x: 58 + t * cw + w / 2, y: y + 18, 'text-anchor': 'middle', 'font-weight': 700, style: st.color || null }, st.label));
              }
              t = k + 1;
            }
          });
          const ay = 4 + rows.length * 30 + 12;
          for (let t = 0; t <= T; t += 2) kids.push(s('text', { x: 58 + t * cw, y: ay, 'text-anchor': 'middle', class: 's-sub' }, String(t)));
          svg.replaceChildren(...kids);
        }
        // --- sim A: many CPUs in the kernel at once
        const TA = 20, cwA = 28;
        const svgA = s('svg', { viewBox: `0 0 ${58 + TA * cwA + 12} 140`, width: '100%', class: 'gantt' });
        const lostA = h('div', { class: 'v' }), lastA = h('div', { class: 'v' });
        const capA = h('div', { class: 'simcap', style: { flex: '1 1 260px' } });
        function runA(mode) {
          const big = mode === 'big', r = simLocks(big, TA);
          gantt(svgA, r.grid, ['CPU 0', 'CPU 1', 'CPU 2', 'CPU 3'], TA, cwA, (x) => x === 'U' ? { cls: 's-proc', label: 'user' } : x === 'W' ? { cls: 's-bad', label: 'wait', color: 'fill:var(--bad)' } : x[0] === 'K' ? { cls: 's-os', label: big ? 'kernel' : LOCKN[x[1]] } : null);
          lostA.textContent = r.waits; lostA.className = 'v ' + (r.waits > 5 ? 'bad-t' : 'ok-t');
          lastA.textContent = 'tick ' + r.last;
          capA.innerHTML = big
            ? 'One lock guards the whole kernel, so only <b>one CPU at a time</b> runs kernel code. The others sit idle (red) even when they need different data, so the work takes almost twice as long.'
            : 'Each kernel data structure has its own lock, so CPUs run kernel code <b>in parallel</b> unless they need the same data. CPU 2 waits once (tick 5) for CPU 3 to free the files lock.';
        }
        const segA = ctx.ui.seg([{ value: 'big', label: 'One big kernel lock' }, { value: 'fine', label: 'Fine-grained locks (Solaris)' }], 'fine', runA);
        // --- sim B: an urgent thread wakes on CPU 0
        const TB = 14, cwB = 40;
        const svgB = s('svg', { viewBox: `0 0 ${58 + TB * cwB + 12} 96`, width: '100%', class: 'gantt' });
        const waitB = h('div', { class: 'v' }), capB = h('div', { class: 'simcap', style: { flex: '1 1 260px' } });
        const PLAN = { none: 8, points: 4, full: 2 }; // tick at which the urgent thread R starts (it wakes at tick 2)
        function runB(mode) {
          const start = PLAN[mode], cpu = [], rrow = [];
          let k = 0; // T1: 1 user tick, 7 kernel ticks, 4 user ticks; R: 2 ticks of work
          const t1 = ['U'].concat(Array(7).fill('K'), Array(4).fill('U'));
          for (let t = 0; t < TB; t++) {
            if (t >= start && t < start + 2) { cpu.push('R'); rrow.push('X'); }
            else { cpu.push(t1[k++] || '-'); rrow.push(t >= 2 && t < start ? 'W' : '-'); }
          }
          gantt(svgB, [cpu, rrow], ['CPU 0', 'thread R'], TB, cwB, (x) => x === 'U' ? { cls: 's-proc', label: 'T1 user' } : x === 'K' ? { cls: 's-os', label: 'T1 in kernel' } : x === 'R' ? { cls: 's-warn', label: 'R', color: 'fill:var(--warn)' } : x === 'X' ? { cls: 's-warn', label: 'R runs', color: 'fill:var(--warn)' } : x === 'W' ? { cls: 's-bad', label: 'R waits', color: 'fill:var(--bad)' } : null);
          svgB.prepend(s('line', { x1: 58 + 2 * cwB - 2, y1: 0, x2: 58 + 2 * cwB - 2, y2: 64, style: 'stroke:var(--warn)', 'stroke-width': 2.5, 'stroke-dasharray': '4 3' }));
          svgB.append(s('text', { x: 58 + 2 * cwB - 2, y: 93, 'text-anchor': 'middle', 'font-weight': 800, style: 'fill:var(--warn)' }, '↑ R wakes'));
          const wt = start - 2;
          waitB.textContent = wt + (wt === 1 ? ' tick' : ' ticks'); waitB.className = 'v ' + (wt > 3 ? 'bad-t' : wt > 0 ? 'warn-t' : 'ok-t');
          capB.innerHTML = {
            none: 'R wakes at tick 2 (dashed line), but the kernel finishes T1\'s whole system call first.',
            points: 'SVR4 style: at the next <b>preemption point</b>, after 3 ticks of kernel work, it switches to R.',
            full: 'Solaris style: R takes CPU 0 <b>at once</b>, even mid-way through T1\'s kernel code.',
          }[mode] + ' T1 still finishes at tick 14.';
        }
        const segB = ctx.ui.seg([{ value: 'none', label: 'No preemption' }, { value: 'points', label: 'Preemption points' }, { value: 'full', label: 'Fully preemptable' }], 'full', runB);
        const feat = (n, t, p) => h('div', { class: 'card tight feat' }, h('span', { class: 'n' }, String(n)), h('div', {}, h('b', { html: t }), h('p', { html: p })));
        el.append(h('div', { class: 'split l fill' },
          h('div', { class: 'stack', style: { gap: '8px' } },
            h('p', { class: 'm0', html: '<b>Solaris 11</b> (2011) is Oracle\'s release of Sun\'s SVR4-based UNIX, a leading commercial UNIX. Three features stand out.' }),
            feat(1, 'Fully <span class="t" data-t="preemptive kernel">preemptable</span>, <span class="t">multithreaded kernel</span>', 'Kernel work, even interrupt handling, runs as kernel <span class="t">thread</span>s. An urgent thread can take the CPU almost anywhere in kernel code, not just at chosen points.'),
            feat(2, 'Full <span class="t">SMP</span> support', 'All processors are equal peers. Many run kernel code at once, each holding only the small locks it needs (a lock is held by one CPU at a time).'),
            feat(3, 'Object-oriented file-system interface', 'vnode/vfs: every file system supplies the same set of operations, like classes implementing one interface (as pcfs did in the lab).'),
            h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Preemption does not shrink the total work (each switch even costs a little). It changes the order, so urgent work goes first.' })),
          h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'legend xs', style: { alignItems: 'center' } }, h('b', 'Key:'), h('span', { class: 'chip proc' }, 'user code'), h('span', { class: 'chip os' }, 'kernel code (label = lock it holds)'), h('span', { class: 'chip bad' }, 'waiting'), h('span', { class: 'chip warn' }, 'urgent thread R')),
            h('div', { class: 'card white simcard' },
              h('div', { class: 'hdr' }, h('h4', { class: 'm0' }, 'Four CPUs, one kernel'), segA), svgA,
              h('div', { class: 'row', style: { gap: '18px', alignItems: 'flex-start' } },
                h('div', { class: 'stat', style: { minWidth: '92px' } }, h('span', { class: 'xs' }, 'Ticks waiting'), lostA),
                h('div', { class: 'stat', style: { minWidth: '92px' } }, h('span', { class: 'xs' }, 'Finished'), lastA), capA)),
            h('div', { class: 'card white simcard' },
              h('div', { class: 'hdr' }, h('h4', { class: 'm0' }, 'Urgent thread R wakes'), segB), svgB,
              h('div', { class: 'row', style: { gap: '18px', alignItems: 'flex-start' } },
                h('div', { class: 'stat', style: { minWidth: '92px' } }, h('span', { class: 'xs' }, 'R waited'), waitB), capB)))));
        runA('fine'); runB('full');
      },
    },

    /* ---------------- 8. Recap ---------------- */
    {
      title: 'Recap: modern UNIX on one page',
      kind: 'recap',
      render(el, ctx) {
        const { h } = ctx;
        el.append(h('div', { class: 'stack fill' },
          h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
          ctx.ui.flipcards([
            ['Why was the UNIX kernel rebuilt?', 'Many versions had each edited one big kernel in their own way. A small core of common facilities with fixed plug-in interfaces lets new parts be added without rewriting the core.'],
            ['Name the six plug-in points', 'exec switch · virtual memory framework · vnode/vfs interface · block device switch · scheduler framework · STREAMS'],
            ['What plugs in where?', 'a.out, COFF, ELF → exec switch<br>file, device, anonymous mappings → VM<br>NFS, FFS, s5fs, RFS → vnode/vfs<br>disk, tape → block device switch<br>time-sharing, system → scheduler<br>network, tty → STREAMS'],
            ['SVR4 in one breath', '1989, AT&T + Sun. Merged SVR3, 4.3BSD, Xenix System V and SunOS on an almost totally rewritten kernel. New: real-time support, scheduling classes, dynamic data structures, virtual memory, virtual file system, preemptive kernel.'],
            ['What is BSD\'s legacy?', 'Paged virtual memory and TCP/IP with sockets (plus FFS). 4.4BSD was Berkeley\'s last release; the code lives on in FreeBSD, NetBSD, OpenBSD and macOS (Mach + FreeBSD code).'],
            ['Solaris 11 in three features', 'Oracle\'s SVR4-based UNIX (2011): a fully preemptable multithreaded kernel, full SMP support, and an object-oriented (vnode/vfs) file-system interface.'],
          ], { cols: 3, height: 196 }),
          h('div', { class: 'callout tip m0', 'data-label': 'Next', html: 'Section 2.10 turns to Linux, a UNIX-like kernel written from scratch that uses the same plug-in idea through loadable modules.' })));
      },
    },

    /* ---------------- 9. Check yourself ---------------- */
    {
      title: 'Check yourself: modern UNIX systems',
      kind: 'check',
      quiz: [
        { q: 'Why did UNIX designers move to a kernel with a small core and plug-in interfaces?',
          choices: ['Processors of the time were too slow to run one large, complex kernel', 'It let every file system and driver run as a separate user-mode process', 'Each version had patched one big kernel its own way, so features were hard to add', 'AT&T had stopped licensing the UNIX source code to other groups'],
          answer: 2,
          feedback: ['Speed was not the driver. The modular design is about structure; the modules still run inside the kernel.', 'That describes a microkernel. In a modern UNIX kernel the modules stay in the kernel, in kernel mode, and connect through fixed interfaces.', null, 'The opposite: wide licensing is what produced so many different versions.'],
          why: 'Vendors and universities had patched the same monolithic code in different ways. A small core with clean interfaces lets new file systems, formats, drivers and policies plug in without rewriting the core.' },
        { type: 'match', q: 'Match each part of a modern UNIX kernel with what plugs into it.',
          pairs: [['exec switch', 'a.out, COFF and ELF loaders'], ['Virtual memory framework', 'File, device and anonymous mappings'], ['vnode/vfs interface', 'NFS, FFS, s5fs and RFS'], ['Block device switch', 'Disk and tape drivers'], ['Scheduler framework', 'Time-sharing and system classes'], ['STREAMS', 'Network and terminal (tty) drivers']],
          why: 'Each interface is a socket for one kind of variety: program formats, memory sources, file systems, block devices, scheduling policies and character streams.' },
        { type: 'bucket', q: 'Which system contributed each feature to SVR4?', buckets: ['4.3BSD', 'SunOS', 'SVR3'],
          items: [['TCP/IP networking with sockets', 0], ['Fast File System (FFS)', 0], ['Network File System (NFS)', 1], ['vnode/vfs file-system interface', 1], ['STREAMS', 2], ['Remote File Sharing (RFS)', 2]],
          why: 'Berkeley brought networking and FFS; Sun brought NFS, vnode/vfs and its virtual memory design; AT&T\'s SVR3 brought STREAMS and RFS.' },
        { type: 'multi', q: 'Which of these were major new features of SVR4?',
          choices: ['Real-time processing support', 'Process scheduling classes', 'Dynamically allocated kernel data structures', 'A preemptive kernel', 'Fixed-size kernel tables chosen when the kernel is built', 'Every device driver moved into user space'],
          answer: [0, 1, 2, 3],
          why: 'SVR4 also brought new virtual memory management and a virtual file system. It replaced fixed-size tables with dynamic allocation, and its drivers still ran inside the kernel.' },
        { q: 'Who developed System V Release 4 (SVR4)?',
          choices: ['UC Berkeley and Sun Microsystems', 'AT&T and Sun Microsystems', 'AT&T and Microsoft', 'AT&T and IBM'],
          answer: 1,
          feedback: ['Berkeley\'s 4.3BSD was an ingredient, but AT&T and Sun built SVR4.', null, 'Microsoft\'s Xenix System V was merged into SVR4, but Microsoft did not develop it.', 'IBM sold its own System V-based UNIX, AIX, and was not a partner in SVR4.'],
          why: 'AT&T and Sun built SVR4 together and released it in 1989.' },
        { type: 'tf', q: '4.4BSD was the final BSD release from the University of California, Berkeley.', answer: true,
          why: 'Berkeley\'s research group closed soon after; FreeBSD, NetBSD and OpenBSD carried the code forward.' },
        { q: 'Apple\'s macOS is built on Darwin. What does Darwin\'s kernel combine?',
          choices: ['The Linux kernel and code from NetBSD', 'The SVR4 kernel and Microsoft Xenix', 'The Solaris kernel and the Mach microkernel', 'The Mach microkernel and code from FreeBSD'],
          answer: 3,
          feedback: ['macOS does not use the Linux kernel, and its BSD code comes mainly from FreeBSD.', 'Those two were merged into SVR4, not into macOS.', 'Solaris descends from SVR4; macOS comes from the NeXTSTEP line, which joined Mach with BSD code.', null],
          why: 'Darwin joins the Mach microkernel from Carnegie Mellon with a large layer of FreeBSD code, a path that runs through NeXTSTEP.' },
        { type: 'multi', q: 'Which statements describe Solaris 11?',
          choices: ['It has a fully preemptable, multithreaded kernel', 'It fully supports symmetric multiprocessing (SMP)', 'It has an object-oriented interface to file systems', 'It is based on the BSD kernel rather than SVR4', 'It was released by Oracle', 'It runs on only one processor at a time'],
          answer: [0, 1, 2, 4],
          why: 'Solaris 11 (2011) is Oracle\'s SVR4-based UNIX with a fully preemptable multithreaded kernel, full SMP support and the vnode/vfs file-system interface.' },
        { type: 'num', q: 'On a single processor, a kernel that cannot be preempted starts a system call needing 8 ticks of kernel work, and the call never blocks. A real-time process wakes up 3 ticks after the call began. How many ticks does the real-time process wait before it can run?',
          answer: 5, tol: 0, unit: 'ticks',
          why: 'The call must run to completion: 8 − 3 = 5 more ticks. A fully preemptable kernel could switch to the real-time process almost at once.' },
        { type: 'num', q: 'Four CPUs each need 2 ticks of kernel work at the same moment, and one big lock guards the whole kernel. How many ticks pass until the last CPU finishes its kernel work?',
          answer: 8, tol: 0, unit: 'ticks',
          why: 'Only one CPU at a time may hold the lock: 4 × 2 = 8 ticks. With fine-grained locks on different data, all four could finish in 2.' },
        { type: 'order', q: 'A new file-system module is added to a running system, and a program then reads a file from it. Put the steps in order.',
          items: ['The module is loaded and registers its operations with the VFS layer', 'The device is mounted, creating a vfs object for that file system', 'The program opens the file and the VFS layer finds the file\'s vnode', 'The read goes through the vnode to the module\'s own read routine', 'The module fetches the data from its device'],
          why: 'Register, mount, look up the vnode, call through the vnode\'s operation table, then the module talks to its device. The core never changes.' },
        { type: 'tf', q: 'In a modern UNIX kernel, supporting a new executable file format means rewriting the exec system call.', answer: false,
          why: 'You add one loader to the exec switch. exec simply offers the file to each loader until one recognizes it.' },
      ],
    },
  ],

  notes: `
<h3>Why UNIX needed a new kernel design</h3>
<p>AT&T licensed the UNIX source widely, so many versions appeared: Berkeley's BSD (1978) and Microsoft's Xenix (1980), then System V, SunOS, Ultrix and HP-UX by the mid-1980s, and AIX and IRIX by 1989. Each group edited the kernel directly, so code moved between versions only with work and every feature made the kernel harder to change.</p>
<p>The answer was a <b>modular kernel</b>: a small core of <b>common facilities</b> (system-call entry, processes and threads, interrupts, locking, kernel memory) with modules that connect through fixed interfaces, like appliances in standard wall outlets. The usual mechanism is a <b>switch table</b>: one row of function pointers per implementation, which the core calls without knowing the details. The modules still run in kernel mode inside the kernel, so this is not a microkernel.</p>
<h3>Traditional versus modern kernel</h3>
<p>In a traditional kernel one change spreads: a new file system meant editing system calls, file handling, the buffer cache and the program loader; a new program format meant rewriting exec and memory management; real-time scheduling meant editing the scheduler, clock and sleep code. In a modern kernel each is one new module: NFS behind vnode/vfs, an ELF loader in the exec switch, a real-time class. Drivers were the exception: even early UNIX reached them through a switch table (the block device switch), and modern UNIX applied that trick everywhere. A change kept inside one module is smaller, safer and testable alone.</p>
<h3>The six plug-in points of a modern UNIX kernel</h3>
<table>
<tr><th>Interface</th><th>What it does</th><th>What plugs in</th></tr>
<tr><td>exec switch</td><td>Starts programs: exec offers the program file to each loader until one recognizes its header</td><td>a.out (original UNIX format), COFF (Common Object File Format, System V before SVR4), ELF (Executable and Linkable Format, from SVR4; standard today)</td></tr>
<tr><td>Virtual memory framework</td><td>An address space is a list of mappings; on a page fault the core calls the faulting mapping's own routine</td><td>File mappings (pages from a file, e.g. program code, mmap), device mappings (a window onto device memory such as a frame buffer), anonymous mappings (heap and stacks; start as zeros, go to swap)</td></tr>
<tr><td>vnode/vfs interface</td><td>Lets many file-system types coexist; system calls use vnodes, each pointing to its file system's operations; each mounted file system is a vfs object</td><td>NFS (Sun's network files), FFS (Berkeley Fast File System), s5fs (System V file system), RFS (AT&T Remote File Sharing)</td></tr>
<tr><td>Block device switch</td><td>Table indexed by major device number; the minor number picks the unit</td><td>Disk and tape drivers</td></tr>
<tr><td>Scheduler framework</td><td>The dispatcher runs the highest-priority ready process; each scheduling class sets its members' priorities</td><td>Time-sharing class (ordinary processes, priorities move with behaviour), system class (kernel processes, fixed higher priorities); SVR4 adds real-time</td></tr>
<tr><td>STREAMS</td><td>Character I/O as a chain: stream head, optional modules, driver; modules can be pushed and popped while open</td><td>Network drivers (with protocol modules above), tty (terminal) drivers</td></tr>
</table>
<p>Examples: an ELF program starts → exec switch; first touch of a heap page → VM (anonymous); a remote file → vnode/vfs (NFS); writing a disk block → block device switch; the page-out daemon wakes → scheduler (system class); a key press or network packet → STREAMS.</p>
<h3>Adding a file system without touching the core</h3>
<ol>
<li><b>Load</b> the module (e.g. pcfs for FAT USB sticks); it registers its type name, vfs operations and vnode operations with VFS.</li>
<li><b>Mount</b> the device: VFS calls the module's mount operation and creates a vfs object. Without step 1: "unknown file system type".</li>
<li><b>Open</b>: VFS walks the path across the mount point to the file's vnode (v_op points to the module's operations) and returns a descriptor for it. Without step 2 the path is an empty directory on the root file system, so open fails.</li>
<li><b>Read</b> (on the descriptor): the vnode's read operation (pcfs_read) fetches blocks from the device.</li>
</ol>
<p>Core code changed: zero lines. Every file system implements one common set of operations, an object-oriented design.</p>
<h3>System V Release 4 (SVR4)</h3>
<p>Released in 1989 by AT&T and Sun Microsystems: an almost total rewrite of the System V kernel that merged four systems, drawing on commercial work (SVR3, Xenix, SunOS) and academic work (4.3BSD). It aimed to be one uniform commercial UNIX for machines of every size.</p>
<table>
<tr><th>Ingredient</th><th>Main contributions</th></tr>
<tr><td>SVR3 (AT&T, 1987)</td><td>System V trunk and interfaces; STREAMS; RFS</td></tr>
<tr><td>4.3BSD (Berkeley, 1986)</td><td>TCP/IP with sockets; FFS; C shell, job control</td></tr>
<tr><td>Xenix System V (Microsoft)</td><td>UNIX on Intel PCs; Xenix programs kept running</td></tr>
<tr><td>SunOS (Sun)</td><td>vnode/vfs; NFS; file-mapping virtual memory; shared libraries</td></tr>
</table>
<h4>Six major new features</h4>
<ol>
<li><b>Real-time processing support:</b> a class with fixed priorities above all others.</li>
<li><b>Process scheduling classes:</b> 160 priorities; time-sharing 0 to 59, system 60 to 99, real-time 100 to 159.</li>
<li><b>Dynamically allocated data structures</b> instead of fixed-size tables set at build time (a full table blocks new processes despite free memory; an empty one wastes it).</li>
<li><b>Virtual memory management:</b> mappings of files, devices and anonymous memory.</li>
<li><b>Virtual file system:</b> vnode/vfs.</li>
<li><b>Preemptive kernel:</b> preemption points where a long kernel path can switch to a more urgent process.</li>
</ol>
<h3>BSD and its descendants</h3>
<p>The Berkeley Software Distribution began in 1978. 3BSD (1979) added paged virtual memory; 4.2BSD (1983) built TCP/IP into the kernel with the socket interface and introduced the Fast File System; 4.3BSD (1986) refined it; <b>4.4BSD</b> (1993 to 1994) was Berkeley's final release, and its AT&T-free version, 4.4BSD-Lite, became the base of the free BSDs:</p>
<ul>
<li><b>FreeBSD</b> (1993): performance and ease of use, widely used on servers; a major source of the BSD code in macOS.</li>
<li><b>NetBSD</b> (1993): portability to a very wide range of hardware.</li>
<li><b>OpenBSD</b> (1996): split from NetBSD; security and audited code (OpenSSH).</li>
<li><b>macOS:</b> built on <b>Darwin</b>, whose kernel combines the <b>Mach microkernel</b> (Carnegie Mellon) with FreeBSD code, by way of NeXTSTEP (Mach + 4.3BSD).</li>
</ul>
<p>SunOS was also BSD-based, which is how BSD ideas reached SVR4 and Solaris.</p>
<h3>Solaris 11</h3>
<p>Sun moved from SunOS to an SVR4 base with Solaris 2 (1992). Oracle bought Sun in 2010 and released Solaris 11 in 2011, a leading commercial UNIX. Features: a <b>fully preemptable, multithreaded kernel</b> (kernel work runs as threads and can be preempted almost anywhere); <b>full SMP support</b> (all processors are peers; many run kernel code at once, each holding only the small locks it needs); an <b>object-oriented file-system interface</b> (vnode/vfs).</p>
<h4>Worked examples</h4>
<p><b>Locks.</b> Four CPUs each need 2 ticks of kernel work at once. With one big kernel lock they take turns: 4 × 2 = 8 ticks. With per-structure locks on different data, all finish in 2.</p>
<p><b>Preemption.</b> T1 runs 1 user tick, a 7-tick system call, then 4 user ticks; urgent R wakes at tick 2. No preemption: R waits 6 ticks. Preemption points after 3 kernel ticks (SVR4): 2 ticks. Fully preemptable (Solaris): 0. T1 always finishes at tick 14: preemption changes the order of work, not its amount (apart from a little switching cost). Without preemption, wait = call length − time already spent (8 − 3 = 5).</p>`,
});
