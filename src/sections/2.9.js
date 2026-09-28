// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 2.9 — Modern Unix Systems
   Original teaching material. Built step by step. */
Guide.section({  // registers section 2.9 with the guide; everything inside this object describes the section's steps, notes and styles
  id: '2.9',  // id: the section number the guide uses to order it and to build links such as the table of contents
  title: 'Modern Unix Systems',  // title: the full heading shown at the top of the section's screens
  short: 'Modern UNIX',  // short: the brief name used in tight lists, such as the chapter overview
  summary: 'Why UNIX was rebuilt around a small modular core, and the SVR4, BSD and Solaris 11 systems built that way.',  // summary: the one-sentence description shown next to the section in the table of contents
  objectives: [  // objectives: the learning goals, printed under "You should be able to" in the printable version
    'Explain why the spread of many incompatible UNIX versions pushed designers toward a modular kernel: a small core of common facilities with clean interfaces where new parts plug in.',  // goal 1: explain why many incompatible UNIX versions led to the modular kernel design
    'Name the six plug-in points of a modern UNIX kernel (exec switch, virtual memory framework, vnode/vfs interface, block device switch, scheduler framework, STREAMS) and say what plugs into each.',  // goal 2: name the six plug-in points of a modern UNIX kernel and what plugs into each
    'Describe System V Release 4: who built it, the four systems it combined, and the six major features it introduced.',  // goal 3: describe System V Release 4, its builders, its four ingredients and its six new features
    'Trace the BSD line from 4.xBSD to FreeBSD, NetBSD, OpenBSD and macOS, and state BSD\'s lasting contributions.',  // goal 4: trace the BSD family line and name what BSD gave every later UNIX
    'Describe Solaris 11 and its key features: a fully preemptable multithreaded kernel, full SMP support and an object-oriented file-system interface.',  // goal 5: describe Solaris 11 and its three headline kernel features
  ],  // ends the objectives list
  terms: [  // terms: glossary entries as [term, definition] pairs; the guide adds them to the searchable glossary
    ['Modular kernel', 'A kernel organised as a small core of shared services plus separate modules that connect to the core through fixed, well-defined interfaces, so a module can be added or replaced without rewriting the core.'],  // glossary entry: defines a modular kernel (small core plus plug-in modules with fixed interfaces)
    ['Switch table', 'A table of pointers to functions with one row per implementation (one per device driver, per program file format, per file-system type). The core finds the right row and calls through it, so it never needs the details of any one implementation.'],  // glossary entry: defines a switch table, the table of function pointers the core calls through
    ['Exec switch', 'The switch table used when a process starts a new program (the exec system call). Each row is a loader for one executable file format, such as a.out, COFF or ELF, and the kernel uses the loader that recognizes the file.'],  // glossary entry: defines the exec switch, the table of program-file loaders used by exec
    ['Executable and Linkable Format (ELF)', 'The format for program and library files introduced with SVR4. It replaced the older a.out and COFF formats and is standard today on Linux, the BSDs and Solaris.'],  // glossary entry: defines ELF, the program file format introduced with SVR4
    ['Virtual memory framework', 'The part of a modern UNIX kernel that manages each process\'s address space as a set of mappings. Each kind of mapping (file, device or anonymous) supplies its own code for bringing its pages into memory.'],  // glossary entry: defines the virtual memory framework that treats an address space as mappings
    ['File mapping', 'A region of a process\'s address space whose contents come from a file. A page is read from the file the first time it is touched; program code is usually mapped this way.'],  // glossary entry: defines a file mapping, memory whose pages come from a file
    ['Anonymous mapping', 'A region of memory that is not backed by any named file, such as the heap or a stack. It starts out filled with zeros and, if it must leave main memory, it is written to swap space.'],  // glossary entry: defines an anonymous mapping, memory with no file behind it such as the heap
    ['Vnode', 'The kernel\'s in-memory object for one active file. It looks the same whatever file system the file lives on, and it points to that file system\'s table of operations (open, read, write, lookup and so on).'],  // glossary entry: defines a vnode, the kernel's file-system-neutral object for one active file
    ['Virtual file system (VFS)', 'The layer that lets many file-system types exist side by side behind one set of file system calls. Each mounted file system is represented by a vfs object and each active file by a vnode.'],  // glossary entry: defines the virtual file system layer that lets many file-system types coexist
    ['Network File System (NFS)', 'Sun\'s way of using files stored on another computer across a network as if they were on a local disk. Sun created the vnode/vfs interface so NFS and local file systems could work side by side.'],  // glossary entry: defines NFS, Sun's system for using files stored on another computer
    ['Block device switch', 'The kernel table, indexed by a device\'s major number, that holds the entry points of every block-device driver, such as disk and tape drivers. Together with its twin for character devices, it is one of the oldest switch tables in UNIX.'],  // glossary entry: defines the block device switch, the driver table indexed by major device number
    ['Scheduling class', 'A group of processes that share one scheduling policy and one band of priorities. SVR4 has a time-sharing class, a system class for kernel processes and a real-time class, each plugged into the scheduler framework.'],  // glossary entry: defines a scheduling class, a group of processes sharing one priority policy
    ['STREAMS', 'A framework for character I/O such as terminals and network connections. Data flows through a chain of modules between a process and a driver, and modules can be pushed onto or popped off the chain while it is in use.'],  // glossary entry: defines STREAMS, the chain-of-modules framework for character I/O
    ['System V Release 4 (SVR4)', 'The UNIX release of 1989, developed jointly by AT&T and Sun Microsystems. It merged SVR3, 4.3BSD, Microsoft Xenix System V and SunOS on an almost completely rewritten kernel.'],  // glossary entry: defines System V Release 4 (SVR4), the 1989 merged UNIX from AT&T and Sun
    ['Berkeley Software Distribution (BSD)', 'The versions of UNIX produced at the University of California, Berkeley, ending with 4.4BSD. BSD added paged virtual memory and TCP/IP networking with sockets, and its code lives on in FreeBSD, NetBSD, OpenBSD and macOS.'],  // glossary entry: defines BSD, the Berkeley line of UNIX and its lasting contributions
    ['Socket', 'The programming interface, introduced by BSD, through which a program opens a network connection and sends and receives data. It became the standard way programs use TCP/IP.'],  // glossary entry: defines a socket, the programming interface for network connections
    ['Preemptive kernel', 'A kernel that can take the processor away from a process even while that process is running kernel code, so an urgent process does not have to wait for a whole system call to finish.'],  // glossary entry: defines a preemptive kernel, one that can switch away even mid-system-call
    ['Multithreaded kernel', 'A kernel whose own work is carried out by many kernel threads that can run at the same time on different processors, each piece of shared kernel data protected by its own small lock rather than one lock for everything.'],  // glossary entry: defines a multithreaded kernel, whose own work runs as many parallel threads
    ['Symmetric multiprocessing (SMP)', 'A design in which two or more similar processors share main memory and devices, and any processor can run any work, including the kernel itself.'],  // glossary entry: defines symmetric multiprocessing (SMP), where equal processors share everything
    ['Darwin', 'The open-source core of Apple\'s macOS. Its kernel joins the Mach microkernel, developed at Carnegie Mellon University, with a large body of code taken from FreeBSD.'],  // glossary entry: defines Darwin, the open-source core of macOS built from Mach and FreeBSD code
  ],  // ends the glossary terms

  css: ` /* css: the style rules for this section only, written as one long text; the guide adds them to the page when it loads */
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width */
    .sec-2-9 .step-eyebrow { contain: inline-size; } /* stops the step's label line above the title from forcing the whole page wider on a phone-width screen */
    .sec-2-9 .hot { cursor: pointer; outline: none; } /* .hot marks clickable drawing parts: the pointer cursor shows they respond, and the default focus ring is hidden */
    .sec-2-9 .hot .fr { transition: stroke-width .15s, opacity .2s; } /* animates the outline thickness and fading of a clickable shape's frame (.fr) so changes look smooth */
    .sec-2-9 .hot:hover .fr, .sec-2-9 .hot:focus-visible .fr { stroke-width: 3.5; } /* thickens the frame when the mouse is over a clickable shape or the keyboard has focused it */
    .sec-2-9 .hot.sel .fr { stroke-width: 4; } /* a selected shape (.sel) gets the thickest frame so the current choice stands out */
    .sec-2-9 .dimmer .hot:not(.sel) { opacity: .45; } /* while a diagram is in "dimmer" mode, every clickable shape except the selected one fades back */
    .sec-2-9 .info { display: flex; flex-direction: column; gap: 8px; } /* .info: the explanation panel stacks its heading, paragraphs and example box in a column with small gaps */
    .sec-2-9 .info h3 { margin: 0; } /* removes the extra space browsers put around headings inside the explanation panel */
    .sec-2-9 .info p { font-size: 15.5px; line-height: 1.45; margin: 0; } /* sets a comfortable reading size and line spacing for the explanation paragraphs */
    .sec-2-9 .eg { font-size: 14.5px; line-height: 1.4; padding: 7px 11px; border-radius: 10px; background: var(--panel-3); border-left: 4px solid var(--chc); } /* .eg: the tinted "Example" box with a coloured bar on its left, in the chapter's colour */
    .sec-2-9 .eg b { color: var(--chc); } /* the bold label at the start of an example box takes the chapter colour too */
    .sec-2-9 .kv { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; font-size: 14.5px; line-height: 1.4; align-items: baseline; } /* .kv: a two-column grid of label and value pairs, used for the hint list of kernel parts */
    .sec-2-9 .kv b { white-space: nowrap; } /* keeps each bold label in a label/value grid on one line */
    .sec-2-9 .stat { display: flex; flex-direction: column; gap: 0; } /* .stat: a small number display with a caption above a large value, used for counters on several steps */
    .sec-2-9 .stat .xs { text-transform: uppercase; letter-spacing: .07em; font-weight: 800; color: var(--muted); } /* the caption of a stat is small, uppercase, spaced out and grey so the number below gets attention */
    .sec-2-9 .stat .v { font-size: 26px; font-weight: 800; line-height: 1.15; font-variant-numeric: tabular-nums; } /* the value of a stat is large and bold; tabular digits keep the width steady as the number changes */
    .sec-2-9 .ok-t { color: var(--ok); } .sec-2-9 .bad-t { color: var(--bad); } .sec-2-9 .warn-t { color: var(--warn); } /* three text colours: green for good results, red for bad ones, amber for warnings */

    /* step 1: one UNIX becomes many */
    .sec-2-9 .vgrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; } /* .vgrid: step 1's grid of UNIX versions, three equal columns */
    .sec-2-9 .vcell { border: 2px solid var(--line-2); border-radius: 10px; padding: 6px 10px; background: var(--panel); transition: opacity .3s, border-color .2s, background .2s; min-height: 66px; line-height: 1.3; } /* .vcell: one version's box in step 1; the transition fades it in and recolours it smoothly when the year changes */
    .sec-2-9 .vcell b { display: block; font-size: 15.5px; } /* the version's name sits on its own line in bold */
    .sec-2-9 .vcell .who { display: block; font-size: 13.5px; color: var(--ink-2); } /* the company that built the version, on its own line in a softer colour */
    .sec-2-9 .vcell .base { display: block; font-size: 12.5px; color: var(--muted); } /* where the version's code came from, on its own line in small grey text */
    .sec-2-9 .vcell.off { opacity: .16; border-style: dashed; } /* a version that does not exist yet in the chosen year is almost invisible with a dashed border */
    .sec-2-9 .vcell.new { border-color: var(--chc); box-shadow: 0 0 0 2px color-mix(in srgb, var(--chc) 25%, transparent); } /* a version that first appears in the chosen year gets a chapter-coloured border and a soft glow */
    .sec-2-9 .vcell.merge { border-color: var(--accent); background: var(--accent-bg); } /* in 1989, the versions that SVR4 merged are tinted with the accent colour */
    .sec-2-9 .svr4 { display: flex; align-items: center; gap: 12px; border: 2px solid var(--os); background: var(--os-bg); border-radius: 12px; padding: 8px 12px; font-size: 15px; line-height: 1.35; transition: opacity .3s; } /* .svr4: the SVR4 banner under the grid, a rounded strip in the operating-system colour */
    .sec-2-9 .svr4.off { opacity: .28; border-style: dashed; } /* before 1989 the SVR4 banner is faded with a dashed border because it does not exist yet */
    .sec-2-9 .svr4 .tag { font-weight: 900; font-size: 18px; color: var(--os); white-space: nowrap; } /* the large bold "SVR4" tag at the start of the banner */
    .sec-2-9 .era-cap { font-size: 15.5px; line-height: 1.45; min-height: 68px; } /* .era-cap: the caption that explains the chosen year; its minimum height stops the card jumping between years */

    /* step 2: tangle vs hub */
    .sec-2-9 .cmp-card { display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; } /* .cmp-card: each of the two side-by-side cards in step 2 stacks its heading, drawing and result lines */
    .sec-2-9 .cmp-card h4 { margin: 0; } /* removes the default heading margins inside a comparison card */
    .sec-2-9 .cmp-res { font-weight: 800; font-size: 15.5px; } /* .cmp-res: the bold result line under each drawing, such as the number of parts edited */
    .sec-2-9 .cmp-why { font-size: 14.5px; line-height: 1.4; color: var(--ink-2); min-height: 41px; } /* .cmp-why: the explanation under each result; a fixed minimum height keeps both cards level */
    .sec-2-9 .tangle path { fill: none; stroke: var(--line-2); stroke-width: 1.6; } /* .tangle: the curved lines between kernel parts in the traditional drawing, thin and grey with no fill */
    .sec-2-9 .badge text { font-size: 13px; font-weight: 800; fill: var(--panel); } /* .badge: the white bold text on the small "edit" or "+1 row" badges in the traditional drawing */

    /* step 3: the hub */
    .sec-2-9 .hub .chiptx { font-size: 13px; font-weight: 700; } /* .hub: in step 3's kernel map, the small labels inside each module's chips are bold */
    .sec-2-9 .hub .chipr.lit { fill: var(--ok-bg); stroke: var(--ok); stroke-width: 2.5; } /* a chip that is lit (the right answer in route mode) turns green with a thicker outline */
    .sec-2-9 .hub .mod.good .fr { fill: var(--ok-bg); stroke: var(--ok); stroke-width: 4; } /* a module clicked correctly in route mode gets a green fill and a heavy green frame */
    .sec-2-9 .hub .mod.wrong .fr { fill: var(--bad-bg); stroke: var(--bad); stroke-width: 4; } /* a module clicked wrongly in route mode flashes with a red fill and a heavy red frame */
    .sec-2-9 .plug { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 7px 10px; font-size: 14.5px; line-height: 1.38; align-items: start; } /* .plug: the grid in step 3's panel that lines up each chip with its explanation */
    .sec-2-9 .plug .chip { justify-self: start; } /* keeps each chip at its natural width at the left of its grid cell */
    .sec-2-9 .req { font-size: 18px; font-weight: 650; line-height: 1.4; padding: 12px 14px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); } /* .req: the large boxed request text the student must route in step 3, with a coloured bar at the left */
    .sec-2-9 .fb { font-size: 15px; line-height: 1.45; } /* .fb: the feedback text under a request, shown after each click */
    .sec-2-9 .fb .verdict { font-weight: 900; font-size: 17px; margin-bottom: 2px; } /* .verdict: the bold first line of feedback, such as "Right, first try." */
    .sec-2-9 .route-hint .kv { font-size: 14px; gap: 2px 10px; } /* makes the hint's label/value list a little smaller and tighter than the default */
    .sec-2-9 .route-panel:has(.reveal-body.on) .route-how { display: none; } /* once the hint is opened, the "How the kernel routes" box is hidden so the panel does not overflow */

    /* step 4: vnode/vfs hot-swap lab */
    .sec-2-9 .lab-log { flex: 1; font-size: 13.5px; } /* .lab-log: step 4's command log fills the space left under the drawing, in small text */
    .sec-2-9 .lab-log > div { border-bottom: 0; padding: 2px 0; } /* each log line gets a little padding and no dividing line */
    .sec-2-9 .lab-log .cmd { color: var(--chc); font-weight: 800; } /* log lines showing a typed command are bold and in the chapter colour */
    .sec-2-9 .lab-log .ok { color: var(--ok); font-weight: 700; } /* log lines reporting success are bold green */
    .sec-2-9 .lab-log .bad { color: var(--bad); font-weight: 700; } /* log lines reporting a failure are bold red */
    .sec-2-9 .lab-log .note { color: var(--ink-2); font-family: var(--font); font-size: 14px; } /* explanatory note lines in the log use the normal body font instead of the log's fixed-width font */
    .sec-2-9 .btn .n { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--chc); color: var(--panel); font-size: 12.5px; font-weight: 900; } /* .n inside a button: the small round number badge on step 4's "1" and "2" buttons */
    .sec-2-9 .btn.done { border-color: var(--ok); color: var(--ok); } /* a finished lab button (.done) turns its border and text green so the student sees that step is complete */
    .sec-2-9 .btn.done .n { background: var(--ok); } /* the number badge of a finished lab button turns green as well */

    /* step 5: SVR4 */
    .sec-2-9 .ftiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } /* .ftiles: step 5's six feature buttons, laid out in two equal columns */
    .sec-2-9 .ftile { display: flex; align-items: center; gap: 10px; text-align: left; padding: 8px 10px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); color: var(--ink); font-size: 15px; font-weight: 700; line-height: 1.25; cursor: pointer; min-height: 52px; } /* .ftile: one SVR4 feature button, a bordered card with its number badge and name side by side */
    .sec-2-9 .ftile:hover { border-color: var(--os); } /* hovering a feature button tints its border with the operating-system colour to show it is clickable */
    .sec-2-9 .ftile .n { flex: none; display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: var(--os-bg); color: var(--os); font-weight: 900; font-size: 14px; } /* the square number badge at the left of each feature button */
    .sec-2-9 .ftile.on { border-color: var(--os); background: var(--os-bg); } /* the chosen feature button (.on) keeps the operating-system border and a tinted background */
    .sec-2-9 .ftile.on .n { background: var(--os); color: var(--panel); } /* the chosen feature button's badge flips to a solid background with light text */
    .sec-2-9 .det { display: flex; gap: 16px; align-items: flex-start; min-height: 150px; } /* .det: step 5's detail card under the diagrams: a tag chip on the left, the text on the right */
    .sec-2-9 .det h3 { margin: 0 0 4px; } /* keeps a small gap under the detail card's heading */
    .sec-2-9 .det p { margin: 0 0 6px; font-size: 16px; line-height: 1.45; } /* sets the reading size and spacing of the detail card's paragraphs */

    /* step 6: family tree */
    .sec-2-9 .split.gen { grid-template-columns: minmax(0, 8fr) minmax(0, 4fr); gap: 18px; } /* .split.gen: step 6's two-column layout, giving the family tree two thirds of the width */
    .sec-2-9 .tree .edge { fill: none; stroke: var(--line-2); stroke-width: 2; transition: stroke .2s; } /* .edge: a line joining two boxes on the family tree, grey by default and smoothly recoloured */
    .sec-2-9 .tree .edge.on { stroke: var(--accent); stroke-width: 3.5; } /* an edge on the traced family line (.on) turns thicker and takes the accent colour */
    .sec-2-9 .tree .node .fr { fill: var(--panel-2); stroke: var(--line-2); } /* the default look of a family-tree box frame: pale fill, grey outline */
    .sec-2-9 .tree .node.root .fr { fill: var(--os-bg); stroke: var(--os); } /* the root box (Research UNIX) uses the operating-system colours to mark where every line starts */
    .sec-2-9 .tree .node.on .fr { fill: var(--accent-bg); stroke: var(--accent); stroke-width: 2.5; } /* a box on the traced family line (.on) is tinted with the accent colour */
    .sec-2-9 .tree .node.sel .fr { stroke: var(--chc); stroke-width: 4; } /* the box the student clicked (.sel) gets a heavy chapter-coloured outline */
    .sec-2-9 .tree.tracing .node:not(.on) { opacity: .45; } /* while a line is traced, boxes that are not on it fade back so the line stands out */
    .sec-2-9 .tree.tracing .edge:not(.on) { opacity: .4; } /* while a line is traced, edges that are not on it fade back as well */
    /* step 7: Solaris sims */
    .sec-2-9 .feat { display: flex; gap: 10px; align-items: flex-start; padding: 8px 12px; } /* .feat: one of step 7's three Solaris feature cards: a number badge beside its text */
    .sec-2-9 .feat .n { flex: none; display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: var(--os); color: var(--panel); font-weight: 900; font-size: 14px; margin-top: 1px; } /* the square number badge on each Solaris feature card */
    .sec-2-9 .feat p { margin: 0; font-size: 14.5px; line-height: 1.4; } /* sets the size of the feature card's description */
    .sec-2-9 .feat b { display: block; font-size: 16px; } /* the feature card's bold title sits on its own line above the description */
    .sec-2-9 .simcard { display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; } /* .simcard: each simulation card in step 7 stacks its header, chart and results in a column */
    .sec-2-9 .simcard .hdr { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; } /* a simulation card's header puts its title and mode buttons on one line, wrapping when space runs out */
    .sec-2-9 .simcard .seg button { font-size: 13.5px; padding: 4px 10px; } /* makes the mode buttons inside a simulation card a little smaller so they fit beside the title */
    .sec-2-9 .simcap { font-size: 14.5px; line-height: 1.4; color: var(--ink-2); } /* .simcap: the explanation under each simulation chart, in a softer colour */
    .sec-2-9 .gantt text { font-size: 13px; } /* sets the size of the tick numbers and block labels in both timing charts */
    .sec-2-9 .gift { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; font-size: 14.5px; line-height: 1.35; align-items: baseline; } /* .gift: step 6's "What BSD gave every UNIX" list, a two-column grid of bold labels and descriptions */
  `,  // ends the section's style text

  steps: [  // steps: the list of screens in this section, shown one at a time as the student clicks Next
    /* ---------------- 1. Big Picture: why UNIX needed a new kind of kernel ---------------- */
    {  // step 1 begins: the big-picture story of how one UNIX turned into many
      title: 'Too many UNIXes: why the kernel was rebuilt',  // the step's title, shown as the screen heading
      kind: 'story',  // kind "story" labels this screen as a Big Picture step
      render(el, ctx) {  // render(el, ctx): builds the screen into el when the step opens; ctx carries the guide's helpers
        const { h } = ctx;  // takes h, the helper that builds page elements, from ctx
        const V = [  // V: the sample of UNIX versions shown in the grid, each with its builder, code origin and first year
          { n: 'Research UNIX', who: 'AT&T Bell Labs', base: 'the original', era: 1975 },  // version: the original Bell Labs UNIX, present from the first year shown
          { n: 'BSD', who: 'UC Berkeley', base: 'from Bell Labs code', era: 1980, merge: true },  // version: Berkeley's BSD from 1980; merge: true marks it as one of the lines SVR4 combined
          { n: 'System V', who: 'AT&T', base: 'from Bell Labs code', era: 1985, merge: true },  // version: AT&T's System V from 1985, also merged into SVR4
          { n: 'Xenix', who: 'Microsoft', base: 'from AT&T code', era: 1980, merge: true },  // version: Microsoft's Xenix from 1980, also merged into SVR4
          { n: 'SunOS', who: 'Sun Microsystems', base: 'from BSD code', era: 1985, merge: true },  // version: Sun's SunOS from 1985, built from BSD and merged into SVR4
          { n: 'Ultrix', who: 'DEC', base: 'from BSD code', era: 1985 },  // version: DEC's Ultrix from 1985, built from BSD code
          { n: 'HP-UX', who: 'Hewlett-Packard', base: 'from AT&T code', era: 1985 },  // version: Hewlett-Packard's HP-UX from 1985, built from AT&T code
          { n: 'AIX', who: 'IBM', base: 'from AT&T code', era: 1989 },  // version: IBM's AIX, shown from 1989
          { n: 'IRIX', who: 'Silicon Graphics', base: 'from AT&T code', era: 1989 },  // version: Silicon Graphics' IRIX, shown from 1989
        ];  // ends the list of versions
        const CAP = {  // CAP: the caption for each year button, shown beside the version counter
          1975: '<b>1975.</b> One system: the UNIX that Bell Labs built. AT&T licenses its source code to universities for a small fee, so students can read and change a real operating system.',  // caption for 1975: a single UNIX whose source was licensed to universities
          1980: '<b>1980.</b> Berkeley now ships its own version, BSD, with paged virtual memory. Microsoft licenses AT&T\'s code to build Xenix for small computers.',  // caption for 1980: BSD and Xenix appear
          1985: '<b>1985.</b> AT&T sells System V, and computer makers build versions for their own hardware from AT&T\'s or Berkeley\'s code, each editing the kernel its own way.',  // caption for 1985: System V and many vendor versions, each editing the kernel differently
          1989: '<b>1989.</b> Still more versions. AT&T and Sun answer with <b>SVR4</b>, which merges four major lines on a kernel rebuilt around a small core with plug-in modules.',  // caption for 1989: even more versions, and AT&T and Sun answer with SVR4
        };  // ends the captions table
        const cells = V.map((v) => h('div', { class: 'vcell' }, h('b', v.n), h('span', { class: 'who' }, v.who), h('span', { class: 'base' }, v.base)));  // builds one grid box per version, holding its name, builder and code origin
        const banner = h('div', { class: 'svr4' },  // banner: the SVR4 strip shown under the grid
          h('span', { class: 'tag' }, 'SVR4'),  // the bold "SVR4" tag at the banner's left
          h('span', { html: '<b>1989 · AT&T + Sun.</b> Merges System V, BSD, Xenix and SunOS into one system on a rebuilt, modular kernel.' }));  // banner text: who built SVR4 and which four systems it merged
        const count = h('div', { class: 'v' });  // count: the large number showing how many versions exist in the chosen year
        const cap = h('div', { class: 'era-cap', style: { flex: '1 1 260px' } });  // cap: the box where the chosen year's caption appears; it may grow to fill the row
        function show(year) {  // show(year): repaints the grid, banner, counter and caption for the year the student picked
          V.forEach((v, i) => {  // goes through every version together with its position in the list
            const c = cells[i];  // c is the grid box drawn for this version
            c.classList.toggle('off', v.era > year);  // fades out a version that does not exist yet in the chosen year
            c.classList.toggle('new', v.era === year && year !== 1989);  // highlights a version that first appears in the chosen year (except 1989, which highlights merges instead)
            c.classList.toggle('merge', year === 1989 && !!v.merge);  // in 1989, tints the four versions that SVR4 merged
          });  // ends the loop over versions
          banner.classList.toggle('off', year < 1989);  // fades the SVR4 banner in every year before 1989
          count.textContent = V.filter((v) => v.era <= year).length;  // counts the versions that exist by the chosen year and shows that number
          cap.innerHTML = CAP[year];  // shows the chosen year's caption
        }  // ends show()
        const seg = ctx.ui.seg([1975, 1980, 1985, 1989].map((y) => ({ value: y, label: String(y) })), 1975, show);  // builds the row of year buttons; picking one calls show() with that year, starting at 1975
        const left = h('div', { class: 'stack' },  // left: the column of explanation text on the left of the screen
          h('p', { class: 'lead m0', html: 'By the late 1980s there was no single UNIX. There were many, and each company had changed the <span class="t">kernel</span> in its own way.' }),  // opening paragraph: by the late 1980s there were many different UNIX kernels
          h('p', { class: 'm0', html: 'AT&T licensed the UNIX source code widely (section 2.8 tells that story). Each group added features by editing the kernel itself, so code written for one version needed work to move to another, and every addition made the kernel harder to change.' }),  // paragraph: wide licensing and direct kernel edits made code hard to move between versions
          h('p', { class: 'm0', html: 'Designers answered with a new shape, the <span class="t">modular kernel</span>: a small core holds the services every part needs, and anything that comes in many varieties plugs into the core through a fixed interface.' }),  // paragraph: introduces the modular kernel, a small core with fixed plug-in points
          h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'The electrical outlets in a building. The wiring in the walls is the core. Any appliance with the standard plug just works, and a new toaster never means rewiring the house.' }));  // analogy box: wall outlets and appliances, standing for the core and its modules
        const right = h('div', { class: 'card white stack', style: { gap: '10px' } },  // right: the white card holding the interactive version grid
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'One UNIX becomes many'), seg),  // card header: the title "One UNIX becomes many" with the year buttons beside it
          h('div', { class: 'vgrid' }, cells),  // the grid of version boxes
          banner,  // the SVR4 banner goes directly under the grid
          h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '16px' } },  // a row holding the version counter and the year caption side by side
            h('div', { class: 'stat', style: { minWidth: '112px' } }, h('span', { class: 'xs' }, 'Versions'), count),  // the counter: a small "Versions" caption over the big number
            cap),  // the year caption fills the rest of the row
          h('p', { class: 'xs muted m0' }, 'Pick a year. Faded boxes do not exist yet. Only a sample of the many versions is shown.'),  // small instruction line: pick a year; faded boxes do not exist yet
          h('div', { class: 'small', style: { marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--line)' }, html: '<b>Coming up:</b> the six plug-in points of a modern UNIX kernel, a live hot-swap, then three systems built this way: SVR4, the BSD family and Solaris 11.' }));  // "Coming up" line at the bottom of the card, previewing the rest of the section
        el.append(h('div', { class: 'split l fill' }, left, right));  // places the two columns side by side (text on the left at 5 parts, card on the right at 7 parts) inside the screen
        show(1975);  // paints the screen for 1975 so it opens in the first year
      },  // ends render() for step 1
    },  // ends step 1

    /* ---------------- 2. Compare: traditional tangle vs modern hub ---------------- */
    {  // step 2 begins: compare a traditional kernel with a modular one
      title: 'Tangle or hub? Make one change and see what it touches',  // step 2's title, shown as the screen heading
      kind: 'compare',  // kind "compare" labels this screen as a Compare step
      render(el, ctx) {  // render(el, ctx): builds the comparison screen when the step opens
        const { h, s } = ctx;  // takes h (builds page elements) and s (builds SVG drawing shapes; SVG is the browser's drawing format) from ctx
        const BLOBS = ['system calls', 'file handling', 'buffer cache', 'program loader', 'memory mgmt', 'scheduler', 'clock & sleep', 'device drivers'];  // BLOBS: the eight parts of a traditional kernel drawn as boxes in the left diagram
        const LINKS = [[0, 1], [0, 3], [0, 5], [1, 2], [1, 4], [2, 7], [3, 4], [4, 5], [5, 6], [6, 0], [4, 7], [2, 4], [6, 3], [1, 5], [0, 7], [3, 6], [2, 5]];  // LINKS: pairs of box numbers joined by a curved line, showing how every part leans on many others
        const MODS = [  // MODS: the six plug-in modules around the core in the right diagram, with sample plug-ins and box positions
          { n: 'exec switch', p: 'a.out · coff', x: 20, y: 6 },  // module box: the exec switch, with a.out and COFF loaders plugged in
          { n: 'VM framework', p: 'file · device · anon', x: 370, y: 6 },  // module box: the virtual memory framework, with its three kinds of mapping
          { n: 'vnode/vfs', p: 's5fs · FFS', x: 8, y: 89 },  // module box: the vnode/vfs interface, with two file systems plugged in
          { n: 'block device switch', p: 'disk · tape', x: 382, y: 89 },  // module box: the block device switch, with disk and tape drivers
          { n: 'scheduler framework', p: 'time-sharing · system', x: 20, y: 172 },  // module box: the scheduler framework, with its two starting scheduling classes
          { n: 'STREAMS', p: 'network · tty', x: 370, y: 172 },  // module box: STREAMS, with network and terminal drivers
        ];  // ends the module list
        const SC = [  // SC: the four changes the student can pick; each lists the traditional parts it touches and the module it adds to
          { label: 'New file system', touch: [0, 1, 2, 3], mod: 2, add: '+ NFS (network files)',  // change 1, a new file system: touches four traditional parts; in the modern kernel NFS joins vnode/vfs
            trad: 'File handling assumed one on-disk layout, and that assumption leaked into open and read, the buffer cache (disk blocks kept in memory) and the program loader. Remote files break all of them.',  // traditional explanation for a new file system: one disk layout was assumed in many places
            modern: 'vnode/vfs already lists the operations a file system must supply. NFS brings its own open, read and lookup, and the core calls them through each file\'s <span class="t">vnode</span>.' },  // modern explanation for a new file system: NFS supplies its own operations through each vnode
          { label: 'New program format', touch: [3, 4, 0], mod: 0, add: '+ elf loader',  // change 2, a new program format: touches the loader, memory code and system calls; modern adds an ELF loader
            trad: 'exec, the system call that starts a new program, knew exactly one program-file layout and built the memory image to match it, so a second format meant rewriting exec and memory management.',  // traditional explanation for a new program format: exec knew only one file layout
            modern: 'The <span class="t">exec switch</span> asks each loader "is this file yours?". Supporting ELF means adding one loader; the exec system call itself does not change.' },  // modern explanation for a new program format: the exec switch just gains one more loader
          { label: 'Real-time scheduling', touch: [5, 6, 0], mod: 4, add: '+ real-time class',  // change 3, real-time scheduling: touches scheduler, clock and system calls; modern adds a real-time class
            trad: 'One built-in priority rule was spread over the scheduler, the clock code that recalculates every process\'s priority once a second, and the sleep code that sets a priority when a process blocks.',  // traditional explanation for real-time scheduling: one priority rule was spread over three parts
            modern: 'Each <span class="t">scheduling class</span> sets its own members\' priorities; the core just runs the highest-priority ready process. A real-time class plugs in next to the others.' },  // modern explanation for real-time scheduling: each class sets its own priorities, so a new class plugs in
          { label: 'New disk driver', touch: [7], ok: true, mod: 3, add: '+ new disk driver',  // change 4, a new disk driver: ok: true marks the case that was already easy, touching only the driver table
            trad: 'The exception: even early UNIX reached drivers through a table, the block device switch. You wrote the driver and filled in one row.',  // traditional explanation for a new driver: even early UNIX used a table row for drivers
            modern: 'Exactly the same: fill one row of the <span class="t">block device switch</span>. Modern UNIX took this old trick and applied it everywhere.' },  // modern explanation for a new driver: the same table trick, now used everywhere
        ];  // ends the list of changes
        const bx = (i) => 18 + (i % 4) * 130, by = (i) => (i < 4 ? 46 : 158);  // bx and by give the top-left corner of traditional box i: four per row, two rows
        const tradSvg = s('svg', { viewBox: '0 0 540 240', width: '100%' });  // the drawing surface for the traditional kernel; viewBox sets its internal coordinates and it scales to fit
        const modSvg = s('svg', { viewBox: '0 0 540 240', width: '100%' });  // the drawing surface for the modular kernel, same size so the two cards match
        const tradRes = h('div', { class: 'cmp-res' }), tradWhy = h('div', { class: 'cmp-why' });  // the result line and explanation under the traditional drawing
        const modRes = h('div', { class: 'cmp-res ok-t' }), modWhy = h('div', { class: 'cmp-why' });  // the result line (green) and explanation under the modular drawing
        function drawTrad(sc) {  // drawTrad(sc): redraws the traditional kernel for the chosen change sc
          const tangle = s('g', { class: 'tangle' }, LINKS.map(([a, b], k) => {  // tangle: a group holding one curved line for every pair in LINKS
            const x1 = bx(a) + 58, y1 = by(a) + 27, x2 = bx(b) + 58, y2 = by(b) + 27;  // the line runs between the centres of box a and box b
            const mx = (x1 + x2) / 2 + ((k % 3) - 1) * 26, my = (y1 + y2) / 2 + ((k % 2) ? 24 : -24);  // the curve's bend point is nudged sideways and up or down by the link's number, so lines do not overlap
            return s('path', { d: `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}` });  // draws a curve (Q = quadratic curve) from one centre, bent through the nudged point, to the other
          }));  // ends the tangle group
          const blobs = BLOBS.map((n, i) => {  // blobs: one drawn box for each traditional kernel part
            const hit = sc.touch.includes(i);  // hit is true when the chosen change forces an edit to this part
            const cls = hit ? (sc.ok ? 's-ok' : 's-bad') : 's-panel';  // a touched part is red (or green in the easy driver case); untouched parts stay plain
            const g = s('g', {},  // g groups the box shape and its label
              s('rect', { x: bx(i), y: by(i), width: 116, height: 54, rx: 12, class: cls, 'stroke-width': hit ? 2.5 : 1.5 }),  // the rounded box itself, with a thicker outline when it is touched
              s('text', { x: bx(i) + 58, y: by(i) + (i === 7 ? 24 : 32), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, n));  // the part's name centred in the box (the driver box's name sits higher to make room for a second line)
            if (i === 7) g.append(s('text', { x: bx(i) + 58, y: by(i) + 42, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'via a switch table'));  // the device-driver box gets a second line saying drivers were already reached through a switch table
            if (hit) g.append(s('g', { class: 'badge' },  // a touched box gets a small badge in its top-right corner
              s('rect', { x: bx(i) + 76, y: by(i) - 11, width: 48, height: 22, rx: 11, style: `fill:var(${sc.ok ? '--ok' : '--bad'})` }),  // the badge's pill shape, green or red to match the box
              s('text', { x: bx(i) + 100, y: by(i) + 5, 'text-anchor': 'middle' }, sc.ok ? '+1 row' : 'edit')));  // the badge text: "+1 row" for the driver case, "edit" for every other change
            return g;  // hands the finished box back to the list
          });  // ends the list of boxes
          tradSvg.replaceChildren(  // clears the traditional drawing and fills it with the new shapes
            s('rect', { x: 4, y: 4, width: 532, height: 232, rx: 16, class: 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }),  // a dashed outline around everything, marking the kernel as one big program
            s('text', { x: 18, y: 28, 'font-size': 13.5, class: 's-sub' }, 'One big program: any part may call, or share data with, any other part'),  // caption at the top of the drawing: any part may call or share data with any other
            tangle, ...blobs);  // the tangle of lines goes in first so the boxes sit on top of it
          tradRes.className = 'cmp-res ' + (sc.ok ? 'ok-t' : 'bad-t');  // colours the result line green for the easy case and red otherwise
          tradRes.textContent = sc.ok ? 'Parts edited: 1 (one new table row)' : `Parts edited: ${sc.touch.length}, then rebuild and retest everything`;  // result text: one new table row, or how many parts must be edited before a full rebuild and retest
          tradWhy.innerHTML = sc.trad;  // shows the traditional explanation for this change
        }  // ends drawTrad()
        function drawModern(sc) {  // drawModern(sc): redraws the modular kernel for the chosen change sc
          const cx = 270, cy = 120;  // the centre of the core circle in the drawing
          const spokes = MODS.map((m, i) => {  // spokes: one connecting line from the core to each module
            const mx = m.x < 200 ? m.x + 150 : m.x, my = m.y + 31;  // the point on the module box where its spoke ends (inner edge for left-side boxes)
            const ang = Math.atan2(my - cy, mx - cx), ex = cx + 56 * Math.cos(ang), ey = cy + 56 * Math.sin(ang);  // finds the angle from the core to that point and where the line leaves the core circle (radius 56)
            const on = i === sc.mod;  // on is true for the module that receives the new plug-in
            return s('g', {}, s('line', { x1: ex, y1: ey, x2: mx, y2: my, style: `stroke:var(${on ? '--ok' : '--line-2'})`, 'stroke-width': on ? 3 : 2 }),  // draws the spoke, green and thicker for the receiving module, grey otherwise
              s('circle', { cx: ex, cy: ey, r: 4.5, style: `fill:var(--panel);stroke:var(${on ? '--ok' : '--os'})`, 'stroke-width': 2 }));  // a small circle where the spoke meets the core, like a socket
          });  // ends the list of spokes
          const mods = MODS.map((m, i) => {  // mods: one drawn box for each module
            const on = i === sc.mod;  // on is true for the module that receives the new plug-in
            const g = s('g', {},  // g groups the module's box and labels
              s('rect', { x: m.x, y: m.y, width: 150, height: 62, rx: 11, class: on ? 's-ok' : 's-panel', 'stroke-width': on ? 2.5 : 1.5 }),  // the module box, green when it receives the new plug-in
              s('text', { x: m.x + 75, y: m.y + 19, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, m.n),  // the module's name near the top of the box
              s('text', { x: m.x + 75, y: m.y + 37, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, m.p));  // the sample plug-ins already in the module, in smaller grey text
            if (on) g.append(s('text', { x: m.x + 75, y: m.y + 55, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--ok)' }, sc.add));  // the receiving module shows what was just added, in bold green, as a third line
            return g;  // hands the finished module box back to the list
          });  // ends the list of module boxes
          modSvg.replaceChildren(...spokes,  // clears the modular drawing and fills it: spokes first so the core and boxes cover their ends
            s('circle', { cx, cy, r: 56, class: 's-os', 'stroke-width': 2.5 }),  // the core circle in the middle, in the operating-system colour
            s('text', { x: cx, y: cy - 6, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, style: 'fill:var(--os)' }, 'core'),  // the bold "core" label in the circle
            s('text', { x: cx, y: cy + 13, 'text-anchor': 'middle', 'font-size': 13 }, 'common'),  // first line of the core's subtitle
            s('text', { x: cx, y: cy + 29, 'text-anchor': 'middle', 'font-size': 13 }, 'facilities'),  // second line of the core's subtitle
            ...mods);  // the six module boxes go in last, on top
          modRes.textContent = 'Core edited: 0 lines. One module added.';  // the modular result is always the same: the core does not change
          modWhy.innerHTML = sc.modern;  // shows the modular explanation for this change
        }  // ends drawModern()
        function pick(i) { drawTrad(SC[i]); drawModern(SC[i]); }  // pick(i): redraws both kernels for change number i
        const seg = ctx.ui.seg(SC.map((sc, i) => ({ value: i, label: sc.label })), 0, pick);  // builds the row of change buttons; each click calls pick() with its number, starting with the first change
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // puts the whole screen into el as one column
          h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // top row: the instruction on the left, the change buttons on the right
            h('p', { class: 'lead m0', html: 'Pick a change. See what each kernel design has to touch.' }), seg),  // the instruction line: pick a change and compare what each design touches
          h('div', { class: 'grid-2 grow' },  // a two-column grid holding the two comparison cards; it grows to fill the free height
            h('div', { class: 'card cmp-card' }, h('h4', 'Traditional kernel: one tangle'), tradSvg, tradRes, tradWhy),  // left card: the traditional kernel's heading, drawing, result and explanation
            h('div', { class: 'card cmp-card' }, h('h4', { html: 'Modern <span class="t">modular kernel</span>: core + plug-ins' }), modSvg, modRes, modWhy)),  // right card: the modular kernel's heading, drawing, result and explanation
          h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'A change that stays inside one module is smaller, safer and can be tested alone, and the core that everyone depends on stays stable. The "edit" counts are illustrative: they show how far one change spreads, not exact line counts.' })));  // "Why it matters" box: changes kept in one module are safer, and the edit counts are only illustrative
        pick(0);  // draws the first change so the screen opens with something to compare
      },  // ends render() for step 2
    },  // ends step 2

    /* ---------------- 3. Explore: the modern kernel hub (explore + route modes) ---------------- */
    {  // step 3 begins: an explorable map of the modern kernel, with a second mode where the student routes requests
      title: 'The modern UNIX kernel: a core with six plug-in points',  // step 3's title, shown as the screen heading
      kind: 'explore',  // kind "explore" labels this screen as an Explore step
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the kernel map and its side panel when the step opens
        const { h, s } = ctx;  // takes h (builds page elements) and s (builds SVG shapes) from ctx
        // six modules around the core; side L = running programs, R = files and I/O
        const M = [  // M: the six plug-in points; each has an id, name, colour, box position, chips, a short role and panel texts
          { id: 'exec', n: 'exec switch', c: 'proc', x: 10, y: 20, chips: ['a.out', 'coff', 'elf'], role: 'starting programs in different file formats',  // plug-in point 1, the exec switch: loaders for the a.out, COFF and ELF program formats, drawn top left
            what: 'Starts new programs. When a process calls exec, the kernel reads the start of the program file (its header) and offers the file to each loader in the <span class="t">exec switch</span> until one recognizes the format. That loader lays the program out in memory.',  // panel text for the exec switch: exec offers the program file to each loader until one recognizes it
            plug: ['The original UNIX program format, named after the assembler\'s default output file: just code, data and a symbol table.', 'Common Object File Format, used by System V before SVR4. It allows more sections and richer debugging information.', 'The <span class="t">Executable and Linkable Format (ELF)</span>, introduced with SVR4 and still the standard on Linux, the BSDs and Solaris.'],  // one explanation per exec chip: what a.out, COFF and ELF are
            eg: 'Every command you run goes through the exec switch. Supporting a new format means adding one loader; exec itself never changes.' },  // example line: every command you run passes through the exec switch
          { id: 'vm', n: 'VM framework', c: 'mem', x: 10, y: 198, chips: ['file', 'device', 'anon'], role: 'memory mappings and page faults',  // plug-in point 2, the virtual memory framework: file, device and anonymous mappings, drawn middle left
            what: 'The <span class="t">virtual memory framework</span> treats each <span class="t">address space</span> as a list of mappings. On a page fault (a touch of a page that is not in memory yet) the core finds the mapping that holds the address and calls that mapping\'s own routine to supply the page.',  // panel text for the VM framework: on a page fault the core calls the right mapping's own routine
            plug: ['<span class="t">File mapping</span>: pages come from a file the first time they are touched. Program code is mapped this way.', 'Device mapping: a window onto a device\'s own memory, such as a graphics frame buffer.', '<span class="t">Anonymous mapping</span>: memory with no file behind it, such as the heap and stacks. It starts as zeros.'],  // one explanation per VM chip: file, device and anonymous mappings
            eg: 'One address space mixes all three: code (file), heap and stack (anonymous) and perhaps a frame buffer (device).' },  // example line: one address space mixes all three kinds of mapping
          { id: 'sched', n: 'scheduler framework', c: 'cpu', x: 10, y: 376, chips: ['time-sharing', 'system'], role: 'choosing which process runs next',  // plug-in point 3, the scheduler framework: time-sharing and system classes, drawn bottom left
            what: 'Decides which process runs next. The core dispatcher always runs the highest-priority ready process; each <span class="t">scheduling class</span> decides how the priorities of its own members are set and changed.',  // panel text for the scheduler framework: the dispatcher runs the top priority; classes set priorities
            plug: ['Ordinary user processes. Priorities rise and fall with behaviour: a process that uses up its whole time slice (its turn on the processor) drops, one that often waits for input rises, so interactive programs stay responsive.', 'Kernel processes, such as the page-out daemon that frees memory. Fixed priorities above every time-sharing process.'],  // one explanation per scheduler chip: the time-sharing class and the system class
            eg: 'SVR4 added a third class, real-time, with fixed priorities above both. Adding it did not change the dispatcher.' },  // example line: SVR4's real-time class was added without changing the dispatcher
          { id: 'vfs', n: 'vnode/vfs interface', c: 'accent', x: 434, y: 20, chips: ['NFS', 'FFS', 's5fs', 'RFS'], role: 'files and file systems',  // plug-in point 4, the vnode/vfs interface: NFS, FFS, s5fs and RFS, drawn top right
            what: 'Lets many file-system types live side by side. File system calls work only with <span class="t">vnode</span>s; each vnode points to the operation table of the file system that owns the file. Each mounted file system is a vfs object.',  // panel text for vnode/vfs: system calls work through vnodes that point to each file system's operations
            plug: ['<span class="t">Network File System (NFS)</span>: files that live on another computer.', 'Berkeley\'s Fast File System, which keeps related data close together on disk.', 'The original System V file system layout.', 'Remote File Sharing: AT&T\'s own network file system.'],  // one explanation per file-system chip: NFS, FFS, s5fs and RFS
            eg: 'Your disk, a network share and a USB stick can all be open at once, each through its own file-system module.' },  // example line: a disk, a network share and a USB stick can all be open at once
          { id: 'bdev', n: 'block device switch', c: 'io', x: 434, y: 198, chips: ['disk', 'tape'], role: 'block devices such as disks and tapes',  // plug-in point 5, the block device switch: disk and tape drivers, drawn middle right
            what: 'Reaches the drivers (the code that controls each kind of device) for devices that move data in fixed-size blocks. Each device is named by two numbers: the major number selects the driver\'s row in the <span class="t">block device switch</span>, and the minor number tells that driver which unit (which disk) to use.',  // panel text for the block device switch: the major number picks the driver, the minor number the unit
            plug: ['Disk drivers: read or write any numbered block.', 'Tape drivers: blocks in order along the tape, used for backups.'],  // one explanation per driver chip: disk drivers and tape drivers
            eg: 'One of the oldest switches in UNIX (with its twin for character devices): even early versions found drivers this way. Modern UNIX copied the idea everywhere.' },  // example line: one of the oldest switch tables in UNIX, the idea modern UNIX copied everywhere
          { id: 'str', n: 'STREAMS', c: 'io', x: 434, y: 376, chips: ['network', 'tty'], role: 'terminals and network connections',  // plug-in point 6, STREAMS: network and terminal drivers, drawn bottom right
            what: '<span class="t">STREAMS</span> handles character I/O as a chain: a stream head next to the process, optional processing modules in the middle, and a driver at the far end. Modules can be pushed or popped while the stream is open.',  // panel text for STREAMS: character I/O flows through a chain of modules that can be pushed or popped
            plug: ['Network drivers, with protocol modules such as TCP/IP stacked above them.', 'Terminal drivers. "tty" is short for teletype, the typewriter-like terminals of early UNIX.'],  // one explanation per STREAMS chip: network drivers and terminal (tty) drivers
            eg: 'Pushing a module adds processing, such as line editing or a protocol, without changing the driver below or the program above.' },  // example line: pushing a module adds processing without changing the driver or the program
        ];  // ends the list of plug-in points
        const CORE = { n: 'Common facilities (the core)', c: 'os', role: 'shared services, not a plug-in point',  // CORE: the panel texts for the core circle in the middle, which is not a plug-in point
          what: 'The small core holds services every other part needs, such as system-call entry, process and <span class="t">thread</span> management, <span class="t">interrupt</span> handling, locking and kernel memory allocation.',  // panel text for the core: the shared services every part needs, such as system calls and locking
          eg: 'The core knows nothing about any particular program format, memory source, file system, device or scheduling policy. It reaches all of them through the six interfaces around it.' };  // example line: the core reaches every variety only through the six interfaces
        const cx = 320, cy = 240, R = 88;  // cx, cy: centre of the core circle in the drawing; R: its radius
        const svg = s('svg', { viewBox: '0 0 640 480', width: '100%', class: 'hub' });  // svg: the drawing surface for the kernel map, with the class that its step 3 styles target
        const chipEls = [], modEls = [];  // chipEls holds each module's chip shapes (to light up answers); modEls holds each module's clickable group
        M.forEach((m, i) => {  // draws each of the six modules and its connecting line, one at a time
          const ix = m.x < 300 ? m.x + 196 : m.x, iy = m.y + 42;  // the point on the module box where its line ends: the inner edge, halfway down the box
          const a = Math.atan2(iy - cy, ix - cx), ex = cx + R * Math.cos(a), ey = cy + R * Math.sin(a);  // works out the angle from the core to that point and where the line leaves the core's edge
          svg.append(s('line', { x1: ex, y1: ey, x2: ix, y2: iy, class: 's-muted', 'stroke-width': 2.5 }),  // draws the connecting line from the core's edge to the module box
            s('circle', { cx: ex, cy: ey, r: 6, style: 'fill:var(--panel);stroke:var(--os)', 'stroke-width': 2.5 }));  // a small socket circle where the line meets the core
          const g = s('g', { class: 'hot mod', tabindex: 0, role: 'button', 'aria-label': m.n });  // g: the module's clickable group; tabindex and role let keyboard users focus it and press Enter like a button
          g.append(s('rect', { x: m.x, y: m.y, width: 196, height: 84, rx: 13, class: 's-' + m.c + ' fr', 'stroke-width': 2 }),  // the module's box in its own colour; .fr marks it as the frame whose outline the styles thicken on hover
            s('text', { x: m.x + 98, y: m.y + 26, 'text-anchor': 'middle', 'font-size': 16.5, 'font-weight': 800 }, m.n));  // the module's name, centred near the top of the box
          const ws = m.chips.map((t) => 14 + t.length * 8), tot = ws.reduce((p, w) => p + w, 0) + (ws.length - 1) * 6;  // each chip's width comes from its label length; tot is all chips plus 6-unit gaps between them
          let x = m.x + 98 - tot / 2;  // x starts where the row of chips must begin to be centred in the box
          chipEls[i] = m.chips.map((t, k) => {  // draws each chip and remembers its shape for this module
            const r = s('rect', { x, y: m.y + 44, width: ws[k], height: 26, rx: 13, class: 's-panel chipr', 'stroke-width': 1.5 });  // the chip's rounded pill shape; .chipr lets the styles light it green later
            g.append(r, s('text', { x: x + ws[k] / 2, y: m.y + 62, 'text-anchor': 'middle', class: 'chiptx s-monot' }, t));  // the chip's label in a fixed-width font, centred on the pill
            x += ws[k] + 6;  // moves x past this chip and its gap, ready for the next one
            return r;  // hands back the pill shape so route mode can light it
          });  // ends the chip loop
          modEls[i] = g;  // remembers this module's clickable group
          svg.append(g);  // adds the finished module to the drawing
        });  // ends the loop over modules
        const coreG = s('g', { class: 'hot mod', tabindex: 0, role: 'button', 'aria-label': 'core' },  // coreG: the clickable core circle and its labels, also usable from the keyboard
          s('circle', { cx, cy, r: R, class: 's-os fr', 'stroke-width': 2.5 }),  // the core circle itself, in the operating-system colour
          s('text', { x: cx, y: cy - 30, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, style: 'fill:var(--os)' }, 'Common'),  // first line of the core's title: "Common"
          s('text', { x: cx, y: cy - 10, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, style: 'fill:var(--os)' }, 'facilities'),  // second line of the core's title: "facilities"
          s('text', { x: cx, y: cy + 14, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'system calls · processes'),  // core subtitle line 1: system calls and processes
          s('text', { x: cx, y: cy + 32, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'interrupts · locks'),  // core subtitle line 2: interrupts and locks
          s('text', { x: cx, y: cy + 50, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'kernel memory'));  // core subtitle line 3: kernel memory
        svg.append(coreG,  // adds the core on top of the lines, plus the two side headings
          s('text', { x: 108, y: 13, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'RUNNING PROGRAMS'),  // heading over the left column of modules: RUNNING PROGRAMS
          s('text', { x: 532, y: 13, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'FILES AND I/O'));  // heading over the right column of modules: FILES AND I/O
        const REQ = [  // REQ: the nine requests for route mode; m is the right module, k the chip to light, why the explanation
          { t: 'A shell starts a program whose file begins with an ELF header.', m: 0, k: 2, why: 'exec offers the file to each loader in the exec switch. The ELF loader recognizes the header and builds the new memory image.' },  // request 1: starting an ELF program belongs to the exec switch (ELF chip)
          { t: 'A program opens a file stored on a server across the network.', m: 3, k: 0, why: 'The path crosses into an NFS mount, so the file\'s vnode points to NFS\'s operations. The system call code never learns the file is remote.' },  // request 2: opening a file on a network server belongs to vnode/vfs (NFS chip)
          { t: 'A program touches a page of its heap for the very first time.', m: 1, k: 2, why: 'The heap is an anonymous mapping. Its handler in the VM framework supplies a fresh page filled with zeros.' },  // request 3: first touch of a heap page belongs to the VM framework (anonymous chip)
          { t: 'The kernel must write block 7,204 to the second disk.', m: 4, k: 0, why: 'The device\'s major number picks the disk driver\'s row in the block device switch; the minor number says which disk.' },  // request 4: writing a disk block belongs to the block device switch (disk chip)
          { t: 'The page-out daemon, a kernel process, wakes up and needs a processor.', m: 2, k: 1, why: 'Kernel processes belong to the system scheduling class, whose fixed priorities outrank all time-sharing work.' },  // request 5: the page-out daemon waking belongs to the scheduler framework (system class chip)
          { t: 'Someone presses a key on a terminal.', m: 5, k: 1, why: 'The character enters through the terminal driver at the bottom of a stream and flows up through a line-editing module to the program.' },  // request 6: a key press on a terminal belongs to STREAMS (tty chip)
          { t: 'A program maps a whole file into memory and reads it like an array.', m: 1, k: 0, why: 'That is a file mapping. On each first touch the VM framework asks the file\'s vnode to fetch the page from the file.' },  // request 7: reading a file mapped into memory belongs to the VM framework (file chip)
          { t: 'A text editor has used up its time slice and must let others run.', m: 2, k: 0, why: 'Ordinary processes are in the time-sharing class, which lowers the priority of a process that keeps using its whole slice.' },  // request 8: a text editor using up its time slice belongs to the scheduler (time-sharing chip)
          { t: 'A packet for an open connection arrives from the network card.', m: 5, k: 0, why: 'The network driver sits at the bottom of a stream; protocol modules above it pass the data up to the program.' },  // request 9: a network packet arriving belongs to STREAMS (network chip)
        ];  // ends the list of requests
        const panel = h('div', { class: 'stack grow route-panel', style: { gap: '10px' } });  // panel: the right-hand column whose contents change with the mode and the student's clicks
        let mode = 'explore', qi = 0, tries = 0, score = 0, solved = false;  // mode is "explore" or "route"; qi is the current request, tries the misses on it, score the first-try hits
        const fb = h('div', { class: 'fb' });  // fb: the feedback area under each request in route mode
        const scoreChip = h('span', { class: 'chip ok' });  // scoreChip: the green chip showing how many requests were right on the first try
        const nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => { if (qi >= REQ.length - 1) return summary(); qi++; routeShow(); } }, 'Next request');  // Next button: moves to the next request, or to the score summary after the last one
        const againBtn = h('button', { class: 'btn', type: 'button', onclick: () => startRoute() }, 'Start over');  // Start over button: restarts route mode from request 1 with a zero score
        const allG = () => modEls.concat([coreG]);  // allG(): the seven clickable groups, the six modules followed by the core (index 6)
        function clearMarks() {  // clearMarks(): removes every highlight from the map before a new view is drawn
          allG().forEach((g) => g.classList.remove('sel', 'good', 'wrong'));  // removes the selected, right and wrong looks from every module and the core
          chipEls.flat().forEach((r) => r.classList.remove('lit'));  // turns off every lit chip
          svg.classList.remove('dimmer');  // stops fading the other shapes
        }  // ends clearMarks()
        function intro() {  // intro(): fills the panel with the explore-mode introduction; runs at start and when Explore is picked
          clearMarks();  // clears any leftover highlights first
          panel.replaceChildren(h('div', { class: 'info' },  // replaces the panel's contents with the introduction
            h('h3', 'A small core with six sockets'),  // intro heading: a small core with six sockets
            h('p', { html: 'A modern UNIX kernel keeps a small core of <b>common facilities</b>. Around it sit six interfaces. Each one is a place where many different implementations can plug in: the chips inside each box.' }),  // intro paragraph: the core plus six interfaces, with the chips as plug-ins
            h('p', { html: 'The left side is about <b>running programs</b> (loading them, giving them memory, choosing who runs). The right side is about <b>files and I/O</b>.' }),  // intro paragraph: the left side is about running programs, the right side about files and I/O
            h('p', { html: 'The modules are still part of the kernel: they run in kernel mode and call the core directly. That makes this a <b>modular</b> kernel, not a microkernel: a microkernel would move such services out of the kernel into separate server processes running in <span class="t">user mode</span>.' }),  // intro paragraph: why this is a modular kernel and not a microkernel
            h('div', { class: 'callout tip m0', 'data-label': 'Try it', html: 'Click any box, or the core, to see what it does and what plugs into it. Then switch to <b>Route a request</b> and play the kernel.' })));  // "Try it" box: click the boxes, then switch to route mode
        }  // ends intro()
        function explore(i) {  // explore(i): shows the details of module i (or the core when i is 6) after the student clicks it in explore mode
          clearMarks();  // clears the previous selection first
          (i === 6 ? coreG : modEls[i]).classList.add('sel');  // marks the clicked module, or the core, as selected
          svg.classList.add('dimmer');  // fades every other shape so the selected one stands out
          const m = i === 6 ? CORE : M[i];  // m is the text record for the clicked part: CORE for the circle, otherwise that module's entry in M
          panel.replaceChildren(h('div', { class: 'info' },  // replaces the panel with the clicked part's explanation
            h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'chip ' + m.c }, i === 6 ? 'the core' : 'plug-in point'), h('h3', { class: 'm0' }, m.n)),  // panel header: a coloured chip saying "the core" or "plug-in point", then the part's name
            h('p', { html: m.what }),  // the paragraph explaining what this part does
            m.chips ? h('div', { class: 'plug' }, m.chips.map((c, k) => [h('span', { class: 'chip mono ' + m.c }, c), h('span', { html: m.plug[k] })])) : null,  // for a module, one row per chip: the chip's name beside its explanation (the core has no chips, so nothing)
            h('div', { class: 'eg', html: '<b>Example.</b> ' + m.eg })));  // the example box at the bottom of the panel
          ctx.refit();  // asks the guide to re-measure the screen, since the panel's height just changed
        }  // ends explore()
        function paintScore() { scoreChip.textContent = `First-try right: ${score}`; }  // paintScore(): writes the current first-try score into the green chip
        function routeShow() {  // routeShow(): shows the current request in route mode and resets the per-request state
          clearMarks(); tries = 0; solved = false;  // clears highlights, the miss count and the solved flag for the new request
          fb.innerHTML = '<span class="muted">Click the part of the kernel that handles this request.</span>';  // starts the feedback area with a grey instruction
          nextBtn.disabled = true;  // Next stays disabled until the student finds the right module
          nextBtn.textContent = qi >= REQ.length - 1 ? 'See my score' : 'Next request';  // on the last request, the Next button says "See my score" instead
          paintScore();  // refreshes the score chip
          panel.replaceChildren(  // replaces the panel with the route-mode layout
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', `Request ${qi + 1} of ${REQ.length}`), scoreChip),  // top line: "Request n of 9" on the left and the score chip on the right
            h('div', { class: 'req', html: REQ[qi].t }), fb, h('div', { class: 'row' }, nextBtn, againBtn),  // the boxed request text, the feedback area, then the Next and Start over buttons
            h('div', { class: 'route-hint' }, ctx.ui.reveal('Need a hint?', h('div', { class: 'kv mt' }, M.map((m) => [h('b', m.n), h('span', m.role)])), { hideLabel: 'Hide hint' })),  // a "Need a hint?" button that opens a list of every module and its role (the guide's reveal helper)
            h('div', { class: 'callout why m0 route-how', style: { marginTop: 'auto' }, 'data-label': 'How the kernel routes', html: 'Every request enters the core first, through a system call, a page fault or an interrupt. The core then looks in the right <span class="t">switch table</span> and calls whatever implementation is plugged in there.' }));  // "How the kernel routes" box pinned to the bottom: requests enter the core, which calls through a switch table
        }  // ends routeShow()
        function startRoute() { qi = 0; score = 0; routeShow(); }  // startRoute(): begins route mode at request 1 with a zero score
        function summary() {  // summary(): shows the final score after the ninth request
          clearMarks();  // clears every highlight on the map
          const msg = score >= 8 ? 'Excellent: you think like the kernel.' : score >= 5 ? 'Good. Revisit the ones you missed in Explore mode.' : 'Switch to Explore, read each box, then try again.';  // picks an encouraging message from the score: 8 or more, 5 or more, or fewer
          panel.replaceChildren(h('div', { class: 'info' },  // replaces the panel with the score summary
            h('h3', 'All requests routed'),  // summary heading
            h('div', { class: 'big' }, `${score} / ${REQ.length}`),  // the score in large digits, out of the number of requests
            h('p', { html: `right on the first try. ${msg}` }),  // the words after the score, followed by the chosen message
            h('div', { class: 'eg', html: '<b>Pattern.</b> Every request reached the right code through an interface, and the core never needed to know which implementation was on the other side.' }),  // "Pattern" box: the core never needed to know which implementation did the work
            h('div', { class: 'row' }, againBtn)));  // a Start over button so the student can play again
        }  // ends summary()
        function routeClick(i) {  // routeClick(i): judges a click on module i (or the core, 6) while a request is showing
          if (solved) return;  // once a request is solved, further clicks do nothing until Next is pressed
          const r = REQ[qi];  // r is the request being answered
          if (i === r.m) {  // the student clicked the right module
            solved = true;  // marks this request solved
            if (tries === 0) score++;  // only a hit with no earlier misses counts toward the score
            modEls[i].classList.add('good');  // turns the module's box green
            chipEls[i][r.k].classList.add('lit');  // lights the specific chip inside it that handles this request
            fb.innerHTML = `<div class="verdict ok-t">${tries === 0 ? 'Right, first try.' : 'Right.'}</div>${r.why}`;  // feedback: a green verdict ("first try" when earned) followed by the explanation
            nextBtn.disabled = false;  // enables the Next button
            paintScore();  // refreshes the score chip
          } else {  // the student clicked a wrong part
            tries++;  // counts the miss so this request can no longer score
            const g = i === 6 ? coreG : modEls[i], m = i === 6 ? CORE : M[i];  // g is the clicked shape and m its text record
            g.classList.add('wrong');  // flashes the wrong part red
            ctx.after(700, () => g.classList.remove('wrong'));  // removes the red flash after 700 milliseconds (ctx.after is a timer the guide cancels if the step closes)
            fb.innerHTML = i === 6  // chooses a hint depending on whether the student clicked the core or a wrong module
              ? '<div class="verdict bad-t">Not the core.</div>Every request passes through the core, but the core only dispatches it. Which plug-in point holds the code that knows this particular kind of work?'  // hint for the core: it only dispatches; which plug-in point holds the right code?
              : `<div class="verdict bad-t">Not that one.</div>The ${m.n} handles ${m.role}. What kind of thing does this request need?`;  // hint for a wrong module: says what that module actually handles, so the student can rethink
          }  // ends the wrong-answer branch
        }  // ends routeClick()
        allG().forEach((g, i) => {  // wires up each of the seven clickable parts
          const act = () => (mode === 'explore' ? explore(i) : routeClick(i));  // act decides what a click means: show details in explore mode, judge the answer in route mode
          g.addEventListener('click', act);  // runs act when the part is clicked
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });  // runs act when a focused part gets Enter or Space, so the map works from the keyboard
        });  // ends the wiring loop
        const seg = ctx.ui.seg([{ value: 'explore', label: 'Explore the parts' }, { value: 'route', label: 'Route a request' }], 'explore', (v) => { mode = v; if (v === 'explore') intro(); else startRoute(); });  // the two mode buttons; switching mode shows the intro or starts route mode from request 1
        el.append(h('div', { class: 'split r fill' },  // puts the screen together: map on the left (larger), panel on the right
          h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center', padding: '8px 10px' } }, svg),  // the white card holding the kernel map, centred
          h('div', { class: 'stack' }, seg, panel)));  // the right column: the mode buttons above the changing panel
        intro();  // shows the explore-mode introduction when the step opens
      },  // ends render() for step 3
    },  // ends step 3

    /* ---------------- 4. Lab: hot-swap a file system through vnode/vfs ---------------- */
    {  // step 4 begins: a hands-on lab that adds a new file system while the kernel keeps running
      title: 'Hot-swap lab: add a file system without touching the core',  // step 4's title, shown as the screen heading
      kind: 'lab',  // kind "lab" labels this screen as a Hands-on Lab step
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the lab's buttons, diagram, table and log when the step opens
        const { h, s } = ctx;  // takes h (builds page elements) and s (builds SVG shapes) from ctx
        let loaded = false, mounted = false;  // loaded: has the pcfs module been loaded yet? mounted: has the USB stick been mounted yet?
        const FS = [  // FS: the five file-system slots under the VFS layer, with where each is mounted and what device holds it
          { n: 's5fs', at: '/', dev: 'disk 0' },  // slot 1: s5fs, the System V file system, mounted at the root "/" from disk 0
          { n: 'FFS', at: '/home', dev: 'disk 1' },  // slot 2: FFS, the Berkeley Fast File System, mounted at /home from disk 1
          { n: 'NFS', at: '/net/lab', dev: 'server "lab"' },  // slot 3: NFS, files on a network server, mounted at /net/lab
          { n: 'RFS', at: null, dev: null },  // slot 4: RFS, registered but not mounted anywhere, so it has no device
          { n: 'pcfs (FAT)', at: '/media/usb', dev: 'USB stick' },  // slot 5: pcfs, the FAT file system the student adds, to be mounted at /media/usb from the USB stick
        ];  // ends the file-system list
        const fx = (i) => 20 + i * 124;  // fx(i): the left edge of file-system slot i in the drawing
        const svg = s('svg', { viewBox: '0 0 640 300', width: '100%' });  // svg: the drawing surface for the lab's layer diagram
        const ln = (x1, y1, x2, y2, act, dash) => s('line', { x1, y1, x2, y2, style: `stroke:var(${act ? '--chc' : '--line-2'})`, 'stroke-width': act ? 3.5 : 2, 'stroke-dasharray': dash ? '5 4' : null });  // ln(): draws a connecting line, thick and chapter-coloured when active, dashed when that link is not live
        const tx = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 14 }, o), t);  // tx(): draws centred text at a point, with optional extra settings merged in
        function draw(p = {}) {  // draw(p): redraws the whole diagram; p can name the file system in use (fs) or a failure to show (bad)
          const hl = p.fs != null || p.bad === 'vfs';  // hl is true when a request is travelling down through the layers, so the top links light up
          const kids = [ln(320, 44, 320, 62, hl), ln(320, 100, 320, 118, hl)];  // kids collects every shape; it starts with the links program to system calls and system calls to VFS
          FS.forEach((f, i) => {  // adds the links for each file-system slot
            const x = fx(i) + 54, live = i < 4 || loaded, mnt = i === 4 ? mounted : !!f.at;  // x is the slot's centre; live means its code is in the kernel; mnt means it is mounted
            kids.push(ln(320, 156, x, 184, p.fs === i, !live));  // link from VFS down to this slot: lit when it is the one in use, dashed when its code is missing
            if (f.dev) kids.push(ln(x, 228, x, 252, p.fs === i && (i !== 4 || mounted), !mnt));  // link from the slot down to its device: lit only when real data flows, dashed when not mounted
          });  // ends the loop over slots
          kids.push(  // adds the three layer boxes and their labels
            s('rect', { x: 160, y: 6, width: 320, height: 38, rx: 10, class: 's-proc', 'stroke-width': hl ? 3 : 2 }), tx(320, 30, 'program: open(path), then read(fd)', { 'font-weight': 700 }),  // top layer: the program calling open() and read()
            s('rect', { x: 100, y: 62, width: 440, height: 38, rx: 10, class: 's-os', 'stroke-width': hl ? 3 : 2 }), tx(320, 86, 'system calls: open · read · write · close'),  // second layer: the system call entry points
            s('rect', { x: 100, y: 118, width: 440, height: 38, rx: 10, class: p.bad === 'vfs' ? 's-bad' : 's-os', 'stroke-width': hl ? 3 : 2 }), tx(320, 142, 'VFS layer: file-system types · mount table · vnodes'),  // third layer: the VFS layer, drawn red when a mount fails because the file-system type is unknown
            s('path', { d: 'M92 64 H84 V154 H92', class: 's-line' }),  // a bracket drawn to the left of the system-call and VFS boxes, grouping them as the core
            s('text', { x: 72, y: 109, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, transform: 'rotate(-90 72 109)', style: 'fill:var(--os)' }, 'CORE'));  // the word CORE beside the bracket, turned on its side to run up the page
          FS.forEach((f, i) => {  // draws each file-system slot and the device under it
            const x = fx(i), empty = i === 4 && !loaded, act = p.fs === i;  // x is the slot's left edge; empty means the pcfs slot before loading; act means this slot is in use
            const cls = empty ? 's-panel' : act ? (p.bad ? 's-bad' : 's-ok') : 's-accent';  // slot colour: plain when empty, green when in use (red when that use fails), accent colour otherwise
            const sub = i === 4 ? (mounted ? 'at /media/usb' : loaded ? 'loaded, not mounted' : 'no FAT code yet') : f.at ? 'at ' + f.at : 'not mounted';  // the slot's second line: the pcfs slot reports its own progress; the others say where they are mounted
            kids.push(s('rect', { x, y: 184, width: 108, height: 44, rx: 10, class: cls, 'stroke-width': act ? 3 : 2, 'stroke-dasharray': empty ? '6 4' : null }),  // the slot's box, with a dashed outline while it is still empty
              tx(x + 54, 202, empty ? 'empty slot' : f.n, { 'font-weight': 800, class: empty ? 's-sub' : null }),  // the slot's name in bold, or "empty slot" in grey before pcfs is loaded
              tx(x + 54, 220, sub, { 'font-size': 13, class: 's-sub' }));  // the slot's second line in small grey text
            if (f.dev) kids.push(s('rect', { x: x + 6, y: 252, width: 96, height: 36, rx: 8, class: 's-io', 'stroke-width': p.fs === i && (i !== 4 || mounted) ? 3 : 1.5, opacity: i === 4 && !mounted ? 0.55 : 1 }), tx(x + 54, 275, f.dev, { 'font-size': 13.5 }));  // a device box under a slot that has one, outlined thicker when data flows, faded while the stick is unmounted
            else kids.push(tx(x + 54, 275, 'no device', { 'font-size': 13, class: 's-sub' }));  // a slot with no device (RFS) just says "no device"
          });  // ends the loop over slots
          svg.replaceChildren(...kids);  // clears the drawing and puts in every collected shape
        }  // ends draw()
        const log = h('div', { class: 'log lab-log' });  // log: the command log under the diagram, where every action explains itself line by line
        const say = (lines) => { log.replaceChildren(...lines.map(([cls, html]) => h('div', { class: cls, html }))); };  // say(lines): replaces the log with new lines; each line is [style name, text]
        const typesV = h('div', { class: 'v' }), coreV = h('div', { class: 'v ok-t' }, '0');  // typesV: the number of file-system types known; coreV: core lines changed, which always stays a green 0
        const tbody = h('tbody');  // tbody: the body of the mount table, refilled whenever the lab's state changes
        function paintTable() {  // paintTable(): refreshes the mount table, the types counter and the finished marks on the two buttons
          const rows = FS.filter((f, i) => f.at && (i < 4 || mounted));  // rows: every file system that is mounted right now (pcfs only after the mount step)
          tbody.replaceChildren(...rows.map((f) => h('tr', { class: f.n.startsWith('pcfs') ? 'on' : null }, h('td', { class: 'mono' }, f.at), h('td', f.n.replace(' (FAT)', '')), h('td', f.dev))));  // one table row per mounted file system: mount point, type and device; the pcfs row is highlighted
          typesV.textContent = loaded ? '5' : '4';  // the kernel knows 5 file-system types after pcfs is loaded, 4 before
          bLoad.classList.toggle('done', loaded); bMount.classList.toggle('done', mounted);  // marks button 1 and button 2 as done (green) once their step has happened
        }  // ends paintTable()
        const numBtn = (n, label, fn) => h('button', { class: 'btn', type: 'button', onclick: fn, html: `<span class="n">${n}</span>${label}` });  // numBtn(): makes a lab button with a round number badge in front of its label
        const bLoad = numBtn(1, 'Load pcfs module', () => {  // button 1, Load pcfs module: runs when clicked
          if (loaded) { say([['note', 'pcfs is already loaded. Next: mount the stick.']]); return; }  // if pcfs is already loaded, the log just says to mount the stick next
          loaded = true; draw(); paintTable();  // records the load, then redraws the diagram and table
          say([['cmd', '$ modload pcfs'], ['', 'Kernel copies the pcfs code into kernel memory.'], ['', 'pcfs registers with VFS: type name "pcfs" + its vfs operations (mount, unmount, root, sync ...)'], ['', '... and its vnode operations (lookup, open, read, write, getattr ...).'], ['ok', 'Core code changed: 0 lines. VFS now knows 5 file-system types.']]);  // log: the modload command, the kernel copying the code in, and pcfs registering its operations with VFS
        });  // ends button 1's click handler
        const bMount = numBtn(2, 'Mount the stick', () => {  // button 2, Mount the stick: runs when clicked
          if (!loaded) { draw({ bad: 'vfs' }); say([['cmd', '$ mount -F pcfs /dev/usb0 /media/usb'], ['', 'VFS searches its table of file-system types for "pcfs" ...'], ['bad', 'mount failed: unknown file system type "pcfs"'], ['note', 'The core has no FAT code of its own and never will. Load the module first (button 1).']]); return; }  // mounting before loading fails: the VFS box turns red and the log shows "unknown file system type"
          if (mounted) { say([['note', 'Already mounted at /media/usb. Now read /media/usb/photo.jpg.']]); return; }  // if the stick is already mounted, the log says to read the photo next
          mounted = true; draw({ fs: 4 }); paintTable();  // records the mount, redraws with the pcfs slot lit, and refreshes the table
          say([['cmd', '$ mount -F pcfs /dev/usb0 /media/usb'], ['', 'VFS finds "pcfs" in its type table and calls pcfs\'s own mount operation.'], ['', 'pcfs reads the stick\'s FAT layout; VFS creates a vfs object for it and records /media/usb in the mount table.'], ['ok', 'Mounted. Core code changed: still 0 lines.']]);  // log: the mount command, VFS calling pcfs's own mount routine, and the new mount table entry
        });  // ends button 2's click handler
        const READS = [  // READS: the three files the student can open, each with the file-system slot that holds it
          { p: '/home/ana/todo.txt', fs: 1 }, { p: '/net/lab/data.csv', fs: 2 }, { p: '/media/usb/photo.jpg', fs: 4 },  // a file on FFS, a file on NFS and the photo on the USB stick
        ];  // ends the list of files
        function doRead(r) {  // doRead(r): simulates a program opening and reading file r, and explains each step in the log
          const f = FS[r.fs], name = r.p.split('/').pop(), op = f.n.split(' ')[0].toLowerCase();  // f is the file system that holds the file; name is the file's last path part; op is the type in lower case
          const head = [['cmd', `fd = open("${r.p}"); read(fd, buf, n)`]];  // head: the first log line, the open and read calls the program makes
          if (r.fs === 4 && !mounted) {  // reading the photo before the stick is mounted
            draw({ fs: 0, bad: true });  // lights the root file system in red, because the path lands there and fails
            say(head.concat([['', 'open(): VFS walks the path / → media → usb. No file system is mounted at /media/usb,'], ['', 'so usb is just an empty folder on the root file system (s5fs on disk 0).'], ['bad', `open failed: ${name}: No such file or directory (read never runs)`], ['note', 'The stick is plugged in, but the kernel cannot read FAT yet. Load pcfs, then mount it.']]));  // log: the path walk ends in an empty folder on the root file system, so open fails and read never runs
            return;  // stops here so the success lines below are not shown
          }  // ends the not-mounted case
          draw({ fs: r.fs });  // lights the path through the file system that holds the file
          say(head.concat([['', `open(): VFS walks the path and crosses the mount point ${f.at} into the ${f.n.split(' ')[0]} file system.`], ['', `It gets the vnode for ${name}: v_op → ${op}_vnodeops, ${f.n.split(' ')[0]}'s table of operations. fd now refers to that vnode.`], ['', `read(fd): the kernel calls the vnode's read operation → ${op}_read() → ${f.dev}.`], ['ok', `Data returned. The system call code never knew which file system did the work.`]]));  // log: the path crosses the mount point, the vnode points to that file system's operations, and its read runs
        }  // ends doRead()
        const bReset = h('button', { class: 'btn ghost', type: 'button', onclick: () => { loaded = false; mounted = false; draw(); paintTable(); intro(); } }, 'Reset');  // Reset button: unloads pcfs, unmounts the stick and restores the starting diagram, table and log
        function intro() { say([['note', 'Four file-system types are registered: s5fs, FFS, NFS and RFS. A FAT-formatted USB stick is plugged in.'], ['note', 'Try reading <b>/media/usb/photo.jpg</b> now, then load pcfs, mount the stick and read it again.']]); }  // intro(): writes the starting instructions into the log
        el.append(h('div', { class: 'split l fill' },  // puts the lab together: controls on the left (5 parts), diagram and log on the right (7 parts)
          h('div', { class: 'stack' },  // the left column of the lab
            h('p', { class: 'm0', html: 'A USB stick formatted with FAT (a file-system layout from the PC world) arrives, and the kernel has no FAT code. Add support through the <span class="t">virtual file system (VFS)</span> interface without touching the core.' }),  // task paragraph: a FAT USB stick arrives and the kernel has no FAT code yet
            h('div', { class: 'card tight stack', style: { gap: '8px' } }, h('h4', 'Plug in the new file system'), h('div', { class: 'row' }, bLoad, bMount, bReset)),  // card with the two numbered buttons and Reset
            h('div', { class: 'card tight stack', style: { gap: '8px' } }, h('h4', 'Open and read a file'),  // card with the three file buttons, under the heading "Open and read a file"
              h('div', { class: 'row', style: { gap: '8px' } }, READS.map((r) => h('button', { class: 'btn sm mono', type: 'button', onclick: () => doRead(r) }, r.p)))),  // one small button per file in READS; a click runs doRead() for that file
            h('table', { class: 'tbl compact' }, h('thead', h('tr', h('th', 'Mount point'), h('th', 'Type'), h('th', 'Stored on'))), tbody),  // the mount table: mount point, type and where the files are stored
            h('div', { class: 'row', style: { gap: '28px' } },  // a row holding the two counters
              h('div', { class: 'stat' }, h('span', { class: 'xs' }, 'File-system types known'), typesV),  // counter: how many file-system types the kernel knows
              h('div', { class: 'stat' }, h('span', { class: 'xs' }, 'Core lines changed'), coreV))),  // counter: how many lines of core code changed (always 0)
          h('div', { class: 'stack' }, h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg), log)));  // the right column: the layer diagram in a white card, with the log under it
        draw(); paintTable(); intro();  // draws the diagram, fills the table and writes the instructions when the step opens
      },  // ends render() for step 4
    },  // ends step 4

    /* ---------------- 5. Learn: SVR4 merges the family ---------------- */
    {  // step 5 begins: how SVR4 merged four UNIX lines and what it added
      title: 'SVR4: AT&T and Sun put UNIX back together',  // step 5's title, shown as the screen heading
      kind: 'learn',  // kind "learn" labels this screen as a Learn step
      render(el, ctx) {  // render(el, ctx): builds the ancestry diagram, feature buttons and detail card when the step opens
        const { h, s } = ctx;  // takes h (builds page elements) and s (builds SVG shapes) from ctx
        const ANC = [  // ANC: the four systems that went into SVR4; each has a box label, subtitle, and detail-card texts
          { n: 'SVR3', sub: 'AT&T · commercial', t: 'SVR3 (AT&T, 1987): the System V trunk',  // ancestor 1: SVR3, AT&T's commercial System V line
            b: 'AT&T\'s own commercial UNIX and the main line that SVR4 continued. It contributed <span class="t">STREAMS</span>, the modular framework for terminal and network I/O, and RFS, AT&T\'s Remote File Sharing.',  // detail text for SVR3: the main line SVR4 continued, which brought STREAMS and RFS
            eg: 'SVR4 kept System V\'s programming interfaces, so existing System V programs still ran.' },  // example line for SVR3: existing System V programs still ran on SVR4
          { n: '4.3BSD', sub: 'UC Berkeley · academic', t: '4.3BSD (UC Berkeley, 1986): the academic line',  // ancestor 2: 4.3BSD, the academic line from Berkeley
            b: 'Berkeley\'s research-driven UNIX. It contributed TCP/IP networking with the <span class="t">socket</span> interface, the Fast File System (FFS), and user favourites such as the C shell and job control.',  // detail text for 4.3BSD: TCP/IP with sockets, the Fast File System, the C shell and job control
            eg: 'With BSD features inside System V, customers no longer had to choose one family or the other.' },  // example line for 4.3BSD: customers no longer had to choose between the two families
          { n: 'Xenix System V', sub: 'Microsoft · commercial', t: 'Xenix System V (Microsoft): UNIX on the PC',  // ancestor 3: Xenix System V, Microsoft's UNIX for Intel PCs
            b: 'Microsoft\'s UNIX for Intel-based personal computers, one of the most widely installed UNIX systems of the 1980s. SVR4 included compatibility so existing Xenix programs kept running on Intel machines.',  // detail text for Xenix: a widely installed PC UNIX whose programs kept running under SVR4
            eg: 'Bringing Xenix in meant the large base of PC UNIX users could move to SVR4.' },  // example line for Xenix: PC UNIX users could move to SVR4
          { n: 'SunOS', sub: 'Sun · commercial', t: 'SunOS (Sun Microsystems): the workstation line',  // ancestor 4: SunOS, Sun's BSD-based workstation UNIX
            b: 'Sun\'s BSD-based UNIX for its workstations. It contributed the vnode/vfs file-system interface, NFS, and a new virtual memory design built around mapping files into memory, plus shared libraries.',  // detail text for SunOS: vnode/vfs, NFS, the file-mapping memory design and shared libraries
            eg: 'Much of the modular kernel you explored in this section came to SVR4 from SunOS.' },  // example line for SunOS: much of this section's modular kernel came from SunOS
        ];  // ends the list of ancestors
        const SVR4 = { t: 'System V Release 4 (1989): one UNIX again',  // SVR4: the detail-card texts for the SVR4 box itself
          b: '<span class="t">System V Release 4 (SVR4)</span> was developed jointly by AT&T and Sun Microsystems. It combined the four systems on the left and was an almost total rewrite of the System V kernel. It drew on commercial work (SVR3, Xenix, SunOS) and academic work (4.3BSD), and it was meant to be one uniform platform for commercial UNIX.',  // detail text for SVR4: built by AT&T and Sun, it merged four systems on a rewritten kernel
          eg: 'Vendors ported it to everything from desktop machines with 32-bit microprocessors up to supercomputers. Click a feature on the right to see what was new.' };  // example line for SVR4: it ran on machines of every size; also tells the student to click a feature
        const FEAT = [  // FEAT: the six major new features of SVR4, each with a button label and detail-card texts
          { n: 'Real-time processing support', t: 'Real-time processing support',  // feature 1: real-time processing support
            b: 'A real-time scheduling class whose processes get fixed priorities above every other class. A time-critical task, such as controlling a machine or playing audio, gets the processor within a short, predictable delay.',  // detail text: a real-time class whose fixed priorities are above every other class
            eg: 'Real-time processes outrank even the kernel\'s own system processes.' },  // example line: real-time processes outrank even kernel system processes
          { n: 'Process scheduling classes', t: 'Process scheduling classes',  // feature 2: process scheduling classes
            b: 'Scheduling is split into <span class="t">scheduling class</span>es, each with its own rules and its own band of priorities. SVR4 uses 160 priority levels: time-sharing 0 to 59, system 60 to 99 and real-time 100 to 159.',  // detail text: each class has its own band of the 160 priority levels
            eg: 'The dispatcher simply runs the highest-priority ready process; each class decides how its own members\' priorities move.' },  // example line: the dispatcher runs the top priority; each class moves its own members' priorities
          { n: 'Dynamically allocated data structures', t: 'Dynamically allocated data structures',  // feature 3: dynamically allocated data structures
            b: 'Older kernels reserved fixed-size tables (for processes, open files and so on) when the kernel was built. A full table meant "no more processes" even with plenty of free memory, and a mostly empty table wasted memory. SVR4 allocates these structures as they are needed.',  // detail text: fixed-size tables wasted memory or ran out; SVR4 allocates kernel structures as needed
            eg: 'The limit becomes the memory you actually have, not a number chosen when the kernel was compiled.' },  // example line: the limit becomes the memory actually installed
          { n: 'Virtual memory management', t: 'Virtual memory management',  // feature 4: virtual memory management
            b: 'A new virtual memory system based on SunOS\'s design: each address space is a set of mappings of files, devices or anonymous memory, and programs can map files straight into memory.',  // detail text: SunOS's mapping-based memory design, which lets programs map files into memory
            eg: 'This is the virtual memory framework from the hub, with its file, device and anonymous mappings.' },  // example line: the same VM framework the student explored on the hub
          { n: 'Virtual file system', t: 'Virtual file system',  // feature 5: the virtual file system
            b: 'The vnode/vfs interface, so many file-system types (s5fs, FFS, NFS, RFS and more) work side by side behind the same system calls.',  // detail text: vnode/vfs lets many file-system types work behind the same system calls
            eg: 'Exactly what you used in the hot-swap lab to add pcfs without touching the core.' },  // example line: the interface used in the hot-swap lab
          { n: 'Preemptive kernel', t: 'Preemptive kernel',  // feature 6: the preemptive kernel
            b: 'Earlier UNIX kernels ran a system call until it finished or blocked before switching to another process. SVR4 added preemption points: safe places inside long kernel paths where it checks for a more urgent process and, if one is waiting, switches to it right away.',  // detail text: preemption points let a long system call give way to a more urgent process
            eg: 'A <span class="t">preemptive kernel</span> keeps waiting times short, which real-time processes need.' },  // example line: short waits are what real-time processes need
        ];  // ends the list of features
        const det = h('div', { class: 'card det grow' });  // det: the detail card under the two diagrams, refilled whenever something is clicked
        const svg = s('svg', { viewBox: '0 0 540 222', width: '100%' });  // svg: the drawing surface for the four ancestors flowing into SVR4
        const hot = [];  // hot collects the five clickable boxes: the four ancestors, then SVR4 at index 4
        function show(item, tag, cls) {  // show(item, tag, cls): fills the detail card with a coloured tag chip, a heading, the text and an example
          det.replaceChildren(h('span', { class: 'chip ' + cls, style: { marginTop: '3px' } }, tag),  // the tag chip on the left, such as "ancestor", "the result" or "new in SVR4"
            h('div', {}, h('h3', item.t), h('p', { html: item.b }), h('div', { class: 'eg', html: item.eg })));  // the heading, paragraph and example box on the right
          ctx.refit();  // asks the guide to re-measure the screen, since the card's height may have changed
        }  // ends show()
        function selAnc(i) { hot.forEach((g, k) => g.classList.toggle('sel', k === i)); svg.classList.add('dimmer'); tiles.forEach((b) => b.classList.remove('on')); i === 4 ? show(SVR4, 'the result', 'os') : show(ANC[i], 'ancestor', 'accent'); }  // selAnc(i): after a click on box i, selects it, fades the rest, clears the feature buttons and shows its details
        ANC.forEach((a, i) => {  // draws each ancestor's box and its arrow into SVR4
          const y = 6 + i * 54, ey = 87 + i * 16;  // y is the ancestor box's top edge; ey is where its arrow enters the SVR4 box, spaced 16 units apart
          svg.append(s('path', { d: `M208 ${y + 24} C 268 ${y + 24}, 272 ${ey}, 326 ${ey}`, class: 's-line', 'stroke-width': 2.2, 'marker-end': 'url(#arr-os)' }));  // a smooth curve (C = curve) from the ancestor box to SVR4, ending in the guide's shared arrowhead
          const g = s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': a.n },  // g: the ancestor's clickable group, focusable from the keyboard
            s('rect', { x: 8, y, width: 200, height: 46, rx: 11, class: 's-accent fr', 'stroke-width': 2 }),  // the ancestor's box in the accent colour; .fr marks the frame that thickens on hover
            s('text', { x: 20, y: y + 20, 'font-size': 16, 'font-weight': 800 }, a.n),  // the ancestor's name in bold
            s('text', { x: 20, y: y + 38, 'font-size': 13, class: 's-sub' }, a.sub));  // the ancestor's subtitle: who made it and whether it was commercial or academic
          hot.push(g);  // remembers the box in the clickable list
        });  // ends the loop over ancestors
        const g4 = s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': 'SVR4' },  // g4: the clickable SVR4 box on the right of the drawing
          s('rect', { x: 332, y: 61, width: 200, height: 100, rx: 14, class: 's-os fr', 'stroke-width': 2.5 }),  // the SVR4 box, larger and in the operating-system colour
          s('text', { x: 432, y: 97, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 900, style: 'fill:var(--os)' }, 'SVR4'),  // the large "SVR4" title
          s('text', { x: 432, y: 121, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, '1989 · AT&T + Sun'),  // the year and the two companies that built it
          s('text', { x: 432, y: 141, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'kernel almost fully rewritten'));  // subtitle: the kernel was almost fully rewritten
        hot.push(g4);  // adds SVR4 to the clickable list as index 4
        svg.append(...hot, s('text', { x: 432, y: 190, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'click any box'));  // adds all five boxes to the drawing, plus a small "click any box" hint under SVR4
        hot.forEach((g, i) => { g.addEventListener('click', () => selAnc(i)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selAnc(i); } }); });  // each box responds to a click, or to Enter or Space from the keyboard, by calling selAnc()
        const tiles = FEAT.map((f, i) => h('button', { class: 'ftile', type: 'button', onclick: () => {  // tiles: one button per new feature; clicking one shows that feature in the detail card
          tiles.forEach((b, k) => b.classList.toggle('on', k === i)); hot.forEach((g) => g.classList.remove('sel')); svg.classList.remove('dimmer'); show(f, 'new in SVR4', 'os');  // marks the clicked tile as chosen, clears the box selection and fading, and shows the feature's details
        } }, h('span', { class: 'n' }, String(i + 1)), h('span', f.n)));  // ends the click handler; each tile then holds its number badge and the feature's name
        el.append(h('div', { class: 'stack fill' },  // puts the screen together as one column
          h('p', { class: 'lead m0', html: 'In 1989, AT&T and Sun Microsystems pulled four major UNIX lines back into one system: <b>SVR4</b>.' }),  // opening line: in 1989 AT&T and Sun merged four UNIX lines into SVR4
          h('div', { class: 'grid-2', style: { alignItems: 'stretch' } },  // a two-column grid, both cards stretched to the same height
            h('div', { class: 'card white stack', style: { gap: '4px', padding: '10px 12px' } }, h('h4', 'Four systems went in'), svg),  // left card: "Four systems went in" with the ancestry drawing
            h('div', { class: 'card white stack', style: { gap: '8px', padding: '10px 12px' } }, h('h4', 'Six big features were new'), h('div', { class: 'ftiles' }, tiles))),  // right card: "Six big features were new" with the feature tiles in two columns
          det));  // the detail card fills the space under both cards
        hot[4].classList.add('sel'); show(SVR4, 'the result', 'os'); // start undimmed so all four ancestors read clearly
      },  // ends render() for step 5
    },  // ends step 5

    /* ---------------- 6. Explore: the BSD line and the family tree ---------------- */
    {  // step 6 begins: an explorable family tree of UNIX with the BSD line in the middle
      title: 'The BSD line and the UNIX family tree',  // step 6's title, shown as the screen heading
      kind: 'explore',  // kind "explore" labels this screen as an Explore step
      render(el, ctx) {  // render(el, ctx): builds the family tree and its side panel when the step opens
        const { h, s } = ctx;  // takes h (builds page elements) and s (builds SVG shapes) from ctx
        const LANES = [['Apple', 34], ['Free BSDs', 116], ['Berkeley', 196], ['Bell Labs', 252], ['Sun, Oracle', 308], ['AT&T', 364], ['Microsoft', 416]];  // LANES: the row labels on the left of the tree (who made the systems in that row) and each row's height
        const N = {  // N: every system on the tree, keyed by a short id: label, year, position, width, parents (p) and story texts
          unix: { n: 'Research UNIX', yr: '1970 · Bell Labs', y: 252, x: 150, w: 128, p: [], t: 'Research UNIX (Bell Labs, from 1970)', b: 'Ken Thompson and Dennis Ritchie\'s system at AT&T\'s Bell Labs, running on a PDP-7 by 1970 and rewritten in C in 1973 (section 2.8 covers it). Its licensed source code seeded every branch on this map.' },  // tree box: Research UNIX from Bell Labs, the root with no parents
          bsd3: { n: 'early BSD', yr: '1978–81', y: 196, x: 226, w: 80, p: ['unix'], t: 'Early BSD (UC Berkeley, 1978 to 1981)', b: 'Berkeley began shipping its own additions to AT&T\'s UNIX as the Berkeley Software Distribution in 1978. 3BSD (1979) added paged virtual memory on DEC VAX computers, so programs could be larger than physical memory, and 4.1BSD (1981) refined it. Sun\'s first SunOS was built from this code.' },  // tree box: early BSD from Berkeley, which added paged virtual memory
          bsd42: { n: '4.2BSD', yr: '1983', y: 196, x: 320, w: 76, p: ['bsd3'], t: '4.2BSD (1983)', b: 'Built TCP/IP networking into the kernel, together with the <span class="t">socket</span> interface that programs still use today, and introduced the Fast File System (FFS).' },  // tree box: 4.2BSD, which brought TCP/IP, sockets and the Fast File System
          bsd43: { n: '4.3BSD', yr: '1986', y: 196, x: 410, w: 76, p: ['bsd42'], t: '4.3BSD (1986)', b: 'A faster, polished 4.2BSD. It fed into SVR4 and, together with Mach, into NeXTSTEP.' },  // tree box: 4.3BSD, which fed into both SVR4 and NeXTSTEP
          bsd44: { n: '4.4BSD', yr: '1993–94', y: 196, x: 512, w: 84, p: ['bsd43'], t: '4.4BSD (1993 to 1994): the last one', b: 'The final release of the <span class="t">Berkeley Software Distribution (BSD)</span>; the Berkeley research group closed in 1995. A version with all AT&T code removed, 4.4BSD-Lite (1994), became the common base of the free BSDs.' },  // tree box: 4.4BSD, Berkeley's last release and base of the free BSDs
          free: { n: 'FreeBSD', yr: '1993', y: 92, x: 470, w: 80, p: ['bsd44'], t: 'FreeBSD (1993)', b: 'Started in 1993 from Berkeley\'s freely released code (by way of 386BSD, a port to Intel PCs) and rebuilt on 4.4BSD-Lite in 1994. Aims at performance and ease of use. Widely used in servers and network appliances, and a major source of the BSD code inside macOS.' },  // tree box: FreeBSD, the performance-minded free BSD that also feeds macOS
          net: { n: 'NetBSD', yr: '1993', y: 140, x: 562, w: 76, p: ['bsd44'], t: 'NetBSD (1993)', b: 'Also started in 1993 from the freely released Berkeley code and rebuilt on 4.4BSD-Lite. Aims at portability: the same code runs on an unusually wide range of hardware, from large servers to small embedded boards.' },  // tree box: NetBSD, the free BSD that aims to run on the widest range of hardware
          open: { n: 'OpenBSD', yr: '1996', y: 140, x: 650, w: 80, p: ['net'], t: 'OpenBSD (1996)', b: 'Split from NetBSD with a strong focus on security and carefully audited code. Its best-known export is OpenSSH, the secure remote-login tool.' },  // tree box: OpenBSD, split from NetBSD with a focus on security
          mach: { n: 'Mach', yr: '1985 · CMU', y: 34, x: 280, w: 96, p: [], t: 'Mach (Carnegie Mellon University, 1985)', b: 'A research kernel that became the best-known microkernel: a small kernel that handles tasks, threads, messages and virtual memory, leaving other services to run on top of it.' },  // tree box: Mach, the research microkernel from Carnegie Mellon, a second root
          next: { n: 'NeXTSTEP', yr: '1989', y: 34, x: 400, w: 88, p: ['mach', 'bsd43'], t: 'NeXTSTEP (1989)', b: 'The system on Steve Jobs\'s NeXT computers: Mach combined with 4.3BSD code. Apple agreed to buy NeXT at the end of 1996 and built its next operating system from it.' },  // tree box: NeXTSTEP, Mach combined with 4.3BSD; two parents
          mac: { n: 'macOS', yr: '2001 · Apple', y: 34, x: 620, w: 104, p: ['next', 'free'], t: 'macOS (from 2001, Apple)', b: 'First released as Mac OS X in 2001. Its open-source core, <span class="t">Darwin</span>, has a kernel that joins the Mach microkernel with a large layer of FreeBSD code. The same foundation runs iPhones and iPads.' },  // tree box: macOS, built from NeXTSTEP with FreeBSD code; two parents
          sunos: { n: 'SunOS', yr: '1982', y: 308, x: 262, w: 76, p: ['bsd3'], t: 'SunOS (1982)', b: 'Sun Microsystems\' UNIX for its workstations, first built from 4.1BSD code and later updated with 4.2BSD and 4.3BSD features. Home of NFS and the vnode/vfs interface, which it later brought into SVR4.' },  // tree box: SunOS, Sun's workstation UNIX, first built from early BSD code
          sol2: { n: 'Solaris 2', yr: '1992', y: 308, x: 520, w: 84, p: ['svr4'], t: 'Solaris 2 (1992)', b: 'Sun moves from its BSD-based SunOS to an SVR4 base and calls the result Solaris. Its kernel is multithreaded, built for machines with many processors.' },  // tree box: Solaris 2, where Sun moved to an SVR4 base
          sol11: { n: 'Solaris 11', yr: '2011 · Oracle', y: 308, x: 636, w: 104, p: ['sol2'], t: 'Solaris 11 (2011, Oracle)', b: 'Oracle bought Sun in 2010 and released Solaris 11 in 2011: an SVR4-based UNIX with a fully preemptable multithreaded kernel, full SMP support and an object-oriented file-system interface. The next step shows those features at work.' },  // tree box: Solaris 11 from Oracle, the subject of the next step
          sysv: { n: 'System V', yr: '1983', y: 364, x: 250, w: 84, p: ['unix'], t: 'System V (AT&T, 1983)', b: 'AT&T\'s commercial UNIX line, licensed to computer makers who built their own versions on it.' },  // tree box: System V, AT&T's commercial line
          svr3: { n: 'SVR3', yr: '1987', y: 364, x: 350, w: 70, p: ['sysv'], t: 'SVR3 (1987)', b: 'Added STREAMS and Remote File Sharing (RFS), among other features.' },  // tree box: SVR3, which added STREAMS and RFS
          svr4: { n: 'SVR4', yr: '1989', y: 364, x: 450, w: 80, p: ['svr3', 'bsd43', 'xenix', 'sunos'], t: 'SVR4 (1989)', b: 'AT&T and Sun merge SVR3, 4.3BSD, Xenix System V and SunOS into one system. Solaris descends directly from it.' },  // tree box: SVR4, with four parents: SVR3, 4.3BSD, Xenix and SunOS
          xenix: { n: 'Xenix', yr: '1980 · Microsoft', y: 416, x: 200, w: 118, p: ['unix'], t: 'Xenix (Microsoft, 1980)', b: 'Microsoft\'s licensed UNIX for small computers, later based on System V and widely installed on Intel PCs. It fed into SVR4.' },  // tree box: Xenix from Microsoft, which fed into SVR4
        };  // ends the table of systems
        // hand-routed edges [from, to, path]
        const E = [  // E: the lines of the tree, each [parent id, child id, drawing path] with the path set by hand to avoid overlaps
          ['unix', 'bsd3', 'M190 232 L214 216'], ['unix', 'sysv', 'M172 272 L232 344'], ['unix', 'xenix', 'M130 272 L178 396'],  // edges from Research UNIX to early BSD, System V and Xenix
          ['bsd3', 'bsd42', 'M266 196 H282'], ['bsd42', 'bsd43', 'M358 196 H372'], ['bsd43', 'bsd44', 'M448 196 H470'],  // edges along the Berkeley row: early BSD to 4.2BSD to 4.3BSD to 4.4BSD
          ['bsd3', 'sunos', 'M232 216 L256 288'], ['bsd43', 'svr4', 'M414 216 L444 344'], ['bsd43', 'next', 'M404 176 L400 54'],  // edges from early BSD to SunOS, and from 4.3BSD up to NeXTSTEP and down to SVR4
          ['bsd44', 'free', 'M500 176 L478 112'], ['bsd44', 'net', 'M530 176 L550 160'], ['net', 'open', 'M600 140 H610'],  // edges from 4.4BSD to FreeBSD and NetBSD, and from NetBSD to OpenBSD
          ['mach', 'next', 'M328 34 H356'], ['next', 'mac', 'M444 34 H568'], ['free', 'mac', 'M506 76 L596 54'],  // edges into macOS: Mach to NeXTSTEP to macOS, plus FreeBSD to macOS
          ['sysv', 'svr3', 'M292 364 H315'], ['svr3', 'svr4', 'M385 364 H410'], ['sunos', 'svr4', 'M300 312 C 380 312, 410 322, 430 344'],  // edges along AT&T's row (System V to SVR3 to SVR4) and the curve from SunOS into SVR4
          ['xenix', 'svr4', 'M259 416 C 380 416, 440 410, 450 384'], ['svr4', 'sol2', 'M476 344 L508 328'], ['sol2', 'sol11', 'M562 308 H584'],  // the curve from Xenix into SVR4, then SVR4 to Solaris 2 to Solaris 11
        ];  // ends the edge list
        const svg = s('svg', { viewBox: '0 0 700 440', width: '100%', class: 'tree' });  // svg: the drawing surface for the tree, with the class its step 6 styles target
        LANES.forEach(([t, y]) => svg.append(s('text', { x: 8, y: y + 5, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, t)));  // writes each row label down the left edge of the tree
        const edgeEls = E.map(([a, b, d]) => { const p = s('path', { d, class: 'edge' }); svg.append(p); return { a, b, p }; });  // draws every edge and remembers its shape with its two ends, so a traced line can light it
        const nodeEls = {};  // nodeEls: each system's clickable group, looked up by id
        Object.entries(N).forEach(([id, nd]) => {  // draws a box for every system in N
          const g = s('g', { class: 'hot node' + (id === 'unix' ? ' root' : ''), tabindex: 0, role: 'button', 'aria-label': nd.n },  // g: the system's clickable group; the Research UNIX box also gets the root style
            s('rect', { x: nd.x - nd.w / 2, y: nd.y - 20, width: nd.w, height: 40, rx: 12, class: 'fr', 'stroke-width': 2 }),  // the box outline, centred on the system's position
            s('text', { x: nd.x, y: nd.y - 3, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800 }, nd.n),  // the system's name in bold
            s('text', { x: nd.x, y: nd.y + 13, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, nd.yr));  // the year (and maker, for some) in small grey text
          g.addEventListener('click', () => pick(id));  // clicking the box shows its story
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); } });  // Enter or Space on a focused box does the same, for keyboard users
          nodeEls[id] = g; svg.append(g);  // remembers the box by id and adds it to the drawing
        });  // ends the loop over systems
        const info = h('div', { class: 'info' });  // info: the story panel on the right, filled with the clicked system's history
        function ancestors(id, acc = new Set()) { acc.add(id); N[id].p.forEach((q) => ancestors(q, acc)); return acc; }  // ancestors(id): collects id and, by calling itself on each parent, every system it descends from, into a set
        function trace(id) {  // trace(id): lights up one system's whole family line on the tree, or clears the tracing when id is null
          const set = id ? ancestors(id) : new Set();  // set holds the system and all its ancestors (empty when clearing)
          svg.classList.toggle('tracing', !!id);  // turns on the "tracing" look, which fades everything not on the line
          Object.entries(nodeEls).forEach(([k, g]) => g.classList.toggle('on', set.has(k)));  // lights every box whose id is in the set
          edgeEls.forEach((e) => e.p.classList.toggle('on', set.has(e.a) && set.has(e.b)));  // lights an edge only when both of its ends are on the line
        }  // ends trace()
        function pick(id, keepTrace) {  // pick(id, keepTrace): selects a system and shows its story; keepTrace leaves a traced line in place
          Object.entries(nodeEls).forEach(([k, g]) => g.classList.toggle('sel', k === id));  // gives the selected look to the clicked box only
          if (!keepTrace) { trace(null); traceBtns.forEach((b) => b.classList.remove('on')); }  // a plain click on the tree clears any traced line and un-highlights the trace buttons
          info.replaceChildren(h('h3', { html: N[id].t }), h('p', { html: N[id].b }), h('p', { class: 'small muted m0' }, 'Click any box on the tree to read its story.'));  // fills the story panel: the system's title, its history, and a small reminder to click other boxes
          ctx.refit();  // asks the guide to re-measure the screen, since the panel's height changed
        }  // ends pick()
        const TR = [['mac', 'macOS'], ['sol11', 'Solaris 11'], ['open', 'OpenBSD'], ['free', 'FreeBSD']];  // TR: the four trace buttons, each naming the system whose family line it lights
        const traceBtns = TR.map(([id, label]) => h('button', { class: 'btn sm', type: 'button', onclick: () => {  // traceBtns: one small button per entry in TR
          traceBtns.forEach((b) => b.classList.toggle('on', b === traceBtns[TR.findIndex((t) => t[0] === id)])); trace(id); pick(id, true);  // marks only this button as chosen, traces the line back from its system, and shows that system's story
        } }, label));  // ends the button's click handler; the button shows the system's name
        el.append(h('div', { class: 'split gen fill' },  // puts the screen together: tree on the left (two thirds), panels on the right
          h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center', padding: '8px 10px' } }, svg),  // the white card holding the family tree, centred
          h('div', { class: 'stack', style: { gap: '10px' } },  // the right column
            h('div', { class: 'stack', style: { gap: '6px' } }, h('h4', 'Trace a family line'), h('div', { class: 'row', style: { gap: '6px' } }, traceBtns)),  // "Trace a family line" heading over the row of trace buttons
            h('div', { class: 'card grow', style: { padding: '10px 14px' } }, info),  // the story card, which grows to fill the free height
            h('div', { class: 'card tight', style: { borderLeft: '4px solid var(--accent)' } },  // the "What BSD gave every UNIX" card, with an accent bar on its left
              h('h4', 'What BSD gave every UNIX'),  // heading of the BSD card
              h('div', { class: 'gift' },  // the BSD card's grid of bold labels and short descriptions
                h('b', 'Virtual memory'), h('span', 'paging, from 3BSD (1979)'),  // row: paged virtual memory from 3BSD
                h('b', 'Networking'), h('span', 'TCP/IP in the kernel plus the socket interface, 4.2BSD (1983)'),  // row: TCP/IP networking and sockets from 4.2BSD
                h('b', 'Fast File System'), h('span', 'FFS, 4.2BSD (1983)'),  // row: the Fast File System from 4.2BSD
                h('b', 'Lives on in'), h('span', 'FreeBSD, NetBSD, OpenBSD and macOS'))))));  // row: the systems where BSD code still lives
        traceBtns[0].click();  // clicks the first trace button (macOS) so the step opens with a family line already lit
      },  // ends render() for step 6
    },  // ends step 6

    /* ---------------- 7. Explore: Solaris 11 on many CPUs ---------------- */
    {  // step 7 begins: two small simulations of Solaris 11's kernel on several processors
      title: 'Solaris 11: a preemptable, multithreaded kernel on many CPUs',  // step 7's title, shown as the screen heading
      kind: 'explore',  // kind "explore" labels this screen as an Explore step
      render(el, ctx) {  // render(el, ctx): builds the feature cards and both simulations when the step opens
        const { h, s } = ctx;  // takes h (builds page elements) and s (builds SVG shapes) from ctx
        const LOCKN = { f: 'files', m: 'mem', n: 'net', s: 'sched' };  // LOCKN: the display name for each kernel lock letter: files, memory, network and scheduler
        // each CPU runs one thread: U = user work, K = kernel work needing a lock
        const SCR = [  // SCR: one work script per CPU: [kind, ticks] for user work, [kind, ticks, lock] for kernel work
          [['U', 1], ['K', 3, 'f'], ['U', 2], ['K', 2, 'm'], ['U', 2]],  // CPU 0's script: user, 3 ticks holding the files lock, user, 2 ticks holding the memory lock, user
          [['K', 2, 'm'], ['U', 2], ['K', 2, 'n'], ['U', 3]],  // CPU 1's script: memory lock, user, network lock, user
          [['U', 2], ['K', 2, 'n'], ['U', 1], ['K', 3, 'f'], ['U', 1]],  // CPU 2's script: user, network lock, user, 3 ticks holding the files lock, user
          [['K', 2, 's'], ['U', 2], ['K', 2, 'f'], ['U', 2]],  // CPU 3's script: scheduler lock, user, files lock, user
        ];  // ends the scripts
        function simLocks(big, T) {  // simLocks(big, T): runs the four scripts for T ticks with one big kernel lock (big) or one lock per structure
          const pos = SCR.map(() => ({ seg: 0, done: 0 })), holder = {}, since = {}, grid = SCR.map(() => []);  // pos: each CPU's place in its script (segment and ticks done); holder: who holds each lock; since: when each waiter began; grid: the result
          let waits = 0; const fin = SCR.map(() => T);  // waits counts every tick a CPU spends waiting; fin records the tick each CPU finishes (T if it never does)
          for (let t = 0; t < T; t++) {  // steps through time one tick at a time
            const want = [];  // want collects the CPUs that need a lock they do not hold yet
            SCR.forEach((sc, c) => { const g = sc[pos[c].seg]; if (g && g[0] === 'K') { const L = big ? 'G' : g[2]; if (holder[L] !== c) want.push([c, L]); } });  // a CPU doing kernel work wants its lock; in big-lock mode every kernel segment wants the single lock "G"
            want.sort((x, y) => (since[x[0]] ?? t) - (since[y[0]] ?? t) || x[0] - y[0]);  // orders the waiters: whoever started waiting earliest goes first, ties broken by CPU number
            want.forEach(([c, L]) => { if (holder[L] == null) { holder[L] = c; delete since[c]; } });  // hands each free lock to the first waiter that wants it, and clears that CPU's waiting mark
            SCR.forEach((sc, c) => {  // now works out what each CPU does during this tick
              const P = pos[c], g = sc[P.seg];  // P is the CPU's place in its script, g its current segment
              if (!g) { grid[c].push('-'); return; }  // a CPU with nothing left to do records "-" (idle)
              if (g[0] === 'K' && holder[big ? 'G' : g[2]] !== c) { grid[c].push('W'); waits++; if (since[c] == null) since[c] = t; return; }  // kernel work without the lock: records a wait ("W"), counts it, and notes when this CPU started waiting
              grid[c].push(g[0] === 'K' ? 'K' + g[2] : 'U');  // otherwise the CPU works: records "K" plus the lock letter for kernel work, or "U" for user work
              if (++P.done >= g[1]) { if (g[0] === 'K') delete holder[big ? 'G' : g[2]]; P.seg++; P.done = 0; if (!sc[P.seg]) fin[c] = t + 1; }  // after the segment's last tick: releases its lock, moves on to the next segment, and notes the finish tick if done
            });  // ends the per-CPU loop
          }  // ends the tick loop
          return { grid, waits, last: Math.max(...fin) };  // returns the tick-by-tick grid, the total waiting ticks and the tick when the last CPU finished
        }  // ends simLocks()
        // draw rows of tick states as merged blocks
        function gantt(svg, rows, labels, T, cw, style) {  // gantt(svg, rows, labels, T, cw, style): draws a timing chart (a Gantt chart), one row per CPU or thread
          const kids = [];  // kids collects every shape of the chart
          rows.forEach((row, r) => {  // draws each row in turn
            const y = 4 + r * 30;  // y is the row's top edge; rows are 30 units apart
            kids.push(s('text', { x: 0, y: y + 18, 'font-weight': 700 }, labels[r]));  // the row's label, such as "CPU 0", at the left edge
            let t = 0;  // t walks along the row, one run of ticks at a time
            while (t < T) {  // keeps going until the end of the row
              let k = t; while (k + 1 < T && row[k + 1] === row[t]) k++;  // k finds the last tick of the run of identical states starting at t
              const st = style(row[t]);  // style() turns the state into a colour class, a label and a text colour, or null for no block
              if (st) {  // draws a block only for states that have a style
                const w = (k - t + 1) * cw - 3;  // the block's width covers the whole run, minus a small gap between blocks
                kids.push(s('rect', { x: 58 + t * cw, y, width: w, height: 26, rx: 6, class: st.cls, 'stroke-width': 1.5 }));  // the block, starting 58 units in (past the labels) at its first tick
                if (st.label && w >= st.label.length * 6.6 + 4) kids.push(s('text', { x: 58 + t * cw + w / 2, y: y + 18, 'text-anchor': 'middle', 'font-weight': 700, style: st.color || null }, st.label));  // writes the block's label in its middle, but only when the block is wide enough to hold the text
              }  // ends the block drawing
              t = k + 1;  // jumps to the first tick after this run
            }  // ends the walk along the row
          });  // ends the loop over rows
          const ay = 4 + rows.length * 30 + 12;  // ay: the height of the tick-number line under the last row
          for (let t = 0; t <= T; t += 2) kids.push(s('text', { x: 58 + t * cw, y: ay, 'text-anchor': 'middle', class: 's-sub' }, String(t)));  // writes the tick numbers 0, 2, 4 ... along the bottom as a time axis
          svg.replaceChildren(...kids);  // clears the chart and puts in the new shapes
        }  // ends gantt()
        // --- sim A: many CPUs in the kernel at once
        const TA = 20, cwA = 28;  // simulation A runs for 20 ticks; each tick is 28 units wide on the chart
        const svgA = s('svg', { viewBox: `0 0 ${58 + TA * cwA + 12} 140`, width: '100%', class: 'gantt' });  // svgA: the drawing surface for simulation A's chart, sized to fit the labels and 20 ticks
        const lostA = h('div', { class: 'v' }), lastA = h('div', { class: 'v' });  // lostA: the total ticks spent waiting; lastA: the tick when the last CPU finished
        const capA = h('div', { class: 'simcap', style: { flex: '1 1 260px' } });  // capA: the explanation under simulation A's chart
        function runA(mode) {  // runA(mode): runs and redraws simulation A when the student picks a lock design
          const big = mode === 'big', r = simLocks(big, TA);  // big is true for the one-big-lock design; r holds the simulation's results
          gantt(svgA, r.grid, ['CPU 0', 'CPU 1', 'CPU 2', 'CPU 3'], TA, cwA, (x) => x === 'U' ? { cls: 's-proc', label: 'user' } : x === 'W' ? { cls: 's-bad', label: 'wait', color: 'fill:var(--bad)' } : x[0] === 'K' ? { cls: 's-os', label: big ? 'kernel' : LOCKN[x[1]] } : null);  // draws the four CPU rows: teal user blocks, red wait blocks, and purple kernel blocks labelled with their lock
          lostA.textContent = r.waits; lostA.className = 'v ' + (r.waits > 5 ? 'bad-t' : 'ok-t');  // shows the waiting total, red when it is large (more than 5) and green otherwise
          lastA.textContent = 'tick ' + r.last;  // shows when the last CPU finished
          capA.innerHTML = big  // picks the explanation that matches the chosen design
            ? 'One lock guards the whole kernel, so only <b>one CPU at a time</b> runs kernel code. The others sit idle (red) even when they need different data, so the work takes almost twice as long.'  // explanation for one big lock: only one CPU at a time runs kernel code, so others sit idle
            : 'Each kernel data structure has its own lock, so CPUs run kernel code <b>in parallel</b> unless they need the same data. CPU 2 waits once (tick 5) for CPU 3 to free the files lock.';  // explanation for fine-grained locks: CPUs work in parallel, and CPU 2 waits only once for the files lock
        }  // ends runA()
        const segA = ctx.ui.seg([{ value: 'big', label: 'One big kernel lock' }, { value: 'fine', label: 'Fine-grained locks (Solaris)' }], 'fine', runA);  // the two lock-design buttons for simulation A; picking one reruns it, starting with fine-grained locks
        // --- sim B: an urgent thread wakes on CPU 0
        const TB = 14, cwB = 40;  // simulation B runs for 14 ticks on one CPU; each tick is 40 units wide on the chart
        const svgB = s('svg', { viewBox: `0 0 ${58 + TB * cwB + 12} 96`, width: '100%', class: 'gantt' });  // svgB: the drawing surface for simulation B's chart, sized for two rows and 14 ticks
        const waitB = h('div', { class: 'v' }), capB = h('div', { class: 'simcap', style: { flex: '1 1 260px' } });  // waitB: how many ticks R had to wait; capB: the explanation under simulation B's chart
        const PLAN = { none: 8, points: 4, full: 2 }; // tick at which the urgent thread R starts (it wakes at tick 2)
        function runB(mode) {  // runB(mode): runs and redraws simulation B for the chosen kind of preemption
          const start = PLAN[mode], cpu = [], rrow = [];  // start is when R gets the CPU in this mode; cpu is what CPU 0 does each tick; rrow is what R is doing
          let k = 0; // T1: 1 user tick, 7 kernel ticks, 4 user ticks; R: 2 ticks of work
          const t1 = ['U'].concat(Array(7).fill('K'), Array(4).fill('U'));  // t1: thread T1's work, tick by tick: 1 user tick, 7 kernel ticks, then 4 user ticks
          for (let t = 0; t < TB; t++) {  // fills both rows one tick at a time
            if (t >= start && t < start + 2) { cpu.push('R'); rrow.push('X'); }  // during R's two ticks, CPU 0 runs R and R's own row shows it running
            else { cpu.push(t1[k++] || '-'); rrow.push(t >= 2 && t < start ? 'W' : '-'); }  // otherwise CPU 0 continues T1 where it left off; R's row shows waiting between its wake-up and its start
          }  // ends the tick loop
          gantt(svgB, [cpu, rrow], ['CPU 0', 'thread R'], TB, cwB, (x) => x === 'U' ? { cls: 's-proc', label: 'T1 user' } : x === 'K' ? { cls: 's-os', label: 'T1 in kernel' } : x === 'R' ? { cls: 's-warn', label: 'R', color: 'fill:var(--warn)' } : x === 'X' ? { cls: 's-warn', label: 'R runs', color: 'fill:var(--warn)' } : x === 'W' ? { cls: 's-bad', label: 'R waits', color: 'fill:var(--bad)' } : null);  // draws the two rows: T1's user and kernel blocks on CPU 0, R in amber, and R's red waiting stretch
          svgB.prepend(s('line', { x1: 58 + 2 * cwB - 2, y1: 0, x2: 58 + 2 * cwB - 2, y2: 64, style: 'stroke:var(--warn)', 'stroke-width': 2.5, 'stroke-dasharray': '4 3' }));  // adds a dashed amber line at tick 2, behind the blocks, marking the moment R wakes
          svgB.append(s('text', { x: 58 + 2 * cwB - 2, y: 93, 'text-anchor': 'middle', 'font-weight': 800, style: 'fill:var(--warn)' }, '↑ R wakes'));  // labels that line "R wakes" under the chart
          const wt = start - 2;  // wt: how long R waited, from its wake-up at tick 2 until it started
          waitB.textContent = wt + (wt === 1 ? ' tick' : ' ticks'); waitB.className = 'v ' + (wt > 3 ? 'bad-t' : wt > 0 ? 'warn-t' : 'ok-t');  // shows the wait with the right singular or plural; red if long, amber if short, green if zero
          capB.innerHTML = {  // picks the explanation for the chosen mode
            none: 'R wakes at tick 2 (dashed line), but the kernel finishes T1\'s whole system call first.',  // explanation with no preemption: T1's whole system call finishes before R runs
            points: 'SVR4 style: at the next <b>preemption point</b>, after 3 ticks of kernel work, it switches to R.',  // explanation with preemption points: the switch happens at the next safe point in the kernel
            full: 'Solaris style: R takes CPU 0 <b>at once</b>, even mid-way through T1\'s kernel code.',  // explanation for a fully preemptable kernel: R takes the CPU immediately
          }[mode] + ' T1 still finishes at tick 14.';  // every explanation ends by noting that T1 still finishes at tick 14: the order changes, not the total work
        }  // ends runB()
        const segB = ctx.ui.seg([{ value: 'none', label: 'No preemption' }, { value: 'points', label: 'Preemption points' }, { value: 'full', label: 'Fully preemptable' }], 'full', runB);  // the three preemption buttons for simulation B; picking one reruns it, starting with fully preemptable
        const feat = (n, t, p) => h('div', { class: 'card tight feat' }, h('span', { class: 'n' }, String(n)), h('div', {}, h('b', { html: t }), h('p', { html: p })));  // feat(n, t, p): builds one numbered Solaris feature card with a bold title and a description
        el.append(h('div', { class: 'split l fill' },  // puts the screen together: feature cards on the left (5 parts), simulations on the right (7 parts)
          h('div', { class: 'stack', style: { gap: '8px' } },  // the left column
            h('p', { class: 'm0', html: '<b>Solaris 11</b> (2011) is Oracle\'s release of Sun\'s SVR4-based UNIX, a leading commercial UNIX. Three features stand out.' }),  // opening paragraph: Solaris 11 is Oracle's SVR4-based UNIX with three standout features
            feat(1, 'Fully <span class="t" data-t="preemptive kernel">preemptable</span>, <span class="t">multithreaded kernel</span>', 'Kernel work, even interrupt handling, runs as kernel <span class="t">thread</span>s. An urgent thread can take the CPU almost anywhere in kernel code, not just at chosen points.'),  // feature card 1: a fully preemptable, multithreaded kernel (data-t points the glossary link at "preemptive kernel")
            feat(2, 'Full <span class="t">SMP</span> support', 'All processors are equal peers. Many run kernel code at once, each holding only the small locks it needs (a lock is held by one CPU at a time).'),  // feature card 2: full symmetric multiprocessing, where many CPUs run kernel code at once
            feat(3, 'Object-oriented file-system interface', 'vnode/vfs: every file system supplies the same set of operations, like classes implementing one interface (as pcfs did in the lab).'),  // feature card 3: the object-oriented file-system interface, vnode/vfs
            h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Preemption does not shrink the total work (each switch even costs a little). It changes the order, so urgent work goes first.' })),  // "Common mistake" box: preemption reorders work but does not reduce it
          h('div', { class: 'stack', style: { gap: '8px' } },  // the right column
            h('div', { class: 'legend xs', style: { alignItems: 'center' } }, h('b', 'Key:'), h('span', { class: 'chip proc' }, 'user code'), h('span', { class: 'chip os' }, 'kernel code (label = lock it holds)'), h('span', { class: 'chip bad' }, 'waiting'), h('span', { class: 'chip warn' }, 'urgent thread R')),  // colour key for both charts: user code, kernel code, waiting and the urgent thread
            h('div', { class: 'card white simcard' },  // card for simulation A
              h('div', { class: 'hdr' }, h('h4', { class: 'm0' }, 'Four CPUs, one kernel'), segA), svgA,  // its header, "Four CPUs, one kernel", with the lock-design buttons, then its chart
              h('div', { class: 'row', style: { gap: '18px', alignItems: 'flex-start' } },  // the row of results under chart A
                h('div', { class: 'stat', style: { minWidth: '92px' } }, h('span', { class: 'xs' }, 'Ticks waiting'), lostA),  // counter: total ticks CPUs spent waiting
                h('div', { class: 'stat', style: { minWidth: '92px' } }, h('span', { class: 'xs' }, 'Finished'), lastA), capA)),  // counter: the tick when the last CPU finished, then the explanation
            h('div', { class: 'card white simcard' },  // card for simulation B
              h('div', { class: 'hdr' }, h('h4', { class: 'm0' }, 'Urgent thread R wakes'), segB), svgB,  // its header, "Urgent thread R wakes", with the preemption buttons, then its chart
              h('div', { class: 'row', style: { gap: '18px', alignItems: 'flex-start' } },  // the row of results under chart B
                h('div', { class: 'stat', style: { minWidth: '92px' } }, h('span', { class: 'xs' }, 'R waited'), waitB), capB)))));  // counter: how long R waited, then the explanation
        runA('fine'); runB('full');  // runs both simulations once, in their starting modes, so the charts are filled when the step opens
      },  // ends render() for step 7
    },  // ends step 7

    /* ---------------- 8. Recap ---------------- */
    {  // step 8 begins: a recap screen of flip cards
      title: 'Recap: modern UNIX on one page',  // step 8's title, shown as the screen heading
      kind: 'recap',  // kind "recap" labels this screen as a Recap step
      render(el, ctx) {  // render(el, ctx): builds the recap screen when the step opens
        const { h } = ctx;  // takes h (builds page elements) from ctx
        el.append(h('div', { class: 'stack fill' },  // puts the recap into the screen as one column
          h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // instruction: answer out loud before flipping each card
          ctx.ui.flipcards([  // the guide's flip-card helper: each pair is [front question, back answer]; a click turns the card over
            ['Why was the UNIX kernel rebuilt?', 'Many versions had each edited one big kernel in their own way. A small core of common facilities with fixed plug-in interfaces lets new parts be added without rewriting the core.'],  // card: why the UNIX kernel was rebuilt around a core
            ['Name the six plug-in points', 'exec switch · virtual memory framework · vnode/vfs interface · block device switch · scheduler framework · STREAMS'],  // card: the six plug-in points
            ['What plugs in where?', 'a.out, COFF, ELF → exec switch<br>file, device, anonymous mappings → VM<br>NFS, FFS, s5fs, RFS → vnode/vfs<br>disk, tape → block device switch<br>time-sharing, system → scheduler<br>network, tty → STREAMS'],  // card: what plugs into each plug-in point, one line per interface
            ['SVR4 in one breath', '1989, AT&T + Sun. Merged SVR3, 4.3BSD, Xenix System V and SunOS on an almost totally rewritten kernel. New: real-time support, scheduling classes, dynamic data structures, virtual memory, virtual file system, preemptive kernel.'],  // card: SVR4's builders, ingredients and six new features
            ['What is BSD\'s legacy?', 'Paged virtual memory and TCP/IP with sockets (plus FFS). 4.4BSD was Berkeley\'s last release; the code lives on in FreeBSD, NetBSD, OpenBSD and macOS (Mach + FreeBSD code).'],  // card: what BSD left behind and where its code lives now
            ['Solaris 11 in three features', 'Oracle\'s SVR4-based UNIX (2011): a fully preemptable multithreaded kernel, full SMP support, and an object-oriented (vnode/vfs) file-system interface.'],  // card: Solaris 11's three headline features
          ], { cols: 3, height: 196 }),  // ends the cards; lays them out in 3 columns, each card 196 pixels tall
          h('div', { class: 'callout tip m0', 'data-label': 'Next', html: 'Section 2.10 turns to Linux, a UNIX-like kernel written from scratch that uses the same plug-in idea through loadable modules.' })));  // "Next" box: section 2.10 turns to Linux and its loadable modules
      },  // ends render() for step 8
    },  // ends step 8

    /* ---------------- 9. Check yourself ---------------- */
    {  // step 9 begins: the section quiz
      title: 'Check yourself: modern UNIX systems',  // step 9's title, shown as the screen heading
      kind: 'check',  // kind "check" labels this screen as a Check Yourself step
      quiz: [  // quiz: the questions; the guide's quiz engine draws, checks and scores them
        { q: 'Why did UNIX designers move to a kernel with a small core and plug-in interfaces?',  // quiz question 1 (multiple choice): why designers moved to a small core with plug-in interfaces
          choices: ['Processors of the time were too slow to run one large, complex kernel', 'It let every file system and driver run as a separate user-mode process', 'Each version had patched one big kernel its own way, so features were hard to add', 'AT&T had stopped licensing the UNIX source code to other groups'],  // the four choices; the third (patched kernels) is right
          answer: 2,  // answer: the number of the correct choice, counting from 0
          feedback: ['Speed was not the driver. The modular design is about structure; the modules still run inside the kernel.', 'That describes a microkernel. In a modern UNIX kernel the modules stay in the kernel, in kernel mode, and connect through fixed interfaces.', null, 'The opposite: wide licensing is what produced so many different versions.'],  // feedback shown for each wrong choice (null for the right one): speed, microkernel, licensing
          why: 'Vendors and universities had patched the same monolithic code in different ways. A small core with clean interfaces lets new file systems, formats, drivers and policies plug in without rewriting the core.' },  // why: the full explanation shown after the question is answered
        { type: 'match', q: 'Match each part of a modern UNIX kernel with what plugs into it.',  // quiz question 2 (match the pairs): each plug-in point with what plugs into it
          pairs: [['exec switch', 'a.out, COFF and ELF loaders'], ['Virtual memory framework', 'File, device and anonymous mappings'], ['vnode/vfs interface', 'NFS, FFS, s5fs and RFS'], ['Block device switch', 'Disk and tape drivers'], ['Scheduler framework', 'Time-sharing and system classes'], ['STREAMS', 'Network and terminal (tty) drivers']],  // the six pairs to match, one per plug-in point
          why: 'Each interface is a socket for one kind of variety: program formats, memory sources, file systems, block devices, scheduling policies and character streams.' },  // why: each interface is a socket for one kind of variety
        { type: 'bucket', q: 'Which system contributed each feature to SVR4?', buckets: ['4.3BSD', 'SunOS', 'SVR3'],  // quiz question 3 (sort into groups): which of 4.3BSD, SunOS or SVR3 contributed each feature
          items: [['TCP/IP networking with sockets', 0], ['Fast File System (FFS)', 0], ['Network File System (NFS)', 1], ['vnode/vfs file-system interface', 1], ['STREAMS', 2], ['Remote File Sharing (RFS)', 2]],  // the six features, each with the number of its correct group
          why: 'Berkeley brought networking and FFS; Sun brought NFS, vnode/vfs and its virtual memory design; AT&T\'s SVR3 brought STREAMS and RFS.' },  // why: Berkeley gave networking and FFS, Sun gave NFS and vnode/vfs, SVR3 gave STREAMS and RFS
        { type: 'multi', q: 'Which of these were major new features of SVR4?',  // quiz question 4 (select all that apply): which were major new features of SVR4
          choices: ['Real-time processing support', 'Process scheduling classes', 'Dynamically allocated kernel data structures', 'A preemptive kernel', 'Fixed-size kernel tables chosen when the kernel is built', 'Every device driver moved into user space'],  // six choices, including two wrong ones (fixed-size tables, user-space drivers)
          answer: [0, 1, 2, 3],  // answer: the first four choices are correct
          why: 'SVR4 also brought new virtual memory management and a virtual file system. It replaced fixed-size tables with dynamic allocation, and its drivers still ran inside the kernel.' },  // why: lists SVR4's other features and why the two distractors are wrong
        { q: 'Who developed System V Release 4 (SVR4)?',  // quiz question 5 (multiple choice): who developed SVR4
          choices: ['UC Berkeley and Sun Microsystems', 'AT&T and Sun Microsystems', 'AT&T and Microsoft', 'AT&T and IBM'],  // the four pairs of companies to choose from
          answer: 1,  // answer: AT&T and Sun Microsystems (choice 1)
          feedback: ['Berkeley\'s 4.3BSD was an ingredient, but AT&T and Sun built SVR4.', null, 'Microsoft\'s Xenix System V was merged into SVR4, but Microsoft did not develop it.', 'IBM sold its own System V-based UNIX, AIX, and was not a partner in SVR4.'],  // feedback for each wrong pair: Berkeley, Microsoft and IBM each explained
          why: 'AT&T and Sun built SVR4 together and released it in 1989.' },  // why: AT&T and Sun released SVR4 in 1989
        { type: 'tf', q: '4.4BSD was the final BSD release from the University of California, Berkeley.', answer: true,  // quiz question 6 (true or false): 4.4BSD was Berkeley's final BSD release; answer: true
          why: 'Berkeley\'s research group closed soon after; FreeBSD, NetBSD and OpenBSD carried the code forward.' },  // why: the free BSDs carried the code forward after Berkeley's group closed
        { q: 'Apple\'s macOS is built on Darwin. What does Darwin\'s kernel combine?',  // quiz question 7 (multiple choice): what Darwin's kernel combines
          choices: ['The Linux kernel and code from NetBSD', 'The SVR4 kernel and Microsoft Xenix', 'The Solaris kernel and the Mach microkernel', 'The Mach microkernel and code from FreeBSD'],  // the four choices; the last (Mach plus FreeBSD code) is right
          answer: 3,  // answer: the Mach microkernel and FreeBSD code (choice 3)
          feedback: ['macOS does not use the Linux kernel, and its BSD code comes mainly from FreeBSD.', 'Those two were merged into SVR4, not into macOS.', 'Solaris descends from SVR4; macOS comes from the NeXTSTEP line, which joined Mach with BSD code.', null],  // feedback for each wrong choice: Linux, SVR4 with Xenix, and Solaris each explained
          why: 'Darwin joins the Mach microkernel from Carnegie Mellon with a large layer of FreeBSD code, a path that runs through NeXTSTEP.' },  // why: Darwin joins Mach with FreeBSD code by way of NeXTSTEP
        { type: 'multi', q: 'Which statements describe Solaris 11?',  // quiz question 8 (select all that apply): which statements describe Solaris 11
          choices: ['It has a fully preemptable, multithreaded kernel', 'It fully supports symmetric multiprocessing (SMP)', 'It has an object-oriented interface to file systems', 'It is based on the BSD kernel rather than SVR4', 'It was released by Oracle', 'It runs on only one processor at a time'],  // six statements, including two wrong ones (BSD-based, single-processor)
          answer: [0, 1, 2, 4],  // answer: choices 0, 1, 2 and 4 are correct
          why: 'Solaris 11 (2011) is Oracle\'s SVR4-based UNIX with a fully preemptable multithreaded kernel, full SMP support and the vnode/vfs file-system interface.' },  // why: sums up Solaris 11's three features and its SVR4 base
        { type: 'num', q: 'On a single processor, a kernel that cannot be preempted starts a system call needing 8 ticks of kernel work, and the call never blocks. A real-time process wakes up 3 ticks after the call began. How many ticks does the real-time process wait before it can run?',  // quiz question 9 (calculate): how long a real-time process waits on a kernel that cannot be preempted
          answer: 5, tol: 0, unit: 'ticks',  // answer: 5 ticks, with no tolerance for error; unit is the word shown beside the answer box
          why: 'The call must run to completion: 8 − 3 = 5 more ticks. A fully preemptable kernel could switch to the real-time process almost at once.' },  // why: the remaining 8 - 3 = 5 ticks of the system call must finish first
        { type: 'num', q: 'Four CPUs each need 2 ticks of kernel work at the same moment, and one big lock guards the whole kernel. How many ticks pass until the last CPU finishes its kernel work?',  // quiz question 10 (calculate): four CPUs sharing one big kernel lock
          answer: 8, tol: 0, unit: 'ticks',  // answer: 8 ticks exactly
          why: 'Only one CPU at a time may hold the lock: 4 × 2 = 8 ticks. With fine-grained locks on different data, all four could finish in 2.' },  // why: the CPUs take turns, 4 x 2 = 8 ticks, while fine-grained locks would finish in 2
        { type: 'order', q: 'A new file-system module is added to a running system, and a program then reads a file from it. Put the steps in order.',  // quiz question 11 (put in order): the steps from loading a file-system module to reading a file from it
          items: ['The module is loaded and registers its operations with the VFS layer', 'The device is mounted, creating a vfs object for that file system', 'The program opens the file and the VFS layer finds the file\'s vnode', 'The read goes through the vnode to the module\'s own read routine', 'The module fetches the data from its device'],  // the five steps in their correct order; the quiz shuffles them for the student
          why: 'Register, mount, look up the vnode, call through the vnode\'s operation table, then the module talks to its device. The core never changes.' },  // why: register, mount, find the vnode, call through it, then the module reads its device
        { type: 'tf', q: 'In a modern UNIX kernel, supporting a new executable file format means rewriting the exec system call.', answer: false,  // quiz question 12 (true or false): a new program format means rewriting exec; answer: false
          why: 'You add one loader to the exec switch. exec simply offers the file to each loader until one recognizes it.' },  // why: only one loader is added to the exec switch
      ],  // ends the quiz list
    },  // ends step 9
  ],  // ends the list of steps

  notes: `${/* notes: the section's reference notes as HTML, shown in the Notes drawer (the N key or the Notes button) */''}
<h3>Why UNIX needed a new kernel design</h3>${/* heading for part 1 of the notes: why UNIX needed a new kernel design */''}
<p>AT&T licensed the UNIX source widely, so many versions appeared: Berkeley's BSD (1978) and Microsoft's Xenix (1980), then System V, SunOS, Ultrix and HP-UX by the mid-1980s, and AIX and IRIX by 1989. Each group edited the kernel directly, so code moved between versions only with work and every feature made the kernel harder to change.</p>${/* notes paragraph: wide licensing produced many versions, each editing the kernel directly */''}
<p>The answer was a <b>modular kernel</b>: a small core of <b>common facilities</b> (system-call entry, processes and threads, interrupts, locking, kernel memory) with modules that connect through fixed interfaces, like appliances in standard wall outlets. The usual mechanism is a <b>switch table</b>: one row of function pointers per implementation, which the core calls without knowing the details. The modules still run in kernel mode inside the kernel, so this is not a microkernel.</p>${/* notes paragraph: the modular kernel, switch tables, and why this is not a microkernel */''}
<h3>Traditional versus modern kernel</h3>${/* heading for part 2 of the notes: traditional versus modern kernel */''}
<p>In a traditional kernel one change spreads: a new file system meant editing system calls, file handling, the buffer cache and the program loader; a new program format meant rewriting exec and memory management; real-time scheduling meant editing the scheduler, clock and sleep code. In a modern kernel each is one new module: NFS behind vnode/vfs, an ELF loader in the exec switch, a real-time class. Drivers were the exception: even early UNIX reached them through a switch table (the block device switch), and modern UNIX applied that trick everywhere. A change kept inside one module is smaller, safer and testable alone.</p>${/* notes paragraph: how one change spreads in a traditional kernel but stays in one module in a modern one */''}
<h3>The six plug-in points of a modern UNIX kernel</h3>${/* heading for part 3 of the notes: the six plug-in points */''}
<table>${/* starts the notes table of plug-in points */''}
<tr><th>Interface</th><th>What it does</th><th>What plugs in</th></tr>${/* table header row: interface, what it does, what plugs in */''}
<tr><td>exec switch</td><td>Starts programs: exec offers the program file to each loader until one recognizes its header</td><td>a.out (original UNIX format), COFF (Common Object File Format, System V before SVR4), ELF (Executable and Linkable Format, from SVR4; standard today)</td></tr>${/* table row: the exec switch and the a.out, COFF and ELF loaders */''}
<tr><td>Virtual memory framework</td><td>An address space is a list of mappings; on a page fault the core calls the faulting mapping's own routine</td><td>File mappings (pages from a file, e.g. program code, mmap), device mappings (a window onto device memory such as a frame buffer), anonymous mappings (heap and stacks; start as zeros, go to swap)</td></tr>${/* table row: the virtual memory framework and its file, device and anonymous mappings */''}
<tr><td>vnode/vfs interface</td><td>Lets many file-system types coexist; system calls use vnodes, each pointing to its file system's operations; each mounted file system is a vfs object</td><td>NFS (Sun's network files), FFS (Berkeley Fast File System), s5fs (System V file system), RFS (AT&T Remote File Sharing)</td></tr>${/* table row: the vnode/vfs interface and the NFS, FFS, s5fs and RFS file systems */''}
<tr><td>Block device switch</td><td>Table indexed by major device number; the minor number picks the unit</td><td>Disk and tape drivers</td></tr>${/* table row: the block device switch and its disk and tape drivers */''}
<tr><td>Scheduler framework</td><td>The dispatcher runs the highest-priority ready process; each scheduling class sets its members' priorities</td><td>Time-sharing class (ordinary processes, priorities move with behaviour), system class (kernel processes, fixed higher priorities); SVR4 adds real-time</td></tr>${/* table row: the scheduler framework and its scheduling classes */''}
<tr><td>STREAMS</td><td>Character I/O as a chain: stream head, optional modules, driver; modules can be pushed and popped while open</td><td>Network drivers (with protocol modules above), tty (terminal) drivers</td></tr>${/* table row: STREAMS and its network and terminal drivers */''}
</table>${/* ends the plug-in points table */''}
<p>Examples: an ELF program starts → exec switch; first touch of a heap page → VM (anonymous); a remote file → vnode/vfs (NFS); writing a disk block → block device switch; the page-out daemon wakes → scheduler (system class); a key press or network packet → STREAMS.</p>${/* notes paragraph: one example request for each plug-in point */''}
<h3>Adding a file system without touching the core</h3>${/* heading for part 4 of the notes: adding a file system without touching the core */''}
<ol>${/* starts the numbered list of lab steps */''}
<li><b>Load</b> the module (e.g. pcfs for FAT USB sticks); it registers its type name, vfs operations and vnode operations with VFS.</li>${/* list item: load the module, which registers its operations with VFS */''}
<li><b>Mount</b> the device: VFS calls the module's mount operation and creates a vfs object. Without step 1: "unknown file system type".</li>${/* list item: mount the device, and what fails without step 1 */''}
<li><b>Open</b>: VFS walks the path across the mount point to the file's vnode (v_op points to the module's operations) and returns a descriptor for it. Without step 2 the path is an empty directory on the root file system, so open fails.</li>${/* list item: open walks the path to the file's vnode, and what fails without step 2 */''}
<li><b>Read</b> (on the descriptor): the vnode's read operation (pcfs_read) fetches blocks from the device.</li>${/* list item: read calls the vnode's read operation, which fetches from the device */''}
</ol>${/* ends the list of lab steps */''}
<p>Core code changed: zero lines. Every file system implements one common set of operations, an object-oriented design.</p>${/* notes paragraph: zero core lines changed, an object-oriented design */''}
<h3>System V Release 4 (SVR4)</h3>${/* heading for part 5 of the notes: System V Release 4 */''}
<p>Released in 1989 by AT&T and Sun Microsystems: an almost total rewrite of the System V kernel that merged four systems, drawing on commercial work (SVR3, Xenix, SunOS) and academic work (4.3BSD). It aimed to be one uniform commercial UNIX for machines of every size.</p>${/* notes paragraph: who built SVR4, when, and what it merged */''}
<table>${/* starts the table of SVR4's ingredients */''}
<tr><th>Ingredient</th><th>Main contributions</th></tr>${/* table header row: ingredient and main contributions */''}
<tr><td>SVR3 (AT&T, 1987)</td><td>System V trunk and interfaces; STREAMS; RFS</td></tr>${/* table row: what SVR3 contributed */''}
<tr><td>4.3BSD (Berkeley, 1986)</td><td>TCP/IP with sockets; FFS; C shell, job control</td></tr>${/* table row: what 4.3BSD contributed */''}
<tr><td>Xenix System V (Microsoft)</td><td>UNIX on Intel PCs; Xenix programs kept running</td></tr>${/* table row: what Xenix System V contributed */''}
<tr><td>SunOS (Sun)</td><td>vnode/vfs; NFS; file-mapping virtual memory; shared libraries</td></tr>${/* table row: what SunOS contributed */''}
</table>${/* ends the ingredients table */''}
<h4>Six major new features</h4>${/* sub-heading: SVR4's six major new features */''}
<ol>${/* starts the numbered feature list */''}
<li><b>Real-time processing support:</b> a class with fixed priorities above all others.</li>${/* list item: real-time processing support */''}
<li><b>Process scheduling classes:</b> 160 priorities; time-sharing 0 to 59, system 60 to 99, real-time 100 to 159.</li>${/* list item: scheduling classes and the 160 priority levels */''}
<li><b>Dynamically allocated data structures</b> instead of fixed-size tables set at build time (a full table blocks new processes despite free memory; an empty one wastes it).</li>${/* list item: dynamically allocated data structures instead of fixed tables */''}
<li><b>Virtual memory management:</b> mappings of files, devices and anonymous memory.</li>${/* list item: virtual memory management through mappings */''}
<li><b>Virtual file system:</b> vnode/vfs.</li>${/* list item: the virtual file system */''}
<li><b>Preemptive kernel:</b> preemption points where a long kernel path can switch to a more urgent process.</li>${/* list item: the preemptive kernel with preemption points */''}
</ol>${/* ends the feature list */''}
<h3>BSD and its descendants</h3>${/* heading for part 6 of the notes: BSD and its descendants */''}
<p>The Berkeley Software Distribution began in 1978. 3BSD (1979) added paged virtual memory; 4.2BSD (1983) built TCP/IP into the kernel with the socket interface and introduced the Fast File System; 4.3BSD (1986) refined it; <b>4.4BSD</b> (1993 to 1994) was Berkeley's final release, and its AT&T-free version, 4.4BSD-Lite, became the base of the free BSDs:</p>${/* notes paragraph: the BSD releases from 1978 to 4.4BSD and what each added */''}
<ul>${/* starts the list of BSD descendants */''}
<li><b>FreeBSD</b> (1993): performance and ease of use, widely used on servers; a major source of the BSD code in macOS.</li>${/* list item: FreeBSD and its aims */''}
<li><b>NetBSD</b> (1993): portability to a very wide range of hardware.</li>${/* list item: NetBSD and its aim of portability */''}
<li><b>OpenBSD</b> (1996): split from NetBSD; security and audited code (OpenSSH).</li>${/* list item: OpenBSD and its focus on security */''}
<li><b>macOS:</b> built on <b>Darwin</b>, whose kernel combines the <b>Mach microkernel</b> (Carnegie Mellon) with FreeBSD code, by way of NeXTSTEP (Mach + 4.3BSD).</li>${/* list item: macOS, built on Darwin from Mach and FreeBSD code */''}
</ul>${/* ends the list of descendants */''}
<p>SunOS was also BSD-based, which is how BSD ideas reached SVR4 and Solaris.</p>${/* notes paragraph: SunOS was BSD-based too, which is how BSD ideas reached SVR4 and Solaris */''}
<h3>Solaris 11</h3>${/* heading for part 7 of the notes: Solaris 11 */''}
<p>Sun moved from SunOS to an SVR4 base with Solaris 2 (1992). Oracle bought Sun in 2010 and released Solaris 11 in 2011, a leading commercial UNIX. Features: a <b>fully preemptable, multithreaded kernel</b> (kernel work runs as threads and can be preempted almost anywhere); <b>full SMP support</b> (all processors are peers; many run kernel code at once, each holding only the small locks it needs); an <b>object-oriented file-system interface</b> (vnode/vfs).</p>${/* notes paragraph: Solaris's history and its three headline features */''}
<h4>Worked examples</h4>${/* sub-heading: worked examples */''}
<p><b>Locks.</b> Four CPUs each need 2 ticks of kernel work at once. With one big kernel lock they take turns: 4 × 2 = 8 ticks. With per-structure locks on different data, all finish in 2.</p>${/* notes paragraph: the lock example worked out, 8 ticks versus 2 */''}
<p><b>Preemption.</b> T1 runs 1 user tick, a 7-tick system call, then 4 user ticks; urgent R wakes at tick 2. No preemption: R waits 6 ticks. Preemption points after 3 kernel ticks (SVR4): 2 ticks. Fully preemptable (Solaris): 0. T1 always finishes at tick 14: preemption changes the order of work, not its amount (apart from a little switching cost). Without preemption, wait = call length − time already spent (8 − 3 = 5).</p>`,  // notes paragraph: the preemption example worked out for each mode; the backtick closes the notes text
});  // ends the section object and the Guide.section call
