// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 2.10 — Linux
   Original teaching material. Built step by step. */
Guide.section({  // registers section 2.10 with the guide; everything inside this object describes the section's steps, notes and styles
  id: '2.10',  // id: the section number the guide uses to order it and to build links such as the table of contents
  title: 'Linux',  // title: the full heading shown at the top of the section's screens
  short: 'Linux',  // short: the brief name used in tight lists, such as the chapter overview
  summary: 'How a 1991 student kernel became Linux: free under the GPL, monolithic, yet built from loadable modules.',  // summary: the one-sentence description shown next to the section in the table of contents
  objectives: [  // objectives: the learning goals, printed under "You should be able to" in the printable version
    'Tell the story of Linux: who started it, when, on what hardware, and why a free license and the GNU tools let it succeed.',  // goal 1: tell the story of Linux and why the GPL and the GNU tools let it succeed
    'Explain why Linux counts as a monolithic kernel even though it is built from loadable modules, and compare it with a microkernel.',  // goal 2: explain why Linux is monolithic despite its modules, and compare it with a microkernel
    'Describe the two key properties of Linux modules, dynamic linking and stacking, and predict when the kernel refuses to load or unload a module.',  // goal 3: describe dynamic linking and stacking, and predict when a module load or unload is refused
    'Read an entry of the module table: name, size, usecount, flags, exported symbols and dependencies.',  // goal 4: read one entry of the module table
    'Name the main components of the Linux kernel and trace which ones handle a key press, an arriving network packet and a file read.',  // goal 5: name the main kernel components and trace which ones handle three everyday events
  ],  // ends the objectives list
  terms: [  // terms: glossary entries as [term, definition] pairs; the guide adds them to the searchable glossary
    ['Linux', 'A free, open-source, UNIX-like operating-system kernel started by Linus Torvalds in 1991. The name is also used loosely for whole systems built around that kernel.'],  // glossary entry: defines Linux, the free UNIX-like kernel started in 1991
    ['Open source', 'Software whose source code is published so that anyone may read it, change it and share it, under the terms of its license.'],  // glossary entry: defines open source software
    ['GNU General Public License (GPL)', 'The free-software license Linux uses. Anyone may run, study, change and share the code, but whoever passes a copy on, changed or not, must pass on the same freedoms and make the source code available.'],  // glossary entry: defines the GNU General Public License (GPL) that Linux uses
    ['Copyleft', 'A license rule that uses copyright to keep software free: any version you distribute must carry the same license, so nobody can turn shared code into a closed product.'],  // glossary entry: defines copyleft, the license rule that keeps shared code free
    ['Free Software Foundation (FSF)', 'A nonprofit founded in 1985 by Richard Stallman to promote software that users are free to run, study, change and share. It supports the GNU project and wrote the GPL.'],  // glossary entry: defines the Free Software Foundation (FSF)
    ['GNU project', 'An effort begun in 1983 to build a complete, free, UNIX-like operating system. By 1991 it had a compiler, a shell, a C library, editors and utilities, but no finished kernel. GNU stands for "GNU\'s Not Unix".'],  // glossary entry: defines the GNU project and the kernel it was still missing in 1991
    ['Monolithic kernel', 'A kernel that holds almost the whole operating system (scheduling, memory management, file systems, networking, device drivers) as one large program that runs in kernel mode in one shared address space, so its parts can call each other directly.'],  // glossary entry: defines a monolithic kernel, one big program in one shared address space
    ['Microkernel', 'A small kernel that keeps only the essential core (address spaces, interprocess communication, basic scheduling) and runs every other OS service as a server process in user mode.'],  // glossary entry: defines a microkernel, which runs most services as user-mode servers
    ['Loadable module', 'A relatively independent block of kernel code, usually doing one job such as a device driver, a file system or a network protocol, that can be loaded into and removed from the kernel while the system runs. It is not a separate process: it runs in kernel mode on behalf of the current process.'],  // glossary entry: defines a loadable module, kernel code that can be added or removed while running
    ['Dynamic linking', 'Connecting a module to the kernel while the kernel is in memory and running: every name the module uses is looked up and replaced by its real address. The module can later be unlinked and removed, all without a reboot.'],  // glossary entry: defines dynamic linking, connecting a module to the running kernel
    ['Stackable modules', 'Modules arranged in a hierarchy in which a lower module acts as a library for the client modules above it. The kernel counts these references, so it can load prerequisites first and refuse to remove a module that others still need.'],  // glossary entry: defines stackable modules, where lower modules serve as libraries for higher ones
    ['Module table', 'The kernel\'s linked list of loaded modules. Each entry records the module\'s name, size, usecount, flags, the symbols it exports and the modules it depends on.'],  // glossary entry: defines the module table, the kernel's list of loaded modules
    ['Usecount (use count)', 'A counter in a module\'s table entry. It goes up when an operation that uses the module\'s functions starts and down when that operation ends. The module cannot be unloaded while it is above zero.'],  // glossary entry: defines a module's usecount and why it blocks unloading
    ['Symbol table (exported symbols)', 'The list of names (functions and variables) that the core kernel and loaded modules make available to other modules, each with its address in memory. A newly loaded module is linked against it.'],  // glossary entry: defines the symbol table of names that modules can link against
    ['Signal', 'A short software notice the kernel delivers to a process to report an event, such as Ctrl+C being pressed (SIGINT) or a child process ending. The process may handle it, ignore it, or be stopped by it.'],  // glossary entry: defines a signal, a short notice from the kernel to a process
    ['Traps and faults', 'Events the processor raises by itself while running an instruction, such as a page fault, a divide by zero or an illegal instruction. Like an interrupt, each one switches the processor into kernel mode to run a handler.'],  // glossary entry: defines traps and faults, events the processor raises by itself
    ['Character device', 'A device that sends or receives data as a stream of bytes, one after another, such as a keyboard, a terminal or a mouse. A character device driver operates it.'],  // glossary entry: defines a character device, which moves data as a stream of bytes
    ['Block device', 'A device, such as a hard disk, an SSD or a USB flash drive, that stores data in fixed-size numbered blocks. A block device driver operates it.'],  // glossary entry: defines a block device, which stores data in numbered blocks
    ['Network interface controller (NIC)', 'The hardware that connects a computer to a network, such as an Ethernet port or a Wi-Fi chip. It sends and receives packets and raises an interrupt when one arrives.'],  // glossary entry: defines a network interface controller (NIC)
    ['System call', 'A request from a running program to the kernel for a service, such as reading a file. A special instruction switches the processor into kernel mode and enters the kernel at a fixed, pre-arranged point.'],  // glossary entry: defines a system call, a program's request to the kernel
  ],  // ends the glossary terms

  css: ` /* css: the style rules for this section only, written as one long text; the guide adds them to the page when it loads */
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width and the page scrolls sideways */
    .sec-2-10 .step-eyebrow { contain: inline-size; } /* stops the step's label line above the title from forcing the page wider on a phone-width screen */
    .sec-2-10 .hot { cursor: pointer; outline: none; } /* .hot marks clickable drawing parts: the pointer cursor shows they respond, and the default focus ring is hidden */
    .sec-2-10 .hot .fr { transition: stroke-width .15s, opacity .2s; } /* animates the outline thickness and fading of a clickable shape's frame (.fr) so changes look smooth */
    .sec-2-10 .hot:hover .fr, .sec-2-10 .hot:focus-visible .fr { stroke-width: 3.5; } /* thickens the frame when the mouse is over a clickable shape or the keyboard has focused it */
    .sec-2-10 .hot.sel .fr { stroke-width: 4; } /* a selected shape (.sel) gets the thickest frame so the current choice stands out */
    .sec-2-10 .p15 { font-size: 15.5px; line-height: 1.45; } /* .p15: a comfortable reading size and line spacing for explanation text */
    .sec-2-10 .p15 p { margin: 0 0 8px; } /* paragraphs inside .p15 text get a small gap below them */
    .sec-2-10 .lbl { font-size: 12.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); } /* .lbl: small uppercase grey labels that name a panel, such as "Where does Linux run?" */
    .sec-2-10 .eg { font-size: 14.5px; line-height: 1.4; padding: 7px 11px; border-radius: 10px; background: var(--panel-3); border-left: 4px solid var(--chc); } /* .eg: the tinted example box with a coloured bar on its left, in the chapter's colour */
    .sec-2-10 .eg b { color: var(--chc); } /* the bold words in an example box take the chapter colour too */
    /* step 1: facts + device spectrum */
    .sec-2-10 .fact { display: grid; grid-template-columns: 132px minmax(0, 1fr); gap: 12px; align-items: center; padding: 9px 12px; } /* .fact: step 1's fact cards, a fixed-width bold label column beside the explanation */
    .sec-2-10 .fact b { font-size: 15.5px; } /* the fact card's bold label size */
    .sec-2-10 .fact span { font-size: 14.5px; line-height: 1.4; color: var(--ink-2); } /* the fact card's explanation, slightly smaller and softer */
    .sec-2-10 .devs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; } /* .devs: step 1's row of five device buttons, in equal columns */
    .sec-2-10 .dev { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px 7px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; font: inherit; color: var(--ink); transition: border-color .15s, background .15s; } /* .dev: one device button, stacking its drawing, name and examples; colours change smoothly */
    .sec-2-10 .dev svg { width: 46px; height: 42px; fill: none; stroke: var(--ink-2); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; } /* sets the size and line style of each device's small drawing, which is drawn with outlines only */
    .sec-2-10 .dev b { font-size: 14px; line-height: 1.2; text-align: center; } /* the device's name, centred under its drawing */
    .sec-2-10 .dev:hover { border-color: var(--chc); } /* hovering a device button tints its border with the chapter colour */
    .sec-2-10 .dev.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); } /* the chosen device button gets a chapter-coloured border and a light tint */
    .sec-2-10 .dev.on svg { stroke: var(--chc); } /* the chosen device's drawing is outlined in the chapter colour */
    .sec-2-10 .scale { height: 6px; border-radius: 9px; background: linear-gradient(90deg, color-mix(in srgb, var(--chc) 18%, transparent), var(--chc)); } /* .scale: the thin bar under the device row that darkens left to right, meaning smallest to largest */
    .sec-2-10 .trs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; } /* .trs: the four trait boxes in step 1, in equal columns */
    .sec-2-10 .tr { font-size: 13.5px; font-weight: 700; text-align: center; padding: 5px 6px; border-radius: 9px; border: 1.5px dashed var(--line-2); color: var(--muted); line-height: 1.25; transition: all .2s; } /* .tr: one trait box, dashed and grey while it does not apply to the chosen device */
    .sec-2-10 .tr.on { border-style: solid; border-color: var(--ok); background: var(--ok-bg); color: var(--ok); } /* a trait that applies to the chosen device (.on) turns solid green */
    .sec-2-10 .nrw .devs { grid-template-columns: repeat(3, minmax(0, 1fr)); } /* on phone-width screens (the nrw class), the device buttons wrap into three columns */
    .sec-2-10 .nrw .trs { grid-template-columns: repeat(2, minmax(0, 1fr)); } /* on phone-width screens, the trait boxes wrap into two columns */
    .sec-2-10 .nrw .fact { grid-template-columns: 1fr; gap: 2px; } /* on phone-width screens, each fact card stacks its label above its explanation */
    /* step 2: timeline */
    .sec-2-10 .tl8 { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 8px; position: relative; flex: none; } /* .tl8: step 2's timeline of eight cards in one row; positioned so the line behind it can be placed */
    .sec-2-10 .tl8::before { content: ''; position: absolute; left: 3%; right: 3%; top: 50%; height: 3px; background: var(--line-2); border-radius: 3px; } /* draws the horizontal timeline line behind the cards, through their middle */
    .sec-2-10 .tlc { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 7px 9px; min-height: 74px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; font: inherit; color: var(--ink); text-align: left; transition: border-color .15s, background .15s; } /* .tlc: one timeline card, a button showing the year and a short title; it sits above the line */
    .sec-2-10 .tlc .yr { font-size: 15px; font-weight: 800; color: var(--chc); line-height: 1.2; } /* the year on a timeline card, bold in the chapter colour */
    .sec-2-10 .tlc .tt { font-size: 13.5px; line-height: 1.25; color: var(--ink-2); font-weight: 650; } /* the short title on a timeline card, under the year */
    .sec-2-10 .tlc:hover { border-color: var(--chc); } /* hovering a timeline card tints its border */
    .sec-2-10 .tlc.past { border-color: color-mix(in srgb, var(--chc) 35%, var(--line)); } /* cards before the chosen one (.past) get a faint chapter-coloured border, showing time already covered */
    .sec-2-10 .tlc.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 11%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); } /* the chosen timeline card is tinted and outlined in the chapter colour */
    .sec-2-10 .gauge { display: grid; grid-template-columns: 128px minmax(0, 1fr); gap: 4px 12px; align-items: center; } /* .gauge: one "Linux at this point" gauge: a label column beside a bar of five segments, with a note below */
    .sec-2-10 .gauge .gl { font-size: 14px; font-weight: 700; } /* the gauge's label, such as "People writing it" */
    .sec-2-10 .gauge .gv { grid-column: 2; font-size: 13.5px; color: var(--ink-2); line-height: 1.3; } /* the gauge's short note, placed under the bar in the second column */
    .sec-2-10 .seg5 { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; } /* .seg5: the bar of five equal segments inside a gauge */
    .sec-2-10 .seg5 i { height: 11px; border-radius: 4px; background: var(--panel-3); transition: background .25s; } /* one gauge segment, grey while empty; its colour fades in when it fills */
    .sec-2-10 .seg5 i.on { background: var(--chc); } /* a filled gauge segment takes the chapter colour */
    .sec-2-10 .ings { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; } /* .ings: the "Ingredients of success" boxes in two columns */
    .sec-2-10 .ing { font-size: 13.5px; font-weight: 700; padding: 6px 9px; border-radius: 9px; border: 1.5px dashed var(--line-2); color: var(--muted); line-height: 1.3; transition: all .25s; } /* .ing: one ingredient box, dashed and grey until the timeline reaches it */
    .sec-2-10 .ing.on { border-style: solid; border-color: var(--ok); background: var(--ok-bg); color: var(--ok); } /* an ingredient already collected (.on) turns solid green */
    .sec-2-10 .ing.new { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 35%, transparent); } /* the ingredient collected at the chosen date (.new) also gets a green glow */
    .sec-2-10 .nrw .tl8 { grid-template-columns: repeat(2, minmax(0, 1fr)); } /* on phone-width screens, the timeline cards wrap into two columns */
    .sec-2-10 .nrw .tl8::before { display: none; } /* on phone-width screens, the timeline line is hidden because the cards no longer sit in one row */
    /* step 3: GNU stack + GPL game */
    .sec-2-10 .lays { display: flex; flex-direction: column; gap: 6px; } /* .lays: step 3's stack of system layers, one above another */
    .sec-2-10 .lay { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 10px; border: 2px solid var(--line-2); font-size: 15px; line-height: 1.3; min-height: 37px; } /* .lay: one layer of the system: its name on the left and a "who wrote it" tag on the right */
    .sec-2-10 .lay small { font-size: 13.5px; color: var(--ink-2); font-weight: 400; } /* the small explanation under each layer's name */
    .sec-2-10 .lay.u { border-color: color-mix(in srgb, var(--proc) 60%, transparent); background: var(--proc-bg); } /* user-space layers (.u) get the process colour */
    .sec-2-10 .lay.k { border-color: var(--os); background: var(--os-bg); } /* the kernel layer (.k) gets the operating-system colour */
    .sec-2-10 .lay.miss { border-style: dashed; border-color: var(--bad); background: var(--bad-bg); color: var(--bad); } /* a missing layer (.miss) is dashed and red, like a gap in the stack */
    .sec-2-10 .lay.hw { background: var(--panel-3); } /* the hardware layer (.hw) gets a plain grey background */
    .sec-2-10 .who { font-size: 12.5px; font-weight: 800; letter-spacing: .04em; padding: 1px 8px; border-radius: 99px; background: var(--panel); color: var(--ink-2); white-space: nowrap; } /* .who: the small pill tag naming who wrote a layer, such as GNU */
    .sec-2-10 .lay.k .who { color: var(--os); } /* on the kernel layer, the tag's text uses the operating-system colour */
    .sec-2-10 .lay.miss .who { color: var(--bad); } /* on a missing layer, the tag's text is red */
    .sec-2-10 .scen { font-size: 17px; line-height: 1.45; padding: 12px 14px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--line); min-height: 104px; } /* .scen: the large boxed scenario text in step 3's license game; a minimum height keeps the box steady */
    .sec-2-10 .gdots { display: flex; gap: 6px; } /* .gdots: the row of progress bars above step 3's license game, one per scenario */
    .sec-2-10 .gdots i { width: 26px; height: 8px; border-radius: 9px; background: var(--panel-3); } /* each progress bar is short, rounded and grey until its scenario is answered */
    .sec-2-10 .gdots i.cur { background: var(--chc); } /* the bar for the scenario on screen now takes the chapter colour */
    .sec-2-10 .gdots i.ok { background: var(--ok); } /* the bar of a scenario judged correctly turns green */
    .sec-2-10 .gdots i.bad { background: var(--bad); } /* the bar of a scenario judged wrongly turns red */
    .sec-2-10 .fb .callout { font-size: 15px; line-height: 1.45; } /* sets the reading size of the feedback box under each scenario */
    /* step 4: kernel designs */
    .sec-2-10 .tok { transition: transform .55s ease, opacity .25s; pointer-events: none; } /* .tok: the dot that travels through step 4's diagram; it glides between boxes and never blocks clicks */
    .sec-2-10 .prow { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 9px; font-size: 14.5px; line-height: 1.38; align-items: start; } /* .prow: one pros-and-cons row in step 4's design card: a verdict badge beside its text */
    .sec-2-10 .prow span { color: var(--ink-2); } /* the text of a pros-and-cons row, in a softer colour */
    .sec-2-10 .vd { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; font-weight: 900; font-size: 14px; background: var(--panel-3); color: var(--ink-2) !important; } /* .vd: the small square verdict badge at the start of each row (a tick, a cross, "!" or a dot) */
    .sec-2-10 .vd.ok { background: var(--ok-bg); color: var(--ok) !important; } /* a good verdict badge is green */
    .sec-2-10 .vd.bad { background: var(--bad-bg); color: var(--bad) !important; } /* a bad verdict badge is red */
    .sec-2-10 .vd.warn { background: var(--warn-bg); color: var(--warn) !important; } /* a warning verdict badge is amber */
    .sec-2-10 .score { display: flex; align-items: center; gap: 10px; } /* .score: step 4's counters and step 6's usecount display: a big number beside a short label */
    .sec-2-10 .score b { font-size: 30px; font-weight: 800; color: var(--chc); min-width: 1.2ch; text-align: center; font-variant-numeric: tabular-nums; line-height: 1; } /* the counter's number: large, bold, in the chapter colour, with digits of equal width */
    .sec-2-10 .score span { font-size: 14px; line-height: 1.25; color: var(--ink-2); font-weight: 650; } /* the counter's label beside the number */
    /* step 5: modules, linking, stacking */
    .sec-2-10 .prop { display: flex; flex-direction: column; gap: 3px; padding: 9px 12px; } /* .prop: the two property cards in step 5 (dynamic linking and stacking), stacked title over text */
    .sec-2-10 .prop b { font-size: 16px; color: var(--os); } /* the property card's title in the operating-system colour */
    .sec-2-10 .prop span { font-size: 14.5px; line-height: 1.4; } /* the property card's description */
    .sec-2-10 .mnode { cursor: pointer; } /* .mnode: the clickable module boxes in step 5's stack diagram show a pointer cursor */
    .sec-2-10 .mnode rect { transition: stroke-width .15s; } /* animates the outline thickness of a module box */
    .sec-2-10 .mnode:hover rect { stroke-width: 3.5; } /* hovering a module box thickens its outline */
    /* step 6: module lab */
    .sec-2-10 .lab { grid-template-columns: minmax(0, 382fr) minmax(0, 746fr); } /* .lab: step 7's lab layout, giving about one third of the width to the controls and two thirds to the table */
    .sec-2-10 .drow { display: flex; align-items: center; gap: 6px; padding: 3px 7px; border-radius: 9px; border: 1.5px solid transparent; min-height: 40px; } /* .drow: one row of the "module files on disk" list: name, then state and buttons */
    .sec-2-10 .drow.in { background: var(--os-bg); border-color: color-mix(in srgb, var(--os) 40%, transparent); } /* a row whose module is loaded (.in) is tinted with the operating-system colour */
    .sec-2-10 .drow .nm { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; } /* the name column fills the free space, with the file name above a short description */
    .sec-2-10 .drow .nm b { font-family: var(--mono); font-size: 14px; } /* the module's file name in a fixed-width font */
    .sec-2-10 .drow .nm span { font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } /* the description, cut off with "..." if it is too long for the row */
    .sec-2-10 .drow .btn.sm { height: 28px; padding: 0 8px; font-size: 13px; font-family: var(--mono); } /* makes the insmod, modprobe and rmmod buttons compact and fixed-width */
    .sec-2-10 .mt { display: flex; flex-direction: column; gap: 4px; position: relative; } /* .mt: the module table display, a column of entries; positioned so its chain line can be placed */
    .sec-2-10 .mt::before { content: ''; position: absolute; left: 12px; top: 30px; bottom: 9px; width: 2px; background: color-mix(in srgb, var(--os) 55%, transparent); } /* draws the vertical chain line down the left side, linking the entries like a linked list */
    .sec-2-10 .mrow { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 4px; align-items: center; position: relative; } /* .mrow: one module-table row: a thin rail cell for the chain, then the entry box */
    .sec-2-10 .mrail { position: relative; height: 100%; display: grid; place-items: center; z-index: 1; } /* the rail cell centres its dot and sits above the chain line */
    .sec-2-10 .mrail i { width: 10px; height: 10px; border-radius: 50%; background: var(--os); } /* the round dot on the chain for each entry */
    .sec-2-10 .mrail b { position: absolute; top: -10px; font-size: 11px; line-height: 1; color: var(--os); } /* the small down arrow above each dot, standing for the "next" pointer */
    .sec-2-10 .mcols, .sec-2-10 .mbox { display: grid; grid-template-columns: 96px 72px 66px minmax(0, 1fr) 96px 134px; gap: 6px; align-items: center; } /* the header row and every entry share one six-column grid, so the columns line up */
    .sec-2-10 .mcols { font-size: 12.5px; font-weight: 800; letter-spacing: .02em; color: var(--muted); padding: 0 8px; } /* the header row's labels: small, bold and grey */
    .sec-2-10 .mbox { padding: 2px 8px; min-height: 34px; border-radius: 9px; border: 1.5px solid color-mix(in srgb, var(--os) 50%, transparent); background: var(--os-bg); font-size: 13px; line-height: 1.25; } /* .mbox: one entry box, tinted with the operating-system colour */
    .sec-2-10 .mbox.new { border-color: var(--chc); box-shadow: 0 0 0 2px color-mix(in srgb, var(--chc) 30%, transparent); } /* an entry that was just loaded gets a chapter-coloured outline and glow */
    .sec-2-10 .mbox .mono { font-size: 13px; overflow-wrap: anywhere; } /* long symbol names inside an entry may break anywhere, so they never push the box wider */
    .sec-2-10 .mbox .nmc b { font-family: var(--mono); font-size: 14px; display: block; } /* the module's name in the entry, bold and fixed-width, on its own line */
    .sec-2-10 .mcols > :nth-child(2), .sec-2-10 .mcols > :nth-child(3), .sec-2-10 .mbox > :nth-child(2), .sec-2-10 .mbox > :nth-child(3) { text-align: center; } /* centres the usecount and flags columns, in both the header row and the entries */
    .sec-2-10 .mbox .uc { font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; } /* .uc: the usecount number, large and bold with digits of equal width */
    .sec-2-10 .mbox .uc.hot { color: var(--warn); } /* a usecount above zero turns amber, warning that the module is busy */
    .sec-2-10 .mhead, .sec-2-10 .mnull { font-family: var(--mono); font-size: 13px; color: var(--muted); padding-left: 30px; line-height: 16px; position: relative; } /* the "module_list" head line and the "NULL" end line: small grey fixed-width text, indented past the rail */
    .sec-2-10 .mhead::before, .sec-2-10 .mnull::before { content: ''; position: absolute; left: 8px; top: 3px; width: 10px; height: 10px; border-radius: 3px; background: var(--muted); } /* a small grey square at the left of the head and end lines, marking where the chain starts and stops */
    .sec-2-10 .mempty { font-size: 14.5px; color: var(--muted); padding: 10px 8px 10px 30px; font-style: italic; } /* .mempty: the grey italic message shown while no modules are loaded */
    .sec-2-10 .labout { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 10px; min-height: 0; } /* .labout: the command log and the explanation box side by side, under the table */
    .sec-2-10 .labout .log { font-size: 13px; } /* makes the lab's log text a little smaller */
    .sec-2-10 .labout .log .c { color: var(--ink); font-weight: 700; } /* typed command lines in the log are bold */
    .sec-2-10 .labout .log .ok { color: var(--ok); } /* success lines in the log are green */
    .sec-2-10 .labout .log .bad { color: var(--bad); } /* error lines in the log are red */
    .sec-2-10 .labout .log .mu { color: var(--muted); } /* quiet note lines in the log are grey */
    .sec-2-10 .mis { display: flex; flex-direction: column; gap: 3px; font-size: 13.5px; line-height: 1.3; } /* .mis: the missions checklist, a tight column of lines */
    .sec-2-10 .mis div { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 6px; color: var(--ink-2); } /* each mission line: a checkbox column beside its text */
    .sec-2-10 .mis div.done { color: var(--ok); font-weight: 700; } /* a finished mission turns bold green */
    .sec-2-10 .nrw .mcols { display: none; } /* on phone-width screens (the nrw class), the table's header row is hidden */
    .sec-2-10 .nrw .mbox { grid-template-columns: repeat(2, minmax(0, 1fr)); } /* on phone-width screens, each entry's six fields wrap into two columns */
    .sec-2-10 .nrw .mbox > div { text-align: left !important; } /* on phone-width screens, every field in an entry is left-aligned */
    .sec-2-10 .nrw .labout { grid-template-columns: 1fr; } /* on phone-width screens, the log sits above the explanation instead of beside it */
    .sec-2-10 .nrw .labout .log { max-height: 160px; } /* on phone-width screens, the log is limited in height so the page does not get too long */
    /* step 7: kernel components map */
    .sec-2-10 .kgrid { grid-template-columns: minmax(0, 690fr) minmax(0, 438fr); } /* .kgrid: step 8's layout, giving the kernel map about three fifths of the width */
    .sec-2-10 .kmap .hot:hover rect.fr { stroke-width: 3.5; } /* hovering a box on the kernel map thickens its frame */
    .sec-2-10 .kinfo h3 { margin: 0; } /* removes the heading margins in the kernel map's info card */
    .sec-2-10 .kinfo p { font-size: 15.5px; line-height: 1.45; margin: 0; } /* sets the reading size of the info card's paragraphs */
    /* phones: label each lab cell, since the column headers are hidden */
    .sec-2-10 .nrw .mbox > div::before { content: attr(data-l); display: block; font-size: 12.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); font-family: var(--font); } /* on phone-width screens, each field shows its own small label (taken from data-l) since the header row is hidden */
  `,  // ends the section's style text

  steps: [  // steps: the list of screens in this section, shown one at a time as the student clicks Next
    /* ---------------- 1. Big picture: what Linux is + where it runs ---------------- */
    {  // step 1 begins: what Linux is and the range of devices it runs on
      title: 'Linux: from a student\'s hobby to almost everywhere',  // step 1's title, shown as the screen heading
      kind: 'story',  // kind "story" labels this screen as a Big Picture step
      render(el, ctx) {  // render(el, ctx): builds the screen into el when the step opens; ctx carries the guide's helpers
        const { h } = ctx;  // takes h, the helper that builds page elements, from ctx
        if (ctx.narrow) el.classList.add('nrw');  // on a phone-width screen, adds the nrw class so the phone layout rules above take effect
        const TRAITS = [  // TRAITS: the four traits of Linux shown as boxes, each [id, label]
          ['free', 'Free and open source'], ['mod', 'Highly modular'], ['cfg', 'Easily configured'], ['port', 'Runs on many platforms'],  // the four traits: free, modular, configurable and portable
        ];  // ends the list of traits
        const ICON = {  // ICON: tiny outline drawings (SVG shapes) for each kind of device, keyed by a short name
          emb: '<rect x="6" y="22" width="36" height="14" rx="3"/><path d="M12 22 L9 7 M36 22 L39 7"/><circle cx="14" cy="29" r="1.6"/><circle cx="20" cy="29" r="1.6"/><path d="M28 29h8"/>',  // drawing of an embedded board with two antennas, like a home router
          phone: '<rect x="15" y="4" width="18" height="36" rx="4"/><path d="M21 35h6"/>',  // drawing of a phone
          laptop: '<rect x="10" y="8" width="28" height="20" rx="2"/><path d="M5 33h38l-3 4H8z"/>',  // drawing of a laptop
          server: '<rect x="9" y="5" width="30" height="9" rx="2"/><rect x="9" y="17" width="30" height="9" rx="2"/><rect x="9" y="29" width="30" height="9" rx="2"/><path d="M14 9.5h8M14 21.5h8M14 33.5h8"/>',  // drawing of a server rack with three units
          superc: '<rect x="3" y="7" width="10" height="31" rx="1.5"/><rect x="15" y="7" width="10" height="31" rx="1.5"/><rect x="27" y="7" width="10" height="31" rx="1.5"/><rect x="39" y="7" width="6" height="31" rx="1.5"/><path d="M6 13h4M18 13h4M30 13h4M6 19h4M18 19h4M30 19h4"/>',  // drawing of a row of supercomputer cabinets
        };  // ends the drawings
        const DEV = [  // DEV: the five kinds of device, smallest to largest; each has an icon, name, examples, story, matching traits and a reason
          { ic: 'emb', name: 'Embedded devices', eg: 'routers, smart TVs, cars',  // device 1: embedded devices such as routers, TVs and cars
            run: 'A home router or a smart TV has a small processor and little memory. Its maker builds a cut-down Linux kernel that holds only the drivers that one circuit board needs and stores it in flash memory. You never see Linux, but it is running the device.',  // how Linux runs in an embedded device: a cut-down kernel stored in flash memory
            tr: ['cfg', 'free', 'port'], fit: '<b>Easily configured:</b> everything the device does not need is simply left out. <b>Free:</b> no license fee to pay on millions of units.' },  // traits that fit embedded devices, with the reason: leave out what is not needed, and pay no license fee
          { ic: 'phone', name: 'Phones and tablets', eg: 'every Android device',  // device 2: phones and tablets
            run: 'Every Android phone runs a Linux kernel underneath the Android software you see (that story is section 2.11). Phone makers add kernel code for their own camera, radio and touch screen.',  // how Linux runs on Android phones, with makers adding their own hardware code
            tr: ['port', 'mod', 'free'], fit: '<b>Runs on many platforms:</b> phones use ARM processors, not the Intel chip Linux was first written for.' },  // traits that fit phones, with the reason: Linux runs on ARM processors too
          { ic: 'laptop', name: 'Laptops and desktops', eg: 'Ubuntu, Fedora, Debian…',  // device 3: laptops and desktops
            run: 'A <em>distribution</em> such as Ubuntu or Fedora bundles the kernel with the GNU tools, a desktop and applications. Plug in a new mouse or USB stick and the matching driver is added to the running kernel on the spot.',  // how Linux runs on a laptop: a distribution bundles it, and drivers are added on the spot
            tr: ['mod', 'free'], fit: '<b>Highly modular:</b> support for thousands of devices is on the disk, but only what you use is loaded into memory.' },  // traits that fit laptops, with the reason: thousands of drivers on disk, only the ones in use in memory
          { ic: 'server', name: 'Servers and the cloud', eg: 'web servers, cloud machines',  // device 4: servers and the cloud
            run: 'Most web servers, and most virtual machines rented in public clouds, run Linux. Companies read, tune and fix the source code themselves instead of waiting for a vendor.',  // how Linux runs on servers: companies tune and fix the source code themselves
            tr: ['free', 'cfg', 'mod'], fit: '<b>Free and open source:</b> no per-machine fee, and anyone can inspect the code or fix a bug.' },  // traits that fit servers, with the reason: no per-machine fee and the code is open to inspect
          { ic: 'superc', name: 'Super\u00ADcomputers', eg: 'the world\'s fastest machines',  // device 5: supercomputers (­ is a hidden hyphen that lets the long word break across two lines)
            run: 'For years now, every one of the world\'s 500 fastest supercomputers has run Linux, spreading one job over many thousands of processors.',  // how Linux runs on supercomputers: every one of the fastest 500 uses it
            tr: ['free', 'cfg', 'port'], fit: '<b>Open source:</b> research labs rebuild and tune the kernel for their own custom hardware.' },  // traits that fit supercomputers, with the reason: labs rebuild the kernel for their own hardware
        ];  // ends the device list
        let cur = 0;  // cur: which device is shown now; the screen starts with the first one
        const btns = DEV.map((d, i) => h('button', { class: 'dev', type: 'button', onclick: () => show(i), 'aria-label': d.name },  // btns: one button per device; clicking it calls show() with that device's number
          h('span', { html: `<svg viewBox="0 0 48 44" aria-hidden="true">${ICON[d.ic]}</svg>` }), h('b', {}, d.name), h('span', { class: 'xs muted center' }, d.eg)));  // each button holds the device's drawing, its name and its examples in small grey text
        const head = h('h3', { class: 'm0' });  // head: the heading that names the chosen device
        const run = h('p', { class: 'p15 m0' });  // run: the paragraph that explains how Linux runs on the chosen device
        const trs = TRAITS.map(([id, label]) => h('div', { class: 'tr', dataset: { id } }, label));  // trs: one box per trait; dataset stores the trait's id on the box so show() can match it
        const fit = h('div', { class: 'eg' });  // fit: the example box explaining why those traits matter for this device
        function show(i) {  // show(i): shows device i after a click (and once when the step opens)
          cur = i; const d = DEV[i];  // remembers the choice and looks up that device's record
          btns.forEach((b, j) => b.classList.toggle('on', j === i));  // highlights the chosen device's button and un-highlights the others
          head.textContent = d.name;  // writes the device's name into the heading
          run.innerHTML = d.run;  // writes how Linux runs there
          trs.forEach((t) => t.classList.toggle('on', d.tr.includes(t.dataset.id)));  // lights the traits that this device's record lists and dims the rest
          fit.innerHTML = d.fit;  // writes the reason those traits fit
          ctx.refit();  // asks the guide to re-measure the screen, since the text length changed
        }  // ends show()
        el.append(h('div', { class: 'split l fill' },  // puts the screen together: facts on the left (5 parts), the device explorer on the right (7 parts)
          h('div', { class: 'stack' },  // the left column
            h('p', { class: 'lead m0', html: 'In 1991 a computer science student in Finland wrote a small kernel for his own PC and shared it on the Internet. That kernel, <span class="t">Linux</span>, now runs in routers, phones, laptops, the cloud and the world\'s fastest supercomputers.' }),  // opening paragraph: a 1991 student kernel now runs from routers to supercomputers
            h('div', { class: 'card tight fact' }, h('b', {}, 'UNIX-like'), h('span', {}, 'It follows the design and commands of UNIX (sections 2.8 and 2.9), but was written from scratch and contains no original UNIX code.')),  // fact card: UNIX-like, but written from scratch with no original UNIX code
            h('div', { class: 'card tight fact' }, h('b', {}, 'Free and open'), h('span', { html: 'It is <span class="t">open source</span>: anyone may read, change and share it under the <span class="t">GNU General Public License (GPL)</span>.' })),  // fact card: free and open source under the GPL
            h('div', { class: 'card tight fact' }, h('b', {}, 'Monolithic, yet modular'), h('span', { html: 'A <span class="t">monolithic kernel</span> (one big program), yet built from parts that can be plugged in and pulled out while it runs.' })),  // fact card: a monolithic kernel that is still built from pluggable parts
            h('div', { class: 'callout analogy m0', 'data-label': 'Analogy' }, 'One engine design powers scooters and freight trucks alike: parts are added or left out to fit each vehicle.')),  // analogy box: one engine design fitted to scooters and trucks alike
          h('div', { class: 'card white stack', style: { gap: '10px' } },  // the right-hand card, the device explorer
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Where does Linux run? Click a device'), h('span', { class: 'xs muted' }, 'smallest → largest')),  // its header: "Where does Linux run? Click a device" and the note "smallest to largest"
            h('div', { class: 'devs' }, ...btns),  // the row of five device buttons
            h('div', { class: 'scale' }),  // the thin bar under the buttons that darkens from small to large
            h('div', { class: 'stack', style: { gap: '8px' } }, head, run),  // the chosen device's heading and explanation
            h('div', { class: 'stack', style: { gap: '5px' } }, h('span', { class: 'lbl' }, 'Which traits make it fit here?'), h('div', { class: 'trs' }, ...trs)),  // the "Which traits make it fit here?" label over the four trait boxes
            fit,  // the example box with the reason
            h('div', { class: 'row xs muted', style: { marginTop: 'auto', gap: '6px', borderTop: '1px dashed var(--line-2)', paddingTop: '8px' } },  // "Coming up" line pinned to the bottom of the card, above a dashed divider
              h('b', {}, 'COMING UP:'), h('span', {}, 'the history  →  why it won  →  kernel designs  →  modules, hands-on  →  a tour of the kernel')))));  // the label and the list of what the rest of the section covers
        show(cur);  // shows the first device so the card is filled when the step opens
      },  // ends render() for step 1
    },  // ends step 1
    /* ---------------- 2. Timeline: 1983 groundwork to today ---------------- */
    {  // step 2 begins: an explorable timeline of Linux from its groundwork to today
      title: '1991 onward: how a hobby kernel grew up',  // step 2's title, shown as the screen heading
      kind: 'explore',  // kind "explore" labels this screen as an Explore step
      render(el, ctx) {  // render(el, ctx): builds the timeline, the story card and the gauges when the step opens
        const { h } = ctx;  // takes h, the helper that builds page elements, from ctx
        if (ctx.narrow) el.classList.add('nrw');  // on a phone-width screen, adds the nrw class so the timeline wraps into two columns
        const ING = [['gnu', 'GNU tools fill in the rest of the system'], ['net', 'Helpers found over the Internet'], ['gpl', 'A free license (the GPL)'], ['mod', 'Modular, portable design']];  // ING: the four "ingredients of success", each [id, label], collected as the timeline moves forward
        const E = [  // E: the eight timeline events; each has a date, title, ingredient gained, gauge levels (g), story (x) and why (w)
          { y: '1983–85', t: 'The groundwork: GNU and the FSF', ing: 'gnu', g: null,  // event 1983-85: GNU and the FSF lay the groundwork; no gauges (g: null) because Linux does not exist yet
            x: 'Programmer Richard Stallman launched the <span class="t">GNU project</span> in 1983 to build a complete UNIX-like operating system that everyone would be free to use, study, change and share. In 1985 he set up the <span class="t">Free Software Foundation (FSF)</span> to support it. Over the next few years GNU produced a compiler, a shell, a C library, editors and dozens of utilities.',  // story for 1983-85: Stallman starts GNU and the FSF, which build everything but a kernel
            w: 'By 1991 GNU had nearly everything a working system needs except one piece: a finished kernel.' },  // why it mattered: by 1991 only the kernel was missing
          { y: '1991', t: 'A student\'s kernel', ing: 'net', g: [[1, 'one student'], [1, 'one: the Intel 80386 PC'], [1, 'his PC and a few hobbyists\'']],  // event 1991: Torvalds's kernel; each gauge entry is [level from 1 to 5, short description]
            x: 'Linus Torvalds, a computer science student at the University of Helsinki in Finland, got a PC built around Intel\'s 32-bit 80386 processor (a chip first sold in 1985) and began writing a UNIX-like kernel for it, partly to learn how the chip worked. In 1991 he announced the project on the Internet and put the code online for anyone to download.',  // story for 1991: a Helsinki student writes a kernel for his 80386 PC and puts it online
            w: 'Posting the code in the open invited strangers to test it, report bugs and send fixes. Collaborators around the world joined in.' },  // why it mattered: open code invited testers and helpers from around the world
          { y: '1992', t: 'Free under the GPL', ing: 'gpl', g: [[2, 'dozens of volunteers'], [1, 'one: the 386 PC'], [2, 'hobbyists and universities']],  // event 1992: Linux is released under the GPL, adding the license ingredient
            x: 'Torvalds released Linux under the <span class="t">GNU General Public License (GPL)</span>. Anyone may use, study, change and share it, and whoever passes on a changed version must share those changes on the same terms. Together with the GNU tools, Linux made a complete free operating system, and the first <em>distributions</em> (kernel plus tools, ready to install) appeared.',  // story for 1992: the GPL's terms and the first distributions
            w: 'No improvement could ever be locked away, so every contributor built on everyone else\'s work.' },  // why it mattered: no improvement could be locked away
          { y: '1994', t: 'Version 1.0', ing: null, g: [[2, 'dozens of regular contributors'], [1, 'mainly 386 PCs'], [2, 'PC users, via distributions']],  // event 1994: version 1.0
            x: 'After about two and a half years of work by a growing crowd of volunteers, Linux 1.0 was released (March 1994): a stable kernel for 386 PCs with networking built in.',  // story for 1994: a stable kernel for 386 PCs with networking
            w: 'A stable version made Linux practical for real work, not just for experiments.' },  // why it mattered: Linux became practical for real work
          { y: 'Mid 1990s', t: 'Beyond the PC', ing: 'mod', g: [[3, 'hundreds'], [3, 'several families'], [3, 'PCs and the first servers']],  // event mid 1990s: loadable modules and new processor families, adding the modular ingredient
            x: 'The kernel gained loadable modules, so a driver could be added while the system runs, and it was ported to processor families other than Intel\'s, such as Alpha, SPARC and MIPS. Version 2.0 (1996) could use several processors in one machine.',  // story for the mid 1990s: modules, ports to other processors, and multiprocessor support in 2.0
            w: 'This modular, portable design is what later let Linux spread to so many different kinds of hardware.' },  // why it mattered: this design later let Linux spread everywhere
          { y: '2000s', t: 'Servers, companies, gadgets', ing: null, g: [[4, 'thousands, many paid by companies'], [4, 'many families'], [4, 'servers, routers, TVs']],  // event 2000s: servers, paid developers and embedded gadgets
            x: 'Linux became a favourite for web servers. Companies began paying engineers to improve it, and manufacturers built it into routers, TVs and other embedded devices, trimming it to fit each one.',  // story for the 2000s: web servers, company engineers, routers and TVs
            w: 'Paid, professional work showed that a free, community-built kernel could be trusted with serious jobs.' },  // why it mattered: professional work proved a community kernel could be trusted
          { y: '2008', t: 'Linux in your pocket', ing: null, g: [[4, 'thousands'], [4, 'many, now including phone chips'], [5, 'phones and tablets too']],  // event 2008: Android phones arrive with a Linux kernel
            x: 'The first Android phones went on sale with a Linux kernel underneath. Billions of phones and tablets have run Linux since then (section 2.11).',  // story for 2008: billions of phones and tablets run Linux since then
            w: 'Linux became one of the most widely used kernels in the world, mostly inside devices whose owners never see it.' },  // why it mattered: Linux became one of the most used kernels, mostly out of sight
          { y: 'Today', t: 'Everywhere, built by thousands', ing: null, g: [[5, 'thousands every year'], [5, 'about twenty families'], [5, 'embedded chips to supercomputers']],  // event today: releases every nine or ten weeks from thousands of developers
            x: 'A new kernel version appears roughly every nine or ten weeks, with changes from thousands of developers at hundreds of companies and organisations; Torvalds still coordinates the work. Linux runs on about twenty processor families, from tiny embedded chips to every one of the world\'s 500 fastest supercomputers.',  // story for today: many companies contribute, and Linux runs on about twenty processor families
            w: 'The rest of this section shows how one kernel stretches that far: a monolithic design, built from loadable modules.' },  // why it mattered: leads into the rest of the section, monolithic but built from modules
        ];  // ends the list of events
        let cur = 0;  // cur: which event is shown now; the timeline starts at the first one
        const cards = E.map((e, i) => h('button', { class: 'tlc', type: 'button', onclick: () => show(i) }, h('span', { class: 'yr' }, e.y), h('span', { class: 'tt' }, e.t)));  // cards: one timeline button per event, showing its date and short title; a click shows that event
        const yr = h('span', { class: 'lbl' });  // yr: the small label over the story that repeats the chosen date
        const tt = h('h3', { class: 'm0' });  // tt: the story's heading
        const tx = h('p', { class: 'm0', style: { lineHeight: '1.6' } });  // tx: the story paragraph, with extra line spacing for easy reading
        const why = h('div', { class: 'callout why m0', 'data-label': 'Why it mattered' });  // why: the "Why it mattered" box under the story
        const prev = h('button', { class: 'btn sm', type: 'button', onclick: () => show(cur - 1) }, '◀ Earlier');  // Earlier button: steps back one event
        const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => show(cur + 1) }, 'Later ▶');  // Later button: steps forward one event
        const GL = ['People writing it', 'Processor families', 'Where it runs'];  // GL: the labels of the three "Linux at this point" gauges
        const gauges = GL.map((l) => { const segs = [0, 1, 2, 3, 4].map(() => h('i')); const v = h('span', { class: 'gv' }); return { segs, v, el: h('div', { class: 'gauge' }, h('span', { class: 'gl' }, l), h('div', { class: 'seg5' }, ...segs), v) }; });  // builds each gauge: five segments, a short note, and the gauge row; keeps the parts so show() can fill them
        const gNote = h('p', { class: 'small muted m0' });  // gNote: the small grey line under the gauges explaining what they mean
        const ings = ING.map(([id, label]) => h('div', { class: 'ing', dataset: { id } }, label));  // ings: one box per ingredient; dataset stores its id so show() can match it
        function show(i) {  // show(i): shows event i; runs on a card click, on Earlier or Later, and once at the start
          cur = ctx.util.clamp(i, 0, E.length - 1); const e = E[cur];  // keeps i inside the list (clamp limits a number to a range) and looks up that event
          cards.forEach((c, j) => { c.classList.toggle('on', j === cur); c.classList.toggle('past', j < cur); });  // highlights the chosen card and marks every earlier card as already passed
          yr.textContent = e.y; tt.textContent = e.t; tx.innerHTML = e.x; why.innerHTML = e.w;  // fills in the date, heading, story and why box
          gauges.forEach((g, k) => { const lv = e.g ? e.g[k][0] : 0; g.segs.forEach((s, j) => s.classList.toggle('on', j < lv)); g.v.textContent = e.g ? e.g[k][1] : '—'; });  // fills each gauge: lights as many segments as its level and writes its note, or shows a dash before 1991
          gNote.textContent = e.g ? 'Rough, qualitative levels: how big Linux had grown by this point.' : 'Linux does not exist yet. The gauges start to fill in 1991.';  // explains the gauges, or says they start in 1991 when Linux does not exist yet
          const have = new Set(E.slice(0, cur + 1).map((x) => x.ing).filter(Boolean));  // have: every ingredient gained by this event or an earlier one
          ings.forEach((n) => { n.classList.toggle('on', have.has(n.dataset.id)); n.classList.toggle('new', n.dataset.id === e.ing); });  // lights each collected ingredient and makes the one gained right now glow
          prev.disabled = cur === 0; next.disabled = cur === E.length - 1;  // disables Earlier at the first event and Later at the last
          ctx.refit();  // asks the guide to re-measure the screen, since the text length changed
        }  // ends show()
        el.append(h('div', { class: 'stack fill' },  // puts the screen together as one column
          h('div', { class: 'tl8' }, ...cards),  // the timeline row of eight cards across the top
          h('div', { class: 'split r grow' },  // under it, two cards side by side that grow to fill the free height (story wider, gauges smaller)
            h('div', { class: 'card white stack', style: { gap: '10px' } }, h('div', { class: 'stack', style: { gap: '2px' } }, yr, tt), tx, why,  // the story card: date and heading together, then the story and the why box
              h('div', { class: 'row', style: { marginTop: 'auto' } }, prev, next, h('span', { class: 'xs muted' }, 'or click any card above'))),  // a row pinned to the bottom of the story card: Earlier, Later and a hint to click the timeline
            h('div', { class: 'card stack', style: { gap: '12px' } },  // the gauges card
              h('span', { class: 'lbl' }, 'Linux at this point'), ...gauges.map((g) => g.el), gNote,  // its label, the three gauges and the note under them
              h('div', { class: 'stack', style: { gap: '6px', marginTop: 'auto' } }, h('span', { class: 'lbl' }, 'Ingredients of success, collected so far'), h('div', { class: 'ings' }, ...ings))))));  // "Ingredients of success, collected so far", pinned to the bottom, with the four ingredient boxes
        show(0);  // shows the first event so the screen is filled when the step opens
      },  // ends render() for step 2
    },  // ends step 2
    /* ---------------- 3. Why it won: the missing kernel + the GPL deal ---------------- */
    {  // step 3 begins: why Linux won, shown as a missing layer and a license game
      title: 'Why it won: a free license and the GNU tools',  // step 3's title, shown as the screen heading
      kind: 'learn',  // kind "learn" labels this screen as a Learn step
      render(el, ctx) {  // render(el, ctx): builds the layer stack and the GPL game when the step opens
        const { h } = ctx;  // takes h, the helper that builds page elements, from ctx
        /* left: the layers of a complete system, before and after Linux */
        const LAYERS = [  // LAYERS: the user-level layers of a complete system, top down; each is [style, name, detail, who wrote it]
          ['u', 'Your programs', 'editors such as GNU Emacs, games, tools', 'GNU + others'],  // layer: your programs, from GNU and others
          ['u', 'Shell', 'bash, the command line you type into', 'GNU'],  // layer: the shell, from GNU
          ['u', 'Basic commands', 'ls, cp, mv, grep and friends', 'GNU'],  // layer: basic commands such as ls and cp, from GNU
          ['u', 'C library', 'printf() and friends; wraps system calls', 'GNU'],  // layer: the C library, which wraps system calls, from GNU
          ['u', 'Compiler', 'GCC, which builds all of the above', 'GNU'],  // layer: the GCC compiler, from GNU
        ];  // ends the layer list
        const lays = h('div', { class: 'lays' });  // lays: the column where the layers are drawn
        const cap = h('div', { class: 'callout m0 p15' });  // cap: the callout under the stack that explains the chosen year
        let mode = 'before';  // mode: "before" shows 1991 with the kernel missing; "after" shows 1992 with Linux in place
        function paintStack() {  // paintStack(): redraws the stack and its callout for the chosen mode
          const kernel = mode === 'before'  // picks the kernel layer to draw for this mode
            ? h('div', { class: 'lay miss' }, h('div', { html: '<b>Kernel: missing</b> <small style="color:inherit">GNU\'s own kernel was not ready yet</small>' }), h('span', { class: 'who' }, 'GAP'))  // before: a red dashed "Kernel: missing" layer tagged GAP
            : h('div', { class: 'lay k flash' }, h('div', { html: '<b>Kernel: Linux</b> <small>by Torvalds and collaborators worldwide</small>' }), h('span', { class: 'who' }, 'LINUX'));  // after: a purple "Kernel: Linux" layer tagged LINUX, briefly flashing (the flash class) to draw the eye
          lays.replaceChildren(  // refills the stack in order
            ...LAYERS.map(([c, n, d, w]) => h('div', { class: 'lay ' + c }, h('div', { html: `<b>${n}</b> <small>${d}</small>` }), h('span', { class: 'who' }, w))),  // one row per user-level layer: bold name, small detail and the "who" tag
            kernel,  // then the kernel layer chosen above
            h('div', { class: 'lay hw' }, h('div', { html: '<b>Hardware</b> <small>an Intel 80386 PC in 1991</small>' }), h('span', { class: 'who' }, 'CHIPS')));  // and the hardware layer at the bottom: a 1991 Intel 80386 PC
          cap.className = 'callout m0 p15 ' + (mode === 'before' ? 'bad' : 'tip');  // colours the callout red before and green after
          cap.setAttribute('data-label', mode === 'before' ? 'A system with a hole in it' : 'A complete, free system');  // labels the callout "A system with a hole in it" or "A complete, free system"
          cap.innerHTML = mode === 'before'  // writes the callout's explanation for this mode
            ? 'The <span class="t">GNU project</span> had built almost every layer, but tools cannot run without a kernel underneath. Its own kernel was still far from finished, so the free system could not stand on its own.'  // before: GNU had every layer except a working kernel
            : 'Linux filled the gap. Because it was UNIX-like, the GNU tools ran on it with little change, and GCC could even compile Linux itself. That pairing is why some people call the whole system <b>GNU/Linux</b>; strictly, <b>Linux</b> is just the kernel.';  // after: Linux filled the gap, the GNU tools ran on it, and the name GNU/Linux explained
          ctx.refit();  // asks the guide to re-measure the screen, since the callout's length changed
        }  // ends paintStack()
        const seg = ctx.ui.seg([{ value: 'before', label: 'GNU alone, 1991' }, { value: 'after', label: 'GNU + Linux, 1992' }], mode, (v) => { mode = v; paintStack(); });  // the two year buttons; picking one switches the mode and redraws the stack

        /* right: the GPL deal, one scenario at a time */
        const SC = [  // SC: the five license scenarios; a is true when the GPL allows it, why explains the ruling
          { q: 'You download the Linux source code and read it to learn how the scheduler works.', a: true,  // scenario 1: reading the source to learn from it (allowed)
            why: 'The GPL guarantees the freedom to <b>study</b> the code. Publishing the source is the whole point.' },  // why scenario 1 is allowed: the GPL guarantees the freedom to study
          { q: 'You change the kernel for your own robot and never give the robot, or the code, to anyone.', a: true,  // scenario 2: changing the kernel privately and never sharing it (allowed)
            why: 'The duty to share only applies when you <b>distribute</b> the software. Private changes may stay private.' },  // why scenario 2 is allowed: the duty to share applies only when you distribute
          { q: 'Your company sells a router running a changed Linux kernel and keeps those kernel changes secret.', a: false,  // scenario 3: selling routers with secret kernel changes (not allowed)
            why: 'Selling the router distributes the kernel, so buyers must be able to get its source code, <b>including your changes</b>, under the GPL.' },  // why scenario 3 is not allowed: buyers must be able to get the changed source
          { q: 'You sell USB sticks with a Linux distribution on them.', a: true,  // scenario 4: selling USB sticks with a distribution on them (allowed)
            why: '"Free" means <b>freedom</b>, not zero price. You may charge for copies, as long as buyers get the same freedoms and the source.' },  // why scenario 4 is allowed: free means freedom, not zero price
          { q: 'You copy part of the Linux kernel into a new program and release it under a license that forbids sharing.', a: false,  // scenario 5: putting kernel code into a program with a no-sharing license (not allowed)
            why: 'This is <span class="t">copyleft</span>: distributed work built from GPL code must stay under the GPL, so shared code can never be turned into a closed product.' },  // why scenario 5 is not allowed: this is copyleft at work
        ];  // ends the scenario list
        let qi = 0; const res = SC.map(() => null);  // qi: the scenario on screen; res: for each scenario, true if judged right, false if wrong, null if not yet answered
        const dots = h('div', { class: 'gdots' });  // dots: the row of progress bars, one per scenario
        const box = h('div', { class: 'scen' });  // box: the boxed scenario text
        const fb = h('div', { class: 'fb' });  // fb: the feedback area under the answer buttons
        const bYes = h('button', { class: 'btn ok', type: 'button', style: { borderColor: 'var(--ok)', color: 'var(--ok)' }, onclick: () => answer(true) }, '✓ Allowed');  // the green "Allowed" button; clicking it answers true
        const bNo = h('button', { class: 'btn', type: 'button', style: { borderColor: 'var(--bad)', color: 'var(--bad)' }, onclick: () => answer(false) }, '✗ Not allowed');  // the red "Not allowed" button; clicking it answers false
        const bNext = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { qi = (qi + 1) % (SC.length + 1); if (qi === 0) res.fill(null); paintQ(); } });  // the Next button: moves to the next scenario, then to the summary, then (after the summary) clears the answers and starts again
        function answer(v) {  // answer(v): records the student's answer v for the current scenario
          if (qi >= SC.length || res[qi] !== null) return;  // ignores clicks on the summary screen or on a scenario already answered
          res[qi] = v === SC[qi].a; paintQ();  // stores whether the answer matched the right ruling, then repaints
        }  // ends answer()
        function paintQ() {  // paintQ(): redraws the game for the current scenario or the summary
          dots.replaceChildren(...SC.map((_, i) => h('i', { class: res[i] === true ? 'ok' : res[i] === false ? 'bad' : i === qi ? 'cur' : '' })));  // rebuilds the progress bars: green for right, red for wrong, chapter colour for the current one
          if (qi >= SC.length) {  // past the last scenario: the summary screen
            const n = res.filter(Boolean).length;  // n counts the scenarios judged correctly
            box.innerHTML = `<div class="lbl">All five done</div><b>You judged ${n} of ${SC.length} correctly.</b> The GPL in one line: use, study, change and share freely, and if you pass the software on, pass on the same freedoms and the source code too.`;  // summary text: the score and the GPL in one line
            fb.replaceChildren(); bYes.disabled = bNo.disabled = true; bNext.textContent = '↺ Start again'; bNext.style.display = '';  // clears the feedback, disables both answer buttons, and turns Next into "Start again"
          } else {  // otherwise: a scenario is on screen
            const s = SC[qi], done = res[qi] !== null;  // s is the current scenario; done is true once it has been answered
            box.innerHTML = `<div class="lbl">Scenario ${qi + 1} of ${SC.length}</div>${s.q}`;  // shows "Scenario n of 5" and the scenario's text
            bYes.disabled = bNo.disabled = done;  // the answer buttons work only until the scenario is answered
            fb.replaceChildren(done ? h('div', { class: 'callout m0 ' + (res[qi] ? 'tip' : 'bad'), 'data-label': (res[qi] ? 'Correct: ' : 'Not quite: ') + (s.a ? 'allowed' : 'not allowed'), html: s.why }) : h('p', { class: 'small muted m0' }, 'Decide, then read why.'));  // feedback: a green or red box with the verdict and the explanation, or a grey "Decide, then read why" before answering
            bNext.textContent = qi === SC.length - 1 ? 'See the summary ▶' : 'Next scenario ▶';  // the Next button says "See the summary" on the last scenario
            bNext.style.display = done ? '' : 'none';  // the Next button appears only after the scenario is answered
          }  // ends the scenario branch
          ctx.refit();  // asks the guide to re-measure the screen, since the text length changed
        }  // ends paintQ()
        el.append(h('div', { class: 'split fill' },  // puts the screen together: the layer card and the GPL card in two equal columns
          h('div', { class: 'card white stack', style: { gap: '10px' } },  // the left card
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'The layers of a complete system'), seg),  // its header: "The layers of a complete system" and the two year buttons
            lays, cap),  // the layer stack and its callout
          h('div', { class: 'card stack', style: { gap: '10px' } },  // the right card
            h('h3', { class: 'm0', html: 'The <span class="t">GPL</span> deal: allowed or not?' }),  // heading: "The GPL deal: allowed or not?"
            h('p', { class: 'small m0' }, 'Linux is free and open source under the GNU General Public License. For each case, decide whether the license allows it.'),  // instruction: decide whether the license allows each case
            dots, box, h('div', { class: 'row' }, bYes, bNo), fb, h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, bNext),  // the progress bars, the scenario, the two answer buttons, the feedback, and Next at the right
            h('div', { class: 'row', style: { marginTop: 'auto', gap: '6px', paddingTop: '8px', borderTop: '1px dashed var(--line-2)' } },  // a strip pinned to the bottom of the card, above a dashed divider
              h('span', { class: 'lbl' }, 'The deal:'), ...['run', 'study', 'change', 'share'].map((x) => h('span', { class: 'chip ok' }, x)),  // "The deal:" followed by four green chips: run, study, change, share
              h('span', { class: 'small' }, '+ pass the same freedoms on')))));  // and the rule that goes with them: pass the same freedoms on
        paintStack(); paintQ();  // draws the stack and the first scenario when the step opens
      },  // ends render() for step 3
    },  // ends step 3
    /* ---------------- 4. Compare: monolithic vs microkernel vs Linux ---------------- */
    {  // step 4 begins: compare a monolithic kernel, a microkernel and Linux by sending a request and crashing a driver
      title: 'Monolithic, microkernel, or Linux\'s middle way?',  // step 4's title, shown as the screen heading
      kind: 'compare',  // kind "compare" labels this screen as a Compare step
      render(el, ctx) {  // render(el, ctx): builds the design diagram, its buttons and the side cards when the step opens
        const { h, s } = ctx;  // takes h (builds page elements) and s (builds SVG shapes; SVG is the browser's drawing format) from ctx
        const BY = 148; // y of the user/kernel boundary in the diagram
        const DES = {  // DES: the three kernel designs; each has texts, the dot's stops (wp), the request's route (path) and a crash story
          mono: { label: 'Monolithic', name: 'Monolithic kernel',  // design 1, monolithic: its button label and full name
            sum: 'A <span class="t">monolithic kernel</span> puts the whole OS into one big program in kernel space. Its parts call each other directly, as ordinary functions, and they all share one address space.',  // summary: the whole OS is one big program in kernel space whose parts call each other directly
            rows: [['ok', 'Request speed:', 'fast. One trip into the kernel and back; the parts call each other directly.'], ['bad', 'A driver bug:', 'can crash everything, because there are no walls between the parts.'], ['bad', 'Adding a driver:', 'rebuild the kernel and restart the machine.'], ['', 'Examples:', 'traditional UNIX kernels; the earliest Linux, before modules.']],  // pros and cons rows, each [verdict, topic, text]: fast requests, a bug crashes everything, adding a driver needs a restart
            wp: { app: [105, 30], fs: [322, 214], drv: [442, 214] },  // wp: where the travelling dot stops for each box in the monolithic drawing, as [x, y]
            path: [['fs', 'A system call traps into the kernel, and the file-system code runs.'], ['drv', 'The file system calls the disk driver: an ordinary function call inside the kernel.'], ['disk', 'The driver tells the disk to read the block.'], ['fs', 'The driver returns the data to the file system.'], ['app', 'The kernel returns to the app with the data.']],  // the read request's route: file system, then disk driver, then the disk, and back, each step with its caption
            end: 'Everything happened inside one program, using plain function calls. That is why monolithic kernels are fast.',  // the closing remark: plain function calls are why monolithic kernels are fast
            crash: ['The disk driver follows a bad pointer and scribbles over kernel memory.', 'Every part runs in kernel mode in one shared address space, so nothing stops the damage. The whole system stops and must be restarted.'] },  // the two crash stages: a driver bug scribbles over memory, then the whole system stops
          micro: { label: 'Microkernel', name: 'Microkernel',  // design 2, microkernel: its button label and full name
            sum: 'A <span class="t">microkernel</span> keeps only message passing, address spaces and basic scheduling. File systems and drivers are ordinary server processes in user space.',  // summary: the kernel keeps only messages, address spaces and basic scheduling; the rest are user processes
            rows: [['warn', 'Request speed:', 'slower. One request becomes several messages, each a trip into and out of the kernel.'], ['ok', 'A driver bug:', 'contained. A crashed server is restarted while the rest keeps running.'], ['ok', 'Adding a driver:', 'start a new server process; the kernel is untouched.'], ['', 'Examples:', 'MINIX 3, QNX, seL4.']],  // pros and cons rows: slower requests, a driver bug is contained, a new driver is just a new process
            wp: { app: [86, 30], k: [320, 188], fs: [240, 30], drv: [394, 30] },  // wp: the dot's stops in the microkernel drawing, including the microkernel box (k) itself
            path: [['k', 'The request must travel as a message, so the app traps into the microkernel.'], ['fs', 'The microkernel delivers the message to the file-server process.'], ['k', 'The file server sends a message asking the disk-driver server for the block.'], ['drv', 'The microkernel delivers it to the disk-driver server.'], ['disk', 'The driver server operates the disk.'], ['k', 'It sends the data back in a reply message.'], ['fs', 'The microkernel delivers the reply to the file server.'], ['k', 'The file server sends its own reply to the app.'], ['app', 'The microkernel delivers it, and read() returns.']],  // the route: every hop goes through the microkernel as a message, between the app, file server and driver server
            end: 'Each message is one trip through the kernel (two crossings: in and out), plus a switch between processes. That extra work is the price of the walls between the parts.',  // the closing remark: each message costs two crossings and a process switch, the price of isolation
            crash: ['The disk-driver server crashes.', 'It was only a user process in its own address space. The microkernel and the other servers keep running; the driver server is restarted and the file server simply retries.'] },  // the two crash stages: the driver server crashes, then it is restarted while everything else keeps running
          linux: { label: 'Linux: modular monolithic', name: 'Linux: monolithic, built from modules',  // design 3, Linux: its button label and full name
            sum: 'One big kernel program, like a monolithic kernel, but much of it (file systems, drivers, protocols) comes as <span class="t">loadable modules</span> that are linked in while the system runs.',  // summary: one big kernel program, but much of it arrives as loadable modules
            rows: [['ok', 'Request speed:', 'fast. A loaded module is called directly, exactly like built-in code.'], ['bad', 'A driver bug:', 'can crash everything. A module runs in kernel mode with full privileges.'], ['ok', 'Adding a driver:', 'load a module into the running kernel; no rebuild, no restart.'], ['', 'Examples:', 'Linux; many other modern kernels also load drivers while running.']],  // pros and cons rows: fast requests, a module bug can crash everything, a driver loads without a restart
            wp: { app: [105, 30], fs: [311, 214], drv: [431, 214] },  // wp: the dot's stops in the Linux drawing
            path: [['fs', 'A system call traps into the kernel, and the vfat file-system module runs.'], ['drv', 'vfat\'s request is passed down (through the kernel\'s block layer) to the usb_storage driver module: direct function calls, just like built-in code.'], ['disk', 'The driver tells the USB stick to read the block.'], ['fs', 'The driver returns the data to vfat.'], ['app', 'The kernel returns to the app with the data.']],  // the route: the vfat module, then the usb_storage module, then the USB stick, and back
            end: 'Exactly like a monolithic kernel. Once it is linked in, a module is simply part of the one kernel program.',  // the closing remark: once linked in, a module is simply part of the one kernel program
            crash: ['A bug in the usb_storage module writes over kernel memory.', 'The module runs in kernel mode inside the one shared address space, so it can damage anything. Linux can sometimes survive by killing just the current process (an "oops"), but a serious bug stops the whole system (a "kernel panic").'] },  // the two crash stages: a module bug overwrites memory, then an "oops" or a full kernel panic
        };  // ends the designs table
        const st = { d: 'mono', lit: null, crash: 0, disk: false };  // st: the diagram's state: chosen design (d), the box the dot is on (lit), crash stage (0, 1 or 2), disk busy or not
        const cnt = { x: 0, m: 0 };  // cnt: the two counters: user/kernel crossings (x) and messages (m)
        let run = 0;  // run: bumped on every new action, so a slower animation still running can tell it has been replaced and stop
        const svg = s('svg', { viewBox: '0 0 640 392', width: '100%' });  // svg: the drawing surface for the design diagram
        const gS = s('g', {});  // gS: the group that holds the redrawn boxes
        const tok = s('circle', { r: 9, cx: 0, cy: 0, class: 'tok', style: 'fill:var(--chc);stroke:var(--panel);stroke-width:3;opacity:0' });  // tok: the travelling dot, hidden at first (opacity 0); the .tok style makes it glide from box to box
        svg.append(gS, tok);  // puts the boxes group in the drawing, with the dot on top
        function R(key, x, y, w, hh, cls, lines, o = {}) {  // R(): draws one labelled box by its key; o can set opacity, extra style, a dashed outline or a fixed-width title
          const over = st.over[key];  // over: a replacement colour for this box during a crash, if any
          const lit = st.lit === key || (key === 'disk' && st.disk);  // lit: the dot is on this box right now (or, for the disk, the disk is busy)
          const styl = [over ? '' : (o.style || ''), lit ? 'stroke:var(--chc)' : ''].filter(Boolean).join(';') || null;  // builds the box's inline style: its own fill (unless a crash colour replaces it) plus a chapter-coloured outline when lit
          const g = s('g', { opacity: o.op || null });  // g groups the box and its text, with optional fading
          g.append(s('rect', { x, y, width: w, height: hh, rx: 10, class: over || cls, 'stroke-width': lit ? 4 : 2, 'stroke-dasharray': o.dash || null, style: styl }));  // the rounded box itself, with a thick outline when lit and a dashed outline for modules
          const n = lines.length, lh = 17, y0 = y + hh / 2 - ((n - 1) * lh) / 2 + 5;  // n is the number of text lines; y0 places the first line so the whole block is centred in the box
          lines.forEach((t, i) => g.append(s('text', { x: x + w / 2, y: y0 + i * lh, 'text-anchor': 'middle', 'font-size': i ? 13 : 14.5, 'font-weight': i ? 400 : 700, class: i ? 's-sub' : null, style: o.mono && !i ? 'font-family:var(--mono)' : null }, t)));  // writes each line: the first bold (fixed-width if asked), the rest smaller and grey
          return g;  // hands back the finished box
        }  // ends R()
        function paint() {  // paint(): redraws the whole diagram for the current design, dot position and crash stage
          const d = st.d, dead = st.crash === 2 && d !== 'micro';  // d is the chosen design; dead is true when a crash has brought down a monolithic or Linux kernel
          st.over = {};  // clears the crash colour overrides
          if (st.crash) st.over.drv = st.crash === 2 && d === 'micro' ? 's-ok' : 's-intr';  // during a crash the driver box turns red, or green once a microkernel has restarted it
          if (dead) st.over.block = 's-intr';  // a dead kernel paints the whole kernel block red
          const k = [  // k collects the shapes that every design shares
            s('text', { x: 10, y: 141, 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '1' }, 'USER SPACE ↑'),  // label "USER SPACE" above the boundary line
            s('line', { x1: 4, y1: BY, x2: 636, y2: BY, class: 's-line', 'stroke-dasharray': '7 5' }),  // the dashed line between user space and kernel space, at height BY
            s('text', { x: 10, y: 167, 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '1' }, 'KERNEL SPACE ↓'),  // label "KERNEL SPACE" below the boundary line
            s('text', { x: 632, y: 141, 'font-size': 13, 'text-anchor': 'end', class: 's-sub' }, 'system-call boundary'),  // label at the right end of the line: "system-call boundary"
            s('line', { x1: 4, y1: 322, x2: 636, y2: 322, class: 's-muted', 'stroke-width': 1.5 }),  // a plain line separating the kernel from the hardware
            s('text', { x: 10, y: 344, 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '1' }, 'HARDWARE'),  // label "HARDWARE" under that line
          ];  // ends the shared shapes
          const op = dead ? 0.4 : null;  // op: fades the app box when the kernel under it has died
          if (d === 'micro') {  // the microkernel drawing
            k.push(R('app', 16, 30, 140, 80, 's-proc', ['App', 'calls read()']),  // the app, as a user process
              R('fs', 170, 30, 140, 80, 's-proc', ['File server', 'user process']),  // the file server, also a user process
              R('drv', 324, 30, 140, 80, 's-proc', st.crash === 2 ? ['Disk driver', 'restarted ✓'] : ['Disk driver', 'server process']),  // the disk-driver server, which reads "restarted" after crash stage 2
              R('net', 478, 30, 146, 80, 's-proc', ['Network', 'server process']),  // the network server, another user process
              R('k', 190, 188, 260, 104, 's-os', ['Microkernel', 'passes messages · address', 'spaces · basic scheduling']),  // the small microkernel box below the boundary
              R('disk', 342, 334, 104, 50, 's-io', ['Disk']));  // the disk in the hardware area
          } else {  // the monolithic and Linux drawings
            const lin = d === 'linux', bw = lin ? 478 : 608;  // lin is true for Linux; bw is the kernel block's width (Linux leaves room for a "not loaded" box)
            k.push(R('app', 30, 30, 150, 80, 's-proc', ['App', 'calls read()'], { op }));  // the app box, faded when the kernel is dead
            k.push(s('rect', { x: 16, y: 180, width: bw, height: 124, rx: 12, class: st.over.block || 's-os', 'stroke-width': 2 }));  // the big kernel block that holds every service, red after a panic
            k.push(s('text', { x: 30, y: 201, 'font-size': 13.5, 'font-weight': 700, style: dead ? 'fill:var(--intr)' : null },  // the block's caption
              dead ? 'KERNEL PANIC: the whole system is down' : lin ? 'Core kernel + loaded modules: one address space' : 'One big kernel program: one address space, all in kernel mode'));  // "KERNEL PANIC" after a crash, otherwise a caption describing this design's single address space
            const P = 'fill:var(--panel)';  // P: a plain panel fill so the service boxes stand out inside the purple block
            if (lin) {  // extra pieces for the Linux drawing
              k.push(R('sch', 28, 214, 104, 78, 's-os', ['Scheduler'], { style: P }), R('mem', 142, 214, 104, 78, 's-os', ['Memory', 'manager'], { style: P }),  // the scheduler and memory manager boxes, built into the core kernel
                R('fs', 256, 214, 110, 78, 's-os', ['vfat', 'file system', 'MODULE'], { style: P, dash: '6 4', mono: true }),  // the vfat file system, drawn with a dashed outline and the word MODULE
                R('drv', 376, 214, 110, 78, 's-io', ['usb_storage', 'driver', 'MODULE'], { dash: '6 4', mono: true }),  // the usb_storage driver, also a dashed MODULE box
                s('rect', { x: 506, y: 180, width: 118, height: 124, rx: 12, class: 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }),  // a dashed box at the right for modules still on disk
                s('text', { x: 565, y: 203, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'Not loaded:'),  // its heading: "Not loaded:"
                s('text', { x: 565, y: 219, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'still on disk'),  // its subtitle: "still on disk"
                ...['bluetooth.ko', 'nfs.ko', 'btrfs.ko'].map((m, i) => s('text', { x: 565, y: 246 + i * 19, 'text-anchor': 'middle', 'font-size': 13, style: 'font-family:var(--mono)' }, m)),  // three example module files listed inside it, one per line
                R('disk', 376, 334, 110, 50, 's-io', ['USB stick']));  // the USB stick in the hardware area
            } else {  // the plain monolithic drawing
              k.push(...[['sch', ['Scheduler']], ['mem', ['Memory', 'manager']], ['fs', ['File', 'system']], ['drv', ['Disk', 'driver']], ['net', ['Network', 'stack']]].map(([key, t], i) => R(key, 28 + i * 120, 214, 108, 78, 's-os', t, { style: P })),  // five built-in service boxes in a row, each placed 120 units apart
                R('disk', 388, 334, 108, 50, 's-io', ['Disk']));  // the disk in the hardware area
            }  // ends the monolithic branch
          }  // ends the choice of drawing
          gS.replaceChildren(...k);  // puts all the new shapes into the drawing
          cX.textContent = cnt.x; cM.textContent = cnt.m;  // updates the two counter displays
        }  // ends paint()
        const cX = h('b', {}, '0'), cM = h('b', {}, '0');  // cX and cM: the big numbers in the crossings and messages counters
        const status = h('div', { class: 'callout m0 p15' });  // status: the callout under the counters that narrates each step
        function say(cls, label, html) { status.className = 'callout m0 p15 ' + cls; status.setAttribute('data-label', label); status.innerHTML = html; ctx.refit(); }  // say(cls, label, html): restyles the status callout and changes its label and text, then re-measures
        function idle() {  // idle(): the resting message for the chosen design
          if (st.d === 'linux') say('warn', 'Common mistake', 'Modules do not turn Linux into a microkernel. A loaded module becomes part of the one kernel program: same address space, same kernel mode, no messages.');  // for Linux: warns that modules do not make Linux a microkernel
          else say('tip', 'Try it', 'Send a <code>read()</code> request and watch the counters. Then crash the disk driver and see how far the damage spreads.');  // otherwise: suggests sending a request, then crashing the driver
        }  // ends idle()
        function place(key) { const p = DES[st.d].wp[key]; tok.style.transform = `translate(${p[0]}px, ${p[1]}px)`; }  // place(key): moves the travelling dot to the named box's stop; the .tok style animates the move
        function reset() { run++; st.lit = null; st.crash = 0; st.disk = false; cnt.x = 0; cnt.m = 0; tok.style.opacity = 0; paint(); idle(); }  // reset(): cancels any animation, clears the crash, the dot and the counters, then redraws
        async function sendRead() {  // sendRead(): animates one read() request through the chosen design, one step per second (async lets it pause with await)
          const my = ++run, d = DES[st.d];  // my is this run's ticket number; d is the chosen design's record
          st.crash = 0; st.disk = false; st.lit = 'app'; cnt.x = 0; cnt.m = 0;  // clears any crash and the counters, and puts the dot on the app box
          tok.style.transition = 'none'; place('app'); tok.style.opacity = 1; tok.getBoundingClientRect(); tok.style.transition = '';  // jumps the dot to the app with no gliding: measuring its box forces the jump to happen before gliding is turned back on
          paint(); say('', 'Step 1', 'The app calls <code>read()</code> to get data from a file.');  // redraws and narrates step 1: the app calls read()
          let at = 'app', n = 1;  // at is the box the dot is on; n numbers the steps
          for (const [to, msg] of d.path) {  // walks the design's route one hop at a time
            await ctx.sleep(1000); if (!ctx.alive || my !== run) return;  // waits one second, then stops if the step has closed or a newer action has started (my no longer matches run)
            n++;  // counts this step
            if (to === 'disk') { st.disk = true; paint(); say('', 'Step ' + n, msg); continue; }  // a hop to the disk just marks the disk busy and narrates it; the dot stays where it is
            st.disk = false;  // any other hop clears the disk's busy mark
            const a = d.wp[at], b = d.wp[to];  // a and b are the dot's current and next stops
            if ((a[1] < BY) !== (b[1] < BY)) cnt.x++;  // crossing the user/kernel line (one stop above BY, the other below) adds one crossing
            if (to === 'k') cnt.m++;  // every visit to the microkernel box is one message passed
            at = to; st.lit = to; place(to); paint(); say('', 'Step ' + n, msg);  // moves the dot, lights the new box, redraws and narrates the step
          }  // ends the route loop
          await ctx.sleep(1000); if (!ctx.alive || my !== run) return;  // waits one more second, with the same check for a cancelled run
          st.lit = null; tok.style.opacity = 0; paint();  // hides the dot and redraws with no box lit
          say(st.d === 'micro' ? 'warn' : 'tip', 'Result', `<b>${cnt.x} crossings, ${cnt.m} messages.</b> ${d.end}`);  // result: the crossings and messages counted, plus the design's closing remark (amber for the microkernel)
        }  // ends sendRead()
        async function crash() {  // crash(): shows the two stages of a disk-driver crash in the chosen design
          const my = ++run, d = DES[st.d];  // takes a new ticket number and looks up the design
          tok.style.opacity = 0; st.lit = null; st.disk = false; st.crash = 1; cnt.x = 0; cnt.m = 0; paint();  // hides the dot, clears the counters and sets crash stage 1, which turns the driver red
          say('bad', 'Crash, stage 1', d.crash[0]);  // narrates stage 1: what the bug does
          await ctx.sleep(1300); if (!ctx.alive || my !== run) return;  // waits 1.3 seconds, stopping if the step closed or a newer action started
          st.crash = 2; paint();  // moves to crash stage 2 and redraws: a restarted server, or a dead kernel
          say(st.d === 'micro' ? 'tip' : 'bad', 'Crash, stage 2', d.crash[1]);  // narrates stage 2: good news for the microkernel, bad news for the other two
        }  // ends crash()
        const cardH = h('h3', { class: 'm0' }), cardS = h('p', { class: 'small m0' }), rowsEl = h('div', { class: 'stack', style: { gap: '7px' } });  // cardH, cardS, rowsEl: the heading, summary and pros-and-cons rows of the design card
        function paintCard() {  // paintCard(): fills the design card for the chosen design
          const d = DES[st.d]; cardH.textContent = d.name; cardS.innerHTML = d.sum;  // writes the design's name and summary
          rowsEl.replaceChildren(...d.rows.map(([v, k, t]) => h('div', { class: 'prow' }, h('span', { class: 'vd ' + v }, v === 'ok' ? '✓' : v === 'bad' ? '✗' : v === 'warn' ? '!' : '•'), h('div', {}, h('b', {}, k), ' ', h('span', {}, t)))));  // one row per pro or con: a tick, cross, "!" or dot badge, then the bold topic and its text
        }  // ends paintCard()
        const seg = ctx.ui.seg(Object.entries(DES).map(([value, d]) => ({ value, label: d.label })), st.d, (v) => { st.d = v; paintCard(); reset(); });  // the three design buttons; picking one changes the design, refills the card and resets the diagram
        el.append(h('div', { class: 'split r fill' },  // puts the screen together: diagram on the left (larger), cards on the right
          h('div', { class: 'card white stack', style: { gap: '8px' } },  // the diagram card
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Choose a design'), seg),  // its header: "Choose a design" and the design buttons
            svg,  // the design diagram
            h('div', { class: 'row', style: { gap: '8px', marginTop: 'auto' } },  // a row of buttons pinned to the bottom of the card
              h('button', { class: 'btn primary sm', type: 'button', onclick: sendRead }, '▶ Send a read() request'),  // Send a read() request: runs sendRead()
              h('button', { class: 'btn danger sm', type: 'button', onclick: crash }, 'Crash the disk driver'),  // Crash the disk driver: runs crash()
              h('button', { class: 'btn ghost sm', type: 'button', onclick: reset }, '↺ Reset'))),  // Reset: runs reset()
          h('div', { class: 'stack' },  // the right column
            h('div', { class: 'card stack', style: { gap: '8px' } }, cardH, cardS, rowsEl),  // the design card: name, summary and pros and cons
            h('div', { class: 'grid-2', style: { gap: '10px' } },  // the two counters side by side
              h('div', { class: 'card tight score' }, cX, h('span', {}, 'user ↔ kernel crossings')),  // counter: user/kernel crossings
              h('div', { class: 'card tight score' }, cM, h('span', {}, 'messages between processes'))),  // counter: messages between processes
            status)));  // the narrating status callout
        paintCard(); reset();  // fills the card and draws the starting diagram when the step opens
      },  // ends render() for step 4
    },  // ends step 4
    /* ---------------- 5. Loadable modules: dynamic linking + stacking ---------------- */
    {  // step 5 begins: what loadable modules are, with an animated load and a clickable module stack
      title: 'Loadable modules: plugging code into a running kernel',  // step 5's title, shown as the screen heading
      kind: 'explore',  // kind "explore" labels this screen as an Explore step
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the explanation column and the two tabs when the step opens
        const { h, s } = ctx;  // takes h (builds page elements) and s (builds SVG shapes) from ctx
        const T = (x, y, t, o) => s('text', Object.assign({ x, y, 'font-size': 13 }, o || {}), t);  // T(): draws text at a point, 13 units tall by default, with any extra settings merged in
        const MONO = 'font-family:var(--mono)';  // MONO: the style that switches drawing text to the fixed-width font used for code names
        const LBL = { 'font-weight': 800, class: 's-sub', 'letter-spacing': '1' };  // LBL: the settings for small bold spaced-out grey labels in the drawings
        /* ---- tab 1: watch usb_storage being loaded, linked, used and unloaded ---- */
        function linkTab(p) {  // linkTab(p): builds tab 1 into panel p: an animation of usb_storage being loaded, linked, used and unloaded
          const svg = s('svg', { viewBox: '0 0 680 300', width: '100%' });  // svg: the drawing surface for the animation
          const SYM = [['printk', '0xc01a2f40', 'core kernel'], ['usb_register_driver', '0xf8a01200', 'usbcore'], ['usb_submit_urb', '0xf8a03480', 'usbcore']];  // SYM: the symbol table's starting rows, each [name, address in memory, which part of the kernel it belongs to]
          const NEW = ['usb_stor_probe1', '0xf8b10a60', 'usb_storage'];  // NEW: the row usb_storage adds to the symbol table once it is recorded
          const NEEDS = [['usb_register_driver', '0xf8a01200'], ['usb_submit_urb', '0xf8a03480'], ['printk', '0xc01a2f40']];  // NEEDS: the names usb_storage calls but does not contain, each with the address linking will fill in
          const CAP = [  // CAP: the caption for each of the animation's eight frames
            '<b>Before.</b> The kernel is running and the <code>usbcore</code> module is already loaded: its entry is in the module table and its exported functions are in the symbol table. You plug in a USB flash drive, but no loaded code knows how to drive it.',  // frame 0 caption: before loading, usbcore is loaded and a flash drive is plugged in with no driver
            '<b>1. Read the file.</b> A loader command (<code>insmod</code>) reads <code>usb_storage.ko</code> from disk. It holds machine code plus a list of names the code calls but does not contain: its <b>unresolved symbols</b>.',  // frame 1 caption: insmod reads usb_storage.ko from disk, with its list of unresolved names
            '<b>2. Copy it in.</b> The kernel sets aside some kernel memory and copies the module\'s code and data into it. The system keeps running the whole time: there is no reboot.',  // frame 2 caption: its code and data are copied into kernel memory, with no reboot
            '<b>3. Link it: <span class="t">dynamic linking</span>.</b> Each unresolved name is looked up in the kernel\'s <span class="t">symbol table</span>, and its real address is written into every place the module calls it. A call to <code>usb_register_driver</code> now jumps straight into usbcore.',  // frame 3 caption: dynamic linking fills in the real address of every unresolved name
            '<b>4. Record it.</b> An entry for usb_storage goes at the <b>front</b> of the <span class="t">module table</span> (a linked list). It notes that usb_storage depends on usbcore, so usbcore can no longer be removed. Its own exported symbols join the symbol table, ready for modules stacked above it.',  // frame 4 caption: an entry goes at the front of the module table and its own symbols are published
            '<b>5. Start it.</b> The module\'s init function runs once. It calls <code>usb_register_driver</code> to tell usbcore "send me any USB storage device". usbcore hands over the flash drive, which now shows up as a disk.',  // frame 5 caption: the init function registers the driver with usbcore and the stick appears as a disk
            '<b>In use.</b> A program (<code>cp</code>) copies a file from the stick. Its <code>read()</code> system calls lead the kernel to call the module\'s functions, in kernel mode, <b>on behalf of that process</b>. The module never becomes a process of its own and sends no messages: the kernel simply calls it.',  // frame 6 caption: cp reads from the stick, and the kernel calls the module's code on that process's behalf
            '<b>Unload.</b> Once the stick is unmounted and nothing uses the module, <code>rmmod</code> runs its exit function, removes its symbols, unlinks its node from the list and frees its memory. Again, no reboot.',  // frame 7 caption: rmmod runs the exit function, unlinks the entry and frees the memory
          ];  // ends the captions
          function draw(i) {  // draw(i): redraws the animation for frame i
            const inMem = i >= 2 && i <= 6, linked = i >= 3 && i <= 6, listed = i >= 4 && i <= 6;  // inMem: the module is in memory (frames 2-6); linked: its addresses are filled in (3-6); listed: it is in the tables (4-6)
            const k = [  // k collects the shapes of this frame
              T(8, 14, 'ON DISK', LBL), T(190, 14, 'KERNEL MEMORY (THE KERNEL KEEPS RUNNING THROUGHOUT)', LBL),  // the two area labels: ON DISK and KERNEL MEMORY
              s('rect', { x: 4, y: 22, width: 174, height: 272, rx: 12, class: 's-panel', 'stroke-width': 1.5 }),  // the grey on-disk area on the left
              s('rect', { x: 186, y: 22, width: 490, height: 272, rx: 12, class: 's-os', 'stroke-width': 1.5, style: 'fill:none' }),  // the purple outline of the kernel-memory area on the right
              s('rect', { x: 10, y: 32, width: 162, height: 150, rx: 8, class: 's-io', 'stroke-width': i === 1 ? 4 : 2, style: i === 1 ? 'stroke:var(--chc)' : null }),  // the module file's box on disk, outlined in the chapter colour while it is being read (frame 1)
              T(91, 52, 'usb_storage.ko', { 'text-anchor': 'middle', 'font-weight': 800, style: MONO }),  // the file's name, usb_storage.ko
              T(91, 71, 'machine code + data', { 'text-anchor': 'middle', class: 's-sub' }),  // its subtitle: machine code plus data
              s('line', { x1: 18, y1: 82, x2: 164, y2: 82, class: 's-muted', 'stroke-width': 1 }),  // a thin divider inside the file box
              T(17, 101, 'unresolved names:', { 'font-weight': 700, style: 'fill:var(--intr)' }),  // red heading for the names the file calls but does not contain
              ...NEEDS.map(([n], j) => T(17, 122 + j * 19, n, { style: MONO })),  // the three unresolved names, one per line
              T(90, 208, i === 7 ? 'still on disk, ready' : 'stays on disk; a copy', { 'text-anchor': 'middle', class: 's-sub' }),  // note under the file, line 1: the file stays on disk (or, after unloading, is still there)
              T(90, 226, i === 7 ? 'for next time' : 'is made in memory', { 'text-anchor': 'middle', class: 's-sub' }),  // note under the file, line 2: a copy is made in memory (or, after unloading, it is ready for next time)
              /* usbcore (already loaded) */
              s('rect', { x: 468, y: 34, width: 198, height: 106, rx: 10, class: 's-os', 'stroke-width': 2, 'stroke-dasharray': '6 4', style: 'fill:var(--panel)' }),  // the dashed box for usbcore, which was loaded earlier
              T(478, 54, 'usbcore (module)', { 'font-weight': 800, style: MONO }),  // its heading: usbcore (module)
              T(478, 74, 'contains and exports:', { class: 's-sub' }),  // its subtitle: contains and exports
              T(478, 94, 'usb_register_driver()', { style: MONO }), T(478, 112, 'usb_submit_urb()', { style: MONO }),  // the two functions usbcore offers to other modules
            ];  // ends the shapes shared by every frame
            if (i === 1 || i === 2) k.push(s('line', { x1: 173, y1: 100, x2: 195, y2: 100, 'stroke-width': 3, style: 'stroke:var(--chc)', 'marker-end': 'url(#arr-accent)' }));  // in frames 1 and 2 an arrow shows the file's contents moving from disk into memory
            if (inMem) {  // frames where the module is in memory
              k.push(s('rect', { x: 198, y: 34, width: 262, height: 106, rx: 10, class: 's-os', 'stroke-width': i === 2 || i >= 5 ? 4 : 2, 'stroke-dasharray': '6 4', style: 'fill:var(--panel)' + (i === 2 || i >= 5 ? ';stroke:var(--chc)' : '') }),  // the module's box in kernel memory, outlined in the chapter colour when it has just arrived or is running
                T(208, 54, 'usb_storage (module)', { 'font-weight': 800, style: MONO }),  // the module's heading inside its memory box: usb_storage (module)
                T(208, 74, 'its calls → target address', { class: 's-sub' }),  // subtitle: each call the module makes, and the address it jumps to
                ...NEEDS.map(([n, a], j) => [T(208, 94 + j * 18, n, { style: MONO }), T(450, 94 + j * 18, linked ? a : '????', { 'text-anchor': 'end', 'font-weight': 700, style: MONO + ';fill:var(' + (linked ? '--ok' : '--intr') + ')' })]).flat());  // each needed name on the left; on the right its real address in green once linked, or red "????" before linking
              if (i === 5) k.push(T(450, 54, 'init() ran ✓', { 'text-anchor': 'end', 'font-weight': 700, style: 'fill:var(--ok)' }));  // in frame 5 the box notes that init() has run
              if (i === 6) k.push(T(450, 54, 'running for cp', { 'text-anchor': 'end', 'font-weight': 700, style: 'fill:var(--proc)' }));  // in frame 6 the box notes that it is running on behalf of cp
            } else if (i !== 1) {  // frames 0 and 7 (before loading, after unloading): a dashed empty area of free kernel memory
              k.push(s('rect', { x: 198, y: 34, width: 262, height: 106, rx: 10, class: 's-muted', 'stroke-dasharray': '4 5' }), T(329, 92, i === 7 ? 'memory freed' : 'free kernel memory', { 'text-anchor': 'middle', class: 's-sub' }));  // the empty area, labelled "free kernel memory" or, after unloading, "memory freed"
            } else {  // frame 1: the area is still empty while the file is being read
              k.push(s('rect', { x: 198, y: 34, width: 262, height: 106, rx: 10, class: 's-muted', 'stroke-dasharray': '4 5' }), T(329, 92, 'about to be filled…', { 'text-anchor': 'middle', class: 's-sub' }));  // the empty area labelled "about to be filled"
            }  // ends the choice of memory box
            /* symbol table */
            const rows = SYM.concat(listed ? [NEW] : []);  // rows: the symbol table's rows for this frame; usb_storage's own row is added once it is recorded
            k.push(s('rect', { x: 198, y: 150, width: 338, height: 140, rx: 10, class: 's-panel', 'stroke-width': 1.5 }),  // the symbol table's panel
              T(208, 168, 'KERNEL SYMBOL TABLE', LBL),  // its heading: KERNEL SYMBOL TABLE
              T(208, 188, 'name', { class: 's-sub' }), T(366, 188, 'address', { class: 's-sub' }), T(456, 188, 'from', { class: 's-sub' }));  // the column headings: name, address and which part it comes from
            rows.forEach(([n, a, f], j) => {  // draws each row of the symbol table
              const y = 208 + j * 20, hot = (i === 3 && j < 3) || (i === 4 && j === 3);  // y is the row's height on the page; hot marks rows to highlight: the lookups in frame 3, the new row in frame 4
              if (hot) k.push(s('rect', { x: 202, y: y - 14, width: 330, height: 19, rx: 4, style: 'fill:var(--accent-bg);stroke:var(--accent)', 'stroke-width': 1 }));  // a highlighted row gets a tinted strip behind it
              k.push(T(208, y, n, { style: MONO }), T(366, y, a, { style: MONO }), T(456, y, f, {}));  // the row's name, address and origin in three columns
            });  // ends the rows
            /* module list: a linked list, newest node first */
            const nodes = listed ? ['usb_storage', 'usbcore'] : ['usbcore'];  // nodes: the module table's entries, newest first; usb_storage joins at the front once recorded
            k.push(s('rect', { x: 546, y: 150, width: 120, height: 140, rx: 10, class: 's-panel', 'stroke-width': 1.5 }), T(553, 168, 'MODULE TABLE', Object.assign({}, LBL, { 'letter-spacing': '0' })), T(556, 188, 'head', { class: 's-sub', style: MONO }));  // the module table's panel, its heading, and the word "head" where the list starts
            const ptr = (y0) => [s('line', { x1: 606, y1: y0, x2: 606, y2: y0 + 6, class: 's-line', 'stroke-width': 1.5 }), s('path', { d: `M600 ${y0 + 5} L612 ${y0 + 5} L606 ${y0 + 11} Z`, style: 'fill:var(--ink-2)' })];  // ptr(): a tiny down arrow (a short line and a triangle tip) standing for one "next" pointer
            let y = 192;  // y tracks how far down the list drawing has reached
            nodes.forEach((n, j) => {  // draws each entry in the list
              k.push(...ptr(y)); y += 12;  // an arrow leading into this entry, then moves down
              const hot = i === 4 && j === 0;  // the new entry is highlighted in frame 4, when it is added
              k.push(s('rect', { x: 552, y, width: 108, height: 22, rx: 6, class: 's-os', 'stroke-width': hot ? 3 : 1.5, style: hot ? 'stroke:var(--chc)' : null }), T(606, y + 16, n, { 'text-anchor': 'middle', style: MONO }));  // the entry's box with its name inside
              y += 22;  // moves down past the entry
            });  // ends the entries
            k.push(...ptr(y), T(606, y + 26, 'NULL', { 'text-anchor': 'middle', class: 's-sub', style: MONO }));  // a last arrow leading to NULL, the end of the list
            svg.replaceChildren(...k);  // replaces the drawing with this frame's shapes
          }  // ends draw()
          const player = ctx.ui.player({ count: CAP.length, render: (i) => { draw(i); return CAP[i]; }, interval: 3400 });  // the guide's step player: Play, Pause, Next and Back buttons; each frame redraws and returns its caption; autoplay moves every 3.4 seconds
          p.append(h('div', { class: 'stack', style: { gap: '8px' } }, svg, player.el));  // puts the drawing and the player into the tab's panel
        }  // ends linkTab()
        /* ---- tab 2: a real module stack; click a module to see what it needs and what needs it ---- */
        function stackTab(p) {  // stackTab(p): builds tab 2 into panel p: a real stack of modules the student can click
          const N = {  // N: the seven modules in the diagram, each with its box position, width and a description
            uas: { x: 160, y: 8, w: 110, d: 'A faster way of talking to USB disks. It reuses code from usb_storage and from usbcore.' },  // module box: uas, the faster USB disk protocol, at the top
            usb_storage: { x: 24, y: 80, w: 140, d: 'The driver for USB flash drives and USB disks.' },  // module box: usb_storage, the USB flash drive driver
            xhci_hcd: { x: 250, y: 80, w: 110, d: 'The driver for the USB controller chip, the hardware behind the USB ports.' },  // module box: xhci_hcd, the USB controller driver
            usbcore: { x: 24, y: 152, w: 336, d: 'The USB core: code that every USB driver needs, such as registering a driver or sending a request to a device.' },  // module box: usbcore, the shared USB core at the bottom, wide enough to sit under three modules
            vfat: { x: 420, y: 80, w: 100, d: 'The VFAT file system, the format most USB sticks use.' },  // module box: vfat, the usual USB stick file system
            msdos: { x: 540, y: 80, w: 100, d: 'The older MS-DOS file system, a close cousin of VFAT.' },  // module box: msdos, the older cousin of vfat
            fat: { x: 440, y: 152, w: 180, d: 'Shared code for every file system in the FAT family.' },  // module box: fat, the shared code under both FAT file systems
          };  // ends the module table
          const E = [['uas', 'usb_storage', 180, 140], ['uas', 'usbcore', 230, 230], ['usb_storage', 'usbcore', 94, 94], ['xhci_hcd', 'usbcore', 305, 305], ['vfat', 'fat', 470, 490], ['msdos', 'fat', 590, 570]];  // E: the "uses code from" arrows, each [user, used module, arrow start x, arrow end x]
          let sel = 'usbcore';  // sel: the module currently clicked; starts with usbcore
          const svg = s('svg', { viewBox: '0 0 660 196', width: '100%' });  // svg: the drawing surface for the module stack
          const info = h('div', { class: 'card white tight stack', style: { gap: '5px' } });  // info: the card under the diagram that describes the selected module
          function paint() {  // paint(): redraws the stack and the info card for the selected module
            const needs = E.filter((e) => e[0] === sel).map((e) => e[1]);  // needs: the modules the selected one uses
            const by = E.filter((e) => e[1] === sel).map((e) => e[0]);  // by: the modules that use the selected one
            const k = [T(420, 14, 'Click any module.', { 'font-weight': 700 }), T(420, 32, 'Arrow = "uses code from"', { class: 's-sub' }), T(420, 50, 'green = what it needs', { style: 'fill:var(--ok)', 'font-weight': 700 }), T(420, 68, 'orange = what needs it', { style: 'fill:var(--warn)', 'font-weight': 700 })];  // k starts with the key in the top-right corner: click hint, arrow meaning, green for needs, orange for needed-by
            E.forEach(([a, b, x1, x2]) => {  // draws every arrow
              const col = a === sel ? '--ok' : b === sel ? '--warn' : null;  // an arrow out of the selected module is green; an arrow into it is orange; others stay grey
              k.push(s('line', { x1, y1: N[a].y + 40, x2, y2: N[b].y - 3, 'stroke-width': col ? 3 : 2, class: col ? null : 's-muted', style: col ? `stroke:var(${col})` : null, 'marker-end': col === '--ok' ? 'url(#arr-ok)' : col === '--warn' ? 'url(#arr-warn)' : 'url(#arr-muted)' }));  // the arrow from the bottom of the user's box to the top of the used module's box, with a matching arrowhead
            });  // ends the arrows
            Object.entries(N).forEach(([n, o]) => {  // draws every module box
              const c = n === sel ? 's-accent' : needs.includes(n) ? 's-ok' : by.includes(n) ? 's-warn' : 's-os';  // colour: accent for the selected module, green for what it needs, orange for what needs it, purple otherwise
              k.push(s('g', { class: 'mnode hot', role: 'button', tabindex: 0, 'aria-label': n, onclick: () => { sel = n; paint(); }, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel = n; paint(); } } },  // the clickable box group: a click or Enter/Space selects this module and repaints
                s('rect', { x: o.x, y: o.y, width: o.w, height: 40, rx: 9, class: c, 'stroke-width': n === sel ? 3.5 : 2 }),  // the box itself, thicker when selected
                T(o.x + o.w / 2, o.y + 25, n, { 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 14.5, style: MONO })));  // the module's name in fixed-width text, centred in the box
            });  // ends the boxes
            svg.replaceChildren(...k);  // replaces the drawing with the new shapes
            const refs = by.length;  // refs: how many loaded modules rely on the selected one
            info.replaceChildren(  // refills the info card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { class: 'mono' }, sel), h('span', { class: 'chip ' + (refs ? 'warn' : 'ok') }, 'reference count ' + refs)),  // top line: the module's name and a "reference count" chip, amber when above 0
              h('p', { class: 'small m0' }, N[sel].d),  // the module's description
              h('div', { class: 'small', html: `<span class="chip ok">needs</span> ${needs.length ? needs.join(', ') : 'nothing below it: it is a bottom library'} &nbsp; <span class="chip warn">needed by</span> ${by.length ? by.join(', ') : 'no other module'}` }),  // two lists: what it needs (or "a bottom library") and what needs it (or "no other module")
              h('div', { class: 'small b', style: { color: refs ? 'var(--warn)' : 'var(--ok)' } }, refs ? `rmmod ${sel}: refused while ${by.join(', ')} ${by.length > 1 ? 'are' : 'is'} loaded.` : `rmmod ${sel}: allowed, provided nothing is using it right now (usecount 0).`));  // the rmmod verdict: refused while other modules rely on it, otherwise allowed if its usecount is 0
            ctx.refit();  // asks the guide to re-measure the screen, since the card's height changed
          }  // ends paint()
          paint();  // draws the stack once when the tab opens
          p.append(h('div', { class: 'stack', style: { gap: '10px' } },  // puts the tab together
            svg, info,  // the diagram and the info card
            h('div', { class: 'grid-2', style: { gap: '10px' } },  // two small cards side by side under them
              h('div', { class: 'card tight small' }, h('b', {}, 'No duplicated code. '), 'Shared code (every USB driver needs usbcore) is written and loaded once, in a lower module.'),  // card: stacking means shared code is written and loaded only once
              h('div', { class: 'card tight small' }, h('b', {}, 'Safe loading and unloading. '), 'Counted references let the kernel load prerequisites first and refuse to remove a module others need.'))));  // card: counted references make loading and unloading safe
        }  // ends stackTab()
        el.append(h('div', { class: 'split l fill' },  // puts the step together: explanation on the left (5 parts), the two tabs on the right (7 parts)
          h('div', { class: 'stack', style: { gap: '10px' } },  // the left column
            h('p', { class: 'lead m0', html: 'A <span class="t">loadable module</span> is a relatively independent block of kernel code that does one specific job.' }),  // opening line: a loadable module is an independent block of kernel code that does one job
            h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'chip os' }, 'vfat · file system'), h('span', { class: 'chip io' }, 'usb_storage · driver'), h('span', { class: 'chip accent' }, 'bluetooth · protocol')),  // three example chips: a file system, a driver and a protocol
            h('p', { class: 'p15 m0', html: 'Modules are loaded into the kernel and removed from it <b>while the system runs</b>. A loaded module is not a separate process: its code runs in <span class="t">kernel mode</span> on behalf of whichever process is running, for example during that process\'s <span class="t">system call</span>.' }),  // paragraph: modules load and unload while running, and run in kernel mode for the current process
            h('div', { class: 'card os prop' }, h('b', {}, '1 · Dynamic linking'), h('span', {}, 'A module is loaded and linked into the kernel while the kernel is in memory and running, and can be unlinked and removed at any time. Watch it in the first tab.')),  // property card 1: dynamic linking
            h('div', { class: 'card os prop' }, h('b', { html: '2 · <span class="t">Stackable modules</span>' }), h('span', { html: 'Modules form a hierarchy: a lower module is a library for the client modules above it, and the kernel counts those references. See the second tab.' })),  // property card 2: stackable modules
            h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters' }, 'The disk holds drivers for thousands of devices, but memory holds only the ones in use right now.')),  // "Why it matters" box: the disk holds every driver, memory only the ones in use
          ctx.ui.tabs([{ label: 'Watch a module load', render: linkTab }, { label: 'See the stack', render: stackTab }])));  // the guide's tabs helper with the two tabs; each tab's render function builds its panel when it is opened
      },  // ends render() for step 5
    },  // ends step 5
    /* ---------------- 6. The module table, one entry field by field ---------------- */
    {  // step 6 begins: one module-table entry explored field by field, with buttons to test the unload rules
      title: 'The module table: one entry, field by field',  // step 6's title, shown as the screen heading
      kind: 'explore',  // kind "explore" labels this screen as an Explore step
      render(el, ctx) {  // render(el, ctx): builds the entry drawing, the info card and the rule buttons when the step opens
        const { h, s } = ctx;  // takes h (builds page elements) and s (builds SVG shapes) from ctx
        const T = (x, y, t, o) => s('text', Object.assign({ x, y, 'font-size': 13 }, o || {}), t);  // T(): draws text at a point, 13 units tall by default, with any extra settings merged in
        const MONO = 'font-family:var(--mono)';  // MONO: the style that switches drawing text to the fixed-width font used for code names
        const LBL = { 'font-weight': 800, class: 's-sub', 'letter-spacing': '1' };  // LBL: the settings for small bold spaced-out grey labels in the drawing
        /* the fields of usb_storage's entry, top to bottom */
        const F = [  // F: the eight fields of usb_storage's table entry; each has a key, a label, an info-card title, an explanation and an example
          { k: 'next', l: 'next', title: 'next: the link to the next entry',  // field 1, next: the link to the next entry
            x: 'The module table is a <b>linked list</b>. Each entry holds the address of the next entry, and the last one holds NULL. The kernel walks the list from <code>module_list</code> to find a module, and a newly loaded module goes at the front.',  // explanation for next: the table is a linked list and new modules go at the front
            eg: 'usb_storage\'s <code>next</code> points at usbcore\'s entry, because usbcore was loaded before it.' },  // example for next: it points at usbcore, which was loaded earlier
          { k: 'name', l: 'name', title: 'name',  // field 2, name
            x: 'The module\'s name. Commands such as <code>rmmod</code> and <code>lsmod</code> find an entry by walking the list and comparing names.',  // explanation for name: commands find an entry by comparing names
            eg: '<code>rmmod usb_storage</code> looks for the entry whose name is "usb_storage".' },  // example for name: rmmod usb_storage searches for that name
          { k: 'size', l: 'size', title: 'size',  // field 3, size
            x: 'How much kernel memory the module\'s code and data take up. The kernel needs it to free exactly that memory when the module is removed, and <code>lsmod</code> reports it.',  // explanation for size: how much kernel memory to free on unload
            eg: '80 KB: the copy of usb_storage.ko\'s code and data that now sits in kernel memory.' },  // example for size: 80 KB of code and data
          { k: 'use', l: 'usecount', title: 'usecount',  // field 4, usecount
            x: 'Counts the operations using the module\'s functions right now: +1 when one starts, −1 when it ends. While it is above 0, the kernel refuses to unload the module, because its code may still be running.',  // explanation for usecount: +1 when an operation starts, -1 when it ends; above 0 blocks unloading
            eg: 'Two reads start and one ends: 0 + 2 − 1 = 1. Try it with the buttons.' },  // example for usecount: two starts and one end leave 1
          { k: 'flags', l: 'flags', title: 'flags: the module\'s state',  // field 5, flags: the module's state
            x: 'Status bits recording what state the module is in: still loading (its init function has not finished), live, or being removed. The kernel checks them so that nothing calls into a half-loaded or half-removed module.',  // explanation for flags: loading, live or being removed, so nothing calls a half-ready module
            eg: () => st.gone ? 'none any more: the entry has been removed from the table.' : st.flag === 'LOADING' ? 'LOADING: usb_storage\'s init function is still running, so no work may start yet.' : st.flag === 'GOING' ? 'GOING: rmmod has begun, so no new work may start while the exit function runs.' : 'LIVE: init has run, and usb_storage is ready for work.' },  // example for flags: a function, so the text always matches the current state (removed, LOADING, GOING or LIVE)
          { k: 'syms', l: 'symbol table', hint: 'syms, nsyms', title: 'Symbol table: what it offers others',  // field 6, the symbol table; hint shows the real field names (syms, nsyms) under the label
            x: 'The module\'s exported symbols: the name of each function or variable it offers to other modules, with the address where it lives (nsyms says how many). A newly loaded module\'s unresolved names are looked up in these tables.',  // explanation for the symbol table: the names this module offers others, with their addresses
            eg: 'uas calls <code>usb_stor_adjust_quirks()</code>, so it was linked to the address listed here.' },  // example for the symbol table: uas was linked to one of these addresses
          { k: 'deps', l: 'dependencies', hint: 'deps, ndeps', title: 'Dependencies: what it relies on',  // field 7, dependencies (deps, ndeps)
            x: 'The modules this one relies on, because it calls their exported symbols (ndeps says how many). They must stay loaded for as long as this module is loaded.',  // explanation for dependencies: the modules this one calls, which must stay loaded
            eg: 'usb_storage calls <code>usb_register_driver()</code> in usbcore, so usbcore is on this list.' },  // example for dependencies: usb_storage relies on usbcore
          { k: 'refs', l: 'used by', hint: 'refs', title: 'Used by: who relies on it',  // field 8, used by (refs)
            x: 'The reverse direction: the loaded modules stacked on this one. While this list is not empty, <code>rmmod</code> is refused, because those modules would be left calling freed memory.',  // explanation for used by: modules stacked on this one; while any remain, rmmod is refused
            eg: () => st.uas ? 'uas is stacked on usb_storage, so usb_storage can be removed only after uas.' : 'uas has been unloaded, so this list is empty and no longer blocks <code>rmmod usb_storage</code>.' },  // example for used by: a function, so it reports whether uas is still stacked on usb_storage
        ];  // ends the field list
        const FK = Object.fromEntries(F.map((f) => [f.k, f]));  // FK: the same fields looked up by key, such as FK.use
        const RH = 42, RY = (i) => 120 + i * RH;  // RH: the height of one field row in the drawing; RY(i) gives the top of row i
        let st, run = 0;  // st: the entry's live state (set by fresh); run: bumped by each action so a delayed update can tell it is stale
        const fresh = () => ({ use: 0, uas: true, gone: false, flag: 'LIVE', sel: 'next', bad: null });  // fresh(): the starting state: usecount 0, uas loaded, entry present, flags LIVE, the next field selected, no error
        const svg = s('svg', { viewBox: '0 0 640 474', width: '100%' });  // svg: the drawing surface for the module table and the zoomed-in entry
        const arrow = (x1, x2, y) => s('line', { x1, y1: y, x2, y2: y, class: 's-muted', 'stroke-width': 1.5, 'marker-end': 'url(#arr-muted)' });  // arrow(): a short grey horizontal arrow, used for the list's next pointers
        function draw() {  // draw(): redraws the whole picture from the current state
          const k = [], hl = new Set();  // k collects the shapes; hl names the list boxes to highlight
          if (st.sel === 'next' || st.sel === 'deps') hl.add('usbcore');  // selecting next or dependencies highlights usbcore in the list
          if (st.sel === 'refs') hl.add('uas');  // selecting used by highlights uas in the list
          /* top: the whole list, newest first */
          k.push(T(8, 41, 'module_list', { class: 's-sub', style: MONO }));  // the label "module_list" where the list starts
          const W = { uas: 70, usb_storage: 128, usbcore: 100 }, pos = {};  // W: the width of each module's box in the list; pos records where each box ends up
          let x = 96;  // x is where the next arrow starts
          [st.uas && 'uas', !st.gone && 'usb_storage', 'usbcore'].filter(Boolean).forEach((n) => {  // draws the modules still loaded, newest first: uas (if loaded), usb_storage (unless removed), then usbcore
            k.push(arrow(x, x + 18, 36)); x += 24; pos[n] = x;  // an arrow into this box, then the box's left edge is remembered
            const hot = hl.has(n);  // hot is true when this box should be highlighted
            k.push(s('rect', { x, y: 20, width: W[n], height: 32, rx: 8, class: n === 'usb_storage' ? 's-accent' : 's-os', 'stroke-width': hot ? 3.5 : 1.5, style: hot ? 'stroke:var(--chc)' : null }),  // the module's box: accent colour for usb_storage, purple for the others, outlined when highlighted
              T(x + W[n] / 2, 41, n, { 'text-anchor': 'middle', 'font-weight': 700, style: MONO }));  // the module's name in fixed-width text
            x += W[n] + 4;  // moves x past the box
          });  // ends the list boxes
          k.push(arrow(x, x + 18, 36), T(x + 24, 41, 'NULL', { class: 's-sub', style: MONO }));  // a final arrow to NULL, the end of the list
          if (!st.gone) k.push(...[[pos.usb_storage, 14], [pos.usb_storage + W.usb_storage, 404]].map(([a, b]) => s('line', { x1: a, y1: 52, x2: b, y2: 80, class: 's-muted', 'stroke-dasharray': '4 4' })));  // two dashed lines from usb_storage's box down to the big entry, like a magnifying glass zooming in
          /* the zoomed-in entry */
          const ent = s('g', {});  // ent: the group holding the zoomed-in entry
          if (st.gone) ent.append(s('rect', { x: 12, y: 80, width: 392, height: 384, rx: 12, class: 's-muted', 'stroke-dasharray': '6 5', style: 'fill:none' }),  // after removal: a dashed empty frame where the entry used to be
            T(208, 250, 'Entry unlinked from the list', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 18, style: 'fill:var(--intr)' }),  // its message: the entry was unlinked from the list
            T(208, 276, 'its 80 KB of kernel memory is free again', { 'text-anchor': 'middle', class: 's-sub', 'font-size': 14 }),  // second line: its 80 KB of kernel memory is free again
            T(208, 302, 'Press Reset to load it again.', { 'text-anchor': 'middle', class: 's-sub', 'font-size': 14 }));  // third line: press Reset to load it again
          else ent.append(s('rect', { x: 12, y: 80, width: 392, height: 384, rx: 12, class: 's-accent', 'stroke-width': 2 }),  // otherwise: the entry's frame in the accent colour
            T(24, 104, 'usb_storage\'s entry, zoomed in', { 'font-weight': 800 }));  // and its heading: usb_storage's entry, zoomed in
          if (!st.gone) F.forEach((f, i) => {  // draws one clickable row per field while the entry exists
            const y = RY(i), on = st.sel === f.k, bad = st.bad === f.k;  // y is the row's top; on means this field is selected; bad means an rmmod was just refused because of it
            const g = s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': 'Field: ' + f.l,  // the row's clickable group, labelled for screen readers
              onclick: () => pick(f.k), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(f.k); } } });  // a click, or Enter or Space, selects this field
            g.append(s('rect', { x: 22, y, width: 372, height: RH - 4, rx: 7, class: 'fr ' + (bad ? 's-intr' : 's-panel'), 'stroke-width': on ? 3.5 : 1.5, style: on ? 'stroke:var(--chc)' : null }));  // the row's frame: red when blamed for a refusal, outlined in the chapter colour when selected
            if (f.hint) g.append(T(34, y + 16, f.l, { 'font-weight': 700, 'font-size': 14 }), T(34, y + 31, f.hint, { class: 's-sub', style: MONO }));  // a field with a hint shows its label and, below it, the real field names in fixed-width grey text
            else g.append(T(34, y + 24, f.l, { 'font-weight': 700, 'font-size': 14 }));  // other fields show just their label
            const V = (t, o) => T(196, y + 24, t, o);  // V(): writes a value in the row's value column
            if (f.k === 'next') g.append(V('→ usbcore\'s entry', { style: MONO }));  // value for next: an arrow to usbcore's entry
            if (f.k === 'name') g.append(V('"usb_storage"', { style: MONO }));  // value for name: "usb_storage"
            if (f.k === 'size') g.append(V('80 KB'));  // value for size: 80 KB
            if (f.k === 'use') g.append(T(196, y + 26, String(st.use), { 'font-size': 20, 'font-weight': 800, style: 'fill:var(' + (st.use ? '--warn' : '--ok') + ')' }), T(222, y + 24, st.use ? 'operations using it now' : 'nothing is using it', { class: 's-sub' }));  // value for usecount: the big current count (amber above 0, green at 0) with a short note
            if (f.k === 'flags') g.append(s('rect', { x: 196, y: y + 9, width: 76, height: 20, rx: 10, class: st.flag === 'LIVE' ? 's-ok' : st.flag === 'LOADING' ? 's-warn' : 's-intr', 'stroke-width': 1.5 }), T(234, y + 24, st.flag, { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 13 }));  // value for flags: a pill showing LIVE, LOADING or GOING in green, amber or red
            if (f.k === 'syms') g.append(V('2 exported, listed at right →'));  // value for the symbol table: points to the list at the right
            if (f.k === 'deps') g.append(V('usbcore', { style: MONO }), T(262, y + 24, '(ndeps = 1)', { class: 's-sub' }));  // value for dependencies: usbcore, with ndeps = 1
            if (f.k === 'refs') g.append(V(st.uas ? 'uas' : '(empty)', { style: MONO + (st.uas ? '' : ';fill:var(--muted)') }));  // value for used by: uas, or a grey "(empty)" once uas is unloaded
            ent.append(g);  // adds the row to the entry
          });  // ends the field rows
          k.push(ent);  // adds the entry to the picture
          /* right: the flags states and the module's own symbol table */
          const side = s('g', { opacity: st.gone ? 0.3 : null });  // side: the right-hand panels, faded once the entry is gone
          side.append(s('rect', { x: 420, y: 80, width: 212, height: 142, rx: 10, class: 's-panel', 'stroke-width': st.sel === 'flags' ? 3.5 : 1.5, style: st.sel === 'flags' ? 'stroke:var(--chc)' : null }), T(432, 104, 'FLAGS: ITS STATE', LBL));  // the flags panel, outlined when the flags field is selected, with its heading
          [['LOADING', 'being set up', 's-warn'], ['LIVE', 'in normal use', 's-ok'], ['GOING', 'being removed', 's-intr']].forEach(([f, d, c], j) => {  // draws the three possible states: LOADING, LIVE and GOING
            const on = st.flag === f && !st.gone, y = 118 + j * 32;  // on is true for the current state; each state gets its own row
            side.append(s('rect', { x: 432, y, width: 80, height: 24, rx: 12, class: on ? c : 's-muted', 'stroke-width': on ? 2 : 1, style: on ? null : 'fill:none', 'stroke-dasharray': on ? null : '3 3' }),  // the state's pill: coloured when current, a dashed grey outline otherwise
              T(472, y + 17, f, { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 12.5, class: on ? null : 's-sub' }), T(522, y + 17, d, { class: on ? null : 's-sub', 'font-weight': on ? 700 : 400 }));  // the state's name inside the pill and its meaning beside it
          });  // ends the states
          const sy = RY(5) + (RH - 4) / 2;  // sy: the height of the symbol-table field's middle, where the connecting arrow is drawn
          side.append(s('rect', { x: 420, y: 250, width: 212, height: 136, rx: 10, class: 's-panel', 'stroke-width': st.sel === 'syms' ? 3.5 : 1.5, style: st.sel === 'syms' ? 'stroke:var(--chc)' : null }),  // the "ITS SYMBOL TABLE" panel, outlined when that field is selected
            T(432, 274, 'ITS SYMBOL TABLE', LBL),  // its heading
            ...[['usb_stor_probe1', '0xf8b10a60'], ['usb_stor_adjust_quirks', '0xf8b10c20']].map(([n, a], j) => [T(432, 302 + j * 42, n, { style: MONO, 'font-weight': 700 }), T(432, 319 + j * 42, 'at address ' + a, { class: 's-sub', style: MONO })]).flat(),  // its two exported names, each with its address underneath
            s('line', { x1: 396, y1: sy, x2: 416, y2: sy, class: 's-line', 'stroke-width': 1.5, 'marker-end': 'url(#arr)' }));  // an arrow from the symbol-table field to this panel
          k.push(side);  // adds the side panels
          if (!st.gone) k.push(T(420, 420, 'Click any field to see', { class: 's-sub' }), T(420, 437, 'what it is for.', { class: 's-sub' }));  // a small hint under the panels: click any field to see what it is for
          svg.replaceChildren(...k);  // replaces the drawing with the new shapes
        }  // ends draw()
        const infoH = h('h3', { class: 'm0' }), infoP = h('p', { class: 'p15 m0' }), infoE = h('div', { class: 'eg' });  // infoH, infoP, infoE: the heading, explanation and example of the info card
        function paintInfo() { const f = FK[st.sel]; infoH.textContent = f.title; infoP.innerHTML = f.x; infoE.innerHTML = '<b>In this entry:</b> ' + (typeof f.eg === 'function' ? f.eg() : f.eg); }  // paintInfo(): fills the info card for the selected field, calling the example function when the example is live
        function pick(key) { st.sel = key; draw(); paintInfo(); ctx.refit(); }  // pick(key): selects a field, redraws and refills the info card
        const useB = h('b', {}, '0'), flagChip = h('span', { class: 'chip' }), refChip = h('span', { class: 'chip' });  // useB: the big usecount number; flagChip and refChip: chips showing the flags and the used-by list
        const status = h('div', { class: 'callout m0 small' });  // status: the callout under the rule buttons that reports what each action did
        function say(cls, label, html) { status.className = 'callout m0 small ' + cls; status.setAttribute('data-label', label); status.innerHTML = html; }  // say(cls, label, html): restyles the status callout and changes its label and text
        function paint() {  // paint(): refreshes the counters and chips, then redraws the picture and the info card
          useB.textContent = st.use;  // shows the current usecount
          flagChip.className = 'chip ' + (st.gone ? '' : st.flag === 'LIVE' ? 'ok' : st.flag === 'LOADING' ? 'warn' : 'bad');  // colours the flags chip: grey when removed, green for LIVE, amber for LOADING, red for GOING
          flagChip.textContent = st.gone ? 'not loaded' : 'flags: ' + st.flag;  // writes the flags chip's text, or "not loaded" once the entry is gone
          refChip.className = 'chip ' + (st.uas ? 'warn' : 'ok'); refChip.textContent = 'used by: ' + (st.uas ? 'uas' : 'nobody');  // the used-by chip: amber "uas" while uas is loaded, green "nobody" after
          draw(); paintInfo(); ctx.refit();  // redraws the drawing and info card, then asks the guide to re-measure the screen
        }  // ends paint()
        const notLoaded = () => say('', 'Not loaded', 'usb_storage has been unloaded, so nothing can use it. Press <b>Reset</b> to load it again.');  // notLoaded(): the message shown when a button is pressed after usb_storage has been removed
        function start() {  // start(): the "+ A read starts" button
          if (st.gone) return notLoaded(), paint();  // if the module is gone, reports that and repaints (the comma runs both, then returns)
          if (st.flag !== 'LIVE') { say('warn', 'Not ready', 'The flags do not say LIVE, so the kernel will not start new work in this module.'); return paint(); }  // no new work may start unless the flags say LIVE
          st.use++; st.bad = null; st.sel = 'use';  // adds one to the usecount, clears any error mark and selects the usecount field
          say('tip', 'usecount +1', `A process started reading from the stick, which runs usb_storage's functions. usecount is now <b>${st.use}</b>.`); paint();  // reports the new usecount and repaints
        }  // ends start()
        function end() {  // end(): the "- A read ends" button
          if (st.gone) return notLoaded(), paint();  // if the module is gone, reports that and repaints
          st.sel = 'use'; st.bad = null;  // selects the usecount field and clears any error mark
          if (!st.use) say('', 'Nothing to end', 'No read is in progress, and a count can never drop below 0.');  // with no reads in progress there is nothing to end, since a count never goes below 0
          else { st.use--; say('tip', 'usecount −1', `A read finished. usecount is now <b>${st.use}</b>${st.use ? '.' : ': nothing is using the module.'}`); }  // otherwise subtracts one and reports the new count
          paint();  // repaints
        }  // ends end()
        function rmUas() {  // rmUas(): the "rmmod uas" button
          st.bad = null; st.sel = 'refs';  // clears any error mark and selects the used-by field
          if (!st.uas) say('', 'Already unloaded', 'uas is no longer in the module table.');  // if uas is already gone, just says so
          else { st.uas = false; say('tip', 'rmmod uas: done', 'Nothing depended on uas and nothing was using it, so it was unloaded. usb_storage\'s <b>used by</b> list is now empty.'); }  // otherwise unloads uas, which empties usb_storage's used-by list
          paint();  // repaints
        }  // ends rmUas()
        function rmSt() {  // rmSt(): the "rmmod usb_storage" button, which checks the kernel's two unload rules in order
          const my = ++run;  // takes a new ticket number so the delayed finish below can tell if it has been replaced
          if (st.gone) { say('', 'Already unloaded', 'usb_storage is no longer in the module table.'); return paint(); }  // if usb_storage is already gone, just says so
          if (st.uas) { st.bad = 'refs'; st.sel = 'refs'; say('bad', 'rmmod usb_storage: refused', '<code>Module usb_storage is in use by: uas</code><br>Its <b>used by</b> list is not empty: uas calls its functions. Unload uas first.'); return paint(); }  // rule 1: refused while uas is stacked on it; the used-by field turns red
          if (st.use) { st.bad = 'use'; st.sel = 'use'; say('bad', 'rmmod usb_storage: refused', `<code>Module usb_storage is in use</code><br>Its usecount is ${st.use}: ${st.use > 1 ? 'reads are' : 'a read is'} still running its code. End ${st.use > 1 ? 'them' : 'it'} first.`); return paint(); }  // rule 2: refused while its usecount is above 0; the usecount field turns red
          st.bad = null; st.flag = 'GOING'; st.sel = 'flags';  // both rules pass: the flags change to GOING and the flags field is selected
          say('tip', 'rmmod usb_storage: unloading…', 'usecount is 0 and nobody uses it. Its flags change to GOING so no new work can start, and its exit function runs.'); paint();  // reports that the exit function is running and repaints
          ctx.after(1300, () => { if (my !== run) return; st.gone = true; say('tip', 'rmmod usb_storage: done', 'Its exit function ran and its entry was unlinked: the pointer that led to it now leads straight to usbcore. Its symbols left the symbol table and its 80 KB were freed.'); paint(); });  // after 1.3 seconds (unless another action came first), the entry is unlinked and its memory freed
        }  // ends rmSt()
        function reset() {  // reset(): the Reset button, and also the setup when the step opens
          const my = ++run, wasGone = st && st.gone;  // takes a new ticket number and remembers whether the entry had been removed
          st = fresh();  // starts over from the fresh state
          if (wasGone) { st.flag = 'LOADING'; st.sel = 'flags'; say('', 'modprobe uas', 'modprobe loaded usb_storage again, then uas on top. While usb_storage\'s init function runs, its flags say LOADING and no work may start…'); ctx.after(1100, () => { if (my !== run) return; st.flag = 'LIVE'; say('tip', 'Ready again', 'init finished, so the flags now say LIVE. Start some reads, then try to unload usb_storage.'); paint(); }); }  // if it had been removed, shows it reloading: flags LOADING, then LIVE after 1.1 seconds
          else say('', 'Try the rules', 'Start and end some reads, then try to unload usb_storage. What must happen before the kernel agrees?');  // otherwise shows the starting challenge
          paint();  // repaints
        }  // ends reset()
        const B = (label, fn, cls = 'btn sm') => h('button', { class: cls, type: 'button', onclick: fn }, label);  // B(): makes a small button with a label and a click handler
        el.append(h('div', { class: 'split r fill' },  // puts the screen together: drawing on the left (larger), cards on the right
          h('div', { class: 'card white stack', style: { gap: '4px' } },  // the drawing card
            h('span', { class: 'lbl', html: 'Kernel memory: the <span class="t">module table</span>, and one entry up close' }), svg),  // its label, then the drawing of the module table and the zoomed-in entry
          h('div', { class: 'stack', style: { gap: '10px' } },  // the right column
            h('div', { class: 'card white stack', style: { gap: '8px' } }, infoH, infoP, infoE),  // the info card for the selected field
            h('div', { class: 'card stack', style: { gap: '8px' } },  // the rules card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Try the rules on this entry'), B('↺ Reset', reset, 'btn ghost sm')),  // its header: "Try the rules on this entry" and the Reset button
              h('div', { class: 'row', style: { gap: '10px' } }, h('div', { class: 'score' }, useB, h('span', { html: '<span class="t">usecount</span>' })), flagChip, refChip),  // a row with the big usecount display and the two chips
              h('div', { class: 'grid-2', style: { gap: '6px' } }, B('+ A read starts', start), B('− A read ends', end),  // a grid of four buttons: a read starts, a read ends
                h('button', { class: 'btn sm danger mono', type: 'button', onclick: rmUas }, 'rmmod uas'), h('button', { class: 'btn sm danger mono', type: 'button', onclick: rmSt }, 'rmmod usb_storage')),  // and the two red rmmod buttons, for uas and usb_storage
              status))));  // the status callout at the bottom of the rules card
        reset();  // sets the starting state and draws everything when the step opens
      },  // ends render() for step 6
    },  // ends step 6
    /* ---------------- 7. Lab: the module table, insmod / modprobe / rmmod ---------------- */
    {  // step 7 begins: a hands-on lab with insmod, modprobe, rmmod, mount and umount
      title: 'Lab: load and unload modules yourself',  // step 7's title, shown as the screen heading
      kind: 'lab',  // kind "lab" labels this screen as a Hands-on Lab step
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the lab when the step opens
        const { h } = ctx;  // takes h, the helper that builds page elements, from ctx
        if (ctx.narrow) el.classList.add('nrw');  // on a phone-width screen, adds the nrw class so the table and log use the phone layout
        const M = {  // M: the six module files on disk; each has a size in KB, a description, its dependencies, one call into each, and its exports
          /* deps: the modules it needs; calls: one symbol it uses from each of them (all real exports) */
          usbcore: { sz: 332, d: 'shared USB core code', deps: [], calls: {}, ex: ['usb_register_driver', 'usb_add_hcd'] },  // module usbcore: 332 KB, needs nothing, exports two USB functions
          xhci_hcd: { sz: 340, d: 'USB controller (ports)', deps: ['usbcore'], calls: { usbcore: 'usb_add_hcd' }, ex: ['xhci_init_driver'] },  // module xhci_hcd: the USB port controller driver, needs usbcore
          usb_storage: { sz: 80, d: 'USB flash drives, disks', deps: ['usbcore'], calls: { usbcore: 'usb_register_driver' }, ex: ['usb_stor_probe1', 'usb_stor_adjust_quirks'] },  // module usb_storage: the flash drive driver, needs usbcore, exports two functions
          uas: { sz: 32, d: 'faster USB disk protocol', deps: ['usb_storage', 'usbcore'], calls: { usb_storage: 'usb_stor_adjust_quirks', usbcore: 'usb_register_driver' }, ex: [] },  // module uas: the faster USB disk protocol, needs usb_storage and usbcore
          fat: { sz: 88, d: 'shared FAT code', deps: [], calls: {}, ex: ['fat_fill_super'] },  // module fat: shared FAT code, needs nothing
          vfat: { sz: 24, d: 'usual USB stick format', deps: ['fat'], calls: { fat: 'fat_fill_super' }, ex: [] },  // module vfat: the usual stick format, needs fat
        };  // ends the module list
        const NAMES = Object.keys(M);  // NAMES: the module names in the order they are listed on screen
        const STICK = ['xhci_hcd', 'usb_storage', 'vfat']; // what a mounted stick keeps busy
        const MIS = ['Make insmod fail: a prerequisite is missing', 'Mount the USB stick', 'Try rmmod on a module that another one needs', 'Try rmmod on a module the mounted stick uses', 'Unmount, then unload every module'];  // MIS: the five missions the student works through; each is ticked off as it happens
        let st;  // st: the lab's state, set up by fresh()
        const isIn = (n) => st.list.includes(n);  // isIn(n): true when module n is in the module table
        const usersOf = (n) => st.list.filter((x) => M[x].deps.includes(n));  // usersOf(n): the loaded modules that depend on module n
        const logEl = h('div', { class: 'log' });  // logEl: the terminal-style log of commands and their output
        const why = h('div', { class: 'callout m0 small' });  // why: the callout that explains the result of each command
        const diskEl = h('div', { class: 'stack', style: { gap: '3px' } });  // diskEl: the list of module files on disk with their buttons
        const tableEl = h('div', { class: 'mt' });  // tableEl: the module table display
        const misEl = h('div', { class: 'mis' });  // misEl: the missions checklist
        const stickChip = h('span', { class: 'chip' });  // stickChip: the chip saying whether the USB stick is mounted
        const code = (x) => '<code>' + x + '</code>';  // code(): wraps a name in code tags so it shows in the fixed-width font
        function log(cmd, lines) {  // log(cmd, lines): adds a command and its output lines to the log
          logEl.append(h('div', {}, h('div', { class: 'c' }, '$ ' + cmd), ...lines.map(([cls, t]) => h('div', { class: cls }, t))));  // the command line starts with "$ " like a terminal prompt; each output line gets its own style
          logEl.scrollTop = logEl.scrollHeight;  // scrolls the log to the bottom so the newest lines are visible
        }  // ends log()
        function explain(cls, label, html) { why.className = 'callout m0 small ' + cls; why.setAttribute('data-label', label); why.innerHTML = html; }  // explain(cls, label, html): restyles the explanation callout and changes its label and text
        function fresh() {  // fresh(): starts the lab over as if the kernel had just booted
          st = { list: [], use: {}, loading: {}, mounted: false, fresh: null, done: MIS.map(() => false), cheered: false };  // st: no modules loaded, usecounts, modules still loading, stick unmounted, missions not done, no celebration yet
          logEl.replaceChildren(h('div', { class: 'mu' }, '# the kernel has just booted with no modules loaded'));  // clears the log, leaving one comment line about the fresh boot
          explain('', 'Your goal', 'Get the USB stick mounted, then clean up, while you watch the <span class="t">module table</span> (the kernel\'s list of loaded modules) and each <span class="t">usecount</span> (how many current users a module has). Your three commands:<br>• <b>insmod</b> loads exactly the one module you name.<br>• <b>modprobe</b> also loads whatever that module needs, first.<br>• <b>rmmod</b> unloads one module, if the kernel agrees.<br>(On a real system, plugging in the stick makes the kernel run modprobe for you.) Start the way many people do: press <b>insmod</b> on <b>usb_storage</b>.');  // the goal: mount the stick, then clean up; explains the three commands and suggests a first move
        }  // ends fresh()
        function load(n) {  // load(n): puts module n into the module table; used by both insmod and modprobe
          st.list.unshift(n); st.use[n] = 0; st.loading[n] = true; st.fresh = n;  // adds it at the front of the list with usecount 0, marks it as still loading, and remembers it as the newest
          ctx.after(900, () => { if (st.loading[n]) { delete st.loading[n]; paint(); } });  // after 0.9 seconds its init is treated as finished: the loading mark is cleared and the table repainted
        }  // ends load()
        function insmod(n) {  // insmod(n): the insmod button, which loads exactly one module and nothing else
          const miss = M[n].deps.filter((d) => !isIn(d));  // miss: the modules that n depends on but that are not loaded
          if (miss.length) {  // a missing prerequisite makes linking fail
            log(`insmod ${n}.ko`, [['bad', `insmod: ERROR: could not insert module ${n}.ko: Unknown symbol in module`]]);  // log: the real-looking "Unknown symbol in module" error
            explain('bad', 'Refused: dynamic linking failed', `<b>${n}</b> calls ${code(M[n].calls[miss[0]] + '()')}, which lives in <b>${miss[0]}</b>. Because ${miss.join(' and ')} ${miss.length > 1 ? 'are' : 'is'} not loaded, that name is not in the kernel symbol table, so the loader has no address to fill in. Load ${miss.join(' and ')} first, or use ${code('modprobe')}.`);  // explanation: names the function n calls, the module that holds it, and what to load first
            st.done[0] = true;  // ticks off mission 1 (make insmod fail)
          } else {  // all prerequisites are present
            load(n);  // loads the module
            log(`insmod ${n}.ko`, [['ok', 'ok: linked and added at the front of the module table']]);  // log: linked and added at the front of the table
            explain('tip', 'Loaded', `<b>${n}</b> was copied into kernel memory and linked against ${M[n].deps.length ? 'the symbols it needs from ' + M[n].deps.join(' and ') : 'the core kernel'}. Its entry went to the <b>front</b> of the module table with usecount 0${M[n].ex.length ? ', and it now exports ' + M[n].ex.map(code).join(', ') : ''}.`);  // explanation: what it was linked against and which names it now exports
          }  // ends the success branch
          after();  // updates missions and repaints
        }  // ends insmod()
        function order(n, out = []) { M[n].deps.slice().reverse().forEach((d) => order(d, out)); if (!out.includes(n)) out.push(n); return out; }  // order(n): lists n's prerequisites before n itself, deepest first, with no repeats: the bottom-up load order
        function modprobe(n) {  // modprobe(n): the modprobe button, which loads n and whatever it needs, prerequisites first
          const todo = order(n).filter((x) => !isIn(x));  // todo: the modules in load order that are not loaded yet
          if (!todo.length) { log(`modprobe ${n}`, [['mu', '(already loaded: nothing to do)']]); explain('', 'Nothing to do', `<b>${n}</b> is already in the module table.`); return after(); }  // if everything is already loaded, logs and explains that there is nothing to do
          todo.forEach(load);  // loads each module in order
          log(`modprobe ${n}`, todo.map((x) => ['ok', `insmod ${x}.ko ... ok`]));  // log: one insmod line per module loaded
          explain('tip', todo.length > 1 ? 'Loaded, prerequisites first' : 'Loaded', todo.length > 1  // explanation: chooses a title depending on whether prerequisites had to be loaded too
            ? `${code('modprobe')} looked <b>${n}</b> up in the dependency list (a file called modules.dep) and loaded the stack from the bottom up: ${todo.map((x) => '<b>' + x + '</b>').join(' → ')}. Each could then be linked against the ones below it.`  // with prerequisites: modprobe read the dependency list and loaded the stack from the bottom up
            : `<b>${n}</b> needs nothing that is not already loaded, so ${code('modprobe')} simply inserted it, exactly like ${code('insmod')}.`);  // without: modprobe did exactly what insmod would have done
          after();  // updates missions and repaints
        }  // ends modprobe()
        function rmmod(n) {  // rmmod(n): the rmmod button, which checks the two unload rules in order
          const users = usersOf(n);  // users: the loaded modules stacked on n
          if (users.length) {  // rule 1: another module depends on n
            log(`rmmod ${n}`, [['bad', `rmmod: ERROR: Module ${n} is in use by: ${users.join(' ')}`]]);  // log: the "in use by" error naming those modules
            explain('bad', 'Refused: stackable modules', `<b>${users.join(' and ')}</b> ${users.length > 1 ? 'call' : 'calls'} functions inside <b>${n}</b>. Removing it would leave those calls pointing at freed memory, so the kernel refuses. Remove ${users.join(' and ')} first.`);  // explanation: removing n would leave their calls pointing at freed memory
            st.done[2] = true;  // ticks off mission 3 (rmmod on a module another one needs)
          } else if (st.use[n] > 0) {  // rule 2: n's usecount is above 0
            log(`rmmod ${n}`, [['bad', `rmmod: ERROR: Module ${n} is in use`]]);  // log: the plain "in use" error
            explain('bad', 'Refused: usecount is not zero', `<b>${n}</b> has usecount ${st.use[n]}: the mounted USB stick is still using its code. Unmount the stick first, and the count drops back to 0.`);  // explanation: the mounted stick is still using n
            st.done[3] = true;  // ticks off mission 4 (rmmod on a module the stick uses)
          } else {  // both rules pass
            st.list = st.list.filter((x) => x !== n); delete st.use[n]; delete st.loading[n];  // removes n from the table and forgets its usecount and loading mark
            log(`rmmod ${n}`, [['ok', 'ok: exit ran, unlinked, memory freed']]);  // log: exit ran, unlinked, memory freed
            explain('tip', 'Unloaded', `No loaded module depended on <b>${n}</b> and its usecount was 0, so its entry was unlinked from the module table and its memory freed. The file is still on disk for next time.`);  // explanation: the entry is gone but the file stays on disk
          }  // ends the rules
          after();  // updates missions and repaints
        }  // ends rmmod()
        function mount() {  // mount(): the mount button, which needs a driver for the port, one for the stick, and its file system
          const cmd = 'mount /dev/sdb1 /media/usb', dev = 'mount: /media/usb: special device /dev/sdb1 does not exist';  // the command shown in the log, and the error printed when the stick's device does not exist yet
          if (st.mounted) { log(cmd, [['mu', 'mount: /media/usb: already mounted']]); explain('', 'Already mounted', 'The stick is already mounted.'); }  // already mounted: says so
          else if (!isIn('xhci_hcd')) { log(cmd, [['bad', dev]]); explain('bad', 'No USB port', 'The USB controller driver, <b>xhci_hcd</b>, is not loaded, so the kernel cannot even see the USB port, let alone the stick.'); }  // no xhci_hcd: the kernel cannot see the USB port, so the device does not exist
          else if (!isIn('usb_storage')) { log(cmd, [['bad', dev]]); explain('bad', 'No driver for the stick', 'The controller sees a new USB device, but no driver has claimed it. Load <b>usb_storage</b> so that the stick shows up as a disk.'); }  // no usb_storage: the port sees something, but no driver turns it into a disk
          else if (!isIn('vfat')) { log(cmd, [['bad', 'mount: /media/usb: unknown filesystem type \'vfat\'']]); explain('bad', 'No file system', 'The stick is formatted as VFAT, and the <b>vfat</b> file-system module is not loaded.'); }  // no vfat: the disk exists but its file-system type is unknown
          else {  // everything is loaded
            st.mounted = true; STICK.forEach((x) => st.use[x]++); st.done[1] = true;  // mounts the stick, adds one to the usecount of each module it keeps busy, and ticks off mission 2
            log(cmd, [['ok', 'ok: files now under /media/usb']]);  // log: success
            explain('tip', 'Mounted', 'The mounted stick is an ongoing user of <b>xhci_hcd</b> (the port), <b>usb_storage</b> (the device) and <b>vfat</b> (its file system), so each of their usecounts went from 0 to 1.');  // explanation: the stick is an ongoing user of the port driver, the disk driver and the file system
          }  // ends the mount checks
          after();  // updates missions and repaints
        }  // ends mount()
        function umount() {  // umount(): the umount button
          if (!st.mounted) { log('umount /media/usb', [['mu', 'umount: /media/usb: not mounted']]); explain('', 'Not mounted', 'The stick is not mounted.'); }  // if the stick is not mounted, says so
          else { st.mounted = false; STICK.forEach((x) => st.use[x]--); log('umount /media/usb', [['ok', 'ok']]); explain('tip', 'Unmounted', 'The stick no longer uses <b>xhci_hcd</b>, <b>usb_storage</b> or <b>vfat</b>, so all three usecounts are back to 0.'); }  // otherwise unmounts it and takes one off each busy module's usecount, back to 0
          after();  // updates missions and repaints
        }  // ends umount()
        function after() {  // after(): runs after every command to check the missions, then repaints
          if (st.done[1] && !st.list.length && !st.mounted) st.done[4] = true;  // mission 5 is done once the stick has been mounted at some point and now nothing is loaded or mounted
          if (st.done.every(Boolean) && !st.cheered) { st.cheered = true; explain('tip', 'Lab complete', 'You saw every rule in action: <b>dynamic linking</b> fails when a needed symbol is missing, <b>stacking</b> blocks removing a module that others call into, a nonzero <b>usecount</b> blocks removal while the module is busy, and everything loads and unloads while the kernel keeps running.'); }  // when every mission is done, shows a one-time "Lab complete" summary of the rules the student saw
          paint();  // repaints the lab
        }  // ends after()
        function paint() {  // paint(): redraws the file list, the stick chip, the module table and the missions
          diskEl.replaceChildren(...NAMES.map((n) => h('div', { class: 'drow' + (isIn(n) ? ' in' : '') },  // one row per module file: tinted when loaded
            h('div', { class: 'nm' }, h('b', {}, n + '.ko'), h('span', {}, M[n].d)),  // the file name with ".ko" and its description
            ...(isIn(n) ? [h('span', { class: 'chip os' }, 'loaded'), h('button', { class: 'btn sm danger', type: 'button', onclick: () => rmmod(n) }, 'rmmod')]  // a loaded module shows a "loaded" chip and a red rmmod button
              : [h('button', { class: 'btn sm', type: 'button', onclick: () => insmod(n) }, 'insmod'), h('button', { class: 'btn sm', type: 'button', onclick: () => modprobe(n) }, 'modprobe')]))));  // a module on disk only shows insmod and modprobe buttons
          stickChip.className = 'chip ' + (st.mounted ? 'ok' : 'warn');  // the stick chip turns green when mounted, amber when not
          stickChip.textContent = st.mounted ? 'mounted' : 'not mounted';  // and says "mounted" or "not mounted"
          const none = () => h('span', { class: 'muted' }, '(none)');  // none(): a grey "(none)" placeholder for empty cells
          const rows = st.list.map((n) => {  // builds one table row per loaded module, newest first
            const users = usersOf(n), u = st.use[n] || 0;  // users are the modules stacked on it; u is its usecount
            return h('div', { class: 'mrow' }, h('div', { class: 'mrail' }, h('b', {}, '▼'), h('i')),  // the row: a rail cell with the down arrow and the chain dot
              h('div', { class: 'mbox' + (st.loading[n] ? ' new' : '') },  // then the entry box, glowing while the module is still loading
                h('div', { class: 'nmc', 'data-l': 'name · size' }, h('b', {}, n), h('span', { class: 'xs muted' }, M[n].sz + ' KB')),  // cell: the module's name and its size; data-l holds the label shown on phone-width screens
                h('div', { class: 'uc' + (u ? ' hot' : ''), 'data-l': 'usecount' }, String(u)),  // cell: the usecount, amber when above 0
                h('div', { 'data-l': 'flags' }, h('span', { class: 'chip ' + (st.loading[n] ? 'warn' : 'ok') }, st.loading[n] ? 'loading' : 'live')),  // cell: the flags, "loading" in amber or "live" in green
                h('div', { class: 'mono', 'data-l': 'exports' }, M[n].ex.length ? M[n].ex.map((x) => h('div', {}, x)) : none()),  // cell: the names it exports, one per line, or "(none)"
                h('div', { class: 'mono', 'data-l': 'depends on' }, M[n].deps.length ? M[n].deps.map((x) => h('div', {}, x)) : none()),  // cell: the modules it depends on, one per line, or "(none)"
                h('div', { 'data-l': 'used by' }, users.length ? [h('b', {}, users.length + ' · '), users.join(', ')] : none())));  // cell: how many modules use it and their names, or "(none)"
          });  // ends the row builder
          tableEl.replaceChildren(  // refills the module table
            h('div', { class: 'mrow' }, h('span'), h('div', { class: 'mcols' }, ...['NAME · SIZE', 'USECOUNT', 'FLAGS', 'EXPORTED SYMBOLS', 'DEPENDS ON', 'USED BY'].map((t) => h('span', {}, t)))),  // the header row of column titles, with an empty cell over the rail
            h('div', { class: 'mhead' }, 'module_list (head of the list)'),  // the head line: module_list, where the list starts
            ...(rows.length ? rows : [h('div', { class: 'mempty' }, 'Empty: no modules are loaded yet.')]),  // the entries, or a message when the table is empty
            h('div', { class: 'mnull' }, 'NULL (end of the list)'));  // the end line: NULL
          misEl.replaceChildren(...MIS.map((m, i) => h('div', { class: st.done[i] ? 'done' : '' }, h('span', {}, st.done[i] ? '✓' : '☐'), h('span', {}, m))));  // refills the missions checklist with a tick or an empty box for each
          ctx.refit();  // asks the guide to re-measure the screen, since the table's height changed
          logEl.scrollTop = logEl.scrollHeight;  // keeps the log scrolled to its newest line
        }  // ends paint()
        fresh();  // sets up the starting state before the layout is built
        el.append(h('div', { class: 'split lab fill' },  // puts the lab together: controls on the left (about one third), the table and log on the right
          h('div', { class: 'stack', style: { gap: '10px' } },  // the left column
            h('div', { class: 'card tight stack', style: { gap: '4px' } }, h('span', { class: 'lbl' }, 'Module files on disk (/lib/modules)'), diskEl),  // the card listing the module files on disk
            h('div', { class: 'card tight row nw', style: { gap: '7px' } }, h('b', { class: 'small' }, 'USB stick'), stickChip, h('span', { class: 'grow' }),  // the USB stick card: its label, the mounted chip and a spacer that pushes the buttons to the right
              h('button', { class: 'btn sm primary', type: 'button', onclick: mount }, 'mount'), h('button', { class: 'btn sm', type: 'button', onclick: umount }, 'umount')),  // the mount and umount buttons
            h('div', { class: 'card tight stack', style: { gap: '4px' } },  // the missions card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Missions'), h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { fresh(); paint(); } }, '↺ Reset lab')), misEl)),  // its header: "Missions" and a Reset lab button that starts everything over, then the checklist
          h('div', { class: 'stack', style: { gap: '10px' } },  // the right column
            h('div', { class: 'card white tight stack', style: { gap: '6px' } }, h('span', { class: 'lbl' }, 'Kernel memory: the module table, a linked list with the newest module first'), tableEl),  // the module table card, labelled as a linked list with the newest module first
            h('div', { class: 'labout grow' }, logEl, why))));  // under it, the log and the explanation, growing to fill the free height
        paint();  // draws the lab's starting state
      },  // ends render() for step 7
    },  // ends step 7
    /* ---------------- 7. The kernel components map + traces ---------------- */
    {  // step 8 begins: a clickable map of the Linux kernel's components, with animated traces of three events
      title: 'Inside the Linux kernel: a map of its components',  // step 8's title, shown as the screen heading
      kind: 'explore',  // kind "explore" labels this screen as an Explore step
      render(el, ctx) {  // render(el, ctx): builds the map and its two tabs when the step opens
        const { h, s } = ctx;  // takes h (builds page elements) and s (builds SVG shapes) from ctx
        const B = {  // B: every box on the map; r is its [x, y, width, height], c its colour, t its label lines, plus a name, explanation and example
          user: { r: [4, 4, 682, 76], c: 's-panel', name: 'User level: processes and threads',  // box: the user level across the top, where programs run
            x: 'Ordinary programs (a shell, a browser, an editor) run up here in user mode, each as one or more processes and threads. They cannot touch the hardware or the kernel\'s memory directly. To get anything done, they ask the kernel through system calls.',  // explanation for the user level: programs run in user mode and must ask the kernel for everything
            eg: 'Saving a file in your editor is a user-level process asking the kernel for help.' },  // example: saving a file is a process asking the kernel for help
          sys: { r: [4, 92, 682, 40], c: 's-os', t: ['System calls: the doorway from user level into the kernel'], name: 'System calls',  // box: the system call layer, the doorway into the kernel
            x: 'The fixed set of entry points, or <span class="t">system calls</span> (a few hundred in Linux), through which a program asks for a service: open, read, write, fork, kill and so on. A special instruction switches the processor into kernel mode and jumps to the matching handler.',  // explanation for system calls: a few hundred fixed entry points reached by a special instruction
            eg: '<code>read(fd, buf, n)</code> asks for n bytes from a file the program has open.' },  // example: what a read() call asks for
          sig: { r: [12, 178, 104, 86], c: 's-intr', t: ['Signals'], name: 'Signals',  // box: signals, in the interrupt colour
            x: 'A <span class="t">signal</span> is the kernel\'s short notice to a process that something happened: a key combination, a timer running out, a child ending, a bad memory access. The process can catch it with its own handler, ignore it, or accept the default action (often: being ended).',  // explanation for signals: short notices to processes, which can catch, ignore or accept them
            eg: 'Pressing <b>Ctrl+C</b> sends the SIGINT signal to the program in the foreground.' },  // example: Ctrl+C sends SIGINT
          sched: { r: [124, 178, 104, 86], c: 's-proc', t: ['Processes', 'and scheduler'], name: 'Processes and scheduler',  // box: processes and scheduler
            x: 'Creates and ends processes and threads, and decides many times per second which ready one runs next on each processor. It puts processes to sleep while they wait and wakes them when the wait is over. (Linux processes and threads: section 4.6.)',  // explanation for the scheduler: creates processes and picks which ready one runs next
            eg: 'A process waiting for the disk is put to sleep, and another one gets the processor.' },  // example: a process waiting for the disk sleeps while another runs
          vm: { r: [236, 178, 104, 86], c: 's-mem', t: ['Virtual', 'memory'], name: 'Virtual memory',  // box: virtual memory
            x: 'Gives every process its own private address space, split into pages, and maps each page onto a <b>page frame</b>: a same-sized slot of real memory (typically 4 KB). Pages come in from disk on demand; rarely used ones go out.',  // explanation for virtual memory: private address spaces mapped onto page frames
            eg: 'Two programs can both use address 0x400000 without clashing: each maps it to different physical memory.' },  // example: two programs can use the same address without clashing
          fs: { r: [460, 178, 104, 86], c: 's-os', t: ['File', 'systems'], name: 'File systems',  // box: file systems
            x: 'Turn raw disk blocks into named files and folders and check who may use them. Linux supports many formats (ext4, btrfs, vfat, network file systems) behind one common interface, and keeps recently used file data in memory.',  // explanation for file systems: disk blocks become named files, behind one common interface
            eg: 'Opening <code>notes.txt</code>: the file system finds which disk blocks hold it.' },  // example: finding which blocks hold a file
          net: { r: [572, 178, 104, 86], c: 's-os', t: ['Network', 'protocols'], name: 'Network protocols',  // box: network protocols
            x: 'Carry out the rules of network communication, such as IP (addresses and routing) and TCP (reliable, in-order streams). Programs use them through sockets.',  // explanation for network protocols: IP and TCP, used through sockets
            eg: 'TCP puts arriving packets back in order and asks again for any that went missing.' },  // example: TCP reorders packets and asks again for lost ones
          trap: { r: [12, 282, 104, 86], c: 's-intr', t: ['Traps and', 'faults'], name: 'Traps and faults',  // box: traps and faults
            x: 'Handles <span class="t">traps and faults</span>: exceptions the processor raises by itself while running an instruction: a page fault, a divide by zero, an illegal instruction. The fix may be invisible (bring in the missing page) or fatal for the process (send it a signal).',  // explanation for traps and faults: exceptions the processor raises while running an instruction
            eg: 'Touching a page that is still on disk causes a page fault, and virtual memory brings the page in.' },  // example: a page fault brings a missing page in
          intr: { r: [124, 282, 104, 86], c: 's-intr', t: ['Interrupts'], name: 'Interrupts',  // box: interrupts
            x: 'Handles interrupt requests from devices: the kernel stops what the processor was doing, runs that device\'s interrupt handler, then carries on. Urgent work happens at once; longer work is put off until a little later.',  // explanation for interrupts: the device's handler runs, then the processor carries on
            eg: 'The network card signals "a packet arrived", and its handler runs within microseconds.' },  // example: the network card's handler runs within microseconds
          phys: { r: [236, 282, 104, 86], c: 's-mem', t: ['Physical', 'memory'], name: 'Physical memory',  // box: physical memory
            x: 'Manages the real RAM, which is divided into page frames: fixed-size slots (typically 4 KB) that each hold one page. It keeps track of which frames are free, hands them out to processes, to the kernel itself and to caches, and takes them back.',  // explanation for physical memory: tracking and handing out the RAM's page frames
            eg: 'When a process needs a new page, a free page frame is taken from here.' },  // example: a new page takes a free frame from here
          chr: { r: [348, 282, 104, 86], c: 's-io', t: ['Character', 'device drivers'], name: 'Character device drivers',  // box: character device drivers
            x: 'Operate <span class="t">character devices</span>, which deliver data as a stream of bytes: keyboards, terminals, mice, serial ports. Programs reach them almost directly (the dashed arrow): a read() on a terminal goes from the system call to the driver, with no file system finding disk blocks in between.',  // explanation for character drivers: byte-stream devices, reached almost directly from system calls
            eg: 'The terminal driver collects your keystrokes into a line of input.' },  // example: the terminal driver collects keystrokes into a line
          blk: { r: [460, 282, 104, 86], c: 's-io', t: ['Block', 'device drivers'], name: 'Block device drivers',  // box: block device drivers
            x: 'Operate <span class="t">block devices</span>, which store data in fixed-size blocks that can be read in any order: hard disks, SSDs, USB sticks. Requests wait in a queue and may be reordered for speed.',  // explanation for block drivers: fixed-size blocks, with requests queued and reordered
            eg: 'The SSD driver fetches the blocks the file system asked for.' },  // example: the SSD driver fetches the blocks the file system asked for
          netdrv: { r: [572, 282, 104, 86], c: 's-io', t: ['Network', 'device drivers'], name: 'Network device drivers',  // box: network device drivers
            x: 'Operate network interface controllers: hand outgoing packets to the card and collect incoming ones from it.',  // explanation for network drivers: move packets to and from the network card
            eg: 'The Wi-Fi driver passes each packet it receives up to the network protocols.' },  // example: the Wi-Fi driver passes packets up to the protocols
          cpu: { r: [12, 426, 216, 50], c: 's-cpu', t: ['CPU (processor)'], name: 'CPU (hardware)',  // hardware box: the CPU, with its explanation
            x: 'Runs both user code and kernel code. The kernel gets control of it through system calls, traps and interrupts, and shares it out through the scheduler.', eg: 'A four-core laptop can run four threads at literally the same moment.' },  // explanation and example for the CPU: the kernel gets control through system calls, traps and interrupts
          mem: { r: [236, 426, 104, 50], c: 's-mem', t: ['System', 'memory'], name: 'System memory (hardware)',  // hardware box: system memory (the RAM chips)
            x: 'The RAM chips that hold the kernel, its caches and every process\'s pages.', eg: 'Managed by the physical memory component just above it.' },  // explanation and example for system memory
          term: { r: [348, 426, 104, 50], c: 's-io', t: ['Terminal'], name: 'Terminal (hardware)',  // hardware box: the terminal (keyboard and screen)
            x: 'A keyboard and screen, or a terminal window: a classic character device.', eg: 'Driven by the character device drivers just above it.' },  // explanation and example for the terminal
          disk: { r: [460, 426, 104, 50], c: 's-io', t: ['Disk'], name: 'Disk (hardware)',  // hardware box: the disk
            x: 'A hard disk, SSD or USB stick: a block device that keeps data when the power is off.', eg: 'Driven by the block device drivers just above it.' },  // explanation and example for the disk
          nic: { r: [572, 426, 104, 50], c: 's-io', t: ['NIC'], name: 'Network interface controller (hardware)',  // hardware box: the network interface controller (NIC)
            x: 'The <span class="t">network interface controller (NIC)</span>: the Ethernet or Wi-Fi hardware that sends and receives packets.', eg: 'Driven by the network device drivers just above it.' },  // explanation and example for the NIC
        };  // ends the box table
        let mode = 'explore', sel = 'sys', trace = null, tabsEl = null;  // mode: "explore" or "trace"; sel: the selected box; trace: the running trace and frame; tabsEl: the tab strip
        const svg = s('svg', { viewBox: '0 0 690 490', width: '100%', class: 'kmap' });  // svg: the drawing surface for the kernel map, with the class its step 8 styles target
        const T = (x, y, t, o) => s('text', Object.assign({ x, y, 'font-size': 13 }, o || {}), t);  // T(): draws text at a point, 13 units tall by default, with any extra settings merged in
        function pick(k) { if (mode !== 'explore' && tabsEl) tabsEl.show(0); sel = k; draw(); paintInfo(); }  // pick(k): selects box k; a click during a trace switches back to the Explore tab first
        function draw() {  // draw(): redraws the whole map for the selected box or the trace so far
          const seen = {}, now = new Set();  // seen: for each box, the step number where it was last involved; now: the boxes in the current step
          if (trace) { trace.f.slice(0, trace.i + 1).forEach((fr, j) => fr.k.forEach((k) => { seen[k] = j + 1; })); trace.f[trace.i].k.forEach((k) => now.add(k)); }  // during a trace, fills seen from every step up to the current one and now from the current step
          const k = [  // k collects the fixed parts of the map
            s('rect', { x: 4, y: 144, width: 682, height: 240, rx: 12, 'stroke-width': 2, style: 'fill:none;stroke:var(--os)' }),  // the purple outline around everything that runs in kernel mode
            T(16, 166, 'KERNEL (everything in this box runs in kernel mode)', { 'font-weight': 800, 'letter-spacing': '1', style: 'fill:var(--os)' }),  // its label: KERNEL (everything in this box runs in kernel mode)
            s('rect', { x: 4, y: 396, width: 682, height: 90, rx: 12, class: 's-panel', 'stroke-width': 1 }),  // the grey hardware area at the bottom
            T(16, 416, 'HARDWARE', { 'font-weight': 800, 'letter-spacing': '1', class: 's-sub' }),  // its label: HARDWARE
            ...[[288, 264, 282], [512, 264, 282], [624, 264, 282], [64, 368, 426], [176, 368, 426], [288, 368, 426], [400, 368, 426], [512, 368, 426], [624, 368, 426]].map(([x, y1, y2]) => s('line', { x1: x, y1, x2: x, y2, class: 's-muted' })),  // short grey connector lines from each component to the driver or hardware box below it
            s('line', { x1: 400, y1: 132, x2: 400, y2: 276, class: 's-muted', 'stroke-dasharray': '5 4', 'marker-end': 'url(#arr-muted)' }),  // a dashed arrow straight from the system call layer down to the character drivers
            T(392, 222, 'direct', { class: 's-sub', 'text-anchor': 'middle', transform: 'rotate(-90 392 222)' }),  // the word "direct" beside that arrow, turned on its side
          ];  // ends the fixed parts
          Object.entries(B).forEach(([key, b]) => {  // draws every box in the table
            const [x, y, w, hh] = b.r;  // unpacks the box's position and size
            const on = mode === 'explore' ? key === sel : now.has(key);  // on: in explore mode the selected box; in trace mode every box in the current step
            const dim = trace && !seen[key];  // dim: during a trace, boxes not reached yet fade back
            const g = s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': b.name, opacity: dim ? 0.38 : null,  // the box's clickable group, faded when dim, labelled for screen readers
              onclick: () => pick(key), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(key); } } });  // a click, or Enter or Space, selects this box
            g.append(s('rect', { x, y, width: w, height: hh, rx: 10, class: 'fr ' + b.c, 'stroke-width': on ? 4 : 2, style: on ? 'stroke:var(--chc)' : null }));  // the box's frame in its own colour, outlined in the chapter colour when on
            if (key === 'user') {  // the user-level box is special
              g.append(T(16, 30, 'USER LEVEL: processes and threads', { 'font-weight': 800, 'letter-spacing': '1', class: 's-sub' }),  // it gets a label on the left
                ...['shell', 'browser', 'editor'].map((n, j) => [s('rect', { x: 330 + j * 116, y: 20, width: 100, height: 44, rx: 9, class: 's-proc', 'stroke-width': 2 }), T(380 + j * 116, 47, n, { 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 14 })]).flat());  // and three small process boxes on the right: shell, browser and editor
            } else {  // every other box
              const n = b.t.length, y0 = y + hh / 2 - ((n - 1) * 17) / 2 + 5;  // n is its number of label lines; y0 centres the block of lines in the box
              b.t.forEach((t, j) => g.append(T(x + w / 2, y0 + j * 17, t, { 'text-anchor': 'middle', 'font-weight': j ? 400 : 700, 'font-size': j ? 13 : 14, class: j ? 's-sub' : null })));  // writes each line: the first bold, the rest smaller and grey
            }  // ends the label drawing
            if (seen[key]) g.append(s('circle', { cx: x + w - 12, cy: y + 12, r: 10, style: 'fill:var(--chc)' }), T(x + w - 12, y + 16.5, String(seen[key]), { 'text-anchor': 'middle', 'font-weight': 800, style: 'fill:var(--panel)' }));  // a box already reached in a trace gets a small numbered badge in its corner showing its step
            k.push(g);  // adds the box to the map
          });  // ends the loop over boxes
          svg.replaceChildren(...k);  // replaces the map with the new shapes
        }  // ends draw()
        const info = h('div', { class: 'card white stack kinfo', style: { gap: '10px' } });  // info: the card in the Explore tab that describes the selected box
        function paintInfo() {  // paintInfo(): fills the info card for the selected box
          const b = B[sel];  // b is the selected box's record
          info.replaceChildren(h('h3', {}, b.name), h('p', { html: b.x }), h('div', { class: 'eg', html: '<b>Example:</b> ' + b.eg }));  // writes its name, explanation and example
          ctx.refit();  // asks the guide to re-measure the screen, since the card's height changed
        }  // ends paintInfo()
        function exploreTab(p) {  // exploreTab(p): builds the Explore tab into panel p when that tab is opened
          mode = 'explore'; trace = null; draw(); paintInfo();  // switches to explore mode, clears any trace, and redraws the map and card
          p.append(h('div', { class: 'stack', style: { gap: '10px' } }, info,  // the tab's contents: the info card
            h('p', { class: 'small muted m0', html: 'Colours follow the guide: <span class="chip proc">processes</span> <span class="chip mem">memory</span> <span class="chip io">devices and drivers</span> <span class="chip intr">interrupts, traps, signals</span> <span class="chip os">kernel services</span>' }),  // a colour key matching the map's colours to the guide's colour language
            h('div', { class: 'callout tip m0 small', 'data-label': 'Where modules plug in' }, 'File systems, network protocols and the three kinds of device drivers are the parts most often loaded as modules. Scheduling, memory management, interrupt handling, signals and system calls stay in the core kernel.')));  // "Where modules plug in" box: which parts are usually modules and which stay in the core kernel
        }  // ends exploreTab()
        const TR = {  // TR: the three traceable events; each is a list of steps naming the boxes involved (k) and a caption (c)
          key: [  // event 1: a key press
            { k: ['term'], c: '<b>You press a key.</b> The keyboard, part of the terminal hardware, sends a code and raises an interrupt request to the processor.' },  // step: the keyboard raises an interrupt
            { k: ['intr', 'cpu'], c: '<b>Interrupts.</b> The CPU pauses whatever was running, switches to kernel mode and runs the handler registered for the keyboard.' },  // step: the CPU switches to kernel mode and runs the keyboard's handler
            { k: ['chr'], c: '<b>Character device drivers.</b> The terminal driver reads the character and adds it to the terminal\'s input buffer, one byte at a time.' },  // step: the terminal driver buffers the character
            { k: ['sched'], c: '<b>Processes and scheduler.</b> Your shell was asleep, waiting for input. The driver wakes it, and the scheduler puts it back among the ready processes.' },  // step: the scheduler wakes the waiting shell
            { k: ['sys', 'user'], c: '<b>System calls.</b> When the shell next runs, its <code>read()</code> call returns with the character, back in user mode, and the shell shows it on screen.' },  // step: the shell's read() returns the character in user mode
            { k: ['sig'], c: '<b>A twist: Ctrl+C.</b> If you pressed Ctrl+C, the terminal driver passes on no character. Instead the kernel sends a <b>signal</b> (SIGINT) to the program in the foreground, which normally ends it.' },  // step: the Ctrl+C twist, where a signal is sent instead of a character
          ],  // ends the key-press steps
          pkt: [  // event 2: a network packet arrives
            { k: ['nic'], c: '<b>A packet arrives.</b> The network card receives it, copies it into a buffer in system memory by <span class="t">DMA</span> (without the CPU\'s help), and raises an interrupt.' },  // step: the card copies the packet into memory by DMA and raises an interrupt
            { k: ['intr', 'cpu'], c: '<b>Interrupts.</b> The CPU stops what it was doing and runs the network card\'s interrupt handler in kernel mode.' },  // step: the CPU runs the card's interrupt handler
            { k: ['netdrv'], c: '<b>Network device drivers.</b> The card\'s driver collects the packet from the buffer and passes it up to the protocols.' },  // step: the network driver collects the packet
            { k: ['net'], c: '<b>Network protocols.</b> IP checks the address; TCP puts the data in order, acknowledges it, and finds the connection (socket) it belongs to.' },  // step: IP and TCP process it and find its socket
            { k: ['phys'], c: '<b>Physical memory.</b> The data waits in that socket\'s receive buffer, in page frames the kernel owns.' },  // step: the data waits in the socket's buffer in physical memory
            { k: ['sched'], c: '<b>Processes and scheduler.</b> Your browser was asleep inside <code>recv()</code>, waiting for data. It is woken and made ready to run.' },  // step: the scheduler wakes the browser waiting in recv()
            { k: ['sys', 'user'], c: '<b>System calls.</b> <code>recv()</code> copies the data into the browser\'s own memory and returns. The web page keeps loading.' },  // step: recv() copies the data and returns
          ],  // ends the packet steps
          file: [  // event 3: a file is read
            { k: ['user', 'sys'], c: '<b>The editor calls <code>read(fd, buf, 4096)</code>.</b> A special instruction traps into kernel mode, and the system-call layer runs the read handler.' },  // step: the editor calls read() and traps into the kernel
            { k: ['fs'], c: '<b>File systems.</b> The file system works out which disk blocks hold that part of the file and checks whether they are already cached in memory.' },  // step: the file system finds the blocks and checks the cache
            { k: ['vm', 'phys'], c: '<b>Not cached.</b> The memory manager hands over a free page frame to hold the data when it arrives.' },  // step: the memory manager provides a free page frame
            { k: ['blk', 'disk'], c: '<b>Block device drivers.</b> The disk driver queues a request to read those blocks, and the disk gets to work.' },  // step: the block driver asks the disk for the blocks
            { k: ['sched'], c: '<b>Processes and scheduler.</b> Disks are slow, so the editor is put to sleep and another process gets the CPU.' },  // step: the editor sleeps while the slow disk works
            { k: ['disk', 'intr', 'cpu'], c: '<b>Interrupts.</b> The disk finishes and raises an interrupt. The driver marks the request done, and the editor is made ready again.' },  // step: the disk's interrupt marks the request done
            { k: ['trap', 'vm'], c: '<b>Traps and faults.</b> Suppose the page holding <code>buf</code> was not in memory yet. Copying into it causes a page fault; virtual memory brings the page in, and the copy carries on.' },  // step: a page fault may bring in the buffer's page
            { k: ['sys', 'user'], c: '<b>Back to user mode.</b> <code>read()</code> returns the number of bytes it read, and the editor has its data.' },  // step: read() returns to user mode with the data
          ],  // ends the file-read steps
        };  // ends the trace table
        function traceTab(p) {  // traceTab(p): builds the Trace tab into panel p when that tab is opened
          mode = 'trace';  // switches the map to trace mode
          let which = 'key', player = null;  // which: the chosen event; player: the step player for it
          const holder = h('div', {});  // holder: the spot where the player is placed, replaced whenever the event changes
          const SHORT = { user: 'process', sys: 'system call', sig: 'signals', sched: 'scheduler', vm: 'virtual memory', fs: 'file system', net: 'protocols', trap: 'trap', intr: 'interrupt', phys: 'physical memory', chr: 'character driver', blk: 'block driver', netdrv: 'network driver', cpu: 'CPU', mem: 'memory', term: 'terminal', disk: 'disk', nic: 'NIC' };  // SHORT: a short name for each box, used in the "Path so far" line
          const pathEl = h('div', { class: 'small', style: { lineHeight: '1.5' } });  // pathEl: the "Path so far" line under the player
          function build() {  // build(): makes a new step player for the chosen event
            const F = TR[which];  // F is the chosen event's list of steps
            player = ctx.ui.player({ count: F.length, interval: 3400, speed: false, render: (i) => { trace = { f: F, i }; draw(); pathEl.innerHTML = '<b>Path so far:</b> ' + F.slice(0, i + 1).map((fr, j) => `<b style="color:var(--chc)">${j + 1}</b> ${fr.k.map((k) => SHORT[k]).join(' + ')}`).join(' → '); return F[i].c; } });  // the guide's step player without speed buttons; each step redraws the map and the path line, and returns its caption
            holder.replaceChildren(player.el);  // puts the new player in place of the old one
            ctx.refit();  // asks the guide to re-measure the screen
          }  // ends build()
          const seg = ctx.ui.seg([{ value: 'key', label: 'A key press' }, { value: 'pkt', label: 'A packet arrives' }, { value: 'file', label: 'A file is read' }], which, (v) => { if (player) player.stop(); which = v; build(); });  // the three event buttons; picking one stops the old player and builds a new one
          build();  // builds the player for the first event
          p.append(h('div', { class: 'stack', style: { gap: '10px' } },  // the tab's contents
            h('p', { class: 'small m0' }, 'Pick an event, then step through it. The numbers on the map show the order in which the kernel\'s parts get involved.'),  // instruction: pick an event and step through it; the numbers show the order
            seg, holder, pathEl,  // the event buttons, the player and the path line
            h('div', { class: 'callout why m0 small', 'data-label': 'Notice' }, 'In every event the kernel sits in the middle: hardware reaches it through interrupts, and processes reach it only through system calls.')));  // "Notice" box: hardware reaches the kernel by interrupts, processes only by system calls
          return () => { if (player) player.stop(); mode = 'explore'; trace = null; };  // returns a clean-up function the tabs helper runs when leaving this tab: stop the player and go back to explore mode
        }  // ends traceTab()
        tabsEl = ctx.ui.tabs([{ label: 'Explore the parts', render: exploreTab }, { label: 'Trace what happens when…', render: traceTab }]);  // tabsEl: the guide's tabs helper with the Explore and Trace tabs; opening a tab runs its render function
        el.append(h('div', { class: 'split kgrid fill' },  // puts the step together: the map on the left, the tabs on the right
          h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center' } }, svg),  // the white card holding the kernel map, centred
          tabsEl));  // the tabs
      },  // ends render() for step 8
    },  // ends step 8
    /* ---------------- 8. Recap ---------------- */
    {  // step 9 begins: a recap screen of flip cards
      title: 'Recap: eight things to remember about Linux',  // step 9's title, shown as the screen heading
      kind: 'recap',  // kind "recap" labels this screen as a Recap step
      render(el, ctx) {  // render(el, ctx): builds the recap screen when the step opens
        const { h } = ctx;  // takes h, the helper that builds page elements, from ctx
        el.append(h('div', { class: 'stack fill' },  // puts the recap into the screen as one column
          h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. If one surprises you, revisit that step.'),  // instruction: answer out loud before flipping, and revisit any step that surprises you
          h('div', { class: 'grow' }, ctx.ui.flipcards([  // the guide's flip-card helper inside a growing area: each pair is [front question, back answer]
            ['Who started Linux, when, and on what?', 'Linus Torvalds, a Finnish computer science student, in 1991: a UNIX-like kernel for his Intel 80386 PC, posted on the Internet so that others could join in.'],  // card: who started Linux, when, and on what computer
            ['Why did Linux succeed?', 'It was free under the GNU GPL, it completed the FSF\'s GNU tools into a whole free system, collaborators worldwide improved it, and its modular, portable design runs almost anywhere.'],  // card: why Linux succeeded
            ['The GPL deal, in one line', 'Use, study, change and share it freely. If you distribute it, changed or not, pass on the same freedoms and the source code (copyleft).'],  // card: the GPL deal in one line
            ['Monolithic, yet modular?', 'All kernel code runs in kernel mode in one address space and calls itself directly (monolithic), but much of it comes as loadable modules added and removed while the system runs.'],  // card: how Linux is monolithic yet modular
            ['Dynamic linking', 'A module is loaded and linked into the kernel while it runs: its unresolved names get real addresses from the kernel symbol table. It can be unlinked and removed at any time.'],  // card: dynamic linking
            ['Stackable modules', 'Modules form a hierarchy: lower ones are libraries for the clients above. Counted references let the kernel load prerequisites first and refuse to remove a module that others need.'],  // card: stackable modules
            ['What does a module-table entry hold?', 'Name, size, usecount, flags, its symbol table (exported names and addresses) and its dependencies. Entries form a linked list, newest first. rmmod needs usecount 0 and no module stacked on it.'],  // card: what a module-table entry holds and when rmmod works
            ['Name the kernel\'s components', 'Signals, system calls, processes and scheduler, virtual memory, file systems, network protocols, character, block and network device drivers, traps and faults, physical memory, interrupts.'],  // card: the kernel's components
          ], { cols: 4, height: 228 }))));  // ends the cards; lays them out in 4 columns, each card 228 pixels tall
      },  // ends render() for step 9
    },  // ends step 9
    /* ---------------- 9. Check yourself ---------------- */
    {  // step 10 begins: the section quiz
      title: 'Check yourself: Linux',  // step 10's title, shown as the screen heading
      kind: 'check',  // kind "check" labels this screen as a Check Yourself step
      quiz: [  // quiz: the questions; the guide's quiz engine draws, checks and scores them
        { q: 'Linux was first written for which kind of computer?',  // quiz question 1 (multiple choice): what kind of computer Linux was first written for
          choices: ['A DEC PDP-7 minicomputer', 'A Cray supercomputer', 'A PC built around Intel\'s 80386 processor', 'An ARM-based smartphone'], answer: 2,  // the four choices; answer 2 (counting from 0) is the Intel 80386 PC
          feedback: ['That is where the original UNIX was born, around 1969, not Linux.', 'Linux runs the fastest supercomputers today, but it began on one student\'s PC.', null, 'Phones came much later: Linux reached them through Android in 2008.'],  // feedback shown for each wrong choice (null for the right one): PDP-7, Cray, ARM phone
          why: 'In 1991 Linus Torvalds, a computer science student in Finland, wrote a UNIX-like kernel for his own IBM-compatible PC with an Intel 80386 processor and shared it on the Internet.' },  // why: the full explanation shown after the question is answered
        { q: 'In the early 1990s, what did the GNU project and Linux each contribute to a complete free operating system?',  // quiz question 2 (multiple choice): what GNU and Linux each contributed in the early 1990s
          choices: ['Linux had the tools; GNU supplied the kernel', 'GNU had the compiler, shell, C library and utilities; Linux supplied the missing kernel', 'GNU wrote the GPL specially for Linux once Linux was finished', 'Nothing: Linux was a complete system on its own from day one'], answer: 1,  // the four choices; answer 1 says GNU had the tools and Linux supplied the kernel
          feedback: ['It was the other way round: GNU\'s own kernel was not ready.', null, 'The FSF published the GPL in 1989, two years before Linux existed; Linux adopted it in 1992.', 'A kernel alone gives you no compiler, no shell and no commands; the GNU tools filled those layers.'],  // feedback for each wrong choice: backwards roles, the GPL's real date, and a kernel alone being no system
          why: 'The FSF\'s GNU project had built almost every layer of a UNIX-like system except a finished kernel. Linux filled that gap, which is a big part of why it succeeded.' },  // why: GNU had every layer but a kernel, and Linux filled that gap
        { type: 'tf', q: 'Under the GNU GPL, a company that sells a device running a modified Linux kernel must make the source code of its kernel changes available to the people who buy the device.', answer: true,  // quiz question 3 (true or false): selling a device with a changed kernel means sharing those changes; answer: true
          why: 'Distributing GPL software, changed or not, brings the copyleft duty: recipients must be able to get the source code, including the changes, under the same license.' },  // why: distributing GPL software brings the copyleft duty to share the source
        { q: 'Which of these is <b>not</b> stored in a module\'s entry in the Linux module table?',  // quiz question 4 (multiple choice): which item is not stored in a module-table entry
          choices: ['The module\'s usecount', 'The symbols the module exports, with their addresses', 'The modules it depends on', 'The ID of the process in which the module runs'], answer: 3,  // the four choices; answer 3, the process ID, is the one not stored
          feedback: ['It is stored: the usecount counts the operations using the module right now, and the kernel checks it before unloading.', 'It is stored: the module\'s own symbol table lists each exported name with its address, so later modules can link against them.', 'It is stored: the dependency list lets the kernel keep needed modules loaded and refuse unsafe removals.', null],  // feedback for each wrong choice: the usecount, the exported symbols and the dependencies are all stored
          why: 'A module is not a process, so it has no process ID: its code runs in kernel mode on behalf of whichever process calls it. An entry holds the name, size, usecount, flags, exported symbols and dependencies, plus a pointer to the next entry.' },  // why: a module is not a process, so it has no process ID; lists what an entry does hold
        { type: 'multi', q: 'Which statements about a Linux loadable module are true? Select all that apply.',  // quiz question 5 (select all that apply): which statements about a loadable module are true
          choices: ['It runs in kernel mode', 'It can be loaded and unloaded while the system is running', 'It runs as a separate process with its own address space', 'It usually implements one function, such as a driver, a file system or a network protocol', 'It communicates with the rest of the kernel only by sending messages'], answer: [0, 1, 3],  // five statements; answer: kernel mode, load and unload while running, and one job each (choices 0, 1 and 3)
          why: 'A module is linked into the kernel and runs in kernel mode on behalf of the current process. It is not a process of its own, and it uses ordinary function calls, not messages. That is why modules do not turn Linux into a microkernel.' },  // why: a module runs in kernel mode for the current process, is not a process, and sends no messages
        { type: 'order', q: 'Put the life of a Linux loadable module into the correct order, from loading to unloading.',  // quiz question 6 (put in order): the life of a module from loading to unloading
          items: ['The module file (.ko) is read from disk', 'Its code and data are copied into kernel memory', 'Each unresolved name gets its real address from the kernel symbol table', 'Its init function runs and registers the module', 'Operations call its functions, so its usecount rises above 0', 'Its usecount falls back to 0, and rmmod unloads it'],  // the six stages in their correct order; the quiz shuffles them for the student
          why: 'Each step needs the one before it: code must be in memory before it can be linked, linked (every call pointing at a real address) before init can safely run, registered before anyone can use it, and idle before it can be removed.' },  // why: each stage needs the one before it
        { type: 'tf', q: 'In the Linux module table, a module whose usecount is 0 can always be unloaded with rmmod.', answer: false,  // quiz question 7 (true or false): usecount 0 always allows rmmod; answer: false
          why: 'The usecount only counts operations using the module right now. The kernel also checks the modules stacked on it: with usb_storage loaded, <code>rmmod usbcore</code> is refused ("in use by: usb_storage") even at usecount 0, because usb_storage calls usbcore\'s functions.' },  // why: modules stacked on it also block removal, as rmmod usbcore shows
        { type: 'num', q: 'A module\'s usecount is 0. Five operations that use its functions start, and then two of them finish. What is its usecount now?', answer: 3, tol: 0,  // quiz question 8 (calculate): usecount after five starts and two ends; answer: 3, with no tolerance for error
          why: 'The usecount rises by 1 when an operation using the module starts and falls by 1 when it ends: 0 + 5 − 2 = 3. The module cannot be unloaded until the count is back to 0.' },  // why: 0 + 5 - 2 = 3
        { type: 'num', q: 'In a microkernel system, an app sends a read request to a user-mode file server, which sends its own request to a user-mode disk-driver server. Each request gets a reply. How many messages are passed in total?', answer: 4, tol: 0,  // quiz question 9 (calculate): messages passed for one read in a microkernel; answer: 4
          why: 'Two requests (app → file server, file server → driver) plus two replies (driver → file server, file server → app) make 4 messages, each a trip into and out of the kernel. A monolithic kernel such as Linux does the same work with direct function calls.' },  // why: two requests plus two replies, each a trip through the kernel
        { type: 'match', q: 'Match each Linux kernel component to its job.',  // quiz question 10 (match the pairs): each kernel component with its job
          pairs: [['Signals', 'Tell a process that an event happened, such as Ctrl+C'], ['Processes and scheduler', 'Decide which ready process runs next'], ['Virtual memory', 'Map each process\'s addresses onto real page frames'], ['Traps and faults', 'Handle errors the processor itself detects, such as a page fault'], ['Block device drivers', 'Read and write fixed-size blocks on disks'], ['Network protocols', 'Carry out rules such as IP and TCP']],  // the six component and job pairs to match
          why: 'Each component owns one kind of work. Signals and traps both deal with events, but signals are notices sent to processes, while traps are raised by the processor itself.' },  // why: signals are notices to processes, while traps are raised by the processor itself
        { type: 'bucket', q: 'Which kernel design does each statement describe?', buckets: ['Monolithic / Linux', 'Microkernel'],  // quiz question 11 (sort into groups): which design each statement describes, monolithic/Linux or microkernel
          items: [['All services share one address space', 0], ['Drivers run as user-mode processes', 1], ['A request needs several messages', 1], ['A buggy driver can crash everything', 0], ['Parts call each other directly', 0], ['A crashed driver can be restarted', 1]],  // the six statements, each with the number of its correct group
          why: 'Monolithic kernels, Linux included, trade isolation for speed: one address space and direct calls. Microkernels trade speed for isolation: services are separate processes that talk by messages.' },  // why: monolithic kernels trade isolation for speed, microkernels speed for isolation
        { q: 'A network packet arrives and the network card raises an interrupt. Which kernel component takes the packet from the card first?',  // quiz question 12 (multiple choice): which component takes an arriving packet from the card first
          choices: ['Network device drivers', 'Network protocols', 'File systems', 'Signals'], answer: 0,  // the four choices; answer 0, the network device drivers
          feedback: [null, 'The protocols (IP, then TCP) work on the packet next, after the driver hands it up.', 'File systems manage files on storage devices, not packets.', 'Signals notify processes; they do not move data.'],  // feedback for each wrong choice: the protocols come next, file systems and signals do not move packets
          why: 'The interrupt handler belongs to the card\'s network device driver, which collects the packet and passes it up to the network protocols. Only then is the waiting process woken.' },  // why: the card's interrupt handler belongs to its driver, which passes the packet up
      ],  // ends the quiz list
    },  // ends step 10
  ],  // ends the list of steps

  notes: `${/* notes: the section's reference notes as HTML, shown in the Notes drawer (the N key or the Notes button) */''}
    <h3>Linux in brief</h3>${/* heading for part 1 of the notes: Linux in brief */''}
    <p><b>Linux</b> is a free, open-source, UNIX-like operating-system kernel: it follows the design and commands of UNIX but contains no UNIX code. It is <b>monolithic, yet built from loadable modules</b>, and it runs on routers, phones, laptops, cloud servers and every one of the world's 500 fastest supercomputers. Its winning traits: free and open source, highly modular, easily configured, and able to run on many platforms.</p>${/* notes paragraph: what Linux is and where it runs */''}
    <h3>History</h3>${/* heading for part 2 of the notes: history */''}
    <ul>${/* starts the history list */''}
      <li><b>1983–1985:</b> Richard Stallman launches the <b>GNU project</b> (a complete, free UNIX-like system) and founds the <b>Free Software Foundation (FSF)</b>. By 1991 GNU has a compiler (GCC), a shell (bash), a C library, editors and utilities, but no finished kernel.</li>${/* list item: 1983-1985, the GNU project and the FSF */''}
      <li><b>1991:</b> <b>Linus Torvalds</b>, a computer science student at the University of Helsinki in Finland, writes a UNIX-like kernel for his PC with a 32-bit <b>Intel 80386</b> processor and posts it on the Internet. Volunteers worldwide join in.</li>${/* list item: 1991, Torvalds writes the kernel for his 80386 PC */''}
      <li><b>1992:</b> Linux is released under the <b>GNU GPL</b>. With the GNU tools it forms a complete free system, and the first distributions (kernel plus tools, ready to install) appear.</li>${/* list item: 1992, the GPL release and the first distributions */''}
      <li><b>1994:</b> version 1.0 for 386 PCs, with networking. <b>Mid 1990s:</b> loadable modules; ports to Alpha, SPARC and MIPS; version 2.0 (1996) uses several processors.</li>${/* list item: 1994 version 1.0, then modules, ports and multiprocessor support */''}
      <li><b>2000s:</b> servers, paid company developers, embedded devices. <b>2008:</b> Android phones ship with a Linux kernel (section 2.11). <b>Today:</b> a release every nine or ten weeks, thousands of developers, about twenty processor families.</li>${/* list item: the 2000s, Android in 2008, and today's release pace */''}
    </ul>${/* ends the history list */''}
    <h3>Why Linux succeeded</h3>${/* heading for part 3 of the notes: why Linux succeeded */''}
    <ul>${/* starts the list of reasons */''}
      <li><b>Free software under the GPL:</b> anyone may run, study, change and share the code. Whoever distributes it, changed or not, must pass on the same freedoms and make the source available. This rule is <b>copyleft</b>: improvements can never be locked away. "Free" means freedom, not zero price.</li>${/* list item: free software under the GPL, and copyleft */''}
      <li><b>The GNU tools</b> supplied every layer except the kernel, so Linux completed a usable system (hence "GNU/Linux" for the whole system; strictly, Linux is only the kernel).</li>${/* list item: the GNU tools supplied every other layer */''}
      <li>Collaboration over the Internet, and a modular, portable design.</li>${/* list item: Internet collaboration and a modular, portable design */''}
    </ul>${/* ends the list of reasons */''}
    <p><b>GPL cases.</b> Allowed: reading the source, changing it privately without distributing it, selling copies (with the source). Not allowed: shipping a device with a changed kernel while hiding the changes, or putting GPL code into a program under a license that forbids sharing.</p>${/* notes paragraph: which GPL cases are allowed and which are not */''}
    <h3>Monolithic, microkernel and Linux</h3>${/* heading for part 4 of the notes: monolithic, microkernel and Linux */''}
    <p>A <b>monolithic kernel</b> runs all OS services (scheduling, memory, file systems, drivers, networking) as one big program in kernel mode, in one address space, and its parts call each other directly. A <b>microkernel</b> keeps only message passing, address spaces and basic scheduling in the kernel and runs file systems and drivers as user-mode server processes. <b>Linux is monolithic, but structured as a collection of loadable modules.</b> Modules do not make it a microkernel: a loaded module shares the kernel's address space and privileges, so a buggy one can crash the system (an "oops" may kill only the current process; a "kernel panic" stops everything).</p>${/* notes paragraph: how monolithic kernels, microkernels and Linux differ */''}
    <table>${/* starts the comparison table */''}
      <tr><th></th><th>Monolithic</th><th>Microkernel</th><th>Linux</th></tr>${/* table header row: the three designs */''}
      <tr><td>Request speed</td><td>Fast: direct calls</td><td>Slower: messages</td><td>Fast: direct calls</td></tr>${/* table row: request speed in each design */''}
      <tr><td>A driver bug</td><td>Can crash everything</td><td>Contained; server restarted</td><td>Can crash everything</td></tr>${/* table row: what a driver bug does in each design */''}
      <tr><td>Adding a driver</td><td>Rebuild and restart</td><td>Start a server process</td><td>Load a module, no restart</td></tr>${/* table row: what adding a driver takes in each design */''}
    </table>${/* ends the comparison table */''}
    <p><b>Worked example.</b> Reading a file in a monolithic kernel (or Linux) costs 2 user/kernel crossings (the system call in, the return out) and 0 messages. In a microkernel where the app asks a file server, which asks a disk-driver server, there are 2 requests + 2 replies = <b>4 messages</b>, each going into and out of the kernel: <b>8 crossings</b>.</p>${/* notes paragraph: the worked example counting crossings and messages for one read */''}
    <h3>Loadable modules</h3>${/* heading for part 5 of the notes: loadable modules */''}
    <p>A <b>loadable module</b> is a relatively independent block of kernel code that usually does one job: a file system (vfat), a device driver (usb_storage) or a network protocol (bluetooth). It can be loaded and unloaded while the system runs, and it is <b>not a separate process</b>: its code runs in kernel mode on behalf of the current process, for example during that process's system call. Two key properties:</p>${/* notes paragraph: what a loadable module is and how it runs */''}
    <ol>${/* starts the list of the two key properties */''}
      <li><b>Dynamic linking.</b> A module can be loaded and linked into the kernel while the kernel is in memory and running, and unlinked and removed at any time. Loading: read the .ko file from disk → copy its code and data into kernel memory → give each name it calls but does not contain its real address from the kernel <b>symbol table</b> → enter it at the front of the module table with its dependencies → run its init function. Unloading runs its exit function, removes its symbols, unlinks its entry and frees its memory.</li>${/* list item: dynamic linking, with the steps of loading and unloading */''}
      <li><b>Stackable modules.</b> Modules form a hierarchy: a lower module is a library for the client modules above it (usb_storage and xhci_hcd use usbcore; uas uses usb_storage; vfat uses fat), and the kernel counts these references. Shared code therefore exists only once, and the kernel can load prerequisites first and refuse to remove a module that others still need.</li>${/* list item: stackable modules and counted references */''}
    </ol>${/* ends the list of properties */''}
    <h3>The module table</h3>${/* heading for part 6 of the notes: the module table */''}
    <p>The kernel keeps its loaded modules in a <b>linked list</b>, newest first. Each entry records:</p>${/* notes paragraph: loaded modules form a linked list, newest first */''}
    <table>${/* starts the table of entry fields */''}
      <tr><th>Field</th><th>What it records</th></tr>${/* table header row: field and what it records */''}
      <tr><td>next</td><td>Address of the next entry (NULL at the end of the list)</td></tr>${/* table row: next */''}
      <tr><td>name</td><td>The module's name; rmmod and lsmod find entries by it</td></tr>${/* table row: name */''}
      <tr><td>size</td><td>Kernel memory its code and data occupy, freed on unload</td></tr>${/* table row: size */''}
      <tr><td>usecount</td><td>Operations using it right now: +1 when one starts, −1 when it ends</td></tr>${/* table row: usecount */''}
      <tr><td>flags</td><td>Its state: loading (init still running), live, or going (being removed)</td></tr>${/* table row: flags */''}
      <tr><td>symbol table (syms, nsyms)</td><td>The names it exports, each with its address</td></tr>${/* table row: the symbol table (syms, nsyms) */''}
      <tr><td>dependencies (deps, ndeps)</td><td>The modules it relies on; the entry also lists the modules that rely on it (refs)</td></tr>${/* table row: dependencies (deps, ndeps) and refs */''}
    </table>${/* ends the table of entry fields */''}
    <ul>${/* starts the list of module-table rules */''}
      <li><b>rmmod is refused</b> if the usecount is above 0 <b>or</b> another loaded module depends on the target. Usecount 0 alone is not enough: with usb_storage loaded, <code>rmmod usbcore</code> fails ("in use by: usb_storage").</li>${/* list item: when rmmod is refused */''}
      <li>Usecount example: start at 0, five operations begin and two end, so the usecount is 0 + 5 − 2 = 3.</li>${/* list item: the usecount example worked out */''}
      <li><code>insmod</code> loads exactly one module and fails with "Unknown symbol" if a module it needs is missing. <code>modprobe</code> loads prerequisites first (for uas: usbcore, usb_storage, uas); the system runs it automatically when you plug in a device.</li>${/* list item: how insmod and modprobe differ */''}
      <li>Modern kernels merge the usecount and the references from other modules into one counter (the "Used by" number in lsmod); the rules are the same.</li>${/* list item: modern kernels merge the two counts into one "Used by" number */''}
    </ul>${/* ends the list of rules */''}
    <h3>Kernel components</h3>${/* heading for part 7 of the notes: kernel components */''}
    <table>${/* starts the table of components */''}
      <tr><th>Component</th><th>Job</th></tr>${/* table header row: component and job */''}
      <tr><td>System calls</td><td>The entry points through which processes ask the kernel for services</td></tr>${/* table row: system calls */''}
      <tr><td>Signals</td><td>Notify a process of an event (Ctrl+C sends SIGINT)</td></tr>${/* table row: signals */''}
      <tr><td>Processes and scheduler</td><td>Create and end processes and threads; choose which runs next</td></tr>${/* table row: processes and scheduler */''}
      <tr><td>Virtual memory</td><td>Give each process its own address space, mapping its pages onto page frames</td></tr>${/* table row: virtual memory */''}
      <tr><td>File systems</td><td>Turn disk blocks into files and folders (ext4, vfat and more)</td></tr>${/* table row: file systems */''}
      <tr><td>Network protocols</td><td>Carry out IP, TCP and other protocols for sockets</td></tr>${/* table row: network protocols */''}
      <tr><td>Character device drivers</td><td>Byte-stream devices: keyboards, terminals, mice</td></tr>${/* table row: character device drivers */''}
      <tr><td>Block device drivers</td><td>Fixed-size-block devices: disks, SSDs, USB sticks</td></tr>${/* table row: block device drivers */''}
      <tr><td>Network device drivers</td><td>Move packets to and from the network interface controller</td></tr>${/* table row: network device drivers */''}
      <tr><td>Traps and faults</td><td>Handle exceptions the processor raises itself (page fault, divide by zero)</td></tr>${/* table row: traps and faults */''}
      <tr><td>Physical memory</td><td>Track and hand out RAM's page frames (fixed-size slots, typically 4 KB)</td></tr>${/* table row: physical memory */''}
      <tr><td>Interrupts</td><td>Run the handler when a device raises an interrupt</td></tr>${/* table row: interrupts */''}
    </table>${/* ends the table of components */''}
    <p>Above the kernel sit user-level processes and threads; below it the hardware: CPU, system memory, terminal, disk and network interface controller (NIC). File systems, network protocols and device drivers are the parts most often loaded as modules.</p>${/* notes paragraph: what sits above and below the kernel, and which parts are usually modules */''}
    <ul>${/* starts the list of event traces */''}
      <li><b>Key press:</b> interrupt → character (terminal) driver buffers the byte → scheduler wakes the shell → its read() returns. Ctrl+C instead sends a SIGINT signal.</li>${/* list item: the path of a key press, and the Ctrl+C signal */''}
      <li><b>Packet arrives:</b> NIC copies it to memory by DMA and interrupts → network device driver takes it first → IP and TCP → socket buffer → scheduler wakes the browser → recv() returns.</li>${/* list item: the path of an arriving network packet */''}
      <li><b>File read:</b> read() → file system (is it cached?) → a page frame is set aside → block driver asks the disk → another process runs meanwhile → disk interrupt → a page fault may bring in the buffer's page → read() returns.</li>${/* list item: the path of a file read */''}
    </ul>`,  // ends the list of traces; the backtick closes the notes text
});  // ends the section object and the Guide.section call
